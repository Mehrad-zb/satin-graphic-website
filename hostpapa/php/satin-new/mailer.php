<?php
declare(strict_types=1);
/*
 * Outgoing email for the whole site (invoices, order updates, account links, staff alerts).
 *
 * Why mail used to land in spam: PHP mail() went out with the hosting account as the envelope sender, a bare text body and
 * no Message-ID / Date, so receiving servers could not tie the message to satingraphic.ca (SPF / DMARC alignment failed).
 *
 * Now:
 *  - If Admin → Notifications & app → "Email delivery" has an SMTP account (recommended: the Google Workspace mailbox
 *    info@satingraphic.ca with an app password, smtp.gmail.com : 587), every email is sent through it, signed by Google.
 *  - Otherwise PHP mail() is used with the envelope sender set to the From address (-f), so SPF passes for satingraphic.ca
 *    (its SPF record includes this host), plus Date, Message-ID, Reply-To and a text + HTML body.
 * SMTP failures fall back to mail() and are logged (error_log), so an email is never silently dropped by a bad password.
 */

function mail_settings(): array {
    $v = [];
    try { $q = db()->prepare('SELECT v FROM site_settings WHERE k = ?'); $q->execute(['mail_delivery']); $r = $q->fetch(); $v = $r ? (json_decode((string)$r['v'], true) ?: []) : []; } catch (Throwable $e) {}
    $d = ['host' => (string)cfg('smtp_host', ''), 'port' => (int)cfg('smtp_port', 587), 'user' => (string)cfg('smtp_user', ''), 'pass' => (string)cfg('smtp_pass', ''),
        'from' => (string)cfg('mail_from', 'no-reply@satingraphic.ca'), 'fromName' => 'Satin Graphic', 'replyTo' => 'info@satingraphic.ca'];
    foreach ($d as $k => $x) if (isset($v[$k]) && $v[$k] !== '' && $v[$k] !== null) $d[$k] = is_int($x) ? (int)$v[$k] : (string)$v[$k];
    return $d;
}

/** Plain text → simple, readable HTML (links clickable). */
function mail_text_html(string $text): string {
    $h = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
    $h = preg_replace('#(https?://[^\s<]+)#', '<a href="$1" style="color:#1d4ed8">$1</a>', $h);
    return '<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#16181d"><table role="presentation" width="100%" style="border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px"><tr><td style="padding:26px;font-size:14px;line-height:1.6;white-space:pre-line">' . $h
        . '</td></tr></table><p style="font-size:11px;color:#8a8f98;margin:14px 0 0">Satin Graphic · 50 Viceroy Rd, Unit 22–23, Vaughan, ON · (905) 962-6222</p></td></tr></table></body></html>';
}

