<?php
declare(strict_types=1);
// Minimal print-ready PDF writer (no Composer): one full-bleed raster image per page, MediaBox = trim + bleed, TrimBox = trim.
// Every page image is written as DeviceCMYK (see ppdf_image).

/**
 * RGB → CMYK ink bytes, same conversion as the Design Studio (studio/cmyk.mjs rgbToCmyk): full grey-component
 * replacement, so neutral greys and black print with K only. No ICC profile is applied.
 * Returns ['cmyk' => interleaved CMYK bytes, 'alpha' => grey bytes or null when every pixel is opaque].
 */
function ppdf_cmyk_pixels($im, int $w, int $h, bool $alpha): array {
    $cmyk = ''; $a = ''; $any = false; $cache = [];
    for ($y = 0; $y < $h; $y++) {
        $row = ''; $rowA = '';
        for ($x = 0; $x < $w; $x++) {
            $c = imagecolorat($im, $x, $y);
            if ($alpha) { $al = ($c >> 24) & 0x7F; $rowA .= chr(255 - (int)round($al * 255 / 127)); if ($al) $any = true; }
            $c &= 0xFFFFFF;
            if (!isset($cache[$c])) {
                if (count($cache) > 250000) $cache = [];
                $C = 255 - (($c >> 16) & 255); $M = 255 - (($c >> 8) & 255); $Y = 255 - ($c & 255); $k = min($C, $M, $Y);
                if ($k >= 255) $cache[$c] = "\0\0\0\xFF";
                else { $s = 255 / (255 - $k); $cache[$c] = chr((int)(($C - $k) * $s + 0.5)) . chr((int)(($M - $k) * $s + 0.5)) . chr((int)(($Y - $k) * $s + 0.5)) . chr($k); }
            }
            $row .= $cache[$c];
        }
        $cmyk .= $row; if ($alpha) $a .= $rowA;
    }
    return ['cmyk' => $cmyk, 'alpha' => $any ? $a : null];
}

/** Does the JPEG carry an Adobe APP14 marker (CMYK samples stored inverted)? */
function ppdf_jpeg_adobe(string $b): bool {
    $n = strlen($b); $i = 2;
    while ($i + 11 < $n) {
        if ($b[$i] !== "\xFF") { $i++; continue; }
        $m = ord($b[$i + 1]);
        if ($m === 0xDA || $m === 0xD9) return false;
        if ($m === 0xEE && substr($b, $i + 4, 5) === 'Adobe') return true;
        if ($m === 0xD8 || $m === 0x01 || ($m >= 0xD0 && $m <= 0xD7)) { $i += 2; continue; }
        $i += 2 + ((ord($b[$i + 2]) << 8) | ord($b[$i + 3]));
    }
    return false;
}

/** '#rrggbb' → ['hex' => …, 'cmyk' => [c, m, y, k] in %], same conversion as the print rasters. */
function ppdf_swatch(string $hex): array {
    $n = hexdec(substr($hex, 1, 6)); $C = 255 - (($n >> 16) & 255); $M = 255 - (($n >> 8) & 255); $Y = 255 - ($n & 255); $k = min($C, $M, $Y);
    $v = $k >= 255 ? [0, 0, 0, 255] : [($C - $k) * 255 / (255 - $k), ($M - $k) * 255 / (255 - $k), ($Y - $k) * 255 / (255 - $k), $k];
    return ['hex' => strtolower($hex), 'cmyk' => array_map(fn($x) => (int)round($x * 100 / 255), $v)];
}

/** Colours used in a Design Studio design (backgrounds that are not white, text / shape colours, gradient ends). */
function ppdf_design_swatches(array $design): array {
    $seen = [];
    $add = function ($c) use (&$seen) { if (is_string($c) && preg_match('/^#[0-9a-f]{6}$/i', $c)) $seen[strtolower($c)] = true; };
    foreach ((array)($design['sides'] ?? []) as $sd) {
        if (!is_array($sd)) continue;
        if (strtolower((string)($sd['background'] ?? '')) !== '#ffffff') $add($sd['background'] ?? null);
        foreach ((array)($sd['layers'] ?? []) as $l) { if (!is_array($l) || ($l['type'] ?? '') === 'image') continue; $add($l['color'] ?? null); $add($l['gradient']['to'] ?? null); }
    }
    return array_map('ppdf_swatch', array_slice(array_keys($seen), 0, 24));
}

