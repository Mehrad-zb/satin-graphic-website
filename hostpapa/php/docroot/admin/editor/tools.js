/* Satin editor — image crop tool and popup preview. */
import { S, F, $, esc, ic, hooks, RT, commit, num } from './core.js?v=8';
import { modal } from './ui.js?v=8';

/* ---------- crop ---------- */
export function cropImage(e) {
  const src = e.p?.src; if (!src) return;
  const c0 = e.p.crop || { x: 0, y: 0, w: 100, h: 100 };
  let c = { ...c0 };
  const elRatio = (num(e.w) || 30) / 100 * RT.FREE_W / (num(e.h) || 300);
  const ratios = [['free', 'Free'], ['el', 'Element shape'], ['1', '1:1'], ['1.3333', '4:3'], ['1.7778', '16:9'], ['0.75', '3:4'], ['0.5625', '9:16']];
  let ratio = 'free';
  const m = modal('Crop image', `<div class="cropper" data-cr><img src="${esc(src)}" alt=""><div class="cbox" data-box><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div>
    <div class="crop-ratios">${ratios.map(([k, l]) => `<button type="button" class="btn ghost sm${k === ratio ? ' on' : ''}" data-r="${k}">${l}</button>`).join('')}</div>`,
    { wide: true, footer: `<button class="btn ghost" data-reset>Reset</button><button class="btn ghost" data-close>Cancel</button><button class="btn" data-ok>Apply crop</button>` });
  const root = m.el, img = root.querySelector('.cropper img'), box = root.querySelector('[data-box]');
  let nat = 1;
  const draw = () => { box.style.left = c.x + '%'; box.style.top = c.y + '%'; box.style.width = c.w + '%'; box.style.height = c.h + '%'; };
  const clamp = () => { c.w = Math.max(3, Math.min(100, c.w)); c.h = Math.max(3, Math.min(100, c.h)); c.x = Math.max(0, Math.min(100 - c.w, c.x)); c.y = Math.max(0, Math.min(100 - c.h, c.y)); };
  const want = () => ratio === 'free' ? 0 : ratio === 'el' ? elRatio : Number(ratio);
  // apply a ratio (in pixels) by shrinking the box around its centre
  const fit = () => {
    const r = want(); if (!r) return;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    let w = c.w, h = w * nat / r;              // h in % of height: (w% * W) / r / H * 100 = w * (W/H) / r
    if (h > 100) { h = 100; w = h * r / nat; }
    if (h > c.h && w * nat / r <= 100) { h = c.h; w = h * r / nat; }
    c = { x: cx - w / 2, y: cy - h / 2, w, h }; clamp(); draw();
  };
  img.onload = () => { nat = img.naturalWidth / img.naturalHeight || 1; draw(); };
  if (img.complete) img.onload();
  root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { ratio = b.dataset.r; root.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); fit(); });
  root.querySelector('[data-reset]').onclick = () => { c = { x: 0, y: 0, w: 100, h: 100 }; ratio = 'free'; draw(); };
  box.onpointerdown = ev => {
    ev.preventDefault(); box.setPointerCapture(ev.pointerId);
    const h = ev.target.dataset.h, r = img.getBoundingClientRect(), s = { ...c }, sx = ev.clientX, sy = ev.clientY, rt = want();
    box.onpointermove = mv => {
      const dx = (mv.clientX - sx) / r.width * 100, dy = (mv.clientY - sy) / r.height * 100;
      if (!h) { c.x = s.x + dx; c.y = s.y + dy; c.w = s.w; c.h = s.h; clamp(); draw(); return; }
      let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
      if (h.includes('w')) x1 = Math.min(x2 - 3, Math.max(0, s.x + dx)); else x2 = Math.max(x1 + 3, Math.min(100, x2 + dx));
      if (h.includes('n')) y1 = Math.min(y2 - 3, Math.max(0, s.y + dy)); else y2 = Math.max(y1 + 3, Math.min(100, y2 + dy));
      if (rt) { const w = x2 - x1, hh = w * nat / rt; if (h.includes('n')) y1 = y2 - hh; else y2 = y1 + hh; if (y1 < 0 || y2 > 100) return; }
      c = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; draw();
    };
    box.onpointerup = () => { box.onpointermove = null; };
  };
  root.querySelector('[data-ok]').onclick = () => {
    const r2 = v => Math.round(v * 100) / 100;
    const full = c.x < 0.1 && c.y < 0.1 && c.w > 99.9 && c.h > 99.9;
    const p = { ...e.p }; if (full) delete p.crop; else p.crop = { x: r2(c.x), y: r2(c.y), w: r2(c.w), h: r2(c.h) };
    e.p = p;
    // keep the element's width, match its height to the cropped shape
    const wpx = (num(e.w) || 30) / 100 * RT.FREE_W, ar = (c.w * nat) / c.h;
    if (ar > 0 && num(e.h)) e.h = Math.round(wpx / ar);
    m.close(); commit({ keepInspector: true });
  };
}
hooks.cropImage = cropImage;

/* ---------- popup preview ---------- */
hooks.previewPopup = e => { if (F.doc) RT.openPopup(F.doc, e.id, true); };
