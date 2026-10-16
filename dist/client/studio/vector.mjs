// Design Studio → vector PDF content (no dependencies).
// Turns the print SVG of one design element (svgArtwork(..., {layers:[layer]})) into PDF drawing operators in CMYK:
// shapes, lines, mascots and gradients stay vectors; text is converted to outlines from the real TrueType font
// (GET /api/fonts/ttf, fonts_ttf.php); photos are embedded once at their full resolution (CMYK JPEG, or Flate + alpha
// mask when transparent); SVG logos uploaded by the customer are vectorized too when they use plain SVG.
// Anything this module can't reproduce exactly (right-to-left / complex scripts, a missing font or glyph, filters,
// masks, patterns…) throws VectorError; designer.mjs then falls back to a high-resolution raster for that one element.
// Coordinates: the SVG's user space (1 unit = 0.01 in, y down). pdf.mjs maps it onto the page.
import {rgbToCmyk,rgbaToCmyk,canvasToCMYKJpeg} from './cmyk.mjs';

export class VectorError extends Error {}
const fail = m => { throw new VectorError(m); };
const num = n => { const v = Math.round(n * 1000) / 1000; return Object.is(v, -0) ? '0' : String(v); };

/* ---------------- colours ---------------- */
const NAMED = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', gray: '#808080', grey: '#808080', orange: '#ffa500', purple: '#800080', silver: '#c0c0c0', navy: '#000080' };
function rgbOf(s) {
  s = String(s || '').trim().toLowerCase(); if (NAMED[s]) s = NAMED[s];
  let m = s.match(/^#([0-9a-f]{3})$/); if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = s.match(/^#([0-9a-f]{6})$/); if (m) { const n = parseInt(m[1], 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  m = s.match(/^rgba?\(\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/); if (m) return [+m[1], +m[2], +m[3]].map(v => Math.max(0, Math.min(255, Math.round(v))));
  return null;
}
export function cmykOf(color) { const c = rgbOf(color); if (!c) fail('colour ' + color); return rgbToCmyk(c[0], c[1], c[2]).map(v => v / 255); }
const cmykOps = (c, op) => c.map(num).join(' ') + ' ' + op;

/* ---------------- geometry ---------------- */
const IDENT = [1, 0, 0, 1, 0, 0];
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
export function parseTransform(s) {
  let m = IDENT; if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g; let t;
  while ((t = re.exec(s))) {
    const a = t[2].trim().split(/[\s,]+/).filter(Boolean).map(Number); let x;
    if (t[1] === 'matrix') x = a.slice(0, 6);
    else if (t[1] === 'translate') x = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (t[1] === 'scale') x = [a[0], 0, 0, a.length > 1 ? a[1] : a[0], 0, 0];
    else if (t[1] === 'rotate') { const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); x = [c, sn, -sn, c, 0, 0]; if (a.length > 2) x = mul(mul([1, 0, 0, 1, a[1], a[2]], x), [1, 0, 0, 1, -a[1], -a[2]]); }
    else if (t[1] === 'skewX') x = [1, 0, Math.tan(a[0] * Math.PI / 180), 1, 0, 0];
    else x = [1, Math.tan(a[0] * Math.PI / 180), 0, 1, 0, 0];
    if (x.some(v => !Number.isFinite(v))) fail('transform');
    m = mul(m, x);
  }
  return m;
}
const cm = m => m === IDENT || (m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1 && m[4] === 0 && m[5] === 0) ? '' : m.map(num).join(' ') + ' cm\n';

