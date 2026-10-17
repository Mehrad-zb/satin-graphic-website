<?php
declare(strict_types=1);
// TrueType copies of Google Fonts for the Design Studio vector PDF (studio/vector.mjs turns text into outlines).
// GET /api/fonts/ttf?f=Family&w=400|700&i=0|1 → font/ttf. Google serves .ttf (not woff2) to clients without a browser
// user agent; the file is cached in storage/fonts so each style is downloaded once.

function ft_get(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_USERAGENT => '']);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return [$code, is_string($body) ? $body : ''];
}

function studio_font(): void {
    $fam = trim((string)($_GET['f'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9 ]{2,40}$/', $fam)) json_out(['error' => 'Bad font'], 400);
    $w = (int)($_GET['w'] ?? 400) >= 600 ? 700 : 400; $it = !empty($_GET['i']) ? 1 : 0;
    $dir = __DIR__ . '/storage/fonts'; if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $file = $dir . '/' . strtolower(str_replace(' ', '-', $fam)) . "-$w-$it.ttf";
    $serve = function (string $f) { if (is_file($f . '.syn')) header('X-Font-Synthetic-Italic: 1'); header('Access-Control-Expose-Headers: X-Font-Synthetic-Italic'); header('Content-Type: font/ttf'); header('Cache-Control: public, max-age=31536000, immutable'); header('Content-Length: ' . filesize($f)); readfile($f); exit; };
    if (is_file($file) && filesize($file) > 1000) $serve($file);
    // local fonts (test server): config font_dir with Family-Style.ttf files
    if ($local = cfg('font_dir')) {
        $style = ($w === 700 ? 'Bold' : '') . ($it ? 'Italic' : ''); $style = $style ?: 'Regular';
        $f = rtrim((string)$local, '/') . '/' . str_replace(' ', '', $fam) . '-' . $style . '.ttf';
        if (is_file($f)) $serve($f);
        json_out(['error' => 'Font not available'], 404);
    }
    if (is_file($file . '.fail') && filemtime($file . '.fail') > time() - 3600) json_out(['error' => 'Font not available'], 404);
    $q = str_replace(' ', '+', $fam);
    $tries = $it ? ["$q:ital,wght@1,$w", "$q:ital@1", "$q:wght@$w", $q] : ["$q:wght@$w", $q];
    foreach ($tries as $t) {
        [$code, $css] = ft_get('https://fonts.googleapis.com/css2?family=' . $t);
        if ($code !== 200) continue;
        if (!preg_match_all('#url\((https://fonts\.gstatic\.com/[^)\s]+\.ttf)\)#', $css, $m)) continue;
        [$c2, $ttf] = ft_get($m[1][0]);
        if ($c2 === 200 && strlen($ttf) > 1000 && in_array(substr($ttf, 0, 4), ["\x00\x01\x00\x00", 'true', 'OTTO'], true)) {
            file_put_contents($file . '.tmp', $ttf); rename($file . '.tmp', $file);
            // an italic request answered with the upright font is still useful (the studio slants it)
            if ($it && strpos($t, 'ital') === false) @touch($file . '.syn');
            $serve($file);
        }
    }
    @touch($file . '.fail');
    json_out(['error' => 'Font not available'], 404);
}
