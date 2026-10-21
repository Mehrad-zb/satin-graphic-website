<?php
declare(strict_types=1);
// Price quotes (estimates): prepared in the admin, sent to the customer as a link, accepted or declined online,
// and turned into an invoice on acceptance. Money is stored in cents, like invoices. Needs invoices_api.php.

function migrate_quotes(PDO $pdo): void {
    static $done = false; if ($done) return; $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, number INTEGER, number_text TEXT NOT NULL, status TEXT NOT NULL, customer_id TEXT, customer TEXT NOT NULL, title TEXT NOT NULL DEFAULT \'\', issue_date TEXT NOT NULL, valid_until TEXT NOT NULL,
        items TEXT NOT NULL, discount TEXT NOT NULL DEFAULT \'{}\', notes TEXT NOT NULL DEFAULT \'\', terms TEXT NOT NULL DEFAULT \'\', subtotal INTEGER NOT NULL DEFAULT 0, discount_total INTEGER NOT NULL DEFAULT 0, tax_total INTEGER NOT NULL DEFAULT 0, taxes TEXT NOT NULL DEFAULT \'[]\', total INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT \'CAD\', business TEXT NOT NULL DEFAULT \'{}\', token TEXT NOT NULL, invoice_id TEXT, request_id TEXT, sent_at TEXT, viewed_at TEXT, accepted_at TEXT, accepted_name TEXT NOT NULL DEFAULT \'\', accepted_ip TEXT NOT NULL DEFAULT \'\',
        declined_at TEXT, decline_reason TEXT NOT NULL DEFAULT \'\', created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_quotes_issue ON quotes (issue_date)');
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_token ON quotes (token)');
}
function qdb(): PDO { $p = idb(); migrate_quotes($p); return $p; }

const Q_STATUS_LABELS = ['draft' => 'Draft', 'sent' => 'Sent', 'accepted' => 'Accepted', 'declined' => 'Declined', 'invoiced' => 'Invoiced', 'expired' => 'Expired'];

function q_settings(): array {
    $q = qdb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute(['quote.settings']); $r = $q->fetch();
    $s = $r ? (json_decode($r['v'], true) ?: []) : [];
    return array_replace(['prefix' => '', 'nextNumber' => 72, 'pad' => 7, 'validDays' => 30, 'autoInvoice' => true,
        'notes' => 'Thank you for the opportunity to quote on your project.',
        'terms' => "This quote is valid until the date shown. Prices include materials, design and installation unless stated otherwise. A deposit is required to book your project.",
        'emailMessage' => "Hi {name},\n\nThank you for your interest. Please find your price quote {number} for {total} below. You can review it and accept it online — it is valid until {valid}.\n\nThank you,\nSatin Graphic"], $s);
}
function q_settings_save(array $s): void {
    $pdo = qdb();
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute(['quote.settings']);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute(['quote.settings', json_encode($s, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), now_iso()]);
}
function q_status(array $r): string {
    if ($r['status'] === 'sent' && $r['valid_until'] !== '' && $r['valid_until'] < toronto_today()) return 'expired';
    return $r['status'];
}
function q_get(string $id): array { $q = qdb()->prepare('SELECT * FROM quotes WHERE id = ?'); $q->execute([$id]); $r = $q->fetch(); if (!$r) json_out(['error' => 'Quote not found'], 404); return $r; }
function q_by_token(string $t): array {
    if (!preg_match('/^[A-Za-z0-9_-]{20,80}$/', $t)) json_out(['error' => 'This quote link is not valid.'], 404);
    $q = qdb()->prepare('SELECT * FROM quotes WHERE token = ?'); $q->execute([$t]); $r = $q->fetch();
    if (!$r || $r['status'] === 'draft') json_out(['error' => 'This quote is not available. Please contact us for an updated quote.'], 404);
    return $r;
}
function q_public_url(array $r): string { return site_url() . '/quote/?t=' . $r['token']; }
function q_inv_number(?string $id): string { if (!$id) return ''; $q = qdb()->prepare('SELECT number_text FROM invoices WHERE id = ?'); $q->execute([$id]); return (string)($q->fetch()['number_text'] ?? ''); }
function q_row(array $r, bool $full = false): array {
    $o = ['id' => $r['id'], 'kind' => 'quote', 'number' => $r['number_text'], 'status' => q_status($r), 'baseStatus' => $r['status'], 'customer' => json_decode($r['customer'], true) ?: [], 'customerId' => $r['customer_id'], 'title' => $r['title'],
        'issueDate' => $r['issue_date'], 'validUntil' => $r['valid_until'], 'total' => (int)$r['total'], 'currency' => $r['currency'], 'sentAt' => $r['sent_at'], 'viewedAt' => $r['viewed_at'], 'acceptedAt' => $r['accepted_at'], 'acceptedName' => $r['accepted_name'],
        'declinedAt' => $r['declined_at'], 'declineReason' => $r['decline_reason'], 'invoiceId' => $r['invoice_id'], 'invoiceNumber' => q_inv_number($r['invoice_id']), 'updatedAt' => $r['updated_at'], 'createdAt' => $r['created_at']];
    if ($full) $o += ['items' => json_decode($r['items'], true) ?: [], 'discount' => json_decode($r['discount'], true) ?: (object)[], 'notes' => $r['notes'], 'terms' => $r['terms'], 'business' => json_decode($r['business'], true) ?: [],
        'subtotal' => (int)$r['subtotal'], 'discountTotal' => (int)$r['discount_total'], 'taxTotal' => (int)$r['tax_total'], 'taxes' => json_decode($r['taxes'], true) ?: [], 'requestId' => $r['request_id'], 'createdBy' => $r['created_by']];
    return $o;
}
function q_public(array $r): array {
    $o = q_row($r, true);
    unset($o['id'], $o['customerId'], $o['requestId'], $o['createdBy'], $o['baseStatus'], $o['invoiceId']);
    $o['statusLabel'] = $o['status'] === 'invoiced' ? 'Accepted' : (Q_STATUS_LABELS[$o['status']] ?? $o['status']);
    $o['canRespond'] = $o['status'] === 'sent';
    $o['invoiceOnAccept'] = (bool)q_settings()['autoInvoice'];
    $o['invoiceUrl'] = '';
    if ($r['invoice_id']) { $q = qdb()->prepare('SELECT token, status FROM invoices WHERE id = ?'); $q->execute([$r['invoice_id']]); $i = $q->fetch(); if ($i && $i['status'] !== 'draft' && $i['status'] !== 'void') $o['invoiceUrl'] = site_url() . '/invoice/?t=' . $i['token']; }
    return $o;
}

