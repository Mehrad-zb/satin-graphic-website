<?php
declare(strict_types=1);
// Staff notifications: admin nav badges ("what's new since I last looked") and Web Push to staff devices.
//  * Badges: GET /api/admin/badges counts new items per section since the signed-in staff member last opened it
//    (per-user "last seen" timestamps in admin_seen). Live chat uses the conversation unread state instead.
//  * Web Push (RFC 8030 + VAPID RFC 8292 + message encryption RFC 8291, aes128gcm) implemented with openssl only.
//    The VAPID key pair is generated on first use and stored in site_settings ('push.vapid'), never in code.
//  * Events (new chat message, new online order / payment, new quote or booking request) are queued with push_event()
//    and sent after the response is flushed, so visitors never wait for push services.
// Routed from admin_api.php (/api/admin/badges*, /api/admin/push/*).
require_once __DIR__ . '/auth.php';

const PUSH_EVENTS = ['chat' => 'chat.view', 'orders' => 'orders.view', 'requests' => 'requests.view', 'invoices' => 'invoices.view', 'quotes' => 'requests.view', 'visits' => 'dashboard.view', 'agreements' => 'agreements.view'];
const BADGE_SECTIONS = ['orders' => 'orders.view', 'requests' => 'requests.view', 'chat' => 'chat.view', 'invoices' => 'invoices.view', 'customers' => 'invoices.view', 'catalog' => 'pricing.edit'];

function push_db(): PDO {
    static $done = false;
    $pdo = adb();
    if ($done) return $pdo;
    $done = true;
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $k = $my ? 'VARCHAR(64)' : 'TEXT'; $s = $my ? 'VARCHAR(255)' : 'TEXT'; $t = $my ? 'TEXT' : 'TEXT';
    $cs = $my ? ' DEFAULT CHARSET=utf8mb4' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_seen (user_id $k NOT NULL, section $k NOT NULL, seen_at $s NOT NULL, PRIMARY KEY (user_id, section))$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS push_subscriptions (id $k PRIMARY KEY, user_id $k NOT NULL, endpoint_hash $k NOT NULL, endpoint $t NOT NULL, p256dh $s NOT NULL, auth $s NOT NULL,
        prefs $t NOT NULL, agent $s NOT NULL, created_at $s NOT NULL, last_ok_at $s NOT NULL, fails INTEGER NOT NULL)$cs");
    if (!$my) $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_ep ON push_subscriptions (endpoint_hash)');
    else { try { $pdo->exec('CREATE UNIQUE INDEX idx_push_ep ON push_subscriptions (endpoint_hash)'); } catch (Throwable $e) { } }
    return $pdo;
}
function push_setting(string $k) { $q = adb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute([$k]); $r = $q->fetch(); return $r ? json_decode($r['v'], true) : null; }
function push_setting_put(string $k, $v): void {
    $pdo = adb(); $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute([$k]);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute([$k, json_encode($v, JSON_UNESCAPED_SLASHES), now_iso()]);
    $pdo->commit();
}

