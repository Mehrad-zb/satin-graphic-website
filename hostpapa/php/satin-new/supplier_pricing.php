<?php
declare(strict_types=1);
// Supplier-cost pricing (Admin → Products & prices → Supplier prices).
//  * Apparel: price per piece = (garment cost for the size + print cost) × markup + method add-on, less the quantity
//    discount. Print cost = 1-side cost for the first location + (2-side − 1-side cost) for each additional location
//    (front / back / left chest). Customers pick any combination of locations (loc_* checkboxes, placement = "Choose
//    locations"); the single placement choice of carts created before that (including the retired "Sleeve") is still
//    priced as before (1 side, or 2 for front and back). Hats print on the front only. Garment/print costs are the owner's SinaLite wholesale costs (supplier_data.php),
//    editable in the admin. Applied on top of every apparel price rule (catalog.php cat_rule()).
//  * Labels: built-in Print Shop products (roll labels, sticker sheets, die-cut vinyl stickers) whose price rules are
//    generated from editable coefficients (cost formula fitted to SinaLite roll-label prices × markup).
// Saved changes live in the catalog table (kind 'setting', ids 'apparel-pricing' / 'label-pricing'); the shipped
// defaults are never modified. Every price is still computed server-side by formula.php.

if (!function_exists('cat_rows')) require_once __DIR__ . '/catalog.php';

function sp_data(): array { static $d = null; return $d ??= (require __DIR__ . '/supplier_data.php'); }
function sp_saved(string $id): array { $s = cat_rows('setting')[$id] ?? null; return is_array($s) ? $s : []; }
function sp_num($v, float $a, float $b): ?float { if (is_bool($v) || !is_numeric($v)) return null; $n = (float)$v; return is_finite($n) && $n >= $a && $n <= $b ? $n : null; }
function sp_round($v, int $d = 4): float { return round((float)$v, $d); }

/* ================= apparel ================= */
/** Effective apparel settings: shipped defaults with the admin's saved changes on top. */
function sp_apparel(): array {
    $d = sp_data()['apparel']; $s = sp_saved('apparel-pricing');
    $o = ['markup' => $s['markup'] ?? $d['markup'], 'vinylAdd' => $s['vinylAdd'] ?? $d['vinylAdd'], 'embroideryAdd' => $s['embroideryAdd'] ?? $d['embroideryAdd'],
        'tiers' => $s['tiers'] ?? $d['tiers'], 'revision' => (int)($s['revision'] ?? 0), 'updatedAt' => $s['updatedAt'] ?? null, 'updatedBy' => $s['updatedBy'] ?? null, 'models' => []];
    foreach ($d['models'] as $id => $m) $o['models'][$id] = $m;
    foreach ($s['models'] ?? [] as $id => $m) {
        if (!is_array($m)) continue;
        $base = $o['models'][$id] ?? ['sizes' => [], 'print1' => null, 'print2' => null];
        $o['models'][$id] = array_merge($base, $m, ['sizes' => array_merge($base['sizes'] ?? [], is_array($m['sizes'] ?? null) ? $m['sizes'] : [])]);
    }
    return $o;
}
const SP_LOCATIONS = 9;   // placement value meaning "Choose locations" (loc_* checkboxes)
/** Adds the multi-location fields to an apparel rule whose placement offers "Front and back" (shirts, totes): the
 *  placement select gains "Choose locations" (new default) and one checkbox per location follows it. Old placement
 *  values stay valid, so carts created with a single placement keep their price. Hats keep their single choice. */
