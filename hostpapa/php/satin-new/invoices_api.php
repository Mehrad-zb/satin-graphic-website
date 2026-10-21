<?php
declare(strict_types=1);
// Invoices, customers and the dashboard analytics. Money is stored in cents.

function migrate_inv(PDO $pdo): void {
    static $done = false; if ($done) return; $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS inv_customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, company TEXT NOT NULL DEFAULT \'\', email TEXT NOT NULL DEFAULT \'\', phone TEXT NOT NULL DEFAULT \'\', address TEXT NOT NULL DEFAULT \'\', notes TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS inv_items (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT \'\', price INTEGER NOT NULL DEFAULT 0, taxes TEXT NOT NULL DEFAULT \'[]\', used INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, number INTEGER, number_text TEXT NOT NULL, status TEXT NOT NULL, customer_id TEXT, customer TEXT NOT NULL, title TEXT NOT NULL DEFAULT \'\', issue_date TEXT NOT NULL, due_date TEXT NOT NULL, sales_rep TEXT NOT NULL DEFAULT \'\', items TEXT NOT NULL, discount TEXT NOT NULL DEFAULT \'{}\', deposit TEXT NOT NULL DEFAULT \'{}\', notes TEXT NOT NULL DEFAULT \'\', terms TEXT NOT NULL DEFAULT \'\', currency TEXT NOT NULL DEFAULT \'CAD\', business TEXT NOT NULL DEFAULT \'{}\', subtotal INTEGER NOT NULL DEFAULT 0, discount_total INTEGER NOT NULL DEFAULT 0, tax_total INTEGER NOT NULL DEFAULT 0, taxes TEXT NOT NULL DEFAULT \'[]\', total INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0, token TEXT NOT NULL, request_id TEXT, sent_at TEXT, viewed_at TEXT, created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_inv_issue ON invoices (issue_date)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS inv_payments (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, date TEXT NOT NULL, amount INTEGER NOT NULL, method TEXT NOT NULL, note TEXT NOT NULL DEFAULT \'\', created_by TEXT, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_pay_date ON inv_payments (date)');
    // Online payments / refunds (additive): refunds are rows with a negative amount (kind 'refund', parent_id = the payment refunded).
    $cols = function (string $t) use ($pdo): array { try { return array_column($pdo->query("PRAGMA table_info($t)")->fetchAll(), 'name'); } catch (Throwable $e) { return []; } };
    $pc = $cols('inv_payments'); $ic = $cols('invoices');
    foreach (['provider' => "TEXT NOT NULL DEFAULT ''", 'provider_id' => "TEXT NOT NULL DEFAULT ''", 'kind' => "TEXT NOT NULL DEFAULT 'payment'", 'parent_id' => "TEXT NOT NULL DEFAULT ''"] as $c => $def)
        if (!in_array($c, $pc, true)) { try { $pdo->exec("ALTER TABLE inv_payments ADD COLUMN $c $def"); } catch (Throwable $e) { } }
    if (!in_array('refunded', $ic, true)) { try { $pdo->exec('ALTER TABLE invoices ADD COLUMN refunded INTEGER NOT NULL DEFAULT 0'); } catch (Throwable $e) { } }
    try { $pdo->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_provider ON inv_payments (provider, provider_id) WHERE provider_id != ''"); } catch (Throwable $e) { }
    $pdo->exec('CREATE TABLE IF NOT EXISTS inv_pay_intents (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, provider TEXT NOT NULL, amount INTEGER NOT NULL, label TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL)');
    if (!in_array('funding', $cols('inv_pay_intents'), true)) { try { $pdo->exec("ALTER TABLE inv_pay_intents ADD COLUMN funding TEXT NOT NULL DEFAULT ''"); } catch (Throwable $e) { } }
}
function idb(): PDO { $p = adb(); migrate_inv($p); migrate_visits($p); return $p; }

const INV_METHODS = ['etransfer' => 'e-Transfer', 'cash' => 'Cash', 'cheque' => 'Cheque', 'card' => 'Credit / debit card', 'bank' => 'Bank transfer', 'other' => 'Other'];
const INV_ONLINE = ['square' => 'Card (online · Square)', 'paypal' => 'PayPal (online)', 'afterpay' => 'Afterpay (online · Square)', 'paypal_paylater' => 'PayPal Pay Later (online)'];
const INV_STATUS_LABELS = ['draft' => 'Draft', 'sent' => 'Unpaid', 'overdue' => 'Overdue', 'partial' => 'Partial', 'paid' => 'Paid', 'refunded' => 'Refunded', 'void' => 'Void'];
function inv_method_name(string $m): string { return INV_METHODS[$m] ?? INV_ONLINE[$m] ?? $m; }

function inv_default_settings(): array {
    return [
        'business' => ['name' => 'Satin Graphic INC', 'address' => "50 Viceroy Rd, Unit 22–23\nVaughan, Ontario\nCanada", 'email' => 'info@satinautowrap.com', 'phone' => '+1 905 695 9147', 'taxNumber' => 'HST/GST# 721390409RT0001', 'logo' => '/satin/img/logo.png', 'website' => 'satingraphic.ca'],
        'prefix' => '', 'nextNumber' => 13461, 'pad' => 7, 'dueDays' => 30, 'currency' => 'CAD',
        'taxes' => [['id' => 'hst', 'name' => 'HST', 'rate' => 13]],
        'defaultTaxes' => ['hst'],
        'notes' => 'Thank you for your business!',
        'terms' => "Payment is due by the due date. We accept e-Transfer to info@satinautowrap.com, cash, cheque and credit card.",
        'emailMessage' => "Hi {name},\n\nPlease find your invoice {number} for {total} below. It is due on {due}.\n\nThank you,\nSatin Graphic",
    ];
}
function inv_settings(): array {
    $q = idb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute(['inv.settings']); $r = $q->fetch();
    $s = $r ? (json_decode($r['v'], true) ?: []) : [];
    $d = inv_default_settings();
    $out = array_replace($d, $s);
    $out['business'] = array_replace($d['business'], is_array($s['business'] ?? null) ? $s['business'] : []);
    return $out;
}
function inv_settings_save(array $s): void {
    $pdo = idb();
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute(['inv.settings']);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute(['inv.settings', json_encode($s, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), now_iso()]);
}

function cents($v): int { return is_numeric($v) ? (int)round((float)$v * 100) : 0; }
function money_fmt(int $c, string $cur = 'CAD'): string { return ($cur === 'CAD' ? 'CA$' : '$') . number_format($c / 100, 2); }
function vdate($v, string $fallback): string { return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) && strtotime($v) ? $v : $fallback; }
function s($v, int $max): string { return is_string($v) || is_numeric($v) ? mb_substr(trim((string)$v), 0, $max) : ''; }

// Totals: line amounts → invoice discount spread proportionally → taxes per rate on the discounted amounts.
function inv_calc(array $items, array $discount, array $taxDefs): array {
    $rates = []; foreach ($taxDefs as $t) $rates[$t['id']] = $t;
    $lines = []; $subtotal = 0;
    foreach ($items as $it) { $amt = (int)round($it['qty'] * $it['price']); $lines[] = $amt; $subtotal += $amt; }
    $disc = 0;
    if (($discount['type'] ?? '') === 'percent') $disc = (int)round($subtotal * min(100, max(0, (float)($discount['value'] ?? 0))) / 100);
    elseif (($discount['type'] ?? '') === 'amount') $disc = min($subtotal, max(0, cents($discount['value'] ?? 0)));
    $base = [];
    foreach ($items as $i => $it) {
        $share = $subtotal > 0 ? $lines[$i] - $disc * $lines[$i] / $subtotal : 0;
        foreach ($it['taxes'] as $tid) if (isset($rates[$tid])) $base[$tid] = ($base[$tid] ?? 0) + $share;
    }
    $taxes = []; $taxTotal = 0;
    foreach ($base as $tid => $b) { $amt = (int)round($b * (float)$rates[$tid]['rate'] / 100); $taxes[] = ['id' => $tid, 'name' => $rates[$tid]['name'], 'rate' => (float)$rates[$tid]['rate'], 'amount' => $amt]; $taxTotal += $amt; }
    return ['lines' => $lines, 'subtotal' => $subtotal, 'discount' => $disc, 'taxes' => $taxes, 'tax' => $taxTotal, 'total' => $subtotal - $disc + $taxTotal];
}

/* ---------- payment schedule (stored in the `deposit` JSON column) ----------
   Legacy: {type, value}            → deposit (due on receipt) + balance (invoice due date)
   New:    {type, value, items: [{label, type: percent|amount, value, due}, …, {label, type: balance}]}
           2–4 instalments; the last one is always the remaining balance, due on the invoice due date. */
const INV_PLAN_MAX = 4;
function inv_plan(array $dep): array {
    if (is_array($dep['items'] ?? null) && count($dep['items']) >= 2) return array_values(array_filter($dep['items'], 'is_array'));
    if (in_array($dep['type'] ?? '', ['percent', 'amount'], true) && is_numeric($dep['value'] ?? null) && (float)$dep['value'] > 0)
        return [['label' => 'Deposit', 'type' => $dep['type'], 'value' => (float)$dep['value'], 'due' => ''], ['label' => 'Balance', 'type' => 'balance', 'value' => 0, 'due' => '']];
    return [];
}
/** Instalments with amounts (cents) and state, paying them off in order with the net amount paid. */
function inv_schedule(array $r): array {
    $plan = inv_plan(json_decode((string)($r['deposit'] ?? '{}'), true) ?: []);
    if (!$plan) return [];
    $total = max(0, (int)$r['total']); $paid = max(0, (int)$r['paid']); $today = toronto_today();
    $out = []; $cum = 0; $n = count($plan); $open = false;
    foreach ($plan as $k => $p) {
        $last = $k === $n - 1;
        $amt = $last ? $total - $cum : (($p['type'] ?? '') === 'percent' ? (int)round($total * (float)($p['value'] ?? 0) / 100) : cents($p['value'] ?? 0));
        $amt = max(0, min($amt, $total - $cum));
        $start = $cum; $cum += $amt;
        $got = max(0, min($amt, $paid - $start));
        $due = $last ? (string)$r['due_date'] : (string)($p['due'] ?? '');
        if ($got >= $amt) $state = 'paid';
        elseif ($due !== '' && $due < $today) $state = 'overdue';
        else $state = $open ? 'upcoming' : ($due === '' || $due <= $today ? 'due' : 'next');
        if ($state !== 'paid') $open = true;
        $out[] = ['label' => (string)($p['label'] ?? '') ?: ($last ? 'Balance' : 'Payment ' . ($k + 1)), 'type' => $last ? 'balance' : (string)($p['type'] ?? 'amount'), 'value' => $last ? 0 : (float)($p['value'] ?? 0),
            'due' => $due, 'amount' => $amt, 'paid' => $got, 'remaining' => $amt - $got, 'state' => $state];
    }
    return $out;
}
/** Validates the plan sent by the admin editor. Returns the JSON to store, or an error message. */
function inv_plan_clean($pv, int $total, string $issue, string $due) {
    if (!is_array($pv)) return [];
    if (!is_array($pv['items'] ?? null)) { // legacy single deposit
        return in_array($pv['type'] ?? '', ['percent', 'amount'], true) && is_numeric($pv['value'] ?? null) && (float)$pv['value'] > 0 ? ['type' => $pv['type'], 'value' => round((float)$pv['value'], 2)] : [];
    }
    $items = array_values(array_filter($pv['items'], 'is_array'));
    if (!$items) return [];
    if (count($items) < 2 || count($items) > INV_PLAN_MAX) return 'A payment schedule has 2 to ' . INV_PLAN_MAX . ' payments.';
    if ($total <= 0) return 'Add the invoice items before setting a payment schedule.';
    $out = []; $sum = 0; $prev = $issue; $n = count($items);
    foreach ($items as $k => $it) {
        $label = s($it['label'] ?? '', 60);
        if ($k === $n - 1) { $out[] = ['label' => $label ?: 'Final balance', 'type' => 'balance', 'value' => 0, 'due' => '']; break; }
        $type = in_array($it['type'] ?? '', ['percent', 'amount'], true) ? $it['type'] : 'amount';
        $val = is_numeric($it['value'] ?? null) ? round((float)$it['value'], 2) : 0;
        $amt = $type === 'percent' ? (int)round($total * $val / 100) : cents($val);
        $name = $label ?: 'Payment ' . ($k + 1);
        if ($val <= 0 || $amt <= 0 || ($type === 'percent' && $val >= 100)) return "Enter an amount for “{$name}”.";
        $sum += $amt;
        $d = is_string($it['due'] ?? null) && $it['due'] !== '' ? vdate($it['due'], '') : '';
        if (($it['due'] ?? '') !== '' && $d === '') return "Check the due date of “{$name}”.";
        if ($d !== '' && $d < $prev) return "The due date of “{$name}” is before the previous payment (or the issue date).";
        if ($d !== '' && $d > $due) return "The due date of “{$name}” is after the invoice due date.";
        if ($d !== '') $prev = $d;
        $out[] = ['label' => $name, 'type' => $type, 'value' => $val, 'due' => $d];
    }
    if ($sum >= $total) return 'The scheduled payments add up to ' . money_fmt($sum) . ', which leaves nothing for the final balance (invoice total ' . money_fmt($total) . ').';
    return ['type' => $out[0]['type'], 'value' => $out[0]['value'], 'items' => $out];
}
function inv_overdue(array $r): bool {
    $sch = inv_schedule($r);
    if ($sch) { foreach ($sch as $x) if ($x['state'] === 'overdue') return true; return false; }
    return $r['due_date'] < toronto_today();
}
function inv_status(array $r): string {
    if (in_array($r['status'], ['draft', 'void'], true)) return $r['status'];
    $paid = (int)$r['paid']; $total = (int)$r['total'];
    if ((int)($r['refunded'] ?? 0) > 0 && $paid <= 0) return 'refunded';
    if ($total > 0 && $paid >= $total) return 'paid';
    if (inv_overdue($r)) return 'overdue';
    if ($paid > 0) return 'partial';
    return 'sent';
}
/** The instalment the customer pays next (null when nothing is scheduled or all is paid). */
function inv_next_due(array $r): ?array { foreach (inv_schedule($r) as $x) if ($x['remaining'] > 0) return $x; return null; }
/** Server-computed amount for an online payment: [cents, label]. Never taken from the client. */
function inv_pay_amount(array $r, string $option): array {
    $bal = max(0, (int)$r['total'] - (int)$r['paid']);
    $n = inv_next_due($r);
    if ($option === 'next' && $n && $n['remaining'] < $bal) return [$n['remaining'], $n['label']];
    return [$bal, $n && $n['remaining'] >= $bal ? $n['label'] : 'Full balance'];
}
function inv_payable(array $r): bool { return in_array(inv_status($r), ['sent', 'partial', 'overdue'], true) && (int)$r['total'] - (int)$r['paid'] > 0 && $r['currency'] === 'CAD'; }

