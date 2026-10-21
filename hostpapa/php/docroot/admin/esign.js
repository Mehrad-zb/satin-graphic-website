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
const STATUS = { draft: ['Draft — not sent', 'es-draft'], sent: ['Awaiting signature', 'es-sent'], viewed: ['Viewed', 'es-viewed'], partial: ['Partially signed', 'es-partial'], signed: ['Signed', 'es-signed'], declined: ['Declined', 'es-declined'], cancelled: ['Cancelled', 'es-cancelled'], superseded: ['Superseded', 'es-cancelled'] };
const SSTATUS = { pending: ['Not sent', 'es-draft'], sent: ['Sent', 'es-sent'], viewed: ['Viewed', 'es-viewed'], signed: ['Signed', 'es-signed'], declined: ['Declined', 'es-declined'] };
const pill = s => `<span class="pill ${(STATUS[s] || [])[1] || ''}">${esc((STATUS[s] || [s])[0])}</span>`;
const spill = s => `<span class="pill ${(SSTATUS[s] || [])[1] || ''}">${esc((SSTATUS[s] || [s])[0])}</span>`;
const COLORS = ['#e6007e', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4b5563', '#65a30d', '#9333ea'];
const scol = sid => COLORS[(parseInt(String(sid).slice(1), 10) - 1) % COLORS.length] || COLORS[0];
const isOpen = d => ['sent', 'viewed', 'partial'].includes(d.status);
const signedCount = d => (d.signers || []).filter(x => x.status === 'signed').length;
const PROLE = { price: /agreed project price/i, start: /project start deposit|design fee/i, prod: /production deposit/i, tax: /applicable tax/i, total: /total project amount/i, after: /total after tax/i, balance: /final balance/i };
const PRNAME = { price: 'Agreed project price (before tax)', start: 'Project start deposit', prod: '50% production deposit', tax: 'Applicable tax', total: 'Total project amount', after: 'Total after tax', balance: 'Final balance due' };
const priceFields = fields => { const o = {}; for (const f of fields) if (f.role === 'sender' && f.type === 'text') for (const [r, re] of Object.entries(PROLE)) if (!o[r] && re.test(f.label || '')) { o[r] = f; break; } return o.price ? o : {}; };
const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return Number.isFinite(n) ? n : null; };
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const cad = n => n == null ? '' : '$' + r2(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CUST_RE = /customer name|full name|first name|last name|^name$|company|phone|mobile|e-?mail|address|vehicle|make|model|year|colou?r|licen[cs]e|plate|\bvin\b|pick-?up/i;
const intakeIds = fields => { const pr = new Set(Object.values(priceFields(fields)).map(x => x.id)); return new Set(fields.filter(f => ['text', 'name', 'email'].includes(f.type) && !pr.has(f.id) && !(f.role === 'signer' && (f.signer || 's1') !== 's1') && CUST_RE.test(f.label || (f.type === 'email' ? 'Email' : f.type === 'name' ? 'Full name' : ''))).map(f => f.id)); };
const steps = (n, d, auto) => `<ol class="es-steps">${(auto || d && d.auto ? ['Information', 'Documents & signatures', 'Send to customer'] : ['Information', 'Signature positions', 'Review & send']).map((t, k) => `<li class="${k + 1 === n ? 'on' : k + 1 < n ? 'done' : ''}">${d && k + 1 !== n && d.status === 'draft' ? `<a href="#/agreements/${['fill', 'place', 'ready'][k]}?doc=${d.id}">` : '<span>'}<i>${k + 1}</i>${t}${d && k + 1 !== n && d.status === 'draft' ? '</a>' : '</span>'}</li>`).join('')}</ol>`;
let DATA = null, TAB = 'docs', FILTER = { q: '', status: '' };
const fmt = s => A().fmtDate(s);
const toTop = () => { scrollTo(0, 0); document.body.scrollTop = 0; }; // phones: the admin scrolls the body, not the window
const copy = async (t, msg) => { try { await navigator.clipboard.writeText(t); A().toast(msg || 'Link copied'); } catch { prompt('Copy this link', t); } };

async function route(path, params) {
  if (path === '/agreements/template') return editor(params.get('id'), params.get('send') === '1');
  if (path === '/agreements/fill') return fillPage(params.get('id'), params.get('doc'), params.get('auto') === '1', params.get('form') === '1');
  if (path === '/agreements/ready') return readyPage(params.get('doc'));
  if (path === '/agreements/place') return placePage(params.get('doc'));
  return list(params);
}

/* ---------------- list ---------------- */
async function list(params) {
  if (params && params.get('tab')) TAB = params.get('tab') === 'templates' ? 'templates' : 'docs';
  const c = A().shell('Agreements (e-sign)', 'Business', '<div class="card empty">Loading…</div>', '/agreements');
  const canSend = A().can('agreements.send');
  $('[data-actions]').innerHTML = canSend ? '<button class="btn ghost sm" data-new>+ Upload new agreement</button> <button class="btn ghost sm" data-oneoff>Sign a one-off PDF</button> <button class="btn ghost sm" data-send>+ Create agreement (manual)</button> <button class="btn sm" data-auto>+ Automated agreement</button>' : '';
  if (canSend) {
    $('[data-new]').onclick = () => uploadFlow('template');
    $('[data-oneoff]').onclick = () => uploadFlow('oneoff');
    $('[data-send]').onclick = () => pickTemplate();
    $('[data-auto]').onclick = () => pickTemplate(true);
  }
  try { DATA = await A().api('/esign'); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  if (canSend) { const acts = $('[data-actions]'); acts.insertAdjacentHTML('afterbegin', DATA.templates.filter(t => t.linkOn && t.linkUrl).map(t => `<button class="btn sm" data-ql="${t.id}">${esc(t.name.replace(/^Vehicle Wrap /, ''))} link</button> `).join('')); $$('[data-ql]', acts).forEach(b => b.onclick = () => linkModal(DATA.templates.find(x => x.id === b.dataset.ql))); }
  const waiting = DATA.docs.filter(isOpen).length;
  c.innerHTML = `<div class="grid g4 tiles es-tiles">
      <button type="button" class="card stat link es-tile" data-go="sent"><small>Awaiting signature</small><b>${waiting}</b></button>
      <button type="button" class="card stat link es-tile" data-go="signed30"><small>Signed (30 days)</small><b>${DATA.docs.filter(d => d.status === 'signed' && Date.now() - new Date(d.signedAt) < 30 * 864e5).length}</b></button>
      <button type="button" class="card stat link es-tile" data-go="all"><small>All documents</small><b>${DATA.docs.length}</b></button>
      <button type="button" class="card stat link es-tile" data-go="templates"><small>Templates</small><b>${DATA.templates.length}</b></button></div>
    <div class="tabs" role="tablist"><button data-tab="docs" class="${TAB === 'docs' ? 'on' : ''}">Documents</button><button data-tab="templates" class="${TAB === 'templates' ? 'on' : ''}">Templates</button></div><div data-body></div>`;
  $$('[data-tab]', c).forEach(b => b.onclick = () => { TAB = b.dataset.tab; $$('[data-tab]', c).forEach(x => x.classList.toggle('on', x === b)); body(); });
  $$('[data-go]', c).forEach(b => b.onclick = () => { const g = b.dataset.go; TAB = g === 'templates' ? 'templates' : 'docs'; if (g !== 'templates') { FILTER.status = g === 'all' ? '' : g; FILTER.q = ''; }
    $$('[data-tab]', c).forEach(x => x.classList.toggle('on', x.dataset.tab === TAB)); body(); $('[data-body]', c).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const body = () => TAB === 'docs' ? docsTab($('[data-body]', c)) : templatesTab($('[data-body]', c));
  body();
}
function docsTab(box) {
  box.innerHTML = `<div class="toolbar"><input class="input" data-q placeholder="Search document, name or email" value="${esc(FILTER.q)}">
    <select class="input" data-st><option value="">All statuses</option>${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}<option value="signed30">Signed in the last 30 days</option></select></div><div data-list></div>`;
  $('[data-st]', box).value = FILTER.status;
  const draw = () => {
    const w = FILTER.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = DATA.docs.filter(d => (!FILTER.status || d.status === FILTER.status || FILTER.status === 'sent' && isOpen(d) || FILTER.status === 'signed30' && d.status === 'signed' && Date.now() - new Date(d.signedAt) < 30 * 864e5) && w.every(x => [d.title, d.number, ...(d.signers || []).flatMap(s => [s.name, s.email])].join(' ').toLowerCase().includes(x)));
    $('[data-list]', box).innerHTML = rows.length ? `<table class="table has-acts"><thead><tr><th>Document</th><th>Signer</th><th>Sent</th><th>Status</th><th class="act"><span class="sr">Actions</span></th></tr></thead><tbody>${rows.map(d => `
      <tr class="click" data-doc="${esc(d.id)}"><td><b>${esc(d.title)}</b><small>#${d.number}${d.version > 1 ? ' · version ' + d.version : ''}${d.via === 'public' ? ' · via public link' : ''}${d.auto ? ' · automated' : ''}</small>${d.auto && d.auto.intake === 'pending' && isOpen(d) ? '<small class="es-warn">Waiting for the customer’s details</small>' : ''}</td><td>${d.signers.length > 1 ? `${d.signers.map(s => `<span class="es-who"><i style="--c:${scol(s.sid)}"></i>${esc(s.name)}${s.status === 'signed' ? ' ✓' : ''}</span>`).join('')}` : `${esc(d.signerName)}<small>${esc(d.signerEmail)}</small>`}</td>
      <td>${esc(d.sentAt ? fmt(d.sentAt) : 'Not sent')}</td><td>${pill(d.status)}${d.status === 'signed' ? `<small>${esc(fmt(d.signedAt))}</small>` : d.signers.length > 1 && isOpen(d) ? `<small>${signedCount(d)} of ${d.signers.length} signed</small>` : d.viewedAt && d.status === 'viewed' ? `<small>Opened ${esc(fmt(d.viewedAt))}</small>` : ''}</td>
      <td class="act"><button type="button" class="rowmenu" data-dmenu="${esc(d.id)}" aria-label="Actions">⋯</button></td></tr>`).join('')}</tbody></table>`
      : `<div class="card empty">${DATA.docs.length ? 'No documents match.' : 'No documents yet. Create a template from your agreement PDF, then press <b>Create agreement</b>.'}</div>`;
    $$('tr[data-doc]', box).forEach(tr => tr.onclick = e => { if (e.target.closest('.act')) return; A().go('/agreements/ready?doc=' + tr.dataset.doc); });
    $$('[data-dmenu]', box).forEach(b => b.onclick = e => { e.stopPropagation(); docMenu(b, DATA.docs.find(d => d.id === b.dataset.dmenu)); });
  };
  $('[data-q]', box).oninput = e => { FILTER.q = e.target.value; draw(); };
  $('[data-st]', box).onchange = e => { FILTER.status = e.target.value; draw(); };
  draw();
}
function docMenu(btn, d) {
  const send = A().can('agreements.send'), open = isOpen(d);
  const items = [['view', 'Details, signers & versions']];
  if (d.status === 'signed') items.push(['pdf', 'Download signed PDF']);
  if (send && !d.superseded && d.status !== 'cancelled') items.push(['edit', d.status === 'draft' ? 'Continue editing' : 'Edit & resend']);
  if (open && send && d.signers.length === 1) items.push(['copy', 'Copy signing link']);
  if (open && send) items.push(['remind', d.signers.length > 1 ? 'Remind everyone who hasn’t signed' : 'Send reminder email'], ['cancel', 'Cancel document']);
  if (d.status === 'draft' && send) items.push(['cancel', 'Cancel draft']);
  if (send) items.push(['delete', 'Delete', 'danger']);
  A().popMenu(btn, items, k => docAction(k, d));
}
async function docAction(k, d, after) {
  const done = after || (() => list());
  if (k === 'view') return docModal(d.id);
  if (k === 'pdf') { location.href = '/api/admin/esign/pdf?id=' + d.id + '&dl=1'; return; }
  if (k === 'edit') return A().go('/agreements/fill?doc=' + d.id);
  if (k === 'copy') return copy(d.url, 'Signing link copied');
  if (k === 'remind') { try { const r = await A().api('/esign/doc/remind', { id: d.id }); A().toast(r.count > 1 ? `Reminder sent to ${r.count} signers` : 'Reminder sent'); done(); } catch (e) { A().toast(e.message); } return; }
  if (k === 'cancel') return A().confirmBox('Cancel this document?', `${d.signers.map(s => s.name).join(', ')} will no longer be able to sign "${d.title}". The links stop working.`, async () => { try { await A().api('/esign/doc/cancel', { id: d.id }); A().toast('Document cancelled'); done(); } catch (e) { A().toast(e.message); } }, { yesLabel: 'Cancel document', danger: true });
  if (k === 'delete') return A().confirmBox('Delete this document?', `"${d.title}"${d.version > 1 ? ' (version ' + d.version + ')' : ''} and its audit trail are removed permanently.${d.status === 'signed' ? ' Keep a copy of the signed PDF first.' : ''}${d.version > 1 ? ' Earlier versions are kept.' : ''}`, async () => { try { await A().api('/esign/doc/delete', { id: d.id }); A().toast('Deleted'); done(); } catch (e) { A().toast(e.message); } }, { yesLabel: 'Delete', danger: true, ...(d.status === 'signed' ? { typeWord: 'delete' } : {}) });
}
const signerRows = (d, acts) => `<div class="es-signers">${d.signers.map(s => `<div class="es-srow"><i class="es-dot" style="--c:${scol(s.sid)}"></i><div class="es-sname"><b>${esc(s.name)}</b><small>${esc(s.email || 'No email — share the link')}</small><small>${esc([s.sentAt ? 'Sent ' + fmt(s.sentAt) : '', s.viewedAt ? 'Viewed ' + fmt(s.viewedAt) : '', s.signedAt ? 'Signed ' + fmt(s.signedAt) : ''].filter(Boolean).join(' · '))}</small>${s.declineReason ? `<small class="err">Declined: ${esc(s.declineReason)}</small>` : ''}</div><div class="es-sact">${spill(s.status)}${acts && isOpen(d) && s.status !== 'signed' ? `<button class="btn ghost sm" data-scp="${s.sid}">Copy link</button><button class="btn ghost sm" data-ssend="${s.sid}">${s.email ? 'Email again' : 'Add email & send'}</button>` : ''}</div></div>`).join('')}</div>`;
function bindSigners(box, d, after) {
  $$('[data-scp]', box).forEach(b => b.onclick = () => copy(d.signers.find(s => s.sid === b.dataset.scp).url, 'Link for ' + d.signers.find(s => s.sid === b.dataset.scp).name + ' copied'));
  $$('[data-ssend]', box).forEach(b => b.onclick = async () => {
    const s = d.signers.find(x => x.sid === b.dataset.ssend); let email = s.email;
    if (!email) { email = (prompt('Email address for ' + s.name) || '').trim(); if (!email) return; }
    b.disabled = true;
    try { await A().api('/esign/doc/send', { id: d.id, sid: s.sid, email }); A().toast('Signing link emailed to ' + email); after && after(); } catch (e) { A().toast(e.message); b.disabled = false; }
  });
}
async function docModal(id) {
  const o = A().modal('<div class="empty">Loading…</div>'); o.querySelector('.modal').classList.add('es-wide');
  let d; try { d = (await A().api('/esign/doc?id=' + encodeURIComponent(id))).doc; } catch (e) { o.querySelector('.modal').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const open = isOpen(d), send = A().can('agreements.send');
  o.querySelector('.modal').innerHTML = `<header><h2>${esc(d.title)}</h2><button class="x" data-close>×</button></header>
    <p style="margin:-6px 0 14px">${pill(d.status)} <span class="hint">#${d.number} · version ${d.version}${d.superseded ? ' (superseded)' : ''}${d.signers.length > 1 ? ` · ${signedCount(d)} of ${d.signers.length} signed` : ''}</span></p>
    <div class="row-actions" style="margin-bottom:16px">${d.status === 'signed' ? `<a class="btn sm" href="/api/admin/esign/pdf?id=${d.id}&dl=1">Download signed PDF</a><a class="btn ghost sm" href="/api/admin/esign/pdf?id=${d.id}" target="_blank" rel="noopener">View PDF</a>` : ''}
      <a class="btn ghost sm" href="#/agreements/ready?doc=${d.id}" data-close>Open</a>${send && !d.superseded && d.status !== 'cancelled' ? `<a class="btn ghost sm" href="#/agreements/fill?doc=${d.id}" data-close>${d.status === 'draft' ? 'Continue editing' : 'Edit & resend'}</a>` : ''}${open && send ? `<button class="btn ghost sm" data-a="remind">Remind</button><button class="btn ghost sm" data-a="cancel">Cancel</button>` : ''}</div>
    ${d.declineReason ? `<div class="err warnbox">Declined: ${esc(d.declineReason)}</div>` : ''}
    <h3 class="es-h3">Signers</h3>${signerRows(d, send)}
    ${d.approval ? `<p class="hint">Approval Form: ${esc(d.approval.name)} · ${d.approval.pages} page${d.approval.pages === 1 ? '' : 's'}</p>` : ''}
    ${d.changes ? `<p class="hint"><b>Changes in this version:</b> ${esc(d.changes)}</p>` : ''}
    ${d.versions.length > 1 ? `<h3 class="es-h3">Versions</h3><table class="table es-vers"><thead><tr><th>Version</th><th>Created</th><th>Sent</th><th>Status</th></tr></thead><tbody>${d.versions.map(v => `<tr class="${v.id === d.id ? 'cur' : 'click'}" data-ver="${v.id}"><td><b>v${v.version}</b>${v.superseded ? '' : ' <small>current</small>'}${v.changes ? `<small>${esc(v.changes)}</small>` : ''}</td><td>${esc(fmt(v.createdAt))}</td><td>${esc(v.sentAt ? fmt(v.sentAt) : '—')}</td><td>${pill(v.status)}${v.status === 'signed' ? ` <a href="/api/admin/esign/pdf?id=${v.id}&dl=1" class="hint">PDF</a>` : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <h3 class="es-h3">Audit trail</h3><ol class="es-timeline">${d.events.map(e => `<li><b>${esc(e.event[0].toUpperCase() + e.event.slice(1))}</b> <span class="hint" style="margin:0">${esc(fmt(e.at))}</span><div>${esc(e.detail)}</div><small>${esc([e.actor && !e.detail.includes(e.actor) ? 'By ' + e.actor : '', e.ip ? 'IP ' + e.ip : ''].filter(Boolean).join(' · '))}</small></li>`).join('')}</ol>
    ${d.finalHash ? `<p class="hint" style="word-break:break-all">Signed PDF SHA-256: ${esc(d.finalHash)}</p>` : ''}${d.originalHash ? `<p class="hint" style="word-break:break-all">Original document SHA-256: ${esc(d.originalHash)}</p>` : ''}`;
  $$('[data-a]', o).forEach(b => b.onclick = () => docAction(b.dataset.a, d, () => { o.remove(); list(); }));
  bindSigners(o, d, () => { o.remove(); docModal(d.id); });
  $$('tr[data-ver]', o).forEach(tr => tr.onclick = e => { if (e.target.closest('a') || tr.dataset.ver === d.id) return; o.remove(); docModal(tr.dataset.ver); });
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
function pickTemplate(auto) {
  if (!DATA.templates.length) { A().toast('Create a template first (or use “Sign a one-off PDF”).'); return; }
  const o = A().modal(`<header><h2>${auto ? 'Automated agreement' : 'Create agreement'}</h2><button class="x" data-close>×</button></header><p class="hint" style="margin-top:-6px">${auto ? 'You enter the price, materials and dates. The customer gets a link, fills in their own details and vehicles on a form, then signs once at the end.' : 'Choose the agreement template'}</p>
    <div class="es-pick">${DATA.templates.map(t => `<button type="button" data-p="${t.id}">${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : ''}<span><b>${esc(t.name)}</b><small>${t.pageCount} page${t.pageCount === 1 ? '' : 's'} · ${t.fieldCount} fields</small></span></button>`).join('')}</div>`);
  $$('[data-p]', o).forEach(b => b.onclick = () => { o.remove(); const t = DATA.templates.find(x => x.id === b.dataset.p); if (t && t.linkOn && t.linkUrl) return linkModal(t); A().go('/agreements/fill?id=' + b.dataset.p + (auto ? '&auto=1' : '')); });
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
// saved vehicles of a customer (filled in by the customer on an agreement's details form)
const custVehicles = x => { try { const v = typeof x.vehicles === 'string' ? JSON.parse(x.vehicles || '[]') : x.vehicles; return Array.isArray(v) ? v : []; } catch { return []; } };
const vehKey = l => /make/i.test(l) && /model/i.test(l) ? 'makeModel' : /make/i.test(l) ? 'make' : /model/i.test(l) ? 'model' : /year/i.test(l) ? 'year' : /colou?r/i.test(l) ? 'colour' : /licen[cs]e|plate/i.test(l) ? 'plate' : /\bvin\b/i.test(l) ? 'vin' : '';
// templates with an active public link (e.g. the Design Agreement): no form for us — copy the link and send it
const linkPanelHTML = t => `<div class="card"><h2 style="margin-top:0">${esc(t.name)}</h2>
  <p class="hint" style="margin-top:-4px">Send this link to the customer — nothing to fill in here. They enter their own details, review the agreement and sign. Each customer who uses the link gets a <b>new agreement number</b>; the signed PDF is emailed to them and to you, it appears in your Agreements list, and their details are saved in Customers.</p>
  <div class="es-link" style="margin-top:12px"><input class="input" readonly value="${esc(t.linkUrl)}"><button type="button" class="btn sm" data-cp>Copy link</button></div>
  <p class="hint" style="margin-top:10px"><a href="${esc(t.linkUrl)}" target="_blank" rel="noopener">Open the link</a> · <a href="https://wa.me/?text=${encodeURIComponent('Please fill in your details and sign the ' + t.name + ' here: ' + t.linkUrl)}" target="_blank" rel="noopener">Send by WhatsApp</a> · <a href="#/agreements/fill?id=${t.id}&form=1">Prepare a custom one instead</a></p></div>`;
function linkModal(t) { const o = A().modal(`<header><h2>Send ${esc(t.name)}</h2><button class="x" data-close>×</button></header>${linkPanelHTML(t)}`); $('[data-cp]', o).onclick = () => copy(t.linkUrl); $$('a[href^="#/"]', o).forEach(a => a.addEventListener('click', () => o.remove())); }
async function fillPage(id, docId, auto, form) { toTop();
  const c = A().shell(docId ? 'Edit agreement' : auto ? 'Automated agreement' : 'Create agreement', '<a href="#/agreements">Agreements</a>', '<div class="card empty">Loading…</div>', '/agreements');
  let t, doc = null;
  try { if (docId) { doc = (await A().api('/esign/doc?id=' + encodeURIComponent(docId))).doc; id = doc.templateId; } t = await getTpl(id); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  auto = !!(auto || doc && doc.auto);
  if (doc && (doc.superseded || doc.status === 'cancelled')) { c.innerHTML = `<div class="card">This is ${doc.superseded ? 'an older version' : 'a cancelled document'} and can't be edited. <a href="#/agreements">Back to agreements</a></div>`; return; }
  $('[data-actions]').innerHTML = `<a class="btn ghost sm" href="${doc ? '#/agreements/ready?doc=' + doc.id : '#/agreements'}">← Back</a> <a class="btn ghost sm es-hide-m" href="#/agreements/template?id=${t.id}">Edit template fields</a>`;
  if (!doc && !form && t.linkOn && t.linkUrl) { const pick = DATA && DATA.templates.length > 1 ? `<div class="card"><label class="field" style="margin:0"><span>Agreement template</span><select class="input" data-tpl>${DATA.templates.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label></div>` : '';
    c.innerHTML = pick + linkPanelHTML(t); $('[data-cp]', c).onclick = () => copy(t.linkUrl);
    const tp = $('[data-tpl]', c); if (tp) tp.onchange = () => A().go('/agreements/fill?id=' + tp.value + (auto ? '&auto=1' : '')); return; }
  const revising = doc && doc.status !== 'draft';
  const extra = doc ? doc.signers.slice(1).map(s => ({ name: s.name, email: s.email })) : [];
  const pre = doc ? doc.prefill || {} : null;
  const INTAKE = auto ? intakeIds(t.fields) : new Set(); // automated: the customer fills these in on their details form
  const ours = t.fields.filter(f => f.role === 'sender' && !INTAKE.has(f.id)), theirsText = t.fields.filter(f => f.role === 'signer' && f.type === 'text' && !INTAKE.has(f.id)), custF = t.fields.filter(f => INTAKE.has(f.id));
  const groups = []; const gi = {};
  for (const f of ours) { const g = f.group || (f.type === 'checkbox' ? 'Options' : 'Details'); if (!(g in gi)) { gi[g] = groups.length; groups.push([g, []]); } groups[gi[g]][1].push(f); }
  const PR = priceFields(t.fields), hasPR = !!PR.price, PRIDS = new Set(Object.values(PR).map(x => x.id));
  const plain = fl => !PRIDS.has(fl.id) && !(hasPR && fl.type === 'checkbox' && /free design promotion|standard design fee/i.test(fl.label || '')); // design is included free: the old design-fee checkboxes are not used
  const CALC = [['prod', '(Price − start deposit) × 50%'], ['tax', '13% HST on the agreed price'], ['total', 'Same as the agreed price'], ['after', 'Total project amount + tax'], ['balance', 'After tax − start deposit − production deposit']].filter(([r]) => PR[r]);
  const pricingHTML = () => `<div class="es-pr">
      <div class="es-fgrid"><label class="field"><span>${PRNAME.price}</span><input data-pr="price" data-v="${PR.price.id}" inputmode="decimal" placeholder="$0.00"></label>
      ${PR.start ? `<label class="field"><span>${PRNAME.start}</span><input data-pr="start" data-v="${PR.start.id}" inputmode="decimal" placeholder="$250.00"><small class="hint">Credited toward the total project price — not an extra charge</small></label>` : ''}</div>
      <div class="es-prrow"><label class="es-check" style="margin:0"><input type="checkbox" data-hst> Apply HST (13%, Ontario)</label><span class="es-free">✓ Professional Design Included — FREE</span></div>
      <div class="es-calc">${CALC.map(([r, h]) => `<div class="es-crow" data-row="${r}"><div class="es-cl"><b>${PRNAME[r]}</b><small>${h}</small></div><input data-pr="${r}" data-v="${PR[r].id}" inputmode="decimal" aria-label="${PRNAME[r]}"><span class="es-tag" data-tag="${r}"></span><button type="button" class="linkbtn es-rst" data-reset="${r}" hidden>Reset to auto</button></div>`).join('')}</div>
      <div class="es-prwarn" data-prwarn hidden></div>
      <div class="es-prconf"><span class="es-prstate" data-prstate></span><span class="es-pract"><button type="button" class="btn ghost sm" data-recalc>Recalculate all</button><button type="button" class="btn sm" data-confirm>Confirm pricing</button></span></div>
    </div>`;
  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  const val = f => pre ? (pre[f.id] ?? '') : f.type === 'date' && !f.value ? today : f.value;
  const input = f => f.type === 'checkbox' ? `<label class="es-check es-cbf"><input type="checkbox" data-v="${f.id}" ${val(f) === '1' ? 'checked' : ''}> ${esc(f.label || 'Checkbox')}</label>`
    : `<label class="field"><span>${esc(f.label || TYPES[f.type].label)}</span><input data-v="${f.id}" value="${esc(val(f))}" ${f.type === 'email' ? 'type="email" inputmode="email"' : /phone/i.test(f.label) ? 'type="tel" inputmode="tel"' : ''}></label>`;
  const signs = t.fields.filter(f => f.role === 'signer').reduce((a, f) => (a[f.type] = (a[f.type] || 0) + 1, a), {});
  const pickTpl = !docId && DATA && DATA.templates.length > 1 ? `<label class="field" style="margin-bottom:14px"><span>Agreement template</span><select class="input" data-tpl>${DATA.templates.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : '';
  c.innerHTML = `${steps(1, doc, auto)}<form class="es-fill" data-f novalidate>
    ${revising ? `<div class="card es-note"><b>Edit & resend — version ${doc.version + 1}</b><p>Version ${doc.version} was sent${doc.sentAt ? ' ' + esc(fmt(doc.sentAt)) : ''}${doc.status === 'signed' ? ' and is signed' : doc.status === 'partial' ? ' and is partly signed' : ''}. Your changes make a new version: every signer signs it again, and when you send it the links to version ${doc.version} stop working. Version ${doc.version} stays in the history unchanged.</p></div>` : ''}
    <div class="card">${pickTpl}<h2 style="margin-top:0">${esc(t.name)}</h2>${auto ? `<p class="hint" style="margin-top:-4px"><b>Automated agreement.</b> Enter the job details (price, materials, dates…). Next you add the Approval Form and any other PDF and choose their order. The customer then gets a link: they fill in their own details and vehicles (they can add more than one vehicle), review the agreement and sign once at the end — no initials on each page.</p>` : `<p class="hint" style="margin-top:-4px">Fill in what you know — every field is optional. Next you'll see the finished PDF and can email it or copy the link. The customer only ${[signs.signature ? 'signs' : '', signs.initials ? 'initials each page' : ''].filter(Boolean).join(' and ') || 'reviews'}${theirsText.length ? ' and completes ' + theirsText.length + ' field' + (theirsText.length === 1 ? '' : 's') : ''}.</p>`}
      <div class="es-fgrid"><div class="field es-cust"><span>Customer name</span><div class="es-cust-row"><input name="custname" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Type to search your customers" value="${esc(doc && doc.signerName !== 'Customer' ? doc.signerName : '')}" role="combobox" aria-expanded="false" aria-autocomplete="list"><button type="button" class="btn ghost sm" data-addcust>+ Add customer</button></div><div class="es-sug" data-sug hidden role="listbox"></div></div><label class="field"><span>Customer email</span><input name="email" type="email" inputmode="email" value="${esc(doc ? doc.signerEmail : '')}"></label></div>
      <div class="es-who-sign"><div class="es-count"><span>How many people need to sign this document?</span><div class="es-stepper"><button type="button" data-dec aria-label="One signer fewer">−</button><input data-count type="number" min="1" max="10" inputmode="numeric" aria-label="Number of signers"><button type="button" data-inc aria-label="One more signer">+</button></div></div>
        <p class="hint" style="margin:6px 0 0">The customer above is signer 1. Each signer gets their own email link and signs once, only in their own fields.</p><div data-extra></div></div></div>
    ${groups.map(([g, all]) => { const fs = all.filter(plain); const pr = hasPR && all.includes(PR.price); return `<div class="card"${pr ? ' data-pricing' : ''}><h3 class="es-h3" style="margin-top:0">${esc(g)}</h3>${pr ? pricingHTML() : ''}${fs.some(f => f.type !== 'checkbox') ? `<div class="es-fgrid">${fs.filter(f => f.type !== 'checkbox').map(input).join('')}</div>` : ''}${fs.some(f => f.type === 'checkbox') ? `<div class="es-cbs">${fs.filter(f => f.type === 'checkbox').map(input).join('')}</div>` : ''}</div>`; }).join('')}
    ${custF.length ? `<details class="card es-custf"${doc && doc.auto && doc.auto.intake === 'done' ? ' open' : ''}><summary><b>Customer details & vehicle</b> <small class="hint">${doc && doc.auto && doc.auto.intake === 'done' ? '— entered by the customer; you can correct them' : '— the customer fills these in on their form (optional: pre-fill what you know)'}</small></summary><div class="es-fgrid" style="margin-top:12px">${custF.map(f => `<label class="field"><span>${esc(f.label || TYPES[f.type].label)}</span><input data-v="${f.id}" value="${esc(pre ? pre[f.id] || '' : '')}" ${f.type === 'email' || /e-?mail/i.test(f.label) ? 'type="email" inputmode="email"' : /phone/i.test(f.label) ? 'type="tel" inputmode="tel"' : ''}></label>`).join('')}</div>${doc && doc.auto && doc.auto.vehicles > 1 ? `<p class="hint">${doc.auto.vehicles - 1} more vehicle${doc.auto.vehicles > 2 ? 's are' : ' is'} on Schedule A.</p>` : ''}</details>` : ''}
    ${theirsText.length ? `<div class="card"><h3 class="es-h3" style="margin-top:0">Customer fields <small class="hint">(optional — the customer can change them)</small></h3><div class="es-fgrid">${theirsText.map(f => `<label class="field"><span>${esc(f.label || 'Text')}</span><input data-v="${f.id}" value="${esc(pre ? pre[f.id] || '' : '')}"></label>`).join('')}</div></div>` : ''}
    <div class="card"><label class="field"><span>Message to the customer (optional)</span><textarea name="message" rows="3">${esc(doc ? doc.message : t.message || '')}</textarea></label>
      <div class="err" data-err></div><div class="es-fill-go"><button class="btn" data-go>${auto ? 'Next: documents & Approval Form →' : 'Next: signature positions →'}</button></div></div></form>`;
  const f = $('[data-f]', c);
  // Pricing & payment: suggested amounts fill in as you type; any amount can be typed over (kept until "Reset to auto"); staff confirm the shown amounts
  const PS = { manual: { ...((doc && doc.pricing && doc.pricing.manual) || {}) }, conf: null };
  const pin = r => $(`[data-pr="${r}"]`, c);
  const prVals = () => { const o = {}; for (const r of Object.keys(PR)) o[r] = pin(r).value.trim(); return o; };
  const sameVals = (a, b) => !!a && Object.keys(PR).every(r => (a[r] || '') === (b[r] || ''));
  const recalc = () => {
    if (!hasPR) return;
    const P = num(pin('price').value), S = PR.start ? num(pin('start').value) || 0 : 0, hst = $('[data-hst]', c).checked;
    const shown = r => PS.manual[r] ? num(pin(r).value) : null, auto = {};
    if (P != null) {
      auto.prod = r2((P - S) * .5); auto.tax = hst ? r2(P * .13) : 0; auto.total = P;
      const tot = shown('total') ?? auto.total, tax = shown('tax') ?? auto.tax; auto.after = r2(tot + tax);
      const after = shown('after') ?? auto.after, prod = shown('prod') ?? auto.prod; auto.balance = r2(after - S - prod);
    }
    for (const [r] of CALC) { if (!PS.manual[r]) pin(r).value = P == null ? '' : cad(auto[r]);
      const t = $(`[data-tag="${r}"]`, c); t.textContent = PS.manual[r] ? 'Manually adjusted' : 'Auto'; t.className = 'es-tag ' + (PS.manual[r] ? 'man' : 'auto'); $(`[data-reset="${r}"]`, c).hidden = !PS.manual[r]; }
    // non-blocking checks on the amounts that are shown
    const w = [], v = r => PR[r] ? num(pin(r).value) : null, diff = (a, b) => a != null && b != null && Math.abs(a - b) > .005;
    if (P != null) {
      if (PS.manual.total && diff(v('total'), P)) w.push(`Total project amount (${cad(v('total'))}) is not the agreed price (${cad(P)}).`);
      if (PS.manual.prod && diff(v('prod'), r2((P - S) * .5))) w.push(`Production deposit is not 50% of (price − start deposit) = ${cad(r2((P - S) * .5))}.`);
      if (PS.manual.tax && diff(v('tax'), hst ? r2(P * .13) : 0)) w.push(`Tax is not ${hst ? '13% HST = ' + cad(r2(P * .13)) : '$0.00 (HST is off)'}.`);
      if (PR.after && diff(v('after'), r2((v('total') ?? 0) + (v('tax') ?? 0)))) w.push(`Total after tax should be ${cad(r2((v('total') ?? 0) + (v('tax') ?? 0)))} (total + tax).`);
      if (PR.balance && diff(v('balance'), r2((v('after') ?? 0) - S - (v('prod') ?? 0)))) w.push(`Final balance due should be ${cad(r2((v('after') ?? 0) - S - (v('prod') ?? 0)))} (after tax − start deposit − production deposit).`);
    }
    const wb = $('[data-prwarn]', c); wb.hidden = !w.length; wb.innerHTML = w.length ? `<b>These amounts don't add up</b><ul>${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul><small>You can still confirm them if that is intended.</small>` : '';
    prState();
  };
  const prState = () => { const st = $('[data-prstate]', c); const empty = !Object.entries(prVals()).some(([r, x]) => r !== 'start' && x);
    if (empty) { st.className = 'es-prstate'; st.textContent = 'Enter the agreed price to calculate the payments.'; return; }
    const ok = sameVals(PS.conf, prVals()); st.className = 'es-prstate ' + (ok ? 'ok' : PS.conf ? 'again' : 'no');
    st.textContent = ok ? '✓ Pricing confirmed — these amounts go on the agreement' : PS.conf ? 'Needs reconfirmation — an amount changed' : 'Not confirmed yet';
    $('[data-confirm]', c).textContent = ok ? 'Confirmed ✓' : 'Confirm pricing'; };
  if (hasPR) {
    for (const r of Object.keys(PR)) pin(r).value = val(PR[r]) || '';
    if (PR.start && !pre && !num(pin('start').value)) pin('start').value = '$250.00';
    const hb = $('[data-hst]', c), tv = num(pin('tax') && pin('tax').value);
    hb.checked = doc && doc.pricing && doc.pricing.hst != null ? doc.pricing.hst : !(doc && tv === 0 && num(pin('price').value));
    if (doc && !(doc.pricing && doc.pricing.hst != null)) { // agreements made before this: amounts that differ from the suggestion count as manual
      const keep = prVals(); recalc(); for (const [r] of CALC) if (keep[r] && num(keep[r]) !== num(pin(r).value)) { PS.manual[r] = true; pin(r).value = keep[r]; } }
    if (doc && doc.pricing && doc.pricing.confirmed && !revising) PS.conf = prVals(); // Edit & Resend: the pricing is confirmed again before resending
    $$('[data-pr]', c).forEach(i => { i.addEventListener('input', () => { if (CALC.some(([r]) => r === i.dataset.pr)) PS.manual[i.dataset.pr] = true; recalc(); });
      i.addEventListener('blur', () => { const n = num(i.value); if (n != null && i.value.trim() !== cad(n)) { i.value = cad(n); recalc(); } }); });
    hb.onchange = recalc;
    $$('[data-reset]', c).forEach(b => b.onclick = () => { delete PS.manual[b.dataset.reset]; recalc(); });
    $('[data-recalc]', c).onclick = () => { PS.manual = {}; recalc(); A().toast('All payment amounts recalculated'); };
    $('[data-confirm]', c).onclick = () => { recalc(); PS.conf = prVals(); prState(); A().toast('Pricing confirmed'); };
    recalc();
  }
  // signers 2…N (signer 1 is the customer above)
  const exBox = $('[data-extra]', c), cnt = $('[data-count]', c);
  const drawExtra = () => { cnt.value = extra.length + 1;
    exBox.innerHTML = extra.map((x, k) => `<div class="es-xs"><i class="es-dot" style="--c:${scol('s' + (k + 2))}"></i><b>Signer ${k + 2}</b><label class="field"><span>Name</span><input data-xn="${k}" value="${esc(x.name)}" autocomplete="off" placeholder="Full name"></label><label class="field"><span>Email</span><input data-xe="${k}" type="email" inputmode="email" value="${esc(x.email)}" placeholder="name@email.com"></label><button type="button" class="btn ghost sm" data-xr="${k}" aria-label="Remove signer ${k + 2}">Remove</button></div>`).join('') + (extra.length < 9 ? '<button type="button" class="btn ghost sm" data-xadd>+ Add signer</button>' : '');
    $$('[data-xn]', exBox).forEach(i => i.oninput = () => { extra[+i.dataset.xn].name = i.value; });
    $$('[data-xe]', exBox).forEach(i => i.oninput = () => { extra[+i.dataset.xe].email = i.value; });
    $$('[data-xr]', exBox).forEach(b => b.onclick = () => { extra.splice(+b.dataset.xr, 1); drawExtra(); });
    const ad = $('[data-xadd]', exBox); if (ad) ad.onclick = () => { extra.push({ name: '', email: '' }); drawExtra(); $(`[data-xn="${extra.length - 1}"]`, exBox).focus(); }; };
  const setCount = n => { n = Math.max(1, Math.min(10, n | 0)); while (extra.length + 1 < n) extra.push({ name: '', email: '' }); extra.length = n - 1; drawExtra(); };
  $('[data-dec]', c).onclick = () => setCount(extra.length); $('[data-inc]', c).onclick = () => setCount(extra.length + 2);
  cnt.onchange = () => setCount(+cnt.value || 1);
  drawExtra();
  const tp = $('[data-tpl]', c); if (tp) tp.onchange = () => A().go('/agreements/fill?id=' + tp.value + (auto ? '&auto=1' : ''));
  // customer: search your customer list (Invoices → Customers) or add a new one; picking one fills name, email, phone, company, address
  const useCustomer = x => { f.custname.value = x.name || ''; if (x.email) f.email.value = x.email; f.custname.dataset.cust = x.id || '';
    for (const fl of [...ours, ...theirsText, ...custF]) { const el = $(`[data-v="${fl.id}"]`, c); if (!el || el.type === 'checkbox') continue; const L = (fl.label || '').toLowerCase();
      const v = /company/.test(L) ? x.company : /phone/.test(L) ? x.phone : /e-?mail/.test(L) ? x.email : /first name/.test(L) ? (x.name || '').split(' ')[0] : /last name/.test(L) ? (x.name || '').split(' ').slice(1).join(' ') : /customer name|full name|^name/.test(L) ? x.name : /address/.test(L) ? x.address : '';
      if (v && (!el.value || el.dataset.auto)) { el.value = v; el.dataset.auto = 1; } }
    const V = custVehicles(x)[0]; if (V) { const mm = V.makeModel || [V.make, V.model].filter(Boolean).join(' ');
      for (const fl of [...ours, ...theirsText, ...custF]) { const el = $(`[data-v="${fl.id}"]`, c); const L = fl.label || ''; if (!el || el.type === 'checkbox' || !/vehicle|make|model|year|colou?r|licen[cs]e|plate|\bvin\b/i.test(L) || /company|e-?mail|phone|address|pick-?up/i.test(L)) continue;
        const k = vehKey(L), v = k === 'makeModel' ? mm : k === 'make' ? (V.make || mm.split(' ')[0] || '') : k === 'model' ? (V.model || mm.split(' ').slice(1).join(' ')) : (V[k] || '');
        if (v && (!el.value || el.dataset.auto)) { el.value = v; el.dataset.auto = 1; } } } };
  const sug = $('[data-sug]', c); let act = -1, shown = [];
  const closeSug = () => { sug.hidden = true; f.custname.setAttribute('aria-expanded', 'false'); act = -1; };
  const drawSug = () => { const q = f.custname.value.trim().toLowerCase(); if (!CUSTOMERS || !q) return closeSug();
    shown = CUSTOMERS.filter(x => [x.name, x.company, x.email, x.phone].join(' ').toLowerCase().includes(q)).slice(0, 8);
    sug.innerHTML = shown.map((x, k) => `<button type="button" role="option" data-k="${k}" class="${k === act ? 'on' : ''}"><b>${esc(x.name)}</b><small>${esc([x.company, x.email, x.phone, (v => v ? v.makeModel || [v.year, v.make, v.model].filter(Boolean).join(' ') : '')(custVehicles(x)[0])].filter(Boolean).join(' · '))}</small></button>`).join('') + `<button type="button" class="es-sug-add" data-new>+ Add “${esc(f.custname.value.trim())}” as a new customer</button>`;
    sug.hidden = false; f.custname.setAttribute('aria-expanded', 'true');
    $$('[data-k]', sug).forEach(b => b.onmousedown = e => { e.preventDefault(); useCustomer(shown[+b.dataset.k]); closeSug(); });
    $('[data-new]', sug).onmousedown = e => { e.preventDefault(); closeSug(); addCust(f.custname.value.trim()); }; };
  const addCust = name => A().customerModal({ name, email: f.email.value.trim() }, x => { CUSTOMERS = [x, ...(CUSTOMERS || [])]; useCustomer(x); });
  $('[data-addcust]', c).onclick = () => addCust(f.custname.value.trim());
  f.custname.addEventListener('input', drawSug); f.custname.addEventListener('blur', () => setTimeout(closeSug, 150));
  f.custname.addEventListener('keydown', e => { if (sug.hidden) return; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = (act + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length); drawSug(); } else if (e.key === 'Enter' && act >= 0) { e.preventDefault(); useCustomer(shown[act]); closeSug(); } else if (e.key === 'Escape') closeSug(); });
  if (A().can('invoices.view')) (async () => { try { CUSTOMERS = (await A().api('/customers')).customers || CUSTOMERS || []; } catch { CUSTOMERS = CUSTOMERS || []; } })(); // fresh each time: customers who just filled in a form show up
  const mirror = (re, from) => { for (const fl of [...ours, ...custF]) if (re.test(fl.label || '')) { const el = $(`[data-v="${fl.id}"]`, c); if (el && (!el.value || el.dataset.auto)) { el.value = from.value; el.dataset.auto = 1; } } };
  f.custname.addEventListener('input', () => mirror(/customer name|full name/i, f.custname));
  f.email.addEventListener('input', () => mirror(/email/i, f.email));
  f.onsubmit = async e => {
    e.preventDefault(); const go = $('[data-go]', c), err = $('[data-err]', c); err.textContent = '';
    const signers = [{ name: f.custname.value.trim(), email: f.email.value.trim() }, ...extra.map(x => ({ name: x.name.trim(), email: x.email.trim() }))];
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, seen = {};
    for (const [k, x] of signers.entries()) { // check before saving: valid, different emails
      const el = k ? $(`[data-xe="${k - 1}"]`, c) : f.email;
      if (k && !x.name) { err.textContent = `Enter the name of signer ${k + 1}.`; $(`[data-xn="${k - 1}"]`, c).focus(); return; }
      if (x.email && !re.test(x.email)) { err.textContent = `Signer ${k + 1}: the email address is not valid.`; el.focus(); return; }
      if (x.email && seen[x.email.toLowerCase()]) { err.textContent = `Signer ${k + 1}: ${x.email} is already signer ${seen[x.email.toLowerCase()]}. Each signer needs their own email.`; el.focus(); return; }
      if (x.email) seen[x.email.toLowerCase()] = k + 1;
    }
    if (hasPR && Object.entries(prVals()).some(([r, x]) => r !== 'start' && x) && !sameVals(PS.conf, prVals())) { err.textContent = 'Review the Pricing & payment amounts and press “Confirm pricing” first.'; $('[data-pricing]', c).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    go.disabled = true; go.textContent = 'Saving…';
    const prefill = {}; $$('[data-v]', c).forEach(i => { prefill[i.dataset.v] = i.type === 'checkbox' ? (i.checked ? '1' : '') : i.value.trim(); });
    try {
      const body = { signers, message: f.message.value, prefill, ...(hasPR ? { pricing: { hst: $('[data-hst]', c).checked, manual: PS.manual, confirmed: sameVals(PS.conf, prVals()), values: prVals() } } : {}) };
      const r = docId ? await A().api('/esign/doc/update', { id: docId, ...body }) : await A().api('/esign/send', { templateId: t.id, ...body, email: false, auto });
      if (revising) A().toast('Version ' + r.doc.version + ' created');
      A().go('/agreements/place?doc=' + r.doc.id);
    } catch (er) { err.textContent = er.message; go.disabled = false; go.textContent = auto ? 'Next: documents & Approval Form →' : 'Next: signature positions →'; }
  };
}
// Step 2: signature positions — each signer's signature (and date) on the agreement and on the optional Approval Form PDF.
async function placePage(docId) { toTop();
  const c = A().shell('Signature positions', '<a href="#/agreements">Agreements</a>', '<div class="card empty">Loading…</div>', '/agreements');
  let d; try { d = (await A().api('/esign/doc?id=' + encodeURIComponent(docId))).doc; } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  if (d.auto) { const h = document.querySelector('.crumb + h1'); if (h && /Signature positions/.test(h.textContent)) h.textContent = 'Documents & signatures'; }
  if (d.status !== 'draft') { c.innerHTML = `${steps(2, d)}<div class="card">This version was already sent, so its signature positions can't change. Use <a href="#/agreements/fill?doc=${d.id}">Edit & resend</a> to make a new version.</div>`; return; }
  const S = { fields: d.fields.map(f => ({ ...f })), sel: null, cur: 's1', arm: null, dirty: false };
  const mov = f => f.role === 'signer' && (f.type === 'signature' || f.type === 'date');
  const nm = sid => (d.signers.find(s => s.sid === sid) || {}).name || sid;
  const auto = !!d.auto;
  const partIdx = id => d.pages.map((p, k) => p.part === id ? k : -1).filter(k => k >= 0);
  const partName = id => (d.parts.find(x => x.id === id) || {}).name || 'Document';
  const pageLabel = k => { const p = d.pages[k], ix = partIdx(p.part); return (d.parts.length > 1 ? partName(p.part) + ' · ' : '') + (p.kind === 'addendum' ? 'Schedule A' : 'page ' + (ix.indexOf(k) + 1) + ' / ' + ix.length); };
  const sigOn = (sid, id) => S.fields.some(f => f.type === 'signature' && f.signer === sid && d.pages[f.page] && d.pages[f.page].part === id);
  const pageHTML = (p, k) => p.kind === 'addendum'
    ? `<div class="es-page es-addm" data-page="${k}" style="aspect-ratio:${p.w}/${p.h}"><div class="es-addin"><b>${esc(p.title)}</b>${(p.blocks || []).map(bk => `<h4>${esc(bk.title)}</h4><dl>${bk.items.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`).join('')}</div><span class="es-pn">${esc(pageLabel(k))}</span></div>`
    : `<div class="es-page" data-page="${k}" style="aspect-ratio:${p.w}/${p.h}"><img src="${esc(p.url)}" alt="Page ${k + 1}" draggable="false"><span class="es-pn">${esc(pageLabel(k))}</span></div>`;
  $('[data-actions]').innerHTML = `<a class="btn ghost sm" href="#/agreements/fill?doc=${d.id}">← Information</a> <button class="btn sm" data-next>Save & ${auto ? 'continue' : 'review'} →</button>`;
  const draw = () => {
    const docsCard = `<div class="es-apcard"><div class="es-h" style="margin-top:6px">Documents in this agreement <small>The customer sees them in this order. Drag ⠿ or use ↑ ↓ to change it. ${auto ? 'Add the Approval Form here — a signature is placed at the bottom of it automatically (drag it if needed).' : 'Attach an Approval Form or any other PDF the signers also sign; a signature is placed at the bottom automatically.'}</small></div>
      <ol class="es-docs" data-docs>${d.parts.map((p, i) => { const miss = p.id !== 'main' && d.signers.some(s => !sigOn(s.sid, p.id));
        return `<li draggable="true" data-part="${esc(p.id)}"><span class="es-grip" aria-hidden="true">⠿</span><span class="es-dn"><b>${i + 1}. ${esc(p.name)}</b><small>${p.pages} page${p.pages === 1 ? '' : 's'}${p.id === 'main' ? ' · the agreement' : miss ? ' · <em class="es-warn">signature missing</em>' : ' · signature placed ✓'}</small></span><span class="es-dacts"><button type="button" class="btn ghost sm" data-mv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" class="btn ghost sm" data-mv="1" ${i === d.parts.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>${p.id !== 'main' ? '<button type="button" class="rowmenu" data-pm aria-label="More">⋯</button>' : ''}</span></li>`; }).join('')}</ol>
      <button type="button" class="btn ${auto && d.parts.length < 2 ? '' : 'ghost '}sm" data-apup>+ Add ${auto && d.parts.length < 2 ? 'Approval Form' : 'document'} (PDF)</button></div>`;
    c.innerHTML = `${steps(2, d)}<div class="es-ed es-place">
    <aside class="es-side">
      ${auto ? docsCard : ''}
      <div class="es-h">Signers<small>Pick a signer, then drag their signature to where it belongs. Each signer signs once — the same signature fills all of their positions.</small></div>
      <div class="es-plist">${d.signers.map(s => { const n = S.fields.filter(f => f.type === 'signature' && f.signer === s.sid);
        return `<button type="button" class="es-psig ${S.cur === s.sid ? 'on' : ''}" data-cur="${s.sid}" style="--c:${scol(s.sid)}"><i class="es-dot"></i><span><b>${esc(s.name)}</b><small>${esc(s.email || (auto && s.sid === 's1' ? 'enters their details on the form' : 'no email yet'))}</small><small>${n.length} signature position${n.length === 1 ? '' : 's'}</small></span></button>`; }).join('')}</div>
      <div class="row-actions" style="margin:10px 0 4px"><button type="button" class="btn ghost sm" data-add="signature" style="--c:${scol(S.cur)}">+ Signature for ${esc(nm(S.cur).split(' ')[0])}</button><button type="button" class="btn ghost sm" data-add="date">+ Date</button></div>
      <div data-props class="es-props"></div>
      ${auto ? '' : docsCard}
      <div class="err" data-err></div>
    </aside>
    <div class="es-pages" data-pages>${d.pages.map((p, k) => `${d.parts.length > 1 && (k === 0 || d.pages[k - 1].part !== p.part) ? `<div class="es-apsep">${esc(partName(p.part))}</div>` : ''}${pageHTML(p, k)}`).join('')}</div></div>`;
    bind(); drawFields(); drawProps();
  };
  const pageOf = k => $(`.es-page[data-page="${k}"]`, c);
  const drawFields = () => {
    $$('.es-f', c).forEach(e => e.remove());
    for (const f of S.fields) {
      const pg = pageOf(f.page); if (!pg) continue;
      const el = document.createElement('div'); const m = mov(f);
      el.className = 'es-f' + (m ? '' : ' es-fixed') + (S.sel === f.id ? ' on' : '') + (f.type === 'checkbox' ? ' cb' : '');
      el.dataset.id = f.id; el.style.cssText = `left:${f.x * 100}%;top:${f.y * 100}%;width:${f.w * 100}%;height:${f.h * 100}%;--c:${m ? scol(f.signer) : '#94a3b8'}`;
      el.innerHTML = m ? `<span>${f.type === 'date' ? 'Date' : 'Signature'} — ${esc(nm(f.signer))}</span><i class="es-rs" title="Resize"></i>` : '';
      el.title = m ? `${f.type === 'date' ? 'Date signed' : 'Signature'} of ${nm(f.signer)} — drag to move` : (f.label || f.type);
      pg.appendChild(el);
    }
  };
  const drawProps = () => {
    const box = $('[data-props]', c), f = S.fields.find(x => x.id === S.sel);
    if (!f) { box.innerHTML = '<p class="hint">Tip: tap a signature box to change whose it is or to remove it. Grey boxes are the other fields of the agreement.</p>'; return; }
    box.innerHTML = `<div class="es-ph"><b style="color:${scol(f.signer)}">${f.type === 'date' ? 'Date signed' : 'Signature'}</b> <small>${esc(pageLabel(f.page))}</small></div>
      <label class="field"><span>Signer</span><select data-who>${d.signers.map(s => `<option value="${s.sid}" ${s.sid === f.signer ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <button type="button" class="btn ghost sm danger" data-del>Remove this ${f.type === 'date' ? 'date' : 'signature'}</button>`;
    $('[data-who]', box).onchange = e => { f.signer = e.target.value; S.dirty = true; drawFields(); drawProps(); side(); };
    $('[data-del]', box).onclick = () => { S.fields = S.fields.filter(x => x !== f); S.sel = null; S.dirty = true; drawFields(); drawProps(); side(); };
  };
  const side = () => { const y = scrollY, top = document.body.scrollTop; draw(); scrollTo(0, y); document.body.scrollTop = top; };
  const nid = () => Math.random().toString(36).slice(2, 12);
  const addAt = (type, page, cx, cy) => {
    const p = d.pages[page], [wp, hp] = TYPES[type].pt, w = wp / p.w, h = hp / p.h;
    const f = { id: nid(), type, page, x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - h, cy - h / 2)), w, h, label: type === 'date' ? 'Date signed' : 'Signature', required: type === 'signature', role: 'signer', signer: S.cur, value: '' };
    S.fields.push(f); S.sel = f.id; S.arm = null; S.dirty = true; side();
  };
  const pagePoint = (x, y) => { for (const pg of $$('.es-page', c)) { const r = pg.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { page: +pg.dataset.page, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height }; } return null; };
  const bind = () => {
    $$('[data-cur]', c).forEach(b => b.onclick = () => { S.cur = b.dataset.cur; const f = S.fields.find(x => x.type === 'signature' && x.signer === S.cur); S.sel = f ? f.id : null; side(); if (f) pageOf(f.page).scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    $$('[data-add]', c).forEach(b => b.onpointerdown = e => { // drag onto a page, or tap then tap the page
      e.preventDefault(); const type = b.dataset.add, sx = e.clientX, sy = e.clientY; let ghost = null;
      const mv = ev => { if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { ghost = document.createElement('div'); ghost.className = 'es-ghost'; ghost.style.setProperty('--c', scol(S.cur)); ghost.textContent = (type === 'date' ? 'Date — ' : 'Signature — ') + nm(S.cur); document.body.appendChild(ghost); } if (ghost) { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; } };
      const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
        if (ghost) { ghost.remove(); const p = pagePoint(ev.clientX, ev.clientY); if (p) addAt(type, p.page, p.fx, p.fy); }
        else { S.arm = type; $('[data-pages]', c).classList.add('arming'); A().toast('Now tap the page where it goes'); } };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    const pagesEl = $('[data-pages]', c);
    pagesEl.onpointerdown = e => {
      const fe = e.target.closest('.es-f');
      if (!fe || fe.classList.contains('es-fixed')) { if (S.arm) { const p = pagePoint(e.clientX, e.clientY); if (p) addAt(S.arm, p.page, p.fx, p.fy); } else if (S.sel) { S.sel = null; drawFields(); drawProps(); } return; }
      e.preventDefault();
      const f = S.fields.find(x => x.id === fe.dataset.id); S.sel = f.id; $$('.es-f.on', c).forEach(x => x.classList.remove('on')); fe.classList.add('on'); drawProps();
      const pg = fe.parentElement, r = pg.getBoundingClientRect(), resize = e.target.classList.contains('es-rs'), sx = e.clientX, sy = e.clientY, o = { ...f }; let moved = false;
      const mv = ev => { const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height; if (Math.abs(dx) + Math.abs(dy) > .002) moved = true;
        if (resize) { f.w = Math.max(.03, Math.min(1 - f.x, o.w + dx)); f.h = Math.max(.012, Math.min(1 - f.y, o.h + dy)); }
        else { f.x = Math.max(0, Math.min(1 - f.w, o.x + dx)); f.y = Math.max(0, Math.min(1 - f.h, o.y + dy)); }
        fe.style.left = f.x * 100 + '%'; fe.style.top = f.y * 100 + '%'; fe.style.width = f.w * 100 + '%'; fe.style.height = f.h * 100 + '%'; };
      const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (!moved) return; S.dirty = true;
        const p = pagePoint(ev.clientX, ev.clientY); // dropped on another page: move it there
        if (!resize && p && p.page !== f.page) { f.page = p.page; f.x = Math.max(0, Math.min(1 - f.w, p.fx - f.w / 2)); f.y = Math.max(0, Math.min(1 - f.h, p.fy - f.h / 2)); side(); } };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    $('[data-apup]', c).onclick = () => approvalUpload();
    // documents: order (drag or ↑ ↓) and per-document menu
    const order = d.parts.map(p => p.id);
    const setOrder = async ids => { if (ids.join() === order.join()) return; try { if (S.dirty) await save(true); d = (await A().api('/esign/doc/order', { id: d.id, order: ids })).doc; S.fields = d.fields.map(f => ({ ...f })); S.dirty = false; side(); A().toast('Order saved'); } catch (e) { A().toast(e.message); } };
    $$('[data-docs] li', c).forEach(li => {
      const id = li.dataset.part, i = order.indexOf(id);
      $$('[data-mv]', li).forEach(b => b.onclick = () => { const o = [...order], j = i + +b.dataset.mv; [o[i], o[j]] = [o[j], o[i]]; setOrder(o); });
      li.ondragstart = e => { e.dataTransfer.setData('text/plain', id); li.classList.add('drag'); };
      li.ondragend = () => li.classList.remove('drag');
      li.ondragover = e => { e.preventDefault(); li.classList.add('over'); };
      li.ondragleave = () => li.classList.remove('over');
      li.ondrop = e => { e.preventDefault(); li.classList.remove('over'); const from = e.dataTransfer.getData('text/plain'); if (!from || from === id) return; const o = order.filter(x => x !== from); o.splice(o.indexOf(id) + (order.indexOf(from) < i ? 1 : 0), 0, from); setOrder(o); };
      const pm = $('[data-pm]', li); if (pm) pm.onclick = () => A().popMenu(pm, [['show', 'Show pages'], ['replace', 'Replace PDF'], ['remove', 'Remove', 'danger']], async k => {
        if (k === 'show') return pageOf(partIdx(id)[0]).scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (k === 'replace') return approvalUpload(id);
        A().confirmBox('Remove “' + partName(id) + '”?', 'Its pages and the signature positions on them are removed from this agreement.', async () => {
          try { if (S.dirty) await save(true); const fd = new FormData(); fd.append('id', d.id); fd.append('remove', id); d = (await A().apiForm('/esign/doc/approval', fd)).doc; S.fields = d.fields.map(f => ({ ...f })); S.dirty = false; side(); A().toast('Document removed'); } catch (e) { A().toast(e.message); } }, { yesLabel: 'Remove', danger: true });
      });
    });
  };
  const approvalUpload = async replace => {
    const file = await pickFile('application/pdf,.pdf,image/jpeg,image/png'); if (!file) return;
    if (file.size > 30e6) { A().toast('The file is larger than 30 MB.'); return; }
    const o = A().modal(`<header><h2>${replace ? 'Replacing ' + esc(partName(replace)) + '…' : 'Adding the document…'}</h2></header><p data-p style="color:var(--mut)">Reading ${esc(file.name)}…</p><div class="es-bar"><i data-b></i></div>`); o.onclick = null;
    try {
      if (S.dirty) await save(true);
      const pages = await renderPages(file, (n, t) => { $('[data-p]', o).textContent = `Page ${n} of ${t}…`; $('[data-b]', o).style.width = n / t * 80 + '%'; }, 2200);
      $('[data-p]', o).textContent = 'Uploading…'; $('[data-b]', o).style.width = '90%';
      const fd = new FormData(); fd.append('id', d.id); fd.append('name', file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Approval Form');
      if (replace) fd.append('replace', replace);
      fd.append('meta', JSON.stringify(pages.map(p => ({ w: p.w, h: p.h })))); pages.forEach((p, k) => fd.append('page' + k, p.blob, 'a' + k + '.jpg'));
      d = (await A().apiForm('/esign/doc/approval', fd)).doc; o.remove();
      S.fields = d.fields.map(f => ({ ...f })); S.dirty = false; draw();
      const added = replace || d.parts.filter(p => p.id !== 'main').map(p => p.id).find(id => !order0.includes(id)); order0 = d.parts.map(p => p.id);
      A().toast('Document added — the signature is placed at the bottom of its last page');
      const ix = added ? partIdx(added) : []; if (ix.length) requestAnimationFrame(() => pageOf(ix[ix.length - 1]).scrollIntoView({ behavior: 'smooth', block: 'end' }));
    } catch (e) { o.querySelector('.modal').innerHTML = `<header><h2>Could not add the file</h2><button class="x" data-close>×</button></header><div class="err">${esc(e.message)}</div><div class="confirm-acts"><button class="btn" data-close>OK</button></div>`; o.onclick = ev => { if (ev.target === o || ev.target.closest('[data-close]')) o.remove(); }; }
  };
  let order0 = d.parts.map(p => p.id);
  const save = async quiet => { d = (await A().api('/esign/doc/layout', { id: d.id, fields: S.fields })).doc; if (!quiet) { S.fields = d.fields.map(f => ({ ...f })); } S.dirty = false; };
  $('[data-next]').onclick = async () => {
    const miss = d.signers.filter(s => !S.fields.some(f => f.type === 'signature' && f.signer === s.sid));
    const gap = d.parts.filter(p => p.id !== 'main').map(p => [p, d.signers.filter(s => !sigOn(s.sid, p.id))]).find(([, m]) => m.length);
    const ap = gap ? partIdx(gap[0].id)[0] : -1, missAp = gap ? gap[1] : [];
    const err = $('[data-err]', c);
    if (miss.length) { err.textContent = 'Add a signature position for ' + miss.map(s => s.name).join(', ') + '.'; return; }
    if (missAp.length) { err.textContent = 'Place the signature of ' + missAp.map(s => s.name).join(', ') + ' on “' + gap[0].name + '”.'; pageOf(ap).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    try { await save(); A().go('/agreements/ready?doc=' + d.id); } catch (e) { err.textContent = e.message; }
  };
  const guard = e => { if (!document.body.contains(c) || !$('[data-pages]', c)) { removeEventListener('beforeunload', guard); return; } if (S.dirty) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', guard);
  draw();
}
// Step 3: the finished PDF with everything filled in, then send it to every signer (each gets their own link).
async function readyPage(docId) { toTop();
  const c = A().shell('Review & send', '<a href="#/agreements">Agreements</a>', '<div class="card empty">Loading…</div>', '/agreements');
  let d; try { d = (await A().api('/esign/doc?id=' + encodeURIComponent(docId))).doc; } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const open = isOpen(d), draft = d.status === 'draft', send = A().can('agreements.send');
  const latest = d.versions.find(v => !v.superseded) || d.versions[0];
  $('[data-actions]').innerHTML = `<a class="btn ghost sm" href="#/agreements">← Agreements</a>`;
  const pdf = d.status === 'signed' ? `/api/admin/esign/pdf?id=${d.id}` : `/api/admin/esign/draft?id=${d.id}`;
  c.innerHTML = `${draft ? steps(3, d) : ''}${d.superseded ? `<div class="card es-note">This is version ${d.version}. It was replaced by version ${latest.version}${d.status === 'signed' ? '; this signed copy stays unchanged' : ' and its links no longer work'}. <a href="#/agreements/ready?doc=${latest.id}">Open version ${latest.version}</a></div>` : ''}<div class="es-ready">
    <div class="card es-prev"><div class="es-prev-h"><b>${esc(d.title)}${d.version > 1 ? ' · v' + d.version : ''}</b> ${pill(d.status)}</div><div class="es-pdfpages" data-pdfpages><div class="empty">Loading the PDF…</div></div><p class="hint es-prev-m"><a href="${pdf}" target="_blank" rel="noopener">Open the PDF in a new tab</a></p></div>
    <div class="es-side2">
      ${draft && send ? `<div class="card"><h3 class="es-h3" style="margin-top:0">Send for signatures</h3>
        <p class="hint" style="margin-top:-4px">${d.auto ? 'The customer opens the link, fills in their details and vehicles (they can add more vehicles), then sees the agreement — documents in your order — and signs once at the end. The preview shows the customer fields empty until they fill them in.' : d.signers.length > 1 ? `Each of the ${d.signers.length} signers gets their own link and signs only their own fields.` : 'The signer gets a link to review and sign.'}${d.version > 1 ? ` Sending replaces version ${d.version - 1}: its links stop working.` : ''}</p>
        ${signerRows(d, false)}
        <button class="btn block" data-send>${d.auto ? 'Email the link to the customer' : 'Send for signatures'}</button>
        <button class="btn ghost block" data-links style="margin-top:8px">${d.auto ? 'Create the link — I’ll send it myself' : 'Create links — I’ll share them myself'}</button>
        <div class="err" data-err></div>
        <p class="hint"><a href="#/agreements/fill?doc=${d.id}">Change signers or information</a> · <a href="#/agreements/place?doc=${d.id}">${d.auto ? 'Documents & signatures' : 'Signature positions'}</a></p></div>`
      : `<div class="card"><h3 class="es-h3" style="margin-top:0">Signers ${d.signers.length > 1 ? `<small class="hint">${signedCount(d)} of ${d.signers.length} signed</small>` : ''}</h3>${signerRows(d, send && !d.superseded)}
        ${open ? `<p class="hint">Waiting for: ${esc(d.signers.filter(s => s.status !== 'signed').map(s => s.name).join(', '))}</p>${send ? '<button class="btn ghost sm" data-remind>Remind everyone who hasn’t signed</button>' : ''}` : d.status === 'signed' ? `<p>Fully signed ${esc(fmt(d.signedAt))}.</p>` : `<p>This agreement is ${esc((STATUS[d.status] || [d.status])[0]).toLowerCase()}.</p>`}</div>`}
      ${(() => { const pr = priceFields(d.fields); if (!pr.price) return ''; const pv = r => (d.prefill || {})[pr[r] && pr[r].id] || '';
        if (!Object.keys(pr).some(r => r !== 'start' && pv(r))) return '';
        return `<div class="card"><h3 class="es-h3" style="margin-top:0">Pricing & payment</h3><table class="es-prsum">${Object.keys(PRNAME).filter(r => pr[r]).map(r => `<tr><td>${PRNAME[r]}${(d.pricing && d.pricing.manual || {})[r] ? ' <small class="es-tag man">Manual</small>' : ''}</td><td>${esc(pv(r) || '—')}</td></tr>`).join('')}</table>
          <p class="es-prstate ${d.pricing && d.pricing.confirmed ? 'ok' : 'no'}" style="margin:10px 0 0">${d.pricing && d.pricing.confirmed ? '✓ Confirmed' + (d.pricing.confirmedBy ? ' by ' + esc(d.pricing.confirmedBy) : '') : 'Not confirmed — <a href="#/agreements/fill?doc=' + d.id + '">review & confirm</a>'}</p><p class="hint" style="margin:6px 0 0">Professional Design Included — FREE${d.pricing && d.pricing.hst === false ? ' · HST not applied' : ''}</p></div>`; })()}
      ${d.changes ? `<div class="card"><h3 class="es-h3" style="margin-top:0">Changes in version ${d.version}</h3><p class="hint" style="margin:0">${esc(d.changes)}</p></div>` : ''}
      <div class="card"><div class="row-actions"><a class="btn ghost sm" href="${pdf}&dl=1">Download PDF</a>${send && !d.superseded && !draft && d.status !== 'cancelled' ? `<a class="btn ghost sm" href="#/agreements/fill?doc=${d.id}">Edit & resend</a>` : ''}<button class="btn ghost sm" data-audit>Audit trail${d.versions.length > 1 ? ' & versions' : ''}</button></div></div>
    </div></div>`;
  requestAnimationFrame(toTop);
  bindSigners(c, d, () => readyPage(d.id));
  (async () => { // PDF preview drawn with pdf.js (phones can't show a PDF inside the page)
    const box = $('[data-pdfpages]', c);
    try { const lib = await pdfjs(); const buf = await (await fetch(pdf, { credentials: 'same-origin' })).arrayBuffer(); const doc = await lib.getDocument({ data: buf }).promise; box.innerHTML = '';
      for (let n = 1; n <= doc.numPages; n++) { if (!document.body.contains(box)) return; const pg = await doc.getPage(n), w = Math.min(1200, Math.max(600, box.clientWidth * (devicePixelRatio || 1))), vp1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: w / vp1.width });
        const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise; pg.cleanup();
        const im = new Image(); im.alt = 'Page ' + n; im.src = URL.createObjectURL(await toJpeg(cv, .88)); cv.width = cv.height = 0; box.appendChild(im); } // pages kept as images, not canvases: far less memory on phones
      doc.destroy(); }
    catch (e) { box.innerHTML = `<div class="empty">The preview could not load. <a href="${pdf}" target="_blank" rel="noopener">Open the PDF</a>.</div>`; }
  })();
  $('[data-audit]', c).onclick = () => docModal(d.id);
  const rm = $('[data-remind]', c); if (rm) rm.onclick = () => docAction('remind', d, () => readyPage(d.id));
  const go = async mode => { const err = $('[data-err]', c); err.textContent = ''; $$('[data-send],[data-links]', c).forEach(b => b.disabled = true);
    try { await A().api('/esign/doc/send', { id: d.id, mode }); A().toast(mode === 'link' ? 'Links ready — copy each signer’s link below' : d.signers.length > 1 ? `Sent to ${d.signers.length} signers` : 'Sent to ' + d.signers[0].email); readyPage(d.id); }
    catch (e) { err.innerHTML = esc(e.message) + (e.data && e.data.pricing ? ` <a href="#/agreements/fill?doc=${d.id}">Confirm the pricing</a>` : e.data && e.data.place ? ` <a href="#/agreements/place?doc=${d.id}">Set the positions</a>` : / email /i.test(e.message) && !/could not be sent/.test(e.message) ? ` <a href="#/agreements/fill?doc=${d.id}">Add the email</a>` : ''); $$('[data-send],[data-links]', c).forEach(b => b.disabled = false); if (/could not be sent/.test(e.message)) setTimeout(() => readyPage(d.id), 2500); } };
  const sb = $('[data-send]', c); if (sb) sb.onclick = () => go('email');
  const lb = $('[data-links]', c); if (lb) lb.onclick = () => go('link');
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
const toJpeg = (c, q = .86) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function renderPages(file, onProgress, maxW = 1700) {
  const pages = [];
  if (/\.docx$/i.test(file.name)) return docxPages(file, onProgress);
  if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    const lib = await pdfjs(); const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    if (doc.numPages > 40) throw new Error('This PDF has ' + doc.numPages + ' pages. The limit is 40.');
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress(n, doc.numPages);
      const pg = await doc.getPage(n), vp1 = pg.getViewport({ scale: 1 }), s = Math.min(maxW > 1700 ? 3.6 : 2.6, maxW / vp1.width), vp = pg.getViewport({ scale: s });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      pages.push({ w: vp1.width, h: vp1.height, blob: await toJpeg(c, maxW > 1700 ? .92 : .86) });
    }
  } else {
    const img = await createImageBitmap(file); const s = Math.min(1, maxW / img.width);
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
