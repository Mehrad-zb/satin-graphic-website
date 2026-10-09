/* Satin Graphic — Wrap Visualizer.
   2D photo recolouring of our own studio vehicle photos. Each vehicle ships:
   <id>.webp (photo on the studio backdrop), <id>-maps.webp (R: paint shading, G: reflections, B: studio horizon map)
   and <id>-mask.webp (R: paint, G: glass, B: wheel faces). Rebuild with scripts/visualizer/build_cars.py; film list: visualizer/films.json. */
const BASE = '/visualizer/';
const W = 1600, H = 900;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const VEHICLES = [
  { id: 'tesla', name: 'Electric sedan', quote: 'Tesla / EV', est: 'sedan' },
  { id: 'sedan', name: 'Sedan', quote: 'Sedan', est: 'sedan' },
  { id: 'coupe', name: 'Coupe / sports car', quote: 'Coupe / sports car', est: 'sedan' },
  { id: 'suv', name: 'Compact SUV', quote: 'SUV', est: 'suv' },
  { id: 'suvxl', name: 'Full-size SUV', quote: 'SUV', est: 'suv' },
  { id: 'pickup', name: 'Pickup truck', quote: 'Pickup Truck', est: 'pickup-truck' },
  { id: 'minivan', name: 'Minivan', quote: 'Minivan', est: 'minivan' },
  { id: 'van', name: 'Cargo van', quote: 'Transit Van', est: 'transit-van' },
  { id: 'sprinter', name: 'High-roof van', quote: 'Sprinter Van', est: 'sprinter-van' },
];
/* Make → model → closest body style we have a photo for. */
const MODELS = {
  Acura: { Integra: 'sedan', TLX: 'sedan', RDX: 'suv', MDX: 'suv' },
  Audi: { A4: 'sedan', A6: 'sedan', RS5: 'coupe', R8: 'coupe', Q5: 'suv', Q7: 'suv', 'e-tron GT': 'tesla' },
  BMW: { '3 Series': 'sedan', '5 Series': 'sedan', M3: 'sedan', M4: 'coupe', i4: 'tesla', X3: 'suv', X5: 'suv', X7: 'suvxl' },
  Cadillac: { CT5: 'sedan', Lyriq: 'suv', Escalade: 'suvxl' },
  Chevrolet: { Malibu: 'sedan', Camaro: 'coupe', Corvette: 'coupe', Equinox: 'suv', Tahoe: 'suvxl', Suburban: 'suvxl', Colorado: 'pickup', Silverado: 'pickup', Express: 'van' },
  Chrysler: { '300': 'sedan', Pacifica: 'minivan' },
  Dodge: { Charger: 'sedan', Challenger: 'coupe', Durango: 'suv', 'Grand Caravan': 'minivan' },
  Ford: { Mustang: 'coupe', Escape: 'suv', Bronco: 'suv', Explorer: 'suv', Expedition: 'suvxl', Ranger: 'pickup', 'F-150': 'pickup', 'Super Duty': 'pickup', 'Transit Connect': 'van', Transit: 'van', 'Transit high roof': 'sprinter' },
  GMC: { Terrain: 'suv', Yukon: 'suvxl', Canyon: 'pickup', Sierra: 'pickup', Savana: 'van' },
  Honda: { Civic: 'sedan', Accord: 'sedan', 'CR-V': 'suv', Pilot: 'suv', Odyssey: 'minivan', Ridgeline: 'pickup' },
  Hyundai: { Elantra: 'sedan', Sonata: 'sedan', 'Ioniq 6': 'tesla', Tucson: 'suv', 'Santa Fe': 'suv', Palisade: 'suv', 'Ioniq 5': 'suv' },
  Jeep: { Wrangler: 'suv', 'Grand Cherokee': 'suv', Wagoneer: 'suvxl', Gladiator: 'pickup' },
  Kia: { Forte: 'sedan', K5: 'sedan', Sportage: 'suv', Sorento: 'suv', Telluride: 'suv', EV6: 'suv', Carnival: 'minivan' },
  Lexus: { IS: 'sedan', ES: 'sedan', NX: 'suv', RX: 'suv', GX: 'suvxl', LX: 'suvxl' },
  Mazda: { Mazda3: 'sedan', 'MX-5': 'coupe', 'CX-5': 'suv', 'CX-50': 'suv', 'CX-90': 'suv' },
  'Mercedes-Benz': { 'C-Class': 'sedan', 'E-Class': 'sedan', 'S-Class': 'sedan', 'AMG GT': 'coupe', GLC: 'suv', GLE: 'suv', GLS: 'suvxl', 'G-Class': 'suvxl', Metris: 'van', Sprinter: 'sprinter' },
  Nissan: { Sentra: 'sedan', Altima: 'sedan', Z: 'coupe', Rogue: 'suv', Pathfinder: 'suv', Frontier: 'pickup', Titan: 'pickup', NV200: 'van' },
  Porsche: { '911': 'coupe', Cayman: 'coupe', Taycan: 'tesla', Macan: 'suv', Cayenne: 'suv' },
  Ram: { '1500': 'pickup', '2500': 'pickup', 'ProMaster City': 'van', ProMaster: 'sprinter' },
  Rivian: { R1S: 'suv', R1T: 'pickup' },
  Subaru: { Impreza: 'sedan', WRX: 'sedan', BRZ: 'coupe', Crosstrek: 'suv', Forester: 'suv', Outback: 'suv' },
  Tesla: { 'Model 3': 'tesla', 'Model S': 'tesla', 'Model Y': 'suv', 'Model X': 'suv', Cybertruck: 'pickup' },
  Toyota: { Corolla: 'sedan', Camry: 'sedan', 'GR Supra': 'coupe', 'GR86': 'coupe', RAV4: 'suv', Highlander: 'suv', '4Runner': 'suv', Sequoia: 'suvxl', Tacoma: 'pickup', Tundra: 'pickup', Sienna: 'minivan' },
  Volkswagen: { Jetta: 'sedan', Golf: 'sedan', Tiguan: 'suv', Atlas: 'suv', 'ID.4': 'suv' },
  Volvo: { S60: 'sedan', XC60: 'suv', XC90: 'suv' },
};
const FINISHES = [
  ['gloss', 'Gloss'], ['gloss-metallic', 'Gloss Metallic'], ['satin', 'Satin'], ['satin-metallic', 'Satin Metallic'], ['matte', 'Matte'], ['matte-metallic', 'Matte Metallic'],
  ['pearl', 'Pearl'], ['diamond', 'Diamond'], ['chrome', 'Chrome'], ['brushed', 'Brushed'], ['colorflow', 'Colour-flow'], ['carbon', 'Carbon'],
];
const FAMILIES = [['black', '#111'], ['white', '#f4f4f2'], ['grey', '#6f7377'], ['silver', '#c3c6c9'], ['red', '#b3141d'], ['orange', '#e5631c'], ['yellow', '#f2c200'], ['green', '#2f8a3c'], ['blue', '#1d4fa0'], ['purple', '#5a2d7a'], ['pink', '#df5f97'], ['brown', '#5a3d2b'], ['gold', '#b2903f'], ['bronze', '#7d5a38'], ['copper', '#9b5232'], ['flip', 'linear-gradient(135deg,#6a2a8a,#1f8a6a)']];
const TINTS = [['factory', 'Factory', 0], ['70', '70%', .22], ['50', '50%', .42], ['35', '35%', .6], ['20', '20%', .76], ['5', '5%', .9]];
const WHEELS = [['factory', 'Factory', null], ['gloss-black', 'Gloss black', ['#0c0c0e', 'gloss']], ['satin-black', 'Satin black', ['#1a1a1c', 'satin']], ['gunmetal', 'Gunmetal', ['#3c3f44', 'satin']], ['bronze', 'Bronze', ['#7a5a33', 'gloss']], ['silver', 'Silver', ['#c4c7ca', 'gloss']], ['white', 'White', ['#e9e9e7', 'gloss']]];