function inv_row(array $r, bool $full = false): array {
    $c = json_decode($r['customer'], true) ?: [];
    $o = ['id' => $r['id'], 'number' => $r['number_text'], 'status' => inv_status($r), 'baseStatus' => $r['status'], 'customer' => $c, 'customerId' => $r['customer_id'], 'title' => $r['title'],
        'issueDate' => $r['issue_date'], 'dueDate' => $r['due_date'], 'total' => (int)$r['total'], 'paid' => (int)$r['paid'], 'refunded' => (int)($r['refunded'] ?? 0), 'balance' => max(0, (int)$r['total'] - (int)$r['paid']), 'currency' => $r['currency'],
        'sentAt' => $r['sent_at'], 'viewedAt' => $r['viewed_at'], 'updatedAt' => $r['updated_at']];
    $n = $o['status'] === 'void' || $o['status'] === 'draft' ? null : inv_next_due($r);
    if ($n && $n['remaining'] < $o['balance']) $o['nextDue'] = ['label' => $n['label'], 'amount' => $n['remaining'], 'due' => $n['due']];
    if ($full) {
        $o += ['salesRep' => $r['sales_rep'], 'items' => json_decode($r['items'], true) ?: [], 'discount' => json_decode($r['discount'], true) ?: (object)[], 'deposit' => json_decode($r['deposit'], true) ?: (object)[],
            'notes' => $r['notes'], 'terms' => $r['terms'], 'business' => json_decode($r['business'], true) ?: [], 'subtotal' => (int)$r['subtotal'], 'discountTotal' => (int)$r['discount_total'],
            'taxTotal' => (int)$r['tax_total'], 'taxes' => json_decode($r['taxes'], true) ?: [], 'token' => $r['token'], 'requestId' => $r['request_id'], 'createdBy' => $r['created_by'], 'createdAt' => $r['created_at'],
            'schedule' => inv_schedule($r)];
        $q = idb()->prepare('SELECT * FROM inv_payments WHERE invoice_id = ? ORDER BY date, created_at'); $q->execute([$r['id']]);
        $rows = $q->fetchAll(); $refunded = [];
        foreach ($rows as $p) if (($p['kind'] ?? '') === 'refund' && ($p['parent_id'] ?? '') !== '') $refunded[$p['parent_id']] = ($refunded[$p['parent_id']] ?? 0) - (int)$p['amount'];
        $o['payments'] = array_map(function ($p) use ($refunded) { $refund = ($p['kind'] ?? '') === 'refund' || (int)$p['amount'] < 0;
            return ['id' => $p['id'], 'date' => $p['date'], 'amount' => (int)$p['amount'], 'kind' => $refund ? 'refund' : 'payment', 'method' => $p['method'], 'methodName' => inv_method_name($p['method']), 'note' => $p['note'], 'createdBy' => $p['created_by'],
                'provider' => $p['provider'] ?? '', 'online' => ($p['provider'] ?? '') !== '' && ($p['provider_id'] ?? '') !== '', 'parentId' => ($p['parent_id'] ?? '') ?: null, 'refunded' => $refund ? 0 : (int)($refunded[$p['id']] ?? 0)]; }, $rows);
    }
    return $o;
}
function inv_get(string $id): array {
    $q = idb()->prepare('SELECT * FROM invoices WHERE id = ?'); $q->execute([$id]); $r = $q->fetch();
    if (!$r) json_out(['error' => 'Invoice not found'], 404);
    return $r;
}
function inv_refresh_paid(string $id): void {
    $pdo = idb();
    $q = $pdo->prepare('SELECT COALESCE(SUM(amount),0) s, COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) r FROM inv_payments WHERE invoice_id = ?'); $q->execute([$id]); $x = $q->fetch();
    $pdo->prepare('UPDATE invoices SET paid = ?, refunded = ?, updated_at = ? WHERE id = ?')->execute([(int)$x['s'], (int)$x['r'], now_iso(), $id]);
}
function inv_public_url(array $r): string { return site_url() . '/invoice/?t=' . $r['token']; }

function inv_customer_upsert(array $c, ?string $id): string {
    $pdo = idb(); $now = now_iso();
    if ($id) { $q = $pdo->prepare('SELECT id FROM inv_customers WHERE id = ?'); $q->execute([$id]); if (!$q->fetch()) $id = null; }
    if (!$id && $c['email'] !== '') { $q = $pdo->prepare('SELECT id FROM inv_customers WHERE lower(email) = lower(?)'); $q->execute([$c['email']]); $id = $q->fetch()['id'] ?? null; }
    if ($id) { $pdo->prepare('UPDATE inv_customers SET name=?, company=?, email=?, phone=?, address=?, updated_at=? WHERE id=?')->execute([$c['name'], $c['company'], $c['email'], $c['phone'], $c['address'], $now, $id]); return $id; }
    $id = uuid();
    $pdo->prepare('INSERT INTO inv_customers (id,name,company,email,phone,address,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')->execute([$id, $c['name'], $c['company'], $c['email'], $c['phone'], $c['address'], $now, $now]);
    return $id;
}

