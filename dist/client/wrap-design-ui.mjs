// Shop wrap design product pages (/satin/shop/vehicle-wrap-designs/<slug>, price rules design-<slug>).
// Mounted by services-ui.mjs mountProductExtras() once the price form is ready. Adds: a large hero banner, a gallery
// (lightbox) of the design on real vehicle photos, a "Need adjustment(s)?" card, file + material lines in "Your order",
// quote-only handling for "Printed and installed", and a "What you receive" section (files, software, sizes, licence).
// Images: /satin/img/wrap-designs/<slug>/<view>-<width>.webp built by scripts/wrap-designs/build.mjs (manifest.json).
// Photos the owner uploads in Admin → Products (configured.images) are shown first.
import {translateTree} from '/studio/i18n.mjs';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const BASE = '/satin/img/wrap-designs/';
const money = n => new Intl.NumberFormat('en-CA', {style: 'currency', currency: 'CAD', maximumFractionDigits: n % 1 ? 2 : 0}).format(n);
let manifestP = null;
const manifest = () => manifestP ||= fetch(BASE + 'manifest.json').then(r => r.ok ? r.json() : null).catch(() => null);
const ICON = {
  download: '<path d="M12 3v12m0 0l-5-5m5 5l5-5M4 17v3h16v-3"/>', file: '<path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6"/>', layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>', shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5 9-10"/>', mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', wand: '<path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5M11 8v6M8 11h6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', l: '<path d="M15 5l-7 7 7 7"/>', r: '<path d="M9 5l7 7-7 7"/>',
};
const icon = (k, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const SOFTWARE = [['Adobe Illustrator', 'PDF · SVG · AI/EPS'], ['CorelDRAW', 'PDF · SVG · EPS'], ['Affinity Designer', 'PDF · SVG'], ['Inkscape (free)', 'SVG · PDF'], ['FlexiSIGN / SAi', 'PDF · EPS'], ['Adobe Acrobat', 'PDF proofing']];
const SIZES = [['High-roof cargo van (Sprinter, Transit, ProMaster)', '≈ 240 × 84 in per side'], ['Mid / low-roof cargo van', '≈ 220 × 64 in per side'], ['Crew-cab pickup', '≈ 230 × 46 in per side'], ['Minivan / SUV', '≈ 200 × 45 in per side'], ['16 ft box truck', '≈ 192 × 96 in per side']];
const FILE_INFO = [[/\.pdf$/i, 'Print-ready vector PDF', 'Driver + passenger side panels at 1:1 (144 × 54 in), fonts embedded.'], [/\.svg$/i, 'Layered vector source (SVG)', 'Separate layers for background, graphics and text placeholders.'], [/\.jpe?g$/i, 'Preview JPG', 'Mockup preview for approvals (not for print).'], [/\.txt$/i, 'README', 'Colours, licence summary and set-up steps.'], [/\.(ai|eps)$/i, 'Adobe Illustrator / EPS', 'Editable vector file.']];

const rank = f => { const i = FILE_INFO.findIndex(([re]) => re.test(f)); return i < 0 ? 99 : i; };
function views(slug, m, configured) {
  const d = m?.designs?.[slug], out = [];
  for (const src of configured?.images || []) out.push({src, srcset: '', caption: configured.name || 'Design photo', w: 1600, h: 900, own: true});
  if (d) for (const v of m.views) { const x = d.views[v.key]; if (!x) continue; out.push({key: v.key, src: `${BASE}${slug}/${v.key}-${x.widths.at(-1)}.webp`, srcset: x.widths.map(w => `${BASE}${slug}/${v.key}-${w}.webp ${w}w`).join(', '), caption: v.caption, w: x.w, h: x.h}); }
  return out;
}
const img = (v, sizes, attrs = '') => `<img src="${esc(v.src)}" ${v.srcset ? `srcset="${esc(v.srcset)}" sizes="${sizes}"` : ''} width="${v.w}" height="${v.h}" alt="${esc(v.caption)}" decoding="async" ${attrs}>`;

export async function mountWrapDesign(box, rule, configured, getValues) {
  const slug = rule.id.replace(/^design-/, ''), main = box.closest('main') || document.getElementById('main'), page = main?.querySelector('.page-enter');
  if (!page || page.querySelector('[data-wd-gallery]')) return;
  if (!document.querySelector('link[data-wd-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/wrap-design.css'; l.dataset.wdCss = ''; document.head.append(l); }
  const m = await manifest(), d = m?.designs?.[slug], list = views(slug, m, configured);
  if (!box.isConnected) return;
  const name = (configured?.name || rule.label).replace(/ design$/i, ''), digital = rule.fields.find(f => f.key === 'purchase')?.options.find(o => o.value > 0)?.value || 149;
  const fee = Number(rule.constants?.adjustFee) || 0, fileName = configured?.digitalFileName || d?.package?.file || slug + '-wrap-design.zip';
  page.classList.add('wd-page');
  page.querySelectorAll('.design-preview-gallery').forEach(g => g.closest('section')?.remove()); // old SVG illustrations
  const cfgSection = box.closest('section');

  /* ---- hero banner ---- */
  const hero = page.querySelector('.phero'), first = list[0];
  if (hero && first) {
    hero.classList.add('wd-hero');
    const c = d?.colours || ['#e8314a', '#111'];
    hero.style.setProperty('--wd-c1', c[0]); hero.style.setProperty('--wd-c2', c[1] === '#ffffff' ? c[0] : c[1]);
    hero.querySelector('.wrap')?.insertAdjacentHTML('beforeend', `<div class="wd-hero-meta"><span class="wd-price-chip"><b>${money(digital)}</b> digital file</span><span>${icon('download', 16)} Instant download after payment</span><span>${icon('wand', 16)} Adjust to your vehicle +${money(fee || 100)}</span><a class="btn sm" href="#wd-buy" data-wd-jump>Buy this design</a></div>
      <figure class="wd-banner"><button type="button" class="wd-banner-btn" data-wd-open="0" aria-label="Enlarge image">${img(first, '(max-width: 1240px) 100vw, 1200px', 'fetchpriority="high"')}</button><figcaption>${esc(first.caption)}</figcaption></figure>`);
  }

  /* ---- gallery ---- */
  const gal = document.createElement('section');
  gal.className = 'sec wd-gallery-sec'; gal.dataset.wdGallery = '';
  gal.innerHTML = `<div class="wrap"><div class="wd-head"><span class="eyebrow">Gallery</span><h2 class="d3">${esc(name)} from every side we can show truthfully</h2><p class="lede">Rendered on real side-profile vehicle photos — driver side, passenger side (mirrored layout with readable text), other body styles, a close-up at actual pixels and the flat print layout.</p></div>
  <div class="wd-gallery"><div class="wd-stage"><button type="button" class="wd-stage-btn" data-wd-open="0" aria-label="Enlarge image">${img(list[0] || {src: '', caption: ''}, '(max-width: 900px) 100vw, 880px')}</button><p class="wd-stage-cap" aria-live="polite">${esc(list[0]?.caption || '')}</p></div>
  <div class="wd-thumbs" role="list">${list.map((v, i) => `<button type="button" role="listitem" class="wd-thumb" data-wd-pick="${i}" aria-pressed="${i === 0}" aria-label="${esc(v.caption)}"><img src="${esc(v.srcset ? v.src.replace(/-\d+\.webp$/, '-640.webp') : v.src)}" alt="" width="${v.w}" height="${v.h}" loading="lazy" decoding="async"><span>${esc(v.caption.split(' · ')[1] || v.caption)}</span></button>`).join('')}</div></div>
  <p class="small wd-note">Front, rear and roof panels are laid out on your exact vehicle template when you add an adjustment. Logo, phone and web text are placeholders for your branding.</p></div>`;
  (hero || cfgSection)?.after(gal);
  let current = 0;
  const pick = i => { current = (i + list.length) % list.length; const v = list[current], im = gal.querySelector('.wd-stage img'); im.removeAttribute('srcset'); if (v.srcset) im.srcset = v.srcset; im.src = v.src; im.alt = v.caption; im.width = v.w; im.height = v.h; gal.querySelector('.wd-stage-btn').dataset.wdOpen = current; gal.querySelector('.wd-stage-cap').textContent = v.caption; gal.querySelectorAll('[data-wd-pick]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.wdPick === current))); };
  gal.addEventListener('click', e => { const b = e.target.closest('[data-wd-pick]'); if (b) pick(+b.dataset.wdPick); });

  /* ---- what you receive ---- */
  const files = (configured?.deliveryFiles?.length ? configured.deliveryFiles.map(t => { const [a, ...b] = t.split(/\s[—–-]\s|:\s/); return [a, b.join(' — ')]; }) : (d?.package?.files || []).slice().sort((a, b) => rank(a) - rank(b)).map(f => { const x = FILE_INFO.find(([re]) => re.test(f)); return x ? [x[1], x[2] + ` (${f})`] : [f, '']; }));
  const layout = list.find(v => v.key === 'layout'), detail = list.find(v => v.key === 'detail');
  const info = document.createElement('section');
  info.className = 'sec alt wd-info'; info.dataset.wdInfo = '';
  info.innerHTML = `<div class="wrap"><div class="wd-head"><span class="eyebrow">What you receive</span><h2 class="d3">Files, software and delivery</h2><p class="lede">Everything you need to print ${esc(name)} at any wrap shop — or let us adapt, print and install it.</p></div>
  ${layout || detail ? `<div class="wd-info-media">${layout ? `<figure><button type="button" data-wd-open="${list.indexOf(layout)}" aria-label="Enlarge the flat layout">${img(layout, '(max-width: 700px) 100vw, 680px', 'loading="lazy"')}</button><figcaption>Flat layout preview — vector panels at 1:1 with a safe-area guide for doors, handles and seams.</figcaption></figure>` : ''}${detail ? `<figure><button type="button" data-wd-open="${list.indexOf(detail)}" aria-label="Enlarge the detail view">${img(detail, '(max-width: 700px) 100vw, 500px', 'loading="lazy"')}</button><figcaption>Close-up at actual pixels — crisp vector type and stripes at print size.</figcaption></figure>` : ''}</div>` : ''}
  <div class="wd-info-grid">
    <article class="wd-card wd-files"><h3>${icon('layers')} Files included</h3><p class="small wd-filename">${icon('file', 16)} <b data-no-translate>${esc(fileName)}</b></p><ul class="wd-list">${files.map(([a, b]) => `<li>${icon('check', 16)}<span><b>${esc(a)}</b>${b ? `<small>${esc(b)}</small>` : ''}</span></li>`).join('')}</ul><p class="small">Need AI or EPS? Tell us after checkout — included free with an adjustment.</p></article>
    <article class="wd-card"><h3>${icon('download')} How it is delivered</h3><ol class="wd-steps"><li><b>Pay securely</b><span>Card or PayPal at checkout. The digital file is charged in full.</span></li><li><b>Download right away</b><span>A download button appears on your order confirmation.</span></li><li><b>Link by email</b><span>We email a secure link (valid 14 days). Signed-in customers can download again from My account → Orders.</span></li><li><b>Adjustments</b><span>If you added an adjustment, our designer contacts you and delivers the adapted files.</span></li></ol></article>
    <article class="wd-card"><h3>${icon('file')} Opens in</h3><ul class="wd-soft">${SOFTWARE.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul><p class="small">Colours are sRGB; ask us for Pantone / CMYK matches before printing.</p></article>
    <article class="wd-card"><h3>${icon('ruler')} Vehicle template sizes</h3><table class="wd-sizes"><tbody>${SIZES.map(([a, b]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table><p class="small">Approximate print areas including bleed. The file is a scalable 144 × 54 in layout; we fit it to your exact year, make and model with an adjustment.</p></article>
    <article class="wd-card"><h3>${icon('shield')} Licence &amp; turnaround</h3><ul class="wd-list"><li>${icon('check', 16)}<span><b>Single-business licence</b><small>Use on vehicles your business owns or operates. Fleet licence available.</small></span></li><li>${icon('check', 16)}<span><b>No resale</b><small>Files may not be resold or shared as templates.</small></span></li><li>${icon('clock', 16)}<span><b>Adjustments in 2–3 business days</b><small>After we receive your vehicle details and logo · 2 revision rounds included.</small></span></li></ul><p class="small"><a href="/satin/design-agreement/" target="_blank" rel="noopener">Read the Design Agreement</a></p></article>
  </div></div>`;
  gal.after(info);
  if (cfgSection) { info.after(cfgSection); cfgSection.id ||= 'wd-buy'; cfgSection.classList.add('wd-buy'); if (!cfgSection.querySelector('.wd-buy-head')) box.insertAdjacentHTML('beforebegin', `<div class="wd-buy-head"><span class="eyebrow">Buy this design</span><h2 class="d3">Choose how you want ${esc(name)}</h2></div>`); }
  page.querySelectorAll('[data-wd-jump]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); (cfgSection || box).scrollIntoView({behavior: 'smooth', block: 'start'}); }));

  /* ---- purchase cards + adjustment card ---- */
  const purchase = box.querySelectorAll('[data-rf="purchase"]');
  purchase.forEach(r => { const o = r.closest('.product-option-card'); if (!o || o.querySelector('.wd-opt-sub')) return; const dig = Number(r.value) > 0; o.classList.add('wd-opt'); o.querySelector('.product-option-content')?.insertAdjacentHTML('beforeend', `<span class="wd-opt-sub">${dig ? `${money(Number(r.value))} · instant download · ${esc(fileName)}` : 'Quoted after we confirm your vehicle · file fee credited'}</span>`); });
  const adj = box.querySelector('[data-rf="adjust"]');
  if (adj && !box.querySelector('.wd-adjust')) {
    const card = document.createElement('div'); card.className = 'wd-adjust';
    card.innerHTML = `<div class="wd-adjust-top"><span class="wd-adjust-ic">${icon('wand', 22)}</span><div><h3>Need adjustment(s)?</h3><p>Our designer fits ${esc(name)} to your vehicle and brand before you print.</p></div><span class="wd-adjust-price">${fee ? '+' + money(fee) : 'Quoted'}</span></div>
    <ul class="wd-list wd-adjust-list"><li>${icon('check', 16)}<span>Laid out on your exact year, make, model and roof height (all sides)</span></li><li>${icon('check', 16)}<span>Your logo, colours, services, phone and web address</span></li><li>${icon('check', 16)}<span>2 revision rounds · proof on your vehicle before final files</span></li><li>${icon('check', 16)}<span>Print-ready panels at 1:1 with bleed · delivered in 2–3 business days</span></li></ul>
    <label class="wd-adjust-toggle"><span class="wd-switch" aria-hidden="true"></span><span data-wd-adjust-label>Add adjustment</span></label><p class="small wd-adjust-help">Not sure? <a href="#" data-wd-ask>Ask a designer</a> — we reply within one business day.</p>`;
    adj.closest('.product-check-card')?.replaceWith(card);
    card.querySelector('.wd-adjust-toggle').prepend(adj);
    adj.setAttribute('aria-label', 'Need adjustment for your vehicle · ' + (fee ? '+' + money(fee) : 'quoted'));
    card.querySelector('[data-wd-ask]').addEventListener('click', e => { e.preventDefault(); window.satinOpenQuote?.('Vehicle Wraps', 'Design: ' + name + ' — adjustment question'); });
  }

  /* ---- summary: file + material, quote-only for printed & installed ---- */
  const aside = box.querySelector('.rule-summary'), add = box.querySelector('[data-rule-add]');
  let patching = false;
  const sync = () => {
    if (patching) return; patching = true;
    try {
      const v = getValues(), dig = Number(v.purchase) > 0, choices = box.querySelector('[data-order-choices]');
      if (choices && !choices.querySelector('[data-wd-line]')) choices.insertAdjacentHTML('beforeend', `<div data-wd-line><span>File</span><strong data-no-translate>${esc(dig ? fileName : 'Print-ready file prepared by Satin')}</strong></div><div data-wd-line><span>Material</span><strong>${dig ? 'Digital file · no print material' : 'Cast wrap film + laminate · confirmed in your quote'}</strong></div>${dig ? '<div data-wd-line><span>Delivery</span><strong>Instant download + email link</strong></div>' : ''}`);
      box.classList.toggle('wd-printed', !dig);
      const card = box.querySelector('.wd-adjust');
      if (card) { card.classList.toggle('on', !!v.adjust); card.hidden = !dig; const lb = card.querySelector('[data-wd-adjust-label]'); if (lb) lb.textContent = v.adjust ? 'Adjustment added' : 'Add adjustment'; }
      if (!dig && v.adjust && adj) { adj.checked = false; adj.dispatchEvent(new Event('change', {bubbles: true})); }
      const total = box.querySelector('[data-order-total]');
      if (total && !dig && !total.querySelector('[data-wd-quoted]')) total.innerHTML = '<b data-wd-quoted>Quoted</b><span>Printing &amp; installation</span>';
      let note = aside?.querySelector('[data-wd-printed-note]');
      if (!dig) { if (!note && add) { add.insertAdjacentHTML('beforebegin', `<div class="wd-printed-note" data-wd-printed-note><p><b>Printed &amp; installed</b> is priced for your exact vehicle. Request a quote — the ${money(digital)} file fee is credited if we wrap it.</p><button type="button" class="btn block" data-wd-quote>Get this design quoted</button></div>`); aside.querySelector('[data-wd-quote]').onclick = () => window.satinOpenQuote?.('Vehicle Wraps', 'Design: ' + name + ' — printed & installed'); } }
      else note?.remove();
      if (add) add.hidden = !dig;
      const price = box.querySelector('[data-rule-price]'); if (price) price.hidden = !dig;
    } finally { patching = false; }
  };
  new MutationObserver(sync).observe(aside || box, {childList: true, subtree: true});
  box.addEventListener('change', () => setTimeout(sync, 0));
  if (add && /add to cart/i.test(add.textContent)) add.textContent = 'Buy & download';
  sync();

  /* ---- lightbox ---- */
  const open = i => {
    let dlg = document.querySelector('dialog.wd-lightbox');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'wd-lightbox'; dlg.innerHTML = `<button type="button" class="wd-lb-x" data-lb-x aria-label="Close">${icon('x', 22)}</button><button type="button" class="wd-lb-nav prev" data-lb-n="-1" aria-label="Previous">${icon('l', 26)}</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="wd-lb-nav next" data-lb-n="1" aria-label="Next">${icon('r', 26)}</button>`; document.body.append(dlg);
      dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-lb-x]')) dlg.close(); const n = e.target.closest('[data-lb-n]'); if (n) show(dlg._i + +n.dataset.lbN); });
      dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(dlg._i + 1); if (e.key === 'ArrowLeft') show(dlg._i - 1); });
      let x0 = null; dlg.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true}); dlg.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(dlg._i + (dx < 0 ? 1 : -1)); x0 = null; });
    }
    const show = j => { dlg._i = (j + list.length) % list.length; const v = list[dlg._i], im = dlg.querySelector('img'); im.removeAttribute('srcset'); if (v.srcset) { im.srcset = v.srcset; im.sizes = '96vw'; } im.src = v.src; im.alt = v.caption; dlg.querySelector('figcaption').textContent = `${v.caption} · ${dlg._i + 1} / ${list.length}`; };
    show(i); if (!dlg.open) dlg.showModal();
  };
  page.addEventListener('click', e => { const b = e.target.closest('[data-wd-open]'); if (b && list.length) open(+b.dataset.wdOpen); });
  upgradeDesignCards(page);
  translateTree(gal); translateTree(info); if (hero) translateTree(hero);
}

// Listing + "Similar designs" cards: swap the flat SVG illustration for the photo mockup (driver side) of each design.
export function upgradeDesignCards(root) {
  for (const a of root.querySelectorAll('a[href*="/vehicle-wrap-designs/"]')) {
    const slug = (a.getAttribute('href').match(/vehicle-wrap-designs\/([a-z0-9-]+)/) || [])[1], art = a.querySelector('.art');
    if (!slug || !art || art.dataset.wdPhoto) continue;
    art.dataset.wdPhoto = ''; art.classList.add('wd-card-photo'); art.style.background = '#d4d5d9';
    art.innerHTML = `<img src="${BASE}${slug}/hero-640.webp" srcset="${BASE}${slug}/hero-640.webp 640w, ${BASE}${slug}/hero-1100.webp 1100w" sizes="(max-width: 700px) 92vw, 400px" width="1600" height="900" alt="${esc(a.querySelector('h3')?.textContent || slug)} wrap design on a van" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 55%" onerror="this.remove()">`;
  }
}
