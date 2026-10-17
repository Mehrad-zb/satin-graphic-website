/* Satin Admin — Products & prices (catalog). Needs app.js (window.SatinAdmin). */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = c => c === null || c === undefined ? '—' : 'CA$' + (Number(c) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const clone = o => JSON.parse(JSON.stringify(o));
const keyify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'f_$1').slice(0, 40) || 'field';
const constKey = s => { const k = String(s || '').replace(/[^a-zA-Z0-9]+(.)?/g, (_, c) => c ? c.toUpperCase() : '').replace(/^[^a-zA-Z]+/, ''); return (k.charAt(0).toLowerCase() + k.slice(1)).slice(0, 40) || 'price'; };
let LIST = null, FILTER = { q: '', cat: '', st: '' }, SEL = new Set(), DIRTY = false;

addEventListener('beforeunload', e => { if (DIRTY) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('click', e => { if (!DIRTY) return; const a = e.target.closest?.('a[href^="#"]'); if (!a || a.target === '_blank') return; if (!confirm('Leave without saving your changes?')) { e.preventDefault(); e.stopPropagation(); } else DIRTY = false; }, true);

function route(path, params) {
  if (path === '/banner') return viewBanner();
  if (path === '/catalog/edit') return viewEdit(params.get('id'));
  if (path === '/catalog/categories') return viewCategories();
  if (path === '/catalog/estimator') return viewEstimator();
  if (path === '/catalog/supplier') { if (!window.SatinSupplier) throw new Error('Refresh the page.'); return window.SatinSupplier.view(); }
  return viewList();
}

/* ================= vehicle-wrap price estimator ================= */
async function viewEstimator() {
  const c = A().shell('Wrap estimator prices', 'Products & prices', '<div class="card empty">Loading…</div>', '/catalog');
  $('[data-actions]').innerHTML = '<a class="btn ghost sm" href="#/catalog">← Products</a>';
  let R = clone((await A().api('/estimator-pricing')).rules);
  const r1 = n => Math.round(n * 10) / 10;
  const cad = n => 'CA$' + Math.round(n).toLocaleString('en-CA');
  const shown = (f, v) => f.kind === 'share' ? r1(num(v) * 100) : r1((num(v) - 1) * 100);
  const back = (f, x) => f.kind === 'share' ? Math.round(num(x) * 100) / 10000 : Math.round((1 + num(x) / 100) * 10000) / 10000;
  const draw = () => {
    c.innerHTML = `<div class="card"><p class="hint" style="margin-top:0">These are the live prices of the <b>vehicle wrap price estimator</b> and the <b>Design Studio</b> vehicles. Each vehicle has a <b>starting price</b> (full wrap, gloss). Each choice changes it by a percentage: <b>0%</b> = no change, <b>10%</b> = 10% more, <b>−4%</b> = 4% less. Wrap coverage is a <b>% of the full-wrap price</b>. The grey amount next to each choice is the price with that choice alone. Changes show on the website right after you save.</p></div>
      ${R.map((r, i) => `<section class="card ep-veh" data-r="${i}"><h2>${esc(r.label)} ${r.path ? `<a class="sub" href="${esc(r.path.replace(/^\/satin/, '/satin'))}" target="_blank" rel="noopener">view page ↗</a>` : ''}</h2>
        <div class="grid g2">${r.base !== null ? `<label class="field ep-base"><span>Starting price (CA$)</span><input type="number" min="0" step="10" data-k="base" value="${esc(r.base)}"></label>` : ''}
        ${r.roofMultiplier !== null ? `<label class="field"><span>Roof wrap adds (%)</span><input type="number" step="0.5" data-k="roofMultiplier" value="${r1((r.roofMultiplier - 1) * 100)}"></label>` : ''}
        ${r.designDeposit !== null ? `<label class="field"><span>Design deposit (CA$)</span><input type="number" min="0" step="5" data-k="designDeposit" value="${esc(r.designDeposit)}"></label>` : ''}</div>
        ${r.fields.map((f, j) => `<div class="ep-q"><b>${esc(f.label)}${f.kind === 'share' ? ' <span class="sub">% of full-wrap price</span>' : ''}</b><div class="ep-opts">${f.options.map((o, k) => `<div class="ep-opt"><span>${esc(o.label)}</span><label class="ep-pct"><input type="number" step="0.5" data-f="${j}" data-o="${k}" value="${shown(f, o.value)}"><span>%</span></label><small data-ex="${j}.${k}"></small></div>`).join('')}</div></div>`).join('')}
      </section>`).join('')}
      <div class="card ep-bar"><button class="btn" data-save>Save prices</button><span class="hint" data-dirty></span></div>`;
    const ex = () => $$('[data-r]', c).forEach(sec => { const r = R[+sec.dataset.r]; $$('[data-ex]', sec).forEach(el => { const [j, k] = el.dataset.ex.split('.').map(Number); el.textContent = r.base !== null ? cad(num(r.base) * num(r.fields[j].options[k].value)) : ''; }); });
    const mark = () => { DIRTY = true; $('[data-dirty]', c).textContent = 'Unsaved changes'; };
    $$('[data-r]', c).forEach(sec => { const r = R[+sec.dataset.r];
      $$('[data-k]', sec).forEach(el => el.oninput = () => { const k = el.dataset.k; r[k] = k === 'roofMultiplier' ? Math.round((1 + num(el.value) / 100) * 10000) / 10000 : num(el.value); mark(); ex(); });
      $$('[data-f]', sec).forEach(el => el.oninput = () => { const f = r.fields[+el.dataset.f]; f.options[+el.dataset.o].value = back(f, el.value); mark(); ex(); });
    });
    ex();
    $('[data-save]', c).onclick = async () => { try { const res = await A().api('/estimator-pricing', { rules: R }); R = clone(res.rules); DIRTY = false; A().toast(res.changed.length ? `Saved — ${res.changed.length} vehicle${res.changed.length === 1 ? '' : 's'} updated` : 'No changes'); draw(); } catch (e) { A().toast(e.message); } };
  };
  draw();
}

/* ================= list ================= */
async function viewList() {
  const c = A().shell('Products & prices', 'Website', '<div class="card empty">Loading…</div>', '/catalog');
  $('[data-actions]').innerHTML = `<div class="cust-acts"><a class="btn sm" href="#/catalog/estimator">🚐 Wrap estimator prices</a><a class="btn ghost sm" href="#/catalog/supplier">Supplier prices</a><a class="btn ghost sm" href="#/catalog/categories">Categories</a><button class="btn ghost sm" data-exp>⬇ Export prices</button><button class="btn ghost sm" data-imp>⬆ Import prices</button><button class="btn sm" data-new>+ New product</button></div>`;
  LIST = await A().api('/catalog');
  SEL = new Set();
  const cats = LIST.categories, count = id => LIST.products.filter(p => p.cat === id).length;
  c.innerHTML = `<div class="cat-chips" data-chips></div>
    <div class="toolbar"><input class="input" data-q placeholder="Search products" value="${esc(FILTER.q)}"><select class="input" data-st><option value="">All products</option><option value="on">Shown on website</option><option value="off">Hidden</option><option value="changed">Changed in admin</option><option value="custom">Added in admin</option><option value="req">Price on request</option></select><span class="cust-count" data-count></span></div>
    <div class="bulkbar" data-bulk hidden></div><div data-grid></div>`;
  $('[data-st]', c).value = FILTER.st;
  const chips = () => { $('[data-chips]', c).innerHTML = `<button class="${!FILTER.cat ? 'on' : ''}" data-cat="">All <i>${LIST.products.length}</i></button>${cats.map(k => `<button class="${FILTER.cat === k.id ? 'on' : ''}" data-cat="${esc(k.id)}">${esc(k.name)} <i>${count(k.id)}</i></button>`).join('')}`; $$('[data-cat]', c).forEach(b => b.onclick = () => { FILTER.cat = b.dataset.cat; chips(); draw(); }); };
  const rows = () => LIST.products.filter(p => (!FILTER.cat || p.cat === FILTER.cat) && (!FILTER.q || [p.name, p.id, p.path, p.sub].join(' ').toLowerCase().includes(FILTER.q.toLowerCase()))
    && (!FILTER.st || (FILTER.st === 'on' ? p.active : FILTER.st === 'off' ? !p.active : FILTER.st === 'changed' ? p.changed : FILTER.st === 'custom' ? p.custom : p.onRequest)));
  const catName = id => cats.find(k => k.id === id)?.name || '';
  const draw = () => {
    const rs = rows();
    $('[data-count]', c).textContent = `${rs.length} product${rs.length === 1 ? '' : 's'}`;
    $('[data-grid]', c).innerHTML = rs.length ? `<div class="pgrid">${rs.map(p => `<article class="pcard${p.active ? '' : ' off'}${SEL.has(p.id) ? ' sel' : ''}" data-id="${esc(p.id)}">
      <label class="pchk" title="Select"><input type="checkbox" data-chk="${esc(p.id)}" ${SEL.has(p.id) ? 'checked' : ''}></label>
      <div class="pimg">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<span>No image</span>'}</div>
      <div class="pbody"><b>${esc(p.name)}</b><small>${esc(catName(p.cat))}${p.sub ? ' · ' + esc(p.sub) : ''}</small>
      <div class="pprice">${p.onRequest ? '<span class="pill">Price on request</span>' : p.from !== null ? 'From ' + money(p.from) : '<span class="pill">No price</span>'}</div>
      <div class="pbadges">${!p.active ? '<span class="pill off">Hidden</span>' : ''}${p.custom ? '<span class="pill new">Added</span>' : p.changed ? '<span class="pill ch">Changed</span>' : ''}</div></div></article>`).join('')}</div>`
      : `<div class="card empty">No products match.</div>`;
    $$('.pcard', c).forEach(el => el.onclick = e => { if (e.target.closest('.pchk')) return; A().go('/catalog/edit?id=' + encodeURIComponent(el.dataset.id)); });
    $$('[data-chk]', c).forEach(ch => ch.onchange = () => { ch.checked ? SEL.add(ch.dataset.chk) : SEL.delete(ch.dataset.chk); ch.closest('.pcard').classList.toggle('sel', ch.checked); bulk(); });
    bulk();
  };
  const bulk = () => {
    const b = $('[data-bulk]', c); b.hidden = !SEL.size; if (!SEL.size) return;
    b.innerHTML = `<b>${SEL.size} selected</b><button class="btn ghost sm" data-b="show">Show on website</button><button class="btn ghost sm" data-b="hide">Hide</button><select class="input" data-move><option value="">Move to category…</option>${cats.map(k => `<option value="${esc(k.id)}">${esc(k.name)}</option>`).join('')}</select><button class="btn ghost sm" data-b="all">Select all shown</button><button class="btn ghost sm" data-b="none">Clear</button>`;
    $$('[data-b]', b).forEach(x => x.onclick = async () => {
      const a = x.dataset.b;
      if (a === 'all') { rows().forEach(p => SEL.add(p.id)); return draw(); }
      if (a === 'none') { SEL.clear(); return draw(); }
      try { const r = await A().api('/catalog/bulk', { action: a, ids: [...SEL] }); A().toast(`${r.changed} product${r.changed === 1 ? '' : 's'} ${a === 'show' ? 'shown' : 'hidden'}`); viewList(); } catch (e) { A().toast(e.message); }
    });
    $('[data-move]', b).onchange = async e => { if (!e.target.value) return; try { const r = await A().api('/catalog/move', { cat: e.target.value, ids: [...SEL] }); A().toast(`Moved ${r.moved}`); viewList(); } catch (er) { A().toast(er.message); } };
  };
  $('[data-q]', c).oninput = e => { FILTER.q = e.target.value; draw(); };
  $('[data-st]', c).onchange = e => { FILTER.st = e.target.value; draw(); };
  chips(); draw();
  $('[data-new]').onclick = () => newProduct();
  $('[data-exp]').onclick = () => exportPrices();
  $('[data-imp]').onclick = () => importPrices();
}

function newProduct(fromId) {
  const ps = LIST.products.slice().sort((a, b) => a.name.localeCompare(b.name));
  const cats = LIST.categories;
  const def = fromId || ps.find(p => !FILTER.cat || p.cat === FILTER.cat)?.id || ps[0]?.id;
  const o = A().modal(`<header><h2>${fromId ? 'Duplicate product' : 'New product'}</h2><button class="x" data-close>×</button></header><div data-msg></div><form data-f>
    <label class="field"><span>Product name *</span><input name="name" required maxlength="160" placeholder="e.g. Door hangers — premium"></label>
    <label class="field"><span>Start from (copies its page, options and price formula)</span><select name="copyFrom">${cats.map(k => { const g = ps.filter(p => p.cat === k.id); return g.length ? `<optgroup label="${esc(k.name)}">${g.map(p => `<option value="${esc(p.id)}" ${p.id === def ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
    <div class="grid g2"><label class="field"><span>Category</span><select name="cat">${cats.map(k => `<option value="${esc(k.id)}">${esc(k.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Web address</span><input name="slug" placeholder="made from the name" pattern="[a-z0-9-]*"></label></div>
    <p class="hint" data-addr></p>
    <label class="field"><span>Short description</span><textarea name="description" rows="2" maxlength="300"></textarea></label>
    <label class="chkrow"><input type="checkbox" name="active"> Show on the website now <small>(leave off to set prices first)</small></label>
    <button class="btn block" type="submit">Create product</button></form>`);
  const f = $('[data-f]', o);
  const src = () => LIST.products.find(p => p.id === f.copyFrom.value);
  const addr = () => { const s = src(); const slug = (f.slug.value || f.name.value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); $('[data-addr]', o).textContent = s ? `Address: ${s.path.replace(/\/[^/]+$/, '')}/${slug || '…'}` : ''; };
  const syncCat = () => { const s = src(); if (s) f.cat.value = s.cat; addr(); };
  f.copyFrom.onchange = syncCat; f.name.oninput = addr; f.slug.oninput = addr; syncCat();
  f.onsubmit = async e => {
    e.preventDefault(); const b = f.querySelector('[type=submit]'); b.disabled = true;
    try { const r = await A().api('/catalog/create', { name: f.name.value, copyFrom: f.copyFrom.value, cat: f.cat.value, slug: f.slug.value, description: f.description.value, active: f.active.checked }); o.remove(); A().toast('Product created'); A().go('/catalog/edit?id=' + encodeURIComponent(r.id)); }
    catch (er) { $('[data-msg]', o).innerHTML = `<div class="err">${esc(er.message)}</div>`; b.disabled = false; }
  };
}

/* ---------- price import / export (CSV) ---------- */
async function exportPrices() {
  const d = await A().api('/catalog/export');
  const cn = id => d.categories.find(k => k.id === id)?.name || '';
  const rows = [['Product ID', 'Product', 'Category', 'Shown', 'Price value', 'Value name', 'Amount', 'From price', 'Formula']];
  for (const p of d.products) {
    const ks = Object.keys(p.constants || {});
    if (!ks.length) rows.push([p.id, p.name, cn(p.cat), p.active ? 'yes' : 'no', '', '', '', p.from === null ? '' : (p.from / 100).toFixed(2), p.formula]);
    ks.forEach((k, i) => rows.push([p.id, p.name, cn(p.cat), p.active ? 'yes' : 'no', k, '', p.constants[k], i === 0 && p.from !== null ? (p.from / 100).toFixed(2) : '', i === 0 ? p.formula : '']));
  }
  A().downloadCSV(`satin-prices-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  A().toast('Exported ' + d.products.length + ' products');
}
function importPrices() {
  const o = A().modal(`<header><h2>Import prices</h2><button class="x" data-close>×</button></header><div data-body>
    <p style="color:var(--mut);margin-top:0">1. Click <b>Export prices</b> and open the file in Excel or Google Sheets.<br>2. Change the numbers in the <b>Amount</b> column (don't change Product ID or Price value).<br>3. Save as CSV and upload it here. Only changed amounts are updated.</p>
    <label class="dropcsv" data-drop><input type="file" accept=".csv,text/csv" hidden data-file><b>Choose a CSV file</b><span>or drop it here</span></label></div>`);
  o.querySelector('.modal').classList.add('wide');
  const body = $('[data-body]', o), fi = $('[data-file]', o), dz = $('[data-drop]', o);
  const read = file => { if (!file) return; const fr = new FileReader(); fr.onload = () => step(String(fr.result)); fr.readAsText(file, 'utf-8'); };
  fi.onchange = () => read(fi.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('on'); }; dz.ondragleave = () => dz.classList.remove('on'); dz.ondrop = e => { e.preventDefault(); dz.classList.remove('on'); read(e.dataTransfer.files[0]); };
  function step(text) {
    const all = A().csvParse(text); if (all.length < 2) return A().toast('No rows found');
    const h = all[0].map(x => x.trim().toLowerCase());
    const ci = n => h.indexOf(n), iId = ci('product id'), iK = ci('price value'), iV = ci('amount');
    if (iId < 0 || iK < 0 || iV < 0) { body.insertAdjacentHTML('beforeend', '<div class="err">This file needs the columns Product ID, Price value and Amount — use a file made with Export prices.</div>'); return; }
    const by = new Map();
    all.slice(1).forEach((r, i) => { const id = (r[iId] || '').trim(), k = (r[iK] || '').trim(), v = (r[iV] || '').trim().replace(/[$,\s]/g, ''); if (!id || !k || v === '') return; if (!by.has(id)) by.set(id, { id, constants: {}, _line: i + 2 }); by.get(id).constants[k] = Number(v); });
    const rows = [...by.values()];
    body.innerHTML = `<p>${rows.length} products in the file.</p><div data-msg></div><div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-check>Check</button><button class="btn" data-go>Update prices</button></div>`;
    const run = async dry => {
      const msg = $('[data-msg]', body); body.querySelectorAll('button').forEach(b => b.disabled = true);
      try { const r = await A().api('/catalog/prices', { rows, dryRun: dry });
        msg.innerHTML = `<div class="${dry ? 'note' : 'ok'}">${dry ? 'Check only — nothing saved yet. ' : ''}<b>${r.updated}</b> products ${dry ? 'will change' : 'updated'} · <b>${r.skipped}</b> unchanged${r.errors.length ? ` · <b>${r.errors.length}</b> problems` : ''}</div>${r.errors.length ? `<details class="imperr" open><summary>Problems</summary><ul>${r.errors.map(e => `<li>Line ${e.line}: ${esc(e.error)}</li>`).join('')}</ul></details>` : ''}`;
        if (!dry) { const g = $('[data-go]', body); g.textContent = 'Done'; g.disabled = false; g.onclick = () => { o.remove(); viewList(); }; return; }
      } catch (e) { msg.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      body.querySelectorAll('button').forEach(b => b.disabled = false);
    };
    $('[data-check]', body).onclick = () => run(true); $('[data-go]', body).onclick = () => run(false);
  }
}

/* ================= categories ================= */
async function viewCategories() {
  const c = A().shell('Categories', 'Products & prices', '<div class="card empty">Loading…</div>', '/catalog');
  $('[data-actions]').innerHTML = '<a class="btn ghost sm" href="#/catalog">← Products</a>';
  const d = await A().api('/catalog');
  let cats = clone(d.categories);
  const n = id => d.products.filter(p => p.cat === id).length;
  const draw = () => {
    c.innerHTML = `<div class="card"><p class="hint" style="margin-top:0">Categories organise your products here in the admin. Rename them, change the order, or add new ones. Products in a deleted category move to the last category.</p>
      <div class="catlist">${cats.map((k, i) => `<div class="catrow" data-i="${i}"><div class="catmv"><button type="button" data-up title="Up">↑</button><button type="button" data-dn title="Down">↓</button></div>
        <label class="field"><span>Name</span><input data-k="name" value="${esc(k.name)}" maxlength="80"></label>
        <label class="field"><span>Page on the website (optional)</span><input data-k="path" value="${esc(k.path || '')}" placeholder="/satin/print-shop"></label>
        <label class="field grow"><span>Description</span><input data-k="description" value="${esc(k.description || '')}" maxlength="400"></label>
        <span class="catn">${n(k.id)} products</span><button type="button" class="btn ghost sm" data-del ${cats.length < 2 ? 'disabled' : ''}>Delete</button></div>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:6px"><button class="btn ghost" data-add>+ Add category</button><span style="flex:1"></span><button class="btn" data-save>Save categories</button></div></div>`;
    $$('.catrow', c).forEach(row => { const i = +row.dataset.i;
      $$('[data-k]', row).forEach(inp => inp.oninput = () => { cats[i][inp.dataset.k] = inp.value; });
      $('[data-up]', row).onclick = () => { if (i > 0) { [cats[i - 1], cats[i]] = [cats[i], cats[i - 1]]; draw(); } };
      $('[data-dn]', row).onclick = () => { if (i < cats.length - 1) { [cats[i + 1], cats[i]] = [cats[i], cats[i + 1]]; draw(); } };
      $('[data-del]', row).onclick = () => { cats.splice(i, 1); draw(); };
    });
    $('[data-add]', c).onclick = () => { cats.push({ id: '', name: 'New category', path: '', description: '' }); draw(); $$('.catrow [data-k=name]', c).pop().select(); };
    $('[data-save]', c).onclick = async () => { try { await A().api('/catalog/categories', { categories: cats }); A().toast('Categories saved'); A().go('/catalog'); } catch (e) { A().toast(e.message); } };
  };
  draw();
}

/* ================= product editor ================= */
const WRAP_DESIGN = P => /^design-/.test(P.ruleId || '') && P.ruleId !== 'design-services' && /\/vehicle-wrap-designs\//.test(P.path || ''); // shop wrap designs sold as digital files
async function viewEdit(id) {
  const c = A().shell('Product', 'Products & prices', '<div class="card empty">Loading…</div>', '/catalog');
  let d;
  try { d = await A().api('/catalog/product?id=' + encodeURIComponent(id || '')); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const P = clone(d.product), R = d.rule ? clone(d.rule) : null;
  const rev = R?.revision ?? 0;
  P.images = P.images || [];
  let testVals = R ? Object.fromEntries(R.fields.map(f => [f.key, f.default])) : {};
  if (R?.quantityKeys?.length && !R.quantityKeys.some(k => num(testVals[k]) > 0)) testVals[R.quantityKeys[0]] = 1;
  DIRTY = false;
  const dirty = () => { DIRTY = true; const s = $('[data-save]'); if (s) { s.classList.add('pulse'); s.textContent = 'Save changes'; } };
  $('h1').textContent = P.name;
  $('[data-actions]').innerHTML = `<div class="cust-acts"><a class="btn ghost sm" href="#/catalog">← All products</a><a class="btn ghost sm" href="${esc(P.path)}/" target="_blank" rel="noopener">View on site ↗</a><button class="btn ghost sm" data-more>More ▾</button><button class="btn sm" data-save>Saved</button></div>`;

  c.innerHTML = `<div class="ped">
    <div class="ped-main">
      ${d.sharedWith?.length ? `<div class="note">These options and prices are shared with: <b>${esc(d.sharedWith.slice(0, 6).join(', '))}${d.sharedWith.length > 6 ? '…' : ''}</b>. Changing them changes those products too.</div>` : ''}
      <section class="card"><h2>Product</h2>
        <label class="field"><span>Name *</span><input data-p="name" value="${esc(P.name)}" maxlength="160"></label>
        <label class="field"><span>Description</span><textarea data-p="description" rows="4" maxlength="4000">${esc(P.description || '')}</textarea></label>
        <div class="grid g2"><label class="field"><span>Category</span><select data-p="cat">${d.categories.map(k => `<option value="${esc(k.id)}" ${k.id === P.cat ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
        <label class="field"><span>SKU / code (optional)</span><input data-p="sku" value="${esc(P.sku || '')}" maxlength="60"></label></div>
        <label class="switchrow"><input type="checkbox" data-p="active" ${P.active ? 'checked' : ''}><span class="sw"></span><span><b>Shown on the website</b><small>When off, the product page says “Product unavailable” and it is hidden from listings.</small></span></label>
        <p class="hint">Page: <a href="${esc(P.path)}/" target="_blank" rel="noopener">${esc(P.path)}</a></p>
      </section>
      <section class="card"><h2>Images <span class="sub">first image is the main photo</span></h2><div class="imgs" data-imgs></div>
        <div class="cust-acts" style="justify-content:flex-start"><label class="btn ghost sm">⬆ Upload images<input type="file" accept="image/*" multiple hidden data-up></label><button class="btn ghost sm" data-url>Add from address</button></div></section>
      ${WRAP_DESIGN(P) ? `<section class="card"><h2>Digital delivery <span class="sub">wrap design file customers download after paying</span></h2>
        <p class="hint" style="margin-top:0">Download file: <b data-dfile>${esc(P.digitalFileName || 'Standard package (built in: print-ready PDF, layered SVG, preview, README)')}</b></p>
        <div class="cust-acts" style="justify-content:flex-start"><label class="btn ghost sm">⬆ Upload design file (ZIP, PDF, AI/EPS, SVG)<input type="file" accept=".zip,.pdf,.ai,.eps,.svg,application/zip,application/pdf" hidden data-dup></label>${P.digitalFileName ? '<button class="btn ghost sm" data-drm>Use the standard package</button>' : ''}</div>
        <label class="field"><span>Files listed on the product page (one per line, “Name — description”)</span><textarea data-dlist rows="5" maxlength="3000" placeholder="Print-ready vector PDF — driver + passenger sides at 1:1&#10;Layered Adobe Illustrator file — editable text and colours">${esc((P.deliveryFiles || []).join('\n'))}</textarea></label>
        <p class="hint">Leave the list empty to show the files of the standard package. Paid customers get the file on the confirmation page, by email (secure link, 14 days) and in My account.</p></section>` : ''}
      ${R ? `
      <section class="card"><h2>Options customers choose <span class="sub">${R.fields.length} option${R.fields.length === 1 ? '' : 's'}</span></h2><div data-fields></div><button class="btn ghost sm" data-addf>+ Add option</button></section>
      ${String(R.pricingVersion || '').startsWith('supplier-') ? `<div class="note">The prices of this product come from the <a href="#/catalog/supplier"><b>Supplier prices</b></a> table (${R.pricingVersion === 'supplier-apparel' ? 'garment and print cost by size × markup' : 'label cost coefficients × markup'}). Change them there — numbers changed in the Prices box below are replaced by that table.</div>` : ''}
      <section class="card"><h2>Prices <span class="sub">numbers you can use in the formula</span></h2><div data-consts></div><button class="btn ghost sm" data-addc>+ Add price</button></section>
      <section class="card"><h2>Price formula</h2>
        <p class="hint" style="margin-top:0">Click a name to insert it. Use <code>+ − * /</code>, brackets, comparisons (<code>==</code>, <code>&gt;</code>…) and <code>if(condition, yes, no)</code>, <code>min</code>, <code>max</code>, <code>round</code>, <code>ceil</code>, <code>floor</code>. The result is the price in dollars before tax.</p>
        <div class="vchips" data-vars></div>
        <textarea class="formula" data-formula spellcheck="false" rows="5">${esc(R.formula)}</textarea><div data-ferr></div>
      </section>
      <section class="card"><h2>Price ranges shown on the page <span class="sub">optional — e.g. “Mirrors $150 – $250”</span></h2><div data-ranges></div><button class="btn ghost sm" data-addr>+ Add range</button></section>
      <section class="card"><h2>Tax, deposit & discount</h2>
        <div class="grid g3"><label class="field"><span>Tax %</span><input type="number" data-r="taxPercent" min="0" max="30" step="0.01" value="${esc(R.taxPercent ?? 13)}"></label>
        <label class="field"><span>Deposit</span><div class="pair"><input type="number" data-r="deposit.value" min="0" step="0.01" value="${esc(R.deposit?.value ?? 100)}"><select data-r="deposit.type"><option value="percent">% of total</option><option value="fixed">CA$ fixed</option></select></div></label>
        <label class="field"><span>Automatic discount</span><div class="pair"><input type="number" data-r="discount.value" min="0" step="0.01" value="${esc(R.discount?.value ?? 0)}"><select data-r="discount.type"><option value="percent">%</option><option value="fixed">CA$</option></select></div></label></div>
        <label class="switchrow"><input type="checkbox" data-r="priceOnRequest" ${R.priceOnRequest ? 'checked' : ''}><span class="sw"></span><span><b>Price on request</b><small>Show “Get exact quote” instead of an instant price.</small></span></label>
        <label class="field"><span>Note under the price (optional)</span><input data-r="priceNote" value="${esc(R.priceNote || '')}" maxlength="400" placeholder="e.g. Final price confirmed after artwork review"></label>
      </section>` : '<section class="card"><p>This product has no price rule.</p></section>'}
    </div>
    <aside class="ped-side">
      ${R ? `<section class="card sticky"><h2>Test the price</h2><div data-test></div><div class="quote" data-quote></div></section>` : ''}
      <section class="card"><h2>History</h2><div data-hist>${(d.history || []).length ? `<ul class="hist">${d.history.map(h => `<li><span>${esc(h.kind === 'rule' ? 'Prices' : 'Product')} · ${esc(A().fmtDate(h.created_at))}<small>by ${esc(h.created_by || '—')}</small></span><button class="btn ghost sm" data-restore="${h.n}" title="Go back to the version before this change">Undo</button></li>`).join('')}</ul>` : '<p class="hint">No changes yet.</p>'}</div>
      ${d.hasOriginal && d.changed ? '<button class="btn ghost sm" data-reset>Restore the original product</button>' : ''}</section>
    </aside></div>`;

  /* product fields */
  $$('[data-p]', c).forEach(el => el[el.type === 'checkbox' ? 'onchange' : 'oninput'] = () => { P[el.dataset.p] = el.type === 'checkbox' ? el.checked : el.value; if (el.dataset.p === 'name') $('h1').textContent = el.value; dirty(); });
  /* images */
  const drawImgs = () => {
    $('[data-imgs]', c).innerHTML = P.images.length ? P.images.map((u, i) => `<figure class="${i === 0 ? 'main' : ''}"><img src="${esc(u)}" alt=""><figcaption>${i === 0 ? '<b>Main</b>' : `<button type="button" data-mainimg="${i}">Make main</button>`}<button type="button" data-rmimg="${i}" title="Remove">✕</button></figcaption></figure>`).join('') : '<p class="hint">No images yet.</p>';
    $$('[data-rmimg]', c).forEach(b => b.onclick = () => { P.images.splice(+b.dataset.rmimg, 1); drawImgs(); dirty(); });
    $$('[data-mainimg]', c).forEach(b => b.onclick = () => { const [x] = P.images.splice(+b.dataset.mainimg, 1); P.images.unshift(x); drawImgs(); dirty(); });
  };
  drawImgs();
  $('[data-up]', c).onchange = async e => {
    for (const f of [...e.target.files]) {
      const fd = new FormData(); fd.append('file', f);
      try { const r = await fetch('/api/admin/media/upload', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf } }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed'); P.images.push(j.media?.url || j.url); drawImgs(); dirty(); }
      catch (er) { A().toast(er.message); }
    }
    e.target.value = '';
  };
  if (WRAP_DESIGN(P)) {
    $('[data-dlist]', c).oninput = e => { P.deliveryFiles = e.target.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20); P._dl = true; dirty(); };
    $('[data-dup]', c).onchange = async e => {
      const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); fd.append('kind', 'design');
      try { const r = await fetch('/api/admin/shop/templates/upload', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf } }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed');
        P.digitalFileId = j.file.id; P.digitalFileName = j.file.name; P._df = true; $('[data-dfile]', c).textContent = j.file.name + ' (save to publish)'; dirty(); }
      catch (er) { A().toast(er.message); }
      e.target.value = '';
    };
    const rm = $('[data-drm]', c); if (rm) rm.onclick = () => { P.digitalFileId = ''; P.digitalFileName = ''; P._df = true; $('[data-dfile]', c).textContent = 'Standard package (save to apply)'; dirty(); };
  }
  $('[data-url]', c).onclick = () => { const u = prompt('Image address (starts with / or https://)'); if (u && /^(\/|https:\/\/)/.test(u.trim())) { P.images.push(u.trim()); drawImgs(); dirty(); } };

  if (R) {
    /* options (fields) */
    const drawFields = () => {
      const box = $('[data-fields]', c);
      box.innerHTML = R.fields.length ? R.fields.map((f, i) => `<div class="frow" data-i="${i}">
        <div class="fhead"><b>${esc(f.label || f.key)}</b><code>${esc(f.key)}</code><span class="ftype">${{ number: 'Number', select: 'Choice list', checkbox: 'Yes / no' }[f.type]}</span><span class="fmv"><button type="button" data-fup title="Up">↑</button><button type="button" data-fdn title="Down">↓</button><button type="button" data-fdel title="Delete">✕</button></span></div>
        <div class="fbody grid g3">
          <label class="field"><span>Label</span><input data-f="label" value="${esc(f.label)}"></label>
          <label class="field"><span>Name in formula</span><input data-f="key" value="${esc(f.key)}" pattern="[a-z][a-z0-9_]*"></label>
          <label class="field"><span>Type</span><select data-f="type"><option value="number" ${f.type === 'number' ? 'selected' : ''}>Number</option><option value="select" ${f.type === 'select' ? 'selected' : ''}>Choice list</option><option value="checkbox" ${f.type === 'checkbox' ? 'selected' : ''}>Yes / no</option></select></label>
          ${f.type === 'number' ? `<label class="field"><span>Minimum</span><input type="number" data-f="min" value="${esc(f.min)}" step="any"></label><label class="field"><span>Maximum</span><input type="number" data-f="max" value="${esc(f.max)}" step="any"></label><label class="field"><span>Step</span><input type="number" data-f="step" value="${esc(f.step)}" step="any" min="0"></label><label class="field"><span>Default</span><input type="number" data-f="default" value="${esc(f.default)}" step="any"></label>` : ''}
          ${f.type === 'checkbox' ? `<label class="field"><span>Default</span><select data-f="default"><option value="0" ${!num(f.default) ? 'selected' : ''}>Off (0)</option><option value="1" ${num(f.default) ? 'selected' : ''}>On (1)</option></select></label>` : ''}
        </div>
        ${f.type === 'select' ? `<div class="opts"><div class="opth"><span>Choice shown to customer</span><span>Value in formula</span><span>Default</span><span></span></div>${(f.options || []).map((o, j) => `<div class="opt" data-j="${j}"><input data-o="label" value="${esc(o.label)}"><input type="number" step="any" data-o="value" value="${esc(o.value)}"><input type="radio" name="def${i}" data-odef ${num(o.value) === num(f.default) ? 'checked' : ''}><span><button type="button" data-oup>↑</button><button type="button" data-odel>✕</button></span></div>`).join('')}<button type="button" class="btn ghost sm" data-oadd>+ Add choice</button></div>` : ''}
      </div>`).join('') : '<p class="hint">No options — the price is just the formula.</p>';
      $$('.frow', box).forEach(row => {
        const i = +row.dataset.i, f = R.fields[i];
        $$('[data-f]', row).forEach(el => el.onchange = () => {
          const k = el.dataset.f; let v = el.value;
          if (k === 'key') { const old = f.key; v = keyify(v); if (R.fields.some((x, j) => j !== i && x.key === v)) { A().toast('That name is already used'); el.value = old; return; } f.key = v; R.formula = renameVar(R.formula, old, v); $('[data-formula]', c).value = R.formula; if (R.quantityKeys) R.quantityKeys = R.quantityKeys.map(q => q === old ? v : q); if (testVals[old] !== undefined) { testVals[v] = testVals[old]; delete testVals[old]; } }
          else if (k === 'type') { f.type = v; if (v === 'number') Object.assign(f, { min: f.min ?? 0, max: f.max ?? 100, step: f.step ?? 1, default: num(f.default) }); if (v === 'select' && !f.options?.length) f.options = [{ label: 'Option 1', value: 1 }, { label: 'Option 2', value: 2 }]; if (v === 'select') f.default = f.options[0].value; if (v === 'checkbox') f.default = 0; }
          else if (k === 'label') f.label = v;
          else f[k] = num(v);
          testVals[f.key] = f.default; drawFields(); drawVars(); dirty(); test();
        });
        $('[data-fup]', row).onclick = () => { if (i > 0) { [R.fields[i - 1], R.fields[i]] = [R.fields[i], R.fields[i - 1]]; drawFields(); dirty(); test(); } };
        $('[data-fdn]', row).onclick = () => { if (i < R.fields.length - 1) { [R.fields[i + 1], R.fields[i]] = [R.fields[i], R.fields[i + 1]]; drawFields(); dirty(); test(); } };
        $('[data-fdel]', row).onclick = () => { if (!confirm(`Delete the option “${f.label}”? Remove “${f.key}” from the formula too.`)) return; R.fields.splice(i, 1); if (R.quantityKeys) R.quantityKeys = R.quantityKeys.filter(k => k !== f.key); drawFields(); drawVars(); dirty(); test(); };
        $$('.opt', row).forEach(op => { const j = +op.dataset.j, o = f.options[j];
          $('[data-o=label]', op).oninput = e => { o.label = e.target.value; dirty(); drawTest(); };
          $('[data-o=value]', op).onchange = e => { const was = num(o.value); o.value = num(e.target.value); if (num(f.default) === was) f.default = o.value; dirty(); drawTest(); test(); };
          $('[data-odef]', op).onchange = () => { f.default = o.value; dirty(); };
          $('[data-oup]', op).onclick = () => { if (j > 0) { [f.options[j - 1], f.options[j]] = [f.options[j], f.options[j - 1]]; drawFields(); dirty(); drawTest(); } };
          $('[data-odel]', op).onclick = () => { if (f.options.length < 2) return A().toast('A choice list needs at least one choice'); f.options.splice(j, 1); if (!f.options.some(x => num(x.value) === num(f.default))) f.default = f.options[0].value; drawFields(); dirty(); drawTest(); test(); };
        });
        const oa = $('[data-oadd]', row); if (oa) oa.onclick = () => { const mx = Math.max(0, ...f.options.map(o => num(o.value))); f.options.push({ label: 'New choice', value: mx + 1 }); drawFields(); dirty(); drawTest(); };
      });
      drawTest();
    };
    $('[data-addf]', c).onclick = () => { const label = prompt('Option label (what the customer sees), e.g. “Quantity” or “Finish”'); if (!label) return; let k = keyify(label); while (R.fields.some(f => f.key === k) || k in R.constants) k += '_2'; R.fields.push({ key: k, label, type: 'select', default: 1, options: [{ label: 'Option 1', value: 1 }, { label: 'Option 2', value: 2 }] }); testVals[k] = 1; drawFields(); drawVars(); dirty(); };
    /* constants */
    R.constantLabels = R.constantLabels || {};
    const drawConsts = () => {
      const ks = Object.keys(R.constants);
      $('[data-consts]', c).innerHTML = ks.length ? `<div class="crow ch"><span>Name in formula</span><span>Description</span><span>Amount</span><span></span></div>${ks.map(k => `<div class="crow" data-k="${esc(k)}"><code>${esc(k)}</code><input data-cl value="${esc(R.constantLabels[k] || '')}" placeholder="what is this?"><input type="number" step="any" data-cv value="${esc(R.constants[k])}"><span><button type="button" data-crn title="Rename">✎</button><button type="button" data-cdel title="Delete">✕</button></span></div>`).join('')}` : '<p class="hint">No prices yet.</p>';
      $$('.crow[data-k]', c).forEach(row => { const k = row.dataset.k;
        $('[data-cv]', row).oninput = e => { R.constants[k] = num(e.target.value); dirty(); test(); };
        $('[data-cl]', row).oninput = e => { R.constantLabels[k] = e.target.value; dirty(); };
        $('[data-crn]', row).onclick = () => { let n = prompt('New name for ' + k, k); if (!n) return; n = constKey(n); if (n === k) return; if (n in R.constants || R.fields.some(f => f.key === n)) return A().toast('That name is already used'); const o = {}; for (const [a, v] of Object.entries(R.constants)) o[a === k ? n : a] = v; R.constants = o; if (R.constantLabels[k]) { R.constantLabels[n] = R.constantLabels[k]; delete R.constantLabels[k]; } R.formula = renameVar(R.formula, k, n); $('[data-formula]', c).value = R.formula; drawConsts(); drawVars(); dirty(); };
        $('[data-cdel]', row).onclick = () => { if (!confirm(`Delete “${k}”? Remove it from the formula too.`)) return; delete R.constants[k]; delete R.constantLabels[k]; drawConsts(); drawVars(); dirty(); test(); };
      });
    };
    $('[data-addc]', c).onclick = () => { const label = prompt('What is this price? e.g. “Price per square foot”'); if (!label) return; let k = constKey(label); while (k in R.constants || R.fields.some(f => f.key === k)) k += '2'; R.constants[k] = 0; R.constantLabels[k] = label; drawConsts(); drawVars(); dirty(); };
    /* formula */
    const fx = $('[data-formula]', c);
    const drawVars = () => {
      $('[data-vars]', c).innerHTML = `${R.fields.map(f => `<button type="button" data-ins="${esc(f.key)}" class="v-f" title="Option: ${esc(f.label)}">${esc(f.key)}</button>`).join('')}${Object.keys(R.constants).map(k => `<button type="button" data-ins="${esc(k)}" class="v-c" title="Price: ${esc(R.constantLabels[k] || k)} = ${esc(R.constants[k])}">${esc(k)}</button>`).join('')}${['if(, , )', 'min(, )', 'max(, )', 'round()', 'ceil()'].map(t => `<button type="button" data-ins="${esc(t)}" class="v-fn">${esc(t.replace(/\(.*$/, '()'))}</button>`).join('')}`;
      $$('[data-ins]', c).forEach(b => b.onclick = () => { const t = b.dataset.ins, s = fx.selectionStart ?? fx.value.length, e = fx.selectionEnd ?? s; fx.value = fx.value.slice(0, s) + t + fx.value.slice(e); fx.focus(); const p = s + (t.includes('(') ? t.indexOf('(') + 1 : t.length); fx.setSelectionRange(p, p); R.formula = fx.value; dirty(); test(); });
    };
    fx.oninput = () => { R.formula = fx.value; dirty(); test(); };
    $$('[data-r]', c).forEach(el => { const path = el.dataset.r.split('.');
      if (el.tagName === 'SELECT') el.value = path.reduce((o, k) => o?.[k], R) || el.value;
      el[el.type === 'checkbox' ? 'onchange' : 'oninput'] = () => { let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? num(el.value) : el.value; if (path.length === 2) { R[path[0]] = { ...(R[path[0]] || {}), [path[1]]: v }; } else R[path[0]] = v; dirty(); test(); };
    });
    /* test panel */
    const drawTest = () => {
      const box = $('[data-test]', c); if (!box) return;
      box.innerHTML = R.fields.map(f => { const v = testVals[f.key] ?? f.default;
        if (f.type === 'select') return `<label class="field"><span>${esc(f.label)}</span><select data-t="${esc(f.key)}">${(f.options || []).map(o => `<option value="${esc(o.value)}" ${num(o.value) === num(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
        if (f.type === 'checkbox') return `<label class="chkrow"><input type="checkbox" data-t="${esc(f.key)}" ${num(v) ? 'checked' : ''}> ${esc(f.label)}</label>`;
        return `<label class="field"><span>${esc(f.label)} <em>${esc(f.min)}–${esc(f.max)}</em></span><input type="number" data-t="${esc(f.key)}" value="${esc(v)}" min="${esc(f.min)}" max="${esc(f.max)}" step="${esc(f.step)}"></label>`; }).join('') || '<p class="hint">No options to choose.</p>';
      $$('[data-t]', box).forEach(el => el[el.type === 'number' ? 'oninput' : 'onchange'] = () => { testVals[el.dataset.t] = el.type === 'checkbox' ? (el.checked ? 1 : 0) : num(el.value); test(); });
    };
    let tt = 0, ts = 0;
    const test = () => { clearTimeout(tt); tt = setTimeout(async () => {
      const my = ++ts, q = $('[data-quote]', c), fe = $('[data-ferr]', c);
      try { const r = await A().api('/catalog/test', { rule: R, values: testVals }); if (my !== ts) return; const x = r.quote;
        q.innerHTML = `<dl><dt>Subtotal</dt><dd>${money(x.subtotal)}</dd>${x.discount ? `<dt>Discount</dt><dd>−${money(x.discount)}</dd>` : ''}<dt>Tax</dt><dd>${money(x.tax)}</dd><dt class="tot">Total</dt><dd class="tot">${money(x.total)}</dd>${x.deposit !== x.total ? `<dt>Deposit today</dt><dd>${money(x.deposit)}</dd>` : ''}</dl>${R.priceOnRequest ? '<p class="hint">Customers see “Price on request” — this is the internal estimate.</p>' : ''}`;
        fe.innerHTML = ''; fx.classList.remove('bad');
      } catch (e) { if (my !== ts) return; q.innerHTML = `<div class="err">${esc(e.message)}</div>`; fe.innerHTML = `<div class="err">${esc(e.message)}</div>`; fx.classList.add('bad'); }
    }, 350); };
    R.priceRanges = R.priceRanges || [];
    const drawRanges = () => {
      const box = $('[data-ranges]', c);
      box.innerHTML = R.priceRanges.length ? `<div class="crow ch rg"><span>Label</span><span>From $</span><span>To $</span><span></span></div>${R.priceRanges.map((r, i) => `<div class="crow rg" data-i="${i}"><input data-rl value="${esc(r.label)}"><input type="number" min="0" step="1" data-rmin value="${esc(r.min ?? '')}"><input type="number" min="0" step="1" data-rmax value="${esc(r.max ?? '')}"><span><button type="button" data-rdel title="Delete">✕</button></span></div>`).join('')}` : '<p class="hint">No ranges. Pages show the instant price or “Price on request”.</p>';
      $$('.crow.rg[data-i]', box).forEach(row => { const r = R.priceRanges[+row.dataset.i];
        $('[data-rl]', row).oninput = e => { r.label = e.target.value; dirty(); };
        $('[data-rmin]', row).oninput = e => { r.min = num(e.target.value); dirty(); };
        $('[data-rmax]', row).oninput = e => { r.max = num(e.target.value); dirty(); };
        $('[data-rdel]', row).onclick = () => { R.priceRanges.splice(+row.dataset.i, 1); drawRanges(); dirty(); };
      });
    };
    $('[data-addr]', c).onclick = () => { R.priceRanges.push({ label: (R.fields[0]?.options || [])[R.priceRanges.length]?.label || 'New range', min: 0, max: 0 }); drawRanges(); dirty(); };
    drawRanges();
    drawFields(); drawConsts(); drawVars(); test();
  }

  /* save & more */
  const save = async () => {
    const b = $('[data-save]'); b.disabled = true; b.textContent = 'Saving…';
    try {
      await A().api('/catalog/save', { id: P.id, product: { name: P.name, description: P.description, active: !!P.active, images: P.images, cat: P.cat, sku: P.sku || '', ...(P._dl ? { deliveryFiles: P.deliveryFiles || [] } : {}), ...(P._df ? { digitalFileId: P.digitalFileId || '' } : {}) }, ...(R ? { rule: R, expectedRevision: rev } : {}) });
      DIRTY = false; A().toast('Saved — the website is updated'); viewEdit(P.id);
    } catch (e) { A().toast(e.message); b.disabled = false; b.textContent = 'Save changes'; }
  };
  $('[data-save]').onclick = save;
  addEventListener('keydown', function ks(e) { if (!location.hash.startsWith('#/catalog/edit')) return removeEventListener('keydown', ks); if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
  $('[data-more]').onclick = e => {
    $$('.menu-pop').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'menu-pop';
    m.innerHTML = `<button data-m="dup">Duplicate product</button><button data-m="${P.custom ? 'del' : 'hide'}" class="danger">${P.custom ? 'Delete product' : 'Hide from website'}</button>`;
    const r = e.target.getBoundingClientRect(); m.style.top = r.bottom + 6 + 'px'; m.style.right = (innerWidth - r.right) + 'px'; document.body.append(m);
    setTimeout(() => addEventListener('click', function cl(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('click', cl); } }), 0);
    m.onclick = async ev => { const a = ev.target.dataset.m; if (!a) return; m.remove();
      if (a === 'dup') { if (!LIST) LIST = await A().api('/catalog'); newProduct(P.id); }
      else A().confirmBox(a === 'del' ? 'Delete this product?' : 'Hide this product?', a === 'del' ? 'It disappears from the website and the admin. Its page will say “Product unavailable”.' : 'It stays here in the admin and you can show it again any time.', async () => { try { await A().api('/catalog/delete', { id: P.id }); DIRTY = false; A().toast(a === 'del' ? 'Product deleted' : 'Product hidden'); a === 'del' ? A().go('/catalog') : viewEdit(P.id); } catch (er) { A().toast(er.message); } });
    };
  };
  const rs = $('[data-reset]', c); if (rs) rs.onclick = () => A().confirmBox('Restore the original?', 'All changes to this product and its prices made in the admin are removed.', async () => { try { await A().api('/catalog/reset', { id: P.id, what: 'all' }); DIRTY = false; A().toast('Original restored'); viewEdit(P.id); } catch (e) { A().toast(e.message); } });
  $$('[data-restore]', c).forEach(b => b.onclick = () => A().confirmBox('Undo this change?', 'The product goes back to how it was before this change.', async () => { try { await A().api('/catalog/restore', { n: +b.dataset.restore }); DIRTY = false; A().toast('Restored'); viewEdit(P.id); } catch (e) { A().toast(e.message); } }));
}
function renameVar(formula, a, b) { return String(formula || '').replace(new RegExp('\\b' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b(?!\\s*\\()', 'g'), b); }


/* ================= home banner (promotions slider) ================= */
async function viewBanner() {
  const c = A().shell('Home banner', 'Website', '<div class="card empty">Loading…</div>', '/banner');
  $('[data-actions]').innerHTML = `<div class="cust-acts"><a class="btn ghost sm" href="/satin/" target="_blank" rel="noopener">View home page ↗</a><button class="btn sm" data-save>Save banner</button></div>`;
  const d = await A().api('/promotions');
  const S = { slides: clone(d.slides || []), interval: d.interval ?? 6, autoplay: d.autoplay !== false };
  const LINKS = [['/satin/vehicle-wraps/estimator', 'Price estimator'], ['/satin/vehicle-wraps', 'Vehicle wraps'], ['/satin/vehicle-wraps/commercial', 'Commercial wraps'], ['/satin/vehicle-wraps/color-change', 'Colour change'], ['/satin/vehicle-wraps/paint-protection-film', 'PPF'], ['/satin/print-shop', 'Print shop'], ['/satin/print-shop/offset/business-cards', 'Business cards'], ['/satin/apparel', 'Apparel'], ['/satin/window-graphics', 'Window graphics'], ['/satin/window-tint', 'Window tint'], ['/satin/wallpaper', 'Wallpaper'], ['/satin/shop', 'Shop'], ['/satin/contact', 'Contact'], ['/satin/portfolio', 'Our work']];
  const preview = sl => `<div class="bn-prev" style="background:${esc(sl.bg || '#17191e')};color:${esc(sl.ink || '#fff')}"><div class="bn-txt">${sl.eyebrow ? `<small>${esc(sl.eyebrow)}</small>` : ''}<b>${esc(sl.title || 'Title')}</b>${sl.text ? `<p>${esc(sl.text)}</p>` : ''}${sl.button ? `<span class="bn-btn">${esc(sl.button)} →</span>` : ''}</div>${sl.image ? `<img src="${esc(sl.image)}" alt="">` : '<div class="bn-noimg">No image</div>'}</div>`;
  const draw = () => {
    c.innerHTML = `<div class="card"><div class="grid g3"><label class="switchrow"><input type="checkbox" data-g="autoplay" ${S.autoplay ? 'checked' : ''}><span class="sw"></span><span><b>Play automatically</b><small>Slides change by themselves.</small></span></label>
      <label class="field"><span>Seconds per slide</span><input type="number" min="3" max="30" data-g="interval" value="${esc(S.interval)}"></label><p class="hint" style="align-self:center">The banner shows under the top of the home page. Only <b>active</b> slides inside their dates are shown. Leave all slides off to hide the banner.</p></div></div>
      <div class="bn-list">${S.slides.map((sl, i) => `<section class="card bn-slide${sl.active ? '' : ' off'}" data-i="${i}">
        <div class="bn-head"><b>Slide ${i + 1}</b>${sl.active ? '<span class="pill active">Active</span>' : '<span class="pill">Off</span>'}<span style="flex:1"></span><button class="btn ghost sm" data-up ${i ? '' : 'disabled'}>↑</button><button class="btn ghost sm" data-dn ${i < S.slides.length - 1 ? '' : 'disabled'}>↓</button><button class="btn ghost sm" data-dup>Duplicate</button><button class="btn ghost sm" data-del>Delete</button></div>
        <div class="bn-body"><div>
          <div class="grid g2"><label class="field"><span>Small label above the title</span><input data-k="eyebrow" value="${esc(sl.eyebrow || '')}" maxlength="60"></label><label class="field"><span>Title *</span><input data-k="title" value="${esc(sl.title || '')}" maxlength="140"></label></div>
          <label class="field"><span>Text</span><textarea data-k="text" rows="2" maxlength="400">${esc(sl.text || '')}</textarea></label>
          <div class="grid g2"><label class="field"><span>Button text (empty = whole banner is the link)</span><input data-k="button" value="${esc(sl.button || '')}" maxlength="60"></label>
          <label class="field"><span>Link to</span><input data-k="link" list="bnlinks" value="${esc(sl.link || '')}" placeholder="/satin/… or https://…"></label></div>
          <div class="grid g3"><label class="field"><span>Background</span><input type="color" data-k="bg" value="${esc(sl.bg || '#17191e')}"></label><label class="field"><span>Text colour</span><input type="color" data-k="ink" value="${esc(sl.ink || '#ffffff')}"></label><label class="switchrow" style="align-self:end"><input type="checkbox" data-k="active" ${sl.active ? 'checked' : ''}><span class="sw"></span><span><b>Active</b></span></label></div>
          <div class="grid g2"><label class="field"><span>Show from (optional)</span><input type="date" data-k="start" value="${esc(sl.start || '')}"></label><label class="field"><span>Until (optional)</span><input type="date" data-k="end" value="${esc(sl.end || '')}"></label></div>
          <div class="field"><span>Image (PNG or WebP with a transparent background looks best)</span><div class="cust-acts" style="justify-content:flex-start"><label class="btn ghost sm">⬆ Upload<input type="file" accept="image/*" hidden data-upimg></label><input class="input" data-k="image" value="${esc(sl.image || '')}" placeholder="/satin/img/…" style="flex:1;min-width:200px"></div></div>
        </div><div><span class="hint">Preview</span>${preview(sl)}</div></div></section>`).join('')}</div>
      <button class="btn ghost" data-add>+ Add slide</button><datalist id="bnlinks">${LINKS.map(([u, l]) => `<option value="${u}">${l}</option>`).join('')}</datalist>`;
    $$('[data-g]', c).forEach(el => el.onchange = () => { S[el.dataset.g] = el.type === 'checkbox' ? el.checked : num(el.value); DIRTY = true; });
    $$('.bn-slide', c).forEach(box => { const i = +box.dataset.i, sl = S.slides[i];
      const refresh = () => { box.querySelector('.bn-prev').outerHTML = preview(sl); };
      $$('[data-k]', box).forEach(el => el[el.type === 'checkbox' || el.type === 'date' ? 'onchange' : 'oninput'] = () => { sl[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; DIRTY = true; if (el.dataset.k === 'active') draw(); else refresh(); });
      $('[data-up]', box).onclick = () => { [S.slides[i - 1], S.slides[i]] = [S.slides[i], S.slides[i - 1]]; DIRTY = true; draw(); };
      $('[data-dn]', box).onclick = () => { [S.slides[i + 1], S.slides[i]] = [S.slides[i], S.slides[i + 1]]; DIRTY = true; draw(); };
      $('[data-dup]', box).onclick = () => { S.slides.splice(i + 1, 0, clone(sl)); DIRTY = true; draw(); };
      $('[data-del]', box).onclick = () => { if (confirm('Delete this slide?')) { S.slides.splice(i, 1); DIRTY = true; draw(); } };
      $('[data-upimg]', box).onchange = async e => { const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f);
        try { const r = await fetch('/api/admin/media/upload', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf } }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Upload failed'); sl.image = j.media.url; DIRTY = true; draw(); } catch (er) { A().toast(er.message); } };
    });
    $('[data-add]', c).onclick = () => { S.slides.push({ eyebrow: 'New', title: 'Your promotion title', text: '', button: 'Learn more', link: '/satin/', image: '', bg: '#17191e', ink: '#ffffff', active: true }); DIRTY = true; draw(); };
  };
  draw();
  $('[data-save]').onclick = async () => { try { const r = await A().api('/promotions', S); S.slides = r.slides; DIRTY = false; A().toast('Banner saved — the home page is updated'); draw(); } catch (e) { A().toast(e.message); } };
}

window.SatinCatalog = { route };
})();