const INV_TAG_COLORS = ['draft' => ['#f3f4f6', '#4b5563'], 'sent' => ['#dbeafe', '#1d4ed8'], 'overdue' => ['#fee2e2', '#b91c1c'], 'partial' => ['#fef3c7', '#92400e'], 'paid' => ['#dcfce7', '#15803d'], 'refunded' => ['#ede9fe', '#6d28d9'], 'void' => ['#e5e7eb', '#4b5563']];
/** Plain-text + HTML summary (status tag, amounts, payment schedule) for customer emails. */
function inv_mail_summary(array $r): array {
    $cur = $r['currency']; $st = inv_status($r); $bal = max(0, (int)$r['total'] - (int)$r['paid']);
    $label = INV_STATUS_LABELS[$st] ?? $st; if ($st === 'partial' && (int)($r['refunded'] ?? 0) > 0) $label = 'Partial · refunded';
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    [$bg, $fg] = INV_TAG_COLORS[$st] ?? INV_TAG_COLORS['sent'];
    $txt = "Status: " . strtoupper($label) . "\nInvoice total: " . money_fmt((int)$r['total'], $cur) . ((int)$r['paid'] ? "\nPaid: " . money_fmt((int)$r['paid'], $cur) : '') . ((int)($r['refunded'] ?? 0) ? "\nRefunded: " . money_fmt((int)$r['refunded'], $cur) : '') . (in_array($st, ['refunded', 'void'], true) ? '' : "\nBalance due: " . money_fmt($bal, $cur));
    $rows = '<tr><td style="padding:4px 0;color:#6b7280">Invoice total</td><td style="padding:4px 0;text-align:right">' . $e(money_fmt((int)$r['total'], $cur)) . '</td></tr>'
        . ((int)$r['paid'] ? '<tr><td style="padding:4px 0;color:#6b7280">Paid</td><td style="padding:4px 0;text-align:right">' . $e(money_fmt((int)$r['paid'], $cur)) . '</td></tr>' : '')
        . ((int)($r['refunded'] ?? 0) ? '<tr><td style="padding:4px 0;color:#6b7280">Refunded</td><td style="padding:4px 0;text-align:right">' . $e(money_fmt((int)$r['refunded'], $cur)) . '</td></tr>' : '')
        . (in_array($st, ['refunded', 'void'], true) ? '' : '<tr><td style="padding:6px 0;font-weight:700;border-top:1px solid #e5e7eb">Balance due</td><td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid #e5e7eb">' . $e(money_fmt($bal, $cur)) . '</td></tr>');
    $sch = in_array($st, ['void', 'refunded'], true) ? [] : inv_schedule($r);
    $schTxt = ''; $schHtml = '';
    if ($sch) {
        $names = ['paid' => 'Paid', 'due' => 'Due now', 'next' => 'Next', 'overdue' => 'Overdue', 'upcoming' => 'Upcoming'];
        $colors = ['paid' => '#15803d', 'due' => '#1d4ed8', 'next' => '#1d4ed8', 'overdue' => '#b91c1c', 'upcoming' => '#6b7280'];
        $schTxt = "\n\nPayment schedule:";
        foreach ($sch as $x) {
            $when = $x['due'] ? date('M j, Y', strtotime($x['due'])) : 'on receipt';
            $schTxt .= "\n- " . $x['label'] . ': ' . money_fmt($x['amount'], $cur) . ' · due ' . $when . ' · ' . $names[$x['state']];
            $schHtml .= '<tr><td style="padding:5px 0">' . $e($x['label']) . '<br><span style="color:#6b7280;font-size:12px">Due ' . $e($when) . '</span></td><td style="padding:5px 0;text-align:right">' . $e(money_fmt($x['amount'], $cur)) . '<br><span style="color:' . $colors[$x['state']] . ';font-size:12px;font-weight:700">' . $names[$x['state']] . '</span></td></tr>';
        }
        $schHtml = '<p style="margin:18px 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280">Payment schedule</p><table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">' . $schHtml . '</table>';
    }
    $tag = '<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:' . $bg . ';color:' . $fg . ';font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase">' . $e($label) . '</span>';
    return [$txt . $schTxt, $tag . '<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin-top:12px">' . $rows . '</table>' . $schHtml];
}
function inv_mail(string $to, string $subject, string $text, string $html, array $set): bool {
    return mail_out($to, $subject, $text, $html, ['fromName' => (string)$set['business']['name'], 'replyTo' => (string)$set['business']['email']]);
}
function inv_mail_html(array $r, array $set, string $intro, string $button): string {
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    [, $sum] = inv_mail_summary($r);
    $b = $set['business'];
    return '<!doctype html><html><body style="margin:0;background:#eceef2;font-family:Arial,Helvetica,sans-serif;color:#16181d"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border-collapse:separate"><tr><td style="padding:28px">'
        . '<p style="margin:0 0 4px;font-size:13px;color:#6b7280">' . $e($b['name']) . '</p><h1 style="margin:0 0 16px;font-size:22px">Invoice #' . $e($r['number_text']) . '</h1>'
        . '<div style="font-size:14px;line-height:1.55;white-space:pre-line;margin-bottom:18px">' . $e($intro) . '</div>' . $sum
        . '<p style="margin:24px 0 8px"><a href="' . $e(inv_public_url($r)) . '" style="display:inline-block;background:#16181d;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700">' . $e($button) . '</a></p>'
        . '<p style="margin:18px 0 0;font-size:12px;color:#6b7280">' . $e($b['name']) . ' · ' . $e($b['phone']) . ' · ' . $e($b['email']) . '</p></td></tr></table></td></tr></table></body></html>';
}
function inv_send_mail(array $r, array $set, string $to, string $msg): bool {
    $c = json_decode($r['customer'], true) ?: [];
    $vars = ['{name}' => $c['name'] ?? '', '{number}' => '#' . $r['number_text'], '{total}' => money_fmt((int)$r['total'] - (int)$r['paid'], $r['currency']), '{due}' => date('M j, Y', strtotime($r['due_date']))];
    $intro = strtr($msg, $vars);
    [$sumTxt] = inv_mail_summary($r);
    $pay = inv_payable($r);
    $body = $intro . "\n\n" . $sumTxt . "\n\n" . ($pay ? 'View, print and pay your invoice online:' : 'View and print your invoice:') . "\n" . inv_public_url($r) . "\n\n" . $set['business']['name'] . "\n" . $set['business']['phone'] . ' · ' . $set['business']['email'];
    $subject = 'Invoice #' . $r['number_text'] . ' from ' . $set['business']['name'];
    return inv_mail($to, $subject, $body, inv_mail_html($r, $set, $intro, $pay ? 'View & pay invoice' : 'View invoice'), $set);
}
/** Receipt / refund notice to the customer after an online payment or a refund. */
function inv_mail_update(array $r, string $what): void {
    $c = json_decode($r['customer'], true) ?: [];
    if (empty($c['email']) || !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) return;
    $set = inv_settings();
    $intro = 'Hi ' . ($c['name'] ?? '') . ",\n\n" . $what . "\n\nThank you,\n" . $set['business']['name'];
    [$sumTxt] = inv_mail_summary($r);
    inv_mail($c['email'], 'Invoice #' . $r['number_text'] . ' · ' . (INV_STATUS_LABELS[inv_status($r)] ?? 'Update'), $intro . "\n\n" . $sumTxt . "\n\nView your invoice:\n" . inv_public_url($r), inv_mail_html($r, $set, $intro, inv_payable($r) ? 'View & pay invoice' : 'View invoice'), $set);
}

