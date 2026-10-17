<?php
declare(strict_types=1);
// Our Work (portfolio) manager.
//  * The shipped projects (data/projects.json, built from the old portfolio) stay read-only files. Admin → Our Work can
//    add new projects (photos uploaded here, resized to WebP) and change the categories/tags of shipped projects; both
//    are stored in the portfolio_items table (kind 'custom' or 'override') and merged into GET /api/projects, which the
//    public portfolio pages (cms/portfolio.mjs) render from.
//  * New projects have no prerendered HTML: /satin/[lang/]portfolio/projects/<slug>/ is answered by pf_page() (from
//    api.php via .htaccess, or notfound.php), which serves the portfolio page template with the project rendered into
//    <main> and its own title/description/canonical/JSON-LD. The dynamic sitemap (site_api.php) lists them.

const PF_SERVICES = [
    'full-wrap' => 'Full wrap', 'partial-wrap' => 'Partial wrap', 'colour-change' => 'Colour change', 'commercial' => 'Commercial / fleet',
    'lettering' => 'Lettering & decals', 'ppf' => 'Paint protection film', 'window-tint' => 'Window tint', 'wallpaper' => 'Wallpaper',
    'window-graphics' => 'Window graphics', 'print' => 'Print', 'apparel' => 'Apparel', 'signage' => 'Signage',
];
const PF_VEHICLES = [
    'car' => 'Car', 'suv' => 'SUV', 'van' => 'Van', 'minivan' => 'Mini Van', 'truck' => 'Truck', 'trailer' => 'Trailer', 'bus' => 'Bus',
    'boat' => 'Boat', 'motorcycle' => 'Motorcycle', 'building' => 'Building / storefront', 'other' => 'Other',
];
const PF_FINISHES = [
    'gloss' => 'Gloss', 'matte' => 'Matte', 'satin' => 'Satin', 'metallic' => 'Metallic', 'chrome' => 'Chrome', 'colour-shift' => 'Colour shift',
    'carbon' => 'Carbon fibre', 'printed' => 'Printed graphics', 'clear' => 'Clear / PPF',
];
const PF_IMG_DIR = '/satin/portfolio/images/u';

function pf_docroot(): string { return (string)(cfg('docroot') ?: (is_dir(dirname(__DIR__) . '/public_html/satin') ? dirname(__DIR__) . '/public_html' : dirname(__DIR__) . '/new.satingraphic.ca')); }
function pf_db(): PDO {
    static $done = false; $pdo = db(); if ($done) return $pdo; $done = true;
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite')
        $pdo->exec('CREATE TABLE IF NOT EXISTS portfolio_items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT)');
    else
        $pdo->exec('CREATE TABLE IF NOT EXISTS portfolio_items (id CHAR(36) PRIMARY KEY, kind VARCHAR(10) NOT NULL, slug VARCHAR(120) NOT NULL UNIQUE, status VARCHAR(12) NOT NULL, data MEDIUMTEXT NOT NULL, created_at VARCHAR(30) NOT NULL, updated_at VARCHAR(30) NOT NULL, updated_by VARCHAR(120)) DEFAULT CHARSET=utf8mb4');
    return $pdo;
}
function pf_static(): array {
    static $p = null;
    if ($p === null) { $d = json_decode((string)@file_get_contents(DATA . '/projects.json'), true); $p = is_array($d['projects'] ?? null) ? $d['projects'] : []; }
    return $p;
}
function pf_rows(): array {
    $o = [];
    foreach (pf_db()->query('SELECT * FROM portfolio_items')->fetchAll() as $r) { $r['data'] = json_decode((string)$r['data'], true) ?: []; $o[] = $r; }
    return $o;
}
function pf_slugify(string $s): string { $s = strtolower(trim((string)preg_replace('/[^A-Za-z0-9]+/', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: ''), '-')); return substr($s, 0, 80); }
function pf_list(array $v, array $allowed, int $max = 12): array { $o = []; foreach (is_array($v) ? array_slice($v, 0, 30) : [] as $x) if (is_string($x) && isset($allowed[$x]) && !in_array($x, $o, true)) $o[] = $x; return array_slice($o, 0, $max); }
function pf_tags($v): array { $o = []; foreach (is_array($v) ? array_slice($v, 0, 30) : [] as $t) { $t = text($t, 40); if ($t !== '' && !in_array(mb_strtolower($t), array_map('mb_strtolower', $o), true)) $o[] = $t; } return array_slice($o, 0, 20); }

