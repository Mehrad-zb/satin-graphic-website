<?php
declare(strict_types=1);
// Product catalog: products, price rules (formulas) and categories.
// The built catalog lives in data/ (products.json, rules/*.json, seeds/*.json). Changes made in the admin are stored
// in SQLite (table catalog) and layered on top, so the original files are never modified.

function cat_db(): PDO {
    static $pdo = null; if ($pdo) return $pdo;
    $pdo = db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS catalog (kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT, PRIMARY KEY (kind, id))');
    $pdo->exec('CREATE TABLE IF NOT EXISTS catalog_history (n INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT, created_at TEXT NOT NULL, created_by TEXT)');
    return $pdo;
}
function cat_rows(string $kind): array {
    static $cache = [];
    if (!isset($cache[$kind])) {
        $cache[$kind] = [];
        try { $q = cat_db()->prepare('SELECT id, data FROM catalog WHERE kind = ?'); $q->execute([$kind]); foreach ($q->fetchAll() as $r) $cache[$kind][$r['id']] = json_decode($r['data'], true); }
        catch (Throwable $e) { }
    }
    return $cache[$kind];
}
function cat_has_changes(): bool { return (bool)(cat_rows('product') || cat_rows('rule')); }

/* ---------- reading ---------- */
function cat_file_products(): array {
    static $p = null; if ($p !== null) return $p;
    $raw = json_decode((string)@file_get_contents(DATA . '/products.json'), true) ?: [];
    $p = [];
    foreach ($raw['products'] ?? [] as $x) if (isset($x['id'])) $p[$x['id']] = isset($p[$x['id']]) ? array_merge($p[$x['id']], $x) : $x; // apparel rows appear twice: merge
    if (!function_exists('sp_label_products')) require_once __DIR__ . '/supplier_pricing.php';
    foreach (sp_label_products() as $id => $x) if (!isset($p[$id])) { unset($x['_builtin']); $p[$id] = $x; } // built-in label products (supplier_pricing.php)
    return $p;
}
function cat_file_unavailable(): array { return (json_decode((string)@file_get_contents(DATA . '/products.json'), true) ?: [])['unavailablePaths'] ?? []; }
function cat_file_rule(string $id): ?array {
    if (!preg_match('/^[a-z0-9-]{2,60}$/', $id)) return null;
    $f = DATA . "/rules/$id.json";
    if (!is_file($f)) { if (!function_exists('sp_label_rule')) require_once __DIR__ . '/supplier_pricing.php'; return sp_label_rule($id); }
    return json_decode((string)file_get_contents($f), true)['rule'] ?? null;
}
function cat_rule(string $id): ?array {
    if (!function_exists('sp_apply')) require_once __DIR__ . '/supplier_pricing.php';
    $o = cat_rows('rule')[$id] ?? null;
    // a site update that raises a rule file's updateVersion (new prices / options) replaces an older admin-saved copy
    if ($o && empty($o['_deleted']) && (float)(cat_file_rule($id)['updateVersion'] ?? 0) > (float)($o['updateVersion'] ?? 4)) $o = null;
    if ($o && empty($o['_deleted'])) return cat_with_turnaround(sp_apply($o)); // supplier cost tables (apparel, labels) set the prices
    return cat_with_turnaround(sp_apply(cat_file_rule($id)));
}
/** Standard production time shown (as text) in the order summary and on cart lines. No rush option: standard pricing. */
const CAT_TURNAROUND_PRINT = '7–10 business days', CAT_TURNAROUND_LARGE = '2–5 business days';
function cat_turnaround(string $path): string {
    if (str_starts_with($path, '/satin/print-shop/large-format/')) return CAT_TURNAROUND_LARGE;
    if (str_starts_with($path, '/satin/print-shop/')) return CAT_TURNAROUND_PRINT;
    return '';
}
function cat_with_turnaround(?array $rule): ?array {
    if (!$rule) return $rule;
    $t = cat_turnaround((string)($rule['path'] ?? ''));
    if ($t !== '') $rule['turnaround'] = $t;
    return $rule;
}
/** All products, with admin changes applied. Deleted custom products are left out. */
function cat_products(bool $withDeleted = false): array {
    $all = cat_file_products();
    foreach ($all as $id => $p) $all[$id]['_builtin'] = true;
    foreach (cat_rows('product') as $id => $o) {
        if (!empty($o['_deleted']) && !$withDeleted) { unset($all[$id]); continue; }
        $all[$id] = array_merge($all[$id] ?? [], $o);
    }
    return $all;
}
function cat_unavailable(): array {
    $u = cat_file_unavailable();
    foreach (cat_products(true) as $p) if (empty($p['active']) || !empty($p['_deleted'])) $u[] = $p['path'];
    return array_values(array_unique($u));
}
function cat_public(array $p): array { $o = $p; foreach (array_keys($o) as $k) if ($k !== '' && $k[0] === '_') unset($o[$k]); unset($o['cat']); return $o; }
function cat_seed(string $page): ?array {
    foreach (cat_products(true) as $p) if (($p['path'] ?? '') === $page) {
        $rule = cat_rule((string)($p['ruleId'] ?? ''));
        if (!$rule) return null;
        return ['rule' => $rule, 'configured' => cat_public($p), 'unavailablePaths' => cat_unavailable()];
    }
    return null;
}
function cat_products_json(): array {
    return ['products' => array_values(array_map('cat_public', array_filter(cat_products(), function ($p) { return empty($p['_deleted']); }))), 'unavailablePaths' => cat_unavailable()];
}
/** Price at the default choices (cents), or null when it can't be worked out. */
function cat_from_price(array $rule): ?int {
    $vals = [];
    foreach ($rule['fields'] ?? [] as $f) $vals[$f['key']] = $f['default'];
    if (!empty($rule['quantityKeys'])) { $n = 0; foreach ($rule['quantityKeys'] as $k) $n += (float)($vals[$k] ?? 0); if ($n < 1) $vals[$rule['quantityKeys'][0]] = 1; }
    try { return calculate($rule, $vals)['subtotal']; } catch (Throwable $e) { return null; }
}
/** Small summary of admin changes for listing pages (names, photos, hidden products). */
function cat_listing_overlay(): array {
    if (!cat_has_changes()) return [];
    $file = cat_file_products(); $out = [];
    foreach (cat_products(true) as $id => $p) {
        $f = $file[$id] ?? null; $o = cat_rows('product')[$id] ?? null;
        if (!$o) continue;
        $x = ['path' => $p['path']];
        if ($f && ($f['name'] ?? '') !== ($p['name'] ?? '')) { $x['name'] = $p['name']; $x['was'] = $f['name']; }
        if ($f && ($p['images'][0] ?? '') !== ($f['images'][0] ?? '') && !empty($p['images'][0])) { $x['image'] = $p['images'][0]; }
        if (empty($p['active']) || !empty($p['_deleted'])) $x['hidden'] = true;
        if (count($x) > 1) $out[] = $x;
    }
    return $out;
}
function cat_previews(): array {
    $raw = json_decode((string)@file_get_contents(DATA . '/rules-previews.json'), true) ?: ['previews' => []];
    $rules = cat_rows('rule');
    foreach ($raw['previews'] as &$pv) if (isset($rules[$pv['id']])) { $r = cat_rule($pv['id']); $v = $r ? cat_from_price($r) : null; if ($v !== null) $pv['subtotal'] = $v; }
    unset($pv);
    if (!function_exists('sp_label_products')) require_once __DIR__ . '/supplier_pricing.php';
    foreach (sp_label_products() as $p) { $r = cat_rule($p['ruleId']); $v = $r ? cat_from_price($r) : null; $q = 0; foreach ($r['fields'] ?? [] as $f) if ($f['key'] === 'quantity') $q = $f['default'];
        if ($v !== null) $raw['previews'][] = ['id' => $p['ruleId'], 'path' => $p['path'], 'quantity' => $q, 'subtotal' => $v]; }
    return $raw;
}

