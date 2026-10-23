/* "Satin Explore" site theme — structure (the look is /themes/explore.css).
   Loaded by /site-extras.mjs when the published theme is Explore (explore.css sets --xp-theme:1),
   or for a private preview with ?theme=explore (turn off with ?theme=off).
   - header: logo · big search · account · cart, and one simple menu row ("All products & services" + 5 links)
   - home: scroll-driven hero video (plain van → wrapped fleet → pick your vehicle), red icon grid, "Made by Satin"
   - phones: bottom tab bar (Home · Categories · Search · Cart) */
import { SOON } from '/coming-soon.mjs?v=1';

const LANG = (location.pathname.match(/^\/satin\/(fa|fr|es)(?=\/|$)/) || [])[1] || 'en';
const PRE = LANG === 'en' ? '/satin' : '/satin/' + LANG;
const loc = h => /^https?:/.test(h) ? h : h.replace(/^\/satin(?=\/|$|\?|#)/, PRE);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HOME_RE = /^\/satin(?:\/(?:fa|fr|es))?\/?$/;

const T = {
  en: { feat: 'Featured', menu: 'Menu', call: 'Call us', wa: 'WhatsApp', login: 'Account / Log in', lang: 'Language', contact: 'Contact', hours: 'Mon–Fri 9–5 · Sat 10–3', studioS: 'Design your wrap online', workS: 'Real projects from our shop', all: 'All products & services', search: 'Search all products & services', account: 'Account', cart: 'Cart', quote: 'Get a quote', home: 'Home', cats: 'Categories', srch: 'Search', close: 'Close', see: 'See all',
    nav: ['Vehicle wraps', 'Print & signs', 'Walls & windows', 'Apparel', 'Our work', 'Design Studio'],
    h1a: 'Plain in.', h1b: 'Branded', h1c: 'out.', sub: 'Vehicle wraps · Printing · Signage · Vaughan, ON', scroll: 'Scroll', endA: 'Pick your vehicle.', endB: 'See your price.', price: 'See price',
    q: 'What can we make for you?', qs: 'Everything for your brand, all in one place.', explore: 'Explore our services', cant: 'Can’t find what you need?', az: 'Browse all products A–Z', ask: 'Ask our team', made: 'Made by Satin', madeS: 'Real projects from our Vaughan workshop', soon: 'Soon',
    svc: ['Vehicle wraps', 'PPF & detailing', 'Window tint', 'Signs & displays', 'Walls & windows', 'Business printing', 'Stickers & labels', 'Custom apparel', 'Design & templates', 'Materials & tools'],
    work: ['Commercial van wrap', 'Café feature wall', 'Colour-flip Tesla wrap'], veh: { sedan: 'Sedan', suv: 'SUV', van: 'Sprinter Van', pickup: 'Pickup Truck', minivan: 'Minivan', bus: 'Bus', box: 'Box Truck', trailer: 'Trailer' } },
  fa: { feat: 'ویژه', menu: 'منو', call: 'تماس', wa: 'واتس‌اپ', login: 'حساب / ورود', lang: 'زبان', contact: 'تماس', hours: 'دوشنبه–جمعه ۹–۵ · شنبه ۱۰–۳', studioS: 'طرح روکش را آنلاین بسازید', workS: 'پروژه‌های واقعی کارگاه ما', all: 'همه محصولات و خدمات', search: 'جستجو در همه محصولات و خدمات', account: 'حساب', cart: 'سبد', quote: 'دریافت قیمت', home: 'خانه', cats: 'دسته‌ها', srch: 'جستجو', close: 'بستن', see: 'مشاهده همه',
    nav: ['روکش خودرو', 'چاپ و تابلو', 'دیوار و شیشه', 'پوشاک', 'نمونه‌کارها', 'استودیوی طراحی'],
    h1a: 'ساده وارد شو.', h1b: 'برند‌دار', h1c: 'بیرون بیا.', sub: 'روکش خودرو · چاپ · تابلو · وان، انتاریو', scroll: 'اسکرول کنید', endA: 'خودروی خود را انتخاب کنید.', endB: 'قیمت را ببینید.', price: 'دیدن قیمت',
    q: 'چه چیزی برایتان بسازیم؟', qs: 'همه چیز برای برند شما، در یک جا.', explore: 'خدمات ما', cant: 'چیزی که می‌خواهید را پیدا نکردید؟', az: 'همه محصولات', ask: 'از تیم ما بپرسید', made: 'ساخت ستین', madeS: 'پروژه‌های واقعی از کارگاه ما در وان', soon: 'به‌زودی',
    svc: ['روکش خودرو', 'PPF و دیتیلینگ', 'دودی شیشه', 'تابلو و استند', 'دیوار و شیشه', 'چاپ تجاری', 'استیکر و لیبل', 'پوشاک سفارشی', 'طراحی و قالب', 'مواد و ابزار'],
    work: ['روکش ون تجاری', 'دیوارنگاره کافه', 'روکش تغییر رنگ تسلا'], veh: { sedan: 'سدان', suv: 'شاسی‌بلند', van: 'ون اسپرینتر', pickup: 'وانت', minivan: 'مینی‌ون', bus: 'اتوبوس', box: 'کامیون باکس', trailer: 'تریلر' } },
  fr: { feat: 'En vedette', menu: 'Menu', call: 'Appeler', wa: 'WhatsApp', login: 'Compte / Connexion', lang: 'Langue', contact: 'Contact', hours: 'Lun–ven 9 h–17 h · sam 10 h–15 h', studioS: 'Créez votre covering en ligne', workS: 'Projets réels de notre atelier', all: 'Tous les produits et services', search: 'Rechercher produits et services', account: 'Compte', cart: 'Panier', quote: 'Obtenir un prix', home: 'Accueil', cats: 'Catégories', srch: 'Recherche', close: 'Fermer', see: 'Tout voir',
    nav: ['Covering', 'Impression & enseignes', 'Murs & vitres', 'Vêtements', 'Réalisations', 'Studio de création'],
    h1a: 'Neutre à l’entrée.', h1b: 'Brandé', h1c: 'à la sortie.', sub: 'Covering · Impression · Enseignes · Vaughan (Ont.)', scroll: 'Défiler', endA: 'Choisissez votre véhicule.', endB: 'Voyez votre prix.', price: 'Voir le prix',
    q: 'Que pouvons-nous créer pour vous?', qs: 'Tout pour votre marque, au même endroit.', explore: 'Nos services', cant: 'Vous ne trouvez pas?', az: 'Tous les produits de A à Z', ask: 'Demandez à notre équipe', made: 'Fait par Satin', madeS: 'Projets réels de notre atelier de Vaughan', soon: 'Bientôt',
    svc: ['Covering de véhicules', 'PPF & esthétique', 'Teinte de vitres', 'Enseignes & présentoirs', 'Murs & vitres', 'Impression d’affaires', 'Autocollants & étiquettes', 'Vêtements personnalisés', 'Design & gabarits', 'Matériaux & outils'],
    work: ['Covering de fourgon commercial', 'Mur décoratif de café', 'Tesla couleur caméléon'], veh: { sedan: 'Berline', suv: 'VUS', van: 'Fourgon Sprinter', pickup: 'Camionnette', minivan: 'Minifourgonnette', bus: 'Autobus', box: 'Camion cube', trailer: 'Remorque' } },
  es: { feat: 'Destacado', menu: 'Menú', call: 'Llamar', wa: 'WhatsApp', login: 'Cuenta / Entrar', lang: 'Idioma', contact: 'Contacto', hours: 'Lun–vie 9–5 · sáb 10–3', studioS: 'Diseña tu rotulación en línea', workS: 'Proyectos reales de nuestro taller', all: 'Todos los productos y servicios', search: 'Buscar productos y servicios', account: 'Cuenta', cart: 'Carrito', quote: 'Obtener precio', home: 'Inicio', cats: 'Categorías', srch: 'Buscar', close: 'Cerrar', see: 'Ver todo',
    nav: ['Rotulación', 'Impresión y letreros', 'Paredes y vidrios', 'Ropa', 'Trabajos', 'Estudio de diseño'],
    h1a: 'Entra simple.', h1b: 'Sale con', h1c: 'tu marca.', sub: 'Rotulación · Impresión · Letreros · Vaughan, ON', scroll: 'Desliza', endA: 'Elige tu vehículo.', endB: 'Mira tu precio.', price: 'Ver precio',
    q: '¿Qué podemos hacer por ti?', qs: 'Todo para tu marca, en un solo lugar.', explore: 'Nuestros servicios', cant: '¿No encuentras lo que buscas?', az: 'Todos los productos de la A a la Z', ask: 'Pregunta a nuestro equipo', made: 'Hecho por Satin', madeS: 'Proyectos reales de nuestro taller en Vaughan', soon: 'Pronto',
    svc: ['Rotulación de vehículos', 'PPF y detallado', 'Polarizado', 'Letreros y exhibidores', 'Paredes y vidrios', 'Impresión comercial', 'Etiquetas y stickers', 'Ropa personalizada', 'Diseño y plantillas', 'Materiales y herramientas'],
    work: ['Rotulación de van comercial', 'Mural de cafetería', 'Tesla color camaleón'], veh: { sedan: 'Sedán', suv: 'SUV', van: 'Van Sprinter', pickup: 'Pickup', minivan: 'Minivan', bus: 'Autobús', box: 'Camión caja', trailer: 'Remolque' } },
}[LANG];

/* line icons (48×48, stroke = currentColor) */
const S = p => `<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC = {
  van: S('<path d="M4 33V15a2 2 0 0 1 2-2h22l9 8h5a3 3 0 0 1 3 3v9"/><path d="M28 13v8h9"/><path d="M4 33h4m8 0h16m8 0h3"/><circle cx="12" cy="33" r="4"/><circle cx="36" cy="33" r="4"/><path d="M4 24h24"/>'),
  ppf: S('<path d="M6 32v-6l4-8a3 3 0 0 1 3-2h12l5 8h5a3 3 0 0 1 3 3v5"/><path d="M6 32h3m8 0h12m8 0h1"/><circle cx="13" cy="32" r="3.5"/><circle cx="33" cy="32" r="3.5"/><path d="M11 24h19"/><path d="M38 6l6 2.5v5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8v-5z"/><path d="M35.5 13.5l2 2 3.5-4"/>'),
  tint: S('<rect x="8" y="6" width="32" height="36" rx="1.5"/><path d="M26 6v36M26 22h14"/><path d="M12 14l6-6M12 20l10-10"/>'),
  signs: S('<path d="M17 6h14l9 36M17 6 8 42"/><path d="M14 18h20M12 28h24"/><path d="M24 6V3"/>'),
  walls: S('<rect x="6" y="6" width="10" height="34" rx="5"/><path d="M11 6h28v34H11"/><ellipse cx="11" cy="40" rx="5" ry="2"/><path d="M22 14h0M28 14h0M34 14h0M22 20h0M28 20h0M34 20h0M22 26h0M28 26h0M34 26h0M22 32h0M28 32h0M34 32h0" stroke-width="2.4"/>'),
  print: S('<path d="M8 30l18 8 14-8-18-8z"/><path d="M8 25l18 8 14-8M8 20l18 8 14-8M8 15l18 8 14-8L22 7z"/><path d="M8 15v15M40 15v15"/>'),
  stickers: S('<ellipse cx="17" cy="16" rx="11" ry="6"/><path d="M6 16v16c0 3.3 4.9 6 11 6s11-2.7 11-6V16"/><ellipse cx="17" cy="16" rx="4" ry="2"/><path d="M28 22h10v18h-8"/><path d="M33 26v10"/>'),
  apparel: S('<path d="M17 6c1.5 3 4 4.5 7 4.5S29.5 9 31 6l11 6-4 9-5-2.5V42H15V18.5L10 21l-4-9z"/>'),
  design: S('<path d="M24 4l9 17-9 19-9-19z"/><path d="M24 4v18"/><circle cx="24" cy="24" r="2.5"/><path d="M15 40h18v4H15z"/>'),
  detailing: S('<path d="M6 32v-6l4-8a3 3 0 0 1 3-2h14l5 8h5a3 3 0 0 1 3 3v5"/><path d="M6 32h3m8 0h14m8 0h1"/><circle cx="13" cy="32" r="3.5"/><circle cx="35" cy="32" r="3.5"/><path d="M11 24h21"/><path d="M38 4v6M35 7h6M44 12v4M42 14h4"/>'),
  digital: S('<rect x="5" y="8" width="38" height="25" rx="2.5"/><path d="M18 40h12M24 33v7"/><path d="M12 26l6-7 5 4 7-9 6 8"/>'),
  shop: S('<path d="M9 16h30l-2.5 26h-25z"/><path d="M17 20v-6a7 7 0 0 1 14 0v6"/>'),
  contact: S('<path d="M8 10h32a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H22l-9 7v-7H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z"/><path d="M14 20h20M14 26h12"/>'),
  work: S('<rect x="5" y="9" width="38" height="30" rx="2.5"/><circle cx="16" cy="19" r="3.5"/><path d="M5 34l11-10 8 7 7-6 12 10"/>'),
  tools: S('<path d="M5 30l22-12 4 7-22 12z"/><path d="M27 18l4 7"/><rect x="33" y="8" width="11" height="32" rx="5.5"/><path d="M38.5 8v32"/>'),
};
const WAICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.3 3.3 0 0 0-1 2.5 5.8 5.8 0 0 0 1.2 3.1 13.3 13.3 0 0 0 5.1 4.5c1.9.8 2.6.9 3.6.7a3 3 0 0 0 2-1.4 2.4 2.4 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6a11.8 11.8 0 0 0 5.6 1.4A11.8 11.8 0 0 0 20.4 3.6z"/></svg>';
const UI = {
  grid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"/></svg>',
  cart: '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.5l2.2 11h10.8L21 7.5H6.4"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true"><path d="M12 3.2 3 10.4V21h6.2v-6.2h5.6V21H21V10.4z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const SERVICES = [
  ['van', '/satin/vehicle-wraps/'], ['ppf', '/satin/vehicle-wraps/paint-protection-film/'], ['tint', '/satin/window-tint/'], ['signs', '/satin/print-shop/large-format/'], ['walls', '/satin/window-graphics/'],
  ['print', '/satin/print-shop/offset/'], ['stickers', '/satin/print-shop/labels/'], ['apparel', '/satin/apparel/'], ['design', '/satin/shop/design-services/'], ['tools', '/satin/shop/materials-tools/'],
];
const NAV = ['/satin/vehicle-wraps/', '/satin/print-shop/', '/satin/window-graphics/', '/satin/apparel/', '/satin/portfolio/', '/satin/design-studio/'];
const WORK = [['/satin/img/job-greenlife-van-960.webp', '/satin/vehicle-wraps/commercial/'], ['/satin/img/wall-restaurant-960.webp', '/satin/wallpaper/'], ['/satin/img/job-tesla-flip-960.webp', '/satin/vehicle-wraps/color-change/']];
const CAT_IMG = { wraps: '/satin/img/sprinter-wrapped-960.webp', print: '/satin/img/print-business-cards.optimized.webp', apparel: '/satin/img/satin-shirt-logo.webp', windows: '/satin/img/window-vinyl.optimized.webp', shop: '/satin/img/wrap-prints-printer.webp', detailing: '/satin/img/detail-hand-960.webp', portfolio: '/satin/img/job-camaro-960.webp', studio: '/satin/img/design-studio.optimized.webp', digital: '/satin/img/home-video-poster-910.webp', contact: '/satin/img/install-detail-900.webp' };
const CAT_IC = { wraps: 'van', print: 'print', apparel: 'apparel', windows: 'tint', detailing: 'detailing', digital: 'digital', shop: 'shop', studio: 'design', contact: 'contact', portfolio: 'work' };
const catIc = it => IC[CAT_IC[it?.key] || 'van'];
const catImg = it => CAT_IMG[it?.key] || '/satin/img/hero-fleet-satin.webp';
const catAll = it => linkHref(((it?.groups || [])[0]?.links || [])[0]?.href || it?.href || '/satin/');
const TEL = 'tel:+19056959147', TEL2 = 'tel:+19059626222', WA = 'https://wa.me/19059626222';
const isSoon = h => SOON.includes(h.replace(/\/+$/, ''));

/* menu data: the same list the site's own menu uses (inline JSON on every page) */
let MENU = null;
function menu() {
  if (MENU) return MENU;
  try { MENU = JSON.parse(document.querySelector('script[data-navigation-bootstrap]')?.textContent || '{}').items || []; } catch { MENU = []; }
  MENU = MENU.filter(i => i.active !== false && (i.groups || []).length);
  return MENU;
}
const linkHref = h => loc(h.replace(/\/?(\?|#|$)/, '/$1').replace(/\/\/+/g, '/'));

/* ---------- header ---------- */
function openCart() { document.querySelector('.hdr [data-cart]')?.click(); }
function openSearch() { (window.satinOpenSearch || (() => document.querySelector('.sx-hbtn')?.click()))(); }
function header() {
  const hdr = document.querySelector('header.hdr'), bar = hdr?.querySelector('.bar'); if (!bar) return;
  if (!bar.querySelector('.xp-search')) {
    const s = document.createElement('button'); s.type = 'button'; s.className = 'xp-search'; s.innerHTML = `${UI.search}<span>${esc(T.search)}</span>`; s.onclick = openSearch;
    bar.querySelector('.logo')?.after(s);
  }
  const right = bar.querySelector('.right');
  if (right && !right.querySelector('.xp-acc')) {
    const a = document.createElement('a'); a.className = 'xp-acc xp-hl'; a.href = loc('/satin/login/'); a.innerHTML = `${UI.user}<span>${esc(T.account)}</span>`;
    const c = document.createElement('button'); c.type = 'button'; c.className = 'xp-cart xp-hl'; c.innerHTML = `${UI.cart}<span>${esc(T.cart)}</span><b data-xp-n hidden></b>`; c.onclick = openCart;
    const burger = right.querySelector('[data-burger]'); right.insertBefore(a, burger); right.insertBefore(c, burger);
  }
  const n = right?.querySelector('[data-cart-n]')?.textContent.trim(), nb = right?.querySelector('[data-xp-n]');
  if (nb && nb.textContent !== (n || '')) nb.textContent = n || ''; if (nb) nb.hidden = !n || n === '0';
  if (!hdr.querySelector('.xp-nav')) {
    const nav = document.createElement('nav'); nav.className = 'xp-nav'; nav.setAttribute('aria-label', 'Main');
    nav.innerHTML = `<div class="wrap xp-nav-in"><button type="button" class="xp-all" aria-expanded="false" aria-haspopup="true">${UI.grid}<span>${esc(T.all)}</span>${UI.chev}</button>${NAV.map((h, i) => `<a href="${loc(h)}"${i === 5 ? ' class="xp-studio"' : ''}>${esc(T.nav[i])}</a>`).join('')}<button type="button" class="xp-quote" data-quote="">${esc(T.quote)}</button></div><div class="xp-mega" hidden><div class="wrap xp-mega-in"></div></div>`;
    bar.after(nav);
    const btn = nav.querySelector('.xp-all'), mega = nav.querySelector('.xp-mega');
    const close = () => { mega.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.onclick = e => { e.stopPropagation(); if (!mega.hidden) return close(); mega.querySelector('.xp-mega-in').innerHTML = megaHTML(); mega.hidden = false; btn.setAttribute('aria-expanded', 'true'); wireMega(mega); };
    document.addEventListener('click', e => { if (!mega.hidden && !e.target.closest('.xp-mega')) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    mega.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    addEventListener('popstate', close);
  }
  markActive(hdr);
}
function markActive(hdr) {
  const p = location.pathname.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/, '/satin');
  hdr.querySelectorAll('.xp-nav-in > a').forEach((a, i) => a.classList.toggle('on', p.startsWith(NAV[i].replace(/\/$/, ''))));
}
function megaHTML(active = 0) {
  const items = menu();
  return `<div class="xp-cats" role="tablist">${items.map((it, i) => `<button type="button" role="tab" data-i="${i}" class="${i === active ? 'on' : ''}"><span class="xp-ci">${catIc(it)}</span><span>${esc(it.label)}</span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`).join('')}</div><div class="xp-groups">${groupsHTML(items[active])}</div><a class="xp-feat" href="${catAll(items[active])}">${featHTML(items[active])}</a>`;
}
function featHTML(it) { return it ? `<span class="xp-feat-i"><img src="${catImg(it)}" alt="" decoding="async"></span><span class="xp-feat-t"><small>${esc(T.feat)}</small><b>${esc(it.label)}</b><em>${esc(T.see)} ${UI.arrow}</em></span>` : ''; }
function groupsHTML(it) {
  if (!it) return '';
  return (it.groups || []).map(g => `<div class="xp-g"><h4>${esc(g.label)}</h4>${(g.links || []).filter(l => l.active !== false).map(l => `<a href="${linkHref(l.href)}">${esc(l.label)}${isSoon(l.href) ? ` <span class="cs-badge">${esc(T.soon)}</span>` : ''}</a>`).join('')}</div>`).join('');
}
function wireMega(root) {
  const items = menu();
  root.querySelectorAll('.xp-cats [data-i]').forEach(b => {
    const go = () => { root.querySelectorAll('.xp-cats [data-i]').forEach(x => x.classList.toggle('on', x === b)); root.querySelector('.xp-groups').innerHTML = groupsHTML(items[+b.dataset.i]); const f = root.querySelector('.xp-feat'); f.href = catAll(items[+b.dataset.i]); f.innerHTML = featHTML(items[+b.dataset.i]); };
    b.onmouseenter = go; b.onfocus = go; b.onclick = go;
  });
}

/* ---------- phones: bottom tab bar + categories sheet ---------- */
function tabs() {
  if (document.querySelector('.xp-tabs') || /^\/satin\/(?:(?:fa|fr|es)\/)?(checkout|design-studio)/.test(location.pathname)) return;
  const t = document.createElement('nav'); t.className = 'xp-tabs'; t.setAttribute('aria-label', 'Shortcuts');
  t.innerHTML = `<a href="${PRE}/" data-t="home">${UI.home}<span>${esc(T.home)}</span></a><button type="button" data-t="cats">${UI.grid.replace(/18/g, '23')}<span>${esc(T.cats)}</span></button><button type="button" data-t="search">${UI.search.replace(/19/g, '23')}<span>${esc(T.srch)}</span></button><button type="button" data-t="cart">${UI.cart.replace(/21/g, '23')}<span>${esc(T.cart)}</span><b data-xp-n hidden></b></button>`;
  document.body.append(t);
  t.querySelector('[data-t=cats]').onclick = drawer;
  t.querySelector('[data-t=search]').onclick = openSearch;
  t.querySelector('[data-t=cart]').onclick = openCart;
}
function syncTabs() {
  const t = document.querySelector('.xp-tabs'); if (!t) return;
  t.querySelector('[data-t=home]').classList.toggle('on', HOME_RE.test(location.pathname));
  const n = document.querySelector('.hdr [data-cart-n]')?.textContent.trim(), nb = t.querySelector('[data-xp-n]');
  if (nb && nb.textContent !== (n || '')) nb.textContent = n || ''; if (nb) nb.hidden = !n || n === '0';
}
/* phone menu: one full-screen panel — search, quick actions, picture rows for every category (tap to open its links), account, language, contact */
function langHref(l) { const p = location.pathname.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/, '/satin'); return l === 'en' ? p : p.replace(/^\/satin/, '/satin/' + l); }
function drawer() {
  if (document.querySelector('.xp-dr')) return;
  const items = menu();
  const row = (ic, label, sub, body, href) => body
    ? `<details class="xp-dr-c"><summary><span class="xp-ci">${ic}</span><span><b>${esc(label)}</b><small>${esc(sub)}</small></span><i></i></summary><div class="xp-dr-in">${body}</div></details>`
    : `<a class="xp-dr-c xp-dr-a" href="${href}"><span class="xp-ci">${ic}</span><span><b>${esc(label)}</b><small>${esc(sub)}</small></span><i></i></a>`;
  const el = document.createElement('div'); el.className = 'xp-dr'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', T.menu);
  el.innerHTML = `<div class="xp-dr-head"><a href="${PRE}/" class="xp-dr-logo"><img src="/satin/img/logo.png" alt="Satin Graphic"></a><button type="button" class="xp-dr-x" aria-label="${esc(T.close)}">${UI.x}</button></div>
    <button type="button" class="xp-search xp-dr-s">${UI.search}<span>${esc(T.search)}</span></button>
    <div class="xp-dr-q"><button type="button" data-quote="" class="q">${esc(T.quote)}</button><a href="${WA}" target="_blank" rel="noopener" class="w">${WAICON}<span>${esc(T.wa)}</span></a><a href="${TEL}" class="c"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg><span>${esc(T.call)}</span></a></div>
    <div class="xp-dr-list">${items.map(it => row(catIc(it), it.label, (it.groups || []).map(g => g.label).slice(0, 3).join(' · '),
      `<a class="xp-dr-all" href="${catAll(it)}">${esc(T.see)} ${UI.arrow}</a>` + (it.groups || []).map(g => `<div class="xp-g"><h4>${esc(g.label)}</h4><div class="xp-dr-links">${(g.links || []).filter(l => l.active !== false).map(l => `<a href="${linkHref(l.href)}">${esc(l.label)}${isSoon(l.href) ? ` <span class="cs-badge">${esc(T.soon)}</span>` : ''}</a>`).join('')}</div></div>`).join(''))).join('')}
      ${items.some(i => i.key === 'portfolio') ? '' : row(IC.work, T.nav[4], T.workS, '', loc('/satin/portfolio/'))}${items.some(i => i.key === 'studio') ? '' : row(IC.design, T.nav[5], T.studioS, '', loc('/satin/design-studio/'))}</div>
    <div class="xp-dr-foot"><a href="${loc('/satin/login/')}" class="xp-dr-acc">${UI.user}<span>${esc(T.login)}</span></a>
      <div class="xp-dr-lang" aria-label="${esc(T.lang)}">${[['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['fa', 'فارسی']].map(([l, n]) => `<a href="${langHref(l)}" class="${l === LANG ? 'on' : ''}" lang="${l}">${n}</a>`).join('')}</div>
      <div class="xp-dr-ct"><b>${esc(T.contact)}</b><a href="${TEL}">(905) 695-9147</a><a href="${TEL2}">(905) 962-6222</a><small>${esc(T.hours)}</small></div></div>`;
  document.body.append(el); document.documentElement.classList.add('xp-dr-open'); document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => el.classList.add('on'));
  const close = () => { el.classList.remove('on'); document.documentElement.classList.remove('xp-dr-open'); document.documentElement.style.overflow = ''; setTimeout(() => el.remove(), 250); removeEventListener('keydown', k); };
  const k = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', k);
  el.querySelector('.xp-dr-s').onclick = () => { close(); setTimeout(openSearch, 260); };
  el.addEventListener('click', e => { if (e.target.closest('.xp-dr-x') || e.target.closest('a') || e.target.closest('[data-quote]')) close(); });
  el.querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => { if (d.open) el.querySelectorAll('details').forEach(o => { if (o !== d) o.open = false; }); }));
}
/* the header ☰ button opens the new phone menu instead of the old drawer */
addEventListener('click', e => { const b = e.target.closest?.('.hdr [data-burger]'); if (!b) return; e.preventDefault(); e.stopImmediatePropagation(); drawer(); }, true);
function sheet() {
  if (document.querySelector('.xp-sheet')) return;
  const items = menu();
  const el = document.createElement('div'); el.className = 'xp-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', T.all);
  el.innerHTML = `<div class="xp-sh-head"><b>${esc(T.all)}</b><button type="button" class="xp-sh-x" aria-label="${esc(T.close)}">${UI.x}</button></div>
    <div class="xp-sh-grid">${SERVICES.map(([k, h], i) => `<a href="${loc(h)}"><span class="xp-ic">${IC[k]}</span><span>${esc(T.svc[i])}</span></a>`).join('')}</div>
    <div class="xp-sh-list">${items.map(it => `<details><summary>${esc(it.label)}</summary>${(it.groups || []).map(g => `<div class="xp-g"><h4>${esc(g.label)}</h4>${(g.links || []).filter(l => l.active !== false).map(l => `<a href="${linkHref(l.href)}">${esc(l.label)}</a>`).join('')}</div>`).join('')}</details>`).join('')}</div>`;
  document.body.append(el); document.documentElement.style.overflow = 'hidden';
  const close = () => { el.remove(); document.documentElement.style.overflow = ''; };
  el.addEventListener('click', e => { if (e.target.closest('.xp-sh-x') || e.target.closest('a')) close(); });
  addEventListener('keydown', function k(e) { if (e.key === 'Escape') { close(); removeEventListener('keydown', k); } });
}

/* ---------- home ---------- */
const FLEET = [
  { id: 'sedan', slug: 'sedan', x: 195, y: 513, w: 285, z: 1 }, { id: 'suv', slug: 'suv', x: 480, y: 501, w: 280, z: 2 }, { id: 'van', slug: 'sprinter-van', x: 760, y: 458, w: 330, z: 3 },
  { id: 'pickup', slug: 'pickup-truck', x: 1090, y: 472, w: 350, z: 2 }, { id: 'minivan', slug: 'minivan', x: 1440, y: 498, w: 295, z: 1 }, { id: 'bus', slug: 'bus', x: 187, y: 718, w: 768, z: 1 },
  { id: 'box', slug: 'box-truck', x: 955, y: 750, w: 430, z: 2 }, { id: 'trailer', slug: 'trailer', x: 1385, y: 812, w: 348, z: 1 },
];
function homeHTML() {
  const fleet = FLEET.map(v => `<a class="xh-car" href="${PRE}/vehicle-wraps/estimator/${v.slug}/" style="left:${v.x / 19.2}%;top:${v.y / 10.8}%;width:${v.w / 19.2}%;z-index:${v.z}" aria-label="${esc(T.veh[v.id])} — ${esc(T.price)}"><img src="/themes/explore/v/${v.id}.webp" alt="" decoding="async"><span class="xh-tag">${esc(T.veh[v.id])} <b>${esc(T.price)} →</b></span></a>`).join('');
  return `<section class="xh" data-xp aria-label="${esc(T.h1a + ' ' + T.h1b + ' ' + T.h1c)}"><div class="xh-stage">
      <div class="xh-copy xh-top"><div class="xh-h1">${esc(T.h1a)} <span>${esc(T.h1b)}</span> ${esc(T.h1c)}</div><p>${esc(T.sub)}</p></div>
      <div class="xh-frame"><canvas width="1600" height="900" role="img" aria-label="A plain white van drives through a portal, comes out wrapped and joins a wrapped fleet"></canvas><nav class="xh-fleet" aria-label="${esc(T.endA)}">${fleet}</nav></div>
      <div class="xh-copy xh-end"><div class="xh-h2">${esc(T.endA)} <span>${esc(T.endB)}</span></div></div>
      <div class="xh-hint">${esc(T.scroll)}<i></i></div></div><div class="xh-veil"></div></section>
    <section class="xp-explore" data-xp><div class="wrap">
      <div class="xp-q"><h2>${esc(T.q)}</h2><p>${esc(T.qs)}</p><button type="button" class="xp-cta" data-xp-sheet>${esc(T.all)} ${UI.arrow}</button></div>
      <div class="xp-sec-h"><h3>${esc(T.explore)}</h3><span></span></div>
      <div class="xp-icons">${SERVICES.map(([k, h], i) => `<a href="${loc(h)}"><span class="xp-ic">${IC[k]}</span><span class="xp-l">${esc(T.svc[i])}${isSoon(h) ? ` <span class="cs-badge">${esc(T.soon)}</span>` : ''}</span></a>`).join('')}</div>
      <div class="xp-band"><b>${esc(T.cant)}</b><button type="button" data-xp-sheet>${esc(T.az)} ${UI.arrow}</button><a href="${PRE}/contact/">${esc(T.ask)}</a></div>
      <div class="xp-sec-h"><h3>${esc(T.made)}</h3><span></span><a href="${PRE}/portfolio/">${esc(T.madeS)} ${UI.arrow}</a></div>
      <div class="xp-made">${WORK.map(([img, h], i) => `<a href="${loc(h)}"><img src="${img}" alt="${esc(T.work[i])}" loading="lazy" decoding="async" width="960" height="600"><span>${esc(T.work[i])}</span></a>`).join('')}</div>
    </div></section>`;
}
let heroOff = null;
function home() {
  const main = document.querySelector('#main .page-enter') || document.querySelector('#main');
  if (!HOME_RE.test(location.pathname) || !main) return;
  if (main.querySelector('.xh')) return;
  heroOff?.();
  main.insertAdjacentHTML('afterbegin', homeHTML());
  main.querySelectorAll('[data-xp-sheet]').forEach(b => b.onclick = sheet);
  heroOff = hero(main.querySelector('.xh'));
}
function hero(sec) {
  const small = matchMedia('(max-width: 760px)').matches, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = small ? 197 : 394, DIR = small ? '/themes/explore/m/' : '/themes/explore/d/';
  const cv = sec.querySelector('canvas'), cx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const fleet = sec.querySelector('.xh-fleet'), veil = sec.querySelector('.xh-veil');
  if (still) sec.classList.add('still');
  fleet.querySelectorAll('.xh-car').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault(); a.classList.add('go'); fleet.classList.add('leaving'); veil.classList.add('on');
    setTimeout(() => { location.href = a.href; }, 700);
  }));
  const F = [], src = i => DIR + 'f' + String(i + 1).padStart(3, '0') + '.webp';
  const load = i => { if (!F[i]) { F[i] = new Image(); F[i].decoding = 'async'; F[i].src = src(i); } return F[i]; };
  const ok = im => im && im.complete && im.naturalWidth;
  let cur = -1, tgt = still ? N - 1 : 0, alive = true;
  const draw = i => { let im = F[i]; for (let d = 1; !ok(im) && d < N; d++) im = ok(F[i - d]) ? F[i - d] : F[i + d]; if (ok(im)) { cx.drawImage(im, 0, 0, W, H); cur = i; } };
  const onScroll = () => {
    if (!sec.isConnected) return stop();
    const r = sec.getBoundingClientRect(), t = sec.offsetHeight - innerHeight;
    const p = still ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, t)));
    tgt = Math.round(p * (N - 1));
    sec.style.setProperty('--p', p.toFixed(3));
    sec.classList.toggle('started', p > 0.04);
    sec.classList.toggle('done', p > 0.97);
  };
  const tick = () => { if (!alive) return; if (tgt !== cur) draw(tgt); requestAnimationFrame(tick); };
  load(0).onload = () => draw(tgt); load(N - 1).onload = () => draw(tgt);
  const order = []; for (let i = 0; i < N; i += 4) order.push(i); for (let i = 0; i < N; i++) if (i % 4) order.push(i);
  let k = 0; const pump = () => { if (!alive) return; for (let n = 0; n < 10 && k < order.length; n++, k++) load(order[k]); if (k < order.length) setTimeout(pump, 40); };
  if (still) load(N - 1); else setTimeout(pump, 300);
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll);
  addEventListener('pageshow', () => { veil.classList.remove('on'); fleet.classList.remove('leaving'); fleet.querySelectorAll('.go').forEach(c => c.classList.remove('go')); });
  onScroll(); tick();
  function stop() { alive = false; removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); }
  return stop;
}

/* ---------- keep everything in place across the site's page changes ---------- */
function hdrHeight() { const h = document.querySelector('header.hdr'); if (h) document.documentElement.style.setProperty('--xp-hdr', Math.round(h.getBoundingClientRect().bottom > 0 ? h.offsetHeight : 0) + 'px'); }
const NEW_HOME = false; // the scroll-video home page is kept here but switched off (Mehrad prefers the original home page)
function run() { try { header(); tabs(); syncTabs(); if (NEW_HOME) home(); hdrHeight(); } catch (e) { console.warn('explore theme', e); } }
document.documentElement.classList.add('xp');
run();
let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; run(); }); }).observe(document.body, { childList: true, subtree: true });
addEventListener('popstate', () => setTimeout(run, 60));
addEventListener('resize', hdrHeight);
