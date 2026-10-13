/* Satin Graphic — Wrap Visualizer.
   2D photo recolouring of our own studio vehicle photos. Each vehicle ships:
   <id>.webp (photo on the studio backdrop), <id>-maps.webp (R: paint shading, G: reflections, B: studio horizon map)
   and <id>-mask.webp (R: paint, G: glass, B: wheel faces). Rebuild with scripts/visualizer/build_cars.py; film list: visualizer/films.json. */
import { vehicleFromPhoto, splitCar, feather, blur, refineMask } from './photo-maps.mjs';
const BASE = '/visualizer/';
const BRAND_LOGOS = { '3m': '/satin/img/brands/3m.svg', avery: '/satin/img/brands/avery-dennison.png', kpmf: '/satin/img/brands/kpmf.png', oracal: '/satin/img/brands/orafol.svg' };
const W = 1600, H = 900;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const VEHICLES = [
  { id: 'tesla', name: 'Electric sedan', quote: 'Tesla / EV', est: 'sedan' },
  { id: 'sedan', name: 'Sedan', quote: 'Sedan', est: 'sedan' },
  { id: 'coupe', name: 'Coupe / sports car', quote: 'Coupe / sports car', est: 'sedan' },
  { id: 'suv', name: 'Compact SUV', quote: 'SUV', est: 'suv' },
  { id: 'suvxl', name: 'Full-size SUV', quote: 'SUV', est: 'suv' },
  { id: 'pickup', name: 'Pickup truck', quote: 'Pickup Truck', est: 'pickup-truck' },
  { id: 'minivan', name: 'Minivan', quote: 'Minivan', est: 'minivan' },
  { id: 'van', name: 'Cargo van', quote: 'Transit Van', est: 'transit-van' },
  { id: 'sprinter', name: 'High-roof van', quote: 'Sprinter Van', est: 'sprinter-van' },
];
/* Make → model → stock photo, filled from visualizer/stock/stock.json at mount. */
const MODELS = {};
const FINISHES = [
  ['gloss', 'Gloss'], ['gloss-metallic', 'Gloss Metallic'], ['satin', 'Satin'], ['satin-metallic', 'Satin Metallic'], ['matte', 'Matte'], ['matte-metallic', 'Matte Metallic'],
  ['pearl', 'Pearl'], ['diamond', 'Diamond'], ['chrome', 'Chrome'], ['brushed', 'Brushed'], ['colorflow', 'Colour-flow'], ['carbon', 'Carbon'],
];
const FAMILIES = [['black', '#111'], ['white', '#f4f4f2'], ['grey', '#6f7377'], ['silver', '#c3c6c9'], ['red', '#b3141d'], ['orange', '#e5631c'], ['yellow', '#f2c200'], ['green', '#2f8a3c'], ['blue', '#1d4fa0'], ['purple', '#5a2d7a'], ['pink', '#df5f97'], ['brown', '#5a3d2b'], ['gold', '#b2903f'], ['bronze', '#7d5a38'], ['copper', '#9b5232'], ['flip', 'linear-gradient(135deg,#6a2a8a,#1f8a6a)']];
const TINTS = [['factory', 'Factory', 0], ['70', '70%', .22], ['50', '50%', .42], ['35', '35%', .6], ['20', '20%', .76], ['5', '5%', .9]];
const WHEELS = [['factory', 'Factory', null], ['gloss-black', 'Gloss black', ['#0c0c0e', 'gloss']], ['satin-black', 'Satin black', ['#1a1a1c', 'satin']], ['gunmetal', 'Gunmetal', ['#3c3f44', 'satin']], ['bronze', 'Bronze', ['#7a5a33', 'gloss']], ['silver', 'Silver', ['#c4c7ca', 'gloss']], ['white', 'White', ['#e9e9e7', 'gloss']]];