// SVG path data → absolute segments: ['M',x,y] ['L',x,y] ['C',x1,y1,x2,y2,x,y] ['Z']
export function parsePath(d) {
  const tok = String(d || '').match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const out = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const n = () => { const v = parseFloat(tok[i++]); if (!Number.isFinite(v)) fail('path'); return v; };
  const flag = () => { // arc flags may be written without separators ("a5 5 0 011 1")
    const t = tok[i]; if (t === '0' || t === '1') { i++; return +t; }
    if (/^[01]/.test(t)) { tok[i] = t.slice(1); return +t[0]; } return n(); };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++]; else if (!cmd) fail('path');
    const rel = cmd === cmd.toLowerCase() && cmd !== 'z' ? 1 : 0, C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { x = ox + n(); y = oy + n(); out.push(['M', x, y]); sx = x; sy = y; cmd = rel ? 'l' : 'L'; lc = lq = null; continue; }
    if (C === 'Z') { out.push(['Z']); x = sx; y = sy; lc = lq = null; cmd = ''; continue; }
    if (C === 'L') { x = ox + n(); y = oy + n(); out.push(['L', x, y]); lc = lq = null; continue; }
    if (C === 'H') { x = ox + n(); out.push(['L', x, y]); lc = lq = null; continue; }
    if (C === 'V') { y = oy + n(); out.push(['L', x, y]); lc = lq = null; continue; }
    if (C === 'C' || C === 'S') {
      let x1, y1; if (C === 'C') { x1 = ox + n(); y1 = oy + n(); } else { x1 = lc ? 2 * x - lc[0] : x; y1 = lc ? 2 * y - lc[1] : y; }
      const x2 = ox + n(), y2 = oy + n(), ex = ox + n(), ey = oy + n();
      out.push(['C', x1, y1, x2, y2, ex, ey]); lc = [x2, y2]; lq = null; x = ex; y = ey; continue;
    }
    if (C === 'Q' || C === 'T') {
      let qx, qy; if (C === 'Q') { qx = ox + n(); qy = oy + n(); } else { qx = lq ? 2 * x - lq[0] : x; qy = lq ? 2 * y - lq[1] : y; }
      const ex = ox + n(), ey = oy + n();
      out.push(['C', x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey), ex, ey]); lq = [qx, qy]; lc = null; x = ex; y = ey; continue;
    }
    if (C === 'A') {
      const rx = Math.abs(n()), ry = Math.abs(n()), rot = n(), large = flag(), sweep = flag(), ex = ox + n(), ey = oy + n();
      for (const s of arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey)) out.push(s);
      x = ex; y = ey; lc = lq = null; continue;
    }
    fail('path command ' + cmd);
  }
  return out;
}
function arcToCubics(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [['L', x2, y2]];
  const p = phi * Math.PI / 180, cp = Math.cos(p), sp = Math.sin(p);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  let l = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (l > 1) { l = Math.sqrt(l); rx *= l; ry *= l; }
  const sg = fa === fs ? -1 : 1, num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sg * Math.sqrt(Math.max(0, num2 / den)), cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; if (fs && dt < 0) dt += 2 * Math.PI;
  const segs = Math.ceil(Math.abs(dt) / (Math.PI / 2)), d = dt / segs, k = 4 / 3 * Math.tan(d / 4), out = [];
  for (let s = 0; s < segs; s++) {
    const a1 = t1 + s * d, a2 = a1 + d, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const P = (ux, uy) => [cx + cp * rx * ux - sp * ry * uy, cy + sp * rx * ux + cp * ry * uy];
    const q1 = P(c1 - k * s1, s1 + k * c1), q2 = P(c2 + k * s2, s2 - k * c2), e = P(c2, s2);
    out.push(['C', q1[0], q1[1], q2[0], q2[1], e[0], e[1]]);
  }
  return out;
}
const K = 0.5522847498;
function ellipseSegs(cx, cy, rx, ry) {
  return [['M', cx + rx, cy], ['C', cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry], ['C', cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy], ['C', cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry], ['C', cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy], ['Z']];
}
function rectSegs(x, y, w, h, rx, ry) {
  rx = Math.min(Math.max(0, rx || 0), w / 2); ry = Math.min(Math.max(0, ry || 0), h / 2);
  if (!rx || !ry) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  const a = rx * K, b = ry * K;
  return [['M', x + rx, y], ['L', x + w - rx, y], ['C', x + w - rx + a, y, x + w, y + ry - b, x + w, y + ry], ['L', x + w, y + h - ry], ['C', x + w, y + h - ry + b, x + w - rx + a, y + h, x + w - rx, y + h],
    ['L', x + rx, y + h], ['C', x + rx - a, y + h, x, y + h - ry + b, x, y + h - ry], ['L', x, y + ry], ['C', x, y + ry - b, x + rx - a, y, x + rx, y], ['Z']];
}
const tseg = (segs, m) => m === IDENT ? segs : segs.map(s => { if (s[0] === 'Z') return s; const o = [s[0]]; for (let i = 1; i < s.length; i += 2) { const x = s[i], y = s[i + 1]; o.push(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]); } return o; });
function segOps(segs) { let o = ''; for (const s of segs) { if (s[0] === 'M') o += `${num(s[1])} ${num(s[2])} m\n`; else if (s[0] === 'L') o += `${num(s[1])} ${num(s[2])} l\n`; else if (s[0] === 'C') o += `${num(s[1])} ${num(s[2])} ${num(s[3])} ${num(s[4])} ${num(s[5])} ${num(s[6])} c\n`; else o += 'h\n'; } return o; }
function bboxOf(segs) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const s of segs) for (let i = 1; i < s.length; i += 2) { if (s[i] < x0) x0 = s[i]; if (s[i] > x1) x1 = s[i]; if (s[i + 1] < y0) y0 = s[i + 1]; if (s[i + 1] > y1) y1 = s[i + 1]; } return x0 <= x1 ? [x0, y0, x1, y1] : null; }

