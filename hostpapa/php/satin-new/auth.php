<?php
declare(strict_types=1);
// Members, roles, sessions and permissions for the Satin admin.

const PERMISSIONS = [
    'dashboard.view'   => 'View dashboard',
    'requests.view'    => 'View quote & booking requests',
    'requests.edit'    => 'Change request status and notes',
    'requests.export'  => 'Export requests (CSV)',
    'invoices.view'    => 'View invoices, payments and customers',
    'invoices.edit'    => 'Create, send and edit invoices',
    'site.edit'        => 'Edit website content (editor)',
    'site.publish'     => 'Publish website changes',
    'pricing.edit'     => 'Edit prices, formulas, forms and vehicle templates',
    'orders.view'      => 'View online orders and artwork files',
    'orders.edit'      => 'Update online orders and send payment links',
    'payments.manage'  => 'Edit payment (Square) settings',
    'chat.view'        => 'View website live chats and visitor details',
    'chat.reply'       => 'Reply to, close and reopen website chats',
    'chat.manage'      => 'Edit chat knowledge base and chat settings (incl. AI key)',
    'agreements.view'  => 'View e-sign agreements and signed PDFs',
    'agreements.send'  => 'Create agreement templates and send documents for signature',
    'settings.edit'    => 'Edit business settings',
    'members.manage'   => 'Manage members and roles',
    'audit.view'       => 'View activity log',
];

const SYSTEM_ROLES = [
    'owner'     => ['name' => 'Owner', 'description' => 'Full access. Cannot be removed.', 'permissions' => ['*']],
    'admin'     => ['name' => 'Site admin', 'description' => 'Runs the business side and the website.', 'permissions' => ['dashboard.view', 'requests.view', 'requests.edit', 'requests.export', 'orders.view', 'orders.edit', 'invoices.view', 'invoices.edit', 'agreements.view', 'agreements.send', 'site.edit', 'site.publish', 'pricing.edit', 'settings.edit', 'audit.view', 'chat.view', 'chat.reply']],
    'developer' => ['name' => 'Developer', 'description' => 'Works on the website, prices and forms. No customer data.', 'permissions' => ['dashboard.view', 'site.edit', 'site.publish', 'pricing.edit', 'settings.edit']],
    'editor'    => ['name' => 'Content editor', 'description' => 'Edits website content. Publishing needs approval.', 'permissions' => ['dashboard.view', 'site.edit']],
    'sales'     => ['name' => 'Sales', 'description' => 'Handles quote and booking requests, online orders, invoices and live chat.', 'permissions' => ['dashboard.view', 'requests.view', 'requests.edit', 'requests.export', 'orders.view', 'orders.edit', 'invoices.view', 'invoices.edit', 'agreements.view', 'agreements.send', 'chat.view', 'chat.reply']],
];

const SESSION_COOKIE = 'satin_admin';
const SESSION_DAYS = 14;

function migrate_admin(PDO $pdo): void {
    static $done = false; if ($done) return; $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, pass_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'active\', created_at TEXT NOT NULL, last_login TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', permissions TEXT NOT NULL, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, ip TEXT, agent TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_invites (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL DEFAULT \'\', role TEXT NOT NULL, purpose TEXT NOT NULL DEFAULT \'invite\', created_by TEXT, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at TEXT)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_attempts (k TEXT NOT NULL, at INTEGER NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_name TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT, created_at TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS request_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL, user_name TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)');
}

function adb(): PDO { $pdo = db(); migrate_admin($pdo); return $pdo; }

