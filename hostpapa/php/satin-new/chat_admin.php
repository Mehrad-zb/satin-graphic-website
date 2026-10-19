<?php
declare(strict_types=1);
// Admin: Live chat inbox, knowledge base, page index and chat settings. Routed from admin_api.php (/api/admin/chat/...).
require_once __DIR__ . '/chat.php';

function chat_admin_conv_row(array $c): array {
    $waiting = $c['mode'] === 'human' && $c['status'] === 'open' && ($c['last_staff_at'] === '' || $c['last_staff_at'] < $c['human_requested_at']);
    return ['id' => $c['id'], 'name' => $c['name'], 'email' => $c['email'], 'phone' => $c['phone'], 'page' => $c['page_url'], 'firstPage' => $c['first_page'], 'lang' => $c['lang'],
        'status' => $c['status'], 'mode' => $c['mode'], 'waiting' => $waiting, 'emailed' => $c['emailed_at'] !== '', 'unread' => (int)$c['unread_staff'],
        'preview' => $c['last_preview'], 'lastMessageAt' => $c['last_message_at'], 'humanRequestedAt' => $c['human_requested_at'] ?: null, 'createdAt' => $c['created_at'],
        'online' => chat_recent((string)($c['visitor_seen_at'] ?? ''), 45) && $c['status'] === 'open', 'typing' => chat_recent((string)($c['visitor_typing_at'] ?? ''), 7)];
}
function chat_staff_seen(): void {
    $t = chat_setting_raw('chat.staff_seen');
    if (!is_int($t) || $t < time() - 30) chat_setting_put('chat.staff_seen', time());
}
function chat_settings_public(array $s): array {
    $out = $s; unset($out['aiKey']);
    $out['aiKeySet'] = $s['aiKey'] !== ''; $out['aiKeyHint'] = $s['aiKey'] === '' ? '' : '•••• ' . substr($s['aiKey'], -4);
    $out['defaultNotify'] = (string)cfg('notify_email', ''); $out['hoursText'] = chat_hours_text($s); $out['openNow'] = chat_open_now($s);
    $out['days'] = CHAT_DAYS; $out['defaultModel'] = CHAT_DEFAULT_MODEL;
    return $out;
}
function chat_kb_row(array $r): array {
    return ['id' => $r['id'], 'question' => $r['question'], 'answer' => $r['answer'], 'answerFa' => (string)($r['answer_fa'] ?? ''), 'keywords' => $r['keywords'], 'url' => $r['url'], 'enabled' => (bool)(int)$r['enabled'], 'updatedAt' => $r['updated_at']];
}