/** PDF content operators: a row of CMYK swatches (vector fills, operator k) with their CMYK code and hex. */
function ppdf_swatch_ops(array $list, float $x0, float $y0, float $size, float $maxW, callable $f, callable $esc): string {
    $ops = ''; $x = $x0; $fs = max(4, $size * 0.22);
    foreach ($list as $s) {
        $lab = 'C' . $s['cmyk'][0] . ' M' . $s['cmyk'][1] . ' Y' . $s['cmyk'][2] . ' K' . $s['cmyk'][3];
        $w = max($size, $fs * 0.56 * max(strlen($lab), strlen($s['hex'])));
        if ($x + $w > $x0 + $maxW) break;
        $k = implode(' ', array_map(fn($v) => $f($v / 100), $s['cmyk']));
        $ops .= "q $k k {$f($x)} {$f($y0 + $fs * 2.6)} {$f($size)} {$f($size)} re f 0 0 0 .5 K {$f(max(.3, $size / 80))} w {$f($x)} {$f($y0 + $fs * 2.6)} {$f($size)} {$f($size)} re S Q\n";
        $ops .= "BT /F1 {$f($fs)} Tf 0 0 0 1 k {$f($x)} {$f($y0 + $fs * 1.35)} Td " . $esc($lab) . " Tj ET\nBT /F1 {$f($fs * .85)} Tf 0 0 0 .6 k {$f($x)} {$f($y0 + $fs * .25)} Td " . $esc(strtoupper($s['hex'])) . " Tj ET\n";
        $x += $w + $size * 0.35;
    }
    return $ops;
}

/**
 * Converts image bytes to a PDF image XObject description. Print files are always DeviceCMYK:
 * CMYK JPEGs (Design Studio print rasters, Photoshop files) pass through; RGB/grey JPEG, PNG, WebP and GIF are
 * converted with ppdf_cmyk_pixels (FlateDecode, transparency kept as an SMask). Without GD, RGB JPEGs stay RGB.
 */
function ppdf_image(string $bin): array {
    $sz = @getimagesizefromstring($bin);
    if (!$sz) throw new RuntimeException('Unreadable image');
    [$w, $h] = [(int)$sz[0], (int)$sz[1]];
    $jpeg = $sz['mime'] === 'image/jpeg'; $ch = (int)($sz['channels'] ?? 3);
    if ($jpeg && $ch === 4) { // CMYK JPEG: plain samples (current Design Studio) or Adobe-inverted (APP14 marker: Photoshop, older studio files)
        $img = ['data' => $bin, 'w' => $w, 'h' => $h, 'bpc' => 8, 'filter' => 'DCTDecode', 'cs' => 'DeviceCMYK'];
        if (ppdf_jpeg_adobe($bin)) $img['decode'] = '[1 0 1 0 1 0 1 0]';
        return $img;
    }
    if (!function_exists('imagecreatefromstring')) {
        if ($jpeg) return ['data' => $bin, 'w' => $w, 'h' => $h, 'bpc' => 8, 'filter' => 'DCTDecode', 'cs' => $ch === 1 ? 'DeviceGray' : 'DeviceRGB'];
        throw new RuntimeException('The GD extension is needed to convert this image');
    }
    @ini_set('memory_limit', '1024M');
    $im = @imagecreatefromstring($bin);
    if (!$im) throw new RuntimeException('Unreadable image');
    imagepalettetotruecolor($im);
    $alpha = false;
    if ($sz['mime'] === 'image/png') { $ct = ord($bin[25] ?? "\0"); $alpha = $ct === 4 || $ct === 6 || strpos($bin, 'tRNS') !== false; }
    elseif ($sz['mime'] === 'image/webp' || $sz['mime'] === 'image/gif') $alpha = true;
    $px = ppdf_cmyk_pixels($im, $w, $h, $alpha);
    imagedestroy($im);
    $img = ['data' => gzcompress($px['cmyk'], 6), 'w' => $w, 'h' => $h, 'bpc' => 8, 'filter' => 'FlateDecode', 'cs' => 'DeviceCMYK'];
    if ($px['alpha'] !== null) $img['smask'] = ['data' => gzcompress($px['alpha'], 6), 'w' => $w, 'h' => $h, 'bpc' => 8, 'filter' => 'FlateDecode', 'cs' => 'DeviceGray'];
    return $img;
}