function sp_location_fields(array $rule): array {
    if (empty($rule['quantityKeys']) || !is_array($rule['fields'] ?? null)) return $rule;
    $at = null; foreach ($rule['fields'] as $i => $f) { if (($f['key'] ?? '') === 'placement') $at = $i; if (($f['key'] ?? '') === 'loc_front') return $rule; }
    if ($at === null || ($rule['fields'][$at]['type'] ?? '') !== 'select') return $rule;
    $labels = array_map(fn($o) => strtolower((string)$o['label']), $rule['fields'][$at]['options']);
    if (!array_filter($labels, fn($l) => str_contains($l, 'and back'))) return $rule;
    $pl = $rule['fields'][$at];
    if (!in_array(SP_LOCATIONS, array_map(fn($o) => (int)$o['value'], $pl['options']), true)) $pl['options'][] = ['label' => 'Choose locations', 'value' => SP_LOCATIONS];
    $pl['default'] = SP_LOCATIONS;
    $pl['help'] = 'Legacy single placement; new orders use the print location checkboxes.';
    $loc = [['loc_front', 'Front', 1]];
    if (in_array('back', $labels, true) || array_filter($labels, fn($l) => str_contains($l, 'and back'))) $loc[] = ['loc_back', 'Back', 0];
    if (in_array('left chest', $labels, true)) $loc[] = ['loc_chest', 'Left chest', 0];
    $tr = ['Front' => ['fa' => 'جلو', 'fr' => 'Devant', 'es' => 'Frente'], 'Back' => ['fa' => 'پشت', 'fr' => 'Dos', 'es' => 'Espalda'], 'Left chest' => ['fa' => 'سمت چپ سینه', 'fr' => 'Poitrine gauche', 'es' => 'Pecho izquierdo']];
    $add = array_map(fn($x) => ['key' => $x[0], 'label' => $x[1], 'type' => 'checkbox', 'default' => $x[2], 'group' => 'locations', 'translations' => $tr[$x[1]]], $loc);
    $rule['fields'][$at] = $pl;
    array_splice($rule['fields'], $at + 1, 0, $add);
    $rule['printLocations'] = array_column($add, 'key');
    return $rule;
}
function sp_size_key(string $label): string { $l = strtolower(trim(preg_replace('/\s*·\s*quantity$/u', '', $label))); return str_starts_with($l, 'one size') ? 'one size' : $l; }
function sp_model_cost(array $m, string $label): ?float {
    $want = sp_size_key($label);
    foreach ($m['sizes'] ?? [] as $k => $v) if (sp_size_key((string)$k) === $want && is_numeric($v) && $v >= 0) return (float)$v;
    return null;
}
/** Rewrites an apparel rule (fields kept) so its price comes from the supplier cost table. Returns null when not applicable. */
function sp_apparel_rule(array $rule): ?array {
    $id = (string)($rule['id'] ?? '');
    if (!str_starts_with($id, 'apparel-') || empty($rule['quantityKeys'])) return null;
    $a = sp_apparel(); $m = $a['models'][$id] ?? null;
    if (!$m || isset($m['enabled']) && !$m['enabled'] || !is_numeric($m['print1'] ?? null)) return null;
    $fields = []; foreach ($rule['fields'] as $f) $fields[$f['key']] = $f;
    $c = ['markup' => (float)(is_numeric($m['markup'] ?? null) ? $m['markup'] : $a['markup']), 'print1' => (float)$m['print1'],
        'print2' => (float)(is_numeric($m['print2'] ?? null) ? $m['print2'] : 2 * $m['print1']), 'vinylAdd' => (float)$a['vinylAdd'], 'embroideryAdd' => (float)$a['embroideryAdd']];
    $c['extraLoc'] = round(max(0, $c['print2'] - $c['print1']), 4);
    $labels = ['markup' => 'Markup × (this garment)', 'print1' => 'Print cost · 1 side (per piece)', 'print2' => 'Print cost · 2 sides (per piece)', 'vinylAdd' => 'Vinyl heat press add-on (per piece)', 'embroideryAdd' => 'Embroidery add-on (per piece)',
        'extraLoc' => 'Print cost · each extra front/back/chest location (2 sides − 1 side)'];
    $garment = []; $sum = [];
    foreach ($rule['quantityKeys'] as $i => $k) {
        if (!isset($fields[$k])) return null;
        $cost = sp_model_cost($m, (string)$fields[$k]['label']);
        if ($cost === null) return null; // a size without a cost: keep the rule as it was (price on request)
        $c['g' . $i] = $cost; $labels['g' . $i] = 'Garment cost · ' . preg_replace('/\s*·\s*quantity$/u', '', (string)$fields[$k]['label']);
        $garment[] = "$k * g$i"; $sum[] = $k;
    }
    $tiers = array_values(array_filter($a['tiers'] ?? [], function ($t) { return is_array($t) && ($t['min'] ?? 0) > 0 && ($t['pct'] ?? 0) > 0; }));
    usort($tiers, function ($x, $y) { return $x['min'] <=> $y['min']; });
    $n = '(' . implode(' + ', $sum) . ')';
    $disc = '0';
    foreach ($tiers as $j => $t) {
        $c['tierMin' . $j] = (float)$t['min']; $c['tierPct' . $j] = (float)$t['pct'];
        $labels['tierMin' . $j] = 'Quantity discount ' . ($j + 1) . ' · from pieces'; $labels['tierPct' . $j] = 'Quantity discount ' . ($j + 1) . ' · % off';
        $disc = "if($n >= tierMin$j, tierPct$j, $disc)";
    }
    $print = 'print1';
    if (isset($fields['placement'])) foreach ($fields['placement']['options'] as $o) if (preg_match('/and back/i', (string)$o['label'])) $print = 'if(placement == ' . (0 + $o['value']) . ', print2, print1)';
    if (isset($fields['placement'], $fields['loc_front'])) {
        $body = '(' . implode(' + ', array_filter(['loc_front', 'loc_back', 'loc_chest'], fn($k) => isset($fields[$k]))) . ')';
        $multi = "print1 + max(0, $body - 1) * extraLoc";
        $print = 'if(placement == ' . SP_LOCATIONS . ", $multi, $print)";
    }
    // flat decoration prices per order location (shop price list): 1 location, left chest + back, front + back;
    // embroidery (polos) has its own 1-location / 2-location price. Garment cost + these, no markup on top.
    $flat = is_numeric($m['pOne'] ?? null);
    if ($flat) {
        $c['pOne'] = (float)$m['pOne']; $c['pChestBack'] = (float)($m['pChestBack'] ?? $m['pOne']); $c['pFrontBack'] = (float)($m['pFrontBack'] ?? $c['pChestBack']);
        $labels += ['pOne' => 'Print price · 1 location', 'pChestBack' => 'Print price · left chest + back', 'pFrontBack' => 'Print price · front + back'];
        $legacy = 'if(placement == 4, pFrontBack, pOne)';
        if (isset($fields['loc_front'])) {
            $f = 'loc_front'; $b = isset($fields['loc_back']) ? 'loc_back' : '0'; $ch = isset($fields['loc_chest']) ? 'loc_chest' : '0';
            $nl = "($f + $b + $ch)";
            $multi = "if($nl == 0, 0, if($nl == 1, pOne, if($f * $b == 1, pFrontBack + if($nl > 2, pOne, 0), if($ch * $b == 1, pChestBack, pFrontBack))))";
            $print = 'if(placement == ' . SP_LOCATIONS . ", $multi, $legacy)";
        } else $print = isset($fields['placement']) ? $legacy : 'pOne';
        if (is_numeric($m['eOne'] ?? null) && isset($fields['method'])) {
            $c['eOne'] = (float)$m['eOne']; $c['eTwo'] = (float)($m['eTwo'] ?? $m['eOne']);
            $labels += ['eOne' => 'Embroidery price · 1 location', 'eTwo' => 'Embroidery price · 2+ locations'];
            $emb = isset($fields['loc_front']) ? "if(placement == " . SP_LOCATIONS . ", if($nl == 0, 0, if($nl == 1, eOne, eTwo)), if(placement == 4, eTwo, eOne))" : 'if(placement == 4, eTwo, eOne)';
            foreach ($fields['method']['options'] as $o) if (preg_match('/embroider/i', (string)$o['label'])) $print = 'if(method == ' . (0 + $o['value']) . ", $emb, $print)";
        }
        $c['markup'] = (float)(is_numeric($m['markup'] ?? null) ? $m['markup'] : 1);
    }
    $add = '0';
    if (!$flat && isset($fields['method'])) foreach ($fields['method']['options'] as $o) {
        if (preg_match('/vinyl/i', (string)$o['label'])) $add = 'if(method == ' . (0 + $o['value']) . ', vinylAdd, ' . $add . ')';
        if (preg_match('/embroider/i', (string)$o['label'])) $add = 'if(method == ' . (0 + $o['value']) . ', embroideryAdd, ' . $add . ')';
    }
    // each piece price is rounded to cents, so “price per piece” on the page is exact
    $lines = []; foreach ($sum as $i => $k) $lines[] = "$k * round(((g$i + $print) * markup + $add) * 100) / 100";
    // flat prices: garment + decoration, no markup → the decoration term appears once (keeps the formula short)
    if ($flat) { $lines = []; foreach ($sum as $i => $k) $lines[] = "$k * g$i"; $lines = ['(' . implode(' + ', $lines) . ') * markup + ' . $n . ' * ' . $print]; }
    $formula = '(' . implode(' + ', $lines) . ') * (100 - ' . $disc . ') / 100' . (isset($fields['design']) ? ' + design * designFee' : '');
    $out = $rule;
    $keep = array_intersect_key($rule['constants'] ?? [], ['designFee' => 1, 'designDeposit' => 1]);
    $out['constants'] = $keep + $c;
    $out['constantLabels'] = $labels + array_intersect_key($rule['constantLabels'] ?? [], $keep);
    $out['formula'] = $formula;
    unset($out['priceOnRequest']);
    $out['pricingVersion'] = 'supplier-apparel';
    $out['revision'] = (int)($rule['revision'] ?? 0) + $a['revision'];
    return $out;
}