/* ---------- categories ---------- */
const CAT_DEFAULTS = [
    ['offset', 'Offset printing', '/satin/print-shop/offset'], ['large-format', 'Large format printing', '/satin/print-shop/large-format'], ['print', 'Print shop', '/satin/print-shop'],
    ['apparel', 'Apparel', '/satin/apparel'], ['ppf', 'Paint protection film', '/satin/vehicle-wraps/paint-protection-film'], ['wraps', 'Vehicle wraps', '/satin/vehicle-wraps'],
    ['wrap-designs', 'Wrap designs', '/satin/shop/vehicle-wrap-designs'], ['materials', 'Wrap materials', '/satin/shop/products'], ['wallpaper', 'Wallpaper', '/satin/wallpaper'],
    ['window-graphics', 'Window graphics', '/satin/window-graphics'], ['window-tint', 'Window tint', '/satin/window-tint'], ['services', 'Services & other', '/satin'],
];
function cat_categories(): array {
    $saved = cat_rows('category')['all'] ?? null;
    if (is_array($saved) && $saved) return $saved;
    $o = []; foreach (CAT_DEFAULTS as $i => [$id, $name, $path]) $o[] = ['id' => $id, 'name' => $name, 'path' => $path, 'description' => '', 'image' => '', 'sort' => $i];
    return $o;
}
function cat_default_category(array $p): string {
    $path = (string)($p['path'] ?? '');
    foreach (CAT_DEFAULTS as [$id, , $prefix]) if ($prefix !== '/satin' && ($path === $prefix || str_starts_with($path, $prefix . '/'))) return $id;
    if (str_starts_with((string)($p['ruleId'] ?? ''), 'wrap-')) return 'wraps';
    return 'services';
}
function cat_category_of(array $p, array $cats): string {
    $c = (string)($p['cat'] ?? '');
    foreach ($cats as $x) if ($x['id'] === $c) return $c;
    $d = cat_default_category($p);
    foreach ($cats as $x) if ($x['id'] === $d) return $d;
    return $cats ? $cats[count($cats) - 1]['id'] : 'services';
}