function chat_admin_route(string $r, string $method): void {
    $pdo = chat_db();

    /* ---------- inbox ---------- */
    if ($r === '/chat/unread' && $method === 'GET') {
        require_user('chat.view'); chat_staff_seen();
        $n = (int)$pdo->query("SELECT COUNT(*) n FROM chat_conversations WHERE status = 'open' AND unread_staff > 0")->fetch()['n'];
        $w = (int)$pdo->query("SELECT COUNT(*) n FROM chat_conversations WHERE status = 'open' AND mode = 'human' AND (last_staff_at = '' OR last_staff_at < human_requested_at)")->fetch()['n'];
        json_out(['unread' => $n, 'waiting' => $w]);
    }
    if ($r === '/chat/conversations' && $method === 'GET') {
        require_user('chat.view'); chat_staff_seen();
        $w = []; $p = [];
        $st = (string)($_GET['status'] ?? 'open');
        if (in_array($st, ['open', 'closed'], true)) { $w[] = 'status = ?'; $p[] = $st; }
        if (($_GET['filter'] ?? '') === 'unread') $w[] = 'unread_staff > 0';
        if (($_GET['filter'] ?? '') === 'waiting') $w[] = "mode = 'human' AND (last_staff_at = '' OR last_staff_at < human_requested_at)";
        if (!empty($_GET['q'])) { $s = '%' . text((string)$_GET['q'], 80) . '%'; $w[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ? OR last_preview LIKE ?)'; array_push($p, $s, $s, $s, $s); }
        $q = $pdo->prepare('SELECT * FROM chat_conversations ' . ($w ? 'WHERE ' . implode(' AND ', $w) : '') . ' ORDER BY last_message_at DESC LIMIT 300'); $q->execute($p);
        json_out(['conversations' => array_map('chat_admin_conv_row', $q->fetchAll()), 'openNow' => chat_open_now(), 'hours' => chat_hours_text()]);
    }
    if ($r === '/chat/conversation' && $method === 'GET') {
        $u = require_user('chat.view'); chat_staff_seen();
        $c = chat_conv((string)($_GET['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        if ((int)$c['unread_staff'] > 0) $pdo->prepare('UPDATE chat_conversations SET unread_staff = 0 WHERE id = ?')->execute([$c['id']]);
        $after = max(0, (int)($_GET['after'] ?? 0));
        $out = ['conversation' => chat_admin_conv_row($c) + ['ip' => $c['ip'], 'agent' => $c['agent']], 'messages' => chat_messages($c['id'], $after, 2000)];
        if ($after === 0) $out['quickReplies'] = chat_settings()['quickReplies'];
        json_out($out);
    }
    if ($r === '/chat/reply' && $method === 'POST') {
        $u = require_user('chat.reply');
        $v = body_json(8000);
        $c = chat_conv((string)($v['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        $text = is_string($v['text'] ?? null) ? trim($v['text']) : '';
        if ($text === '') json_out(['error' => 'Write a reply first.'], 400);
        if (mb_strlen($text) > 2000) json_out(['error' => 'Replies can be up to 2000 characters.'], 400);
        $now = now_iso();
        $pdo->prepare("UPDATE chat_conversations SET mode = 'human', status = 'open', human_requested_at = CASE WHEN human_requested_at = '' THEN ? ELSE human_requested_at END WHERE id = ?")->execute([$now, $c['id']]);
        $m = chat_add($c['id'], 'staff', $text, [], '', $u['name']);
        $pdo->prepare("UPDATE chat_conversations SET staff_typing_at = '' WHERE id = ?")->execute([$c['id']]);
        $sent = false;
        if (($v['emailVisitor'] ?? false) === true) {
            $sent = chat_mail($c['email'], 'Reply from Satin Graphic', "Hello {$c['name']},\n\n$text\n\n— {$u['name']}, Satin Graphic\n(905) 695-9147 · info@satingraphic.ca\n50 Viceroy Rd, Unit 22–23, Vaughan, ON\n", chat_notify_to() ?: 'info@satingraphic.ca');
            audit($u, 'chat reply emailed', $c['email']);
        }
        json_out(['ok' => true, 'message' => $m, 'emailed' => $sent]);
    }
    if ($r === '/chat/typing' && $method === 'POST') {
        $u = require_user('chat.reply');
        $v = body_json(1000);
        $c = chat_conv((string)($v['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        if (!chat_recent((string)($c['staff_typing_at'] ?? ''), 3)) $pdo->prepare('UPDATE chat_conversations SET staff_typing_at = ?, staff_typing_name = ? WHERE id = ?')->execute([now_iso(), mb_substr($u['name'], 0, 80), $c['id']]);
        json_out(['ok' => true]);
    }
    if ($r === '/chat/upload' && $method === 'POST') { // multipart: id, file, optional text caption
        $u = require_user('chat.reply');
        $c = chat_conv((string)($_POST['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        if (empty($_FILES['file'])) json_out(['error' => (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 ? chat_upload_error(UPLOAD_ERR_INI_SIZE) : 'Choose a file to send.'], 400);
        if (rate_limited('chatstafffile:' . $u['id'], 60, 3600)) json_out(['error' => 'Too many files. Wait a few minutes.'], 429);
        note_attempt('chatstafffile:' . $u['id']);
        $caption = is_string($_POST['text'] ?? null) ? mb_substr(trim($_POST['text']), 0, 2000) : '';
        try { $file = chat_store_file($_FILES['file'], $c['id'], 'staff'); }
        catch (InvalidArgumentException $e) { json_out(['error' => $e->getMessage()], 400); }
        $now = now_iso();
        $pdo->prepare("UPDATE chat_conversations SET mode = 'human', status = 'open', staff_typing_at = '', human_requested_at = CASE WHEN human_requested_at = '' THEN ? ELSE human_requested_at END WHERE id = ?")->execute([$now, $c['id']]);
        $m = chat_add($c['id'], 'staff', $caption, [], '', $u['name'], [$file]);
        audit($u, 'chat file sent', $file['name']);
        json_out(['ok' => true, 'message' => $m]);
    }
    if ($r === '/chat/file' && $method === 'GET') {
        require_user('chat.view');
        $f = chat_file((string)($_GET['id'] ?? '')); if (!$f) json_out(['error' => 'File not found'], 404);
        chat_file_out($f, isset($_GET['thumb']));
    }
    if ($r === '/chat/status' && $method === 'POST') {
        $u = require_user('chat.reply');
        $v = body_json(2000);
        $c = chat_conv((string)($v['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        $st = (string)($v['status'] ?? '');
        if (!in_array($st, ['open', 'closed'], true)) json_out(['error' => 'Choose open or closed'], 400);
        $pdo->prepare('UPDATE chat_conversations SET status = ?, unread_staff = 0, updated_at = ? WHERE id = ?')->execute([$st, now_iso(), $c['id']]);
        if ($st === 'closed' && $c['status'] !== 'closed') chat_add($c['id'], 'system', $u['name'] . ' closed this chat. Thanks for contacting Satin Graphic!');
        audit($u, 'chat ' . $st, $c['email']);
        json_out(['ok' => true]);
    }
    if ($r === '/chat/delete' && $method === 'POST') {
        $u = require_user('chat.manage');
        $v = body_json(2000);
        $c = chat_conv((string)($v['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        chat_delete_files($c['id']);
        $pdo->prepare('DELETE FROM chat_messages WHERE conversation_id = ?')->execute([$c['id']]);
        $pdo->prepare('DELETE FROM chat_conversations WHERE id = ?')->execute([$c['id']]);
        audit($u, 'chat deleted', $c['email']);
        json_out(['ok' => true]);
    }
    if ($r === '/chat/export' && $method === 'GET') {
        $u = require_user('chat.view');
        $c = chat_conv((string)($_GET['id'] ?? '')); if (!$c) json_out(['error' => 'Conversation not found'], 404);
        audit($u, 'chat exported', $c['email']);
        header('Content-Type: text/plain; charset=utf-8'); header('Cache-Control: no-store');
        header('Content-Disposition: attachment; filename="satin-chat-' . substr(preg_replace('/[^0-9-]/', '', $c['created_at']), 0, 10) . '-' . substr($c['id'], 0, 8) . '.txt"');
        echo "Satin Graphic — website chat\n\n" . chat_transcript($c); exit;
    }

    /* ---------- knowledge base & page index ---------- */
    if ($r === '/chat/kb' && $method === 'GET') {
        require_user('chat.manage');
        $rows = $pdo->query('SELECT * FROM chat_kb ORDER BY sort_order, created_at')->fetchAll();
        json_out(['entries' => array_map('chat_kb_row', $rows), 'index' => chat_setting_raw('chat.index')]);
    }
    if ($r === '/chat/kb/save' && $method === 'POST') {
        $u = require_user('chat.manage');
        $v = body_json(20000); $e = is_array($v['entry'] ?? null) ? $v['entry'] : [];
        $qn = text($e['question'] ?? '', 300); $an = text($e['answer'] ?? '', 3000); $kw = text($e['keywords'] ?? '', 500); $url = text($e['url'] ?? '', 300); $fa = text($e['answerFa'] ?? '', 3000);
        if (mb_strlen($qn) < 3) json_out(['error' => 'Write the question.'], 400);
        if (mb_strlen($an) < 3) json_out(['error' => 'Write the answer.'], 400);
        if ($url !== '' && chat_safe_url($url) === '') json_out(['error' => 'The link must start with / (a page on this site) or https://'], 400);
        $en = ($e['enabled'] ?? true) !== false ? 1 : 0; $now = now_iso();
        if (!empty($e['id'])) {
            $q = $pdo->prepare('UPDATE chat_kb SET question = ?, answer = ?, keywords = ?, url = ?, enabled = ?, updated_at = ?, answer_fa = ? WHERE id = ?'); $q->execute([$qn, $an, $kw, $url, $en, $now, $fa, (string)$e['id']]);
            if (!$q->rowCount()) json_out(['error' => 'Entry not found'], 404);
            $id = (string)$e['id'];
        } else {
            $id = uuid(); $max = (int)$pdo->query('SELECT COALESCE(MAX(sort_order),0) n FROM chat_kb')->fetch()['n'];
            $pdo->prepare('INSERT INTO chat_kb (id,question,answer,keywords,url,enabled,sort_order,created_at,updated_at,answer_fa) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$id, $qn, $an, $kw, $url, $en, $max + 1, $now, $now, $fa]);
        }
        audit($u, 'chat Q&A saved', $qn);
        $q = $pdo->prepare('SELECT * FROM chat_kb WHERE id = ?'); $q->execute([$id]);
        json_out(['ok' => true, 'entry' => chat_kb_row($q->fetch())]);
    }
    if ($r === '/chat/kb/delete' && $method === 'POST') {
        $u = require_user('chat.manage');
        $v = body_json(2000);
        $q = $pdo->prepare('DELETE FROM chat_kb WHERE id = ?'); $q->execute([(string)($v['id'] ?? '')]);
        if (!$q->rowCount()) json_out(['error' => 'Entry not found'], 404);
        audit($u, 'chat Q&A deleted', (string)$v['id']);
        json_out(['ok' => true]);
    }
    if ($r === '/chat/kb/bulk' && $method === 'POST') { // approved entries from "Import chat history"
        $u = require_user('chat.manage');
        $v = body_json(400000); $list = is_array($v['entries'] ?? null) ? array_slice($v['entries'], 0, 200) : [];
        $max = (int)$pdo->query('SELECT COALESCE(MAX(sort_order),0) n FROM chat_kb')->fetch()['n']; $now = now_iso(); $n = 0;
        $ins = $pdo->prepare('INSERT INTO chat_kb (id,question,answer,keywords,url,enabled,sort_order,created_at,updated_at,answer_fa) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $pdo->beginTransaction();
        foreach ($list as $e) {
            if (!is_array($e)) continue;
            $qn = text($e['question'] ?? '', 300); $an = text($e['answer'] ?? '', 3000); $url = text($e['url'] ?? '', 300);
            if (mb_strlen($qn) < 3 || mb_strlen($an) < 3 || ($url !== '' && chat_safe_url($url) === '')) continue;
            $ins->execute([uuid(), $qn, $an, text($e['keywords'] ?? '', 500), $url, 1, ++$max, $now, $now, text($e['answerFa'] ?? '', 3000)]); $n++;
        }
        $pdo->commit();
        audit($u, 'chat Q&A imported', "$n entries");
        json_out(['ok' => true, 'added' => $n]);
    }
    if ($r === '/chat/import' && $method === 'POST') { // WhatsApp "Export chat" (.txt or .zip) → candidate Q&A, parsed here, nothing stored
        $u = require_user('chat.manage');
        if (rate_limited('chatimport:' . $u['id'], 20, 3600)) json_out(['error' => 'Too many imports. Wait a few minutes.'], 429);
        note_attempt('chatimport:' . $u['id']);
        $f = $_FILES['file'] ?? null;
        if (!is_array($f) || ($f['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) json_out(['error' => is_array($f) && in_array($f['error'] ?? 0, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'This file is larger than the server accepts. Export the chat “Without media” and try again.' : 'Choose the exported chat file (.txt or .zip).'], 400);
        try { $texts = chat_import_texts((string)$f['tmp_name'], (string)$f['name']); }
        catch (InvalidArgumentException $e) { json_out(['error' => $e->getMessage()], 400); }
        finally { @unlink((string)$f['tmp_name']); }
        $res = chat_import_candidates($texts, text($_POST['business'] ?? '', 120));
        audit($u, 'chat history imported', $res['messages'] . ' messages, ' . count($res['candidates']) . ' candidates (not stored)');
        json_out($res);
    }
    if ($r === '/chat/import/ai' && $method === 'POST') { // optional: tidy candidates with the AI the owner already enabled
        $u = require_user('chat.manage');
        $s = chat_settings();
        if (!$s['aiEnabled'] || $s['aiKey'] === '') json_out(['error' => 'AI answers are turned off in Live chat → Settings.'], 400);
        if (rate_limited('chatimportai:' . $u['id'], 10, 3600)) json_out(['error' => 'Too many AI requests. Wait a few minutes.'], 429);
        note_attempt('chatimportai:' . $u['id']);
        $v = body_json(200000); $c = is_array($v['candidates'] ?? null) ? array_slice($v['candidates'], 0, 40) : [];
        try { json_out(['candidates' => chat_import_ai($c, $s)]); } catch (Throwable $e) { json_out(['error' => 'AI could not tidy these: ' . mb_substr($e->getMessage(), 0, 200)], 502); }
    }
    if ($r === '/chat/index/rebuild' && $method === 'POST') {
        $u = require_user('chat.manage');
        if (rate_limited('chatindex:' . $u['id'], 6, 600)) json_out(['error' => 'Please wait a few minutes before rebuilding again.'], 429);
        note_attempt('chatindex:' . $u['id']);
        try { $res = chat_rebuild_index(); } catch (Throwable $e) { json_out(['error' => $e->getMessage()], 500); }
        audit($u, 'chat index rebuilt', $res['pages'] . ' pages');
        json_out(['ok' => true, 'index' => chat_setting_raw('chat.index')]);
    }
    if ($r === '/chat/test' && $method === 'POST') {
        $u = require_user('chat.manage');
        $v = body_json(4000);
        $qtext = text($v['q'] ?? '', CHAT_MAX_MESSAGE); if ($qtext === '') json_out(['error' => 'Type a question.'], 400);
        if (rate_limited('chattest:' . $u['id'], 40, 600)) json_out(['error' => 'Too many tests. Wait a few minutes.'], 429);
        note_attempt('chattest:' . $u['id']);
        $terms = chat_terms($qtext);
        $a = chat_answer($qtext, ['name' => $u['name']], []);
        json_out(['answer' => $a, 'terms' => $terms,
            'kb' => array_map(fn($k) => ['question' => $k['row']['question'], 'score' => round($k['score'], 2), 'coverage' => round($k['coverage'], 2)], chat_search_kb($terms, 3)),
            'pages' => array_map(fn($p) => ['url' => $p['url'], 'title' => $p['title'], 'score' => round($p['score'], 2), 'coverage' => round($p['coverage'], 2)], chat_search_pages($terms, 4))]);
    }

    /* ---------- settings ---------- */
    if ($r === '/chat/settings' && $method === 'GET') { require_user('chat.manage'); json_out(['settings' => chat_settings_public(chat_settings())]); }
    if ($r === '/chat/settings' && $method === 'POST') {
        $u = require_user('chat.manage');
        $v = body_json(30000); $old = chat_settings();
        $hours = $old['hours'];
        if (is_array($v['hours'] ?? null)) {
            if (count($v['hours']) !== 7) json_out(['error' => 'Office hours need 7 days.'], 400);
            $hours = [];
            foreach (array_values($v['hours']) as $i => $h) {
                $closed = ($h['closed'] ?? false) === true; $o = (string)($h['open'] ?? ''); $cl = (string)($h['close'] ?? '');
                if (!$closed && (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $o) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $cl) || $o >= $cl)) json_out(['error' => 'Check the hours for ' . CHAT_DAYS[$i] . ' (open must be before close).'], 400);
                $hours[] = ['closed' => $closed, 'open' => $closed ? '' : $o, 'close' => $closed ? '' : $cl];
            }
        }
        $wa = preg_replace('/\D+/', '', (string)($v['whatsapp'] ?? $old['whatsapp']));
        if ($wa !== '' && (strlen($wa) < 8 || strlen($wa) > 15)) json_out(['error' => 'WhatsApp number: use the full international number, e.g. 1 905 962 6222 (or leave empty to hide the button).'], 400);
        $notify = trim((string)($v['notifyEmail'] ?? $old['notifyEmail']));
        if ($notify !== '' && !filter_var($notify, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Check the notification email.'], 400);
        $model = trim((string)($v['aiModel'] ?? $old['aiModel'])) ?: CHAT_DEFAULT_MODEL;
        if (!preg_match('/^[a-z0-9][a-z0-9.\-]{2,80}$/', $model)) json_out(['error' => 'The model id looks wrong (example: ' . CHAT_DEFAULT_MODEL . ').'], 400);
        $key = $old['aiKey'];
        if (is_string($v['aiKey'] ?? null) && trim($v['aiKey']) !== '') { $key = trim($v['aiKey']); if (!preg_match('/^sk-ant-[A-Za-z0-9_\-]{20,300}$/', $key)) json_out(['error' => 'That does not look like an Anthropic API key (it starts with sk-ant-).'], 400); }
        if (($v['clearAiKey'] ?? false) === true) $key = '';
        $qr = is_array($v['quickReplies'] ?? null) ? $v['quickReplies'] : $old['quickReplies'];
        $qr = array_values(array_slice(array_filter(array_map(fn($x) => text($x, 500), $qr), fn($x) => $x !== ''), 0, 20));
        $aiOn = array_key_exists('aiEnabled', $v) ? $v['aiEnabled'] === true : $old['aiEnabled'];
        $new = ['enabled' => array_key_exists('enabled', $v) ? $v['enabled'] !== false : $old['enabled'],
            'welcome' => text($v['welcome'] ?? $old['welcome'], 500) ?: $old['welcome'], 'welcomeFa' => text($v['welcomeFa'] ?? $old['welcomeFa'], 500) ?: $old['welcomeFa'],
            'hours' => $hours, 'waitMinutes' => max(1, min(30, (int)($v['waitMinutes'] ?? $old['waitMinutes']))), 'whatsapp' => $wa, 'notifyEmail' => $notify,
            'quickReplies' => $qr, 'aiEnabled' => $aiOn, 'aiModel' => $model, 'aiKey' => $key, 'updatedAt' => now_iso(), 'updatedBy' => $u['name']];
        chat_setting_put('chat.settings', $new);
        audit($u, 'chat settings', ($new['enabled'] ? 'widget on' : 'widget off') . ($aiOn ? ', AI on' : ', AI off') . ($key !== $old['aiKey'] ? ', AI key changed' : ''));
        json_out(['ok' => true, 'settings' => chat_settings_public(chat_settings())]);
    }
    if ($r === '/chat/settings/test-ai' && $method === 'POST') {
        $u = require_user('chat.manage');
        if (rate_limited('chataitest:' . $u['id'], 8, 600)) json_out(['error' => 'Too many tests. Wait a few minutes.'], 429);
        note_attempt('chataitest:' . $u['id']);
        json_out(chat_ai_test(chat_settings()));
    }

    json_out(['error' => 'Not found'], 404);
}

/* ======================= Import chat history (WhatsApp "Export chat") ======================= */
/** [[filename, text], …] from an uploaded .txt or .zip (only the chat .txt files inside a zip are read; media is ignored). */
function chat_import_texts(string $tmp, string $name): array {
    $size = (int)@filesize($tmp);
    if ($size < 10) throw new InvalidArgumentException('The file is empty.');
    $fh = fopen($tmp, 'rb'); $head = (string)fread($fh, 4); fclose($fh);
    if ($head === "PK\x03\x04") {
        if (!class_exists('ZipArchive')) throw new InvalidArgumentException('ZIP files are not supported on this server — upload the .txt file from inside the zip.');
        if ($size > 200 * 1024 * 1024) throw new InvalidArgumentException('The ZIP is too large. Export the chat “Without media” and try again.');
        $z = new ZipArchive(); if ($z->open($tmp) !== true) throw new InvalidArgumentException('This ZIP file could not be opened.');
        $out = []; $total = 0;
        for ($i = 0; $i < $z->numFiles && count($out) < 50; $i++) {
            $st = $z->statIndex($i); $n = (string)($st['name'] ?? '');
            if (!preg_match('/\.txt$/i', $n) || str_contains($n, '__MACOSX')) continue;
            if ($st['size'] > 20 * 1024 * 1024 || ($total += $st['size']) > 60 * 1024 * 1024) throw new InvalidArgumentException('The chat text inside the ZIP is too large.');
            $t = $z->getFromIndex($i); if (is_string($t) && $t !== '') $out[] = [basename($n), $t];
        }
        $z->close();
        if (!$out) throw new InvalidArgumentException('No chat .txt file was found in this ZIP. In WhatsApp use More → Export chat.');
        return $out;
    }
    if ($size > 20 * 1024 * 1024) throw new InvalidArgumentException('The text file is too large (max 20 MB).');
    $t = (string)file_get_contents($tmp);
    if (!mb_check_encoding($t, 'UTF-8')) { $c = @mb_convert_encoding($t, 'UTF-8', 'UTF-16'); if ($c && mb_check_encoding($c, 'UTF-8')) $t = $c; }
    if (preg_match('/[\x00-\x08\x0E-\x1F]/', substr($t, 0, 4000))) throw new InvalidArgumentException('This does not look like a WhatsApp chat export (.txt or .zip).');
    return [[basename($name), $t]];
}
/** Parses Android ("12/31/23, 9:15 PM - Name: text") and iPhone ("[31/12/2023, 21:15:42] Name: text") export lines. */
function chat_import_parse(string $text): array {
    $text = str_replace(["\r\n", "\r", "\u{FEFF}", "\u{200E}", "\u{200F}", "\u{202A}", "\u{202B}", "\u{202C}", "\u{202D}", "\u{202E}", "\u{2066}", "\u{2067}", "\u{2068}", "\u{2069}"], ["\n", "\n", '', '', '', '', '', '', '', '', '', '', '', ''], $text);
    $text = str_replace(["\u{202F}", "\u{00A0}"], ' ', $text);
    $re = '/^\[?(\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}),?\s+(\d{1,2}[:.]\d{2}(?:[:.]\d{2})?)\s*([AaPp]\.?\s?[Mm]\.?|ق\.ظ|ب\.ظ)?\]?\s*(?:[-–]\s+)?(.*)$/u';
    $msgs = []; $cur = null;
    foreach (explode("\n", $text) as $line) {
        if (preg_match($re, $line, $m)) {
            if ($cur) $msgs[] = $cur;
            $rest = $m[4]; $p = mb_strpos($rest, ': ');
            if ($p === false || $p > 80) { $cur = null; continue; } // system line ("Messages are end-to-end encrypted", "X added Y" …)
            $cur = ['from' => trim(mb_substr($rest, 0, $p)), 'text' => mb_substr($rest, $p + 2)];
        } elseif ($cur) $cur['text'] .= "\n" . $line;
    }
    if ($cur) $msgs[] = $cur;
    $skip = '/^(<media omitted>|<.*omitted>|.*\b(image|video|audio|sticker|gif|document|contact card) omitted$|<attached:.*>|this message was deleted|you deleted this message|missed (voice|video) call|null|‎?location: .*|live location shared|<رسانه حذف شد>|<رسانه حذف شده>|این پیام حذف شد|.*\.(jpg|jpeg|png|pdf|opus|mp4|webp|vcf) \(file attached\))$/iu';
    $out = [];
    foreach ($msgs as $m) { $t = trim($m['text']); if ($t === '' || preg_match($skip, $t) || $m['from'] === '') continue; $out[] = ['from' => $m['from'], 'text' => $t]; }
    return $out;
}
/** Removes personal details: emails, phone and other long numbers, postal codes, street addresses (except ours), links, participant names. */
function chat_pii_strip(string $t, array $names): string {
    $t = (string)preg_replace_callback('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/u', fn($m) => preg_match('/@(satingraphic\.ca|satinautowrap\.com)$/i', $m[0]) ? $m[0] : '[email]', $t); // the business's own addresses stay
    $t = (string)preg_replace_callback('#\bhttps?://[^\s<>"]+|\bwww\.[^\s<>"]+#iu', fn($m) => preg_match('#satingraphic\.ca|satinautowrap\.com#i', $m[0]) ? $m[0] : '[link]', $t);
    $t = (string)preg_replace('/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/iu', '[postal code]', $t);
    $t = (string)preg_replace_callback('/\b\d{1,6}\s+(?:[\p{L}\'.-]+\s+){1,4}(?:st|street|rd|road|ave|avenue|blvd|boulevard|dr|drive|cres|crescent|ct|court|way|lane|ln|pl|place|pkwy|parkway|hwy|highway|trail|cir|circle|sq|square|terrace|gate|gardens|grove)\b\.?(?:,?\s*(?:unit|suite|apt|#)\s*[\w-]+)?/iu',
        fn($m) => stripos($m[0], 'viceroy') !== false ? $m[0] : '[address]', $t);
    $t = (string)preg_replace_callback('/(?<![\w$])\+?\(?\d[\d\s().\-]{5,}\d(?![\w%])/u', fn($m) => preg_replace('/\D/', '', $m[0]) === '9059626222' || preg_replace('/\D/', '', $m[0]) === '19059626222' || in_array(preg_replace('/\D/', '', $m[0]), ['9056959147', '19056959147'], true) ? $m[0] : '[number]', $t); // phone, card, order, account numbers (ours stays)
    foreach ($names as $n) {
        foreach (array_unique(array_merge([$n], preg_split('/\s+/u', $n) ?: [])) as $part) {
            $part = trim($part, " .,-_()~'\""); if (mb_strlen($part) < 3 || preg_match('/^(satin|graphic|graphics|auto|wrap|wraps|the|and|inc|ltd|ca|mr|mrs|ms)$/iu', $part) || preg_match('/^\+?\d/', $part)) continue;
            $t = (string)preg_replace('/(?<![\p{L}\p{N}])' . preg_quote($part, '/') . '(?![\p{L}\p{N}])/iu', '', $t);
        }
    }
    $t = (string)preg_replace('/(?<![\p{L}])\p{L}+\s+(جان|جون|عزیز)(?![\p{L}])/u', '', $t); // "مریم جان" → (Persian names are not always in the contact name)
    $t = (string)preg_replace('/\b(hi|hello|hey|dear|thanks|thank you)\s+([,!])/iu', '$1$2', $t);
    // drop sentences that only carried personal details ("My number is [number]")
    $parts = preg_split('/(?<=[.!?؟\n])\s+/u', $t) ?: [$t];
    $keep = array_filter($parts, fn($x) => !preg_match('/\[(number|email|address|postal code)\]/', $x));
    if ($keep && mb_strlen(implode(' ', $keep)) >= 8) $t = implode(' ', $keep);
    $t = (string)preg_replace(['/[ \t]{2,}/u', '/\s+([,.!?؟،])/u', '/^[\s,.!?:;-]+/u', '/\(\s*\)/u'], [' ', '$1', '', ''], $t);
    return trim($t);
}
function chat_import_is_question(string $t): bool {
    $l = mb_strtolower($t);
    if (preg_match('/[?؟]/u', $t)) return true;
    return (bool)preg_match('/^(how|what|when|where|which|who|why|do you|does|did|can|could|would|will|is|are|should|price|cost|quote|i need|i want|i\'m looking|looking for|interested)\b|(چقدر|چند|آیا|ایا|کی |کجا|چطور|چه |میشه|می‌شه|دارید|دارین|هست|قیمت|هزینه|میخواستم|می‌خواستم)/u', $l);
}
/** Turns exported chats into reviewed-by-the-owner Q&A candidates (customer question → business answer). */
function chat_import_candidates(array $texts, string $business): array {
    $chats = []; $count = []; $inChats = []; $total = 0;
    foreach ($texts as [$fname, $t]) {
        $msgs = chat_import_parse($t); if (!$msgs) continue;
        $total += count($msgs); $chats[] = [$fname, $msgs];
        foreach ($msgs as $m) $count[$m['from']] = ($count[$m['from']] ?? 0) + 1;
        foreach (array_unique(array_column($msgs, 'from')) as $p) $inChats[$p] = ($inChats[$p] ?? 0) + 1;
    }
    if (!$chats) return ['participants' => [], 'business' => '', 'chats' => 0, 'messages' => 0, 'candidates' => [], 'error' => 'No messages were found. Upload the file from WhatsApp → Export chat (with or without media).'];
    // Who is the business? The person in the most chats; for a single chat, the one not named in "WhatsApp Chat with X.txt", else the one who mentions prices/Satin most.
    if ($business === '' || !isset($count[$business])) {
        arsort($inChats); $top = array_keys($inChats);
        if (count($chats) > 1 && ($inChats[$top[0]] ?? 0) > ($inChats[$top[1] ?? ''] ?? 0)) $business = $top[0];
        else {
            $other = ''; if (preg_match('/WhatsApp Chat (?:with|-)\s*(.+?)\.txt$/iu', $chats[0][0], $m)) $other = trim($m[1]);
            $score = [];
            foreach ($chats[0][1] as $msg) $score[$msg['from']] = ($score[$msg['from']] ?? 0) + (preg_match('/\$\s?\d|satin|we can|we do|our |business day|invoice|e-?transfer/iu', $msg['text']) ? 3 : 0) + 0.01;
            foreach (array_keys($score) as $p) if ($other !== '' && mb_strtolower($p) === mb_strtolower($other)) $score[$p] = -1;
            arsort($score); $business = (string)array_key_first($score);
        }
    }
    $names = array_keys($count);
    // turns: consecutive messages from the same side are joined
    $pairs = [];
    foreach ($chats as [, $msgs]) {
        $turns = [];
        foreach ($msgs as $m) {
            $side = $m['from'] === $business ? 'b' : 'c';
            if ($turns && end($turns)['side'] === $side) { if (mb_strlen($turns[count($turns) - 1]['text']) < 1500) $turns[count($turns) - 1]['text'] .= "\n" . $m['text']; }
            else $turns[] = ['side' => $side, 'text' => $m['text']];
        }
        for ($i = 0; $i < count($turns) - 1; $i++) {
            if ($turns[$i]['side'] !== 'c' || $turns[$i + 1]['side'] !== 'b') continue;
            $q = chat_pii_strip($turns[$i]['text'], $names); $a = chat_pii_strip($turns[$i + 1]['text'], $names);
            // keep the question part of a long customer turn (last 2 lines usually hold the actual question)
            $lines = array_values(array_filter(array_map('trim', explode("\n", $q)), fn($l) => $l !== '' && !preg_match('/^(hi|hello|hey|salam|سلام|good (morning|afternoon|evening))[\s!.,]*$/iu', $l)));
            $q = implode(' ', array_slice($lines, -3));
            if (mb_strlen($q) < 8 || mb_strlen($q) > 500 || mb_strlen($a) < 15 || mb_strlen($a) > 2000 || !chat_import_is_question($q)) continue;
            if (preg_match('/^(ok(ay)?|sure|yes|no|thanks?( you)?|👍|🙏|باشه|ممنون|مرسی)[\s!.]*$/iu', $a)) continue;
            $pairs[] = ['question' => $q, 'answer' => $a, 'terms' => array_values(array_unique(chat_terms($q)))];
        }
    }
    // merge near-duplicates (same key words) and rank by how often customers asked
    $groups = [];
    foreach ($pairs as $p) {
        if (count($p['terms']) < 1) continue;
        $hit = null;
        foreach ($groups as $gi => $g) {
            $inter = count(array_intersect($p['terms'], $g['terms'])); $union = count(array_unique(array_merge($p['terms'], $g['terms'])));
            if ($union && $inter / $union >= 0.6) { $hit = $gi; break; }
        }
        if ($hit === null) $groups[] = $p + ['count' => 1, 'answers' => [$p['answer']]];
        else { $groups[$hit]['count']++; if (count($groups[$hit]['answers']) < 4) $groups[$hit]['answers'][] = $p['answer']; if (mb_strlen($p['answer']) > mb_strlen($groups[$hit]['answer'])) $groups[$hit]['answer'] = $p['answer']; }
    }
    usort($groups, fn($a, $b) => [$b['count'], mb_strlen($b['answer'])] <=> [$a['count'], mb_strlen($a['answer'])]);
    $out = [];
    foreach (array_slice($groups, 0, 200) as $g) {
        $kb = chat_search_kb($g['terms'], 1); $sim = ($kb[0]['coverage'] ?? 0) >= 0.75 ? $kb[0]['row']['question'] : '';
        $fa = (bool)preg_match('/\p{Arabic}/u', $g['question'] . $g['answer']);
        $out[] = ['question' => $g['question'], 'answer' => $g['answer'], 'answerFa' => $fa ? $g['answer'] : '', 'keywords' => implode(' ', array_slice($g['terms'], 0, 10)),
            'count' => $g['count'], 'similar' => $sim, 'alternatives' => array_values(array_diff($g['answers'], [$g['answer']]))];
    }
    return ['participants' => array_map(fn($n) => ['name' => $n, 'messages' => $count[$n], 'chats' => $inChats[$n] ?? 0], $names), 'business' => $business,
        'chats' => count($chats), 'messages' => $total, 'candidates' => $out];
}
/** Optional: asks the owner's AI (already enabled with their key) to turn raw pairs into general, reusable Q&A. */
function chat_import_ai(array $cands, array $s): array {
    $items = [];
    foreach ($cands as $i => $c) if (is_array($c)) $items[] = ['i' => $i, 'q' => mb_substr((string)($c['question'] ?? ''), 0, 500), 'a' => mb_substr((string)($c['answer'] ?? $c['answerFa'] ?? ''), 0, 1500) ?: mb_substr((string)($c['answerFa'] ?? ''), 0, 1500)];
    if (!$items) return [];
    $prompt = "Below are question/answer pairs taken from a business's customer chats (personal details already removed). Rewrite each into a general FAQ entry for the business's website chat assistant: a short general question, and a clear answer in the same language that keeps every fact, price and time exactly as given, drops anything specific to one customer (names, dates, 'your car'), and says nothing new. If a pair is not useful as a general FAQ, set skip to true. Reply with JSON only: [{\"i\":0,\"question\":\"…\",\"answer\":\"…\",\"keywords\":\"5-10 search words\",\"skip\":false}].\n\n" . json_encode($items, JSON_UNESCAPED_UNICODE);
    $ch = curl_init((string)cfg('chat_ai_endpoint', 'https://api.anthropic.com/v1/messages'));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['x-api-key: ' . $s['aiKey'], 'anthropic-version: 2023-06-01', 'content-type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['model' => $s['aiModel'], 'max_tokens' => 8000, 'messages' => [['role' => 'user', 'content' => $prompt]]], JSON_UNESCAPED_UNICODE)]);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if ($code !== 200 || !is_array($j)) throw new RuntimeException('HTTP ' . $code);
    $txt = ''; foreach (($j['content'] ?? []) as $c) if (($c['type'] ?? '') === 'text') $txt .= $c['text'];
    if (!preg_match('/\[.*\]/s', $txt, $m)) throw new RuntimeException('unexpected reply');
    $arr = json_decode($m[0], true); if (!is_array($arr)) throw new RuntimeException('unexpected reply');
    $out = [];
    foreach ($arr as $x) {
        $i = (int)($x['i'] ?? -1); if (!isset($cands[$i]) || !empty($x['skip'])) continue;
        $fa = (bool)preg_match('/\p{Arabic}/u', (string)($x['answer'] ?? ''));
        $out[] = ['question' => text($x['question'] ?? '', 300), 'answer' => text($x['answer'] ?? '', 3000), 'answerFa' => $fa ? text($x['answer'] ?? '', 3000) : '', 'keywords' => text($x['keywords'] ?? '', 500), 'count' => (int)($cands[$i]['count'] ?? 1), 'similar' => (string)($cands[$i]['similar'] ?? ''), 'alternatives' => []];
    }
    return $out;
}
