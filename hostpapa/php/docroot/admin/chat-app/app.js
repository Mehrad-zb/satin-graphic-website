/* Satin Chat — staff inbox for website chats, as an installable phone app (WhatsApp-style).
   Uses the same staff sign-in, permissions and endpoints as Admin → Live chat (/api/admin/chat/*).
   Nothing private is cached by the service worker: every list and message comes from the API. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
let ME = null, CSRF = '', PERMS = [];
const can = p => PERMS.includes(p);

async function api(path, body) {
  const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(body) };
  const r = await fetch('/api/admin' + path, { credentials: 'same-origin', cache: 'no-store', ...opt });
  let d = {}; try { d = await r.json(); } catch {}
  if (r.status === 401 && d.signin) { ME = null; login(); throw new Error('Please sign in.'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong.');
  return d;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); }

const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>', send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  clip: '<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>', belloff: '<path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8"/><path d="M10 20.5a2 2 0 0 0 4 0M3 3l18 18"/>',
  more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', admin: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>', person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>'
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const initials = n => (n || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatar = (name, online) => `<span class="ca-ava" style="--h:${hue(name)}">${esc(initials(name))}${online ? '<i class="ca-on"></i>' : ''}</span>`;
const day = s => { const d = new Date(s), t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
  return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }); };
const hm = s => new Date(s).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
const when = s => { if (!s) return ''; const d = new Date(s); return d.toDateString() === new Date().toDateString() ? hm(s) : (Date.now() - d) < 6 * 864e5 ? d.toLocaleDateString('en-CA', { weekday: 'short' }) : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fileUrl = (f, thumb) => '/api/admin/chat/file?id=' + encodeURIComponent(f.id) + (thumb ? '&thumb=1' : '');
function richText(text) { // escaped text with clickable links, emails and phone numbers
  return esc(text).replace(/(https:\/\/[^\s<>"')]+|\/satin\/[A-Za-z0-9\/_-]*|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\(?\b\d{3}\)?[ .-]\d{3}-\d{4}\b)/g, m => {
    const href = m.includes('@') && !m.startsWith('http') ? 'mailto:' + m : /^\(?\d/.test(m) ? 'tel:+1' + m.replace(/\D/g, '') : m;
    return `<a href="${href}" target="_blank" rel="noopener">${m}</a>`; });
}

/* ================= sign in ================= */
function login(err) {
  stopTimers();
  app.innerHTML = `<div class="ca-login"><img src="/admin/icons/chat-192.png" alt="" width="84" height="84"><h1>Satin Chat</h1><p>Staff sign-in</p>
    <form data-f><input name="email" type="email" autocomplete="username" placeholder="Email" required><input name="password" type="password" autocomplete="current-password" placeholder="Password" required>
    <div class="ca-err" data-err>${esc(err || '')}</div><button type="submit">Sign in</button></form><a href="/admin/#/forgot">Forgot password?</a></div>`;
  const f = $('[data-f]');
  f.onsubmit = async e => {
    e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
    try { const r = await api('/login', { email: f.email.value, password: f.password.value }); CSRF = r.csrf; await boot(); }
    catch (er) { $('[data-err]').textContent = er.message; b.disabled = false; }
  };
}
async function boot() {
  try {
    const me = await api('/me');
    if (!me.user) return login();
    ME = me.user; CSRF = me.csrf; PERMS = me.permissions;
  } catch (e) { if ($('.ca-login form')) return; app.innerHTML = `<div class="ca-login"><h1>Satin Chat</h1><p>${esc(e.message)}</p><button type="button" onclick="location.reload()">Try again</button></div>`; return; }
  if (!can('chat.view')) { app.innerHTML = `<div class="ca-login"><h1>Satin Chat</h1><p>Your role cannot see website chats. Ask the owner for “View website live chats”.</p><a href="/admin/">Open the admin</a></div>`; return; }
  shell(); route();
}

