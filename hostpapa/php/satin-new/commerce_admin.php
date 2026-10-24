<?php
declare(strict_types=1);
// Admin: online orders, Square payment settings, vehicle templates. Routed from admin_api.php (/api/admin/shop/...).
require_once __DIR__ . '/commerce.php';
require_once __DIR__ . '/print_pdf.php';

function shop_admin_order_row(array $o): array {
    $items = json_decode($o['items'], true) ?: [];
    return ['id' => $o['id'], 'reference' => $o['number'], 'status' => $o['status'], 'name' => $o['name'], 'email' => $o['email'], 'phone' => $o['phone'], 'company' => $o['company'],
        'total' => (int)$o['total'], 'provider' => $o['provider'], 'createdAt' => $o['created_at'], 'paidAt' => $o['paid_at'] ?: null, 'items' => count($items),
        'summary' => mb_substr(implode(', ', array_map(fn($i) => (string)$i['name'], $items)), 0, 160), 'files' => count(json_decode($o['file_ids'], true) ?: []), 'hasLink' => $o['payment_url'] !== '', 'stage' => shop_order_stage($o), 'payMethod' => shop_pay_method_label($o), 'paid' => shop_admin_order_paid($o)];
}
/** True when money was taken for the order (paid now or at some point: refunded / in production…). */
function shop_admin_order_paid(array $o): bool {
    return ($o['paid_at'] ?? '') !== '' || in_array($o['status'], ['paid', 'in_production', 'ready', 'completed', 'refunded'], true);
}
/** Production stage; older orders fall back to the stage implied by their status. */
function shop_order_stage(array $o): string {
    if (isset(SHOP_STAGES[$o['stage'] ?? ''])) return $o['stage'];
    return ['in_production' => 'in_production', 'ready' => 'ready', 'completed' => 'completed', 'cancelled' => 'cancelled', 'refunded' => 'cancelled'][$o['status']] ?? 'new';
}
/** Pages for an item's print-ready PDF: Design Studio 300 DPI rasters, else uploaded PNG/JPG/WebP at the ordered trim + bleed. */
function shop_item_print_pages(array $item): array {
    $pages = []; $studio = [];
    foreach (array_unique(array_merge($item['designFiles'] ?? [], $item['fileIds'] ?? [])) as $id) {
        $f = shop_file((string)$id); if (!$f) continue;
        $m = json_decode((string)($f['meta'] ?? ''), true);
        if (is_array($m) && ($m['role'] ?? '') === 'print') $studio[] = ['file' => $f, 'trimW' => (float)$m['widthIn'], 'trimH' => (float)$m['heightIn'], 'bleed' => (float)$m['bleedIn'], 'label' => (string)$m['side'], 'dpi' => (float)$m['dpi'], 'source' => 'studio'];
    }
    if ($studio) return $studio;
    $sp = $item['spec'] ?? [];
    // Products without a size option: trim size from the product's File Prep template (business cards 3.5 × 2 in, 1/16 in bleed).
    $prep = ['print-business-cards' => [3.5, 2]];
    if (!is_numeric($sp['width'] ?? null) && isset($prep[$item['ruleId'] ?? ''])) [$sp['width'], $sp['height']] = $prep[$item['ruleId']];
    $sized = is_numeric($sp['width'] ?? null) && is_numeric($sp['height'] ?? null);
    $n = 0;
    foreach ($item['fileIds'] ?? [] as $id) {
        $f = shop_file((string)$id);
        if (!$f || $f['kind'] !== 'upload' || !in_array($f['mime'], ['image/png', 'image/jpeg', 'image/webp'], true) || !$f['width']) continue;
        $n++;
        $w = $sized ? (float)$sp['width'] : $f['width'] / 300; $h = $sized ? (float)$sp['height'] : $f['height'] / 300; // Bleed: the product's File Prep template (/print-templates/*.pdf are trim + 1/16 in per side), else the 0.125 in standard.
        $prepBleed = ['print-business-cards' => 0.0625, 'print-flyers' => 0.0625, 'print-postcards' => 0.0625, 'print-door-hangers' => 0.0625, 'print-brochures' => 0.0625][$item['ruleId'] ?? ''] ?? 0.125;
        $b = $sized ? $prepBleed : 0.0;
        if ($sized && ($w > $h) !== ($f['width'] > $f['height']) && abs($w - $h) > 0.01) [$w, $h] = [$h, $w]; // follow the artwork orientation
        $pages[] = ['file' => $f, 'trimW' => $w, 'trimH' => $h, 'bleed' => $b, 'label' => $n === 1 ? 'front' : ($n === 2 ? 'back' : 'page ' . $n), 'dpi' => round(min($f['width'] / ($w + 2 * $b), $f['height'] / ($h + 2 * $b)), 1), 'source' => 'upload'];
    }
    return $pages;
}
function shop_admin_order_full(array $o): array {
    $files = [];
    foreach (json_decode($o['file_ids'], true) ?: [] as $id) { $f = shop_file((string)$id); if ($f) $files[$id] = ['id' => $f['id'], 'name' => $f['name'], 'mime' => $f['mime'], 'size' => (int)$f['size'], 'width' => (int)$f['width'], 'height' => (int)$f['height']]; }
    foreach ($files as $id => $x) {
        $f = shop_file((string)$id); $m = json_decode((string)($f['meta'] ?? ''), true);
        $files[$id] += ['kind' => $f['kind'], 'meta' => is_array($m) ? $m : null];
        if ($f['mime'] === 'application/pdf') { $pf = shop_pdf_facts(shop_file_path($f)); $files[$id]['pdf'] = ['pages' => $pf['pages'], 'widthIn' => $pf['size'] ? round($pf['size'][0], 3) : null, 'heightIn' => $pf['size'] ? round($pf['size'][1], 3) : null]; }
    }
    $items = json_decode($o['items'], true) ?: [];
    foreach ($items as &$it) {
        foreach (array_merge($it['designFiles'] ?? [], $it['fileIds'] ?? []) as $id) if (!isset($files[$id]) && ($f = shop_file((string)$id))) $files[$id] = ['id' => $f['id'], 'name' => $f['name'], 'mime' => $f['mime'], 'size' => (int)$f['size'], 'width' => (int)$f['width'], 'height' => (int)$f['height'], 'kind' => $f['kind'], 'meta' => json_decode((string)($f['meta'] ?? ''), true)];
        $it['printPages'] = array_map(fn($p) => ['label' => $p['label'], 'trimW' => round($p['trimW'], 3), 'trimH' => round($p['trimH'], 3), 'bleed' => round($p['bleed'], 4), 'dpi' => $p['dpi'], 'source' => $p['source'], 'fileId' => $p['file']['id'],
            'cropped' => $p['file']['width'] > 0 && abs($p['file']['width'] / max(1, $p['file']['height']) - ($p['trimW'] + 2 * $p['bleed']) / ($p['trimH'] + 2 * $p['bleed'])) > 0.03 * ($p['trimW'] + 2 * $p['bleed']) / ($p['trimH'] + 2 * $p['bleed'])], shop_item_print_pages($it));
    }
    unset($it);
    return shop_admin_order_row($o) + ['itemsDetail' => $items, 'stages' => SHOP_STAGES, 'history' => json_decode((string)($o['history'] ?? ''), true) ?: [], 'address' => json_decode($o['address'], true), 'billing' => json_decode($o['billing'], true),
        'shipping' => json_decode($o['shipping'], true), 'subtotal' => (int)$o['subtotal'], 'shippingTotal' => (int)$o['shipping_total'], 'tax' => (int)$o['tax'], 'taxRate' => (int)$o['tax_rate'],
        'deposit' => (int)$o['deposit'], 'paymentUrl' => $o['payment_url'], 'paymentId' => $o['payment_id'], 'card' => $o['card'] ?? '', 'coupon' => $o['coupon_code'] ?? '', 'discount' => (int)($o['discount'] ?? 0), 'providerOrderId' => $o['provider_order_id'],
        'customerNotes' => $o['customer_notes'], 'adminNotes' => $o['admin_notes'], 'updatedAt' => $o['updated_at'], 'fileList' => array_values($files)];
}
function shop_hint(string $secret): string { return $secret === '' ? '' : '•••• ' . substr($secret, -4); }
function shop_payments_public(): array {
    $c = shop_square();
    return ['environment' => $c['environment'], 'applicationId' => $c['applicationId'], 'locationId' => $c['locationId'], 'enabled' => $c['enabled'],
        'tokenSet' => $c['accessToken'] !== '', 'tokenHint' => shop_hint($c['accessToken']), 'webhookKeySet' => $c['webhookKey'] !== '', 'webhookKeyHint' => shop_hint($c['webhookKey']),
        'webhookUrl' => shop_webhook_url($c), 'webhookUrlOverride' => $c['webhookUrl'], 'defaultWebhookUrl' => site_url() . '/api/payments/webhook/square',
        'ready' => shop_square_ready($c), 'afterpay' => $c['afterpay'], 'updatedAt' => $c['updatedAt'], 'updatedBy' => $c['updatedBy']];
}
function shop_paypal_public(): array {
    $c = shop_paypal();
    return ['environment' => $c['environment'], 'clientId' => $c['clientId'], 'secretSet' => $c['clientSecret'] !== '', 'secretHint' => shop_hint($c['clientSecret']), 'webhookId' => $c['webhookId'],
        'enabled' => $c['enabled'], 'payLater' => $c['payLater'], 'ready' => shop_paypal_ready($c), 'webhookUrl' => shop_paypal_webhook_url(), 'updatedAt' => $c['updatedAt'], 'updatedBy' => $c['updatedBy']];
}
function shop_admin_coupon(array $c): array {
    $today = toronto_today(); $used = shop_coupon_used($c);
    $state = !(int)$c['active'] ? 'inactive' : ($c['starts_on'] !== '' && $today < $c['starts_on'] ? 'scheduled' : ($c['ends_on'] !== '' && $today > $c['ends_on'] ? 'expired' : ((int)$c['max_uses'] > 0 && $used >= (int)$c['max_uses'] ? 'used up' : 'active')));
    return ['id' => $c['id'], 'code' => $c['code'], 'type' => $c['type'], 'value' => $c['type'] === 'percent' ? (int)$c['value'] : ((int)$c['value']) / 100, 'minSubtotal' => (int)$c['min_subtotal'] ? ((int)$c['min_subtotal']) / 100 : null,
        'startsOn' => $c['starts_on'], 'endsOn' => $c['ends_on'], 'maxUses' => (int)$c['max_uses'] ?: null, 'maxPerEmail' => (int)$c['max_per_email'] ?: null, 'scope' => $c['scope'], 'scopeIds' => json_decode($c['scope_ids'], true) ?: [],
        'active' => (bool)(int)$c['active'], 'note' => $c['note'], 'uses' => $used, 'state' => $state, 'createdAt' => $c['created_at'], 'updatedAt' => $c['updated_at']];
}
function shop_admin_template(array $t): array {
    $f = $t['file_id'] !== '' ? shop_file($t['file_id']) : null; $p = $t['preview_id'] !== '' ? shop_file($t['preview_id']) : null;
    return ['id' => $t['id'], 'ruleId' => $t['rule_id'], 'name' => $t['name'], 'category' => $t['category'], 'make' => $t['make'], 'model' => $t['model'], 'year' => $t['year'],
        'trim' => $t['trim_text'], 'body' => $t['body'], 'description' => $t['description'], 'price' => (int)$t['price'], 'published' => (bool)(int)$t['published'],
        'file' => $f ? ['id' => $f['id'], 'name' => $f['name'], 'size' => (int)$f['size'], 'mime' => $f['mime']] : null,
        'preview' => $p ? ['id' => $p['id'], 'name' => $p['name'], 'url' => '/api/admin/shop/templates/file?id=' . $p['id'] . '&inline=1'] : null,
        'url' => '/satin/shop/products/' . $t['rule_id'], 'updatedAt' => $t['updated_at']];
}