/* Small UI dictionary. Anything missing falls back to English. */
const UI = {
  fa: { 'Wrap Visualizer': 'شبیه‌ساز رپ', Manufacturers: 'برندها', All: 'همه', Colours: 'رنگ‌ها', 'Search colour or film code': 'جستجوی رنگ یا کد فیلم', Finish: 'نوع پوشش', 'Colour family': 'خانواده رنگ', 'Window tint': 'تینت شیشه', Factory: 'کارخانه', 'Clear filters': 'پاک کردن فیلترها', Vehicle: 'خودرو', Make: 'برند خودرو', Model: 'مدل', Year: 'سال', 'Get custom quote': 'دریافت قیمت', 'Share build': 'اشتراک‌گذاری', Download: 'دانلود', Wheels: 'رینگ‌ها', 'Driver side': 'سمت راننده', 'Passenger side': 'سمت سرنشین', 'Body style': 'نوع بدنه', 'Choose colour': 'انتخاب رنگ', 'No films match these filters.': 'فیلمی با این فیلترها پیدا نشد.', 'Link copied': 'لینک کپی شد', 'Open the price estimator': 'تخمین قیمت', Done: 'تأیید' },
  fr: { 'Wrap Visualizer': 'Visualiseur de covering', Manufacturers: 'Fabricants', All: 'Tous', Colours: 'Couleurs', 'Search colour or film code': 'Rechercher une couleur ou un code', Finish: 'Finition', 'Colour family': 'Famille de couleur', 'Window tint': 'Teinte des vitres', Factory: 'D’origine', 'Clear filters': 'Effacer les filtres', Vehicle: 'Véhicule', Make: 'Marque', Model: 'Modèle', Year: 'Année', 'Get custom quote': 'Obtenir un devis', 'Share build': 'Partager', Download: 'Télécharger', Wheels: 'Jantes', 'Driver side': 'Côté conducteur', 'Passenger side': 'Côté passager', 'Body style': 'Carrosserie', 'Choose colour': 'Choisir la couleur', 'No films match these filters.': 'Aucun film ne correspond à ces filtres.', 'Link copied': 'Lien copié', 'Open the price estimator': 'Estimer le prix', Done: 'OK' },
  es: { 'Wrap Visualizer': 'Visualizador de wrap', Manufacturers: 'Fabricantes', All: 'Todos', Colours: 'Colores', 'Search colour or film code': 'Buscar color o código', Finish: 'Acabado', 'Colour family': 'Familia de color', 'Window tint': 'Polarizado', Factory: 'De fábrica', 'Clear filters': 'Borrar filtros', Vehicle: 'Vehículo', Make: 'Marca', Model: 'Modelo', Year: 'Año', 'Get custom quote': 'Pedir cotización', 'Share build': 'Compartir', Download: 'Descargar', Wheels: 'Rines', 'Driver side': 'Lado conductor', 'Passenger side': 'Lado pasajero', 'Body style': 'Carrocería', 'Choose colour': 'Elegir color', 'No films match these filters.': 'Ningún vinilo coincide con estos filtros.', 'Link copied': 'Enlace copiado', 'Open the price estimator': 'Estimar precio', Done: 'Listo' },
};