/* ================= layout ================= */
let LIST = [], filter = { status: 'open', q: '', f: '' }, current = null, lastId = 0, quick = [], timers = {}, pushOn = false;
function stopTimers() { Object.values(timers).forEach(clearTimeout); timers = {}; }
function shell() {
  app.innerHTML = `<div class="ca-wrap">
    <section class="ca-listp" data-listp>
      <header class="ca-top"><h1>Chats</h1><div class="ca-tacts">
        <button type="button" class="ca-ib" data-bell title="Notifications" aria-label="Notifications">${icon('bell')}</button>
        <button type="button" class="ca-ib" data-menu aria-label="Menu">${icon('more')}</button></div>
        <div class="ca-menu" data-menup hidden><a href="/admin/">${icon('admin')} Open full admin</a><a href="/admin/#/notifications">${icon('bell')} Notification settings</a><button type="button" data-logout>${icon('person')} Sign out (${esc(ME.name)})</button></div></header>
      <div class="ca-search">${icon('search')}<input type="search" data-q placeholder="Search name, email, phone, message" aria-label="Search"></div>
      <div class="ca-chips" role="tablist">${[['open', '', 'Open'], ['open', 'unread', 'Unread'], ['open', 'waiting', 'Waiting'], ['closed', '', 'Closed'], ['all', '', 'All']].map(([s, f, l], i) => `<button type="button" data-st="${s}" data-fl="${f}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="ca-hours" data-hours></div>
      <div class="ca-push" data-pushhint hidden></div>
      <div class="ca-list" data-list><div class="ca-empty">Loading…</div></div>
    </section>
    <section class="ca-convp" data-convp><div class="ca-blank"><img src="/admin/icons/chat-192.png" alt="" width="96" height="96"><p>Choose a chat</p></div></section></div>`;
  let t; $('[data-q]').oninput = e => { clearTimeout(t); t = setTimeout(() => { filter.q = e.target.value.trim(); loadList(); }, 250); };
  $$('.ca-chips button').forEach(b => b.onclick = () => { $$('.ca-chips button').forEach(x => x.classList.toggle('on', x === b)); filter.status = b.dataset.st; filter.f = b.dataset.fl; loadList(); });
  const menu = $('[data-menup]');
  $('[data-menu]').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
  $('[data-logout]').onclick = async () => { await api('/logout', {}).catch(() => {}); ME = null; location.hash = ''; login(); };
  $('[data-bell]').onclick = togglePush;
  pushState();
  loadList();
}
async function pushState() {
  if (!window.SatinPush) return;
  try {
    const st = await SatinPush.state(api); pushOn = st.subscribed;
    const b = $('[data-bell]'); if (b) { b.innerHTML = icon(pushOn ? 'bell' : 'belloff'); b.classList.toggle('off', !pushOn); b.title = pushOn ? 'Notifications are on — tap to turn off' : 'Turn on notifications'; }
    const h = $('[data-pushhint]');
    if (h) {
      if (!pushOn && st.permission !== 'denied' && (st.supported || (st.ios && !st.standalone))) {
        h.hidden = false;
        h.innerHTML = st.supported ? `${icon('bell')}<span>Get a notification when a visitor writes.</span><button type="button">Turn on</button>` : `${icon('bell')}<span>To get notifications on iPhone: Share → <b>Add to Home Screen</b>, then open Satin Chat from there.</span>`;
        const btn = $('button', h); if (btn) btn.onclick = togglePush;
      } else h.hidden = true;
    }
  } catch {}
}
async function togglePush() {
  try {
    if (pushOn) { await SatinPush.disable(api); toast('Notifications off on this device'); }
    else { await SatinPush.enable(api, { chat: true, orders: can('orders.view'), requests: can('requests.view') }); toast('Notifications on — you’ll be alerted about new messages'); }
  } catch (e) { toast(e.message); }
  pushState();
}

/* ================= list ================= */
async function loadList() {
  clearTimeout(timers.list);
  const box = $('[data-list]'); if (!box) return;
  try {
    const qs = new URLSearchParams({ status: filter.status, filter: filter.f, q: filter.q });
    const d = await api('/chat/conversations?' + qs);
    LIST = d.conversations;
    $('[data-hours]').innerHTML = `<i class="${d.openNow ? 'on' : ''}"></i>${d.openNow ? 'Open now' : 'Closed now — visitors are told we reply by email'}`;
    box.innerHTML = LIST.length ? LIST.map(itemHtml).join('') : `<div class="ca-empty">${filter.q ? 'No chats match.' : 'No chats here yet.'}</div>`;
    $$('[data-id]', box).forEach(b => b.onclick = () => { location.hash = 'c=' + b.dataset.id; });
    const unread = LIST.filter(x => x.unread > 0 && x.status === 'open').length;
    window.SatinPush?.appBadge(unread);
    document.title = (unread ? `(${unread}) ` : '') + 'Satin Chat';
  } catch (e) { if (ME) box.innerHTML = `<div class="ca-empty err">${esc(e.message)}</div>`; }
  timers.list = setTimeout(loadList, document.hidden ? 60000 : 6000);
}
function itemHtml(x) {
  const prev = x.typing ? '<em class="ca-typing">typing…</em>' : `${/^You: /.test(x.preview) ? icon('check', 'ca-tick') : ''}${esc(x.preview.replace(/^You: /, ''))}`;
  return `<button type="button" class="ca-item ${current === x.id ? 'on' : ''} ${x.unread ? 'unread' : ''}" data-id="${esc(x.id)}">${avatar(x.name, x.online)}
    <span class="ca-item-main"><span class="ca-item-top"><b>${esc(x.name)}</b><small>${esc(when(x.lastMessageAt))}</small></span>
    <span class="ca-item-bot"><span class="ca-prev">${prev}</span>${x.waiting ? '<span class="ca-tag">Waiting</span>' : ''}${x.status === 'closed' ? '<span class="ca-tag grey">Closed</span>' : ''}${x.unread ? `<span class="ca-unread">${x.unread}</span>` : ''}</span></span></button>`;
}

/* ================= conversation ================= */
let conv = null, convTok = 0;
function msgHtml(m, prev) {
  const sep = !prev || day(prev.createdAt) !== day(m.createdAt) ? `<div class="ca-day"><span>${esc(day(m.createdAt))}</span></div>` : '';
  if (m.sender === 'system') return sep + `<div class="ca-sys">${esc(m.body)}</div>`;
  const mine = m.sender === 'staff';
  const who = m.sender === 'bot' ? `<span class="ca-who bot">Assistant${m.source && m.source !== 'smalltalk' ? ' · ' + esc({ kb: 'Q&A', pages: 'website', ai: 'AI', none: 'no answer' }[m.source] || m.source) : ''}</span>` : mine && m.staffName && m.staffName !== ME.name ? `<span class="ca-who">${esc(m.staffName)}</span>` : '';
  const files = (m.files || []).map(f => `<div class="ca-file">${f.thumb ? `<a href="${fileUrl(f)}" target="_blank" rel="noopener" class="ca-thumb"><img src="${fileUrl(f, true)}" alt="${esc(f.name)}" loading="lazy"${f.width && f.height ? ` style="aspect-ratio:${+f.width}/${+f.height}"` : ''}></a>` : ''}
    <a class="ca-frow" href="${fileUrl(f)}${f.image ? '&download=1' : ''}" ${f.image ? 'download' : 'target="_blank" rel="noopener"'}><span class="ca-fic">${esc((f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase())}</span><span><b>${esc(f.name)}</b><small>${fmtSize(f.size)}</small></span></a></div>`).join('');
  const links = (m.links || []).filter(l => /^(\/|https:\/\/)/.test(l.url)).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || l.url)}</a>`).join('');
  return sep + `<div class="ca-msg ${mine ? 'me' : m.sender}" data-mid="${m.id}">${who}${files}${m.body ? `<div class="ca-body">${richText(m.body)}</div>` : ''}${links ? `<div class="ca-links">${links}</div>` : ''}<span class="ca-time">${esc(hm(m.createdAt))}${mine ? icon('check', 'ca-tick') : ''}</span></div>`;
}
function presence(c) { return c.typing ? '<em class="ca-typing">typing…</em>' : c.online ? 'online' : c.status === 'closed' ? 'chat closed' : c.waiting ? 'waiting for a reply' : 'on ' + esc(c.page); }