/* ======================= badges ======================= */
function badge_seen_map(string $uid): array {
    $q = push_db()->prepare('SELECT section, seen_at FROM admin_seen WHERE user_id = ?'); $q->execute([$uid]);
    return array_column($q->fetchAll(), 'seen_at', 'section');
}
function badge_mark_seen(string $uid, string $section): void {
    $pdo = push_db();
    $pdo->prepare('DELETE FROM admin_seen WHERE user_id = ? AND section = ?')->execute([$uid, $section]);
    $pdo->prepare('INSERT INTO admin_seen (user_id,section,seen_at) VALUES (?,?,?)')->execute([$uid, $section, now_iso()]);
}
/** Counts per section for this staff member (only sections their role can open). First visit = nothing is "new". */
function badge_counts(array $u): array {
    $pdo = push_db(); $seen = badge_seen_map($u['id']); $out = [];
    $n = function (string $sql, array $p) use ($pdo): int { try { $q = $pdo->prepare($sql); $q->execute($p); return (int)($q->fetch()['n'] ?? 0); } catch (Throwable $e) { return 0; } };
    foreach (BADGE_SECTIONS as $sec => $perm) {
        if (!in_array($perm, $u['permissions'], true)) continue;
        if ($sec === 'chat') { $out['chat'] = $n("SELECT COUNT(*) n FROM chat_conversations WHERE status = 'open' AND unread_staff > 0", []); continue; }
        if (!isset($seen[$sec])) { badge_mark_seen($u['id'], $sec); $out[$sec] = 0; continue; }
        $t = $seen[$sec];
        $sql = [
            'orders' => ["SELECT COUNT(*) n FROM shop_orders WHERE created_at > ? OR (paid_at != '' AND paid_at > ?)", [$t, $t]],
            'requests' => ['SELECT COUNT(*) n FROM service_requests WHERE created_at > ?', [$t]],
            'invoices' => ["SELECT COUNT(*) n FROM inv_payments WHERE created_at > ? AND COALESCE(created_by, '') != ?", [$t, $u['name']]],
            'customers' => ['SELECT COUNT(*) n FROM customer_accounts WHERE created_at > ?', [$t]],
            'catalog' => ['SELECT COUNT(*) n FROM product_reviews WHERE created_at > ?', [$t]],
        ][$sec] ?? null;
        $out[$sec] = $sql ? $n($sql[0], $sql[1]) : 0;
    }
    return $out;
}

/* ======================= base64url / keys ======================= */
function b64u(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }
function b64u_dec(string $s): string { $r = base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4), true); return $r === false ? '' : $r; }
const P256_SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';
/** PEM public key from an uncompressed P-256 point (65 bytes, 0x04 || X || Y). */
function p256_public_pem(string $raw): string {
    if (strlen($raw) !== 65 || $raw[0] !== "\x04") throw new RuntimeException('Bad P-256 public key');
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(hex2bin(P256_SPKI_PREFIX) . $raw), 64, "\n") . "-----END PUBLIC KEY-----\n";
}
/** PEM private key (SEC1) from the raw 32-byte scalar and its public point — used by tests with fixed keys. */
function p256_private_pem(string $d, string $pub): string {
    $der = hex2bin('30770201010420') . $d . hex2bin('a00a06082a8648ce3d030107a144034200') . $pub;
    return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
}
/** [privateKey resource, raw 65-byte public point] */
function p256_generate(): array {
    $k = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$k) throw new RuntimeException('openssl could not create an EC key');
    return [$k, p256_raw_public($k)];
}
function p256_raw_public($key): string {
    $d = openssl_pkey_get_details($key)['ec'] ?? null;
    if (!$d) throw new RuntimeException('Not an EC key');
    return "\x04" . str_pad($d['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['y'], 32, "\0", STR_PAD_LEFT);
}
/** The site's VAPID key pair, created once and stored in the database. */
function push_vapid(): array {
    $v = push_setting('push.vapid');
    if (is_array($v) && !empty($v['privatePem']) && !empty($v['publicKey'])) return $v;
    [$k, $pub] = p256_generate();
    openssl_pkey_export($k, $pem);
    $v = ['privatePem' => $pem, 'publicKey' => b64u($pub), 'createdAt' => now_iso()];
    push_setting_put('push.vapid', $v);
    return $v;
}
/** DER ECDSA signature → raw 64-byte r||s (JWS ES256). */
function ecdsa_der_to_raw(string $der): string {
    $o = 2; if ((ord($der[1]) & 0x80) !== 0) $o += ord($der[1]) & 0x7f;
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        if (ord($der[$o]) !== 0x02) throw new RuntimeException('Bad DER signature');
        $len = ord($der[$o + 1]); $int = substr($der, $o + 2, $len); $o += 2 + $len;
        $int = ltrim($int, "\0"); $out .= str_pad($int, 32, "\0", STR_PAD_LEFT);
    }
    return $out;
}
function vapid_jwt(string $audience, array $vapid, int $ttl = 43200): string {
    $sub = (string)(cfg('push_subject') ?: ('mailto:' . (cfg('notify_email') ?: 'info@satingraphic.ca')));
    $h = b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $c = b64u(json_encode(['aud' => $audience, 'exp' => time() + $ttl, 'sub' => $sub], JSON_UNESCAPED_SLASHES));
    if (!openssl_sign("$h.$c", $sig, openssl_pkey_get_private($vapid['privatePem']), OPENSSL_ALGO_SHA256)) throw new RuntimeException('VAPID signing failed');
    return "$h.$c." . b64u(ecdsa_der_to_raw($sig));
}

/* ======================= RFC 8291 encryption ======================= */
/**
 * Encrypts one push message (aes128gcm, single record). $uaPublic = subscription p256dh (65 bytes), $auth = 16 bytes.
 * $asKey / $salt are only passed by tests (RFC 8291 Appendix A vectors); normally fresh random values are used.
 */
function webpush_encrypt(string $plaintext, string $uaPublic, string $auth, $asKey = null, ?string $salt = null, int $pad = 0): string {
    if (strlen($auth) !== 16) throw new RuntimeException('Bad auth secret');
    if ($asKey === null) [$asKey, $asPublic] = p256_generate(); else $asPublic = p256_raw_public($asKey);
    $salt = $salt ?? random_bytes(16);
    $ecdh = openssl_pkey_derive(openssl_pkey_get_public(p256_public_pem($uaPublic)), $asKey, 32);
    if ($ecdh === false || strlen($ecdh) !== 32) throw new RuntimeException('ECDH failed');
    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $asPublic, $auth);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $ct = openssl_encrypt($plaintext . "\x02" . str_repeat("\0", $pad), 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($ct === false) throw new RuntimeException('AES-GCM failed');
    return $salt . pack('N', 4096) . chr(65) . $asPublic . $ct . $tag;
}
/** Decrypts an aes128gcm body with the user agent's private key (tests only). */
function webpush_decrypt(string $body, $uaKey, string $auth): string {
    $salt = substr($body, 0, 16); $idlen = ord($body[20]); $asPublic = substr($body, 21, $idlen); $rest = substr($body, 21 + $idlen);
    $uaPublic = p256_raw_public($uaKey);
    $ecdh = openssl_pkey_derive(openssl_pkey_get_public(p256_public_pem($asPublic)), $uaKey, 32);
    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $asPublic, $auth);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $pt = openssl_decrypt(substr($rest, 0, -16), 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, substr($rest, -16));
    if ($pt === false) throw new RuntimeException('Decryption failed');
    return substr(rtrim($pt, "\0"), 0, -1);
}

