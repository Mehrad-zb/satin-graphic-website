// Full-body art / livery wrap designs for cars (Abstract, Camo, Sport, Art collections), drawn as pure vector SVG.
// Same contract as art.mjs: liveryArt(d, W, H, {mirror}) → SVG covering one vehicle side (front at x = 0).
// All artwork is original and generated procedurally from a seed, so every design is reproducible at any size.
const rnd = seed => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const rgbHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * t));
const shade = (h, k) => k < 0 ? mix(h, '#000000', -k) : mix(h, '#ffffff', k);
const f1 = n => Math.round(n * 10) / 10;

// smooth 1-D/2-D value noise (deterministic)
function noise2(seed) {
  const r = rnd(seed), P = Array.from({ length: 512 }, () => r());
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 511];
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
}
const fbm = (n, x, y, o = 4) => { let v = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { v += a * n(x * f, y * f); f *= 2; a *= .5; } return v / .9375; };

// closed smooth blob through points (Catmull-Rom → cubic Bézier)
function blobPath(cx, cy, r, R, k = 9, wob = .38, sx = 1, sy = 1) {
  const pts = Array.from({ length: k }, (_, i) => { const t = i / k * Math.PI * 2, rr = r * (1 - wob + R() * wob * 2); return [cx + Math.cos(t) * rr * sx, cy + Math.sin(t) * rr * sy]; });
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < k; i++) { const p0 = pts[(i - 1 + k) % k], p1 = pts[i], p2 = pts[(i + 1) % k], p3 = pts[(i + 2) % k];
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`; }
  return d + 'Z';
}
const smoothLine = pts => { let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`; for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
  d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`; } return d; };

// ---------------- generators ----------------
const G = {
  // ABSTRACT
  shards(W, H, c, R) { // low-poly triangles shading from c[0] (front) to c[1] (rear) with c[2] highlights
    const cols = 16, rows = 6, cw = W * 1.06 / cols, rh = H / rows, P = [];
    for (let y = 0; y <= rows; y++) { P[y] = []; for (let x = 0; x <= cols; x++) P[y][x] = [x * cw + (x && x < cols ? (R() - .5) * cw * .8 : 0), y * rh + (y && y < rows ? (R() - .5) * rh * .8 : 0)]; }
    let s = '';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const a = P[y][x], b = P[y][x + 1], cc = P[y + 1][x], d = P[y + 1][x + 1], t = Math.min(1, Math.max(0, (x / cols) * 1.15 - .05 + (R() - .5) * .25));
      const base = mix(c[0], c[1], t), hi = R() < .08 ? c[2] : null;
      s += `<path d="M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}L${f1(d[0])} ${f1(d[1])}Z" fill="${hi || shade(base, (R() - .5) * .28)}"/><path d="M${f1(a[0])} ${f1(a[1])}L${f1(d[0])} ${f1(d[1])}L${f1(cc[0])} ${f1(cc[1])}Z" fill="${shade(base, (R() - .5) * .28)}"/>`;
    }
    return s;
  },
  flow(W, H, c, R) { // flowing ribbons
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const t = i / n, amp = H * (.12 + .1 * Math.sin(i * .7)), ph = R() * 6, y0 = H * (.05 + t * .95);
      const pts = Array.from({ length: 9 }, (_, k) => [W * 1.06 * k / 8, y0 + Math.sin(k * .8 + ph + t * 3) * amp - t * H * .15 * (k / 8)]);
      s += `<path d="${smoothLine(pts)}" fill="none" stroke="${mix(c[1], c[2], t)}" stroke-width="${f1(H * (.012 + .03 * Math.abs(Math.sin(i * 1.3))))}" stroke-linecap="round" opacity="${f1(.55 + .45 * Math.abs(Math.cos(i)))}"/>`;
    }
    return s;
  },
  halftone(W, H, c) { // dot field growing toward the rear
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    const step = H / 22;
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W * 1.06; x += step) {
      const t = Math.min(1, Math.max(0, (x / W - .2) / .8 + (y / H - .5) * .3)); if (t < .04) continue;
      const r = step * .5 * Math.min(1, t * 1.1); s += `<circle cx="${f1(x)}" cy="${f1(y + ((x / step | 0) % 2) * step / 2)}" r="${f1(r)}" fill="${mix(c[1], c[2], y / H)}"/>`;
    }
    return s;
  },
  glitch(W, H, c, R) { // horizontal glitch bars
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    for (let i = 0; i < 70; i++) {
      const y = R() * H, h = H * (.006 + R() * .045), x = W * (.15 + R() * .9) * (R() < .5 ? 1 : .6), w = W * (.08 + R() * .5);
      s += `<rect x="${f1(x - w * .3)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="${[c[1], c[2], shade(c[1], .35), '#ffffff'][i % 4]}" opacity="${f1(.6 + R() * .4)}"/>`;
    }
    return s;
  },
  topo(W, H, c, R, seed) { // topographic contour lines (each line follows a noise ridge)
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    const n = noise2(seed), lines = 34;
    for (let i = 0; i < lines; i++) {
      const y0 = H * (i / (lines - 1)) * 1.1 - H * .05;
      const pts = Array.from({ length: 40 }, (_, k) => { const x = W * 1.06 * k / 39; return [x, y0 + (fbm(n, x / W * 3, i * .18) - .5) * H * .55]; });
      s += `<path d="${smoothLine(pts)}" fill="none" stroke="${i % 5 === 0 ? c[2] : c[1]}" stroke-width="${f1(H * (i % 5 === 0 ? .009 : .004))}" opacity="${i % 5 === 0 ? 1 : .75}"/>`;
    }
    return s;
  },
  brush(W, H, c, R) { // big painterly strokes
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    for (let i = 0; i < 14; i++) {
      const y = H * (.08 + R() * .84), x0 = W * (R() * .3), x1 = W * (.55 + R() * .55), sw = H * (.05 + R() * .12);
      const pts = [[x0, y], [x0 + (x1 - x0) * .33, y + (R() - .5) * H * .3], [x0 + (x1 - x0) * .66, y + (R() - .5) * H * .3], [x1, y + (R() - .5) * H * .2]];
      const col = [c[1], c[2], c[3] || shade(c[1], .4)][i % 3];
      s += `<path d="${smoothLine(pts)}" fill="none" stroke="${col}" stroke-width="${f1(sw)}" stroke-linecap="round" opacity="${f1(.75 + R() * .25)}"/>`;
      s += `<path d="${smoothLine(pts.map(p => [p[0], p[1] + sw * .28]))}" fill="none" stroke="${shade(col, -.25)}" stroke-width="${f1(sw * .18)}" stroke-linecap="round" opacity=".55"/>`;
    }
    return s;
  },
  hex(W, H, c, R) { // hexagon field dissolving toward the front
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    const r = H / 9, w = r * Math.sqrt(3);
    for (let row = -1; row < H / (r * 1.5) + 1; row++) for (let col = -1; col < W * 1.06 / w + 1; col++) {
      const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * r * 1.5, t = cx / W; if (R() > t * 1.25) continue;
      const rr = r * (.86 - (R() < .15 ? .3 : 0)), pts = Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 3 * k + Math.PI / 6; return `${f1(cx + rr * Math.cos(a))} ${f1(cy + rr * Math.sin(a))}`; });
      s += `<path d="M${pts.join('L')}Z" fill="${R() < .12 ? c[2] : mix(c[1], c[0], R() * .5)}" opacity="${f1(.5 + t * .5)}"/>`;
    }
    return s;
  },
  // CAMO
  camo(W, H, c, R) { // organic woodland-style camo: base + 3 blob layers
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    [c[1], c[2], c[3]].forEach((col, li) => {
      const n = 46 - li * 10;
      for (let i = 0; i < n; i++) { const r = H * (.07 + R() * .1) * (1 - li * .15); s += `<path d="${blobPath(R() * W * 1.06, R() * H, r, R, 9, .45, 1.7 + R(), .8 + R() * .3)}" fill="${col}"/>`; }
    });
    return s;
  },
  pixel(W, H, c, R, seed) { // digital camo from layered noise
    const n = noise2(seed), cell = H / 34; let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    for (let y = 0; y < H; y += cell) for (let x = 0; x < W * 1.06; x += cell) {
      const v = fbm(n, x / H * 2.4, y / H * 2.4, 3) + (R() - .5) * .08;
      const col = v > .66 ? c[3] : v > .55 ? c[2] : v > .44 ? c[1] : null;
      if (col) s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(cell + .5)}" height="${f1(cell + .5)}" fill="${col}"/>`;
    }
    return s;
  },
  // SPORT
  lemans(W, H, c) { // twin racing stripes along the body + roundel
    return `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>
      <rect x="0" y="${H * .5}" width="${W * 1.06}" height="${H * .11}" fill="${c[1]}"/><rect x="0" y="${H * .64}" width="${W * 1.06}" height="${H * .035}" fill="${c[1]}"/>
      <rect x="0" y="${H * .485}" width="${W * 1.06}" height="${H * .012}" fill="${c[2]}"/>
      <circle cx="${W * .5}" cy="${H * .42}" r="${H * .14}" fill="#ffffff" stroke="${c[1]}" stroke-width="${H * .02}"/>
      <text x="${W * .5}" y="${H * .47}" font-family="Inter, Arial, sans-serif" font-weight="900" font-size="${H * .15}" text-anchor="middle" fill="${c[0] === '#ffffff' ? c[1] : c[0]}">00</text>`;
  },
  retro(W, H, c) { // three-tone '80s stripes kicking up toward the rear
    const st = (o, col) => `<path d="M0 ${H * (.66 + o)} L${W * .55} ${H * (.66 + o)} L${W * .82} ${H * (.18 + o)} L${W * 1.06} ${H * (.18 + o)} L${W * 1.06} ${H * (.24 + o)} L${W * .85} ${H * (.24 + o)} L${W * .58} ${H * (.72 + o)} L0 ${H * (.72 + o)} Z" fill="${col}"/>`;
    return `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>` + st(0, c[1]) + st(.075, c[2]) + st(.15, c[3]);
  },
  sunset(W, H, c) { // vertical sunset gradient bands + speed lines
    let s = ''; const bands = 14;
    for (let i = 0; i < bands; i++) s += `<rect x="0" y="${f1(H * i / bands)}" width="${W * 1.06}" height="${f1(H / bands + 1)}" fill="${i < bands / 2 ? mix(c[0], c[1], i / (bands / 2)) : mix(c[1], c[2], (i - bands / 2) / (bands / 2))}"/>`;
    for (let i = 0; i < 9; i++) s += `<rect x="${f1(W * (.35 + i * .07))}" y="${f1(H * (.2 + (i % 4) * .17))}" width="${f1(W * (.25 + (i % 3) * .1))}" height="${f1(H * .012)}" fill="#ffffff" opacity=".75"/>`;
    return s;
  },
  checker(W, H, c, R) { // chequered flag dissolving forward
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    const q = H / 10;
    for (let y = 0; y < H; y += q) for (let x = 0; x < W * 1.06; x += q) {
      const t = x / W; if (((x / q | 0) + (y / q | 0)) % 2) continue; if (R() > (t - .25) * 1.6) continue;
      const k = Math.min(1, Math.max(.35, (t - .2) * 1.4)); s += `<rect x="${f1(x + q * (1 - k) / 2)}" y="${f1(y + q * (1 - k) / 2)}" width="${f1(q * k)}" height="${f1(q * k)}" fill="${c[1]}"/>`;
    }
    return s + `<path d="M0 ${H * .8} L${W * .5} ${H * .8} L${W * .44} ${H * .86} L0 ${H * .86} Z" fill="${c[2]}"/>`;
  },
  carbon(W, H, c) { // carbon-weave panels with an accent strike
    const q = H / 30; let s = `<rect width="${W * 1.06}" height="${H}" fill="#1b1d21"/>`;
    for (let y = 0; y < H; y += q) for (let x = 0; x < W * 1.06; x += q) { const v = ((x / q | 0) + (y / q | 0)) % 2; s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(q)}" height="${f1(q)}" fill="${v ? '#2a2d33' : '#16181b'}"/><rect x="${f1(x)}" y="${f1(y + (v ? 0 : q * .45))}" width="${f1(q)}" height="${f1(q * .12)}" fill="#3a3e46" opacity=".6"/>`; }
    return s + `<path d="M0 ${H * .58} L${W * .62} ${H * .58} L${W * .76} ${H * .2} L${W * .84} ${H * .2} L${W * .68} ${H * .66} L0 ${H * .66} Z" fill="${c[1]}"/><path d="M${W * .86} ${H * .2} L${W * .9} ${H * .2} L${W * .76} ${H * .66} L${W * .72} ${H * .66} Z" fill="${c[2]}"/>`;
  },
  rally(W, H, c, R) { // angular colour blocks
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    const blocks = [[.18, .9, .42, .1, c[1]], [.4, 1, .7, 0, c[2]], [.62, .95, 1.06, .05, c[1]], [.8, .55, 1.06, .2, c[3] || '#ffffff']];
    blocks.forEach(([a, ay, b, by, col]) => { s += `<path d="M${W * a} ${H * ay} L${W * (a + .1)} ${H * by} L${W * b} ${H * by} L${W * (b - .1)} ${H * ay} Z" fill="${col}"/>`; });
    for (let i = 0; i < 5; i++) s += `<path d="M${W * (.08 + i * .05)} ${H} L${W * (.16 + i * .05)} ${H * .55} L${W * (.18 + i * .05)} ${H * .55} L${W * (.1 + i * .05)} ${H} Z" fill="${c[2]}" opacity="${f1(.35 + i * .12)}"/>`;
    return s;
  },
  // ART
  galaxy(W, H, c, R) {
    let s = `<defs>${[0, 1, 2, 3, 4].map(i => `<radialGradient id="neb${i}"><stop offset="0" stop-color="${c[1 + i % 3]}" stop-opacity=".85"/><stop offset="1" stop-color="${c[1 + i % 3]}" stop-opacity="0"/></radialGradient>`).join('')}</defs><rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    for (let i = 0; i < 9; i++) s += `<ellipse cx="${f1(W * (.15 + R() * .9))}" cy="${f1(H * R())}" rx="${f1(H * (.35 + R() * .5))}" ry="${f1(H * (.2 + R() * .3))}" fill="url(#neb${i % 5})" transform="rotate(${f1(R() * 50 - 25)} ${f1(W * .5)} ${f1(H * .5)})"/>`;
    for (let i = 0; i < 420; i++) s += `<circle cx="${f1(R() * W * 1.06)}" cy="${f1(R() * H)}" r="${f1(H * (R() < .96 ? .0015 + R() * .003 : .006 + R() * .006))}" fill="#ffffff" opacity="${f1(.4 + R() * .6)}"/>`;
    return s;
  },
  waves(W, H, c, R) { // layered stylised waves with foam crests
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    for (let L = 0; L < 6; L++) {
      const y = H * (.25 + L * .14), amp = H * (.06 + L * .015), wl = W * (.28 - L * .02), ph = R() * 6;
      let d = `M0 ${H}`; for (let x = 0; x <= W * 1.06; x += W / 120) d += ` L${f1(x)} ${f1(y + Math.sin(x / wl * Math.PI * 2 + ph) * amp + Math.sin(x / wl * 7 + ph) * amp * .15)}`;
      d += ` L${W * 1.06} ${H} Z`;
      s += `<path d="${d}" fill="${mix(c[1], c[2], L / 5)}"/>`;
      for (let x = (ph * wl) % wl; x < W * 1.06; x += wl) { const cy = y + Math.sin(x / wl * Math.PI * 2 + ph) * amp; s += `<path d="M${f1(x - wl * .12)} ${f1(cy + amp * .1)} Q${f1(x)} ${f1(cy - amp * 1.2)} ${f1(x + wl * .1)} ${f1(cy - amp * .2)} Q${f1(x + wl * .02)} ${f1(cy - amp * .5)} ${f1(x - wl * .03)} ${f1(cy - amp * .1)} Z" fill="#ffffff" opacity=".9"/>`; }
    }
    return s;
  },
  splash(W, H, c, R) { // paint splash art
    let s = `<rect width="${W * 1.06}" height="${H}" fill="${c[0]}"/>`;
    for (let i = 0; i < 9; i++) {
      const cx = W * (.12 + R() * .9), cy = H * (.15 + R() * .7), r = H * (.12 + R() * .2), col = [c[1], c[2], c[3]][i % 3];
      s += `<path d="${blobPath(cx, cy, r, R, 12, .3)}" fill="${col}"/>`;
      for (let k = 0; k < 14; k++) { const a = R() * Math.PI * 2, d = r * (1.1 + R() * 1.4); s += `<circle cx="${f1(cx + Math.cos(a) * d)}" cy="${f1(cy + Math.sin(a) * d * .7)}" r="${f1(r * (.03 + R() * .1))}" fill="${col}"/>`; }
      for (let k = 0; k < 3; k++) { const x = cx + (R() - .5) * r; s += `<path d="M${f1(x - r * .06)} ${f1(cy)} L${f1(x - r * .05)} ${f1(cy + r * (1 + R()))} A${f1(r * .055)} ${f1(r * .055)} 0 0 0 ${f1(x + r * .06)} ${f1(cy + r * (1 + R()))} L${f1(x + r * .06)} ${f1(cy)} Z" fill="${col}"/>`; }
    }
    return s;
  },
};

// slug, name, collection (style), colour name, colours, generator, description, seed
const RAW = [
  ['neon-shards', 'Neon Shards', 'Abstract', 'Purple / Cyan', ['#2b1055', '#00d4ff', '#ff3cac'], 'shards', 'Low-poly shards fading from deep purple to electric cyan with hot-pink highlights.', 11],
  ['ember-shards', 'Ember Shards', 'Abstract', 'Black / Orange', ['#141414', '#ff5a1f', '#ffd23f'], 'shards', 'Faceted low-poly panels burning from black into molten orange.', 23],
  ['liquid-flow', 'Liquid Flow', 'Abstract', 'Navy / Teal', ['#0b1630', '#14d9c5', '#7c5cff'], 'flow', 'Flowing liquid ribbons in teal and violet over midnight navy.', 31],
  ['halftone-rush', 'Halftone Rush', 'Abstract', 'White / Red', ['#f5f5f5', '#e8314a', '#16181d'], 'halftone', 'Comic-style halftone dots growing toward the rear — bold and clean.', 41],
  ['glitch-signal', 'Glitch Signal', 'Abstract', 'Black / Neon', ['#0d0f12', '#00f0ff', '#ff2e88'], 'glitch', 'Digital glitch bars in neon cyan and magenta on gloss black.', 53],
  ['topo-lines', 'Topo Lines', 'Abstract', 'Grey / Orange', ['#2a2f38', '#8e99a6', '#ff7a1a'], 'topo', 'Topographic contour lines with orange index lines — an adventure look.', 61],
  ['brush-storm', 'Brush Storm', 'Abstract', 'White / Multi-colour', ['#f7f7f5', '#2457d6', '#e8314a', '#ffc61a'], 'brush', 'Huge painterly brush strokes in primary colours.', 71],
  ['hex-fade', 'Hex Fade', 'Abstract', 'Graphite / Lime', ['#1f2329', '#3a4250', '#b6ff3b'], 'hex', 'Hexagon grid dissolving toward the front with lime accents.', 83],
  ['woodland-camo', 'Woodland Camo', 'Camo', 'Green / Brown', ['#5b6b3a', '#2f3a22', '#7a5c3a', '#151a12'], 'camo', 'Classic four-colour woodland camo, sized for a full car.', 91],
  ['urban-camo', 'Urban Camo', 'Camo', 'Grey / Black', ['#9aa1a8', '#5b6168', '#c9ced3', '#1f2226'], 'camo', 'City-grey camo blobs — understated and tough.', 101],
  ['arctic-camo', 'Arctic Camo', 'Camo', 'White / Ice blue', ['#eef3f7', '#c7d6e2', '#8fa8bd', '#4a5d70'], 'camo', 'Snow-white camo with ice-blue and slate shapes.', 113],
  ['digital-camo', 'Digital Camo', 'Camo', 'Desert / Brown', ['#c8b48a', '#a48b5f', '#7a6343', '#4b3c28'], 'pixel', 'Pixelated desert digital camo.', 127],
  ['neon-pixel-camo', 'Neon Pixel Camo', 'Camo', 'Black / Neon', ['#121417', '#2a2e35', '#ff2e88', '#00f0ff'], 'pixel', 'Digital camo in black with neon pink and cyan pixels.', 131],
  ['le-mans-stripes', 'Le Mans Stripes', 'Sport', 'White / Blue', ['#ffffff', '#1f4fd1', '#e8314a'], 'lemans', 'Endurance-racing twin stripes with a number roundel.', 141],
  ['retro-80s', 'Retro 80s', 'Sport', 'White / Sunset', ['#f5f2ea', '#ffc61a', '#ff7a1a', '#e8314a'], 'retro', 'Three-tone eighties stripes kicking up over the rear wheel.', 151],
  ['sunset-gt', 'Sunset GT', 'Sport', 'Purple / Orange', ['#2b1055', '#e8314a', '#ffb347'], 'sunset', 'Sunset gradient with white speed lines — synthwave GT.', 163],
  ['checker-rush', 'Checker Rush', 'Sport', 'Yellow / Black', ['#ffd400', '#16181d', '#e8314a'], 'checker', 'A chequered flag breaking apart toward the front.', 173],
  ['carbon-strike', 'Carbon Strike', 'Sport', 'Carbon / Red', ['#1b1d21', '#e8314a', '#ffffff'], 'carbon', 'Carbon-weave print with a red strike — track-day ready.', 181],
  ['rally-blocks', 'Rally Blocks', 'Sport', 'White / Blue / Red', ['#f5f5f5', '#1f4fd1', '#e8314a', '#16181d'], 'rally', 'Angular rally colour blocks with speed slashes.', 191],
  ['cosmic-nebula', 'Cosmic Nebula', 'Art', 'Space / Violet', ['#06071a', '#7c3aed', '#ec4899', '#22d3ee'], 'galaxy', 'A starfield and glowing nebula clouds across the whole car.', 201],
  ['great-wave', 'Great Wave', 'Art', 'Blue / White', ['#f3ead7', '#1d4e89', '#0b2545'], 'waves', 'Stylised ocean waves with white foam crests, in classic print colours.', 211],
  ['paint-explosion', 'Paint Explosion', 'Art', 'White / Multi-colour', ['#f7f7f5', '#ff2e88', '#00b3ff', '#ffc61a'], 'splash', 'Paint splashes and drips in pink, blue and yellow.', 223],
];
export const LIVERY_DESIGNS = RAW.map(([slug, name, style, col, c, gen, d, seed]) => ({ slug, name, style, ind: 'Car styling', col, c, gen, d, seed, livery: true }));

export function liveryArt(d, W, H, o = {}) {
  const R = rnd(d.seed * 7919);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${d.name} — full car wrap design (${o.mirror ? 'passenger' : 'driver'} side)</title>
<g id="graphics"${o.mirror ? ` transform="matrix(-1 0 0 1 ${W} 0)"` : ''}>${G[d.gen](W, H, d.c, R, d.seed)}</g>
</svg>`;
}
