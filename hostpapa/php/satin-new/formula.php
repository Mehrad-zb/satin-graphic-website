<?php
declare(strict_types=1);
// Port of studio-model.mjs expression()/answers()/calculate(): a restricted arithmetic formula language.

final class FormulaError extends Exception {}

function js_round(float $x): float { return floor($x + 0.5); } // Math.round semantics

function expression(string $source, array $ctx): float {
    if (strlen($source) > 6000) throw new FormulaError('Formula is too long.');
    $tokens = []; $pos = 0; $len = strlen($source);
    while ($pos < $len) {
        if (trim(substr($source, $pos)) === '') break;
        if (!preg_match('/\G\s*(?:(\d+(?:\.\d*)?|\.\d+)|([a-zA-Z_][a-zA-Z0-9_]*)|(<=|>=|==|!=|&&|\|\||[+*\/%(),^<>-]))/A', $source, $m, 0, $pos))
            throw new FormulaError('Unsupported formula character at ' . ($pos + 1));
        $tokens[] = (isset($m[1]) && $m[1] !== '') ? ['n' => (float)$m[1]] : ['v' => ($m[2] ?? '') !== '' ? $m[2] : $m[3]];
        $pos += strlen($m[0]);
        if (count($tokens) > 1000) throw new FormulaError('Formula is too complex.');
    }
    $i = 0; $depth = 0;
    $prec = ['||' => 1, '&&' => 2, '==' => 3, '!=' => 3, '<' => 4, '>' => 4, '<=' => 4, '>=' => 4, '+' => 5, '-' => 5, '*' => 6, '/' => 6, '%' => 6, '^' => 7];
    $peek = function () use (&$tokens, &$i) { return $tokens[$i]['v'] ?? null; };
    $consume = function ($v) use (&$i, $peek) { if ($peek() !== $v) throw new FormulaError('Expected ' . $v); $i++; };
    $parse = null;
    $atom = function () use (&$tokens, &$i, &$depth, $peek, $consume, &$parse, $ctx, &$atom) {
        if (++$depth > 32) throw new FormulaError('Formula nesting limit.');
        $t = $tokens[$i++] ?? null;
        if (!$t) throw new FormulaError('Incomplete formula.');
        if (isset($t['n'])) $value = $t['n'];
        elseif ($t['v'] === '-' || $t['v'] === '+') $value = ($t['v'] === '-' ? -1 : 1) * $atom();
        elseif ($t['v'] === '(') { $value = $parse(0); $consume(')'); }
        elseif (preg_match('/^[a-zA-Z_]/', $t['v'])) {
            if ($peek() === '(') {
                $i++; $args = [];
                if ($peek() !== ')') { while (true) { $args[] = $parse(0); if ($peek() !== ',') break; $i++; } }
                $consume(')');
                switch ($t['v']) {
                    case 'min': if (!$args) throw new FormulaError('min needs a value'); $value = min($args); break;
                    case 'max': if (!$args) throw new FormulaError('max needs a value'); $value = max($args); break;
                    case 'round': case 'ceil': case 'floor': case 'abs':
                        if (count($args) !== 1) throw new FormulaError($t['v'] . ' needs one value');
                        $value = $t['v'] === 'round' ? js_round($args[0]) : ($t['v'] === 'ceil' ? ceil($args[0]) : ($t['v'] === 'floor' ? floor($args[0]) : abs($args[0])));
                        break;
                    case 'if': if (count($args) !== 3) throw new FormulaError('if needs condition, true value, false value'); $value = $args[0] ? $args[1] : $args[2]; break;
                    default: throw new FormulaError('Unknown function ' . $t['v']);
                }
            } else {
                if (!array_key_exists($t['v'], $ctx)) throw new FormulaError('Unknown field or constant ' . $t['v']);
                $value = (float)$ctx[$t['v']];
            }
        } else throw new FormulaError('Unexpected token ' . $t['v']);
        $depth--;
        if (!is_finite((float)$value)) throw new FormulaError('Formula produced a non-finite value.');
        return (float)$value;
    };
    $parse = function (int $min) use (&$atom, &$parse, $peek, &$i, $prec) {
        $lhs = $atom();
        while (($op = $peek()) !== null && isset($prec[$op]) && $prec[$op] >= $min) {
            $p = $prec[$op]; $i++;
            $rhs = $parse($p + ($op === '^' ? 0 : 1));
            switch ($op) {
                case '+': $lhs += $rhs; break; case '-': $lhs -= $rhs; break; case '*': $lhs *= $rhs; break;
                case '/': if ($rhs == 0) throw new FormulaError('Formula produced a non-finite value.'); $lhs /= $rhs; break;
                case '%': if ($rhs == 0) throw new FormulaError('Formula produced a non-finite value.'); $lhs = fmod($lhs, $rhs); break;
                case '^': $lhs = $lhs ** $rhs; break;
                case '<': $lhs = (float)($lhs < $rhs); break; case '>': $lhs = (float)($lhs > $rhs); break;
                case '<=': $lhs = (float)($lhs <= $rhs); break; case '>=': $lhs = (float)($lhs >= $rhs); break;
                case '==': $lhs = (float)($lhs == $rhs); break; case '!=': $lhs = (float)($lhs != $rhs); break;
                case '&&': $lhs = (float)($lhs && $rhs); break; case '||': $lhs = (float)($lhs || $rhs); break;
            }
        }
        return (float)$lhs;
    };
    $result = $parse(0);
    if ($i !== count($tokens)) throw new FormulaError('Unexpected formula token.');
    if (!is_finite($result) || abs($result) > 100000000) throw new FormulaError('Formula result is outside the supported range.');
    return $result;
}

