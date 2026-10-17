/* Satin editor — the inspector (right panel). */
import { S, F, $, $$, esc, ic, num, round, clone, uid, hooks, RT, C, editFor, sectionFor, blockById, elById, secData, isBlock, commit, toast, api } from './core.js?v=8';
import { onCtl, wire, gcBind, liveCommit, commitNow, fText, fRange, fNum, fSize, fSelect, fSwitch, fButtons, fSeg, group, fSides, fImage, fLink, fGradient, fColor, pickMedia, promptBox, confirmBox, fmtNum } from './ui.js?v=8';
import { elFor, elKind, sectionName, feName, isMobile, isTablet, geom, setGeom, select, selectMany, zOrder, toggleLock, togglePin, group as groupEls, ungroup, align, toggleHidden, isHidden, moveSection, duplicateBlock, deleteBlock, duplicate, removeSelected, copyStyle, pasteStyle, saveTemplate, setField, setImage, playAnimations, startInline, feNode, layerRect, lockOf, isLocked, setLockPart, flip, toggleTextScale, isTextTarget, elTf, setElTf, setRot, feRot, startImgEdit, imgPreset, inFlow, enterIso, tfKey } from './canvas.js?v=8';
import { KIND_NAME, EL_NAME, ICON_NAMES } from './catalog.js?v=8';

const WEIGHTS = [['', 'Default'], ['100', 'Thin'], ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']];
export const fontOpts = () => [['', 'Default'], ...(S.theme?.customFonts || []).map(f => [f.name, f.name + ' (uploaded)']), ...[...new Set([...(S.fonts || []), ...RT.GOOGLE_FONTS])].filter(Boolean).map(f => [f, f])];
// Searchable font picker: a text box with a list of ~90 fonts (type to filter). Only fonts actually chosen are loaded on the public site.
export function fFont(label, value, fn) {
  let dl = document.getElementById('cms-font-list');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'cms-font-list'; document.body.append(dl); }
  const opts = fontOpts().slice(1);
  dl.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}">${v === l ? '' : esc(l)}</option>`).join('');
  const id = onCtl(el => {
    const t = el.value.trim().toLowerCase();
    if (!t || t === 'default') { el.value = ''; fn(''); return; }
    const hit = opts.find(([v]) => v.toLowerCase() === t) || opts.find(([v]) => v.toLowerCase().startsWith(t));
    if (!hit) { el.value = value || ''; toast('Pick a font from the list', true); return; }
    el.value = hit[0]; previewFont(hit[0]); fn(hit[0]);
  });
  if (value) previewFont(value);
  return `<label class="f"><span>${esc(label)}</span><input type="text" list="cms-font-list" autocomplete="off" spellcheck="false" placeholder="Default — type to search" value="${esc(value || '')}" style="${value ? `font-family:${esc(RT.fontStack(value))}` : ''}" data-c="${id}"></label>`;
}
// lets the editor's own UI show a chosen Google font (the page itself loads fonts through the runtime)
function previewFont(f) {
  if (!RT.GOOGLE_FONTS.includes(f)) return;
  const id = 'ed-font-' + f.replace(/\W/g, ''); if (document.getElementById(id)) return;
  const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = RT.fontHrefs(f)[1]; document.head.append(l);
}
const TEXTY = new Set(['text', 'button', 'marquee', 'menu', 'form', 'accordion', 'tabs', 'countdown', 'counter', 'progress', 'repeater', 'social', 'icon']);

/* ---------- accessors ---------- */
// style object for the current target, state (normal/hover/active) and device
function styleKeyFe() { return S.state === 'hover' ? 'hov' : S.state === 'active' ? 'act' : S.state === 'disabled' ? 'dis' : isMobile() ? 'mob' : isTablet() ? 'tab' : 'style'; }
const devNote = what => isMobile() ? `<div class="mobile-note">${what} apply to <b>mobile only</b>.</div>` : isTablet() ? `<div class="mobile-note tab">${what} apply to <b>tablet only</b> (701–1024px wide). Position and size are shared with desktop.</div>` : '';
function feTargets() { return S.multi.map(elById).filter(Boolean); }
function styleGetSet(t) {
  if (t.type === 'fe') {
    const k = styleKeyFe();
    return { get: () => elById(t.id)?.[k] || {}, set: (p, v) => { for (const e of feTargets()) { if (isLocked({ type: 'fe', id: e.id }, 'style')) continue; e[k] = e[k] || {}; e[k][p] = v; } } };
  }
  if (t.type === 'el') {
    const k = S.state === 'hover' ? 'hov' : isMobile() ? 'mobile' : isTablet() ? 'tablet' : 'style';
    return { get: () => editFor(t.selector)?.[k] || {}, set: (p, v) => { const x = editFor(t.selector, true); x[k] = x[k] || {}; x[k][p] = v; } };
  }
  if (t.type === 'section' || t.type === 'block') {
    const k = isMobile() ? 'mobile' : isTablet() ? 'tablet' : 'style';
    return { get: () => secData(t.id)?.[k] || {}, set: (p, v) => { const d = secData(t.id, true); d[k] = d[k] || {}; d[k][p] = v; } };
  }
  return { get: () => ({}), set: () => { } };
}
const up = (set, k, live) => v => { set(k, v); live ? liveCommit() : commitNow(); };

