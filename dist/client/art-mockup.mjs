/* Artwork preview + product mockup on product pages.
   When a customer picks files in "Upload ready artwork", this shows each file (images and the first page of PDFs)
   and a simple mockup of the product with the artwork on it — roll-up banner on its stand, cards on a desk,
   a yard sign in the grass, a decal on a shop window… Everything happens in the browser; the upload itself is
   still done by the product calculator (studio/calculator.mjs). Loaded on demand by site-extras.mjs. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const path = location.pathname.replace(/\/+$/, '');

/* product → scene. ratio = width / height of the printed piece when it is fixed (null = follow the size chosen / the file) */
const SCENES = [
  [/roll-up-banner/, { kind: 'rollup', ratio: 33.5 / 80, name: 'roll-up banner' }],
  [/x-frame-banner/, { kind: 'xframe', ratio: 24 / 63, name: 'X-frame banner' }],
  [/business-cards/, { kind: 'cards', ratio: 3.5 / 2, flip: true, name: 'business cards' }],
  [/door-hangers/, { kind: 'hanger', ratio: 4.25 / 11, name: 'door hanger' }],
  [/postcards/, { kind: 'paper', ratio: 6 / 4, flip: true, name: 'postcard' }],
  [/flyers/, { kind: 'paper', ratio: 8.5 / 11, flip: true, name: 'flyer' }],
  [/brochures/, { kind: 'paper', ratio: 11 / 8.5, flip: true, name: 'brochure' }],
  [/real-estate-signs/, { kind: 'realestate', ratio: 24 / 18, name: 'real estate sign' }],
  [/yard-signs|poly-bag-lawn-sign/, { kind: 'yard', ratio: 24 / 18, name: 'lawn sign' }],
  [/a-frame-signs/, { kind: 'aframe', ratio: 24 / 36, name: 'A-frame sign' }],
  [/vinyl-banners/, { kind: 'banner', ratio: null, name: 'banner' }],
  [/flags/, { kind: 'flag', ratio: null, name: 'flag' }],
  [/car-magnets/, { kind: 'magnet', ratio: 24 / 12, name: 'car magnet' }],
  [/window-graphics|window-decals|perforated-vinyl/, { kind: 'window', ratio: null, name: 'window graphic' }],
  [/stickers|sticker-sheets|roll-labels/, { kind: 'sticker', ratio: null, own: true, name: 'sticker' }],
  [/wallpaper|apparel|dtf-transfers|vehicle-wrap|design-services/, null] // these pages have their own preview, or no fixed shape
];
const scene = (() => { for (const [re, s] of SCENES) if (re.test(path)) return s; return { kind: 'frame', ratio: null, name: 'print' }; })();

let run = 0, cur = 0, items = [];

function css() {
  if (document.getElementById('art-mock-css')) return;
  const st = document.createElement('style'); st.id = 'art-mock-css';
  st.textContent = `.art-mock{margin-top:16px;display:grid;gap:12px}
.art-mock .am-files{display:flex;gap:10px;flex-wrap:wrap}
.art-mock .am-file{display:flex;flex-direction:column;gap:6px;width:112px;padding:6px;border:1px solid #dfe3ea;border-radius:12px;background:#fff;cursor:pointer;font:inherit;text-align:left}
.art-mock .am-file.on{border-color:var(--accent,#e11d48);box-shadow:0 0 0 3px #e11d4822}
.art-mock .am-file .im{height:84px;border-radius:8px;background:#f3f4f6 center/contain no-repeat;background-image:linear-gradient(45deg,#eef0f3 25%,transparent 25%,transparent 75%,#eef0f3 75%),linear-gradient(45deg,#eef0f3 25%,transparent 25%,transparent 75%,#eef0f3 75%);background-size:12px 12px;background-position:0 0,6px 6px;display:block;overflow:hidden}
.art-mock .am-file .im img{width:100%;height:84px;object-fit:contain;display:block}
.art-mock .am-file .im b{display:grid;place-items:center;height:84px;font-size:12px;color:#5b6472}
.art-mock .am-file small{font-size:11px;line-height:1.3;color:#5b6472;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-mock .am-stage{position:relative;border-radius:16px;overflow:hidden;background:#eef1f5;border:1px solid #e3e7ee}
.art-mock .am-stage svg{display:block;width:100%;height:auto}
.art-mock .am-cap{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12.5px;color:#5b6472}
.art-mock .am-cap b{color:#17191e;font-weight:600}
.art-mock .am-warn{font-size:12.5px;line-height:1.45;background:#fff8e6;border:1px solid #f5d98b;color:#7a5200;border-radius:10px;padding:8px 10px;margin:0}
.art-mock .am-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:640px){.art-mock .am-two{grid-template-columns:1fr}}
.art-mock .am-side{margin:0;display:grid;gap:6px}.art-mock .am-side figcaption{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#17191e}
.am-sides{margin:0 0 12px;display:grid;gap:8px}.am-sides p{margin:0;font-size:13.5px}
.am-pick{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.am-slot{display:grid;gap:2px;padding:12px 14px;border:1.5px dashed #c5ccd8;border-radius:12px;background:#fff;cursor:pointer}
.am-slot:hover{border-color:var(--accent,#e11d48)}.am-slot.done{border-style:solid;border-color:#16a34a;background:#f0fdf4}
.am-slot b{font-size:14px}.am-slot small{font-size:12px;color:#5b6472;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-mock .am-busy{padding:22px;text-align:center;font-size:13px;color:#5b6472}`;
  document.head.append(st);
}

