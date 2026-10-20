/* Site extras (loaded by the site bundle on every public page):
   - header Search (finds products, services and pages; typo- and synonym-tolerant) and a WhatsApp link
   - floating WhatsApp button above the chat bubble, with a ready message that names the page the visitor is on
   - home page: "Pick your vehicle" price-estimator picker in the hero
   - easier-to-read header menu (bigger, darker text; only "Get a quote" stays a filled button) */
const WA_NUMBER = '19059626222';
const LANG = (location.pathname.match(/^\/satin\/(fa|fr|es)(?=\/|$)/) || [])[1] || 'en';
const TX = {
  en: { search: 'Search', ph: 'What are you looking for? e.g. van wrap, business cards, t-shirt', none: 'Nothing found for', ask: 'Ask us on WhatsApp', popular: 'Popular', close: 'Close', wa: 'WhatsApp', waTitle: 'Message us on WhatsApp', pick: 'What will your wrap cost?', pickSub: 'Pick your vehicle to see a starting price — it takes under a minute.', see: 'See price', all: 'All vehicles' },
  fa: { search: 'جستجو', ph: 'دنبال چه هستید؟ مثلاً رپ ون، کارت ویزیت، تی‌شرت', none: 'چیزی پیدا نشد برای', ask: 'در واتس‌اپ از ما بپرسید', popular: 'پربازدید', close: 'بستن', wa: 'واتس‌اپ', waTitle: 'پیام در واتس‌اپ', pick: 'رپ ماشین شما چقدر هزینه دارد؟', pickSub: 'ماشین خود را انتخاب کنید تا قیمت شروع را ببینید — کمتر از یک دقیقه.', see: 'دیدن قیمت', all: 'همه خودروها' },
  fr: { search: 'Rechercher', ph: 'Que cherchez-vous? ex. covering de van, cartes d’affaires, t-shirt', none: 'Aucun résultat pour', ask: 'Demandez-nous sur WhatsApp', popular: 'Populaire', close: 'Fermer', wa: 'WhatsApp', waTitle: 'Écrivez-nous sur WhatsApp', pick: 'Combien coûte votre covering?', pickSub: 'Choisissez votre véhicule pour voir un prix de départ.', see: 'Voir le prix', all: 'Tous les véhicules' },
  es: { search: 'Buscar', ph: '¿Qué busca? p. ej. rotulación de van, tarjetas, camiseta', none: 'Sin resultados para', ask: 'Pregúntenos por WhatsApp', popular: 'Populares', close: 'Cerrar', wa: 'WhatsApp', waTitle: 'Escríbanos por WhatsApp', pick: '¿Cuánto cuesta su rotulación?', pickSub: 'Elija su vehículo para ver un precio inicial.', see: 'Ver precio', all: 'Todos los vehículos' },
}[LANG];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

