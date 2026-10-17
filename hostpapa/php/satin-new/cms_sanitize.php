<?php
declare(strict_types=1);
// Validation for website-editor content. Everything stored here ends up on public pages,
// so only a strict whitelist of fields, styles and inline HTML is kept.

const CMS_FONTS = ['', 'Plus Jakarta Sans', 'Inter', 'Manrope', 'Vazirmatn', 'Estedad', 'system-ui', 'Georgia', 'Montserrat', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Oswald', 'Raleway', 'Playfair Display', 'Bebas Neue', 'DM Sans', 'Work Sans', 'Nunito', 'Anton', 'Archivo Black', 'Barlow', 'Inter Tight', 'Space Grotesk', 'Sora', 'Rubik', 'Kanit', 'Righteous', 'Orbitron', 'Teko', 'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Merriweather', 'Lora', 'Cormorant Garamond'];
const CMS_BLOCK_KINDS = ['text', 'image', 'text-image', 'image-text', 'gallery', 'cards', 'cta', 'video', 'spacer', 'divider', 'testimonial', 'button', 'faq', 'contact', 'stats', 'logos', 'blank', 'hscroll'];

function cms_str($v, int $max): string { return is_string($v) || is_numeric($v) ? mb_substr(trim((string)$v), 0, $max) : ''; }

function cms_color($v): ?string {
    $v = is_string($v) ? trim($v) : '';
    if (preg_match('/^#[0-9a-fA-F]{3,8}$/', $v)) return $v;
    if (preg_match('/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/', $v)) return $v;
    if (in_array($v, ['transparent', 'inherit', 'currentColor'], true)) return $v;
    return null;
}

function cms_url($v, bool $allowQuote = false): string {
    $v = is_string($v) ? trim($v) : '';
    if ($v === '') return '';
    if ($allowQuote && $v === 'quote:') return 'quote:';
    if (preg_match('#^(https?://|mailto:|tel:)#i', $v)) return mb_substr($v, 0, 600);
    if (preg_match('#^/(?!/)[^\s"\'<>\\\\]*$#', $v)) return mb_substr($v, 0, 600);
    if (preg_match('#^\#[\w-]{1,80}$#', $v)) return $v;
    return '';
}

function cms_img($v): string {
    $u = cms_url($v);
    if ($u === '' || preg_match('#^(mailto|tel):#i', $u) || $u[0] === '#') return '';
    return $u;
}

function cms_num($v, float $min, float $max): ?float {
    if (!is_numeric($v)) return null;
    $n = (float)$v; if ($n < $min || $n > $max) return null;
    return round($n, 3);
}

function cms_size($v): ?string {
    if (is_int($v) || is_float($v)) return ($v >= -5000 && $v <= 5000) ? round($v, 3) . 'px' : null;
    $v = is_string($v) ? trim($v) : '';
    return preg_match('/^(auto|-?\d{1,5}(\.\d{1,3})?(px|%|vw|vh|rem|em))$/', $v) ? $v : null;
}
function cms_gradient($g): ?array {
    if (!is_array($g) || !is_array($g['s'] ?? null)) return null;
    $stops = [];
    foreach (array_slice($g['s'], 0, 6) as $x) { if (!is_array($x)) continue; $c = cms_color($x['c'] ?? ''); $p = cms_num($x['p'] ?? 0, 0, 100); if ($c && $p !== null) $stops[] = ['c' => $c, 'p' => $p]; }
    if (count($stops) < 2) return null;
    $t = in_array($g['t'] ?? 'linear', ['linear', 'radial', 'conic'], true) ? $g['t'] : 'linear';
    return ['t' => $t, 'a' => cms_num($g['a'] ?? 180, 0, 360) ?? 180, 's' => $stops];
}
function cms_font_ok($f): bool {
    if (!is_string($f) || $f === '') return false;
    if (in_array($f, CMS_FONTS, true) || in_array($f, CMS_GOOGLE_FONTS, true)) return true;
    return (bool)preg_match('/^[A-Za-z0-9][\w -]{1,38}$/', $f); // uploaded custom fonts
}
function cms_style($s): array {
    if (!is_array($s)) return [];
    $o = [];
    $nums = ['fontSize' => [6, 400], 'fontWeight' => [100, 900], 'width' => [1, 100], 'maxWidth' => [40, 2400], 'height' => [10, 2000], 'minHeight' => [0, 3000],
        'borderRadius' => [0, 999], 'rTL' => [0, 999], 'rTR' => [0, 999], 'rBR' => [0, 999], 'rBL' => [0, 999],
        'padding' => [0, 400], 'paddingTop' => [0, 600], 'paddingBottom' => [0, 600], 'paddingX' => [0, 400], 'pt' => [0, 600], 'pr' => [0, 600], 'pb' => [0, 600], 'pl' => [0, 600],
        'marginTop' => [-600, 600], 'marginBottom' => [-600, 600], 'mt' => [-600, 600], 'mr' => [-600, 600], 'mb' => [-600, 600], 'ml' => [-600, 600],
        'opacity' => [0, 1], 'letterSpacing' => [-20, 80], 'wordSpacing' => [-20, 80], 'lineHeight' => [0.5, 5], 'objectPosition' => [0, 100], 'objectPosY' => [0, 100],
        'borderWidth' => [0, 60], 'bwT' => [0, 60], 'bwR' => [0, 60], 'bwB' => [0, 60], 'bwL' => [0, 60], 'gap' => [0, 400], 'columns' => [1, 12], 'rows' => [1, 12], 'zIndex' => [-10, 9999],
        'shX' => [-200, 200], 'shY' => [-200, 200], 'shBlur' => [0, 300], 'shSpread' => [-100, 200], 'ishX' => [-200, 200], 'ishY' => [-200, 200], 'ishBlur' => [0, 300], 'ishSpread' => [-100, 200],
        'tsX' => [-60, 60], 'tsY' => [-60, 60], 'tsBlur' => [0, 100], 'strokeW' => [0, 20], 'blur' => [0, 100], 'backdrop' => [0, 100],
        'brightness' => [0, 300], 'contrast' => [0, 300], 'saturate' => [0, 300], 'grayscale' => [0, 100], 'hue' => [0, 360], 'overlayOp' => [0, 1]];
    foreach ($nums as $k => [$a, $b]) if (array_key_exists($k, $s)) { $n = cms_num($s[$k], $a, $b); if ($n !== null) $o[$k] = $n; }
    foreach (['color', 'backgroundColor', 'borderColor', 'shColor', 'ishColor', 'tsColor', 'strokeColor', 'overlay', 'highlight'] as $k) if (isset($s[$k])) { $c = cms_color($s[$k]); if ($c) $o[$k] = $c; }
    foreach (['w', 'h', 'minW', 'maxW', 'minH', 'maxH', 'inT', 'inL', 'inR', 'inB'] as $k) if (isset($s[$k])) { $z = cms_size($s[$k]); if ($z !== null) $o[$k] = $z; }
    $enums = ['textAlign' => ['left', 'center', 'right', 'justify'], 'objectFit' => ['cover', 'contain', 'fill', 'none', 'scale-down'], 'textTransform' => ['none', 'uppercase', 'lowercase', 'capitalize'],
        'fontStyle' => ['normal', 'italic'], 'textDecoration' => ['none', 'underline', 'line-through', 'overline'], 'shadow' => ['none', 'sm', 'md', 'lg', 'xl'], 'align' => ['start', 'center', 'end'],
        'borderStyle' => ['solid', 'dashed', 'dotted', 'double', 'none'], 'blend' => ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'],
        'writing' => ['horizontal', 'vertical', 'vertical-up'], 'dir' => ['ltr', 'rtl'], 'bgSize' => ['cover', 'contain', 'auto'], 'bgRepeat' => ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'], 'bgAttach' => ['scroll', 'fixed'],
        'bgPos' => ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'], 'display' => ['block', 'flex', 'grid', 'inline-block', 'none'],
        'flexDir' => ['row', 'column', 'row-reverse', 'column-reverse'], 'justify' => ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly', 'stretch'], 'alignItems' => ['start', 'center', 'end', 'stretch', 'baseline'],
        'wrap' => ['nowrap', 'wrap'], 'overflow' => ['visible', 'hidden', 'auto', 'scroll'], 'pos' => ['static', 'relative', 'absolute', 'fixed', 'sticky'], 'listStyle' => ['none', 'disc', 'circle', 'square', 'decimal'],
        'textFill' => ['solid', 'gradient', 'image'], 'whiteSpace' => ['normal', 'nowrap', 'pre-line']];
    foreach ($enums as $k => $list) if (isset($s[$k]) && is_string($s[$k]) && in_array($s[$k], $list, true) && $s[$k] !== '') $o[$k] = $s[$k];
    if (isset($s['fontFamily']) && cms_font_ok($s['fontFamily'])) $o['fontFamily'] = $s['fontFamily'];
    if (isset($s['backgroundImage'])) { $u = cms_img($s['backgroundImage']); if ($u) $o['backgroundImage'] = $u; }
    foreach (['gradient', 'overlayG'] as $k) if (isset($s[$k])) { $g = cms_gradient($s[$k]); if ($g) $o[$k] = $g; }
    if (isset($s['aspect']) && is_string($s['aspect']) && preg_match('#^\d{1,4}\s*/\s*\d{1,4}$#', $s['aspect'])) $o['aspect'] = preg_replace('/\s/', '', $s['aspect']);
    if (!empty($s['hidden'])) $o['hidden'] = true;
    return $o;
}

const CMS_ANIM_IN = ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'rotate', 'flip', 'flip-x', 'bounce', 'blur', 'reveal', 'reveal-up', 'drop', 'swirl', 'typing'];
function cms_anim_in($a): ?array {
    if (!is_array($a) || !in_array($a['t'] ?? '', CMS_ANIM_IN, true)) return null;
    $o = ['t' => $a['t']];
    foreach (['d' => [50, 10000], 'dl' => [0, 10000], 'rep' => [0, 20]] as $k => [$x, $y]) if (isset($a[$k])) { $n = cms_num($a[$k], $x, $y); if ($n !== null) $o[$k] = $n; }
    if (isset($a['e']) && in_array($a['e'], ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'smooth', 'back', 'elastic'], true)) $o['e'] = $a['e'];
    if (isset($a['dir']) && in_array($a['dir'], ['normal', 'reverse', 'alternate'], true)) $o['dir'] = $a['dir'];
    if (isset($a['tr']) && in_array($a['tr'], ['view', 'load', 'click'], true)) $o['tr'] = $a['tr'];
    if (!empty($a['out'])) $o['out'] = true;
    return $o;
}
function cms_anim($a): ?array {
    if (!is_array($a)) return null;
    $o = [];
    if ($x = cms_anim_in($a['in'] ?? null)) $o['in'] = $x;
    if ($x = cms_anim_in($a['m'] ?? null)) $o['m'] = $x;
    $sub = ['loop' => ['pulse', 'float', 'spin', 'shake', 'bounce', 'swing', 'blink', 'heartbeat', 'wobble', 'glow'], 'hov' => ['grow', 'shrink', 'lift', 'glow', 'tilt', 'rotate', 'pulse', 'shine', 'darken', 'blur-in', 'gray'], 'click' => ['pulse', 'shake', 'spin', 'bounce'],
        'scroll' => ['parallax', 'fade', 'scale', 'rotate', 'move-x', 'blur', 'scrub']];
    foreach ($sub as $k => $list) {
        $v = $a[$k] ?? null;
        if (!is_array($v) || !in_array($v['t'] ?? '', $list, true)) continue;
        $x = ['t' => $v['t']];
        foreach (['d' => [50, 20000], 'dl' => [0, 20000], 'sp' => [-200, 200]] as $kk => [$p, $q]) if (isset($v[$kk])) { $n = cms_num($v[$kk], $p, $q); if ($n !== null) $x[$kk] = $n; }
        $o[$k] = $x;
    }
    if (isset($a['mouse'])) { $n = cms_num($a['mouse'], -200, 200); if ($n) $o['mouse'] = $n; }
    if (isset($a['mob']) && in_array($a['mob'], ['same', 'off', 'custom'], true)) $o['mob'] = $a['mob'];
    return $o ?: null;
}
function cms_fx($f): ?array {
    if (!is_array($f)) return null;
    $o = [];
    if (isset($f['bg']) && in_array($f['bg'], ['parallax', 'fixed', 'zoom', 'fade-bg'], true)) $o['bg'] = $f['bg'];
    if (isset($f['speed'])) { $n = cms_num($f['speed'], 0, 200); if ($n !== null) $o['speed'] = $n; }
    if (!empty($f['sticky'])) $o['sticky'] = true;
    if (($f['full'] ?? '') === 'screen') $o['full'] = 'screen';
    if (!empty($f['hideD'])) $o['hideD'] = true;
    if (!empty($f['hideT'])) $o['hideT'] = true;
    if (isset($f['anchor']) && is_string($f['anchor']) && preg_match('/^[\w-]{1,60}$/', $f['anchor'])) $o['anchor'] = $f['anchor'];
    if (isset($f['video'])) { $u = cms_img($f['video']); if ($u && preg_match('#\.(mp4|webm)(\?.*)?$#i', $u)) $o['video'] = $u; }
    if (isset($f['poster'])) { $u = cms_img($f['poster']); if ($u) $o['poster'] = $u; }
    return $o ?: null;
}