/* file → data URL of the picture (PDF: first page) + its pixel size */
async function picture(file, pageNo = 1) {
  if (/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) {
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    let w = img.naturalWidth || 1000, h = img.naturalHeight || 1000;
    if (file.type !== 'image/svg+xml' && Math.max(w, h) > 1800) { // keep the mockup light
      const k = 1800 / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return { url: c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9), w, h };
    }
    return { url, w, h };
  }
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    for (const C of [Map, WeakMap]) { // pdf.js 5 uses these new Map methods; older browsers need them added
      if (!C.prototype.getOrInsertComputed) C.prototype.getOrInsertComputed = function (k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); };
      if (!C.prototype.getOrInsert) C.prototype.getOrInsert = function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); };
    }
    const lib = await import('/checkout/vendor/pdf.mjs'); lib.GlobalWorkerOptions.workerSrc = '/checkout/vendor/pdf.worker.mjs';
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pageNo > doc.numPages) return null;
    const page = await doc.getPage(pageNo);
    const v1 = page.getViewport({ scale: 1 }), k = Math.min(3, 1600 / Math.max(v1.width, v1.height)), vp = page.getViewport({ scale: k });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return { url: c.toDataURL('image/jpeg', .9), w: v1.width, h: v1.height, pages: doc.numPages };
  }
  return null; // AI, EPS… – shown as a file card only
}

/* the printed piece's shape: fixed for the product, else the width × height chosen in the form, else the file's own */
function pieceRatio(item) {
  const W = Number(document.querySelector('[data-rf="width"]')?.value), H = Number(document.querySelector('[data-rf="height"]')?.value);
  let r = scene.ratio;
  if (!r && !scene.own && W > 0 && H > 0) r = W / H;
  if (!r) r = item.w / item.h;
  if (scene.flip && (item.w > item.h) !== (r > 1)) r = 1 / r; // cards / flyers: follow the file's orientation
  return r;
}