/* ======================= subscriptions & sending ======================= */
function push_endpoint_ok(string $ep): bool {
    $extra = cfg('push_hosts', []); $extra = is_array($extra) ? $extra : []; // e.g. a local test push service (config.php only)
    $host = strtolower((string)parse_url($ep, PHP_URL_HOST));
    if (preg_match('#^http://[a-z0-9.-]+(:\d+)?/#i', $ep) && in_array($host, $extra, true)) return strlen($ep) <= 1500;
    if (!preg_match('#^https://[a-z0-9.-]+(:\d+)?/#i', $ep) || strlen($ep) > 1500) return false;
    // Browser push services only (Chrome/Edge/Opera via FCM, Firefox, Safari/Apple, Windows) — never an arbitrary URL (no SSRF).
    foreach (['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com', '.notify.windows.com', '.push.apple.com'] as $ok)
        if ($host === ltrim($ok, '.') || (str_starts_with($ok, '.') && str_ends_with($host, $ok))) return true;
    return in_array($host, $extra, true);
}
function push_prefs_clean($p): array {
    $p = is_array($p) ? $p : [];
    $o = []; foreach (array_keys(PUSH_EVENTS) as $k) $o[$k] = ($p[$k] ?? true) !== false;
    return $o;
}
function push_sub_row(array $r): array {
    return ['id' => $r['id'], 'endpointHash' => $r['endpoint_hash'], 'prefs' => push_prefs_clean(json_decode((string)$r['prefs'], true)), 'agent' => $r['agent'], 'createdAt' => $r['created_at'], 'lastOkAt' => $r['last_ok_at'] ?: null, 'fails' => (int)$r['fails']];
}