/* Small UI dictionary. Anything missing falls back to English. */
const UI = {
  fa: { 'Wrap Visualizer': 'شبیه‌ساز رپ', Manufacturers: 'برندها', All: 'همه', Colours: 'رنگ‌ها', 'Search colour or film code': 'جستجوی رنگ یا کد فیلم', Finish: 'نوع پوشش', 'Colour family': 'خانواده رنگ', 'Window tint': 'تینت شیشه', Factory: 'کارخانه', 'Clear filters': 'پاک کردن فیلترها', Vehicle: 'خودرو', Make: 'برند خودرو', Model: 'مدل', Year: 'سال', 'Get custom quote': 'دریافت قیمت', 'Share build': 'اشتراک‌گذاری', Download: 'دانلود', Wheels: 'رینگ‌ها', 'Driver side': 'سمت راننده', 'Passenger side': 'سمت سرنشین', 'Body style': 'نوع بدنه', 'Choose colour': 'انتخاب رنگ', 'No films match these filters.': 'فیلمی با این فیلترها پیدا نشد.', 'Link copied': 'لینک کپی شد', 'Open the price estimator': 'تخمین قیمت', Done: 'تأیید', "Ontario law: front side windows must let through enough light for the driver to be seen. Ask us which shade is legal for your vehicle.": "طبق قانون انتاریو، شیشه‌های جلوی کناری باید آن‌قدر نور عبور دهند که راننده دیده شود. از ما بپرسید کدام درصد برای خودروی شما قانونی است.", "Vehicle preview": "پیش‌نمایش خودرو", "Before": "قبل", "After": "بعد", "Before / After": "قبل / بعد", "Drop your photo here": "عکس را اینجا رها کنید", "The AI runs in your browser — your photo is not uploaded anywhere.": "هوش مصنوعی داخل مرورگر شما اجرا می‌شود — عکس شما جایی آپلود نمی‌شود.", "Edit selection": "ویرایش محدوده", "Tap the car to add a painted panel. Switch to Remove and tap windows, lights, trim or anything that should not be wrapped.": "روی خودرو بزنید تا یک قطعه رنگ‌شده اضافه شود. برای حذف، «حذف» را انتخاب کنید و روی شیشه، چراغ، تزئینات یا هر چیزی که نباید رپ شود بزنید.", "Add": "افزودن", "Remove": "حذف", "Undo": "برگرداندن", "On-screen colours are approximate. Visit our Vaughan shop to see the physical swatch before you decide.": "رنگ‌های روی صفحه تقریبی هستند. قبل از تصمیم، نمونه واقعی را در شاپ ما در وان ببینید.", "Your car": "خودروی شما", "Upload your car": "عکس خودروی خودتان", "JPG or PNG photo": "عکس JPG یا PNG", "Your photo": "عکس شما", "Other": "سایر", "This vehicle could not load. Please try again.": "این خودرو بارگذاری نشد. دوباره امتحان کنید.", "Loading the AI model…": "در حال بارگذاری هوش مصنوعی…", "Please choose a JPG or PNG photo.": "لطفاً یک عکس JPG یا PNG انتخاب کنید.", "This photo could not be opened. Please use a JPG or PNG.": "این عکس باز نشد. لطفاً از JPG یا PNG استفاده کنید.", "Analysing your photo…": "در حال تحلیل عکس…", "Finding the painted panels…": "در حال پیدا کردن بدنه رنگ‌شده…", "We could not find the car automatically. Tap the car to select it.": "خودرو به‌طور خودکار پیدا نشد. روی خودرو بزنید تا انتخاب شود.", "Done! Use Edit selection if a panel is missing.": "آماده است! اگر قطعه‌ای جا مانده، از «ویرایش محدوده» استفاده کنید.", "The AI could not start on this device. Try another browser or a smaller photo.": "هوش مصنوعی روی این دستگاه اجرا نشد. مرورگر دیگر یا عکس کوچک‌تری را امتحان کنید.", "Nothing found there. Try tapping the middle of the panel.": "چیزی آن‌جا پیدا نشد. وسط قطعه را بزنید.", "That did not work. Please try again.": "انجام نشد. دوباره امتحان کنید.", "Link copied — your photo stays on your device": "لینک کپی شد — عکس شما فقط روی دستگاه خودتان می‌ماند", "Electric sedan": "سدان برقی", "Sedan": "سدان", "Coupe / sports car": "کوپه / اسپرت", "Compact SUV": "شاسی‌بلند کامپکت", "Full-size SUV": "شاسی‌بلند بزرگ", "Pickup truck": "وانت پیکاپ", "Minivan": "مینی‌ون", "Cargo van": "ون باری", "High-roof van": "ون سقف‌بلند", "Gloss black": "مشکی براق", "Satin black": "مشکی ساتن", "Gunmetal": "نوک‌مدادی", "Bronze": "برنزی", "Silver": "نقره‌ای", "White": "سفید", "Upload a photo of your own car or pick a popular model, then preview hundreds of 3M, Avery Dennison, KPMF and ORACAL colour-change films with real reflections and shading. Compare before and after, then send the build to us for a custom quote.": "عکس خودروی خودتان را آپلود کنید یا یک مدل محبوب انتخاب کنید، سپس صدها فیلم تغییر رنگ 3M، Avery Dennison، KPMF و ORACAL را با انعکاس و سایه واقعی ببینید. قبل و بعد را مقایسه کنید و طرح را برای دریافت قیمت برای ما بفرستید." },
  fr: { 'Wrap Visualizer': 'Visualiseur de covering', Manufacturers: 'Fabricants', All: 'Tous', Colours: 'Couleurs', 'Search colour or film code': 'Rechercher une couleur ou un code', Finish: 'Finition', 'Colour family': 'Famille de couleur', 'Window tint': 'Teinte des vitres', Factory: 'D’origine', 'Clear filters': 'Effacer les filtres', Vehicle: 'Véhicule', Make: 'Marque', Model: 'Modèle', Year: 'Année', 'Get custom quote': 'Obtenir un devis', 'Share build': 'Partager', Download: 'Télécharger', Wheels: 'Jantes', 'Driver side': 'Côté conducteur', 'Passenger side': 'Côté passager', 'Body style': 'Carrosserie', 'Choose colour': 'Choisir la couleur', 'No films match these filters.': 'Aucun film ne correspond à ces filtres.', 'Link copied': 'Lien copié', 'Open the price estimator': 'Estimer le prix', Done: 'OK', "Ontario law: front side windows must let through enough light for the driver to be seen. Ask us which shade is legal for your vehicle.": "Loi ontarienne : les vitres latérales avant doivent laisser passer assez de lumière pour que le conducteur soit visible. Demandez-nous quelle teinte est légale pour votre véhicule.", "Vehicle preview": "Aperçu du véhicule", "Before": "Avant", "After": "Après", "Before / After": "Avant / Après", "Drop your photo here": "Déposez votre photo ici", "The AI runs in your browser — your photo is not uploaded anywhere.": "L’IA fonctionne dans votre navigateur — votre photo n’est envoyée nulle part.", "Edit selection": "Modifier la sélection", "Tap the car to add a painted panel. Switch to Remove and tap windows, lights, trim or anything that should not be wrapped.": "Touchez la voiture pour ajouter un panneau peint. Passez à Retirer et touchez les vitres, phares, garnitures ou tout ce qui ne doit pas être recouvert.", "Add": "Ajouter", "Remove": "Retirer", "Undo": "Annuler", "On-screen colours are approximate. Visit our Vaughan shop to see the physical swatch before you decide.": "Les couleurs à l’écran sont approximatives. Venez voir l’échantillon réel à notre atelier de Vaughan avant de décider.", "Your car": "Votre voiture", "Upload your car": "Importer votre voiture", "JPG or PNG photo": "Photo JPG ou PNG", "Your photo": "Votre photo", "Other": "Autre", "This vehicle could not load. Please try again.": "Ce véhicule n’a pas pu se charger. Réessayez.", "Loading the AI model…": "Chargement du modèle d’IA…", "Please choose a JPG or PNG photo.": "Choisissez une photo JPG ou PNG.", "This photo could not be opened. Please use a JPG or PNG.": "Impossible d’ouvrir cette photo. Utilisez un JPG ou un PNG.", "Analysing your photo…": "Analyse de votre photo…", "Finding the painted panels…": "Détection des panneaux peints…", "We could not find the car automatically. Tap the car to select it.": "Nous n’avons pas trouvé la voiture automatiquement. Touchez-la pour la sélectionner.", "Done! Use Edit selection if a panel is missing.": "C’est prêt ! Utilisez Modifier la sélection s’il manque un panneau.", "The AI could not start on this device. Try another browser or a smaller photo.": "L’IA n’a pas pu démarrer sur cet appareil. Essayez un autre navigateur ou une photo plus petite.", "Nothing found there. Try tapping the middle of the panel.": "Rien trouvé ici. Touchez le milieu du panneau.", "That did not work. Please try again.": "Cela n’a pas fonctionné. Réessayez.", "Link copied — your photo stays on your device": "Lien copié — votre photo reste sur votre appareil", "Electric sedan": "Berline électrique", "Sedan": "Berline", "Coupe / sports car": "Coupé / sportive", "Compact SUV": "VUS compact", "Full-size SUV": "VUS pleine grandeur", "Pickup truck": "Camionnette", "Minivan": "Fourgonnette", "Cargo van": "Fourgon utilitaire", "High-roof van": "Fourgon à toit surélevé", "Gloss black": "Noir brillant", "Satin black": "Noir satiné", "Gunmetal": "Gris canon", "Bronze": "Bronze", "Silver": "Argent", "White": "Blanc", "Upload a photo of your own car or pick a popular model, then preview hundreds of 3M, Avery Dennison, KPMF and ORACAL colour-change films with real reflections and shading. Compare before and after, then send the build to us for a custom quote.": "Importez une photo de votre voiture ou choisissez un modèle populaire, puis essayez des centaines de films 3M, Avery Dennison, KPMF et ORACAL avec de vrais reflets et ombrages. Comparez avant/après, puis envoyez-nous votre configuration pour un devis." },
  es: { 'Wrap Visualizer': 'Visualizador de wrap', Manufacturers: 'Fabricantes', All: 'Todos', Colours: 'Colores', 'Search colour or film code': 'Buscar color o código', Finish: 'Acabado', 'Colour family': 'Familia de color', 'Window tint': 'Polarizado', Factory: 'De fábrica', 'Clear filters': 'Borrar filtros', Vehicle: 'Vehículo', Make: 'Marca', Model: 'Modelo', Year: 'Año', 'Get custom quote': 'Pedir cotización', 'Share build': 'Compartir', Download: 'Descargar', Wheels: 'Rines', 'Driver side': 'Lado conductor', 'Passenger side': 'Lado pasajero', 'Body style': 'Carrocería', 'Choose colour': 'Elegir color', 'No films match these filters.': 'Ningún vinilo coincide con estos filtros.', 'Link copied': 'Enlace copiado', 'Open the price estimator': 'Estimar precio', Done: 'Listo', "Ontario law: front side windows must let through enough light for the driver to be seen. Ask us which shade is legal for your vehicle.": "Ley de Ontario: las ventanas laterales delanteras deben dejar pasar suficiente luz para ver al conductor. Pregúntenos qué tono es legal para su vehículo.", "Vehicle preview": "Vista previa del vehículo", "Before": "Antes", "After": "Después", "Before / After": "Antes / Después", "Drop your photo here": "Suelte su foto aquí", "The AI runs in your browser — your photo is not uploaded anywhere.": "La IA funciona en su navegador: su foto no se sube a ningún sitio.", "Edit selection": "Editar selección", "Tap the car to add a painted panel. Switch to Remove and tap windows, lights, trim or anything that should not be wrapped.": "Toque el auto para añadir un panel pintado. Cambie a Quitar y toque ventanas, luces, molduras o lo que no deba forrarse.", "Add": "Añadir", "Remove": "Quitar", "Undo": "Deshacer", "On-screen colours are approximate. Visit our Vaughan shop to see the physical swatch before you decide.": "Los colores en pantalla son aproximados. Visite nuestro taller en Vaughan para ver la muestra real antes de decidir.", "Your car": "Su auto", "Upload your car": "Suba su auto", "JPG or PNG photo": "Foto JPG o PNG", "Your photo": "Su foto", "Other": "Otro", "This vehicle could not load. Please try again.": "Este vehículo no se pudo cargar. Inténtelo de nuevo.", "Loading the AI model…": "Cargando el modelo de IA…", "Please choose a JPG or PNG photo.": "Elija una foto JPG o PNG.", "This photo could not be opened. Please use a JPG or PNG.": "No se pudo abrir esta foto. Use un JPG o PNG.", "Analysing your photo…": "Analizando su foto…", "Finding the painted panels…": "Buscando los paneles pintados…", "We could not find the car automatically. Tap the car to select it.": "No encontramos el auto automáticamente. Tóquelo para seleccionarlo.", "Done! Use Edit selection if a panel is missing.": "¡Listo! Use Editar selección si falta un panel.", "The AI could not start on this device. Try another browser or a smaller photo.": "La IA no pudo iniciarse en este dispositivo. Pruebe otro navegador o una foto más pequeña.", "Nothing found there. Try tapping the middle of the panel.": "No se encontró nada. Toque el centro del panel.", "That did not work. Please try again.": "No funcionó. Inténtelo de nuevo.", "Link copied — your photo stays on your device": "Enlace copiado: su foto se queda en su dispositivo", "Electric sedan": "Sedán eléctrico", "Sedan": "Sedán", "Coupe / sports car": "Cupé / deportivo", "Compact SUV": "SUV compacto", "Full-size SUV": "SUV grande", "Pickup truck": "Camioneta pickup", "Minivan": "Minivan", "Cargo van": "Furgoneta de carga", "High-roof van": "Furgoneta de techo alto", "Gloss black": "Negro brillante", "Satin black": "Negro satinado", "Gunmetal": "Gris plomo", "Bronze": "Bronce", "Silver": "Plateado", "White": "Blanco", "Upload a photo of your own car or pick a popular model, then preview hundreds of 3M, Avery Dennison, KPMF and ORACAL colour-change films with real reflections and shading. Compare before and after, then send the build to us for a custom quote.": "Suba una foto de su auto o elija un modelo popular y pruebe cientos de vinilos 3M, Avery Dennison, KPMF y ORACAL con reflejos y sombras reales. Compare antes y después y envíenos su diseño para una cotización." },
};

/* ---------- colour maths ---------- */
const toLin = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
const LIN = new Float32Array(256).map((_, i) => toLin(i));
const SRGB = new Uint8ClampedArray(4096).map((_, i) => { const v = i / 4095; return Math.round(255 * (v <= .0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - .055)); });
const enc = v => SRGB[v <= 0 ? 0 : v >= 1 ? 4095 : (v * 4095) | 0];
const hexLin = h => { const n = parseInt(h.slice(1), 16); return [LIN[n >> 16 & 255], LIN[n >> 8 & 255], LIN[n & 255]]; };
function hueShift([r, g, b], deg) { // rotate hue in linear RGB (cheap YIQ rotation)
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const y = .299 * r + .587 * g + .114 * b, i = .596 * r - .274 * g - .322 * b, q = .211 * r - .523 * g + .312 * b;
  const i2 = i * c - q * s, q2 = i * s + q * c;
  return [Math.max(0, y + .956 * i2 + .621 * q2), Math.max(0, y - .272 * i2 - .647 * q2), Math.max(0, y - 1.106 * i2 + 1.703 * q2)];
}
const hash = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };

