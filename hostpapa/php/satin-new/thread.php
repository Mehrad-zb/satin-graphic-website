<?php
declare(strict_types=1);
/*
 * Conversation on a quote / booking request, kept on the website.
 *  - Staff reply from Admin → Quotes & bookings (emailed, as before). Every reply email now carries a private link
 *    (/messages/?t=…) where the customer sees the whole conversation and can answer on the website.
 *  - If the customer simply answers the email instead, the answer is picked up from the info@ mailbox (IMAP, same
 *    account as Email delivery) and added to the same request. The poll runs at most every few minutes, triggered by
 *    the admin app (and by /api/thread/poll for an optional cPanel cron job).
 *  - New customer messages: staff email (clean table) + notification centre / push.
 */
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/admin_api.php';

function thread_db(): PDO {
    static $done = false;
    $pdo = adb();
    if ($done) return $pdo;
    $done = true;
    migrate_replies($pdo);
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $k = $my ? 'VARCHAR(64)' : 'TEXT'; $s = $my ? 'VARCHAR(255)' : 'TEXT'; $cs = $my ? ' DEFAULT CHARSET=utf8mb4' : '';
    $cols = [];
    try { $cols = $my ? array_column($pdo->query('SHOW COLUMNS FROM request_replies')->fetchAll(), 'Field') : array_column($pdo->query('PRAGMA table_info(request_replies)')->fetchAll(), 'name'); } catch (Throwable $e) { }
    foreach (['direction' => "$s NOT NULL DEFAULT 'out'", 'source' => "$s NOT NULL DEFAULT 'admin'", 'msg_id' => "$s NOT NULL DEFAULT ''"] as $c => $def)
        if (!in_array($c, $cols, true)) { try { $pdo->exec("ALTER TABLE request_replies ADD COLUMN $c $def"); } catch (Throwable $e) { error_log('satin thread migrate: ' . $e->getMessage()); } }
    $pdo->exec("CREATE TABLE IF NOT EXISTS request_threads (request_id $k PRIMARY KEY, token $k NOT NULL, created_at $s NOT NULL)$cs");
    return $pdo;
}
function thread_token(string $requestId): string {
    $pdo = thread_db();
    $q = $pdo->prepare('SELECT token FROM request_threads WHERE request_id = ?'); $q->execute([$requestId]);
    if ($r = $q->fetch()) return (string)$r['token'];
    $t = bin2hex(random_bytes(20));
    $pdo->prepare('INSERT INTO request_threads (request_id, token, created_at) VALUES (?,?,?)')->execute([$requestId, $t, now_iso()]);
    return $t;
}
function thread_url(string $requestId): string { return site_url() . '/messages/?t=' . thread_token($requestId); }
function thread_by_token(string $t): ?array {
    if (!preg_match('/^[0-9a-f]{40}$/', $t)) return null;
    $pdo = thread_db();
    $q = $pdo->prepare('SELECT r.* FROM request_threads t JOIN service_requests r ON r.id = t.request_id WHERE t.token = ?'); $q->execute([$t]);
    return $q->fetch() ?: null;
}

/** Messages as the customer sees them: their request first, then every sent staff reply and every customer message. */
function thread_messages(array $row): array {
    $d = json_decode((string)$row['details'], true) ?: [];
    $out = [['id' => 'request', 'dir' => 'in', 'who' => (string)$row['name'], 'body' => trim((string)($d['notes'] ?? '')) ?: 'Request sent from the website.', 'at' => $row['created_at'], 'files' => [], 'source' => 'site']];
    $q = thread_db()->prepare('SELECT * FROM request_replies WHERE request_id = ? ORDER BY created_at, id'); $q->execute([$row['id']]);
    foreach ($q->fetchAll() as $x) {
        $in = ($x['direction'] ?? 'out') === 'in';
        if (!$in && !(int)$x['sent']) continue;
        $out[] = ['id' => $x['id'], 'dir' => $in ? 'in' : 'out', 'who' => $in ? (string)$row['name'] : ((string)$x['user_name'] . ' · Satin Graphic'), 'body' => rtrim((string)$x['body']) . (!$in && trim((string)$x['signature']) !== '' ? "\n\n" . rtrim((string)$x['signature']) : ''),
            'at' => $x['created_at'], 'source' => $x['source'] ?? 'admin', 'files' => array_map(fn($f) => ['name' => $f['name'], 'size' => (int)$f['size']], json_decode((string)$x['attachments'], true) ?: [])];
    }
    return $out;
}