/** Queues a notification for staff who can see $type and opted in on a device. Sent after the response. */
function push_event(string $type, string $title, string $body, string $url, string $tag = ''): void {
    if (!isset(PUSH_EVENTS[$type])) return;
    $GLOBALS['push_queue'][] = compact('type', 'title', 'body', 'url', 'tag');
    static $registered = false;
    if ($registered) return; $registered = true;
    register_shutdown_function(function () {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        elseif (function_exists('litespeed_finish_request')) @litespeed_finish_request();
        try { push_flush(); } catch (Throwable $e) { error_log('satin push: ' . $e->getMessage()); }
    });
}
function push_flush(): void {
    $queue = $GLOBALS['push_queue'] ?? []; $GLOBALS['push_queue'] = [];
    if (!$queue) return;
    $pdo = push_db();
    $subs = $pdo->query("SELECT s.*, u.role FROM push_subscriptions s JOIN admin_users u ON u.id = s.user_id WHERE u.status = 'active' AND s.fails < 20")->fetchAll();
    if (!$subs) return;
    $jobs = [];
    foreach ($queue as $m) foreach ($subs as $s) {
        $prefs = push_prefs_clean(json_decode((string)$s['prefs'], true));
        if (empty($prefs[$m['type']]) || !in_array(PUSH_EVENTS[$m['type']], role_permissions($s['role']), true)) continue;
        $jobs[] = [$s, ['title' => mb_substr($m['title'], 0, 120), 'body' => mb_substr($m['body'], 0, 240), 'url' => $m['url'], 'tag' => $m['tag'] ?: $m['type'], 'type' => $m['type'], 'ts' => time()]];
    }
    if ($jobs) push_send_many($jobs);
}
/** Sends [[subscriptionRow, payloadArray], …] in parallel. Returns [[subId, httpCode], …]. */
function push_send_many(array $jobs): array {
    $vapid = push_vapid(); $mh = curl_multi_init(); $handles = []; $out = [];
    foreach (array_slice($jobs, 0, 100) as $i => [$s, $payload]) {
        try {
            $ep = (string)$s['endpoint'];
            if (!push_endpoint_ok($ep)) continue;
            $u = parse_url($ep); $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
            $body = webpush_encrypt(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), b64u_dec((string)$s['p256dh']), b64u_dec((string)$s['auth']));
            $topic = substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string)($payload['tag'] ?? '')), 0, 32);
            $ch = curl_init($ep);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'TTL: 86400', 'Urgency: high',
                    'Authorization: vapid t=' . vapid_jwt($aud, $vapid) . ', k=' . $vapid['publicKey']], $topic !== '' ? ['Topic: ' . $topic] : [])]);
            curl_multi_add_handle($mh, $ch); $handles[$i] = [$ch, $s['id']];
        } catch (Throwable $e) { error_log('satin push encrypt: ' . $e->getMessage()); }
    }
    if (!$handles) { curl_multi_close($mh); return []; }
    do { $st = curl_multi_exec($mh, $running); if ($running) curl_multi_select($mh, 1.0); } while ($running && $st === CURLM_OK);
    $pdo = push_db();
    foreach ($handles as [$ch, $sid]) {
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $out[] = [$sid, $code];
        if ($code >= 200 && $code < 300) $pdo->prepare('UPDATE push_subscriptions SET last_ok_at = ?, fails = 0 WHERE id = ?')->execute([now_iso(), $sid]);
        elseif ($code === 404 || $code === 410) $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$sid]); // expired / unsubscribed
        else $pdo->prepare('UPDATE push_subscriptions SET fails = fails + 1 WHERE id = ?')->execute([$sid]);
        curl_multi_remove_handle($mh, $ch); curl_close($ch);
    }
    curl_multi_close($mh);
    return $out;
}