function q_mail_html(array $r, string $intro, string $button, string $url): string {
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $b = json_decode($r['business'], true) ?: inv_settings()['business'];
    return '<!doctype html><html><body style="margin:0;background:#eceef2;font-family:Arial,Helvetica,sans-serif;color:#16181d"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border-collapse:separate"><tr><td style="padding:28px">'
        . '<p style="margin:0 0 4px;font-size:13px;color:#6b7280">' . $e($b['name'] ?? '') . '</p><h1 style="margin:0 0 16px;font-size:22px">Price quote #' . $e($r['number_text']) . '</h1>'
        . '<div style="font-size:14px;line-height:1.55;white-space:pre-line;margin-bottom:18px">' . $e($intro) . '</div>'
        . '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">' . ($r['title'] !== '' ? '<tr><td style="padding:4px 0;color:#6b7280">Project</td><td style="padding:4px 0;text-align:right">' . $e($r['title']) . '</td></tr>' : '')
        . '<tr><td style="padding:6px 0;font-weight:700;border-top:1px solid #e5e7eb">Quote total</td><td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #e5e7eb">' . $e(money_fmt((int)$r['total'], $r['currency'])) . '</td></tr>'
        . '<tr><td style="padding:4px 0;color:#6b7280">Valid until</td><td style="padding:4px 0;text-align:right">' . $e(date('M j, Y', strtotime($r['valid_until']))) . '</td></tr></table>'
        . '<p style="margin:24px 0 8px"><a href="' . $e($url) . '" style="display:inline-block;background:#c91c50;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700">' . $e($button) . '</a></p>'
        . '<p style="margin:18px 0 0;font-size:12px;color:#6b7280">' . $e($b['name'] ?? '') . ' · ' . $e($b['phone'] ?? '') . ' · ' . $e($b['email'] ?? '') . '</p></td></tr></table></td></tr></table></body></html>';
}
function q_send_mail(array $r, string $to, string $msg): bool {
    $c = json_decode($r['customer'], true) ?: []; $set = inv_settings();
    $intro = strtr($msg, ['{name}' => $c['name'] ?? '', '{number}' => '#' . $r['number_text'], '{total}' => money_fmt((int)$r['total'], $r['currency']), '{valid}' => date('M j, Y', strtotime($r['valid_until']))]);
    $url = q_public_url($r);
    $text = $intro . "\n\nQuote total: " . money_fmt((int)$r['total'], $r['currency']) . "\nValid until: " . date('M j, Y', strtotime($r['valid_until'])) . "\n\nReview and accept your quote online:\n" . $url . "\n\n" . $set['business']['name'] . "\n" . $set['business']['phone'] . ' · ' . $set['business']['email'];
    return inv_mail($to, 'Price quote #' . $r['number_text'] . ' from ' . $set['business']['name'], $text, q_mail_html($r, $intro, 'Review & accept quote', $url), $set);
}

