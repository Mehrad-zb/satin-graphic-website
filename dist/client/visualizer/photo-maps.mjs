/* Satin Graphic — Wrap Visualizer: turn a customer photo + paint mask into the same shading data our studio vehicles use.
   The photo's light is split into diffuse shading D (how much light a panel receives) and reflections S (sky, windows,
   studio lights mirrored in the clear coat). The wrap colour is then re-lit with D and the reflections are laid back on top,
   so body lines, reflections and shadows stay where they are on the real car.
   Pure functions (no DOM) — usable in a worker or in Node for tests. */
const toLin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const LIN = new Float32Array(256).map((_, i) => toLin(i));
const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Separable box blur ×3 (≈ gaussian) of a W×H float field. Running sums, row-major in both passes (cache friendly). */
export function blur(src, w, h, rx, ry = rx, iters = 3) {
  rx = Math.round(rx); ry = Math.round(ry);
  const a = Float32Array.from(src), b = new Float32Array(a.length), acc = new Float64Array(w);
  const hpass = (inp, out, r) => {
    if (r < 1) { out.set(inp); return; }
    const d = 1 / (2 * r + 1), last = w - 1;
    for (let row = 0; row < w * h; row += w) {
      let s = 0;
      for (let i = -r; i <= r; i++) s += inp[row + (i < 0 ? 0 : i > last ? last : i)];
      for (let x = 0; x < w; x++) { out[row + x] = s * d; const ia = x + r + 1, ir = x - r; s += inp[row + (ia > last ? last : ia)] - inp[row + (ir < 0 ? 0 : ir)]; }
    }
  };
  const vpass = (inp, out, r) => {
    if (r < 1) { out.set(inp); return; }
    const d = 1 / (2 * r + 1), last = h - 1; acc.fill(0);
    for (let i = -r; i <= r; i++) { const row = (i < 0 ? 0 : i > last ? last : i) * w; for (let x = 0; x < w; x++) acc[x] += inp[row + x]; }
    for (let y = 0; y < h; y++) {
      const o = y * w, ra = (y + r + 1 > last ? last : y + r + 1) * w, rr = (y - r < 0 ? 0 : y - r) * w;
      for (let x = 0; x < w; x++) { out[o + x] = acc[x] * d; acc[x] += inp[ra + x] - inp[rr + x]; }
    }
  };
  for (let k = 0; k < iters; k++) { hpass(a, b, rx); vpass(b, a, ry); }
  return a;
}
/** Snap a coarse 0/255 mask (Segment Anything works at 256 px) to the photo's real edges with a guided filter
 *  (He et al.), using the colour photo's luminance as the guide. Returns a new 0/255 mask. */
export function refineMask(rgba, W, H, mask, r = Math.max(2, Math.round(Math.max(W, H) / 260)), eps = 4e-4) {
  const N = W * H, I = new Float32Array(N), p = new Float32Array(N), II = new Float32Array(N), Ip = new Float32Array(N);
  for (let i = 0, q = 0; i < N; i++, q += 4) { const v = (rgba[q] * .299 + rgba[q + 1] * .587 + rgba[q + 2] * .114) / 255; I[i] = v; p[i] = mask[i] ? 1 : 0; II[i] = v * v; Ip[i] = v * p[i]; }
  const mI = blur(I, W, H, r, r, 1), mp = blur(p, W, H, r, r, 1), mII = blur(II, W, H, r, r, 1), mIp = blur(Ip, W, H, r, r, 1);
  const A = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (mIp[i] - mI[i] * mp[i]) / (mII[i] - mI[i] * mI[i] + eps); A[i] = a; B[i] = mp[i] - a * mI[i]; }
  const mA = blur(A, W, H, r, r, 1), mB = blur(B, W, H, r, r, 1), out = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const q = mA[i] * I[i] + mB[i]; out[i] = q > .5 ? 255 : 0; }
  return out;
}
/** Blur that only averages inside the mask (normalised convolution) so dark surroundings don't bleed into panel edges. */
function maskedBlur(v, m, w, h, r) {
  const num = new Float32Array(v.length); for (let i = 0; i < v.length; i++) num[i] = v[i] * m[i];
  const a = blur(num, w, h, r), b = blur(m, w, h, r), o = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) o[i] = b[i] > 1e-4 ? a[i] / b[i] : 0;
  return o;
}
function percentile(arr, idx, p) { // sampled: ~60k values are plenty for a percentile
  const step = Math.max(1, Math.floor(idx.length / 60000)), n = Math.ceil(idx.length / step), s = new Float32Array(n);
  for (let k = 0, q = 0; k < idx.length; k += step) s[q++] = arr[idx[k]]; s.sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] || 0;
}

