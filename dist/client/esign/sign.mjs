/* Satin e-Sign — signer page. /esign/?t=TOKEN (link from the email) or /esign/?l=LINK (public template link: name + email first).
   API: /api/sign/… (hp/php/satin-new/esign.php). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const P = new URLSearchParams(location.search);
let TOKEN = P.get('t') || '', DOC = null;
const VALS = {};           // field id -> value (text / bool / {w,h,data,how,text,url})
const ADOPT = { signature: null, initials: null };
const PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

async function api(path, body) {
  const r = await fetch('/api/sign/' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || 'Something went wrong. Please try again.'); e.field = d.field; throw e; }
  return d;
}
const header = (title, sub) => { $('[data-title]').textContent = title; $('[data-sub]').textContent = sub || ''; document.title = title + ' · Review & sign'; };
const fail = (msg) => { $('[data-bar]').hidden = true; app.innerHTML = `<div class="card center"><h1>We couldn't open this document</h1><p>${esc(msg)}</p><p>Please contact Satin Graphic at <a href="tel:9056959147">905-695-9147</a> or <a href="mailto:info@satingraphic.ca">info@satingraphic.ca</a>.</p></div>`; header('Satin e-Sign'); };

/* ---------- public link: who is signing? ---------- */
async function startFromLink(l) {
  let t; try { t = await api('link?l=' + encodeURIComponent(l)); } catch (e) { return fail(e.message); }
  header(t.title, t.business);
  if (t.intake && t.intake.fields.length) return intakeForm(t, async (values, vehicles) => { const r = await api('start', { l, values, vehicles }); TOKEN = r.t; history.replaceState(null, '', '/esign/?t=' + TOKEN); load(); });
  app.innerHTML = `<div class="card"><h1>${esc(t.title)}</h1><p>${esc(t.business)} needs your signature on this document. Enter your details to begin — you'll get the signed PDF by email.</p>
    ${t.message ? `<div class="msg">${esc(t.message)}</div>` : ''}
    <form data-start novalidate><label class="f" for="nm">Full legal name</label><input class="input" id="nm" name="name" autocomplete="name" required>
    <label class="f" for="em">Email</label><input class="input" id="em" name="email" type="email" autocomplete="email" inputmode="email" required>
    <div class="err" data-err></div><button class="btn wide" style="margin-top:6px">Continue</button></form></div>`;
  const f = $('[data-start]');
  f.onsubmit = async e => {
    e.preventDefault(); const b = f.querySelector('button'); b.disabled = true; $('[data-err]').textContent = '';
    try { const r = await api('start', { l, name: f.name.value.trim(), email: f.email.value.trim() }); TOKEN = r.t; history.replaceState(null, '', '/esign/?t=' + TOKEN); load(); }
    catch (er) { $('[data-err]').textContent = er.message; b.disabled = false; }
  };
}

/* ---------- document ---------- */
async function load() {
  let r; try { r = await api('doc?t=' + encodeURIComponent(TOKEN)); } catch (e) { return fail(e.message); }
  DOC = r.doc; header(DOC.title, DOC.business);
  if (DOC.status === 'superseded') return closed(DOC.business + ' updated this document and sent a new version. Please use the newest link in your email — this one no longer works.');
  if (DOC.status === 'signed' || DOC.myStatus === 'signed') return done();
  if (DOC.status === 'cancelled') return closed('This document was cancelled by ' + DOC.business + '. If you think this is a mistake, please contact them.');
  if (DOC.status === 'declined') return closed(DOC.myStatus === 'declined' ? 'You declined to sign this document. ' + DOC.business + ' has been notified.' : 'This document was declined by another signer, so it can no longer be signed. ' + DOC.business + ' has been notified.');
  if (DOC.intake) return intakeForm(DOC, async (values, vehicles) => { const r = await api('intake', { t: TOKEN, values, vehicles }); DOC = r.doc; draw(); });
  draw();
}

