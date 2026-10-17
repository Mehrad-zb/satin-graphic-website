/* Satin editor — catalogue of sections and elements that can be added. */
import { S, uid, RT } from './core.js?v=8';

/* ---------- sections (blocks) ---------- */
export const BLOCKS = [
  { cat: 'Basic', kind: 'blank', name: 'Blank section', desc: 'Empty canvas for your own design' },
  { cat: 'Text', kind: 'text', name: 'Heading & text', desc: 'Title, paragraph and buttons' },
  { cat: 'Text', kind: 'cta', name: 'Call to action', desc: 'Dark banner with buttons' },
  { cat: 'Text', kind: 'faq', name: 'FAQ', desc: 'Questions that open' },
  { cat: 'Text', kind: 'testimonial', name: 'Testimonial', desc: 'Customer quote' },
  { cat: 'Media', kind: 'text-image', name: 'Text + image', desc: 'Two columns' },
  { cat: 'Media', kind: 'image-text', name: 'Image + text', desc: 'Image on the left' },
  { cat: 'Media', kind: 'image', name: 'Image', desc: 'Large picture' },
  { cat: 'Media', kind: 'gallery', name: 'Gallery', desc: 'Grid of photos' },
  { cat: 'Media', kind: 'video', name: 'Video', desc: 'YouTube or Vimeo' },
  { cat: 'Media', kind: 'logos', name: 'Logos', desc: 'Brand logo strip' },
  { cat: 'Layout', kind: 'cards', name: 'Cards', desc: '3 columns with images' },
  { cat: 'Layout', kind: 'stats', name: 'Numbers', desc: 'Big stats row' },
  { cat: 'Layout', kind: 'hscroll', name: 'Horizontal scroll', desc: 'Panels slide sideways as you scroll' },
  { cat: 'Layout', kind: 'contact', name: 'Contact', desc: 'Phone, email, quote' },
  { cat: 'Layout', kind: 'button', name: 'Button', desc: 'One centred button' },
  { cat: 'Layout', kind: 'spacer', name: 'Spacer', desc: 'Empty space' },
  { cat: 'Layout', kind: 'divider', name: 'Divider', desc: 'Thin line' }
];
export const KIND_NAME = Object.fromEntries(BLOCKS.map(b => [b.kind, b.name]));
export function preset(kind) {
  const im = i => S.siteImages[i % Math.max(1, S.siteImages.length)]?.url || '';
  const base = { id: uid('b'), kind, layout: 'center' };
  const P = {
    blank: { style: { minHeight: 520 } },
    text: { eyebrow: 'New section', title: 'Add a heading here', body: 'Tell your visitors about this service. Double-click any text on the page to edit it.', button: 'Start a quote', link: 'quote:' },
    cta: { title: 'Ready to start your project?', body: 'Get a free quote within one business day.', button: 'Get a quote', link: 'quote:', button2: 'Call us', link2: 'tel:+19059626222' },
    faq: { title: 'Frequently asked questions', items: [{ title: 'How long does a wrap take?', body: 'Most vehicles are done in 2–4 days.' }, { title: 'Do you offer design?', body: 'Yes, our in-house designers can create your artwork.' }, { title: 'Is there a warranty?', body: 'All installs include a workmanship warranty.' }] },
    testimonial: { body: 'Satin did an amazing job on our fleet. Fast, professional and the result looks incredible.', name: 'Happy customer', role: 'Google review' },
    'text-image': { layout: 'left', eyebrow: 'Why Satin', title: 'Designed, printed and installed in-house', body: 'One team takes care of your project from start to finish.', button: 'Learn more', link: '/satin/about', image: im(0), alt: '' },
    'image-text': { layout: 'left', eyebrow: 'Our work', title: 'Quality you can see', body: 'Premium films and inks, installed by certified installers.', button: 'See our work', link: '/satin/portfolio', image: im(1), alt: '' },
    image: { image: im(2), alt: '', caption: '' },
    gallery: { title: 'Recent projects', items: [0, 1, 2, 3, 4, 5].map(i => ({ image: im(i + 3), title: '' })) },
    video: { title: 'Watch the process', video: '' },
    logos: { title: 'Brands we work with', items: [0, 1, 2, 3, 4].map(i => ({ image: im(i + 9), title: '' })) },
    cards: { title: 'Our services', items: [['Vehicle wraps', '/satin/vehicle-wraps'], ['Print shop', '/satin/print-shop'], ['Apparel', '/satin/apparel']].map(([t, l], i) => ({ title: t, body: 'Short description of this service.', image: im(i + 6), link: l })) },
    hscroll: { title: 'How a wrap comes together', items: [['Design', 'We mock up your vehicle in 3D.'], ['Print', 'Premium cast vinyl, printed in-house.'], ['Laminate', 'UV and scratch protection.'], ['Install', 'Certified installers, climate-controlled bay.'], ['Deliver', 'Ready to turn heads.']].map(([t, b], i) => ({ title: t, body: b, image: im(i + 3) })) },
    stats: { items: [['9,700+', 'Projects completed'], ['11', 'Years of experience'], ['5.0', 'Google rating']].map(([t, b]) => ({ title: t, body: b })) },
    contact: { layout: 'left', title: 'Talk to our team', body: 'Visit our shop in Vaughan or send us a message.', button: 'Start a quote', link: 'quote:', items: [{ title: 'Phone', body: '(905) 962-6222', link: 'tel:+19059626222' }, { title: 'Email', body: 'info@satingraphic.ca', link: 'mailto:info@satingraphic.ca' }] },
    button: { button: 'Get a free quote', link: 'quote:' },
    spacer: { height: 60 },
    divider: {}
  };
  return { ...base, ...(P[kind] || {}) };
}
export const TILE_SVG = {
  hscroll: '<rect x="4" y="12" width="40" height="38" rx="4" fill="#cbd5e1"/><rect x="48" y="12" width="40" height="38" rx="4" fill="#e5e7eb"/><rect x="92" y="12" width="20" height="38" rx="4" fill="#f3f4f6"/><path d="M30 58h40M62 54l8 4-8 4" stroke="#c91c50" stroke-width="2" fill="none"/>',
  blank: '<rect x="8" y="8" width="84" height="46" rx="4" fill="none" stroke="#9ca3af" stroke-dasharray="4 3"/><path d="M50 22v18M41 31h18" stroke="#9ca3af" stroke-width="2"/>',
  text: '<rect x="20" y="14" width="60" height="6" rx="2" fill="#16181d"/><rect x="14" y="26" width="72" height="3" rx="1.5" fill="#9ca3af"/><rect x="22" y="32" width="56" height="3" rx="1.5" fill="#9ca3af"/><rect x="36" y="42" width="28" height="8" rx="4" fill="#c91c50"/>',
  cta: '<rect x="6" y="8" width="88" height="46" rx="6" fill="#16181d"/><rect x="24" y="18" width="52" height="5" rx="2" fill="#fff"/><rect x="30" y="36" width="18" height="8" rx="4" fill="#c91c50"/><rect x="52" y="36" width="18" height="8" rx="4" fill="none" stroke="#fff"/>',
  faq: '<rect x="12" y="10" width="76" height="11" rx="3" fill="#fff" stroke="#d1d5db"/><rect x="12" y="25" width="76" height="11" rx="3" fill="#fff" stroke="#d1d5db"/><rect x="12" y="40" width="76" height="11" rx="3" fill="#fff" stroke="#d1d5db"/>',
  testimonial: '<text x="50" y="22" text-anchor="middle" font-size="10" fill="#f5a623">★★★★★</text><rect x="16" y="28" width="68" height="3" rx="1.5" fill="#9ca3af"/><rect x="22" y="34" width="56" height="3" rx="1.5" fill="#9ca3af"/><circle cx="40" cy="47" r="4" fill="#d1d5db"/><rect x="47" y="45" width="18" height="4" rx="2" fill="#16181d"/>',
  'text-image': '<rect x="8" y="16" width="36" height="5" rx="2" fill="#16181d"/><rect x="8" y="26" width="38" height="3" rx="1.5" fill="#9ca3af"/><rect x="8" y="32" width="30" height="3" rx="1.5" fill="#9ca3af"/><rect x="54" y="10" width="38" height="42" rx="4" fill="#cbd5e1"/>',
  'image-text': '<rect x="8" y="10" width="38" height="42" rx="4" fill="#cbd5e1"/><rect x="56" y="16" width="36" height="5" rx="2" fill="#16181d"/><rect x="56" y="26" width="36" height="3" rx="1.5" fill="#9ca3af"/><rect x="56" y="32" width="28" height="3" rx="1.5" fill="#9ca3af"/>',
  image: '<rect x="10" y="8" width="80" height="46" rx="5" fill="#cbd5e1"/><path d="M10 46l22-18 18 14 12-9 28 21v0H10z" fill="#94a3b8"/>',
  gallery: '<g fill="#cbd5e1"><rect x="8" y="8" width="26" height="21" rx="3"/><rect x="37" y="8" width="26" height="21" rx="3"/><rect x="66" y="8" width="26" height="21" rx="3"/><rect x="8" y="33" width="26" height="21" rx="3"/><rect x="37" y="33" width="26" height="21" rx="3"/><rect x="66" y="33" width="26" height="21" rx="3"/></g>',
  video: '<rect x="12" y="8" width="76" height="46" rx="5" fill="#16181d"/><path d="M44 22l14 9-14 9z" fill="#fff"/>',
  logos: '<g fill="#9ca3af"><rect x="6" y="26" width="16" height="10" rx="2"/><rect x="26" y="26" width="16" height="10" rx="2"/><rect x="46" y="26" width="16" height="10" rx="2"/><rect x="66" y="26" width="16" height="10" rx="2"/><rect x="86" y="26" width="10" height="10" rx="2"/></g>',
  cards: '<g><rect x="6" y="10" width="26" height="42" rx="4" fill="#fff" stroke="#d1d5db"/><rect x="37" y="10" width="26" height="42" rx="4" fill="#fff" stroke="#d1d5db"/><rect x="68" y="10" width="26" height="42" rx="4" fill="#fff" stroke="#d1d5db"/><rect x="6" y="10" width="26" height="16" rx="4" fill="#cbd5e1"/><rect x="37" y="10" width="26" height="16" rx="4" fill="#cbd5e1"/><rect x="68" y="10" width="26" height="16" rx="4" fill="#cbd5e1"/></g>',
  stats: '<g fill="#16181d" font-size="13" font-weight="800" text-anchor="middle"><text x="20" y="34">98</text><text x="50" y="34">11</text><text x="80" y="34">5.0</text></g><g fill="#9ca3af"><rect x="10" y="40" width="20" height="3" rx="1.5"/><rect x="40" y="40" width="20" height="3" rx="1.5"/><rect x="70" y="40" width="20" height="3" rx="1.5"/></g>',
  contact: '<rect x="8" y="16" width="34" height="5" rx="2" fill="#16181d"/><rect x="8" y="26" width="34" height="3" rx="1.5" fill="#9ca3af"/><rect x="8" y="36" width="20" height="8" rx="4" fill="#c91c50"/><rect x="54" y="12" width="38" height="16" rx="3" fill="#fff" stroke="#d1d5db"/><rect x="54" y="33" width="38" height="16" rx="3" fill="#fff" stroke="#d1d5db"/>',
  button: '<rect x="30" y="24" width="40" height="14" rx="7" fill="#c91c50"/>',
  spacer: '<path d="M50 12v38M44 18l6-6 6 6M44 44l6 6 6-6" stroke="#9ca3af" stroke-width="2" fill="none"/>',
  divider: '<path d="M10 31h80" stroke="#9ca3af" stroke-width="2"/>'
};