/* ---------- vehicle data ---------- */
const cache = new Map();
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => no(new Error('Image failed: ' + src)); i.src = src; });
function pixels(img, w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; }
export function loadVehicle(id) {
  if (cache.has(id)) return cache.get(id);
  const dir = id.startsWith('stock:') ? BASE + 'stock/' + id.slice(6) : BASE + 'cars/' + id;
  const p = Promise.all([loadImg(dir + '.webp'), loadImg(dir + '-maps.webp'), loadImg(dir + '-mask.webp')]).then(([photo, maps, mask]) => {
    const W = photo.naturalWidth, H = photo.naturalHeight; // studio side views are 1600×900, stock cars 1536×1024
    const base = pixels(photo, W, H), mp = pixels(maps, W, H), mk = pixels(mask, W, H);
    const paint = [], glass = [], rim = [];
    for (let i = 0, p = 0; i < W * H; i++, p += 4) { if (mk[p] > 3) paint.push(i); if (mk[p + 1] > 3) glass.push(i); if (mk[p + 2] > 3) rim.push(i); }
    const N = paint.length, D = new Float32Array(N), S = new Float32Array(N), E = new Float32Array(N), M = new Float32Array(N), X = new Float32Array(N), Y = new Float32Array(N), R = new Float32Array(N);
    const Sfull = new Float32Array(W * H);
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let k = 0; k < N; k++) {
      const i = paint[k], p = i * 4, x = i % W, y = (i / W) | 0;
      const d = mp[p] / 255, s = mp[p + 1] / 255;
      D[k] = d * d * 1.3; S[k] = s * s; E[k] = mp[p + 2] / 255; M[k] = mk[p] / 255; Sfull[i] = S[k]; R[k] = hash(x, y);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    for (let k = 0; k < N; k++) { const i = paint[k]; X[k] = (i % W - x0) / Math.max(1, x1 - x0); Y[k] = (((i / W) | 0) - y0) / Math.max(1, y1 - y0); }
    const pick = arr => { const o = new Float32Array(N); for (let k = 0; k < N; k++) o[k] = arr[paint[k]]; return o; };
    const S5 = pick(blur(Sfull, W, H, 3, 3)), S14 = pick(blur(Sfull, W, H, 8, 8)), SX = pick(blur(Sfull, W, H, 14, 1)), S40 = pick(blur(Sfull, W, H, 22, 22));
    // directional brushed-metal streaks (long in x, fine in y)
    const streak = new Float32Array(W * H); for (let i = 0; i < W * H; i++) streak[i] = hash(i % W, (i / W) | 0);
    const BR = pick(blur(streak, W, H, 22, 0));
    // wheel faces
    const RM = new Float32Array(rim.length), RL = new Float32Array(rim.length); let rmax = [];
    for (let k = 0; k < rim.length; k++) { const p = rim[k] * 4; RM[k] = mk[p + 2] / 255; RL[k] = (LIN[base[p]] + LIN[base[p + 1]] + LIN[base[p + 2]]) / 3; if (k % 7 === 0) rmax.push(RL[k]); }
    rmax.sort((a, b) => a - b); const rnorm = 1 / Math.max(.05, rmax[Math.floor(rmax.length * .9)] || 1);
    for (let k = 0; k < RL.length; k++) RL[k] = Math.min(1.3, RL[k] * rnorm);
    const GM = new Float32Array(glass.length); for (let k = 0; k < glass.length; k++) GM[k] = mk[glass[k] * 4 + 1] / 255;
    return { W, H, base, paint: Uint32Array.from(paint), glass: Uint32Array.from(glass), rim: Uint32Array.from(rim), D, S, E, M, X, Y, R, S5, S14, SX, S40, BR, RM, RL, GM };
  });
  cache.set(id, p); p.catch(() => cache.delete(id));
  return p;
}

/* ---------- renderer ---------- */
export function render(v, out, st) {
  const o = out.data; o.set(v.base); const VW = v.W || W;
  const f = st.film, fin = f.finish, c = hexLin(f.hex), c2 = f.hex2 ? hexLin(f.hex2) : null;
  const flowSatin = /satin|matt/i.test(f.name), lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  const metal = /metallic/.test(fin), sheen = fin.startsWith('satin') ? 1 : fin.startsWith('matte') ? 2 : 0;
  const pearlC = hueShift(c, lum > .5 ? 28 : 40);
  const chromeTint = (() => { const m = Math.max(c[0], c[1], c[2], .001); return [c[0] / m, c[1] / m, c[2] / m].map(x => .25 + .75 * x); })();
  const { paint, D, S, E, M, X, Y, R, S5, S14, SX, S40, BR } = v;
  for (let k = 0; k < paint.length; k++) {
    const p = paint[k] * 4, d = D[k], n = R[k];
    let r, g, b, spec, cr = c[0], cg = c[1], cb = c[2];
    if (fin === 'colorflow') { // hue travels across the body with position and panel angle
      let t = .55 * X[k] + .35 * (1 - Math.min(1, d)) + .3 * (E[k] - .5) - .1 * Y[k]; t = Math.min(1, Math.max(0, t * 1.15 - .05)); t = t * t * (3 - 2 * t);
      cr = c[0] + (c2[0] - c[0]) * t; cg = c[1] + (c2[1] - c[1]) * t; cb = c[2] + (c2[2] - c[2]) * t;
    } else if (fin === 'pearl') { const t = Math.min(1, Math.max(0, (1.05 - d) * .9 + .25 * (E[k] - .4))); cr += (pearlC[0] - cr) * t * .55; cg += (pearlC[1] - cg) * t * .55; cb += (pearlC[2] - cb) * t * .55; }
    if (fin === 'chrome') {
      let env = E[k] * 1.12 + S[k] * .85 + (d - 1) * .25; env = env < 0 ? 0 : env;
      const val = .025 + 1.08 * Math.pow(Math.min(1.4, env), 2.1);
      r = chromeTint[0] * val; g = chromeTint[1] * val; b = chromeTint[2] * val;
    } else {
      let dif = d, sp;
      // rough films scatter the clear-coat's ~4% Fresnel reflection broadly: a neutral sheen that follows the light each
      // panel receives (D) and faces the studio ceiling (E). Invisible on light colours, it is what shapes matte/satin black.
      // Their reflections are the gloss reflections blurred wide: soft gradients that follow the panels, dark where nothing reflects.
      const shine = d * (.6 + .4 * E[k]), wide = S40 ? S40[k] : S14[k];
      if (fin === 'matte' || fin === 'matte-metallic' || (fin === 'colorflow' && /matt/i.test(f.name))) { dif = .32 + .68 * d; sp = .62 * wide + .1 * S14[k] + .012 * shine + .003; }
      else if (sheen === 1 || fin === 'pearl' || fin === 'brushed' || (fin === 'colorflow' && flowSatin)) { dif = .07 + .93 * d; sp = (fin === 'brushed' ? .45 * SX[k] + .3 * wide : .32 * S14[k] + .4 * wide + .22 * S5[k]) + .008 * shine + .002; }
      else sp = S[k];
      if (metal || fin === 'brushed') { // metallic flake + flop: brighter facing panels, darker edges, coloured highlights
        const flake = (n - .5) * (fin.startsWith('matte') ? .22 : .16);
        dif = dif * (1 + flake) * (.8 + .3 * Math.min(1, d));
        if (fin === 'brushed') dif *= .82 + .36 * BR[k];
        sp *= 1.1;
      }
      if (fin === 'carbon') { // 2x2 twill weave
        const i = paint[k], x = i % VW, y = (i / VW) | 0, u = ((x + y) >> 3) & 1, w = ((x - y + 4096) >> 3) & 1, cell = (u ^ w) ? .62 + .38 * (((x >> 1) & 3) / 3) : .45 + .4 * (((y >> 1) & 3) / 3);
        dif *= cell * 1.15; sp *= .55 + .45 * cell;
      }
      if (fin === 'diamond') { sp = S[k]; if (n > .993) sp += (n - .993) * 70 * (.15 + E[k] * E[k]); dif *= 1 + (n - .5) * .1; }
      const tint = metal || fin === 'brushed' ? .55 : 0; // metallic highlights pick up the film colour
      spec = sp;
      r = cr * dif + spec * (1 - tint + tint * cr / Math.max(.02, lum + .02) * .6);
      g = cg * dif + spec * (1 - tint + tint * cg / Math.max(.02, lum + .02) * .6);
      b = cb * dif + spec * (1 - tint + tint * cb / Math.max(.02, lum + .02) * .6);
    }
    const m = M[k], im = 1 - m;
    o[p] = o[p] * im + enc(r) * m; o[p + 1] = o[p + 1] * im + enc(g) * m; o[p + 2] = o[p + 2] * im + enc(b) * m;
  }
  const t = (TINTS.find(x => x[0] === st.tint) || TINTS[0])[2];
  if (t) for (let k = 0; k < v.glass.length; k++) {
    const p = v.glass[k] * 4, a = t * v.GM[k];
    for (let ch = 0; ch < 3; ch++) { const x = o[p + ch]; o[p + ch] = x * (1 - a) + Math.max(0, x - 200) * a * .9 + 6 * a; }
  }
  const wh = (WHEELS.find(x => x[0] === st.wheel) || WHEELS[0])[2];
  if (wh) {
    const wc = hexLin(wh[0]), gl = wh[1] === 'gloss' ? .9 : .3;
    for (let k = 0; k < v.rim.length; k++) {
      const p = v.rim[k] * 4, L = v.RL[k], m = v.RM[k], sp = Math.max(0, L - .7) * gl;
      const sh = Math.pow(L, 1.15) * .85 + .05;
      o[p] = o[p] * (1 - m) + enc(wc[0] * sh + sp) * m; o[p + 1] = o[p + 1] * (1 - m) + enc(wc[1] * sh + sp) * m; o[p + 2] = o[p + 2] * (1 - m) + enc(wc[2] * sh + sp) * m;
    }
  }
}

