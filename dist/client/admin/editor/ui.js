/* Satin editor — form controls, modals and the media picker. */
import { S, $, $$, esc, ic, api, toast, hooks, num } from './core.js?v=8';

/* ---------- control binding ---------- */
let ctl = 0;
export const bind = {};
export function onCtl(fn) { const id = 'c' + (++ctl); bind[id] = fn; return id; }
export function gcBind() { Object.keys(bind).forEach(k => { if (!document.querySelector(`[data-c="${k}"]`)) delete bind[k]; }); }
export function wire(root) {
  root.querySelectorAll('[data-c]').forEach(el => {
    if (el._wired) return; el._wired = true;
    const fn = bind[el.dataset.c]; if (!fn) return;
    const form = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    // buttons, links and other clickable elements (collapsible group headers) react to clicks; form fields to input / change
    const ev = !form ? 'click' : el.type === 'range' || el.type === 'color' ? 'input' : el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : el.dataset.live ? 'input' : 'change';
    el.addEventListener(ev, e => fn(el, e));
    if (!form && el.getAttribute('role') === 'button') el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(el, e); } });
    if (el.type === 'range' || el.type === 'color') {
      // one undo step per interaction: the slider / picker is "open" from pointerdown (or focus) until change / blur
      el.addEventListener('pointerdown', () => { txOpen = true; });
      el.addEventListener('focus', () => { if (el.type === 'color') txOpen = true; });
      el.addEventListener('change', () => { txOpen = false; commitNow(); });
      el.addEventListener('blur', () => { if (txOpen) { txOpen = false; commitNow(); } });
    }
  });
}
// liveCommit: show the change right away without an undo step; it settles into ONE step when the interaction ends
// (change / blur of a slider or colour picker) or after a short pause for typed values.
let liveTimer = 0, settleTimer = 0, txOpen = false;
export function liveCommit() {
  clearTimeout(liveTimer); liveTimer = setTimeout(() => { liveTimer = 0; hooks.commit?.({ live: true, keepInspector: true }); }, 40);
  clearTimeout(settleTimer); settleTimer = setTimeout(function settle() { if (txOpen) { settleTimer = setTimeout(settle, 400); return; } settleTimer = 0; commitNow(); }, 700);
}
export function commitNow() { clearTimeout(liveTimer); clearTimeout(settleTimer); hooks.commit?.({ keepInspector: true }); }
hooks.commitNow = commitNow;
hooks.cancelLive = () => { if (liveTimer || settleTimer) { const pending = !!liveTimer; clearTimeout(liveTimer); clearTimeout(settleTimer); liveTimer = settleTimer = 0; if (pending) hooks.commit?.({ live: true, keepInspector: true }); } };

