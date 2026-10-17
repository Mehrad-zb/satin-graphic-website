// Satin site content runtime v3 — applies published (or draft, in the editor) page edits.
// Shared by the live site (satin.js → applySiteContent) and the admin website editor.
// v3 adds free elements (els), a richer style vocabulary, section effects and an animation engine.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ORIG = '__cmsOrig';
export const EDITABLE = 'h1,h2,h3,h4,h5,h6,p,img,video,a.btn,button[data-quote],.counter-item b,.counter-item span,.eyebrow';
export const MOBILE_MAX = 700;
export const TABLET_MAX = 1024;
export const FREE_W = 1200;

export function identify(root) {
  const elements = [...root.querySelectorAll(EDITABLE)];
  let next = Math.max(-1, ...[...root.querySelectorAll('[data-cms-id]')].map(el => /^e\d+$/.test(el.dataset.cmsId || '') ? Number(el.dataset.cmsId.slice(1)) : -1)) + 1;
  for (const el of elements) if (!el.hasAttribute('data-cms-id') && !el.closest('.cms-added-section,.cms-free,[data-cms-skip]')) el.dataset.cmsId = 'e' + next++;
  const parent = root.querySelector('.page-enter');
  if (parent) {
    const children = [...parent.children];
    let section = Math.max(-1, ...children.map(el => /^s\d+$/.test(el.dataset.cmsSection || '') ? Number(el.dataset.cmsSection.slice(1)) : -1)) + 1;
    for (const el of children) if (!el.dataset.cmsSection) el.dataset.cmsSection = 's' + section++;
  }
}

/* ---------- styles ---------- */
const GOOGLE = ['Montserrat', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Oswald', 'Raleway', 'Playfair Display', 'Bebas Neue', 'DM Sans', 'Work Sans', 'Nunito', 'Anton', 'Archivo Black', 'Barlow', 'Inter Tight', 'Space Grotesk', 'Sora', 'Rubik', 'Kanit', 'Righteous', 'Orbitron', 'Teko', 'Dancing Script', 'Pacifico', 'Lobster', 'Caveat', 'Merriweather', 'Lora', 'Cormorant Garamond', 'Vazirmatn', 'Inter', 'Manrope', 'Plus Jakarta Sans', 'Outfit', 'Urbanist', 'Figtree', 'Lexend', 'Epilogue', 'Syne', 'Unbounded', 'Archivo', 'Barlow Condensed', 'Big Shoulders Display', 'Chakra Petch', 'Exo 2', 'Fira Sans', 'IBM Plex Sans', 'IBM Plex Serif', 'Josefin Sans', 'Jost', 'Karla', 'Libre Franklin', 'Mulish', 'Noto Sans', 'Noto Serif', 'Nunito Sans', 'Oxanium', 'PT Sans', 'PT Serif', 'Quicksand', 'Red Hat Display', 'Saira', 'Source Sans 3', 'Titillium Web', 'Ubuntu', 'Zilla Slab', 'Bodoni Moda', 'DM Serif Display', 'Fraunces', 'Libre Baskerville', 'Crimson Pro', 'EB Garamond', 'Abril Fatface', 'Alfa Slab One', 'Black Ops One', 'Russo One', 'Permanent Marker', 'Satisfy', 'Great Vibes', 'Comfortaa', 'Space Mono', 'JetBrains Mono', 'Noto Naskh Arabic', 'Lalezar', 'Markazi Text'];
export const GOOGLE_FONTS = GOOGLE;
const LOCAL_FONTS = ['Vazirmatn', 'Inter', 'Manrope'];
export const fontHrefs = f => { const q = f.replace(/ /g, '+'); return [`https://fonts.googleapis.com/css2?family=${q}&display=swap`, `https://fonts.googleapis.com/css2?family=${q}:wght@300;400;500;600;700;800;900&display=swap`]; };
export const SERIF_FONTS = ['Playfair Display', 'Merriweather', 'Lora', 'Cormorant Garamond', 'IBM Plex Serif', 'Noto Serif', 'PT Serif', 'Zilla Slab', 'Bodoni Moda', 'DM Serif Display', 'Fraunces', 'Libre Baskerville', 'Crimson Pro', 'EB Garamond', 'Abril Fatface', 'Alfa Slab One', 'Noto Naskh Arabic', 'Markazi Text'];
export const fontStack = f => f === 'system-ui' ? 'system-ui,-apple-system,"Segoe UI",Arial,sans-serif' : f === 'Georgia' ? 'Georgia,"Times New Roman",serif' : SERIF_FONTS.includes(f) ? `"${f}",Georgia,serif` : `"${f}",system-ui,-apple-system,"Segoe UI",Arial,sans-serif`;
const SHADOW = { none: 'none', sm: '0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.06)', md: '0 6px 24px rgba(0,0,0,.12)', lg: '0 20px 60px rgba(0,0,0,.18)', xl: '0 30px 90px rgba(0,0,0,.28)' };
export const safeColor = v => /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|transparent|inherit|currentColor)$/i.test(String(v)) ? v : null;
export const safeUrl = v => { v = String(v || '').trim(); return /^(https?:\/\/|\/(?!\/))[^\s"'<>\\()]*$/i.test(v) ? v : ''; };
const num = v => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(v)) ? Number(v) : null;
export const SIZE_RE = /^(auto|-?\d{1,5}(\.\d{1,3})?(px|%|vw|vh|rem|em))$/;
const size = v => (typeof v === 'string' && SIZE_RE.test(v)) ? v : (num(v) !== null ? num(v) + 'px' : null);
const ENUM = {
  textAlign: ['left', 'center', 'right', 'justify'], objectFit: ['cover', 'contain', 'fill', 'none', 'scale-down'], textTransform: ['none', 'uppercase', 'lowercase', 'capitalize'],
  fontStyle: ['normal', 'italic'], textDecoration: ['none', 'underline', 'line-through', 'overline'], borderStyle: ['solid', 'dashed', 'dotted', 'double', 'none'],
  blend: ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'],
  writing: ['horizontal', 'vertical', 'vertical-up'], dir: ['ltr', 'rtl'], bgSize: ['cover', 'contain', 'auto'], bgRepeat: ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'], bgAttach: ['scroll', 'fixed'],
  bgPos: ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'],
  display: ['block', 'flex', 'grid', 'inline-block', 'none'], flexDir: ['row', 'column', 'row-reverse', 'column-reverse'], justify: ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly', 'stretch'],
  alignItems: ['start', 'center', 'end', 'stretch', 'baseline'], wrap: ['nowrap', 'wrap'], overflow: ['visible', 'hidden', 'auto', 'scroll'], pos: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  listStyle: ['none', 'disc', 'circle', 'square', 'decimal'], textFill: ['solid', 'gradient', 'image'], align: ['start', 'center', 'end'], shadow: Object.keys(SHADOW), whiteSpace: ['normal', 'nowrap', 'pre-line']
};
export const STYLE_ENUMS = ENUM;
const BLEND_CSS = { blend: 'mix-blend-mode' };
export function gradientCSS(g) {
  if (!g || typeof g !== 'object' || !Array.isArray(g.s)) return '';
  const stops = g.s.filter(x => x && safeColor(x.c)).slice(0, 6).map(x => `${x.c} ${Math.max(0, Math.min(100, num(x.p) ?? 0))}%`);
  if (stops.length < 2) return '';
  const a = Math.max(0, Math.min(360, num(g.a) ?? 180));
  if (g.t === 'radial') return `radial-gradient(circle at center,${stops.join(',')})`;
  if (g.t === 'conic') return `conic-gradient(from ${a}deg at center,${stops.join(',')})`;
  return `linear-gradient(${a}deg,${stops.join(',')})`;
}
// Converts a whitelisted style object into [property, value] pairs.
export function decls(s = {}) {
  const d = [];
  const px = (p, v) => { const n = num(v); if (n !== null) d.push([p, n + 'px']); };
  const sz = (p, v) => { const x = size(v); if (x) d.push([p, x]); };
  s = s || {};
  const bgLayers = [];
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined || v === null || v === '') continue;
    switch (k) {
      case 'fontSize': px('font-size', v); break;
      case 'fontWeight': if (num(v)) d.push(['font-weight', String(num(v))]); break;
      case 'color': case 'backgroundColor': case 'borderColor': { const c = safeColor(v); if (c) d.push([k === 'color' ? 'color' : k === 'backgroundColor' ? 'background-color' : 'border-color', c]); break; }
      case 'textAlign': case 'textTransform': case 'fontStyle': case 'objectFit': if (ENUM[k].includes(v)) d.push([k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), v]); break;
      case 'textDecoration': if (ENUM[k].includes(v)) d.push(['text-decoration-line', v]); break;
      case 'fontFamily': if (/^[\w -]{2,40}$/.test(v)) d.push(['font-family', fontStack(v)]); break;
      case 'width': if (num(v) !== null) d.push(['width', num(v) + '%']); break;
      case 'maxWidth': px('max-width', v); break;
      case 'height': px('height', v); break;
      case 'minHeight': px('min-height', v); break;
      case 'w': sz('width', v); break; case 'h': sz('height', v); break;
      case 'minW': sz('min-width', v); break; case 'maxW': sz('max-width', v); break; case 'minH': sz('min-height', v); break; case 'maxH': sz('max-height', v); break;
      case 'borderRadius': px('border-radius', v); break;
      case 'rTL': px('border-top-left-radius', v); break; case 'rTR': px('border-top-right-radius', v); break; case 'rBR': px('border-bottom-right-radius', v); break; case 'rBL': px('border-bottom-left-radius', v); break;
      case 'objectPosition': if (num(v) !== null) d.push(['object-position', num(v) + '% ' + (num(s.objectPosY) ?? 50) + '%']); break;
      case 'padding': px('padding', v); break;
      case 'paddingTop': case 'pt': px('padding-top', v); break; case 'paddingBottom': case 'pb': px('padding-bottom', v); break;
      case 'pl': px('padding-left', v); break; case 'pr': px('padding-right', v); break;
      case 'paddingX': px('padding-left', v); px('padding-right', v); break;
      case 'marginTop': case 'mt': px('margin-top', v); break; case 'marginBottom': case 'mb': px('margin-bottom', v); break;
      case 'ml': px('margin-left', v); break; case 'mr': px('margin-right', v); break;
      case 'gap': px('gap', v); break;
      case 'opacity': if (num(v) !== null) d.push(['opacity', String(num(v))]); break;
      case 'letterSpacing': px('letter-spacing', v); break; case 'wordSpacing': px('word-spacing', v); break;
      case 'lineHeight': if (num(v) !== null) d.push(['line-height', String(num(v))]); break;
      case 'borderWidth': if (num(v) !== null) { d.push(['border-width', num(v) + 'px']); d.push(['border-style', ENUM.borderStyle.includes(s.borderStyle) ? s.borderStyle : 'solid']); } break;
      case 'bwT': case 'bwR': case 'bwB': case 'bwL': if (num(v) !== null) { const side = { bwT: 'top', bwR: 'right', bwB: 'bottom', bwL: 'left' }[k]; d.push([`border-${side}-width`, num(v) + 'px']); d.push([`border-${side}-style`, ENUM.borderStyle.includes(s.borderStyle) ? s.borderStyle : 'solid']); } break;
      case 'shadow': if (SHADOW[v] && s.shX === undefined && s.ishBlur === undefined) d.push(['box-shadow', SHADOW[v]]); break;
      case 'backgroundImage': { const u = safeUrl(v); if (u && s.textFill !== 'image') bgLayers.push(`url("${u}")`); break; }
      case 'gradient': { const g = gradientCSS(v); if (g && s.textFill !== 'gradient') bgLayers.unshift(g); break; }
      case 'bgSize': if (ENUM.bgSize.includes(v)) d.push(['background-size', v]); break;
      case 'bgPos': if (ENUM.bgPos.includes(v)) d.push(['background-position', v]); break;
      case 'bgRepeat': if (ENUM.bgRepeat.includes(v)) d.push(['background-repeat', v]); break;
      case 'bgAttach': if (ENUM.bgAttach.includes(v)) d.push(['background-attachment', v]); break;
      case 'columns': if (num(v)) d.push(['grid-template-columns', `repeat(${Math.round(num(v))},minmax(0,1fr))`]); break;
      case 'rows': if (num(v)) d.push(['grid-template-rows', `repeat(${Math.round(num(v))},auto)`]); break;
      case 'hidden': if (v) d.push(['display', 'none']); break;
      case 'blend': if (ENUM.blend.includes(v)) d.push([BLEND_CSS.blend, v]); break;
      case 'backdrop': if (num(v)) { d.push(['backdrop-filter', `blur(${num(v)}px)`]); d.push(['-webkit-backdrop-filter', `blur(${num(v)}px)`]); } break;
      case 'writing': if (v === 'vertical') d.push(['writing-mode', 'vertical-rl']); else if (v === 'vertical-up') { d.push(['writing-mode', 'vertical-rl']); d.push(['transform', 'rotate(180deg)']); } break;
      case 'dir': if (ENUM.dir.includes(v)) d.push(['direction', v]); break;
      case 'display': if (ENUM.display.includes(v)) d.push(['display', v]); break;
      case 'flexDir': if (ENUM.flexDir.includes(v)) d.push(['flex-direction', v]); break;
      case 'justify': if (ENUM.justify.includes(v)) d.push(['justify-content', v]); break;
      case 'alignItems': if (ENUM.alignItems.includes(v)) d.push(['align-items', v]); break;
      case 'wrap': if (ENUM.wrap.includes(v)) d.push(['flex-wrap', v]); break;
      case 'overflow': if (ENUM.overflow.includes(v)) d.push(['overflow', v]); break;
      case 'zIndex': if (num(v) !== null) d.push(['z-index', String(Math.round(num(v)))]); break;
      case 'pos': if (ENUM.pos.includes(v)) d.push(['position', v]); break;
      case 'inT': sz('top', v); break; case 'inL': sz('left', v); break; case 'inR': sz('right', v); break; case 'inB': sz('bottom', v); break;
      case 'aspect': if (/^\d{1,4}\s*\/\s*\d{1,4}$/.test(String(v))) d.push(['aspect-ratio', String(v).replace(/\s/g, '')]); break;
      case 'listStyle': if (ENUM.listStyle.includes(v)) d.push(['list-style-type', v]); break;
      case 'whiteSpace': if (ENUM.whiteSpace.includes(v)) d.push(['white-space', v]); break;
      case 'strokeW': if (num(v)) { d.push(['-webkit-text-stroke', `${num(v)}px ${safeColor(s.strokeColor) || 'currentColor'}`]); } break;
      case 'highlight': { const c = safeColor(v); if (c) { d.push(['background-image', `linear-gradient(transparent 58%,${c} 58%)`]); d.push(['box-decoration-break', 'clone']); d.push(['-webkit-box-decoration-break', 'clone']); } break; }
    }
  }
  // composite properties
  if (bgLayers.length) d.push(['background-image', bgLayers.join(',')]);
  if (s.backgroundImage && safeUrl(s.backgroundImage) && s.textFill !== 'image') { if (!s.bgSize) d.push(['background-size', 'cover']); if (!s.bgPos) d.push(['background-position', 'center']); if (!s.bgRepeat) d.push(['background-repeat', 'no-repeat']); }
  if (s.textFill === 'gradient' && s.gradient && gradientCSS(s.gradient)) d.push(['background-image', gradientCSS(s.gradient)], ['-webkit-background-clip', 'text'], ['background-clip', 'text'], ['color', 'transparent'], ['-webkit-text-fill-color', 'transparent']);
  if (s.textFill === 'image' && safeUrl(s.backgroundImage)) d.push(['background-image', `url("${safeUrl(s.backgroundImage)}")`], ['background-size', 'cover'], ['background-position', 'center'], ['-webkit-background-clip', 'text'], ['background-clip', 'text'], ['color', 'transparent'], ['-webkit-text-fill-color', 'transparent']);
  const shadows = [];
  if (s.shX !== undefined || s.shY !== undefined || s.shBlur !== undefined) shadows.push(`${num(s.shX) || 0}px ${num(s.shY) || 0}px ${num(s.shBlur) || 0}px ${num(s.shSpread) || 0}px ${safeColor(s.shColor) || 'rgba(0,0,0,.25)'}`);
  if (s.ishX !== undefined || s.ishY !== undefined || s.ishBlur !== undefined) shadows.push(`inset ${num(s.ishX) || 0}px ${num(s.ishY) || 0}px ${num(s.ishBlur) || 0}px ${num(s.ishSpread) || 0}px ${safeColor(s.ishColor) || 'rgba(0,0,0,.25)'}`);
  if (shadows.length) d.push(['box-shadow', shadows.join(',')]);
  if (s.tsX !== undefined || s.tsY !== undefined || s.tsBlur !== undefined) d.push(['text-shadow', `${num(s.tsX) || 0}px ${num(s.tsY) || 0}px ${num(s.tsBlur) || 0}px ${safeColor(s.tsColor) || 'rgba(0,0,0,.35)'}`]);
  const f = [];
  if (num(s.blur)) f.push(`blur(${num(s.blur)}px)`);
  if (num(s.brightness) !== null && s.brightness !== '') f.push(`brightness(${num(s.brightness)}%)`);
  if (num(s.contrast) !== null && s.contrast !== '') f.push(`contrast(${num(s.contrast)}%)`);
  if (num(s.saturate) !== null && s.saturate !== '') f.push(`saturate(${num(s.saturate)}%)`);
  if (num(s.grayscale)) f.push(`grayscale(${num(s.grayscale)}%)`);
  if (num(s.hue)) f.push(`hue-rotate(${num(s.hue)}deg)`);
  if (f.length) d.push(['filter', f.join(' ')]);
  return d;
}
// kept for older callers
export function styleText(s = {}) { return decls(s).map(([p, v]) => p + ':' + v).join(';'); }
const rule = (sel, s, imp = true) => { const d = decls(s); return sel && d.length ? `${sel}{${d.map(([p, v]) => `${p}:${v}${imp ? '!important' : ''}`).join(';')}}` : ''; };
const boost = sel => /[{};<>\\,@]/.test(sel) ? null : `html body ${sel.replace(/^#main\s*/, '#main ')}:not(#cms-a):not(#cms-b)`;
const cleanId = v => String(v || '').replace(/[^\w-]/g, '');
// transform of an original page element (edits[].tf): translate x/y and rotate r keep their v3 output;
// v3.2 adds size w/h (px), scale sx/sy and flips fx/fy, plus tablet (tft) and phone (tfm) overrides.
const tfScale = t => [(num(t.sx) ?? 1) * (t.fx ? -1 : 1), (num(t.sy) ?? 1) * (t.fy ? -1 : 1)];
function tfExtra(t) {
  const d = [];
  if (!t || typeof t !== 'object') return d;
  const [sx, sy] = tfScale(t);
  if (sx !== 1 || sy !== 1) d.push(`scale:${sx} ${sy}`);
  if (num(t.w)) d.push(`width:${num(t.w)}px`, 'max-width:none', 'min-width:0', 'box-sizing:border-box');
  if (num(t.h)) d.push(`height:${num(t.h)}px`, 'max-height:none', 'min-height:0', 'box-sizing:border-box');
  return d;
}
function tfOverride(sel, base, ov) {
  const t = { ...(base || {}), ...ov };
  const [sx, sy] = tfScale(t);
  const d = [`translate:${num(t.x) || 0}px ${num(t.y) || 0}px`, `rotate:${num(t.r) || 0}deg`, `scale:${sx} ${sy}`];
  if (num(t.w)) d.push(`width:${num(t.w)}px`, 'max-width:none', 'min-width:0', 'box-sizing:border-box');
  if (num(t.h)) d.push(`height:${num(t.h)}px`, 'max-height:none', 'min-height:0', 'box-sizing:border-box');
  return `${sel}{${d.map(x => x + '!important').join(';')}}`;
}
export const RT_VERSION = '3.2';

