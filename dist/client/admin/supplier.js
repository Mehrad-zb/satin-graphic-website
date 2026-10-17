/* Satin Admin — Products & prices → Supplier prices (apparel cost table + label/sticker coefficients).
   Loaded on demand by catalog.js. Saves to /api/admin/catalog/supplier/*; every website price is still computed on the server. */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clone = o => JSON.parse(JSON.stringify(o));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const cad = n => n === null || n === undefined || !Number.isFinite(Number(n)) ? '—' : '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = n => Math.round(n * 100) / 100;
const GROUPS = { men: "Men's", women: "Women's", youth: 'Youth', hats: 'Headwear', totes: 'Totes' };
let TAB = 'apparel', FILTER = { q: '', g: '' }, DIRTY = false;

function css() {
  if (document.getElementById('sp-css')) return;
  const s = document.createElement('style'); s.id = 'sp-css';
  s.textContent = `.sp-tabs{display:flex;gap:8px;margin:0 0 16px}.sp-tabs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 16px;font-weight:600;cursor:pointer}.sp-tabs button.on{background:#17191e;color:#fff;border-color:#17191e}
  .sp-glob{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end}.sp-glob .field{margin:0}
  .sp-tiers{display:flex;flex-wrap:wrap;gap:10px}.sp-tiers label{display:flex;align-items:center;gap:6px;font-size:13px}.sp-tiers input{width:78px}
  .sp-bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.sp-bulk input{width:90px}
  .sp-models{display:flex;flex-direction:column;gap:10px}.sp-model{background:#fff;border-radius:12px;box-shadow:var(--shadow);padding:14px 16px;display:grid;grid-template-columns:minmax(220px,1.1fr) 2.4fr;gap:14px;align-items:start}
  .sp-model.off{opacity:.55}.sp-model h3{font-size:14.5px;margin:0 0 4px;line-height:1.3}.sp-model h3 a{color:inherit;text-decoration:none}.sp-model small{color:var(--mut);display:block;font-size:12px}
  .sp-row{display:flex;flex-wrap:wrap;gap:8px}.sp-cell{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
  .sp-cell input{width:78px;padding:7px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:14px;color:var(--ink,#17191e);text-transform:none;letter-spacing:0;font-weight:500}.sp-cell input.wide{width:92px}.sp-cell input:focus{outline:2px solid #c8184a33;border-color:#c8184a}
  .sp-cell .sell{font-size:12.5px;color:#0f7a45;font-weight:600;text-transform:none;letter-spacing:0}.sp-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
  .sp-sizes{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}
  .sp-lab{display:grid;grid-template-columns:1fr 1fr;gap:16px}.sp-lab table{width:100%;border-collapse:collapse;font-size:13.5px}.sp-lab td,.sp-lab th{padding:6px 8px;border-bottom:1px solid #f1f2f4;text-align:left}.sp-lab td input{width:90px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font:inherit}
  .sp-prev td,.sp-prev th{text-align:right}.sp-prev td:first-child,.sp-prev th:first-child{text-align:left}
  @media (max-width:860px){.sp-model{grid-template-columns:1fr}.sp-lab{grid-template-columns:1fr}}`;
  document.head.append(s);
}

