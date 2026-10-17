<?php
declare(strict_types=1);
// Website editor API: page content drafts/publishing, media library, theme, menus, pages.
require_once __DIR__ . '/cms_sanitize.php';

function migrate_site(PDO $pdo): void {
    static $done = false; if ($done) return; $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_content (path TEXT PRIMARY KEY, draft TEXT, published TEXT, draft_at TEXT, draft_by TEXT, published_at TEXT, published_by TEXT, revision INTEGER NOT NULL DEFAULT 0)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, scope TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_pages (path TEXT PRIMARY KEY, title TEXT NOT NULL, lang TEXT NOT NULL, created_at TEXT NOT NULL, created_by TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_media (id TEXT PRIMARY KEY, url TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, width INTEGER, height INTEGER, bytes INTEGER, created_at TEXT NOT NULL, created_by TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS seo_originals (path TEXT PRIMARY KEY, head TEXT NOT NULL)');
}
function sdb(): PDO { $p = adb(); migrate_site($p); return $p; }

function docroot(): string { return (string)(cfg('docroot') ?: (is_dir(dirname(__DIR__) . '/public_html/satin') ? dirname(__DIR__) . '/public_html' : dirname(__DIR__) . '/new.satingraphic.ca')); }
function page_path($p): string {
    $p = is_string($p) ? rtrim($p, '/') : '';
    if ($p === '') $p = '/satin';
    if (!preg_match('#^/satin(?:/[a-z0-9-]{1,80}){0,8}$#', $p)) json_out(['error' => 'Invalid page'], 400);
    return $p;
}
function page_file(string $p): string { return docroot() . $p . '/index.html'; }

function setting_get(string $k) { $q = sdb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute([$k]); $r = $q->fetch(); return $r ? json_decode($r['v'], true) : null; }
function setting_set(string $k, $v): void {
    $pdo = sdb(); $j = json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute([$k, $j, now_iso()]);
}
function revision_add(string $scope, $content, array $u): void {
    $pdo = sdb();
    $pdo->prepare('INSERT INTO site_revisions (scope,content,created_at,created_by) VALUES (?,?,?,?)')->execute([$scope, json_encode($content, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now_iso(), $u['name']]);
    // keep the latest 30 versions per scope
    $pdo->prepare('DELETE FROM site_revisions WHERE scope = ? AND id NOT IN (SELECT id FROM site_revisions WHERE scope = ? ORDER BY id DESC LIMIT 30)')->execute([$scope, $scope]);
}

/* ---------- writing the public files ---------- */
function atomic_write(string $file, string $data): bool {
    $tmp = $file . '.tmp' . bin2hex(random_bytes(3));
    if (@file_put_contents($tmp, $data) === false) return false;
    return @rename($tmp, $file);
}
function attr(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

// Bakes title/description/robots into the static page so search engines see them without JS.
function bake_seo(string $path, array $seo): void {
    $f = page_file($path);
    if (!is_file($f) || !is_writable($f)) return;
    $html = (string)file_get_contents($f);
    $pdo = sdb();
    $q = $pdo->prepare('SELECT head FROM seo_originals WHERE path = ?'); $q->execute([$path]); $orig = $q->fetch();
    $start = strpos($html, '<head>'); $end = strpos($html, '</head>');
    if ($start === false || $end === false) return;
    $head = substr($html, $start, $end - $start);
    if (!$orig) { $pdo->prepare('INSERT INTO seo_originals (path, head) VALUES (?,?)')->execute([$path, $head]); $base = $head; }
    else $base = $orig['head'];
    $h = $base;
    if (!empty($seo['title'])) {
        $t = attr($seo['title']);
        $h = preg_replace('#<title>.*?</title>#s', '<title>' . $t . '</title>', $h, 1);
        $h = preg_replace('#(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*(")#', '${1}' . $t . '${2}', $h);
    }
    if (!empty($seo['description'])) {
        $d = attr($seo['description']);
        $h = preg_replace('#(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")#', '${1}' . $d . '${2}', $h);
    }
    if (!empty($seo['image'])) {
        $i = attr(preg_match('#^https?://#', $seo['image']) ? $seo['image'] : site_url() . $seo['image']);
        $h = preg_replace('#(<meta (?:property|name)="(?:og:image|twitter:image)" content=")[^"]*(")#', '${1}' . $i . '${2}', $h);
    }
    if ($h !== $head) atomic_write($f, substr($html, 0, $start) . $h . substr($html, $end));
}

const THEME_START = '/*cms-theme:start*/';
const THEME_END = '/*cms-theme:end*/';
function write_theme_css(string $css): bool {
    $f = docroot() . '/batch.css';
    if (!is_file($f)) return false;
    $s = (string)file_get_contents($f);
    $a = strpos($s, THEME_START); $b = strpos($s, THEME_END);
    if ($a !== false && $b !== false) $s = substr($s, 0, $a) . substr($s, $b + strlen(THEME_END));
    $s = ltrim($s, "\n");
    // @import rules must come first, so the theme block sits at the top; html:root outranks :root.
    if (trim($css) !== '') $s = THEME_START . "\n" . $css . "\n" . THEME_END . "\n" . $s;
    return atomic_write($f, $s);
}

function all_html_files(): array {
    $out = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(docroot() . '/satin', FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if ($f->getFilename() === 'index.html') $out[] = $f->getPathname();
    return $out;
}

function nav_norm(string $h): string {
    $h = html_entity_decode($h, ENT_QUOTES, 'UTF-8');
    $h = preg_replace('#^/satin/(fa|fr|es)(?=/|$|\?)#', '/satin', $h);
    $q = ''; if (($p = strpos($h, '?')) !== false) { $q = substr($h, $p); $h = substr($h, 0, $p); }
    return (rtrim($h, '/') ?: '/') . $q;
}
// Same markup as /site-navigation.mjs menuHTML(); $map keeps translated labels on fa/fr/es pages.
function menu_html(array $items, bool $mobile, string $lang, array $map): string {
    $path = function ($p) use ($lang) { return $lang === 'en' ? $p : preg_replace('#^/satin(?=/|$)#', '/satin/' . $lang, $p); };
    $lbl = function ($label, $key, $href) use ($map) { return $map['k:' . $key] ?? $map['h:' . nav_norm($href)] ?? $label; };
    $chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>';
    $out = '';
    foreach ($items as $m) {
        if (($m['active'] ?? true) === false) continue;
        $label = attr($lbl($m['label'], $m['key'] ?? '', $m['href'] ?? ''));
        if (!empty($m['groups'])) {
            if ($mobile) {
                $out .= '<details><summary class="' . (($m['key'] ?? '') === 'wraps' ? 'wraps-nav' : '') . '">' . $label . '</summary>';
                foreach ($m['groups'] as $g) {
                    $out .= '<div><b>' . attr($g['label']) . '</b>';
                    foreach ($g['links'] as $l) if (($l['active'] ?? true) !== false) $out .= '<a href="' . attr($path($l['href'])) . '">' . attr($lbl($l['label'], '', $l['href'])) . '</a>';
                    $out .= '</div>';
                }
                $out .= '</details>';
            } else $out .= '<button type="button" data-mega="' . attr($m['key']) . '" aria-expanded="false">' . $label . $chev . '</button>';
        } else $out .= '<a class="' . ($mobile ? 'plain-link' : 'studio-nav') . '" href="' . attr($path($m['href'])) . '">' . $label . '</a>';
    }
    return $out;
}
function rewrite_nav_html(string $s, array $items, string $lang): string {
    $map = [];
    if ($lang !== 'en') {
        if (preg_match('#<nav class="nav" aria-label="[^"]*">(.*?)</nav>#s', $s, $nm)) {
            preg_match_all('#data-mega="([\w-]+)"[^>]*>([^<]+)#', $nm[1], $mm, PREG_SET_ORDER);
            foreach ($mm as $x) $map['k:' . $x[1]] = html_entity_decode(trim($x[2]), ENT_QUOTES, 'UTF-8');
        }
        $d = strpos($s, 'data-drawer>');
        $scope = ($nm[1] ?? '') . ($d !== false ? substr($s, $d, 30000) : '');
        preg_match_all('#<a [^>]*href="([^"]+)"[^>]*>([^<]+)</a>#', $scope, $am, PREG_SET_ORDER);
        foreach ($am as $x) { $k = 'h:' . nav_norm($x[1]); if (!isset($map[$k])) $map[$k] = html_entity_decode(trim($x[2]), ENT_QUOTES, 'UTF-8'); }
    }
    $desk = menu_html($items, false, $lang, $map);
    $s = preg_replace_callback('#(<nav class="nav" aria-label="[^"]*">).*?(</nav>)#s', function ($m) use ($desk) { return $m[1] . $desk . $m[2]; }, $s, 1);
    $d = strpos($s, 'data-drawer>');
    if ($d !== false) {
        $a = strpos($s, '<details', $d);
        $b = strpos($s, '<div style="margin-top:16px"><button class="btn block" data-quote', $d);
        if ($a !== false && $b !== false && $a < $b && $b - $d < 40000) {
            $old = substr($s, $a, $b - $a);
            $covered = [];
            foreach ($items as $m) { $covered[nav_norm($m['href'] ?? '')] = 1; foreach ($m['groups'] ?? [] as $g) foreach ($g['links'] as $l) $covered[nav_norm($l['href'])] = 1; }
            $keep = '';
            $tail = substr($old, (int)strrpos($old, '</details>'));
            if (preg_match_all('#<a href="([^"]+)" class="plain-link[^"]*"[^>]*>[^<]*</a>#', $tail, $pm, PREG_SET_ORDER))
                foreach ($pm as $x) if (!isset($covered[nav_norm($x[1])])) $keep .= $x[0];
            $s = substr($s, 0, $a) . menu_html($items, true, $lang, $map) . $keep . "\n    " . substr($s, $b);
        }
    }
    return $s;
}

// Rewrites the menu (header nav, mobile drawer and navigation seed) in every page. Returns [updated, failed].
function write_menu(array $menu): array {
    $json = json_encode(['items' => $menu['items'], 'revision' => time()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $json = str_replace(['</', '<!--'], ['<\/', '<\!--'], $json);
    $tag = '<script type="application/json" data-navigation-bootstrap>' . $json . '</script>';
    $ok = 0; $bad = 0;
    @set_time_limit(120);
    foreach (all_html_files() as $f) {
        $s = (string)file_get_contents($f);
        $n = preg_replace('#<script type="application/json" data-navigation-bootstrap>.*?</script>#s', str_replace(['\\', '$'], ['\\\\', '\\$'], $tag), $s, 1, $cnt);
        if (!$cnt) { $p = strpos($s, '</body>'); if ($p === false) { $bad++; continue; } $n = substr($s, 0, $p) . $tag . substr($s, $p); }
        $rel = substr($f, strlen(docroot()));
        $lang = preg_match('#^/satin/(fa|fr|es)/#', $rel, $lm) ? $lm[1] : 'en';
        $n = rewrite_nav_html($n, $menu['items'], $lang);
        if ($n === $s) { $ok++; continue; }
        atomic_write($f, $n) ? $ok++ : $bad++;
    }
    @file_put_contents(DATA . '/navigation.json', json_encode(['items' => $menu['items'], 'revision' => time(), 'batchVersion' => 1], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    return [$ok, $bad];
}

function pages_index(bool $refresh = false): array {
    $cache = __DIR__ . '/storage/pages-index.json';
    if (!$refresh && is_file($cache) && filemtime($cache) > time() - 86400) { $d = json_decode((string)file_get_contents($cache), true); if (is_array($d)) return $d; }
    $rows = []; $root = docroot();
    foreach (all_html_files() as $f) {
        $p = substr(dirname($f), strlen($root));
        if (!preg_match('#^/satin(?:/[a-z0-9-]+)*$#', $p)) continue;
        $head = (string)file_get_contents($f, false, null, 0, 6000);
        $t = preg_match('#<title>(.*?)</title>#s', $head, $m) ? html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8') : $p;
        $t = preg_replace('/\s*[|·–-]\s*Satin Graphic.*$/u', '', $t);
        $lang = preg_match('#^/satin/(fa|fr|es)(/|$)#', $p, $mm) ? $mm[1] : 'en';
        $rows[] = ['path' => $p, 'title' => $t, 'lang' => $lang];
    }
    usort($rows, function ($a, $b) { return strcmp($a['path'], $b['path']); });
    @file_put_contents($cache, json_encode($rows, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    return $rows;
}

function default_menu(): array { $d = json_decode((string)file_get_contents(DATA . '/navigation.json'), true); return ['items' => $d['items'] ?? []]; }


/* ---------- business profile (NAP) for structured data ---------- */
function business_default(): array {
    return ['name' => 'Satin Graphic', 'legalName' => 'Satin Auto Wrap Inc.', 'phone' => '+1-905-962-6222', 'email' => 'info@satingraphic.ca', 'street' => '50 Viceroy Rd, Unit 22–23', 'city' => 'Vaughan', 'region' => 'ON', 'postal' => '', 'country' => 'CA',
        'hours' => [['days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'opens' => '09:00', 'closes' => '17:00'], ['days' => ['Saturday'], 'opens' => '10:00', 'closes' => '15:00']], 'priceRange' => '$$',
        'sameAs' => ['https://www.facebook.com/SatinAutoWrap', 'https://www.satinautowrap.com/'], 'areaServed' => ['Vaughan', 'Toronto', 'Mississauga', 'Brampton', 'Markham', 'Richmond Hill', 'Greater Toronto Area'],
        'lat' => '', 'lng' => ''];
}
function business_get(): array { $b = setting_get('cms.business'); return array_replace(business_default(), is_array($b) ? $b : []); }
function business_clean(array $v): array {
    $d = business_default(); $o = [];
    foreach (['name' => 120, 'legalName' => 120, 'phone' => 40, 'email' => 160, 'street' => 160, 'city' => 80, 'region' => 40, 'postal' => 12, 'country' => 2, 'priceRange' => 10] as $k => $max) $o[$k] = cms_str($v[$k] ?? $d[$k], $max);
    $o['lat'] = is_numeric($v['lat'] ?? null) ? (string)round((float)$v['lat'], 6) : '';
    $o['lng'] = is_numeric($v['lng'] ?? null) ? (string)round((float)$v['lng'], 6) : '';
    $o['sameAs'] = array_values(array_filter(array_map(function ($u) { $u = cms_url($u); return preg_match('#^https?://#', $u) ? $u : ''; }, array_slice(is_array($v['sameAs'] ?? null) ? $v['sameAs'] : [], 0, 12))));
    $o['areaServed'] = array_values(array_filter(array_map(function ($a) { return cms_str($a, 60); }, array_slice(is_array($v['areaServed'] ?? null) ? $v['areaServed'] : [], 0, 20))));
    $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; $o['hours'] = [];
    foreach (array_slice(is_array($v['hours'] ?? null) ? $v['hours'] : [], 0, 7) as $h) {
        if (!is_array($h)) continue;
        $dd = array_values(array_intersect(is_array($h['days'] ?? null) ? $h['days'] : [], $days));
        if ($dd && preg_match('/^\d\d:\d\d$/', (string)($h['opens'] ?? '')) && preg_match('/^\d\d:\d\d$/', (string)($h['closes'] ?? ''))) $o['hours'][] = ['days' => $dd, 'opens' => $h['opens'], 'closes' => $h['closes']];
    }
    return $o;
}
function business_node(array $b, array $old): array {
    // start from the existing node so build-time fields (AutomotiveBusiness type, alternateName, knowsAbout, offer catalog…) survive
    $n = array_merge($old, ['@type' => $old['@type'] ?? 'LocalBusiness', '@id' => $old['@id'] ?? (site_url() . '/satin/#business'), 'name' => $b['name'], 'url' => $old['url'] ?? (site_url() . '/satin/'), 'image' => $old['image'] ?? (site_url() . '/satin/img/logo.png'), 'logo' => $old['logo'] ?? (site_url() . '/satin/img/logo.png')]);
    unset($n['geo'], $n['legalName'], $n['priceRange']);
    if ($b['legalName']) $n['legalName'] = $b['legalName'];
    if ($b['email']) $n['email'] = $b['email'];
    if ($b['phone']) $n['telephone'] = $b['phone'];
    if ($b['priceRange']) $n['priceRange'] = $b['priceRange'];
    $addr = ['@type' => 'PostalAddress', 'streetAddress' => $b['street'], 'addressLocality' => $b['city'], 'addressRegion' => $b['region'], 'addressCountry' => $b['country']];
    if ($b['postal']) $addr['postalCode'] = $b['postal'];
    $n['address'] = $addr;
    if ($b['lat'] !== '' && $b['lng'] !== '') $n['geo'] = ['@type' => 'GeoCoordinates', 'latitude' => (float)$b['lat'], 'longitude' => (float)$b['lng']];
    $n['hasMap'] = 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($b['street'] . ', ' . $b['city'] . ' ' . $b['region']);
    if ($b['hours']) $n['openingHoursSpecification'] = array_map(function ($h) { return ['@type' => 'OpeningHoursSpecification', 'dayOfWeek' => $h['days'], 'opens' => $h['opens'], 'closes' => $h['closes']]; }, $b['hours']);
    if ($b['areaServed']) $n['areaServed'] = $b['areaServed'];
    if ($b['sameAs']) $n['sameAs'] = $b['sameAs'];
    return $n;
}
// Rewrites the LocalBusiness node in every page's JSON-LD. Returns [updated, skipped].
function write_business(array $b): array {
    $ok = 0; $skip = 0; @set_time_limit(180);
    foreach (all_html_files() as $f) {
        $s = (string)file_get_contents($f);
        if (!preg_match('#(<script type="application/ld\+json" id="page-schema">)(.*?)(</script>)#s', $s, $m, PREG_OFFSET_CAPTURE)) { $skip++; continue; }
        $data = json_decode($m[2][0], true);
        if (!is_array($data)) { $skip++; continue; }
        $graph = isset($data['@graph']) && is_array($data['@graph']) ? $data['@graph'] : [$data];
        $found = false;
        foreach ($graph as $i => $node) { $t = $node['@type'] ?? ''; if ($t === 'LocalBusiness' || (is_array($t) && in_array('LocalBusiness', $t, true))) { $graph[$i] = business_node($b, $node); $found = true; } }
        if (!$found) { $skip++; continue; }
        if (isset($data['@graph'])) $data['@graph'] = $graph; else $data = $graph[0];
        $js = str_replace('</', '<\/', json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $n = substr($s, 0, $m[2][1]) . $js . substr($s, $m[2][1] + strlen($m[2][0]));
        if ($n === $s) { $ok++; continue; }
        atomic_write($f, $n) ? $ok++ : $skip++;
    }
    return [$ok, $skip];
}

/* ---------- search & analytics tools (Search Console / Bing verification, GA4 / GTM, IndexNow) ---------- */
const SEO_TOOLS_START = '<!--seo-tools-->';
const SEO_TOOLS_END = '<!--/seo-tools-->';
function seo_tools_get(): array {
    $t = setting_get('seo.tools');
    return array_replace(['googleVerify' => '', 'bingVerify' => '', 'ga4' => '', 'gtm' => '', 'indexNowKey' => ''], is_array($t) ? $t : []);
}
// Accepts either the bare token or the whole <meta …> tag the tool shows you.
function seo_token($v, string $re): string {
    $v = trim((string)$v);
    if (preg_match('/content=["\']([^"\']+)["\']/i', $v, $m)) $v = $m[1];
    if ($v === '') return '';
    if (!preg_match($re, $v)) json_out(['error' => 'Check the format of: ' . htmlspecialchars($v, ENT_QUOTES)], 400);
    return $v;
}
function seo_tools_clean(array $v): array {
    return ['googleVerify' => seo_token($v['googleVerify'] ?? '', '/^[A-Za-z0-9_\-]{20,100}$/'),
        'bingVerify' => seo_token($v['bingVerify'] ?? '', '/^[A-Fa-f0-9]{32}$/'),
        'ga4' => strtoupper(seo_token($v['ga4'] ?? '', '/^G-[A-Za-z0-9]{4,16}$/')),
        'gtm' => strtoupper(seo_token($v['gtm'] ?? '', '/^GTM-[A-Za-z0-9]{4,12}$/')),
        'indexNowKey' => seo_token($v['indexNowKey'] ?? '', '/^[a-f0-9]{32}$/')];
}
// The snippet placed in every page's <head>. Google Analytics / Tag Manager load only after the visitor allows
// measurement in the site's consent banner (sessionStorage satinAnalyticsConsent = yes), with ad storage denied.
function seo_tools_html(array $t): string {
    $h = '';
    if ($t['googleVerify'] !== '') $h .= '<meta name="google-site-verification" content="' . attr($t['googleVerify']) . '">';
    if ($t['bingVerify'] !== '') $h .= '<meta name="msvalidate.01" content="' . attr($t['bingVerify']) . '">';
    if ($t['ga4'] !== '' || $t['gtm'] !== '') {
        $h .= '<script>(function(){var G=' . json_encode($t['ga4']) . ',T=' . json_encode($t['gtm']) . ';window.__sgAnalytics=1;'
            . 'function ok(){try{return sessionStorage.getItem("satinAnalyticsConsent")==="yes"||localStorage.getItem("satinConsent")==="yes"}catch(e){return false}}'
            . 'function load(){if(window.__sgTools||!ok()||window.frameElement)return;window.__sgTools=1;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;'
            . 'gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"granted"});'
            . 'function js(u){var s=document.createElement("script");s.async=true;s.src=u;document.head.appendChild(s)}'
            . 'if(G){js("https://www.googletagmanager.com/gtag/js?id="+G);gtag("js",new Date());gtag("config",G)}'
            . 'if(T){dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});js("https://www.googletagmanager.com/gtm.js?id="+T)}}'
            . 'load();document.addEventListener("click",function(e){if(e.target&&e.target.closest&&e.target.closest(".consent-banner [data-allow]"))setTimeout(load,0)},true)})();</script>';
    }
    return SEO_TOOLS_START . $h . SEO_TOOLS_END;
}
function seo_tools_apply_html(string $s, string $block): string {
    $s = preg_replace('#' . preg_quote(SEO_TOOLS_START, '#') . '.*?' . preg_quote(SEO_TOOLS_END, '#') . '#s', '', $s);
    if ($block === SEO_TOOLS_START . SEO_TOOLS_END) return $s;
    $i = strpos($s, '<meta charset="utf-8">');
    if ($i !== false) { $i += strlen('<meta charset="utf-8">'); return substr($s, 0, $i) . $block . substr($s, $i); }
    $i = strpos($s, '<head>');
    return $i === false ? $s : substr($s, 0, $i + 6) . $block . substr($s, $i + 6);
}
// Writes the snippet into every public page. Returns [updated, missing] where missing = pages that do not carry the current snippet.
function write_seo_tools(array $t, bool $dryRun = false): array {
    $block = seo_tools_html($t); $ok = 0; $missing = 0; @set_time_limit(180);
    $files = all_html_files(); if (is_file(docroot() . '/index.html')) $files[] = docroot() . '/index.html';
    foreach ($files as $f) {
        $s = (string)file_get_contents($f);
        $n = seo_tools_apply_html($s, $block);
        if ($n === $s) continue;
        $missing++;
        if (!$dryRun && atomic_write($f, $n)) $ok++;
    }
    return [$ok, $missing];
}
// IndexNow: the key file is answered by api.php (/<key>.txt); this submits every sitemap URL to the shared IndexNow endpoint (Bing, Yandex, Seznam…).
function indexnow_submit(array $t): array {
    if ($t['indexNowKey'] === '') json_out(['error' => 'Generate and save an IndexNow key first.'], 400);
    $sm = (string)@file_get_contents(docroot() . '/satin/sitemap.xml');
    preg_match_all('#<loc>([^<]+)</loc>#', $sm, $m);
    // the canonical host is the one in the sitemap (admin may be open on the staging host)
    $host = (string)parse_url((string)($m[1][0] ?? site_url()), PHP_URL_HOST);
    $urls = array_values(array_filter(array_map('html_entity_decode', $m[1]), function ($u) use ($host) { return parse_url($u, PHP_URL_HOST) === $host; }));
    if (!$urls) json_out(['error' => 'No sitemap URLs for ' . $host . ' were found. Publish the production build first.'], 400);
    $body = json_encode(['host' => $host, 'key' => $t['indexNowKey'], 'keyLocation' => 'https://' . $host . '/' . $t['indexNowKey'] . '.txt', 'urlList' => array_slice($urls, 0, 10000)], JSON_UNESCAPED_SLASHES);
    $ch = curl_init('https://api.indexnow.org/indexnow');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8']]);
    $res = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($res === false) $res = 'curl: ' . curl_error($ch);
    curl_close($ch);
    return ['status' => $code, 'submitted' => min(count($urls), 10000), 'response' => mb_substr((string)$res, 0, 300)];
}

/* ---------- sitemap.xml ---------- */
function sitemap_xml(): void {
    $pdo = sdb();
    $noindex = [];
    foreach ($pdo->query('SELECT path, published FROM site_content WHERE published IS NOT NULL') as $r) { $c = json_decode($r['published'], true); if (!empty($c['seo']['noindex'])) $noindex[$r['path']] = 1; }
    $skip = '#/(404|account|login|register|track|checkout|cart|pay|studio|design-agreement)(/|$)#';
    $base = site_url();
    $out = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach (pages_index() as $p) {
        if (preg_match($skip, $p['path'] . '/') || isset($noindex[$p['path']]) || stripos($p['title'], 'Page Not Found') !== false) continue;
        $f = page_file($p['path']);
        $lm = is_file($f) ? gmdate('Y-m-d', (int)filemtime($f)) : '';
        $out .= '<url><loc>' . htmlspecialchars($base . $p['path'] . '/', ENT_XML1) . '</loc>' . ($lm ? "<lastmod>$lm</lastmod>" : '') . "</url>\n";
    }
    // project pages added in Admin → Our Work (served by portfolio.php, no static file)
    try { require_once __DIR__ . '/portfolio.php'; foreach (pf_urls() as $u) $out .= '<url><loc>' . htmlspecialchars($base . $u['path'], ENT_XML1) . '</loc><lastmod>' . htmlspecialchars(substr((string)$u['updatedAt'], 0, 10), ENT_XML1) . "</lastmod></url>\n"; } catch (Throwable $e) { }
    $out .= '</urlset>';
    header('Content-Type: application/xml; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    echo $out; exit;
}

/* ---------- routes ---------- */
function site_route(string $r, string $method): void {
    $pdo = sdb();

    if ($r === '/site/bootstrap' && $method === 'GET') {
        $u = require_user('site.edit');
        json_out(['fonts' => CMS_FONTS, 'blockKinds' => CMS_BLOCK_KINDS, 'canPublish' => in_array('site.publish', $u['permissions'], true)]);
    }

    if ($r === '/site/pages' && $method === 'GET') {
        require_user('site.edit');
        $rows = pages_index(!empty($_GET['refresh']));
        $state = [];
        foreach ($pdo->query('SELECT path, draft IS NOT NULL AS d, published IS NOT NULL AS p, draft_at, published_at FROM site_content') as $s) $state[$s['path']] = $s;
        $custom = [];
        foreach ($pdo->query('SELECT path FROM site_pages') as $c) $custom[$c['path']] = true;
        foreach ($rows as &$row) {
            $s = $state[$row['path']] ?? null;
            $row['draft'] = $s && $s['d'] && (!$s['p'] || $s['draft_at'] > $s['published_at']);
            $row['edited'] = $s && $s['p'];
            $row['custom'] = isset($custom[$row['path']]);
        }
        json_out(['pages' => $rows]);
    }

    if ($r === '/site/content' && $method === 'GET') {
        require_user('site.edit');
        $p = page_path($_GET['path'] ?? '');
        $q = $pdo->prepare('SELECT * FROM site_content WHERE path = ?'); $q->execute([$p]); $row = $q->fetch();
        $pub = $row && $row['published'] ? json_decode($row['published'], true) : null;
        $draft = $row && $row['draft'] ? json_decode($row['draft'], true) : null;
        json_out(['path' => $p, 'content' => $draft ?: $pub ?: cms_content([]), 'hasDraft' => (bool)$draft && (!$pub || $row['draft_at'] > $row['published_at']), 'published' => (bool)$pub,
            'draftAt' => $row['draft_at'] ?? null, 'draftBy' => $row['draft_by'] ?? null, 'publishedAt' => $row['published_at'] ?? null, 'publishedBy' => $row['published_by'] ?? null, 'revision' => (int)($row['revision'] ?? 0)]);
    }

    if ($r === '/site/save' && $method === 'POST') {
        $u = require_user('site.edit');
        $v = body_json(2500000);
        $p = page_path($v['path'] ?? '');
        $c = cms_content($v['content'] ?? []);
        $q = $pdo->prepare('SELECT revision FROM site_content WHERE path = ?'); $q->execute([$p]); $row = $q->fetch();
        $rev = (int)($row['revision'] ?? 0);
        if (isset($v['revision']) && (int)$v['revision'] !== $rev) json_out(['error' => 'Someone else changed this page. Reload to see the latest version.', 'conflict' => true], 409);
        $j = json_encode($c, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($row) $pdo->prepare('UPDATE site_content SET draft = ?, draft_at = ?, draft_by = ?, revision = revision + 1 WHERE path = ?')->execute([$j, now_iso(), $u['name'], $p]);
        else $pdo->prepare('INSERT INTO site_content (path, draft, draft_at, draft_by, revision) VALUES (?,?,?,?,1)')->execute([$p, $j, now_iso(), $u['name']]);
        json_out(['ok' => true, 'revision' => $rev + 1, 'content' => $c, 'savedAt' => now_iso()]);
    }

    if ($r === '/site/publish' && $method === 'POST') {
        $u = require_user('site.publish');
        $v = body_json(4000);
        $p = page_path($v['path'] ?? '');
        $q = $pdo->prepare('SELECT * FROM site_content WHERE path = ?'); $q->execute([$p]); $row = $q->fetch();
        if (!$row || !$row['draft']) json_out(['error' => 'There are no changes to publish.'], 400);
        $c = cms_content(json_decode($row['draft'], true));
        $j = json_encode($c, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $now = now_iso();
        $pdo->prepare('UPDATE site_content SET published = ?, published_at = ?, published_by = ?, draft = ?, draft_at = ? WHERE path = ?')->execute([$j, $now, $u['name'], $j, $now, $p]);
        revision_add('page:' . $p, $c, $u);
        bake_seo($p, (array)$c['seo']);
        audit($u, 'published page', $p);
        json_out(['ok' => true, 'publishedAt' => $now]);
    }

    if ($r === '/site/discard' && $method === 'POST') {
        $u = require_user('site.edit');
        $v = body_json(4000);
        $p = page_path($v['path'] ?? '');
        $pdo->prepare('UPDATE site_content SET draft = published, draft_at = published_at, revision = revision + 1 WHERE path = ?')->execute([$p]);
        $pdo->prepare('DELETE FROM site_content WHERE path = ? AND published IS NULL')->execute([$p]);
        audit($u, 'discarded draft', $p);
        json_out(['ok' => true]);
    }

    if ($r === '/site/history' && $method === 'GET') {
        require_user('site.edit');
        $scope = (string)($_GET['scope'] ?? '');
        if (!preg_match('#^(page:/satin[a-z0-9/-]*|theme|menu)$#', $scope)) json_out(['error' => 'Invalid scope'], 400);
        $q = $pdo->prepare('SELECT id, created_at, created_by FROM site_revisions WHERE scope = ? ORDER BY id DESC LIMIT 30'); $q->execute([$scope]);
        json_out(['versions' => array_map(function ($r) { return ['id' => (int)$r['id'], 'createdAt' => $r['created_at'], 'createdBy' => $r['created_by']]; }, $q->fetchAll())]);
    }

    if ($r === '/site/version' && $method === 'GET') {
        require_user('site.edit');
        $q = $pdo->prepare('SELECT scope, content FROM site_revisions WHERE id = ?'); $q->execute([(int)($_GET['id'] ?? 0)]); $row = $q->fetch();
        if (!$row) json_out(['error' => 'Version not found'], 404);
        json_out(['scope' => $row['scope'], 'content' => json_decode($row['content'], true)]);
    }


    if ($r === '/site/business' && $method === 'GET') { require_user('settings.edit'); json_out(['business' => business_get()]); }
    if ($r === '/site/business' && $method === 'POST') {
        $u = require_user('settings.edit');
        if (!in_array('site.publish', $u['permissions'], true)) json_out(['error' => 'You need permission to publish the website.'], 403);
        $b = business_clean(body_json(20000)['business'] ?? []);
        if ($b['name'] === '' || $b['street'] === '' || $b['city'] === '') json_out(['error' => 'Name, street and city are required.'], 400);
        setting_set('cms.business', $b);
        [$ok, $skip] = write_business($b);
        audit($u, 'updated business info (structured data)', "$ok pages");
        json_out(['ok' => true, 'updated' => $ok, 'skipped' => $skip, 'business' => $b]);
    }
    if ($r === '/site/seo-tools' && $method === 'GET') {
        require_user('settings.edit');
        $t = seo_tools_get(); [, $missing] = write_seo_tools($t, true);
        json_out(['tools' => $t, 'pagesMissing' => $missing]);
    }
    if ($r === '/site/seo-tools' && $method === 'POST') {
        $u = require_user('settings.edit');
        if (!in_array('site.publish', $u['permissions'], true)) json_out(['error' => 'You need permission to publish the website.'], 403);
        $v = body_json(8000);
        $t = seo_tools_clean(is_array($v['tools'] ?? null) ? $v['tools'] : []);
        setting_set('seo.tools', $t);
        [$ok] = write_seo_tools($t);
        audit($u, 'updated search & analytics tools', "$ok pages");
        json_out(['ok' => true, 'tools' => $t, 'updated' => $ok]);
    }
    if ($r === '/site/indexnow' && $method === 'POST') {
        $u = require_user('settings.edit');
        $res = indexnow_submit(seo_tools_get());
        audit($u, 'submitted URLs to IndexNow', $res['submitted'] . ' URLs, HTTP ' . $res['status']);
        json_out(['ok' => in_array($res['status'], [200, 202], true)] + $res);
    }

    /* ---------- theme ---------- */
    if ($r === '/site/theme' && $method === 'GET') {
        require_user('site.edit');
        $pub = setting_get('cms.theme.published'); $draft = setting_get('cms.theme.draft');
        json_out(['theme' => $draft ?: $pub ?: cms_theme([]), 'published' => $pub ?: cms_theme([]), 'hasDraft' => $draft !== null && $draft !== $pub]);
    }
    if ($r === '/site/theme/save' && $method === 'POST') {
        require_user('site.edit');
        $t = cms_theme(body_json(20000)['theme'] ?? []);
        setting_set('cms.theme.draft', $t);
        json_out(['ok' => true, 'theme' => $t, 'css' => cms_theme_css($t)]);
    }
    if ($r === '/site/theme/css' && $method === 'POST') {
        require_user('site.edit');
        json_out(['css' => cms_theme_css(cms_theme(body_json(20000)['theme'] ?? []))]);
    }
    if ($r === '/site/theme/publish' && $method === 'POST') {
        $u = require_user('site.publish');
        $t = cms_theme(setting_get('cms.theme.draft') ?: []);
        if (!write_theme_css(cms_theme_css($t))) json_out(['error' => 'Could not write the theme file on the server.'], 500);
        setting_set('cms.theme.published', $t);
        revision_add('theme', $t, $u); audit($u, 'published theme');
        json_out(['ok' => true]);
    }

    /* ---------- menus ---------- */
    if ($r === '/site/menu' && $method === 'GET') {
        require_user('site.edit');
        $pub = setting_get('cms.menu.published'); $draft = setting_get('cms.menu.draft');
        json_out(['menu' => $draft ?: $pub ?: default_menu(), 'hasDraft' => $draft !== null && $draft !== $pub]);
    }
    if ($r === '/site/menu/save' && $method === 'POST') {
        require_user('site.edit');
        $m = cms_menu(body_json(200000)['menu'] ?? []);
        setting_set('cms.menu.draft', $m);
        json_out(['ok' => true, 'menu' => $m]);
    }
    if ($r === '/site/menu/publish' && $method === 'POST') {
        $u = require_user('site.publish');
        $m = cms_menu(setting_get('cms.menu.draft') ?: default_menu());
        if (!$m['items']) json_out(['error' => 'The menu is empty.'], 400);
        [$ok, $bad] = write_menu($m);
        setting_set('cms.menu.published', $m);
        revision_add('menu', $m, $u); audit($u, 'published menu', "$ok pages updated" . ($bad ? ", $bad failed" : ''));
        json_out(['ok' => true, 'updated' => $ok, 'failed' => $bad]);
    }

    /* ---------- new pages ---------- */
    if ($r === '/site/pages/create' && $method === 'POST') {
        $u = require_user('site.publish');
        $v = body_json(4000);
        $title = cms_str($v['title'] ?? '', 120);
        $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(cms_str($v['slug'] ?? '', 80) ?: $title)), '-');
        $parent = page_path($v['parent'] ?? '/satin');
        if (mb_strlen($title) < 2 || $slug === '') json_out(['error' => 'Add a page name.'], 400);
        $p = page_path($parent . '/' . $slug);
        $dir = docroot() . $p;
        if (file_exists($dir)) json_out(['error' => 'A page with this address already exists.'], 409);
        $tpl = (string)@file_get_contents(page_file('/satin/about'));
        if ($tpl === '') json_out(['error' => 'Page template missing.'], 500);
        $html = new_page_html($tpl, $p, $title, cms_str($v['description'] ?? '', 300));
        $copy = isset($v['copyFrom']) && $v['copyFrom'] !== '' ? page_path($v['copyFrom']) : null;
        if ($copy) {
            $cq = $pdo->prepare('SELECT path FROM site_pages WHERE path = ?'); $cq->execute([$copy]);
            $srcHtml = (string)@file_get_contents(page_file($copy));
            if ($cq->fetch() && $srcHtml !== '') {
                // pages made in the editor: copy their page body as well
                $a1 = strpos($srcHtml, '<main'); $b1 = strpos($srcHtml, '</main>'); $a2 = strpos($html, '<main'); $b2 = strpos($html, '</main>');
                if ($a1 !== false && $b1 !== false && $a2 !== false && $b2 !== false) $html = substr($html, 0, $a2) . substr($srcHtml, $a1, $b1 - $a1) . substr($html, $b2);
            }
        }
        if (!@mkdir($dir, 0755, true) || !atomic_write($dir . '/index.html', $html)) json_out(['error' => 'Could not create the page on the server.'], 500);
        $lang = preg_match('#^/satin/(fa|fr|es)(/|$)#', $p, $m) ? $m[1] : 'en';
        $pdo->prepare('INSERT OR REPLACE INTO site_pages (path,title,lang,created_at,created_by) VALUES (?,?,?,?,?)')->execute([$p, $title, $lang, now_iso(), $u['name']]);
        if ($copy) {
            $q = $pdo->prepare('SELECT draft, published FROM site_content WHERE path = ?'); $q->execute([$copy]); $src = $q->fetch();
            $sc = $src ? json_decode($src['draft'] ?: $src['published'], true) : null;
            if (is_array($sc)) {
                $c = cms_content(['blocks' => $sc['blocks'] ?? [], 'els' => $sc['els'] ?? [], 'sectionOrder' => $sc['sectionOrder'] ?? [], 'sections' => $sc['sections'] ?? [], 'edits' => $sc['edits'] ?? []]);
                $pdo->prepare('INSERT OR REPLACE INTO site_content (path, draft, draft_at, draft_by, revision) VALUES (?,?,?,?,1)')->execute([$p, json_encode($c, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now_iso(), $u['name']]);
            }
        }
        @unlink(__DIR__ . '/storage/pages-index.json');
        audit($u, $copy ? 'duplicated page' : 'created page', $p);
        json_out(['ok' => true, 'path' => $p]);
    }
    if ($r === '/site/pages/delete' && $method === 'POST') {
        $u = require_user('site.publish');
        $p = page_path(body_json(4000)['path'] ?? '');
        $q = $pdo->prepare('SELECT path FROM site_pages WHERE path = ?'); $q->execute([$p]);
        if (!$q->fetch()) json_out(['error' => 'Only pages created in the editor can be deleted.'], 400);
        $dir = docroot() . $p;
        if (is_dir($dir) && count(glob($dir . '/*', GLOB_ONLYDIR)) > 0) json_out(['error' => 'This page has sub-pages. Delete those first.'], 400);
        @unlink($dir . '/index.html'); @rmdir($dir);
        $pdo->prepare('DELETE FROM site_pages WHERE path = ?')->execute([$p]);
        $pdo->prepare('DELETE FROM site_content WHERE path = ?')->execute([$p]);
        @unlink(__DIR__ . '/storage/pages-index.json');
        audit($u, 'deleted page', $p);
        json_out(['ok' => true]);
    }

    /* ---------- media ---------- */
    if ($r === '/media' && $method === 'GET') {
        require_user('site.edit');
        $rows = $pdo->query('SELECT * FROM site_media ORDER BY created_at DESC LIMIT 500')->fetchAll();
        $site = [];
        if (!empty($_GET['site'])) {
            foreach (glob(docroot() . '/satin/img/*.{webp,jpg,jpeg,png,gif,svg}', GLOB_BRACE) ?: [] as $f) $site[] = ['url' => '/satin/img/' . basename($f), 'name' => basename($f)];
        }
        json_out(['media' => array_map(function ($m) { $k = strpos($m['mime'], 'image/svg') === 0 ? 'vector' : (strpos($m['mime'], 'image/') === 0 ? 'image' : (strpos($m['mime'], 'font/') === 0 ? 'font' : (strpos($m['mime'], 'video/') === 0 ? 'video' : (strpos($m['mime'], 'audio/') === 0 ? 'audio' : 'lottie')))); return ['id' => $m['id'], 'url' => $m['url'], 'name' => $m['name'], 'kind' => $k, 'mime' => $m['mime'], 'width' => (int)$m['width'], 'height' => (int)$m['height'], 'bytes' => (int)$m['bytes'], 'createdAt' => $m['created_at'], 'createdBy' => $m['created_by']]; }, $rows), 'site' => $site]);
    }
    if ($r === '/media/upload' && $method === 'POST') {
        $u = require_user('site.edit');
        if (rate_limited('upload:' . $u['id'], 160, 3600)) json_out(['error' => 'Too many uploads. Try again later.'], 429);
        $f = $_FILES['file'] ?? null;
        if (!$f || !is_array($f) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK) json_out(['error' => 'Upload failed. The file may be too large for the server.'], 400);
        $origExt = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
        $head = (string)@file_get_contents($f['tmp_name'], false, null, 0, 64);
        $sub = '/cms/uploads/' . gmdate('Y/m');
        $dir = docroot() . $sub;
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) json_out(['error' => 'Could not save the file.'], 500);
        ensure_upload_guard();
        $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo((string)$f['name'], PATHINFO_FILENAME))), '-') ?: 'file';
        $rand = '-' . bin2hex(random_bytes(4));
        $w = 0; $h = 0; $mime = ''; $ext = ''; $saved = false; $kind = 'image';
        // non-image media: vectors, fonts, video, audio, Lottie animations
        $other = null;
        if ($origExt === 'svg' || preg_match('/^\s*(<\?xml|<svg)/i', $head)) $other = 'svg';
        elseif (in_array($origExt, ['woff2', 'woff', 'ttf', 'otf'], true)) $other = 'font';
        elseif (in_array($origExt, ['mp4', 'webm', 'mov'], true)) $other = 'video';
        elseif (in_array($origExt, ['mp3', 'm4a', 'ogg', 'wav'], true)) $other = 'audio';
        elseif ($origExt === 'json') $other = 'lottie';
        if ($other) {
            $limits = ['svg' => 2, 'font' => 6, 'video' => 80, 'audio' => 25, 'lottie' => 4];
            if ($f['size'] > $limits[$other] * 1024 * 1024) json_out(['error' => 'This file is too large (max ' . $limits[$other] . ' MB).'], 400);
            $data = (string)file_get_contents($f['tmp_name']);
            if ($other === 'svg') { $data = clean_svg($data); if ($data === '') json_out(['error' => 'This SVG could not be read safely.'], 400); $ext = 'svg'; $mime = 'image/svg+xml'; if (preg_match('/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/', $data, $vb)) { $w = (int)$vb[1]; $h = (int)$vb[2]; } $kind = 'vector'; }
            elseif ($other === 'font') {
                $sig = substr($data, 0, 4);
                $map = ['wOF2' => 'woff2', 'wOFF' => 'woff', 'OTTO' => 'otf', "\x00\x01\x00\x00" => 'ttf', 'true' => 'ttf'];
                if (!isset($map[$sig])) json_out(['error' => 'Use a WOFF2, WOFF, TTF or OTF font file.'], 400);
                $ext = $map[$sig]; $mime = 'font/' . $ext; $kind = 'font';
            } elseif ($other === 'video') {
                if (substr($data, 4, 4) === 'ftyp') { $ext = 'mp4'; $mime = 'video/mp4'; } elseif (substr($data, 0, 4) === "\x1A\x45\xDF\xA3") { $ext = 'webm'; $mime = 'video/webm'; } else json_out(['error' => 'Use an MP4 or WebM video.'], 400);
                $kind = 'video';
            } elseif ($other === 'audio') {
                $s4 = substr($data, 0, 4);
                if (substr($data, 0, 3) === 'ID3' || (ord($data[0] ?? "\0") === 0xFF && (ord($data[1] ?? "\0") & 0xE0) === 0xE0)) { $ext = 'mp3'; $mime = 'audio/mpeg'; }
                elseif (substr($data, 4, 4) === 'ftyp') { $ext = 'm4a'; $mime = 'audio/mp4'; } elseif ($s4 === 'OggS') { $ext = 'ogg'; $mime = 'audio/ogg'; } elseif ($s4 === 'RIFF') { $ext = 'wav'; $mime = 'audio/wav'; }
                else json_out(['error' => 'Use an MP3, M4A, OGG or WAV file.'], 400);
                $kind = 'audio';
            } else {
                $j = json_decode($data, true);
                if (!is_array($j) || !isset($j['layers'], $j['v'])) json_out(['error' => 'This is not a Lottie animation file.'], 400);
                $data = json_encode($j, JSON_UNESCAPED_SLASHES); $ext = 'json'; $mime = 'application/json'; $w = (int)($j['w'] ?? 0); $h = (int)($j['h'] ?? 0); $kind = 'lottie';
            }
            $name = substr($base, 0, 40) . $rand . '.' . $ext;
            if (in_array($other, ['svg', 'lottie'], true)) $saved = atomic_write("$dir/$name", $data);
            else $saved = move_uploaded_file($f['tmp_name'], "$dir/$name");
            if (!$saved) json_out(['error' => 'Could not save the file.'], 500);
        } else {
            if ($f['size'] > 12 * 1024 * 1024) json_out(['error' => 'Images must be under 12 MB.'], 400);
            $info = @getimagesize($f['tmp_name']);
            $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp', IMAGETYPE_GIF => 'gif'];
            if (!$info || !isset($types[$info[2]])) json_out(['error' => 'Use a JPG, PNG, WebP, GIF or SVG image, a font, MP4 video, MP3 audio or Lottie JSON.'], 400);
            $ext = $types[$info[2]]; $mime = $info['mime'];
            $name = substr($base, 0, 40) . $rand . '.' . $ext;
            [$w, $h] = [$info[0], $info[1]];
            // Large photos are scaled down to 2400px so pages stay fast.
            if (in_array($ext, ['jpg', 'png', 'webp'], true) && max($w, $h) > 2400 && function_exists('imagecreatetruecolor')) {
                $src = $ext === 'jpg' ? @imagecreatefromjpeg($f['tmp_name']) : ($ext === 'png' ? @imagecreatefrompng($f['tmp_name']) : (function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($f['tmp_name']) : false));
                if ($src) {
                    $sc = 2400 / max($w, $h); $nw = (int)round($w * $sc); $nh = (int)round($h * $sc);
                    $dst = imagecreatetruecolor($nw, $nh); imagealphablending($dst, false); imagesavealpha($dst, true);
                    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
                    $saved = $ext === 'jpg' ? imagejpeg($dst, "$dir/$name", 84) : ($ext === 'png' ? imagepng($dst, "$dir/$name", 7) : imagewebp($dst, "$dir/$name", 84));
                    if ($saved) { $w = $nw; $h = $nh; }
                }
            }
            if (!$saved && !move_uploaded_file($f['tmp_name'], "$dir/$name")) json_out(['error' => 'Could not save the image.'], 500);
        }
        @chmod("$dir/$name", 0644);
        $id = uuid(); $url = "$sub/$name"; $bytes = (int)filesize("$dir/$name");
        $pdo->prepare('INSERT INTO site_media (id,url,name,mime,width,height,bytes,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)')->execute([$id, $url, mb_substr((string)$f['name'], 0, 120), $mime, $w, $h, $bytes, now_iso(), $u['name']]);
        audit($u, 'uploaded media', $url);
        json_out(['ok' => true, 'media' => ['id' => $id, 'url' => $url, 'name' => (string)$f['name'], 'width' => $w, 'height' => $h, 'bytes' => $bytes, 'kind' => $kind, 'mime' => $mime]]);
    }

    /* ---------- saved section templates ---------- */
    if ($r === '/site/templates' && $method === 'GET') { require_user('site.edit'); json_out(['templates' => setting_get('section_templates') ?: []]); }
    if ($r === '/site/templates/save' && $method === 'POST') {
        $u = require_user('site.edit');
        $v = body_json(400000);
        $name = cms_str($v['name'] ?? '', 60);
        if ($name === '') json_out(['error' => 'Give the template a name.'], 400);
        $c = cms_content(['blocks' => isset($v['block']) ? [$v['block']] : [], 'els' => $v['els'] ?? [], 'sections' => isset($v['section']) ? [$v['section']] : []]);
        $list = setting_get('section_templates') ?: [];
        array_unshift($list, ['id' => bin2hex(random_bytes(6)), 'name' => $name, 'block' => $c['blocks'][0] ?? null, 'section' => $c['sections'][0] ?? null, 'els' => $c['els'], 'createdAt' => now_iso(), 'createdBy' => $u['name']]);
        setting_set('section_templates', array_slice($list, 0, 60));
        json_out(['ok' => true, 'templates' => setting_get('section_templates')]);
    }
    if ($r === '/site/templates/delete' && $method === 'POST') {
        require_user('site.edit');
        $id = (string)(body_json(2000)['id'] ?? '');
        setting_set('section_templates', array_values(array_filter(setting_get('section_templates') ?: [], function ($t) use ($id) { return ($t['id'] ?? '') !== $id; })));
        json_out(['ok' => true, 'templates' => setting_get('section_templates')]);
    }
    if ($r === '/media/delete' && $method === 'POST') {
        $u = require_user('site.edit');
        $id = (string)(body_json(2000)['id'] ?? '');
        $q = $pdo->prepare('SELECT * FROM site_media WHERE id = ?'); $q->execute([$id]); $m = $q->fetch();
        if (!$m) json_out(['error' => 'Image not found'], 404);
        $file = realpath(docroot() . $m['url']);
        $up = realpath(docroot() . '/cms/uploads');
        if ($file && $up && strpos($file, $up . '/') === 0) @unlink($file);
        $pdo->prepare('DELETE FROM site_media WHERE id = ?')->execute([$id]);
        audit($u, 'deleted image', $m['url']);
        json_out(['ok' => true]);
    }

    json_out(['error' => 'Not found'], 404);
}

function ensure_upload_guard(): void {
    $f = docroot() . '/cms/uploads/.htaccess';
    if (is_file($f) && strpos((string)@file_get_contents($f), '# guard v3') !== false) return;
    @file_put_contents($f, "# guard v3\nOptions -Indexes -ExecCGI\nRemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar .cgi .pl .py\nRemoveType .php .phtml .phar\n<FilesMatch \"\\.(?i:php\\d?|phtml|phar|cgi|pl|py|sh|html?|js|mjs|xml|xhtml)$\">\nRequire all denied\n</FilesMatch>\nAddType image/svg+xml .svg\nAddType font/woff2 .woff2\nAddType font/woff .woff\nAddType font/ttf .ttf\nAddType font/otf .otf\nAddType application/json .json\n<IfModule mod_headers.c>\nHeader always set X-Content-Type-Options nosniff\n<FilesMatch \"\\.(?i:svg|json)$\">\nHeader always set Content-Security-Policy \"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox\"\n</FilesMatch>\n<FilesMatch \"\\.(?i:woff2?|ttf|otf|svg|json|mp4|webm|mp3|m4a|ogg|wav)$\">\nHeader set Cache-Control \"public, max-age=2592000\"\n</FilesMatch>\n</IfModule>\n");
}

// Keeps only drawing elements and presentation attributes of an SVG file.
function clean_svg(string $svg): string {
    if (strlen($svg) > 2 * 1024 * 1024 || stripos($svg, '<!ENTITY') !== false || stripos($svg, '<!DOCTYPE') !== false) return '';
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $ok = $doc->loadXML($svg, LIBXML_NONET);
    libxml_clear_errors(); libxml_use_internal_errors($prev);
    if (!$ok || !$doc->documentElement || strtolower($doc->documentElement->localName) !== 'svg') return '';
    $allowedTags = ['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'title', 'desc', 'symbol', 'use', 'text', 'tspan', 'pattern', 'filter', 'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'femerge', 'femergenode', 'feflood', 'fecomposite', 'style'];
    $walk = function (DOMNode $n) use (&$walk, $allowedTags) {
        foreach (iterator_to_array($n->childNodes) as $c) {
            if ($c instanceof DOMElement) {
                $ln = strtolower($c->localName);
                if (!in_array($ln, $allowedTags, true)) {
                    if (in_array($ln, ['script', 'foreignobject', 'iframe', 'embed', 'object', 'image', 'feimage', 'animate', 'animatemotion', 'animatetransform', 'set', 'handler', 'listener', 'audio', 'video'], true)) { $n->removeChild($c); continue; }
                    // harmless wrappers such as <a> or <switch>: keep their drawing
                    $walk($c);
                    while ($c->firstChild) $n->insertBefore($c->firstChild, $c);
                    $n->removeChild($c); continue;
                }
                if (strtolower($c->localName) === 'style' && preg_match('/@import|url\s*\(\s*["\']?\s*(?!#)|expression|javascript:/i', $c->textContent)) { $n->removeChild($c); continue; }
                foreach (iterator_to_array($c->attributes) as $a) {
                    $an = strtolower($a->nodeName); $av = trim($a->nodeValue);
                    if (strpos($an, 'on') === 0 || preg_match('/javascript:|data:(?!image\/(png|jpe?g|gif|webp))|expression\(/i', $av)) { $c->removeAttribute($a->nodeName); continue; }
                    if (in_array($an, ['href', 'xlink:href'], true) && $av !== '' && $av[0] !== '#') $c->removeAttribute($a->nodeName);
                    if ($an === 'style' && preg_match('/url\s*\(\s*["\']?\s*(?!#)/i', $av)) $c->removeAttribute($a->nodeName);
                }
                $walk($c);
            } elseif (!($c instanceof DOMText) && !($c instanceof DOMCdataSection)) $n->removeChild($c);
        }
    };
    $root = $doc->documentElement;
    foreach (iterator_to_array($root->attributes) as $a) if (strpos(strtolower($a->nodeName), 'on') === 0) $root->removeAttribute($a->nodeName);
    $walk($root);
    return (string)$doc->saveXML($root);
}

function new_page_html(string $tpl, string $path, string $title, string $desc): string {
    $t = attr($title); $d = attr($desc ?: $title . ' — Satin Graphic, Vaughan.');
    $url = attr(site_url() . $path . '/');
    $h = preg_replace('#<title>.*?</title>#s', "<title>$t | Satin Graphic</title>", $tpl, 1);
    $h = preg_replace('#(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*(")#', '${1}' . $t . '${2}', $h);
    $h = preg_replace('#(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")#', '${1}' . $d . '${2}', $h);
    $h = preg_replace('#(<link rel="canonical" href=")[^"]*(")#', '${1}' . $url . '${2}', $h);
    $h = preg_replace('#(<meta property="og:url" content=")[^"]*(")#', '${1}' . $url . '${2}', $h);
    $h = preg_replace('#<link rel="alternate" hreflang[^>]*>#', '', $h);
    $h = preg_replace('#<script type="application/ld\+json"[^>]*>.*?</script>#s', '', $h);
    $h = preg_replace('#data-prerender-path="[^"]*"#', 'data-prerender-path="' . attr(substr($path, strlen('/satin')) ?: '/') . '"', $h, 1);
    $home = preg_match('#^/satin/(fa|fr|es)(/|$)#', $path, $lm) ? '/satin/' . $lm[1] . '/' : '/satin/';
    $main = '<div class="page-enter"><section class="phero" data-cms-section="s0"><div class="wrap in"><div class="txt"><nav aria-label="Breadcrumb" class="crumbs"><a href="' . $home . '">Home</a><span class="sep">/</span><span aria-current="page">' . $t . '</span></nav>'
        . '<h1 class="d1" data-cms-id="e0">' . $t . '</h1>' . ($desc !== '' ? '<p class="lede" data-cms-id="e1">' . attr($desc) . '</p>' : '') . '</div></div></section></div>';
    $a = strpos($h, '<main'); $b = strpos($h, '</main>');
    if ($a !== false && $b !== false) { $open = substr($h, $a, strpos($h, '>', $a) - $a + 1); $h = substr($h, 0, $a) . $open . $main . substr($h, $b); }
    return $h;
}
