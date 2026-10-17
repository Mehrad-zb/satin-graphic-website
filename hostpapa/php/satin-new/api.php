<?php
declare(strict_types=1);
if (!function_exists('str_starts_with')) { function str_starts_with(string $h, string $n): bool { return $n === '' || strncmp($h, $n, strlen($n)) === 0; } }
if (!function_exists('str_ends_with')) { function str_ends_with(string $h, string $n): bool { return $n === '' || substr($h, -strlen($n)) === $n; } }
if (!function_exists('str_contains')) { function str_contains(string $h, string $n): bool { return $n === '' || strpos($h, $n) !== false; } }
if (!function_exists('array_is_list')) { function array_is_list(array $a): bool { return $a === [] || array_keys($a) === range(0, count($a) - 1); } }
require __DIR__ . '/lib.php';
require __DIR__ . '/formula.php';
require __DIR__ . '/catalog.php';

header('X-Content-Type-Options: nosniff');
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

const UNAVAILABLE = 'This feature is being moved to our new server. Please use "Get exact quote", call 905-962-6222 or email info@satingraphic.ca.';

function rule_by_id(string $id): ?array {
    if (str_starts_with($id, 'template-')) { require_once __DIR__ . '/commerce.php'; return shop_template_rule($id); }
    return cat_rule($id);
}
/** Rule as sent to product pages: multiUnit = several windows / walls can be priced in one cart line (formula.php formula_units_ok). */
/** Limited-time promotion: free design on every vehicle wrap estimator until WRAP_FREE_DESIGN_UNTIL (Toronto date, exclusive).
 *  Only the public rule and the public quote see a $0 design fee; the admin's saved design deposit is untouched and returns by itself after the end date. */
const WRAP_FREE_DESIGN_UNTIL = '2026-12-01';
function wrap_design_promo(?array $rule): ?array {
    if (!$rule || !str_starts_with((string)($rule['id'] ?? ''), 'wrap-') || !str_contains((string)($rule['path'] ?? ''), '/vehicle-wraps/estimator/')) return $rule;
    if (toronto_today() >= WRAP_FREE_DESIGN_UNTIL) return $rule;
    $c = $rule['constants'] ?? [];
    $regular = (float)($c['designFee'] ?? $c['designDeposit'] ?? 250);
    foreach (['designFee', 'designDeposit'] as $k) if (array_key_exists($k, $c)) $rule['constants'][$k] = 0;
    if (!array_key_exists('designFee', $c) && !array_key_exists('designDeposit', $c)) $rule['constants']['designDeposit'] = 0;
    $rule['promo'] = ['freeDesign' => true, 'regularDesignFee' => $regular, 'until' => WRAP_FREE_DESIGN_UNTIL];
    return $rule;
}
function rule_public(?array $rule): ?array { if ($rule && formula_units_ok($rule)) $rule['multiUnit'] = true; return wrap_design_promo($rule); }

function booking_slots(string $date): array {
    $s = json_decode((string)file_get_contents(DATA . '/service-settings.json'), true);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return [];
    $d = DateTime::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
    if (!$d || $d->format('Y-m-d') !== $date || in_array($date, $s['closedDates'] ?? [], true) || !in_array((int)$d->format('w'), $s['bookingDays'] ?? [], true)) return [];
    $today = toronto_today();
    if ($date < $today) return [];
    $now = toronto_time();
    $booked = [];
    try {
        $q = db()->prepare("SELECT preferred_time FROM service_requests WHERE type = 'booking' AND preferred_date = ? AND status = 'confirmed'");
        $q->execute([$date]); $booked = array_column($q->fetchAll(), 'preferred_time');
    } catch (Throwable $e) { }
    return array_values(array_filter($s['bookingTimes'] ?? [], fn($t) => ($date !== $today || $t > $now) && !in_array($t, $booked, true)));
}