/* ---------- colour maths ---------- */
const toLin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const LIN = new Float32Array(256).map((_, i) => toLin(i));
const SRGB = new Uint8ClampedArray(4096).map((_, i) => { const v = i / 4095; return Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055)); });
const enc = v => SRGB[v <= 0 ? 0 : v >= 1 ? 4095 : (v * 4095) | 0];
const hexLin = h => { const n = parseInt(h.slice(1), 16); return [LIN[n >> 16 & 255], LIN[n >> 8 & 255], LIN[n & 255]]; };
function hueShift([r, g, b], deg) { // rotate hue in linear RGB (cheap YIQ rotation)
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const y = .299 * r + .587 * g + .114 * b, i = .596 * r - .274 * g - .322 * b, q = .211 * r - .523 * g + .312 * b;
  const i2 = i * c - q * s, q2 = i * s + q * c;
  return [Math.max(0, y + .956 * i2 + .621 * q2), Math.max(0, y - .272 * i2 - .647 * q2), Math.max(0, y - 1.106 * i2 + 1.703 * q2)];
}
function blur(src, w, h, rx, ry) { // separable box blur (x3 passes ≈ gaussian)
  let a = Float32Array.from(src), b = new Float32Array(a.length);
  const pass = (inp, out, r, horiz) => {
    if (r < 1) { out.set(inp); return; }
    const n = horiz ? w : h, m = horiz ? h : w, d = 1 / (2 * r + 1);
    for (let j = 0; j < m; j++) {
      const at = i => horiz ? j * w + i : i * w + j;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += inp[at(Math.min(n - 1, Math.max(0, i)))];
      for (let i = 0; i < n; i++) { out[at(i)] = acc * d; acc += inp[at(Math.min(n - 1, i + r + 1))] - inp[at(Math.max(0, i - r))]; }
    }
  };
  for (let k = 0; k < 3; k++) { pass(a, b, rx, true); pass(b, a, ry, false); }
  return a;
}
const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };

/* ---------- vehicle data ---------- */
const cache = new Map();
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error('Image failed: ' + src)); i.src = src; });
function pixels(img) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; }
function loadVehicle(id) {
  if (cache.has(id)) return cache.get(id);
  const p = Promise.all([loadImg(BASE + 'cars/' + id + '.webp'), loadImg(BASE + 'cars/' + id + '-maps.webp'), loadImg(BASE + 'cars/' + id + '-mask.webp')]).then(([photo, maps, mask]) => {
    const base = pixels(photo), mp = pixels(maps), mk = pixels(mask);
    const paint = [], glass = [], rim = [];
    for (let i = 0, p = 0; i < W * H; i++, p += 4) { if (mk[p] > 3) paint.push(i); if (mk[p + 1] > 3) glass.push(i); if (mk[p + 2] > 3) rim.push(i); }
    const N = paint.length, D = new Float32Array(N), S = new Float32Array(N), E = new Float32Array(N), M = new Float32Array(N), X = new Float32Array(N), Y = new Float32Array(N), R = new Float32Array(N);
    const Sfull = new Float32Array(W * H);
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let k = 0; k < N; k++) {
      const i = paint[k], p = i * 4, x = i % W, y = (i / W) | 0;
      const d = mp[p] / 255, s = mp[p + 1] / 255;
      D[k] = d * d * 1.3; S[k] = s * s; E[k] = mp[p + 2] / 255; M[k] = mk[p] / 255; Sfull[i] = S[k]; R[k] = hash(x, y);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    for (let k = 0; k < N; k++) { const i = paint[k]; X[k] = (i % W - x0) / Math.max(1, x1 - x0); Y[k] = (((i / W) | 0) - y0) / Math.max(1, y1 - y0); }
    const pick = arr => { const o = new Float32Array(N); for (let k = 0; k < N; k++) o[k] = arr[paint[k]]; return o; };
    const S5 = pick(blur(Sfull, W, H, 3, 3)), S14 = pick(blur(Sfull, W, H, 8, 8)), SX = pick(blur(Sfull, W, H, 14, 1));
    // directional brushed-metal streaks (long in x, fine in y)
    const streak = new Float32Array(W * H); for (let i = 0; i < W * H; i++) streak[i] = hash(i % W, (i / W) | 0);
    const BR = pick(blur(streak, W, H, 22, 0));
    // wheel faces
    const RM = new Float32Array(rim.length), RL = new Float32Array(rim.length); let rmax = [];
    for (let k = 0; k < rim.length; k++) { const p = rim[k] * 4; RM[k] = mk[p + 2] / 255; RL[k] = (LIN[base[p]] + LIN[base[p + 1]] + LIN[base[p + 2]]) / 3; if (k % 7 === 0) rmax.push(RL[k]); }
    rmax.sort((a, b) => a - b); const rnorm = 1 / Math.max(.05, rmax[Math.floor(rmax.length * .9)] || 1);
    for (let k = 0; k < RL.length; k++) RL[k] = Math.min(1.3, RL[k] * rnorm);
    const GM = new Float32Array(glass.length); for (let k = 0; k < glass.length; k++) GM[k] = mk[glass[k] * 4 + 1] / 255;
    return { base, paint: Uint32Array.from(paint), glass: Uint32Array.from(glass), rim: Uint32Array.from(rim), D, S, E, M, X, Y, R, S5, S14, SX, BR, RM, RL, GM };
  });
  cache.set(id, p); p.catch(() => cache.delete(id));
  return p;
}

