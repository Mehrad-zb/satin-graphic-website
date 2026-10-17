<?php
// 404 handler: serves optimized images for legacy image URLs (same map as the original Worker), otherwise the site 404 page.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$map = json_decode((string)@file_get_contents(dirname(__DIR__) . '/satin-new/data/optimized-assets.json'), true) ?: [];
$target = $map[$path] ?? null;
if (!$target && preg_match('#^(/satin/img/.+?)(?:-(?:480|960|1100|1400))?\.(?:png|jpe?g|webp)$#', $path, $m) && is_file(__DIR__ . $m[1] . '.optimized.webp')) $target = $m[1] . '.optimized.webp';
if ($target && is_file(__DIR__ . $target) && strpos((string)realpath(__DIR__ . $target), __DIR__ . '/') === 0) {
    http_response_code(200);
    header('Content-Type: image/webp');
    header('Cache-Control: public, max-age=604800');
    header('Content-Length: ' . filesize(__DIR__ . $target));
    readfile(__DIR__ . $target);
    exit;
}
// project pages added in Admin → Our Work have no static file (normally routed to api.php by .htaccess)
if (preg_match('#^/satin/(?:(?:fa|fr|es)/)?portfolio/projects/[a-z0-9-]{1,120}/?$#', $path)) {
    try { require_once dirname(__DIR__) . '/satin-new/lib.php'; require_once dirname(__DIR__) . '/satin-new/portfolio.php'; if (pf_page($path)) exit; } catch (Throwable $e) { }
}
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/satin/404/index.html');
