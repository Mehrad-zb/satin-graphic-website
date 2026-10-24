<?php
declare(strict_types=1);
// Online ordering (port of the Worker's studio/checkout/payments code):
// artwork uploads, server-side cart + checkout, Square Payment Links + webhook, vehicle templates (digital downloads).
// Prices are always recomputed from the price rules (formula.php). Money is stored in cents (CAD).
// Payment credentials live only in site_settings ('shop.square'), written by the admin Payments page.
require_once __DIR__ . '/auth.php';
if (!function_exists('calculate')) require_once __DIR__ . '/formula.php';
if (!function_exists('cat_rule')) require_once __DIR__ . '/catalog.php';

final class ShopError extends Exception {}
@ini_set('serialize_precision', '-1'); // JSON numbers identical to JavaScript's

const SHOP_UPLOAD_MAX = 20000000;          // 20 MB per customer file
const SHOP_SESSION_FILES = 30;             // per artwork session
const SHOP_SESSION_BYTES = 60000000;       // 60 MB per artwork session
const SHOP_TEMPLATE_MAX = 52428800;        // 50 MB per template vector file
const SHOP_PREVIEW_MAX = 5000000;
const SHOP_TAX = ['ON' => 13];             // other provinces: confirm registrations first
const SHOP_PROVINCES = ['ON', 'QC', 'BC', 'AB', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'PE', 'SK', 'YT'];
const SHOP_STAGES = ['new' => 'New', 'artwork_check' => 'Artwork check', 'in_production' => 'In production', 'ready' => 'Ready', 'completed' => 'Completed', 'cancelled' => 'Cancelled'];
const SHOP_STATUSES = ['awaiting_payment' => 'Awaiting payment', 'paid' => 'Paid', 'in_production' => 'In production', 'ready' => 'Ready / shipped', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'refunded' => 'Refunded'];
const SHOP_TEMPLATE_CATEGORIES = ['Vans', 'Pickups', 'SUVs', 'Box trucks', 'Trailers', 'Cars', 'Other'];
const SQUARE_API_VERSION = '2026-09-16';
const SHOP_COOKIE = 'satin_studio';