function answers(array $rule, array $input): array {
    $result = $rule['constants'] ?? [];
    foreach ($rule['fields'] as $f) {
        $raw = array_key_exists($f['key'], $input) ? $input[$f['key']] : $f['default'];
        if (is_bool($raw)) $raw = $raw ? 1 : 0;
        if (!is_numeric($raw)) throw new FormulaError('Check ' . $f['label']);
        $value = (float)$raw;
        if ($f['type'] === 'number') {
            $q = ($value - $f['min']) / $f['step'];
            if (abs($q - round($q)) > 0.00001) throw new FormulaError('Use increments of ' . $f['step'] . ' for ' . $f['label']);
            if ($value < $f['min'] || $value > $f['max']) throw new FormulaError('Check ' . $f['label']);
        }
        if ($f['type'] === 'select') {
            $ok = false; foreach ($f['options'] as $o) if ((float)$o['value'] === $value) { $ok = true; break; }
            if (!$ok) throw new FormulaError('Check ' . $f['label']);
        }
        if ($f['type'] === 'checkbox' && !in_array($value, [0.0, 1.0], true)) throw new FormulaError('Check ' . $f['label']);
        $result[$f['key']] = $value;
    }
    // a choice can require other choices (e.g. white ink only on clear film): {"requires": {"material": [1]}}
    foreach ($rule['fields'] as $f) {
        if (($f['type'] ?? '') !== 'select') continue;
        foreach ($f['options'] as $o) {
            if ((float)$o['value'] !== $result[$f['key']] || !is_array($o['requires'] ?? null)) continue;
            foreach ($o['requires'] as $k => $allowed) {
                if (!array_key_exists($k, $result) || !is_array($allowed)) continue;
                if (!in_array($result[$k], array_map('floatval', $allowed), true)) throw new FormulaError(($o['requiresText'] ?? '') !== '' ? (string)$o['requiresText'] : 'Check ' . $f['label']);
            }
        }
    }
    if (!empty($rule['quantityKeys'])) {
        $n = 0; foreach ($rule['quantityKeys'] as $k) $n += $result[$k] ?? 0;
        if ($n < 1) throw new FormulaError('Choose at least one garment in a size.');
    }
    return $result;
}

/* ---- several measured units (windows, walls) priced as one cart line ----
   Window and wall products are priced by area. A customer with windows of different sizes adds the extra units
   ($input['units'] = [{width, height, quantity}, ...]) to the first one (the normal width / height / quantity fields).
   The formula is evaluated once with width = total area (Σ width × height × quantity), height = 1, quantity = 1,
   so a minimum charge or a design fee applies once. Only allowed for those products, and only when the formula
   depends on width, height and quantity through their product alone (checked numerically). */
