<?php
declare(strict_types=1);
// Satin e-Sign: agreement templates (PDF pages + placed fields), signing links (email or public link),
// signed PDF with an audit trail page, emailed to every signer and to the shop. Admin UI: /admin/esign.js, signer page: /esign/.
//
// Documents can have several signers (table esign_signers): each gets their own link and signs only the fields assigned to
// them (field.signer = s1, s2, …). A signer adopts one signature and it is placed in every signature field of theirs —
// on the agreement and on an optional uploaded Approval Form (pages with kind = approval).
// Edit & Resend: a document that was already sent is never changed — a new version (same record_id, version + 1) is made;
// when it is sent, the older versions are superseded (their links stop working; signed copies stay as they are).

const ES_TYPES = ['signature', 'initials', 'date', 'name', 'email', 'text', 'checkbox'];
const ES_MAX_PAGES = 40;
const ES_MAX_SIGNERS = 10;

function es_db(): PDO {
    static $done = false;
    $pdo = adb();
    if ($done) return $pdo;
    $done = true;
    $pdo->exec("CREATE TABLE IF NOT EXISTS esign_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'template', pages TEXT NOT NULL DEFAULT '[]', fields TEXT NOT NULL DEFAULT '[]', message TEXT NOT NULL DEFAULT '', link_token TEXT NOT NULL DEFAULT '', link_on INTEGER NOT NULL DEFAULT 0, source_name TEXT NOT NULL DEFAULT '', created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS esign_docs (id TEXT PRIMARY KEY, number INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, template_id TEXT NOT NULL DEFAULT '', pages TEXT NOT NULL, fields TEXT NOT NULL, prefill TEXT NOT NULL DEFAULT '{}', vals TEXT NOT NULL DEFAULT '{}', signer_name TEXT NOT NULL, signer_email TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', token TEXT NOT NULL, via TEXT NOT NULL DEFAULT 'email', status TEXT NOT NULL, original_hash TEXT NOT NULL DEFAULT '', final_hash TEXT NOT NULL DEFAULT '', sent_at TEXT, viewed_at TEXT, signed_at TEXT, sign_ip TEXT NOT NULL DEFAULT '', sign_ua TEXT NOT NULL DEFAULT '', decline_reason TEXT NOT NULL DEFAULT '', created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_esign_token ON esign_docs (token)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS esign_events (id INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT NOT NULL, at TEXT NOT NULL, event TEXT NOT NULL, actor TEXT NOT NULL DEFAULT \'\', ip TEXT NOT NULL DEFAULT \'\', ua TEXT NOT NULL DEFAULT \'\', detail TEXT NOT NULL DEFAULT \'\')');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_esign_ev ON esign_events (doc_id)');
    $pdo->exec("CREATE TABLE IF NOT EXISTS esign_signers (doc_id TEXT NOT NULL, sid TEXT NOT NULL, ord INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', sent_at TEXT, viewed_at TEXT, signed_at TEXT, ip TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '', decline_reason TEXT NOT NULL DEFAULT '', PRIMARY KEY (doc_id, sid))");
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_esign_signer_token ON esign_signers (token)');
    $cols = array_column($pdo->query('PRAGMA table_info(esign_docs)')->fetchAll(), 'name');
    foreach (['record_id' => "TEXT NOT NULL DEFAULT ''", 'version' => 'INTEGER NOT NULL DEFAULT 1', 'superseded' => 'INTEGER NOT NULL DEFAULT 0', 'approval' => "TEXT NOT NULL DEFAULT ''", 'changes' => "TEXT NOT NULL DEFAULT ''", 'pricing' => "TEXT NOT NULL DEFAULT ''", 'auto' => "TEXT NOT NULL DEFAULT ''"] as $c => $def)
        if (!in_array($c, $cols, true)) $pdo->exec("ALTER TABLE esign_docs ADD COLUMN $c $def");
    if (!in_array('record_id', $cols, true)) $pdo->exec("UPDATE esign_docs SET record_id = id WHERE record_id = ''");
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_esign_record ON esign_docs (record_id)');
    return $pdo;
}

function es_dir(string $sub): string {
    $d = __DIR__ . '/storage/esign/' . $sub;
    if (!is_dir($d)) @mkdir($d, 0750, true);
    $root = __DIR__ . '/storage/esign';
    if (!is_file($root . '/.htaccess')) @file_put_contents($root . '/.htaccess', "Require all denied\nDeny from all\n");
    return $d;
}
function es_id_ok(string $id): bool { return (bool)preg_match('/^[a-f0-9-]{36}$/', $id); }
function es_ua(): string { return mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300); }
function es_event(string $doc, string $event, string $actor = '', string $detail = ''): void {
    es_db()->prepare('INSERT INTO esign_events (doc_id, at, event, actor, ip, ua, detail) VALUES (?,?,?,?,?,?,?)')
        ->execute([$doc, now_iso(), $event, mb_substr($actor, 0, 200), client_ip(), es_ua(), mb_substr($detail, 0, 500)]);
}
function es_site(): string { return function_exists('site_url') ? site_url() : 'https://' . ($_SERVER['HTTP_HOST'] ?? 'satingraphic.ca'); }
function es_url(string $token): string { return es_site() . '/esign/?t=' . $token; }
function es_link_url(string $token): string { return es_site() . '/esign/?l=' . $token; }
function es_business(): array {
    try { require_once __DIR__ . '/invoices_api.php'; $b = inv_settings()['business'] ?? []; } catch (Throwable $e) { $b = []; }
    return ['name' => (string)($b['name'] ?? 'Satin Graphic'), 'email' => (string)($b['email'] ?? (cfg('notify_email') ?: 'info@satingraphic.ca')), 'phone' => (string)($b['phone'] ?? '905-695-9147')];
}
function es_who(array $s): string { return trim($s['name'] . ($s['email'] !== '' ? ' <' . $s['email'] . '>' : '')); }

/* ---------- fields ---------- */
function es_clean_fields($fields, int $pages): array {
    $out = []; $ids = [];
    if (!is_array($fields)) return [];
    foreach (array_slice($fields, 0, 400) as $f) {
        if (!is_array($f) || !in_array($f['type'] ?? '', ES_TYPES, true)) continue;
        $id = preg_match('/^[a-z0-9]{4,20}$/i', (string)($f['id'] ?? '')) ? (string)$f['id'] : substr(bin2hex(random_bytes(6)), 0, 10);
        if (isset($ids[$id])) continue; $ids[$id] = 1;
        $n = fn($k, $min, $max) => max($min, min($max, is_numeric($f[$k] ?? null) ? (float)$f[$k] : 0));
        $page = (int)$n('page', 0, max(0, $pages - 1));
        $w = $n('w', .005, 1); $h = $n('h', .004, 1);
        $role = ($f['role'] ?? 'signer') === 'sender' && in_array($f['type'], ['text', 'checkbox', 'date', 'name', 'email'], true) ? 'sender' : 'signer';
        $out[] = ['id' => $id, 'type' => $f['type'], 'page' => $page, 'x' => round($n('x', 0, 1 - $w), 5), 'y' => round($n('y', 0, 1 - $h), 5), 'w' => round($w, 5), 'h' => round($h, 5),
            'label' => text($f['label'] ?? '', 80), 'required' => !empty($f['required']) || in_array($f['type'], ['signature'], true) && !isset($f['required']),
            'role' => $role, 'signer' => $role === 'signer' ? (preg_match('/^s([1-9]|10)$/', (string)($f['signer'] ?? '')) ? (string)$f['signer'] : 's1') : '',
            'value' => text($f['value'] ?? '', 500), 'group' => text($f['group'] ?? '', 60)];
    }
    return $out;
}
function es_main_pages(array $pages): array { return array_keys(array_filter($pages, fn($p) => ($p['kind'] ?? '') !== 'approval')); }

/* ---------- documents in an agreement: the agreement itself ("main") + attached PDFs (Approval Form …), in the order staff choose ---------- */
function es_part_of(array $p): string { return ($p['kind'] ?? '') === 'approval' ? (string)($p['part'] ?? 'a') : 'main'; }
function es_part_list(array $ap): array { $l = $ap['parts'] ?? []; if (!$l && $ap) $l = [['id' => 'a', 'name' => $ap['name'] ?? 'Approval Form']]; return $l; }
/** Ordered [{id, name, pages}] of a document. */
function es_parts(array $d): array {
    $pages = json_decode($d['pages'], true) ?: []; $names = array_column(es_part_list(json_decode($d['approval'] ?: '{}', true) ?: []), 'name', 'id');
    $out = []; $ix = [];
    foreach ($pages as $p) { $id = es_part_of($p); if (!isset($ix[$id])) { $ix[$id] = count($out); $out[] = ['id' => $id, 'name' => $id === 'main' ? $d['title'] : ($names[$id] ?? 'Approval Form'), 'pages' => 0]; } $out[$ix[$id]]['pages']++; }
    return $out;
}
/** Pages rearranged by part order (each part keeps its own page order); field pages follow. */
function es_reorder(array $pages, array $fields, array $order): array {
    $g = []; foreach ($pages as $k => $p) $g[es_part_of($p)][] = $k;
    $seq = []; foreach ($order as $id) if (is_string($id) && isset($g[$id])) { array_push($seq, ...$g[$id]); unset($g[$id]); }
    foreach ($g as $rest) array_push($seq, ...$rest);
    $map = array_flip($seq);
    foreach ($fields as &$f) $f['page'] = $map[(int)$f['page']] ?? (int)$f['page']; unset($f);
    return [array_map(fn($k) => $pages[$k], $seq), $fields];
}
function es_insert_pages(array $pages, array $fields, int $at, array $new): array {
    $n = count($new); foreach ($fields as &$f) if ((int)$f['page'] >= $at) $f['page'] = (int)$f['page'] + $n; unset($f);
    array_splice($pages, $at, 0, $new); return [$pages, $fields];
}
/** Removes the pages of one part (and their fields). Returns [pages, fields, index where the part started]. */
function es_remove_part(array $pages, array $fields, string $pid, string $dir): array {
    $keep = []; $map = []; $at = -1;
    foreach ($pages as $k => $p) { if (es_part_of($p) === $pid) { if ($at < 0) $at = count($keep); if (!empty($p['img'])) @unlink("$dir/" . $p['img']); continue; } $map[$k] = count($keep); $keep[] = $p; }
    $fields = array_values(array_map(function ($f) use ($map) { $f['page'] = $map[(int)$f['page']]; return $f; }, array_filter($fields, fn($f) => isset($map[(int)$f['page']]))));
    return [$keep, $fields, $at < 0 ? count($keep) : $at];
}
/** Each signer gets a signature (+ date) at the bottom of the last page of an attached document, if they have none on it. */
function es_autoplace(array $pages, array $fields, array $sids, string $pid, string $dir): array {
    $idx = array_keys(array_filter($pages, fn($p) => es_part_of($p) === $pid)); if (!$idx) return $fields;
    $last = max($idx); $pg = $pages[$last];
    $sh = 42 / $pg['h']; $sw = min(.4, 190 / $pg['w']); $dh = 18 / $pg['h']; $dw = min(.3, 110 / $pg['w']); $step = $sh + $dh + .02;
    $todo = array_values(array_filter($sids, function ($sid) use ($fields, $idx) { foreach ($fields as $f) if ($f['type'] === 'signature' && ($f['signer'] ?? '') === $sid && in_array((int)$f['page'], $idx, true)) return false; return true; }));
    if (!$todo) return $fields;
    $top = !empty($pg['img']) ? (es_free_y("$dir/" . $pg['img'], .5, .95, .72, $step * count($todo)) ?? es_free_y("$dir/" . $pg['img'], .5, .95, .5, $step * count($todo))) : null;
    $y0 = $top !== null ? $top + .004 : max(.05, .93 - $step * count($todo));
    $id = fn() => substr(bin2hex(random_bytes(6)), 0, 10);
    foreach ($todo as $k => $sid) {
        $y = min(1 - $sh - $dh - .01, $y0 + $k * $step);
        $fields[] = ['id' => $id(), 'type' => 'signature', 'page' => $last, 'x' => .52, 'y' => round($y, 5), 'w' => round($sw, 5), 'h' => round($sh, 5), 'label' => 'Signature', 'required' => true, 'role' => 'signer', 'signer' => $sid, 'value' => '', 'group' => ''];
        $fields[] = ['id' => $id(), 'type' => 'date', 'page' => $last, 'x' => .52, 'y' => round($y + $sh + .004, 5), 'w' => round($dw, 5), 'h' => round($dh, 5), 'label' => 'Date signed', 'required' => false, 'role' => 'signer', 'signer' => $sid, 'value' => '', 'group' => ''];
    }
    return $fields;
}