/* ---------------- TrueType ---------------- */
class TTF {
  constructor(buf) {
    const v = this.v = new DataView(buf); this.u8 = new Uint8Array(buf);
    const tag = v.getUint32(0); if (tag === 0x4F54544F) fail('CFF font'); if (tag !== 0x00010000 && tag !== 0x74727565) fail('not a TrueType font');
    const n = v.getUint16(4); this.t = {};
    for (let i = 0; i < n; i++) { const o = 12 + i * 16; this.t[String.fromCharCode(...this.u8.subarray(o, o + 4))] = v.getUint32(o + 8); }
    for (const k of ['head', 'hhea', 'hmtx', 'maxp', 'cmap', 'loca', 'glyf']) if (this.t[k] == null) fail('font table ' + k);
    this.upm = v.getUint16(this.t.head + 18); this.locShort = v.getInt16(this.t.head + 50) === 0;
    this.nGlyphs = v.getUint16(this.t.maxp + 4); this.nHM = v.getUint16(this.t.hhea + 34);
    this.cmap = this.readCmap(); this.cache = new Map();
  }
  readCmap() {
    const v = this.v, b = this.t.cmap, n = v.getUint16(b + 2); let f4 = null, f12 = null;
    for (let i = 0; i < n; i++) { const pid = v.getUint16(b + 4 + i * 8), eid = v.getUint16(b + 6 + i * 8), off = b + v.getUint32(b + 8 + i * 8), fmt = v.getUint16(off);
      if (fmt === 12 && (pid === 3 && eid === 10 || pid === 0)) f12 = off; else if (fmt === 4 && (pid === 3 && (eid === 1 || eid === 0) || pid === 0)) f4 = f4 ?? off; }
    if (f12 != null) { const groups = [], ng = v.getUint32(f12 + 12); for (let i = 0; i < ng; i++) { const o = f12 + 16 + i * 12; groups.push([v.getUint32(o), v.getUint32(o + 4), v.getUint32(o + 8)]); }
      return cp => { for (const [s, e, g] of groups) if (cp >= s && cp <= e) return g + cp - s; return 0; }; }
    if (f4 == null) fail('font cmap');
    const segX2 = v.getUint16(f4 + 6), ends = f4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    return cp => { if (cp > 0xFFFF) return 0; for (let i = 0; i < segX2; i += 2) { const end = v.getUint16(ends + i); if (cp > end) continue; const st = v.getUint16(starts + i); if (cp < st) return 0;
      const ro = v.getUint16(ranges + i), d = v.getInt16(deltas + i); if (!ro) return (cp + d) & 0xFFFF; const g = v.getUint16(ranges + i + ro + (cp - st) * 2); return g ? (g + d) & 0xFFFF : 0; } return 0; };
  }
  advance(g) { const v = this.v, h = this.t.hmtx; return v.getUint16(h + 4 * Math.min(g, this.nHM - 1)); }
  loc(g) { const v = this.v, l = this.t.loca; return this.locShort ? [v.getUint16(l + g * 2) * 2, v.getUint16(l + g * 2 + 2) * 2] : [v.getUint32(l + g * 4), v.getUint32(l + g * 4 + 4)]; }
  // glyph outline in font units (y up) as segments
  glyph(g, depth = 0) {
    if (this.cache.has(g)) return this.cache.get(g);
    if (g >= this.nGlyphs || depth > 6) return [];
    const v = this.v, [a, b] = this.loc(g); if (b <= a) { this.cache.set(g, []); return []; }
    const o = this.t.glyf + a, nc = v.getInt16(o); let segs = [];
    if (nc >= 0) {
      const endPts = []; for (let i = 0; i < nc; i++) endPts.push(v.getUint16(o + 10 + i * 2));
      const np = nc ? endPts[nc - 1] + 1 : 0, il = v.getUint16(o + 10 + nc * 2); let p = o + 12 + nc * 2 + il;
      const flags = []; while (flags.length < np) { const f = this.u8[p++]; flags.push(f); if (f & 8) { let r = this.u8[p++]; while (r--) flags.push(f); } }
      const xs = [], ys = []; let c = 0;
      for (let i = 0; i < np; i++) { const f = flags[i]; if (f & 2) { const d = this.u8[p++]; c += f & 16 ? d : -d; } else if (!(f & 16)) { c += v.getInt16(p); p += 2; } xs.push(c); }
      c = 0; for (let i = 0; i < np; i++) { const f = flags[i]; if (f & 4) { const d = this.u8[p++]; c += f & 32 ? d : -d; } else if (!(f & 32)) { c += v.getInt16(p); p += 2; } ys.push(c); }
      let s = 0;
      for (const e of endPts) {
        const pts = []; for (let i = s; i <= e; i++) pts.push([xs[i], ys[i], flags[i] & 1]); s = e + 1; if (!pts.length) continue;
        // start on an on-curve point (or the midpoint of two off-curve ones)
        let st = pts.findIndex(q => q[2]); let start;
        if (st < 0) { const q0 = pts[0], q1 = pts[1 % pts.length]; start = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, 1]; st = 0; pts.splice(1, 0, start); st = 1; }
        const ring = pts.slice(st).concat(pts.slice(0, st)); start = ring[0];
        segs.push(['M', start[0], start[1]]); let cur = start, ctrl = null;
        const quad = (q, e2) => segs.push(['C', cur[0] + 2 / 3 * (q[0] - cur[0]), cur[1] + 2 / 3 * (q[1] - cur[1]), e2[0] + 2 / 3 * (q[0] - e2[0]), e2[1] + 2 / 3 * (q[1] - e2[1]), e2[0], e2[1]]);
        for (let i = 1; i <= ring.length; i++) {
          const q = ring[i % ring.length];
          if (q[2]) { if (ctrl) quad(ctrl, q); else segs.push(['L', q[0], q[1]]); cur = q; ctrl = null; }
          else if (ctrl) { const mid = [(ctrl[0] + q[0]) / 2, (ctrl[1] + q[1]) / 2]; quad(ctrl, mid); cur = mid; ctrl = q; } else ctrl = q;
        }
        segs.push(['Z']);
      }
    } else { // composite
      let p = o + 10, more = true;
      while (more) {
        const fl = v.getUint16(p), gi = v.getUint16(p + 2); p += 4; let dx, dy;
        if (fl & 1) { dx = v.getInt16(p); dy = v.getInt16(p + 2); p += 4; } else { dx = v.getInt8(p); dy = v.getInt8(p + 1); p += 2; }
        let m = [1, 0, 0, 1, 0, 0]; const f2 = q => v.getInt16(q) / 16384;
        if (fl & 8) { const sc = f2(p); p += 2; m = [sc, 0, 0, sc, 0, 0]; } else if (fl & 0x40) { m = [f2(p), 0, 0, f2(p + 2), 0, 0]; p += 4; } else if (fl & 0x80) { m = [f2(p), f2(p + 2), f2(p + 4), f2(p + 6), 0, 0]; p += 8; }
        if (!(fl & 2)) fail('composite glyph point matching');
        m[4] = dx; m[5] = dy; segs = segs.concat(tseg(this.glyph(gi, depth + 1), m)); more = !!(fl & 0x20);
      }
    }
    this.cache.set(g, segs); return segs;
  }
}
const FONTS = new Map();
async function fetchFont(family, weight, italic) {
  const r = await fetch(`/api/fonts/ttf?f=${encodeURIComponent(family)}&w=${weight}&i=${italic ? 1 : 0}`);
  if (!r.ok) fail('font ' + family);
  const f = new TTF(await r.arrayBuffer()); f.slant = italic && r.headers.get('X-Font-Synthetic-Italic') === '1'; return f;
}
export function loadFont(family, weight, italic) {
  family = String(family || 'Inter').split(',')[0].trim().replace(/^["']|["']$/g, '');
  const k = family + '|' + weight + '|' + (italic ? 1 : 0);
  if (!FONTS.has(k)) { const p = fetchFont(family, weight, italic).catch(e => { FONTS.delete(k); throw e instanceof VectorError ? e : new VectorError('font ' + family); }); FONTS.set(k, p); }
  return FONTS.get(k);
}
const COMPLEX = /[֐-ࣿऀ-෿฀-࿿က-႟ក-៿יִ-﷿ﹰ-﻿]/; // RTL + scripts that need shaping

/* ---------------- images ---------------- */
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new VectorError('image')); i.src = src; });
async function deflate(u8) { const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function rasterImage(href, maxSide, minSide = 0) {
  const img = await loadImg(href); let w = img.naturalWidth || 0, h = img.naturalHeight || 0;
  if (!w || !h) { w = h = 2000; } // SVG without intrinsic size
  let k = Math.min(1, maxSide / Math.max(w, h)); if (minSide && Math.max(w, h) * k < minSide) k = minSide / Math.max(w, h);
  w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h).data; let opaque = true; for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) { opaque = false; break; }
  if (opaque) { const data = await canvasToCMYKJpeg(c, 92); c.width = c.height = 1; return { w, h, data, dict: '/Filter /DCTDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8' }; }
  const alpha = new Uint8Array(w * h); for (let i = 3, j = 0; i < px.length; i += 4, j++) alpha[j] = px[i];
  const cmyk = rgbaToCmyk(px); c.width = c.height = 1;
  return { w, h, data: await deflate(cmyk), dict: '/Filter /FlateDecode /ColorSpace /DeviceCMYK /BitsPerComponent 8', smask: { data: await deflate(alpha), dict: '/Filter /FlateDecode /ColorSpace /DeviceGray /BitsPerComponent 8' } };
}