/* artwork placed in a box: the whole file is shown (white around it if its shape differs) */
const art = (id, x, y, w, h, url, extra = '', bg = '#fff') =>
  `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>${bg ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"${extra}/>` : ''}<image href="${url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${id})"${extra}/>`;
const fit = (r, maxW, maxH) => { let w = maxW, h = w / r; if (h > maxH) { h = maxH; w = h * r; } return [w, h]; };

/* photo mockups (made with ChatGPT image AI, green slot measured and cleaned): [x, y, w, h] of the printable area in the
   1280 × 853 photo, and how far the photo may be stretched sideways so the slot matches the product's shape */
const PHOTOS = {
  rollup: { box: [442, 50, 394, 718], flex: [0.7, 1.35] },
  cards: { box: [345, 257, 588, 343], flex: [0.85, 1.18] },
  flyer: { box: [340, 38, 599, 773], flex: [0.8, 1.25] },
  postcard: { box: [245, 172, 790, 508], flex: [0.8, 1.25] },
  yard: { box: [340, 136, 599, 415], flex: [0.85, 1.18] },
  realestate: { box: [405, 225, 490, 338], flex: [0.85, 1.18] },
  aframe: { box: [446, 99, 390, 588], flex: [0.85, 1.18] },
  banner: { box: [121, 180, 1037, 466], flex: [0.8, 1.25] },
  magnet: { box: [381, 408, 179, 90], flex: [0.85, 1.18] },
  window: { box: [306, 206, 627, 373], flex: [0.8, 1.25] },
  sticker: { box: [542, 307, 195, 199], free: true }, // blank laptop lid: the sticker takes the file's own shape
  frame: { box: [438, 59, 404, 586], flex: [0.8, 1.25] }
};
function photoSVG(item, r) {
  const key = scene.kind === 'paper' ? (r < 1 ? 'flyer' : 'postcard') : scene.kind, p = PHOTOS[key]; if (!p) return '';
  if (p.free) { // sticker: about the slot's area, in the artwork's own shape, white kiss-cut border and a soft shadow
    const [bx, by, bw, bh] = p.box, h0 = Math.sqrt(bw * bh * 1.15 / r), w0 = h0 * r, s = Math.min(1, 520 / w0, 420 / h0), w = w0 * s, h = h0 * s, x = bx + bw / 2 - w / 2, y = by + bh / 2 - h / 2, b = 9, rx = Math.min(w, h) * 0.12;
    return `<svg viewBox="0 0 1280 853" role="img" aria-label="Mockup of your ${esc(scene.name)}"><defs><clipPath id="amP"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx * .7}"/></clipPath>
      <filter id="amS" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".28"/></filter></defs>
      <image href="/satin/img/mockups/${key}.jpg?v=1" width="1280" height="853"/>
      <rect x="${x - b}" y="${y - b}" width="${w + 2 * b}" height="${h + 2 * b}" rx="${rx + b}" fill="#fff" filter="url(#amS)"/>
      <image href="${item.url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#amP)"/></svg>`;
  }
  const [bx, by, bw, bh] = p.box, k = Math.min(p.flex[1], Math.max(p.flex[0], r / (bw / bh)));
  if (Math.abs(Math.log(r / (bw * k / bh))) > 0.15) return ''; // shape too different for this photo: use the drawn scene
  const W = Math.round(1280 * k), x = bx * k - 1, y = by - 1, w = bw * k + 2, h = bh + 2, rx = p.round ? Math.min(w, h) * p.round : 0;
  return `<svg viewBox="0 0 ${W} 853" role="img" aria-label="Mockup of your ${esc(scene.name)}"><defs>
    <clipPath id="amP"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/></clipPath>
    <linearGradient id="amL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient></defs>
    <image href="/satin/img/mockups/${key}.jpg?v=1" x="0" y="0" width="${W}" height="853" preserveAspectRatio="none"/>
    <g clip-path="url(#amP)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><image href="${item.url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#amL)"/></g></svg>`;
}