/* ---------- renderer ---------- */
function render(v, out, st) {
  const o = out.data; o.set(v.base);
  const f = st.film, fin = f.finish, c = hexLin(f.hex), c2 = f.hex2 ? hexLin(f.hex2) : null;
  const flowSatin = /satin|matt/i.test(f.name), lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const metal = /metallic/.test(fin), sheen = fin.startsWith('satin') ? 1 : fin.startsWith('matte') ? 2 : 0;
  const pearlC = hueShift(c, lum > .5 ? 28 : 40);
  const chromeTint = (() => { const m = Math.max(c[0], c[1], c[2], .001); return [c[0] / m, c[1] / m, c[2] / m].map(x => .25 + .75 * x); })();
  const { paint, D, S, E, M, X, Y, R, S5, S14, SX, BR } = v;
  for (let k = 0; k < paint.length; k++) {
    const p = paint[k] * 4, d = D[k], n = R[k];
    let r, g, b, spec, cr = c[0], cg = c[1], cb = c[2];
    if (fin === 'colorflow') { // hue travels across the body with position and panel angle
      let t = .55 * X[k] + .35 * (1 - Math.min(1, d)) + .3 * (E[k] - .5) - .1 * Y[k]; t = Math.min(1, Math.max(0, t * 1.15 - .05)); t = t * t * (3 - 2 * t);
      cr = c[0] + (c2[0] - c[0]) * t; cg = c[1] + (c2[1] - c[1]) * t; cb = c[2] + (c2[2] - c[2]) * t;
    } else if (fin === 'pearl') { const t = Math.min(1, Math.max(0, (1.05 - d) * .9 + .25 * (E[k] - .4))); cr += (pearlC[0] - cr) * t * .55; cg += (pearlC[1] - cg) * t * .55; cb += (pearlC[2] - cb) * t * .55; }
    if (fin === 'chrome') {
      let env = E[k] * 1.12 + S[k] * .85 + (d - 1) * .25; env = env < 0 ? 0 : env;
      const val = .025 + 1.08 * Math.pow(Math.min(1.4, env), 2.1);
      r = chromeTint[0] * val; g = chromeTint[1] * val; b = chromeTint[2] * val;
    } else {
      let dif = d, sp;
      if (fin === 'matte' || fin === 'matte-metallic' || (fin === 'colorflow' && /matt/i.test(f.name))) { dif = .32 + .68 * d; sp = .1 * S14[k] + .012; }
      else if (sheen === 1 || fin === 'pearl' || fin === 'brushed' || (fin === 'colorflow' && flowSatin)) { dif = .07 + .93 * d; sp = (fin === 'brushed' ? .45 * SX[k] : .42 * S5[k]) + .006; }
      else sp = S[k];
      if (metal || fin === 'brushed') { // metallic flake + flop: brighter facing panels, darker edges, coloured highlights
        const flake = (n - .5) * (fin.startsWith('matte') ? .22 : .16);
        dif = dif * (1 + flake) * (.8 + .3 * Math.min(1, d));
        if (fin === 'brushed') dif *= .82 + .36 * BR[k];
        sp *= 1.1;
      }
      if (fin === 'carbon') { // 2x2 twill weave
        const i = paint[k], x = i % W, y = (i / W) | 0, u = ((x + y) >> 3) & 1, w = ((x - y + 4096) >> 3) & 1, cell = (u ^ w) ? .62 + .38 * (((x >> 1) & 3) / 3) : .45 + .4 * (((y >> 1) & 3) / 3);
        dif *= cell * 1.15; sp *= .55 + .45 * cell;
      }
      if (fin === 'diamond') { sp = S[k]; if (n > .993) sp += (n - .993) * 70 * (.15 + E[k] * E[k]); dif *= 1 + (n - .5) * .1; }
      const tint = metal || fin === 'brushed' ? .55 : 0; // metallic highlights pick up the film colour
      spec = sp;
      r = cr * dif + spec * (1 - tint + tint * cr / Math.max(.02, lum + .02) * .6);
      g = cg * dif + spec * (1 - tint + tint * cg / Math.max(.02, lum + .02) * .6);
      b = cb * dif + spec * (1 - tint + tint * cb / Math.max(.02, lum + .02) * .6);
    }
    const m = M[k], im = 1 - m;
    o[p] = o[p] * im + enc(r) * m; o[p + 1] = o[p + 1] * im + enc(g) * m; o[p + 2] = o[p + 2] * im + enc(b) * m;
  }
  const t = (TINTS.find(x => x[0] === st.tint) || TINTS[0])[2];
  if (t) for (let k = 0; k < v.glass.length; k++) {
    const p = v.glass[k] * 4, a = t * v.GM[k];
    for (let ch = 0; ch < 3; ch++) { const x = o[p + ch]; o[p + ch] = x * (1 - a) + Math.max(0, x - 200) * a * .9 + 6 * a; }
  }
  const wh = (WHEELS.find(x => x[0] === st.wheel) || WHEELS[0])[2];
  if (wh) {
    const wc = hexLin(wh[0]), gl = wh[1] === 'gloss' ? .9 : .3;
    for (let k = 0; k < v.rim.length; k++) {
      const p = v.rim[k] * 4, L = v.RL[k], m = v.RM[k], sp = Math.max(0, L - .7) * gl;
      const sh = Math.pow(L, 1.15) * .85 + .05;
      o[p] = o[p] * (1 - m) + enc(wc[0] * sh + sp) * m; o[p + 1] = o[p + 1] * (1 - m) + enc(wc[1] * sh + sp) * m; o[p + 2] = o[p + 2] * (1 - m) + enc(wc[2] * sh + sp) * m;
    }
  }
}

