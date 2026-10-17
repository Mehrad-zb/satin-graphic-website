<?php
declare(strict_types=1);
/*
 * External images on our own host.
 *
 * seo_pass.py rewrites every external image URL in the built site (supplier apparel photos, Google review photos,
 * brand logos …) to /satin/img/ext/<sha1-16>.<ext> and writes data/ext-images.json  {"<sha1-16>.<ext>": "https://…"}.
 * The first request for a file that is not on disk yet is routed here (.htaccess: !-f → api.php). The original URL is
 * taken from that manifest ONLY (never from the request), downloaded once (https, allow-listed host, public IP,
 * timeout, 15 MB cap, image/* check), saved in docroot/satin/img/ext/ and served; after that the web server serves the
 * static file. Admin → /admin/ext-images.html copies every missing file in small batches (no terminal needed);
 * CLI: php satin-new/ext_images.php --all   (or --status).
 */
require_once __DIR__ . '/lib.php';

const EXT_IMG_HOSTS = ['sinalite.com', 'www.sinalite.com', 'lh3.googleusercontent.com', 'dfmm8fty2renf.cloudfront.net'];
const EXT_IMG_TYPES = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif', 'svg' => 'image/svg+xml', 'avif' => 'image/avif'];
const EXT_IMG_MAX_BYTES = 15 * 1048576;
const EXT_IMG_MAX_WIDTH = 1600;     // larger photos are scaled down when GD is available
const EXT_IMG_RETRY_AFTER = 600;    // seconds before a failed download is tried again by a visitor request
const EXT_IMG_NAME_RX = '/^[0-9a-f]{16}\.(jpe?g|png|webp|gif|svg|avif)$/';

function ext_manifest(): array {
    static $m = null;
    if ($m === null) { $m = json_decode((string)@file_get_contents(DATA . '/ext-images.json'), true); if (!is_array($m)) $m = []; }
    return $m;
}
function ext_docroot(): string {
    $d = (string)cfg('docroot', '');
    if ($d === '') { $r = (string)($_SERVER['DOCUMENT_ROOT'] ?? ''); $d = ($r !== '' && is_dir($r . '/satin')) ? $r : (is_dir(dirname(__DIR__) . '/public_html/satin') ? dirname(__DIR__) . '/public_html' : dirname(__DIR__) . '/new.satingraphic.ca'); }
    return rtrim($d, '/');
}
function ext_dir(): string { return ext_docroot() . '/satin/img/ext'; }
function ext_state_dir(): string { $d = __DIR__ . '/storage/ext-images'; if (!is_dir($d)) @mkdir($d, 0755, true); return $d; }
function ext_failed(string $name): ?array {
    $f = ext_state_dir() . '/' . $name . '.fail';
    if (!is_file($f)) return null;
    $v = json_decode((string)@file_get_contents($f), true);
    return is_array($v) ? $v : ['at' => filemtime($f), 'error' => 'failed'];
}

/* Test copies only: config 'ext_images_test_hosts' => ['127.0.0.1'] lets a local http server stand in for the supplier. */
function ext_test_host(string $host): bool { $t = cfg('ext_images_test_hosts', []); return is_array($t) && in_array($host, $t, true); }

/* One HTTP GET without following redirects; the host is pinned to a public IP (no requests to the server's own network). */
function ext_http_get(string $url, bool $first): array {
    $u = parse_url($url);
    $host = strtolower((string)($u['host'] ?? '')); $scheme = strtolower((string)($u['scheme'] ?? ''));
    $test = ext_test_host($host);
    if ($host === '' || isset($u['user']) || isset($u['pass'])) return ['error' => 'bad URL'];
    if ($scheme !== 'https' && !($test && $scheme === 'http')) return ['error' => 'only https is allowed'];
    if ($first && !$test && !in_array($host, EXT_IMG_HOSTS, true)) return ['error' => 'host not allowed: ' . $host];
    $port = (int)($u['port'] ?? ($scheme === 'https' ? 443 : 80));
    $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
    $ip = null;
    foreach ($ips as $a) if ($test || filter_var($a, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) { $ip = $a; break; }
    if (!$ip) return ['error' => 'host does not resolve to a public address: ' . $host];
    $body = ''; $tooBig = false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_HEADER => false, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 25,
        CURLOPT_PROTOCOLS => $test ? (CURLPROTO_HTTP | CURLPROTO_HTTPS) : CURLPROTO_HTTPS,
        CURLOPT_RESOLVE => [$host . ':' . $port . ':' . $ip],
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; SatinGraphicImageCopy/1.0; +https://satingraphic.ca)',
        CURLOPT_HTTPHEADER => ['Accept: image/jpeg,image/png,image/gif,image/svg+xml,image/webp;q=0.8,image/*;q=0.5'],
        CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$body, &$tooBig) {
            if (strlen($body) + strlen($chunk) > EXT_IMG_MAX_BYTES) { $tooBig = true; return 0; }
            $body .= $chunk; return strlen($chunk);
        },
    ]);
    $ok = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $ctype = strtolower((string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE));
    $loc = (string)(curl_getinfo($ch, CURLINFO_REDIRECT_URL) ?: '');
    $err = curl_error($ch);
    curl_close($ch);
    if ($tooBig) return ['error' => 'larger than ' . (EXT_IMG_MAX_BYTES / 1048576) . ' MB'];
    if ($ok === false && $status === 0) return ['error' => 'download failed: ' . $err];
    return ['status' => $status, 'type' => $ctype, 'body' => $body, 'location' => $loc];
}