function svg(item) {
  { const ph = photoSVG(item, pieceRatio(item)); if (ph) return ph; }
  const r = pieceRatio(item), u = item.url, V = 'viewBox="0 0 640 440"';
  const defs = `<defs><linearGradient id="amWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f5f8"/><stop offset="1" stop-color="#e6e9ef"/></linearGradient>
    <linearGradient id="amDesk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c3a5"/><stop offset="1" stop-color="#c4a882"/></linearGradient>
    <linearGradient id="amSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6fb"/><stop offset="1" stop-color="#eef6fd"/></linearGradient>
    <linearGradient id="amGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb6c8"/><stop offset=".5" stop-color="#c9d8e4"/><stop offset="1" stop-color="#8fa7ba"/></linearGradient>
    <linearGradient id="amMetal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1ab"/><stop offset=".5" stop-color="#e5e8ec"/><stop offset="1" stop-color="#8b929c"/></linearGradient>
    <filter id="amSh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#0f172a" flood-opacity=".22"/></filter>
    <pattern id="amPerf" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.3" fill="#2b3440" fill-opacity=".35"/></pattern></defs>`;
  const room = `<rect width="640" height="440" fill="url(#amWall)"/><rect y="350" width="640" height="90" fill="#d8dce3"/><rect y="350" width="640" height="2" fill="#c9ced6"/>`;
  const outdoor = `<rect width="640" height="440" fill="url(#amSky)"/><path d="M0 300 Q160 280 320 296 T640 290 V440 H0Z" fill="#8cc070"/><path d="M0 330 Q200 316 400 328 T640 322 V440 H0Z" fill="#76ad5b"/>`;
  let body = '';
  switch (scene.kind) {
    case 'rollup': case 'xframe': {
      const [w, h] = fit(r, 260, 300), x = 320 - w / 2, y = 342 - h;
      body = room + `<ellipse cx="320" cy="${y + h + 22}" rx="${w / 2 + 50}" ry="12" fill="#0f172a" opacity=".12"/>`;
      if (scene.kind === 'xframe') body += `<path d="M${x + 4} ${y + 4} L${x + w - 4} ${y + h + 18} M${x + w - 4} ${y + 4} L${x + 4} ${y + h + 18}" stroke="#6b7280" stroke-width="4" stroke-linecap="round"/>`;
      body += `<g filter="url(#amSh)">${art('amA', x, y, w, h, u)}</g>`;
      if (scene.kind === 'rollup') body += `<rect x="${x - 4}" y="${y - 6}" width="${w + 8}" height="8" rx="3" fill="url(#amMetal)"/><rect x="${x - 16}" y="${y + h - 2}" width="${w + 32}" height="22" rx="8" fill="url(#amMetal)" stroke="#7d848e" stroke-width="1"/><rect x="${x - 10}" y="${y + h + 18}" width="18" height="6" rx="2" fill="#4b5563"/><rect x="${x + w - 8}" y="${y + h + 18}" width="18" height="6" rx="2" fill="#4b5563"/>`;
      break;
    }
    case 'cards': {
      const [w, h] = fit(r, 250, 200);
      body = `<rect width="640" height="440" fill="url(#amDesk)"/><g opacity=".08"><path d="M0 120 H640 M0 260 H640 M0 380 H640" stroke="#3a2a14" stroke-width="2"/></g>`
        + `<g transform="translate(250 205) rotate(-9)" filter="url(#amSh)">${art('amB', -w / 2, -h / 2, w, h, u)}</g>`
        + `<g transform="translate(372 240) rotate(6)" filter="url(#amSh)">${art('amA', -w / 2, -h / 2, w, h, u)}</g>`;
      break;
    }
    case 'paper': {
      const [w, h] = fit(r, 330, 330);
      body = `<rect width="640" height="440" fill="url(#amDesk)"/><g opacity=".08"><path d="M0 110 H640 M0 250 H640 M0 390 H640" stroke="#3a2a14" stroke-width="2"/></g>`
        + `<g transform="translate(330 220) rotate(-4)" filter="url(#amSh)">${art('amA', -w / 2, -h / 2, w, h, u)}</g>`
        + `<rect x="512" y="300" width="14" height="110" rx="6" transform="rotate(28 519 355)" fill="#1f2937"/>`;
      break;
    }
    case 'hanger': {
      const [w, h] = fit(r, 150, 330), x = 320 - w / 2, y = 52;
      body = `<rect width="640" height="440" fill="#7a4b2a"/><rect x="190" y="0" width="260" height="440" fill="#8a5a36" stroke="#6b4124" stroke-width="3"/><circle cx="${x + w / 2}" cy="${y + 34}" r="22" fill="#c9a24d"/><rect x="${x + w / 2 - 8}" y="${y + 50}" width="16" height="26" rx="4" fill="#b08a3a"/>`
        + `<g filter="url(#amSh)">${art('amA', x, y, w, h, u)}<circle cx="${x + w / 2}" cy="${y + 34}" r="21" fill="#8a5a36"/></g>`;
      break;
    }
    case 'yard': case 'realestate': {
      const [w, h] = fit(r, 280, 190);
      if (scene.kind === 'yard') {
        const x = 320 - w / 2, y = 250 - h;
        body = outdoor + `<path d="M${x + w * .25} ${y + h - 6} V${y + h + 110} M${x + w * .75} ${y + h - 6} V${y + h + 110}" stroke="#4b5563" stroke-width="4"/><g filter="url(#amSh)">${art('amA', x, y, w, h, u)}</g>`;
      } else {
        const x = 260 - w / 2, y = 110;
        body = outdoor + `<rect x="${x + w + 40}" y="60" width="12" height="320" fill="#f8fafc" stroke="#cbd5e1"/><rect x="${x - 20}" y="64" width="${w + 72}" height="10" fill="#f8fafc" stroke="#cbd5e1"/><path d="M${x + 20} 74 V${y} M${x + w - 20} 74 V${y}" stroke="#6b7280" stroke-width="2"/><g filter="url(#amSh)">${art('amA', x, y, w, h, u)}</g>`;
      }
      break;
    }
    case 'aframe': {
      const [w, h] = fit(r, 190, 260), x = 320 - w / 2, y = 330 - h;
      body = `<rect width="640" height="440" fill="#d7dbe2"/><rect y="340" width="640" height="100" fill="#b9bfc8"/><rect x="40" y="40" width="160" height="300" fill="#c3c8d0"/><rect x="440" y="40" width="160" height="300" fill="#c3c8d0"/>`
        + `<path d="M${x - 14} ${y + h + 18} L${x - 4} ${y - 14} H${x + w + 4} L${x + w + 14} ${y + h + 18}" fill="#1f2937"/><g filter="url(#amSh)">${art('amA', x, y, w, h, u)}</g>`;
      break;
    }
    case 'banner': {
      const [w, h] = fit(r, 520, 250), x = 320 - w / 2, y = 190 - h / 2;
      let grom = ''; const n = Math.max(2, Math.round(w / 90));
      for (let i = 0; i <= n; i++) { const gx = x + 10 + (w - 20) * i / n; grom += `<circle cx="${gx}" cy="${y + 9}" r="3.5" fill="#cbd5e1" stroke="#6b7280"/><circle cx="${gx}" cy="${y + h - 9}" r="3.5" fill="#cbd5e1" stroke="#6b7280"/>`; }
      body = `<rect width="640" height="440" fill="#c8b8a6"/><g stroke="#b3a08b" stroke-width="2">${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 38} H640"/>`).join('')}</g>`
        + `<path d="M${x + 10} ${y + 9} L${x - 30} ${y - 30} M${x + w - 10} ${y + 9} L${x + w + 30} ${y - 30}" stroke="#57534e" stroke-width="2"/><g filter="url(#amSh)">${art('amA', x, y, w, h, u)}</g>${grom}`;
      break;
    }
    case 'flag': {
      const [w, h] = fit(r, 170, 300), x = 330 - w / 2, y = 40;
      body = outdoor + `<rect x="${x - 10}" y="${y - 10}" width="6" height="${h + 120}" fill="#4b5563"/><g filter="url(#amSh)">${art('amA', x, y, w, h, u)}</g>`;
      break;
    }
    case 'magnet': {
      const [w, h] = fit(r, 260, 140), x = 300 - w / 2, y = 196 - h / 2;
      body = `<rect width="640" height="440" fill="#dfe5ec"/><rect y="350" width="640" height="90" fill="#9aa3ad"/>`
        + `<path d="M40 120 Q60 80 140 74 H470 Q560 80 600 150 V300 Q600 330 570 330 H70 Q40 330 40 300Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>`
        + `<path d="M150 82 H430 L480 140 H120Z" fill="#334155" opacity=".85"/><path d="M300 82 V330" stroke="#cbd5e1" stroke-width="2"/><rect x="420" y="190" width="40" height="8" rx="4" fill="#94a3b8"/>`
        + `<circle cx="140" cy="340" r="48" fill="#1f2937"/><circle cx="140" cy="340" r="22" fill="#9ca3af"/><circle cx="500" cy="340" r="48" fill="#1f2937"/><circle cx="500" cy="340" r="22" fill="#9ca3af"/>`
        + `<g filter="url(#amSh)">${art('amA', x, y, w, h, u, ' rx="10"')}</g>`;
      break;
    }
    case 'window': {
      const [w, h] = fit(r, 380, 230), x = 320 - w / 2, y = 196 - h / 2, perf = /perforated/.test(path);
      body = `<rect width="640" height="440" fill="#3b4250"/><rect x="60" y="40" width="520" height="320" fill="url(#amGlass)"/><path d="M60 40 L230 360 M330 40 L500 360" stroke="#fff" stroke-opacity=".18" stroke-width="40"/>`
        + `<g opacity="${perf ? .92 : 1}">${art('amA', x, y, w, h, u, '', perf ? '#fff' : '')}</g>${perf ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#amPerf)"/>` : ''}`
        + `<rect x="60" y="40" width="520" height="320" fill="none" stroke="#1f2937" stroke-width="14"/><rect y="360" width="640" height="80" fill="#9aa3ad"/>`;
      break;
    }
    case 'sticker': {
      const [w, h] = fit(r, 260, 230);
      body = `<rect width="640" height="440" fill="#2f3542"/><rect x="70" y="60" width="500" height="320" rx="18" fill="#3c4352"/>`
        + `<g transform="translate(320 220) rotate(-6)" filter="url(#amSh)"><rect x="${-w / 2 - 12}" y="${-h / 2 - 12}" width="${w + 24}" height="${h + 24}" rx="22" fill="#fff"/><clipPath id="amA"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="12"/></clipPath><image href="${u}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#amA)"/></g>`;
      break;
    }
    default: { // framed on a wall
      const [w, h] = fit(r, 300, 250), x = 320 - w / 2, y = 175 - h / 2;
      body = room + `<g filter="url(#amSh)"><rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 28}" fill="#1f2937"/>${art('amA', x, y, w, h, u)}</g>`;
    }
  }
  return `<svg ${V} role="img" aria-label="Mockup of your ${esc(scene.name)}">${defs}${body}</svg>`;
}