function save_request(string $id, string $type, string $service, string $name, string $email, string $phone, string $date, string $time, string $details): array {
    $pdo = db();
    $ref = 'SG-' . strtoupper(substr($id, 0, 8));
    $q = $pdo->prepare('SELECT email FROM service_requests WHERE id = ?'); $q->execute([$id]);
    if ($row = $q->fetch()) return $row['email'] === $email ? [$ref, 200] : [null, 409];
    $q = $pdo->prepare('SELECT COUNT(*) AS n FROM service_requests WHERE email = ? AND created_at > ?');
    $q->execute([$email, gmdate('Y-m-d\TH:i:s.v\Z', time() - 3600)]);
    if ((int)$q->fetch()['n'] >= 5) return [null, 429];
    $now = now_iso();
    $pdo->prepare('INSERT INTO service_requests (id,type,service,name,email,phone,preferred_date,preferred_time,details,status,created_at,consent_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$id, $type, $service, $name, $email, $phone, $date, $time, $details, 'pending_confirmation', $now, $now]);
    $d = json_decode($details, true) ?: [];
    $lines = ["New $type request $ref", "Service: $service", "Name: $name", "Email: $email", "Phone: $phone"];
    if ($date) $lines[] = "Preferred: $date $time";
    foreach (['notes', 'estimate', 'vehicle', 'plan', 'contactPreference'] as $k) if (!empty($d[$k])) $lines[] = ucfirst($k) . ': ' . $d[$k];
    foreach (($d['custom'] ?? []) as $k => $v) $lines[] = "$k: $v";
    foreach (($d['attachments'] ?? []) as $a) $lines[] = 'Attachment: ' . $a['name'] . ' (' . round($a['size'] / 1048576, 2) . ' MB) — open the request in the admin to download';
    notify_owner("Satin website: new $type request $ref", implode("\n", $lines));
    try { require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/push.php'; push_event('requests', ($type === 'booking' ? '📅 New booking ' : '📝 New quote request ') . $ref, "$name · $service", '/admin/#/requests', 'req-' . $ref); } catch (Throwable $e) { } // staff devices (Admin → Notifications)
    return [$ref, 201];
}

try {
    // external images copied to our host on first request + Admin → copy all (ext_images.php)
    if (str_starts_with($path, '/satin/img/ext/') && ($method === 'GET' || $method === 'HEAD')) { require_once __DIR__ . '/ext_images.php'; ext_serve($path); }
    if ($path === '/cms/portfolio-data.mjs' && ($method === 'GET' || $method === 'HEAD')) { require_once __DIR__ . '/portfolio.php'; pf_data_module(); }
    if ($path === '/api/admin/ext-images' || $path === '/api/admin/ext-images/warm') { require_once __DIR__ . '/ext_images.php'; ext_admin_route($path, $method); }
    if (str_starts_with($path, '/api/admin/')) { require __DIR__ . '/admin_api.php'; admin_route($path, $method); }
    // ---------- website chat widget (chat.php) ----------
    if (str_starts_with($path, '/api/chat/')) { require_once __DIR__ . '/chat.php'; chat_route($path, $method); }
    // ---------- online ordering: uploads, cart/checkout, payments, templates (commerce.php) ----------
    if (preg_match('#^/api/(studio/|artwork/check$|checkout/|payments/webhook/|payments/config$|templates$|template-preview$|download$|digital/download$)#', $path) || $path === '/api/rules' && $method === 'GET' && (str_starts_with((string)($_GET['id'] ?? ''), 'template-') || str_contains((string)($_GET['path'] ?? ''), '/shop/products/template-'))) {
        require_once __DIR__ . '/commerce.php'; shop_route($path, $method);
    }
    // ---------- read-only data ----------
    $static = ['/api/service-settings' => 'service-settings.json', '/api/projects' => 'projects.json', '/api/products' => 'products.json',
        '/api/rules/previews' => 'rules-previews.json', '/api/pricing' => 'pricing.json', '/api/navigation' => 'navigation.json', '/api/templates' => 'templates.json'];
    if ($method === 'GET' && ($path === '/api/projects' || $path === '/api/portfolio/urls')) { // Our Work: shipped projects + Admin → Our Work (portfolio.php)
        require_once __DIR__ . '/portfolio.php';
        if ($path === '/api/projects') pf_public_projects();
        header('Cache-Control: public, max-age=300'); echo json_encode(['projects' => pf_urls()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit;
    }
    if (($method === 'GET' || $method === 'HEAD') && preg_match('#^/satin/(?:(?:fa|fr|es)/)?portfolio/projects/[a-z0-9-]{1,120}/?$#', $path)) { // project pages: admin-added (no static file) or shipped ones with the owner's renames applied
        require_once __DIR__ . '/portfolio.php';
        if (pf_page($path) || pf_static_page($path)) exit;
        http_response_code(404); header('Content-Type: text/html; charset=utf-8'); readfile(pf_docroot() . '/satin/404/index.html'); exit;
    }
    if ($method === 'GET') { // always live: admin changes, supplier price tables and built-in label products
        if ($path === '/api/products') json_out(cat_products_json());
        if ($path === '/api/rules/previews') json_out(cat_previews());
        if ($path === '/api/pricing') { require_once __DIR__ . '/estimator_pricing.php'; header('Cache-Control: public, max-age=60'); json_out(ep_public()); } // wrap estimator: Admin → Products & prices → Wrap estimator
    }
    if (isset($static[$path]) && $method === 'GET') data_file($static[$path]);

    if ($path === '/api/rules' && $method === 'GET') {
        if (isset($_GET['id'])) json_out(['rule' => rule_public(rule_by_id((string)$_GET['id']))]);
        $page = preg_replace('#/$#', '', preg_replace('#^/satin/(fa|fr|es)(?=/|$)#', '/satin', (string)($_GET['path'] ?? '')));
        if ($seed = cat_seed($page ?: '/')) json_out(['rule' => rule_public($seed['rule'])] + $seed); // live rule (admin changes + supplier price tables)
        $f = DATA . '/seeds/' . rawurlencode($page ?: '/') . '.json';
        if (is_file($f)) data_file('seeds/' . rawurlencode($page ?: '/') . '.json', 60);
        if ($seed = cat_seed($page ?: '/')) json_out(['rule' => rule_public($seed['rule'])] + $seed); // products without a pre-built seed (e.g. /satin/shop/products/*)
        json_out(['rule' => null]);
    }

    if ($path === '/api/rules/quote' && $method === 'POST') {
        same_origin();
        $v = body_json(20000);
        $rule = wrap_design_promo(rule_by_id((string)($v['id'] ?? '')));
        if (!$rule) json_out(['error' => 'Price rule not found.'], 404);
        $values = is_array($v['values'] ?? null) ? $v['values'] : [];
        try { $quote = calculate($rule, $values); }
        catch (FormulaError $e) { json_out(['error' => $e->getMessage()], 400); }
        $code = is_string($v['coupon'] ?? null) ? trim($v['coupon']) : '';
        if ($code !== '') { // discount codes managed in Admin → Coupons
            require_once __DIR__ . '/commerce.php';
            require_once __DIR__ . '/auth.php';
            if (rate_limited('quotecoupon:' . client_ip(), 120, 600)) json_out(['error' => 'Too many discount code attempts. Please wait a few minutes.'], 429);
            note_attempt('quotecoupon:' . client_ip());
            try { $quote = shop_coupon_quote($rule, $quote, $code); } catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
        }
        try { // push: someone priced a product (once per visitor + product a day)
            require_once __DIR__ . '/auth.php';
            $pk = 'pushquote:' . substr(hash('sha256', client_ip() . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? '') . '|' . $rule['id']), 0, 24);
            if (!preg_match('/bot|crawl|spider|headless|lighthouse/i', (string)($_SERVER['HTTP_USER_AGENT'] ?? '')) && !rate_limited($pk, 1, 86400)) {
                note_attempt($pk); require_once __DIR__ . '/push.php';
                $tot = $quote['total'] ?? $quote['price'] ?? null; $page = (string)($v['page'] ?? '');
                push_event('quotes', '💲 Price checked: ' . (string)($rule['name'] ?? $rule['id']), (is_numeric($tot) ? '$' . number_format((float)$tot / 100, 2) . ' CAD' : 'Instant price') . ($page !== '' ? ' · ' . mb_substr($page, 0, 80) : ''), '/admin/#/dashboard', 'quote-' . $rule['id']);
            }
        } catch (Throwable $e) {}
        json_out(['quote' => $quote]);
    }

    if ($path === '/api/promotions' && $method === 'GET') { header('Cache-Control: public, max-age=60'); json_out(promo_public()); }

    if ($path === '/api/site-content' && $method === 'GET') {
        $p = (string)($_GET['path'] ?? '');
        if (!preg_match('#^/satin(?:/[a-z0-9-]+)*/?$#', $p)) json_out(['error' => 'Invalid page'], 400);
        $p = rtrim($p, '/') ?: '/satin';
        $row = null;
        try { $q = db()->prepare('SELECT published, published_at FROM site_content WHERE path = ?'); $q->execute([$p]); $row = $q->fetch(); } catch (Throwable $e) { $row = null; }
        $c = $row && $row['published'] ? json_decode($row['published'], true) : null;
        if (!$c) json_out(['edits' => [], 'order' => [], 'fields' => [], 'blocks' => [], 'sections' => [], 'sectionOrder' => [], 'seo' => (object)[], 'revision' => 0, 'updatedAt' => null, 'catalog' => cat_listing_overlay()]);
        $c['fields'] = []; $c['order'] = []; $c['updatedAt'] = $row['published_at']; $c['catalog'] = cat_listing_overlay();
        json_out($c);
    }

    if ($path === '/api/vehicles' && $method === 'GET') {
        $idx = json_decode((string)file_get_contents(DATA . '/vehicle-index.json'), true);
        $make = (string)($_GET['make'] ?? ''); $year = (int)($_GET['year'] ?? 0);
        if ($make === '') json_out(['makes' => $idx['makes']]);
        if (!in_array($make, $idx['makes'], true) || $year < 1996 || $year > 2027) json_out(['error' => 'Choose make and year'], 400);
        $key = "vehicle_models:$make:$year";
        try {
            $q = db()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute([$key]);
            if ($row = $q->fetch()) json_out(json_decode($row['v'], true));
            $ctx = stream_context_create(['http' => ['timeout' => 8]]);
            $raw = @file_get_contents('https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/' . rawurlencode($make) . '/modelyear/' . $year . '?format=json', false, $ctx);
            if ($raw) {
                $models = [];
                foreach ((json_decode($raw, true)['Results'] ?? []) as $m) {
                    $mn = strtolower((string)($m['Make_Name'] ?? ''));
                    if ($mn === strtolower($make) || ($make === 'Mercedes-Benz' && str_contains($mn, 'mercedes')) || ($make === 'International' && str_contains($mn, 'international'))) $models[] = $m['Model_Name'];
                }
                $models = array_values(array_unique($models)); sort($models, SORT_STRING);
                if ($models) {
                    $val = ['models' => $models, 'source' => 'NHTSA vPIC', 'verifiedYear' => true];
                    db()->prepare('REPLACE INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute([$key, json_encode($val), now_iso()]);
                    json_out($val);
                }
            }
        } catch (Throwable $e) { }
        json_out(['models' => $idx['models'][$make] ?? [], 'source' => 'Satin model index', 'verifiedYear' => false]);
    }

    if ($path === '/api/apparel/photo' && $method === 'GET') {
        $variants = json_decode((string)file_get_contents(DATA . '/apparel-variants.json'), true);
        $colours = $variants[(string)($_GET['product'] ?? '')] ?? null; $i = (int)($_GET['colour'] ?? 0);
        $side = ($_GET['side'] ?? '') === 'back' ? 'back' : 'front';
        if (!$colours || !isset($colours[$i][$side])) { http_response_code(404); exit('Photo unavailable'); }
        header('Location: ' . $colours[$i][$side], true, 302); exit;
    }

    if ($path === '/api/booking-slots' && $method === 'GET') json_out(['slots' => booking_slots((string)($_GET['date'] ?? ''))]);

    // ---------- customer accounts: sign-in, My account (customer.php; separate from staff accounts) ----------
    if (str_starts_with($path, '/api/customer/')) { require_once __DIR__ . '/customer.php'; customer_route($path, $method); }

    if (preg_match('#^/([a-f0-9]{32})\.txt$#', $path, $km) && $method === 'GET') { // IndexNow key file (Admin → Business info & SEO)
        require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/site_api.php';
        if (seo_tools_get()['indexNowKey'] !== $km[1]) { http_response_code(404); header('Content-Type: text/plain'); exit('Not found'); }
        header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: public, max-age=3600'); exit($km[1]);
    }
    if ($path === '/sitemap.xml' && $method === 'GET') { require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/site_api.php'; sitemap_xml(); }
    if ($path === '/api/hello' && $method === 'POST') { // push: new visitor (once per visitor a day); stores only a hashed rate-limit key for 24 h
        $v = json_decode((string)file_get_contents('php://input', false, null, 0, 2000), true); $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
        require_once __DIR__ . '/auth.php';
        $staff = (bool)current_user() || (($v['staff'] ?? false) === true);
        if (is_array($v) && !$staff && !preg_match('/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|bingpreview|google-inspectiontool|ahrefs|semrush|python|curl|wget/i', $ua)) {
            try {
                require_once __DIR__ . '/auth.php';
                $hk = 'hello:' . substr(hash('sha256', client_ip() . '|' . $ua . '|' . gmdate('Y-m-d')), 0, 24);
                if (!rate_limited($hk, 1, 86400) && !rate_limited('hello-all', 300, 3600)) {
                    note_attempt($hk); note_attempt('hello-all');
                    require_once __DIR__ . '/invoices_api.php'; require_once __DIR__ . '/push.php';
                    $path = preg_match('#^/satin(?:/[a-z0-9-]+)*/?$#', (string)($v['path'] ?? '')) ? (string)$v['path'] : '/satin/';
                    $w = (int)($v['w'] ?? 0); $dev = $w > 0 ? ($w < 700 ? 'Mobile' : ($w < 1100 ? 'Tablet' : 'Desktop')) : (preg_match('/Mobi|Android|iPhone/i', $ua) ? 'Mobile' : 'Desktop');
                    $src = visit_source((string)($v['ref'] ?? '')); $utm = preg_replace('/[^A-Za-z0-9 _.-]/', '', (string)($v['utm'] ?? ''));
                    push_event('visits', '👀 New visitor from ' . ($utm !== '' ? $utm : $src), $path . ' · ' . $dev . ($src === 'Direct' ? ' · typed the address, bookmark or an app' : ''), '/admin/#/dashboard', 'visit-' . substr(hash('sha256', $hk), 0, 8));
                }
            } catch (Throwable $e) {}
        }
        http_response_code(204); exit;
    }
    if (str_starts_with($path, '/api/sign/')) { require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/esign.php'; esign_public_route($path, $method); } // e-sign signer page (/esign/)
    if ($path === '/api/fonts/ttf' && $method === 'GET') { require_once __DIR__ . '/fonts_ttf.php'; studio_font(); } // TrueType for vector PDFs (studio/vector.mjs)
    if ($path === '/api/feed/google.xml' && $method === 'GET') { require_once __DIR__ . '/merchant_feed.php'; merchant_feed(); } // Google Merchant Center product feed
    if ($path === '/api/feedback' && $method === 'POST') { require_once __DIR__ . '/feedback.php'; feedback_submit(); } // "How did you hear about us?" card
    if ($path === '/api/visit' && $method === 'POST') { require_once __DIR__ . '/invoices_api.php'; record_visit(); }
    if ($path === '/api/visit') { http_response_code(204); exit; }
    if ($path === '/api/invoice' && $method === 'GET') { require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/invoices_api.php'; public_invoice(); }
    if (str_starts_with($path, '/api/invoice/')) { require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/invoices_api.php'; public_invoice_route($path, $method); }

    if ($path === '/api/product-reviews') {
        if ($method === 'GET') {
            $q = db()->prepare('SELECT id,name,rating,body,created_at AS createdAt FROM product_reviews WHERE product_id = ? ORDER BY created_at DESC LIMIT 50');
            $q->execute([text($_GET['product'] ?? '', 80)]);
            json_out(['reviews' => $q->fetchAll()]);
        }
        json_out(['error' => 'Sign in to write a review.'], 401);
    }

    // ---------- requests ----------
    if ($path === '/api/quote-requests') {
        if ($method !== 'POST') json_out(['error' => 'Method not allowed'], 405);
        same_origin();
        $v = body_json(64000);
        $name = text($v['name'] ?? '', 120); $email = strtolower(text($v['email'] ?? '', 254)); $service = text($v['service'] ?? '', 120); $phone = text($v['phone'] ?? '', 40);
        if (!preg_match('/^[a-f0-9-]{36}$/i', (string)($v['id'] ?? '')) || mb_strlen($name) < 2 || !preg_match('/^\S+@\S+\.\S+$/', $email) || mb_strlen($phone) < 7 || !$service || ($v['consent'] ?? null) !== true || !empty($v['website']))
            json_out(['error' => 'Check your details and consent'], 400);
        if ((($v['designRequested'] ?? null) === true || preg_match('/design/i', $service)) && ($v['designTermsAccepted'] ?? null) !== true) json_out(['error' => 'Read and accept the design agreement'], 400);
        $attachments = [];
        if (!empty($v['attachments'])) {
            require_once __DIR__ . '/commerce.php';
            try { $attachments = shop_claim_attachments($v['attachments']); } catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
        }
        // Designs approved in Design Studio from this browser (vehicle wraps, apparel and other quoted items) travel with the request.
        if (!empty($_COOKIE['satin_studio'])) { require_once __DIR__ . '/commerce.php'; $attachments = array_merge($attachments, shop_session_design_files()); }
        $details = json_encode(['attachments' => $attachments, 'services' => [$service], 'notes' => text($v['notes'] ?? '', 2000), 'custom' => clean_custom($v['details'] ?? null),
            'designRequested' => ($v['designRequested'] ?? null) === true, 'designAgreementAcceptedAt' => ($v['designTermsAccepted'] ?? null) === true ? now_iso() : null,
            'estimate' => text($v['estimate'] ?? '', 5000), 'contactPreference' => text($v['contactPreference'] ?? '', 40)], JSON_UNESCAPED_UNICODE);
        [$ref, $st] = save_request((string)$v['id'], 'quote', $service, $name, $email, $phone, '', '', $details);
        if ($st === 409) json_out(['error' => 'Start a new request'], 409);
        if ($st === 429) json_out(['error' => 'Too many requests. Please wait or contact us.'], 429);
        json_out(['reference' => $ref], $st);
    }

    // Contact page form and the footer newsletter sign-up: saved like a quote request (Admin → Requests) and emailed to the owner.
    if ($path === '/api/contact') {
        if ($method !== 'POST') json_out(['error' => 'Method not allowed'], 405);
        same_origin();
        $v = body_json(16000);
        if (!empty($v['website'])) json_out(['error' => 'Invalid request'], 400); // honeypot
        $kind = ($v['kind'] ?? '') === 'newsletter' ? 'newsletter' : 'contact';
        $email = strtolower(text($v['email'] ?? '', 254)); $name = text($v['name'] ?? '', 120); $phone = text($v['phone'] ?? '', 40);
        $msg = text($v['message'] ?? '', 4000); $service = text($v['service'] ?? '', 120);
        if (!preg_match('/^[a-f0-9-]{36}$/i', (string)($v['id'] ?? '')) || !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email) || ($v['consent'] ?? null) !== true)
            json_out(['error' => 'Check your email address and consent.'], 400);
        if ($kind === 'contact' && (mb_strlen($name) < 2 || mb_strlen($msg) < 2)) json_out(['error' => 'Add your name and a message.'], 400);
        require_once __DIR__ . '/auth.php';
        $ipKey = 'contact:' . client_ip();
        if (rate_limited($ipKey, 8, 3600)) json_out(['error' => 'Too many messages. Please wait or call us.'], 429);
        note_attempt($ipKey);
        if ($kind === 'newsletter') { $service = 'Newsletter sign-up'; if ($name === '') $name = 'Newsletter subscriber'; $msg = 'Subscribe to news and offers (consent given on the website).'; }
        else $service = 'Contact: ' . ($service !== '' ? $service : 'General');
        $details = json_encode(['services' => [$service], 'notes' => $msg, 'source' => $kind], JSON_UNESCAPED_UNICODE);
        [$ref, $st] = save_request((string)$v['id'], 'quote', $service, $name, $email, $phone, '', '', $details);
        if ($st === 409) json_out(['error' => 'Please reload the page and try again.'], 409);
        if ($st === 429) json_out(['error' => 'Too many messages. Please wait or call us.'], 429);
        json_out(['reference' => $ref], $st);
    }

    // Track page: status of an order (SG-… order number) or a request (SG-… reference) — both reference AND email must match.
    if ($path === '/api/track') {
        if ($method !== 'POST') json_out(['error' => 'Method not allowed'], 405);
        same_origin();
        $v = body_json(2000);
        $ref = strtoupper(preg_replace('/\s+/', '', text($v['reference'] ?? '', 40))); $email = strtolower(text($v['email'] ?? '', 254));
        if (!preg_match('/^[A-Z0-9-]{4,30}$/', $ref) || !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) json_out(['error' => 'Enter your reference and email address.'], 400);
        require_once __DIR__ . '/auth.php';
        $ipKey = 'track:' . client_ip();
        if (rate_limited($ipKey, 20, 3600)) json_out(['error' => 'Too many attempts. Please wait or contact us.'], 429);
        note_attempt($ipKey);
        $pdo = db();
        try {
            require_once __DIR__ . '/commerce.php'; $sp = shop_db();
            $q = $sp->prepare('SELECT number, status, created_at FROM shop_orders WHERE UPPER(number) = ? AND LOWER(email) = ? LIMIT 1'); $q->execute([$ref, $email]);
            if ($o = $q->fetch()) {
                $label = ['awaiting_payment' => 'Waiting for payment', 'paid' => 'Paid — preparing your order', 'in_production' => 'In production', 'ready' => 'Ready for pickup / delivery', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'refunded' => 'Refunded'][$o['status']] ?? ucfirst(str_replace('_', ' ', (string)$o['status']));
                json_out(['type' => 'order', 'reference' => $o['number'], 'status' => $label, 'createdAt' => $o['created_at']]);
            }
        } catch (Throwable $e) { /* orders table not available */ }
        if (preg_match('/^SG-([A-F0-9]{8})$/', $ref, $m)) {
            $q = $pdo->prepare('SELECT id, service, status, created_at FROM service_requests WHERE UPPER(SUBSTR(id, 1, 8)) = ? AND LOWER(email) = ? LIMIT 1'); $q->execute([$m[1], $email]);
            if ($r = $q->fetch()) {
                $label = ['pending_confirmation' => 'Received — we will contact you shortly', 'contacted' => 'We have contacted you', 'quoted' => 'Quote sent', 'confirmed' => 'Confirmed', 'completed' => 'Completed', 'cancelled' => 'Cancelled'][$r['status']] ?? ucfirst((string)$r['status']);
                json_out(['type' => 'request', 'reference' => $ref, 'service' => $r['service'], 'status' => $label, 'createdAt' => $r['created_at']]);
            }
        }
        json_out(['error' => 'We could not find that reference with this email address. Check both, or contact us.'], 404);
    }

    if ($path === '/api/service-requests') {
        if ($method !== 'POST') json_out(['error' => 'Method not allowed'], 405);
        same_origin();
        $v = body_json(12000);
        $allowed = ['Auto Detailing', 'Interior Detailing', 'Exterior Detailing', 'Paint Correction', 'Ceramic Coating', 'Social Media Services', 'Videography'];
        $options = ['Interior detailing', 'Exterior detailing', 'Paint correction', 'Ceramic coating', 'Pet hair removal', 'Upholstery cleaning', 'Social strategy', 'Post design', 'Short-form video', 'Content calendar', 'Publishing support', 'Campaign creative', 'Brand film', 'Product video', 'Social clips', 'Event coverage', 'Editing', 'Captions'];
        if (!empty($v['website'])) json_out(['error' => 'Invalid request'], 400);
        if (!preg_match('/^[a-f0-9-]{36}$/i', (string)($v['id'] ?? '')) || !in_array($v['type'] ?? '', ['booking', 'quote'], true) || !in_array($v['service'] ?? '', $allowed, true) || ($v['consent'] ?? null) !== true)
            json_out(['error' => 'Check your request details and consent'], 400);
        $name = text($v['name'] ?? '', 120); $email = strtolower(text($v['email'] ?? '', 254)); $vehicle = text($v['vehicle'] ?? '', 120); $phone = text($v['phone'] ?? '', 40);
        if (mb_strlen($name) < 2 || !preg_match('/^\S+@\S+\.\S+$/', $email)) json_out(['error' => 'Add a valid name and email'], 400);
        $services = $v['services'] ?? null;
        if (!is_array($services) || count($services) < 1 || count($services) > 12 || array_diff($services, $options)) json_out(['error' => 'Select valid services'], 400);
        $fp = (string)($v['formPath'] ?? '');
        if (!$fp || !preg_match('#^/satin(?:/[a-z0-9-]+)*/?$#', $fp) || strlen($fp) >= 240) json_out(['error' => 'Invalid form page'], 400);
        $canonical = rtrim(preg_replace('#^/satin/(fa|fr|es)(?=/|$)#', '/satin', $fp), '/');
        $expected = ['Auto Detailing' => '/satin/auto-detailing', 'Interior Detailing' => '/satin/auto-detailing/interior-detailing', 'Exterior Detailing' => '/satin/auto-detailing/exterior-detailing', 'Paint Correction' => '/satin/auto-detailing/paint-correction', 'Ceramic Coating' => '/satin/auto-detailing/ceramic-coating', 'Social Media Services' => '/satin/social-media-services', 'Videography' => '/satin/videography'];
        if ($canonical !== ($v['type'] === 'booking' ? '/satin/auto-detailing/booking' : $expected[$v['service']])) json_out(['error' => 'Form does not match this service'], 400);
        $date = ''; $time = '';
        if ($v['type'] === 'booking') {
            $date = text($v['date'] ?? '', 10); $time = text($v['time'] ?? '', 5);
            if (!in_array($time, booking_slots($date), true)) json_out(['error' => 'This time is unavailable. Select another offered time.'], 400);
            if (!$vehicle) json_out(['error' => 'Choose a valid future date, time and vehicle'], 400);
        }
        $details = json_encode(['services' => array_values(array_unique($services)), 'vehicle' => $vehicle, 'vehicleSize' => text($v['vehicleSize'] ?? '', 40), 'plan' => text($v['plan'] ?? '', 100),
            'notes' => text($v['notes'] ?? '', 2000), 'custom' => clean_custom($v['custom'] ?? null), 'timezone' => 'America/Toronto'], JSON_UNESCAPED_UNICODE);
        [$ref, $st] = save_request((string)$v['id'], (string)$v['type'], (string)$v['service'], $name, $email, $phone, $date, $time, $details);
        if ($st === 409) json_out(['error' => 'Please start a new request'], 409);
        if ($st === 429) json_out(['error' => 'Too many requests. Please wait or contact us directly.'], 429);
        json_out(['reference' => $ref, 'status' => 'pending_confirmation'], $st);
    }

    // ---------- not yet migrated (studio, checkout, customer accounts, admin) ----------
    json_out(['error' => UNAVAILABLE], str_starts_with($path, '/api/') ? 503 : 404);
} catch (Throwable $e) {
    error_log('satin api: ' . $e->getMessage());
    json_out(['error' => 'Something went wrong. Please try again or contact info@satingraphic.ca.'], 500);
}
