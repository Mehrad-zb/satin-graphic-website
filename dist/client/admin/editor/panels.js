/* Satin editor — app shell, left panels, page loading, publishing. */
import { S, F, $, $$, esc, ic, clone, uid, num, hooks, RT, C, api, toast, normalize, snapshot, setStatus, updateUndo, commit, flush, undo, redo, blockById, elById, secData, isBlock, prefs, clipGet, historyJump, editFor } from './core.js?v=8';
import { onCtl, wire, gcBind, fText, fRange, fSelect, fSwitch, fButtons, fColor, fImage, fNum, group, modal, confirmBox, promptBox, loadMedia, uploadFiles, mediaGrid, dropZone, DROP, pickMedia, liveCommit } from './ui.js?v=8';
import { BLOCKS, KIND_NAME, TILE_SVG, ELEMENTS, EL_NAME, preset } from './catalog.js?v=8';
import { setupFrame, applyToFrame, drawOverlay, select, selectMany, scrollToSel, sectionsEls, sectionName, feName, onKey, isHidden, toggleHidden, reorder, moveSection, insertBlock, addElement, setDragKind, isMobile, finishInline, closeCtx, paste, zOrder, feNode, lockOf, selectorFor, elKind, renderCrumbs, enterIso } from './canvas.js?v=8';
import { renderInspector, fontOpts, fFont } from './inspector.js?v=8';