/* double-sided products (Print sides = Double side): the customer gives a front and a back file */
const isDouble = () => document.querySelector('[data-rf="print_sides"]:checked')?.value === '1'
  || document.querySelector('select[data-rf="print_sides"]')?.value === '1';
const realInput = () => document.querySelector('.rule-artwork [data-art-upload]');
let picked = { front: null, back: null };

function stageHTML(it, label) {
  const pr = pieceRatio(it), off = Math.abs(Math.log(pr / (it.w / it.h)));
  return { html: `<figure class="am-side">${label ? `<figcaption>${label}</figcaption>` : ''}<div class="am-stage">${svg(it)}</div></figure>`, off: off > .12 };
}
function draw(box) {
  const dbl = isDouble() && items.length >= 1, it = items[cur];
  const tag = i => dbl ? (i === 0 ? 'Front' : i === 1 ? 'Back' : '') : '';
  const files = items.map((f, i) => `<button type="button" class="am-file ${!dbl && i === cur ? 'on' : ''}" data-am="${i}" title="${esc(f.name)}"><span class="im">${f.url ? `<img src="${f.url}" alt="">` : '<b>FILE</b>'}</span><small>${tag(i) ? `<b>${tag(i)}</b> · ` : ''}${esc(f.name)}${f.page ? ` · page ${f.page}` : f.pages > 1 ? ` · ${f.pages} pages` : ''}</small></button>`).join('');
  let stage = '', warn = false, note = '';
  if (dbl) {
    const sides = [[items[0], 'Front'], [items[1], 'Back']].filter(([x]) => x?.url);
    const parts = sides.map(([x, l]) => stageHTML(x, l)); warn = parts.some(p => p.off);
    stage = sides.length ? `<div class="am-cap"><span><b>Mockup</b> · your ${esc(scene.name)}, both sides</span></div><div class="am-two">${parts.map(p => p.html).join('')}</div>` : '';
    if (!items[1]) note = `<p class="am-warn">You chose <b>double side</b> — add the file for the <b>back</b> too (use “Back side” above), or upload one PDF with 2 pages.</p>`;
  } else if (it?.url && scene) {
    const p = stageHTML(it, ''); warn = p.off;
    stage = `<div class="am-cap"><span><b>Mockup</b> · your ${esc(scene.name)}</span><span>${items.length > 1 ? 'Tap a file to see it on the product' : ''}</span></div>${p.html}`;
  } else if (it && !it.url) stage = `<p class="am-warn">We received “${esc(it.name)}”. This file type cannot be previewed in the browser, but our team will open it and send you a proof.</p>`;
  box.innerHTML = `${files ? `<div class="am-files">${files}</div>` : ''}${note}${stage}${warn ? '<p class="am-warn">Your file is a different shape than this product, so it is shown with white space around it. We will check it and send you a proof before printing — or choose “I need a designer” and we will adjust it for you.</p>' : ''}<p class="small" style="margin:0;color:#5b6472">Preview only — colours on screen can differ slightly from print. You approve a proof before production.</p>`;
}

