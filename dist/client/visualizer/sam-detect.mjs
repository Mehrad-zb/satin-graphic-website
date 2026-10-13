// Vehicle detection for a customer photo, shared by the design studio: the same in-browser segmentation model as the wrap
// visualizer (SlimSAM in sam-worker.mjs) finds the vehicle, its wheels, plates and windows, and returns the painted body.
// detectVehicle(source, {onProgress}) -> {w, h, car, paint, glass} (Uint8Array 0/255 masks at w × h), or null.
import { refineMask, splitCar } from './photo-maps.mjs';

let worker = null, wseq = 0;
const pending = new Map();
let progressCb = null;
function samWorker() {
  if (worker) return worker;
  worker = new Worker('/visualizer/sam-worker.mjs', { type: 'module' });
  worker.onmessage = e => {
    const m = e.data;
    if (m.type === 'progress') { progressCb?.(m.pct); return; }
    const p = pending.get(m.seq); if (!p) return; pending.delete(m.seq);
    if (m.type === 'error') p.no(new Error(m.message)); else p.ok(m);
  };
  worker.onerror = e => { e.preventDefault?.(); for (const p of pending.values()) p.no(new Error(e.message || 'AI worker failed')); pending.clear(); worker = null; };
  return worker;
}
const ask = (msg, transfer = []) => new Promise((ok, no) => { const s = ++wseq; pending.set(s, { ok, no }); try { samWorker().postMessage({ ...msg, seq: s }, transfer); } catch (e) { pending.delete(s); no(e); } });
const planeOf = (m, k) => m.data.subarray(k * m.w * m.h, (k + 1) * m.w * m.h);
function stats(mask, w, h) { let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { n, frac: n / (w * h), x0, x1, y0, y1, bw: x1 - x0, bh: y1 - y0 }; }

async function findCar(id, w, h) {
  const tries = [[.5, .58], [.5, .5], [.36, .6], [.64, .6], [.5, .68]];
  let best = null;
  for (const [x, y] of tries) {
    const m = await ask({ type: 'decode', id, points: [[x, y, 1]] });
    for (let k = 0; k < 3; k++) {
      const mk = planeOf(m, k), s = stats(mk, w, h);
      if (s.frac < .03 || s.frac > .9 || s.bw < w * .15) continue;
      const touches = (s.x0 <= 1) + (s.x1 >= w - 2) + (s.y0 <= 1) + (s.y1 >= h - 2);
      const score = m.scores[k] * Math.sqrt(s.frac) * (touches >= 3 ? .3 : 1);
      if (!best || score > best.score) best = { score, mask: mk.slice(), s };
    }
    if (best && best.score > .3) break;
  }
  if (!best) return null;
  const { s } = best, pts = [];
  for (const [fx, fy] of [[.5, .55], [.25, .62], [.75, .62], [.5, .78]]) {
    const x = Math.round(s.x0 + s.bw * fx), y = Math.round(s.y0 + s.bh * fy);
    if (best.mask[y * w + x]) pts.push([x / w, y / h, 1]);
  }
  if (pts.length >= 2) {
    const m = await ask({ type: 'decode', id, points: pts });
    let k2 = -1, a2 = 0; for (let k = 0; k < 3; k++) { const st2 = stats(planeOf(m, k), w, h); if (m.scores[k] > .6 && st2.frac < .9 && st2.n > a2 && st2.n > best.s.n * .85) { a2 = st2.n; k2 = k; } }
    if (k2 >= 0) { const mk = planeOf(m, k2); for (let i = 0; i < mk.length; i++) if (mk[i]) best.mask[i] = 255; }
  }
  return best.mask;
}

