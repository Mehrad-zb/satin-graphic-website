<?php
declare(strict_types=1);
// Vehicle-wrap price estimator: one simple editor (Admin → Products & prices → Wrap estimator prices) over the live
// wrap-* price rules that the estimator pages and the Design Studio use. Only numbers change here: each vehicle's
// starting price, each choice's multiplier, roof add-on and design deposit. Labels, formulas and fields stay as they are
// (edit those in the product's own price editor).

const EP_RULES = ['wrap-sedan', 'wrap-suv', 'wrap-pickup-truck', 'wrap-minivan', 'wrap-transit-van', 'wrap-sprinter-van', 'wrap-cargo-van', 'wrap-box-truck', 'wrap-trailer', 'wrap-bus'];

function ep_load(): void { if (!function_exists('cat_rule')) require_once __DIR__ . '/catalog.php'; }

function ep_num($v, float $min, float $max): ?float { if (!is_numeric($v)) return null; $n = (float)$v; return ($n < $min || $n > $max) ? null : round($n, 4); }

/** Editable view of one rule. */
function ep_rule_view(array $r): array {
    $fields = [];
    foreach ($r['fields'] ?? [] as $f) {
        if (($f['type'] ?? '') !== 'select' || empty($f['options'])) continue;
        $fields[] = ['key' => $f['key'], 'label' => $f['label'] ?? $f['key'], 'kind' => $f['key'] === 'coverage' ? 'share' : (($f['unit'] ?? '') === 'add' ? 'amount' : 'multiplier'), 'default' => isset($f['default']) && is_numeric($f['default']) ? (float)$f['default'] : null,
            'options' => array_map(function ($o) { return ['label' => (string)($o['label'] ?? ''), 'value' => (float)($o['value'] ?? 0)]; }, $f['options'])];
    }
    $c = $r['constants'] ?? [];
    return ['id' => $r['id'], 'label' => preg_replace('/\s*wrap estimator$/i', '', (string)($r['label'] ?? $r['id'])), 'path' => $r['path'] ?? '', 'revision' => (int)($r['revision'] ?? 0),
        'base' => isset($c['base']) ? (float)$c['base'] : null, 'roofMultiplier' => isset($c['roofMultiplier']) ? (float)$c['roofMultiplier'] : null,
        'designDeposit' => isset($c['designDeposit']) ? (float)$c['designDeposit'] : null,
        'fullWrapFactor' => isset($c['fullWrapFactor']) ? (float)$c['fullWrapFactor'] : null, 'from' => ep_from($r), 'fields' => $fields];
}

/** The price the estimator page shows when it opens (default choices, no roof, no design), e.g. base × 3M × full-wrap factor. */
function ep_from(array $r): ?float {
    $c = $r['constants'] ?? []; if (!isset($c['base'])) return null;
    $m = 1.0; $cov = null; $add = 0.0;
    foreach ($r['fields'] ?? [] as $f) {
        if (($f['type'] ?? '') !== 'select' || empty($f['options'])) continue;
        $v = isset($f['default']) && is_numeric($f['default']) ? (float)$f['default'] : (float)($f['options'][0]['value'] ?? 1);
        if (($f['unit'] ?? '') === 'add') { $add += $v; continue; }
        $m *= $v; if ($f['key'] === 'coverage') $cov = $v;
    }
    if (isset($c['fullWrapFactor']) && ($cov === null || abs($cov - 1) < 1e-9)) $m *= (float)$c['fullWrapFactor'];
    return round((float)$c['base'] * $m / 10) * 10 + $add;
}

/** $fresh: rules written earlier in this request (cat_rule() keeps the version it read first). */
function ep_rules(array $fresh = []): array { ep_load(); $out = []; foreach (EP_RULES as $id) if ($r = $fresh[$id] ?? cat_rule($id)) $out[] = ep_rule_view($r); return $out; }

/** Public GET /api/pricing (site bundle fallback): starting price per estimator vehicle from the live rules. */
function ep_public(): array {
    $f = @json_decode((string)@file_get_contents(DATA . '/pricing.json'), true) ?: [];
    $bases = $f['bases'] ?? []; $roof = $f['roofMultiplier'] ?? 1.12; $dep = $f['designDeposit'] ?? 250;
    foreach (ep_rules() as $r) {
        $slug = substr($r['id'], 5);
        if ($r['base'] !== null) $bases[$slug] = $r['base'];
        if ($r['id'] === 'wrap-sprinter-van') { if ($r['roofMultiplier'] !== null) $roof = $r['roofMultiplier']; if ($r['designDeposit'] !== null) $dep = $r['designDeposit']; }
    }
    return ['bases' => $bases, 'roofMultiplier' => $roof, 'designDeposit' => $dep];
}

/** Keep the "From $X" price on each vehicle card of the static estimator pages (EN/ES/FR/FA) equal to the admin's
 *  starting prices, so visitors and Google see the current numbers without a site rebuild. Writes only on change. */