function ext_svg_safe(string $s): bool {
    return (bool)preg_match('/<svg[\s>]/i', $s) && !preg_match('/<script|<foreignobject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|<!entity|xlink:href\s*=\s*["\'](?!#|data:image\/)/i', $s);
}

/* Downloads one manifest entry and saves it. Returns [true, info] or [false, error]. */
function ext_fetch(string $name): array {
    if (!preg_match(EXT_IMG_NAME_RX, $name, $mm)) return [false, 'bad name'];
    $url = ext_manifest()[$name] ?? null;
    if (!is_string($url) || $url === '') return [false, 'not in the manifest'];
    $ext = $mm[1] === 'jpeg' ? 'jpg' : $mm[1];
    $dir = ext_dir(); $file = $dir . '/' . $name;
    if (is_file($file)) return [true, 'already saved'];
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) return [false, 'cannot create ' . $dir];
    $lock = fopen(ext_state_dir() . '/' . $name . '.lock', 'c');
    if ($lock) flock($lock, LOCK_EX);
    try {
        if (is_file($file)) return [true, 'already saved'];
        $r = null; $u = $url;
        for ($hop = 0; $hop < 4; $hop++) {
            $r = ext_http_get($u, $hop === 0);
            if (isset($r['error'])) break;
            if (in_array($r['status'], [301, 302, 303, 307, 308], true) && $r['location'] !== '') { $u = $r['location']; continue; }
            break;
        }
        $fail = function (string $e) use ($name, $url) {
            @file_put_contents(ext_state_dir() . '/' . $name . '.fail', json_encode(['at' => time(), 'error' => $e, 'url' => $url]));
            return [false, $e];
        };
        if (isset($r['error'])) return $fail($r['error']);
        if ($r['status'] !== 200) return $fail('HTTP ' . $r['status']);
        $body = $r['body'];
        if ($body === '') return $fail('empty response');
        if (!str_starts_with($r['type'], 'image/')) return $fail('not an image (' . ($r['type'] ?: 'no content type') . ')');
        if ($ext === 'svg') {
            if (!ext_svg_safe($body)) return $fail('SVG rejected (scripts or external references)');
        } else {
            $info = @getimagesizefromstring($body);
            if (!$info) return $fail('not a readable image');
            $want = EXT_IMG_TYPES[$ext];
            $gd = function_exists('imagecreatefromstring');
            // a server may answer with another format (e.g. WebP for a .jpg name): convert so the file matches its extension
            $im = null;
            if ($info['mime'] !== $want || ($gd && $info[0] > EXT_IMG_MAX_WIDTH && in_array($ext, ['jpg', 'png', 'webp'], true))) {
                if (!$gd || !($im = @imagecreatefromstring($body))) {
                    if ($info['mime'] !== $want) return $fail('format ' . $info['mime'] . ' does not match .' . $ext);
                } else {
                    if (imagesx($im) > EXT_IMG_MAX_WIDTH) {
                        $h = (int)max(1, round(imagesy($im) * EXT_IMG_MAX_WIDTH / imagesx($im)));
                        $sc = imagescale($im, EXT_IMG_MAX_WIDTH, $h, IMG_BICUBIC);
                        if ($sc) { imagedestroy($im); $im = $sc; }
                    }
                    ob_start(); $okw = false;
                    if ($ext === 'jpg') { $bg = imagecreatetruecolor(imagesx($im), imagesy($im)); imagefill($bg, 0, 0, imagecolorallocate($bg, 255, 255, 255)); imagecopy($bg, $im, 0, 0, 0, 0, imagesx($im), imagesy($im)); imageinterlace($bg, 1); $okw = imagejpeg($bg, null, 82); imagedestroy($bg); }
                    elseif ($ext === 'png') { imagealphablending($im, false); imagesavealpha($im, true); $okw = imagepng($im, null, 9); }
                    elseif ($ext === 'webp' && function_exists('imagewebp')) { imagealphablending($im, false); imagesavealpha($im, true); $okw = imagewebp($im, null, 80); }
                    elseif ($ext === 'gif') $okw = imagegif($im);
                    $out = (string)ob_get_clean(); imagedestroy($im);
                    if ($okw && $out !== '' && ($info['mime'] !== $want || strlen($out) < strlen($body))) $body = $out;
                    elseif ($info['mime'] !== $want) return $fail('could not convert ' . $info['mime'] . ' to .' . $ext);
                }
            }
        }
        $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, $body) !== strlen($body) || !@rename($tmp, $file)) { @unlink($tmp); return $fail('cannot write ' . $file); }
        @chmod($file, 0644);
        @unlink(ext_state_dir() . '/' . $name . '.fail');
        return [true, strlen($body) . ' bytes'];
    } finally {
        if ($lock) { flock($lock, LOCK_UN); fclose($lock); }
    }
}