/** rgba: Uint8ClampedArray (W×H×4); paint, glass: Uint8Array alpha masks 0..255 (glass optional).
 *  Returns the vehicle record the visualizer renderer expects. */
export function vehicleFromPhoto(rgba, W, H, paint, glass = null) {
  const N0 = W * H, L = new Float32Array(N0), m = new Float32Array(N0);
  const idx = [];
  for (let i = 0, p = 0; i < N0; i++, p += 4) {
    L[i] = .2126 * LIN[rgba[p]] + .7152 * LIN[rgba[p + 1]] + .0722 * LIN[rgba[p + 2]];
    m[i] = paint[i] / 255; if (paint[i] > 3) idx.push(i);
  }
  const paintIdx = Uint32Array.from(idx), N = paintIdx.length;
  if (N < 200) throw new Error('No paint selected');
  // bounding box + typical paint colour (median of solid paint)
  let x0 = W, x1 = 0, y0 = H, y1 = 0; const solid = [];
  for (let k = 0; k < N; k++) { const i = paintIdx[k], x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (paint[i] > 200) solid.push(i); }
  const solidIdx = solid.length > 100 ? solid : idx;
  const baseL = Math.max(.004, percentile(L, solidIdx, .5));
  const carW = Math.max(40, x1 - x0);
  // large-scale lighting (panel orientation) and fine shading, both measured only on paint
  const Lbig = maskedBlur(L, m, W, H, Math.max(2, carW / 45));
  const Lmid = maskedBlur(L, m, W, H, Math.max(1, carW / 150));
  const L1 = maskedBlur(L, m, W, H, Math.max(1, carW / 600)); // denoised luminance (JPEG/WebP block noise)
  const light = smooth(.05, .32, baseL);            // 0 = black/dark car, 1 = white/light car
  // dark cars: the visible light is almost all reflection; use the reflection pattern itself as the panel shading guess
  const pLo = percentile(Lbig, solidIdx, .05), pHi = Math.max(pLo + 1e-4, percentile(Lbig, solidIdx, .95));
  const D = new Float32Array(N), S = new Float32Array(N), E = new Float32Array(N), M = new Float32Array(N), X = new Float32Array(N), Y = new Float32Array(N), R = new Float32Array(N);
  const Sfull = new Float32Array(N0);
  for (let k = 0; k < N; k++) {
    const i = paintIdx[k], x = i % W, y = (i / W) | 0;
    // light paint: D from the photo's own shading, highlights above the smooth shading are reflections
    const dLight = Lmid[i] / baseL, sLight = Math.max(0, L1[i] - Lbig[i] * 1.06 - .012) * 1.2 + Math.max(0, L1[i] - .82) * .6;
    const dL = Math.min(L1[i], Lbig[i] * 1.04) / baseL;
    // dark paint: shading guessed from the large-scale reflection field, reflections = what is above the paint's own level
    const shape = (Lbig[i] - pLo) / (pHi - pLo);
    const dDark = .52 + .62 * Math.min(1.2, Math.max(0, shape)), sDark = Math.max(0, L1[i] - baseL * .85 - .004) * 1.05;
    // crisp body lines: strong local darkening (panel gaps, handles, creases) is kept, low-level compression noise is not
    const g = (L[i] - L1[i]) / Math.max(.02, L1[i]), gap = g < -.07 ? Math.max(-.85, (g + .07) * 1.15) : 0, edge = g > .1 ? (g - .1) * L1[i] * .8 : 0;
    D[k] = (light * (.55 * dL + .45 * dLight) + (1 - light) * dDark) * (1 + gap);
    S[k] = light * sLight + (1 - light) * sDark + edge;
    M[k] = m[i]; R[k] = hash(x, y);
    X[k] = (x - x0) / Math.max(1, x1 - x0); Y[k] = (y - y0) / Math.max(1, y1 - y0);
  }
  // normalise D like the studio assets (93rd percentile = 1), clamp reflections
  const dIdx = Uint32Array.from({ length: N }, (_, k) => k);
  const d93 = Math.max(.05, percentile(D, dIdx, .93));
  for (let k = 0; k < N; k++) { D[k] = Math.min(1.3, Math.max(0, D[k] / d93)); S[k] = Math.min(1, S[k]); Sfull[paintIdx[k]] = S[k]; }
  // horizon / environment map: upper surfaces see the sky, lower ones the ground
  for (let k = 0; k < N; k++) E[k] = Math.min(1, Math.max(0, (.18 + .72 * (1 - Y[k]) ** 1.3) * (.55 + .45 * Math.min(1, D[k])) + .5 * S[k]));
  const pick = arr => { const o = new Float32Array(N); for (let k = 0; k < N; k++) o[k] = arr[paintIdx[k]]; return o; };
  const sc = carW / 1330; // blur radii relative to our 1600 px studio frame
  const S5 = pick(blur(Sfull, W, H, 3 * sc)), S14 = pick(blur(Sfull, W, H, 8 * sc)), SX = pick(blur(Sfull, W, H, 14 * sc, 1)), S40 = pick(blur(Sfull, W, H, 22 * sc));
  const streak = new Float32Array(N0); for (let i = 0; i < N0; i++) streak[i] = hash(i % W, (i / W) | 0);
  const BR = pick(blur(streak, W, H, 22 * sc, 0));
  const gl = []; if (glass) for (let i = 0; i < N0; i++) if (glass[i] > 3) gl.push(i);
  const GM = new Float32Array(gl.length); for (let k = 0; k < gl.length; k++) GM[k] = glass[gl[k]] / 255;
  return { W, H, base: rgba, paint: paintIdx, glass: Uint32Array.from(gl), rim: new Uint32Array(0), D, S, E, M, X, Y, R, S5, S14, SX, S40, BR, RM: new Float32Array(0), RL: new Float32Array(0), GM, photo: true, baseL };
}