function ep_sync_static(array $fresh = []): array {
    $root = is_dir(dirname(__DIR__) . '/public_html/satin') ? dirname(__DIR__) . '/public_html' : dirname(__DIR__) . '/new.satingraphic.ca';
    $bases = []; foreach (ep_rules($fresh) as $r) if ($r['from'] !== null) $bases[substr($r['id'], 5)] = $r['from'];
    $done = [];
    foreach (['', 'es/', 'fr/', 'fa/'] as $lang) {
        $file = "$root/satin/{$lang}vehicle-wraps/estimator/index.html";
        $html = @file_get_contents($file); if ($html === false) continue;
        $new = preg_replace_callback('~(<a class="card" href="/satin/' . preg_quote($lang, '~') . 'vehicle-wraps/estimator/([a-z0-9-]+)/">.*?<span class="price">)([^<]*)(</span>)~su', function ($m) use ($bases) {
            $slug = $m[2]; if (!isset($bases[$slug]) || !is_numeric($bases[$slug])) return $m[0];
            $n = (int)round((float)$bases[$slug]);
            $txt = preg_replace_callback('~[0-9۰-۹](?:[0-9۰-۹,\x{066C}\x{00A0}\x{202F} ]*[0-9۰-۹])?~u', function ($d) use ($n) {
                $run = $d[0]; $persian = (bool)preg_match('~[۰-۹]~u', $run);
                $sep = preg_match('~[^0-9۰-۹]~u', $run, $sm) ? $sm[0] : ($persian ? '٬' : ',');
                $out = number_format($n, 0, '.', "\x01"); $out = str_replace("\x01", $sep, $out);
                if ($persian) $out = strtr($out, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
                return $out;
            }, $m[3], 1);
            return $m[1] . $txt . $m[4];
        }, $html);
        if ($new !== null && $new !== $html) { @file_put_contents($file, $new, LOCK_EX); $done[] = $lang ?: 'en'; }
    }
    $t = ep_sync_text($root, $fresh); if ($t) $done[] = $t . ' pages';
    return $done;
}

/** Every wrap price written in the page text, meta descriptions and structured data (data/wrap-price-slots.json:
 *  <span data-wp="sedan.full|usd"> markers in the HTML text + anchored slots in meta tags and JSON-LD), so Google
 *  and visitors see the same numbers as the estimator. Keys: <vehicle>.full|decal|partial|matte|base, min.*, max.*. */
function ep_price_values(array $rules): array {
    $v = []; $full = []; $dec = []; $matte4 = [];
    foreach ($rules as $r) {
        if ($r['base'] === null) continue;
        $slug = substr($r['id'], 5); $veh = 1.0; $mat = 1.0; $cov = []; $mt = 1.12;
        foreach ($r['fields'] as $f) {
            $d = $f['default'] ?? ($f['options'][0]['value'] ?? 1);
            if ($f['kind'] === 'amount') continue;
            if ($f['key'] === 'coverage') { $cov = array_map(fn($o) => (float)$o['value'], $f['options']); continue; }
            if ($f['key'] === 'material') { $mat = (float)$d; continue; }
            if ($f['key'] === 'finish') { foreach ($f['options'] as $o) if (stripos($o['label'], 'matte') !== false) $mt = (float)$o['value']; continue; }
            $veh *= (float)$d;
        }
        $b = (float)$r['base'] * $veh * $mat; $fwf = $r['fullWrapFactor'] ?? 1;
        $r10 = fn($x) => (int)(round($x / 10) * 10);
        $v["$slug.base"] = (int)round((float)$r['base']);
        $v["$slug.full"] = (int)($r['from'] ?? $r10($b * $fwf));
        if (count($cov) >= 2) { $v["$slug.decal"] = $r10($b * $cov[0]); $v["$slug.partial"] = $r10($b * $cov[1]); }
        $v["$slug.matte"] = $r10($b * $mt * $fwf);
        $full[] = $v["$slug.full"]; if (isset($v["$slug.decal"])) $dec[] = $v["$slug.decal"];
        if (in_array($slug, ['sedan', 'suv', 'pickup-truck', 'minivan'], true)) $matte4[] = $v["$slug.matte"];
    }
    if ($full) { $v['min.full'] = min($full); $v['max.full'] = max($full); }
    if ($dec) { $v['min.decal'] = min($dec); $v['max.decal'] = max($dec); }
    if ($matte4) $v['max.matte4'] = max($matte4);
    return $v;
}
function ep_fmt_price(int $n, string $f): string { return $f === 'int' ? (string)$n : '$' . number_format($n, $f === 'usd2' ? 2 : 0); }
function ep_sync_text(string $root, array $fresh = []): int {
    $slots = @json_decode((string)@file_get_contents(DATA . '/wrap-price-slots.json'), true);
    if (!is_array($slots)) return 0;
    $vals = ep_price_values(ep_rules($fresh)); $num = ['usd' => '\$[\d,]+', 'usd2' => '\$[\d,]+\.\d\d', 'int' => '\d+']; $n = 0;
    foreach (array_unique(array_merge($slots['files'] ?? [], array_keys($slots['slots'] ?? []))) as $rel) {
        $file = $root . $rel; $s = @file_get_contents($file); if ($s === false) continue;
        $new = preg_replace_callback('~<span data-wp="([a-z0-9.-]+)\|(\w+)">[^<]*</span>~', function ($m) use ($vals) {
            return isset($vals[$m[1]]) ? '<span data-wp="' . $m[1] . '|' . $m[2] . '">' . ep_fmt_price($vals[$m[1]], $m[2]) . '</span>' : $m[0]; }, $s);
        foreach ($slots['slots'][$rel] ?? [] as $sl) {
            if (!isset($vals[$sl['k']], $num[$sl['f']])) continue;
            $r = @preg_replace('~(' . $sl['rb'] . ')' . $num[$sl['f']] . '(?=' . $sl['ra'] . ')~u', '${1}' . str_replace(['\\', '$'], ['\\\\', '\$'], ep_fmt_price($vals[$sl['k']], $sl['f'])), $new, 1);
            if (is_string($r)) $new = $r;
        }
        if ($new !== null && $new !== $s) { @file_put_contents($file, $new, LOCK_EX); $n++; }
    }
    return $n;
}

function ep_route(string $method): void {
    ep_load();
    if ($method === 'GET') { require_user('pricing.edit'); ep_sync_static(); json_out(['rules' => ep_rules()]); }
    if ($method !== 'POST') json_out(['error' => 'Not found'], 404);
    $u = require_user('pricing.edit');
    $v = body_json(200000);
    $changed = []; $stale = []; $writes = [];
    foreach (($v['rules'] ?? []) as $in) {
        if (!is_array($in) || !in_array($in['id'] ?? '', EP_RULES, true)) continue;
        $id = $in['id']; $cur = cat_rule($id); if (!$cur) continue;
        $rule = $cur;
        foreach (['base' => [0, 1000000], 'roofMultiplier' => [0, 20], 'designDeposit' => [0, 100000], 'fullWrapFactor' => [0, 2]] as $k => [$lo, $hi])
            if (array_key_exists($k, $rule['constants'] ?? []) && ($n = ep_num($in[$k] ?? null, $lo, $hi)) !== null) $rule['constants'][$k] = $n;
        $byKey = []; foreach (($in['fields'] ?? []) as $f) if (is_array($f) && isset($f['key'])) $byKey[(string)$f['key']] = $f;
        foreach ($rule['fields'] as &$f) {
            if (($f['type'] ?? '') !== 'select' || !isset($byKey[$f['key']])) continue;
            $opts = $byKey[$f['key']]['options'] ?? [];
            $oldDefault = $f['default'] ?? null; $defIdx = null;
            foreach ($f['options'] as $j => $o) if ((float)$o['value'] === (float)$oldDefault) { $defIdx = $j; break; }
            $add = ($f['unit'] ?? '') === 'add';
            foreach ($f['options'] as $j => &$o) if (($n = ep_num($opts[$j]['value'] ?? null, 0, $add ? 100000 : 20)) !== null) $o['value'] = $add ? round($n, 2) : $n;
            unset($o);
            if ($defIdx !== null) $f['default'] = $f['options'][$defIdx]['value'];
        }
        unset($f);
        $clean = cat_clean_rule($rule, $id);
        if (json_encode(array_diff_key($clean, ['revision' => 1])) === json_encode(array_diff_key(cat_clean_rule($cur, $id), ['revision' => 1]))) continue;
        // a vehicle changed elsewhere since this page was opened: only a problem when this save would change it too
        if (isset($in['revision']) && (int)$in['revision'] !== (int)($cur['revision'] ?? 0)) { $stale[] = $cur['label'] ?? $id; continue; }
        $clean['revision'] = (int)($cur['revision'] ?? 0) + 1;
        $writes[$id] = $clean;
    }
    if ($stale) json_out(['error' => 'Nothing was saved: ' . implode(', ', array_map(function ($l) { return preg_replace('/\s*wrap estimator$/i', '', $l); }, $stale)) . ' changed in another window since you opened this page. Reload the page, then make your changes again.', 'stale' => true], 409);
    foreach ($writes as $id => $clean) { cat_put('rule', $id, $clean, $u); $changed[] = $id; }
    if ($changed) { audit($u, 'catalog: wrap estimator prices', implode(', ', $changed)); ep_sync_static($writes); }
    json_out(['ok' => true, 'changed' => $changed, 'rules' => ep_rules($writes)]);
}