async function openConv(id) {
  stopConv(); current = id; const my = ++convTok; lastId = 0;
  document.body.classList.add('ca-in');
  $$('.ca-item').forEach(i => i.classList.toggle('on', i.dataset.id === id));
  const p = $('[data-convp]');
  p.innerHTML = '<div class="ca-blank"><p>Loading…</p></div>';
  let d; try { d = await api('/chat/conversation?id=' + encodeURIComponent(id)); } catch (e) { p.innerHTML = `<div class="ca-blank"><p>${esc(e.message)}</p></div>`; return; }
  if (my !== convTok) return;
  conv = d.conversation; quick = d.quickReplies || [];
  const reply = can('chat.reply');
  p.innerHTML = `<header class="ca-chead"><button type="button" class="ca-ib" data-back aria-label="Back">${icon('back')}</button>${avatar(conv.name, conv.online)}
      <button type="button" class="ca-cinfo" data-info><b>${esc(conv.name)}</b><small data-pres>${presence(conv)}</small></button>
      <button type="button" class="ca-ib" data-cmenu aria-label="More">${icon('more')}</button>
      <div class="ca-menu" data-cmenup hidden>
        <a href="mailto:${esc(conv.email)}">✉️ ${esc(conv.email)}</a>${conv.phone ? `<a href="tel:${esc(conv.phone)}">📞 ${esc(conv.phone)}</a>` : ''}
        <button type="button" data-info2>ℹ️ Visitor details</button>
        ${reply ? `<button type="button" data-toggle>${conv.status === 'closed' ? '↩️ Reopen chat' : '✅ Close chat'}</button>` : ''}
        <a href="/api/admin/chat/export?id=${encodeURIComponent(conv.id)}">⬇️ Export transcript</a><a href="/admin/#/chat?id=${encodeURIComponent(conv.id)}">🖥️ Open in admin</a></div></header>
    <div class="ca-log" data-log></div>
    ${reply ? `<div class="ca-qr" data-qrbar hidden>${quick.map((q, i) => `<button type="button" data-qr="${i}">${esc(q)}</button>`).join('')}</div>
    <form class="ca-comp" data-comp><button type="button" class="ca-ib" data-quick title="Quick replies" aria-label="Quick replies">${icon('bolt')}</button>
      <div class="ca-inp"><textarea rows="1" maxlength="2000" placeholder="Message" aria-label="Message"></textarea><button type="button" class="ca-ib" data-attach aria-label="Attach a file">${icon('clip')}</button><input type="file" data-file hidden accept="image/*,.heic,.pdf,.ai,.eps,.svg,.zip"></div>
      <button type="submit" class="ca-send" aria-label="Send">${icon('send')}</button></form>
    <label class="ca-mail"><input type="checkbox" data-mail> Also email my reply to ${esc(conv.email)}</label>` : '<p class="ca-ro">Your role can read chats but not reply.</p>'}`;
  const log = $('[data-log]', p);
  let all = [];
  const add = ms => { const near = log.scrollHeight - log.scrollTop - log.clientHeight < 120; let html = ''; for (const m of ms) { if (m.id <= lastId) continue; html += msgHtml(m, all[all.length - 1]); all.push(m); lastId = m.id; } if (html) { log.insertAdjacentHTML('beforeend', html); if (near || ms.length) log.scrollTop = log.scrollHeight; } };
  add(d.messages); log.scrollTop = log.scrollHeight;
  $$('img', log).forEach(i => i.addEventListener('load', () => { log.scrollTop = log.scrollHeight; }, { once: true }));
  $('[data-back]', p).onclick = () => { history.length > 1 && location.hash.startsWith('#c=') ? history.back() : (location.hash = ''); };
  const cm = $('[data-cmenup]', p);
  $('[data-cmenu]', p).onclick = e => { e.stopPropagation(); cm.hidden = !cm.hidden; };
  p.addEventListener('click', e => { if (!cm.hidden && !cm.contains(e.target) && !e.target.closest('[data-cmenu]')) cm.hidden = true; });
  const info = () => details(conv);
  $('[data-info]', p).onclick = info; $('[data-info2]', p).onclick = info;
  const tg = $('[data-toggle]', p);
  if (tg) tg.onclick = async () => { try { await api('/chat/status', { id: conv.id, status: conv.status === 'closed' ? 'open' : 'closed' }); toast(conv.status === 'closed' ? 'Chat reopened' : 'Chat closed'); openConv(conv.id); loadList(); } catch (e) { toast(e.message); } };

  const refresh = async () => {
    const x = await api('/chat/conversation?id=' + encodeURIComponent(conv.id) + '&after=' + lastId);
    if (my !== convTok) return;
    conv = x.conversation; add(x.messages);
    const pr = $('[data-pres]', p); if (pr) pr.innerHTML = presence(conv);
    const av = $('.ca-chead .ca-ava', p); if (av) av.classList.toggle('online', !!conv.online);
  };
  const f = $('[data-comp]', p);
  if (f) {
    const ta = f.querySelector('textarea'), fileIn = $('[data-file]', f), qb = $('[data-qrbar]', p);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    let typedAt = 0;
    ta.oninput = () => { grow(); if (ta.value.trim() && Date.now() - typedAt > 4000) { typedAt = Date.now(); api('/chat/typing', { id: conv.id }).catch(() => {}); } };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer:fine)').matches) { e.preventDefault(); f.requestSubmit(); } };
    $('[data-quick]', f).onclick = () => { qb.hidden = !qb.hidden; };
    $$('[data-qr]', p).forEach(b => b.onclick = () => { ta.value = (ta.value ? ta.value.trimEnd() + ' ' : '') + quick[+b.dataset.qr]; qb.hidden = true; grow(); ta.focus(); });
    $('[data-attach]', f).onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const file = fileIn.files[0]; fileIn.value = ''; if (!file) return;
      if (file.size > 20 * 1048576) return toast('Files can be up to 20 MB.');
      const tmp = document.createElement('div'); tmp.className = 'ca-msg me pending'; tmp.textContent = 'Sending ' + file.name + '…'; log.append(tmp); log.scrollTop = log.scrollHeight;
      try {
        const fd = new FormData(); fd.append('id', conv.id); fd.append('file', file, file.name); if (ta.value.trim()) fd.append('text', ta.value.trim());
        const r = await fetch('/api/admin/chat/upload', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': CSRF }, body: fd });
        let j = {}; try { j = await r.json(); } catch {}
        if (!r.ok) throw new Error(j.error || 'Upload failed.');
        ta.value = ''; grow(); tmp.remove(); await refresh(); loadList();
      } catch (e) { tmp.remove(); toast(e.message); }
    };
    f.onsubmit = async e => {
      e.preventDefault(); const text = ta.value.trim(); if (!text) return;
      const b = f.querySelector('.ca-send'); b.disabled = true;
      const mail = $('[data-mail]', p);
      const tmp = document.createElement('div'); tmp.className = 'ca-msg me pending'; tmp.innerHTML = `<div class="ca-body">${richText(text)}</div>`; log.append(tmp); log.scrollTop = log.scrollHeight;
      ta.value = ''; grow();
      try { const r = await api('/chat/reply', { id: conv.id, text, emailVisitor: !!mail?.checked }); if (r.emailed) toast('Sent and emailed'); if (mail) mail.checked = false; tmp.remove(); await refresh(); loadList(); }
      catch (er) { tmp.remove(); ta.value = text; grow(); toast(er.message); }
      finally { b.disabled = false; ta.focus(); }
    };
    if (matchMedia('(pointer:fine)').matches) ta.focus();
  }
  const loop = async () => { if (my !== convTok) return; try { if (!document.hidden) await refresh(); } catch {} timers.conv = setTimeout(loop, document.hidden ? 15000 : 3000); };
  timers.conv = setTimeout(loop, 3000);
  loadList();
}
function stopConv() { clearTimeout(timers.conv); convTok++; conv = null; }
function closeConv() {
  stopConv(); current = null; document.body.classList.remove('ca-in');
  const p = $('[data-convp]'); if (p) p.innerHTML = '<div class="ca-blank"><img src="/admin/icons/chat-192.png" alt="" width="96" height="96"><p>Choose a chat</p></div>';
  $$('.ca-item').forEach(i => i.classList.remove('on'));
}
function details(c) {
  const o = document.createElement('div'); o.className = 'ca-sheet';
  o.innerHTML = `<div class="ca-sheet-in" role="dialog" aria-label="Visitor details"><header><b>Visitor details</b><button type="button" class="ca-ib" data-x aria-label="Close">${icon('x')}</button></header><dl>
    <dt>Name</dt><dd>${esc(c.name)}</dd><dt>Email</dt><dd><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></dd><dt>Phone</dt><dd>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</dd>
    <dt>Now on</dt><dd><a href="${esc(c.page)}" target="_blank" rel="noopener">${esc(c.page)}</a></dd><dt>First page</dt><dd>${esc(c.firstPage)}</dd><dt>Language</dt><dd>${c.lang === 'fa' ? 'Persian page' : 'English page'}</dd>
    <dt>Started</dt><dd>${esc(new Date(c.createdAt).toLocaleString('en-CA'))}</dd><dt>Asked for a person</dt><dd>${c.humanRequestedAt ? esc(new Date(c.humanRequestedAt).toLocaleString('en-CA')) : 'No'}</dd></dl>
    <p class="ca-note">Use these details only to answer this enquiry.</p></div>`;
  o.onclick = e => { if (e.target === o || e.target.closest('[data-x]')) o.remove(); };
  document.body.append(o);
}

/* ================= routing ================= */
function route() {
  if (!ME) return;
  const m = location.hash.match(/^#c=([a-f0-9-]{36})$/);
  if (m) { if (m[1] !== current) openConv(m[1]); } else if (current) closeConv();
}
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && ME) { loadList(); pushState(); } });
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'push' && ME) loadList();
  if (e.data?.type === 'open' && e.data.url) location.href = e.data.url;
  if (e.data?.type === 'resubscribe' && ME) window.SatinPush?.resync(api);
});
boot();
})();
