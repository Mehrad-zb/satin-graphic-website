<?php
declare(strict_types=1);
// Customer (shop) accounts for the public website: email + password, Google and Facebook sign-in,
// and the "My account" API (orders, invoices, quotes, profile).
// Deliberately separate from staff accounts (auth.php): own tables, own cookie, own CSRF token.
// OAuth client IDs / secrets live only in site_settings ('customer.login'), written by Admin → Customer login.
require_once __DIR__ . '/auth.php';

const CUST_COOKIE = 'satin_customer';      // HttpOnly session token
const CUST_HINT = 'satin_acct';            // not secret: "1" while signed in, so pages can show "My account" without an API call
const CUST_OAUTH_COOKIE = 'satin_oauth';   // HttpOnly OAuth state, 10 minutes
const CUST_SIGNUP_COOKIE = 'satin_signup'; // HttpOnly: lets the browser that signed up confirm with one click
const CUST_SESSION_DAYS = 30;
const CUST_VERIFY_HOURS = 48;
const CUST_RESET_HOURS = 1;
const CUST_PROVINCES = ['ON', 'QC', 'BC', 'AB', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'PE', 'SK', 'YT'];
const CUST_FB_VERSION = 'v19.0';

final class CustError extends Exception {}

/* ---------------- database ---------------- */
function cust_db(): PDO {
    static $done = false;
    $pdo = adb();
    if ($done) return $pdo;
    $done = true;
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $k = $my ? 'VARCHAR(64)' : 'TEXT'; $e = $my ? 'VARCHAR(190)' : 'TEXT'; $s = $my ? 'VARCHAR(255)' : 'TEXT'; $t = $my ? 'MEDIUMTEXT' : 'TEXT';
    $cs = $my ? ' DEFAULT CHARSET=utf8mb4' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS customer_accounts (id $k PRIMARY KEY, email $e NOT NULL UNIQUE, name $s NOT NULL, phone $s NOT NULL DEFAULT '', company $s NOT NULL DEFAULT '',
        address $t, pass_hash $s NOT NULL DEFAULT '', email_verified INTEGER NOT NULL DEFAULT 0, google_sub $e, facebook_id $e, status $s NOT NULL DEFAULT 'active',
        created_at $s NOT NULL, updated_at $s NOT NULL, last_login $s, last_method $s)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS customer_sessions (token_hash $k PRIMARY KEY, customer_id $k NOT NULL, csrf $s NOT NULL, created_at $s NOT NULL, expires_at INTEGER NOT NULL, ip $s, agent $s)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS customer_tokens (token_hash $k PRIMARY KEY, customer_id $k NOT NULL, purpose $s NOT NULL, created_at $s NOT NULL, expires_at INTEGER NOT NULL, used_at $s, bind_hash $s NOT NULL DEFAULT '')$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS customer_oauth (state_hash $k PRIMARY KEY, provider $s NOT NULL, verifier $s NOT NULL, nonce $s NOT NULL, return_to $s NOT NULL, created_at INTEGER NOT NULL)$cs");
    try { $pdo->exec("CREATE INDEX idx_cust_google ON customer_accounts (google_sub)"); } catch (Throwable $x) { }
    try { $pdo->exec("CREATE INDEX idx_cust_facebook ON customer_accounts (facebook_id)"); } catch (Throwable $x) { }
    try { $pdo->exec("CREATE INDEX idx_cust_sess ON customer_sessions (customer_id)"); } catch (Throwable $x) { }
    // Orders placed while signed in remember the account (see cust_attach_order, called from commerce.php).
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN customer_id $k NOT NULL DEFAULT ''"); } catch (Throwable $x) { }
    // 1 = the customer removed this unpaid (cancelled) order from My account. The order itself is never erased: admin keeps it.
    try { $pdo->exec("ALTER TABLE shop_orders ADD COLUMN customer_hidden INTEGER NOT NULL DEFAULT 0"); } catch (Throwable $x) { }
    // Cart shared across the customer's devices (GET/PUT /api/customer/cart): the cart items as the browser keeps them, plus the artwork
    // file / design ids verified as belonging to one of the customer's own browser sessions. Copies of that artwork made for another
    // browser session are remembered so they are made once per session.
    $pdo->exec("CREATE TABLE IF NOT EXISTS customer_carts (customer_id $k PRIMARY KEY, data $t NOT NULL, revision INTEGER NOT NULL, updated_at $s NOT NULL)$cs");
    $pdo->exec("CREATE TABLE IF NOT EXISTS customer_cart_copies (customer_id $k NOT NULL, kind VARCHAR(16) NOT NULL, src_id $k NOT NULL, session_id $k NOT NULL, dst_id $k NOT NULL, created_at $s NOT NULL, PRIMARY KEY (customer_id, kind, src_id, session_id))$cs");
    try { $pdo->exec("CREATE INDEX idx_cart_copy_dst ON customer_cart_copies (customer_id, dst_id)"); } catch (Throwable $x) { }
    return $pdo;
}

/* ---------------- small helpers ---------------- */
function cust_secure(): bool { return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'; }
function cust_cookie(string $name, string $value, int $expires, bool $httpOnly = true, string $path = '/'): void {
    setcookie($name, $value, ['expires' => $expires, 'path' => $path, 'secure' => cust_secure(), 'httponly' => $httpOnly, 'samesite' => 'Lax']);
}
/** Absolute site URL used for e-mail links and OAuth redirect URIs (always https in production). */
function cust_base(): string {
    if (cfg('oauth_test_base') && !cust_secure()) return 'http://' . ($_SERVER['HTTP_HOST'] ?? 'localhost'); // local tests only
    return site_url();
}
function cust_redirect_uri(string $provider): string { return cust_base() . '/api/customer/oauth/' . $provider . '/callback'; }
function cust_email($v): string {
    $e = strtolower(trim(is_string($v) ? $v : ''));
    return strlen($e) <= 190 && filter_var($e, FILTER_VALIDATE_EMAIL) ? $e : '';
}
function cust_throttle(string $key, int $max, int $window, string $msg = 'Too many attempts. Please wait a few minutes and try again.'): void {
    if (rate_limited('cust:' . $key, $max, $window)) json_out(['error' => $msg], 429);
    note_attempt('cust:' . $key);
}
function cust_ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }
function cust_mail(string $to, string $subject, string $body): bool {
    return send_mail($to, $subject, $body . "\n\nSatin Graphic · 50 Viceroy Rd, Unit 22–23, Vaughan, ON · (905) 695-9147 · info@satingraphic.ca");
}
function cust_redirect(string $to): void { header('Cache-Control: no-store'); header('Location: ' . $to, true, 302); exit; }
/** Only same-site page paths under /satin/ are accepted as a post-login destination. */
function cust_return_path($v): string {
    $v = is_string($v) ? $v : '';
    return preg_match('#^/satin(?:/[a-z0-9-]+)*/?(?:\?[a-z0-9=&_-]*)?$#i', $v) && strlen($v) < 200 ? $v : '/satin/account/';
}
function cust_page_lang(string $return): string { return preg_match('#^/satin/(fa|fr|es)(?=/|$)#', $return, $m) ? '/' . $m[1] : ''; }