/* Front / Back pickers: both files go into the calculator's own upload field together, so both are uploaded with the order */
export function sides() {
  const inp = realInput(); if (!inp || !scene) return;
  const sec = inp.closest('.rule-artwork'); let bar = sec.querySelector('.am-sides');
  const mode = sec.querySelector('[name="artwork-mode"]:checked')?.value || 'upload';
  if (!isDouble() || mode !== 'upload') { bar?.remove(); if (items.length) { const b = sec.querySelector('.art-mock'); if (b) draw(b); } return; }
  css();
  if (!bar) {
    bar = document.createElement('div'); bar.className = 'am-sides';
    bar.innerHTML = `<p><b>Double-sided:</b> upload a file for each side.</p><div class="am-pick">${['front', 'back'].map(k => `<label class="am-slot" data-slot="${k}"><input type="file" hidden accept="${esc(inp.accept || 'image/*,application/pdf')}"><b>${k === 'front' ? 'Front side' : 'Back side'}</b><small data-name>Choose file…</small></label>`).join('')}</div>`;
    (sec.querySelector('[data-art-controls]') || inp).before(bar);
    bar.addEventListener('change', e => {
      const sl = e.target.closest('[data-slot]'); if (!sl || !e.target.files?.[0]) return; e.stopPropagation();
      picked[sl.dataset.slot] = e.target.files[0]; push();
    });
  }
  const pdfBack = !picked.back && items[1]?.page === 2; // one 2-page PDF covers both sides
  for (const k of ['front', 'back']) {
    const n = bar.querySelector(`[data-slot="${k}"] [data-name]`), auto = k === 'back' && pdfBack;
    n.textContent = picked[k] ? (auto ? '' : '') + picked[k].name + (k === 'front' && pdfBack ? ' · page 1' : '') : auto ? `${items[1].name} · page 2` : 'Choose file…';
    bar.querySelector(`[data-slot="${k}"]`).classList.toggle('done', !!picked[k] || auto);
  }
  if (items.length) { const b = sec.querySelector('.art-mock'); if (b) draw(b); }
}
function push() {
  const inp = realInput(); if (!inp) return;
  const dt = new DataTransfer(); for (const f of [picked.front, picked.back]) if (f) dt.items.add(f);
  inp.multiple = true; inp.files = dt.files; inp._amPicked = true;
  inp.dispatchEvent(new Event('change', { bubbles: true })); // the calculator uploads them; site-extras calls show()
  sides();
}

