<?php
declare(strict_types=1);
// Google Merchant Center product feed: GET /api/feed/google.xml (RSS 2.0 + g: namespace).
// Built from the live catalog (products.json + admin changes) so names, prices and hidden products stay in sync.
// Price = the product page's starting price at its default options (catalog.php cat_from_price), before HST.
// Services (installations, estimators, design work) are left out: Shopping ads only accept products.
// Cached in storage/merchant-feed.xml for 6 hours.

const MF_ORIGIN = 'https://satingraphic.ca';
const MF_INCLUDE = '#^/satin/(print-shop/(offset|large-format|labels)/[a-z0-9-]+|apparel/products/[a-z0-9-]+|wallpaper/(?!custom)[a-z0-9-]+|shop/vehicle-wrap-designs/[a-z0-9-]+|shop/vehicle-wrap-prints|shop/vehicle-templates/[a-z0-9-]+)/?$#';
const MF_GENERIC_IMG = ['home-video-poster', 'print-business-cards.png', 'og-default', 'logo'];

function mf_root(): string { static $r = null; return $r ?? ($r = is_dir(dirname(__DIR__) . '/public_html/satin') ? dirname(__DIR__) . '/public_html' : dirname(__DIR__) . '/new.satingraphic.ca'); }
function mf_page_file(string $path): string { return mf_root() . rtrim($path, '/') . '/index.html'; }
function mf_meta(string $html, string $attr, string $name): string {
    return preg_match('#<meta ' . $attr . '="' . preg_quote($name, '#') . '" content="([^"]*)"#', $html, $m) ? html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8') : '';
}
function mf_abs(string $u): string { return preg_match('#^https?://#', $u) ? $u : MF_ORIGIN . '/' . ltrim($u, '/'); }
function mf_generic(string $u): bool { foreach (MF_GENERIC_IMG as $g) if (strpos($u, $g) !== false) return true; return false; }

function mf_image(array $p, string $html): array {
    $path = rtrim((string)$p['path'], '/');
    $imgs = [];
    if (preg_match('#^/satin/shop/vehicle-wrap-designs/([a-z0-9-]+)$#', $path, $m)) {
        foreach (['hero', 'van', 'pickup', 'layout'] as $v) { $f = "/satin/img/wrap-designs/{$m[1]}/$v-1100.webp"; if (is_file(mf_root() . $f)) $imgs[] = $f; }
    }
    foreach ((array)($p['images'] ?? []) as $i) if (is_string($i) && $i !== '' && $i[0] === '/' && strpos($i, '?') === false) $imgs[] = $i;
    if (!$imgs && str_starts_with($path, '/satin/apparel/products/')) {
        static $var = null; if ($var === null) $var = json_decode((string)@file_get_contents(DATA . '/apparel-variants.json'), true) ?: [];
        foreach ((array)($var[$p['id']] ?? []) as $c) { if (!empty($c['front'])) { $imgs[] = $c['front']; if (count($imgs) >= 3) break; } }
    }
    if (!$imgs) { $og = mf_meta($html, 'property', 'og:image'); if ($og !== '' && !mf_generic($og)) $imgs[] = $og; }
    if (!$imgs && preg_match_all('#<img[^>]+src="(/(?:satin/img|apparel)/[^"?]+\.(?:jpe?g|png|webp))"#', $html, $m)) foreach ($m[1] as $i) if (!mf_generic($i)) { $imgs[] = $i; break; }
    // Google does not accept SVG: use a raster copy next to it (same name, .jpg/.png) or drop it
    $imgs = array_values(array_filter(array_map(function ($i) {
        if (!preg_match('#\.svg$#i', $i)) return $i;
        foreach (['jpg', 'png', 'webp'] as $x) { $r = preg_replace('#\.svg$#i', ".$x", $i); if (is_file(mf_root() . parse_url($r, PHP_URL_PATH))) return $r; }
        return null;
    }, $imgs)));
    return array_values(array_unique(array_map('mf_abs', $imgs)));
}