/* ---------- page ---------- */
export function pageHTML(lang = 'en') {
  const t = k => UI[lang]?.[k] || k;
  return `<section class="wv" data-wrap-visualizer data-lang="${esc(lang)}">
  <div class="wv-intro wrap"><nav class="wv-crumbs" aria-label="Breadcrumb"><a href="/satin/">Home</a><span>/</span><a href="/satin/vehicle-wraps/">Vehicle Wraps</a><span>/</span><b>${esc(t('Wrap Visualizer'))}</b></nav>
    <h1 class="wv-h1">${esc(t('Wrap Visualizer'))}</h1><p class="wv-lede">${esc(t('Upload a photo of your own car or pick a popular model, then preview hundreds of 3M, Avery Dennison, KPMF and ORACAL colour-change films with real reflections and shading. Compare before and after, then send the build to us for a custom quote.'))}</p></div>
  <div class="wv-app" data-wv-app><p class="wv-loading">Loading the visualizer…</p><noscript><p>The Wrap Visualizer needs JavaScript. <a href="/satin/vehicle-wraps/color-change/">See our colour change wraps</a>.</p></noscript></div>
  </section>`;
}

export async function mount(root, opts = {}) {
  const section = root.matches?.('[data-wrap-visualizer]') ? root : root.querySelector('[data-wrap-visualizer]');
  if (!section || section._wv) return; section._wv = true;
  if (!document.querySelector('link[href^="/visualizer/visualizer.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/visualizer/visualizer.css'; document.head.append(l); }
  const lang = opts.lang || section.dataset.lang || 'en', t = k => UI[lang]?.[k] || k;
  const app = section.querySelector('[data-wv-app]');
  let data, stock = [];
  try {
    const [d, s] = await Promise.all([fetch(BASE + 'films.json').then(r => r.json()), fetch(BASE + 'stock/stock.json').then(r => r.ok ? r.json() : { cars: [] }).catch(() => ({ cars: [] }))]);
    data = d; stock = Array.isArray(s.cars) ? s.cars : [];
  } catch { app.innerHTML = '<p class="wv-loading">The visualizer could not load. Please refresh the page.</p>'; return; }
  // studio photos of popular models: they also answer the make / model pickers
  const stockById = Object.fromEntries(stock.map(c => ['stock:' + c.id, c]));
  for (const c of stock) { MODELS[c.make] = MODELS[c.make] || {}; MODELS[c.make][c.model] = 'stock:' + c.id; }
  const films = data.films, brands = data.brands, byId = Object.fromEntries(films.map(f => [f.id, f]));
  const q = new URLSearchParams(location.search);
  const isStudio = () => false; // the old side-view studio bodies are retired: every car is a real model photo
  const valid = id => !!stockById[id];
  const st = {
    vehicle: valid(q.get('vehicle')) ? q.get('vehicle') : stock.length ? 'stock:' + stock[0].id : 'tesla',
    film: byId[q.get('film')] || byId['3m-s12'] || films[0],
    tint: TINTS.some(x => x[0] === q.get('tint')) ? q.get('tint') : 'factory',
    wheel: WHEELS.some(x => x[0] === q.get('wheels')) ? q.get('wheels') : 'factory',
    side: q.get('side') === 'passenger' ? 'passenger' : 'driver',
    make: MODELS[q.get('make')] ? q.get('make') : '', model: (q.get('model') || '').slice(0, 60), year: /^(19|20)\d\d$/.test(q.get('year') || '') ? q.get('year') : '',
    brand: 'all', finish: 'all', family: 'all', search: '',
  };
  if (stockById[st.vehicle] && !st.make) { st.make = stockById[st.vehicle].make; st.model = stockById[st.vehicle].model; }
  const year0 = new Date().getFullYear() + 1;
  const count = pred => films.filter(pred).length;
  const icon = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  app.innerHTML = `
  <aside class="wv-side" data-wv-side aria-label="${esc(t('Colours'))}">
    <button type="button" class="wv-sheet-handle" data-wv-sheet aria-expanded="false"><span class="wv-sheet-dot" data-wv-sheetdot></span><span><b data-wv-sheetname></b><small>${esc(t('Choose colour'))}</small></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 15l6-6 6 6"/></svg></button>
    <div class="wv-side-in">
      <div class="wv-group"><h2 class="wv-h">${esc(t('Manufacturers'))}</h2><div class="wv-chips wv-brands" data-wv-brand>${[['all', t('All')], ...Object.entries(brands).map(([k, b]) => [k, b.name])].map(([k, n], i) => `<button type="button" data-v="${esc(k)}" aria-pressed="${i === 0}" title="${esc(n)}">${BRAND_LOGOS[k] ? `<img src="${BRAND_LOGOS[k]}" alt="${esc(n)}" loading="lazy">` : esc(n)}</button>`).join('')}</div></div>
      <div class="wv-group"><h2 class="wv-h">${esc(t('Colours'))}</h2>
        <label class="wv-search">${icon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}<input type="search" data-wv-search placeholder="${esc(t('Search colour or film code'))}" aria-label="${esc(t('Search colour or film code'))}"></label>
        <h3 class="wv-sub">${esc(t('Finish'))}</h3><div class="wv-chips small" data-wv-finish><button type="button" data-v="all" aria-pressed="true">${esc(t('All'))} <i>${films.length}</i></button>${FINISHES.map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="false">${esc(n)} <i>${count(f => f.finish === k)}</i></button>`).join('')}</div>
        <h3 class="wv-sub">${esc(t('Colour family'))}</h3><div class="wv-fams" data-wv-family><button type="button" data-v="all" aria-pressed="true">${esc(t('All'))}</button>${FAMILIES.map(([k, c]) => `<button type="button" data-v="${k}" aria-pressed="false" title="${esc(k)}"><span style="background:${c}"></span>${esc(k[0].toUpperCase() + k.slice(1))}</button>`).join('')}</div>
        <button type="button" class="wv-clear" data-wv-clear>${esc(t('Clear filters'))}</button>
        <div class="wv-list" data-wv-list role="listbox" aria-label="${esc(t('Colours'))}"></div>
        <p class="wv-note">${esc(data.note)}</p>
      </div>
      <div class="wv-group"><h2 class="wv-h">${esc(t('Window tint'))}</h2><div class="wv-chips" data-wv-tint>${TINTS.map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${k === st.tint}">${esc(k === 'factory' ? t('Factory') : n)}</button>`).join('')}</div><p class="wv-note">${esc(t('Ontario law: front side windows must let through enough light for the driver to be seen. Ask us which shade is legal for your vehicle.'))}</p></div>
      <button type="button" class="btn block wv-done" data-wv-sheet-close>${esc(t('Done'))}</button>
    </div>
  </aside>
  <div class="wv-main">
    <div class="wv-bar">
      <label class="wv-sel"><span>${esc(t('Make'))}</span><select data-wv-make><option value="">—</option>${Object.keys(MODELS).sort((a, b) => a.localeCompare(b)).map(m => `<option ${m === st.make ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="wv-sel"><span>${esc(t('Model'))}</span><select data-wv-model></select></label>
      <label class="wv-sel"><span>${esc(t('Year'))}</span><select data-wv-year><option value="">—</option>${Array.from({ length: 40 }, (_, i) => year0 - i).map(y => `<option ${String(y) === st.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      <button type="button" class="btn wv-quote" data-wv-quote>${esc(t('Get custom quote'))}</button>
    </div>
    <figure class="wv-stage" data-wv-stage>
      <div class="wv-canvas" data-wv-wrap>
        <canvas width="${W}" height="${H}" data-wv-canvas role="img" aria-label="${esc(t('Vehicle preview'))}"></canvas>
        <canvas class="wv-before" data-wv-before aria-hidden="true" hidden></canvas>
        <canvas class="wv-selcv" data-wv-sel aria-hidden="true" hidden></canvas>
        <div class="wv-ba" data-wv-ba hidden><span class="wv-ba-l">${esc(t('Before'))}</span><span class="wv-ba-r">${esc(t('After'))}</span><span class="wv-ba-line"></span><span class="wv-ba-h" data-wv-ba-h role="slider" tabindex="0" aria-label="${esc(t('Before / After'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">${icon('<path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/>')}</span></div>
        <img class="wv-mark" src="${BASE}satin-mark.png" alt="Satin Graphic" width="483" height="78" decoding="async">
        <div class="wv-drop" aria-hidden="true"><b>${esc(t('Drop your photo here'))}</b></div>
        <div class="wv-up" data-wv-up hidden><div class="wv-up-in"><span class="wv-up-spin"></span><b data-wv-up-msg></b><div class="wv-up-bar"><i data-wv-up-bar></i></div><small>${esc(t('The AI runs in your browser — your photo is not uploaded anywhere.'))}</small></div></div>
        <div class="wv-spin" data-wv-spin hidden></div>
      </div>
      <figcaption class="wv-title"><span class="wv-line" data-wv-line></span><b data-wv-name></b><span class="wv-meta" data-wv-meta></span></figcaption>
      <div class="wv-tools">
        <button type="button" class="wv-tool" data-wv-compare aria-pressed="false">${icon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>')}<span>${esc(t('Before / After'))}</span></button>
        <button type="button" class="wv-tool" data-wv-editsel hidden>${icon('<path d="M4 20l4-1 11-11-3-3L5 16z"/>')}<span>${esc(t('Edit selection'))}</span></button>
      </div>
      <div class="wv-views" data-wv-side-toggle role="group" aria-label="View"><button type="button" data-v="driver" aria-pressed="true">${esc(t('Driver side'))}</button><button type="button" data-v="passenger" aria-pressed="false">${esc(t('Passenger side'))}</button></div>
      <div class="wv-actions"><button type="button" class="wv-act" data-wv-share>${icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>')}${esc(t('Share build'))}</button><button type="button" class="wv-act dark" data-wv-download>${icon('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>')}${esc(t('Download'))}</button></div>
      <span class="wv-toast" data-wv-toast role="status" aria-live="polite"></span>
    </figure>
    <div class="wv-edit" data-wv-edit hidden><p>${esc(t('Tap the car to add a painted panel. Switch to Remove and tap windows, lights, trim or anything that should not be wrapped.'))}</p><div class="wv-edit-btns"><div class="wv-seg" role="group"><button type="button" data-wv-emode="add" aria-pressed="true">${icon('<path d="M12 5v14M5 12h14"/>')}${esc(t('Add'))}</button><button type="button" data-wv-emode="remove" aria-pressed="false">${icon('<path d="M5 12h14"/>')}${esc(t('Remove'))}</button></div><button type="button" class="wv-tool" data-wv-eundo disabled>${icon('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>')}${esc(t('Undo'))}</button><button type="button" class="wv-tool dark" data-wv-edone>${esc(t('Done'))}</button></div></div>
    <p class="wv-disclaimer" data-wv-disc>${esc(t('On-screen colours are approximate. Visit our Vaughan shop to see the physical swatch before you decide.'))}</p>
    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/*" data-wv-file hidden>
    <div class="wv-row"><h2 class="wv-h">${esc(t('Your car'))}</h2><div class="wv-cars" data-wv-cars>
      <button type="button" class="wv-upcard" data-wv-upload><span class="wv-upicon">${icon('<path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3M12 4v12M7 9l5-5 5 5"/>')}</span><span>${esc(t('Upload your car'))}</span><small>${esc(t('JPG or PNG photo'))}</small></button>
      <button type="button" class="wv-mine" data-v="upload" data-wv-mine hidden><img data-wv-mineimg alt="" width="150" height="70"><span>${esc(t('Your photo'))}</span></button>
      ${stock.map(c => `<button type="button" class="wv-stockcar" data-make="${esc(c.make)}" data-v="stock:${esc(c.id)}" aria-pressed="${'stock:' + c.id === st.vehicle}"><img src="${BASE}stock/${esc(c.id)}-thumb.webp" alt="" width="150" height="70" loading="lazy"><span>${esc(c.make)} <b>${esc(c.model)}</b></span></button>`).join('')}
    </div></div>
    <div class="wv-row" data-wv-wheelrow><h2 class="wv-h">${esc(t('Wheels'))}</h2><div class="wv-wheels" data-wv-wheels>${WHEELS.map(([k, n, w]) => `<button type="button" data-v="${k}" aria-pressed="${k === st.wheel}"><span class="wv-rim" style="--rim:${w ? w[0] : '#a3a6a9'}"></span>${esc(t(n))}</button>`).join('')}</div></div>
    <p class="wv-est"><a data-wv-est href="/satin/vehicle-wraps/estimator/">${esc(t('Open the price estimator'))} →</a></p>
  </div>`;

  const $ = s => app.querySelector(s), $$ = s => [...app.querySelectorAll(s)];
  const stage = $('[data-wv-stage]'), wrap = $('[data-wv-wrap]');
  const canvas = $('[data-wv-canvas]'), ctx = canvas.getContext('2d');
  const beforeCv = $('[data-wv-before]'), selCv = $('[data-wv-sel]'), baEl = $('[data-wv-ba]'), baH = $('[data-wv-ba-h]');
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const bctx = buf.getContext('2d');
  let current = null, frame = 0, seq = 0, compare = false, editing = false, emode = 'add', beforeKey = '';
  let makeFilter = '';
  let upl = null; // the visitor's own photo: { id, w, h, rgba, paint, glass, hist, thumb }
  const filmLabel = f => `${brands[f.brand].name} ${f.name}${f.code ? ' (' + f.code + ')' : ''}`;
  const flipped = () => st.side === 'passenger' && isStudio(st.vehicle);

  function fillModels() {
    const sel = $('[data-wv-model]'), list = st.make ? Object.keys(MODELS[st.make]) : [];
    sel.innerHTML = `<option value="">—</option>${list.map(m => `<option ${m === st.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}${st.model && st.make && !list.includes(st.model) ? `<option selected>${esc(st.model)}</option>` : ''}${st.make ? `<option value="__other">${esc(t('Other'))}</option>` : ''}`;
    sel.disabled = !st.make;
  }
  function filtered() {
    const s = st.search.trim().toLowerCase().replace(/[\s-]+/g, '');
    return films.filter(f => (st.brand === 'all' || f.brand === st.brand) && (st.finish === 'all' || f.finish === st.finish) && (st.family === 'all' || f.family === st.family) &&
      (!s || (f.name + (f.code || '') + brands[f.brand].name + f.finish).toLowerCase().replace(/[\s-]+/g, '').includes(s)));
  }
  function swatchBG(f) { // a lit sphere, like a film sample ball
    const shade = 'radial-gradient(circle at 68% 78%,transparent 30%,rgba(0,0,0,.42) 78%)';
    if (f.hex2) return `radial-gradient(circle at 30% 26%,rgba(255,255,255,.55),transparent 38%),${shade},linear-gradient(135deg,${f.hex},${f.hex2})`;
    if (f.finish === 'carbon') return `radial-gradient(circle at 30% 26%,rgba(255,255,255,.35),transparent 40%),${shade},repeating-linear-gradient(45deg,${f.hex} 0 3px,#3a3d42 3px 6px)`;
    if (f.finish === 'chrome') return `radial-gradient(circle at 30% 26%,#fff,transparent 30%),linear-gradient(170deg,#fff 0%,${f.hex} 30%,#1b1b1d 50%,${f.hex} 68%,#f4f4f4 100%)`;
    if (f.finish === 'brushed') return `radial-gradient(circle at 30% 26%,rgba(255,255,255,.4),transparent 42%),${shade},repeating-linear-gradient(0deg,${f.hex} 0 1px,rgba(255,255,255,.22) 1px 2px),${f.hex}`;
    const gl = /^gloss|pearl|diamond/.test(f.finish) ? 'rgba(255,255,255,.7),transparent 26%' : f.finish.startsWith('satin') ? 'rgba(255,255,255,.32),transparent 46%' : 'rgba(255,255,255,.12),transparent 55%';
    const flake = /metallic|diamond|pearl/.test(f.finish) ? ',repeating-conic-gradient(rgba(255,255,255,.07) 0 3deg,transparent 3deg 7deg)' : '';
    return `radial-gradient(circle at 30% 26%,${gl}),${shade}${flake},${f.hex}`;
  }
  function drawList() {
    const list = filtered(), box = $('[data-wv-list]');
    if (!list.length) { box.innerHTML = `<p class="wv-empty">${esc(t('No films match these filters.'))}</p>`; return; }
    const groups = new Map(); for (const f of list) { if (!groups.has(f.family)) groups.set(f.family, []); groups.get(f.family).push(f); }
    const order = FAMILIES.map(x => x[0]);
    box.innerHTML = [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([fam, fs]) => `<h3 class="wv-fam">${esc(fam)}</h3>${fs.map(f => `<button type="button" role="option" class="wv-film" data-film="${esc(f.id)}" aria-selected="${f.id === st.film.id}"><span class="wv-sw" style="background:${swatchBG(f)}"></span><span class="wv-fn"><b>${esc(f.name)}</b><small>${esc(brands[f.brand].name)} · ${esc((FINISHES.find(x => x[0] === f.finish) || [, f.finish])[1])}</small>${f.code ? `<small class="wv-code">${esc(f.code)}</small>` : ''}</span></button>`).join('')}`).join('');
  }
  function vehInfo() {
    if (st.vehicle === 'upload') { const b = MODELS[st.make]?.[st.model], s = b && stockById[b]; return { name: t('Your photo'), quote: s ? s.quote : 'Sedan', est: s ? s.est : '' }; }
    const s = stockById[st.vehicle]; if (s) return { name: s.make + ' ' + s.model, quote: s.quote, est: s.est };
    const c0 = stock[0] || { make: '', model: '', quote: 'Sedan', est: 'sedan' }; return { name: c0.make + ' ' + c0.model, quote: c0.quote, est: c0.est };
  }
  function syncUI() {
    const f = st.film, b = brands[f.brand];
    $('[data-wv-line]').textContent = b.name + ' · ' + b.line;
    $('[data-wv-name]').textContent = f.name;
    $('[data-wv-meta]').textContent = [(FINISHES.find(x => x[0] === f.finish) || [, f.finish])[1], f.code].filter(Boolean).join(' · ');
    $('[data-wv-sheetname]').textContent = f.name; $('[data-wv-sheetdot]').style.background = swatchBG(f);
    $$('[data-film]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.film === f.id)));
    for (const [sel, val] of [['[data-wv-tint]', st.tint], ['[data-wv-wheels]', st.wheel], ['[data-wv-cars]', st.vehicle], ['[data-wv-side-toggle]', st.side], ['[data-wv-brand]', st.brand], ['[data-wv-finish]', st.finish], ['[data-wv-family]', st.family]])
      $$(sel + ' [data-v]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === val)));
    $$('.wv-stockcar').forEach(b => { b.hidden = !!makeFilter && b.dataset.make !== makeFilter; }); // the car row follows a brand picked in the menu
    const veh = vehInfo();
    $('[data-wv-est]').href = (location.pathname.match(/^\/satin\/(fa|fr|es)\//) ? location.pathname.slice(0, 10) : '/satin/') + 'vehicle-wraps/estimator/' + (veh.est ? veh.est + '/' : '');
    const p = new URLSearchParams(); if (st.vehicle !== 'upload') p.set('vehicle', st.vehicle); p.set('film', f.id);
    if (st.tint !== 'factory') p.set('tint', st.tint); if (st.wheel !== 'factory') p.set('wheels', st.wheel); if (st.side !== 'driver') p.set('side', st.side);
    if (st.make) p.set('make', st.make); if (st.model) p.set('model', st.model); if (st.year) p.set('year', st.year);
    try { history.replaceState(history.state, '', location.pathname + '?' + p); } catch {}
  }
  function layout(v) { // stage shape follows the photo; studio-only tools hide on photos
    stage.style.setProperty('--ar', v.W + ' / ' + v.H); stage.style.setProperty('--arn', (v.W / v.H).toFixed(4));
    stage.classList.toggle('is-photo', !isStudio(st.vehicle)); stage.classList.toggle('is-upload', st.vehicle === 'upload');
    $('[data-wv-side-toggle]').hidden = !isStudio(st.vehicle);
    $('[data-wv-wheelrow]').hidden = !v.rim.length;
    $('[data-wv-editsel]').hidden = st.vehicle !== 'upload';
  }
  function paint() {
    if (!current) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const v = current, w = v.W, h = v.H;
      for (const c of [canvas, buf]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const img = bctx.createImageData(w, h); render(v, img, st); bctx.putImageData(img, 0, 0);
      ctx.save(); ctx.clearRect(0, 0, w, h); if (flipped()) { ctx.translate(w, 0); ctx.scale(-1, 1); } ctx.drawImage(buf, 0, 0); ctx.restore();
      if (compare) drawBefore();
    });
  }
  function drawBefore() {
    const v = current; if (!v) return;
    const key = st.vehicle + (flipped() ? ':p' : '') + ':' + v.W + 'x' + v.H + (v === upl?.v ? ':' + upl.id : '');
    if (key === beforeKey) return; beforeKey = key;
    beforeCv.width = v.W; beforeCv.height = v.H; const g = beforeCv.getContext('2d');
    const tmp = document.createElement('canvas'); tmp.width = v.W; tmp.height = v.H; tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(v.base), v.W, v.H), 0, 0);
    g.save(); if (flipped()) { g.translate(v.W, 0); g.scale(-1, 1); } g.drawImage(tmp, 0, 0); g.restore();
  }
  async function setVehicle(id) {
    if (editing) setEdit(false);
    st.vehicle = id;
    const s = stockById[id]; if (s) { st.make = s.make; st.model = s.model; $('[data-wv-make]').value = s.make; fillModels(); }
    syncUI(); const my = ++seq; const spin = $('[data-wv-spin]'); spin.hidden = false;
    try {
      const v = id === 'upload' ? upl?.v : await loadVehicle(id);
      if (my !== seq || !v) return; current = v; layout(v); paint();
    } catch (e) { console.error(e); toast(t('This vehicle could not load. Please try again.')); }
    finally { if (my === seq) spin.hidden = true; }
    // warm the next likely choices
    const ids = stock.map(c => 'stock:' + c.id), at = ids.indexOf(id);
    if (at >= 0) ids.slice(at + 1, at + 3).forEach((n, i) => setTimeout(() => loadVehicle(n).catch(() => {}), 1500 + i * 1500));
  }
  let tt; function toast(msg) { const el = $('[data-wv-toast]'); el.textContent = msg; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2600); }
  const update = () => { syncUI(); paint(); };

  /* ---------- before / after ---------- */
  function setBA(pct) { pct = Math.max(0, Math.min(100, pct)); wrap.style.setProperty('--ba', pct + '%'); baH.setAttribute('aria-valuenow', String(Math.round(pct))); }
  function setCompare(on) {
    compare = on; beforeCv.hidden = baEl.hidden = !on; wrap.classList.toggle('comparing', on);
    $('[data-wv-compare]').setAttribute('aria-pressed', String(on));
    if (!on) return;
    if (editing) setEdit(false);
    beforeKey = ''; drawBefore();
    // a short sweep so it is obvious the divider can be dragged
    const t0 = performance.now(), path = [[0, 50], [450, 78], [1000, 24], [1450, 50]];
    const step = now => { if (!compare || dragging) return; const e = now - t0; let i = 1; while (i < path.length - 1 && e > path[i][0]) i++; const [a, pa] = path[i - 1], [b, pb] = path[i], k = Math.min(1, (e - a) / (b - a)), s = k * k * (3 - 2 * k); setBA(pa + (pb - pa) * s); if (e < path[path.length - 1][0]) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  let dragging = false;
  const baFromEvent = e => { const r = wrap.getBoundingClientRect(); setBA((e.clientX - r.left) / r.width * 100); };
  baEl.addEventListener('pointerdown', e => { dragging = true; baEl.setPointerCapture(e.pointerId); baFromEvent(e); e.preventDefault(); });
  baEl.addEventListener('pointermove', e => { if (dragging) baFromEvent(e); });
  baEl.addEventListener('pointerup', () => { dragging = false; }); baEl.addEventListener('pointercancel', () => { dragging = false; });
  baH.addEventListener('keydown', e => { const cur = parseFloat(baH.getAttribute('aria-valuenow')) || 50, d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : 0; if (d) { e.preventDefault(); setBA(cur + d); } else if (e.key === 'Home') setBA(0); else if (e.key === 'End') setBA(100); });

  /* ---------- the visitor's own photo: Segment Anything in a worker ---------- */
  let worker = null, wseq = 0; const pending = new Map();
  function samWorker() {
    if (worker) return worker;
    worker = new Worker(BASE + 'sam-worker.mjs', { type: 'module' });
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress') { if (loadingModel) upMsg(t('Loading the AI model…') + (m.pct < 100 ? ' ' + m.pct + '%' : ''), m.pct); return; }
      const p = pending.get(m.seq); if (!p) return; pending.delete(m.seq);
      if (m.type === 'error') p.no(new Error(m.message)); else p.ok(m);
    };
    worker.onerror = e => { e.preventDefault?.(); for (const p of pending.values()) p.no(new Error(e.message || 'AI worker failed')); pending.clear(); worker = null; };
    return worker;
  }
  const ask = (msg, transfer = []) => new Promise((ok, no) => { const s = ++wseq; pending.set(s, { ok, no }); try { samWorker().postMessage({ ...msg, seq: s }, transfer); } catch (e) { pending.delete(s); no(e); } });
  let loadingModel = false;
  const upEl = $('[data-wv-up]');
  function upMsg(msg, pct) { upEl.hidden = false; $('[data-wv-up-msg]').textContent = msg; const bar = $('[data-wv-up-bar]'); bar.parentElement.hidden = pct == null; if (pct != null) bar.style.width = Math.max(3, Math.min(100, pct)) + '%'; }
  const upHide = () => { upEl.hidden = true; };
  const planeOf = (m, k) => m.data.subarray(k * m.w * m.h, (k + 1) * m.w * m.h);
  function stats(mask, w, h) { let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0; for (let i = 0; i < mask.length; i++) if (mask[i]) { n++; const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { n, frac: n / (w * h), x0, x1, y0, y1, bw: x1 - x0, bh: y1 - y0 }; }
  async function findCar(id, w, h) {
    // a positive click in the middle of the frame, then a second pass with points spread along the body found in the first
    const tries = [[.5, .58], [.5, .5], [.36, .6], [.64, .6], [.5, .68]];
    let best = null;
    for (const [x, y] of tries) {
      const m = await ask({ type: 'decode', id, points: [[x, y, 1]] });
      for (let k = 0; k < 3; k++) {
        const mk = planeOf(m, k), s = stats(mk, w, h);
        if (s.frac < .03 || s.frac > .9 || s.bw < w * .2 || s.bw < s.bh * .7) continue;
        const touches = (s.x0 <= 1) + (s.x1 >= w - 2) + (s.y0 <= 1) + (s.y1 >= h - 2); // background masks touch several borders
        const score = m.scores[k] * Math.sqrt(s.frac) * (touches >= 3 ? .3 : 1);
        if (!best || score > best.score) best = { score, mask: mk.slice(), s };
      }
      if (best && best.score > .3) break;
    }
    if (!best) return null;
    const { s } = best, pts = [];
    for (const [fx, fy] of [[.5, .55], [.25, .62], [.75, .62], [.5, .78]]) {
      const x = Math.round(s.x0 + s.bw * fx), y = Math.round(s.y0 + s.bh * fy);
      if (best.mask[y * w + x]) pts.push([x / w, y / h, 1]);
    }
    if (pts.length >= 2) {
      const m = await ask({ type: 'decode', id, points: pts });
      let k2 = -1, a2 = 0; for (let k = 0; k < 3; k++) { const st2 = stats(planeOf(m, k), w, h); if (m.scores[k] > .6 && st2.frac < .9 && st2.n > a2 && st2.n > best.s.n * .85) { a2 = st2.n; k2 = k; } }
      if (k2 >= 0) { const mk = planeOf(m, k2); for (let i = 0; i < mk.length; i++) if (mk[i]) best.mask[i] = 255; }
    }
    return best.mask;
  }
  /* wheels and number plates are part of SAM's "car" but must not be wrapped: probe the lower body with single clicks and
     keep the candidates that look like a wheel (round, touching the bottom) or a plate (a flat rectangle) */
  async function findParts(id, w, h, car) {
    const c = stats(car, w, h), excl = new Uint8Array(w * h); let wheels = 0, plates = 0;
    if (!c.n) return { excl, wheels, plates };
    let low = null, lowG = null, lw = 0, lh = 0, ms = 0, probes = 0, windows = 0;
    // paint brightness reference (median of the lower-middle body)
    const ref = []; for (let y = Math.round(c.y0 + c.bh * .5); y < c.y0 + c.bh * .72; y += 3) for (let x = Math.round(c.x0 + c.bw * .25); x < c.x0 + c.bw * .75; x += 3) { const i = y * w + x; if (car[i]) { const p = i * 4; ref.push((upl.rgba[p] * .299 + upl.rgba[p + 1] * .587 + upl.rgba[p + 2] * .114) / 255); } }
    ref.sort((a, b) => a - b); const pl = ref.length ? ref[ref.length >> 1] : .5;
    const probesAt = [];
    for (const fy of [.84, .7]) for (let fx = .08; fx < .96; fx += .12) probesAt.push([fx, fy, 'low']);
    for (const fy of [.2, .32]) for (let fx = .3; fx < .9; fx += .12) probesAt.push([fx, fy, 'top']);
    for (const [fx, fy, band] of probesAt) {
      const x = Math.round(c.x0 + c.bw * fx), y = Math.round(c.y0 + c.bh * fy);
      if (!car[y * w + x] || (low && low[Math.floor(y * lh / h) * lw + Math.floor(x * lw / w)])) continue;
      if (lowG && lowG[Math.floor(y * lh / h) * lw + Math.floor(x * lw / w)]) continue;
      const m = await ask({ type: 'decode', id, points: [[x / w, y / h, 1]], lowres: true }); ms += m.ms || 0; probes++;
      if (!low) { lw = m.w; lh = m.h; low = new Uint8Array(lw * lh); lowG = new Uint8Array(lw * lh); }
      const sx = lw / w, sy = lh / h, cx0 = c.x0 * sx, cx1 = c.x1 * sx, cy0 = c.y0 * sy, cy1 = c.y1 * sy, cbw = cx1 - cx0, cbh = cy1 - cy0, cn = c.n * sx * sy;
      let best = null;
      if (band === 'top') { // a window: compact part above the waist whose brightness clearly differs from the paint
        for (let k = 0; k < 3; k++) {
          const mk = planeOf(m, k), t = stats(mk, lw, lh); if (!t.n || m.scores[k] < .6) continue;
          const bw = t.bw + 1, bh = t.bh + 1, area = t.n / cn, cyr = ((t.y0 + t.y1) / 2 - cy0) / cbh;
          if (area < .012 || area > .16 || bw / bh > 5 || bw / bh < .5 || t.n / (bw * bh) < .4 || cyr > .5) continue;
          let L = 0, q = 0; for (let j = 0; j < mk.length; j += 2) if (mk[j]) { const X = Math.min(w - 1, Math.round((j % lw) / sx)), Y = Math.min(h - 1, Math.round(((j / lw) | 0) / sy)), p = (Y * w + X) * 4; L += (upl.rgba[p] * .299 + upl.rgba[p + 1] * .587 + upl.rgba[p + 2] * .114) / 255; q++; }
          L /= Math.max(1, q);
          if ((pl < .35 && L > pl + .1) || (pl >= .35 && L < pl - .25)) { if (!best || t.n > best.n) best = { mk, n: t.n }; }
        }
        if (best) { windows++; for (let j = 0; j < lowG.length; j++) if (best.mk[j]) lowG[j] = 255; }
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const mk = planeOf(m, k), t = stats(mk, lw, lh); if (!t.n || m.scores[k] < .55) continue;
        const bw = t.bw + 1, bh = t.bh + 1, fill = t.n / (bw * bh), asp = bw / bh, area = t.n / cn;
        const wheel = area > .012 && area < .2 && asp > .4 && asp < 1.45 && fill > .55 && fill < .93 && cy1 - t.y1 < cbh * .15;
        const plate = area > .002 && area < .05 && asp > 1.5 && asp < 4.5 && bh < cbh * .12 && fill > .8 && (t.y0 + t.y1) / 2 > cy0 + cbh * .35;
        if ((wheel || plate) && (!best || t.n > best.n)) best = { mk, n: t.n, wheel };
      }
      if (!best) continue;
      best.wheel ? wheels++ : plates++;
      for (let j = 0; j < low.length; j++) if (best.mk[j]) low[j] = 255;
    }
    const up = src => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) { const ly = Math.min(lh - 1, Math.floor(y * lh / h)) * lw; for (let x = 0; x < w; x++) o[y * w + x] = src[ly + Math.min(lw - 1, Math.floor(x * lw / w))]; } const r = refineMask(upl.rgba, w, h, o); for (let i = 0; i < r.length; i++) o[i] = r[i] && car[i] ? 255 : 0; return o; };
    if (wheels + plates) excl.set(up(low)); // back to full resolution, snapped to the photo's edges
    const glass = windows ? up(lowG) : null;
    console.info('[wv] probes', probes, 'decoder', Math.round(ms / Math.max(1, probes)), 'ms each');
    return { excl, wheels, plates, windows, glass };
  }
  function photoVehicle() {
    const v = vehicleFromPhoto(upl.rgba, upl.w, upl.h, feather(upl.paint, upl.w, upl.h, Math.max(1, Math.round(upl.w / 900))), upl.glass);
    upl.v = v; return v;
  }
  async function handleFile(file) {
    if (!file) return;
    if (file.type && !/^image\//.test(file.type)) return toast(t('Please choose a JPG or PNG photo.'));
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return toast(t('This photo could not be opened. Please use a JPG or PNG.')); }
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    const rgba = g.getImageData(0, 0, w, h).data;
    const th = document.createElement('canvas'); th.height = 140; th.width = Math.round(140 * w / h); th.getContext('2d').drawImage(c, 0, 0, th.width, th.height);
    const id = 'u' + Date.now();
    const empty = new Float32Array(0);
    upl = { id, w, h, rgba, paint: null, glass: null, hist: [] };
    upl.v = { W: w, H: h, base: rgba, paint: new Uint32Array(0), glass: new Uint32Array(0), rim: new Uint32Array(0), D: empty, S: empty, E: empty, M: empty, X: empty, Y: empty, R: empty, S5: empty, S14: empty, SX: empty, BR: empty, RM: empty, RL: empty, GM: empty, photo: true };
    st.make = st.model = ''; $('[data-wv-make]').value = ''; fillModels();
    const mine = $('[data-wv-mine]'); mine.hidden = false; $('[data-wv-mineimg]').src = th.toDataURL('image/jpeg', .8);
    setCompare(false); await setVehicle('upload'); mine.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    stage.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    try {
      loadingModel = true; upMsg(t('Loading the AI model…'), 2);
      const ready = await ask({ type: 'load' }); loadingModel = false;
      if (upl?.id !== id) return;
      upMsg(t('Analysing your photo…'), null);
      const bitmap = await createImageBitmap(c);
      await ask({ type: 'embed', id, bitmap }, [bitmap]);
      if (upl?.id !== id) return;
      upMsg(t('Finding the painted panels…'), null);
      const car = await findCar(id, w, h);
      if (upl?.id !== id) return;
      if (!car) { upHide(); setEdit(true, 'empty'); toast(t('We could not find the car automatically. Tap the car to select it.')); upl.paint = new Uint8Array(w * h); upl.glass = new Uint8Array(w * h); return; }
      const carR = refineMask(rgba, w, h, car), t1 = performance.now();
      const parts = await findParts(id, w, h, carR);
      if (upl?.id !== id) return;
      const sp = splitCar(rgba, w, h, carR); upl.paint = sp.paint; upl.glass = sp.glass;
      for (let j = 0; j < sp.paint.length; j++) { if (parts.excl[j]) sp.paint[j] = 0; if (parts.glass && parts.glass[j]) { sp.paint[j] = 0; sp.glass[j] = 255; } }
      console.info('[wv] parts', parts.wheels, 'wheels', parts.plates, 'plates', parts.windows, 'windows', Math.round(performance.now() - t1), 'ms');
      await new Promise(r => setTimeout(r, 30)); // let the message paint before the heavy maths
      current = photoVehicle(); layout(current); paint(); upHide();
      toast(t('Done! Use Edit selection if a panel is missing.'));
      console.info('[wv] photo', w, h, 'device', ready.device);
    } catch (e) {
      console.error('[wv]', e); loadingModel = false; upHide();
      toast(t('The AI could not start on this device. Try another browser or a smaller photo.'));
    }
  }
  /* edit the painted area: tap → SAM mask of that part → add or remove */
  function setEdit(on) {
    if (on && (!upl || st.vehicle !== 'upload')) return;
    editing = on; $('[data-wv-edit]').hidden = !on; selCv.hidden = !on; wrap.classList.toggle('editing', on);
    $('[data-wv-editsel]').setAttribute('aria-pressed', String(on));
    if (on) { if (compare) setCompare(false); drawSel(); $('[data-wv-edit]').scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }
  }
  function drawSel() {
    if (!upl || !upl.paint) return;
    const { w, h, paint: pm } = upl; selCv.width = w; selCv.height = h;
    const g = selCv.getContext('2d'), img = g.createImageData(w, h), o = img.data;
    for (let i = 0; i < pm.length; i++) {
      if (!pm[i]) continue; const x = i % w, y = (i / w) | 0;
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !pm[i - 1] || !pm[i + 1] || !pm[i - w] || !pm[i + w];
      const p = i * 4; o[p] = 236; o[p + 1] = 40; o[p + 2] = 101; o[p + 3] = edge ? 255 : 70;
    }
    g.putImageData(img, 0, 0);
    $('[data-wv-eundo]').disabled = !upl.hist.length;
  }
  let editBusy = false;
  wrap.addEventListener('click', async e => {
    if (!editing || !upl || editBusy || e.target.closest('.wv-ba')) return;
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    editBusy = true; const spin = $('[data-wv-spin]'); spin.hidden = false;
    try {
      const m = await ask({ type: 'decode', id: upl.id, points: [[x, y, 1]] });
      const { w, h } = upl, total = w * h;
      // the part under the finger: best-scoring candidate that is not the whole photo
      let k = -1; for (let j = 0; j < 3; j++) { const n = stats(planeOf(m, j), w, h).frac; if (n > .0004 && n < .6 && (k < 0 || m.scores[j] > m.scores[k])) k = j; }
      if (k < 0) { toast(t('Nothing found there. Try tapping the middle of the panel.')); return; }
      const mk = refineMask(upl.rgba, w, h, planeOf(m, k));
      upl.hist.push([upl.paint.slice(), upl.glass.slice()]); if (upl.hist.length > 15) upl.hist.shift();
      for (let i = 0; i < total; i++) if (mk[i]) { if (emode === 'add') { upl.paint[i] = 255; upl.glass[i] = 0; } else upl.paint[i] = 0; }
      if (emode === 'remove' && y < .6) { // windows taken out of the paint can still take tint
        let lum = 0, n = 0; for (let i = 0; i < total; i += 7) if (mk[i]) { const p = i * 4; lum += upl.rgba[p] * .3 + upl.rgba[p + 1] * .59 + upl.rgba[p + 2] * .11; n++; }
        if (n && lum / n < 95) for (let i = 0; i < total; i++) if (mk[i]) upl.glass[i] = 255;
      }
      await rebuildPhoto();
    } catch (err) { console.error('[wv]', err); toast(t('That did not work. Please try again.')); }
    finally { editBusy = false; spin.hidden = true; }
  });
  async function rebuildPhoto() {
    await new Promise(r => setTimeout(r, 0));
    let n = 0; for (let i = 0; i < upl.paint.length; i += 3) if (upl.paint[i]) { n++; if (n > 80) break; }
    if (n > 80) current = photoVehicle(); else { current = upl.v = { ...upl.v, paint: new Uint32Array(0), glass: new Uint32Array(0) }; }
    paint(); drawSel();
  }

  app.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !app.contains(b)) return;
    const grp = b.closest('[data-wv-brand],[data-wv-finish],[data-wv-family],[data-wv-tint],[data-wv-wheels],[data-wv-cars],[data-wv-side-toggle]');
    if (b.dataset.film) { st.film = byId[b.dataset.film]; update(); if (matchMedia('(max-width: 900px)').matches) setSheet(false); return; }
    if (b.matches('[data-wv-upload]')) { $('[data-wv-file]').click(); return; }
    if (grp && b.dataset.v) {
      const v = b.dataset.v;
      if (grp.matches('[data-wv-brand]')) st.brand = v; else if (grp.matches('[data-wv-finish]')) st.finish = v; else if (grp.matches('[data-wv-family]')) st.family = v;
      else if (grp.matches('[data-wv-tint]')) { st.tint = v; return update(); } else if (grp.matches('[data-wv-wheels]')) { st.wheel = v; return update(); }
      else if (grp.matches('[data-wv-side-toggle]')) { st.side = v; beforeKey = ''; return update(); } else if (grp.matches('[data-wv-cars]')) return setVehicle(v);
      drawList(); syncUI(); return;
    }
    if (b.matches('[data-wv-compare]')) return setCompare(!compare);
    if (b.matches('[data-wv-editsel]')) return setEdit(!editing);
    if (b.dataset.wvEmode) { emode = b.dataset.wvEmode; $$('[data-wv-emode]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); wrap.dataset.emode = emode; return; }
    if (b.matches('[data-wv-eundo]')) { const prev = upl?.hist.pop(); if (prev) { [upl.paint, upl.glass] = prev; rebuildPhoto(); } return; }
    if (b.matches('[data-wv-edone]')) return setEdit(false);
    if (b.matches('[data-wv-clear]')) { st.brand = st.finish = st.family = 'all'; st.search = ''; $('[data-wv-search]').value = ''; drawList(); syncUI(); return; }
    if (b.matches('[data-wv-sheet]')) return setSheet(b.getAttribute('aria-expanded') !== 'true');
    if (b.matches('[data-wv-sheet-close]')) return setSheet(false);
    if (b.matches('[data-wv-share]')) return share();
    if (b.matches('[data-wv-download]')) return download();
    if (b.matches('[data-wv-quote]')) return quote();
  });
  $('[data-wv-file]').addEventListener('change', e => { const f = e.target.files?.[0]; e.target.value = ''; handleFile(f); });
  for (const ev of ['dragenter', 'dragover']) wrap.addEventListener(ev, e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); wrap.classList.add('drop'); } });
  for (const ev of ['dragleave', 'drop']) wrap.addEventListener(ev, () => wrap.classList.remove('drop'));
  wrap.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) { e.preventDefault(); handleFile(f); } });
  $('[data-wv-search]').addEventListener('input', e => { st.search = e.target.value; drawList(); });
  $('[data-wv-make]').addEventListener('change', e => {
    st.make = makeFilter = e.target.value; st.model = '';
    const first = st.make && Object.entries(MODELS[st.make] || {})[0]; // jump straight to that brand's first model
    if (first && st.vehicle !== 'upload') { st.model = first[0]; fillModels(); setVehicle(first[1]); $('[data-wv-cars] [data-v="' + first[1] + '"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); return; }
    fillModels(); syncUI();
  });
  $('[data-wv-model]').addEventListener('change', e => {
    if (e.target.value === '__other') { const m = prompt(t('Model')); st.model = (m || '').trim().slice(0, 60); fillModels(); syncUI(); return; }
    st.model = e.target.value; const body = MODELS[st.make]?.[st.model];
    if (body && body !== st.vehicle && st.vehicle !== 'upload') { setVehicle(body); $('[data-wv-cars] [data-v="' + body + '"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } else syncUI();
  });
  $('[data-wv-year]').addEventListener('change', e => { st.year = e.target.value; syncUI(); });
  function setSheet(open) { const side = $('[data-wv-side]'); side.classList.toggle('open', open); $('[data-wv-sheet]').setAttribute('aria-expanded', String(open)); document.documentElement.classList.toggle('wv-sheet-open', open); if (open) { const iv = setInterval(() => { if (!section.isConnected || !side.classList.contains('open')) { clearInterval(iv); if (!section.isConnected) document.documentElement.classList.remove('wv-sheet-open'); } }, 800); } }

  const mark = new Image(); mark.src = BASE + 'satin-mark.png';
  const vehicleText = () => [st.year, st.make, st.model].filter(Boolean).join(' ');
  async function share() {
    const url = location.href, title = `${st.film.name} wrap · Satin Graphic`;
    try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title, url }); return; } } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast(t(st.vehicle === 'upload' ? 'Link copied — your photo stays on your device' : 'Link copied')); } catch { prompt('Copy this link', url); }
  }
  function download() {
    if (!current) return;
    const cw = canvas.width, ch = canvas.height, k = Math.max(.5, Math.min(cw, ch * 16 / 9) / 1600);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
    g.drawImage(canvas, 0, 0);
    const f = st.film, b = brands[f.brand], font = (wt, px) => `${wt} ${Math.round(px * k)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const lines = [[font(600, 22), '#5b6170', (b.name + ' · ' + b.line).toUpperCase()], [font(700, 52), '#182333', f.name], [font(500, 24), '#5b6170', [(FINISHES.find(x => x[0] === f.finish) || [, f.finish])[1], f.code, vehicleText()].filter(Boolean).join(' · ')]];
    let tw = 0; for (const [fo, , tx] of lines) { g.font = fo; tw = Math.max(tw, g.measureText(tx).width); }
    if (!isStudio(st.vehicle)) { g.fillStyle = 'rgba(255,255,255,.84)'; g.beginPath(); g.roundRect ? g.roundRect(32 * k, 36 * k, tw + 48 * k, 156 * k, 18 * k) : g.rect(32 * k, 36 * k, tw + 48 * k, 156 * k); g.fill(); }
    [74, 132, 170].forEach((y, i) => { const [fo, col, tx] = lines[i]; g.font = fo; g.fillStyle = col; g.fillText(tx, 56 * k, y * k); });
    const foot = 'satingraphic.ca', note = 'Approximate colour preview. See the physical swatch in store.';
    g.font = font(600, 20); const fw = g.measureText(foot).width; g.font = font(400, 15); const nw = g.measureText(note).width;
    g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(0, ch - 64 * k, cw, 64 * k);
    g.font = font(600, 20); g.textAlign = 'right'; g.fillStyle = 'rgba(24,35,51,.7)';
    if (mark.complete && mark.naturalWidth) { const mh = 30 * k, mw = mh * mark.naturalWidth / mark.naturalHeight; g.drawImage(mark, cw - 40 * k - mw, ch - 32 * k - mh / 2, mw, mh); } else g.fillText(foot, cw - 40 * k, ch - 26 * k);
    if (nw + fw + 120 * k < cw) { g.textAlign = 'left'; g.font = font(400, 15); g.fillText(note, 40 * k, ch - 26 * k); }
    const name = ('satin-wrap-' + (st.vehicle === 'upload' ? 'my-car' : st.vehicle.replace('stock:', '')) + '-' + f.id).replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '.png';
    c.toBlob(blob => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, 'image/png');
  }
  function quote() {
    const f = st.film, veh = vehInfo(), fin = f.finish;
    const finish = fin === 'chrome' || fin === 'colorflow' ? 'Satin Chrome / Colour-Flip' : fin.startsWith('matte') ? 'Matte' : fin.startsWith('satin') || fin === 'brushed' ? 'Satin' : 'Gloss';
    const parts = [['Vehicle type', veh.quote], ['Wrap type', 'Color change'], ['Coverage', 'Full Wrap'], ['Finish', finish], ['Film', filmLabel(f)], ['Vehicle', vehicleText() || veh.name],
      ['Window tint', st.tint === 'factory' ? 'No tint' : st.tint + '% VLT'], ['Wheels', (WHEELS.find(x => x[0] === st.wheel) || WHEELS[0])[1]], ['Visualizer build', location.href]];
    if (st.vehicle === 'upload') parts.push(['Photo', 'Customer previewed their own photo; please ask them to attach it']);
    const details = parts.map(([k, v]) => k + ': ' + String(v).replace(/[;:]/g, ' ')).join('; ');
    // reuse the site quote wizard (same as every "Get a quote" button)
    if (typeof window.satinOpenQuote === 'function') window.satinOpenQuote('Vehicle Wraps', details);
    else location.assign('/satin/contact/');
  }

  fillModels(); drawList(); syncUI();
  if (opts.signal) opts.signal.addEventListener('abort', () => { cancelAnimationFrame(frame); setSheet(false); worker?.terminate(); worker = null; });
  await setVehicle(st.vehicle);
}
