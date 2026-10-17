/* Satin Admin — Online orders, Payments (Square) and Vehicle templates. Needs app.js (window.SatinAdmin). */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = c => 'CA$' + (Number(c || 0) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const size = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
let STATUSES = {}, STAGES = {};

function route(path, params) {
  if (path === '/orders') return viewOrders(params);
  if (path === '/payments') return viewPayments();
  if (path === '/templates') return viewTemplates();
  if (path === '/coupons') return viewCoupons();
}

async function upload(path, file, extra = {}) {
  const fd = new FormData(); fd.set('file', file); for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  const r = await fetch('/api/admin' + path, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf }, body: fd });
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error(d.error || (r.status === 413 ? 'The file is too large for this server.' : 'Upload failed.'));
  return d;
}

/* ================= orders ================= */
async function viewOrders(params) {
  const c = A().shell('Online orders', 'Business', '', '/orders');
  c.innerHTML = `<div class="toolbar"><input class="input" data-q placeholder="Search name, email, phone, order number, product" value="${esc(params.get('q') || '')}">
    <select class="input" data-stage-f><option value="">All stages</option></select><select class="input" data-status><option value="">All payment statuses</option></select></div><div data-sq></div><div data-list><div class="card empty">Loading…</div></div>`;
  const load = async () => {
    const qs = new URLSearchParams({ q: $('[data-q]').value, status: $('[data-status]').value, stage: $('[data-stage-f]').value });
    const list = $('[data-list]');
    try {
      const d = await A().api('/shop/orders?' + qs); STATUSES = d.statuses; STAGES = d.stages || {};
      const sf = $('[data-stage-f]'); if (sf.options.length < 2) sf.insertAdjacentHTML('beforeend', Object.entries(STAGES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''));
      const sel = $('[data-status]'); if (sel.options.length === 1) { sel.innerHTML += Object.entries(d.statuses).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); sel.value = params.get('status') || ''; }
      $('[data-sq]').innerHTML = d.squareReady || d.paypalReady ? '' : `<div class="card shop-note">No online payment is connected, so orders are saved as <b>Awaiting payment</b> and the customer is told you will send a payment link.${A().can('payments.manage') ? ' <a href="#/payments">Connect Square or PayPal</a>' : ''}</div>`;
      const acts = A().can('orders.edit');
      list.innerHTML = d.orders.length ? `<table class="table${acts ? ' has-acts' : ''}"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Placed</th><th>Stage</th><th>Payment</th>${acts ? '<th class="act"><span class="sr">Actions</span></th>' : ''}</tr></thead><tbody>${d.orders.map(o => `
        <tr class="click" data-id="${esc(o.id)}"><td><b>${esc(o.reference)}</b><small>${o.files ? o.files + ' artwork file' + (o.files === 1 ? '' : 's') : 'No files'}</small></td>
        <td>${esc(o.name)}<small>${esc(o.email)}</small></td><td>${esc(o.summary)}<small>${o.items} item${o.items === 1 ? '' : 's'}</small></td><td>${money(o.total)}</td>
        <td>${esc(A().fmtDate(o.createdAt))}</td><td><span class="pill stage-${esc(o.stage)}">${esc(STAGES[o.stage] || o.stage)}</span></td><td><span class="pill ${esc(o.status)}">${esc(STATUSES[o.status] || o.status)}</span></td>${acts ? `<td class="act"><button type="button" class="rowmenu" data-ordmenu="${esc(o.id)}" aria-label="Actions for order ${esc(o.reference)}" title="More actions">⋯</button></td>` : ''}</tr>`).join('')}</tbody></table>`
        : '<div class="card empty">No online orders yet.</div>';
      $$('tr[data-id]', list).forEach(tr => tr.onclick = e => { if (e.target.closest('.act')) return; openOrder(tr.dataset.id, load); });
      $$('[data-ordmenu]', list).forEach(b => b.onclick = e => { e.stopPropagation(); const ord = d.orders.find(x => x.id === b.dataset.ordmenu); if (!ord) return;
        A().popMenu(b, [['open', 'Open order'], ['del', 'Delete order…', 'danger']], k => { if (k === 'open') openOrder(ord.id, load); if (k === 'del') deleteOrder(ord, load); }); });
    } catch (e) { list.innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
  };
  let t; $('[data-q]').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $('[data-status]').onchange = load; $('[data-stage-f]').onchange = load;
  await load();
  if (params.get('id')) openOrder(params.get('id'), load);
}