/**
 * $pages: list of ['trimW' => in, 'trimH' => in, 'bleed' => in, 'image' => bytes].
 * The image is scaled to cover the whole page (trim + bleed), centred.
 */
function ppdf_build(array $pages, string $title, array $opts = []): string {
    $sw = array_slice((array)($opts['swatches'] ?? []), 0, 24);
    $objs = []; // index => body (object number = index + 1)
    $new = function (string $body = '') use (&$objs): int { $objs[] = $body; return count($objs); };
    $catalog = $new(); $tree = $new(); $kids = [];
    $font = $new('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    $esc = fn(string $t): string => '(' . strtr(preg_replace('/[^\x20-\x7E]/', '', $t), ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']) . ')';
    $f = fn(float $n): string => rtrim(rtrim(number_format($n, 4, '.', ''), '0'), '.');
    $stream = fn(array $dict, string $data): string => '<< ' . implode(' ', $dict) . ' /Length ' . strlen($data) . " >>\nstream\n" . $data . "\nendstream";
    foreach ($pages as $p) {
        $img = ppdf_image($p['image']);
        $W = ($p['trimW'] + 2 * $p['bleed']) * 72; $H = ($p['trimH'] + 2 * $p['bleed']) * 72; $b = $p['bleed'] * 72;
        // slug under the bleed box: the design's colours as CMYK swatches (sized to the page, never huge)
        $sq = $sw ? min(1.2, max(.3, min($W, $H) / 72 * .05)) * 72 : 0; $S = $sw ? $sq * 1.9 : 0;
        // pages over 200 in (e.g. box-truck sides) use /UserUnit: viewers cap page boxes at 14400 units
        $uu = max(1, (int)ceil(max($W, $H + $S) / 14400)); $W /= $uu; $H /= $uu; $b /= $uu; $S /= $uu; $sq /= $uu;
        $dict = ['/Type /XObject', '/Subtype /Image', '/Width ' . $img['w'], '/Height ' . $img['h'], '/ColorSpace /' . $img['cs'], '/BitsPerComponent ' . $img['bpc'], '/Filter /' . $img['filter']];
        if (isset($img['decode'])) $dict[] = '/Decode ' . $img['decode'];
        if (isset($img['smask'])) { $m = $img['smask']; $sm = $new($stream(['/Type /XObject', '/Subtype /Image', '/Width ' . $m['w'], '/Height ' . $m['h'], '/ColorSpace /DeviceGray', '/BitsPerComponent 8', '/Filter /FlateDecode'], $m['data'])); $dict[] = "/SMask $sm 0 R"; }
        $im = $new($stream($dict, $img['data']));
        $s = max($W / $img['w'], $H / $img['h']); $dw = $img['w'] * $s; $dh = $img['h'] * $s;
        $content = 'q ' . $f($W) . ' 0 0 ' . $f($H) . ' 0 ' . $f($S) . " cm 0 0 1 1 re W n " . $f($dw / $W) . ' 0 0 ' . $f($dh / $H) . ' ' . $f(($W - $dw) / 2 / $W) . ' ' . $f(($H - $dh) / 2 / $H) . " cm /Im0 Do Q\n";
        if ($sw) $content .= ppdf_swatch_ops($sw, 0, $S * .08, $sq, $W, $f, $esc);
        $c = $new($stream([], $content));
        $kids[] = $new("<< /Type /Page /Parent $tree 0 R " . ($uu > 1 ? "/UserUnit $uu " : '') . "/MediaBox [0 0 {$f($W)} {$f($H + $S)}] /BleedBox [0 {$f($S)} {$f($W)} {$f($H + $S)}] /TrimBox [{$f($b)} {$f($S + $b)} {$f($W - $b)} {$f($H + $S - $b)}] /Resources << /XObject << /Im0 $im 0 R >> /Font << /F1 $font 0 R >> >> /Contents $c 0 R >>");
    }
    // last page: the customer's mockup (which vehicle / product the artwork was designed on), 11 × 8.5 in landscape
    if (!empty($opts['mockup'])) {
        try {
            $img = ppdf_image((string)$opts['mockup']);
            $dict = ['/Type /XObject', '/Subtype /Image', '/Width ' . $img['w'], '/Height ' . $img['h'], '/ColorSpace /' . $img['cs'], '/BitsPerComponent 8', '/Filter /' . $img['filter']];
            if (isset($img['decode'])) $dict[] = '/Decode ' . $img['decode'];
            if (isset($img['smask'])) { $m = $img['smask']; $sm = $new($stream(['/Type /XObject', '/Subtype /Image', '/Width ' . $m['w'], '/Height ' . $m['h'], '/ColorSpace /DeviceGray', '/BitsPerComponent 8', '/Filter /FlateDecode'], $m['data'])); $dict[] = "/SMask $sm 0 R"; }
            $im = $new($stream($dict, $img['data']));
            $W = 792; $H = 612; $mg = 36; $lines = array_slice((array)($opts['mockupLines'] ?? []), 0, 3);
            $ops = "BT /F1 16 Tf 0 0 0 1 k $mg " . ($H - $mg - 12) . ' Td ' . $esc((string)($opts['mockupTitle'] ?? 'Mockup')) . " Tj ET\n";
            foreach ($lines as $i => $t) $ops .= "BT /F1 9 Tf 0 0 0 .7 k $mg " . ($H - $mg - 30 - $i * 12) . ' Td ' . $esc((string)$t) . " Tj ET\n";
            $top = $H - $mg - 36 - count($lines) * 12; $bottom = $mg + ($sw ? 58 : 0); $aw = $W - 2 * $mg; $ah = $top - $bottom;
            $k = min($aw / $img['w'], $ah / $img['h']); $dw = $img['w'] * $k; $dh = $img['h'] * $k;
            $ops .= "q {$f($dw)} 0 0 {$f($dh)} {$f($mg + ($aw - $dw) / 2)} {$f($bottom + ($ah - $dh) / 2)} cm /Im0 Do Q\n";
            if ($sw) $ops .= "BT /F1 9 Tf 0 0 0 1 k $mg " . ($mg + 48) . " Td (Colours used \\(CMYK\\)) Tj ET\n" . ppdf_swatch_ops($sw, $mg, $mg, 22, $W - 2 * $mg, $f, $esc);
            $c = $new($stream([], $ops));
            $kids[] = $new("<< /Type /Page /Parent $tree 0 R /MediaBox [0 0 $W $H] /Resources << /XObject << /Im0 $im 0 R >> /Font << /F1 $font 0 R >> >> /Contents $c 0 R >>");
        } catch (Throwable $e) { error_log('satin print pdf mockup: ' . $e->getMessage()); }
    }
    $objs[$catalog - 1] = "<< /Type /Catalog /Pages $tree 0 R >>";
    $objs[$tree - 1] = '<< /Type /Pages /Kids [' . implode(' ', array_map(fn($k) => "$k 0 R", $kids)) . '] /Count ' . count($kids) . ' >>';
    $info = $new('<< /Title ' . $esc($title) . ' /Subject (Print-ready artwork, DeviceCMYK) /Producer (Satin Graphic) /CreationDate (D:' . gmdate('YmdHis') . "Z) >>");
    $out = "%PDF-1.6\n%\xE2\xE3\xCF\xD3\n"; $off = [];
    foreach ($objs as $i => $body) { $off[] = strlen($out); $out .= ($i + 1) . " 0 obj\n" . $body . "\nendobj\n"; }
    $x = strlen($out);
    $out .= "xref\n0 " . (count($objs) + 1) . "\n0000000000 65535 f \n";
    foreach ($off as $o) $out .= sprintf("%010d 00000 n \n", $o);
    return $out . "trailer\n<< /Size " . (count($objs) + 1) . " /Root $catalog 0 R /Info $info 0 R >>\nstartxref\n$x\n%%EOF\n";
}