/* ---------- validation ---------- */
function cat_num($v, float $a, float $b): ?float { if (is_bool($v) || !is_numeric($v)) return null; $n = (float)$v; return is_finite($n) && $n >= $a && $n <= $b ? $n : null; }
function cat_str($v, int $max): string { return is_string($v) || is_numeric($v) ? mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string)$v)), 0, $max) : ''; }
function cat_clean_rule(array $r, string $id): array {
    $err = function ($m) { json_out(['error' => $m], 400); };
    $o = ['id' => $id, 'label' => cat_str($r['label'] ?? '', 120), 'path' => (string)($r['path'] ?? '')];
    if (!preg_match('#^/satin(/[a-z0-9-]+)*$#', $o['path'])) $err('The page address of the price rule is not valid.');
    $fields = is_array($r['fields'] ?? null) ? array_values($r['fields']) : [];
    if (count($fields) > 30) $err('Use at most 30 fields.');
    $keys = []; $o['fields'] = [];
    foreach ($fields as $f) {
        if (!is_array($f)) continue;
        $k = (string)($f['key'] ?? '');
        if (!preg_match('/^[a-z][a-z0-9_]{0,39}$/', $k)) $err('Field key "' . $k . '" must start with a letter and use only a-z, 0-9 and _.');
        if (isset($keys[$k])) $err('The field key "' . $k . '" is used twice.');
        $keys[$k] = 1;
        $t = in_array($f['type'] ?? '', ['number', 'select', 'checkbox'], true) ? $f['type'] : 'number';
        $x = ['key' => $k, 'label' => cat_str($f['label'] ?? $k, 120) ?: $k, 'type' => $t];
        if ($t === 'number') {
            $x['min'] = cat_num($f['min'] ?? 0, -1e7, 1e7) ?? 0; $x['max'] = cat_num($f['max'] ?? 100, -1e7, 1e7) ?? 100; $x['step'] = cat_num($f['step'] ?? 1, 0.0001, 1e6) ?? 1;
            if ($x['max'] < $x['min']) $err('"' . $x['label'] . '": maximum is smaller than minimum.');
            $x['default'] = cat_num($f['default'] ?? $x['min'], $x['min'], $x['max']) ?? $x['min'];
            $q = ($x['default'] - $x['min']) / $x['step']; if (abs($q - round($q)) > 0.00001) $x['default'] = $x['min'];
        } elseif ($t === 'select') {
            $x['options'] = [];
            foreach (array_slice(is_array($f['options'] ?? null) ? $f['options'] : [], 0, 60) as $op) {
                if (!is_array($op)) continue; $v = cat_num($op['value'] ?? null, -1e7, 1e7); if ($v === null) $err('"' . $x['label'] . '": every option needs a number value.');
                $x['options'][] = ['label' => cat_str($op['label'] ?? (string)$v, 120) ?: (string)$v, 'value' => $v + 0];
            }
            if (!$x['options']) $err('"' . $x['label'] . '" needs at least one option.');
            $vals = array_column($x['options'], 'value');
            $d = cat_num($f['default'] ?? null, -1e7, 1e7); $x['default'] = $d !== null && in_array($d, array_map('floatval', $vals), false) ? $d + 0 : $vals[0];
        } else $x['default'] = !empty($f['default']) ? 1 : 0;
        foreach (['help', 'unit', 'group', 'maxNote'] as $extra) if (isset($f[$extra]) && cat_str($f[$extra], 200) !== '') $x[$extra] = cat_str($f[$extra], 200);
        foreach ($f as $fk => $fv) if (!isset($x[$fk]) && in_array($fk, ['hidden', 'size', 'quantity'], true) && (is_bool($fv) || is_numeric($fv) || is_string($fv))) $x[$fk] = is_string($fv) ? cat_str($fv, 80) : $fv;
        $o['fields'][] = $x;
    }
    $o['constants'] = []; $o['constantLabels'] = [];
    $consts = is_array($r['constants'] ?? null) ? $r['constants'] : [];
    if (count($consts) > 120) $err('Use at most 120 price values.');
    foreach ($consts as $k => $v) {
        if (!preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/', (string)$k)) $err('Price value name "' . $k . '" must start with a letter and use only letters, numbers and _.');
        if (isset($keys[$k])) $err('"' . $k . '" is used both as a field and as a price value.');
        $n = cat_num($v, -1e8, 1e8); if ($n === null) $err('Price value "' . $k . '" must be a number.');
        $o['constants'][$k] = $n + 0;
    }
    foreach ((is_array($r['constantLabels'] ?? null) ? $r['constantLabels'] : []) as $k => $v) if (isset($o['constants'][$k]) && cat_str($v, 160) !== '') $o['constantLabels'][$k] = cat_str($v, 160);
    if (!$o['constantLabels']) unset($o['constantLabels']);
    $o['formula'] = trim((string)($r['formula'] ?? ''));
    if ($o['formula'] === '') $err('Add a price formula.');
    if (strlen($o['formula']) > 6000) $err('The formula is too long.');
    $dt = fn_pct_fixed($r['deposit'] ?? null, 100); $o['deposit'] = $dt;
    $o['discount'] = fn_pct_fixed($r['discount'] ?? null, 0);
    $o['taxPercent'] = cat_num($r['taxPercent'] ?? 13, 0, 30) ?? 13;
    if (!empty($r['priceOnRequest'])) $o['priceOnRequest'] = true;
    if (cat_str($r['priceNote'] ?? '', 400) !== '') $o['priceNote'] = cat_str($r['priceNote'], 400);
    if (!empty($r['artworkOptional'])) $o['artworkOptional'] = true;
    if (is_array($r['priceRanges'] ?? null)) { $o['priceRanges'] = []; foreach (array_slice($r['priceRanges'], 0, 30) as $pr) if (is_array($pr) && cat_str($pr['label'] ?? '', 120) !== '') $o['priceRanges'][] = ['label' => cat_str($pr['label'], 120), 'min' => cat_num($pr['min'] ?? 0, 0, 1e7) ?? 0, 'max' => cat_num($pr['max'] ?? 0, 0, 1e7) ?? 0]; if (!$o['priceRanges']) unset($o['priceRanges']); }
    if (is_array($r['quantityKeys'] ?? null)) { $qk = array_values(array_filter($r['quantityKeys'], function ($k) use ($keys) { return is_string($k) && isset($keys[$k]); })); if ($qk) $o['quantityKeys'] = $qk; }
    if (is_array($r['limits'] ?? null)) { $lim = []; foreach (array_slice($r['limits'], 0, 10) as $x) if (is_array($x) && isset($keys[$x['field'] ?? '']) && is_numeric($x['max'] ?? null)) { $w = []; foreach ((array)($x['when'] ?? []) as $wk => $wv) if (isset($keys[$wk]) && is_numeric($wv)) $w[$wk] = $wv + 0; $lim[] = ['field' => (string)$x['field'], 'max' => $x['max'] + 0, 'when' => $w, 'message' => cat_str($x['message'] ?? '', 200)]; } if ($lim) $o['limits'] = $lim; } // conditional maximums (formula.php formula_limits)
    if (is_array($r['sizePresets'] ?? null)) { $sp = []; foreach (array_slice($r['sizePresets'], 0, 12) as $x) if (is_array($x) && count($x) === 2 && is_numeric($x[0]) && is_numeric($x[1])) $sp[] = [$x[0] + 0, $x[1] + 0]; if ($sp) $o['sizePresets'] = $sp; } // quick size buttons above width / height
    foreach (['pricingVersion', 'customSizeValue', 'updateVersion'] as $k) if (isset($r[$k]) && (is_numeric($r[$k]) || is_string($r[$k]))) $o[$k] = is_numeric($r[$k]) ? $r[$k] + 0 : cat_str($r[$k], 60);
    // the formula must work with the default choices
    try { $vals = []; foreach ($o['fields'] as $f) $vals[$f['key']] = $f['default']; if (!empty($o['quantityKeys'])) $vals[$o['quantityKeys'][0]] = max(1, $vals[$o['quantityKeys'][0]] ?? 0); calculate($o + ['revision' => 0], $vals); }
    catch (FormulaError $e) { $err('Formula: ' . $e->getMessage()); }
    catch (Throwable $e) { $err('Formula could not be checked: ' . $e->getMessage()); }
    return $o;
}
function fn_pct_fixed($v, float $def): array {
    $t = is_array($v) && in_array($v['type'] ?? '', ['percent', 'fixed'], true) ? $v['type'] : 'percent';
    $n = is_array($v) ? cat_num($v['value'] ?? $def, 0, $t === 'percent' ? 100 : 1e7) : null;
    return ['type' => $t, 'value' => $n ?? $def];
}
function cat_clean_images($v): array {
    $o = [];
    foreach (array_slice(is_array($v) ? $v : [], 0, 20) as $u) { $u = is_string($u) ? trim($u) : ''; if (preg_match('#^/[^\s"\'<>\\\\]{1,500}$#', $u) && strpos($u, '//') !== 0) $o[] = $u; elseif (preg_match('#^https://[^\s"\'<>]{3,500}$#', $u)) $o[] = $u; }
    return $o;
}

/* ---------- writing ---------- */
function cat_put(string $kind, string $id, ?array $data, array $u): void {
    $pdo = cat_db(); $now = now_iso();
    $q = $pdo->prepare('SELECT data FROM catalog WHERE kind = ? AND id = ?'); $q->execute([$kind, $id]); $old = $q->fetch();
    $pdo->prepare('INSERT INTO catalog_history (kind,id,data,created_at,created_by) VALUES (?,?,?,?,?)')->execute([$kind, $id, $old ? $old['data'] : null, $now, $u['name']]);
    $pdo->prepare('DELETE FROM catalog_history WHERE kind = ? AND id = ? AND n NOT IN (SELECT n FROM catalog_history WHERE kind = ? AND id = ? ORDER BY n DESC LIMIT 30)')->execute([$kind, $id, $kind, $id]);
    if ($data === null) $pdo->prepare('DELETE FROM catalog WHERE kind = ? AND id = ?')->execute([$kind, $id]);
    else $pdo->prepare('INSERT OR REPLACE INTO catalog (kind,id,data,updated_at,updated_by) VALUES (?,?,?,?,?)')->execute([$kind, $id, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $now, $u['name']]);
}
function cat_summary(array $p, array $cats): array {
    $rule = cat_rule((string)($p['ruleId'] ?? ''));
    $o = cat_rows('product')[$p['id']] ?? null; $ro = $rule ? (cat_rows('rule')[$rule['id']] ?? null) : null;
    return ['id' => $p['id'], 'name' => $p['name'] ?? $p['id'], 'path' => $p['path'] ?? '', 'image' => $p['images'][0] ?? '', 'active' => !empty($p['active']) && empty($p['_deleted']),
        'cat' => cat_category_of($p, $cats), 'sub' => $p['category'] ?? '', 'ruleId' => $p['ruleId'] ?? '', 'from' => $rule ? cat_from_price($rule) : null, 'onRequest' => !empty($rule['priceOnRequest']),
        'fields' => $rule ? count($rule['fields'] ?? []) : 0, 'custom' => empty($p['_builtin']), 'changed' => (bool)($o || $ro), 'updatedAt' => $p['_updatedAt'] ?? null];
}
/** Copy a product page so a new product gets its own address. */
function cat_copy_page(string $from, string $to, string $name, string $desc): bool {
    if (!function_exists('page_file')) require_once __DIR__ . '/site_api.php';
    $src = (string)@file_get_contents(page_file($from));
    if ($src === '') return false;
    $dir = docroot() . $to;
    if (file_exists($dir)) return false;
    $h = $src; $t = attr($name); $url = attr(site_url() . $to . '/');
    $h = preg_replace('#<title>.*?</title>#s', "<title>$t | Satin Graphic</title>", $h, 1);
    $h = preg_replace('#(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*(")#', '${1}' . $t . '${2}', $h);
    if ($desc !== '') $h = preg_replace('#(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")#', '${1}' . attr($desc) . '${2}', $h);
    $h = preg_replace('#(<link rel="canonical" href=")[^"]*(")#', '${1}' . $url . '${2}', $h);
    $h = preg_replace('#(<meta property="og:url" content=")[^"]*(")#', '${1}' . $url . '${2}', $h);
    $h = preg_replace('#<link rel="alternate" hreflang[^>]*>#', '', $h);
    $h = preg_replace('#<script type="application/ld\+json"[^>]*>.*?</script>#s', '', $h);
    $h = preg_replace('#<script type="application/json" data-pricing-bootstrap[^>]*>.*?</script>#s', '', $h); // the page loads its live price rule instead
    $h = preg_replace('#data-prerender-path="[^"]*"#', 'data-prerender-path="' . attr(substr($to, strlen('/satin')) ?: '/') . '"', $h, 1);
    $h = preg_replace('#(<h1\b[^>]*>).*?(</h1>)#s', '${1}' . $t . '${2}', $h, 1);
    $h = preg_replace('#(<span aria-current="page">).*?(</span>)#s', '${1}' . $t . '${2}', $h, 1);
    if (!@mkdir($dir, 0755, true)) return false;
    return atomic_write($dir . '/index.html', $h);
}

/* ---------- admin routes (/api/admin/catalog/...) ---------- */
function catalog_route(string $r, string $method): void {
    if (!function_exists('page_file')) require_once __DIR__ . '/site_api.php';
    if (str_starts_with($r, '/catalog/supplier')) { if (!function_exists('sp_route')) require_once __DIR__ . '/supplier_pricing.php'; sp_route($r, $method); json_out(['error' => 'Not found'], 404); }
    if ($r === '/catalog' && $method === 'GET') {
        require_user('pricing.edit');
        $cats = cat_categories(); $list = [];
        foreach (cat_products() as $p) $list[] = cat_summary($p, $cats);
        usort($list, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
        json_out(['products' => $list, 'categories' => $cats]);
    }
    if ($r === '/catalog/product' && $method === 'GET') {
        require_user('pricing.edit');
        $id = (string)($_GET['id'] ?? ''); $all = cat_products(); $p = $all[$id] ?? null;
        if (!$p) json_out(['error' => 'Product not found.'], 404);
        $rule = cat_rule((string)($p['ruleId'] ?? ''));
        $orig = cat_file_products()[$id] ?? null; $origRule = $rule ? cat_file_rule($rule['id']) : null;
        $users = []; foreach ($all as $x) if (($x['ruleId'] ?? '') === ($p['ruleId'] ?? '') && $x['id'] !== $id) $users[] = $x['name'];
        $q = cat_db()->prepare("SELECT n, kind, created_at, created_by FROM catalog_history WHERE (kind = 'product' AND id = ?) OR (kind = 'rule' AND id = ?) ORDER BY n DESC LIMIT 20"); $q->execute([$id, $p['ruleId'] ?? '']);
        json_out(['product' => cat_public($p) + ['cat' => cat_category_of($p, cat_categories()), 'custom' => empty($p['_builtin']), 'digitalFileId' => (string)($p['_digitalFileId'] ?? '')], 'rule' => $rule, 'categories' => cat_categories(),
            'hasOriginal' => (bool)$orig, 'changed' => isset(cat_rows('product')[$id]) || ($rule && isset(cat_rows('rule')[$rule['id']])), 'origRule' => $origRule ? true : false, 'sharedWith' => $users, 'history' => $q->fetchAll()]);
    }
    if ($r === '/catalog/test' && $method === 'POST') {
        require_user('pricing.edit');
        $v = body_json(200000);
        $rule = is_array($v['rule'] ?? null) ? $v['rule'] : [];
        try {
            if (($rule['formula'] ?? '') === '') throw new FormulaError('Add a price formula.');
            $rule += ['id' => 'test', 'fields' => [], 'constants' => []];
            json_out(['quote' => calculate($rule, is_array($v['values'] ?? null) ? $v['values'] : [])]);
        } catch (FormulaError $e) { json_out(['error' => $e->getMessage()], 400); }
        catch (Throwable $e) { json_out(['error' => 'Check the formula and fields.'], 400); }
    }
    if ($r === '/catalog/save' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(400000);
        $id = (string)($v['id'] ?? ''); $all = cat_products(true); $p = $all[$id] ?? null;
        if (!$p) json_out(['error' => 'Product not found.'], 404);
        $in = is_array($v['product'] ?? null) ? $v['product'] : [];
        $np = ['name' => cat_str($in['name'] ?? $p['name'], 160), 'description' => cat_str($in['description'] ?? ($p['description'] ?? ''), 4000), 'active' => !empty($in['active']),
            'images' => cat_clean_images($in['images'] ?? ($p['images'] ?? [])), 'cat' => preg_match('/^[a-z0-9-]{1,40}$/', (string)($in['cat'] ?? '')) ? $in['cat'] : cat_default_category($p)];
        if (mb_strlen($np['name']) < 2) json_out(['error' => 'Add the product name.'], 400);
        if (isset($in['priceNote'])) $np['priceNote'] = cat_str($in['priceNote'], 300);
        if (isset($in['sku'])) $np['sku'] = cat_str($in['sku'], 60);
        if (isset($in['tags']) && is_array($in['tags'])) $np['tags'] = array_values(array_filter(array_map(function ($t) { return cat_str($t, 40); }, array_slice($in['tags'], 0, 20))));
        if (str_starts_with((string)($p['ruleId'] ?? ''), 'design-')) { // wrap designs: download file + the delivered-files list shown on the product page
            if (isset($in['deliveryFiles']) && is_array($in['deliveryFiles'])) $np['deliveryFiles'] = array_values(array_filter(array_map(function ($t) { return cat_str($t, 160); }, array_slice($in['deliveryFiles'], 0, 20))));
            if (array_key_exists('digitalFileId', $in)) {
                $fid = (string)$in['digitalFileId'];
                if ($fid === '') { $np['_digitalFileId'] = ''; $np['digitalFileName'] = ''; }
                else {
                    require_once __DIR__ . '/commerce.php';
                    $f = shop_file($fid);
                    if (!$f || $f['kind'] !== 'template') json_out(['error' => 'Upload the design file again.'], 400);
                    $np['_digitalFileId'] = $f['id']; $np['digitalFileName'] = $f['name'];
                }
            }
        }
        if (array_key_exists('templates', $in) && is_array($in['templates'])) { $np['templates'] = []; foreach (array_slice($in['templates'], 0, 20) as $t) if (is_array($t) && ($u2 = cat_clean_images([$t['url'] ?? ''])[0] ?? null)) $np['templates'][] = ['label' => cat_str($t['label'] ?? 'Template', 120), 'url' => $u2]; }
        $prev = cat_rows('product')[$id] ?? [];
        $data = array_merge($prev, $np); unset($data['_deleted']);
        $data['_updatedAt'] = now_iso();
        if (empty($p['_builtin'])) $data = array_merge($p, $data); // custom product: the row is the whole product
        // price rule
        $ruleSaved = false;
        if (is_array($v['rule'] ?? null)) {
            $rid = (string)($p['ruleId'] ?? '');
            $cur = cat_rule($rid);
            if (!$cur) json_out(['error' => 'Price rule not found.'], 404);
            $exp = $v['expectedRevision'] ?? null;
            if ($exp !== null && (int)$exp !== (int)($cur['revision'] ?? 0)) json_out(['error' => 'Someone else changed these prices a moment ago. Reload to see their version.'], 409);
            $rule = cat_clean_rule($v['rule'] + ['path' => $cur['path']], $rid);
            $rule['revision'] = (int)($cur['revision'] ?? 0) + 1;
            if (json_encode(array_diff_key($rule, ['revision' => 1])) !== json_encode(array_diff_key(cat_clean_rule($cur, $rid), ['revision' => 1]))) { cat_put('rule', $rid, $rule, $u); $ruleSaved = true; }
        }
        cat_put('product', $id, $data, $u);
        audit($u, 'catalog: saved product', $np['name'] . ($ruleSaved ? ' (prices changed)' : ''));
        json_out(['ok' => true]);
    }
    if ($r === '/catalog/create' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(8000);
        $all = cat_products(true);
        $src = $all[(string)($v['copyFrom'] ?? '')] ?? null;
        if (!$src) json_out(['error' => 'Choose a product to start from.'], 400);
        $name = cat_str($v['name'] ?? '', 160); if (mb_strlen($name) < 2) json_out(['error' => 'Add the product name.'], 400);
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(cat_str($v['slug'] ?? '', 80) ?: $name)), '-');
        if ($slug === '' || strlen($slug) > 60) json_out(['error' => 'Choose a shorter web address.'], 400);
        $parent = preg_replace('#/[^/]+$#', '', (string)$src['path']);
        $path = $parent . '/' . $slug;
        if (!preg_match('#^/satin(/[a-z0-9-]+){1,8}$#', $path)) json_out(['error' => 'The web address is not valid.'], 400);
        foreach ($all as $x) if (($x['path'] ?? '') === $path || $x['id'] === $slug) json_out(['error' => 'A product with this address already exists.'], 409);
        if (file_exists(page_file($path))) json_out(['error' => 'A page with this address already exists.'], 409);
        $rid = 'c-' . substr($slug, 0, 50);
        if (cat_rule($rid)) $rid = 'c-' . substr($slug, 0, 44) . '-' . substr(bin2hex(random_bytes(3)), 0, 5);
        $srcRule = cat_rule((string)$src['ruleId']); if (!$srcRule) json_out(['error' => 'The source product has no price rule.'], 400);
        $rule = array_merge($srcRule, ['id' => $rid, 'label' => $name, 'path' => $path, 'revision' => 1]);
        if (!cat_copy_page((string)$src['path'], $path, $name, cat_str($v['description'] ?? '', 300))) json_out(['error' => 'Could not create the product page on the server.'], 500);
        $prod = cat_public($src);
        $prod = array_merge($prod, ['id' => $slug, 'name' => $name, 'path' => $path, 'ruleId' => $rid, 'studioProductId' => $prod['studioProductId'] ?? '', 'active' => !empty($v['active']), 'description' => cat_str($v['description'] ?? '', 4000),
            'cat' => preg_match('/^[a-z0-9-]{1,40}$/', (string)($v['cat'] ?? '')) ? $v['cat'] : cat_default_category($src), '_updatedAt' => now_iso(), '_createdFrom' => $src['id']]);
        cat_put('rule', $rid, $rule, $u);
        cat_put('product', $slug, $prod, $u);
        audit($u, 'catalog: created product', $name . ' (' . $path . ')');
        json_out(['ok' => true, 'id' => $slug, 'path' => $path]);
    }
    if ($r === '/catalog/delete' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(2000); $id = (string)($v['id'] ?? ''); $all = cat_products(true); $p = $all[$id] ?? null;
        if (!$p) json_out(['error' => 'Product not found.'], 404);
        if (!empty($p['_builtin'])) { cat_put('product', $id, array_merge(cat_rows('product')[$id] ?? [], ['active' => false, '_updatedAt' => now_iso()]), $u); audit($u, 'catalog: hid product', $p['name']); json_out(['ok' => true, 'hidden' => true]); }
        cat_put('product', $id, array_merge(cat_public($p), ['_deleted' => true, 'active' => false, '_updatedAt' => now_iso()]), $u);
        audit($u, 'catalog: deleted product', $p['name']);
        json_out(['ok' => true]);
    }
    if ($r === '/catalog/reset' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(2000); $id = (string)($v['id'] ?? ''); $p = cat_products(true)[$id] ?? null;
        if (!$p || !empty($v['what']) && !in_array($v['what'], ['product', 'rule', 'all'], true)) json_out(['error' => 'Product not found.'], 404);
        $what = $v['what'] ?? 'all';
        if (empty($p['_builtin'])) json_out(['error' => 'This product was made in the admin — there is no original to go back to.'], 400);
        if (in_array($what, ['product', 'all'], true) && isset(cat_rows('product')[$id])) cat_put('product', $id, null, $u);
        if (in_array($what, ['rule', 'all'], true) && isset(cat_rows('rule')[$p['ruleId']]) && cat_file_rule((string)$p['ruleId'])) cat_put('rule', (string)$p['ruleId'], null, $u);
        audit($u, 'catalog: restored original', $p['name']);
        json_out(['ok' => true]);
    }
    if ($r === '/catalog/restore' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(2000); $n = (int)($v['n'] ?? 0);
        $q = cat_db()->prepare('SELECT * FROM catalog_history WHERE n = ?'); $q->execute([$n]); $h = $q->fetch();
        if (!$h) json_out(['error' => 'Version not found.'], 404);
        $d = $h['data'] !== null ? json_decode($h['data'], true) : null;
        if ($h['kind'] === 'rule' && $d) { $cur = cat_rule($h['id']); $d['revision'] = (int)($cur['revision'] ?? 0) + 1; }
        cat_put($h['kind'], $h['id'], $d, $u);
        audit($u, 'catalog: restored a previous version', $h['kind'] . ' ' . $h['id']);
        json_out(['ok' => true]);
    }
    if ($r === '/catalog/categories' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(60000); $out = []; $seen = [];
        foreach (array_slice(is_array($v['categories'] ?? null) ? $v['categories'] : [], 0, 80) as $i => $c) {
            if (!is_array($c)) continue;
            $name = cat_str($c['name'] ?? '', 80); if ($name === '') continue;
            $id = (string)($c['id'] ?? ''); if (!preg_match('/^[a-z0-9-]{1,40}$/', $id)) $id = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-') ?: 'cat';
            $base = substr($id, 0, 36); $k = 2; while (isset($seen[$id])) $id = $base . '-' . $k++;
            $seen[$id] = 1;
            $path = (string)($c['path'] ?? ''); if (!preg_match('#^/satin(/[a-z0-9-]+)*$#', $path)) $path = '';
            $out[] = ['id' => $id, 'name' => $name, 'path' => $path, 'description' => cat_str($c['description'] ?? '', 400), 'image' => cat_clean_images([$c['image'] ?? ''])[0] ?? '', 'sort' => $i];
        }
        if (!$out) json_out(['error' => 'Keep at least one category.'], 400);
        cat_put('category', 'all', $out, $u);
        // products in a removed category move to the last one
        audit($u, 'catalog: saved categories', count($out) . ' categories');
        json_out(['ok' => true, 'categories' => $out]);
    }
    if ($r === '/catalog/move' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(60000); $cat = (string)($v['cat'] ?? '');
        if (!preg_match('/^[a-z0-9-]{1,40}$/', $cat)) json_out(['error' => 'Choose a category.'], 400);
        $all = cat_products(true); $n = 0;
        foreach (array_slice(is_array($v['ids'] ?? null) ? $v['ids'] : [], 0, 500) as $id) {
            if (!is_string($id) || !isset($all[$id])) continue;
            $row = cat_rows('product')[$id] ?? (empty($all[$id]['_builtin']) ? cat_public($all[$id]) : []);
            $row['cat'] = $cat; $row['_updatedAt'] = now_iso(); cat_put('product', $id, $row, $u); $n++;
        }
        audit($u, 'catalog: moved products', "$n to $cat");
        json_out(['ok' => true, 'moved' => $n]);
    }
    if ($r === '/catalog/bulk' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(60000); $all = cat_products(true); $n = 0;
        $act = in_array($v['action'] ?? '', ['show', 'hide'], true) ? $v['action'] : null; if (!$act) json_out(['error' => 'Unknown action.'], 400);
        foreach (array_slice(is_array($v['ids'] ?? null) ? $v['ids'] : [], 0, 500) as $id) {
            if (!is_string($id) || !isset($all[$id])) continue;
            $row = cat_rows('product')[$id] ?? (empty($all[$id]['_builtin']) ? cat_public($all[$id]) : []);
            $row['active'] = $act === 'show'; $row['_updatedAt'] = now_iso(); cat_put('product', $id, $row, $u); $n++;
        }
        audit($u, 'catalog: ' . ($act === 'show' ? 'showed' : 'hid') . ' products', (string)$n);
        json_out(['ok' => true, 'changed' => $n]);
    }
    if ($r === '/catalog/export' && $method === 'GET') {
        require_user('pricing.edit');
        $cats = cat_categories(); $rows = [];
        foreach (cat_products() as $p) { $s = cat_summary($p, $cats); $rule = cat_rule((string)$p['ruleId']); $rows[] = $s + ['description' => $p['description'] ?? '', 'constants' => $rule['constants'] ?? [], 'formula' => $rule['formula'] ?? '']; }
        json_out(['products' => $rows, 'categories' => $cats]);
    }
    if ($r === '/catalog/prices' && $method === 'POST') {
        // bulk price import: [{id, constants:{name:value}}]
        $u = require_user('pricing.edit');
        $v = body_json(1000000); $all = cat_products(); $res = ['updated' => 0, 'skipped' => 0, 'errors' => []];
        foreach (array_slice(is_array($v['rows'] ?? null) ? $v['rows'] : [], 0, 2000) as $i => $row) {
            if (!is_array($row) || !isset($all[(string)($row['id'] ?? '')])) { $res['errors'][] = ['line' => $row['_line'] ?? $i + 2, 'error' => 'Unknown product id']; continue; }
            $p = $all[$row['id']]; $rule = cat_rule((string)$p['ruleId']); if (!$rule) { $res['skipped']++; continue; }
            $new = $rule; $ch = false;
            foreach ((is_array($row['constants'] ?? null) ? $row['constants'] : []) as $k => $val) {
                if (!array_key_exists($k, $rule['constants'] ?? [])) { $res['errors'][] = ['line' => $row['_line'] ?? $i + 2, 'error' => "Unknown price value $k"]; continue; }
                $n2 = cat_num($val, -1e8, 1e8); if ($n2 === null) { $res['errors'][] = ['line' => $row['_line'] ?? $i + 2, 'error' => "$k is not a number"]; continue; }
                if ((float)$rule['constants'][$k] !== $n2) { $new['constants'][$k] = $n2 + 0; $ch = true; }
            }
            if (!$ch) { $res['skipped']++; continue; }
            if (cat_from_price($new) === null && cat_from_price($rule) !== null) { $res['errors'][] = ['line' => $row['_line'] ?? $i + 2, 'error' => 'The formula fails with these values']; continue; }
            $clean = $new;
            $clean['revision'] = (int)($rule['revision'] ?? 0) + 1;
            if (empty($v['dryRun'])) cat_put('rule', $rule['id'], $clean, $u);
            $res['updated']++;
        }
        if (empty($v['dryRun'])) audit($u, 'catalog: imported prices', $res['updated'] . ' products');
        $res['errors'] = array_slice($res['errors'], 0, 200);
        json_out($res);
    }
    json_out(['error' => 'Not found'], 404);
}