/* ================= labels ================= */
function sp_labels(): array {
    $d = sp_data()['labels']; $s = sp_saved('label-pricing');
    $o = $d; $o['revision'] = (int)($s['revision'] ?? 0); $o['updatedAt'] = $s['updatedAt'] ?? null; $o['updatedBy'] = $s['updatedBy'] ?? null;
    foreach (['markup', 'rushPct', 'designFee'] as $k) if (isset($s[$k]) && is_numeric($s[$k])) $o[$k] = (float)$s[$k];
    // choice lists saved before a list change (listVersion, per product kind) were stored by position: don't apply them to the new lists
    foreach (['roll', 'sheet', 'diecut'] as $p) if (is_array($s[$p] ?? null)) foreach ($s[$p] as $k => $v) {
        $sameLists = sp_list_version($s, $p) === sp_list_version($d, $p);
        if (!array_key_exists($k, $o[$p])) continue;
        if (!$sameLists && in_array($k, ['materials', 'finishes', 'shapes', 'inks'], true)) continue;
        if (is_array($o[$p][$k]) && is_array($v)) { foreach ($o[$p][$k] as $i => $row) if (isset($v[$i]) && is_array($v[$i])) $o[$p][$k][$i] = array_merge($row, array_intersect_key($v[$i], $row)); }
        elseif (!is_array($o[$p][$k]) && is_numeric($v)) $o[$p][$k] = (float)$v;
    }
    return $o;
}
/** Version of a product kind's choice lists (materials, finishes, shapes, inks): per kind, else the table-wide version. */
function sp_list_version(array $t, string $kind): int { return (int)($t['listVersions'][$kind] ?? $t[$kind]['listVersion'] ?? $t['listVersion'] ?? 1); }
/** Value of the first choice of a list (the default selection). */
function sp_first_val(array $list): int { $list = array_values($list); return $list ? sp_val($list[0], 0) : 0; }
function sp_label_products(): array {
    $o = [];
    foreach (sp_data()['labels']['products'] as $p) $o[$p['id']] = $p + ['studioProductId' => $p['id'], 'active' => true, 'artwork' => true, 'templates' => [], 'templateURL' => '', 'stock' => null, '_builtin' => true];
    return $o;
}
/** Option value of a choice: its explicit "value" (kept stable when a list changes, so older carts stay valid) or its position. */
function sp_val(array $x, int $i): int { return isset($x['value']) && is_numeric($x['value']) ? (int)$x['value'] : $i; }
function sp_opts(array $list, string $key = 'label'): array {
    $o = [];
    foreach ($list as $i => $x) { $op = ['label' => $x[$key], 'value' => sp_val($x, $i)]; if (is_array($x['requires'] ?? null)) { $op['requires'] = $x['requires']; $op['requiresText'] = (string)($x['requiresText'] ?? ''); } $o[] = $op; }
    return $o;
}
function sp_pick(string $field, array $list, string $prop, string $const): array {
    // if(field == v0, c<v0>, if(field == v1, c<v1>, …)) with one constant per choice (named by the choice value)
    $c = []; $expr = '0'; $list = array_values($list);
    for ($i = count($list) - 1; $i >= 0; $i--) { $v = sp_val($list[$i], $i); $c[$const . $v] = (float)$list[$i][$prop]; $expr = $i === count($list) - 1 ? "$const$v" : "if($field == $v, $const$v, $expr)"; }
    return [$expr, $c];
}
/** Generated price rule for a label product. */
function sp_label_rule(string $id): ?array {
    $L = sp_labels(); $prod = null;
    foreach ($L['products'] as $p) if ($p['ruleId'] === $id) $prod = $p;
    if (!$prod) return null;
    $kind = $prod['kind']; $P = $L[$kind];
    $qty = array_map(function ($q) { return ['label' => number_format($q), 'value' => $q]; }, $P['quantities']);
    $fields = [];
    $fields[] = ['key' => 'shape', 'label' => 'Shape', 'type' => 'select', 'default' => sp_first_val($P['shapes']), 'options' => sp_opts($P['shapes'])];
    $fields[] = ['key' => 'width', 'label' => 'Width (in)', 'type' => 'number', 'default' => $P['defaultSize'][0], 'min' => $P['minSize'], 'max' => $P['maxSize'], 'step' => 0.25, 'size' => 'width', 'unit' => 'in', 'group' => 'size'];
    $fields[] = ['key' => 'height', 'label' => 'Height (in)', 'type' => 'number', 'default' => $P['defaultSize'][1], 'min' => $P['minSize'], 'max' => $P['maxSize'], 'step' => 0.25, 'size' => 'height', 'unit' => 'in', 'group' => 'size', 'help' => 'Circles and squares use the width for both sides.'];
    // same material / finish / ink choices on roll labels, sticker sheets and die-cut stickers (Oct 2026)
    $fields[] = ['key' => 'material', 'label' => 'Material', 'type' => 'select', 'default' => sp_first_val($P['materials']), 'options' => sp_opts($P['materials'])];
    $fields[] = ['key' => 'finish', 'label' => 'Finish', 'type' => 'select', 'default' => sp_first_val($P['finishes']), 'options' => sp_opts($P['finishes'])];
    if (!empty($P['inks'])) $fields[] = ['key' => 'ink', 'label' => 'Ink', 'type' => 'select', 'default' => sp_first_val($P['inks']), 'options' => sp_opts($P['inks'])];
    $fields[] = ['key' => 'quantity', 'label' => $kind === 'roll' ? 'Quantity (labels)' : 'Quantity (stickers)', 'type' => 'select', 'default' => $P['defaultQty'], 'options' => $qty, 'quantity' => 'quantity'];
    // Roll labels used to offer labels per roll, unwind direction, roll core and a rush turnaround choice. They were
    // removed (Oct 2026): turnaround is shown as text (rule 'turnaround'). Old carts carrying those values still price
    // (unknown keys are ignored); kept materials/finishes/inks keep their option values (see supplier_data.php).
    $fields[] = ['key' => 'design', 'label' => 'Design services', 'type' => 'checkbox', 'default' => 0];
    // cost (CAD, supplier/in-house) = max(minimum, setup + quantity × area × rate(quantity) × material × finish × ink × shape)
    [$mat, $cm] = sp_pick('material', $P['materials'], 'factor', 'mat');
    [$fin, $cf] = sp_pick('finish', $P['finishes'], 'factor', 'fin');
    [$shp, $cs] = sp_pick('shape', $P['shapes'], 'factor', 'shp');
    $ink = '1'; $ci = [];
    if (!empty($P['inks'])) [$ink, $ci] = sp_pick('ink', $P['inks'], 'factor', 'ink');
    $c = ['markup' => (float)($P['markup'] ?? $L['markup']), 'setup' => (float)$P['setup'], 'minCost' => (float)$P['minCost'], 'designFee' => (float)$L['designFee'], 'bleedIn' => (float)$P['bleedIn']];
    $rate = '0'; $tiers = $P['rates']; // [{from: qty, rate: $ per sq in}]
    usort($tiers, function ($a, $b) { return $a['from'] <=> $b['from']; });
    foreach ($tiers as $j => $t) { $c['rateFrom' . $j] = (float)$t['from']; $c['rate' . $j] = (float)$t['rate']; }
    $rate = 'rate0'; for ($j = 1; $j < count($tiers); $j++) $rate = "if(quantity >= rateFrom$j, rate$j, $rate)";
    $c += $cm + $cf + $cs + $ci;
    $area = '(width + bleedIn) * (if(shape == ' . $P['squareShapes'][0] . ' || shape == ' . $P['squareShapes'][1] . ', width, height) + bleedIn)';
    $cost = "max(minCost, setup + quantity * $area * $rate * $mat * $fin * $shp * $ink)";
    $formula = "round($cost * markup * 100) / 100 + design * designFee";
    $labels = ['markup' => 'Markup × on cost', 'setup' => 'Set-up cost per order', 'minCost' => 'Minimum cost per order', 'designFee' => 'Design services', 'bleedIn' => 'Gap/bleed added to each side (in)'];
    foreach ($tiers as $j => $t) { $labels['rateFrom' . $j] = 'Rate tier ' . ($j + 1) . ' · from quantity'; $labels['rate' . $j] = 'Rate tier ' . ($j + 1) . ' · $ per sq in'; }
    foreach ($P['materials'] as $i => $x) $labels['mat' . sp_val($x, $i)] = 'Material × ' . $x['label'];
    foreach ($P['finishes'] as $i => $x) $labels['fin' . sp_val($x, $i)] = 'Finish × ' . $x['label'];
    foreach ($P['shapes'] as $i => $x) $labels['shp' . sp_val($x, $i)] = 'Shape × ' . $x['label'];
    foreach ($P['inks'] ?? [] as $i => $x) $labels['ink' . sp_val($x, $i)] = 'Ink × ' . $x['label'];
    return ['id' => $id, 'label' => $prod['name'], 'path' => $prod['path'], 'fields' => $fields, 'constants' => $c, 'constantLabels' => $labels, 'formula' => $formula,
        'taxPercent' => 13, 'deposit' => ['type' => 'percent', 'value' => 100], 'discount' => ['type' => 'percent', 'value' => 0], 'revision' => 1 + $L['revision'],
        'pricingVersion' => 'supplier-labels', 'labelSchema' => 2, 'turnaround' => (string)($P['turnaround'] ?? ''), 'priceNote' => $P['note'] ?? ''];
}
/** Fields of an admin-edited label rule: kept (renamed choices etc.) only when they still have the generated fields and
 *  choice values; otherwise (rule saved before the label options changed) the generated fields are used. Option
 *  conditions ("requires", e.g. white ink only on clear film) always come from the generated rule. */