function uuid(): string { $b = random_bytes(16); $b[6] = chr((ord($b[6]) & 0x0f) | 0x40); $b[8] = chr((ord($b[8]) & 0x3f) | 0x80); return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4)); }
function token(): string { return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '='); }
function thash(string $t): string { return hash('sha256', $t); }
function client_ip(): string { return substr((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }

function all_roles(): array {
    $roles = [];
    foreach (SYSTEM_ROLES as $id => $r) $roles[$id] = $r + ['id' => $id, 'system' => true];
    foreach (adb()->query('SELECT * FROM admin_roles ORDER BY name')->fetchAll() as $r)
        $roles[$r['id']] = ['id' => $r['id'], 'name' => $r['name'], 'description' => $r['description'], 'permissions' => json_decode($r['permissions'], true) ?: [], 'system' => false];
    return $roles;
}

function role_permissions(string $role): array {
    $roles = all_roles();
    $p = $roles[$role]['permissions'] ?? [];
    return in_array('*', $p, true) ? array_keys(PERMISSIONS) : array_values(array_intersect($p, array_keys(PERMISSIONS)));
}

function audit(?array $user, string $action, string $detail = ''): void {
    adb()->prepare('INSERT INTO admin_audit (user_id,user_name,action,detail,ip,created_at) VALUES (?,?,?,?,?,?)')
        ->execute([$user['id'] ?? null, $user['name'] ?? 'system', $action, mb_substr($detail, 0, 500), client_ip(), now_iso()]);
}

function rate_limited(string $key, int $max, int $window): bool {
    $pdo = adb(); $now = time();
    $pdo->prepare('DELETE FROM admin_attempts WHERE at < ?')->execute([$now - 86400]);
    $q = $pdo->prepare('SELECT COUNT(*) n FROM admin_attempts WHERE k = ? AND at > ?'); $q->execute([$key, $now - $window]);
    return (int)$q->fetch()['n'] >= $max;
}
function note_attempt(string $key): void { adb()->prepare('INSERT INTO admin_attempts (k,at) VALUES (?,?)')->execute([$key, time()]); }

function set_session_cookie(string $value, int $expires): void {
    setcookie(SESSION_COOKIE, $value, ['expires' => $expires, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https', 'httponly' => true, 'samesite' => 'Strict']);
}

function start_session(array $user): array {
    $t = token(); $csrf = token(); $exp = time() + SESSION_DAYS * 86400;
    adb()->prepare('INSERT INTO admin_sessions (token_hash,user_id,csrf,created_at,expires_at,ip,agent) VALUES (?,?,?,?,?,?,?)')
        ->execute([thash($t), $user['id'], $csrf, now_iso(), $exp, client_ip(), mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200)]);
    adb()->prepare('UPDATE admin_users SET last_login = ? WHERE id = ?')->execute([now_iso(), $user['id']]);
    set_session_cookie($t, $exp);
    return ['csrf' => $csrf];
}

function current_user(): ?array {
    static $cache = false;
    if ($cache !== false) return $cache;
    $t = $_COOKIE[SESSION_COOKIE] ?? '';
    if (!is_string($t) || strlen($t) < 20) return $cache = null;
    $q = adb()->prepare('SELECT s.csrf, s.token_hash, u.* FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = \'active\'');
    $q->execute([thash($t), time()]);
    $u = $q->fetch();
    if (!$u) return $cache = null;
    unset($u['pass_hash']);
    $u['permissions'] = role_permissions($u['role']);
    return $cache = $u;
}

function require_user(?string $perm = null): array {
    $u = current_user();
    if (!$u) json_out(['error' => 'Please sign in.', 'signin' => true], 401);
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        same_origin();
        if (!hash_equals($u['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_out(['error' => 'Session expired. Reload the page.'], 403);
    }
    if ($perm && !in_array($perm, $u['permissions'], true)) json_out(['error' => 'You do not have permission for this.'], 403);
    return $u;
}

function public_user(array $u): array {
    return ['id' => $u['id'], 'email' => $u['email'], 'name' => $u['name'], 'role' => $u['role'], 'status' => $u['status'] ?? 'active', 'lastLogin' => $u['last_login'] ?? null, 'createdAt' => $u['created_at'] ?? null];
}

function valid_password(string $p): ?string {
    if (strlen($p) < 10) return 'Use at least 10 characters.';
    if (strlen($p) > 200) return 'Password is too long.';
    if (!preg_match('/[A-Za-z]/', $p) || !preg_match('/\d/', $p)) return 'Use letters and numbers.';
    return null;
}

function site_url(): string { return 'https://' . ($_SERVER['HTTP_HOST'] ?? 'new.satingraphic.ca'); }

function send_mail(string $to, string $subject, string $body): bool {
    return mail_out($to, $subject, $body);
}

function create_link(string $email, string $name, string $role, string $purpose, ?array $by, int $hours): string {
    $t = token();
    adb()->prepare('INSERT INTO admin_invites (token_hash,email,name,role,purpose,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([thash($t), $email, $name, $role, $purpose, $by['id'] ?? null, now_iso(), time() + $hours * 3600]);
    return site_url() . '/admin/#/' . ($purpose === 'reset' ? 'reset' : 'join') . '/' . $t;
}