/* ---------- WhatsApp: the message names the page the visitor is looking at ---------- */
function pageTopic() {
  const h = document.querySelector('#main h1');
  let t = (h && h.textContent.replace(/\s+/g, ' ').trim()) || document.title.replace(/\s*[|·–-]\s*Satin Graphic.*$/i, '');
  if (/^\/satin\/?$|^\/satin\/(fa|fr|es)\/?$/.test(location.pathname)) t = '';
  return t.slice(0, 120);
}
function waLink() {
  const t = pageTopic();
  const msg = t ? `Hi Satin Graphic, I visited your website and I'm interested in: ${t}.\n${location.origin}${location.pathname}` : `Hi Satin Graphic, I visited your website and I have a question.`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
function openWA(e) { if (e) e.preventDefault(); window.open(waLink(), '_blank', 'noopener'); try { navigator.sendBeacon && navigator.sendBeacon('/api/visit', new Blob([JSON.stringify({ type: 'contact', path: location.pathname, consent: true })], { type: 'application/json' })); } catch {} }

/* ---------- styles ---------- */
const CSS = `
.hdr .nav>button,.hdr .nav>a{font-size:15px!important;color:#1d2330!important;font-weight:600}
.hdr .nav>a.studio-nav{border:0!important;background:none!important;box-shadow:none!important;color:#1d2330!important}
.hdr .nav>a.studio-nav:hover{color:var(--accent,#d6245e)!important}
.mega .col h4{color:#5b6372!important;font-size:12.5px!important}
.mega .col a{font-size:15.5px!important;color:#1d2330!important;padding-top:7px!important;padding-bottom:7px!important}
.sx-hbtn{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:999px;border:1px solid #e3e5ea;background:#fff;color:#1d2330;font:600 14px/1 inherit;cursor:pointer;text-decoration:none;white-space:nowrap}
.sx-hbtn:hover{border-color:#c9ccd4}.sx-hbtn.wa{color:#128c4b;border-color:#bfe8cf;background:#f1fbf5}
@media(max-width:1100px){.sx-hbtn .sx-l{display:none}.sx-hbtn{width:40px;padding:0;justify-content:center}}
.sx-ov{position:fixed;inset:0;z-index:2000;background:#0f172acc;display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px 16px;animation:sxin .15s ease}
@keyframes sxin{from{opacity:0}}
.sx-box{width:min(720px,100%);background:#fff;border-radius:18px;box-shadow:0 30px 80px #0006;overflow:hidden;display:flex;flex-direction:column;max-height:88vh}
.sx-in{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eceef2}
.sx-in input{flex:1;border:0;outline:0;font:500 19px/1.3 inherit;color:#111;min-width:0;background:none}
.sx-in svg{flex:none;color:#6b7280}.sx-x{border:0;background:#f3f4f6;border-radius:999px;width:40px;height:40px;display:grid;place-items:center;cursor:pointer;color:#111}
.sx-res{overflow:auto;padding:8px}
.sx-res a{display:flex;flex-direction:column;gap:3px;padding:13px 14px;border-radius:12px;text-decoration:none;color:#111}
.sx-res a:hover,.sx-res a.on{background:#f4f6fa}
.sx-res b{font-size:16.5px;font-weight:650}.sx-res small{font-size:14px;color:#5b6372;line-height:1.4}
.sx-res .sx-c{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#d6245e}
.sx-res mark{background:#ffe8ef;color:inherit;border-radius:3px}
.sx-h{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;padding:12px 14px 4px}
.sx-empty{padding:18px 14px;font-size:16px;color:#333}
.sx-empty .sx-hbtn{margin-top:12px;height:46px;font-size:15px}
.sx-fab{position:fixed;right:20px;bottom:calc(96px + var(--scw-lift,0px));z-index:1990;display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 18px 0 14px;border-radius:999px;border:0;background:#25d366;color:#fff;font:700 15px/1 inherit;box-shadow:0 10px 26px #0003;cursor:pointer;text-decoration:none}
.sx-fab svg{width:24px;height:24px}
.sx-fab:hover{background:#1ebe5b}
@media(max-width:560px){.sx-fab{right:auto;left:14px;bottom:calc(14px + var(--scw-lift,0px));height:54px;width:54px;padding:0;justify-content:center}.sx-fab .sx-l{display:none}.sx-fab svg{width:28px;height:28px}}
@media(max-width:820px){.hdr .sx-hbtn.wa{display:none}}
[dir=rtl] .sx-fab{right:auto;left:20px}
html.drawer-open .sx-fab,html.drawer-open .scw-launch{display:none!important}
.vpick{margin-top:34px;background:#17191e;color:#fff;border-radius:22px;padding:26px 26px 22px}
.vpick h2{font-size:clamp(24px,3vw,34px);line-height:1.1;margin:0 0 6px;color:#fff}
.vpick p{margin:0 0 18px;color:#c9ccd4;font-size:16px}
.vpick-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.vpick-grid a{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px 12px;border-radius:14px;background:#fff;color:#111;text-decoration:none;transition:transform .15s,box-shadow .15s}
.vpick-grid a:hover{transform:translateY(-2px);box-shadow:0 10px 24px #0005}
.vpick-grid img{width:100%;aspect-ratio:3/1;object-fit:contain}
.vpick-grid b{font-size:15.5px}.vpick-grid span{font-size:13px;color:#d6245e;font-weight:700;display:inline-flex;align-items:center;gap:4px}
@media(max-width:900px){.vpick-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:560px){.vpick{padding:20px 14px 16px;border-radius:18px}.vpick-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.vpick-grid b{font-size:14.5px}}

@media (min-width:1101px){
html .hdr .right .language-control{position:relative;display:inline-flex;align-items:center;flex-shrink:0;margin:0;gap:0}
html .hdr .right .language-control>svg{display:none}
html .hdr .right .language-control select{width:58px!important;max-width:58px!important;min-width:0;height:36px;min-height:36px;padding:0!important;margin:0;border-radius:999px;font-size:14px;color:transparent!important;-webkit-appearance:none;appearance:none;background-image:none!important;text-indent:-999px;cursor:pointer}
html .hdr .right .language-control select option{color:var(--ink,#1d2330);background:var(--card,#fff)}
html .hdr .right .language-control .lang-code{display:flex;position:absolute;inset:0;align-items:center;justify-content:center;gap:4px;pointer-events:none;font-size:12.5px;line-height:1;font-weight:750;letter-spacing:.04em;color:var(--ink,#1d2330)}
html .hdr .right .language-control .lang-code::before{content:"";width:14px;height:14px;background:currentColor;opacity:.7;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18'/%3E%3C/svg%3E") center/contain no-repeat}
html .hdr .right .language-control:focus-within select{outline:2px solid var(--accent,#d6245e);outline-offset:2px}
}

.sx-promo{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:8px 16px;background:#d6245e;color:#fff!important;text-decoration:none!important;font-size:14px;line-height:1.35;text-align:center;position:relative;z-index:60}
.sx-promo:hover .sx-pc{text-decoration:underline}
.sx-promo .sx-pt{background:rgba(255,255,255,.18);border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.sx-promo .sx-pm{font-weight:650}
.sx-promo .sx-pc{font-weight:800;white-space:nowrap}
@media (max-width:640px){.sx-promo{font-size:12.5px;gap:6px;padding:7px 12px}.sx-promo .sx-pt{display:none}}

@media (min-width:1101px){.hdr .nav{flex-wrap:nowrap!important;gap:0!important;justify-content:center}.hdr .nav>button,.hdr .nav>a{padding-inline:9px!important;white-space:nowrap}}
@media (min-width:1101px) and (max-width:1380px){.hdr .nav>button,.hdr .nav>a{font-size:13.5px!important;padding-inline:6px!important}.hdr .nav .chev{width:11px;height:11px}}
`;

/* ---------- search ---------- */
const SYN = [
  [['tshirt', 't-shirt', 'tee', 'tees', 'tshirts', 'shirt', 'shirts', 'تیشرت', 'تی‌شرت', 'تی شرت'], 't shirt|t shirts'],
  [['hoodie', 'hoodies', 'hoody', 'sweater', 'sweatshirt', 'crewneck', 'هودی', 'سویشرت'], 'hoodie|hoodies|sweatshirt|sweatshirts'],
  [['hat', 'hats', 'cap', 'caps', 'beanie', 'toque', 'کلاه'], 'hat|hats|cap|caps'],
  [['polo', 'polos', 'پولو'], 'polo'], [['kids', 'kid', 'youth', 'child', 'children', 'بچه'], 'youth'],
  [['card', 'cards', 'businesscard', 'کارت', 'ویزیت'], 'business card|business cards'],
  [['van', 'vans', 'ون'], 'van|vans|sprinter|transit'], [['truck', 'trucks', 'کامیون'], 'truck|trucks|pickup'],
  [['car', 'cars', 'ماشین', 'خودرو'], 'vehicle wrap|vehicle wraps|car wrap|sedan'], [['wrap', 'wraps', 'wrapping', 'رپ', 'کاور'], 'wrap'],
  [['price', 'cost', 'quote', 'how much', 'قیمت', 'هزینه'], 'estimator|cost|price'],
  [['sign', 'signs', 'signage', 'تابلو'], 'signs'], [['banner', 'banners', 'بنر'], 'banner'],
  [['sticker', 'stickers', 'decal', 'decals', 'label', 'labels', 'استیکر', 'برچسب'], 'sticker|stickers|label|labels|decal|decals'],
  [['tint', 'tinting', 'دودی'], 'tint'], [['wallpaper', 'mural', 'کاغذ دیواری'], 'wallpaper'],
  [['ppf', 'clear bra', 'paint protection'], 'paint protection film'], [['detail', 'detailing', 'wash', 'clean', 'دیتیلینگ'], 'detailing'],
  [['ceramic', 'coating', 'سرامیک'], 'ceramic coating'], [['lettering', 'letters', 'logo'], 'lettering|decals'],
  [['magnet', 'magnets', 'magnetic'], 'car magnets'], [['flag', 'flags'], 'flags'], [['frosted', 'privacy'], 'frosted'],
  [['flyer', 'flyers', 'leaflet', 'تراکت'], 'flyers'], [['website', 'web', 'site', 'سایت'], 'website design'],
  [['video', 'videography', 'ویدیو'], 'videography'], [['instagram', 'social', 'facebook'], 'social media'],
  [['contact', 'phone', 'call', 'address', 'location', 'تماس', 'آدرس', 'تلفن'], 'contact'],
  [['color', 'colour', 'colors', 'رنگ'], 'colour change'], [['tote', 'bag', 'bags'], 'tote'],
  [['window', 'windows', 'glass', 'شیشه'], 'window|windows'], [['estimate', 'estimator', 'calculator'], 'estimator'],
];
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
function expand(q) {
  const n = norm(q), pad = ' ' + n + ' '; const used = new Set();
  const groups = [];
  for (const [keys, add] of SYN) { const k = keys.map(norm).find(nk => pad.includes(' ' + nk + ' ')); if (!k) continue; groups.push(add.split('|').map(norm)); k.split(' ').forEach(w => used.add(w)); }
  const words = n.split(' ').filter(Boolean);
  return { words: words.filter(w => !used.has(w)), all: words, groups };
}
const lev1 = (a, b) => { // within one edit (for typos on words of 5+ letters)
  if (Math.abs(a.length - b.length) > 1) return false; let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++e > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
  return e + (a.length - i) + (b.length - j) <= 1;
};
let INDEX = null;
async function loadIndex() {
  if (INDEX) return INDEX;
  try { const r = await fetch('/search-index.json'); const d = await r.json(); INDEX = d.pages.map(p => ({ ...p, T: norm(p.t), H: norm(p.h), D: norm(p.d), K: norm(p.k), P: norm(p.p.replace(/^\/satin\//, '')), low: /\s(in|à|en)\s(aurora|brampton|concord|etobicoke|king city|maple|markham|mississauga|newmarket|north york|richmond hill|thornhill|toronto|vaughan|woodbridge)$/i.test(p.t) && p.p.split('/').length > 4 })); }
  catch { INDEX = []; }
  return INDEX;
}
function score(p, q) {
  const { words, all } = q; if (!all.length) return 0;
  let s = 0, hit = 0, need = words.length;
  const fields = [[p.T, 6], [p.H, 4], [p.K, 4], [p.P, 3], [p.D, 1.2]];
  for (const w of words) {
    let best = 0;
    for (const [f, wt] of fields) {
      if (!f) continue;
      if ((' ' + f + ' ').includes(' ' + w + ' ')) best = Math.max(best, wt * 1.4);
      else if (f.includes(w)) best = Math.max(best, wt);
      else if (w.length >= 5 && f.split(' ').some(x => lev1(x, w))) best = Math.max(best, wt * .7);
    }
    if (best) hit++; s += best;
  }
  for (const extra of q.groups) {
    need++; let best = 0;
    for (const e of extra) { const re = new RegExp('(^| )' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 's?( |$)');
      if (re.test(p.T)) best = Math.max(best, 9); else if (re.test(p.H) || re.test(p.K) || re.test(p.P)) best = Math.max(best, 6); else if (re.test(p.D)) best = Math.max(best, 1.5); }
    if (best) hit++; s += best;
  }
  if (!hit) return 0;
  const phrase = all.join(' '); if (p.T.includes(phrase)) s += 6; if (p.T.startsWith(phrase)) s += 3;
  if (hit < need) s *= .5;
  s -= (p.p.split('/').length - 3) * .35; // shorter paths (main pages) first
  if (p.low) s -= 5;
  if (!p.c || p.c === 'Guides') s -= 6; // FAQ, guides, policies after the product and service pages
  return s;
}
const hl = (t, words) => { let h = esc(t); for (const w of words.filter(w => w.length > 1)) h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); return h; };
const POPULAR = [['Vehicle wrap price estimator', '/satin/vehicle-wraps/estimator/'], ['Commercial vehicle wraps', '/satin/vehicle-wraps/commercial/'], ['Business cards', '/satin/print-shop/offset/business-cards/'], ['Custom T-shirts', '/satin/apparel/t-shirts/'], ['Window tint', '/satin/window-tint/'], ['Contact us', '/satin/contact/']];
function openSearch() {
  if (document.querySelector('.sx-ov')) return;
  const ov = document.createElement('div'); ov.className = 'sx-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', TX.search);
  ov.innerHTML = `<div class="sx-box"><div class="sx-in">${ICON.search}<input type="search" placeholder="${esc(TX.ph)}" aria-label="${esc(TX.search)}" autocomplete="off" enterkeyhint="search"><button type="button" class="sx-x" aria-label="${esc(TX.close)}">${ICON.x}</button></div><div class="sx-res" role="listbox"></div></div>`;
  document.body.append(ov); document.documentElement.style.overflow = 'hidden';
  const input = ov.querySelector('input'), res = ov.querySelector('.sx-res');
  const close = () => { ov.remove(); document.documentElement.style.overflow = ''; removeEventListener('keydown', key, true); };
  let act = -1;
  const mark = () => res.querySelectorAll('a[data-r]').forEach((a, i) => a.classList.toggle('on', i === act));
  const popular = () => { res.innerHTML = `<div class="sx-h">${esc(TX.popular)}</div>` + POPULAR.map(([t, p]) => `<a href="${p}" data-r><b>${esc(t)}</b></a>`).join(''); act = -1; };
  const run = async () => {
    const v = input.value.trim(); if (!v) return popular();
    const idx = await loadIndex(); const q = expand(v);
    const out = idx.map(p => [score(p, q), p]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]);
    const out2 = out.filter(x => x[0] >= out[0][0] * .45).slice(0, 8); out.length = 0; out.push(...out2);
    act = out.length ? 0 : -1;
    res.innerHTML = out.length ? out.map(([, p]) => `<a href="${esc(p.p)}" data-r>${p.c ? `<span class="sx-c">${esc(p.c)}</span>` : ''}<b>${hl(p.t, q.all)}</b>${p.d ? `<small>${esc(p.d.length > 130 ? p.d.slice(0, 128) + '…' : p.d)}</small>` : ''}</a>`).join('')
      : `<div class="sx-empty">${esc(TX.none)} “${esc(v)}”.<br><a class="sx-hbtn wa" href="#" data-wa>${ICON.wa}<span>${esc(TX.ask)}</span></a></div>`;
    mark(); const w = res.querySelector('[data-wa]'); if (w) w.onclick = openWA;
  };
  let t; input.oninput = () => { clearTimeout(t); t = setTimeout(run, 90); };
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    const links = [...res.querySelectorAll('a[data-r]')];
    if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); act = (act + 1) % links.length; mark(); links[act].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp' && links.length) { e.preventDefault(); act = (act - 1 + links.length) % links.length; mark(); links[act].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && document.activeElement === input && links[act]) { e.preventDefault(); links[act].click(); }
  };
  addEventListener('keydown', key, true);
  ov.onclick = e => { if (e.target === ov || e.target.closest('.sx-x')) close(); else if (e.target.closest('a[data-r]')) setTimeout(close, 0); };
  popular(); loadIndex(); setTimeout(() => input.focus(), 30);
}

/* ---------- header buttons, floating WhatsApp, home picker ---------- */
function header() {
  const right = document.querySelector('.hdr .right'); if (!right || right.querySelector('.sx-hbtn')) return;
  const s = document.createElement('button'); s.type = 'button'; s.className = 'sx-hbtn'; s.setAttribute('aria-label', TX.search); s.innerHTML = `${ICON.search}<span class="sx-l">${esc(TX.search)}</span>`; s.onclick = openSearch;
  const w = document.createElement('a'); w.className = 'sx-hbtn wa'; w.href = 'https://wa.me/' + WA_NUMBER; w.target = '_blank'; w.rel = 'noopener'; w.setAttribute('aria-label', TX.waTitle); w.innerHTML = `${ICON.wa}<span class="sx-l">${esc(TX.wa)}</span>`; w.onclick = openWA;
  right.prepend(s, w);
}
function fab() {
  if (document.querySelector('.sx-fab') || /^\/satin\/(checkout|design-studio)/.test(location.pathname) || window.frameElement) return;
  const a = document.createElement('a'); a.className = 'sx-fab'; a.href = 'https://wa.me/' + WA_NUMBER; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', TX.waTitle);
  a.innerHTML = `${ICON.wa}<span class="sx-l">${esc(TX.wa)}</span>`; a.onclick = openWA; document.body.append(a);
}
const VEH = [['sedan', 'Sedan', 'est-sedan-wrap'], ['suv', 'SUV', 'est-suv-wrap'], ['pickup-truck', 'Pickup', 'est-pickup-wrap'], ['minivan', 'Minivan', 'est-minivan-wrap'], ['transit-van', 'Transit Van', 'est-transit-wrap'], ['sprinter-van', 'Sprinter Van', 'est-sprinter-wrap'], ['cargo-van', 'ProMaster', 'est-promaster-wrap'], ['box-truck', 'Box Truck', 'est-box-wrap'], ['trailer', 'Trailer', 'est-trailer-wrap'], ['bus', 'Bus', 'est-bus-wrap']];
function homePicker() {
  if (!/^\/satin\/?$|^\/satin\/(fa|fr|es)\/?$/.test(location.pathname)) return;
  const hero = document.querySelector('#main .hhero .wrap'); if (!hero || hero.querySelector('.vpick')) return;
  const pre = LANG === 'en' ? '/satin' : '/satin/' + LANG;
  const el = document.createElement('div'); el.className = 'vpick';
  el.innerHTML = `<h2>${esc(TX.pick)}</h2><p>${esc(TX.pickSub)}</p><div class="vpick-grid">${VEH.map(([s, n, img]) => `<a href="${pre}/vehicle-wraps/estimator/${s}/"><img src="/satin/img/${img}.webp" alt="${esc(n)} wrap" loading="lazy" width="1100" height="365"><b>${esc(n)}</b><span>${esc(TX.see)} ${ICON.arrow}</span></a>`).join('')}</div>`;
  hero.append(el);
}
/* Limited-time banner above the header: free design on vehicle wraps (hides itself from PROMO_END, Toronto time). */
const PROMO_END = '2026-12-01';
const PROMO_TX = {
  en: ['Limited time', 'FREE design on all vehicle wrap services — until December 1', 'Get your price'],
  fr: ['Offre limitée', 'Design GRATUIT pour tous les services de covering — jusqu’au 1er décembre', 'Voir mon prix'],
  es: ['Por tiempo limitado', 'Diseño GRATIS en todos los servicios de rotulación — hasta el 1 de diciembre', 'Ver mi precio'],
  fa: ['پیشنهاد محدود', 'طراحی رایگان برای همه خدمات رپ خودرو — تا ۱ دسامبر', 'دیدن قیمت'],
}[LANG];
function promoBar() {
  if (document.querySelector('.sx-promo') || window.frameElement || /^\/satin\/(?:(?:fa|fr|es)\/)?(checkout|design-studio|account|login)/.test(location.pathname)) return;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
  if (today >= PROMO_END) return;
  const hdr = document.querySelector('header.hdr'); if (!hdr) return;
  const a = document.createElement('a'); a.className = 'sx-promo'; a.href = (LANG === 'en' ? '/satin' : '/satin/' + LANG) + '/vehicle-wraps/estimator/';
  a.innerHTML = `<span class="sx-pt">${esc(PROMO_TX[0])}</span><span class="sx-pm">${esc(PROMO_TX[1])}</span><span class="sx-pc">${esc(PROMO_TX[2])} →</span>`;
  hdr.before(a);
}
function run() { promoBar(); header(); fab(); homePicker(); }
const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
run();
new MutationObserver(() => { clearTimeout(run.t); run.t = setTimeout(run, 60); }).observe(document.body, { childList: true, subtree: true });
addEventListener('keydown', e => { if ((e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); } });
window.satinOpenSearch = openSearch;

/* coming-soon pages (list in /coming-soon.mjs) */
try{import('/coming-soon.mjs?v=1').catch(e=>console.warn('coming-soon',e));}catch(e){}
