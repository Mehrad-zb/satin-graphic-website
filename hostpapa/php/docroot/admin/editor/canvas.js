/* Satin editor — the page canvas: selection, direct manipulation, toolbars, shortcuts. */
import { S, F, $, $$, esc, ic, clone, uid, num, round, toast, hooks, RT, C, editFor, sectionFor, blockById, elById, secData, isBlock, commit, undo, redo, save, flush, snapshot, setStatus, updateUndo, api, normalize, clipGet, clipSet, prefs, flushLive } from './core.js?v=8';
import { KIND_NAME, EL_NAME, ELEMENTS, preset } from './catalog.js?v=8';
import { confirmBox, promptBox, pickMedia, modal } from './ui.js?v=8';

const FREE_W = RT.FREE_W;
const MOB = RT.MOBILE_MAX;
export const isMobile = () => S.device === 'mobile';
export const isTablet = () => S.device === 'tablet';

/* ---------- frame styles (editor only) ---------- */
const FRAME_CSS = `#cms-ov{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font:12px/1.3 Inter,system-ui,sans-serif}
#cms-ov *{box-sizing:border-box}
#cms-ov .xb{position:fixed;border:1.5px solid #2f6bff;border-radius:2px;background:transparent;margin:0;padding:0}
#cms-ov .xb.xh{border-style:dashed;border-color:#2f6bffaa;background:#2f6bff08}
#cms-ov .xb.xs{box-shadow:0 0 0 1px #fff inset}
#cms-ov .xb.xm{border-color:#2f6bff;border-style:solid;background:#2f6bff0d}
#cms-ov .xb.xsec{border-color:#c91c50}
#cms-ov .xb.xlock{border-color:#f59e0b}
#cms-ov .xb.xgrp{border-style:dotted;border-color:#7c3aed}
#cms-ov .xtag{position:absolute;left:-1.5px;top:-22px;background:#2f6bff;color:#fff;padding:3px 7px;border-radius:4px 4px 0 0;font-weight:600;white-space:nowrap;display:flex;gap:6px;align-items:center}
#cms-ov .xtag i{font-style:normal;opacity:.8;font-weight:500}
#cms-ov .xsec>.xtag{background:#c91c50}#cms-ov .xlock>.xtag{background:#f59e0b}
#cms-ov .xtb{position:absolute;left:50%;transform:translateX(-50%);top:-52px;display:flex;gap:2px;align-items:center;background:#fff;border-radius:999px;padding:4px;pointer-events:auto;box-shadow:0 6px 24px #0003,0 0 0 1px #0000000f;white-space:nowrap}
#cms-ov .xsec>.xtb{left:auto;right:8px;transform:none;top:8px;border-radius:10px}
#cms-ov .xtb button{all:unset;cursor:pointer;color:#16181d;min-width:30px;height:30px;display:grid;place-items:center;border-radius:999px;padding:0 4px}
#cms-ov .xtb button.lb{padding:0 12px;font-weight:600;font-size:13px;background:#f1f3f7}
#cms-ov .xtb button:hover{background:#eef2ff;color:#2f6bff}
#cms-ov .xtb button.on{background:#2f6bff;color:#fff}
#cms-ov .xtb svg{width:17px;height:17px}
#cms-ov .xtb i.sep{width:1px;height:20px;background:#e5e7eb;margin:0 3px}
#cms-ov .xb.xlow>.xtag{top:auto;bottom:-22px;border-radius:0 0 4px 4px}#cms-ov .xb.xlow>.xtb{top:auto;bottom:-52px}
#cms-ov .xhd{position:absolute;width:10px;height:10px;background:#fff;border:1.5px solid #2f6bff;border-radius:2px;pointer-events:auto;margin:-5px 0 0 -5px}
#cms-ov .xhd[data-h=n],#cms-ov .xhd[data-h=s]{cursor:ns-resize}#cms-ov .xhd[data-h=e],#cms-ov .xhd[data-h=w]{cursor:ew-resize}#cms-ov .xhd[data-h=ne],#cms-ov .xhd[data-h=sw]{cursor:nesw-resize}#cms-ov .xhd[data-h=nw],#cms-ov .xhd[data-h=se]{cursor:nwse-resize}
#cms-ov .xhd[data-h=rot]{border-radius:50%;cursor:grab;background:#2f6bff;width:12px;height:12px;margin:-6px 0 0 -6px}
#cms-ov .xrotl{position:absolute;left:50%;top:-26px;height:20px;border-left:1.5px solid #2f6bff}
#cms-ov .xdim{position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);background:#16181d;color:#fff;border-radius:4px;padding:2px 6px;font-size:11px;white-space:nowrap}
#cms-ov .xdrop{position:fixed;height:4px;background:#2f6bff;border-radius:2px;box-shadow:0 0 0 3px #2f6bff33}
#cms-ov .xdrop span{position:absolute;left:50%;top:-12px;transform:translateX(-50%);background:#2f6bff;color:#fff;border-radius:999px;padding:3px 10px;font-weight:600;white-space:nowrap}
#cms-ov .xdropbox{position:fixed;border:2px dashed #2f6bff;background:#2f6bff14;border-radius:6px}
#cms-ov .xg{position:fixed;background:#ff2d75;pointer-events:none}#cms-ov .xg.v{width:1px}#cms-ov .xg.h{height:1px}
#cms-ov .xgd{position:fixed;background:#00b3ff;pointer-events:auto}#cms-ov .xgd.v{width:1px;cursor:ew-resize}#cms-ov .xgd.h{height:1px;cursor:ns-resize}
#cms-ov .xgd::after{content:"";position:absolute;inset:-3px}
#cms-ov .xgrid{position:fixed;pointer-events:none;background-image:linear-gradient(#2f6bff14 1px,transparent 1px),linear-gradient(90deg,#2f6bff14 1px,transparent 1px);background-size:20px 20px}
#cms-ov .xlayer{position:fixed;border-left:1px dashed #2f6bff55;border-right:1px dashed #2f6bff55;pointer-events:none}
#cms-ov .xrul{position:fixed;background:#f8f9fbf2;pointer-events:auto;z-index:2;overflow:hidden;color:#6b7280;font-size:9px}
#cms-ov .xrul.t{top:0;left:18px;right:0;height:18px;border-bottom:1px solid #d6dae2;cursor:s-resize;background-image:repeating-linear-gradient(90deg,#9ca3af 0 1px,transparent 1px 10px);background-size:100% 4px;background-repeat:repeat-x;background-position:0 bottom}
#cms-ov .xrul.l{top:18px;left:0;bottom:0;width:18px;border-right:1px solid #d6dae2;cursor:e-resize;background-image:repeating-linear-gradient(180deg,#9ca3af 0 1px,transparent 1px 10px);background-size:4px 100%;background-repeat:repeat-y;background-position:right 0}
#cms-ov .xrul span{position:absolute;white-space:nowrap}#cms-ov .xrul.t span{top:1px;transform:translateX(2px)}#cms-ov .xrul.l span{left:1px;transform:rotate(-90deg) translateX(-100%);transform-origin:0 0}
#cms-ov .xrul.c{top:0;left:0;width:18px;height:18px;border-right:1px solid #d6dae2;border-bottom:1px solid #d6dae2;cursor:default}
#cms-ov .xrul .mk{position:absolute;background:#2f6bff33}
#cms-ov .xfmt{position:fixed;display:flex;gap:2px;background:#16181d;border-radius:10px;padding:4px;pointer-events:auto;box-shadow:0 8px 24px #0004}
#cms-ov .xfmt button{all:unset;cursor:pointer;color:#fff;min-width:28px;height:28px;display:grid;place-items:center;border-radius:6px;font:600 13px/1 Inter,system-ui,sans-serif}
#cms-ov .xfmt button:hover{background:#ffffff26}#cms-ov .xfmt i.sep{width:1px;background:#ffffff33;margin:4px 2px}
#cms-ov .xmarq{position:fixed;border:1px solid #2f6bff;background:#2f6bff14}
#cms-ov .xiso{position:fixed;border:1.5px dashed #7c3aed;box-shadow:0 0 0 200000px rgba(15,23,42,.38);pointer-events:none;border-radius:2px}
#cms-ov .xgap{position:fixed;background:#ff2d75;pointer-events:none}#cms-ov .xgap.h{height:1px}#cms-ov .xgap.v{width:1px}
#cms-ov .xgap.h::before,#cms-ov .xgap.h::after{content:"";position:absolute;top:-4px;height:9px;width:1px;background:#ff2d75}#cms-ov .xgap.h::before{left:0}#cms-ov .xgap.h::after{right:0}
#cms-ov .xgap.v::before,#cms-ov .xgap.v::after{content:"";position:absolute;left:-4px;width:9px;height:1px;background:#ff2d75}#cms-ov .xgap.v::before{top:0}#cms-ov .xgap.v::after{bottom:0}
#cms-ov .xgap b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#ff2d75;color:#fff;font:600 10px/1 Inter,system-ui,sans-serif;padding:2px 4px;border-radius:3px;white-space:nowrap}
#cms-ov .xb.xpart>.xtag{background:#f59e0b}
#cms-ov .xb.xhasrot:not(.xlow)>.xtb{top:-66px}
#cms-ov .xb.xmulti{border-style:solid}
#cms-ov .ximgbox{position:fixed;border:2px solid #f59e0b;pointer-events:none;border-radius:2px}
#cms-ov .ximgw{position:fixed;pointer-events:auto;cursor:move;outline:1.5px dashed #2f6bff;outline-offset:0}
#cms-ov .ximgw>img{width:100%;height:100%;display:block;opacity:.35;pointer-events:none;user-select:none}
#cms-ov .ximgw .xhd{cursor:nwse-resize}#cms-ov .ximgw .xhd[data-ih=ne],#cms-ov .ximgw .xhd[data-ih=sw]{cursor:nesw-resize}#cms-ov .ximgw .xhd[data-ih=rot]{cursor:grab}
#cms-ov .ximgtb{position:fixed;transform:translateX(-50%);display:flex;gap:2px;align-items:center;background:#16181d;border-radius:999px;padding:4px;pointer-events:auto;box-shadow:0 8px 24px #0004;white-space:nowrap}
#cms-ov .ximgtb button{all:unset;cursor:pointer;color:#fff;height:28px;padding:0 10px;display:grid;place-items:center;border-radius:999px;font:600 12px/1 Inter,system-ui,sans-serif}
#cms-ov .ximgtb button:hover{background:#ffffff26}#cms-ov .ximgtb button.on{background:#fff;color:#16181d}#cms-ov .ximgtb button.done{background:#2f6bff}
[contenteditable=true]{outline:2px solid #2f6bff!important;outline-offset:3px;cursor:text!important;caret-color:#2f6bff;user-select:text!important;-webkit-user-select:text!important}
.cms-editing *{cursor:default}
.cms-editing a,.cms-editing button{cursor:pointer}
html.cms-editing{scroll-behavior:auto!important}
.cms-editing .reveal,.cms-editing [data-reveal]{opacity:1!important;transform:none!important}
html.cms-editing [data-ain]>.cms-a,html.cms-editing [data-cms-ain]{opacity:1!important;animation:none!important}
html.cms-editing.cms-playing [data-ain].cms-av>.cms-a,html.cms-editing.cms-playing [data-cms-ain].cms-av{animation:var(--an) var(--ad,800ms) var(--ae,ease) var(--adl,0ms) 1 var(--adir,normal) backwards!important}
html.cms-editing .cms-el.hide-d,html.cms-editing .cms-el.hide-m{display:block!important;opacity:.32;outline:1px dashed #999}
html.cms-editing .cms-el{user-select:none}
html.cms-editing .cms-el.cms-ghost{opacity:.55}
html.cms-editing #cms-pins .cms-el{outline:1px dashed #7c3aed88}
html.cms-editing .cms-in .cms-ba input{pointer-events:none}
html.cms-editing .cms-frame{pointer-events:none}
html.cms-editing .cms-marq-in{animation-play-state:paused}
#cms-ov .xfmt{max-width:calc(100vw - 8px);overflow-x:auto;scrollbar-width:none}
html.cms-phone #cms-ov .xtb{display:none}
html.cms-phone #cms-ov .xrul,html.cms-phone #cms-ov .xgd{display:none}
html.cms-phone #cms-ov .xb.xs,html.cms-phone #cms-ov .xb.xm{border-width:2.5px;box-shadow:0 0 0 2px #fff,0 0 0 9999px #0f172a14}
html.cms-phone #cms-ov .xb.xh{display:none}
html.cms-phone #cms-ov .xtag{font-size:12px;padding:4px 8px}
html.cms-phone #cms-ov .xhd{width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;border-width:2px;touch-action:none}
html.cms-phone #cms-ov .xhd[data-h=n],html.cms-phone #cms-ov .xhd[data-h=s],html.cms-phone #cms-ov .xhd[data-h=e],html.cms-phone #cms-ov .xhd[data-h=w]{display:none}
html.cms-phone #cms-ov .xhd[data-h=rot]{width:24px;height:24px;margin:-12px 0 0 -12px}
html.cms-phone #cms-ov .xfmt{padding:5px;gap:4px;border-radius:12px}
html.cms-phone #cms-ov .xfmt button{min-width:40px;height:40px;font-size:15px}
html.cms-phone .cms-el.cms-touchsel{touch-action:none}`;

/* ---------- frame setup ---------- */
let ov = null, dropAt = null, dropBox = null, guidesNow = [], marq = null;
export let dragKind = null;
export function setDragKind(k) { dragKind = k; }
export function setupFrame() {
  const d = F.doc;
  const st = d.createElement('style'); st.id = 'cms-ed-css'; st.textContent = FRAME_CSS; d.head.append(st);
  d.documentElement.classList.add('cms-editing');
  d.documentElement.classList.toggle('cms-phone', !!S.phone);
  ov = d.createElement('div'); ov.id = 'cms-ov'; d.body.append(ov);
  const block = e => { if (S.preview) return false; if (e.target.closest?.('#cms-ov')) return false; if (e.target.isContentEditable) return false; return true; };
  d.addEventListener('click', e => {
    if (S.preview) { const a = e.target.closest('a[href]'); if (a) { const u = new URL(a.href, F.win.location.href); if (u.origin === location.origin && /^\/satin(\/|$)/.test(u.pathname)) { e.preventDefault(); e.stopPropagation(); hooks.loadPage(u.pathname.replace(/\/$/, '')); } else if (u.origin !== location.origin) { e.preventDefault(); open(u.href, '_blank', 'noopener'); } } return; }
    const pc = e.target.closest?.('.cms-pop'); if (pc) { e.preventDefault(); e.stopPropagation(); if (e.target.closest('[data-pop-close]')) { pc.classList.remove('on'); setTimeout(() => pc.remove(), 300); } return; }
    const tb = e.target.closest('#cms-ov [data-act]'); if (tb) { e.preventDefault(); e.stopPropagation(); act(tb.dataset.act, tb); return; }
    const fm = e.target.closest('#cms-ov [data-fmt]'); if (fm) { e.preventDefault(); e.stopPropagation(); return; }
    if (!block(e)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.detail > 1) return;
    if (suppressClick) { suppressClick = false; return; }
    if (downFe) { downFe = false; if (!F.main.contains(e.target)) return; }
    const t = resolve(e.target);
    if (t?.type === 'fe') { if (S.phone && !S.multi.includes(t.id)) select(t); return; } // handled on pointerdown (phones: on tap, so the page can still scroll)
    select(t);
  }, true);
  d.addEventListener('dblclick', e => { if (!block(e)) return; e.preventDefault(); e.stopPropagation(); onDblClick(e); }, true);
  d.addEventListener('wheel', e => { if (S.imgEdit && !S.preview) { e.preventDefault(); imgWheel(e); } }, { passive: false, capture: true });
  d.addEventListener('pointerdown', onPointerDown, true);
  for (const ev of ['mousedown', 'submit', 'auxclick', 'dragstart', 'selectstart']) d.addEventListener(ev, e => { if (block(e) && !(ev === 'mousedown' && e.detail > 1)) { if (ev !== 'mousedown') e.preventDefault(); e.stopPropagation(); } }, true);
  d.addEventListener('contextmenu', e => { if (S.preview || e.target.isContentEditable) return; e.preventDefault(); e.stopPropagation(); const t = resolve(e.target); if (t && !(t.type === 'fe' && S.multi.includes(t.id))) select(t); contextMenu(e.clientX, e.clientY); }, true);
  d.addEventListener('mousemove', e => { if (S.preview || drag || e.target.closest('#cms-ov') || e.target.closest('.cms-pop')) return; const t = resolve(e.target); const k = t && key(t); if (k !== (S.hover && key(S.hover))) { S.hover = t; drawOverlay(); } }, true);
  d.addEventListener('mouseleave', () => { S.hover = null; drawOverlay(); });
  d.addEventListener('keydown', e => { if (e.target.isContentEditable) return; onKey(e); }, true);
  d.addEventListener('paste', e => { if (e.target.isContentEditable || S.preview) return; const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); hooks.pasteFiles?.(fs); } });
  F.win.addEventListener('scroll', () => drawOverlay(), { passive: true });
  F.win.addEventListener('resize', () => drawOverlay());
  // drag & drop from the Add panel
  d.addEventListener('dragover', e => { if (!dragKind) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (dragKind.startsWith('el:')) { dropAt = null; const sec = sectionAt(e.clientY); dropBox = sec ? sec.getBoundingClientRect() : null; } else { dropBox = null; dropAt = dropPoint(e.clientY); } drawOverlay(); });
  d.addEventListener('dragleave', e => { if (e.relatedTarget === null && (e.clientY <= 0 || e.clientY >= F.win.innerHeight || e.clientX <= 0 || e.clientX >= F.win.innerWidth)) { dropAt = null; dropBox = null; drawOverlay(); } });
  d.addEventListener('drop', e => {
    if (!dragKind) return; e.preventDefault();
    const k = dragKind; dragKind = null; dropAt = null; dropBox = null;
    if (k.startsWith('el:')) addElement(k.slice(3), { clientX: e.clientX, clientY: e.clientY });
    else if (k.startsWith('tpl:')) hooks.insertTemplate?.(k.slice(4), dropPoint(e.clientY).index);
    else insertBlock(k, dropPoint(e.clientY).index);
    drawOverlay();
  });
  // redraw the overlay only when something it shows has changed (selection, hover, positions, scroll)
  let lastSig = '';
  (function loop() { if (F.doc !== d) return; if (S.sel || S.hover || drag || S.iso.length || S.imgEdit) { const sg = overlaySig(); if (sg !== lastSig) { lastSig = sg; drawOverlay(); } } F.win.requestAnimationFrame(loop); })();
  S.guides = prefs('guides:' + S.path) || { v: [], h: [] };
}