/* ---------------- storage & database ---------------- */
function shop_db(): PDO {
    static $done = false;
    $pdo = adb();
    if ($done) return $pdo;
    $done = true;
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $k = $my ? 'VARCHAR(64)' : 'TEXT';           // keys
    $s = $my ? 'VARCHAR(255)' : 'TEXT';          // short text
    $t = $my ? 'MEDIUMTEXT' : 'TEXT';            // long text / JSON
    $cs = $my ? ' DEFAULT CHARSET=utf8mb4' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_sessions (id $k PRIMARY KEY, token_hash $s NOT NULL, ip $s NOT NULL, created_at $s NOT NULL, expires_at INTEGER NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_files (id $k PRIMARY KEY, session_id $s NOT NULL, kind $s NOT NULL, name $s NOT NULL, mime $s NOT NULL, size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, path $s NOT NULL, created_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_designs (id $k PRIMARY KEY, session_id $s NOT NULL, design $t NOT NULL, updated_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_cart_items (id $k PRIMARY KEY, session_id $s NOT NULL, design_id $s NOT NULL, design $t NOT NULL, price $t NOT NULL, status $s NOT NULL, order_id $s NOT NULL, created_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_drafts (session_id $k PRIMARY KEY, data $t NOT NULL, revision INTEGER NOT NULL, updated_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_orders (id $k PRIMARY KEY, number $s NOT NULL, session_id $s NOT NULL, draft_revision INTEGER NOT NULL, status $s NOT NULL,
        provider $s NOT NULL, provider_order_id $s NOT NULL, payment_url $t NOT NULL, payment_id $s NOT NULL,
        name $s NOT NULL, email $s NOT NULL, phone $s NOT NULL, company $s NOT NULL, address $t NOT NULL, billing $t NOT NULL, shipping $t NOT NULL,
        items $t NOT NULL, file_ids $t NOT NULL, subtotal INTEGER NOT NULL, shipping_total INTEGER NOT NULL, tax INTEGER NOT NULL, tax_rate INTEGER NOT NULL,
        total INTEGER NOT NULL, deposit INTEGER NOT NULL, currency $s NOT NULL, customer_notes $t NOT NULL, admin_notes $t NOT NULL,
        created_at $s NOT NULL, updated_at $s NOT NULL, paid_at $s NOT NULL)$cs");
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN card $s NOT NULL DEFAULT ''"); } catch (Throwable $e) { } // card brand + last 4 only
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN stage $s NOT NULL DEFAULT ''"); } catch (Throwable $e) { } // production workflow (SHOP_STAGES)
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN history $t"); } catch (Throwable $e) { } // JSON list of stage changes + notes
    try { $pdo->exec("ALTER TABLE shop_files ADD COLUMN meta $t"); } catch (Throwable $e) { } // JSON: print raster size (inches, bleed, dpi)
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN coupon_code $s NOT NULL DEFAULT ''"); } catch (Throwable $e) { }
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $e) { }
    // Design Studio designs saved to a customer account (customer.php → My account → Saved designs) + their mockup thumbnail file.
    try { $pdo->exec("ALTER TABLE shop_designs ADD COLUMN customer_id $k NOT NULL DEFAULT ''"); } catch (Throwable $e) { }
    try { $pdo->exec("ALTER TABLE shop_designs ADD COLUMN thumb_id $s NOT NULL DEFAULT ''"); } catch (Throwable $e) { }
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_coupons (id $k PRIMARY KEY, code $s NOT NULL, type $s NOT NULL, value INTEGER NOT NULL, min_subtotal INTEGER NOT NULL, starts_on $s NOT NULL, ends_on $s NOT NULL,
        max_uses INTEGER NOT NULL, max_per_email INTEGER NOT NULL, scope $s NOT NULL, scope_ids $t NOT NULL, active INTEGER NOT NULL, note $t NOT NULL, deleted INTEGER NOT NULL, created_at $s NOT NULL, updated_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_coupon_uses (id $k PRIMARY KEY, coupon_id $s NOT NULL, order_id $s NOT NULL, order_number $s NOT NULL, email $s NOT NULL, discount INTEGER NOT NULL, created_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS shop_templates (id $k PRIMARY KEY, rule_id $s NOT NULL, name $s NOT NULL, category $s NOT NULL, make $s NOT NULL, model $s NOT NULL,
        year $s NOT NULL, trim_text $s NOT NULL, body $s NOT NULL, description $t NOT NULL, price INTEGER NOT NULL, file_id $s NOT NULL, preview_id $s NOT NULL,
        published INTEGER NOT NULL, deleted INTEGER NOT NULL, revision INTEGER NOT NULL, created_at $s NOT NULL, updated_at $s NOT NULL)$cs");
    return $pdo;
}

function shop_storage(string $sub): string {
    $base = (string)(cfg('storage_dir') ?: __DIR__ . '/storage');
    if (!is_dir($base)) @mkdir($base, 0750, true);
    if (!is_file($base . '/.htaccess')) @file_put_contents($base . '/.htaccess', "Require all denied\nDeny from all\n");
    $d = $base . '/' . $sub;
    if (!is_dir($d)) @mkdir($d, 0750, true);
    return $d;
}
/** Absolute path of a stored file. Paths are only ever built from our own random hex ids. */
function shop_file_path(array $row): string {
    if (!preg_match('#^(uploads|templates)/[a-f0-9]{32}$#', (string)$row['path'])) throw new ShopError('File unavailable.');
    $base = (string)(cfg('storage_dir') ?: __DIR__ . '/storage');
    return $base . '/' . $row['path'];
}
function shop_hex_id(): string { return bin2hex(random_bytes(16)); }
// File ids are UUIDs (the Design Studio model requires that format); early files used 32 hex characters.
function shop_is_id($v): bool { return is_string($v) && preg_match('/^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/', $v) === 1; }
function shop_is_uuid($v): bool { return is_string($v) && preg_match('/^[a-f0-9-]{36}$/i', $v) === 1; }

function shop_setting(string $k) { $q = shop_db()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute([$k]); $r = $q->fetch(); return $r ? json_decode($r['v'], true) : null; }
function shop_setting_set(string $k, $v): void {
    $pdo = shop_db(); $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute([$k, json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now_iso()]);
    $pdo->commit();
}
/** Server secret for signed download links (generated once, kept in the database). */
function shop_secret(): string {
    $s = shop_setting('shop.secret');
    if (is_string($s) && strlen($s) === 64) return $s;
    $s = bin2hex(random_bytes(32)); shop_setting_set('shop.secret', $s); return $s;
}

/* ---------------- Square settings ---------------- */
function shop_square(): array {
    $c = shop_setting('shop.square');
    $c = is_array($c) ? $c : [];
    return ['environment' => ($c['environment'] ?? 'sandbox') === 'production' ? 'production' : 'sandbox', 'applicationId' => (string)($c['applicationId'] ?? ''),
        'locationId' => (string)($c['locationId'] ?? ''), 'accessToken' => (string)($c['accessToken'] ?? ''), 'webhookKey' => (string)($c['webhookKey'] ?? ''),
        'webhookUrl' => (string)($c['webhookUrl'] ?? ''), 'enabled' => ($c['enabled'] ?? true) !== false, 'afterpay' => ($c['afterpay'] ?? true) !== false, 'updatedAt' => $c['updatedAt'] ?? null, 'updatedBy' => $c['updatedBy'] ?? null];
}
function shop_square_ready(?array $c = null): bool { $c = $c ?? shop_square(); return $c['enabled'] && $c['accessToken'] !== '' && $c['locationId'] !== '' && $c['webhookKey'] !== ''; }
function shop_webhook_url(?array $c = null): string { $c = $c ?? shop_square(); return $c['webhookUrl'] !== '' ? $c['webhookUrl'] : site_url() . '/api/payments/webhook/square'; }

function shop_square_call(array $c, string $method, string $path, ?array $body = null): array {
    if (!function_exists('curl_init')) throw new ShopError('The server cannot reach Square (curl is missing).');
    $base = (string)(cfg('square_api_base') ?: ($c['environment'] === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com')); // override only for local tests
    $ch = curl_init($base . $path);
    $headers = ['Authorization: Bearer ' . $c['accessToken'], 'Square-Version: ' . SQUARE_API_VERSION, 'Accept: application/json'];
    $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_CUSTOMREQUEST => $method];
    if ($body !== null) { $headers[] = 'Content-Type: application/json'; $opt[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); }
    $opt[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opt);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($raw === false) throw new ShopError('Could not reach Square. ' . $err);
    $j = json_decode((string)$raw, true);
    if (!is_array($j)) throw new ShopError('Square returned an invalid response.');
    if ($code >= 400) { $e = $j['errors'][0] ?? []; throw new ShopError('Square: ' . mb_substr((string)($e['detail'] ?? $e['code'] ?? ('HTTP ' . $code)), 0, 200)); }
    return $j;
}

/* ---------------- customer (artwork) session ---------------- */
function shop_session(): ?array {
    static $cache = false;
    if ($cache !== false) return $cache;
    $c = (string)($_COOKIE[SHOP_COOKIE] ?? '');
    if (!preg_match('/^([a-f0-9]{32})\.([a-f0-9]{64})$/', $c, $m)) return $cache = null;
    $q = shop_db()->prepare('SELECT * FROM shop_sessions WHERE id = ? AND expires_at > ?'); $q->execute([$m[1], time()]);
    $s = $q->fetch();
    return $cache = ($s && hash_equals($s['token_hash'], hash('sha256', $m[2])) ? $s : null);
}
function shop_session_required(): array { $s = shop_session(); if (!$s) json_out(['error' => 'Start a secure artwork session first.'], 401); return $s; }
function shop_secure(): bool { return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'; }
function shop_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }
function shop_limit(string $key, int $max, int $window, string $msg = 'Too many requests. Please wait a little and try again.'): void {
    if (rate_limited($key, $max, $window)) json_out(['error' => $msg], 429);
    note_attempt($key);
}

/* ---------------- products & price rules ---------------- */
function shop_template_rule_from_row(array $t): array {
    return ['id' => $t['rule_id'], 'label' => $t['name'], 'path' => '/satin/shop/products/' . $t['rule_id'],
        'fields' => [['key' => 'quantity', 'label' => 'Licence', 'type' => 'number', 'default' => 1, 'min' => 1, 'max' => 1, 'step' => 1]],
        'constants' => ['unitPrice' => round(((int)$t['price']) / 100, 2)], 'formula' => 'quantity * unitPrice', 'taxPercent' => 13,
        'discount' => ['type' => 'percent', 'value' => 0], 'deposit' => ['type' => 'percent', 'value' => 100], 'revision' => (int)$t['revision'], 'artworkOptional' => true];
}
function shop_template_by_rule(string $ruleId): ?array {
    if (!preg_match('/^template-[a-f0-9]{8}$/', $ruleId)) return null;
    $q = shop_db()->prepare('SELECT * FROM shop_templates WHERE rule_id = ? AND deleted = 0 AND published = 1'); $q->execute([$ruleId]);
    return $q->fetch() ?: null;
}
function shop_template_rule(string $ruleId): ?array { $t = shop_template_by_rule($ruleId); return $t && $t['file_id'] !== '' ? shop_template_rule_from_row($t) : null; }
function shop_template_product(array $t): array {
    return ['id' => $t['rule_id'], 'name' => $t['name'], 'path' => '/satin/shop/products/' . $t['rule_id'], 'ruleId' => $t['rule_id'], 'studioProductId' => '', 'active' => true, 'stock' => null,
        'description' => $t['description'], 'artwork' => false, 'images' => $t['preview_id'] !== '' ? ['/api/template-preview?id=' . $t['id']] : [], 'templateURL' => '', 'templates' => [], 'digital' => true];
}
function shop_rule(string $id): ?array {
    if (str_starts_with($id, 'template-')) return shop_template_rule($id);
    return cat_rule($id);
}
/** Configured, visible product for a price rule (or the template product). */
function shop_product_for_rule(string $ruleId): ?array {
    if (str_starts_with($ruleId, 'template-')) { $t = shop_template_by_rule($ruleId); return $t && $t['file_id'] !== '' ? shop_template_product($t) : null; }
    $hidden = cat_unavailable();
    foreach (cat_products() as $p) if (($p['ruleId'] ?? '') === $ruleId && !empty($p['active']) && empty($p['_deleted']) && !in_array($p['path'] ?? '', $hidden, true)) return $p;
    return null;
}
function shop_field_values(array $rule, array $answers): array {
    $o = []; foreach ($rule['fields'] as $f) $o[$f['key']] = $answers[$f['key']] + 0; return $o;
}
/** Field values of a cart item, plus its extra measured units (window / wall products, formula.php formula_units). */
function shop_item_values(array $rule, array $raw): array {
    $values = shop_field_values($rule, answers($rule, $raw));
    if (isset($raw['units']) && $raw['units'] !== []) { $units = formula_units($rule, $raw['units']); if ($units) $values['units'] = $units; }
    return $values;
}
function shop_num_text($n): string { $t = rtrim(rtrim(number_format((float)$n, 2, '.', ''), '0'), '.'); return $t === '' ? '0' : $t; }
/** "Unit 1: 30.5 × 65.5 in × 1", … and the total area, for items with several measured units. */
function shop_unit_choices(array $rule, array $values): array {
    if (empty($values['units']) || !is_array($values['units'])) return [];
    $all = array_merge([['width' => $values['width'] ?? 0, 'height' => $values['height'] ?? 0, 'quantity' => $values['quantity'] ?? 1]], $values['units']);
    $o = []; $area = 0.0;
    foreach ($all as $n => $u) { $o[] = ['label' => 'Unit ' . ($n + 1), 'text' => shop_num_text($u['width']) . ' × ' . shop_num_text($u['height']) . ' in × ' . shop_num_text($u['quantity'])]; $area += (float)$u['width'] * (float)$u['height'] * (float)$u['quantity']; }
    $o[] = ['label' => 'Total area', 'text' => shop_num_text($area / 144) . ' sq ft · ' . count($all) . ' units'];
    return $o;
}
/** Printed size in inches from width/height fields or a "W × H" option label (port of the client's printSizeInches). */
function shop_print_size(array $rule, array $values): ?array {
    $w = (float)($values['width'] ?? 0); $h = (float)($values['height'] ?? 0);
    if ($w > 0 && $h > 0) {
        $unit = ''; foreach ($rule['fields'] as $f) if ($f['key'] === 'width') $unit = strtolower((string)$f['label']);
        if (preg_match('/\bft\b|feet/', $unit)) return [$w * 12, $h * 12];
        if (preg_match('/\bcm\b/', $unit)) return [$w / 2.54, $h / 2.54];
        return [$w, $h];
    }
    foreach ($rule['fields'] as $f) {
        if ($f['type'] !== 'select') continue;
        foreach ($f['options'] as $o) {
            if ((float)$o['value'] !== (float)($values[$f['key']] ?? $f['default'])) continue;
            if (preg_match('/(\d+(?:\.\d+)?)\s*(?:"|in|′|\')?\s*[×x]\s*(\d+(?:\.\d+)?)\s*(ft|feet|in|"|cm)?/iu', (string)$o['label'], $m)) {
                $a = (float)$m[1]; $b = (float)$m[2]; $u = strtolower($m[3] ?? 'in');
                if ($u === 'ft' || $u === 'feet') { $a *= 12; $b *= 12; } elseif ($u === 'cm') { $a /= 2.54; $b /= 2.54; }
                return [$a, $b];
            }
        }
    }
    return null;
}
function shop_spec(array $rule, array $values): array {
    $size = shop_print_size($rule, $values);
    $r = fn($n) => round($n, 3) + 0;
    return ['width' => $size ? $r($size[0]) : '—', 'height' => $size ? $r($size[1]) : '—', 'bleed' => 0.0625, 'sides' => isset($values['print_sides']) && (float)$values['print_sides'] != 0 ? 2 : (isset($values['loc_front']) && (int)($values['placement'] ?? 0) === 9 ? max(1, (int)array_sum(array_intersect_key($values, array_flip(['loc_front', 'loc_back', 'loc_chest'])))) : 1)];
}
function shop_choices(array $rule, array $values): array {
    $o = [];
    foreach ($rule['fields'] as $f) {
        if ($f['type'] !== 'select' || in_array($f['key'], ['quantity', 'print_sides', 'size'], true)) continue;
        $label = ''; foreach ($f['options'] as $x) if ((float)$x['value'] === (float)($values[$f['key']] ?? null)) $label = (string)$x['label'];
        if ($f['key'] === 'placement' && preg_match('/^choose locations$/i', $label)) { // apparel multi-location: list the chosen print locations
            $locs = []; foreach ($rule['fields'] as $l) if (($l['type'] ?? '') === 'checkbox' && str_starts_with((string)$l['key'], 'loc_') && !empty($values[$l['key']])) $locs[] = (string)$l['label'];
            $o[] = ['label' => 'Print locations', 'text' => implode(', ', $locs)]; continue;
        }
        $o[] = ['label' => (string)$f['label'], 'text' => $label];
    }
    if (!empty($rule['quantityKeys']) && is_array($rule['quantityKeys'])) { // apparel: per-size breakdown from the priced values
        $parts = []; $n = 0;
        foreach ($rule['fields'] as $f) {
            if (!in_array($f['key'], $rule['quantityKeys'], true)) continue;
            $q = (int)($values[$f['key']] ?? 0); if ($q <= 0) continue;
            $n += $q; $parts[] = preg_replace('/ · quantity$/u', '', (string)$f['label']) . ' × ' . $q;
        }
        if ($parts) { $o[] = ['label' => 'Sizes', 'text' => implode(' · ', $parts)]; $o[] = ['label' => 'Total garments', 'text' => (string)$n]; }
    }
    $o = array_merge(shop_unit_choices($rule, $values), $o); // several windows / walls in one item: every unit's size
    if (is_string($rule['turnaround'] ?? null) && $rule['turnaround'] !== '') $o[] = ['label' => 'Turnaround', 'text' => $rule['turnaround']]; // print shop: standard production time (catalog.php)
    return $o;
}

/* ---------------- files: type sniffing & checks ---------------- */
function shop_svg_safe(string $svg, bool $strict): bool {
    if (preg_match('/<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript:/i', $svg)) return false;
    if ($strict && preg_match('/<\s*(image|use|style|animate|set)\b|(?:href|src)\s*=|url\s*\(/i', $svg)) return false;
    return true;
}
/** MIME type from the file's first bytes; null when not an accepted type. */
function shop_sniff(string $data, bool $template = false): ?string {
    if (strncmp($data, "\x89PNG\r\n\x1a\n", 8) === 0) return 'image/png';
    if (strncmp($data, "\xFF\xD8\xFF", 3) === 0) return 'image/jpeg';
    if (substr($data, 0, 4) === 'RIFF' && substr($data, 8, 4) === 'WEBP') return 'image/webp';
    // ZIP before PDF: a ZIP that stores a PDF has "%PDF-" in its first KB and must never pass as a PDF
    if (strncmp($data, "PK\x03\x04", 4) === 0 || strncmp($data, "PK\x05\x06", 4) === 0 || strncmp($data, "PK\x07\x08", 4) === 0)
        return $template && strncmp($data, "PK\x03\x04", 4) === 0 ? 'application/zip' : null; // admin-only: wrap design packages (accepted only where listed)
    if (strpos(substr($data, 0, 1024), '%PDF-') !== false) return 'application/pdf';
    if ($template && (strncmp($data, '%!PS-Adobe', 10) === 0 || strncmp($data, "\xC5\xD0\xD3\xC6", 4) === 0)) return 'application/postscript';
    $head = ltrim(substr($data, 0, 4096), "\xEF\xBB\xBF \t\r\n");
    if (preg_match('/^(?:<\?xml[^>]*>\s*)?(?:<!--.*?-->\s*)*<svg[\s>]/is', $head)) {
        if (!shop_svg_safe($data, !$template)) throw new ShopError('SVG files must contain only vector shapes: no scripts, external links or embedded content.');
        return 'image/svg+xml';
    }
    return null;
}
function shop_upload_error(int $code, int $max): string {
    if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) return 'This file is larger than the server accepts (' . ini_get('upload_max_filesize') . '). Email large files to info@satingraphic.ca.';
    if ($code === UPLOAD_ERR_NO_FILE) return 'Choose a file to upload.';
    return 'The upload did not complete. Please try again.';
}
/** Validates a $_FILES entry and moves it into storage. Returns the shop_files row. */
function shop_store_upload(array $f, string $kind, string $sessionId, int $max, array $allowed, bool $template = false): array {
    if (!isset($f['error']) || is_array($f['error'])) throw new ShopError('Upload one file at a time.');
    if ($f['error'] !== UPLOAD_ERR_OK) throw new ShopError(shop_upload_error((int)$f['error'], $max));
    $size = (int)$f['size'];
    if ($size < 8 || $size > $max) throw new ShopError('Choose a file smaller than ' . round($max / 1000000) . ' MB.');
    if (!is_uploaded_file($f['tmp_name'])) throw new ShopError('Upload failed.');
    $data = (string)file_get_contents($f['tmp_name']);
    $mime = shop_sniff($data, $template);
    if (!$mime || !in_array($mime, $allowed, true)) throw new ShopError('This file type is not accepted here.');
    $w = 0; $h = 0;
    if (in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) {
        $info = @getimagesizefromstring($data);
        if (!$info) throw new ShopError('This image could not be read. Export it again and retry.');
        [$w, $h] = $info;
    }
    $id = uuid(); $dir = $kind === 'upload' ? 'uploads' : 'templates';
    shop_storage($dir);
    $row = ['id' => $id, 'session_id' => $sessionId, 'kind' => $kind, 'name' => shop_clean_name((string)$f['name']), 'mime' => $mime, 'size' => $size, 'width' => (int)$w, 'height' => (int)$h, 'path' => $dir . '/' . str_replace('-', '', $id), 'created_at' => now_iso()];
    if (!move_uploaded_file($f['tmp_name'], shop_file_path($row))) throw new ShopError('The file could not be saved. Please retry.');
    @chmod(shop_file_path($row), 0640);
    shop_db()->prepare('INSERT INTO shop_files (id,session_id,kind,name,mime,size,width,height,path,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        ->execute(array_values($row));
    return $row;
}
function shop_clean_name(string $n): string { $n = preg_replace('/[^a-zA-Z0-9._ -]/', '_', mb_substr(trim(basename($n)), 0, 120)); return $n !== '' ? $n : 'upload'; }
function shop_file(string $id): ?array { if (!shop_is_id($id)) return null; $q = shop_db()->prepare('SELECT * FROM shop_files WHERE id = ?'); $q->execute([$id]); return $q->fetch() ?: null; }
function shop_owned_file(string $id, string $sessionId): array {
    $f = shop_file($id);
    if (!$f || !in_array($f['kind'], ['upload', 'generated'], true) || !hash_equals($f['session_id'], $sessionId)) throw new ShopError('Artwork file not found. Upload it again.');
    return $f;
}
/** Stores bytes produced by the server or the Design Studio (already validated by the caller). */
function shop_store_bytes(string $data, string $kind, string $sessionId, string $name, string $mime, int $w = 0, int $h = 0, ?array $meta = null): array {
    $id = uuid(); shop_storage('uploads');
    $row = ['id' => $id, 'session_id' => $sessionId, 'kind' => $kind, 'name' => shop_clean_name($name), 'mime' => $mime, 'size' => strlen($data), 'width' => $w, 'height' => $h, 'path' => 'uploads/' . str_replace('-', '', $id), 'created_at' => now_iso()];
    if (file_put_contents(shop_file_path($row), $data, LOCK_EX) !== strlen($data)) throw new ShopError('The file could not be saved. Please retry.');
    @chmod(shop_file_path($row), 0640);
    shop_db()->prepare('INSERT INTO shop_files (id,session_id,kind,name,mime,size,width,height,path,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute(array_values($row));
    if ($meta) { shop_db()->prepare('UPDATE shop_files SET meta = ? WHERE id = ?')->execute([json_encode($meta), $id]); $row['meta'] = json_encode($meta); }
    return $row;
}
/** True when $s is "data:<allowed type>;base64,<base64>" (checked without regex backtracking on large strings). */
function shop_is_data_url(string $s, array $types): bool {
    $comma = strpos($s, ','); if ($comma === false || $comma > 60) return false;
    $head = strtolower(substr($s, 0, $comma));
    if (!preg_match('#^data:([a-z0-9.+/-]+);base64$#', $head, $m) || !in_array($m[1], $types, true)) return false;
    $body = substr($s, $comma + 1);
    return $body !== '' && strspn($body, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/= \r\n") === strlen($body);
}
/** Strict check of a Design Studio print SVG (the shapes svgArtwork() produces). Throws on anything else. */
function shop_check_design_svg(string $svg): void {
    $bad = function (string $why): void { throw new ShopError('The print file made by Design Studio did not pass our safety check (' . $why . ').'); };
    if (strlen($svg) > 25000000) $bad('too large');
    if (stripos($svg, '<!DOCTYPE') !== false || stripos($svg, '<!ENTITY') !== false) $bad('doctype');
    $doc = new DOMDocument(); $prev = libxml_use_internal_errors(true);
    $ok = $doc->loadXML($svg, LIBXML_NONET | LIBXML_PARSEHUGE); libxml_clear_errors(); libxml_use_internal_errors($prev);
    if (!$ok || !$doc->documentElement || $doc->documentElement->localName !== 'svg') $bad('not an SVG');
    $tags = ['svg', 'defs', 'style', 'g', 'rect', 'text', 'tspan', 'textPath', 'image', 'path', 'ellipse', 'circle', 'line', 'polygon', 'polyline', 'linearGradient', 'stop'];
    $attrs = ['xmlns', 'xmlns:xlink', 'width', 'height', 'viewBox', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'd', 'points', 'transform', 'fill', 'stroke', 'stroke-width', 'opacity',
        'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dx', 'dy', 'href', 'xlink:href', 'preserveAspectRatio',
        'letter-spacing', 'fill-rule', 'stroke-linecap', 'stroke-linejoin', 'id', 'offset', 'stop-color', 'stop-opacity', 'startOffset']; // gradients: <linearGradient id> + fill="url(#id)" only
    foreach ($doc->getElementsByTagName('*') as $el) {
        if (!in_array($el->localName, $tags, true) || ($el->namespaceURI && $el->namespaceURI !== 'http://www.w3.org/2000/svg')) $bad('element ' . $el->localName);
        foreach ($el->attributes as $a) {
            $n = $a->prefix ? $a->prefix . ':' . $a->localName : $a->localName;
            if (!in_array($n, $attrs, true)) $bad('attribute ' . $n);
            $v = $a->value;
            if (($n === 'href' || $n === 'xlink:href') && $el->localName === 'textPath') { if (!preg_match('/^#[A-Za-z][A-Za-z0-9_-]{0,40}$/', $v)) $bad('text path'); }
            elseif ($n === 'href' || $n === 'xlink:href') { if ($el->localName !== 'image' || !shop_is_data_url($v, ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])) $bad('external image'); }
            elseif (($n === 'fill' || $n === 'stroke') && preg_match('/^url\(#[A-Za-z0-9_-]{1,40}\)$/', $v)) continue;
            elseif ($n === 'id' && !preg_match('/^[A-Za-z][A-Za-z0-9_-]{0,40}$/', $v)) $bad('attribute value');
            elseif (preg_match('/url\s*\(|javascript:|expression|[<>]/i', $v)) $bad('attribute value');
        }
        if ($el->localName === 'style') {
            // Embedded fonts: url('data:font/...;base64,…') — quoted or not (Google Fonts CSS leaves its URLs unquoted).
            $css = preg_replace("#url\(\s*(['\"]?)data:(?:font/(?:woff2|woff|ttf|otf|sfnt|opentype|truetype)|application/(?:font-woff2?|x-font-(?:woff2?|ttf|otf|truetype|opentype)|font-sfnt|vnd\.ms-opentype|octet-stream));base64,[A-Za-z0-9+/=]++\\1\s*\)#", 'url()', $el->textContent);
            if ($css === null || preg_match('/@import|url\(\s*[^)\s]|expression|javascript:|behavior|</i', $css)) $bad('style');
        }
    }
}
function shop_send_file(array $f, bool $inline, string $cache = 'private, no-store'): void {
    $p = shop_file_path($f);
    if (!is_file($p)) json_out(['error' => 'File unavailable.'], 404);
    $inline = $inline && in_array($f['mime'], ['image/png', 'image/jpeg', 'image/webp'], true);
    $ext = ['application/zip' => 'zip', 'application/pdf' => 'pdf', 'image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/svg+xml' => 'svg'][$f['mime']] ?? '';
    $name = preg_replace('/[^a-zA-Z0-9._-]/', '_', (string)$f['name']);
    if ($ext && !preg_match('/\.' . $ext . '$/i', $name) && !($ext === 'jpg' && preg_match('/\.jpe?g$/i', $name))) $name .= '.' . $ext;
    header('Content-Type: ' . $f['mime']);
    header('Content-Length: ' . filesize($p));
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $name . '"');
    header('Cache-Control: ' . $cache);
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    header('X-Robots-Tag: noindex, nofollow');
    readfile($p);
    exit;
}
/** PDF facts readable without a PDF library: page count and the first MediaBox (when not compressed). */
function shop_pdf_facts(string $path): array {
    $data = (string)@file_get_contents($path, false, null, 0, 25000000);
    $pages = preg_match_all('#/Type\s*/Page(?![a-zA-Z])#', $data);
    $box = null;
    if (preg_match('#/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]#', $data, $m)) $box = [abs((float)$m[3] - (float)$m[1]) / 72, abs((float)$m[4] - (float)$m[2]) / 72];
    return ['pages' => $pages ?: 0, 'size' => $box, 'encrypted' => strpos($data, '/Encrypt') !== false];
}
/** Basic artwork check for one file at the ordered print size. */
function shop_check_file(array $f, array $rule, array $values): array {
    $size = shop_print_size($rule, $values);
    $large = preg_match('/large-format|wallpaper|window|wrap|banner|sign/', ($rule['path'] ?? '') . $rule['id']) === 1; $need = $large ? 150 : 300;
    $out = ['id' => $f['id'], 'name' => $f['name'], 'size' => (int)$f['size'], 'mime' => $f['mime'], 'pageCount' => 1, 'status' => 'review', 'message' => ''];
    if ($f['width'] > 0 && $f['height'] > 0) {
        $w = (int)$f['width']; $h = (int)$f['height']; $msg = ["$w × $h px."];
        if ($size) {
            [$a, $b] = $size;
            $dpi = (int)round(max(min($w / $a, $h / $b), min($w / $b, $h / $a)));
            $ok = $dpi >= $need;
            $msg[] = 'About ' . $dpi . ' DPI at ' . round($a, 2) . ' × ' . round($b, 2) . ' in' . ($ok ? ' — good.' : " — below the recommended $need DPI; the print may look soft or pixelated.");
            $r1 = $w / $h; $d = min(abs($r1 - $a / $b) / ($a / $b), abs($r1 - $b / $a) / ($b / $a));
            if ($d > 0.06) { $ok = false; $msg[] = 'The proportions do not match the ordered size; parts may be cropped or white edges may appear.'; }
            $out['dpi'] = $dpi; $out['status'] = $ok ? 'checked' : 'review';
        } else $msg[] = 'Choose a size to check the print resolution.';
        $out['message'] = implode(' ', $msg) . ' Colour and final layout are reviewed by our prepress team.';
        $out['pages'] = [['page' => 1, 'width' => $size ? $size[0] : 0, 'height' => $size ? $size[1] : 0, 'checks' => [['name' => 'Image resolution', 'status' => $out['status'] === 'checked' ? 'pass' : 'review', 'detail' => implode(' ', $msg)]]]];
        return $out;
    }
    if ($f['mime'] === 'application/pdf') {
        $p = shop_pdf_facts(shop_file_path($f));
        $out['pageCount'] = max(1, (int)$p['pages']);
        $msg = 'PDF accepted (' . $out['pageCount'] . ' page' . ($out['pageCount'] === 1 ? '' : 's') . ').';
        if ($p['encrypted']) $msg .= ' The PDF appears to be password protected; export an unlocked print PDF.';
        if ($p['size']) $msg .= ' Page size ' . round($p['size'][0], 3) . ' × ' . round($p['size'][1], 3) . ' in.';
        $out['message'] = $msg . ' Trim, bleed, image resolution, colour and fonts are checked by our prepress team before printing.';
        $out['pages'] = [['page' => 1, 'width' => $p['size'][0] ?? 0, 'height' => $p['size'][1] ?? 0, 'checks' => [['name' => 'PDF', 'status' => 'review', 'detail' => $out['message']]]]];
        return $out;
    }
    $out['message'] = 'Vector file accepted. Dimensions, colour and cutting paths are checked by our prepress team.';
    $out['pages'] = [['page' => 1, 'width' => 0, 'height' => 0, 'checks' => [['name' => 'Vector file', 'status' => 'review', 'detail' => $out['message']]]]];
    return $out;
}

/* ---------------- shipping & totals ---------------- */
function shop_is_gta(array $a): bool {
    $areas = ['toronto' => '/^M/', 'scarborough' => '/^M/', 'etobicoke' => '/^M/', 'north york' => '/^M/', 'east york' => '/^M/', 'vaughan' => '/^L(4[HJLK]|6A)/', 'woodbridge' => '/^L4[HL]/', 'concord' => '/^L4K/', 'thornhill' => '/^L[34]T/',
        'markham' => '/^L(3[PRS]|6[BCGE])/', 'richmond hill' => '/^L4[BCES]/', 'aurora' => '/^L4G/', 'newmarket' => '/^L3[XY]/', 'mississauga' => '/^L(4[TVWXYZ]|5[A-Z])/', 'brampton' => '/^L(6[PRSTVWXYZ]|7A)/',
        'oakville' => '/^L6[HJKLM]/', 'burlington' => '/^L7[LMNPRST]/', 'milton' => '/^L9[ET]/', 'pickering' => '/^L1[UVWX]/', 'ajax' => '/^L1[STZ]/', 'whitby' => '/^L1[MNPR]/', 'oshawa' => '/^L1[GHJKL]/',
        'halton hills' => '/^L7[GJ]/', 'georgetown' => '/^L7G/', 'acton' => '/^L7J/', 'clarington' => '/^L1[BCE]/', 'bowmanville' => '/^L1C/', 'courtice' => '/^L1E/', 'newcastle' => '/^L1B/', 'uxbridge' => '/^L9P/',
        'georgina' => '/^L4P/', 'keswick' => '/^L4P/', 'king city' => '/^L7B/', 'stouffville' => '/^L4A/', 'whitchurch stouffville' => '/^L4A/', 'east gwillimbury' => '/^L9N/'];
    $city = preg_replace('/\s+/', ' ', preg_replace('/[-,]+/', ' ', strtolower(trim((string)($a['city'] ?? '')))));
    $postal = strtoupper(str_replace(' ', '', (string)($a['zip'] ?? '')));
    return ($a['country'] ?? '') === 'CA' && strtoupper((string)($a['state'] ?? '')) === 'ON' && preg_match('/^[A-Z]\d[A-Z]\d[A-Z]\d$/', $postal) && isset($areas[$city]) && preg_match($areas[$city], $postal);
}
const SHOP_PICKUP_ADDRESS = '50 Viceroy Rd, Unit 22–23, Vaughan, ON';
/** Methods the customer can choose: pickup only for a pickup order; GTA next-day delivery for eligible delivery addresses. */
function shop_rates(array $address, string $mode = 'ship'): array {
    if ($mode === 'pickup') return [['id' => 'pickup', 'label' => 'Pickup at Satin', 'amount' => 0, 'currency' => 'CAD', 'detail' => 'Free. Collect at 50 Viceroy Rd, Unit 22–23, Vaughan after your order is ready — we email you when it is.']];
    return shop_is_gta($address) ? [['id' => 'gta-next-day', 'label' => 'GTA next business day delivery', 'amount' => 50, 'currency' => 'CAD', 'detail' => 'After production is complete. Weekends and holidays excluded.']] : [];
}
/** Delivery choices shown for a delivery address: GTA next-day (when eligible) and carriers that are not connected yet. */
function shop_delivery_options(array $address): array {
    $gta = shop_is_gta($address);
    return [['id' => 'gta-next-day', 'label' => 'GTA next business day delivery', 'amount' => 50, 'available' => $gta, 'note' => $gta ? 'After production is complete. Weekends and holidays excluded.' : 'Outside the GTA delivery area'],
        ['id' => 'ups', 'label' => 'UPS', 'available' => false, 'note' => 'Soon'], ['id' => 'purolator', 'label' => 'Purolator', 'available' => false, 'note' => 'Soon'],
        ['id' => 'canada-post', 'label' => 'Canada Post', 'available' => false, 'note' => 'Soon'], ['id' => 'fedex', 'label' => 'FedEx', 'available' => false, 'note' => 'Soon']];
}
function shop_is_pickup_order(array $o): bool { $s = json_decode((string)($o['shipping'] ?? ''), true) ?: []; return ($s['id'] ?? '') === 'pickup' && !str_starts_with((string)($s['label'] ?? ''), 'To be confirmed'); }
function shop_totals(array $d): array {
    $sub = 0; foreach ($d['items'] as $i) $sub += (int)$i['price']['net'];
    $ship = (int)round(((float)($d['shipping']['amount'] ?? 0)) * 100);
    $prov = ($d['shipping']['id'] ?? '') === 'pickup' ? 'ON' : ($d['address']['state'] ?? null);
    $rate = $prov !== null ? (SHOP_TAX[$prov] ?? null) : null;
    $disc = 0; $code = null; $err = null;
    if (!empty($d['coupon'])) {
        $code = (string)$d['coupon'];
        try { $disc = shop_coupon_eval($code, shop_coupon_lines($d['items']), $d['address']['email'] ?? null, $sub)['discount']; } catch (ShopError $e) { $err = $e->getMessage(); }
    }
    $base = $sub - $disc + $ship; // discount before tax; never below zero
    $tax = $rate !== null ? (int)round($base * $rate / 100) : null;
    return ['subtotal' => $sub, 'discount' => $disc, 'coupon' => $code, 'couponError' => $err, 'shipping' => $ship, 'tax' => $tax, 'rate' => $rate, 'total' => $tax === null ? null : $base + $tax, 'currency' => 'CAD', 'taxReady' => $rate !== null];
}

/* ---------------- drafts ---------------- */
function shop_empty_draft(): array { return ['items' => [], 'address' => null, 'billingAddress' => null, 'rates' => [], 'shipping' => null, 'submitted' => null]; }
function shop_draft(string $sid): array {
    $q = shop_db()->prepare('SELECT data, revision FROM shop_drafts WHERE session_id = ?'); $q->execute([$sid]); $r = $q->fetch();
    return $r ? [json_decode($r['data'], true) ?: shop_empty_draft(), (int)$r['revision'], true] : [shop_empty_draft(), 0, false];
}
function shop_draft_save(string $sid, array $draft, int $revision, bool $exists): bool {
    $data = json_encode($draft, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (strlen($data) > 250000) throw new ShopError('Checkout exceeds the allowed size.');
    $pdo = shop_db();
    if ($exists) { $q = $pdo->prepare('UPDATE shop_drafts SET data = ?, revision = revision + 1, updated_at = ? WHERE session_id = ? AND revision = ?'); $q->execute([$data, now_iso(), $sid, $revision]); return $q->rowCount() > 0; }
    try { $pdo->prepare('INSERT INTO shop_drafts (session_id,data,revision,updated_at) VALUES (?,?,1,?)')->execute([$sid, $data, now_iso()]); return true; }
    catch (PDOException $e) { return false; }
}
function shop_status(array $draft, int $revision): array {
    $sq = shop_square_ready(); $pp = shop_paypal_ready();
    // Without any provider the card button stays enabled so the order can still be placed: it is saved as awaiting payment and the
    // owner sends a payment link (paymentMode tells the page which will happen: square, paypal, both or manual).
    return ['draft' => $draft, 'revision' => $revision, 'totals' => shop_totals($draft), 'paymentMode' => $sq && $pp ? 'both' : ($sq ? 'square' : ($pp ? 'paypal' : 'manual')),
        'connections' => ['login' => false, 'square' => $sq || !$pp, 'paypal' => $pp, 'shipping' => false, 'preflight' => false], 'payments' => shop_public_payment_config()];
}
function shop_complete(array $i): bool { return !empty($i['designRequested']) || ($i['artworkAccepted'] ?? false) === true; }

/* ---------------- orders ---------------- */
function shop_order_ref(string $id): string { return 'SG-' . strtoupper(substr(str_replace('-', '', $id), 0, 8)); }
function shop_order(string $id): ?array { $q = shop_db()->prepare('SELECT * FROM shop_orders WHERE id = ?'); $q->execute([$id]); return $q->fetch() ?: null; }
function shop_public_order(array $o): array {
    $items = json_decode($o['items'], true) ?: [];
    $paid = shop_order_paid($o);
    foreach ($items as &$i) { $i['downloadReady'] = $paid && shop_item_downloadable($i); unset($i['templateId']); }
    unset($i);
    return ['id' => $o['id'], 'reference' => $o['number'], 'status' => in_array($o['status'], ['paid', 'in_production', 'ready', 'completed'], true) ? 'paid' : $o['status'],
        'provider' => $o['provider'], 'url' => $o['payment_url'] !== '' ? $o['payment_url'] : null, 'createdAt' => $o['created_at'],
        'paypalOrderId' => $o['provider'] === 'paypal' && $o['provider_order_id'] !== '' ? $o['provider_order_id'] : null, 'card' => ($o['card'] ?? '') !== '' ? $o['card'] : null,
        'snapshot' => ['items' => $items, 'address' => json_decode($o['address'], true), 'shipping' => json_decode($o['shipping'], true),
            'totals' => ['subtotal' => (int)$o['subtotal'], 'discount' => (int)($o['discount'] ?? 0), 'coupon' => ($o['coupon_code'] ?? '') ?: null, 'shipping' => (int)$o['shipping_total'], 'tax' => (int)$o['tax'], 'rate' => (int)$o['tax_rate'], 'total' => (int)$o['total'], 'currency' => 'CAD', 'taxReady' => true]]];
}
function shop_money(int $c): string { return '$' . number_format($c / 100, 2) . ' CAD'; }
function shop_order_text(array $o): string {
    $lines = [];
    foreach (json_decode($o['items'], true) ?: [] as $i) {
        $multi = !empty($i['values']['units']) && is_array($i['values']['units']); // several windows / walls: sizes are listed below (choices)
        $lines[] = '- ' . ($i['jobName'] ?: $i['name']) . ($multi ? ' · ' . (count($i['values']['units']) + 1) . ' units' : ' · qty ' . ($i['values']['quantity'] ?? 1) . (is_numeric($i['spec']['width'] ?? null) ? ' · ' . $i['spec']['width'] . ' × ' . $i['spec']['height'] . ' in' : '')) . ' · ' . shop_money((int)$i['price']['net']);
        foreach ($i['choices'] ?? [] as $c) if ($c['text'] !== '') $lines[] = '    ' . $c['label'] . ': ' . $c['text'];
        if (!empty($i['designRequested'])) $lines[] = '    Design service requested';
        if (!empty($i['fileIds'])) $lines[] = '    Artwork files: ' . count($i['fileIds']);
        if (!empty($i['digitalKey'])) { $lines[] = '    File: ' . ($i['digitalName'] ?? ''); $lines[] = '    Material: ' . ($i['material'] ?? 'Digital file'); }
    }
    $s = json_decode($o['shipping'], true) ?: [];
    $lines[] = '';
    $lines[] = 'Subtotal: ' . shop_money((int)$o['subtotal']);
    if ((int)($o['discount'] ?? 0) > 0) $lines[] = 'Discount (' . $o['coupon_code'] . '): -' . shop_money((int)$o['discount']);
    $lines[] = ($s['label'] ?? 'Shipping') . ': ' . shop_money((int)$o['shipping_total']) . (shop_is_pickup_order($o) ? ' (' . SHOP_PICKUP_ADDRESS . ')' : '');
    $lines[] = 'HST ' . $o['tax_rate'] . '%: ' . shop_money((int)$o['tax']);
    $lines[] = 'Total: ' . shop_money((int)$o['total']);
    return implode("\n", $lines);
}
function shop_address_text(array $o): string {
    $a = json_decode($o['address'], true) ?: [];
    if (shop_is_pickup_order($o) && trim((string)($a['street1'] ?? '')) === '') // pickup: contact details only
        return trim(implode("\n", array_filter([$a['name'] ?? '', $a['company'] ?? '', $a['phone'] ?? '', 'Pickup at Satin — ' . SHOP_PICKUP_ADDRESS])));
    return trim(implode("\n", array_filter([$a['name'] ?? '', $a['company'] ?? '', trim(($a['street1'] ?? '') . ' ' . ($a['street2'] ?? '')), trim(($a['city'] ?? '') . ', ' . ($a['state'] ?? '') . ' ' . ($a['zip'] ?? '')), $a['phone'] ?? ''])));
}
/** Signed, expiring download link for one digital item of a paid order. */
function shop_download_token(string $orderId, string $itemId, int $days = 14): string {
    $payload = $orderId . '.' . $itemId . '.' . (time() + $days * 86400);
    return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=') . '.' . substr(hash_hmac('sha256', $payload, shop_secret()), 0, 40);
}
function shop_download_links(array $o): array {
    $out = [];
    foreach (json_decode($o['items'], true) ?: [] as $i) if (shop_item_downloadable($i)) $out[] = ($i['digitalName'] ?: $i['name']) . ":\n" . site_url() . '/api/download?token=' . shop_download_token($o['id'], (string)$i['id']);
    return $out;
}
/* ---- shop wrap designs (/satin/shop/vehicle-wrap-designs/<slug>, price rules design-<slug>) sold as digital files ---- */
function shop_wrap_design_slug(string $ruleId): ?string { return preg_match('/^design-(?!services$)([a-z0-9-]{2,60})$/', $ruleId, $m) ? $m[1] : null; }
/** Download file of a wrap design: the file the owner attached in Admin → Products (private storage), else the standard
 *  package shipped with the site (satin-new/wrap-designs/<slug>.zip, outside the web root). Null when neither exists. */
function shop_wrap_design_file(string $ruleId): ?array {
    $slug = shop_wrap_design_slug($ruleId); if (!$slug) return null;
    $prod = shop_product_for_rule($ruleId) ?? [];
    $f = !empty($prod['_digitalFileId']) ? shop_file((string)$prod['_digitalFileId']) : null;
    if ($f && $f['kind'] === 'template' && is_file(shop_file_path($f))) return ['kind' => 'file', 'row' => $f, 'name' => $f['name']];
    $zip = __DIR__ . '/wrap-designs/' . $slug . '.zip';
    return is_file($zip) ? ['kind' => 'package', 'path' => $zip, 'name' => $slug . '-wrap-design.zip'] : null;
}
/** Digital-delivery fields for a wrap design cart item ("Digital artwork file" chosen), or null. */
function shop_wrap_design_item(array $rule, array $values): ?array {
    if (!shop_wrap_design_slug($rule['id']) || empty($values['purchase'])) return null;
    $f = shop_wrap_design_file($rule['id']);
    return ['digitalKey' => 'wrap-design', 'digitalName' => $f ? $f['name'] : shop_wrap_design_slug($rule['id']) . '-wrap-design.zip', 'digitalReady' => (bool)$f,
        'material' => 'Digital file · no print material', 'adjustRequested' => !empty($values['adjust']), 'artworkAccepted' => true];
}
/** True when a paid order item has a file the customer can download now. */
function shop_item_downloadable(array $i): bool {
    if (!empty($i['templateId'])) return true;
    return ($i['digitalKey'] ?? '') === 'wrap-design' && shop_wrap_design_file((string)($i['ruleId'] ?? '')) !== null;
}
function shop_order_paid(array $o): bool { return in_array($o['status'], ['paid', 'in_production', 'ready', 'completed'], true); }
function shop_notify_new(array $o, string $why): void {
    $admin = site_url() . '/admin/#/orders?id=' . $o['id'];
    try { require_once __DIR__ . '/push.php'; push_event('orders', (shop_order_paid($o) ? '💳 Order paid ' : '🛒 New online order ') . $o['number'], $o['name'] . ' · ' . shop_money((int)$o['total']), '/admin/#/orders?id=' . $o['id'], 'order-' . $o['number']); } catch (Throwable $e) { } // staff devices (Admin → Notifications)
    $digital = '';
    if (shop_order_paid($o)) foreach (json_decode($o['items'], true) ?: [] as $i) if (!empty($i['digitalKey']))
        $digital .= '- ' . ($i['digitalName'] ?? $i['name']) . (shop_item_downloadable($i) ? ' — download link emailed to the customer' : ' — NO FILE ATTACHED: upload it in Admin → Products and email the customer') . (!empty($i['adjustRequested']) ? ' · adjustment requested' : '') . "\n";
    notify_owner("Satin website: online order {$o['number']} — " . (SHOP_STATUSES[$o['status']] ?? $o['status']),
        "Online order {$o['number']} ($why)\n\nCustomer: {$o['name']} <{$o['email']}> {$o['phone']}\n" . shop_address_text($o) . "\n\n" . shop_order_text($o) . ($digital ? "\n\nDigital delivery:\n$digital" : '') . "\n\nOpen in admin: $admin");
}
function shop_mail_customer_received(array $o): void {
    $pay = $o['payment_url'] !== '' ? "Pay securely here: {$o['payment_url']}\n\n" : "We will review your order and artwork and email you a secure payment link shortly. No payment has been taken yet.\n\n";
    send_mail($o['email'], "Your Satin Graphic order {$o['number']}", "Hello {$o['name']},\n\nThank you for your order {$o['number']}.\n\n" . shop_order_text($o) . "\n\n$pay" .
        "Our team checks every file before printing and will contact you if anything needs attention.\n\nQuestions? Reply to info@satingraphic.ca or call 905-695-9147.\n\nSatin Graphic\n50 Viceroy Rd, Unit 22–23, Vaughan, ON");
}
function shop_mail_customer_paid(array $o): void {
    $links = shop_download_links($o);
    $dl = $links ? "Your download" . (count($links) > 1 ? 's' : '') . " (secure links, valid for 14 days — you can also download from My account → Orders):\n\n" . implode("\n\n", $links) . "\n\n" : '';
    $onlyDigital = true;
    foreach (json_decode($o['items'], true) ?: [] as $i) if (empty($i['digitalKey']) && empty($i['templateId'])) $onlyDigital = false;
    foreach (json_decode($o['items'], true) ?: [] as $i) if (($i['digitalKey'] ?? '') === 'wrap-design') {
        $dl .= ($i['name'] ?? 'Wrap design') . ":\n    File: " . ($i['digitalName'] ?? '') . "\n    Material: " . ($i['material'] ?? 'Digital file') . "\n"
            . "    Opens in Adobe Illustrator, CorelDRAW, Affinity Designer, Inkscape (free), FlexiSIGN / SAi and Adobe Acrobat (PDF).\n"
            . (!shop_item_downloadable($i) ? "    Your file is being prepared — we will email the download link within 1 business day.\n" : '')
            . (!empty($i['adjustRequested']) ? "    Adjustment for your vehicle: our designer will contact you for your vehicle details, logo and colours. Adjusted files are delivered in 2–3 business days after we receive them.\n" : '') . "\n";
    }
    $via = shop_pay_method_label($o);
    send_mail($o['email'], "Payment received — Satin Graphic order {$o['number']}", "Hello {$o['name']},\n\nWe received your payment for order {$o['number']}" . ($via !== '' ? " ($via)" : '') . ".\n\n" . shop_order_text($o) . "\n\n$dl" .
        ($onlyDigital ? "Thank you for your purchase. Keep this email: the links above are your download access.\n\n" : "We will check your artwork before production and keep you updated.\n\n") . "Satin Graphic · info@satingraphic.ca · 905-695-9147");
}
/** Marks an order paid once (webhook, return check or admin) and sends the emails. */
function shop_mark_paid(array $o, string $paymentId, string $how): bool {
    $pdo = shop_db();
    $q = $pdo->prepare("UPDATE shop_orders SET status = 'paid', payment_id = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status = 'awaiting_payment'");
    $q->execute([mb_substr($paymentId, 0, 120), now_iso(), now_iso(), $o['id']]);
    if (!$q->rowCount()) {
        // Paid on an old payment link after the customer cancelled the order online (My account): never lose that payment — tell the owner once.
        $cur = shop_order($o['id']); $tag = '[paid-after-cancel:' . mb_substr($paymentId, 0, 120) . ']';
        if ($cur && $cur['status'] === 'cancelled' && $paymentId !== '' && !str_contains((string)$cur['admin_notes'], $tag)) {
            shop_db()->prepare('UPDATE shop_orders SET admin_notes = ?, updated_at = ? WHERE id = ?')->execute([trim($cur['admin_notes'] . "\n$tag Payment received ($how) for this cancelled order — refund it or restore the order."), now_iso(), $cur['id']]);
            notify_owner("Satin website: payment received for CANCELLED order {$cur['number']}", "A payment ($how, id $paymentId) arrived for order {$cur['number']}, which is cancelled. Refund the customer or set the order back to paid in Admin → Orders.\n\n" . site_url() . '/admin/#/orders?id=' . $cur['id']);
        }
        return false;
    }
    $o = shop_order($o['id']);
    shop_coupon_record($o);
    [$draft, $rev, $exists] = shop_draft($o['session_id']);
    if ($exists && $rev === (int)$o['draft_revision']) { $draft['submitted'] = ['reference' => $o['number'], 'orderId' => $o['id'], 'status' => 'paid', 'at' => now_iso()]; shop_draft_save($o['session_id'], $draft, $rev, true); }
    shop_notify_new($o, 'paid · ' . $how);
    shop_mail_customer_paid($o);
    return true;
}
/** Creates (or returns) the Square payment link for an order. Adjusts the stored tax by ≤5¢ if Square rounds differently. */
function shop_square_link(array $o, string $returnUrl, string $idem): array {
    $c = shop_square();
    if (!shop_square_ready($c)) throw new ShopError('Square is not connected.');
    $items = json_decode($o['items'], true) ?: [];
    $money = fn(int $n) => ['amount' => $n, 'currency' => 'CAD'];
    $lines = [];
    foreach ($items as $i) $lines[] = ['name' => mb_substr((string)($i['jobName'] ?: $i['name']), 0, 255), 'quantity' => '1', 'note' => mb_substr('Qty ' . ($i['values']['quantity'] ?? 1) . (is_numeric($i['spec']['width'] ?? null) ? ' · ' . $i['spec']['width'] . ' x ' . $i['spec']['height'] . ' in' : ''), 0, 500), 'base_price_money' => $money((int)$i['price']['net'])];
    $ship = json_decode($o['shipping'], true) ?: [];
    if ((int)$o['shipping_total'] > 0) $lines[] = ['name' => mb_substr((string)($ship['label'] ?? 'Delivery'), 0, 255), 'quantity' => '1', 'base_price_money' => $money((int)$o['shipping_total'])];
    $body = ['idempotency_key' => mb_substr($idem, 0, 45), 'order' => ['location_id' => $c['locationId'], 'reference_id' => $o['id'], 'line_items' => $lines,
        'taxes' => [['uid' => 'hst', 'name' => 'HST', 'percentage' => (string)$o['tax_rate'], 'scope' => 'ORDER']]]
        + ((int)($o['discount'] ?? 0) > 0 ? ['discounts' => [['uid' => 'coupon', 'name' => 'Code ' . $o['coupon_code'], 'amount_money' => ['amount' => (int)$o['discount'], 'currency' => 'CAD'], 'scope' => 'ORDER']]] : []),
        'checkout_options' => ['redirect_url' => $returnUrl, 'allow_tipping' => false, 'enable_coupon' => false, 'ask_for_shipping_address' => false],
        'pre_populated_data' => ['buyer_email' => $o['email']], 'payment_note' => 'Satin order ' . $o['number']];
    $d = shop_square_call($c, 'POST', '/v2/online-checkout/payment-links', $body);
    $url = (string)($d['payment_link']['url'] ?? ''); $sqOrder = (string)($d['payment_link']['order_id'] ?? '');
    $host = strtolower((string)parse_url($url, PHP_URL_HOST));
    if (!$sqOrder || parse_url($url, PHP_URL_SCHEME) !== 'https' || !in_array($host, ['square.link', 'sandbox.square.link', 'checkout.square.site', 'sandbox.checkout.square.site'], true)) throw new ShopError('Square did not return a payment link.');
    $tm = $d['related_resources']['orders'][0]['total_money'] ?? null;
    $total = (int)$o['total']; $tax = (int)$o['tax'];
    if ($tm) {
        if (($tm['currency'] ?? '') !== 'CAD') throw new ShopError('Square returned a different currency.');
        $diff = (int)$tm['amount'] - $total;
        if (abs($diff) > 5) throw new ShopError('Square calculated a different total.');
        $total += $diff; $tax += $diff;
    }
    shop_db()->prepare("UPDATE shop_orders SET provider = 'square', card = '', provider_order_id = ?, payment_url = ?, total = ?, tax = ?, deposit = ?, updated_at = ? WHERE id = ?")
        ->execute([$sqOrder, $url, $total, $tax, $total, now_iso(), $o['id']]);
    return shop_order($o['id']);
}
/** Asks Square whether the order has been paid (used when the customer returns from Square). */
function shop_square_verify(array $o): bool {
    $c = shop_square();
    if (!shop_square_ready($c) || $o['provider'] !== 'square' || $o['provider_order_id'] === '' || $o['status'] !== 'awaiting_payment') return false;
    if (rate_limited('sqverify:' . $o['id'], 3, 20)) return false;
    note_attempt('sqverify:' . $o['id']);
    try {
        $sq = shop_square_call($c, 'GET', '/v2/orders/' . rawurlencode($o['provider_order_id']))['order'] ?? null;
        if (!$sq || ($sq['location_id'] ?? '') !== $c['locationId'] || ($sq['reference_id'] ?? '') !== $o['id'] || ($sq['total_money']['currency'] ?? '') !== 'CAD' || (int)($sq['total_money']['amount'] ?? -1) !== (int)$o['total']) return false;
        $paid = 0; $pid = '';
        foreach ($sq['tenders'] ?? [] as $t) {
            if (empty($t['payment_id'])) continue;
            $p = shop_square_call($c, 'GET', '/v2/payments/' . rawurlencode($t['payment_id']))['payment'] ?? null;
            if ($p && ($p['status'] ?? '') === 'COMPLETED' && ($p['order_id'] ?? '') === $sq['id'] && ($p['amount_money']['currency'] ?? '') === 'CAD') { $paid += (int)$p['amount_money']['amount'] - (int)($p['refunded_money']['amount'] ?? 0); $pid = (string)$p['id']; }
        }
        return $paid === (int)$o['total'] && shop_mark_paid($o, $pid, 'Square (confirmed on return)');
    } catch (Throwable $e) { error_log('satin square verify: ' . $e->getMessage()); return false; }
}

/* ---------------- templates (public) ---------------- */
function shop_public_templates(): array {
    $rows = shop_db()->query('SELECT * FROM shop_templates WHERE published = 1 AND deleted = 0 ORDER BY make, model, year')->fetchAll();
    $out = [];
    foreach ($rows as $t) {
        if ($t['file_id'] === '') continue;
        $f = shop_file($t['file_id']);
        $base = ['id' => $t['id'], 'ruleId' => $t['rule_id'], 'name' => $t['name'], 'category' => $t['category'], 'make' => $t['make'], 'model' => $t['model'], 'yearText' => $t['year'],
            'trim' => $t['trim_text'], 'body' => $t['body'], 'description' => $t['description'], 'price' => ((int)$t['price']) / 100, 'priceCents' => (int)$t['price'],
            'fileName' => $f ? $f['name'] : '', 'hasPreview' => $t['preview_id'] !== '', 'preview' => $t['preview_id'] !== '' ? '/api/template-preview?id=' . $t['id'] : null, 'available' => true, 'path' => '/satin/shop/products/' . $t['rule_id']];
        $years = [];
        if (preg_match('/^\s*(\d{4})\s*(?:[-–]\s*(\d{4}))?\s*$/u', $t['year'], $m)) { $a = (int)$m[1]; $b = isset($m[2]) ? (int)$m[2] : $a; if ($b >= $a && $b - $a <= 40) $years = range($a, $b); }
        if (!$years) { $out[] = $base + ['year' => null]; continue; }
        foreach ($years as $y) $out[] = $base + ['year' => $y]; // the catalog matches one model year at a time
    }
    return $out;
}

/* ---------------- public routes ---------------- */
function shop_input(int $limit = 70000): array { return body_json($limit); }
function shop_clean($v, int $n = 200): string { return is_string($v) ? mb_substr(trim($v), 0, $n) : ''; }

function shop_route(string $path, string $method): void {
    try { shop_route_inner($path, $method); }
    catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
    catch (FormulaError $e) { json_out(['error' => $e->getMessage()], 400); }
}

function shop_route_inner(string $path, string $method): void {
    $pdo = shop_db();
    header('Cache-Control: private, no-store');

    // ---- price rules for template products (the rest of /api/rules is handled by api.php) ----
    if ($path === '/api/rules' && $method === 'GET') {
        $id = (string)($_GET['id'] ?? '');
        if (str_starts_with($id, 'template-')) json_out(['rule' => shop_template_rule($id)]);
        if (preg_match('#^/satin(?:/(?:fa|fr|es))?/shop/products/(template-[a-f0-9]{8})/?$#', (string)($_GET['path'] ?? ''), $m)) {
            $t = shop_template_by_rule($m[1]);
            if (!$t || $t['file_id'] === '') json_out(['rule' => null]);
            json_out(['rule' => shop_template_rule_from_row($t), 'configured' => shop_template_product($t), 'unavailablePaths' => []]);
        }
        return;
    }

    if ($path === '/api/templates' && $method === 'GET') { header('Cache-Control: public, max-age=60'); json_out(['templates' => shop_public_templates()]); }
    if ($path === '/api/template-preview' && $method === 'GET') {
        $q = $pdo->prepare('SELECT preview_id FROM shop_templates WHERE id = ? AND published = 1 AND deleted = 0'); $q->execute([(string)($_GET['id'] ?? '')]);
        $t = $q->fetch(); $f = $t ? shop_file($t['preview_id']) : null;
        if (!$f) json_out(['error' => 'Preview not found'], 404);
        shop_send_file($f, true, 'public, max-age=86400');
    }

    // ---- signed download link from the paid-order email ----
    if ($path === '/api/download' && $method === 'GET') {
        $tok = (string)($_GET['token'] ?? '');
        $parts = explode('.', $tok);
        $payload = count($parts) === 2 ? (string)base64_decode(strtr($parts[0], '-_', '+/'), true) : '';
        if (!$payload || !preg_match('/^([a-f0-9-]{36})\.([a-f0-9-]{36})\.(\d{10})$/', $payload, $m) || !hash_equals(substr(hash_hmac('sha256', $payload, shop_secret()), 0, 40), $parts[1]))
            shop_download_error('This download link is not valid.');
        if ((int)$m[3] < time()) shop_download_error('This download link has expired. Reply to your order email and we will send a new one.');
        shop_send_digital($m[1], $m[2], null);
    }
    if ($path === '/api/digital/download' && $method === 'GET') {
        $s = shop_session_required();
        shop_send_digital((string)($_GET['order'] ?? ''), (string)($_GET['item'] ?? ''), $s['id']);
    }

    // ---- public payment config (product pages: Afterpay / PayPal Pay Later messaging). Public ids only, no secrets. ----
    if ($path === '/api/payments/config' && $method === 'GET') {
        header('Cache-Control: public, max-age=300');
        $cfg = shop_public_payment_config();
        json_out(['square' => $cfg['square'] && $cfg['square']['afterpay'] ? $cfg['square'] : null, 'paypal' => $cfg['paypal'] && $cfg['paypal']['payLater'] ? $cfg['paypal'] : null]);
    }
    // ---- Square webhook ----
    if ($path === '/api/payments/webhook/square') {
        if ($method !== 'POST') json_out(['error' => 'Use POST'], 405);
        shop_square_webhook();
    }
    if ($path === '/api/payments/webhook/paypal') {
        if ($method !== 'POST') json_out(['error' => 'Use POST'], 405);
        shop_paypal_webhook();
    }

    // ---- artwork session ----
    if ($path === '/api/studio/session') {
        $s = shop_session();
        if ($s) json_out(['id' => $s['id'], 'clientArtwork' => true]);
        if ($method === 'GET') json_out(['id' => null, 'clientArtwork' => true]);
        if ($method !== 'POST') json_out(['error' => 'Method not allowed'], 405);
        same_origin();
        shop_limit('shopsession:' . shop_ip(), 25, 86400, 'Too many artwork sessions from this network today. Please contact us.');
        $id = shop_hex_id(); $tok = bin2hex(random_bytes(32)); $exp = time() + 30 * 86400;
        $pdo->prepare('INSERT INTO shop_sessions (id,token_hash,ip,created_at,expires_at) VALUES (?,?,?,?,?)')->execute([$id, hash('sha256', $tok), shop_ip(), now_iso(), $exp]);
        setcookie(SHOP_COOKIE, "$id.$tok", ['expires' => $exp, 'path' => '/', 'secure' => shop_secure(), 'httponly' => true, 'samesite' => 'Lax']);
        json_out(['id' => $id, 'clientArtwork' => true], 201);
    }

    if ($path === '/api/studio/file' && $method === 'GET') {
        $f = shop_file((string)($_GET['id'] ?? ''));
        $s = shop_session();
        $ok = $f && in_array($f['kind'], ['upload', 'generated'], true) && $s && hash_equals($f['session_id'], $s['id']);
        if (!$ok && $f) { $u = current_user(); $ok = $u && (in_array('orders.view', $u['permissions'], true) || in_array('requests.view', $u['permissions'], true)); }
        if (!$ok) json_out(['error' => 'File not found.'], 404);
        shop_send_file($f, ($_GET['inline'] ?? '') === '1');
    }

    if (str_starts_with($path, '/api/studio/')) {
        if (!in_array($method, ['GET', 'POST'], true)) json_out(['error' => 'Method not allowed'], 405);
        if ($method === 'POST') same_origin();
        $s = shop_session_required();
        $r = substr($path, strlen('/api/studio'));
        if ($r === '/upload' && $method === 'POST') {
            if (empty($_FILES['file'])) {
                $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
                throw new ShopError($len > 0 ? 'This file is larger than the server accepts. Email large files to info@satingraphic.ca.' : 'Choose a file to upload.');
            }
            shop_limit('shopupload:' . shop_ip(), 80, 3600, 'Too many uploads. Please wait and try again.');
            $q = $pdo->prepare("SELECT COUNT(*) n, COALESCE(SUM(size),0) b FROM shop_files WHERE session_id = ? AND kind = 'upload'"); $q->execute([$s['id']]); $u = $q->fetch();
            if ((int)$u['n'] >= SHOP_SESSION_FILES || (int)$u['b'] + (int)($_FILES['file']['size'] ?? 0) > SHOP_SESSION_BYTES) throw new ShopError('This session has reached its upload limit (30 files / 60 MB). Email more files to info@satingraphic.ca.');
            $product = shop_clean($_POST['product'] ?? '', 120);
            $allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'image/svg+xml'];
            if (str_starts_with($product, 'apparel-') || $product === 'dtf-transfers') $allowed = ['image/png', 'image/svg+xml', 'image/jpeg', 'application/pdf'];
            if ($product === 'wrap-prints') $allowed = ['image/svg+xml', 'application/pdf'];
            if ($product === 'wallpaper-custom') $allowed = ['image/png', 'image/jpeg', 'image/webp'];
            $row = shop_store_upload($_FILES['file'], 'upload', $s['id'], SHOP_UPLOAD_MAX, $allowed);
            json_out(['file' => ['id' => $row['id'], 'name' => $row['name'], 'mime' => $row['mime'], 'size' => $row['size'], 'width' => $row['width'], 'height' => $row['height'], 'role' => 'upload']], 201);
        }
        if ($r === '/designs' && $method === 'GET') {
            $q = $pdo->prepare('SELECT id, design, updated_at FROM shop_designs WHERE session_id = ? ORDER BY updated_at DESC LIMIT 20'); $q->execute([$s['id']]);
            $a = $pdo->prepare("SELECT id, name, mime, size FROM shop_files WHERE session_id = ? AND kind = 'upload' ORDER BY created_at"); $a->execute([$s['id']]);
            json_out(['designs' => array_map(fn($d) => ['id' => $d['id'], 'design' => json_decode($d['design'], true), 'updated_at' => $d['updated_at']], $q->fetchAll()), 'assets' => $a->fetchAll()]);
        }
        if ($r === '/design' && $method === 'POST') {
            $v = shop_input(250000);
            if (!shop_is_uuid($v['id'] ?? null) || !is_array($v['design'] ?? null)) throw new ShopError('Invalid design.');
            foreach ((array)($v['design']['assets'] ?? []) as $fid) if (is_string($fid)) shop_owned_file($fid, $s['id']);
            $q = $pdo->prepare('SELECT session_id, design FROM shop_designs WHERE id = ?'); $q->execute([$v['id']]); $ex = $q->fetch();
            if ($ex && !hash_equals($ex['session_id'], $s['id'])) json_out(['error' => 'Design not found.'], 404);
            $json = json_encode(shop_design_merge($v['design'], $ex ? (json_decode($ex['design'], true) ?: []) : []), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($ex) $pdo->prepare('UPDATE shop_designs SET design = ?, updated_at = ? WHERE id = ?')->execute([$json, now_iso(), $v['id']]);
            else {
                // Drafts are auto-saved per browser session. At the cap, the oldest drafts that are not in the cart (or an order)
                // are recycled instead of blocking the customer's new design.
                $cap = 40;
                $c = $pdo->prepare('SELECT COUNT(*) n FROM shop_designs WHERE session_id = ?'); $c->execute([$s['id']]); $n = (int)$c->fetch()['n'];
                if ($n >= $cap) {
                    $old = $pdo->prepare('SELECT id FROM shop_designs WHERE session_id = ? AND id NOT IN (SELECT design_id FROM shop_cart_items WHERE session_id = ?) ORDER BY updated_at ASC LIMIT ' . (int)($n - $cap + 1));
                    $old->execute([$s['id'], $s['id']]); $del = $pdo->prepare('DELETE FROM shop_designs WHERE id = ? AND session_id = ?');
                    foreach ($old->fetchAll() as $row) $del->execute([$row['id'], $s['id']]);
                    $c->execute([$s['id']]);
                    if ((int)$c->fetch()['n'] >= $cap) throw new ShopError('Your cart holds ' . $cap . ' designs. Check out or remove some items, then try again.');
                }
                $pdo->prepare('INSERT INTO shop_designs (id,session_id,design,updated_at) VALUES (?,?,?,?)')->execute([$v['id'], $s['id'], $json, now_iso()]);
            }
            json_out(['saved' => true, 'id' => $v['id']]);
        }
        // Vehicle designs: "Submit design" sends the approved design to the team for review (signed-in customers only); it shows in My account → Saved designs
        if ($r === '/submit-review' && $method === 'POST') {
            require_once __DIR__ . '/customer.php';
            $cu = cust_current();
            if (!$cu) json_out(['error' => 'Sign in to submit your design.', 'login' => true], 401);
            $v = shop_input(4000); $did = (string)($v['designId'] ?? '');
            if (!shop_is_uuid($did)) throw new ShopError('Save the design first.');
            $q = $pdo->prepare('SELECT * FROM shop_designs WHERE id = ? AND session_id = ?'); $q->execute([$did, $s['id']]); $row = $q->fetch();
            if (!$row) json_out(['error' => 'Design not found.'], 404);
            $d = json_decode((string)$row['design'], true) ?: [];
            if (empty($d['approvedAt'])) json_out(['error' => 'Approve the design first.'], 409);
            if (empty($d['review']['ref'])) {
                $ref = 'SG-' . strtoupper(substr(str_replace('-', '', $did), 0, 8));
                $d['review'] = ['status' => 'submitted', 'submittedAt' => now_iso(), 'ref' => $ref];
                $pdo->prepare('UPDATE shop_designs SET design = ?, customer_id = ?, updated_at = ? WHERE id = ?')->execute([json_encode($d, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $cu['id'], now_iso(), $did]);
                $rule = shop_studio_rule((string)($d['productId'] ?? ''));
                $label = (string)($rule['label'] ?? ($d['productId'] ?? 'Vehicle design'));
                $veh = trim((string)($d['options']['vehicleModel'] ?? '') . ' ' . (string)($d['options']['vehicleBody'] ?? ''));
                $details = json_encode(['notes' => "Vehicle design submitted from Design Studio for review.\nDesign ID: $did" . (!empty($d['options']['vehicleGlass']) ? "\nWindows: design on the windows too (perforated window film)." : '') . "\nOpen it in Admin → Orders / Design Studio files, or ask the customer to share it from My account.", 'vehicle' => $veh, 'designId' => $did, 'source' => 'design-studio'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                $rid = sprintf('%08x-%04x-4%03x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff), random_int(0, 0xfff), random_int(0x8000, 0xbfff), random_int(0, 0xffffffffffff));
                try { if (function_exists('save_request')) save_request($rid, 'quote', 'Design Studio: ' . $label, (string)($cu['name'] ?: $cu['email']), (string)$cu['email'], (string)($cu['phone'] ?? ''), '', '', (string)$details); else notify_owner('Satin website: vehicle design submitted ' . $ref, ($cu['name'] ?: $cu['email']) . " submitted a vehicle design ($label).\nDesign ID: $did"); } catch (Throwable $e) { error_log('satin design review: ' . $e->getMessage()); }
            }
            json_out(['ok' => true, 'ref' => $d['review']['ref'], 'status' => $d['review']['status']]);
        }
        shop_studio_orders($r, $method, $s);
        json_out(['error' => 'Not found.'], 404);
    }

    // ---- artwork check ----
    if ($path === '/api/artwork/check') {
        if ($method !== 'POST') json_out(['error' => 'Method not allowed'], 405);
        same_origin();
        $s = shop_session_required();
        $v = shop_input(20000);
        $rule = shop_rule((string)($v['ruleId'] ?? ''));
        if (!$rule) throw new ShopError('Product unavailable.');
        $values = shop_field_values($rule, answers($rule, is_array($v['values'] ?? null) ? $v['values'] : []));
        if (!is_array($v['fileIds'] ?? null) || count($v['fileIds']) > 30) throw new ShopError('Choose up to 30 files.');
        $out = [];
        foreach ($v['fileIds'] as $id) { $f = shop_owned_file((string)$id, $s['id']); $out[] = shop_check_file($f, $rule, $values); }
        json_out(['reports' => $out]);
    }

    if (str_starts_with($path, '/api/checkout/')) shop_checkout_route($path, $method);
}

function shop_download_error(string $msg): void {
    http_response_code(410); header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Download · Satin Graphic</title><body style="font:16px system-ui;padding:40px;max-width:560px;margin:auto"><h1>Download unavailable</h1><p>' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</p><p><a href="/satin/">Satin Graphic</a> · info@satingraphic.ca</p>';
    exit;
}
function shop_send_digital(string $orderId, string $itemId, ?string $sessionId): void {
    $o = shop_is_uuid($orderId) ? shop_order($orderId) : null;
    if (!$o || ($sessionId !== null && !hash_equals($o['session_id'], $sessionId))) shop_download_error('Order not found.');
    if (!shop_order_paid($o)) shop_download_error('This order is not paid yet.');
    foreach (json_decode($o['items'], true) ?: [] as $i) {
        if ((string)$i['id'] === $itemId && ($i['digitalKey'] ?? '') === 'wrap-design') {
            $f = shop_wrap_design_file((string)$i['ruleId']);
            if (!$f) shop_download_error('Your file is being prepared. We will email the download link within 1 business day.');
            if ($f['kind'] === 'file') shop_send_file($f['row'], false);
            header('Content-Type: application/zip'); header('Content-Length: ' . filesize($f['path']));
            header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $f['name']) . '"');
            header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff'); header('X-Robots-Tag: noindex, nofollow');
            readfile($f['path']); exit;
        }
        if ((string)$i['id'] !== $itemId || empty($i['templateId'])) continue;
        $q = shop_db()->prepare('SELECT file_id FROM shop_templates WHERE id = ?'); $q->execute([$i['templateId']]); $t = $q->fetch();
        $f = $t ? shop_file($t['file_id']) : null;
        if (!$f) shop_download_error('This file is no longer available. Contact us and we will send it.');
        shop_send_file($f, false);
    }
    shop_download_error('Download not found.');
}

function shop_square_webhook(): void {
    $raw = (string)file_get_contents('php://input', false, null, 0, 200001);
    if (strlen($raw) > 200000) json_out(['error' => 'Event too large'], 413);
    $c = shop_square();
    if ($c['webhookKey'] === '') json_out(['error' => 'Webhook not connected'], 503);
    $sig = (string)($_SERVER['HTTP_X_SQUARE_HMACSHA256_SIGNATURE'] ?? '');
    $expected = base64_encode(hash_hmac('sha256', shop_webhook_url($c) . $raw, $c['webhookKey'], true));
    if ($sig === '' || !hash_equals($expected, $sig)) json_out(['error' => 'Invalid signature'], 401);
    $e = json_decode($raw, true);
    if (!is_array($e)) json_out(['error' => 'Invalid event'], 400);
    require_once __DIR__ . '/invoices_api.php'; // invoice payments / refunds (reference_id = invoice id)
    try { inv_square_event($e, $c); } catch (Throwable $ex) { error_log('satin invoice square webhook: ' . $ex->getMessage()); }
    $p = $e['data']['object']['payment'] ?? null;
    if (is_array($p) && ($p['status'] ?? '') === 'COMPLETED' && !empty($p['order_id'])) {
        $q = shop_db()->prepare("SELECT * FROM shop_orders WHERE (provider = 'square' AND provider_order_id = ?) OR admin_notes LIKE ?"); $q->execute([(string)$p['order_id'], '%[sq:' . $p['order_id'] . ']%']);
        foreach ($q->fetchAll() as $o) {
            $amount = (int)($p['amount_money']['amount'] ?? -1) - (int)($p['refunded_money']['amount'] ?? 0);
            if (($p['location_id'] ?? '') !== $c['locationId'] || ($p['amount_money']['currency'] ?? '') !== 'CAD' || $amount !== (int)$o['total']) {
                error_log('satin square webhook: payment does not match order ' . $o['number']);
                continue;
            }
            $how = shop_square_method_label($p);
            if ($how === 'Afterpay' && ($o['card'] ?? '') === '') { shop_db()->prepare('UPDATE shop_orders SET card = ? WHERE id = ?')->execute(['Afterpay', $o['id']]); $o = shop_order($o['id']); }
            shop_mark_paid($o, (string)($p['id'] ?? ''), $how === 'Afterpay' ? 'Square webhook · Afterpay' : 'Square webhook');
        }
    }
    json_out(['received' => true]);
}

/* ---------------- checkout ---------------- */
function shop_checkout_route(string $path, string $method): void {
    if (!in_array($method, ['GET', 'POST'], true)) json_out(['error' => 'Method not allowed'], 405);
    if ($method === 'POST') same_origin();
    $s = shop_session_required();
    $sid = $s['id'];
    $pdo = shop_db();
    [$draft, $revision, $exists] = shop_draft($sid);

    if ($path === '/api/checkout/draft' && $method === 'GET') json_out(shop_status($draft, $revision));

    if ($path === '/api/checkout/order' && $method === 'GET') {
        $o = shop_is_uuid($_GET['id'] ?? null) ? shop_order((string)$_GET['id']) : null;
        if (!$o || !hash_equals($o['session_id'], $sid)) json_out(['error' => 'Order not found'], 404);
        if ($o['status'] === 'awaiting_payment' && $o['provider'] === 'paypal' && $o['provider_order_id'] !== '') { shop_paypal_verify($o, false); $o = shop_order($o['id']); }
        // Returning from Square: the webhook usually lands within seconds, so wait up to ~8 s (and ask Square directly twice).
        if ($o['status'] === 'awaiting_payment' && $o['provider'] === 'square' && $o['provider_order_id'] !== '') {
            for ($i = 0; $i < 8; $i++) {
                if ($i % 4 === 0) shop_square_verify($o);
                $o = shop_order($o['id']);
                if ($o['status'] !== 'awaiting_payment') break;
                sleep(1);
            }
        }
        json_out(['order' => shop_public_order($o)]);
    }
    if ($path === '/api/checkout/capture') {
        if ($method !== 'POST') json_out(['error' => 'Use POST'], 405);
        $v = shop_input(2000);
        $o = shop_is_uuid($v['id'] ?? null) ? shop_order((string)$v['id']) : null;
        if (!$o || !hash_equals($o['session_id'], $sid)) json_out(['error' => 'Order not found'], 404);
        if ($o['status'] === 'awaiting_payment' && $o['provider'] === 'paypal') { shop_limit('ppcapture:' . $o['id'], 10, 600); shop_paypal_verify($o, true); $o = shop_order($o['id']); }
        json_out(['order' => shop_public_order($o)]);
    }

    if ($path === '/api/checkout/template' && $method === 'GET') {
        $item = null; foreach ($draft['items'] as $i) if ($i['id'] === ($_GET['item'] ?? '')) $item = $i;
        if (!$item) json_out(['error' => 'Item not found.'], 404);
        $p = shop_product_for_rule($item['ruleId']) ?? [];
        $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
        $list = '';
        foreach ((array)($p['templates'] ?? []) as $t) if (is_array($t) && preg_match('#^/(?!/)[^\s"\'<>]*$#', (string)($t['url'] ?? ''))) $list .= '<li><a href="' . $e($t['url']) . '">' . $e($t['label'] ?? 'Template') . '</a></li>';
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDF templates · Satin</title><style>body{font:16px system-ui;background:#f3f5f8;color:#172438;margin:0;padding:32px}main{max-width:650px;margin:auto;background:white;border-radius:16px;padding:32px}li{margin:16px 0}a{color:#b00040}</style><main><h1>' . $e($item['name']) . ' PDF templates</h1><p>Your ordered trim size: ' . $e($item['spec']['width']) . ' × ' . $e($item['spec']['height']) . ' in.</p>' . ($list ? "<ul>$list</ul>" : '<p>No PDF template is currently available for this product.</p>') . '<p><a href="/satin/checkout/">Return to checkout</a></p></main></html>';
        exit;
    }

    if ($method !== 'POST') json_out(['error' => 'Not found'], 404);
    $v = shop_input(70000);

    if ($path === '/api/checkout/payment') shop_checkout_payment($s, $v, $draft, $revision, $exists);
    if ($path === '/api/checkout/pay-card') { $v['provider'] = 'square'; shop_checkout_payment($s, $v, $draft, $revision, $exists, true); }

    // "Start another order" resets the checkout, so it never needs the browser's revision: paying bumps the
    // revision on the server (submitted → paid) after the page last read it, and a stale check here used to fail.
    if ($path !== '/api/checkout/new' && ($v['revision'] ?? null) !== $revision) json_out(['error' => 'Checkout changed. Reload before saving.'], 409);
    if (!empty($draft['submitted']) && $path !== '/api/checkout/new') json_out(['error' => 'This order was already placed. Start a new checkout.'], 409);
    $changed = true;

    if ($path === '/api/checkout/new') {
        $draft = shop_empty_draft();
    } elseif ($path === '/api/checkout/import') {
        if (!is_array($v['items'] ?? null) || count($v['items']) > 30) throw new ShopError('Import up to 30 items.');
        $before = count($draft['items']);
        foreach ($v['items'] as $a) {
            if (!is_array($a) || !is_array($a['pricing'] ?? null)) continue;
            $ruleId = (string)($a['pricing']['ruleId'] ?? '');
            $prod = shop_product_for_rule($ruleId);
            if (!$prod || !preg_match('#/print-shop/|/wallpaper|/window-graphics|/apparel|/shop/#', (string)$prod['path'])) continue;
            if (isset($prod['stock']) && $prod['stock'] !== null) continue; // stocked items need inventory confirmation
            $rawKey = $a['id'] ?? null; // the cart's ids are JS numbers: keep the same text as String(id) in the browser
            $key = mb_substr(is_string($rawKey) ? $rawKey : (is_int($rawKey) || is_float($rawKey) ? (string)json_encode($rawKey) : ''), 0, 80);
            if ($key === '') continue;
            foreach ($draft['items'] as $x) if ($x['sourceKey'] === $key) continue 2;
            if (count($draft['items']) >= 30) throw new ShopError('Checkout contains the maximum 30 items.');
            $rule = shop_rule($ruleId);
            if (!$rule) continue;
            try { $values = shop_item_values($rule, is_array($a['pricing']['values'] ?? null) ? $a['pricing']['values'] : []); $price = calculate($rule, $values); }
            catch (FormulaError $e) { continue; }
            $design = !empty($values['design']) || $rule['id'] === 'design-services';
            $fee = !empty($values['design']) ? (int)round(((float)($rule['constants']['designFee'] ?? 100)) * 100) : 0;
            if ($price['net'] <= 0 || (!empty($rule['priceOnRequest']) && $price['net'] <= $fee)) continue;
            $fileIds = [];
            $raw = is_array($a['artwork'] ?? null) ? (is_array($a['artwork']['fileIds'] ?? null) ? $a['artwork']['fileIds'] : (isset($a['artwork']['fileId']) ? [$a['artwork']['fileId']] : [])) : [];
            foreach (array_slice(array_unique(array_filter($raw, 'is_string')), 0, 30) as $fid) { try { shop_owned_file($fid, $sid); $fileIds[] = $fid; } catch (ShopError $e) { } }
            $designFiles = [];
            if (!$fileIds && is_string($a['artwork']['designId'] ?? null)) {
                $dz = shop_owned_design($a['artwork']['designId'], $sid);
                if (!$dz || empty($dz['approvedAt'])) throw new ShopError('Approve your design in Design Studio before checkout.');
                foreach ($dz['generated'] ?? [] as $g) { shop_owned_file((string)$g['id'], $sid); $designFiles[] = (string)$g['id']; if (($g['role'] ?? '') === 'artwork') $fileIds[] = (string)$g['id']; }
            }
            $lines = [];
            foreach (array_slice(is_array($a['lines'] ?? null) ? $a['lines'] : [], 0, 30) as $l) if (is_string($l)) $lines[] = mb_substr($l, 0, 1000);
            $item = ['id' => uuid(), 'sourceKey' => $key, 'productId' => (string)$prod['id'], 'name' => (string)$prod['name'], 'path' => (string)$prod['path'], 'ruleId' => $rule['id'], 'values' => $values, 'coupon' => '',
                'price' => $price, 'spec' => shop_spec($rule, $values), 'fileIds' => $fileIds, 'reports' => [], 'artworkAccepted' => ($prod['artwork'] ?? true) === false || ($a['artworkAccepted'] ?? null) === true,
                'proof' => false, 'jobName' => '', 'designRequested' => $design, 'choices' => shop_choices($rule, $values), 'lines' => $lines, 'designFiles' => $designFiles];
            if (empty($prod['digital']) && ($wd = shop_wrap_design_item($rule, $values))) { $item = array_merge($item, $wd); $item['spec'] = ['width' => '—', 'height' => '—', 'bleed' => 0, 'sides' => 0]; }
            if (!empty($prod['digital'])) { $t = shop_template_by_rule($rule['id']); $tf = shop_file($t['file_id']); $item['templateId'] = $t['id']; $item['digitalKey'] = 'template'; $item['digitalName'] = $tf ? $tf['name'] : $t['name']; $item['artworkAccepted'] = true; $item['spec'] = ['width' => '—', 'height' => '—', 'bleed' => 0, 'sides' => 1]; }
            if ($designFiles && is_numeric($dz['dimensions']['width'] ?? null) && is_numeric($dz['dimensions']['height'] ?? null)) { $item['spec']['width'] = round($dz['dimensions']['width'] + 0, 3); $item['spec']['height'] = round($dz['dimensions']['height'] + 0, 3); }
            if (!$designFiles) foreach ($fileIds as $fid) $item['reports'][] = shop_check_file(shop_owned_file($fid, $sid), $rule, $values);
            $draft['items'][] = $item;
        }
        if (count($draft['items']) === $before) json_out(shop_status($draft, $revision));
        if (empty($draft['coupon'])) foreach ($v['items'] as $a) { // a code applied on the product page carries over
            $code = strtoupper(trim((string)(is_array($a) ? ($a['pricing']['coupon'] ?? '') : '')));
            if ($code !== '' && preg_match('/^[A-Z0-9_-]{2,40}$/', $code)) { try { $sub = 0; foreach ($draft['items'] as $i) $sub += (int)$i['price']['net']; shop_coupon_eval($code, shop_coupon_lines($draft['items']), null, $sub); $draft['coupon'] = $code; break; } catch (ShopError $e) { } }
        }
        $draft['rates'] = []; $draft['shipping'] = null;
    } elseif ($path === '/api/checkout/item') {
        $idx = null; foreach ($draft['items'] as $n => $i) if ($i['id'] === ($v['id'] ?? null)) $idx = $n;
        if ($idx === null) throw new ShopError('Item not found.');
        if (($v['remove'] ?? null) === true) { array_splice($draft['items'], $idx, 1); $draft['rates'] = []; $draft['shipping'] = null; }
        else {
            $it = &$draft['items'][$idx];
            if (array_key_exists('fileIds', $v)) {
                if (!is_array($v['fileIds']) || count($v['fileIds']) > 30) throw new ShopError('Choose valid artwork files.');
                $rule = shop_rule($it['ruleId']); if (!$rule) throw new ShopError('This product is no longer available.');
                $it['fileIds'] = []; $it['reports'] = []; $it['proof'] = false; $it['artworkError'] = '';
                foreach (array_unique($v['fileIds']) as $fid) { $f = shop_owned_file((string)$fid, $sid); $it['fileIds'][] = $f['id']; $it['reports'][] = shop_check_file($f, $rule, $it['values']); }
            }
            if (($v['proof'] ?? null) === true) { if (!$it['fileIds']) throw new ShopError('Upload artwork first.'); $it['artworkAccepted'] = true; $it['proof'] = true; $it['proofAt'] = now_iso(); }
            if (($v['proof'] ?? null) === false) $it['proof'] = false;
            if (array_key_exists('jobName', $v)) $it['jobName'] = shop_clean($v['jobName'], 120);
            unset($it);
        }
    } elseif ($path === '/api/checkout/shipping') {
        // mode "pickup": contact details only, pickup is selected; mode "ship": a full Canadian delivery address, then a delivery method.
        $mode = ($v['mode'] ?? 'ship') === 'pickup' ? 'pickup' : 'ship';
        $a = is_array($v['address'] ?? null) ? $v['address'] : [];
        $phone = shop_clean($a['phone'] ?? '', 40);
        if (mb_strlen(shop_clean($a['name'] ?? '', 120)) < 2) throw new ShopError('Enter your full name.');
        if (!filter_var(shop_clean($a['email'] ?? '', 254), FILTER_VALIDATE_EMAIL)) throw new ShopError('Enter a valid email address.');
        if (!preg_match('/^(?=(?:\D*\d){7})[0-9 +().-]{7,40}$/', $phone)) throw new ShopError('Enter a phone number we can reach you at.');
        if ($mode === 'ship' && (!shop_clean($a['street1'] ?? '') || !shop_clean($a['city'] ?? '') || !preg_match('/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i', (string)($a['zip'] ?? '')) || !in_array($a['state'] ?? '', SHOP_PROVINCES, true) || ($a['country'] ?? '') !== 'CA'))
            throw new ShopError('Complete a valid Canadian delivery address.');
        $addr = []; foreach (['name', 'email', 'phone', 'company', 'street1', 'street2', 'city', 'state', 'zip', 'country'] as $k) $addr[$k] = $mode === 'pickup' && !in_array($k, ['name', 'email', 'phone', 'company'], true) ? '' : shop_clean($a[$k] ?? '', $k === 'email' ? 254 : 160);
        $addr['zip'] = strtoupper($addr['zip']); $addr['email'] = strtolower($addr['email']);
        if ($mode === 'pickup') { $addr['country'] = 'CA'; $addr['pickup'] = true; }
        $b = is_array($v['billingAddress'] ?? null) ? $v['billingAddress'] : ($mode === 'ship' ? $a : []);
        $hasBilling = shop_clean($b['street1'] ?? '') !== '';
        if (($mode === 'ship' || $hasBilling) && (!shop_clean($b['name'] ?? '') || !shop_clean($b['street1'] ?? '') || !shop_clean($b['city'] ?? '') || !preg_match('/^\w\d\w ?\d\w\d$/i', (string)($b['zip'] ?? '')))) throw new ShopError('Complete your billing address.');
        $bill = []; foreach (['name', 'email', 'street1', 'street2', 'city', 'state', 'zip', 'country'] as $k) $bill[$k] = shop_clean($b[$k] ?? '', 160);
        if ($mode === 'pickup' && !$hasBilling) { $bill['name'] = $addr['name']; $bill['email'] = $addr['email']; $bill['country'] = 'CA'; } // pickup: billing address optional
        $draft['address'] = $addr; $draft['billingAddress'] = $bill; $draft['deliveryMode'] = $mode;
        $draft['rates'] = shop_rates($addr, $mode); $draft['carrierStatus'] = 'not_connected';
        $draft['deliveryOptions'] = $mode === 'ship' ? shop_delivery_options($addr) : [];
        $draft['shippingNotice'] = $mode === 'ship' ? (shop_is_gta($addr) ? 'GTA next business day delivery is available for this address.' : 'This address is outside our GTA delivery area. Carrier shipping is coming soon — choose pickup or contact us about delivery.') : '';
        $draft['shipping'] = $mode === 'pickup' ? $draft['rates'][0] + ['selectedAt' => now_iso()] : null;
    } elseif ($path === '/api/checkout/coupon') {
        $code = strtoupper(trim((string)($v['code'] ?? '')));
        if ($code === '') $draft['coupon'] = null;
        else {
            shop_limit('shopcoupon:' . shop_ip(), 30, 600, 'Too many discount code attempts. Please wait a few minutes.');
            $sub = 0; foreach ($draft['items'] as $i) $sub += (int)$i['price']['net'];
            shop_coupon_eval($code, shop_coupon_lines($draft['items']), $draft['address']['email'] ?? null, $sub);
            $draft['coupon'] = $code;
        }
    } elseif ($path === '/api/checkout/select-shipping') {
        $rate = null; foreach ($draft['rates'] as $r) if ($r['id'] === ($v['id'] ?? null)) $rate = $r;
        if (!$rate) throw new ShopError('Refresh and choose an available shipping method.');
        $draft['shipping'] = $rate + ['selectedAt' => now_iso()];
    } elseif ($path === '/api/checkout/request') {
        json_out(['error' => 'Use the payment step to place your order.'], 410);
    } else json_out(['error' => 'Not found'], 404);

    if (!shop_draft_save($sid, $draft, $revision, $exists)) json_out(['error' => 'Checkout changed. Reload before saving.'], 409);
    json_out(shop_status($draft, $revision + 1));
}

function shop_checkout_payment(array $s, array $v, array $draft, int $revision, bool $exists, bool $card = false): void {
    $sid = $s['id']; $pdo = shop_db();
    shop_limit('shoppay:' . shop_ip(), 20, 3600, 'Too many checkout attempts. Please wait and try again, or call 905-695-9147.');
    $prov = (string)($v['provider'] ?? ''); $sqReady = shop_square_ready(); $ppReady = shop_paypal_ready();
    if (!in_array($prov, ['square', 'paypal'], true)) throw new ShopError('Choose a payment method.');
    if ($prov === 'paypal' && !$ppReady) json_out(['error' => 'PayPal is not available right now. Pay by card instead.'], 503);
    if ($prov === 'square' && !$sqReady && $ppReady) json_out(['error' => 'Card payment is not available right now. Use PayPal.'], 503);
    if ($card && !$sqReady) json_out(['error' => 'Card payment is not available right now.'], 503);
    $afterpay = $card && ($v['method'] ?? '') === 'afterpay';
    if ($afterpay && !shop_square()['afterpay']) json_out(['error' => 'Afterpay is not available right now. Pay by card instead.'], 503);
    if ($card && (!is_string($v['sourceId'] ?? null) || !preg_match('/^[A-Za-z0-9:_\-]{8,512}$/', $v['sourceId']) || !shop_is_uuid($v['idempotencyKey'] ?? null)
        || (isset($v['verificationToken']) && $v['verificationToken'] !== null && (!is_string($v['verificationToken']) || !preg_match('/^[A-Za-z0-9:_\-]{4,2048}$/', $v['verificationToken']))))) throw new ShopError('Card details could not be read. Please re-enter your card.');
    if (($v['consent'] ?? null) !== true) throw new ShopError('Accept the order terms before payment.');
    if (!$exists || ($v['revision'] ?? null) !== $revision) json_out(['error' => 'Your cart changed. Reload checkout.'], 409);
    if (!empty($draft['submitted'])) {
        $o = shop_order((string)($draft['submitted']['orderId'] ?? ''));
        if ($o && hash_equals($o['session_id'], $sid)) json_out(['order' => array_merge(shop_public_order($o), ['url' => '/satin/checkout/'])]);
        throw new ShopError('Start another checkout to place a new order.');
    }
    if (!$draft['items'] || !$draft['address'] || !$draft['shipping']) throw new ShopError('Complete your address and delivery method first.');
    foreach ($draft['items'] as $i) if (!shop_complete($i)) throw new ShopError('Confirm your artwork on the product page, then return to checkout.');
    // Authoritative prices: recompute every item from the current rules.
    foreach ($draft['items'] as $i) {
        $prod = shop_product_for_rule($i['ruleId']); $rule = shop_rule($i['ruleId']);
        if (!$prod || !$rule) throw new ShopError('“' . $i['name'] . '” is no longer available. Remove it to continue.');
        $now = calculate($rule, $i['values']);
        if ($now['net'] !== (int)$i['price']['net'] || (int)$now['revision'] !== (int)($i['price']['revision'] ?? 0)) throw new ShopError('The price of “' . $i['name'] . '” changed. Remove it and add it again from the product page.');
    }
    $t = shop_totals($draft);
    if (!$t['taxReady']) throw new ShopError('Online ordering is not available for this delivery province yet. Choose pickup or contact us.');
    if ($t['couponError']) throw new ShopError($t['couponError'] . ' Remove the discount code to continue.');
    if ($t['total'] === 0) throw new ShopError('Your total is $0.00 after the discount, so it cannot be paid online. Please contact us at info@satingraphic.ca or 905-695-9147 to complete this order.');
    if ($t['total'] < 0 || $t['total'] > 10000000) throw new ShopError('Check the order amount.');
    $h = hash('sha256', $sid . ':' . $revision);
    $id = substr($h, 0, 8) . '-' . substr($h, 8, 4) . '-' . substr($h, 12, 4) . '-' . substr($h, 16, 4) . '-' . substr($h, 20, 12);
    $o = shop_order($id);
    if (!$o) {
        $a = $draft['address']; $notes = []; $files = [];
        foreach ($draft['items'] as $i) { foreach ($i['lines'] ?? [] as $l) if (str_starts_with($l, 'Notes: ')) $notes[] = ($i['name']) . ': ' . substr($l, 7); foreach (array_merge($i['fileIds'], $i['designFiles'] ?? []) as $f) $files[] = $f; }
        $pdo->prepare('INSERT INTO shop_orders (coupon_code,discount,id,number,session_id,draft_revision,status,provider,provider_order_id,payment_url,payment_id,name,email,phone,company,address,billing,shipping,items,file_ids,subtotal,shipping_total,tax,tax_rate,total,deposit,currency,customer_notes,admin_notes,created_at,updated_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$t['discount'] > 0 ? strtoupper((string)$t['coupon']) : '', $t['discount'], $id, shop_order_ref($id), $sid, $revision, 'awaiting_payment', 'manual', '', '', '', $a['name'], $a['email'], $a['phone'], $a['company'],
                json_encode($a, JSON_UNESCAPED_UNICODE), json_encode($draft['billingAddress'], JSON_UNESCAPED_UNICODE), json_encode($draft['shipping'], JSON_UNESCAPED_UNICODE),
                json_encode($draft['items'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), json_encode(array_values(array_unique($files))),
                $t['subtotal'], $t['shipping'], $t['tax'], $t['rate'], $t['total'], $t['total'], 'CAD', implode("\n", $notes), '', now_iso(), now_iso(), '']);
        if (!empty($_COOKIE['satin_customer'])) { require_once __DIR__ . '/customer.php'; cust_attach_order($id); } // signed-in customer: link the order to the account
        $o = shop_order($id);
    }
    if ($o['status'] !== 'awaiting_payment') json_out(['order' => shop_public_order($o)]);
    if ($card) {
        // Afterpay: the amount charged must equal the amount the buyer approved in the Afterpay popup (the server total shown on the page).
        if ($afterpay && (!is_int($v['expectedTotal'] ?? null) || $v['expectedTotal'] !== (int)$o['total'])) json_out(['error' => 'Your order total changed. Reload checkout and approve Afterpay again.'], 409);
        json_out(['order' => shop_public_order(shop_square_charge($o, $v, $afterpay))]);
    }
    if ($prov === 'paypal') { // which PayPal button the buyer pressed (label only; the payment itself is verified with PayPal)
        $lbl = ($v['funding'] ?? '') === 'paylater' && shop_paypal()['payLater'] ? 'PayPal Pay Later' : '';
        if (($o['card'] ?? '') !== $lbl) { shop_db()->prepare('UPDATE shop_orders SET card = ?, updated_at = ? WHERE id = ?')->execute([$lbl, now_iso(), $o['id']]); $o = shop_order($o['id']); }
    }
    if ($o['payment_url'] !== '' && $o['provider'] === $prov) json_out(['order' => shop_public_order($o)]);
    $switched = $o['payment_url'] !== '';
    if ($switched) { // keep a trace of the earlier link so a late payment on it can still be matched (see webhooks)
        $tag = ($o['provider'] === 'square' ? 'sq:' : 'pp:') . $o['provider_order_id'];
        shop_db()->prepare('UPDATE shop_orders SET admin_notes = ?, updated_at = ? WHERE id = ?')->execute([trim($o['admin_notes'] . "\n[payment] Buyer switched from {$o['provider']} to $prov; earlier checkout [$tag]"), now_iso(), $o['id']]);
        $o = shop_order($o['id']);
    }
    $return = site_url() . '/satin/checkout/?payment=' . $o['id'];
    $why = 'no online payment provider is connected';
    if ($prov === 'square' && $sqReady) {
        try { $o = shop_square_link($o, $return, $switched ? $o['id'] . '-' . time() : $o['id']); json_out(['order' => shop_public_order($o)]); }
        catch (Throwable $e) { error_log('satin square link: ' . $e->getMessage()); $why = 'Square payment link failed: ' . $e->getMessage(); }
    }
    if ($prov === 'paypal') {
        try { $o = shop_paypal_create($o, $return, ($v['popup'] ?? false) === true); json_out(['order' => shop_public_order($o)]); }
        catch (Throwable $e) { error_log('satin paypal create: ' . $e->getMessage()); throw new ShopError('PayPal could not start the payment. Try again or pay by card.'); }
    }
    // No online payment available: keep the order, tell the customer we will send a payment link.
    $draft['submitted'] = ['reference' => $o['number'], 'orderId' => $o['id'], 'status' => 'awaiting_payment', 'at' => now_iso()];
    shop_draft_save($sid, $draft, $revision, true);
    shop_coupon_record($o);
    shop_notify_new($o, "awaiting payment — $why. Send the customer a payment link from Admin → Orders");
    shop_mail_customer_received($o);
    json_out(['order' => array_merge(shop_public_order($o), ['url' => '/satin/checkout/', 'message' => 'Order received. We will email you a secure payment link.'])]);
}

/** Validates quote-request attachments (files uploaded in this browser session). */
function shop_claim_attachments($ids): array {
    if (!is_array($ids) || count($ids) > 10) throw new ShopError('Attach up to 10 files.');
    $s = shop_session(); if (!$s) throw new ShopError('Your upload session expired. Upload the files again.');
    $out = [];
    foreach (array_unique(array_filter($ids, 'is_string')) as $id) { $f = shop_owned_file($id, $s['id']); $out[] = ['id' => $f['id'], 'name' => $f['name'], 'size' => (int)$f['size'], 'mime' => $f['mime']]; }
    return $out;
}

/* ---------------- Design Studio: approval, studio cart, order for review ---------------- */
function shop_owned_design(string $id, string $sid): ?array {
    if (!shop_is_uuid($id)) return null;
    $q = shop_db()->prepare('SELECT session_id, design FROM shop_designs WHERE id = ?'); $q->execute([$id]); $r = $q->fetch();
    return $r && hash_equals($r['session_id'], $sid) ? (json_decode($r['design'], true) ?: null) : null;
}
const SHOP_APPROVAL_KEYS = ['approvedAt', 'generated', 'originals', 'printSpecifications', 'dimensions'];
/** Approval fields are server-owned: kept only while the saved artwork (sides) is unchanged. */
function shop_design_merge(array $new, array $old): array {
    foreach (SHOP_APPROVAL_KEYS as $k) unset($new[$k]);
    if (!empty($old['approvedAt']) && json_encode($new['sides'] ?? null) === json_encode($old['sides'] ?? null)) foreach (SHOP_APPROVAL_KEYS as $k) if (array_key_exists($k, $old)) $new[$k] = $old[$k];
    return $new;
}
/** Studio product → price rule (same mapping as the site catalog: product id, then studioProductId). */
function shop_studio_rule(string $productId): ?array {
    $all = cat_products(true); $p = $all[$productId] ?? null;
    if (!$p || empty($p['ruleId'])) foreach ($all as $x) if (($x['studioProductId'] ?? '') === $productId && !empty($x['ruleId'])) { $p = $x; break; }
    // Design Studio vehicle products → their wrap estimator rule (used when the catalogue has no studioProductId link yet).
    $vehicles = ['vehicle-van' => 'wrap-transit-van', 'vehicle-sprinter' => 'wrap-sprinter-van', 'vehicle-cargo-van' => 'wrap-cargo-van', 'vehicle-pickup' => 'wrap-pickup-truck',
        'vehicle-minivan' => 'wrap-minivan', 'vehicle-suv' => 'wrap-suv', 'vehicle-sedan' => 'wrap-sedan', 'vehicle-box-truck' => 'wrap-box-truck', 'vehicle-trailer' => 'wrap-trailer'];
    if ((!$p || empty($p['ruleId'])) && isset($vehicles[$productId])) return shop_rule($vehicles[$productId]);
    return $p ? shop_rule((string)$p['ruleId']) : null;
}
function shop_design_values(array $rule, array $design): array {
    $in = [];
    foreach ($rule['fields'] as $f) { $v = $design['options']['values'][$f['key']] ?? $f['default']; $in[$f['key']] = is_numeric($v) ? $v + 0 : $f['default']; }
    if (isset($in['quantity']) && is_numeric($design['options']['quantity'] ?? null)) $in['quantity'] = $design['options']['quantity'] + 0;
    return shop_field_values($rule, answers($rule, $in));
}
function shop_png_data(string $url, string $what): string {
    if (strlen($url) > 4000000 || !shop_is_data_url($url, ['image/png'])) throw new ShopError('Generate a PNG ' . $what . ' before approval.');
    $bin = (string)base64_decode(substr($url, strpos($url, ',') + 1), true);
    if (strncmp($bin, "\x89PNG\r\n\x1a\n", 8) !== 0 || !@getimagesizefromstring($bin)) throw new ShopError('Invalid ' . $what . ' image.');
    return $bin;
}
function shop_studio_orders(string $r, string $method, array $s): void {
    $pdo = shop_db(); $sid = $s['id'];
    if ($r === '/attachment' && $method === 'GET') {
        $d = shop_owned_design((string)($_GET['id'] ?? ''), $sid);
        if (!$d) json_out(['error' => 'Design not found'], 404);
        if (empty($d['approvedAt'])) json_out(['error' => 'Approve the design first'], 409);
        json_out(['id' => (string)$_GET['id'], 'design' => $d]);
    }
    if ($r === '/cart' && $method === 'GET') {
        $q = $pdo->prepare("SELECT id, design_id, design, price, created_at FROM shop_cart_items WHERE session_id = ? AND status = 'in_cart' ORDER BY created_at"); $q->execute([$sid]);
        json_out(['items' => array_map(fn($x) => ['id' => $x['id'], 'design_id' => $x['design_id'], 'design' => json_decode($x['design'], true), 'price' => json_decode($x['price'], true), 'created_at' => $x['created_at']], $q->fetchAll())]);
    }
    if ($method !== 'POST') json_out(['error' => 'Not found.'], 404);
    if ($r === '/cart/remove') {
        $v = shop_input(2000);
        $pdo->prepare("UPDATE shop_cart_items SET status = 'removed' WHERE id = ? AND session_id = ? AND status = 'in_cart'")->execute([(string)($v['id'] ?? ''), $sid]);
        json_out(['saved' => true]);
    }
    if ($r === '/approve' || $r === '/cart/add') {
        if ($r === '/approve') @ini_set('memory_limit', '768M');
        $v = shop_input($r === '/approve' ? 66000000 : 10000000);
        if (!shop_is_uuid($v['id'] ?? null) || !shop_is_uuid($v['designId'] ?? null) || ($v['approved'] ?? null) !== true) throw new ShopError('Review and approve the design first.');
        $design = shop_owned_design($v['designId'], $sid);
        if (!$design) throw new ShopError('Save the current design first.');
        $rule = shop_studio_rule((string)($design['productId'] ?? ''));
        if (!$rule) throw new ShopError('This product is not available for online ordering.');
        $price = calculate($rule, shop_design_values($rule, $design));
        if (is_string($design['options']['coupon'] ?? null) && trim($design['options']['coupon']) !== '') { try { $price = shop_coupon_quote($rule, $price, $design['options']['coupon']); } catch (ShopError $e) { } }
        if ($r === '/cart/add') {
            $q = $pdo->prepare('SELECT session_id, price FROM shop_cart_items WHERE id = ?'); $q->execute([$v['id']]); $ex = $q->fetch();
            if ($ex) { if (!hash_equals($ex['session_id'], $sid)) json_out(['error' => 'Item not found.'], 404); json_out(['saved' => true, 'id' => $v['id'], 'price' => json_decode($ex['price'], true)]); }
            if (empty($design['approvedAt'])) throw new ShopError('Approve the design in Design Studio first.');
            if (($v['expectedTotal'] ?? null) !== $price['total'] || ($v['expectedRevision'] ?? null) !== $price['revision']) json_out(['error' => 'Pricing changed. Refresh the estimate and approve again.'], 409);
            $c = $pdo->prepare('SELECT COUNT(*) n FROM shop_cart_items WHERE session_id = ?'); $c->execute([$sid]);
            if ((int)$c->fetch()['n'] >= 30) throw new ShopError('Maximum 30 approved designs per session.');
            $pdo->prepare('INSERT INTO shop_cart_items (id,session_id,design_id,design,price,status,order_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
                ->execute([$v['id'], $sid, $v['designId'], json_encode($design, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), json_encode($price), 'in_cart', '', now_iso()]);
            json_out(['saved' => true, 'id' => $v['id'], 'price' => $price], 201);
        }
        // /approve: the browser renders the print files (svgArtwork) and PNGs; the server validates and stores them.
        shop_limit('shopapprove:' . shop_ip(), 60, 3600, 'Too many approvals. Please wait and try again.');
        $art = $v['artwork'] ?? null;
        if (!is_array($art) || !$art || count($art) > 12) throw new ShopError('Refresh the page to load the latest Design Studio, then approve again.');
        $q = $pdo->prepare('SELECT COALESCE(SUM(size),0) b FROM shop_files WHERE session_id = ?'); $q->execute([$sid]);
        if ((int)$q->fetch()['b'] > 240000000) throw new ShopError('This session has reached its artwork storage limit.');
        $pid = preg_replace('/[^a-z0-9-]/', '', (string)$design['productId']);
        $checked = [];
        foreach ($art as $a) {
            $svg = is_array($a) && is_string($a['svg'] ?? null) ? $a['svg'] : '';
            shop_check_design_svg($svg);
            $key = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($a['key'] ?? ('side-' . count($checked)))));
            $checked[] = [$svg, $pid . '-' . ($key ?: 'side') . '.svg'];
        }
        $previewPng = shop_png_data((string)($v['preview'] ?? ''), 'preview'); $mockupPng = shop_png_data((string)($v['mockup'] ?? ''), 'mockup');
        $gen = [];
        $add = function (array $row, string $role) use (&$gen) { $gen[] = ['id' => $row['id'], 'name' => $row['name'], 'mime' => $row['mime'], 'size' => (int)$row['size'], 'role' => $role]; };
        foreach ($checked as [$svg, $name]) $add(shop_store_bytes($svg, 'generated', $sid, $name, 'image/svg+xml'), 'artwork');
        $clean = $design; foreach (SHOP_APPROVAL_KEYS as $k) unset($clean[$k]);
        $add(shop_store_bytes((string)json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'generated', $sid, $pid . '-editable-design.json', 'application/json'), 'source');
        // Optional 300 DPI rasters (trim + bleed) of each side, used by Admin → Orders to build the print-ready PDF.
        // Current Design Studio sends CMYK JPEGs (4 channels); apparel sends transparent PNGs (converted to CMYK in print_pdf.php).
        $prints = is_array($v['print'] ?? null) ? array_slice($v['print'], 0, count($checked)) : [];
        foreach ($prints as $pr) {
            if (!is_array($pr) || !is_string($pr['image'] ?? null)) continue;
            $num = fn($k, $lo, $hi) => is_numeric($pr[$k] ?? null) && (float)$pr[$k] >= $lo && (float)$pr[$k] <= $hi ? round((float)$pr[$k], 4) : null;
            $w = $num('widthIn', 0.5, 600); $h = $num('heightIn', 0.5, 600); $b = $num('bleedIn', 0, 1); $dpi = $num('dpi', 5, 600); // vehicle sides reach ~36 ft (26 ft straight truck)
            if ($w === null || $h === null || $b === null || $dpi === null || !shop_is_data_url($pr['image'], ['image/jpeg', 'image/png'])) continue;
            $bin = base64_decode(substr($pr['image'], strpos($pr['image'], ',') + 1), true); $sz = $bin ? @getimagesizefromstring($bin) : false;
            if (!$sz || !in_array($sz['mime'], ['image/jpeg', 'image/png'], true)) continue;
            if (abs($sz[0] / $sz[1] - ($w + 2 * $b) / ($h + 2 * $b)) > 0.02 * ($w + 2 * $b) / ($h + 2 * $b)) continue; // pixels must match trim + bleed
            $key = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($pr['key'] ?? 'side'))) ?: 'side';
            $row = shop_store_bytes($bin, 'generated', $sid, "$pid-$key-print." . ($sz['mime'] === 'image/png' ? 'png' : 'jpg'), $sz['mime'], (int)$sz[0], (int)$sz[1],
                ['role' => 'print', 'side' => $key, 'widthIn' => $w, 'heightIn' => $h, 'bleedIn' => $b, 'dpi' => $dpi]);
            $add($row, 'print');
        }
        // Layered print-ready PDF built in the browser (background + every element as its own CMYK object, colour codes, mockup page)
        if (is_string($v['printPdf'] ?? null) && strncmp($v['printPdf'], 'data:application/pdf;base64,', 28) === 0 && strlen($v['printPdf']) < 30000000) {
            $pdfBin = base64_decode(substr($v['printPdf'], 28), true);
            if ($pdfBin !== false && strncmp($pdfBin, '%PDF-', 5) === 0 && strpos(substr($pdfBin, -64), '%%EOF') !== false)
                $add(shop_store_bytes($pdfBin, 'generated', $sid, "$pid-print-ready.pdf", 'application/pdf', 0, 0, ['role' => 'printpdf', 'layered' => true]), 'printpdf');
            unset($pdfBin); unset($v['printPdf']);
        }
        foreach ([[$previewPng, 'preview'], [$mockupPng, 'mockup']] as [$bin, $role]) { $sz = getimagesizefromstring($bin); $add(shop_store_bytes($bin, 'generated', $sid, "$pid-$role.png", 'image/png', (int)$sz[0], (int)$sz[1]), $role); }
        $originals = [];
        foreach ((array)($design['assets'] ?? []) as $fid) if (is_string($fid)) { $f = shop_owned_file($fid, $sid); $originals[] = ['id' => $f['id'], 'name' => $f['name'], 'mime' => $f['mime'], 'size' => (int)$f['size']]; }
        $specs = [];
        $vals = shop_design_values($rule, $design);
        foreach ($rule['fields'] as $f) { $val = $vals[$f['key']]; $sel = ''; if ($f['type'] === 'select') foreach ($f['options'] as $o) if ((float)$o['value'] === (float)$val) $sel = $o['label']; $specs[] = ['key' => $f['key'], 'label' => $f['label'], 'value' => $val, 'selection' => $f['type'] === 'select' ? $sel : ($f['type'] === 'checkbox' ? ($val ? 'Yes' : 'No') : (string)$val)]; }
        $dim = is_array($v['dimensions'] ?? null) ? $v['dimensions'] : [];
        $approved = $clean + ['printSpecifications' => $specs, 'generated' => $gen, 'originals' => $originals, 'approvedAt' => now_iso(),
            'dimensions' => ['width' => is_numeric($dim['width'] ?? null) ? $dim['width'] + 0 : null, 'height' => is_numeric($dim['height'] ?? null) ? $dim['height'] + 0 : null, 'bleed' => is_numeric($dim['bleed'] ?? null) ? $dim['bleed'] + 0 : null]];
        $pdo->prepare('UPDATE shop_designs SET design = ?, updated_at = ? WHERE id = ? AND session_id = ?')->execute([json_encode($approved, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now_iso(), $v['designId'], $sid]);
        // Signed-in customers keep every approved design in My account → Saved designs.
        try { require_once __DIR__ . '/customer.php'; $cu = cust_current(); if ($cu) $pdo->prepare("UPDATE shop_designs SET customer_id = ? WHERE id = ? AND session_id = ? AND customer_id = ''")->execute([$cu['id'], $v['designId'], $sid]); } catch (Throwable $e) { error_log('satin design link: ' . $e->getMessage()); }
        json_out(['saved' => true, 'id' => $v['designId'], 'design' => $approved, 'price' => $price], 201);
    }
    if ($r === '/order') {
        // Studio cart "submit for review": saved as an online order awaiting payment; the owner confirms and sends a payment link.
        shop_limit('shoporder:' . shop_ip(), 10, 3600, 'Too many orders. Please wait or call 905-695-9147.');
        $v = shop_input(10000);
        $name = shop_clean($v['name'] ?? '', 120); $email = strtolower(shop_clean($v['email'] ?? '', 254));
        if (!shop_is_uuid($v['id'] ?? null) || ($v['consent'] ?? null) !== true || mb_strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new ShopError('Add contact details and agree to order review.');
        $ex = shop_order(strtolower($v['id']));
        if ($ex) { if (!hash_equals($ex['session_id'], $sid)) json_out(['error' => 'Order not found.'], 404); json_out(['reference' => $ex['number'], 'status' => 'submitted']); }
        $q = $pdo->prepare("SELECT * FROM shop_cart_items WHERE session_id = ? AND status = 'in_cart' ORDER BY created_at"); $q->execute([$sid]); $rows = $q->fetchAll();
        if (!$rows || count($rows) > 30) throw new ShopError('Add 1–30 approved designs to your cart.');
        $items = []; $files = []; $sub = 0;
        foreach ($rows as $row) {
            $d = json_decode($row['design'], true); $rule = shop_studio_rule((string)$d['productId']);
            if (!$rule) throw new ShopError('A product in your cart is no longer available.');
            $vals = shop_design_values($rule, $d); $price = calculate($rule, $vals);
            if ($price['total'] !== (json_decode($row['price'], true)['total'] ?? null)) json_out(['error' => 'Pricing changed for a cart item. Remove it and add the design again.'], 409);
            $art = []; $all = [];
            foreach ($d['generated'] ?? [] as $g) { $all[] = $g['id']; if ($g['role'] === 'artwork') $art[] = $g['id']; }
            $files = array_merge($files, $all); $sub += $price['net'];
            $items[] = ['id' => $row['id'], 'sourceKey' => $row['id'], 'productId' => (string)$d['productId'], 'name' => (string)($rule['label'] ?? $d['productId']), 'path' => (string)($rule['path'] ?? ''), 'ruleId' => $rule['id'],
                'values' => $vals, 'coupon' => '', 'price' => $price, 'spec' => shop_spec($rule, $vals), 'fileIds' => $art, 'designFiles' => $all, 'reports' => [], 'artworkAccepted' => true, 'proof' => true, 'jobName' => '',
                'designRequested' => false, 'choices' => shop_choices($rule, $vals), 'lines' => ['Design Studio design ' . $row['design_id']]];
        }
        $tax = (int)round($sub * 13 / 100); $id = strtolower($v['id']);
        $addr = ['name' => $name, 'email' => $email, 'phone' => shop_clean($v['phone'] ?? '', 40), 'company' => '', 'street1' => '', 'street2' => '', 'city' => '', 'state' => 'ON', 'zip' => '', 'country' => 'CA'];
        $ship = ['id' => 'pickup', 'label' => 'To be confirmed (pickup or delivery)', 'amount' => 0];
        $pdo->prepare('INSERT INTO shop_orders (id,number,session_id,draft_revision,status,provider,provider_order_id,payment_url,payment_id,name,email,phone,company,address,billing,shipping,items,file_ids,subtotal,shipping_total,tax,tax_rate,total,deposit,currency,customer_notes,admin_notes,created_at,updated_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$id, shop_order_ref($id), $sid, -1, 'awaiting_payment', 'manual', '', '', '', $name, $email, $addr['phone'], '', json_encode($addr), json_encode($addr), json_encode($ship), json_encode($items, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), json_encode(array_values(array_unique($files))),
                $sub, 0, $tax, 13, $sub + $tax, $sub + $tax, 'CAD', shop_clean($v['notes'] ?? '', 3000), '', now_iso(), now_iso(), '']);
        $pdo->prepare("UPDATE shop_cart_items SET status = 'submitted', order_id = ? WHERE session_id = ? AND status = 'in_cart'")->execute([$id, $sid]);
        $o = shop_order($id);
        shop_notify_new($o, 'Design Studio order for review — confirm details and send a payment link from Admin → Orders');
        shop_mail_customer_received($o);
        json_out(['reference' => $o['number'], 'totals' => ['subtotal' => $sub, 'tax' => $tax, 'total' => $sub + $tax, 'currency' => 'CAD'], 'status' => 'submitted'], 201);
    }
    json_out(['error' => 'Not found.'], 404);
}

/** Print files and mockups of designs approved in this browser session during the last 7 days (for quote requests). */
function shop_session_design_files(): array {
    $s = shop_session(); if (!$s) return [];
    $q = shop_db()->prepare('SELECT design FROM shop_designs WHERE session_id = ? AND updated_at > ? ORDER BY updated_at DESC LIMIT 10'); $q->execute([$s['id'], gmdate('Y-m-d\TH:i:s', time() - 7 * 86400)]);
    $out = [];
    foreach ($q->fetchAll() as $r) {
        $d = json_decode($r['design'], true) ?: [];
        if (empty($d['approvedAt'])) continue;
        foreach ($d['generated'] ?? [] as $g) if (in_array($g['role'] ?? '', ['artwork', 'mockup', 'source'], true) && shop_file((string)$g['id'])) $out[] = ['id' => $g['id'], 'name' => 'Design Studio · ' . $g['name'], 'size' => (int)$g['size'], 'mime' => $g['mime']];
    }
    return array_slice($out, 0, 40);
}

/* ---------------- PayPal (REST Orders v2) ---------------- */
function shop_paypal(): array {
    $c = shop_setting('shop.paypal'); $c = is_array($c) ? $c : [];
    return ['environment' => ($c['environment'] ?? 'sandbox') === 'live' ? 'live' : 'sandbox', 'clientId' => (string)($c['clientId'] ?? ''), 'clientSecret' => (string)($c['clientSecret'] ?? ''),
        'webhookId' => (string)($c['webhookId'] ?? ''), 'enabled' => ($c['enabled'] ?? true) !== false, 'payLater' => ($c['payLater'] ?? true) !== false, 'updatedAt' => $c['updatedAt'] ?? null, 'updatedBy' => $c['updatedBy'] ?? null];
}
function shop_paypal_ready(?array $c = null): bool { $c = $c ?? shop_paypal(); return $c['enabled'] && $c['clientId'] !== '' && $c['clientSecret'] !== ''; }
function shop_paypal_webhook_url(): string { return site_url() . '/api/payments/webhook/paypal'; }
/** Raw HTTPS call: returns [status, decoded JSON]. */
function shop_http(string $method, string $url, array $headers, ?string $body): array {
    if (!function_exists('curl_init')) throw new ShopError('The server cannot reach the payment provider (curl is missing).');
    $ch = curl_init($url);
    $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => $headers];
    if ($body !== null) $opt[CURLOPT_POSTFIELDS] = $body;
    curl_setopt_array($ch, $opt);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($raw === false) throw new ShopError('Could not reach the payment provider. ' . $err);
    $j = json_decode((string)$raw, true);
    return [$code, is_array($j) ? $j : []];
}
function shop_paypal_base(array $c): string { return (string)(cfg('paypal_api_base') ?: ($c['environment'] === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')); } // override only for local tests
function shop_paypal_token(array $c): string {
    static $tok = [];
    $k = $c['environment'] . $c['clientId'];
    if (isset($tok[$k])) return $tok[$k];
    [$code, $j] = shop_http('POST', shop_paypal_base($c) . '/v1/oauth2/token', ['Authorization: Basic ' . base64_encode($c['clientId'] . ':' . $c['clientSecret']), 'Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'], 'grant_type=client_credentials');
    if ($code !== 200 || empty($j['access_token'])) throw new ShopError('PayPal sign-in failed: ' . mb_substr((string)($j['error_description'] ?? $j['error'] ?? ('HTTP ' . $code)), 0, 160) . (($j['error'] ?? '') === 'invalid_client' ? ' — the Client ID and Secret must come from the same app, and from the ' . ($c['environment'] === 'live' ? 'Live' : 'Sandbox') . ' tab in developer.paypal.com (matching the Environment chosen here).' : ''));
    return $tok[$k] = (string)$j['access_token'];
}
/** PayPal API call; $body may be an array (JSON-encoded) or a prepared JSON string. Returns [status, JSON]. */
function shop_paypal_raw(array $c, string $method, string $path, $body = null, ?string $requestId = null): array {
    $h = ['Authorization: Bearer ' . shop_paypal_token($c), 'Content-Type: application/json', 'Accept: application/json', 'Prefer: return=representation'];
    if ($requestId) $h[] = 'PayPal-Request-Id: ' . $requestId;
    return shop_http($method, shop_paypal_base($c) . $path, $h, $body === null ? null : (is_string($body) ? $body : json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)));
}
function shop_paypal_error(array $j, int $code): string { return mb_substr((string)($j['details'][0]['issue'] ?? $j['name'] ?? $j['message'] ?? ('HTTP ' . $code)), 0, 160); }
function shop_paypal_cents($v): int { return is_numeric($v) ? (int)round((float)$v * 100) : -1; }

/** Creates the PayPal order for our order (amount = our stored, server-computed total) and saves the approval link. */
function shop_paypal_create(array $o, string $returnUrl, bool $popup = false): array {
    $c = shop_paypal();
    if (!shop_paypal_ready($c)) throw new ShopError('PayPal is not connected.');
    $f = fn(int $n) => number_format($n / 100, 2, '.', '');
    $ship = json_decode($o['shipping'], true) ?: []; $a = json_decode($o['address'], true) ?: [];
    $unit = ['reference_id' => 'default', 'custom_id' => $o['id'], 'invoice_id' => $o['number'], 'description' => 'Satin Graphic order ' . $o['number'],
        'amount' => ['currency_code' => 'CAD', 'value' => $f((int)$o['total']), 'breakdown' => ['item_total' => ['currency_code' => 'CAD', 'value' => $f((int)$o['subtotal'])],
            'shipping' => ['currency_code' => 'CAD', 'value' => $f((int)$o['shipping_total'])], 'tax_total' => ['currency_code' => 'CAD', 'value' => $f((int)$o['total'] - (int)$o['subtotal'] - (int)$o['shipping_total'] + (int)($o['discount'] ?? 0))]]
            + ((int)($o['discount'] ?? 0) > 0 ? ['discount' => ['currency_code' => 'CAD', 'value' => $f((int)$o['discount'])]] : [])]];
    $delivery = ($ship['id'] ?? 'pickup') !== 'pickup' && !empty($a['street1']);
    if ($delivery) $unit['shipping'] = ['name' => ['full_name' => mb_substr((string)$a['name'], 0, 300)], 'address' => array_filter(['address_line_1' => $a['street1'], 'address_line_2' => $a['street2'] ?? '', 'admin_area_2' => $a['city'], 'admin_area_1' => $a['state'], 'postal_code' => $a['zip'], 'country_code' => 'CA'], fn($x) => $x !== '')];
    $body = ['intent' => 'CAPTURE', 'purchase_units' => [$unit], 'payment_source' => ['paypal' => ['experience_context' => ['brand_name' => 'Satin Graphic', 'user_action' => 'PAY_NOW',
        'shipping_preference' => $delivery ? 'SET_PROVIDED_ADDRESS' : 'NO_SHIPPING'] + ($popup ? [] : ['return_url' => $returnUrl, 'cancel_url' => $returnUrl . '&cancelled=1'])]]];
    [$code, $j] = shop_paypal_raw($c, 'POST', '/v2/checkout/orders', $body, $o['id'] . ($popup ? '-ppb' : '-pp'));
    if ($code >= 300) throw new ShopError('PayPal: ' . shop_paypal_error($j, $code));
    $url = ''; foreach ($j['links'] ?? [] as $l) if (in_array($l['rel'] ?? '', ['payer-action', 'approve'], true)) $url = (string)$l['href'];
    $host = strtolower((string)parse_url($url, PHP_URL_HOST));
    if (empty($j['id']) || parse_url($url, PHP_URL_SCHEME) !== 'https' || !in_array($host, ['www.paypal.com', 'www.sandbox.paypal.com', 'paypal.com', 'sandbox.paypal.com'], true)) throw new ShopError('PayPal did not return an approval link.');
    shop_db()->prepare("UPDATE shop_orders SET provider = 'paypal', provider_order_id = ?, payment_url = ?, updated_at = ? WHERE id = ?")->execute([(string)$j['id'], $url, now_iso(), $o['id']]);
    return shop_order($o['id']);
}
/** True when a PayPal order (Orders v2 representation) fully pays our order. Returns the capture id or ''. */
function shop_paypal_paid(array $po, array $o): string {
    $u = $po['purchase_units'][0] ?? null;
    if (($po['status'] ?? '') !== 'COMPLETED' || !$u || count($po['purchase_units']) !== 1 || ($u['custom_id'] ?? '') !== $o['id']) return '';
    $paid = 0; $cid = '';
    foreach ($u['payments']['captures'] ?? [] as $cap) if (($cap['status'] ?? '') === 'COMPLETED' && ($cap['amount']['currency_code'] ?? '') === 'CAD') { $paid += shop_paypal_cents($cap['amount']['value'] ?? null); $cid = (string)($cap['id'] ?? ''); }
    return $paid === (int)$o['total'] ? ($cid ?: 'paypal') : '';
}
/** Checks (and with $capture, captures after buyer approval) the PayPal order; marks our order paid when it matches. */
function shop_paypal_verify(array $o, bool $capture): bool {
    $c = shop_paypal();
    if ($c['clientId'] === '' || $c['clientSecret'] === '' || $o['provider'] !== 'paypal' || $o['provider_order_id'] === '' || $o['status'] !== 'awaiting_payment') return false;
    try {
        $path = '/v2/checkout/orders/' . rawurlencode($o['provider_order_id']);
        [$code, $po] = shop_paypal_raw($c, 'GET', $path);
        if ($code !== 200 || ($po['id'] ?? '') !== $o['provider_order_id']) return false;
        if ($capture && ($po['status'] ?? '') === 'APPROVED') {
            $u = $po['purchase_units'][0] ?? [];
            if (($u['custom_id'] ?? '') !== $o['id'] || ($u['amount']['currency_code'] ?? '') !== 'CAD' || shop_paypal_cents($u['amount']['value'] ?? null) !== (int)$o['total']) { error_log('satin paypal: order mismatch ' . $o['number']); return false; }
            [$code, $cap] = shop_paypal_raw($c, 'POST', $path . '/capture', '{}', $o['id'] . '-capture');
            if ($code >= 300) {
                error_log('satin paypal capture: ' . shop_paypal_error($cap, $code));
                if (in_array(shop_paypal_error($cap, $code), ['INSTRUMENT_DECLINED', 'PAYER_ACTION_REQUIRED'], true)) shop_db()->prepare('UPDATE shop_orders SET admin_notes = ?, updated_at = ? WHERE id = ?')->execute([trim($o['admin_notes'] . "\n[payment] PayPal capture declined (" . shop_paypal_error($cap, $code) . ')'), now_iso(), $o['id']]);
                [$code, $po] = shop_paypal_raw($c, 'GET', $path);
                if ($code !== 200) return false;
            } else $po = $cap;
        }
        $cid = shop_paypal_paid($po, $o);
        return $cid !== '' && shop_mark_paid($o, $cid, shop_pay_method_label($o) === 'PayPal Pay Later' ? 'PayPal Pay Later' : 'PayPal');
    } catch (Throwable $e) { error_log('satin paypal verify: ' . $e->getMessage()); return false; }
}
function shop_paypal_order_for(array $r): ?array {
    $pid = (string)($r['supplementary_data']['related_ids']['order_id'] ?? '');
    $pdo = shop_db();
    if ($pid !== '') { $q = $pdo->prepare("SELECT * FROM shop_orders WHERE (provider = 'paypal' AND provider_order_id = ?) OR admin_notes LIKE ?"); $q->execute([$pid, '%[pp:' . $pid . ']%']); if ($o = $q->fetch()) return $o; }
    $cid = (string)($r['custom_id'] ?? '');
    return shop_is_uuid($cid) ? shop_order($cid) : null;
}
function shop_paypal_note(array $o, string $line): void {
    shop_db()->prepare('UPDATE shop_orders SET admin_notes = ?, updated_at = ? WHERE id = ?')->execute([trim($o['admin_notes'] . "\n[payment] " . $line), now_iso(), $o['id']]);
}
function shop_paypal_webhook(): void {
    $raw = (string)file_get_contents('php://input', false, null, 0, 200001);
    if (strlen($raw) > 200000) json_out(['error' => 'Event too large'], 413);
    $c = shop_paypal();
    if ($c['webhookId'] === '' || $c['clientId'] === '' || $c['clientSecret'] === '') json_out(['error' => 'Webhook not connected'], 503);
    $e = json_decode($raw, true);
    if (!is_array($e)) json_out(['error' => 'Invalid event'], 400);
    $h = [];
    foreach (['auth_algo' => 'HTTP_PAYPAL_AUTH_ALGO', 'cert_url' => 'HTTP_PAYPAL_CERT_URL', 'transmission_id' => 'HTTP_PAYPAL_TRANSMISSION_ID', 'transmission_sig' => 'HTTP_PAYPAL_TRANSMISSION_SIG', 'transmission_time' => 'HTTP_PAYPAL_TRANSMISSION_TIME'] as $k => $sv) {
        $h[$k] = (string)($_SERVER[$sv] ?? '');
        if ($h[$k] === '' || strlen($h[$k]) > 2000) json_out(['error' => 'Invalid signature'], 401);
    }
    // The event is passed to PayPal byte-for-byte as received.
    $body = substr(json_encode($h + ['webhook_id' => $c['webhookId']], JSON_UNESCAPED_SLASHES), 0, -1) . ',"webhook_event":' . $raw . '}';
    try { [$code, $j] = shop_paypal_raw($c, 'POST', '/v1/notifications/verify-webhook-signature', $body); }
    catch (Throwable $ex) { json_out(['error' => 'Verification unavailable. Retry.'], 503); }
    if ($code !== 200 || ($j['verification_status'] ?? '') !== 'SUCCESS') json_out(['error' => 'Invalid signature'], 401);
    $type = (string)($e['event_type'] ?? ''); $r = is_array($e['resource'] ?? null) ? $e['resource'] : [];
    require_once __DIR__ . '/invoices_api.php'; // invoice payments (custom_id "inv:<id>")
    try { if (inv_paypal_event($type, $r)) json_out(['received' => true]); } catch (Throwable $ex) { error_log('satin invoice paypal webhook: ' . $ex->getMessage()); }
    if ($type === 'CHECKOUT.ORDER.APPROVED' && !empty($r['id'])) { // buyer approved but did not come back to the site (e.g. emailed link): capture here
        $q = shop_db()->prepare("SELECT * FROM shop_orders WHERE provider = 'paypal' AND provider_order_id = ?"); $q->execute([(string)$r['id']]);
        if ($x = $q->fetch()) shop_paypal_verify($x, true);
        json_out(['received' => true]);
    }
    $o = in_array($type, ['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.REFUNDED'], true) ? shop_paypal_order_for($r) : null;
    if ($o) {
        $amt = shop_paypal_cents($r['amount']['value'] ?? null); $cur = (string)($r['amount']['currency_code'] ?? '');
        if ($type === 'PAYMENT.CAPTURE.COMPLETED') {
            if (($r['status'] ?? '') === 'COMPLETED' && $cur === 'CAD' && $amt === (int)$o['total'] && (($r['custom_id'] ?? $o['id']) === $o['id'])) shop_mark_paid($o, (string)($r['id'] ?? ''), 'PayPal webhook');
            else error_log('satin paypal webhook: capture does not match order ' . $o['number']);
        } elseif ($type === 'PAYMENT.CAPTURE.DENIED') {
            shop_paypal_note($o, 'PayPal capture denied ' . ($r['id'] ?? ''));
            notify_owner("Satin website: PayPal payment denied for {$o['number']}", "PayPal denied the payment for order {$o['number']} ({$o['name']}, {$o['email']}). The order stays awaiting payment.");
        } else {
            $full = $cur === 'CAD' && $amt >= (int)$o['total'];
            shop_paypal_note($o, 'PayPal refund ' . ($r['id'] ?? '') . ': ' . $cur . ' ' . ($r['amount']['value'] ?? '?') . ($full ? ' (full)' : ' (partial)'));
            if ($full) shop_db()->prepare("UPDATE shop_orders SET status = 'refunded', updated_at = ? WHERE id = ?")->execute([now_iso(), $o['id']]);
            notify_owner("Satin website: PayPal refund for {$o['number']}", "PayPal reported a " . ($full ? 'full' : 'partial') . " refund of $cur " . ($r['amount']['value'] ?? '?') . " for order {$o['number']}.");
        }
    }
    json_out(['received' => true]);
}

/* ---------------- Square Web Payments SDK (card form on our page) ---------------- */
/** Public values only: the page loads Square's card iframes / PayPal buttons with these. */
function shop_public_payment_config(): array {
    $sq = shop_square(); $pp = shop_paypal();
    return ['square' => shop_square_ready($sq) && $sq['applicationId'] !== '' ? ['applicationId' => $sq['applicationId'], 'locationId' => $sq['locationId'], 'environment' => $sq['environment'],
            'sdk' => $sq['environment'] === 'production' ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js', 'afterpay' => $sq['afterpay']] : null,
        'paypal' => shop_paypal_ready($pp) ? ['clientId' => $pp['clientId'], 'environment' => $pp['environment'], 'currency' => 'CAD', 'payLater' => $pp['payLater']] : null];
}
const SHOP_CARD_ERRORS = [
    'CARD_DECLINED' => 'Your card was declined. Try another card or contact your bank.', 'GENERIC_DECLINE' => 'Your card was declined. Try another card or contact your bank.',
    'CVV_FAILURE' => 'The security code (CVV) is incorrect.', 'VERIFY_CVV_FAILURE' => 'The security code (CVV) is incorrect.',
    'ADDRESS_VERIFICATION_FAILURE' => 'The postal code does not match your card. Check it and try again.', 'VERIFY_AVS_FAILURE' => 'The postal code does not match your card. Check it and try again.', 'INVALID_POSTAL_CODE' => 'The postal code does not match your card. Check it and try again.',
    'INSUFFICIENT_FUNDS' => 'The card has insufficient funds. Try another card.', 'CARD_EXPIRED' => 'This card has expired.', 'INVALID_EXPIRATION' => 'The expiry date is not valid.', 'EXPIRATION_FAILURE' => 'The expiry date is not valid.',
    'INVALID_CARD' => 'The card number is not valid.', 'PAN_FAILURE' => 'The card number is not valid.', 'INVALID_CARD_DATA' => 'The card details are not valid.', 'CARD_NOT_SUPPORTED' => 'This card type is not supported. Try another card.',
    'TRANSACTION_LIMIT' => 'This payment exceeds your card limit. Try another card.', 'INVALID_ACCOUNT' => 'This card cannot be used. Try another card.', 'ALLOWABLE_PIN_TRIES_EXCEEDED' => 'This card is locked. Contact your bank.',
    'CARD_DECLINED_VERIFICATION_REQUIRED' => 'Your bank needs to verify this payment. Please try again and complete the verification.', 'CARD_DECLINED_CALL_ISSUER' => 'Your card was declined. Please call your bank.',
    'CARD_TOKEN_EXPIRED' => 'Your card session expired. Please re-enter your card.', 'CARD_TOKEN_USED' => 'Please re-enter your card and try again.', 'TEMPORARY_ERROR' => 'The payment service is busy. Please try again in a moment.',
];
function shop_square_raw(array $c, string $method, string $path, ?array $body): array {
    $base = (string)(cfg('square_api_base') ?: ($c['environment'] === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com'));
    return shop_http($method, $base . $path, ['Authorization: Bearer ' . $c['accessToken'], 'Square-Version: ' . SQUARE_API_VERSION, 'Accept: application/json', 'Content-Type: application/json'], $body === null ? null : json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}
/** Charges the card token for the stored (server-computed) order total. Card numbers never reach this server, only Square's single-use token. */
/** 'Afterpay' when Square says the payment was made with Afterpay / Clearpay, else '' (card / wallet). */
function shop_square_method_label(array $p): string {
    $b = strtoupper((string)($p['buy_now_pay_later_details']['brand'] ?? ''));
    return ($p['source_type'] ?? '') === 'BUY_NOW_PAY_LATER' || in_array($b, ['AFTERPAY', 'CLEARPAY'], true) ? 'Afterpay' : '';
}
/** Buyer-facing / admin label for how an order was paid. */
function shop_pay_method_label(array $o): string {
    $c = (string)($o['card'] ?? '');
    if ($o['provider'] === 'paypal') return $c === 'PayPal Pay Later' ? $c : 'PayPal';
    if ($o['provider'] === 'square' && $c === 'Afterpay') return $c;
    if ($o['provider'] === 'square') return $c !== '' ? 'Card ' . $c : 'Card (Square)';
    return '';
}
function shop_square_charge(array $o, array $v, bool $afterpay = false): array {
    if ($o['status'] !== 'awaiting_payment') return $o;
    shop_limit('sqcard:' . $o['id'], 8, 3600, 'Too many card attempts for this order. Please wait an hour or call 905-695-9147.');
    $c = shop_square();
    $a = json_decode($o['address'], true) ?: [];
    $body = ['source_id' => $v['sourceId'], 'idempotency_key' => $v['idempotencyKey'], 'amount_money' => ['amount' => (int)$o['total'], 'currency' => 'CAD'], 'location_id' => $c['locationId'],
        'reference_id' => $o['id'], 'buyer_email_address' => $o['email'], 'note' => 'Satin Graphic order ' . $o['number'], 'autocomplete' => true];
    if (!empty($v['verificationToken']) && !$afterpay) $body['verification_token'] = $v['verificationToken'];
    if (!empty($a['street1']) && !empty($a['zip'])) $body['billing_address'] = ['address_line_1' => $a['street1'], 'locality' => $a['city'] ?? '', 'administrative_district_level_1' => $a['state'] ?? '', 'postal_code' => $a['zip'], 'country' => 'CA'];
    if ($afterpay && isset($body['billing_address'])) $body['shipping_address'] = $body['billing_address'] + (!empty($a['street2']) ? ['address_line_2' => $a['street2']] : []);
    try { [$code, $j] = shop_square_raw($c, 'POST', '/v2/payments', $body); }
    catch (ShopError $e) { throw new ShopError('We could not reach the payment service. Your card was not charged. Please try again.'); }
    $p = $j['payment'] ?? null;
    if ($code >= 300 || !is_array($p)) {
        $err = $j['errors'][0]['code'] ?? '';
        error_log('satin square card: ' . $o['number'] . ' ' . $err);
        shop_db()->prepare('UPDATE shop_orders SET admin_notes = ?, updated_at = ? WHERE id = ?')->execute([trim($o['admin_notes'] . "\n[payment] " . ($afterpay ? 'Afterpay' : 'Card') . " attempt failed: " . ($err ?: 'HTTP ' . $code)), now_iso(), $o['id']]);
        if ($afterpay) throw new ShopError(in_array($err, ['CARD_TOKEN_EXPIRED', 'CARD_TOKEN_USED'], true) ? 'Your Afterpay session expired. Please choose Afterpay again.' : 'Afterpay did not approve this payment. Nothing was charged. Try card or PayPal instead.');
        throw new ShopError(SHOP_CARD_ERRORS[$err] ?? 'The payment could not be completed. Your card was not charged. Try again or use another card.');
    }
    $amt = (int)($p['amount_money']['amount'] ?? -1);
    $card = shop_square_method_label($p) ?: trim(preg_replace('/[^A-Z_ ]/', '', strtoupper((string)($p['card_details']['card']['card_brand'] ?? ''))) . ' •••• ' . preg_replace('/\D/', '', substr((string)($p['card_details']['card']['last_4'] ?? ''), -4)));
    shop_db()->prepare("UPDATE shop_orders SET provider = 'square', provider_order_id = ?, card = ?, updated_at = ? WHERE id = ?")->execute([(string)($p['order_id'] ?? ''), mb_substr($card, 0, 60), now_iso(), $o['id']]);
    if (in_array($p['status'] ?? '', ['COMPLETED', 'APPROVED'], true) && $amt === (int)$o['total'] && ($p['amount_money']['currency'] ?? '') === 'CAD') shop_mark_paid(shop_order($o['id']), (string)($p['id'] ?? ''), $card === 'Afterpay' ? 'Square · Afterpay' : 'Square card ' . $card);
    elseif (($p['status'] ?? '') === 'PENDING') { /* the webhook completes it */ }
    else throw new ShopError($afterpay ? 'Afterpay did not complete this payment. Nothing was charged.' : 'The payment could not be completed. Your card was not charged.');
    return shop_order($o['id']);
}

/* ---------------- discount codes ---------------- */
function shop_coupon_get(string $code): ?array {
    $code = strtoupper(trim($code));
    if (!preg_match('/^[A-Z0-9_-]{2,40}$/', $code)) return null;
    $q = shop_db()->prepare('SELECT * FROM shop_coupons WHERE code = ? AND deleted = 0'); $q->execute([$code]);
    return $q->fetch() ?: null;
}
/** Order lines for coupon scope checks: [productId, category, net]. */
function shop_coupon_lines(array $items): array {
    $all = cat_products(true); $cats = cat_categories(); $out = [];
    foreach ($items as $i) {
        $p = $all[$i['productId'] ?? ''] ?? (str_starts_with((string)$i['ruleId'], 'template-') ? ['id' => $i['ruleId'], 'path' => '/satin/shop/vehicle-wrap-designs', 'cat' => 'wrap-designs'] : null);
        $out[] = ['product' => (string)($i['productId'] ?? ''), 'category' => $p ? cat_category_of($p, $cats) : '', 'net' => (int)$i['price']['net']];
    }
    return $out;
}
function shop_coupon_used(array $c, ?string $email = null): int {
    $sql = 'SELECT COUNT(*) n FROM shop_coupon_uses WHERE coupon_id = ?'; $p = [$c['id']];
    if ($email !== null) { $sql .= ' AND email = ?'; $p[] = strtolower($email); }
    $q = shop_db()->prepare($sql); $q->execute($p); return (int)$q->fetch()['n'];
}
/** Validates a code for these lines and returns ['code', 'discount' (cents), 'coupon']. Throws ShopError with a customer-friendly reason. */
function shop_coupon_eval(string $code, array $lines, ?string $email, int $subtotal): array {
    $c = shop_coupon_get($code);
    if (!$c || !(int)$c['active']) throw new ShopError('This discount code is not valid.');
    $today = toronto_today();
    if ($c['starts_on'] !== '' && $today < $c['starts_on']) throw new ShopError('This discount code starts on ' . $c['starts_on'] . '.');
    if ($c['ends_on'] !== '' && $today > $c['ends_on']) throw new ShopError('This discount code expired on ' . $c['ends_on'] . '.');
    if ((int)$c['max_uses'] > 0 && shop_coupon_used($c) >= (int)$c['max_uses']) throw new ShopError('This discount code has been fully used.');
    if ($email && (int)$c['max_per_email'] > 0 && shop_coupon_used($c, $email) >= (int)$c['max_per_email']) throw new ShopError('You have already used this discount code.');
    if ((int)$c['min_subtotal'] > 0 && $subtotal < (int)$c['min_subtotal']) throw new ShopError('Spend at least ' . shop_money((int)$c['min_subtotal']) . ' before tax to use this discount code.');
    $ids = json_decode($c['scope_ids'], true) ?: [];
    $eligible = 0;
    foreach ($lines as $l) if ($c['scope'] === 'all' || ($c['scope'] === 'categories' && in_array($l['category'], $ids, true)) || ($c['scope'] === 'products' && in_array($l['product'], $ids, true))) $eligible += $l['net'];
    if ($eligible <= 0) throw new ShopError('This discount code is not valid for the items in your cart.');
    $disc = $c['type'] === 'percent' ? (int)round($eligible * min(100, max(0, (int)$c['value'])) / 100) : min((int)$c['value'], $eligible);
    return ['code' => $c['code'], 'discount' => max(0, $disc), 'coupon' => $c];
}
/** Product-page estimate with a code (rule-based quote, code applied before tax). */
function shop_coupon_quote(array $rule, array $quote, string $code): array {
    $p = shop_product_for_rule($rule['id']);
    $cats = cat_categories();
    $line = ['product' => (string)($p['id'] ?? ''), 'category' => $p ? cat_category_of($p, $cats) : '', 'net' => (int)$quote['net']];
    $r = shop_coupon_eval($code, [$line], null, (int)$quote['net']);
    $net = $quote['net'] - $r['discount'];
    $tax = (int)js_round($net * ($rule['taxPercent'] ?? 13) / 100); $total = $net + $tax;
    $dep = $rule['deposit'] ?? ['type' => 'percent', 'value' => 100];
    $deposit = min($total, $dep['type'] === 'percent' ? (int)js_round($total * $dep['value'] / 100) : (int)js_round($dep['value'] * 100));
    return array_merge($quote, ['discount' => $quote['discount'] + $r['discount'], 'net' => $net, 'tax' => $tax, 'total' => $total, 'deposit' => $deposit, 'balance' => $total - $deposit, 'coupon' => $r['code']]);
}
/** Counts a use once per order (when the order is placed without online payment, or when it is paid). */
function shop_coupon_record(array $o): void {
    if (($o['coupon_code'] ?? '') === '' || (int)($o['discount'] ?? 0) <= 0) return;
    $c = shop_coupon_get($o['coupon_code']); if (!$c) return;
    $pdo = shop_db();
    $q = $pdo->prepare('SELECT 1 FROM shop_coupon_uses WHERE coupon_id = ? AND order_id = ?'); $q->execute([$c['id'], $o['id']]);
    if ($q->fetch()) return;
    $pdo->prepare('INSERT INTO shop_coupon_uses (id,coupon_id,order_id,order_number,email,discount,created_at) VALUES (?,?,?,?,?,?,?)')->execute([uuid(), $c['id'], $o['id'], $o['number'], strtolower($o['email']), (int)$o['discount'], now_iso()]);
}