/* ---------- colours ---------- */
export function parseColor(v) {
  v = String(v || '').trim(); let m;
  if ((m = v.match(/^#([0-9a-f]{3})$/i))) return { hex: '#' + m[1].split('').map(c => c + c).join(''), a: 1 };
  if ((m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i))) return { hex: '#' + m[1].toLowerCase(), a: m[2] ? Math.round(parseInt(m[2], 16) / 2.55) / 100 : 1 };
  if ((m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i))) return { hex: '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join(''), a: m[4] === undefined ? 1 : +m[4] };
  return { hex: '#000000', a: 1, none: !v, raw: v };
}
export function makeColor(hex, a) { if (a >= 1) return hex; const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.round(a * 100) / 100})`; }
const DEFAULT_SWATCHES = ['#ffffff', '#000000', '#16181d', '#c91c50', '#df2865', '#f59e0b', '#10b981', '#2563eb', '#6d28d9', '#f3f5f8', '#e2e6ed', 'transparent'];
export function swatches() { return [...new Set([...(S.theme?.palette || []), ...DEFAULT_SWATCHES])].slice(0, 24); }
export function fColor(label, value, fn, o = {}) {
  const c = parseColor(value);
  const id = onCtl((el, e) => {
    const w = el.closest('.color'); const txt = w.querySelector('[data-t]'), pick = w.querySelector('[type=color]'), al = w.querySelector('[data-a]');
    let v;
    if (el.type === 'text') { v = el.value.trim(); const p = parseColor(v); if (!p.none) { pick.value = p.hex; al.value = Math.round(p.a * 100); } }
    else { v = makeColor(pick.value, (+al.value || 100) / 100); txt.value = v; }
    pick.classList.toggle('unset', !v); w.querySelector('.chip i').style.background = v || 'transparent';
    fn(v || '');
  });
  const sw = onCtl((el) => { const v = el.dataset.v; const w = el.closest('.color'); w.querySelector('[data-t]').value = v; const p = parseColor(v); w.querySelector('[type=color]').value = p.hex; w.querySelector('[data-a]').value = Math.round(p.a * 100); w.querySelector('.chip i').style.background = v; fn(v); commitNow(); w.querySelector('.sw').hidden = true; });
  const tog = onCtl(el => { const s = el.closest('.color').querySelector('.sw'); s.hidden = !s.hidden; });
  const clr = onCtl(el => { const w = el.closest('.color'); w.querySelector('[data-t]').value = ''; w.querySelector('.chip i').style.background = 'transparent'; fn(''); commitNow(); });
  return `<div class="f"><span class="lbl">${esc(label)}</span><div class="color"><button type="button" class="chip${value ? '' : ' none'}" data-c="${tog}" title="Swatches"><i style="background:${esc(value || 'transparent')}"></i></button><input type="text" data-c="${id}" data-t value="${esc(value || '')}" placeholder="${esc(o.ph || 'Default')}"><input type="range" data-c="${id}" data-a min="0" max="100" value="${Math.round(c.a * 100)}" title="Opacity" class="alpha"><button type="button" data-c="${clr}" title="Clear">${ic('x')}</button>
    <div class="sw" hidden><label class="custom" title="Any colour"><input type="color" data-c="${id}" value="${c.hex}" class="${value ? '' : 'unset'}"><span>Custom colour…</span></label>${swatches().map(s => `<button type="button" data-c="${sw}" data-v="${esc(s)}" style="background:${s === 'transparent' ? 'repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/8px 8px' : esc(s)}" title="${esc(s)}"></button>`).join('')}</div></div></div>`;
}

/* ---------- basic fields ---------- */
export function fText(label, value, fn, o = {}) {
  const id = onCtl(el => fn(el.value));
  return `<label class="f"><span>${esc(label)}${o.hint ? `<em>${esc(o.hint)}</em>` : ''}</span>${o.area ? `<textarea data-c="${id}" rows="${o.rows || 4}" ${o.attr || ''} placeholder="${esc(o.ph || '')}"${o.live ? ' data-live="1"' : ''}>${esc(value ?? '')}</textarea>` : `<input type="${o.type || 'text'}" data-c="${id}" value="${esc(value ?? '')}" placeholder="${esc(o.ph || '')}" ${o.list ? `list="${o.list}"` : ''} ${o.attr || ''}${o.live ? ' data-live="1"' : ''}>`}</label>`;
}
export function fRange(label, value, min, max, step, fn, unit = '', o = {}) {
  const id = onCtl(el => { const w = el.closest('.range'); const v = el.value === '' ? '' : Number(el.value); w.querySelectorAll('input').forEach(i => { if (i !== el) i.value = el.value; }); fn(v); });
  const dis = o.disabled ? ' disabled' : '';
  return `<label class="f${o.disabled ? ' dis' : ''}"><span>${esc(label)}<em>${unit}</em></span><div class="range"><input type="range" data-c="${id}" min="${min}" max="${max}" step="${step}" value="${value ?? ''}"${dis} aria-label="${esc(label)}"><input type="number" data-c="${id}" min="${min}" max="${max}" step="${step}" value="${value ?? ''}" placeholder="Auto"${dis} aria-label="${esc(label)}"></div></label>`;
}
export function fNum(label, value, fn, o = {}) {
  const id = onCtl(el => fn(el.value === '' ? '' : Number(el.value)));
  return `<label class="f num${o.disabled ? ' dis' : ''}"${o.title ? ` title="${esc(o.title)}"` : ''}><span>${esc(label)}</span><div class="numin"><input type="number" data-c="${id}" value="${value ?? ''}" ${o.min !== undefined ? `min="${o.min}"` : ''} ${o.max !== undefined ? `max="${o.max}"` : ''} step="${o.step || 1}" placeholder="${esc(o.ph ?? 'Auto')}"${o.disabled ? ' disabled' : ''}${o.attr ? ' ' + o.attr : ''}>${o.unit ? `<em>${esc(o.unit)}</em>` : ''}</div></label>`;
}
export function fSize(label, value, fn, o = {}) {
  // value like "120px" / "50%" / "auto"
  const m = String(value ?? '').match(/^(-?[\d.]+)(px|%|vw|vh|rem|em)$/); const n = m ? m[1] : value === 'auto' ? '' : '', u = m ? m[2] : 'px';
  const id = onCtl(el => { const w = el.closest('.sizein'); const nv = w.querySelector('input').value, uv = w.querySelector('select').value; fn(uv === 'auto' ? 'auto' : nv === '' ? '' : nv + uv); });
  return `<label class="f num"><span>${esc(label)}</span><div class="sizein"><input type="number" data-c="${id}" value="${esc(n)}" step="1" placeholder="${esc(o.ph || 'Auto')}"><select data-c="${id}">${['px', '%', 'vw', 'vh', 'rem', 'auto'].map(x => `<option ${x === (value === 'auto' ? 'auto' : u) ? 'selected' : ''}>${x}</option>`).join('')}</select></div></label>`;
}
export function fSelect(label, value, options, fn, o = {}) {
  const id = onCtl(el => fn(el.value));
  return `<label class="f${o.cls ? ' ' + o.cls : ''}"><span>${esc(label)}</span><select data-c="${id}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(value ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
export function fSwitch(label, on, fn, o = {}) { const id = onCtl(el => fn(el.checked)); return `<label class="switch${o.disabled ? ' dis' : ''}"${o.title ? ` title="${esc(o.title)}"` : ''}>${esc(label)}<input type="checkbox" data-c="${id}" ${on ? 'checked' : ''}${o.disabled ? ' disabled' : ''}></label>`; }
export function fButtons(label, value, options, fn, o = {}) {
  return `<div class="f"><span class="lbl">${esc(label)}</span><div class="btns${o.wrap ? ' wrap' : ''}">${options.map(([v, l, icon]) => { const id = onCtl(() => fn(String(value) === String(v) && !o.noToggle ? '' : v)); return `<button type="button" data-c="${id}" class="${String(value) === String(v) ? 'on' : ''}" title="${esc(l)}">${icon ? ic(icon) : esc(l)}</button>`; }).join('')}</div></div>`;
}
export function fSeg(options, value, fn) { return `<div class="seg2">${options.map(([v, l]) => { const id = onCtl(() => fn(v)); return `<button type="button" data-c="${id}" class="${value === v ? 'on' : ''}">${esc(l)}</button>`; }).join('')}</div>`; }
export function group(title, body, o = {}) { const k = 'g:' + title.replace(/ \(.*\)$/, ''); const closed = o.closed && !S._open?.[k] || S._closed?.[k]; const id = onCtl(el => { const g = el.closest('.group'); g.classList.toggle('closed'); el.setAttribute('aria-expanded', String(!g.classList.contains('closed'))); (S._closed ||= {})[k] = g.classList.contains('closed'); (S._open ||= {})[k] = !S._closed[k]; }); return `<div class="group${closed ? ' closed' : ''}"><h4 data-c="${id}" role="button" tabindex="0" aria-expanded="${!closed}">${esc(title)}${o.badge ? `<em>${esc(o.badge)}</em>` : ''}</h4><div class="gb">${body}</div></div>`; }
export function fSides(label, vals, keys, fn, o = {}) {
  // vals: object with keys [top,right,bottom,left]
  const linked = keys.every(k => vals[k] === vals[keys[0]]);
  const id = onCtl(el => { const w = el.closest('.sides'); const lk = w.classList.contains('linked'); const v = el.value === '' ? '' : Number(el.value); if (lk) { w.querySelectorAll('input[type=number]').forEach(i => i.value = el.value); keys.forEach(k => fn(k, v)); } else fn(el.dataset.k, v); commitNow(); });
  const lk = onCtl(el => el.closest('.sides').classList.toggle('linked'));
  const names = o.names || ['Top', 'Right', 'Bottom', 'Left'];
  return `<div class="f"><span class="lbl">${esc(label)}</span><div class="sides${linked ? ' linked' : ''}">${keys.map((k, i) => `<label><input type="number" data-c="${id}" data-k="${k}" value="${vals[k] ?? ''}" min="${o.min ?? 0}" max="${o.max ?? 999}" placeholder="–"><small>${names[i]}</small></label>`).join('')}<button type="button" data-c="${lk}" title="Link all sides">${ic('link')}</button></div></div>`;
}
export function fImage(label, url, fn, o = {}) {
  const pick = onCtl(() => pickMedia(u => fn(u), { kind: o.kind || 'image' }));
  const clr = onCtl(() => fn(''));
  const vid = /\.(mp4|webm)(\?|$)/i.test(url || '');
  return `<div class="imgpick"><span class="lbl">${esc(label)}</span><div class="thumb${o.kind === 'vector' ? ' contain' : ''}" style="${url && !vid ? `background-image:url('${esc(url)}')` : ''}">${url ? (vid ? '▶ ' + esc(url.split('/').pop()) : '') : 'None'}</div><div class="actions"><button class="btn sm" type="button" data-c="${pick}">${url ? 'Replace' : 'Choose'}</button>${url ? `<button class="btn ghost sm" type="button" data-c="${clr}">Remove</button>` : ''}</div></div>`;
}
export function anchorsOnPage() {
  const ids = new Set();
  for (const s of S.content?.sections || []) if (s.fx?.anchor) ids.add(s.fx.anchor);
  for (const b of S.content?.blocks || []) if (b.fx?.anchor) ids.add(b.fx.anchor);
  for (const e of S.content?.edits || []) if (e.anchor) ids.add(e.anchor);
  return [...ids];
}
const popupsOnPage = () => (S.content?.els || []).filter(e => e.kind === 'popup');
export function fLink(label, value, fn, o = {}) {
  value = value || '';
  const type = !value ? 'none' : value === 'quote:' ? 'quote' : value.startsWith('#popup-') ? 'popup' : value.startsWith('#') ? 'anchor' : value.startsWith('mailto:') ? 'email' : value.startsWith('tel:') ? 'phone' : /^\/cms\/uploads\//.test(value) ? 'file' : value.startsWith('/') ? 'page' : 'url';
  const typeId = onCtl(el => { const t = el.value; fn(t === 'none' ? '' : t === 'quote' ? 'quote:' : t === 'page' ? '/satin' : t === 'anchor' ? '#' + (anchorsOnPage()[0] || 'top') : t === 'email' ? 'mailto:' : t === 'phone' ? 'tel:' : t === 'file' ? '/cms/uploads/' : t === 'popup' ? '#popup-' + (popupsOnPage()[0]?.id || '') : 'https://'); hooks.renderInspector?.(); });
  const val = onCtl(el => { let v = el.value.trim(); if (type === 'email' && !v.startsWith('mailto:')) v = 'mailto:' + v; if (type === 'phone' && !v.startsWith('tel:')) v = 'tel:' + v.replace(/[^\d+]/g, ''); if (type === 'anchor' && !v.startsWith('#')) v = '#' + v; fn(v); });
  const filePick = onCtl(() => pickMedia(u => fn(u), { kind: 'any' }));
  let inp = '';
  if (type === 'page') inp = `<select data-c="${val}">${S.pages.filter(p => p.lang === 'en' || p.path === value).map(p => `<option value="${esc(p.path)}" ${p.path === value ? 'selected' : ''}>${esc(p.title)} — ${esc(p.path.replace(/^\/satin/, '') || '/')}</option>`).join('')}${S.pages.some(p => p.path === value) ? '' : `<option selected value="${esc(value)}">${esc(value)}</option>`}</select>`;
  else if (type === 'anchor') inp = `<input data-c="${val}" value="${esc(value)}" list="anchorlist" placeholder="#section-name"><datalist id="anchorlist">${anchorsOnPage().map(a => `<option value="#${esc(a)}">`).join('')}</datalist>`;
  else if (type === 'email') inp = `<input data-c="${val}" value="${esc(value.replace(/^mailto:/, ''))}" placeholder="name@example.com">`;
  else if (type === 'phone') inp = `<input data-c="${val}" value="${esc(value.replace(/^tel:/, ''))}" placeholder="+1 905 …">`;
  else if (type === 'file') inp = `<div class="row"><input data-c="${val}" value="${esc(value)}" placeholder="/cms/uploads/…"><button type="button" class="btn sm" style="flex:none" data-c="${filePick}">Choose</button></div>`;
  else if (type === 'popup') { const ps = popupsOnPage(); inp = ps.length ? `<select data-c="${val}">${ps.map(e => `<option value="#popup-${esc(e.id)}" ${value === '#popup-' + e.id ? 'selected' : ''}>${esc(e.name || e.p?.title || e.p?.label || 'Popup')}</option>`).join('')}</select>` : '<p class="hint">Add a Popup element to this page first (Add › Interactive › Popup).</p>'; }
  else if (type === 'url') inp = `<input data-c="${val}" value="${esc(value)}" placeholder="https://…">`;
  const types = [['none', 'No link'], ['page', 'Page'], ['anchor', 'Section on this page'], ['url', 'Web address'], ['email', 'Email'], ['phone', 'Phone'], ['file', 'File / document'], ['popup', 'Open a popup'], ['quote', 'Open the quote form']];
  return `<div class="f linkf"><span class="lbl">${esc(label)}</span><select data-c="${typeId}">${types.map(([k, l]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${l}</option>`).join('')}</select>${inp ? `<div class="linkin">${inp}</div>` : ''}${o.newTab !== undefined && ['page', 'url', 'file'].includes(type) ? fSwitch('Open in a new tab', o.newTab, o.onNewTab) : ''}</div>`;
}
export function fGradient(label, g, fn) {
  g = g && Array.isArray(g.s) ? JSON.parse(JSON.stringify(g)) : { t: 'linear', a: 135, s: [{ c: '#c91c50', p: 0 }, { c: '#6d28d9', p: 100 }] };
  const up = (live) => { fn(JSON.parse(JSON.stringify(g))); live ? liveCommit() : commitNow(); };
  const t = onCtl(el => { g.t = el.value; up(); hooks.renderInspector?.(); });
  const a = onCtl(el => { g.a = Number(el.value); el.closest('.grad').querySelector('.gprev').style.background = gcss(g); up(true); });
  const stop = (i, k) => onCtl(el => { g.s[i][k] = k === 'p' ? Number(el.value) : el.value; el.closest('.grad').querySelector('.gprev').style.background = gcss(g); up(true); });
  const del = i => onCtl(() => { if (g.s.length > 2) { g.s.splice(i, 1); up(); hooks.renderInspector?.(); } });
  const add = onCtl(() => { if (g.s.length < 6) { g.s.push({ c: '#ffffff', p: 100 }); g.s.sort((x, y) => x.p - y.p); up(); hooks.renderInspector?.(); } });
  const rev = onCtl(() => { g.s = g.s.map(s => ({ ...s, p: 100 - s.p })).reverse(); up(); hooks.renderInspector?.(); });
  return `<div class="f grad"><span class="lbl">${esc(label)}</span><div class="gprev" style="background:${gcss(g)}"></div>
    <div class="grid2"><label class="f"><span>Type</span><select data-c="${t}">${[['linear', 'Linear'], ['radial', 'Radial'], ['conic', 'Conic']].map(([v, l]) => `<option value="${v}" ${g.t === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>${g.t !== 'radial' ? `<label class="f"><span>Angle<em>°</em></span><input type="number" data-c="${a}" min="0" max="360" value="${g.a}"></label>` : ''}</div>
    ${g.s.map((s, i) => `<div class="gstop"><input type="color" data-c="${stop(i, 'c')}" value="${parseColor(s.c).hex}"><input type="range" data-c="${stop(i, 'p')}" min="0" max="100" value="${s.p}"><span>${s.p}%</span><button type="button" data-c="${del(i)}" title="Remove">${ic('x')}</button></div>`).join('')}
    <div class="actions"><button type="button" class="btn ghost sm" data-c="${add}">${ic('plus')} Colour</button><button type="button" class="btn ghost sm" data-c="${rev}">Reverse</button></div></div>`;
}
const gcss = g => g.t === 'radial' ? `radial-gradient(circle,${g.s.map(s => `${s.c} ${s.p}%`).join(',')})` : g.t === 'conic' ? `conic-gradient(from ${g.a}deg,${g.s.map(s => `${s.c} ${s.p}%`).join(',')})` : `linear-gradient(${g.a}deg,${g.s.map(s => `${s.c} ${s.p}%`).join(',')})`;

/* ---------- modals ---------- */
export function modal(title, body, { wide, footer, cls } = {}) {
  const o = document.createElement('div'); o.className = 'ov';
  o.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls || ''}" role="dialog" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="x" data-close aria-label="Close">×</button></header><div class="mbody">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  document.body.append(o);
  const onEsc = e => { if (e.key === 'Escape' && [...document.querySelectorAll('.ov')].pop() === o) { e.stopPropagation(); e.preventDefault(); close(); } };
  const close = () => { o.remove(); removeEventListener('keydown', onEsc, true); };
  addEventListener('keydown', onEsc, true);
  o.addEventListener('mousedown', e => { if (e.target === o) close(); });
  o.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  wire(o);
  setTimeout(() => o.querySelector('[autofocus],input,textarea')?.focus(), 30);
  return { el: o, close };
}
export function confirmBox(title, text, yes, fn) {
  const m = modal(title, `<p style="margin:0;color:var(--mut)">${esc(text)}</p>`, { footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" data-yes>${esc(yes)}</button>` });
  $('[data-yes]', m.el).onclick = () => { m.close(); fn(); };
}
hooks.confirmBox = confirmBox;
export function promptBox(title, label, value, fn, o = {}) {
  const m = modal(title, `<label class="f"><span>${esc(label)}</span><input class="in" data-pv value="${esc(value || '')}" placeholder="${esc(o.ph || '')}" autofocus></label>`, { footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn" data-yes>${esc(o.yes || 'Save')}</button>` });
  const go = () => { const v = $('[data-pv]', m.el).value.trim(); m.close(); fn(v); };
  $('[data-yes]', m.el).onclick = go; $('[data-pv]', m.el).onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ---------- media ---------- */
export async function loadMedia(force) {
  if (S.media && !force) return;
  const d = await api('/media?site=1'); S.media = d.media.map(m => ({ ...m, kind: m.kind || 'image' })); S.siteImages = d.site.filter(x => /\.(webp|jpe?g|png)$/i.test(x.url) && !/logo|icon|favicon/i.test(x.url));
}
const ACCEPT = { image: 'image/*', vector: '.svg,image/svg+xml', video: 'video/mp4,video/webm,.mp4,.webm', audio: 'audio/*,.mp3,.m4a,.ogg,.wav', lottie: '.json,application/json', font: '.woff2,.woff,.ttf,.otf', any: 'image/*,.svg,video/mp4,.mp4,.webm,audio/*,.json,.woff2,.woff,.ttf,.otf' };
export async function uploadFiles(files, done) {
  const list = [...files];
  if (!list.length) return [];
  const out = [];
  for (const [i, f] of list.entries()) {
    toast(`Uploading ${i + 1} of ${list.length}…`);
    const fd = new FormData(); fd.append('file', f);
    try { const r = await api('/media/upload', fd); out.push(r.media); S.media?.unshift(r.media); } catch (e) { toast(f.name + ': ' + e.message, true); }
  }
  if (out.length) toast(out.length === 1 ? 'File uploaded' : out.length + ' files uploaded');
  done?.(out);
  return out;
}
export function mediaGrid(items, attr) {
  return `<div class="mgrid">${items.map(m => { const k = m.kind || 'image'; const vis = k === 'image' || k === 'vector'; return `<button type="button" ${attr}="${esc(m.url)}" data-id="${esc(m.id || '')}" class="k-${k}" style="${vis ? `background-image:url('${esc(m.url)}')` : ''}" title="${esc(m.name)}">${vis ? '' : `<b>${{ video: '▶ Video', audio: '♪ Audio', font: 'Aa Font', lottie: '✦ Lottie' }[k] || k}</b>`}<span>${esc(m.name)}</span></button>`; }).join('')}</div>`;
}
export function dropZone(b, onFiles) {
  const z = $('.drop', b); const inp = $('input[type=file]', b);
  $('[data-browse]', b).onclick = () => inp.click();
  inp.onchange = () => { onFiles(inp.files); inp.value = ''; };
  z.ondragover = e => { e.preventDefault(); z.classList.add('over'); };
  z.ondragleave = () => z.classList.remove('over');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('over'); onFiles(e.dataTransfer.files); };
}
export const DROP = (multiple, kind = 'any') => `<div class="drop"><span class="dz-d"><b>Drop files here</b> or </span><button type="button" class="btn ghost sm" data-browse><span class="dz-d">Browse…</span><span class="dz-p">${ic(kind === 'image' ? 'image' : 'plus', 2)} ${kind === 'image' ? 'Take a photo or choose one' : 'Upload from this phone'}</span></button><div class="hint" style="margin:6px 0 0">${kind === 'image' ? 'JPG, PNG, WebP, GIF or SVG · up to 12 MB' : kind === 'video' ? 'MP4 or WebM · up to 80 MB' : kind === 'audio' ? 'MP3, M4A, OGG or WAV' : kind === 'font' ? 'WOFF2, WOFF, TTF or OTF' : kind === 'lottie' ? 'Lottie .json file' : 'Images, SVG, video, audio, fonts and Lottie files'}</div><input type="file" accept="${ACCEPT[kind] || ACCEPT.any}" ${multiple ? 'multiple' : ''} hidden></div>`;
export async function pickMedia(fn, { multiple, kind = 'image' } = {}) {
  try { await loadMedia(); } catch (e) { toast(e.message, true); return; }
  const mine = () => S.media.filter(m => kind === 'any' || m.kind === kind || (kind === 'image' && m.kind === 'vector'));
  let tab = mine().length || kind !== 'image' ? 'mine' : 'site';
  const chosen = new Set();
  const title = { image: multiple ? 'Choose images' : 'Choose an image', vector: 'Choose an SVG', video: 'Choose a video', audio: 'Choose audio', lottie: 'Choose a Lottie animation', font: 'Choose a font', any: 'Choose a file' }[kind];
  const m = modal(title, '<div data-mp></div>', { wide: true, footer: multiple ? '<button class="btn ghost" data-close>Cancel</button><button class="btn" data-done>Add selected</button>' : '<button class="btn ghost" data-close>Cancel</button>' });
  const draw = () => {
    const box = $('[data-mp]', m.el);
    const list = tab === 'mine' ? mine() : S.siteImages;
    box.innerHTML = `${DROP(multiple, kind)}<div class="tabsm"><button data-t="mine" class="${tab === 'mine' ? 'on' : ''}">Your uploads (${mine().length})</button>${kind === 'image' ? `<button data-t="site" class="${tab === 'site' ? 'on' : ''}">Website images</button>` : ''}</div>${list.length ? mediaGrid(list, 'data-pick') : '<p class="hint">Nothing here yet — upload a file above.</p>'}<label class="f" style="margin-top:14px"><span>Or paste a link</span><div class="row"><input class="in" data-url placeholder="https://…"><button class="btn sm" style="flex:none" data-useurl>Use link</button></div></label>`;
    $$('[data-t]', box).forEach(x => x.onclick = () => { tab = x.dataset.t; draw(); });
    $$('[data-pick]', box).forEach(x => { if (chosen.has(x.dataset.pick)) x.classList.add('chosen'); x.onclick = () => { if (multiple) { chosen.has(x.dataset.pick) ? chosen.delete(x.dataset.pick) : chosen.add(x.dataset.pick); x.classList.toggle('chosen', chosen.has(x.dataset.pick)); } else { m.close(); fn(x.dataset.pick); } }; });
    $('[data-useurl]', box).onclick = () => { const v = $('[data-url]', box).value.trim(); if (!/^(https?:\/\/|\/)/.test(v)) { toast('Paste a full link', true); return; } m.close(); fn(multiple ? [v] : v); };
    dropZone(box, files => uploadFiles(files, out => { if (!out.length) return; if (multiple) { out.forEach(o => chosen.add(o.url)); tab = 'mine'; draw(); } else { m.close(); fn(out[0].url); } }));
  };
  draw();
  const dn = $('[data-done]', m.el); if (dn) dn.onclick = () => { m.close(); if (chosen.size) fn([...chosen]); };
}
export const pickImage = (fn, o = {}) => pickMedia(fn, { ...o, kind: 'image' });
export const fmtNum = v => v === null || v === undefined || v === '' ? '' : Math.round(num(v) * 10) / 10;