const CMS_EL_KINDS = ['text', 'button', 'image', 'shape', 'vector', 'box', 'video', 'audio', 'embed', 'map', 'social', 'icon', 'menu', 'form', 'slider', 'accordion', 'tabs', 'countdown', 'progress', 'beforeafter', 'marquee', 'lottie', 'repeater', 'counter', 'popup', 'imgseq'];
function cms_bool_keys(array $src, array $keys): array { $o = []; foreach ($keys as $k) if (array_key_exists($k, $src) && is_bool($src[$k])) $o[$k] = $src[$k]; return $o; }
function cms_el_props(string $kind, $p): array {
    $p = is_array($p) ? $p : [];
    $o = [];
    $str = function ($k, $max) use ($p, &$o) { if (isset($p[$k])) { $v = cms_str($p[$k], $max); if ($v !== '') $o[$k] = $v; } };
    $n = function ($k, $a, $b) use ($p, &$o) { if (isset($p[$k])) { $v = cms_num($p[$k], $a, $b); if ($v !== null) $o[$k] = $v; } };
    switch ($kind) {
        case 'text': $o['html'] = cms_html(is_string($p['html'] ?? null) ? $p['html'] : '', 20000, true); if (isset($p['tag']) && preg_match('/^(h[1-6]|p|div)$/', (string)$p['tag'])) $o['tag'] = $p['tag']; break;
        case 'button': $o += cms_bool_keys($p, ['disabled']); $str('label', 120); if (isset($p['icon']) && preg_match('/^[a-z0-9-]{1,30}$/', (string)$p['icon'])) $o['icon'] = $p['icon']; if (($p['iconPos'] ?? '') === 'right') $o['iconPos'] = 'right'; break;
        case 'image': case 'vector': if ($u = cms_img($p['src'] ?? '')) $o['src'] = $u; $str('alt', 300);
            if ($kind === 'image' && is_array($p['img'] ?? null)) { $g = []; foreach (['w' => [1, 5000], 'x' => [-5000, 5000], 'y' => [-5000, 5000], 'r' => [-360, 360]] as $k => [$a, $b]) { $v = cms_num($p['img'][$k] ?? 0, $a, $b); if ($v !== null) $g[$k] = $v; } if (isset($p['img']['ar']) && ($v = cms_num($p['img']['ar'], 0.01, 100)) !== null) $g['ar'] = $v; if (empty($g['r'])) unset($g['r']); if (isset($g['w'])) $o['img'] = $g; }
            if ($kind === 'image' && is_array($p['crop'] ?? null)) { $c = []; foreach (['x' => [0, 99], 'y' => [0, 99], 'w' => [1, 100], 'h' => [1, 100]] as $k => [$a, $b]) { $v = cms_num($p['crop'][$k] ?? null, $a, $b); if ($v === null) { $c = []; break; } $c[$k] = $v; } if ($c) $o['crop'] = $c; }
            break;
        case 'popup':
            $str('label', 120); $str('title', 200); $str('btn', 80);
            if (isset($p['html'])) $o['html'] = cms_html(is_string($p['html']) ? $p['html'] : '', 6000, true);
            if (isset($p['btnLink'])) { $l = cms_url($p['btnLink'], true); if ($l !== '') $o['btnLink'] = $l; }
            if ($u = cms_img($p['img'] ?? '')) $o['img'] = $u;
            foreach (['trigger' => ['click', 'load', 'scroll', 'exit'], 'size' => ['sm', 'md', 'lg', 'full'], 'pos' => ['center', 'bottom', 'right', 'left']] as $k => $allowed) if (isset($p[$k]) && in_array($p[$k], $allowed, true)) $o[$k] = $p[$k];
            $n('delay', 0, 120); $n('at', 0, 100); $n('dim', 0, 95);
            foreach (['bg', 'ink'] as $k) if (isset($p[$k])) { $c = cms_color($p[$k]); if ($c) $o[$k] = $c; }
            $o += cms_bool_keys($p, ['form']); if (array_key_exists('once', $p)) $o['once'] = !empty($p['once']);
            break;
        case 'imgseq':
            $o['frames'] = []; foreach (array_slice(is_array($p['frames'] ?? null) ? $p['frames'] : [], 0, 240) as $f) if ($u = cms_img($f)) $o['frames'][] = $u;
            if (isset($p['mode']) && in_array($p['mode'], ['scroll', 'auto', 'hover', 'drag'], true)) $o['mode'] = $p['mode'];
            $n('fps', 1, 60); $n('dist', 30, 400); $str('alt', 300); if (array_key_exists('loop', $p)) $o['loop'] = !empty($p['loop']);
            break;
        case 'shape': if (isset($p['shape']) && preg_match('/^[a-z-]{2,20}$/', (string)$p['shape'])) $o['shape'] = $p['shape']; break;
        case 'box': $o += cms_bool_keys($p, ['flow']); break;
        case 'video': if ($v = cms_video($p['src'] ?? '')) $o['src'] = $v; if ($u = cms_img($p['poster'] ?? '')) $o['poster'] = $u; $o += cms_bool_keys($p, ['autoplay', 'loop', 'muted', 'controls', 'scrub']); break;
        case 'audio': if (($u = cms_img($p['src'] ?? '')) && preg_match('#\.(mp3|m4a|ogg|wav)(\?.*)?$#i', $u)) $o['src'] = $u; $o += cms_bool_keys($p, ['loop']); break;
        case 'embed':
            if (isset($p['url']) && preg_match('#^https://#', (string)$p['url']) && ($u = cms_url($p['url']))) $o['url'] = $u;
            if (isset($p['html']) && is_string($p['html'])) $o['html'] = mb_substr($p['html'], 0, 30000); // rendered only inside a sandboxed iframe without same-origin
            $str('title', 120); break;
        case 'map': $str('q', 200); $n('zoom', 3, 20); break;
        case 'social': $o['items'] = []; foreach (array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 12) as $it) if (is_array($it) && preg_match('/^[a-z]{1,20}$/', (string)($it['net'] ?? '')) && ($u = cms_url($it['url'] ?? ''))) $o['items'][] = ['net' => $it['net'], 'url' => $u]; break;
        case 'icon': if (isset($p['icon']) && preg_match('/^[a-z0-9-]{1,30}$/', (string)$p['icon'])) $o['icon'] = $p['icon']; break;
        case 'menu':
            $o['items'] = [];
            foreach (array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 20) as $it) {
                if (!is_array($it) || cms_str($it['label'] ?? '', 60) === '') continue;
                $x = ['label' => cms_str($it['label'], 60), 'href' => cms_url($it['href'] ?? '') ?: '#'];
                foreach (array_slice(is_array($it['sub'] ?? null) ? $it['sub'] : [], 0, 20) as $s2) if (is_array($s2) && cms_str($s2['label'] ?? '', 60) !== '') $x['sub'][] = ['label' => cms_str($s2['label'], 60), 'desc' => cms_str($s2['desc'] ?? '', 160), 'href' => cms_url($s2['href'] ?? '') ?: '#'];
                $o['items'][] = $x;
            }
            $o += cms_bool_keys($p, ['vertical', 'mega']); $n('megaCols', 1, 5); $str('megaNote', 300); if ($u = cms_img($p['megaImg'] ?? '')) $o['megaImg'] = $u;
            if (isset($p['burger']) && in_array($p['burger'], ['mobile', 'always', 'never'], true)) $o['burger'] = $p['burger']; break;
        case 'form':
            $str('title', 160); $str('submit', 60); $str('ok', 300); $str('service', 120);
            $o['fields'] = [];
            foreach (array_slice(is_array($p['fields'] ?? null) ? $p['fields'] : [], 0, 20) as $f) {
                if (!is_array($f)) continue;
                $t = in_array($f['type'] ?? 'text', ['text', 'email', 'tel', 'textarea', 'select', 'checkbox', 'date', 'number'], true) ? $f['type'] : 'text';
                $x = ['label' => cms_str($f['label'] ?? '', 80), 'type' => $t, 'required' => !empty($f['required'])];
                if ($t === 'select') $x['options'] = array_values(array_filter(array_map(function ($v) { return cms_str($v, 80); }, array_slice(is_array($f['options'] ?? null) ? $f['options'] : [], 0, 30))));
                $o['fields'][] = $x;
            }
            break;
        case 'slider':
            $o['items'] = [];
            foreach (array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 40) as $it) if (is_array($it) && ($u = cms_img($it['src'] ?? ''))) $o['items'][] = ['src' => $u, 'alt' => cms_str($it['alt'] ?? '', 200), 'caption' => cms_str($it['caption'] ?? '', 200), 'link' => cms_url($it['link'] ?? '')];
            if (isset($p['mode']) && in_array($p['mode'], ['slide', 'fade', 'carousel', 'grid'], true)) $o['mode'] = $p['mode'];
            $n('auto', 0, 30); $n('per', 1, 6); $n('gap', 0, 60); $o += cms_bool_keys($p, ['arrows', 'dots']); break;
        case 'accordion': case 'tabs':
            $o['items'] = [];
            foreach (array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 30) as $it) if (is_array($it)) $o['items'][] = ['title' => cms_str($it['title'] ?? '', 200), 'body' => cms_html(is_string($it['body'] ?? null) ? $it['body'] : '', 8000, true)];
            $o += cms_bool_keys($p, ['open']); break;
        case 'countdown': $str('to', 40); $str('done', 200); if (is_array($p['labels'] ?? null)) foreach (['days', 'hours', 'min', 'sec'] as $k) if (isset($p['labels'][$k])) $o['labels'][$k] = cms_str($p['labels'][$k], 20); break;
        case 'progress': $n('value', 0, 100); $str('label', 120); break;
        case 'counter': $n('to', -1e9, 1e9); $n('dur', 100, 10000); $str('prefix', 10); $str('suffix', 10); $str('label', 120); break;
        case 'beforeafter': if ($u = cms_img($p['before'] ?? '')) $o['before'] = $u; if ($u = cms_img($p['after'] ?? '')) $o['after'] = $u; $n('start', 0, 100); $o += cms_bool_keys($p, ['labels']); break;
        case 'marquee': $str('text', 400); $n('speed', 4, 120); $o += cms_bool_keys($p, ['reverse']); break;
        case 'lottie': if ($u = cms_img($p['src'] ?? '')) $o['src'] = $u; $o += cms_bool_keys($p, ['loop']); break;
        case 'repeater':
            $o['items'] = [];
            foreach (array_slice(is_array($p['items'] ?? null) ? $p['items'] : [], 0, 30) as $it) if (is_array($it)) $o['items'][] = ['title' => cms_str($it['title'] ?? '', 200), 'body' => cms_str($it['body'] ?? '', 600), 'image' => cms_img($it['image'] ?? ''), 'link' => cms_url($it['link'] ?? '', true), 'button' => cms_str($it['button'] ?? '', 60)];
            $n('cols', 1, 6); break;
    }
    return $o;
}
function cms_el($e): ?array {
    if (!is_array($e)) return null;
    $id = cms_id($e['id'] ?? ''); $kind = (string)($e['kind'] ?? ''); $sec = cms_id($e['sec'] ?? '');
    if (!$id || !$sec || !in_array($kind, CMS_EL_KINDS, true)) return null;
    $o = ['id' => $id, 'sec' => $sec, 'kind' => $kind];
    if ($pa = cms_id($e['parent'] ?? '')) $o['parent'] = $pa;
    foreach (['x' => [-100, 200], 'y' => [-2000, 20000], 'w' => [0.2, 400], 'h' => [0, 6000], 'r' => [-360, 360], 'z' => [-50, 9999], 'yb' => [-2000, 20000]] as $k => [$a, $b]) if (isset($e[$k])) { $n = cms_num($e[$k], $a, $b); if ($n !== null) $o[$k] = $n; }
    if (is_array($e['m'] ?? null)) { $m = []; foreach (['x' => [-100, 200], 'y' => [-2000, 20000], 'w' => [0.2, 400], 'h' => [0, 6000], 'r' => [-360, 360], 'fw' => [5, 100]] as $k => [$a, $b]) if (isset($e['m'][$k])) { $n = cms_num($e['m'][$k], $a, $b); if ($n !== null) $m[$k] = $n; } if (!empty($e['m']['hide'])) $m['hide'] = true; if (isset($e['m']['align']) && in_array($e['m']['align'], ['start', 'center', 'end', 'stretch'], true)) $m['align'] = $e['m']['align']; if ($m) $o['m'] = $m; }
    $o['p'] = cms_el_props($kind, $e['p'] ?? []);
    foreach (['style', 'mob', 'hov', 'act', 'dis', 'tab'] as $k) if (isset($e[$k])) { $s = cms_style($e[$k]); if ($s) $o[$k] = $s; }
    if (isset($e['link'])) { $l = cms_url($e['link'], true); if ($l !== '') $o['link'] = $l; }
    foreach (['newTab', 'locked', 'hideD', 'hideT', 'full', 'keepRatio', 'fx', 'fy', 'free'] as $k) if (!empty($e[$k])) $o[$k] = true;
    if ($l = cms_lock($e['lock'] ?? null)) $o['lock'] = $l;
    if (($e['dock'] ?? '') === 'b') $o['dock'] = 'b';
    if (isset($e['tip'])) { $t = cms_str($e['tip'], 160); if ($t !== '') $o['tip'] = $t; }
    if ($g = cms_id($e['group'] ?? '')) $o['group'] = $g;
    if (isset($e['name'])) { $t = cms_str($e['name'], 60); if ($t !== '') $o['name'] = $t; }
    if ($a = cms_anim($e['anim'] ?? null)) $o['anim'] = $a;
    if (is_array($e['pin'] ?? null) && preg_match('/^[tmb][lcr]$/', (string)($e['pin']['at'] ?? ''))) { $o['pin'] = ['at' => $e['pin']['at']]; foreach (['ox' => [-2000, 2000], 'oy' => [-2000, 2000], 'w' => [10, 3000]] as $k => [$a, $b]) if (isset($e['pin'][$k])) { $n = cms_num($e['pin'][$k], $a, $b); if ($n !== null) $o['pin'][$k] = $n; } }
    return $o;
}