/* ---------- home page promotions (banner slider) ---------- */
const PROMO_DEFAULTS = [
    ['eyebrow' => 'Price estimator', 'title' => 'What will your wrap cost?', 'text' => 'Before anything else, see a ballpark price for wrapping your vehicle. Pick the vehicle, coverage and finish — it takes under a minute.', 'button' => 'Open the price estimator', 'link' => '/satin/vehicle-wraps/estimator', 'image' => '/satin/img/sprinter-wrapped.optimized.webp', 'bg' => '#17191e', 'ink' => '#ffffff', 'active' => true],
    ['eyebrow' => 'Print shop', 'title' => 'Business cards from $26.', 'text' => 'Premium stocks, printed in Vaughan. Choose the paper, sides and quantity and see your price live.', 'button' => 'Design your cards', 'link' => '/satin/print-shop/offset/business-cards', 'image' => '/satin/img/print-business-cards.optimized.webp', 'bg' => '#f3e9ee', 'ink' => '#17191e', 'active' => true],
    ['eyebrow' => 'Custom apparel', 'title' => 'Your logo on every shirt.', 'text' => 'T-shirts, hoodies, hats and workwear — upload your logo and preview it before you order.', 'button' => 'Shop apparel', 'link' => '/satin/apparel', 'image' => '/satin/img/satin-shirt-logo.webp', 'bg' => '#e9eef5', 'ink' => '#17191e', 'active' => true],
];
function promo_settings(): array {
    $s = cat_rows('setting')['promotions'] ?? null;
    return is_array($s) ? $s : ['slides' => PROMO_DEFAULTS, 'interval' => 6, 'autoplay' => true];
}
function promo_public(): array {
    $s = promo_settings(); $today = gmdate('Y-m-d'); $out = [];
    foreach ($s['slides'] as $sl) {
        if (empty($sl['active'])) continue;
        if (!empty($sl['start']) && $sl['start'] > $today) continue;
        if (!empty($sl['end']) && $sl['end'] < $today) continue;
        $x = $sl; unset($x['active'], $x['start'], $x['end']); $out[] = $x;
    }
    return ['slides' => $out, 'interval' => $s['interval'] ?? 6, 'autoplay' => $s['autoplay'] ?? true];
}
function promo_route(string $r, string $method): void {
    if ($r === '/promotions' && $method === 'GET') { require_user('site.edit'); json_out(promo_settings() + ['defaults' => PROMO_DEFAULTS]); }
    if ($r === '/promotions' && $method === 'POST') {
        $u = require_user('site.edit');
        $v = body_json(200000); $slides = [];
        foreach (array_slice(is_array($v['slides'] ?? null) ? $v['slides'] : [], 0, 12) as $sl) {
            if (!is_array($sl)) continue;
            $c = function ($k, $max) use ($sl) { return cat_str($sl[$k] ?? '', $max); };
            $link = trim((string)($sl['link'] ?? ''));
            if ($link !== '' && !preg_match('#^(/satin(/[A-Za-z0-9._~%!$&\'()*+,;=:@/?#-]*)?|https://[^\s"<>]{3,500})$#', $link)) json_out(['error' => 'Links must start with /satin or https://'], 400);
            $img = cat_clean_images([$sl['image'] ?? ''])[0] ?? '';
            $col = function ($k, $d) use ($sl) { $x = (string)($sl[$k] ?? ''); return preg_match('/^#[0-9a-fA-F]{6}$/', $x) ? $x : $d; };
            $date = function ($k) use ($sl) { $x = (string)($sl[$k] ?? ''); return preg_match('/^\d{4}-\d{2}-\d{2}$/', $x) ? $x : ''; };
            $x = ['eyebrow' => $c('eyebrow', 60), 'title' => $c('title', 140), 'text' => $c('text', 400), 'button' => $c('button', 60), 'link' => $link, 'image' => $img, 'bg' => $col('bg', '#17191e'), 'ink' => $col('ink', '#ffffff'), 'active' => !empty($sl['active']), 'start' => $date('start'), 'end' => $date('end')];
            if ($x['title'] === '' && $x['image'] === '') continue;
            $slides[] = $x;
        }
        $data = ['slides' => $slides, 'interval' => max(3, min(30, (int)($v['interval'] ?? 6))), 'autoplay' => !empty($v['autoplay'])];
        cat_put('setting', 'promotions', $data, $u);
        audit($u, 'saved home banner', count($slides) . ' slides');
        json_out(['ok' => true] + $data);
    }
}
