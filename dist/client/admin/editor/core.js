/* Satin editor — shared state, API, content model and history. */
import * as RT from '/cms/runtime.mjs?v=6';
export { RT };
// The public site imports the runtime without a version: refresh this browser's cached copy so Preview and the live page run the same code.
try { fetch('/cms/runtime.mjs', { cache: 'reload', credentials: 'same-origin' }).catch(() => { }); } catch { }

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = RT.esc;
export const clone = o => JSON.parse(JSON.stringify(o));
export const uid = p => p + Math.random().toString(36).slice(2, 8);
export const num = v => typeof v === 'number' ? v : v === '' || v === null || v === undefined || isNaN(v) ? null : Number(v);
export const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/* ---------- state ---------- */
export const S = {
  me: null, csrf: '', perms: [], canPublish: false,
  pages: [], path: '/satin', content: null, rev: 0, hasDraft: false, published: false, publishedAt: null,
  stable: new Set(), undo: [], redo: [], sel: null, multi: [], hover: null,
  device: 'desktop', panel: null, tab: 'settings', state: 'normal', preview: false,
  dirty: false, saving: false, saveTimer: 0, frameReady: false,
  theme: null, themeDirty: false, menu: null, media: null, siteImages: [], templates: null,
  grid: false, snap: true, rulers: true, guides: { v: [], h: [] }, fonts: [],
  // snapping: grid drawn + snap to grid share gridSize; tolerance in screen px
  snapGrid: false, smartGuides: true, smartSpacing: true, gridSize: 10, snapTol: 6,
  textScale: false, // text: false = resize the text box, true = scale the text (font size follows the handles)
  iso: [], // isolation stack: [{type:'box'|'group', id}]
  imgEdit: null // image content mode: { id }
};
export const F = { win: null, doc: null, main: null };
export const hooks = {}; // filled in by other modules: renderInspector, renderPanel, drawOverlay, applyToFrame

/* ---------- api ---------- */
export async function api(path, body, opts = {}) {
  const o = body === undefined ? {} : body instanceof FormData ? { method: 'POST', headers: { 'X-CSRF-Token': S.csrf }, body } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': S.csrf }, body: JSON.stringify(body) };
  const r = await fetch('/api/admin' + path, { credentials: 'same-origin', ...o, ...opts });
  let d = {}; try { d = await r.json(); } catch { }
  if (r.status === 401) { location.href = '/admin/#/login'; throw new Error('Please sign in again.'); }
  if (!r.ok) { const e = new Error(d.error || (r.status === 413 ? 'The file is too large for the server.' : 'Something went wrong.')); e.status = r.status; e.data = d; throw e; }
  return d;
}
export function toast(msg, err) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.className = 'on' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = '', err ? 4200 : 2400); }