/* ---------- shell ---------- */
const RAIL = [['add', 'plus', 'Add'], ['layers', 'layers', 'Layers'], ['pages', 'pages', 'Pages'], ['menus', 'menu', 'Menus'], ['theme', 'theme', 'Theme'], ['media', 'image', 'Media'], ['seo', 'seo', 'SEO'], ['history', 'clock', 'History']];
export function layout() {
  $('#app').innerHTML = `<div class="ed">
  <header class="top">
    <a class="logo" href="/admin/" title="Back to the dashboard">${ic('back')}<img src="/satin/img/logo.png" alt="Satin"><span>Editor</span></a>
    <button class="pagebtn" data-pagepick title="Change page"><small>Page</small><b data-pagename>…</b>${ic('down')}</button>
    <div class="seg" role="group" aria-label="Device">${['desktop', 'tablet', 'mobile'].map(d => `<button data-device="${d}" title="${d[0].toUpperCase() + d.slice(1)}" class="${S.device === d ? 'on' : ''}">${ic(d)}</button>`).join('')}</div>
    <div class="row" style="flex:none;gap:2px"><button class="ib" data-undo title="Undo (Ctrl+Z)" disabled>${ic('undo')}</button><button class="ib" data-redo title="Redo (Ctrl+Shift+Z)" disabled>${ic('redo')}</button></div>
    <div class="row tools" style="flex:none;gap:2px"><button class="ib" data-tool="rulers" title="Rulers & guides (R)">${ic('ruler')}</button><button class="ib" data-tool="grid" title="Show grid (G toggles grid + snap to grid)">${ic('grid')}</button><button class="ib" data-tool="snap" title="Snap to elements">${ic('magnet')}</button><button class="ib" data-snapcfg title="Snapping & grid settings" aria-haspopup="true">${ic('gear')}</button><button class="ib" data-keys title="Keyboard shortcuts (?)">${ic('keyboard')}</button></div>
    <div class="grow"></div>
    <span class="status" data-status></span>
    <a class="ib" data-live target="_blank" rel="noopener" title="Open the live page">${ic('ext')}</a>
    <button class="btn ghost" data-preview>Preview</button>
    <button class="btn pri" data-publish ${S.canPublish ? '' : 'disabled title="Your role can save drafts. Ask an admin to publish."'}>Publish</button>
  </header>
  <nav class="rail">${RAIL.map(([k, i, l]) => `<button data-rail="${k}" class="${k === 'add' ? 'add' : ''}" title="${l}">${ic(i, k === 'add' ? 2.4 : 1.8)}${k === 'add' ? '' : `<span>${l}</span>`}</button>`).join('')}</nav>
  <section class="panel" data-panel hidden></section>
  <main class="stage"><nav class="crumbs" data-crumbs aria-label="Selection path"><button type="button" class="cur">Page</button></nav><div class="frame-wrap" data-wrap><iframe data-frame title="Page preview"></iframe><div class="loading" data-loading>Loading page…</div></div></main>
  <aside class="insp" data-insp></aside>
  </div>`;
  $$('[data-rail]').forEach(b => b.onclick = () => openPanel(S.panel === b.dataset.rail ? null : b.dataset.rail));
  $$('[data-device]').forEach(b => b.onclick = () => setDevice(b.dataset.device));
  $('[data-undo]').onclick = undo; $('[data-redo]').onclick = redo;
  $('[data-preview]').onclick = () => setPreview(!S.preview);
  $('[data-publish]').onclick = publish;
  $('[data-pagepick]').onclick = () => openPanel('pages');
  $('[data-keys]').onclick = shortcuts;
  $$('[data-tool]').forEach(b => b.onclick = () => { const k = b.dataset.tool; S[k] = !S[k]; prefs(k, S[k]); syncTop(); drawOverlay(); });
  $('[data-snapcfg]').onclick = e => { e.stopPropagation(); snapSettings($('[data-snapcfg]')); };
  syncTop();
  addEventListener('keydown', onKey);
  addEventListener('paste', e => { if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); pasteFiles(fs); } });
  hooks.afterLayout?.();
}
export function syncTop() { $$('[data-tool]').forEach(b => b.classList.toggle('on', !!S[b.dataset.tool])); const c = $('[data-snapcfg]'); if (c) c.classList.toggle('on', !!(S.snapGrid || S.smartSpacing || S.smartGuides)); }
// snapping & grid settings: independent switches + one grid size used by the drawn grid and the snapping
const SNAP_KEYS = [['grid', 'Show grid'], ['snapGrid', 'Snap to grid'], ['snap', 'Snap to elements'], ['smartGuides', 'Smart guides (alignment lines)'], ['smartSpacing', 'Smart spacing (equal gaps)']];
function snapSettings(anchor) {
  const old = $('.snappop'); if (old) { old.remove(); return; }
  const pop = document.createElement('div'); pop.className = 'snappop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Snapping settings');
  const draw = () => {
    pop.innerHTML = `<h4>Snapping</h4>${SNAP_KEYS.map(([k, l]) => `<label class="switch">${esc(l)}<input type="checkbox" data-sk="${k}" ${S[k] ? 'checked' : ''}></label>`).join('')}
      <div class="grid2"><label class="f num"><span>Grid size</span><div class="numin"><input type="number" min="2" max="200" step="1" data-gs value="${S.gridSize}"><em>px</em></div></label><label class="f num"><span>Snap distance</span><div class="numin"><input type="number" min="1" max="30" step="1" data-tol value="${S.snapTol}"><em>px</em></div></label></div>
      <p class="hint">Hold <b>Alt</b> while dragging to move freely; <b>Ctrl</b> while resizing to resize freely.</p>`;
    pop.querySelectorAll('[data-sk]').forEach(i => i.onchange = () => { S[i.dataset.sk] = i.checked; prefs(i.dataset.sk, i.checked); syncTop(); drawOverlay(); });
    pop.querySelector('[data-gs]').onchange = e => { const v = Math.max(2, Math.min(200, Math.round(+e.target.value) || 10)); S.gridSize = v; prefs('gridSize', v); e.target.value = v; drawOverlay(); };
    pop.querySelector('[data-tol]').onchange = e => { const v = Math.max(1, Math.min(30, Math.round(+e.target.value) || 6)); S.snapTol = v; prefs('snapTol', v); e.target.value = v; };
  };
  draw(); document.body.append(pop);
  const r = anchor.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(innerWidth - 300, r.left - 120)) + 'px'; pop.style.top = (r.bottom + 6) + 'px';
  pop.querySelector('input')?.focus();
  const close = e => { if (e.type === 'keydown' ? e.key === 'Escape' : !pop.contains(e.target) && !anchor.contains(e.target)) { pop.remove(); removeEventListener('mousedown', close, true); removeEventListener('keydown', close, true); } };
  setTimeout(() => { addEventListener('mousedown', close, true); addEventListener('keydown', close, true); }, 0);
}
hooks.syncTop = syncTop;
export function setDevice(d) {
  finishInline();
  S.device = d;
  $$('[data-device]').forEach(b => b.classList.toggle('on', b.dataset.device === d));
  const w = $('[data-wrap]'); w.classList.remove('tablet', 'mobile'); if (d !== 'desktop') w.classList.add(d);
  setTimeout(() => { applyToFrame(); renderInspector(); }, 260);
}
export function setPreview(on) {
  finishInline();
  S.preview = on; document.body.classList.toggle('preview', on);
  $('[data-preview]').textContent = on ? 'Back to editor' : 'Preview';
  if (on) { S.sel = null; S.hover = null; S.multi = []; S.iso = []; S.imgEdit = null; }
  if (F.doc) { F.doc.documentElement.classList.toggle('cms-editing', !on); try { RT.apply(F.main, C(), { seo: false, editing: !on }); } catch (e) { console.error(e); } }
  drawOverlay(); renderInspector();
}
hooks.setPreview = setPreview;
export function shortcuts() {
  const rows = [['Select several', 'Shift + click'], ['Select area', 'Shift + drag on a section'], ['Copy / cut / paste', 'Ctrl + C / X / V'], ['Duplicate', 'Ctrl + D'], ['Delete', 'Delete'], ['Undo / redo', 'Ctrl + Z / Ctrl + Shift + Z'], ['Move 1px / 10px', 'Arrows / Shift + arrows'], ['Group / ungroup', 'Ctrl + G / Ctrl + Shift + G'], ['Lock / unlock', 'Ctrl + L'], ['Hide / show', 'Ctrl + H'], ['Bring forward / send back', 'Ctrl + ] / Ctrl + ['], ['To front / to back', 'Ctrl + Shift + ] / ['], ['Copy / paste design', 'Ctrl + Alt + C / V'], ['Select all in section', 'Ctrl + A'], ['Edit text', 'Enter or double-click'], ['Keep proportions while resizing', 'Hold Shift'], ['Resize from the centre', 'Hold Alt'], ['Move without snapping', 'Hold Alt'], ['Grid + snap to grid on/off', 'G'], ['Text handles: resize box / scale text', 'K'], ['Rotate in 15° steps', 'Hold Shift'], ['Resize without snapping', 'Hold Ctrl'], ['Edit inside a box / group', 'Double-click or Enter'], ['Move / zoom the photo inside an image', 'Double-click the image'], ['Rulers & guides', 'R (drag from a ruler to add a guide)'], ['Preview', 'Ctrl + P'], ['Save now', 'Ctrl + S'], ['Leave photo / box editing, deselect', 'Esc']];
  modal('Keyboard shortcuts', `<table class="keys">${rows.map(([a, k]) => `<tr><td>${esc(a)}</td><td><kbd>${esc(k)}</kbd></td></tr>`).join('')}</table>`);
}
hooks.shortcuts = shortcuts;
async function pasteFiles(files) {
  const imgs = files.filter(f => /^image\//.test(f.type)); if (!imgs.length) return;
  const out = await uploadFiles(imgs);
  for (const m of out) addElement({ kind: m.kind === 'vector' ? 'vector' : 'image', w: Math.min(520, m.width || 400), h: Math.round(Math.min(520, m.width || 400) * ((m.height || 300) / (m.width || 400))), p: { src: m.url, alt: '' } });
}
hooks.pasteFiles = pasteFiles;

/* ---------- page loading ---------- */
export async function loadPage(path, force) {
  if (!force && path === S.path && S.content) return;
  await flush();
  S.path = path; S.sel = null; S.hover = null; S.multi = []; S.frameReady = false; S.undo = []; S.redo = []; S.iso = []; S.imgEdit = null;
  history.replaceState(null, '', '#' + path);
  const p = S.pages.find(x => x.path === path);
  $('[data-pagename]').textContent = /^\/satin(\/(fa|fr|es))?$/.test(path) ? 'Home' + (path.length > 6 ? ' (' + path.slice(7) + ')' : '') : p ? p.title : path;
  $('[data-live]').href = path + '/';
  $('[data-loading]').hidden = false;
  try {
    const [d, raw] = await Promise.all([api('/site/content?path=' + encodeURIComponent(path)), fetch(path + '/', { credentials: 'same-origin' }).then(r => r.ok ? r.text() : '').catch(() => '')]);
    if (path !== S.path) return;
    S.content = normalize(d.content); S.rev = d.revision; S.hasDraft = d.hasDraft; S.published = d.published; S.publishedAt = d.publishedAt;
    S.stable = new Set([...raw.matchAll(/data-cms-id="([^"]+)"/g)].map(m => m[1]));
    snapshot(); S.dirty = false; setStatus(); updateUndo();
  } catch (e) { toast(e.message, true); return; }
  renderInspector(); if (S.panel) renderPanel();
  const fr = $('[data-frame]');
  fr.onload = () => frameLoaded(path);
  fr.src = path + '/?cms=1';
}
hooks.loadPage = loadPage;
async function frameLoaded(path) {
  const fr = $('[data-frame]');
  let win; try { win = fr.contentWindow; win.document; } catch { return; }
  const loc = win.location.pathname.replace(/\/$/, '') || '/';
  if (!new URLSearchParams(win.location.search).has('cms')) { if (/^\/satin(\/|$)/.test(loc)) loadPage(loc); return; }
  for (let i = 0; i < 80 && !win.__satinReady; i++) await new Promise(r => setTimeout(r, 100));
  if (path !== S.path) return;
  F.win = win; F.doc = win.document; F.main = win.document.getElementById('main');
  if (!F.main) { $('[data-loading]').textContent = 'This page cannot be edited.'; return; }
  setupFrame();
  RT.identify(F.main);
  applyToFrame();
  applyThemePreview();
  S.frameReady = true;
  $('[data-loading]').hidden = true;
  if (S.panel === 'layers') renderPanel();
}

/* ---------- panels ---------- */
const PANEL_TITLE = { add: 'Add to the page', layers: 'Layers', pages: 'Pages', menus: 'Site menu', theme: 'Theme', media: 'Media library', seo: 'SEO for this page', history: 'History' };
export function openPanel(k) {
  S.panel = k;
  $$('[data-rail]').forEach(b => b.classList.toggle('on', b.dataset.rail === k));
  $('[data-panel]').hidden = !k;
  renderPanel();
}
hooks.openPanel = openPanel;
let pageFilter = { q: '', lang: 'en' }, addTab = 'elements', addCat = 'Text', themeTab = 'themes';
export function renderPanel() {
  const p = $('[data-panel]'); if (!p || !S.panel) return;
  gcBind();
  const k = S.panel;
  const scroll = p.querySelector('[data-pbody]')?.scrollTop || 0;
  p.innerHTML = `<header><h2>${PANEL_TITLE[k]}</h2><button class="ib" data-closepanel title="Close">${ic('x')}</button></header><div class="body" data-pbody></div>`;
  $('[data-closepanel]', p).onclick = () => openPanel(null);
  const b = $('[data-pbody]', p);
  ({ add: panelAdd, layers: panelLayers, pages: panelPages, menus: panelMenus, theme: panelTheme, media: panelMedia, seo: panelSeo, history: panelHistory })[k](b);
  wire(b);
  if (k === 'layers' || k === 'add') b.scrollTop = scroll;
}
hooks.renderPanel = renderPanel;

/* add */
function panelAdd(b) {
  const tabs = [['elements', 'Elements'], ['sections', 'Sections'], ['saved', 'Saved']];
  const head = `<div class="tabsm">${tabs.map(([k, l]) => `<button data-at="${k}" class="${addTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (addTab === 'elements') {
    const cats = [...new Set(ELEMENTS.map(x => x.cat))];
    const target = S._addTarget ? `the selected section` : S.sel ? 'the selected section' : 'the section in view';
    b.innerHTML = head + `<div class="addwrap"><nav class="addcats">${cats.map(c => `<button data-cat="${c}" class="${addCat === c ? 'on' : ''}">${c}</button>`).join('')}</nav><div class="addlist"><p class="hint" style="margin-top:0">Click to add to ${target}, or drag onto the page.</p><div class="etiles">${ELEMENTS.filter(x => x.cat === addCat).map(x => `<button class="etile" draggable="true" data-ekey="${x.key}" title="${esc(x.name)}"><div class="pv">${x.tile}</div><span>${esc(x.name)}</span></button>`).join('')}</div>
      ${addCat === 'Media' ? `<div class="group"><h4>Upload</h4><div class="gb">${DROP(true)}</div></div>` : ''}</div></div>`;
    $$('[data-cat]', b).forEach(x => x.onclick = () => { addCat = x.dataset.cat; renderPanel(); });
    $$('.etile', b).forEach(t => {
      t.onclick = () => addElement(t.dataset.ekey);
      t.ondragstart = e => { setDragKind('el:' + t.dataset.ekey); e.dataTransfer.setData('text/plain', 'cms-el:' + t.dataset.ekey); e.dataTransfer.effectAllowed = 'copy'; };
      t.ondragend = () => { setDragKind(null); drawOverlay(); };
    });
    if ($('.drop', b)) dropZone(b, files => uploadFiles(files, out => { for (const m of out) { const kind = m.kind === 'video' ? 'video' : m.kind === 'audio' ? 'audio' : m.kind === 'lottie' ? 'lottie' : m.kind === 'vector' ? 'vector' : 'image'; if (kind === 'image' || kind === 'vector') addElement({ kind, w: Math.min(520, m.width || 400), h: Math.round(Math.min(520, m.width || 400) * ((m.height || 300) / (m.width || 400))), p: { src: m.url } }); else addElement({ kind, w: kind === 'audio' ? 380 : 480, h: kind === 'audio' ? 60 : 300, p: { src: m.url, controls: true } }); } }));
  } else if (addTab === 'sections') {
    const cats = [...new Set(BLOCKS.map(x => x.cat))];
    b.innerHTML = head + `<p class="hint" style="margin-top:0">Drag a section onto the page, or click to add it ${S.sel ? 'after the selected section' : 'at the end of the page'}.</p>` +
      cats.map(c => `<div class="cat">${c}</div><div class="tiles">${BLOCKS.filter(x => x.cat === c).map(x => `<button class="tile" draggable="true" data-kind="${x.kind}"><div class="pv"><svg viewBox="0 0 100 62">${TILE_SVG[x.kind] || ''}</svg></div><b>${x.name}</b><small>${x.desc}</small></button>`).join('')}</div>`).join('');
    $$('.tile', b).forEach(t => {
      t.onclick = () => insertBlock(t.dataset.kind);
      t.ondragstart = e => { setDragKind(t.dataset.kind); e.dataTransfer.setData('text/plain', 'cms-block:' + t.dataset.kind); e.dataTransfer.effectAllowed = 'copy'; };
      t.ondragend = () => { setDragKind(null); drawOverlay(); };
    });
  } else {
    b.innerHTML = head + '<p class="hint">Loading…</p>';
    const draw = () => {
      const list = S.templates || [];
      const clip = clipGet();
      b.innerHTML = head + `<p class="hint" style="margin-top:0">Sections you saved with “Save as template”. They can be added to any page.</p>${clip && clip.type !== 'style' ? `<div class="group"><h4>Clipboard</h4><div class="gb"><button class="btn sm" data-pclip>${ic('paste')} Paste ${clip.type === 'els' ? clip.els.length + ' element(s)' : 'section'}</button></div></div>` : ''}
        ${list.length ? `<div class="tpls">${list.map(t => `<div class="tpl" draggable="true" data-tpl="${esc(t.id)}"><b>${esc(t.name)}</b><small>${esc(t.createdBy || '')} · ${t.els?.length || 0} elements</small><div><button class="btn sm" data-ins="${esc(t.id)}">Add</button><button class="ib" data-deltpl="${esc(t.id)}" title="Delete">${ic('trash')}</button></div></div>`).join('')}</div>` : '<p class="hint">No saved sections yet. Select a section and choose “Save as template”.</p>'}`;
      $$('[data-at]', b).forEach(x => x.onclick = () => { addTab = x.dataset.at; renderPanel(); });
      $$('[data-ins]', b).forEach(x => x.onclick = () => insertTemplate(x.dataset.ins));
      $$('[data-tpl]', b).forEach(x => { x.ondragstart = e => { setDragKind('tpl:' + x.dataset.tpl); e.dataTransfer.setData('text/plain', 'cms-tpl'); }; x.ondragend = () => setDragKind(null); });
      $$('[data-deltpl]', b).forEach(x => x.onclick = () => confirmBox('Delete this template?', 'Pages that already use it are not affected.', 'Delete', async () => { try { const r = await api('/site/templates/delete', { id: x.dataset.deltpl }); S.templates = r.templates; draw(); } catch (e) { toast(e.message, true); } }));
      const pc = $('[data-pclip]', b); if (pc) pc.onclick = paste;
    };
    if (S.templates) draw(); else api('/site/templates').then(r => { S.templates = r.templates; if (S.panel === 'add' && addTab === 'saved') draw(); }).catch(e => toast(e.message, true));
  }
  $$('[data-at]', b).forEach(x => x.onclick = () => { addTab = x.dataset.at; renderPanel(); });
}
function insertTemplate(id, index) {
  const t = (S.templates || []).find(x => x.id === id); if (!t) return;
  const b = t.block ? { ...clone(t.block), id: uid('b') } : { ...preset('blank'), style: clone(t.section?.style || { minHeight: 520 }), fx: clone(t.section?.fx || {}) };
  const map = {}; for (const e of t.els || []) map[e.id] = uid('e');
  C().els.push(...(t.els || []).map(e => ({ ...clone(e), id: map[e.id], sec: b.id, ...(e.parent ? { parent: map[e.parent] } : {}) })));
  insertBlock(b, index);
}
hooks.insertTemplate = insertTemplate;

/* layers */
const KIND_ICON = { text: 'T', button: '▭', image: '🖼', shape: '◆', vector: '✦', box: '▢', video: '▶', audio: '♪', embed: '</>', map: '📍', social: '@', icon: '★', menu: '☰', form: '✎', slider: '⧉', accordion: '≡', tabs: '⊟', countdown: '⏱', progress: '▬', beforeafter: '◧', marquee: '⇢', lottie: '✧', repeater: '▦', counter: '#' };
// original page elements that can be selected on the canvas (same list as the canvas uses)
const LPICK = 'h1,h2,h3,h4,h5,h6,p,img,a,button,li,blockquote,figcaption,span.eyebrow,.counter-item b,.counter-item span,small,dt,dd,summary,label,span.tiny,td,th,video,svg';
const lockIc = l => ic(l.all || l.pos || l.size || l.rot || l.style ? 'lock' : 'unlock');
const lockCls = l => l.all ? 'lk' : (l.pos || l.size || l.rot || l.style) ? 'lk part' : '';
function origRows(sec) {
  const nodes = [...sec.querySelectorAll(LPICK)].filter(n => !n.closest('.cms-free,.cms-bgl,.cms-added-section,[data-cms-skip],#cms-ov') && !(n.tagName.toLowerCase() === 'svg' && n.parentElement?.closest('a,button,svg')) && !(n.matches('a') && n.querySelector('img') && !n.textContent.trim()));
  const set = new Set(nodes);
  return nodes.slice(0, 150).map(n => { let d = 0; for (let p = n.parentElement; p && p !== sec; p = p.parentElement) if (set.has(p)) d++; return { n, d }; });
}
function panelLayers(b) {
  const secs = sectionsEls();
  if (!secs.length) { b.innerHTML = '<p class="hint">Layers appear once the page has loaded.</p>'; return; }
  const focusKey = b.contains(document.activeElement) ? document.activeElement?.dataset?.k : null;
  const open = S._layersOpen ||= new Set();
  const selSec = S.sel && (S.sel.type === 'fe' ? elById(S.sel.id)?.sec : S.sel.type === 'el' ? sectionsEls().find(s => s.contains(F.main?.querySelector(S.sel.selector)))?.dataset.cmsSection : S.sel.id); if (selSec) open.add(selSec);
  const elRows = (sid, parent, depth) => C().els.filter(e => e.sec === sid && (e.parent || null) === parent && !e.pin).sort((a, z) => (num(z.z) || 0) - (num(a.z) || 0)).map(e => {
    const kids = C().els.some(x => x.parent === e.id);
    const hid = isMobile() ? e.m?.hide : e.hideD;
    const lk = lockOf({ type: 'fe', id: e.id });
    return `<li class="lel ${S.multi.includes(e.id) ? 'on' : ''} ${hid ? 'off' : ''}" draggable="true" data-el="${e.id}" data-k="fe:${e.id}" tabindex="0" role="treeitem" aria-level="${depth + 1}" aria-selected="${S.multi.includes(e.id)}" style="--d:${depth}"><span class="ki">${KIND_ICON[e.kind] || '•'}</span><span class="nm">${esc(feName(e))}</span>${e.group ? '<em class="tag">G</em>' : ''}${e.kind === 'box' && kids ? `<button data-iso title="Edit inside this box (isolation)" tabindex="-1">⤢</button>` : ''}<button data-lk class="${lockCls(lk)}" title="${lk.all ? 'Locked — click to unlock' : lockCls(lk) ? 'Partly locked (see Layout › Lock) — click to lock everything' : 'Lock'}" tabindex="-1">${lockIc(lk)}</button><button data-eye title="Show / hide" tabindex="-1">${ic(hid ? 'eyeoff' : 'eye')}</button></li>${kids ? elRows(sid, e.id, depth + 1) : ''}`;
  }).join('');
  const pageRows = sec => { if (sec.classList.contains('cms-added-section')) return ''; const rows = origRows(sec); return rows.length ? `<li class="lsub" style="--d:1">Page content</li>` + rows.map(({ n, d }) => { const t = { type: 'el', selector: selectorFor(n) }; const lk = lockOf(t), hid = isHidden(t); const txt = (n.alt || n.getAttribute?.('aria-label') || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34); const on = S.sel?.type === 'el' && S.sel.selector === t.selector; return `<li class="lorig ${on ? 'on' : ''} ${hid ? 'off' : ''}" data-sel="${esc(t.selector)}" data-k="el:${esc(t.selector)}" tabindex="0" role="treeitem" aria-selected="${on}" style="--d:${d + 1}"><span class="ki">${esc(elKind(n)[0])}</span><span class="nm"><b>${esc(elKind(n))}</b>${txt ? ' · ' + esc(txt) : ''}</span><button data-lk class="${lockCls(lk)}" title="Lock" tabindex="-1">${lockIc(lk)}</button><button data-eye title="${hid ? 'Show' : 'Hide'} on ${isMobile() ? 'mobile' : 'desktop'}" tabindex="-1">${ic(hid ? 'eyeoff' : 'eye')}</button></li>`; }).join('') : ''; };
  const pins = C().els.filter(e => e.pin);
  b.innerHTML = `<p class="hint" style="margin-top:0">Click a name to select it (↑ ↓ and Enter work too). Drag sections to reorder the page and elements to change which is on top. Hidden items stay listed so you can show them again.</p>
    ${pins.length ? `<div class="cat">Pinned to the screen</div><ul class="layers" role="tree">${pins.map(e => { const lk = lockOf({ type: 'fe', id: e.id }); return `<li class="lel ${S.multi.includes(e.id) ? 'on' : ''}" data-el="${e.id}" data-k="fe:${e.id}" tabindex="0" role="treeitem" style="--d:0"><span class="ki">${KIND_ICON[e.kind] || '•'}</span><span class="nm">${esc(feName(e))}</span><button data-lk class="${lockCls(lk)}" tabindex="-1">${lockIc(lk)}</button><button data-eye tabindex="-1">${ic((isMobile() ? e.m?.hide : e.hideD) ? 'eyeoff' : 'eye')}</button></li>`; }).join('')}</ul>` : ''}
    <div class="cat">Sections</div><ul class="layers" role="tree">${secs.map(s => {
    const id = s.dataset.cmsSection, isB = s.classList.contains('cms-added-section'), bl = isB && blockById(id);
    const t = isB ? { type: 'block', id } : { type: 'section', id };
    const name = isB ? (bl?.title || KIND_NAME[bl?.kind] || 'Section') : sectionName(s);
    const on = S.sel && S.sel.id === id && (S.sel.type === 'section' || S.sel.type === 'block');
    const count = C().els.filter(e => e.sec === id && !e.pin).length;
    const expandable = count || !isB;
    return `<li draggable="true" data-id="${esc(id)}" data-b="${isB ? 1 : 0}" data-k="sec:${esc(id)}" tabindex="0" role="treeitem" aria-expanded="${open.has(id)}" class="lsec ${on ? 'on' : ''} ${isHidden(t) ? 'off' : ''}"><button data-tw class="tw ${open.has(id) ? 'open' : ''}" ${expandable ? '' : 'style="visibility:hidden"'} tabindex="-1">▸</button><span class="grip">${ic('grip')}</span><span class="nm">${esc(name)}</span>${isB ? '<em class="tag">New</em>' : ''}${count ? `<em class="cnt">${count}</em>` : ''}<button data-mv="-1" class="mv" title="Move up" tabindex="-1">${ic('up')}</button><button data-mv="1" class="mv" title="Move down" tabindex="-1">${ic('down')}</button><button data-eye title="Show / hide" tabindex="-1">${ic(isHidden(t) ? 'eyeoff' : 'eye')}</button></li>${open.has(id) ? (count ? elRows(id, null, 1) : '') + pageRows(s) : ''}`;
  }).join('')}</ul><div class="actions" style="margin-top:14px"><button class="btn sm" data-addsec>${ic('plus')} Add section</button>${C().sectionOrder.length ? '<button class="btn ghost sm" data-resetorder>Reset order</button>' : ''}</div>`;
  let dragId = null, dragEl = null;
  $$('.lsec', b).forEach(li => {
    const t = li.dataset.b === '1' ? { type: 'block', id: li.dataset.id } : { type: 'section', id: li.dataset.id };
    li.onclick = e => { if (e.target.closest('[data-eye]')) { toggleHidden(t); return; } const mv = e.target.closest('[data-mv]'); if (mv) { moveSection(t.id, +mv.dataset.mv); renderPanel(); return; } if (e.target.closest('[data-tw]')) { open.has(t.id) ? open.delete(t.id) : open.add(t.id); renderPanel(); return; } select(t); scrollToSel(); };
    li.ondragstart = e => { dragId = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); };
    li.ondragend = () => { li.classList.remove('dragging'); $$('.layers li', b).forEach(x => x.classList.remove('over')); };
    li.ondragover = e => { if (!dragId && !dragEl) return; e.preventDefault(); $$('.layers li', b).forEach(x => x.classList.toggle('over', x === li)); };
    li.ondrop = e => { e.preventDefault(); if (dragId && dragId !== li.dataset.id) reorder(dragId, li.dataset.id); else if (dragEl) { const el = elById(dragEl); if (el && el.sec !== li.dataset.id) { el.sec = li.dataset.id; delete el.parent; el.y = 40; commit({ label: 'Move to section' }); toast('Moved to another section'); } } dragId = dragEl = null; };
  });
  $$('.lel', b).forEach(li => {
    const id = li.dataset.el;
    li.onclick = e => {
      const el = elById(id); if (!el) return;
      if (e.target.closest('[data-eye]')) { if (isMobile()) { el.m = { ...(el.m || {}), hide: !el.m?.hide || undefined }; } else el.hideD = !el.hideD || undefined; commit({ label: 'Visibility' }); return; }
      if (e.target.closest('[data-lk]')) { const on = !el.locked; delete el.lock; if (on) el.locked = true; else delete el.locked; commit({ label: on ? 'Lock' : 'Unlock' }); return; }
      if (e.target.closest('[data-iso]')) { enterIso({ type: 'box', id }); return; }
      select({ type: 'fe', id }, { add: e.shiftKey, single: !e.shiftKey }); const n = feNode(id); if (n) { const r = n.getBoundingClientRect(); if (r.bottom < 0 || r.top > F.win.innerHeight) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    };
    li.ondblclick = () => promptBox('Rename layer', 'Name', elById(id)?.name || feName(elById(id)), v => { const el = elById(id); el.name = v || undefined; commit({ label: 'Rename' }); });
    li.ondragstart = e => { dragEl = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); li.classList.add('dragging'); };
    li.ondragend = () => { li.classList.remove('dragging'); $$('.layers li', b).forEach(x => x.classList.remove('over')); };
    li.ondragover = e => { if (!dragEl || dragEl === id) return; e.preventDefault(); $$('.layers li', b).forEach(x => x.classList.toggle('over', x === li)); };
    li.ondrop = e => {
      e.preventDefault(); if (!dragEl || dragEl === id) return;
      const a = elById(dragEl), t = elById(id);
      if (a && t && a.sec === t.sec && (a.parent || null) === (t.parent || null)) { const sibs = C().els.filter(x => x.sec === t.sec && (x.parent || null) === (t.parent || null) && !x.pin).sort((p, q) => (num(q.z) || 0) - (num(p.z) || 0)).filter(x => x !== a); sibs.splice(sibs.indexOf(t), 0, a); sibs.reverse().forEach((x, k) => x.z = k + 1); commit({ label: 'Arrange' }); }
      dragEl = null;
    };
  });
  $$('.lorig', b).forEach(li => {
    const t = { type: 'el', selector: li.dataset.sel };
    li.onclick = e => {
      if (e.target.closest('[data-eye]')) { toggleHidden(t); return; }
      if (e.target.closest('[data-lk]')) { const x = editFor(t.selector, true); const on = !x.locked; delete x.lock; if (on) x.locked = true; else delete x.locked; commit({ label: on ? 'Lock' : 'Unlock' }); return; }
      select(t); scrollToSel();
    };
  });
  // keyboard: ↑ ↓ move between rows, Enter / Space select, → ← open / close a section
  b.onkeydown = e => {
    const li = e.target.closest?.('.layers li[tabindex]'); if (!li) return;
    const rows = $$('.layers li[tabindex]', b), i = rows.indexOf(li);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); }
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && li.classList.contains('lsec')) { e.preventDefault(); const id = li.dataset.id; if (e.key === 'ArrowRight') open.add(id); else open.delete(id); renderPanel(); }
  };
  if (focusKey) [...b.querySelectorAll('[data-k]')].find(x => x.dataset.k === focusKey)?.focus();
  $('[data-addsec]', b).onclick = () => { addTab = 'sections'; openPanel('add'); };
  const ro = $('[data-resetorder]', b); if (ro) ro.onclick = () => { C().sectionOrder = []; commit({ label: 'Reset section order' }); };
}
hooks.syncLayers = () => { if (S.panel === 'layers') renderPanel(); };

