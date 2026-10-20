/* Simplified navigation — PREVIEW (opt-in only).
   Turn on:  any page ?preview=nav2   ·   turn off: ?preview=off
   Loaded by site-extras.mjs only when the visitor opted in, so normal visitors never see it.
   - 5 menu items instead of 10, max 5 links per column, "See all" links
   - "Get a price" chooser (what do you need?) in the header and in the mobile bar
   - home page: "What do you need?" picture tiles under the hero
   - mobile: fixed bottom bar (Call · WhatsApp · Get a price · Menu) and a simple accordion menu */
const LANG=(location.pathname.match(/^\/satin\/(fa|fr|es)(?=\/|$)/)||[])[1]||'en';
const RTL=LANG==='fa';
const TEL='tel:+19056959147',WA='https://wa.me/19059626222';
const loc=h=>/^https?:|^tel:/.test(h)||LANG==='en'?h:h.replace(/^\/satin(?=\/|$|\?|#)/,'/satin/'+LANG);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const T={
 en:{veh:'Vehicles',print:'Print & Signs',design:'Design & Price',work:'Our Work',contact:'Contact',price:'Get a price',call:'Call',wa:'WhatsApp',menu:'Menu',close:'Close',all:'See all',
  wraps:'Wraps',protect:'Protect & care',est:'Wrap price estimator',allWraps:'All vehicle wraps',color:'Color change',fleet:'Commercial & fleet',vis:'Wrap visualizer',ppf:'Paint protection film',tint:'Window tint',detail:'Auto detailing',ceramic:'Ceramic coating',book:'Book detailing',
  printC:'Print',bc:'Business cards',fly:'Flyers',bro:'Brochures',door:'Door hangers',signs:'Signs & banners',roll:'Roll-up banners',vinyl:'Vinyl banners',yard:'Yard signs',aframe:'A-frame signs',app:'Apparel & stickers',tee:'T-shirts',hood:'Hoodies',hats:'Hats & caps',stick:'Stickers & labels',win:'Windows & walls',wg:'Window graphics',frost:'Frosted vinyl',ctint:'Commercial tint',wall:'Wallpaper',
  tools:'Tools',studio:'Design Studio',shop:'Shop',temps:'Vehicle templates',designs:'Ready wrap designs',more:'More services',web:'Website design',social:'Social media',video:'Videography',
  reach:'Reach us',cu:'Contact us',track:'Track an order',about:'About us',reviews:'Reviews',faq:'FAQ',warranty:'Warranty',guide:'Artwork guidelines',
  needT:'What do you need?',needS:'Pick one — we’ll take you straight to prices and options.',chooseT:'What do you need a price for?',chooseS:'Choose one and you’ll see prices right away.',other:'Something else',otherS:'Send us a quick request',
  tWrap:'Vehicle wraps',tWrapS:'Color change & full wraps',tFleet:'Commercial & fleet',tFleetS:'Vans, trucks, trailers',tPpf:'PPF & window tint',tPpfS:'Protect paint and glass',tPrint:'Printing',tPrintS:'Cards, flyers, brochures',tSigns:'Signs & banners',tSignsS:'Banners, yard & A-frame signs',tApp:'Apparel',tAppS:'T-shirts, hoodies, hats',tWin:'Windows & walls',tWinS:'Window graphics, wallpaper',tDet:'Auto detailing',tDetS:'Interior, exterior, ceramic',
  prev:'New menu preview',off:'Turn off'},
 fa:{veh:'خودرو',print:'چاپ و تابلو',design:'طراحی و قیمت',work:'نمونه‌کارها',contact:'تماس',price:'دریافت قیمت',call:'تماس',wa:'واتس‌اپ',menu:'منو',close:'بستن',all:'مشاهده همه',
  wraps:'روکش خودرو',protect:'محافظت و نگهداری',est:'محاسبه قیمت روکش',allWraps:'همه روکش‌ها',color:'تغییر رنگ',fleet:'خودروهای تجاری',vis:'پیش‌نمایش روکش',ppf:'محافظ رنگ (PPF)',tint:'دودی شیشه',detail:'دیتیلینگ',ceramic:'سرامیک',book:'رزرو دیتیلینگ',
  printC:'چاپ',bc:'کارت ویزیت',fly:'تراکت',bro:'بروشور',door:'آویز درب',signs:'تابلو و بنر',roll:'رول‌آپ',vinyl:'بنر وینیل',yard:'تابلو حیاط',aframe:'تابلو A',app:'لباس و استیکر',tee:'تی‌شرت',hood:'هودی',hats:'کلاه',stick:'استیکر و لیبل',win:'شیشه و دیوار',wg:'طرح روی شیشه',frost:'وینیل مات',ctint:'دودی ساختمان',wall:'کاغذدیواری',
  tools:'ابزارها',studio:'استودیوی طراحی',shop:'فروشگاه',temps:'قالب خودرو',designs:'طرح‌های آماده',more:'خدمات دیگر',web:'طراحی وب‌سایت',social:'شبکه‌های اجتماعی',video:'فیلم‌برداری',
  reach:'ارتباط با ما',cu:'تماس با ما',track:'پیگیری سفارش',about:'درباره ما',reviews:'نظرات مشتریان',faq:'سؤالات متداول',warranty:'گارانتی',guide:'راهنمای فایل طرح',
  needT:'چه چیزی لازم دارید؟',needS:'یکی را انتخاب کنید؛ مستقیم به قیمت‌ها و گزینه‌ها می‌روید.',chooseT:'قیمت چه چیزی را می‌خواهید؟',chooseS:'یکی را انتخاب کنید تا قیمت‌ها را ببینید.',other:'چیز دیگری',otherS:'یک درخواست کوتاه بفرستید',
  tWrap:'روکش خودرو',tWrapS:'تغییر رنگ و روکش کامل',tFleet:'خودروهای تجاری',tFleetS:'ون، کامیون، تریلر',tPpf:'PPF و دودی شیشه',tPpfS:'محافظت از رنگ و شیشه',tPrint:'چاپ',tPrintS:'کارت ویزیت، تراکت، بروشور',tSigns:'تابلو و بنر',tSignsS:'بنر، تابلو حیاط و A',tApp:'لباس',tAppS:'تی‌شرت، هودی، کلاه',tWin:'شیشه و دیوار',tWinS:'طرح شیشه، کاغذدیواری',tDet:'دیتیلینگ',tDetS:'داخل، بیرون، سرامیک',
  prev:'پیش‌نمایش منوی جدید',off:'خاموش کردن'},
 fr:{veh:'Véhicules',print:'Impression & enseignes',design:'Design & prix',work:'Réalisations',contact:'Contact',price:'Obtenir un prix',call:'Appeler',wa:'WhatsApp',menu:'Menu',close:'Fermer',all:'Tout voir',
  wraps:'Covering',protect:'Protection & soin',est:'Estimateur de prix',allWraps:'Tous les coverings',color:'Changement de couleur',fleet:'Commercial & flotte',vis:'Visualiseur',ppf:'Film de protection (PPF)',tint:'Teinte de vitres',detail:'Esthétique auto',ceramic:'Revêtement céramique',book:'Réserver',
  printC:'Impression',bc:'Cartes d’affaires',fly:'Dépliants',bro:'Brochures',door:'Accroche-portes',signs:'Enseignes & bannières',roll:'Bannières déroulantes',vinyl:'Bannières vinyle',yard:'Pancartes',aframe:'Chevalets',app:'Vêtements & autocollants',tee:'T-shirts',hood:'Kangourous',hats:'Casquettes',stick:'Autocollants & étiquettes',win:'Vitres & murs',wg:'Graphiques de vitrine',frost:'Vinyle givré',ctint:'Teinte commerciale',wall:'Papier peint',
  tools:'Outils',studio:'Studio de création',shop:'Boutique',temps:'Gabarits de véhicules',designs:'Designs prêts',more:'Autres services',web:'Sites web',social:'Réseaux sociaux',video:'Vidéo',
  reach:'Nous joindre',cu:'Nous contacter',track:'Suivre une commande',about:'À propos',reviews:'Avis',faq:'FAQ',warranty:'Garantie',guide:'Guide des fichiers',
  needT:'De quoi avez-vous besoin ?',needS:'Choisissez — nous vous menons directement aux prix et options.',chooseT:'Pour quoi voulez-vous un prix ?',chooseS:'Choisissez et voyez les prix tout de suite.',other:'Autre chose',otherS:'Envoyez-nous une demande rapide',
  tWrap:'Covering de véhicule',tWrapS:'Changement de couleur',tFleet:'Commercial & flotte',tFleetS:'Fourgons, camions, remorques',tPpf:'PPF & teinte',tPpfS:'Protéger peinture et vitres',tPrint:'Impression',tPrintS:'Cartes, dépliants, brochures',tSigns:'Enseignes & bannières',tSignsS:'Bannières, pancartes, chevalets',tApp:'Vêtements',tAppS:'T-shirts, kangourous, casquettes',tWin:'Vitres & murs',tWinS:'Vitrines, papier peint',tDet:'Esthétique auto',tDetS:'Intérieur, extérieur, céramique',
  prev:'Aperçu du nouveau menu',off:'Désactiver'},
 es:{veh:'Vehículos',print:'Impresión y letreros',design:'Diseño y precio',work:'Trabajos',contact:'Contacto',price:'Obtener precio',call:'Llamar',wa:'WhatsApp',menu:'Menú',close:'Cerrar',all:'Ver todo',
  wraps:'Rotulación',protect:'Protección y cuidado',est:'Calculadora de precio',allWraps:'Toda la rotulación',color:'Cambio de color',fleet:'Comercial y flotas',vis:'Visualizador',ppf:'Película protectora (PPF)',tint:'Polarizado',detail:'Detallado de autos',ceramic:'Recubrimiento cerámico',book:'Reservar',
  printC:'Impresión',bc:'Tarjetas de presentación',fly:'Volantes',bro:'Folletos',door:'Colgantes de puerta',signs:'Letreros y pancartas',roll:'Banners roll-up',vinyl:'Lonas de vinilo',yard:'Letreros de jardín',aframe:'Caballetes',app:'Ropa y stickers',tee:'Camisetas',hood:'Sudaderas',hats:'Gorras',stick:'Stickers y etiquetas',win:'Vidrios y paredes',wg:'Gráficos para vidrio',frost:'Vinilo esmerilado',ctint:'Polarizado comercial',wall:'Papel tapiz',
  tools:'Herramientas',studio:'Estudio de diseño',shop:'Tienda',temps:'Plantillas de vehículos',designs:'Diseños listos',more:'Más servicios',web:'Diseño web',social:'Redes sociales',video:'Video',
  reach:'Contáctenos',cu:'Contacto',track:'Rastrear pedido',about:'Nosotros',reviews:'Reseñas',faq:'Preguntas',warranty:'Garantía',guide:'Guía de archivos',
  needT:'¿Qué necesita?',needS:'Elija uno y le llevamos directo a precios y opciones.',chooseT:'¿Para qué quiere un precio?',chooseS:'Elija uno y vea los precios al instante.',other:'Otra cosa',otherS:'Envíenos una solicitud rápida',
  tWrap:'Rotulación de autos',tWrapS:'Cambio de color y completa',tFleet:'Comercial y flotas',tFleetS:'Vans, camiones, remolques',tPpf:'PPF y polarizado',tPpfS:'Proteja pintura y vidrios',tPrint:'Impresión',tPrintS:'Tarjetas, volantes, folletos',tSigns:'Letreros y pancartas',tSignsS:'Lonas, jardín, caballetes',tApp:'Ropa',tAppS:'Camisetas, sudaderas, gorras',tWin:'Vidrios y paredes',tWinS:'Gráficos, papel tapiz',tDet:'Detallado',tDetS:'Interior, exterior, cerámica',
  prev:'Vista previa del menú nuevo',off:'Desactivar'}};
const t=k=>(T[LANG]||T.en)[k]??T.en[k];

// [labelKey, href, featured?]
const MENU=[
 {k:'veh',cols:[
  {h:'wraps',all:'/satin/vehicle-wraps',links:[['est','/satin/vehicle-wraps/estimator',1],['color','/satin/vehicle-wraps/color-change'],['fleet','/satin/vehicle-wraps/commercial'],['vis','/satin/vehicle-wraps/visualizer']]},
  {h:'protect',links:[['ppf','/satin/vehicle-wraps/paint-protection-film'],['tint','/satin/window-tint/vehicle'],['detail','/satin/auto-detailing'],['ceramic','/satin/auto-detailing/ceramic-coating'],['book','/satin/auto-detailing/booking']]}],
  card:{img:'/satin/img/job-tesla-flip-480.webp',k:'est',href:'/satin/vehicle-wraps/estimator'}},
 {k:'print',cols:[
  {h:'printC',all:'/satin/print-shop',links:[['bc','/satin/print-shop/offset/business-cards'],['fly','/satin/print-shop/offset/flyers'],['bro','/satin/print-shop/offset/brochures'],['door','/satin/print-shop/offset/door-hangers']]},
  {h:'signs',all:'/satin/print-shop/large-format',links:[['roll','/satin/print-shop/large-format/roll-up-banner'],['vinyl','/satin/print-shop/large-format/vinyl-banners'],['yard','/satin/print-shop/large-format/yard-signs'],['aframe','/satin/print-shop/large-format/a-frame-signs']]},
  {h:'app',all:'/satin/apparel',links:[['tee','/satin/apparel/t-shirts'],['hood','/satin/apparel/hoodies'],['hats','/satin/apparel/hats'],['stick','/satin/print-shop/labels']]},
  {h:'win',links:[['wg','/satin/window-graphics'],['frost','/satin/window-graphics/frosted-vinyl'],['ctint','/satin/window-tint/commercial'],['wall','/satin/wallpaper']]}]},
 {k:'design',cols:[
  {h:'tools',links:[['price','#price',1],['est','/satin/vehicle-wraps/estimator'],['studio','/satin/design-studio'],['vis','/satin/vehicle-wraps/visualizer']]},
  {h:'shop',all:'/satin/shop',links:[['designs','/satin/shop/vehicle-wrap-designs'],['temps','/satin/shop/vehicle-templates'],['guide','/satin/artwork-guidelines']]},
  {h:'more',links:[['web','/satin/website-design'],['social','/satin/social-media-services'],['video','/satin/videography']]}],
  card:{img:'/satin/img/sg-hero-480.webp',k:'studio',href:'/satin/design-studio'}},
 {k:'work',href:'/satin/portfolio'},
 {k:'contact',cols:[
  {h:'reach',links:[['cu','/satin/contact',1],['call',TEL],['wa',WA],['track','/satin/track']]},
  {h:'about',links:[['about','/satin/about'],['reviews','/satin/reviews'],['faq','/satin/faq'],['warranty','/satin/warranty']]}]}];

const TILES=[
 ['tWrap','tWrapS','/satin/img/job-tesla-flip-480.webp','/satin/vehicle-wraps'],
 ['tFleet','tFleetS','/satin/img/show-van-1-480.webp','/satin/vehicle-wraps/commercial'],
 ['tPpf','tPpfS','/satin/img/install-ppf-480.webp','/satin/vehicle-wraps/paint-protection-film'],
 ['tDet','tDetS','/satin/img/detail-hand-480.webp','/satin/auto-detailing'],
 ['tPrint','tPrintS','/satin/img/pr-bc-1-480.webp','/satin/print-shop'],
 ['tSigns','tSignsS','/satin/img/pr-rollup-480.webp','/satin/print-shop/large-format'],
 ['tApp','tAppS','/satin/img/satin-shirt.optimized.webp','/satin/apparel'],
 ['tWin','tWinS','/satin/img/office-glass-480.webp','/satin/window-graphics']];

const I={
 chev:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
 tag:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
 phone:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/></svg>',
 wa:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.9 11.9 0 004.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 001.8-1.3 2.3 2.3 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
 menu:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 x:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 dots:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></svg>'};

const CSS=`
html.nav2 header.hdr nav.nav,html.nav2 header.hdr [data-burger],html.nav2 header.hdr .studio-entry,html.nav2 header.hdr [data-m-quick],html.nav2 header.hdr .q-desk{display:none!important}
.n2{display:flex;align-items:center;gap:2px;margin-inline:auto}
.n2>button,.n2>a{appearance:none;border:0;background:none;font:inherit;font-size:15px;font-weight:650;color:#1d1d1f;padding:10px 14px;border-radius:999px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;text-decoration:none;white-space:nowrap}
.n2>button:hover,.n2>a:hover,.n2>button[aria-expanded=true]{background:#f2f2f4}
.n2>button[aria-expanded=true] svg{transform:rotate(180deg)}
.n2 svg{transition:transform .2s}
.n2-cta{appearance:none;border:0;cursor:pointer;font:inherit;font-size:14.5px;font-weight:700;color:#fff;background:#c91c50;border-radius:999px;padding:10px 18px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 6px 16px -6px #c91c5099}
.n2-cta:hover{background:#ad1544}
.n2-panel{position:absolute;inset-inline:0;top:100%;background:#fff;border-top:1px solid #eee;box-shadow:0 24px 48px -20px #0f172a40;z-index:60;display:none}
.n2-panel.open{display:block;animation:n2in .18s ease-out}
@keyframes n2in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.n2-in{max-width:1200px;margin:0 auto;padding:28px 24px 30px;display:flex;gap:40px}
.n2-col{min-width:180px}
.n2-col h4{margin:0 0 10px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#737378;font-weight:700}
.n2-col a{display:block;padding:7px 0;color:#1d1d1f;text-decoration:none;font-size:15.5px;font-weight:550}
.n2-col a:hover{color:#c91c50}
.n2-col a.n2f{color:#c91c50;font-weight:700;border:0;background:none;padding-inline:0}
.n2-col a.all{font-size:14px;color:#737378;font-weight:600;margin-top:4px}
.n2-col a.all:hover{color:#c91c50}
.n2-card{margin-inline-start:auto;align-self:flex-start;width:260px;border-radius:16px;overflow:hidden;background:#f6f6f7;text-decoration:none;color:#1d1d1f;display:flex;flex-direction:column}
.n2-card img{width:100%;height:150px;object-fit:cover;display:block}
.n2-card span{padding:12px 14px;font-weight:700;display:flex;align-items:center;justify-content:space-between;gap:8px}
.n2-scrim{position:fixed;inset:0;background:#0f172a33;z-index:40;display:none}
.n2-scrim.open{display:block}
.n2-tiles{max-width:1200px;margin:34px auto 10px;padding:0 24px}
.n2-tiles h2{font-size:clamp(24px,3vw,34px);margin:0 0 4px;letter-spacing:-.01em}
.n2-tiles p.sub{margin:0 0 18px;color:#737378}
.n2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.n2-tile{position:relative;display:block;border-radius:18px;overflow:hidden;background:#eee;aspect-ratio:4/3;text-decoration:none;color:#fff;box-shadow:0 10px 24px -14px #0f172a66;transition:transform .2s}
.n2-tile:hover{transform:translateY(-3px)}
.n2-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.n2-tile::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0000 35%,#000b)}
.n2-tile b,.n2-tile small{position:absolute;inset-inline:14px;z-index:1}
.n2-tile b{bottom:30px;font-size:17px}
.n2-tile small{bottom:12px;font-size:12.5px;opacity:.9}
.n2-ov{position:fixed;inset:0;z-index:2100;background:#0f172acc;display:none;align-items:center;justify-content:center;padding:16px}
.n2-ov.open{display:flex}
.n2-box{background:#fff;border-radius:22px;width:min(760px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:22px}
.n2-bh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.n2-box h3{margin:0;font-size:22px}
.n2-box p{margin:4px 0 0;color:#737378}
.n2-x{border:0;background:#f3f4f6;border-radius:999px;width:40px;height:40px;display:grid;place-items:center;cursor:pointer;flex:none}
.n2-ch{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.n2-ch a,.n2-ch button{display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #ececf0;border-radius:14px;text-decoration:none;color:#1d1d1f;background:#fff;font:inherit;text-align:start;cursor:pointer}
.n2-ch a:hover,.n2-ch button:hover{border-color:#c91c50;background:#fff7fa}
.n2-ch img{width:54px;height:54px;border-radius:10px;object-fit:cover;flex:none}
.n2-ch .ic{width:54px;height:54px;border-radius:10px;background:#f6f6f7;display:grid;place-items:center;color:#c91c50;flex:none}
.n2-ch b{display:block;font-size:15px}
.n2-ch small{display:block;color:#737378;font-size:12.5px;margin-top:2px}
.n2-bar,.n2-drawer{display:none}
.n2-pv{position:fixed;inset-inline-start:14px;bottom:14px;z-index:2050;background:#1d1d1f;color:#fff;border-radius:999px;padding:7px 8px 7px 14px;font-size:12.5px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 20px #0004}
.n2-pv a{color:#1d1d1f;background:#fff;border-radius:999px;padding:4px 10px;text-decoration:none;font-weight:700}
@media (max-width:1100px){.n2>button,.n2>a{padding:9px 10px;font-size:14.5px}.n2-in{gap:26px}.n2-card{display:none}}
@media (max-width:900px){
 .n2,header .n2-cta,.n2-panel{display:none!important}
 html.nav2 .sx-fab{display:none!important}
 html.nav2{--scw-lift:70px}
 html.nav2 body{padding-bottom:calc(66px + env(safe-area-inset-bottom))}
 .n2-bar{display:grid;grid-template-columns:repeat(4,1fr);position:fixed;inset-inline:0;bottom:0;z-index:1995;background:#fff;border-top:1px solid #e9e9ee;padding:6px 6px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -8px 24px -16px #0f172a55}
 .n2-bar a,.n2-bar button{appearance:none;border:0;background:none;font:inherit;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;font-weight:650;color:#1d1d1f;text-decoration:none;padding:6px 2px;border-radius:12px;cursor:pointer}
 .n2-bar .pr{color:#fff;background:#c91c50}
 .n2-bar .wa{color:#128c4b}
 .n2-drawer{position:fixed;inset:0;z-index:2090;background:#fff;flex-direction:column}
 .n2-drawer.open{display:flex}
 .n2-dh{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee;font-weight:800;font-size:18px}
 .n2-db{overflow:auto;padding:6px 16px 120px;flex:1}
 .n2-db details{border-bottom:1px solid #f0f0f2}
 .n2-db summary{list-style:none;display:flex;justify-content:space-between;align-items:center;padding:16px 2px;font-size:18px;font-weight:750;cursor:pointer}
 .n2-db summary::-webkit-details-marker{display:none}
 .n2-db details[open] summary svg{transform:rotate(180deg)}
 .n2-db .grp{padding:0 2px 12px}
 .n2-db .grp h4{margin:10px 0 4px;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:#737378}
 .n2-db .grp a{display:block;padding:9px 0;font-size:16px;color:#1d1d1f;text-decoration:none}
 .n2-db .grp a.n2f{color:#c91c50;font-weight:700;border:0;background:none;padding-inline:0}
 .n2-db .grp a.all{color:#737378;font-size:14.5px}
 .n2-db>a{display:block;padding:16px 2px;font-size:18px;font-weight:750;color:#1d1d1f;text-decoration:none;border-bottom:1px solid #f0f0f2}
 .n2-dcta{display:flex;gap:10px;padding:16px 2px}
 .n2-dcta a,.n2-dcta button{flex:1;justify-content:center}
 .n2-grid{grid-template-columns:repeat(2,1fr);gap:10px}
 .n2-tiles{padding:0 16px;margin-top:24px}
 .n2-tile b{font-size:15px;bottom:28px}
 .n2-tile small{font-size:11.5px}
 .n2-ch{grid-template-columns:1fr 1fr}
 .n2-ch img,.n2-ch .ic{width:44px;height:44px}
 .n2-pv{bottom:calc(76px + env(safe-area-inset-bottom))}
}
@media (max-width:420px){.n2-ch{grid-template-columns:1fr}}
`;

const linkHTML=([k,h,f])=>h==='#price'?`<a href="#" data-n2-price class="${f?'n2f':''}">${esc(t(k))}</a>`:`<a href="${esc(loc(h))}"${/^https?:/.test(h)?' target="_blank" rel="noopener"':''} class="${f?'n2f':''}">${esc(t(k))}</a>`;
const colHTML=c=>`<div class="n2-col"><h4>${esc(t(c.h))}</h4>${c.links.map(linkHTML).join('')}${c.all?`<a class="all" href="${esc(loc(c.all))}">${esc(t('all'))} ${RTL?'←':'→'}</a>`:''}</div>`;
const panelHTML=m=>`<div class="n2-panel" data-n2-panel="${m.k}" role="region" aria-label="${esc(t(m.k))}"><div class="n2-in">${m.cols.map(colHTML).join('')}${m.card?`<a class="n2-card" href="${esc(loc(m.card.href))}"><img src="${m.card.img}" alt="" loading="lazy"><span>${esc(t(m.card.k))}${I.arrow}</span></a>`:''}</div></div>`;

function chooserHTML(){return `<div class="n2-ov" data-n2-ov role="dialog" aria-modal="true" aria-label="${esc(t('chooseT'))}"><div class="n2-box"><div class="n2-bh"><div><h3>${esc(t('chooseT'))}</h3><p>${esc(t('chooseS'))}</p></div><button type="button" class="n2-x" data-n2-close aria-label="${esc(t('close'))}">${I.x}</button></div><div class="n2-ch">${TILES.map(([a,b,img,h])=>`<a href="${esc(loc(h==='/satin/vehicle-wraps'?'/satin/vehicle-wraps/estimator':h))}"><img src="${img}" alt="" loading="lazy"><span><b>${esc(t(a))}</b><small>${esc(t(b))}</small></span></a>`).join('')}<button type="button" data-n2-other><span class="ic">${I.dots}</span><span><b>${esc(t('other'))}</b><small>${esc(t('otherS'))}</small></span></button></div></div></div>`;}
function drawerHTML(){return `<div class="n2-drawer" data-n2-drawer role="dialog" aria-modal="true" aria-label="${esc(t('menu'))}"><div class="n2-dh"><span>${esc(t('menu'))}</span><button type="button" class="n2-x" data-n2-close aria-label="${esc(t('close'))}">${I.x}</button></div><div class="n2-db"><div class="n2-dcta"><button type="button" class="n2-cta" data-n2-price>${I.tag}${esc(t('price'))}</button></div>${MENU.map(m=>m.cols?`<details><summary>${esc(t(m.k))}${I.chev}</summary>${m.cols.map(c=>`<div class="grp"><h4>${esc(t(c.h))}</h4>${c.links.map(linkHTML).join('')}${c.all?`<a class="all" href="${esc(loc(c.all))}">${esc(t('all'))} ${RTL?'←':'→'}</a>`:''}</div>`).join('')}</details>`:`<a href="${esc(loc(m.href))}">${esc(t(m.k))}</a>`).join('')}</div></div>`;}
function barHTML(){return `<nav class="n2-bar" aria-label="${esc(t('menu'))}"><a href="${TEL}">${I.phone}<span>${esc(t('call'))}</span></a><a class="wa" href="${WA}" target="_blank" rel="noopener">${I.wa}<span>${esc(t('wa'))}</span></a><button type="button" class="pr" data-n2-price>${I.tag}<span>${esc(t('price'))}</span></button><button type="button" data-n2-menu>${I.menu}<span>${esc(t('menu'))}</span></button></nav>`;}
function tilesHTML(){return `<section class="n2-tiles" data-n2-tiles><h2>${esc(t('needT'))}</h2><p class="sub">${esc(t('needS'))}</p><div class="n2-grid">${TILES.map(([a,b,img,h])=>`<a class="n2-tile" href="${esc(loc(h))}"><img src="${img}" alt="" loading="lazy"><b>${esc(t(a))}</b><small>${esc(t(b))}</small></a>`).join('')}</div></section>`;}

let openKey='';
function closePanels(){openKey='';document.querySelectorAll('.n2-panel.open').forEach(p=>p.classList.remove('open'));document.querySelectorAll('.n2>button[aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'));document.querySelector('.n2-scrim')?.classList.remove('open');}
function togglePanel(k){const was=openKey===k;closePanels();if(was)return;openKey=k;document.querySelector(`[data-n2-panel="${k}"]`)?.classList.add('open');document.querySelector(`.n2>button[data-n2="${k}"]`)?.setAttribute('aria-expanded','true');document.querySelector('.n2-scrim')?.classList.add('open');}
function openOv(sel){closePanels();document.querySelector(sel)?.classList.add('open');document.documentElement.style.overflow='hidden';}
function closeOv(){document.querySelectorAll('.n2-ov.open,.n2-drawer.open').forEach(e=>e.classList.remove('open'));document.documentElement.style.overflow='';}

function mountHeader(){const hdr=document.querySelector('header.hdr');const bar=hdr?.querySelector('.bar');if(!bar||bar.querySelector('.n2'))return;
 const nav=document.createElement('nav');nav.className='n2';nav.setAttribute('aria-label','Main');
 nav.innerHTML=MENU.map(m=>m.cols?`<button type="button" data-n2="${m.k}" aria-expanded="false">${esc(t(m.k))}${I.chev}</button>`:`<a href="${esc(loc(m.href))}">${esc(t(m.k))}</a>`).join('');
 const old=bar.querySelector('nav.nav');if(old)old.after(nav);else bar.querySelector('.logo')?.after(nav);
 const right=bar.querySelector('.right');if(right&&!right.querySelector('.n2-cta')){const b=document.createElement('button');b.type='button';b.className='n2-cta';b.dataset.n2Price='';b.innerHTML=I.tag+esc(t('price'));const q=right.querySelector('.q-desk');if(q)q.after(b);else right.prepend(b);}
 if(!hdr.querySelector('.n2-panel'))hdr.insertAdjacentHTML('beforeend',MENU.filter(m=>m.cols).map(panelHTML).join(''));}
function mountOnce(){if(document.querySelector('.n2-ov'))return;document.body.insertAdjacentHTML('beforeend','<div class="n2-scrim" data-n2-scrim></div>'+chooserHTML()+drawerHTML()+barHTML()+`<div class="n2-pv">${esc(t('prev'))}<a href="?preview=off">${esc(t('off'))}</a></div>`);}
function mountTiles(){if(!/^\/satin(\/(fa|fr|es))?\/?$/.test(location.pathname)||document.querySelector('[data-n2-tiles]'))return;const hero=document.querySelector('main section.hhero');if(hero)hero.insertAdjacentHTML('afterend',tilesHTML());}
function mount(){try{mountHeader();mountOnce();mountTiles();}catch(e){console.warn('nav2',e);}}

document.documentElement.classList.add('nav2');
const st=document.createElement('style');st.id='n2-css';st.textContent=CSS;document.head.appendChild(st);
document.addEventListener('click',e=>{const el=e.target.closest('[data-n2],[data-n2-price],[data-n2-menu],[data-n2-close],[data-n2-other],[data-n2-scrim],.n2-ov,.n2-panel a,.n2-drawer a');if(!el){if(openKey&&!e.target.closest('.n2-panel'))closePanels();return;}
 if(el.matches('[data-n2]')){e.preventDefault();togglePanel(el.dataset.n2);return;}
 if(el.matches('[data-n2-price]')){e.preventDefault();closeOv();openOv('[data-n2-ov]');return;}
 if(el.matches('[data-n2-menu]')){e.preventDefault();openOv('[data-n2-drawer]');return;}
 if(el.matches('[data-n2-close],[data-n2-scrim]')){closeOv();closePanels();return;}
 if(el.matches('[data-n2-other]')){closeOv();const q=document.querySelector('header.hdr .q-desk,[data-quote]');q?.click();return;}
 if(el.matches('.n2-ov')&&e.target===el){closeOv();return;}
 if(el.matches('.n2-panel a,.n2-drawer a')){closePanels();closeOv();}},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePanels();closeOv();}});
mount();
new MutationObserver(()=>{if(!document.querySelector('header.hdr .n2')||(!document.querySelector('[data-n2-tiles]')&&document.querySelector('main section.hhero')))mount();}).observe(document.body,{childList:true,subtree:true});