/* ---------- automated agreements: step 1 — the customer's details and vehicles ---------- */
function intakeForm(src, submit) {
  const F = src.intake.fields, you = F.filter(f => f.group !== 'vehicle'), veh = F.filter(f => f.group === 'vehicle');
  const extra = []; // vehicles 2…N: {id: value}
  $('[data-bar]').hidden = true; $('[data-top-actions]').innerHTML = '';
  const inp = (f, v, attr) => `<label class="f">${esc(f.label)}${f.required ? ' <i class="rq">*</i>' : ''}<input class="input" ${attr} value="${esc(v || '')}" ${f.type === 'email' ? 'type="email" inputmode="email" autocomplete="email"' : f.type === 'tel' ? 'type="tel" inputmode="tel" autocomplete="tel"' : /first name/i.test(f.label) ? 'autocomplete="given-name"' : /last name/i.test(f.label) ? 'autocomplete="family-name"' : /name/i.test(f.label) && !/company|pick/i.test(f.label) ? 'autocomplete="name"' : /company/i.test(f.label) ? 'autocomplete="organization"' : ''} maxlength="200"></label>`;
  const vcard = (k, row) => `<div class="card vcard" data-veh="${k}"><div class="vh"><h2>Vehicle ${k + 2}</h2><button type="button" class="link" data-vrm="${k}">Remove</button></div><div class="g2">${veh.map(f => inp({ ...f, required: /make|model/i.test(f.label) }, row[f.id], `data-x="${k}" data-id="${f.id}"`)).join('')}</div></div>`;
  const drawX = () => { $('[data-extra]').innerHTML = extra.map((r, k) => vcard(k, r)).join('');
    $$('[data-x]').forEach(i => i.oninput = () => { extra[+i.dataset.x][i.dataset.id] = i.value; });
    $$('[data-vrm]').forEach(b => b.onclick = () => { extra.splice(+b.dataset.vrm, 1); drawX(); }); };
  app.innerHTML = `<ol class="isteps"><li class="on"><i>1</i>Your details</li><li><i>2</i>Review & sign</li></ol>
    <form data-in novalidate><div class="card"><h1>${esc(src.title)}</h1><p>Please fill in your details${veh.length ? ' and your vehicle information' : ''}. On the next step you'll see the agreement with your information and sign once at the end.</p>${src.message ? `<div class="msg">${esc(src.message)}</div>` : ''}</div>
    ${you.length ? `<div class="card"><h2>Your details</h2><div class="g2">${you.map(f => inp(f, f.value, `data-id="${f.id}"`)).join('')}</div></div>` : ''}
    ${veh.length ? `<div class="card"><h2>Vehicle 1</h2><div class="g2">${veh.map(f => inp(f, f.value, `data-id="${f.id}"`)).join('')}</div></div><div data-extra></div>
      <div class="card addv"><button type="button" class="btn ghost wide" data-addv>+ Add another vehicle (if required)</button><small>Only if this agreement covers more than one vehicle.</small></div>` : ''}
    <div class="card"><div class="err" data-err></div><button class="btn wide" data-go>Next: review & sign →</button></div></form>`;
  if (veh.length) $('[data-addv]').onclick = () => { if (extra.length >= 19) return; extra.push({}); drawX(); const l = $$('.vcard').pop(); l.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => l.querySelector('input').focus({ preventScroll: true }), 300); };
  const form = $('[data-in]'); scrollTo(0, 0);
  form.onsubmit = async e => {
    e.preventDefault(); const err = $('[data-err]'), go = $('[data-go]'); err.textContent = ''; $$('.input.bad').forEach(i => i.classList.remove('bad'));
    const values = {}; $$('[data-id]:not([data-x])', form).forEach(i => { values[i.dataset.id] = i.value.trim(); });
    const bad = (el, msg) => { err.textContent = msg; el.classList.add('bad'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus({ preventScroll: true }), 300); };
    for (const f of F) { const el = $(`[data-id="${f.id}"]:not([data-x])`, form); const v = values[f.id];
      if (f.required && !v) return bad(el, 'Please fill in: ' + f.label);
      if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return bad(el, 'Please enter a valid email address.'); }
    for (const [k, r] of extra.entries()) { if (!Object.values(r).some(x => (x || '').trim())) continue;
      for (const f of veh) if (/make|model/i.test(f.label) && !(r[f.id] || '').trim()) return bad($(`[data-x="${k}"][data-id="${f.id}"]`), `Vehicle ${k + 2}: please fill in ${f.label}.`); }
    go.disabled = true; go.textContent = 'Saving…';
    try { await submit(values, extra.map(r => Object.fromEntries(Object.entries(r).map(([a, b]) => [a, (b || '').trim()])))); }
    catch (er) { err.textContent = er.message; go.disabled = false; go.textContent = 'Next: review & sign →'; const el = er.field && $(`[data-id="${er.field}"]:not([data-x])`, form); if (el) bad(el, er.message); }
  };
}
function closed(msg) { $('[data-bar]').hidden = true; $('[data-top-actions]').innerHTML = ''; app.innerHTML = `<div class="card center"><h1>${esc(DOC.title)}</h1><p>${esc(msg)}</p></div>`; }