export async function show(input) {
  const files = [...(input.files || [])]; const sec = input.closest('.rule-artwork') || input.parentElement;
  if (!input._amPicked) { picked = { front: files[0] || null, back: files[1] || null }; } input._amPicked = false;
  let box = sec.querySelector('.art-mock');
  if (!files.length) { box?.remove(); return; }
  if (/wallpaper/.test(path)) return; // the wall preview already shows the design in a room
  css();
  if (!box) { box = document.createElement('div'); box.className = 'art-mock'; (sec.querySelector('[data-art-status]') || sec.lastElementChild).before(box); }
  box.innerHTML = '<div class="am-busy">Preparing your preview…</div>';
  const id = ++run; items = []; cur = 0;
  for (const f of files.slice(0, 8)) {
    let p = null; try { p = await picture(f); } catch { p = null; }
    if (id !== run) return;
    items.push({ name: f.name, ...(p || {}) });
  }
  // one PDF with 2 pages on a double-sided product: page 1 = front, page 2 = back
  if (isDouble() && items.length === 1 && items[0].pages > 1) {
    let p2 = null; try { p2 = await picture(files[0], 2); } catch { p2 = null; }
    if (id !== run) return;
    if (p2) { items[0].page = 1; items.push({ name: files[0].name, page: 2, ...p2 }); }
  }
  cur = Math.max(0, items.findIndex(i => i.url));
  if (!scene) { // pages with their own preview: just the file thumbnails
    box.innerHTML = `<div class="am-files">${items.map(f => `<span class="am-file"><span class="im">${f.url ? `<img src="${f.url}" alt="">` : '<b>FILE</b>'}</span><small>${esc(f.name)}</small></span>`).join('')}</div>`; return;
  }
  draw(box); sides();
  box.onclick = e => { const b = e.target.closest('[data-am]'); if (b && !isDouble()) { cur = +b.dataset.am; draw(box); } };
  // the size in the form can change the shape (banners, decals): redraw
  const form = input.closest('form, .rule-form, [data-rule-form], main') || document;
  if (!form._amWatch) { form._amWatch = 1; form.addEventListener('input', e => { if (e.target.matches?.('[data-rf="width"],[data-rf="height"]') && items.length) { const b = document.querySelector('.art-mock'); if (b) draw(b); } }); }
}