/* ---------- inline HTML (same whitelist as the server) ---------- */
const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'SMALL', 'SUP', 'SUB', 'SPAN', 'A', 'MARK']);
const BLOCKISH = new Set(['P', 'UL', 'OL', 'LI', 'DIV']);
export function cleanHTML(html, doc = document, blocks = false) {
  const t = doc.createElement('template'); t.innerHTML = String(html ?? '');
  const walk = node => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1 || /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE|SVG|MATH|LINK|META)$/i.test(c.nodeName)) { c.remove(); continue; }
      walk(c);
      if (!INLINE.has(c.nodeName) && !(blocks && BLOCKISH.has(c.nodeName))) { c.replaceWith(...c.childNodes); continue; }
      const href = c.nodeName === 'A' ? c.getAttribute('href') : null, blank = c.getAttribute('target') === '_blank';
      for (const a of [...c.attributes]) c.removeAttribute(a.name);
      if (c.nodeName === 'DIV') { const p = doc.createElement('p'); p.append(...c.childNodes); c.replaceWith(p); continue; }
      if (c.nodeName === 'A') { const u = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href || '') ? href : ''; if (!u) { c.replaceWith(...c.childNodes); continue; } c.setAttribute('href', u); if (blank) { c.target = '_blank'; c.rel = 'noopener'; } }
    }
  };
  walk(t.content);
  return t.innerHTML;
}
const rich = s => cleanHTML(s);
export const linkOK = u => /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(String(u || '')) ? String(u) : '';

/* ---------- section blocks ---------- */
function videoHTML(v, o = {}) {
  v = String(v || '');
  let m;
  const ap = o.autoplay ? 1 : 0, lp = o.loop ? 1 : 0, mu = o.muted || o.autoplay ? 1 : 0;
  if ((m = v.match(/^yt:([\w-]{6,20})$/))) return `<div class="cms-video"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=${ap}&mute=${mu}&loop=${lp}&playlist=${m[1]}&controls=${o.controls === false ? 0 : 1}&rel=0&playsinline=1" title="Video" loading="lazy" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`;
  if ((m = v.match(/^vimeo:(\d{5,12})$/))) return `<div class="cms-video"><iframe src="https://player.vimeo.com/video/${m[1]}?autoplay=${ap}&muted=${mu}&loop=${lp}${o.controls === false ? '&background=1' : ''}" title="Video" loading="lazy" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen></iframe></div>`;
  const u = safeUrl(v);
  return u ? `<div class="cms-video"><video src="${esc(u)}"${o.controls === false ? '' : ' controls'}${ap ? ' autoplay' : ''}${lp ? ' loop' : ''}${mu ? ' muted' : ''} playsinline preload="metadata"${o.poster && safeUrl(o.poster) ? ` poster="${esc(safeUrl(o.poster))}"` : ''}${o.scrub ? ' data-scrub' : ''}></video></div>` : '<div class="cms-video cms-empty">Add a YouTube, Vimeo or MP4 link</div>';
}
function button(label, link, cls = 'btn', field = 'button') {
  if (!label) return '';
  if (link === 'quote:') return `<button type="button" class="${cls}" data-quote="" data-cms-field="${field}">${esc(label)}</button>`;
  const u = linkOK(link);
  return `<a class="${cls}" data-cms-field="${field}" href="${esc(u || '#')}"${/^https?:/i.test(u) && !u.startsWith(location.origin) ? ' target="_blank" rel="noopener"' : ''}>${esc(label)}</a>`;
}
const img = (src, alt, field = 'image', extra = '') => src ? `<img data-cms-field="${field}" src="${esc(safeUrl(src))}" alt="${esc(alt || '')}" loading="lazy"${extra}>` : `<div class="cms-img-empty" data-cms-field="${field}">Add an image</div>`;
const head = b => `${b.eyebrow ? `<span class="eyebrow" data-cms-field="eyebrow">${esc(b.eyebrow)}</span>` : ''}${b.title ? `<h2 class="d2 cms-b-title" data-cms-field="title">${esc(b.title)}</h2>` : ''}${b.body ? `<div class="cms-b-body" data-cms-field="body">${rich(b.body)}</div>` : ''}`;

export function blockInner(b) {
  const items = Array.isArray(b.items) ? b.items : [];
  switch (b.kind) {
    case 'text': return `<div class="cms-text">${head(b)}${b.button || b.button2 ? `<div class="cms-ctas">${button(b.button, b.link)}${button(b.button2, b.link2, 'btn ghost', 'button2')}</div>` : ''}</div>`;
    case 'image': return `<figure class="cms-figure">${img(b.image, b.alt)}${b.caption ? `<figcaption data-cms-field="caption">${esc(b.caption)}</figcaption>` : ''}</figure>`;
    case 'text-image': case 'image-text': return `<div class="cms-split${b.kind === 'image-text' ? ' rev' : ''}"><div class="cms-text">${head(b)}${b.button ? `<div class="cms-ctas">${button(b.button, b.link)}</div>` : ''}</div><div class="cms-media">${img(b.image, b.alt)}</div></div>`;
    case 'gallery': return `${head(b)}<div class="cms-gallery">${items.map((it, i) => `<figure>${img(it.image, it.alt || it.title, 'items.' + i + '.image')}${it.title ? `<figcaption>${esc(it.title)}</figcaption>` : ''}</figure>`).join('') || '<div class="cms-img-empty">Add images</div>'}</div>`;
    case 'cards': return `${head(b)}<div class="cms-cards">${items.map((it, i) => { const u = it.link === 'quote:' ? '' : linkOK(it.link); return `<article class="cms-card">${it.image ? img(it.image, it.alt || it.title, 'items.' + i + '.image') : ''}<div class="cms-card-body">${it.title ? `<h3>${esc(it.title)}</h3>` : ''}${it.body ? `<div>${rich(it.body)}</div>` : ''}${it.link === 'quote:' ? '<button type="button" class="cms-more" data-quote="">Get a quote →</button>' : u ? `<a class="cms-more" href="${esc(u)}">Learn more →</a>` : ''}</div></article>`; }).join('')}</div>`;
    case 'cta': return `<div class="cms-cta">${head(b)}<div class="cms-ctas">${button(b.button, b.link)}${button(b.button2, b.link2, 'btn ghost', 'button2')}</div></div>`;
    case 'video': return `${head(b)}${videoHTML(b.video)}`;
    case 'spacer': return `<div class="cms-spacer" style="height:${Math.max(0, Math.min(600, num(b.height) ?? 60))}px"></div>`;
    case 'divider': return '<hr class="cms-divider">';
    case 'blank': return '';
    case 'hscroll': return `${head(b)}<div class="cms-hs" data-hs><div class="cms-hs-track">${items.map((it, i) => { const u = linkOK(it.link); return `<article class="cms-hs-card">${img(it.image, it.alt || it.title, 'items.' + i + '.image')}<div class="cms-hs-b"><span class="cms-hs-n">${String(i + 1).padStart(2, '0')}</span>${it.title ? `<h3 data-cms-field="items.${i}.title">${esc(it.title)}</h3>` : ''}${it.body ? `<p data-cms-field="items.${i}.body">${esc(it.body)}</p>` : ''}${u ? `<a class="cms-more" href="${esc(u)}">${esc(it.button || 'Learn more')} →</a>` : ''}</div></article>`; }).join('')}</div></div>`;
    case 'testimonial': return `<blockquote class="cms-quote"><div class="cms-stars" aria-hidden="true">★★★★★</div><div class="cms-b-body" data-cms-field="body">${rich(b.body)}</div><footer>${b.image ? img(b.image, b.name, 'image', ' width="48" height="48"') : ''}<span><b data-cms-field="name">${esc(b.name)}</b>${b.role ? `<small data-cms-field="role">${esc(b.role)}</small>` : ''}</span></footer></blockquote>`;
    case 'button': return `<div class="cms-ctas cms-center">${button(b.button || 'Get a quote', b.link)}</div>`;
    case 'faq': return `${head(b)}<div class="cms-faq">${items.map(it => `<details><summary>${esc(it.title)}</summary><div>${rich(it.body)}</div></details>`).join('')}</div>`;
    case 'contact': return `<div class="cms-split"><div class="cms-text">${head(b)}<div class="cms-ctas">${button(b.button || 'Start a quote', b.link || 'quote:')}</div></div><div class="cms-contact">${items.map(it => `<div><small>${esc(it.title)}</small>${linkOK(it.link) ? `<a href="${esc(linkOK(it.link))}">${rich(it.body)}</a>` : `<b>${rich(it.body)}</b>`}</div>`).join('')}</div></div>`;
    case 'stats': return `${head(b)}<div class="cms-stats">${items.map(it => `<div><b>${esc(it.title)}</b><span>${rich(it.body)}</span></div>`).join('')}</div>`;
    case 'logos': return `${head(b)}<div class="cms-logos">${items.map((it, i) => { const u = linkOK(it.link); const im = img(it.image, it.alt || it.title, 'items.' + i + '.image'); return u ? `<a href="${esc(u)}">${im}</a>` : im; }).join('')}</div>`;
    default: return head(b);
  }
}
export function blockHTML(b) {
  const id = esc(cleanId(b.id));
  return `<section class="cms-added-section cms-block cms-k-${esc(b.kind)} cms-l-${esc(b.layout || 'center')}" data-cms-section="${id}"${b.hidden ? ' hidden' : ''}><div class="wrap">${blockInner(b)}</div></section>`;
}

/* ---------- free elements ---------- */
export const SOCIAL = {
  facebook: 'M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.2-.6.6-.6z',
  instagram: 'M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5-8.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 2.5c-2.6 0-2.9 0-3.9.1-3.5.2-5.4 2.1-5.6 5.6-.1 1-.1 1.3-.1 3.8s0 2.9.1 3.9c.2 3.5 2.1 5.4 5.6 5.6 1 .1 1.3.1 3.9.1s2.9 0 3.9-.1c3.5-.2 5.4-2.1 5.6-5.6.1-1 .1-1.3.1-3.9s0-2.8-.1-3.8c-.2-3.5-2.1-5.4-5.6-5.6-1-.1-1.3-.1-3.9-.1z',
  tiktok: 'M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6z',
  youtube: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z',
  linkedin: 'M6.9 21H3.2V9h3.7zM5 7.4A2.2 2.2 0 1 1 5 3a2.2 2.2 0 0 1 0 4.4zM21 21h-3.7v-5.8c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9.4V9H13v1.6a3.9 3.9 0 0 1 3.5-1.9c3.8 0 4.5 2.5 4.5 5.7z',
  x: 'M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.9 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.4 4.7H5.5z',
  whatsapp: 'M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2s-1 .2-3.4-.7a11.8 11.8 0 0 1-4.6-4.1 5.2 5.2 0 0 1-1.1-2.8 3 3 0 0 1 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1a.5.5 0 0 1 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6a8.3 8.3 0 0 0 1.6 1.9 7.4 7.4 0 0 0 2.2 1.4c.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4a2.4 2.4 0 0 1-.2 1.4z',
  pinterest: 'M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.4s-.3-.7-.3-1.6c0-1.5.9-2.7 2-2.7.9 0 1.4.7 1.4 1.5 0 .9-.6 2.3-.9 3.6-.3 1.1.5 2 1.6 2 1.9 0 3.4-2 3.4-5 0-2.6-1.9-4.4-4.5-4.4a4.7 4.7 0 0 0-4.9 4.7c0 .9.4 1.9.8 2.5.1.1.1.2.1.3l-.3 1.2c0 .2-.2.3-.4.2-1.4-.7-2.3-2.7-2.3-4.4 0-3.6 2.6-6.9 7.5-6.9 3.9 0 7 2.8 7 6.6 0 3.9-2.5 7.1-5.9 7.1-1.2 0-2.2-.6-2.6-1.3l-.7 2.7c-.3 1-1 2.2-1.4 3A10 10 0 1 0 12 2z',
  email: 'M3 5h18v14H3zm1.8 1.5L12 12l7.2-5.5z',
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2a11.4 11.4 0 0 0 3.6.6c.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z',
  google: 'M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z'
};
export const ICONS = {
  arrow: 'M5 12h14M13 6l6 6-6 6', check: 'M5 12l5 5 9-10', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', heart: 'M12 20s-7-4.4-9.3-8.9C1.2 8 3 4.5 6.6 4.5c2 0 3.4 1.1 4.4 2.4 1-1.3 2.4-2.4 4.4-2.4 3.6 0 5.4 3.5 3.9 6.6C19 15.6 12 20 12 20z',
  phone: SOCIAL.phone, mail: SOCIAL.email, pin: 'M12 21s-7-6.3-7-11.5A7 7 0 0 1 19 9.5C19 14.7 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',
  car: 'M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2h3v-2M17 16v2h3v-2M6.5 13h.01M17.5 13h.01', truck: 'M2 6h12v10H2zM14 9h4l4 4v3h-8M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', play: 'M8 5l11 7-11 7z', calendar: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4', cart: 'M3 4h2l2.4 11h11l2-8H6.3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4', chat: 'M4 5h16v11H8l-4 4z', menu: 'M4 6h16M4 12h16M4 18h16', plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M18 6L6 18', search: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm9 15l-4.5-4.5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8', paint: 'M4 20c2 0 3-1 3-3a2 2 0 1 1 4 0c0 2-2 3-4 3M10 14l9-9a2 2 0 0 0-3-3l-9 9', download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  ...Object.fromEntries(Object.entries(SOCIAL).map(([k, v]) => ['s-' + k, v]))
};
const FILLED = new Set(['star', 'heart', 'play', 'bolt', 'pin', ...Object.keys(SOCIAL).map(k => 's-' + k)]);
export const iconSVG = (n, cls = '') => { const p = ICONS[n]; if (!p) return ''; const fill = FILLED.has(n); return `<svg class="cms-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}><path d="${p}"/></svg>`; };
export const SHAPES = {
  rect: '', circle: 'circle(50% at 50% 50%)', ellipse: 'ellipse(50% 50% at 50% 50%)', triangle: 'polygon(50% 0,100% 100%,0 100%)', diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  hexagon: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)', star: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
  arrow: 'polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)', chevron: 'polygon(0 0,75% 0,100% 50%,75% 100%,0 100%,25% 50%)', parallelogram: 'polygon(20% 0,100% 0,80% 100%,0 100%)',
  pentagon: 'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)', message: 'polygon(0 0,100% 0,100% 75%,30% 75%,10% 100%,15% 75%,0 75%)', blob: 'polygon(30% 4%,64% 0,93% 18%,100% 54%,84% 88%,48% 100%,14% 90%,0 58%,6% 22%)',
  'line-h': '', 'line-v': ''
};
const EL_KINDS = ['text', 'button', 'image', 'shape', 'vector', 'box', 'video', 'audio', 'embed', 'map', 'social', 'icon', 'menu', 'form', 'slider', 'accordion', 'tabs', 'countdown', 'progress', 'beforeafter', 'marquee', 'lottie', 'repeater', 'counter', 'popup', 'imgseq'];
export const ELEMENT_KINDS = EL_KINDS;