/* ---------------- renderer ---------------- */
// opts: {prefix: resource name prefix, maxImage: px (longest side of embedded photos)}
export async function svgToVector(svgText, opts = {}) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) fail('svg parse');
  const R = { ops: '', images: [], shadings: [], gstates: [], forms: [], prefix: opts.prefix || 'v', n: 0, maxImage: opts.maxImage || 6000 };
  const root = doc.documentElement;
  const ids = {}; for (const el of root.querySelectorAll('[id]')) ids[el.id] = el;
  R.ops = await walkChildren(root, R, ids, { fill: '#000000', stroke: 'none', strokeWidth: 1, fillRule: 'nonzero', cap: 0, join: 0, font: {} });
  return R;
}
const name = (R, t) => `${R.prefix}${t}${R.n++}`;
const attr = (el, k) => el.getAttribute(k);
function inherit(el, st) {
  const s = { ...st, font: { ...st.font } }; const style = {};
  (attr(el, 'style') || '').split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) style[d.slice(0, i).trim()] = d.slice(i + 1).trim(); });
  const get = k => style[k] ?? attr(el, k);
  const f = get('fill'); if (f != null) s.fill = f; const sk = get('stroke'); if (sk != null) s.stroke = sk;
  const sw = get('stroke-width'); if (sw != null) s.strokeWidth = parseFloat(sw) || 0;
  const fr = get('fill-rule'); if (fr) s.fillRule = fr; const lc = get('stroke-linecap'); if (lc) s.cap = { butt: 0, round: 1, square: 2 }[lc] ?? 0;
  const lj = get('stroke-linejoin'); if (lj) s.join = { miter: 0, round: 1, bevel: 2 }[lj] ?? 0;
  for (const [k, p] of [['font-family', 'family'], ['font-size', 'size'], ['font-weight', 'weight'], ['font-style', 'style'], ['text-anchor', 'anchor'], ['letter-spacing', 'spacing']]) { const v = get(k); if (v != null) s.font[p] = v; }
  for (const k of ['fill-opacity', 'stroke-opacity', 'mask', 'filter', 'clip-path']) { const v = get(k); if (v != null && v !== 'none' && !(k.endsWith('opacity') && +v === 1)) fail('unsupported ' + k); }
  return s;
}
function opacityOf(el) { const o = attr(el, 'opacity'); const v = o == null ? 1 : Math.max(0, Math.min(1, parseFloat(o))); return Number.isFinite(v) ? v : 1; }
async function walkChildren(el, R, ids, st) { let o = ''; for (const c of el.children) o += await node(c, R, ids, st); return o; }
async function node(el, R, ids, st0) {
  const tag = el.localName; if (['defs', 'style', 'title', 'desc', 'metadata', 'linearGradient', 'radialGradient', 'symbol', 'clipPath', 'mask', 'pattern', 'filter'].includes(tag)) return '';
  if (attr(el, 'display') === 'none' || attr(el, 'visibility') === 'hidden') return '';
  const st = inherit(el, st0), m = parseTransform(attr(el, 'transform')), op = opacityOf(el);
  let body;
  if (tag === 'g' || tag === 'a') body = await walkChildren(el, R, ids, st);
  else if (tag === 'svg') body = await nestedSvg(el, R, ids, st);
  else if (tag === 'text') body = await text(el, R, ids, st);
  else if (tag === 'image') body = await image(el, R, ids, st);
  else if (tag === 'use') { const ref = (attr(el, 'href') || attr(el, 'xlink:href') || '').replace(/^#/, ''); if (!ids[ref]) fail('use'); body = cm([1, 0, 0, 1, +attr(el, 'x') || 0, +attr(el, 'y') || 0]) + await node(ids[ref], R, ids, st); }
  else {
    let segs;
    const f = k => parseFloat(attr(el, k)) || 0;
    if (tag === 'path') segs = parsePath(attr(el, 'd'));
    else if (tag === 'rect') { const rx = attr(el, 'rx'), ry = attr(el, 'ry'); segs = rectSegs(f('x'), f('y'), f('width'), f('height'), rx != null ? +rx : ry != null ? +ry : 0, ry != null ? +ry : rx != null ? +rx : 0); if (f('width') <= 0 || f('height') <= 0) return ''; }
    else if (tag === 'circle') segs = ellipseSegs(f('cx'), f('cy'), f('r'), f('r'));
    else if (tag === 'ellipse') segs = ellipseSegs(f('cx'), f('cy'), f('rx'), f('ry'));
    else if (tag === 'line') { segs = [['M', f('x1'), f('y1')], ['L', f('x2'), f('y2')]]; st.fill = 'none'; }
    else if (tag === 'polyline' || tag === 'polygon') { const p = (attr(el, 'points') || '').trim().split(/[\s,]+/).map(Number); segs = []; for (let i = 0; i + 1 < p.length; i += 2) segs.push([i ? 'L' : 'M', p[i], p[i + 1]]); if (tag === 'polygon') segs.push(['Z']); }
    else fail('element ' + tag);
    body = paint(segs, R, ids, st);
  }
  if (!body) return '';
  if (op < 1) return group(R, cm(m) + body, op);
  return m === IDENT ? body : `q\n${cm(m)}${body}Q\n`;
}
// group opacity: the children are drawn into a transparency-group form and painted once at the opacity
function group(R, ops, op) {
  const f = name(R, 'Fm'), g = name(R, 'Gs');
  R.forms.push({ name: f, ops }); R.gstates.push({ name: g, dict: `<< /Type /ExtGState /ca ${num(op)} /CA ${num(op)} >>` });
  return `q /${g} gs /${f} Do Q\n`;
}
function shadingFor(el, ids, R) {
  const tag = el.localName; if (tag !== 'linearGradient') fail('gradient ' + tag);
  const units = attr(el, 'gradientUnits') || 'objectBoundingBox'; if (attr(el, 'gradientTransform')) fail('gradientTransform');
  let stops = [...el.querySelectorAll('stop')];
  const href = (attr(el, 'href') || attr(el, 'xlink:href') || '').replace(/^#/, ''); if (!stops.length && ids[href]) stops = [...ids[href].querySelectorAll('stop')];
  if (!stops.length) fail('gradient stops');
  const list = stops.map(s => { const style = attr(s, 'style') || ''; const c = attr(s, 'stop-color') || (style.match(/stop-color:\s*([^;]+)/) || [])[1] || '#000'; const o = attr(s, 'stop-opacity') || (style.match(/stop-opacity:\s*([^;]+)/) || [])[1]; if (o != null && +o < 1) fail('stop opacity');
    let off = attr(s, 'offset') || '0'; off = off.endsWith('%') ? parseFloat(off) / 100 : parseFloat(off); return [Math.max(0, Math.min(1, off || 0)), cmykOf(c)]; });
  for (let i = 1; i < list.length; i++) if (list[i][0] < list[i - 1][0]) list[i][0] = list[i - 1][0];
  const pv = (k, d) => { const v = attr(el, k); if (v == null) return d; return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v); };
  const coords = [pv('x1', 0), pv('y1', 0), pv('x2', 1), pv('y2', 0)];
  const fn2 = (a, b) => `<< /FunctionType 2 /Domain [0 1] /C0 [${a.map(num).join(' ')}] /C1 [${b.map(num).join(' ')}] /N 1 >>`;
  let fn; if (list.length === 1) fn = fn2(list[0][1], list[0][1]);
  else if (list.length === 2 && list[0][0] === 0 && list[1][0] === 1) fn = fn2(list[0][1], list[1][1]);
  else { const pts = [[0, list[0][1]], ...list, [1, list[list.length - 1][1]]]; const fs = [], bounds = [], enc = [];
    for (let i = 0; i + 1 < pts.length; i++) { fs.push(fn2(pts[i][1], pts[i + 1][1])); enc.push('0 1'); if (i + 2 < pts.length) bounds.push(num(pts[i + 1][0])); }
    fn = `<< /FunctionType 3 /Domain [0 1] /Functions [${fs.join(' ')}] /Bounds [${bounds.join(' ')}] /Encode [${enc.join(' ')}] >>`; }
  const sh = name(R, 'Sh'); R.shadings.push({ name: sh, dict: `<< /ShadingType 2 /ColorSpace /DeviceCMYK /Coords [${coords.map(num).join(' ')}] /Function ${fn} /Extend [true true] >>` });
  return { sh, units };
}
function paint(segs, R, ids, st) {
  if (!segs.length) return '';
  const path = segOps(segs); let o = '';
  const fill = st.fill && st.fill !== 'none' ? st.fill : null, stroke = st.stroke && st.stroke !== 'none' && st.strokeWidth > 0 ? st.stroke : null;
  const eo = st.fillRule === 'evenodd' ? '*' : '';
  if (fill) {
    if (/^url\(/.test(fill)) {
      const id = (fill.match(/#([^)'"]+)/) || [])[1]; if (!ids[id]) fail('gradient ' + id);
      const { sh, units } = shadingFor(ids[id], ids, R), bb = bboxOf(segs); if (!bb) return '';
      const map = units === 'userSpaceOnUse' ? '' : `${num(bb[2] - bb[0] || 1e-3)} 0 0 ${num(bb[3] - bb[1] || 1e-3)} ${num(bb[0])} ${num(bb[1])} cm\n`;
      o += `q\n${path}W${eo} n\n${map}/${sh} sh\nQ\n`;
    } else o += `${cmykOps(cmykOf(fill), 'k')}\n${path}f${eo}\n`;
  }
  if (stroke) {
    if (/^url\(/.test(stroke)) fail('gradient stroke');
    o += `${cmykOps(cmykOf(stroke), 'K')} ${num(st.strokeWidth)} w ${st.cap} J ${st.join} j\n${path}S\n`;
  }
  return o ? `q\n${o}Q\n` : '';
}
async function nestedSvg(el, R, ids, st) {
  const vb = (attr(el, 'viewBox') || '').trim().split(/[\s,]+/).map(Number); const x = +attr(el, 'x') || 0, y = +attr(el, 'y') || 0;
  let m = [1, 0, 0, 1, x, y];
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { const w = parseFloat(attr(el, 'width')) || vb[2], h = parseFloat(attr(el, 'height')) || vb[3]; m = mul(m, fitBox(vb, w, h, attr(el, 'preserveAspectRatio'))); }
  return `q\n${cm(m)}${await walkChildren(el, R, ids, st)}Q\n`;
}
function fitBox(vb, w, h, par) {
  par = (par || 'xMidYMid meet').trim(); if (par.startsWith('none')) return [w / vb[2], 0, 0, h / vb[3], -vb[0] * w / vb[2], -vb[1] * h / vb[3]];
  const slice = /slice/.test(par), sx = w / vb[2], sy = h / vb[3], s = slice ? Math.max(sx, sy) : Math.min(sx, sy);
  const al = par.match(/x(Min|Mid|Max)Y(Min|Mid|Max)/) || [0, 'Mid', 'Mid'], fx = { Min: 0, Mid: .5, Max: 1 }[al[1]], fy = { Min: 0, Mid: .5, Max: 1 }[al[2]];
  return [s, 0, 0, s, (w - vb[2] * s) * fx - vb[0] * s, (h - vb[3] * s) * fy - vb[1] * s];
}
async function image(el, R, ids, st) {
  const href = attr(el, 'href') || attr(el, 'xlink:href') || ''; if (!href) return '';
  const x = +attr(el, 'x') || 0, y = +attr(el, 'y') || 0, w = +attr(el, 'width') || 0, h = +attr(el, 'height') || 0; if (w <= 0 || h <= 0) return '';
  const par = attr(el, 'preserveAspectRatio') || 'xMidYMid meet', clip = `${num(x)} ${num(y)} ${num(w)} ${num(h)} re W n\n`;
  if (/^data:image\/svg\+xml/i.test(href)) { // customer's SVG logo: vector when possible
    try {
      const txt = /;base64,/i.test(href) ? new TextDecoder().decode(Uint8Array.from(atob(href.slice(href.indexOf(',') + 1)), c => c.charCodeAt(0))) : decodeURIComponent(href.slice(href.indexOf(',') + 1));
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml'); const s = doc.documentElement; if (doc.querySelector('parsererror') || s.localName !== 'svg') fail('svg image');
      const sub = {}; for (const e of s.querySelectorAll('[id]')) sub[e.id] = e;
      let vb = (attr(s, 'viewBox') || '').trim().split(/[\s,]+/).map(Number); if (vb.length !== 4 || !(vb[2] > 0)) { const sw = parseFloat(attr(s, 'width')), sh = parseFloat(attr(s, 'height')); if (!(sw > 0 && sh > 0)) fail('svg size'); vb = [0, 0, sw, sh]; }
      for (const e of s.querySelectorAll('style')) if (/[{}]/.test(e.textContent)) fail('svg css'); // class-based styling is not reproduced
      const m = mul([1, 0, 0, 1, x, y], fitBox(vb, w, h, par));
      const body = await walkChildren(s, R, sub, { fill: '#000000', stroke: 'none', strokeWidth: 1, fillRule: 'nonzero', cap: 0, join: 0, font: {} });
      return `q\n${clip}${cm(m)}${body}Q\n`;
    } catch (e) { if (!(e instanceof VectorError)) throw e; /* fall through: raster at high resolution */ }
  }
  const img = await rasterImage(href, R.maxImage, /^data:image\/svg/i.test(href) ? Math.min(R.maxImage, 4000) : 0);
  const nm = name(R, 'Im'); R.images.push({ name: nm, img });
  const vb = [0, 0, img.w, img.h], m = mul([1, 0, 0, 1, x, y], fitBox(vb, w, h, par));
  // image space: unit square, y up → our y-down user space
  return `q\n${clip}${cm(m)}${num(img.w)} 0 0 ${num(-img.h)} 0 ${num(img.h)} cm\n/${nm} Do\nQ\n`;
}

/* ---------- text → outlines ---------- */
async function text(el, R, ids, st) {
  const parts = []; // {text, x, y, path?:{segs,len,offset}}
  const f = st.font, size = parseFloat(f.size) || 16, anchor = f.anchor || 'start', ls = parseFloat(f.spacing) || 0;
  const weight = /bold|[6-9]00/.test(String(f.weight || '')) ? 700 : 400, italic = /italic|oblique/.test(String(f.style || ''));
  let x = parseFloat(attr(el, 'x')) || 0, y = parseFloat(attr(el, 'y')) || 0;
  const tp = el.querySelector('textPath');
  if (tp) { const ref = (attr(tp, 'href') || attr(tp, 'xlink:href') || '').replace(/^#/, ''); if (!ids[ref]) fail('textPath'); const so = attr(tp, 'startOffset') || '0';
    parts.push({ text: tp.textContent, path: parsePath(attr(ids[ref], 'd')), startOffset: so }); }
  else if (el.querySelector('tspan')) { for (const t of el.querySelectorAll('tspan')) { if (attr(t, 'x') != null) x = parseFloat(attr(t, 'x')); if (attr(t, 'y') != null) y = parseFloat(attr(t, 'y')); y += parseFloat(attr(t, 'dy')) || 0; x += parseFloat(attr(t, 'dx')) || 0; parts.push({ text: t.textContent, x, y }); } }
  else parts.push({ text: el.textContent, x, y });
  if (parts.some(p => COMPLEX.test(p.text))) fail('complex script');
  const font = await loadFont(f.family, weight, italic), k = size / font.upm, slant = font.slant ? Math.tan(12 * Math.PI / 180) : 0;
  const glyphs = t => [...t.replace(/[\t\r\n]/g, ' ')].map(ch => { const cp = ch.codePointAt(0); const g = font.cmap(cp); if (!g && !/\s/.test(ch) && cp > 32) fail('glyph ' + ch); return g; });
  const widthOf = gs => gs.reduce((a, g) => a + font.advance(g) * k + ls, 0);
  const all = [];
  for (const p of parts) {
    const gs = glyphs(p.text), W = widthOf(gs);
    if (p.path) { // text on a path: each glyph's centre sits on the path, rotated to its direction
      const pl = flatten(p.path), L = pl.len; let s = p.startOffset.endsWith('%') ? parseFloat(p.startOffset) / 100 * L : parseFloat(p.startOffset) || 0;
      s -= anchor === 'middle' ? W / 2 : anchor === 'end' ? W : 0;
      for (const g of gs) { const adv = font.advance(g) * k, mid = s + adv / 2; s += adv + ls; if (!g) continue; const at = pl.at(mid); if (!at) continue;
        const c = Math.cos(at.a), sn = Math.sin(at.a); const m = mul([c, sn, -sn, c, at.x, at.y], [k, 0, -k * slant, -k, -adv / 2, 0]);
        all.push(...tseg(font.glyph(g), m)); }
    } else {
      let cx = p.x - (anchor === 'middle' ? W / 2 : anchor === 'end' ? W : 0);
      for (const g of gs) { if (g) all.push(...tseg(font.glyph(g), [k, 0, -k * slant, -k, cx, p.y])); cx += font.advance(g) * k + ls; }
    }
  }
  return paint(all, R, ids, { ...st, fillRule: 'nonzero' });
}
// polyline approximation of a path with arc-length lookup
function flatten(segs) {
  const pts = []; let cur = [0, 0];
  for (const s of segs) {
    if (s[0] === 'M') { cur = [s[1], s[2]]; pts.push(cur); }
    else if (s[0] === 'L') { cur = [s[1], s[2]]; pts.push(cur); }
    else if (s[0] === 'C') { const [x0, y0] = cur; for (let i = 1; i <= 24; i++) { const t = i / 24, u = 1 - t; pts.push([u * u * u * x0 + 3 * u * u * t * s[1] + 3 * u * t * t * s[3] + t * t * t * s[5], u * u * u * y0 + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6]]); } cur = [s[5], s[6]]; }
  }
  const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = acc[acc.length - 1] || 0;
  return { len, at(d) { if (d < 0 || d > len || pts.length < 2) return null; let i = 1; while (i < acc.length - 1 && acc[i] < d) i++; const a = pts[i - 1], b = pts[i], t = (d - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1);
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]) }; } };
}