/* ---------- free elements ---------- */
export const EL_NAME = { text: 'Text', button: 'Button', image: 'Image', shape: 'Shape', vector: 'Vector', box: 'Box', video: 'Video', audio: 'Audio', embed: 'Embed', map: 'Map', social: 'Social bar', icon: 'Icon', menu: 'Menu', form: 'Form', slider: 'Slider', accordion: 'Accordion', tabs: 'Tabs', countdown: 'Countdown', progress: 'Progress bar', beforeafter: 'Before / after', marquee: 'Marquee', lottie: 'Lottie', repeater: 'Repeater', counter: 'Counter', popup: 'Popup', imgseq: 'Image sequence' };
const im = i => S.siteImages[i % Math.max(1, S.siteImages.length)]?.url || '';
const txt = (html, tag, size, extra = {}) => ({ kind: 'text', w: extra.w || 560, h: 0, p: { tag, html }, style: { fontSize: size, ...(extra.style || {}) } });
const btn = (label, style = {}, extra = {}) => ({ kind: 'button', w: 200, h: 52, p: { label, ...(extra.p || {}) }, link: extra.link ?? 'quote:', style, hov: extra.hov || { opacity: 0.88 }, ...(extra.more || {}) });
export const ELEMENTS = [
  // text
  { cat: 'Text', key: 'h1', name: 'Big title', tile: '<b style="font-size:20px">Aa</b>', make: () => txt('Big bold title', 'h1', 64, { w: 760, style: { fontWeight: 900, lineHeight: 1.05, letterSpacing: -1 } }) },
  { cat: 'Text', key: 'h2', name: 'Heading', tile: '<b style="font-size:16px">Heading</b>', make: () => txt('Section heading', 'h2', 40, { w: 640, style: { fontWeight: 800, lineHeight: 1.1 } }) },
  { cat: 'Text', key: 'h3', name: 'Subheading', tile: '<b style="font-size:13px">Subheading</b>', make: () => txt('A short subheading', 'h3', 24, { w: 480, style: { fontWeight: 700 } }) },
  { cat: 'Text', key: 'p', name: 'Paragraph', tile: '<span style="font-size:10px;line-height:1.2">Lorem ipsum dolor sit amet…</span>', make: () => txt('Write your text here. Double-click to edit, select words to make them <b>bold</b>, <i>italic</i> or a link.', 'p', 18, { style: { lineHeight: 1.6 } }) },
  { cat: 'Text', key: 'small', name: 'Small title', tile: '<span style="font-size:9px;letter-spacing:2px;font-weight:700">EYEBROW</span>', make: () => txt('SMALL TITLE', 'div', 13, { w: 300, style: { fontWeight: 800, letterSpacing: 3, color: '#c91c50' } }) },
  { cat: 'Text', key: 'list', name: 'Bullet list', tile: '<span style="font-size:10px;text-align:left">• One<br>• Two<br>• Three</span>', make: () => txt('<ul><li>First point</li><li>Second point</li><li>Third point</li></ul>', 'div', 18, { w: 420, style: { lineHeight: 1.7 } }) },
  { cat: 'Text', key: 'gradtext', name: 'Gradient text', tile: '<b style="font-size:16px;background:linear-gradient(90deg,#c91c50,#6d28d9);-webkit-background-clip:text;color:transparent">Wow</b>', make: () => txt('Gradient headline', 'h2', 56, { w: 700, style: { fontWeight: 900, textFill: 'gradient', gradient: { t: 'linear', a: 90, s: [{ c: '#c91c50', p: 0 }, { c: '#6d28d9', p: 100 }] } } }) },
  { cat: 'Text', key: 'outline', name: 'Outline text', tile: '<b style="font-size:18px;color:transparent;-webkit-text-stroke:1px #111">OUT</b>', make: () => txt('OUTLINE', 'h2', 80, { w: 600, style: { fontWeight: 900, color: 'transparent', strokeW: 2, strokeColor: '#16181d' } }) },
  { cat: 'Text', key: 'vtext', name: 'Vertical text', tile: '<b style="writing-mode:vertical-rl;font-size:10px">VERTICAL</b>', make: () => ({ ...txt('VERTICAL', 'div', 22, { w: 50, style: { fontWeight: 800, writing: 'vertical', letterSpacing: 4 } }) }) },
  { cat: 'Text', key: 'marquee', name: 'Scrolling text', tile: '<span style="font-size:10px;white-space:nowrap">→ Marquee text →</span>', make: () => ({ kind: 'marquee', w: 1200, h: 70, full: true, p: { text: 'VEHICLE WRAPS • PRINT • SIGNS • APPAREL •', speed: 24 }, style: { fontSize: 34, fontWeight: 900, backgroundColor: '#16181d', color: '#ffffff' } }) },
  // buttons
  { cat: 'Buttons', key: 'btn', name: 'Button', tile: '<span class="tb">Button</span>', make: () => btn('Get a quote', {}) },
  { cat: 'Buttons', key: 'btn-accent', name: 'Accent button', tile: '<span class="tb a">Button</span>', make: () => btn('Get a free quote', { backgroundColor: '#c91c50', color: '#ffffff' }, { hov: { backgroundColor: '#a3123f' } }) },
  { cat: 'Buttons', key: 'btn-outline', name: 'Outline button', tile: '<span class="tb o">Button</span>', make: () => btn('Learn more', { backgroundColor: 'transparent', color: '#16181d', borderWidth: 2, borderColor: '#16181d' }, { hov: { backgroundColor: '#16181d', color: '#ffffff' }, link: '/satin/about' }) },
  { cat: 'Buttons', key: 'btn-square', name: 'Square button', tile: '<span class="tb s">Button</span>', make: () => btn('SHOP NOW', { borderRadius: 0, fontWeight: 800, letterSpacing: 2 }, { link: '/satin/shop' }) },
  { cat: 'Buttons', key: 'btn-icon', name: 'Icon button', tile: '<span class="tb i">→</span>', make: () => ({ ...btn('', { borderRadius: 999 }, { p: { icon: 'arrow' } }), w: 56, h: 56 }) },
  { cat: 'Buttons', key: 'btn-arrow', name: 'Button + icon', tile: '<span class="tb">Next →</span>', make: () => btn('Start your project', { backgroundColor: '#c91c50', color: '#fff' }, { p: { icon: 'arrow', iconPos: 'right' }, hov: { backgroundColor: '#16181d' } }) },
  { cat: 'Buttons', key: 'whatsapp', name: 'Floating WhatsApp', tile: '<span class="tb g">WA</span>', make: () => ({ kind: 'button', w: 60, h: 60, p: { label: '', icon: 's-whatsapp' }, link: 'https://wa.me/19059626222', style: { backgroundColor: '#25d366', color: '#fff', borderRadius: 999, fontSize: 28, shX: 0, shY: 8, shBlur: 24, shColor: 'rgba(0,0,0,.25)' }, hov: { backgroundColor: '#1ebe57' }, pin: { at: 'br', ox: 22, oy: 22, w: 60 }, anim: { loop: { t: 'pulse', d: 2400 } } }) },
  { cat: 'Buttons', key: 'sticky-cta', name: 'Sticky CTA bar', tile: '<span class="tb a" style="width:100%">Get a quote</span>', make: () => ({ kind: 'button', w: 30, h: 56, p: { label: 'Get a free quote today', icon: 'arrow', iconPos: 'right' }, link: 'quote:', style: { backgroundColor: '#c91c50', color: '#fff', borderRadius: 999, shX: 0, shY: 10, shBlur: 30, shColor: 'rgba(0,0,0,.3)' }, pin: { at: 'bc', ox: 0, oy: 18, w: 340 }, anim: { in: { t: 'slide-up', d: 700 } } }) },
  { cat: 'Buttons', key: 'pay', name: 'Payment button', tile: '<span class="tb">💳 Pay</span>', make: () => btn('Pay deposit', { backgroundColor: '#635bff', color: '#fff', borderRadius: 10 }, { p: { icon: 'card' }, link: 'https://' }) },
  { cat: 'Buttons', key: 'book', name: 'Booking button', tile: '<span class="tb">📅 Book</span>', make: () => btn('Book an appointment', { backgroundColor: '#16181d', color: '#fff' }, { p: { icon: 'calendar' }, link: '/satin/auto-detailing/booking' }) },
  // media
  { cat: 'Media', key: 'image', name: 'Image', tile: '<i class="ti img"></i>', make: () => ({ kind: 'image', w: 480, h: 320, p: { src: im(0), alt: '' }, style: { borderRadius: 16 } }) },
  { cat: 'Media', key: 'vector', name: 'Vector / SVG', tile: '<b style="font-size:11px">SVG</b>', make: () => ({ kind: 'vector', w: 160, h: 160, p: { src: '' } }) },
  { cat: 'Media', key: 'video', name: 'Video', tile: '<i class="ti vid"></i>', make: () => ({ kind: 'video', w: 640, h: 360, p: { src: '', controls: true }, style: { borderRadius: 16, overflow: 'hidden' } }) },
  { cat: 'Media', key: 'audio', name: 'Music / audio', tile: '<b style="font-size:16px">♪</b>', make: () => ({ kind: 'audio', w: 380, h: 60, p: { src: '' } }) },
  { cat: 'Media', key: 'slider', name: 'Image slider', tile: '<i class="ti sl"></i>', make: () => ({ kind: 'slider', w: 760, h: 420, p: { mode: 'slide', auto: 4, items: [0, 1, 2, 3].map(i => ({ src: im(i + 2), alt: '' })) }, style: { borderRadius: 16 } }) },
  { cat: 'Media', key: 'carousel', name: 'Carousel', tile: '<i class="ti car"></i>', make: () => ({ kind: 'slider', w: 1100, h: 300, p: { mode: 'carousel', per: 3, gap: 14, items: [0, 1, 2, 3, 4, 5].map(i => ({ src: im(i + 4), alt: '' })), dots: false } }) },
  { cat: 'Media', key: 'grid', name: 'Gallery grid', tile: '<i class="ti gr"></i>', make: () => ({ kind: 'slider', w: 1000, h: 520, p: { mode: 'grid', per: 3, gap: 10, items: [0, 1, 2, 3, 4, 5].map(i => ({ src: im(i + 6), alt: '' })) } }) },
  { cat: 'Media', key: 'ba', name: 'Before / after', tile: '<b style="font-size:10px">◧ B|A</b>', make: () => ({ kind: 'beforeafter', w: 640, h: 400, p: { before: im(1), after: im(2), start: 50 }, style: { borderRadius: 16 } }) },
  { cat: 'Media', key: 'lottie', name: 'Lottie animation', tile: '<b style="font-size:10px">LOTTIE</b>', make: () => ({ kind: 'lottie', w: 260, h: 260, p: { src: '', loop: true } }) },
  // shapes
  ...['rect', 'circle', 'triangle', 'diamond', 'hexagon', 'star', 'arrow', 'chevron', 'parallelogram', 'pentagon', 'message', 'blob'].map(sh => ({ cat: 'Shapes', key: 'sh-' + sh, name: sh[0].toUpperCase() + sh.slice(1), tile: `<i class="tsh" style="clip-path:${RT.SHAPES[sh] || 'none'}"></i>`, make: () => ({ kind: 'shape', w: 200, h: sh === 'rect' ? 140 : 200, p: { shape: sh }, style: { backgroundColor: '#c91c50', ...(sh === 'rect' ? { borderRadius: 12 } : {}) } }) })),
  { cat: 'Shapes', key: 'line-h', name: 'Line', tile: '<i style="display:block;width:46px;border-top:2px solid #111"></i>', make: () => ({ kind: 'shape', w: 400, h: 20, p: { shape: 'line-h' }, style: { borderWidth: 2, borderColor: '#16181d' } }) },
  { cat: 'Shapes', key: 'line-v', name: 'Vertical line', tile: '<i style="display:block;height:34px;border-left:2px solid #111"></i>', make: () => ({ kind: 'shape', w: 20, h: 240, p: { shape: 'line-v' }, style: { borderWidth: 2, borderColor: '#16181d' } }) },
  { cat: 'Shapes', key: 'gradshape', name: 'Gradient blob', tile: '<i class="tsh" style="border-radius:50%;background:linear-gradient(135deg,#c91c50,#f59e0b)"></i>', make: () => ({ kind: 'shape', w: 320, h: 320, p: { shape: 'circle' }, style: { gradient: { t: 'linear', a: 135, s: [{ c: '#c91c50', p: 0 }, { c: '#f59e0b', p: 100 }] }, blur: 40, opacity: 0.7 }, z: 0 }) },
  // layout
  { cat: 'Boxes', key: 'box', name: 'Box', tile: '<i class="tbx"></i>', make: () => ({ kind: 'box', w: 480, h: 300, p: {}, style: { backgroundColor: '#f3f5f8', borderRadius: 20 } }) },
  { cat: 'Boxes', key: 'card', name: 'Card', tile: '<i class="tbx sh"></i>', make: () => ({ kind: 'box', w: 360, h: 420, p: {}, style: { backgroundColor: '#ffffff', borderRadius: 20, shX: 0, shY: 14, shBlur: 40, shColor: 'rgba(15,23,42,.12)' } }) },
  { cat: 'Boxes', key: 'hoverbox', name: 'Hover box', tile: '<i class="tbx hv"></i>', make: () => ({ kind: 'box', w: 360, h: 260, p: {}, style: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' }, hov: { backgroundColor: '#16181d', color: '#ffffff' }, anim: { hov: { t: 'lift', d: 300 } } }) },
  { cat: 'Boxes', key: 'glass', name: 'Glass box', tile: '<i class="tbx gl"></i>', make: () => ({ kind: 'box', w: 420, h: 260, p: {}, style: { backgroundColor: 'rgba(255,255,255,0.18)', backdrop: 14, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' } }) },
  { cat: 'Boxes', key: 'row', name: 'Flex row', tile: '<i class="tbx row"></i>', make: () => ({ kind: 'box', w: 900, h: 120, p: { flow: true }, style: { display: 'flex', flexDir: 'row', gap: 16, alignItems: 'center', justify: 'center', pt: 16, pb: 16, pl: 16, pr: 16 } }) },
  { cat: 'Boxes', key: 'repeater', name: 'Repeater cards', tile: '<i class="ti gr"></i>', make: () => ({ kind: 'repeater', w: 1100, h: 0, p: { cols: 3, items: [['Vehicle wraps', '/satin/vehicle-wraps'], ['Print shop', '/satin/print-shop'], ['Apparel', '/satin/apparel']].map(([t, l], i) => ({ title: t, body: 'Short description.', image: im(i + 6), link: l, button: 'Learn more' })) } }) },
  // interactive
  { cat: 'Interactive', key: 'popup', name: 'Popup / lightbox', tile: '<i class="tpop"></i>', make: () => ({ kind: 'popup', w: 200, h: 52, p: { label: 'Special offer', trigger: 'click', title: 'Spring wrap special', html: 'Get <b>10% off</b> full colour-change wraps booked this month.', btn: 'Get a quote', btnLink: 'quote:', size: 'md', pos: 'center' } }) },
  { cat: 'Interactive', key: 'popup-auto', name: 'Auto popup (on load)', tile: '<i class="tpop auto"></i>', make: () => ({ kind: 'popup', w: 200, h: 52, p: { trigger: 'load', delay: 4, once: true, title: 'Free quote in 24 hours', html: 'Tell us about your project and we’ll get back to you within one business day.', btn: 'Start a quote', btnLink: 'quote:', size: 'sm', pos: 'right' } }) },
  { cat: 'Media', key: 'imgseq', name: 'Image sequence (scroll)', tile: '<b style="font-size:10px">▶ 1·2·3</b>', make: () => ({ kind: 'imgseq', w: 640, h: 400, p: { mode: 'scroll', frames: [0, 1, 2, 3, 4, 5].map(i => im(i)).filter(Boolean) } }) },
  { cat: 'Interactive', key: 'accordion', name: 'Accordion', tile: '<i class="tacc"></i>', make: () => ({ kind: 'accordion', w: 760, h: 0, p: { items: [{ title: 'How long does a wrap take?', body: 'Most vehicles are done in 2–4 days.' }, { title: 'Do you design the graphics?', body: 'Yes — our in-house designers do.' }, { title: 'Is there a warranty?', body: 'Every install has a workmanship warranty.' }] } }) },
  { cat: 'Interactive', key: 'tabs', name: 'Tabs', tile: '<b style="font-size:10px">▭▭▭</b>', make: () => ({ kind: 'tabs', w: 760, h: 0, p: { items: [{ title: 'Commercial', body: 'Fleet, van and truck wraps.' }, { title: 'Colour change', body: 'Satin, matte, gloss and chrome.' }, { title: 'Protection', body: 'PPF and ceramic coating.' }] } }) },
  { cat: 'Interactive', key: 'countdown', name: 'Countdown', tile: '<b style="font-size:11px">00:12:45</b>', make: () => ({ kind: 'countdown', w: 460, h: 110, p: { to: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16), done: 'The offer has ended' }, style: { fontWeight: 800 } }) },
  { cat: 'Interactive', key: 'progress', name: 'Progress bar', tile: '<i class="tpr"></i>', make: () => ({ kind: 'progress', w: 420, h: 48, p: { value: 75, label: 'Customer satisfaction' } }) },
  { cat: 'Interactive', key: 'counter', name: 'Number counter', tile: '<b style="font-size:15px">9,700+</b>', make: () => ({ kind: 'counter', w: 240, h: 0, p: { to: 9700, suffix: '+', label: 'Projects completed' }, style: { fontWeight: 800 } }) },
  // menus & navigation
  { cat: 'Menus', key: 'menu-h', name: 'Horizontal menu', tile: '<span style="font-size:9px">Home · About · Work</span>', make: () => ({ kind: 'menu', w: 640, h: 50, p: { items: siteMenu(), burger: 'mobile' }, style: { fontSize: 16 } }) },
  { cat: 'Menus', key: 'menu-v', name: 'Vertical menu', tile: '<span style="font-size:9px;text-align:left">Home<br>About<br>Work</span>', make: () => ({ kind: 'menu', w: 240, h: 220, p: { items: siteMenu(), vertical: true, burger: 'never' }, style: { fontSize: 16 } }) },
  { cat: 'Menus', key: 'burger', name: 'Hamburger menu', tile: '<b style="font-size:16px">☰</b>', make: () => ({ kind: 'menu', w: 60, h: 50, p: { items: siteMenu(), burger: 'always' } }) },
  { cat: 'Menus', key: 'anchor-menu', name: 'Section links', tile: '<span style="font-size:9px">#one · #two</span>', make: () => ({ kind: 'menu', w: 520, h: 50, p: { items: [{ label: 'Services', href: '#services' }, { label: 'Work', href: '#work' }, { label: 'Contact', href: '#contact' }], burger: 'never' } }) },
  // forms
  { cat: 'Forms', key: 'form-contact', name: 'Contact form', tile: '<i class="tfm"></i>', make: () => ({ kind: 'form', w: 520, h: 0, p: { title: 'Send us a message', submit: 'Send message', service: 'Contact form', fields: [{ label: 'Message', type: 'textarea', required: true }] }, style: { backgroundColor: '#ffffff', pt: 24, pr: 24, pb: 24, pl: 24, borderRadius: 18, shX: 0, shY: 10, shBlur: 30, shColor: 'rgba(0,0,0,.08)' } }) },
  { cat: 'Forms', key: 'form-quote', name: 'Quote form', tile: '<i class="tfm"></i>', make: () => ({ kind: 'form', w: 560, h: 0, p: { title: 'Get a free quote', submit: 'Request quote', service: 'Website quote form', fields: [{ label: 'Vehicle (year, make, model)', type: 'text', required: true }, { label: 'Service', type: 'select', required: true, options: ['Full wrap', 'Partial wrap', 'Commercial graphics', 'Colour change', 'PPF', 'Window tint'] }, { label: 'Details', type: 'textarea' }] }, style: { backgroundColor: '#ffffff', pt: 24, pr: 24, pb: 24, pl: 24, borderRadius: 18 } }) },
  // social & icons
  { cat: 'Social', key: 'social', name: 'Social bar', tile: '<b style="font-size:10px">f ◎ ▶</b>', make: () => ({ kind: 'social', w: 220, h: 40, p: { items: [{ net: 'facebook', url: 'https://facebook.com/' }, { net: 'instagram', url: 'https://instagram.com/' }, { net: 'tiktok', url: 'https://tiktok.com/' }, { net: 'youtube', url: 'https://youtube.com/' }] }, style: { color: '#16181d' } }) },
  { cat: 'Social', key: 'icon', name: 'Icon', tile: '<b style="font-size:16px">★</b>', make: () => ({ kind: 'icon', w: 64, h: 64, p: { icon: 'star' } }) },
  { cat: 'Social', key: 'gbadge', name: 'Google rating', tile: '<b style="font-size:10px">★ 5.0</b>', make: () => txt('<b>★★★★★ 5.0</b> on Google · 198+ reviews', 'div', 16, { w: 380, style: { color: '#16181d' } }) },
  // embed
  { cat: 'Embed', key: 'embed', name: 'Embed code', tile: '<b style="font-size:11px">&lt;/&gt;</b>', make: () => ({ kind: 'embed', w: 640, h: 360, p: { html: '' } }) },
  { cat: 'Embed', key: 'iframe', name: 'Website (iframe)', tile: '<b style="font-size:10px">www</b>', make: () => ({ kind: 'embed', w: 800, h: 500, p: { url: '' } }) },
  { cat: 'Embed', key: 'map', name: 'Google map', tile: '<b style="font-size:16px">📍</b>', make: () => ({ kind: 'map', w: 640, h: 380, p: { q: '50 Viceroy Rd, Vaughan, ON', zoom: 14 }, style: { borderRadius: 16, overflow: 'hidden' } }) }
];
function siteMenu() {
  const items = (S.menu?.items || []).filter(i => i.active !== false).slice(0, 8);
  return items.length ? items.map(i => ({ label: i.label, href: i.href, sub: (i.groups || []).flatMap(g => g.links || []).filter(l => l.active !== false).slice(0, 10).map(l => ({ label: l.label, href: l.href })) })) : [{ label: 'Home', href: '/satin' }, { label: 'About', href: '/satin/about' }, { label: 'Contact', href: '/satin/contact' }];
}
export const ICON_NAMES = Object.keys(RT.ICONS);