function sp_label_fields(array $saved, array $gen): array {
    $sig = function (array $fields) { $o = []; foreach ($fields as $f) { $v = []; foreach ($f['options'] ?? [] as $op) $v[] = (string)(0 + $op['value']); $o[] = ($f['key'] ?? '') . ':' . implode(',', $v); } return implode('|', $o); };
    if (!$saved || $sig($saved) !== $sig($gen)) return $gen;
    $byKey = []; foreach ($gen as $f) $byKey[$f['key']] = $f;
    foreach ($saved as &$f) {
        $g = $byKey[$f['key']] ?? null; if (!$g) continue;
        foreach (['group', 'size', 'unit'] as $k) if (isset($g[$k]) && !isset($f[$k])) $f[$k] = $g[$k];
        if (isset($f['options'])) foreach ($f['options'] as $i => &$op) { $go = $g['options'][$i] ?? null; unset($op['requires'], $op['requiresText']); if ($go && isset($go['requires'])) { $op['requires'] = $go['requires']; $op['requiresText'] = $go['requiresText'] ?? ''; } }
        unset($op);
    }
    unset($f);
    return $saved;
}
function sp_is_label_rule(string $id): bool { foreach (sp_data()['labels']['products'] as $p) if ($p['ruleId'] === $id) return true; return false; }