// wheels and plates (kept out of the paint) and windows, from low-resolution probes across the body
async function findParts(id, rgba, w, h, car) {
  const c = stats(car, w, h), excl = new Uint8Array(w * h); let wheels = 0, plates = 0, windows = 0;
  if (!c.n) return { excl, glass: null };
  let low = null, lowG = null, lw = 0, lh = 0;
  const ref = []; for (let y = Math.round(c.y0 + c.bh * .5); y < c.y0 + c.bh * .72; y += 3) for (let x = Math.round(c.x0 + c.bw * .25); x < c.x0 + c.bw * .75; x += 3) { const i = y * w + x; if (car[i]) { const p = i * 4; ref.push((rgba[p] * .299 + rgba[p + 1] * .587 + rgba[p + 2] * .114) / 255); } }
  ref.sort((a, b) => a - b); const pl = ref.length ? ref[ref.length >> 1] : .5;
  const probesAt = [];
  for (const fy of [.84, .7]) for (let fx = .08; fx < .96; fx += .12) probesAt.push([fx, fy, 'low']);
  for (const fy of [.2, .32]) for (let fx = .3; fx < .9; fx += .12) probesAt.push([fx, fy, 'top']);
  for (const [fx, fy, band] of probesAt) {
    const x = Math.round(c.x0 + c.bw * fx), y = Math.round(c.y0 + c.bh * fy);
    if (!car[y * w + x] || (low && low[Math.floor(y * lh / h) * lw + Math.floor(x * lw / w)])) continue;
    if (lowG && lowG[Math.floor(y * lh / h) * lw + Math.floor(x * lw / w)]) continue;
    const m = await ask({ type: 'decode', id, points: [[x / w, y / h, 1]], lowres: true });
    if (!low) { lw = m.w; lh = m.h; low = new Uint8Array(lw * lh); lowG = new Uint8Array(lw * lh); }
    const sx = lw / w, sy = lh / h, cy0 = c.y0 * sy, cy1 = c.y1 * sy, cbh = cy1 - cy0, cn = c.n * sx * sy;
    let best = null;
    if (band === 'top') {
      for (let k = 0; k < 3; k++) {
        const mk = planeOf(m, k), t = stats(mk, lw, lh); if (!t.n || m.scores[k] < .6) continue;
        const bw = t.bw + 1, bh = t.bh + 1, area = t.n / cn, cyr = ((t.y0 + t.y1) / 2 - cy0) / cbh;
        if (area < .012 || area > .16 || bw / bh > 5 || bw / bh < .5 || t.n / (bw * bh) < .4 || cyr > .5) continue;
        let L = 0, q = 0; for (let j = 0; j < mk.length; j += 2) if (mk[j]) { const X = Math.min(w - 1, Math.round((j % lw) / sx)), Y = Math.min(h - 1, Math.round(((j / lw) | 0) / sy)), p = (Y * w + X) * 4; L += (rgba[p] * .299 + rgba[p + 1] * .587 + rgba[p + 2] * .114) / 255; q++; }
        L /= Math.max(1, q);
        if ((pl < .35 && L > pl + .1) || (pl >= .35 && L < pl - .25)) { if (!best || t.n > best.n) best = { mk, n: t.n }; }
      }
      if (best) { windows++; for (let j = 0; j < lowG.length; j++) if (best.mk[j]) lowG[j] = 255; }
      continue;
    }
    for (let k = 0; k < 3; k++) {
      const mk = planeOf(m, k), t = stats(mk, lw, lh); if (!t.n || m.scores[k] < .55) continue;
      const bw = t.bw + 1, bh = t.bh + 1, fill = t.n / (bw * bh), asp = bw / bh, area = t.n / cn;
      const wheel = area > .012 && area < .2 && asp > .45 && asp < 1.3 && fill > .6 && fill < .86 && cy1 - t.y1 < cbh * .15; // round, touching the ground: a wheel, not a lower door panel
      const plate = area > .002 && area < .05 && asp > 1.5 && asp < 4.5 && bh < cbh * .12 && fill > .8 && (t.y0 + t.y1) / 2 > cy0 + cbh * .35; // a lower door or rocker strip is longer and taller than a plate
      if ((wheel || plate) && (!best || t.n > best.n)) best = { mk, n: t.n, wheel };
    }
    if (!best) continue;
    best.wheel ? wheels++ : plates++;
    for (let j = 0; j < low.length; j++) if (best.mk[j]) low[j] = 255;
  }
  const up = src => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) { const ly = Math.min(lh - 1, Math.floor(y * lh / h)) * lw; for (let x = 0; x < w; x++) o[y * w + x] = src[ly + Math.min(lw - 1, Math.floor(x * lw / w))]; } const r = refineMask(rgba, w, h, o); for (let i = 0; i < r.length; i++) o[i] = r[i] && car[i] ? 255 : 0; return o; };
  if (wheels + plates) excl.set(up(low));
  return { excl, glass: windows ? up(lowG) : null };
}

export async function detectVehicle(source, { onProgress, maxSide = 1600 } = {}) {
  const sw = source.width, sh = source.height, sc = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * sc)), h = Math.max(1, Math.round(sh * sc));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high'; g.drawImage(source, 0, 0, w, h);
  const rgba = g.getImageData(0, 0, w, h).data;
  progressCb = pct => onProgress?.('load', pct);
  await ask({ type: 'load' });
  onProgress?.('analyse');
  const id = 'studio' + Date.now(), bitmap = await createImageBitmap(c);
  await ask({ type: 'embed', id, bitmap }, [bitmap]);
  onProgress?.('parts');
  const car = await findCar(id, w, h);
  if (!car) return null;
  const carR = refineMask(rgba, w, h, car);
  const parts = await findParts(id, rgba, w, h, carR);
  const sp = splitCar(rgba, w, h, carR);
  for (let j = 0; j < sp.paint.length; j++) { if (parts.excl[j]) sp.paint[j] = 0; if (parts.glass && parts.glass[j]) { sp.paint[j] = 0; sp.glass[j] = 255; } }
  return { w, h, car: carR, paint: sp.paint, glass: sp.glass, excl: parts.excl, windows: parts.glass, split: { paint: sp.paint.reduce((a, v) => a + (v ? 1 : 0), 0), glass: sp.glass.reduce((a, v) => a + (v ? 1 : 0), 0) } };
}
