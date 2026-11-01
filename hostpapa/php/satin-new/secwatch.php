<?php
declare(strict_types=1);
/* Security watch: at most once every 12 hours (started by an admin page load, like the inbox check), look over the website files.
 *  - code files (.php .htaccess .js .mjs …) that were added, changed or removed since the last look → one admin notification listing them
 *    (expected after an update; unexpected changes can mean a break-in);
 *  - PHP or other server scripts inside upload folders, and backup / dump / env files in the public folder → urgent notification + email to the owner.
 * The last look is kept in site_settings (secwatch.state / secwatch.base); nothing is ever deleted or changed on disk. */

require_once __DIR__ . '/auth.php'; require_once __DIR__ . '/push.php';

const SECWATCH_EVERY = 43200;
const SECWATCH_CODE = '/\.(php\d?|phtml|phar|htaccess|user\.ini|js|mjs|cgi|pl|py|sh)$/i'; // pages (.html) are rebuilt on every publish, so they are not watched
const SECWATCH_SCRIPT = '/\.(php\d?|phtml|phar|cgi|pl|py|sh|asp|aspx|jsp)$/i';
const SECWATCH_LEFTOVER = '/(\.(bak|orig|old|tmp|swp|sql|sqlite3?|db|env|log)(-\w*|\.\d+|~)?|~|^\.env.*|\.sql\.gz)$/i';
const SECWATCH_SKIP_DIRS = ['.well-known', 'cgi-bin', 'node_modules', '.git'];

function secwatch_later(): void {
    $st = push_setting('secwatch.state') ?: [];
    if (time() - (int)($st['at'] ?? 0) < SECWATCH_EVERY) return;
    push_setting_put('secwatch.state', ['at' => time()] + $st); // claim the run first so parallel page loads do not repeat it
    register_shutdown_function(function () {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request(); elseif (function_exists('litespeed_finish_request')) @litespeed_finish_request();
        try { secwatch_run(); } catch (Throwable $e) { error_log('satin secwatch: ' . $e->getMessage()); }
    });
}

/** Walk one folder: [relative path => "size:mtime"] for code files, plus the lists of risky files. */
function secwatch_scan(string $root, string $prefix, array &$sig, array &$scripts, array &$leftovers, bool $public): void {
    if (!is_dir($root)) return;
    $it = new RecursiveIteratorIterator(new RecursiveCallbackFilterIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        fn($f) => !($f->isDir() && in_array($f->getFilename(), SECWATCH_SKIP_DIRS, true)) && !($f->isDir() && $prefix === 'app/' && $f->getFilename() === 'storage')));
    $n = 0;
    foreach ($it as $f) {
        if (++$n > 200000) break;
        if (!$f->isFile()) continue;
        $rel = $prefix . str_replace('\\', '/', substr($f->getPathname(), strlen($root) + 1));
        $name = $f->getFilename();
        if (preg_match(SECWATCH_CODE, $name) || $name === '.htaccess') $sig[$rel] = $f->getSize() . ':' . $f->getMTime();
        if ($public && preg_match(SECWATCH_LEFTOVER, $name) && !preg_match('#^site/(cms|studio)/uploads/#', $rel)) $leftovers[] = $rel;
        if ($public && preg_match('#/uploads?/#i', '/' . $rel) && preg_match(SECWATCH_SCRIPT, $name)) $scripts[] = $rel;
    }
}

function secwatch_run(bool $force = false): array {
    require_once __DIR__ . '/site_api.php';
    $sig = []; $scripts = []; $leftovers = [];
    secwatch_scan(docroot(), 'site/', $sig, $scripts, $leftovers, true);
    secwatch_scan(__DIR__, 'app/', $sig, $scripts, $leftovers, false);
    $base = push_setting('secwatch.base');
    $added = $changed = $removed = [];
    if (is_array($base)) {
        foreach ($sig as $k => $v) if (!isset($base[$k])) $added[] = $k; elseif ($base[$k] !== $v) $changed[] = $k;
        foreach ($base as $k => $v) if (!isset($sig[$k])) $removed[] = $k;
    }
    push_setting_put('secwatch.base', $sig);
    $report = ['at' => time(), 'files' => count($sig), 'added' => count($added), 'changed' => count($changed), 'removed' => count($removed), 'scripts' => $scripts, 'leftovers' => array_slice($leftovers, 0, 50), 'first' => !is_array($base)];
    push_setting_put('secwatch.state', $report);
    require_once __DIR__ . '/push.php';
    $list = fn(array $a) => implode(', ', array_slice($a, 0, 8)) . (count($a) > 8 ? ' … +' . (count($a) - 8) . ' more' : '');
    if ($scripts || $leftovers) {
        $body = ($scripts ? 'Server scripts inside upload folders (possible break-in): ' . $list($scripts) . '. ' : '') . ($leftovers ? 'Backup or dump files anyone can try to download: ' . $list($leftovers) . '.' : '');
        push_event('security', '🛡 Security warning', $body, '/admin/#/security', 'sec-risk-' . date('Ymd'));
        $owner = (string)cfg('owner_email', '') ?: (string)cfg('notify_email', '');
        if ($owner && $scripts) { require_once __DIR__ . '/auth.php'; send_mail($owner, 'Satin website security warning', "The daily security check found something that needs a look:\n\n$body\n\nOpen the admin → Security for details. If you did not put these files there, ask your developer or host to check the site.\n"); }
    }
    if ($added || $changed || $removed) {
        $parts = [];
        if ($changed) $parts[] = count($changed) . ' changed (' . $list($changed) . ')';
        if ($added) $parts[] = count($added) . ' new (' . $list($added) . ')';
        if ($removed) $parts[] = count($removed) . ' removed';
        push_event('security', '🛡 Website files changed', implode('; ', $parts) . '. Expected after a website update — if nobody updated the site, check it.', '/admin/#/security', 'sec-files-' . date('YmdH'));
    }
    $report['lists'] = ['added' => array_slice($added, 0, 100), 'changed' => array_slice($changed, 0, 100), 'removed' => array_slice($removed, 0, 100)];
    push_setting_put('secwatch.state', $report);
    return $report;
}

/** Admin → Security page data. */
function secwatch_route(string $r, string $method): void {
    $u = require_user('members.manage');
    if ($r === '/security' && $method === 'GET') {
        $pdo = adb();
        $two = $pdo->query('SELECT COUNT(*) n, SUM(CASE WHEN totp_secret IS NOT NULL AND totp_secret <> \'\' THEN 1 ELSE 0 END) on2 FROM admin_users WHERE status = \'active\'')->fetch();
        require_once __DIR__ . '/mailer.php'; $mail = mail_settings();
        json_out(['watch' => push_setting('secwatch.state') ?: null, 'members' => (int)$two['n'], 'members2fa' => (int)$two['on2'],
            'https' => !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https', 'php' => PHP_VERSION, 'smtp' => !empty($mail['host']) && !empty($mail['pass'])]);
    }
    if ($r === '/security/check' && $method === 'POST') {
        if (rate_limited('secwatch:' . $u['id'], 6, 3600)) json_out(['error' => 'Try again later.'], 429);
        note_attempt('secwatch:' . $u['id']);
        json_out(['watch' => secwatch_run(true)]);
    }
    json_out(['error' => 'Not found'], 404);
}
