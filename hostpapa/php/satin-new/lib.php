<?php
declare(strict_types=1);

const DATA = __DIR__ . '/data';

require_once __DIR__ . '/mailer.php';

function cfg(string $k, $d = null) {
    static $c = null;
    if ($c === null) $c = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : [];
    return $c[$k] ?? $d;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $dsn = cfg('db_dsn') ?: 'mysql:host=' . cfg('db_host', 'localhost') . ';dbname=' . cfg('db_name') . ';charset=utf8mb4';
    $pdo = new PDO($dsn, cfg('db_user'), cfg('db_pass'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void {
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('PRAGMA busy_timeout=5000'); $pdo->exec('PRAGMA journal_mode=WAL');
        $pdo->exec('CREATE TABLE IF NOT EXISTS service_requests (id TEXT PRIMARY KEY, type TEXT, service TEXT, name TEXT, email TEXT, phone TEXT, preferred_date TEXT, preferred_time TEXT, details TEXT, status TEXT, created_at TEXT, consent_at TEXT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS site_settings (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT)');
        $pdo->exec('CREATE TABLE IF NOT EXISTS product_reviews (id TEXT PRIMARY KEY, product_id TEXT, user_id TEXT, name TEXT, rating INT, body TEXT, created_at TEXT)');
        return;
    }
    $pdo->exec('CREATE TABLE IF NOT EXISTS service_requests (
        id CHAR(36) PRIMARY KEY, type VARCHAR(20) NOT NULL, service VARCHAR(120) NOT NULL, name VARCHAR(120) NOT NULL,
        email VARCHAR(254) NOT NULL, phone VARCHAR(40) NOT NULL, preferred_date VARCHAR(10) NOT NULL DEFAULT "", preferred_time VARCHAR(5) NOT NULL DEFAULT "",
        details MEDIUMTEXT NOT NULL, status VARCHAR(40) NOT NULL, created_at VARCHAR(30) NOT NULL, consent_at VARCHAR(30) NOT NULL,
        INDEX idx_email_created (email, created_at), INDEX idx_booking (type, preferred_date, status)
    ) DEFAULT CHARSET=utf8mb4');
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_settings (k VARCHAR(190) PRIMARY KEY, v MEDIUMTEXT NOT NULL, updated_at VARCHAR(30) NOT NULL) DEFAULT CHARSET=utf8mb4');
    $pdo->exec('CREATE TABLE IF NOT EXISTS product_reviews (id CHAR(36) PRIMARY KEY, product_id VARCHAR(80) NOT NULL, user_id VARCHAR(80) NOT NULL, name VARCHAR(120) NOT NULL, rating INT NOT NULL, body TEXT NOT NULL, created_at VARCHAR(30) NOT NULL, INDEX idx_product (product_id)) DEFAULT CHARSET=utf8mb4');
}

function json_out($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function data_file(string $name, int $maxAge = 300): void {
    $f = DATA . '/' . $name;
    if (!is_file($f)) json_out(['error' => 'Not found'], 404);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . $maxAge);
    readfile($f);
    exit;
}

function text($v, int $max): string { return is_string($v) ? mb_substr(trim($v), 0, $max) : ''; }

function now_iso(): string { return gmdate('Y-m-d\TH:i:s.v\Z'); }

function body_json(int $limit = 64000): array {
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) json_out(['error' => 'Use JSON'], 415);
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if (strlen((string)$raw) > $limit) json_out(['error' => 'Request too large'], 413);
    $v = json_decode((string)$raw, true);
    if (!is_array($v) || array_is_list($v) && $v !== []) json_out(['error' => 'Invalid request'], 400);
    return $v;
}

function same_origin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '' || !in_array($origin, ['https://' . $host, 'http://' . $host], true)) json_out(['error' => 'Invalid request origin'], 403);
}

function clean_custom($value): array {
    if (!is_array($value) || array_is_list($value)) return [];
    $out = [];
    foreach (array_slice($value, 0, 20, true) as $k => $v) {
        if (preg_match('/^[a-z0-9_-]{1,40}$/', (string)$k) && is_string($v)) $out[$k] = mb_substr($v, 0, 1000);
    }
    return $out;
}

function toronto_today(): string { return (new DateTime('now', new DateTimeZone('America/Toronto')))->format('Y-m-d'); }
function toronto_time(): string { return (new DateTime('now', new DateTimeZone('America/Toronto')))->format('H:i'); }

function notify_owner(string $subject, string $body): void {
    $to = cfg('notify_email');
    if (!$to) return;
    mail_out((string)$to, $subject, $body, null, ['fromName' => 'Satin Website']);
}