/** Taxonomy of a shipped project, derived from its old fields (category / vehicle / coverage). */
function pf_derive(array $p): array {
    $s = [];
    if (($p['category'] ?? '') === 'colour') { $s[] = 'colour-change'; $s[] = 'full-wrap'; }
    else {
        $s[] = 'commercial';
        $cov = $p['coverage'] ?? '';
        if ($cov === 'Full Wrap') $s[] = 'full-wrap'; elseif ($cov === 'Partial Wrap' || $cov === 'Channel Wrap') $s[] = 'partial-wrap'; elseif ($cov === 'Decal') $s[] = 'lettering';
    }
    $veh = ['Van' => 'van', 'Truck' => 'truck', 'Mini Van' => 'minivan', 'Trailer' => 'trailer', 'SUV' => 'suv', 'Sedan' => 'car', 'Other' => 'other'];
    return ['services' => $s, 'vehicleType' => $veh[$p['vehicle'] ?? ''] ?? (($p['category'] ?? '') === 'colour' ? 'car' : ''), 'finishes' => []];
}
function pf_category(array $services): string {
    if (in_array('colour-change', $services, true)) return 'colour';
    return array_intersect($services, ['commercial', 'lettering', 'full-wrap', 'partial-wrap']) ? 'commercial' : 'other';
}
/** Public record of an admin-made project (same shape as data/projects.json plus the taxonomy). */
function pf_custom_record(array $r): array {
    $d = $r['data'];
    $images = array_values(array_filter(is_array($d['images'] ?? null) ? $d['images'] : [], fn($i) => is_array($i) && is_string($i['src'] ?? null)));
    $ci = (int)($d['cover'] ?? 0); if (!isset($images[$ci])) $ci = 0;
    $services = $d['services'] ?? []; $veh = (string)($d['vehicleType'] ?? ''); $fin = $d['finishes'] ?? [];
    $model = trim(implode(' ', array_filter([(string)($d['year'] ?? ''), (string)($d['make'] ?? ''), (string)($d['model'] ?? '')])));
    $cov = in_array('full-wrap', $services, true) ? 'Full Wrap' : (in_array('partial-wrap', $services, true) ? 'Partial Wrap' : (in_array('lettering', $services, true) ? 'Decal' : ''));
    $tags = array_merge(array_map(fn($s) => PF_SERVICES[$s], $services), $veh !== '' ? [PF_VEHICLES[$veh]] : [], array_map(fn($f) => PF_FINISHES[$f], $fin), $d['tags'] ?? []);
    return ['id' => $r['id'], 'slug' => $r['slug'], 'title' => (string)($d['title'] ?? ''), 'category' => pf_category($services), 'vehicle' => $veh !== '' ? PF_VEHICLES[$veh] : '',
        'industry' => (string)($d['industry'] ?? ''), 'coverage' => $cov, 'model' => $model, 'modelName' => (string)($d['model'] ?? ''), 'make' => (string)($d['make'] ?? ''), 'year' => (string)($d['year'] ?? ''),
        'client' => (string)($d['client'] ?? ''), 'description' => (string)($d['description'] ?? ''), 'tags' => array_values(array_unique($tags)),
        'images' => $images, 'cover' => $images[$ci] ?? null, 'services' => $services, 'vehicleType' => $veh, 'finishes' => $fin, 'featured' => !empty($d['featured']),
        'custom' => true, 'createdAt' => $r['created_at'], 'updatedAt' => $r['updated_at']];
}
/** Shipped project with the admin's category/tag changes applied. */
function pf_static_record(array $p, ?array $ov): array {
    $p += pf_derive($p) + ['featured' => false];
    if ($ov) {
        $d = $ov['data'];
        foreach (['services', 'finishes'] as $k) if (is_array($d[$k] ?? null)) $p[$k] = $d[$k];
        if (isset($d['vehicleType']) && is_string($d['vehicleType'])) { $p['vehicleType'] = $d['vehicleType']; if ($d['vehicleType'] !== '' && isset(PF_VEHICLES[$d['vehicleType']])) $p['vehicle'] = PF_VEHICLES[$d['vehicleType']]; }
        if (is_array($d['tags'] ?? null)) $p['tags'] = array_values(array_unique(array_merge(array_map(fn($s) => PF_SERVICES[$s] ?? $s, $p['services']), $p['vehicle'] ? [$p['vehicle']] : [], array_map(fn($f) => PF_FINISHES[$f] ?? $f, $p['finishes']), $d['tags'])));
        if (($d['description'] ?? '') !== '') $p['description'] = (string)$d['description'];
        if (($d['title'] ?? '') !== '') $p['title'] = (string)$d['title'];   // owner's rename of a shipped project
        if (isset($d['model']) && is_string($d['model'])) $p['model'] = $d['model'];
        $p['featured'] = !empty($d['featured']);
        if (!empty($d['hidden'])) $p['hidden'] = true;
        if (is_array($d['images'] ?? null) && $d['images']) { $p['images'] = $d['images']; $ci = (int)($d['cover'] ?? 0); $p['cover'] = $d['images'][$ci] ?? $d['images'][0]; $p['photosEdited'] = true; }
    }
    return $p;
}
/** All projects for the public site (or, with $admin, every project including drafts and hidden ones). */
function pf_all(bool $admin = false): array {
    $rows = pf_rows(); $ov = []; $custom = [];
    foreach ($rows as $r) { if ($r['kind'] === 'override') $ov[$r['slug']] = $r; elseif ($admin || $r['status'] === 'published') $custom[] = $r; }
    usort($custom, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));
    $out = [];
    foreach ($custom as $r) { $x = pf_custom_record($r); if (!$x['images'] && !$admin) continue; if ($admin) $x['status'] = $r['status']; $out[] = $x; }
    foreach (pf_static() as $p) {
        $x = pf_static_record($p, $ov[$p['slug']] ?? null);
        if (!empty($x['hidden']) && !$admin) continue;
        if ($admin) { $x['status'] = 'published'; $x['overridden'] = isset($ov[$p['slug']]); }
        $out[] = $x;
    }
    // featured projects first, otherwise newest admin projects, then the shipped order
    $i = 0; foreach ($out as &$x) $x['_o'] = $i++; unset($x);
    usort($out, fn($a, $b) => [empty($a['featured']), $a['_o']] <=> [empty($b['featured']), $b['_o']]);
    foreach ($out as &$x) unset($x['_o']); unset($x);
    return $out;
}
function pf_public_projects(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    echo json_encode(['projects' => pf_all()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit;
}
/** Published admin-made project pages, for the sitemap and the build (GET /api/portfolio/urls). */
function pf_urls(): array {
    $o = [];
    foreach (pf_rows() as $r) if ($r['kind'] === 'custom' && $r['status'] === 'published' && !empty($r['data']['images']))
        $o[] = ['slug' => $r['slug'], 'path' => '/satin/portfolio/projects/' . $r['slug'] . '/', 'title' => (string)($r['data']['title'] ?? ''), 'updatedAt' => $r['updated_at']];
    return $o;
}

/* ---------------- dynamic project page ---------------- */
function pf_h(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
/** Serves /satin/[lang/]portfolio/projects/<slug>/ for an admin-made project. Returns false when there is no such project. */
function pf_page(string $path): bool {
    if (!preg_match('#^/satin(?:/(fa|fr|es))?/portfolio/projects/([a-z0-9-]{1,120})/?$#', $path, $m)) return false;
    $lang = $m[1] ?? ''; $slug = $m[2];
    try { $p = null; foreach (pf_all() as $x) if ($x['slug'] === $slug && (!empty($x['custom']) || !empty($x['photosEdited']))) { $p = $x + ['description' => '', 'client' => '', 'industry' => '', 'model' => '', 'vehicle' => '', 'tags' => [], 'services' => [], 'finishes' => []]; break; } } catch (Throwable $e) { return false; }
    if (!$p) return false;
    $root = pf_docroot(); $tplFile = $root . '/satin' . ($lang ? '/' . $lang : '') . '/portfolio/index.html';
    if (!is_file($tplFile)) $tplFile = $root . '/satin/portfolio/index.html';
    $html = (string)@file_get_contents($tplFile);
    if ($html === '' || strpos($html, '</main>') === false) return false;
    $host = 'https://' . preg_replace('/[^A-Za-z0-9.:-]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'new.satingraphic.ca'));
    $base = '/satin' . ($lang ? '/' . $lang : '');
    $url = $host . $base . '/portfolio/projects/' . $slug . '/';
    $svc = implode(', ', array_map(fn($s) => PF_SERVICES[$s], $p['services']));
    $title = $p['title'] . ($svc ? ' · ' . (PF_SERVICES[$p['services'][0]] ?? '') : '') . ' | Satin Graphic';
    $desc = $p['description'] !== '' ? mb_substr(preg_replace('/\s+/', ' ', $p['description']), 0, 300)
        : $p['title'] . ' — ' . ($svc ?: 'project') . ' by Satin Auto Wrap / Satin Graphic in Vaughan, Ontario.' . ($p['model'] ? ' ' . $p['model'] . '.' : '');
    $cover = $p['cover'] ?? ($p['images'][0] ?? null); $img = $cover ? $host . $cover['src'] : '';
    // head: title, description, canonical, Open Graph / Twitter
    $html = preg_replace('#<title>.*?</title>#s', '<title>' . pf_h($title) . '</title>', $html, 1);
    $set = function (string $re, string $val) use (&$html) { $html = preg_replace_callback($re, fn($mm) => $mm[1] . pf_h($val) . $mm[2], $html, 1); };
    $set('#(<meta name="description" content=")[^"]*(")#', $desc);
    $set('#(<link rel="canonical" href=")[^"]*(")#', $url);
    $set('#(<meta property="og:url" content=")[^"]*(")#', $url);
    $set('#(<meta property="og:title" content=")[^"]*(")#', $title);
    $set('#(<meta property="og:description" content=")[^"]*(")#', $desc);
    $set('#(<meta name="twitter:title" content=")[^"]*(")#', $title);
    $set('#(<meta name="twitter:description" content=")[^"]*(")#', $desc);
    if ($img) { $set('#(<meta property="og:image" content=")[^"]*(")#', $img); $set('#(<meta name="twitter:image" content=")[^"]*(")#', $img); }
    $html = preg_replace('#<link rel="alternate" hreflang=[^>]*>#', '', $html); // translated copies are not separate pages
    // JSON-LD: keep the business node, replace the page nodes
    $html = preg_replace_callback('#(<script type="application/ld\+json" id="page-schema">)(.*?)(</script>)#s', function ($mm) use ($p, $url, $desc, $host, $base) {
        $j = json_decode($mm[2], true); if (!is_array($j)) return $mm[0];
        $g = array_values(array_filter($j['@graph'] ?? [], function ($n) { $t = (array)($n['@type'] ?? []); return !array_intersect($t, ['BreadcrumbList', 'CollectionPage', 'CreativeWork', 'ItemList', 'WebPage']); }));
        $g[] = ['@type' => 'BreadcrumbList', 'itemListElement' => [['@type' => 'ListItem', 'position' => 1, 'name' => 'Satin Graphic', 'item' => $host . $base . '/'], ['@type' => 'ListItem', 'position' => 2, 'name' => 'Our work', 'item' => $host . $base . '/portfolio/'], ['@type' => 'ListItem', 'position' => 3, 'name' => $p['title'], 'item' => $url]]];
        $g[] = ['@type' => 'CreativeWork', 'name' => $p['title'], 'description' => $desc, 'url' => $url, 'creator' => ['@type' => 'Organization', 'name' => 'Satin Auto Wrap'], 'keywords' => implode(', ', $p['tags']),
            'image' => array_map(fn($i) => ['@type' => 'ImageObject', 'contentUrl' => $host . $i['src'], 'caption' => $i['alt'] ?? '', 'width' => $i['width'] ?? null, 'height' => $i['height'] ?? null], $p['images'])];
        $j['@graph'] = $g;
        return $mm[1] . str_replace('</', '<\/', json_encode($j, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)) . $mm[3];
    }, $html, 1);
    // body: the project rendered into <main> (the page script renders the same project from /api/projects)
    $html = preg_replace('#<section class="sec tight" data-cms-section="(?:sprojects|srelated)">.*?</section>#s', '', $html);
    $html = preg_replace('#<style>\.proj-index\{.*?</style>#s', '', $html);
    $dl = [['Vehicle', trim($p['vehicle'] . ($p['model'] ? ' · ' . $p['model'] : ''))], ['Services', $svc], ['Finish', implode(', ', array_map(fn($f) => PF_FINISHES[$f], $p['finishes']))], ['Industry', $p['industry']], ['Client', $p['client']], ['Photos', (string)count($p['images'])]];
    $main = '<div class="page-enter"><section class="portfolio-project-hero"><div class="wrap"><nav class="portfolio-crumbs" aria-label="Breadcrumb"><a href="' . $base . '/">Satin Graphic</a><span>/</span><a href="' . $base . '/portfolio/">Our work</a><span>/</span><span>' . pf_h($p['title']) . '</span></nav>'
        . '<div class="portfolio-project-top"><div><span class="eyebrow">' . pf_h(PF_SERVICES[$p['services'][0] ?? ''] ?? 'Our work') . '</span><h1>' . pf_h($p['title']) . '</h1><p>' . pf_h($desc) . '</p><div class="portfolio-tags">' . implode('', array_map(fn($t) => '<span>' . pf_h($t) . '</span>', $p['tags'])) . '</div></div><a class="btn" href="' . $base . '/contact/">Discuss a similar project</a></div>'
        . ($cover ? '<figure><img src="' . pf_h($cover['src']) . '" alt="' . pf_h($cover['alt'] ?? $p['title']) . '" width="' . (int)($cover['width'] ?? 0) . '" height="' . (int)($cover['height'] ?? 0) . '" fetchpriority="high"></figure>' : '') . '</div></section>'
        . '<section class="portfolio-project-details"><div class="wrap"><h2>Project details</h2><dl>' . implode('', array_map(fn($r) => $r[1] !== '' ? '<div><dt>' . $r[0] . '</dt><dd>' . pf_h($r[1]) . '</dd></div>' : '', $dl)) . '</dl>'
        . '<div class="portfolio-project-photos">' . implode('', array_map(fn($i, $n) => '<figure><a href="' . pf_h($i['src']) . '" target="_blank" rel="noopener"><img src="' . pf_h($i['src']) . '" alt="' . pf_h($i['alt'] ?? '') . '" width="' . (int)($i['width'] ?? 0) . '" height="' . (int)($i['height'] ?? 0) . '" loading="lazy"></a><figcaption>Photo ' . ($n + 1) . ' · ' . pf_h($p['title']) . '</figcaption></figure>', $p['images'], array_keys($p['images']))) . '</div>'
        . '<a href="' . $base . '/portfolio/" class="btn ghost">Back to all work</a></div></section></div>';
    $html = preg_replace_callback('#(<main\b[^>]*>).*?(</main>)#s', fn($mm) => $mm[1] . $main . $mm[2], $html, 1);
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    echo $html;
    return true;
}

/* ---------------- images ---------------- */
function pf_save_webp($im, int $w, int $h, int $max, string $file, int $q): array {
    $sc = min(1, $max / max($w, $h)); $nw = max(1, (int)round($w * $sc)); $nh = max(1, (int)round($h * $sc));
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255)); // photos: flatten any transparency on white
    imagecopyresampled($dst, $im, 0, 0, 0, 0, $nw, $nh, $w, $h);
    $ok = imagewebp($dst, $file, $q); imagedestroy($dst);
    if (!$ok) json_out(['error' => 'Could not save the image.'], 500);
    return [$nw, $nh];
}
function pf_upload(array $u): void {
    if (rate_limited('pf-upload:' . $u['id'], 300, 3600)) json_out(['error' => 'Too many uploads. Try again later.'], 429);
    note_attempt('pf-upload:' . $u['id']);
    $f = $_FILES['file'] ?? null;
    if (!$f || !is_array($f) || is_array($f['error'] ?? null) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) json_out(['error' => 'Upload failed. The photo may be larger than the server accepts (' . ini_get('upload_max_filesize') . ').'], 400);
    if ((int)$f['size'] > 25 * 1024 * 1024) json_out(['error' => 'Photos must be under 25 MB.'], 400);
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) json_out(['error' => 'Use JPG, PNG or WebP photos.'], 400);
    [$w, $h] = $info;
    if ($w < 200 || $h < 200 || $w * $h > 60000000) json_out(['error' => 'Use a photo between 200 px and 60 megapixels.'], 400);
    if (!function_exists('imagewebp')) json_out(['error' => 'The server cannot convert images (GD with WebP is missing).'], 500);
    @ini_set('memory_limit', '768M');
    $im = $info[2] === IMAGETYPE_JPEG ? @imagecreatefromjpeg($f['tmp_name']) : ($info[2] === IMAGETYPE_PNG ? @imagecreatefrompng($f['tmp_name']) : @imagecreatefromwebp($f['tmp_name']));
    if (!$im) json_out(['error' => 'This photo could not be read.'], 400);
    // phone photos: apply the EXIF rotation
    if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
        $o = (int)(@exif_read_data($f['tmp_name'])['Orientation'] ?? 1);
        $deg = [3 => 180, 6 => -90, 8 => 90][$o] ?? 0;
        if ($deg) { $r = imagerotate($im, $deg, 0); if ($r) { imagedestroy($im); $im = $r; [$w, $h] = [imagesx($im), imagesy($im)]; } }
    }
    $sub = PF_IMG_DIR . '/' . gmdate('Y-m'); $dir = pf_docroot() . $sub;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) json_out(['error' => 'Could not save the photo.'], 500);
    $name = (pf_slugify(pathinfo((string)$f['name'], PATHINFO_FILENAME)) ?: 'photo');
    $name = substr($name, 0, 40) . '-' . bin2hex(random_bytes(5));
    [$fw, $fh] = pf_save_webp($im, $w, $h, 1600, "$dir/$name.webp", 82);
    pf_save_webp($im, $w, $h, 640, "$dir/$name-thumb.webp", 78);
    imagedestroy($im);
    json_out(['image' => ['src' => "$sub/$name.webp", 'thumb' => "$sub/$name-thumb.webp", 'width' => $fw, 'height' => $fh, 'alt' => '']]);
}
function pf_clean_images($v): array {
    $o = [];
    foreach (is_array($v) ? array_slice($v, 0, 40) : [] as $i) {
        if (!is_array($i) || !is_string($i['src'] ?? null)) continue;
        $src = $i['src']; $thumb = is_string($i['thumb'] ?? null) ? $i['thumb'] : $src;
        $re = '#^' . preg_quote(PF_IMG_DIR, '#') . '/\d{4}-\d{2}/[a-z0-9-]{1,60}\.webp$#';
        if (!preg_match($re, $src) || !preg_match($re, $thumb) || !is_file(pf_docroot() . $src)) continue;
        $o[] = ['src' => $src, 'thumb' => $thumb, 'alt' => text($i['alt'] ?? '', 200), 'width' => max(0, (int)($i['width'] ?? 0)), 'height' => max(0, (int)($i['height'] ?? 0))];
    }
    return $o;
}
/** Photos of a shipped project after the owner's edits: original photos (by src) and uploaded ones, in the owner's order. */
function pf_static_photos(array $p, $v): array {
    $orig = []; foreach (array_merge($p['images'] ?? [], isset($p['cover']['src']) ? [$p['cover']] : []) as $i) if (is_string($i['src'] ?? null)) $orig[$i['src']] = $i;
    $o = [];
    foreach (is_array($v) ? array_slice($v, 0, 40) : [] as $i) {
        if (!is_array($i) || !is_string($i['src'] ?? null) || in_array($i['src'], array_column($o, 'src'), true)) continue;
        if (isset($orig[$i['src']])) { $x = $orig[$i['src']]; $a = text($i['alt'] ?? '', 200); if ($a !== '') $x['alt'] = $a; $o[] = $x; continue; }
        if ($c = pf_clean_images([$i])) $o[] = $c[0];
    }
    return $o;
}
function pf_unlink_images(array $old, array $keep): void {
    $k = array_column($keep, 'src');
    foreach ($old as $i) if (is_array($i) && is_string($i['src'] ?? null) && !in_array($i['src'], $k, true))
        foreach ([$i['src'], $i['thumb'] ?? ''] as $p) if (is_string($p) && preg_match('#^' . preg_quote(PF_IMG_DIR, '#') . '/\d{4}-\d{2}/[a-z0-9-]{1,60}\.webp$#', $p)) @unlink(pf_docroot() . $p);
}