const PAY_LABEL = { awaiting_payment: 'Unpaid', paid: 'Paid', refunded: 'Refunded' };
/* Delete an order record. Paid orders: stronger warning + type the order number (refunds happen in Square/PayPal, not here). */
function deleteOrder(r, done) {
  const paid = r.paid ?? !!r.paidAt;
  A().confirmBox(`Delete order ${r.reference}?`, `Order ${r.reference} from ${r.name || r.email} (${money(r.total)}) will be removed from the admin permanently, together with its coupon use. Uploaded artwork files are kept. This cannot be undone.`,
    async typed => { try { await A().api('/shop/orders/delete', { id: r.id, confirm: typed }); A().toast(`Order ${r.reference} deleted`); done(); } catch (e) { A().toast(e.message); } },
    { danger: true, yesLabel: 'Delete order', ...(paid ? { typeWord: r.reference, warn: `This order was PAID${r.paidAt ? ' on ' + A().fmtDate(r.paidAt) : ''}${r.provider ? ' via ' + (r.provider === 'paypal' ? 'PayPal' : r.provider === 'square' ? 'Square' : r.provider) : ''}. Deleting only removes the record — no money is returned. Refunds must be done in Square/PayPal.` } : {}) });
}
const sideName = k => String(k || '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' / ');
const inch = n => (Math.round(Number(n) * 1000) / 1000).toString();
let pdfLib = null;
const loadPdf = async () => { if (!pdfLib) {
  for (const C of [Map, WeakMap]) { // pdf.js 5 uses these newer Map methods; older browsers need them added
    if (!C.prototype.getOrInsert) Object.defineProperty(C.prototype, 'getOrInsert', { configurable: true, writable: true, value(k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
    if (!C.prototype.getOrInsertComputed) Object.defineProperty(C.prototype, 'getOrInsertComputed', { configurable: true, writable: true, value(k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); } });
  } pdfLib = await import('/checkout/vendor/pdf.mjs'); pdfLib.GlobalWorkerOptions.workerSrc = '/checkout/vendor/pdf.worker.mjs'; } return pdfLib; };
/* Renders page 1 of an order PDF into the tile and checks its size against the ordered trim (+ bleed). */
async function renderPdfTile(tile, item) {
  const fileUrl = '/api/studio/file?id=' + encodeURIComponent(tile.dataset.pdf), box = $('.os-thumb', tile), info = $('[data-pdfinfo]', tile);
  try {
    const lib = await loadPdf(), doc = await lib.getDocument({ url: fileUrl, withCredentials: true }).promise, page = await doc.getPage(1);
    const v1 = page.getViewport({ scale: 1 }), scale = Math.min(3, 520 / Math.max(v1.width, v1.height)), v = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; box.replaceChildren(c);
    const w = v1.width / 72, h = v1.height / 72, sp = item.spec || {};
    let flag = '';
    if (typeof sp.width === 'number') {
      const b = Number(sp.bleed) || 0, near = (x, y) => Math.abs(x - y) < 0.03;
      const fits = (W, H) => (near(w, W) && near(h, H)) || (near(w, H) && near(h, W));
      flag = fits(sp.width + 2 * b, sp.height + 2 * b) ? '<span class="os-ok">Matches ordered size with bleed</span>' : fits(sp.width, sp.height) ? '<span class="os-warn">Trim size only, no bleed</span>' : `<span class="os-bad">Page size differs from ordered ${inch(sp.width)} × ${inch(sp.height)} in</span>`;
    }
    info.innerHTML = `PDF page: <b>${inch(w)} × ${inch(h)} in</b> · ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} ${flag}`;
  } catch (e) { console.warn('PDF preview', e); box.innerHTML = '<div class="os-nothumb">PDF preview unavailable</div>'; }
}

async function openOrder(id, reload) {
  const o = document.createElement('div'); o.className = 'overlay'; o.innerHTML = '<div class="drawer order-sheet"><div class="empty">Loading…</div></div>'; document.body.append(o);
  const close = () => o.remove(); o.onclick = e => { if (e.target === o) close(); };
  const can = A().can('orders.edit');
  const draw = d => {
    const r = d.order, a = r.address || {}, s = r.shipping || {}, stages = r.stages || {}; STATUSES = d.statuses;
    const files = Object.fromEntries((r.fileList || []).map(f => [f.id, f]));
    const furl = (id, inline) => '/api/studio/file?id=' + encodeURIComponent(id) + (inline ? '&inline=1' : '');
    const pay = PAY_LABEL[r.status] || (r.paidAt ? 'Paid' : (STATUSES[r.status] || r.status));
    const method = r.payMethod === 'Afterpay' ? 'Afterpay (via Square)' : r.payMethod === 'PayPal Pay Later' ? 'PayPal Pay Later' : r.provider === 'paypal' ? 'PayPal' : r.provider === 'square' ? 'Square (card)' : r.paymentId && /^manual:/.test(r.paymentId) ? 'Recorded manually' : r.paidAt ? 'Manual' : '—';
    const pickup = /pickup/i.test(s.id || '') || /pickup/i.test(s.label || '');
    const tile = (f, item, tag) => {
      if (!f) return '<div class="os-tile"><div class="os-nothumb">File removed</div></div>';
      const img = /^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(f.mime), pdf = f.mime === 'application/pdf';
      const pdfSrv = f.pdf && f.pdf.widthIn ? `<span class="hint">MediaBox ${inch(f.pdf.widthIn)} × ${inch(f.pdf.heightIn)} in</span>` : '';
      return `<figure class="os-tile" ${pdf ? `data-pdf="${esc(f.id)}"` : ''}>${tag ? `<span class="os-tag">${esc(tag)}</span>` : ''}
        <a class="os-thumb" href="${furl(f.id, true)}" target="_blank" rel="noopener">${img ? `<img loading="lazy" src="${furl(f.id, true)}" alt="">` : pdf ? '<div class="os-nothumb">Rendering PDF…</div>' : `<div class="os-nothumb">${esc((f.name.split('.').pop() || 'file').toUpperCase())}</div>`}</a>
        <figcaption><b title="${esc(f.name)}">${esc(f.name)}</b><span>${size(f.size)}${f.width ? ' · ' + f.width + '×' + f.height + ' px' : ''}</span>${pdf ? `<span data-pdfinfo>${pdfSrv}</span>` : ''}
        <a class="btn ghost sm" href="${furl(f.id)}" download>Download</a></figcaption></figure>`;
    };
    const itemHTML = (i, n) => {
      const sp = i.spec || {}, pp = i.printPages || [], dfx = (i.designFiles || []).filter(x => !(i.fileIds || []).includes(x));
      const isPrintRaster = id => files[id] && files[id].meta && files[id].meta.role === 'print';
      const mockups = dfx.filter(x => files[x] && /-(mockup|preview)\.png$/i.test(files[x].name));
      const rasters = dfx.filter(isPrintRaster), art = rasters.length ? rasters : (i.fileIds || []);
      const other = dfx.filter(x => !mockups.includes(x) && !isPrintRaster(x)).concat(rasters.length ? (i.fileIds || []) : []);
      const rows = [['Product', esc(i.name)], ['Quantity', `<b>${esc(i.values && i.values.quantity)}</b>`]];
      if (typeof sp.width === 'number') rows.push(['Trim size', `<b>${inch(sp.width)} × ${inch(sp.height)} in</b>`]);
      else if (pp[0]) rows.push(['Trim size', `<b>${inch(pp[0].trimW)} × ${inch(pp[0].trimH)} in</b>`]);
      if (pp[0] && pp[0].bleed) rows.push(['Bleed', `${inch(pp[0].bleed)} in each side → page ${inch(pp[0].trimW + 2 * pp[0].bleed)} × ${inch(pp[0].trimH + 2 * pp[0].bleed)} in`]);
      const sideName = k => String(k || '').replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
      if (pp.length > 1 && pp.some(p => p.source === 'studio')) rows.push(['Printed sides', pp.map(p => `<b>${esc(sideName(p.label))}</b> ${inch(p.trimW)} × ${inch(p.trimH)} in`).join('<br>')]); // e.g. Front 12 × 16 in, Back 12 × 16 in
      else if (sp.sides) rows.push(['Printed sides', sp.sides === 2 ? 'Front &amp; back' : sp.sides > 2 ? sp.sides + ' locations' : 'One side']);
      (i.choices || []).filter(c => c.text).forEach(c => rows.push([esc(c.label), esc(c.text)]));
      if (i.designRequested) rows.push(['Design service', '<b>Requested</b>']);
      if (i.templateId) rows.push(['Type', 'Digital template']);
      (i.lines || []).filter(l => /^Notes:/.test(l)).forEach(l => rows.push(['Notes', esc(l.replace(/^Notes:\s*/, ''))]));
      const src = pp[0] ? (pp[0].source === 'studio' ? 'Design Studio' : 'uploaded image') : '';
      const lowDpi = pp.some(p => p.dpi < 150);
      return `<section class="os-item"><div class="os-item-head"><div><small>Item ${n} of ${r.itemsDetail.length}</small><h3>${esc(i.jobName || i.name)}</h3></div><div class="os-price">${money(i.price && i.price.net)}<small>Qty ${esc(i.values && i.values.quantity)}</small></div></div>
        <div class="os-item-body"><table class="os-opts"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>
        <div class="os-dl">${pp.length ? `<a class="btn" href="/api/admin/shop/orders/print-pdf?id=${encodeURIComponent(r.id)}&item=${encodeURIComponent(i.id)}">⬇ Print-ready PDF</a>
          <span class="hint">${pp.length} page${pp.length === 1 ? '' : 's'} (${pp.map(p => esc(sideName(p.label))).join(', ')}) · ${inch(pp[0].trimW)} × ${inch(pp[0].trimH)} in + ${inch(pp[0].bleed)} in bleed · from ${src} · ${Math.round(Math.min(...pp.map(p => p.dpi)))} DPI${lowDpi ? ' <b class="os-bad">low resolution</b>' : ''}${pp.some(p => p.cropped) ? ' <b class="os-warn">artwork proportions differ from the page: edges are trimmed to fill it</b>' : ''}</span>`
          : (i.fileIds || []).some(x => files[x] && files[x].mime === 'application/pdf') ? '<span class="hint">Customer PDF is used as supplied: download the original below.</span>' : ''}
          <a class="btn ghost sm" href="${esc(i.path)}" target="_blank" rel="noopener">Product page</a></div></div>
        <div class="os-files">${art.length ? art.map((x, k) => tile(files[x], i, rasters.length ? sideName(files[x].meta.side) + ' · print' : art.length > 1 ? (k === 0 ? 'Front' : k === 1 ? 'Back' : 'File ' + (k + 1)) : 'Artwork')).join('') : i.templateId ? '' : '<div class="os-tile"><div class="os-nothumb">No artwork uploaded</div></div>'}
          ${mockups.map(x => tile(files[x], i, /mockup/i.test(files[x].name) ? 'Mockup' : 'Preview')).join('')}</div>
        ${other.length ? `<div class="os-more"><small>Other Design Studio files:</small> ${other.map(x => files[x] ? `<a href="${furl(x)}" download>${esc(files[x].name)}</a> <small>${size(files[x].size)}</small>` : '').join(' · ')}</div>` : ''}</section>`;
    };
    const stageKeys = Object.keys(stages), cur = r.stage || 'new';
    o.firstChild.innerHTML = `<header class="os-head"><div><small style="color:var(--mut)">Online order · placed ${esc(A().fmtDate(r.createdAt))}</small><h2>${esc(r.reference)}</h2>
        <div class="os-pills"><span class="pill stage-${esc(cur)}">${esc(stages[cur] || cur)}</span><span class="pill pay-${esc(pay.toLowerCase())}">${esc(pay)}</span></div></div>
        <div class="os-head-r"><button class="btn ghost sm" data-print>Print sheet</button><button class="x" data-close aria-label="Close">×</button></div></header>
      <div class="os-grid">
        <div class="os-card"><h4>Order</h4><dl class="kv"><dt>Number</dt><dd><b>${esc(r.reference)}</b></dd><dt>Placed</dt><dd>${esc(A().fmtDate(r.createdAt))}</dd><dt>Stage</dt><dd>${esc(stages[cur] || cur)}</dd>
          <dt>Payment</dt><dd><b>${esc(pay)}</b>${r.paidAt ? ' · ' + esc(A().fmtDate(r.paidAt)) : ''}</dd><dt>Method</dt><dd>${esc(method)}${r.card && r.card !== r.payMethod ? ' · ' + esc(r.card) : ''}</dd>
          ${r.paymentId ? `<dt>Payment ID</dt><dd><small>${esc(r.paymentId)}</small></dd>` : ''}${r.providerOrderId ? `<dt>Provider order</dt><dd><small>${esc(r.providerOrderId)}</small></dd>` : ''}
          <dt>Coupon</dt><dd>${r.coupon ? `<b>${esc(r.coupon)}</b> (−${money(r.discount)})` : '—'}</dd></dl></div>
        <div class="os-card"><h4>Customer</h4><dl class="kv"><dt>Name</dt><dd><b>${esc(r.name)}</b>${r.company ? '<br>' + esc(r.company) : ''}</dd><dt>Email</dt><dd><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></dd><dt>Phone</dt><dd>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : '—'}</dd></dl>
          <h4>${pickup ? 'Pickup' : 'Delivery'}</h4><dl class="kv"><dt>Method</dt><dd>${esc(s.label || '—')} · ${money(r.shippingTotal)}</dd>${!pickup && a.street1 ? `<dt>Ship to</dt><dd>${esc(a.street1)} ${esc(a.street2)}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.zip)}</dd>` : ''}</dl></div>
        <div class="os-card os-totals"><h4>Totals</h4><dl class="kv"><dt>Subtotal</dt><dd>${money(r.subtotal)}</dd>${r.discount ? `<dt>Discount</dt><dd>−${money(r.discount)}</dd>` : ''}<dt>Delivery</dt><dd>${money(r.shippingTotal)}</dd><dt>HST ${r.taxRate}%</dt><dd>${money(r.tax)}</dd><dt><b>Total</b></dt><dd><b>${money(r.total)}</b></dd></dl></div>
      </div>
      ${r.customerNotes ? `<div class="os-card os-cnotes"><h4>Customer notes</h4><p>${esc(r.customerNotes)}</p></div>` : ''}
      <h3 class="shop-h">Items (${r.itemsDetail.length})</h3>${r.itemsDetail.map((i, k) => itemHTML(i, k + 1)).join('')}
      <div class="os-card os-flow"><h4>Production workflow</h4>
        <div class="os-steps">${stageKeys.map(k => `<button type="button" class="os-step ${k === cur ? 'on' : ''} ${stageKeys.indexOf(k) < stageKeys.indexOf(cur) && cur !== 'cancelled' && k !== 'cancelled' ? 'done' : ''} ${k === 'cancelled' ? 'cxl' : ''}" data-stage="${k}" ${can ? '' : 'disabled'}>${esc(stages[k])}</button>`).join('')}</div>
        ${can ? `<textarea class="input" data-stnote rows="2" placeholder="Note for this step (optional, included in the email)"></textarea>
        <div class="os-flow-acts"><label><input type="checkbox" data-stmail> Email the customer about this update</label><button class="btn sm" data-stsave>Save update</button></div>` : ''}
        ${(r.history || []).length ? `<ol class="os-hist">${r.history.slice().reverse().map(h => `<li><b>${esc(stages[h.stage] || h.stage)}</b>${h.from && h.from !== h.stage ? ` <small>from ${esc(stages[h.from] || h.from)}</small>` : ''} · ${esc(A().fmtDate(h.at))} · ${esc(h.by)}${h.emailed ? ' · <span class="os-ok">customer emailed</span>' : ''}${h.note ? `<p>${esc(h.note)}</p>` : ''}</li>`).join('')}</ol>` : ''}</div>
      <div class="os-card"><h4>Payment</h4>
      ${can ? `<label class="field"><span>Payment status</span><select class="input" data-st>${Object.entries(STATUSES).filter(([k]) => ['awaiting_payment', 'paid', 'refunded', r.status].includes(k)).map(([k, v]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${esc(k === 'awaiting_payment' ? 'Awaiting payment (unpaid)' : v)}</option>`).join('')}</select><div class="hint">Changing “Awaiting payment” to “Paid” emails the customer a receipt (and download links for templates).</div></label>` : ''}
      ${r.status === 'awaiting_payment' ? `${r.paymentUrl ? `<div class="copy"><input class="input" readonly value="${esc(r.paymentUrl)}"><button class="btn ghost sm" data-copy>Copy</button></div>` : `<p class="hint">${d.squareReady ? 'No payment link yet.' : 'Square is not connected. Collect payment another way (e-Transfer, card terminal) and mark the order Paid, or connect Square on the Payments page.'}</p>`}
        ${can ? `<div class="shop-acts">${r.paymentUrl ? '<button class="btn sm" data-link="email">Resend payment link to customer</button><button class="btn ghost sm" data-link="recreate">Create a new link</button>' : d.squareReady ? '<button class="btn sm" data-link="create-email">Create payment link &amp; email customer</button><button class="btn ghost sm" data-link="create">Create link only</button>' : ''}</div>` : ''}` : `<p class="hint">${esc(pay)}${r.card ? ' · ' + esc(r.card) : ''}</p>`}</div>
      <div class="os-card"><h4>Team notes</h4>${can ? `<textarea class="input" data-notes rows="4" placeholder="Production notes, payment received by e-Transfer…">${esc(r.adminNotes)}</textarea><button class="btn sm" style="margin-top:8px" data-save-notes>Save notes</button>` : `<p style="white-space:pre-line">${esc(r.adminNotes || '—')}</p>`}</div>
      ${can ? `<div class="os-card os-danger"><div><h4>Delete order</h4><p class="hint">Removes this order record from the admin. Uploaded artwork files are kept.${r.paid ? ' This order was paid — refunds must be done in Square/PayPal.' : ''}</p></div><button type="button" class="btn danger sm" data-delorder>Delete order</button></div>` : ''}`;
    $('[data-close]', o).onclick = close;
    $('[data-print]', o).onclick = () => { document.body.classList.add('printing-order'); window.print(); setTimeout(() => document.body.classList.remove('printing-order'), 500); };
    $$('[data-pdf]', o).forEach(t => { const it = r.itemsDetail.find(i => (i.fileIds || []).includes(t.dataset.pdf)) || {}; renderPdfTile(t, it); });
    let pick = cur;
    $$('[data-stage]', o).forEach(b => b.onclick = () => { pick = b.dataset.stage; $$('[data-stage]', o).forEach(x => x.classList.toggle('pick', x.dataset.stage === pick && pick !== cur)); });
    const ss = $('[data-stsave]', o); if (ss) ss.onclick = async () => {
      const note = $('[data-stnote]', o).value.trim(), mail = $('[data-stmail]', o).checked;
      if (pick === cur && !note) { A().toast('Choose a new stage or write a note'); return; }
      if (pick === 'cancelled' && !confirm('Mark this order as cancelled?')) return;
      ss.disabled = true;
      try { const x = await A().api('/shop/orders/update', { id: r.id, stage: pick, stageNote: note, emailCustomer: mail }); A().toast(mail ? 'Updated and customer emailed' : 'Order updated'); draw({ ...d, order: x.order }); reload(); }
      catch (e) { A().toast(e.message); ss.disabled = false; }
    };
    const dl = $('[data-delorder]', o); if (dl) dl.onclick = () => deleteOrder(r, () => { close(); reload(); });
    const cp = $('[data-copy]', o); if (cp) cp.onclick = () => { navigator.clipboard.writeText(r.paymentUrl); A().toast('Link copied'); };
    const st = $('[data-st]', o); if (st) st.onchange = async () => {
      if (st.value === 'paid' && r.status === 'awaiting_payment' && !confirm('Mark this order as paid? The customer will get a payment confirmation email.')) { st.value = r.status; return; }
      try { const x = await A().api('/shop/orders/update', { id: r.id, status: st.value }); A().toast('Payment status updated'); draw({ ...d, order: x.order }); reload(); } catch (e) { A().toast(e.message); st.value = r.status; }
    };
    const sn = $('[data-save-notes]', o); if (sn) sn.onclick = async () => { try { await A().api('/shop/orders/update', { id: r.id, adminNotes: $('[data-notes]', o).value }); A().toast('Notes saved'); } catch (e) { A().toast(e.message); } };
    $$('[data-link]', o).forEach(b => b.onclick = async () => {
      const k = b.dataset.link; b.disabled = true;
      try { const x = await A().api('/shop/orders/payment-link', { id: r.id, email: k === 'email' || k === 'create-email', recreate: k === 'recreate' }); A().toast(x.emailed ? 'Payment link emailed' : 'Payment link ready'); draw({ ...d, order: x.order }); reload(); }
      catch (e) { A().toast(e.message); b.disabled = false; }
    });
  };
  try { draw(await A().api('/shop/orders/detail?id=' + encodeURIComponent(id))); } catch (e) { o.firstChild.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

/* ================= payments ================= */
async function viewPayments() {
  const c = A().shell('Payments (Square & PayPal)', 'Business', '<div class="card empty">Loading…</div>', '/payments');
  const all = await A().api('/shop/payments'), d = all.square;
  const prov = (name, ok, href, text) => `<a class="card shop-prov" href="${href}"><b>${name}</b> ${ok ? '<span class="pill confirmed">Connected</span>' : '<span class="pill">Not configured</span>'}<small>${text}</small></a>`;
  c.innerHTML = `<div class="grid g2 shop-provs">${prov('Square — card payments', d.ready, '#sq-section', d.ready ? 'Customers pay by card on the checkout page' + (d.afterpay ? ' (Afterpay offered when eligible).' : '.') : 'Card payment on the website is off until Square is set up below.')}${prov('PayPal', all.paypal.ready, '#pp-section', all.paypal.ready ? 'Customers can choose PayPal at checkout.' : 'PayPal is hidden from customers until you enter the Client ID and Secret below.')}</div>
  <div class="grid g2 shop-pay" id="sq-section"><div class="card"><h2>Square connection ${d.ready ? '<span class="pill confirmed">Connected</span>' : '<span class="pill">Not connected</span>'}</h2><div data-msg></div>
    <form data-f>
      <label class="field"><span>Environment</span><select name="environment"><option value="sandbox">Sandbox (testing — no real charges)</option><option value="production">Production (real payments)</option></select></label>
      <label class="field"><span>Application ID (public)</span><input name="applicationId" value="${esc(d.applicationId)}" placeholder="sq0idp-… or sandbox-sq0idb-…" autocomplete="off"></label>
      <label class="field"><span>Location ID</span><input name="locationId" value="${esc(d.locationId)}" placeholder="e.g. L8Z…" autocomplete="off"></label>
      <label class="field"><span>Access token ${d.tokenSet ? `<small class="pill">${esc(d.tokenHint)}</small>` : ''}</span><input name="accessToken" type="password" autocomplete="new-password" placeholder="${d.tokenSet ? 'Saved — leave empty to keep it' : 'Paste the access token'}"><div class="hint">Write-only: after saving, only the last 4 characters are shown. The token is never sent back to the browser.</div></label>
      <label class="field"><span>Webhook signature key ${d.webhookKeySet ? `<small class="pill">${esc(d.webhookKeyHint)}</small>` : ''}</span><input name="webhookKey" type="password" autocomplete="new-password" placeholder="${d.webhookKeySet ? 'Saved — leave empty to keep it' : 'Paste the signature key of your webhook subscription'}"></label>
      <label class="field"><span>Webhook URL — paste this in Square</span><div class="copy"><input class="input" readonly value="${esc(d.webhookUrl)}" data-hook><button class="btn ghost sm" type="button" data-copy>Copy</button></div>
        <div class="hint">Subscribe to <b>payment.updated</b> (payment.created also works; other events such as order.updated are ignored). If Square shows a different URL for your subscription, enter it exactly below (the signature check uses it).</div></label>
      <label class="field"><span>Webhook URL override (optional)</span><input name="webhookUrl" value="${esc(d.webhookUrlOverride)}" placeholder="${esc(d.defaultWebhookUrl)}"></label>
      <label class="field"><span><input type="checkbox" name="enabled" ${d.enabled ? 'checked' : ''} style="width:auto"> Take card payments online with Square</span><div class="hint">Turn off to pause online payments: orders are then saved as “Awaiting payment”.</div></label>
      <label class="field"><span><input type="checkbox" name="afterpay" ${d.afterpay ? 'checked' : ''} style="width:auto"> Offer Afterpay at checkout</span><div class="hint">Shows the Afterpay button (4 interest-free payments) on checkout and invoice pages, and “or 4 payments of …” messaging on product pages. Square shows it only when your Square account and location are approved for Afterpay and the total is within Afterpay’s limits; otherwise customers simply don’t see it. Afterpay must also be turned on in Square Dashboard → Settings → Payments → Afterpay (online).<span dir="rtl" lang="fa" style="display:block;margin-top:4px">نمایش Afterpay (پرداخت در ۴ قسط بدون بهره) در صفحه پرداخت، فاکتور و صفحه محصولات — فقط وقتی حساب Square شما واجد شرایط باشد و مبلغ در محدوده Afterpay باشد.</span></div></label>
      <div class="shop-acts"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-test ${d.tokenSet ? '' : 'disabled'}>Test connection</button>
      ${d.tokenSet ? '<button class="btn danger sm" type="button" data-clear>Remove token &amp; key</button>' : ''}</div>
      <div data-test-out></div>
      ${d.updatedAt ? `<p class="hint">Last saved ${esc(A().fmtDate(d.updatedAt))} by ${esc(d.updatedBy || '—')}</p>` : ''}
    </form></div>
    <div class="card shop-help"><h2>Where to find these / این اطلاعات کجاست؟</h2>
      <ol><li>Sign in at <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener">developer.squareup.com/apps</a> with your Square account and open (or create) your application.</li>
      <li><b>Credentials</b> page: choose <b>Sandbox</b> or <b>Production</b> at the top, then copy the <b>Application ID</b> and the <b>Access token</b>.</li>
      <li><b>Locations</b> page: copy the <b>Location ID</b> of your Vaughan shop.</li>
      <li><b>Webhooks → Subscriptions</b>: add a subscription with the webhook URL shown here, select <b>payment.updated</b>, save, then copy its <b>Signature key</b>.</li>
      <li>Save here and press <b>Test connection</b>. Test with Sandbox first, then switch to Production with the production token, location and webhook.</li></ol>
      <div dir="rtl" lang="fa" class="shop-fa"><ol><li>در <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener">developer.squareup.com/apps</a> با حساب Square وارد شوید و اپلیکیشن خود را باز کنید (یا بسازید).</li>
      <li>در صفحهٔ <b>Credentials</b> بالای صفحه <b>Sandbox</b> (آزمایشی) یا <b>Production</b> (واقعی) را انتخاب کنید و <b>Application ID</b> و <b>Access token</b> را کپی کنید.</li>
      <li>در صفحهٔ <b>Locations</b> شناسهٔ <b>Location ID</b> فروشگاه را کپی کنید.</li>
      <li>در <b>Webhooks → Subscriptions</b> یک اشتراک با آدرس Webhook همین صفحه بسازید، رویداد <b>payment.updated</b> را انتخاب کنید و سپس <b>Signature key</b> آن را کپی کنید.</li>
      <li>اینجا ذخیره کنید و <b>Test connection</b> را بزنید. اول با Sandbox تست کنید، بعد به Production بروید.</li></ol>
      <p>توکن دسترسی فقط در دیتابیس سرور ذخیره می‌شود و دیگر نمایش داده نمی‌شود (فقط ۴ رقم آخر).</p></div>
      <p class="hint">Without Square or PayPal, checkout still works: orders are saved as “Awaiting payment”, you get an email, and you can send a payment link from Online orders.</p></div></div>
    ${paypalHTML(all.paypal)}`;
  bindPaypal(c, all.paypal);
  $$('.shop-prov', c).forEach(a => a.onclick = e => { e.preventDefault(); $(a.getAttribute('href'), c).scrollIntoView({ behavior: 'smooth' }); });
  const f = $('[data-f]', c); f.environment.value = d.environment;
  $('[data-copy]', c).onclick = () => { navigator.clipboard.writeText($('[data-hook]', c).value); A().toast('Webhook URL copied'); };
  const msg = (t, ok) => { $('[data-msg]', c).innerHTML = `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>`; };
  f.onsubmit = async e => { e.preventDefault();
    try { await A().api('/shop/payments', { environment: f.environment.value, applicationId: f.applicationId.value.trim(), locationId: f.locationId.value.trim(), accessToken: f.accessToken.value.trim(), webhookKey: f.webhookKey.value.trim(), webhookUrl: f.webhookUrl.value.trim(), enabled: f.enabled.checked, afterpay: f.afterpay.checked });
      A().toast('Payment settings saved'); viewPayments(); } catch (er) { msg(er.message); } };
  const cl = $('[data-clear]', c); if (cl) cl.onclick = () => A().confirmBox('Remove Square credentials?', 'Online card payments stop until you enter them again.', async () => { try { await A().api('/shop/payments', { clearToken: true, clearWebhookKey: true }); viewPayments(); } catch (er) { msg(er.message); } });
  $('[data-test]', c).onclick = async ev => { const b = ev.target; b.disabled = true; const out = $('[data-test-out]', c); out.innerHTML = '<p class="hint">Contacting Square…</p>';
    try { const r = await A().api('/shop/payments/test', {});
      out.innerHTML = r.ok ? `<div class="okmsg">Connected to Square ${esc(r.environment)}. ${r.locationFound ? 'Location ID found ✓' : '<b>The saved Location ID was not found</b> — choose one below.'}</div><ul class="shop-locs">${r.locations.map(l => `<li><code>${esc(l.id)}</code> · ${esc(l.name)} · ${esc(l.status)} · ${esc(l.currency)}</li>`).join('')}</ul>`
        : `<div class="err">${esc(r.error)}</div>`;
    } catch (er) { out.innerHTML = `<div class="err">${esc(er.message)}</div>`; }
    b.disabled = false; };
}

function paypalHTML(p) {
  return `<div class="grid g2 shop-pay" id="pp-section" style="margin-top:18px"><div class="card"><h2>PayPal ${p.ready ? '<span class="pill confirmed">Connected</span>' : '<span class="pill">Not connected</span>'}</h2><div data-pp-msg></div>
    <form data-pp>
      <label class="field"><span>Environment</span><select name="environment"><option value="sandbox">Sandbox (testing — no real charges)</option><option value="live">Live (real payments)</option></select></label>
      <label class="field"><span>Client ID (public)</span><input name="clientId" value="${esc(p.clientId)}" autocomplete="off"></label>
      <label class="field"><span>Client secret ${p.secretSet ? `<small class="pill">${esc(p.secretHint)}</small>` : ''}</span><input name="clientSecret" type="password" autocomplete="new-password" placeholder="${p.secretSet ? 'Saved — leave empty to keep it' : 'Paste the secret'}"><div class="hint">Write-only: after saving, only the last 4 characters are shown.</div></label>
      <label class="field"><span>Webhook ID</span><input name="webhookId" value="${esc(p.webhookId)}" placeholder="e.g. 8PT597110X687430LKGECATA" autocomplete="off"></label>
      <label class="field"><span>Webhook URL — paste this in PayPal</span><div class="copy"><input class="input" readonly value="${esc(p.webhookUrl)}" data-pp-hook><button class="btn ghost sm" type="button" data-pp-copy>Copy</button></div>
        <div class="hint">Events: <b>Checkout order approved</b>, <b>Payment capture completed</b>, <b>denied</b> and <b>refunded</b> (CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED / DENIED / REFUNDED).</div></label>
      <label class="field"><span><input type="checkbox" name="enabled" ${p.enabled ? 'checked' : ''} style="width:auto"> Offer PayPal at checkout</span></label>
      <label class="field"><span><input type="checkbox" name="payLater" ${p.payLater ? 'checked' : ''} style="width:auto"> Offer PayPal Pay Later</span><div class="hint">Adds the PayPal “Pay Later” (Pay in 4) button next to PayPal on checkout and invoice pages, and PayPal’s official Pay Later message on product pages. PayPal decides eligibility (Canada, CAD, purchases $10–$2,000); nothing else to set up in PayPal.<span dir="rtl" lang="fa" style="display:block;margin-top:4px">دکمه «Pay Later» پی‌پال (پرداخت در ۴ قسط) کنار PayPal نمایش داده می‌شود. واجد شرایط بودن را خود PayPal تعیین می‌کند.</span></div></label>
      <div class="shop-acts"><button class="btn" type="submit">Save</button><button class="btn ghost" type="button" data-pp-test ${p.secretSet ? '' : 'disabled'}>Test connection</button>${p.secretSet ? '<button class="btn danger sm" type="button" data-pp-clear>Remove secret</button>' : ''}</div>
      <div data-pp-out></div>${p.updatedAt ? `<p class="hint">Last saved ${esc(A().fmtDate(p.updatedAt))} by ${esc(p.updatedBy || '—')}</p>` : ''}
    </form></div>
    <div class="card shop-help"><h2>PayPal setup / راه‌اندازی PayPal</h2>
      <ol><li>Sign in at <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener">developer.paypal.com</a> with your PayPal Business account → <b>Apps &amp; Credentials</b>.</li>
      <li>Choose <b>Sandbox</b> or <b>Live</b> at the top, <b>Create App</b> (type: Merchant), then copy the <b>Client ID</b> and <b>Secret</b>.</li>
      <li>In the app, under <b>Webhooks</b> → <b>Add Webhook</b>: paste the webhook URL shown here, tick Checkout order approved and Payment capture completed / denied / refunded, save, then copy the <b>Webhook ID</b>.</li>
      <li>Save here and press <b>Test connection</b>. When both Square and PayPal are on, buyers choose “card” or “PayPal”.</li></ol>
      <div dir="rtl" lang="fa" class="shop-fa"><ol><li>در <a href="https://developer.paypal.com/dashboard/applications" target="_blank" rel="noopener">developer.paypal.com</a> با حساب PayPal Business وارد شوید و به <b>Apps &amp; Credentials</b> بروید.</li>
      <li>بالای صفحه <b>Sandbox</b> (آزمایشی) یا <b>Live</b> (واقعی) را انتخاب کنید، با <b>Create App</b> یک اپ بسازید و <b>Client ID</b> و <b>Secret</b> را کپی کنید.</li>
      <li>در همان اپ، بخش <b>Webhooks</b> ← <b>Add Webhook</b>: آدرس Webhook همین صفحه را وارد کنید، رویدادهای Checkout order approved و Payment capture completed / denied / refunded را انتخاب و ذخیره کنید، سپس <b>Webhook ID</b> را کپی کنید.</li>
      <li>اینجا ذخیره کنید و <b>Test connection</b> را بزنید. اگر Square و PayPal هر دو فعال باشند، مشتری بین کارت و PayPal انتخاب می‌کند.</li></ol>
      <p>Secret فقط در دیتابیس سرور ذخیره می‌شود و دیگر نمایش داده نمی‌شود (فقط ۴ رقم آخر).</p></div></div></div>`;
}
function bindPaypal(c, p) {
  const f = $('[data-pp]', c); f.environment.value = p.environment;
  const msg = (t, ok) => { $('[data-pp-msg]', c).innerHTML = `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>`; };
  $('[data-pp-copy]', c).onclick = () => { navigator.clipboard.writeText($('[data-pp-hook]', c).value); A().toast('Webhook URL copied'); };
  f.onsubmit = async e => { e.preventDefault();
    try { await A().api('/shop/payments/paypal', { environment: f.environment.value, clientId: f.clientId.value.trim(), clientSecret: f.clientSecret.value.trim(), webhookId: f.webhookId.value.trim(), enabled: f.enabled.checked, payLater: f.payLater.checked }); A().toast('PayPal settings saved'); viewPayments(); }
    catch (er) { msg(er.message); } };
  const cl = $('[data-pp-clear]', c); if (cl) cl.onclick = () => A().confirmBox('Remove the PayPal secret?', 'PayPal stops being offered at checkout until you enter it again.', async () => { try { await A().api('/shop/payments/paypal', { clearSecret: true }); viewPayments(); } catch (er) { msg(er.message); } });
  $('[data-pp-test]', c).onclick = async ev => { const b = ev.target; b.disabled = true; const out = $('[data-pp-out]', c); out.innerHTML = '<p class="hint">Contacting PayPal…</p>';
    try { const r = await A().api('/shop/payments/paypal/test', {}); out.innerHTML = r.ok ? `<div class="okmsg">Connected to PayPal ${esc(r.environment)} ✓${r.webhookIdSet ? '' : ' — add the Webhook ID too.'}</div>` : `<div class="err">${esc(r.error)}</div>`; }
    catch (er) { out.innerHTML = `<div class="err">${esc(er.message)}</div>`; }
    b.disabled = false; };
}

/* ================= coupons ================= */
async function viewCoupons() {
  const c = A().shell('Coupons', 'Business', '<div class="card empty">Loading…</div>', '/coupons');
  $('[data-actions]').innerHTML = '<button class="btn sm" data-new>+ New coupon</button>';
  const d = await A().api('/shop/coupons');
  const val = x => x.type === 'percent' ? x.value + '% off' : money(x.value * 100) + ' off';
  const scope = x => x.scope === 'all' ? 'All products' : x.scope === 'categories' ? x.scopeIds.map(id => d.categories.find(k => k.id === id)?.name || id).join(', ') : x.scopeIds.length + ' product' + (x.scopeIds.length === 1 ? '' : 's');
  c.innerHTML = `<p class="hint" style="margin:0 0 14px">Customers enter the code on a product page or at checkout. Discounts apply before tax and are checked again on the server when the order is placed.</p>
    ${d.coupons.length ? `<table class="table"><thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Dates</th><th>Used</th><th>Status</th></tr></thead><tbody>${d.coupons.map(x => `
      <tr class="click" data-id="${esc(x.id)}"><td><b>${esc(x.code)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</td><td>${val(x)}${x.minSubtotal ? `<small>Min. ${money(x.minSubtotal * 100)}</small>` : ''}</td><td>${esc(scope(x))}</td>
      <td>${x.startsOn || x.endsOn ? `${esc(x.startsOn || '…')} → ${esc(x.endsOn || '…')}` : '<small>Always</small>'}</td><td>${x.uses}${x.maxUses ? ' / ' + x.maxUses : ''}${x.maxPerEmail ? `<small>${x.maxPerEmail} per customer</small>` : ''}</td>
      <td><span class="pill ${x.state === 'active' ? 'confirmed' : ''}">${esc(x.state)}</span></td></tr>`).join('')}</tbody></table>` : '<div class="card empty">No coupons yet. Create your first discount code.</div>'}`;
  $('[data-new]').onclick = () => editCoupon(null, d);
  $$('tr[data-id]', c).forEach(tr => tr.onclick = () => editCoupon(d.coupons.find(x => x.id === tr.dataset.id), d));
}
async function editCoupon(x, d) {
  const v = x || { code: '', type: 'percent', value: 10, minSubtotal: null, startsOn: '', endsOn: '', maxUses: null, maxPerEmail: null, scope: 'all', scopeIds: [], active: true, note: '' };
  const o = A().modal(`<header><h2>${x ? 'Edit coupon' : 'New coupon'}</h2><button class="x" data-close>×</button></header><div data-msg></div><form data-f>
    <div class="shop-row"><label class="field"><span>Code</span><input name="code" required maxlength="40" value="${esc(v.code)}" placeholder="SPRING10" style="text-transform:uppercase"></label>
    <label class="field"><span>Status</span><select name="active"><option value="1" ${v.active ? 'selected' : ''}>Active</option><option value="0" ${v.active ? '' : 'selected'}>Off</option></select></label></div>
    <div class="shop-row"><label class="field"><span>Type</span><select name="type"><option value="percent" ${v.type === 'percent' ? 'selected' : ''}>Percent off</option><option value="fixed" ${v.type === 'fixed' ? 'selected' : ''}>Fixed amount off (CAD)</option></select></label>
    <label class="field"><span>Value</span><input name="value" type="number" min="0" step="0.01" required value="${esc(v.value)}"></label></div>
    <label class="field"><span>Minimum order subtotal (CAD, optional)</span><input name="minSubtotal" type="number" min="0" step="0.01" value="${esc(v.minSubtotal ?? '')}"></label>
    <div class="shop-row"><label class="field"><span>Starts (optional)</span><input name="startsOn" type="date" value="${esc(v.startsOn)}"></label><label class="field"><span>Ends (optional, inclusive)</span><input name="endsOn" type="date" value="${esc(v.endsOn)}"></label></div>
    <div class="shop-row"><label class="field"><span>Max total uses (optional)</span><input name="maxUses" type="number" min="0" step="1" value="${esc(v.maxUses ?? '')}"></label><label class="field"><span>Max uses per customer email</span><input name="maxPerEmail" type="number" min="0" step="1" value="${esc(v.maxPerEmail ?? '')}"></label></div>
    <label class="field"><span>Applies to</span><select name="scope"><option value="all">All products</option><option value="categories">Chosen categories</option><option value="products">Chosen products</option></select></label>
    <div data-scope-cats class="shop-scope" hidden>${d.categories.map(k => `<label><input type="checkbox" name="cat" value="${esc(k.id)}" ${v.scope === 'categories' && v.scopeIds.includes(k.id) ? 'checked' : ''}> ${esc(k.name)}</label>`).join('')}</div>
    <div data-scope-prods hidden><input class="input" data-pq placeholder="Search products" style="margin-bottom:8px"><div class="shop-scope">${d.products.map(p => `<label data-pname="${esc(p.name.toLowerCase())}"><input type="checkbox" name="prod" value="${esc(p.id)}" ${v.scope === 'products' && v.scopeIds.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}</div></div>
    <label class="field"><span>Note (admin only)</span><input name="note" maxlength="1000" value="${esc(v.note)}"></label>
    <div class="shop-acts"><button class="btn" type="submit">Save coupon</button>${x ? '<button class="btn danger sm" type="button" data-del>Delete</button>' : ''}</div></form>
    ${x ? `<h3 class="shop-h">Usage (${x.uses})</h3><div data-uses><p class="hint">Loading…</p></div>` : ''}`);
  const f = $('[data-f]', o), msg = m => { $('[data-msg]', o).innerHTML = m ? `<div class="err">${esc(m)}</div>` : ''; };
  f.scope.value = v.scope;
  const sc = () => { $('[data-scope-cats]', o).hidden = f.scope.value !== 'categories'; $('[data-scope-prods]', o).hidden = f.scope.value !== 'products'; };
  f.scope.onchange = sc; sc();
  $('[data-pq]', o).oninput = e => $$('[data-pname]', o).forEach(l => l.hidden = !l.dataset.pname.includes(e.target.value.toLowerCase()));
  f.onsubmit = async e => { e.preventDefault();
    const ids = f.scope.value === 'categories' ? $$('[name=cat]:checked', o).map(i => i.value) : f.scope.value === 'products' ? $$('[name=prod]:checked', o).map(i => i.value) : [];
    try { await A().api('/shop/coupons/save', { coupon: { id: x?.id || '', code: f.code.value.trim(), type: f.type.value, value: Number(f.value.value), minSubtotal: f.minSubtotal.value === '' ? null : Number(f.minSubtotal.value), startsOn: f.startsOn.value, endsOn: f.endsOn.value,
      maxUses: f.maxUses.value === '' ? null : Number(f.maxUses.value), maxPerEmail: f.maxPerEmail.value === '' ? null : Number(f.maxPerEmail.value), scope: f.scope.value, scopeIds: ids, active: f.active.value === '1', note: f.note.value } });
      o.remove(); A().toast('Coupon saved'); viewCoupons(); } catch (er) { msg(er.message); } };
  const del = $('[data-del]', o); if (del) del.onclick = () => A().confirmBox('Delete this coupon?', 'Customers can no longer use it. Past orders keep their discount.', async () => { try { await A().api('/shop/coupons/delete', { id: x.id }); o.remove(); A().toast('Coupon deleted'); viewCoupons(); } catch (er) { msg(er.message); } });
  if (x) { try { const u = (await A().api('/shop/coupons/uses?id=' + encodeURIComponent(x.id))).uses;
    $('[data-uses]', o).innerHTML = u.length ? `<table class="table"><tbody>${u.map(r => `<tr><td><a href="#/orders?id=${esc(r.orderId)}">${esc(r.orderNumber)}</a><small>${esc(r.email)}</small></td><td>−${money(r.discount)}</td><td>${esc(A().fmtDate(r.createdAt))}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Not used yet.</p>';
  } catch (e) { $('[data-uses]', o).innerHTML = `<div class="err">${esc(e.message)}</div>`; } }
}

/* ================= templates ================= */
async function viewTemplates() {
  const c = A().shell('Vehicle templates', 'Website', '<div class="card empty">Loading…</div>', '/templates');
  $('[data-actions]').innerHTML = '<button class="btn sm" data-new>+ New template</button>';
  const d = await A().api('/shop/templates');
  c.innerHTML = `<p class="hint" style="margin:0 0 14px">Vector files are sold as downloads. Customers find them on <a href="/satin/shop/vehicle-templates/" target="_blank" rel="noopener">Shop → Vehicle templates</a> (make + model + year must match). After payment they get an email with a download link that expires in 14 days. Server upload limit: ${esc(d.uploadLimit)} per file.</p>
    ${d.templates.length ? `<table class="table"><thead><tr><th></th><th>Template</th><th>Vehicle</th><th>Category</th><th>Price</th><th>Status</th></tr></thead><tbody>${d.templates.map(t => `
      <tr class="click" data-id="${esc(t.id)}"><td style="width:72px">${t.preview ? `<img src="${esc(t.preview.url)}" alt="" style="width:64px;height:44px;object-fit:contain">` : ''}</td><td><b>${esc(t.name)}</b><small>${t.file ? esc(t.file.name) + ' · ' + size(t.file.size) : 'No file yet'}</small></td>
      <td>${esc([t.year, t.make, t.model].filter(Boolean).join(' '))}<small>${esc([t.trim, t.body].filter(Boolean).join(' · '))}</small></td><td>${esc(t.category)}</td><td>${money(t.price)}</td>
      <td>${t.published ? '<span class="pill confirmed">Published</span>' : '<span class="pill">Hidden</span>'}</td></tr>`).join('')}</tbody></table>` : '<div class="card empty">No templates yet. Add your first vehicle template.</div>'}
    ${d.requests ? `<h2 class="shop-h" style="margin-top:28px">Template requests from customers</h2>${d.requests.length ? `<table class="table"><thead><tr><th>Request</th><th>Customer</th><th>Vehicle</th><th>Received</th></tr></thead><tbody>${d.requests.map(q => `<tr class="click" data-req="${esc(q.id)}"><td><b>${esc(q.reference)}</b><small>${esc(q.status)}</small></td><td>${esc(q.name)}<small>${esc(q.email)} ${esc(q.phone)}</small></td><td>${esc(q.details || q.notes)}</td><td>${esc(A().fmtDate(q.createdAt))}</td></tr>`).join('')}</tbody></table>` : '<div class="card empty">No template requests yet.</div>'}` : ''}`;
  $('[data-new]').onclick = () => editTemplate(null, d.categories);
  $$('tr[data-id]', c).forEach(tr => tr.onclick = () => editTemplate(d.templates.find(t => t.id === tr.dataset.id), d.categories));
  $$('tr[data-req]', c).forEach(tr => tr.onclick = () => A().go('/requests?q=' + encodeURIComponent(tr.querySelector('b').textContent.slice(3))));
}

function editTemplate(t, cats) {
  const x = t ? { ...t } : { name: '', category: cats[0], make: '', model: '', year: '', trim: '', body: '', description: '', price: 2500, published: false, file: null, preview: null };
  let fileId = x.file?.id || '', previewId = x.preview?.id || '';
  const o = A().modal(`<header><h2>${t ? 'Edit template' : 'New vehicle template'}</h2><button class="x" data-close>×</button></header><div data-msg></div><form data-f>
    <label class="field"><span>Name</span><input name="name" required maxlength="120" value="${esc(x.name)}" placeholder="e.g. Ford Transit 148&quot; High Roof — vector template"></label>
    <div class="shop-row"><label class="field"><span>Category</span><select name="category">${cats.map(k => `<option ${k === x.category ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></label>
    <label class="field"><span>Price (CAD, before tax)</span><input name="price" type="number" min="0" step="0.01" value="${(x.price / 100).toFixed(2)}"></label></div>
    <div class="shop-row"><label class="field"><span>Make</span><input name="make" maxlength="80" value="${esc(x.make)}" placeholder="Ford"></label><label class="field"><span>Model</span><input name="model" maxlength="80" value="${esc(x.model)}" placeholder="Transit"></label></div>
    <div class="shop-row"><label class="field"><span>Year or range</span><input name="year" maxlength="20" value="${esc(x.year)}" placeholder="2020-2025"></label><label class="field"><span>Trim</span><input name="trim" maxlength="120" value="${esc(x.trim)}" placeholder="148&quot; WB"></label></div>
    <label class="field"><span>Body / configuration</span><input name="body" maxlength="120" value="${esc(x.body)}" placeholder="High roof, extended"></label>
    <div class="hint" style="margin:-8px 0 14px">Make and model must match the names in the website’s vehicle list (e.g. “Ford”, “Transit”) so customers can find it.</div>
    <label class="field"><span>Description</span><textarea name="description" rows="3" maxlength="2000">${esc(x.description)}</textarea></label>
    <label class="field"><span>Vector file (PDF, AI, EPS or SVG · up to 50 MB)</span><input type="file" data-up="template" accept=".pdf,.ai,.eps,.svg,application/pdf,image/svg+xml,application/postscript"><div class="hint" data-fname>${x.file ? 'Current: ' + esc(x.file.name) + ' · ' + size(x.file.size) : 'No file yet'}</div></label>
    <label class="field"><span>Preview image (PNG, JPG or WebP · up to 5 MB)</span><input type="file" data-up="preview" accept="image/png,image/jpeg,image/webp"><div class="hint" data-pname>${x.preview ? `<img src="${esc(x.preview.url)}" alt="" style="max-height:80px">` : 'No preview yet'}</div></label>
    <label class="field"><span><input type="checkbox" name="published" ${x.published ? 'checked' : ''} style="width:auto"> Published (shown and for sale on the website)</span><div class="hint">Only publish files you have the right to resell.</div></label>
    <div class="shop-acts"><button class="btn" type="submit">Save template</button>${t ? '<button class="btn danger sm" type="button" data-del>Delete</button>' : ''}${t && t.published ? `<a class="btn ghost sm" href="${esc(t.url)}" target="_blank" rel="noopener">View product page</a>` : ''}</div></form>`);
  const f = $('[data-f]', o), msg = m => { $('[data-msg]', o).innerHTML = m ? `<div class="err">${esc(m)}</div>` : ''; };
  $$('[data-up]', o).forEach(inp => inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return; const kind = inp.dataset.up, label = $(kind === 'preview' ? '[data-pname]' : '[data-fname]', o);
    if (file.size > (kind === 'preview' ? 5e6 : 50 * 1048576)) { msg('This file is too large.'); inp.value = ''; return; }
    label.textContent = 'Uploading ' + file.name + '…'; f.querySelector('[type=submit]').disabled = true; msg('');
    try { const r = await upload('/shop/templates/upload', file, { kind: kind === 'preview' ? 'preview' : 'file' });
      if (kind === 'preview') { previewId = r.file.id; label.innerHTML = `<img src="/api/admin/shop/templates/file?id=${esc(r.file.id)}&inline=1" alt="" style="max-height:80px">`; }
      else { fileId = r.file.id; label.textContent = 'Uploaded: ' + r.file.name + ' · ' + size(r.file.size); }
    } catch (e) { msg(e.message); label.textContent = 'Upload failed'; inp.value = ''; }
    f.querySelector('[type=submit]').disabled = false;
  });
  f.onsubmit = async e => { e.preventDefault();
    try { await A().api('/shop/templates/save', { template: { id: t?.id || '', name: f.name.value, category: f.category.value, price: Number(f.price.value), make: f.make.value, model: f.model.value, year: f.year.value, trim: f.trim.value, body: f.body.value, description: f.description.value, published: f.published.checked, fileId, previewId } });
      o.remove(); A().toast('Template saved'); viewTemplates(); } catch (er) { msg(er.message); } };
  const del = $('[data-del]', o); if (del) del.onclick = () => A().confirmBox('Delete this template?', 'It is removed from the website. Customers who already bought it can still use their download links.', async () => { try { await A().api('/shop/templates/delete', { id: t.id }); o.remove(); A().toast('Template deleted'); viewTemplates(); } catch (er) { msg(er.message); } });
}

window.SatinShop = { route };
})();