function shop_admin_route(string $r, string $method): void {
    try { shop_admin_inner($r, $method); }
    catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
    json_out(['error' => 'Not found'], 404);
}

function shop_admin_inner(string $r, string $method): void {
    $pdo = shop_db();

    /* ---------- Studio designs (approved / submitted for review in Design Studio) ---------- */
    if ($r === '/shop/designs' && $method === 'GET') {
        require_user('orders.view');
        require_once __DIR__ . '/customer.php';
        $q = $pdo->query("SELECT id, design, customer_id, updated_at FROM shop_designs WHERE design LIKE '%\"approvedAt\"%' ORDER BY updated_at DESC LIMIT 800");
        $cache = []; $out = [];
        $LABEL = ['mockup' => 'Mockup', 'preview' => 'Preview', 'printpdf' => 'Print PDF', 'print' => 'Print file', 'artwork' => 'Artwork SVG', 'source' => 'Editable JSON'];
        foreach ($q->fetchAll() as $row) {
            $d = json_decode((string)$row['design'], true) ?: [];
            $cid = (string)$row['customer_id']; $cu = null;
            if ($cid !== '') { if (!array_key_exists($cid, $cache)) { $a = cust_by('id', $cid); $cache[$cid] = $a ? ['id' => $a['id'], 'name' => $a['name'], 'email' => $a['email'], 'phone' => $a['phone']] : null; } $cu = $cache[$cid]; }
            $files = []; $mock = null;
            foreach ((array)($d['generated'] ?? []) as $g) { if (!is_array($g)) continue; $role = (string)($g['role'] ?? ''); if ($role === 'mockup' && !$mock) $mock = $g['id']; if ($role === 'preview') continue;
                $files[] = ['id' => $g['id'], 'name' => (string)($g['name'] ?? ''), 'role' => $role, 'label' => ($LABEL[$role] ?? 'File') . ($role === 'print' || $role === 'artwork' ? ' ' . (preg_match('/-(driver-side|passenger-side|rear|front|top|front-side|back|side-\d+)/', (string)($g['name'] ?? ''), $m) ? $m[1] : '') : '')]; }
            foreach ((array)($d['originals'] ?? []) as $o) if (is_array($o)) $files[] = ['id' => $o['id'], 'name' => (string)($o['name'] ?? ''), 'role' => 'upload', 'label' => 'Upload'];
            $rule = shop_studio_rule((string)($d['productId'] ?? ''));
            $out[] = ['id' => $row['id'], 'product' => (string)($rule['label'] ?? ($d['productId'] ?? '')), 'vehicle' => trim((string)($d['options']['vehicleModel'] ?? '')), 'glass' => !empty($d['options']['vehicleGlass']),
                'approvedAt' => $d['approvedAt'] ?? null, 'submittedAt' => $d['review']['submittedAt'] ?? null, 'updatedAt' => $row['updated_at'], 'review' => is_array($d['review'] ?? null) ? $d['review'] : null,
                'ref' => (string)($d['review']['ref'] ?? ''), 'customer' => $cu, 'mockup' => $mock, 'files' => $files];
        }
        json_out(['designs' => $out]);
    }
    if ($r === '/shop/designs/file' && $method === 'GET') {
        require_user('orders.view');
        $q = $pdo->prepare('SELECT design FROM shop_designs WHERE id = ?'); $q->execute([(string)($_GET['design'] ?? '')]); $row = $q->fetch();
        $d = $row ? (json_decode((string)$row['design'], true) ?: []) : []; $fid = (string)($_GET['id'] ?? ''); $ok = false;
        foreach (array_merge((array)($d['generated'] ?? []), (array)($d['originals'] ?? [])) as $g) if (is_array($g) && ($g['id'] ?? '') === $fid) $ok = true;
        $f = $ok ? shop_file($fid) : null;
        if (!$f) json_out(['error' => 'File not found'], 404);
        shop_send_file($f, ($_GET['inline'] ?? '') === '1');
    }
    if ($r === '/shop/designs/status' && $method === 'POST') {
        $u = require_user('orders.edit');
        $v = body_json(2000); $id = (string)($v['id'] ?? ''); $st = (string)($v['status'] ?? '');
        if (!in_array($st, ['submitted', 'reviewing', 'quoted', 'approved_customer', 'production', 'done', 'cancelled'], true)) json_out(['error' => 'Choose a valid status'], 400);
        $q = $pdo->prepare('SELECT design FROM shop_designs WHERE id = ?'); $q->execute([$id]); $row = $q->fetch();
        if (!$row) json_out(['error' => 'Design not found'], 404);
        $d = json_decode((string)$row['design'], true) ?: [];
        if (!is_array($d['review'] ?? null)) $d['review'] = ['ref' => 'SG-' . strtoupper(substr(str_replace('-', '', $id), 0, 8)), 'submittedAt' => now_iso()];
        $d['review']['history'] = array_slice(array_merge((array)($d['review']['history'] ?? []), [['at' => now_iso(), 'by' => (string)$u['name'], 'status' => $st]]), -50);
        $d['review']['status'] = $st;
        $pdo->prepare('UPDATE shop_designs SET design = ? WHERE id = ?')->execute([json_encode($d, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $id]);
        audit($u, 'studio design status', ($d['review']['ref'] ?? $id) . ' → ' . $st);
        json_out(['ok' => true]);
    }

    /* ---------- orders ---------- */
    if ($r === '/shop/orders' && $method === 'GET') {
        require_user('orders.view');
        $w = []; $p = [];
        if (isset(SHOP_STATUSES[$_GET['status'] ?? ''])) { $w[] = 'status = ?'; $p[] = $_GET['status']; }
        if (!empty($_GET['q'])) { $s = '%' . text((string)$_GET['q'], 80) . '%'; $w[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ? OR number LIKE ? OR items LIKE ?)'; array_push($p, $s, $s, $s, $s, $s); }
        $q = $pdo->prepare('SELECT * FROM shop_orders ' . ($w ? 'WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY created_at DESC LIMIT 500'); $q->execute($p);
        $rows = array_map('shop_admin_order_row', $q->fetchAll());
        if (isset(SHOP_STAGES[$_GET['stage'] ?? ''])) $rows = array_values(array_filter($rows, fn($x) => $x['stage'] === $_GET['stage']));
        json_out(['orders' => $rows, 'stages' => SHOP_STAGES, 'statuses' => SHOP_STATUSES, 'squareReady' => shop_square_ready(), 'paypalReady' => shop_paypal_ready()]);
    }
    if ($r === '/shop/orders/detail' && $method === 'GET') {
        require_user('orders.view');
        $o = shop_order((string)($_GET['id'] ?? '')); if (!$o) json_out(['error' => 'Order not found'], 404);
        json_out(['order' => shop_admin_order_full($o), 'statuses' => SHOP_STATUSES, 'squareReady' => shop_square_ready()]);
    }
    if ($r === '/shop/orders/update' && $method === 'POST') {
        $u = require_user('orders.edit');
        $v = body_json(16000);
        $o = shop_order((string)($v['id'] ?? '')); if (!$o) json_out(['error' => 'Order not found'], 404);
        $stage = shop_order_stage($o); $newStage = (string)($v['stage'] ?? $stage); $note = text($v['stageNote'] ?? '', 2000);
        if (!isset(SHOP_STAGES[$newStage])) json_out(['error' => 'Choose a valid stage'], 400);
        if ($newStage !== $stage || $note !== '') {
            $emailed = false;
            if (($v['emailCustomer'] ?? false) === true && $o['email'] !== '') {
                $msg = ['new' => 'We have received your order.', 'artwork_check' => 'We are checking your artwork. We will contact you if anything needs to change.', 'in_production' => 'Your order is now in production.', 'ready' => 'Your order is ready.', 'completed' => 'Your order is complete. Thank you for choosing Satin Graphic!', 'cancelled' => 'Your order has been cancelled.'][$newStage];
                $emailed = send_mail($o['email'], "Satin Graphic order {$o['number']}: " . SHOP_STAGES[$newStage], "Hello {$o['name']},\n\n$msg" . ($note !== '' ? "\n\n$note" : '') . "\n\nOrder: {$o['number']}\nQuestions? Reply to info@satingraphic.ca or call 905-695-9147.\n\nSatin Graphic");
            }
            $h = json_decode((string)($o['history'] ?? ''), true) ?: [];
            $h[] = ['at' => now_iso(), 'by' => (string)$u['name'], 'from' => $stage, 'stage' => $newStage, 'note' => $note, 'emailed' => $emailed];
            $pdo->prepare('UPDATE shop_orders SET stage = ?, history = ?, updated_at = ? WHERE id = ?')->execute([$newStage, json_encode(array_slice($h, -200), JSON_UNESCAPED_UNICODE), now_iso(), $o['id']]);
            if ($newStage !== $stage) audit($u, 'order stage', $o['number'] . ' → ' . $newStage . ($emailed ? ' (customer emailed)' : ''));
        }
        if (array_key_exists('adminNotes', $v)) $pdo->prepare('UPDATE shop_orders SET admin_notes = ?, updated_at = ? WHERE id = ?')->execute([text($v['adminNotes'], 5000), now_iso(), $o['id']]);
        if (isset($v['status']) && $v['status'] !== $o['status']) {
            if (!isset(SHOP_STATUSES[$v['status']])) json_out(['error' => 'Choose a valid status'], 400);
            if ($v['status'] === 'paid' && $o['status'] === 'awaiting_payment') shop_mark_paid($o, 'manual:' . $u['name'], 'marked paid by ' . $u['name']);
            else $pdo->prepare('UPDATE shop_orders SET status = ?, updated_at = ? WHERE id = ?')->execute([$v['status'], now_iso(), $o['id']]);
            audit($u, 'order status', $o['number'] . ' → ' . $v['status']);
        }
        json_out(['ok' => true, 'order' => shop_admin_order_full(shop_order($o['id']))]);
    }
    if ($r === '/shop/orders/delete' && $method === 'POST') {
        $u = require_user('orders.edit');
        $v = body_json(2000);
        $o = shop_order((string)($v['id'] ?? '')); if (!$o) json_out(['error' => 'Order not found'], 404);
        // Paid orders (money was taken) need the order number typed back, so they are never removed by a stray click.
        if (shop_admin_order_paid($o) && trim((string)($v['confirm'] ?? '')) !== $o['number']) json_out(['error' => 'Type the order number ' . $o['number'] . ' to delete this paid order.'], 400);
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM shop_coupon_uses WHERE order_id = ?')->execute([$o['id']]);
        $pdo->prepare('DELETE FROM shop_orders WHERE id = ?')->execute([$o['id']]);
        $pdo->commit();
        // Uploaded artwork stays on disk: files can be shared with carts, saved designs and other orders.
        audit($u, 'deleted order', $o['number'] . ' · ' . $o['name'] . ' <' . $o['email'] . '> · ' . number_format(((int)$o['total']) / 100, 2) . ' ' . $o['currency'] . ' · ' . $o['status'] . ($o['payment_id'] !== '' ? ' · payment ' . $o['payment_id'] : ''));
        json_out(['ok' => true]);
    }
    if ($r === '/shop/orders/print-pdf' && $method === 'GET') {
        require_user('orders.view');
        $o = shop_order((string)($_GET['id'] ?? '')); if (!$o) json_out(['error' => 'Order not found'], 404);
        $item = null; $n = 0;
        foreach (json_decode($o['items'], true) ?: [] as $i => $it) if ((string)($it['id'] ?? '') === (string)($_GET['item'] ?? '')) { $item = $it; $n = $i + 1; }
        if (!$item) json_out(['error' => 'Item not found'], 404);
        // Design Studio layered PDF (made in the customer's browser at approval): served as-is, renamed with the order number
        foreach (array_unique(array_merge($item['designFiles'] ?? [], $item['fileIds'] ?? [])) as $fid) {
            $f = shop_file((string)$fid); if (!$f || $f['kind'] !== 'generated' || $f['mime'] !== 'application/pdf') continue;
            $m = json_decode((string)($f['meta'] ?? ''), true); if (($m['role'] ?? '') !== 'printpdf') continue;
            $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string)($item['productId'] ?? 'item'))), '-');
            $name = $o['number'] . "-$n-$slug-print-ready-layered.pdf"; $path = shop_file_path($f);
            header('Content-Type: application/pdf'); header('Content-Length: ' . filesize($path)); header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store');
            header('Content-Disposition: ' . (($_GET['inline'] ?? '') === '1' ? 'inline' : 'attachment') . '; filename="' . $name . '"');
            readfile($path); exit;
        }
        $pages = shop_item_print_pages($item);
        if (!$pages) json_out(['error' => 'This item has no Design Studio or image artwork to convert.'], 404);
        @set_time_limit(120);
        // Design Studio items: CMYK swatches of the design's colours and the customer's mockup as the last page
        $opts = [];
        foreach (array_unique(array_merge($item['designFiles'] ?? [], $item['fileIds'] ?? [])) as $fid) {
            $f = shop_file((string)$fid); if (!$f || $f['kind'] !== 'generated') continue;
            if (substr((string)$f['name'], -21) === '-editable-design.json') { $d = json_decode((string)@file_get_contents(shop_file_path($f)), true); if (is_array($d)) $opts['swatches'] = ppdf_design_swatches($d); }
            elseif (substr((string)$f['name'], -11) === '-mockup.png') $opts['mockup'] = (string)@file_get_contents(shop_file_path($f));
        }
        if (!empty($opts['mockup'])) { $opts['mockupTitle'] = 'Mockup - ' . (string)($item['jobName'] ?? $item['name'] ?? 'Design') . ' - order ' . $o['number']; $opts['mockupLines'] = [trim((string)($item['name'] ?? '') . ' ' . (string)($item['description'] ?? ''))]; }
        try { $pdf = ppdf_build(array_map(fn($p) => ['trimW' => $p['trimW'], 'trimH' => $p['trimH'], 'bleed' => $p['bleed'], 'image' => (string)file_get_contents(shop_file_path($p['file']))], $pages), $o['number'] . ' item ' . $n, $opts); }
        catch (Throwable $e) { json_out(['error' => 'The PDF could not be built: ' . $e->getMessage()], 500); }
        $p0 = $pages[0]; $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string)($item['productId'] ?? 'item')));
        $name = $o['number'] . "-$n-" . trim($slug, '-') . '-' . $p0['trimW'] . 'x' . $p0['trimH'] . 'in-print-ready.pdf';
        header('Content-Type: application/pdf'); header('Content-Length: ' . strlen($pdf)); header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store');
        header('Content-Disposition: ' . (($_GET['inline'] ?? '') === '1' ? 'inline' : 'attachment') . '; filename="' . $name . '"');
        echo $pdf; exit;
    }
    if ($r === '/shop/orders/payment-link' && $method === 'POST') {
        $u = require_user('orders.edit');
        $v = body_json(2000);
        $o = shop_order((string)($v['id'] ?? '')); if (!$o) json_out(['error' => 'Order not found'], 404);
        if ($o['status'] !== 'awaiting_payment') json_out(['error' => 'This order is not awaiting payment.'], 400);
        if ($o['payment_url'] === '' || ($v['recreate'] ?? false) === true) {
            if (!shop_square_ready()) json_out(['error' => 'Connect Square first (Payments page), or collect payment another way and mark the order paid.'], 400);
            $o = shop_square_link($o, site_url() . '/satin/checkout/?payment=' . $o['id'], $o['id'] . '-' . time());
            audit($u, 'order payment link', $o['number']);
        }
        $sent = false;
        if (($v['email'] ?? false) === true) {
            $sent = send_mail($o['email'], "Payment link for your Satin Graphic order {$o['number']}", "Hello {$o['name']},\n\nThank you for your order {$o['number']}.\n\n" . shop_order_text($o) .
                "\n\nPay securely by card here:\n{$o['payment_url']}\n\nQuestions? Reply to info@satingraphic.ca or call 905-695-9147.\n\nSatin Graphic");
            audit($u, 'order payment link emailed', $o['number']);
        }
        json_out(['ok' => true, 'emailed' => $sent, 'order' => shop_admin_order_full($o)]);
    }

    /* ---------- discount codes ---------- */
    if ($r === '/shop/coupons' && $method === 'GET') {
        require_user('pricing.edit');
        $rows = $pdo->query('SELECT * FROM shop_coupons WHERE deleted = 0 ORDER BY created_at DESC')->fetchAll();
        $prods = []; foreach (cat_products() as $p) if (empty($p['_deleted'])) $prods[] = ['id' => $p['id'], 'name' => (string)($p['name'] ?? $p['id'])];
        usort($prods, fn($a, $b) => strcasecmp($a['name'], $b['name']));
        json_out(['coupons' => array_map('shop_admin_coupon', $rows), 'categories' => array_map(fn($c) => ['id' => $c['id'], 'name' => $c['name']], cat_categories()), 'products' => $prods, 'today' => toronto_today()]);
    }
    if ($r === '/shop/coupons/uses' && $method === 'GET') {
        require_user('pricing.edit');
        $q = $pdo->prepare('SELECT order_id orderId, order_number orderNumber, email, discount, created_at createdAt FROM shop_coupon_uses WHERE coupon_id = ? ORDER BY created_at DESC LIMIT 500'); $q->execute([(string)($_GET['id'] ?? '')]);
        json_out(['uses' => $q->fetchAll()]);
    }
    if ($r === '/shop/coupons/save' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(40000); $c = is_array($v['coupon'] ?? null) ? $v['coupon'] : [];
        $code = strtoupper(trim((string)($c['code'] ?? '')));
        if (!preg_match('/^[A-Z0-9_-]{2,40}$/', $code)) json_out(['error' => 'Use 2–40 letters, numbers, - or _ for the code.'], 400);
        $type = ($c['type'] ?? '') === 'fixed' ? 'fixed' : (($c['type'] ?? '') === 'percent' ? 'percent' : '');
        if (!$type) json_out(['error' => 'Choose percent or fixed amount.'], 400);
        $val = is_numeric($c['value'] ?? null) ? (float)$c['value'] : -1;
        if ($type === 'percent' && ($val <= 0 || $val > 100 || floor($val) != $val)) json_out(['error' => 'Percent must be a whole number from 1 to 100.'], 400);
        if ($type === 'fixed' && ($val <= 0 || $val > 100000)) json_out(['error' => 'Enter an amount between $0.01 and $100,000.'], 400);
        $value = $type === 'percent' ? (int)$val : (int)round($val * 100);
        $min = is_numeric($c['minSubtotal'] ?? null) && (float)$c['minSubtotal'] > 0 ? (int)round((float)$c['minSubtotal'] * 100) : 0;
        $d = fn($x) => is_string($x) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $x) ? $x : '';
        $start = $d($c['startsOn'] ?? ''); $end = $d($c['endsOn'] ?? '');
        if ($start && $end && $end < $start) json_out(['error' => 'The end date is before the start date.'], 400);
        $int = fn($x) => is_numeric($x) && (int)$x > 0 ? min(1000000, (int)$x) : 0;
        $scope = in_array($c['scope'] ?? 'all', ['all', 'categories', 'products'], true) ? $c['scope'] : 'all';
        $ids = $scope === 'all' ? [] : array_values(array_unique(array_filter(array_map('strval', (array)($c['scopeIds'] ?? [])), fn($x) => preg_match('/^[a-z0-9_-]{1,80}$/i', $x))));
        if ($scope !== 'all' && !$ids) json_out(['error' => 'Choose at least one ' . ($scope === 'categories' ? 'category' : 'product') . '.'], 400);
        $id = (string)($c['id'] ?? '');
        $q = $pdo->prepare('SELECT id FROM shop_coupons WHERE code = ? AND deleted = 0 AND id != ?'); $q->execute([$code, $id]);
        if ($q->fetch()) json_out(['error' => 'Another coupon already uses this code.'], 409);
        $vals = [$code, $type, $value, $min, $start, $end, $int($c['maxUses'] ?? 0), $int($c['maxPerEmail'] ?? 0), $scope, json_encode(array_slice($ids, 0, 500)), ($c['active'] ?? true) === false ? 0 : 1, text($c['note'] ?? '', 1000), now_iso()];
        if ($id !== '') {
            $q = $pdo->prepare('UPDATE shop_coupons SET code=?, type=?, value=?, min_subtotal=?, starts_on=?, ends_on=?, max_uses=?, max_per_email=?, scope=?, scope_ids=?, active=?, note=?, updated_at=? WHERE id = ? AND deleted = 0'); $q->execute(array_merge($vals, [$id]));
            if (!$q->rowCount()) json_out(['error' => 'Coupon not found'], 404);
        } else { $id = uuid(); $pdo->prepare('INSERT INTO shop_coupons (code,type,value,min_subtotal,starts_on,ends_on,max_uses,max_per_email,scope,scope_ids,active,note,updated_at,id,deleted,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)')->execute(array_merge($vals, [$id, now_iso()])); }
        audit($u, 'coupon saved', $code);
        $q = $pdo->prepare('SELECT * FROM shop_coupons WHERE id = ?'); $q->execute([$id]);
        json_out(['ok' => true, 'coupon' => shop_admin_coupon($q->fetch())]);
    }
    if ($r === '/shop/coupons/delete' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(2000);
        $q = $pdo->prepare('UPDATE shop_coupons SET deleted = 1, active = 0, updated_at = ? WHERE id = ?'); $q->execute([now_iso(), (string)($v['id'] ?? '')]);
        if (!$q->rowCount()) json_out(['error' => 'Coupon not found'], 404);
        audit($u, 'coupon deleted', (string)$v['id']);
        json_out(['ok' => true]);
    }

    /* ---------- payments (Square) ---------- */
    if ($r === '/shop/payments' && $method === 'GET') { require_user('payments.manage'); json_out(['square' => shop_payments_public(), 'paypal' => shop_paypal_public()]); }
    if ($r === '/shop/payments/paypal' && $method === 'POST') {
        $u = require_user('payments.manage');
        $v = body_json(8000);
        $c = shop_paypal();
        $env = $v['environment'] ?? $c['environment'];
        if (!in_array($env, ['sandbox', 'live'], true)) json_out(['error' => 'Choose sandbox or live.'], 400);
        $id = trim((string)($v['clientId'] ?? $c['clientId'])); $hook = trim((string)($v['webhookId'] ?? $c['webhookId']));
        if (!preg_match('/^[A-Za-z0-9_-]{0,200}$/', $id)) json_out(['error' => 'Check the client ID.'], 400);
        if (!preg_match('/^[A-Za-z0-9_-]{0,64}$/', $hook)) json_out(['error' => 'Check the webhook ID.'], 400);
        $sec = $c['clientSecret'];
        if (is_string($v['clientSecret'] ?? null) && trim($v['clientSecret']) !== '') { $sec = trim($v['clientSecret']); if (!preg_match('/^[A-Za-z0-9_-]{20,200}$/', $sec)) json_out(['error' => 'The client secret does not look right. Copy it again from the PayPal developer dashboard.'], 400); }
        if (($v['clearSecret'] ?? false) === true) $sec = '';
        shop_setting_set('shop.paypal', ['environment' => $env, 'clientId' => $id, 'clientSecret' => $sec, 'webhookId' => $hook, 'enabled' => ($v['enabled'] ?? $c['enabled']) !== false, 'payLater' => ($v['payLater'] ?? $c['payLater']) !== false, 'updatedAt' => now_iso(), 'updatedBy' => $u['name']]);
        audit($u, 'payment settings', "PayPal $env" . ($sec !== $c['clientSecret'] ? ', secret changed' : '') . ($hook !== $c['webhookId'] ? ', webhook changed' : ''));
        json_out(['ok' => true, 'paypal' => shop_paypal_public()]);
    }
    if ($r === '/shop/payments/paypal/test' && $method === 'POST') {
        $u = require_user('payments.manage');
        if (rate_limited('pptest:' . $u['id'], 10, 600)) json_out(['error' => 'Too many tests. Wait a few minutes.'], 429);
        note_attempt('pptest:' . $u['id']);
        $c = shop_paypal();
        if ($c['clientId'] === '' || $c['clientSecret'] === '') json_out(['error' => 'Save the client ID and secret first.'], 400);
        try { shop_paypal_token($c); } catch (ShopError $e) { json_out(['ok' => false, 'error' => $e->getMessage()]); }
        json_out(['ok' => true, 'environment' => $c['environment'], 'webhookIdSet' => $c['webhookId'] !== '']);
    }
    if ($r === '/shop/payments' && $method === 'POST') {
        $u = require_user('payments.manage');
        $v = body_json(8000);
        $c = shop_square();
        $env = $v['environment'] ?? $c['environment'];
        if (!in_array($env, ['sandbox', 'production'], true)) json_out(['error' => 'Choose sandbox or production.'], 400);
        $app = trim((string)($v['applicationId'] ?? $c['applicationId'])); $loc = trim((string)($v['locationId'] ?? $c['locationId']));
        if (!preg_match('/^[A-Za-z0-9_.-]{0,100}$/', $app)) json_out(['error' => 'Check the application ID.'], 400);
        if (!preg_match('/^[A-Za-z0-9]{0,64}$/', $loc)) json_out(['error' => 'Check the location ID.'], 400);
        $tok = $c['accessToken']; $key = $c['webhookKey'];
        if (is_string($v['accessToken'] ?? null) && trim($v['accessToken']) !== '') { $tok = trim($v['accessToken']); if (!preg_match('/^[A-Za-z0-9_.-]{20,400}$/', $tok)) json_out(['error' => 'The access token does not look right. Copy it again from the Square Developer dashboard.'], 400); }
        if (($v['clearToken'] ?? false) === true) $tok = '';
        if (is_string($v['webhookKey'] ?? null) && trim($v['webhookKey']) !== '') { $key = trim($v['webhookKey']); if (!preg_match('/^[A-Za-z0-9_.+\/=-]{10,200}$/', $key)) json_out(['error' => 'The webhook signature key does not look right.'], 400); }
        if (($v['clearWebhookKey'] ?? false) === true) $key = '';
        $hook = trim((string)($v['webhookUrl'] ?? $c['webhookUrl']));
        if ($hook !== '' && (!preg_match('#^https://[^\s"\'<>]{4,300}$#', $hook))) json_out(['error' => 'The webhook URL must start with https://'], 400);
        shop_setting_set('shop.square', ['environment' => $env, 'applicationId' => $app, 'locationId' => $loc, 'accessToken' => $tok, 'webhookKey' => $key, 'webhookUrl' => $hook,
            'enabled' => ($v['enabled'] ?? $c['enabled']) !== false, 'afterpay' => ($v['afterpay'] ?? $c['afterpay']) !== false, 'updatedAt' => now_iso(), 'updatedBy' => $u['name']]);
        audit($u, 'payment settings', "Square $env, location $loc" . ($tok !== $c['accessToken'] ? ', token changed' : '') . ($key !== $c['webhookKey'] ? ', webhook key changed' : ''));
        json_out(['ok' => true, 'square' => shop_payments_public()]);
    }
    if ($r === '/shop/payments/test' && $method === 'POST') {
        $u = require_user('payments.manage');
        if (rate_limited('sqtest:' . $u['id'], 10, 600)) json_out(['error' => 'Too many tests. Wait a few minutes.'], 429);
        note_attempt('sqtest:' . $u['id']);
        $c = shop_square();
        if ($c['accessToken'] === '') json_out(['error' => 'Save an access token first.'], 400);
        try { $d = shop_square_call($c, 'GET', '/v2/locations'); }
        catch (ShopError $e) { json_out(['ok' => false, 'error' => $e->getMessage()], 200); }
        $locs = array_map(fn($l) => ['id' => (string)($l['id'] ?? ''), 'name' => (string)($l['name'] ?? ''), 'status' => (string)($l['status'] ?? ''), 'currency' => (string)($l['currency'] ?? '')], $d['locations'] ?? []);
        $found = false; foreach ($locs as $l) if ($l['id'] === $c['locationId']) $found = true;
        json_out(['ok' => true, 'environment' => $c['environment'], 'locations' => $locs, 'locationFound' => $found]);
    }

    /* ---------- templates ---------- */
    if ($r === '/shop/templates' && $method === 'GET') {
        $u = require_user('pricing.edit');
        $rows = $pdo->query('SELECT * FROM shop_templates WHERE deleted = 0 ORDER BY updated_at DESC')->fetchAll();
        $req = null;
        if (in_array('requests.view', $u['permissions'], true)) {
            $q = $pdo->prepare("SELECT * FROM service_requests WHERE service = ? ORDER BY created_at DESC LIMIT 200"); $q->execute(['Vehicle template request']);
            $req = array_map(function ($x) { $d = json_decode($x['details'] ?? '', true) ?: []; return ['id' => $x['id'], 'reference' => 'SG-' . strtoupper(substr($x['id'], 0, 8)), 'name' => $x['name'], 'email' => $x['email'], 'phone' => $x['phone'], 'status' => $x['status'], 'createdAt' => $x['created_at'], 'details' => implode(' · ', array_values($d['custom'] ?? [])), 'notes' => (string)($d['notes'] ?? '')]; }, $q->fetchAll());
        }
        json_out(['templates' => array_map('shop_admin_template', $rows), 'categories' => SHOP_TEMPLATE_CATEGORIES, 'requests' => $req, 'uploadLimit' => ini_get('upload_max_filesize'), 'postLimit' => ini_get('post_max_size')]);
    }
    if ($r === '/shop/templates/file' && $method === 'GET') {
        require_user('pricing.edit');
        $f = shop_file((string)($_GET['id'] ?? ''));
        if (!$f || !in_array($f['kind'], ['template', 'preview'], true)) json_out(['error' => 'File not found'], 404);
        shop_send_file($f, ($_GET['inline'] ?? '') === '1');
    }
    if ($r === '/shop/templates/upload' && $method === 'POST') {
        $u = require_user('pricing.edit');
        if (empty($_FILES['file'])) json_out(['error' => (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 ? 'The file is larger than this server accepts (' . ini_get('post_max_size') . '). Ask the host to raise upload_max_filesize / post_max_size.' : 'Choose a file.'], 400);
        $kind = ($_POST['kind'] ?? '') === 'preview' ? 'preview' : 'template';
        $design = ($_POST['kind'] ?? '') === 'design'; // wrap design delivery file (Admin → Products): also accepts a ZIP package
        $row = $kind === 'preview'
            ? shop_store_upload($_FILES['file'], 'preview', 'admin:' . $u['id'], SHOP_PREVIEW_MAX, ['image/png', 'image/jpeg', 'image/webp'])
            : shop_store_upload($_FILES['file'], 'template', 'admin:' . $u['id'], SHOP_TEMPLATE_MAX, array_merge(['application/pdf', 'application/postscript', 'image/svg+xml'], $design ? ['application/zip'] : []), true);
        json_out(['file' => ['id' => $row['id'], 'name' => $row['name'], 'size' => $row['size'], 'mime' => $row['mime']]], 201);
    }
    if ($r === '/shop/templates/save' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(20000);
        $t = is_array($v['template'] ?? null) ? $v['template'] : [];
        $old = null;
        if (!empty($t['id'])) { $q = $pdo->prepare('SELECT * FROM shop_templates WHERE id = ? AND deleted = 0'); $q->execute([(string)$t['id']]); $old = $q->fetch(); if (!$old) json_out(['error' => 'Template not found'], 404); }
        $name = text($t['name'] ?? '', 120); $make = text($t['make'] ?? '', 80); $model = text($t['model'] ?? '', 80); $year = text($t['year'] ?? '', 20);
        if (mb_strlen($name) < 2) json_out(['error' => 'Give the template a name.'], 400);
        if (!in_array($t['category'] ?? '', SHOP_TEMPLATE_CATEGORIES, true)) json_out(['error' => 'Choose a category.'], 400);
        if ($year !== '' && !preg_match('/^\d{4}(\s*[-–]\s*\d{4})?$/u', $year)) json_out(['error' => 'Year must look like 2022 or 2015-2024.'], 400);
        $price = is_numeric($t['price'] ?? null) ? (int)round((float)$t['price'] * 100) : -1;
        if ($price < 0 || $price > 10000000) json_out(['error' => 'Enter a price between $0 and $100,000.'], 400);
        $fileId = (string)($t['fileId'] ?? ($old['file_id'] ?? '')); $previewId = (string)($t['previewId'] ?? ($old['preview_id'] ?? ''));
        if ($fileId !== '') { $f = shop_file($fileId); if (!$f || $f['kind'] !== 'template') json_out(['error' => 'Upload the template file again.'], 400); }
        if ($previewId !== '') { $f = shop_file($previewId); if (!$f || $f['kind'] !== 'preview') json_out(['error' => 'Upload the preview image again.'], 400); }
        $published = ($t['published'] ?? false) === true;
        if ($published && $fileId === '') json_out(['error' => 'Upload the vector file before publishing.'], 400);
        if ($published && $price <= 0) json_out(['error' => 'Set a price before publishing.'], 400);
        $vals = [$name, $t['category'], $make, $model, $year, text($t['trim'] ?? '', 120), text($t['body'] ?? '', 120), text($t['description'] ?? '', 2000), $price, $fileId, $previewId, $published ? 1 : 0, now_iso()];
        if ($old) {
            $pdo->prepare('UPDATE shop_templates SET name=?, category=?, make=?, model=?, year=?, trim_text=?, body=?, description=?, price=?, file_id=?, preview_id=?, published=?, updated_at=?, revision = revision + 1 WHERE id = ?')->execute(array_merge($vals, [$old['id']]));
            $id = $old['id'];
        } else {
            $id = uuid();
            do { $rid = 'template-' . bin2hex(random_bytes(4)); $q = $pdo->prepare('SELECT 1 FROM shop_templates WHERE rule_id = ?'); $q->execute([$rid]); } while ($q->fetch());
            $pdo->prepare('INSERT INTO shop_templates (name,category,make,model,year,trim_text,body,description,price,file_id,preview_id,published,updated_at,id,rule_id,deleted,revision,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?)')->execute(array_merge($vals, [$id, $rid, now_iso()]));
        }
        audit($u, 'template saved', "$name · " . ($published ? 'published' : 'hidden'));
        $q = $pdo->prepare('SELECT * FROM shop_templates WHERE id = ?'); $q->execute([$id]);
        json_out(['ok' => true, 'template' => shop_admin_template($q->fetch())]);
    }
    if ($r === '/shop/templates/delete' && $method === 'POST') {
        $u = require_user('pricing.edit');
        $v = body_json(2000);
        // Kept in the database (hidden) so paid orders can still be downloaded.
        $q = $pdo->prepare('UPDATE shop_templates SET deleted = 1, published = 0, updated_at = ? WHERE id = ?'); $q->execute([now_iso(), (string)($v['id'] ?? '')]);
        if (!$q->rowCount()) json_out(['error' => 'Template not found'], 404);
        audit($u, 'template deleted', (string)$v['id']);
        json_out(['ok' => true]);
    }
}