/** Adds a message from the customer (website form or email reply) and tells the staff. */
function thread_customer_message(array $row, string $body, string $source, string $msgId = ''): bool {
    $pdo = thread_db();
    $body = trim(preg_replace("/\n{3,}/", "\n\n", str_replace("\r", '', $body)));
    if ($body === '') return false;
    if ($msgId !== '') { $q = $pdo->prepare('SELECT 1 FROM request_replies WHERE msg_id = ?'); $q->execute([$msgId]); if ($q->fetch()) return false; }
    $pdo->prepare('INSERT INTO request_replies (id,request_id,user_id,user_name,to_email,subject,body,signature,attachments,sent,error,created_at,direction,source,msg_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([uuid(), $row['id'], null, (string)$row['name'], reply_inbox(), 'Customer message', mb_substr($body, 0, 20000), '', '[]', 1, '', now_iso(), 'in', $source, mb_substr($msgId, 0, 250)]);
    $ref = request_ref($row['id']); $how = $source === 'email' ? 'by email' : 'on the website';
    $url = site_url() . '/admin/#/requests?id=' . rawurlencode($row['id']);
    try { require_once __DIR__ . '/push.php'; push_event('requests', '💬 ' . $row['name'] . ' replied · ' . $ref, mb_substr($body, 0, 160), '/admin/#/requests?id=' . $row['id'], 'reqmsg-' . $ref); } catch (Throwable $e) { }
    $to = cfg('notify_email');
    if ($to) {
        $h = fn($x) => htmlspecialchars((string)$x, ENT_QUOTES, 'UTF-8');
        $html = '<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#16181d"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:12px">'
            . '<tr><td style="padding:22px 24px 6px"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#e81e4c;font-weight:bold">Customer replied ' . $h($how) . '</div><div style="font-size:20px;font-weight:bold;margin-top:4px">' . $h($row['name']) . ' · ' . $h($row['service']) . '</div><div style="color:#6b7280;font-size:13px;margin-top:2px">' . $h($ref) . ' · ' . $h($row['email']) . '</div></td></tr>'
            . '<tr><td style="padding:14px 24px"><div dir="auto" style="white-space:pre-wrap;font-size:14px;line-height:1.6;background:#f7f8fa;border:1px solid #eceef2;border-radius:8px;padding:14px">' . $h($body) . '</div></td></tr>'
            . '<tr><td style="padding:6px 24px 24px"><a href="' . $h($url) . '" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:14px">Open & reply in admin</a></td></tr></table></td></tr></table></body></html>';
        mail_out((string)$to, "Reply from {$row['name']} · $ref", "{$row['name']} replied $how on request $ref ({$row['service']}):\n\n$body\n\nOpen in admin: $url", $html, ['fromName' => 'Satin Website', 'replyTo' => (string)$row['email']]);
    }
    return true;
}

/* ---------- public page /messages/?t=… ---------- */
function thread_public_route(string $path, string $method): void {
    header('Cache-Control: private, no-store'); header('X-Robots-Tag: noindex');
    $pdo = thread_db();
    if ($path === '/api/thread' && $method === 'GET') {
        $row = thread_by_token((string)($_GET['t'] ?? ''));
        if (!$row) json_out(['error' => 'This conversation link is not valid. Please use the latest email from us or contact info@satingraphic.ca.'], 404);
        json_out(['request' => ['reference' => request_ref($row['id']), 'service' => $row['service'], 'type' => $row['type'], 'name' => $row['name'], 'createdAt' => $row['created_at'], 'status' => REQUEST_STATUSES[$row['status']] ?? $row['status']],
            'messages' => thread_messages($row)]);
    }
    if ($path === '/api/thread/file' && $method === 'GET') {
        $row = thread_by_token((string)($_GET['t'] ?? ''));
        if (!$row) json_out(['error' => 'Not found'], 404);
        $q = $pdo->prepare("SELECT attachments FROM request_replies WHERE id = ? AND request_id = ? AND sent = 1"); $q->execute([(string)($_GET['id'] ?? ''), $row['id']]);
        $x = $q->fetch(); $files = $x ? (json_decode((string)$x['attachments'], true) ?: []) : []; $f = $files[(int)($_GET['n'] ?? -1)] ?? null;
        $full = $f ? reply_storage() . '/' . ltrim((string)$f['path'], '/') : '';
        if (!$f || !is_file($full)) json_out(['error' => 'File not found'], 404);
        header('Content-Type: ' . ($f['mime'] ?: 'application/octet-stream')); header('X-Content-Type-Options: nosniff');
        header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode((string)$f['name'])); header('Content-Length: ' . filesize($full));
        readfile($full); exit;
    }
    if ($path === '/api/thread/reply' && $method === 'POST') {
        same_origin();
        $v = body_json(30000);
        $row = thread_by_token((string)($v['t'] ?? ''));
        if (!$row) json_out(['error' => 'This conversation link is not valid.'], 404);
        $body = text($v['body'] ?? '', 8000);
        if (mb_strlen(trim($body)) < 2) json_out(['error' => 'Write your message first.'], 400);
        if (rate_limited('thread:' . $row['id'], 15, 3600)) json_out(['error' => 'Too many messages in the last hour. Please call us at 905-695-9147.'], 429);
        note_attempt('thread:' . $row['id']);
        thread_customer_message($row, $body, 'site');
        json_out(['ok' => true, 'messages' => thread_messages($row)]);
    }
    if ($path === '/api/thread/poll' && in_array($method, ['GET', 'POST'], true)) { // optional cron: curl -s https://satingraphic.ca/api/thread/poll?k=…
        $key = (string)(push_setting_raw('inbound.key') ?? '');
        if ($key === '' || !hash_equals($key, (string)($_GET['k'] ?? ''))) json_out(['error' => 'Not allowed'], 403);
        json_out(thread_poll_inbox(true));
    }
    json_out(['error' => 'Not found'], 404);
}
function push_setting_raw(string $k) { $q = adb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute([$k]); $r = $q->fetch(); return $r ? json_decode((string)$r['v'], true) : null; }
function setting_put(string $k, $v): void {
    $pdo = adb(); $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO site_settings (k, v, updated_at) VALUES (?,?,?)')->execute([$k, json_encode($v, JSON_UNESCAPED_UNICODE), now_iso()]);
}