const mine = f => f.role === 'signer';
const needed = () => DOC.fields.filter(f => mine(f) && f.required && f.type !== 'date');
const isDone = f => { const v = VALS[f.id]; return f.type === 'checkbox' ? v === true : f.type === 'signature' || f.type === 'initials' ? !!(v && v.data) : f.type === 'date' ? true : typeof v === 'string' && v.trim() !== ''; };
function initialsOf(n) { return (n || '').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 3).join('').toUpperCase(); }

function draw() {
  const first = (DOC.signerName || '').split(' ')[0];
  $('[data-top-actions]').innerHTML = '<button class="link" data-decline>Decline</button>';
  $('[data-decline]').onclick = declineModal;
  for (const f of DOC.fields) if (mine(f)) {
    if (f.value !== undefined && f.value !== '' && VALS[f.id] === undefined && ['text', 'name', 'email'].includes(f.type)) VALS[f.id] = f.value;
    if (f.type === 'name' && VALS[f.id] === undefined) VALS[f.id] = DOC.signerName || '';
    if (f.type === 'email' && VALS[f.id] === undefined) VALS[f.id] = DOC.signerEmail || '';
    if (f.type === 'date') VALS[f.id] = DOC.today;
  }
  app.innerHTML = `${DOC.auto ? '<ol class="isteps"><li class="done"><i>✓</i>Your details</li><li class="on"><i>2</i>Review & sign</li></ol>' : ''}<div class="card intro"><div class="ic">✍</div><div><h1>Hi ${esc(first || 'there')}, please review and sign</h1><p>${DOC.auto ? `Here is <b>${esc(DOC.title)}</b> with your information. Please read it, then sign at the end (one signature is used everywhere it is needed) and press <b>Finish</b>.` : `${esc(DOC.business)} sent you <b>${esc(DOC.title)}</b>${DOC.version > 1 ? ' (updated version)' : ''}. Fill in the highlighted fields, then press <b>Finish</b>.`}</p>${DOC.others && DOC.others.length ? `<p class="others">Also signing: ${DOC.others.map(o => esc(o.name) + (o.signed ? ' ✓' : '')).join(', ')}. You only sign your own fields; theirs are shown greyed out.</p>` : ''}${DOC.message ? `<div class="msg">${esc(DOC.message)}</div>` : ''}</div></div>
    <div class="pages">${DOC.pages.map((p, k) => p.kind === 'addendum' ? `<div class="page addm" data-page="${k}" style="aspect-ratio:${p.w}/${p.h}"><div class="addin"><b>${esc(p.title)}</b>${(p.blocks || []).map(bk => `<h4>${esc(bk.title)}</h4><dl>${bk.items.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`).join('')}</div><span class="pn">Page ${k + 1} of ${DOC.pages.length}</span></div>` : `<div class="page" data-page="${k}" style="aspect-ratio:${p.w}/${p.h};background-image:url('${esc(p.url)}')">${DOC.fields.filter(f => f.page === k).map(fieldHTML).join('')}<span class="pn">Page ${k + 1} of ${DOC.pages.length}</span></div>`).join('')}</div>`;
  $$('.fld[data-f]').forEach(bindField);
  const ro = new ResizeObserver(es => es.forEach(e => sizeFonts(e.target)));
  $$('.page').forEach(p => { ro.observe(p); sizeFonts(p); });
  $('[data-bar]').hidden = false;
  $('[data-next]').onclick = nextField; $('[data-finish]').onclick = finish;
  progress();
}
function fieldHTML(f) {
  const pos = `left:${f.x * 100}%;top:${f.y * 100}%;width:${f.w * 100}%;height:${f.h * 100}%`;
  const lab = esc(f.label || { signature: 'Signature', initials: 'Initials', name: 'Full name', email: 'Email', text: 'Text', date: 'Date', checkbox: 'Checkbox' }[f.type]);
  if (f.role === 'other') return `<div class="fld other" style="${pos}" data-h="${f.h}" title="${esc(f.who)} signs here"><span class="ro">${f.type === 'signature' || f.type === 'initials' ? esc(f.who) : ''}</span></div>`;
  if (!mine(f)) {
    if (f.type === 'checkbox') return `<div class="fld cb them" style="${pos}" data-h="${f.h}"><span class="box" style="cursor:default">${f.value === '1' || f.value === 'true' || f.value === 'yes' ? CHECK : ''}</span></div>`;
    return `<div class="fld them" style="${pos}" data-h="${f.h}"><span class="ro">${esc(f.value || '')}</span></div>`;
  }
  const cls = `fld me ${f.required && f.type !== 'date' ? 'req' : ''}`;
  if (f.type === 'signature' || f.type === 'initials') return `<div class="${cls} sig" style="${pos}" data-f="${f.id}" data-h="${f.h}" title="${lab}"><button type="button" class="tap" aria-label="${lab}">${PEN}<span>${f.type === 'initials' ? 'Initials' : 'Sign here'}</span></button></div>`;
  if (f.type === 'checkbox') return `<div class="${cls} cb" style="${pos}" data-f="${f.id}" data-h="${f.h}"><button type="button" class="box" role="checkbox" aria-checked="false" aria-label="${lab}"></button></div>`;
  if (f.type === 'date') return `<div class="${cls} date done" style="${pos}" data-f="${f.id}" data-h="${f.h}" title="Date signed (filled in automatically)"><span class="ro">${esc(DOC.today)}</span></div>`;
  return `<div class="${cls}" style="${pos}" data-f="${f.id}" data-h="${f.h}"><input class="txt" ${f.type === 'email' ? 'type="email" inputmode="email" autocomplete="email"' : f.type === 'name' ? 'autocomplete="name"' : ''} placeholder="${lab}" aria-label="${lab}" value="${esc(VALS[f.id] || '')}" maxlength="500"></div>`;
}
function sizeFonts(page) {
  const H = page.getBoundingClientRect().height;
  page.querySelectorAll('.fld').forEach(el => { el.style.setProperty('--fs', Math.max(8, Math.min(22, +el.dataset.h * H * .6)) + 'px'); });
}
function bindField(el) {
  const f = DOC.fields.find(x => x.id === el.dataset.f);
  if (f.type === 'signature' || f.type === 'initials') { el.querySelector('button, img')?.addEventListener('click', () => sigClick(f, el)); el.onclick = e => { if (e.target === el) sigClick(f, el); }; }
  else if (f.type === 'checkbox') { const b = el.querySelector('.box'); b.onclick = () => { VALS[f.id] = !VALS[f.id]; b.innerHTML = VALS[f.id] ? CHECK : ''; b.setAttribute('aria-checked', VALS[f.id]); mark(el, f); }; }
  else if (f.type !== 'date') { const i = el.querySelector('input'); i.oninput = () => { VALS[f.id] = i.value; mark(el, f); }; el.onclick = () => i.focus(); }
  mark(el, f);
}
function mark(el, f) { el.classList.toggle('done', isDone(f)); el.classList.remove('pulse'); progress(); }
function progress() {
  const n = needed(), d = n.filter(isDone).length;
  $('[data-prog]').textContent = `${d} of ${n.length}`; $('[data-progbar]').style.width = (n.length ? d / n.length * 100 : 100) + '%';
  $('[data-next]').hidden = d === n.length;
}
function nextField() {
  const f = needed().find(x => !isDone(x)) || DOC.fields.find(x => mine(x) && !isDone(x) && x.type !== 'date');
  if (!f) return finish();
  goTo(f.id);
}
function goTo(id) {
  const el = $(`.fld[data-f="${id}"]`); if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
  const i = el.querySelector('input'); if (i) setTimeout(() => i.focus({ preventScroll: true }), 350);
}