/* ---------- automated agreements: the customer enters their own details (and vehicles) on a form, then signs once ---------- */
const ES_CUST_RE = '/customer name|full name|first name|last name|^name$|company|phone|mobile|e-?mail|address|vehicle|make|model|year|colou?r|licen[cs]e|plate|\bvin\b|pick-?up/i';
const ES_VEH_RE = '/vehicle|make|model|year|colou?r|licen[cs]e|plate|\bvin\b/i';
function es_auto(array $d): array { return json_decode((string)($d['auto'] ?? '') ?: '{}', true) ?: []; }
function es_flabel(array $f): string { return $f['label'] !== '' ? $f['label'] : ($f['type'] === 'name' ? 'Full name' : ($f['type'] === 'email' ? 'Email' : 'Text')); }
/** id => 'you' | 'vehicle' for the fields the customer fills in on the details form. */
function es_intake_fields(array $fields): array {
    $price = array_flip(es_price_fields($fields)); $o = [];
    foreach ($fields as $f) {
        if (!in_array($f['type'], ['text', 'name', 'email'], true) || isset($price[$f['id']])) continue;
        if ($f['role'] === 'signer' && ($f['signer'] ?? 's1') !== 's1') continue;
        $l = es_flabel($f); if (!preg_match(ES_CUST_RE, $l)) continue;
        $o[$f['id']] = preg_match(ES_VEH_RE, $l) && !preg_match('/pick-?up|company|e-?mail|phone|address/i', $l) ? 'vehicle' : 'you';
    }
    return $o;
}
function es_intake_req(string $label, string $type): bool { return $type === 'email' || (bool)preg_match('/customer name|full name|first name|last name|^name$|e-?mail|phone|make|model|brand/i', $label); }
/** The details form for the customer: [{id, label, type, group, required, value}]. */
function es_intake_spec(array $fields, array $map, array $prefill): array {
    $o = []; foreach ($fields as $f) if (isset($map[$f['id']])) { $l = es_flabel($f);
        $o[] = ['id' => $f['id'], 'label' => $l, 'type' => $f['type'] === 'email' || preg_match('/e-?mail/i', $l) ? 'email' : (preg_match('/phone|mobile/i', $l) ? 'tel' : 'text'), 'group' => $map[$f['id']], 'required' => es_intake_req($l, $f['type']), 'value' => (string)($prefill[$f['id']] ?? '')]; }
    return $o;
}
/** Checks the customer's details form. Returns ['pf' => id => value, 'veh' => [[id => value]…], 'name', 'email']. */
function es_intake_clean(array $fields, array $map, $vals, $vehicles): array {
    $vals = is_array($vals) ? $vals : []; $byId = array_column($fields, null, 'id'); $pf = []; $email = ''; $name = ''; $first = ''; $last = '';
    foreach ($map as $id => $grp) {
        if (!isset($byId[$id])) continue; $f = $byId[$id]; $l = es_flabel($f); $v = text($vals[$id] ?? '', 200);
        if ($v === '' && es_intake_req($l, $f['type'])) json_out(['error' => 'Please fill in: ' . $l, 'field' => $id], 400);
        if (($f['type'] === 'email' || preg_match('/e-?mail/i', $l)) && $v !== '') { if (!filter_var($v, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Enter a valid email address.', 'field' => $id], 400); $v = strtolower($v); if ($email === '') $email = $v; }
        if (preg_match('/customer name|full name|^name$/i', $l) && $name === '') $name = $v;
        if (preg_match('/first name/i', $l)) $first = $v; if (preg_match('/last name/i', $l)) $last = $v;
        $pf[$id] = $v;
    }
    if ($name === '') $name = trim("$first $last");
    $vids = array_keys(array_filter($map, fn($g) => $g === 'vehicle')); $veh = [];
    foreach (array_slice(is_array($vehicles) ? $vehicles : [], 0, 20) as $k => $row) {
        if (!is_array($row)) continue; $r = [];
        foreach ($vids as $id) if (isset($byId[$id])) $r[$id] = text($row[$id] ?? '', 200);
        if (!array_filter($r, fn($x) => $x !== '')) continue;
        foreach ($vids as $id) if (isset($byId[$id]) && $r[$id] === '' && preg_match('/make|model|brand/i', es_flabel($byId[$id]))) json_out(['error' => 'Vehicle ' . (count($veh) + 2) . ': please fill in ' . es_flabel($byId[$id]) . '.', 'vehicle' => $k, 'field' => $id], 400);
        $veh[] = $r;
    }
    return ['pf' => $pf, 'veh' => $veh, 'name' => $name, 'email' => $email];
}
/** Saves the customer's details on the document: values on the agreement, extra vehicles on a "Schedule A" page, signer name / email. */
function es_intake_store(array $d, array $c, string $who): array {
    $pdo = es_db(); $a = es_auto($d); $map = $a['fields'] ?? [];
    $fields = json_decode($d['fields'], true); $pages = json_decode($d['pages'], true); $pf = json_decode($d['prefill'], true) ?: [];
    foreach ($c['pf'] as $id => $v) $pf[$id] = $v;
    foreach ($fields as &$f) if (isset($map[$f['id']])) { $f['role'] = 'sender'; $f['signer'] = ''; } unset($f); // shown filled in (read-only) on the agreement
    foreach (array_keys($pages) as $k) if (($pages[$k]['kind'] ?? '') === 'addendum') { [$pages, $fields] = es_remove_part_page($pages, $fields, $k); break; }
    if ($c['veh']) {
        $byId = array_column($fields, null, 'id'); $at = 0; $vp = null;
        foreach ($map as $id => $g) if ($g === 'vehicle' && isset($byId[$id])) $vp = max($vp ?? 0, (int)$byId[$id]['page']);
        $at = $vp !== null ? $vp + 1 : count($pages);
        $ref = $pages[max(0, $at - 1)] ?? ['w' => 612, 'h' => 792];
        $blocks = [];
        foreach ($c['veh'] as $k => $r) { $items = []; foreach ($r as $id => $v) if ($v !== '') $items[] = [es_flabel($byId[$id]), $v]; $blocks[] = ['title' => 'Vehicle ' . ($k + 2), 'items' => $items]; }
        [$pages, $fields] = es_insert_pages($pages, $fields, $at, [['w' => $ref['w'], 'h' => $ref['h'], 'kind' => 'addendum', 'img' => '', 'title' => 'Schedule A — Additional vehicles', 'blocks' => $blocks]]);
    }
    $a['intake'] = 'done'; $a['at'] = now_iso(); $a['vehicles'] = $c['veh'];
    $now = now_iso();
    $pdo->prepare('UPDATE esign_docs SET fields = ?, pages = ?, prefill = ?, auto = ?, updated_at = ? WHERE id = ?')->execute([json_encode($fields), json_encode($pages), json_encode($pf, JSON_UNESCAPED_UNICODE), json_encode($a), $now, $d['id']]);
    $s1 = es_signers($d)[0] ?? null;
    if ($s1) {
        $nm = in_array($s1['name'], ['', 'Customer'], true) && $c['name'] !== '' ? $c['name'] : $s1['name']; $em = $s1['email'] === '' ? $c['email'] : $s1['email'];
        $pdo->prepare('UPDATE esign_signers SET name = ?, email = ? WHERE doc_id = ? AND sid = ?')->execute([$nm, $em, $d['id'], 's1']);
        $pdo->prepare('UPDATE esign_docs SET signer_name = ?, signer_email = ? WHERE id = ?')->execute([$nm, $em, $d['id']]);
    }
    $d = es_doc_by_id($d['id']);
    if ($d['status'] !== 'draft') $pdo->prepare('UPDATE esign_docs SET original_hash = ? WHERE id = ?')->execute([es_doc_hash($d), $d['id']]);
    es_event($d['id'], 'customer details entered', $who, 'Details form completed' . ($c['veh'] ? ' · ' . (count($c['veh']) + 1) . ' vehicles (Schedule A added)' : ''));
    try { es_save_customer($d, $c, $fields); } catch (Throwable $e) { error_log('esign customer: ' . $e->getMessage()); }
    return es_doc_by_id($d['id']);
}
/** Vehicle field label → key in the customer's saved vehicles. */
function es_veh_key(string $l): string {
    if (preg_match('/make/i', $l) && preg_match('/model/i', $l)) return 'makeModel';
    foreach (['make' => '/make|brand/i', 'model' => '/model/i', 'trim' => '/\btrim\b/i', 'year' => '/year/i', 'colour' => '/colou?r/i', 'plate' => '/licen[cs]e|plate/i', 'vin' => '/\bvin\b/i'] as $k => $re) if (preg_match($re, $l)) return $k;
    return '';
}
/** The customer's details form also saves (or updates) them in Customers, with their vehicles, so the next agreement fills itself in. */
function es_save_customer(array $d, array $c, array $fields): void {
    $email = strtolower(trim($c['email'] ?? '')); if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;
    $pdo = es_db(); $byId = array_column($fields, null, 'id'); $o = ['company' => '', 'phone' => '', 'address' => '']; $veh0 = [];
    foreach ($c['pf'] as $id => $v) { if (!isset($byId[$id]) || $v === '') continue; $l = es_flabel($byId[$id]);
        if (preg_match('/company/i', $l)) $o['company'] = $v; elseif (preg_match('/phone|mobile/i', $l)) $o['phone'] = $v; elseif (preg_match('/address/i', $l) && !preg_match('/e-?mail/i', $l)) $o['address'] = $v;
        elseif (preg_match(ES_VEH_RE, $l) && ($k = es_veh_key($l)) !== '') $veh0[$k] = $v; }
    $vehs = $veh0 ? [$veh0] : [];
    foreach ($c['veh'] as $row) { $r = []; foreach ($row as $id => $v) if ($v !== '' && isset($byId[$id]) && ($k = es_veh_key(es_flabel($byId[$id]))) !== '') $r[$k] = $v; if ($r) $vehs[] = $r; }
    try { $pdo->exec("ALTER TABLE inv_customers ADD COLUMN vehicles TEXT NOT NULL DEFAULT ''"); } catch (Throwable $e) { }
    $q = $pdo->prepare('SELECT * FROM inv_customers WHERE lower(email) = ? ORDER BY updated_at DESC LIMIT 1'); $q->execute([$email]); $old = $q->fetch();
    $name = trim($c['name'] ?? '') ?: ($old['name'] ?? $email); $now = now_iso();
    $note = 'Agreement #' . $d['number'] . ' — ' . $d['title'] . ' (' . substr($now, 0, 10) . ')';
    if ($old) {
        $have = json_decode((string)($old['vehicles'] ?? ''), true) ?: [];
        $sig = fn($v) => strtolower(json_encode($v)); $seen = array_map($sig, $have);
        foreach (array_reverse($vehs) as $v) if (!in_array($sig($v), $seen, true)) array_unshift($have, $v);
        $notes = (string)$old['notes']; if (strpos($notes, 'Agreement #' . $d['number'] . ' ') === false) $notes = trim($notes . "\n" . $note);
        $pdo->prepare('UPDATE inv_customers SET name = ?, company = ?, phone = ?, address = ?, vehicles = ?, notes = ?, updated_at = ? WHERE id = ?')
            ->execute([$name, $o['company'] ?: $old['company'], $o['phone'] ?: $old['phone'], $o['address'] ?: $old['address'], json_encode(array_slice($have, 0, 20), JSON_UNESCAPED_UNICODE), $notes, $now, $old['id']]);
    } else {
        $pdo->prepare('INSERT INTO inv_customers (id, name, company, email, phone, address, notes, vehicles, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
            ->execute([uuid(), $name, $o['company'], $email, $o['phone'], $o['address'], $note, json_encode($vehs, JSON_UNESCAPED_UNICODE), $now, $now]);
    }
}
function es_remove_part_page(array $pages, array $fields, int $k): array {
    $fields = array_values(array_filter($fields, fn($f) => (int)$f['page'] !== $k));
    foreach ($fields as &$f) if ((int)$f['page'] > $k) $f['page'] = (int)$f['page'] - 1; unset($f);
    array_splice($pages, $k, 1); return [$pages, $fields];
}
/** Signer fields for the current signer list: fields of removed signers go; a new signer gets one signature + date on the
 *  main agreement, under the first signer's (staff can move them on the placement step). */
/** Top (page fraction) of the first blank band at least $need tall, at or below $from, across [$x0, $x1] of a page image. */
function es_free_y(string $jpg, float $x0, float $x1, float $from, float $need): ?float {
    if (!function_exists('imagecreatefromjpeg') || !is_file($jpg)) return null;
    $im = @imagecreatefromjpeg($jpg); if (!$im) return null;
    $W = imagesx($im); $H = imagesy($im); $a = (int)max(0, $x0 * $W); $b = (int)min($W - 1, $x1 * $W);
    $run = 0; $need = (int)ceil($need * $H); $top = null;
    for ($y = (int)($from * $H); $y < (int)($H * .965); $y++) {
        $ink = false;
        for ($x = $a; $x <= $b; $x += 3) { $c = imagecolorat($im, $x, $y); if (((($c >> 16) & 255) * 3 + (($c >> 8) & 255) * 6 + ($c & 255)) / 10 < 205) { $ink = true; break; } }
        if ($ink) { $run = 0; continue; }
        if (++$run >= $need) { $top = ($y - $need + 1) / $H; break; }
    }
    imagedestroy($im);
    return $top;
}
function es_sync_signer_fields(array $fields, array $sids, array $pages, string $dir = ''): array {
    $fields = array_values(array_filter($fields, fn($f) => $f['role'] !== 'signer' || in_array($f['signer'] ?? 's1', $sids, true)));
    $main = es_main_pages($pages);
    $isMain = fn($f) => in_array((int)$f['page'], $main, true);
    $base = null;
    foreach ($fields as $f) if ($f['role'] === 'signer' && ($f['signer'] ?? 's1') === 's1' && $f['type'] === 'signature' && $isMain($f)) $base = $f; // the last one (bottom of the agreement)
    if (!$base) return $fields;
    $date = null; $best = 9;
    foreach ($fields as $f) if ($f['role'] === 'signer' && ($f['signer'] ?? 's1') === 's1' && $f['type'] === 'date' && (int)$f['page'] === (int)$base['page']) { $dy = abs(($f['y'] + $f['h'] / 2) - ($base['y'] + $base['h'] / 2)); if ($dy < $best && $dy < .08) { $best = $dy; $date = $f; } }
    $step = max($base['h'], $date['h'] ?? 0) + .022;
    // new signers go in the first blank space under the signature line (so they do not cover printed text), else stacked under it
    $x0 = min($base['x'], $date['x'] ?? 1); $x1 = max($base['x'] + $base['w'], isset($date) ? $date['x'] + $date['w'] : 0);
    $img = $dir !== '' && isset($pages[(int)$base['page']]['img']) ? $dir . '/' . $pages[(int)$base['page']]['img'] : '';
    $next = $base['y'] + $base['h'] + .012;
    foreach ($fields as $f) if ((int)$f['page'] === (int)$base['page'] && $f['role'] === 'signer' && ($f['signer'] ?? 's1') !== 's1' && in_array($f['type'], ['signature', 'date'], true)) $next = max($next, $f['y'] + $f['h'] + .012);
    foreach ($sids as $k => $sid) {
        if ($sid === 's1') continue;
        $has = false; foreach ($fields as $f) if ($f['type'] === 'signature' && ($f['signer'] ?? '') === $sid && $isMain($f)) $has = true;
        if ($has) continue;
        $top = $img !== '' ? es_free_y($img, $x0, $x1, $next, $step + .012) : null;
        $y = $top !== null ? $top + .006 : min(1 - $base['h'], $base['y'] + $step * $k);
        $off = $y - $base['y']; $next = $y + $step;
        $mk = function (array $src) use ($sid, $off) { $n = $src; $n['id'] = substr(bin2hex(random_bytes(6)), 0, 10); $n['signer'] = $sid; $n['y'] = round(max(0, min(1 - $src['h'], $src['y'] + $off)), 5); return $n; };
        $fields[] = $mk($base) + [];
        $fields[count($fields) - 1]['label'] = 'Signature';
        if ($date) { $fields[] = $mk($date); $fields[count($fields) - 1]['label'] = 'Date signed'; }
    }
    return $fields;
}

function es_tpl_row(array $t, bool $full = true): array {
    $pages = json_decode($t['pages'], true) ?: [];
    $o = ['id' => $t['id'], 'name' => $t['name'], 'kind' => $t['kind'], 'pageCount' => count($pages), 'message' => $t['message'], 'linkOn' => (bool)$t['link_on'],
        'linkUrl' => $t['link_on'] && $t['link_token'] ? es_link_url($t['link_token']) : '', 'sourceName' => $t['source_name'], 'createdAt' => $t['created_at'], 'updatedAt' => $t['updated_at']];
    $fields = json_decode($t['fields'], true) ?: [];
    $o['fieldCount'] = count($fields);
    if ($full) { $o['pages'] = array_map(fn($p, $k) => ['w' => $p['w'], 'h' => $p['h'], 'url' => '/api/admin/esign/page?tpl=' . $t['id'] . '&n=' . $k . '&v=' . substr(md5($p['img'] . $t['updated_at']), 0, 8)], $pages, array_keys($pages)); $o['fields'] = $fields; }
    else $o['thumb'] = $pages ? '/api/admin/esign/page?tpl=' . $t['id'] . '&n=0&v=' . substr(md5($pages[0]['img']), 0, 8) : '';
    return $o;
}
function es_tpl(string $id): array {
    if (!es_id_ok($id)) json_out(['error' => 'Template not found.'], 404);
    $q = es_db()->prepare('SELECT * FROM esign_templates WHERE id = ? AND deleted = 0'); $q->execute([$id]);
    $t = $q->fetch(); if (!$t) json_out(['error' => 'Template not found.'], 404);
    return $t;
}

/* ---------- signers ---------- */
/** Signers of a document, in order. Documents made before multi-signer support get their single signer row here. */
function es_signers(array $d): array {
    $pdo = es_db();
    $q = $pdo->prepare('SELECT * FROM esign_signers WHERE doc_id = ? ORDER BY ord'); $q->execute([$d['id']]);
    $rows = $q->fetchAll();
    if ($rows) return $rows;
    $st = ['sent' => 'sent', 'viewed' => 'viewed', 'signed' => 'signed', 'declined' => 'declined', 'draft' => 'pending'][$d['status']] ?? 'sent';
    $pdo->prepare('INSERT OR IGNORE INTO esign_signers (doc_id, sid, ord, name, email, token, status, sent_at, viewed_at, signed_at, ip, ua, decline_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$d['id'], 's1', 1, $d['signer_name'], $d['signer_email'], $d['token'], $st, $d['sent_at'], $d['viewed_at'], $d['signed_at'], $d['sign_ip'], $d['sign_ua'], $d['decline_reason']]);
    $q->execute([$d['id']]);
    return $q->fetchAll();
}
/** Validates the signer list from the admin: [{name, email}], 1–10 people, unique valid emails. $needEmail: every signer needs one. */
function es_clean_signers($list, bool $needEmail): array {
    if (!is_array($list) || !$list) json_out(['error' => 'Add at least one signer.'], 400);
    if (count($list) > ES_MAX_SIGNERS) json_out(['error' => 'Up to ' . ES_MAX_SIGNERS . ' signers.'], 400);
    $out = []; $seen = [];
    foreach (array_values($list) as $k => $s) {
        $name = text(is_array($s) ? ($s['name'] ?? '') : '', 120); $email = strtolower(text(is_array($s) ? ($s['email'] ?? '') : '', 254));
        $n = $k + 1;
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => "Signer $n: the email address is not valid.", 'signer' => $k], 400);
        if ($needEmail && $email === '') json_out(['error' => "Signer $n: enter an email address.", 'signer' => $k], 400);
        if ($email !== '' && isset($seen[$email])) json_out(['error' => "Signer $n: $email is already a signer on this document.", 'signer' => $k], 400);
        if ($email !== '') $seen[$email] = 1;
        $out[] = ['sid' => 's' . $n, 'name' => $name !== '' ? $name : ($n === 1 ? 'Customer' : 'Signer ' . $n), 'email' => $email];
    }
    return $out;
}
/** Replaces the signer rows of a draft document (new links for everyone). */
function es_put_signers(string $docId, array $signers): void {
    $pdo = es_db();
    $pdo->prepare('DELETE FROM esign_signers WHERE doc_id = ?')->execute([$docId]);
    $ins = $pdo->prepare("INSERT INTO esign_signers (doc_id, sid, ord, name, email, token, status) VALUES (?,?,?,?,?,?,'pending')");
    foreach ($signers as $k => $s) $ins->execute([$docId, $s['sid'], $k + 1, $s['name'], $s['email'], token()]);
    $pdo->prepare('UPDATE esign_docs SET signer_name = ?, signer_email = ? WHERE id = ?')->execute([$signers[0]['name'], $signers[0]['email'], $docId]);
}
/** Overall status from the signers (draft → sent → viewed → partial → signed). Cancelled / declined / superseded stay. */
function es_refresh_status(string $docId): string {
    $pdo = es_db(); $d = es_doc_by_id($docId);
    if (in_array($d['status'], ['cancelled', 'declined', 'superseded'], true)) return $d['status'];
    $ss = array_column(es_signers($d), 'status');
    $st = !array_diff($ss, ['signed']) ? 'signed' : (in_array('signed', $ss, true) ? 'partial' : (in_array('viewed', $ss, true) ? 'viewed' : (in_array('sent', $ss, true) ? 'sent' : 'draft')));
    if ($st !== $d['status']) $pdo->prepare('UPDATE esign_docs SET status = ?, updated_at = ? WHERE id = ?')->execute([$st, now_iso(), $docId]);
    return $st;
}

/* ---------- documents ---------- */
function es_doc_row(array $d, bool $full = false): array {
    $sg = es_signers($d);
    $o = ['id' => $d['id'], 'number' => (int)$d['number'], 'title' => $d['title'], 'templateId' => $d['template_id'], 'signerName' => $d['signer_name'], 'signerEmail' => $d['signer_email'],
        'status' => $d['status'], 'via' => $d['via'], 'sentAt' => $d['sent_at'], 'viewedAt' => $d['viewed_at'], 'signedAt' => $d['signed_at'], 'createdAt' => $d['created_at'],
        'url' => es_url($sg[0]['token'] ?? $d['token']), 'hasPdf' => $d['status'] === 'signed', 'finalHash' => $d['final_hash'], 'originalHash' => $d['original_hash'], 'declineReason' => $d['decline_reason'],
        'recordId' => $d['record_id'] ?: $d['id'], 'version' => (int)$d['version'], 'superseded' => (bool)$d['superseded'], 'changes' => $d['changes'],
        'signers' => array_map(fn($s) => ['sid' => $s['sid'], 'name' => $s['name'], 'email' => $s['email'], 'status' => $s['status'], 'sentAt' => $s['sent_at'], 'viewedAt' => $s['viewed_at'], 'signedAt' => $s['signed_at'], 'declineReason' => $s['decline_reason'], 'url' => es_url($s['token'])], $sg)];
    $ap = json_decode($d['approval'] ?: '{}', true) ?: [];
    $pc = json_decode($d['pricing'] ?: '{}', true) ?: [];
    $o['pricing'] = ['hst' => $pc['hst'] ?? null, 'manual' => (object)($pc['manual'] ?? []), 'confirmed' => es_pricing_ok($d), 'confirmedAt' => $pc['confirmedAt'] ?? null, 'confirmedBy' => $pc['confirmedBy'] ?? null];
    $o['approval'] = $ap ? ['name' => $ap['name'] ?? '', 'pages' => (int)($ap['count'] ?? 0), 'confirmed' => !empty($ap['confirmed'])] : null;
    $au = es_auto($d); $o['auto'] = $au ? ['intake' => $au['intake'] ?? 'pending', 'vehicles' => count($au['vehicles'] ?? []) + 1] : null;
    $o['parts'] = es_parts($d);
    if ($full) {
        $pdo = es_db();
        $q = $pdo->prepare('SELECT at, event, actor, ip, ua, detail FROM esign_events WHERE doc_id = ? ORDER BY id'); $q->execute([$d['id']]);
        $o['events'] = $q->fetchAll(); $o['message'] = $d['message']; $o['prefill'] = json_decode($d['prefill'], true) ?: (object)[];
        $pages = json_decode($d['pages'], true) ?: [];
        $o['pages'] = array_map(fn($p, $k) => ['w' => $p['w'], 'h' => $p['h'], 'kind' => $p['kind'] ?? 'main', 'part' => es_part_of($p)] + (empty($p['img']) ? ['url' => '', 'title' => $p['title'] ?? '', 'blocks' => $p['blocks'] ?? []] : ['url' => '/api/admin/esign/page?doc=' . $d['id'] . '&n=' . $k . '&v=' . substr(md5($p['img']), 0, 8)]), $pages, array_keys($pages));
        $o['fields'] = json_decode($d['fields'], true) ?: [];
        $q = $pdo->prepare('SELECT id, version, status, superseded, created_at, sent_at, signed_at, changes FROM esign_docs WHERE record_id = ? ORDER BY version DESC'); $q->execute([$d['record_id'] ?: $d['id']]);
        $o['versions'] = array_map(fn($v) => ['id' => $v['id'], 'version' => (int)$v['version'], 'status' => $v['status'], 'superseded' => (bool)$v['superseded'], 'createdAt' => $v['created_at'], 'sentAt' => $v['sent_at'], 'signedAt' => $v['signed_at'], 'changes' => $v['changes']], $q->fetchAll());
    }
    return $o;
}
function es_doc_by_id(string $id): array {
    if (!es_id_ok($id)) json_out(['error' => 'Document not found.'], 404);
    $q = es_db()->prepare('SELECT * FROM esign_docs WHERE id = ?'); $q->execute([$id]);
    $d = $q->fetch(); if (!$d) json_out(['error' => 'Document not found.'], 404);
    return $d;
}
/** [document, signer] for a signing link. */
function es_doc_by_token(string $t): array {
    if (!preg_match('/^[A-Za-z0-9_-]{30,60}$/', $t)) json_out(['error' => 'This signing link is not valid.'], 404);
    $pdo = es_db();
    $q = $pdo->prepare('SELECT * FROM esign_signers WHERE token = ?'); $q->execute([$t]); $s = $q->fetch();
    if ($s && hash_equals($s['token'], $t)) return [es_doc_by_id($s['doc_id']), $s];
    $q = $pdo->prepare('SELECT * FROM esign_docs WHERE token = ?'); $q->execute([$t]); $d = $q->fetch(); // older documents: the link is the document token
    if (!$d || !hash_equals($d['token'], $t)) json_out(['error' => 'This signing link is not valid.'], 404);
    foreach (es_signers($d) as $s) if (hash_equals($s['token'], $t)) return [$d, $s];
    json_out(['error' => 'This signing link is not valid.'], 404);
}
function es_editable(array $d): bool { return $d['status'] === 'draft'; }
function es_need_draft(array $d): void { if (!es_editable($d)) json_out(['error' => 'This document was already sent. Use Edit & Resend to make a new version.'], 409); }

function es_clean_prefill(array $fields, array $in): array {
    $pf = [];
    foreach ($fields as $f) {
        if ($f['role'] === 'sender') $pf[$f['id']] = text($in[$f['id']] ?? $f['value'] ?? '', 500);
        elseif (in_array($f['type'], ['text', 'name', 'email'], true) && text($in[$f['id']] ?? '', 500) !== '') $pf[$f['id']] = text($in[$f['id']], 500); // staff pre-fill, the customer can still change it
    }
    return $pf;
}
/* ---------- Pricing & payment: suggested amounts with manual overrides, confirmed by staff before sending ---------- */
const ES_PRICE_ROLES = ['price' => '/agreed project price/i', 'start' => '/project start deposit|design fee/i', 'prod' => '/production deposit/i', 'tax' => '/applicable tax/i', 'total' => '/total project amount/i', 'after' => '/total after tax/i', 'balance' => '/final balance/i'];
/** role => field id of the pricing fields (staff-filled text fields), or [] when the document has no "Agreed project price" field. */
function es_price_fields(array $fields): array {
    $o = [];
    foreach ($fields as $f) if ($f['role'] === 'sender' && $f['type'] === 'text') foreach (ES_PRICE_ROLES as $r => $re) if (!isset($o[$r]) && preg_match($re, $f['label'])) { $o[$r] = $f['id']; break; }
    return isset($o['price']) ? $o : [];
}
/** Pricing state from the admin: {hst, manual: {role: true}, confirmed, values: {role: shown amount when confirmed}} → stored state. */
function es_clean_pricing($in, array $fields, array $prefill, ?array $u): string {
    $pf = es_price_fields($fields); if (!$pf || !is_array($in)) return '';
    $manual = []; foreach ((array)($in['manual'] ?? []) as $r => $on) if ($on && isset($pf[$r]) && $r !== 'price' && $r !== 'start') $manual[$r] = true;
    $cur = []; foreach ($pf as $r => $id) $cur[$r] = trim((string)($prefill[$id] ?? ''));
    $snap = is_array($in['values'] ?? null) ? array_map(fn($v) => trim((string)$v), $in['values']) : [];
    $ok = !empty($in['confirmed']); foreach ($cur as $r => $v) if (($snap[$r] ?? '') !== $v) $ok = false; // confirmation only counts for exactly the amounts shown
    return json_encode(['hst' => !empty($in['hst']), 'manual' => (object)$manual, 'confirmed' => $ok, 'values' => $ok ? $cur : (object)[], 'confirmedAt' => $ok ? now_iso() : null, 'confirmedBy' => $ok && $u ? $u['name'] : null]);
}
function es_pricing_ok(array $d): bool { // nothing to confirm, or the confirmed amounts are still the ones on the document
    $fields = json_decode($d['fields'], true); $pf = es_price_fields($fields); if (!$pf) return true;
    $pre = json_decode($d['prefill'], true) ?: []; $any = false; foreach ($pf as $r => $id) if ($r !== 'start' && trim((string)($pre[$id] ?? '')) !== '') $any = true; // the default start deposit alone is not pricing
    if (!$any) return true;
    $p = json_decode($d['pricing'] ?: '{}', true) ?: []; if (empty($p['confirmed'])) return false;
    foreach ($pf as $r => $id) if (trim((string)($pre[$id] ?? '')) !== (string)($p['values'][$r] ?? '')) return false;
    return true;
}

/** Copies the template's pages into a new draft document (so later template edits never change a sent document). */
function es_create_doc(array $t, array $signers, string $message, array $prefill, string $via, ?array $u, $pricing = null, bool $auto = false): array {
    $pdo = es_db();
    $pages = json_decode($t['pages'], true) ?: []; $fields = json_decode($t['fields'], true) ?: [];
    if (!$pages) json_out(['error' => 'This template has no pages yet.'], 400);
    $fields = es_clean_fields($fields, count($pages));
    if ($auto) $fields = array_values(array_filter($fields, fn($f) => $f['type'] !== 'initials')); // automated: one signature at the end, no initials on every page
    if (!array_filter($fields, fn($f) => $f['role'] === 'signer')) json_out(['error' => 'Add at least one field for the customer (for example a signature) first.'], 400);
    $id = uuid(); $dir = es_dir('doc/' . $id); $out = [];
    foreach ($pages as $k => $p) {
        $src = es_dir('tpl/' . $t['id']) . '/' . $p['img'];
        if (!is_file($src) || !copy($src, "$dir/$k.jpg")) json_out(['error' => 'A page image of this template is missing. Upload the PDF again.'], 500);
        $out[] = ['w' => $p['w'], 'h' => $p['h'], 'img' => "$k.jpg"];
    }
    $fields = es_sync_signer_fields($fields, array_column($signers, 'sid'), $out, $dir);
    $pf = es_clean_prefill($fields, $prefill);
    $prc = es_clean_pricing($pricing, $fields, $pf, $u);
    $num = (int)$pdo->query('SELECT COALESCE(MAX(number), 1000) + 1 n FROM esign_docs')->fetch()['n'];
    $now = now_iso(); $tok = token();
    $pdo->prepare('INSERT INTO esign_docs (id, number, title, template_id, pages, fields, prefill, vals, signer_name, signer_email, message, token, via, status, created_by, created_at, updated_at, record_id, version, pricing) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$id, $num, $t['name'], $t['id'], json_encode($out), json_encode($fields), json_encode($pf, JSON_UNESCAPED_UNICODE), '{}', $signers[0]['name'], $signers[0]['email'], $message, $tok, $via, 'draft', $u['id'] ?? null, $now, $now, $id, 1, $prc]);
    es_put_signers($id, $signers);
    if ($auto) $pdo->prepare('UPDATE esign_docs SET auto = ? WHERE id = ?')->execute([json_encode(['on' => true, 'intake' => es_intake_fields($fields) ? 'pending' : 'done', 'fields' => (object)es_intake_fields($fields)]), $id]);
    if ($via === 'public') $pdo->prepare('UPDATE esign_signers SET token = ? WHERE doc_id = ? AND sid = ?')->execute([$tok, $id, 's1']);
    es_event($id, 'created', $u ? $u['name'] . ' (' . $u['email'] . ')' : es_who($signers[0]), $via === 'public' ? 'Started from the public signing link of "' . $t['name'] . '"' : 'Document prepared for ' . implode(', ', array_map('es_who', $signers)));
    return es_doc_by_id($id);
}
/** Edit & Resend of a document that was already sent: a new draft version with the same pages, fields and information. */
function es_new_version(array $d, array $u): array {
    $pdo = es_db(); $id = uuid(); $src = es_dir('doc/' . $d['id']); $dst = es_dir('doc/' . $id);
    foreach (glob("$src/*.jpg") ?: [] as $f) copy($f, $dst . '/' . basename($f));
    $rec = $d['record_id'] ?: $d['id'];
    $ver = (int)$pdo->query('SELECT MAX(version) v FROM esign_docs WHERE record_id = ' . $pdo->quote($rec))->fetch()['v'] + 1;
    $now = now_iso();
    $ap = json_decode($d['approval'] ?: '{}', true) ?: []; if ($ap) $ap['confirmed'] = true;
    $prc = json_decode($d['pricing'] ?: '{}', true) ?: []; if ($prc) { $prc['confirmed'] = false; $prc['values'] = (object)[]; } // Edit & Resend: overrides are kept, the pricing is confirmed again
    $pdo->prepare('INSERT INTO esign_docs (id, number, title, template_id, pages, fields, prefill, vals, signer_name, signer_email, message, token, via, status, created_by, created_at, updated_at, record_id, version, approval, pricing) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([$id, $d['number'], $d['title'], $d['template_id'], $d['pages'], $d['fields'], $d['prefill'], '{}', $d['signer_name'], $d['signer_email'], $d['message'], token(), $d['via'] === 'public' ? 'email' : $d['via'], 'draft', $u['id'], $now, $now, $rec, $ver, $ap ? json_encode($ap) : '', $prc ? json_encode($prc) : '']);
    if (($d['auto'] ?? '') !== '') $pdo->prepare('UPDATE esign_docs SET auto = ? WHERE id = ?')->execute([$d['auto'], $id]);
    es_put_signers($id, array_map(fn($s) => ['sid' => $s['sid'], 'name' => $s['name'], 'email' => $s['email']], es_signers($d)));
    es_event($id, 'version created', $u['name'], "Version $ver made from version " . $d['version'] . ' (Edit & Resend)');
    es_event($d['id'], 'new version started', $u['name'], "Version $ver is being prepared");
    return es_doc_by_id($id);
}
function es_add_change(string $docId, string $what): void {
    $d = es_doc_by_id($docId); $c = array_filter(array_map('trim', explode(';', $d['changes'])));
    if (!in_array($what, $c, true)) { $c[] = $what; es_db()->prepare('UPDATE esign_docs SET changes = ? WHERE id = ?')->execute([mb_substr(implode('; ', $c), 0, 1500), $docId]); }
}
/** "Changes in this version" for the agreement information and signers, compared with the previous version. */
function es_info_changes(array $d): void {
    if ((int)$d['version'] < 2) return;
    $pdo = es_db();
    $q = $pdo->prepare('SELECT * FROM esign_docs WHERE record_id = ? AND version < ? ORDER BY version DESC LIMIT 1'); $q->execute([$d['record_id'], (int)$d['version']]); $p = $q->fetch();
    if (!$p) return;
    $keep = array_values(array_filter(array_map('trim', explode(';', $d['changes'])), fn($c) => $c !== '' && !preg_match('/^(Updated:|Signers:|Message changed)/', $c)));
    $prev = json_decode($p['prefill'], true) ?: []; $now = json_decode($d['prefill'], true) ?: []; $labels = [];
    foreach (json_decode($d['fields'], true) as $f) if ((isset($now[$f['id']]) || isset($prev[$f['id']])) && (string)($prev[$f['id']] ?? '') !== (string)($now[$f['id']] ?? '')) $labels[] = $f['label'] ?: ucfirst($f['type']);
    $labels = array_values(array_unique($labels)); $add = [];
    if ($labels) $add[] = 'Updated: ' . implode(', ', array_slice($labels, 0, 12)) . (count($labels) > 12 ? '…' : '');
    $sig = fn($x) => array_map(fn($s) => strtolower($s['email']) . '|' . $s['name'], es_signers($x));
    if ($sig($p) !== $sig($d)) $add[] = 'Signers: ' . implode(', ', array_map('es_who', es_signers($d)));
    if (trim($p['message']) !== trim($d['message'])) $add[] = 'Message changed';
    $pdo->prepare('UPDATE esign_docs SET changes = ? WHERE id = ?')->execute([mb_substr(implode('; ', array_merge($add, $keep)), 0, 1500), $d['id']]);
}
function es_doc_hash(array $d): string {
    $h = hash_init('sha256'); $dir = es_dir('doc/' . $d['id']);
    foreach (json_decode($d['pages'], true) as $p) hash_update($h, !empty($p['img']) ? (string)@file_get_contents("$dir/" . $p['img']) : json_encode($p));
    hash_update($h, $d['fields'] . $d['prefill']);
    return hash_final($h);
}

function es_send_mail(array $d, array $s, bool $reminder = false): bool {
    $b = es_business(); $url = es_url($s['token']);
    $first = trim(explode(' ', $s['name'])[0]) ?: 'there';
    $ver = (int)$d['version'] > 1;
    $subj = ($reminder ? 'Reminder: ' : ($ver ? 'Updated: ' : '')) . $b['name'] . ' sent you "' . $d['title'] . '" to sign';
    $msg = trim($d['message']);
    $others = array_values(array_filter(es_signers($d), fn($x) => $x['sid'] !== $s['sid']));
    $multi = $others ? ' Other signers: ' . implode(', ', array_column($others, 'name')) . '. Everyone signs with their own link; you only sign your own fields.' : '';
    $intro = ($ver ? 'an updated version of ' : '') . '"' . $d['title'] . '"';
    $fillin = (es_auto($d)['intake'] ?? '') === 'pending' && $s['sid'] === 's1';
    $text = "Hi $first,\n\n" . $b['name'] . " has sent you $intro to " . ($fillin ? 'complete with your details and vehicle information, then review and sign online.' : 'review and sign online.') . ($ver ? ' Please use this new link — earlier links no longer work.' : '') . "$multi\n\n" . ($msg !== '' ? "Message:\n$msg\n\n" : '') . "Review and sign: $url\n\nIt takes about a minute and works on your phone. When everyone has signed you will get the completed PDF by email.\n\nQuestions? Reply to this email or call " . $b['phone'] . ".\n\n" . $b['name'];
    $e = fn($x) => htmlspecialchars($x, ENT_QUOTES, 'UTF-8');
    $html = '<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;padding:24px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;color:#1d2330">'
        . '<p style="margin:0 0 6px;color:#6b7280;font-size:13px">' . $e($b['name']) . '</p><h1 style="font-size:20px;margin:0 0 14px">' . $e($d['title']) . ($ver ? ' <span style="font-size:13px;color:#6b7280;font-weight:normal">(updated version)</span>' : '') . '</h1>'
        . '<p style="font-size:15px;line-height:1.5">Hi ' . $e($first) . ',<br>' . $e($b['name']) . ' has sent you ' . ($ver ? 'an updated document' : 'a document') . ($fillin ? ' to complete with your details and vehicle information, then review and sign online.' : ' to review and sign online.') . ($ver ? ' Please use the button below — earlier links no longer work.' : '') . '</p>'
        . ($others ? '<p style="font-size:13px;color:#6b7280;line-height:1.5">Other signers: ' . $e(implode(', ', array_column($others, 'name'))) . '. Everyone signs with their own link; you only sign your own fields.</p>' : '')
        . ($msg !== '' ? '<div style="background:#f7f7fa;border-left:3px solid #e6007e;padding:10px 14px;margin:14px 0;font-size:14px;white-space:pre-line">' . $e($msg) . '</div>' : '')
        . '<p style="text-align:center;margin:26px 0"><a href="' . $e($url) . '" style="background:#e6007e;color:#fff;text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:8px;display:inline-block">Review &amp; sign</a></p>'
        . '<p style="font-size:13px;color:#6b7280;line-height:1.5">It takes about a minute and works on your phone. You will receive the completed PDF by email when everyone has signed.<br>Questions? Reply to this email or call ' . $e($b['phone']) . '.</p></div></div>';
    $ok = mail_out($s['email'], $subj, $text, $html, ['fromName' => $b['name'], 'replyTo' => $b['email']]);
    es_event($d['id'], $reminder ? 'reminder sent' : 'sent', $b['name'], 'Signing link emailed to ' . es_who($s) . ($ok ? '' : ' (delivery failed)'));
    return $ok;
}

/* ---------- PDF ---------- */
function es_pdf_text(string $s): string {
    $s = str_replace(["\r", "\n", "\t"], ' ', $s);
    $c = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $s);
    if ($c === false) $c = preg_replace('/[^\x20-\x7e]/', '?', $s);
    return '(' . strtr((string)$c, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']) . ')';
}
function es_tw(string $s, float $size, bool $bold = false): float { // Helvetica widths (approximate per class) for fitting and wrapping
    $w = 0.0; $c = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $s) ?: $s;
    for ($i = 0, $n = strlen($c); $i < $n; $i++) {
        $ch = $c[$i];
        $w += strpos('il.,:;|\'!', $ch) !== false ? .25 : (strpos('fjrtI[]()-" ', $ch) !== false ? .33 : (strpos('mwMW@', $ch) !== false ? .85 : (ctype_upper($ch) ? .68 : (ctype_digit($ch) ? .556 : .53))));
    }
    return $w * $size * ($bold ? 1.06 : 1);
}
function es_wrap(string $s, float $size, float $max, bool $bold = false): array {
    $lines = []; $cur = '';
    foreach (preg_split('/\s+/', trim($s)) as $w) {
        $try = $cur === '' ? $w : "$cur $w";
        if ($cur !== '' && es_tw($try, $size, $bold) > $max) { $lines[] = $cur; $cur = $w; } else $cur = $try;
    }
    if ($cur !== '') $lines[] = $cur;
    return $lines ?: [''];
}
function es_n(float $v): string { return rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.') ?: '0'; }
function es_fmt_time(?string $iso): string {
    if (!$iso) return '';
    try { $d = new DateTime($iso); $d->setTimezone(new DateTimeZone('America/Toronto')); return $d->format('M j, Y g:i:s A T'); } catch (Throwable $e) { return (string)$iso; }
}
/** Saved signature images of a document's signers: field id => {w, h, mask (zlib)}. */
function es_masks(array $d): array {
    $out = [];
    foreach (glob(es_dir('doc/' . $d['id']) . '/sig-s*.json') ?: [] as $f) foreach ((json_decode((string)file_get_contents($f), true) ?: []) as $fid => $m)
        if (isset($m['w'], $m['h'], $m['mask'])) $out[$fid] = ['w' => (int)$m['w'], 'h' => (int)$m['h'], 'mask' => (string)base64_decode($m['mask'])];
    return $out;
}

/** Builds the PDF: page images + filled fields (+ an audit trail page). Returns the PDF bytes. */
function es_build_pdf(array $d, array $vals, array $events, bool $audit = true): string {
    $pages = json_decode($d['pages'], true); $fields = json_decode($d['fields'], true); $prefill = json_decode($d['prefill'], true) ?: [];
    $dir = es_dir('doc/' . $d['id']);
    $obj = []; $add = function (string $s) use (&$obj): int { $obj[] = $s; return count($obj); };
    $stream = fn(string $dict, string $data) => "<< $dict /Length " . strlen($data) . " >>\nstream\n$data\nendstream";
    $catalog = $add(''); $pagesId = $add('');
    $f1 = $add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    $f2 = $add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    $ink = $add($stream('/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8', "\x12\x1f\x4a"));
    $kids = []; $short = strtoupper(substr(str_replace('-', '', $d['id']), 0, 12)); $masks = []; // one image object per signature mask, reused at every position
    $verTxt = (int)$d['version'] > 1 ? ' · version ' . (int)$d['version'] : '';
    $names = array_column(es_signers($d), 'name', 'sid');
    $auditPages = [];
    if ($audit) (function () use ($d, $events, &$auditPages) {
    // audit trail page(s) (Letter)
    $W = 612; $H = 792; $y = $H - 60; $ops = '';
    $line = function (string $t, float $size, bool $bold = false, float $x = 50, array $rgb = [0.11, 0.13, 0.19]) use (&$ops, &$y) {
        $ops .= 'BT /' . ($bold ? 'F2' : 'F1') . ' ' . es_n($size) . ' Tf ' . implode(' ', array_map('es_n', $rgb)) . ' rg ' . es_n($x) . ' ' . es_n($y) . ' Td ' . es_pdf_text($t) . " Tj ET\n";
    };
    $newPage = function () use (&$ops, &$y, &$auditPages, $H) { $auditPages[] = $ops; $ops = ''; $y = $H - 60; };
    $line('Audit trail', 20, true); $y -= 16; $line('Satin e-Sign · ' . es_business()['name'], 9, false, 50, [.42, .45, .5]); $y -= 26;
    $ops .= "0.9 0.9 0.92 RG 0.8 w 50 $y m 562 $y l S\n"; $y -= 22;
    $sg = es_signers($d);
    $meta = [['Document', $d['title'] . ((int)$d['version'] > 1 ? ' (version ' . (int)$d['version'] . ')' : '')], ['Document ID', $d['id']], ['Status', 'Completed — signed by ' . (count($sg) === 1 ? 'the signer' : 'all ' . count($sg) . ' signers') . ' ' . es_fmt_time($d['signed_at'])]];
    foreach ($sg as $k => $s) $meta[] = [count($sg) === 1 ? 'Signer' : 'Signer ' . ($k + 1), es_who($s) . ' — signed ' . es_fmt_time($s['signed_at']) . ($s['ip'] ? ' from IP ' . $s['ip'] : '')];
    $meta[] = ['Signing method', $d['via'] === 'public' ? 'Public signing link (name and email entered by the signer)' : (count($sg) === 1 ? 'Unique link sent to the signer' : 'A unique link for each signer; each signer could fill and sign only their own fields')];
    $meta[] = ['Original document SHA-256', $d['original_hash']];
    if (trim($d['changes']) !== '') $meta[] = ['Changes in this version', $d['changes']];
    foreach ($meta as [$k, $v]) {
        $line($k, 8.5, true, 50, [.42, .45, .5]);
        foreach (es_wrap($v, 9.5, 360) as $i => $l) { if ($i) $y -= 13; $line($l, 9.5, false, 200); }
        $y -= 19;
    }
    $y -= 8; $line('History', 13, true); $y -= 20;
    foreach ($events as $e) {
        $parts = array_filter([$e['detail'], $e['actor'] && stripos($e['detail'], $e['actor']) === false ? 'By ' . $e['actor'] : '', $e['ip'] ? 'IP ' . $e['ip'] : '', $e['ua'] ? mb_substr($e['ua'], 0, 140) : '']);
        $wrapped = es_wrap(implode(' · ', $parts), 8.5, 360);
        if ($y - 13 - count($wrapped) * 11.5 < 80) $newPage();
        $line(es_fmt_time($e['at']), 8.5, false, 50, [.42, .45, .5]);
        $line(ucfirst($e['event']), 9.5, true, 200);
        $y -= 13;
        foreach ($wrapped as $l) { $line($l, 8.5, false, 200, [.3, .33, .4]); $y -= 11.5; }
        $y -= 9;
    }
    if ($y < 110) $newPage();
    $y = max($y - 6, 70);
    foreach (es_wrap('Each signer agreed to do business electronically and adopted the signature(s) shown in this document; each signature appears only in the fields assigned to that signer. Each page image was fixed when the document was sent (Original document SHA-256 above); the SHA-256 of this completed PDF is recorded by ' . es_business()['name'] . '.', 8, 512) as $l) { $line($l, 8, false, 50, [.42, .45, .5]); $y -= 11; }
        $auditPages[] = $ops;
    })();
    $W = 612; $H = 792;
    foreach ($pages as $k => $p) {
        $W = (float)$p['w']; $H = (float)$p['h'];
        if (($p['kind'] ?? '') === 'addendum') { // Schedule A (extra vehicles): drawn as text
            $ops = ''; $y = $H - 64; $sx = $W / 612;
            $tl = function (string $t, float $size, bool $bold, float $x, array $rgb) use (&$ops, &$y) { $ops .= 'BT /' . ($bold ? 'F2' : 'F1') . ' ' . es_n($size) . ' Tf ' . implode(' ', array_map('es_n', $rgb)) . ' rg ' . es_n($x) . ' ' . es_n($y) . ' Td ' . es_pdf_text($t) . " Tj ET\n"; };
            $tl((string)($p['title'] ?? 'Schedule A'), 17 * $sx, true, 54 * $sx, [.07, .09, .13]); $y -= 20 * $sx;
            $tl('Part of agreement #' . (int)$d['number'] . ' — ' . $d['title'] . '. Vehicle 1 is listed in the agreement.', 9 * $sx, false, 54 * $sx, [.42, .45, .5]); $y -= 26 * $sx;
            foreach ($p['blocks'] ?? [] as $bk) {
                if ($y < 120 * $sx) break;
                $ops .= '0.9 0.9 0.92 RG 0.8 w ' . es_n(54 * $sx) . ' ' . es_n($y + 14 * $sx) . ' m ' . es_n($W - 54 * $sx) . ' ' . es_n($y + 14 * $sx) . " l S\n";
                $tl((string)$bk['title'], 12 * $sx, true, 54 * $sx, [.07, .09, .13]); $y -= 18 * $sx;
                foreach ($bk['items'] as [$k2, $v2]) { $tl((string)$k2, 9 * $sx, true, 64 * $sx, [.42, .45, .5]); $tl((string)$v2, 10.5 * $sx, false, 210 * $sx, [.07, .12, .29]); $y -= 15 * $sx; }
                $y -= 16 * $sx;
            }
            $ops .= 'BT /F1 6 Tf 0.45 0.45 0.5 rg 14 8 Td ' . es_pdf_text('Satin e-Sign · Document ID ' . $short . $verTxt . ' · page ' . ($k + 1) . ' of ' . (count($pages) + count($auditPages)) . ($audit ? '' : ' · PREPARED COPY — NOT SIGNED')) . " Tj ET\n";
            $content = $add($stream('/Filter /FlateDecode', (string)gzcompress($ops, 6)));
            $kids[] = $add("<< /Type /Page /Parent $pagesId 0 R /MediaBox [0 0 " . es_n($W) . ' ' . es_n($H) . "] /Resources << /Font << /F1 $f1 0 R /F2 $f2 0 R >> >> /Contents $content 0 R >>");
            continue;
        }
        $jpg = (string)file_get_contents("$dir/" . $p['img']); $info = @getimagesizefromstring($jpg);
        $cs = ($info['channels'] ?? 3) === 1 ? '/DeviceGray' : (($info['channels'] ?? 3) === 4 ? '/DeviceCMYK' : '/DeviceRGB');
        $img = $add($stream('/Type /XObject /Subtype /Image /Width ' . (int)($info[0] ?? 1) . ' /Height ' . (int)($info[1] ?? 1) . " /ColorSpace $cs /BitsPerComponent 8 /Filter /DCTDecode" . ($cs === '/DeviceCMYK' ? ' /Decode [1 0 1 0 1 0 1 0]' : ''), $jpg));
        $xo = ["/P$k $img 0 R", "/Ink $ink 0 R"];
        $ops = 'q ' . es_n($W) . ' 0 0 ' . es_n($H) . " 0 0 cm /P$k Do Q\n";
        foreach ($fields as $f) {
            if ((int)$f['page'] !== $k) continue;
            $x = $f['x'] * $W; $y = $H - ($f['y'] + $f['h']) * $H; $w = $f['w'] * $W; $h = $f['h'] * $H;
            $v = $f['role'] === 'sender' ? ($prefill[$f['id']] ?? '') : ($vals[$f['id']] ?? null);
            if ($f['type'] === 'signature' || $f['type'] === 'initials') {
                if (!is_array($v) || empty($v['mask'])) continue;
                $mw = (int)$v['w']; $mh = (int)$v['h']; $key = md5($v['mask']);
                if (!isset($masks[$key])) {
                    $sm = $add($stream("/Type /XObject /Subtype /Image /Width $mw /Height $mh /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode", $v['mask']));
                    $masks[$key] = $add($stream("/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask $sm 0 R", "\x12\x1f\x4a"));
                }
                $xo[] = "/S{$f['id']} {$masks[$key]} 0 R";
                $sc = min($w / $mw, $h / $mh); $dw = $mw * $sc; $dh = $mh * $sc;
                $ops .= 'q ' . es_n($dw) . ' 0 0 ' . es_n($dh) . ' ' . es_n($x + ($w - $dw) / 2) . ' ' . es_n($y + ($h - $dh) / 2) . " cm /S{$f['id']} Do Q\n";
                if ($f['type'] === 'signature' && count($names) > 1 && isset($names[$f['signer'] ?? ''])) $ops .= 'BT /F1 5.5 Tf 0.4 0.42 0.48 rg ' . es_n($x + 1) . ' ' . es_n($y - 6.5) . ' Td ' . es_pdf_text('Signed by ' . $names[$f['signer']]) . " Tj ET\n";
            } elseif ($f['type'] === 'checkbox') {
                $s = min($w, $h); $bx = $x + ($w - $s) / 2; $by = $y + ($h - $s) / 2;
                $ops .= 'q 0.07 0.12 0.29 RG ' . es_n(max(.6, $s * .07)) . ' w ' . es_n($bx) . ' ' . es_n($by) . ' ' . es_n($s) . ' ' . es_n($s) . " re S\n";
                if ($v === true || $v === '1' || $v === 'true' || $v === 'yes') $ops .= es_n(max(1, $s * .12)) . ' w 1 J 1 j ' . es_n($bx + $s * .2) . ' ' . es_n($by + $s * .52) . ' m ' . es_n($bx + $s * .42) . ' ' . es_n($by + $s * .27) . ' l ' . es_n($bx + $s * .82) . ' ' . es_n($by + $s * .78) . " l S\n";
                $ops .= "Q\n";
            } else {
                $t = is_string($v) ? trim($v) : '';
                if ($t === '') continue;
                $size = min(13.0, max(5.0, $h * .66));
                while ($size > 5 && es_tw($t, $size) > $w - 2) $size -= .5;
                $ops .= 'BT /F1 ' . es_n($size) . ' Tf 0.07 0.12 0.29 rg ' . es_n($x + 1.5) . ' ' . es_n($y + max(1.5, ($h - $size * .72) / 2)) . ' Td ' . es_pdf_text($t) . " Tj ET\n";
            }
        }
        $ops .= 'BT /F1 6 Tf 0.45 0.45 0.5 rg 14 8 Td ' . es_pdf_text('Satin e-Sign · Document ID ' . $short . $verTxt . ' · page ' . ($k + 1) . ' of ' . (count($pages) + count($auditPages)) . ($audit ? '' : ' · PREPARED COPY — NOT SIGNED')) . " Tj ET\n";
        $content = $add($stream('/Filter /FlateDecode', (string)gzcompress($ops, 6)));
        $kids[] = $add("<< /Type /Page /Parent $pagesId 0 R /MediaBox [0 0 " . es_n($W) . ' ' . es_n($H) . "] /Resources << /Font << /F1 $f1 0 R /F2 $f2 0 R >> /XObject << " . implode(' ', $xo) . " >> >> /Contents $content 0 R >>");
    }
    if (!$audit) goto finish;
    $total = count($pages) + count($auditPages);
    foreach ($auditPages as $i => $o) {
        $o .= 'BT /F1 6 Tf 0.45 0.45 0.5 rg 14 8 Td ' . es_pdf_text('Satin e-Sign · Document ID ' . $short . $verTxt . ' · page ' . (count($pages) + $i + 1) . ' of ' . $total) . " Tj ET\n";
        $content = $add($stream('/Filter /FlateDecode', (string)gzcompress($o, 6)));
        $kids[] = $add("<< /Type /Page /Parent $pagesId 0 R /MediaBox [0 0 $W $H] /Resources << /Font << /F1 $f1 0 R /F2 $f2 0 R >> >> /Contents $content 0 R >>");
    }
    finish:
    $obj[$catalog - 1] = "<< /Type /Catalog /Pages $pagesId 0 R >>";
    $obj[$pagesId - 1] = '<< /Type /Pages /Count ' . count($kids) . ' /Kids [' . implode(' ', array_map(fn($k) => "$k 0 R", $kids)) . '] >>';
    $info = $add('<< /Title ' . es_pdf_text($d['title']) . ' /Producer (Satin e-Sign) /CreationDate (D:' . gmdate('YmdHis') . "Z) >>");
    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; $off = [];
    foreach ($obj as $i => $o) { $off[] = strlen($pdf); $pdf .= ($i + 1) . " 0 obj\n$o\nendobj\n"; }
    $x = strlen($pdf);
    $pdf .= "xref\n0 " . (count($obj) + 1) . "\n0000000000 65535 f \n";
    foreach ($off as $o) $pdf .= sprintf("%010d 00000 n \n", $o);
    $pdf .= "trailer\n<< /Size " . (count($obj) + 1) . " /Root $catalog 0 R /Info $info 0 R >>\nstartxref\n$x\n%%EOF\n";
    return $pdf;
}

function es_mail_signed(array $d, string $pdf): void {
    $b = es_business(); $file = preg_replace('/[^A-Za-z0-9 _-]+/', '', $d['title']) ?: 'Agreement'; $file = trim($file) . ' - signed.pdf';
    $mk = function (string $to, string $subject, string $text) use ($pdf, $file, $b) {
        $bd = 'satin-' . bin2hex(random_bytes(10));
        $from = filter_var(cfg('mail_from'), FILTER_VALIDATE_EMAIL) ? cfg('mail_from') : 'no-reply@satingraphic.ca';
        $headers = 'From: ' . mail_hdr($b['name']) . " <$from>\r\nReply-To: " . $b['email'] . "\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$bd\"";
        $body = "--$bd\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n" . quoted_printable_encode($text) . "\r\n"
            . "--$bd\r\nContent-Type: application/pdf; name=\"$file\"\r\nContent-Disposition: attachment; filename=\"$file\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($pdf)) . "--$bd--\r\n";
        return mail_raw($to, mail_hdr($subject), $headers, $body);
    };
    $sg = es_signers($d);
    foreach ($sg as $s) {
        if ($s['email'] === '') continue;
        $first = trim(explode(' ', $s['name'])[0]) ?: 'there';
        $mk($s['email'], 'Completed: ' . $d['title'], "Hi $first,\n\nThank you — \"" . $d['title'] . "\" is signed" . (count($sg) > 1 ? ' by everyone' : '') . ". Your copy is attached as a PDF (it includes the audit trail).\n\nYou can also download it here: " . es_url($s['token']) . "\n\n" . $b['name'] . "\n" . $b['phone']);
    }
    $own = (string)(cfg('notify_email') ?: $b['email']);
    $mk($own, 'Signed: ' . $d['title'] . ' — ' . implode(', ', array_column($sg, 'name')), implode("\n", array_map('es_who', $sg)) . "\nsigned \"" . $d['title'] . '"' . ((int)$d['version'] > 1 ? ' (version ' . (int)$d['version'] . ')' : '') . ".\n\nSigned PDF attached. Document SHA-256: " . $d['final_hash'] . "\n\nOpen in admin: " . es_site() . '/admin/#/agreements');
}

/* ---------- admin API: /api/admin/esign... ---------- */
function es_page_upload(string $dir, string $prefix): array { // multipart meta + page0..N → [{w, h, img}]
    $meta = json_decode((string)($_POST['meta'] ?? '[]'), true);
    if (!is_array($meta) || !$meta || count($meta) > ES_MAX_PAGES) json_out(['error' => 'Upload a PDF with 1 to ' . ES_MAX_PAGES . ' pages.'], 400);
    $ver = substr(bin2hex(random_bytes(4)), 0, 6); $pages = [];
    foreach ($meta as $k => $m) {
        $f = $_FILES['page' . $k] ?? null;
        if (!$f || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || $f['size'] > 8e6) json_out(['error' => 'Page ' . ($k + 1) . ' did not upload. Try again.'], 400);
        $info = @getimagesize($f['tmp_name']);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) json_out(['error' => 'Page ' . ($k + 1) . ' is not a valid image.'], 400);
        $w = (float)($m['w'] ?? 0); $h = (float)($m['h'] ?? 0);
        if ($w < 72 || $h < 72 || $w > 5000 || $h > 5000) json_out(['error' => 'Page size is not valid.'], 400);
        $name = "$prefix{$k}-$ver.jpg"; move_uploaded_file($f['tmp_name'], "$dir/$name");
        $pages[] = ['w' => round($w, 2), 'h' => round($h, 2), 'img' => $name];
    }
    return $pages;
}
/** Every signer has a signature on every attached document (Approval Form …)? */
function es_approval_ready(array $pages, array $fields, array $sids): bool {
    $parts = []; foreach ($pages as $k => $p) if (es_part_of($p) !== 'main') $parts[es_part_of($p)][] = $k;
    foreach ($parts as $idx) foreach ($sids as $sid) { $ok = false; foreach ($fields as $f) if ($f['type'] === 'signature' && ($f['signer'] ?? '') === $sid && in_array((int)$f['page'], $idx, true)) $ok = true; if (!$ok) return false; }
    return true;
}
/** Sends a draft: checks it, fixes the original hash, supersedes the older versions and emails each signer their own link. */
function es_send_doc(array $d, array $u, bool $email): array {
    $pdo = es_db(); $sg = es_signers($d); $fields = json_decode($d['fields'], true); $pages = json_decode($d['pages'], true);
    foreach ($sg as $k => $s) {
        if ($email && $s['email'] === '') json_out(['error' => 'Enter an email address for ' . $s['name'] . ' (signer ' . ($k + 1) . '), or share the links yourself.', 'signer' => $k], 400);
        if (!array_filter($fields, fn($f) => $f['type'] === 'signature' && ($f['signer'] ?? '') === $s['sid'])) json_out(['error' => $s['name'] . ' has no signature field. Place it on the Signature positions step.'], 400);
    }
    if (count($sg) > 1 && count(array_unique(array_filter(array_column($sg, 'email')))) !== count(array_filter(array_column($sg, 'email')))) json_out(['error' => 'Each signer needs a different email address.'], 400);
    if (!es_pricing_ok($d)) json_out(['error' => 'Review and confirm the pricing first (Pricing & payment → Confirm pricing).', 'pricing' => true], 400);
    $ap = json_decode($d['approval'] ?: '{}', true) ?: [];
    if ($ap && (empty($ap['confirmed']) || !es_approval_ready($pages, $fields, array_column($sg, 'sid')))) json_out(['error' => 'Place and confirm each signer’s signature on the Approval Form first.', 'place' => true], 400);
    $now = now_iso();
    $pdo->prepare('UPDATE esign_docs SET original_hash = ?, sent_at = ?, updated_at = ?, via = ? WHERE id = ?')->execute([es_doc_hash($d), $now, $now, $d['via'] === 'public' ? 'public' : ($email ? 'email' : 'link'), $d['id']]);
    // older versions: links stop working; signed copies stay as they are
    $q = $pdo->prepare('SELECT * FROM esign_docs WHERE record_id = ? AND id != ? AND superseded = 0'); $q->execute([$d['record_id'] ?: $d['id'], $d['id']]);
    foreach ($q->fetchAll() as $o) {
        $pdo->prepare("UPDATE esign_docs SET superseded = 1, status = CASE WHEN status IN ('signed', 'cancelled', 'declined') THEN status ELSE 'superseded' END, updated_at = ? WHERE id = ?")->execute([$now, $o['id']]);
        es_event($o['id'], 'superseded', $u['name'], 'Replaced by version ' . (int)$d['version'] . '; links for this version no longer work');
    }
    $d = es_doc_by_id($d['id']); $failed = [];
    foreach ($sg as $s) {
        $pdo->prepare("UPDATE esign_signers SET status = 'sent', sent_at = ? WHERE doc_id = ? AND sid = ? AND status = 'pending'")->execute([$now, $d['id'], $s['sid']]);
        if ($email) { if (!es_send_mail($d, $s)) $failed[] = $s['email']; }
    }
    if (!$email) es_event($d['id'], 'ready to sign', $u['name'], 'Signing links created for ' . implode(', ', array_map('es_who', $sg)) . ' (shared by staff)');
    es_refresh_status($d['id']);
    return $failed;
}

function esign_admin_route(string $r, string $method): void {
    $pdo = es_db();
    if ($r === '/esign' && $method === 'GET') {
        require_user('agreements.view');
        $t = array_map(fn($x) => es_tpl_row($x, false), $pdo->query("SELECT * FROM esign_templates WHERE deleted = 0 AND kind = 'template' ORDER BY updated_at DESC")->fetchAll());
        $d = array_map(fn($x) => es_doc_row($x), $pdo->query('SELECT * FROM esign_docs d WHERE version = (SELECT MAX(version) FROM esign_docs x WHERE x.record_id = d.record_id) ORDER BY created_at DESC LIMIT 500')->fetchAll());
        json_out(['templates' => $t, 'docs' => $d]);
    }
    if ($r === '/esign/template' && $method === 'GET') { require_user('agreements.view'); json_out(['template' => es_tpl_row(es_tpl((string)($_GET['id'] ?? '')))]); }
    if ($r === '/esign/page' && $method === 'GET') {
        require_user('agreements.view');
        $n = (int)($_GET['n'] ?? 0);
        if (isset($_GET['doc'])) { $d = es_doc_by_id((string)$_GET['doc']); $pages = json_decode($d['pages'], true); $f = es_dir('doc/' . $d['id']) . '/' . ($pages[$n]['img'] ?? 'x'); }
        else { $t = es_tpl((string)($_GET['tpl'] ?? '')); $pages = json_decode($t['pages'], true); $f = es_dir('tpl/' . $t['id']) . '/' . ($pages[$n]['img'] ?? 'x'); }
        if (!is_file($f)) json_out(['error' => 'Not found'], 404);
        header('Content-Type: image/jpeg'); header('Cache-Control: private, max-age=86400'); readfile($f); exit;
    }
    if ($r === '/esign/upload' && $method === 'POST') { // multipart: id (optional), name, kind, meta (JSON [{w,h}]), page0..N (JPEG), source (PDF, optional)
        $u = require_user('agreements.send');
        $id = (string)($_POST['id'] ?? '');
        $now = now_iso();
        if ($id !== '') { $t = es_tpl($id); $old = json_decode($t['pages'], true) ?: []; }
        else { $id = uuid(); $old = []; }
        $dir = es_dir('tpl/' . $id);
        $pages = es_page_upload($dir, 'p');
        foreach ($old as $p) @unlink("$dir/" . $p['img']);
        $src = $_FILES['source'] ?? null; $srcName = '';
        if ($src && ($src['error'] ?? 1) === UPLOAD_ERR_OK && $src['size'] < 30e6) { move_uploaded_file($src['tmp_name'], "$dir/source.pdf"); $srcName = text($src['name'] ?? '', 120); }
        $name = text($_POST['name'] ?? '', 120) ?: 'Untitled agreement';
        $kind = ($_POST['kind'] ?? '') === 'oneoff' ? 'oneoff' : 'template';
        if (isset($t)) {
            $fields = array_values(array_filter(json_decode($t['fields'], true) ?: [], fn($f) => $f['page'] < count($pages)));
            $pdo->prepare('UPDATE esign_templates SET pages = ?, fields = ?, source_name = CASE WHEN ? != \'\' THEN ? ELSE source_name END, updated_at = ? WHERE id = ?')->execute([json_encode($pages), json_encode($fields), $srcName, $srcName, $now, $id]);
        } else {
            $pdo->prepare('INSERT INTO esign_templates (id, name, kind, pages, fields, source_name, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')->execute([$id, $name, $kind, json_encode($pages), '[]', $srcName, $u['id'], $now, $now]);
        }
        audit($u, 'agreement template uploaded', $name);
        json_out(['template' => es_tpl_row(es_tpl($id))]);
    }
    if ($r === '/esign/template' && $method === 'POST') {
        $u = require_user('agreements.send'); $v = body_json(400000);
        $t = es_tpl((string)($v['id'] ?? ''));
        $pages = json_decode($t['pages'], true) ?: [];
        $fields = array_map(function ($f) { $f['signer'] = $f['role'] === 'signer' ? 's1' : ''; return $f; }, es_clean_fields($v['fields'] ?? [], count($pages))); // templates are made for one customer; more signers are added per document
        $kind = ($v['kind'] ?? $t['kind']) === 'oneoff' ? 'oneoff' : 'template';
        $pdo->prepare('UPDATE esign_templates SET name = ?, fields = ?, message = ?, kind = ?, updated_at = ? WHERE id = ?')->execute([text($v['name'] ?? '', 120) ?: $t['name'], json_encode($fields), text($v['message'] ?? '', 2000), $kind, now_iso(), $t['id']]);
        json_out(['template' => es_tpl_row(es_tpl($t['id']))]);
    }
    if ($r === '/esign/template/delete' && $method === 'POST') {
        $u = require_user('agreements.send'); $v = body_json(2000); $t = es_tpl((string)($v['id'] ?? ''));
        $pdo->prepare("UPDATE esign_templates SET deleted = 1, link_on = 0, updated_at = ? WHERE id = ?")->execute([now_iso(), $t['id']]);
        audit($u, 'agreement template deleted', $t['name']); json_out(['ok' => true]);
    }
    if ($r === '/esign/template/duplicate' && $method === 'POST') {
        $u = require_user('agreements.send'); $v = body_json(2000); $t = es_tpl((string)($v['id'] ?? ''));
        $id = uuid(); $src = es_dir('tpl/' . $t['id']); $dst = es_dir('tpl/' . $id);
        foreach (glob("$src/*") ?: [] as $f) copy($f, $dst . '/' . basename($f));
        $now = now_iso(); $name = mb_substr('Copy of ' . $t['name'], 0, 120);
        $pdo->prepare('INSERT INTO esign_templates (id, name, kind, pages, fields, message, source_name, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$id, $name, 'template', $t['pages'], $t['fields'], $t['message'], $t['source_name'], $u['id'], $now, $now]);
        audit($u, 'agreement template duplicated', $t['name']); json_out(['template' => es_tpl_row(es_tpl($id))]);
    }
    if ($r === '/esign/draft' && $method === 'GET') { // prepared copy (filled in, not signed) for staff
        require_user('agreements.view'); $d = es_doc_by_id((string)($_GET['id'] ?? ''));
        $pdf = es_build_pdf($d, [], [], false);
        header('Content-Type: application/pdf'); header('Cache-Control: private, no-store');
        header('Content-Disposition: ' . (!empty($_GET['dl']) ? 'attachment' : 'inline') . '; filename="' . ((preg_replace('/[^A-Za-z0-9 _-]+/', '', $d['title']) ?: 'Agreement') . ' - prepared.pdf') . '"');
        echo $pdf; exit;
    }
    if ($r === '/esign/template/link' && $method === 'POST') {
        $u = require_user('agreements.send'); $v = body_json(2000); $t = es_tpl((string)($v['id'] ?? ''));
        $on = !empty($v['on']); $tok = $t['link_token'] ?: token();
        if (!empty($v['reset'])) $tok = token();
        $pdo->prepare('UPDATE esign_templates SET link_on = ?, link_token = ?, updated_at = ? WHERE id = ?')->execute([$on ? 1 : 0, $tok, now_iso(), $t['id']]);
        audit($u, 'agreement public link ' . ($on ? 'on' : 'off'), $t['name']);
        json_out(['template' => es_tpl_row(es_tpl($t['id']))]);
    }
    if ($r === '/esign/send' && $method === 'POST') { // create a document (draft); email: true also sends it at once
        $u = require_user('agreements.send'); $v = body_json(40000);
        $t = es_tpl((string)($v['templateId'] ?? ''));
        $mail = (bool)($v['email'] ?? true);
        $list = is_array($v['signers'] ?? null) ? $v['signers'] : [['name' => $v['signerName'] ?? '', 'email' => $v['signerEmail'] ?? '']];
        $signers = es_clean_signers($list, $mail);
        $d = es_create_doc($t, $signers, text($v['message'] ?? '', 2000), is_array($v['prefill'] ?? null) ? $v['prefill'] : [], $mail ? 'email' : 'link', $u, $v['pricing'] ?? null, !empty($v['auto']));
        $failed = $mail ? es_send_doc($d, $u, true) : [];
        audit($u, 'agreement ' . ($mail ? 'sent' : 'prepared'), $d['title'] . ' → ' . implode(', ', array_column($signers, 'email')));
        json_out(['doc' => es_doc_row(es_doc_by_id($d['id']), true), 'mailed' => $mail && !$failed]);
    }
    if ($r === '/esign/doc/update' && $method === 'POST') { // agreement information + signers. A sent document gets a new version (Edit & Resend).
        $u = require_user('agreements.send'); $v = body_json(40000); $d = es_doc_by_id((string)($v['id'] ?? ''));
        if (in_array($d['status'], ['superseded'], true) || $d['superseded']) json_out(['error' => 'This is an older version. Open the latest version to edit it.'], 409);
        $list = is_array($v['signers'] ?? null) ? $v['signers'] : [['name' => $v['signerName'] ?? $d['signer_name'], 'email' => $v['signerEmail'] ?? $d['signer_email']]];
        $signers = es_clean_signers($list, false);
        if (!es_editable($d)) $d = es_new_version($d, $u);
        $fields = json_decode($d['fields'], true); $pages = json_decode($d['pages'], true);
        $fields = es_sync_signer_fields($fields, array_column($signers, 'sid'), $pages, es_dir('doc/' . $d['id']));
        $pf = es_clean_prefill($fields, is_array($v['prefill'] ?? null) ? $v['prefill'] : []);
        $msg = text($v['message'] ?? $d['message'], 2000);
        $ap = json_decode($d['approval'] ?: '{}', true) ?: [];
        if ($ap && !es_approval_ready($pages, $fields, array_column($signers, 'sid'))) { $ap['confirmed'] = false; }
        $prc = array_key_exists('pricing', $v) ? es_clean_pricing($v['pricing'], $fields, $pf, $u) : $d['pricing'];
        $pdo->prepare('UPDATE esign_docs SET fields = ?, prefill = ?, message = ?, approval = ?, pricing = ?, updated_at = ? WHERE id = ?')->execute([json_encode($fields), json_encode($pf, JSON_UNESCAPED_UNICODE), $msg, $ap ? json_encode($ap) : '', $prc, now_iso(), $d['id']]);
        $pc = json_decode($prc ?: '{}', true) ?: [];
        if (!empty($pc['confirmed'])) es_event($d['id'], 'pricing confirmed', $u['name'], implode(' · ', array_filter(array_map(fn($r, $id) => ($pf[$id] ?? '') !== '' ? ['price' => 'Price', 'start' => 'Start deposit', 'prod' => 'Production deposit', 'tax' => 'Tax', 'total' => 'Total', 'after' => 'Total after tax', 'balance' => 'Balance'][$r] . ' ' . $pf[$id] : '', array_keys(es_price_fields($fields)), es_price_fields($fields)))));
        es_put_signers($d['id'], $signers);
        es_info_changes(es_doc_by_id($d['id']));
        es_event($d['id'], 'information updated', $u['name'], count($signers) . ' signer' . (count($signers) === 1 ? '' : 's') . ': ' . implode(', ', array_map('es_who', $signers)));
        json_out(['doc' => es_doc_row(es_doc_by_id($d['id']), true)]);
    }
    if ($r === '/esign/doc/layout' && $method === 'POST') { // signature positions (main form + Approval Form) of a draft
        $u = require_user('agreements.send'); $v = body_json(400000); $d = es_doc_by_id((string)($v['id'] ?? '')); es_need_draft($d);
        $pages = json_decode($d['pages'], true); $old = json_decode($d['fields'], true); $sids = array_column(es_signers($d), 'sid');
        $byId = []; foreach ($old as $f) $byId[$f['id']] = $f;
        $fields = [];
        foreach (es_clean_fields($v['fields'] ?? [], count($pages)) as $f) {
            if (isset($byId[$f['id']])) { $o = $byId[$f['id']]; foreach (['page', 'x', 'y', 'w', 'h'] as $k) $o[$k] = $f[$k]; if ($o['role'] === 'signer' && in_array($f['signer'], $sids, true) && in_array($o['type'], ['signature', 'date'], true)) $o['signer'] = $f['signer']; $fields[] = $o; unset($byId[$f['id']]); }
            elseif ($f['role'] === 'signer' && in_array($f['type'], ['signature', 'date'], true) && in_array($f['signer'], $sids, true)) { $f['label'] = $f['type'] === 'date' ? 'Date signed' : 'Signature'; $f['required'] = $f['type'] === 'signature'; $fields[] = $f; } // new signature / date markers
        }
        foreach ($byId as $f) if (!($f['role'] === 'signer' && in_array($f['type'], ['signature', 'date'], true))) $fields[] = $f; // only signature / date markers can be removed here
        foreach ($sids as $sid) if (!array_filter($fields, fn($f) => $f['type'] === 'signature' && $f['signer'] === $sid)) json_out(['error' => 'Every signer needs at least one signature position.'], 400);
        $ap = json_decode($d['approval'] ?: '{}', true) ?: [];
        if ($ap) {
            if (!es_approval_ready($pages, $fields, $sids)) json_out(['error' => 'Place a signature for each signer on every attached document (Approval Form …).'], 400);
            $ap['confirmed'] = true;
        }
        $moved = json_encode(array_map(fn($f) => [$f['id'], $f['page'], $f['x'], $f['y'], $f['signer']], $old)) !== json_encode(array_map(fn($f) => [$f['id'], $f['page'], $f['x'], $f['y'], $f['signer']], $fields));
        $pdo->prepare('UPDATE esign_docs SET fields = ?, approval = ?, updated_at = ? WHERE id = ?')->execute([json_encode($fields), $ap ? json_encode($ap) : '', now_iso(), $d['id']]);
        if ($moved) { es_event($d['id'], 'signature positions set', $u['name']); if ((int)$d['version'] > 1) es_add_change($d['id'], 'Signature positions changed'); }
        json_out(['doc' => es_doc_row(es_doc_by_id($d['id']), true)]);
    }
    if ($r === '/esign/doc/approval' && $method === 'POST') { // documents attached to the agreement (Approval Form …). multipart: id + (name, meta, page0..N [, replace = part]) to add / replace, or remove = part ('1' = all)
        $u = require_user('agreements.send'); $d = es_doc_by_id((string)($_POST['id'] ?? '')); es_need_draft($d);
        $dir = es_dir('doc/' . $d['id']); $pages = json_decode($d['pages'], true); $fields = json_decode($d['fields'], true);
        $ap = json_decode($d['approval'] ?: '{}', true) ?: []; $parts = es_part_list($ap); $sids = array_column(es_signers($d), 'sid');
        $save = function (array $pages, array $fields, array $parts, string $event, string $detail, string $change) use ($pdo, $d, $u) {
            $cnt = count(array_filter($pages, fn($p) => es_part_of($p) !== 'main'));
            $ap = $parts ? ['parts' => array_values($parts), 'name' => $parts[0]['name'], 'count' => $cnt, 'confirmed' => false, 'uploadedAt' => now_iso()] : [];
            $pdo->prepare('UPDATE esign_docs SET pages = ?, fields = ?, approval = ?, updated_at = ? WHERE id = ?')->execute([json_encode(array_values($pages)), json_encode(array_values($fields)), $ap ? json_encode($ap) : '', now_iso(), $d['id']]);
            es_event($d['id'], $event, $u['name'], $detail); if ((int)$d['version'] > 1) es_add_change($d['id'], $change);
            json_out(['doc' => es_doc_row(es_doc_by_id($d['id']), true)]);
        };
        $rm = (string)($_POST['remove'] ?? '');
        if ($rm !== '') {
            $ids = $rm === '1' ? array_column($parts, 'id') : [$rm]; $names = [];
            foreach ($ids as $pid) { [$pages, $fields] = es_remove_part($pages, $fields, $pid, $dir); foreach ($parts as $x) if ($x['id'] === $pid) $names[] = $x['name']; }
            $parts = array_values(array_filter($parts, fn($x) => !in_array($x['id'], $ids, true)));
            $save($pages, $fields, $parts, 'document removed', implode(', ', $names) ?: 'Attached document', 'Removed: ' . (implode(', ', $names) ?: 'attached document'));
        }
        $meta = json_decode((string)($_POST['meta'] ?? '[]'), true) ?: [];
        $rep = (string)($_POST['replace'] ?? ''); $at = null;
        if ($rep !== '' && in_array($rep, array_column($parts, 'id'), true)) { [$pages, $fields, $at] = es_remove_part($pages, $fields, $rep, $dir); $pid = $rep; }
        else { $rep = ''; $pid = 'a' . substr(bin2hex(random_bytes(4)), 0, 6); }
        if (count($pages) + count($meta) > ES_MAX_PAGES) json_out(['error' => 'All documents together can have up to ' . ES_MAX_PAGES . ' pages.'], 400);
        $new = array_map(fn($p) => $p + ['kind' => 'approval', 'part' => $pid], es_page_upload($dir, $pid . '-'));
        if ($at === null) { $at = count($pages); if (es_auto($d) || !empty($_POST['first'])) foreach ($pages as $k => $p) if (es_part_of($p) === 'main') { $at = $k; break; } } // automated agreements: new documents go before the agreement, in upload order (staff can reorder)
        [$pages, $fields] = es_insert_pages($pages, $fields, $at, $new);
        $fields = es_autoplace($pages, $fields, $sids, $pid, $dir);
        $name = text($_POST['name'] ?? '', 120) ?: 'Approval Form';
        if ($rep !== '') { foreach ($parts as &$x) if ($x['id'] === $pid) $x['name'] = $name; unset($x); } else $parts[] = ['id' => $pid, 'name' => $name];
        $save($pages, $fields, $parts, $rep !== '' ? 'document replaced' : 'document added', $name . ' (' . count($new) . ' page' . (count($new) === 1 ? '' : 's') . ')', ($rep !== '' ? 'Replaced: ' : 'Added: ') . $name);
    }
    if ($r === '/esign/doc/order' && $method === 'POST') { // order of the documents: {id, order: ['a1…', 'main', …]}
        $u = require_user('agreements.send'); $v = body_json(4000); $d = es_doc_by_id((string)($v['id'] ?? '')); es_need_draft($d);
        $before = array_column(es_parts($d), 'id');
        [$pages, $fields] = es_reorder(json_decode($d['pages'], true), json_decode($d['fields'], true), is_array($v['order'] ?? null) ? $v['order'] : []);
        $pdo->prepare('UPDATE esign_docs SET pages = ?, fields = ?, updated_at = ? WHERE id = ?')->execute([json_encode($pages), json_encode($fields), now_iso(), $d['id']]);
        $d = es_doc_by_id($d['id']); $after = es_parts($d);
        if (array_column($after, 'id') !== $before) { es_event($d['id'], 'documents reordered', $u['name'], implode(' → ', array_column($after, 'name'))); if ((int)$d['version'] > 1) es_add_change($d['id'], 'Document order changed'); }
        json_out(['doc' => es_doc_row($d, true)]);
    }
    if ($r === '/esign/doc/send' && $method === 'POST') { // draft → send to every signer (email) or make the links (link). With sid: email one signer again.
        $u = require_user('agreements.send'); $v = body_json(4000); $d = es_doc_by_id((string)($v['id'] ?? ''));
        if ($d['superseded']) json_out(['error' => 'This is an older version. Open the latest version.'], 409);
        if (!empty($v['sid'])) {
            if (!in_array($d['status'], ['sent', 'viewed', 'partial'], true)) json_out(['error' => 'This agreement is not waiting for signatures.'], 409);
            $s = null; foreach (es_signers($d) as $x) if ($x['sid'] === $v['sid']) $s = $x;
            if (!$s) json_out(['error' => 'Signer not found.'], 404);
            if ($s['status'] === 'signed') json_out(['error' => $s['name'] . ' has already signed.'], 409);
            $email = strtolower(text($v['email'] ?? $s['email'], 254));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Enter ' . $s['name'] . '’s email address.'], 400);
            foreach (es_signers($d) as $x) if ($x['sid'] !== $s['sid'] && strtolower($x['email']) === $email) json_out(['error' => "$email is already another signer on this document."], 400);
            $pdo->prepare('UPDATE esign_signers SET email = ?, sent_at = COALESCE(sent_at, ?) WHERE doc_id = ? AND sid = ?')->execute([$email, now_iso(), $d['id'], $s['sid']]);
            if ($s['sid'] === 's1') $pdo->prepare('UPDATE esign_docs SET signer_email = ? WHERE id = ?')->execute([$email, $d['id']]);
            $s['email'] = $email; $ok = es_send_mail($d, $s, $s['status'] !== 'pending');
            if (!$ok) json_out(['error' => 'The email could not be sent. Copy the link and send it yourself, or check Admin → Notifications & app → Email delivery.'], 502);
            json_out(['ok' => true, 'doc' => es_doc_row(es_doc_by_id($d['id']), true)]);
        }
        if (!es_editable($d)) json_out(['error' => 'This agreement was already sent.'], 409);
        $failed = es_send_doc($d, $u, ($v['mode'] ?? 'email') !== 'link');
        audit($u, 'agreement sent', $d['title'] . ' v' . $d['version']);
        if ($failed) json_out(['error' => 'Saved, but the email to ' . implode(', ', $failed) . ' could not be sent. Copy that signer’s link and send it yourself.', 'doc' => es_doc_row(es_doc_by_id($d['id']), true)], 502);
        json_out(['ok' => true, 'doc' => es_doc_row(es_doc_by_id($d['id']), true)]);
    }
    if ($r === '/esign/doc' && $method === 'GET') { require_user('agreements.view'); json_out(['doc' => es_doc_row(es_doc_by_id((string)($_GET['id'] ?? '')), true)]); }
    if ($r === '/esign/doc/remind' && $method === 'POST') { // every signer who has not signed, or one (sid)
        $u = require_user('agreements.send'); $v = body_json(2000); $d = es_doc_by_id((string)($v['id'] ?? ''));
        if (!in_array($d['status'], ['sent', 'viewed', 'partial'], true)) json_out(['error' => 'This document is not waiting for a signature.'], 409);
        $n = 0; $ok = true;
        foreach (es_signers($d) as $s) if ($s['status'] !== 'signed' && $s['email'] !== '' && (empty($v['sid']) || $v['sid'] === $s['sid'])) { $ok = es_send_mail($d, $s, true) && $ok; $n++; }
        if (!$n) json_out(['error' => 'No signer with an email address is waiting.'], 400);
        json_out(['ok' => $ok, 'count' => $n]);
    }
    if ($r === '/esign/doc/cancel' && $method === 'POST') {
        $u = require_user('agreements.send'); $v = body_json(2000); $d = es_doc_by_id((string)($v['id'] ?? ''));
        if (!in_array($d['status'], ['draft', 'sent', 'viewed', 'partial'], true)) json_out(['error' => 'Only unsigned documents can be cancelled.'], 409);
        $pdo->prepare("UPDATE esign_docs SET status = 'cancelled', updated_at = ? WHERE id = ?")->execute([now_iso(), $d['id']]);
        es_event($d['id'], 'cancelled', $u['name']); json_out(['doc' => es_doc_row(es_doc_by_id($d['id']), true)]);
    }
    if ($r === '/esign/doc/delete' && $method === 'POST') { // deletes this version
        $u = require_user('agreements.send'); $v = body_json(2000); $d = es_doc_by_id((string)($v['id'] ?? ''));
        if (($d['status'] === 'signed' || $d['status'] === 'partial') && !in_array('settings.edit', $u['permissions'], true)) json_out(['error' => 'Only the owner can delete signed agreements.'], 403);
        $dir = es_dir('doc/' . $d['id']); foreach (glob("$dir/*") ?: [] as $f) @unlink($f); @rmdir($dir);
        $pdo->prepare('DELETE FROM esign_events WHERE doc_id = ?')->execute([$d['id']]);
        $pdo->prepare('DELETE FROM esign_signers WHERE doc_id = ?')->execute([$d['id']]);
        $pdo->prepare('DELETE FROM esign_docs WHERE id = ?')->execute([$d['id']]);
        audit($u, 'agreement deleted', $d['title'] . ' v' . $d['version'] . ' (' . $d['signer_email'] . ')'); json_out(['ok' => true]);
    }
    if ($r === '/esign/pdf' && $method === 'GET') {
        require_user('agreements.view'); $d = es_doc_by_id((string)($_GET['id'] ?? ''));
        es_serve_pdf($d, !empty($_GET['dl']));
    }
    json_out(['error' => 'Not found'], 404);
}
function es_serve_pdf(array $d, bool $download): void {
    $f = es_dir('doc/' . $d['id']) . '/signed.pdf';
    if ($d['status'] !== 'signed' || !is_file($f)) json_out(['error' => 'The signed PDF is not ready.'], 404);
    $name = (preg_replace('/[^A-Za-z0-9 _-]+/', '', $d['title']) ?: 'Agreement') . ((int)$d['version'] > 1 ? ' v' . (int)$d['version'] : '') . ' - signed.pdf';
    header('Content-Type: application/pdf'); header('Cache-Control: private, no-store');
    header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="' . $name . '"');
    header('Content-Length: ' . filesize($f)); readfile($f); exit;
}

/* ---------- signer API: /api/sign/... ---------- */
function es_public_doc(array $d, array $s): array {
    $pages = json_decode($d['pages'], true); $fields = json_decode($d['fields'], true); $pf = json_decode($d['prefill'], true) ?: [];
    $sg = es_signers($d); $names = array_column($sg, 'name', 'sid'); $out = [];
    foreach ($fields as $f) {
        $mine = $f['role'] === 'signer' && ($f['signer'] ?: 's1') === $s['sid'];
        $x = ['id' => $f['id'], 'type' => $f['type'], 'page' => $f['page'], 'x' => $f['x'], 'y' => $f['y'], 'w' => $f['w'], 'h' => $f['h'], 'label' => $f['label'], 'required' => $f['required'], 'role' => $mine ? 'signer' : ($f['role'] === 'sender' ? 'sender' : 'other')];
        if ($f['role'] === 'sender' || $mine && isset($pf[$f['id']])) $x['value'] = $pf[$f['id']] ?? '';
        if ($x['role'] === 'other') $x['who'] = $names[$f['signer'] ?: 's1'] ?? 'Another signer';
        $out[] = $x;
    }
    $b = es_business();
    $closed = $d['superseded'] && $d['status'] !== 'signed' ? 'superseded' : $d['status'];
    return ['title' => $d['title'], 'status' => $closed, 'version' => (int)$d['version'], 'signerName' => $s['name'], 'signerEmail' => $s['email'], 'myStatus' => $s['status'], 'mySignedAt' => $s['signed_at'],
        'others' => array_values(array_map(fn($x) => ['name' => $x['name'], 'signed' => $x['status'] === 'signed'], array_filter($sg, fn($x) => $x['sid'] !== $s['sid']))),
        'message' => $d['message'], 'business' => $b['name'], 'businessPhone' => $b['phone'],
        'pages' => array_map(fn($p, $k) => ['w' => $p['w'], 'h' => $p['h'], 'kind' => $p['kind'] ?? 'main'] + (empty($p['img']) ? ['url' => '', 'title' => $p['title'] ?? '', 'blocks' => $p['blocks'] ?? []] : ['url' => '/api/sign/page?t=' . $s['token'] . '&n=' . $k]), $pages, array_keys($pages)), 'fields' => $out,
        'auto' => (bool)es_auto($d), 'intake' => (es_auto($d)['intake'] ?? '') === 'pending' && $s['sid'] === 's1' ? ['fields' => es_intake_spec($fields, es_auto($d)['fields'] ?? [], $pf), 'vehicles' => array_values(es_auto($d)['vehicles'] ?? [])] : null,
        'canEditDetails' => (es_auto($d)['intake'] ?? '') === 'done' && $s['sid'] === 's1' && $s['status'] !== 'signed' && in_array($d['status'], ['sent', 'viewed'], true) && !$d['superseded'],
        'signedAt' => $d['signed_at'], 'pdf' => $d['status'] === 'signed' ? '/api/sign/pdf?t=' . $s['token'] : '', 'today' => (new DateTime('now', new DateTimeZone('America/Toronto')))->format('M j, Y')];
}
function esign_public_route(string $path, string $method): void {
    header('X-Robots-Tag: noindex'); header('Referrer-Policy: no-referrer');
    $pdo = es_db();
    if ($path === '/api/sign/doc' && $method === 'GET') {
        [$d, $s] = es_doc_by_token((string)($_GET['t'] ?? ''));
        if ($d['status'] === 'draft') json_out(['error' => 'This document is not ready for signing yet.'], 409);
        if (in_array($s['status'], ['pending', 'sent'], true) && in_array($d['status'], ['sent', 'viewed', 'partial'], true) && !$d['superseded']) {
            $now = now_iso();
            $pdo->prepare("UPDATE esign_signers SET status = 'viewed', viewed_at = ?, sent_at = COALESCE(sent_at, ?) WHERE doc_id = ? AND sid = ?")->execute([$now, $now, $d['id'], $s['sid']]);
            $pdo->prepare('UPDATE esign_docs SET viewed_at = COALESCE(viewed_at, ?), updated_at = ? WHERE id = ?')->execute([$now, $now, $d['id']]);
            es_event($d['id'], 'viewed', es_who($s), 'Signing page opened'); es_refresh_status($d['id']);
            [$d, $s] = es_doc_by_token((string)$_GET['t']);
        }
        json_out(['doc' => es_public_doc($d, $s)]);
    }
    if ($path === '/api/sign/page' && $method === 'GET') {
        [$d] = es_doc_by_token((string)($_GET['t'] ?? '')); $pages = json_decode($d['pages'], true); $n = (int)($_GET['n'] ?? -1);
        $f = es_dir('doc/' . $d['id']) . '/' . ($pages[$n]['img'] ?? 'x');
        if (!is_file($f)) json_out(['error' => 'Not found'], 404);
        header('Content-Type: image/jpeg'); header('Cache-Control: private, max-age=3600'); readfile($f); exit;
    }
    if ($path === '/api/sign/pdf' && $method === 'GET') { [$d] = es_doc_by_token((string)($_GET['t'] ?? '')); es_serve_pdf($d, !empty($_GET['dl'])); }
    if ($path === '/api/sign/link' && $method === 'GET') {
        $l = (string)($_GET['l'] ?? '');
        $q = $pdo->prepare('SELECT * FROM esign_templates WHERE link_token = ? AND link_on = 1 AND deleted = 0'); $q->execute([$l]); $t = $q->fetch();
        if (!$t || !preg_match('/^[A-Za-z0-9_-]{30,60}$/', $l)) json_out(['error' => 'This signing link is no longer active. Please contact us for a new one.'], 404);
        $tf = es_clean_fields(json_decode($t['fields'], true) ?: [], count(json_decode($t['pages'], true) ?: []));
        $map = es_intake_fields($tf);
        json_out(['title' => $t['name'], 'business' => es_business()['name'], 'message' => $t['message'], 'intake' => $map ? ['fields' => es_intake_spec($tf, $map, []), 'vehicles' => []] : null]);
    }
    if ($path === '/api/sign/start' && $method === 'POST') {
        same_origin(); $v = body_json(4000);
        $l = (string)($v['l'] ?? '');
        $q = $pdo->prepare('SELECT * FROM esign_templates WHERE link_token = ? AND link_on = 1 AND deleted = 0'); $q->execute([$l]); $t = $q->fetch();
        if (!$t || !preg_match('/^[A-Za-z0-9_-]{30,60}$/', $l)) json_out(['error' => 'This signing link is no longer active.'], 404);
        $tf = es_clean_fields(json_decode($t['fields'], true) ?: [], count(json_decode($t['pages'], true) ?: [])); $map = es_intake_fields($tf); $c = null;
        if ($map && isset($v['values'])) { $c = es_intake_clean($tf, $map, $v['values'], $v['vehicles'] ?? []); $name = $c['name']; $email = $c['email']; } // automated: the details form
        else { $name = text($v['name'] ?? '', 120); $email = strtolower(text($v['email'] ?? '', 254)); }
        if (mb_strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Enter your full name and a valid email.'], 400);
        if (rate_limited('esign:' . client_ip(), 12, 3600)) json_out(['error' => 'Too many attempts. Try again later.'], 429);
        note_attempt('esign:' . client_ip());
        $d = es_create_doc($t, [['sid' => 's1', 'name' => $name, 'email' => $email]], $t['message'], [], 'public', null, null, (bool)$c);
        if ($c) $d = es_intake_store($d, $c, es_who(['name' => $name, 'email' => $email]));
        $now = now_iso();
        $pdo->prepare("UPDATE esign_signers SET status = 'sent', sent_at = ? WHERE doc_id = ?")->execute([$now, $d['id']]);
        $pdo->prepare("UPDATE esign_docs SET status = 'sent', sent_at = ?, original_hash = ? WHERE id = ?")->execute([$now, es_doc_hash($d), $d['id']]);
        json_out(['t' => $d['token']]);
    }
    if ($path === '/api/sign/decline' && $method === 'POST') {
        same_origin(); $v = body_json(4000); [$d, $s] = es_doc_by_token((string)($v['t'] ?? ''));
        if (!in_array($d['status'], ['sent', 'viewed', 'partial'], true) || $d['superseded'] || $s['status'] === 'signed') json_out(['error' => 'This document can no longer be changed.'], 409);
        $reason = text($v['reason'] ?? '', 500); $now = now_iso();
        $pdo->prepare("UPDATE esign_signers SET status = 'declined', decline_reason = ? WHERE doc_id = ? AND sid = ?")->execute([$reason, $d['id'], $s['sid']]);
        $pdo->prepare("UPDATE esign_docs SET status = 'declined', decline_reason = ?, updated_at = ? WHERE id = ?")->execute([trim($s['name'] . ': ' . $reason, ': '), $now, $d['id']]);
        es_event($d['id'], 'declined', es_who($s), $reason !== '' ? 'Reason: ' . $reason : 'No reason given');
        try { require_once __DIR__ . '/push.php'; push_event('agreements', '✖ Agreement declined', $s['name'] . ' · ' . $d['title'], '/admin/#/agreements', 'es-' . $d['id']); } catch (Throwable $e) { }
        notify_owner('Declined: ' . $d['title'] . ' — ' . $s['name'], es_who($s) . " declined to sign \"" . $d['title'] . "\".\n" . ($reason !== '' ? "Reason: $reason\n" : '') . "\n" . es_site() . '/admin/#/agreements');
        json_out(['ok' => true]);
    }
    if ($path === '/api/sign/intake-edit' && $method === 'POST') { // the customer goes back to correct their details (before anyone has signed)
        same_origin(); $v = body_json(4000); [$d, $s] = es_doc_by_token((string)($v['t'] ?? ''));
        $a = es_auto($d);
        if (!$a || ($a['intake'] ?? '') !== 'done' || $s['sid'] !== 's1' || $s['status'] === 'signed' || $d['superseded'] || !in_array($d['status'], ['sent', 'viewed'], true)) json_out(['error' => 'Your details can no longer be changed here. Please contact ' . es_business()['name'] . '.'], 409);
        $a['intake'] = 'pending';
        $pdo->prepare('UPDATE esign_docs SET auto = ?, updated_at = ? WHERE id = ?')->execute([json_encode($a), now_iso(), $d['id']]);
        es_event($d['id'], 'editing details', es_who($s), 'Went back to correct their details');
        [$d, $s] = es_doc_by_token((string)$v['t']);
        json_out(['ok' => true, 'doc' => es_public_doc($d, $s)]);
    }
    if ($path === '/api/sign/intake' && $method === 'POST') { // automated agreement: the customer's details form
        same_origin(); $v = body_json(60000); [$d, $s] = es_doc_by_token((string)($v['t'] ?? ''));
        $a = es_auto($d);
        if (!$a || ($a['intake'] ?? '') !== 'pending' || $s['sid'] !== 's1') json_out(['error' => 'Your details are already saved.'], 409);
        if ($d['superseded'] || !in_array($d['status'], ['sent', 'viewed'], true)) json_out(['error' => 'This document is no longer available. Please contact ' . es_business()['name'] . '.'], 409);
        if (rate_limited('esign-intake:' . client_ip(), 30, 3600)) json_out(['error' => 'Too many attempts. Try again later.'], 429);
        note_attempt('esign-intake:' . client_ip());
        $c = es_intake_clean(json_decode($d['fields'], true), $a['fields'] ?? [], $v['values'] ?? [], $v['vehicles'] ?? []);
        es_intake_store($d, $c, es_who($s));
        [$d, $s] = es_doc_by_token((string)$v['t']);
        json_out(['ok' => true, 'doc' => es_public_doc($d, $s)]);
    }
    if ($path === '/api/sign/submit' && $method === 'POST') {
        same_origin(); $v = body_json(4000000); [$d, $s] = es_doc_by_token((string)($v['t'] ?? ''));
        if ((es_auto($d)['intake'] ?? '') === 'pending') json_out(['error' => 'Please fill in your details first.'], 409);
        if ($s['status'] === 'signed') json_out(['error' => 'You have already signed this document.'], 409);
        if ($d['superseded'] || !in_array($d['status'], ['sent', 'viewed', 'partial'], true)) json_out(['error' => 'This document is no longer available for signing. Please contact ' . es_business()['name'] . '.'], 409);
        if (($v['consent'] ?? null) !== true) json_out(['error' => 'Please agree to sign electronically.'], 400);
        if (rate_limited('esign-submit:' . client_ip(), 20, 3600)) json_out(['error' => 'Too many attempts. Try again later.'], 429);
        note_attempt('esign-submit:' . client_ip());
        $fields = json_decode($d['fields'], true); $in = is_array($v['values'] ?? null) ? $v['values'] : []; $vals = []; $masks = []; $audit = [];
        $today = (new DateTime('now', new DateTimeZone('America/Toronto')))->format('M j, Y');
        foreach ($fields as $f) {
            if ($f['role'] !== 'signer' || ($f['signer'] ?: 's1') !== $s['sid']) continue; // only this signer's own fields
            $x = $in[$f['id']] ?? null; $label = $f['label'] !== '' ? $f['label'] : ucfirst($f['type']);
            if ($f['type'] === 'date') { $vals[$f['id']] = $today; continue; }
            if ($f['type'] === 'signature' || $f['type'] === 'initials') {
                if (is_array($x) && isset($x['w'], $x['h'], $x['data'])) {
                    $w = (int)$x['w']; $h = (int)$x['h']; $plain = base64_decode((string)$x['data'], true); // alpha (ink) bytes, one per pixel
                    if ($w < 10 || $h < 10 || $w > 1600 || $h > 800 || $plain === false || strlen($plain) !== $w * $h) json_out(['error' => 'Your ' . $f['type'] . ' could not be read. Please draw or type it again.'], 400);
                    $ink = 0; for ($i = 0, $n = strlen($plain); $i < $n; $i += 7) if (ord($plain[$i]) > 60) $ink++;
                    if ($ink < 8) json_out(['error' => 'Your ' . $f['type'] . ' looks empty. Please draw or type it again.'], 400);
                    $how = ($x['how'] ?? '') === 'type' ? 'typed' : 'drawn'; $txt = text($x['text'] ?? '', 80);
                    $masks[$f['id']] = ['w' => $w, 'h' => $h, 'mask' => base64_encode((string)gzcompress($plain, 6))];
                    $vals[$f['id']] = ['how' => $how, 'text' => $txt, 'w' => $w, 'h' => $h];
                    $a = ucfirst($f['type']) . ' ' . $how . ($txt !== '' ? ' ("' . $txt . '")' : ''); if (!in_array($a, $audit, true)) $audit[] = $a;
                } elseif ($f['required']) json_out(['error' => 'Please add your ' . $f['type'] . ' to every required field.', 'field' => $f['id']], 400);
                continue;
            }
            if ($f['type'] === 'checkbox') { $vals[$f['id']] = $x === true; if ($f['required'] && $x !== true) json_out(['error' => 'Please check: ' . $label, 'field' => $f['id']], 400); continue; }
            $str = text(is_string($x) ? $x : '', 500);
            if ($f['type'] === 'email' && $str !== '' && !filter_var($str, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Enter a valid email address.', 'field' => $f['id']], 400);
            if ($f['required'] && $str === '') json_out(['error' => 'Please fill in: ' . $label, 'field' => $f['id']], 400);
            $vals[$f['id']] = $str;
        }
        $now = now_iso(); $who = es_who($s);
        $pdo->exec('BEGIN IMMEDIATE');
        try {
            $q = $pdo->prepare('SELECT status FROM esign_signers WHERE doc_id = ? AND sid = ?'); $q->execute([$d['id'], $s['sid']]);
            if ($q->fetchColumn() === 'signed') { $pdo->exec('ROLLBACK'); json_out(['error' => 'You have already signed this document.'], 409); }
            file_put_contents(es_dir('doc/' . $d['id']) . '/sig-' . $s['sid'] . '.json', json_encode($masks));
            $cur = es_doc_by_id($d['id']); $all = (json_decode($cur['vals'], true) ?: []) + []; foreach ($vals as $k => $x) $all[$k] = $x;
            $pdo->prepare('UPDATE esign_docs SET vals = ?, updated_at = ? WHERE id = ?')->execute([json_encode($all, JSON_UNESCAPED_UNICODE), $now, $d['id']]);
            $pdo->prepare("UPDATE esign_signers SET status = 'signed', signed_at = ?, ip = ?, ua = ? WHERE doc_id = ? AND sid = ?")->execute([$now, client_ip(), es_ua(), $d['id'], $s['sid']]);
            $pdo->exec('COMMIT');
        } catch (Throwable $e) { try { $pdo->exec('ROLLBACK'); } catch (Throwable $e2) { } throw $e; }
        es_event($d['id'], 'signed', $who, 'Agreed to sign electronically. ' . implode('; ', $audit));
        $sg = es_signers(es_doc_by_id($d['id'])); $left = array_filter($sg, fn($x) => $x['status'] !== 'signed');
        if ($left) { // others still have to sign
            es_refresh_status($d['id']);
            $n = count($sg) - count($left);
            try { require_once __DIR__ . '/push.php'; push_event('agreements', '✍️ Signed ' . $n . ' of ' . count($sg), $s['name'] . ' · ' . $d['title'], '/admin/#/agreements', 'es-' . $d['id']); } catch (Throwable $e) { }
            [$d, $s] = es_doc_by_token((string)$v['t']);
            json_out(['ok' => true, 'doc' => es_public_doc($d, $s)]);
        }
        $d = es_doc_by_id($d['id']); $d['signed_at'] = $now;
        $pdo->prepare('UPDATE esign_docs SET signed_at = ?, sign_ip = ?, sign_ua = ? WHERE id = ?')->execute([$now, client_ip(), es_ua(), $d['id']]);
        $q = $pdo->prepare('SELECT at, event, actor, ip, ua, detail FROM esign_events WHERE doc_id = ? ORDER BY id'); $q->execute([$d['id']]);
        $events = $q->fetchAll(); $events[] = ['at' => $now, 'event' => 'completed', 'actor' => '', 'ip' => '', 'ua' => '', 'detail' => 'All signatures collected. Signed PDF generated and emailed to ' . implode(', ', array_filter(array_column($sg, 'email'))) . ' and ' . es_business()['name']];
        $all = json_decode($d['vals'], true) ?: [];
        foreach (es_masks($d) as $fid => $m) $all[$fid] = $m;
        $pdf = es_build_pdf($d, $all, $events);
        file_put_contents(es_dir('doc/' . $d['id']) . '/signed.pdf', $pdf);
        $hash = hash('sha256', $pdf);
        $pdo->prepare("UPDATE esign_docs SET status = 'signed', final_hash = ?, updated_at = ? WHERE id = ?")->execute([$hash, $now, $d['id']]);
        es_event($d['id'], 'completed', '', 'Signed PDF generated (SHA-256 ' . $hash . ') and emailed to ' . implode(', ', array_filter(array_column($sg, 'email'))) . ' and ' . es_business()['name']);
        $d = es_doc_by_id($d['id']);
        try { es_mail_signed($d, $pdf); } catch (Throwable $e) { error_log('esign mail: ' . $e->getMessage()); }
        try { require_once __DIR__ . '/push.php'; push_event('agreements', '✍️ Agreement signed', implode(', ', array_column($sg, 'name')) . ' · ' . $d['title'], '/admin/#/agreements', 'es-' . $d['id']); } catch (Throwable $e) { }
        [$d, $s] = es_doc_by_token((string)$v['t']);
        json_out(['ok' => true, 'doc' => es_public_doc($d, $s)]);
    }
    json_out(['error' => 'Not found'], 404);
}