/* pages */
function panelPages(b) {
  const langs = [['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['fa', 'فارسی'], ['all', 'All']];
  b.innerHTML = `<div class="search"><input class="in" data-q placeholder="Search ${S.pages.length} pages" value="${esc(pageFilter.q)}"><div class="chips">${langs.map(([k, l]) => `<button data-lang="${k}" class="${pageFilter.lang === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${S.canPublish ? `<div class="actions" style="margin-top:10px"><button class="btn sm" data-newpage>${ic('plus')} New page</button><button class="btn ghost sm" data-duppage>${ic('copy')} Duplicate this page</button></div>` : ''}</div><div class="plist" data-plist></div>`;
  const list = () => {
    const q = pageFilter.q.toLowerCase();
    const rows = S.pages.filter(p => (pageFilter.lang === 'all' || p.lang === pageFilter.lang) && (!q || p.title.toLowerCase().includes(q) || p.path.includes(q))).slice(0, 300);
    $('[data-plist]', b).innerHTML = rows.map(p => `<a href="#${esc(p.path)}" data-path="${esc(p.path)}" class="${p.path === S.path ? 'on' : ''}"><div><b>${esc(p.title)}</b><small>${esc(p.path.replace(/^\/satin/, '') || '/')}</small></div>${p.custom ? '<span class="badge new">New</span>' : ''}${p.draft ? '<span class="badge draft">Draft</span>' : p.edited ? '<span class="badge live">Edited</span>' : ''}</a>`).join('') || '<p class="hint">No pages match.</p>';
    $$('[data-path]', b).forEach(a => a.onclick = e => { e.preventDefault(); loadPage(a.dataset.path); $$('[data-path]', b).forEach(x => x.classList.toggle('on', x === a)); });
  };
  $('[data-q]', b).oninput = e => { pageFilter.q = e.target.value; list(); };
  $$('[data-lang]', b).forEach(x => x.onclick = () => { pageFilter.lang = x.dataset.lang; panelPages(b); });
  const np = $('[data-newpage]', b); if (np) np.onclick = () => newPageModal();
  const dp = $('[data-duppage]', b); if (dp) dp.onclick = () => newPageModal(S.path);
  list();
  const cur = S.pages.find(p => p.path === S.path);
  if (cur?.custom && S.canPublish) { const d = document.createElement('div'); d.className = 'group'; d.style.marginTop = '16px'; d.innerHTML = `<h4>This page</h4><div class="gb"><button class="btn danger sm">Delete “${esc(cur.title)}”</button></div>`; b.append(d); d.querySelector('button').onclick = () => confirmBox('Delete this page?', 'The page and its content will be removed from the website.', 'Delete page', async () => { try { await api('/site/pages/delete', { path: cur.path }); await loadPages(); toast('Page deleted'); loadPage('/satin'); renderPanel(); } catch (e) { toast(e.message, true); } }); }
}
function newPageModal(copyFrom) {
  const src = copyFrom && S.pages.find(p => p.path === copyFrom);
  const parents = [['/satin', 'Top level (satingraphic.ca/…)'], ...S.pages.filter(p => p.lang === 'en' && p.path.split('/').length === 3).map(p => [p.path, p.title + ' / …'])];
  const m = modal(copyFrom ? 'Duplicate page' : 'New page', `<div data-msg></div>${copyFrom ? `<p class="hint" style="margin-top:0">Creates a new page with the sections and elements you added to “${esc(src?.title || copyFrom)}”.${src?.custom ? '' : ' The original text of this built-in page is not copied.'}</p>` : ''}<label class="f"><span>Page name</span><input class="in" name="title" placeholder="e.g. Boat wraps" value="${copyFrom ? esc((src?.title || 'Page') + ' copy') : ''}" autofocus></label>
    <label class="f"><span>Web address<em>letters, numbers and dashes</em></span><input class="in" name="slug" placeholder="boat-wraps"></label>
    <label class="f"><span>Place under</span><select class="in" name="parent">${parents.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>
    <label class="f"><span>Short description<em>shown on Google</em></span><textarea class="in" name="desc" rows="3"></textarea></label>
    <p class="hint">Add it to the menu in Menus. The order of pages in the menu is set there too.</p>`, { footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" data-create>${copyFrom ? 'Duplicate page' : 'Create page'}</button>` });
  const f = n => $(`[name=${n}]`, m.el);
  const slugify = () => { if (!f('slug').dataset.touched) f('slug').value = f('title').value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  f('title').oninput = slugify; slugify();
  f('slug').oninput = () => f('slug').dataset.touched = 1;
  $('[data-create]', m.el).onclick = async e => {
    e.target.disabled = true;
    try { await flush(); const r = await api('/site/pages/create', { title: f('title').value, slug: f('slug').value, parent: f('parent').value, description: f('desc').value, copyFrom: copyFrom || '' }); m.close(); await loadPages(true); toast(copyFrom ? 'Page duplicated' : 'Page created'); loadPage(r.path); }
    catch (er) { $('[data-msg]', m.el).innerHTML = `<div class="err-box">${esc(er.message)}</div>`; e.target.disabled = false; }
  };
}

/* menus */
let menuTimer = 0, menuOpen = new Set();
async function panelMenus(b) {
  if (!S.menu) { b.innerHTML = '<p class="hint">Loading…</p>'; try { const d = await api('/site/menu'); S.menu = d.menu; S.menuDraft = d.hasDraft; } catch (e) { b.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; } if (S.panel === 'menus') renderPanel(); return; }
  const items = S.menu.items;
  const saveMenu = (redraw = true) => { clearTimeout(menuTimer); S.menuDraft = true; menuTimer = setTimeout(async () => { try { await api('/site/menu/save', { menu: S.menu }); previewMenu(); } catch (e) { toast(e.message, true); } }, 500); if (redraw) { panelMenus(b); wire(b); } };
  const mv = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  b.innerHTML = `<p class="hint" style="margin-top:0">The main menu at the top of every page. Drag the arrows to change the order of pages. Changes go live on all pages when you publish the menu.</p>
    ${items.map((it, i) => `<div class="mi ${it.active === false ? 'off' : ''}" data-i="${i}"><header data-toggle><b>${esc(it.label)}</b><button data-a="up" title="Move up">${ic('up')}</button><button data-a="down" title="Move down">${ic('down')}</button><button data-a="vis" title="Show / hide">${ic(it.active === false ? 'eyeoff' : 'eye')}</button><button data-a="del" title="Delete">${ic('trash')}</button></header>
      ${menuOpen.has(i) ? `<div class="mb"><div class="grid2" style="margin-top:8px"><label class="f"><span>Label</span><input class="in" data-k="label" value="${esc(it.label)}"></label><label class="f"><span>Link</span><input class="in" data-k="href" value="${esc(it.href)}" list="pagelist"></label></div>
        ${(it.groups || []).map((g, gi) => `<div class="mg" data-g="${gi}"><div class="row" style="margin-bottom:6px"><input class="in" data-gk="label" value="${esc(g.label)}" placeholder="Column title" style="font-weight:600"><button class="ib" data-ga="del" title="Delete column" style="flex:none">${ic('trash')}</button></div>
          ${g.links.map((l, li) => `<div class="ml ${l.active === false ? 'off' : ''}" data-l="${li}"><input data-lk="label" value="${esc(l.label)}" placeholder="Label"><input data-lk="href" value="${esc(l.href)}" placeholder="/satin/…" list="pagelist"><div><button data-la="up" title="Up">${ic('up')}</button><button data-la="vis" title="Show / hide">${ic(l.active === false ? 'eyeoff' : 'eye')}</button><button data-la="del" title="Delete">${ic('x')}</button></div></div>`).join('')}
          <button class="btn ghost sm" data-ga="addlink">${ic('plus')} Link</button></div>`).join('')}
        <button class="btn ghost sm" data-a="addgroup">${ic('plus')} ${it.groups?.length ? 'Column' : 'Drop-down column'}</button></div>` : ''}</div>`).join('')}
    <div class="actions"><button class="btn sm" data-addtop>${ic('plus')} Menu item</button></div>
    <div class="group" style="margin-top:16px"><h4>Publish</h4><div class="gb">${S.canPublish ? `<button class="btn pri block" data-pubmenu>Publish menu to all pages</button>` : '<p class="hint">Ask an admin to publish the menu.</p>'}<p class="hint">${S.menuDraft ? 'You have unpublished menu changes.' : 'The menu is up to date.'}</p></div></div>${pageDatalist()}`;
  $$('.mi', b).forEach(box => {
    const i = +box.dataset.i, it = items[i];
    $('[data-toggle]', box).onclick = e => { const a = e.target.closest('[data-a]'); if (a) return; menuOpen.has(i) ? menuOpen.delete(i) : menuOpen.add(i); panelMenus(b); };
    $$('header [data-a]', box).forEach(x => x.onclick = () => { const a = x.dataset.a; if (a === 'up') mv(items, i, -1); else if (a === 'down') mv(items, i, 1); else if (a === 'vis') it.active = it.active === false; else if (a === 'del') { if (!confirm('Delete “' + it.label + '” from the menu?')) return; items.splice(i, 1); } menuOpen.clear(); saveMenu(); });
    $$('[data-k]', box).forEach(x => x.onchange = () => { it[x.dataset.k] = x.value; saveMenu(); });
    const ag = $('[data-a="addgroup"]', box); if (ag) ag.onclick = () => { it.groups = it.groups || []; it.groups.push({ label: 'New column', links: [{ label: 'New link', href: '/satin', active: true }] }); saveMenu(); };
    $$('.mg', box).forEach(gb => {
      const g = it.groups[+gb.dataset.g];
      $('[data-gk]', gb).onchange = e => { g.label = e.target.value; saveMenu(false); };
      $$('[data-ga]', gb).forEach(x => x.onclick = () => { if (x.dataset.ga === 'del') { it.groups.splice(+gb.dataset.g, 1); if (!it.groups.length) delete it.groups; } else g.links.push({ label: 'New link', href: '/satin', active: true }); saveMenu(); });
      $$('.ml', gb).forEach(lb => {
        const li = +lb.dataset.l, l = g.links[li];
        $$('[data-lk]', lb).forEach(x => x.onchange = () => { l[x.dataset.lk] = x.value; saveMenu(false); });
        $$('[data-la]', lb).forEach(x => x.onclick = () => { const a = x.dataset.la; if (a === 'up') mv(g.links, li, -1); else if (a === 'vis') l.active = l.active === false; else g.links.splice(li, 1); saveMenu(); });
      });
    });
  });
  $('[data-addtop]', b).onclick = () => { items.push({ key: 'item' + Date.now().toString(36), label: 'New item', href: '/satin', active: true }); menuOpen = new Set([items.length - 1]); saveMenu(); };
  const pm = $('[data-pubmenu]', b); if (pm) pm.onclick = () => confirmBox('Publish the menu?', 'The new menu will appear on every page of the website.', 'Publish menu', async () => {
    try { const r = await publishMenu(); toast(`Menu published on ${r.updated} pages` + (r.failed ? ` (${r.failed} failed)` : '')); panelMenus(b); } catch (e) { toast(e.message, true); }
  });
}
export async function publishMenu() { clearTimeout(menuTimer); await api('/site/menu/save', { menu: S.menu }); const r = await api('/site/menu/publish', {}); S.menuDraft = false; return r; }
export async function previewMenu() {
  if (!F.doc || !S.menu) return;
  try { const { menuHTML } = await import('/site-navigation.mjs'); const lang = (S.path.match(/^\/satin\/(fa|fr|es)(?:\/|$)/) || [])[1] || 'en'; const nav = F.doc.querySelector('.hdr .nav'); if (nav) nav.innerHTML = menuHTML(S.menu.items, false, lang); } catch (e) { console.warn(e); }
}
function pageDatalist() { return `<datalist id="pagelist">${S.pages.filter(p => p.lang === 'en').map(p => `<option value="${esc(p.path)}">${esc(p.title)}</option>`).join('')}</datalist>`; }

/* theme */
// Site themes: pure CSS (/themes/<id>.css on top of /themes/_base-modern.css); switching one only changes the look.
// sw = preview swatches [page, header, accent, button text on accent, footer, ink]
const SITE_THEMES = [
  { id: 'default', name: 'Default', desc: 'The original Satin Graphic look — no extra styling.', sw: ['#ffffff', '#ffffff', '#df2865', '#ffffff', '#f3f5f8', '#182333'] },
  { id: 'vivid', name: 'Vivid Crimson', desc: 'Brand crimson + deep navy, soft cards, richer heroes and gentle scroll animations.', sw: ['#ffffff', '#ffffff', '#c91c50', '#ffffff', '#0b1424', '#0f1a2c'] },
  { id: 'yellow-navy', name: 'Yellow & Navy', desc: 'Bold yellow buttons with navy text, navy header and footer.', sw: ['#ffffff', '#0b1f3a', '#ffc72c', '#0b1f3a', '#0b1f3a', '#0b1f3a'] },
  { id: 'midnight', name: 'Midnight Gold', desc: 'Dark luxe: near-black header and footer with warm gold accents on ivory.', sw: ['#fbfaf7', '#0e0f13', '#c9a227', '#121317', '#0e0f13', '#121317'] },
  { id: 'ocean', name: 'Clean Ocean', desc: 'Crisp white with ocean blue + teal and a deep-sea footer.', sw: ['#ffffff', '#ffffff', '#0077b6', '#ffffff', '#062a3f', '#0b2233'] },
  { id: 'forest', name: 'Forest', desc: 'Emerald green, soft green-grey sections and a deep forest footer.', sw: ['#ffffff', '#ffffff', '#1f7a4d', '#ffffff', '#0d2b1f', '#10241b'] },
  { id: 'carbon', name: 'Carbon Studio', desc: 'Cinematic full-dark look: near-black pages, bold uppercase headings, electric-blue buttons and glassy cards.', sw: ['#121116', '#16151b', '#2ea7ff', '#04111d', '#0b0a0e', '#ffffff'], deco: 'radial-gradient(60% 70% at 85% 10%,rgb(46 167 255/.35),transparent 70%)' },
  { id: 'labs', name: 'Playful Labs', desc: 'Warm off-white with soft colourful blobs, rounded white cards, pill buttons and gradient headline accents.', sw: ['#f1efea', '#f1efea', '#1f1f1f', '#ffffff', '#1f1f1f', '#1f1f1f'], deco: 'radial-gradient(30% 45% at 92% 20%,#4aee8a99,transparent 70%),radial-gradient(28% 40% at 8% 90%,#5b9bff88,transparent 70%),radial-gradient(26% 40% at 60% 100%,#fbb9f599,transparent 70%)' },
  { id: 'cupertino', name: 'Cupertino', desc: 'Inspired by Apple’s product pages: white and soft-grey tiles, huge tight headlines, a thin glassy header and blue pill buttons.', sw: ['#ffffff', '#f5f5f7', '#0071e3', '#ffffff', '#f5f5f7', '#1d1d1f'] },
  { id: 'galaxy', name: 'Galaxy', desc: 'Inspired by Samsung’s website: crisp white, bold black headlines, black pill buttons, grey hero banners and rounded card grids.', sw: ['#ffffff', '#ffffff', '#000000', '#ffffff', '#f4f4f4', '#000000'], deco: 'linear-gradient(#f4f4f4 0 46%,transparent 46%)' },
  { id: 'obsidian', name: 'Obsidian', desc: 'Dark: true-black pages with neon teal and cyan accents, glowing edges and glassy black cards.', sw: ['#000000', '#000000', '#00e5ff', '#001417', '#000000', '#ffffff'], deco: 'radial-gradient(55% 65% at 85% 10%,rgb(0 229 255/.32),transparent 70%)' },
  { id: 'graphite-red', name: 'Graphite Red', desc: 'Dark automotive look: charcoal graphite, racing-red buttons and stripes, uppercase italic headlines.', sw: ['#16171a', '#111214', '#e10600', '#ffffff', '#0f1012', '#f4f4f5'], deco: 'radial-gradient(50% 60% at 88% 12%,rgb(225 6 0/.3),transparent 70%)' },
  { id: 'royal-night', name: 'Royal Night', desc: 'Dark: deep navy and violet night sky with warm gold buttons and fine gold lines.', sw: ['#0a0e24', '#0a0e24', '#e3b34c', '#0a0e24', '#070a1c', '#f6f2ff'], deco: 'radial-gradient(45% 55% at 10% 0%,rgb(167 139 250/.35),transparent 70%),radial-gradient(40% 50% at 88% 12%,rgb(227 179 76/.28),transparent 70%)' },
  { id: 'sunset', name: 'Sunset', desc: 'Warm peach pages, orange-to-rose gradient buttons, soft sun glows and a deep plum footer.', sw: ['#fffaf5', '#fffaf5', '#d9480f', '#ffffff', '#2a1018', '#2b1610'], deco: 'radial-gradient(45% 60% at 88% 10%,rgb(255 166 92/.45),transparent 70%)' },
  { id: 'explore', name: 'Satin Explore', desc: 'New layout: one simple menu (All products & services + 5 links), big search, scroll-video hero that ends on “pick your vehicle”, red line-icon service grid, “Made by Satin” and a phone tab bar. Full live preview: open any page with ?theme=explore', sw: ['#f6f5f1', '#f6f5f1', '#d71f3a', '#ffffff', '#161616', '#161616'] },
  { id: 'mono', name: 'Mono', desc: 'Black & white editorial: serif headlines, hairline rules, square black buttons and a black footer.', sw: ['#ffffff', '#ffffff', '#000000', '#ffffff', '#000000', '#000000'] },
];
// readable bar colour on a swatch background (light swatch -> theme ink, dark swatch -> white)
const swLight = h => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255 > 0.6; };
const siteThemeOf = t => SITE_THEMES.some(x => x.id === t?.siteTheme) ? t.siteTheme : (t?.siteStyle === 'classic' ? 'default' : 'vivid');
function themeCard(th, cur, live) {
  const [bg, hdr, acc, onAcc, ftr, ink] = th.sw;
  const hdrInk = swLight(hdr) ? (swLight(ink) ? '#182333' : ink) : '#ffffff';
  return `<div class="thm${th.id === cur ? ' on' : ''}" data-thm="${th.id}">
    <div class="thm-pv" style="background:${bg}${th.deco ? `;background-image:${th.deco}` : ''}" aria-hidden="true">
      <div class="thm-h" style="background:${hdr};border-bottom:1px solid ${swLight(hdr) ? '#0001' : hdr}"><i style="background:${hdrInk}"></i><i style="background:${hdrInk};opacity:.35;width:22%"></i><b style="background:${acc}"></b></div>
      <div class="thm-b"><i style="background:${ink};width:62%"></i><i style="background:${ink};opacity:.25;width:80%;height:4px"></i><span style="background:${acc};color:${onAcc}">Get a quote</span><em style="background:${acc}"></em></div>
      <div class="thm-f" style="background:${ftr}"></div>
    </div>
    <div class="thm-t"><b>${esc(th.name)}</b>${th.id === live ? '<em class="live">Live</em>' : ''}${th.id === cur ? '<em>Selected</em>' : ''}</div>
    <p>${esc(th.desc)}</p>
    ${th.id === cur ? '<button class="btn sm block" disabled>Current theme</button>' : `<button class="btn sm block pri" data-apply-theme="${th.id}">Apply</button>`}
  </div>`;
}
const THEME_COLORS = [['accent', 'Accent (brand)'], ['accent2', 'Accent 2'], ['accentSoft', 'Accent light'], ['ink', 'Headings & text'], ['ink2', 'Body text'], ['muted', 'Muted text'], ['bg', 'Page background'], ['bg2', 'Alternate background'], ['btn', 'Button'], ['btnInk', 'Button text'], ['line', 'Lines & borders'], ['headerBg', 'Header background'], ['footerBg', 'Footer background']];
let themeTimer = 0;
async function panelTheme(b) {
  if (!S.theme || S.themeLive === undefined) { b.innerHTML = '<p class="hint">Loading…</p>'; try { const d = await api('/site/theme'); S.theme = d.theme; S.themeDraft = d.hasDraft; S.themeLive = siteThemeOf(d.published); } catch (e) { b.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; } if (S.panel === 'theme') renderPanel(); return; }
  const t = S.theme; if (!t.colors || Array.isArray(t.colors)) t.colors = {}; if (!t.fonts || Array.isArray(t.fonts)) t.fonts = {};
  const save = (redraw) => { S.themeDraft = true; clearTimeout(themeTimer); themeTimer = setTimeout(async () => { try { const r = await api('/site/theme/save', { theme: S.theme }); S.themeCSS = r.css; applyThemePreview(); } catch (e) { toast(e.message, true); } }, 250); if (redraw) renderPanel(); };
  const tabs = [['themes', 'Themes'], ['colors', 'Colours'], ['type', 'Text styles'], ['fonts', 'Fonts'], ['styles', 'Saved styles']];
  let h = `<div class="tabsm">${tabs.map(([k, l]) => `<button data-tt="${k}" class="${themeTab === k ? 'on' : ''}">${l}</button>`).join('')}</div><p class="hint" style="margin-top:0">Site-wide design. You see changes right away; visitors see them after you publish the theme.</p>`;
  if (themeTab === 'themes') {
    const cur = siteThemeOf(t);
    h += `<p class="hint">Pick a theme to preview it on this page right away. Themes only change colours, fonts and decoration — every button, form, price and page works exactly the same. Visitors see it after you press <b>Publish theme</b>. Choose <b>Default</b> to return to the original look.</p><div class="thm-grid">${SITE_THEMES.map(th => themeCard(th, cur, S.themeLive)).join('')}</div>`;
    if (Object.keys(t.colors || {}).length) h += `<p class="hint">You also have custom brand colours in <b>Colours</b>; they stay on top of any theme. Use “Reset to original design” below to clear them.</p>`;
  } else if (themeTab === 'colors') {
    h += `<p class="hint" style="margin-top:0">Whole-site looks (Default, Vivid Crimson, Yellow &amp; Navy…) are in the <b>Themes</b> tab. Colours set here stay on top of the chosen theme.</p>`;
    h += group('Brand colours', THEME_COLORS.map(([k, l]) => fColor(l, t.colors[k] || '', v => { if (v) t.colors[k] = v; else delete t.colors[k]; save(); })).join(''));
    const pal = t.palette || [];
    h += group('Colour palette (swatches in every colour picker)', `<div class="pal">${pal.map((c, i) => `<span style="background:${esc(c)}"><button data-c="${onCtl(() => { pal.splice(i, 1); t.palette = pal; save(true); })}" title="Remove">×</button></span>`).join('')}<label class="paladd" title="Add colour"><input type="color" data-c="${onCtl(el => { t.palette = [...pal, el.value]; save(true); })}">+</label></div>`);
    const mw = (t.menuWraps && !Array.isArray(t.menuWraps)) ? t.menuWraps : (t.menuWraps = {});
    const mws = (k) => v => { if (v === '' || v === null || v === undefined) delete mw[k]; else mw[k] = k === 'weight' ? +v : v; if (!Object.keys(mw).length) delete t.menuWraps; save(k === 'style'); };
    h += group('Menu: Vehicle Wraps button', `${fButtons('Look', mw.style || 'plain', [['plain', 'Like other items'], ['pill', 'Filled button']], mws('style'))}${fSelect('Boldness', mw.weight ? String(mw.weight) : '', [['', 'Bold (default)'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']], mws('weight'))}${fColor('Text colour', mw.color || '', mws('color'))}${(mw.style === 'pill') ? fColor('Button colour', mw.bg || '', mws('bg')) : ''}`);
    h += group('Shapes', `${fButtons('Buttons', t.buttonStyle || '', [['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']], v => { if (v) t.buttonStyle = v; else delete t.buttonStyle; save(true); })}${fRange('Corner roundness', t.radius ?? '', 0, 3, 0.1, v => { if (v !== '') t.radius = v; else delete t.radius; save(); }, '×')}`);
  } else if (themeTab === 'type') {
    t.typo = t.typo || {}; t.typoM = t.typoM || {};
    const mob = isMobile();
    const key = mob ? 'typoM' : 'typo';
    h += mob ? '<div class="mobile-note">Editing text sizes for <b>phones</b>.</div>' : '';
    h += group('Fonts', `${fFont('Headings', t.fonts.heading || '', v => { if (v) t.fonts.heading = v; else delete t.fonts.heading; save(); })}${fFont('Body text', t.fonts.body || '', v => { if (v) t.fonts.body = v; else delete t.fonts.body; save(); })}
      ${fSelect('Heading weight', t.headingWeight || '', [['', 'Default'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']], v => { if (v) t.headingWeight = +v; else delete t.headingWeight; save(); })}${fRange('Base text size', t.baseSize || '', 13, 20, 0.5, v => { if (v) t.baseSize = v; else delete t.baseSize; save(); }, 'px')}`);
    for (const [k, l] of [['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['h5', 'Heading 5'], ['h6', 'Heading 6'], ['p', 'Paragraph'], ...(mob ? [] : [['btn', 'Buttons']])]) {
      const s = (t[key][k] ||= {});
      const st = (p, live) => v => { if (v === '' || v === null) delete s[p]; else s[p] = v; save(); };
      h += group(l, `<div class="typo-pv ${k}" style="${esc(RT.styleText(s))}">${l === 'Paragraph' ? 'The quick brown fox jumps over the lazy dog.' : l}</div>${mob ? '' : `<div class="grid2">${fFont('Font', s.fontFamily, st('fontFamily'))}${fSelect('Weight', s.fontWeight || '', [['', 'Default'], ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']], st('fontWeight'))}</div>`}
        <div class="grid3">${fNum('Size', s.fontSize, st('fontSize'), { unit: 'px' })}${fNum('Line height', s.lineHeight, st('lineHeight'), { step: 0.05 })}${fNum('Spacing', s.letterSpacing, st('letterSpacing'), { unit: 'px', step: 0.5 })}</div>
        ${mob ? '' : fColor('Colour', s.color, st('color')) + fSelect('Case', s.textTransform || '', [['', 'Default'], ['uppercase', 'UPPERCASE'], ['capitalize', 'Capitalize'], ['none', 'none']], st('textTransform'))}`, { closed: true });
    }
  } else if (themeTab === 'fonts') {
    const cf = t.customFonts || [];
    h += group('Uploaded fonts', `${cf.length ? cf.map((f, i) => `<div class="fontrow"><b style="font-family:'${esc(f.name)}'">${esc(f.name)}</b><small>${esc(f.url.split('/').pop())}</small><button class="ib" data-c="${onCtl(() => { cf.splice(i, 1); t.customFonts = cf; save(true); })}" title="Remove">${ic('trash')}</button></div>`).join('') : '<p class="hint" style="margin-top:0">No custom fonts yet.</p>'}
      <button class="btn sm" data-c="${onCtl(() => pickMedia(url => promptBox('Font name', 'Name to show in the font lists', url.split('/').pop().replace(/-[a-f0-9]{8}\.\w+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), name => { if (!name) return; t.customFonts = [...cf, { name: name.replace(/[^\w -]/g, '').slice(0, 38), url }]; save(true); toast('Font added — choose it in any font list'); }), { kind: 'font' }))}">${ic('plus')} Upload a font (WOFF2, TTF, OTF)</button>
      <p class="hint">Make sure you have the licence to use the font on a website.</p>`);
  } else {
    const list = t.styles || [];
    h += group('Saved styles', list.length ? list.map((s, i) => `<div class="fontrow"><b>${esc(s.name)}</b><small>${Object.keys(s.style || {}).length} settings</small><button class="ib" data-c="${onCtl(() => promptBox('Rename style', 'Name', s.name, v => { if (v) { s.name = v; save(true); } }))}" title="Rename">${ic('edit')}</button><button class="ib" data-c="${onCtl(() => { list.splice(i, 1); t.styles = list; save(true); })}" title="Delete">${ic('trash')}</button></div>`).join('') : '<p class="hint" style="margin-top:0">Select an element, open Design and press “Save style” to reuse its look on other elements.</p>');
  }
  h += `<div class="group"><h4>Publish</h4><div class="gb">${S.canPublish ? '<button class="btn pri block" data-pubtheme>Publish theme</button>' : '<p class="hint">Ask an admin to publish the theme.</p>'}
      <div class="actions" style="margin-top:10px"><button class="btn ghost sm" data-resettheme>Reset to original design</button></div><p class="hint">${S.themeDraft ? 'You have unpublished theme changes.' : 'The theme is up to date.'}</p></div></div>`;
  b.innerHTML = h;
  $$('[data-tt]', b).forEach(x => x.onclick = () => { themeTab = x.dataset.tt; renderPanel(); });
  $$('[data-apply-theme]', b).forEach(x => x.onclick = () => { const id = x.dataset.applyTheme; if (!SITE_THEMES.some(th => th.id === id)) return; t.siteTheme = id; t.siteStyle = id === 'default' ? 'classic' : 'vivid'; save(true); toast(`${SITE_THEMES.find(th => th.id === id).name} theme — preview only until you publish`); });
  const pt = $('[data-pubtheme]', b); if (pt) pt.onclick = () => confirmBox('Publish the theme?', 'The new colours, fonts and text styles will apply to the whole website.', 'Publish theme', async () => { try { await publishTheme(); toast('Theme published'); renderPanel(); } catch (e) { toast(e.message, true); } });
  $('[data-resettheme]', b).onclick = () => confirmBox('Reset the theme?', 'All colours, fonts and text styles go back to the original website design (after you publish). Your chosen theme, saved styles and uploaded fonts are kept.', 'Reset', () => { S.theme = { colors: {}, fonts: {}, customFonts: t.customFonts, styles: t.styles, palette: t.palette, siteTheme: siteThemeOf(t), siteStyle: siteThemeOf(t) === 'default' ? 'classic' : 'vivid' }; save(true); });
}
export async function publishTheme() { clearTimeout(themeTimer); await api('/site/theme/save', { theme: S.theme }); await api('/site/theme/publish', {}); S.themeDraft = false; S.themeLive = siteThemeOf(S.theme); }
export async function applyThemePreview() {
  if (!F.doc) return;
  if (S.themeCSS === undefined && S.theme) { try { S.themeCSS = (await api('/site/theme/css', { theme: S.theme })).css; } catch { return; } }
  if (S.themeCSS === undefined) return;
  let st = F.doc.getElementById('cms-theme-preview');
  if (!st) { st = F.doc.createElement('style'); st.id = 'cms-theme-preview'; F.doc.head.append(st); }
  F.doc.documentElement.dataset.style = siteThemeOf(S.theme) === 'default' ? 'classic' : 'vivid';
  // the page's published theme block (/batch.css) may import another theme: drop those imports once so only the draft theme shows
  if (!F.doc._themeImportsOff) { try { for (const sh of F.doc.styleSheets) if (/\/batch\.css(\?|$)/.test(sh.href || '')) for (let i = sh.cssRules.length - 1; i >= 0; i--) { const r = sh.cssRules[i]; if (r instanceof F.doc.defaultView.CSSImportRule && /\/(themes\/|theme-vivid\.css)/.test(r.href)) sh.deleteRule(i); } F.doc._themeImportsOff = true; } catch { } }
  const css = S.themeCSS || '';
  const re = /@import url\("[^"]*"\);/g;
  const imports = css.match(re) || [];
  st.textContent = imports.join('\n') + '\n' + css.replace(re, '');
  if (S.menu) previewMenu();
  // uploaded fonts also in the editor UI (for previews in the font lists)
  for (const f of S.theme?.customFonts || []) if (!document.fonts.check(`12px "${f.name}"`)) { try { const ff = new FontFace(f.name, `url(${f.url})`); ff.load().then(x => document.fonts.add(x)).catch(() => { }); } catch { } }
}

/* media */
let mediaKind = 'all';
async function panelMedia(b) {
  b.innerHTML = '<p class="hint">Loading…</p>';
  try { await loadMedia(); } catch (e) { b.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  const kinds = [['all', 'All'], ['image', 'Images'], ['vector', 'SVG'], ['video', 'Video'], ['audio', 'Audio'], ['font', 'Fonts'], ['lottie', 'Lottie']];
  const mine = S.media.filter(m => mediaKind === 'all' || m.kind === mediaKind);
  b.innerHTML = `${DROP(true)}<div class="chips" style="margin:10px 0">${kinds.map(([k, l]) => `<button data-mk="${k}" class="${mediaKind === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="cat">Your uploads (${mine.length})</div>${mine.length ? mediaGrid(mine, 'data-m') : '<p class="hint">Nothing here yet.</p>'}${mediaKind === 'all' || mediaKind === 'image' ? `<div class="cat">Website images</div>${mediaGrid(S.siteImages.slice(0, 120), 'data-m')}` : ''}`;
  dropZone(b, files => uploadFiles(files, () => panelMedia(b)));
  $$('[data-mk]', b).forEach(x => x.onclick = () => { mediaKind = x.dataset.mk; panelMedia(b); });
  $$('[data-m]', b).forEach(x => x.onclick = () => mediaDetails(S.media.find(m => m.url === x.dataset.m) || { url: x.dataset.m, name: x.dataset.m.split('/').pop(), kind: 'image' }, b));
}
function mediaDetails(m, panelBody) {
  const k = m.kind || 'image';
  const pv = k === 'image' || k === 'vector' ? `<img src="${esc(m.url)}" alt="" style="max-width:100%;max-height:50vh;display:block;margin:0 auto 14px;border-radius:8px">` : k === 'video' ? `<video src="${esc(m.url)}" controls style="max-width:100%;max-height:50vh;display:block;margin:0 auto 14px"></video>` : k === 'audio' ? `<audio src="${esc(m.url)}" controls style="width:100%;margin-bottom:14px"></audio>` : `<p class="hint">${esc(k)} file</p>`;
  const m2 = modal(m.name, `${pv}<div class="copy row"><input class="in" readonly value="${esc(m.url)}"><button class="btn sm" style="flex:none" data-copy>Copy link</button></div>
    ${m.width ? `<p class="hint">${m.width}×${m.height}px · ${Math.round((m.bytes || 0) / 1024)} KB · uploaded by ${esc(m.createdBy || '')}</p>` : ''}`,
    { footer: `${m.id ? '<button class="btn danger" data-delm>Delete</button>' : ''}<button class="btn" data-add>Add to page</button><button class="btn ghost" data-close>Close</button>` });
  $('[data-copy]', m2.el).onclick = () => { navigator.clipboard.writeText(location.origin + m.url); toast('Link copied'); };
  $('[data-add]', m2.el).onclick = () => { m2.close(); const kind = k === 'image' ? 'image' : k; if (k === 'font') { toast('Add fonts in Theme › Fonts'); return; } addElement({ kind, w: k === 'audio' ? 380 : Math.min(520, m.width || 400), h: k === 'audio' ? 60 : m.width ? Math.round(Math.min(520, m.width) * (m.height / m.width)) : 300, p: { src: m.url, controls: true } }); };
  const d = $('[data-delm]', m2.el); if (d) d.onclick = () => confirmBox('Delete this file?', 'Pages that still use it will show it as missing.', 'Delete', async () => { try { await api('/media/delete', { id: m.id }); S.media = S.media.filter(x => x.id !== m.id); m2.close(); toast('Deleted'); panelMedia(panelBody); } catch (e) { toast(e.message, true); } });
}

/* seo */
function panelSeo(b) {
  const s = C().seo = C().seo || {};
  const doc = F.doc;
  const curT = doc?.title || '', curD = doc?.querySelector('meta[name="description"]')?.content || '';
  const set = (k, v) => { if (v === '' || v === undefined) delete s[k]; else s[k] = v; commit({ keepPanel: true }); prev(); };
  b.innerHTML = `<div class="gprev" data-gprev></div>
    ${fText('Page title', s.title || '', v => set('title', v), { hint: 'about 50–60 characters', ph: curT })}
    ${fText('Description', s.description || '', v => set('description', v), { area: true, rows: 4, hint: 'about 150 characters', ph: curD })}
    ${fImage('Image when shared (Facebook, WhatsApp…)', s.image || '', v => set('image', v))}
    ${fSwitch('Hide this page from Google', !!s.noindex, v => set('noindex', v || undefined))}
    <p class="hint">SEO changes go live when you publish this page.</p>`;
  const prev = () => { const g = $('[data-gprev]', b); if (g) g.innerHTML = `<small>satingraphic.ca${esc(S.path.replace(/^\/satin/, '') || '')}</small><b>${esc(s.title || curT)}</b><p>${esc((s.description || curD).slice(0, 160))}</p>`; };
  prev();
}

/* history */
async function panelHistory(b) {
  // undo steps of this session (newest first): click one to go back or forward to it
  const steps = [...S.undo.map((u, i) => ({ ...u, n: i - S.undo.length + 1 })), ...S.redo.slice().reverse().map((r, i) => ({ ...r, n: i + 1, future: true }))];
  const tm = t => t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '';
  b.innerHTML = `<div class="group" style="border:0;padding-top:0"><h4>Changes this session</h4><div class="gb"><ol class="hist" role="list">${[...steps].reverse().map(x => `<li><button type="button" data-hj="${x.n}" class="${x.future ? 'future' : x.n === 0 ? 'cur' : ''}" title="${x.future ? 'Redo up to here' : 'Go back to just after this step'}"><b>${esc(x.label || 'Edit')}</b><small>${tm(x.t)}</small></button></li>`).join('')}<li><button type="button" data-hj="${-S.undo.length}" class="${!S.undo.length ? 'cur' : ''}"><b>Page as loaded</b><small>start of this session</small></button></li></ol>
    <p class="hint">Ctrl+Z / Ctrl+Shift+Z step through the same list. Theme and site-menu changes are saved separately and are not part of this list.</p></div></div>
    <div class="group"><h4>This page</h4><div class="gb"><p class="hint" style="margin-top:0">${S.hasDraft ? 'You have changes that are not published yet. Every change is saved automatically as a draft.' : S.published ? 'Published' + (S.publishedAt ? ' · ' + new Date(S.publishedAt).toLocaleString() : '') : 'This page has no edits yet.'}</p>
    ${S.hasDraft ? `<button class="btn ghost sm" data-discard>${S.published ? 'Discard unpublished changes' : 'Discard all changes'}</button>` : ''}</div></div>
    <div class="group"><h4>Published versions</h4><div class="gb" data-versions><p class="hint">Loading…</p></div></div>`;
  // the newest undo step is the current state: jumping to step n (≤0) means undoing -n... steps after it
  $$('[data-hj]', b).forEach(x => x.onclick = () => { const n = +x.dataset.hj; historyJump(n === 0 ? 0 : n < 0 ? n : n); });
  const d = $('[data-discard]', b); if (d) d.onclick = discardDraft;
  try {
    const r = await api('/site/history?scope=' + encodeURIComponent('page:' + S.path));
    const box = $('[data-versions]', b); if (!box) return;
    box.innerHTML = r.versions.length ? `<div class="plist">${r.versions.map((v, i) => `<a href="#" data-v="${v.id}"><div><b>${new Date(v.createdAt).toLocaleString()}</b><small>${esc(v.createdBy || '')}${i === 0 ? ' · current' : ''}</small></div><span class="btn ghost sm">Restore</span></a>`).join('')}</div>` : '<p class="hint">No published versions yet.</p>';
    $$('[data-v]', box).forEach(a => a.onclick = e => { e.preventDefault(); confirmBox('Restore this version?', 'The page goes back to this version as a draft. Publish to make it live.', 'Restore', async () => { try { const v = await api('/site/version?id=' + a.dataset.v); S.content = normalize(v.content); commit({ label: 'Restore published version' }); toast('Version restored as a draft'); } catch (er) { toast(er.message, true); } }); });
  } catch (e) { const box = $('[data-versions]', b); if (box) box.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
}
export function discardDraft() {
  confirmBox('Discard unpublished changes?', S.published ? 'The page goes back to the published version.' : 'The page goes back to the original website version.', 'Discard', async () => {
    try { clearTimeout(S.saveTimer); S.dirty = false; await api('/site/discard', { path: S.path }); toast('Changes discarded'); await loadPages(); loadPage(S.path, true); } catch (e) { toast(e.message, true); }
  });
}
hooks.discardDraft = discardDraft;

/* ---------- publish ---------- */
async function publish() {
  if (!S.canPublish) return;
  finishInline();
  const btn = $('[data-publish]'); btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    await flush();
    await api('/site/publish', { path: S.path });
    S.hasDraft = false; S.published = true; S.publishedAt = new Date().toISOString();
    const p = S.pages.find(x => x.path === S.path); if (p) { p.draft = false; p.edited = true; }
    toast('Published! The page is live.');
    if (S.panel === 'pages' || S.panel === 'history') renderPanel();
  } catch (e) { toast(e.message, true); }
  btn.textContent = 'Publish'; setStatus();
}

hooks.publish = publish;

/* ---------- boot ---------- */
export async function loadPages(refresh) { const d = await api('/site/pages' + (refresh ? '?refresh=1' : '')); S.pages = d.pages; }
export async function boot() {
  let me;
  try { me = await api('/me'); } catch (e) { $('#app').innerHTML = `<div class="boot"><div><b>Editor unavailable</b><p>${esc(e.message)}</p></div></div>`; return; }
  if (!me.user) { location.href = '/admin/#/login'; return; }
  S.me = me.user; S.csrf = me.csrf; S.perms = me.permissions;
  if (!S.perms.includes('site.edit')) { $('#app').innerHTML = '<div class="boot"><div><b>No access to the website editor</b><p>Ask the owner to give your role “Edit website content”.</p><a class="btn" href="/admin/">Back to the admin</a></div></div>'; return; }
  try {
    const [bs] = await Promise.all([api('/site/bootstrap'), loadPages()]);
    S.canPublish = bs.canPublish; S.fonts = bs.fonts;
  } catch (e) { $('#app').innerHTML = `<div class="boot"><div><b>Editor unavailable</b><p>${esc(e.message)}</p></div></div>`; return; }
  for (const k of ['grid', 'snap', 'rulers', 'snapGrid', 'smartGuides', 'smartSpacing', 'gridSize', 'snapTol', 'textScale']) { const v = prefs(k); if (v !== null) S[k] = v; }
  if (prefs('snapGrid') === null && S.grid) S.snapGrid = true; // before v3.2 the grid button meant "show + snap"
  S.gridSize = Math.max(2, Math.min(200, num(S.gridSize) || 10)); S.snapTol = Math.max(1, Math.min(30, num(S.snapTol) || 6));
  layout();
  loadMedia().catch(() => { });
  api('/site/theme').then(d => { S.theme = d.theme; S.themeDraft = d.hasDraft; applyThemePreview(); }).catch(() => { });
  api('/site/menu').then(d => { S.menu = d.menu; S.menuDraft = d.hasDraft; if (d.hasDraft) previewMenu(); }).catch(() => { });
  const start = decodeURIComponent(location.hash.slice(1));
  loadPage(/^\/satin(\/[a-z0-9-]+)*$/.test(start) ? start : '/satin', true);
}
