/* Satin Admin — Agreements (e-sign): templates made from a PDF with placed fields, documents sent for signature,
   public signing links, signed PDFs with audit trail. Needs app.js (window.SatinAdmin). API: /api/admin/esign… (hp/php/satin-new/esign.php).
   Signer page: /esign/ (sign.mjs). */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TYPES = {
  signature: { label: 'Signature', pt: [170, 38], color: '#e6007e', ic: '✍' },
  initials: { label: 'Initials', pt: [56, 34], color: '#c2410c', ic: 'AB' },
  date: { label: 'Date signed', pt: [100, 20], color: '#0369a1', ic: '📅' },
  name: { label: 'Full name', pt: [170, 20], color: '#4338ca', ic: 'Aa' },
  email: { label: 'Email', pt: [190, 20], color: '#0f766e', ic: '@' },
  text: { label: 'Text box', pt: [170, 20], color: '#475569', ic: 'T' },
  checkbox: { label: 'Checkbox', pt: [14, 14], color: '#15803d', ic: '☑' }
};
const STATUS = { sent: ['Awaiting signature', 'es-sent'], viewed: ['Viewed', 'es-viewed'], signed: ['Signed', 'es-signed'], declined: ['Declined', 'es-declined'], cancelled: ['Cancelled', 'es-cancelled'] };
const pill = s => `<span class="pill ${(STATUS[s] || [])[1] || ''}">${esc((STATUS[s] || [s])[0])}</span>`;
let DATA = null, TAB = 'docs', FILTER = { q: '', status: '' };
const fmt = s => A().fmtDate(s);
const toTop = () => { scrollTo(0, 0); document.body.scrollTop = 0; }; // phones: the admin scrolls the body, not the window
const copy = async (t, msg) => { try { await navigator.clipboard.writeText(t); A().toast(msg || 'Link copied'); } catch { prompt('Copy this link', t); } };

async function route(path, params) {
  if (path === '/agreements/template') return editor(params.get('id'), params.get('send') === '1');
  if (path === '/agreements/fill') return fillPage(params.get('id'), params.get('doc'));
  if (path === '/agreements/ready') return readyPage(params.get('doc'));
  return list(params);
}