/* ======================= admin routes ======================= */
function push_admin_route(string $r, string $method): void {
    $pdo = push_db();
    if ($r === '/badges' && $method === 'GET') {
        $u = require_user();
        $b = badge_counts($u);
        json_out(['badges' => $b, 'total' => array_sum($b)]);
    }
    if ($r === '/badges/seen' && $method === 'POST') {
        $u = require_user();
        $v = body_json(1000); $sec = (string)($v['section'] ?? '');
        if (!isset(BADGE_SECTIONS[$sec]) || $sec === 'chat') json_out(['error' => 'Unknown section'], 400);
        if (!in_array(BADGE_SECTIONS[$sec], $u['permissions'], true)) json_out(['error' => 'You do not have permission for this.'], 403);
        badge_mark_seen($u['id'], $sec);
        $b = badge_counts($u);
        json_out(['ok' => true, 'badges' => $b, 'total' => array_sum($b)]);
    }
    if ($r === '/push/mail' && $method === 'GET') { // Email delivery settings (password never sent back)
        require_user('settings.edit'); $s = mail_settings();
        json_out(['host' => $s['host'], 'port' => $s['port'], 'user' => $s['user'], 'hasPass' => $s['pass'] !== '', 'from' => $s['from'], 'fromName' => $s['fromName'], 'replyTo' => $s['replyTo']]);
    }
    if ($r === '/push/mail' && $method === 'POST') {
        $u = require_user('settings.edit'); $v = body_json(4000); $cur = mail_settings();
        $clean = fn($k, $n) => mb_substr(trim(str_replace(["\r", "\n"], '', (string)($v[$k] ?? ''))), 0, $n);
        $out = ['host' => $clean('host', 120), 'port' => in_array((int)($v['port'] ?? 587), [25, 465, 587, 2525], true) ? (int)$v['port'] : 587, 'user' => $clean('user', 160),
            'pass' => array_key_exists('pass', $v) && (string)$v['pass'] !== '' ? (string)$v['pass'] : (($v['clearPass'] ?? false) === true ? '' : $cur['pass']),
            'from' => $clean('from', 160), 'fromName' => $clean('fromName', 80) ?: 'Satin Graphic', 'replyTo' => $clean('replyTo', 160)];
        foreach (['user', 'from', 'replyTo'] as $k) if ($out[$k] !== '' && !filter_var($out[$k], FILTER_VALIDATE_EMAIL)) json_out(['error' => "Check the $k email address."], 400);
        if ($out['host'] !== '' && !preg_match('/^[a-z0-9.-]+$/i', $out['host'])) json_out(['error' => 'Check the SMTP server name.'], 400);
        db()->prepare('DELETE FROM site_settings WHERE k = ?')->execute(['mail_delivery']);
        db()->prepare('INSERT INTO site_settings (k, v, updated_at) VALUES (?, ?, ?)')->execute(['mail_delivery', json_encode($out), now_iso()]);
        audit($u, 'email delivery settings', $out['host'] !== '' ? 'SMTP ' . $out['host'] . ' as ' . $out['user'] : 'PHP mail()');
        json_out(['ok' => true]);
    }
    if ($r === '/push/mail/test' && $method === 'POST') {
        $u = require_user('settings.edit'); $v = body_json(1000); $to = (string)($v['to'] ?? $u['email']);
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Enter an email address.'], 400);
        if (rate_limited('mailtest:' . $u['id'], 10, 3600)) json_out(['error' => 'Too many tests. Try again later.'], 429);
        note_attempt('mailtest:' . $u['id']);
        $s = mail_settings(); $err = '';
        if ($s['host'] !== '' && $s['pass'] !== '') {
            try { smtp_send($s, filter_var($s['user'], FILTER_VALIDATE_EMAIL) ? $s['user'] : $s['from'], $to, ['To: ' . $to, 'Subject: Satin Graphic email test', 'Date: ' . date('r'), 'From: ' . mail_hdr($s['fromName']) . ' <' . $s['user'] . '>', 'Message-ID: <' . bin2hex(random_bytes(12)) . '@satingraphic.ca>', 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8'], "This is a test from the Satin Graphic website (SMTP " . $s['host'] . ").\nIf you can read this in your inbox, invoices and order emails are delivered the same way.\n");
                json_out(['ok' => true, 'via' => 'SMTP ' . $s['host']]); }
            catch (Throwable $e) { $err = $e->getMessage(); }
        }
        $ok = mail_out($to, 'Satin Graphic email test', "This is a test from the Satin Graphic website.\nIf you can read this in your inbox, invoices and order emails are delivered the same way.");
        json_out(['ok' => $ok, 'via' => 'PHP mail()', 'smtpError' => $err]);
    }
    if ($r === '/push/key' && $method === 'GET') {
        $u = require_user();
        $q = $pdo->prepare('SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC'); $q->execute([$u['id']]);
        $events = []; foreach (PUSH_EVENTS as $e => $perm) if (in_array($perm, $u['permissions'], true)) $events[] = $e;
        json_out(['publicKey' => push_vapid()['publicKey'], 'devices' => array_map('push_sub_row', $q->fetchAll()), 'events' => $events]);
    }
    if ($r === '/push/subscribe' && $method === 'POST') {
        $u = require_user();
        $v = body_json(6000); $sub = is_array($v['subscription'] ?? null) ? $v['subscription'] : [];
        $ep = (string)($sub['endpoint'] ?? ''); $p = (string)($sub['keys']['p256dh'] ?? ''); $a = (string)($sub['keys']['auth'] ?? '');
        if (!push_endpoint_ok($ep)) json_out(['error' => 'This browser’s push service is not supported.'], 400);
        if (strlen(b64u_dec($p)) !== 65 || strlen(b64u_dec($a)) !== 16) json_out(['error' => 'Invalid push subscription.'], 400);
        if (rate_limited('pushsub:' . $u['id'], 30, 3600)) json_out(['error' => 'Too many changes. Try again later.'], 429);
        note_attempt('pushsub:' . $u['id']);
        $h = hash('sha256', $ep);
        $old = $pdo->prepare('SELECT prefs FROM push_subscriptions WHERE endpoint_hash = ?'); $old->execute([$h]); $old = $old->fetch();
        $prefs = json_encode(push_prefs_clean(is_array($v['prefs'] ?? null) ? $v['prefs'] : ($old ? json_decode((string)$old['prefs'], true) : null)));
        $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash = ?')->execute([$h]);
        $id = uuid();
        $pdo->prepare('INSERT INTO push_subscriptions (id,user_id,endpoint_hash,endpoint,p256dh,auth,prefs,agent,created_at,last_ok_at,fails) VALUES (?,?,?,?,?,?,?,?,?,?,0)')
            ->execute([$id, $u['id'], $h, $ep, $p, $a, $prefs, mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200), now_iso(), '']);
        audit($u, 'push notifications on', mb_substr((string)parse_url($ep, PHP_URL_HOST), 0, 80));
        json_out(['ok' => true, 'id' => $id]);
    }
    if ($r === '/push/prefs' && $method === 'POST') {
        $u = require_user();
        $v = body_json(4000);
        $q = $pdo->prepare('UPDATE push_subscriptions SET prefs = ? WHERE endpoint_hash = ? AND user_id = ?');
        $q->execute([json_encode(push_prefs_clean($v['prefs'] ?? null)), hash('sha256', (string)($v['endpoint'] ?? '')), $u['id']]);
        if (!$q->rowCount()) json_out(['error' => 'This device is not subscribed. Turn notifications on first.'], 404);
        json_out(['ok' => true]);
    }
    if ($r === '/push/unsubscribe' && $method === 'POST') {
        $u = require_user();
        $v = body_json(4000);
        if (!empty($v['id'])) $pdo->prepare('DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?')->execute([(string)$v['id'], $u['id']]);
        else $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND user_id = ?')->execute([hash('sha256', (string)($v['endpoint'] ?? '')), $u['id']]);
        json_out(['ok' => true]);
    }
    if ($r === '/push/test' && $method === 'POST') {
        $u = require_user();
        if (rate_limited('pushtest:' . $u['id'], 10, 600)) json_out(['error' => 'Too many tests. Wait a few minutes.'], 429);
        note_attempt('pushtest:' . $u['id']);
        $q = $pdo->prepare('SELECT * FROM push_subscriptions WHERE user_id = ?'); $q->execute([$u['id']]);
        $jobs = array_map(fn($s) => [$s, ['title' => 'Satin admin', 'body' => 'Test notification — push works on this device.', 'url' => '/admin/chat-app/', 'tag' => 'test', 'type' => 'test', 'ts' => time()]], $q->fetchAll());
        if (!$jobs) json_out(['error' => 'No device is subscribed yet.'], 400);
        $res = push_send_many($jobs);
        $ok = count(array_filter($res, fn($x) => $x[1] >= 200 && $x[1] < 300));
        json_out(['ok' => $ok > 0, 'sent' => $ok, 'total' => count($jobs), 'codes' => array_column($res, 1)]);
    }
    json_out(['error' => 'Not found'], 404);
}