/* ---------- signatures ---------- */
function sigClick(f, el) {
  const kind = f.type;
  if (ADOPT[kind] && !VALS[f.id]) return applySig(f, el, ADOPT[kind]);
  sigModal(kind, s => { ADOPT[kind] = s; applySig(f, el, s);
    if (kind === 'signature') for (const g of DOC.fields) if (g !== f && mine(g) && g.type === 'signature') { const e = $(`.fld[data-f="${g.id}"]`); if (e) applySig(g, e, s); } // you sign once: the same signature goes in all of your signature fields
  });
}
function applySig(f, el, s) { VALS[f.id] = s; el.innerHTML = `<img src="${s.url}" alt="${f.type}">`; el.querySelector('img').onclick = () => sigModal(f.type, n => { ADOPT[f.type] = n; if (f.type === 'signature') { for (const g of DOC.fields) if (mine(g) && g.type === 'signature') { const e = $(`.fld[data-f="${g.id}"]`); if (e) applySig(g, e, n); } } else applySig(f, el, n); }); mark(el, f); }

const FONTS = [['Dancing Script', 600], ['Great Vibes', 400], ['Caveat', 600]];
function sigModal(kind, onDone) {
  const isI = kind === 'initials', def = isI ? initialsOf(DOC.signerName) : DOC.signerName || '';
  let mode = 'type', font = 0, strokes = [], cur = null;
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md" role="dialog" aria-modal="true" aria-labelledby="sgt"><h2 id="sgt">${isI ? 'Your initials' : 'Your signature'}</h2><p class="sub">${isI ? 'Type or draw it once — tap any other initials field to place it again.' : (DOC.fields.filter(x => mine(x) && x.type === 'signature').length > 1 ? 'You sign once — it is placed in all ' + DOC.fields.filter(x => mine(x) && x.type === 'signature').length + ' of your signature fields.' : 'Type or draw your signature.')}</p>
    <div class="tabs" role="tablist"><button type="button" data-m="type" class="on">Type</button><button type="button" data-m="draw">Draw</button></div>
    <div data-type><input class="input" data-tx value="${esc(def)}" maxlength="${isI ? 4 : 60}" aria-label="${isI ? 'Initials' : 'Full name'}"><div class="fonts" data-fonts></div></div>
    <div data-draw hidden><div class="pad"><canvas aria-label="Draw here"></canvas><span class="x">✕</span><span class="line"></span><button type="button" class="clr" data-clr>Clear</button></div><p class="legal" style="text-align:center">Draw with your finger or mouse</p></div>
    <p class="legal">By selecting Adopt, I agree that this ${isI ? 'mark' : 'signature'} will be the electronic representation of my ${isI ? 'initials' : 'signature'} on this document.</p>
    <div class="err" data-err></div>
    <div class="row"><button type="button" class="btn ghost" data-cancel>Cancel</button><button type="button" class="btn" data-ok>Adopt and ${isI ? 'initial' : 'sign'}</button></div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) close(); };
  $('[data-cancel]', ov).onclick = close;
  const tx = $('[data-tx]', ov), fl = $('[data-fonts]', ov);
  const drawFonts = () => { fl.innerHTML = FONTS.map(([n, w], k) => `<button type="button" class="${k === font ? 'on' : ''}" data-fo="${k}" style="font-family:'${n}',cursive;font-weight:${w}">${esc(tx.value || (isI ? 'AB' : 'Your name'))}</button>`).join(''); $$('[data-fo]', fl).forEach(b => b.onclick = () => { font = +b.dataset.fo; drawFonts(); }); };
  tx.oninput = drawFonts; drawFonts();
  const cv = $('canvas', ov), ctx = cv.getContext('2d');
  const fit = () => { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); redraw(); };
  const redraw = () => { const d = devicePixelRatio || 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(d, 0, 0, d, 0, 0); strokes.forEach(s => stroke(ctx, s, 1)); };
  const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure || .5]; };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); redraw(); };
  cv.onpointermove = e => { if (!cur) return; cur.push(pt(e)); redraw(); };
  cv.onpointerup = cv.onpointercancel = () => { cur = null; };
  $('[data-clr]', ov).onclick = () => { strokes = []; redraw(); };
  $$('[data-m]', ov).forEach(b => b.onclick = () => { mode = b.dataset.m; $$('[data-m]', ov).forEach(x => x.classList.toggle('on', x === b)); $('[data-type]', ov).hidden = mode !== 'type'; $('[data-draw]', ov).hidden = mode !== 'draw'; if (mode === 'draw') requestAnimationFrame(fit); else tx.focus(); });
  $('[data-ok]', ov).onclick = async () => {
    const err = $('[data-err]', ov); err.textContent = '';
    let s;
    if (mode === 'type') { const t = tx.value.trim(); if (!t) { err.textContent = 'Type your ' + (isI ? 'initials' : 'name') + ' first.'; return; } const [n, w] = FONTS[font]; await document.fonts.load(`${w} 80px "${n}"`).catch(() => {}); s = renderTyped(t, n, w); s.how = 'type'; s.text = t; }
    else { if (!strokes.some(s => s.length > 1)) { err.textContent = 'Draw your ' + (isI ? 'initials' : 'signature') + ' first.'; return; } s = renderDrawn(strokes); s.how = 'draw'; }
    if (!s) { err.textContent = 'Please try again.'; return; }
    close(); onDone(s);
  };
  setTimeout(() => tx.focus(), 50);
}
function stroke(ctx, s, k) {
  ctx.strokeStyle = '#121f4a'; ctx.fillStyle = '#121f4a'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.6 * k;
  if (s.length === 1) { ctx.beginPath(); ctx.arc(s[0][0] * k, s[0][1] * k, 1.4 * k, 0, 7); ctx.fill(); return; }
  ctx.beginPath(); ctx.moveTo(s[0][0] * k, s[0][1] * k);
  for (let i = 1; i < s.length - 1; i++) { const mx = (s[i][0] + s[i + 1][0]) / 2, my = (s[i][1] + s[i + 1][1]) / 2; ctx.quadraticCurveTo(s[i][0] * k, s[i][1] * k, mx * k, my * k); }
  const l = s[s.length - 1]; ctx.lineTo(l[0] * k, l[1] * k); ctx.stroke();
}
function renderDrawn(strokes) {
  const xs = strokes.flat().map(p => p[0]), ys = strokes.flat().map(p => p[1]);
  const pad = 6, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const k = Math.min(3, 760 / w, 300 / h);
  const c = document.createElement('canvas'); c.width = Math.max(20, Math.round(w * k)); c.height = Math.max(20, Math.round(h * k));
  const x = c.getContext('2d'); x.translate(-x0 * k, -y0 * k);
  strokes.forEach(s => stroke(x, s, k));
  return pack(c);
}
function renderTyped(t, family, weight) {
  const size = 120, c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `${weight} ${size}px "${family}", cursive`;
  const m = x.measureText(t); const w = Math.ceil(m.width + size * .5), h = Math.ceil(size * 1.5);
  c.width = Math.min(1500, w); c.height = h;
  const y = c.getContext('2d'); y.font = `${weight} ${size}px "${family}", cursive`; y.fillStyle = '#121f4a'; y.textBaseline = 'middle'; y.fillText(t, size * .25, h * .55, c.width - size * .5);
  return trim(c);
}
function trim(c) { // crop to the ink and scale to at most 760×300
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0) return null;
  const pad = 6, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2, k = Math.min(1, 760 / w, 300 / h);
  const o = document.createElement('canvas'); o.width = Math.max(20, Math.round(w * k)); o.height = Math.max(20, Math.round(h * k));
  o.getContext('2d').drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, o.width, o.height);
  return pack(o);
}
function pack(c) { // alpha channel = ink; sent as raw bytes (server compresses it into the PDF)
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, a = new Uint8Array(c.width * c.height);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
  let bin = ''; for (let i = 0; i < a.length; i += 32768) bin += String.fromCharCode.apply(null, a.subarray(i, i + 32768));
  return { w: c.width, h: c.height, data: btoa(bin), url: c.toDataURL('image/png') };
}

