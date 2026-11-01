<?php
declare(strict_types=1);
/* Two-step sign-in for the admin (authenticator app codes, RFC 6238 TOTP: SHA-1, 30 s, 6 digits).
 * admin_users.totp_secret holds the base32 secret once it is turned on; totp_pending holds a secret while the user is setting it up;
 * totp_step is the last time-step used, so one code cannot be used twice. */

function twofa_db(): void {
    static $done = false; if ($done) return; $done = true;
    $pdo = adb();
    $cols = array_column($pdo->query('PRAGMA table_info(admin_users)')->fetchAll(), 'name');
    foreach (['totp_secret' => 'TEXT', 'totp_pending' => 'TEXT', 'totp_step' => 'INTEGER NOT NULL DEFAULT 0'] as $c => $t)
        if (!in_array($c, $cols, true)) $pdo->exec("ALTER TABLE admin_users ADD COLUMN $c $t");
}

function b32_encode(string $bin): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = ''; $out = '';
    foreach (str_split($bin) as $ch) $bits .= str_pad(decbin(ord($ch)), 8, '0', STR_PAD_LEFT);
    foreach (str_split($bits, 5) as $chunk) $out .= $a[bindec(str_pad($chunk, 5, '0'))];
    return $out;
}
function b32_decode(string $s): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; $bits = ''; $out = '';
    foreach (str_split(strtoupper(preg_replace('/[^A-Za-z2-7]/', '', $s))) as $ch) $bits .= str_pad(decbin(strpos($a, $ch)), 5, '0', STR_PAD_LEFT);
    foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr(bindec($byte));
    return $out;
}

function totp_at(string $secret, int $step): string {
    $h = hash_hmac('sha1', pack('N2', 0, $step), b32_decode($secret), true);
    $o = ord($h[19]) & 0x0f;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string)($n % 1000000), 6, '0', STR_PAD_LEFT);
}

/** Time-step the code matches (±1 step for clock drift) and that is newer than $after, or null. */
function totp_match(string $secret, string $code, int $after = 0): ?int {
    $code = preg_replace('/\D/', '', $code);
    if (strlen($code) !== 6) return null;
    $now = intdiv(time(), 30);
    for ($s = $now - 1; $s <= $now + 1; $s++) if ($s > $after && hash_equals(totp_at($secret, $s), $code)) return $s;
    return null;
}

/** Check a sign-in code for a user row (with totp_secret / totp_step) and burn it. */
function twofa_check(array $u, string $code): bool {
    if (empty($u['totp_secret'])) return true;
    $s = totp_match($u['totp_secret'], $code, (int)($u['totp_step'] ?? 0));
    if ($s === null) return false;
    adb()->prepare('UPDATE admin_users SET totp_step = ? WHERE id = ?')->execute([$s, $u['id']]);
    return true;
}

function twofa_route(string $r, string $method, PDO $pdo): void {
    $u = require_user();
    $q = $pdo->prepare('SELECT * FROM admin_users WHERE id = ?'); $q->execute([$u['id']]); $row = $q->fetch();
    if ($r === '/2fa' && $method === 'GET') json_out(['on' => !empty($row['totp_secret'])]);
    if ($r === '/2fa/setup' && $method === 'POST') {
        if (!empty($row['totp_secret'])) json_out(['error' => 'Two-step sign-in is already on.'], 409);
        $secret = b32_encode(random_bytes(20));
        $pdo->prepare('UPDATE admin_users SET totp_pending = ? WHERE id = ?')->execute([$secret, $u['id']]);
        $label = rawurlencode('Satin Graphic admin:' . $row['email']);
        json_out(['secret' => $secret, 'uri' => "otpauth://totp/$label?secret=$secret&issuer=" . rawurlencode('Satin Graphic admin') . '&digits=6&period=30']);
    }
    if ($r === '/2fa/enable' && $method === 'POST') {
        $v = body_json(1000);
        if (rate_limited('2fa:' . $u['id'], 10, 900)) json_out(['error' => 'Too many attempts. Try again in 15 minutes.'], 429);
        if (empty($row['totp_pending'])) json_out(['error' => 'Start the setup again.'], 400);
        $s = totp_match($row['totp_pending'], (string)($v['code'] ?? ''));
        if ($s === null) { note_attempt('2fa:' . $u['id']); json_out(['error' => 'That code is not correct. Check the time on your phone and try the newest code.'], 400); }
        $pdo->prepare('UPDATE admin_users SET totp_secret = totp_pending, totp_pending = NULL, totp_step = ? WHERE id = ?')->execute([$s, $u['id']]);
        $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ? AND token_hash != ?')->execute([$u['id'], $u['token_hash']]);
        audit($u, 'turned on two-step sign-in');
        json_out(['ok' => true]);
    }
    if ($r === '/2fa/disable' && $method === 'POST') {
        $v = body_json(1000);
        if (rate_limited('2fa:' . $u['id'], 10, 900)) json_out(['error' => 'Too many attempts. Try again in 15 minutes.'], 429);
        if (!password_verify((string)($v['password'] ?? ''), $row['pass_hash']) || !twofa_check($row, (string)($v['code'] ?? ''))) {
            note_attempt('2fa:' . $u['id']); json_out(['error' => 'Password or code is not correct.'], 400);
        }
        $pdo->prepare('UPDATE admin_users SET totp_secret = NULL, totp_pending = NULL WHERE id = ?')->execute([$u['id']]);
        audit($u, 'turned off two-step sign-in');
        json_out(['ok' => true]);
    }
    json_out(['error' => 'Not found'], 404);
}