function elLink(el, inner, cls, extra = '') {
  const l = el.link;
  if (!l) return `<div class="${cls}"${extra}>${inner}</div>`;
  if (l === 'quote:') return `<button type="button" class="${cls} cms-lnk" data-quote=""${extra}>${inner}</button>`;
  const u = linkOK(l);
  if (!u) return `<div class="${cls}"${extra}>${inner}</div>`;
  const ext = el.newTab || (/^https?:/i.test(u) && typeof location !== 'undefined' && !u.startsWith(location.origin));
  return `<a class="${cls} cms-lnk" href="${esc(u)}"${ext ? ' target="_blank" rel="noopener"' : ''}${extra}>${inner}</a>`;
}
const P = el => el.p || {};
function popupHTML(el) {
  const p = P(el), size = ['sm', 'md', 'lg', 'full'].includes(p.size) ? p.size : 'md', pos = ['center', 'bottom', 'right', 'left'].includes(p.pos) ? p.pos : 'center';
  const bl = p.btnLink === 'quote:' ? 'quote:' : linkOK(p.btnLink);
  const btn = p.btn ? (bl === 'quote:' ? `<button type="button" class="btn" data-quote="">${esc(p.btn)}</button>` : `<a class="btn" href="${esc(bl || '#')}">${esc(p.btn)}</a>`) : '';
  const st = [safeColor(p.bg) ? `background:${safeColor(p.bg)}` : '', safeColor(p.ink) ? `color:${safeColor(p.ink)}` : ''].filter(Boolean).join(';');
  return `<div class="cms-pop pos-${pos} sz-${size}" data-pop-id="${esc(cleanId(el.id))}" data-once="${p.once === false ? 0 : 1}" style="--dim:${Math.max(0, Math.min(95, num(p.dim) ?? 55)) / 100}" role="dialog" aria-modal="true" aria-label="${esc(p.title || 'Popup')}"><div class="cms-pop-bg" data-pop-close></div><div class="cms-pop-box"${st ? ` style="${st}"` : ''}><button type="button" class="cms-pop-x" aria-label="Close" data-pop-close>×</button>${safeUrl(p.img) ? `<img class="cms-pop-img" src="${esc(safeUrl(p.img))}" alt="">` : ''}<div class="cms-pop-c">${p.title ? `<h2>${esc(p.title)}</h2>` : ''}${p.html ? `<div class="cms-pop-t">${cleanHTML(p.html, document, true)}</div>` : ''}${p.form ? `<form class="cms-form" data-cms-form="${esc(p.title || 'Popup form')}" data-ok="Thanks! We'll be in touch shortly." novalidate><label class="cms-f"><span>Name *</span><input name="_name" required maxlength="120"></label><label class="cms-f"><span>Email *</span><input name="_email" type="email" required maxlength="200"></label><label class="cms-f"><span>Phone</span><input name="_phone" type="tel" maxlength="40"></label><label class="cms-f"><span>Message</span><textarea name="f0" rows="3" maxlength="2000"></textarea></label><label class="cms-chk"><input type="checkbox" name="_consent" value="1" required> I agree to be contacted about my request.</label><input class="cms-hp" name="website" tabindex="-1" autocomplete="off"><button class="btn" type="submit">Send</button><p class="cms-form-msg" role="status"></p></form>` : ''}${btn ? `<div class="cms-ctas">${btn}</div>` : ''}</div></div></div>`;
}
export function openPopup(doc, id, preview) {
  const t = doc.querySelector(`[data-el="${cleanId(id)}"] template[data-pop]`); if (!t) return;
  doc.querySelectorAll('.cms-pop.on').forEach(x => x.remove());
  const w = doc.createElement('div'); w.innerHTML = t.innerHTML; const pop = w.firstElementChild; if (!pop) return;
  doc.body.append(pop);
  const win = doc.defaultView;
  const close = () => { pop.classList.remove('on'); win.setTimeout(() => pop.remove(), 300); doc.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  pop.addEventListener('click', e => { if (e.target.closest('[data-pop-close]')) close(); else if (e.target.closest('[data-quote],a[href]') && !preview) win.setTimeout(close, 50); });
  doc.addEventListener('keydown', esc_);
  pop.querySelectorAll('[data-cms-form]').forEach(f => f.addEventListener('submit', e => submitForm(e, f, win)));
  win.requestAnimationFrame(() => pop.classList.add('on'));
  pop.querySelector('.cms-pop-x')?.focus({ preventScroll: true });
}
function elInner(el, kids = '') {
  const p = P(el);
  switch (el.kind) {
    case 'text': { const tag = /^(h[1-6]|p|div)$/.test(p.tag) ? p.tag : 'div'; return `<${tag} class="cms-txt">${cleanHTML(p.html || '', document, true) || '&nbsp;'}</${tag}>`; }
    case 'button': { const ic = p.icon && ICONS[p.icon] ? iconSVG(p.icon) : ''; return `<span class="cms-btn-in${p.iconPos === 'right' ? ' r' : ''}${!p.label ? ' only' : ''}">${ic}${p.label ? `<span>${esc(p.label)}</span>` : ''}</span>`; }
    case 'image': if (p.img && num(p.img.w) && p.src && safeUrl(p.src)) {
      // image content placed freely inside the box: width and offsets in % of the box width, independent of the box size
      const g = p.img, r = num(g.r) || 0, ar = num(g.ar);
      return `<span class="cms-crop cms-imgc"><img src="${esc(safeUrl(p.src))}" alt="${esc(p.alt || '')}" loading="lazy" draggable="false" style="width:${num(g.w).toFixed(3)}%;${ar ? `aspect-ratio:${ar.toFixed(4)};` : ''}margin-left:${(num(g.x) || 0).toFixed(3)}%;margin-top:${(num(g.y) || 0).toFixed(3)}%;transform:translate(-50%,-50%)${r ? ` rotate(${r}deg)` : ''}"></span>`;
    }
    if (p.crop && p.src && safeUrl(p.src)) { const c = p.crop, cw = Math.max(1, num(c.w) || 100), ch = Math.max(1, num(c.h) || 100); return `<span class="cms-crop"><img src="${esc(safeUrl(p.src))}" alt="${esc(p.alt || '')}" loading="lazy" draggable="false" style="width:${(10000 / cw).toFixed(3)}%;height:${(10000 / ch).toFixed(3)}%;left:${(-(num(c.x) || 0) / cw * 100).toFixed(3)}%;top:${(-(num(c.y) || 0) / ch * 100).toFixed(3)}%"></span>`; }
    // falls through
    case 'vector': return p.src && safeUrl(p.src) ? `<img src="${esc(safeUrl(p.src))}" alt="${esc(p.alt || '')}" loading="lazy" draggable="false">` : '<div class="cms-img-empty">Add an image</div>';
    case 'shape': return '';
    case 'box': return kids;
    case 'popup': return `${p.label ? `<span class="cms-btn-in">${esc(p.label)}</span>` : `<span class="cms-pop-chip">⧉ Popup${p.trigger === 'load' ? ' · opens on load' : p.trigger === 'scroll' ? ' · opens on scroll' : p.trigger === 'exit' ? ' · on exit' : ''}</span>`}<template data-pop>${popupHTML(el)}</template>`;
    case 'imgseq': { const fr = (p.frames || []).map(safeUrl).filter(Boolean); return fr.length ? `<div class="cms-seq" data-seq="${esc(p.mode || 'scroll')}" data-fps="${num(p.fps) || 12}" data-loop="${p.loop === false ? 0 : 1}" data-dist="${num(p.dist) || 100}" data-frames="${esc(JSON.stringify(fr))}"><img src="${esc(fr[0])}" alt="${esc(p.alt || '')}" draggable="false"></div>` : '<div class="cms-img-empty">Add frames in Settings</div>'; }
    case 'video': return videoHTML(p.src, p);
    case 'audio': { const u = safeUrl(p.src); return u ? `<audio src="${esc(u)}" controls preload="none"${p.loop ? ' loop' : ''}></audio>` : '<div class="cms-img-empty">Add an MP3 link</div>'; }
    case 'embed': {
      if (p.url && /^https:\/\//.test(p.url) && safeUrl(p.url)) return `<iframe class="cms-frame" src="${esc(safeUrl(p.url))}" loading="lazy" title="${esc(p.title || 'Embedded content')}" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation" allow="autoplay;fullscreen;encrypted-media"></iframe>`;
      return p.html ? `<iframe class="cms-frame" srcdoc="${esc('<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%}</style>' + p.html)}" loading="lazy" title="${esc(p.title || 'Embedded content')}" sandbox="allow-scripts allow-popups allow-forms"></iframe>` : '<div class="cms-img-empty">Paste embed code</div>';
    }
    case 'map': return p.q ? `<iframe class="cms-frame" src="https://www.google.com/maps?q=${encodeURIComponent(p.q)}&z=${Math.max(3, Math.min(20, num(p.zoom) || 14))}&output=embed" loading="lazy" title="Map" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div class="cms-img-empty">Add an address</div>';
    case 'social': return `<div class="cms-social">${(p.items || []).filter(i => SOCIAL[i.net] && linkOK(i.url)).map(i => `<a href="${esc(linkOK(i.url))}" target="_blank" rel="noopener" aria-label="${esc(i.net)}">${iconSVG('s-' + i.net)}</a>`).join('')}</div>`;
    case 'icon': return iconSVG(p.icon || 'star');
    case 'menu': {
      const items = (p.items || []).filter(i => i && i.label);
      const mega = !!p.mega, cols = Math.max(1, Math.min(5, num(p.megaCols) || 3));
      const side = mega && (safeUrl(p.megaImg) || p.megaNote) ? `<aside class="cms-mega-side">${safeUrl(p.megaImg) ? `<img src="${esc(safeUrl(p.megaImg))}" alt="" loading="lazy">` : ''}${p.megaNote ? `<p>${esc(p.megaNote)}</p>` : ''}</aside>` : '';
      const subHTML = i => mega ? `<div class="cms-mega" style="--mc:${cols}"><ul>${i.sub.map(s => `<li><a href="${esc(linkOK(s.href) || '#')}"><b>${esc(s.label)}</b>${s.desc ? `<small>${esc(s.desc)}</small>` : ''}</a></li>`).join('')}</ul>${side}</div>` : `<ul>${i.sub.map(s => `<li><a href="${esc(linkOK(s.href) || '#')}">${esc(s.label)}</a></li>`).join('')}</ul>`;
      const li = items.map(i => `<li${(i.sub || []).length ? ` class="has-sub${mega ? ' has-mega' : ''}"` : ''}><a href="${esc(linkOK(i.href) || '#')}">${esc(i.label)}${(i.sub || []).length ? '<i class="cms-caret"></i>' : ''}</a>${(i.sub || []).length ? subHTML(i) : ''}</li>`).join('');
      return `<nav class="cms-menu ${mega ? 'mega ' : ''}${p.vertical ? 'v' : 'h'} ${p.burger === 'always' ? 'burger-all' : p.burger === 'never' ? '' : 'burger-mob'}"><button type="button" class="cms-burger" aria-label="Menu" data-burger>${iconSVG('menu')}</button><ul>${li}</ul></nav>`;
    }
    case 'form': {
      const f = (p.fields || []).slice(0, 20);
      const field = (x, i) => {
        const nm = 'f' + i, req = x.required ? ' required' : '', lab = `<span>${esc(x.label || '')}${x.required ? ' *' : ''}</span>`;
        if (x.type === 'textarea') return `<label class="cms-f">${lab}<textarea name="${nm}" rows="4"${req}></textarea></label>`;
        if (x.type === 'select') return `<label class="cms-f">${lab}<select name="${nm}"${req}><option value="">Choose…</option>${(x.options || []).map(o => `<option>${esc(o)}</option>`).join('')}</select></label>`;
        if (x.type === 'checkbox') return `<label class="cms-f cms-chk"><input type="checkbox" name="${nm}" value="yes"${req}> ${esc(x.label || '')}</label>`;
        return `<label class="cms-f">${lab}<input name="${nm}" type="${['text', 'email', 'tel', 'date', 'number'].includes(x.type) ? x.type : 'text'}"${req}></label>`;
      };
      return `<form class="cms-form" data-cms-form="${esc(p.service || 'Website form')}" data-ok="${esc(p.ok || 'Thank you! We will get back to you shortly.')}" novalidate>${p.title ? `<h3>${esc(p.title)}</h3>` : ''}
        <label class="cms-f"><span>Name *</span><input name="_name" required autocomplete="name"></label><label class="cms-f"><span>Email *</span><input name="_email" type="email" required autocomplete="email"></label><label class="cms-f"><span>Phone *</span><input name="_phone" type="tel" required autocomplete="tel"></label>
        ${f.map(field).join('')}<input name="website" tabindex="-1" autocomplete="off" class="cms-hp" aria-hidden="true">
        <label class="cms-f cms-chk"><input type="checkbox" name="_consent" required> I agree to be contacted about my request.</label>
        <button type="submit" class="btn">${esc(p.submit || 'Send')}</button><p class="cms-form-msg" role="status"></p></form>`;
    }
    case 'slider': {
      const items = (p.items || []).filter(i => safeUrl(i.src));
      const mode = ['slide', 'fade', 'carousel', 'grid'].includes(p.mode) ? p.mode : 'slide';
      return `<div class="cms-slider m-${mode}" data-slider data-auto="${num(p.auto) || 0}" style="--per:${Math.max(1, Math.min(6, num(p.per) || (mode === 'carousel' ? 3 : 1)))};--gap:${num(p.gap) ?? 12}px"><div class="cms-track">${items.map(i => { const im = `<img src="${esc(safeUrl(i.src))}" alt="${esc(i.alt || '')}" loading="lazy" draggable="false">${i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : ''}`; return `<figure class="cms-slide">${linkOK(i.link) ? `<a href="${esc(linkOK(i.link))}">${im}</a>` : im}</figure>`; }).join('') || '<div class="cms-img-empty">Add images</div>'}</div>${mode !== 'grid' && p.arrows !== false ? '<button type="button" class="cms-prev" aria-label="Previous">‹</button><button type="button" class="cms-next" aria-label="Next">›</button>' : ''}${mode !== 'grid' && p.dots !== false ? '<div class="cms-dots"></div>' : ''}</div>`;
    }
    case 'accordion': return `<div class="cms-acc">${(p.items || []).map((i, k) => `<details${k === 0 && p.open ? ' open' : ''}><summary>${esc(i.title)}</summary><div>${cleanHTML(i.body || '', document, true)}</div></details>`).join('')}</div>`;
    case 'tabs': return `<div class="cms-tabs" data-tabs><div class="cms-tablist" role="tablist">${(p.items || []).map((i, k) => `<button type="button" role="tab" class="${k ? '' : 'on'}" data-tab="${k}">${esc(i.title)}</button>`).join('')}</div>${(p.items || []).map((i, k) => `<div class="cms-tabpane" data-pane="${k}"${k ? ' hidden' : ''}>${cleanHTML(i.body || '', document, true)}</div>`).join('')}</div>`;
    case 'countdown': return `<div class="cms-count" data-countdown="${esc(String(p.to || ''))}" data-done="${esc(p.done || '')}">${['days', 'hours', 'min', 'sec'].map(u => `<div><b data-u="${u}">00</b><small>${esc((p.labels || {})[u] || { days: 'Days', hours: 'Hours', min: 'Minutes', sec: 'Seconds' }[u])}</small></div>`).join('')}</div>`;
    case 'progress': { const v = Math.max(0, Math.min(100, num(p.value) ?? 60)); return `<div class="cms-prog">${p.label ? `<div class="cms-prog-l"><span>${esc(p.label)}</span><b>${v}%</b></div>` : ''}<div class="cms-prog-t"><i data-prog="${v}" style="width:${v}%"></i></div></div>`; }
    case 'counter': return `<div class="cms-counter"><b data-counter="${num(p.to) ?? 100}" data-dur="${num(p.dur) || 1600}">${esc(String(p.prefix || ''))}${num(p.to) ?? 100}${esc(String(p.suffix || ''))}</b>${p.label ? `<small>${esc(p.label)}</small>` : ''}</div>`;
    case 'beforeafter': return safeUrl(p.before) && safeUrl(p.after) ? `<div class="cms-ba" data-ba style="--ba:${Math.max(0, Math.min(100, num(p.start) ?? 50))}%"><img src="${esc(safeUrl(p.after))}" alt="${esc(p.afterAlt || 'After')}" draggable="false"><div class="cms-ba-b"><img src="${esc(safeUrl(p.before))}" alt="${esc(p.beforeAlt || 'Before')}" draggable="false"></div><input type="range" min="0" max="100" value="${Math.max(0, Math.min(100, num(p.start) ?? 50))}" aria-label="Compare before and after"><span class="cms-ba-h"></span>${p.labels !== false ? '<em class="l">Before</em><em class="r">After</em>' : ''}</div>` : '<div class="cms-img-empty">Choose before and after images</div>';
    case 'marquee': { const t = `<span>${esc(p.text || 'Your scrolling text')}</span>`; return `<div class="cms-marq${p.reverse ? ' rev' : ''}" style="--ms:${Math.max(4, Math.min(120, num(p.speed) || 20))}s"><div class="cms-marq-in">${t.repeat(6)}</div><div class="cms-marq-in" aria-hidden="true">${t.repeat(6)}</div></div>`; }
    case 'lottie': return safeUrl(p.src) ? `<div class="cms-lottie" data-lottie="${esc(safeUrl(p.src))}" data-loop="${p.loop === false ? 0 : 1}"></div>` : '<div class="cms-img-empty">Add a Lottie JSON link</div>';
    case 'repeater': { const cols = Math.max(1, Math.min(6, num(p.cols) || 3)); return `<div class="cms-rep" style="--cols:${cols}">${(p.items || []).map(i => { const body = `${safeUrl(i.image) ? `<img src="${esc(safeUrl(i.image))}" alt="${esc(i.title || '')}" loading="lazy">` : ''}<div class="cms-rep-b">${i.title ? `<h3>${esc(i.title)}</h3>` : ''}${i.body ? `<p>${esc(i.body)}</p>` : ''}${i.button ? `<span class="cms-more">${esc(i.button)} →</span>` : ''}</div>`; return i.link === 'quote:' ? `<button type="button" class="cms-rep-i" data-quote="">${body}</button>` : linkOK(i.link) ? `<a class="cms-rep-i" href="${esc(linkOK(i.link))}">${body}</a>` : `<div class="cms-rep-i">${body}</div>`; }).join('')}</div>`; }
  }
  return '';
}
// one element and its children (box)
function elHTML(el, all) {
  const id = cleanId(el.id);
  const kids = el.kind === 'box' ? all.filter(c => c.parent === el.id).sort((a, b) => (a.z || 0) - (b.z || 0)).map(c => elHTML(c, all)).join('') : '';
  const dis = el.kind === 'button' && P(el).disabled;
  const linkable = !dis && (!['form', 'menu', 'slider', 'tabs', 'accordion', 'embed', 'map', 'video', 'audio', 'beforeafter', 'repeater', 'social', 'box', 'popup', 'imgseq'].includes(el.kind) || (el.kind === 'box' && el.link && !kids.includes('<a')));
  const inner = elInner(el, kids);
  const cls = `cms-in k-${el.kind}${el.kind === 'shape' ? ' sh-' + esc(P(el).shape || 'rect') : ''}${el.kind === 'button' || (el.kind === 'popup' && P(el).label) ? ' cms-ebtn' : ''}${dis ? ' is-dis' : ''}${el.kind === 'box' && P(el).flow ? ' lay-flow' : ''}`;
  const tip = el.tip ? ` data-tip="${esc(el.tip)}"` : '';
  const content = el.kind === 'popup' ? `<button type="button" class="${cls}" data-pop-open="${id}"${P(el).trigger && P(el).trigger !== 'click' ? ` data-pop-auto="${esc(P(el).trigger)}" data-delay="${num(P(el).delay) ?? 3}" data-at="${num(P(el).at) ?? 50}"` : ''}${tip}>${inner}</button>` : linkable ? elLink(el, inner, cls, tip) : `<div class="${cls}"${tip}${dis ? ' aria-disabled="true"' : ''}>${inner}</div>`;
  const a = el.anim || {};
  const ain = a.in && a.in.t ? ` data-ain="${esc(a.in.t)}"` : '';
  return `<div class="cms-el${el.full ? ' full' : ''}${el.free ? ' fpos' : ''}${el.pin ? ' pinned' : ''}${el.hideD ? ' hide-d' : ''}${el.hideT ? ' hide-t' : ''}${el.m && el.m.hide ? ' hide-m' : ''}${el.kind === 'popup' && P(el).trigger && P(el).trigger !== 'click' && !P(el).label ? ' pop-auto' : ''}" data-el="${id}"${ain}><div class="cms-a">${content}</div></div>`;
}

/* ---------- css for added content ---------- */
const BLOCK_CSS = `.cms-block{padding-block:clamp(40px,6vw,88px);background:var(--bg)}.cms-block .wrap{display:grid;gap:22px}.cms-block .d2{margin:0}.cms-block .cms-b-body{color:var(--ink-2);font-size:17px;line-height:1.65;white-space:pre-line;max-width:70ch}
.cms-k-blank{padding:0;min-height:480px}.cms-k-blank .wrap{display:block}
.cms-l-center .cms-text,.cms-l-center>.wrap>.d2,.cms-l-center>.wrap>.eyebrow,.cms-l-center>.wrap>.cms-b-body{text-align:center;margin-inline:auto;justify-items:center}.cms-l-center .cms-b-body{margin-inline:auto}.cms-l-center .cms-ctas{justify-content:center}
.cms-l-narrow .wrap{max-width:820px}.cms-l-wide .wrap{max-width:1400px}.cms-l-full .wrap{max-width:none;padding-inline:0}
.cms-text{display:grid;gap:16px;align-content:center}.cms-ctas{display:flex;gap:12px;flex-wrap:wrap}.cms-center{justify-content:center}
.cms-split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(24px,5vw,64px);align-items:center}.cms-split.rev .cms-media{order:-1}.cms-split .cms-l-center .cms-text{text-align:left}
.cms-split .cms-text,.cms-split .cms-b-body{text-align:start;justify-items:start;margin-inline:0}.cms-split .cms-ctas{justify-content:flex-start}
.cms-media img,.cms-figure img{width:100%;height:auto;border-radius:var(--r-lg,18px);display:block}.cms-figure{margin:0}.cms-figure figcaption{color:var(--mut);font-size:14px;margin-top:10px;text-align:center}
.cms-img-empty{display:grid;place-items:center;min-height:120px;height:100%;border:2px dashed var(--line,#ddd);border-radius:var(--r-md,14px);color:var(--mut,#888);background:var(--bg-2,#f5f5f5);font-size:14px;text-align:center;padding:8px}
.cms-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.cms-gallery figure{margin:0}.cms-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--r-md,14px);display:block}.cms-gallery figcaption{font-size:14px;color:var(--mut);margin-top:6px}
.cms-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.cms-card{background:var(--card,#fff);border:1px solid var(--line);border-radius:var(--r-md,16px);overflow:hidden;display:flex;flex-direction:column}.cms-card img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block}.cms-card-body{padding:20px;display:grid;gap:8px}.cms-card h3{margin:0;font-size:19px}.cms-card-body>div{color:var(--ink-2);white-space:pre-line}.cms-more{color:var(--accent);font-weight:700;text-decoration:none;background:none;border:0;padding:0;cursor:pointer;justify-self:start;font:inherit}
.cms-cta{background:var(--btn);color:var(--btn-ink);border-radius:var(--r-lg,24px);padding:clamp(28px,5vw,64px);display:grid;gap:16px;justify-items:center;text-align:center}.cms-cta .d2,.cms-cta .cms-b-body{color:inherit}.cms-cta .cms-b-body{opacity:.85}.cms-cta .btn:not(.ghost){background:var(--accent);color:#fff}.cms-cta .btn.ghost{color:inherit;border-color:currentColor;background:transparent}
.cms-video{position:relative;aspect-ratio:16/9;border-radius:var(--r-lg,18px);overflow:hidden;background:#000}.cms-video iframe,.cms-video video{position:absolute;inset:0;width:100%;height:100%;border:0;object-fit:cover}.cms-video.cms-empty{display:grid;place-items:center;color:#bbb}
.cms-k-spacer,.cms-k-divider{padding-block:0}.cms-divider{border:0;border-top:1px solid var(--line);margin:24px 0}
.cms-quote{margin:0 auto;max-width:760px;text-align:center;display:grid;gap:14px;justify-items:center}.cms-quote .cms-b-body{font-size:clamp(19px,2.2vw,24px);color:var(--ink);text-align:center}.cms-stars{color:#f5a623;letter-spacing:3px}.cms-quote footer{display:flex;gap:12px;align-items:center}.cms-quote footer img{width:48px;height:48px;border-radius:50%;object-fit:cover}.cms-quote small{display:block;color:var(--mut)}
.cms-faq{display:grid;gap:10px;max-width:860px;width:100%;margin-inline:auto}.cms-faq details{border:1px solid var(--line);border-radius:var(--r-sm,12px);padding:14px 18px;background:var(--card,#fff)}.cms-faq summary{font-weight:700;cursor:pointer}.cms-faq details>div{margin-top:10px;color:var(--ink-2);white-space:pre-line}
.cms-contact{display:grid;gap:12px}.cms-contact>div{border:1px solid var(--line);border-radius:var(--r-md,14px);padding:16px 18px;background:var(--card,#fff)}.cms-contact small{display:block;color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.cms-contact a,.cms-contact b{font-size:18px;font-weight:700;color:var(--ink);text-decoration:none}
.cms-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:18px;text-align:center}.cms-stats b{display:block;font-size:clamp(32px,4vw,48px);letter-spacing:-.03em}.cms-stats span{color:var(--mut)}
.cms-logos{display:flex;flex-wrap:wrap;gap:28px 40px;align-items:center;justify-content:center}.cms-logos img{height:44px;width:auto;max-width:160px;object-fit:contain;filter:grayscale(1);opacity:.75;transition:.2s}.cms-logos a:hover img,.cms-logos img:hover{filter:none;opacity:1}
@media(max-width:800px){.cms-split{grid-template-columns:1fr}.cms-split.rev .cms-media{order:0}.cms-gallery,.cms-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.cms-gallery,.cms-cards{grid-template-columns:1fr}}
/* sections */
.cms-sec{position:relative;isolation:isolate}.cms-bgl{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;border-radius:inherit}.cms-bgl>video,.cms-bgl>.cms-bgi{position:absolute;inset:-12% 0;width:100%;height:124%;object-fit:cover;background-size:cover;background-position:center;will-change:transform}.cms-bgl>.cms-ovl{position:absolute;inset:0}
.cms-sticky{position:sticky!important;top:var(--hdr-h,0px);z-index:5}.cms-fullscreen{min-height:100vh!important;min-height:100svh!important}
/* free elements */
.cms-free{position:absolute;top:0;left:calc(50% - ${FREE_W / 2}px);width:${FREE_W}px;height:100%;transform-origin:0 0;pointer-events:none;z-index:3;text-align:left}
.cms-free .cms-el{position:absolute;pointer-events:auto;box-sizing:border-box}
.cms-el>.cms-a{width:100%;height:100%}.cms-el .cms-in{width:100%;height:100%;box-sizing:border-box;display:block;position:relative;text-decoration:none;color:inherit;transition:all var(--ht,.3s) var(--he,ease);background-repeat:no-repeat}
.cms-el.auto-h,.cms-el.auto-h>.cms-a,.cms-el.auto-h .cms-in{height:auto}
.cms-el.full{left:var(--fl,calc(50% - 50vw))!important;width:var(--fw,100vw)!important}
.cms-el button.cms-in{all:unset;box-sizing:border-box;display:block;width:100%;height:100%;cursor:pointer;transition:all var(--ht,.3s) var(--he,ease)}
.cms-in .cms-txt{margin:0;font:inherit;color:inherit;letter-spacing:inherit;line-height:inherit;text-align:inherit;white-space:pre-wrap;overflow-wrap:anywhere}.cms-in .cms-txt p{margin:0 0 .6em}.cms-in .cms-txt p:last-child{margin:0}.cms-in .cms-txt ul,.cms-in .cms-txt ol{margin:.4em 0;padding-inline-start:1.3em}
.k-text{font-size:18px;line-height:1.5}.k-text h1,.k-text h2,.k-text h3,.k-text h4,.k-text h5,.k-text h6{font-weight:800;line-height:1.1}
.cms-el .cms-in.cms-ebtn{display:flex;align-items:center;justify-content:center;background-color:var(--btn,#111);color:var(--btn-ink,#fff);border-radius:999px;font-weight:700;font-size:16px;line-height:1.2;cursor:pointer;text-align:center;padding:0 18px;font-family:inherit}
.cms-btn-in{display:inline-flex;align-items:center;gap:8px}.cms-btn-in.r{flex-direction:row-reverse}.cms-btn-in .cms-ico{width:1.15em;height:1.15em;flex:none}
.k-image img,.k-vector img{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;user-select:none}.k-vector img{object-fit:contain}
.k-shape{background:var(--accent,#c91c50)}${Object.entries(SHAPES).filter(([, v]) => v).map(([k, v]) => `.sh-${k}{clip-path:${v}}`).join('')}.sh-line-h,.sh-line-v{background:transparent!important}.sh-line-h::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:var(--lw,2px) var(--ls,solid) var(--lc,currentColor);transform:translateY(-50%)}.sh-line-v::before{content:"";position:absolute;top:0;bottom:0;left:50%;border-left:var(--lw,2px) var(--ls,solid) var(--lc,currentColor)}
.k-box{border-radius:0}.lay-flow>.cms-el{position:relative!important;left:auto!important;top:auto!important;bottom:auto!important;flex:none}.k-video .cms-video,.k-video .cms-video iframe{height:100%;aspect-ratio:auto;border-radius:inherit}.k-audio audio{width:100%}
.cms-frame{width:100%;height:100%;border:0;display:block;border-radius:inherit;background:#fff}
.k-social{font-size:32px;gap:12px}.cms-social{display:flex;gap:inherit;align-items:center;height:100%;flex-wrap:wrap}.cms-social a{color:inherit;display:grid;place-items:center;width:1em;height:1em;transition:transform .2s}.cms-social a:hover{transform:translateY(-2px)}.cms-social svg{width:100%;height:100%}
.k-icon{display:grid!important;place-items:center;color:var(--accent,#c91c50)}.k-icon .cms-ico{width:100%;height:100%}
.k-menu{gap:24px}.cms-menu{height:100%;display:flex;align-items:center;gap:inherit}.cms-menu>ul{list-style:none;margin:0;padding:0;display:flex;gap:inherit;align-items:center}.cms-menu li ul{list-style:none;margin:0}.cms-menu.v ul{flex-direction:column;align-items:flex-start}.cms-menu a{color:inherit;text-decoration:none;font-weight:600}.cms-menu a:hover{color:var(--accent)}.cms-menu li{position:relative}.cms-menu li ul{display:none;position:absolute;top:100%;left:0;background:var(--bg,#fff);box-shadow:0 10px 30px #0002;border-radius:10px;padding:10px;flex-direction:column;align-items:flex-start;gap:6px;min-width:180px;z-index:20}.cms-menu li:hover>ul{display:flex}.cms-burger{display:none;border:0;background:none;color:inherit;cursor:pointer;width:36px;height:36px;padding:4px}.cms-burger svg{width:100%;height:100%}
.cms-menu.burger-all .cms-burger{display:block}.cms-menu.burger-all>ul{display:none;position:absolute;top:100%;right:0;flex-direction:column;align-items:flex-start;background:var(--bg,#fff);padding:16px;border-radius:12px;box-shadow:0 12px 40px #0003;z-index:30;min-width:220px}.cms-menu.open>ul{display:flex!important}
.cms-form{display:grid;gap:12px;height:100%;align-content:start}.cms-form h3{margin:0 0 4px}.cms-f{display:grid;gap:4px;font-size:14px;font-weight:600}.cms-f input,.cms-f textarea,.cms-f select{font:inherit;font-weight:400;padding:10px 12px;border:1px solid var(--line,#ccc);border-radius:10px;background:var(--card,#fff);color:inherit;width:100%;box-sizing:border-box}.cms-chk{display:flex;gap:8px;align-items:center;font-weight:400}.cms-chk input{width:auto}.cms-hp{position:absolute!important;left:-9999px!important}.cms-form-msg{margin:0;font-size:14px}.cms-form-msg.err{color:#b91c1c}.cms-form-msg.ok{color:#15803d;font-weight:600}
.cms-slider{position:relative;height:100%;overflow:hidden;border-radius:inherit}.cms-track{display:flex;height:100%;transition:transform .5s ease;gap:var(--gap)}.cms-slide{margin:0;flex:0 0 calc((100% - (var(--per) - 1) * var(--gap)) / var(--per));height:100%;position:relative}.cms-slide img{width:100%;height:100%;object-fit:cover;display:block}.cms-slide figcaption{position:absolute;left:0;right:0;bottom:0;padding:12px 16px;background:linear-gradient(transparent,#000a);color:#fff;font-size:14px}
.m-fade .cms-track{display:grid}.m-fade .cms-slide{grid-area:1/1;opacity:0;transition:opacity .7s}.m-fade .cms-slide.on{opacity:1}.m-grid .cms-track{display:grid;grid-template-columns:repeat(var(--per),1fr);transform:none!important}.m-grid .cms-slide{height:auto;aspect-ratio:4/3}
.cms-prev,.cms-next{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;border:0;background:#fffd;color:#111;font-size:26px;line-height:1;cursor:pointer;box-shadow:0 4px 14px #0003;z-index:2}.cms-prev{left:10px}.cms-next{right:10px}.cms-dots{position:absolute;bottom:10px;left:0;right:0;display:flex;gap:6px;justify-content:center;z-index:2}.cms-dots button{width:8px;height:8px;border-radius:50%;border:0;background:#fff8;padding:0;cursor:pointer}.cms-dots button.on{background:#fff}
.cms-acc{display:grid;gap:8px}.cms-acc details{border:1px solid var(--line,#ddd);border-radius:12px;padding:12px 16px;background:var(--card,#fff)}.cms-acc summary{font-weight:700;cursor:pointer}.cms-acc details>div{margin-top:8px}
.cms-tablist{display:flex;gap:6px;border-bottom:1px solid var(--line,#ddd);margin-bottom:12px;flex-wrap:wrap}.cms-tablist button{border:0;background:none;padding:10px 14px;font:inherit;font-weight:600;cursor:pointer;color:inherit;opacity:.65;border-bottom:2px solid transparent;margin-bottom:-1px}.cms-tablist button.on{opacity:1;border-color:var(--accent,#c91c50)}
.cms-count{display:flex;gap:12px;justify-content:center;height:100%;align-items:center}.cms-count>div{display:grid;justify-items:center;min-width:64px}.cms-count b{font-size:2.2em;font-variant-numeric:tabular-nums;line-height:1}.cms-count small{opacity:.7;font-size:.8em;margin-top:4px}
.cms-prog-l{display:flex;justify-content:space-between;margin-bottom:6px;font-weight:600}.cms-prog-t{height:var(--ph,10px);background:var(--bg-2,#eee);border-radius:999px;overflow:hidden}.cms-prog-t i{display:block;height:100%;background:var(--pc,var(--accent,#c91c50));border-radius:inherit;transition:width 1.4s ease}
.cms-counter{display:grid;justify-items:center;text-align:center}.cms-counter b{font-size:3em;line-height:1;font-variant-numeric:tabular-nums}.cms-counter small{opacity:.7}
.cms-ba{position:relative;height:100%;overflow:hidden;border-radius:inherit;user-select:none}.cms-ba>img,.cms-ba-b img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.cms-ba-b{position:absolute;inset:0;clip-path:inset(0 calc(100% - var(--ba)) 0 0)}.cms-ba input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0;z-index:3}.cms-ba-h{position:absolute;top:0;bottom:0;left:var(--ba);width:3px;background:#fff;transform:translateX(-50%);box-shadow:0 0 8px #0006;pointer-events:none}.cms-ba-h::after{content:"⟷";position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:38px;height:38px;border-radius:50%;background:#fff;color:#111;display:grid;place-items:center;font-size:18px}.cms-ba em{position:absolute;top:10px;font-style:normal;font-size:12px;font-weight:700;background:#000a;color:#fff;padding:4px 8px;border-radius:6px;pointer-events:none}.cms-ba em.l{left:10px}.cms-ba em.r{right:10px}
.cms-marq{overflow:hidden;display:flex;height:100%;align-items:center;white-space:nowrap}.cms-marq-in{display:flex;flex:none;animation:cms-marq var(--ms) linear infinite}.cms-marq.rev .cms-marq-in{animation-direction:reverse}.cms-marq span{padding-inline:.6em}@keyframes cms-marq{to{transform:translateX(-100%)}}
.cms-lottie{width:100%;height:100%}.cms-rep{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:16px}.cms-rep-i{all:unset;box-sizing:border-box;display:flex;flex-direction:column;border:1px solid var(--line,#ddd);border-radius:14px;overflow:hidden;background:var(--card,#fff);cursor:pointer;transition:transform .25s,box-shadow .25s}.cms-rep-i:hover{transform:translateY(-3px);box-shadow:0 12px 30px #0002}.cms-rep-i img{width:100%;aspect-ratio:16/10;object-fit:cover}.cms-rep-b{padding:16px;display:grid;gap:6px}.cms-rep-b h3{margin:0;font-size:18px}.cms-rep-b p{margin:0;opacity:.8}
[data-tip]{position:relative}[data-tip]:hover::after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);background:#111;color:#fff;font-size:13px;font-weight:500;line-height:1.3;padding:6px 10px;border-radius:6px;white-space:nowrap;z-index:50;pointer-events:none;letter-spacing:0;text-transform:none}
#cms-pins{position:fixed;inset:0;pointer-events:none;z-index:900}#cms-pins .cms-el{position:fixed;pointer-events:auto}
@media(min-width:${TABLET_MAX + 1}px){.cms-el.hide-d,[data-hide-d]{display:none!important}}@media(min-width:${MOBILE_MAX + 1}px) and (max-width:${TABLET_MAX}px){.cms-el.hide-t{display:none!important}}
@media(max-width:${MOBILE_MAX}px){.cms-el.hide-m{display:none!important}.cms-burger{display:block}.cms-menu.burger-mob>ul{display:none;position:absolute;top:100%;right:0;flex-direction:column;align-items:flex-start;background:var(--bg,#fff);padding:16px;border-radius:12px;box-shadow:0 12px 40px #0003;z-index:30;min-width:200px}.cms-rep{grid-template-columns:1fr}
.cms-free.mabs{left:0!important;width:100%!important;transform:none!important}.cms-free.stack{position:relative;inset:auto;left:0!important;width:auto!important;height:auto!important;transform:none!important;display:flex;flex-direction:column;gap:14px;padding:18px var(--gut,18px);max-width:none;pointer-events:auto}.cms-k-blank .cms-free.stack{padding-top:28px;padding-bottom:28px}
.cms-free.stack>.cms-el:not(.pinned){position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;width:auto!important;max-width:100%;transform:none!important}
.cms-free.stack>.cms-el.w-image,.cms-free.stack>.cms-el.w-box,.cms-free.stack>.cms-el.w-video,.cms-free.stack>.cms-el.w-slider,.cms-free.stack>.cms-el.w-embed,.cms-free.stack>.cms-el.w-map,.cms-free.stack>.cms-el.w-shape,.cms-free.stack>.cms-el.w-beforeafter,.cms-free.stack>.cms-el.w-vector{aspect-ratio:var(--asp,auto);height:auto!important}
.cms-free.stack>.cms-el.w-button,.cms-free.stack>.cms-el.w-icon,.cms-free.stack>.cms-el.w-social{align-self:var(--ma,flex-start)}
.cms-free.stack>.cms-el.w-button{width:var(--mw,auto)!important;min-width:140px}.cms-free.stack>.cms-el.w-icon{width:64px!important}}
/* animation */
@keyframes cms-fade{from{opacity:0}}@keyframes cms-slide-up{from{opacity:0;translate:0 60px}}@keyframes cms-slide-down{from{opacity:0;translate:0 -60px}}@keyframes cms-slide-left{from{opacity:0;translate:80px 0}}@keyframes cms-slide-right{from{opacity:0;translate:-80px 0}}
@keyframes cms-zoom-in{from{opacity:0;scale:.6}}@keyframes cms-zoom-out{from{opacity:0;scale:1.35}}@keyframes cms-rotate{from{opacity:0;rotate:-25deg;scale:.8}}@keyframes cms-flip{from{opacity:0;transform:perspective(600px) rotateY(80deg)}}@keyframes cms-flip-x{from{opacity:0;transform:perspective(600px) rotateX(80deg)}}
@keyframes cms-bounce{0%{opacity:0;scale:.3}50%{opacity:1;scale:1.08}70%{scale:.95}100%{scale:1}}@keyframes cms-blur{from{opacity:0;filter:blur(18px)}}@keyframes cms-reveal{from{clip-path:inset(0 100% 0 0)}}@keyframes cms-reveal-up{from{clip-path:inset(100% 0 0 0)}}
@keyframes cms-drop{from{opacity:0;translate:0 -140px}60%{opacity:1;translate:0 12px}}@keyframes cms-swirl{from{opacity:0;rotate:-180deg;scale:.2}}@keyframes cms-typing{from{clip-path:inset(0 100% 0 0)}}
@keyframes cms-l-pulse{50%{scale:1.06}}@keyframes cms-l-float{50%{translate:0 -12px}}@keyframes cms-l-spin{to{rotate:360deg}}@keyframes cms-l-shake{20%,60%{translate:-6px 0}40%,80%{translate:6px 0}}@keyframes cms-l-bounce{50%{translate:0 -18px}}@keyframes cms-l-swing{25%{rotate:8deg}75%{rotate:-8deg}}@keyframes cms-l-blink{50%{opacity:.25}}@keyframes cms-l-heartbeat{14%,42%{scale:1.12}28%{scale:1}}@keyframes cms-l-wobble{25%{rotate:-4deg;translate:-6px 0}75%{rotate:4deg;translate:6px 0}}@keyframes cms-l-glow{50%{filter:drop-shadow(0 0 14px var(--glow,#c91c50))}}
@keyframes cms-c-pulse{50%{scale:.92}}@keyframes cms-c-shake{25%{translate:-5px 0}75%{translate:5px 0}}@keyframes cms-c-spin{to{rotate:360deg}}@keyframes cms-c-bounce{40%{translate:0 -14px}}
[data-ain]:not(.cms-av)>.cms-a,[data-cms-ain]:not(.cms-av){opacity:0}
.cms-av>.cms-a,[data-cms-ain].cms-av{animation:var(--an) var(--ad,800ms) var(--ae,cubic-bezier(.2,.7,.2,1)) var(--adl,0ms) var(--ar,1) var(--adir,normal) backwards}
.cms-loop{animation:var(--ln) var(--ld,2400ms) ease-in-out var(--ldl,0ms) infinite}
.cms-click{animation:var(--cn) 500ms ease}
.h-grow:hover{transform:scale(1.06)}.h-shrink:hover{transform:scale(.95)}.h-lift:hover{transform:translateY(-6px);box-shadow:0 18px 40px #0003}.h-glow:hover{box-shadow:0 0 0 4px var(--accent-soft,#fde),0 0 30px var(--glow,#c91c5088)}.h-tilt:hover{transform:perspective(600px) rotateX(6deg) rotateY(-8deg)}.h-rotate:hover{transform:rotate(6deg)}.h-pulse:hover{animation:cms-l-pulse .8s ease infinite}.h-shine{overflow:hidden}.h-shine::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,#fff6 50%,transparent 70%);translate:-120% 0;transition:translate .7s;pointer-events:none;z-index:2}.h-shine:hover::before{translate:120% 0}.h-darken:hover{filter:brightness(.8)}.h-blur-in{filter:blur(2px)}.h-blur-in:hover{filter:none}.h-color:hover{filter:none}.h-gray{filter:grayscale(1)}.h-gray:hover{filter:none}
@media(prefers-reduced-motion:reduce){[data-ain]>.cms-a,[data-cms-ain],.cms-loop,.cms-marq-in{animation:none!important;opacity:1!important}}
.cms-cursor{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483600;border-radius:50%;translate:-50% -50%;transition:width .2s,height .2s,background .2s;mix-blend-mode:difference}
/* v3.1: crop, disabled, popup, image sequence, mega menu, horizontal scroll */
.cms-crop{position:absolute;inset:0;overflow:hidden;border-radius:inherit;display:block}.cms-crop img{position:absolute;max-width:none;object-fit:fill;display:block;user-select:none}
.cms-crop.cms-imgc img{left:50%;top:50%;height:auto;border-radius:0;transform-origin:50% 50%}
.cms-el .cms-in.is-dis{opacity:.45;cursor:not-allowed;pointer-events:none;filter:grayscale(.4)}
.cms-el.pop-auto{display:none!important}html.cms-editing .cms-el.pop-auto{display:block!important}.cms-pop-chip{display:flex;align-items:center;justify-content:center;height:100%;border:2px dashed #8b5cf6;border-radius:10px;color:#6d28d9;background:#f5f3ff;font:600 13px/1.2 system-ui,sans-serif;padding:0 10px;text-align:center}
.cms-pop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .3s;font-family:inherit}.cms-pop.on{opacity:1}
.cms-pop-bg{position:absolute;inset:0;background:rgba(10,12,16,var(--dim,.55));backdrop-filter:blur(2px)}
.cms-pop-box{position:relative;background:#fff;color:#16181d;border-radius:20px;box-shadow:0 30px 80px #0005;width:min(var(--pw,520px),100%);max-height:calc(100vh - 32px);overflow:auto;transform:translateY(24px) scale(.97);transition:transform .35s cubic-bezier(.2,.8,.2,1)}.cms-pop.on .cms-pop-box{transform:none}
.cms-pop.sz-sm{--pw:400px}.cms-pop.sz-lg{--pw:820px}.cms-pop.sz-full .cms-pop-box{width:100%;height:100%;max-height:none;border-radius:0}.cms-pop.sz-full{padding:0}
.cms-pop.pos-bottom{align-items:flex-end;padding:0}.cms-pop.pos-bottom .cms-pop-box{width:100%;border-radius:20px 20px 0 0;transform:translateY(100%)}
.cms-pop.pos-right{justify-content:flex-end;align-items:flex-end}.cms-pop.pos-right .cms-pop-box{transform:translateX(110%)}.cms-pop.pos-left{justify-content:flex-start;align-items:flex-end}.cms-pop.pos-left .cms-pop-box{transform:translateX(-110%)}
.cms-pop.pos-right .cms-pop-bg,.cms-pop.pos-left .cms-pop-bg{background:transparent;backdrop-filter:none;pointer-events:none}.cms-pop.pos-right,.cms-pop.pos-left{pointer-events:none}.cms-pop.pos-right .cms-pop-box,.cms-pop.pos-left .cms-pop-box{pointer-events:auto}
.cms-pop.on.pos-bottom .cms-pop-box,.cms-pop.on.pos-right .cms-pop-box,.cms-pop.on.pos-left .cms-pop-box{transform:none}
.cms-pop-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:#0000000f;color:inherit;font-size:22px;line-height:1;cursor:pointer;z-index:2}.cms-pop-x:hover{background:#0000001f}
.cms-pop-img{width:100%;max-height:260px;object-fit:cover;display:block}.cms-pop-c{padding:clamp(22px,4vw,34px);display:grid;gap:12px}.cms-pop-c h2{margin:0;font-size:clamp(22px,3vw,30px);line-height:1.15;padding-right:28px}.cms-pop-t{opacity:.85;line-height:1.6}.cms-pop-t p{margin:0 0 .6em}.cms-pop .cms-ctas{margin-top:6px}
.cms-seq{width:100%;height:100%;position:relative;overflow:hidden;border-radius:inherit}.cms-seq img{width:100%;height:100%;object-fit:var(--seqfit,cover);display:block;user-select:none;pointer-events:none}.cms-seq[data-seq=drag]{cursor:grab}.cms-seq[data-seq=drag]:active{cursor:grabbing}
.cms-caret{display:inline-block;width:.42em;height:.42em;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-.2em);margin-left:.45em;opacity:.6}
.cms-menu.mega li.has-mega{position:static}.cms-menu.mega{position:relative}.cms-mega{display:none;position:absolute;left:0;right:0;top:100%;margin-top:8px;background:var(--bg,#fff);color:var(--ink,#16181d);box-shadow:0 24px 60px #0002;border-radius:16px;padding:22px;gap:22px;z-index:40;min-width:min(720px,90vw)}
.cms-menu li.has-mega:hover>.cms-mega,.cms-menu li.has-mega:focus-within>.cms-mega{display:flex}.cms-mega::before{content:"";position:absolute;left:0;right:0;top:-12px;height:12px}
.cms-mega>ul{list-style:none;margin:0;padding:0;display:grid!important;grid-template-columns:repeat(var(--mc,3),minmax(0,1fr));gap:6px 18px;flex:1;position:static!important;box-shadow:none!important;background:none!important;min-width:0!important}
.cms-mega a{display:grid;gap:2px;padding:10px 12px;border-radius:10px}.cms-mega a:hover{background:var(--bg-2,#f5f5f7);color:inherit}.cms-mega a b{font-weight:700}.cms-mega a small{font-weight:400;opacity:.65;font-size:.85em;line-height:1.35}
.cms-mega-side{width:220px;flex:none;display:grid;gap:10px;align-content:start}.cms-mega-side img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px}.cms-mega-side p{margin:0;font-size:.9em;opacity:.8}
.cms-k-hscroll{overflow:clip}.cms-k-hscroll .wrap{align-content:start}.cms-hs{overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;margin-inline:calc(-1 * var(--gut,20px))}.cms-hs::-webkit-scrollbar{display:none}
.cms-hs-track{display:flex;gap:clamp(16px,2vw,28px);padding-inline:var(--gut,20px);width:max-content;will-change:transform}
.cms-hs-card{flex:0 0 clamp(260px,32vw,440px);scroll-snap-align:start;background:var(--card,#fff);border:1px solid var(--line,#e5e7eb);border-radius:var(--r-lg,22px);overflow:hidden;display:flex;flex-direction:column}
.cms-hs-card img,.cms-hs-card .cms-img-empty{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;border-radius:0}.cms-hs-b{padding:22px;display:grid;gap:8px}.cms-hs-n{font-weight:800;color:var(--accent,#c91c50);font-size:14px;letter-spacing:.08em}.cms-hs-b h3{margin:0;font-size:22px}.cms-hs-b p{margin:0;color:var(--ink-2,#555);line-height:1.55}
.cms-hs.pin{position:sticky;top:0;height:100vh;height:100svh;display:flex;align-items:center;overflow:hidden;scroll-snap-type:none;width:100vw;margin-inline:calc(50% - 50vw)}.cms-hs.pin .cms-hs-track{padding-inline:max(var(--gut,20px),calc(50vw - 600px))}
@media(prefers-reduced-motion:reduce){.cms-pop,.cms-pop-box{transition:none}}`;

function ensureBlockCSS(doc) {
  let st = doc.getElementById('cms-block-css');
  if (st && st.dataset.v === '3') return;
  if (!st) { st = doc.createElement('style'); st.id = 'cms-block-css'; doc.head.append(st); }
  st.dataset.v = '3'; st.textContent = BLOCK_CSS;
}
function ensureFonts(doc, c) {
  const fams = new Set();
  const scan = s => { if (s && GOOGLE.includes(s.fontFamily)) fams.add(s.fontFamily); };
  for (const e of c.edits || []) { scan(e.style); scan(e.mobile); scan(e.hov); }
  for (const b of c.blocks || []) for (const k of ['style', 'mobile', 'titleStyle', 'bodyStyle', 'buttonStyle']) scan(b[k]);
  for (const s of c.sections || []) { scan(s.style); scan(s.mobile); }
  for (const el of c.els || []) { scan(el.style); scan(el.mob); scan(el.hov); }
  for (const f of fams) {
    const id = 'cms-font-' + f.replace(/\W/g, '');
    if (doc.getElementById(id)) continue;
    if (LOCAL_FONTS.includes(f)) continue; // already self-hosted by the site stylesheet
    // only fonts actually used on the page are loaded; the plain request always succeeds, the weighted one adds bold/light where the family has them
    for (const href of fontHrefs(f)) { const l = doc.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = href; doc.head.append(l); }
  }
}

/* ---------- apply / reset ---------- */
function remember(doc, el, attrsOnly) {
  if (el[ORIG]) { if (!attrsOnly && el[ORIG].html === undefined) el[ORIG].html = el.innerHTML; return el[ORIG]; }
  const o = { html: attrsOnly ? undefined : el.innerHTML, hidden: el.hidden, attrs: {} };
  for (const a of ['src', 'srcset', 'sizes', 'alt', 'href', 'target', 'rel', 'data-quote', 'data-tip', 'data-cms-ain', 'id', 'style']) o.attrs[a] = el.getAttribute(a);
  const pic = el.tagName === 'IMG' ? el.closest('picture') : null;
  if (pic) o.sources = [...pic.querySelectorAll('source')].map(s => s.cloneNode(true)), o.picture = pic;
  el[ORIG] = o;
  (doc.__cmsTouched ||= new Set()).add(el);
  return o;
}
export function reset(root) {
  const doc = root.ownerDocument;
  (doc.__cmsCleanup || []).forEach(f => { try { f(); } catch { } });
  doc.__cmsCleanup = [];
  root.querySelectorAll('.cms-free,.cms-bgl').forEach(el => el.remove());
  for (const el of doc.__cmsTouched || []) {
    const o = el[ORIG]; if (!o) continue;
    if (o.html !== undefined && el.innerHTML !== o.html && el.tagName !== 'IMG') el.innerHTML = o.html;
    el.hidden = o.hidden;
    for (const [a, v] of Object.entries(o.attrs)) v === null ? el.removeAttribute(a) : el.getAttribute(a) !== v && el.setAttribute(a, v);
    [...el.classList].filter(c => /^(cms-(sec|sticky|fullscreen|loop|click|av)|h-[a-z-]+)$/.test(c)).forEach(c => el.classList.remove(c));
    if (o.picture && o.sources && !o.picture.querySelector('source')) o.picture.prepend(...o.sources.map(s => s.cloneNode(true)));
    delete el.__cmsIn; delete el.__cmsScroll; delete el.__cmsMouse; delete el.__cmsClick;
    delete el[ORIG];
  }
  doc.__cmsTouched = new Set();
  root.querySelectorAll('.cms-added-section').forEach(el => el.remove());
  doc.getElementById('cms-pins')?.remove();
  doc.querySelector('.cms-cursor')?.remove();
  const parent = root.querySelector('.page-enter');
  if (parent && doc.__cmsOrder) for (const n of doc.__cmsOrder) if (n.parentNode === parent) parent.append(n);
  doc.getElementById('cms-responsive')?.remove();
}
function find(root, sel) {
  const doc = root.ownerDocument;
  try { return root.querySelector(sel.replace(/^#main\s*/, '')) || doc.querySelector(sel); } catch { return null; }
}
function textNode(el) {
  const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) if (n.nodeValue.trim()) return n;
  return null;
}
const ANIM_IN = ['fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'rotate', 'flip', 'flip-x', 'bounce', 'blur', 'reveal', 'reveal-up', 'drop', 'swirl', 'typing'];
const ANIM_LOOP = ['pulse', 'float', 'spin', 'shake', 'bounce', 'swing', 'blink', 'heartbeat', 'wobble', 'glow'];
const ANIM_HOVER = ['grow', 'shrink', 'lift', 'glow', 'tilt', 'rotate', 'pulse', 'shine', 'darken', 'blur-in', 'gray'];
const ANIM_CLICK = ['pulse', 'shake', 'spin', 'bounce'];
const EASE = { ease: 'ease', 'ease-in': 'ease-in', 'ease-out': 'ease-out', 'ease-in-out': 'ease-in-out', linear: 'linear', smooth: 'cubic-bezier(.2,.7,.2,1)', back: 'cubic-bezier(.34,1.56,.64,1)', elastic: 'cubic-bezier(.68,-.6,.32,1.6)' };
export const ANIMS = { in: ANIM_IN, loop: ANIM_LOOP, hover: ANIM_HOVER, click: ANIM_CLICK, ease: Object.keys(EASE), scroll: ['parallax', 'fade', 'scale', 'rotate', 'move-x', 'blur', 'scrub'] };
const isMob = win => win.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches;
// Applies entrance/loop/hover/click data to a target. host = element that gets the trigger class; inner = element for loop/hover.
function animSetup(host, anim, win, inner, carrier) {
  if (!anim) return;
  const mob = isMob(win);
  const a = mob && anim.mob === 'off' ? {} : mob && anim.mob === 'custom' && anim.m ? { ...anim, in: anim.m } : anim;
  const st = (carrier || host).style;
  if (a.in && ANIM_IN.includes(a.in.t)) {
    st.setProperty('--an', 'cms-' + a.in.t);
    if (num(a.in.d)) st.setProperty('--ad', num(a.in.d) + 'ms');
    if (num(a.in.dl)) st.setProperty('--adl', num(a.in.dl) + 'ms');
    if (EASE[a.in.e]) st.setProperty('--ae', EASE[a.in.e]);
    st.setProperty('--ar', a.in.rep === 0 ? 'infinite' : String(Math.max(1, Math.min(20, num(a.in.rep) || 1))));
    if (['normal', 'reverse', 'alternate'].includes(a.in.dir)) st.setProperty('--adir', a.in.dir);
    if (!carrier) host.setAttribute('data-cms-ain', a.in.t);
    host.__cmsIn = a.in;
  } else if (!carrier) host.removeAttribute('data-cms-ain');
  else host.removeAttribute('data-ain');
  if (a.loop && ANIM_LOOP.includes(a.loop.t)) {
    inner.classList.add('cms-loop'); inner.style.setProperty('--ln', 'cms-l-' + a.loop.t);
    if (num(a.loop.d)) inner.style.setProperty('--ld', num(a.loop.d) + 'ms');
    if (num(a.loop.dl)) inner.style.setProperty('--ldl', num(a.loop.dl) + 'ms');
  }
  if (a.hov && ANIM_HOVER.includes(a.hov.t)) { inner.classList.add('h-' + a.hov.t); if (num(a.hov.d)) inner.style.setProperty('--ht', num(a.hov.d) + 'ms'); }
  if (a.click && ANIM_CLICK.includes(a.click.t)) inner.__cmsClick = a.click.t;
  if (a.scroll && ANIMS.scroll.includes(a.scroll.t)) (carrier || host).__cmsScroll = { t: a.scroll.t, sp: num(a.scroll.sp) ?? 30, el: carrier || host };
  if (num(a.mouse)) (carrier || host).__cmsMouse = num(a.mouse);
}

export function apply(root, c, { seo = true, editing = false } = {}) {
  if (!root || !c) return;
  const doc = root.ownerDocument, win = doc.defaultView;
  reset(root);
  identify(root);
  ensureBlockCSS(doc); ensureFonts(doc, c);
  const parent = root.querySelector('.page-enter');
  if (parent && !doc.__cmsOrder) doc.__cmsOrder = [...parent.children].filter(n => !n.classList.contains('cms-added-section'));
  for (const b of c.blocks || []) parent?.insertAdjacentHTML('beforeend', blockHTML(b.kind ? b : { ...b, kind: 'text' }));
  const css = [], mob = [], tab = [];
  const TAB_MQ = `@media(min-width:${MOBILE_MAX + 1}px) and (max-width:${TABLET_MAX}px)`;
  const animTargets = [];
  for (const e of c.edits || []) {
    if (!e || typeof e.selector !== 'string') continue;
    const el = find(root, e.selector);
    const sel = boost(e.selector);
    if (sel) {
      // in the editor, hidden page elements stay visible as faded ghosts so they can be selected and shown again
      const hideR = editing ? `${sel}{opacity:.35!important;outline:1px dashed #94a3b8!important;outline-offset:2px!important}` : `${sel}{display:none!important}`;
      const vis = o => { if (!editing || !o || !o.hidden) return o; const { hidden, ...r } = o; return r; };
      const st = { ...(e.style || {}), ...(e.hidden ? { hidden: true } : {}) };
      const T = e.tf || {};
      if (el && (num(T.w) || num(T.h) || num(e.tfm?.w) || num(e.tfm?.h) || num(e.tft?.w) || num(e.tft?.h)) && win.getComputedStyle(el).display === 'inline') css.push(`${sel}{display:inline-block!important}`);
      css.push(rule(sel, vis(st))); if (editing && st.hidden) css.push(hideR);
      if (e.mobile) { mob.push(rule(sel, vis(e.mobile))); if (editing && e.mobile.hidden) mob.push(hideR); }
      if (e.tablet) { tab.push(rule(sel, vis(e.tablet))); if (editing && e.tablet.hidden) tab.push(hideR); }
      if (e.hideT) tab.push(hideR);
      if (e.hov) css.push(rule(sel + ':hover', e.hov));
      if (num(T.x) || num(T.y)) css.push(`${sel}{translate:${num(T.x) || 0}px ${num(T.y) || 0}px!important}`);
      if (num(T.r)) css.push(`${sel}{rotate:${num(T.r)}deg!important}`);
      const tx = tfExtra(T); if (tx.length) css.push(`${sel}{${tx.map(x => x + '!important').join(';')}}`);
      if (e.tft && typeof e.tft === 'object') tab.push(tfOverride(sel, T, e.tft));
      if (e.tfm && typeof e.tfm === 'object') mob.push(tfOverride(sel, T, e.tfm)); // phones inherit from desktop (like the style overrides)
      if (e.hideD) css.push(`@media(min-width:${TABLET_MAX + 1}px){${hideR}}`);
      if (e.hov) css.push(`${sel}{transition:all var(--ht,.3s) ease}`);
    }
    if (!el) continue;
    if (e.type === 'text' && typeof e.value === 'string') { remember(doc, el); el.textContent = e.value; el.removeAttribute('data-count'); }
    else if (e.type === 'html' && typeof e.value === 'string') { remember(doc, el); el.innerHTML = cleanHTML(e.value, doc); el.removeAttribute('data-count'); }
    else if (e.type === 'label' && typeof e.value === 'string') { remember(doc, el); const t = textNode(el); if (t) t.nodeValue = (/^\s/.test(t.nodeValue) ? ' ' : '') + e.value + (/\s$/.test(t.nodeValue) ? ' ' : ''); else el.prepend(e.value); }
    else if (e.type === 'image' && el.tagName === 'IMG' && safeUrl(e.value)) { remember(doc, el); el.removeAttribute('srcset'); el.removeAttribute('sizes'); el.closest('picture')?.querySelectorAll('source').forEach(s => s.remove()); el.src = safeUrl(e.value); }
    else if (e.type === 'video' && el.tagName === 'VIDEO' && safeUrl(e.value)) { remember(doc, el); el.querySelectorAll('source').forEach(x => x.remove()); el.src = safeUrl(e.value); if (e.poster && safeUrl(e.poster)) el.poster = safeUrl(e.poster); el.dataset.cmsReplaced = '1'; el.hidden = false; const par = el.parentElement; if (par?.classList.contains('fallback')) { par.classList.remove('fallback'); par.querySelector(':scope>img')?.remove(); } try { el.load(); } catch {} }
    if (e.alt !== undefined && el.tagName === 'IMG') { remember(doc, el); el.alt = e.alt; }
    if (e.tip) { remember(doc, el, true); el.setAttribute('data-tip', e.tip); }
    if (e.anchor && /^[\w-]{1,60}$/.test(e.anchor)) { remember(doc, el, true); el.id = e.anchor; }
    if (e.anim) { remember(doc, el, true); animTargets.push([el, e.anim]); }
    if (e.link !== undefined) {
      const a = el.closest('a') || (el.matches('button') ? el : null);
      if (a) {
        remember(doc, a, true);
        if (e.link === 'quote:') { a.setAttribute('data-quote', ''); if (a.tagName === 'A') a.setAttribute('href', '#'); }
        else if (a.tagName === 'A' && linkOK(e.link)) { a.removeAttribute('data-quote'); a.setAttribute('href', linkOK(e.link)); if (e.newTab) { a.target = '_blank'; a.rel = 'noopener'; } else a.removeAttribute('target'); }
      } else if (linkOK(e.link) || e.link === 'quote:') {
        // make a non-link element clickable
        remember(doc, el, true); el.style.cursor = 'pointer';
        const go = ev => { if (doc.documentElement.classList.contains('cms-editing')) return; if (e.link === 'quote:') { const b = doc.createElement('button'); b.setAttribute('data-quote', ''); b.hidden = true; doc.body.append(b); b.click(); b.remove(); return; } if (e.newTab) win.open(linkOK(e.link), '_blank', 'noopener'); else win.location.href = linkOK(e.link); };
        el.addEventListener('click', go); (doc.__cmsCleanup ||= []).push(() => el.removeEventListener('click', go));
      }
    }
  }
  // sections: original ones and added blocks share the same effects
  const secEntries = [...(c.sections || []).map(s => ({ ...s, _b: false })), ...(c.blocks || []).map(b => ({ id: b.id, style: b.style, mobile: b.mobile, tablet: b.tablet, fx: b.fx, anim: b.anim, _b: true }))];
  for (const s of secEntries) {
    const id = cleanId(s.id);
    const b = boost(`[data-cms-section="${id}"]`);
    if (!s._b) { css.push(rule(b, { ...(s.style || {}), ...(s.hidden ? { hidden: true } : {}) })); if (s.mobile) mob.push(rule(b, s.mobile)); if (s.tablet) tab.push(rule(b, s.tablet)); }
    const node = root.querySelector(`[data-cms-section="${id}"]`);
    const fx = s.fx || {};
    if (fx.hideD) css.push(`@media(min-width:${TABLET_MAX + 1}px){${b}{display:none!important}}`);
    if (fx.hideT) tab.push(`${b}{display:none!important}`);
    if (!node) continue;
    remember(doc, node, true);
    node.classList.add('cms-sec');
    if (fx.sticky) node.classList.add('cms-sticky');
    if (fx.full === 'screen') node.classList.add('cms-fullscreen');
    if (fx.anchor && /^[\w-]{1,60}$/.test(fx.anchor)) node.id = fx.anchor;
    const st = s.style || {};
    const ov = safeColor(st.overlay) || (st.overlayG && gradientCSS(st.overlayG));
    const vid = safeUrl(fx.video);
    const moving = ['parallax', 'zoom', 'fade-bg'].includes(fx.bg);
    if (ov || vid || (moving && (st.backgroundImage || st.gradient))) {
      const layer = doc.createElement('div'); layer.className = 'cms-bgl';
      if (vid) layer.innerHTML = `<video src="${esc(vid)}" autoplay muted loop playsinline preload="auto"${fx.poster && safeUrl(fx.poster) ? ` poster="${esc(safeUrl(fx.poster))}"` : ''}></video>`;
      else if (moving) { const bi = doc.createElement('div'); bi.className = 'cms-bgi'; bi.style.backgroundImage = [gradientCSS(st.gradient), st.backgroundImage && safeUrl(st.backgroundImage) ? `url("${safeUrl(st.backgroundImage)}")` : ''].filter(Boolean).join(','); layer.append(bi); css.push(`${b}{background-image:none!important}`); bi.__cmsScroll = { t: fx.bg === 'zoom' ? 'bg-zoom' : fx.bg === 'fade-bg' ? 'bg-fade' : 'bg-parallax', sp: num(fx.speed) ?? 40, el: bi }; animTargets.push([bi, null]); }
      if (ov) { const o = doc.createElement('div'); o.className = 'cms-ovl'; o.style.background = ov; if (num(st.overlayOp) !== null) o.style.opacity = String(num(st.overlayOp)); layer.append(o); }
      node.prepend(layer);
    }
    if (fx.bg === 'fixed') css.push(`${b}{background-attachment:fixed!important}`);
    if (s.anim) animTargets.push([node, s.anim]);
  }
  for (const bl of c.blocks || []) {
    const b = boost(`[data-cms-section="${cleanId(bl.id)}"]`);
    css.push(rule(b, bl.style)); if (bl.mobile) mob.push(rule(b, bl.mobile)); if (bl.tablet) tab.push(rule(b, bl.tablet));
    css.push(rule(b + ' .cms-b-title', bl.titleStyle), rule(b + ' .cms-b-body', bl.bodyStyle), rule(b + ' [data-cms-field^="button"]', bl.buttonStyle), rule(b + ' img', bl.imageStyle));
  }
  // free elements
  const els = (Array.isArray(c.els) ? c.els : []).filter(x => x && x.id && EL_KINDS.includes(x.kind));
  const bySec = {};
  for (const el of els) if (!el.parent || !els.some(p => p.id === el.parent)) (bySec[el.sec] ||= []).push(el);
  const layerFor = {};
  for (const [sid, list] of Object.entries(bySec)) {
    const node = root.querySelector(`[data-cms-section="${cleanId(sid)}"]`);
    if (!node) continue;
    node.classList.add('cms-sec');
    const layer = doc.createElement('div');
    const mabs = els.some(e => e.sec === sid && e.m && num(e.m.y) !== null);
    layer.className = 'cms-free' + (mabs ? ' mabs' : ' stack'); layer.dataset.free = sid;
    const ordered = [...list].sort((a, b) => mabs ? (a.z || 0) - (b.z || 0) : ((num(a.y) || 0) - (num(b.y) || 0)) || ((num(a.x) || 0) - (num(b.x) || 0)));
    layer.innerHTML = ordered.filter(e => !e.pin).map(e => elHTML(e, els)).join('');
    node.append(layer); layerFor[sid] = layer;
    if (!doc.__cmsTouched.has(node)) remember(doc, node, true);
  }
  const pinned = els.filter(e => e.pin);
  if (pinned.length) { const pins = doc.createElement('div'); pins.id = 'cms-pins'; pins.innerHTML = pinned.map(e => elHTML(e, els)).join(''); doc.body.append(pins); }
  for (const el of els) {
    const id = cleanId(el.id), s = `html body [data-el="${id}"]`;
    const x = num(el.x) ?? 10, y = num(el.y) ?? 40, w = num(el.w) ?? 30, h = num(el.h), r = num(el.r) || 0;
    const autoH = h === null || h === 0;
    const pos = [];
    if (el.pin) {
      const at = String(el.pin.at || 'br'), ox = num(el.pin.ox) ?? 20, oy = num(el.pin.oy) ?? 20, pw = num(el.pin.w) || Math.round(w / 100 * FREE_W);
      pos.push(`width:${pw}px`, autoH ? 'height:auto' : `height:${h}px`);
      if (at[0] === 't') pos.push(`top:${oy}px`); else if (at[0] === 'b') pos.push(`bottom:${oy}px`); else pos.push(`top:calc(50% - ${(h || 0) / 2}px + ${oy}px)`);
      if (at[1] === 'l') pos.push(`left:${ox}px`); else if (at[1] === 'r') pos.push(`right:${ox}px`); else pos.push(`left:calc(50% - ${pw / 2}px + ${ox}px)`);
      if (pw > 0) pos.push(`max-width:calc(100vw - ${2 * Math.abs(ox)}px)`);
    } else {
      pos.push(`left:${x}%`, `width:${w}%`, el.dock === 'b' && num(el.yb) !== null ? `bottom:${num(el.yb)}px` : `top:${y}px`, autoH ? 'height:auto' : `height:${h}px`);
    }
    if (r) pos.push(`transform:rotate(${r}deg)`);
    pos.push(`z-index:${Math.round(num(el.z) || 1)}`);
    if (!autoH && w && h) pos.push(`--asp:${(w / 100 * FREE_W / h).toFixed(3)}`);
    // a child of an auto-layout (flex/grid) box placed freely: absolute, beating the box's flow rule
    const par = el.parent ? els.find(p => p.id === el.parent) : null;
    if (el.free && par && par.kind === 'box' && P(par).flow) css.push(`html body .lay-flow>.cms-el[data-el="${id}"]{position:absolute!important;${pos.map(x => x + '!important').join(';')}}`);
    else css.push(`${s}{${pos.join(';')}}`);
    if (el.fx || el.fy) css.push(`${s}>.cms-a{transform:scale(${el.fx ? -1 : 1},${el.fy ? -1 : 1})}`);
    if (autoH) css.push(`${s},${s}>.cms-a,${s} .cms-in{height:auto!important}`);
    const inner = `${s}>.cms-a>.cms-in`;
    css.push(rule(inner, el.style, false));
    if (el.hov) css.push(rule(inner + ':hover', el.hov));
    if (el.act) css.push(rule(inner + ':active', el.act));
    if (el.dis) css.push(rule(inner + '.is-dis', el.dis));
    if (el.tab) tab.push(rule(inner, el.tab));
    if (el.mob) mob.push(rule(inner, el.mob));
    const fs = num(el.style?.fontSize);
    if (fs && fs > 16 && !num(el.mob?.fontSize) && !el.pin) mob.push(`${inner}{font-size:clamp(16px,${(fs / FREE_W * 160).toFixed(2)}vw,${fs}px)!important}`);
    if (el.kind === 'shape' && el.p?.shape?.startsWith('line')) { const st = el.style || {}; css.push(`${inner}{--lw:${num(st.borderWidth) || 2}px;--ls:${ENUM.borderStyle.includes(st.borderStyle) ? st.borderStyle : 'solid'};--lc:${safeColor(st.borderColor) || safeColor(st.backgroundColor) || 'currentColor'};border:0!important}`); }
    if (el.m) {
      const m = el.m, mp = [];
      const lm = layerFor[el.sec];
      // phone geometry: every element of a section with its own phone layout ("mabs"), and children of boxes positioned for phones (m.y set)
      if (!el.pin && ((lm && lm.classList.contains('mabs')) || (el.parent && num(m.y) !== null))) {
        if (num(m.x) !== null) mp.push(`left:${num(m.x)}%`); if (num(m.w) !== null) mp.push(`width:${num(m.w)}%`); if (num(m.y) !== null) mp.push(`top:${num(m.y)}px`, 'bottom:auto');
        if (num(m.h) !== null) mp.push(num(m.h) ? `height:${num(m.h)}px` : 'height:auto');
        mp.push(`transform:rotate(${num(m.r) || 0}deg)`);
      }
      if (m.align) mp.push(`--ma:${m.align === 'center' ? 'center' : m.align === 'end' ? 'flex-end' : m.align === 'stretch' ? 'stretch' : 'flex-start'}`);
      if (num(m.fw)) mp.push(`--mw:${num(m.fw)}%`);
      if (mp.length) mob.push(`${s}{${mp.map(x => x + '!important').join(';')}}`);
    }
    const node = doc.querySelector(`[data-el="${id}"]`);
    if (node) { node.classList.add('w-' + el.kind); if (autoH) node.classList.add('auto-h'); if (el.anim) animTargets.push([node, el.anim, node.querySelector(':scope>.cms-a>.cms-in'), node]); }
  }
  // mobile: free layers in "mabs" mode need a height
  if (parent && c.sectionOrder?.length) {
    const orig = [...parent.children], listed = new Set(c.sectionOrder);
    for (const id of c.sectionOrder) { const n = orig.find(el => el.dataset.cmsSection === id); if (n) parent.append(n); }
    // a section added by a later website update (not in the saved order) stays after the section it followed, instead of jumping to the top
    for (let i = 1; i < orig.length; i++) { const n = orig[i]; if (n.dataset.cmsSection && !listed.has(n.dataset.cmsSection) && orig[i - 1].parentNode === parent) orig[i - 1].after(n); }
  }
  const text = css.filter(Boolean).join('\n') + (tab.filter(Boolean).length ? `\n${TAB_MQ}{${tab.filter(Boolean).join('\n')}}` : '') + (mob.filter(Boolean).length ? `\n@media(max-width:${MOBILE_MAX}px){${mob.filter(Boolean).join('\n')}}` : '');
  if (text.trim()) { const st = doc.createElement('style'); st.id = 'cms-responsive'; st.textContent = text; doc.head.append(st); }
  if (seo && c.seo) {
    if (c.seo.title) doc.title = c.seo.title;
    const set = (q, v) => { if (v) doc.querySelector(q)?.setAttribute('content', v); };
    set('meta[name="description"]', c.seo.description);
    if (c.seo.noindex !== undefined) set('meta[name="robots"]', c.seo.noindex ? 'noindex,follow' : 'index,follow');
    for (const p of ['og:title', 'twitter:title']) set(`meta[property="${p}"],meta[name="${p}"]`, c.seo.title);
    for (const p of ['og:description', 'twitter:description']) set(`meta[property="${p}"],meta[name="${p}"]`, c.seo.description);
  }
  // behaviour
  for (const [host, anim, inner, carrier] of animTargets) {
    if (anim) animSetup(host, anim, win, inner || host, carrier ? host : null);
  }
  fitSections(root, layerFor);
  if (Array.isArray(c.catalog) && c.catalog.length && !editing) catalogOverlay(doc, c.catalog);
  init(root, { editing });
  engine(doc, animTargets.map(a => a[0]), { editing });
  if (c.page && c.page.cursor && !editing) cursor(doc, c.page.cursor);
}

// Product changes made in the admin catalog: rename, new photo or hide products in listings and on their own page.
function catalogOverlay(doc, list) {
  const here = doc.defaultView.location.pathname.replace(/\/$/, '').replace(/^\/satin\/(fa|fr|es)(?=\/|$)/, '/satin');
  const by = new Map(list.filter(x => x && typeof x.path === 'string').map(x => [x.path, x]));
  const swapText = (scope, was, now) => { if (!was || !now) return; const w = doc.createTreeWalker(scope, 4); let n; while ((n = w.nextNode())) if (n.nodeValue.trim() === was) n.nodeValue = n.nodeValue.replace(was, now); };
  const cur = by.get(here);
  if (cur && cur.name) { const h = doc.querySelector('#main h1'); if (h) swapText(h, cur.was, cur.name); doc.querySelectorAll('.crumbs [aria-current]').forEach(x => swapText(x, cur.was, cur.name)); }
  for (const a of doc.querySelectorAll('#main a[href]')) {
    let u; try { u = new URL(a.href, doc.baseURI); } catch { continue; }
    if (u.origin !== doc.defaultView.location.origin) continue;
    const x = by.get(u.pathname.replace(/\/$/, '').replace(/^\/satin\/(fa|fr|es)(?=\/|$)/, '/satin'));
    if (!x || x.path === here) continue;
    const card = a.closest('article,li,.card,[class*="card"],[class*="tile"]') || a;
    if (x.hidden) { card.hidden = true; card.style.display = 'none'; continue; }
    if (x.name) swapText(card, x.was, x.name);
    if (x.image && safeUrl(x.image)) { const im = card.querySelector('img'); if (im) { im.removeAttribute('srcset'); im.closest('picture')?.querySelectorAll('source').forEach(s => s.remove()); im.src = safeUrl(x.image); } }
  }
}

// Grow sections so absolutely positioned elements fit.
// Desktop: the free layer is a 1200px canvas, scaled down to fit narrower screens (like a print layout).
// Phones: elements stack (or use their own phone layout). Sections grow so every element fits.
export function fitSections(root, layers) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const run = () => {
    const mob = isMob(win);
    for (const layer of Object.values(layers || {})) {
      const sec = layer.parentElement; if (!sec) continue;
      sec.style.removeProperty('min-height');
      if (mob) { layer.style.removeProperty('transform'); layer.style.removeProperty('left'); layer.style.removeProperty('height'); layer.style.setProperty('--fw', '100%'); layer.style.setProperty('--fl', '0px'); layer.__z = 1; }
      else {
        const w = sec.clientWidth, z = Math.min(1, w / FREE_W);
        layer.__z = z;
        layer.style.left = ((w - FREE_W * z) / 2) + 'px';
        layer.style.transform = z < 1 ? `scale(${z})` : '';
        layer.style.height = (sec.clientHeight / z) + 'px';
        layer.style.setProperty('--fw', (w / z) + 'px'); layer.style.setProperty('--fl', (-(w - FREE_W * z) / 2 / z) + 'px');
      }
      if (mob && layer.classList.contains('stack')) continue;
      const z = layer.__z || 1;
      let need = 0;
      for (const k of layer.children) { if (k.classList.contains('hide-d') && !mob || k.classList.contains('hide-m') && mob) continue; const b = k.offsetTop + k.offsetHeight; if (b > need) need = b; }
      need = need * z + 24;
      if (need > sec.offsetHeight) { sec.style.setProperty('min-height', need + 'px', 'important'); if (!mob) layer.style.height = (sec.clientHeight / z) + 'px'; }
    }
  };
  run();
  win.requestAnimationFrame(run);
  const imgs = [...root.querySelectorAll('.cms-free img')].filter(i => !i.complete);
  imgs.forEach(i => i.addEventListener('load', run, { once: true }));
  if (doc.fonts?.ready) doc.fonts.ready.then(() => run());
  const onR = () => run(); win.addEventListener('resize', onR);
  (doc.__cmsCleanup ||= []).push(() => win.removeEventListener('resize', onR));
  doc.__cmsFit = run;
}

/* ---------- interactive widgets ---------- */
export function init(root, { editing } = {}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const cleanups = (doc.__cmsCleanup ||= []);
  const scope = [root, doc.getElementById('cms-pins')].filter(Boolean);
  const all = sel => scope.flatMap(r => [...r.querySelectorAll(sel)]);
  for (const sl of all('[data-slider]')) {
    const track = sl.querySelector('.cms-track'), slides = [...sl.querySelectorAll('.cms-slide')];
    if (!slides.length) continue;
    const fade = sl.classList.contains('m-fade'), grid = sl.classList.contains('m-grid');
    if (grid) continue;
    const per = () => fade ? 1 : Math.max(1, parseInt(getComputedStyle(sl).getPropertyValue('--per')) || 1) * (isMob(win) ? 0 : 1) || 1;
    let i = 0;
    const max = () => Math.max(0, slides.length - per());
    const dots = sl.querySelector('.cms-dots');
    const go = n => {
      i = n < 0 ? max() : n > max() ? 0 : n;
      if (fade) slides.forEach((s, k) => s.classList.toggle('on', k === i));
      else { const s = slides[i]; track.style.transform = `translateX(${-s.offsetLeft}px)`; }
      if (dots) [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    };
    if (dots) dots.innerHTML = slides.slice(0, max() + 1).map((_, k) => `<button type="button" aria-label="Slide ${k + 1}"></button>`).join('');
    dots?.addEventListener('click', e => { const b = e.target.closest('button'); if (b) go([...dots.children].indexOf(b)); });
    sl.querySelector('.cms-prev')?.addEventListener('click', () => go(i - 1));
    sl.querySelector('.cms-next')?.addEventListener('click', () => go(i + 1));
    let sx = null; sl.addEventListener('pointerdown', e => sx = e.clientX); sl.addEventListener('pointerup', e => { if (sx !== null && Math.abs(e.clientX - sx) > 40) go(i + (e.clientX < sx ? 1 : -1)); sx = null; });
    go(0);
    const auto = Number(sl.dataset.auto) || 0;
    if (auto && !editing) { const t = win.setInterval(() => { if (!sl.matches(':hover')) go(i + 1); }, Math.max(1500, auto * 1000)); cleanups.push(() => win.clearInterval(t)); }
    const onR = () => go(i); win.addEventListener('resize', onR); cleanups.push(() => win.removeEventListener('resize', onR));
  }
  for (const t of all('[data-tabs]')) t.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; t.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); t.querySelectorAll('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab); });
  for (const c of all('[data-countdown]')) {
    const to = Date.parse(c.dataset.countdown);
    const tick = () => { let d = Math.max(0, (isNaN(to) ? 0 : to) - Date.now()) / 1000; const v = { days: Math.floor(d / 86400), hours: Math.floor(d % 86400 / 3600), min: Math.floor(d % 3600 / 60), sec: Math.floor(d % 60) }; for (const [k, n] of Object.entries(v)) { const b = c.querySelector(`[data-u="${k}"]`); if (b) b.textContent = String(n).padStart(2, '0'); } if (d <= 0 && c.dataset.done) c.innerHTML = `<b style="font-size:1.4em">${esc(c.dataset.done)}</b>`; return d > 0; };
    if (tick()) { const t = win.setInterval(() => { if (!tick()) win.clearInterval(t); }, 1000); cleanups.push(() => win.clearInterval(t)); }
  }
  for (const ba of all('[data-ba]')) { const r = ba.querySelector('input'); r.addEventListener('input', () => ba.style.setProperty('--ba', r.value + '%')); }
  for (const m of all('[data-burger]')) m.addEventListener('click', () => m.closest('.cms-menu').classList.toggle('open'));
  for (const f of all('[data-cms-form]')) f.addEventListener('submit', e => submitForm(e, f, win));
  for (const v of all('video[data-scrub]')) v.closest('.cms-el') && (v.closest('.cms-el').__cmsScroll = { t: 'scrub', el: v });
  const lot = all('[data-lottie]');
  if (lot.length) loadLottie(win).then(L => { if (!L) return; for (const l of lot) { if (l.__lot) continue; l.__lot = L.loadAnimation({ container: l, renderer: 'svg', loop: l.dataset.loop !== '0', autoplay: true, path: l.dataset.lottie }); cleanups.push(() => l.__lot?.destroy()); } });

  // popups
  if (!editing) {
    const store = { get: k => { try { return win.localStorage.getItem(k); } catch { return null; } }, set: k => { try { win.localStorage.setItem(k, '1'); } catch { } } };
    const openAuto = (b, id) => { const k = 'cms-pop-' + id; const once = b.closest('.cms-el')?.querySelector('template[data-pop]')?.innerHTML.includes('data-once="1"'); if (once && store.get(k)) return; if (doc.querySelector('.cms-pop.on')) return; openPopup(doc, id); if (once) store.set(k); };
    for (const b of all('[data-pop-open]')) {
      const id = b.dataset.popOpen, tr = b.dataset.popAuto;
      b.addEventListener('click', () => openPopup(doc, id));
      if (tr === 'load') { const t = win.setTimeout(() => openAuto(b, id), (Number(b.dataset.delay) || 0) * 1000); cleanups.push(() => win.clearTimeout(t)); }
      else if (tr === 'scroll') { const on = () => { const h = doc.documentElement.scrollHeight - win.innerHeight; if (h > 0 && win.scrollY / h * 100 >= (Number(b.dataset.at) || 50)) { win.removeEventListener('scroll', on); openAuto(b, id); } }; win.addEventListener('scroll', on, { passive: true }); cleanups.push(() => win.removeEventListener('scroll', on)); }
      else if (tr === 'exit') { const on = e => { if (e.clientY <= 0 && !e.relatedTarget) { doc.removeEventListener('mouseout', on); openAuto(b, id); } }; doc.addEventListener('mouseout', on); cleanups.push(() => doc.removeEventListener('mouseout', on)); }
    }
    const onLink = e => { const a = e.target.closest?.('a[href^="#popup-"]'); if (!a) return; const id = a.getAttribute('href').slice(7); e.preventDefault(); e.stopPropagation(); openPopup(doc, id); };
    doc.addEventListener('click', onLink, true); cleanups.push(() => doc.removeEventListener('click', onLink, true));
  }
  // image sequences
  for (const sq of all('[data-seq]')) {
    let frames = []; try { frames = JSON.parse(sq.dataset.frames || '[]'); } catch { }
    const im = sq.querySelector('img'); if (!im || frames.length < 2) continue;
    const pre = frames.map(u => { const i = new win.Image(); i.decoding = 'async'; i.src = u; return i; });
    let cur = 0; const show = n => { n = Math.max(0, Math.min(frames.length - 1, Math.round(n))); if (n !== cur) { cur = n; im.src = pre[n].src; } };
    const mode = sq.dataset.seq;
    if (editing) continue;
    if (mode === 'auto') { let n = 0; const t = win.setInterval(() => { n++; if (n >= frames.length) { if (sq.dataset.loop === '0') { win.clearInterval(t); return; } n = 0; } show(n); }, 1000 / Math.max(1, Number(sq.dataset.fps) || 12)); cleanups.push(() => win.clearInterval(t)); }
    else if (mode === 'hover') sq.addEventListener('pointermove', e => { const r = sq.getBoundingClientRect(); show((e.clientX - r.left) / r.width * (frames.length - 1)); });
    else if (mode === 'drag') { let sx = null, s0 = 0; sq.addEventListener('pointerdown', e => { sx = e.clientX; s0 = cur; sq.setPointerCapture(e.pointerId); }); sq.addEventListener('pointermove', e => { if (sx === null) return; const r = sq.getBoundingClientRect(); const n = s0 - Math.round((e.clientX - sx) / r.width * frames.length); show(((n % frames.length) + frames.length) % frames.length); }); sq.addEventListener('pointerup', () => sx = null); }
    else { const dist = Math.max(0.3, (Number(sq.dataset.dist) || 100) / 100); const on = () => { const r = sq.getBoundingClientRect(), vh = win.innerHeight; const p = Math.max(0, Math.min(1, (vh - r.top) / (vh * dist + r.height * 0.5))); show(p * (frames.length - 1)); }; win.addEventListener('scroll', on, { passive: true }); cleanups.push(() => win.removeEventListener('scroll', on)); on(); }
  }
  // horizontal scroll sections (desktop & tablet: pinned while the cards slide; phones: swipe)
  for (const hs of all('[data-hs]')) {
    const track = hs.querySelector('.cms-hs-track'), wrap = hs.parentElement; if (!track || editing) continue;
    let dist = 0, headH = 0;
    const layout = () => { const big = win.innerWidth > MOBILE_MAX && !win.matchMedia('(prefers-reduced-motion: reduce)').matches; hs.classList.toggle('pin', big); track.style.transform = ''; wrap.style.height = ''; if (!big) { dist = 0; return; } dist = Math.max(0, track.scrollWidth - hs.clientWidth); headH = hs.offsetTop - wrap.offsetTop; wrap.style.height = (headH + win.innerHeight + dist) + 'px'; on(); };
    const on = () => { if (!dist) return; const top = wrap.getBoundingClientRect().top + headH; const p = Math.max(0, Math.min(1, -top / dist)); track.style.transform = `translateX(${(-p * dist).toFixed(1)}px)`; };
    win.addEventListener('scroll', on, { passive: true }); win.addEventListener('resize', layout);
    cleanups.push(() => { win.removeEventListener('scroll', on); win.removeEventListener('resize', layout); hs.classList.remove('pin'); wrap.style.height = ''; track.style.transform = ''; });
    layout(); win.setTimeout(layout, 600);
  }
  for (const el of all('.cms-in')) if (el.__cmsClick) el.addEventListener('click', () => { el.classList.remove('cms-click'); void el.offsetWidth; el.style.setProperty('--cn', 'cms-c-' + el.__cmsClick); el.classList.add('cms-click'); });
}
let lottieP = null;
function loadLottie(win) {
  if (win.lottie) return Promise.resolve(win.lottie);
  if (lottieP) return lottieP;
  lottieP = new Promise(res => { const s = win.document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js'; s.onload = () => res(win.lottie); s.onerror = () => res(null); win.document.head.append(s); });
  return lottieP;
}
async function submitForm(e, f, win) {
  e.preventDefault();
  const msg = f.querySelector('.cms-form-msg'); msg.className = 'cms-form-msg'; msg.textContent = '';
  if (win.document.documentElement.classList.contains('cms-editing')) return;
  if (!f.checkValidity()) { f.reportValidity(); return; }
  const d = new FormData(f), details = {}, notes = [];
  let i = 0;
  for (const lab of f.querySelectorAll('.cms-f')) {
    const inp = lab.querySelector('[name^="f"]'); if (!inp) continue;
    const label = (lab.querySelector('span')?.textContent || lab.textContent || '').replace(/\s*\*$/, '').trim().slice(0, 60);
    const val = inp.type === 'checkbox' ? (inp.checked ? 'yes' : 'no') : inp.value;
    details['field_' + (i++)] = (label + ': ' + val).slice(0, 1000); notes.push(label + ': ' + val);
  }
  const btn = f.querySelector('[type=submit]'); btn.disabled = true;
  try {
    const r = await win.fetch('/api/quote-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: win.crypto.randomUUID(), name: d.get('_name'), email: d.get('_email'), phone: d.get('_phone'), service: (f.dataset.cmsForm || 'Website form').slice(0, 120), notes: notes.join('\n').slice(0, 2000), details, consent: !!d.get('_consent'), website: d.get('website') || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not send. Please try again.');
    msg.className = 'cms-form-msg ok'; msg.textContent = f.dataset.ok + (j.reference ? ` (Ref. ${j.reference})` : ''); f.reset();
  } catch (er) { msg.className = 'cms-form-msg err'; msg.textContent = er.message; }
  btn.disabled = false;
}

/* ---------- animation engine: entrance on view, scroll effects, counters ---------- */
function engine(doc, targets, { editing }) {
  const win = doc.defaultView;
  const cleanups = (doc.__cmsCleanup ||= []);
  const reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ins = [...doc.querySelectorAll('[data-ain],[data-cms-ain]')];
  const show = el => { el.classList.add('cms-av'); };
  if (editing || reduce || !('IntersectionObserver' in win)) ins.forEach(show);
  else {
    const io = new win.IntersectionObserver(es => { for (const en of es) { const el = en.target; const a = el.__cmsIn || {}; if (en.isIntersecting) { if (a.tr === 'click') continue; show(el); if (!a.out) io.unobserve(el); } else if (a.out) el.classList.remove('cms-av'); } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (const el of ins) { const a = el.__cmsIn || {}; if (a.tr === 'load') show(el); else if (a.tr === 'click') el.addEventListener('click', () => { el.classList.remove('cms-av'); void el.offsetWidth; show(el); }); else io.observe(el); }
    cleanups.push(() => io.disconnect());
  }
  // counters & progress bars animate when visible
  const counters = [...doc.querySelectorAll('[data-counter]')], bars = [...doc.querySelectorAll('[data-prog]')];
  if ((counters.length || bars.length) && 'IntersectionObserver' in win && !reduce) {
    bars.forEach(b => b.style.width = '0%');
    const io2 = new win.IntersectionObserver(es => { for (const en of es) { if (!en.isIntersecting) continue; io2.unobserve(en.target); const t = en.target; if (t.dataset.prog) { t.style.width = t.dataset.prog + '%'; continue; } const to = Number(t.dataset.counter) || 0, dur = Number(t.dataset.dur) || 1600, txt = t.textContent, pre = txt.split(String(to))[0] || '', suf = txt.split(String(to)).slice(1).join(String(to)), t0 = win.performance.now(), dec = (String(to).split('.')[1] || '').length; const step = n => { const p = Math.min(1, (n - t0) / dur), e = 1 - Math.pow(1 - p, 3); t.textContent = pre + (to * e).toFixed(dec) + suf; if (p < 1) win.requestAnimationFrame(step); }; win.requestAnimationFrame(step); } }, { threshold: 0.3 });
    [...counters, ...bars].forEach(x => io2.observe(x)); cleanups.push(() => io2.disconnect());
  }
  // scroll & mouse effects
  const scrollers = targets.filter(t => t && t.__cmsScroll).map(t => t.__cmsScroll);
  doc.querySelectorAll('.cms-el').forEach(n => { if (n.__cmsScroll && !scrollers.includes(n.__cmsScroll)) scrollers.push(n.__cmsScroll); });
  const mice = targets.filter(t => t && t.__cmsMouse);
  if (reduce || (!scrollers.length && !mice.length)) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const vh = win.innerHeight;
    for (const s of scrollers) {
      const box = (s.t.startsWith('bg-') ? s.el.parentElement.parentElement : s.el).getBoundingClientRect();
      const p = Math.max(-1, Math.min(1, ((box.top + box.height / 2) - vh / 2) / (vh / 2 + box.height / 2))); // -1 (above) … 1 (below)
      const k = (s.sp ?? 30) / 100;
      const vis = 1 - Math.abs(p);
      switch (s.t) {
        case 'parallax': case 'bg-parallax': s.el.style.translate = `0 ${(p * k * (s.t === 'bg-parallax' ? 0.5 : 1) * vh * 0.4).toFixed(1)}px`; break;
        case 'bg-zoom': s.el.style.scale = String(1 + Math.max(0, 1 - vis) * k); break;
        case 'bg-fade': s.el.style.opacity = String(Math.max(0, Math.min(1, vis * 1.6))); break;
        case 'fade': s.el.style.opacity = String(Math.max(0, Math.min(1, vis * 1.8))); break;
        case 'scale': s.el.style.scale = String(Math.max(0.2, 1 - (1 - vis) * k)); break;
        case 'rotate': s.el.style.rotate = `${(p * k * 180).toFixed(1)}deg`; break;
        case 'move-x': s.el.style.translate = `${(p * k * 400).toFixed(1)}px 0`; break;
        case 'blur': s.el.style.filter = `blur(${((1 - vis) * k * 30).toFixed(1)}px)`; break;
        case 'scrub': { const v = s.el.tagName === 'VIDEO' ? s.el : s.el.querySelector('video'); if (v && v.duration) { v.pause(); v.currentTime = Math.max(0, Math.min(v.duration - 0.05, (1 - (p + 1) / 2) * v.duration)); } break; }
      }
    }
  };
  const onScroll = () => { if (!raf) raf = win.requestAnimationFrame(update); };
  win.addEventListener('scroll', onScroll, { passive: true }); win.addEventListener('resize', onScroll);
  cleanups.push(() => { win.removeEventListener('scroll', onScroll); win.removeEventListener('resize', onScroll); });
  update();
  if (mice.length && !editing) {
    const onMove = e => { const cx = e.clientX / win.innerWidth - 0.5, cy = e.clientY / win.innerHeight - 0.5; for (const m of mice) (m.querySelector(':scope>.cms-a') || m).style.setProperty('translate', `${(cx * m.__cmsMouse).toFixed(1)}px ${(cy * m.__cmsMouse).toFixed(1)}px`); };
    win.addEventListener('mousemove', onMove); cleanups.push(() => win.removeEventListener('mousemove', onMove));
  }
}
function cursor(doc, type) {
  const win = doc.defaultView;
  if (!win.matchMedia('(pointer:fine)').matches || !['dot', 'ring', 'blob'].includes(type)) return;
  const c = doc.createElement('div'); c.className = 'cms-cursor';
  Object.assign(c.style, type === 'dot' ? { width: '12px', height: '12px', background: '#fff' } : type === 'ring' ? { width: '34px', height: '34px', border: '2px solid #fff' } : { width: '46px', height: '46px', background: '#fff' });
  doc.body.append(c);
  const mv = e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; };
  const ov = e => { const big = e.target.closest?.('a,button'); c.style.scale = big ? '1.8' : '1'; };
  win.addEventListener('mousemove', mv); doc.addEventListener('mouseover', ov);
  (doc.__cmsCleanup ||= []).push(() => { win.removeEventListener('mousemove', mv); doc.removeEventListener('mouseover', ov); c.remove(); });
}