/** Applies supplier pricing to a rule loaded by the catalog. */
function sp_apply(?array $rule): ?array {
    if (!$rule) return $rule;
    $id = (string)($rule['id'] ?? '');
    if (str_starts_with($id, 'apparel-')) { $rule = sp_location_fields($rule); return sp_apparel_rule($rule) ?? $rule; }
    if (sp_is_label_rule($id) && ($rule['pricingVersion'] ?? '') === 'supplier-labels') {
        // admin edits of the label rule (names of choices, notes) are kept; prices always come from the label table
        $gen = sp_label_rule($id); if (!$gen) return $rule;
        $out = $rule; $out['constants'] = $gen['constants']; $out['constantLabels'] = $gen['constantLabels']; $out['formula'] = $gen['formula'];
        $out['fields'] = sp_label_fields($rule['fields'] ?? [], $gen['fields']); $out['labelSchema'] = $gen['labelSchema'];
        if (!isset($out['turnaround'])) $out['turnaround'] = $gen['turnaround'];
        $out['revision'] = max((int)($rule['revision'] ?? 0), 0) + $gen['revision'];
        return $out;
    }
    return $rule;
}

/* ================= admin routes (/api/admin/catalog/supplier...) ================= */
function sp_clean_tiers($v): array {
    $o = [];
    foreach (array_slice(is_array($v) ? $v : [], 0, 5) as $t) { if (!is_array($t)) continue; $min = sp_num($t['min'] ?? 0, 0, 100000); $pct = sp_num($t['pct'] ?? 0, 0, 90); if ($min === null || $pct === null) json_out(['error' => 'Check the quantity discounts.'], 400); $o[] = ['min' => (int)$min, 'pct' => $pct]; }
    return $o;
}
function sp_route(string $r, string $method): bool {
    if ($r === '/catalog/supplier' && $method === 'GET') {
        require_user('pricing.edit');
        $a = sp_apparel(); $all = cat_products(); $rows = [];
        foreach ($a['models'] as $id => $m) {
            $p = null; foreach ($all as $x) if (($x['ruleId'] ?? '') === $id) { $p = $x; break; }
            $base = cat_file_rule($id); $o = cat_rows('rule')[$id] ?? null; $rule = $o && empty($o['_deleted']) ? $o : $base;
            $sizes = [];
            if ($rule && !empty($rule['quantityKeys'])) foreach ($rule['fields'] as $f) if (in_array($f['key'], $rule['quantityKeys'], true)) $sizes[] = preg_replace('/\s*·\s*quantity$/u', '', (string)$f['label']);
            $gen = $rule ? sp_apparel_rule($rule) : null;
            $rows[] = ['id' => $id, 'name' => $p['name'] ?? $id, 'path' => $p['path'] ?? '', 'active' => !empty($p['active']), 'sizes' => $sizes, 'model' => $m, 'priced' => (bool)$gen,
                'from' => $gen ? cat_from_price($gen) : null];
        }
        $L = sp_labels();
        json_out(['apparel' => ['markup' => $a['markup'], 'vinylAdd' => $a['vinylAdd'], 'embroideryAdd' => $a['embroideryAdd'], 'tiers' => $a['tiers'], 'revision' => $a['revision'], 'updatedAt' => $a['updatedAt'], 'updatedBy' => $a['updatedBy'], 'models' => $rows],
            'labels' => $L, 'defaults' => ['apparelMarkup' => sp_data()['apparel']['markup'], 'labelMarkup' => sp_data()['labels']['markup'], 'source' => sp_data()['source']]]);
    }
    if ($r === '/catalog/supplier/apparel' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(600000); $cur = sp_saved('apparel-pricing');
        if (isset($v['expectedRevision']) && (int)$v['expectedRevision'] !== (int)($cur['revision'] ?? 0)) json_out(['error' => 'Someone else changed these prices a moment ago. Reload to see their version.'], 409);
        $o = ['markup' => sp_num($v['markup'] ?? null, 0.5, 10), 'vinylAdd' => sp_num($v['vinylAdd'] ?? 0, 0, 1000), 'embroideryAdd' => sp_num($v['embroideryAdd'] ?? 0, 0, 1000)];
        foreach ($o as $k => $x) if ($x === null) json_out(['error' => $k === 'markup' ? 'Markup must be between 0.5 and 10.' : 'Check the add-on amounts.'], 400);
        $o['tiers'] = sp_clean_tiers($v['tiers'] ?? []);
        $known = sp_data()['apparel']['models']; $models = [];
        foreach (is_array($v['models'] ?? null) ? $v['models'] : [] as $id => $m) {
            if (!is_string($id) || !preg_match('/^apparel-[a-z0-9-]{1,60}$/', $id) || !is_array($m)) continue;
            $x = ['enabled' => !array_key_exists('enabled', $m) || !empty($m['enabled'])];
            if (array_key_exists('markup', $m) && $m['markup'] !== null && $m['markup'] !== '') { $mk = sp_num($m['markup'], 0.5, 10); if ($mk === null) json_out(['error' => "Markup for $id must be between 0.5 and 10."], 400); $x['markup'] = $mk; }
            else $x['markup'] = null;
            foreach (['pOne', 'pChestBack', 'pFrontBack', 'eOne', 'eTwo'] as $k) if (isset($m[$k]) && $m[$k] !== '') { $n = sp_num($m[$k], 0, 1000); if ($n === null) json_out(['error' => "Check the decoration price for $id."], 400); $x[$k] = $n; }
            foreach (['print1', 'print2'] as $k) if (array_key_exists($k, $m)) { if ($m[$k] === null || $m[$k] === '') { $x[$k] = null; continue; } $n = sp_num($m[$k], 0, 1000); if ($n === null) json_out(['error' => "Check the print cost for $id."], 400); $x[$k] = $n; }
            $x['sizes'] = [];
            foreach (array_slice(is_array($m['sizes'] ?? null) ? $m['sizes'] : [], 0, 20, true) as $s => $c) {
                $s = cat_str((string)$s, 30); if ($s === '') continue;
                if ($c === null || $c === '') continue;
                $n = sp_num($c, 0, 2000); if ($n === null) json_out(['error' => "Check the $s cost for $id."], 400);
                $x['sizes'][$s] = $n;
            }
            if (!isset($known[$id]) && !$x['sizes']) continue;
            $models[$id] = $x;
        }
        $o['models'] = $models;
        $o['revision'] = (int)($cur['revision'] ?? 0) + 1; $o['updatedAt'] = now_iso(); $o['updatedBy'] = $u['name'];
        cat_put('setting', 'apparel-pricing', $o, $u);
        audit($u, 'catalog: saved apparel supplier prices', 'markup ' . $o['markup'] . ', ' . count($models) . ' models');
        json_out(['ok' => true, 'revision' => $o['revision']]);
    }
    if ($r === '/catalog/supplier/labels' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(200000); $cur = sp_saved('label-pricing'); $def = sp_data()['labels'];
        if (isset($v['expectedRevision']) && (int)$v['expectedRevision'] !== (int)($cur['revision'] ?? 0)) json_out(['error' => 'Someone else changed these prices a moment ago. Reload to see their version.'], 409);
        $o = [];
        foreach (['markup' => [0.5, 10], 'rushPct' => [0, 300], 'designFee' => [0, 5000]] as $k => [$a, $b]) { $n = sp_num($v[$k] ?? $def[$k], $a, $b); if ($n === null) json_out(['error' => "Check $k."], 400); $o[$k] = $n; }
        foreach (['roll', 'sheet', 'diecut'] as $p) {
            $in = is_array($v[$p] ?? null) ? $v[$p] : []; $x = [];
            foreach (['setup' => [0, 5000], 'minCost' => [0, 5000], 'bleedIn' => [0, 1], 'markup' => [0.5, 10]] as $k => [$a, $b]) if (array_key_exists($k, $in)) { if ($k === 'markup' && ($in[$k] === null || $in[$k] === '')) continue; $n = sp_num($in[$k], $a, $b); if ($n === null) json_out(['error' => "Check $p $k."], 400); $x[$k] = $n; }
            foreach (['materials', 'finishes', 'shapes', 'inks'] as $list) if (is_array($in[$list] ?? null) && !empty($def[$p][$list])) {
                if (count($in[$list]) !== count($def[$p][$list])) continue; // the page was opened before the choices changed
                $x[$list] = [];
                foreach ($def[$p][$list] as $i => $row) { $f = sp_num($in[$list][$i]['factor'] ?? $row['factor'], 0.1, 20); if ($f === null) json_out(['error' => "Check the $list factors."], 400); $x[$list][$i] = ['factor' => $f]; }
            }
            if (is_array($in['rates'] ?? null)) {
                $x['rates'] = [];
                foreach ($def[$p]['rates'] as $i => $row) { $f = sp_num($in['rates'][$i]['rate'] ?? $row['rate'], 0, 10); $q = sp_num($in['rates'][$i]['from'] ?? $row['from'], 0, 1000000); if ($f === null || $q === null) json_out(['error' => 'Check the rate tiers.'], 400); $x['rates'][$i] = ['rate' => $f, 'from' => $i === 0 ? 0 : (int)$q]; }
            }
            $o[$p] = $x;
        }
        $o['listVersion'] = (int)($def['listVersion'] ?? 1);
        $o['listVersions'] = ['roll' => sp_list_version($def, 'roll'), 'sheet' => sp_list_version($def, 'sheet'), 'diecut' => sp_list_version($def, 'diecut')];
        $o['revision'] = (int)($cur['revision'] ?? 0) + 1; $o['updatedAt'] = now_iso(); $o['updatedBy'] = $u['name'];
        cat_put('setting', 'label-pricing', $o, $u);
        audit($u, 'catalog: saved label prices', 'markup ' . $o['markup']);
        json_out(['ok' => true, 'revision' => $o['revision']]);
    }
    if ($r === '/catalog/supplier/reset' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(2000); $what = (string)($v['what'] ?? '');
        if (!in_array($what, ['apparel-pricing', 'label-pricing'], true)) json_out(['error' => 'Unknown table.'], 400);
        $cur = sp_saved($what);
        cat_put('setting', $what, ['revision' => (int)($cur['revision'] ?? 0) + 1, 'updatedAt' => now_iso(), 'updatedBy' => $u['name']], $u);
        audit($u, 'catalog: restored supplier price defaults', $what);
        json_out(['ok' => true]);
    }
    return false;
}