/* ---------- icons ---------- */
export const P = {
  plus: '<path d="M12 5v14M5 12h14"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>', pages: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h10"/>', theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', seo: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', desktop: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>', mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>', popup: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M17 7h.01"/>', film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>', grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 18l-6-6 6-6"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v6H4V5h6"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  left: '<path d="M4 6h16M4 12h10M4 18h13"/>', center: '<path d="M4 6h16M7 12h10M5 18h14"/>', right: '<path d="M4 6h16M10 12h10M7 18h13"/>', justify: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  parent: '<path d="M9 10l3-3 3 3"/><path d="M12 7v10"/><rect x="4" y="3" width="16" height="18" rx="2"/>', reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>', check: '<path d="M5 12l5 5 9-10"/>',
  brush: '<path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 9.4 12z"/><path d="M9 13c-2 0-4 1.5-4 4 0 1.5-1 2.5-2 3 3 1 7 0 8-3"/>', anim: '<path d="M4 12c3-6 5-6 8 0s5 6 8 0"/><circle cx="4" cy="12" r="1.5"/><circle cx="20" cy="12" r="1.5"/>',
  arrange: '<rect x="3" y="3" width="11" height="11" rx="1.5"/><rect x="10" y="10" width="11" height="11" rx="1.5"/>', pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>', grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>', ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/><path d="M6 7h4M14 7h4"/>',
  group: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/><path d="M3 15v6h6M21 9V3h-6" stroke-dasharray="2 2"/>', ungroup: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>',
  front: '<rect x="8" y="8" width="12" height="12" rx="1.5" fill="currentColor"/><path d="M4 16V4h12"/>', back2: '<rect x="4" y="4" width="12" height="12" rx="1.5"/><path d="M20 8v12H8" />',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/>', style: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><circle cx="18" cy="18" r="2.5"/>', template: '<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>', play: '<path d="M7 5l12 7-12 7z"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  type: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>', alignL: '<path d="M4 4v16M8 7h12M8 12h8M8 17h10"/>', alignC: '<path d="M12 4v16M6 7h12M8 12h8M5 17h14"/>', alignR: '<path d="M20 4v16M4 7h12M8 12h8M6 17h10"/>',
  alignT: '<path d="M4 4h16M7 8v12M12 8v8M17 8v10"/>', alignM: '<path d="M4 12h16M7 6v12M12 8v8M17 5v14"/>', alignB: '<path d="M4 20h16M7 4v12M12 8v8M17 6v10"/>',
  distH: '<path d="M4 4v16M20 4v16M10 8h4v8h-4z"/>', distV: '<path d="M4 4h16M4 20h16M8 10h8v4H8z"/>', section: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18"/>',
  rotate: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
};
export const ic = (n, sw = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------- content helpers ---------- */
export const C = () => S.content;
export function emptyContent() { return { edits: [], blocks: [], sections: [], sectionOrder: [], els: [], seo: {}, v: 3 }; }
export function normalize(c) { c = c && typeof c === 'object' ? c : {}; const e = emptyContent(); for (const k of Object.keys(e)) if (c[k] !== undefined) e[k] = c[k]; if (c.page) e.page = c.page; if (Array.isArray(e.seo)) e.seo = {}; e.els = Array.isArray(e.els) ? e.els : []; return e; }
export function editFor(sel, create) {
  let e = C().edits.find(x => x.selector === sel);
  if (!e && create) { e = { selector: sel }; C().edits.push(e); }
  return e;
}
export function sectionFor(id, create) {
  let s = C().sections.find(x => x.id === id);
  if (!s && create) { s = { id }; C().sections.push(s); }
  return s;
}
export const blockById = id => C().blocks.find(b => b.id === id);
export const elById = id => C().els.find(e => e.id === id);
// section-level data object (original section entry or added block)
export function secData(id, create) { return blockById(id) || sectionFor(id, create); }
export const isBlock = id => !!blockById(id);
const emptyObj = o => !o || typeof o !== 'object' || !Object.keys(o).length;
export function pruneStyle(o) {
  if (!o || typeof o !== 'object') return o;
  for (const [a, v] of Object.entries(o)) if (v === '' || v === null || v === undefined || v === false || (typeof v === 'object' && !Array.isArray(v) && emptyObj(v))) delete o[a];
  return o;
}
export function cleanup() {
  const c = C();
  for (const e of c.edits) {
    for (const [k, v] of Object.entries(e)) if (k !== 'selector' && (v === undefined || v === null || v === false || (v === '' && k !== 'link'))) delete e[k];
    for (const k of ['style', 'mobile', 'tablet', 'hov', 'tf', 'lock']) if (e[k]) { pruneStyle(e[k]); if (emptyObj(e[k])) delete e[k]; }
    if (e.tf) { for (const k of ['x', 'y', 'r']) if (num(e.tf[k]) === 0) delete e.tf[k]; for (const k of ['sx', 'sy']) if (num(e.tf[k]) === 1) delete e.tf[k]; if (emptyObj(e.tf)) delete e.tf; }
    for (const k of ['tft', 'tfm']) if (e[k]) { pruneTf(e[k]); if (emptyObj(e[k])) delete e[k]; } // overrides keep 0 / false
    if (e.anim) { pruneAnim(e.anim); if (emptyObj(e.anim)) delete e.anim; }
  }
  c.edits = c.edits.filter(e => Object.keys(e).length > 1);
  for (const s of c.sections) { for (const k of ['style', 'mobile', 'fx']) if (s[k]) { pruneStyle(s[k]); if (emptyObj(s[k])) delete s[k]; } if (s.anim) { pruneAnim(s.anim); if (emptyObj(s.anim)) delete s.anim; } }
  c.sections = c.sections.filter(s => s.hidden || s.style || s.mobile || s.fx || s.anim);
  for (const b of c.blocks) { for (const k of ['style', 'mobile', 'titleStyle', 'bodyStyle', 'buttonStyle', 'imageStyle', 'fx']) if (b[k]) { pruneStyle(b[k]); if (emptyObj(b[k])) delete b[k]; } if (b.anim) { pruneAnim(b.anim); if (emptyObj(b.anim)) delete b.anim; } }
  for (const e of c.els) { for (const [k, v] of Object.entries(e)) if (v === undefined || v === null) delete e[k]; for (const k of ['style', 'mob', 'tab', 'dis', 'hov', 'act', 'm', 'lock']) if (e[k]) { pruneStyle(e[k]); if (emptyObj(e[k])) delete e[k]; } if (e.anim) { pruneAnim(e.anim); if (emptyObj(e.anim)) delete e.anim; } }
  // children of deleted parents (any depth)
  for (let n = c.els.length; ;) {
    const ids = new Set(c.els.map(e => e.id));
    c.els = c.els.filter(e => !e.parent || ids.has(e.parent));
    if (c.els.length === n) break; n = c.els.length;
  }
}
function pruneTf(o) { for (const [a, v] of Object.entries(o)) if (v === '' || v === null || v === undefined) delete o[a]; return o; }
function pruneAnim(a) { for (const k of Object.keys(a)) { if (a[k] && typeof a[k] === 'object') { pruneStyle(a[k]); if (!a[k].t) delete a[k]; } else if (a[k] === '' || a[k] === null || a[k] === undefined || a[k] === 0 && k === 'mouse') delete a[k]; } if (a.mob === 'same') delete a.mob; }

/* ---------- history & saving ---------- */
// Undo history: whole-document snapshots with a label. commit({live:true}) applies a change to the page without
// creating a step (sliders, colour pickers, drags); the next normal commit records everything since the last step as ONE step.
let lastSnap = '';
export function snapshot() { lastSnap = JSON.stringify(C()); S.liveDirty = false; }
export function commit(opts = {}) {
  cleanup();
  if (opts.live) { S.liveDirty = true; hooks.applyToFrame?.(); return; }
  S.liveDirty = false;
  const now = JSON.stringify(C());
  if (now === lastSnap) { if (!opts.silent) { hooks.renderInspector?.(); hooks.drawOverlay?.(); } return; }
  let label = opts.label; if (!label) { try { label = describe(JSON.parse(lastSnap || '{}'), C()); } catch { label = 'Edit'; } }
  S.undo.push({ s: lastSnap, label, t: Date.now() }); if (S.undo.length > 150) S.undo.shift();
  S.redo = []; lastSnap = now;
  S.dirty = true; setStatus();
  clearTimeout(S.saveTimer); S.saveTimer = setTimeout(save, 900);
  if (!opts.noApply) hooks.applyToFrame?.();
  if (!opts.keepInspector) hooks.renderInspector?.();
  if (['layers', 'seo', 'history'].includes(S.panel) && !opts.keepPanel) hooks.renderPanel?.();
  updateUndo();
}
// settles pending live changes as their own step (before undo, selection changes, drags)
// noApply: the page already shows the live state, so it is not re-rendered (e.g. under the pointer during a click)
export function flushLive(noApply) { if (!noApply) hooks.cancelLive?.(); if (S.liveDirty) commit({ keepInspector: true, noApply }); }
export function undo() { flushLive(); if (!S.undo.length) return; stepBack(); afterHistory(); }
export function redo() { flushLive(); if (!S.redo.length) return; stepFwd(); afterHistory(); }
function stepBack() { const u = S.undo.pop(); S.redo.push({ s: JSON.stringify(C()), label: u.label, t: u.t }); S.content = JSON.parse(u.s); lastSnap = u.s; }
function stepFwd() { const r = S.redo.pop(); S.undo.push({ s: JSON.stringify(C()), label: r.label, t: r.t }); S.content = JSON.parse(r.s); lastSnap = r.s; }
// History panel: jump n steps back (n < 0) or forward (n > 0) at once
export function historyJump(n) { flushLive(); let k = 0; while (n < 0 && S.undo.length && k > n) { stepBack(); k--; } while (n > 0 && S.redo.length && k < n) { stepFwd(); k++; } if (k) afterHistory(); }
function afterHistory() {
  hooks.beforeHistory?.();
  S.dirty = true; setStatus(); clearTimeout(S.saveTimer); S.saveTimer = setTimeout(save, 900);
  if (S.sel?.type === 'fe' && !elById(S.sel.id)) { S.sel = null; S.multi = []; }
  if (S.sel?.type === 'block' && !blockById(S.sel.id)) S.sel = null;
  S.multi = S.multi.filter(id => elById(id));
  if (S.imgEdit && !elById(S.imgEdit.id)) S.imgEdit = null;
  S.iso = (S.iso || []).filter(x => x.type === 'group' ? C().els.some(e => e.group === x.id) : elById(x.id));
  hooks.applyToFrame?.(); hooks.renderInspector?.(); hooks.renderPanel?.(); updateUndo();
}
export function updateUndo() {
  const u = $('[data-undo]'), r = $('[data-redo]');
  if (u) { u.disabled = !S.undo.length; u.title = S.undo.length ? `Undo: ${S.undo[S.undo.length - 1].label} (Ctrl+Z)` : 'Undo (Ctrl+Z)'; }
  if (r) { r.disabled = !S.redo.length; r.title = S.redo.length ? `Redo: ${S.redo[S.redo.length - 1].label} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)'; }
}
// a short human label for the change between two documents (History panel, undo tooltips)
const KN = { text: 'Text', button: 'Button', image: 'Image', shape: 'Shape', vector: 'SVG', box: 'Box', video: 'Video', menu: 'Menu', form: 'Form', slider: 'Slider', icon: 'Icon' };
const VERB = { x: 'Move', y: 'Move', yb: 'Move', dock: 'Move', w: 'Resize', h: 'Resize', r: 'Rotate', fx: 'Flip', fy: 'Flip', m: 'Phone layout', style: 'Design', mob: 'Design (phone)', tab: 'Design (tablet)', hov: 'Hover design', act: 'Pressed design', dis: 'Disabled design', p: 'Content', anim: 'Animation', locked: 'Lock', lock: 'Lock', group: 'Group', parent: 'Move into box', sec: 'Move to section', z: 'Arrange', hideD: 'Visibility', hideT: 'Visibility', pin: 'Pin', link: 'Link', name: 'Rename', free: 'Free position', full: 'Full width', keepRatio: 'Aspect lock', tf: 'Transform', tft: 'Transform (tablet)', tfm: 'Transform (phone)', mobile: 'Design (phone)', tablet: 'Design (tablet)', type: 'Edit', value: 'Edit', hidden: 'Visibility', fx2: 'Effects' };
function describe(a, b) {
  const nm = e => e.name || KN[e.kind] || (e.kind ? e.kind[0].toUpperCase() + e.kind.slice(1) : 'Element');
  const verbs = (x, y) => { const ks = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]); const v = new Set(); for (const k of ks) if (JSON.stringify(x?.[k]) !== JSON.stringify(y?.[k]) && k !== 'id' && k !== 'selector') v.add(VERB[k] || 'Edit'); return [...v]; };
  const out = [];
  const A = new Map((a.els || []).map(e => [e.id, e])), B = new Map((b.els || []).map(e => [e.id, e]));
  const add = [...B.keys()].filter(k => !A.has(k)), del = [...A.keys()].filter(k => !B.has(k));
  if (add.length) out.push(add.length > 1 ? `Add ${add.length} elements` : `Add ${nm(B.get(add[0]))}`);
  if (del.length) out.push(del.length > 1 ? `Delete ${del.length} elements` : `Delete ${nm(A.get(del[0]))}`);
  const ch = [...B.keys()].filter(k => A.has(k) && JSON.stringify(A.get(k)) !== JSON.stringify(B.get(k)));
  if (ch.length) { const v = [...new Set(ch.flatMap(k => verbs(A.get(k), B.get(k))))]; out.push(`${v.slice(0, 2).join(' + ')} ${ch.length > 1 ? ch.length + ' elements' : nm(B.get(ch[0]))}`); }
  const EA = new Map((a.edits || []).map(e => [e.selector, e])), EB = new Map((b.edits || []).map(e => [e.selector, e]));
  const ech = [...new Set([...EA.keys(), ...EB.keys()])].filter(k => JSON.stringify(EA.get(k)) !== JSON.stringify(EB.get(k)));
  if (ech.length) { const v = [...new Set(ech.flatMap(k => !EB.has(k) ? ['Reset'] : verbs(EA.get(k), EB.get(k))))]; out.push(`${v.slice(0, 2).join(' + ')} ${ech.length > 1 ? ech.length + ' page elements' : 'page element'}`); }
  if (JSON.stringify(a.blocks) !== JSON.stringify(b.blocks)) { const n = (b.blocks || []).length - (a.blocks || []).length; out.push(n > 0 ? 'Add section' : n < 0 ? 'Delete section' : 'Edit section'); }
  if (JSON.stringify(a.sections) !== JSON.stringify(b.sections)) out.push('Section design');
  if (JSON.stringify(a.sectionOrder) !== JSON.stringify(b.sectionOrder)) out.push('Reorder sections');
  if (JSON.stringify(a.seo) !== JSON.stringify(b.seo)) out.push('SEO');
  if (JSON.stringify(a.page) !== JSON.stringify(b.page)) out.push('Page settings');
  return out.slice(0, 2).join(', ') || 'Edit';
}
// values the server dropped or changed (out of range, not allowed): the editor then shows what was really saved
function lossy(a, b, p = '', out = []) {
  if (out.length > 4) return out;
  const empty = v => v === undefined || v === null || v === '' || v === false || v === 0 || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
  if (empty(a)) return out;
  if (typeof a === 'number') { if (!(Math.abs(a - Number(b)) < 0.01)) out.push(p); return out; }
  if (typeof a === 'boolean') { if (b !== a) out.push(p); return out; }
  if (typeof a === 'string') { if (!a.trim()) return out; if (b === undefined || b === null || b === '' || (!/[<&]/.test(a) && a.length < 80 && String(b).trim() !== a.trim() && !(typeof b === 'number' && Number(a) === b))) out.push(p); return out; }
  if (Array.isArray(a)) { if (!Array.isArray(b) || b.length < a.length) { out.push(p); return out; } a.forEach((x, i) => lossy(x, b[i], p + '.' + i, out)); return out; }
  if (typeof a === 'object') { if (!b || typeof b !== 'object') { out.push(p); return out; } for (const k of Object.keys(a)) lossy(a[k], b[k], p ? p + '.' + k : k, out); }
  return out;
}

function lossyDoc(a, b) {
  const out = [];
  const byKey = (list, k) => new Map((list || []).map(x => [x?.[k], x]));
  for (const [arr, k] of [['edits', 'selector'], ['els', 'id'], ['blocks', 'id'], ['sections', 'id']]) {
    const B = byKey(b[arr], k);
    for (const x of a[arr] || []) { if (!x) continue; const y = B.get(x[k]); if (!y) { if (Object.keys(x).some(q => q !== k && lossy(x[q], undefined).length)) out.push(`${arr}:${x[k]}`); continue; } lossy(x, y, `${arr}:${String(x[k]).slice(0, 24)}`, out); }
  }
  for (const k of ['seo', 'page', 'sectionOrder']) lossy(a[k], b[k], k, out);
  return out;
}
export async function save() {
  clearTimeout(S.saveTimer);
  if (!S.dirty || S.saving) { if (S.dirty) S.saveTimer = setTimeout(save, 700); return; }
  S.saving = true; S.dirty = false; setStatus();
  const path = S.path;
  const sent = JSON.stringify(C());
  try {
    const r = await api('/site/save', { path, content: JSON.parse(sent), revision: S.rev });
    if (path === S.path) {
      S.rev = r.revision; S.hasDraft = true; S.savedAt = new Date();
      // the server keeps only allowed values: if it changed something, show the saved version (when nothing else changed meanwhile)
      if (r.content && !S.dirty && JSON.stringify(C()) === sent && (hooks.canResync?.() ?? true)) {
        const bad = lossyDoc(JSON.parse(sent), r.content);
        if (bad.length) { S.content = normalize(r.content); lastSnap = JSON.stringify(C()); hooks.applyToFrame?.(); hooks.renderInspector?.(); toast('Some values were outside the allowed range and were adjusted (' + bad.slice(0, 3).join(', ') + ')', true); }
      }
    }
    S.saving = false; setStatus();
  } catch (e) {
    S.saving = false;
    if (e.status === 409) { S.dirty = false; setStatus('err', 'Changed elsewhere'); hooks.confirmBox?.('This page was changed by someone else', 'Reload the page to get the latest version. Your last change will be lost.', 'Reload', () => hooks.loadPage?.(S.path, true)); return; }
    S.dirty = true; setStatus('err', e.status === 413 ? 'Page too large to save' : 'Not saved — retrying'); S.saveTimer = setTimeout(save, 4000);
  }
}
export async function flush() { if (S.dirty || S.saving) { clearTimeout(S.saveTimer); while (S.saving) await new Promise(r => setTimeout(r, 120)); if (S.dirty) await save(); } }
export function setStatus(kind, text) {
  const el = $('[data-status]'); if (!el) return;
  if (!kind) kind = S.saving ? 'saving' : S.dirty ? 'dirty' : 'saved';
  if (!text) text = kind === 'saving' ? 'Saving…' : kind === 'dirty' ? 'Unsaved changes' : S.hasDraft ? 'Draft saved' + (S.savedAt ? ' ' + S.savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '') + ' · not published' : S.published ? 'Published' : 'No changes yet';
  el.className = 'status ' + kind; el.innerHTML = `<i></i>${esc(text)}`;
  const pub = $('[data-publish]'); if (pub) pub.disabled = !S.canPublish || (!S.hasDraft && !S.dirty && !S.saving);
}
// leaving the page: send the pending draft with keepalive so the request survives the unload (bodies over 64 KB fall back to a normal save)
addEventListener('beforeunload', e => {
  if (!S.dirty && !S.saving) return;
  if (S.dirty && !S.saving && S.content) {
    const body = JSON.stringify({ path: S.path, content: C(), revision: S.rev });
    if (body.length < 60000) { try { fetch('/api/admin/site/save', { method: 'POST', keepalive: true, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': S.csrf }, body }); } catch { save(); } } else save();
  }
  e.preventDefault(); e.returnValue = '';
});

/* ---------- clipboard (shared across pages and tabs) ---------- */
const CLIP = 'satinEditorClipboard';
export function clipSet(v) { try { localStorage.setItem(CLIP, JSON.stringify({ ...v, at: Date.now() })); } catch { S._clip = v; } }
export function clipGet() { try { return JSON.parse(localStorage.getItem(CLIP) || 'null') || S._clip || null; } catch { return S._clip || null; } }
export function prefs(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('satinEd.' + k) || 'null'); localStorage.setItem('satinEd.' + k, JSON.stringify(v)); } catch { return null; } }