/* ---------------- list ---------------- */
async function list(params) {
  if (params && params.get('tab')) TAB = params.get('tab') === 'templates' ? 'templates' : 'docs';
  const c = A().shell('Agreements (e-sign)', 'Business', '<div class="card empty">Loading…</div>', '/agreements');
  const canSend = A().can('agreements.send');
  $('[data-actions]').innerHTML = canSend ? '<button class="btn ghost sm" data-new>+ Upload new agreement</button> <button class="btn ghost sm" data-oneoff>Sign a one-off PDF</button> <button class="btn sm" data-send>+ Create agreement</button>' : '';
  if (canSend) {
    $('[data-new]').onclick = () => uploadFlow('template');
    $('[data-oneoff]').onclick = () => uploadFlow('oneoff');
    $('[data-send]').onclick = () => pickTemplate();
  }
  try { DATA = await A().api('/esign'); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const waiting = DATA.docs.filter(d => d.status === 'sent' || d.status === 'viewed').length;
  c.innerHTML = `<div class="grid g4 tiles es-tiles">
      <div class="card stat"><small>Awaiting signature</small><b>${waiting}</b></div>
      <div class="card stat"><small>Signed (30 days)</small><b>${DATA.docs.filter(d => d.status === 'signed' && Date.now() - new Date(d.signedAt) < 30 * 864e5).length}</b></div>
      <div class="card stat"><small>All documents</small><b>${DATA.docs.length}</b></div>
      <div class="card stat"><small>Templates</small><b>${DATA.templates.length}</b></div></div>
    <div class="tabs" role="tablist"><button data-tab="docs" class="${TAB === 'docs' ? 'on' : ''}">Documents</button><button data-tab="templates" class="${TAB === 'templates' ? 'on' : ''}">Templates</button></div><div data-body></div>`;
  $$('[data-tab]', c).forEach(b => b.onclick = () => { TAB = b.dataset.tab; $$('[data-tab]', c).forEach(x => x.classList.toggle('on', x === b)); body(); });
  const body = () => TAB === 'docs' ? docsTab($('[data-body]', c)) : templatesTab($('[data-body]', c));
  body();
}
function docsTab(box) {
  box.innerHTML = `<div class="toolbar"><input class="input" data-q placeholder="Search document, name or email" value="${esc(FILTER.q)}">
    <select class="input" data-st><option value="">All statuses</option>${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></div><div data-list></div>`;
  $('[data-st]', box).value = FILTER.status;
  const draw = () => {
    const w = FILTER.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = DATA.docs.filter(d => (!FILTER.status || d.status === FILTER.status || FILTER.status === 'sent' && d.status === 'viewed') && w.every(x => [d.title, d.signerName, d.signerEmail, d.number].join(' ').toLowerCase().includes(x)));
    $('[data-list]', box).innerHTML = rows.length ? `<table class="table has-acts"><thead><tr><th>Document</th><th>Signer</th><th>Sent</th><th>Status</th><th class="act"><span class="sr">Actions</span></th></tr></thead><tbody>${rows.map(d => `
      <tr class="click" data-doc="${esc(d.id)}"><td><b>${esc(d.title)}</b><small>#${d.number}${d.via === 'public' ? ' · via public link' : ''}</small></td><td>${esc(d.signerName)}<small>${esc(d.signerEmail)}</small></td>
      <td>${esc(fmt(d.sentAt || d.createdAt))}</td><td>${pill(d.status)}${d.status === 'signed' ? `<small>${esc(fmt(d.signedAt))}</small>` : d.viewedAt && d.status === 'viewed' ? `<small>Opened ${esc(fmt(d.viewedAt))}</small>` : ''}</td>
      <td class="act"><button type="button" class="rowmenu" data-dmenu="${esc(d.id)}" aria-label="Actions">⋯</button></td></tr>`).join('')}</tbody></table>`
      : `<div class="card empty">${DATA.docs.length ? 'No documents match.' : 'No documents yet. Create a template from your agreement PDF, then press <b>Send for signature</b>.'}</div>`;
    $$('tr[data-doc]', box).forEach(tr => tr.onclick = e => { if (e.target.closest('.act')) return; A().go('/agreements/ready?doc=' + tr.dataset.doc); });
    $$('[data-dmenu]', box).forEach(b => b.onclick = e => { e.stopPropagation(); docMenu(b, DATA.docs.find(d => d.id === b.dataset.dmenu)); });
  };
  $('[data-q]', box).oninput = e => { FILTER.q = e.target.value; draw(); };
  $('[data-st]', box).onchange = e => { FILTER.status = e.target.value; draw(); };
  draw();
}
function docMenu(btn, d) {
  const send = A().can('agreements.send'), open = d.status === 'sent' || d.status === 'viewed';
  const items = [['view', 'Details & audit trail']];
  if (d.status === 'signed') items.push(['pdf', 'Download signed PDF']);
  if (open && send) items.push(['copy', 'Copy signing link'], ['remind', 'Send reminder email'], ['cancel', 'Cancel document']);
  if (send) items.push(['delete', 'Delete', 'danger']);
  A().popMenu(btn, items, k => docAction(k, d));
}
async function docAction(k, d, after) {
  const done = after || (() => list());
  if (k === 'view') return docModal(d.id);
  if (k === 'pdf') { location.href = '/api/admin/esign/pdf?id=' + d.id + '&dl=1'; return; }
  if (k === 'copy') return copy(d.url, 'Signing link copied');
  if (k === 'remind') { try { await A().api('/esign/doc/remind', { id: d.id }); A().toast('Reminder sent to ' + d.signerEmail); done(); } catch (e) { A().toast(e.message); } return; }
  if (k === 'cancel') return A().confirmBox('Cancel this document?', `${d.signerName} will no longer be able to sign "${d.title}". The link stops working.`, async () => { try { await A().api('/esign/doc/cancel', { id: d.id }); A().toast('Document cancelled'); done(); } catch (e) { A().toast(e.message); } }, { yesLabel: 'Cancel document', danger: true });
  if (k === 'delete') return A().confirmBox('Delete this document?', `"${d.title}" for ${d.signerName} and its audit trail are removed permanently.${d.status === 'signed' ? ' Keep a copy of the signed PDF first.' : ''}`, async () => { try { await A().api('/esign/doc/delete', { id: d.id }); A().toast('Deleted'); done(); } catch (e) { A().toast(e.message); } }, { yesLabel: 'Delete', danger: true, ...(d.status === 'signed' ? { typeWord: 'delete' } : {}) });
}
async function docModal(id) {
  const o = A().modal('<div class="empty">Loading…</div>'); o.querySelector('.modal').classList.add('es-wide');
  let d; try { d = (await A().api('/esign/doc?id=' + encodeURIComponent(id))).doc; } catch (e) { o.querySelector('.modal').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const open = d.status === 'sent' || d.status === 'viewed', send = A().can('agreements.send');
  o.querySelector('.modal').innerHTML = `<header><h2>${esc(d.title)}</h2><button class="x" data-close>×</button></header>
    <p style="margin:-6px 0 14px">${pill(d.status)} <span class="hint">#${d.number} · ${esc(d.signerName)} &lt;${esc(d.signerEmail)}&gt;</span></p>
    <div class="row-actions" style="margin-bottom:16px">${d.status === 'signed' ? `<a class="btn sm" href="/api/admin/esign/pdf?id=${d.id}&dl=1">Download signed PDF</a><a class="btn ghost sm" href="/api/admin/esign/pdf?id=${d.id}" target="_blank" rel="noopener">View PDF</a>` : ''}
      ${open && send ? `<button class="btn ghost sm" data-a="copy">Copy signing link</button><button class="btn ghost sm" data-a="remind">Send reminder</button><button class="btn ghost sm" data-a="cancel">Cancel</button>` : ''}</div>
    ${d.declineReason ? `<div class="err warnbox">Declined: ${esc(d.declineReason)}</div>` : ''}
    <h3 class="es-h3">Audit trail</h3><ol class="es-timeline">${d.events.map(e => `<li><b>${esc(e.event[0].toUpperCase() + e.event.slice(1))}</b> <span class="hint" style="margin:0">${esc(fmt(e.at))}</span><div>${esc(e.detail)}</div><small>${esc([e.actor && !e.detail.includes(e.actor) ? 'By ' + e.actor : '', e.ip ? 'IP ' + e.ip : ''].filter(Boolean).join(' · '))}</small></li>`).join('')}</ol>
    ${d.finalHash ? `<p class="hint" style="word-break:break-all">Signed PDF SHA-256: ${esc(d.finalHash)}</p>` : ''}${d.originalHash ? `<p class="hint" style="word-break:break-all">Original document SHA-256: ${esc(d.originalHash)}</p>` : ''}`;
  $$('[data-a]', o).forEach(b => b.onclick = () => docAction(b.dataset.a, d, () => { o.remove(); list(); }));
}
function templatesTab(box) {
  const send = A().can('agreements.send');
  box.innerHTML = DATA.templates.length ? `<div class="es-tgrid">${DATA.templates.map(t => `<div class="card es-tcard"><a class="es-thumb" ${send ? `href="#/agreements/template?id=${t.id}"` : ''}>${t.thumb ? `<img src="${esc(t.thumb)}" alt="" loading="lazy">` : ''}</a>
    <div class="es-tbody"><b>${esc(t.name)}</b><small>${t.pageCount} page${t.pageCount === 1 ? '' : 's'} · ${t.fieldCount} field${t.fieldCount === 1 ? '' : 's'}${t.linkOn ? ' · <span class="es-live">● Public link on</span>' : ''}</small>
    ${send ? `<div class="row-actions" style="margin-top:10px"><button class="btn sm" data-ts="${t.id}">Create agreement</button><a class="btn ghost sm" href="#/agreements/template?id=${t.id}">Edit fields</a><button class="btn ghost sm" data-tl="${t.id}">Public link</button><button type="button" class="rowmenu" data-tm="${t.id}" aria-label="More">⋯</button></div>` : ''}</div></div>`).join('')}</div>`
    : `<div class="card empty">No templates yet.${send ? ' <a href="#" data-first>Upload your agreement PDF</a> and place the fields the customer fills in (signature, date, name…).' : ''}</div>`;
  const f = $('[data-first]', box); if (f) f.onclick = e => { e.preventDefault(); uploadFlow('template'); };
  $$('[data-ts]', box).forEach(b => b.onclick = () => A().go('/agreements/fill?id=' + b.dataset.ts));
  $$('[data-tl]', box).forEach(b => b.onclick = async () => linkModal(await getTpl(b.dataset.tl)));
  $$('[data-tm]', box).forEach(b => b.onclick = () => A().popMenu(b, [['edit', 'Edit fields'], ['rename', 'Rename'], ['dup', 'Duplicate'], ['replace', 'Replace PDF / file'], ['delete', 'Delete template', 'danger']], async k => {
    const t = DATA.templates.find(x => x.id === b.dataset.tm);
    if (k === 'edit') return A().go('/agreements/template?id=' + t.id);
    if (k === 'rename') { const n = prompt('Template name', t.name); if (!n || !n.trim() || n.trim() === t.name) return; try { const full = await getTpl(t.id); await A().api('/esign/template', { id: t.id, name: n.trim(), message: full.message, fields: full.fields }); A().toast('Renamed'); list(); } catch (e) { A().toast(e.message); } return; }
    if (k === 'dup') { try { const r = await A().api('/esign/template/duplicate', { id: t.id }); A().toast('Template duplicated'); A().go('/agreements/template?id=' + r.template.id); } catch (e) { A().toast(e.message); } return; }
    if (k === 'replace') { try { const nt = await uploadFlow('template', t.id); if (nt) { A().toast('File replaced — check the field positions'); A().go('/agreements/template?id=' + t.id); } } catch (e) { A().toast(e.message); } return; }
    A().confirmBox('Delete template?', `"${t.name}" is removed. Documents already sent with it are kept.`, async () => { try { await A().api('/esign/template/delete', { id: t.id }); A().toast('Template deleted'); list(); } catch (e) { A().toast(e.message); } }, { danger: true, yesLabel: 'Delete' });
  }));
}
async function getTpl(id) { return (await A().api('/esign/template?id=' + encodeURIComponent(id))).template; }
function pickTemplate() {
  if (!DATA.templates.length) { A().toast('Create a template first (or use “Sign a one-off PDF”).'); return; }
  const o = A().modal(`<header><h2>Create agreement</h2><button class="x" data-close>×</button></header><p class="hint" style="margin-top:-6px">Choose the agreement template</p>
    <div class="es-pick">${DATA.templates.map(t => `<button type="button" data-p="${t.id}">${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : ''}<span><b>${esc(t.name)}</b><small>${t.pageCount} page${t.pageCount === 1 ? '' : 's'} · ${t.fieldCount} fields</small></span></button>`).join('')}</div>`);
  $$('[data-p]', o).forEach(b => b.onclick = () => { o.remove(); A().go('/agreements/fill?id=' + b.dataset.p); });
}

/* ---------------- send ---------------- */
let CUSTOMERS = null;
async function sendModal(t, after) {
  const us = (t.fields || []).filter(f => f.role === 'sender');
  const cust = (t.fields || []).filter(f => f.role === 'signer' && f.type === 'text');
  if (!(t.fields || []).some(f => f.role === 'signer')) { A().toast('Add at least one field for the customer first.'); return; }
  const o = A().modal(`<header><h2>Send “${esc(t.name)}”</h2><button class="x" data-close>×</button></header>
    <form data-f novalidate><label class="field"><span>Signer's full name</span><input name="name" list="es-cust" autocomplete="off" required></label>
    <label class="field"><span>Signer's email</span><input name="email" type="email" required></label>
    ${us.length ? `<div class="es-us"><b>Filled in by you</b>${us.map(f => f.type === 'checkbox' ? `<label class="es-check"><input type="checkbox" data-us="${f.id}" ${f.value === '1' ? 'checked' : ''}> ${esc(f.label || 'Checkbox')}</label>` : `<label class="field"><span>${esc(f.label || TYPES[f.type].label)}</span><input data-us="${f.id}" value="${esc(f.type === 'date' && !f.value ? new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : f.value)}"></label>`).join('')}</div>` : ''}
    ${cust.length ? `<details class="es-us"><summary><b>Pre-fill customer fields (optional)</b></summary><p class="hint" style="margin:4px 0 10px">The customer sees these filled in and can still change them.</p>${cust.map(f => `<label class="field"><span>${esc(f.label || 'Text')}</span><input data-us="${f.id}"></label>`).join('')}</details>` : ''}
    <label class="field"><span>Message (optional)</span><textarea name="message" rows="3" placeholder="Hi, please review and sign your wrap agreement.">${esc(t.message || '')}</textarea></label>
    <label class="es-check"><input type="checkbox" name="mail" checked> Email the signing link to the signer</label>
    <div class="err" data-err style="margin-top:8px"></div>
    <div class="confirm-acts"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" data-go>Send</button></div></form><datalist id="es-cust"></datalist>`);
  const f = $('[data-f]', o);
  f.mail.onchange = () => { $('[data-go]', o).textContent = f.mail.checked ? 'Send' : 'Create link'; };
  if (A().can('invoices.view')) (async () => {
    try { CUSTOMERS = CUSTOMERS || (await A().api('/customers')).customers || []; } catch { CUSTOMERS = []; }
    $('#es-cust', o).innerHTML = CUSTOMERS.filter(c => c.email).slice(0, 800).map(c => `<option value="${esc(c.name)}">${esc(c.email)}${c.company ? ' · ' + esc(c.company) : ''}</option>`).join('');
    f.name.oninput = () => { const c = CUSTOMERS.find(x => x.name === f.name.value); if (c && c.email && !f.email.value) f.email.value = c.email; };
  })();
  setTimeout(() => f.name.focus(), 50);
  f.onsubmit = async e => {
    e.preventDefault(); const go = $('[data-go]', o); go.disabled = true; $('[data-err]', o).textContent = '';
    const prefill = {}; $$('[data-us]', o).forEach(i => { prefill[i.dataset.us] = i.type === 'checkbox' ? (i.checked ? '1' : '') : i.value; });
    try {
      const r = await A().api('/esign/send', { templateId: t.id, signerName: f.name.value.trim(), signerEmail: f.email.value.trim(), message: f.message.value, prefill, email: f.mail.checked });
      o.querySelector('.modal').innerHTML = `<header><h2>${f.mail.checked ? (r.mailed ? 'Sent ✓' : 'Created — email not delivered') : 'Signing link ready'}</h2><button class="x" data-close>×</button></header>
        <p style="color:var(--mut)">${f.mail.checked ? (r.mailed ? `${esc(r.doc.signerName)} got an email with the link to sign “${esc(r.doc.title)}”. You'll get a notification and the signed PDF by email when it's done.` : 'The email could not be sent. Copy the link below and send it yourself (text, WhatsApp…).') : 'Send this link to ' + esc(r.doc.signerName) + ' (text, WhatsApp, email…). Only this person should use it.'}</p>
        <div class="es-link"><input class="input" readonly value="${esc(r.doc.url)}"><button class="btn sm" data-cp>Copy</button></div>
        <div class="confirm-acts"><a class="btn ghost" href="${esc(r.doc.url)}" target="_blank" rel="noopener">Open signing page</a><button class="btn" data-close>Done</button></div>`;
      $('[data-cp]', o).onclick = () => copy(r.doc.url);
      o.addEventListener('click', e2 => { if (e2.target === o || e2.target.closest('[data-close]')) { if (after) after(); else if (location.hash.startsWith('#/agreements')) { TAB = 'docs'; list(); } } });
    } catch (er) { $('[data-err]', o).textContent = er.message; go.disabled = false; }
  };
}
function linkModal(t) {
  const o = A().modal('');
  const draw = () => {
    o.querySelector('.modal').innerHTML = `<header><h2>Public signing link</h2><button class="x" data-close>×</button></header>
      <p style="color:var(--mut)">Anyone with this link can enter their name and email and sign their own copy of “${esc(t.name)}”. Put it on your website, in a text message or in a QR code at the counter. Every signature arrives under Documents.</p>
      <label class="es-check" style="margin:14px 0"><input type="checkbox" data-on ${t.linkOn ? 'checked' : ''}> Link is active</label>
      ${t.linkOn ? `<div class="es-link"><input class="input" readonly value="${esc(t.linkUrl)}"><button class="btn sm" data-cp>Copy</button></div><p class="hint"><a href="${esc(t.linkUrl)}" target="_blank" rel="noopener">Open the link</a> · <a href="#" data-reset>Make a new link</a> (the old one stops working)</p>` : ''}
      <div class="confirm-acts"><button class="btn" data-close>Done</button></div>`;
    $('[data-on]', o).onchange = async e => { try { t = (await A().api('/esign/template/link', { id: t.id, on: e.target.checked })).template; draw(); } catch (er) { A().toast(er.message); } };
    const cp = $('[data-cp]', o); if (cp) cp.onclick = () => copy(t.linkUrl);
    const rs = $('[data-reset]', o); if (rs) rs.onclick = async e => { e.preventDefault(); try { t = (await A().api('/esign/template/link', { id: t.id, on: true, reset: true })).template; draw(); A().toast('New link created'); } catch (er) { A().toast(er.message); } };
  };
  draw();
  o.addEventListener('click', e => { if ((e.target === o || e.target.closest('[data-close]')) && location.hash.startsWith('#/agreements') && !location.hash.includes('template')) list(); });
}

/* ---------------- Agreement information form: staff fill everything (all optional), the customer only signs ---------------- */
async function fillPage(id, docId) { toTop();
  const c = A().shell(docId ? 'Edit agreement information' : 'Create agreement', '<a href="#/agreements">Agreements</a>', '<div class="card empty">Loading…</div>', '/agreements');
  let t, doc = null;
  try { if (docId) { doc = (await A().api('/esign/doc?id=' + encodeURIComponent(docId))).doc; id = doc.templateId; } t = await getTpl(id); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  $('[data-actions]').innerHTML = `<a class="btn ghost sm" href="#/agreements">← Back</a> <a class="btn ghost sm" href="#/agreements/template?id=${t.id}">Edit template fields</a>`;
  const pre = doc ? doc.prefill || {} : null;
  const ours = t.fields.filter(f => f.role === 'sender'), theirsText = t.fields.filter(f => f.role === 'signer' && f.type === 'text');
  const groups = []; const gi = {};
  for (const f of ours) { const g = f.group || (f.type === 'checkbox' ? 'Options' : 'Details'); if (!(g in gi)) { gi[g] = groups.length; groups.push([g, []]); } groups[gi[g]][1].push(f); }
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const val = f => pre ? (pre[f.id] ?? '') : f.type === 'date' && !f.value ? today : f.value;
  const input = f => f.type === 'checkbox' ? `<label class="es-check es-cbf"><input type="checkbox" data-v="${f.id}" ${val(f) === '1' ? 'checked' : ''}> ${esc(f.label || 'Checkbox')}</label>`
    : `<label class="field"><span>${esc(f.label || TYPES[f.type].label)}</span><input data-v="${f.id}" value="${esc(val(f))}" ${f.type === 'email' ? 'type="email" inputmode="email"' : /phone/i.test(f.label) ? 'type="tel" inputmode="tel"' : ''}></label>`;
  const signs = t.fields.filter(f => f.role === 'signer').reduce((a, f) => (a[f.type] = (a[f.type] || 0) + 1, a), {});
  const pickTpl = !docId && DATA && DATA.templates.length > 1 ? `<label class="field" style="margin-bottom:14px"><span>Agreement template</span><select class="input" data-tpl>${DATA.templates.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : '';
  c.innerHTML = `<form class="es-fill" data-f novalidate>
    <div class="card">${pickTpl}<h2 style="margin-top:0">${esc(t.name)}</h2><p class="hint" style="margin-top:-4px">Fill in what you know — every field is optional. Next you'll see the finished PDF and can email it or copy the link. The customer only ${[signs.signature ? 'signs' : '', signs.initials ? 'initials each page' : ''].filter(Boolean).join(' and ') || 'reviews'}${theirsText.length ? ' and completes ' + theirsText.length + ' field' + (theirsText.length === 1 ? '' : 's') : ''}.</p>
      <div class="es-fgrid"><label class="field"><span>Customer name</span><input name="name" list="es-cust" autocomplete="off" value="${esc(doc && doc.signerName !== 'Customer' ? doc.signerName : '')}"></label><label class="field"><span>Customer email</span><input name="email" type="email" inputmode="email" value="${esc(doc ? doc.signerEmail : '')}"></label></div><datalist id="es-cust"></datalist></div>
    ${groups.map(([g, fs]) => `<div class="card"><h3 class="es-h3" style="margin-top:0">${esc(g)}</h3><div class="es-fgrid">${fs.filter(f => f.type !== 'checkbox').map(input).join('')}</div>${fs.some(f => f.type === 'checkbox') ? `<div class="es-cbs">${fs.filter(f => f.type === 'checkbox').map(input).join('')}</div>` : ''}</div>`).join('')}
    ${theirsText.length ? `<div class="card"><h3 class="es-h3" style="margin-top:0">Customer fields <small class="hint">(optional — the customer can change them)</small></h3><div class="es-fgrid">${theirsText.map(f => `<label class="field"><span>${esc(f.label || 'Text')}</span><input data-v="${f.id}" value="${esc(pre ? pre[f.id] || '' : '')}"></label>`).join('')}</div></div>` : ''}
    <div class="card"><label class="field"><span>Message to the customer (optional)</span><textarea name="message" rows="3">${esc(doc ? doc.message : t.message || '')}</textarea></label>
      <div class="err" data-err></div><div class="es-fill-go"><button class="btn" data-go>${docId ? 'Save & show the PDF' : 'Generate agreement'}</button></div></div></form>`;
  const f = $('[data-f]', c);
  const tp = $('[data-tpl]', c); if (tp) tp.onchange = () => A().go('/agreements/fill?id=' + tp.value);
  if (A().can('invoices.view')) (async () => {
    try { CUSTOMERS = CUSTOMERS || (await A().api('/customers')).customers || []; } catch { CUSTOMERS = []; }
    $('#es-cust', c).innerHTML = CUSTOMERS.slice(0, 800).map(x => `<option value="${esc(x.name)}">${esc(x.email || '')}${x.company ? ' · ' + esc(x.company) : ''}</option>`).join('');
    f.name.addEventListener('change', () => { const x = CUSTOMERS.find(y => y.name === f.name.value); if (!x) return; if (x.email && !f.email.value) f.email.value = x.email;
      for (const fl of ours) { const el = $(`[data-v="${fl.id}"]`, c); if (!el || el.value) continue; const L = (fl.label || '').toLowerCase(); const v = /company/.test(L) ? x.company : /phone/.test(L) ? x.phone : /email/.test(L) ? x.email : /customer name|full name|^name/.test(L) ? x.name : /address/.test(L) ? x.address : ''; if (v) el.value = v; } });
  })();
  const mirror = (re, from) => { for (const fl of ours) if (re.test(fl.label || '')) { const el = $(`[data-v="${fl.id}"]`, c); if (el && (!el.value || el.dataset.auto)) { el.value = from.value; el.dataset.auto = 1; } } };
  f.name.addEventListener('input', () => mirror(/customer name|full name/i, f.name));
  f.email.addEventListener('input', () => mirror(/email/i, f.email));
  f.onsubmit = async e => {
    e.preventDefault(); const go = $('[data-go]', c); go.disabled = true; go.textContent = 'Generating…'; $('[data-err]', c).textContent = '';
    const prefill = {}; $$('[data-v]', c).forEach(i => { prefill[i.dataset.v] = i.type === 'checkbox' ? (i.checked ? '1' : '') : i.value.trim(); });
    try {
      const body = { signerName: f.name.value.trim(), signerEmail: f.email.value.trim(), message: f.message.value, prefill };
      const r = docId ? await A().api('/esign/doc/update', { id: docId, ...body }) : await A().api('/esign/send', { templateId: t.id, ...body, email: false });
      A().go('/agreements/ready?doc=' + r.doc.id);
    } catch (er) { $('[data-err]', c).textContent = er.message; go.disabled = false; go.textContent = docId ? 'Save & show the PDF' : 'Generate agreement'; }
  };
}
// Step 2: the finished PDF with everything filled in, then email it / copy the link.
async function readyPage(docId) { toTop();
  const c = A().shell('Agreement ready', '<a href="#/agreements">Agreements</a>', '<div class="card empty">Loading…</div>', '/agreements');
  let d; try { d = (await A().api('/esign/doc?id=' + encodeURIComponent(docId))).doc; } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const open = d.status === 'sent' || d.status === 'viewed';
  $('[data-actions]').innerHTML = `<a class="btn ghost sm" href="#/agreements">← Back</a>`;
  const pdf = d.status === 'signed' ? `/api/admin/esign/pdf?id=${d.id}` : `/api/admin/esign/draft?id=${d.id}`;
  const sent = d.events.some(e => /^(sent|reminder sent)$/.test(e.event));
  c.innerHTML = `<div class="es-ready">
    <div class="card es-prev"><div class="es-prev-h"><b>${esc(d.title)}</b> ${pill(d.status)}</div><div class="es-pdfpages" data-pdfpages><div class="empty">Loading the PDF…</div></div><p class="hint es-prev-m"><a href="${pdf}" target="_blank" rel="noopener">Open the PDF in a new tab</a></p></div>
    <div class="es-side2">
      ${open ? `<div class="card"><h3 class="es-h3" style="margin-top:0">1 · Send to the customer</h3>
        <label class="field"><span>Customer name</span><input data-nm value="${esc(d.signerName === 'Customer' ? '' : d.signerName)}"></label>
        <label class="field"><span>Customer email</span><input data-em type="email" inputmode="email" value="${esc(d.signerEmail)}" placeholder="customer@email.com"></label>
        <button class="btn block" data-send>${sent ? 'Send again' : 'Email the agreement'}</button><div class="err" data-err></div>
        ${sent ? `<p class="hint">Emailed ${esc(fmt(d.events.filter(e => /sent/.test(e.event)).pop().at))}</p>` : ''}</div>
      <div class="card"><h3 class="es-h3" style="margin-top:0">2 · Or share the link</h3><p class="hint" style="margin-top:-4px">Text / WhatsApp it, or open it on a tablet at the counter.</p>
        <div class="es-link"><input class="input" readonly value="${esc(d.url)}"><button class="btn sm" data-cp>Copy</button></div>
        <div class="row-actions">${navigator.share ? '<button class="btn ghost sm" data-share>Share…</button>' : ''}<a class="btn ghost sm" href="https://wa.me/?text=${encodeURIComponent('Please review and sign: ' + d.url)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn ghost sm" href="${esc(d.url)}" target="_blank" rel="noopener">Open signing page</a></div></div>` : `<div class="card"><p>${d.status === 'signed' ? 'Signed ' + esc(fmt(d.signedAt)) + '.' : 'This agreement is ' + esc(STATUS[d.status]?.[0] || d.status).toLowerCase() + '.'}</p></div>`}
      <div class="card"><div class="row-actions"><a class="btn ghost sm" href="${pdf}&dl=1">Download PDF</a>${open ? `<a class="btn ghost sm" href="#/agreements/fill?doc=${d.id}">Edit information</a>` : ''}<button class="btn ghost sm" data-audit>Audit trail</button></div></div>
    </div></div>`;
  requestAnimationFrame(toTop);
  const cp = $('[data-cp]', c); if (cp) cp.onclick = () => copy(d.url);
  (async () => { // PDF preview drawn with pdf.js (phones can't show a PDF inside the page)
    const box = $('[data-pdfpages]', c);
    try { const lib = await pdfjs(); const buf = await (await fetch(pdf, { credentials: 'same-origin' })).arrayBuffer(); const doc = await lib.getDocument({ data: buf }).promise; box.innerHTML = '';
      for (let n = 1; n <= doc.numPages; n++) { if (!document.body.contains(box)) return; const pg = await doc.getPage(n), w = Math.min(1400, Math.max(600, box.clientWidth * (devicePixelRatio || 1))), vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: w / vp1.width });
        const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); box.appendChild(cv); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; } }
    catch (e) { box.innerHTML = `<div class="empty">The preview could not load. <a href="${pdf}" target="_blank" rel="noopener">Open the PDF</a>.</div>`; }
  })();
  const sh = $('[data-share]', c); if (sh) sh.onclick = () => navigator.share({ title: d.title, text: 'Please review and sign', url: d.url }).catch(() => {});
  $('[data-audit]', c).onclick = () => docModal(d.id);
  const sb = $('[data-send]', c);
  if (sb) sb.onclick = async () => { sb.disabled = true; $('[data-err]', c).textContent = '';
    try { await A().api('/esign/doc/send', { id: d.id, email: $('[data-em]', c).value.trim(), name: $('[data-nm]', c).value.trim() }); A().toast('Emailed to ' + $('[data-em]', c).value.trim()); readyPage(d.id); }
    catch (e) { $('[data-err]', c).textContent = e.message; sb.disabled = false; } };
}

/* ---------------- upload (PDF / images → page JPEGs) ---------------- */
let pdfLib = null;
function polyfill() { // pdf.js 5 uses Map#getOrInsertComputed (new in 2025 browsers)
  for (const C of [Map, WeakMap]) {
    if (!C.prototype.getOrInsertComputed) Object.defineProperty(C.prototype, 'getOrInsertComputed', { configurable: true, writable: true, value(k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); } });
    if (!C.prototype.getOrInsert) Object.defineProperty(C.prototype, 'getOrInsert', { configurable: true, writable: true, value(k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
  }
}
async function pdfjs() { polyfill(); if (!pdfLib) { pdfLib = await import('/checkout/vendor/pdf.mjs'); pdfLib.GlobalWorkerOptions.workerSrc = '/checkout/vendor/pdf.worker.mjs'; } return pdfLib; }
const loadScript = src => new Promise((ok, no) => { if ([...document.scripts].some(x => x.src === src)) return ok(); const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => no(new Error('Could not load the Word reader. Check your connection, or save the file as PDF.')); document.head.appendChild(el); });
// Word (.docx): converted to HTML (mammoth), laid out on Letter pages and captured as images (html2canvas). Layout is close, not identical: for exact layout upload a PDF.
async function docxPages(file, onProgress) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  const r = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const PW = 816, PH = 1056, M = 72; // Letter at 96 px/in, 0.75 in margins
  const host = document.createElement('div'); host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PW - 2 * M}px;font:14px/1.45 Georgia,'Times New Roman',serif;color:#111;background:#fff`;
  host.innerHTML = `<style>.dx h1{font-size:22px;margin:0 0 12px}.dx h2{font-size:17px;margin:16px 0 8px}.dx h3{font-size:15px;margin:14px 0 6px}.dx p{margin:0 0 9px}.dx ul,.dx ol{margin:0 0 9px 22px;padding:0}.dx table{border-collapse:collapse;width:100%;margin:0 0 10px}.dx td,.dx th{border:1px solid #999;padding:4px 6px;vertical-align:top}.dx img{max-width:100%}</style><div class="dx">${r.value}</div>`;
  document.body.appendChild(host);
  try {
    await new Promise(ok => setTimeout(ok, 300));
    const blocks = [...host.querySelector('.dx').children], pages = [[]]; let used = 0;
    for (const b of blocks) { const st = getComputedStyle(b), h = b.offsetHeight + parseFloat(st.marginTop) + parseFloat(st.marginBottom); if (used + h > PH - 2 * M && pages[pages.length - 1].length) { pages.push([]); used = 0; } pages[pages.length - 1].push(b); used += h; }
    if (pages.length > 40) throw new Error('This document is longer than 40 pages.');
    const out = [];
    for (let k = 0; k < pages.length; k++) {
      onProgress(k + 1, pages.length);
      const pg = document.createElement('div'); pg.style.cssText = `position:fixed;left:-10000px;top:0;width:${PW}px;height:${PH}px;padding:${M}px;box-sizing:border-box;background:#fff;font:14px/1.45 Georgia,'Times New Roman',serif;color:#111;overflow:hidden`;
      pg.innerHTML = host.firstElementChild.outerHTML + '<div class="dx"></div>'; pages[k].forEach(b => pg.lastElementChild.appendChild(b.cloneNode(true)));
      document.body.appendChild(pg);
      const c = await window.html2canvas(pg, { scale: 1700 / PW, backgroundColor: '#ffffff', logging: false }); pg.remove();
      out.push({ w: 612, h: 792, blob: await toJpeg(c) });
    }
    return out;
  } finally { host.remove(); }
}
function pickFile(accept) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); }); }
const toJpeg = c => new Promise(r => c.toBlob(r, 'image/jpeg', .86));
async function renderPages(file, onProgress) {
  const pages = [];
  if (/\.docx$/i.test(file.name)) return docxPages(file, onProgress);
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    const lib = await pdfjs(); const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    if (doc.numPages > 40) throw new Error('This PDF has ' + doc.numPages + ' pages. The limit is 40.');
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(n, doc.numPages);
      const pg = await doc.getPage(n), vp1 = pg.getViewport({ scale: 1 }), s = Math.min(2.6, 1700 / vp1.width), vp = pg.getViewport({ scale: s });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      pages.push({ w: vp1.width, h: vp1.height, blob: await toJpeg(c) });
    }
  } else {
    const img = await createImageBitmap(file); const s = Math.min(1, 1700 / img.width);
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    const wPt = 612, hPt = Math.round(612 * img.height / img.width * 100) / 100; // fit to Letter width
    pages.push({ w: wPt, h: hPt, blob: await toJpeg(c) });
  }
  return pages;
}
async function uploadFlow(kind, existing) {
  const file = await pickFile('application/pdf,.pdf,image/jpeg,image/png,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,application/msword'); if (!file) return;
  if (/\.doc$/i.test(file.name)) { A().toast('Old .doc files can’t be read. In Word use File → Save as → PDF (or .docx) and upload that.'); return; }
  if (file.size > 30e6) { A().toast('The file is larger than 30 MB.'); return; }
  const o = A().modal(`<header><h2>${existing ? 'Replacing the PDF…' : 'Preparing your document…'}</h2></header><p data-p style="color:var(--mut)">Reading ${esc(file.name)}…</p><div class="es-bar"><i data-b></i></div>`);
  o.onclick = null;
  try {
    const pages = await renderPages(file, (n, t) => { $('[data-p]', o).textContent = `Page ${n} of ${t}…`; $('[data-b]', o).style.width = n / t * 80 + '%'; });
    $('[data-p]', o).textContent = 'Uploading…'; $('[data-b]', o).style.width = '90%';
    const fd = new FormData();
    if (existing) fd.append('id', existing);
    fd.append('name', file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim());
    fd.append('kind', kind); fd.append('meta', JSON.stringify(pages.map(p => ({ w: p.w, h: p.h }))));
    pages.forEach((p, k) => fd.append('page' + k, p.blob, 'p' + k + '.jpg'));
    if (/pdf/i.test(file.type) && file.size < 30e6) fd.append('source', file, file.name);
    const r = await A().apiForm('/esign/upload', fd);
    o.remove();
    if (existing) return r.template;
    A().go('/agreements/template?id=' + r.template.id);
  } catch (e) { o.querySelector('.modal').innerHTML = `<header><h2>Could not read the file</h2><button class="x" data-close>×</button></header><div class="err">${esc(e.message)}</div><div class="confirm-acts"><button class="btn" data-close>OK</button></div>`; o.onclick = ev => { if (ev.target === o || ev.target.closest('[data-close]')) o.remove(); }; }
}