/** Split a SAM "whole car" mask into paint / glass / tyres with colour + position heuristics.
 *  Returns { paint, glass, seeds:{pos:[[x,y]...], neg:[[x,y]...]} } — seeds (normalised) can refine the paint with SAM. */
export function splitCar(rgba, W, H, car) {
  const N0 = W * H; let x0 = W, x1 = 0, y0 = H, y1 = 0, n = 0;
  for (let i = 0; i < N0; i++) if (car[i] > 127) { const x = i % W, y = (i / W) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bh = Math.max(1, y1 - y0), bw = Math.max(1, x1 - x0);
  const lum = new Float32Array(N0), sat = new Float32Array(N0);
  for (let i = 0, p = 0; i < N0; i++, p += 4) { const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); lum[i] = (r * .299 + g * .587 + b * .114) / 255; sat[i] = mx ? (mx - mn) / mx : 0; }
  // dominant paint colour: histogram of hue/lightness over the lower-middle band of the car (doors), the most reliable paint area
  const bins = new Map();
  for (let y = Math.round(y0 + bh * .45); y < y0 + bh * .75; y += 2) for (let x = Math.round(x0 + bw * .2); x < x0 + bw * .8; x += 2) {
    const i = y * W + x; if (car[i] < 128) continue; const p = i * 4;
    const key = (rgba[p] >> 5) << 6 | (rgba[p + 1] >> 5) << 3 | (rgba[p + 2] >> 5); bins.set(key, (bins.get(key) || 0) + 1);
  }
  let best = 0, bk = 0; for (const [k, c] of bins) if (c > best) { best = c; bk = k; }
  const pr = ((bk >> 6) & 7) * 32 + 16, pg = ((bk >> 3) & 7) * 32 + 16, pb = (bk & 7) * 32 + 16, pl = (pr * .299 + pg * .587 + pb * .114) / 255;
  const paint = new Uint8Array(N0), glass = new Uint8Array(N0);
  const light = pl > .35;
  for (let i = 0; i < N0; i++) {
    if (car[i] < 128) continue;
    const y = (i / W) | 0, x = i % W, ry = (y - y0) / bh, p = i * 4;
    const dist = Math.hypot(rgba[p] - pr, rgba[p + 1] - pg, rgba[p + 2] - pb) / 255;
    let isGlass = false, isTyre = false;
    if (light) { // light paint: windows and tyres are clearly darker than the paint
      if (ry < .55 && lum[i] < pl - .28 && sat[i] < .35) isGlass = true;
      if (ry > .55 && lum[i] < Math.min(.36, pl * .5) && sat[i] < .35) isTyre = true; // tyres and dark wheel faces
    } else { // dark paint: glass is usually a little bluer/greener or lighter (reflections of interior/sky) — keep conservative
      if (ry < .5 && dist > .35 && sat[i] < .25 && lum[i] > pl + .25) isGlass = true;
      if (ry > .7 && lum[i] < .08) isTyre = true;
    }
    if (isGlass) glass[i] = 255; else if (!isTyre) paint[i] = 255;
  }
  // windows are big compact blobs; thin bright streaks are reflections on the paint (dark cars) and stay paint
  const blobs = keepBlobs(cleanMask(glass, W, H, 1), W, H, n * .004, bw * .025);
  for (let i = 0; i < N0; i++) if (glass[i] && !blobs[i] && car[i] >= 128 && !(light ? false : (((i / W) | 0) - y0) / bh > .7 && lum[i] < .08)) paint[i] = 255;
  return { paint: open(cleanMask(paint, W, H, Math.max(1, Math.round(bw / 400))), W, H), glass: blobs, color: [pr, pg, pb], box: [x0, y0, x1, y1] };
}
// keep connected components (4-neighbour) with enough area and thickness
function keepBlobs(m, W, H, minArea, minSide) {
  const lab = new Int32Array(m.length), out = new Uint8Array(m.length), stack = new Int32Array(m.length);
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue;
    let top = 0, n = 0, x0 = W, x1 = 0, y0 = H, y1 = 0; stack[top++] = s; lab[s] = s + 1; const members = [];
    while (top) { const i = stack[--top], x = i % W, y = (i / W) | 0; members.push(i); n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < m.length && m[j] && !lab[j] && Math.abs((j % W) - x) <= 1) { lab[j] = s + 1; stack[top++] = j; } }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (n >= minArea && Math.min(bw, bh) >= minSide && n / (bw * bh) > .22) for (const i of members) out[i] = 255;
  }
  return out;
}
// morphological helpers on 0/255 masks
function dilate(m, W, H, r) { // square max filter, separable
  const t = new Uint8Array(m.length), o = new Uint8Array(m.length);
  for (let y = 0; y < H; y++) { const row = y * W; for (let x = 0; x < W; x++) { let v = 0; const a = x - r < 0 ? 0 : x - r, b = x + r >= W ? W - 1 : x + r; for (let k = a; k <= b; k++) if (m[row + k]) { v = 255; break; } t[row + x] = v; } }
  for (let y = 0; y < H; y++) { const a = y - r < 0 ? 0 : y - r, b = y + r >= H ? H - 1 : y + r; for (let x = 0; x < W; x++) { let v = 0; for (let k = a; k <= b; k++) if (t[k * W + x]) { v = 255; break; } o[y * W + x] = v; } }
  return o;
}
function erode(m, W, H, r) { const inv = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 255; const d = dilate(inv, W, H, r); for (let i = 0; i < m.length; i++) d[i] = d[i] ? 0 : 255; return d; }
function cleanMask(m, W, H, r) { return erode(dilate(m, W, H, r), W, H, r); } // closing: fills pinholes
function open(m, W, H) { return dilate(erode(m, W, H, 1), W, H, 1); }
/** Feather a 0/255 mask by ~r px (soft edge) */
export function feather(m, W, H, r) { const f = new Float32Array(m.length); for (let i = 0; i < m.length; i++) f[i] = m[i] / 255; const b = blur(f, W, H, r); const o = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) o[i] = Math.round(255 * Math.min(1, Math.max(0, (b[i] - .5) * 1.6 + .5)) * (m[i] ? 1 : Math.min(1, b[i] * 2))); return o; }