/* ---------- finish ---------- */
function finish() {
  const miss = needed().find(x => !isDone(x));
  if (miss) { goTo(miss.id); toastBar('Please complete all highlighted fields (' + (needed().filter(x => !isDone(x)).length) + ' left).'); return; }
  const bad = DOC.fields.find(f => mine(f) && f.type === 'email' && VALS[f.id] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(VALS[f.id]));
  if (bad) { goTo(bad.id); toastBar('Please enter a valid email address.'); return; }
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md" role="dialog" aria-modal="true"><h2>Sign and complete</h2><p class="sub">${esc(DOC.title)}</p>
    <label class="consent"><input type="checkbox" data-c><span>I agree that my electronic signature is the legal equivalent of my handwritten signature on this document, and I consent to do business electronically with ${esc(DOC.business)}.</span></label>
    <div class="err" data-err></div><div class="row"><button class="btn ghost" data-cancel>Back</button><button class="btn" data-go disabled>Sign and complete</button></div></div>`;
  document.body.appendChild(ov);
  const c = $('[data-c]', ov), go = $('[data-go]', ov);
  c.onchange = () => { go.disabled = !c.checked; };
  $('[data-cancel]', ov).onclick = () => ov.remove(); ov.onclick = e => { if (e.target === ov) ov.remove(); };
  go.onclick = async () => {
    go.disabled = true; go.textContent = 'Signing…'; $('[data-err]', ov).textContent = '';
    const values = {};
    for (const f of DOC.fields) if (mine(f) && VALS[f.id] !== undefined) { const v = VALS[f.id]; values[f.id] = v && typeof v === 'object' ? { w: v.w, h: v.h, data: v.data, how: v.how, text: v.text || '' } : v; }
    try { const r = await api('submit', { t: TOKEN, consent: true, values }); DOC = r.doc; ov.remove(); done(true); }
    catch (e) { $('[data-err]', ov).textContent = e.message; go.disabled = false; go.textContent = 'Sign and complete'; if (e.field) { ov.remove(); goTo(e.field); } }
  };
}
function toastBar(t) { const p = $('.prog span'); const o = p.textContent; p.textContent = t; p.style.color = 'var(--bad)'; clearTimeout(p._t); p._t = setTimeout(() => { p.textContent = o; p.style.color = ''; }, 3500); }
function done(now) {
  $('[data-bar]').hidden = true; $('[data-top-actions]').innerHTML = '';
  if (DOC.status !== 'signed') { // signed by you; others still have to sign
    const left = (DOC.others || []).filter(o => !o.signed).map(o => o.name);
    app.innerHTML = `<div class="card center"><div class="done-ic">${CHECK}</div><h1>${now ? 'Thank you — you\'ve signed!' : 'You have signed this document'}</h1>
      <p><b>${esc(DOC.title)}</b>${left.length ? ' is now waiting for ' + esc(left.join(', ')) + '.' : '.'} When everyone has signed, ${DOC.signerEmail ? 'the completed PDF will be emailed to <b>' + esc(DOC.signerEmail) + '</b>.' : esc(DOC.business) + ' will send you the completed PDF.'}</p>
      <p class="legal" style="margin-top:18px">Questions? Call ${esc(DOC.businessPhone)}.</p></div>`;
    scrollTo(0, 0); return;
  }
  const when = DOC.signedAt ? new Date(DOC.signedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  app.innerHTML = `<div class="card center"><div class="done-ic">${CHECK}</div><h1>${now ? 'Thank you — you\'re all set!' : 'This document is signed'}</h1>
    <p><b>${esc(DOC.title)}</b> was signed${when ? ' on ' + esc(when.replace(/\.$/, '')) : ''}. ${now ? (DOC.signerEmail ? 'A copy has been emailed to <b>' + esc(DOC.signerEmail) + '</b> and to ' + esc(DOC.business) + '.' : esc(DOC.business) + ' has received a copy. Download yours below.') : ''}</p>
    <div class="btns"><a class="btn" href="${esc(DOC.pdf)}&dl=1">Download signed PDF</a><a class="btn ghost" href="${esc(DOC.pdf)}" target="_blank" rel="noopener">View PDF</a></div>
    <p class="legal" style="margin-top:18px">The PDF includes an audit trail page. Questions? Call ${esc(DOC.businessPhone)}.</p></div>`;
  scrollTo(0, 0);
}
function declineModal() {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md" role="dialog" aria-modal="true"><h2>Decline to sign?</h2><p class="sub">${esc(DOC.business)} will be notified. You can tell them why (optional).</p>
    <textarea class="input" rows="3" data-r maxlength="500" placeholder="Reason (optional)"></textarea><div class="err" data-err></div>
    <div class="row"><button class="btn ghost" data-cancel>Back to document</button><button class="btn dark" data-go>Decline</button></div></div>`;
  document.body.appendChild(ov);
  $('[data-cancel]', ov).onclick = () => ov.remove();
  $('[data-go]', ov).onclick = async () => { try { await api('decline', { t: TOKEN, reason: $('[data-r]', ov).value }); ov.remove(); DOC.status = 'declined'; closed('You declined to sign this document. ' + DOC.business + ' has been notified.'); } catch (e) { $('[data-err]', ov).textContent = e.message; } };
}

if (TOKEN) load(); else if (P.get('l')) startFromLink(P.get('l')); else fail('This signing link is incomplete.');