/* ---------------- template editor ---------------- */
async function editor(id, sendAfter) { toTop();
  const c = A().shell('Prepare document', '<a href="#/agreements?tab=templates">Agreements</a>', '<div class="card empty">Loading…</div>', '/agreements');
  let t; try { t = await getTpl(id); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const S = { fields: t.fields.map(f => ({ ...f })), sel: null, arm: null, dirty: false };
  const oneoff = t.kind === 'oneoff';
  $('[data-actions]').innerHTML = `<a class="btn ghost sm" href="#/agreements?tab=templates">← Back</a> <button class="btn ghost sm es-hide-m" data-replace>Replace file</button> <button class="btn ghost sm" data-save>Save</button> <button class="btn sm" data-sendnow>Save & use →</button>`;
  c.innerHTML = `<div class="es-ed">
    <aside class="es-side"><label class="field"><span>Document name</span><input data-name value="${esc(t.name)}" maxlength="120"></label>
      <div class="es-h">Drag a field onto the page<small>or tap a field, then tap the page</small></div>
      <div class="es-pal">${Object.entries(TYPES).map(([k, v]) => `<button type="button" data-type="${k}" style="--c:${v.color}"><i>${v.ic}</i>${v.label}</button>`).join('')}</div>
      <div data-props class="es-props"></div>
      <label class="field" style="margin-top:14px"><span>Default email message</span><textarea data-msg rows="3" maxlength="2000" placeholder="Shown in the email and on the signing page">${esc(t.message || '')}</textarea></label>
      <p class="hint">Yellow fields are filled by the customer. Grey fields are filled by you when you send.</p>
    </aside>
    <div class="es-pages" data-pages>${t.pages.map((p, k) => `<div class="es-page" data-page="${k}" style="aspect-ratio:${p.w}/${p.h}"><img src="${esc(p.url)}" alt="Page ${k + 1}" draggable="false"><span class="es-pn">${k + 1} / ${t.pages.length}</span></div>`).join('')}</div></div>`;
  const pagesEl = $('[data-pages]', c), propsEl = $('[data-props]', c);
  const pageOf = k => $(`.es-page[data-page="${k}"]`, c);
  const dirty = () => { S.dirty = true; };
  const nid = () => Math.random().toString(36).slice(2, 12);
  const drawFields = () => {
    $$('.es-f', c).forEach(e => e.remove());
    for (const f of S.fields) {
      const pg = pageOf(f.page); if (!pg) continue;
      const el = document.createElement('div'); el.className = 'es-f' + (f.role === 'sender' ? ' us' : '') + (S.sel === f.id ? ' on' : '') + (f.type === 'checkbox' ? ' cb' : '');
      el.dataset.id = f.id; el.style.cssText = `left:${f.x * 100}%;top:${f.y * 100}%;width:${f.w * 100}%;height:${f.h * 100}%;--c:${TYPES[f.type].color}`;
      el.innerHTML = `<span>${f.type === 'checkbox' ? '' : esc(f.label || TYPES[f.type].label)}${f.required && f.type !== 'date' && f.role === 'signer' ? ' *' : ''}</span><i class="es-rs" title="Resize"></i>`;
      el.title = (f.label || TYPES[f.type].label) + (f.role === 'sender' ? ' — filled by you' : ' — filled by the customer');
      pg.appendChild(el);
    }
  };
  const drawProps = () => {
    const f = S.fields.find(x => x.id === S.sel);
    if (!f) { propsEl.innerHTML = `<p class="hint">${S.fields.length} field${S.fields.length === 1 ? '' : 's'} placed. Select a field to change it.</p>`; return; }
    const canUs = ['text', 'checkbox', 'date', 'name', 'email'].includes(f.type);
    propsEl.innerHTML = `<div class="es-ph"><b style="color:${TYPES[f.type].color}">${TYPES[f.type].label}</b> <small>page ${f.page + 1}</small></div>
      <label class="field"><span>Label / hint</span><input data-p="label" value="${esc(f.label)}" placeholder="${esc(TYPES[f.type].label)}" maxlength="80"></label>
      ${f.role === 'sender' ? `<label class="field"><span>Section in the information form</span><input data-p="group" value="${esc(f.group || '')}" maxlength="60" placeholder="e.g. Customer & vehicle" list="es-groups"><datalist id="es-groups">${[...new Set(S.fields.map(x => x.group).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('')}</datalist></label>` : ''}
      ${canUs ? `<label class="field"><span>Filled by</span><select data-p="role"><option value="signer">Customer (when signing)</option><option value="sender">Me (when sending)</option></select></label>` : ''}
      ${f.role === 'sender' ? (f.type === 'checkbox' ? `<label class="es-check"><input type="checkbox" data-p="value" ${f.value === '1' ? 'checked' : ''}> Checked by default</label>` : `<label class="field"><span>Default value</span><input data-p="value" value="${esc(f.value)}" maxlength="500" placeholder="${f.type === 'date' ? 'Today, if empty' : 'Optional'}"></label>`)
        : f.type !== 'date' ? `<label class="es-check"><input type="checkbox" data-p="required" ${f.required ? 'checked' : ''}> Required</label>` : '<p class="hint">Filled in automatically with the date the customer signs.</p>'}
      <div class="row-actions" style="margin-top:12px"><button class="btn ghost sm" data-dup>Duplicate</button><button class="btn ghost sm danger" data-del>Delete</button></div>`;
    $$('[data-p]', propsEl).forEach(i => { const ev = i.type === 'checkbox' || i.tagName === 'SELECT' ? 'onchange' : 'oninput'; if (i.tagName === 'SELECT') i.value = f[i.dataset.p];
      i[ev] = () => { const k = i.dataset.p; f[k] = i.type === 'checkbox' ? (k === 'value' ? (i.checked ? '1' : '') : i.checked) : i.value; dirty(); drawFields(); if (k === 'role') drawProps(); }; });
    $('[data-del]', propsEl).onclick = () => { S.fields = S.fields.filter(x => x !== f); S.sel = null; dirty(); drawFields(); drawProps(); };
    $('[data-dup]', propsEl).onclick = () => { const n = { ...f, id: nid(), y: Math.min(1 - f.h, f.y + f.h + .01) }; S.fields.push(n); S.sel = n.id; dirty(); drawFields(); drawProps(); };
  };
  const addField = (type, page, cx, cy) => { // cx, cy = fraction of the page (centre)
    const p = t.pages[page], [wp, hp] = TYPES[type].pt, w = wp / p.w, h = hp / p.h;
    const f = { id: nid(), type, page, x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - h, cy - h / 2)), w, h, label: '', required: type !== 'checkbox', role: 'signer', value: '' };
    S.fields.push(f); S.sel = f.id; S.arm = null; armUI(); dirty(); drawFields(); drawProps();
  };
  const armUI = () => { $$('[data-type]', c).forEach(b => b.classList.toggle('on', b.dataset.type === S.arm)); pagesEl.classList.toggle('arming', !!S.arm); };
  const pagePoint = (x, y) => { for (const pg of $$('.es-page', c)) { const r = pg.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { page: +pg.dataset.page, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height }; } return null; };
  // palette: drag (pointer) or tap-to-arm
  $$('[data-type]', c).forEach(b => b.onpointerdown = e => {
    e.preventDefault(); const type = b.dataset.type, sx = e.clientX, sy = e.clientY; let ghost = null; document.body.style.userSelect = 'none';
    const mv = ev => { if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { ghost = document.createElement('div'); ghost.className = 'es-ghost'; ghost.style.setProperty('--c', TYPES[type].color); ghost.textContent = TYPES[type].label; document.body.appendChild(ghost); }
      if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; } };
    const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); document.body.style.userSelect = '';
      if (ghost) { ghost.remove(); const p = pagePoint(ev.clientX, ev.clientY); if (p) addField(type, p.page, p.fx, p.fy); }
      else { S.arm = S.arm === type ? null : type; armUI(); if (S.arm) A().toast('Now tap the page where it goes'); } };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  // fields: select / move / resize; page tap places an armed field
  pagesEl.onpointerdown = e => {
    const fe = e.target.closest('.es-f');
    if (!fe) { if (S.arm) { const p = pagePoint(e.clientX, e.clientY); if (p) addField(S.arm, p.page, p.fx, p.fy); } else if (S.sel) { S.sel = null; drawFields(); drawProps(); } return; }
    e.preventDefault();
    const f = S.fields.find(x => x.id === fe.dataset.id); S.sel = f.id; $$('.es-f.on', c).forEach(x => x.classList.remove('on')); fe.classList.add('on'); drawProps();
    const pg = fe.parentElement, r = pg.getBoundingClientRect(), resize = e.target.classList.contains('es-rs');
    const sx = e.clientX, sy = e.clientY, o = { ...f }; let moved = false;
    const mv = ev => { const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height; if (Math.abs(dx) + Math.abs(dy) > .002) moved = true;
      if (resize) { f.w = Math.max(.015, Math.min(1 - f.x, o.w + dx)); f.h = Math.max(.01, Math.min(1 - f.y, o.h + dy)); if (f.type === 'checkbox') { const s = Math.max(f.w * r.width, f.h * r.height); f.w = s / r.width; f.h = s / r.height; } }
      else { f.x = Math.max(0, Math.min(1 - f.w, o.x + dx)); f.y = Math.max(0, Math.min(1 - f.h, o.y + dy)); }
      fe.style.left = f.x * 100 + '%'; fe.style.top = f.y * 100 + '%'; fe.style.width = f.w * 100 + '%'; fe.style.height = f.h * 100 + '%'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) dirty(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  const keys = e => {
    if (!document.body.contains(pagesEl)) { removeEventListener('keydown', keys); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    const f = S.fields.find(x => x.id === S.sel); if (!f) { if (e.key === 'Escape' && S.arm) { S.arm = null; armUI(); } return; }
    const st = e.shiftKey ? .01 : .002;
    if (e.key === 'Delete' || e.key === 'Backspace') { S.fields = S.fields.filter(x => x !== f); S.sel = null; }
    else if (e.key.startsWith('Arrow')) { if (e.key === 'ArrowLeft') f.x = Math.max(0, f.x - st); if (e.key === 'ArrowRight') f.x = Math.min(1 - f.w, f.x + st); if (e.key === 'ArrowUp') f.y = Math.max(0, f.y - st); if (e.key === 'ArrowDown') f.y = Math.min(1 - f.h, f.y + st); }
    else if (e.key === 'Escape') S.sel = null; else return;
    e.preventDefault(); dirty(); drawFields(); drawProps();
  };
  addEventListener('keydown', keys);
  const save = async () => {
    const r = await A().api('/esign/template', { id: t.id, name: $('[data-name]', c).value.trim(), message: $('[data-msg]', c).value, fields: S.fields });
    t = { ...t, ...r.template }; S.fields = r.template.fields.map(f => ({ ...f })); S.dirty = false; drawFields(); drawProps(); return t;
  };
  $('[data-name]', c).oninput = dirty; $('[data-msg]', c).oninput = dirty;
  $('[data-save]').onclick = async () => { try { await save(); A().toast('Saved'); } catch (e) { A().toast(e.message); } };
  $('[data-sendnow]').onclick = async () => { try { await save(); S.dirty = false; A().go('/agreements/fill?id=' + t.id); } catch (e) { A().toast(e.message); } };
  $('[data-replace]').onclick = async () => {
    A().confirmBox('Replace the PDF?', 'Fields stay where they are (fields on pages that no longer exist are removed). Documents already sent are not changed.', async () => {
      try { if (S.dirty) await save(); const nt = await uploadFlow(t.kind, t.id); if (nt) editor(t.id); } catch (e) { A().toast(e.message); }
    }, { yesLabel: 'Choose new PDF' });
  };
  const guard = e => { if (!document.body.contains(pagesEl)) { removeEventListener('beforeunload', guard); return; } if (S.dirty) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', guard);
  drawFields(); drawProps();
  if (!S.fields.length) A().toast('Drag “Signature” and the other fields onto the page');
  if (sendAfter) A().go('/agreements/fill?id=' + t.id);
}

window.SatinEsign = { route };
})();