/* ---------------- accounts & sessions ---------------- */
function cust_by(string $col, string $v): ?array {
    if (!in_array($col, ['id', 'email', 'google_sub', 'facebook_id'], true) || $v === '') return null;
    $q = cust_db()->prepare("SELECT * FROM customer_accounts WHERE $col = ?"); $q->execute([$v]);
    return $q->fetch() ?: null;
}
function cust_public(array $c): array {
    $a = json_decode((string)($c['address'] ?? ''), true);
    return ['id' => $c['id'], 'email' => $c['email'], 'name' => $c['name'], 'phone' => $c['phone'], 'company' => $c['company'],
        'address' => is_array($a) ? $a : (object)[], 'emailVerified' => (bool)(int)$c['email_verified'],
        'methods' => ['password' => $c['pass_hash'] !== '', 'google' => (string)($c['google_sub'] ?? '') !== '', 'facebook' => (string)($c['facebook_id'] ?? '') !== ''],
        'createdAt' => $c['created_at']];
}
function cust_start_session(array $c, string $method): array {
    $pdo = cust_db();
    $old = $_COOKIE[CUST_COOKIE] ?? '';
    if (is_string($old) && $old !== '') $pdo->prepare('DELETE FROM customer_sessions WHERE token_hash = ?')->execute([thash($old)]); // rotate: never reuse a pre-login token
    if (random_int(1, 20) === 1) $pdo->prepare('DELETE FROM customer_sessions WHERE expires_at < ?')->execute([time()]);
    $t = token(); $csrf = token(); $exp = time() + CUST_SESSION_DAYS * 86400;
    $pdo->prepare('INSERT INTO customer_sessions (token_hash,customer_id,csrf,created_at,expires_at,ip,agent) VALUES (?,?,?,?,?,?,?)')
        ->execute([thash($t), $c['id'], $csrf, now_iso(), $exp, cust_ip(), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
    $pdo->prepare('UPDATE customer_accounts SET last_login = ?, last_method = ? WHERE id = ?')->execute([now_iso(), $method, $c['id']]);
    cust_cookie(CUST_COOKIE, $t, $exp);
    cust_cookie(CUST_HINT, '1', $exp, false);
    $_COOKIE[CUST_COOKIE] = $t;
    cust_claim_designs($c['id']);
    return ['csrf' => $csrf];
}
function cust_end_session(): void {
    $t = $_COOKIE[CUST_COOKIE] ?? '';
    if (is_string($t) && $t !== '') cust_db()->prepare('DELETE FROM customer_sessions WHERE token_hash = ?')->execute([thash($t)]);
    cust_cookie(CUST_COOKIE, '', time() - 3600);
    cust_cookie(CUST_HINT, '', time() - 3600, false);
}
function cust_current(): ?array {
    static $cache = false;
    if ($cache !== false) return $cache;
    $t = $_COOKIE[CUST_COOKIE] ?? '';
    if (!is_string($t) || strlen($t) < 20 || strlen($t) > 100) return $cache = null;
    $q = cust_db()->prepare("SELECT s.csrf, s.token_hash, a.* FROM customer_sessions s JOIN customer_accounts a ON a.id = s.customer_id WHERE s.token_hash = ? AND s.expires_at > ? AND a.status = 'active'");
    $q->execute([thash($t), time()]);
    return $cache = ($q->fetch() ?: null);
}
function cust_require(): array {
    $c = cust_current();
    if (!$c) json_out(['error' => 'Please sign in.', 'signin' => true], 401);
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        same_origin();
        if (!hash_equals($c['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_out(['error' => 'Your session changed. Reload the page and try again.'], 403);
    }
    return $c;
}
/** Single-use e-mailed link token (only its SHA-256 is stored). */
function cust_new_token(string $customerId, string $purpose, int $hours, string $bind = ''): string {
    $pdo = cust_db();
    $pdo->prepare('DELETE FROM customer_tokens WHERE customer_id = ? AND purpose = ? AND used_at IS NULL')->execute([$customerId, $purpose]); // a new link replaces older ones
    $t = token();
    $pdo->prepare('INSERT INTO customer_tokens (token_hash,customer_id,purpose,created_at,expires_at,used_at,bind_hash) VALUES (?,?,?,?,?,NULL,?)')->execute([thash($t), $customerId, $purpose, now_iso(), time() + $hours * 3600, $bind !== '' ? thash($bind) : '']);
    return $t;
}
function cust_peek_token($raw, string $purpose): ?array {
    if (!is_string($raw) || !preg_match('/^[A-Za-z0-9_-]{30,60}$/', $raw)) return null;
    $h = thash($raw);
    $q = cust_db()->prepare('SELECT * FROM customer_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?'); $q->execute([$h, $purpose, time()]);
    $r = $q->fetch();
    return $r && hash_equals($r['token_hash'], $h) ? $r : null;
}
function cust_use_token($raw, string $purpose): ?array {
    $r = cust_peek_token($raw, $purpose);
    if (!$r) return null;
    $q = cust_db()->prepare('UPDATE customer_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL'); $q->execute([now_iso(), $r['token_hash']]);
    return $q->rowCount() === 1 ? $r : null; // a parallel request cannot use the same link twice
}
/**
 * E-mail confirmation link. When $bindBrowser is true (sign-up, or sign-in with the right password) this browser gets a cookie and can
 * confirm with one click; anywhere else the link asks for the account password too. So an account pre-registered by someone else with
 * a victim's address is never activated just because the victim clicked the link.
 */
function cust_send_verify(array $c, string $return = '/satin/account/', bool $bindBrowser = false): void {
    $bind = '';
    if ($bindBrowser) { $bind = token(); cust_cookie(CUST_SIGNUP_COOKIE, $bind, time() + CUST_VERIFY_HOURS * 3600, true, '/api/customer/'); }
    $t = cust_new_token($c['id'], 'verify', CUST_VERIFY_HOURS, $bind);
    $link = cust_base() . '/api/customer/verify?token=' . $t . ($return !== '/satin/account/' ? '&return=' . rawurlencode($return) : '');
    cust_mail($c['email'], 'Confirm your Satin Graphic account', "Hello {$c['name']},\n\nPlease confirm your email address to activate your Satin Graphic account:\n\n$link\n\nThe link works once and expires in " . CUST_VERIFY_HOURS . " hours.\n\nIf you did not create an account, ignore this email.");
}
function cust_valid_name($v): string { $n = text($v, 120); return mb_strlen($n) >= 2 ? $n : ''; }
function cust_clean_address($a): array {
    $a = is_array($a) ? $a : [];
    $out = [];
    foreach (['street1', 'street2', 'city', 'zip'] as $k) $out[$k] = text($a[$k] ?? '', 160);
    $out['state'] = in_array($a['state'] ?? '', CUST_PROVINCES, true) ? $a['state'] : 'ON';
    $out['zip'] = strtoupper($out['zip']);
    if ($out['zip'] !== '' && !preg_match('/^[A-Z]\d[A-Z] ?\d[A-Z]\d$/', $out['zip'])) throw new CustError('Enter a valid Canadian postal code (e.g. L4K 3A7).');
    $out['country'] = 'CA';
    return $out;
}

/* ---------------- login settings (Admin → Customer login) ---------------- */
function cust_settings(): array {
    $q = db()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute(['customer.login']); $r = $q->fetch();
    $c = $r ? (json_decode($r['v'], true) ?: []) : [];
    $g = is_array($c['google'] ?? null) ? $c['google'] : []; $f = is_array($c['facebook'] ?? null) ? $c['facebook'] : [];
    return ['google' => ['clientId' => (string)($g['clientId'] ?? ''), 'clientSecret' => (string)($g['clientSecret'] ?? ''), 'enabled' => ($g['enabled'] ?? true) !== false],
        'facebook' => ['appId' => (string)($f['appId'] ?? ''), 'appSecret' => (string)($f['appSecret'] ?? ''), 'enabled' => ($f['enabled'] ?? true) !== false],
        'emailEnabled' => ($c['emailEnabled'] ?? true) !== false, 'updatedAt' => $c['updatedAt'] ?? null, 'updatedBy' => $c['updatedBy'] ?? null];
}
function cust_settings_save(array $c): void {
    $pdo = db(); $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute(['customer.login']);
    $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute(['customer.login', json_encode($c, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), now_iso()]);
    $pdo->commit();
}
function cust_provider_ready(string $p, ?array $s = null): bool {
    $s = $s ?? cust_settings();
    if ($p === 'google') return $s['google']['enabled'] && $s['google']['clientId'] !== '' && $s['google']['clientSecret'] !== '';
    if ($p === 'facebook') return $s['facebook']['enabled'] && $s['facebook']['appId'] !== '' && $s['facebook']['appSecret'] !== '';
    return false;
}
function cust_hint(string $secret): string { return $secret === '' ? '' : '•••• ' . substr($secret, -4); }
function cust_settings_public(): array {
    $s = cust_settings();
    return ['google' => ['clientId' => $s['google']['clientId'], 'secretSet' => $s['google']['clientSecret'] !== '', 'secretHint' => cust_hint($s['google']['clientSecret']), 'enabled' => $s['google']['enabled'],
            'ready' => cust_provider_ready('google', $s), 'redirectUri' => cust_redirect_uri('google'), 'origin' => cust_base()],
        'facebook' => ['appId' => $s['facebook']['appId'], 'secretSet' => $s['facebook']['appSecret'] !== '', 'secretHint' => cust_hint($s['facebook']['appSecret']), 'enabled' => $s['facebook']['enabled'],
            'ready' => cust_provider_ready('facebook', $s), 'redirectUri' => cust_redirect_uri('facebook'), 'origin' => cust_base(), 'deletionUrl' => cust_base() . '/satin/privacy-policy/'],
        'emailEnabled' => $s['emailEnabled'], 'updatedAt' => $s['updatedAt'], 'updatedBy' => $s['updatedBy']];
}

/* ---------------- OAuth (Google OpenID Connect, Facebook Login) ---------------- */
function cust_oauth_url(string $what): string {
    $test = (string)cfg('oauth_test_base', ''); // local tests only: a mock provider
    $real = ['google_auth' => 'https://accounts.google.com/o/oauth2/v2/auth', 'google_token' => 'https://oauth2.googleapis.com/token',
        'facebook_auth' => 'https://www.facebook.com/' . CUST_FB_VERSION . '/dialog/oauth', 'facebook_token' => 'https://graph.facebook.com/' . CUST_FB_VERSION . '/oauth/access_token',
        'facebook_me' => 'https://graph.facebook.com/' . CUST_FB_VERSION . '/me'];
    return $test !== '' ? rtrim($test, '/') . '/' . str_replace('_', '/', $what) : $real[$what];
}
function cust_b64url(string $b): string { return rtrim(strtr(base64_encode($b), '+/', '-_'), '='); }
function cust_http(string $method, string $url, ?array $form = null): array {
    if (!function_exists('curl_init')) throw new CustError('The server cannot reach the sign-in provider (curl is missing).');
    $ch = curl_init($url);
    $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => ['Accept: application/json']];
    if ($form !== null) { $opt[CURLOPT_POSTFIELDS] = http_build_query($form); $opt[CURLOPT_HTTPHEADER][] = 'Content-Type: application/x-www-form-urlencoded'; }
    curl_setopt_array($ch, $opt);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($raw === false) throw new CustError('Could not reach the sign-in provider. Please try again.');
    $j = json_decode((string)$raw, true);
    if (!is_array($j)) throw new CustError('The sign-in provider returned an invalid response.');
    if ($code >= 400) { error_log('satin customer oauth: HTTP ' . $code . ' ' . mb_substr((string)$raw, 0, 300)); throw new CustError('The sign-in provider refused the request. Please try again.'); }
    return $j;
}
function cust_oauth_start(string $provider): void {
    $s = cust_settings();
    if (!cust_provider_ready($provider, $s)) cust_redirect('/satin/login/?error=unavailable');
    cust_throttle('oauth:' . cust_ip(), 40, 600);
    $state = token(); $verifier = token() . token(); $nonce = token();
    $return = cust_return_path($_GET['return'] ?? '');
    $pdo = cust_db();
    $pdo->prepare('DELETE FROM customer_oauth WHERE created_at < ?')->execute([time() - 900]);
    $pdo->prepare('INSERT INTO customer_oauth (state_hash,provider,verifier,nonce,return_to,created_at) VALUES (?,?,?,?,?,?)')->execute([thash($state), $provider, $verifier, $nonce, $return, time()]);
    cust_cookie(CUST_OAUTH_COOKIE, $state, time() + 600, true, '/api/customer/oauth/');
    if ($provider === 'google') {
        $q = ['client_id' => $s['google']['clientId'], 'redirect_uri' => cust_redirect_uri('google'), 'response_type' => 'code', 'scope' => 'openid email profile',
            'state' => $state, 'nonce' => $nonce, 'code_challenge' => cust_b64url(hash('sha256', $verifier, true)), 'code_challenge_method' => 'S256', 'prompt' => 'select_account'];
        cust_redirect(cust_oauth_url('google_auth') . '?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986));
    }
    $q = ['client_id' => $s['facebook']['appId'], 'redirect_uri' => cust_redirect_uri('facebook'), 'response_type' => 'code', 'scope' => 'email,public_profile', 'state' => $state,
        'code_challenge' => cust_b64url(hash('sha256', $verifier, true)), 'code_challenge_method' => 'S256'];
    cust_redirect(cust_oauth_url('facebook_auth') . '?' . http_build_query($q, '', '&', PHP_QUERY_RFC3986));
}
/** Checks state against the browser cookie and the stored row (single use, 10 minutes). */
function cust_oauth_state(string $provider): array {
    $state = (string)($_GET['state'] ?? ''); $cookie = (string)($_COOKIE[CUST_OAUTH_COOKIE] ?? '');
    cust_cookie(CUST_OAUTH_COOKIE, '', time() - 3600, true, '/api/customer/oauth/');
    if ($state === '' || $cookie === '' || !hash_equals($cookie, $state)) throw new CustError('state');
    $pdo = cust_db();
    $q = $pdo->prepare('SELECT * FROM customer_oauth WHERE state_hash = ?'); $q->execute([thash($state)]); $row = $q->fetch();
    $del = $pdo->prepare('DELETE FROM customer_oauth WHERE state_hash = ?'); $del->execute([thash($state)]);
    if (!$row || $del->rowCount() !== 1 || $row['provider'] !== $provider || (int)$row['created_at'] < time() - 600) throw new CustError('state');
    return $row;
}
function cust_jwt_claims(string $jwt): array {
    $p = explode('.', $jwt);
    if (count($p) !== 3) return [];
    $j = json_decode((string)base64_decode(strtr($p[1], '-_', '+/'), true), true);
    return is_array($j) ? $j : [];
}
function cust_oauth_callback(string $provider): void {
    $fail = function (string $why, string $return = '/satin/account/') { cust_redirect('/satin' . cust_page_lang($return) . '/login/?error=' . $why); };
    if (isset($_GET['error'])) { try { $row = cust_oauth_state($provider); $fail('cancelled', $row['return_to']); } catch (CustError $e) { $fail('cancelled'); } }
    try { $row = cust_oauth_state($provider); } catch (CustError $e) { $fail('state'); }
    cust_throttle('oauthcb:' . cust_ip(), 40, 600);
    $code = (string)($_GET['code'] ?? '');
    if ($code === '' || strlen($code) > 2048) $fail('provider', $row['return_to']);
    $s = cust_settings();
    if (!cust_provider_ready($provider, $s)) $fail('unavailable', $row['return_to']);
    try {
        if ($provider === 'google') {
            $tok = cust_http('POST', cust_oauth_url('google_token'), ['code' => $code, 'client_id' => $s['google']['clientId'], 'client_secret' => $s['google']['clientSecret'],
                'redirect_uri' => cust_redirect_uri('google'), 'grant_type' => 'authorization_code', 'code_verifier' => $row['verifier']]);
            // The id_token comes straight from Google's token endpoint over TLS, authenticated with our client secret, so its claims can be trusted
            // (OpenID Connect Core 3.1.3.7). We still check audience, issuer, expiry and the nonce bound to this browser.
            $c = cust_jwt_claims((string)($tok['id_token'] ?? ''));
            if (($c['aud'] ?? '') !== $s['google']['clientId'] || !in_array($c['iss'] ?? '', ['https://accounts.google.com', 'accounts.google.com'], true)
                || (int)($c['exp'] ?? 0) < time() - 120 || !is_string($c['nonce'] ?? null) || !hash_equals($row['nonce'], $c['nonce']) || !is_string($c['sub'] ?? null) || $c['sub'] === '')
                throw new CustError('Google sign-in could not be verified.');
            $verified = ($c['email_verified'] ?? false) === true || ($c['email_verified'] ?? '') === 'true';
            $cust = cust_oauth_account('google', $c['sub'], cust_email($c['email'] ?? ''), $verified, text($c['name'] ?? '', 120));
        } else {
            $tok = cust_http('POST', cust_oauth_url('facebook_token'), ['client_id' => $s['facebook']['appId'], 'client_secret' => $s['facebook']['appSecret'],
                'redirect_uri' => cust_redirect_uri('facebook'), 'code' => $code, 'code_verifier' => $row['verifier']]);
            $at = (string)($tok['access_token'] ?? '');
            if ($at === '') throw new CustError('Facebook sign-in could not be verified.');
            $me = cust_http('GET', cust_oauth_url('facebook_me') . '?' . http_build_query(['fields' => 'id,name,email', 'access_token' => $at, 'appsecret_proof' => hash_hmac('sha256', $at, $s['facebook']['appSecret'])]));
            if (!is_string($me['id'] ?? null) || !preg_match('/^\d{1,40}$/', $me['id'])) throw new CustError('Facebook sign-in could not be verified.');
            // Facebook only returns an e-mail address the person has confirmed with Facebook.
            $cust = cust_oauth_account('facebook', $me['id'], cust_email($me['email'] ?? ''), true, text($me['name'] ?? '', 120));
        }
    } catch (CustError $e) {
        error_log('satin customer oauth ' . $provider . ': ' . $e->getMessage());
        $fail(in_array($e->getMessage(), ['email', 'disabled', 'linked'], true) ? $e->getMessage() : 'provider', $row['return_to']);
    }
    cust_start_session($cust, $provider);
    cust_redirect($row['return_to']);
}
/** Finds, links or creates the account for an OAuth identity. Links to an existing account only through a provider-verified e-mail. */
function cust_oauth_account(string $provider, string $pid, string $email, bool $verified, string $name): array {
    $col = $provider === 'google' ? 'google_sub' : 'facebook_id';
    $pdo = cust_db();
    $c = cust_by($col, $pid);
    $me = cust_current();
    if ($me) { // "Connect Google / Facebook" from My account → Profile: link to the signed-in account
        if ($c && $c['id'] !== $me['id']) throw new CustError('linked');
        if ((string)($me[$col] ?? '') !== '' && $me[$col] !== $pid) throw new CustError('linked');
        $pdo->prepare("UPDATE customer_accounts SET $col = ?, updated_at = ? WHERE id = ?")->execute([$pid, now_iso(), $me['id']]);
        return cust_by('id', $me['id']);
    }
    if ($c) {
        if ($c['status'] !== 'active') throw new CustError('disabled');
        if (!(int)$c['email_verified'] && $verified && $email === $c['email']) $pdo->prepare('UPDATE customer_accounts SET email_verified = 1, updated_at = ? WHERE id = ?')->execute([now_iso(), $c['id']]);
        return cust_by('id', $c['id']);
    }
    if ($email === '' || !$verified) throw new CustError('email');
    $c = cust_by('email', $email);
    if ($c) {
        if ($c['status'] !== 'active') throw new CustError('disabled');
        if ((string)($c[$col] ?? '') !== '' && $c[$col] !== $pid) throw new CustError('linked');
        // An unverified e-mail/password sign-up was never proven to belong to this person: drop that password and its sessions before linking.
        if (!(int)$c['email_verified']) {
            $pdo->prepare("UPDATE customer_accounts SET pass_hash = '' WHERE id = ?")->execute([$c['id']]);
            $pdo->prepare('DELETE FROM customer_sessions WHERE customer_id = ?')->execute([$c['id']]);
        }
        $pdo->prepare("UPDATE customer_accounts SET $col = ?, email_verified = 1, updated_at = ? WHERE id = ?")->execute([$pid, now_iso(), $c['id']]);
        return cust_by('id', $c['id']);
    }
    $id = uuid(); $now = now_iso();
    $pdo->prepare("INSERT INTO customer_accounts (id,email,name,phone,company,address,pass_hash,email_verified,$col,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([$id, $email, $name !== '' ? $name : explode('@', $email)[0], '', '', null, '', 1, $pid, 'active', $now, $now]);
    return cust_by('id', $id);
}

/* ---------------- orders, invoices, requests of the signed-in customer ---------------- */
function cust_order_filter(array $c): array {
    // Orders placed while signed in, plus orders placed with the account's e-mail once that e-mail is verified.
    // Orders the customer removed from My account are left out (they stay in admin as cancelled orders).
    return (int)$c['email_verified'] ? ['(customer_id = ? OR lower(email) = ?) AND customer_hidden = 0', [$c['id'], strtolower($c['email'])]] : ['customer_id = ? AND customer_hidden = 0', [$c['id']]];
}
function cust_has_orders_table(): bool {
    try { cust_db()->query('SELECT customer_id FROM shop_orders WHERE 1 = 0'); return true; } catch (Throwable $e) { return false; }
}
function cust_order_owned(array $c, string $id): ?array {
    if (!preg_match('/^[a-f0-9-]{36}$/i', $id) || !cust_has_orders_table()) return null;
    [$w, $p] = cust_order_filter($c);
    $q = cust_db()->prepare("SELECT * FROM shop_orders WHERE id = ? AND $w"); $q->execute(array_merge([$id], $p));
    return $q->fetch() ?: null;
}
function cust_stage(array $o): string {
    if (in_array($o['stage'] ?? '', ['new', 'artwork_check', 'in_production', 'ready', 'completed', 'cancelled'], true)) return $o['stage'];
    return ['in_production' => 'in_production', 'ready' => 'ready', 'completed' => 'completed', 'cancelled' => 'cancelled', 'refunded' => 'cancelled'][$o['status']] ?? 'new';
}
function cust_pay_status(array $o): string {
    if (in_array($o['status'], ['paid', 'in_production', 'ready', 'completed'], true)) return 'paid';
    return in_array($o['status'], ['awaiting_payment', 'refunded', 'cancelled'], true) ? $o['status'] : 'awaiting_payment';
}
/** Before payment, nothing has started: the customer may cancel the order or remove it from My account. Paid / in-progress / completed orders can't be changed online. */
function cust_order_unpaid(array $o): bool {
    if (($o['paid_at'] ?? '') !== '' || ($o['payment_id'] ?? '') !== '') return false;
    if (!in_array($o['status'], ['awaiting_payment', 'cancelled'], true)) return false;
    return in_array(cust_stage($o), ['new', 'artwork_check', 'cancelled'], true);
}
function cust_order_cancellable(array $o): bool { return cust_order_unpaid($o) && $o['status'] === 'awaiting_payment' && cust_stage($o) !== 'cancelled'; }
function cust_order_summary(array $o): array {
    $items = json_decode((string)$o['items'], true) ?: [];
    return ['id' => $o['id'], 'reference' => $o['number'], 'createdAt' => $o['created_at'], 'stage' => cust_stage($o), 'payment' => cust_pay_status($o), 'total' => (int)$o['total'],
        'currency' => $o['currency'] ?: 'CAD', 'cancellable' => cust_order_cancellable($o), 'deletable' => cust_order_unpaid($o), 'items' => array_map(fn($i) => ($i['jobName'] ?? '') !== '' ? $i['jobName'] : (string)($i['name'] ?? 'Item'), $items), 'count' => count($items)];
}
function cust_order_detail(array $o): array {
    require_once __DIR__ . '/commerce.php';
    $paid = shop_order_paid($o);
    $ids = [];
    foreach (json_decode((string)$o['items'], true) ?: [] as $i) foreach (array_merge($i['fileIds'] ?? [], $i['designFiles'] ?? []) as $f) if (is_string($f)) $ids[] = $f;
    $files = [];
    if ($ids) {
        $q = cust_db()->prepare('SELECT id, name, mime FROM shop_files WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')'); $q->execute(array_values(array_unique($ids)));
        foreach ($q->fetchAll() as $f) $files[$f['id']] = $f;
    }
    $items = [];
    foreach (json_decode((string)$o['items'], true) ?: [] as $i) {
        $own = []; $images = [];
        foreach (array_merge($i['fileIds'] ?? [], $i['designFiles'] ?? []) as $fid) {
            if (!is_string($fid) || !isset($files[$fid])) continue;
            $f = $files[$fid]; $role = preg_match('/-(mockup|preview|print)\.(png|jpe?g)$/i', $f['name'], $m) ? strtolower($m[1]) : (in_array($fid, $i['fileIds'] ?? [], true) ? 'artwork' : 'file');
            if (str_ends_with($f['name'], '.json')) continue; // editable design source: staff only
            $entry = ['id' => $f['id'], 'name' => $f['name'], 'mime' => $f['mime'], 'role' => $role];
            if (in_array($f['mime'], ['image/png', 'image/jpeg', 'image/webp'], true) && $role !== 'print') $images[] = $entry; else $own[] = $entry;
        }
        usort($images, fn($a, $b) => ($a['role'] === 'mockup' ? 0 : ($a['role'] === 'preview' ? 1 : 2)) <=> ($b['role'] === 'mockup' ? 0 : ($b['role'] === 'preview' ? 1 : 2)));
        $items[] = ['name' => (string)($i['name'] ?? ''), 'jobName' => (string)($i['jobName'] ?? ''), 'path' => (string)($i['path'] ?? ''), 'quantity' => $i['values']['quantity'] ?? 1,
            'width' => $i['spec']['width'] ?? null, 'height' => $i['spec']['height'] ?? null, 'sides' => $i['spec']['sides'] ?? null,
            'choices' => array_values(array_filter(array_map(fn($c) => ['label' => (string)($c['label'] ?? ''), 'text' => (string)($c['text'] ?? '')], is_array($i['choices'] ?? null) ? $i['choices'] : []), fn($c) => $c['text'] !== '')),
            'designRequested' => !empty($i['designRequested']), 'digital' => !empty($i['templateId']) || !empty($i['digitalKey']), 'price' => (int)($i['price']['net'] ?? 0), 'images' => $images, 'files' => $own,
            // Paid digital items: a fresh signed link (14 days) each time the signed-in customer opens the order.
            'download' => $paid && shop_item_downloadable($i) ? ['url' => '/api/download?token=' . shop_download_token($o['id'], (string)$i['id']), 'name' => (string)($i['digitalName'] ?? $i['name'] ?? 'Download'), 'material' => (string)($i['material'] ?? '')] : null,
            'downloadPending' => $paid && !empty($i['digitalKey']) && !shop_item_downloadable($i)];
    }
    $hist = [];
    foreach (json_decode((string)($o['history'] ?? ''), true) ?: [] as $h) if (is_array($h) && isset($h['stage'])) $hist[] = ['at' => (string)($h['at'] ?? ''), 'stage' => (string)$h['stage']]; // staff notes stay private
    $ship = json_decode((string)$o['shipping'], true) ?: [];
    return array_merge(cust_order_summary($o), ['detail' => true, 'items' => $items, 'address' => json_decode((string)$o['address'], true) ?: (object)[], 'shippingMethod' => (string)($ship['label'] ?? ''), 'pickup' => ($ship['id'] ?? '') === 'pickup',
        'subtotal' => (int)$o['subtotal'], 'discount' => (int)($o['discount'] ?? 0), 'coupon' => (string)($o['coupon_code'] ?? ''), 'shipping' => (int)$o['shipping_total'], 'tax' => (int)$o['tax'], 'taxRate' => (int)$o['tax_rate'],
        'payUrl' => $o['status'] === 'awaiting_payment' && preg_match('#^https://#', (string)$o['payment_url']) ? $o['payment_url'] : null, 'paidAt' => $o['paid_at'] ?: null, 'card' => ($o['card'] ?? '') ?: null,
        'history' => $hist, 'notes' => (string)$o['customer_notes']]);
}
function cust_invoices(array $c): array {
    if (!(int)$c['email_verified']) return [];
    try {
        $like = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], strtolower((string)json_encode($c['email'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE))) . '%';
        $q = cust_db()->prepare("SELECT i.* FROM invoices i WHERE i.status NOT IN ('draft','void') AND (i.customer_id IN (SELECT id FROM inv_customers WHERE lower(email) = ?) OR lower(i.customer) LIKE ? ESCAPE '!') ORDER BY i.issue_date DESC, i.created_at DESC LIMIT 200");
        $q->execute([strtolower($c['email']), $like]);
        $rows = $q->fetchAll();
    } catch (Throwable $e) { return []; }
    $out = [];
    foreach ($rows as $r) {
        $cust = json_decode((string)$r['customer'], true) ?: [];
        $linked = strtolower((string)($cust['email'] ?? '')) === strtolower($c['email']);
        if (!$linked) { // matched through the customer record
            $q = cust_db()->prepare('SELECT 1 FROM inv_customers WHERE id = ? AND lower(email) = ?'); $q->execute([(string)$r['customer_id'], strtolower($c['email'])]);
            if (!$q->fetch()) continue;
        }
        $paid = (int)$r['paid']; $total = (int)$r['total'];
        $status = $total > 0 && $paid >= $total ? 'paid' : ($r['due_date'] < toronto_today() ? 'overdue' : ($paid > 0 ? 'partial' : 'open'));
        $out[] = ['number' => (string)$r['number_text'], 'title' => (string)$r['title'], 'issueDate' => $r['issue_date'], 'dueDate' => $r['due_date'], 'total' => $total, 'paid' => $paid,
            'balance' => max(0, $total - $paid), 'currency' => $r['currency'] ?: 'CAD', 'status' => $status, 'url' => '/invoice/?t=' . rawurlencode((string)$r['token'])];
    }
    return $out;
}
function cust_requests(array $c): array {
    if (!(int)$c['email_verified']) return [];
    try {
        $q = cust_db()->prepare('SELECT id, type, service, preferred_date, preferred_time, status, created_at FROM service_requests WHERE lower(email) = ? ORDER BY created_at DESC LIMIT 100');
        $q->execute([strtolower($c['email'])]);
    } catch (Throwable $e) { return []; }
    $labels = ['pending_confirmation' => 'Received', 'contacted' => 'Contacted', 'quoted' => 'Quoted', 'confirmed' => 'Confirmed', 'completed' => 'Completed', 'cancelled' => 'Cancelled'];
    return array_map(fn($r) => ['reference' => 'SG-' . strtoupper(substr((string)$r['id'], 0, 8)), 'type' => $r['type'], 'service' => $r['service'], 'date' => $r['preferred_date'], 'time' => $r['preferred_time'],
        'status' => $r['status'], 'statusLabel' => $labels[$r['status']] ?? $r['status'], 'createdAt' => $r['created_at']], $q->fetchAll());
}
/** Called by commerce.php right after an online order is created: remembers the signed-in account on the order. */
function cust_attach_order(string $orderId): void {
    try { $c = cust_current(); if ($c) cust_db()->prepare("UPDATE shop_orders SET customer_id = ? WHERE id = ? AND customer_id = ''")->execute([$c['id'], $orderId]); }
    catch (Throwable $e) { error_log('satin customer attach: ' . $e->getMessage()); }
}
/** Puts the items of an earlier order back into this browser's checkout, at today's prices. Artwork files are copied into the current session. */
function cust_reorder(array $o): array {
    require_once __DIR__ . '/commerce.php';
    $pdo = shop_db();
    $s = shop_session();
    if (!$s) {
        shop_limit('shopsession:' . shop_ip(), 25, 86400, 'Too many artwork sessions from this network today. Please contact us.');
        $id = shop_hex_id(); $tok = bin2hex(random_bytes(32)); $exp = time() + 30 * 86400;
        $pdo->prepare('INSERT INTO shop_sessions (id,token_hash,ip,created_at,expires_at) VALUES (?,?,?,?,?)')->execute([$id, hash('sha256', $tok), shop_ip(), now_iso(), $exp]);
        setcookie(SHOP_COOKIE, "$id.$tok", ['expires' => $exp, 'path' => '/', 'secure' => shop_secure(), 'httponly' => true, 'samesite' => 'Lax']);
        $s = ['id' => $id];
    }
    $sid = $s['id'];
    [$draft, $revision, $exists] = shop_draft($sid);
    if (!empty($draft['submitted'])) $draft = shop_empty_draft();
    $added = 0; $skipped = []; $needsArtwork = 0; $priceChanged = 0; $already = 0;
    foreach (json_decode((string)$o['items'], true) ?: [] as $n => $i) {
        $label = ($i['jobName'] ?? '') !== '' ? $i['jobName'] : (string)($i['name'] ?? 'Item');
        if (!empty($i['templateId']) || !empty($i['digitalKey'])) { $skipped[] = $label . ' (digital download — already yours)'; continue; }
        $key = 'reorder-' . substr($o['id'], 0, 8) . '-' . $n;
        foreach ($draft['items'] as $x) if (($x['sourceKey'] ?? '') === $key) { $already++; continue 2; }
        if (count($draft['items']) >= 30) { $skipped[] = $label; continue; }
        $prod = shop_product_for_rule((string)($i['ruleId'] ?? '')); $rule = shop_rule((string)($i['ruleId'] ?? ''));
        if (!$prod || !$rule || (isset($prod['stock']) && $prod['stock'] !== null)) { $skipped[] = $label . ' (no longer available online)'; continue; }
        try { $values = is_array($i['values'] ?? null) ? $i['values'] : []; $price = calculate($rule, $values); } // same check as checkout payment
        catch (Throwable $e) { $skipped[] = $label . ' (options changed)'; continue; }
        if ($price['net'] <= 0) { $skipped[] = $label; continue; }
        if ((int)$price['net'] !== (int)($i['price']['net'] ?? 0)) $priceChanged++;
        $copy = function (array $ids) use ($sid): array {
            $map = [];
            foreach ($ids as $fid) {
                if (!is_string($fid)) continue;
                $f = shop_file($fid);
                if (!$f) return [];
                $p = shop_file_path($f);
                $data = is_file($p) ? (string)file_get_contents($p) : '';
                if ($data === '') return [];
                $row = shop_store_bytes($data, (string)$f['kind'] === 'generated' ? 'generated' : 'upload', $sid, (string)$f['name'], (string)$f['mime'], (int)$f['width'], (int)$f['height'], json_decode((string)($f['meta'] ?? ''), true) ?: null);
                $map[$fid] = $row['id'];
            }
            return $map;
        };
        $oldFiles = array_values(array_unique(array_merge(is_array($i['fileIds'] ?? null) ? $i['fileIds'] : [], is_array($i['designFiles'] ?? null) ? $i['designFiles'] : [])));
        $map = $oldFiles ? $copy($oldFiles) : [];
        $filesOk = !$oldFiles || count($map) === count($oldFiles);
        $fileIds = $filesOk ? array_values(array_map(fn($f) => $map[$f], array_filter(is_array($i['fileIds'] ?? null) ? $i['fileIds'] : [], 'is_string'))) : [];
        $designFiles = $filesOk ? array_values(array_map(fn($f) => $map[$f], array_filter(is_array($i['designFiles'] ?? null) ? $i['designFiles'] : [], 'is_string'))) : [];
        $design = !empty($values['design']) || $rule['id'] === 'design-services';
        $accepted = $design || ($prod['artwork'] ?? true) === false || ($filesOk && !empty($i['artworkAccepted']) && ($fileIds || $designFiles));
        if (!$accepted) $needsArtwork++;
        $reports = [];
        if ($filesOk && !$designFiles) foreach ($fileIds as $fid) { try { $reports[] = shop_check_file(shop_owned_file($fid, $sid), $rule, $values); } catch (Throwable $e) { } }
        $draft['items'][] = ['id' => uuid(), 'sourceKey' => $key, 'productId' => (string)$prod['id'], 'name' => (string)$prod['name'], 'path' => (string)$prod['path'], 'ruleId' => $rule['id'], 'values' => $values, 'coupon' => '',
            'price' => $price, 'spec' => is_array($i['spec'] ?? null) ? $i['spec'] : shop_spec($rule, $values), 'fileIds' => $fileIds, 'reports' => $reports, 'artworkAccepted' => $accepted,
            'proof' => $accepted && !empty($i['proof']), 'jobName' => (string)($i['jobName'] ?? ''), 'designRequested' => $design, 'choices' => shop_choices($rule, $values),
            'lines' => array_values(array_filter(is_array($i['lines'] ?? null) ? $i['lines'] : [], 'is_string')), 'designFiles' => $designFiles, 'reorderOf' => $o['number']];
        $added++;
    }
    if ($added) {
        $draft['rates'] = []; $draft['shipping'] = null;
        if (!shop_draft_save($sid, $draft, $revision, $exists)) throw new CustError('Your checkout changed in another tab. Please try again.');
    }
    return ['added' => $added, 'already' => $already, 'skipped' => $skipped, 'needsArtwork' => $needsArtwork, 'priceChanged' => $priceChanged, 'checkout' => '/satin/checkout/'];
}
/** Sends an order artwork file or mockup to its owner. */
function cust_order_file(array $c): void {
    $o = cust_order_owned($c, (string)($_GET['order'] ?? ''));
    $fid = (string)($_GET['id'] ?? '');
    if (!$o || !in_array($fid, json_decode((string)$o['file_ids'], true) ?: [], true)) {
        $ok = false; // older orders: file ids are listed per item
        if ($o) foreach (json_decode((string)$o['items'], true) ?: [] as $i) if (in_array($fid, array_merge($i['fileIds'] ?? [], $i['designFiles'] ?? []), true)) $ok = true;
        if (!$ok) json_out(['error' => 'File not found.'], 404);
    }
    require_once __DIR__ . '/commerce.php';
    $f = shop_file($fid);
    if (!$f || str_ends_with((string)$f['name'], '.json')) json_out(['error' => 'File not found.'], 404);
    shop_send_file($f, ($_GET['inline'] ?? '') === '1');
}

/* ---------------- Design Studio designs saved to the account ---------------- */
/** On sign-in: designs made in this browser's studio session (not yet in any account) move into the account. */
function cust_claim_designs(string $customerId): void {
    if (empty($_COOKIE['satin_studio'])) return;
    try {
        require_once __DIR__ . '/commerce.php';
        $s = shop_session(); if (!$s) return;
        shop_db()->prepare("UPDATE shop_designs SET customer_id = ? WHERE session_id = ? AND customer_id = '' AND updated_at > ?")->execute([$customerId, $s['id'], gmdate('Y-m-d\TH:i:s', time() - 30 * 86400)]);
    } catch (Throwable $e) { error_log('satin claim designs: ' . $e->getMessage()); }
}
/** A saved design row — only when it belongs to this customer. */
function cust_design_row(array $c, string $id): ?array {
    require_once __DIR__ . '/commerce.php';
    if (!shop_is_uuid($id)) return null;
    $q = shop_db()->prepare('SELECT * FROM shop_designs WHERE id = ? AND customer_id = ?'); $q->execute([$id, $c['id']]);
    return $q->fetch() ?: null;
}
/** File ids a design refers to (uploads, approved print files and mockups). */
function cust_design_file_ids(array $d): array {
    $ids = [];
    foreach ((array)($d['assets'] ?? []) as $f) if (is_string($f)) $ids[] = $f;
    foreach (['generated', 'originals'] as $k) foreach ((array)($d[$k] ?? []) as $g) if (is_array($g) && is_string($g['id'] ?? null)) $ids[] = $g['id'];
    return array_values(array_unique($ids));
}
function cust_design_summary(array $row): array {
    $d = json_decode((string)$row['design'], true) ?: [];
    $gen = []; $prints = [];
    foreach ((array)($d['generated'] ?? []) as $g) if (is_array($g)) $gen[$g['role'] ?? ''][] = $g;
    if (!empty($gen['print'])) {
        $ids = array_column($gen['print'], 'id');
        $q = shop_db()->prepare('SELECT id, name, meta FROM shop_files WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')'); $q->execute($ids);
        foreach ($q->fetchAll() as $f) { $m = json_decode((string)($f['meta'] ?? ''), true) ?: []; $prints[] = ['id' => $f['id'], 'side' => (string)($m['side'] ?? ''), 'widthIn' => $m['widthIn'] ?? null, 'heightIn' => $m['heightIn'] ?? null, 'bleedIn' => $m['bleedIn'] ?? 0, 'dpi' => $m['dpi'] ?? null]; }
    }
    $layers = 0; foreach ((array)($d['sides'] ?? []) as $sd) $layers += is_array($sd['layers'] ?? null) ? count($sd['layers']) : 0;
    return ['id' => $row['id'], 'productId' => (string)($d['productId'] ?? ''), 'updatedAt' => $row['updated_at'], 'approved' => !empty($d['approvedAt']), 'layers' => $layers,
        'values' => is_array($d['options']['values'] ?? null) ? $d['options']['values'] : (object)[], 'thumb' => (string)($row['thumb_id'] ?? '') ?: null,
        'mockup' => $gen['mockup'][0]['id'] ?? null, 'prints' => $prints, 'review' => is_array($d['review'] ?? null) ? $d['review'] : null];
}
/** This browser's studio session (created when missing), so an account design can be edited or ordered here. */
function cust_shop_session(): array {
    require_once __DIR__ . '/commerce.php';
    $s = shop_session(); if ($s) return $s;
    shop_limit('shopsession:' . shop_ip(), 25, 86400, 'Too many artwork sessions from this network today. Please contact us.');
    $id = shop_hex_id(); $tok = bin2hex(random_bytes(32)); $exp = time() + 30 * 86400;
    shop_db()->prepare('INSERT INTO shop_sessions (id,token_hash,ip,created_at,expires_at) VALUES (?,?,?,?,?)')->execute([$id, hash('sha256', $tok), shop_ip(), now_iso(), $exp]);
    setcookie(SHOP_COOKIE, "$id.$tok", ['expires' => $exp, 'path' => '/', 'secure' => shop_secure(), 'httponly' => true, 'samesite' => 'Lax']);
    return ['id' => $id];
}
/** Moves an account design into this browser's studio session (copying its files when it was made in another browser). */
function cust_open_design(array $row): array {
    $sid = cust_shop_session()['id'];
    $json = (string)$row['design']; $thumb = (string)($row['thumb_id'] ?? '');
    if (!hash_equals((string)$row['session_id'], $sid)) {
        $ids = cust_design_file_ids(json_decode($json, true) ?: []); if ($thumb !== '') $ids[] = $thumb;
        $map = [];
        foreach (array_unique($ids) as $fid) {
            $f = shop_file($fid); if (!$f || !in_array($f['kind'], ['upload', 'generated'], true)) continue;
            $p = shop_file_path($f); $data = is_file($p) ? (string)file_get_contents($p) : ''; if ($data === '') continue;
            $map[$fid] = shop_store_bytes($data, $f['kind'] === 'generated' ? 'generated' : 'upload', $sid, (string)$f['name'], (string)$f['mime'], (int)$f['width'], (int)$f['height'], json_decode((string)($f['meta'] ?? ''), true) ?: null)['id'];
        }
        // ids are random UUIDs, so replacing them in the stored JSON is exact
        $json = strtr($json, $map); $thumb = $map[$thumb] ?? $thumb;
        shop_db()->prepare('UPDATE shop_designs SET session_id = ?, design = ?, thumb_id = ? WHERE id = ? AND customer_id = ?')->execute([$sid, $json, $thumb, $row['id'], $row['customer_id']]);
    }
    $d = json_decode($json, true) ?: [];
    return ['id' => $row['id'], 'productId' => (string)($d['productId'] ?? ''), 'approved' => !empty($d['approvedAt'])];
}

/* ---------------- cart shared across the customer's devices ---------------- */
const CUST_CART_ITEMS = 60;
const CUST_CART_COPIES = 40; // artwork files copied into this browser per request at most (the rest follow on the next page load)
/** Artwork references of a cart item: uploaded files (artwork.fileId / fileIds) and an approved Design Studio design (artwork.designId). */
function cust_cart_refs(array $item): array {
    $a = is_array($item['artwork'] ?? null) ? $item['artwork'] : [];
    $files = is_array($a['fileIds'] ?? null) ? $a['fileIds'] : [];
    if (isset($a['fileId'])) $files[] = $a['fileId'];
    return ['file' => array_values(array_unique(array_filter($files, 'is_string'))), 'design' => is_string($a['designId'] ?? null) ? [$a['designId']] : []];
}
function cust_cart_load(string $cid): array {
    $q = cust_db()->prepare('SELECT data, revision, updated_at FROM customer_carts WHERE customer_id = ?'); $q->execute([$cid]); $r = $q->fetch();
    $d = $r ? (json_decode((string)$r['data'], true) ?: []) : [];
    return ['items' => is_array($d['items'] ?? null) ? array_values($d['items']) : [], 'verified' => ['file' => (array)($d['verified']['file'] ?? []), 'design' => (array)($d['verified']['design'] ?? [])],
        'revision' => $r ? (int)$r['revision'] : 0, 'exists' => (bool)$r];
}
/** True when $id is artwork this customer's cart already copied between their own sessions (as source or copy). */
function cust_cart_known(string $cid, string $kind, string $id): bool {
    $q = cust_db()->prepare('SELECT 1 FROM customer_cart_copies WHERE customer_id = ? AND kind = ? AND (src_id = ? OR dst_id = ?) LIMIT 1'); $q->execute([$cid, $kind, $id, $id]);
    return (bool)$q->fetch();
}
function cust_cart_owned(string $kind, string $id, string $sid): bool {
    if ($kind === 'design') return shop_owned_design($id, $sid) !== null;
    $f = shop_file($id);
    return $f && in_array($f['kind'], ['upload', 'generated'], true) && hash_equals((string)$f['session_id'], $sid);
}
/** The id of verified artwork $id as seen from browser session $sid: the same id when that session owns it, else its copy for that session (made now when missing). */
function cust_cart_ref_for(string $cid, string $kind, string $id, string $sid, int &$budget): ?string {
    if (!shop_is_id($id) || ($kind === 'design' && !shop_is_uuid($id))) return null;
    $q = cust_db()->prepare('SELECT src_id FROM customer_cart_copies WHERE customer_id = ? AND kind = ? AND dst_id = ? LIMIT 1'); $q->execute([$cid, $kind, $id]);
    $root = (string)($q->fetchColumn() ?: $id); // copies are always recorded against the original
    foreach (array_unique([$id, $root]) as $x) if (cust_cart_owned($kind, $x, $sid)) return $x;
    $q = cust_db()->prepare('SELECT dst_id FROM customer_cart_copies WHERE customer_id = ? AND kind = ? AND src_id = ? AND session_id = ?'); $q->execute([$cid, $kind, $root, $sid]);
    $dst = $q->fetchColumn();
    if ($dst && cust_cart_owned($kind, (string)$dst, $sid)) return (string)$dst;
    if ($budget <= 0) return null;
    if ($kind === 'file') {
        $f = shop_file($id) ?: shop_file($root);
        if (!$f || !in_array($f['kind'], ['upload', 'generated'], true)) return null;
        $p = shop_file_path($f); $data = is_file($p) ? (string)file_get_contents($p) : '';
        if ($data === '') return null;
        $budget--;
        $new = shop_store_bytes($data, $f['kind'] === 'generated' ? 'generated' : 'upload', $sid, (string)$f['name'], (string)$f['mime'], (int)$f['width'], (int)$f['height'], json_decode((string)($f['meta'] ?? ''), true) ?: null)['id'];
    } else {
        $q = shop_db()->prepare('SELECT design FROM shop_designs WHERE id = ?'); $q->execute([$id]); $json = $q->fetchColumn();
        if (!$json && $root !== $id) { $q->execute([$root]); $json = $q->fetchColumn(); }
        if (!$json) return null;
        $map = [];
        foreach (cust_design_file_ids(json_decode((string)$json, true) ?: []) as $fid) { $to = cust_cart_ref_for($cid, 'file', $fid, $sid, $budget); if ($to === null) return null; if ($to !== $fid) $map[$fid] = $to; }
        $new = uuid(); // ids are random UUIDs, so replacing them in the stored JSON is exact (same as cust_open_design)
        // customer_id "cart:<id>": a working copy for this browser, not listed again under My account → Saved designs
        shop_db()->prepare('INSERT INTO shop_designs (id,session_id,design,updated_at,customer_id,thumb_id) VALUES (?,?,?,?,?,?)')->execute([$new, $sid, strtr((string)$json, $map), now_iso(), 'cart:' . $cid, '']);
    }
    $del = cust_db()->prepare('DELETE FROM customer_cart_copies WHERE customer_id = ? AND kind = ? AND src_id = ? AND session_id = ?'); $del->execute([$cid, $kind, $root, $sid]);
    cust_db()->prepare('INSERT INTO customer_cart_copies (customer_id,kind,src_id,session_id,dst_id,created_at) VALUES (?,?,?,?,?,?)')->execute([$cid, $kind, $root, $sid, $new, now_iso()]);
    return $new;
}
/** The account cart as this browser should see it: verified artwork is copied into this browser's session (ids rewritten), anything else is left out. */
function cust_cart_for_session(array $c, string $sid): array {
    $cart = cust_cart_load($c['id']); $budget = CUST_CART_COPIES; $out = [];
    foreach ($cart['items'] as $item) {
        if (!is_array($item)) continue;
        $refs = cust_cart_refs($item); $map = []; $drop = [];
        foreach ($refs as $kind => $ids) foreach ($ids as $id) {
            $to = in_array($id, $cart['verified'][$kind], true) ? cust_cart_ref_for($c['id'], $kind, $id, $sid, $budget) : null;
            if ($to === null) $drop[$kind][] = $id; elseif ($to !== $id) $map[$id] = $to;
        }
        if ($drop) { // never hand out artwork that was not verified as the customer's own: the item stays, without that file
            $a = $item['artwork'];
            if (isset($a['fileIds']) && is_array($a['fileIds'])) $a['fileIds'] = array_values(array_diff($a['fileIds'], $drop['file'] ?? []));
            if (isset($a['fileId']) && in_array($a['fileId'], $drop['file'] ?? [], true)) { $a['fileId'] = $a['fileIds'][0] ?? null; if ($a['fileId'] === null) unset($a['fileId']); }
            if (isset($a['designId']) && in_array($a['designId'], $drop['design'] ?? [], true)) unset($a['designId']);
            $item['artwork'] = array_filter($a, fn($x) => $x !== [] && $x !== null) ?: null;
            if ($item['artwork'] === null) $item['artworkAccepted'] = false;
        }
        if ($map) $item = json_decode(strtr((string)json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), $map), true); // also the "Artwork file: <id>" note lines
        $out[] = $item;
    }
    return ['items' => $out, 'revision' => $cart['revision']];
}

/* ---------------- public routes: /api/customer/* ---------------- */
function customer_route(string $path, string $method): void {
    header('Cache-Control: private, no-store');
    header('X-Robots-Tag: noindex');
    try { customer_route_inner(substr($path, strlen('/api/customer')), $method); }
    catch (CustError $e) { json_out(['error' => $e->getMessage()], 400); }
}
function customer_route_inner(string $r, string $method): void {
    $pdo = cust_db();
    if ($method === 'POST' && !in_array($r, ['/logout'], true)) same_origin();

    if ($r === '/me' && $method === 'GET') {
        $c = cust_current(); $s = cust_settings();
        $providers = ['google' => cust_provider_ready('google', $s), 'facebook' => cust_provider_ready('facebook', $s), 'email' => $s['emailEnabled']];
        if (!$c) { if (isset($_COOKIE[CUST_HINT])) cust_cookie(CUST_HINT, '', time() - 3600, false); json_out(['customer' => null, 'providers' => $providers, 'login' => '/satin/login/']); }
        json_out(['customer' => cust_public($c), 'csrf' => $c['csrf'], 'providers' => $providers]);
    }

    if ($r === '/signup' && $method === 'POST') {
        $v = body_json(4000);
        if (!empty($v['website'])) json_out(['error' => 'Invalid request'], 400); // honeypot
        if (!cust_settings()['emailEnabled']) json_out(['error' => 'Email sign-up is not available. Use Google or Facebook.'], 403);
        $name = cust_valid_name($v['name'] ?? ''); $email = cust_email($v['email'] ?? ''); $pass = is_string($v['password'] ?? null) ? $v['password'] : '';
        if ($name === '' || $email === '') json_out(['error' => 'Enter your name and a valid email address.'], 400);
        if ($err = valid_password($pass)) json_out(['error' => $err], 400);
        if (($v['terms'] ?? null) !== true) json_out(['error' => 'Accept the Terms and Privacy Policy to continue.'], 400);
        cust_throttle('signup:' . cust_ip(), 10, 3600, 'Too many sign-ups from this network. Please try again later.');
        cust_throttle('signupmail:' . $email, 3, 3600, 'We already sent a link to this address. Check your inbox and spam folder.');
        $return = cust_return_path($v['return'] ?? '');
        $c = cust_by('email', $email);
        if ($c && ((int)$c['email_verified'] || $c['google_sub'] || $c['facebook_id'])) {
            // Never reveal that the address is registered: tell the owner by e-mail instead.
            cust_mail($email, 'Your Satin Graphic account', "Hello {$c['name']},\n\nSomeone (hopefully you) tried to create a Satin Graphic account with this email address, but you already have one.\n\nSign in: " . cust_base() . "/satin/login/\nForgot your password? " . cust_base() . "/satin/login/?forgot=1\n\nIf this wasn't you, you can ignore this email.");
        } else {
            $hash = password_hash($pass, PASSWORD_DEFAULT); $now = now_iso();
            $phone = text($v['phone'] ?? '', 40);
            if ($c) $pdo->prepare('UPDATE customer_accounts SET name = ?, phone = ?, pass_hash = ?, updated_at = ? WHERE id = ?')->execute([$name, $phone, $hash, $now, $c['id']]); // still unverified: last sign-up wins
            else { $id = uuid(); $pdo->prepare('INSERT INTO customer_accounts (id,email,name,phone,company,address,pass_hash,email_verified,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')->execute([$id, $email, $name, $phone, '', null, $hash, 0, 'active', $now, $now]); }
            cust_send_verify(cust_by('email', $email), $return, true);
        }
        json_out(['ok' => true, 'message' => "Check your inbox: we sent a confirmation link to $email. Open it to activate your account."]);
    }

    if ($r === '/verify' && $method === 'GET') {
        $return = cust_return_path($_GET['return'] ?? '');
        cust_throttle('verify:' . cust_ip(), 30, 600);
        $raw = $_GET['token'] ?? null;
        $t = cust_peek_token($raw, 'verify');
        if (!$t) cust_redirect('/satin' . cust_page_lang($return) . '/login/?error=link');
        $bind = (string)($_COOKIE[CUST_SIGNUP_COOKIE] ?? '');
        if ($t['bind_hash'] === '' || $bind === '' || !hash_equals($t['bind_hash'], thash($bind)))  // another browser: confirm with the password
            cust_redirect('/satin' . cust_page_lang($return) . '/login/?verify=' . rawurlencode((string)$raw) . ($return !== '/satin/account/' ? '&return=' . rawurlencode($return) : ''));
        $t = cust_use_token($raw, 'verify');
        $c = $t ? cust_by('id', $t['customer_id']) : null;
        if (!$c || $c['status'] !== 'active') cust_redirect('/satin' . cust_page_lang($return) . '/login/?error=link');
        $pdo->prepare('UPDATE customer_accounts SET email_verified = 1, updated_at = ? WHERE id = ?')->execute([now_iso(), $c['id']]);
        cust_cookie(CUST_SIGNUP_COOKIE, '', time() - 3600, true, '/api/customer/');
        cust_start_session($c, 'email');
        cust_redirect($return . (str_contains($return, '?') ? '&' : '?') . 'welcome=1');
    }
    if ($r === '/verify' && $method === 'POST') {
        $v = body_json(2000);
        cust_throttle('verifypw:' . cust_ip(), 10, 900, 'Too many attempts. Try again in 15 minutes.');
        $t = cust_peek_token($v['token'] ?? null, 'verify');
        $c = $t ? cust_by('id', $t['customer_id']) : null;
        if (!$c || $c['status'] !== 'active') json_out(['error' => 'This confirmation link is invalid or has expired. Sign in to get a new one.'], 400);
        cust_throttle('verifypw:' . $c['id'], 6, 900, 'Too many attempts. Try again in 15 minutes.');
        $pass = is_string($v['password'] ?? null) ? $v['password'] : '';
        if ($c['pass_hash'] === '' || !password_verify($pass, $c['pass_hash'])) json_out(['error' => 'That password is not correct. Enter the password you chose when you signed up, or reset it.'], 401);
        if (!cust_use_token($v['token'], 'verify')) json_out(['error' => 'This confirmation link was already used.'], 400);
        $pdo->prepare('UPDATE customer_accounts SET email_verified = 1, updated_at = ? WHERE id = ?')->execute([now_iso(), $c['id']]);
        $s = cust_start_session($c, 'email');
        json_out(['ok' => true, 'csrf' => $s['csrf']]);
    }

    if ($r === '/resend' && $method === 'POST') {
        $v = body_json(1000); $email = cust_email($v['email'] ?? '');
        cust_throttle('resend:' . cust_ip(), 10, 3600);
        if ($email !== '' && !rate_limited('cust:resendmail:' . $email, 3, 3600)) {
            note_attempt('cust:resendmail:' . $email);
            $c = cust_by('email', $email);
            if ($c && !(int)$c['email_verified'] && $c['status'] === 'active') cust_send_verify($c);
        }
        json_out(['ok' => true, 'message' => 'If that address has an account waiting for confirmation, we sent a new link.']);
    }

    if ($r === '/login' && $method === 'POST') {
        $v = body_json(4000);
        $email = cust_email($v['email'] ?? ''); $pass = is_string($v['password'] ?? null) ? $v['password'] : '';
        if (rate_limited('cust:login:' . cust_ip(), 20, 900) || rate_limited('cust:login:' . $email, 8, 900)) json_out(['error' => 'Too many sign-in attempts. Try again in 15 minutes, or reset your password.'], 429);
        $c = $email !== '' ? cust_by('email', $email) : null;
        $ok = $c && $c['pass_hash'] !== '' && password_verify($pass, $c['pass_hash']);
        if (!$c || $c['pass_hash'] === '') password_hash($pass, PASSWORD_DEFAULT); // similar timing for unknown e-mails
        if (!$ok || $c['status'] !== 'active') {
            note_attempt('cust:login:' . cust_ip()); note_attempt('cust:login:' . $email);
            json_out(['error' => 'Email or password is not correct.'], 401);
        }
        if (!(int)$c['email_verified']) {
            if (!rate_limited('cust:resendmail:' . $email, 3, 3600)) { note_attempt('cust:resendmail:' . $email); cust_send_verify($c, cust_return_path($v['return'] ?? ''), true); }
            json_out(['error' => 'Please confirm your email address first. We sent you a new confirmation link.', 'unverified' => true], 403);
        }
        if (password_needs_rehash($c['pass_hash'], PASSWORD_DEFAULT)) $pdo->prepare('UPDATE customer_accounts SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $c['id']]);
        $s = cust_start_session($c, 'password');
        json_out(['ok' => true, 'csrf' => $s['csrf'], 'customer' => cust_public(cust_by('id', $c['id']))]);
    }

    if ($r === '/logout' && $method === 'POST') {
        $c = cust_current();
        if ($c) { same_origin(); if (!hash_equals($c['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_out(['error' => 'Reload the page and try again.'], 403); }
        cust_end_session();
        json_out(['ok' => true]);
    }

    if ($r === '/forgot' && $method === 'POST') {
        $v = body_json(1000); $email = cust_email($v['email'] ?? '');
        cust_throttle('forgot:' . cust_ip(), 10, 3600);
        if ($email !== '' && !rate_limited('cust:forgotmail:' . $email, 3, 3600)) {
            note_attempt('cust:forgotmail:' . $email);
            $c = cust_by('email', $email);
            if ($c && $c['status'] === 'active') {
                $t = cust_new_token($c['id'], 'reset', CUST_RESET_HOURS);
                cust_mail($email, 'Reset your Satin Graphic password', "Hello {$c['name']},\n\nUse this link within 1 hour to choose a new password:\n\n" . cust_base() . "/satin/login/?reset=$t\n\nThe link works once. If you did not ask for this, ignore this email — your password stays the same.");
            }
        }
        json_out(['ok' => true, 'message' => 'If an account exists for that address, we emailed a link to reset the password. It expires in 1 hour.']);
    }

    if ($r === '/reset' && $method === 'POST') {
        $v = body_json(2000);
        cust_throttle('reset:' . cust_ip(), 20, 3600);
        $pass = is_string($v['password'] ?? null) ? $v['password'] : '';
        if ($err = valid_password($pass)) json_out(['error' => $err], 400);
        $t = cust_use_token($v['token'] ?? null, 'reset');
        $c = $t ? cust_by('id', $t['customer_id']) : null;
        if (!$c || $c['status'] !== 'active') json_out(['error' => 'This reset link is invalid or has expired. Request a new one.'], 400);
        $pdo->prepare('UPDATE customer_accounts SET pass_hash = ?, email_verified = 1, updated_at = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), now_iso(), $c['id']]);
        $pdo->prepare('DELETE FROM customer_sessions WHERE customer_id = ?')->execute([$c['id']]); // sign out everywhere
        $pdo->prepare("DELETE FROM customer_tokens WHERE customer_id = ? AND purpose = 'reset'")->execute([$c['id']]);
        $s = cust_start_session($c, 'password');
        json_out(['ok' => true, 'csrf' => $s['csrf']]);
    }

    if (preg_match('#^/oauth/(google|facebook)/(start|callback)$#', $r, $m) && $method === 'GET') {
        if ($m[2] === 'start') cust_oauth_start($m[1]);
        cust_oauth_callback($m[1]);
    }

    // ---------- signed-in customer ----------
    $c = cust_require();

    // ---------- cart shared across devices (cart-sync.mjs). PUT (or POST, for hosts that block PUT) needs X-CSRF-Token. ----------
    if ($r === '/cart' && $method === 'GET') {
        require_once __DIR__ . '/commerce.php';
        cust_throttle('cartget:' . $c['id'], 600, 3600);
        $sid = cust_shop_session()['id']; // the artwork of the cart is copied into this browser's own (new if needed) artwork session
        json_out(['customer' => $c['id'], 'csrf' => $c['csrf']] + cust_cart_for_session($c, $sid));
    }
    if ($r === '/cart' && ($method === 'PUT' || $method === 'POST')) {
        require_once __DIR__ . '/commerce.php';
        cust_throttle('cartput:' . $c['id'], 600, 3600);
        $v = body_json(400000);
        $items = $v['items'] ?? null;
        if (!is_array($items) || $items !== array_values($items) || count($items) > CUST_CART_ITEMS) json_out(['error' => 'Your cart can hold up to ' . CUST_CART_ITEMS . ' items.'], 400);
        $seen = [];
        foreach ($items as $i) {
            $id = is_array($i) ? ($i['id'] ?? null) : null;
            if (!(is_string($id) || is_int($id) || is_float($id)) || isset($seen[(string)json_encode($id)])) json_out(['error' => 'Invalid cart item.'], 400);
            $seen[(string)json_encode($id)] = true;
        }
        $prev = cust_cart_load($c['id']);
        if (($v['revision'] ?? null) !== $prev['revision']) json_out(['error' => 'Your cart changed on another device.', 'revision' => $prev['revision']], 409);
        // Artwork counts as the customer's own when this browser's session owns it, it was verified before, or the cart copied it between the customer's sessions.
        $s = shop_session(); $verified = ['file' => [], 'design' => []];
        foreach ($items as $i) foreach (cust_cart_refs($i) as $kind => $ids) foreach ($ids as $id) {
            if (in_array($id, $verified[$kind], true)) continue;
            if (($s && cust_cart_owned($kind, $id, $s['id'])) || in_array($id, $prev['verified'][$kind], true) || cust_cart_known($c['id'], $kind, $id)) $verified[$kind][] = $id;
        }
        $data = json_encode(['items' => $items, 'verified' => $verified], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($data === false || strlen($data) > 400000) json_out(['error' => 'Your cart is too large to save.'], 400);
        $rev = $prev['revision'] + 1;
        if ($prev['exists']) { $q = $pdo->prepare('UPDATE customer_carts SET data = ?, revision = ?, updated_at = ? WHERE customer_id = ? AND revision = ?'); $q->execute([$data, $rev, now_iso(), $c['id'], $prev['revision']]); $ok = $q->rowCount() > 0; }
        else { try { $pdo->prepare('INSERT INTO customer_carts (customer_id,data,revision,updated_at) VALUES (?,?,?,?)')->execute([$c['id'], $data, $rev, now_iso()]); $ok = true; } catch (PDOException $e) { $ok = false; } }
        if (!$ok) json_out(['error' => 'Your cart changed on another device.'], 409);
        json_out(['ok' => true, 'revision' => $rev]);
    }
    // ---------- unpaid orders: cancel, or cancel + remove from My account. Orders are never erased (admin keeps every order). ----------
    if (($r === '/orders/cancel' || $r === '/orders/delete') && $method === 'POST') {
        require_once __DIR__ . '/commerce.php';
        $remove = $r === '/orders/delete';
        $v = body_json(1000);
        cust_throttle('cancel:' . $c['id'], 30, 3600);
        $o = cust_order_owned($c, (string)($v['id'] ?? ''));
        if (!$o) json_out(['error' => 'Order not found.'], 404);
        // A payment may have completed on the provider's page a moment ago: ask the provider first (marks the order paid when it was).
        if ($o['status'] === 'awaiting_payment' && $o['provider_order_id'] !== '') {
            try { if ($o['provider'] === 'square') shop_square_verify($o); elseif ($o['provider'] === 'paypal') shop_paypal_verify($o, false); } catch (Throwable $e) { error_log('satin cancel verify: ' . $e->getMessage()); }
            $o = shop_order($o['id']);
        }
        if (!cust_order_unpaid($o)) json_out(['error' => 'This order is paid or in progress, so it can no longer be cancelled online. Please contact us at info@satingraphic.ca or 905-695-9147.'], 409);
        if (!$remove && !cust_order_cancellable($o)) json_out(['error' => 'This order is already cancelled.'], 409);
        $wasOpen = cust_order_cancellable($o);
        $h = json_decode((string)($o['history'] ?? ''), true) ?: [];
        $h[] = ['at' => now_iso(), 'by' => 'Customer', 'from' => cust_stage($o), 'stage' => 'cancelled', 'note' => $remove ? ($wasOpen ? 'Cancelled by customer and removed from their account (before payment)' : 'Removed from their account by customer') : 'Cancelled by customer (before payment)', 'emailed' => false];
        $q = $pdo->prepare("UPDATE shop_orders SET status = 'cancelled', stage = 'cancelled', customer_hidden = ?, history = ?, updated_at = ? WHERE id = ? AND status IN ('awaiting_payment','cancelled') AND (paid_at IS NULL OR paid_at = '')");
        $q->execute([$remove ? 1 : 0, json_encode(array_slice($h, -200), JSON_UNESCAPED_UNICODE), now_iso(), $o['id']]);
        if (!$q->rowCount()) json_out(['error' => 'This order changed a moment ago. Reload the page and try again.'], 409);
        if ($wasOpen) {
            try { $pdo->prepare('DELETE FROM shop_coupon_uses WHERE order_id = ?')->execute([$o['id']]); } catch (Throwable $e) { } // a discount code used on it can be used again
            try { require_once __DIR__ . '/push.php'; push_event('orders', '✖ Order cancelled ' . $o['number'], $o['name'] . ' · ' . shop_money((int)$o['total']), '/admin/#/orders?id=' . $o['id'], 'order-' . $o['number']); } catch (Throwable $e) { }
            notify_owner("Satin website: order {$o['number']} cancelled by the customer",
                "The customer cancelled unpaid online order {$o['number']} from My account" . ($remove ? ' and removed it from their order list' : '') . ". No payment had been received. The order is kept in admin as Cancelled.\n\nCustomer: {$o['name']} <{$o['email']}> {$o['phone']}\n\n" . shop_order_text($o) . "\n\nOpen in admin: " . site_url() . '/admin/#/orders?id=' . $o['id']);
            cust_mail($o['email'] !== '' ? $o['email'] : $c['email'], "Your Satin Graphic order {$o['number']} was cancelled",
                "Hello {$o['name']},\n\nAs you asked, we cancelled your order {$o['number']}. No payment was taken" . ($o['payment_url'] !== '' ? ' and the payment link no longer applies to this order' : '') . ".\n\nIf this was a mistake, reply to this email or place the order again from our website.");
        }
        json_out(['ok' => true, 'order' => $remove ? null : cust_order_detail(shop_order($o['id']))]);
    }

    if ($r === '/overview' && $method === 'GET') {
        $orders = [];
        if (cust_has_orders_table()) { [$w, $p] = cust_order_filter($c); $q = $pdo->prepare("SELECT * FROM shop_orders WHERE $w ORDER BY created_at DESC LIMIT 200"); $q->execute($p); $orders = array_map('cust_order_summary', $q->fetchAll()); }
        json_out(['customer' => cust_public($c), 'orders' => $orders, 'invoices' => cust_invoices($c), 'requests' => cust_requests($c),
            'stages' => ['new' => 'Received', 'artwork_check' => 'Artwork check', 'in_production' => 'In production', 'ready' => 'Ready', 'completed' => 'Completed', 'cancelled' => 'Cancelled']]);
    }
    if ($r === '/order' && $method === 'GET') {
        $o = cust_order_owned($c, (string)($_GET['id'] ?? ''));
        if (!$o) json_out(['error' => 'Order not found.'], 404);
        json_out(['order' => cust_order_detail($o)]);
    }
    if ($r === '/file' && $method === 'GET') cust_order_file($c);
    if ($r === '/reorder' && $method === 'POST') {
        $v = body_json(1000);
        cust_throttle('reorder:' . $c['id'], 20, 3600);
        $o = cust_order_owned($c, (string)($v['id'] ?? ''));
        if (!$o) json_out(['error' => 'Order not found.'], 404);
        try { $res = cust_reorder($o); } catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
        if (!$res['added'] && $res['already']) json_out(['ok' => true] + $res);
        if (!$res['added']) json_out(['error' => 'These items cannot be re-ordered online' . ($res['skipped'] ? ': ' . implode(', ', $res['skipped']) : '') . '. Contact us for a quote.'] + $res, 409);
        json_out(['ok' => true] + $res);
    }
    // ---------- Design Studio: saved designs (only the owner's; files only when the design refers to them) ----------
    if ($r === '/designs' && $method === 'GET') {
        require_once __DIR__ . '/commerce.php';
        $q = shop_db()->prepare('SELECT * FROM shop_designs WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 100'); $q->execute([$c['id']]);
        json_out(['designs' => array_map('cust_design_summary', $q->fetchAll())]);
    }
    if ($r === '/designs/save' && $method === 'POST') {
        require_once __DIR__ . '/commerce.php';
        $v = body_json(4200000);
        cust_throttle('designsave:' . $c['id'], 120, 3600);
        $s = shop_session(); $id = (string)($v['id'] ?? '');
        $q = shop_db()->prepare('SELECT session_id, customer_id FROM shop_designs WHERE id = ?'); $q->execute([$id]); $row = $q->fetch();
        if (!$s || !$row || !hash_equals((string)$row['session_id'], $s['id']) || ($row['customer_id'] !== '' && !hash_equals((string)$row['customer_id'], $c['id']))) json_out(['error' => 'Save the design in Design Studio first.'], 404);
        $thumb = null;
        if (is_string($v['thumb'] ?? null) && $v['thumb'] !== '') {
            try { $bin = shop_png_data($v['thumb'], 'mockup'); $sz = getimagesizefromstring($bin); $thumb = shop_store_bytes($bin, 'generated', $s['id'], 'design-mockup.png', 'image/png', (int)$sz[0], (int)$sz[1])['id']; }
            catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
        }
        if ($thumb) shop_db()->prepare('UPDATE shop_designs SET customer_id = ?, thumb_id = ? WHERE id = ?')->execute([$c['id'], $thumb, $id]);
        else shop_db()->prepare('UPDATE shop_designs SET customer_id = ? WHERE id = ?')->execute([$c['id'], $id]);
        json_out(['ok' => true, 'id' => $id]);
    }
    if ($r === '/designs/delete' && $method === 'POST') {
        $v = body_json(1000); $row = cust_design_row($c, (string)($v['id'] ?? ''));
        if (!$row) json_out(['error' => 'Design not found.'], 404);
        shop_db()->prepare('DELETE FROM shop_designs WHERE id = ? AND customer_id = ?')->execute([$row['id'], $c['id']]);
        json_out(['ok' => true]);
    }
    if ($r === '/designs/open' && $method === 'POST') {
        $v = body_json(1000); $row = cust_design_row($c, (string)($v['id'] ?? ''));
        if (!$row) json_out(['error' => 'Design not found.'], 404);
        cust_throttle('designopen:' . $c['id'], 60, 3600);
        try { json_out(['ok' => true] + cust_open_design($row)); } catch (ShopError $e) { json_out(['error' => $e->getMessage()], 400); }
    }
    if ($r === '/design-file' && $method === 'GET') {
        $row = cust_design_row($c, (string)($_GET['design'] ?? '')); $fid = (string)($_GET['id'] ?? '');
        $ok = $row && ($fid === (string)$row['thumb_id'] || in_array($fid, cust_design_file_ids(json_decode((string)$row['design'], true) ?: []), true));
        $f = $ok ? shop_file($fid) : null;
        if (!$f || !in_array($f['kind'], ['upload', 'generated'], true)) json_out(['error' => 'File not found.'], 404);
        shop_send_file($f, ($_GET['inline'] ?? '') === '1');
    }
    if ($r === '/profile' && $method === 'POST') {
        $v = body_json(6000);
        $name = cust_valid_name($v['name'] ?? '');
        if ($name === '') json_out(['error' => 'Enter your name.'], 400);
        $phone = text($v['phone'] ?? '', 40);
        if ($phone !== '' && !preg_match('/^[0-9 +().-]{7,40}$/', $phone)) json_out(['error' => 'Enter a valid phone number.'], 400);
        $addr = cust_clean_address($v['address'] ?? []);
        $pdo->prepare('UPDATE customer_accounts SET name = ?, phone = ?, company = ?, address = ?, updated_at = ? WHERE id = ?')
            ->execute([$name, $phone, text($v['company'] ?? '', 160), json_encode($addr, JSON_UNESCAPED_UNICODE), now_iso(), $c['id']]);
        json_out(['ok' => true, 'customer' => cust_public(cust_by('id', $c['id']))]);
    }
    if ($r === '/delete-account' && $method === 'POST') {   // required by Apple 5.1.1(v) and Google Play account deletion rules
        $v = body_json(2000);
        cust_throttle('delete:' . $c['id'], 5, 3600);
        if (strtoupper(trim((string)($v['confirm'] ?? ''))) !== 'DELETE') json_out(['error' => 'Type DELETE to confirm.'], 400);
        if ($c['pass_hash'] !== '' && !password_verify(is_string($v['password'] ?? null) ? $v['password'] : '', $c['pass_hash'])) json_out(['error' => 'Your password is not correct.'], 400);
        $id = $c['id']; $email = $c['email']; $name = $c['name'];
        try { shop_db()->prepare('DELETE FROM shop_designs WHERE customer_id = ? OR customer_id = ?')->execute([$id, 'cart:' . $id]); } catch (Throwable $e) { }
        foreach (['customer_carts', 'customer_cart_copies'] as $tb) { try { $pdo->prepare("DELETE FROM $tb WHERE customer_id = ?")->execute([$id]); } catch (Throwable $e) { } }
        // orders and invoices are kept for tax records but no longer linked to a login
        try { shop_db()->prepare("UPDATE shop_orders SET customer_id = '' WHERE customer_id = ?")->execute([$id]); } catch (Throwable $e) { }
        foreach (['customer_sessions', 'customer_tokens'] as $tb) $pdo->prepare("DELETE FROM $tb WHERE customer_id = ?")->execute([$id]);
        $pdo->prepare('DELETE FROM customer_accounts WHERE id = ?')->execute([$id]);
        cust_end_session();
        cust_mail($email, 'Your Satin Graphic account was deleted', "Hello $name,\n\nYour Satin Graphic account and saved designs were deleted as you asked. Records of past orders and invoices are kept as required for tax purposes. Questions: info@satingraphic.ca");
        json_out(['ok' => true]);
    }
    if ($r === '/password' && $method === 'POST') {
        $v = body_json(2000);
        cust_throttle('password:' . $c['id'], 10, 900);
        $new = is_string($v['password'] ?? null) ? $v['password'] : '';
        if ($c['pass_hash'] !== '' && !password_verify(is_string($v['current'] ?? null) ? $v['current'] : '', $c['pass_hash'])) json_out(['error' => 'Your current password is not correct.'], 400);
        if ($err = valid_password($new)) json_out(['error' => $err], 400);
        $pdo->prepare('UPDATE customer_accounts SET pass_hash = ?, updated_at = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), now_iso(), $c['id']]);
        $pdo->prepare('DELETE FROM customer_sessions WHERE customer_id = ?')->execute([$c['id']]); // other devices are signed out
        $s = cust_start_session($c, 'password');
        cust_mail($c['email'], 'Your Satin Graphic password was changed', "Hello {$c['name']},\n\nThe password of your Satin Graphic account was just changed. If this wasn't you, reset it now: " . cust_base() . "/satin/login/?forgot=1");
        json_out(['ok' => true, 'csrf' => $s['csrf'], 'customer' => cust_public(cust_by('id', $c['id']))]);
    }
    json_out(['error' => 'Not found'], 404);
}

/* ---------------- admin routes: /api/admin/customer-login, /api/admin/customer-accounts ---------------- */
function customer_admin_route(string $r, string $method): void {
    $pdo = cust_db();
    if ($r === '/customer-login' && $method === 'GET') { require_user('settings.edit'); json_out(['settings' => cust_settings_public()]); }
    if ($r === '/customer-login' && $method === 'POST') {
        $u = require_user('settings.edit');
        $v = body_json(8000); $c = cust_settings();
        $gid = trim((string)($v['googleClientId'] ?? $c['google']['clientId'])); $fid = trim((string)($v['facebookAppId'] ?? $c['facebook']['appId']));
        if ($gid !== '' && !preg_match('/^[0-9]{3,30}-[a-z0-9]{10,64}\.apps\.googleusercontent\.com$/', $gid)) json_out(['error' => 'The Google Client ID should look like 1234567890-abc…xyz.apps.googleusercontent.com'], 400);
        if ($fid !== '' && !preg_match('/^\d{5,25}$/', $fid)) json_out(['error' => 'The Facebook App ID is a number (e.g. 1234567890123456).'], 400);
        $gs = $c['google']['clientSecret']; $fs = $c['facebook']['appSecret'];
        if (is_string($v['googleClientSecret'] ?? null) && trim($v['googleClientSecret']) !== '') { $gs = trim($v['googleClientSecret']); if (!preg_match('/^[A-Za-z0-9_-]{10,100}$/', $gs)) json_out(['error' => 'The Google client secret does not look right. Copy it again from Google Cloud Console.'], 400); }
        if (is_string($v['facebookAppSecret'] ?? null) && trim($v['facebookAppSecret']) !== '') { $fs = trim($v['facebookAppSecret']); if (!preg_match('/^[a-f0-9]{32}$/i', $fs)) json_out(['error' => 'The Facebook App Secret is 32 letters and numbers. Copy it again from Meta for Developers.'], 400); }
        if (($v['clearGoogle'] ?? false) === true) $gs = '';
        if (($v['clearFacebook'] ?? false) === true) $fs = '';
        cust_settings_save(['google' => ['clientId' => $gid, 'clientSecret' => $gs, 'enabled' => ($v['googleEnabled'] ?? $c['google']['enabled']) !== false],
            'facebook' => ['appId' => $fid, 'appSecret' => $fs, 'enabled' => ($v['facebookEnabled'] ?? $c['facebook']['enabled']) !== false],
            'emailEnabled' => ($v['emailEnabled'] ?? $c['emailEnabled']) !== false, 'updatedAt' => now_iso(), 'updatedBy' => $u['name']]);
        audit($u, 'customer login settings', 'Google ' . ($gid !== '' ? 'set' : 'empty') . ($gs !== $c['google']['clientSecret'] ? ' (secret changed)' : '') . ', Facebook ' . ($fid !== '' ? 'set' : 'empty') . ($fs !== $c['facebook']['appSecret'] ? ' (secret changed)' : ''));
        json_out(['ok' => true, 'settings' => cust_settings_public()]);
    }
    if ($r === '/customer-accounts' && $method === 'GET') {
        require_user('invoices.view');
        $rows = $pdo->query('SELECT id, email, name, phone, company, address, pass_hash, email_verified, google_sub, facebook_id, status, created_at, last_login, last_method FROM customer_accounts ORDER BY created_at DESC LIMIT 2000')->fetchAll();
        $counts = [];
        if (cust_has_orders_table()) foreach ($pdo->query("SELECT lower(email) e, customer_id, COUNT(*) n FROM shop_orders GROUP BY lower(email), customer_id")->fetchAll() as $o) { $counts['e:' . $o['e']] = ($counts['e:' . $o['e']] ?? 0) + (int)$o['n']; if ($o['customer_id'] !== '') $counts['c:' . $o['customer_id']] = ($counts['c:' . $o['customer_id']] ?? 0) + (int)$o['n']; }
        json_out(['accounts' => array_map(fn($a) => ['id' => $a['id'], 'email' => $a['email'], 'name' => $a['name'], 'phone' => $a['phone'], 'company' => $a['company'], 'address' => (is_array($ad = json_decode((string)($a['address'] ?? ''), true)) ? $ad : null), 'verified' => (bool)(int)$a['email_verified'],
            'methods' => array_values(array_filter([$a['pass_hash'] !== '' ? 'email' : null, (string)$a['google_sub'] !== '' ? 'google' : null, (string)$a['facebook_id'] !== '' ? 'facebook' : null])),
            'status' => $a['status'], 'createdAt' => $a['created_at'], 'lastLogin' => $a['last_login'], 'lastMethod' => $a['last_method'],
            'orders' => max($counts['c:' . $a['id']] ?? 0, (int)$a['email_verified'] ? ($counts['e:' . strtolower($a['email'])] ?? 0) : 0)], $rows)]);
    }
    if ($r === '/customer-accounts/map' && $method === 'GET') {
        require_user('invoices.view');
        $map = [];
        foreach ($pdo->query("SELECT email, pass_hash, email_verified, google_sub, facebook_id, status FROM customer_accounts")->fetchAll() as $a)
            $map[strtolower($a['email'])] = ['verified' => (bool)(int)$a['email_verified'], 'active' => $a['status'] === 'active',
                'methods' => array_values(array_filter([$a['pass_hash'] !== '' ? 'email' : null, (string)$a['google_sub'] !== '' ? 'google' : null, (string)$a['facebook_id'] !== '' ? 'facebook' : null]))];
        json_out(['accounts' => (object)$map]);
    }
    if ($r === '/customer-accounts/status' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(1000);
        $a = cust_by('id', (string)($v['id'] ?? ''));
        if (!$a) json_out(['error' => 'Account not found'], 404);
        $st = ($v['status'] ?? '') === 'disabled' ? 'disabled' : 'active';
        $pdo->prepare('UPDATE customer_accounts SET status = ?, updated_at = ? WHERE id = ?')->execute([$st, now_iso(), $a['id']]);
        if ($st === 'disabled') $pdo->prepare('DELETE FROM customer_sessions WHERE customer_id = ?')->execute([$a['id']]);
        audit($u, 'customer account ' . $st, $a['email']);
        json_out(['ok' => true]);
    }
    json_out(['error' => 'Not found'], 404);
}