/* ---------- email replies: read the info@ mailbox over IMAP (no PHP extension needed) ---------- */
function thread_imap_account(): ?array {
    $s = mail_settings();
    $over = push_setting_raw('inbound.imap') ?: [];
    $user = (string)($over['user'] ?? '') ?: $s['user']; $pass = (string)($over['pass'] ?? '') ?: $s['pass'];
    $host = (string)($over['host'] ?? '');
    if ($host === '') $host = stripos($s['host'], 'gmail') !== false || stripos($s['host'], 'google') !== false ? 'imap.gmail.com' : (stripos($s['host'], 'office365') !== false || stripos($s['host'], 'outlook') !== false ? 'outlook.office365.com' : ($s['host'] !== '' ? preg_replace('/^smtp\./i', 'imap.', $s['host']) : ''));
    if ($host === '' || !filter_var($user, FILTER_VALIDATE_EMAIL) || $pass === '') return null;
    return ['host' => $host, 'port' => (int)($over['port'] ?? 993), 'user' => $user, 'pass' => $pass];
}
final class SatinImap {
    private $fp; private int $n = 0;
    public function __construct(string $host, int $port) {
        $this->fp = @stream_socket_client("ssl://$host:$port", $en, $es, 15, STREAM_CLIENT_CONNECT, stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]));
        if (!$this->fp) throw new RuntimeException("IMAP connect failed: $es");
        stream_set_timeout($this->fp, 20); fgets($this->fp);
    }
    public function cmd(string $c): array {
        $tag = 'S' . (++$this->n); fwrite($this->fp, "$tag $c\r\n"); $lines = [];
        while (($l = fgets($this->fp)) !== false) {
            if (preg_match('/\{(\d+)\}\r\n$/', $l, $m)) { $lit = ''; $len = (int)$m[1]; while (strlen($lit) < $len && !feof($this->fp)) { $chunk = fread($this->fp, $len - strlen($lit)); if ($chunk === false || $chunk === '') break; $lit .= $chunk; } $lines[] = $l; $lines[] = ['lit' => $lit]; continue; }
            if (str_starts_with($l, "$tag ")) { if (!preg_match("/^$tag OK/", $l)) throw new RuntimeException('IMAP: ' . trim($l)); return $lines; }
            $lines[] = $l;
        }
        throw new RuntimeException('IMAP connection closed');
    }
    public static function q(string $s): string { return '"' . addcslashes($s, "\"\\") . '"'; }
    public function close(): void { try { $this->cmd('LOGOUT'); } catch (Throwable $e) { } @fclose($this->fp); }
}
function thread_mime_decode(string $raw): array {
    [$head, $body] = array_pad(preg_split("/\r?\n\r?\n/", $raw, 2), 2, '');
    $head = preg_replace("/\r?\n[ \t]+/", ' ', $head);
    $h = []; foreach (preg_split("/\r?\n/", $head) as $l) if (preg_match('/^([\w-]+):\s*(.*)$/', $l, $m)) $h[strtolower($m[1])] ??= $m[2];
    return [$h, $body];
}
function thread_hdr(string $s): string { return function_exists('iconv_mime_decode') ? (string)@iconv_mime_decode($s, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8') : $s; }
/** First text/plain part (or text/html turned to text), decoded to UTF-8. */
function thread_mime_text(array $h, string $body, int $depth = 0): string {
    $ct = strtolower($h['content-type'] ?? 'text/plain');
    if ($depth < 6 && str_starts_with($ct, 'multipart/') && preg_match('/boundary="?([^";]+)"?/i', $h['content-type'], $m)) {
        $parts = explode('--' . $m[1], $body); $html = '';
        foreach ($parts as $p) {
            $p = ltrim($p, "\r\n"); if ($p === '' || str_starts_with($p, '--')) continue;
            [$ph, $pb] = thread_mime_decode($p);
            $pct = strtolower($ph['content-type'] ?? 'text/plain');
            if (str_contains(strtolower($ph['content-disposition'] ?? ''), 'attachment')) continue;
            if (str_starts_with($pct, 'multipart/')) { $t = thread_mime_text($ph, $pb, $depth + 1); if ($t !== '') return $t; }
            elseif (str_starts_with($pct, 'text/plain')) return thread_part($ph, $pb);
            elseif (str_starts_with($pct, 'text/html') && $html === '') $html = thread_part($ph, $pb);
        }
        return $html !== '' ? trim(html_entity_decode(strip_tags(preg_replace(['#<br\s*/?>#i', '#</(p|div|tr|li|blockquote)>#i'], "\n", $html)), ENT_QUOTES, 'UTF-8')) : '';
    }
    $t = thread_part($h, $body);
    return str_starts_with($ct, 'text/html') ? trim(html_entity_decode(strip_tags(preg_replace(['#<br\s*/?>#i', '#</(p|div|tr|li|blockquote)>#i'], "\n", $t)), ENT_QUOTES, 'UTF-8')) : $t;
}
function thread_part(array $h, string $b): string {
    $enc = strtolower(trim($h['content-transfer-encoding'] ?? ''));
    if ($enc === 'base64') $b = (string)base64_decode(preg_replace('/\s+/', '', $b));
    elseif ($enc === 'quoted-printable') $b = quoted_printable_decode($b);
    $cs = preg_match('/charset="?([\w-]+)"?/i', $h['content-type'] ?? '', $m) ? strtoupper($m[1]) : 'UTF-8';
    if ($cs !== 'UTF-8' && $cs !== 'US-ASCII') { $c = @mb_convert_encoding($b, 'UTF-8', $cs); if ($c !== false) $b = $c; }
    return str_replace("\r", '', $b);
}
/** Keeps only what the customer wrote above the quoted email. */
function thread_strip_quote(string $t): string {
    $lines = explode("\n", str_replace("\r", '', $t)); $out = [];
    foreach ($lines as $i => $l) {
        $s = trim($l);
        if (preg_match('/^(On .{4,200}wrote:|Le .{4,200}a écrit|El .{4,200}escribió:|-----\s*Original Message|From:\s.+@|Sent from my |Get Outlook for|در تاریخ .*نوشت)/u', $s)) break;
        if (preg_match('/^On .{4,120}$/', $s) && isset($lines[$i + 1]) && preg_match('/wrote:\s*$/', trim($lines[$i + 1]))) break;
        if (str_starts_with($s, '>')) continue;
        $out[] = rtrim($l);
    }
    return trim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $out)));
}
/** Reads new messages that mention a request reference (SG-XXXXXXXX) and adds the customer's answer to that request. */
function thread_poll_inbox(bool $force = false): array {
    $state = push_setting_raw('inbound.state') ?: [];
    if (!$force && time() - (int)($state['at'] ?? 0) < 240) return ['skipped' => true];
    $state['at'] = time(); setting_put('inbound.state', $state);
    $acc = thread_imap_account();
    if (!$acc) return ['ok' => false, 'error' => 'No mailbox set up (Admin → Notification settings → Email delivery).'];
    $added = 0; $seen = 0;
    try {
        $im = new SatinImap($acc['host'], $acc['port']);
        $im->cmd('LOGIN ' . SatinImap::q($acc['user']) . ' ' . SatinImap::q($acc['pass']));
        $sel = $im->cmd('SELECT INBOX'); $uv = '';
        foreach ($sel as $l) if (is_string($l) && preg_match('/UIDVALIDITY (\d+)/', $l, $m)) $uv = $m[1];
        if (($state['uv'] ?? '') !== $uv) { $state['uv'] = $uv; $state['last'] = 0; }
        $since = date('d-M-Y', time() - 14 * 86400);
        $uids = [];
        foreach ($im->cmd('UID SEARCH SINCE ' . $since . ' SUBJECT "SG-"') as $l) if (is_string($l) && str_starts_with($l, '* SEARCH')) $uids = array_map('intval', preg_split('/\s+/', trim(substr($l, 8)), -1, PREG_SPLIT_NO_EMPTY));
        $uids = array_values(array_filter($uids, fn($u) => $u > (int)($state['last'] ?? 0)));
        sort($uids);
        foreach (array_slice($uids, 0, 30) as $uid) {
            $res = $im->cmd("UID FETCH $uid (BODY.PEEK[])"); $raw = '';
            foreach ($res as $l) if (is_array($l)) $raw = $l['lit'];
            $state['last'] = $uid; $seen++;
            if ($raw === '' || strlen($raw) > 8000000) continue;
            [$h, $body] = thread_mime_decode($raw);
            $subj = thread_hdr($h['subject'] ?? '');
            if (!preg_match('/\bSG-([0-9A-F]{8})\b/i', $subj, $m)) continue;
            if (isset($h['x-satin-request'])) continue; // our own outgoing copy
            $from = strtolower(preg_match('/<([^>]+)>/', $h['from'] ?? '', $fm) ? $fm[1] : trim($h['from'] ?? ''));
            $q = thread_db()->prepare('SELECT * FROM service_requests WHERE lower(id) LIKE ? ORDER BY created_at DESC'); $q->execute([strtolower($m[1]) . '%']);
            foreach ($q->fetchAll() as $row) {
                if (strtolower(trim((string)$row['email'])) !== $from) continue; // only the customer who sent the request
                $text = thread_strip_quote(thread_mime_text($h, $body));
                if ($text !== '' && thread_customer_message($row, $text, 'email', trim($h['message-id'] ?? ('uid-' . $uv . '-' . $uid)))) $added++;
                break;
            }
        }
        $im->close();
        $state['ok'] = time(); unset($state['err']);
    } catch (Throwable $e) { $state['err'] = mb_substr($e->getMessage(), 0, 200); error_log('satin inbound: ' . $e->getMessage()); }
    setting_put('inbound.state', $state);
    return ['ok' => empty($state['err']), 'checked' => $seen, 'added' => $added, 'error' => $state['err'] ?? null];
}
/** Called from the admin app's regular poll (/api/admin/badges): runs after the response is sent, at most every 4 minutes. */
function thread_poll_later(): void {
    $state = push_setting_raw('inbound.state') ?: [];
    if (time() - (int)($state['at'] ?? 0) < 240) return;
    register_shutdown_function(function () {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request(); elseif (function_exists('litespeed_finish_request')) @litespeed_finish_request();
        try { thread_poll_inbox(); } catch (Throwable $e) { error_log('satin inbound: ' . $e->getMessage()); }
    });
}
