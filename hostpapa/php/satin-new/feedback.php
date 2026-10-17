<?php
declare(strict_types=1);
// "How did you hear about us?" — the small corner card on the website (satin bundle: feedback widget) and the
// Customer report on the admin home page. Answers are anonymous: no IP is stored, only a per-day session hash
// (same as site_visits) so an answer can be matched to a quote / contact on the same visit.

const FB_CHOICES = ['google' => 'Google search', 'maps' => 'Google Maps', 'ai' => 'AI search (ChatGPT, etc.)', 'instagram' => 'Instagram', 'facebook' => 'Facebook',
    'tiktok' => 'TikTok', 'youtube' => 'YouTube', 'referral' => 'Friend / referral', 'vehicle' => 'Saw our work on a vehicle', 'other' => 'Other'];

function fb_db(): PDO {
    static $done = false;
    $pdo = db();
    if ($done) return $pdo;
    $done = true;
    $pdo->exec('CREATE TABLE IF NOT EXISTS site_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, ts INTEGER NOT NULL, choice TEXT NOT NULL, detail TEXT NOT NULL DEFAULT \'\', session TEXT NOT NULL, path TEXT NOT NULL, device TEXT NOT NULL, lang TEXT NOT NULL)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_fb_day ON site_feedback (day)');
    return $pdo;
}

function feedback_submit(): void {
    $v = json_decode((string)file_get_contents('php://input', false, null, 0, 4000), true);
    if (!is_array($v)) json_out(['error' => 'Invalid request'], 400);
    $choice = (string)($v['choice'] ?? '');
    if (!isset(FB_CHOICES[$choice])) json_out(['error' => 'Invalid choice'], 400);
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    if (preg_match('/bot|crawl|spider|slurp|headless|lighthouse/i', $ua)) json_out(['ok' => true]);
    require_once __DIR__ . '/auth.php';
    $ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
    if (rate_limited('fb:' . $ip, 6, 86400)) json_out(['ok' => true]);
    note_attempt('fb:' . $ip);
    $path = (string)($v['path'] ?? '');
    $path = preg_match('#^/satin(?:/[a-z0-9-]+)*/?$#', $path) ? (rtrim($path, '/') ?: '/satin') : '/satin';
    $session = preg_match('/^[a-f0-9-]{8,40}$/i', (string)($v['id'] ?? '')) ? substr(hash('sha256', $v['id'] . gmdate('Y-m-d')), 0, 16) : 'anon';
    $w = (int)($v['w'] ?? 0);
    $device = $w > 0 ? ($w < 700 ? 'Mobile' : ($w < 1100 ? 'Tablet' : 'Desktop')) : (preg_match('/Mobi|Android|iPhone/i', $ua) ? 'Mobile' : 'Desktop');
    $lang = preg_match('#^/satin/(fa|fr|es)(/|$)#', $path, $m) ? $m[1] : 'en';
    $detail = $choice === 'other' || $choice === 'referral' ? text($v['detail'] ?? '', 140) : '';
    fb_db()->prepare('INSERT INTO site_feedback (day, ts, choice, detail, session, path, device, lang) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([toronto_today(), time(), $choice, $detail, $session, mb_substr($path, 0, 200), $device, $lang]);
    json_out(['ok' => true]);
}

function feedback_report(): void {
    require_user('dashboard.view');
    $days = in_array((int)($_GET['days'] ?? 30), [7, 30, 90, 365, 3650], true) ? (int)$_GET['days'] : 30;
    $today = toronto_today();
    $start = date('Y-m-d', strtotime("$today -" . ($days - 1) . ' days'));
    $prevStart = date('Y-m-d', strtotime("$start -$days days"));
    $pdo = fb_db();
    require_once __DIR__ . '/invoices_api.php'; migrate_visits($pdo);
    $q = $pdo->prepare('SELECT choice, COUNT(*) n FROM site_feedback WHERE day >= ? GROUP BY choice'); $q->execute([$start]);
    $cur = array_column($q->fetchAll(), 'n', 'choice');
    $q = $pdo->prepare('SELECT choice, COUNT(*) n FROM site_feedback WHERE day >= ? AND day < ? GROUP BY choice'); $q->execute([$prevStart, $start]);
    $prev = array_column($q->fetchAll(), 'n', 'choice');
    // answers whose visit also sent a quote request or contacted us (call / email / WhatsApp) the same day
    $q = $pdo->prepare("SELECT f.choice, COUNT(DISTINCT f.id) n FROM site_feedback f JOIN site_visits v ON v.session = f.session AND v.day = f.day AND v.kind IN ('quote','contact') WHERE f.day >= ? AND f.session != 'anon' GROUP BY f.choice"); $q->execute([$start]);
    $leads = array_column($q->fetchAll(), 'n', 'choice');
    $q = $pdo->prepare('SELECT COUNT(DISTINCT session || day) n FROM site_visits WHERE day >= ?'); $q->execute([$start]);
    $sessions = (int)$q->fetch()['n'];
    $q = $pdo->prepare("SELECT choice, detail, day FROM site_feedback WHERE day >= ? AND detail != '' ORDER BY id DESC LIMIT 15"); $q->execute([$start]);
    $notes = array_map(fn($r) => ['choice' => FB_CHOICES[$r['choice']] ?? $r['choice'], 'detail' => $r['detail'], 'day' => $r['day']], $q->fetchAll());
    $q = $pdo->prepare('SELECT device, COUNT(*) n FROM site_feedback WHERE day >= ? GROUP BY device ORDER BY n DESC'); $q->execute([$start]);
    $devices = array_map(fn($r) => ['label' => $r['device'], 'value' => (int)$r['n']], $q->fetchAll());
    $choices = [];
    foreach (FB_CHOICES as $k => $label) $choices[] = ['key' => $k, 'label' => $label, 'value' => (int)($cur[$k] ?? 0), 'prev' => (int)($prev[$k] ?? 0), 'leads' => (int)($leads[$k] ?? 0)];
    usort($choices, fn($a, $b) => $b['value'] <=> $a['value'] ?: $b['prev'] <=> $a['prev']);
    $total = array_sum(array_column($choices, 'value'));
    json_out(['days' => $days, 'total' => $total, 'prevTotal' => array_sum(array_column($choices, 'prev')), 'sessions' => $sessions, 'choices' => $choices, 'notes' => $notes, 'devices' => $devices,
        'groups' => ['Search' => ($cur['google'] ?? 0) + ($cur['maps'] ?? 0), 'AI search' => (int)($cur['ai'] ?? 0), 'Social media' => ($cur['instagram'] ?? 0) + ($cur['facebook'] ?? 0) + ($cur['tiktok'] ?? 0) + ($cur['youtube'] ?? 0), 'Word of mouth' => ($cur['referral'] ?? 0) + ($cur['vehicle'] ?? 0), 'Other' => (int)($cur['other'] ?? 0)]]);
}