function mf_category(string $path): array {
    if (str_starts_with($path, '/satin/apparel/')) return ['Apparel & Accessories > Clothing', 'Custom apparel'];
    if (str_starts_with($path, '/satin/wallpaper/')) return ['Home & Garden > Decor > Wallpaper', 'Wallpaper'];
    if (str_starts_with($path, '/satin/shop/vehicle-wrap-designs/')) return ['Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor > Vehicle Decor > Vehicle Decals', 'Vehicle wrap designs'];
    if (str_starts_with($path, '/satin/shop/')) return ['Vehicles & Parts > Vehicle Parts & Accessories > Vehicle Maintenance, Care & Decor > Vehicle Decor > Vehicle Decals', 'Vehicle wraps'];
    if (str_starts_with($path, '/satin/print-shop/labels/')) return ['Office Supplies > General Office Supplies > Labels & Tags', 'Labels & stickers'];
    if (str_starts_with($path, '/satin/print-shop/large-format/')) return ['Business & Industrial > Signage', 'Signs & large format'];
    return ['Office Supplies > General Office Supplies > Paper Products', 'Printing'];
}

function mf_items(): array {
    $out = []; $hidden = cat_unavailable();
    foreach (cat_products() as $p) {
        $path = rtrim((string)($p['path'] ?? ''), '/') . '/';
        if (empty($p['active']) || !empty($p['_deleted']) || in_array(rtrim($path, '/'), $hidden, true) || in_array($path, $hidden, true)) continue;
        if (!preg_match(MF_INCLUDE, $path)) continue;
        $file = mf_page_file($path); if (!is_file($file)) continue;
        $html = (string)file_get_contents($file);
        if (preg_match('#<meta name="robots" content="noindex#', $html)) continue;
        $rule = cat_rule((string)($p['ruleId'] ?? '')); if (!$rule) continue;
        $vals = []; foreach ($rule['fields'] ?? [] as $f) $vals[$f['key']] = $f['default'];
        if (!empty($rule['quantityKeys'])) { $n = 0; foreach ($rule['quantityKeys'] as $k) $n += (float)($vals[$k] ?? 0); if ($n < 1) $vals[$rule['quantityKeys'][0]] = 1; }
        try { $c = calculate($rule, $vals); } catch (Throwable $e) { continue; }
        if ($c['subtotal'] <= 0) continue;
        $imgs = mf_image($p, $html); if (!$imgs) continue;
        $title = trim((string)($p['name'] ?? '')); if ($title === '') continue;
        $desc = trim((string)($p['description'] ?? '')) ?: mf_meta($html, 'name', 'description') ?: $title;
        [$gcat, $ptype] = mf_category($path);
        $it = ['id' => substr((string)$p['id'], 0, 50), 'title' => mb_substr($title, 0, 150), 'description' => mb_substr($desc, 0, 5000),
            'link' => MF_ORIGIN . $path, 'image_link' => $imgs[0], 'additional' => array_slice($imgs, 1, 10),
            'availability' => 'in_stock', 'condition' => 'new', 'brand' => 'Satin Graphic', 'identifier_exists' => 'no',
            'price' => number_format($c['subtotal'] / 100, 2, '.', '') . ' CAD', 'google_product_category' => $gcat, 'product_type' => $ptype];
        if ($c['discount'] > 0 && $c['net'] > 0) $it['sale_price'] = number_format($c['net'] / 100, 2, '.', '') . ' CAD';
        $out[] = $it;
    }
    return $out;
}

function mf_xml(array $items): string {
    $e = fn($s) => htmlspecialchars((string)$s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $x = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Satin Graphic</title><link>' . MF_ORIGIN . '/satin/</link><description>Satin Graphic products — printing, apparel, wallpaper and vehicle wrap designs</description>' . "\n";
    foreach ($items as $i) {
        $x .= '<item><g:id>' . $e($i['id']) . '</g:id><title>' . $e($i['title']) . '</title><description>' . $e($i['description']) . '</description><link>' . $e($i['link']) . '</link><g:image_link>' . $e($i['image_link']) . '</g:image_link>';
        foreach ($i['additional'] as $a) $x .= '<g:additional_image_link>' . $e($a) . '</g:additional_image_link>';
        foreach (['availability', 'condition', 'brand', 'identifier_exists', 'price', 'sale_price', 'google_product_category', 'product_type'] as $k) if (isset($i[$k])) $x .= "<g:$k>" . $e($i[$k]) . "</g:$k>";
        $x .= "</item>\n";
    }
    return $x . '</channel></rss>' . "\n";
}

function merchant_feed(): void {
    $cache = __DIR__ . '/storage/merchant-feed-v2.xml';
    if (!is_file($cache) || filemtime($cache) < time() - 6 * 3600) {
        $xml = mf_xml(mf_items());
        if (!is_dir(dirname($cache))) @mkdir(dirname($cache), 0755, true);
        @file_put_contents($cache . '.tmp', $xml) && @rename($cache . '.tmp', $cache);
    } else $xml = (string)file_get_contents($cache);
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo $xml; exit;
}