/* ---------- visits (anonymous, consent-based) ---------- */
function migrate_visits(PDO $pdo): void {
    static $done = false; if ($done) return; $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_visits (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, ts INTEGER NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, session TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, lang TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_visits_day ON site_visits (day)');
}
function visit_source(string $ref): string {
    $h = strtolower((string)parse_url($ref, PHP_URL_HOST));
    if ($h === '' ) return 'Direct';
    $h = preg_replace('/^(www|m|l|lm)\./', '', $h);
    $map = ['google.' => 'Google', 'bing.com' => 'Bing', 'yahoo.' => 'Yahoo', 'duckduckgo.com' => 'DuckDuckGo', 'facebook.com' => 'Facebook', 'instagram.com' => 'Instagram', 'linkedin.com' => 'LinkedIn', 't.co' => 'X / Twitter', 'twitter.com' => 'X / Twitter', 'x.com' => 'X / Twitter', 'youtube.com' => 'YouTube', 'tiktok.com' => 'TikTok', 'chatgpt.com' => 'ChatGPT', 'openai.com' => 'ChatGPT', 'perplexity.ai' => 'Perplexity', 'yelp.' => 'Yelp', 'wix.com' => 'Wix'];
    foreach ($map as $k => $v) if (strpos($h, $k) !== false) return $v;
    if (preg_match('/satingraphic\.ca$|satinautowrap\.com$|servername\.online$|hostpapa\./', $h)) return 'Internal';
    return mb_substr($h, 0, 60);
}
function record_visit(): void {
    $v = json_decode((string)file_get_contents('php://input', false, null, 0, 4000), true);
    if (!is_array($v) || ($v['consent'] ?? null) !== true) { http_response_code(204); exit; }
    $ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
    require_once __DIR__ . '/auth.php';
    if (rate_limited('visit:' . $ip, 400, 3600)) { http_response_code(204); exit; }
    note_attempt('visit:' . $ip);
    $path = (string)($v['path'] ?? '');
    if (!preg_match('#^/satin(?:/[a-z0-9-]+)*/?$#', $path)) { http_response_code(204); exit; }
    $path = rtrim($path, '/') ?: '/satin';
    $kind = in_array($v['type'] ?? 'pv', ['pv', 'contact', 'quote'], true) ? ($v['type'] ?? 'pv') : 'pv';
    $session = preg_match('/^[a-f0-9-]{8,40}$/i', (string)($v['id'] ?? '')) ? substr(hash('sha256', $v['id'] . gmdate('Y-m-d')), 0, 16) : 'anon';
    $w = (int)($v['w'] ?? 0);
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if (preg_match('/bot|crawl|spider|slurp|headless|lighthouse/i', $ua)) { http_response_code(204); exit; }
    $device = $w > 0 ? ($w < 700 ? 'Mobile' : ($w < 1100 ? 'Tablet' : 'Desktop')) : (preg_match('/Mobi|Android|iPhone/i', $ua) ? 'Mobile' : 'Desktop');
    $lang = preg_match('#^/satin/(fa|fr|es)(/|$)#', $path, $m) ? $m[1] : 'en';
    $src = visit_source(s($v['ref'] ?? '', 400));
    $pdo = db(); migrate_visits($pdo);
    $pdo->prepare('INSERT INTO site_visits (day,ts,kind,path,session,source,device,lang) VALUES (?,?,?,?,?,?,?,?)')->execute([toronto_today(), time(), $kind, mb_substr($path, 0, 200), $session, $src, $device, $lang]);
    http_response_code(204); exit;
}

/* ---------- public invoice view ---------- */
function inv_by_token(string $t): array {
    if (!preg_match('/^[A-Za-z0-9_-]{30,60}$/', $t)) json_out(['error' => 'Invoice not found'], 404);
    $q = idb()->prepare('SELECT * FROM invoices WHERE token = ?'); $q->execute([$t]); $r = $q->fetch();
    if (!$r) json_out(['error' => 'This invoice is not available.'], 404);
    if ($r['status'] === 'draft' && !current_user()) json_out(['error' => 'This invoice is not available yet.'], 404);
    return $r;
}
/** What the customer page sees (no internal ids, no staff names). Online payment options only while a balance is open. */
function inv_public(array $r): array {
    $o = inv_row($r, true);
    unset($o['token'], $o['requestId'], $o['createdBy'], $o['customerId'], $o['baseStatus'], $o['id']);
    $o['payments'] = array_map(fn($p) => ['date' => $p['date'], 'amount' => $p['amount'], 'kind' => $p['kind'], 'methodName' => $p['methodName']], $o['payments']);
    $o['statusLabel'] = INV_STATUS_LABELS[$o['status']] ?? $o['status'];
    $o['pay'] = null;
    if ($r['status'] !== 'draft' && inv_payable($r)) {
        require_once __DIR__ . '/commerce.php';
        $cfg = shop_public_payment_config();
        if ($cfg['square'] || $cfg['paypal']) {
            [$next, $nextLabel] = inv_pay_amount($r, 'next');
            $o['pay'] = ['square' => $cfg['square'], 'paypal' => $cfg['paypal'], 'balance' => $o['balance'], 'next' => ['amount' => $next, 'label' => $nextLabel]];
        }
    }
    return $o;
}
function public_invoice(): void {
    $r = inv_by_token((string)($_GET['t'] ?? ''));
    if (!current_user() && !in_array($r['status'], ['draft', 'void'], true) && !$r['viewed_at']) idb()->prepare('UPDATE invoices SET viewed_at = ? WHERE id = ?')->execute([now_iso(), $r['id']]);
    header('X-Robots-Tag: noindex');
    json_out(['invoice' => inv_public($r)]);
}

/* ---------- online payments (Square Web Payments SDK card form, PayPal buttons) ---------- */
function inv_get_row(string $id): ?array { if ($id === '') return null; $q = idb()->prepare('SELECT * FROM invoices WHERE id = ?'); $q->execute([$id]); return $q->fetch() ?: null; }
/** Records a provider payment (positive) or refund (negative) once per provider id. Returns true when newly recorded. */
function inv_record_online(array $r, string $provider, string $pid, int $amount, string $note, string $by, string $kind = 'payment', string $parent = '', string $method = ''): bool {
    if ($pid === '' || $amount === 0) return false;
    $pdo = idb();
    $q = $pdo->prepare('SELECT id FROM inv_payments WHERE provider = ? AND provider_id = ?'); $q->execute([$provider, $pid]);
    if ($q->fetch()) return false;
    try {
        $pdo->prepare('INSERT INTO inv_payments (id,invoice_id,date,amount,method,note,created_by,created_at,provider,provider_id,kind,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([uuid(), $r['id'], toronto_today(), $amount, $method !== '' ? $method : $provider, mb_substr($note, 0, 300), $by, now_iso(), $provider, mb_substr($pid, 0, 120), $kind, $parent]);
    } catch (PDOException $e) { return false; } // recorded concurrently (unique provider id)
    inv_refresh_paid($r['id']);
    $r = inv_get_row($r['id']);
    $m = money_fmt(abs($amount), $r['currency']);
    if ($kind === 'refund') {
        audit(null, 'invoice refund', '#' . $r['number_text'] . ' ' . $m . ' via ' . $provider);
        notify_owner("Satin website: refund on invoice #{$r['number_text']}", "A $m refund ($provider) was recorded on invoice #{$r['number_text']}. Status: " . (INV_STATUS_LABELS[inv_status($r)] ?? '') . ".\n" . inv_public_url($r));
        inv_mail_update($r, "A refund of $m has been issued for invoice #{$r['number_text']}. It can take a few business days to appear on your statement.");
    } else {
        audit(null, 'invoice paid online', '#' . $r['number_text'] . ' ' . $m . ' via ' . $provider);
        try { require_once __DIR__ . '/push.php'; $cu = json_decode((string)$r['customer'], true) ?: []; push_event('invoices', '💰 Invoice #' . $r['number_text'] . ' paid ' . $m, trim(($cu['name'] ?? '') . ' · ' . $provider . ' · ' . (INV_STATUS_LABELS[inv_status($r)] ?? '')), '/admin/#/invoices', 'inv-' . $r['number_text']); } catch (Throwable $e) {}
        notify_owner("Satin website: invoice #{$r['number_text']} paid $m online", "Invoice #{$r['number_text']} received $m ($note). Status: " . (INV_STATUS_LABELS[inv_status($r)] ?? '') . ', balance ' . money_fmt(max(0, (int)$r['total'] - (int)$r['paid']), $r['currency']) . ".\n" . inv_public_url($r));
        inv_mail_update($r, "We received your payment of $m for invoice #{$r['number_text']}. Thank you!");
    }
    return true;
}
function inv_remove_online(string $provider, string $pid): void {
    $q = idb()->prepare('SELECT * FROM inv_payments WHERE provider = ? AND provider_id = ?'); $q->execute([$provider, $pid]);
    if (!($p = $q->fetch())) return;
    idb()->prepare('DELETE FROM inv_payments WHERE id = ?')->execute([$p['id']]);
    inv_refresh_paid($p['invoice_id']);
}
function inv_payment_row(string $provider, string $pid): ?array { $q = idb()->prepare("SELECT * FROM inv_payments WHERE provider = ? AND provider_id = ? AND kind != 'refund'"); $q->execute([$provider, $pid]); return $q->fetch() ?: null; }

/** Charges the Square card token for the server-computed instalment / balance. */
function inv_pay_card(array $r, array $v): string {
    $c = shop_square();
    if (!shop_square_ready($c)) json_out(['error' => 'Card payment is not available right now.'], 503);
    if (!is_string($v['sourceId'] ?? null) || !preg_match('/^[A-Za-z0-9:_\-]{8,512}$/', $v['sourceId']) || !shop_is_uuid($v['idempotencyKey'] ?? null)
        || (isset($v['verificationToken']) && $v['verificationToken'] !== null && (!is_string($v['verificationToken']) || !preg_match('/^[A-Za-z0-9:_\-]{4,2048}$/', $v['verificationToken'])))) throw new ShopError('Card details could not be read. Please re-enter your card.');
    $afterpay = ($v['method'] ?? '') === 'afterpay';
    if ($afterpay && !$c['afterpay']) json_out(['error' => 'Afterpay is not available right now. Pay by card instead.'], 503);
    shop_limit('invcard:' . $r['id'], 8, 3600, 'Too many card attempts for this invoice. Please wait an hour or call 905-695-9147.');
    [$amt, $label] = inv_pay_amount($r, ($v['option'] ?? '') === 'full' ? 'full' : 'next');
    if ($amt <= 0) throw new ShopError('Nothing is due on this invoice.');
    // Afterpay: charge exactly the amount the buyer approved in the Afterpay popup (the server amount shown on the page), or nothing.
    if ($afterpay && (!is_int($v['expectedAmount'] ?? null) || $v['expectedAmount'] !== $amt)) json_out(['error' => 'The amount due changed. Reload the page and approve Afterpay again.', 'invoice' => inv_public($r)], 409);
    $cust = json_decode($r['customer'], true) ?: [];
    $body = ['source_id' => $v['sourceId'], 'idempotency_key' => $v['idempotencyKey'], 'amount_money' => ['amount' => $amt, 'currency' => 'CAD'], 'location_id' => $c['locationId'],
        'reference_id' => $r['id'], 'note' => mb_substr('Invoice #' . $r['number_text'] . ' · ' . $label, 0, 500), 'autocomplete' => true];
    if (!empty($cust['email']) && filter_var($cust['email'], FILTER_VALIDATE_EMAIL)) $body['buyer_email_address'] = $cust['email'];
    if (!empty($v['verificationToken']) && !$afterpay) $body['verification_token'] = $v['verificationToken'];
    try { [$code, $j] = shop_square_raw($c, 'POST', '/v2/payments', $body); }
    catch (ShopError $e) { throw new ShopError('We could not reach the payment service. Your card was not charged. Please try again.'); }
    $p = $j['payment'] ?? null;
    if ($code >= 300 || !is_array($p)) {
        $err = $j['errors'][0]['code'] ?? '';
        error_log('satin invoice ' . ($afterpay ? 'afterpay' : 'card') . ': #' . $r['number_text'] . ' ' . $err);
        if ($afterpay) throw new ShopError('Afterpay did not approve this payment. Nothing was charged. Try card or PayPal instead.');
        throw new ShopError(SHOP_CARD_ERRORS[$err] ?? 'The payment could not be completed. Your card was not charged. Try again or use another card.');
    }
    $card = trim(preg_replace('/[^A-Z_ ]/', '', strtoupper((string)($p['card_details']['card']['card_brand'] ?? ''))) . ' •••• ' . preg_replace('/\D/', '', substr((string)($p['card_details']['card']['last_4'] ?? ''), -4)));
    $got = (int)($p['amount_money']['amount'] ?? -1);
    if (in_array($p['status'] ?? '', ['COMPLETED', 'APPROVED'], true) && ($p['amount_money']['currency'] ?? '') === 'CAD' && $got > 0) {
        if ($got !== $amt) error_log('satin invoice card: amount differs on #' . $r['number_text']);
        $isAp = shop_square_method_label($p) === 'Afterpay';
        inv_record_online($r, 'square', (string)($p['id'] ?? ''), $got, ($isAp ? 'Afterpay' : 'Card ' . $card) . ' · ' . $label, 'Customer (online)', 'payment', '', $isAp ? 'afterpay' : '');
        return 'paid';
    }
    if (($p['status'] ?? '') === 'PENDING') return 'pending'; // the webhook records it
    throw new ShopError('The payment could not be completed. Your card was not charged.');
}
function inv_paypal_create(array $r, string $option, string $funding = ''): string {
    $c = shop_paypal();
    if (!shop_paypal_ready($c)) json_out(['error' => 'PayPal is not available right now. Pay by card instead.'], 503);
    shop_limit('invpp:' . $r['id'], 20, 3600);
    [$amt, $label] = inv_pay_amount($r, $option === 'full' ? 'full' : 'next');
    if ($amt <= 0) throw new ShopError('Nothing is due on this invoice.');
    $body = ['intent' => 'CAPTURE', 'purchase_units' => [['reference_id' => 'default', 'custom_id' => 'inv:' . $r['id'], 'description' => mb_substr('Satin Graphic invoice #' . $r['number_text'] . ' · ' . $label, 0, 127),
        'amount' => ['currency_code' => 'CAD', 'value' => number_format($amt / 100, 2, '.', '')]]],
        'payment_source' => ['paypal' => ['experience_context' => ['brand_name' => 'Satin Graphic', 'user_action' => 'PAY_NOW', 'shipping_preference' => 'NO_SHIPPING']]]];
    [$code, $j] = shop_paypal_raw($c, 'POST', '/v2/checkout/orders', $body, 'inv-' . uuid());
    if ($code >= 300 || empty($j['id']) || !preg_match('/^[A-Z0-9-]{6,64}$/i', (string)$j['id'])) throw new ShopError('PayPal could not start the payment. Try again or pay by card.');
    idb()->prepare('INSERT INTO inv_pay_intents (id,invoice_id,provider,amount,label,created_at,funding) VALUES (?,?,?,?,?,?,?)')->execute([(string)$j['id'], $r['id'], 'paypal', $amt, $label, now_iso(), $funding === 'paylater' && $c['payLater'] ? 'paylater' : '']);
    return (string)$j['id'];
}
/** Captures an approved PayPal order created for this invoice and records it. Returns true once recorded (or already recorded). */
function inv_paypal_capture(array $r, string $orderId): bool {
    $q = idb()->prepare("SELECT * FROM inv_pay_intents WHERE id = ? AND invoice_id = ? AND provider = 'paypal'"); $q->execute([$orderId, $r['id']]); $in = $q->fetch();
    if (!$in) throw new ShopError('PayPal payment not found. Please try again.');
    $c = shop_paypal();
    $path = '/v2/checkout/orders/' . rawurlencode($orderId);
    [$code, $po] = shop_paypal_raw($c, 'GET', $path);
    if ($code !== 200 || ($po['id'] ?? '') !== $orderId) return false;
    $u = $po['purchase_units'][0] ?? [];
    if (($u['custom_id'] ?? '') !== 'inv:' . $r['id'] || ($u['amount']['currency_code'] ?? '') !== 'CAD' || shop_paypal_cents($u['amount']['value'] ?? null) !== (int)$in['amount']) { error_log('satin invoice paypal: order mismatch #' . $r['number_text']); return false; }
    if (($po['status'] ?? '') === 'APPROVED') {
        [$code, $cap] = shop_paypal_raw($c, 'POST', $path . '/capture', '{}', $orderId . '-capture');
        if ($code >= 300) { error_log('satin invoice paypal capture: ' . shop_paypal_error($cap, $code)); [$code, $po] = shop_paypal_raw($c, 'GET', $path); if ($code !== 200) return false; }
        else $po = $cap;
    }
    if (($po['status'] ?? '') !== 'COMPLETED') return false;
    $ok = false;
    foreach ($po['purchase_units'][0]['payments']['captures'] ?? [] as $cap) {
        if (($cap['status'] ?? '') !== 'COMPLETED' || ($cap['amount']['currency_code'] ?? '') !== 'CAD' || empty($cap['id'])) continue;
        $later = ($in['funding'] ?? '') === 'paylater';
        inv_record_online($r, 'paypal', (string)$cap['id'], shop_paypal_cents($cap['amount']['value'] ?? null), ($later ? 'PayPal Pay Later · ' : 'PayPal · ') . $in['label'], 'Customer (online)', 'payment', '', $later ? 'paypal_paylater' : '');
        $ok = true;
    }
    return $ok;
}
function public_invoice_route(string $path, string $method): void {
    if ($method !== 'POST') json_out(['error' => 'Use POST'], 405);
    same_origin();
    require_once __DIR__ . '/commerce.php';
    $v = body_json(8000);
    $r = inv_by_token((string)($v['t'] ?? ''));
    header('Cache-Control: private, no-store');
    try {
        if ($path === '/api/invoice/paypal/capture') {
            if (!shop_paypal_ready()) json_out(['error' => 'PayPal is not available right now.'], 503);
            shop_limit('invppcap:' . $r['id'], 20, 600);
            $ok = inv_paypal_capture($r, (string)($v['orderId'] ?? ''));
            json_out(['status' => $ok ? 'paid' : 'pending', 'invoice' => inv_public(inv_get_row($r['id']))]);
        }
        if (!inv_payable($r) || $r['status'] === 'draft') json_out(['error' => 'This invoice is not open for payment.', 'invoice' => inv_public($r)], 409);
        shop_limit('invpay:' . shop_ip(), 30, 3600, 'Too many payment attempts. Please wait and try again, or call 905-695-9147.');
        if ($path === '/api/invoice/pay-card') { $st = inv_pay_card($r, $v); json_out(['status' => $st, 'invoice' => inv_public(inv_get_row($r['id']))]); }
        if ($path === '/api/invoice/paypal/create') json_out(['orderId' => inv_paypal_create($r, (string)($v['option'] ?? 'next'), (string)($v['funding'] ?? ''))]);
    } catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
    json_out(['error' => 'Not found'], 404);
}

/* ---------- provider webhooks (called from commerce.php after the signature is verified) ---------- */
/** Square payment.created / payment.updated / refund.created / refund.updated for invoice payments. */
function inv_square_event(array $e, array $c): void {
    $obj = is_array($e['data']['object'] ?? null) ? $e['data']['object'] : [];
    $p = is_array($obj['payment'] ?? null) ? $obj['payment'] : null;
    if ($p && ($p['location_id'] ?? '') === $c['locationId'] && ($p['amount_money']['currency'] ?? '') === 'CAD') {
        $parent = inv_payment_row('square', (string)($p['id'] ?? ''));
        $r = $parent ? inv_get_row($parent['invoice_id']) : (preg_match('/^[a-f0-9-]{36}$/', (string)($p['reference_id'] ?? '')) ? inv_get_row((string)$p['reference_id']) : null);
        if ($r) {
            if (($p['status'] ?? '') === 'COMPLETED' && !$parent) { $isAp = shop_square_method_label($p) === 'Afterpay'; inv_record_online($r, 'square', (string)$p['id'], (int)($p['amount_money']['amount'] ?? 0), ($isAp ? 'Afterpay' : 'Card') . ' (confirmed by Square)', 'Square webhook', 'payment', '', $isAp ? 'afterpay' : ''); }
            foreach (array_slice((array)($p['refund_ids'] ?? []), 0, 20) as $rid) {
                if (!is_string($rid) || $rid === '') continue;
                $q =idb()->prepare("SELECT 1 FROM inv_payments WHERE provider = 'square' AND provider_id = ?"); $q->execute([$rid]); if ($q->fetch()) continue;
                try { $rf = shop_square_call($c, 'GET', '/v2/refunds/' . rawurlencode($rid))['refund'] ?? null; if (is_array($rf)) inv_square_refund($rf); } catch (Throwable $ex) { error_log('satin invoice square refund: ' . $ex->getMessage()); }
            }
        }
    }
    if (is_array($obj['refund'] ?? null)) inv_square_refund($obj['refund']);
}
function inv_square_refund(array $rf): void {
    $parent = inv_payment_row('square', (string)($rf['payment_id'] ?? ''));
    if (!$parent || empty($rf['id']) || ($rf['amount_money']['currency'] ?? '') !== 'CAD') return;
    $st = (string)($rf['status'] ?? '');
    if (in_array($st, ['PENDING', 'COMPLETED'], true)) { $r = inv_get_row($parent['invoice_id']); if ($r) inv_record_online($r, 'square', (string)$rf['id'], -abs((int)($rf['amount_money']['amount'] ?? 0)), $parent['method'] === 'afterpay' ? 'Refund to Afterpay' : 'Refund to card', 'Square', 'refund', $parent['id'], (string)$parent['method']); }
    elseif (in_array($st, ['REJECTED', 'FAILED'], true)) inv_remove_online('square', (string)$rf['id']);
}
/** PayPal webhook events for invoices. Returns true when the event belonged to an invoice. */
function inv_paypal_event(string $type, array $r): bool {
    if ($type === 'CHECKOUT.ORDER.APPROVED') {
        $q = idb()->prepare("SELECT * FROM inv_pay_intents WHERE id = ? AND provider = 'paypal'"); $q->execute([(string)($r['id'] ?? '')]); $in = $q->fetch();
        if (!$in) return false;
        if ($inv = inv_get_row($in['invoice_id'])) inv_paypal_capture($inv, $in['id']);
        return true;
    }
    $custom = (string)($r['custom_id'] ?? '');
    if ($type === 'PAYMENT.CAPTURE.COMPLETED') {
        if (!str_starts_with($custom, 'inv:')) return false;
        $inv = inv_get_row(substr($custom, 4));
        $q = idb()->prepare("SELECT funding FROM inv_pay_intents WHERE id = ? AND provider = 'paypal'"); $q->execute([(string)($r['supplementary_data']['related_ids']['order_id'] ?? '')]); $later = ($q->fetch()['funding'] ?? '') === 'paylater';
        if ($inv && ($r['status'] ?? '') === 'COMPLETED' && ($r['amount']['currency_code'] ?? '') === 'CAD' && !empty($r['id'])) inv_record_online($inv, 'paypal', (string)$r['id'], shop_paypal_cents($r['amount']['value'] ?? null), ($later ? 'PayPal Pay Later' : 'PayPal') . ' (confirmed by PayPal)', 'PayPal webhook', 'payment', '', $later ? 'paypal_paylater' : '');
        return true;
    }
    if (in_array($type, ['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'], true)) {
        $capId = '';
        foreach ($r['links'] ?? [] as $l) if (($l['rel'] ?? '') === 'up' && preg_match('#/captures/([A-Z0-9]+)$#i', (string)($l['href'] ?? ''), $m)) $capId = $m[1];
        $parent = $capId !== '' ? inv_payment_row('paypal', $capId) : null;
        if (!$parent && !str_starts_with($custom, 'inv:')) return false;
        if ($type === 'PAYMENT.CAPTURE.REVERSED') { // the resource is the capture itself (chargeback)
            $parent = $parent ?: inv_payment_row('paypal', (string)($r['id'] ?? ''));
            if ($parent && ($inv = inv_get_row($parent['invoice_id']))) inv_record_online($inv, 'paypal', 'rev-' . $parent['provider_id'], -(int)$parent['amount'], 'PayPal payment reversed', 'PayPal webhook', 'refund', $parent['id'], (string)$parent['method']);
            return true;
        }
        if ($parent && ($inv = inv_get_row($parent['invoice_id'])) && ($r['amount']['currency_code'] ?? '') === 'CAD' && !empty($r['id']) && in_array($r['status'] ?? 'COMPLETED', ['COMPLETED', 'PENDING'], true))
            inv_record_online($inv, 'paypal', (string)$r['id'], -abs(shop_paypal_cents($r['amount']['value'] ?? null)), 'Refund to PayPal', 'PayPal webhook', 'refund', $parent['id'], (string)$parent['method']);
        return true;
    }
    return false;
}

/* ---------- admin routes ---------- */
function invoices_route(string $r, string $method): void {
    $pdo = idb();

    if ($r === '/invoices' && $method === 'GET') {
        require_user('invoices.view');
        $rows = $pdo->query('SELECT * FROM invoices ORDER BY COALESCE(number,0) DESC, created_at DESC LIMIT 3000')->fetchAll();
        $list = array_map('inv_row', $rows);
        $pc = []; foreach ($pdo->query('SELECT invoice_id, COUNT(*) n FROM inv_payments GROUP BY invoice_id')->fetchAll() as $x) $pc[$x['invoice_id']] = (int)$x['n'];
        foreach ($list as &$x) $x['payCount'] = $pc[$x['id']] ?? 0;
        unset($x);
        $days = max(1, min(3650, (int)($_GET['days'] ?? 30)));
        $since = date('Y-m-d', strtotime(toronto_today() . " -$days days"));
        $q = $pdo->prepare('SELECT COALESCE(SUM(p.amount),0) s FROM inv_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.status != \'void\' AND p.date > ?'); $q->execute([$since]);
        $out = ['outstanding' => 0, 'overdue' => 0, 'paid' => (int)$q->fetch()['s']];
        foreach ($list as $i) { if (in_array($i['status'], ['sent', 'partial', 'overdue'], true)) $out['outstanding'] += $i['balance']; if ($i['status'] === 'overdue') $out['overdue'] += $i['balance']; }
        $out['counts'] = array_count_values(array_column($list, 'status'));
        json_out(['invoices' => $list, 'overview' => $out, 'methods' => INV_METHODS, 'statuses' => INV_STATUS_LABELS]);
    }
    if ($r === '/invoices/get' && $method === 'GET') {
        require_user('invoices.view');
        json_out(['invoice' => inv_row(inv_get((string)($_GET['id'] ?? '')), true), 'settings' => inv_settings(), 'methods' => INV_METHODS, 'publicUrl' => inv_public_url(inv_get((string)($_GET['id'] ?? '')))]);
    }
    if ($r === '/invoices/new' && $method === 'GET') {
        require_user('invoices.edit');
        $set = inv_settings();
        $today = toronto_today();
        $draft = ['id' => '', 'number' => $set['prefix'] . str_pad((string)$set['nextNumber'], (int)$set['pad'], '0', STR_PAD_LEFT), 'status' => 'draft', 'customer' => ['name' => '', 'company' => '', 'email' => '', 'phone' => '', 'address' => ''], 'customerId' => null,
            'title' => '', 'issueDate' => $today, 'dueDate' => date('Y-m-d', strtotime("$today +" . (int)$set['dueDays'] . ' days')), 'salesRep' => '', 'items' => [['name' => '', 'description' => '', 'qty' => 1, 'price' => 0, 'taxes' => $set['defaultTaxes']]],
            'discount' => (object)[], 'deposit' => (object)[], 'notes' => $set['notes'], 'terms' => $set['terms'], 'payments' => [], 'business' => $set['business'], 'currency' => $set['currency'], 'requestId' => null];
        if (!empty($_GET['request'])) {
            $q = $pdo->prepare('SELECT * FROM service_requests WHERE id = ?'); $q->execute([(string)$_GET['request']]);
            if ($req = $q->fetch()) {
                $d = json_decode($req['details'], true) ?: [];
                $draft['customer'] = ['name' => $req['name'], 'company' => (string)($d['custom']['company'] ?? ''), 'email' => $req['email'], 'phone' => $req['phone'], 'address' => ''];
                $draft['title'] = $req['service'] . (!empty($d['vehicle']) ? ' — ' . $d['vehicle'] : '');
                $draft['items'][0]['name'] = $req['service'];
                $draft['items'][0]['description'] = trim((string)($d['vehicle'] ?? '') . (!empty($d['plan']) ? ' · ' . $d['plan'] : ''));
                $draft['requestId'] = $req['id'];
                $q = $pdo->prepare('SELECT id FROM inv_customers WHERE lower(email) = lower(?)'); $q->execute([$req['email']]); $draft['customerId'] = $q->fetch()['id'] ?? null;
            }
        }
        if (!empty($_GET['customer'])) {
            $q = $pdo->prepare('SELECT * FROM inv_customers WHERE id = ?'); $q->execute([(string)$_GET['customer']]);
            if ($c = $q->fetch()) { $draft['customer'] = ['name' => $c['name'], 'company' => $c['company'], 'email' => $c['email'], 'phone' => $c['phone'], 'address' => $c['address']]; $draft['customerId'] = $c['id']; }
        }
        json_out(['invoice' => $draft, 'settings' => $set, 'methods' => INV_METHODS]);
    }
    if ($r === '/invoices/save' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(200000);
        $set = inv_settings();
        $id = (string)($v['id'] ?? '');
        $old = null;
        if ($id !== '') { $old = inv_get($id); if ($old['status'] === 'void') json_out(['error' => 'A voided invoice cannot be changed.'], 400); }
        $c = is_array($v['customer'] ?? null) ? $v['customer'] : [];
        $cust = ['name' => s($c['name'] ?? '', 160), 'company' => s($c['company'] ?? '', 160), 'email' => strtolower(s($c['email'] ?? '', 254)), 'phone' => s($c['phone'] ?? '', 40), 'address' => s($c['address'] ?? '', 500)];
        if (mb_strlen($cust['name']) < 2) json_out(['error' => 'Add the customer name.'], 400);
        if ($cust['email'] !== '' && !filter_var($cust['email'], FILTER_VALIDATE_EMAIL)) json_out(['error' => 'The customer email is not valid.'], 400);
        $taxIds = array_column($set['taxes'], 'id');
        $items = [];
        foreach (array_slice(is_array($v['items'] ?? null) ? $v['items'] : [], 0, 100) as $it) {
            if (!is_array($it)) continue;
            $name = s($it['name'] ?? '', 200); $desc = s($it['description'] ?? '', 2000);
            $qty = is_numeric($it['qty'] ?? null) ? round((float)$it['qty'], 3) : 1;
            $price = cents($it['price'] ?? 0);
            if ($name === '' && $desc === '' && $price === 0) continue;
            if ($qty < 0 || $qty > 1000000 || abs($price) > 100000000) json_out(['error' => 'Check the quantity and price of “' . $name . '”.'], 400);
            $items[] = ['name' => $name ?: 'Item', 'description' => $desc, 'qty' => $qty, 'price' => $price, 'taxes' => array_values(array_intersect(is_array($it['taxes'] ?? null) ? $it['taxes'] : [], $taxIds))];
        }
        if (!$items) json_out(['error' => 'Add at least one product or service.'], 400);
        $dv = is_array($v['discount'] ?? null) ? $v['discount'] : [];
        $discount = in_array($dv['type'] ?? '', ['percent', 'amount'], true) && is_numeric($dv['value'] ?? null) && (float)$dv['value'] > 0 ? ['type' => $dv['type'], 'value' => round((float)$dv['value'], 2)] : [];
        $calc = inv_calc(array_map(function ($i) { return $i + ['price' => $i['price']]; }, $items), $discount, $set['taxes']);
        $issue = vdate($v['issueDate'] ?? '', toronto_today());
        $due = vdate($v['dueDate'] ?? '', date('Y-m-d', strtotime("$issue +30 days")));
        if ($due < $issue) json_out(['error' => 'The due date is before the issue date.'], 400);
        $deposit = inv_plan_clean($v['deposit'] ?? null, $calc['total'], $issue, $due); // deposit or payment schedule
        if (is_string($deposit)) json_out(['error' => $deposit], 400);
        $customerId = inv_customer_upsert($cust, is_string($v['customerId'] ?? null) ? $v['customerId'] : null);
        $now = now_iso();
        $fields = ['customer_id' => $customerId, 'customer' => json_encode($cust, JSON_UNESCAPED_UNICODE), 'title' => s($v['title'] ?? '', 200), 'issue_date' => $issue, 'due_date' => $due, 'sales_rep' => s($v['salesRep'] ?? '', 120),
            'items' => json_encode($items, JSON_UNESCAPED_UNICODE), 'discount' => json_encode((object)$discount), 'deposit' => json_encode((object)$deposit), 'notes' => s($v['notes'] ?? '', 3000), 'terms' => s($v['terms'] ?? '', 3000),
            'subtotal' => $calc['subtotal'], 'discount_total' => $calc['discount'], 'tax_total' => $calc['tax'], 'taxes' => json_encode($calc['taxes'], JSON_UNESCAPED_UNICODE), 'total' => $calc['total'], 'updated_at' => $now];
        if ($old) {
            $sets = implode(', ', array_map(function ($k) { return "$k = ?"; }, array_keys($fields)));
            $pdo->prepare("UPDATE invoices SET $sets WHERE id = ?")->execute(array_merge(array_values($fields), [$id]));
            audit($u, 'updated invoice', '#' . $old['number_text']);
        } else {
            $pdo->beginTransaction();
            $set = inv_settings(); $num = (int)$set['nextNumber'];
            $q = $pdo->query('SELECT MAX(number) m FROM invoices'); $max = (int)($q->fetch()['m'] ?? 0); if ($max >= $num) $num = $max + 1;
            $set['nextNumber'] = $num + 1; inv_settings_save($set);
            $id = uuid();
            $fields += ['id' => $id, 'number' => $num, 'number_text' => $set['prefix'] . str_pad((string)$num, (int)$set['pad'], '0', STR_PAD_LEFT), 'status' => 'draft', 'currency' => $set['currency'], 'business' => json_encode($set['business'], JSON_UNESCAPED_UNICODE),
                'token' => token(), 'request_id' => is_string($v['requestId'] ?? null) ? substr($v['requestId'], 0, 40) : null, 'created_by' => $u['name'], 'created_at' => $now];
            $pdo->prepare('INSERT INTO invoices (' . implode(',', array_keys($fields)) . ') VALUES (' . implode(',', array_fill(0, count($fields), '?')) . ')')->execute(array_values($fields));
            $pdo->commit();
            audit($u, 'created invoice', '#' . $fields['number_text']);
        }
        // remember products/services for next time
        foreach ($items as $it) if ($it['name'] !== 'Item') {
            $q = $pdo->prepare('SELECT id FROM inv_items WHERE name = ?'); $q->execute([$it['name']]);
            if ($row = $q->fetch()) $pdo->prepare('UPDATE inv_items SET description = ?, price = ?, taxes = ?, used = used + 1, updated_at = ? WHERE id = ?')->execute([$it['description'], $it['price'], json_encode($it['taxes']), $now, $row['id']]);
            else $pdo->prepare('INSERT INTO inv_items (id,name,description,price,taxes,used,updated_at) VALUES (?,?,?,?,?,1,?)')->execute([uuid(), $it['name'], $it['description'], $it['price'], json_encode($it['taxes']), $now]);
        }
        $row = inv_get($id);
        if (!empty($v['finalize']) && $row['status'] === 'draft') { $pdo->prepare('UPDATE invoices SET status = \'sent\', updated_at = ? WHERE id = ?')->execute([$now, $id]); $row = inv_get($id); }
        json_out(['ok' => true, 'invoice' => inv_row($row, true), 'publicUrl' => inv_public_url($row)]);
    }
    if ($r === '/invoices/send' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(20000);
        $row = inv_get((string)($v['id'] ?? ''));
        if ($row['status'] === 'void') json_out(['error' => 'This invoice is void.'], 400);
        $to = strtolower(s($v['to'] ?? '', 254));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Add a valid email address.'], 400);
        if (rate_limited('invsend:' . $u['id'], 60, 3600)) json_out(['error' => 'Too many emails. Try again later.'], 429);
        note_attempt('invsend:' . $u['id']);
        $set = inv_settings();
        $now = now_iso();
        $pdo->prepare('UPDATE invoices SET status = CASE WHEN status = \'draft\' THEN \'sent\' ELSE status END, sent_at = ?, updated_at = ? WHERE id = ?')->execute([$now, $now, $row['id']]);
        $row = inv_get($row['id']);
        $ok = inv_send_mail($row, $set, $to, s($v['message'] ?? $set['emailMessage'], 4000));
        audit($u, 'sent invoice', '#' . $row['number_text'] . ' to ' . $to . ($ok ? '' : ' (mail failed)'));
        json_out(['ok' => true, 'emailed' => $ok, 'invoice' => inv_row($row, true)]);
    }
    if ($r === '/invoices/mark-sent' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $row = inv_get((string)(body_json(2000)['id'] ?? ''));
        if ($row['status'] === 'draft') idb()->prepare('UPDATE invoices SET status = \'sent\', updated_at = ? WHERE id = ?')->execute([now_iso(), $row['id']]);
        audit($u, 'finalized invoice', '#' . $row['number_text']);
        json_out(['ok' => true, 'invoice' => inv_row(inv_get($row['id']), true)]);
    }
    if ($r === '/invoices/payment' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(4000);
        $row = inv_get((string)($v['id'] ?? ''));
        if (in_array($row['status'], ['void'], true)) json_out(['error' => 'This invoice is void.'], 400);
        $amt = cents($v['amount'] ?? 0);
        if ($amt <= 0) json_out(['error' => 'Enter the amount received.'], 400);
        $method = isset(INV_METHODS[$v['method'] ?? '']) ? $v['method'] : 'other';
        $pdo->prepare('INSERT INTO inv_payments (id,invoice_id,date,amount,method,note,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')->execute([uuid(), $row['id'], vdate($v['date'] ?? '', toronto_today()), $amt, $method, s($v['note'] ?? '', 300), $u['name'], now_iso()]);
        if ($row['status'] === 'draft') $pdo->prepare('UPDATE invoices SET status = \'sent\' WHERE id = ?')->execute([$row['id']]);
        inv_refresh_paid($row['id']);
        audit($u, 'recorded payment', '#' . $row['number_text'] . ' ' . money_fmt($amt));
        json_out(['ok' => true, 'invoice' => inv_row(inv_get($row['id']), true)]);
    }
    if ($r === '/invoices/payment/delete' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(2000);
        $q = $pdo->prepare('SELECT * FROM inv_payments WHERE id = ?'); $q->execute([(string)($v['paymentId'] ?? '')]); $p = $q->fetch();
        if (!$p) json_out(['error' => 'Payment not found'], 404);
        if (($p['provider_id'] ?? '') !== '') json_out(['error' => 'Online payments and refunds come from ' . ucfirst((string)$p['provider']) . ' and cannot be removed. Use “Refund” instead.'], 400);
        $q = $pdo->prepare("SELECT COUNT(*) n FROM inv_payments WHERE parent_id = ?"); $q->execute([$p['id']]);
        if ((int)$q->fetch()['n'] > 0) json_out(['error' => 'This payment has refunds recorded against it. Remove the refunds first.'], 400);
        $pdo->prepare('DELETE FROM inv_payments WHERE id = ?')->execute([$p['id']]);
        inv_refresh_paid($p['invoice_id']);
        $row = inv_get($p['invoice_id']);
        audit($u, 'removed ' . ((int)$p['amount'] < 0 ? 'refund' : 'payment'), '#' . $row['number_text'] . ' ' . money_fmt(abs((int)$p['amount'])));
        json_out(['ok' => true, 'invoice' => inv_row($row, true)]);
    }
    if ($r === '/invoices/refund' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(4000);
        $row = inv_get((string)($v['id'] ?? ''));
        if ($row['status'] === 'draft') json_out(['error' => 'Draft invoices have no payments to refund.'], 400);
        $q = $pdo->prepare("SELECT * FROM inv_payments WHERE id = ? AND invoice_id = ? AND amount > 0"); $q->execute([(string)($v['paymentId'] ?? ''), $row['id']]); $p = $q->fetch();
        if (!$p) json_out(['error' => 'Choose the payment to refund.'], 400);
        $q = $pdo->prepare('SELECT COALESCE(SUM(-amount),0) s FROM inv_payments WHERE parent_id = ?'); $q->execute([$p['id']]);
        $left = (int)$p['amount'] - (int)$q->fetch()['s'];
        $amt = cents($v['amount'] ?? 0);
        if ($amt <= 0) json_out(['error' => 'Enter the refund amount.'], 400);
        if ($amt > $left) json_out(['error' => 'You can refund at most ' . money_fmt($left) . ' of this payment.'], 400);
        $note = s($v['note'] ?? '', 200);
        $online = !empty($v['online']) && ($p['provider_id'] ?? '') !== '';
        if (rate_limited('invrefund:' . $u['id'], 30, 3600)) json_out(['error' => 'Too many refunds. Try again later.'], 429);
        note_attempt('invrefund:' . $u['id']);
        if ($online) {
            require_once __DIR__ . '/commerce.php';
            $idem = substr(hash('sha256', $p['id'] . ':' . $amt . ':' . $left), 0, 40); // same click twice = one refund
            try {
                if ($p['provider'] === 'square') {
                    $c = shop_square(); if (!shop_square_ready($c)) json_out(['error' => 'Square is not connected (Admin → Payments).'], 400);
                    [$code, $j] = shop_square_raw($c, 'POST', '/v2/refunds', ['idempotency_key' => $idem, 'payment_id' => $p['provider_id'], 'amount_money' => ['amount' => $amt, 'currency' => 'CAD'], 'reason' => mb_substr($note ?: 'Refund for invoice #' . $row['number_text'], 0, 190)]);
                    $rf = $j['refund'] ?? null;
                    if ($code >= 300 || !is_array($rf) || empty($rf['id'])) json_out(['error' => 'Square refused the refund: ' . mb_substr((string)($j['errors'][0]['detail'] ?? $j['errors'][0]['code'] ?? ('HTTP ' . $code)), 0, 200)], 400);
                    if (in_array($rf['status'] ?? '', ['REJECTED', 'FAILED'], true)) json_out(['error' => 'Square could not refund this payment (' . $rf['status'] . ').'], 400);
                    $rid = (string)$rf['id']; $amt = abs((int)($rf['amount_money']['amount'] ?? $amt));
                } elseif ($p['provider'] === 'paypal') {
                    $c = shop_paypal(); if (!shop_paypal_ready($c)) json_out(['error' => 'PayPal is not connected (Admin → Payments).'], 400);
                    [$code, $j] = shop_paypal_raw($c, 'POST', '/v2/payments/captures/' . rawurlencode($p['provider_id']) . '/refund', ['amount' => ['value' => number_format($amt / 100, 2, '.', ''), 'currency_code' => 'CAD'], 'note_to_payer' => mb_substr($note ?: 'Refund for invoice #' . $row['number_text'], 0, 255)], 'invrf-' . $idem);
                    if ($code >= 300 || empty($j['id'])) json_out(['error' => 'PayPal refused the refund: ' . shop_paypal_error($j, $code)], 400);
                    $rid = (string)$j['id'];
                } else json_out(['error' => 'Unknown payment provider.'], 400);
            } catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
            inv_record_online($row, $p['provider'], $rid, -$amt, 'Refund' . ($note ? ' · ' . $note : ''), $u['name'], 'refund', $p['id'], (string)$p['method']);
        } else {
            $pdo->prepare('INSERT INTO inv_payments (id,invoice_id,date,amount,method,note,created_by,created_at,provider,provider_id,kind,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([uuid(), $row['id'], vdate($v['date'] ?? '', toronto_today()), -$amt, $p['method'], 'Refund' . ($note ? ' · ' . $note : ''), $u['name'], now_iso(), '', '', 'refund', $p['id']]);
            inv_refresh_paid($row['id']);
        }
        audit($u, 'refunded invoice payment', '#' . $row['number_text'] . ' ' . money_fmt($amt) . ($online ? ' via ' . $p['provider'] : ' (recorded)'));
        json_out(['ok' => true, 'invoice' => inv_row(inv_get($row['id']), true)]);
    }
    if ($r === '/invoices/void' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $row = inv_get((string)(body_json(2000)['id'] ?? ''));
        $pdo->prepare('UPDATE invoices SET status = \'void\', updated_at = ? WHERE id = ?')->execute([now_iso(), $row['id']]);
        audit($u, 'voided invoice', '#' . $row['number_text']);
        json_out(['ok' => true]);
    }
    if ($r === '/invoices/delete' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(2000);
        $row = inv_get((string)($v['id'] ?? ''));
        $q = $pdo->prepare('SELECT COUNT(*) n FROM inv_payments WHERE invoice_id = ?'); $q->execute([$row['id']]); $pays = (int)$q->fetch()['n'];
        // Invoices with payments or refunds on record need the number typed back (the money history goes with it).
        if (($pays > 0 || (int)$row['paid'] > 0) && trim(ltrim((string)($v['confirm'] ?? ''), '#')) !== $row['number_text']) json_out(['error' => 'Type the invoice number ' . $row['number_text'] . ' to delete an invoice with payments.'], 400);
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM inv_payments WHERE invoice_id = ?')->execute([$row['id']]);
        $pdo->prepare('DELETE FROM inv_pay_intents WHERE invoice_id = ?')->execute([$row['id']]);
        $pdo->prepare('DELETE FROM invoices WHERE id = ?')->execute([$row['id']]);
        $pdo->commit();
        $c = json_decode($row['customer'], true) ?: [];
        audit($u, $row['status'] === 'draft' && !$pays ? 'deleted draft invoice' : 'deleted invoice', '#' . $row['number_text'] . ' · ' . ($c['name'] ?? '') . ' · ' . inv_status($row) . ' · total ' . money_fmt((int)$row['total'], $row['currency']) . ($pays ? " · $pays payment record(s) removed, paid " . money_fmt((int)$row['paid'], $row['currency']) : ''));
        json_out(['ok' => true]);
    }
    if ($r === '/invoices/settings' && $method === 'GET') { require_user('invoices.view'); json_out(['settings' => inv_settings()]); }
    if ($r === '/invoices/settings' && $method === 'POST') {
        $u = require_user('invoices.edit');
        if (!in_array('settings.edit', $u['permissions'], true)) json_out(['error' => 'Only the owner or a site admin can change invoice settings.'], 403);
        $v = body_json(40000)['settings'] ?? [];
        if (!is_array($v) || !$v) json_out(['error' => 'Nothing to save.'], 400);
        $cur = inv_settings();
        $v = array_replace($cur, $v);
        if (!isset($v['taxes']) || !is_array($v['taxes'])) $v['taxes'] = $cur['taxes'];
        $v['business'] = array_replace($cur['business'], is_array($v['business'] ?? null) ? $v['business'] : []);
        $b = is_array($v['business'] ?? null) ? $v['business'] : [];
        $taxes = [];
        foreach (array_slice(is_array($v['taxes'] ?? null) ? $v['taxes'] : [], 0, 10) as $t) {
            $name = s($t['name'] ?? '', 40); $rate = is_numeric($t['rate'] ?? null) ? round((float)$t['rate'], 3) : -1;
            if ($name === '' || $rate < 0 || $rate > 100) continue;
            $id = preg_match('/^[a-z0-9]{1,20}$/', (string)($t['id'] ?? '')) ? $t['id'] : substr(preg_replace('/[^a-z0-9]/', '', strtolower($name)) . bin2hex(random_bytes(2)), 0, 20);
            $taxes[] = ['id' => $id, 'name' => $name, 'rate' => $rate];
        }
        $q = $pdo->query('SELECT MAX(number) m FROM invoices'); $max = (int)($q->fetch()['m'] ?? 0);
        $next = max((int)($v['nextNumber'] ?? $cur['nextNumber']), $max + 1, 1);
        $new = ['business' => ['name' => s($b['name'] ?? '', 160), 'address' => s($b['address'] ?? '', 500), 'email' => s($b['email'] ?? '', 254), 'phone' => s($b['phone'] ?? '', 60), 'taxNumber' => s($b['taxNumber'] ?? '', 120), 'logo' => cms_img_url($b['logo'] ?? ''), 'website' => s($b['website'] ?? '', 120)],
            'prefix' => preg_replace('/[^A-Za-z0-9-]/', '', s($v['prefix'] ?? '', 10)), 'nextNumber' => $next, 'pad' => max(1, min(10, (int)($v['pad'] ?? 7))), 'dueDays' => max(0, min(365, (int)($v['dueDays'] ?? 30))),
            'currency' => 'CAD', 'taxes' => $taxes, 'defaultTaxes' => array_values(array_intersect(is_array($v['defaultTaxes'] ?? null) ? $v['defaultTaxes'] : [], array_column($taxes, 'id'))),
            'notes' => s($v['notes'] ?? '', 3000), 'terms' => s($v['terms'] ?? '', 3000), 'emailMessage' => s($v['emailMessage'] ?? '', 3000) ?: $cur['emailMessage']];
        inv_settings_save($new);
        audit($u, 'updated invoice settings');
        json_out(['ok' => true, 'settings' => inv_settings()]);
    }
    if ($r === '/invoices/lookup' && $method === 'GET') {
        require_user('invoices.edit');
        $customers = $pdo->query('SELECT c.*, (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) n FROM inv_customers c ORDER BY c.updated_at DESC LIMIT 2000')->fetchAll();
        $items = $pdo->query('SELECT name, description, price, taxes FROM inv_items ORDER BY used DESC, updated_at DESC LIMIT 500')->fetchAll();
        json_out(['customers' => array_map(function ($c) { return ['id' => $c['id'], 'name' => $c['name'], 'company' => $c['company'], 'email' => $c['email'], 'phone' => $c['phone'], 'address' => $c['address'], 'notes' => $c['notes']]; }, $customers),
            'items' => array_map(function ($i) { return ['name' => $i['name'], 'description' => $i['description'], 'price' => (int)$i['price'], 'taxes' => json_decode($i['taxes'], true) ?: []]; }, $items)]);
    }
    if ($r === '/customers' && $method === 'GET') {
        require_user('invoices.view');
        $rows = $pdo->query('SELECT c.*, COUNT(i.id) n, COALESCE(SUM(CASE WHEN i.status != \'void\' AND i.status != \'draft\' THEN i.total ELSE 0 END),0) billed, COALESCE(SUM(CASE WHEN i.status != \'void\' AND i.status != \'draft\' THEN i.total - i.paid ELSE 0 END),0) balance, MAX(i.issue_date) last FROM inv_customers c LEFT JOIN invoices i ON i.customer_id = c.id GROUP BY c.id ORDER BY c.name COLLATE NOCASE LIMIT 5000')->fetchAll();
        json_out(['customers' => array_map(function ($c) { return ['id' => $c['id'], 'name' => $c['name'], 'company' => $c['company'], 'email' => $c['email'], 'phone' => $c['phone'], 'address' => $c['address'], 'notes' => $c['notes'], 'vehicles' => json_decode((string)($c['vehicles'] ?? ''), true) ?: [], 'created' => $c['created_at'], 'invoices' => (int)$c['n'], 'billed' => (int)$c['billed'], 'balance' => max(0, (int)$c['balance']), 'last' => $c['last']]; }, $rows)]);
    }
    if ($r === '/customers/save' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(8000);
        $c = ['name' => s($v['name'] ?? '', 160), 'company' => s($v['company'] ?? '', 160), 'email' => strtolower(s($v['email'] ?? '', 254)), 'phone' => s($v['phone'] ?? '', 40), 'address' => s($v['address'] ?? '', 500)];
        if (mb_strlen($c['name']) < 2) json_out(['error' => 'Add the customer name.'], 400);
        if ($c['email'] !== '' && !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) json_out(['error' => 'The email is not valid.'], 400);
        $id = inv_customer_upsert($c, is_string($v['id'] ?? null) && $v['id'] !== '' ? $v['id'] : null);
        if (array_key_exists('notes', $v)) $pdo->prepare('UPDATE inv_customers SET notes = ? WHERE id = ?')->execute([s($v['notes'], 4000), $id]);
        audit($u, 'saved customer', $c['name']);
        $q = $pdo->prepare('SELECT id, name, company, email, phone, address, notes FROM inv_customers WHERE id = ?'); $q->execute([$id]);
        json_out(['ok' => true, 'id' => $id, 'customer' => $q->fetch() ?: null]);
    }

    if ($r === '/customers/import' && $method === 'POST') {
        $u = require_user('invoices.edit');
        $v = body_json(4000000);
        $rows = is_array($v['rows'] ?? null) ? array_values($v['rows']) : [];
        $mode = in_array($v['mode'] ?? '', ['update', 'skip', 'fill'], true) ? $v['mode'] : 'update';
        $dry = !empty($v['dryRun']);
        if (!$rows) json_out(['error' => 'The file has no customer rows.'], 400);
        if (count($rows) > 5000) json_out(['error' => 'Import at most 5,000 customers at a time.'], 400);
        $digits = function (string $p): string { $d = preg_replace('/\D+/', '', $p); return strlen($d) === 11 && $d[0] === '1' ? substr($d, 1) : $d; };
        $byEmail = []; $byPhone = []; $byName = []; $all = [];
        foreach ($pdo->query('SELECT * FROM inv_customers')->fetchAll() as $c) {
            $all[$c['id']] = $c;
            if ($c['email'] !== '') $byEmail[strtolower($c['email'])] = $c['id'];
            $d = $digits($c['phone']); if (strlen($d) >= 7) $byPhone[$d] = $c['id'];
            $byName[mb_strtolower(trim($c['name'] . '|' . $c['company']))] = $c['id'];
        }
        $res = ['created' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => []];
        $now = now_iso();
        $pdo->beginTransaction();
        try {
            foreach ($rows as $i => $row) {
                $line = (int)($row['_line'] ?? ($i + 2));
                if (!is_array($row)) { $res['errors'][] = ['line' => $line, 'error' => 'Unreadable row']; continue; }
                $c = ['name' => s($row['name'] ?? '', 160), 'company' => s($row['company'] ?? '', 160), 'email' => strtolower(s($row['email'] ?? '', 254)), 'phone' => s($row['phone'] ?? '', 40), 'address' => s($row['address'] ?? '', 500), 'notes' => s($row['notes'] ?? '', 4000)];
                if ($c['name'] === '' && $c['company'] !== '') $c['name'] = $c['company'];
                if ($c['name'] === '' && $c['email'] !== '') $c['name'] = explode('@', $c['email'])[0];
                if (mb_strlen($c['name']) < 2) { $res['errors'][] = ['line' => $line, 'error' => 'Missing name (2+ characters)']; continue; }
                if ($c['email'] !== '' && !filter_var($c['email'], FILTER_VALIDATE_EMAIL)) { $res['errors'][] = ['line' => $line, 'error' => 'Invalid email: ' . $c['email']]; continue; }
                $id = null;
                if ($c['email'] !== '' && isset($byEmail[$c['email']])) $id = $byEmail[$c['email']];
                $d = $digits($c['phone']);
                if (!$id && strlen($d) >= 7 && isset($byPhone[$d])) $id = $byPhone[$d];
                $nk = mb_strtolower(trim($c['name'] . '|' . $c['company']));
                if (!$id && isset($byName[$nk])) $id = $byName[$nk];
                if ($id) {
                    if ($mode === 'skip') { $res['skipped']++; continue; }
                    $old = $all[$id];
                    $n = [];
                    foreach (['name', 'company', 'email', 'phone', 'address', 'notes'] as $k) $n[$k] = $mode === 'fill' ? ((string)$old[$k] !== '' ? $old[$k] : $c[$k]) : ($c[$k] !== '' ? $c[$k] : $old[$k]);
                    $same = true; foreach ($n as $k => $val) if ((string)$old[$k] !== (string)$val) $same = false;
                    if ($same) { $res['skipped']++; continue; }
                    if (!$dry) $pdo->prepare('UPDATE inv_customers SET name=?, company=?, email=?, phone=?, address=?, notes=?, updated_at=? WHERE id=?')->execute([$n['name'], $n['company'], $n['email'], $n['phone'], $n['address'], $n['notes'], $now, $id]);
                    $all[$id] = array_merge($old, $n);
                    $res['updated']++;
                } else {
                    $id = uuid();
                    if (!$dry) $pdo->prepare('INSERT INTO inv_customers (id,name,company,email,phone,address,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')->execute([$id, $c['name'], $c['company'], $c['email'], $c['phone'], $c['address'], $c['notes'], $now, $now]);
                    $all[$id] = $c;
                    $res['created']++;
                }
                if ($c['email'] !== '') $byEmail[$c['email']] = $id;
                if (strlen($d) >= 7) $byPhone[$d] = $id;
                $byName[$nk] = $id;
            }
            if ($dry) $pdo->rollBack(); else $pdo->commit();
        } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); json_out(['error' => 'Import failed — nothing was saved.'], 500); }
        if (!$dry) audit($u, 'imported customers', $res['created'] . ' new, ' . $res['updated'] . ' updated');
        $res['errors'] = array_slice($res['errors'], 0, 200);
        $res['dryRun'] = $dry;
        json_out($res);
    }

    /* ---------- analytics ---------- */
    if ($r === '/analytics' && $method === 'GET') {
        $u = require_user('dashboard.view');
        $days = in_array((int)($_GET['days'] ?? 30), [1, 7, 30, 90, 365], true) ? (int)$_GET['days'] : 30;
        $today = toronto_today();
        $start = date('Y-m-d', strtotime("$today -" . ($days - 1) . ' days'));
        $prevStart = date('Y-m-d', strtotime("$start -$days days"));
        $prevEnd = date('Y-m-d', strtotime("$start -1 day"));
        $labels = []; for ($d = $start; $d <= $today; $d = date('Y-m-d', strtotime("$d +1 day"))) $labels[] = $d;
        $series = function (string $sql, array $p) use ($pdo, $labels) { $q = $pdo->prepare($sql); $q->execute($p); $m = []; foreach ($q->fetchAll() as $r) $m[$r['d']] = (float)$r['v']; return array_map(function ($d) use ($m) { return $m[$d] ?? 0; }, $labels); };
        $one = function (string $sql, array $p) use ($pdo) { $q = $pdo->prepare($sql); $q->execute($p); return (float)($q->fetch()['v'] ?? 0); };
        $out = ['days' => $days, 'labels' => $labels, 'metrics' => []];
        $add = function ($key, $label, $cur, $prev, $data, $money = false) use (&$out) { $out['metrics'][$key] = ['label' => $label, 'value' => $cur, 'prev' => $prev, 'series' => $data, 'money' => $money]; };
        $add('sessions', 'Site sessions', $one('SELECT COUNT(DISTINCT day || session) v FROM site_visits WHERE kind = \'pv\' AND day BETWEEN ? AND ?', [$start, $today]), $one('SELECT COUNT(DISTINCT day || session) v FROM site_visits WHERE kind = \'pv\' AND day BETWEEN ? AND ?', [$prevStart, $prevEnd]),
            $series('SELECT day d, COUNT(DISTINCT session) v FROM site_visits WHERE kind = \'pv\' AND day BETWEEN ? AND ? GROUP BY day', [$start, $today]));
        $add('pageviews', 'Page views', $one('SELECT COUNT(*) v FROM site_visits WHERE kind = \'pv\' AND day BETWEEN ? AND ?', [$start, $today]), $one('SELECT COUNT(*) v FROM site_visits WHERE kind = \'pv\' AND day BETWEEN ? AND ?', [$prevStart, $prevEnd]),
            $series('SELECT day d, COUNT(*) v FROM site_visits WHERE kind = \'pv\' AND day BETWEEN ? AND ? GROUP BY day', [$start, $today]));
        $add('contact', 'Clicks to contact', $one('SELECT COUNT(*) v FROM site_visits WHERE kind = \'contact\' AND day BETWEEN ? AND ?', [$start, $today]), $one('SELECT COUNT(*) v FROM site_visits WHERE kind = \'contact\' AND day BETWEEN ? AND ?', [$prevStart, $prevEnd]),
            $series('SELECT day d, COUNT(*) v FROM site_visits WHERE kind = \'contact\' AND day BETWEEN ? AND ? GROUP BY day', [$start, $today]));
        // service_requests.created_at is UTC ISO; compare on the date part (close enough for daily stats)
        $add('requests', 'Quote & booking requests', $one('SELECT COUNT(*) v FROM service_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', [$start, $today]), $one('SELECT COUNT(*) v FROM service_requests WHERE substr(created_at,1,10) BETWEEN ? AND ?', [$prevStart, $prevEnd]),
            $series('SELECT substr(created_at,1,10) d, COUNT(*) v FROM service_requests WHERE substr(created_at,1,10) BETWEEN ? AND ? GROUP BY d', [$start, $today]));
        if (in_array('invoices.view', $u['permissions'], true)) {
            $add('paid', 'Amount paid', $one('SELECT COALESCE(SUM(p.amount),0) v FROM inv_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.status != \'void\' AND p.date BETWEEN ? AND ?', [$start, $today]), $one('SELECT COALESCE(SUM(p.amount),0) v FROM inv_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.status != \'void\' AND p.date BETWEEN ? AND ?', [$prevStart, $prevEnd]),
                $series('SELECT p.date d, SUM(p.amount) v FROM inv_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.status != \'void\' AND p.date BETWEEN ? AND ? GROUP BY p.date', [$start, $today]), true);
            $add('invoiced', 'Total invoiced', $one('SELECT COALESCE(SUM(total),0) v FROM invoices WHERE status NOT IN (\'void\',\'draft\') AND issue_date BETWEEN ? AND ?', [$start, $today]), $one('SELECT COALESCE(SUM(total),0) v FROM invoices WHERE status NOT IN (\'void\',\'draft\') AND issue_date BETWEEN ? AND ?', [$prevStart, $prevEnd]),
                $series('SELECT issue_date d, SUM(total) v FROM invoices WHERE status NOT IN (\'void\',\'draft\') AND issue_date BETWEEN ? AND ? GROUP BY issue_date', [$start, $today]), true);
            $outstanding = 0; $overdue = 0; $openCount = 0;
            foreach ($pdo->query('SELECT * FROM invoices WHERE status IN (\'sent\')') as $row) { $st = inv_status($row); $bal = max(0, (int)$row['total'] - (int)$row['paid']); if (in_array($st, ['sent', 'partial', 'overdue'], true)) { $outstanding += $bal; $openCount++; } if ($st === 'overdue') $overdue += $bal; }
            $out['invoices'] = ['outstanding' => $outstanding, 'overdue' => $overdue, 'open' => $openCount, 'recent' => array_map('inv_row', $pdo->query('SELECT * FROM invoices WHERE status != \'void\' ORDER BY updated_at DESC LIMIT 6')->fetchAll())];
        }
        $top = function (string $col) use ($pdo, $start, $today) { $q = $pdo->prepare("SELECT $col k, COUNT(DISTINCT day || session) v FROM site_visits WHERE kind = 'pv' AND day BETWEEN ? AND ? GROUP BY $col ORDER BY v DESC LIMIT 8"); $q->execute([$start, $today]); return array_map(function ($r) { return ['label' => $r['k'], 'value' => (int)$r['v']]; }, $q->fetchAll()); };
        $q = $pdo->prepare("SELECT path k, COUNT(*) v FROM site_visits WHERE kind = 'pv' AND day BETWEEN ? AND ? GROUP BY path ORDER BY v DESC LIMIT 8"); $q->execute([$start, $today]);
        $titles = []; foreach (pages_titles() as $p) $titles[$p['path']] = $p['title'];
        $out['topPages'] = array_map(function ($r) use ($titles) { return ['label' => $titles[$r['k']] ?? $r['k'], 'path' => $r['k'], 'value' => (int)$r['v']]; }, $q->fetchAll());
        $out['sources'] = $top('source'); $out['devices'] = $top('device'); $out['languages'] = $top('lang');
        $out['activeNow'] = (int)$one('SELECT COUNT(DISTINCT session) v FROM site_visits WHERE ts > ?', [time() - 300]);
        if ($days === 1) { // Today: hour-by-hour (Toronto time) instead of one point per day
            $tz = new DateTimeZone('America/Toronto'); $hr = function ($ts) use ($tz) { return (int)(new DateTime('@' . (int)$ts))->setTimezone($tz)->format('G'); };
            $H = range(0, 23); $out['labels'] = array_map(fn($h) => sprintf('%02d:00', $h), $H);
            $ses = array_fill(0, 24, []); $pv = array_fill(0, 24, 0); $ct = array_fill(0, 24, 0);
            $q = $pdo->prepare('SELECT ts, session, kind FROM site_visits WHERE day = ?'); $q->execute([$today]);
            foreach ($q->fetchAll() as $v) { $h = $hr($v['ts']); if ($v['kind'] === 'pv') { $pv[$h]++; $ses[$h][$v['session']] = 1; } elseif ($v['kind'] === 'contact') $ct[$h]++; }
            $rq = array_fill(0, 24, 0); $q = $pdo->prepare('SELECT created_at FROM service_requests WHERE created_at >= ?'); $q->execute([gmdate('Y-m-d', strtotime("$today -1 day"))]);
            foreach ($q->fetchAll() as $v) { $t = strtotime($v['created_at']); if ((new DateTime('@' . $t))->setTimezone($tz)->format('Y-m-d') === $today) $rq[$hr($t)]++; }
            $out['metrics']['sessions']['series'] = array_map('count', $ses); $out['metrics']['pageviews']['series'] = $pv; $out['metrics']['contact']['series'] = $ct; $out['metrics']['requests']['series'] = $rq;
            foreach (['paid', 'invoiced'] as $k) if (isset($out['metrics'][$k])) $out['metrics'][$k]['series'] = array_fill(0, 24, 0);
        }
        json_out($out);
    }

    json_out(['error' => 'Not found'], 404);
}

function cms_img_url($v): string { $v = is_string($v) ? trim($v) : ''; return preg_match('#^(https?://|/(?!/))[^\s"\'<>]*$#', $v) ? mb_substr($v, 0, 500) : ''; }
function pages_titles(): array {
    $f = __DIR__ . '/storage/pages-index.json';
    if (is_file($f)) { $d = json_decode((string)file_get_contents($f), true); if (is_array($d)) return $d; }
    return [];
}
