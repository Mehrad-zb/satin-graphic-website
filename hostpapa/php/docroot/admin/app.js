/* Satin Admin — vanilla SPA (hash routes). */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
let ME = null, CSRF = '', PERMS = [], STATUSES = {};
const can = p => PERMS.includes(p);

async function api(path, body) {
  const opt = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(body) };
  const r = await fetch('/api/admin' + path, { credentials: 'same-origin', ...opt });
  let data = {}; try { data = await r.json(); } catch {}
  if (r.status === 401 && data.signin && !location.hash.startsWith('#/login')) { ME = null; go('/login'); }
  if (!r.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
/* multipart POST (fields + files) with the CSRF header — for uploads */
async function apiForm(path, fd) {
  const r = await fetch('/api/admin' + path, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': CSRF }, body: fd });
  let data = {}; try { data = await r.json(); } catch {}
  if (r.status === 401 && data.signin) { ME = null; go('/login'); }
  if (!r.ok) throw new Error(data.error || (r.status === 413 ? 'The attachments are too large for this server.' : 'Something went wrong.'));
  return data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); }
function go(path) { location.hash = '#' + path; }
const fmtDate = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }); };
const initials = n => (n || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();

const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  inbox: '<path d="M4 4h16v16H4z"/><path d="M4 14h5l1 3h4l1-3h5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3.2 2.8 3.5 6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v6H4V5h6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  car: '<path d="M3 16v-4l2-5h11l3 5h2v4h-2"/><path d="M3 16h2m4 0h6"/><circle cx="7" cy="16.5" r="2"/><circle cx="17" cy="16.5" r="2"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12z"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 8"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const NAV = [
  { path: '/', label: 'Home', icon: 'home', perm: 'dashboard.view' },
  { group: 'Business' },
  { path: '/requests', label: 'Quotes & bookings', icon: 'inbox', perm: 'requests.view' },
  { path: '/chat', label: 'Live chat', icon: 'chat', perm: 'chat.view' },
  { path: '/orders', label: 'Online orders', icon: 'cart', perm: 'orders.view' },
  { path: '/invoices', label: 'Invoices', icon: 'doc', perm: 'invoices.view' },
  { path: '/customers', label: 'Customers', icon: 'users', perm: 'invoices.view' },
  { path: '/coupons', label: 'Coupons', icon: 'tag', perm: 'pricing.edit' },
  { path: '/payments', label: 'Payments (Square & PayPal)', icon: 'card', perm: 'payments.manage' },
  { group: 'Website' },
  { path: '/editor', label: 'Website editor', icon: 'edit', perm: 'site.edit', href: '/admin/editor/' },
  { path: '/catalog', label: 'Products & prices', icon: 'tag', perm: 'pricing.edit' },
  { path: '/templates', label: 'Vehicle templates', icon: 'car', perm: 'pricing.edit' },
  { path: '/banner', label: 'Home banner', icon: 'doc', perm: 'site.edit' },
  { path: '/portfolio', label: 'Our Work (portfolio)', icon: 'image', perm: 'site.edit' },
  { path: '/business', label: 'Business info & SEO', icon: 'cog', perm: 'settings.edit' },
  { path: '/customer-login', label: 'Customer login', icon: 'user', perm: 'invoices.view' },
  { group: 'Team' },
  { path: '/members', label: 'Members & roles', icon: 'users', perm: 'members.manage' },
  { path: '/activity', label: 'Activity log', icon: 'list', perm: 'audit.view' },
  { path: '/notifications', label: 'Notifications & app', icon: 'bell' },
  { path: '/account', label: 'My account', icon: 'user' }
];

/* ---------- auth screens ---------- */
function authCard(title, sub, body) {
  app.innerHTML = `<div class="auth"><div class="auth-card"><img src="/satin/img/logo.png" alt="Satin Graphic"><h1>${title}</h1><p>${sub}</p><div data-msg></div>${body}</div></div>`;
}
const showErr = (e, ok) => { const m = $('[data-msg]'); if (m) m.innerHTML = `<div class="${ok ? 'okmsg' : 'err'}">${esc(e.message || e)}</div>`; };
async function submitting(form, fn) {
  const b = form.querySelector('button[type=submit]'); b.disabled = true;
  try { await fn(); } catch (e) { showErr(e); } finally { b.disabled = false; }
}

function viewLogin(setupNeeded) {
  if (setupNeeded) return viewSetup();
  authCard('Sign in', 'Satin website admin', `<form data-f>
    <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn block" type="submit">Sign in</button>
    <p class="hint" style="text-align:center;margin-top:16px"><a href="#/forgot">Forgot your password?</a></p></form>`);
  const f = $('[data-f]'); f.email.focus();
  f.onsubmit = e => { e.preventDefault(); submitting(f, async () => { const r = await api('/login', { email: f.email.value, password: f.password.value }); CSRF = r.csrf; await boot('/'); }); };
}
function viewSetup() {
  authCard('Set up the owner account', 'Enter the owner email. We will send a secure link to choose your password.', `<form data-f>
    <label class="field"><span>Owner email</span><input name="email" type="email" required></label>
    <button class="btn block" type="submit">Send setup link</button></form>`);
  const f = $('[data-f]');
  f.onsubmit = e => { e.preventDefault(); submitting(f, async () => { const r = await api('/setup', { email: f.email.value }); showErr(r.message, true); }); };
}
function viewForgot() {
  authCard('Reset password', 'We will email you a link to choose a new password.', `<form data-f>
    <label class="field"><span>Email</span><input name="email" type="email" required></label>
    <button class="btn block" type="submit">Send reset link</button>
    <p class="hint" style="text-align:center;margin-top:16px"><a href="#/login">Back to sign in</a></p></form>`);
  const f = $('[data-f]');
  f.onsubmit = e => { e.preventDefault(); submitting(f, async () => { const r = await api('/forgot', { email: f.email.value }); showErr(r.message, true); }); };
}
async function viewJoin(token, reset) {
  authCard(reset ? 'Choose a new password' : 'Welcome to Satin admin', 'Checking your link…', '');
  let inv;
  try { inv = (await api('/invite?token=' + encodeURIComponent(token))).invite; }
  catch (e) { authCard('Link not valid', e.message, '<a class="btn block" href="#/login">Go to sign in</a>'); return; }
  const owner = inv.purpose === 'owner';
  authCard(reset ? 'Choose a new password' : owner ? 'Create the owner account' : 'Accept your invitation',
    reset ? esc(inv.email) : `${esc(inv.email)} · ${esc(inv.roleName)}`, `<form data-f>
    ${reset ? '' : `<label class="field"><span>Your name</span><input name="name" value="${esc(inv.name === 'Owner' ? '' : inv.name)}" required minlength="2" autocomplete="name"></label>`}
    <label class="field"><span>Password</span><input name="password" type="password" autocomplete="new-password" required minlength="10"><div class="hint">At least 10 characters, with letters and numbers.</div></label>
    <label class="field"><span>Repeat password</span><input name="password2" type="password" autocomplete="new-password" required></label>
    <button class="btn block" type="submit">${reset ? 'Save password' : 'Create account'}</button></form>`);
  const f = $('[data-f]');
  f.onsubmit = e => { e.preventDefault(); submitting(f, async () => {
    if (f.password.value !== f.password2.value) throw new Error('Passwords do not match.');
    const r = await api('/accept', { token, name: f.name ? f.name.value : '', password: f.password.value });
    CSRF = r.csrf; history.replaceState(null, '', '/admin/'); await boot('/');
  }); };
}

/* ---------- shell ---------- */
function shell(title, crumb, body, path) {
  const items = NAV.filter(n => n.group || !n.perm || can(n.perm));
  const nav = items.map((n, i) => n.group ? (items[i + 1] && !items[i + 1].group ? `<div class="group">${n.group}</div>` : '') :
    `<a href="${n.href || '#' + n.path}" class="${path === n.path ? 'on' : ''}">${icon(n.icon)}<span>${n.label}</span>${n.soon ? '<span class="soon">Soon</span>' : ''}</a>`).join('');
  app.innerHTML = `<div class="shell"><aside class="side" data-side>
    <div class="brand"><img src="/satin/img/logo.png" alt="Satin"><small>Admin</small></div>
    <nav class="nav">${nav}<a href="/satin/" target="_blank" rel="noopener">${icon('ext')}<span>View website</span></a></nav>
    <div class="me"><div class="avatar">${esc(initials(ME.name))}</div><div><b>${esc(ME.name)}</b><small>${esc(ME.roleName)}</small></div><button data-logout>Sign out</button></div>
  </aside><div class="main"><header class="top"><div style="display:flex;align-items:center;gap:10px"><button class="menu-toggle" data-menu aria-label="Menu">${icon('menu')}</button><div><div class="crumb">${crumb}</div><h1>${title}</h1></div></div><div data-actions></div></header>
  <div class="content" data-content>${body}</div></div></div>`;
  $('[data-logout]').onclick = async () => { await api('/logout', {}).catch(() => {}); ME = null; go('/login'); };
  $('[data-menu]').onclick = () => $('[data-side]').classList.toggle('open');
  return $('[data-content]');
}
function denied() { return shell('No access', 'Admin', '<div class="card empty">Your role does not include this page. Ask the owner for access.</div>', ''); }

/* ---------- requests ---------- */
function requestTable(rows) {
  return `<table class="table"><thead><tr><th>Request</th><th>Customer</th><th>Service</th><th>Received</th><th>Status</th></tr></thead><tbody>${rows.map(r => `
    <tr class="click" data-id="${esc(r.id)}"><td><b>${esc(r.reference)}</b><small>${r.type === 'booking' ? 'Booking' : 'Quote'}${r.preferredDate ? ' · ' + esc(r.preferredDate) + ' ' + esc(r.preferredTime) : ''}</small></td>
    <td>${esc(r.name)}<small>${esc(r.email)}</small></td><td>${esc(r.service)}</td><td>${esc(fmtDate(r.createdAt))}</td>
    <td><span class="pill ${esc(r.status)}">${esc(STATUSES[r.status] || r.status)}</span></td></tr>`).join('')}</tbody></table>`;
}
function bindRows(root) { root.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => openRequest(tr.dataset.id)); }
async function viewRequests(params) {
  const c = shell('Quotes & bookings', 'Business', '', '/requests');
  const act = $('[data-actions]');
  c.innerHTML = `<div class="toolbar"><input class="input" data-q placeholder="Search name, email, phone, reference" value="${esc(params.get('q') || '')}">
    <select class="input" data-status><option value="">All statuses</option>${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${params.get('status') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select class="input" data-type><option value="">Quotes & bookings</option><option value="quote">Quotes</option><option value="booking">Bookings</option></select></div><div data-list><div class="card empty">Loading…</div></div>`;
  if (can('requests.export')) act.innerHTML = '<a class="btn ghost sm" data-export href="#">Export CSV</a>';
  const load = async () => {
    const qs = new URLSearchParams({ q: $('[data-q]').value, status: $('[data-status]').value, type: $('[data-type]').value });
    const ex = $('[data-export]'); if (ex) ex.href = '/api/admin/requests/export?' + qs;
    const list = $('[data-list]');
    try { const d = await api('/requests?' + qs); list.innerHTML = d.requests.length ? requestTable(d.requests) : '<div class="card empty">No requests match.</div>'; bindRows(list); }
    catch (e) { list.innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
  };
  let t; $('[data-q]').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $('[data-status]').onchange = load; $('[data-type]').onchange = load;
  load();
}
const REPLY_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'xlsx', 'ai', 'eps', 'svg', 'zip'];
const fsize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
function replyCard(x) {
  return `<article class="rq-reply ${x.sent ? '' : 'failed'}"><div class="rq-reply-h"><span class="avatar sm">${esc(initials(x.userName))}</span><div><b>${esc(x.userName)}</b><small>${esc(fmtDate(x.createdAt))} · to ${esc(x.to)}</small></div>
    ${x.sent ? '<span class="pill confirmed">Sent</span>' : '<span class="pill cancelled">Not sent</span>'}</div>
    <div class="rq-subj">${esc(x.subject)}</div><div class="rq-body" dir="auto" data-clamp>${esc(x.body)}${x.signature ? `<div class="rq-sig">${esc(x.signature)}</div>` : ''}</div>
    <button type="button" class="linkbtn rq-more" data-more-body hidden>Show full message</button>
    ${x.attachments.length ? `<div class="rq-att">${x.attachments.map((f, n) => `<a href="/api/admin/requests/reply-file?id=${encodeURIComponent(x.id)}&n=${n}" download="${esc(f.name)}">📎 ${esc(f.name)} <small>${fsize(f.size)}</small></a>`).join('')}</div>` : ''}
    ${!x.sent && x.error ? `<div class="err" style="margin:8px 0 0">${esc(x.error)}</div>` : ''}</article>`;
}
async function openRequest(id) {
  const o = document.createElement('div'); o.className = 'overlay'; o.innerHTML = '<div class="drawer"><div class="empty">Loading…</div></div>'; document.body.append(o);
  const close = () => o.remove(); o.onclick = e => { if (e.target === o) close(); };
  let draft = null; // unsent reply (kept while the drawer redraws after a note or status change)
  const draw = async () => {
    const { request: r, notes, replies = [], reply: rc = {} } = await api('/requests/detail?id=' + encodeURIComponent(id));
    const d = r.details || {}, custom = d.custom || {};
    const canReply = can('requests.edit') && !!r.email;
    if (!draft) draft = { open: false, subject: rc.subject || '', body: `Hi ${String(r.name || '').trim().split(/\s+/)[0] || 'there'},\n\n`, signature: rc.signature || '', files: [] };
    o.firstChild.innerHTML = `<header><div><small style="color:var(--mut)">${r.type === 'booking' ? 'Booking request' : 'Quote request'}</small><h2>${esc(r.reference)} · ${esc(r.service)}</h2></div><button class="x" data-close aria-label="Close">×</button></header>
      ${can('requests.edit') ? `<label class="field"><span>Status</span><select class="input" data-st>${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>` : `<p><span class="pill ${esc(r.status)}">${esc(STATUSES[r.status] || r.status)}</span></p>`}
      <dl class="kv"><dt>Name</dt><dd>${esc(r.name)}</dd><dt>Email</dt><dd><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></dd><dt>Phone</dt><dd><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></dd>
      <dt>Received</dt><dd>${esc(fmtDate(r.createdAt))}</dd>${r.preferredDate ? `<dt>Preferred time</dt><dd>${esc(r.preferredDate)} ${esc(r.preferredTime)}</dd>` : ''}
      ${d.contactPreference ? `<dt>Contact by</dt><dd>${esc(d.contactPreference)}</dd>` : ''}${d.vehicle ? `<dt>Vehicle</dt><dd>${esc(d.vehicle)}</dd>` : ''}${d.plan ? `<dt>Plan</dt><dd>${esc(d.plan)}</dd>` : ''}
      ${(d.services || []).length ? `<dt>Services</dt><dd>${(d.services || []).map(esc).join(', ')}</dd>` : ''}
      ${Object.entries(custom).map(([k, v]) => `<dt>${esc(k.replace(/[_-]/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}
      ${d.estimate ? `<dt>Estimate</dt><dd style="white-space:pre-line">${esc(d.estimate)}</dd>` : ''}${d.notes ? `<dt>Customer notes</dt><dd style="white-space:pre-line">${esc(d.notes)}</dd>` : ''}
      ${d.designRequested ? '<dt>Design</dt><dd>Design service requested · agreement accepted</dd>' : ''}
      ${(d.attachments || []).length ? `<dt>Attachments</dt><dd>${d.attachments.map(a => `<a href="/api/studio/file?id=${esc(a.id)}">${esc(a.name)}</a>`).join('<br>')}</dd>` : ''}</dl>
      ${can('invoices.edit') ? `<p><a class="btn ghost sm" href="#/invoices/edit?request=${esc(r.id)}">Create invoice for this request</a></p>` : ''}
      <section class="rq-sec"><h3>Emails to the customer${replies.length ? ` <span class="rq-count">${replies.length}</span>` : ''}</h3>
        ${replies.map(replyCard).join('') || '<p class="hint" style="margin-top:0">No replies sent from the admin yet.</p>'}
        ${!canReply ? (can('requests.edit') ? '<p class="hint">This request has no email address to reply to.</p>' : '') : !draft.open ? '<button type="button" class="btn sm" data-rq-open>✉ Reply to customer</button>' : `
        <form class="rq-compose" data-reply novalidate><h4>Reply to customer</h4>
          <label class="field"><span>To</span><input class="ro" readonly value="${esc(r.name ? `${r.name} <${r.email}>` : r.email)}"></label>
          <label class="field"><span>Subject</span><input name="subject" maxlength="200" value="${esc(draft.subject)}"></label>
          <label class="field"><span>Message</span><textarea name="body" rows="8" maxlength="20000" dir="auto">${esc(draft.body)}</textarea></label>
          <div class="field"><span>Attachments</span><div class="rq-files" data-files></div>
            <button type="button" class="btn ghost sm" data-addfiles>📎 Add files</button><input type="file" multiple hidden data-filein accept="${REPLY_EXT.map(x => '.' + x).join(',')}">
            <div class="hint">PDF, JPG, PNG, WebP, DOCX, XLSX, AI, EPS, SVG or ZIP · up to 10 MB each, 20 MB in total.</div></div>
          <label class="field"><span>Signature</span><textarea name="signature" rows="3" maxlength="1000">${esc(draft.signature)}</textarea></label>
          <div class="rq-sigacts"><button type="button" class="linkbtn" data-savesig>Save as my signature</button><span class="hint" data-sigmsg></span></div>
          <p class="hint">A copy of the customer’s request is quoted under your signature. Customer replies go to <b>${esc(rc.replyTo || 'info@satingraphic.ca')}</b>.</p>
          <div class="rq-send"><button type="button" class="btn ghost" data-rq-cancel>Discard</button><button class="btn" type="submit" data-rq-send>Send email</button></div></form>`}
      </section>
      <h3 style="font-size:15px;margin:22px 0 10px">Team notes</h3>${notes.map(n => `<div class="note"><small>${esc(n.user_name)} · ${esc(fmtDate(n.created_at))}</small>${esc(n.body)}</div>`).join('') || '<p class="hint">No notes yet.</p>'}
      ${can('requests.edit') ? '<form data-note style="margin-top:12px"><textarea class="input" name="body" rows="3" placeholder="Add a note for the team"></textarea><button class="btn sm" style="margin-top:8px" type="submit">Add note</button></form>' : ''}`;
    $('[data-close]', o).onclick = close;
    const st = $('[data-st]', o); if (st) st.onchange = async () => { try { await api('/requests/update', { id, status: st.value }); toast('Status updated'); refresh(); } catch (e) { toast(e.message); } };
    const nf = $('[data-note]', o); if (nf) nf.onsubmit = async e => { e.preventDefault(); try { await api('/requests/note', { id, body: nf.body.value }); await draw(); } catch (er) { toast(er.message); } };
    o.querySelectorAll('.rq-reply').forEach(card => { const b = $('[data-clamp]', card), m = $('[data-more-body]', card); if (b.scrollHeight > b.clientHeight + 4) { m.hidden = false; m.onclick = () => { b.classList.add('open'); m.hidden = true; }; } });
    const op = $('[data-rq-open]', o); if (op) op.onclick = async () => { draft.open = true; await draw(); const t = $('[name=body]', o); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } };
    const f = $('[data-reply]', o); if (!f) return;
    const sync = () => { draft.subject = f.subject.value; draft.body = f.body.value; draft.signature = f.signature.value; };
    f.oninput = sync; f.onchange = sync;
    const drawFiles = () => {
      const total = draft.files.reduce((a, x) => a + x.size, 0);
      $('[data-files]', f).innerHTML = draft.files.length ? draft.files.map((x, k) => `<div class="rq-file"><span title="${esc(x.name)}">📎 ${esc(x.name)}</span><small>${fsize(x.size)}</small><button type="button" class="x sm" data-rmfile="${k}" aria-label="Remove ${esc(x.name)}">×</button></div>`).join('') + `<div class="hint" style="margin:2px 0 8px">${draft.files.length} file${draft.files.length === 1 ? '' : 's'} · ${fsize(total)} of 20 MB</div>` : '';
      f.querySelectorAll('[data-rmfile]').forEach(b => b.onclick = () => { draft.files.splice(+b.dataset.rmfile, 1); drawFiles(); });
    };
    drawFiles();
    const fin = $('[data-filein]', f);
    $('[data-addfiles]', f).onclick = () => fin.click();
    fin.onchange = () => {
      const errs = [];
      for (const file of fin.files) {
        const ext = (file.name.split('.').pop() || '').toLowerCase(), total = draft.files.reduce((a, x) => a + x.size, 0);
        if (!REPLY_EXT.includes(ext)) errs.push(`${file.name}: this file type can’t be attached`);
        else if (file.size > 10 * 1048576) errs.push(`${file.name} is larger than 10 MB`);
        else if (!file.size) errs.push(`${file.name} is empty`);
        else if (total + file.size > 20 * 1048576) errs.push(`${file.name}: attachments can be 20 MB in total`);
        else if (draft.files.length >= 10) errs.push('Attach at most 10 files');
        else if (!draft.files.some(x => x.name === file.name && x.size === file.size)) draft.files.push(file);
      }
      fin.value = ''; drawFiles(); if (errs.length) toast(errs.join(' · '));
    };
    $('[data-savesig]', f).onclick = async () => { sync(); try { const x = await api('/requests/signature', { signature: draft.signature }); draft.signature = x.signature; f.signature.value = x.signature; $('[data-sigmsg]', f).textContent = ' Saved — used for your next replies.'; } catch (er) { toast(er.message); } };
    $('[data-rq-cancel]', f).onclick = () => confirmBox('Discard this reply?', 'Your message and attachments will be removed.', async () => { draft = null; await draw(); }, { yesLabel: 'Discard' });
    f.onsubmit = async e => {
      e.preventDefault(); sync();
      if (!draft.subject.trim()) { toast('Add a subject'); f.subject.focus(); return; }
      if (!draft.body.trim() || draft.body.trim() === `Hi ${String(r.name || '').trim().split(/\s+/)[0] || 'there'},`) { toast('Write your message first'); f.body.focus(); return; }
      const b = $('[data-rq-send]', f); b.disabled = true; b.textContent = draft.files.length ? 'Uploading & sending…' : 'Sending…';
      const fd = new FormData(); fd.set('id', id); fd.set('subject', draft.subject); fd.set('body', draft.body); fd.set('signature', draft.signature);       draft.files.forEach(x => fd.append('files[]', x, x.name));
      try {
        const x = await apiForm('/requests/reply', fd);
        toast(x.sent ? 'Email sent to ' + r.email : 'Saved, but the email could not be sent');
        draft = null; await draw();
        if (x.status !== r.status) refresh();
      } catch (er) { toast(er.message); b.disabled = false; b.textContent = 'Send email'; }
    };
  };
  try { await draw(); } catch (e) { o.firstChild.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

/* ---------- members & roles ---------- */
let membersTab = 'members';
async function viewMembers() {
  const c = shell('Members & roles', 'Team', '<div class="card empty">Loading…</div>', '/members');
  $('[data-actions]').innerHTML = '<button class="btn sm" data-invite>Invite member</button>';
  const d = await api('/members');
  const roles = Object.fromEntries(d.roles.map(r => [r.id, r]));
  const roleName = id => roles[id]?.name || id;
  const draw = () => {
    c.innerHTML = `<div class="tabs"><button data-tab="members" class="${membersTab === 'members' ? 'on' : ''}">Members (${d.members.length})</button><button data-tab="roles" class="${membersTab === 'roles' ? 'on' : ''}">Roles & permissions</button></div>
    ${membersTab === 'members' ? `<table class="table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>
      ${d.members.map(m => `<tr><td><b>${esc(m.name)}</b>${m.id === ME.id ? ' <small style="display:inline">(you)</small>' : ''}<small>${esc(m.email)}</small></td>
        <td>${m.role === 'owner' && ME.role !== 'owner' ? '<span class="pill owner">Owner</span>' : `<select class="input" style="padding:6px 8px" data-role="${m.id}" ${m.id === ME.id && m.role === 'owner' ? 'disabled' : ''}>${d.roles.filter(r => r.id !== 'owner' || ME.role === 'owner').map(r => `<option value="${r.id}" ${r.id === m.role ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`}</td>
        <td><span class="pill ${esc(m.status)}">${m.status === 'active' ? 'Active' : 'Suspended'}</span></td><td>${esc(fmtDate(m.lastLogin))}</td>
        <td style="text-align:right;white-space:nowrap">${m.id === ME.id || (m.role === 'owner' && ME.role !== 'owner') ? '' : `<button class="btn ghost sm" data-susp="${m.id}" data-to="${m.status === 'active' ? 'suspended' : 'active'}">${m.status === 'active' ? 'Suspend' : 'Reactivate'}</button> <button class="btn danger sm" data-rm="${m.id}">Remove</button>`}</td></tr>`).join('')}
      ${d.invites.map(i => `<tr><td><b>${esc(i.name || i.email)}</b><small>${esc(i.email)}</small></td><td>${esc(roleName(i.role))}</td><td><span class="pill">Invited</span></td><td><small>Expires ${esc(fmtDate(new Date(i.expiresAt * 1000).toISOString()))}</small></td><td style="text-align:right"><button class="btn ghost sm" data-revoke="${i.id}">Cancel invite</button></td></tr>`).join('')}
      </tbody></table>` : `<p style="color:var(--mut);margin-top:0">Each member gets one role. Built-in roles cover common jobs; create a custom role to choose exactly which parts of the admin someone can use.</p>
      <div class="grid g2">${d.roles.map(r => `<div class="role-card"><h3>${esc(r.name)} ${r.system ? '<span class="pill">Built-in</span>' : `<span><button class="btn ghost sm" data-editrole="${r.id}">Edit</button> <button class="btn danger sm" data-delrole="${r.id}">Delete</button></span>`}</h3><p>${esc(r.description || '')}</p>
        <div class="chips">${(r.permissions.includes('*') ? ['Everything'] : r.permissions.map(p => d.permissions[p] || p)).map(p => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>`).join('')}</div>
      <p><button class="btn" data-newrole>Create custom role</button></p>`}`;
    c.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { membersTab = b.dataset.tab; draw(); });
    c.querySelectorAll('[data-role]').forEach(s => s.onchange = () => act('/members/update', { id: s.dataset.role, role: s.value }, 'Role updated'));
    c.querySelectorAll('[data-susp]').forEach(b => b.onclick = () => act('/members/update', { id: b.dataset.susp, status: b.dataset.to }, b.dataset.to === 'active' ? 'Member reactivated' : 'Member suspended'));
    c.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => confirmBox('Remove this member?', 'They will lose access immediately.', () => act('/members/remove', { id: b.dataset.rm }, 'Member removed')));
    c.querySelectorAll('[data-revoke]').forEach(b => b.onclick = () => act('/invites/revoke', { id: b.dataset.revoke }, 'Invitation cancelled'));
    c.querySelectorAll('[data-editrole]').forEach(b => b.onclick = () => roleModal(d, roles[b.dataset.editrole]));
    c.querySelectorAll('[data-delrole]').forEach(b => b.onclick = () => confirmBox('Delete this role?', 'Only roles with no members can be deleted.', () => act('/roles/delete', { id: b.dataset.delrole }, 'Role deleted')));
    const nr = $('[data-newrole]', c); if (nr) nr.onclick = () => roleModal(d, null);
  };
  const act = async (p, body, msg) => { try { await api(p, body); toast(msg); viewMembers(); } catch (e) { toast(e.message); viewMembers(); } };
  $('[data-invite]').onclick = () => inviteModal(d);
  draw();
}
function modal(html) {
  const o = document.createElement('div'); o.className = 'overlay center'; o.innerHTML = `<div class="modal">${html}</div>`; document.body.append(o);
  o.onclick = e => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); };
  return o;
}
/* opts: { yesLabel, danger, warn (strong red warning text), typeWord (must be typed to enable the button) } */
function confirmBox(title, text, yes, opts = {}) {
  const o = modal(`<header><h2>${esc(title)}</h2><button class="x" data-close>×</button></header><p style="color:var(--mut)">${esc(text)}</p>
    ${opts.warn ? `<div class="err warnbox">${esc(opts.warn)}</div>` : ''}
    ${opts.typeWord ? `<label class="field"><span>Type <b class="typeword">${esc(opts.typeWord)}</b> to confirm</span><input data-typeword autocomplete="off" autocapitalize="off" spellcheck="false"></label>` : ''}
    <div class="confirm-acts"><button class="btn ghost" data-close>Cancel</button><button class="btn${opts.danger ? ' dangerfill' : ''}" data-yes ${opts.typeWord ? 'disabled' : ''}>${esc(opts.yesLabel || 'Confirm')}</button></div>`);
  const yb = $('[data-yes]', o), tw = $('[data-typeword]', o);
  const norm = s => s.trim().replace(/^#/, '').toLowerCase();
  if (tw) { tw.oninput = () => { yb.disabled = norm(tw.value) !== norm(opts.typeWord); }; tw.onkeydown = e => { if (e.key === 'Enter' && !yb.disabled) yb.click(); }; setTimeout(() => tw.focus(), 50); }
  yb.onclick = () => { if (yb.disabled) return; o.remove(); yes(tw ? opts.typeWord : ''); };
}
function inviteModal(d) {
  const o = modal(`<header><h2>Invite a member</h2><button class="x" data-close>×</button></header><div data-msg></div><form data-f>
    <label class="field"><span>Email</span><input name="email" type="email" required></label>
    <label class="field"><span>Name (optional)</span><input name="name"></label>
    <label class="field"><span>Role</span><select name="role">${d.roles.filter(r => r.id !== 'owner').map(r => `<option value="${r.id}">${esc(r.name)} — ${esc(r.description || '')}</option>`).join('')}</select></label>
    <button class="btn block" type="submit">Send invitation</button></form>`);
  const f = $('[data-f]', o);
  f.onsubmit = async e => { e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
    try { const r = await api('/members/invite', { email: f.email.value, name: f.name.value, role: f.role.value });
      o.querySelector('.modal').innerHTML = `<header><h2>Invitation created</h2><button class="x" data-close>×</button></header><p style="color:var(--mut)">${r.emailed ? 'We emailed the link. You can also copy it and send it yourself:' : 'Copy this link and send it to the member:'}</p><div class="copy"><input class="input" readonly value="${esc(r.link)}"><button class="btn" data-copy>Copy</button></div><p class="hint">The link works once and expires in 3 days.</p>`;
      $('[data-copy]', o).onclick = () => { navigator.clipboard.writeText(r.link); toast('Link copied'); };
      o.addEventListener('click', ev => { if (ev.target.closest('[data-close]')) viewMembers(); });
    } catch (er) { o.querySelector('[data-msg]').innerHTML = `<div class="err">${esc(er.message)}</div>`; b.disabled = false; } };
}
function roleModal(d, role) {
  const o = modal(`<header><h2>${role ? 'Edit role' : 'New custom role'}</h2><button class="x" data-close>×</button></header><div data-msg></div><form data-f>
    <label class="field"><span>Role name</span><input name="name" required value="${esc(role?.name || '')}" placeholder="e.g. Marketing"></label>
    <label class="field"><span>Description</span><input name="description" value="${esc(role?.description || '')}"></label>
    <span style="font-size:13px;font-weight:600;color:var(--ink-2)">Permissions</span>
    <div class="perms">${Object.entries(d.permissions).map(([k, v]) => `<label><input type="checkbox" name="perm" value="${k}" ${role?.permissions.includes(k) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div>
    <button class="btn block" type="submit">Save role</button></form>`);
  const f = $('[data-f]', o);
  f.onsubmit = async e => { e.preventDefault();
    try { await api('/roles/save', { id: role?.id || '', name: f.name.value, description: f.description.value, permissions: [...f.querySelectorAll('[name=perm]:checked')].map(x => x.value) }); o.remove(); toast('Role saved'); membersTab = 'roles'; viewMembers(); }
    catch (er) { o.querySelector('[data-msg]').innerHTML = `<div class="err">${esc(er.message)}</div>`; } };
}

/* ---------- activity, account, soon ---------- */
async function viewActivity() {
  const c = shell('Activity log', 'Team', '<div class="card empty">Loading…</div>', '/activity');
  const d = await api('/audit');
  c.innerHTML = d.entries.length ? `<table class="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>${d.entries.map(e => `<tr><td>${esc(fmtDate(e.createdAt))}</td><td>${esc(e.userName)}</td><td>${esc(e.action)}</td><td><small style="display:inline">${esc(e.detail || '')}</small></td></tr>`).join('')}</tbody></table>` : '<div class="card empty">No activity yet.</div>';
}
function viewAccount() {
  const c = shell('My account', 'Team', '', '/account');
  c.innerHTML = `<div class="grid g2"><div class="card"><h2>Profile</h2><dl class="kv"><dt>Name</dt><dd>${esc(ME.name)}</dd><dt>Email</dt><dd>${esc(ME.email)}</dd><dt>Role</dt><dd>${esc(ME.roleName)}</dd></dl>
    <h2>What you can do</h2><div class="chips">${PERMS.map(p => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>
    <div class="card"><h2>Change password</h2><div data-msg></div><form data-f><label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>
    <label class="field"><span>New password</span><input name="next" type="password" autocomplete="new-password" required minlength="10"><div class="hint">At least 10 characters, with letters and numbers. Other devices will be signed out.</div></label>
    <button class="btn" type="submit">Update password</button></form></div></div>`;
  const f = $('[data-f]', c);
  f.onsubmit = async e => { e.preventDefault(); try { await api('/password', { current: f.current.value, next: f.next.value }); f.reset(); showErr('Password updated.', true); } catch (er) { showErr(er); } };
}
function viewSoon(path) {
  const info = { '/editor': ['Website editor', 'A full-screen, drag-and-drop editor: add text, images, buttons, sections and forms, manage pages and menus, set site colours and fonts, edit for mobile, save drafts and publish.'],
    '/pricing': ['Prices & forms', 'Edit estimator prices and formulas, form fields and options, and discount codes. Changes apply to the website as soon as you publish them.'] }[path];
  shell(info[0], 'Website', `<div class="card soon-card"><span class="pill pending_confirmation">Next step</span><h2>${info[0]} is being built</h2><p>${info[1]}</p><p>Members with this permission will see it here as soon as it is ready.</p></div>`, path);
}

/* ---------- money, dates, charts ---------- */
const money = (c, cur = 'CAD') => (cur === 'CAD' ? 'CA$' : '$') + (Number(c || 0) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (n, isMoney) => { const v = isMoney ? n / 100 : n; const s = Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : isMoney ? v.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('en-CA'); return (isMoney ? 'CA$' : '') + s; };
const dshort = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';
const dlong = s => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const SERIES = '#2a78d6', GRID = '#e1e0d9', AXIS = '#c3c2b7', MUTED = '#898781';
const INV_STATUS = { draft: 'Draft', sent: 'Sent', overdue: 'Overdue', partial: 'Partial', paid: 'Paid', refunded: 'Refunded', void: 'Void' };
const invLabel = i => i.status === 'partial' && i.refunded ? 'Partial · refunded' : (INV_STATUS[i.status] || i.status);
const invPill = i => `<span class="pill inv-${esc(i.status)}" data-inv-status="${esc(i.status)}">${esc(invLabel(i))}</span>`;

function sparkline(values) {
  const w = 120, h = 34, max = Math.max(1, ...values), n = values.length;
  if (n < 2) return '';
  const pts = values.map((v, i) => [i * (w - 4) / (n - 1) + 2, h - 3 - (v / max) * (h - 8)]);
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M${pts.map(p => p.map(x => x.toFixed(1)).join(',')).join('L')}" fill="none" stroke="${SERIES}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${SERIES}" stroke="#fff" stroke-width="2"/></svg>`;
}
function delta(cur, prev, label) {
  if (!prev && !cur) return `<span class="delta flat">No change vs ${label}</span>`;
  if (!prev) return `<span class="delta up">▲ New vs ${label}</span>`;
  const p = (cur - prev) / prev * 100;
  if (Math.abs(p) < 0.5) return `<span class="delta flat">Same as ${label}</span>`;
  return `<span class="delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}% vs ${label}</span>`;
}
const niceMax = v => { if (v <= 0) return 4; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
function bucket(labels, values, days) {
  if (days < 90) return { labels, values };
  const L = [], V = []; const step = days >= 365 ? 30 : 7;
  for (let i = 0; i < labels.length; i += step) { L.push(labels[i]); V.push(values.slice(i, i + step).reduce((a, b) => a + b, 0)); }
  return { labels: L, values: V };
}
// Single-series chart: 'line' (area wash + crosshair) or 'col' (columns, per-mark tooltip).
function chart(el, labels, values, { kind = 'line', isMoney = false, name = '' } = {}) {
  const W = 680, H = 230, L = 52, R = 12, T = 12, B = 28, pw = W - L - R, ph = H - T - B, n = values.length;
  const max = niceMax(Math.max(...values, isMoney ? 10000 : 4));
  const x = i => kind === 'col' ? L + (i + 0.5) * pw / n : L + (n > 1 ? i * pw / (n - 1) : pw / 2);
  const y = v => T + ph - (v / max) * ph;
  const fmtV = v => isMoney ? money(v) : Math.round(v).toLocaleString('en-CA');
  const fmtTick = v => isMoney ? compact(v, true) : compact(v);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = max * k / 4, yy = y(v); g += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="${k ? GRID : AXIS}" stroke-width="1"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end" class="tick">${fmtTick(v)}</text>`; }
  const every = Math.max(1, Math.ceil(n / 7));
  labels.forEach((l, i) => { if (i % every === 0 || i === n - 1 && n < 15) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="tick">${dshort(l)}</text>`; });
  let marks = '';
  if (kind === 'line') {
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    marks = `<path d="M${x(0)},${y(0)}L${pts.join('L')}L${x(n - 1)},${y(0)}Z" fill="${SERIES}" opacity=".1"/><path d="M${pts.join('L')}" fill="none" stroke="${SERIES}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(n - 1)}" cy="${y(values[n - 1])}" r="4" fill="${SERIES}" stroke="#fff" stroke-width="2"/>
      <line class="xh" x1="0" x2="0" y1="${T}" y2="${T + ph}" stroke="${MUTED}" stroke-width="1" visibility="hidden"/><circle class="xd" r="4" fill="${SERIES}" stroke="#fff" stroke-width="2" visibility="hidden"/>`;
  } else {
    const bw = Math.min(24, Math.max(2, pw / n - 2));
    marks = values.map((v, i) => { const h = Math.max(0, y(0) - y(v)); const r = Math.min(4, h, bw / 2); const x0 = x(i) - bw / 2, y0 = y(v);
      return `<path class="bar" data-i="${i}" d="M${x0},${y(0)}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y(0)}Z" fill="${SERIES}"/>`; }).join('');
  }
  el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)}">${g}${marks}<rect class="hit" x="${L}" y="${T}" width="${pw}" height="${ph}" fill="transparent"/></svg><div class="tip" hidden></div></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), wrap = el.querySelector('.chart');
  const show = i => {
    if (i < 0 || i >= n) return;
    tip.hidden = false; tip.innerHTML = `<b>${esc(fmtV(values[i]))}</b><span>${esc(labels[i] === labels[i + 1] ? '' : dlong(labels[i]))}${kind === 'col' && n !== values.length ? '' : ''}</span>`;
    const sx = x(i) / W * svg.clientWidth; tip.style.left = Math.min(Math.max(sx, 60), svg.clientWidth - 60) + 'px';
    if (kind === 'line') { const xh = svg.querySelector('.xh'), xd = svg.querySelector('.xd'); xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('visibility', 'visible'); xd.setAttribute('cx', x(i)); xd.setAttribute('cy', y(values[i])); xd.setAttribute('visibility', 'visible'); }
    svg.querySelectorAll('.bar').forEach(b => b.style.opacity = +b.dataset.i === i ? 1 : .55);
  };
  const hide = () => { tip.hidden = true; svg.querySelectorAll('.xh,.xd').forEach(e => e.setAttribute('visibility', 'hidden')); svg.querySelectorAll('.bar').forEach(b => b.style.opacity = 1); };
  svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; const i = kind === 'col' ? Math.floor((px - L) / (pw / n)) : Math.round((px - L) / (pw / Math.max(1, n - 1))); show(Math.max(0, Math.min(n - 1, i))); });
  svg.addEventListener('pointerleave', hide);
  wrap.tabIndex = 0; let fi = n - 1;
  wrap.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') fi = Math.max(0, fi - 1); else if (e.key === 'ArrowRight') fi = Math.min(n - 1, fi + 1); else return; e.preventDefault(); show(fi); });
  wrap.addEventListener('focus', () => show(fi)); wrap.addEventListener('blur', hide);
}
function barList(items, { total, emptyText = 'No data yet' } = {}) {
  if (!items || !items.length) return `<div class="empty small">${esc(emptyText)}</div>`;
  const max = Math.max(...items.map(i => i.value), 1), sum = total || items.reduce((a, b) => a + b.value, 0);
  return `<ul class="blist">${items.map(i => `<li title="${esc(i.path || i.label)}"><div class="bl-top"><span>${esc(i.label)}</span><b>${i.value.toLocaleString('en-CA')}<small> · ${Math.round(i.value / sum * 100)}%</small></b></div><div class="bl-track"><i style="width:${Math.max(2, i.value / max * 100)}%"></i></div></li>`).join('')}</ul>`;
}

/* ---------- home dashboard ---------- */
let homeDays = 30;
async function viewHome() {
  const c = shell('Home', 'Admin', '<div class="card empty">Loading…</div>', '/');
  const [o, a] = await Promise.all([api('/overview'), api('/analytics?days=' + homeDays).catch(() => null)]);
  const r = o.requests;
  const period = { 7: 'last 7 days', 30: 'last 30 days', 90: 'last 90 days', 365: 'last 12 months' }[homeDays];
  const prevLabel = 'previous ' + { 7: '7 days', 30: '30 days', 90: '90 days', 365: '12 months' }[homeDays];
  const m = a ? a.metrics : {};
  const tile = (k, hero) => { const x = m[k]; if (!x) return ''; return `<div class="card stat${hero ? ' hero' : ''}"><small>${esc(x.label)}</small><b>${compact(x.value, x.money)}</b>${delta(x.value, x.prev, prevLabel)}${sparkline(bucket(a.labels, x.series, homeDays).values)}</div>`; };
  c.innerHTML = `<div data-apphome></div><div class="dash-head"><div class="welcome-l"><div class="avatar">${esc(initials(ME.name))}</div><div><h2>Welcome back, ${esc(ME.name.split(' ')[0])}</h2><p>${esc(ME.roleName)} · Satin Graphic${a && a.activeNow ? ` · <span class="live">● ${a.activeNow} on the site now</span>` : ''}</p></div></div>
    <div class="row-actions">${can('invoices.edit') ? '<a class="btn sm" href="#/invoices/edit">+ New invoice</a>' : ''}<a class="btn ghost sm" href="/admin/editor/">Edit website</a></div></div>
    ${a ? `<div class="filters"><label>Your key stats for <select class="input" data-days>${[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months']].map(([v, l]) => `<option value="${v}" ${v === homeDays ? 'selected' : ''}>${l}</option>`).join('')}</select></label><span class="hint" style="margin:0">Visits count people who allowed anonymous measurement on the website.</span></div>
    <div class="grid g4 tiles">${tile('sessions')}${tile('pageviews')}${tile('requests')}${tile('contact')}${m.paid ? tile('paid') + tile('invoiced') + `<a class="card stat link" href="#/invoices?status=open"><small>Outstanding</small><b>${compact(a.invoices.outstanding, true)}</b><span class="delta flat">${a.invoices.open} open invoice${a.invoices.open === 1 ? '' : 's'}</span></a><a class="card stat link" href="#/invoices?status=overdue"><small>Overdue</small><b class="${a.invoices.overdue ? 'warn-t' : ''}">${compact(a.invoices.overdue, true)}</b><span class="delta ${a.invoices.overdue ? 'down' : 'flat'}">${a.invoices.overdue ? '⚠ Needs follow-up' : 'Nothing overdue'}</span></a>` : ''}</div>
    <div class="grid g2" style="margin-top:18px"><div class="card"><h2>Site sessions <span class="sub">${period}</span></h2><div data-ch-sessions></div></div>
      ${m.paid ? `<div class="card"><h2>Amount paid <span class="sub">${period}</span></h2><div data-ch-paid></div></div>` : `<div class="card"><h2>Requests <span class="sub">${period}</span></h2><div data-ch-req></div></div>`}</div>
    <div class="grid g3" style="margin-top:18px"><div class="card"><h2>Top pages</h2>${barList(a.topPages)}</div><div class="card"><h2>Traffic sources</h2>${barList(a.sources)}</div><div class="card"><h2>Devices</h2>${barList(a.devices)}<h2 style="margin-top:18px">Languages</h2>${barList((a.languages || []).map(l => ({ ...l, label: { en: 'English', fr: 'Français', es: 'Español', fa: 'فارسی' }[l.label] || l.label })))}</div></div>` : ''}
    <div class="grid g2" style="margin-top:18px">${r ? `<div class="card"><h2>Latest requests <a class="sub" href="#/requests">View all</a></h2>${r.recent.length ? requestTable(r.recent.slice(0, 5)) : '<div class="empty">No requests yet.</div>'}</div>` : ''}
    ${a && a.invoices ? `<div class="card"><h2>Recent invoices <a class="sub" href="#/invoices">View all</a></h2>${a.invoices.recent.length ? invoiceTable(a.invoices.recent, true) : '<div class="empty">No invoices yet. <a href="#/invoices/edit">Create the first one</a>.</div>'}</div>` : ''}</div>`;
  if (a) {
    const s = bucket(a.labels, m.sessions.series, homeDays); chart($('[data-ch-sessions]', c), s.labels, s.values, { name: 'Site sessions' });
    if (m.paid) { const p = bucket(a.labels, m.paid.series, homeDays); chart($('[data-ch-paid]', c), p.labels, p.values, { kind: 'col', isMoney: true, name: 'Amount paid' }); }
    else { const q = bucket(a.labels, m.requests.series, homeDays); chart($('[data-ch-req]', c), q.labels, q.values, { kind: 'col', name: 'Requests' }); }
    $('[data-days]', c).onchange = e => { homeDays = +e.target.value; viewHome(); };
  }
  bindRows(c); bindInvRows(c);
  if (window.SatinPWA && window.SatinPWA.home) window.SatinPWA.home($('[data-apphome]', c), { overview: o, analytics: a });
}

/* ---------- invoices list ---------- */
function invoiceTable(rows, short) {
  const acts = !short && can('invoices.edit');
  return `<table class="table${acts ? ' has-acts' : ''}"><thead><tr><th>Number</th><th>Customer</th>${short ? '' : '<th>Issue date</th><th>Due date</th>'}<th class="num">Total</th><th>Status</th>${acts ? '<th class="act"><span class="sr">Actions</span></th>' : ''}</tr></thead><tbody>${rows.map(i => `
    <tr class="click" data-inv="${esc(i.id)}"><td><b>${esc(i.number)}</b>${i.title ? `<small>${esc(i.title)}</small>` : ''}</td><td>${esc(i.customer.name)}<small>${esc(i.customer.company || i.customer.email || '')}</small></td>
    ${short ? '' : `<td>${esc(dlong(i.issueDate))}</td><td>${esc(dlong(i.dueDate))}</td>`}<td class="num"><b>${money(i.total, i.currency)}</b>${i.status === 'refunded' ? `<small>${money(i.refunded)} refunded</small>` : i.paid && !['paid', 'void'].includes(i.status) ? `<small>${money(i.balance)} due</small>` : ''}</td>
    <td>${invPill(i)}${i.nextDue && ['sent', 'partial', 'overdue'].includes(i.status) ? `<small>Next: ${money(i.nextDue.amount)}${i.nextDue.due ? ' · ' + esc(dshort(i.nextDue.due)) : ''}</small>` : i.viewedAt && !['paid', 'refunded', 'void'].includes(i.status) ? '<small>Viewed</small>' : ''}</td>${acts ? `<td class="act"><button type="button" class="rowmenu" data-invmenu="${esc(i.id)}" aria-label="Actions for invoice ${esc(i.number)}" title="More actions">⋯</button></td>` : ''}</tr>`).join('')}</tbody></table>`;
}
function bindInvRows(root) { root.querySelectorAll('tr[data-inv]').forEach(tr => tr.onclick = e => { if (e.target.closest('.act')) return; go('/invoices/edit?id=' + tr.dataset.inv); }); }
/* small pop-up menu next to a button (bottom sheet on phones via mobile.css) */
function popMenu(btn, items, onPick) {
  document.querySelectorAll('.menu-pop').forEach(m => m.remove());
  const m = document.createElement('div'); m.className = 'menu-pop'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map(([k, l, cls]) => `<button type="button" role="menuitem" data-m="${k}" class="${cls || ''}">${esc(l)}</button>`).join('');
  const r = btn.getBoundingClientRect(); document.body.append(m);
  const top = r.bottom + 6 + m.offsetHeight > innerHeight ? Math.max(8, r.top - 6 - m.offsetHeight) : r.bottom + 6;
  m.style.top = top + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px';
  const off = ev => { if (!m.contains(ev.target)) { m.remove(); removeEventListener('click', off, true); removeEventListener('keydown', esck); } };
  const esck = ev => { if (ev.key === 'Escape') { m.remove(); removeEventListener('click', off, true); removeEventListener('keydown', esck); btn.focus(); } };
  setTimeout(() => { addEventListener('click', off, true); addEventListener('keydown', esck); }, 0);
  m.onclick = ev => { const k = ev.target.closest('[data-m]')?.dataset.m; if (!k) return; m.remove(); removeEventListener('click', off, true); removeEventListener('keydown', esck); onPick(k); };
  m.querySelector('button')?.focus();
}
/* Delete any invoice. With payments on record: stronger warning + type the invoice number. */
function deleteInvoice(i, done) {
  const pays = i.payCount ?? (i.payments || []).length, hasPay = pays > 0 || i.paid > 0;
  const who = i.customer && i.customer.name ? ` for ${i.customer.name}` : '';
  confirmBox(`Delete invoice #${i.number}?`, `Invoice #${i.number}${who} (${money(i.total, i.currency)}, ${invLabel(i)}) and its customer link will be removed permanently. This cannot be undone.${!hasPay && i.status !== 'draft' && i.status !== 'void' ? ' To keep a record instead, use Void.' : ''}`,
    async typed => { try { await api('/invoices/delete', { id: i.id, confirm: typed }); toast(`Invoice #${i.number} deleted`); done(); } catch (e) { toast(e.message); } },
    { danger: true, yesLabel: 'Delete invoice', ...(hasPay ? { typeWord: String(i.number), warn: `This invoice has ${pays || 'some'} payment/refund record${pays === 1 ? '' : 's'} (${money(i.paid, i.currency)} paid${i.refunded ? ', ' + money(i.refunded, i.currency) + ' refunded' : ''}). They are deleted with it and your paid totals change. No money is refunded — refunds must be done in Square/PayPal (or recorded) first.` } : {}) });
}
let invDays = 30;
async function viewInvoices(params) {
  const c = shell('Invoices', 'Business', '<div class="card empty">Loading…</div>', '/invoices');
  $('[data-actions]').innerHTML = `${can('invoices.edit') && can('settings.edit') ? '<a class="btn ghost sm" href="#/invoices/settings">Settings</a> ' : ''}${can('invoices.edit') ? '<a class="btn sm" href="#/invoices/edit">+ New invoice</a>' : ''}`;
  const d = await api('/invoices?days=' + invDays);
  const ov = d.overview;
  c.innerHTML = `<div class="card ov"><div class="ov-head"><h2>Overview</h2><select class="input" data-days>${[[30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months'], [3650, 'All time']].map(([v, l]) => `<option value="${v}" ${v === invDays ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="ov-grid"><div><b>${money(ov.outstanding)}</b><small>Outstanding</small></div><div><b class="${ov.overdue ? 'warn-t' : ''}">${money(ov.overdue)}</b><small>Overdue</small></div><div><b>${money(ov.paid)}</b><small>Total paid</small></div></div></div>
    <div class="inv-chips" data-chips>${[['', 'All', d.invoices.length], ['open', 'Unpaid', d.invoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).length], ...Object.entries(INV_STATUS).map(([k, v]) => [k, v, (ov.counts || {})[k] || 0])].map(([k, v, n]) => `<button type="button" class="inv-chip ${k ? 'c-' + k : ''}" data-chip="${k}">${esc(v)} <b>${n}</b></button>`).join('')}</div>
    <div class="toolbar"><select class="input" data-st><option value="">All invoices</option><option value="open">Unpaid (sent, partial, overdue)</option>${Object.entries(INV_STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input class="input" data-q placeholder="Search number, customer, email, title"></div><div data-list></div>`;
  const st = $('[data-st]', c), q = $('[data-q]', c);
  c.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { st.value = b.dataset.chip; draw(); });
  st.value = params.get('status') || ''; q.value = params.get('q') || '';
  const draw = () => {
    const s = st.value, t = q.value.trim().toLowerCase();
    const rows = d.invoices.filter(i => (!s || (s === 'open' ? ['sent', 'partial', 'overdue'].includes(i.status) : i.status === s)) && (!t || [i.number, i.customer.name, i.customer.company, i.customer.email, i.title].join(' ').toLowerCase().includes(t)));
    c.querySelectorAll('[data-chip]').forEach(b => b.classList.toggle('on', b.dataset.chip === s));
    $('[data-list]', c).innerHTML = rows.length ? invoiceTable(rows.slice(0, 500)) : `<div class="card empty">${d.invoices.length ? 'No invoices match.' : 'No invoices yet. Click “New invoice” to create your first one.'}</div>`;
    bindInvRows(c);
    c.querySelectorAll('[data-invmenu]').forEach(b => b.onclick = e => { e.stopPropagation(); const inv = d.invoices.find(x => x.id === b.dataset.invmenu); if (!inv) return;
      popMenu(b, [['open', 'Open invoice'], ['del', 'Delete invoice…', 'danger']], k => {
        if (k === 'open') go('/invoices/edit?id=' + inv.id);
        if (k === 'del') deleteInvoice(inv, () => { params.set('status', st.value); params.set('q', q.value); viewInvoices(params); });
      }); });
  };
  st.onchange = draw; q.oninput = draw; $('[data-days]', c).onchange = e => { invDays = +e.target.value; viewInvoices(params); };
  draw();
}

/* ---------- invoice editor ---------- */
function calcInvoice(inv, taxes) {
  const rates = Object.fromEntries(taxes.map(t => [t.id, t]));
  const lines = inv.items.map(it => Math.round((+it.qty || 0) * Math.round((+it.price || 0) * 100)));
  const subtotal = lines.reduce((a, b) => a + b, 0);
  let disc = 0; const dv = +inv.discount?.value || 0;
  if (inv.discount?.type === 'percent') disc = Math.round(subtotal * Math.min(100, Math.max(0, dv)) / 100); else if (inv.discount?.type === 'amount') disc = Math.min(subtotal, Math.round(dv * 100));
  const base = {};
  inv.items.forEach((it, i) => { const share = subtotal ? lines[i] - disc * lines[i] / subtotal : 0; (it.taxes || []).forEach(t => { if (rates[t]) base[t] = (base[t] || 0) + share; }); });
  const tx = Object.entries(base).map(([id, b]) => ({ id, name: rates[id].name, rate: rates[id].rate, amount: Math.round(b * rates[id].rate / 100) }));
  const tax = tx.reduce((a, b) => a + b.amount, 0);
  return { lines, subtotal, disc, taxes: tx, tax, total: subtotal - disc + tax };
}
let INV = null, INVSET = null, INVLOOK = null, INVMETHODS = {}, invDirty = false;
async function viewInvoiceEdit(params) {
  const c = shell('Invoice', 'Business · Invoices', '<div class="card empty">Loading…</div>', '/invoices');
  const id = params.get('id');
  const [d, look] = await Promise.all([api(id ? '/invoices/get?id=' + encodeURIComponent(id) : '/invoices/new?' + new URLSearchParams({ request: params.get('request') || '', customer: params.get('customer') || '' })), can('invoices.edit') ? api('/invoices/lookup') : { customers: [], items: [] }]);
  INV = d.invoice; INVSET = d.settings; INVLOOK = look; INVMETHODS = d.methods || {}; invDirty = false;
  INV.items = INV.items.map(it => ({ ...it, price: id ? it.price / 100 : it.price }));
  INV.deposit = normPlan(INV.deposit);
  INV.publicUrl = d.publicUrl || '';
  drawInvoice(c);
}
function drawInvoice(c) {
  const i = INV, s = INVSET, b = i.business || s.business, ro = !can('invoices.edit') || i.baseStatus === 'void';
  const top = $('.top h1'); if (top) top.textContent = i.id ? 'Invoice #' + i.number : 'New invoice';
  $('[data-actions]').innerHTML = ro ? (i.id ? `<a class="btn ghost sm" href="${esc(i.publicUrl)}" target="_blank" rel="noopener">View / print</a>` : '') :
    `<a class="btn ghost sm" href="#/invoices">Close</a> <button class="btn ghost sm" data-save>${i.id ? 'Save' : 'Save draft'}</button> ${i.id ? '<div class="more"><button class="btn ghost sm" data-more>More ▾</button><div class="menu" hidden></div></div>' : ''} <button class="btn sm" data-sendinv>${i.status === 'draft' ? 'Send invoice' : 'Resend'}</button>`;
  const cust = i.customer || {};
  c.innerHTML = `${i.id ? `<div class="inv-status">${invPill(i)}${i.refunded ? `<span>${money(i.refunded)} refunded</span>` : ''}${i.nextDue && ['sent', 'partial', 'overdue'].includes(i.status) ? `<span>Next payment: ${esc(i.nextDue.label)} ${money(i.nextDue.amount)}${i.nextDue.due ? ' due ' + esc(dlong(i.nextDue.due)) : ''}</span>` : ''}${i.sentAt ? `<span>Sent ${esc(dlong(i.sentAt))}</span>` : ''}${i.viewedAt ? `<span>Viewed by customer ${esc(dlong(i.viewedAt))}</span>` : ''}${i.requestId ? `<span>From a website request</span>` : ''}</div>` : ''}
  <div class="card inv-doc"><fieldset ${ro ? 'disabled' : ''}>
    <div class="inv-head"><div class="inv-biz">${b.logo ? `<img src="${esc(b.logo)}" alt="">` : ''}<b>${esc(b.name)}</b><div>${esc(b.address)}</div><div>${esc(b.email)} · ${esc(b.phone)}</div>${b.taxNumber ? `<div>${esc(b.taxNumber)}</div>` : ''}${can('settings.edit') ? '<a href="#/invoices/settings" class="hint">Edit business info</a>' : ''}</div>
      <div class="inv-meta"><h2>Invoice #${esc(i.number)}</h2>
        <label>Issue date <input type="date" class="input" data-f="issueDate" value="${esc(i.issueDate)}"></label>
        <label>Due date <input type="date" class="input" data-f="dueDate" value="${esc(i.dueDate)}"></label>
        <label>Payment terms <select class="input" data-terms><option value="">Custom</option>${[[0, 'Due on receipt'], [7, 'Net 7'], [15, 'Net 15'], [30, 'Net 30'], [45, 'Net 45'], [60, 'Net 60']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label>Sales representative <input class="input" data-f="salesRep" value="${esc(i.salesRep || '')}" placeholder="Optional"></label></div></div>
    <div class="inv-sec"><div class="lbl">Customer *</div>
      <div class="cust-pick"><div class="cbx" data-cbx><input class="input" data-custsearch role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="cbx-list" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Search customers by name, company or email" value="${esc(cust.name || '')}"><span class="cbx-caret" aria-hidden="true">▾</span>
        <div class="cbx-list" id="cbx-list" role="listbox" aria-label="Customers" hidden></div></div>
        ${i.customerId ? `<div class="cbx-linked"><span>✓ Saved customer</span>${ro ? '' : '<button type="button" class="linkbtn" data-editcust>Edit customer</button>'}</div>` : cust.name && !ro ? '<div class="cbx-linked new"><span>New customer — saved with the invoice</span></div>' : ''}</div>
      <div class="grid g2 cust-fields"><label class="field"><span>Company</span><input data-c="company" value="${esc(cust.company || '')}"></label><label class="field"><span>Email *</span><input type="email" data-c="email" value="${esc(cust.email || '')}"></label>
        <label class="field"><span>Phone</span><input data-c="phone" value="${esc(cust.phone || '')}"></label><label class="field"><span>Billing address</span><textarea rows="2" data-c="address">${esc(cust.address || '')}</textarea></label></div></div>
    <label class="field"><span>Invoice title</span><input data-f="title" value="${esc(i.title || '')}" placeholder="e.g. Commercial van wrap"></label>
    <table class="table lines"><thead><tr><th>Product or service</th><th class="num">Quantity</th><th class="num">Price</th><th>Taxes</th><th class="num">Line total</th><th></th></tr></thead><tbody data-lines></tbody></table>
    ${ro ? '' : `<button type="button" class="btn ghost sm" data-addline>+ Add line item</button><datalist id="itemlist">${INVLOOK.items.map(x => `<option value="${esc(x.name)}">${money(x.price)}</option>`).join('')}</datalist>`}
    <div class="inv-bottom"><div class="inv-notes"><label class="field"><span>Notes</span><textarea rows="3" data-f="notes" placeholder="e.g. Thanks for your business.">${esc(i.notes || '')}</textarea></label><label class="field"><span>Terms</span><textarea rows="3" data-f="terms" placeholder="e.g. Payment is due within 30 days.">${esc(i.terms || '')}</textarea></label></div>
      <div class="inv-totals" data-totals></div></div><div class="inv-sched" data-sched></div></fieldset></div>
    ${i.id ? `<div class="card" style="margin-top:18px"><h2>Payments & refunds ${ro ? '' : '<button class="btn ghost sm" style="float:right" data-pay>Record payment</button>'}</h2>${(i.payments || []).length ? `<table class="table pays"><thead><tr><th>Date</th><th>Method</th><th>Note</th><th class="num">Amount</th><th></th></tr></thead><tbody>${i.payments.map(p => { const left = p.amount - (p.refunded || 0); const edit = can('invoices.edit');
      return p.kind === 'refund' ? `<tr class="refund"><td>${esc(dlong(p.date))}</td><td><span class="pill inv-refunded">Refund</span> ${esc(p.methodName)}${p.online ? ' <span class="pill online">Online</span>' : ''}</td><td>${esc(p.note || '')}<small>${esc(p.createdBy || '')}</small></td><td class="num"><b class="refund-t">−${money(-p.amount)}</b></td><td style="text-align:right">${ro || p.online ? '' : `<button class="linkbtn" data-delpay="${esc(p.id)}">Remove</button>`}</td></tr>`
      : `<tr><td>${esc(dlong(p.date))}</td><td>${esc(p.methodName)}${p.online ? ' <span class="pill online">Online</span>' : ''}</td><td>${esc(p.note || '')}<small>${esc(p.createdBy || '')}</small></td><td class="num"><b>${money(p.amount)}</b>${p.refunded ? `<small>${money(p.refunded)} refunded</small>` : ''}</td><td style="text-align:right;white-space:nowrap">${edit && left > 0 ? `<button class="linkbtn" data-refund="${esc(p.id)}">Refund</button>` : ''}${ro || p.online ? '' : ` <button class="linkbtn" data-delpay="${esc(p.id)}">Remove</button>`}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty small">No payments recorded yet.</div>'}</div>` : ''}`;
  // customer
  if (!ro) custPicker(c, i);
  c.querySelectorAll('[data-c]').forEach(el => el.oninput = () => { i.customer = { ...(i.customer || {}), [el.dataset.c]: el.value }; invDirty = true; });
  c.querySelectorAll('[data-f]').forEach(el => el.oninput = () => { i[el.dataset.f] = el.value; invDirty = true; if (el.dataset.f === 'issueDate' || el.dataset.f === 'dueDate') syncTerms(); });
  const terms = $('[data-terms]', c);
  const syncTerms = () => { const dd = Math.round((new Date(i.dueDate) - new Date(i.issueDate)) / 864e5); terms.value = [0, 7, 15, 30, 45, 60].includes(dd) ? String(dd) : ''; };
  terms.onchange = () => { if (terms.value === '') return; const d = new Date(i.issueDate + 'T12:00:00'); d.setDate(d.getDate() + +terms.value); i.dueDate = d.toISOString().slice(0, 10); $('[data-f=dueDate]', c).value = i.dueDate; invDirty = true; };
  syncTerms();
  drawLines(c, ro); drawTotals(c, ro);
  const al = $('[data-addline]', c); if (al) al.onclick = () => { i.items.push({ name: '', description: '', qty: 1, price: 0, taxes: [...(s.defaultTaxes || [])] }); invDirty = true; drawLines(c, ro); drawTotals(c, ro); c.querySelector('[data-lines] tr:last-child input')?.focus(); };
  const sv = $('[data-save]'); if (sv) sv.onclick = () => saveInvoice(c).then(ok => ok && toast('Invoice saved'));
  const sd = $('[data-sendinv]'); if (sd) sd.onclick = () => sendInvoiceModal(c);
  const pay = $('[data-pay]', c); if (pay) pay.onclick = () => paymentModal(c);
  c.querySelectorAll('[data-refund]').forEach(bt => bt.onclick = () => refundModal(c, i.payments.find(p => p.id === bt.dataset.refund)));
  c.querySelectorAll('[data-delpay]').forEach(bt => bt.onclick = () => confirmBox('Remove this entry?', 'The amounts paid and the balance due are recalculated.', async () => { try { const r = await api('/invoices/payment/delete', { paymentId: bt.dataset.delpay }); setInv(r.invoice); drawInvoice(c); toast('Payment removed'); } catch (e) { toast(e.message); } }));
  const more = $('[data-more]');
  if (more) {
    const menu = more.nextElementSibling;
    const items = [['print', 'View / print / PDF'], ['copy', 'Copy customer link'], ...(i.status === 'draft' ? [['finalize', 'Mark as sent (no email)']] : []), ['dup', 'Duplicate'], ['newcust', 'New invoice for this customer'], ...(!['paid', 'void'].includes(i.status) ? [['pay', 'Record payment']] : []), ...(i.baseStatus !== 'void' ? [['void', 'Void invoice']] : []), ['del', i.status === 'draft' ? 'Delete draft' : 'Delete invoice…']];
    menu.innerHTML = items.map(([k, l]) => `<button data-m="${k}" class="${k === 'void' || k === 'del' ? 'danger' : ''}">${l}</button>`).join('');
    more.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
    document.addEventListener('click', () => { menu.hidden = true; }, { once: true });
    menu.onclick = async e => {
      const k = e.target.closest('[data-m]')?.dataset.m; if (!k) return; menu.hidden = true;
      if (k === 'print') { if (invDirty && !(await saveInvoice(c))) return; open(i.publicUrl, '_blank', 'noopener'); }
      if (k === 'copy') { navigator.clipboard.writeText(i.publicUrl); toast('Link copied'); }
      if (k === 'finalize') { try { const r = await api('/invoices/mark-sent', { id: i.id }); setInv(r.invoice); drawInvoice(c); toast('Marked as sent'); } catch (er) { toast(er.message); } }
      if (k === 'dup') { const copy = JSON.parse(JSON.stringify(i)); Object.assign(copy, { id: '', status: 'draft', baseStatus: 'draft', payments: [], paid: 0, refunded: 0, schedule: null, nextDue: null, sentAt: null, viewedAt: null, issueDate: todayISO(), number: '(new)' }); const d = new Date(); d.setDate(d.getDate() + (+INVSET.dueDays || 30)); copy.dueDate = d.toISOString().slice(0, 10); INV = copy; history.replaceState(null, '', '#/invoices/edit'); drawInvoice(c); toast('Copy ready — save to create it'); }
      if (k === 'newcust') go('/invoices/edit?customer=' + encodeURIComponent(i.customerId || ''));
      if (k === 'pay') paymentModal(c);
      if (k === 'void') confirmBox('Void this invoice?', 'The customer link will show it as VOID (no more payments) and it no longer counts as outstanding. Payments already received stay listed — refund them separately if needed. This cannot be undone.', async () => { try { await api('/invoices/void', { id: i.id }); toast('Invoice voided'); viewInvoiceEdit(new URLSearchParams('id=' + i.id)); } catch (er) { toast(er.message); } });
      if (k === 'del') deleteInvoice(i, () => { invDirty = false; go('/invoices'); });
    };
  }
}
/* Invoice customer picker (like Wix): searchable list, “+ Add new customer” first, keyboard ↑ ↓ Enter Esc. */
function custPicker(c, i) {
  const cs = $('[data-custsearch]', c), list = $('#cbx-list', c); if (!cs || !list) return;
  let rows = [], act = 0;
  const norm = v => String(v || '').toLowerCase();
  const pick = m => { i.customer = { name: m.name || '', company: m.company || '', email: m.email || '', phone: m.phone || '', address: m.address || '' }; i.customerId = m.id; invDirty = true; drawInvoice(c); };
  const saved = m => { const k = INVLOOK.customers.findIndex(x => x.id === m.id); if (k >= 0) INVLOOK.customers[k] = m; else INVLOOK.customers.unshift(m); pick(m); };
  const addNew = q => { close(); q = q.trim(); customerModal(q.includes('@') ? { email: q } : { name: q }, saved); };
  const close = () => { list.hidden = true; cs.setAttribute('aria-expanded', 'false'); cs.removeAttribute('aria-activedescendant'); };
  const mark = () => { list.querySelectorAll('[role=option]').forEach((el, k) => { el.classList.toggle('on', k === act); el.setAttribute('aria-selected', k === act ? 'true' : 'false'); });
    const el = list.querySelector(`#cbx-opt-${act}`); if (el) { cs.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); } };
  const hl = (t, q) => { t = String(t || ''); const k = q ? norm(t).indexOf(q) : -1; return k < 0 ? esc(t) : esc(t.slice(0, k)) + '<mark>' + esc(t.slice(k, k + q.length)) + '</mark>' + esc(t.slice(k + q.length)); };
  const open = () => {
    const q = norm(cs.value).trim(), words = q.split(/\s+/).filter(Boolean);
    const hits = INVLOOK.customers.filter(x => { const h = norm([x.name, x.company, x.email, x.phone].join(' ')); return words.every(w => h.includes(w)); });
    rows = [{ add: true }, ...hits.slice(0, 50)];
    act = q && hits.length ? 1 : 0;
    list.innerHTML = rows.map((x, k) => x.add
      ? `<div role="option" id="cbx-opt-${k}" class="cbx-opt add" data-k="${k}"><b>+ Add new customer</b>${q ? `<small>“${esc(cs.value.trim())}”</small>` : ''}</div>`
      : `<div role="option" id="cbx-opt-${k}" class="cbx-opt" data-k="${k}"><span class="avatar sm">${esc(initials(x.name))}</span><span><b>${hl(x.name, q)}</b><small>${[x.company, x.email].filter(Boolean).map(v => hl(v, q)).join(' · ') || '&nbsp;'}</small></span></div>`).join('')
      + (hits.length ? (hits.length > 50 ? `<div class="cbx-more">${hits.length - 50} more — keep typing to narrow</div>` : '') : `<div class="cbx-more">${INVLOOK.customers.length ? 'No saved customer matches' : 'No saved customers yet'}</div>`);
    list.hidden = false; cs.setAttribute('aria-expanded', 'true'); mark();
  };
  const choose = k => { const x = rows[k]; if (!x) return; if (x.add) addNew(cs.value); else { close(); pick(x); } };
  cs.onfocus = () => { open(); if (matchMedia('(max-width:820px)').matches) setTimeout(() => { const h = $('.top'); cs.style.scrollMarginTop = ((h ? h.getBoundingClientRect().bottom : 0) + 12) + 'px'; cs.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 250); }; // phones: room for the list above the keyboard
  cs.onclick = () => { if (list.hidden) open(); };
  cs.oninput = () => { i.customer = { ...(i.customer || {}), name: cs.value }; if (i.customerId) { i.customerId = null; const l = $('.cbx-linked', c); if (l) l.remove(); } invDirty = true; open(); };
  cs.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) { open(); return; } act = (act + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; mark(); }
    else if (e.key === 'Enter') { if (!list.hidden) { e.preventDefault(); choose(act); } }
    else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); close(); } }
    else if (e.key === 'Tab') close();
  };
  cs.onblur = () => setTimeout(() => { if (document.activeElement !== cs) close(); }, 150);
  list.onpointerdown = e => e.preventDefault(); // keep focus in the input while choosing
  list.onclick = e => { const el = e.target.closest('[data-k]'); if (el) choose(+el.dataset.k); };
  list.onpointermove = e => { const el = e.target.closest('[data-k]'); if (el && +el.dataset.k !== act) { act = +el.dataset.k; mark(); } };
  const ed = $('[data-editcust]', c);
  if (ed) ed.onclick = () => { const m = INVLOOK.customers.find(x => x.id === i.customerId) || { id: i.customerId };
    const cur = i.customer || {}; customerModal({ ...m, ...Object.fromEntries(['name', 'company', 'email', 'phone', 'address'].map(k => [k, cur[k] ?? m[k] ?? ''])), id: i.customerId }, saved); };
}
function setInv(inv) { INV = { ...inv, items: inv.items.map(it => ({ ...it, price: it.price / 100 })), deposit: normPlan(inv.deposit), publicUrl: INV.publicUrl }; invDirty = false; }
/* payment schedule: { items: [{label, type: percent|amount, value, due}, …, {label, type: 'balance'}] } (legacy {type, value} = deposit + balance) */
function normPlan(d) {
  d = d || {};
  if (Array.isArray(d.items) && d.items.length >= 2) return { items: d.items.map((x, k) => ({ label: x.label || '', type: k === d.items.length - 1 ? 'balance' : (x.type === 'percent' ? 'percent' : 'amount'), value: +x.value || 0, due: x.due || '' })) };
  if (d.type && +d.value > 0) return { items: [{ label: 'Deposit', type: d.type, value: +d.value, due: '' }, { label: 'Final balance', type: 'balance', value: 0, due: '' }] };
  return {};
}
const PLAN_LABELS = ['Deposit', 'Second payment', 'Third payment'];
function planResize(plan, n) {
  const old = (plan.items || []).slice(0, -1), last = (plan.items || []).slice(-1)[0];
  if (!n) return {};
  const pct = { 2: [50], 3: [30, 30], 4: [25, 25, 25] }[n];
  const items = pct.map((v, k) => old[k] ? { ...old[k] } : { label: PLAN_LABELS[k], type: 'percent', value: v, due: '' });
  items.push({ label: last?.label || 'Final balance', type: 'balance', value: 0, due: '' });
  return { items };
}
function planAmounts(plan, total) {
  let cum = 0; const n = (plan.items || []).length;
  return (plan.items || []).map((x, k) => { if (k === n - 1) return total - cum; const a = x.type === 'percent' ? Math.round(total * (+x.value || 0) / 100) : Math.round((+x.value || 0) * 100); cum += a; return a; });
}
function drawSchedule(c, ro) {
  const i = INV, box = $('[data-sched]', c); if (!box) return;
  const total = calcInvoice(i, INVSET.taxes || []).total, plan = i.deposit || {}, items = plan.items || [], n = items.length;
  const amts = planAmounts(plan, total), last = amts[n - 1];
  const srv = !invDirty && !['refunded', 'void', 'draft'].includes(i.status) && Array.isArray(i.schedule) && i.schedule.length === n ? i.schedule : null;
  const STATE = { paid: 'Paid', due: 'Due now', next: 'Next', overdue: 'Overdue', upcoming: 'Upcoming' };
  const err = n && (amts.slice(0, -1).some(a => a <= 0) ? 'Enter an amount for every scheduled payment.' : last <= 0 ? `The scheduled payments add up to ${money(total - last)}, more than the invoice total (${money(total)}). Lower them so a final balance remains.` : '');
  box.innerHTML = `<div class="sched-head"><div><h3>Payment schedule</h3><p class="hint">Ask for a deposit or split the invoice into instalments. The customer can pay each one online from the invoice link; the last payment is always the remaining balance.</p></div>
    <select class="input" data-plan ${ro ? 'disabled' : ''}>${[[0, 'No schedule (one payment)'], [2, 'Deposit + final balance'], [3, '3 payments (2 deposits + balance)'], [4, '4 payments (3 deposits + balance)']].map(([v, l]) => `<option value="${v}" ${v === n ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${n ? `<table class="table sched"><thead><tr><th>#</th><th>Label</th><th>Amount</th><th class="num">CA$</th><th>Due date</th>${srv ? '<th>Status</th>' : ''}</tr></thead><tbody>
    ${items.map((x, k) => `<tr data-k="${k}"><td>${k + 1}</td><td><input class="input" data-s="label" value="${esc(x.label)}" maxlength="60" placeholder="${k === n - 1 ? 'Final balance' : PLAN_LABELS[k]}"></td>
      <td>${k === n - 1 ? '<span class="hint">Remaining balance</span>' : `<span class="amt"><input class="input xs" type="number" step="0.01" min="0" data-s="value" value="${esc(x.value)}"><select class="input xs" data-s="type"><option value="percent" ${x.type === 'percent' ? 'selected' : ''}>%</option><option value="amount" ${x.type === 'amount' ? 'selected' : ''}>CA$</option></select></span>`}</td>
      <td class="num"><b class="${amts[k] <= 0 ? 'warn-t' : ''}">${money(amts[k])}</b></td>
      <td>${k === n - 1 ? `<span class="hint">${esc(dlong(i.dueDate))} (invoice due date)</span>` : `<input class="input" type="date" data-s="due" value="${esc(x.due || '')}" min="${esc(i.issueDate)}" max="${esc(i.dueDate)}">`}</td>
      ${srv ? `<td><span class="pill sch-${esc(srv[k].state)}">${STATE[srv[k].state] || esc(srv[k].state)}</span>${srv[k].paid && srv[k].remaining ? `<small>${money(srv[k].paid)} paid</small>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table>
    ${err ? `<div class="err" data-sched-err>${esc(err)}</div>` : '<p class="hint">Leave a due date empty for “due on receipt”.</p>'}` : ''}`;
  const pl = $('[data-plan]', box); if (pl) pl.onchange = () => { i.deposit = planResize(plan, +pl.value); invDirty = true; drawSchedule(c, ro); };
  box.querySelectorAll('tr[data-k]').forEach(tr => tr.querySelectorAll('[data-s]').forEach(el => el[el.tagName === 'SELECT' || el.type === 'date' || el.type === 'number' ? 'onchange' : 'oninput'] = () => {
    const it = items[+tr.dataset.k], f = el.dataset.s; it[f] = f === 'value' ? +el.value : el.value; invDirty = true; if (f !== 'label') drawSchedule(c, ro);
  }));
  if (ro) box.querySelectorAll('input,select').forEach(el => el.disabled = true);
}
function drawLines(c, ro) {
  const i = INV, taxes = INVSET.taxes || [];
  const tb = $('[data-lines]', c); const calc = calcInvoice(i, taxes);
  tb.innerHTML = i.items.map((it, k) => `<tr data-k="${k}"><td><input class="input" data-l="name" list="itemlist" value="${esc(it.name)}" placeholder="Product or service"><textarea class="input desc" rows="1" data-l="description" placeholder="Description (optional)">${esc(it.description || '')}</textarea></td>
    <td class="num"><input class="input n" type="number" step="any" min="0" data-l="qty" value="${esc(it.qty)}"></td><td class="num"><input class="input n" type="number" step="0.01" data-l="price" value="${esc(it.price)}"></td>
    <td><div class="taxchips">${taxes.map(t => `<button type="button" data-tax="${esc(t.id)}" class="${(it.taxes || []).includes(t.id) ? 'on' : ''}">${esc(t.name)} ${esc(t.rate)}%</button>`).join('') || '<small>No taxes</small>'}</div></td>
    <td class="num"><b data-lt>${money(calc.lines[k])}</b></td><td>${ro || i.items.length < 2 ? '' : '<button type="button" class="x sm" data-rm aria-label="Remove line">×</button>'}</td></tr>`).join('');
  tb.querySelectorAll('tr').forEach(tr => {
    const it = i.items[+tr.dataset.k];
    tr.querySelectorAll('[data-l]').forEach(el => el.oninput = () => {
      const f = el.dataset.l; it[f] = f === 'qty' || f === 'price' ? el.value : el.value; invDirty = true;
      if (f === 'name') { const m = INVLOOK.items.find(x => x.name === el.value); if (m && !+it.price) { it.description = m.description; it.price = m.price / 100; it.taxes = m.taxes.length ? m.taxes : it.taxes; drawLines(c, ro); drawTotals(c, ro); return; } }
      tr.querySelector('[data-lt]').textContent = money(calcInvoice(i, taxes).lines[+tr.dataset.k]); drawTotals(c, ro);
    });
    tr.querySelectorAll('[data-tax]').forEach(bt => bt.onclick = () => { const t = bt.dataset.tax; it.taxes = (it.taxes || []).includes(t) ? it.taxes.filter(x => x !== t) : [...(it.taxes || []), t]; bt.classList.toggle('on'); invDirty = true; drawTotals(c, ro); });
    const rm = tr.querySelector('[data-rm]'); if (rm) rm.onclick = () => { i.items.splice(+tr.dataset.k, 1); invDirty = true; drawLines(c, ro); drawTotals(c, ro); };
  });
}
function drawTotals(c, ro) {
  const i = INV, k = calcInvoice(i, INVSET.taxes || []);
  const paid = i.paid || 0, bal = Math.max(0, k.total - paid);
  const dep = i.deposit?.items?.length ? planAmounts(i.deposit, k.total)[0] : 0;
  const box = $('[data-totals]', c);
  box.innerHTML = `<div class="tl"><span>Subtotal</span><b>${money(k.subtotal)}</b></div>
    <div class="tl"><span>${i.discount?.type ? `Discount <select class="input xs" data-dt><option value="percent" ${i.discount.type === 'percent' ? 'selected' : ''}>%</option><option value="amount" ${i.discount.type === 'amount' ? 'selected' : ''}>CA$</option></select><input class="input xs" type="number" step="0.01" min="0" data-dv value="${esc(i.discount.value)}"> <button type="button" class="linkbtn" data-dx>Remove</button>` : ro ? 'Discount' : '<button type="button" class="linkbtn" data-dadd>+ Add discount</button>'}</span><b>${k.disc ? '−' + money(k.disc) : ''}</b></div>
    ${k.taxes.map(t => `<div class="tl sub"><span>${esc(t.name)} (${esc(t.rate)}%)</span><b>${money(t.amount)}</b></div>`).join('')}
    <div class="tl"><span>Tax total</span><b>${money(k.tax)}</b></div>
    <div class="tl grand"><span>Invoice total</span><b>${money(k.total)}</b></div>
    <div class="tl"><span>${dep ? `Due first (${esc(i.deposit.items[0].label || 'Deposit')})` : ro ? '' : '<button type="button" class="linkbtn" data-padd>+ Request deposit / instalments</button>'}</span><b>${dep ? money(dep) : ''}</b></div>
    <div class="tl"><span>Amount paid</span><b>${money(paid)}</b></div>${i.refunded ? `<div class="tl sub"><span>Refunded</span><b>${money(i.refunded)}</b></div>` : ''}
    <div class="tl bal"><span>Balance due</span><b>${['refunded', 'void'].includes(i.status) ? '—' : money(bal)}</b></div>`;
  const on = (sel, ev, fn) => { const el = $(sel, box); if (el) el[ev] = fn; };
  on('[data-dadd]', 'onclick', () => { i.discount = { type: 'percent', value: 10 }; invDirty = true; drawTotals(c, ro); });
  on('[data-dx]', 'onclick', () => { i.discount = {}; invDirty = true; drawTotals(c, ro); });
  on('[data-dt]', 'onchange', e => { i.discount.type = e.target.value; invDirty = true; drawTotals(c, ro); });
  on('[data-dv]', 'onchange', e => { i.discount.value = +e.target.value; invDirty = true; drawTotals(c, ro); });
  on('[data-padd]', 'onclick', () => { i.deposit = planResize({}, 2); invDirty = true; drawTotals(c, ro); $('[data-sched]', c)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  drawSchedule(c, ro);
}
async function saveInvoice(c, extra = {}) {
  const i = INV;
  const btn = $('[data-save]'); if (btn) btn.disabled = true;
  try {
    const r = await api('/invoices/save', { id: i.id || '', customerId: i.customerId || null, customer: i.customer, title: i.title, issueDate: i.issueDate, dueDate: i.dueDate, salesRep: i.salesRep, items: i.items, discount: i.discount, deposit: i.deposit, notes: i.notes, terms: i.terms, requestId: i.requestId || null, ...extra });
    const isNew = !i.id;
    INV.publicUrl = r.publicUrl; setInv(r.invoice);
    if (isNew) history.replaceState(null, '', '#/invoices/edit?id=' + r.invoice.id);
    drawInvoice(c);
    return true;
  } catch (e) { toast(e.message); return false; }
  finally { if (btn) btn.disabled = false; }
}
function sendInvoiceModal(c) {
  const i = INV, s = INVSET;
  const o = modal(`<header><h2>Send invoice</h2><button class="x" data-close>×</button></header><div data-msg></div>
    <label class="field"><span>To</span><input name="to" type="email" value="${esc(i.customer?.email || '')}" required></label>
    <label class="field"><span>Message</span><textarea name="message" rows="7">${esc(s.emailMessage || '')}</textarea><div class="hint">{name}, {number}, {total} and {due} are filled in automatically. A link to view and print the invoice is added at the end.</div></label>
    <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-go>Send invoice</button></div>`);
  $('[data-go]', o).onclick = async e => {
    e.target.disabled = true;
    try {
      if (!(await saveInvoice(c))) { e.target.disabled = false; return; }
      const r = await api('/invoices/send', { id: INV.id, to: $('[name=to]', o).value, message: $('[name=message]', o).value });
      setInv(r.invoice); drawInvoice(c);
      o.querySelector('.modal').innerHTML = `<header><h2>${r.emailed ? 'Invoice sent' : 'Invoice ready'}</h2><button class="x" data-close>×</button></header><p style="color:var(--mut)">${r.emailed ? 'We emailed the invoice. You can also copy the link and send it by text message:' : 'The email could not be sent from the server. Copy the link and send it to the customer:'}</p><div class="copy"><input class="input" readonly value="${esc(INV.publicUrl)}"><button class="btn" data-copy>Copy</button></div>`;
      $('[data-copy]', o).onclick = () => { navigator.clipboard.writeText(INV.publicUrl); toast('Link copied'); };
    } catch (er) { $('[data-msg]', o).innerHTML = `<div class="err">${esc(er.message)}</div>`; e.target.disabled = false; }
  };
}
function paymentModal(c) {
  const i = INV; const k = calcInvoice(i, INVSET.taxes || []); const bal = Math.max(0, k.total - (i.paid || 0));
  const o = modal(`<header><h2>Record payment</h2><button class="x" data-close>×</button></header><div data-msg></div>
    <p style="margin-top:0;color:var(--mut)">Balance due: <b>${money(bal)}</b></p>
    <div class="grid g2"><label class="field"><span>Amount (CA$)</span><input name="amount" type="number" step="0.01" min="0.01" value="${(bal / 100).toFixed(2)}"></label><label class="field"><span>Date</span><input name="date" type="date" value="${todayISO()}"></label></div>
    <label class="field"><span>Payment method</span><select name="method">${Object.entries(INVMETHODS).map(([k2, v]) => `<option value="${k2}">${esc(v)}</option>`).join('')}</select></label>
    <label class="field"><span>Note (optional)</span><input name="note" placeholder="e.g. e-Transfer reference"></label>
    <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-go>Record payment</button></div>`);
  $('[data-go]', o).onclick = async e => {
    e.target.disabled = true;
    try {
      if (invDirty && !(await saveInvoice(c))) { e.target.disabled = false; return; }
      const r = await api('/invoices/payment', { id: INV.id, amount: $('[name=amount]', o).value, date: $('[name=date]', o).value, method: $('[name=method]', o).value, note: $('[name=note]', o).value });
      o.remove(); setInv(r.invoice); drawInvoice(c); toast('Payment recorded');
    } catch (er) { $('[data-msg]', o).innerHTML = `<div class="err">${esc(er.message)}</div>`; e.target.disabled = false; }
  };
}

function refundModal(c, p) {
  if (!p) return;
  const left = p.amount - (p.refunded || 0), prov = p.provider === 'paypal' ? 'PayPal' : 'Square';
  const o = modal(`<header><h2>Refund payment</h2><button class="x" data-close>×</button></header><div data-msg></div>
    <p style="margin-top:0;color:var(--mut)">${esc(dlong(p.date))} · ${esc(p.methodName)} · ${money(p.amount)}${p.refunded ? ` (${money(p.refunded)} already refunded)` : ''}</p>
    <div class="grid g2"><label class="field"><span>Refund amount (CA$)</span><input name="amount" type="number" step="0.01" min="0.01" max="${(left / 100).toFixed(2)}" value="${(left / 100).toFixed(2)}"></label><label class="field"><span>Date</span><input name="date" type="date" value="${todayISO()}"></label></div>
    ${p.online ? `<label class="check"><input type="checkbox" name="online" checked> Send the refund through ${prov} now (the money goes back to the customer's ${p.provider === 'paypal' ? 'PayPal account' : 'card'})</label><p class="hint">Untick if you already refunded it in the ${prov} dashboard and only want to record it here.</p>` : '<p class="hint">This records a refund you gave by e-Transfer, cash, cheque or another way. No money is moved by the website.</p>'}
    <label class="field"><span>Reason / note (optional)</span><input name="note" maxlength="200" placeholder="e.g. Job cancelled"></label>
    <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" data-go>Refund</button></div>`);
  $('[data-go]', o).onclick = async e => {
    e.target.disabled = true;
    try {
      const r = await api('/invoices/refund', { id: INV.id, paymentId: p.id, amount: $('[name=amount]', o).value, date: $('[name=date]', o).value, note: $('[name=note]', o).value, online: !!$('[name=online]', o)?.checked });
      o.remove(); setInv(r.invoice); drawInvoice(c); toast('Refund recorded');
    } catch (er) { $('[data-msg]', o).innerHTML = `<div class="err">${esc(er.message)}</div>`; e.target.disabled = false; }
  };
}

/* ---------- customers ---------- */
async function viewCustomers() {
  const c = shell('Customers', 'Business', '<div class="card empty">Loading…</div>', '/customers');
  $('[data-actions]').innerHTML = `<div class="cust-acts">${can('invoices.edit') ? '<button class="btn ghost sm" data-imp>⬆ Import CSV</button>' : ''}<button class="btn ghost sm" data-exp>⬇ Export CSV</button>${can('invoices.edit') ? '<button class="btn sm" data-newc>+ Add customer</button>' : ''}</div>`;
  const [d, web] = await Promise.all([api('/customers'), api('/customer-accounts/map').catch(() => ({ accounts: {} }))]); // web: website accounts by email (customer-login.js)
  const webPill = x => { const a = x.email && web.accounts[String(x.email).toLowerCase()]; return a ? ` <span class="pill ${a.verified ? 'confirmed' : ''}" title="Website account · sign-in: ${esc(a.methods.join(', ') || '—')}${a.verified ? '' : ' · email not confirmed'}">Web account · ${esc(a.methods.map(m => m[0].toUpperCase() + m.slice(1)).join(' / ') || '—')}</span>` : ''; };
  c.innerHTML = `<div class="toolbar"><input class="input" data-q placeholder="Search name, company, email, phone, notes"><span class="cust-count" data-count></span></div><div data-list></div>`;
  let rows = d.customers;
  const draw = () => {
    const t = $('[data-q]', c).value.trim().toLowerCase();
    rows = d.customers.filter(x => !t || [x.name, x.company, x.email, x.phone, x.address, x.notes].join(' ').toLowerCase().includes(t));
    $('[data-count]', c).textContent = `${rows.length} of ${d.customers.length}`;
    $('[data-list]', c).innerHTML = rows.length ? `<table class="table"><thead><tr><th>Customer</th><th>Phone</th><th class="num">Invoices</th><th class="num">Billed</th><th class="num">Balance</th><th></th></tr></thead><tbody>${rows.slice(0, 500).map(x => `<tr><td><b>${esc(x.name)}</b>${webPill(x)}<small>${esc([x.company, x.email].filter(Boolean).join(' · '))}</small></td><td>${esc(x.phone)}</td><td class="num">${x.invoices}</td><td class="num">${money(x.billed)}</td><td class="num">${x.balance ? `<b class="warn-t">${money(x.balance)}</b>` : '—'}</td>
      <td style="text-align:right;white-space:nowrap">${can('invoices.edit') ? `<button class="btn ghost sm" data-edc="${esc(x.id)}">Edit</button> <a class="btn sm" href="#/invoices/edit?customer=${esc(x.id)}">Invoice</a>` : ''}</td></tr>`).join('')}</tbody></table>${rows.length > 500 ? '<p class="hint">Showing the first 500 — search to narrow the list. Export includes every match.</p>' : ''}` : `<div class="card empty">${d.customers.length ? 'No customers match.' : 'No customers yet. Add one, import a CSV file, or create an invoice.'}</div>`;
    c.querySelectorAll('[data-edc]').forEach(b => b.onclick = () => customerModal(d.customers.find(x => x.id === b.dataset.edc)));
  };
  $('[data-q]', c).oninput = draw; draw();
  const nc = $('[data-newc]'); if (nc) nc.onclick = () => customerModal(null);
  $('[data-exp]').onclick = () => exportCustomers(rows, rows.length !== d.customers.length);
  const ib = $('[data-imp]'); if (ib) ib.onclick = () => importCustomers();
}
/* onSaved(customer): used by the invoice picker — called with the saved customer instead of reloading the Customers page */
function customerModal(x, onSaved) {
  x = { id: '', name: '', company: '', email: '', phone: '', address: '', notes: '', ...(x || {}) };
  const o = modal(`<header><h2>${x.id ? 'Edit customer' : 'New customer'}</h2><button class="x" data-close>×</button></header><div data-msg></div><form data-f>
    <label class="field"><span>Name *</span><input name="name" value="${esc(x.name)}" required></label><label class="field"><span>Company</span><input name="company" value="${esc(x.company)}"></label>
    <div class="grid g2"><label class="field"><span>Email</span><input name="email" type="email" value="${esc(x.email)}"></label><label class="field"><span>Phone</span><input name="phone" value="${esc(x.phone)}"></label></div>
    <label class="field"><span>Billing address</span><textarea name="address" rows="3">${esc(x.address)}</textarea></label>
    <label class="field"><span>Notes (internal)</span><textarea name="notes" rows="3">${esc(x.notes || '')}</textarea></label><button class="btn block" type="submit">Save customer</button></form>`);
  const f = $('[data-f]', o);
  if (onSaved && !x.id) setTimeout(() => (x.name ? f.company : f.name).focus(), 60);
  f.onsubmit = async e => { e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    const v = { id: x.id, name: f.name.value.trim(), company: f.company.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim(), notes: f.notes.value };
    const dup = onSaved && !x.id && v.email && INVLOOK && INVLOOK.customers.find(c => (c.email || '').toLowerCase() === v.email.toLowerCase());
    if (dup) { $('[data-msg]', o).innerHTML = `<div class="err">${esc(dup.name)} already uses this email. Close this form and pick them from the list.</div>`; return; }
    btn.disabled = true;
    try { const r = await api('/customers/save', v); o.remove(); toast('Customer saved');
      if (onSaved) onSaved(r.customer || { ...v, id: r.id }); else viewCustomers(); }
    catch (er) { $('[data-msg]', o).innerHTML = `<div class="err">${esc(er.message)}</div>`; btn.disabled = false; } };
}

/* CSV helpers */
const CUST_FIELDS = [['name', 'Name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['notes', 'Notes']];
const CUST_ALIASES = {
  name: ['name', 'full name', 'fullname', 'customer', 'customer name', 'client', 'client name', 'contact', 'contact name', 'display name', 'نام', 'نام مشتری', 'مشتری', 'نام و نام خانوادگی'],
  first: ['first name', 'firstname', 'first', 'given name', 'نام کوچک'], last: ['last name', 'lastname', 'last', 'surname', 'family name', 'نام خانوادگی'],
  company: ['company', 'company name', 'business', 'business name', 'organization', 'organisation', 'شرکت', 'نام شرکت'],
  email: ['email', 'e-mail', 'email address', 'mail', 'ایمیل', 'پست الکترونیک'],
  phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'cell', 'mobile phone', 'phone 1 - value', 'تلفن', 'موبایل', 'شماره تلفن', 'شماره'],
  address: ['address', 'billing address', 'street', 'street address', 'full address', 'آدرس', 'نشانی'],
  city: ['city', 'شهر'], province: ['province', 'state', 'region', 'استان'], postal: ['postal code', 'postcode', 'zip', 'zip code', 'کد پستی'], country: ['country', 'کشور'],
  notes: ['notes', 'note', 'comments', 'comment', 'description', 'یادداشت', 'توضیحات']
};
function csvParse(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const count = ch => (first.match(new RegExp('\\' + ch, 'g')) || []).length;
  const delim = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"' && f === '') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}
function csvCell(v) { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function downloadCSV(name, rows) {
  const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportCustomers(rows, filtered) {
  if (!rows.length) return toast('No customers to export');
  const day = new Date().toISOString().slice(0, 10);
  downloadCSV(`customers-${day}${filtered ? '-filtered' : ''}.csv`, [['Name', 'Company', 'Email', 'Phone', 'Address', 'Notes', 'Invoices', 'Billed', 'Balance', 'Last invoice', 'Customer since'],
    ...rows.map(x => [x.name, x.company, x.email, x.phone, x.address, x.notes || '', x.invoices, (x.billed / 100).toFixed(2), (x.balance / 100).toFixed(2), x.last || '', (x.created || '').slice(0, 10)])]);
  toast(`Exported ${rows.length} customer${rows.length === 1 ? '' : 's'}`);
}
function importCustomers() {
  const o = modal(`<header><h2>Import customers</h2><button class="x" data-close>×</button></header><div data-body>
    <p style="color:var(--mut);margin-top:0">Upload a CSV file (from Excel, Google Sheets, Wix, QuickBooks, Gmail contacts…). You can match the columns on the next step.</p>
    <label class="dropcsv" data-drop><input type="file" accept=".csv,.tsv,.txt,text/csv" hidden data-file><b>Choose a CSV file</b><span>or drop it here</span></label>
    <p class="hint">Need a starting point? <a href="#" data-tpl>Download the template</a>. Excel: <i>File → Save As → CSV UTF-8</i>.</p></div>`);
  o.querySelector('.modal').classList.add('wide');
  $('[data-tpl]', o).onclick = e => { e.preventDefault(); downloadCSV('customers-template.csv', [CUST_FIELDS.map(f => f[1]), ['Jane Doe', 'Doe Logistics', 'jane@example.com', '+1 905 555 0100', '50 Main St, Vaughan, ON L4K 1A1', 'Fleet of 4 vans']]); };
  const fi = $('[data-file]', o), dz = $('[data-drop]', o);
  const read = file => {
    if (!file) return;
    if (file.size > 3e6) return toast('The file is larger than 3 MB — split it into smaller files.');
    const fr = new FileReader();
    fr.onload = () => { let t = String(fr.result); if (t.includes('�')) { const f2 = new FileReader(); f2.onload = () => mapStep(String(f2.result), file.name); f2.readAsText(file, 'windows-1252'); return; } mapStep(t, file.name); };
    fr.readAsText(file, 'utf-8');
  };
  fi.onchange = () => read(fi.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = () => dz.classList.remove('on');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('on'); read(e.dataTransfer.files[0]); };
  const body = $('[data-body]', o);
  function mapStep(text, fname) {
    const all = csvParse(text);
    if (all.length < 2) { toast('No rows found in this file'); return; }
    const head = all[0].map(h => h.trim()), data = all.slice(1);
    const norm = h => h.toLowerCase().replace(/[_*]+/g, ' ').replace(/\s+/g, ' ').trim();
    const guess = {};
    head.forEach((h, i) => { const n = norm(h); for (const [k, al] of Object.entries(CUST_ALIASES)) if (guess[k] === undefined && al.includes(n)) { guess[k] = i; break; } });
    if (guess.name === undefined) head.forEach((h, i) => { if (guess.name === undefined && /name|نام/.test(norm(h)) && !Object.values(guess).includes(i)) guess.name = i; });
    if (guess.email === undefined) head.forEach((h, i) => { if (guess.email === undefined && /mail/.test(norm(h))) guess.email = i; });
    if (guess.phone === undefined) head.forEach((h, i) => { if (guess.phone === undefined && /phone|mobile|tel/.test(norm(h))) guess.phone = i; });
    const MAP = [['name', 'Name *'], ['first', 'First name'], ['last', 'Last name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City'], ['province', 'Province'], ['postal', 'Postal code'], ['country', 'Country'], ['notes', 'Notes']];
    const opts = sel => `<option value="">— skip —</option>${head.map((h, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('')}`;
    body.innerHTML = `<p style="margin-top:0"><b>${esc(fname)}</b> — ${data.length} row${data.length === 1 ? '' : 's'}, ${head.length} columns. Match each field to a column:</p>
      <div class="mapgrid">${MAP.filter(([k]) => guess[k] !== undefined || ['name', 'company', 'email', 'phone', 'address', 'notes'].includes(k)).map(([k, l]) => `<label class="field"><span>${l}</span><select data-map="${k}">${opts(guess[k])}</select></label>`).join('')}
      <details class="morecols"><summary>More fields</summary><div class="mapgrid">${MAP.filter(([k]) => !(guess[k] !== undefined || ['name', 'company', 'email', 'phone', 'address', 'notes'].includes(k))).map(([k, l]) => `<label class="field"><span>${l}</span><select data-map="${k}">${opts(guess[k])}</select></label>`).join('')}</div></details></div>
      <label class="field"><span>When a customer already exists (same email, phone or name)</span><select data-mode><option value="update">Update it with the values from the file</option><option value="fill">Only fill in empty fields</option><option value="skip">Skip it — import new customers only</option></select></label>
      <div class="field"><span>Preview</span><div class="prevwrap" data-prev></div></div>
      <div data-msg></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn ghost" data-back>Back</button><button class="btn ghost" data-check>Check file</button><button class="btn" data-go>Import customers</button></div>`;
    const getMap = () => { const m = {}; body.querySelectorAll('[data-map]').forEach(s => { if (s.value !== '') m[s.dataset.map] = +s.value; }); return m; };
    const build = () => {
      const m = getMap(), g = (r, k) => m[k] === undefined ? '' : (r[m[k]] || '').trim();
      return data.map((r, i) => {
        let name = g(r, 'name'); if (!name) name = [g(r, 'first'), g(r, 'last')].filter(Boolean).join(' ');
        const addr = [g(r, 'address'), [g(r, 'city'), [g(r, 'province'), g(r, 'postal')].filter(Boolean).join(' ')].filter(Boolean).join(', '), g(r, 'country')].filter(Boolean).join('\n');
        return { _line: i + 2, name, company: g(r, 'company'), email: g(r, 'email').replace(/^mailto:/i, ''), phone: g(r, 'phone'), address: addr, notes: g(r, 'notes') };
      });
    };
    const prev = () => {
      const rs = build().slice(0, 5);
      $('[data-prev]', body).innerHTML = `<table class="table mini"><thead><tr>${CUST_FIELDS.map(f => `<th>${f[1]}</th>`).join('')}</tr></thead><tbody>${rs.map(r => `<tr>${CUST_FIELDS.map(f => `<td>${esc(r[f[0]]) || '<span class="mut">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table>${data.length > 5 ? `<p class="hint">…and ${data.length - 5} more</p>` : ''}`;
    };
    body.querySelectorAll('[data-map]').forEach(s => s.onchange = prev); prev();
    $('[data-back]', body).onclick = () => { o.remove(); importCustomers(); };
    const run = async dry => {
      const msg = $('[data-msg]', body); const rows = build();
      if (!rows.some(r => r.name || r.email || r.company)) { msg.innerHTML = '<div class="err">Choose which column holds the customer name.</div>'; return; }
      msg.innerHTML = `<div class="hint">${dry ? 'Checking' : 'Importing'} ${rows.length} rows…</div>`;
      body.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        const r = await api('/customers/import', { rows, mode: $('[data-mode]', body).value, dryRun: dry });
        const errs = r.errors.length ? `<details class="imperr"><summary>${r.errors.length} row${r.errors.length === 1 ? '' : 's'} with problems</summary><ul>${r.errors.map(e => `<li>Line ${e.line}: ${esc(e.error)}</li>`).join('')}</ul></details>` : '';
        msg.innerHTML = `<div class="${dry ? 'note' : 'ok'}">${dry ? 'Check only — nothing saved yet. ' : ''}<b>${r.created}</b> new · <b>${r.updated}</b> updated · <b>${r.skipped}</b> unchanged/skipped${r.errors.length ? ` · <b>${r.errors.length}</b> errors` : ''}</div>${errs}`;
        if (!dry) { toast(`Imported: ${r.created} new, ${r.updated} updated`); $('[data-go]', body).textContent = 'Done'; $('[data-go]', body).disabled = false; $('[data-go]', body).onclick = () => { o.remove(); viewCustomers(); }; return; }
      } catch (er) { msg.innerHTML = `<div class="err">${esc(er.message)}</div>`; }
      body.querySelectorAll('button').forEach(b => b.disabled = false);
    };
    $('[data-check]', body).onclick = () => run(true);
    $('[data-go]', body).onclick = () => run(false);
  }
}

/* ---------- invoice settings ---------- */
async function viewInvoiceSettings() {
  const c = shell('Invoice settings', 'Business · Invoices', '<div class="card empty">Loading…</div>', '/invoices');
  const { settings: s } = await api('/invoices/settings');
  const b = s.business;
  c.innerHTML = `<form data-f><div class="grid g2"><div class="card"><h2>Business info on invoices</h2>
      <label class="field"><span>Business name</span><input name="b_name" value="${esc(b.name)}"></label><label class="field"><span>Address</span><textarea name="b_address" rows="3">${esc(b.address)}</textarea></label>
      <div class="grid g2"><label class="field"><span>Email</span><input name="b_email" value="${esc(b.email)}"></label><label class="field"><span>Phone</span><input name="b_phone" value="${esc(b.phone)}"></label></div>
      <label class="field"><span>Tax number</span><input name="b_taxNumber" value="${esc(b.taxNumber)}" placeholder="HST/GST# …"></label>
      <div class="grid g2"><label class="field"><span>Logo link</span><input name="b_logo" value="${esc(b.logo)}"></label><label class="field"><span>Website</span><input name="b_website" value="${esc(b.website)}"></label></div></div>
    <div class="card"><h2>Numbering & due dates</h2><div class="grid g2"><label class="field"><span>Prefix</span><input name="prefix" value="${esc(s.prefix)}" placeholder="optional, e.g. SG-"></label><label class="field"><span>Next invoice number</span><input name="nextNumber" type="number" min="1" value="${esc(s.nextNumber)}"></label></div>
      <div class="grid g2"><label class="field"><span>Digits</span><input name="pad" type="number" min="1" max="10" value="${esc(s.pad)}"></label><label class="field"><span>Default days until due</span><input name="dueDays" type="number" min="0" max="365" value="${esc(s.dueDays)}"></label></div>
      <p class="hint">Next invoice: <b data-preview></b>. It continues after your last Wix invoice (0013460).</p>
      <h2 style="margin-top:20px">Taxes</h2><div data-taxes></div><button type="button" class="btn ghost sm" data-addtax>+ Add tax</button></div></div>
    <div class="card" style="margin-top:18px"><h2>Default text</h2><div class="grid g2"><label class="field"><span>Notes</span><textarea name="notes" rows="4">${esc(s.notes)}</textarea></label><label class="field"><span>Terms</span><textarea name="terms" rows="4">${esc(s.terms)}</textarea></label></div>
      <label class="field"><span>Email message</span><textarea name="emailMessage" rows="6">${esc(s.emailMessage)}</textarea><div class="hint">{name}, {number}, {total} and {due} are filled in automatically.</div></label>
      <button class="btn" type="submit">Save settings</button></div></form>`;
  const f = $('[data-f]', c);
  let taxes = s.taxes.map(t => ({ ...t, def: (s.defaultTaxes || []).includes(t.id) }));
  const drawTaxes = () => { $('[data-taxes]', c).innerHTML = taxes.map((t, k) => `<div class="taxrow" data-k="${k}"><input class="input" data-t="name" value="${esc(t.name)}" placeholder="Name"><input class="input" type="number" step="0.001" data-t="rate" value="${esc(t.rate)}" placeholder="%"><label><input type="checkbox" data-t="def" ${t.def ? 'checked' : ''}> Default</label><button type="button" class="x sm" data-rm>×</button></div>`).join('');
    c.querySelectorAll('.taxrow').forEach(r => { const t = taxes[+r.dataset.k]; r.querySelectorAll('[data-t]').forEach(el => el.oninput = () => { t[el.dataset.t] = el.type === 'checkbox' ? el.checked : el.value; }); r.querySelector('[data-rm]').onclick = () => { taxes.splice(+r.dataset.k, 1); drawTaxes(); }; }); };
  drawTaxes();
  $('[data-addtax]', c).onclick = () => { taxes.push({ id: '', name: '', rate: '', def: false }); drawTaxes(); };
  const prev = () => { $('[data-preview]', c).textContent = f.prefix.value + String(f.nextNumber.value).padStart(+f.pad.value || 1, '0'); };
  ['prefix', 'nextNumber', 'pad'].forEach(n => f[n].oninput = prev); prev();
  f.onsubmit = async e => {
    e.preventDefault();
    const v = n => f[n].value;
    try {
      taxes = taxes.map(t => ({ ...t, id: t.id || (String(t.name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) + Math.random().toString(36).slice(2, 6)) }));
      await api('/invoices/settings', { settings: { business: { name: v('b_name'), address: v('b_address'), email: v('b_email'), phone: v('b_phone'), taxNumber: v('b_taxNumber'), logo: v('b_logo'), website: v('b_website') }, prefix: v('prefix'), nextNumber: +v('nextNumber'), pad: +v('pad'), dueDays: +v('dueDays'),
        taxes: taxes.map(t => ({ id: t.id, name: t.name, rate: t.rate })), defaultTaxes: taxes.filter(t => t.def).map(t => t.id), notes: v('notes'), terms: v('terms'), emailMessage: v('emailMessage') } });
      toast('Settings saved'); viewInvoiceSettings();
    } catch (er) { toast(er.message); }
  };
}


/* ---------- business info (structured data on every page) ---------- */
async function viewBusiness() {
  const c = shell('Business info & SEO', 'Website', '<div class="card empty">Loading…</div>', '/business');
  const { business: b } = await api('/site/business');
  const wk = (b.hours || []).find(h => h.days.includes('Monday')) || { opens: '08:00', closes: '18:00' };
  const sat = (b.hours || []).find(h => h.days.includes('Saturday'));
  c.innerHTML = `<form data-f><div class="grid g2"><div class="card"><h2>Name, address, phone</h2><p class="hint" style="margin-top:0">Google and AI assistants match these details with your Google Business Profile, so keep them exactly the same everywhere.</p>
    <div class="grid g2"><label class="field"><span>Business name</span><input name="name" value="${esc(b.name)}"></label><label class="field"><span>Legal name</span><input name="legalName" value="${esc(b.legalName)}"></label></div>
    <label class="field"><span>Street address</span><input name="street" value="${esc(b.street)}"></label>
    <div class="grid g2"><label class="field"><span>City</span><input name="city" value="${esc(b.city)}"></label><label class="field"><span>Province</span><input name="region" value="${esc(b.region)}"></label></div>
    <div class="grid g2"><label class="field"><span>Postal code</span><input name="postal" value="${esc(b.postal)}" placeholder="e.g. L4K …"></label><label class="field"><span>Price range</span><input name="priceRange" value="${esc(b.priceRange)}"></label></div>
    <div class="grid g2"><label class="field"><span>Phone</span><input name="phone" value="${esc(b.phone)}"></label><label class="field"><span>Email</span><input name="email" value="${esc(b.email)}"></label></div>
    <div class="grid g2"><label class="field"><span>Latitude (optional)</span><input name="lat" value="${esc(b.lat)}"></label><label class="field"><span>Longitude (optional)</span><input name="lng" value="${esc(b.lng)}"></label></div></div>
    <div class="card"><h2>Hours</h2><div class="grid g2"><label class="field"><span>Mon–Fri opens</span><input type="time" name="wo" value="${esc(wk.opens)}"></label><label class="field"><span>Mon–Fri closes</span><input type="time" name="wc" value="${esc(wk.closes)}"></label></div>
      <label class="field" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sat" ${sat ? 'checked' : ''} style="width:auto"> Open on Saturday</label>
      <div class="grid g2"><label class="field"><span>Saturday opens</span><input type="time" name="so" value="${esc(sat?.opens || '10:00')}"></label><label class="field"><span>Saturday closes</span><input type="time" name="sc" value="${esc(sat?.closes || '15:00')}"></label></div>
      <h2 style="margin-top:18px">Profiles & areas</h2><label class="field"><span>Social & directory links (one per line)</span><textarea name="sameAs" rows="4">${esc((b.sameAs || []).join('\n'))}</textarea><div class="hint">Google Business Profile, Facebook, Instagram, Yelp, LinkedIn…</div></label>
      <label class="field"><span>Areas served (comma separated)</span><input name="areaServed" value="${esc((b.areaServed || []).join(', '))}"></label>
      <button class="btn" type="submit">Save & update all pages</button><p class="hint">Updates the structured data (schema.org) on every page of the website.</p></div></div></form><div data-seo-tools style="margin-top:18px"></div><div class="card" style="margin-top:18px"><h2>External images</h2><p class="hint" style="margin-top:0">Supplier and review photos are served from this website, not from other sites. After a website update, copy the new ones to the server in advance.</p><a class="btn ghost sm" href="/admin/ext-images.html">Copy external images</a></div>`;
  viewSeoTools($('[data-seo-tools]', c));
  const f = $('[data-f]', c);
  f.onsubmit = async e => {
    e.preventDefault(); const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Updating pages…';
    const v = n => f[n].value.trim();
    const hours = [{ days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: v('wo'), closes: v('wc') }];
    if (f.sat.checked) hours.push({ days: ['Saturday'], opens: v('so'), closes: v('sc') });
    try {
      const r = await api('/site/business', { business: { name: v('name'), legalName: v('legalName'), street: v('street'), city: v('city'), region: v('region'), postal: v('postal'), priceRange: v('priceRange'), phone: v('phone'), email: v('email'), lat: v('lat'), lng: v('lng'), hours, sameAs: v('sameAs').split(/\s+/).filter(Boolean), areaServed: v('areaServed').split(',').map(x => x.trim()).filter(Boolean) } });
      toast(`Saved — ${r.updated} pages updated`);
    } catch (er) { toast(er.message); }
    btn.disabled = false; btn.textContent = 'Save & update all pages';
  };
}

/* ---------- search & analytics tools (Search Console, Bing, GA4/GTM, IndexNow) ---------- */
async function viewSeoTools(box) {
  let d; try { d = await api('/site/seo-tools'); } catch (e) { box.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  const t = d.tools;
  box.innerHTML = `<form data-t><div class="grid g2"><div class="card"><h2>Search engines</h2><p class="hint" style="margin-top:0">Paste the verification code (or the whole &lt;meta&gt; tag) from each tool. Domain verification by DNS in Search Console also works and survives every website update.</p>
      <label class="field"><span>Google Search Console — HTML tag</span><input name="googleVerify" value="${esc(t.googleVerify)}" placeholder='<meta name="google-site-verification" content="…">'></label>
      <label class="field"><span>Bing Webmaster Tools — msvalidate.01</span><input name="bingVerify" value="${esc(t.bingVerify)}" placeholder="32-character code"></label>
      <label class="field"><span>IndexNow key</span><div style="display:flex;gap:8px"><input name="indexNowKey" value="${esc(t.indexNowKey)}" placeholder="Generate a key" readonly><button type="button" class="btn ghost sm" data-gen>Generate</button></div><div class="hint">IndexNow tells Bing and other engines about new and changed pages. After saving, the key file is at <span class="mono">/${esc(t.indexNowKey || '…')}.txt</span>.</div></label>
      <button type="button" class="btn ghost sm" data-ping ${t.indexNowKey ? '' : 'disabled'}>Submit sitemap to IndexNow</button></div>
    <div class="card"><h2>Analytics</h2><p class="hint" style="margin-top:0">Google Analytics and Tag Manager load only for visitors who click “Allow” in the site’s analytics banner, with advertising storage turned off.</p>
      <label class="field"><span>Google Analytics 4 measurement ID</span><input name="ga4" value="${esc(t.ga4)}" placeholder="G-XXXXXXXXXX"></label>
      <label class="field"><span>Google Tag Manager container (optional)</span><input name="gtm" value="${esc(t.gtm)}" placeholder="GTM-XXXXXXX"></label>
      <p class="hint">${d.pagesMissing ? `<b>${d.pagesMissing} pages</b> don’t have the current settings yet (for example after a website update) — press Save to apply them.` : 'All pages are up to date.'}</p>
      <button class="btn" type="submit">Save & apply to all pages</button></div></div></form>`;
  const f = $('[data-t]', box);
  $('[data-gen]', box).onclick = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); f.indexNowKey.value = [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
  $('[data-ping]', box).onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await api('/site/indexnow', {}); toast(r.ok ? `Submitted ${r.submitted} pages to IndexNow` : `IndexNow answered HTTP ${r.status}`); } catch (er) { toast(er.message); }
    b.disabled = false;
  };
  f.onsubmit = async e => {
    e.preventDefault(); const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Updating pages…';
    const v = n => f[n].value.trim();
    try { const r = await api('/site/seo-tools', { tools: { googleVerify: v('googleVerify'), bingVerify: v('bingVerify'), ga4: v('ga4'), gtm: v('gtm'), indexNowKey: v('indexNowKey') } }); toast(`Saved — ${r.updated} pages updated`); viewSeoTools(box); }
    catch (er) { toast(er.message); btn.disabled = false; btn.textContent = 'Save & apply to all pages'; }
  };
}

/* ---------- router ---------- */
async function boot(to) {
  try {
    const me = await api('/me');
    if (!me.user) { ME = null; return /^#\/(join|reset|forgot)/.test(location.hash) ? route() : viewLogin(me.setupNeeded); }
    ME = { ...me.user, roleName: me.roleName }; CSRF = me.csrf; PERMS = me.permissions; STATUSES = me.statuses;
  } catch (e) { app.innerHTML = `<div class="auth"><div class="auth-card"><h1>${navigator.onLine === false ? 'You are offline' : 'Admin unavailable'}</h1><p>${navigator.onLine === false ? 'Reconnect to the internet, then reopen the app.' : esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div></div>`; return; }
  if (to) { if (location.hash !== '#' + to) { go(to); return; } }
  route();
}
async function route() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?'); const params = new URLSearchParams(qs || '');
  const m = path.match(/^\/(join|reset)\/([\w-]+)$/);
  if (m) return viewJoin(m[2], m[1] === 'reset');
  if (path === '/forgot') return viewForgot();
  if (!ME) { const me = await api('/me').catch(() => ({})); if (!me.user) return viewLogin(me.setupNeeded); return boot(); }
  if (path === '/login') return go('/');
  const nav = NAV.find(n => n.path === path) || (path.startsWith('/catalog') ? NAV.find(n => n.path === '/catalog') : path.startsWith('/chat') ? NAV.find(n => n.path === '/chat') : path.startsWith('/portfolio') ? NAV.find(n => n.path === '/portfolio') : null);
  if (nav && nav.perm && !can(nav.perm)) return denied();
  try {
    if (path === '/') return can('dashboard.view') ? viewHome() : viewAccount();
    if (path === '/requests') return viewRequests(params);
    if (path === '/invoices') return viewInvoices(params);
    if (path === '/invoices/edit') return can('invoices.view') ? viewInvoiceEdit(params) : denied();
    if (path === '/invoices/settings') return can('invoices.edit') && can('settings.edit') ? viewInvoiceSettings() : denied();
    if (path === '/customers') return viewCustomers();
    if (path === '/customer-login') { if (!window.SatinCustLogin) throw new Error('This page could not load. Refresh the page.'); return window.SatinCustLogin.route(path, params); }
    if (path === '/business') return viewBusiness();
    if (path === '/members') return viewMembers();
    if (path === '/activity') return viewActivity();
    if (path === '/account') return viewAccount();
    if (['/sales', '/website', '/more'].includes(path)) { if (!window.SatinPWA) throw new Error('This page could not load. Refresh the page.'); return window.SatinPWA.hub(path); }
    if (path === '/notifications') { if (!window.SatinPWA) throw new Error('This page could not load. Refresh the page.'); return window.SatinPWA.route(path, params); }
    if (path === '/editor') { location.href = '/admin/editor/'; return; }
    if (path === '/pricing') return go('/catalog');
    if (path === '/banner') { if (!window.SatinCatalog) throw new Error('Refresh the page.'); return window.SatinCatalog.route(path, params); }
    if (['/orders', '/payments', '/templates', '/coupons'].includes(path)) { if (!window.SatinShop) throw new Error('This page could not load. Refresh the page.'); return window.SatinShop.route(path, params); }
    if (path === '/chat' || path.startsWith('/chat/')) { if (!window.SatinChat) throw new Error('Live chat could not load. Refresh the page.'); return window.SatinChat.route(path, params); }
    if (path === '/portfolio' || path.startsWith('/portfolio/')) { if (!window.SatinPortfolio) throw new Error('This page could not load. Refresh the page.'); return window.SatinPortfolio.route(path, params); }
    if (path === '/catalog' || path.startsWith('/catalog/')) { if (!window.SatinCatalog) throw new Error('The catalog could not load. Refresh the page.'); return window.SatinCatalog.route(path, params); }
    go('/');
  } catch (e) { const c = $('[data-content]'); if (c) c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; else toast(e.message); }
}
let refresh = () => route();
window.SatinAdmin = { get csrf() { return CSRF; }, $, esc, api, apiForm, popMenu, toast, go, shell, modal, confirmBox, can, fmtDate, icon, money, csvParse, downloadCSV, nav: NAV, get me() { return ME; } };
addEventListener('hashchange', () => { document.querySelectorAll('.overlay').forEach(o => o.remove()); route(); });
boot();
})();
