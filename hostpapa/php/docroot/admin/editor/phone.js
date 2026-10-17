/* Satin editor — phone layout (≤900px wide): full-screen page preview, bottom toolbar, bottom sheets,
   tap-to-select with an action bar. Everything calls the same functions as the desktop editor
   (act(), openPanel(), setDevice(), publish…), so new editor features show up here automatically. */
import { S, F, $, $$, esc, ic, hooks, undo, redo, toast, elById, blockById } from './core.js?v=8';
import { modal } from './ui.js?v=8';
import { setDevice, openPanel, setPreview, publishTheme, publishMenu } from './panels.js?v=8';
import { act, select, finishInline, elFor, labelFor, elKind, key, feNode, playAnimations, FE_MAIN } from './canvas.js?v=8';

const MQ = matchMedia('(max-width: 900px)');
const root = document.documentElement;
S.phone = MQ.matches;
root.classList.toggle('phone', S.phone);
if (S.phone) S.device = 'mobile'; // on a phone, edit the phone layout first

let inspOpen = false;
const inlineOn = () => !!F.doc?.activeElement?.isContentEditable;

/* ---------- layout additions (built once, hidden on desktop by CSS) ---------- */
hooks.afterLayout = () => {
  const ed = $('.ed'), top = $('.top'), stage = $('.stage');
  if (S.device !== 'desktop') $('[data-wrap]').classList.add(S.device);
  $$('[data-device]').forEach(b => b.dataset.lbl = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Phone' }[b.dataset.device]);
  $('[data-device="mobile"]').title = 'Phone layout';
  $('[data-device="desktop"]').title = 'Desktop layout';
  top.insertAdjacentHTML('beforeend', '<span class="pstatus" data-pstatus></span>');
  stage.insertAdjacentHTML('beforeend', `<div class="psel" data-psel hidden></div><button class="pexit" data-pexit>${ic('back')} Back to editing</button>`);
  const B = (k, icon, label, cls = '') => `<button data-pb="${k}" class="${cls}" aria-label="${label}">${ic(icon, k === 'add' ? 2.4 : 1.9)}<span>${label}</span></button>`;
  ed.insertAdjacentHTML('beforeend', `<nav class="pbar" aria-label="Editor tools">${B('pages', 'pages', 'Pages')}${B('add', 'plus', 'Add', 'padd')}${B('theme', 'theme', 'Theme')}${B('more', 'more', 'More')}${B('undo', 'undo', 'Undo')}${B('redo', 'redo', 'Redo')}${B('preview', 'eye', 'Preview')}<button data-pb="publish" class="ppub">${ic('check', 2.2)}<span>Publish</span></button></nav><div class="pback" data-pback></div>`);
  $$('[data-pb]').forEach(b => b.onclick = () => barAction(b.dataset.pb));
  $('[data-pback]').onclick = () => { openPanel(null); sync(); };
  $('[data-pexit]').onclick = () => setPreview(false);
  // keep the phone controls in step with the desktop ones (status, undo/redo, publish)
  const mo = new MutationObserver(() => sync());
  for (const sel of ['[data-status]', '[data-undo]', '[data-redo]', '[data-publish]', '[data-preview]']) { const n = $(sel); if (n) mo.observe(n, { attributes: true, childList: true, subtree: true, characterData: true }); }
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(onInspRender).observe($('[data-insp]'), { childList: true });
  const pn = $('[data-panel]');
  new MutationObserver(() => { addGrip(pn); sync(); }).observe(pn, { childList: true, attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(fitFrame).observe($('[data-wrap]'), { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', () => { fitFrame(); sync(); });
  setInterval(tick, 300);
  fitFrame(); sync();
};

MQ.addEventListener('change', () => {
  S.phone = MQ.matches; root.classList.toggle('phone', S.phone);
  F.doc?.documentElement.classList.toggle('cms-phone', S.phone);
  if (!S.phone) { closeInsp(); }
  fitFrame(); sync(); hooks.drawOverlay?.();
});

/* ---------- desktop / tablet layout on a phone: render at full width, scaled to fit ---------- */
function fitFrame() {
  const w = $('[data-wrap]'), st = $('.stage'); if (!w || !st) return;
  if (!S.phone || S.device === 'mobile') { if (w.style.transform) { w.style.width = w.style.height = w.style.transform = ''; } S.zoom = 1; return; }
  const W = S.device === 'tablet' ? 820 : 1280, z = st.clientWidth / W;
  w.style.width = W + 'px'; w.style.height = Math.ceil(st.clientHeight / z) + 'px'; w.style.transform = `scale(${z})`; w.style.transformOrigin = '0 0';
  S.zoom = z;
}

/* ---------- bottom toolbar ---------- */
function barAction(k) {
  if (k === 'undo') return undo();
  if (k === 'redo') return redo();
  if (k === 'preview') { closeInsp(); openPanel(null); return setPreview(!S.preview); }
  if (k === 'publish') return publishSheet();
  if (k === 'more') return moreSheet();
  togglePanel(k);
}
function togglePanel(k) {
  finishInline(); closeInsp();
  if (k === 'add' && S.sel) S._addTarget = null;
  openPanel(S.panel === k ? null : k);
  sync();
}
function moreSheet() {
  const items = [['layers', 'layers', 'Layers', 'All sections and elements — reorder, show or hide'], ['menus', 'menu', 'Site menu', 'Pages in the top menu'], ['media', 'image', 'Media library', 'Your photos, videos and files'], ['seo', 'seo', 'SEO for this page', 'Google title, description and share image'], ['history', 'clock', 'History', 'Published versions and discarding drafts'],
    ['tablet', 'tablet', S.device === 'tablet' ? 'Back to the phone layout' : 'Tablet layout', 'Fine-tune how the page looks on tablets'], ['anim', 'play', 'Play animations', 'Preview the page animations'], ['live', 'ext', 'Open the live page', 'See the published website'], ['admin', 'back', 'Back to the admin', 'Orders, quotes, invoices and more']];
  const m = modal('More', `<div class="plinks">${items.map(([k, i, l, d]) => `<button type="button" data-mk="${k}">${ic(i)}<span><b>${esc(l)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>`, { cls: 'psheet' });
  $$('[data-mk]', m.el).forEach(b => b.onclick = () => {
    const k = b.dataset.mk; m.close();
    if (k === 'tablet') setDevice(S.device === 'tablet' ? 'mobile' : 'tablet');
    else if (k === 'anim') playAnimations();
    else if (k === 'live') open(S.path + '/', '_blank', 'noopener');
    else if (k === 'admin') location.href = '/admin/';
    else togglePanel(k);
  });
}

/* ---------- publish ---------- */
const pageDraft = () => S.hasDraft || S.dirty || S.saving;
const anyDraft = () => pageDraft() || S.themeDraft || S.menuDraft;
function publishSheet() {
  finishInline();
  if (!S.canPublish) { toast('Your role can save drafts. Ask an admin to publish.', true); return; }
  const name = $('[data-pagename]')?.textContent || S.path;
  const rows = [['page', `This page: ${name}`, pageDraft()]];
  if (S.themeDraft) rows.push(['theme', 'Site theme (colours, fonts, text styles)', true]);
  if (S.menuDraft) rows.push(['menu', 'Site menu', true]);
  const m = modal('Publish to the website?', `<p class="hint" style="margin-top:0">Your changes are saved as a draft. Publishing makes them live on satingraphic.ca for every visitor.</p>
    <div class="pchks">${rows.map(([k, l, on]) => `<label class="pchk${on ? '' : ' off'}"><input type="checkbox" data-k="${k}" ${on ? 'checked' : 'disabled'}><span><b>${esc(l)}</b><small>${on ? 'Has unpublished changes' : 'Nothing new to publish'}</small></span></label>`).join('')}</div>`,
    { cls: 'psheet', footer: '<button class="btn ghost" data-close>Not now</button><button class="btn pri" data-go>Publish now</button>' });
  const go = $('[data-go]', m.el), upd = () => go.disabled = !$$('[data-k]:checked', m.el).length;
  $$('[data-k]', m.el).forEach(x => x.onchange = upd); upd();
  go.onclick = async () => {
    const ks = $$('[data-k]:checked', m.el).map(x => x.dataset.k); m.close();
    const done = [];
    if (ks.includes('page')) { await hooks.publish?.(); if (!S.hasDraft) done.push('page'); }
    try { if (ks.includes('theme')) { await publishTheme(); done.push('theme'); } if (ks.includes('menu')) { await publishMenu(); done.push('menu'); } } catch (e) { toast(e.message, true); sync(); return; }
    if (done.length) toast('Published: ' + done.join(', ') + ' — live now');
    if (S.panel) hooks.renderPanel?.();
    sync();
  };
}

/* ---------- inspector as a bottom sheet ---------- */
const flash0 = hooks.flashInspector;
hooks.flashInspector = () => { if (S.phone) openInsp(); else flash0?.(); };
function openInsp() {
  if (!S.phone || !S.sel) return;
  finishInline();
  if (S.panel) openPanel(null);
  inspOpen = true; sync();
  setTimeout(revealSel, 60);
}
function closeInsp() { if (!inspOpen) return; inspOpen = false; const i = $('[data-insp]'); if (i) i.style.height = ''; sync(); }
function onInspRender() {
  const box = $('[data-insp]'); if (!box) return;
  if (!S.sel) closeInsp();
  const h = box.querySelector(':scope>header');
  if (h && !h.querySelector('.pclose')) { h.insertAdjacentHTML('afterbegin', `<div class="pgrip" aria-hidden="true"><i></i></div><button class="ib pclose" data-pclose aria-label="Close">${ic('x')}</button>`); h.querySelector('.pclose').onclick = closeInsp; }
  sync();
}
function addGrip(p) {
  if (!p || p.hidden || p.querySelector(':scope>.pgrip')) return;
  p.insertAdjacentHTML('afterbegin', '<div class="pgrip" aria-hidden="true"><i></i></div>');
}
// scroll the page so the selected element is visible above the sheet / action bar
function revealSel() {
  const el = elFor(S.sel); if (!el || !F.win) return;
  const fr = $('[data-frame]').getBoundingClientRect(), z = S.zoom || 1;
  const cover = inspOpen ? $('[data-insp]').getBoundingClientRect().top : ($('[data-psel]')?.getBoundingClientRect().top || innerHeight);
  const visH = (Math.min(cover, fr.bottom) - fr.top) / z;
  const r = el.getBoundingClientRect();
  if (r.top > visH - 60 || r.bottom < 40) F.win.scrollBy({ top: r.top - Math.max(12, Math.min(visH * 0.25, visH - r.height - 12)), behavior: 'smooth' });
}

/* drag the grip to resize; drag down to close; tap to expand */
document.addEventListener('pointerdown', e => {
  const g = e.target.closest?.('.pgrip'); if (!g || !S.phone) return;
  const sheet = g.closest('.insp,.panel'); if (!sheet) return;
  e.preventDefault();
  const h0 = sheet.getBoundingClientRect().height, y0 = e.clientY; let moved = false;
  sheet.classList.add('dragging');
  const mv = ev => { const dy = ev.clientY - y0; if (Math.abs(dy) > 5) moved = true; sheet.style.height = Math.max(90, Math.min(innerHeight * 0.94, h0 - dy)) + 'px'; };
  const up = () => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    sheet.classList.remove('dragging');
    const h = sheet.getBoundingClientRect().height;
    if (!moved) sheet.style.height = h0 > innerHeight * 0.8 ? '' : '92dvh';
    else if (h < innerHeight * 0.3) { sheet.style.height = ''; if (sheet.matches('.insp')) closeInsp(); else { openPanel(null); sync(); } }
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
});

/* close the sheet after picking something that changes the page */
document.addEventListener('click', e => { // capture: the panel re-renders (and detaches the target) while handling the click
  if (!S.phone) return;
  const p = e.target.closest?.('[data-panel]'); if (!p) return;
  const hit = e.target.closest('.plist [data-path], .etile, .tiles .tile, [data-ins], .lsec, .lel');
  if (!hit || e.target.closest('[data-eye],[data-lk],[data-tw],[data-mv]')) return;
  setTimeout(() => { openPanel(null); sync(); if (hit.matches('.lsec,.lel')) setTimeout(() => { hooks.drawOverlay?.(); revealSel(); }, 120); }, 0);
}, true);

/* ---------- selection action bar ---------- */
function actionsFor(t, el) {
  const A = [];
  if (S.multi.length > 1) {
    const grouped = S.multi.every(id => elById(id)?.group && elById(id).group === elById(S.multi[0]).group);
    A.push(grouped ? ['ungroup', 'ungroup', 'Ungroup'] : ['group', 'group', 'Group'], ['design', 'brush', 'Style'], ['dupe', 'copy', 'Duplicate'], ['del', 'trash', 'Delete']);
  } else if (t.type === 'fe') {
    const e = elById(t.id) || {}; const m = FE_MAIN[e.kind] || ['settings', 'Settings'];
    A.push([m[0], m[0] === 'image' ? 'image' : m[0] === 'inline' ? 'edit' : 'gear', m[1]]);
    if (m[0] !== 'settings') A.push(['settings', 'gear', 'Settings']);
    A.push(['design', 'brush', 'Style'], ['layout', 'layout', 'Size & position'], ['anim', 'anim', 'Animate'], ['dupe', 'copy', 'Duplicate'], ['del', 'trash', 'Delete'], ['parent', 'parent', 'Section']);
  } else if (t.type === 'el' || t.type === 'field') {
    if (el?.tagName === 'IMG') A.push(['image', 'image', 'Change image']);
    else if (el?.tagName === 'VIDEO') A.push(['video', 'film', 'Change video']);
    else if (elKind(el) === 'Container') A.push(['layout', 'layout', 'Layout']);
    else if (!(t.type === 'field' && /image/.test(t.field))) A.push(['inline', 'edit', 'Edit text']);
    A.push(['settings', 'gear', t.type === 'el' && el?.closest('a,button') ? 'Text & link' : 'Content'], ['design', 'brush', 'Style']);
    if (t.type === 'el') A.push(['hide', 'eyeoff', 'Hide'], ['reset', 'reset', 'Reset']);
    A.push(['parent', 'parent', t.type === 'field' ? 'Section' : 'Parent']);
  } else {
    const blk = t.type === 'block';
    A.push(['settings', 'edit', 'Edit'], ['design', 'brush', 'Style'], ['up', 'up', 'Move up'], ['down', 'down', 'Move down'], ['addhere', 'plus', 'Add element']);
    if (blk) A.push(['dupe', 'copy', 'Duplicate']);
    A.push(['hide', 'eyeoff', 'Hide']);
    if (blk) A.push(['del', 'trash', 'Delete']);
  }
  A.push(['more', 'more', 'More']);
  return A;
}
let selKey = '';
function renderSel() {
  const bar = $('[data-psel]'); if (!bar) return;
  const show = S.phone && S.sel && !S.preview && !inspOpen && !S.panel && S.frameReady;
  bar.hidden = !show;
  if (!show) { selKey = ''; return; }
  const inl = inlineOn();
  const k = key(S.sel) + '|' + S.multi.join(',') + '|' + inl + '|' + S.device + '|' + (S.undo.length);
  if (k === selKey) return; selKey = k;
  const t = S.sel, el = elFor(t);
  if (inl) { bar.innerHTML = `<div class="psel-h"><b>Editing text</b><small>Type with the keyboard · select words to format</small></div><div class="psel-a"><button class="on" data-pdone>${ic('check', 2.2)}<span>Done</span></button></div>`; $('[data-pdone]', bar).onmousedown = e => e.preventDefault(); $('[data-pdone]', bar).onclick = () => { finishInline(); F.doc?.activeElement?.blur?.(); sync(); }; return; }
  const name = S.multi.length > 1 ? `${S.multi.length} elements` : labelFor(t, el);
  const where = S.device === 'mobile' ? 'Phone layout' : S.device === 'tablet' ? 'Tablet layout' : 'Desktop layout';
  bar.innerHTML = `<div class="psel-h"><b>${esc(name)}</b><small>${where}</small><button class="pclose" data-pdesel aria-label="Deselect">${ic('x')}</button></div><div class="psel-a">${actionsFor(t, el).map(([a, i, l], n) => `<button data-pa="${a}" class="${n === 0 ? 'on' : ''}${a === 'del' ? ' danger' : ''}">${ic(i)}<span>${esc(l)}</span></button>`).join('')}</div>`;
  $('[data-pdesel]', bar).onclick = () => { select(null); sync(); };
  $$('[data-pa]', bar).forEach(b => b.onclick = () => {
    const a = b.dataset.pa;
    if (a === 'design' || a === 'layout' || a === 'anim' || a === 'settings') { S.tab = a; hooks.renderInspector?.(); openInsp(); return; }
    act(a, b);
    if (a === 'inline') setTimeout(() => { if (!inlineOn() && S.sel) openInsp(); else sync(); }, 80);
    if (a === 'up' || a === 'down') setTimeout(revealSel, 120);
    selKey = ''; setTimeout(sync, 30);
  });
}

/* ---------- state sync ---------- */
let touchNode = null;
function sync() {
  if (!$('.ed')) return;
  root.classList.toggle('p-insp', S.phone && inspOpen && !!S.sel && !S.preview);
  root.classList.toggle('p-panel', S.phone && !!S.panel && !S.preview);
  root.classList.toggle('p-inline', S.phone && inlineOn());
  $$('[data-pb]').forEach(b => b.classList.toggle('cur', ['pages', 'add', 'theme'].includes(b.dataset.pb) ? S.panel === b.dataset.pb : b.dataset.pb === 'preview' ? S.preview : false));
  const u = $('[data-pb=undo]'), r = $('[data-pb=redo]'); if (u) u.disabled = !S.undo.length; if (r) r.disabled = !S.redo.length;
  const pub = $('[data-pb=publish]'); if (pub) { pub.disabled = !S.canPublish || !anyDraft() || /…/.test($('[data-publish]')?.textContent || ''); pub.classList.toggle('pending', anyDraft()); }
  const ps = $('[data-pstatus]');
  if (ps) {
    const st = $('[data-status]'), err = st?.classList.contains('err');
    const [cls, txt] = err ? ['err', st.textContent] : S.saving ? ['saving', 'Saving…'] : pageDraft() ? ['draft', 'Unpublished changes'] : S.themeDraft || S.menuDraft ? ['draft', (S.themeDraft ? 'Theme' : 'Menu') + ' not published'] : S.published ? ['live', 'Published'] : ['none', 'No changes yet'];
    ps.className = 'pstatus ' + cls; ps.innerHTML = `<i></i>${esc(txt)}`;
  }
  // a selected free element can be dragged with a finger; everything else scrolls the page
  const tn = S.phone && S.sel?.type === 'fe' ? feNode(S.sel.id) : null;
  if (touchNode !== tn) { touchNode?.classList.remove('cms-touchsel'); tn?.classList.add('cms-touchsel'); touchNode = tn; }
  renderSel();
}
let lastState = '', lastSel = '';
function tick() {
  if (!S.phone) return;
  const sk = key(S.sel), k = [sk, inlineOn(), S.frameReady, S.undo.length, S.themeDraft, S.menuDraft, S.panel].join('|');
  if (k === lastState) return;
  lastState = k; sync();
  if (sk !== lastSel) { lastSel = sk; if (S.sel && !inspOpen) setTimeout(revealSel, 60); }
}