function mail_hdr(string $s): string { return preg_match('/[^\x20-\x7e]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s; }

/**
 * Sends one email. $html optional (made from the text when missing). $o: replyTo, fromName.
 * Returns true when the message was accepted by the SMTP server or by mail().
 */
function mail_out(string $to, string $subject, string $text, ?string $html = null, array $o = []): bool {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $s = mail_settings();
    $from = filter_var($s['from'], FILTER_VALIDATE_EMAIL) ? $s['from'] : 'no-reply@satingraphic.ca';
    if ($s['host'] !== '' && filter_var($s['user'], FILTER_VALIDATE_EMAIL)) $from = $s['user']; // Gmail / most SMTP servers only send as the signed-in mailbox
    $name = str_replace(['"', "\r", "\n"], '', (string)($o['fromName'] ?? $s['fromName']));
    $reply = (string)($o['replyTo'] ?? $s['replyTo']);
    $html = $html ?? mail_text_html($text);
    $dom = substr(strrchr($from, '@'), 1) ?: 'satingraphic.ca';
    $b = 'satin-' . bin2hex(random_bytes(10));
    $qp = fn($x) => quoted_printable_encode(str_replace(["\r\n", "\r"], "\n", $x));
    $headers = [
        'Date: ' . date('r'),
        'From: ' . mail_hdr($name) . " <$from>",
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $dom . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $b . '"',
    ];
    if (filter_var($reply, FILTER_VALIDATE_EMAIL) && strcasecmp($reply, $from) !== 0) $headers[] = "Reply-To: $reply";
    $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n" . $qp($text) . "\r\n"
        . "--$b\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n" . $qp($html) . "\r\n--$b--\r\n";
    $subj = mail_hdr($subject);
    if ($s['host'] !== '' && $s['user'] !== '' && $s['pass'] !== '') {
        try { smtp_send($s, $from, $to, array_merge(["To: $to", "Subject: $subj"], $headers), $body); return true; }
        catch (Throwable $e) { error_log('satin mail SMTP failed, using mail(): ' . $e->getMessage()); }
    }
    $body = str_replace("\r\n", "\n", $body); // mail() adds CR itself on most hosts
    return @mail($to, $subj, $body, implode("\r\n", $headers), '-f' . $from);
}

/** Minimal SMTP client: STARTTLS (587) or implicit TLS (465), AUTH LOGIN. Throws on any error. */
function smtp_send(array $s, string $from, string $to, array $headers, string $body): void {
    $port = (int)$s['port'] ?: 587; $host = (string)$s['host'];
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $host]]);
    $fp = @stream_socket_client(($port === 465 ? 'ssl://' : 'tcp://') . $host . ':' . $port, $en, $es, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("connect $host:$port: $es");
    stream_set_timeout($fp, 20);
    $read = function () use ($fp): array { $all = ''; while (($l = fgets($fp, 2048)) !== false) { $all .= $l; if (strlen($l) < 4 || $l[3] === ' ') break; } return [(int)substr($all, 0, 3), $all]; };
    $cmd = function (string $c, array $ok) use ($fp, $read): string { if ($c !== '') fwrite($fp, $c . "\r\n"); [$code, $txt] = $read(); if (!in_array($code, $ok, true)) throw new RuntimeException(trim(preg_replace('/AUTH.*|[A-Za-z0-9+\/=]{20,}/', '', $c)) . ' → ' . trim($txt)); return $txt; };
    try {
        $cmd('', [220]);
        $ehlo = $cmd('EHLO satingraphic.ca', [250]);
        if ($port !== 465) {
            if (stripos($ehlo, 'STARTTLS') === false) throw new RuntimeException('server has no STARTTLS');
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT : 0))) throw new RuntimeException('TLS failed');
            $cmd('EHLO satingraphic.ca', [250]);
        }
        $cmd('AUTH LOGIN', [334]); $cmd(base64_encode((string)$s['user']), [334]); $cmd(base64_encode((string)$s['pass']), [235]);
        $cmd("MAIL FROM:<$from>", [250]); $cmd("RCPT TO:<$to>", [250, 251]); $cmd('DATA', [354]);
        $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        $data = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], ["\n", "\n"], $data));
        fwrite($fp, str_replace("\n", "\r\n", $data) . "\r\n.\r\n");
        $cmd('', [250]);
        @fwrite($fp, "QUIT\r\n");
    } finally { @fclose($fp); }
}

/** Pre-built MIME message (e.g. replies with attachments): same delivery path as mail_out (SMTP when set up, else mail() -f). */
function mail_raw(string $to, string $subject, string $headers, string $body): bool {
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
    $s = mail_settings();
    $from = filter_var($s['from'], FILTER_VALIDATE_EMAIL) ? $s['from'] : 'no-reply@satingraphic.ca';
    $useSmtp = $s['host'] !== '' && $s['user'] !== '' && $s['pass'] !== '';
    if ($useSmtp && filter_var($s['user'], FILTER_VALIDATE_EMAIL)) { $from = $s['user']; $headers = preg_replace('/^From:\s*(.*?)<[^>]+>/mi', 'From: $1<' . $from . '>', $headers); }
    if (!preg_match('/^Date:/mi', $headers)) $headers = 'Date: ' . date('r') . "\r\n" . $headers;
    if (!preg_match('/^Message-ID:/mi', $headers)) $headers = 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (substr(strrchr($from, '@'), 1) ?: 'satingraphic.ca') . ">\r\n" . $headers;
    if ($useSmtp) {
        try { smtp_send($s, $from, $to, array_merge(["To: $to", "Subject: $subject"], preg_split('/\r?\n(?![ \t])/', trim($headers))), $body); return true; }
        catch (Throwable $e) { error_log('satin mail SMTP failed, using mail(): ' . $e->getMessage()); }
    }
    return @mail($to, $subject, $body, $headers, '-f' . $from);
}