/** Creates an invoice from the quote (same customer, items, discount and taxes). Returns the invoice row. */
function q_make_invoice(array $r, string $by, bool $send): array {
    $pdo = qdb(); $set = inv_settings(); $now = now_iso(); $today = toronto_today();
    if ($r['invoice_id']) { $q = $pdo->prepare('SELECT * FROM invoices WHERE id = ?'); $q->execute([$r['invoice_id']]); if ($x = $q->fetch()) return $x; }
    $pdo->beginTransaction();
    $num = (int)$set['nextNumber']; $max = (int)($pdo->query('SELECT MAX(number) m FROM invoices')->fetch()['m'] ?? 0); if ($max >= $num) $num = $max + 1;
    $set['nextNumber'] = $num + 1; inv_settings_save($set);
    $id = uuid();
    $f = ['id' => $id, 'number' => $num, 'number_text' => $set['prefix'] . str_pad((string)$num, (int)$set['pad'], '0', STR_PAD_LEFT), 'status' => $send ? 'sent' : 'draft', 'customer_id' => $r['customer_id'], 'customer' => $r['customer'],
        'title' => $r['title'] !== '' ? $r['title'] : 'Quote #' . $r['number_text'], 'issue_date' => $today, 'due_date' => date('Y-m-d', strtotime("$today +" . (int)$set['dueDays'] . ' days')), 'sales_rep' => '', 'items' => $r['items'], 'discount' => $r['discount'], 'deposit' => '{}',
        'notes' => $set['notes'], 'terms' => $set['terms'], 'subtotal' => (int)$r['subtotal'], 'discount_total' => (int)$r['discount_total'], 'tax_total' => (int)$r['tax_total'], 'taxes' => $r['taxes'], 'total' => (int)$r['total'],
        'currency' => $r['currency'], 'business' => json_encode($set['business'], JSON_UNESCAPED_UNICODE), 'token' => token(), 'request_id' => $r['request_id'], 'created_by' => $by, 'created_at' => $now, 'updated_at' => $now];
    if ($send) $f['sent_at'] = $now;
    $pdo->prepare('INSERT INTO invoices (' . implode(',', array_keys($f)) . ') VALUES (' . implode(',', array_fill(0, count($f), '?')) . ')')->execute(array_values($f));
    $pdo->prepare("UPDATE quotes SET status = 'invoiced', invoice_id = ?, updated_at = ? WHERE id = ?")->execute([$id, $now, $r['id']]);
    $pdo->commit();
    return inv_get($id);
}
function q_fields_from_input(array $v, array $set): array {
    $c = is_array($v['customer'] ?? null) ? $v['customer'] : [];
    $cust = ['name' => s($c['name'] ?? '', 160), 'company' => s($c['company'] ?? '', 160), 'email' => strtolower(s($c['email'] ?? '', 254)), 'phone' => s($c['phone'] ?? '', 40), 'address' => s($c['address'] ?? '', 500)];
    if (mb_strlen($cust['name']) < 2) json_out(['error' => 'Add the customer name.'], 400);
    if ($cust['email'] !== '' && !filter_var($cust['email'], FILTER_VALIDATE_EMAIL)) json_out(['error' => 'The customer email is not valid.'], 400);
    $taxIds = array_column($set['taxes'], 'id'); $items = [];
    foreach (array_slice(is_array($v['items'] ?? null) ? $v['items'] : [], 0, 100) as $it) {
        if (!is_array($it)) continue;
        $name = s($it['name'] ?? '', 200); $desc = s($it['description'] ?? '', 2000); $qty = is_numeric($it['qty'] ?? null) ? round((float)$it['qty'], 3) : 1; $price = cents($it['price'] ?? 0);
        if ($name === '' && $desc === '' && $price === 0) continue;
        if ($qty < 0 || $qty > 1000000 || abs($price) > 100000000) json_out(['error' => 'Check the quantity and price of “' . $name . '”.'], 400);
        $items[] = ['name' => $name ?: 'Item', 'description' => $desc, 'qty' => $qty, 'price' => $price, 'taxes' => array_values(array_intersect(is_array($it['taxes'] ?? null) ? $it['taxes'] : [], $taxIds))];
    }
    if (!$items) json_out(['error' => 'Add at least one product or service.'], 400);
    $dv = is_array($v['discount'] ?? null) ? $v['discount'] : [];
    $discount = in_array($dv['type'] ?? '', ['percent', 'amount'], true) && is_numeric($dv['value'] ?? null) && (float)$dv['value'] > 0 ? ['type' => $dv['type'], 'value' => round((float)$dv['value'], 2)] : [];
    $calc = inv_calc($items, $discount, $set['taxes']);
    $issue = vdate($v['issueDate'] ?? '', toronto_today());
    $valid = vdate($v['validUntil'] ?? '', date('Y-m-d', strtotime("$issue +30 days")));
    if ($valid < $issue) json_out(['error' => 'The “valid until” date is before the issue date.'], 400);
    return [$cust, ['title' => s($v['title'] ?? '', 200), 'issue_date' => $issue, 'valid_until' => $valid, 'items' => json_encode($items, JSON_UNESCAPED_UNICODE), 'discount' => json_encode((object)$discount),
        'notes' => s($v['notes'] ?? '', 3000), 'terms' => s($v['terms'] ?? '', 3000), 'subtotal' => $calc['subtotal'], 'discount_total' => $calc['discount'], 'tax_total' => $calc['tax'], 'taxes' => json_encode($calc['taxes'], JSON_UNESCAPED_UNICODE), 'total' => $calc['total']], $items];
}