// Inline rich text: keeps b/strong/i/em/u/br/small/sup/sub/span and safe links only.
function cms_html(string $html, int $max = 20000, bool $blocks = false): string {
    $html = mb_substr($html, 0, $max);
    if (!preg_match('/[<&]/', $html)) return htmlspecialchars($html, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $doc->loadHTML('<?xml encoding="utf-8"?><div id="r">' . $html . '</div>', LIBXML_NONET);
    libxml_clear_errors(); libxml_use_internal_errors($prev);
    $root = $doc->getElementById('r');
    if (!$root) return '';
    return cms_html_children($root, $blocks);
}
function cms_html_children(DOMNode $n, bool $blocks = false): string {
    $allowed = ['b', 'strong', 'i', 'em', 'u', 's', 'br', 'small', 'sup', 'sub', 'span', 'a', 'mark'];
    if ($blocks) $allowed = array_merge($allowed, ['p', 'ul', 'ol', 'li']);
    $out = '';
    foreach ($n->childNodes as $c) {
        if ($c instanceof DOMText) { $out .= htmlspecialchars($c->nodeValue, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); continue; }
        if (!($c instanceof DOMElement)) continue;
        $tag = strtolower($c->tagName);
        if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed', 'template', 'svg', 'math', 'link', 'meta'], true)) continue;
        $inner = cms_html_children($c, $blocks);
        if ($blocks && $tag === 'div') { $out .= '<p>' . $inner . '</p>'; continue; }
        if (!in_array($tag, $allowed, true)) { $out .= $inner; continue; }
        if ($tag === 'br') { $out .= '<br>'; continue; }
        if ($tag === 'a') {
            $href = cms_url($c->getAttribute('href'));
            $out .= $href !== '' ? '<a href="' . htmlspecialchars($href, ENT_QUOTES, 'UTF-8') . '"' . ($c->getAttribute('target') === '_blank' ? ' target="_blank" rel="noopener"' : '') . '>' . $inner . '</a>' : $inner;
            continue;
        }
        $out .= "<$tag>$inner</$tag>";
    }
    return $out;
}

function cms_selector($v): string {
    $v = is_string($v) ? trim($v) : '';
    if ($v === '' || strlen($v) > 400) return '';
    // CSS selectors only: no braces, quotes limited to attribute values, no url()/expressions.
    if (preg_match('/[{}<>;,\\\\]|url\s*\(|expression|@/i', $v)) return '';
    return $v;
}

function cms_tf($t, bool $ov): array {
    $tf = [];
    if (!is_array($t)) return $tf;
    foreach (['x' => [-4000, 4000], 'y' => [-4000, 4000], 'r' => [-360, 360], 'w' => [1, 4000], 'h' => [1, 4000], 'sx' => [0.05, 20], 'sy' => [0.05, 20]] as $k => [$a, $b])
        if (isset($t[$k])) { $n = cms_num($t[$k], $a, $b); if ($n !== null && ($ov || $n != 0)) $tf[$k] = $n; }
    foreach (['fx', 'fy'] as $k) if (array_key_exists($k, $t) && is_bool($t[$k]) && ($ov || $t[$k])) $tf[$k] = $t[$k];
    return $tf;
}
// granular locks used by the editor only (position, size, rotation, style)
function cms_lock($l): array {
    $o = [];
    if (is_array($l)) foreach (['pos', 'size', 'rot', 'style'] as $k) if (!empty($l[$k])) $o[$k] = true;
    return $o;
}

function cms_id($v): string { $v = is_string($v) ? $v : ''; return preg_match('/^[A-Za-z0-9_-]{1,40}$/', $v) ? $v : ''; }

function cms_video($v): string {
    $v = is_string($v) ? trim($v) : '';
    if (preg_match('#(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{6,20})#', $v, $m)) return 'yt:' . $m[1];
    if (preg_match('#vimeo\.com/(?:video/)?(\d{5,12})#', $v, $m)) return 'vimeo:' . $m[1];
    if (preg_match('#^(yt:[\w-]{6,20}|vimeo:\d{5,12})$#', $v)) return $v;
    $u = cms_img($v);
    return preg_match('#\.(mp4|webm)(\?.*)?$#i', $u) ? $u : '';
}

function cms_block($b): ?array {
    if (!is_array($b)) return null;
    $id = cms_id($b['id'] ?? ''); $kind = (string)($b['kind'] ?? '');
    if (!$id || !in_array($kind, CMS_BLOCK_KINDS, true)) return null;
    $o = ['id' => $id, 'kind' => $kind];
    foreach (['eyebrow' => 200, 'title' => 400, 'button' => 120, 'button2' => 120, 'alt' => 300, 'caption' => 400, 'name' => 160, 'role' => 160] as $k => $max) if (isset($b[$k])) $o[$k] = cms_str($b[$k], $max);
    if (isset($b['body'])) $o['body'] = cms_html((string)(is_string($b['body']) ? $b['body'] : ''), 8000);
    if (isset($b['link'])) $o['link'] = cms_url($b['link'], true);
    if (isset($b['link2'])) $o['link2'] = cms_url($b['link2'], true);
    if (isset($b['image'])) $o['image'] = cms_img($b['image']);
    if (isset($b['video'])) $o['video'] = cms_video($b['video']);
    if (isset($b['height'])) { $n = cms_num($b['height'], 0, 600); if ($n !== null) $o['height'] = $n; }
    if (isset($b['items']) && is_array($b['items'])) {
        $o['items'] = [];
        foreach (array_slice($b['items'], 0, 24) as $it) {
            if (!is_array($it)) continue;
            $o['items'][] = ['title' => cms_str($it['title'] ?? '', 300), 'body' => cms_html(is_string($it['body'] ?? null) ? $it['body'] : '', 3000),
                'image' => cms_img($it['image'] ?? ''), 'alt' => cms_str($it['alt'] ?? '', 300), 'link' => cms_url($it['link'] ?? '', true)];
        }
    }
    foreach (['style', 'mobile', 'tablet', 'titleStyle', 'bodyStyle', 'buttonStyle', 'imageStyle'] as $k) if (isset($b[$k])) { $s = cms_style($b[$k]); if ($s) $o[$k] = $s; }
    if (isset($b['layout']) && in_array($b['layout'], ['left', 'center', 'wide', 'narrow', 'full'], true)) $o['layout'] = $b['layout'];
    if (!empty($b['hidden'])) $o['hidden'] = true;
    if ($f = cms_fx($b['fx'] ?? null)) $o['fx'] = $f;
    if ($a = cms_anim($b['anim'] ?? null)) $o['anim'] = $a;
    return $o;
}

function cms_content($c): array {
    $c = is_array($c) ? $c : [];
    $o = ['edits' => [], 'blocks' => [], 'sections' => [], 'sectionOrder' => [], 'els' => [], 'seo' => new stdClass(), 'v' => 3];
    foreach (array_slice(is_array($c['edits'] ?? null) ? $c['edits'] : [], 0, 600) as $e) {
        if (!is_array($e)) continue;
        $sel = cms_selector($e['selector'] ?? ''); if (!$sel) continue;
        $x = ['selector' => $sel];
        $type = $e['type'] ?? null;
        if ($type === 'text' || $type === 'label') { $x['type'] = $type; $x['value'] = cms_str($e['value'] ?? '', 8000); }
        elseif ($type === 'html') { $x['type'] = 'html'; $x['value'] = cms_html(is_string($e['value'] ?? null) ? $e['value'] : ''); }
        elseif ($type === 'image') { $u = cms_img($e['value'] ?? ''); if ($u) { $x['type'] = 'image'; $x['value'] = $u; } }
        elseif ($type === 'video') { $u = cms_img($e['value'] ?? ''); if ($u && preg_match('#\.(mp4|webm)(\?.*)?$#i', $u)) { $x['type'] = 'video'; $x['value'] = $u; if ($pu = cms_img($e['poster'] ?? '')) $x['poster'] = $pu; } }
        if (isset($e['alt'])) $x['alt'] = cms_str($e['alt'], 300);
        if (array_key_exists('link', $e)) { $x['link'] = cms_url($e['link'], true); if (!empty($e['newTab'])) $x['newTab'] = true; }
        foreach (['style', 'mobile', 'tablet'] as $k) if (isset($e[$k])) { $s = cms_style($e[$k]); if ($s) $x[$k] = $s; }
        if (!empty($e['hidden'])) $x['hidden'] = true;
        if (!empty($e['hideD'])) $x['hideD'] = true;
        if (!empty($e['hideT'])) $x['hideT'] = true;
        if (isset($e['hov'])) { $s = cms_style($e['hov']); if ($s) $x['hov'] = $s; }
        if ($a = cms_anim($e['anim'] ?? null)) $x['anim'] = $a;
        if (isset($e['tip'])) { $t = cms_str($e['tip'], 160); if ($t !== '') $x['tip'] = $t; }
        if (isset($e['anchor']) && is_string($e['anchor']) && preg_match('/^[\w-]{1,60}$/', $e['anchor'])) $x['anchor'] = $e['anchor'];
        // transform: tf = desktop (zero values dropped as before), tft/tfm = tablet/phone overrides (zeros and false kept: they override)
        foreach (['tf' => false, 'tft' => true, 'tfm' => true] as $tk => $ov) if (is_array($e[$tk] ?? null)) { $tf = cms_tf($e[$tk], $ov); if ($tf) $x[$tk] = $tf; }
        if (!empty($e['locked'])) $x['locked'] = true;
        if ($l = cms_lock($e['lock'] ?? null)) $x['lock'] = $l;
        if (array_key_exists('keepRatio', $e) && is_bool($e['keepRatio'])) $x['keepRatio'] = $e['keepRatio'];
        if (count($x) > 1) $o['edits'][] = $x;
    }
    foreach (array_slice(is_array($c['blocks'] ?? null) ? $c['blocks'] : [], 0, 80) as $b) { $b = cms_block($b); if ($b) $o['blocks'][] = $b; }
    foreach (array_slice(is_array($c['sections'] ?? null) ? $c['sections'] : [], 0, 200) as $s) {
        if (!is_array($s) || !($id = cms_id($s['id'] ?? ''))) continue;
        $x = ['id' => $id];
        foreach (['style', 'mobile', 'tablet'] as $k) if (isset($s[$k])) { $st = cms_style($s[$k]); if ($st) $x[$k] = $st; }
        if (!empty($s['hidden'])) $x['hidden'] = true;
        if ($f = cms_fx($s['fx'] ?? null)) $x['fx'] = $f;
        if ($a = cms_anim($s['anim'] ?? null)) $x['anim'] = $a;
        if (count($x) > 1) $o['sections'][] = $x;
    }
    $ids = [];
    foreach (array_slice(is_array($c['els'] ?? null) ? $c['els'] : [], 0, 800) as $e) { $e = cms_el($e); if ($e && !isset($ids[$e['id']])) { $ids[$e['id']] = 1; $o['els'][] = $e; } }
    if (is_array($c['page'] ?? null) && in_array($c['page']['cursor'] ?? '', ['dot', 'ring', 'blob'], true)) $o['page'] = ['cursor' => $c['page']['cursor']];
    foreach (array_slice(is_array($c['sectionOrder'] ?? null) ? $c['sectionOrder'] : [], 0, 300) as $id) if ($id = cms_id($id)) $o['sectionOrder'][] = $id;
    $seo = is_array($c['seo'] ?? null) ? $c['seo'] : [];
    $so = [];
    if (($t = cms_str($seo['title'] ?? '', 160)) !== '') $so['title'] = $t;
    if (($t = cms_str($seo['description'] ?? '', 400)) !== '') $so['description'] = $t;
    if (isset($seo['noindex']) && is_bool($seo['noindex'])) $so['noindex'] = $seo['noindex'];
    if (($t = cms_img($seo['image'] ?? '')) !== '') $so['image'] = $t;
    if ($so) $o['seo'] = $so;
    return $o;
}

const CMS_SITE_THEMES = ['default', 'vivid', 'yellow-navy', 'midnight', 'ocean', 'forest', 'carbon', 'labs', 'cupertino', 'galaxy', 'obsidian', 'graphite-red', 'royal-night', 'sunset', 'mono'];
function cms_site_theme(array $t): string {
    $id = $t['siteTheme'] ?? null;
    if (is_string($id) && in_array($id, CMS_SITE_THEMES, true)) return $id;
    return (($t['siteStyle'] ?? '') === 'classic') ? 'default' : 'vivid';
}
function cms_theme($t): array {
    $t = is_array($t) ? $t : [];
    $o = ['colors' => [], 'fonts' => []];
    $keys = ['accent', 'accent2', 'accentSoft', 'ink', 'ink2', 'muted', 'bg', 'bg2', 'bg3', 'btn', 'btnInk', 'line', 'headerBg', 'footerBg'];
    foreach ($keys as $k) if (isset($t['colors'][$k])) { $c = cms_color($t['colors'][$k]); if ($c) $o['colors'][$k] = $c; }
    foreach (['body', 'heading'] as $k) if (isset($t['fonts'][$k]) && in_array($t['fonts'][$k], CMS_FONTS, true) && $t['fonts'][$k] !== '') $o['fonts'][$k] = $t['fonts'][$k];
    foreach (['radius' => [0, 3], 'baseSize' => [13, 20], 'headingWeight' => [300, 900], 'buttonRadius' => [0, 40]] as $k => [$a, $b]) if (isset($t[$k])) { $n = cms_num($t[$k], $a, $b); if ($n !== null) $o[$k] = $n; }
    if (isset($t['buttonStyle']) && in_array($t['buttonStyle'], ['pill', 'rounded', 'square'], true)) $o['buttonStyle'] = $t['buttonStyle'];
    // main menu "Vehicle Wraps" item: plain (like the other items, bold) or a filled pill; optional colours and weight
    if (is_array($t['menuWraps'] ?? null)) {
        $mw = [];
        if (in_array($t['menuWraps']['style'] ?? '', ['plain', 'pill'], true)) $mw['style'] = $t['menuWraps']['style'];
        if (isset($t['menuWraps']['weight'])) { $n = cms_num($t['menuWraps']['weight'], 400, 900); if ($n !== null) $mw['weight'] = (int)$n; }
        foreach (['color', 'bg'] as $k) if (isset($t['menuWraps'][$k]) && ($c = cms_color($t['menuWraps'][$k]))) $mw[$k] = $c;
        if ($mw) $o['menuWraps'] = $mw;
    }
    // Website editor › Theme › Themes: one of CMS_SITE_THEMES ('default' = the original Classic look, no extra CSS).
    // Older saves only have siteStyle (classic|vivid): classic -> default, anything else -> vivid (unchanged look).
    $o['siteTheme'] = cms_site_theme($t);
    $o['siteStyle'] = $o['siteTheme'] === 'default' ? 'classic' : 'vivid'; // kept for older editor/preview code
    // custom fonts uploaded to the media library
    foreach (array_slice(is_array($t['customFonts'] ?? null) ? $t['customFonts'] : [], 0, 12) as $f) {
        if (!is_array($f)) continue;
        $name = cms_str($f['name'] ?? '', 40); $url = cms_img($f['url'] ?? '');
        if (preg_match('/^[A-Za-z0-9][\w -]{1,38}$/', $name) && preg_match('#^/cms/uploads/[\w/.-]+\.(woff2?|ttf|otf)$#i', $url)) $o['customFonts'][] = ['name' => $name, 'url' => $url];
    }
    $cf = array_column($o['customFonts'] ?? [], 'name');
    foreach (['body', 'heading'] as $k) if (isset($t['fonts'][$k]) && (in_array($t['fonts'][$k], CMS_GOOGLE_FONTS, true) || in_array($t['fonts'][$k], $cf, true))) $o['fonts'][$k] = $t['fonts'][$k];
    // global text styles
    foreach (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'btn'] as $k) if (isset($t['typo'][$k])) { $st = cms_style($t['typo'][$k]); if ($st) $o['typo'][$k] = $st; }
    foreach (['typoM'] as $tk) foreach (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'] as $k) if (isset($t[$tk][$k])) { $st = cms_style($t[$tk][$k]); if ($st) $o[$tk][$k] = $st; }
    foreach (array_slice(is_array($t['palette'] ?? null) ? $t['palette'] : [], 0, 24) as $c) if ($c = cms_color($c)) $o['palette'][] = $c;
    foreach (array_slice(is_array($t['styles'] ?? null) ? $t['styles'] : [], 0, 40) as $x) {
        if (!is_array($x) || cms_str($x['name'] ?? '', 40) === '') continue;
        $o['styles'][] = ['id' => cms_id($x['id'] ?? '') ?: bin2hex(random_bytes(4)), 'name' => cms_str($x['name'], 40), 'style' => cms_style($x['style'] ?? []), 'hov' => cms_style($x['hov'] ?? [])];
    }
    return $o;
}
function cms_style_css(array $st): string {
    // server-side mirror of the most common text style keys (used for global typography)
    $d = [];
    $px = ['fontSize' => 'font-size', 'letterSpacing' => 'letter-spacing', 'marginTop' => 'margin-top', 'marginBottom' => 'margin-bottom', 'mt' => 'margin-top', 'mb' => 'margin-bottom'];
    foreach ($px as $k => $p) if (isset($st[$k])) $d[] = "$p:{$st[$k]}px";
    if (isset($st['fontWeight'])) $d[] = 'font-weight:' . (int)$st['fontWeight'];
    if (isset($st['lineHeight'])) $d[] = 'line-height:' . (float)$st['lineHeight'];
    if (isset($st['color'])) $d[] = 'color:' . $st['color'];
    if (isset($st['fontFamily'])) $d[] = 'font-family:' . cms_font_stack($st['fontFamily']);
    foreach (['textTransform' => 'text-transform', 'fontStyle' => 'font-style', 'textAlign' => 'text-align'] as $k => $p) if (isset($st[$k])) $d[] = "$p:{$st[$k]}";
    if (isset($st['textDecoration'])) $d[] = 'text-decoration-line:' . $st['textDecoration'];
    if (isset($st['backgroundColor'])) $d[] = 'background-color:' . $st['backgroundColor'];
    if (isset($st['borderRadius'])) $d[] = 'border-radius:' . $st['borderRadius'] . 'px';
    return implode(';', $d);
}

function cms_font_stack(string $f): string {
    $map = ['system-ui' => 'system-ui,-apple-system,"Segoe UI",Arial,sans-serif', 'Georgia' => 'Georgia,"Times New Roman",serif'];
    if (in_array($f, CMS_SERIF_FONTS, true)) return '"' . $f . '",Georgia,serif';
    return $map[$f] ?? ('"' . $f . '",system-ui,-apple-system,"Segoe UI",Arial,sans-serif');
}
const CMS_SERIF_FONTS = ['Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond', 'IBM Plex Serif', 'Noto Serif', 'PT Serif', 'Zilla Slab', 'Bodoni Moda', 'DM Serif Display', 'Fraunces', 'Libre Baskerville', 'Crimson Pro', 'EB Garamond', 'Abril Fatface', 'Alfa Slab One', 'Noto Naskh Arabic', 'Markazi Text'];
const CMS_GOOGLE_FONTS = ['Montserrat', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Oswald', 'Raleway', 'Playfair Display', 'Bebas Neue', 'DM Sans', 'Work Sans', 'Nunito', 'Anton', 'Archivo Black', 'Barlow', 'Inter Tight', 'Space Grotesk', 'Sora', 'Rubik', 'Kanit', 'Righteous', 'Orbitron', 'Teko', 'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Merriweather', 'Lora', 'Cormorant Garamond', 'Vazirmatn', 'Inter', 'Manrope', 'Plus Jakarta Sans', 'Outfit', 'Urbanist', 'Figtree', 'Lexend', 'Epilogue', 'Syne', 'Unbounded', 'Archivo', 'Barlow Condensed', 'Big Shoulders Display', 'Chakra Petch', 'Exo 2', 'Fira Sans', 'IBM Plex Sans', 'IBM Plex Serif', 'Josefin Sans', 'Jost', 'Karla', 'Libre Franklin', 'Mulish', 'Noto Sans', 'Noto Serif', 'Nunito Sans', 'Oxanium', 'PT Sans', 'PT Serif', 'Quicksand', 'Red Hat Display', 'Saira', 'Source Sans 3', 'Titillium Web', 'Ubuntu', 'Zilla Slab', 'Bodoni Moda', 'DM Serif Display', 'Fraunces', 'Libre Baskerville', 'Crimson Pro', 'EB Garamond', 'Abril Fatface', 'Alfa Slab One', 'Black Ops One', 'Russo One', 'Permanent Marker', 'Satisfy', 'Great Vibes', 'Comfortaa', 'Space Mono', 'JetBrains Mono', 'Noto Naskh Arabic', 'Lalezar', 'Markazi Text'];

function cms_theme_css(array $t): string {
    $css = []; $imports = [];
    $faces = [];
    foreach ($t['customFonts'] ?? [] as $cf) $faces[] = '@font-face{font-family:"' . $cf['name'] . '";src:url("' . $cf['url'] . '");font-display:swap}';
    $gf = array_values($t['fonts'] ?? []);
    foreach (array_merge($t['typo'] ?? [], $t['typoM'] ?? []) as $st) if (!empty($st['fontFamily'])) $gf[] = $st['fontFamily'];
    // Site theme: the shared modern structure + the theme's colour file are imported first; "default" (the original look) loads nothing.
    $site = cms_site_theme($t);
    if ($site !== 'default') $imports['@theme'] = '@import url("/themes/_base-modern.css");' . "\n" . '@import url("/themes/' . $site . '.css");';
    // only the fonts actually chosen are loaded (the plain request always works; the weighted one adds other weights when the family has them)
    foreach ($gf as $f) if (in_array($f, CMS_GOOGLE_FONTS, true) && !in_array($f, ['Vazirmatn', 'Inter', 'Manrope'], true)) { $q = str_replace(' ', '+', $f); $imports[$f] = '@import url("https://fonts.googleapis.com/css2?family=' . $q . '&display=swap");' . "\n" . '@import url("https://fonts.googleapis.com/css2?family=' . $q . ':wght@300;400;500;600;700;800;900&display=swap");'; }
    $map = ['accent' => '--accent', 'accent2' => '--accent-2', 'accentSoft' => '--accent-soft', 'ink' => '--ink', 'ink2' => '--ink-2', 'muted' => '--mut', 'bg' => '--bg', 'bg2' => '--bg-2', 'bg3' => '--bg-3', 'btn' => '--btn', 'btnInk' => '--btn-ink', 'line' => '--line'];
    $vars = [];
    foreach ($map as $k => $v) if (!empty($t['colors'][$k])) $vars[] = "$v:{$t['colors'][$k]}";
    if (!empty($t['fonts']['body'])) $vars[] = '--font:' . cms_font_stack($t['fonts']['body']);
    if (isset($t['radius'])) { $r = (float)$t['radius']; $vars[] = '--r-sm:' . round(10 * $r) . 'px'; $vars[] = '--r-md:' . round(18 * $r) . 'px'; $vars[] = '--r-lg:' . round(26 * $r) . 'px'; }
    if ($vars) $css[] = 'html:root{' . implode(';', $vars) . '}';
    if (!empty($t['fonts']['body'])) $css[] = 'body,body .btn,body button,body input,body select,body textarea{font-family:var(--font)}';
    if (!empty($t['fonts']['heading'])) $css[] = 'h1,h2,h3,h4,.d1,.d2,.d3{font-family:' . cms_font_stack($t['fonts']['heading']) . '!important}'; // beats the site's "html body h1" font rule and the Vivid heading font
    if (isset($t['headingWeight'])) $css[] = 'h1,h2,h3,.d1,.d2,.d3{font-weight:' . (int)$t['headingWeight'] . '}';
    if (isset($t['baseSize'])) $css[] = 'body{font-size:' . (float)$t['baseSize'] . 'px}';
    if (!empty($t['buttonStyle'])) $css[] = '.btn{border-radius:' . ['pill' => '999px', 'rounded' => '10px', 'square' => '0'][$t['buttonStyle']] . '!important}';
    if (!empty($t['menuWraps'])) {
        $mw = $t['menuWraps']; $pill = ($mw['style'] ?? 'plain') === 'pill'; $v = [];
        if ($pill) { $v[] = '--nav-wraps-bg:' . ($mw['bg'] ?? 'var(--ink)'); $v[] = '--nav-wraps-ink:' . ($mw['color'] ?? 'var(--bg)'); $v[] = '--nav-wraps-radius:999px'; $v[] = '--nav-wraps-pad:0 16px'; $v[] = '--nav-wraps-hover-bg:var(--accent)'; $v[] = '--nav-wraps-hover-ink:#fff'; }
        elseif (!empty($mw['color'])) $v[] = '--nav-wraps-ink:' . $mw['color'];
        if (!empty($mw['weight'])) $v[] = '--nav-wraps-weight:' . (int)$mw['weight'];
        if ($v) $css[] = 'html:root{' . implode(';', $v) . '}';
    }
    if (!empty($t['colors']['headerBg'])) $css[] = '.hdr{background:' . $t['colors']['headerBg'] . '!important}';
    if (!empty($t['colors']['footerBg'])) $css[] = '.ftr{background:' . $t['colors']['footerBg'] . '!important}';
    $sel = ['h1' => 'h1,.d1', 'h2' => 'h2,.d2', 'h3' => 'h3,.d3', 'h4' => 'h4', 'h5' => 'h5', 'h6' => 'h6', 'p' => '#main p,#main .lede', 'btn' => '.btn,.cms-ebtn'];
    foreach ($t['typo'] ?? [] as $k => $st) { $c = cms_style_css($st); if ($c !== '' && isset($sel[$k])) $css[] = $sel[$k] . '{' . str_replace(';', '!important;', $c) . '!important}'; }
    $m = [];
    foreach ($t['typoM'] ?? [] as $k => $st) { $c = cms_style_css($st); if ($c !== '' && isset($sel[$k])) $m[] = $sel[$k] . '{' . str_replace(';', '!important;', $c) . '!important}'; }
    if ($m) $css[] = '@media(max-width:700px){' . implode('', $m) . '}';
    return implode("\n", array_values($imports)) . ($imports ? "\n" : '') . implode("\n", $faces) . ($faces ? "\n" : '') . implode("\n", $css);
}

function cms_menu($m): array {
    $items = [];
    foreach (array_slice(is_array($m['items'] ?? null) ? $m['items'] : [], 0, 20) as $it) {
        if (!is_array($it)) continue;
        $x = ['key' => preg_replace('/[^a-z0-9-]/', '', strtolower((string)($it['key'] ?? ''))) ?: 'item' . count($items), 'label' => cms_str($it['label'] ?? '', 60), 'href' => cms_url($it['href'] ?? '') ?: '/satin', 'active' => ($it['active'] ?? true) !== false];
        if ($x['label'] === '') continue;
        $groups = [];
        foreach (array_slice(is_array($it['groups'] ?? null) ? $it['groups'] : [], 0, 8) as $g) {
            if (!is_array($g)) continue;
            $links = [];
            foreach (array_slice(is_array($g['links'] ?? null) ? $g['links'] : [], 0, 30) as $l) {
                if (!is_array($l) || cms_str($l['label'] ?? '', 80) === '') continue;
                $links[] = ['label' => cms_str($l['label'], 80), 'href' => cms_url($l['href'] ?? '') ?: '/satin', 'active' => ($l['active'] ?? true) !== false];
            }
            $groups[] = ['label' => cms_str($g['label'] ?? '', 60), 'links' => $links];
        }
        $x['groups'] = $groups;
        $items[] = $x;
    }
    return ['items' => $items];
}