/* GET/HEAD /satin/img/ext/<name> when the file is not on disk yet. */
function ext_serve(string $path): void {
    $name = basename($path);
    $nf = function (int $code, string $msg) { http_response_code($code); header('Cache-Control: no-store'); header('Content-Type: text/plain; charset=utf-8'); exit($msg); };
    if (!preg_match(EXT_IMG_NAME_RX, $name, $mm) || '/satin/img/ext/' . $name !== $path || !isset(ext_manifest()[$name])) $nf(404, 'Not found');
    $file = ext_dir() . '/' . $name;
    if (!is_file($file)) {
        $f = ext_failed($name);
        if ($f && time() - (int)($f['at'] ?? 0) < EXT_IMG_RETRY_AFTER) $nf(404, 'Image temporarily unavailable');
        [$ok] = ext_fetch($name);
        if (!$ok || !is_file($file)) $nf(404, 'Image unavailable');
    }
    $ext = $mm[1] === 'jpeg' ? 'jpg' : $mm[1];
    header('Content-Type: ' . EXT_IMG_TYPES[$ext]);
    header('Cache-Control: public, max-age=604800');
    header('X-Content-Type-Options: nosniff');
    if ($ext === 'svg') header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox");
    header('Content-Length: ' . filesize($file));
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') readfile($file);
    exit;
}

function ext_status(): array {
    $m = ext_manifest(); $dir = ext_dir(); $saved = 0; $failed = []; $missing = [];
    foreach ($m as $name => $url) {
        if (is_file($dir . '/' . $name)) { $saved++; continue; }
        $missing[] = $name;
        if ($f = ext_failed($name)) $failed[] = ['name' => $name, 'url' => $url, 'error' => (string)($f['error'] ?? ''), 'at' => gmdate('c', (int)($f['at'] ?? 0))];
    }
    return ['total' => count($m), 'saved' => $saved, 'missing' => count($missing), 'failed' => $failed, 'next' => $missing, 'dir' => '/satin/img/ext/'];
}

/* Copies up to $limit missing files within ~$budget seconds. Files that failed before $retryBefore (unix time) are tried
   again; 0 = skip every file that failed (a retry run passes its start time, so each failed file is retried once per run). */
function ext_warm(int $limit, int $retryBefore = 0, float $budget = 20.0): array {
    $skip = function (string $name) use ($retryBefore): bool { $f = ext_failed($name); return $f !== null && (int)($f['at'] ?? 0) >= $retryBefore; };
    $t0 = microtime(true); $done = []; $errors = [];
    $st = ext_status();
    foreach ($st['next'] as $name) {
        if (count($done) + count($errors) >= $limit || microtime(true) - $t0 > $budget) break;
        if ($skip($name)) continue;
        [$ok, $info] = ext_fetch($name);
        if ($ok) $done[] = $name; else $errors[] = ['name' => $name, 'error' => $info];
    }
    $st = ext_status(); unset($st['next']);
    $pending = 0; foreach (ext_manifest() as $name => $u) if (!is_file(ext_dir() . '/' . $name) && !$skip($name)) $pending++;
    return $st + ['copied' => $done, 'errors' => $errors, 'pending' => $pending];
}

/* /api/admin/ext-images (status) and /api/admin/ext-images/warm (POST {limit, retrySince}) — staff with "Edit business settings". */
function ext_admin_route(string $path, string $method): void {
    require_once __DIR__ . '/auth.php';
    header('X-Frame-Options: SAMEORIGIN');
    $u = require_user('settings.edit');
    if ($path === '/api/admin/ext-images' && $method === 'GET') { $s = ext_status(); unset($s['next']); json_out($s); }
    if ($path === '/api/admin/ext-images/warm' && $method === 'POST') {
        $v = body_json(2000);
        @set_time_limit(60);
        $since = (int)($v['retrySince'] ?? 0);
        $r = ext_warm(max(1, min(20, (int)($v['limit'] ?? 8))), $since > 0 ? min($since, time()) : 0);
        if ($r['copied']) audit($u, 'external images copied', count($r['copied']) . ' files');
        json_out($r);
    }
    json_out(['error' => 'Not found'], 404);
}

if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['argv'][0] ?? '')) === __FILE__) {
    $a = $_SERVER['argv'][1] ?? '--status';
    if ($a === '--all') {
        $since = in_array('--retry', $_SERVER['argv'], true) ? time() : 0;
        do { $r = ext_warm(20, $since, 120); foreach ($r['copied'] as $n) echo "saved  $n\n"; foreach ($r['errors'] as $e) echo "FAILED {$e['name']}: {$e['error']}\n"; }
        while (($r['copied'] || $r['errors']) && $r['pending'] > 0);
        echo "{$r['saved']} of {$r['total']} saved, {$r['missing']} missing\n";
    } else { $s = ext_status(); unset($s['next']); echo json_encode($s, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n"; }
}
