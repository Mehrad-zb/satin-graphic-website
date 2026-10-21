<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

const REQUEST_STATUSES = ['pending_confirmation' => 'New', 'contacted' => 'Contacted', 'quoted' => 'Quoted', 'confirmed' => 'Confirmed', 'completed' => 'Completed', 'cancelled' => 'Cancelled'];

function admin_route(string $path, string $method): void {
    header('X-Frame-Options: SAMEORIGIN');
    $r = substr($path, strlen('/api/admin'));
    $pdo = adb();
    if (str_starts_with($r, '/requests')) migrate_replies($pdo);

    // ---------- session ----------
    if ($r === '/me' && $method === 'GET') {
        $u = current_user();
        $hasUsers = (int)$pdo->query('SELECT COUNT(*) n FROM admin_users')->fetch()['n'] > 0;
        if (!$u) json_out(['user' => null, 'setupNeeded' => !$hasUsers]);
        json_out(['user' => public_user($u), 'permissions' => $u['permissions'], 'csrf' => $u['csrf'], 'roleName' => all_roles()[$u['role']]['name'] ?? $u['role'], 'statuses' => REQUEST_STATUSES]);
    }

    if ($r === '/login' && $method === 'POST') {
        same_origin();
        $v = body_json(4000);
        $email = strtolower(text($v['email'] ?? '', 254)); $pass = (string)($v['password'] ?? '');
        $key = 'login:' . client_ip();
        if (rate_limited($key, 8, 900) || rate_limited('login:' . $email, 8, 900)) json_out(['error' => 'Too many attempts. Try again in 15 minutes.'], 429);
        $q = $pdo->prepare('SELECT * FROM admin_users WHERE email = ?'); $q->execute([$email]); $u = $q->fetch();
        if (!$u || !password_verify($pass, $u['pass_hash']) || $u['status'] !== 'active') {
            note_attempt($key); note_attempt('login:' . $email);
            json_out(['error' => 'Email or password is not correct.'], 401);
        }
        if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) $pdo->prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        $s = start_session($u); audit($u, 'login');
        json_out(['ok' => true, 'csrf' => $s['csrf']]);
    }

    if ($r === '/logout' && $method === 'POST') {
        $t = $_COOKIE[SESSION_COOKIE] ?? '';
        if (is_string($t) && $t) $pdo->prepare('DELETE FROM admin_sessions WHERE token_hash = ?')->execute([thash($t)]);
        set_session_cookie('', time() - 3600);
        json_out(['ok' => true]);
    }

    if ($r === '/setup' && $method === 'POST') {
        same_origin();
        $v = body_json(2000);
        if ((int)$pdo->query('SELECT COUNT(*) n FROM admin_users')->fetch()['n'] > 0) json_out(['error' => 'The owner account is already set up. Sign in instead.'], 409);
        if (rate_limited('setup:' . client_ip(), 3, 3600)) json_out(['error' => 'Too many requests. Try again later.'], 429);
        note_attempt('setup:' . client_ip());
        $email = strtolower(text($v['email'] ?? '', 254));
        $owner = strtolower((string)cfg('owner_email', ''));
        if ($owner && hash_equals($owner, $email)) {
            $link = create_link($owner, 'Owner', 'owner', 'owner', null, 24);
            send_mail($owner, 'Set up your Satin admin account', "Hello,\n\nUse this link within 24 hours to choose your password for the Satin website admin:\n\n$link\n\nIf you did not ask for this, ignore this email.");
            audit(null, 'owner setup link sent');
        }
        json_out(['ok' => true, 'message' => 'If this is the owner email, a setup link has been sent. Check your inbox and spam folder.']);
    }

    if ($r === '/forgot' && $method === 'POST') {
        same_origin();
        $v = body_json(2000);
        $email = strtolower(text($v['email'] ?? '', 254));
        if (!rate_limited('forgot:' . client_ip(), 5, 3600)) {
            note_attempt('forgot:' . client_ip());
            $q = $pdo->prepare('SELECT * FROM admin_users WHERE email = ? AND status = \'active\''); $q->execute([$email]);
            if ($u = $q->fetch()) {
                $link = create_link($u['email'], $u['name'], $u['role'], 'reset', null, 1);
                send_mail($u['email'], 'Reset your Satin admin password', "Hello {$u['name']},\n\nUse this link within 1 hour to choose a new password:\n\n$link\n\nIf you did not ask for this, ignore this email.");
                audit($u, 'password reset link sent');
            }
        }
        json_out(['ok' => true, 'message' => 'If an account exists for this email, a reset link has been sent.']);
    }

    if ($r === '/invite' && $method === 'GET') {
        $q = $pdo->prepare('SELECT email,name,role,purpose FROM admin_invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?');
        $q->execute([thash((string)($_GET['token'] ?? '')), time()]);
        $i = $q->fetch();
        if (!$i) json_out(['error' => 'This link has expired or was already used. Ask for a new one.'], 404);
        $i['roleName'] = all_roles()[$i['role']]['name'] ?? $i['role'];
        json_out(['invite' => $i]);
    }

    if ($r === '/accept' && $method === 'POST') {
        same_origin();
        $v = body_json(4000);
        if (rate_limited('accept:' . client_ip(), 10, 3600)) json_out(['error' => 'Too many attempts. Try again later.'], 429);
        note_attempt('accept:' . client_ip());
        $q = $pdo->prepare('SELECT * FROM admin_invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?');
        $q->execute([thash((string)($v['token'] ?? '')), time()]);
        $i = $q->fetch();
        if (!$i) json_out(['error' => 'This link has expired or was already used. Ask for a new one.'], 404);
        $pass = (string)($v['password'] ?? '');
        if ($err = valid_password($pass)) json_out(['error' => $err], 400);
        $name = text($v['name'] ?? '', 80) ?: $i['name'];
        if (mb_strlen($name) < 2) json_out(['error' => 'Add your name.'], 400);
        $pdo->beginTransaction();
        $q = $pdo->prepare('SELECT * FROM admin_users WHERE email = ?'); $q->execute([$i['email']]); $u = $q->fetch();
        if ($i['purpose'] === 'owner' && (int)$pdo->query('SELECT COUNT(*) n FROM admin_users')->fetch()['n'] > 0 && !$u) { $pdo->rollBack(); json_out(['error' => 'Owner already set up.'], 409); }
        if ($u) {
            $pdo->prepare('UPDATE admin_users SET pass_hash = ?, name = ?, status = \'active\'' . ($i['purpose'] === 'reset' ? '' : ', role = ?') . ' WHERE id = ?')
                ->execute(array_merge([password_hash($pass, PASSWORD_DEFAULT), $name], $i['purpose'] === 'reset' ? [] : [$i['role']], [$u['id']]));
            $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$u['id']]);
            $uid = $u['id'];
        } else {
            $uid = uuid();
            $pdo->prepare('INSERT INTO admin_users (id,email,name,role,pass_hash,status,created_at) VALUES (?,?,?,?,?,?,?)')
                ->execute([$uid, $i['email'], $name, $i['role'], password_hash($pass, PASSWORD_DEFAULT), 'active', now_iso()]);
        }
        $pdo->prepare('UPDATE admin_invites SET used_at = ? WHERE token_hash = ?')->execute([now_iso(), $i['token_hash']]);
        $pdo->commit();
        $q = $pdo->prepare('SELECT * FROM admin_users WHERE id = ?'); $q->execute([$uid]); $user = $q->fetch();
        $s = start_session($user); audit($user, $i['purpose'] === 'reset' ? 'password reset' : 'joined', $user['role']);
        json_out(['ok' => true, 'csrf' => $s['csrf']]);
    }

    if ($r === '/password' && $method === 'POST') {
        $u = require_user();
        $v = body_json(4000);
        $q = $pdo->prepare('SELECT pass_hash FROM admin_users WHERE id = ?'); $q->execute([$u['id']]);
        if (!password_verify((string)($v['current'] ?? ''), $q->fetch()['pass_hash'])) json_out(['error' => 'Current password is not correct.'], 400);
        if ($err = valid_password((string)($v['next'] ?? ''))) json_out(['error' => $err], 400);
        $pdo->prepare('UPDATE admin_users SET pass_hash = ? WHERE id = ?')->execute([password_hash((string)$v['next'], PASSWORD_DEFAULT), $u['id']]);
        $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ? AND token_hash != ?')->execute([$u['id'], $u['token_hash']]);
        audit($u, 'changed password');
        json_out(['ok' => true]);
    }

    // ---------- dashboard ----------
    if ($r === '/overview' && $method === 'GET') {
        $u = require_user('dashboard.view');
        $out = ['requests' => null];
        if (in_array('requests.view', $u['permissions'], true)) {
            $since = gmdate('Y-m-d\TH:i:s', time() - 30 * 86400);
            $c = fn($sql, $p = []) => (function () use ($pdo, $sql, $p) { $q = $pdo->prepare($sql); $q->execute($p); return (int)$q->fetch()['n']; })();
            $out['requests'] = [
                'new' => $c("SELECT COUNT(*) n FROM service_requests WHERE status = 'pending_confirmation'"),
                'last30' => $c('SELECT COUNT(*) n FROM service_requests WHERE created_at > ?', [$since]),
                'bookings' => $c("SELECT COUNT(*) n FROM service_requests WHERE type = 'booking' AND preferred_date >= ?", [toronto_today()]),
                'total' => $c('SELECT COUNT(*) n FROM service_requests'),
                'recent' => array_map('request_row', $pdo->query('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 6')->fetchAll()),
            ];
        }
        json_out($out);
    }

    // ---------- requests ----------
    if ($r === '/requests' && $method === 'GET') {
        require_user('requests.view');
        [$where, $p] = request_filter();
        $q = $pdo->prepare("SELECT * FROM service_requests $where ORDER BY created_at DESC LIMIT 500"); $q->execute($p);
        json_out(['requests' => array_map('request_row', $q->fetchAll()), 'statuses' => REQUEST_STATUSES]);
    }
    if ($r === '/requests/detail' && $method === 'GET') {
        require_user('requests.view');
        $q = $pdo->prepare('SELECT * FROM service_requests WHERE id = ?'); $q->execute([(string)($_GET['id'] ?? '')]);
        $row = $q->fetch(); if (!$row) json_out(['error' => 'Request not found'], 404);
        $n = $pdo->prepare('SELECT user_name, body, created_at FROM request_notes WHERE request_id = ? ORDER BY id'); $n->execute([$row['id']]);
        $u = current_user();
        json_out(['request' => request_row($row) + ['details' => json_decode($row['details'], true) ?: []], 'notes' => $n->fetchAll(),
            'replies' => reply_list($row['id']), 'reply' => ['signature' => reply_signature($u), 'replyTo' => reply_inbox(), 'subject' => reply_default_subject($row),
            'maxFile' => REPLY_FILE_MAX, 'maxTotal' => REPLY_TOTAL_MAX, 'types' => array_keys(REPLY_TYPES)]]);
    }
    if ($r === '/requests/reply' && $method === 'POST') {
        $u = require_user('requests.edit');
        if (empty($_POST) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) json_out(['error' => 'The attachments are too large for this server. Send fewer or smaller files.'], 413);
        $q = $pdo->prepare('SELECT * FROM service_requests WHERE id = ?'); $q->execute([(string)($_POST['id'] ?? '')]);
        $row = $q->fetch(); if (!$row) json_out(['error' => 'Request not found'], 404);
        $to = strtolower(trim((string)$row['email']));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $to)) json_out(['error' => 'This request has no valid customer email.'], 400);
        $subject = preg_replace('/[\r\n\t]+/', ' ', text($_POST['subject'] ?? '', 200));
        $body = str_replace("\r\n", "\n", text($_POST['body'] ?? '', 20000));
        $sig = str_replace("\r\n", "\n", text($_POST['signature'] ?? '', 1000));
        if ($subject === '') json_out(['error' => 'Add a subject.'], 400);
        if ($body === '') json_out(['error' => 'Write your message first.'], 400);
        if (rate_limited('reply:' . $u['id'], 40, 3600)) json_out(['error' => 'Too many emails in the last hour. Try again later.'], 429);
        try { $files = reply_take_uploads(); } catch (InvalidArgumentException $e) { json_out(['error' => $e->getMessage()], 400); }
        $msg = reply_compose($row, $to, $subject, $body, $sig, $files);
        $sent = reply_send($to, $msg);
        note_attempt('reply:' . $u['id']);
        $rid = uuid();
        $pdo->prepare('INSERT INTO request_replies (id,request_id,user_id,user_name,to_email,subject,body,signature,attachments,sent,error,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            ->execute([$rid, $row['id'], $u['id'], $u['name'], $to, $subject, $body, $sig, json_encode(array_map(fn($f) => ['name' => $f['name'], 'size' => $f['size'], 'mime' => $f['mime'], 'path' => $f['path']], $files), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $sent ? 1 : 0, $sent ? '' : 'The server could not send the email (mail() failed). Copy your message and send it from your inbox.', now_iso()]);
        audit($u, $sent ? 'replied to request' : 'reply to request failed', request_ref($row['id']) . ' → ' . $to . ' · ' . $subject . ($files ? ' · ' . count($files) . ' attachment(s)' : ''));
        $status = $row['status'];
        if ($sent && $status === 'pending_confirmation') {
            $pdo->prepare('UPDATE service_requests SET status = ? WHERE id = ? AND status = ?')->execute(['contacted', $row['id'], 'pending_confirmation']);
            audit($u, 'request status', $row['id'] . ' → contacted (email reply)'); $status = 'contacted';
        }
        if (($_POST['saveSignature'] ?? '') === '1') reply_signature_save($u, $sig);
        json_out(['ok' => true, 'sent' => $sent, 'status' => $status, 'replies' => reply_list($row['id'])]);
    }
    if ($r === '/requests/signature' && $method === 'POST') {
        $u = require_user('requests.edit');
        reply_signature_save($u, str_replace("\r\n", "\n", text(body_json(4000)['signature'] ?? '', 1000)));
        json_out(['ok' => true, 'signature' => reply_signature($u)]);
    }
    if ($r === '/requests/reply-file' && $method === 'GET') {
        require_user('requests.view');
        $q = $pdo->prepare('SELECT attachments FROM request_replies WHERE id = ?'); $q->execute([(string)($_GET['id'] ?? '')]);
        $row = $q->fetch(); $list = $row ? (json_decode((string)$row['attachments'], true) ?: []) : [];
        $f = $list[(int)($_GET['n'] ?? -1)] ?? null;
        if (!$f || !preg_match('#^replies/[a-f0-9]{32}$#', (string)($f['path'] ?? '')) || !is_file(reply_storage() . '/' . $f['path'])) json_out(['error' => 'File unavailable'], 404);
        $path = reply_storage() . '/' . $f['path']; $inline = in_array($f['mime'], ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'], true) && isset($_GET['inline']);
        while (ob_get_level()) ob_end_clean();
        header('Content-Type: ' . ($inline ? $f['mime'] : 'application/octet-stream'));
        header('Content-Length: ' . filesize($path));
        header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
        header('Cache-Control: private, max-age=3600');
        header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . preg_replace('/[^A-Za-z0-9._ ()-]/', '_', $f['name']) . '"; filename*=UTF-8\'\'' . rawurlencode($f['name']));
        readfile($path); exit;
    }
    if ($r === '/requests/update' && $method === 'POST') {
        $u = require_user('requests.edit');
        $v = body_json(4000);
        if (!isset(REQUEST_STATUSES[$v['status'] ?? ''])) json_out(['error' => 'Choose a valid status'], 400);
        $q = $pdo->prepare('UPDATE service_requests SET status = ? WHERE id = ?'); $q->execute([$v['status'], (string)($v['id'] ?? '')]);
        if (!$q->rowCount()) json_out(['error' => 'Request not found'], 404);
        audit($u, 'request status', ($v['id'] ?? '') . ' → ' . $v['status']);
        json_out(['ok' => true]);
    }
    if ($r === '/requests/note' && $method === 'POST') {
        $u = require_user('requests.edit');
        $v = body_json(8000);
        $body = text($v['body'] ?? '', 2000); if (!$body) json_out(['error' => 'Write a note first'], 400);
        $pdo->prepare('INSERT INTO request_notes (request_id,user_name,body,created_at) VALUES (?,?,?,?)')->execute([(string)($v['id'] ?? ''), $u['name'], $body, now_iso()]);
        json_out(['ok' => true]);
    }
    if ($r === '/requests/export' && $method === 'GET') {
        $u = require_user('requests.export');
        [$where, $p] = request_filter();
        $q = $pdo->prepare("SELECT * FROM service_requests $where ORDER BY created_at DESC"); $q->execute($p);
        audit($u, 'exported requests');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="satin-requests-' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w'); fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['Reference', 'Created', 'Type', 'Service', 'Status', 'Name', 'Email', 'Phone', 'Preferred date', 'Preferred time', 'Notes', 'Estimate']);
        foreach ($q->fetchAll() as $row) {
            $d = json_decode($row['details'], true) ?: [];
            fputcsv($out, array_map('csv_safe', [request_ref($row['id']), $row['created_at'], $row['type'], $row['service'], REQUEST_STATUSES[$row['status']] ?? $row['status'], $row['name'], $row['email'], $row['phone'], $row['preferred_date'], $row['preferred_time'], $d['notes'] ?? '', $d['estimate'] ?? '']));
        }
        exit;
    }

    // ---------- members & roles ----------
    if ($r === '/members' && $method === 'GET') {
        require_user('members.manage');
        $users = array_map('public_user', $pdo->query('SELECT * FROM admin_users ORDER BY created_at')->fetchAll());
        $inv = $pdo->prepare('SELECT substr(token_hash,1,16) id, email, name, role, created_at createdAt, expires_at expiresAt FROM admin_invites WHERE used_at IS NULL AND expires_at > ? AND purpose = \'invite\' ORDER BY created_at DESC'); $inv->execute([time()]);
        json_out(['members' => $users, 'invites' => $inv->fetchAll(), 'roles' => array_values(all_roles()), 'permissions' => PERMISSIONS]);
    }
    if ($r === '/members/invite' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(4000);
        $email = strtolower(text($v['email'] ?? '', 254)); $name = text($v['name'] ?? '', 80); $role = (string)($v['role'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'Add a valid email'], 400);
        if ($role === 'owner' || !isset(all_roles()[$role])) json_out(['error' => 'Choose a role'], 400);
        $q = $pdo->prepare('SELECT 1 FROM admin_users WHERE email = ?'); $q->execute([$email]);
        if ($q->fetch()) json_out(['error' => 'This person is already a member. Change their role instead.'], 409);
        $link = create_link($email, $name, $role, 'invite', $u, 72);
        $sent = send_mail($email, 'You are invited to the Satin website admin', "Hello" . ($name ? " $name" : '') . ",\n\n{$u['name']} invited you to the Satin website admin as " . (all_roles()[$role]['name']) . ".\n\nAccept the invitation and choose your password within 3 days:\n\n$link\n");
        audit($u, 'invited member', "$email as $role");
        json_out(['ok' => true, 'link' => $link, 'emailed' => $sent]);
    }
    if ($r === '/members/update' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(4000);
        $q = $pdo->prepare('SELECT * FROM admin_users WHERE id = ?'); $q->execute([(string)($v['id'] ?? '')]); $m = $q->fetch();
        if (!$m) json_out(['error' => 'Member not found'], 404);
        if ($m['role'] === 'owner' && $u['role'] !== 'owner') json_out(['error' => 'Only the owner can change the owner account.'], 403);
        $role = $v['role'] ?? $m['role']; $status = $v['status'] ?? $m['status'];
        if (!isset(all_roles()[$role]) || !in_array($status, ['active', 'suspended'], true)) json_out(['error' => 'Check role and status'], 400);
        if ($role === 'owner' && $u['role'] !== 'owner') json_out(['error' => 'Only the owner can give owner access.'], 403);
        if ($m['role'] === 'owner' && ($role !== 'owner' || $status !== 'active') && owners_count() <= 1) json_out(['error' => 'Keep at least one active owner.'], 400);
        if ($m['id'] === $u['id'] && $status !== 'active') json_out(['error' => 'You cannot suspend yourself.'], 400);
        $pdo->prepare('UPDATE admin_users SET role = ?, status = ? WHERE id = ?')->execute([$role, $status, $m['id']]);
        if ($status !== 'active') $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$m['id']]);
        audit($u, 'updated member', "{$m['email']}: $role, $status");
        json_out(['ok' => true]);
    }
    if ($r === '/members/remove' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(2000);
        $q = $pdo->prepare('SELECT * FROM admin_users WHERE id = ?'); $q->execute([(string)($v['id'] ?? '')]); $m = $q->fetch();
        if (!$m) json_out(['error' => 'Member not found'], 404);
        if ($m['id'] === $u['id']) json_out(['error' => 'You cannot remove yourself.'], 400);
        if ($m['role'] === 'owner' && ($u['role'] !== 'owner' || owners_count() <= 1)) json_out(['error' => 'The owner account cannot be removed.'], 403);
        $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$m['id']]);
        $pdo->prepare('DELETE FROM admin_users WHERE id = ?')->execute([$m['id']]);
        audit($u, 'removed member', $m['email']);
        json_out(['ok' => true]);
    }
    if ($r === '/invites/revoke' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(2000);
        $pdo->prepare('UPDATE admin_invites SET used_at = ? WHERE substr(token_hash,1,16) = ? AND used_at IS NULL')->execute([now_iso() . ' (revoked)', (string)($v['id'] ?? '')]);
        audit($u, 'revoked invite', (string)($v['id'] ?? ''));
        json_out(['ok' => true]);
    }
    if ($r === '/roles/save' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(8000);
        $id = (string)($v['id'] ?? '');
        if (isset(SYSTEM_ROLES[$id])) json_out(['error' => 'Built-in roles cannot be changed. Create a custom role instead.'], 400);
        $name = text($v['name'] ?? '', 60); if (mb_strlen($name) < 2) json_out(['error' => 'Name the role'], 400);
        $perms = array_values(array_intersect((array)($v['permissions'] ?? []), array_keys(PERMISSIONS)));
        if (!$perms) json_out(['error' => 'Choose at least one permission'], 400);
        if ($id === '') { $id = 'custom-' . substr(uuid(), 0, 8); $pdo->prepare('INSERT INTO admin_roles (id,name,description,permissions,created_at) VALUES (?,?,?,?,?)')->execute([$id, $name, text($v['description'] ?? '', 200), json_encode($perms), now_iso()]); }
        else { $q = $pdo->prepare('UPDATE admin_roles SET name = ?, description = ?, permissions = ? WHERE id = ?'); $q->execute([$name, text($v['description'] ?? '', 200), json_encode($perms), $id]); if (!$q->rowCount()) json_out(['error' => 'Role not found'], 404); }
        audit($u, 'saved role', "$name: " . implode(', ', $perms));
        json_out(['ok' => true, 'id' => $id]);
    }
    if ($r === '/roles/delete' && $method === 'POST') {
        $u = require_user('members.manage');
        $v = body_json(2000); $id = (string)($v['id'] ?? '');
        if (isset(SYSTEM_ROLES[$id])) json_out(['error' => 'Built-in roles cannot be deleted.'], 400);
        $q = $pdo->prepare('SELECT COUNT(*) n FROM admin_users WHERE role = ?'); $q->execute([$id]);
        if ((int)$q->fetch()['n'] > 0) json_out(['error' => 'Move members to another role first.'], 400);
        $pdo->prepare('DELETE FROM admin_roles WHERE id = ?')->execute([$id]);
        audit($u, 'deleted role', $id);
        json_out(['ok' => true]);
    }
    if ($r === '/audit' && $method === 'GET') {
        require_user('audit.view');
        json_out(['entries' => $pdo->query('SELECT user_name userName, action, detail, ip, created_at createdAt FROM admin_audit ORDER BY id DESC LIMIT 300')->fetchAll()]);
    }

    if (str_starts_with($r, '/shop/')) { require_once __DIR__ . '/commerce_admin.php'; shop_admin_route($r, $method); }
    if (str_starts_with($r, '/chat/')) { require_once __DIR__ . '/chat_admin.php'; chat_admin_route($r, $method); }
    if ($r === '/badges' || $r === '/badges/seen' || str_starts_with($r, '/push/')) { require_once __DIR__ . '/push.php'; push_admin_route($r, $method); }
    if ($r === '/customer-login' || str_starts_with($r, '/customer-accounts')) { require_once __DIR__ . '/customer.php'; customer_admin_route($r, $method); }
    if (str_starts_with($r, '/invoices') || str_starts_with($r, '/customers') || $r === '/analytics') { require_once __DIR__ . '/site_api.php'; require_once __DIR__ . '/invoices_api.php'; invoices_route($r, $method); }
    if ($r === '/quotes' || str_starts_with($r, '/quotes/')) { require_once __DIR__ . '/site_api.php'; require_once __DIR__ . '/invoices_api.php'; require_once __DIR__ . '/quotes_api.php'; quotes_route($r, $method); }
    if ($r === '/promotions') { require_once __DIR__ . '/catalog.php'; promo_route($r, $method); }
    if ($r === '/estimator-pricing') { require_once __DIR__ . '/estimator_pricing.php'; ep_route($method); }
    if ($r === '/catalog' || str_starts_with($r, '/catalog/')) { require_once __DIR__ . '/catalog.php'; catalog_route($r, $method); }
    if ($r === '/esign' || str_starts_with($r, '/esign/')) { require_once __DIR__ . '/esign.php'; esign_admin_route($r, $method); }
    if ($r === '/feedback' && $method === 'GET') { require_once __DIR__ . '/feedback.php'; feedback_report(); }
    if ($r === '/portfolio' || str_starts_with($r, '/portfolio/')) { require_once __DIR__ . '/portfolio.php'; pf_admin_route($r, $method); }
    if (str_starts_with($r, '/site/') || str_starts_with($r, '/media')) { require_once __DIR__ . '/site_api.php'; site_route($r, $method); }

    json_out(['error' => 'This part of the admin is coming soon.'], 404);
}