/* ---------- targets ---------- */
export const key = t => t ? t.type + ':' + (t.selector || t.id || '') + ':' + (t.field || '') : '';
const PICK = 'h1,h2,h3,h4,h5,h6,p,img,a,button,li,blockquote,figcaption,span.eyebrow,.counter-item b,.counter-item span,small,dt,dd,summary,label,span.tiny,td,th,video,picture,svg';
export function sectionsEls() { const pe = F.main?.querySelector('.page-enter'); return pe ? [...pe.children].filter(n => n.dataset.cmsSection) : []; }
export function feNode(id) { return F.doc?.querySelector(`[data-el="${id}"]`); }
export function resolve(t, deep) {
  if (!F.main || !t || !t.closest) return null;
  const fe = t.closest('.cms-el');
  // isolation mode: only the descendants of the active box / members of the active group can be picked
  const iso = isoTop();
  if (iso) {
    if (!fe) return null;
    if (iso.type === 'box') {
      const boxN = feNode(iso.id);
      if (!boxN || fe === boxN || !boxN.contains(fe)) return null;
      let node = fe;
      if (!deep) while (node.parentElement?.closest('.cms-el') && node.parentElement.closest('.cms-el') !== boxN) node = node.parentElement.closest('.cms-el');
      return { type: 'fe', id: node.dataset.el };
    }
    let node = fe; while (node && elById(node.dataset.el)?.group !== iso.id) node = node.parentElement?.closest('.cms-el');
    return node ? { type: 'fe', id: node.dataset.el } : null;
  }
  if (fe && (F.main.contains(fe) || fe.closest('#cms-pins'))) {
    let node = fe;
    // clicking inside a box selects the box first, unless it is already selected (then the child)
    const parentBox = node.parentElement?.closest('.cms-el');
    if (parentBox && !deep && !S.multi.includes(parentBox.dataset.el) && !S.multi.includes(node.dataset.el) && !S.multi.some(id => elById(id)?.parent === parentBox.dataset.el)) node = parentBox;
    return { type: 'fe', id: node.dataset.el };
  }
  if (!F.main.contains(t)) return null;
  const blockEl = t.closest('.cms-added-section');
  if (blockEl) {
    const id = blockEl.dataset.cmsSection;
    const f = t.closest('[data-cms-field]');
    if (f && blockEl.contains(f)) return { type: 'field', id, field: f.dataset.cmsField };
    return { type: 'block', id };
  }
  let el = t.closest(PICK);
  if (el && el.tagName === 'PICTURE') el = el.querySelector('img') || el;
  if (el && el.tagName === 'svg' && el.closest('a,button')) el = el.closest('a,button');
  if (el && !F.main.contains(el)) el = null;
  if (el && el.closest('.cms-added-section')) el = null;
  if (el && el.matches('a') && el.querySelector('img') && !el.textContent.trim()) el = el.querySelector('img');
  if (el) return { type: 'el', selector: selectorFor(el) };
  const sec = sectionsEls().find(s => s.contains(t));
  return sec ? { type: sec.classList.contains('cms-added-section') ? 'block' : 'section', id: sec.dataset.cmsSection } : null;
}
export function selectorFor(el) {
  const id = el.dataset.cmsId;
  if (id && S.stable.has(id)) return `[data-cms-id="${id}"]`;
  const parts = []; let n = el;
  while (n && n !== F.main) {
    if (n !== el && n.dataset?.cmsId && S.stable.has(n.dataset.cmsId)) { parts.unshift(`[data-cms-id="${n.dataset.cmsId}"]`); break; }
    if (n.parentElement?.classList.contains('page-enter') && n.dataset.cmsSection) { parts.unshift(`[data-cms-section="${n.dataset.cmsSection}"]`); break; }
    const p = n.parentElement; if (!p) break;
    const same = [...p.children].filter(c => c.tagName === n.tagName && !c.classList.contains('cms-free') && !c.classList.contains('cms-bgl'));
    parts.unshift(n.tagName.toLowerCase() + (same.length > 1 ? `:nth-of-type(${same.indexOf(n) + 1})` : ''));
    n = p;
  }
  return parts.join(' > ');
}
export function elFor(t) {
  if (!t || !F.main) return null;
  try {
    if (t.type === 'fe') return feNode(t.id);
    if (t.type === 'el') return F.main.querySelector(t.selector);
    const sec = F.main.querySelector(`[data-cms-section="${t.id}"]`);
    if (t.type === 'field') return sec?.querySelector(`[data-cms-field="${t.field}"]`) || sec;
    return sec;
  } catch { return null; }
}
export function elKind(el) {
  if (!el) return 'Element';
  const t = el.tagName;
  if (t === 'IMG') return 'Image';
  if (t === 'VIDEO') return 'Video';
  if (/^H[1-6]$/.test(t)) return 'Heading ' + t[1];
  if (t === 'A' || t === 'BUTTON') return el.classList.contains('btn') || t === 'BUTTON' ? 'Button' : 'Link';
  if (t === 'P') return 'Paragraph';
  if (t === 'LI') return 'List item';
  if (t === 'DIV' || t === 'SECTION' || t === 'ARTICLE' || t === 'UL' || t === 'NAV' || t === 'HEADER' || t === 'FOOTER' || t === 'FIGURE') return 'Container';
  if (el.classList.contains('eyebrow')) return 'Small title';
  return 'Text';
}
export function sectionName(el) {
  if (!el) return '';
  const h = el.querySelector('h1,h2,h3,.eyebrow');
  const t = (h?.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, 48) : (el.className && typeof el.className === 'string' ? el.className.split(' ').filter(c => !c.startsWith('cms-'))[0] || 'Section' : 'Section');
}
export function feName(e) { if (!e) return 'Element'; if (e.name) return e.name; if (e.kind === 'text') { const t = (e.p?.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t.slice(0, 30) : 'Text'; } if (e.kind === 'button') return 'Button' + (e.p?.label ? ': ' + e.p.label : ''); if (e.kind === 'shape') return (e.p?.shape || 'Shape').replace(/^\w/, c => c.toUpperCase()); return EL_NAME[e.kind] || 'Element'; }
export function labelFor(t, el) {
  if (!t) return '';
  if (t.type === 'fe') { const e = elById(t.id); return feName(e); }
  if (t.type === 'block') return KIND_NAME[blockById(t.id)?.kind] || 'Section';
  if (t.type === 'section') return sectionName(el) || 'Section';
  if (t.type === 'field') return { title: 'Heading', body: 'Text', eyebrow: 'Small title', button: 'Button', button2: 'Button', image: 'Image', caption: 'Caption', name: 'Name', role: 'Role' }[t.field.replace(/^items\.\d+\./, '')] || 'Element';
  return elKind(el);
}
export function secIdOf(t) {
  if (!t) return null;
  if (t.type === 'section' || t.type === 'block') return t.id;
  if (t.type === 'field') return t.id;
  if (t.type === 'fe') return elById(t.id)?.sec;
  const el = elFor(t); const sec = el && sectionsEls().find(s => s.contains(el)); return sec?.dataset.cmsSection || null;
}
export function sectionAt(clientY) { return sectionsEls().find(s => { const r = s.getBoundingClientRect(); return r.height && clientY >= r.top && clientY <= r.bottom; }) || null; }
// the box the free elements of a section are positioned in (desktop: centred 1200px column; mobile: the section width)
export function layerRect(secNode) {
  const r = secNode.getBoundingClientRect();
  const l = secNode.querySelector(':scope>.cms-free');
  if (l && !(isMobile() && l.classList.contains('stack'))) { const lr = l.getBoundingClientRect(); const z = l.offsetWidth ? lr.width / l.offsetWidth : 1; return { left: lr.left, top: lr.top, width: l.offsetWidth, height: lr.height / (z || 1), vw: lr.width, vh: r.height, z: z || 1, node: l }; }
  if (isMobile()) return { left: r.left, top: r.top, width: r.width, height: r.height, vw: r.width, vh: r.height, z: 1, node: l || null };
  const z = Math.min(1, secNode.clientWidth / FREE_W);
  return { left: r.left + (r.width - FREE_W * z) / 2, top: r.top, width: FREE_W, height: r.height / z, vw: FREE_W * z, vh: r.height, z, node: null };
}
function containerOf(e) {
  if (e.parent) { const p = feNode(e.parent); const inn = p?.querySelector(':scope>.cms-a>.cms-in'); if (inn) { const r = inn.getBoundingClientRect(); const z = inn.offsetWidth ? r.width / inn.offsetWidth : 1; return { left: r.left + inn.clientLeft * z, top: r.top + inn.clientTop * z, width: inn.clientWidth, height: inn.clientHeight, vw: inn.clientWidth * z, z: z || 1, node: inn }; } }
  if (e.pin) return { left: 0, top: 0, width: F.win.innerWidth, height: F.win.innerHeight, vw: F.win.innerWidth, z: 1, node: null, fixed: true };
  const sec = F.main.querySelector(`[data-cms-section="${e.sec}"]`);
  return sec ? layerRect(sec) : null;
}
const mobAbs = e => isMobile() && !e.pin && !e.parent && !!F.main.querySelector(`[data-free="${e.sec}"].mabs`);
// geometry in container pixels for the current device
export function geom(e) {
  const c = containerOf(e); if (!c) return null;
  const n = feNode(e.id);
  if (n) return { x: n.offsetLeft, y: n.offsetTop, w: n.offsetWidth, h: n.offsetHeight, c, n, r: num((isMobile() && e.m?.r !== undefined) ? e.m.r : e.r) || 0 };
  return null;
}

/* ---------- transform model shared by free elements and original page elements ---------- */
// the rotation the page really shows for a free element on the current device (mirrors the runtime rules)
export function feRot(e) {
  if (!e) return 0;
  if (!isMobile() || e.pin) return num(e.r) || 0;
  const mabs = !!F.main?.querySelector(`[data-free="${e.sec}"]`)?.classList.contains('mabs');
  if (!e.parent) return mabs ? (e.m ? num(e.m.r) || 0 : num(e.r) || 0) : 0;
  if (e.m && (mabs || num(e.m.y) !== null)) return num(e.m.r) || 0;
  return num(e.r) || 0;
}
// original page elements: edits[].tf (desktop) with tablet (tft) / phone (tfm) overrides
export const tfKey = () => isMobile() ? 'tfm' : isTablet() ? 'tft' : 'tf';
export function elTf(sel) { const e = editFor(sel) || {}; const k = tfKey(); return { ...(e.tf || {}), ...(k !== 'tf' && e[k] ? e[k] : {}) }; }
export function setElTf(sel, patch) {
  const e = editFor(sel, true), k = tfKey(); const o = { ...(e[k] || {}) };
  for (const [a, v] of Object.entries(patch)) {
    if (v === undefined || v === null || v === '') delete o[a];
    else o[a] = typeof v === 'number' ? round(v, a === 'sx' || a === 'sy' ? 3 : 1) : v;
  }
  e[k] = o;
}
export const styleKeyEl = () => isMobile() ? 'mobile' : isTablet() ? 'tablet' : 'style';
export const styleKeyFeDev = () => isMobile() ? 'mob' : isTablet() ? 'tab' : 'style';
// locks: legacy `locked` = everything; `lock` = { pos, size, rot, style }
export function lockOf(t) {
  const o = !t ? null : t.type === 'fe' ? elById(t.id) : t.type === 'el' ? editFor(t.selector) : null;
  if (!o) return {};
  if (o.locked) return { pos: true, size: true, rot: true, style: true, all: true };
  const l = o.lock || {}; return { pos: !!l.pos, size: !!l.size, rot: !!l.rot, style: !!l.style };
}
export const isLocked = (t, k) => { const l = lockOf(t); return !!(l.all || l[k]); };
const feLocked = (id, k) => isLocked({ type: 'fe', id }, k);
// measure an element with its own transforms switched off (its layout box)
function noTf(n, fn) {
  const attr = n.getAttribute('style'), st = n.style;
  for (const p of ['translate', 'rotate', 'scale', 'transform']) st.setProperty(p, 'none', 'important');
  try { return fn(); } finally { restoreStyle(n, attr); }
}
const layoutRect = n => noTf(n, () => n.getBoundingClientRect());
function layoutSize(n) { if (typeof n.offsetWidth === 'number') return { w: n.offsetWidth, h: n.offsetHeight }; const r = layoutRect(n); return { w: r.width, h: r.height }; }
const restoreStyle = (n, attr) => { if (!n) return; if (attr === null || attr === undefined) n.removeAttribute('style'); else n.setAttribute('style', attr); };
// the box of a selectable target in frame (screen) px: centre, unrotated size, rotation, zoom (screen px per model px)
export function boxOf(t) {
  const n = elFor(t); if (!n) return null;
  const r = n.getBoundingClientRect(); if (!r.width && !r.height) return null;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (t.type === 'fe') { const e = elById(t.id); const z = (e && containerOf(e)?.z) || 1; return { cx, cy, w: n.offsetWidth * z, h: n.offsetHeight * z, r: feRot(e), z }; }
  if (t.type === 'el') { const tf = elTf(t.selector), s = layoutSize(n), m = siteTf(n), z = elZoom(n); return { cx, cy, w: s.w * Math.abs(num(tf.sx) ?? 1) * m.sx * z, h: s.h * Math.abs(num(tf.sy) ?? 1) * m.sy * z, r: (num(tf.r) || 0) + m.r, z }; }
  return { cx, cy, w: r.width, h: r.height, r: 0, z: 1 };
}
// a transform the site's own CSS gives the element (e.g. a zoomed hero image): kept apart from the editor's translate / rotate / scale
function siteTf(n) {
  const v = F.win.getComputedStyle(n).transform;
  if (!v || v === 'none') return { sx: 1, sy: 1, r: 0 };
  try { const m = new F.win.DOMMatrixReadOnly(v); return { sx: Math.hypot(m.a, m.b) || 1, sy: Math.hypot(m.c, m.d) || 1, r: Math.atan2(m.b, m.a) * 180 / Math.PI }; } catch { return { sx: 1, sy: 1, r: 0 }; }
}
// screen px per CSS px of an original element (a parent may be scaled by the site's CSS, e.g. a zoomed hero picture)
function elZoom(n) { if (typeof n.offsetWidth !== 'number' || !n.offsetWidth) return 1; const r = layoutRect(n); return r.width / n.offsetWidth || 1; }
const rad = d => d * Math.PI / 180;
const rotV = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const corners = b => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => { const [x, y] = rotV(i * b.w / 2, j * b.h / 2, rad(b.r)); return [b.cx + x, b.cy + y]; });
function hdSigns(h) { return [h.includes('e') ? 1 : h.includes('w') ? -1 : 0, h.includes('s') ? 1 : h.includes('n') ? -1 : 0]; }
// a handle drag on a (possibly rotated) box: the pointer delta is projected onto the box's own axes and the opposite edge / corner stays put
export function resizeBox(b, h, dx, dy, o = {}) {
  const [du, dv] = rotV(dx, dy, -rad(b.r));
  const [sx, sy] = hdSigns(h);
  const k = o.center ? 2 : 1;
  let W = b.w + sx * du * k, H = b.h + sy * dv * k;
  const minW = o.minW || 8, minH = o.minH || 4;
  if (o.ratio) {
    const ratio = b.w / Math.max(0.01, b.h);
    if (sx && sy) { const f = Math.abs(W / b.w - 1) > Math.abs(H / b.h - 1) ? W / b.w : H / b.h; W = b.w * f; H = b.h * f; }
    else if (sx) H = W / ratio; else W = H * ratio;
    const f = Math.max(minW / W, minH / H, 1); W *= f; H *= f;
  } else { W = Math.max(minW, W); H = Math.max(minH, H); }
  return placeBox(b, sx, sy, W, H, o.center);
}
function placeBox(b, sx, sy, W, H, center) {
  if (center) return { cx: b.cx, cy: b.cy, w: W, h: H, r: b.r };
  const a = rad(b.r);
  const [ax, ay] = rotV(-sx * b.w / 2, -sy * b.h / 2, a), [nx, ny] = rotV(-sx * W / 2, -sy * H / 2, a);
  return { cx: b.cx + ax - nx, cy: b.cy + ay - ny, w: W, h: H, r: b.r };
}
// phone geometry for a child of a box (copied from what the phone shows now, once)
function prepChildMob(e, c) {
  if (!e.parent || (e.m && num(e.m.y) !== null)) return;
  const n = feNode(e.id); c = c || containerOf(e); if (!n || !c) return;
  const W = c.width || FREE_W;
  e.m = { ...(e.m || {}), x: round(n.offsetLeft / W * 100, 3), y: Math.round(n.offsetTop), w: round(n.offsetWidth / W * 100, 3), ...(num(e.h) ? { h: Math.round(n.offsetHeight) } : {}), r: feRot(e) };
}
// rotation for the current device
export function setRot(e, a) {
  a = round(a, 1);
  if (isMobile() && !e.pin) {
    if (!e.parent) { if (!mobAbs(e)) prepMobileAbs([e.sec]); e.m = { ...(e.m || {}), r: a }; }
    else { prepChildMob(e); e.m = { ...(e.m || {}), r: a }; }
  } else e.r = a;
}
// children of an auto-layout (flex / grid) box are placed by the box unless "Free position" is on
export const inFlow = e => !!(e && e.parent && !e.free && elById(e.parent)?.p?.flow);
export const isoTop = () => S.iso[S.iso.length - 1] || null;
const TEXT_TAGS = /^(H[1-6]|P|SPAN|SMALL|LI|BLOCKQUOTE|FIGCAPTION|DT|DD|SUMMARY|LABEL|TD|TH|B|A|BUTTON)$/;
export const isTextTarget = t => !!t && (t.type === 'fe' ? ['text', 'button', 'marquee', 'counter'].includes(elById(t.id)?.kind) : t.type === 'el' && (() => { const n = elFor(t); return !!n && TEXT_TAGS.test(n.tagName) && !n.querySelector('img,video,svg'); })());
// cheap fingerprint of what the overlay shows (the per-frame loop redraws only when it changes)
function overlaySig() {
  const R = n => { if (!n) return ''; const r = n.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`; };
  const parts = [F.win.innerWidth, F.win.innerHeight, key(S.sel), key(S.hover), S.multi.join(','), JSON.stringify(S.iso), S.imgEdit?.id || '', !!drag, guidesNow.length, inlineState ? 1 : 0, S.textScale ? 1 : 0, S.undo.length];
  if (S.sel) parts.push(R(elFor(S.sel)));
  if (S.hover) parts.push(R(elFor(S.hover)));
  for (const id of S.multi.slice(0, 30)) parts.push(R(feNode(id)));
  const iso = isoTop(); if (iso) parts.push(R(iso.type === 'box' ? feNode(iso.id) : null));
  return parts.join('|');
}

/* ---------- overlay ---------- */
export function drawOverlay() {
  if (!ov) return;
  if (S.preview) { ov.innerHTML = ''; ov._h = ''; return; }
  const parts = [];
  const vw = F.win.innerWidth;
  const HD = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const handles = (attr = 'data-h') => HD.map(h => { const x = h.includes('w') ? 0 : h.includes('e') ? 100 : 50, y = h.includes('n') ? 0 : h.includes('s') ? 100 : 50; return `<span class="xhd" ${attr}="${h}" style="left:${x}%;top:${y}%"></span>`; }).join('');
  const rotHd = (attr = 'data-h') => `<span class="xrotl"></span><span class="xhd" ${attr}="rot" style="left:50%;top:-26px"></span>`;
  const readout = () => drag?.label ? `<span class="xdim">${esc(drag.label)}</span>` : '';
  // isolation: dim everything outside the active box / group
  const iso = isoTop();
  if (iso) { const r = isoRect(iso); if (r) parts.push(`<div class="xiso" style="left:${r.cx - r.w / 2}px;top:${r.cy - r.h / 2}px;width:${r.w}px;height:${r.h}px;${r.r ? `transform:rotate(${r.r}deg)` : ''}"></div>`); }
  const box = (t, cls, withTb) => {
    const el = elFor(t); if (!el) return;
    const isFe = t.type === 'fe', isEl = t.type === 'el';
    let L, T, W, H, rot = 0;
    if (isFe || isEl) {
      const b = boxOf(t); if (!b) return;
      W = b.w; H = b.h; rot = b.r; if (drag?.mode === 'rotate' && drag.a !== undefined && key(drag.t) === key(t)) rot = drag.a;
      L = b.cx - W / 2; T = b.cy - H / 2;
    } else { const r = el.getBoundingClientRect(); if (!r.width && !r.height) return; L = r.left; T = r.top; W = r.width; H = r.height; }
    const isSec = t.type === 'section' || t.type === 'block';
    const e = isFe ? elById(t.id) : null;
    const lk = lockOf(t), anyLock = lk.all || lk.pos || lk.size || lk.rot || lk.style;
    const low = T < 76 && !isSec, inside = isSec && T < 40 && H > 120;
    const off = inside ? Math.max(6, -T + 6) : 0;
    const tagSt = isSec ? `style="top:${inside ? off : -22}px;${S.rulers && !isMobile() ? 'left:18px;' : ''}${inside ? 'border-radius:0 4px 4px 0' : ''}"` : '';
    const tbSt = isSec ? `style="top:${inside ? off : 8}px"` : '';
    let inner = `<span class="xtag" ${tagSt}>${anyLock ? ic('lock') : ''}${esc(labelFor(t, el))}${e?.pin ? '<i>· pinned</i>' : ''}${e?.group ? '<i>· group</i>' : ''}${inFlow(e) ? '<i>· auto layout</i>' : ''}${withTb && (isFe || isEl) && isTextTarget(t) ? `<i>· ${S.textScale ? 'scale text' : 'text box'}</i>` : ''}</span>`;
    if (withTb) inner += toolbarHTML(t, el).replace('<div class="xtb">', `<div class="xtb" ${tbSt}>`);
    if (withTb && (isFe || isEl) && S.multi.length <= 1 && !inlineState && !S.imgEdit) {
      if (!lk.all && !lk.size) inner += handles();
      if (!lk.all && !lk.rot && !e?.pin) inner += rotHd();
      inner += readout();
    }
    const hasRot = withTb && (isFe || isEl) && S.multi.length <= 1 && !inlineState && !S.imgEdit && !lk.all && !lk.rot && !e?.pin;
    parts.push(`<div class="xb ${cls} ${isSec ? 'xsec' : ''} ${lk.all ? 'xlock' : anyLock ? 'xpart' : ''} ${low ? 'xlow' : ''} ${hasRot ? 'xhasrot' : ''}" style="left:${L}px;top:${T}px;width:${W}px;height:${H}px;${rot ? `transform:rotate(${rot}deg)` : ''}">${inner}</div>`);
  };
  // active free layer column
  const act = S.sel ? secIdOf(S.sel) : S.hover ? secIdOf(S.hover) : null;
  const actNode = act && F.main.querySelector(`[data-cms-section="${act}"]`);
  if (actNode && (S.sel?.type === 'fe' || S.sel?.type === 'el' || drag)) {
    const lr = layerRect(actNode);
    if (S.sel?.type === 'fe' || drag) parts.push(`<div class="xlayer" style="left:${lr.left}px;top:${lr.top}px;width:${lr.vw}px;height:${lr.vh}px"></div>`);
    const gs = Math.max(2, num(S.gridSize) || 10) * lr.z;
    if (S.grid && gs >= 3) parts.push(`<div class="xgrid" style="left:${lr.left}px;top:${lr.top}px;width:${lr.vw}px;height:${lr.vh}px;background-size:${gs}px ${gs}px"></div>`);
  }
  if (S.hover && key(S.hover) !== key(S.sel) && !S.multi.includes(S.hover.id)) box(S.hover, 'xh', false);
  if (S.imgEdit) imgEditParts(parts);
  else if (S.multi.length > 1) {
    for (const id of S.multi) box({ type: 'fe', id }, 'xm', false);
    // shared bounding box with handles: move, scale and rotate the whole selection
    const U = multiRect();
    if (U) {
      const grp = S.multi.every(id => elById(id)?.group && elById(id).group === elById(S.multi[0]).group);
      const allLocked = S.multi.every(id => feLocked(id, 'size') && feLocked(id, 'pos'));
      parts.push(`<div class="xb xs xmulti ${grp ? 'xgrp' : ''} ${U.T < 62 ? 'xlow' : ''}" style="left:${U.L}px;top:${U.T}px;width:${U.R - U.L}px;height:${U.B - U.T}px"><span class="xtag">${S.multi.length} elements${grp ? ' <i>· group</i>' : ''}</span>${toolbarHTML({ type: 'multi' })}${allLocked || inlineState ? '' : handles('data-mh') + rotHd('data-mh')}${readout()}</div>`);
    }
  } else if (S.sel) box(S.sel, 'xs', true);
  if (dropAt) parts.push(`<div class="xdrop" style="left:${dropAt.left}px;top:${dropAt.y - 2}px;width:${dropAt.width}px"><span>Drop here</span></div>`);
  if (dropBox) parts.push(`<div class="xdropbox" style="left:${dropBox.left}px;top:${dropBox.top}px;width:${dropBox.width}px;height:${dropBox.height}px"></div>`);
  for (const g of guidesNow) {
    if (g.gap === 'h') parts.push(`<div class="xgap h" style="left:${g.x1}px;top:${g.y}px;width:${Math.max(1, g.x2 - g.x1)}px"><b>${g.label}</b></div>`);
    else if (g.gap === 'v') parts.push(`<div class="xgap v" style="top:${g.y1}px;left:${g.x}px;height:${Math.max(1, g.y2 - g.y1)}px"><b>${g.label}</b></div>`);
    else parts.push(g.v !== undefined ? `<div class="xg v" style="left:${g.v}px;top:${g.a}px;height:${g.b - g.a}px"></div>` : `<div class="xg h" style="top:${g.h}px;left:${g.a}px;width:${g.b - g.a}px"></div>`);
  }
  if (marq) parts.push(`<div class="xmarq" style="left:${Math.min(marq.x0, marq.x1)}px;top:${Math.min(marq.y0, marq.y1)}px;width:${Math.abs(marq.x1 - marq.x0)}px;height:${Math.abs(marq.y1 - marq.y0)}px"></div>`);
  // user guides + rulers
  if (S.rulers && !isMobile()) {
    const ref = actNode || sectionAt(F.win.innerHeight / 2) || sectionsEls()[0];
    if (ref) {
      const lr = layerRect(ref), sr = ref.getBoundingClientRect();
      for (const x of S.guides.v || []) parts.push(`<div class="xgd v" data-guide="v:${x}" style="left:${lr.left + x * lr.z}px;top:0;height:100%"></div>`);
      for (const g of S.guides.h || []) { const sn = F.main.querySelector(`[data-cms-section="${g.sec}"]`); if (sn) { const y = sn.getBoundingClientRect().top + g.y * layerRect(sn).z; if (y > -2 && y < F.win.innerHeight) parts.push(`<div class="xgd h" data-guide="h:${g.sec}:${g.y}" style="top:${y}px;left:0;width:100%"></div>`); } }
      let tl = ''; for (let x = 0; x <= FREE_W; x += 100) { const px = lr.left + x * lr.z - 18; if (px > 0 && px < vw) tl += `<span style="left:${px}px">${x}</span>`; }
      let ll = ''; for (let y = 0; y <= sr.height / lr.z; y += 100) { const py = sr.top + y * lr.z - 18; if (py > 0 && py < F.win.innerHeight) ll += `<span style="top:${py}px">${y}</span>`; }
      let mk = '';
      const sb = S.sel?.type === 'fe' || S.sel?.type === 'el' ? elFor(S.sel)?.getBoundingClientRect() : null;
      if (sb) mk = `<i class="mk" style="left:${sb.left - 18}px;width:${sb.width}px;top:0;bottom:0"></i>`;
      const mkl = sb ? `<i class="mk" style="top:${sb.top - 18}px;height:${sb.height}px;left:0;right:0"></i>` : '';
      parts.push(`<div class="xrul t" data-ruler="v" data-sec="${ref.dataset.cmsSection}">${tl}${mk}</div><div class="xrul l" data-ruler="h" data-sec="${ref.dataset.cmsSection}">${ll}${mkl}</div><div class="xrul c"></div>`);
    }
  }
  if (inlineState) {
    const r = inlineState.el.getBoundingClientRect();
    const top = r.top > 56 ? r.top - 46 : r.bottom + 10;
    parts.push(`<div class="xfmt" style="left:${Math.max(4, Math.min(vw - 360, r.left))}px;top:${top}px">${FMT.map(f => f === '|' ? '<i class="sep"></i>' : `<button data-fmt="${f[0]}" title="${f[2]}">${f[1]}</button>`).join('')}</div>`);
  }
  const html = parts.join('');
  if (ov._h !== html) {
    ov.innerHTML = html; ov._h = html;
    // keep floating toolbars inside the visible frame (narrow / mobile view)
    ov.querySelectorAll('.xtb,.ximgtb').forEach(tb => {
      const r = tb.getBoundingClientRect();
      if (r.width > vw - 8) { tb.style.maxWidth = (vw - 8) + 'px'; tb.style.overflowX = 'auto'; }
      const r2 = tb.getBoundingClientRect();
      let dx = 0; if (r2.left < 4) dx = 4 - r2.left; else if (r2.right > vw - 4) dx = vw - 4 - r2.right;
      if (dx) tb.style.marginLeft = dx + 'px';
    });
  }
  renderCrumbs();
}
// screen rect of the active isolation container
function isoRect(iso) {
  if (iso.type === 'box') return boxOf({ type: 'fe', id: iso.id });
  const ids = C().els.filter(e => e.group === iso.id).map(e => e.id);
  const U = unionRect(ids); return U && { cx: (U.L + U.R) / 2, cy: (U.T + U.B) / 2, w: U.R - U.L + 12, h: U.B - U.T + 12, r: 0 };
}
function unionRect(ids) {
  const pts = ids.map(id => boxOf({ type: 'fe', id })).filter(Boolean).flatMap(corners);
  if (!pts.length) return null;
  return { L: Math.min(...pts.map(p => p[0])), T: Math.min(...pts.map(p => p[1])), R: Math.max(...pts.map(p => p[0])), B: Math.max(...pts.map(p => p[1])) };
}
const multiRect = () => unionRect(S.multi);
const FMT = [['bold', '<b>B</b>', 'Bold (Ctrl+B)'], ['italic', '<i>I</i>', 'Italic (Ctrl+I)'], ['underline', '<u>U</u>', 'Underline'], ['strikeThrough', '<s>S</s>', 'Strikethrough'], '|', ['createLink', '🔗', 'Link'], ['unlink', '⛓', 'Remove link'], '|', ['insertUnorderedList', '•≡', 'Bullet list'], ['insertOrderedList', '1≡', 'Numbered list'], ['mark', '<span style="background:#fde047;color:#000;padding:0 3px">H</span>', 'Highlight'], '|', ['removeFormat', '⨯', 'Clear formatting']];

// the main action of each free element kind (floating toolbar on desktop, action bar on phones)
export const FE_MAIN = { text: ['inline', 'Edit text'], button: ['settings', 'Change text'], image: ['image', 'Change image'], vector: ['image', 'Change SVG'], video: ['settings', 'Video settings'], slider: ['settings', 'Manage images'], form: ['settings', 'Edit form'], menu: ['settings', 'Manage menu'], embed: ['settings', 'Enter code'], map: ['settings', 'Address'], box: ['design', 'Change design'] };
function toolbarHTML(t, el) {
  const b = (a, icon, title, cls = '') => `<button data-act="${a}" title="${esc(title)}" class="${cls}">${icon.startsWith('<') || !icon ? icon : ic(icon)}</button>`;
  const lb = (a, label, title) => `<button data-act="${a}" class="lb" title="${esc(title || label)}">${esc(label)}</button>`;
  const sep = '<i class="sep"></i>';
  const out = [];
  if (t.type === 'multi') {
    const grouped = S.multi.every(id => elById(id)?.group && elById(id).group === elById(S.multi[0]).group);
    out.push(grouped ? lb('ungroup', 'Ungroup', 'Ungroup (Ctrl+Shift+G)') : lb('group', 'Group', 'Group (Ctrl+G)'));
    out.push(b('alignL', 'alignL', 'Align left'), b('alignC', 'alignC', 'Align centre'), b('alignR', 'alignR', 'Align right'), b('alignT', 'alignT', 'Align top'), b('alignM', 'alignM', 'Align middle'), b('alignB', 'alignB', 'Align bottom'));
    if (S.multi.length > 2) out.push(b('distH', 'distH', 'Distribute horizontally'), b('distV', 'distV', 'Distribute vertically'));
    out.push(sep, b('design', 'brush', 'Design'), b('anim', 'anim', 'Animation'), b('dupe', 'copy', 'Duplicate (Ctrl+D)'), b('del', 'trash', 'Delete'), b('more', 'more', 'More'));
  } else if (t.type === 'fe') {
    const e = elById(t.id) || {};
    const main = FE_MAIN[e.kind] || ['settings', 'Settings'];
    out.push(lb(main[0], main[1]));
    if (e.kind === 'image' && e.p?.src) out.push(b('imgedit', 'crop', 'Adjust the photo inside its box (double-click)'));
    if (isTextTarget(t)) out.push(b('tmode', 'type', S.textScale ? 'Handles scale the text — click for: resize text box (K)' : 'Handles resize the text box — click for: scale text (K)', S.textScale ? 'on' : ''));
    out.push(b('layout', 'layout', 'Layout'), b('design', 'brush', 'Design'), b('anim', 'anim', 'Animation'));
    if (!['form', 'menu', 'slider', 'tabs', 'accordion', 'embed', 'map', 'video', 'audio', 'beforeafter', 'repeater', 'social'].includes(e.kind)) out.push(b('link', 'link', 'Link', e.link ? 'on' : ''));
    const lk = lockOf(t), lkAny = lk.pos || lk.size || lk.rot || lk.style;
    out.push(sep, b('front', 'arrange', 'Bring forward (Ctrl+])'), b('pin', 'pin', e.pin ? 'Unpin' : 'Pin to screen', e.pin ? 'on' : ''), b('lock', lk.all || lkAny ? 'lock' : 'unlock', lk.all ? 'Unlock' : lkAny ? 'Partly locked — click to lock everything' : 'Lock', lk.all || lkAny ? 'on' : ''), b('dupe', 'copy', 'Duplicate (Ctrl+D)'), b('del', 'trash', 'Delete (Del)'), b('more', 'more', 'More actions'));
  } else if (t.type === 'el' || t.type === 'field') {
    if (el && el.tagName === 'IMG') out.push(lb('image', 'Change image'));
    if (el && el.tagName === 'VIDEO') out.push(lb('video', 'Change video'));
    else if (elKind(el) === 'Container') out.push(lb('layout', 'Layout'));
    else out.push(lb('inline', 'Edit text'));
    if (t.type === 'el' && isTextTarget(t)) out.push(b('tmode', 'type', S.textScale ? 'Handles scale the text — click for: resize text box (K)' : 'Handles resize the text box — click for: scale text (K)', S.textScale ? 'on' : ''));
    out.push(b('design', 'brush', 'Design'), b('anim', 'anim', 'Animation'));
    if (t.type === 'el') { const lk = lockOf(t), lkAny = lk.pos || lk.size || lk.rot || lk.style; out.push(b('link', 'link', 'Link'), b('parent', 'parent', 'Select parent'), sep, b('lock', lk.all || lkAny ? 'lock' : 'unlock', lk.all ? 'Unlock' : lkAny ? 'Partly locked — click to lock everything' : 'Lock', lk.all || lkAny ? 'on' : ''), b('hide', 'eyeoff', 'Hide'), b('copystyle', 'style', 'Copy design'), b('reset', 'reset', 'Reset to original'), b('more', 'more', 'More')); }
    else out.push(b('parent', 'parent', 'Select section'));
  } else {
    out.push(lb('addhere', '+ Add element', 'Add an element to this section'));
    out.push(b('design', 'brush', 'Background & design'), b('layout', 'layout', 'Layout & height'), b('anim', 'anim', 'Animation & scroll effects'), sep, b('up', 'up', 'Move up'), b('down', 'down', 'Move down'));
    if (t.type === 'block') out.push(b('dupe', 'copy', 'Duplicate'));
    out.push(b('hide', 'eyeoff', 'Hide section'));
    if (t.type === 'block') out.push(b('del', 'trash', 'Delete'));
    out.push(b('more', 'more', 'More'));
  }
  return `<div class="xtb">${out.join('')}</div>`;
}
export function act(a, btn) {
  const t = S.sel; if (!t && a !== 'paste') return;
  const openTab = tab => { S.tab = tab; hooks.renderInspector?.(); hooks.flashInspector?.(); };
  switch (a) {
    case 'inline': startInline(); break;
    case 'video': { pickMedia(url => { const x = editFor(t.selector, true); x.type = 'video'; x.value = url; commit(); }, { kind: 'video' }); break; }
    case 'image': { const e = t.type === 'fe' ? elById(t.id) : null; pickMedia(url => { if (e) { e.p = { ...(e.p || {}), src: url }; commit(); } else setImage(t, url); }, { kind: e?.kind === 'vector' ? 'vector' : 'image' }); break; }
    case 'settings': openTab('settings'); break;
    case 'layout': openTab('layout'); break;
    case 'design': openTab('design'); break;
    case 'anim': openTab('anim'); break;
    case 'link': openTab(t.type === 'fe' ? 'settings' : 'content'); setTimeout(() => document.querySelector('.linkf select')?.focus(), 50); break;
    case 'parent': selectParent(); break;
    case 'hide': toggleHidden(t); break;
    case 'reset': C().edits = C().edits.filter(e => e.selector !== t.selector); commit(); toast('Element reset'); break;
    case 'up': case 'down': moveSection(t.id, a === 'up' ? -1 : 1); break;
    case 'dupe': duplicate(); break;
    case 'del': removeSelected(); break;
    case 'front': zOrder(1); break;
    case 'pin': togglePin(); break;
    case 'lock': toggleLock(); break;
    case 'group': group(); break;
    case 'ungroup': ungroup(); break;
    case 'copystyle': copyStyle(); break;
    case 'addhere': S._addTarget = t.id; hooks.openPanel?.('add'); break;
    case 'more': { const r = btn.getBoundingClientRect(); contextMenu(r.left, r.bottom + 4); break; }
    case 'tmode': toggleTextScale(); break;
    case 'imgedit': if (t.type === 'fe') startImgEdit(t.id); break;
    case 'imgdone': endImgEdit(); break;
    case 'flipH': flip('x'); break;
    case 'flipV': flip('y'); break;
    case 'isoexit': exitIso(); break;
    default: if (/^align|^dist/.test(a)) align(a); else if (a.startsWith('imgfit:')) imgPreset(a.slice(7));
  }
}
export function select(t, opts = {}) {
  finishInline();
  flushLive(true);
  if (S.imgEdit && !(t?.type === 'fe' && t.id === S.imgEdit.id)) S.imgEdit = null;
  if (t && S.iso.length && !insideIso(t)) S.iso = []; // selecting something elsewhere (Layers, breadcrumbs) leaves isolation
  if (t?.type === 'fe') {
    const e = elById(t.id);
    const inGroup = isoTop()?.type === 'group';
    if (opts.add) { const i = S.multi.indexOf(t.id); if (i >= 0) S.multi.splice(i, 1); else S.multi.push(t.id); }
    else if (e?.group && !opts.single && !inGroup) S.multi = C().els.filter(x => x.group === e.group).map(x => x.id);
    else S.multi = [t.id];
    if (!S.multi.length) t = null; else t = { type: 'fe', id: S.multi.includes(t.id) ? t.id : S.multi[S.multi.length - 1] };
  } else S.multi = [];
  const changedKind = (S.sel?.type) !== (t?.type);
  S.sel = t;
  if (changedKind || !opts.keepTab) { if (t?.type === 'fe' && !['settings', 'layout', 'design', 'anim'].includes(S.tab)) S.tab = 'settings'; if ((t?.type === 'el' || t?.type === 'field') && !['content', 'layout', 'design', 'anim'].includes(S.tab)) S.tab = 'content'; if ((t?.type === 'section' || t?.type === 'block') && !['content', 'layout', 'design', 'anim'].includes(S.tab)) S.tab = 'content'; }
  if (S.state !== 'normal' && t?.type !== 'fe' && t?.type !== 'el') S.state = 'normal';
  drawOverlay(); hooks.renderInspector?.();
  if (S.panel === 'layers') hooks.syncLayers?.();
}
export function selectMany(ids) { finishInline(); flushLive(true); S.imgEdit = null; S.multi = ids.filter(id => elById(id)); S.sel = S.multi.length ? { type: 'fe', id: S.multi[S.multi.length - 1] } : null; drawOverlay(); hooks.renderInspector?.(); if (S.panel === 'layers') hooks.syncLayers?.(); }
export function scrollToSel() { const el = elFor(S.sel); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
function selectParent() {
  const t = S.sel; const el = elFor(t); if (!el) return;
  if (t.type === 'fe') { const e = elById(t.id); const iso = isoTop(); if (iso && (iso.type === 'group' || iso.id === e?.parent)) { exitIso(); return; } if (e?.parent) select({ type: 'fe', id: e.parent }, { single: true }); else select({ type: isBlock(e.sec) ? 'block' : 'section', id: e.sec }); return; }
  if (t.type === 'field') { select({ type: 'block', id: t.id }); return; }
  let p = el.parentElement;
  while (p && p !== F.main && !p.parentElement?.classList.contains('page-enter') && (p.offsetWidth === el.offsetWidth && p.offsetHeight === el.offsetHeight)) p = p.parentElement;
  if (!p || p === F.main || p.classList.contains('page-enter')) return;
  if (p.parentElement?.classList.contains('page-enter') && p.dataset.cmsSection) select({ type: p.classList.contains('cms-added-section') ? 'block' : 'section', id: p.dataset.cmsSection });
  else select({ type: 'el', selector: selectorFor(p) });
}

/* ---------- inline text editing ---------- */
let inlineState = null;
const INLINE_OK = el => [...el.querySelectorAll('*')].every(c => /^(B|STRONG|I|EM|U|S|BR|SMALL|SUP|SUB|SPAN|A|MARK)$/.test(c.tagName));
export function startInline() {
  const t = S.sel; const node = elFor(t);
  // only text-like targets: never sections or whole blocks (that would make the whole section editable)
  if (!t || !['fe', 'el', 'field'].includes(t.type)) return;
  if (!node || node.tagName === 'IMG') return;
  if (t.type === 'el' && lockOf(t).all) { toast('Unlock the element to edit it'); return; }
  let el = node, rich = false;
  if (t.type === 'fe') {
    const e = elById(t.id);
    if (e.kind === 'text') { el = node.querySelector('.cms-txt'); rich = true; }
    else if (e.kind === 'button') { el = node.querySelector('.cms-btn-in>span'); if (!el) { S.tab = 'settings'; hooks.renderInspector?.(); return; } }
    else { S.tab = 'settings'; hooks.renderInspector?.(); hooks.flashInspector?.(); return; }
    if (e.locked) { toast('Unlock the element to edit it'); return; }
  } else {
    if (t.type === 'field' && /image/.test(t.field)) return;
    if (t.type === 'el' && !INLINE_OK(el)) { S.tab = 'content'; hooks.renderInspector?.(); $('[data-textfield]')?.focus(); toast(S.phone ? 'Edit this text in the panel below' : 'Edit this text in the panel on the right'); if (S.phone) hooks.flashInspector?.(); return; }
  }
  if (!el) return;
  inlineState = { t, el, rich, before: el.innerHTML };
  el.contentEditable = 'true'; el.spellcheck = true; el.focus();
  const r = F.doc.createRange(); r.selectNodeContents(el); const s = F.win.getSelection(); s.removeAllRanges(); s.addRange(r);
  el.addEventListener('keydown', inlineKey); el.addEventListener('blur', onBlur); el.addEventListener('paste', inlinePaste);
  ov.addEventListener('mousedown', fmtDown, true);
  drawOverlay();
}
function onBlur() { setTimeout(() => { if (inlineState && F.doc.activeElement !== inlineState.el) finishInline(); }, 120); }
function fmtDown(e) {
  const b = e.target.closest('[data-fmt]'); if (!b || !inlineState) return;
  e.preventDefault(); e.stopPropagation();
  const f = b.dataset.fmt;
  if (f === 'createLink') { const u = F.win.prompt('Link address (https://…, /satin/page, #section, tel:, mailto:)', 'https://'); if (u) F.doc.execCommand('createLink', false, u); }
  else if (f === 'mark') toggleMark();
  else if ((f === 'insertUnorderedList' || f === 'insertOrderedList') && !inlineState.rich) toast('Lists work in text elements');
  else if (f === 'removeFormat') { F.doc.execCommand('removeFormat'); unmarkSelection(); }
  else F.doc.execCommand(f);
  inlineState.el.focus();
}
// highlight: toggles <mark> around the selected words (removes it when the selection is already highlighted);
// works across several paragraphs by wrapping each text piece, so it never produces invalid markup
const unwrap = n => n.replaceWith(...n.childNodes);
function marksIn(range) { const root = inlineState.el; return [...root.querySelectorAll('mark')].filter(m => range.intersectsNode(m)); }
function unmarkSelection() { const sel = F.win.getSelection(); if (!sel.rangeCount || !inlineState) return 0; const ms = marksIn(sel.getRangeAt(0)); ms.forEach(unwrap); inlineState.el.normalize(); return ms.length; }
function toggleMark() {
  const sel = F.win.getSelection(); if (!sel.rangeCount || !inlineState) return;
  const r = sel.getRangeAt(0);
  const inside = n => (n.nodeType === 1 ? n : n.parentElement)?.closest('mark');
  const m0 = inside(r.startContainer);
  if ((m0 && inlineState.el.contains(m0)) || (!sel.isCollapsed && marksIn(r).length)) { unmarkSelection(); return; }
  if (sel.isCollapsed) { toast('Select some words first'); return; }
  const rootN = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
  const tw = F.doc.createTreeWalker(rootN, NodeFilter.SHOW_TEXT); const texts = [];
  while (tw.nextNode()) if (r.intersectsNode(tw.currentNode) && tw.currentNode.nodeValue.length) texts.push(tw.currentNode);
  const first = { n: r.startContainer, o: r.startOffset }, last = { n: r.endContainer, o: r.endOffset };
  let firstMark = null, lastMark = null;
  for (let t of texts) {
    const s0 = t === first.n ? first.o : 0, e0 = t === last.n ? last.o : t.length;
    if (e0 <= s0) continue;
    if (e0 < t.length) t.splitText(e0);
    if (s0 > 0) t = t.splitText(s0);
    if (!t.nodeValue.trim()) continue;
    const m = F.doc.createElement('mark'); t.replaceWith(m); m.append(t);
    firstMark ||= m; lastMark = m;
  }
  if (firstMark) { const nr = F.doc.createRange(); nr.setStartBefore(firstMark); nr.setEndAfter(lastMark); sel.removeAllRanges(); sel.addRange(nr); }
}
function inlineKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); inlineState.el.innerHTML = inlineState.before; inlineState.cancel = true; finishInline(); }
  else if (e.key === 'Enter' && !e.shiftKey && !inlineState.rich && !/^(P|LI|DIV)$/.test(inlineState.el.tagName)) { e.preventDefault(); finishInline(); }
  else if (e.key === 'Enter' && !e.shiftKey && !inlineState.rich) { e.preventDefault(); F.doc.execCommand('insertLineBreak'); }
  else if ((e.ctrlKey || e.metaKey) && /^[biu]$/i.test(e.key)) { e.preventDefault(); F.doc.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); }
  e.stopPropagation();
}
function inlinePaste(e) { e.preventDefault(); const txt = (e.clipboardData || F.win.clipboardData).getData('text/plain'); F.doc.execCommand('insertText', false, txt); }
export function finishInline() {
  if (!inlineState) return;
  const { t, el, before, cancel, rich } = inlineState; inlineState = null;
  ov?.removeEventListener('mousedown', fmtDown, true);
  el.removeEventListener('keydown', inlineKey); el.removeEventListener('blur', onBlur); el.removeEventListener('paste', inlinePaste);
  el.removeAttribute('contenteditable');
  try { F.win.getSelection().removeAllRanges(); } catch { }
  if (cancel || el.innerHTML === before) { drawOverlay(); return; }
  const html = RT.cleanHTML(el.innerHTML, F.doc, rich).replace(/(<br>)+$/, '');
  const plain = !/<[a-z]/i.test(html);
  const text = el.innerText.replace(/\n$/, '');
  if (t.type === 'fe') { const e = elById(t.id); if (!e) return; if (e.kind === 'text') e.p = { ...e.p, html }; else if (e.kind === 'button') e.p = { ...e.p, label: text.trim() }; }
  else if (t.type === 'el') { const e = editFor(t.selector, true); if (plain) { e.type = 'text'; e.value = text; } else { e.type = 'html'; e.value = html; } }
  else if (t.type === 'field') setField(t.id, t.field, t.field === 'body' || /\.body$/.test(t.field) ? (plain ? text : html) : text, true);
  commit();
}

/* ---------- direct manipulation ---------- */
let drag = null, suppressClick = false, downFe = false;
function onPointerDown(e) {
  if (S.preview || e.button !== 0) return;
  if (e.target.closest?.('.cms-pop')) { e.stopPropagation(); return; }
  flushLive(true);
  const hd = e.target.closest?.('#cms-ov [data-h]');
  const mh = e.target.closest?.('#cms-ov [data-mh]');
  const ih = e.target.closest?.('#cms-ov [data-ih]');
  const iw = e.target.closest?.('#cms-ov .ximgw');
  const gd = e.target.closest?.('#cms-ov [data-guide]');
  const ru = e.target.closest?.('#cms-ov [data-ruler]');
  if (gd || ru) { e.preventDefault(); e.stopPropagation(); startGuide(e, gd, ru); return; }
  if (S.imgEdit && (ih || iw)) { e.preventDefault(); e.stopPropagation(); startImgDrag(e, ih ? ih.dataset.ih : 'pan'); return; }
  if (mh && S.multi.length > 1) { e.preventDefault(); e.stopPropagation(); startMulti(e, mh.dataset.mh); return; }
  if (hd && (S.sel?.type === 'fe' || S.sel?.type === 'el')) { e.preventDefault(); e.stopPropagation(); startResize(e, hd.dataset.h); return; }
  if (e.target.closest?.('#cms-ov')) return;
  if (e.target.isContentEditable) return;
  const t = resolve(e.target);
  if (S.imgEdit) { if (t?.type === 'fe' && t.id === S.imgEdit.id) { e.preventDefault(); e.stopPropagation(); startImgDrag(e, 'pan'); return; } endImgEdit(); }
  downFe = false;
  if (t?.type === 'fe') {
    if (S.phone && e.pointerType !== 'mouse' && !S.multi.includes(t.id)) return; // phones: a tap selects (click), a swipe scrolls
    e.stopPropagation(); downFe = true;
    if (e.shiftKey) { select(t, { add: true }); return; }
    if (!S.multi.includes(t.id)) select(t, { single: e.ctrlKey || e.metaKey });
    startMove(e);
    return;
  }
  if (t?.type === 'el' && S.sel && key(S.sel) === key(t)) { e.stopPropagation(); startElMove(e, t); return; }
  // empty section area (or empty area of the isolated box): drag a selection rectangle; a plain click still selects the section
  if ((t?.type === 'section' || t?.type === 'block') && !(S.phone && e.pointerType !== 'mouse')) { startMarquee(e, e.shiftKey); return; }
  if (!t && isoTop() && isoContains(e.target)) startMarquee(e, e.shiftKey);
}
const pt = e => ({ x: e.clientX, y: e.clientY });
function listen(move, up) {
  const d = F.doc;
  const mv = ev => { ev.preventDefault(); move(ev); };
  const end = ev => { d.removeEventListener('pointermove', mv, true); d.removeEventListener('pointerup', end, true); d.removeEventListener('pointercancel', end, true); up(ev); };
  d.addEventListener('pointermove', mv, true); d.addEventListener('pointerup', end, true); d.addEventListener('pointercancel', end, true);
}
const quiet = () => { suppressClick = true; setTimeout(() => suppressClick = false, 50); };
function startMove(e) {
  const sel = S.multi.filter(id => elById(id));
  const ids = sel.filter(id => !feLocked(id, 'pos'));
  const p0 = pt(e);
  const movable = ids.filter(id => !inFlow(elById(id)));
  if (!movable.length) {
    // locked, or placed by an auto-layout box: say so (once) instead of a drag that would be ignored; the gesture is swallowed
    let told = false;
    listen(ev => { if (!told && Math.hypot(ev.clientX - p0.x, ev.clientY - p0.y) > 6) { told = true; toast(ids.length ? 'This box arranges its items automatically. Turn on “Free position” in Layout to place this element anywhere.' : 'Position is locked (Layout › Lock)'); } }, () => { if (told) quiet(); });
    return;
  }
  drag = { mode: 'move', moved: false, items: null };
  listen(ev => {
    if (!drag) return;
    const dx = ev.clientX - p0.x, dy = ev.clientY - p0.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      // phones: the first real move gives the section its own phone layout (never a simple click)
      if (isMobile()) { const secs = [...new Set(movable.map(elById).filter(x => x && !x.pin && !x.parent && !mobAbs(x)).map(x => x.sec))]; if (secs.length) prepMobileAbs(secs); }
      const items = movable.map(id => { const el = elById(id); const g = geom(el); return g && { id, el, g }; }).filter(Boolean);
      if (!items.length) { drag = null; return; }
      items.forEach(i => feNode(i.id)?.classList.add('cms-ghost'));
      drag.items = items;
      drag.r0 = unionRect(items.map(i => i.id));
      drag.cand = items[0].el.pin ? null : snapCands({ type: 'fe', id: items[0].id }, new Set(sel));
    }
    const items = drag.items, lead = items[0];
    const z = lead.g.c?.z || 1;
    let sdx = 0, sdy = 0; guidesNow = [];
    if (drag.r0 && drag.cand) { const s = snapMoveRect({ L: drag.r0.L + dx, T: drag.r0.T + dy, R: drag.r0.R + dx, B: drag.r0.B + dy }, drag.cand, ev.altKey); sdx = s.dx; sdy = s.dy; guidesNow = s.lines.concat(s.marks); }
    const ddx = (dx + sdx) / z, ddy = (dy + sdy) / z;
    for (const i of items) { const n = feNode(i.id); if (!n) continue; n.style.setProperty('left', (i.g.x + ddx) + 'px', 'important'); n.style.setProperty('top', (i.g.y + ddy) + 'px', 'important'); n.style.setProperty('right', 'auto', 'important'); n.style.setProperty('bottom', 'auto', 'important'); }
    drag.dx = ddx; drag.dy = ddy;
    drag.label = !lead.el.pin ? (items.length > 1 ? `Δ ${Math.round(ddx)}, ${Math.round(ddy)}` : `X ${Math.round(lead.g.x + ddx)}  Y ${Math.round(lead.g.y + ddy)}`) : '';
    // section / box under the pointer for re-parenting
    if (items.length === 1 && !lead.el.pin) { n0hide(lead.id, true); const under = F.doc.elementFromPoint(ev.clientX, ev.clientY); n0hide(lead.id, false); drag.over = under; const tgt = reparentTarget(lead.el, under); dropBox = tgt && (tgt.box || tgt.sec !== lead.el.sec) ? (tgt.box ? feNode(tgt.box) : F.main.querySelector(`[data-cms-section="${tgt.sec}"]`))?.getBoundingClientRect() : null; }
    drawOverlay();
  }, () => {
    const d = drag; drag = null; guidesNow = []; dropBox = null;
    if (!d) return;
    (d.items || []).forEach(i => feNode(i.id)?.classList.remove('cms-ghost'));
    if (!d.moved || !d.items) { drawOverlay(); return; }
    quiet();
    for (const i of d.items) {
      const e2 = i.el;
      if (e2.pin) { pinFromRect(e2, feNode(i.id)); continue; }
      const nx = i.g.x + (d.dx || 0), ny = i.g.y + (d.dy || 0);
      const tgt = d.items.length === 1 ? reparentTarget(e2, d.over) : null;
      if (tgt && (tgt.sec !== e2.sec || (tgt.box || null) !== (e2.parent || null))) moveToContainer(e2, tgt, feNode(i.id).getBoundingClientRect());
      else setGeom(e2, { x: nx, y: ny }, i.g.c);
    }
    commit({ keepInspector: false, label: d.items.length > 1 ? `Move ${d.items.length} elements` : 'Move ' + feName(d.items[0].el) });
  });
}
function n0hide(id, h) { const n = feNode(id); if (n) n.style.pointerEvents = h ? 'none' : ''; }
function reparentTarget(e, under) {
  if (!under || !under.closest) return null;
  const box = under.closest('.cms-el.w-box');
  if (box && box.dataset.el !== e.id && !isDescendant(box.dataset.el, e.id)) { const be = elById(box.dataset.el); if (be) return { sec: be.sec, box: be.id }; }
  const sec = under.closest('[data-cms-section]');
  if (sec && sec.parentElement?.classList.contains('page-enter')) return { sec: sec.dataset.cmsSection, box: null };
  return null;
}
function isDescendant(id, ancestorId) { let x = elById(id); while (x && x.parent) { if (x.parent === ancestorId) return true; x = elById(x.parent); } return false; }
function moveToContainer(e, tgt, rect) {
  const old = { sec: e.sec, parent: e.parent };
  e.sec = tgt.sec; if (tgt.box) e.parent = tgt.box; else delete e.parent;
  // compute new container rect
  let c;
  if (tgt.box) { const inn = feNode(tgt.box)?.querySelector(':scope>.cms-a>.cms-in'); const r = inn.getBoundingClientRect(); const z = inn.offsetWidth ? r.width / inn.offsetWidth : 1; c = { left: r.left + inn.clientLeft * z, top: r.top + inn.clientTop * z, width: inn.clientWidth, z }; }
  else c = layerRect(F.main.querySelector(`[data-cms-section="${tgt.sec}"]`));
  const n = feNode(e.id);
  const w = n.offsetWidth, h = n.offsetHeight;
  const z = c.z || 1;
  const cx = (rect.left + rect.width / 2 - c.left) / z - w / 2, cy = (rect.top + rect.height / 2 - c.top) / z - h / 2;
  setGeom(e, { x: cx, y: cy, w }, c);
  if (isMobile()) { delete e.m?.x; delete e.m?.y; }
  e.z = maxZ(e) + 1;
  toast(tgt.box ? 'Moved into the box' : old.parent ? 'Moved out of the box' : 'Moved to another section');
}
const maxZ = e => Math.max(0, ...C().els.filter(x => x.id !== e.id && x.sec === e.sec && (x.parent || null) === (e.parent || null)).map(x => num(x.z) || 0));
// writes geometry (container px) into the model for the current device
export function setGeom(e, g, c) {
  c = c || containerOf(e); if (!c) return;
  const W = c.width || FREE_W;
  // phone view: top-level elements write their phone layout; children of boxes get their own phone geometry too (never the desktop one)
  if (isMobile() && !e.pin && e.parent) prepChildMob(e, c);
  const target = isMobile() && !e.pin ? (e.m ||= {}) : e;
  if (g.x !== undefined) target.x = round(g.x / W * 100, 3);
  if (g.y !== undefined) { target.y = Math.round(g.y); if (target === e && e.dock === 'b') { const secN = F.main.querySelector(`[data-cms-section="${e.sec}"]`); const hh = g.h ?? feNode(e.id)?.offsetHeight ?? 0; if (secN) e.yb = Math.round(secN.offsetHeight / (c.z || 1) - g.y - hh); } }
  if (g.w !== undefined) target.w = round(Math.max(1, g.w) / W * 100, 3);
  if (g.h !== undefined) target.h = g.h === 0 ? 0 : Math.round(Math.max(4, g.h));
  if (g.r !== undefined) target.r = round(g.r, 1);
}
function pinFromRect(e, n) {
  const r = n.getBoundingClientRect(), W = F.win.innerWidth, H = F.win.innerHeight;
  const at = e.pin.at || 'br';
  e.pin.ox = Math.round(at[1] === 'l' ? r.left : at[1] === 'r' ? W - r.right : r.left + r.width / 2 - W / 2);
  e.pin.oy = Math.round(at[0] === 't' ? r.top : at[0] === 'b' ? H - r.bottom : r.top + r.height / 2 - H / 2);
}
// in mobile view the elements of a section stack by default; the first manual move pins their current layout
function prepMobileAbs(secs) {
  for (const sid of secs) {
    const layer = F.main.querySelector(`[data-free="${sid}"]`); if (!layer || layer.classList.contains('mabs')) continue;
    const W = layer.clientWidth;
    for (const e of C().els.filter(x => x.sec === sid && !x.parent && !x.pin)) {
      const n = feNode(e.id); if (!n) continue;
      e.m = { ...(e.m || {}), x: round(n.offsetLeft / W * 100, 3), y: Math.round(n.offsetTop), w: round(n.offsetWidth / W * 100, 3), ...(num(e.h) ? { h: Math.round(n.offsetHeight) } : {}) };
    }
  }
  hooks.applyToFrame?.();
  toast('Mobile layout is now custom for this section');
}
/* ---------- snapping: element edges & centres, containers, guides, grid, equal spacing ---------- */
function snapCands(t, exclude = new Set()) {
  const tol = Math.max(1, num(S.snapTol) || 6), xs = [], ys = [], rects = [];
  let grid = null, z = 1;
  const addRect = r => { if (!r || (!r.width && !r.height)) return; xs.push(r.left, r.left + r.width / 2, r.right); ys.push(r.top, r.top + r.height / 2, r.bottom); rects.push(r); };
  const gstep = zz => Math.max(1, num(S.gridSize) || 10) * zz;
  if (t.type === 'fe') {
    const e = elById(t.id); const c = e && containerOf(e);
    if (c && !c.fixed) {
      z = c.z || 1; const W = c.width * z, H = (c.height || 0) * z;
      xs.push(c.left, c.left + W / 2, c.left + W); if (H) ys.push(c.top, c.top + H / 2, c.top + H);
      grid = { x: c.left, y: c.top, step: gstep(z) };
      if (!e.parent) { for (const x of S.guides.v || []) xs.push(c.left + x * z); const sn = F.main.querySelector(`[data-cms-section="${e.sec}"]`); if (sn) { const st = sn.getBoundingClientRect().top; for (const g of S.guides.h || []) if (g.sec === e.sec) ys.push(st + g.y * z); } }
      for (const o of C().els) { if (exclude.has(o.id) || o.id === e.id || o.sec !== e.sec || (o.parent || null) !== (e.parent || null) || o.pin) continue; const n = feNode(o.id); if (n) addRect(n.getBoundingClientRect()); }
    }
  } else if (t.type === 'el') {
    const n = elFor(t); const sec = n && sectionsEls().find(s => s.contains(n));
    if (sec) {
      const r = sec.getBoundingClientRect(); xs.push(r.left, r.left + r.width / 2, r.right); ys.push(r.top, r.top + r.height / 2, r.bottom);
      const lr = layerRect(sec); grid = { x: lr.left, y: lr.top, step: gstep(lr.z) }; z = 1;
      for (const x of S.guides.v || []) xs.push(lr.left + x * lr.z); for (const g of S.guides.h || []) if (g.sec === sec.dataset.cmsSection) ys.push(r.top + g.y * lr.z);
    }
    const p = n?.parentElement;
    if (p && p !== F.main && p !== sec) { const pr = p.getBoundingClientRect(); xs.push(pr.left, pr.left + pr.width / 2, pr.right); ys.push(pr.top, pr.top + pr.height / 2, pr.bottom); }
    if (p) for (const k of [...p.children].slice(0, 60)) if (k !== n && !k.classList.contains('cms-free')) addRect(k.getBoundingClientRect());
  }
  return { xs, ys, rects, grid, tol, z };
}
function near(vals, cands, tol) { let best = null; for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }; } return best; }
const gridSnap = (v, o, step) => Math.round((v - o) / step) * step + o;
// r: moving rect in screen px {L,T,R,B}; returns the snap offset, guide lines and equal-spacing marks
function snapMoveRect(r, cand, free) {
  const out = { dx: 0, dy: 0, lines: [], marks: [] };
  if (!cand) return out;
  let ex = null, ey = null;
  if (!free && S.snap) { ex = near([r.L, (r.L + r.R) / 2, r.R], cand.xs, cand.tol); ey = near([r.T, (r.T + r.B) / 2, r.B], cand.ys, cand.tol); }
  if (ex) out.dx = ex.d; else if (!free && S.snapGrid && cand.grid) out.dx = gridSnap(r.L, cand.grid.x, cand.grid.step) - r.L;
  if (ey) out.dy = ey.d; else if (!free && S.snapGrid && cand.grid) out.dy = gridSnap(r.T, cand.grid.y, cand.grid.step) - r.T;
  if (!free && S.smartSpacing) { const sp = spacingSnap({ L: r.L + out.dx, R: r.R + out.dx, T: r.T + out.dy, B: r.B + out.dy }, cand.rects, cand.tol); if (!ex && sp.dx !== null) out.dx += sp.dx; if (!ey && sp.dy !== null) out.dy += sp.dy; }
  const f = { L: r.L + out.dx, R: r.R + out.dx, T: r.T + out.dy, B: r.B + out.dy };
  if (S.smartGuides) {
    const lx = near([f.L, (f.L + f.R) / 2, f.R], cand.xs, 0.75), ly = near([f.T, (f.T + f.B) / 2, f.B], cand.ys, 0.75);
    if (lx) out.lines.push({ v: lx.at, a: 0, b: F.win.innerHeight });
    if (ly) out.lines.push({ h: ly.at, a: 0, b: F.win.innerWidth });
  }
  if (S.smartSpacing) out.marks = spacingMarks(f, cand.rects, cand.z || 1);
  return out;
}
const rowOf = (r, rects, ax) => ax === 'x' ? rects.filter(o => o.bottom > r.T + 1 && o.top < r.B - 1) : rects.filter(o => o.right > r.L + 1 && o.left < r.R - 1);
function gapsOf(list, ax) {
  const s = list.slice().sort((a, b) => ax === 'x' ? a.left - b.left : a.top - b.top), g = [];
  for (let i = 1; i < s.length; i++) { const v = ax === 'x' ? s[i].left - s[i - 1].right : s[i].top - s[i - 1].bottom; if (v > 0.5) g.push({ v, a: s[i - 1], b: s[i] }); }
  return g;
}
// equal gaps: centre between two neighbours, or copy a gap that already exists in the row / column
function spacingSnap(r, rects, tol) {
  const res = { dx: null, dy: null };
  for (const ax of ['x', 'y']) {
    const row = rowOf(r, rects, ax); if (!row.length) continue;
    const X = ax === 'x';
    const lo = X ? r.L : r.T, hi = X ? r.R : r.B;
    const before = row.filter(o => (X ? o.right : o.bottom) <= lo + tol).sort((a, b) => X ? b.right - a.right : b.bottom - a.bottom)[0];
    const after = row.filter(o => (X ? o.left : o.top) >= hi - tol).sort((a, b) => X ? a.left - b.left : a.top - b.top)[0];
    const g1 = before ? lo - (X ? before.right : before.bottom) : null, g2 = after ? (X ? after.left : after.top) - hi : null;
    let d = null;
    if (g1 > 0 && g2 > 0 && Math.abs(g1 - g2) <= tol * 2) d = (g2 - g1) / 2;
    else for (const g of gapsOf(row, ax)) {
      if (g1 > 0 && Math.abs(g.v - g1) <= tol && (d === null || Math.abs(g.v - g1) < Math.abs(d))) d = g.v - g1;
      if (g2 > 0 && Math.abs(g.v - g2) <= tol && (d === null || Math.abs(g2 - g.v) < Math.abs(d))) d = g2 - g.v;
    }
    if (X) res.dx = d; else res.dy = d;
  }
  return res;
}
// pink distance labels for every gap equal to a gap next to the moving element
function spacingMarks(r, rects, z) {
  const marks = [];
  for (const ax of ['x', 'y']) {
    const row = rowOf(r, rects, ax); if (!row.length) continue;
    const me = { left: r.L, right: r.R, top: r.T, bottom: r.B, me: true };
    const all = gapsOf([...row, me], ax);
    const shown = new Set();
    for (const m of all.filter(g => g.a.me || g.b.me)) { const eq = all.filter(g => Math.abs(g.v - m.v) < 1); if (eq.length >= 2) eq.forEach(g => shown.add(g)); }
    for (const g of shown) marks.push(ax === 'x'
      ? { gap: 'h', x1: g.a.right, x2: g.b.left, y: (Math.max(g.a.top, g.b.top) + Math.min(g.a.bottom, g.b.bottom)) / 2, label: Math.round(g.v / z) }
      : { gap: 'v', y1: g.a.bottom, y2: g.b.top, x: (Math.max(g.a.left, g.b.left) + Math.min(g.a.right, g.b.right)) / 2, label: Math.round(g.v / z) });
  }
  return marks;
}
// snaps the moving edges of a resized (unrotated) box
function snapResize(nb, h, cand, ratio) {
  if (!cand || Math.round(nb.r) % 360 !== 0) return nb;
  const [sx, sy] = hdSigns(h);
  let L = nb.cx - nb.w / 2, R = nb.cx + nb.w / 2, T = nb.cy - nb.h / 2, B = nb.cy + nb.h / 2;
  const lines = [];
  const pick = (v, list, gridO) => { const s = S.snap ? near([v], list, cand.tol) : null; if (s) return { ...s, el: true }; if (S.snapGrid && cand.grid) { const at = gridSnap(v, gridO, cand.grid.step); return { at, d: at - v }; } return null; };
  let snX = false, snY = false;
  if (sx) { const s = pick(sx > 0 ? R : L, cand.xs, cand.grid?.x); if (s && Math.abs(s.d) < nb.w - 4) { if (sx > 0) R = s.at; else L = s.at; snX = true; if (s.el && S.smartGuides) lines.push({ v: s.at, a: 0, b: F.win.innerHeight }); } }
  if (sy && !(ratio && snX)) { const s = pick(sy > 0 ? B : T, cand.ys, cand.grid?.y); if (s && Math.abs(s.d) < nb.h - 4) { if (sy > 0) B = s.at; else T = s.at; snY = true; if (s.el && S.smartGuides) lines.push({ h: s.at, a: 0, b: F.win.innerWidth }); } }
  if (ratio) {
    const r0 = nb.w / Math.max(0.01, nb.h);
    if (snX) { const H = (R - L) / r0; if (sy > 0) B = T + H; else if (sy < 0) T = B - H; else { const c = (T + B) / 2; T = c - H / 2; B = c + H / 2; } }
    else if (snY) { const W = (B - T) * r0; if (sx > 0) R = L + W; else if (sx < 0) L = R - W; else { const c = (L + R) / 2; L = c - W / 2; R = c + W / 2; } }
  }
  return { cx: (L + R) / 2, cy: (T + B) / 2, w: R - L, h: B - T, r: nb.r, lines };
}

/* ---------- resize / rotate (free elements and original page elements share the same math) ---------- */
const fixedH = e => !!num(isMobile() ? (e.m?.h ?? e.h) : e.h);
function startResize(e, h) {
  const t = S.sel; if (!t) return;
  if (h === 'rot') return startRotate(e, t);
  if (t.type === 'fe') { const el = elById(t.id); if (el) resizeFe(e, h, el); }
  else if (t.type === 'el') resizeEl(e, h, t);
}
function scaleFeText(el, f, fs0) {
  const k = styleKeyFeDev(); const s = el[k] = { ...(el[k] || {}) };
  s.fontSize = round(Math.max(6, Math.min(400, fs0 * f)), 1);
  if (num(s.letterSpacing)) s.letterSpacing = round(s.letterSpacing * f, 2);
}
function resizeFe(ev0, h, el) {
  const t = { type: 'fe', id: el.id };
  if (isLocked(t, 'size')) { toast('Size is locked'); return; }
  const scaleText = S.textScale && isTextTarget(t);
  const p0 = pt(ev0);
  let st = null;
  drag = { mode: 'resize', moved: true, t };
  const init = () => {
    if (isMobile() && !el.pin && !el.parent && !mobAbs(el)) prepMobileAbs([el.sec]);
    const g = geom(el), b = boxOf(t); if (!g || !b) return null;
    const inn = g.n.querySelector(':scope>.cms-a>.cms-in');
    const fs = parseFloat(F.win.getComputedStyle(inn || g.n).fontSize) || 16;
    const ig = el.kind === 'image' && el.p?.img && num(el.p.img.w) ? imgGeom(el) : null;
    return { g, b, inn, fs, ig, cand: el.pin ? null : snapCands(t, new Set([el.id])) };
  };
  listen(ev => {
    if (!drag) return;
    if (!st) { st = init(); if (!st) { drag = null; return; } }
    const { g, b } = st, c = g.c, z = c.z || 1;
    const ratio = scaleText || (!!el.keepRatio !== !!ev.shiftKey);
    let nb = resizeBox(b, h, ev.clientX - p0.x, ev.clientY - p0.y, { ratio, center: ev.altKey, minW: 8 * z, minH: 4 * z });
    guidesNow = [];
    if (!ev.altKey && !ev.ctrlKey && !ev.metaKey) { nb = snapResize(nb, h, st.cand, ratio); guidesNow = nb.lines || []; }
    const w = nb.w / z, hh = nb.h / z, x = (nb.cx - c.left) / z - w / 2, y = (nb.cy - c.top) / z - hh / 2;
    const vert = h !== 'e' && h !== 'w';
    const setH = scaleText ? fixedH(el) : (vert || fixedH(el));
    const n = feNode(el.id); if (!n) return;
    const f = nb.w / b.w;
    if (el.pin) { n.style.setProperty('width', w + 'px', 'important'); if (setH) n.style.setProperty('height', hh + 'px', 'important'); }
    else {
      for (const [p, v] of [['left', x + 'px'], ['top', y + 'px'], ['right', 'auto'], ['bottom', 'auto'], ['width', w + 'px']]) n.style.setProperty(p, v, 'important');
      if (setH) { n.style.setProperty('height', hh + 'px', 'important'); n.classList.remove('auto-h'); n.querySelectorAll(':scope>.cms-a,:scope>.cms-a>.cms-in').forEach(k => k.style.setProperty('height', '100%', 'important')); }
    }
    if (scaleText && st.inn) st.inn.style.setProperty('font-size', round(st.fs * f, 1) + 'px', 'important');
    if (st.ig) liveImgFor(el, imgAfterResize(st.ig, b, nb, z), n);
    drag.res = { x, y, w, h: hh, setH, f, nb };
    drag.label = scaleText ? `${round(st.fs * f, 1)}px text` : `${Math.round(w)} × ${Math.round(hh)}`;
    drawOverlay();
  }, () => {
    const r = drag?.res; drag = null; guidesNow = []; quiet();
    if (!r || !st) { drawOverlay(); return; }
    if (el.pin) { el.pin.w = Math.round(r.w); if (r.setH) el.h = Math.round(r.h); pinFromRect(el, feNode(el.id)); }
    else setGeom(el, { x: r.x, y: r.y, w: r.w, ...(r.setH ? { h: r.h } : {}) }, st.g.c);
    if (scaleText) scaleFeText(el, r.f, st.fs);
    if (st.ig) setImgGeom(el, imgAfterResize(st.ig, st.b, r.nb, st.g.c.z || 1));
    commit({ label: scaleText ? 'Scale text' : 'Resize ' + feName(el) });
  });
}
// original page elements: size goes to tf.w / tf.h, the translate keeps the dragged-from edge in place
function resizeEl(ev0, h, t) {
  if (isLocked(t, 'size')) { toast('Size is locked'); return; }
  const node = elFor(t); if (!node) return;
  const b = boxOf(t); if (!b) return;
  const attr = node.getAttribute('style');
  const ed = editFor(t.selector) || {};
  const tf0 = elTf(t.selector);
  const scaleText = S.textScale && isTextTarget(t);
  const media = /^(img|video|picture|svg)$/i.test(node.tagName);
  const keepRatio = typeof ed.keepRatio === 'boolean' ? ed.keepRatio : media;
  const st0 = siteTf(node), zm = b.z || 1;
  const asx = Math.abs(num(tf0.sx) ?? 1) * st0.sx * zm, asy = Math.abs(num(tf0.sy) ?? 1) * st0.sy * zm; // screen px per CSS px of width / height
  const cs = F.win.getComputedStyle(node);
  const fs0 = parseFloat(cs.fontSize) || 16, inline = cs.display === 'inline';
  const cand = snapCands(t);
  const p0 = pt(ev0);
  drag = { mode: 'resize', moved: true, t };
  listen(ev => {
    if (!drag) return;
    const ratio = scaleText || (keepRatio !== !!ev.shiftKey);
    let nb = resizeBox(b, h, ev.clientX - p0.x, ev.clientY - p0.y, { ratio, center: ev.altKey });
    guidesNow = [];
    if (!ev.altKey && !ev.ctrlKey && !ev.metaKey) { nb = snapResize(nb, h, cand, ratio); guidesNow = nb.lines || []; }
    const f = nb.w / b.w, vert = h !== 'e' && h !== 'w';
    const s = node.style;
    if (inline) s.setProperty('display', 'inline-block', 'important');
    let W = null, H = null;
    if (scaleText) { s.setProperty('font-size', round(fs0 * f, 1) + 'px', 'important'); if (num(tf0.w)) { W = num(tf0.w) * f; s.setProperty('width', W + 'px', 'important'); } }
    else {
      W = nb.w / asx; for (const [p, v] of [['width', W + 'px'], ['max-width', 'none'], ['min-width', '0'], ['box-sizing', 'border-box']]) s.setProperty(p, v, 'important');
      if (vert || media || num(tf0.h)) { H = nb.h / asy; for (const [p, v] of [['height', H + 'px'], ['max-height', 'none'], ['min-height', '0']]) s.setProperty(p, v, 'important'); }
    }
    // place the box the page really produced (the layout may not follow the requested size, e.g. a full-width heading)
    // so that the edge / corner opposite to the handle stays where it was
    const L = layoutRect(node), sz = layoutSize(node);
    const [hx, hy] = hdSigns(h);
    const pb = placeBox(b, hx, hy, sz.w * asx, sz.h * asy, ev.altKey);
    const tx = (pb.cx - (L.left + L.width / 2)) / zm, ty = (pb.cy - (L.top + L.height / 2)) / zm; // translate is in the element's own CSS px
    s.setProperty('translate', `${tx}px ${ty}px`, 'important');
    drag.res = { f, W, H, tx, ty };
    drag.label = scaleText ? `${round(fs0 * f, 1)}px text` : `${Math.round(W ?? sz.w)} × ${Math.round(H ?? sz.h)}`;
    drawOverlay();
  }, () => {
    const r = drag?.res; drag = null; guidesNow = []; quiet();
    restoreStyle(node, attr);
    if (!r) { drawOverlay(); return; }
    const patch = { x: Math.round(r.tx), y: Math.round(r.ty) };
    if (r.W) patch.w = Math.round(r.W); if (r.H) patch.h = Math.round(r.H);
    setElTf(t.selector, patch);
    if (scaleText) { const k = styleKeyEl(); const x = editFor(t.selector, true); x[k] = { ...(x[k] || {}), fontSize: round(Math.max(6, Math.min(400, fs0 * r.f)), 1) }; }
    commit({ label: scaleText ? 'Scale text' : 'Resize page element' });
  });
}
function startRotate(ev0, t) {
  if (isLocked(t, 'rot')) { toast('Rotation is locked'); return; }
  const fe = t.type === 'fe' ? elById(t.id) : null;
  if (fe?.pin) return;
  const b = boxOf(t); if (!b) return;
  const node0 = elFor(t), attr = node0?.getAttribute('style');
  const a0 = Math.atan2(ev0.clientY - b.cy, ev0.clientX - b.cx) * 180 / Math.PI;
  let moved = false;
  drag = { mode: 'rotate', moved: true, t, a: b.r };
  listen(ev => {
    if (!drag) return;
    if (!moved) { moved = true; if (fe && isMobile() && !fe.parent && !mobAbs(fe)) prepMobileAbs([fe.sec]); }
    let a = b.r + Math.atan2(ev.clientY - b.cy, ev.clientX - b.cx) * 180 / Math.PI - a0;
    a = ((a + 180) % 360 + 360) % 360 - 180;
    if (ev.shiftKey) a = Math.round(a / 15) * 15; // only with Shift: steps of 15°
    drag.a = round(a, 1); drag.label = `${Math.round(drag.a)}°`;
    const n = elFor(t); if (fe) n?.style.setProperty('transform', `rotate(${drag.a}deg)`, 'important'); else n?.style.setProperty('rotate', `${drag.a}deg`, 'important');
    drawOverlay();
  }, () => {
    const a = drag?.a; drag = null; quiet();
    if (!fe) restoreStyle(node0, attr);
    if (!moved || a === undefined) { drawOverlay(); return; }
    if (fe) setRot(fe, a); else setElTf(t.selector, { r: round(a - siteTf(node0).r, 1) }); // the site's own rotation is not stored
    commit({ label: 'Rotate' });
  });
}
// several free elements: scale or rotate the whole selection around its shared box (one undo step)
function startMulti(ev0, h) {
  const all = S.multi.map(elById).filter(e => e && !e.pin);
  const items0 = all.filter(e => h === 'rot' ? !feLocked(e.id, 'rot') && !feLocked(e.id, 'pos') : !(feLocked(e.id, 'pos') && feLocked(e.id, 'size')));
  if (!items0.length) { toast('These elements are locked'); return; }
  const p0 = pt(ev0); let st = null;
  drag = { mode: h === 'rot' ? 'mrotate' : 'mresize', moved: true };
  const init = () => {
    if (isMobile()) { const secs = [...new Set(items0.filter(e => !e.parent && !mobAbs(e)).map(e => e.sec))]; if (secs.length) prepMobileAbs(secs); }
    const items = items0.map(e => { const t = { type: 'fe', id: e.id }; const b = boxOf(t), c = containerOf(e), g = geom(e); if (!b || !c || !g) return null; const inn = g.n.querySelector(':scope>.cms-a>.cms-in'); return { e, t, b, c, fs: parseFloat(F.win.getComputedStyle(inn || g.n).fontSize) || 16 }; }).filter(Boolean);
    const U = unionRect(items.map(i => i.e.id)); if (!U || !items.length) return null;
    const ub = { cx: (U.L + U.R) / 2, cy: (U.T + U.B) / 2, w: U.R - U.L, h: U.B - U.T, r: 0 };
    return { items, ub, a0: Math.atan2(ev0.clientY - ub.cy, ev0.clientX - ub.cx) * 180 / Math.PI, anyRot: items.some(i => Math.round(i.b.r) % 360) };
  };
  listen(ev => {
    if (!drag) return;
    if (!st) { st = init(); if (!st) { drag = null; return; } }
    const { items, ub } = st, out = [];
    if (h === 'rot') {
      let d = Math.atan2(ev.clientY - ub.cy, ev.clientX - ub.cx) * 180 / Math.PI - st.a0; if (ev.shiftKey) d = Math.round(d / 15) * 15;
      for (const i of items) { const [x, y] = rotV(i.b.cx - ub.cx, i.b.cy - ub.cy, rad(d)); out.push({ i, cx: ub.cx + x, cy: ub.cy + y, w: i.b.w, h: i.b.h, r: round(((i.b.r + d + 180) % 360 + 360) % 360 - 180, 1), f: 1 }); }
      drag.label = `${Math.round(d)}°`;
    } else {
      const nu = resizeBox(ub, h, ev.clientX - p0.x, ev.clientY - p0.y, { ratio: st.anyRot || ev.shiftKey || S.textScale, center: ev.altKey, minW: 12, minH: 12 });
      const fx = nu.w / ub.w, fy = nu.h / ub.h;
      for (const i of items) {
        const posL = feLocked(i.e.id, 'pos'), sizeL = feLocked(i.e.id, 'size');
        out.push({ i, cx: posL ? i.b.cx : nu.cx + (i.b.cx - ub.cx) * fx, cy: posL ? i.b.cy : nu.cy + (i.b.cy - ub.cy) * fy, w: sizeL ? i.b.w : i.b.w * fx, h: sizeL ? i.b.h : i.b.h * fy, r: i.b.r, f: sizeL ? 1 : fx });
      }
      drag.label = `${Math.round(fx * 100)}% × ${Math.round(fy * 100)}%`;
    }
    for (const o of out) {
      const e = o.i.e, n = feNode(e.id); if (!n) continue; const z = o.i.c.z || 1;
      const w = o.w / z, hh = o.h / z, x = (o.cx - o.i.c.left) / z - w / 2, y = (o.cy - o.i.c.top) / z - hh / 2;
      o.m = { x, y, w, h: hh };
      for (const [p, v] of [['left', x + 'px'], ['top', y + 'px'], ['right', 'auto'], ['bottom', 'auto']]) n.style.setProperty(p, v, 'important');
      if (h === 'rot') n.style.setProperty('transform', `rotate(${o.r}deg)`, 'important');
      else {
        n.style.setProperty('width', w + 'px', 'important'); if (fixedH(e)) n.style.setProperty('height', hh + 'px', 'important');
        if (S.textScale && isTextTarget(o.i.t)) n.querySelector(':scope>.cms-a>.cms-in')?.style.setProperty('font-size', round(o.i.fs * o.f, 1) + 'px', 'important');
      }
    }
    drag.out = out; drawOverlay();
  }, () => {
    const out = drag?.out; drag = null; quiet();
    if (!out) { drawOverlay(); return; }
    for (const o of out) {
      const e = o.i.e;
      if (h === 'rot') { setGeom(e, { x: o.m.x, y: o.m.y }, o.i.c); setRot(e, o.r); }
      else { setGeom(e, { x: o.m.x, y: o.m.y, w: o.m.w, ...(fixedH(e) ? { h: o.m.h } : {}) }, o.i.c); if (S.textScale && isTextTarget(o.i.t) && o.f !== 1) scaleFeText(e, o.f, o.i.fs); }
    }
    commit({ label: (h === 'rot' ? 'Rotate ' : 'Scale ') + out.length + ' elements' });
  });
}
// moving an original page element: translate (per device), with the same snapping as free elements
function startElMove(e, t) {
  if (isLocked(t, 'pos')) { const p0 = pt(e); let told = false; listen(ev => { if (!told && Math.hypot(ev.clientX - p0.x, ev.clientY - p0.y) > 6) { told = true; toast('Position is locked (Layout › Lock)'); } }, () => { if (told) quiet(); }); return; }
  const node = elFor(t); if (!node) return;
  const tf0 = elTf(t.selector); const x0 = num(tf0.x) || 0, y0 = num(tf0.y) || 0;
  const attr = node.getAttribute('style');
  const p0 = pt(e);
  let moved = false;
  drag = { mode: 'move', moved: false, t };
  listen(ev => {
    if (!drag) return;
    const dx = ev.clientX - p0.x, dy = ev.clientY - p0.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) { moved = true; drag.moved = true; const r = node.getBoundingClientRect(); drag.r0 = { L: r.left, T: r.top, R: r.right, B: r.bottom }; drag.cand = snapCands(t); drag.zm = elZoom(node); }
    const r0 = drag.r0;
    const s = snapMoveRect({ L: r0.L + dx, T: r0.T + dy, R: r0.R + dx, B: r0.B + dy }, drag.cand, ev.altKey);
    guidesNow = s.lines.concat(s.marks);
    const vx = Math.round(x0 + (dx + s.dx) / drag.zm), vy = Math.round(y0 + (dy + s.dy) / drag.zm);
    node.style.setProperty('translate', `${vx}px ${vy}px`, 'important');
    drag.v = { x: vx, y: vy }; drag.label = `X ${vx}  Y ${vy}`;
    drawOverlay();
  }, () => {
    const v = drag?.v; drag = null; guidesNow = [];
    restoreStyle(node, attr); // the inline preview never outlives the drag (undo and the Layout fields keep working)
    if (!moved || !v) { drawOverlay(); return; }
    quiet();
    setElTf(t.selector, { x: v.x, y: v.y });
    commit({ label: 'Move page element' });
  });
}
function startMarquee(e, add) {
  const p0 = pt(e); let on = false;
  listen(ev => {
    if (!on && Math.hypot(ev.clientX - p0.x, ev.clientY - p0.y) < 5) return;
    if (!on) { on = true; marq = { x0: p0.x, y0: p0.y, x1: p0.x, y1: p0.y }; }
    marq.x1 = ev.clientX; marq.y1 = ev.clientY; drawOverlay();
  }, () => {
    if (!on || !marq) return;
    const L = Math.min(marq.x0, marq.x1), R = Math.max(marq.x0, marq.x1), T = Math.min(marq.y0, marq.y1), B = Math.max(marq.y0, marq.y1);
    marq = null; quiet();
    const iso = isoTop();
    const pool = iso ? C().els.filter(x => iso.type === 'box' ? x.parent === iso.id : x.group === iso.id) : C().els.filter(x => !x.parent);
    const ids = pool.filter(x => { const r = feNode(x.id)?.getBoundingClientRect(); return r && r.width && r.left >= L && r.right <= R && r.top >= T && r.bottom <= B; }).map(x => x.id);
    if (add) for (const id of S.multi) if (!ids.includes(id)) ids.unshift(id);
    if (ids.length) selectMany(ids); else drawOverlay();
  });
}

/* ---------- image content mode: move / zoom / rotate the photo inside an unchanged box ---------- */
// content geometry in model px of the box: iw/ih image size, cx/cy image centre relative to the box centre, r rotation
function imgGeom(e) {
  const n = feNode(e.id), inn = n?.querySelector(':scope>.cms-a>.cms-in'), img = inn?.querySelector('img'); if (!img) return null;
  const Bw = inn.offsetWidth || 1, Bh = inn.offsetHeight || 1, nw = img.naturalWidth || 1600, nh = img.naturalHeight || 1000;
  const p = e.p || {};
  if (p.img && num(p.img.w)) { const iw = num(p.img.w) / 100 * Bw; return { Bw, Bh, nw, nh, iw, ih: iw / (num(p.img.ar) || nw / nh), cx: (num(p.img.x) || 0) / 100 * Bw, cy: (num(p.img.y) || 0) / 100 * Bw, r: num(p.img.r) || 0 }; }
  // an older crop maps the crop rectangle onto the box (possibly stretched): the same picture, now as size + offset (+ aspect)
  if (p.crop) { const c = p.crop, cw = Math.max(1, num(c.w) || 100), ch = Math.max(1, num(c.h) || 100); const iw = Bw * 100 / cw, ih = Bh * 100 / ch; const fx = ((num(c.x) || 0) + cw / 2) / 100, fy = ((num(c.y) || 0) + ch / 2) / 100; return { Bw, Bh, nw, nh, iw, ih, cx: iw * (0.5 - fx), cy: ih * (0.5 - fy), r: 0 }; }
  const st = e.style || {}, fit = st.objectFit || 'cover';
  const k = fit === 'contain' || fit === 'scale-down' ? Math.min(Bw / nw, Bh / nh) : fit === 'none' ? 1 : Math.max(Bw / nw, Bh / nh);
  const iw = nw * k, ih = nh * k;
  const px = num(st.objectPosition) !== null ? num(st.objectPosition) / 100 : 0.5, py = num(st.objectPosition) !== null ? (num(st.objectPosY) ?? 50) / 100 : 0.5;
  const left = (Bw - iw) * px, top = (Bh - ih) * py;
  return { Bw, Bh, nw, nh, iw, ih, cx: left + iw / 2 - Bw / 2, cy: top + ih / 2 - Bh / 2, r: 0 };
}
// ar is kept only when the photo is shown stretched (from an older crop); otherwise its own proportions are used
const imgPct = g => { const ar = g.iw / Math.max(0.01, g.ih), nat = (g.nw || 1) / (g.nh || 1); return { w: round(g.iw / g.Bw * 100, 3), x: round(g.cx / g.Bw * 100, 3), y: round(g.cy / g.Bw * 100, 3), r: round(g.r || 0, 1), ...(Math.abs(ar / nat - 1) > 0.005 ? { ar: round(ar, 4) } : {}) }; };
function setImgGeom(e, g) { const p = { ...(e.p || {}) }; delete p.crop; p.img = imgPct(g); if (!p.img.r) delete p.img.r; e.p = p; }
function liveImgFor(e, g, n) {
  const img = (n || feNode(e.id))?.querySelector('.cms-imgc img'); if (!img) return false;
  const q = imgPct(g); img.style.width = q.w + '%'; img.style.aspectRatio = q.ar ? String(q.ar) : ''; img.style.marginLeft = q.x + '%'; img.style.marginTop = q.y + '%'; img.style.transform = `translate(-50%,-50%)${q.r ? ` rotate(${q.r}deg)` : ''}`;
  return true;
}
// keeps the photo where it is on the page while its box is resized (it does not scale with the box)
function imgAfterResize(ig, b, nb, z) {
  const a = rad(b.r);
  const [ox, oy] = rotV(ig.cx * z, ig.cy * z, a);
  const [lx, ly] = rotV(b.cx + ox - nb.cx, b.cy + oy - nb.cy, -a);
  return { ...ig, Bw: nb.w / z, Bh: nb.h / z, cx: lx / z, cy: ly / z };
}
const imgFitOf = e => e.p?.img ? 'custom' : e.p?.crop ? 'crop' : (e.style?.objectFit || 'cover');
export function startImgEdit(id) {
  const e = elById(id); if (!e || e.kind !== 'image' || !e.p?.src) return;
  if (isLocked({ type: 'fe', id }, 'style')) { toast('This image is locked'); return; }
  finishInline();
  if (S.sel?.id !== id || S.multi.length > 1) { S.multi = [id]; S.sel = { type: 'fe', id }; }
  S.imgEdit = { id };
  drawOverlay(); hooks.renderInspector?.();
  toast('Drag to move the photo · corners or the mouse wheel zoom · Esc or Done when finished');
}
export function endImgEdit() { if (!S.imgEdit) return; clearTimeout(imgWheel.t); flushLive(); S.imgEdit = null; drawOverlay(); hooks.renderInspector?.(); }
export function imgPreset(k) {
  const e = elById(S.imgEdit?.id || S.sel?.id); if (!e || e.kind !== 'image') return;
  if (k === 'original') { const g = imgGeom(e); if (!g) return; setImgGeom(e, { ...g, iw: g.nw, ih: g.nh, cx: 0, cy: 0, r: 0 }); }
  else {
    const p = { ...(e.p || {}) }, st = { ...(e.style || {}) }; delete p.img; delete p.crop; e.p = p;
    if (k === 'reset') { delete st.objectFit; delete st.objectPosition; delete st.objectPosY; } else st.objectFit = k;
    e.style = st;
  }
  commit({ keepInspector: true, label: 'Photo: ' + ({ cover: 'fill box', contain: 'fit in box', fill: 'stretch', original: 'original size', reset: 'reset' }[k] || k) });
}
function imgEditParts(parts) {
  const e = elById(S.imgEdit.id); const b = e && boxOf({ type: 'fe', id: e.id }); const g = e && imgGeom(e);
  if (!b || !g) return;
  const z = b.z, a = rad(b.r);
  const [ox, oy] = rotV(g.cx * z, g.cy * z, a);
  const iw = g.iw * z, ih = g.ih * z, icx = b.cx + ox, icy = b.cy + oy, ir = b.r + (g.r || 0);
  parts.push(`<div class="ximgbox" style="left:${b.cx - b.w / 2}px;top:${b.cy - b.h / 2}px;width:${b.w}px;height:${b.h}px;${b.r ? `transform:rotate(${b.r}deg)` : ''}"></div>`);
  parts.push(`<div class="ximgw" style="left:${icx - iw / 2}px;top:${icy - ih / 2}px;width:${iw}px;height:${ih}px;${ir ? `transform:rotate(${ir}deg)` : ''}"><img src="${esc(e.p.src)}" alt="">${['nw', 'ne', 'se', 'sw'].map(h => `<span class="xhd" data-ih="${h}" style="left:${h.includes('w') ? 0 : 100}%;top:${h.includes('n') ? 0 : 100}%"></span>`).join('')}<span class="xrotl"></span><span class="xhd" data-ih="rot" style="left:50%;top:-26px"></span></div>`);
  const fit = imgFitOf(e);
  const top = Math.max(8, Math.min(b.cy - b.h / 2, icy - ih / 2) - 52);
  parts.push(`<div class="ximgtb" style="left:${b.cx}px;top:${top}px">${[['cover', 'Fill'], ['contain', 'Fit'], ['fill', 'Stretch'], ['original', 'Original size'], ['reset', 'Reset']].map(([k, l]) => `<button data-act="imgfit:${k}" class="${fit === k ? 'on' : ''}" title="${l}">${l}</button>`).join('')}<button data-act="imgdone" class="done">Done</button></div>`);
  if (drag?.label) parts.push(`<span class="xdim" style="position:fixed;left:${b.cx}px;top:${b.cy + b.h / 2 + 8}px;bottom:auto">${esc(drag.label)}</span>`);
}
function startImgDrag(ev0, mode) {
  const e = elById(S.imgEdit?.id); if (!e) return;
  const b = boxOf({ type: 'fe', id: e.id }), g0 = imgGeom(e); if (!b || !g0) return;
  const z = b.z, a = rad(b.r);
  const [ox, oy] = rotV(g0.cx * z, g0.cy * z, a); const icx = b.cx + ox, icy = b.cy + oy;
  const p0 = pt(ev0);
  const d0 = Math.hypot(p0.x - icx, p0.y - icy) || 1, ang0 = Math.atan2(p0.y - icy, p0.x - icx) * 180 / Math.PI;
  let first = true;
  drag = { mode: 'img', moved: true };
  listen(ev => {
    if (!drag) return;
    const g = { ...g0 };
    if (mode === 'pan') { const [lx, ly] = rotV(ev.clientX - p0.x, ev.clientY - p0.y, -a); g.cx = g0.cx + lx / z; g.cy = g0.cy + ly / z; drag.label = 'Move photo'; }
    else if (mode === 'rot') { let r = (g0.r || 0) + Math.atan2(ev.clientY - icy, ev.clientX - icx) * 180 / Math.PI - ang0; if (ev.shiftKey) r = Math.round(r / 15) * 15; g.r = round(((r + 180) % 360 + 360) % 360 - 180, 1); drag.label = `${Math.round(g.r)}°`; }
    else { const s = Math.max(0.02, Math.hypot(ev.clientX - icx, ev.clientY - icy) / d0); g.iw = g0.iw * s; g.ih = g0.ih * s; drag.label = `Zoom ${Math.round(g.iw / g.nw * 100)}%`; }
    setImgGeom(e, g); // the model follows; the page is updated directly (one undo step at the end)
    if (first || !liveImgFor(e, g)) { first = false; hooks.applyToFrame?.(); }
    drag.g = g; drawOverlay();
  }, () => { const g = drag?.g; drag = null; quiet(); if (!g) { drawOverlay(); return; } setImgGeom(e, g); commit({ keepInspector: true, label: mode === 'pan' ? 'Move photo' : mode === 'rot' ? 'Rotate photo' : 'Zoom photo' }); });
}
function imgWheel(ev) {
  const e = elById(S.imgEdit?.id); if (!e) return;
  const g = imgGeom(e); if (!g) return;
  const s = Math.exp(-ev.deltaY * 0.0015); g.iw *= s; g.ih *= s;
  setImgGeom(e, g); if (!liveImgFor(e, g)) hooks.applyToFrame?.();
  S.liveDirty = true; drawOverlay();
  clearTimeout(imgWheel.t); imgWheel.t = setTimeout(() => commit({ keepInspector: true, label: 'Zoom photo' }), 450);
}

/* ---------- isolation mode (inside a box or a group) and breadcrumbs ---------- */
function insideIso(t) {
  const iso = isoTop(); if (!iso || !t) return true;
  if (t.type !== 'fe') return false;
  return iso.type === 'box' ? isDescendant(t.id, iso.id) : elById(t.id)?.group === iso.id || C().els.some(m => m.group === iso.id && isDescendant(t.id, m.id));
}
function isoContains(target) {
  const iso = isoTop(); if (!iso || !target?.closest) return false;
  if (iso.type === 'box') { const n = feNode(iso.id); return !!n && n.contains(target); }
  const fe = target.closest('.cms-el'); return !!fe && elById(fe.dataset.el)?.group === iso.id;
}
export function enterIso(x, selectT) {
  S.iso = [...S.iso, x]; S.imgEdit = null;
  if (selectT) select(selectT, { single: true }); else { S.sel = null; S.multi = []; drawOverlay(); hooks.renderInspector?.(); }
  toast(x.type === 'box' ? 'Editing inside the box — Esc or Exit to leave' : 'Editing inside the group — Esc or Exit to leave');
}
export function exitIso() {
  const x = S.iso.pop(); if (!x) return;
  if (x.type === 'box') select({ type: 'fe', id: x.id }, { single: true });
  else { const ids = C().els.filter(e => e.group === x.id).map(e => e.id); if (ids.length) selectMany(ids); else select(null); }
}
function onDblClick(ev) {
  const top = resolve(ev.target, false);
  if (!top) return;
  if (top.type === 'fe') {
    const e = elById(top.id); if (!e) return;
    if (e.kind === 'box') {
      // double-click a box: work inside it (outside dimmed); the element under the pointer is selected
      enterIso({ type: 'box', id: e.id });
      const inner = resolve(ev.target, false);
      if (inner) { select(inner, { single: true }); if (isTextTarget(inner)) startInline(); }
      return;
    }
    if (e.group && isoTop()?.type !== 'group') { enterIso({ type: 'group', id: e.group }, { type: 'fe', id: e.id }); if (isTextTarget(top)) startInline(); return; }
    if (key(S.sel) !== key(top) || S.multi.length > 1) select(top, { single: true });
    if (e.kind === 'image' && e.p?.src) { startImgEdit(e.id); return; }
    startInline(); return;
  }
  if (top.type === 'section' || top.type === 'block') { select(top); S.tab = 'design'; hooks.renderInspector?.(); hooks.flashInspector?.(); return; }
  if (key(S.sel) !== key(top)) select(top);
  const n = elFor(top);
  if (top.type === 'el' && (n?.tagName === 'IMG' || n?.tagName === 'VIDEO')) { S.tab = 'design'; hooks.renderInspector?.(); hooks.flashInspector?.(); return; }
  startInline();
}
let crumbsH = '';
export function renderCrumbs() {
  const bar = document.querySelector('[data-crumbs]'); if (!bar) return;
  if (!bar._wired) {
    bar._wired = true;
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-crumb]'); if (!b) return;
      const k = b.dataset.crumb;
      if (k === 'exit') { exitIso(); return; }
      if (k === 'page') { S.iso = []; select(null); return; }
      if (k.startsWith('sec:')) { const id = k.slice(4); S.iso = []; select({ type: isBlock(id) ? 'block' : 'section', id }); return; }
      if (k.startsWith('fe:')) { const id = k.slice(3); S.iso = S.iso.filter(x => x.type === 'box' ? isDescendant(id, x.id) : elById(id)?.group === x.id); select({ type: 'fe', id }, { single: true }); }
    });
  }
  const t = S.sel, iso = isoTop();
  // the bar keeps its place (no jump of the page under the pointer when the selection changes); hidden only in Preview
  if (S.preview) { bar.hidden = true; crumbsH = ''; return; }
  bar.hidden = false;
  if (!t && !iso) { const h = '<button type="button" data-crumb="page" class="cur">Page</button><span class="crhint">Click any element to select it · double-click to edit inside</span>'; if (h !== crumbsH) { crumbsH = h; bar.innerHTML = h; } return; }
  const items = [['Page', 'page']];
  const secId = t ? secIdOf(t) : iso?.type === 'box' ? elById(iso.id)?.sec : C().els.find(e => e.group === iso?.id)?.sec;
  if (secId) { const sn = F.main?.querySelector(`[data-cms-section="${secId}"]`); items.push([isBlock(secId) ? (blockById(secId)?.title || KIND_NAME[blockById(secId)?.kind] || 'Section') : sectionName(sn) || 'Section', 'sec:' + secId]); }
  const chain = [];
  const startE = t?.type === 'fe' ? elById(t.id) : (!t && iso?.type === 'box' ? { parent: iso.id } : null);
  for (let e = startE; e?.parent;) { e = elById(e.parent); if (e) chain.unshift(e); }
  for (const b of chain) items.push([feName(b), 'fe:' + b.id]);
  if (t) items.push([S.multi.length > 1 ? S.multi.length + ' elements' : labelFor(t, elFor(t)), 'cur']);
  const html = `${items.map(([l, k]) => `<button type="button" data-crumb="${esc(k)}" class="${k === 'cur' ? 'cur' : ''}">${esc(String(l).slice(0, 40))}</button>`).join('<i>›</i>')}${iso ? `<span class="isotag">${iso.type === 'box' ? 'Inside box' : 'Inside group'}</span><button type="button" class="isoexit" data-crumb="exit" title="Leave (Esc)">Exit</button>` : ''}`;
  bar.hidden = false;
  if (html !== crumbsH) { crumbsH = html; bar.innerHTML = html; }
}
function startGuide(e, gd, ru) {
  const sid = ru?.dataset.sec || (gd && gd.dataset.guide.split(':')[1]) || secIdOf(S.sel) || sectionsEls()[0]?.dataset.cmsSection;
  const secN = F.main.querySelector(`[data-cms-section="${sid}"]`) || sectionAt(e.clientY);
  if (!secN) return;
  const lr = layerRect(secN);
  let kind = ru ? ru.dataset.ruler : gd.dataset.guide[0];
  if (gd) { const [k, a, b] = gd.dataset.guide.split(':'); if (k === 'v') S.guides.v = S.guides.v.filter(x => String(x) !== a); else S.guides.h = S.guides.h.filter(x => !(x.sec === a && String(x.y) === b)); }
  const tmp = { v: kind === 'v' ? null : undefined };
  listen(ev => {
    guidesNow = [kind === 'v' ? { v: ev.clientX, a: 0, b: F.win.innerHeight } : { h: ev.clientY, a: 0, b: F.win.innerWidth }];
    drawOverlay();
  }, ev => {
    guidesNow = [];
    const onRuler = kind === 'v' ? ev.clientY < 20 : ev.clientX < 20;
    if (!onRuler) {
      if (kind === 'v') S.guides.v.push(Math.round((ev.clientX - lr.left) / lr.z));
      else { const sn = sectionAt(ev.clientY) || secN; S.guides.h.push({ sec: sn.dataset.cmsSection, y: Math.round((ev.clientY - sn.getBoundingClientRect().top) / layerRect(sn).z) }); }
    }
    prefs('guides:' + S.path, S.guides);
    drawOverlay();
  });
}

/* ---------- element operations ---------- */
function targetSectionFor(at) {
  if (at?.sec) return at.sec;
  if (at?.clientY !== undefined) return sectionAt(at.clientY)?.dataset.cmsSection;
  if (S._addTarget && F.main.querySelector(`[data-cms-section="${S._addTarget}"]`)) { const s = S._addTarget; S._addTarget = null; return s; }
  const fromSel = secIdOf(S.sel); if (fromSel) return fromSel;
  // the section in the middle of the screen
  return (sectionAt(F.win.innerHeight / 2) || sectionsEls()[0])?.dataset.cmsSection;
}
export function addElement(keyOrObj, at = {}) {
  const def = typeof keyOrObj === 'string' ? ELEMENTS.find(x => x.key === keyOrObj) : null;
  const base = def ? def.make() : clone(keyOrObj);
  const sid = targetSectionFor(at);
  if (!sid) { toast('Add a section first', true); return; }
  const secN = F.main.querySelector(`[data-cms-section="${sid}"]`);
  const lr = layerRect(secN), sr = secN.getBoundingClientRect();
  const wpx = Math.min(base.w || 300, FREE_W), hpx = base.h ?? 100;
  const e = { id: uid('e'), sec: sid, ...base };
  if (e.pin) { e.w = round(wpx / FREE_W * 100, 3); e.z = 50; }
  else {
    let x, y;
    const z = lr.z || 1, LW = lr.width || FREE_W;
    if (at.clientX !== undefined) { x = (at.clientX - lr.left) / z - wpx / 2; y = (at.clientY - sr.top) / z - (hpx || 40) / 2; }
    else { x = (LW - wpx) / 2; const visTop = Math.max(0, -sr.top), visBot = Math.min(sr.height, F.win.innerHeight - sr.top); const mid = (visTop + visBot) / 2 / z; y = Math.max(20, Math.min(Math.max(20, sr.height / z - (hpx || 60) - 20), mid - (hpx || 60) / 2)); }
    if (e.full) x = 0;
    if (at.clientX === undefined) {
      // don't drop new elements on top of each other
      const sibs = C().els.filter(o => o.sec === sid && !o.parent && !o.pin).map(o => feNode(o.id)).filter(Boolean).map(n => ({ l: n.offsetLeft, t: n.offsetTop, r: n.offsetLeft + n.offsetWidth, b: n.offsetTop + n.offsetHeight }));
      for (let i = 0; i <= sibs.length; i++) { const hit = sibs.find(r => x < r.r && x + wpx > r.l && y < r.b && y + Math.max(hpx || 40, 40) > r.t); if (!hit) break; y = hit.b + 16; }
    }
    e.x = round(Math.max(-20, Math.min(100, x / LW * 100)), 3); e.y = Math.round(Math.max(0, y)); e.w = round(Math.min(wpx, LW) / LW * 100, 3); e.h = hpx;
    e.z = maxZ(e) + 1;
  }
  // mobile: add to the stack unless the section has a custom mobile layout
  C().els.push(e);
  commit();
  select({ type: 'fe', id: e.id }, { single: true });
  if (['image', 'vector'].includes(e.kind) && !e.p?.src) pickMedia(u => { e.p = { ...e.p, src: u }; commit(); }, { kind: e.kind === 'vector' ? 'vector' : 'image' });
  else if (e.kind === 'lottie' && !e.p?.src) pickMedia(u => { e.p = { ...e.p, src: u }; commit(); }, { kind: 'lottie' });
  else if (e.kind === 'audio' && !e.p?.src) pickMedia(u => { e.p = { ...e.p, src: u }; commit(); }, { kind: 'audio' });
  else if (e.kind === 'text') setTimeout(() => { if (S.sel?.id === e.id) startInline(); }, 120);
  if (secN.getBoundingClientRect().bottom < 0 || secN.getBoundingClientRect().top > F.win.innerHeight) setTimeout(scrollToSel, 60);
  toast((def?.name || EL_NAME[e.kind]) + ' added');
  return e;
}
function descendants(id) { const out = []; const walk = p => C().els.filter(x => x.parent === p).forEach(x => { out.push(x); walk(x.id); }); walk(id); return out; }
const withDesc = roots => [...roots, ...roots.flatMap(r => descendants(r.id))].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
function cloneEls(all, { offset = 0, sec } = {}) {
  const map = {}; for (const e of all) map[e.id] = uid('e');
  const gmap = {};
  return all.map(e => {
    const n = clone(e); n.id = map[e.id];
    const isRoot = !n.parent || !map[n.parent];
    if (n.parent) { if (map[n.parent]) n.parent = map[n.parent]; else if (sec) delete n.parent; }
    if (sec) n.sec = sec;
    if (n.group) n.group = gmap[n.group] ||= uid('g');
    if (offset && isRoot) { if (n.pin) { n.pin.ox = (num(n.pin.ox) || 0) + offset; n.pin.oy = (num(n.pin.oy) || 0) + offset; } else { n.y = (num(n.y) || 0) + offset; n.x = round((num(n.x) || 0) + offset / FREE_W * 100, 3); } }
    delete n.locked;
    return n;
  });
}
export function duplicate() {
  const t = S.sel; if (!t) return;
  if (t.type === 'block') { duplicateBlock(t.id); return; }
  if (t.type !== 'fe') { toast('Original page elements can’t be duplicated — add a new element instead'); return; }
  const roots = S.multi.map(elById).filter(e => e && !S.multi.includes(e.parent));
  const copies = cloneEls(withDesc(roots), { offset: 24 });
  for (const c of copies) if (!c.parent || !copies.some(x => x.id === c.parent)) c.z = maxZ(c) + 1;
  C().els.push(...copies);
  commit();
  selectMany(copies.filter(c => !copies.some(x => x.id === c.parent)).map(c => c.id));
  toast('Duplicated');
}
export function removeSelected() {
  const t = S.sel; if (!t) return;
  if (t.type === 'fe') {
    const ids = new Set(S.multi.length ? S.multi : [t.id]);
    if ([...ids].some(id => elById(id)?.locked)) { toast('Unlock the element first'); return; }
    for (const id of [...ids]) descendants(id).forEach(d => ids.add(d.id));
    C().els = C().els.filter(e => !ids.has(e.id));
    S.sel = null; S.multi = []; commit(); toast('Deleted — Ctrl+Z to undo');
  } else if (t.type === 'block') deleteBlock(t.id);
  else if (t.type === 'el') { toggleHidden(t); }
  else if (t.type === 'section') toggleHidden(t);
}
export function zOrder(dir, extreme) {
  const ids = S.multi; if (!ids.length) return;
  for (const id of ids) {
    const e = elById(id); const sibs = C().els.filter(x => x.sec === e.sec && (x.parent || null) === (e.parent || null) && !!x.pin === !!e.pin).sort((a, b) => (num(a.z) || 0) - (num(b.z) || 0));
    const i = sibs.indexOf(e); sibs.splice(i, 1);
    const j = extreme ? (dir > 0 ? sibs.length : 0) : Math.max(0, Math.min(sibs.length, i + dir));
    sibs.splice(j, 0, e);
    sibs.forEach((x, k) => x.z = k + 1);
  }
  commit();
}
export function toggleLock() {
  const t = S.sel; if (!t) return;
  if (t.type === 'el') { const e = editFor(t.selector, true); const on = !e.locked; if (on) { e.locked = true; delete e.lock; } else { delete e.locked; delete e.lock; } commit({ label: on ? 'Lock' : 'Unlock' }); toast(on ? 'Locked' : 'Unlocked'); return; }
  const ids = S.multi; const on = !ids.every(id => elById(id)?.locked);
  ids.forEach(id => { const e = elById(id); if (!e) return; if (on) { e.locked = true; delete e.lock; } else { delete e.locked; delete e.lock; } });
  commit({ label: on ? 'Lock' : 'Unlock' }); toast(on ? 'Locked' : 'Unlocked');
}
// one part of the lock: pos | size | rot | style (all four = fully locked)
export function setLockPart(t, k, on) {
  const objs = t.type === 'fe' ? S.multi.map(elById).filter(Boolean) : t.type === 'el' ? [editFor(t.selector, true)] : [];
  for (const o of objs) {
    let l = o.locked ? { pos: true, size: true, rot: true, style: true } : { ...(o.lock || {}) };
    if (on) l[k] = true; else delete l[k];
    delete o.locked; delete o.lock;
    if (['pos', 'size', 'rot', 'style'].every(x => l[x])) o.locked = true; else if (Object.keys(l).length) o.lock = l;
  }
  commit({ label: on ? 'Lock' : 'Unlock' });
}
export function toggleTextScale() { S.textScale = !S.textScale; prefs('textScale', S.textScale); drawOverlay(); hooks.renderInspector?.(); toast(S.textScale ? 'Handles now scale the text (font size follows) — K to switch back' : 'Handles now resize the text box — K to switch'); }
export function flip(ax) {
  const t = S.sel; if (!t) return; const k = ax === 'x' ? 'fx' : 'fy';
  if (t.type === 'fe') { const ids = S.multi.filter(id => !feLocked(id, 'rot')); if (!ids.length) { toast('Rotation is locked'); return; } ids.forEach(id => { const e = elById(id); if (e[k]) delete e[k]; else e[k] = true; }); commit({ label: ax === 'x' ? 'Flip horizontally' : 'Flip vertically' }); return; }
  if (t.type === 'el') { if (isLocked(t, 'rot')) { toast('Rotation is locked'); return; } setElTf(t.selector, { [k]: !elTf(t.selector)[k] }); commit({ label: ax === 'x' ? 'Flip horizontally' : 'Flip vertically' }); }
}
export function togglePin() {
  const e = elById(S.sel?.id); if (!e) return;
  if (e.pin) { const r = feNode(e.id).getBoundingClientRect(); delete e.pin; const secN = sectionAt(F.win.innerHeight / 2) || F.main.querySelector(`[data-cms-section="${e.sec}"]`); e.sec = secN.dataset.cmsSection; delete e.parent; const lr = layerRect(secN); setGeom(e, { x: (r.left - lr.left) / lr.z, y: (r.top - lr.top) / lr.z, w: r.width / lr.z }, lr); toast('Unpinned'); }
  else { const n = feNode(e.id); const r = n.getBoundingClientRect(); e.pin = { at: 'br', w: Math.round(r.width) }; delete e.parent; pinFromRect(e, n); toast('Pinned to the screen — it stays visible while scrolling'); }
  commit();
}
export function group() { if (S.multi.length < 2) return; const g = uid('g'); S.multi.forEach(id => elById(id).group = g); commit(); toast('Grouped'); }
export function ungroup() { S.multi.forEach(id => delete elById(id).group); commit(); toast('Ungrouped'); }
export function align(a) {
  const ids = S.multi; if (!ids.length) return;
  // phones: aligning arranges the section freely, so it gets its own phone layout first (as dragging does)
  if (isMobile()) { const secs = [...new Set(ids.map(elById).filter(e => e && !e.pin && !e.parent && !mobAbs(e)).map(e => e.sec))]; if (secs.length) prepMobileAbs(secs); }
  const all = ids.map(id => ({ e: elById(id), g: geom(elById(id)) })).filter(i => i.g && !i.e.pin && !inFlow(i.e));
  const movable = i => !feLocked(i.e.id, 'pos');
  if (!all.length) return;
  if (!all.some(movable)) { toast('Position is locked'); return; }
  const single = all.length === 1;
  const c = all[0].g.c;
  const L = single ? 0 : Math.min(...all.map(i => i.g.x)), R = single ? c.width : Math.max(...all.map(i => i.g.x + i.g.w));
  const secH = single ? ((F.main.querySelector(`[data-cms-section="${all[0].e.sec}"]`)?.offsetHeight || 0) / (c.z || 1) || c.height) : 0;
  const T = single ? 0 : Math.min(...all.map(i => i.g.y)), B = single ? (all[0].e.parent ? c.height : secH) : Math.max(...all.map(i => i.g.y + i.g.h));
  if (a === 'distH' || a === 'distV') {
    const hz = a === 'distH'; const sorted = [...all].sort((p, q) => hz ? p.g.x - q.g.x : p.g.y - q.g.y);
    const total = sorted.reduce((s, i) => s + (hz ? i.g.w : i.g.h), 0); const span = hz ? R - L : B - T; const gap = (span - total) / (sorted.length - 1);
    let pos = hz ? L : T; for (const i of sorted) { if (movable(i)) setGeom(i.e, hz ? { x: pos } : { y: pos }, i.g.c); pos += (hz ? i.g.w : i.g.h) + gap; }
  } else for (const i of all.filter(movable)) {
    if (a === 'alignL') setGeom(i.e, { x: L }, i.g.c); if (a === 'alignR') setGeom(i.e, { x: R - i.g.w }, i.g.c); if (a === 'alignC') setGeom(i.e, { x: (L + R) / 2 - i.g.w / 2 }, i.g.c);
    if (a === 'alignT') setGeom(i.e, { y: T }, i.g.c); if (a === 'alignB') setGeom(i.e, { y: B - i.g.h }, i.g.c); if (a === 'alignM') setGeom(i.e, { y: (T + B) / 2 - i.g.h / 2 }, i.g.c);
  }
  commit({ label: { alignL: 'Align left', alignC: 'Align centre', alignR: 'Align right', alignT: 'Align top', alignM: 'Align middle', alignB: 'Align bottom', distH: 'Distribute horizontally', distV: 'Distribute vertically' }[a] });
}
export function nudge(dx, dy) {
  const t = S.sel; if (!t) return;
  if (t.type === 'el') { if (isLocked(t, 'pos')) { toast('Position is locked'); return; } const tf = elTf(t.selector); setElTf(t.selector, { x: (num(tf.x) || 0) + dx, y: (num(tf.y) || 0) + dy }); }
  else if (t.type === 'fe') {
    let any = false;
    for (const id of S.multi) { const e = elById(id); if (!e || feLocked(id, 'pos') || inFlow(e)) continue; any = true; if (e.pin) { const at = e.pin.at || 'br'; e.pin.ox = (num(e.pin.ox) || 0) + (at[1] === 'r' ? -dx : dx); e.pin.oy = (num(e.pin.oy) || 0) + (at[0] === 'b' ? -dy : dy); continue; } if (isMobile() && !e.parent && !mobAbs(e)) prepMobileAbs([e.sec]); const g = geom(e); if (g) setGeom(e, { x: g.x + dx, y: g.y + dy }, g.c); }
    if (!any) { toast('Position is locked'); return; }
  } else return;
  // a burst of arrow presses is one undo step
  clearTimeout(nudge.t); commit({ live: true }); nudge.t = setTimeout(() => commit({ keepInspector: false, label: 'Nudge' }), 350);
}
export function copySel(cut) {
  const t = S.sel; if (!t) return;
  if (t.type === 'fe') { const roots = S.multi.map(elById).filter(e => e && !S.multi.includes(e.parent)); clipSet({ type: 'els', els: withDesc(roots).map(clone) }); toast(cut ? 'Cut' : 'Copied — paste on any page with Ctrl+V'); if (cut) removeSelected(); return; }
  if (t.type === 'block') { clipSet({ type: 'block', block: clone(blockById(t.id)), els: C().els.filter(e => e.sec === t.id).map(clone) }); toast('Section copied — paste it on any page'); if (cut) deleteBlock(t.id); return; }
  if (t.type === 'section') { const els = C().els.filter(e => e.sec === t.id); clipSet({ type: 'section', section: clone(sectionFor(t.id) || { id: t.id }), els: els.map(clone) }); toast(els.length ? 'Section design and elements copied' : 'Section design copied'); return; }
  copyStyle();
}
export function paste() {
  const c = clipGet(); if (!c) { toast('Nothing to paste'); return; }
  if (c.type === 'style') { pasteStyle(); return; }
  if (c.type === 'els') {
    const sid = targetSectionFor({});
    const same = c.els.some(e => e.sec === sid && elById(e.id));
    const copies = cloneEls(c.els, { sec: sid, offset: same ? 24 : 0 });
    copies.forEach(e => { if (!e.parent) e.z = maxZ(e) + 1; });
    C().els.push(...copies); commit();
    selectMany(copies.filter(x => !x.parent).map(x => x.id)); toast('Pasted');
    return;
  }
  if (c.type === 'block' || c.type === 'section') {
    if (c.type === 'section' && S.sel && (S.sel.type === 'section' || S.sel.type === 'block')) {
      // paste the design onto the selected section
      const d = secData(S.sel.id, true); if (c.section?.style) d.style = clone(c.section.style); if (c.section?.fx) d.fx = clone(c.section.fx); if (c.section?.anim) d.anim = clone(c.section.anim);
      if (c.els?.length) C().els.push(...cloneEls(c.els, { sec: S.sel.id }));
      commit(); toast('Section design pasted'); return;
    }
    const b = c.block ? { ...clone(c.block), id: uid('b') } : { ...preset('blank'), style: clone(c.section?.style || {}), fx: clone(c.section?.fx || {}) };
    C().blocks.push(b);
    const order = currentOrder(); const selSec = secIdOf(S.sel); const idx = selSec && order.includes(selSec) ? order.indexOf(selSec) + 1 : order.length;
    order.splice(idx, 0, b.id); C().sectionOrder = order;
    if (c.els?.length) C().els.push(...cloneEls(c.els, { sec: b.id }));
    commit(); select({ type: 'block', id: b.id }); setTimeout(scrollToSel, 60); toast('Section pasted');
  }
}
export function copyStyle() {
  const t = S.sel; if (!t) return;
  let v;
  if (t.type === 'fe') { const e = elById(t.id); v = { style: clone(e.style || {}), hov: clone(e.hov || {}), act: clone(e.act || {}), anim: clone(e.anim || {}) }; }
  else if (t.type === 'el') { const e = editFor(t.selector) || {}; v = { style: clone(e.style || {}), hov: clone(e.hov || {}), anim: clone(e.anim || {}) }; }
  else if (t.type === 'section' || t.type === 'block') { const d = secData(t.id) || {}; v = { style: clone(d.style || {}), fx: clone(d.fx || {}), anim: clone(d.anim || {}), sec: true }; }
  if (!v) return;
  clipSet({ type: 'style', ...v }); toast('Design copied — select another element and press Ctrl+Alt+V');
}
export function pasteStyle() {
  const c = clipGet(); if (!c || c.type !== 'style') { toast('Copy a design first (Ctrl+Alt+C)'); return; }
  const t = S.sel; if (!t) return;
  if (t.type === 'fe') for (const id of S.multi) { const e = elById(id); e.style = clone(c.style || {}); if (c.hov) e.hov = clone(c.hov); if (c.act) e.act = clone(c.act); if (c.anim && !c.sec) e.anim = clone(c.anim); }
  else if (t.type === 'el') { const e = editFor(t.selector, true); e.style = clone(c.style || {}); if (c.hov) e.hov = clone(c.hov); if (c.anim && !c.sec) e.anim = clone(c.anim); }
  else if (t.type === 'section' || t.type === 'block') { const d = secData(t.id, true); d.style = clone(c.style || {}); if (c.fx) d.fx = clone(c.fx); if (c.anim) d.anim = clone(c.anim); }
  commit(); toast('Design pasted');
}

/* ---------- sections ---------- */
export function dropPoint(y) {
  const secs = sectionsEls().filter(s => s.offsetParent !== null || s.getClientRects().length);
  const mr = F.main.getBoundingClientRect();
  let index = secs.length, line = secs.length ? secs[secs.length - 1].getBoundingClientRect().bottom : mr.top + 40;
  for (let i = 0; i < secs.length; i++) { const r = secs[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { index = i; line = r.top; break; } }
  return { index, y: Math.max(4, Math.min(F.win.innerHeight - 4, line)), left: mr.left + 8, width: mr.width - 16 };
}
export function currentOrder() { return sectionsEls().map(s => s.dataset.cmsSection); }
export function insertBlock(kind, index, extra) {
  const b = typeof kind === 'object' ? kind : preset(kind);
  if (extra) Object.assign(b, extra);
  const order = currentOrder();
  if (index === undefined || index === null) {
    const selSec = secIdOf(S.sel);
    index = selSec && order.includes(selSec) ? order.indexOf(selSec) + 1 : order.length;
  }
  C().blocks.push(b);
  order.splice(index, 0, b.id);
  C().sectionOrder = order;
  commit();
  select({ type: 'block', id: b.id }); S.tab = 'content'; hooks.renderInspector?.();
  setTimeout(scrollToSel, 60);
  toast((KIND_NAME[b.kind] || 'Section') + ' added');
  return b;
}
export function moveSection(id, dir) {
  const order = currentOrder(); const i = order.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  C().sectionOrder = order; commit(); setTimeout(scrollToSel, 30);
}
export function reorder(id, beforeId) {
  const order = currentOrder().filter(x => x !== id);
  const k = beforeId ? order.indexOf(beforeId) : order.length;
  order.splice(k < 0 ? order.length : k, 0, id);
  C().sectionOrder = order; commit();
}
export function toggleHidden(t) {
  const mob = isMobile();
  if (t.type === 'fe') { for (const id of S.multi.length ? S.multi : [t.id]) { const e = elById(id); if (mob) { e.m = e.m || {}; e.m.hide = !e.m.hide; } else { e.hideD = !e.hideD; } } }
  else if (t.type === 'block') { const b = blockById(t.id); if (mob) { b.mobile = b.mobile || {}; b.mobile.hidden = !b.mobile.hidden; } else { b.fx = b.fx || {}; b.fx.hideD = !b.fx.hideD; } }
  else if (t.type === 'section') { const s = sectionFor(t.id, true); if (mob) { s.mobile = s.mobile || {}; s.mobile.hidden = !s.mobile.hidden; } else { s.fx = s.fx || {}; s.fx.hideD = !s.fx.hideD; } }
  else if (t.type === 'el') { const e = editFor(t.selector, true); if (mob) { e.mobile = e.mobile || {}; e.mobile.hidden = !e.mobile.hidden; } else { e.hideD = !e.hideD; } }
  commit();
  toast(mob ? 'Visibility on mobile changed' : 'Visibility on desktop changed');
}
export function isHidden(t) {
  const mob = isMobile();
  if (t.type === 'fe') { const e = elById(t.id); return !!(e && (mob ? e.m?.hide : e.hideD)); }
  if (t.type === 'block') { const b = blockById(t.id); return !!(b && (b.hidden || (mob ? b.mobile?.hidden : b.fx?.hideD))); }
  if (t.type === 'section') { const s = sectionFor(t.id); return !!(s && (s.hidden || (mob ? s.mobile?.hidden : s.fx?.hideD))); }
  const e = editFor(t.selector); return !!(e && (e.hidden || (mob ? e.mobile?.hidden : e.hideD)));
}
export function duplicateBlock(id) {
  const b = blockById(id); if (!b) return;
  const n = { ...clone(b), id: uid('b') };
  C().blocks.push(n);
  const order = currentOrder(); order.splice(order.indexOf(id) + 1, 0, n.id); C().sectionOrder = order;
  C().els.push(...cloneEls(C().els.filter(e => e.sec === id), { sec: n.id }));
  commit(); select({ type: 'block', id: n.id }); setTimeout(scrollToSel, 50); toast('Section duplicated');
}
export function deleteBlock(id) {
  C().blocks = C().blocks.filter(b => b.id !== id);
  C().sectionOrder = C().sectionOrder.filter(x => x !== id);
  C().sections = C().sections.filter(s => s.id !== id);
  C().els = C().els.filter(e => e.sec !== id);
  S.sel = null; S.multi = []; commit(); toast('Section deleted — Ctrl+Z to undo');
}
export function setField(id, field, value, silent) {
  const b = blockById(id); if (!b) return;
  const m = field.match(/^items\.(\d+)\.(\w+)$/);
  if (m) { b.items = b.items || []; b.items[+m[1]] = { ...(b.items[+m[1]] || {}), [m[2]]: value }; }
  else b[field] = value;
  if (!silent) commit();
}
export function setImage(t, url) {
  if (t.type === 'fe') { const e = elById(t.id); e.p = { ...(e.p || {}), src: url }; commit(); }
  else if (t.type === 'el') { const e = editFor(t.selector, true); e.type = 'image'; e.value = url; commit(); }
  else if (t.type === 'field') setField(t.id, t.field, url);
  else if (t.type === 'block') { const b = blockById(t.id); if ('image' in b || /image/.test(b.kind)) setField(t.id, 'image', url); }
}
export function saveTemplate(id) {
  const b = blockById(id); const s = !b && sectionFor(id);
  promptBox('Save section as a template', 'Template name', b?.title || 'My section', async name => {
    if (!name) return;
    try { const r = await api('/site/templates/save', { name, block: b ? clone(b) : undefined, section: !b ? clone(s || { id }) : undefined, els: C().els.filter(e => e.sec === id).map(clone) }); S.templates = r.templates; toast('Template saved — find it under Add › Saved'); }
    catch (e) { toast(e.message, true); }
  }, { yes: 'Save template' });
}

/* ---------- context menu ---------- */
let ctxEl = null;
export function closeCtx() { ctxEl?.remove(); ctxEl = null; }
export function contextMenu(cx, cy) {
  closeCtx();
  const t = S.sel;
  const fr = $('[data-frame]').getBoundingClientRect();
  const sc = (S.zoom || 1);
  const clip = clipGet();
  const items = [];
  const it = (label, kb, fn, o = {}) => items.push({ label, kb, fn, ...o });
  const sep = () => items.push('-');
  if (t?.type === 'fe') {
    const e = elById(t.id) || {};
    it('Copy', 'Ctrl+C', () => copySel()); it('Cut', 'Ctrl+X', () => copySel(true)); it('Paste', 'Ctrl+V', paste, { off: !clip }); it('Duplicate', 'Ctrl+D', duplicate); it('Delete', 'Del', removeSelected); sep();
    it('Copy design', 'Ctrl+Alt+C', copyStyle); it('Paste design', 'Ctrl+Alt+V', pasteStyle, { off: clip?.type !== 'style' }); sep();
    it('Bring to front', 'Ctrl+Shift+]', () => zOrder(1, true)); it('Bring forward', 'Ctrl+]', () => zOrder(1)); it('Send backward', 'Ctrl+[', () => zOrder(-1)); it('Send to back', 'Ctrl+Shift+[', () => zOrder(-1, true)); sep();
    if (S.multi.length > 1) it('Group', 'Ctrl+G', group); if (e.group) it('Ungroup', 'Ctrl+Shift+G', ungroup);
    it(e.locked ? 'Unlock' : 'Lock', 'Ctrl+L', toggleLock); it(isHidden(t) ? 'Show' : (isMobile() ? 'Hide on mobile' : 'Hide on desktop'), 'Ctrl+H', () => toggleHidden(t)); it(e.pin ? 'Unpin' : 'Pin to screen', '', togglePin);
    it('Flip horizontally', '', () => flip('x')); it('Flip vertically', '', () => flip('y'));
    if (e.kind === 'image' && e.p?.src) it('Adjust photo inside the box', 'Double-click', () => startImgEdit(e.id));
    if (e.kind === 'box') it('Edit inside the box', 'Double-click', () => enterIso({ type: 'box', id: e.id }));
    if (e.group && isoTop()?.type !== 'group') it('Edit inside the group', 'Double-click', () => enterIso({ type: 'group', id: e.group }, { type: 'fe', id: e.id }));
    if (S.iso.length) it('Leave isolation', 'Esc', exitIso);
    if (e.parent) it('Select parent box', '', () => select({ type: 'fe', id: e.parent }, { single: true }));
    it('Select section', '', () => select({ type: isBlock(e.sec) ? 'block' : 'section', id: e.sec }));
  } else if (t?.type === 'section' || t?.type === 'block') {
    it('Add element here', '', () => { S._addTarget = t.id; hooks.openPanel?.('add'); });
    it('Copy section', 'Ctrl+C', () => copySel()); if (t.type === 'block') it('Cut section', 'Ctrl+X', () => copySel(true));
    it('Paste', 'Ctrl+V', paste, { off: !clip }); if (t.type === 'block') it('Duplicate', 'Ctrl+D', () => duplicateBlock(t.id));
    it('Save as template', '', () => saveTemplate(t.id)); sep();
    it('Copy design', 'Ctrl+Alt+C', copyStyle); it('Paste design', 'Ctrl+Alt+V', pasteStyle, { off: clip?.type !== 'style' }); sep();
    it('Move up', '', () => moveSection(t.id, -1)); it('Move down', '', () => moveSection(t.id, 1));
    it(isHidden(t) ? 'Show section' : (isMobile() ? 'Hide on mobile' : 'Hide on desktop'), '', () => toggleHidden(t));
    it('Select all elements', 'Ctrl+A', () => selectMany(C().els.filter(e => e.sec === t.id && !e.parent).map(e => e.id)), { off: !C().els.some(e => e.sec === t.id) });
    if (t.type === 'block') it('Delete section', 'Del', () => deleteBlock(t.id), { danger: true });
  } else if (t?.type === 'el' || t?.type === 'field') {
    it('Edit text', 'Enter', startInline); it('Copy design', 'Ctrl+Alt+C', copyStyle); it('Paste design', 'Ctrl+Alt+V', pasteStyle, { off: clip?.type !== 'style' }); sep();
    if (t.type === 'el') { it('Select parent', '', selectParent); it(isHidden(t) ? 'Show' : 'Hide', 'Ctrl+H', () => toggleHidden(t)); it(lockOf(t).all ? 'Unlock' : 'Lock', 'Ctrl+L', toggleLock); it('Flip horizontally', '', () => flip('x')); it('Flip vertically', '', () => flip('y')); it('Reset to original', '', () => { C().edits = C().edits.filter(e => e.selector !== t.selector); commit({ label: 'Reset page element' }); }); }
    it('Paste element here', 'Ctrl+V', paste, { off: !clip || clip.type === 'style' });
  } else it('Paste', 'Ctrl+V', paste, { off: !clip });
  ctxEl = document.createElement('div'); ctxEl.className = 'ctx';
  ctxEl.innerHTML = items.map((x, i) => x === '-' ? '<hr>' : `<button data-i="${i}" ${x.off ? 'disabled' : ''} class="${x.danger ? 'danger' : ''}"><span>${esc(x.label)}</span><kbd>${esc(x.kb || '')}</kbd></button>`).join('');
  document.body.append(ctxEl);
  const W = ctxEl.offsetWidth, H = ctxEl.offsetHeight;
  let x = fr.left + cx * sc, y = fr.top + cy * sc;
  if (x + W > innerWidth - 8) x = innerWidth - W - 8; if (y + H > innerHeight - 8) y = Math.max(8, innerHeight - H - 8);
  ctxEl.style.left = x + 'px'; ctxEl.style.top = y + 'px';
  ctxEl.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; closeCtx(); items[+b.dataset.i].fn(); };
  setTimeout(() => { addEventListener('mousedown', function h(e) { if (!ctxEl?.contains(e.target)) { closeCtx(); removeEventListener('mousedown', h, true); } }, true); F.doc?.addEventListener('mousedown', function h2() { closeCtx(); F.doc?.removeEventListener('mousedown', h2, true); }, true); }, 0);
}

/* ---------- keyboard ---------- */
export function onKey(e) {
  // sliders, switches and colour pickers keep the editor shortcuts (Ctrl+Z…); text fields keep their own
  const typing = e.target.isContentEditable || /^(TEXTAREA|SELECT)$/.test(e.target.tagName) || (e.target.tagName === 'INPUT' && !/^(range|checkbox|radio|color|button|submit)$/.test(e.target.type));
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  // a focused control keeps the keys it uses itself: a slider its arrows, buttons / switches / Layers rows Enter and Space, Layers rows their arrows
  const tg = e.target, isCtl = tg.tagName === 'BUTTON' || tg.tagName === 'INPUT' || !!tg.closest?.('[role="button"],.layers li[tabindex],.hist');
  const own = !typing && !mod && ((isCtl && (e.key === 'Enter' || e.key === ' ')) || (tg.tagName === 'INPUT' && tg.type === 'range' && /^(Arrow|Home|End|Page)/.test(e.key)) || (!!tg.closest?.('.layers li[tabindex]') && /^Arrow/.test(e.key)));
  if (own) return;
  if (e.key === 'Escape') { closeCtx(); if (typing) return; if (S.preview) hooks.setPreview?.(false); else if (S.imgEdit) endImgEdit(); else if (S.iso.length) exitIso(); else if (S.multi.length > 1) select(S.sel, { single: true }); else select(null); return; }
  if (typing) { if (mod && k === 's') { e.preventDefault(); save(); toast('Saved'); } return; }
  const fe = S.sel?.type === 'fe';
  const run = f => { e.preventDefault(); f(); };
  if (mod && k === 'z') return run(() => e.shiftKey ? redo() : undo());
  if (mod && k === 'y') return run(redo);
  if (mod && k === 's') return run(() => { save(); toast('Saved'); });
  if (mod && e.altKey && k === 'c') return run(copyStyle);
  if (mod && e.altKey && k === 'v') return run(pasteStyle);
  if (mod && k === 'c') return run(() => copySel());
  if (mod && k === 'x') return run(() => copySel(true));
  if (mod && k === 'v') return run(paste);
  if (mod && k === 'd') return run(duplicate);
  if (mod && k === 'g') return run(() => e.shiftKey ? ungroup() : group());
  if (mod && k === 'l' && (fe || S.sel?.type === 'el')) return run(toggleLock);
  if (mod && k === 'h' && S.sel) return run(() => toggleHidden(S.sel));
  if (mod && (e.key === ']' || e.key === '}') && fe) return run(() => zOrder(1, e.shiftKey));
  if (mod && (e.key === '[' || e.key === '{') && fe) return run(() => zOrder(-1, e.shiftKey));
  if (mod && k === 'a') {
    const iso = isoTop();
    // select all in the active editing context: the isolated box / group, or the section
    const ids = iso ? C().els.filter(x => iso.type === 'box' ? x.parent === iso.id : x.group === iso.id).map(x => x.id) : (() => { const sid = secIdOf(S.sel) || sectionAt(F.win.innerHeight / 2)?.dataset.cmsSection; return C().els.filter(x => x.sec === sid && !x.parent).map(x => x.id); })();
    if (ids.length) return run(() => selectMany(ids)); return;
  }
  if (mod && k === 'p') return run(() => hooks.setPreview?.(!S.preview));
  if ((e.key === 'Delete' || e.key === 'Backspace') && (fe || S.sel?.type === 'block')) return run(removeSelected);
  if (e.key === 'Enter' && fe && elById(S.sel.id)?.kind === 'box' && S.multi.length === 1) return run(() => enterIso({ type: 'box', id: S.sel.id }));
  if (e.key === 'Enter' && fe && elById(S.sel.id)?.kind === 'image' && S.multi.length === 1 && !S.imgEdit) return run(() => startImgEdit(S.sel.id));
  if (e.key === 'Enter' && S.sel && (fe || S.sel.type === 'el' || S.sel.type === 'field')) return run(startInline);
  if (e.key.startsWith('Arrow') && (fe || S.sel?.type === 'el')) { const s = e.shiftKey ? 10 : 1; return run(() => nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0)); }
  if (e.key === '?' || (mod && k === '/')) return run(() => hooks.shortcuts?.());
  if (!mod && k === 'g' && !e.shiftKey) return run(() => { const on = !(S.grid && S.snapGrid); S.grid = on; S.snapGrid = on; prefs('grid', on); prefs('snapGrid', on); hooks.syncTop?.(); drawOverlay(); toast(on ? `Grid on (${S.gridSize}px) — elements snap to it` : 'Grid off'); });
  if (!mod && k === 'k' && !e.shiftKey) return run(toggleTextScale);
  if (!mod && k === 'r') return run(() => { S.rulers = !S.rulers; prefs('rulers', S.rulers); hooks.syncTop?.(); drawOverlay(); });
}

/* ---------- frame/page lifecycle ---------- */
export function applyToFrame() {
  if (!F.main) return;
  try { RT.apply(F.main, C(), { seo: false, editing: true }); } catch (e) { console.error(e); }
  F.main.querySelectorAll('.cms-added-section a, .cms-added-section button, .cms-free a, .cms-free button, .cms-free input, .cms-free textarea, .cms-free select').forEach(a => a.setAttribute('tabindex', '-1'));
  drawOverlay();
}
hooks.applyToFrame = applyToFrame;
// after a save, the editor may switch to the server's cleaned-up version — never in the middle of typing or dragging
hooks.canResync = () => !inlineState && !drag && !S.imgEdit && !document.activeElement?.closest?.('.insp,.panel');
hooks.drawOverlay = drawOverlay;
export function playAnimations(target) {
  if (!F.doc) return;
  const html = F.doc.documentElement;
  const nodes = target ? [elFor(target)].filter(Boolean) : [...F.doc.querySelectorAll('[data-ain],[data-cms-ain]')];
  nodes.forEach(n => n.classList.remove('cms-av'));
  html.classList.add('cms-playing'); void html.offsetWidth;
  nodes.forEach(n => n.classList.add('cms-av'));
  clearTimeout(playAnimations.t); playAnimations.t = setTimeout(() => html.classList.remove('cms-playing'), 4000);
}