const FORMULA_UNIT_RULES = '/^(?:glass-[a-z0-9-]+|window-graphics|tint-commercial|wallpaper(?:-[a-z0-9-]+)?|wrap-prints)$/';
const FORMULA_UNITS_MAX = 40; // extra units per cart line
function formula_units_ok(array $rule): bool {
    static $cache = [];
    $key = (string)($rule['id'] ?? '') . '|' . md5((string)json_encode([$rule['formula'] ?? '', $rule['constants'] ?? [], $rule['fields'] ?? []]));
    if (isset($cache[$key])) return $cache[$key];
    $ok = false;
    try {
        $num = [];
        foreach ($rule['fields'] ?? [] as $f) if (in_array($f['key'] ?? '', ['width', 'height', 'quantity'], true) && ($f['type'] ?? '') === 'number') $num[$f['key']] = true;
        if (preg_match(FORMULA_UNIT_RULES, (string)($rule['id'] ?? '')) && count($num) === 3) {
            $ctx = answers($rule, []); // defaults
            $variants = [$ctx];
            foreach ($rule['fields'] as $f) {
                if (($f['type'] ?? '') === 'checkbox') $variants[] = [$f['key'] => $ctx[$f['key']] ? 0.0 : 1.0] + $ctx;
                if (($f['type'] ?? '') === 'select') foreach (array_slice($f['options'], 0, 8) as $o) $variants[] = [$f['key'] => (float)$o['value']] + $ctx;
            }
            $ok = true;
            foreach ($variants as $v) foreach ([[1, 1, 1], [12, 24, 1], [30.5, 65.5, 3], [7.25, 9, 40], [100, 80, 2], [600, 300, 5], [0.5, 0.5, 1]] as [$w, $h, $q]) {
                $a = expression($rule['formula'], ['width' => $w, 'height' => $h, 'quantity' => $q] + $v);
                $b = expression($rule['formula'], ['width' => $w * $h * $q, 'height' => 1, 'quantity' => 1] + $v);
                if (abs($a - $b) > 1e-6 * max(1.0, abs($a))) { $ok = false; break 2; }
            }
        }
    } catch (Throwable $e) { $ok = false; }
    return $cache[$key] = $ok;
}
/** Validated extra units ([{width, height, quantity}]), each checked against the field's min, max and step. */
function formula_units(array $rule, $units): array {
    if (!is_array($units) || $units !== array_values($units)) throw new FormulaError('Check the extra measurements.');
    if (!$units) return [];
    if (!formula_units_ok($rule)) throw new FormulaError('This product is priced one size at a time. Add each size to the cart separately.');
    if (count($units) > FORMULA_UNITS_MAX) throw new FormulaError('Add up to ' . (FORMULA_UNITS_MAX + 1) . ' measurements per item.');
    $fields = []; foreach ($rule['fields'] as $f) $fields[$f['key']] = $f;
    $out = [];
    foreach ($units as $n => $u) {
        if (!is_array($u)) throw new FormulaError('Check the measurements of unit ' . ($n + 2) . '.');
        $row = [];
        foreach (['width', 'height', 'quantity'] as $k) {
            $f = $fields[$k]; $raw = $u[$k] ?? null;
            if (is_bool($raw) || !is_numeric($raw)) throw new FormulaError('Check ' . $f['label'] . ' (unit ' . ($n + 2) . ').');
            $value = (float)$raw; $q = ($value - $f['min']) / $f['step'];
            if (abs($q - round($q)) > 0.00001) throw new FormulaError('Use increments of ' . $f['step'] . ' for ' . $f['label'] . ' (unit ' . ($n + 2) . ').');
            if ($value < $f['min'] || $value > $f['max']) throw new FormulaError('Check ' . $f['label'] . ' (unit ' . ($n + 2) . ').');
            $row[$k] = $value + 0;
        }
        $out[] = $row;
    }
    return $out;
}

/** Conditional maximums ($rule['limits'] = [{field, max, when: {key: value}, message}]), e.g. cut decals at most 49 in wide. */
function formula_limits(array $rule, array $ctx, array $units): void {
    foreach ((array)($rule['limits'] ?? []) as $l) {
        $on = true; foreach ((array)($l['when'] ?? []) as $k => $v) if (!isset($ctx[$k]) || abs((float)$ctx[$k] - (float)$v) > 1e-9) $on = false;
        if (!$on) continue;
        $vals = [(float)($ctx[$l['field']] ?? 0)]; foreach ($units as $u) if (isset($u[$l['field']])) $vals[] = (float)$u[$l['field']];
        foreach ($vals as $v) if ($v > (float)$l['max'] + 1e-9) throw new FormulaError((string)(($l['message'] ?? '') !== '' ? $l['message'] : 'Maximum ' . $l['max'] . ' for ' . $l['field'] . '.'));
    }
}
function calculate(array $rule, array $input): array {
    $units = array_key_exists('units', $input) ? formula_units($rule, $input['units']) : [];
    unset($input['units']);
    $ctx = answers($rule, $input);
    formula_limits($rule, $ctx, $units);
    if ($units) { // one evaluation over the total area of every unit
        $area = $ctx['width'] * $ctx['height'] * $ctx['quantity'];
        foreach ($units as $u) $area += $u['width'] * $u['height'] * $u['quantity'];
        $ctx['width'] = $area; $ctx['height'] = 1.0; $ctx['quantity'] = 1.0;
    }
    $base = (int)js_round(expression($rule['formula'], $ctx) * 100);
    if ($base < 0) throw new FormulaError('Estimate cannot be negative.');
    $d = $rule['discount'] ?? ['type' => 'percent', 'value' => 0];
    $automatic = $d['type'] === 'percent' ? (int)js_round($base * $d['value'] / 100) : (int)js_round($d['value'] * 100);
    $discount = min($base, max($automatic, 0));
    $net = $base - $discount;
    $tax = (int)js_round($net * ($rule['taxPercent'] ?? 13) / 100);
    $total = $net + $tax;
    $dep = $rule['deposit'] ?? ['type' => 'percent', 'value' => 100];
    $deposit = min($total, $dep['type'] === 'percent' ? (int)js_round($total * $dep['value'] / 100) : (int)js_round($dep['value'] * 100));
    return ['subtotal' => $base, 'discount' => $discount, 'net' => $net, 'tax' => $tax, 'total' => $total, 'deposit' => $deposit,
        'balance' => $total - $deposit, 'currency' => 'CAD', 'ruleId' => $rule['id'], 'revision' => $rule['revision'] ?? 0, 'coupon' => ''];
}