function quotes_route(string $r, string $method): void {
    $pdo = qdb();
    if ($r === '/quotes' && $method === 'GET') {
        require_user('invoices.view');
        $list = array_map('q_row', $pdo->query('SELECT * FROM quotes ORDER BY COALESCE(number,0) DESC, created_at DESC LIMIT 3000')->fetchAll());
        $days = max(1, min(3650, (int)($_GET['days'] ?? 30))); $since = date('Y-m-d', strtotime(toronto_today() . " -$days days"));
        $recent = array_filter($list, fn($x) => $x['issueDate'] >= $since);
        json_out(['quotes' => $list, 'counts' => array_count_values(array_column($list, 'status')), 'overview' => array_count_values(array_column($recent, 'status')), 'statuses' => Q_STATUS_LABELS]);
    }
    if ($r === '/quotes/get' && $method === 'GET') {
        require_user('invoices.view'); $q = q_get((string)($_GET['id'] ?? ''));
        json_out(['quote' => q_row($q, true), 'settings' => inv_settings(), 'quoteSettings' => q_settings(), 'publicUrl' => q_public_url($q)]);
    }
    if ($r === '/quotes/new' && $method === 'GET') {
        require_user('invoices.edit'); $set = inv_settings(); $qs = q_settings(); $today = toronto_today();
        $max = (int)($pdo->query('SELECT MAX(number) m FROM quotes')->fetch()['m'] ?? 0); $num = max((int)$qs['nextNumber'], $max + 1);
        $draft = ['id' => '', 'kind' => 'quote', 'number' => $qs['prefix'] . str_pad((string)$num, (int)$qs['pad'], '0', STR_PAD_LEFT), 'status' => 'draft', 'baseStatus' => 'draft', 'customer' => ['name' => '', 'company' => '', 'email' => '', 'phone' => '', 'address' => ''], 'customerId' => null,
            'title' => '', 'issueDate' => $today, 'validUntil' => date('Y-m-d', strtotime("$today +" . (int)$qs['validDays'] . ' days')), 'items' => [['name' => '', 'description' => '', 'qty' => 1, 'price' => 0, 'taxes' => $set['defaultTaxes']]],
            'discount' => (object)[], 'notes' => $qs['notes'], 'terms' => $qs['terms'], 'business' => $set['business'], 'currency' => $set['currency'], 'requestId' => null];
        if (!empty($_GET['request'])) {
            $q = $pdo->prepare('SELECT * FROM service_requests WHERE id = ?'); $q->execute([(string)$_GET['request']]);
            if ($req = $q->fetch()) { $d = json_decode($req['details'], true) ?: [];
                $draft['customer'] = ['name' => $req['name'], 'company' => (string)($d['custom']['company'] ?? ''), 'email' => $req['email'], 'phone' => $req['phone'], 'address' => ''];
                $draft['title'] = $req['service'] . (!empty($d['vehicle']) ? ' — ' . $d['vehicle'] : ''); $draft['items'][0]['name'] = $req['service'];
                $draft['items'][0]['description'] = trim((string)($d['vehicle'] ?? '') . (!empty($d['plan']) ? ' · ' . $d['plan'] : '')); $draft['requestId'] = $req['id'];
                $q = $pdo->prepare('SELECT id FROM inv_customers WHERE lower(email) = lower(?)'); $q->execute([$req['email']]); $draft['customerId'] = $q->fetch()['id'] ?? null; }
        }
        if (!empty($_GET['customer'])) { $q = $pdo->prepare('SELECT * FROM inv_customers WHERE id = ?'); $q->execute([(string)$_GET['customer']]);
            if ($c = $q->fetch()) { $draft['customer'] = ['name' => $c['name'], 'company' => $c['company'], 'email' => $c['email'], 'phone' => $c['phone'], 'address' => $c['address']]; $draft['customerId'] = $c['id']; } }
        json_out(['quote' => $draft, 'settings' => $set, 'quoteSettings' => $qs]);
    }
    if ($r === '/quotes/save' && $method === 'POST') {
        $u = require_user('invoices.edit'); $v = body_json(200000); $set = inv_settings();
        $id = (string)($v['id'] ?? ''); $old = $id !== '' ? q_get($id) : null;
        if ($old && in_array($old['status'], ['accepted', 'invoiced'], true)) json_out(['error' => 'This quote was ' . $old['status'] . ' and can no longer be changed. Duplicate it to make a new version.'], 400);
        [$cust, $f, $items] = q_fields_from_input($v, $set);
        $f['customer_id'] = inv_customer_upsert($cust, is_string($v['customerId'] ?? null) ? $v['customerId'] : null);
        $f['customer'] = json_encode($cust, JSON_UNESCAPED_UNICODE); $now = now_iso(); $f['updated_at'] = $now;
        if ($old) {
            if ($old['status'] === 'declined') $f['status'] = 'sent'; // a revised quote can be accepted again
            $pdo->prepare('UPDATE quotes SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($f))) . ' WHERE id = ?')->execute([...array_values($f), $id]);
            audit($u, 'updated quote', '#' . $old['number_text']);
        } else {
            $pdo->beginTransaction();
            $qs = q_settings(); $max = (int)($pdo->query('SELECT MAX(number) m FROM quotes')->fetch()['m'] ?? 0); $num = max((int)$qs['nextNumber'], $max + 1);
            $qs['nextNumber'] = $num + 1; q_settings_save($qs); $id = uuid();
            $f += ['id' => $id, 'number' => $num, 'number_text' => $qs['prefix'] . str_pad((string)$num, (int)$qs['pad'], '0', STR_PAD_LEFT), 'status' => 'draft', 'currency' => $set['currency'], 'business' => json_encode($set['business'], JSON_UNESCAPED_UNICODE),
                'token' => token(), 'request_id' => is_string($v['requestId'] ?? null) ? substr($v['requestId'], 0, 40) : null, 'created_by' => $u['name'], 'created_at' => $now];
            $pdo->prepare('INSERT INTO quotes (' . implode(',', array_keys($f)) . ') VALUES (' . implode(',', array_fill(0, count($f), '?')) . ')')->execute(array_values($f));
            $pdo->commit();
            audit($u, 'created quote', '#' . $f['number_text']);
        }
        foreach ($items as $it) if ($it['name'] !== 'Item') { // remember products/services (shared with invoices)
            $q = $pdo->prepare('SELECT id FROM inv_items WHERE name = ?'); $q->execute([$it['name']]);
            if ($row = $q->fetch()) $pdo->prepare('UPDATE inv_items SET description = ?, price = ?, taxes = ?, used = used + 1, updated_at = ? WHERE id = ?')->execute([$it['description'], $it['price'], json_encode($it['taxes']), $now, $row['id']]);
            else $pdo->prepare('INSERT INTO inv_items (id,name,description,price,taxes,used,updated_at) VALUES (?,?,?,?,?,1,?)')->execute([uuid(), $it['name'], $it['description'], $it['price'], json_encode($it['taxes']), $now]);
        }
        $row = q_get($id);
        json_out(['ok' => true, 'quote' => q_row($row, true), 'publicUrl' => q_public_url($row)]);
    }
    if ($r === '/quotes/send' && $method === 'POST') {
        $u = require_user('invoices.edit'); $v = body_json(20000); $row = q_get((string)($v['id'] ?? ''));
        if (in_array($row['status'], ['invoiced'], true)) json_out(['error' => 'This quote is already invoiced.'], 400);
        $to = strtolower(s($v['to'] ?? '', 254)); if (!filter_var($to, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Add a valid email address.'], 400);
        if (rate_limited('qsend:' . $u['id'], 60, 3600)) json_out(['error' => 'Too many emails. Try again later.'], 429);
        note_attempt('qsend:' . $u['id']); $now = now_iso();
        $pdo->prepare("UPDATE quotes SET status = CASE WHEN status IN ('draft', 'declined') THEN 'sent' ELSE status END, sent_at = ?, updated_at = ? WHERE id = ?")->execute([$now, $now, $row['id']]);
        $row = q_get($row['id']); $ok = q_send_mail($row, $to, s($v['message'] ?? q_settings()['emailMessage'], 4000));
        audit($u, 'sent quote', '#' . $row['number_text'] . ' to ' . $to . ($ok ? '' : ' (mail failed)'));
        json_out(['ok' => true, 'emailed' => $ok, 'quote' => q_row($row, true)]);
    }
    if ($r === '/quotes/status' && $method === 'POST') { // staff: mark as sent / accepted / declined by hand
        $u = require_user('invoices.edit'); $v = body_json(4000); $row = q_get((string)($v['id'] ?? '')); $to = (string)($v['status'] ?? ''); $now = now_iso();
        if (!in_array($to, ['sent', 'accepted', 'declined'], true) || $row['status'] === 'invoiced') json_out(['error' => 'This change is not possible.'], 400);
        if ($to === 'sent') $pdo->prepare("UPDATE quotes SET status = 'sent', sent_at = COALESCE(sent_at, ?), updated_at = ? WHERE id = ?")->execute([$now, $now, $row['id']]);
        if ($to === 'accepted') $pdo->prepare("UPDATE quotes SET status = 'accepted', accepted_at = ?, accepted_name = ?, updated_at = ? WHERE id = ?")->execute([$now, 'Marked by ' . $u['name'], $now, $row['id']]);
        if ($to === 'declined') $pdo->prepare("UPDATE quotes SET status = 'declined', declined_at = ?, decline_reason = ?, updated_at = ? WHERE id = ?")->execute([$now, s($v['reason'] ?? '', 500), $now, $row['id']]);
        audit($u, 'quote marked ' . $to, '#' . $row['number_text']);
        json_out(['ok' => true, 'quote' => q_row(q_get($row['id']), true)]);
    }
    if ($r === '/quotes/convert' && $method === 'POST') {
        $u = require_user('invoices.edit'); $row = q_get((string)(body_json(2000)['id'] ?? ''));
        if ($row['status'] === 'draft') json_out(['error' => 'Send or accept the quote before converting it.'], 400);
        $inv = q_make_invoice($row, $u['name'], false);
        audit($u, 'converted quote to invoice', '#' . $row['number_text'] . ' → #' . $inv['number_text']);
        json_out(['ok' => true, 'invoiceId' => $inv['id'], 'invoiceNumber' => $inv['number_text']]);
    }
    if ($r === '/quotes/delete' && $method === 'POST') {
        $u = require_user('invoices.edit'); $row = q_get((string)(body_json(2000)['id'] ?? ''));
        $pdo->prepare('DELETE FROM quotes WHERE id = ?')->execute([$row['id']]);
        audit($u, 'deleted quote', '#' . $row['number_text']);
        json_out(['ok' => true]);
    }
    if ($r === '/quotes/settings' && $method === 'POST') {
        $u = require_user('invoices.edit'); $v = body_json(20000); $s = q_settings();
        foreach (['notes', 'terms', 'emailMessage'] as $k) if (isset($v[$k])) $s[$k] = s($v[$k], 4000);
        if (isset($v['validDays'])) $s['validDays'] = max(1, min(365, (int)$v['validDays']));
        if (isset($v['autoInvoice'])) $s['autoInvoice'] = (bool)$v['autoInvoice'];
        q_settings_save($s); audit($u, 'updated quote settings');
        json_out(['ok' => true, 'settings' => $s]);
    }
    json_out(['error' => 'Not found'], 404);
}

/* ---------- customer side: /quote/?t=… ---------- */
function public_quote_route(string $path, string $method): void {
    header('X-Robots-Tag: noindex');
    if ($path === '/api/quote' && $method === 'GET') {
        $r = q_by_token((string)($_GET['t'] ?? ''));
        if (!current_user() && !$r['viewed_at']) qdb()->prepare('UPDATE quotes SET viewed_at = ? WHERE id = ?')->execute([now_iso(), $r['id']]);
        json_out(['quote' => q_public($r)]);
    }
    if ($method !== 'POST') json_out(['error' => 'Not found'], 404);
    same_origin(); $v = body_json(8000); $r = q_by_token((string)($v['t'] ?? ''));
    if (rate_limited('quote:' . client_ip(), 30, 3600)) json_out(['error' => 'Too many attempts. Please try again later.'], 429);
    note_attempt('quote:' . client_ip());
    if (q_status($r) !== 'sent') json_out(['error' => q_status($r) === 'expired' ? 'This quote has expired. Please contact us for an updated quote.' : 'This quote was already ' . (Q_STATUS_LABELS[q_status($r)] ?? 'answered') . '.', 'quote' => q_public($r)], 409);
    $now = now_iso(); $c = json_decode($r['customer'], true) ?: []; $pdo = qdb();
    if ($path === '/api/quote/accept') {
        $name = s($v['name'] ?? '', 120); if (mb_strlen($name) < 2) json_out(['error' => 'Type your full name to accept the quote.'], 400);
        if (empty($v['agree'])) json_out(['error' => 'Please tick the box to confirm you accept the quote.'], 400);
        $pdo->prepare("UPDATE quotes SET status = 'accepted', accepted_at = ?, accepted_name = ?, accepted_ip = ?, updated_at = ? WHERE id = ?")->execute([$now, $name, client_ip(), $now, $r['id']]);
        $r = q_get($r['id']); $invNo = '';
        if (q_settings()['autoInvoice']) {
            try { $inv = q_make_invoice($r, 'Quote accepted online', true); $invNo = $inv['number_text']; if (($c['email'] ?? '') !== '') inv_send_mail($inv, inv_settings(), $c['email'], "Hi {name},\n\nThank you for accepting our quote #" . $r['number_text'] . ". Here is your invoice {number} for {total}.\n\nThank you,\nSatin Graphic"); }
            catch (Throwable $e) { error_log('quote invoice: ' . $e->getMessage()); }
        }
        try { require_once __DIR__ . '/push.php'; push_event('invoices', '✅ Quote accepted', '#' . $r['number_text'] . ' · ' . ($c['name'] ?? '') . ' · ' . money_fmt((int)$r['total'], $r['currency']), '/admin/#/quotes', 'q-' . $r['id']); } catch (Throwable $e) { }
        notify_owner('Quote accepted: #' . $r['number_text'] . ' — ' . ($c['name'] ?? ''), $name . ' accepted price quote #' . $r['number_text'] . ' (' . money_fmt((int)$r['total'], $r['currency']) . ').' . ($invNo ? "\nInvoice #$invNo was created and emailed to the customer." : '') . "\n\n" . site_url() . '/admin/#/quotes');
        json_out(['ok' => true, 'quote' => q_public(q_get($r['id']))]);
    }
    if ($path === '/api/quote/decline') {
        $reason = s($v['reason'] ?? '', 500);
        $pdo->prepare("UPDATE quotes SET status = 'declined', declined_at = ?, decline_reason = ?, updated_at = ? WHERE id = ?")->execute([$now, $reason, $now, $r['id']]);
        notify_owner('Quote declined: #' . $r['number_text'] . ' — ' . ($c['name'] ?? ''), ($c['name'] ?? 'The customer') . ' declined price quote #' . $r['number_text'] . '.' . ($reason !== '' ? "\nReason: $reason" : '') . "\n\n" . site_url() . '/admin/#/quotes');
        json_out(['ok' => true, 'quote' => q_public(q_get($r['id']))]);
    }
    json_out(['error' => 'Not found'], 404);
}
