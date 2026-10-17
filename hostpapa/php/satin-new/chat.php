<?php
declare(strict_types=1);
// Website chat: visitor widget API, answer engine (knowledge base + page index, optional Anthropic AI), human handoff.
// Routed from api.php (/api/chat/...). Admin side lives in chat_admin.php (/api/admin/chat/...).
// The Anthropic API key lives only in site_settings ('chat.settings'), written by Admin → Live chat → Settings, never sent to a browser.
require_once __DIR__ . '/auth.php';

const CHAT_MAX_MESSAGE = 1000;
const CHAT_HEADER = 'HTTP_X_CHAT_TOKEN';
const CHAT_DEFAULT_MODEL = 'claude-sonnet-4-5';
const CHAT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CHAT_FILE_MAX = 20 * 1024 * 1024;      // per attachment
const CHAT_FILES_PER_CHAT = 30;              // per conversation (visitor side)
const CHAT_BYTES_PER_CHAT = 200 * 1024 * 1024;
const CHAT_KB_VERSION = 2;                   // bump when chat_seed_entries() gains entries (merged into existing installs)

/* ---------------- database ---------------- */
function chat_db(): PDO {
    static $done = false;
    $pdo = adb();
    if ($done) return $pdo;
    $done = true;
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $k = $my ? 'VARCHAR(64)' : 'TEXT'; $s = $my ? 'VARCHAR(255)' : 'TEXT'; $t = $my ? 'MEDIUMTEXT' : 'TEXT';
    $auto = $my ? 'BIGINT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $cs = $my ? ' DEFAULT CHARSET=utf8mb4' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_conversations (id $k PRIMARY KEY, token_hash $s NOT NULL, name $s NOT NULL, email $s NOT NULL, phone $s NOT NULL,
        page_url $s NOT NULL, first_page $s NOT NULL, lang $s NOT NULL, status $s NOT NULL, mode $s NOT NULL, human_requested_at $s NOT NULL, emailed_at $s NOT NULL,
        unread_staff INTEGER NOT NULL, last_visitor_at $s NOT NULL, last_staff_at $s NOT NULL, last_message_at $s NOT NULL, last_preview $s NOT NULL,
        ip $s NOT NULL, agent $s NOT NULL, created_at $s NOT NULL, updated_at $s NOT NULL" . ($my ? ', INDEX idx_chat_token (token_hash), INDEX idx_chat_last (last_message_at)' : '') . ")$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_messages (id $auto, conversation_id $k NOT NULL, sender $s NOT NULL, staff_name $s NOT NULL, body $t NOT NULL, links $t NOT NULL,
        source $s NOT NULL, created_at $s NOT NULL" . ($my ? ', INDEX idx_chat_msg_conv (conversation_id, id)' : '') . ")$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_kb (id $k PRIMARY KEY, question $t NOT NULL, answer $t NOT NULL, keywords $t NOT NULL, url $s NOT NULL,
        enabled INTEGER NOT NULL, sort_order INTEGER NOT NULL, created_at $s NOT NULL, updated_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_pages (id $auto, url $s NOT NULL, title $s NOT NULL, body $t NOT NULL, terms $t NOT NULL, len INTEGER NOT NULL)$cs");
    if (!$my) {
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_chat_token ON chat_conversations (token_hash)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_chat_last ON chat_conversations (last_message_at)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON chat_messages (conversation_id, id)');
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS chat_files (id $k PRIMARY KEY, conversation_id $k NOT NULL, sender $s NOT NULL, name $s NOT NULL, mime $s NOT NULL, size INTEGER NOT NULL,
        width INTEGER NOT NULL, height INTEGER NOT NULL, path $s NOT NULL, thumb $s NOT NULL, created_at $s NOT NULL" . ($my ? ', INDEX idx_chat_files_conv (conversation_id)' : '') . ")$cs");
    if (!$my) $pdo->exec('CREATE INDEX IF NOT EXISTS idx_chat_files_conv ON chat_files (conversation_id)');
    if ((int)chat_setting_raw('chat.schema') < 2) { // attachments, typing / online state, Persian answers, push throttle
        foreach (["ALTER TABLE chat_messages ADD COLUMN files $t", "ALTER TABLE chat_kb ADD COLUMN answer_fa $t"] as $sql) { try { $pdo->exec($sql); } catch (Throwable $e) { } }
        foreach (['visitor_seen_at', 'visitor_typing_at', 'staff_typing_at', 'staff_typing_name', 'pushed_at'] as $col) { try { $pdo->exec("ALTER TABLE chat_conversations ADD COLUMN $col $s NOT NULL DEFAULT ''"); } catch (Throwable $e) { } }
        chat_setting_put('chat.schema', 2);
    }
    if ((int)$pdo->query('SELECT COUNT(*) n FROM chat_kb')->fetch()['n'] === 0 && !chat_setting_raw('chat.kb_seeded')) {
        chat_seed_kb($pdo);
        chat_setting_put('chat.kb_seeded', true);
        chat_setting_put('chat.kb_version', CHAT_KB_VERSION);
    } elseif ((int)chat_setting_raw('chat.kb_version') < CHAT_KB_VERSION) {
        chat_kb_upgrade($pdo);
    }
    return $pdo;
}

function chat_setting_raw(string $k) { $q = adb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute([$k]); $r = $q->fetch(); return $r ? json_decode($r['v'], true) : null; }
function chat_setting_put(string $k, $v): void {
    $pdo = adb(); $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute([$k, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now_iso()]);
    $pdo->commit();
}

/* ---------------- settings ---------------- */
function chat_default_hours(): array {
    // index 0 = Sunday … 6 = Saturday (America/Toronto)
    return [['closed' => true, 'open' => '', 'close' => ''], ['closed' => false, 'open' => '09:00', 'close' => '17:00'], ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
        ['closed' => false, 'open' => '09:00', 'close' => '17:00'], ['closed' => false, 'open' => '09:00', 'close' => '17:00'], ['closed' => false, 'open' => '09:00', 'close' => '17:00'],
        ['closed' => false, 'open' => '10:00', 'close' => '15:00']];
}
function chat_settings(): array {
    $c = chat_setting_raw('chat.settings'); $c = is_array($c) ? $c : [];
    $hours = is_array($c['hours'] ?? null) && count($c['hours']) === 7 ? $c['hours'] : chat_default_hours();
    return [
        'enabled' => ($c['enabled'] ?? true) !== false,
        'welcome' => (string)($c['welcome'] ?? 'Hi! I’m the Satin Graphic assistant. Ask me about vehicle wraps, PPF, window tint, printing, apparel or wallpaper — or talk to our team.'),
        'welcomeFa' => (string)($c['welcomeFa'] ?? 'سلام! من دستیار ستین گرافیک هستم. دربارهٔ رپ خودرو، PPF، شیشه دودی، چاپ، پوشاک یا کاغذدیواری بپرسید — یا با همکاران ما صحبت کنید.'),
        'hours' => $hours,
        'waitMinutes' => max(1, min(30, (int)($c['waitMinutes'] ?? 3))),
        'whatsapp' => preg_replace('/\D+/', '', (string)($c['whatsapp'] ?? '')),
        'notifyEmail' => (string)($c['notifyEmail'] ?? ''),
        'quickReplies' => array_values(array_filter(array_map('strval', is_array($c['quickReplies'] ?? null) ? $c['quickReplies'] : [
            'Thanks for reaching out! Let me check that for you.',
            'Could you send a few photos of the vehicle (all four sides) to info@satingraphic.ca?',
            'You can get a firm price with the quote form: /satin/contact/',
            'We are at 50 Viceroy Rd, Unit 22–23, Vaughan. Shop visits are by appointment.',
            'Thanks! We will email you the quote within one business day.',
        ]))),
        'aiEnabled' => ($c['aiEnabled'] ?? false) === true,
        'aiModel' => (string)($c['aiModel'] ?? '') ?: CHAT_DEFAULT_MODEL,
        'aiKey' => (string)($c['aiKey'] ?? ''),
        'updatedAt' => $c['updatedAt'] ?? null, 'updatedBy' => $c['updatedBy'] ?? null,
    ];
}
function chat_notify_to(?array $s = null): string {
    $s = $s ?? chat_settings();
    $e = $s['notifyEmail'] !== '' ? $s['notifyEmail'] : (string)cfg('notify_email', '');
    return filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : '';
}
function chat_now(): DateTime { return new DateTime('now', new DateTimeZone('America/Toronto')); }
function chat_open_now(?array $s = null): bool {
    $s = $s ?? chat_settings(); $n = chat_now();
    $d = $s['hours'][(int)$n->format('w')] ?? null;
    if (!$d || !empty($d['closed'])) return false;
    $t = $n->format('H:i');
    return $t >= (string)$d['open'] && $t < (string)$d['close'];
}
function chat_hours_text(?array $s = null): string {
    $s = $s ?? chat_settings(); $short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    $order = [1, 2, 3, 4, 5, 6, 0]; $groups = [];
    foreach ($order as $i) {
        $h = $s['hours'][$i]; $label = !empty($h['closed']) ? 'closed' : $h['open'] . '–' . $h['close'];
        if ($groups && end($groups)['label'] === $label) $groups[count($groups) - 1]['to'] = $short[$i];
        else $groups[] = ['from' => $short[$i], 'to' => $short[$i], 'label' => $label];
    }
    return implode(' · ', array_map(fn($g) => ($g['from'] === $g['to'] ? $g['from'] : $g['from'] . '–' . $g['to']) . ' ' . $g['label'], $groups));
}
function chat_staff_online(): bool { $t = chat_setting_raw('chat.staff_seen'); return is_int($t) && $t > time() - 120; }
function chat_wa_link(string $num): string { return $num === '' ? '' : 'https://wa.me/' . $num; }

/* ---------------- text helpers ---------------- */
const CHAT_TERMS_VERSION = 2; // bump when chat_terms() changes: the page index is rebuilt automatically
const CHAT_STOP = ['a','an','the','and','or','but','if','then','of','to','in','on','at','by','for','with','about','as','is','are','was','were','be','been','being','do','does','did','i','me','my','we','our','us','you','your','it','its','this','that','these','those','there','here','what','which','who','whom','whose','when','how','can','could','would','should','will','shall','may','might','have','has','had','from','so','not','no','yes','any','some','all','get','got','am','im','please','pls','plz','hi','hello','hey','thanks','thank','want','wanna','need','like','know','tell','also','just','one','into','than','too','very','much','many','more','most','other','such','only','own','same','out','up','down','over','under','again','further','once','each','few','both','why','ca','whats','hows','wheres','whos','thats','theres','youre','ive','id','ill','cant','wont','www','https','http','com','etc','dont','don','doesn','isn','yo','hii','ok','okay','guys','sir','madam','looking','interested','question','wondering','possible','able','give','let','make','something','anything','thing','things','offer','provide','sell','service','services','kind','type','types','way','u','ur','r','accept','accepted','take','takes','send','sent','bring','available','currently','still','right','ever','usually','really',
    'از','به','با','در','که','را','رو','و','یا','این','آن','اون','است','هست','هستید','هستین','هستن','چه','چی','چیه','برای','واسه','من','ما','شما','یک','یه','هم','تا','می','دارید','دارین','دارم','داره','داشتم','میخواستم','میخوام','میخواهم','خواستم','لطفا','سلام','ممنون','مرسی','آیا','ایا','چطور','چطوری','چگونه','کنید','کنین','کنم','کنیم','بکنم','کردن','کنه','بشه','میشه','شه','بود','باشه','باشد','نیز','اگر','اگه','وقتی','خیلی','کی','بله','نه','ولی','اما','خوب','خب','جان','آقا','خانم','بپرسم','سوال','یعنی','الان','همین','باید','بدید','بدین','بگید','بگین','لطف','هستش','ه','انجام','میدید','میدین','میدهید','میکنید','میکنین','میکنی','میکنن','دادن','کنند','امکان','امکانش','داره','ممکن','ممکنه','لازم','لازمه','بسازم','بسازید','ساختن','کردن؟','میخوام؟','mikonid','mikonin','mikoni','darid','darin','hast','hastid','chie','chi','baraye','man','shoma','ham','ya','va','ro','bara','lotfan','salam','mamnoon','mersi','merci','khob','aya','دارد','نداره','هست؟','چیه','کنم؟','بدم','بفرستم','فرستادن'];
const CHAT_SYN = [
    // English → canonical
    'color' => 'colour', 'colors' => 'colour', 'colours' => 'colour', 'sticker' => 'sticker', 'stickers' => 'sticker', 'lettering' => 'decal', 'letters' => 'decal', 'decals' => 'decal', 'graphic' => 'graphics',
    'cost' => 'price', 'costs' => 'price', 'pricing' => 'price', 'prices' => 'price', 'priced' => 'price', 'expensive' => 'price', 'cheap' => 'price', 'cheaper' => 'price', 'fee' => 'price', 'fees' => 'price', 'rate' => 'price', 'rates' => 'price', 'charge' => 'price', 'budget' => 'price', 'quote' => 'price', 'quotes' => 'price', 'quotation' => 'price', 'estimate' => 'price', 'estimates' => 'price', 'estimator' => 'estimator',
    'address' => 'location', 'where' => 'location', 'located' => 'location', 'directions' => 'location', 'locate' => 'location', 'map' => 'location',
    'hour' => 'hours', 'open' => 'hours', 'opening' => 'hours', 'closed' => 'hours', 'close' => 'hours', 'closing' => 'hours', 'schedule' => 'hours',
    'tinting' => 'tint', 'tinted' => 'tint', 'tints' => 'tint', 'bra' => 'ppf', 'xpel' => 'ppf', 'tshirt' => 'shirt', 'tee' => 'shirt', 'tees' => 'shirt', 'shirts' => 'shirt', 'polo' => 'shirt', 'polos' => 'shirt',
    'hoodies' => 'hoodie', 'sweatshirt' => 'hoodie', 'sweatshirts' => 'hoodie', 'sweater' => 'hoodie', 'crewneck' => 'hoodie', 'hats' => 'hat', 'cap' => 'hat', 'caps' => 'hat', 'beanie' => 'hat', 'headwear' => 'hat',
    'garment' => 'apparel', 'garments' => 'apparel', 'clothing' => 'apparel', 'clothes' => 'apparel', 'uniform' => 'apparel', 'uniforms' => 'apparel', 'merch' => 'apparel', 'workwear' => 'apparel',
    'embroidered' => 'embroidery', 'stitching' => 'embroidery', 'cards' => 'card', 'businesscard' => 'card', 'banners' => 'banner', 'retractable' => 'rollup', 'signs' => 'sign', 'signage' => 'sign',
    'vans' => 'van', 'sprinter' => 'van', 'transit' => 'van', 'promaster' => 'van', 'trucks' => 'truck', 'cars' => 'car', 'sedan' => 'car', 'vehicles' => 'vehicle', 'auto' => 'vehicle', 'automobile' => 'vehicle',
    'wrapping' => 'wrap', 'wrapped' => 'wrap', 'wraps' => 'wrap', 'telephone' => 'phone', 'call' => 'phone', 'number' => 'phone', 'cell' => 'phone', 'mail' => 'email', 'e-mail' => 'email', 'days' => 'day',
    'files' => 'file', 'artwork' => 'file', 'artworks' => 'file', 'designs' => 'design', 'designer' => 'design', 'designers' => 'design', 'designing' => 'design', 'warranties' => 'warranty', 'guarantee' => 'warranty', 'guaranteed' => 'warranty',
    'wallpapers' => 'wallpaper', 'mural' => 'wallpaper', 'murals' => 'wallpaper', 'wall' => 'wallpaper', 'walls' => 'wallpaper', 'detail' => 'detailing', 'coating' => 'ceramic', 'coatings' => 'ceramic',
    'shipping' => 'ship', 'shipped' => 'ship', 'deliver' => 'ship', 'delivery' => 'ship', 'courier' => 'ship', 'pay' => 'payment', 'paying' => 'payment', 'payments' => 'payment', 'paid' => 'payment',
    'refunds' => 'refund', 'return' => 'refund', 'returns' => 'refund', 'exchange' => 'refund', 'cancellation' => 'cancel', 'cancelled' => 'cancel', 'canceled' => 'cancel', 'invoices' => 'invoice', 'bill' => 'invoice',
    'deposits' => 'deposit', 'downpayment' => 'deposit', 'labels' => 'label', 'logos' => 'logo', 'resolution' => 'dpi', 'ppi' => 'dpi', 'pixels' => 'dpi', 'proofs' => 'proof', 'mockup' => 'proof',
    'installation' => 'install', 'installing' => 'install', 'installed' => 'install', 'installer' => 'install', 'apply' => 'install', 'removal' => 'remove', 'removing' => 'remove', 'removed' => 'remove',
    'ruin' => 'damage', 'ruins' => 'damage', 'ruined' => 'damage', 'harm' => 'damage', 'hurt' => 'damage', 'hurts' => 'damage', 'formats' => 'format', 'filetype' => 'format', 'lasts' => 'lifespan', 'durable' => 'lifespan', 'durability' => 'lifespan', 'life' => 'lifespan', 'lifetime' => 'lifespan', 'damaged' => 'damage', 'scratch' => 'chip', 'scratches' => 'chip', 'chips' => 'chip',
    'washing' => 'wash', 'carwash' => 'wash', 'law' => 'legal', 'laws' => 'legal', 'illegal' => 'legal', 'allowed' => 'legal', 'darkness' => 'dark', 'darker' => 'dark', 'vlt' => 'dark',
    'windows' => 'window', 'glass' => 'window', 'storefront' => 'window', 'websites' => 'website', 'site' => 'website', 'web' => 'website', 'webpage' => 'website', 'instagram' => 'social', 'tiktok' => 'social',
    'videos' => 'video', 'videography' => 'video', 'templates' => 'template', 'fleets' => 'fleet', 'min' => 'minimum', 'moq' => 'minimum', 'sizes' => 'size', 'sizing' => 'size', 'samples' => 'sample',
    'urgent' => 'rush', 'asap' => 'rush', 'express' => 'rush', 'coupon' => 'discount', 'coupons' => 'discount', 'promo' => 'discount', 'discounts' => 'discount', 'taxes' => 'tax', 'hst' => 'tax',
    'etransfer' => 'etransfer', 'interac' => 'etransfer', 'visa' => 'creditcard', 'mastercard' => 'creditcard', 'amex' => 'creditcard', 'debit' => 'creditcard', 'check' => 'cheque',
    'flyers' => 'flyer', 'leaflet' => 'flyer', 'leaflets' => 'flyer', 'brochures' => 'brochure', 'postcards' => 'postcard', 'flags' => 'flag', 'decor' => 'wallpaper', 'tracking' => 'track', 'status' => 'track',
    'login' => 'login', 'signin' => 'login', 'password' => 'login', 'register' => 'login', 'account' => 'login', 'accounts' => 'login', 'orders' => 'order', 'ordering' => 'order', 'ordered' => 'order',
    // Finglish (Persian typed in Latin letters)
    'gheymat' => 'price', 'qeymat' => 'price', 'ghimat' => 'price', 'gheimat' => 'price', 'hazine' => 'price', 'chande' => 'price', 'chanda' => 'price', 'addres' => 'location', 'adres' => 'location', 'koja' => 'location',
    'saat' => 'hours', 'kart' => 'card', 'chap' => 'print', 'tarahi' => 'design', 'mashin' => 'vehicle', 'khodro' => 'vehicle', 'rang' => 'colour', 'ersal' => 'ship', 'nasb' => 'install', 'lebas' => 'apparel', 'doodi' => 'tint', 'dudi' => 'tint', 'shishe' => 'window',
    // Persian → canonical (normalized: Arabic ي/ك → Persian, ZWNJ removed)
    'قیمت' => 'price', 'قیمتش' => 'price', 'قیمتها' => 'price', 'هزینه' => 'price', 'هزینش' => 'price', 'نرخ' => 'price', 'چند' => 'price', 'چنده' => 'price', 'چقدر' => 'price', 'چقد' => 'price', 'تومن' => 'price', 'دلار' => 'price', 'گران' => 'price', 'ارزان' => 'price', 'استعلام' => 'price',
    'آدرس' => 'location', 'ادرس' => 'location', 'کجا' => 'location', 'کجاست' => 'location', 'کجایید' => 'location', 'کجاس' => 'location', 'نشانی' => 'location', 'لوکیشن' => 'location', 'مکان' => 'location',
    'ساعت' => 'hours', 'ساعات' => 'hours', 'باز' => 'hours', 'بازید' => 'hours', 'تعطیل' => 'hours', 'تعطیلید' => 'hours', 'یکشنبه' => 'sunday', 'شنبه' => 'saturday', 'تلفن' => 'phone', 'شماره' => 'phone', 'تماس' => 'phone', 'زنگ' => 'phone', 'ایمیل' => 'email',
    'رپ' => 'wrap', 'راپ' => 'wrap', 'کاور' => 'wrap', 'روکش' => 'wrap', 'برچسب' => 'decal', 'استیکر' => 'sticker', 'لترینگ' => 'decal', 'دودی' => 'tint', 'تینت' => 'tint', 'شیشه' => 'window', 'پنجره' => 'window', 'ویترین' => 'window',
    'پیپیاف' => 'ppf', 'محافظ' => 'ppf', 'سرامیک' => 'ceramic', 'سرامیکی' => 'ceramic', 'دیتیلینگ' => 'detailing', 'دیتیل' => 'detailing', 'پولیش' => 'correction', 'شستشو' => 'wash', 'شستن' => 'wash', 'کارواش' => 'wash',
    'چاپ' => 'print', 'پرینت' => 'print', 'لباس' => 'apparel', 'پوشاک' => 'apparel', 'یونیفرم' => 'apparel', 'تیشرت' => 'shirt', 'پیراهن' => 'shirt', 'هودی' => 'hoodie', 'سویشرت' => 'hoodie', 'کلاه' => 'hat', 'گلدوزی' => 'embroidery',
    'کاغذدیواری' => 'wallpaper', 'والپیپر' => 'wallpaper', 'دیوار' => 'wallpaper', 'طراحی' => 'design', 'طرح' => 'design', 'طراح' => 'design', 'دیزاین' => 'design', 'گارانتی' => 'warranty', 'ضمانت' => 'warranty', 'وارانتی' => 'warranty',
    'کارت' => 'card', 'ویزیت' => 'card', 'بنر' => 'banner', 'تابلو' => 'sign', 'ماشین' => 'vehicle', 'خودرو' => 'vehicle', 'اتومبیل' => 'vehicle', 'ون' => 'van', 'کامیون' => 'truck', 'تراک' => 'truck', 'رنگ' => 'colour',
    'ارسال' => 'ship', 'پست' => 'ship', 'تحویل' => 'ship', 'پرداخت' => 'payment', 'اینترک' => 'etransfer', 'فایل' => 'file', 'لوگو' => 'logo', 'لیبل' => 'label', 'سایز' => 'size', 'اندازه' => 'size',
    'مرجوع' => 'refund', 'بازپرداخت' => 'refund', 'برگشت' => 'refund', 'لغو' => 'cancel', 'کنسل' => 'cancel', 'نصب' => 'install', 'سایت' => 'website', 'وبسایت' => 'website', 'حساب' => 'login', 'اکانت' => 'login', 'رمز' => 'login', 'ورود' => 'login',
    'فاکتور' => 'invoice', 'صورتحساب' => 'invoice', 'بیعانه' => 'deposit', 'پیشپرداخت' => 'deposit', 'تخفیف' => 'discount', 'سفارش' => 'order', 'ناوگان' => 'fleet', 'حداقل' => 'minimum', 'نگهداری' => 'care',
    'تراکت' => 'flyer', 'فلایر' => 'flyer', 'بروشور' => 'brochure', 'نمونه' => 'sample', 'پروف' => 'proof', 'رزولوشن' => 'dpi', 'کیفیت' => 'dpi', 'دوام' => 'lifespan', 'عمر' => 'lifespan', 'خراب' => 'damage', 'آسیب' => 'damage',
    'قانونی' => 'legal', 'قانون' => 'legal', 'مجاز' => 'legal', 'تیره' => 'dark', 'تاریک' => 'dark', 'استودیو' => 'studio', 'پیگیری' => 'track', 'وضعیت' => 'track', 'فوری' => 'rush', 'عجله' => 'rush', 'مالیات' => 'tax',
    'پشت' => 'back', 'پشتی' => 'back', 'جلو' => 'front', 'جلوی' => 'front', 'کانادا' => 'canada', 'تورنتو' => 'toronto', 'وان' => 'vaughan', 'بیزینس' => 'business', 'فروشگاه' => 'shop', 'مغازه' => 'shop', 'لوازم' => 'materials', 'ویدیو' => 'video', 'ویدئو' => 'video', 'شبکه' => 'social', 'اینستاگرام' => 'social',
];

/** Persian/Arabic letter and digit normalization so different keyboards match (ي→ی, ك→ک, ۱→1, ZWNJ removed). */
function chat_norm(string $t): string {
    return strtr($t, ['ي' => 'ی', 'ى' => 'ی', 'ك' => 'ک', 'ة' => 'ه', 'ۀ' => 'ه', 'أ' => 'ا', 'إ' => 'ا', 'ؤ' => 'و', "\u{200C}" => '', "\u{200D}" => '', "\u{0640}" => '',
        '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9', '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        'ً' => '', 'ٌ' => '', 'ٍ' => '', 'َ' => '', 'ُ' => '', 'ِ' => '', 'ّ' => '', 'ْ' => '']);
}
/** Multi-word intents ("how much", "how long … take", "sign in", "چند روز") → one canonical word before splitting. */
function chat_phrases(string $t): string {
    $r = [
        '/\bpick[\s-]?up\s+trucks?\b/u' => ' truck ', '/\bcredit\s+cards?\b/u' => ' creditcard ', '/\bdebit\s+cards?\b/u' => ' creditcard ', '/\be[\s-]?transfer\b/u' => ' etransfer ',
        '/\bhow\s+long\b[^.?!]*\b(last|lasts|lifespan|durable|hold\s+up)\b/u' => ' lifespan ', '/\b(how\s+long|how\s+fast|how\s+soon|how\s+quick(ly)?|lead\s+time|turn[\s-]?around|when\s+(will|can|would)\s+[^.?!]*\b(ready|done|finished))\b/u' => ' turnaround ',
        '/\bhow\s+much\b(?!\s+(bleed|time|space|dpi|resolution|margin|room|ink|longer|notice|deposit))|\bwhat\s+(does|do|would)\s+[^.?!]*\bcost\b/u' => ' price ', '/\bsign(ed|ing)?[\s-]?(in|up)\b|\blog[\s-]?(in|on)\b|\bforgot\s+(my\s+)?password\b/u' => ' login ', '/\bpick(ing)?[\s-]?up\b|\bcollect\b/u' => ' pickup ',
        '/\bpaint\s+protection(\s+film)?\b|\bclear\s+bra\b/u' => ' ppf ', '/\bpaint\s+correction\b/u' => ' correction ', '/\bcolou?r[\s-]?change\b/u' => ' colourchange ', '/\bdesign\s+studio\b/u' => ' studio ', '/\bdie[\s-]?cut\b/u' => ' diecut ',
        '/\broll[\s-]?up\b/u' => ' rollup ', '/\ba[\s-]?frame\b/u' => ' aframe ', '/\bx[\s-]?frame\b/u' => ' xframe ', '/\byard\s+signs?\b|\blawn\s+signs?\b/u' => ' yardsign ', '/\bdoor\s+hangers?\b/u' => ' doorhanger ', '/\bt[\s-]shirts?\b/u' => ' shirt ',
        '/\bmoney\s+back\b/u' => ' refund ', '/\bfile\s+(types?|kinds?|extensions?)\b/u' => ' file format ', '/حساب\s*کاربری/u' => ' login ', '/\bdoor\s+jambs?\b/u' => ' jamb ', '/\bcar\s+wash(es)?\b/u' => ' wash ', '/\bpressure\s+wash(er|ing)?\b/u' => ' wash ',
        '/ای\s*ترنسفر|ای\s*ترانسفر|اینتراک/u' => ' etransfer ', '/(چند|چقدر|چه\s*مدت|چقد)\s*(روز|وقت|زمان|طول)|طول\s*می\s*کشه|طول\s*میکشه|کی\s*آماده|زمان\s*تحویل|زمان\s*آماده/u' => ' turnaround ', '/چند\s*سال|چقدر\s*دوام|چقدر\s*عمر/u' => ' lifespan ',
        '/کارت\s*ویزیت/u' => ' card ', '/پی\s*پی\s*اف/u' => ' ppf ', '/کاغذ\s*دیواری/u' => ' wallpaper ', '/تی\s*شرت/u' => ' shirt ', '/شیشه\s*دودی|دودی\s*کردن/u' => ' tint ', '/رنگ\s*عوض|تغییر\s*رنگ/u' => ' colourchange ',
    ];
    return (string)preg_replace(array_keys($r), array_values($r), $t);
}
function chat_stem(string $w): string {
    if (isset(CHAT_SYN[$w])) return CHAT_SYN[$w];
    if (!preg_match('/^[a-z]+$/', $w)) {
        if (preg_match('/^\p{Arabic}+$/u', $w) && mb_strlen($w) > 3) { // Persian plural / possessive endings
            foreach (['ش', 'ت', 'م', 'ه', 'ی'] as $suf) if (mb_substr($w, -1) === $suf && isset(CHAT_SYN[mb_substr($w, 0, -1)])) return CHAT_SYN[mb_substr($w, 0, -1)];
            foreach (['هایی', 'های', 'ها', 'تون', 'تان'] as $suf) if (mb_substr($w, -mb_strlen($suf)) === $suf && mb_strlen($w) - mb_strlen($suf) >= 2) { $b = mb_substr($w, 0, -mb_strlen($suf)); return CHAT_SYN[$b] ?? $b; }
        }
        return $w;
    }
    $n = strlen($w);
    if ($n > 4 && str_ends_with($w, 'ies')) $w = substr($w, 0, -3) . 'y';
    elseif ($n > 5 && str_ends_with($w, 'ing')) $w = substr($w, 0, -3);
    elseif ($n > 4 && preg_match('/(ss|x|ch|sh)es$/', $w)) $w = substr($w, 0, -2);
    elseif ($n > 3 && str_ends_with($w, 's') && !str_ends_with($w, 'ss') && !str_ends_with($w, 'us')) $w = substr($w, 0, -1);
    return CHAT_SYN[$w] ?? $w;
}
/** Lowercased, normalized, stemmed, stop-word-free terms (English, Persian and Finglish map to the same canonical words). */
function chat_terms(string $text): array {
    $text = chat_phrases(mb_strtolower(chat_norm(str_replace(['’', "'"], '', $text))));
    $out = [];
    foreach (preg_split('/[^\p{L}\p{N}]+/u', $text, -1, PREG_SPLIT_NO_EMPTY) as $w) {
        if (mb_strlen($w) < 2 && !preg_match('/\d/', $w)) continue;
        if (in_array($w, CHAT_STOP, true)) continue;
        $t = chat_stem($w);
        if ($t !== '' && !in_array($t, CHAT_STOP, true)) $out[] = $t;
    }
    return $out;
}
/** Typo tolerance: a query word the knowledge base doesn't know is replaced by the closest known word (1–2 letters off). */
function chat_fuzzy(array $q, array $vocab): array {
    $out = [];
    foreach ($q as $t) {
        if (isset($vocab[$t]) || !preg_match('/^[a-z]{5,20}$/', $t)) { $out[] = $t; continue; }
        $max = strlen($t) >= 7 ? 2 : 1; $best = null; $bd = 99;
        foreach ($vocab as $v => $_) {
            if (!is_string($v) || abs(strlen($v) - strlen($t)) > $max || !preg_match('/^[a-z]+$/', $v)) continue;
            $d = levenshtein($t, $v);
            if ($d < $bd || ($d === $bd && $best !== null && $v[0] === $t[0] && $best[0] !== $t[0])) { $bd = $d; $best = $v; }
        }
        $out[] = $best !== null && $bd <= $max ? $best : $t;
    }
    return $out;
}
function chat_clean_text(string $html): string {
    $html = preg_replace('#<(script|style|svg|noscript|template|nav|header|footer|form|select)\b.*?</\1>#is', ' ', $html);
    $html = preg_replace('#<(br|/p|/div|/li|/h[1-6]|/tr|/section|/article|/dt|/dd|/summary|/button|/label)\b[^>]*>#i', "$0\n", (string)$html);
    $t = html_entity_decode(strip_tags((string)$html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t = preg_replace('/[ \t\x{00A0}]+/u', ' ', $t);
    return trim((string)preg_replace('/\s*\n\s*/', "\n", (string)$t));
}

/* ---------------- page index ---------------- */
function chat_docroot(): string { return (string)(cfg('docroot') ?: (is_dir(dirname(__DIR__) . '/public_html/satin') ? dirname(__DIR__) . '/public_html' : dirname(__DIR__) . '/new.satingraphic.ca')); }

/** Re-reads every published page under /satin (English + Persian) and stores text chunks for search. */
function chat_rebuild_index(): array {
    $pdo = chat_db();
    $root = chat_docroot() . '/satin';
    if (!is_dir($root)) throw new RuntimeException('Website files were not found on the server.');
    @set_time_limit(120);
    $skip = '#^/satin/(fr|es)(/|$)|^/satin(/fa)?/(account|login|register|track|404|checkout)(/|$)#';
    $rows = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if ($f->getFilename() !== 'index.html') continue;
        $url = substr(str_replace('\\', '/', $f->getPath()), strlen(chat_docroot())) . '/';
        if (preg_match($skip, $url) || $f->getSize() > 3000000) continue;
        $html = (string)file_get_contents($f->getPathname());
        $title = preg_match('#<title>(.*?)</title>#is', $html, $m) ? trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8')) : $url;
        $title = trim((string)preg_replace('/\s*\|\s*Satin Graphic\s*$/u', '', $title));
        $desc = preg_match('#<meta\s+name="description"\s+content="([^"]*)"#i', $html, $m) ? html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '';
        $main = preg_match('#<main\b[^>]*>(.*)</main>#is', $html, $m) ? $m[1] : $html;
        $text = chat_clean_text($main);
        if ($desc !== '') $text = $desc . "\n" . $text;
        foreach (chat_chunks($text) as $i => $chunk) {
            if ($i >= 40) break;
            $terms = array_merge(chat_terms($title), chat_terms($title), chat_terms($chunk));
            if (count($terms) < 4) continue;
            $rows[] = [mb_substr($url, 0, 250), mb_substr($title, 0, 250), $chunk, ' ' . implode(' ', $terms) . ' ', count($terms)];
        }
    }
    $pdo->beginTransaction();
    $pdo->exec('DELETE FROM chat_pages');
    $ins = $pdo->prepare('INSERT INTO chat_pages (url,title,body,terms,len) VALUES (?,?,?,?,?)');
    foreach ($rows as $r) $ins->execute($r);
    $pdo->commit();
    $pages = count(array_unique(array_column($rows, 0)));
    $avg = $rows ? array_sum(array_column($rows, 4)) / count($rows) : 1;
    chat_setting_put('chat.index', ['builtAt' => now_iso(), 'pages' => $pages, 'chunks' => count($rows), 'avgLen' => $avg, 'v' => CHAT_TERMS_VERSION]);
    return ['pages' => $pages, 'chunks' => count($rows)];
}
function chat_chunks(string $text): array {
    $lines = preg_split('/\n+/', $text) ?: []; $out = []; $cur = '';
    foreach ($lines as $l) {
        $l = trim($l); if ($l === '') continue;
        if (mb_strlen($cur) + mb_strlen($l) > 700 && mb_strlen($cur) > 200) { $out[] = $cur; $cur = ''; }
        $cur .= ($cur === '' ? '' : ' ') . $l;
        while (mb_strlen($cur) > 1100) { $out[] = mb_substr($cur, 0, 900); $cur = mb_substr($cur, 900); }
    }
    if (trim($cur) !== '') $out[] = $cur;
    return $out;
}

/* ---------------- search ---------------- */
/** BM25 over the page index. Returns [['url','title','body','score','coverage'], …] best first, one per URL. */
function chat_search_pages(array $q, int $limit = 3, string $lang = 'en'): array {
    $pdo = chat_db();
    $q = array_values(array_unique($q));
    if (!$q) return [];
    $info = chat_setting_raw('chat.index');
    if (!is_array($info) || (int)($info['v'] ?? 1) < CHAT_TERMS_VERSION) { try { chat_rebuild_index(); $info = chat_setting_raw('chat.index'); } catch (Throwable $e) { if (!is_array($info)) return []; } }
    $N = max(1, (int)($info['chunks'] ?? 1)); $avg = max(1.0, (float)($info['avgLen'] ?? 50));
    $q = array_slice($q, 0, 12);
    $idf = []; $where = []; $params = [];
    foreach ($q as $t) {
        $c = $pdo->prepare('SELECT COUNT(*) n FROM chat_pages WHERE terms LIKE ?'); $c->execute(['% ' . $t . ' %']);
        $df = (int)$c->fetch()['n'];
        if ($df === 0) { $idf[$t] = 0.0; $GLOBALS['chat_unknown_terms'][] = $t; continue; }
        $idf[$t] = log(1 + ($N - $df + 0.5) / ($df + 0.5));
        $where[] = 'terms LIKE ?'; $params[] = '% ' . $t . ' %';
    }
    // words the site never uses (e.g. "pizza") count as fully missing, at the weight of the rarest word
    $total = array_sum(array_map(fn($t) => $idf[$t] > 0 ? $idf[$t] : log(1 + $N), $q));
    if (!$where) return [];
    $s = $pdo->prepare('SELECT id,url,title,body,terms,len FROM chat_pages WHERE ' . implode(' OR ', $where) . ' LIMIT 1500'); $s->execute($params);
    $best = [];
    foreach ($s->fetchAll() as $r) {
        $tf = array_count_values(explode(' ', trim($r['terms'])));
        $score = 0.0; $matched = 0.0;
        foreach ($q as $t) {
            if (empty($tf[$t]) || $idf[$t] <= 0) continue;
            $f = $tf[$t]; $score += $idf[$t] * ($f * 2.2) / ($f + 1.2 * (0.25 + 0.75 * (int)$r['len'] / $avg)); $matched += $idf[$t];
        }
        $cov = $total > 0 ? $matched / $total : 0;
        $score *= (0.4 + $cov);
        if (str_contains($r['url'], '/portfolio/projects/') || str_contains($r['url'], '/products/')) $score *= 0.7;
        if (str_starts_with($r['url'], '/satin/fa/') !== ($lang === 'fa')) $score *= 0.6;
        $u = $r['url'];
        if (!isset($best[$u]) || $best[$u]['score'] < $score) $best[$u] = ['url' => $u, 'title' => $r['title'], 'body' => $r['body'], 'score' => $score, 'coverage' => $cov];
    }
    usort($best, fn($a, $b) => $b['score'] <=> $a['score']);
    return array_slice(array_values($best), 0, $limit);
}

/** Scores the admin Q&A list. Returns best matches with coverage of the question's terms. */
/** Term statistics of the enabled Q&A entries (once per request). */
function chat_kb_docs(bool $fresh = false): array {
    static $c = null;
    if ($c !== null && !$fresh) return $c;
    $rows = chat_db()->query('SELECT * FROM chat_kb WHERE enabled = 1')->fetchAll();
    $docs = []; $df = [];
    foreach ($rows as $r) {
        $head = array_merge(chat_terms($r['question']), chat_terms($r['keywords']));
        $all = array_merge($head, $head, chat_terms($r['answer']), chat_terms((string)($r['answer_fa'] ?? '')));
        $docs[] = ['row' => $r, 'tf' => array_count_values($all), 'head' => array_flip($head), 'len' => count($all)];
        foreach (array_unique($all) as $t) $df[$t] = ($df[$t] ?? 0) + 1;
    }
    return $c = ['docs' => $docs, 'df' => $df];
}
function chat_search_kb(array $q, int $limit = 3): array {
    ['docs' => $docs, 'df' => $df] = chat_kb_docs();
    $q = array_values(array_unique($q)); if (!$q || !$docs) return [];
    $N = count($docs); $avg = array_sum(array_column($docs, 'len')) / max(1, $N);
    $out = [];
    foreach ($docs as $d) {
        $score = 0.0; $hit = 0; $headHit = 0; $headIdf = 0.0;
        foreach ($q as $t) {
            if (empty($d['tf'][$t])) continue;
            $idf = log(1 + ($N - $df[$t] + 0.5) / ($df[$t] + 0.5));
            $f = $d['tf'][$t]; $score += $idf * ($f * 2.2) / ($f + 1.2 * (0.25 + 0.75 * $d['len'] / $avg));
            $hit++; if (isset($d['head'][$t])) { $headHit++; $headIdf += $idf; }
        }
        if (!$hit) continue;
        $cov = $hit / count($q);
        $out[] = ['row' => $d['row'], 'score' => $score * (0.5 + $cov) + $headIdf * 1.5, 'coverage' => $cov, 'headHits' => $headHit];
    }
    usort($out, fn($a, $b) => $b['score'] <=> $a['score']);
    return array_slice($out, 0, $limit);
}

/** The one or two sentences of a chunk that best match the question. */
function chat_snippet(string $body, array $q, int $max = 320): string {
    $sent = preg_split('/(?<=[.!?؟])\s+/u', $body) ?: [$body];
    $qs = array_flip($q); $best = -1; $bi = 0;
    foreach ($sent as $i => $s) {
        $sc = 0; foreach (array_unique(chat_terms($s)) as $t) if (isset($qs[$t])) $sc++;
        if ($sc > $best) { $best = $sc; $bi = $i; }
    }
    $out = trim($sent[$bi]);
    if (isset($sent[$bi + 1]) && mb_strlen($out) < 160) $out .= ' ' . trim($sent[$bi + 1]);
    return mb_strlen($out) > $max ? rtrim(mb_substr($out, 0, $max - 1)) . '…' : $out;
}

function chat_link(string $url, string $title): array { return ['url' => $url, 'title' => mb_substr($title, 0, 80)]; }
function chat_safe_url(string $u): string { $u = trim($u); return preg_match('#^(/[^\s"<>]*|https://[^\s"<>]+)$#', $u) && strlen($u) < 400 ? $u : ''; }

/**
 * Answers a visitor question. Returns ['text', 'links' => [[url,title]], 'source' => kb|pages|ai|smalltalk|none, 'offerHuman' => bool].
 * AI is used only when enabled with a saved key; any AI failure falls back to the keyword engine.
 */
function chat_answer(string $question, array $conv, ?array $history = null): array {
    $s = chat_settings();
    $first = trim(explode(' ', trim((string)($conv['name'] ?? '')))[0] ?? '');
    $fa = ($conv['lang'] ?? 'en') === 'fa' || preg_match('/\p{Arabic}/u', $question);
    $plain = mb_strtolower(trim(preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', chat_norm($question))));
    $plain = trim((string)preg_replace('/\s+/u', ' ', $plain));
    if (preg_match('/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|salam|salaam|سلام|درود|وقت بخیر|سلام وقت بخیر|سلام خسته نباشید)( there| satin| guys)?$/u', $plain))
        return ['text' => $fa ? 'سلام' . ($first ? " $first" : '') . '! چطور می‌توانم کمک کنم؟ دربارهٔ رپ خودرو، PPF، شیشه دودی، چاپ، پوشاک یا هر خدمت دیگری بپرسید.' : 'Hi' . ($first ? " $first" : '') . '! What can I help you with — a wrap, PPF, window tint, printing, apparel or something else?', 'links' => [], 'source' => 'smalltalk', 'offerHuman' => false];
    if (preg_match('/^(thanks?|thank you|thx|ty|merci|mamnoon|mamnun|mersi|ممنون|مرسی|متشکرم|سپاس|ممنونم|خیلی ممنون|دستت درد نکنه)( (so|very) much)?( you)?$/u', $plain))
        return ['text' => $fa ? 'خواهش می‌کنم! سؤال دیگری هم دارید؟' : 'You’re welcome! Anything else I can help with?', 'links' => [], 'source' => 'smalltalk', 'offerHuman' => false];
    if (preg_match('/\b(human|real person|a person|someone|agent|representative|staff|talk to (you|someone|a)|speak (to|with)|call me)\b|اپراتور|همکار|پشتیبان|آدم واقعی|با یک نفر|صحبت کنم/u', $plain))
        return ['text' => $fa ? 'حتماً — روی «صحبت با همکاران» بزنید تا یکی از همکاران ما وارد همین گفتگو شود.' : 'Of course — tap “Talk to a person” below and someone from our team will join this chat.', 'links' => [], 'source' => 'smalltalk', 'offerHuman' => true];

    $q = chat_fuzzy(chat_terms($question), chat_kb_docs()['df']);
    $GLOBALS['chat_unknown_terms'] = [];
    $kb = chat_search_kb($q, 3);
    $pages = chat_search_pages($q, 4, $fa ? 'fa' : 'en');

    if ($s['aiEnabled'] && $s['aiKey'] !== '') {
        try { return chat_ai_answer($question, $conv, $s, $kb, $pages, $history); }
        catch (Throwable $e) { error_log('satin chat ai: ' . $e->getMessage()); }
    }
    if (!$q) return ['text' => $fa ? 'کمی بیشتر توضیح می‌دهید؟ مثلاً: «رپ کامل ون چقدر است؟» یا «ساعت کاری شما؟»' : 'Could you tell me a bit more? For example: “How much is a van wrap?” or “What are your hours?”', 'links' => [], 'source' => 'none', 'offerHuman' => true];

    $nq = count(array_unique($q));
    $top = $kb[0] ?? null;
    $kbOk = $top && ($top['coverage'] >= ($nq <= 2 ? 0.5 : 0.45)) && $top['headHits'] > 0 && $top['score'] >= 1.2;
    // a short question with a word the whole site never uses ("boat", "pizza") is probably not covered — offer a person instead of guessing
    $unknown = array_filter(array_diff(array_unique((array)($GLOBALS['chat_unknown_terms'] ?? [])), array_keys(chat_kb_docs()['df'])), fn($w) => !preg_match('/\p{Arabic}/u', (string)$w));
    if ($unknown && $nq <= 3 && $top && $top['coverage'] < 1) $kbOk = false;
    $pageLinks = [];
    foreach ($pages as $p) if ($p['coverage'] >= 0.5 && str_starts_with($p['url'], '/satin/fa/') === (bool)$fa) $pageLinks[] = chat_link($p['url'], $p['title']);
    // a page that covers clearly more of the question beats a loosely matching Q&A entry
    if ($kbOk && isset($pages[0]) && $nq >= 2 && $top['coverage'] < 0.6 && $pages[0]['coverage'] >= 0.9) $kbOk = false;
    if ($kbOk) {
        $links = [];
        if (($u = chat_safe_url((string)$top['row']['url'])) !== '') { if ($fa && str_starts_with($u, '/satin/') && is_dir(chat_docroot() . '/satin/fa/' . substr($u, 7))) $u = '/satin/fa/' . substr($u, 7); $links[] = chat_link($u, chat_kb_link_title($u)); }
        foreach ($pageLinks as $l) if (count($links) < 3 && !in_array($l['url'], array_column($links, 'url'), true)) $links[] = $l;
        $text = $fa && trim((string)($top['row']['answer_fa'] ?? '')) !== '' ? (string)$top['row']['answer_fa'] : (string)$top['row']['answer'];
        return ['text' => chat_fill($text, $s), 'links' => $links, 'source' => 'kb', 'offerHuman' => false];
    }
    $p = $pages[0] ?? null;
    if ($p && $p['coverage'] >= ($nq <= 2 ? 0.5 : 0.6) && !($unknown && $nq <= 3)) {
        return ['text' => ($fa ? 'این را در سایت ما پیدا کردم: «' : 'Here’s what our website says: “') . chat_snippet($p['body'], $q) . ($fa ? '»' : '”'), 'links' => array_slice($pageLinks, 0, 3), 'source' => 'pages', 'offerHuman' => false];
    }
    return ['text' => $fa ? 'برای این سؤال مطمئن نیستم. همکاران ما می‌توانند پاسخ دهند — روی «صحبت با همکاران» بزنید یا با ‎(905) 962-6222 تماس بگیرید / به info@satingraphic.ca ایمیل بزنید.' : 'I’m not sure about that one. Our team can answer it — tap “Talk to a person”, or call (905) 962-6222 / email info@satingraphic.ca.', 'links' => array_slice($pageLinks, 0, 2), 'source' => 'none', 'offerHuman' => true];
}
/** Live values inside Q&A answers: {hours} = office hours from Live chat → Settings. */
function chat_fill(string $text, ?array $s = null): string {
    return str_contains($text, '{hours}') ? str_replace('{hours}', chat_hours_text($s), $text) : $text;
}
function chat_kb_link_title(string $u): string {
    $q = chat_db()->prepare('SELECT title FROM chat_pages WHERE url = ? LIMIT 1'); $q->execute([$u]);
    $r = $q->fetch(); if ($r) return $r['title'];
    $seg = trim((string)parse_url($u, PHP_URL_PATH), '/'); $seg = substr($seg, strrpos('/' . $seg, '/'));
    return $seg === '' || $seg === 'satin' ? 'Satin Graphic' : ucwords(str_replace('-', ' ', $seg));
}

/* ---------------- optional AI (Anthropic Messages API) ---------------- */
function chat_ai_system(array $s): string {
    return "You are the website chat assistant for Satin Graphic (also known as Satin Auto Wrap), a vehicle wrap, paint protection film, window tint, print shop, apparel, window graphics and wallpaper business at 50 Viceroy Rd, Unit 22–23, Vaughan, Ontario, serving the Greater Toronto Area. Phone (905) 962-6222, email info@satingraphic.ca. Office hours (Toronto time): " . chat_hours_text($s) . ".\n\n"
        . "Rules:\n- Answer only questions about Satin Graphic, its services, products, prices, process and policies. Politely decline anything unrelated.\n"
        . "- Use only the facts in the SITE CONTEXT and the details above. Never invent or estimate prices, discounts, dates or guarantees that are not in the context; if a price is not in the context, say a team member will confirm it and suggest the quote form or the price estimator.\n"
        . "- Be concise: 1–4 short sentences, plain text, no markdown headings or tables. Answer in the visitor's language.\n"
        . "- If you are unsure, the question needs a firm quote, or the visitor is unhappy, offer to connect them with a person (they can tap “Talk to a person”).\n"
        . "- Never ask for payment details or passwords.";
}
function chat_ai_answer(string $question, array $conv, array $s, array $kb, array $pages, ?array $history): array {
    if (!function_exists('curl_init')) throw new RuntimeException('curl missing');
    $ctx = [];
    foreach ($kb as $k) if ($k['coverage'] > 0.2) $ctx[] = "Q: {$k['row']['question']}\nA: {$k['row']['answer']}";
    foreach ($pages as $p) $ctx[] = "Page: {$p['title']} ({$p['url']})\n" . mb_substr($p['body'], 0, 900);
    $msgs = [];
    foreach (array_slice($history ?? [], -10) as $m) {
        if ($m['sender'] === 'system') continue;
        $role = $m['sender'] === 'visitor' ? 'user' : 'assistant';
        $body = mb_substr((string)$m['body'], 0, 1500);
        if ($msgs && end($msgs)['role'] === $role) $msgs[count($msgs) - 1]['content'] .= "\n" . $body; else $msgs[] = ['role' => $role, 'content' => $body];
    }
    while ($msgs && $msgs[0]['role'] !== 'user') array_shift($msgs);
    if ($msgs && end($msgs)['role'] === 'user') array_pop($msgs); // re-added below with context
    $msgs[] = ['role' => 'user', 'content' => "SITE CONTEXT:\n" . ($ctx ? implode("\n\n---\n\n", $ctx) : '(no matching site content)') . "\n\nVISITOR (" . mb_substr((string)$conv['name'], 0, 60) . ") ASKS:\n" . $question];
    $payload = ['model' => $s['aiModel'], 'max_tokens' => 400, 'system' => chat_ai_system($s), 'messages' => $msgs];
    $ch = curl_init((string)cfg('chat_ai_endpoint', 'https://api.anthropic.com/v1/messages'));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['x-api-key: ' . $s['aiKey'], 'anthropic-version: 2023-06-01', 'content-type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if ($code !== 200 || !is_array($j)) throw new RuntimeException('AI HTTP ' . $code . ' ' . mb_substr((string)($j['error']['message'] ?? ''), 0, 200));
    $text = '';
    foreach (($j['content'] ?? []) as $c) if (($c['type'] ?? '') === 'text') $text .= (string)$c['text'];
    $text = trim($text);
    if ($text === '') throw new RuntimeException('AI empty reply');
    $links = [];
    foreach ($pages as $p) if ($p['coverage'] >= 0.5 && count($links) < 3) $links[] = chat_link($p['url'], $p['title']);
    $unsure = (bool)preg_match('/\b(not sure|team member|talk to a person|connect you)\b/i', $text);
    return ['text' => mb_substr($text, 0, 2000), 'links' => $links, 'source' => 'ai', 'offerHuman' => $unsure];
}
/** Admin "Test connection": one tiny request with the saved key. */
function chat_ai_test(array $s): array {
    if ($s['aiKey'] === '') return ['ok' => false, 'error' => 'Save an API key first.'];
    $ch = curl_init((string)cfg('chat_ai_endpoint', 'https://api.anthropic.com/v1/messages'));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['x-api-key: ' . $s['aiKey'], 'anthropic-version: 2023-06-01', 'content-type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['model' => $s['aiModel'], 'max_tokens' => 10, 'messages' => [['role' => 'user', 'content' => 'Reply with OK']]])]);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($raw === false) return ['ok' => false, 'error' => 'Could not reach Anthropic. ' . $err];
    $j = json_decode((string)$raw, true);
    if ($code === 200) return ['ok' => true, 'model' => (string)($j['model'] ?? $s['aiModel'])];
    return ['ok' => false, 'error' => 'Anthropic said: ' . mb_substr((string)($j['error']['message'] ?? "HTTP $code"), 0, 200)];
}

/* ---------------- conversations ---------------- */
function chat_conv_by_token(): ?array {
    $t = (string)($_SERVER[CHAT_HEADER] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{40,64}$/', $t)) return null;
    $q = chat_db()->prepare('SELECT * FROM chat_conversations WHERE token_hash = ?'); $q->execute([hash('sha256', $t)]);
    return $q->fetch() ?: null;
}
function chat_add(string $convId, string $sender, string $body, array $links = [], string $source = '', string $staff = '', array $files = []): array {
    $pdo = chat_db(); $now = now_iso();
    $files = array_values(array_map('chat_file_public', $files));
    $pdo->prepare('INSERT INTO chat_messages (conversation_id,sender,staff_name,body,links,source,created_at,files) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$convId, $sender, $staff, $body, json_encode(array_values($links), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $source, $now, $files ? json_encode($files, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null]);
    $id = (int)$pdo->lastInsertId();
    $prev = $body !== '' ? $body : ($files ? '📎 ' . $files[0]['name'] : '');
    if ($body !== '' && $files) $prev = '📎 ' . $body;
    $set = 'last_message_at = ?, updated_at = ?, last_preview = ?'; $p = [$now, $now, mb_substr((['staff' => 'You: ', 'bot' => 'Bot: '][$sender] ?? '') . $prev, 0, 160)];
    if ($sender === 'visitor') { $set .= ', unread_staff = unread_staff + 1, last_visitor_at = ?'; $p[] = $now; }
    if ($sender === 'staff') { $set .= ', last_staff_at = ?, unread_staff = 0'; $p[] = $now; }
    $p[] = $convId;
    $pdo->prepare("UPDATE chat_conversations SET $set WHERE id = ?")->execute($p);
    return ['id' => $id, 'sender' => $sender, 'staffName' => $staff, 'body' => $body, 'links' => $links, 'source' => $source, 'createdAt' => $now, 'files' => $files];
}
function chat_msg_row(array $m): array {
    return ['id' => (int)$m['id'], 'sender' => $m['sender'], 'staffName' => $m['staff_name'], 'body' => $m['body'], 'links' => json_decode((string)$m['links'], true) ?: [], 'source' => $m['source'], 'createdAt' => $m['created_at'],
        'files' => json_decode((string)($m['files'] ?? ''), true) ?: []];
}

/* ---------------- attachments (stored privately outside the web root, like commerce.php uploads) ---------------- */
const CHAT_FILE_TYPES = [ // detected type => [allowed extensions (first = default), shown inline?, thumbnail?]
    'image/png' => [['png'], true, true], 'image/jpeg' => [['jpg', 'jpeg'], true, true], 'image/webp' => [['webp'], true, true], 'image/gif' => [['gif'], true, true],
    'image/heic' => [['heic', 'heif'], false, false], 'application/pdf' => [['pdf', 'ai'], false, false], 'application/postscript' => [['eps', 'ai', 'ps'], false, false],
    'image/svg+xml' => [['svg'], false, false], 'application/zip' => [['zip'], false, false],
];
function chat_storage(): string {
    $base = (string)(cfg('storage_dir') ?: __DIR__ . '/storage');
    if (!is_dir($base)) @mkdir($base, 0750, true);
    if (!is_file($base . '/.htaccess')) @file_put_contents($base . '/.htaccess', "Require all denied\nDeny from all\n");
    if (!is_dir($base . '/chat')) @mkdir($base . '/chat', 0750, true);
    return $base;
}
/** File type from its first bytes (never from the name or the browser's claim). Null = not accepted. */
function chat_sniff(string $head): ?string {
    if (strncmp($head, "\x89PNG\r\n\x1a\n", 8) === 0) return 'image/png';
    if (strncmp($head, "\xFF\xD8\xFF", 3) === 0) return 'image/jpeg';
    if (substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') return 'image/webp';
    if (strncmp($head, 'GIF87a', 6) === 0 || strncmp($head, 'GIF89a', 6) === 0) return 'image/gif';
    if (substr($head, 4, 4) === 'ftyp' && in_array(substr($head, 8, 4), ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'], true)) return 'image/heic';
    if (strncmp($head, "PK\x03\x04", 4) === 0) return 'application/zip';                         // (before PDF: a zip may contain a PDF)
    if (strncmp($head, '%!PS-Adobe', 10) === 0 || strncmp($head, "\xC5\xD0\xD3\xC6", 4) === 0) return 'application/postscript'; // EPS / legacy AI
    if (strncmp($head, '%PDF-', 5) === 0 || (strpos(substr($head, 0, 1024), '%PDF-') !== false && !preg_match('/^(MZ|\x7FELF|#!|<\?php|<script|<html)/i', $head))) return 'application/pdf'; // PDF and PDF-compatible .ai
    $h = ltrim(substr($head, 0, 4096), "\xEF\xBB\xBF \t\r\n");
    if (preg_match('/^(?:<\?xml[^>]*>\s*)?(?:<!--.*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/is', $h)) return 'image/svg+xml';
    return null;
}
/** Safe download name: our own characters only, and an extension that matches the real content. */
function chat_file_name(string $name, string $mime): string {
    $name = preg_replace('/[^\p{L}\p{N}._ ()-]+/u', '_', mb_substr(trim(basename(str_replace('\\', '/', $name))), 0, 100));
    $name = trim((string)$name, ' ._') ?: 'file';
    $exts = CHAT_FILE_TYPES[$mime][0]; $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, $exts, true)) $name = ($ext !== '' ? pathinfo($name, PATHINFO_FILENAME) : $name) . '.' . $exts[0];
    return $name;
}
/** ZIP archives: refuse ones that carry programs or scripts (they are never opened on the server). */
function chat_zip_ok(string $path): bool {
    if (!class_exists('ZipArchive')) return true;
    $z = new ZipArchive(); if ($z->open($path) !== true) return false;
    $ok = $z->numFiles > 0 && $z->numFiles <= 2000;
    for ($i = 0; $ok && $i < $z->numFiles; $i++) {
        $n = strtolower((string)$z->getNameIndex($i));
        if (preg_match('/\.(exe|com|bat|cmd|scr|pif|msi|msp|dll|cpl|jar|js|jse|vbs|vbe|wsf|wsh|ps1|psm1|hta|lnk|reg|sh|app|apk|dmg|pkg|php\d?|phtml|py|pl|cgi|html?|svgz?|docm|xlsm|pptm)$/', $n)) $ok = false;
    }
    $z->close();
    return $ok;
}
/** Small JPEG preview (max 480 px) for raster images; '' when the image cannot be read. */
function chat_thumb(string $src, string $dst, string $mime): bool {
    if (!function_exists('imagecreatefromstring')) return false;
    $info = @getimagesize($src); if (!$info || $info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > 40000000) return false;
    // decoding needs ~5 bytes per pixel: skip the preview (the file is still attached) rather than run out of memory
    $lim = trim((string)ini_get('memory_limit')); $n = (float)$lim; $u = strtolower(substr($lim, -1));
    $bytes = $lim === '-1' ? PHP_INT_MAX : (int)($n * ($u === 'g' ? 1073741824 : ($u === 'm' ? 1048576 : ($u === 'k' ? 1024 : 1))));
    if ($info[0] * $info[1] * 5 + 16777216 > $bytes - memory_get_usage()) return false;
    $im = @imagecreatefromstring((string)file_get_contents($src)); if (!$im) return false;
    if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
        $o = (int)(@exif_read_data($src)['Orientation'] ?? 1);
        if (in_array($o, [3, 6, 8], true)) { $r = @imagerotate($im, [3 => 180, 6 => -90, 8 => 90][$o], 0); if ($r) { imagedestroy($im); $im = $r; } }
    }
    $w = imagesx($im); $h = imagesy($im); $k = min(1, 480 / max($w, $h)); $tw = max(1, (int)round($w * $k)); $th = max(1, (int)round($h * $k));
    $t = imagecreatetruecolor($tw, $th); imagefill($t, 0, 0, imagecolorallocate($t, 255, 255, 255));
    imagecopyresampled($t, $im, 0, 0, 0, 0, $tw, $th, $w, $h);
    $ok = imagejpeg($t, $dst, 78); imagedestroy($t); imagedestroy($im);
    return (bool)$ok;
}
function chat_upload_error(int $code): string {
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) return 'This file is too large. Files can be up to ' . (CHAT_FILE_MAX >> 20) . ' MB — email bigger files to info@satingraphic.ca.';
    if ($code === UPLOAD_ERR_NO_FILE) return 'Choose a file to send.';
    return 'The upload did not complete. Please try again.';
}
/** Validates an uploaded file ($_FILES entry) and stores it for a conversation. Returns the chat_files row. */
function chat_store_file($f, string $convId, string $sender): array {
    if (!is_array($f) || !isset($f['error']) || is_array($f['error'])) throw new InvalidArgumentException('Send one file at a time.');
    if ($f['error'] !== UPLOAD_ERR_OK) throw new InvalidArgumentException(chat_upload_error((int)$f['error']));
    $size = (int)$f['size'];
    if ($size < 8) throw new InvalidArgumentException('This file is empty.');
    if ($size > CHAT_FILE_MAX) throw new InvalidArgumentException(chat_upload_error(UPLOAD_ERR_INI_SIZE));
    if (!is_uploaded_file($f['tmp_name'])) throw new InvalidArgumentException('Upload failed.');
    $fh = fopen($f['tmp_name'], 'rb'); $head = (string)fread($fh, 8192); fclose($fh);
    $mime = chat_sniff($head);
    if (!$mime) throw new InvalidArgumentException('This file type can’t be sent here. Send images (JPG, PNG, WebP, GIF, HEIC), PDF, AI, EPS, SVG or ZIP.');
    if ($mime === 'application/zip' && !chat_zip_ok($f['tmp_name'])) throw new InvalidArgumentException('This ZIP contains program or script files, so it can’t be sent. Zip only your artwork files.');
    $w = 0; $h = 0;
    if (CHAT_FILE_TYPES[$mime][2]) { $i = @getimagesize($f['tmp_name']); if (!$i) throw new InvalidArgumentException('This image could not be read. Export it again and retry.'); [$w, $h] = $i; }
    $base = chat_storage(); $hex = bin2hex(random_bytes(16)); $path = 'chat/' . $hex;
    if (!move_uploaded_file($f['tmp_name'], $base . '/' . $path)) throw new RuntimeException('The file could not be saved. Please retry.');
    @chmod($base . '/' . $path, 0640);
    $thumb = '';
    if (CHAT_FILE_TYPES[$mime][2] && chat_thumb($base . '/' . $path, $base . '/' . $path . '_t', $mime)) { $thumb = $path . '_t'; @chmod($base . '/' . $thumb, 0640); }
    $row = ['id' => uuid(), 'conversation_id' => $convId, 'sender' => $sender, 'name' => chat_file_name((string)$f['name'], $mime), 'mime' => $mime, 'size' => $size, 'width' => (int)$w, 'height' => (int)$h, 'path' => $path, 'thumb' => $thumb, 'created_at' => now_iso()];
    chat_db()->prepare('INSERT INTO chat_files (id,conversation_id,sender,name,mime,size,width,height,path,thumb,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute(array_values($row));
    return $row;
}
function chat_file_public(array $r): array {
    if (isset($r['image'])) return $r; // already public
    return ['id' => $r['id'], 'name' => $r['name'], 'mime' => $r['mime'], 'size' => (int)$r['size'], 'width' => (int)$r['width'], 'height' => (int)$r['height'],
        'image' => CHAT_FILE_TYPES[$r['mime']][1] ?? false, 'thumb' => ($r['thumb'] ?? '') !== ''];
}
function chat_file(string $id): ?array { if (!preg_match('/^[a-f0-9-]{36}$/', $id)) return null; $q = chat_db()->prepare('SELECT * FROM chat_files WHERE id = ?'); $q->execute([$id]); return $q->fetch() ?: null; }
/** Streams a stored attachment. Raster images may display inline; everything else is a download. Never executable. */
function chat_file_out(array $r, bool $thumb): void {
    $rel = $thumb && $r['thumb'] !== '' ? $r['thumb'] : $r['path'];
    if (!preg_match('#^chat/[a-f0-9]{32}(_t)?$#', $rel)) json_out(['error' => 'File unavailable'], 404);
    $f = chat_storage() . '/' . $rel;
    if (!is_file($f)) json_out(['error' => 'File unavailable'], 404);
    $inline = (CHAT_FILE_TYPES[$r['mime']][1] ?? false) || ($thumb && $r['thumb'] !== '');
    $type = $thumb && $r['thumb'] !== '' ? 'image/jpeg' : ($inline ? $r['mime'] : 'application/octet-stream');
    while (ob_get_level()) ob_end_clean();
    header('Content-Type: ' . $type);
    header('Content-Length: ' . filesize($f));
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    header('Cross-Origin-Resource-Policy: same-origin');
    header('Cache-Control: private, max-age=3600');
    header('X-Robots-Tag: noindex');
    $n = $r['name'];
    header('Content-Disposition: ' . ($inline && !isset($_GET['download']) ? 'inline' : 'attachment') . '; filename="' . preg_replace('/[^A-Za-z0-9._ ()-]/', '_', $n) . '"; filename*=UTF-8\'\'' . rawurlencode($n));
    readfile($f); exit;
}
/** Deletes a conversation's stored files (when the chat is deleted). */
function chat_delete_files(string $convId): void {
    $q = chat_db()->prepare('SELECT path, thumb FROM chat_files WHERE conversation_id = ?'); $q->execute([$convId]);
    $base = chat_storage();
    foreach ($q->fetchAll() as $r) foreach ([$r['path'], $r['thumb']] as $p) if ($p !== '' && preg_match('#^chat/[a-f0-9]{32}(_t)?$#', $p)) @unlink($base . '/' . $p);
    chat_db()->prepare('DELETE FROM chat_files WHERE conversation_id = ?')->execute([$convId]);
}
function chat_recent(string $iso, int $sec): bool { return $iso !== '' && ($t = strtotime($iso)) !== false && $t > time() - $sec; }
function chat_messages(string $convId, int $after = 0, int $limit = 500): array {
    $q = chat_db()->prepare('SELECT * FROM chat_messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT ' . (int)$limit); $q->execute([$convId, $after]);
    return array_map('chat_msg_row', $q->fetchAll());
}
function chat_conv(string $id): ?array { $q = chat_db()->prepare('SELECT * FROM chat_conversations WHERE id = ?'); $q->execute([$id]); return $q->fetch() ?: null; }
function chat_transcript(array $c): string {
    $tz = new DateTimeZone('America/Toronto'); $lines = [];
    foreach (chat_messages($c['id'], 0, 2000) as $m) {
        $who = ['visitor' => $c['name'], 'bot' => 'Assistant', 'staff' => $m['staffName'] ?: 'Staff', 'system' => '—'][$m['sender']] ?? $m['sender'];
        $at = (new DateTime($m['createdAt']))->setTimezone($tz)->format('M j, H:i');
        $lines[] = "[$at] $who: " . $m['body'] . ($m['files'] ? ' [attached: ' . implode(', ', array_map(fn($f) => $f['name'], $m['files'])) . ']' : '') . ($m['links'] ? ' (' . implode(', ', array_map(fn($l) => $l['url'], $m['links'])) . ')' : '');
    }
    return "Visitor: {$c['name']}\nEmail: {$c['email']}\nPhone: " . ($c['phone'] ?: '—') . "\nPage: {$c['page_url']}\nStarted: " . (new DateTime($c['created_at']))->setTimezone($tz)->format('Y-m-d H:i') . " (Toronto)\n\n" . implode("\n", $lines) . "\n";
}
function chat_mail(string $to, string $subject, string $body, string $replyTo = ''): bool {
    if ($to === '') return false;
    $o = ['fromName' => 'Satin Website'];
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL) && !preg_match('/[\r\n]/', $replyTo)) $o['replyTo'] = $replyTo;
    return mail_out($to, $subject, $body, null, $o);
}
/** Emails the owner the transcript once per handoff and tells the visitor we will reply by email. */
function chat_escalate(array $c, string $why): void {
    $pdo = chat_db();
    $q = $pdo->prepare("UPDATE chat_conversations SET emailed_at = ? WHERE id = ? AND emailed_at = ''"); $q->execute([now_iso(), $c['id']]);
    if (!$q->rowCount()) return; // already done (another request won the race)
    $s = chat_settings();
    chat_add($c['id'], 'system', $why === 'closed'
        ? "We’re closed right now (hours: " . chat_hours_text($s) . "). Your message is saved — we’ll reply by email to {$c['email']} as soon as we’re back."
        : "Sorry for the wait — our team is busy right now. Your message is saved and we’ll reply by email to {$c['email']} shortly. You can keep writing here too.");
    chat_mail(chat_notify_to($s), "Website chat: {$c['name']} is waiting for a reply",
        "A website visitor asked to talk to a person" . ($why === 'closed' ? ' outside office hours' : ' and nobody replied in ' . $s['waitMinutes'] . ' minutes') . ".\n"
        . "Reply in the admin: " . site_url() . "/admin/#/chat?id=" . $c['id'] . "\nor reply to this email to write to the visitor directly.\n\n" . chat_transcript(chat_conv($c['id']) ?? $c), $c['email']);
}
function chat_waiting_overdue(array $c, array $s): bool {
    return $c['mode'] === 'human' && $c['emailed_at'] === '' && $c['human_requested_at'] !== '' && $c['status'] === 'open'
        && ($c['last_staff_at'] === '' || $c['last_staff_at'] < $c['human_requested_at'])
        && strtotime($c['human_requested_at']) < time() - $s['waitMinutes'] * 60;
}
/** Runs at most once a minute on chat traffic: escalates handoffs nobody answered (visitor may have left the page). */
function chat_sweep(): void {
    $last = chat_setting_raw('chat.sweep');
    if (is_int($last) && $last > time() - 60) return;
    chat_setting_put('chat.sweep', time());
    $s = chat_settings();
    $q = chat_db()->prepare("SELECT * FROM chat_conversations WHERE mode = 'human' AND status = 'open' AND emailed_at = '' AND human_requested_at != '' AND human_requested_at < ? LIMIT 20");
    $q->execute([gmdate('Y-m-d\TH:i:s.v\Z', time() - $s['waitMinutes'] * 60)]);
    foreach ($q->fetchAll() as $c) if (chat_waiting_overdue($c, $s)) chat_escalate($c, 'timeout');
}

/* ---------------- public API ---------------- */
function chat_limit(string $key, int $max, int $window, string $msg = 'You’re sending messages too quickly. Please wait a moment.'): void {
    if (rate_limited($key, $max, $window)) json_out(['error' => $msg], 429);
    note_attempt($key);
}
function chat_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }
function chat_page($v): string { $p = is_string($v) ? $v : ''; $p = (string)parse_url($p, PHP_URL_PATH); return preg_match('#^/[A-Za-z0-9/_.%-]{0,250}$#', $p) ? $p : '/'; }
function chat_state(array $c, int $after): array {
    $c = chat_conv($c['id']) ?? $c;
    return ['messages' => chat_messages($c['id'], $after), 'status' => $c['status'], 'mode' => $c['mode'], 'waiting' => $c['mode'] === 'human' && ($c['last_staff_at'] === '' || $c['last_staff_at'] < $c['human_requested_at']) && $c['emailed_at'] === '', 'emailed' => $c['emailed_at'] !== '', 'name' => $c['name'],
        'staffTyping' => chat_recent((string)($c['staff_typing_at'] ?? ''), 7) ? (explode(' ', (string)($c['staff_typing_name'] ?? ''))[0] ?: 'Satin Graphic') : '', 'fileMax' => CHAT_FILE_MAX];
}
/** Staff devices get a push for visitor messages: at most one per chat every 2 minutes, unless the visitor asked for a person. */
function chat_push(array $c, string $text, bool $urgent = false): void {
    if (!$urgent && chat_recent((string)($c['pushed_at'] ?? ''), 120)) return;
    try {
        require_once __DIR__ . '/push.php';
        chat_db()->prepare('UPDATE chat_conversations SET pushed_at = ? WHERE id = ?')->execute([now_iso(), $c['id']]);
        push_event('chat', ($urgent ? '🙋 ' : '💬 ') . $c['name'] . ($urgent ? ' wants to talk to a person' : ''), $text, '/admin/chat-app/#c=' . $c['id'], 'chat-' . substr(str_replace('-', '', $c['id']), 0, 20));
    } catch (Throwable $e) { error_log('satin chat push: ' . $e->getMessage()); }
}

function chat_route(string $path, string $method): void {
    header('X-Robots-Tag: noindex');
    $r = substr($path, strlen('/api/chat'));
    $s = chat_settings();
    try { chat_sweep(); } catch (Throwable $e) { error_log('satin chat sweep: ' . $e->getMessage()); }

    if ($r === '/config' && $method === 'GET') {
        header('Cache-Control: no-store');
        json_out(['enabled' => $s['enabled'], 'welcome' => $s['welcome'], 'welcomeFa' => $s['welcomeFa'], 'whatsapp' => chat_wa_link($s['whatsapp']), 'openNow' => chat_open_now($s),
            'staffOnline' => chat_staff_online(), 'hours' => chat_hours_text($s), 'maxLength' => CHAT_MAX_MESSAGE, 'fileMax' => CHAT_FILE_MAX]);
    }
    if (!$s['enabled']) json_out(['error' => 'Chat is not available right now. Call (905) 962-6222 or email info@satingraphic.ca.'], 503);

    if ($r === '/start' && $method === 'POST') {
        same_origin();
        $v = body_json(4000);
        if (!empty($v['website'])) json_out(['error' => 'Invalid request'], 400); // honeypot
        $name = text($v['name'] ?? '', 80); $email = strtolower(text($v['email'] ?? '', 254)); $phone = text($v['phone'] ?? '', 40);
        if (mb_strlen($name) < 2 || preg_match('/[<>{}\r\n]/', $name)) json_out(['error' => 'Please enter your name.', 'field' => 'name'], 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Please enter a valid email address.', 'field' => 'email'], 400);
        if ($phone !== '' && (!preg_match('/^[+()\d\s.\-]{7,25}$/', $phone) || strlen(preg_replace('/\D/', '', $phone)) < 7)) json_out(['error' => 'Please check the phone number (or leave it empty).', 'field' => 'phone'], 400);
        chat_limit('chatstart:' . chat_ip(), 6, 3600, 'Too many chats from this connection. Please call (905) 962-6222 or email info@satingraphic.ca.');
        $id = uuid(); $tok = token(); $now = now_iso(); $page = chat_page($v['page'] ?? '');
        $lang = ($v['lang'] ?? '') === 'fa' ? 'fa' : 'en';
        chat_db()->prepare('INSERT INTO chat_conversations (id,token_hash,name,email,phone,page_url,first_page,lang,status,mode,human_requested_at,emailed_at,unread_staff,last_visitor_at,last_staff_at,last_message_at,last_preview,ip,agent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$id, hash('sha256', $tok), $name, $email, $phone, $page, $page, $lang, 'open', 'bot', '', '', 0, '', '', $now, 'New chat', chat_ip(), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200), $now, $now]);
        $first = explode(' ', $name)[0];
        chat_add($id, 'bot', "Thanks, $first! What can I help you with? You can ask about services, prices on our site, turnaround or files — or tap “Talk to a person” anytime.", [], 'smalltalk');
        $_SERVER[CHAT_HEADER] = $tok;
        json_out(['token' => $tok] + chat_state(chat_conv($id), 0), 201);
    }

    $c = chat_conv_by_token();
    if (!$c) {
        if (rate_limited('chatbad:' . chat_ip(), 30, 600)) json_out(['error' => 'Too many requests.'], 429);
        note_attempt('chatbad:' . chat_ip());
        json_out(['error' => 'This chat has ended. Start a new chat.', 'expired' => true], 404);
    }

    if ($r === '/poll' && $method === 'GET') {
        if (chat_waiting_overdue($c, $s)) { chat_escalate($c, 'timeout'); }
        if (!chat_recent((string)($c['visitor_seen_at'] ?? ''), 15)) chat_db()->prepare('UPDATE chat_conversations SET visitor_seen_at = ? WHERE id = ?')->execute([now_iso(), $c['id']]);
        json_out(chat_state($c, max(0, (int)($_GET['after'] ?? 0))));
    }

    if ($r === '/send' && $method === 'POST') {
        same_origin();
        $v = body_json(8000);
        $raw = is_string($v['text'] ?? null) ? trim($v['text']) : '';
        if ($raw === '') json_out(['error' => 'Write a message first.'], 400);
        if (mb_strlen($raw) > CHAT_MAX_MESSAGE) json_out(['error' => 'Messages can be up to ' . CHAT_MAX_MESSAGE . ' characters.'], 400);
        $text = (string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $raw);
        chat_limit('chatmsg:' . $c['id'], 12, 60);
        chat_limit('chatmsgip:' . chat_ip(), 80, 3600);
        $after = max(0, (int)($v['after'] ?? 0));
        $pdo = chat_db();
        $pdo->prepare('UPDATE chat_conversations SET page_url = ?, status = ? WHERE id = ?')->execute([chat_page($v['page'] ?? $c['page_url']), 'open', $c['id']]);
        $history = chat_messages($c['id'], 0, 1000);
        chat_add($c['id'], 'visitor', $text);
        $c = chat_conv($c['id']);
        $offer = false;
        chat_db()->prepare("UPDATE chat_conversations SET visitor_seen_at = ?, visitor_typing_at = '' WHERE id = ?")->execute([now_iso(), $c['id']]);
        chat_push($c, $text, false);
        if ($c['mode'] === 'bot') {
            $a = chat_answer($text, $c, $history);
            chat_add($c['id'], 'bot', $a['text'], $a['links'], $a['source']);
            $offer = $a['offerHuman'];
        }
        json_out(chat_state($c, $after) + ['offerHuman' => $offer]);
    }

    if ($r === '/human' && $method === 'POST') {
        same_origin();
        $v = body_json(2000);
        chat_limit('chathuman:' . $c['id'], 5, 600);
        if ($c['mode'] === 'human' && $c['emailed_at'] === '' && $c['status'] === 'open') json_out(chat_state($c, max(0, (int)($v['after'] ?? 0))));
        $now = now_iso();
        chat_db()->prepare("UPDATE chat_conversations SET mode = 'human', status = 'open', human_requested_at = ?, emailed_at = '', unread_staff = unread_staff + 1 WHERE id = ?")->execute([$now, $c['id']]);
        $c = chat_conv($c['id']);
        chat_push($c, $c['last_preview'] ?: 'Asked to talk to a person', true);
        if (!chat_open_now($s)) chat_escalate($c, 'closed');
        else chat_add($c['id'], 'system', chat_staff_online()
            ? 'I’ve asked our team to join. Someone will reply here in a moment — please keep this window open.'
            : 'I’ve asked our team to join. If nobody is free within ' . $s['waitMinutes'] . ' minutes, we’ll reply by email to ' . $c['email'] . '.');
        json_out(chat_state($c, max(0, (int)($v['after'] ?? 0))));
    }

    if ($r === '/typing' && $method === 'POST') {
        same_origin();
        if (!chat_recent((string)($c['visitor_typing_at'] ?? ''), 3)) chat_db()->prepare('UPDATE chat_conversations SET visitor_typing_at = ?, visitor_seen_at = ? WHERE id = ?')->execute([now_iso(), now_iso(), $c['id']]);
        json_out(['ok' => true, 'staffTyping' => chat_state($c, PHP_INT_MAX)['staffTyping']]);
    }

    // attachments: multipart POST (field "file", optional "text" caption), token in the X-Chat-Token header
    if ($r === '/upload' && $method === 'POST') {
        same_origin();
        if (empty($_FILES['file'])) json_out(['error' => (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 ? chat_upload_error(UPLOAD_ERR_INI_SIZE) : 'Choose a file to send.'], 400);
        if ($c['status'] === 'closed') json_out(['error' => 'This chat has ended. Start a new chat.'], 409);
        chat_limit('chatfile:' . $c['id'], 10, 600, 'You’re sending files too quickly. Please wait a few minutes.');
        chat_limit('chatfileip:' . chat_ip(), 40, 3600, 'Too many files from this connection. Email them to info@satingraphic.ca instead.');
        $q = chat_db()->prepare("SELECT COUNT(*) n, COALESCE(SUM(size),0) b FROM chat_files WHERE conversation_id = ? AND sender = 'visitor'"); $q->execute([$c['id']]); $used = $q->fetch();
        if ((int)$used['n'] >= CHAT_FILES_PER_CHAT || (int)$used['b'] + (int)($_FILES['file']['size'] ?? 0) > CHAT_BYTES_PER_CHAT) json_out(['error' => 'This chat has reached its file limit. Email more files to info@satingraphic.ca.'], 400);
        $caption = is_string($_POST['text'] ?? null) ? mb_substr(trim((string)preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $_POST['text'])), 0, CHAT_MAX_MESSAGE) : '';
        try { $file = chat_store_file($_FILES['file'], $c['id'], 'visitor'); }
        catch (InvalidArgumentException $e) { json_out(['error' => $e->getMessage()], 400); }
        $after = max(0, (int)($_POST['after'] ?? 0));
        chat_db()->prepare("UPDATE chat_conversations SET status = 'open', visitor_seen_at = ?, visitor_typing_at = '' WHERE id = ?")->execute([now_iso(), $c['id']]);
        chat_add($c['id'], 'visitor', $caption, [], '', '', [$file]);
        $c = chat_conv($c['id']);
        chat_push($c, '📎 ' . $file['name'] . ($caption !== '' ? ' — ' . $caption : ''), false);
        if ($c['mode'] === 'bot') {
            $fa = $c['lang'] === 'fa';
            chat_add($c['id'], 'bot', $fa ? 'فایل شما دریافت شد و در همین گفتگو برای همکاران ما ذخیره شد. اگر می‌خواهید کسی آن را بررسی کند، روی «صحبت با همکاران» بزنید.'
                : 'Got it — your file is saved with this chat for our team. Tap “Talk to a person” if you’d like someone to look at it now.', [], 'smalltalk');
        }
        json_out(chat_state($c, $after) + ['offerHuman' => $c['mode'] === 'bot']);
    }
    if ($r === '/file' && $method === 'GET') {
        $f = chat_file((string)($_GET['id'] ?? ''));
        if (!$f || !hash_equals($f['conversation_id'], $c['id'])) json_out(['error' => 'File not found'], 404);
        chat_file_out($f, isset($_GET['thumb']));
    }

    if ($r === '/end' && $method === 'POST') {
        same_origin();
        chat_db()->prepare("UPDATE chat_conversations SET status = 'closed', updated_at = ? WHERE id = ?")->execute([now_iso(), $c['id']]);
        chat_add($c['id'], 'system', 'The visitor ended the chat.');
        json_out(['ok' => true]);
    }

    json_out(['error' => 'Not found'], 404);
}

/* ---------------- seed knowledge base (from the website's own content) ---------------- */
function chat_seed_kb(PDO $pdo): void {
    $now = now_iso(); $i = 0;
    $ins = $pdo->prepare('INSERT INTO chat_kb (id,question,answer,keywords,url,enabled,sort_order,created_at,updated_at,answer_fa) VALUES (?,?,?,?,?,1,?,?,?,?)');
    foreach (chat_seed_entries() as $e) $ins->execute([uuid(), $e[0], $e[1], $e[2], $e[3], ++$i, $now, $now, $e[4] ?? '']);
}
/** Questions shipped in the first knowledge base (v1). If one of these is missing now, the owner deleted it: never re-add it. */
const CHAT_KB_V1 = ['Where are you located?', 'What are your hours?', 'How can I contact you?', 'How do I get a quote?', 'How much does a vehicle wrap cost?', 'How accurate is the online wrap estimate?',
    'How long does a wrap take to install?', 'How long does a wrap last?', 'Will a wrap damage my paint?', 'Do you offer colour change wraps?', 'Do you do commercial and fleet wraps?', 'What is paint protection film (PPF)?',
    'PPF or ceramic coating?', 'Do you do window tint?', 'Do you offer auto detailing?', 'What printing do you offer?', 'How fast is printing?', 'Do you print custom apparel?', 'Do you do window graphics?',
    'Do you make custom wallpaper?', 'Do you offer design services?', 'What file format should I send?', 'What warranty do you offer?', 'How can I pay?', 'Do you ship or install outside Vaughan?', 'Do you build websites?', 'How do I look after my wrap?'];
/**
 * Merges new built-in Q&A into an existing knowledge base: adds entries the site does not have yet, refreshes built-in
 * entries the owner never edited (updated_at = created_at), and only fills the Persian answer of entries the owner changed.
 */
function chat_kb_upgrade(PDO $pdo): void {
    $norm = fn($q) => mb_strtolower(trim((string)preg_replace('/\s+/u', ' ', $q)));
    $have = []; foreach ($pdo->query('SELECT * FROM chat_kb')->fetchAll() as $r) $have[$norm($r['question'])] = $r;
    $v1 = array_flip(array_map($norm, CHAT_KB_V1));
    $max = (int)$pdo->query('SELECT COALESCE(MAX(sort_order),0) n FROM chat_kb')->fetch()['n'];
    $now = now_iso(); $added = 0;
    $pdo->beginTransaction();
    foreach (chat_seed_entries() as $e) {
        $k = $norm($e[0]); $fa = $e[4] ?? '';
        if (isset($have[$k])) {
            $r = $have[$k];
            if ($r['updated_at'] === $r['created_at']) $pdo->prepare('UPDATE chat_kb SET answer = ?, keywords = ?, url = ?, answer_fa = ?, updated_at = ?, created_at = ? WHERE id = ?')->execute([$e[1], $e[2], $e[3], $fa, $now, $now, $r['id']]);
            elseif (trim((string)($r['answer_fa'] ?? '')) === '' && $fa !== '' && $r['answer'] === $e[1]) $pdo->prepare('UPDATE chat_kb SET answer_fa = ? WHERE id = ?')->execute([$fa, $r['id']]);
            continue;
        }
        if (isset($v1[$k])) continue; // removed by the owner
        $pdo->prepare('INSERT INTO chat_kb (id,question,answer,keywords,url,enabled,sort_order,created_at,updated_at,answer_fa) VALUES (?,?,?,?,?,1,?,?,?,?)')->execute([uuid(), $e[0], $e[1], $e[2], $e[3], ++$max, $now, $now, $fa]);
        $added++;
    }
    $pdo->commit();
    chat_setting_put('chat.kb_version', CHAT_KB_VERSION);
    if ($added) error_log("satin chat: added $added built-in Q&A entries");
}
/**
 * Built-in knowledge base, written from the website's own pages (FAQ, Warranty, Orders/Shipping/Returns, Installation terms,
 * Artwork guidelines, product and service pages, estimator "from" prices) and the owner's turnaround times.
 * Each entry: [question, answer (English), keywords (English + Persian + common misspellings), link, answer (Persian)].
 * Owners edit these in Admin → Live chat → Knowledge base; "{hours}" is replaced by the office hours from chat settings.
 */
function chat_seed_entries(): array {
    return [
        /* ---------- contact, location, hours ---------- */
        ['Where are you located?', 'We’re at 50 Viceroy Rd, Unit 22–23, Vaughan, Ontario, serving Toronto and the GTA. Shop visits are by appointment so the right person is available — call (905) 962-6222 to book a time.', 'address location shop visit directions where vaughan map office آدرس کجا کجاست نشانی مغازه', '/satin/contact/',
            'آدرس ما: 50 Viceroy Rd, Unit 22–23, Vaughan, Ontario — به تورنتو و کل GTA خدمات می‌دهیم. مراجعه حضوری با وقت قبلی است تا فرد مناسب حاضر باشد؛ برای هماهنگی با ‎(905) 962-6222 تماس بگیرید.'],
        ['What are your hours?', 'Our hours (Toronto time): {hours}. Shop visits are by appointment.', 'hours open opening closed saturday sunday weekend time today holiday ساعت کاری باز تعطیل شنبه یکشنبه', '/satin/contact/',
            'ساعت کاری ما (به وقت تورنتو): {hours}. مراجعه حضوری با وقت قبلی است.'],
        ['How can I contact you?', 'Call (905) 962-6222 or email info@satingraphic.ca. Most quotes go out within one business day. You can also tap “Talk to a person” here, or send us files right in this chat.', 'phone email contact call number reach whatsapp تلفن ایمیل شماره تماس', '/satin/contact/',
            'با ‎(905) 962-6222 تماس بگیرید یا به info@satingraphic.ca ایمیل بزنید. بیشتر قیمت‌ها ظرف یک روز کاری ارسال می‌شوند. همین‌جا هم می‌توانید روی «صحبت با همکاران» بزنید یا فایل بفرستید.'],
        ['Can I visit the shop?', 'Yes — by appointment. Call (905) 962-6222 or email info@satingraphic.ca and we’ll book a time so the right person is there. You can also see paper stocks and film samples when you visit.', 'visit shop showroom appointment come in drop by walk in see samples حضوری مراجعه وقت قبلی', '/satin/contact/',
            'بله، با وقت قبلی. با ‎(905) 962-6222 تماس بگیرید یا ایمیل بزنید تا زمانی هماهنگ کنیم که فرد مناسب حاضر باشد. هنگام مراجعه می‌توانید نمونهٔ کاغذها و فیلم‌ها را هم ببینید.'],
        ['Which areas do you serve?', 'We’re in Vaughan and serve the whole Greater Toronto Area — Toronto, Mississauga, Brampton, Markham, Richmond Hill, Woodbridge, Concord, Maple, Thornhill, North York, Etobicoke, Newmarket, Aurora, King City and more. Print and apparel ship across Canada.', 'areas serve gta toronto mississauga brampton markham richmond hill woodbridge concord thornhill north york etobicoke newmarket aurora king city near me مناطق تورنتو', '/satin/vehicle-wraps/',
            'ما در Vaughan هستیم و به کل GTA خدمات می‌دهیم: تورنتو، میسیساگا، برامپتون، مارکهام، ریچموندهیل، وودبریج، تورنهیل، نورث‌یورک، اتوبیکوک، نیومارکت، اورورا و… . چاپ و پوشاک را به سراسر کانادا ارسال می‌کنیم.'],
        ['What services do you offer?', 'Vehicle wraps (commercial, colour change, lettering), paint protection film, window tint, auto detailing and ceramic coating, print shop (offset, large format, labels and stickers), custom apparel, window graphics, wallpaper, design services, websites, social media and videography.', 'services offer do what everything list خدمات چه کارهایی', '/satin/',
            'رپ خودرو (تجاری، تغییر رنگ، لترینگ)، فیلم محافظ رنگ PPF، شیشه دودی، دیتیلینگ و پوشش سرامیک، چاپ (افست، لارج‌فرمت، لیبل و استیکر)، چاپ روی لباس، گرافیک ویترین، کاغذدیواری، طراحی، طراحی سایت، شبکه‌های اجتماعی و ویدیو.'],
        ['How fast do you reply to quote requests?', 'Most quotes go out within one business day. For vehicles, photos of all four sides help us firm up the price without a visit.', 'reply response quote request how soon answer back wait جواب پاسخ', '/satin/contact/',
            'بیشتر استعلام‌ها ظرف یک روز کاری پاسخ داده می‌شوند. برای خودرو، عکس از هر چهار طرف کمک می‌کند بدون مراجعه قیمت دقیق بدهیم.'],

        /* ---------- quotes & prices ---------- */
        ['How do I get a quote?', 'Use the estimator or configurator on any product page, add items to the quote cart, or press “Get a quote” anywhere on the site. Tell us what you need and we reply within one business day with a firm price.', 'quote price request firm estimate استعلام قیمت', '/satin/contact/',
            'از ماشین‌حساب قیمت در صفحهٔ هر محصول استفاده کنید، آیتم‌ها را به سبد استعلام اضافه کنید یا در هر جای سایت «Get a quote» را بزنید. ظرف یک روز کاری قیمت قطعی را برایتان می‌فرستیم.'],
        ['How much does a vehicle wrap cost?', 'Full printed wraps start from $2,800 for a car, $3,400 SUV, $3,200 pickup, $3,600 minivan, $3,950 Transit-size van, $4,300 Sprinter, $4,200 ProMaster, $4,800 trailer, $5,800 box truck and $8,500 bus (before tax). The online estimator gives a starting price in under a minute; we confirm after seeing the vehicle.', 'wrap price cost how much full wrap van car truck suv minivan estimator قیمت رپ کامل ماشین', '/satin/vehicle-wraps/estimator/',
            'رپ کامل چاپی از حدود ۲٬۸۰۰ دلار برای سواری، ۳٬۴۰۰ SUV، ۳٬۲۰۰ پیکاپ، ۳٬۶۰۰ مینی‌ون، ۳٬۹۵۰ ون ترانزیت، ۴٬۳۰۰ اسپرینتر، ۴٬۸۰۰ تریلر، ۵٬۸۰۰ باکس‌تراک و ۸٬۵۰۰ اتوبوس شروع می‌شود (بدون مالیات). ماشین‌حساب آنلاین در کمتر از یک دقیقه قیمت تقریبی می‌دهد و پس از دیدن خودرو تأیید می‌کنیم.'],
        ['How much is a van wrap?', 'A full commercial wrap on a Transit-size van starts from $3,950 (high-roof Transit, roof not included), Sprinter from $4,300 and ProMaster from $4,200, before tax. Lettering and decals are about 22% of the full-wrap price, a partial wrap about 45% and a ¾ wrap about 70%.', 'van wrap price cost transit sprinter promaster cargo van commercial ون قیمت', '/satin/vehicle-wraps/estimator/transit-van/',
            'رپ کامل تجاری ون ترانزیت از ۳٬۹۵۰ دلار، اسپرینتر از ۴٬۳۰۰ و پرومستر از ۴٬۲۰۰ دلار شروع می‌شود (بدون مالیات). لترینگ و برچسب حدود ۲۲٪ قیمت رپ کامل، رپ جزئی حدود ۴۵٪ و رپ سه‌چهارم حدود ۷۰٪ است.'],
        ['How much do box truck, trailer or bus wraps cost?', 'Full wraps start from $5,800 for a box truck, $4,800 for an enclosed trailer and $8,500 for a bus (before tax). Box length, cab coverage and trailer length move the price — the estimator asks for them.', 'box truck trailer bus wrap price cost 53 foot cube کامیون تریلر اتوبوس قیمت', '/satin/vehicle-wraps/estimator/',
            'رپ کامل باکس‌تراک از ۵٬۸۰۰ دلار، تریلر بسته از ۴٬۸۰۰ و اتوبوس از ۸٬۵۰۰ دلار شروع می‌شود (بدون مالیات). طول باکس، پوشش کابین و طول تریلر روی قیمت اثر دارد.'],
        ['How much is vehicle lettering or decals?', 'Lettering and decals usually cost about 22% of a full printed wrap for the same vehicle (partial ≈ 45%, ¾ ≈ 70%). For reference, full wraps start at $2,800 for a car and $3,950 for a Transit-size van. Send a photo of the vehicle and your logo for an exact price.', 'lettering decal decals logo door partial half three quarter price cost truck van لترینگ برچسب لوگو قیمت', '/satin/vehicle-wraps/lettering/',
            'لترینگ و برچسب معمولاً حدود ۲۲٪ قیمت رپ کامل همان خودرو است (جزئی حدود ۴۵٪، سه‌چهارم حدود ۷۰٪). برای قیمت دقیق، عکس خودرو و لوگوی خود را بفرستید.'],
        ['How accurate is the online wrap estimate?', 'Usually within 10–15% of the final quote. Answer the vehicle questions (roof height, cab size, box length) as best you can — they drive the film count. Photos of all four sides help us firm it up without a visit.', 'estimator accurate estimate online photos exact final دقیق', '/satin/vehicle-wraps/estimator/',
            'معمولاً ۱۰ تا ۱۵ درصد با قیمت نهایی فاصله دارد. به سؤالات خودرو (ارتفاع سقف، کابین، طول باکس) تا حد ممکن دقیق جواب دهید. عکس از چهار طرف خودرو کمک می‌کند بدون مراجعه قیمت قطعی بدهیم.'],
        ['Does the wrap price include design?', 'Basic layout of supplied artwork is included. Fully custom design is a $250 deposit that comes off the wrap price when you go ahead.', 'wrap price include design layout artwork deposit 250 طراحی شامل', '/satin/vehicle-wraps/estimator/',
            'چیدمان ساده با فایل‌هایی که خودتان می‌دهید شامل قیمت است. طراحی کاملاً اختصاصی ۲۵۰ دلار بیعانه دارد که در صورت انجام رپ از قیمت کم می‌شود.'],
        ['Why does the finish change the price?', 'Matte, satin and especially chrome / colour-flip films cost more per metre and take longer to install cleanly. Gloss is the baseline.', 'finish matte satin gloss chrome colour flip price more expensive مات براق کروم', '/satin/vehicle-wraps/estimator/',
            'فیلم‌های مات، ساتن و به‌خصوص کروم و تغییررنگ (color-flip) گران‌ترند و نصب تمیزشان بیشتر طول می‌کشد. فیلم براق مبنای قیمت است.'],
        ['Can I get a firm quote without visiting?', 'Usually yes. Send photos of all four sides and a clear shot of any damage (you can attach them right here in the chat). For most vehicles that’s enough to firm up the number; we confirm on drop-off.', 'firm quote without visit photos pictures remote online عکس بدون مراجعه', '/satin/contact/',
            'معمولاً بله. عکس از هر چهار طرف و هر آسیب موجود را بفرستید (همین‌جا در چت می‌توانید پیوست کنید). برای بیشتر خودروها همین کافی است و هنگام تحویل تأیید می‌کنیم.'],
        ['Do you offer fleet discounts?', 'Yes — fleet pricing starts at three or more vehicles and includes a brand template so every new vehicle you add matches the last one exactly.', 'fleet discount multiple vehicles company trucks vans several ناوگان تخفیف چند ماشین', '/satin/vehicle-wraps/commercial/fleet-programs/',
            'بله — قیمت ناوگان از سه خودرو به بالا اعمال می‌شود و یک قالب برند دریافت می‌کنید تا هر خودروی جدید دقیقاً مثل بقیه باشد.'],
        ['Are prices before tax?', 'Yes. Prices on the site are in Canadian dollars before tax; Ontario HST (13%) is added at checkout or on your invoice.', 'tax hst before after cad canadian dollars currency مالیات دلار کانادا', '/satin/faq/',
            'بله. قیمت‌ها به دلار کانادا و بدون مالیات هستند؛ مالیات HST انتاریو (۱۳٪) هنگام پرداخت یا در فاکتور اضافه می‌شود.'],
        ['Do you have discount codes?', 'Enter a discount code in the “Discount code” box on the product page or in your cart. Apparel orders over 20 pieces get 5% off, and fleets of three or more vehicles get fleet pricing.', 'discount coupon promo code sale deal offer cheaper تخفیف کد', '/satin/shop/',
            'کد تخفیف را در قسمت «Discount code» صفحهٔ محصول یا سبد خرید وارد کنید. سفارش پوشاک بیش از ۲۰ عدد ۵٪ تخفیف دارد و ناوگان سه خودرو به بالا قیمت ویژه دارد.'],

        /* ---------- vehicle wraps ---------- */
        ['How long does a wrap take to install?', 'Sedans and SUVs are usually one day; vans and pickups one to two days; box trucks, trailers and buses two to three days depending on coverage.', 'how long install time off road day turnaround wrap ready truck van car shop keep vehicle نصب چند روز', '/satin/vehicle-wraps/',
            'سواری و SUV معمولاً یک روز، ون و پیکاپ یک تا دو روز، و باکس‌تراک، تریلر و اتوبوس بسته به پوشش دو تا سه روز.'],
        ['How long does a wrap last?', 'With cast film and laminate, expect 5–7 years on vertical panels in Ontario weather; hood and roof typically 3–5 years. Colour-change gloss films run 5–7 years, matte and satin 3–5, chrome and colour-flip 2–3 on horizontal surfaces — longer if garaged.', 'last lifespan durable years wrap durability winter دوام چند سال', '/satin/guides/wrap-lifespan-canadian-winter/',
            'با فیلم cast و لمینیت، روی سطوح عمودی ۵ تا ۷ سال در هوای انتاریو؛ کاپوت و سقف معمولاً ۳ تا ۵ سال. فیلم‌های تغییر رنگ براق ۵–۷ سال، مات و ساتن ۳–۵ و کروم ۲–۳ سال روی سطوح افقی دوام دارند؛ در پارکینگ سرپوشیده بیشتر.'],
        ['Will a wrap damage my paint?', 'No — on factory (OEM) paint the film removes cleanly and protects the finish underneath. Repainted or damaged panels can lift with the wrap; we flag that during the inspection before we quote.', 'damage paint remove removal safe oem آسیب رنگ', '/satin/faq/',
            'خیر — روی رنگ کارخانه (OEM) فیلم تمیز جدا می‌شود و از رنگ زیرین هم محافظت می‌کند. قطعات رنگ‌شده یا آسیب‌دیده ممکن است همراه رپ بلند شوند که پیش از قیمت‌دادن در بازدید اعلام می‌کنیم.'],
        ['Do you offer colour change wraps?', 'Yes — gloss, matte, satin, chrome and colour-flip films from brands like 3M, Avery Dennison and Arlon. Try colours on your type of vehicle in the Wrap Visualizer. Door jambs are not included by default but can be quoted.', 'colour change color matte satin gloss chrome finish brands 3m avery black white grey red blue green colours تغییر رنگ مشکی', '/satin/vehicle-wraps/color-change/',
            'بله — فیلم‌های براق، مات، ساتن، کروم و تغییررنگ از برندهایی مثل 3M، Avery Dennison و Arlon. رنگ‌ها را در Wrap Visualizer روی نوع خودروی خود امتحان کنید. داخل درها (door jamb) به‌طور پیش‌فرض شامل نیست ولی قابل استعلام است.'],
        ['Are door jambs included in a colour change?', 'Not by default. Most customers skip them; if you want a full match with the doors open, add jambs and we’ll quote the extra labour.', 'door jamb jambs inside doors colour change included', '/satin/vehicle-wraps/color-change/',
            'به‌طور پیش‌فرض خیر. بیشتر مشتریان انجامش نمی‌دهند؛ اگر می‌خواهید با در باز هم یکدست باشد، jamb را اضافه کنید تا هزینهٔ اضافه را اعلام کنیم.'],
        ['Can you match a specific paint colour?', 'We can get close with the standard film ranges, and printed colour-change film lets us hit an exact swatch when a close match isn’t enough.', 'match paint colour exact swatch custom colour code factory همرنگ', '/satin/vehicle-wraps/color-change/',
            'با رنگ‌های استاندارد فیلم می‌توانیم نزدیک شویم و با فیلم چاپی تغییر رنگ، دقیقاً همان نمونه‌رنگ را می‌سازیم.'],
        ['Does a colour-change wrap hurt resale value?', 'Usually the opposite — the film has been protecting the original paint, and it comes off cleanly on OEM finishes. Many owners remove it before sale to reveal a like-new finish.', 'resale value sell car lease return remove before selling فروش', '/satin/vehicle-wraps/color-change/',
            'معمولاً برعکس — فیلم از رنگ اصلی محافظت کرده و روی رنگ کارخانه تمیز جدا می‌شود. خیلی‌ها قبل از فروش آن را برمی‌دارند تا رنگ مثل نو دیده شود.'],
        ['Can I wrap only part of my vehicle?', 'Yes. Decals and lettering, a partial wrap, a half / ¾ wrap and a full wrap are all priced separately. Partial wraps are designed so the vehicle’s own colour becomes part of the layout.', 'partial half three quarter part only hood roof bumper side رپ جزئی', '/satin/vehicle-wraps/commercial/',
            'بله. برچسب و لترینگ، رپ جزئی، نیمه/سه‌چهارم و کامل قیمت جداگانه دارند. در رپ جزئی رنگ خود خودرو بخشی از طرح می‌شود.'],
        ['Do you do commercial and fleet wraps?', 'Yes — from decals and lettering to full wraps on vans, pickups, box trucks, trailers and buses. Fleet pricing starts at three or more vehicles and includes a brand template so every new vehicle matches.', 'commercial fleet business van truck trailer bus lettering decal company تجاری', '/satin/vehicle-wraps/commercial/',
            'بله — از برچسب و لترینگ تا رپ کامل ون، پیکاپ، باکس‌تراک، تریلر و اتوبوس. قیمت ناوگان از سه خودرو به بالا است و قالب برند دریافت می‌کنید.'],
        ['Do you wrap the roof of a van?', 'Rarely — it’s not visible from the street, so most fleet wraps stop at the roofline. If your vans park under office windows or downtown, a roof panel with your logo is a cheap add-on.', 'roof van top wrap included سقف', '/satin/vehicle-wraps/commercial/vans/',
            'به‌ندرت — سقف از خیابان دیده نمی‌شود و بیشتر رپ‌های ناوگان تا خط سقف است. اگر ون‌ها زیر پنجرهٔ ساختمان‌ها پارک می‌شوند، یک پنل لوگو روی سقف افزودنی ارزانی است.'],
        ['Can you remove an old wrap?', 'Yes. Removing an old wrap is quoted separately after we see the vehicle — it depends on the film’s age and condition, and it’s one of the things that can move the final price from the online estimate.', 'remove old wrap removal take off peel existing vinyl برداشتن رپ قدیمی', '/satin/vehicle-wraps/estimator/',
            'بله. برداشتن رپ قدیمی پس از دیدن خودرو جداگانه قیمت داده می‌شود و به عمر و وضعیت فیلم بستگی دارد.'],
        ['How do I look after my wrap?', 'Hand wash with a mild automotive soap, keep pressure washers at least 60 cm from edges, and skip wax on matte or satin finishes. Touchless car washes are fine; brush washes will scuff the film over time. We send a care sheet with every install.', 'care clean wash maintain pressure washer wax car wash brush touchless نگهداری شستشو کارواش', '/satin/faq/',
            'با شامپوی ملایم خودرو و دست بشویید، کارواش فشار قوی را حداقل ۶۰ سانتی‌متر از لبه‌ها دور نگه دارید و روی فیلم مات یا ساتن واکس نزنید. کارواش بدون برس مشکلی ندارد؛ کارواش برس‌دار به‌مرور فیلم را خط می‌اندازد.'],
        ['What is the Wrap Visualizer?', 'The Wrap Visualizer lets you preview hundreds of 3M, Avery Dennison, KPMF and ORACAL colour-change films on your type of vehicle. Pick a colour, finish, window tint and wheels, then send the build to us for a custom quote.', 'visualizer preview colour see try simulator 3d configurator پیش نمایش رنگ', '/satin/vehicle-wraps/visualizer/',
            'با Wrap Visualizer صدها رنگ فیلم 3M، Avery Dennison، KPMF و ORACAL را روی نوع خودروی خود می‌بینید؛ رنگ، فینیش، شیشه دودی و رینگ را انتخاب کنید و طرح را برای قیمت برای ما بفرستید.'],
        ['Do you sell ready-made wrap designs?', 'Yes — 56 ready-made vehicle wrap designs (including cartoon-mascot designs) for trades and businesses at $149 for the digital file (printing and installation quoted). Two rounds of colour and text changes are included; you get a layered Illustrator file, a print-ready PDF and a JPG mockup, and the file fee comes off if we install the wrap.', 'ready made wrap design template premade digital file 149 طرح آماده', '/satin/shop/vehicle-wrap-designs/',
            'بله — ۱۲ طرح آمادهٔ رپ برای مشاغل، فایل دیجیتال ۱۴۹ دلار (چاپ و نصب جداگانه). دو مرحله تغییر رنگ و متن شامل است؛ فایل لایه‌باز Illustrator، PDF آمادهٔ چاپ و ماکاپ JPG می‌گیرید و اگر نصب را ما انجام دهیم هزینهٔ فایل کم می‌شود.'],
        ['Can I buy a vehicle template?', 'Yes — vehicle templates are $25 CAD each, paid online by card with no account needed. We email your download link (PDF / AI / EPS). Can’t find your vehicle? Request it on the templates page.', 'vehicle template outline blueprint dimensions download 25 قالب خودرو', '/satin/shop/vehicle-templates/',
            'بله — هر قالب خودرو ۲۵ دلار کانادا است و بدون حساب کاربری با کارت پرداخت می‌شود. لینک دانلود (PDF / AI / EPS) ایمیل می‌شود. اگر خودروی شما نیست، در همان صفحه درخواست دهید.'],

        /* ---------- PPF, tint, detailing, ceramic ---------- */
        ['What is paint protection film (PPF)?', 'PPF is a clear urethane film that stops rock chips and swirls; its top coat self-heals light scratches. We install XPEL Ultimate Plus, which has a 10-year manufacturer warranty against yellowing, cracking and delamination. Partial (front) and full-vehicle packages are available.', 'ppf paint protection film clear bra xpel rock chip how long last lifespan years yellow پی پی اف محافظ رنگ', '/satin/vehicle-wraps/paint-protection-film/',
            'PPF یک فیلم شفاف یورتان است که جلوی سنگ‌ریزه و خط‌وخش را می‌گیرد و لایهٔ رویی آن خط‌های سطحی را با گرما ترمیم می‌کند. ما XPEL Ultimate Plus با ۱۰ سال گارانتی سازنده در برابر زردشدن، ترک و جداشدن نصب می‌کنیم. پکیج جلوی خودرو و کامل موجود است.'],
        ['What PPF packages do you have?', 'Two: Partial Front (hood, fenders, mirrors and front bumper — the zone that takes the most rock chips) and Full Vehicle (every painted panel). Film is cut on patterns for your exact year and trim. Prices depend on the vehicle — request a quote with your year, make and model.', 'ppf package partial front full vehicle hood fenders mirrors bumper price cost پکیج قیمت', '/satin/vehicle-wraps/paint-protection-film/',
            'دو پکیج داریم: جلوی خودرو (کاپوت، گلگیرها، آینه‌ها و سپر جلو) و کل خودرو (همهٔ قطعات رنگی). فیلم با الگوی دقیق سال و تیپ خودرو برش می‌خورد. قیمت به خودرو بستگی دارد — سال، برند و مدل را برای استعلام بفرستید.'],
        ['Can you see PPF on the car?', 'On a properly installed job, no — the edges are wrapped around panel edges and the film is optically clear. A close look at the hood may show a faint edge line on partial-front packages, which is why many customers choose full-hood coverage.', 'ppf visible see edge line invisible clear دیده', '/satin/vehicle-wraps/paint-protection-film/',
            'در نصب درست، خیر — لبه‌ها دور قطعات پیچیده می‌شوند و فیلم کاملاً شفاف است. در پکیج جلوی خودرو ممکن است از نزدیک خط لبه روی کاپوت دیده شود؛ برای همین خیلی‌ها کل کاپوت را انتخاب می‌کنند.'],
        ['Does PPF turn yellow?', 'Older films did. Modern urethane films with a UV-stable top coat don’t yellow within their warranty period — XPEL Ultimate Plus is warranted 10 years against yellowing.', 'ppf yellow yellowing turn colour old زرد', '/satin/vehicle-wraps/paint-protection-film/',
            'فیلم‌های قدیمی زرد می‌شدند. فیلم‌های یورتان امروزی با لایهٔ مقاوم در برابر UV در دورهٔ گارانتی زرد نمی‌شوند — XPEL Ultimate Plus ده سال گارانتی ضد زردی دارد.'],
        ['Can I put PPF over a wrap?', 'Yes, on a fresh wrap — it’s a common combination for matte colour changes that need protection from stains.', 'ppf over wrap on top matte combine protect wrap', '/satin/vehicle-wraps/paint-protection-film/',
            'بله، روی رپ تازه — ترکیب رایجی برای رپ‌های مات است که باید در برابر لک محافظت شوند.'],
        ['PPF or ceramic coating?', 'They do different jobs: ceramic coating makes washing easier and adds gloss but doesn’t stop rock chips; PPF stops chips. The best result is PPF on the front with ceramic over everything.', 'ppf vs ceramic difference better which choose سرامیک یا پی پی اف تفاوت', '/satin/guides/ppf-vs-ceramic-coating/',
            'کارشان فرق دارد: پوشش سرامیک شستشو را راحت‌تر و براقیت را بیشتر می‌کند ولی جلوی سنگ‌ریزه را نمی‌گیرد؛ PPF جلوی آسیب سنگ را می‌گیرد. بهترین نتیجه: PPF روی جلوی خودرو و سرامیک روی همه‌جا.'],
        ['How much is ceramic coating?', 'Ceramic coating packages: 2-Year Coating from $699 (wash, decontamination, gloss enhancement polish), 5-Year Coating from $1,199 (one-step correction) and Full Protection from $1,799 (two-step correction, 7+ year coating on paint, glass, wheels and trim). Details are confirmed in your quote.', 'ceramic coating price cost package 2 year 5 year 7 year protection سرامیک قیمت', '/satin/auto-detailing/ceramic-coating/',
            'پکیج‌های سرامیک: ۲ ساله از ۶۹۹ دلار، ۵ ساله از ۱٬۱۹۹ دلار (با پولیش یک‌مرحله‌ای) و محافظت کامل از ۱٬۷۹۹ دلار (پولیش دومرحله‌ای، سرامیک ۷+ ساله روی رنگ، شیشه، رینگ و تزئینات). جزئیات در قیمت نهایی تأیید می‌شود.'],
        ['Do you offer auto detailing?', 'Yes — interior and exterior detailing, paint correction and ceramic coating in Vaughan. Packages start from $199 (Refresh: interior vacuum and wipe-down, exterior hand wash and wheels), $349 (Deep Detail: shampoo, steam, clay bar) and $999 (Restore & Protect: one-step correction + 2-year ceramic). Request a booking online — we confirm scope, price and time.', 'detailing interior exterior paint correction polish ceramic coating booking clean car wash price دیتیلینگ نظافت', '/satin/auto-detailing/',
            'بله — دیتیلینگ داخل و بیرون، پولیش و پوشش سرامیک در Vaughan. پکیج‌ها از ۱۹۹ دلار (Refresh)، ۳۴۹ دلار (Deep Detail با شامپو، بخار و کلی‌بار) و ۹۹۹ دلار (Restore & Protect با پولیش و سرامیک ۲ ساله) شروع می‌شوند. آنلاین درخواست وقت دهید تا جزئیات و زمان را تأیید کنیم.'],
        ['How do I book detailing?', 'Use the online booking form: choose the services, your vehicle and a preferred date and time. Your date and time are a request — we contact you to agree the scope, price and available appointment.', 'book booking appointment detailing date time reserve schedule رزرو وقت', '/satin/auto-detailing/booking/',
            'از فرم رزرو آنلاین استفاده کنید: خدمات، خودرو و تاریخ و ساعت دلخواه را انتخاب کنید. این یک درخواست است — با شما تماس می‌گیریم تا خدمات، قیمت و زمان را هماهنگ کنیم.'],
        ['Do you do window tint?', 'Yes — window film for cars, homes and businesses: ceramic, carbon and dyed films in several shades, computer-cut to your glass, with a lifetime manufacturer warranty on the film. We recommend options that meet Ontario law.', 'window tint tinting film ceramic carbon dyed car home business شیشه دودی تینت', '/satin/window-tint/',
            'بله — فیلم شیشه برای خودرو، خانه و محل کار: سرامیکی، کربن و رنگی در چند درجه تیرگی، برش کامپیوتری و با گارانتی مادام‌العمر سازنده روی فیلم. گزینه‌هایی پیشنهاد می‌کنیم که با قانون انتاریو سازگار باشد.'],
        ['Is window tint legal in Ontario?', 'In Ontario nothing may be applied to the windshield below the manufacturer’s AS-1 line, and front side windows must not substantially obscure the interior. Rear windows are unrestricted. We’ll recommend compliant options for your front windows.', 'tint legal law ontario front windows windshield allowed police ticket قانونی قانون دودی', '/satin/guides/ontario-window-tint-law/',
            'در انتاریو روی شیشهٔ جلو پایین‌تر از خط AS-1 نباید چیزی نصب شود و شیشه‌های جلوی کناری نباید داخل خودرو را به‌طور قابل‌توجه بپوشانند. شیشه‌های عقب محدودیتی ندارند. برای شیشه‌های جلو گزینهٔ قانونی پیشنهاد می‌کنیم.'],
        ['How dark should my tint be?', 'For heat, choose the film tier (ceramic), not the darkness. For privacy, 20% on rear glass is the common choice. VLT is the share of light that passes through — lower is darker. Use the VLT preview on the tint page to compare.', 'tint dark darkness percent vlt 5 20 35 50 limo privacy heat درصد تیرگی', '/satin/window-tint/',
            'برای کاهش گرما، نوع فیلم (سرامیکی) مهم است نه تیرگی. برای حریم خصوصی، ۲۰٪ روی شیشه‌های عقب انتخاب رایجی است. VLT درصد نوری است که عبور می‌کند — عدد کمتر یعنی تیره‌تر.'],
        ['Will tint bubble, turn purple or affect my phone signal?', 'Modern carbon and ceramic films are colour-stable and carry a lifetime manufacturer warranty against bubbling, peeling and fading. They’re non-metallic, so they don’t affect phone or GPS signal.', 'tint bubble purple fade signal phone gps metallic حباب بنفش آنتن', '/satin/window-tint/',
            'فیلم‌های کربن و سرامیکی امروزی رنگشان ثابت است و گارانتی مادام‌العمر سازنده در برابر حباب، جداشدن و کم‌رنگ‌شدن دارند. فلزی نیستند و روی آنتن موبایل و GPS اثری ندارند.'],
        ['How do I clean tinted windows?', 'Wait a week after installation, then use a soft cloth and an ammonia-free cleaner. Never scrape the film.', 'tint clean cleaning care after install wait roll down windows تمیز کردن', '/satin/window-tint/',
            'یک هفته بعد از نصب صبر کنید، سپس با پارچهٔ نرم و شیشه‌پاک‌کن بدون آمونیاک تمیز کنید. هرگز روی فیلم را نتراشید.'],

        /* ---------- print shop ---------- */
        ['What printing do you offer?', 'Offset print (business cards, flyers, postcards, brochures, door hangers), large format (vinyl banners, roll-up and X-frame banners, yard signs, A-frames, flags) and labels & stickers (roll labels, sticker sheets, die-cut stickers). The configurators show live prices.', 'print printing business card flyer postcard brochure banner sign offset large format label sticker چاپ', '/satin/print-shop/',
            'چاپ افست (کارت ویزیت، تراکت، کارت پستال، بروشور، آویز در)، لارج‌فرمت (بنر وینیل، رول‌آپ، ایکس‌فریم، تابلو محوطه، ای‌فریم، پرچم) و لیبل و استیکر. قیمت زنده در صفحهٔ هر محصول نمایش داده می‌شود.'],
        ['How much are business cards?', 'Business cards start from $24.99 per 100 on 14pt matte. Options: 16pt gloss UV (+$8), 32pt suede (+$22), kraft uncoated (+$6) and double-sided (+$6). The configurator shows the live price for your quantity.', 'business card cards price cost 100 250 500 stock matte gloss suede کارت ویزیت قیمت', '/satin/print-shop/offset/business-cards/',
            'کارت ویزیت از ۲۴٫۹۹ دلار برای ۱۰۰ عدد (14pt مات). گزینه‌ها: 16pt براق UV (‎+۸ دلار)، 32pt سوئد (‎+۲۲)، کرافت (‎+۶) و دورو (‎+۶). قیمت دقیق تیراژ شما در صفحهٔ محصول نمایش داده می‌شود.'],
        ['How much are flyers, postcards, brochures and door hangers?', 'Flyers from $59 per 250, postcards from $49 per 250, brochures from $89 per 100 and door hangers from $79 per 250 (before tax). Size, stock and quantity change the price — the configurator shows it live.', 'flyer flyers postcard brochure door hanger price cost leaflet تراکت بروشور کارت پستال قیمت', '/satin/print-shop/offset/',
            'تراکت از ۵۹ دلار برای ۲۵۰ عدد، کارت پستال از ۴۹ دلار برای ۲۵۰، بروشور از ۸۹ دلار برای ۱۰۰ و آویز در از ۷۹ دلار برای ۲۵۰ عدد (بدون مالیات). اندازه، کاغذ و تیراژ قیمت را تغییر می‌دهد.'],
        ['How much are banners and signs?', 'Vinyl banners from $6.50 per sq ft, roll-up banners from $129, X-frame banners from $79, yard signs from $14 each, flags from $99 and A-frame signs from $149 (before tax). Configure size and quantity on the product page for the live price.', 'banner banners vinyl roll up x frame yard sign lawn sign flag a frame price cost sq ft بنر تابلو پرچم قیمت', '/satin/print-shop/large-format/',
            'بنر وینیل از ۶٫۵۰ دلار هر فوت مربع، رول‌آپ از ۱۲۹، ایکس‌فریم از ۷۹، تابلو محوطه از ۱۴ دلار هر عدد، پرچم از ۹۹ و ای‌فریم از ۱۴۹ دلار (بدون مالیات). قیمت دقیق را در صفحهٔ محصول ببینید.'],
        ['How fast is printing?', 'Print shop orders (business cards, flyers, brochures, postcards, door hangers, labels and stickers) take 7–10 business days after you approve the proof and payment is received. Large format (banners, signs, flags) takes 2–5 business days. Need it by a date? Tell us before you approve the proof and we’ll confirm what’s possible.', 'print turnaround fast how long days ready business cards flyers labels production time چاپ چند روز آماده', '/satin/refund-policy/',
            'سفارش‌های چاپ (کارت ویزیت، تراکت، بروشور، کارت پستال، آویز در، لیبل و استیکر) ۷ تا ۱۰ روز کاری پس از تأیید پروف و دریافت پرداخت آماده می‌شوند. لارج‌فرمت (بنر، تابلو، پرچم) ۲ تا ۵ روز کاری. اگر تاریخ مشخصی لازم دارید قبل از تأیید پروف بگویید تا امکانش را بررسی کنیم.'],
        ['How long do banners and signs take?', 'Large format — vinyl banners, roll-ups, X-frames, yard signs, A-frames and flags — takes 2–5 business days after proof approval and payment. Need it by a date? Tell us the day and we’ll confirm production and installation slots.', 'banner sign large format turnaround how long days ready flag yard sign بنر چند روز', '/satin/print-shop/large-format/',
            'لارج‌فرمت — بنر، رول‌آپ، ایکس‌فریم، تابلو محوطه، ای‌فریم و پرچم — ۲ تا ۵ روز کاری پس از تأیید پروف و پرداخت آماده می‌شود. اگر تاریخ مشخصی لازم دارید بگویید تا زمان تولید و نصب را تأیید کنیم.'],
        ['When does the turnaround start?', 'An order is confirmed when you approve the proof and payment (or the required deposit) is received. Turnaround times start from that moment, not from when the request was sent.', 'turnaround start when confirmed order proof approval payment begin شروع', '/satin/refund-policy/',
            'سفارش وقتی قطعی می‌شود که پروف را تأیید کنید و پرداخت (یا بیعانهٔ لازم) دریافت شود. زمان آماده‌سازی از همان لحظه شروع می‌شود، نه از زمان ارسال درخواست.'],
        ['Can I get a rush order?', 'Standard production is 7–10 business days for the print shop and 2–5 business days for large format; we don’t offer a priced rush option online. If you need it by a specific date, tell us before you approve the proof and we’ll confirm what’s possible.', 'rush urgent asap fast quick tomorrow next day express deadline فوری عجله', '/satin/refund-policy/',
            'زمان استاندارد چاپ ۷ تا ۱۰ روز کاری و لارج‌فرمت ۲ تا ۵ روز کاری است؛ گزینهٔ فوری با هزینهٔ مشخص به‌صورت آنلاین نداریم. اگر تاریخ مشخصی لازم دارید قبل از تأیید پروف بگویید تا امکانش را بررسی کنیم.'],
        ['Is there a minimum order for printing?', 'No minimum on large format — one banner, one sign or one flag is fine; pricing scales down at quantity. Offset print products start at the quantities shown in the configurator (e.g. 100 business cards).', 'minimum order quantity one single piece small run moq حداقل تعداد', '/satin/print-shop/large-format/',
            'برای لارج‌فرمت حداقلی وجود ندارد — یک بنر، یک تابلو یا یک پرچم هم مشکلی ندارد. چاپ افست از تیراژهای نمایش‌داده‌شده در صفحهٔ محصول شروع می‌شود (مثلاً ۱۰۰ کارت ویزیت).'],
        ['13 oz or 18 oz banner?', '13 oz is the standard for most banners. 18 oz is heavier and stiffer — choose it for permanent outdoor installs or anything wider than 8 ft.', 'banner 13oz 18oz vinyl material thickness heavy outdoor', '/satin/print-shop/large-format/vinyl-banners/',
            '۱۳ اونس برای بیشتر بنرها استاندارد است. ۱۸ اونس سنگین‌تر و محکم‌تر است — برای نصب دائمی بیرونی یا عرض بیش از ۸ فوت.'],
        ['How long do banners and signs last outside?', 'Vinyl banners and coroplast signs are rated for 2–3 years outdoors. Flags see more wind stress and typically last 6–12 months in constant use. Roll-ups and X-frames are indoor products.', 'banner sign flag outdoor last lifespan weather years coroplast دوام بیرون', '/satin/print-shop/large-format/',
            'بنر وینیل و تابلو کروپلاست ۲ تا ۳ سال در فضای باز دوام دارند. پرچم به‌خاطر باد معمولاً ۶ تا ۱۲ ماه در استفادهٔ مداوم. رول‌آپ و ایکس‌فریم برای فضای داخلی هستند.'],
        ['Is hardware included with banners and signs?', 'Where the configurator says so, yes: grommets on banners, H-stakes with yard signs, the stand with roll-ups, the pole kit with flags and the frame with A-frames. Replacement graphics alone are available for all of them.', 'hardware stand stake grommets pole frame included replacement graphic پایه', '/satin/print-shop/large-format/',
            'هرجا در صفحهٔ محصول ذکر شده بله: پرچ روی بنر، پایهٔ H برای تابلو محوطه، استند رول‌آپ، میلهٔ پرچم و قاب ای‌فریم. فقط چاپ جایگزین هم برای همه موجود است.'],
        ['Will the colours match my screen?', 'Screens are RGB and backlit; print is CMYK on paper, so bright blues and greens shift a little. Build your file in CMYK and, if a colour is critical, ask for a hard-copy proof or a Pantone match.', 'colour match screen rgb cmyk pantone different monitor accurate رنگ مانیتور', '/satin/artwork-guidelines/',
            'مانیتور RGB و نوردار است و چاپ CMYK روی کاغذ، بنابراین آبی و سبزهای روشن کمی تغییر می‌کنند. فایل را CMYK بسازید و اگر رنگ حیاتی است، پروف چاپی یا تطبیق پنتون بخواهید.'],
        ['Can I see a sample before ordering?', 'Yes. Drop by the shop (by appointment) to feel the stocks, or we can mail a sample pack of the papers you’re deciding between.', 'sample samples paper stock see feel before order نمونه کاغذ', '/satin/print-shop/',
            'بله. با وقت قبلی به فروشگاه بیایید و کاغذها را ببینید، یا بستهٔ نمونهٔ کاغذهای مورد نظرتان را پست می‌کنیم.'],
        ['What labels and stickers do you print?', 'Roll labels (on a 3 in core for products, jars, bottles and packaging), kiss-cut sticker sheets and die-cut vinyl stickers cut to your logo’s outline — priced live on each product page by size, quantity, material and finish, and proofed before printing.', 'label labels sticker stickers roll labels sticker sheet die cut vinyl product jar bottle packaging لیبل استیکر برچسب', '/satin/print-shop/labels/',
            'لیبل رولی (روی هستهٔ ۳ اینچی برای محصول، شیشه، بطری و بسته‌بندی)، شیت استیکر کیس‌کات و استیکر وینیل دای‌کات به شکل لوگو — قیمت بر اساس اندازه، تعداد، جنس و فینیش در صفحهٔ محصول نمایش داده می‌شود و قبل از چاپ پروف می‌فرستیم.'],
        ['Which label material should I choose?', 'White BOPP is waterproof and the best all-rounder for products, jars and bottles. Clear BOPP gives a no-label look, silver/metallic adds shine, and freezer-grade adhesive holds in the cold. Paper is the economical choice for dry packaging.', 'label material bopp waterproof clear silver metallic freezer paper adhesive جنس لیبل ضدآب', '/satin/print-shop/labels/roll-labels/',
            'BOPP سفید ضدآب و بهترین گزینهٔ عمومی برای محصول، شیشه و بطری است. BOPP شفاف ظاهر بدون‌لیبل می‌دهد، نقره‌ای براقیت دارد و چسب فریزری در سرما می‌چسبد. کاغذ گزینهٔ اقتصادی برای بسته‌بندی خشک است.'],
        ['Can I order labels in a custom shape?', 'Yes. Choose “Custom die-cut shape” and upload artwork with a cut line, or send the logo and we’ll create the die line and include it in your proof.', 'custom shape die cut label sticker outline cut line contour شکل دلخواه', '/satin/print-shop/labels/die-cut-stickers/',
            'بله. «Custom die-cut shape» را انتخاب و فایل با خط برش آپلود کنید، یا لوگو را بفرستید تا خط برش را بسازیم و در پروف نشان دهیم.'],

        /* ---------- files, proofs, design ---------- */
        ['What file format should I send?', 'Best: a print-ready PDF with bleed and crop marks. Vector AI, EPS or SVG is required for cut vinyl, embroidery and any logo we scale up. Raster TIFF, PSD, PNG or JPG work at the right resolution. Word, PowerPoint, Canva and Publisher files aren’t print-ready — we can rebuild them as a design service.', 'file format artwork vector pdf ai eps svg png jpg tiff psd canva word print ready فرمت فایل', '/satin/artwork-guidelines/',
            'بهترین: PDF آمادهٔ چاپ با بلید و علامت برش. برای وینیل برشی، گلدوزی و لوگوهای بزرگ، فایل وکتور AI، EPS یا SVG لازم است. TIFF، PSD، PNG یا JPG با رزولوشن مناسب قابل استفاده‌اند. فایل‌های Word، PowerPoint، Canva و Publisher آمادهٔ چاپ نیستند و می‌توانیم با خدمات طراحی بازسازی‌شان کنیم.'],
        ['What resolution (DPI) do I need?', 'Offset print: 300 DPI at final size. Large format and wallpaper: 100–150 DPI at final size. Vehicle wraps: 72–100 DPI at full vehicle scale (vector wherever possible). Apparel DTF: 300 DPI PNG with a transparent background. Screenshots and web images are almost never usable.', 'dpi resolution quality pixels low res blurry image size 300 150 banner file photo رزولوشن کیفیت', '/satin/artwork-guidelines/',
            'چاپ افست: ۳۰۰ DPI در اندازهٔ نهایی. لارج‌فرمت و کاغذدیواری: ۱۰۰ تا ۱۵۰ DPI. رپ خودرو: ۷۲ تا ۱۰۰ DPI در مقیاس کامل (ترجیحاً وکتور). پوشاک DTF: PNG با پس‌زمینهٔ شفاف و ۳۰۰ DPI. اسکرین‌شات و عکس‌های وب تقریباً هیچ‌وقت قابل استفاده نیستند.'],
        ['How much bleed do I need?', 'Offset print: 0.125 in (3 mm) bleed on all sides, with text and logos 0.125 in inside the trim. Rigid signs: 0.25 in. Banners: 1 in bleed, keeping text 3 in from the edges. Wallpaper: 2 in top and bottom, 1 in per side. Vehicle wraps: 2 in past every panel edge on the template.', 'bleed trim safe area margin crop marks edge mm business card cards flyer banner sign بلید حاشیه', '/satin/artwork-guidelines/',
            'چاپ افست: ۰٫۱۲۵ اینچ (۳ میلی‌متر) بلید از هر طرف و متن و لوگو ۰٫۱۲۵ اینچ داخل خط برش. تابلوهای سخت: ۰٫۲۵ اینچ. بنر: ۱ اینچ بلید و متن ۳ اینچ دور از لبه. کاغذدیواری: ۲ اینچ بالا و پایین و ۱ اینچ هر طرف. رپ خودرو: ۲ اینچ بیرون از لبهٔ هر پنل.'],
        ['Should my file be CMYK or RGB?', 'Work in CMYK. RGB files are converted, and bright blues, greens and oranges will shift. Give us Pantone references for brand colours and we’ll match them on press and on vinyl. Use rich black (C60 M40 Y40 K100) for large solid areas.', 'cmyk rgb colour mode pantone rich black brand colours convert رنگ', '/satin/artwork-guidelines/',
            'با CMYK کار کنید. فایل‌های RGB تبدیل می‌شوند و آبی، سبز و نارنجی‌های روشن تغییر می‌کنند. کد پنتون رنگ‌های برند را بدهید تا روی چاپ و وینیل تطبیق دهیم.'],
        ['How do I send large files?', 'You can attach files right here in the chat (up to 20 MB each), or upload through the product page or quote form (up to 25 MB per file). For bigger files, send a WeTransfer, Dropbox or Google Drive link in the notes or by email to info@satingraphic.ca.', 'send file large upload attach attachment big size wetransfer dropbox google drive email mb logo photo here chat ارسال فایل حجم پیوست', '/satin/artwork-guidelines/',
            'می‌توانید همین‌جا در چت فایل پیوست کنید (تا ۲۰ مگابایت)، یا از صفحهٔ محصول و فرم استعلام آپلود کنید (تا ۲۵ مگابایت). برای فایل‌های بزرگ‌تر لینک WeTransfer، Dropbox یا Google Drive را در توضیحات یا به info@satingraphic.ca بفرستید.'],
        ['What if I don’t have a print-ready file?', 'Send what you have — a logo, a Word document, a photo — and choose the design service option. We’ll lay it out, send a proof and only print once you approve it. We preflight every file and tell you if anything needs fixing.', 'no file print ready dont have artwork help fix preflight missing word document فایل ندارم', '/satin/artwork-guidelines/',
            'هرچه دارید بفرستید — لوگو، فایل Word یا عکس — و گزینهٔ خدمات طراحی را انتخاب کنید. چیدمان می‌کنیم، پروف می‌فرستیم و فقط بعد از تأیید شما چاپ می‌کنیم.'],
        ['Do I get a proof before printing?', 'Always. We send a digital proof showing size, layout and (for labels) the cut line. Nothing is printed until you approve it — please check spelling carefully, because errors in an approved proof aren’t reprinted free.', 'proof approve approval check before print mockup preview پروف تأیید', '/satin/refund-policy/',
            'همیشه. پروف دیجیتال با اندازه، چیدمان و (برای لیبل) خط برش می‌فرستیم. تا تأیید شما چیزی چاپ نمی‌شود — غلط‌های املایی را دقیق بررسی کنید چون اشتباه در پروف تأییدشده رایگان چاپ مجدد نمی‌شود.'],
        ['Do you offer design services?', 'Yes — our in-house team designs vehicle wraps, window graphics, print artwork, wallpaper and apparel. Every project starts with a deposit that’s credited to the job when we produce it. First concepts arrive in 3–5 business days; revisions take 1–2 days each. Custom wrap design is a $250 deposit.', 'design designer custom artwork logo deposit concept طراحی طراح', '/satin/shop/design-services/',
            'بله — تیم داخلی ما رپ خودرو، گرافیک ویترین، چاپ، کاغذدیواری و پوشاک طراحی می‌کند. هر پروژه با بیعانه شروع می‌شود که هنگام تولید از هزینه کم می‌شود. اولین طرح‌ها ۳ تا ۵ روز کاری و هر اصلاح ۱ تا ۲ روز طول می‌کشد. طراحی اختصاصی رپ ۲۵۰ دلار بیعانه دارد.'],
        ['Is the design deposit refundable?', 'Not once design work has started — it covers the designer’s time on concepts. It is credited in full against the wrap, print run or apparel order it was designed for.', 'design deposit refundable refund cancel credit بیعانه طراحی برگشت', '/satin/shop/design-services/',
            'پس از شروع کار طراحی خیر — هزینهٔ زمان طراح است. ولی کامل از هزینهٔ رپ، چاپ یا پوشاکی که برایش طراحی شده کم می‌شود.'],
        ['How much are extra revisions or logo redraws?', 'Additional revision rounds are $75 each. Vector logo recreation is a $95 add-on, usually done before concept work starts so everything built on it is sharp.', 'revision revisions extra changes logo redraw vector recreate cost 75 95 اصلاح لوگو', '/satin/shop/design-services/',
            'هر مرحلهٔ اصلاح اضافه ۷۵ دلار است. بازسازی وکتور لوگو ۹۵ دلار هزینهٔ اضافه دارد و معمولاً قبل از شروع طراحی انجام می‌شود.'],
        ['Do I own the design files?', 'Yes. Layered AI or PSD files plus print-ready PDFs are delivered on final approval, and you own the artwork.', 'own source files ownership copyright ai psd get files مالکیت فایل', '/satin/shop/design-services/',
            'بله. فایل‌های لایه‌باز AI یا PSD و PDF آمادهٔ چاپ بعد از تأیید نهایی تحویل می‌شود و طرح متعلق به شماست.'],
        ['How do I use the Design Studio?', 'Open Design Studio, pick a product (business cards, flyers, postcards, brochures, door hangers, banners, signs, flags, apparel or vehicles), add your text, logo and images, then generate a mockup and approve your proof. Add it to your cart or submit it with a quote request. Sign in to save designs to your account and re-open them later.', 'design studio online editor designer create own design template how to use make card myself استودیو طراحی آنلاین', '/satin/design-studio/',
            'Design Studio را باز کنید، محصول را انتخاب کنید (کارت ویزیت، تراکت، بروشور، بنر، تابلو، پرچم، پوشاک یا خودرو)، متن، لوگو و تصاویر را اضافه کنید، ماکاپ بگیرید و پروف را تأیید کنید. سپس به سبد اضافه کنید یا با درخواست قیمت بفرستید. با ورود به حساب، طرح‌ها ذخیره می‌شوند.'],
        ['Can I save my design and finish later?', 'Yes — sign in (or create a free account) and designs you save or approve in Design Studio appear under My account → Saved designs. Re-open them to edit, download or order any time.', 'save design later saved designs account continue edit re-open ذخیره طرح', '/satin/account/',
            'بله — وارد حساب شوید (یا حساب رایگان بسازید)؛ طرح‌هایی که در Design Studio ذخیره یا تأیید می‌کنید در My account → Saved designs می‌مانند و هر زمان می‌توانید ویرایش، دانلود یا سفارش دهید.'],

        /* ---------- apparel ---------- */
        ['Do you print custom apparel?', 'Yes — 70 garments, hats and totes: t-shirts, long sleeves, hoodies, sweatshirts, tanks, polos, hats and totes from Gildan, Bella + Canvas, Next Level, Champion and more. Full-colour DTF and vinyl heat press, with embroidery for hats and polos. No minimum order, and 5% off orders above 20 pieces.', 'apparel shirt hoodie hat workwear embroidery dtf uniform clothing custom print merch tote چاپ لباس تیشرت هودی', '/satin/apparel/',
            'بله — ۷۰ مدل لباس، کلاه و ساک: تی‌شرت، آستین‌بلند، هودی، سویشرت، رکابی، پولو، کلاه و ساک از برندهایی مثل Gildan، Bella + Canvas، Next Level و Champion. چاپ تمام‌رنگی DTF و وینیل حرارتی، و گلدوزی برای کلاه و پولو. بدون حداقل سفارش و ۵٪ تخفیف برای بیش از ۲۰ عدد.'],
        ['Is there a minimum order for apparel?', 'No minimum — one hoodie is fine. Orders above 20 pieces get 5% off.', 'apparel minimum order quantity one shirt single piece moq حداقل لباس', '/satin/apparel/',
            'حداقل سفارش نداریم — حتی یک هودی. سفارش بیش از ۲۰ عدد ۵٪ تخفیف دارد.'],
        ['How do I order apparel in different sizes?', 'On the garment page pick the colour, then enter a quantity for each size in the size table — the price per piece updates live. You can mix sizes in one order; garment colours can be mixed as long as the print stays the same. Each page has a sizing chart.', 'apparel sizes size mix quantity small medium large xl 2xl order how chart fit سایز اندازه', '/satin/apparel/',
            'در صفحهٔ لباس رنگ را انتخاب کنید و برای هر سایز در جدول تعداد وارد کنید — قیمت هر عدد زنده به‌روز می‌شود. می‌توانید سایزها را در یک سفارش ترکیب کنید. جدول سایز در هر صفحه موجود است.'],
        ['Where can you print on a shirt or hat?', 'Shirts, hoodies, sweatshirts and totes can be printed on the front, the back, or both — choose the print locations on the product page. Hats are decorated on the front only.', 'print location placement front back both sides hat front only sleeve chest where جلو پشت کلاه', '/satin/apparel/',
            'تی‌شرت، هودی، سویشرت و ساک را می‌توان جلو، پشت یا هر دو طرف چاپ کرد — محل چاپ را در صفحهٔ محصول انتخاب کنید. کلاه فقط از جلو چاپ یا گلدوزی می‌شود.'],
        ['Which apparel print method should I choose?', 'DTF for full-colour or photographic art in any quantity; vinyl heat press for solid colours, names and numbers; embroidery for a premium, long-lasting finish on hats and polos.', 'apparel method dtf vinyl heat press embroidery screen print which best روش چاپ گلدوزی', '/satin/apparel/',
            'DTF برای طرح‌های تمام‌رنگی و عکس در هر تعداد؛ وینیل حرارتی برای رنگ‌های تخت، اسم و شماره؛ گلدوزی برای ظاهر لوکس و بادوام روی کلاه و پولو.'],
        ['How long do apparel orders take?', 'Apparel takes 5–7 business days after you approve the proof and payment is received.', 'apparel turnaround how long days ready shirts hoodies production لباس چند روز', '/satin/refund-policy/',
            'سفارش پوشاک ۵ تا ۷ روز کاری پس از تأیید پروف و دریافت پرداخت آماده می‌شود.'],
        ['How do I care for printed apparel?', 'Wait 24 hours before the first wash, wash inside out in cold water with mild detergent (no bleach or fabric softener), tumble dry low or hang dry, and don’t iron directly on the print. Decoration is warranted for 50 washes when the care label is followed.', 'apparel care wash shirt print crack fade iron dryer شستن لباس', '/satin/apparel/',
            '۲۴ ساعت قبل از اولین شستشو صبر کنید، پشت‌ورو و با آب سرد و شوینده ملایم بشویید (بدون سفیدکننده و نرم‌کننده)، با حرارت کم خشک کنید و مستقیم روی چاپ اتو نکشید. چاپ با رعایت دستورالعمل تا ۵۰ بار شستشو گارانتی دارد.'],
        ['Can I bring my own garments?', 'Sometimes — ask first. We can’t guarantee results on fabrics we haven’t tested, and we don’t replace customer-supplied garments if a print fails.', 'own garments bring my shirts supply customer provided لباس خودم', '/satin/apparel/',
            'گاهی — اول بپرسید. روی پارچه‌هایی که تست نکرده‌ایم نتیجه را تضمین نمی‌کنیم و اگر چاپ خراب شود لباس شما را جایگزین نمی‌کنیم.'],
        ['Do you sell DTF transfers?', 'Yes — custom DTF transfers and gang sheets. Upload transparent PNG or SVG artwork and confirm the gang sheet dimensions before production; a designer can prepare it for +$30.', 'dtf transfer transfers gang sheet heat press film iron on دی تی اف', '/satin/shop/dtf-transfers/',
            'بله — ترانسفر DTF و گنگ‌شیت سفارشی. فایل PNG شفاف یا SVG آپلود کنید و ابعاد شیت را قبل از تولید تأیید کنید؛ آماده‌سازی توسط طراح ‎+۳۰ دلار.'],

        /* ---------- window graphics, wallpaper, installation ---------- */
        ['Do you do window graphics?', 'Yes — window decals (from $12/sq ft), perforated one-way vinyl (from $9/sq ft), frosted privacy film (from $7/sq ft) and full window graphics, with optional professional installation. We proof every job on a photo of your actual window.', 'window graphics decal storefront perforated frosted privacy glass one way vinyl price گرافیک ویترین شیشه مات', '/satin/window-graphics/',
            'بله — برچسب ویترین (از ۱۲ دلار هر فوت مربع)، وینیل پرفوره یک‌طرفه (از ۹ دلار)، فیلم مات حریم خصوصی (از ۷ دلار) و گرافیک کامل ویترین با نصب حرفه‌ای اختیاری. هر کار را روی عکس ویترین واقعی شما پروف می‌کنیم.'],
        ['Inside or outside the glass?', 'Outside gives the crispest read from the street and is standard for opaque decals and perforated film. Inside (reverse-applied) protects the graphic from weather and vandalism and is what we recommend for frosted film and long-term lettering.', 'window graphics inside outside glass apply reverse داخل بیرون شیشه', '/satin/window-graphics/',
            'بیرون شیشه از خیابان واضح‌تر دیده می‌شود و برای برچسب مات و پرفوره استاندارد است. داخل شیشه گرافیک را از هوا و خرابکاری محافظت می‌کند و برای فیلم مات و نوشته‌های بلندمدت توصیه می‌شود.'],
        ['How long do window graphics last?', 'Cast opaque vinyl and frosted film: 5–7 years. Perforated and printed films: 2–3 years outdoors, longer inside. They come off cleanly within their rated life — we use cast films and remove them with heat.', 'window graphics last lifespan remove clean residue years دوام', '/satin/window-graphics/',
            'وینیل cast و فیلم مات ۵ تا ۷ سال؛ فیلم پرفوره و چاپی ۲ تا ۳ سال در بیرون و بیشتر در داخل. در طول عمر مفیدشان تمیز جدا می‌شوند.'],
        ['How much is installation?', 'Window and wall graphics installation is $3 per square foot, subject to a site assessment. Removing existing vinyl and adhesive or extra cleaning is $75 per hour. High or difficult access, lifts or scaffolding are quoted separately before approval.', 'installation install cost price per square foot remove old vinyl adhesive window wall site هزینه نصب', '/satin/installation-terms/',
            'نصب گرافیک ویترین و دیوار هر فوت مربع ۳ دلار است (پس از بررسی محل). برداشتن وینیل و چسب قبلی یا تمیزکاری اضافه ساعتی ۷۵ دلار. دسترسی سخت، بالابر یا داربست جداگانه قیمت داده می‌شود.'],
        ['What do I need to prepare for installation?', 'Give accurate dimensions in inches and describe the installation height, access, surface condition and any existing graphics. The work area must be clear, safe and accessible; glass or walls must be dry and undamaged, and fresh paint must fully cure first. We contact you to confirm site conditions, scope and schedule.', 'installation prepare site measure dimensions access wall paint cure surface آماده سازی نصب', '/satin/installation-terms/',
            'ابعاد دقیق به اینچ بدهید و ارتفاع، دسترسی، وضعیت سطح و گرافیک‌های موجود را توضیح دهید. محل کار باید خالی، ایمن و در دسترس باشد؛ شیشه یا دیوار خشک و سالم و رنگ تازه کاملاً خشک شده باشد.'],
        ['Do you make custom wallpaper?', 'Yes — custom, office, bedroom, kids, botanical, marble and geometric wallpaper in peel-and-stick, removable and commercial-grade vinyl. Peel-and-stick can be self-installed (numbered panels and instructions included); pasted materials are best installed by us.', 'wallpaper mural wall custom peel stick removable commercial install myself diy کاغذدیواری', '/satin/wallpaper/',
            'بله — کاغذدیواری سفارشی، اداری، اتاق‌خواب، کودک، گیاهی، مرمری و هندسی در انواع peel-and-stick، قابل‌جداشدن و تجاری. نوع peel-and-stick را خودتان می‌توانید نصب کنید؛ انواع چسبی را بهتر است ما نصب کنیم.'],
        ['How do I measure my wall for wallpaper?', 'Measure the widest and tallest points of your wall in inches and add the trimming allowance (2 in top and bottom, 1 in per side). The wall must be clean, dry and smooth, with fresh paint fully cured. For a photo mural you need about 100 DPI at final size.', 'wallpaper measure wall size dimensions inches photo resolution prepare اندازه دیوار', '/satin/wallpaper/',
            'عریض‌ترین و بلندترین نقطهٔ دیوار را به اینچ اندازه بگیرید و حاشیهٔ برش (۲ اینچ بالا و پایین، ۱ اینچ هر طرف) اضافه کنید. دیوار باید تمیز، خشک و صاف باشد و رنگ تازه کاملاً خشک شده باشد.'],

        /* ---------- payments, invoices, deposits ---------- */
        ['How can I pay?', 'Shop orders can be paid online by credit card (Square) or PayPal at checkout. Quotes and invoices can be paid online from the secure link in your invoice email, or by Interac e-Transfer, credit card or cheque.', 'pay payment card credit card paypal square etransfer interac cheque cash methods پرداخت کارت', '/satin/faq/',
            'سفارش‌های فروشگاه را می‌توانید هنگام خرید با کارت اعتباری (Square) یا PayPal پرداخت کنید. استعلام‌ها و فاکتورها از طریق لینک امن در ایمیل فاکتور، یا با Interac e-Transfer، کارت اعتباری یا چک پرداخت می‌شوند.'],
        ['Do I need to pay a deposit?', 'Jobs start once the proof is approved and payment or the required deposit is received. Custom design starts with a deposit that’s credited to the job (wrap design: $250). Your invoice shows any deposit due, and you can choose how much to pay online.', 'deposit down payment upfront advance how much pay first بیعانه پیش پرداخت', '/satin/refund-policy/',
            'کار پس از تأیید پروف و دریافت پرداخت یا بیعانهٔ لازم شروع می‌شود. طراحی اختصاصی با بیعانه شروع می‌شود که از هزینهٔ کار کم می‌شود (طراحی رپ: ۲۵۰ دلار). مبلغ بیعانه در فاکتور شما نوشته شده است.'],
        ['How do I pay my invoice?', 'Open the secure link in your invoice email and pay by card or PayPal — you can pay the deposit, a part, or everything that’s left. A receipt is emailed when the payment goes through. You can also pay by Interac e-Transfer or cheque.', 'invoice pay online link receipt balance partial deposit فاکتور پرداخت', '/satin/faq/',
            'لینک امن در ایمیل فاکتور را باز کنید و با کارت یا PayPal پرداخت کنید — می‌توانید بیعانه، بخشی یا کل مانده را بپردازید. رسید به ایمیل‌تان ارسال می‌شود. پرداخت با Interac e-Transfer یا چک هم ممکن است.'],

        /* ---------- orders, shipping, policies ---------- */
        ['Can I pick up my order?', 'Yes — pickup at our Vaughan facility (50 Viceroy Rd, Unit 22–23) is free. We hold completed orders for 30 days.', 'pickup pick up collect order shop free local vaughan تحویل حضوری', '/satin/refund-policy/',
            'بله — تحویل حضوری از محل ما در Vaughan رایگان است. سفارش‌های آماده تا ۳۰ روز نگهداری می‌شوند.'],
        ['Do you ship?', 'Yes — we ship print and apparel across Canada by courier; the cost is quoted by weight and destination before you confirm. Orders over $500 within the GTA ship free. Pickup in Vaughan is free.', 'ship shipping delivery courier canada cost free gta mail send vancouver calgary edmonton ottawa montreal winnipeg halifax quebec alberta bc province usa ارسال پست هزینه ارسال ونکوور کانادا', '/satin/refund-policy/',
            'بله — چاپ و پوشاک را با پیک به سراسر کانادا ارسال می‌کنیم؛ هزینه بر اساس وزن و مقصد قبل از تأیید اعلام می‌شود. سفارش‌های بالای ۵۰۰ دلار داخل GTA ارسال رایگان دارند.'],
        ['Do you ship or install outside Vaughan?', 'Pickup in Vaughan is free. We ship print and apparel across Canada by courier, and install wraps, tint, window and wall graphics across the GTA (Toronto, Mississauga, Brampton, Markham, Richmond Hill and more).', 'ship shipping delivery courier canada install gta toronto mississauga brampton markham outside', '/satin/faq/',
            'تحویل حضوری در Vaughan رایگان است. چاپ و پوشاک را به سراسر کانادا ارسال می‌کنیم و رپ، تینت، گرافیک ویترین و دیوار را در سراسر GTA نصب می‌کنیم.'],
        ['My package arrived damaged — what do I do?', 'Photograph the package before opening it and contact us within 48 hours at info@satingraphic.ca or (905) 962-6222, so we can claim against the carrier and reprint.', 'damaged package shipping broken courier arrived lost claim خراب رسید', '/satin/refund-policy/',
            'قبل از باز کردن از بسته عکس بگیرید و ظرف ۴۸ ساعت با info@satingraphic.ca یا ‎(905) 962-6222 تماس بگیرید تا از شرکت حمل خسارت بگیریم و دوباره چاپ کنیم.'],
        ['What is your refund policy?', 'Everything is custom-made to your artwork, so we don’t accept returns or refunds for change of mind, the wrong size or quantity ordered, or errors in a proof you approved. If an order doesn’t match the approved proof or has a defect, tell us within 7 days and we’ll reprint it free — or refund it if a reprint isn’t practical.', 'refund return money back policy exchange change mind wrong size مرجوع بازپرداخت', '/satin/refund-policy/',
            'همهٔ کارها سفارشی ساخته می‌شوند، بنابراین برای تغییر نظر، سایز یا تعداد اشتباه یا خطای موجود در پروف تأییدشده مرجوعی و بازپرداخت نداریم. اگر سفارش با پروف تأییدشده مطابقت ندارد یا ایراد دارد، ظرف ۷ روز خبر دهید تا رایگان دوباره چاپ کنیم یا در صورت عدم امکان، وجه را برگردانیم.'],
        ['What if my order has a mistake or defect?', 'If your order doesn’t match the approved proof — wrong colour, size, stock, misregistration, trimming faults or a manufacturing defect — tell us within 7 days of pickup or delivery. We reprint the affected quantity at no charge, or refund it if a reprint isn’t practical.', 'defect mistake wrong reprint error misprint quality problem issue ایراد اشتباه چاپ مجدد', '/satin/refund-policy/',
            'اگر سفارش با پروف تأییدشده مطابقت ندارد — رنگ، اندازه، جنس یا برش اشتباه یا ایراد تولید — ظرف ۷ روز پس از تحویل خبر دهید تا رایگان دوباره چاپ کنیم یا وجه را برگردانیم.'],
        ['Can I cancel my order?', 'Before proof approval you can cancel at no charge (design deposits aren’t refundable once design work has started). After proof approval but before production we charge for materials and time spent (typically 25%). Custom-printed orders can’t be cancelled once production starts. Wrap and installation bookings cancelled with less than 48 hours’ notice forfeit 25% of the deposit.', 'cancel cancellation order booking change mind refund deposit لغو کنسل سفارش', '/satin/refund-policy/',
            'قبل از تأیید پروف لغو رایگان است (بیعانهٔ طراحی پس از شروع کار برنمی‌گردد). بعد از تأیید پروف و قبل از تولید، هزینهٔ مواد و زمان (معمولاً ۲۵٪) دریافت می‌شود. پس از شروع تولید لغو ممکن نیست. لغو نوبت رپ و نصب با کمتر از ۴۸ ساعت اطلاع، ۲۵٪ بیعانه را از بین می‌برد.'],
        ['Can I return vinyl rolls or tools?', 'Unopened, unused vinyl rolls, laminates and tools from the shop can be returned within 14 days for a refund less a 15% restocking fee. Cut lengths of film are custom and non-returnable.', 'return vinyl roll tools materials laminate restocking fee unopened مرجوع ابزار', '/satin/shop/materials-tools/',
            'رول وینیل، لمینیت و ابزار باز‌نشده و استفاده‌نشده تا ۱۴ روز با کسر ۱۵٪ هزینهٔ بازگشت به انبار قابل مرجوع است. فیلم برش‌خورده قابل مرجوع نیست.'],
        ['Do you sell wrap vinyl and tools?', 'Yes — the Materials & Tools shop has 3M, Avery Dennison and Arlon cast films and laminates (sold per foot), plus squeegee and install kits, knifeless tape, heat guns, surface prep cleaner and edge sealer. Add items to the quote cart for a confirmed price.', 'materials tools vinyl roll film laminate squeegee knifeless tape heat gun buy sell diy لوازم ابزار وینیل', '/satin/shop/materials-tools/',
            'بله — در بخش Materials & Tools فیلم و لمینیت cast از 3M، Avery Dennison و Arlon (فوتی)، کیت نصب، نوار بدون تیغ، هیت‌گان، تمیزکنندهٔ سطح و قلم آب‌بندی لبه موجود است. برای قیمت قطعی به سبد استعلام اضافه کنید.'],
        ['How do I check my order status?', 'Sign in to My account → Orders to see your orders, their status and any invoices (confirm your email address to see orders placed with it). You can also ask here or email info@satingraphic.ca with your order or quote reference.', 'order status track tracking where is my order progress ready update وضعیت سفارش پیگیری', '/satin/account/',
            'وارد My account → Orders شوید تا سفارش‌ها، وضعیت و فاکتورها را ببینید (ایمیل خود را تأیید کنید تا سفارش‌های ثبت‌شده با آن نمایش داده شوند). همین‌جا یا با ایمیل به info@satingraphic.ca با شمارهٔ سفارش هم می‌توانید بپرسید.'],

        /* ---------- warranty ---------- */
        ['What warranty do you offer?', 'Five years on wrap workmanship, ten years on PPF film (manufacturer) plus 5 years workmanship, lifetime on tint film plus 2 years workmanship, 2 years on window graphics and wallpaper workmanship, 50 washes on apparel decoration, and reprints for any print job that doesn’t match its approved proof.', 'warranty guarantee coverage peel lift reprint years long wrap ppf tint print apparel گارانتی ضمانت چند ساله', '/satin/warranty/',
            'پنج سال گارانتی اجرت رپ، ده سال گارانتی سازنده روی فیلم PPF به‌علاوهٔ ۵ سال اجرت، گارانتی مادام‌العمر فیلم تینت به‌علاوهٔ ۲ سال اجرت، ۲ سال برای گرافیک ویترین و کاغذدیواری، ۵۰ بار شستشو برای چاپ پوشاک، و چاپ مجدد برای هر کاری که با پروف تأییدشده مطابقت نداشته باشد.'],
        ['What does the wrap warranty not cover?', 'Not covered: damage from accidents, pressure washers at edges, automatic brush washes, chemicals, or wraps applied over repaint, damaged paint or non-OEM panels we flagged at inspection.', 'warranty not covered exclusions accident pressure washer brush wash repaint گارانتی شامل نمی شود', '/satin/warranty/',
            'شامل نمی‌شود: آسیب تصادف، کارواش فشار قوی روی لبه‌ها، کارواش برس‌دار، مواد شیمیایی، یا رپ روی رنگ دوباره‌شده، رنگ آسیب‌دیده یا قطعات غیرکارخانه‌ای که در بازدید اعلام کرده‌ایم.'],
        ['How do I make a warranty claim?', 'Email info@satingraphic.ca with your invoice number, photos of the issue and the date it appeared (call (905) 962-6222 if urgent). We inspect within 10 business days and repair, replace or reprint the affected area at no charge if it’s covered.', 'warranty claim how to problem lifting peeling bubble report ادعای گارانتی', '/satin/warranty/',
            'به info@satingraphic.ca ایمیل بزنید و شمارهٔ فاکتور، عکس مشکل و تاریخ بروز آن را بفرستید (در موارد فوری تماس بگیرید). ظرف ۱۰ روز کاری بررسی می‌کنیم و اگر مشمول گارانتی باشد رایگان تعمیر، تعویض یا چاپ مجدد می‌کنیم.'],

        /* ---------- account ---------- */
        ['Do I need an account to order?', 'No — guest checkout is always available and an account is optional. With a free account you get faster checkout with saved details, your orders and invoices in one place, and saved Design Studio designs.', 'account need register sign up guest checkout create optional حساب کاربری ثبت نام', '/satin/register/',
            'خیر — خرید مهمان همیشه ممکن است و حساب کاربری اختیاری است. با حساب رایگان، خرید سریع‌تر با اطلاعات ذخیره‌شده، سفارش‌ها و فاکتورها در یک‌جا و طرح‌های ذخیره‌شدهٔ Design Studio دارید.'],
        ['How do I sign in to my account?', 'Go to the Login page and sign in with your email and password, or continue with Google or Facebook. Forgot your password? Use “Forgot password” and we’ll email you a link to choose a new one.', 'login sign in account password forgot reset google facebook my account ورود حساب رمز فراموش', '/satin/login/',
            'به صفحهٔ Login بروید و با ایمیل و رمز عبور، یا با Google یا Facebook وارد شوید. رمز را فراموش کرده‌اید؟ «Forgot password» را بزنید تا لینک تغییر رمز ایمیل شود.'],

        /* ---------- websites, social, video ---------- */
        ['Do you build websites?', 'Yes — Starter websites from $400 (up to 5 pages, 2–3 weeks), Business websites from $899 (up to 10 pages, 3–4 weeks) and E-commerce from $1,499 (4–6 weeks). Every package includes responsive design and 30 days of post-launch support; hosting and domain costs are not included. You own the design, code and content.', 'website web design site ecommerce how long take weeks own price cost طراحی سایت', '/satin/website-design/',
            'بله — سایت Starter از ۴۰۰ دلار (تا ۵ صفحه، ۲–۳ هفته)، Business از ۸۹۹ دلار (تا ۱۰ صفحه، ۳–۴ هفته) و فروشگاهی از ۱٬۴۹۹ دلار (۴–۶ هفته). همه شامل طراحی واکنش‌گرا و ۳۰ روز پشتیبانی پس از راه‌اندازی هستند؛ هزینهٔ هاست و دامنه جداست. طرح، کد و محتوا متعلق به شماست.'],
        ['Can I update my website myself?', 'Yes — every package includes a CMS for the pages you’ll change (services, prices, photos, blog) and a training session. Structural changes we handle for you; monthly care plans bundle hosting, backups, updates and small changes.', 'website update edit myself cms hosting domain care plan maintenance ویرایش سایت', '/satin/website-design/',
            'بله — هر پکیج یک CMS برای صفحاتی که تغییر می‌دهید (خدمات، قیمت‌ها، عکس‌ها، وبلاگ) و یک جلسهٔ آموزش دارد. تغییرات ساختاری را ما انجام می‌دهیم.'],
        ['Do you manage social media?', 'Yes — Content Starter $499/month (1–2 platforms, 8 branded posts), Monthly Presence $1,199/month (2–3 platforms, 12 posts + 4 reels) and Campaign Partner $2,199/month (3–4 platforms, 20 posts + 8 reels). We agree a review and approval process before publishing anything.', 'social media instagram facebook tiktok posts reels management marketing monthly شبکه اجتماعی اینستاگرام', '/satin/social-media-services/',
            'بله — Content Starter ماهانه ۴۹۹ دلار (۱–۲ پلتفرم، ۸ پست)، Monthly Presence ماهانه ۱٬۱۹۹ دلار (۲–۳ پلتفرم، ۱۲ پست + ۴ ریلز) و Campaign Partner ماهانه ۲٬۱۹۹ دلار (۳–۴ پلتفرم، ۲۰ پست + ۸ ریلز).'],
        ['Do you offer videography?', 'Yes — business videography in Vaughan, Toronto and the GTA: brand films, product videos, social clips and event coverage, planned around your audience and where the video will be used. Build your quote on the videography page.', 'video videography film brand product social clips event shoot ویدیو فیلمبرداری', '/satin/videography/',
            'بله — فیلم‌برداری تجاری در Vaughan، تورنتو و GTA: فیلم برند، ویدیوی محصول، کلیپ شبکه‌های اجتماعی و پوشش رویداد. در صفحهٔ ویدیو قیمت بگیرید.'],
    ];
}