function owners_count(): int { return (int)adb()->query("SELECT COUNT(*) n FROM admin_users WHERE role = 'owner' AND status = 'active'")->fetch()['n']; }
function request_ref(string $id): string { return 'SG-' . strtoupper(substr($id, 0, 8)); }
function csv_safe($v): string { $v = (string)$v; return preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v; }
function request_row(array $r): array {
    $d = json_decode($r['details'] ?? '', true) ?: [];
    return ['id' => $r['id'], 'reference' => request_ref($r['id']), 'type' => $r['type'], 'service' => $r['service'], 'name' => $r['name'], 'email' => $r['email'], 'phone' => $r['phone'],
        'preferredDate' => $r['preferred_date'], 'preferredTime' => $r['preferred_time'], 'status' => $r['status'], 'createdAt' => $r['created_at'], 'notes' => mb_substr((string)($d['notes'] ?? ''), 0, 160), 'estimate' => mb_substr((string)($d['estimate'] ?? ''), 0, 160)];
}
function request_filter(): array {
    $w = []; $p = [];
    if (!empty($_GET['status']) && isset(REQUEST_STATUSES[$_GET['status']])) { $w[] = 'status = ?'; $p[] = $_GET['status']; }
    if (!empty($_GET['type']) && in_array($_GET['type'], ['quote', 'booking'], true)) { $w[] = 'type = ?'; $p[] = $_GET['type']; }
    if (!empty($_GET['q'])) { $s = '%' . text((string)$_GET['q'], 80) . '%'; $w[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ? OR service LIKE ? OR id LIKE ?)'; array_push($p, $s, $s, $s, $s, $s); }
    return [$w ? 'WHERE ' . implode(' AND ', $w) : '', $p];
}

/* ---------- email replies to quote & booking requests ---------- */
const REPLY_FILE_MAX = 10 * 1024 * 1024;   // per attachment
const REPLY_TOTAL_MAX = 20 * 1024 * 1024;  // all attachments of one reply
const REPLY_MAX_FILES = 10;
const REPLY_TYPES = [ // extension => MIME type sent in the email
    'pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ai' => 'application/postscript', 'eps' => 'application/postscript', 'svg' => 'image/svg+xml', 'zip' => 'application/zip',
];
const REPLY_BUSINESS_LINE = 'Satin Graphic · 50 Viceroy Rd, Unit 22–23, Vaughan, ON · 905-695-9147 · info@satingraphic.ca · satingraphic.ca';

function migrate_replies(PDO $pdo): void {
    static $done = false; if ($done) return; $done = true;
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $k = $my ? 'VARCHAR(64)' : 'TEXT'; $s = $my ? 'VARCHAR(255)' : 'TEXT'; $t = $my ? 'MEDIUMTEXT' : 'TEXT'; $cs = $my ? ' DEFAULT CHARSET=utf8mb4' : '';
    $pdo->exec("CREATE TABLE IF NOT EXISTS request_replies (id $k PRIMARY KEY, request_id $k NOT NULL, user_id $s, user_name $s NOT NULL, to_email $s NOT NULL, subject $s NOT NULL, body $t NOT NULL, signature $t NOT NULL, attachments $t NOT NULL, sent INTEGER NOT NULL DEFAULT 0, error $t NOT NULL, created_at $s NOT NULL)$cs");
    try { $pdo->exec('CREATE INDEX ' . ($my ? '' : 'IF NOT EXISTS ') . 'idx_reply_request ON request_replies (request_id)'); } catch (Throwable $e) { }
}
/** Private folder for reply attachments (same storage root as shop uploads and chat files; web access denied). */
function reply_storage(): string {
    $base = (string)(cfg('storage_dir') ?: __DIR__ . '/storage');
    if (!is_dir($base)) @mkdir($base, 0750, true);
    if (!is_file($base . '/.htaccess')) @file_put_contents($base . '/.htaccess', "Require all denied\nDeny from all\n");
    if (!is_dir($base . '/replies')) @mkdir($base . '/replies', 0750, true);
    return $base;
}
function reply_inbox(): string {
    $e = (string)cfg('notify_email', '');
    return filter_var($e, FILTER_VALIDATE_EMAIL) && !preg_match('/[\r\n]/', $e) ? $e : 'info@satingraphic.ca';
}
function reply_signature(?array $u): string {
    if (!$u) return '';
    $q = adb()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute(['reply.signature.' . $u['id']]);
    $v = $q->fetch(); $s = $v ? json_decode((string)$v['v'], true) : null;
    return is_string($s) && trim($s) !== '' ? $s : $u['name'] . "\n" . REPLY_BUSINESS_LINE;
}
function reply_signature_save(array $u, string $sig): void {
    $pdo = adb(); $k = 'reply.signature.' . $u['id'];
    $pdo->prepare('DELETE FROM site_settings WHERE k = ?')->execute([$k]);
    if (trim($sig) !== '') $pdo->prepare('INSERT INTO site_settings (k,v,updated_at) VALUES (?,?,?)')->execute([$k, json_encode($sig, JSON_UNESCAPED_UNICODE), now_iso()]);
}
function reply_default_subject(array $row): string {
    return 'Re: Your ' . trim((string)$row['service']) . ' ' . ($row['type'] === 'booking' ? 'booking' : 'quote') . ' request ' . request_ref($row['id']) . ' — Satin Graphic';
}
function reply_list(string $requestId): array {
    $q = adb()->prepare('SELECT * FROM request_replies WHERE request_id = ? ORDER BY created_at, id'); $q->execute([$requestId]);
    return array_map(fn($x) => ['id' => $x['id'], 'userName' => $x['user_name'], 'to' => $x['to_email'], 'subject' => $x['subject'], 'body' => $x['body'], 'signature' => $x['signature'],
        'attachments' => array_map(fn($f) => ['name' => $f['name'], 'size' => (int)$f['size'], 'mime' => $f['mime']], json_decode((string)$x['attachments'], true) ?: []),
        'sent' => (bool)(int)$x['sent'], 'error' => $x['error'], 'createdAt' => $x['created_at']], $q->fetchAll());
}
/** Does the file start like the type its extension claims? (Admin uploads, but never mail out a mislabelled executable.) */
function reply_sniff_ok(string $ext, string $head): bool {
    $zip = strncmp($head, "PK\x03\x04", 4) === 0;
    $ps = strncmp($head, '%!PS', 4) === 0 || strncmp($head, "\xC5\xD0\xD3\xC6", 4) === 0;
    $pdf = strpos(substr($head, 0, 1024), '%PDF-') !== false;
    if ($ext === 'pdf') return $pdf;
    if ($ext === 'jpg' || $ext === 'jpeg') return strncmp($head, "\xFF\xD8\xFF", 3) === 0;
    if ($ext === 'png') return strncmp($head, "\x89PNG\r\n\x1a\n", 8) === 0;
    if ($ext === 'webp') return substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP';
    if ($ext === 'docx' || $ext === 'xlsx' || $ext === 'zip') return $zip;
    if ($ext === 'ai') return $pdf || $ps;
    if ($ext === 'eps') return $ps;
    if ($ext === 'svg') return (bool)preg_match('/^(?:<\?xml[^>]*>\s*)?(?:<!--.*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/is', ltrim(substr($head, 0, 4096), "\xEF\xBB\xBF \t\r\n"));
    return false;
}
/** Validates the uploaded files (field files[]) and moves them into private storage. */
function reply_take_uploads(): array {
    $in = $_FILES['files'] ?? null; $list = [];
    if (is_array($in) && is_array($in['name'] ?? null)) foreach ($in['name'] as $i => $n) $list[] = ['name' => $n, 'tmp_name' => $in['tmp_name'][$i], 'error' => $in['error'][$i], 'size' => $in['size'][$i]];
    if (count($list) > REPLY_MAX_FILES) throw new InvalidArgumentException('Attach at most ' . REPLY_MAX_FILES . ' files.');
    $total = 0; $ok = [];
    foreach ($list as $f) {
        $name = trim(preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', '_', (string)$f['name'])); $name = mb_substr($name !== '' ? $name : 'file', -120);
        if ((int)$f['error'] === UPLOAD_ERR_INI_SIZE || (int)$f['error'] === UPLOAD_ERR_FORM_SIZE) throw new InvalidArgumentException("$name is too large for this server.");
        if ((int)$f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string)$f['tmp_name'])) throw new InvalidArgumentException("$name could not be uploaded. Try again.");
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (!isset(REPLY_TYPES[$ext])) throw new InvalidArgumentException("$name: this file type can’t be attached. Use PDF, JPG, PNG, WebP, DOCX, XLSX, AI, EPS, SVG or ZIP.");
        $size = (int)filesize($f['tmp_name']);
        if ($size < 1) throw new InvalidArgumentException("$name is empty.");
        if ($size > REPLY_FILE_MAX) throw new InvalidArgumentException("$name is larger than 10 MB.");
        $total += $size;
        if ($total > REPLY_TOTAL_MAX) throw new InvalidArgumentException('Attachments can be 20 MB in total.');
        $fh = fopen($f['tmp_name'], 'rb'); $head = (string)fread($fh, 8192); fclose($fh);
        if (!reply_sniff_ok($ext, $head)) throw new InvalidArgumentException("$name doesn’t look like a real .$ext file.");
        $ok[] = ['tmp' => $f['tmp_name'], 'name' => $name, 'size' => $size, 'mime' => REPLY_TYPES[$ext]];
    }
    $base = reply_storage(); $out = [];
    foreach ($ok as $f) {
        $path = 'replies/' . bin2hex(random_bytes(16));
        if (!move_uploaded_file($f['tmp'], $base . '/' . $path)) throw new InvalidArgumentException('An attachment could not be saved. Please retry.');
        @chmod($base . '/' . $path, 0640);
        $out[] = ['name' => $f['name'], 'size' => $f['size'], 'mime' => $f['mime'], 'path' => $path, 'file' => $base . '/' . $path];
    }
    return $out;
}
/** The customer's submission as label/value rows — the same facts the admin drawer shows. */
function reply_request_facts(array $row): array {
    $d = json_decode((string)$row['details'], true) ?: [];
    $rows = [['Reference', request_ref($row['id'])], ['Request', ($row['type'] === 'booking' ? 'Booking' : 'Quote') . ' · ' . $row['service']], ['Name', $row['name']], ['Email', $row['email']], ['Phone', $row['phone']]];
    if ($row['preferred_date']) $rows[] = ['Preferred date/time', trim($row['preferred_date'] . ' ' . $row['preferred_time'])];
    foreach (['contactPreference' => 'Contact by', 'vehicle' => 'Vehicle', 'plan' => 'Plan'] as $k => $l) if (!empty($d[$k]) && is_scalar($d[$k])) $rows[] = [$l, (string)$d[$k]];
    if (!empty($d['services']) && is_array($d['services'])) $rows[] = ['Services', implode(', ', array_map('strval', array_filter($d['services'], 'is_scalar')))];
    foreach (is_array($d['custom'] ?? null) ? $d['custom'] : [] as $k => $v) $rows[] = [ucfirst(str_replace(['_', '-'], ' ', (string)$k)), is_scalar($v) ? (string)$v : implode(', ', array_map('strval', array_filter((array)$v, 'is_scalar')))];
    if (!empty($d['estimate']) && is_scalar($d['estimate'])) $rows[] = ['Estimate', (string)$d['estimate']];
    if (!empty($d['designRequested'])) $rows[] = ['Design', 'Design service requested'];
    if (!empty($d['notes']) && is_scalar($d['notes'])) $rows[] = ['Notes', (string)$d['notes']];
    if (!empty($d['attachments']) && is_array($d['attachments'])) $rows[] = ['Attachments', implode("\n", array_map(fn($a) => (string)($a['name'] ?? 'file'), array_filter($d['attachments'], 'is_array')))];
    return array_values(array_filter($rows, fn($r) => trim((string)$r[1]) !== ''));
}
function reply_received_line(array $row): string {
    $t = strtotime((string)$row['created_at']); $when = $t ? (new DateTime('@' . $t))->setTimezone(new DateTimeZone('America/Toronto'))->format('M j, Y \a\t g:i A') : (string)$row['created_at'];
    return "On $when, {$row['name']} <{$row['email']}> sent this " . ($row['type'] === 'booking' ? 'booking' : 'quote') . ' request on satingraphic.ca:';
}
/** Builds the RFC 5322 / MIME message: multipart/mixed { multipart/alternative { text, html }, attachments… }. */
function reply_compose(array $row, string $to, string $subject, string $body, string $sig, array $files): array {
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $facts = reply_request_facts($row); $intro = reply_received_line($row);
    $quoted = "$intro\n>\n";
    foreach ($facts as [$l, $v]) { $lines = explode("\n", str_replace("\r", '', $v)); $quoted .= "> $l: " . array_shift($lines) . "\n"; foreach ($lines as $x) $quoted .= ">   $x\n"; }
    $text = rtrim($body) . "\n\n" . ($sig !== '' ? "-- \n" . rtrim($sig) . "\n\n" : '') . rtrim($quoted) . "\n";
    $html = '<!doctype html><html><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#16181d">'
        . '<div dir="auto" style="white-space:pre-wrap">' . $e(rtrim($body)) . '</div>'
        . ($sig !== '' ? '<div style="margin-top:18px;padding-top:10px;border-top:1px solid #e5e7eb;color:#4b5563;font-size:13px;white-space:pre-wrap">' . $e(rtrim($sig)) . '</div>' : '')
        . '<div style="margin-top:24px;color:#6b7280;font-size:12.5px">' . $e($intro) . '</div>'
        . '<blockquote style="margin:8px 0 0;padding:4px 0 4px 12px;border-left:3px solid #d1d5db;color:#374151"><table role="presentation" style="border-collapse:collapse;font-size:13px">'
        . implode('', array_map(fn($r) => '<tr><td style="padding:3px 14px 3px 0;color:#6b7280;vertical-align:top;white-space:nowrap">' . $e($r[0]) . '</td><td style="padding:3px 0;white-space:pre-wrap">' . $e($r[1]) . '</td></tr>', $facts))
        . '</table></blockquote></body></html>';
    $from = (string)cfg('mail_from', 'no-reply@satingraphic.ca');
    $mixed = 'satin-mx-' . bin2hex(random_bytes(10)); $alt = 'satin-alt-' . bin2hex(random_bytes(10));
    $headers = "From: =?UTF-8?B?" . base64_encode('Satin Graphic') . "?= <$from>\r\nReply-To: " . reply_inbox() . "\r\nMIME-Version: 1.0\r\n"
        . 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (substr(strrchr($from, '@') ?: '@satingraphic.ca', 1)) . ">\r\nX-Satin-Request: " . request_ref($row['id']) . "\r\n"
        . ($files ? "Content-Type: multipart/mixed; boundary=\"$mixed\"" : "Content-Type: multipart/alternative; boundary=\"$alt\"");
    $altPart = "--$alt\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
        . "--$alt\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "--$alt--\r\n";
    if (!$files) $mime = $altPart;
    else {
        $mime = "This is a multi-part message in MIME format.\r\n\r\n--$mixed\r\nContent-Type: multipart/alternative; boundary=\"$alt\"\r\n\r\n" . $altPart;
        foreach ($files as $f) {
            // ASCII names: plain filename. Others: RFC 2231 filename*=UTF-8''… (+ RFC 2047 name= for older mail apps). A plain
            // ASCII fallback is left out on purpose: several mail apps prefer it over filename* and would show "____.pdf".
            $plain = preg_match('/^[A-Za-z0-9._ ()+,=@-]+$/', $f['name']) === 1;
            $mime .= "\r\n--$mixed\r\nContent-Type: {$f['mime']}; name=\"" . ($plain ? $f['name'] : '=?UTF-8?B?' . base64_encode($f['name']) . '?=') . "\"\r\nContent-Transfer-Encoding: base64\r\n"
                . 'Content-Disposition: attachment; ' . ($plain ? "filename=\"{$f['name']}\"" : "filename*=UTF-8''" . rawurlencode($f['name'])) . "\r\n\r\n" . chunk_split(base64_encode((string)file_get_contents($f['file'])));
        }
        $mime .= "\r\n--$mixed--\r\n";
    }
    return ['subject' => '=?UTF-8?B?' . base64_encode($subject) . '?=', 'headers' => $headers, 'body' => $mime, 'text' => $text];
}
/** Sends with PHP mail() like the other helpers. For testing only: cfg('mail_log_dir') writes the raw message (.eml) there instead. */
function reply_send(string $to, array $m): bool {
    $dir = (string)cfg('mail_log_dir', '');
    if ($dir !== '') {
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
        return (bool)@file_put_contents($dir . '/reply-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.eml', "To: $to\r\nSubject: {$m['subject']}\r\n{$m['headers']}\r\n\r\n{$m['body']}");
    }
    return mail_raw($to, $m['subject'], $m['headers'], $m['body']);
}