/* ---------- inspector shell ---------- */
export function flashInspector() { const b = $('[data-insp]'); if (!b) return; b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
hooks.flashInspector = flashInspector;
export function renderInspector() {
  const box = $('[data-insp]'); if (!box) return;
  gcBind();
  if (S.preview) { box.innerHTML = ''; return; }
  const t = S.sel; const el = elFor(t);
  const scroll = box.querySelector('.body')?.scrollTop || 0;
  if (!t || !el) { box.innerHTML = emptyInspector(); wireEmpty(box); return; }
  const tabsFor = t.type === 'fe' ? [['settings', 'Settings'], ['layout', 'Layout'], ['design', 'Design'], ['anim', 'Animate']] : [['content', t.type === 'section' || t.type === 'block' ? 'Section' : 'Content'], ['layout', 'Layout'], ['design', 'Design'], ['anim', 'Animate']];
  if (!tabsFor.some(([k]) => k === S.tab)) S.tab = tabsFor[0][0];
  let kind, title;
  if (t.type === 'fe') { const e = elById(t.id); kind = S.multi.length > 1 ? `${S.multi.length} elements` : EL_NAME[e?.kind] || 'Element'; title = S.multi.length > 1 ? 'Multiple selection' : feName(e); }
  else if (t.type === 'section') { kind = 'Section'; title = sectionName(el); }
  else if (t.type === 'block') { const b = blockById(t.id); kind = KIND_NAME[b?.kind] || 'Section'; title = b?.title || kind; }
  else { kind = t.type === 'field' ? 'Section element' : elKind(el); title = (el.alt || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60) || kind; }
  const tabsHtml = `<div class="itabs">${tabsFor.map(([k, l]) => { const id = onCtl(() => { S.tab = k; renderInspector(); }); return `<button data-c="${id}" class="${S.tab === k ? 'on' : ''}">${l}</button>`; }).join('')}</div>`;
  let body = '';
  if (t.type === 'fe') body = S.multi.length > 1 && S.tab === 'settings' ? multiPanel() : S.tab === 'settings' ? feSettings(elById(t.id)) : S.tab === 'layout' ? (S.multi.length > 1 ? multiPanel() : feLayout(elById(t.id))) : S.tab === 'design' ? designTab(t, elById(t.id)) : animTab(t);
  else if (t.type === 'el' || t.type === 'field') body = S.tab === 'content' ? elContent(t, el) : S.tab === 'layout' ? (t.type === 'el' ? elLayout(t, el) : '<p class="hint">Layout of section elements follows the section. Select the section to change its layout.</p>') : S.tab === 'design' ? (t.type === 'el' ? designTab(t, null, el) : fieldDesign(t)) : (t.type === 'el' ? animTab(t) : '<p class="hint">Select the section to animate it, or add free elements for individual animations.</p>');
  else body = S.tab === 'content' ? sectionContent(t, el) : S.tab === 'layout' ? sectionLayout(t, el) : S.tab === 'design' ? sectionDesign(t) : animTab(t);
  box.innerHTML = `<header><div class="kind">${esc(kind)}${isMobile() ? ' <em class="mob">Mobile</em>' : isTablet() ? ' <em class="mob">Tablet</em>' : ''}</div><h3>${esc(title)}</h3>${tabsHtml}</header><div class="body">${body}</div>`;
  wire(box);
  const b = box.querySelector('.body'); if (b) b.scrollTop = scroll;
}
hooks.renderInspector = renderInspector;
function emptyInspector() {
  return `<div class="empty-insp"><h3>Edit this page</h3><ul><li><b>Click</b> anything to select it — a toolbar appears above it.</li><li><b>Double-click</b> text to type on the page.</li><li><b>Add (+)</b> elements, then drag, resize and rotate them.</li><li><b>Shift-click</b> to select several, <b>Ctrl+G</b> to group.</li><li><b>Right-click</b> for copy, paste, layers and more.</li><li>Switch to <b>mobile</b> to fine-tune the phone layout.</li><li>Changes save as a <b>draft</b>; visitors see them after <b>Publish</b>.</li></ul>
    <div class="actions"><button class="btn ghost sm" data-shortcuts>${ic('keyboard')} Keyboard shortcuts</button><button class="btn ghost sm" data-playall>${ic('play')} Preview animations</button></div>
    <div class="group"><h4>This page</h4><div class="gb"><p class="hint" style="margin-top:0">${esc(S.path)}/</p>${fSelect('Custom cursor', C().page?.cursor || '', [['', 'Normal'], ['dot', 'Dot'], ['ring', 'Ring'], ['blob', 'Blob']], v => { if (v) C().page = { cursor: v }; else delete C().page; commitNow(); })}${S.hasDraft ? `<button class="btn ghost sm" data-discard>Discard unpublished changes</button>` : ''}</div></div></div>`;
}
function wireEmpty(box) {
  wire(box);
  const d = $('[data-discard]', box); if (d) d.onclick = () => hooks.discardDraft?.();
  $('[data-shortcuts]', box).onclick = () => hooks.shortcuts?.();
  $('[data-playall]', box).onclick = () => playAnimations();
}
const stateSwitch = (opts) => `<div class="statesw">${fSeg(opts, S.state, v => { S.state = v; renderInspector(); })}</div>`;

/* ---------- free element: settings ---------- */
function setP(e, k, live) { return v => { e.p = { ...(e.p || {}), [k]: v }; live ? liveCommit() : commit({ keepInspector: true }); }; }
function linkField(e) { return fLink('Link', e.link, v => { if (v) e.link = v; else delete e.link; commit({ keepInspector: !!v && v !== 'quote:' && !['/satin', '#', 'https://', 'mailto:', 'tel:', '/cms/uploads/'].includes(v) }); }, { newTab: !!e.newTab, onNewTab: v => { e.newTab = v || undefined; commit({ keepInspector: true }); } }); }
function listEditor(e, key, fields, o = {}) {
  const items = (e.p?.[key] || []).slice();
  const save = (redraw = true) => { e.p = { ...(e.p || {}), [key]: items }; commit({ keepInspector: !redraw }); };
  const row = (it, i) => {
    const upd = (k, v) => { items[i] = { ...items[i], [k]: v }; save(false); };
    const mv = d => onCtl(() => { const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; save(); });
    const del = onCtl(() => { items.splice(i, 1); save(); });
    return `<div class="item"><header><span>${esc(o.label || 'Item')} ${i + 1}${it.title || it.label || it.net ? ' · ' + esc(it.title || it.label || it.net) : ''}</span><button type="button" data-c="${mv(-1)}" title="Up">↑</button><button type="button" data-c="${mv(1)}" title="Down">↓</button><button type="button" data-c="${del}" title="Remove">✕</button></header>
      ${fields.map(([k, label, type, opts]) => type === 'image' ? fImage(label, it[k], v => upd(k, v)) : type === 'link' ? fLink(label, it[k], v => upd(k, v)) : type === 'select' ? fSelect(label, it[k], opts, v => upd(k, v)) : type === 'switch' ? fSwitch(label, !!it[k], v => upd(k, v)) : type === 'opts' ? fText(label, (it[k] || []).join(', '), v => upd(k, v.split(',').map(x => x.trim()).filter(Boolean)), { hint: 'comma separated' }) : type === 'lines' ? fText(label, (it[k] || []).map(x => [x.label, x.href, x.desc].filter((v, j) => v || j < 2).join(' | ')).join('\n'), v => upd(k, v.split('\n').map(l => l.split('|').map(x => x.trim())).filter(a => a[0]).map(([label, href, desc]) => ({ label, href: href || '#', ...(desc ? { desc } : {}) }))), { area: true, rows: 4, hint: opts || 'one per line: Label | /link | short description' }) : fText(label, it[k], v => upd(k, v), { area: type === 'area', rows: 3 })).join('')}</div>`;
  };
  const add = onCtl(() => { items.push(o.blank ? o.blank() : {}); save(); });
  const multi = o.images ? onCtl(() => pickMedia(urls => { for (const u of [].concat(urls)) items.push({ [o.images]: u }); save(); }, { multiple: true })) : null;
  return `<div class="items">${items.map(row).join('')}</div><div class="actions"><button class="btn sm" type="button" data-c="${add}">${ic('plus')} Add ${esc((o.label || 'item').toLowerCase())}</button>${multi ? `<button class="btn ghost sm" type="button" data-c="${multi}">Add several images</button>` : ''}</div>`;
}
function feSettings(e) {
  if (!e) return '';
  const p = e.p || {};
  let h = '';
  switch (e.kind) {
    case 'text': {
      const id = onCtl(() => startInline());
      h += `<div class="actions" style="margin-bottom:12px"><button class="btn sm" data-c="${id}">${ic('edit')} Edit text on the page</button></div>`;
      h += fSelect('Text type (for Google)', p.tag || 'div', [['h1', 'Heading 1 (page title)'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['h5', 'Heading 5'], ['h6', 'Heading 6'], ['p', 'Paragraph'], ['div', 'Plain text']], setP(e, 'tag'));
      h += fText('Text (HTML allowed: b, i, u, a, ul, li, mark)', p.html, setP(e, 'html'), { area: true, rows: 5 });
      h += linkField(e); break;
    }
    case 'button':
      h += fText('Button text', p.label, setP(e, 'label'), { ph: 'Leave empty for an icon button' });
      h += iconPicker('Icon', p.icon, setP(e, 'icon'), true);
      if (p.icon) h += fButtons('Icon position', p.iconPos || 'left', [['left', 'Before text'], ['right', 'After text']], v => setP(e, 'iconPos')(v || 'left'), { noToggle: true });
      h += linkField(e);
      h += fSwitch('Disabled (greyed out, can’t be clicked)', !!p.disabled, setP(e, 'disabled')) + (p.disabled ? '<p class="hint">Style the disabled look in Design › Disabled.</p>' : '');
      break;
    case 'image': case 'vector':
      h += fImage(e.kind === 'vector' ? 'SVG / vector' : 'Image', p.src, setP(e, 'src'), { kind: e.kind === 'vector' ? 'vector' : 'image' });
      h += fText('Alt text (describes the image)', p.alt, setP(e, 'alt'), { hint: 'for Google & screen readers' });
      if (e.kind === 'image' && p.src) {
        const fit = p.img ? 'custom' : p.crop ? 'crop' : (e.style || {}).objectFit || 'cover';
        h += `<div class="f"><span class="lbl">Photo inside the box<em>${fit === 'custom' ? 'custom position' : fit === 'crop' ? 'cropped' : ''}</em></span><div class="btns wrap">${[['cover', 'Fill'], ['contain', 'Fit'], ['fill', 'Stretch'], ['original', 'Original size'], ['reset', 'Reset']].map(([k, l]) => `<button type="button" class="${fit === k ? 'on' : ''}" data-c="${onCtl(() => { select({ type: 'fe', id: e.id }, { single: true }); imgPreset(k); })}">${l}</button>`).join('')}</div></div>`;
        h += `<div class="actions" style="margin:-4px 0 14px"><button class="btn sm" data-c="${onCtl(() => startImgEdit(e.id))}">${ic('crop')} ${S.imgEdit?.id === e.id ? 'Adjusting… (Esc when done)' : 'Move / zoom / rotate the photo'}</button></div><p class="hint" style="margin-top:-6px">Or double-click the image. The box keeps its size while you move or zoom the photo inside it.</p>`;
      } else h += fButtons('Fit', (e.style || {}).objectFit || '', [['cover', 'Fill'], ['contain', 'Fit'], ['fill', 'Stretch']], v => { e.style = { ...(e.style || {}), objectFit: v }; commitNow(); });
      h += linkField(e); break;
    case 'shape': {
      const shapes = Object.keys(RT.SHAPES);
      h += `<div class="f"><span class="lbl">Shape</span><div class="shapes">${shapes.map(s => { const id = onCtl(() => { e.p = { ...p, shape: s }; commit(); }); return `<button type="button" data-c="${id}" class="${(p.shape || 'rect') === s ? 'on' : ''}" title="${s}"><i style="${RT.SHAPES[s] ? `clip-path:${RT.SHAPES[s]}` : s === 'line-h' ? 'height:2px' : s === 'line-v' ? 'width:2px' : 'border-radius:3px'}"></i></button>`; }).join('')}</div></div>`;
      h += linkField(e); break;
    }
    case 'box':
      h += `<p class="hint" style="margin-top:0">Drag elements onto the box to put them inside it. They move together with the box.</p>`;
      h += fSwitch('Arrange items automatically (flex / grid)', !!p.flow, v => { e.p = { ...p, flow: v || undefined }; if (v) e.style = { display: 'flex', flexDir: 'row', gap: 16, alignItems: 'center', ...(e.style || {}) }; commit(); });
      if (p.flow) { const s = e.style || {}; const st = (k, v) => { e.style = { ...(e.style || {}), [k]: v }; commitNow(); };
        h += fButtons('Layout', s.display || 'flex', [['flex', 'Stack'], ['grid', 'Grid']], v => st('display', v || 'flex'), { noToggle: true });
        if ((s.display || 'flex') === 'flex') h += fButtons('Direction', s.flexDir || 'row', [['row', 'Row →'], ['column', 'Column ↓'], ['row-reverse', '←'], ['column-reverse', '↑']], v => st('flexDir', v), { noToggle: true }) + fButtons('Wrap', s.wrap || 'nowrap', [['nowrap', 'No wrap'], ['wrap', 'Wrap']], v => st('wrap', v), { noToggle: true });
        else h += `<div class="grid2">${fNum('Columns', s.columns, v => st('columns', v), { min: 1, max: 12 })}${fNum('Rows', s.rows, v => st('rows', v), { min: 1, max: 12 })}</div>`;
        h += fSelect('Justify', s.justify || '', [['', 'Default'], ['start', 'Start'], ['center', 'Centre'], ['end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around'], ['space-evenly', 'Space evenly']], v => st('justify', v)) + fSelect('Align items', s.alignItems || '', [['', 'Default'], ['start', 'Start'], ['center', 'Centre'], ['end', 'End'], ['stretch', 'Stretch']], v => st('alignItems', v)) + fRange('Gap', s.gap, 0, 120, 1, v => { e.style = { ...(e.style || {}), gap: v }; liveCommit(); }, 'px'); }
      h += linkField(e); break;
    case 'video':
      h += fText('YouTube, Vimeo or MP4 link', p.src && /^yt:/.test(p.src) ? 'https://youtu.be/' + p.src.slice(3) : p.src && /^vimeo:/.test(p.src) ? 'https://vimeo.com/' + p.src.slice(6) : p.src, v => { e.p = { ...p, src: videoNorm(v) }; commit(); }, { ph: 'https://youtube.com/watch?v=…' });
      h += `<div class="actions" style="margin:-6px 0 12px"><button class="btn ghost sm" type="button" data-c="${onCtl(() => pickMedia(u => { e.p = { ...p, src: u }; commit(); }, { kind: 'video' }))}">Upload / choose a video file</button></div>`;
      h += fSwitch('Autoplay (muted)', !!p.autoplay, setP(e, 'autoplay')) + fSwitch('Loop', !!p.loop, setP(e, 'loop')) + fSwitch('Muted', !!p.muted, setP(e, 'muted')) + fSwitch('Show controls', p.controls !== false, setP(e, 'controls'));
      if (p.src && !/^(yt|vimeo):/.test(p.src)) h += fImage('Poster image', p.poster, setP(e, 'poster')) + fSwitch('Play with the scroll (scroll-controlled)', !!p.scrub, setP(e, 'scrub'));
      break;
    case 'audio': h += fImage('Audio file', p.src, setP(e, 'src'), { kind: 'audio' }) + fText('Or paste an MP3 link', p.src, setP(e, 'src')) + fSwitch('Loop', !!p.loop, setP(e, 'loop')); break;
    case 'embed':
      h += fSeg([['code', 'HTML code'], ['url', 'Website address']], p.url !== undefined && p.html === undefined ? 'url' : 'code', v => { e.p = v === 'url' ? { url: p.url || 'https://' } : { html: p.html || '' }; commit(); });
      h += p.url !== undefined && p.html === undefined ? fText('Website address (https only)', p.url, setP(e, 'url'), { ph: 'https://…' }) : fText('Embed code', p.html, setP(e, 'html'), { area: true, rows: 9, ph: '<script>…</script> or <iframe …>' }) + '<p class="hint">Code runs in a secure sandbox (it can’t read your site or visitors’ data).</p>';
      h += fText('Title (accessibility)', p.title, setP(e, 'title')); break;
    case 'map': h += fText('Address or place', p.q, setP(e, 'q')) + fRange('Zoom', p.zoom ?? 14, 3, 20, 1, setP(e, 'zoom', true)); break;
    case 'social': {
      const nets = Object.keys(RT.SOCIAL).map(k => [k, k[0].toUpperCase() + k.slice(1)]);
      h += listEditor(e, 'items', [['net', 'Network', 'select', nets], ['url', 'Link', 'link']], { label: 'Link', blank: () => ({ net: 'instagram', url: 'https://' }) });
      const st = e.style || {}; h += `<div class="grid2">${fRange('Icon size', num(st.fontSize) || 32, 12, 80, 1, v => { e.style = { ...(e.style || {}), fontSize: v }; liveCommit(); }, 'px')}${fRange('Spacing', num(st.gap) ?? 12, 0, 60, 1, v => { e.style = { ...(e.style || {}), gap: v }; liveCommit(); }, 'px')}</div>`;
      break;
    }
    case 'icon': h += iconPicker('Icon', p.icon || 'star', setP(e, 'icon')) + linkField(e); break;
    case 'menu': {
      const imp = onCtl(() => { const items = (S.menu?.items || []).filter(i => i.active !== false).map(i => ({ label: i.label, href: i.href, sub: (i.groups || []).flatMap(g => g.links || []).filter(l => l.active !== false).slice(0, 12).map(l => ({ label: l.label, href: l.href })) })); e.p = { ...p, items }; commit(); toast('Site menu imported'); });
      h += `<div class="actions" style="margin-bottom:10px"><button class="btn ghost sm" data-c="${imp}">Use the site menu</button></div>`;
      h += listEditor(e, 'items', [['label', 'Label', 'text'], ['href', 'Link', 'link'], ['sub', 'Drop-down links', 'lines', p.mega ? 'one per line: Label | /link | short description' : 'one per line: Label | /link']], { label: 'Menu item', blank: () => ({ label: 'New item', href: '/satin' }) });
      h += fSwitch('Mega menu (wide drop-down panel)', !!p.mega, setP(e, 'mega'));
      if (p.mega) h += fRange('Columns in the panel', p.megaCols ?? 3, 1, 5, 1, setP(e, 'megaCols', true)) + fImage('Panel image (optional)', p.megaImg, setP(e, 'megaImg')) + fText('Panel note', p.megaNote, setP(e, 'megaNote'), { area: true, rows: 2, ph: 'e.g. Free quotes in 24 hours' });
      h += fSwitch('Vertical', !!p.vertical, setP(e, 'vertical')) + fSelect('Hamburger icon', p.burger || 'mobile', [['mobile', 'On mobile'], ['always', 'Always'], ['never', 'Never']], setP(e, 'burger'));
      const st = e.style || {}; h += fRange('Space between items', num(st.gap) ?? 24, 0, 80, 1, v => { e.style = { ...(e.style || {}), gap: v }; liveCommit(); }, 'px');
      break;
    }
    case 'form':
      h += fText('Form title', p.title, setP(e, 'title')) + fText('Submit button', p.submit, setP(e, 'submit')) + fText('Thank-you message', p.ok, setP(e, 'ok'), { area: true, rows: 2 }) + fText('Request name (shown in Requests)', p.service, setP(e, 'service'));
      h += '<p class="hint">Name, email, phone and consent are always included. Submissions arrive in the admin under requests and by email.</p>';
      h += listEditor(e, 'fields', [['label', 'Label', 'text'], ['type', 'Type', 'select', [['text', 'Short text'], ['textarea', 'Long text'], ['email', 'Email'], ['tel', 'Phone'], ['number', 'Number'], ['date', 'Date'], ['select', 'Drop-down'], ['checkbox', 'Checkbox']]], ['options', 'Drop-down options', 'opts'], ['required', 'Required', 'switch']], { label: 'Field', blank: () => ({ label: 'New field', type: 'text' }) });
      break;
    case 'slider':
      h += fSelect('Style', p.mode || 'slide', [['slide', 'Slideshow'], ['fade', 'Fade'], ['carousel', 'Carousel (several visible)'], ['grid', 'Gallery grid']], setP(e, 'mode'));
      if (p.mode === 'carousel' || p.mode === 'grid') h += fRange(p.mode === 'grid' ? 'Columns' : 'Visible at once', p.per ?? 3, 1, 6, 1, setP(e, 'per', true));
      h += fRange('Gap', p.gap ?? 12, 0, 60, 1, setP(e, 'gap', true), 'px');
      if (p.mode !== 'grid') h += fRange('Autoplay every', p.auto ?? 0, 0, 15, 1, setP(e, 'auto', true), 's (0 = off)') + fSwitch('Arrows', p.arrows !== false, setP(e, 'arrows')) + fSwitch('Dots', p.dots !== false, setP(e, 'dots'));
      h += group('Images', listEditor(e, 'items', [['src', '', 'image'], ['alt', 'Alt text', 'text'], ['caption', 'Caption', 'text'], ['link', 'Link', 'link']], { label: 'Image', images: 'src', blank: () => ({ src: '' }) }));
      break;
    case 'accordion': case 'tabs':
      h += listEditor(e, 'items', [['title', e.kind === 'tabs' ? 'Tab title' : 'Question / title', 'text'], ['body', 'Content', 'area']], { label: e.kind === 'tabs' ? 'Tab' : 'Item', blank: () => ({ title: 'New item', body: 'Content' }) });
      if (e.kind === 'accordion') h += fSwitch('First item open', !!p.open, setP(e, 'open'));
      break;
    case 'countdown': h += fText('Count down to', (p.to || '').slice(0, 16), setP(e, 'to'), { type: 'datetime-local' }) + fText('Text when finished', p.done, setP(e, 'done')); break;
    case 'progress': h += fRange('Value', p.value ?? 60, 0, 100, 1, setP(e, 'value', true), '%') + fText('Label', p.label, setP(e, 'label')); break;
    case 'counter': h += `<div class="grid2">${fNum('Count to', p.to, setP(e, 'to'))}${fNum('Duration', p.dur, setP(e, 'dur'), { unit: 'ms' })}</div><div class="grid2">${fText('Before', p.prefix, setP(e, 'prefix'), { ph: '$' })}${fText('After', p.suffix, setP(e, 'suffix'), { ph: '+' })}</div>` + fText('Label', p.label, setP(e, 'label')); break;
    case 'beforeafter': h += fImage('Before', p.before, setP(e, 'before')) + fImage('After', p.after, setP(e, 'after')) + fRange('Start position', p.start ?? 50, 0, 100, 1, setP(e, 'start', true), '%') + fSwitch('Show labels', p.labels !== false, setP(e, 'labels')); break;
    case 'marquee': h += fText('Text', p.text, setP(e, 'text'), { area: true, rows: 2 }) + fRange('Speed (seconds per loop)', p.speed ?? 20, 4, 120, 1, setP(e, 'speed', true), 's') + fSwitch('Reverse direction', !!p.reverse, setP(e, 'reverse')); break;
    case 'lottie': h += fImage('Lottie file (.json)', p.src, setP(e, 'src'), { kind: 'lottie' }) + fText('Or paste a Lottie JSON link', p.src, setP(e, 'src')) + fSwitch('Loop', p.loop !== false, setP(e, 'loop')); break;
    case 'popup': {
      h += fText('Button text', p.label, setP(e, 'label'), { ph: 'Leave empty when the popup opens by itself' });
      h += fSelect('Open the popup', p.trigger || 'click', [['click', 'When the button is clicked'], ['load', 'After the page loads'], ['scroll', 'After scrolling down'], ['exit', 'When the visitor is about to leave']], setP(e, 'trigger'));
      if (p.trigger === 'load') h += fRange('Delay', p.delay ?? 3, 0, 60, 1, setP(e, 'delay', true), 's');
      if (p.trigger === 'scroll') h += fRange('After scrolling', p.at ?? 50, 5, 100, 5, setP(e, 'at', true), '% of the page');
      if (p.trigger && p.trigger !== 'click') h += fSwitch('Show only once per visitor', p.once !== false, setP(e, 'once'));
      h += group('Popup content', fImage('Image', p.img, setP(e, 'img')) + fText('Title', p.title, setP(e, 'title')) + fText('Text (HTML allowed: b, i, a, ul, li)', p.html, setP(e, 'html'), { area: true, rows: 4 }) + fText('Button in the popup', p.btn, setP(e, 'btn'), { ph: 'e.g. Get a quote' }) + fLink('Popup button link', p.btnLink, setP(e, 'btnLink')) + fSwitch('Include the quote form', !!p.form, setP(e, 'form')));
      h += group('Popup look', fSelect('Size', p.size || 'md', [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['full', 'Full screen']], setP(e, 'size')) + fSelect('Position', p.pos || 'center', [['center', 'Centre'], ['bottom', 'Bottom bar'], ['right', 'Slide in from the right'], ['left', 'Slide in from the left']], setP(e, 'pos')) + fColor('Background', p.bg || '#ffffff', setP(e, 'bg')) + fColor('Text colour', p.ink || '', setP(e, 'ink')) + fRange('Backdrop darkness', p.dim ?? 55, 0, 95, 5, setP(e, 'dim', true), '%'));
      h += `<div class="actions" style="margin-bottom:12px"><button class="btn sm" data-c="${onCtl(() => hooks.previewPopup(e))}">${ic('eye')} Preview popup</button></div><p class="hint">Any button or link can open this popup too: set its link to <b>Popup › ${esc(feName(e))}</b>.</p>`;
      break;
    }
    case 'imgseq':
      h += `<p class="hint" style="margin-top:0">A series of images (frames) played like a video — great for 360° product spins or a wrap being applied step by step.</p>`;
      h += fSelect('Play', p.mode || 'scroll', [['scroll', 'With the scroll (scrubbing)'], ['auto', 'Automatically'], ['hover', 'While the mouse moves over it'], ['drag', 'Drag to rotate (360°)']], setP(e, 'mode'));
      if (p.mode === 'auto') h += fRange('Speed', p.fps ?? 12, 1, 60, 1, setP(e, 'fps', true), 'frames/s') + fSwitch('Loop', p.loop !== false, setP(e, 'loop'));
      if (!p.mode || p.mode === 'scroll') h += fRange('Scroll distance', p.dist ?? 100, 30, 400, 10, setP(e, 'dist', true), '% of screen');
      h += fText('Alt text', p.alt, setP(e, 'alt'));
      h += group(`Frames (${(p.frames || []).length})`, `<div class="seqgrid">${(p.frames || []).map((u, i) => `<div><img src="${esc(u)}" alt=""><button type="button" title="Remove" data-c="${onCtl(() => { const f = p.frames.slice(); f.splice(i, 1); setP(e, 'frames')(f); })}">×</button></div>`).join('')}</div>
        <div class="actions"><button class="btn sm" data-c="${onCtl(() => pickMedia(urls => setP(e, 'frames')([...(p.frames || []), ...[].concat(urls)].slice(0, 240)), { multiple: true }))}">${ic('plus')} Add frames</button>${(p.frames || []).length ? `<button class="btn ghost sm" data-c="${onCtl(() => setP(e, 'frames')([...(p.frames || [])].reverse()))}">Reverse order</button><button class="btn ghost sm" data-c="${onCtl(() => setP(e, 'frames')([...(p.frames || [])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))))}">Sort by file name</button>` : ''}</div><p class="hint">Upload the frames in order (e.g. frame-01.jpg … frame-60.jpg). Up to 240 frames.</p>`);
      break;
    case 'repeater': h += fRange('Columns', p.cols ?? 3, 1, 6, 1, setP(e, 'cols', true)) + listEditor(e, 'items', [['image', '', 'image'], ['title', 'Title', 'text'], ['body', 'Text', 'area'], ['button', 'Link text', 'text'], ['link', 'Link', 'link']], { label: 'Card', blank: () => ({ title: 'New card', body: '' }) }); break;
  }
  h += group('More', fText('Tooltip (shown on hover)', e.tip, v => { e.tip = v || undefined; commit({ keepInspector: true }); }) + fText('Layer name', e.name, v => { e.name = v || undefined; commit({ keepInspector: true }); }, { ph: feName({ ...e, name: '' }) }), { closed: true });
  h += actionsRow();
  return h;
}
function videoNorm(v) { v = String(v || '').trim(); let m; if ((m = v.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/))) return 'yt:' + m[1]; if ((m = v.match(/vimeo\.com\/(?:video\/)?(\d{5,12})/))) return 'vimeo:' + m[1]; return v; }
function iconPicker(label, value, fn, allowNone) {
  const names = ICON_NAMES;
  return `<div class="f"><span class="lbl">${esc(label)}</span><div class="icons">${allowNone ? `<button type="button" data-c="${onCtl(() => fn(''))}" class="${!value ? 'on' : ''}" title="None">∅</button>` : ''}${names.map(n => `<button type="button" data-c="${onCtl(() => fn(n))}" class="${value === n ? 'on' : ''}" title="${n}">${RT.iconSVG(n)}</button>`).join('')}</div></div>`;
}
function actionsRow() {
  const b = (label, icon, fn, cls = 'ghost') => `<button class="btn ${cls} sm" data-c="${onCtl(fn)}">${ic(icon)} ${label}</button>`;
  return `<div class="actions sticky-actions">${b('Duplicate', 'copy', duplicate)}${b('Copy design', 'style', copyStyle)}${b('Delete', 'trash', removeSelected, 'danger')}</div>`;
}

/* ---------- free element: layout ---------- */
function feLayout(e) {
  if (!e) return '';
  const g = geom(e);
  const mob = isMobile();
  const W = g?.c?.width || RT.FREE_W;
  const t = { type: 'fe', id: e.id };
  const lk = lockOf(t), lp = !!(lk.all || lk.pos), ls = !!(lk.all || lk.size), lr = !!(lk.all || lk.rot);
  // numeric fields respect the locks too
  const set = k => v => { if (v === '' || v === null) return; if ((k === 'x' || k === 'y') ? lp || inFlow(e) : ls) { toast((k === 'x' || k === 'y' ? 'Position' : 'Size') + ' is locked'); return; } const gg = geom(e); if (!gg) return; setGeom(e, { [k]: Number(v) }, gg.c); commit({ keepInspector: true, label: k === 'x' || k === 'y' ? 'Move' : 'Resize' }); };
  let h = '';
  if (mob) h += `<div class="mobile-note">You are editing the <b>mobile</b> layout. ${e.m && num(e.m.y) !== null ? 'This element has its own mobile position.' : 'Elements stack on phones — drag one to arrange the section freely.'}</div>`;
  if (e.pin) {
    const p = e.pin;
    const at = p.at || 'br';
    h += group('Pinned to the screen', `<p class="hint" style="margin-top:0">Stays in place while visitors scroll.</p><div class="anchor9">${['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'].map(a => `<button type="button" class="${a === at ? 'on' : ''}" data-c="${onCtl(() => { e.pin = { ...p, at: a, ox: a[1] === 'c' ? 0 : 20, oy: a[0] === 'm' ? 0 : 20 }; commit(); })}"></button>`).join('')}</div>
      <div class="grid2">${fNum('Horizontal offset', p.ox, v => { e.pin.ox = v; commit({ keepInspector: true }); }, { unit: 'px' })}${fNum('Vertical offset', p.oy, v => { e.pin.oy = v; commit({ keepInspector: true }); }, { unit: 'px' })}</div>
      <div class="grid2">${fNum('Width', p.w, v => { e.pin.w = v; commit({ keepInspector: true }); }, { unit: 'px' })}${fNum('Height', e.h || '', v => { e.h = v || 0; commit({ keepInspector: true }); }, { unit: 'px', ph: 'Auto' })}</div>
      <div class="actions"><button class="btn ghost sm" data-c="${onCtl(togglePin)}">Unpin</button></div>`);
  } else {
    if (e.parent && elById(e.parent)?.p?.flow) h += group('Auto layout', `<p class="hint" style="margin-top:0">This element is inside a box that arranges its items automatically, so its position comes from the box${e.free ? '' : ' (X / Y and dragging are off)'}.</p>${fSwitch('Free position (place it anywhere inside the box)', !!e.free, v => setFree(e, v))}`);
    const flow = inFlow(e);
    h += group('Position & size', `<div class="grid2">${fNum('X', g ? Math.round(g.x) : '', set('x'), { unit: 'px', disabled: lp || flow })}${fNum('Y', g ? Math.round(g.y) : '', set('y'), { unit: 'px', disabled: lp || flow })}</div>
      <div class="grid2">${fNum('Width', g ? Math.round(g.w) : '', set('w'), { unit: 'px', min: 1, disabled: ls })}${fNum('Height', g ? Math.round(g.h) : '', set('h'), { unit: 'px', min: 1, disabled: ls })}</div>
      ${fSwitch('Auto height (grows with content)', !num(mob ? e.m?.h ?? e.h : e.h), v => { if (ls) return; const gg = geom(e); if (gg) setGeom(e, { h: v ? 0 : Math.round(gg.h || 100) }, gg.c); commit({ keepInspector: true, label: 'Auto height' }); }, { disabled: ls })}
      ${fRange('Rotation', feRot(e), -180, 180, 1, v => { if (lr) return; setRot(e, Number(v) || 0); liveCommit(); }, '°', { disabled: lr })}
      <div class="grid2">${fNum('Scale', 100, v => scaleFe(e, v), { unit: '%', min: 5, max: 1000, disabled: ls, title: 'Scales the element around its centre (its text too in “scale text” mode)' })}${flipBtns(t, lr)}</div>
      ${fSwitch('Keep proportions when resizing (or hold Shift)', !!e.keepRatio, v => { e.keepRatio = v || undefined; commit({ keepInspector: true, label: 'Aspect lock' }); }, { disabled: ls })}
      ${isTextTarget(t) ? textModeBtns() : ''}
      ${!mob ? fSwitch('Stretch to full screen width', !!e.full, v => { e.full = v || undefined; commit({ keepInspector: true }); }) : ''}
      ${!mob && !e.parent ? fSwitch('Stick to the bottom of the section', e.dock === 'b', v => { if (v) { e.dock = 'b'; const secN = F.main.querySelector(`[data-cms-section="${e.sec}"]`); e.yb = Math.round((secN?.offsetHeight || 0) - (g?.y || 0) - (g?.h || 0)); } else { delete e.dock; delete e.yb; } commit({ keepInspector: true }); }) : ''}`);
    if (!lp && !flow) h += group('Align in ' + (e.parent ? 'box' : 'section'), `<div class="btns wrap">${[['alignL', 'alignL', 'Left'], ['alignC', 'alignC', 'Centre'], ['alignR', 'alignR', 'Right'], ['alignT', 'alignT', 'Top'], ['alignM', 'alignM', 'Middle'], ['alignB', 'alignB', 'Bottom']].map(([a, i, l]) => `<button type="button" title="${l}" data-c="${onCtl(() => align(a))}">${ic(i)}</button>`).join('')}</div>`);
  }
  h += group('Arrange', `<div class="actions"><button class="btn ghost sm" data-c="${onCtl(() => zOrder(1, true))}">Bring to front</button><button class="btn ghost sm" data-c="${onCtl(() => zOrder(1))}">Forward</button><button class="btn ghost sm" data-c="${onCtl(() => zOrder(-1))}">Backward</button><button class="btn ghost sm" data-c="${onCtl(() => zOrder(-1, true))}">Send to back</button></div>
    ${!e.pin ? fSwitch('Pin to the screen (fixed)', false, () => togglePin()) : ''}`);
  h += lockGroup(t);
  h += group('Visibility', `${fSwitch('Show on desktop', !e.hideD, v => { e.hideD = !v || undefined; commit({ keepInspector: true }); })}${fSwitch('Show on tablet', !e.hideT, v => { e.hideT = !v || undefined; commit({ keepInspector: true }); })}${fSwitch('Show on mobile', !e.m?.hide, v => { e.m = { ...(e.m || {}), hide: !v || undefined }; commit({ keepInspector: true }); })}
    ${mob && !(e.m && num(e.m.y) !== null) ? fButtons('Alignment in the phone layout', e.m?.align || '', [['start', 'Left'], ['center', 'Centre'], ['end', 'Right'], ['stretch', 'Full width']], v => { e.m = { ...(e.m || {}), align: v || undefined }; commitNow(); }) + fRange('Width on phones', e.m?.fw ?? '', 5, 100, 1, v => { e.m = { ...(e.m || {}), fw: v || undefined }; liveCommit(); }, '%') : ''}
    ${mob && e.m && num(e.m.y) !== null ? `<button class="btn ghost sm" data-c="${onCtl(() => { for (const x of C().els.filter(x => x.sec === e.sec && x.m)) { delete x.m.x; delete x.m.y; delete x.m.w; delete x.m.h; delete x.m.r; } commit(); toast('Phone layout reset to automatic'); })}">Reset this section’s phone layout to automatic</button>` : ''}`);
  const s = e.style || {};
  h += group('Advanced', `${fSelect('Overflow', s.overflow || '', [['', 'Default'], ['hidden', 'Clip content'], ['visible', 'Visible'], ['auto', 'Scroll']], v => { e.style = { ...(e.style || {}), overflow: v }; commitNow(); })}${fText('Aspect ratio', s.aspect || '', v => { e.style = { ...(e.style || {}), aspect: v }; commitNow(); }, { ph: 'e.g. 16/9' })}`, { closed: true });
  return h;
}
function lockGroup(t) {
  const lk = lockOf(t), any = lk.all || lk.pos || lk.size || lk.rot || lk.style;
  const row = (k, l) => fSwitch(l, !!(lk.all || lk[k]), v => setLockPart(t, k, v));
  return group('Lock', `<p class="hint" style="margin-top:0">Locked parts can't be changed by dragging, the arrow keys, alignment or these fields. Elements inside a locked box can still be edited.</p>${row('pos', 'Position')}${row('size', 'Size')}${row('rot', 'Rotation & flip')}${row('style', 'Design')}<div class="actions"><button class="btn ghost sm" data-c="${onCtl(toggleLock)}">${ic(lk.all ? 'unlock' : 'lock')} ${lk.all ? 'Unlock everything' : 'Lock everything'}</button></div>`, { closed: !any, badge: lk.all ? 'locked' : any ? 'partly' : '' });
}
function flipBtns(t, dis) {
  const tf = t.type === 'el' ? elTf(t.selector) : elById(t.id) || {};
  return `<div class="f"><span class="lbl">Flip</span><div class="btns"><button type="button" title="Flip horizontally" class="${tf.fx ? 'on' : ''}" data-c="${onCtl(() => flip('x'))}" ${dis ? 'disabled' : ''}>⇋</button><button type="button" title="Flip vertically" class="${tf.fy ? 'on' : ''}" data-c="${onCtl(() => flip('y'))}" ${dis ? 'disabled' : ''}>⇵</button></div></div>`;
}
const textModeBtns = () => fButtons('Handles on text', S.textScale ? 'scale' : 'box', [['box', 'Resize text box'], ['scale', 'Scale text']], v => { if ((v === 'scale') !== S.textScale) toggleTextScale(); }, { noToggle: true }) + '<p class="hint" style="margin-top:-8px">Shortcut: K. “Scale text” makes the font size follow the handles.</p>';
// numeric scale of a free element around its centre (an action: the field goes back to 100%)
function scaleFe(e, pct) {
  pct = Number(pct); if (!pct || pct === 100) return;
  const t = { type: 'fe', id: e.id }; if (isLocked(t, 'size')) return;
  const f = pct / 100, g = geom(e); if (!g) return;
  const fixed = !!num(isMobile() ? (e.m?.h ?? e.h) : e.h);
  const w = g.w * f, hh = g.h * f, cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  if (e.pin) { e.pin.w = Math.round(w); if (num(e.h)) e.h = Math.round(hh); }
  else setGeom(e, { x: cx - w / 2, y: cy - hh / 2, w, ...(fixed ? { h: hh } : {}) }, g.c);
  if (S.textScale && isTextTarget(t)) { const inn = g.n.querySelector(':scope>.cms-a>.cms-in'); const fs = parseFloat(F.win.getComputedStyle(inn || g.n).fontSize) || 16; const k = isMobile() ? 'mob' : isTablet() ? 'tab' : 'style'; e[k] = { ...(e[k] || {}), fontSize: round(Math.max(6, Math.min(400, fs * f)), 1) }; }
  commit({ label: `Scale ${pct}%` });
}
// children of an auto-layout box: "free position" takes them out of the flow at their current place
function setFree(e, on) {
  if (on) {
    const g = geom(e); if (g) { const W = g.c.width || RT.FREE_W; e.x = round(g.x / W * 100, 3); e.y = Math.round(g.y); e.w = round(g.w / W * 100, 3); }
    e.free = true;
    e.z = Math.max(0, ...C().els.filter(x => x.parent === e.parent && x.id !== e.id).map(x => num(x.z) || 0)) + 1; // on top of the items that stay in the flow
  }
  else delete e.free;
  commit({ label: on ? 'Free position' : 'Auto layout' });
}
function multiPanel() {
  const els = feTargets();
  const grouped = els.every(x => x.group && x.group === els[0].group);
  const b = (label, fn, cls = 'ghost') => `<button class="btn ${cls} sm" data-c="${onCtl(fn)}">${label}</button>`;
  return `<p class="hint" style="margin-top:0">${els.length} elements selected. Design and animation changes apply to all of them.</p>
    ${group('Group', `<div class="actions">${grouped ? b('Ungroup', ungroup) : b('Group (Ctrl+G)', groupEls, '')}</div>`)}
    ${group('Align', `<div class="btns wrap">${[['alignL', 'alignL', 'Left'], ['alignC', 'alignC', 'Centre'], ['alignR', 'alignR', 'Right'], ['alignT', 'alignT', 'Top'], ['alignM', 'alignM', 'Middle'], ['alignB', 'alignB', 'Bottom'], ['distH', 'distH', 'Distribute horizontally'], ['distV', 'distV', 'Distribute vertically']].map(([a, i, l]) => `<button type="button" title="${l}" data-c="${onCtl(() => align(a))}">${ic(i)}</button>`).join('')}</div>`)}
    ${group('Arrange', `<div class="actions">${b('Bring to front', () => zOrder(1, true))}${b('Send to back', () => zOrder(-1, true))}${b(els.every(x => x.locked) ? 'Unlock all' : 'Lock all', toggleLock)}${b('Flip ⇋', () => flip('x'))}${b('Flip ⇵', () => flip('y'))}</div><p class="hint">Drag the handles of the shared box to scale or rotate all of them together.</p>`)}
    ${lockGroup(S.sel)}
    ${actionsRow()}`;
}

/* ---------- design ---------- */
const isTextEl = el => el && el.tagName !== 'IMG' && !['Container'].includes(elKind(el));
function designTab(t, e, el) {
  const { get, set } = styleGetSet(t);
  let h = '';
  if ((t.type === 'fe' || t.type === 'el') && isLocked(t, 'style')) return `<p class="hint" style="margin-top:0">${ic('lock')} The design of this element is locked. Unlock it in <b>Layout › Lock</b>.</p>`;
  const isBtn = t.type === 'fe' && feTargets().every(x => x.kind === 'button');
  if (S.state === 'disabled' && !isBtn) S.state = 'normal';
  if (t.type === 'fe') h += stateSwitch([['normal', 'Regular'], ['hover', 'Hover'], ['active', 'Pressed'], ...(isBtn ? [['disabled', 'Disabled']] : [])]);
  else h += stateSwitch([['normal', 'Regular'], ['hover', 'Hover']]);
  if (S.state === 'disabled') h += `<p class="hint">How the button looks while it is disabled. Turn <b>Disabled</b> on in Settings to show this state on the site (the button can't be clicked).</p>`;
  else if (S.state !== 'normal') h += `<p class="hint">Changes here apply while the visitor ${S.state === 'hover' ? 'points at' : 'clicks'} the element.${t.type === 'fe' ? ' Set the speed in Animate › Hover.' : ''}</p>`;
  else h += devNote('Design changes here');
  h += savedStyles(t);
  const s = get();
  const kind = e?.kind;
  const img = (el && el.tagName === 'IMG') || kind === 'image' || kind === 'vector';
  const showText = t.type === 'fe' ? TEXTY.has(kind) || kind === 'box' : isTextEl(el);
  if (kind !== 'shape' || !String(e?.p?.shape || '').startsWith('line')) h += group('Fill', fillControls(s, set, { image: !img }));
  else h += group('Line', `${fColor('Colour', s.borderColor, up(set, 'borderColor', true))}${fRange('Thickness', s.borderWidth ?? 2, 1, 40, 1, up(set, 'borderWidth', true), 'px')}${fButtons('Style', s.borderStyle || 'solid', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double']], up(set, 'borderStyle'), { noToggle: true })}`);
  if (showText) h += group('Text', textControls(s, set, { kind }));
  if (img) h += group('Image', `${fButtons('Fit', s.objectFit || '', [['cover', 'Fill'], ['contain', 'Fit'], ['fill', 'Stretch']], up(set, 'objectFit'))}${fRange('Focus point (horizontal)', s.objectPosition ?? '', 0, 100, 1, up(set, 'objectPosition', true), '%')}${fRange('Focus point (vertical)', s.objectPosY ?? '', 0, 100, 1, up(set, 'objectPosY', true), '%')}`);
  h += group('Border', borderControls(s, set), { closed: !s.borderWidth && !s.bwT });
  h += group('Corners', cornerControls(s, set), { closed: !s.borderRadius && !s.rTL });
  h += group('Shadow', shadowControls(s, set), { closed: !s.shX && !s.shBlur && !s.shadow && !s.ishBlur });
  h += group('Spacing inside', fSides('Padding', { t: s.pt ?? s.padding ?? s.paddingTop, r: s.pr ?? s.padding ?? s.paddingX, b: s.pb ?? s.padding ?? s.paddingBottom, l: s.pl ?? s.padding ?? s.paddingX }, ['t', 'r', 'b', 'l'], (k, v) => { set({ t: 'pt', r: 'pr', b: 'pb', l: 'pl' }[k], v); if (s.padding !== undefined) set('padding', ''); }), { closed: true });
  h += group('Effects', effectControls(s, set), { closed: !s.opacity && !s.blur && !s.backdrop && !s.blend });
  return h;
}
function fieldDesign(t) {
  // fields inside an added section use the block's grouped styles
  const b = blockById(t.id); if (!b) return '';
  const f = t.field.replace(/^items\.\d+\./, '');
  const k = f === 'title' ? 'titleStyle' : f === 'body' ? 'bodyStyle' : /^button/.test(f) ? 'buttonStyle' : f === 'image' ? 'imageStyle' : null;
  if (!k) return '<p class="hint">Select the section to change its design.</p>';
  const get = () => b[k] || {}, set = (p, v) => { b[k] = b[k] || {}; b[k][p] = v; };
  return `<p class="hint" style="margin-top:0">Applies to every ${f === 'image' ? 'image' : f === 'title' ? 'heading' : f === 'body' ? 'text' : 'button'} in this section.</p>` + (k === 'imageStyle' ? group('Image', `${fRange('Height', get().height, 40, 900, 2, up(set, 'height', true), 'px')}${fButtons('Fit', get().objectFit, [['cover', 'Fill'], ['contain', 'Fit']], up(set, 'objectFit'))}`) : group('Text', textControls(get(), set, {}))) + group('Fill', fillControls(get(), set, {})) + group('Corners', cornerControls(get(), set));
}
function savedStyles(t) {
  const list = S.theme?.styles || [];
  const apply = onCtl(el => { const st = list.find(x => x.id === el.value); el.value = ''; if (!st) return; if (t.type === 'fe') for (const e of feTargets()) { e.style = { ...(e.style || {}), ...clone(st.style || {}) }; if (st.hov && Object.keys(st.hov).length) e.hov = clone(st.hov); } else if (t.type === 'el') { const x = editFor(t.selector, true); x.style = { ...(x.style || {}), ...clone(st.style || {}) }; if (st.hov && Object.keys(st.hov).length) x.hov = clone(st.hov); } commit(); toast('Style “' + st.name + '” applied'); });
  const saveSt = onCtl(() => promptBox('Save this design as a style', 'Style name', '', async name => {
    if (!name) return;
    const src = t.type === 'fe' ? elById(t.id) : t.type === 'el' ? editFor(t.selector) || {} : secData(t.id) || {};
    S.theme = S.theme || { colors: {}, fonts: {} };
    (S.theme.styles ||= []).push({ id: uid('st'), name, style: clone(src.style || {}), hov: clone(src.hov || {}) });
    try { await api('/site/theme/save', { theme: S.theme }); S.themeDraft = true; toast('Style saved — reuse it on any element'); renderInspector(); } catch (er) { toast(er.message, true); }
  }));
  return `<div class="savedst">${list.length ? `<select data-c="${apply}"><option value="">Apply a saved style…</option>${list.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select>` : ''}<button type="button" class="btn ghost sm" data-c="${saveSt}" title="Save as a reusable style">${ic('plus')} Save style</button><button type="button" class="btn ghost sm" data-c="${onCtl(copyStyle)}" title="Copy design (Ctrl+Alt+C)">${ic('copy')}</button><button type="button" class="btn ghost sm" data-c="${onCtl(pasteStyle)}" title="Paste design (Ctrl+Alt+V)">${ic('paste')}</button></div>`;
}
function fillControls(s, set, o = {}) {
  const mode = s.gradient ? 'gradient' : s.backgroundImage ? 'image' : 'color';
  const m = onCtl(() => { });
  let h = fSeg([['color', 'Colour'], ['gradient', 'Gradient'], ...(o.image !== false ? [['image', 'Image']] : [])], mode, v => {
    if (v === 'color') { set('gradient', ''); set('backgroundImage', ''); }
    if (v === 'gradient') { set('backgroundImage', ''); set('gradient', { t: 'linear', a: 135, s: [{ c: '#c91c50', p: 0 }, { c: '#6d28d9', p: 100 }] }); }
    if (v === 'image') { set('gradient', ''); pickMedia(u => { set('backgroundImage', u); commitNow(); renderInspector(); }); return; }
    commitNow(); renderInspector();
  });
  h += fColor(mode === 'color' ? 'Colour' : 'Colour behind', s.backgroundColor, up(set, 'backgroundColor', true));
  if (mode === 'gradient') h += fGradient('Gradient', s.gradient, v => set('gradient', v));
  if (mode === 'image') h += fImage('Image', s.backgroundImage, v => { set('backgroundImage', v); commitNow(); renderInspector(); }) + `<div class="grid2">${fSelect('Size', s.bgSize || 'cover', [['cover', 'Cover'], ['contain', 'Fit'], ['auto', 'Original']], up(set, 'bgSize'))}${fSelect('Position', s.bgPos || 'center', RT.STYLE_ENUMS.bgPos.map(x => [x, x]), up(set, 'bgPos'))}</div>${fSelect('Repeat', s.bgRepeat || 'no-repeat', [['no-repeat', 'No repeat'], ['repeat', 'Tile'], ['repeat-x', 'Horizontally'], ['repeat-y', 'Vertically']], up(set, 'bgRepeat'))}${fSwitch('Fixed while scrolling', s.bgAttach === 'fixed', v => { set('bgAttach', v ? 'fixed' : ''); commitNow(); })}`;
  return h;
}
function textControls(s, set, o = {}) {
  const k = (key, live) => up(set, key, live);
  let h = `<div class="grid2">${fFont('Font', s.fontFamily, k('fontFamily'))}${fSelect('Weight', s.fontWeight, WEIGHTS, k('fontWeight'))}</div>
  <div class="grid2">${fNum('Size', s.fontSize, k('fontSize'), { unit: 'px', min: 6, max: 400 })}${fNum('Line height', s.lineHeight, k('lineHeight'), { step: 0.05, min: 0.5, max: 5 })}</div>
  ${fColor('Text colour', s.color, k('color', true))}
  ${fButtons('Alignment', s.textAlign, [['left', 'Left', 'left'], ['center', 'Center', 'center'], ['right', 'Right', 'right'], ['justify', 'Justify', 'justify']], k('textAlign'))}
  <div class="btns" style="margin:-4px 0 12px">${[['fontStyle', 'italic', '<i>I</i>', 'Italic'], ['textDecoration', 'underline', '<u>U</u>', 'Underline'], ['textDecoration', 'line-through', '<s>S</s>', 'Strikethrough'], ['textTransform', 'uppercase', 'AA', 'Uppercase'], ['textTransform', 'capitalize', 'Aa', 'Capitalize']].map(([kk, v, l, tt]) => `<button type="button" title="${tt}" data-c="${onCtl(() => { set(kk, s[kk] === v ? '' : v); commitNow(); })}" class="${s[kk] === v ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="grid2">${fNum('Letter spacing', s.letterSpacing, k('letterSpacing'), { unit: 'px', step: 0.5 })}${fNum('Word spacing', s.wordSpacing, k('wordSpacing'), { unit: 'px', step: 0.5 })}</div>`;
  h += group('Text effects', `${fSelect('Text fill', s.textFill || 'solid', [['solid', 'Solid colour'], ['gradient', 'Gradient'], ['image', 'Image (text mask)']], v => { set('textFill', v === 'solid' ? '' : v); if (v === 'gradient' && !s.gradient) set('gradient', { t: 'linear', a: 90, s: [{ c: '#c91c50', p: 0 }, { c: '#6d28d9', p: 100 }] }); if (v === 'image' && !s.backgroundImage) { pickMedia(u => { set('backgroundImage', u); commitNow(); renderInspector(); }); } commitNow(); renderInspector(); })}
    ${s.textFill === 'gradient' ? fGradient('Text gradient', s.gradient, v => set('gradient', v)) : ''}${s.textFill === 'image' ? fImage('Image inside the text', s.backgroundImage, v => { set('backgroundImage', v); commitNow(); renderInspector(); }) : ''}
    <div class="grid2">${fNum('Outline', s.strokeW, k('strokeW'), { unit: 'px', step: 0.5, min: 0, max: 20 })}${fColor('Outline colour', s.strokeColor, k('strokeColor', true))}</div>
    ${fColor('Highlight', s.highlight, k('highlight', true))}
    <div class="grid3">${fNum('Shadow X', s.tsX, k('tsX'), { unit: 'px' })}${fNum('Shadow Y', s.tsY, k('tsY'), { unit: 'px' })}${fNum('Blur', s.tsBlur, k('tsBlur'), { unit: 'px', min: 0 })}</div>${fColor('Shadow colour', s.tsColor, k('tsColor', true))}
    ${fButtons('Direction', s.writing || 'horizontal', [['horizontal', 'Horizontal'], ['vertical', 'Vertical ↓'], ['vertical-up', 'Vertical ↑']], v => { set('writing', v === 'horizontal' ? '' : v); commitNow(); }, { noToggle: true })}
    ${fButtons('Reading order', s.dir || '', [['ltr', 'Left to right'], ['rtl', 'Right to left']], k('dir'))}
    ${fSelect('List bullets', s.listStyle || '', [['', 'Default'], ['disc', '• Dots'], ['circle', '○ Circles'], ['square', '■ Squares'], ['decimal', '1. Numbers'], ['none', 'None']], k('listStyle'))}`, { closed: !s.textFill && !s.strokeW && !s.tsBlur && !s.highlight && !s.writing });
  return h;
}
function borderControls(s, set) {
  const sides = s.bwT !== undefined || s.bwR !== undefined || s.bwB !== undefined || s.bwL !== undefined;
  return `${sides ? fSides('Width per side', { t: s.bwT, r: s.bwR, b: s.bwB, l: s.bwL }, ['t', 'r', 'b', 'l'], (kk, v) => set({ t: 'bwT', r: 'bwR', b: 'bwB', l: 'bwL' }[kk], v)) : fRange('Width', s.borderWidth, 0, 30, 1, up(set, 'borderWidth', true), 'px')}
    ${fSwitch('Different width per side', sides, v => { if (v) { const w = s.borderWidth ?? 1; ['bwT', 'bwR', 'bwB', 'bwL'].forEach(x => set(x, w)); set('borderWidth', ''); } else { ['bwT', 'bwR', 'bwB', 'bwL'].forEach(x => set(x, '')); set('borderWidth', s.bwT ?? 1); } commitNow(); renderInspector(); })}
    ${fColor('Colour', s.borderColor, up(set, 'borderColor', true))}
    ${fButtons('Style', s.borderStyle || 'solid', [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double']], up(set, 'borderStyle'), { noToggle: true })}`;
}
function cornerControls(s, set) {
  const sep = ['rTL', 'rTR', 'rBR', 'rBL'].some(k => s[k] !== undefined);
  return sep ? fSides('Radius per corner', { tl: s.rTL, tr: s.rTR, br: s.rBR, bl: s.rBL }, ['tl', 'tr', 'br', 'bl'], (kk, v) => set({ tl: 'rTL', tr: 'rTR', br: 'rBR', bl: 'rBL' }[kk], v), { names: ['↖', '↗', '↘', '↙'] }) + fSwitch('Different radius per corner', true, () => { const r = s.rTL ?? 0; ['rTL', 'rTR', 'rBR', 'rBL'].forEach(x => set(x, '')); set('borderRadius', r); commitNow(); renderInspector(); })
    : fRange('Radius', s.borderRadius, 0, 300, 1, up(set, 'borderRadius', true), 'px') + fSwitch('Different radius per corner', false, () => { const r = s.borderRadius ?? 0; ['rTL', 'rTR', 'rBR', 'rBL'].forEach(x => set(x, r)); set('borderRadius', ''); commitNow(); renderInspector(); });
}
function shadowControls(s, set) {
  const k = (key, live) => up(set, key, live);
  return `${fSelect('Preset', s.shadow || '', [['', 'Custom / none'], ['sm', 'Soft'], ['md', 'Medium'], ['lg', 'Strong'], ['xl', 'Dramatic']], v => { set('shadow', v); if (v) ['shX', 'shY', 'shBlur', 'shSpread'].forEach(x => set(x, '')); commitNow(); renderInspector(); })}
    <div class="sublbl">Outer shadow</div><div class="grid4">${fNum('X', s.shX, k('shX'))}${fNum('Y', s.shY, k('shY'))}${fNum('Blur', s.shBlur, k('shBlur'), { min: 0 })}${fNum('Spread', s.shSpread, k('shSpread'))}</div>${fColor('Colour', s.shColor, k('shColor', true), { ph: 'rgba(0,0,0,.25)' })}
    <div class="sublbl">Inner shadow</div><div class="grid4">${fNum('X', s.ishX, k('ishX'))}${fNum('Y', s.ishY, k('ishY'))}${fNum('Blur', s.ishBlur, k('ishBlur'), { min: 0 })}${fNum('Spread', s.ishSpread, k('ishSpread'))}</div>${fColor('Colour', s.ishColor, k('ishColor', true), { ph: 'rgba(0,0,0,.25)' })}`;
}
function effectControls(s, set) {
  const k = (key, live) => up(set, key, live);
  return `${fRange('Opacity', s.opacity ?? '', 0, 1, 0.01, k('opacity', true))}${fRange('Blur', s.blur ?? '', 0, 60, 1, k('blur', true), 'px')}${fRange('Background blur (glass)', s.backdrop ?? '', 0, 60, 1, k('backdrop', true), 'px')}
    ${fSelect('Blend mode', s.blend || '', [['', 'Normal'], ...RT.STYLE_ENUMS.blend.filter(x => x !== 'normal').map(x => [x, x[0].toUpperCase() + x.slice(1)])], k('blend'))}
    <div class="grid2">${fRange('Brightness', s.brightness ?? '', 0, 200, 1, k('brightness', true), '%')}${fRange('Contrast', s.contrast ?? '', 0, 200, 1, k('contrast', true), '%')}</div><div class="grid2">${fRange('Saturation', s.saturate ?? '', 0, 200, 1, k('saturate', true), '%')}${fRange('Greyscale', s.grayscale ?? '', 0, 100, 1, k('grayscale', true), '%')}</div>${fRange('Hue', s.hue ?? '', 0, 360, 1, k('hue', true), '°')}`;
}

/* ---------- animation ---------- */
const AN = { in: RT.ANIMS.in, loop: RT.ANIMS.loop, hover: RT.ANIMS.hover, click: RT.ANIMS.click, scroll: RT.ANIMS.scroll };
const nice = s => s.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
function animObj(t, create) {
  if (t.type === 'fe') { const e = elById(t.id); if (create) e.anim = e.anim || {}; return e?.anim; }
  if (t.type === 'el') { const e = editFor(t.selector, create); if (e && create) e.anim = e.anim || {}; return e?.anim; }
  const d = secData(t.id, create); if (d && create) d.anim = d.anim || {}; return d?.anim;
}
function animSet(t, path, v) {
  const targets = t.type === 'fe' ? feTargets().map(e => (e.anim = e.anim || {})) : [animObj(t, true)];
  for (const a of targets) {
    const [k, sub] = path.split('.');
    if (sub) { a[k] = { ...(a[k] || {}) }; if (v === '' || v === null) delete a[k][sub]; else a[k][sub] = v; if (!a[k].t) delete a[k]; }
    else if (v === '' || v === null) delete a[k]; else a[k] = v;
  }
}
function animTab(t) {
  const a = animObj(t) || {};
  const set = (path, live) => v => { animSet(t, path, v); live ? liveCommit() : commit({ keepInspector: false }); if (path.endsWith('.t') && v) setTimeout(() => playAnimations(t), 80); };
  const grid = (list, cur, path) => `<div class="anims">${['', ...list].map(x => `<button type="button" data-c="${onCtl(() => set(path)(x))}" class="${(cur || '') === x ? 'on' : ''}"><i class="ap ap-${x || 'none'}"></i><span>${x ? nice(x) : 'None'}</span></button>`).join('')}</div>`;
  const inA = a.in || {};
  let h = `<div class="actions" style="margin-bottom:12px"><button class="btn sm" data-c="${onCtl(() => playAnimations(t))}">${ic('play')} Preview</button><button class="btn ghost sm" data-c="${onCtl(() => playAnimations())}">Preview whole page</button></div>`;
  h += group('Entrance', grid(AN.in, inA.t, 'in.t') + (inA.t ? `<div class="grid2">${fNum('Duration', inA.d ?? 800, set('in.d'), { unit: 'ms', min: 50, step: 50 })}${fNum('Delay', inA.dl ?? 0, set('in.dl'), { unit: 'ms', min: 0, step: 50 })}</div>
    ${fSelect('Easing', inA.e || 'smooth', [['smooth', 'Smooth'], ['ease', 'Ease'], ['ease-in', 'Ease in'], ['ease-out', 'Ease out'], ['ease-in-out', 'Ease in & out'], ['linear', 'Linear'], ['back', 'Overshoot'], ['elastic', 'Elastic']], set('in.e'))}
    <div class="grid2">${fSelect('Starts when', inA.tr || 'view', [['view', 'Scrolled into view'], ['load', 'Page loads'], ['click', 'Clicked']], set('in.tr'))}${fSelect('Repeat', inA.rep === 0 ? '0' : String(inA.rep || 1), [['1', 'Once'], ['2', '2 times'], ['3', '3 times'], ['5', '5 times'], ['0', 'Forever']], v => set('in.rep')(Number(v)))}</div>
    ${fSelect('Direction', inA.dir || 'normal', [['normal', 'Normal'], ['reverse', 'Reverse'], ['alternate', 'Back and forth']], set('in.dir'))}
    ${fSwitch('Play again each time it scrolls into view', !!inA.out, v => set('in.out')(v || ''))}` : ''));
  h += group('Hover effect', grid(AN.hover, a.hov?.t, 'hov.t') + (a.hov?.t || t.type === 'fe' ? fNum('Speed', a.hov?.d ?? 300, set('hov.d'), { unit: 'ms', min: 50, step: 50 }) : '') + (t.type !== 'section' && t.type !== 'block' ? '<p class="hint">Tip: Design › Hover changes colours on hover.</p>' : ''), { closed: !a.hov?.t });
  h += group('Loop', grid(AN.loop, a.loop?.t, 'loop.t') + (a.loop?.t ? `<div class="grid2">${fNum('Duration', a.loop.d ?? 2400, set('loop.d'), { unit: 'ms', min: 100, step: 100 })}${fNum('Delay', a.loop.dl ?? 0, set('loop.dl'), { unit: 'ms', min: 0, step: 100 })}</div>` : ''), { closed: !a.loop?.t });
  h += group('On click', grid(AN.click, a.click?.t, 'click.t'), { closed: !a.click?.t });
  h += group('Scroll effects', `${fSelect('Effect while scrolling', a.scroll?.t || '', [['', 'None'], ['parallax', 'Parallax (moves slower/faster)'], ['fade', 'Fade in & out'], ['scale', 'Grow & shrink'], ['rotate', 'Rotate'], ['move-x', 'Slide sideways'], ['blur', 'Blur in & out'], ['scrub', 'Play video with the scroll']], set('scroll.t'))}${a.scroll?.t && a.scroll.t !== 'scrub' ? fRange('Strength', a.scroll.sp ?? 30, -100, 100, 1, set('scroll.sp', true)) : ''}
    ${fRange('Follow the mouse (mouse parallax)', a.mouse ?? 0, -80, 80, 1, set('mouse', true), 'px')}`, { closed: !a.scroll?.t && !a.mouse });
  h += group('On mobile', `${fSelect('Animation on phones', a.mob || 'same', [['same', 'Same as desktop'], ['off', 'No animation'], ['custom', 'Different entrance']], set('mob'))}${a.mob === 'custom' ? grid(AN.in, a.m?.t, 'm.t') : ''}`, { closed: !a.mob });
  return h;
}

/* ---------- original page elements ---------- */
const INLINE_OK = el => [...el.querySelectorAll('*')].every(c => /^(B|STRONG|I|EM|U|S|BR|SMALL|SUP|SUB|SPAN|A|MARK)$/.test(c.tagName));
function elContent(t, el) {
  if (t.type === 'field') return blockFieldContent(t, el);
  const e = editFor(t.selector) || { selector: t.selector };
  const isImg = el.tagName === 'IMG';
  const linkEl = el.closest('a') || (el.matches('button') ? el : null);
  let body = '';
  if (el.tagName === 'VIDEO') {
    const cur = e.type === 'video' ? e.value : (el.currentSrc || el.querySelector('source')?.src || el.src || '');
    body += `<div class="f"><span class="lbl">Video</span><p class="hint" style="margin:0 0 8px">${esc(cur.split('/').pop() || 'No video')}</p><div class="actions"><button class="btn sm" type="button" data-c="${onCtl(() => pickMedia(u => { const x = editFor(t.selector, true); x.type = 'video'; x.value = u; commit({ keepInspector: true }); }, { kind: 'video' }))}">${ic('image')} Replace video (MP4)</button>${e.type === 'video' ? `<button class="btn ghost sm" type="button" data-c="${onCtl(() => { const x = editFor(t.selector, true); delete x.type; delete x.value; delete x.poster; commit({ keepInspector: true }); })}">Use the original</button>` : ''}</div></div>`;
    body += fImage('Poster image (shown while loading)', e.poster || el.poster || '', u => { const x = editFor(t.selector, true); if (x.type !== 'video') { x.type = 'video'; x.value = cur; } x.poster = u; commit({ keepInspector: true }); });
    body += '<p class="hint">Tip: for scroll-controlled videos use a short MP4 (5–15 s, H.264, under 20 MB) with a white or transparent-looking background.</p>';
  } else if (isImg) {
    body += fImage('Image', e.type === 'image' ? e.value : el.currentSrc || el.src, u => setImage(t, u));
    body += fText('Alt text (describes the image)', e.alt ?? el.alt, v => { editFor(t.selector, true).alt = v; commit({ keepInspector: true }); }, { hint: 'for Google & screen readers' });
  } else if (elKind(el) !== 'Container') {
    const complex = !INLINE_OK(el);
    const val = e.type === 'text' || e.type === 'label' ? e.value : complex ? [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim() || el.textContent.trim() : el.innerText;
    const id = onCtl(x => { const ed = editFor(t.selector, true); ed.type = complex ? 'label' : 'text'; ed.value = x.value; commit({ keepInspector: true }); });
    body += `<label class="f"><span>Text<em>${complex ? '' : 'or double-click on the page'}</em></span><textarea data-c="${id}" data-textfield rows="${Math.min(10, Math.max(2, Math.ceil((val || '').length / 34)))}">${esc(val)}</textarea></label>`;
    if (e.type === 'html') body += '<p class="hint">This text has formatting (bold/links). Double-click it on the page to keep the formatting while editing.</p>';
  } else body += '<p class="hint" style="margin-top:0">This is a container. Use Layout to change spacing, size, flex or grid, and Design for its background.</p>';
  if (linkEl) body += fLink(linkEl.tagName === 'BUTTON' && !e.link ? 'Button action' : 'Link', e.link ?? (linkEl.hasAttribute('data-quote') ? 'quote:' : linkEl.getAttribute('href') || ''), v => { const x = editFor(t.selector, true); x.link = v; commit({ keepInspector: false }); }, { newTab: !!e.newTab || linkEl.target === '_blank', onNewTab: v => { const x = editFor(t.selector, true); x.newTab = v; if (x.link === undefined) x.link = linkEl.getAttribute('href') || ''; commit(); } });
  else body += fLink('Make it clickable', e.link || '', v => { const x = editFor(t.selector, true); x.link = v || undefined; commit({ keepInspector: false }); }, { newTab: !!e.newTab, onNewTab: v => { editFor(t.selector, true).newTab = v || undefined; commit(); } });
  body += group('More', fText('Tooltip', e.tip, v => { editFor(t.selector, true).tip = v || undefined; commit({ keepInspector: true }); }) + fText('Anchor name (link to it with #name)', e.anchor, v => { editFor(t.selector, true).anchor = v.replace(/[^\w-]/g, '') || undefined; commit({ keepInspector: true }); }), { closed: !e.tip && !e.anchor });
  body += `<div class="actions">${`<button class="btn ghost sm" data-c="${onCtl(() => toggleHidden(t))}">${ic(isHidden(t) ? 'eye' : 'eyeoff')} ${isHidden(t) ? 'Show' : isMobile() ? 'Hide on mobile' : 'Hide on desktop'}</button>`}<button class="btn ghost sm" data-c="${onCtl(() => { C().edits = C().edits.filter(x => x.selector !== t.selector); commit(); })}">${ic('reset')} Reset to original</button></div>`;
  return body;
}
function elLayout(t, el) {
  const { get, set } = styleGetSet({ ...t });
  const s = get();
  const k = (key, live) => up(set, key, live);
  const e = editFor(t.selector) || {};
  let h = devNote('Layout changes here');
  h += group('Spacing', fSides('Margin (outside)', { t: s.mt ?? s.marginTop, r: s.mr, b: s.mb ?? s.marginBottom, l: s.ml }, ['t', 'r', 'b', 'l'], (kk, v) => set({ t: 'mt', r: 'mr', b: 'mb', l: 'ml' }[kk], v), { min: -600 }) + fSides('Padding (inside)', { t: s.pt, r: s.pr, b: s.pb, l: s.pl }, ['t', 'r', 'b', 'l'], (kk, v) => set({ t: 'pt', r: 'pr', b: 'pb', l: 'pl' }[kk], v)));
  h += group('Size', `<div class="grid2">${fSize('Width', s.w, k('w'))}${fSize('Height', s.h, k('h'))}</div><div class="grid2">${fSize('Min width', s.minW, k('minW'))}${fSize('Max width', s.maxW, k('maxW'))}</div><div class="grid2">${fSize('Min height', s.minH, k('minH'))}${fSize('Max height', s.maxH, k('maxH'))}</div>${fText('Aspect ratio', s.aspect || '', k('aspect'), { ph: 'e.g. 16/9' })}`, { closed: !s.w && !s.h && !s.minH && !s.maxW });
  h += transformGroup(t, el);
  const disp = s.display || '';
  h += group('Arrange content', `${fSelect('Layout', disp, [['', 'Default'], ['block', 'Block'], ['flex', 'Flexbox (stack)'], ['grid', 'Grid'], ['inline-block', 'Inline']], k('display'))}
    ${disp === 'flex' ? fButtons('Direction', s.flexDir || 'row', [['row', 'Row →'], ['column', 'Column ↓'], ['row-reverse', '←'], ['column-reverse', '↑']], k('flexDir'), { noToggle: true }) + fButtons('Wrap', s.wrap || '', [['nowrap', 'No wrap'], ['wrap', 'Wrap']], k('wrap')) : ''}
    ${disp === 'grid' ? `<div class="grid2">${fNum('Columns', s.columns, k('columns'), { min: 1, max: 12 })}${fNum('Rows', s.rows, k('rows'), { min: 1, max: 12 })}</div>` : ''}
    ${disp === 'flex' || disp === 'grid' ? fSelect('Justify', s.justify || '', [['', 'Default'], ['start', 'Start'], ['center', 'Centre'], ['end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around'], ['space-evenly', 'Space evenly'], ['stretch', 'Stretch']], k('justify')) + fSelect('Align items', s.alignItems || '', [['', 'Default'], ['start', 'Start'], ['center', 'Centre'], ['end', 'End'], ['stretch', 'Stretch'], ['baseline', 'Baseline']], k('alignItems')) + fRange('Gap', s.gap, 0, 200, 1, k('gap', true), 'px') : ''}`, { closed: !disp });
  h += group('Position', `${fSelect('Position', s.pos || '', [['', 'Default'], ['relative', 'Relative'], ['absolute', 'Absolute'], ['fixed', 'Fixed to screen'], ['sticky', 'Sticky while scrolling'], ['static', 'Static']], k('pos'))}
    ${s.pos && s.pos !== 'static' ? `<div class="grid2">${fSize('Top', s.inT, k('inT'))}${fSize('Bottom', s.inB, k('inB'))}</div><div class="grid2">${fSize('Left', s.inL, k('inL'))}${fSize('Right', s.inR, k('inR'))}</div>` : ''}
    <div class="grid2">${fNum('Layer (z-index)', s.zIndex, k('zIndex'))}${fSelect('Overflow', s.overflow || '', [['', 'Default'], ['hidden', 'Hidden'], ['visible', 'Visible'], ['auto', 'Scroll']], k('overflow'))}</div>`, { closed: !s.pos && !s.zIndex && !s.overflow });
  h += lockGroup(t);
  h += group('Visibility', fSwitch('Show on desktop', !e.hideD, v => { const x = editFor(t.selector, true); x.hideD = !v || undefined; commit({ keepInspector: true }); }) + fSwitch('Show on tablet', !e.hideT, v => { const x = editFor(t.selector, true); x.hideT = !v || undefined; commit({ keepInspector: true }); }) + fSwitch('Show on mobile', !e.mobile?.hidden, v => { const x = editFor(t.selector, true); x.mobile = { ...(x.mobile || {}), hidden: !v || undefined }; commit({ keepInspector: true }); }));
  return h;
}

// transform of an original page element: desktop values, tablet / phone overrides (empty = inherit from desktop)
function transformGroup(t, node) {
  const tk = tfKey(), dev = tk === 'tfm' ? 'phone' : tk === 'tft' ? 'tablet' : '';
  const tf = elTf(t.selector), ed = editFor(t.selector) || {}, own = tk === 'tf' ? {} : (ed[tk] || {});
  const lk = lockOf(t), lp = !!(lk.all || lk.pos), ls = !!(lk.all || lk.size), lr = !!(lk.all || lk.rot);
  const mark = k => dev && own[k] !== undefined ? ' •' : '';
  const setT = (k, dis, conv = v => v) => v => { if (dis) { toast('Locked'); return; } setElTf(t.selector, { [k]: v === '' ? undefined : conv(Number(v)) }); commitNow(); };
  const keepRatio = typeof ed.keepRatio === 'boolean' ? ed.keepRatio : /^(img|video|picture|svg)$/i.test(node.tagName);
  const sc = Math.round((num(tf.sx) ?? 1) * 100);
  return group('Transform' + (dev ? ` (${dev})` : ''), `${dev ? `<div class="mobile-note${dev === 'tablet' ? ' tab' : ''}">These values apply to the <b>${dev}</b> only. Fields marked • are set for the ${dev}; the others come from desktop.</div>` : ''}
    <div class="grid2">${fNum('Move X' + mark('x'), tf.x ?? '', setT('x', lp), { unit: 'px', disabled: lp, ph: '0' })}${fNum('Move Y' + mark('y'), tf.y ?? '', setT('y', lp), { unit: 'px', disabled: lp, ph: '0' })}</div>
    <div class="grid2">${fNum('Width' + mark('w'), tf.w ?? '', setT('w', ls), { unit: 'px', min: 1, disabled: ls, ph: String(Math.round(node.offsetWidth || 0) || 'Auto') })}${fNum('Height' + mark('h'), tf.h ?? '', setT('h', ls), { unit: 'px', min: 1, disabled: ls, ph: String(Math.round(node.offsetHeight || 0) || 'Auto') })}</div>
    ${fRange('Rotation' + mark('r'), tf.r ?? 0, -180, 180, 1, v => { if (lr) return; setElTf(t.selector, { r: Number(v) || 0 }); liveCommit(); }, '°', { disabled: lr })}
    <div class="grid2">${fNum('Scale' + mark('sx'), sc, v => { if (ls || !v) return; setElTf(t.selector, { sx: v / 100, sy: v / 100 }); commitNow(); }, { unit: '%', min: 5, max: 2000, disabled: ls })}${flipBtns(t, lr)}</div>
    ${fSwitch('Keep proportions when resizing (Shift switches)', keepRatio, v => { editFor(t.selector, true).keepRatio = v; commit({ keepInspector: true, label: 'Aspect lock' }); }, { disabled: ls })}
    ${isTextTarget(t) ? textModeBtns() : ''}
    <div class="actions">${dev && Object.keys(own).length ? `<button class="btn ghost sm" data-c="${onCtl(() => { const x = editFor(t.selector, true); delete x[tk]; commit({ label: 'Reset to desktop' }); })}">${ic('reset')} Reset ${dev} to desktop</button>` : ''}<button class="btn ghost sm" data-c="${onCtl(() => { const x = editFor(t.selector, true); delete x[tk]; if (!dev) { delete x.tf; } commit({ label: 'Reset transform' }); })}">${ic('reset')} Reset transform</button></div>
    <p class="hint">Drag the element or its handles on the page; arrow keys nudge it.</p>`, { closed: false });
}

/* ---------- sections ---------- */
function blockFieldContent(t, el) { const b = blockById(t.id); return b ? blockContent(b) : ''; }
function sectionContent(t, el) {
  if (t.type === 'block') return blockContent(blockById(t.id));
  const b = (label, icon, fn, cls = 'ghost') => `<button class="btn ${cls} sm" data-c="${onCtl(fn)}">${ic(icon)} ${label}</button>`;
  const els = C().els.filter(e => e.sec === t.id && !e.parent);
  return `<p class="hint" style="margin-top:0">Click any text, image or button inside this section to edit it — or add new elements on top of it.</p>
    <div class="actions" style="margin-bottom:14px">${b('Add element', 'plus', () => { S._addTarget = t.id; hooks.openPanel?.('add'); }, '')}${b('Move up', 'up', () => moveSection(t.id, -1))}${b('Move down', 'down', () => moveSection(t.id, 1))}</div>
    ${els.length ? group('Elements in this section', `<div class="ellist">${els.sort((a, z) => (z.z || 0) - (a.z || 0)).map(e => `<button data-c="${onCtl(() => select({ type: 'fe', id: e.id }, { single: true }))}">${esc(feName(e))}<small>${esc(EL_NAME[e.kind] || '')}</small></button>`).join('')}</div>`) : ''}
    <div class="actions">${b('Save as template', 'template', () => saveTemplate(t.id))}${b(isHidden(t) ? 'Show section' : 'Hide section', isHidden(t) ? 'eye' : 'eyeoff', () => toggleHidden(t))}</div>`;
}
function blockContent(b) {
  if (!b) return '';
  const set = (k, v, live) => { b[k] = v; live ? liveCommit() : commit({ keepInspector: true }); };
  let h = '';
  const has = k => ['eyebrow', 'title', 'body'].includes(k) && !['spacer', 'divider', 'button', 'image', 'testimonial', 'blank'].includes(b.kind) || (k === 'body' && b.kind === 'testimonial');
  if (b.kind === 'blank') h += '<p class="hint" style="margin-top:0">A free canvas. Use <b>+ Add element</b> to place text, images, buttons, shapes and more anywhere in it.</p>';
  if (has('eyebrow')) h += fText('Small title', b.eyebrow, v => set('eyebrow', v));
  if (has('title')) h += fText('Heading', b.title, v => set('title', v));
  if (has('body')) h += fText(b.kind === 'testimonial' ? 'Quote' : 'Text', (b.body || '').replace(/<br>/g, '\n'), v => set('body', v), { area: true, rows: 4 });
  if (b.kind === 'testimonial') { h += fText('Name', b.name, v => set('name', v)) + fText('Role / source', b.role, v => set('role', v)) + fImage('Photo', b.image, v => set('image', v)); }
  if (['text-image', 'image-text', 'image'].includes(b.kind)) { h += fImage('Image', b.image, v => set('image', v)) + fText('Alt text', b.alt, v => set('alt', v)); }
  if (b.kind === 'image') h += fText('Caption', b.caption, v => set('caption', v));
  if (b.kind === 'video') h += fText('YouTube or Vimeo link', b.video, v => set('video', v), { ph: 'https://youtube.com/watch?v=…' });
  if (b.kind === 'spacer') h += fRange('Height', b.height ?? 60, 0, 400, 4, v => set('height', v, true), 'px');
  if (['text', 'cta', 'text-image', 'image-text', 'button', 'contact'].includes(b.kind)) h += group('Button', `${fText('Button text', b.button, v => set('button', v), { ph: 'Leave empty to hide' })}${fLink('Button link', b.link, v => set('link', v))}`);
  if (['text', 'cta'].includes(b.kind)) h += group('Second button', `${fText('Button text', b.button2, v => set('button2', v), { ph: 'Leave empty to hide' })}${fLink('Button link', b.link2, v => set('link2', v))}`, { closed: !b.button2 });
  if (b.kind === 'hscroll') h += '<p class="hint">On computers and tablets the section stays in place while the panels slide sideways as visitors scroll. On phones visitors swipe. Preview it with the Preview button.</p>';
  if (['gallery', 'cards', 'faq', 'stats', 'logos', 'contact', 'hscroll'].includes(b.kind)) h += itemsEditor(b);
  const bt = (label, icon, fn, cls = 'ghost') => `<button class="btn ${cls} sm" data-c="${onCtl(fn)}">${ic(icon)} ${label}</button>`;
  h += `<div class="actions" style="margin-top:12px">${bt('Add element', 'plus', () => { S._addTarget = b.id; hooks.openPanel?.('add'); }, '')}${bt('Duplicate', 'copy', () => duplicateBlock(b.id))}${bt('Save as template', 'template', () => saveTemplate(b.id))}${bt('Delete', 'trash', () => deleteBlock(b.id), 'danger')}</div>`;
  return h;
}
function itemsEditor(b) {
  const items = b.items = b.items || [];
  const kind = b.kind;
  const lbl = { gallery: 'Image', cards: 'Card', faq: 'Question', stats: 'Number', logos: 'Logo', contact: 'Contact line', hscroll: 'Panel' }[kind];
  const fields = { gallery: ['image', 'title'], cards: ['image', 'title', 'body', 'link'], faq: ['title', 'body'], stats: ['title', 'body'], logos: ['image', 'link'], contact: ['title', 'body', 'link'], hscroll: ['image', 'title', 'body', 'link'] }[kind];
  const names = { title: kind === 'faq' ? 'Question' : kind === 'stats' ? 'Number' : kind === 'gallery' ? 'Caption' : kind === 'contact' ? 'Label' : 'Title', body: kind === 'faq' ? 'Answer' : kind === 'stats' ? 'Label' : kind === 'contact' ? 'Value' : 'Text', link: 'Link' };
  const upd = (i, k) => v => { items[i] = { ...items[i], [k]: v }; commit({ keepInspector: k !== 'image' }); };
  const act = (i, a) => onCtl(() => { if (a === 'del') items.splice(i, 1); else { const j = i + (a === 'up' ? -1 : 1); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; } commit(); });
  const add = onCtl(() => { items.push(kind === 'faq' ? { title: 'New question', body: 'Answer' } : kind === 'stats' ? { title: '100', body: 'Label' } : kind === 'contact' ? { title: 'Label', body: 'Value' } : { title: '', body: '', image: '' }); commit(); });
  const multi = onCtl(() => pickMedia(urls => { for (const u of [].concat(urls)) items.push({ image: u, title: '' }); commit(); }, { multiple: true }));
  return group(lbl + 's', `<div class="items">${items.map((it, i) => `<div class="item"><header><span>${esc(lbl)} ${i + 1}${it.title ? ' · ' + esc(it.title) : ''}</span><button type="button" data-c="${act(i, 'up')}" title="Up">↑</button><button type="button" data-c="${act(i, 'down')}" title="Down">↓</button><button type="button" data-c="${act(i, 'del')}" title="Remove">✕</button></header>
    ${fields.map(f => f === 'image' ? fImage('', it.image, upd(i, 'image')) : f === 'link' ? fLink(names.link, it.link, upd(i, 'link')) : fText(names[f], (it[f] || '').replace(/<br>/g, '\n'), upd(i, f), { area: f === 'body' && kind !== 'stats' && kind !== 'contact', rows: 2 })).join('')}</div>`).join('')}</div>
    <div class="actions"><button class="btn sm" type="button" data-c="${add}">${ic('plus')} Add ${lbl.toLowerCase()}</button>${['gallery', 'logos'].includes(kind) ? `<button class="btn ghost sm" type="button" data-c="${multi}">Add several images</button>` : ''}</div>`);
}
function sectionLayout(t, el) {
  const d = secData(t.id) || {};
  const fx = d.fx || {};
  const { get, set } = styleGetSet(t);
  const s = get();
  const setFx = (k, v) => { const x = secData(t.id, true); x.fx = { ...(x.fx || {}), [k]: v || undefined }; commit({ keepInspector: true }); };
  const bl = isBlock(t.id) ? blockById(t.id) : null;
  let h = devNote('Height and spacing here');
  h += group('Height', `${fRange('Minimum height', s.minHeight ?? '', 0, 1600, 10, up(set, 'minHeight', true), 'px')}${!isMobile() ? fSwitch('Full screen height', fx.full === 'screen', v => setFx('full', v ? 'screen' : '')) : ''}
    <div class="grid2">${fRange('Space above', s.paddingTop ?? s.pt ?? '', 0, 400, 2, v => { set('paddingTop', v); set('pt', ''); liveCommit(); }, 'px')}${fRange('Space below', s.paddingBottom ?? s.pb ?? '', 0, 400, 2, v => { set('paddingBottom', v); set('pb', ''); liveCommit(); }, 'px')}</div>`);
  if (bl) h += group('Width', fSelect('Content width', bl.layout || 'center', [['center', 'Centred'], ['left', 'Left aligned'], ['narrow', 'Narrow'], ['wide', 'Wide'], ['full', 'Full width']], v => { bl.layout = v; commit({ keepInspector: true }); }));
  h += group('Behaviour', `${fSwitch('Sticky (stays at the top while scrolling)', !!fx.sticky, v => setFx('sticky', v))}${fText('Anchor name (menu links: #name)', fx.anchor || '', v => setFx('anchor', v.replace(/[^\w-]/g, '')), { ph: 'e.g. services' })}`);
  h += group('Visibility', `${fSwitch('Show on desktop', !fx.hideD && !d.hidden, v => { const x = secData(t.id, true); x.fx = { ...(x.fx || {}), hideD: !v || undefined }; if (v) delete x.hidden; commit({ keepInspector: true }); })}${fSwitch('Show on tablet', !fx.hideT && !d.hidden, v => { const x = secData(t.id, true); x.fx = { ...(x.fx || {}), hideT: !v || undefined }; if (v) delete x.hidden; commit({ keepInspector: true }); })}${fSwitch('Show on mobile', !d.mobile?.hidden && !d.hidden, v => { const x = secData(t.id, true); x.mobile = { ...(x.mobile || {}), hidden: !v || undefined }; if (v) delete x.hidden; commit({ keepInspector: true }); })}`);
  h += group('Order', `<div class="actions"><button class="btn ghost sm" data-c="${onCtl(() => moveSection(t.id, -1))}">${ic('up')} Move up</button><button class="btn ghost sm" data-c="${onCtl(() => moveSection(t.id, 1))}">${ic('down')} Move down</button></div>`);
  return h;
}
function sectionDesign(t) {
  const { get, set } = styleGetSet(t);
  const s = get();
  const d = secData(t.id) || {};
  const fx = d.fx || {};
  const setFx = (k, v) => { const x = secData(t.id, true); x.fx = { ...(x.fx || {}), [k]: v === '' ? undefined : v }; commit({ keepInspector: true }); };
  let h = devNote('Design changes here');
  h += savedStyles(t);
  h += group('Background', fillControls(s, set) + (!isMobile() ? `<div class="sublbl">Video background</div>${fImage('Video (MP4)', fx.video, v => setFx('video', v), { kind: 'video' })}${fx.video ? fImage('Poster (while loading)', fx.poster, v => setFx('poster', v)) : ''}` : ''));
  h += group('Overlay', `${fColor('Overlay colour', s.overlay, up(set, 'overlay', true), { ph: 'e.g. rgba(0,0,0,.4)' })}${fSwitch('Gradient overlay', !!s.overlayG, v => { set('overlayG', v ? { t: 'linear', a: 180, s: [{ c: 'rgba(0,0,0,0)', p: 0 }, { c: 'rgba(0,0,0,0.7)', p: 100 }] } : ''); commitNow(); renderInspector(); })}${s.overlayG ? fGradient('Overlay gradient', s.overlayG, v => set('overlayG', v)) : ''}${fRange('Overlay opacity', s.overlayOp ?? '', 0, 1, 0.05, up(set, 'overlayOp', true))}`, { closed: !s.overlay && !s.overlayG });
  if (!isMobile()) h += group('Scroll effect', `${fSelect('Background effect', fx.bg || '', [['', 'None'], ['parallax', 'Parallax'], ['fixed', 'Fixed (reveal)'], ['zoom', 'Zoom'], ['fade-bg', 'Fade']], v => setFx('bg', v))}${['parallax', 'zoom'].includes(fx.bg) ? fRange('Strength', fx.speed ?? 40, 0, 150, 1, v => { const x = secData(t.id, true); x.fx = { ...(x.fx || {}), speed: v }; liveCommit(); }) : ''}<p class="hint">Works with a background image or gradient.</p>`, { closed: !fx.bg });
  h += group('Text', `${fColor('Text colour', s.color, up(set, 'color', true))}${fButtons('Alignment', s.textAlign, [['left', 'Left', 'left'], ['center', 'Center', 'center'], ['right', 'Right', 'right']], up(set, 'textAlign'))}`, { closed: !s.color && !s.textAlign });
  h += group('Border & corners', borderControls(s, set) + cornerControls(s, set), { closed: !s.borderWidth && !s.borderRadius });
  h += group('Shadow', shadowControls(s, set), { closed: true });
  return h;
}
