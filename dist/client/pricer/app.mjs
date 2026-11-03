/* Satin Pricer — in-shop price tool. Every price comes from the website's own price rules (/api/rules + /api/rules/quote),
   so a change in Admin → Products & prices shows here at once. Vehicles come from the Design Studio bodies (vehicles.json). */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = c => (Number(c) / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const store = { get(k, d) { try { const v = localStorage.getItem('pricer.' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('pricer.' + k, JSON.stringify(v)); } catch {} } };
const phone = () => matchMedia('(max-width:760px)').matches;
const scrollMain = el => { const m = $('#main'); if (!el || !m) return; if (phone()) { scrollTo({ top: el.getBoundingClientRect().top + scrollY - 118, behavior: 'smooth' }); return; } m.scrollTo({ top: el.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 12, behavior: 'smooth' }); };
const toast = t => { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2200); };

const ICON = {
  car: '<path d="M5 17h14M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4H3z"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/>',
  print: '<path d="M7 8V3h10v5M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
  shirt: '<path d="M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  admin: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3M8 17h6"/>'
};
const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

const TABS = [
  { id: 'wraps', label: 'Vehicle wraps', icon: 'car' },
  { id: 'protect', label: 'PPF & Tint', icon: 'shield' },
  { id: 'print', label: 'Print shop', icon: 'print' },
  { id: 'windows', label: 'Windows & walls', icon: 'window' },
  { id: 'apparel', label: 'Apparel', icon: 'shirt' },
  { id: 'more', label: 'More', icon: 'more' }
];
const tabOf = p => {
  const x = p.path;
  if (/^\/satin\/vehicle-wraps\/estimator\//.test(x)) return 'wraps';
  if (/paint-protection-film|\/window-tint\//.test(x)) return 'protect';
  if (/^\/satin\/print-shop\//.test(x)) return 'print';
  if (/^\/satin\/(window-graphics|wallpaper)/.test(x)) return 'windows';
  if (/^\/satin\/apparel/.test(x)) return 'apparel';
  if (/^\/satin\/shop\/vehicle-wrap-designs\//.test(x)) return null; // ready-made wrap designs: sold in the shop, not priced here
  return 'more';
};

let PRODUCTS = [], VEH = { types: [], models: [] };
const RULES = new Map();
const S = store.get('state', { tab: 'wraps' });
let cur = null; // { product, rule, values, idx, vehicle:{type, body, model}, quote }

async function getRule(id) {
  if (RULES.has(id)) return RULES.get(id);
  const r = await fetch('/api/rules?id=' + encodeURIComponent(id), { cache: 'no-store' }).then(r => r.json());
  if (!r.rule) throw new Error('Price rule not found');
  RULES.set(id, r.rule); return r.rule;
}

/* ---------- layout ---------- */
function drawRail() {
  $('#rail').innerHTML = TABS.map(t => `<button class="${S.tab === t.id ? 'on' : ''}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></button>`).join('')
    + `<button class="${S.tab === 'recent' ? 'on' : ''}" data-tab="recent">${icon('clock')}<span>Recent</span></button>`
    + `<button class="adm" data-admin title="Open the Satin admin panel">${icon('admin')}<span>Admin</span></button>`;
  $('#rail').onclick = e => {
    if (e.target.closest('[data-admin]')) { // own window, like an app (signed-in admin sessions carry over)
      const w = window.open('/admin/', 'satin-admin', 'popup,width=1440,height=900'); if (!w) location.href = '/admin/'; return;
    }
    const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; store.set('state', S); cur = null; drawRail(); drawMain(); drawSide(); };
}
function drawMain() {
  const m = $('#main');
  if (S.tab === 'recent') return drawRecent(m);
  if (S.tab === 'wraps') return drawWraps(m);
  const list = PRODUCTS.filter(p => tabOf(p) === S.tab);
  const groups = {};
  for (const p of list) { const g = groupName(p); (groups[g] = groups[g] || []).push(p); }
  m.innerHTML = `<h1>${esc(TABS.find(t => t.id === S.tab).label)}</h1>
    ${list.length > 12 ? '<label class="filter"><input type="search" placeholder="Filter…" data-filter></label>' : ''}
    ${Object.entries(groups).map(([g, ps]) => `<section class="grp"><h2>${esc(g)}</h2><div class="cards">${ps.map(cardHTML).join('')}</div></section>`).join('')}
    <div data-form></div>`;
  m.onclick = e => { const c = e.target.closest('[data-pid]'); if (c) openProduct(PRODUCTS.find(p => p.id === c.dataset.pid)); };
  const f = $('[data-filter]', m);
  if (f) f.oninput = () => { const q = norm(f.value); m.querySelectorAll('[data-pid]').forEach(c => c.hidden = q && !norm(c.textContent).includes(q)); m.querySelectorAll('.grp').forEach(s => s.hidden = ![...s.querySelectorAll('[data-pid]')].some(c => !c.hidden)); };
  if (cur && cur.product && tabOf(cur.product) === S.tab) drawForm();
}
const groupName = p => {
  const x = p.path;
  if (x.includes('/print-shop/offset/')) return 'Offset print';
  if (x.includes('/print-shop/large-format/')) return 'Signs & large format';
  if (x.includes('/print-shop/labels/')) return 'Labels & stickers';
  if (x.includes('/window-tint/')) return 'Window tint';
  if (x.includes('paint-protection-film')) return 'Paint protection film';
  if (x.includes('/window-graphics')) return 'Window graphics';
  if (x.includes('/wallpaper')) return 'Wallpaper';
  if (x.includes('/apparel/products/')) return ({ men: 'Men · T-shirts & tops', women: 'Women', youth: 'Youth', hats: 'Hats', totes: 'Bags' })[p.group] || 'Garments';
  if (x.includes('/apparel')) return 'Apparel (quick)';
  return 'Other';
};
const imgOf = p => { const i = (p.images || [])[0]; return i ? i.replace(/\.png$/, '.optimized.webp') : ''; };
const cardHTML = p => `<button class="card ${cur?.product?.id === p.id ? 'on' : ''}" data-pid="${esc(p.id)}">${imgOf(p) ? `<img loading="lazy" src="${esc(imgOf(p))}" alt="" onerror="this.onerror=null;this.src='${esc((p.images || [])[0] || '')}'">` : '<span class="ph"></span>'}<b>${esc(p.name)}</b></button>`;

/* ---------- vehicle wraps ---------- */
function drawWraps(m) {
  const v = cur?.vehicle || {};
  m.innerHTML = `<h1>Vehicle wraps</h1>
    <section class="step"><h2><span>1</span> Vehicle type</h2><div class="types">${VEH.types.map(t => { const b = t.bodies[0]; return `<button class="type ${v.type?.id === t.id ? 'on' : ''}" data-type="${t.id}">${b ? `<img loading="lazy" src="${esc(b.img)}" alt="">` : `<span class="busicon">${icon('car')}</span>`}<b>${esc(t.name)}</b></button>`; }).join('')}</div>
    <p class="hint">Tip: type the car in the search box at the top (e.g. “RAV4”, “Ram 1500”, “Transit 148 high”).</p></section>
    ${v.type && v.type.bodies.length ? `<section class="step"><h2><span>2</span> Closest body ${v.model ? `<em>· ${esc(v.model)}</em>` : '<em class="opt">optional — or choose the size below</em>'}</h2><div class="bodies">${v.type.bodies.map(b => `<button class="body ${v.body?.id === b.id ? 'on' : ''}" data-body="${b.id}"><img loading="lazy" src="${esc(b.img)}" alt=""><b>${esc(b.name)}</b></button>`).join('')}</div></section>` : ''}
    <div data-form></div>`;
  m.onclick = e => {
    const t = e.target.closest('[data-type]'); if (t) { pickVehicle(VEH.types.find(x => x.id === t.dataset.type)); return; }
    const b = e.target.closest('[data-body]'); if (b) { pickVehicle(cur.vehicle.type, cur.vehicle.type.bodies.find(x => x.id === b.dataset.body)); }
  };
  if (cur?.rule) drawForm();
}
async function pickVehicle(type, body, model, set) {
  body = body || null; // vehicle type alone = the website estimator's own starting choices; a body/model sets the size
  const product = PRODUCTS.find(p => p.ruleId === type.ruleId) || { id: type.ruleId, name: type.name, ruleId: type.ruleId, path: '' };
  const keep = cur?.rule?.id === type.ruleId ? cur.idx : null;
  await openProduct(product, { vehicle: { type, body, model: model || null }, keep });
  if (body) applyBody(body, set);
  S.tab = 'wraps'; store.set('state', S); drawRail(); drawMain(); quote();
  setTimeout(() => scrollMain($(type.bodies.length ? '.bodies' : '[data-form]')?.closest('.step') || $('[data-form]')), 40);
}
function applyBody(body, set) {
  const r = cur.rule;
  for (const [k, want] of Object.entries({ ...body.price, ...(set || {}) })) {
    const f = r.fields.find(f => f.key === k && f.type === 'select'); if (!f) continue;
    const w = norm(want);
    let i = f.options.findIndex(o => norm(o.label) === w);
    if (i < 0) i = f.options.findIndex(o => norm(o.label).startsWith(w) || w.startsWith(norm(o.label)));
    if (i < 0) i = f.options.findIndex(o => norm(o.label).includes(w.split(' ')[0]));
    if (i >= 0) { cur.idx[k] = i; cur.values[k] = f.options[i].value; }
  }
}

/* ---------- product form ---------- */
async function openProduct(product, extra = {}) {
  try {
    const rule = await getRule(product.ruleId);
    const values = {}, idx = {};
    for (const f of rule.fields) {
      if (f.type === 'select') { let i = f.options.findIndex(o => o.value === f.default); if (i < 0) i = 0; idx[f.key] = i; values[f.key] = f.options[i]?.value ?? 0; }
      else if (f.type === 'checkbox') values[f.key] = f.default ? 1 : 0;
      else values[f.key] = f.default ?? f.min ?? 0;
    }
    if (extra.keep) for (const [k, i] of Object.entries(extra.keep)) { const f = rule.fields.find(f => f.key === k); if (f && f.options[i] && !/^vehicle_/.test(k)) { idx[k] = i; values[k] = f.options[i].value; } }
    cur = { product, rule, values, idx, vehicle: extra.vehicle || null, quote: null, err: '' };
    if (S.tab !== 'wraps') { drawMain(); setTimeout(() => scrollMain($('[data-form]')), 30); }
    quote();
  } catch (e) { toast(e.message); }
}
const customSize = r => { const f = r.fields.find(f => f.key === 'size' && f.type === 'select'); return !f || /custom/i.test(f.options?.[cur.idx.size]?.label || ''); };
const visibleFields = r => r.fields.filter(f => !(cur.vehicle?.body && /^vehicle_\d$/.test(f.key)) && !/^legacy/i.test(f.help || '') // the chosen body sets vehicle size fields
  && !(['width', 'height'].includes(f.key) && !customSize(r))); // print: width/height only matter for a custom size
function drawForm() {
  const box = $('[data-form]'); if (!box || !cur) return;
  const r = cur.rule, vf = visibleFields(r), hidden = r.fields.filter(f => !vf.includes(f) && /^vehicle_\d$/.test(f.key) && f.options); // legacy fields stay out of sight
  const groups = []; let g = null;
  for (const f of vf) { const name = f.group || ''; if (!g || g.name !== name) groups.push(g = { name, fields: [] }); g.fields.push(f); }
  const qtyGrid = fs => fs.every(f => f.type === 'number' && /quantity$/i.test(f.label)) && fs.length > 2;
  box.innerHTML = `<section class="step form"><h2><span>${S.tab === 'wraps' ? (cur.vehicle?.type?.bodies.length ? 3 : 2) : '✓'}</span> ${esc(S.tab === 'wraps' ? 'Options' : cur.product.name)}</h2>
    ${groups.map(gr => `${gr.name ? `<h3>${esc(gr.name)}</h3>` : ''}<div class="${qtyGrid(gr.fields) ? 'qty-grid' : 'fields'}">${gr.fields.map(fieldHTML).join('')}</div>`).join('')}
    ${hidden.length ? `<details class="vdetail"><summary>Vehicle size used for the price: ${hidden.map(f => esc(f.options[cur.idx[f.key]]?.label || '')).join(' · ')}</summary><div class="fields">${hidden.map(fieldHTML).join('')}</div></details>` : ''}
  </section>`;
  box.oninput = box.onchange = e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const f = r.fields.find(f => f.key === el.dataset.k);
    if (f.type === 'number') { const n = Number(el.value); cur.values[f.key] = isFinite(n) ? n : 0; }
    else if (f.type === 'checkbox') cur.values[f.key] = el.checked ? 1 : 0;
    else { cur.idx[f.key] = Number(el.value); cur.values[f.key] = f.options[cur.idx[f.key]].value; }
    if (e.type === 'change' && f.type !== 'number') drawForm();
    quote();
  };
  box.onclick = e => {
    const seg = e.target.closest('[data-seg]'); if (seg) { const f = r.fields.find(f => f.key === seg.dataset.seg); cur.idx[f.key] = +seg.dataset.i; cur.values[f.key] = f.options[+seg.dataset.i].value; drawForm(); quote(); return; }
    const st = e.target.closest('[data-step]'); if (st) { const f = r.fields.find(f => f.key === st.dataset.k2); const step = Number(f.step) >= 1 ? Number(f.step) : 1; let n = (Number(cur.values[f.key]) || 0) + (+st.dataset.step) * step; if (f.min != null) n = Math.max(Number(f.min), n); if (f.max != null) n = Math.min(Number(f.max), n); cur.values[f.key] = n; const inp = box.querySelector(`input[data-k="${f.key}"]`); if (inp) inp.value = n; quote(); }
  };
}
function fieldHTML(f) {
  const v = cur.values[f.key], help = f.help ? `<small>${esc(f.help)}</small>` : '';
  if (f.type === 'select') {
    if (!Array.isArray(f.options) || !f.options.length) return '';
    const short = f.options.length <= 5 && f.options.every(o => String(o.label).length <= 30);
    if (short) return `<div class="field${f.options.length > 3 ? ' wide' : ''}"><span class="lbl">${esc(f.label)}</span><div class="seg">${f.options.map((o, i) => `<button type="button" class="${cur.idx[f.key] === i ? 'on' : ''}" data-seg="${f.key}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>${help}</div>`;
    return `<label class="field"><span class="lbl">${esc(f.label)}</span><select data-k="${f.key}">${f.options.map((o, i) => `<option value="${i}" ${cur.idx[f.key] === i ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${help}</label>`;
  }
  if (f.type === 'checkbox') {
    const lbl = f.key === 'design' ? `Design services · ${cur.rule.promo?.freeDesign ? 'free (promotion)' : '+' + money(designFee(cur.rule) * 100)}` : f.label;
    return `<label class="field chk"><input type="checkbox" data-k="${f.key}" ${v ? 'checked' : ''}><span class="sw"></span><span class="lbl">${esc(lbl)}</span>${f.key === 'design' ? '' : help}</label>`;
  }
  const unit = /\((inches|in)\)/i.test(f.label) ? 'in' : '';
  return `<label class="field num"><span class="lbl">${esc(f.label.replace(/ · quantity$/i, ''))}</span><div class="stepper"><button type="button" data-step="-1" data-k2="${f.key}" aria-label="Less">−</button><input type="number" inputmode="decimal" data-k="${f.key}" value="${esc(v)}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 'any'}"><button type="button" data-step="1" data-k2="${f.key}" aria-label="More">+</button></div>${unit ? '' : ''}${help}</label>`;
}

/* ---------- price ---------- */
let qTimer = 0, qSeq = 0;
function quote() {
  drawSide(true);
  clearTimeout(qTimer);
  qTimer = setTimeout(async () => {
    if (!cur) return;
    const seq = ++qSeq;
    try {
      const r = await fetch('/api/rules/quote', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Satin-Pricer': '1' }, body: JSON.stringify({ id: cur.rule.id, values: cur.values, page: 'pricer' }) });
      const d = await r.json();
      if (seq !== qSeq) return;
      if (!r.ok) { cur.quote = null; cur.err = d.error || 'Could not price this.'; }
      else { cur.quote = d.quote; cur.err = ''; }
    } catch { if (seq === qSeq) { cur.quote = null; cur.err = 'No connection to satingraphic.ca.'; } }
    drawSide();
  }, 180);
}
/* design fee exactly like the website ("I need a designer +$X"): constants.designFee → designDeposit → 250; promo = free */
const designFee = r => r.promo?.freeDesign ? 0 : Number((r.constants || {}).designFee ?? (r.constants || {}).designDeposit ?? 250);
const designCents = () => cur.values.design ? Math.round(designFee(cur.rule) * 100) : 0;
const onRequest = () => cur.quote && cur.rule.priceOnRequest && cur.quote.subtotal <= designCents();

/* ---------- shop estimates for "price on request" items ----------
   The website asks the customer to request a quote for these (no supplier price yet). In the shop the team still
   needs a number, so the app shows a market-based estimate (Toronto/GTA prices, autumn 2026), clearly marked. */
function calc(src, V) { // tiny, safe evaluator for the website's price formulas: numbers, names, + - * /, comparisons, && ||, if() round() max() min()
  const t = String(src).match(/\d*\.?\d+(?:e[-+]?\d+)?|[A-Za-z_]\w*|==|!=|>=|<=|&&|\|\||[-+*/(),<>!]/g) || []; let i = 0;
  const peek = () => t[i], eat = x => { if (t[i] !== x) throw new Error('formula'); i++; };
  const FN = { if: a => (a[0] ? a[1] : a[2]), round: a => Math.round(a[0]), max: a => Math.max(...a), min: a => Math.min(...a), ceil: a => Math.ceil(a[0]), floor: a => Math.floor(a[0]), abs: a => Math.abs(a[0]) };
  const prim = () => {
    const x = t[i++];
    if (x === '(') { const v = or(); eat(')'); return v; }
    if (x === '-') return -prim(); if (x === '+') return prim(); if (x === '!') return prim() ? 0 : 1;
    if (/^[\d.]/.test(x)) return Number(x);
    if (/^[A-Za-z_]/.test(x)) {
      if (peek() === '(') { i++; const a = []; if (peek() !== ')') { a.push(or()); while (peek() === ',') { i++; a.push(or()); } } eat(')'); if (!FN[x]) throw new Error('formula'); return FN[x](a); }
      return Number(V[x] ?? 0);
    }
    throw new Error('formula');
  };
  const mul = () => { let v = prim(); while (peek() === '*' || peek() === '/') { const o = t[i++], r = prim(); v = o === '*' ? v * r : (r ? v / r : 0); } return v; };
  const add = () => { let v = mul(); while (peek() === '+' || peek() === '-') { const o = t[i++], r = mul(); v = o === '+' ? v + r : v - r; } return v; };
  const cmp = () => { let v = add(); while (['==', '!=', '>', '<', '>=', '<='].includes(peek())) { const o = t[i++], r = add(); v = Number(o === '==' ? Math.abs(v - r) < 1e-9 : o === '!=' ? Math.abs(v - r) >= 1e-9 : o === '>' ? v > r : o === '<' ? v < r : o === '>=' ? v >= r : v <= r); } return v; };
  const and = () => { let v = cmp(); while (peek() === '&&') { i++; const r = cmp(); v = Number(!!v && !!r); } return v; };
  const or = () => { let v = and(); while (peek() === '||') { i++; const r = and(); v = Number(!!v || !!r); } return v; };
  const v = or(); if (i < t.length) throw new Error('formula'); return v;
}
const optLabel = k => { const f = cur.rule.fields.find(f => f.key === k); return f?.options?.[cur.idx[k]]?.label || ''; };
const pick = (lbl, table) => { const n = norm(lbl); for (const [k, v] of Object.entries(table)) if (n.includes(k)) return v; return null; };
const PPF_SIZE = l => pick(l, { suv: 1.15, pickup: 1.25, truck: 1.25, van: 1.25 }) ?? 1; // sedan / coupe = 1
const EST = {
  // XPEL/STEK-class gloss film, installed, GTA shops 2026: partial front ~$900–1,200 · full front ~$1,450–2,200 · full car ~$4,200–6,000+
  ppf: () => { const c = pick(optLabel('coverage'), { 'partial': 950, 'full front': 1850, 'full vehicle': 4900, 'full body': 4900 }); return c && Math.round(c * PPF_SIZE(optLabel('vehicle')) / 10) * 10; },
  'ppf-partial': () => pick(optLabel('plan'), { mirror: 250, 'partial': 950, 'full front': 1850, track: 2650 }),
  'ppf-full': () => pick(optLabel('plan'), { colour: 6900, color: 6900, matte: 5400, gloss: 4900 }),
  'window-graphics': () => Math.max(75, calc(cur.rule.formula, { ...cur.rule.constants, ...cur.values, design: 0, rate: Number(cur.rule.constants?.rate) || 12 })), // printed vinyl on glass ~$12/sq ft + install, $75 minimum
  apparel: { rate: 12 },            // heat-press print per sq ft of artwork
  'apparel-men-987': { unitPrice: 19, dtf: 15.9, vinyl: 15.9, embroidery: 19.5 }
};
const APPAREL_EST = { unitPrice: 14.5, dtf: 15.9, vinyl: 15.9, embroidery: 19.5 }; // typical blank tee + one print, same level as the priced Bella/Gildan items
function estimate() { // dollars before tax, design fee not included — or null
  const r = cur.rule, id = r.id, V = { ...(r.constants || {}), ...cur.values, design: 0 };
  try {
    let e = EST[id] ?? (/^apparel-/.test(id) && 'unitPrice' in (r.constants || {}) ? APPAREL_EST : null);
    if (typeof e === 'function') return e();
    if (e) { const fill = {}; for (const [k, v] of Object.entries(e)) if (!Number(V[k])) fill[k] = v; const n = calc(r.formula, { ...V, ...fill }); return n > 0 ? n : null; }
    // print with a custom / unpriced size: price of the nearest standard size, scaled by area
    const sf = r.fields.find(f => f.key === 'size' && f.type === 'select'); if (!sf) return null;
    const dims = l => { const m = String(l).match(/([\d.]+)\s*[×x]\s*([\d.]+)/); return m ? m[1] * m[2] : 0; };
    const area = dims(optLabel('size')) || (Number(cur.values.width) * Number(cur.values.height)) || 0; if (!area) return null;
    let best = null;
    for (const o of sf.options) { const a = dims(o.label); if (!a) continue; const p = calc(r.formula, { ...V, size: o.value }); if (p > 0 && (!best || Math.abs(Math.log(a / area)) < Math.abs(Math.log(best.a / area)))) best = { a, p }; }
    return best ? Math.max(best.p * area / best.a, best.p * 0.6) : null;
  } catch { return null; }
}
const estCents = () => { const d = onRequest() ? estimate() : null; return d ? Math.round(d * 100) + designCents() : null; };
function choiceLines() {
  const r = cur.rule, out = [];
  for (const f of r.fields) {
    if (/^legacy/i.test(f.help || '')) continue;
    if (['width', 'height'].includes(f.key) && !customSize(r)) continue;
    if (f.type === 'select') out.push([f.label, f.options[cur.idx[f.key]]?.label ?? '']);
    else if (f.type === 'checkbox') { if (cur.values[f.key]) out.push(f.key === 'design' ? ['Design services', designFee(r) ? money(designFee(r) * 100) : 'Free (promotion)'] : [f.label.replace(/ · \$.*$/, ''), 'Yes']); }
    else { const n = Number(cur.values[f.key]); if (n || !/quantity$/i.test(f.label)) out.push([f.label.replace(/ · quantity$/i, ''), String(n)]); }
  }
  return out.filter(([, v]) => v !== '');
}
/* the same "Vehicle base × multipliers" breakdown the website estimator shows */
function wrapBreakdown() {
  const r = cur.rule; if (!/^wrap-/.test(r.id) || !cur.quote || !(r.constants || {}).base) return '';
  const rows = [['Vehicle base', money(r.constants.base * 100)]];
  for (const f of r.fields) {
    const v = cur.values[f.key];
    if (f.type === 'select') { const lbl = f.options[cur.idx[f.key]]?.label || ''; if (f.unit === 'add') { if (v) rows.push([`${f.label}: ${lbl}`, '+ ' + money(v * 100)]); } else if (!/^vehicle_/.test(f.key) || v !== 1) rows.push([/^vehicle_/.test(f.key) ? `${f.label}: ${lbl}` : lbl + (f.key === 'material' ? ' film' : f.key === 'finish' ? ' finish' : ''), '× ' + Number(v).toFixed(2)]); }
    else if (f.key === 'roof' && v) rows.push(['Roof wrap', '× ' + Number(r.constants.roofMultiplier || 1).toFixed(2)]);
  }
  return `<ul class="lines bd">${rows.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>`;
}
function title() {
  if (cur.vehicle) { const v = cur.vehicle, base = v.body ? v.body.name : v.type.name; return v.model && v.model !== base ? `${v.model} · ${v.type.name}` : base; }
  return cur.product.name;
}
function drawSide(busy) {
  const s = $('#side');
  s.classList.toggle('has', !!cur); document.body.classList.toggle('has-price', !!cur);
  if (!cur) { s.classList.remove('open'); document.body.classList.remove('sheet-open'); s.innerHTML = `<div class="price empty"><p>Choose a ${S.tab === 'wraps' ? 'vehicle' : 'product'} to see the price.</p></div>`; return; }
  const q = cur.quote, tax = cur.rule.taxPercent ?? 13, por = onRequest(), est = por ? estCents() : null, estTax = est == null ? 0 : Math.round(est * tax / 100);
  s.innerHTML = `<div class="price ${busy ? 'busy' : ''}">
    <button type="button" class="sheet-h" data-sheet aria-label="Show price details"><i></i><span>${s.classList.contains('open') ? 'Hide details' : 'Details & copy'}</span></button>
    <small class="ttl">${esc(title())}</small>
    ${cur.err ? `<p class="err">${esc(cur.err)}</p>` : !q ? '<div class="big">…</div>' : por && est != null ? `<div class="big est">${money(est)}</div><small class="sub">Shop estimate · before tax · CAD</small>
      <div class="withtax"><span>With ${tax}% HST</span><b>${money(est + estTax)}</b></div>
      <p class="hint est-note">The website shows “price on request” for this item. This estimate follows current Toronto-area market prices — confirm the final price before booking.</p>` : por ? '<div class="big por">Price on request</div><p class="hint">This product is priced by our team (supplier price or custom size). Design fee only below.</p>' : `
      <div class="big">${money(q.subtotal)}</div><small class="sub">Before tax · CAD — same as the website</small>
      <div class="withtax"><span>With ${tax}% HST</span><b>${money(q.total)}</b></div>
      <dl><dt>Subtotal</dt><dd>${money(q.subtotal)}</dd>${q.discount ? `<dt>Discount</dt><dd>−${money(q.discount)}</dd>` : ''}<dt>HST ${tax}%</dt><dd>${money(q.tax)}</dd><dt class="t">Total</dt><dd class="t">${money(q.total)}</dd>
      ${q.deposit && q.deposit !== q.total ? `<dt>Deposit to book</dt><dd>${money(q.deposit)}</dd><dt>Balance</dt><dd>${money(q.balance)}</dd>` : ''}</dl>`}
    ${cur.rule.priceNote ? `<p class="hint">${esc(cur.rule.priceNote)}</p>` : ''}
    ${cur.rule.turnaround ? `<p class="hint">Turnaround: ${esc(cur.rule.turnaround)}</p>` : ''}
    ${wrapBreakdown()}
    <ul class="lines">${choiceLines().map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
    <label class="cust"><span>Customer name (optional)</span><input data-cust value="${esc(cur.customer || '')}" placeholder="for the copied text"></label>
    <div class="acts"><button class="btn" data-copy ${q && !cur.err ? '' : 'disabled'}>${icon('copy')} Copy for customer</button>
    <button class="btn ghost" data-short ${q && !cur.err ? '' : 'disabled'}>Copy price only</button>
    <button class="btn ghost" data-reset>${icon('reset')} Start over</button></div>
  </div>`;
  $('[data-cust]', s).oninput = e => { cur.customer = e.target.value; };
  $('[data-copy]', s).onclick = () => copy(fullText());
  $('[data-short]', s).onclick = () => copy(por ? (est != null ? `${title()}: about ${money(est)} + HST (estimate, to be confirmed)` : 'Price on request') : `${title()}: ${money(q.subtotal)} + HST (${money(q.total)} CAD with HST)`);
  $('[data-reset]', s).onclick = () => { cur = null; drawMain(); drawSide(); };
  $('[data-sheet]', s).onclick = () => { s.classList.toggle('open'); document.body.classList.toggle('sheet-open', s.classList.contains('open')); $('[data-sheet] span', s).textContent = s.classList.contains('open') ? 'Hide details' : 'Details & copy'; };
}
function fullText() {
  const q = cur.quote, tax = cur.rule.taxPercent ?? 13, L = [];
  L.push(cur.customer ? `Hi ${cur.customer.trim()}, here is your estimate from Satin Graphic:` : 'Satin Graphic — price estimate');
  L.push('', title());
  for (const [k, v] of choiceLines()) L.push(`• ${k}: ${v}`);
  L.push('');
  const est = onRequest() ? estCents() : null;
  if (est != null) L.push(`Estimated price: ${money(est)} + HST (about ${money(est + Math.round(est * tax / 100))} CAD with HST)`, 'We will confirm the exact price before booking.');
  else if (onRequest()) L.push('Price: on request — we will confirm it shortly.');
  else {
    L.push(`Price: ${money(q.subtotal)} + HST`);
    if (q.discount) L.push(`Discount: −${money(q.discount)}`);
    L.push(`HST (${tax}%): ${money(q.tax)}`, `Total with HST: ${money(q.total)} CAD`);
    if (q.deposit && q.deposit !== q.total) L.push(`Deposit to book: ${money(q.deposit)}`);
  }
  if (cur.rule.turnaround) L.push(`Turnaround: ${cur.rule.turnaround}`);
  L.push('', 'Estimate only — the final price is confirmed after we see the vehicle / artwork.', 'Satin Graphic · 50 Viceroy Rd, Unit 22–23, Vaughan · (905) 695-9147 · satingraphic.ca');
  return L.join('\n');
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  toast('Copied — paste it in WhatsApp or a text');
  if (cur?.quote) { const rec = store.get('recent', []); rec.unshift({ at: Date.now(), title: title(), total: onRequest() ? estCents() : cur.quote.subtotal, text, tab: S.tab }); store.set('recent', rec.slice(0, 30)); }
}
function drawRecent(m) {
  const rec = store.get('recent', []);
  m.innerHTML = `<h1>Recent prices</h1><p class="hint">The last prices copied on this computer.</p>
    ${rec.length ? `<div class="recent">${rec.map((r, i) => `<article><div><b>${esc(r.title)}</b><small>${esc(new Date(r.at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }))}</small></div><span>${r.total == null ? 'On request' : money(r.total) + ' + HST'}</span><button class="btn ghost sm" data-rc="${i}">${icon('copy')} Copy again</button></article>`).join('')}</div>` : '<p class="empty">Nothing yet.</p>'}`;
  m.onclick = e => { const b = e.target.closest('[data-rc]'); if (b) { navigator.clipboard.writeText(rec[+b.dataset.rc].text).then(() => toast('Copied')); } };
}

/* ---------- search (cars + products) ---------- */
function search(qs) {
  const q = norm(qs); if (q.length < 2) return [];
  const words = q.split(' ');
  const hit = s => { const n = norm(s); return words.every(w => n.includes(w)); };
  const out = [];
  for (const m of VEH.models) if (hit(m.name)) out.push({ kind: 'car', label: m.name, sub: bodyById(m.body)?.b.name || '', m });
  for (const t of VEH.types) for (const b of t.bodies) if (hit(b.name) && !out.some(o => o.m?.body === b.id && o.label === b.name)) out.push({ kind: 'body', label: b.name, sub: t.name, t, b });
  for (const t of VEH.types) if (hit(t.name)) out.push({ kind: 'type', label: t.name + ' wrap', sub: 'Vehicle type', t });
  for (const p of PRODUCTS) if (tabOf(p) && hit(p.name)) out.push({ kind: 'product', label: p.name, sub: TABS.find(t => t.id === tabOf(p)).label, p });
  return out.slice(0, 12);
}
const bodyById = id => { for (const t of VEH.types) { const b = t.bodies.find(b => b.id === id); if (b) return { t, b }; } return null; };
function wireSearch() {
  const inp = $('#q'), pop = $('#qpop'); let res = [], sel = 0;
  const show = () => { res = search(inp.value); sel = 0; pop.hidden = !res.length; pop.innerHTML = res.map((r, i) => `<button class="${i === sel ? 'on' : ''}" data-i="${i}"><b>${esc(r.label)}</b><small>${esc(r.sub)}</small></button>`).join(''); };
  const go = r => {
    pop.hidden = true; inp.value = ''; inp.blur();
    if (r.kind === 'car') { const x = bodyById(r.m.body); pickVehicle(x.t, x.b, r.m.name, r.m.set); }
    else if (r.kind === 'body') pickVehicle(r.t, r.b);
    else if (r.kind === 'type') pickVehicle(r.t);
    else { S.tab = tabOf(r.p); store.set('state', S); drawRail(); openProduct(r.p); }
  };
  inp.oninput = show;
  inp.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % Math.max(res.length, 1); pop.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === sel)); }
    if (e.key === 'Enter' && res[sel]) go(res[sel]);
    if (e.key === 'Escape') { pop.hidden = true; inp.blur(); }
  };
  pop.onmousedown = e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); go(res[+b.dataset.i]); } };
  inp.onblur = () => setTimeout(() => pop.hidden = true, 120);
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' || e.key === '/' && document.activeElement === document.body) { e.preventDefault(); inp.focus(); } });
}

/* ---------- install as a desktop app ---------- */
let deferred = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').hidden = true; };
/* iPhone / iPad: Safari has no install button — show how to add the app to the Home Screen once */
(() => {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (!ios || standalone || store.get('iosHint', 0) > 2) return;
  const d = document.createElement('div'); d.className = 'ios-hint';
  d.innerHTML = `<b>Install Satin Pricer</b><span>Tap <svg viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg> Share, then <b>Add to Home Screen</b>.</span><button type="button" aria-label="Close">×</button>`;
  d.querySelector('button').onclick = () => { d.remove(); store.set('iosHint', 9); };
  document.body.append(d); store.set('iosHint', store.get('iosHint', 0) + 1);
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/pricer/sw.js', { scope: '/pricer/' }).catch(() => {});

/* never leave a blank screen: show what went wrong and a reload button */
function showErr(m) {
  let b = $('#oops'); if (!b) { b = document.createElement('div'); b.id = 'oops'; b.className = 'oops'; document.body.append(b); }
  b.innerHTML = `<span>Something went wrong: ${esc(m)}</span><button type="button">Reload</button>`; b.querySelector('button').onclick = () => location.reload();
}
addEventListener('error', e => showErr(e.message || 'error'));
addEventListener('unhandledrejection', e => showErr(e.reason?.message || 'error'));

/* ---------- start ---------- */
(async () => {
  try {
    const [p, v] = await Promise.all([fetch('/api/products', { cache: 'no-store' }).then(r => r.json()), fetch('/pricer/vehicles.json?v=1').then(r => r.json())]);
    PRODUCTS = (p.products || []).filter(x => x.active !== false && x.ruleId && !(p.unavailablePaths || []).includes(x.path));
    VEH = v;
  } catch { $('#main').innerHTML = '<div class="loading">Could not reach satingraphic.ca. Check the internet connection and reopen the app.</div>'; return; }
  if (!TABS.some(t => t.id === S.tab) && S.tab !== 'recent') S.tab = 'wraps';
  drawRail(); drawMain(); drawSide(); wireSearch();
})();