/* ---------- page ---------- */
export function pageHTML(lang = 'en') {
  const t = k => UI[lang]?.[k] || k;
  return `<section class="wv" data-wrap-visualizer data-lang="${esc(lang)}">
  <div class="wv-intro wrap"><nav class="wv-crumbs" aria-label="Breadcrumb"><a href="/satin/">Home</a><span>/</span><a href="/satin/vehicle-wraps/">Vehicle Wraps</a><span>/</span><b>${esc(t('Wrap Visualizer'))}</b></nav>
    <h1 class="wv-h1">${esc(t('Wrap Visualizer'))}</h1><p class="wv-lede">Preview hundreds of 3M, Avery Dennison, KPMF and ORACAL colour-change films on your type of vehicle. Pick a colour, finish, window tint and wheels, then send the build to us for a custom quote.</p></div>
  <div class="wv-app" data-wv-app><p class="wv-loading">Loading the visualizer…</p><noscript><p>The Wrap Visualizer needs JavaScript. <a href="/satin/vehicle-wraps/color-change/">See our colour change wraps</a>.</p></noscript></div>
  </section>`;
}

export async function mount(root, opts = {}) {
  const section = root.matches?.('[data-wrap-visualizer]') ? root : root.querySelector('[data-wrap-visualizer]');
  if (!section || section._wv) return; section._wv = true;
  if (!document.querySelector('link[href^="/visualizer/visualizer.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/visualizer/visualizer.css'; document.head.append(l); }
  const lang = opts.lang || section.dataset.lang || 'en', t = k => UI[lang]?.[k] || k;
  const app = section.querySelector('[data-wv-app]');
  let data;
  try { data = await (await fetch(BASE + 'films.json')).json(); } catch { app.innerHTML = '<p class="wv-loading">The visualizer could not load. Please refresh the page.</p>'; return; }
  const films = data.films, brands = data.brands, byId = Object.fromEntries(films.map(f => [f.id, f]));
  const q = new URLSearchParams(location.search);
  const st = {
    vehicle: VEHICLES.some(v => v.id === q.get('vehicle')) ? q.get('vehicle') : 'tesla',
    film: byId[q.get('film')] || byId['3m-s12'] || films[0],
    tint: TINTS.some(x => x[0] === q.get('tint')) ? q.get('tint') : 'factory',
    wheel: WHEELS.some(x => x[0] === q.get('wheels')) ? q.get('wheels') : 'factory',
    side: q.get('side') === 'passenger' ? 'passenger' : 'driver',
    make: MODELS[q.get('make')] ? q.get('make') : '', model: (q.get('model') || '').slice(0, 60), year: /^(19|20)\d\d$/.test(q.get('year') || '') ? q.get('year') : '',
    brand: 'all', finish: 'all', family: 'all', search: '',
  };
  const year0 = new Date().getFullYear() + 1;
  const count = pred => films.filter(pred).length;
  app.innerHTML = `
  <aside class="wv-side" data-wv-side aria-label="${esc(t('Colours'))}">
    <button type="button" class="wv-sheet-handle" data-wv-sheet aria-expanded="false"><span class="wv-sheet-dot" data-wv-sheetdot></span><span><b data-wv-sheetname></b><small>${esc(t('Choose colour'))}</small></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 15l6-6 6 6"/></svg></button>
    <div class="wv-side-in">
      <div class="wv-group"><h2 class="wv-h">${esc(t('Manufacturers'))}</h2><div class="wv-chips" data-wv-brand>${[['all', t('All')], ...Object.entries(brands).map(([k, b]) => [k, b.name])].map(([k, n], i) => `<button type="button" data-v="${esc(k)}" aria-pressed="${i === 0}">${esc(n)}</button>`).join('')}</div></div>
      <div class="wv-group"><h2 class="wv-h">${esc(t('Colours'))}</h2>
        <label class="wv-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" data-wv-search placeholder="${esc(t('Search colour or film code'))}" aria-label="${esc(t('Search colour or film code'))}"></label>
        <h3 class="wv-sub">${esc(t('Finish'))}</h3><div class="wv-chips small" data-wv-finish><button type="button" data-v="all" aria-pressed="true">${esc(t('All'))} <i>${films.length}</i></button>${FINISHES.map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="false">${esc(n)} <i>${count(f => f.finish === k)}</i></button>`).join('')}</div>
        <h3 class="wv-sub">${esc(t('Colour family'))}</h3><div class="wv-fams" data-wv-family><button type="button" data-v="all" aria-pressed="true">${esc(t('All'))}</button>${FAMILIES.map(([k, c]) => `<button type="button" data-v="${k}" aria-pressed="false" title="${esc(k)}"><span style="background:${c}"></span>${esc(k[0].toUpperCase() + k.slice(1))}</button>`).join('')}</div>
        <button type="button" class="wv-clear" data-wv-clear>${esc(t('Clear filters'))}</button>
        <div class="wv-list" data-wv-list role="listbox" aria-label="${esc(t('Colours'))}"></div>
        <p class="wv-note">${esc(data.note)}</p>
      </div>
      <div class="wv-group"><h2 class="wv-h">${esc(t('Window tint'))}</h2><div class="wv-chips" data-wv-tint>${TINTS.map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${k === st.tint}">${esc(k === 'factory' ? t('Factory') : n)}</button>`).join('')}</div><p class="wv-note">Ontario law: front side windows must let through enough light for the driver to be seen. Ask us which shade is legal for your vehicle.</p></div>
      <button type="button" class="btn block wv-done" data-wv-sheet-close>${esc(t('Done'))}</button>
    </div>
  </aside>
  <div class="wv-main">
    <div class="wv-bar">
      <label class="wv-sel"><span>${esc(t('Make'))}</span><select data-wv-make><option value="">—</option>${Object.keys(MODELS).map(m => `<option ${m === st.make ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="wv-sel"><span>${esc(t('Model'))}</span><select data-wv-model></select></label>
      <label class="wv-sel"><span>${esc(t('Year'))}</span><select data-wv-year><option value="">—</option>${Array.from({ length: 40 }, (_, i) => year0 - i).map(y => `<option ${String(y) === st.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <button type="button" class="btn wv-quote" data-wv-quote>${esc(t('Get custom quote'))}</button>
    </div>
    <figure class="wv-stage" data-wv-stage>
      <canvas width="${W}" height="${H}" data-wv-canvas role="img" aria-label="Vehicle preview"></canvas>
      <figcaption class="wv-title"><span class="wv-line" data-wv-line></span><b data-wv-name></b><span class="wv-meta" data-wv-meta></span></figcaption>
      <div class="wv-spin" data-wv-spin hidden></div>
      <div class="wv-views" data-wv-side-toggle role="group" aria-label="View"><button type="button" data-v="driver" aria-pressed="true">${esc(t('Driver side'))}</button><button type="button" data-v="passenger" aria-pressed="false">${esc(t('Passenger side'))}</button></div>
      <div class="wv-actions"><button type="button" class="wv-act" data-wv-share><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>${esc(t('Share build'))}</button><button type="button" class="wv-act dark" data-wv-download><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>${esc(t('Download'))}</button></div>
      <span class="wv-toast" data-wv-toast role="status" aria-live="polite"></span>
    </figure>
    <p class="wv-disclaimer">On-screen colours are approximate. Visit our Vaughan shop to see the physical swatch before you decide. Preview shows a similar body style, not your exact model.</p>
    <div class="wv-row"><h2 class="wv-h">${esc(t('Body style'))}</h2><div class="wv-cars" data-wv-cars>${VEHICLES.map(v => `<button type="button" data-v="${v.id}" aria-pressed="${v.id === st.vehicle}"><img src="${BASE}cars/${v.id}-thumb.webp" alt="" width="150" height="70" loading="lazy"><span>${esc(v.name)}</span></button>`).join('')}</div></div>
    <div class="wv-row"><h2 class="wv-h">${esc(t('Wheels'))}</h2><div class="wv-wheels" data-wv-wheels>${WHEELS.map(([k, n, w]) => `<button type="button" data-v="${k}" aria-pressed="${k === st.wheel}"><span class="wv-rim" style="--rim:${w ? w[0] : '#a3a6a9'}"></span>${esc(n)}</button>`).join('')}</div></div>
    <p class="wv-est"><a data-wv-est href="/satin/vehicle-wraps/estimator/">${esc(t('Open the price estimator'))} →</a></p>
  </div>`;

  const $ = s => app.querySelector(s), $$ = s => [...app.querySelectorAll(s)];
  const canvas = $('[data-wv-canvas]'), ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const bctx = buf.getContext('2d');
  let current = null, frame = 0, seq = 0;
  const filmLabel = f => `${brands[f.brand].name} ${f.name}${f.code ? ' (' + f.code + ')' : ''}`;

  function fillModels() {
    const sel = $('[data-wv-model]'), list = st.make ? Object.keys(MODELS[st.make]) : [];
    sel.innerHTML = `<option value="">—</option>${list.map(m => `<option ${m === st.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}${st.make ? '<option value="__other">Other</option>' : ''}`;
    sel.disabled = !st.make;
  }
  function filtered() {
    const s = st.search.trim().toLowerCase().replace(/[\s-]+/g, '');
    return films.filter(f => (st.brand === 'all' || f.brand === st.brand) && (st.finish === 'all' || f.finish === st.finish) && (st.family === 'all' || f.family === st.family) &&
      (!s || (f.name + (f.code || '') + brands[f.brand].name + f.finish).toLowerCase().replace(/[\s-]+/g, '').includes(s)));
  }
  function swatchBG(f) {
    if (f.hex2) return `linear-gradient(135deg,${f.hex},${f.hex2})`;
    if (f.finish === 'carbon') return `repeating-linear-gradient(45deg,${f.hex} 0 3px,#3a3d42 3px 6px)`;
    if (f.finish === 'chrome') return `linear-gradient(160deg,#fff 0%,${f.hex} 35%,#222 52%,${f.hex} 70%,#fff 100%)`;
    if (f.finish === 'brushed') return `repeating-linear-gradient(0deg,${f.hex} 0 1px,rgba(255,255,255,.25) 1px 2px),${f.hex}`;
    const gl = /^gloss|pearl|diamond/.test(f.finish) ? 'rgba(255,255,255,.55)' : f.finish.startsWith('satin') ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.1)';
    return `radial-gradient(circle at 32% 28%,${gl},transparent 45%),${f.hex}`;
  }
  function drawList() {
    const list = filtered(), box = $('[data-wv-list]');
    if (!list.length) { box.innerHTML = `<p class="wv-empty">${esc(t('No films match these filters.'))}</p>`; return; }
    const groups = new Map(); for (const f of list) { if (!groups.has(f.family)) groups.set(f.family, []); groups.get(f.family).push(f); }
    const order = FAMILIES.map(x => x[0]);
    box.innerHTML = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([fam, fs]) => `<h3 class="wv-fam">${esc(fam)}</h3>${fs.map(f => `<button type="button" role="option" class="wv-film" data-film="${esc(f.id)}" aria-selected="${f.id === st.film.id}"><span class="wv-sw" style="background:${swatchBG(f)}"></span><span class="wv-fn"><b>${esc(f.name)}</b><small>${esc(brands[f.brand].name)} · ${esc((FINISHES.find(x => x[0] === f.finish) || [, f.finish])[1])}</small>${f.code ? `<small class="wv-code">${esc(f.code)}</small>` : ''}</span></button>`).join('')}`).join('');
  }
  function syncUI() {
    const f = st.film, b = brands[f.brand];
    $('[data-wv-line]').textContent = b.name + ' · ' + b.line;
    $('[data-wv-name]').textContent = f.name;
    $('[data-wv-meta]').textContent = [(FINISHES.find(x => x[0] === f.finish) || [, f.finish])[1], f.code].filter(Boolean).join(' · ');
    $('[data-wv-sheetname]').textContent = f.name; $('[data-wv-sheetdot]').style.background = swatchBG(f);
    $$('[data-film]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.film === f.id)));
    for (const [sel, val] of [['[data-wv-tint]', st.tint], ['[data-wv-wheels]', st.wheel], ['[data-wv-cars]', st.vehicle], ['[data-wv-side-toggle]', st.side], ['[data-wv-brand]', st.brand], ['[data-wv-finish]', st.finish], ['[data-wv-family]', st.family]])
      $$(sel + ' [data-v]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === val)));
    const veh = VEHICLES.find(v => v.id === st.vehicle);
    $('[data-wv-est]').href = (location.pathname.match(/^\/satin\/(fa|fr|es)\//) ? location.pathname.slice(0, 10) : '/satin/') + 'vehicle-wraps/estimator/' + veh.est + '/';
    const p = new URLSearchParams({ vehicle: st.vehicle, film: f.id }); if (st.tint !== 'factory') p.set('tint', st.tint); if (st.wheel !== 'factory') p.set('wheels', st.wheel); if (st.side !== 'driver') p.set('side', st.side);
    if (st.make) p.set('make', st.make); if (st.model) p.set('model', st.model); if (st.year) p.set('year', st.year);
    try { history.replaceState(history.state, '', location.pathname + '?' + p); } catch {}
  }
  function paint() {
    if (!current) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const img = bctx.createImageData(W, H); render(current, img, st); bctx.putImageData(img, 0, 0);
      ctx.save(); ctx.clearRect(0, 0, W, H); if (st.side === 'passenger') { ctx.translate(W, 0); ctx.scale(-1, 1); } ctx.drawImage(buf, 0, 0); ctx.restore();
    });
  }
  async function setVehicle(id) {
    st.vehicle = id; syncUI(); const my = ++seq; const spin = $('[data-wv-spin]'); spin.hidden = false;
    try { const v = await loadVehicle(id); if (my !== seq) return; current = v; paint(); }
    catch (e) { console.error(e); toast('This vehicle could not load. Please try again.'); }
    finally { if (my === seq) spin.hidden = true; }
    // warm the next likely choices
    VEHICLES.filter(v => v.id !== id).slice(0, 2).forEach((v, i) => setTimeout(() => loadVehicle(v.id).catch(() => {}), 1500 + i * 1500));
  }
  let tt; function toast(msg) { const el = $('[data-wv-toast]'); el.textContent = msg; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2200); }
  const update = () => { syncUI(); paint(); };

  app.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !app.contains(b)) return;
    const grp = b.closest('[data-wv-brand],[data-wv-finish],[data-wv-family],[data-wv-tint],[data-wv-wheels],[data-wv-cars],[data-wv-side-toggle]');
    if (b.dataset.film) { st.film = byId[b.dataset.film]; update(); if (matchMedia('(max-width: 900px)').matches) setSheet(false); return; }
    if (grp && b.dataset.v) {
      const v = b.dataset.v;
      if (grp.matches('[data-wv-brand]')) st.brand = v; else if (grp.matches('[data-wv-finish]')) st.finish = v; else if (grp.matches('[data-wv-family]')) st.family = v;
      else if (grp.matches('[data-wv-tint]')) { st.tint = v; return update(); } else if (grp.matches('[data-wv-wheels]')) { st.wheel = v; return update(); }
      else if (grp.matches('[data-wv-side-toggle]')) { st.side = v; return update(); } else if (grp.matches('[data-wv-cars]')) return setVehicle(v);
      drawList(); syncUI(); return;
    }
    if (b.matches('[data-wv-clear]')) { st.brand = st.finish = st.family = 'all'; st.search = ''; $('[data-wv-search]').value = ''; drawList(); syncUI(); return; }
    if (b.matches('[data-wv-sheet]')) return setSheet(b.getAttribute('aria-expanded') !== 'true');
    if (b.matches('[data-wv-sheet-close]')) return setSheet(false);
    if (b.matches('[data-wv-share]')) return share();
    if (b.matches('[data-wv-download]')) return download();
    if (b.matches('[data-wv-quote]')) return quote();
  });
  $('[data-wv-search]').addEventListener('input', e => { st.search = e.target.value; drawList(); });
  $('[data-wv-make]').addEventListener('change', e => { st.make = e.target.value; st.model = ''; fillModels(); syncUI(); });
  $('[data-wv-model]').addEventListener('change', e => {
    if (e.target.value === '__other') { const m = prompt(t('Model')); st.model = (m || '').trim().slice(0, 60); fillModels(); if (st.model && !MODELS[st.make][st.model]) { const o = new Option(st.model, st.model, true, true); e.target.add(o, e.target.options.length - 1); } syncUI(); return; }
    st.model = e.target.value; const body = MODELS[st.make]?.[st.model]; if (body && body !== st.vehicle) setVehicle(body); else syncUI();
  });
  $('[data-wv-year]').addEventListener('change', e => { st.year = e.target.value; syncUI(); });
  function setSheet(open) { const side = $('[data-wv-side]'); side.classList.toggle('open', open); $('[data-wv-sheet]').setAttribute('aria-expanded', String(open)); document.documentElement.classList.toggle('wv-sheet-open', open); if (open) { const iv = setInterval(() => { if (!section.isConnected || !side.classList.contains('open')) { clearInterval(iv); if (!section.isConnected) document.documentElement.classList.remove('wv-sheet-open'); } }, 800); } }

  const vehicleText = () => [st.year, st.make, st.model].filter(Boolean).join(' ');
  async function share() {
    const url = location.href, title = `${st.film.name} wrap · Satin Graphic`;
    try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title, url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast(t('Link copied')); } catch { prompt('Copy this link', url); }
  }
  function download() {
    if (!current) return;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.drawImage(canvas, 0, 0);
    const f = st.film, b = brands[f.brand];
    g.fillStyle = '#5b6170'; g.font = '600 22px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText((b.name + ' · ' + b.line).toUpperCase(), 56, 74);
    g.fillStyle = '#182333'; g.font = '700 52px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText(f.name, 54, 132);
    g.fillStyle = '#5b6170'; g.font = '500 24px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText([(FINISHES.find(x => x[0] === f.finish) || [, f.finish])[1], f.code, vehicleText()].filter(Boolean).join(' · '), 56, 170);
    g.font = '600 20px system-ui, -apple-system, Segoe UI, sans-serif'; g.textAlign = 'right'; g.fillStyle = 'rgba(24,35,51,.55)'; g.fillText('Satin Graphic · satingraphic.ca', W - 40, H - 34);
    g.textAlign = 'left'; g.font = '400 15px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText('Approximate colour preview. See the physical swatch in store.', 40, H - 34);
    const name = ('satin-wrap-' + st.vehicle + '-' + f.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '.png';
    c.toBlob(blob => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png');
  }
  function quote() {
    const f = st.film, veh = VEHICLES.find(v => v.id === st.vehicle), fin = f.finish;
    const finish = fin === 'chrome' || fin === 'colorflow' ? 'Satin Chrome / Colour-Flip' : fin.startsWith('matte') ? 'Matte' : fin.startsWith('satin') || fin === 'brushed' ? 'Satin' : 'Gloss';
    const parts = [['Vehicle type', veh.quote], ['Wrap type', 'Color change'], ['Coverage', 'Full Wrap'], ['Finish', finish], ['Film', filmLabel(f)], ['Vehicle', vehicleText() || veh.name],
      ['Window tint', st.tint === 'factory' ? 'No tint' : st.tint + '% VLT'], ['Wheels', (WHEELS.find(x => x[0] === st.wheel) || WHEELS[0])[1]], ['Visualizer build', location.href]];
    const details = parts.map(([k, v]) => k + ': ' + String(v).replace(/[;:]/g, ' ')).join('; ');
    // reuse the site quote wizard (same as every "Get a quote" button)
    if (typeof window.satinOpenQuote === 'function') window.satinOpenQuote('Vehicle Wraps', details);
    else location.assign('/satin/contact/');
  }

  fillModels(); drawList(); syncUI();
  if (opts.signal) opts.signal.addEventListener('abort', () => { cancelAnimationFrame(frame); setSheet(false); });
  await setVehicle(st.vehicle);
}