/* ---------------- admin routes (/api/admin/portfolio…) ---------------- */
function pf_admin_route(string $r, string $method): void {
    if ($r === '/portfolio' && $method === 'GET') {
        $u = require_user('site.edit');
        json_out(['projects' => pf_all(true), 'taxonomy' => ['services' => PF_SERVICES, 'vehicles' => PF_VEHICLES, 'finishes' => PF_FINISHES],
            'industries' => array_values(array_unique(array_filter(array_column(pf_static(), 'industry')))), 'canPublish' => in_array('site.publish', $u['permissions'], true)]);
    }
    if ($r === '/portfolio/upload' && $method === 'POST') { $u = require_user('site.edit'); pf_upload($u); }
    if ($r === '/portfolio/save' && $method === 'POST') {
        $u = require_user('site.edit'); $v = body_json(200000); $pdo = pf_db(); $now = now_iso();
        $canPublish = in_array('site.publish', $u['permissions'], true);
        $static = []; foreach (pf_static() as $p) $static[$p['slug']] = $p;
        // a shipped project: only its categories / tags / description / featured / hidden can change
        if (is_string($v['staticSlug'] ?? null)) {
            if (!$canPublish) json_out(['error' => 'Changes to published projects need publishing permission.'], 403);
            $slug = $v['staticSlug']; if (!isset($static[$slug])) json_out(['error' => 'Project not found.'], 404);
            $veh = (string)($v['vehicleType'] ?? ''); if ($veh !== '' && !isset(PF_VEHICLES[$veh])) $veh = '';
            $d = ['services' => pf_list($v['services'] ?? [], PF_SERVICES), 'vehicleType' => $veh, 'finishes' => pf_list($v['finishes'] ?? [], PF_FINISHES), 'tags' => pf_tags($v['tags'] ?? []),
                'description' => text($v['description'] ?? '', 2000), 'featured' => !empty($v['featured']), 'hidden' => !empty($v['hidden'])];
            $t = text($v['title'] ?? '', 80); if ($t !== '' && $t !== (string)($static[$slug]['title'] ?? '')) $d['title'] = $t;
            if (isset($v['model'])) { $m = text($v['model'], 80); if ($m !== (string)($static[$slug]['model'] ?? '')) $d['model'] = $m; }
            $q0 = $pdo->prepare("SELECT data FROM portfolio_items WHERE slug = ? AND kind = 'override'"); $q0->execute([$slug]); $prevD = json_decode((string)($q0->fetchColumn() ?: '[]'), true) ?: [];
            if (array_key_exists('photos', $v)) { // owner changed the photos: keep the list (originals + uploads) and the cover
                $imgs = pf_static_photos($static[$slug], $v['photos']);
                if (!$imgs) json_out(['error' => 'Keep at least one photo.'], 400);
                $d['images'] = $imgs; $d['cover'] = max(0, min(count($imgs) - 1, (int)($v['cover'] ?? 0)));
                pf_unlink_images($prevD['images'] ?? [], $imgs);
            } elseif (is_array($prevD['images'] ?? null)) { $d['images'] = $prevD['images']; $d['cover'] = (int)($prevD['cover'] ?? 0); }
            $q = $pdo->prepare("SELECT id FROM portfolio_items WHERE slug = ? AND kind = 'override'"); $q->execute([$slug]); $row = $q->fetch();
            $j = json_encode($d, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($row) $pdo->prepare('UPDATE portfolio_items SET data = ?, updated_at = ?, updated_by = ? WHERE id = ?')->execute([$j, $now, $u['name'], $row['id']]);
            else $pdo->prepare('INSERT INTO portfolio_items (id,kind,slug,status,data,created_at,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?)')->execute([uuid(), 'override', $slug, 'published', $j, $now, $now, $u['name']]);
            audit($u, 'portfolio: updated tags', $slug);
            json_out(['ok' => true]);
        }
        $id = is_string($v['id'] ?? null) && preg_match('/^[0-9a-f-]{36}$/', $v['id']) ? $v['id'] : null;
        $old = null;
        if ($id) { $q = $pdo->prepare("SELECT * FROM portfolio_items WHERE id = ? AND kind = 'custom'"); $q->execute([$id]); $old = $q->fetch() ?: null; if (!$old) json_out(['error' => 'This project was deleted.'], 404); }
        $title = text($v['title'] ?? '', 120); if ($title === '') json_out(['error' => 'Add a project title.'], 400);
        $status = ($v['status'] ?? '') === 'published' ? 'published' : 'draft';
        if (!$canPublish && ($status === 'published' || ($old && $old['status'] === 'published'))) json_out(['error' => 'Publishing needs the “publish website” permission. Save it as a draft and ask the owner to publish.'], 403);
        $images = pf_clean_images($v['images'] ?? []);
        if ($status === 'published' && !$images) json_out(['error' => 'Add at least one photo before publishing.'], 400);
        $veh = (string)($v['vehicleType'] ?? ''); if ($veh !== '' && !isset(PF_VEHICLES[$veh])) $veh = '';
        $year = preg_match('/^(19|20)\d{2}$/', (string)($v['year'] ?? '')) ? (string)$v['year'] : '';
        $d = ['title' => $title, 'make' => text($v['make'] ?? '', 60), 'model' => text($v['model'] ?? '', 60), 'year' => $year, 'vehicleType' => $veh, 'client' => text($v['client'] ?? '', 120),
            'industry' => text($v['industry'] ?? '', 60), 'description' => text($v['description'] ?? '', 4000), 'services' => pf_list($v['services'] ?? [], PF_SERVICES), 'finishes' => pf_list($v['finishes'] ?? [], PF_FINISHES),
            'tags' => pf_tags($v['tags'] ?? []), 'images' => $images, 'cover' => max(0, min(count($images) - 1, (int)($v['cover'] ?? 0))), 'featured' => !empty($v['featured'])];
        foreach ($d['images'] as $k => &$im) if ($im['alt'] === '') $im['alt'] = $title . ' — photo ' . ($k + 1); unset($im);
        // URL: /satin/portfolio/projects/<slug>/ — unique among shipped and admin projects
        $want = pf_slugify((string)($v['slug'] ?? '')) ?: ($old['slug'] ?? '') ?: pf_slugify($title . ($d['make'] ? ' ' . $d['make'] . ' ' . $d['model'] : '')) ?: 'project';
        $taken = function (string $s) use ($pdo, $static, $id) { if (isset($static[$s]) || is_dir(pf_docroot() . '/satin/portfolio/projects/' . $s) || in_array($s, ['commercial', 'colour-change'], true)) return true; $q = $pdo->prepare('SELECT id FROM portfolio_items WHERE slug = ?'); $q->execute([$s]); $r = $q->fetch(); return $r && $r['id'] !== $id; };
        $slug = $want; for ($n = 2; $taken($slug); $n++) $slug = substr($want, 0, 74) . '-' . $n;
        $j = json_encode($d, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($old) {
            $pdo->prepare('UPDATE portfolio_items SET slug = ?, status = ?, data = ?, updated_at = ?, updated_by = ? WHERE id = ?')->execute([$slug, $status, $j, $now, $u['name'], $id]);
            pf_unlink_images(json_decode((string)$old['data'], true)['images'] ?? [], $images);
        } else {
            $id = uuid();
            $pdo->prepare('INSERT INTO portfolio_items (id,kind,slug,status,data,created_at,updated_at,updated_by) VALUES (?,?,?,?,?,?,?,?)')->execute([$id, 'custom', $slug, $status, $j, $now, $now, $u['name']]);
        }
        audit($u, $old ? 'portfolio: updated project' : 'portfolio: added project', $slug . ' (' . $status . ')');
        json_out(['ok' => true, 'id' => $id, 'slug' => $slug, 'status' => $status, 'url' => '/satin/portfolio/projects/' . $slug . '/']);
    }
    if ($r === '/portfolio/delete' && $method === 'POST') {
        $u = require_user('site.publish'); $v = body_json(4000); $pdo = pf_db();
        if (is_string($v['staticSlug'] ?? null)) { // shipped project: forget the admin's changes (hiding is a separate switch)
            $q = $pdo->prepare("SELECT data FROM portfolio_items WHERE slug = ? AND kind = 'override'"); $q->execute([$v['staticSlug']]);
            if ($old = $q->fetchColumn()) pf_unlink_images(json_decode((string)$old, true)['images'] ?? [], []);
            $pdo->prepare("DELETE FROM portfolio_items WHERE slug = ? AND kind = 'override'")->execute([$v['staticSlug']]);
            audit($u, 'portfolio: reset tags', (string)$v['staticSlug']); json_out(['ok' => true]);
        }
        $q = $pdo->prepare("SELECT * FROM portfolio_items WHERE id = ? AND kind = 'custom'"); $q->execute([(string)($v['id'] ?? '')]); $row = $q->fetch();
        if (!$row) json_out(['error' => 'Project not found.'], 404);
        $pdo->prepare('DELETE FROM portfolio_items WHERE id = ?')->execute([$row['id']]);
        pf_unlink_images(json_decode((string)$row['data'], true)['images'] ?? [], []);
        audit($u, 'portfolio: deleted project', $row['slug']);
        json_out(['ok' => true]);
    }
    json_out(['error' => 'Not found'], 404);
}

/* GET /cms/portfolio-data.mjs — the shipped project list (the file the build writes) with Admin → Our Work renames,
   model, description and hide switches applied, so the website and app always show the owner's names. */
function pf_data_module(): void {
    $file = pf_docroot() . '/cms/portfolio-data.mjs';
    $src = (string)@file_get_contents($file);
    header('Content-Type: text/javascript; charset=utf-8'); header('Cache-Control: no-cache');
    if (!preg_match('/^export const projects=(\[.*\])\s*;?\s*$/s', $src, $m) || !is_array($list = json_decode($m[1], true))) { echo $src; exit; }
    $ov = []; try { foreach (pf_rows() as $r) if ($r['kind'] === 'override') $ov[$r['slug']] = $r['data']; } catch (Throwable $e) { }
    $out = [];
    foreach ($list as $p) {
        $d = $ov[$p['slug'] ?? ''] ?? null;
        if ($d) {
            if (!empty($d['hidden'])) continue;
            if (($d['title'] ?? '') !== '') { $old = (string)$p['title']; $p['title'] = (string)$d['title'];
                foreach ($p['images'] ?? [] as $i => $im) if (isset($im['alt']) && $old !== '') $p['images'][$i]['alt'] = str_replace($old, $p['title'], (string)$im['alt']); }
            if (isset($d['model']) && is_string($d['model'])) $p['model'] = $d['model'];
            if (($d['description'] ?? '') !== '') $p['description'] = (string)$d['description'];
            if (is_array($d['images'] ?? null) && $d['images']) { $p['images'] = $d['images']; $p['cover'] = $d['images'][(int)($d['cover'] ?? 0)] ?? $d['images'][0]; }
        }
        $out[] = $p;
    }
    echo 'export const projects=' . json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ";\n"; exit;
}

/* Shipped project page (prerendered file) with the owner's rename applied to <title>, the H1, social titles and JSON-LD,
   so the new name shows even before the page script runs (search engines, link previews). */
function pf_static_page(string $path): bool {
    if (!preg_match('#^/satin(?:/(fa|fr|es))?/portfolio/projects/([a-z0-9-]{1,120})/?$#', $path, $m)) return false;
    $file = pf_docroot() . rtrim($path, '/') . '/index.html';
    if (!is_file($file)) return false;
    $html = (string)file_get_contents($file);
    $slug = $m[2]; $old = ''; foreach (pf_static() as $p) if (($p['slug'] ?? '') === $slug) { $old = (string)$p['title']; break; }
    $d = null; try { foreach (pf_rows() as $r) if ($r['kind'] === 'override' && $r['slug'] === $slug) { $d = $r['data']; break; } } catch (Throwable $e) { }
    $new = (string)($d['title'] ?? '');
    if ($old !== '' && $new !== '' && $new !== $old) {
        $eo = htmlspecialchars($old, ENT_QUOTES, 'UTF-8'); $en = htmlspecialchars($new, ENT_QUOTES, 'UTF-8');
        $rep = fn($s) => str_replace([$eo, $old], [$en, $new], $s);
        $html = preg_replace_callback('#<title>.*?</title>|<h1\b.*?</h1>|<meta (?:property|name)="(?:og:title|twitter:title|og:description|description|twitter:description)" content="[^"]*">|<script type="application/ld\+json">.*?</script>|<figcaption>.*?</figcaption>|\balt="[^"]*"#s', fn($x) => $rep($x[0]), $html);
    }
    header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-cache');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') echo $html;
    return true;
}