async function view() {
  css();
  const c = A().shell('Supplier prices', 'Products & prices', '<div class="card empty">Loading…</div>', '/catalog');
  $('[data-actions]').innerHTML = `<div class="cust-acts"><a class="btn ghost sm" href="#/catalog">← All products</a><button class="btn ghost sm" data-csv>⬇ Export CSV</button><label class="btn ghost sm">⬆ Import CSV<input type="file" accept=".csv,text/csv" hidden data-imp></label><button class="btn sm" data-save>Saved</button></div>`;
  let d; try { d = await A().api('/catalog/supplier'); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const AP = clone(d.apparel), LB = clone(d.labels); DIRTY = false;
  const saveBtn = () => $('[data-save]');
  const dirty = () => { DIRTY = true; const s = saveBtn(); s.classList.add('pulse'); s.textContent = 'Save changes'; };
  addEventListener('beforeunload', e => { if (DIRTY) { e.preventDefault(); e.returnValue = ''; } });

  const sell = (m, cost, sizeless) => { const mk = m.model.markup === null || m.model.markup === '' || m.model.markup === undefined ? num(AP.markup) : num(m.model.markup); return r2((num(cost) + num(m.model.print1)) * mk); };
  const draw = () => {
    c.innerHTML = `<div class="sp-tabs"><button data-tab="apparel" class="${TAB === 'apparel' ? 'on' : ''}">Apparel (garment + printing)</button><button data-tab="labels" class="${TAB === 'labels' ? 'on' : ''}">Labels &amp; stickers</button></div><div data-body></div>`;
    $$('[data-tab]', c).forEach(b => b.onclick = () => { TAB = b.dataset.tab; draw(); });
    if (TAB === 'apparel') drawApparel($('[data-body]', c)); else drawLabels($('[data-body]', c));
  };

  /* ---------------- apparel ---------------- */
  function drawApparel(box) {
    const tiers = [0, 1, 2].map(i => AP.tiers[i] || { min: 0, pct: 0 });
    box.innerHTML = `<section class="card"><h2>All apparel <span class="sub">cost from SinaLite × markup = price per piece on the website</span></h2>
      <div class="sp-glob"><label class="field"><span>Markup × (all garments)</span><input type="number" step="0.01" min="0.5" max="10" data-a="markup" value="${esc(AP.markup)}"></label>
      <label class="field"><span>Vinyl heat press add-on / piece</span><input type="number" step="0.01" min="0" data-a="vinylAdd" value="${esc(AP.vinylAdd)}"></label>
      <label class="field"><span>Embroidery add-on / piece</span><input type="number" step="0.01" min="0" data-a="embroideryAdd" value="${esc(AP.embroideryAdd)}"></label></div>
      <p class="hint">Price per piece = (garment cost for the size + print cost) × markup + add-on. Print cost = 1-side cost for the first print location + (2 sides − 1 side) for each extra front / back / left-chest location. A markup on a garment row overrides the global markup. Bigger sizes (2XL+) cost more automatically.</p>
      <div class="sp-tiers"><b style="font-size:13px;align-self:center">Quantity discounts:</b>${tiers.map((t, i) => `<label>from <input type="number" min="0" step="1" data-tq="${i}" value="${esc(t.min)}"> pieces · <input type="number" min="0" max="90" step="0.5" data-tp="${i}" value="${esc(t.pct)}"> % off</label>`).join('')}<small class="hint">Use 0 to switch a row off.</small></div>
      <div class="sp-bulk"><b style="font-size:13px">Bulk change (shown garments):</b><label class="sp-cell" style="flex-direction:row;align-items:center;gap:6px">garment costs <input type="number" step="0.5" value="0" data-bpct> %</label><button class="btn ghost sm" data-bcost>Apply % change</button>
      <label class="sp-cell" style="flex-direction:row;align-items:center;gap:6px">print costs <input type="number" step="0.5" value="0" data-bppct> %</label><button class="btn ghost sm" data-bprint>Apply % change</button>
      <label class="sp-cell" style="flex-direction:row;align-items:center;gap:6px">markup <input type="number" step="0.01" placeholder="global" data-bmk></label><button class="btn ghost sm" data-bmarkup>Set markup</button></div>
      <p class="hint" style="margin-bottom:0">${esc(d.defaults?.source?.apparel || '')} Last saved ${esc(A().fmtDate(AP.updatedAt))}${AP.updatedBy ? ' by ' + esc(AP.updatedBy) : ''}.</p></section>
      <div class="toolbar"><input class="input" data-q placeholder="Search garments (name or style code)" value="${esc(FILTER.q)}"><select class="input" data-g><option value="">All groups</option>${Object.entries(GROUPS).map(([k, v]) => `<option value="${k}" ${FILTER.g === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="cust-count" data-count></span></div>
      <div class="sp-models" data-models></div>`;
    $$('[data-a]', box).forEach(el => el.oninput = () => { AP[el.dataset.a] = el.value === '' ? '' : num(el.value); dirty(); drawRows(); });
    const syncTiers = () => { AP.tiers = [0, 1, 2].map(i => ({ min: num($(`[data-tq="${i}"]`, box).value), pct: num($(`[data-tp="${i}"]`, box).value) })).filter(t => t.min > 0 && t.pct > 0); dirty(); };
    $$('[data-tq],[data-tp]', box).forEach(el => el.oninput = syncTiers);
    $('[data-q]', box).oninput = e => { FILTER.q = e.target.value; drawRows(); };
    $('[data-g]', box).onchange = e => { FILTER.g = e.target.value; drawRows(); };
    const shown = () => AP.models.filter(m => (!FILTER.g || m.id.startsWith('apparel-' + FILTER.g + '-')) && (!FILTER.q || (m.name + ' ' + m.id).toLowerCase().includes(FILTER.q.toLowerCase())));
    $('[data-bcost]', box).onclick = () => { const p = num($('[data-bpct]', box).value); if (!p) return A().toast('Enter a % (e.g. 5 or -3)'); const rs = shown(); if (!confirm(`Change garment costs of ${rs.length} garments by ${p}%?`)) return; for (const m of rs) for (const k of Object.keys(m.model.sizes)) m.model.sizes[k] = r2(num(m.model.sizes[k]) * (1 + p / 100)); dirty(); drawRows(); };
    $('[data-bprint]', box).onclick = () => { const p = num($('[data-bppct]', box).value); if (!p) return A().toast('Enter a % (e.g. 5 or -3)'); const rs = shown(); if (!confirm(`Change print costs of ${rs.length} garments by ${p}%?`)) return; for (const m of rs) { m.model.print1 = r2(num(m.model.print1) * (1 + p / 100)); if (m.model.print2 !== null && m.model.print2 !== '') m.model.print2 = r2(num(m.model.print2) * (1 + p / 100)); } dirty(); drawRows(); };
    $('[data-bmarkup]', box).onclick = () => { const v = $('[data-bmk]', box).value; const rs = shown(); if (!confirm(v === '' ? `Use the global markup for ${rs.length} garments?` : `Set markup ${v}× for ${rs.length} garments?`)) return; for (const m of rs) m.model.markup = v === '' ? null : num(v); dirty(); drawRows(); };
    function drawRows() {
      const rs = shown(); $('[data-count]', box).textContent = `${rs.length} garment${rs.length === 1 ? '' : 's'}`;
      $('[data-models]', box).innerHTML = rs.map(m => {
        const sizes = m.sizes.length ? m.sizes : Object.keys(m.model.sizes);
        return `<div class="sp-model${m.model.enabled === false ? ' off' : ''}" data-id="${esc(m.id)}"><div><h3><a href="#/catalog/edit?id=${encodeURIComponent(m.id)}">${esc(m.name)}</a></h3><small>${esc(m.id)}${m.active ? '' : ' · hidden on website'}</small>
          <div class="sp-meta"><label class="chkrow" style="font-size:13px"><input type="checkbox" data-en ${m.model.enabled === false ? '' : 'checked'}> Use these prices</label>${m.model.source ? `<a class="hint" href="${esc(m.model.source)}" target="_blank" rel="noopener">SinaLite ↗</a>` : ''}</div>${m.model.note ? `<small>${esc(m.model.note)}</small>` : ''}</div>
          <div><div class="sp-row"><label class="sp-cell">Markup ×<input class="wide" type="number" step="0.01" min="0.5" data-mk placeholder="${esc(AP.markup)}" value="${m.model.markup === null || m.model.markup === undefined ? '' : esc(m.model.markup)}"></label>
          <label class="sp-cell">Print 1 side<input type="number" step="0.01" min="0" data-p1 value="${esc(m.model.print1 ?? '')}"></label><label class="sp-cell">Print 2 sides<input type="number" step="0.01" min="0" data-p2 value="${esc(m.model.print2 ?? '')}"></label></div>
          <div class="sp-sizes">${sizes.map(s => `<label class="sp-cell">${esc(s)} cost<input type="number" step="0.01" min="0" data-size="${esc(s)}" value="${esc(m.model.sizes[s] ?? '')}" placeholder="—"><span class="sell" data-sell="${esc(s)}">${m.model.sizes[s] !== undefined && m.model.sizes[s] !== '' ? cad(sell(m, m.model.sizes[s])) : 'on request'}</span></label>`).join('')}</div></div></div>`;
      }).join('') || '<div class="card empty">No garments match.</div>';
      $$('.sp-model', box).forEach(row => {
        const m = AP.models.find(x => x.id === row.dataset.id);
        const upd = () => $$('[data-sell]', row).forEach(sp => { const v = m.model.sizes[sp.dataset.sell]; sp.textContent = v !== undefined && v !== '' ? cad(sell(m, v)) : 'on request'; });
        $('[data-en]', row).onchange = e => { m.model.enabled = e.target.checked; row.classList.toggle('off', !e.target.checked); dirty(); };
        $('[data-mk]', row).oninput = e => { m.model.markup = e.target.value === '' ? null : num(e.target.value); dirty(); upd(); };
        $('[data-p1]', row).oninput = e => { m.model.print1 = e.target.value === '' ? null : num(e.target.value); dirty(); upd(); };
        $('[data-p2]', row).oninput = e => { m.model.print2 = e.target.value === '' ? null : num(e.target.value); dirty(); };
        $$('[data-size]', row).forEach(inp => inp.oninput = () => { if (inp.value === '') delete m.model.sizes[inp.dataset.size]; else m.model.sizes[inp.dataset.size] = num(inp.value); dirty(); upd(); });
      });
    }
    drawRows();
  }

  /* ---------------- labels ---------------- */
  const KINDS = [['roll', 'Roll labels', 'SinaLite roll-label costs (fitted)'], ['sheet', 'Sticker sheets', 'in-house estimate — set your own'], ['diecut', 'Die-cut stickers', 'in-house estimate — set your own']];
  const labelPrice = (P, w, h, q, i = {}) => {
    const sq = (P.squareShapes || [2, 3]).includes(i.shape ?? 0);
    const area = (w + num(P.bleedIn)) * ((sq ? w : h) + num(P.bleedIn));
    let rate = 0; for (const t of [...P.rates].sort((a, b) => a.from - b.from)) if (q >= t.from) rate = num(t.rate);
    const f = k => num(P[k]?.[i[k] ?? 0]?.factor ?? 1);
    const cost = Math.max(num(P.minCost), num(P.setup) + q * area * rate * f('materials') * f('finishes') * f('shapes') * (P.inks?.length ? f('inks') : 1));
    const mk = P.markup === null || P.markup === undefined || P.markup === '' ? num(LB.markup) : num(P.markup);
    return { cost: r2(cost), price: r2(cost * mk) };
  };
  function drawLabels(box) {
    box.innerHTML = `<section class="card"><h2>All labels &amp; stickers</h2><div class="sp-glob">
      <label class="field"><span>Markup × on cost</span><input type="number" step="0.01" min="0.5" data-l="markup" value="${esc(LB.markup)}"></label>
      <label class="field"><span>Design services fee $</span><input type="number" step="1" min="0" data-l="designFee" value="${esc(LB.designFee)}"></label></div>
      <p class="hint">Website price = cost × markup. Cost = max(minimum, set-up + quantity × width × height (in, + gap) × rate for that quantity × material × finish × shape × ink). Turnaround is shown as text on the product pages (no rush option). ${esc(d.defaults?.source?.labels || '')}</p></section>
      ${KINDS.map(([k, name, src]) => { const P = LB[k]; return `<section class="card" data-kind="${k}"><h2>${name} <span class="sub">${src}</span></h2><div class="sp-lab"><div>
        <div class="sp-glob"><label class="field"><span>Set-up cost / order $</span><input type="number" step="0.01" data-p="setup" value="${esc(P.setup)}"></label><label class="field"><span>Minimum cost $</span><input type="number" step="0.01" data-p="minCost" value="${esc(P.minCost)}"></label>
        <label class="field"><span>Gap / bleed per side (in)</span><input type="number" step="0.0625" data-p="bleedIn" value="${esc(P.bleedIn)}"></label><label class="field"><span>Markup × (blank = all)</span><input type="number" step="0.01" data-p="markup" placeholder="${esc(LB.markup)}" value="${P.markup === null || P.markup === undefined ? '' : esc(P.markup)}"></label></div>
        <table><thead><tr><th>Rate tier · from quantity</th><th>$ per sq in</th></tr></thead><tbody>${P.rates.map((t, i) => `<tr><td>${i === 0 ? '0 (first tier)' : `<input type="number" step="1" data-rf="${i}" value="${esc(t.from)}">`}</td><td><input type="number" step="0.0001" data-rr="${i}" value="${esc(t.rate)}"></td></tr>`).join('')}</tbody></table>
        ${['materials', 'finishes', 'shapes', 'inks'].filter(l => P[l]?.length).map(l => `<table><thead><tr><th>${l[0].toUpperCase() + l.slice(1)}</th><th>Cost factor ×</th></tr></thead><tbody>${P[l].map((x, i) => `<tr><td>${esc(x.label)}${x.requires?.material ? ` <small class="hint">(only with ${esc(x.requires.material.map(v => (P.materials.find((m, j) => (m.value ?? j) === v) || {}).label || v).join(', '))})</small>` : ''}</td><td><input type="number" step="0.01" min="0.1" data-fl="${l}" data-fi="${i}" value="${esc(x.factor)}"></td></tr>`).join('')}</tbody></table>`).join('')}
        </div><div><b style="font-size:13px">Preview · ${esc(P.materials[0].label)}, ${esc(P.finishes[0].label)}</b><table class="sp-prev" data-prev></table><p class="hint">Website prices before tax (cost in grey). Quantities offered: ${P.quantities.map(q => q.toLocaleString('en-CA')).join(', ')}.${P.turnaround ? ` Turnaround: ${esc(P.turnaround)}.` : ''}</p></div></div></section>`; }).join('')}`;
    $$('[data-l]', box).forEach(el => el.oninput = () => { LB[el.dataset.l] = num(el.value); dirty(); prev(); });
    $$('[data-kind]', box).forEach(sec => { const P = LB[sec.dataset.kind];
      $$('[data-p]', sec).forEach(el => el.oninput = () => { P[el.dataset.p] = el.value === '' && el.dataset.p === 'markup' ? null : num(el.value); dirty(); prev(); });
      $$('[data-rf]', sec).forEach(el => el.oninput = () => { P.rates[+el.dataset.rf].from = num(el.value); dirty(); prev(); });
      $$('[data-rr]', sec).forEach(el => el.oninput = () => { P.rates[+el.dataset.rr].rate = num(el.value); dirty(); prev(); });
      $$('[data-fl]', sec).forEach(el => el.oninput = () => { P[el.dataset.fl][+el.dataset.fi].factor = num(el.value); dirty(); prev(); });
    });
    function prev() {
      $$('[data-kind]', box).forEach(sec => { const P = LB[sec.dataset.kind]; const sizes = [[2, 2], [3, 2], [3, 3], [4, 6]]; const qs = P.quantities.filter((q, i) => i % 2 === 0 || i === P.quantities.length - 1).slice(0, 5);
        $('[data-prev]', sec).innerHTML = `<thead><tr><th>Size (in)</th>${qs.map(q => `<th>${q.toLocaleString('en-CA')}</th>`).join('')}</tr></thead><tbody>${sizes.map(([w, h]) => `<tr><td>${w} × ${h}</td>${qs.map(q => { const v = labelPrice(P, w, h, q); return `<td>${cad(v.price)}<br><small style="color:var(--mut)">${cad(v.cost)}</small></td>`; }).join('')}</tr>`).join('')}</tbody>`; });
    }
    prev();
  }
  draw();

  saveBtn().onclick = async () => {
    const b = saveBtn(); b.disabled = true;
    try {
      const models = {}; for (const m of AP.models) models[m.id] = { enabled: m.model.enabled !== false, markup: m.model.markup ?? null, print1: m.model.print1 ?? null, print2: m.model.print2 ?? null, sizes: m.model.sizes };
      const ra = await A().api('/catalog/supplier/apparel', { expectedRevision: AP.revision, markup: AP.markup, vinylAdd: AP.vinylAdd || 0, embroideryAdd: AP.embroideryAdd || 0, tiers: AP.tiers, models });
      AP.revision = ra.revision;
      const pack = P => ({ setup: P.setup, minCost: P.minCost, bleedIn: P.bleedIn, markup: P.markup ?? null, rates: P.rates.map(t => ({ from: t.from, rate: t.rate })), materials: P.materials.map(x => ({ factor: x.factor })), finishes: P.finishes.map(x => ({ factor: x.factor })), shapes: P.shapes.map(x => ({ factor: x.factor })), inks: (P.inks || []).map(x => ({ factor: x.factor })) });
      const rl = await A().api('/catalog/supplier/labels', { expectedRevision: LB.revision, markup: LB.markup, rushPct: LB.rushPct, designFee: LB.designFee, roll: pack(LB.roll), sheet: pack(LB.sheet), diecut: pack(LB.diecut) });
      LB.revision = rl.revision;
      DIRTY = false; b.classList.remove('pulse'); b.textContent = 'Saved'; A().toast('Prices saved — the website uses them now');
    } catch (e) { A().toast(e.message); } finally { b.disabled = false; }
  };
  $('[data-csv]').onclick = () => {
    const rows = [['Model ID', 'Garment', 'Size', 'Cost', 'Print 1 side', 'Print 2 sides', 'Markup (blank = global)', 'Use prices (yes/no)']];
    for (const m of AP.models) for (const s of (m.sizes.length ? m.sizes : Object.keys(m.model.sizes))) rows.push([m.id, m.name, s, m.model.sizes[s] ?? '', m.model.print1 ?? '', m.model.print2 ?? '', m.model.markup ?? '', m.model.enabled === false ? 'no' : 'yes']);
    A().downloadCSV(`satin-apparel-costs-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };
  $('[data-imp]').onchange = e => {
    const f = e.target.files[0]; if (!f) return; const fr = new FileReader();
    fr.onload = () => {
      const all = A().csvParse(String(fr.result)); let n = 0, bad = 0;
      for (const r of all.slice(1)) { const m = AP.models.find(x => x.id === (r[0] || '').trim()); if (!m || !r[2]) { bad++; continue; }
        const s = r[2].trim(); if (r[3] !== '' && Number.isFinite(Number(r[3]))) m.model.sizes[s] = num(r[3]);
        if (r[4] !== '' && Number.isFinite(Number(r[4]))) m.model.print1 = num(r[4]); if (r[5] !== '' && Number.isFinite(Number(r[5]))) m.model.print2 = num(r[5]);
        m.model.markup = r[6] === '' || r[6] === undefined ? null : num(r[6]); if (r[7]) m.model.enabled = !/^n/i.test(r[7]); n++; }
      TAB = 'apparel'; dirty(); draw(); A().toast(`${n} rows loaded${bad ? `, ${bad} skipped` : ''} — check and click Save changes`);
    };
    fr.readAsText(f, 'utf-8'); e.target.value = '';
  };
}
window.SatinSupplier = { view };
})();
