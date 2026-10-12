// Original flat-cartoon mascots (Satin Graphic) for wrap designs and Design Studio "Mascots" elements.
// Each mascot draws in a 100 × 100 box with two recolourable colours: a (main body) and b (accent).
// Only print-safe SVG is used (g, path, circle, ellipse, rect + fill/stroke/opacity/transform) so the
// Design Studio print-file check accepts it. All characters are original drawings, not based on any brand.
const INK = '#1f2130';
const O = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const hx = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const shade = (h, k) => { const c = hx(h); return toHex(k < 0 ? c.map(v => v * (1 + k)) : c.map(v => v + (255 - v) * k)); };
const lumOf = h => { const [r, g, b] = hx(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

// ---- shared parts ----
const eyes = (x1, x2, y, r = 6, look = 0) => [x1, x2].map(x => `<ellipse cx="${x}" cy="${y}" rx="${r * .82}" ry="${r}" fill="#fff" ${O}/><circle cx="${x + look + r * .12}" cy="${y + r * .18}" r="${r * .48}" fill="${INK}"/><circle cx="${x + look + r * .32}" cy="${y - r * .08}" r="${r * .17}" fill="#fff"/>`).join('');
const brows = (x1, x2, y, w = 5) => `<path d="M${x1 - w} ${y + 1} Q${x1} ${y - 2.5} ${x1 + w} ${y}" fill="none" ${O}/><path d="M${x2 - w} ${y} Q${x2} ${y - 2.5} ${x2 + w} ${y + 1}" fill="none" ${O}/>`;
const smile = (cx, cy, w = 8) => `<path d="M${cx - w} ${cy} Q${cx} ${cy + w * 1.25} ${cx + w} ${cy} Z" fill="#8a2335" ${O}/><path d="M${cx - w * .45} ${cy + w * .62} Q${cx} ${cy + w * .3} ${cx + w * .45} ${cy + w * .62} Q${cx} ${cy + w * .95} ${cx - w * .45} ${cy + w * .62} Z" fill="#f2727f"/>`;
const grin = (cx, cy, w = 7) => `<path d="M${cx - w} ${cy} Q${cx} ${cy + w * .9} ${cx + w} ${cy}" fill="none" ${O}/>`;
const cheeks = (x1, x2, y, r = 3.2) => `<ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r * .7}" fill="#ff7a8a" opacity=".55"/><ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r * .7}" fill="#ff7a8a" opacity=".55"/>`;
const face = (cx, cy, s = 1, look = 0) => eyes(cx - 9 * s, cx + 9 * s, cy, 6.2 * s, look) + brows(cx - 9 * s, cx + 9 * s, cy - 9.5 * s, 4.5 * s) + smile(cx, cy + 9 * s, 7.5 * s) + cheeks(cx - 15 * s, cx + 15 * s, cy + 7 * s, 3.2 * s);
const limb = (d, col, w = 6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 5.2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const hand = (x, y, r = 4.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${O}/>`;
const legs = (cx, top, col, gap = 8, len = 9) => limb(`M${cx - gap} ${top} L${cx - gap} ${top + len}`, col, 5.5) + limb(`M${cx + gap} ${top} L${cx + gap} ${top + len}`, col, 5.5) +
  `<path d="M${cx - gap - 7} ${top + len + 5} Q${cx - gap - 7} ${top + len - 1} ${cx - gap} ${top + len - 1} Q${cx - gap + 5} ${top + len - 1} ${cx - gap + 5} ${top + len + 5} Z" fill="${INK}"/><path d="M${cx + gap - 5} ${top + len + 5} Q${cx + gap - 5} ${top + len - 1} ${cx + gap} ${top + len - 1} Q${cx + gap + 7} ${top + len - 1} ${cx + gap + 7} ${top + len + 5} Z" fill="${INK}"/>`;
const shadow = (cx = 50, y = 97, w = 26) => `<ellipse cx="${cx}" cy="${y}" rx="${w}" ry="2.6" fill="${INK}" opacity=".16"/>`;
const shine = (x, y, s = 1) => `<path d="M${x} ${y - 5 * s} Q${x + 1 * s} ${y - 1 * s} ${x + 5 * s} ${y} Q${x + 1 * s} ${y + 1 * s} ${x} ${y + 5 * s} Q${x - 1 * s} ${y + 1 * s} ${x - 5 * s} ${y} Q${x - 1 * s} ${y - 1 * s} ${x} ${y - 5 * s} Z" fill="#fff"/>`;
const wrench = (x, y, r = 0, s = 1) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M-2.6 0 L-2.6 24 Q0 27 2.6 24 L2.6 0 Z" fill="#9aa3ad" ${O}/><path d="M-8 -6 Q-8 -14 0 -15 L0 -9 L4 -9 L4 -15 Q9 -13 8 -5 Q6 2 0 2 Q-7 2 -8 -6 Z" fill="#c3cad2" ${O}/></g>`;

// ---- characters ----
const C = {
  drip: { label: 'Drip the plumber', tags: 'plumbing water drain', colors: ['#2b8cff', '#ffcc33'], draw: (a, b) => shadow() +
    legs(50, 82, shade(a, -.25)) +
    limb('M27 62 Q16 60 13 49', a) + hand(13, 48) + wrench(13, 40, -25, .9) +
    limb('M73 62 Q84 66 86 76', a) + hand(86, 77) +
    `<path d="M50 6 C62 24 78 40 78 60 A28 28 0 0 1 22 60 C22 40 38 24 50 6 Z" fill="${a}" ${O}/>` +
    `<path d="M36 40 Q31 50 32 60" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M29 31 Q50 20 71 31 L69 38 Q50 30 31 38 Z" fill="${b}" ${O}/><rect x="45" y="22" width="10" height="5" rx="2" fill="${shade(b, -.2)}" ${O}/>` + face(50, 54, .95) },
  sparky: { label: 'Sparky the electrician', tags: 'electrical electrician light bulb', colors: ['#ffd400', '#2a3342'], draw: (a, b) => shadow() +
    legs(50, 84, b) +
    limb('M28 50 Q16 44 14 32', a) + hand(14, 31) +
    `<path d="M14 24 L9 33 L14 33 L10 42 L20 29 L15 29 L19 22 Z" fill="${INK}" transform="translate(-2 -14)"/>` +
    limb('M72 52 Q84 56 86 66', a) + hand(86, 67) +
    `<path d="M50 6 A30 30 0 0 1 70 58 Q66 63 65 70 L35 70 Q34 63 30 58 A30 30 0 0 1 50 6 Z" fill="${a}" ${O}/>` +
    `<path d="M33 22 Q38 14 46 12" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".8"/>` +
    `<rect x="35" y="70" width="30" height="5" rx="2" fill="${shade(b, .25)}" ${O}/><rect x="36" y="75" width="28" height="5" rx="2" fill="${shade(b, .1)}" ${O}/><path d="M39 80 L61 80 L57 85 L43 85 Z" fill="${b}" ${O}/>` +
    face(50, 36, .95) + `<path d="M50 52 L45 60 L49 60 L46 67 L55 57 L51 57 L54 52 Z" fill="${shade(a, -.35)}"/>` },
  chilly: { label: 'Chilly the HVAC cube', tags: 'hvac air conditioning cooling ice', colors: ['#7cc9ff', '#e8314a'], draw: (a, b) => shadow() +
    legs(50, 82, shade(a, -.3)) +
    limb('M24 56 Q13 54 11 44', a) + hand(11, 43) + limb('M76 56 Q87 58 89 48', a) + hand(89, 47) +
    `<rect x="22" y="22" width="56" height="60" rx="11" fill="${a}" ${O}/>` +
    `<path d="M29 30 L29 46 M29 30 L42 30" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M22 66 Q50 74 78 66 L78 74 Q50 82 22 74 Z" fill="${b}" ${O}/><path d="M66 70 L72 92 L80 89 L72 70 Z" fill="${b}" ${O}/>` +
    `<g stroke="#fff" stroke-width="2.4" stroke-linecap="round" transform="translate(50 12)"><path d="M0 -9 L0 9 M-7.8 -4.5 L7.8 4.5 M-7.8 4.5 L7.8 -4.5"/></g>` +
    face(50, 46, .95) },
  blaze: { label: 'Blaze the flame', tags: 'heating furnace bbq grill fire', colors: ['#ff6a1a', '#ffd23f'], draw: (a, b) => shadow() +
    legs(50, 84, shade(a, -.3)) +
    limb('M26 60 Q15 56 13 45', a) + hand(13, 44) + limb('M74 60 Q85 56 87 45', a) + hand(87, 44) +
    `<path d="M50 4 C58 18 70 18 68 6 C82 20 82 40 78 54 C80 78 64 88 50 88 C36 88 20 78 22 56 C18 40 26 30 32 22 C34 32 40 34 42 30 C38 20 42 10 50 4 Z" fill="${a}" ${O}/>` +
    `<path d="M50 34 C56 44 66 50 64 64 C62 76 38 76 36 64 C35 54 44 48 50 34 Z" fill="${b}"/>` + face(50, 56, .9) },
  hammy: { label: 'Hammy the hammer', tags: 'carpentry carpenter construction handyman woodwork', colors: ['#c98a4b', '#8e99a6'], draw: (a, b) => shadow() +
    legs(50, 84, shade(a, -.35), 6) +
    limb('M38 56 Q26 54 22 44', a) + hand(22, 43) + limb('M62 56 Q74 60 77 70', a) + hand(77, 71) +
    `<rect x="34" y="30" width="32" height="56" rx="13" fill="${a}" ${O}/>` +
    `<path d="M42 44 L42 76 M58 50 L58 78" fill="none" stroke="${shade(a, -.25)}" stroke-width="2"/>` +
    `<path d="M20 12 L64 12 L64 36 L20 36 Q13 32 13 24 Q13 16 20 12 Z" fill="${b}" ${O}/><path d="M64 14 Q78 12 90 4 Q96 16 86 26 Q76 30 64 32 Z" fill="${shade(b, -.18)}" ${O}/><rect x="20" y="15" width="38" height="4" rx="2" fill="#fff" opacity=".55"/>` +
    face(50, 56, .82) },
  roller: { label: 'Rollo the paint roller', tags: 'painting painter renovation decor', colors: ['#3b6cff', '#f5f5f5'], draw: (a, b) => shadow(50, 97, 18) +
    `<path d="M50 52 L50 88" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M50 52 L50 88" fill="none" stroke="#9aa3ad" stroke-width="5" stroke-linecap="round"/><rect x="44" y="84" width="12" height="13" rx="4" fill="${INK}"/>` +
    `<path d="M50 52 L50 46 L84 46 L84 30" fill="none" stroke="${INK}" stroke-width="3"/>` +
    limb('M20 34 Q8 40 9 52', a) + hand(9, 53) + limb('M80 20 Q92 18 94 8', a) + hand(94, 7) +
    `<rect x="12" y="6" width="76" height="40" rx="14" fill="${b}" ${O}/><path d="M12 30 Q30 26 40 34 Q52 42 64 30 Q76 22 88 28 L88 32 Q88 46 74 46 L26 46 Q12 46 12 32 Z" fill="${a}"/>` +
    `<path d="M40 44 Q41 52 44 52 Q47 52 46 44" fill="${a}" ${O}/>` + `<rect x="12" y="6" width="76" height="40" rx="14" fill="none" ${O}/>` + face(50, 21, .78) },
  sprout: { label: 'Sprout the gardener', tags: 'landscaping lawn garden green', colors: ['#3fb34f', '#8fd14f'], draw: (a, b) => shadow() +
    legs(50, 84, shade(a, -.35)) +
    limb('M24 60 Q13 58 11 48', a) + hand(11, 47) + limb('M76 60 Q87 58 89 48', a) + hand(89, 47) +
    `<path d="M50 30 Q47 18 50 12" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M50 30 Q47 18 50 12" fill="none" stroke="${shade(a, -.2)}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M50 14 C40 2 24 4 20 12 C30 20 44 20 50 14 Z" fill="${b}" ${O}/><path d="M50 12 C58 -2 78 0 82 8 C72 18 58 18 50 12 Z" fill="${b}" ${O}/>` +
    `<ellipse cx="50" cy="58" rx="29" ry="29" fill="${a}" ${O}/><path d="M30 46 Q34 36 42 33" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".7"/>` + face(50, 56, .95) },
  homey: { label: 'Homey the house', tags: 'real estate realtor roofing home renovation', colors: ['#ffffff', '#e8314a'], draw: (a, b) => shadow(50, 97, 30) +
    legs(50, 86, shade(b, -.3), 12, 6) +
    limb('M22 64 Q11 62 9 52', b) + hand(9, 51) + limb('M78 64 Q89 62 91 52', b) + hand(91, 51) +
    `<rect x="22" y="44" width="56" height="44" rx="4" fill="${a}" ${O}/>` +
    `<rect x="64" y="14" width="10" height="20" fill="${shade(b, -.25)}" ${O}/>` +
    `<path d="M12 48 L50 14 L88 48 Q90 54 84 54 L50 26 L16 54 Q10 54 12 48 Z" fill="${b}" ${O}/>` +
    `<rect x="42" y="72" width="16" height="16" rx="3" fill="${shade(b, -.15)}" ${O}/><circle cx="55" cy="80" r="1.4" fill="#fff"/>` + face(50, 54, .85) },
  hardhat: { label: 'Max the builder', tags: 'construction contractor builder general', colors: ['#ffc21a', '#f08c1a'], draw: (a, b) => shadow() +
    legs(50, 84, '#3a4b6a') +
    `<path d="M30 66 Q30 60 38 60 L62 60 Q70 60 70 66 L70 86 L30 86 Z" fill="${b}" ${O}/><path d="M34 70 L66 70 M34 76 L66 76" fill="none" stroke="#e9eef3" stroke-width="3"/>` +
    limb('M32 66 Q20 68 17 58', b) + hand(17, 57) + limb('M68 66 Q80 70 82 80', b) + hand(82, 81) +
    `<circle cx="50" cy="40" r="23" fill="#f6c9a0" ${O}/>` +
    `<path d="M24 34 Q24 10 50 10 Q76 10 76 34 Z" fill="${a}" ${O}/><path d="M18 34 L82 34 Q84 39 80 40 L20 40 Q16 39 18 34 Z" fill="${shade(a, -.15)}" ${O}/><rect x="46" y="10" width="8" height="24" rx="3" fill="${shade(a, .3)}" ${O}/>` +
    eyes(41, 59, 48, 4.8) + smile(50, 55, 5.6) + cheeks(36, 64, 54) },
  bubbly: { label: 'Bubbly the cleaner', tags: 'cleaning cleaners maid janitorial', colors: ['#29c4c4', '#ff5aa5'], draw: (a, b) => shadow() +
    legs(50, 84, shade(a, -.35)) +
    limb('M24 58 Q12 54 11 42', a) + hand(11, 41) +
    `<g transform="translate(4 14) rotate(-12)"><rect x="0" y="6" width="14" height="22" rx="4" fill="${b}" ${O}/><path d="M2 6 L2 0 L13 0 L17 4 L12 4 L12 6 Z" fill="#fff" ${O}/></g>` +
    limb('M76 60 Q88 62 90 72', a) + hand(90, 73) +
    `<circle cx="50" cy="56" r="30" fill="${a}" ${O}/><path d="M28 50 Q30 36 42 30" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".75"/>` +
    `<circle cx="78" cy="22" r="7" fill="#fff" opacity=".9" ${O}/><circle cx="88" cy="36" r="4" fill="#fff" opacity=".9" ${O}/><circle cx="68" cy="10" r="3.4" fill="#fff" ${O}/>` + shine(22, 28, .9) + face(50, 54, .95) },
  sprayer: { label: 'Squirt the spray bottle', tags: 'cleaning carpet window washing', colors: ['#ff5aa5', '#39c0ff'], draw: (a, b) => shadow(50, 97, 20) +
    legs(50, 86, shade(a, -.35), 7) +
    limb('M32 58 Q20 56 18 46', a) + hand(18, 45) + limb('M68 58 Q80 62 82 72', a) + hand(82, 73) +
    `<path d="M32 38 L68 38 L70 88 L30 88 Z" fill="${a}" ${O}/><rect x="32" y="56" width="36" height="20" rx="3" fill="#fff" opacity=".9"/>` +
    `<path d="M38 38 L38 28 L62 28 L62 38 Z" fill="${b}" ${O}/><path d="M38 28 L36 14 L72 14 L80 22 L64 22 L62 28 Z" fill="${b}" ${O}/><path d="M50 22 L46 34" fill="none" ${O}/>` +
    `<circle cx="88" cy="16" r="2.5" fill="${b}"/><circle cx="92" cy="22" r="2" fill="${b}"/><circle cx="90" cy="10" r="1.8" fill="${b}"/>` + eyes(42, 58, 48, 5) + grin(50, 64, 6) + cheeks(36, 64, 61) },
  shieldy: { label: 'Guardy the shield', tags: 'pest control security protection', colors: ['#2fb36b', '#1f2a44'], draw: (a, b) => shadow() +
    legs(50, 84, b) +
    limb('M22 46 Q10 44 8 34', a) + hand(8, 33) + limb('M78 46 Q90 50 91 62', a) + hand(91, 63) +
    `<path d="M50 6 L80 16 Q82 60 50 86 Q18 60 20 16 Z" fill="${a}" ${O}/><path d="M50 14 L72 21 Q72 56 50 76 Z" fill="${shade(a, .18)}"/>` +
    `<path d="M24 22 Q50 12 76 22 L76 30 Q50 20 24 30 Z" fill="${b}" ${O}/>` + face(50, 46, .9) + `<path d="M40 70 L46 76 L60 64" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` },
  boxy: { label: 'Boxy the mover', tags: 'moving delivery logistics courier junk removal storage', colors: ['#d9a066', '#e8314a'], draw: (a, b) => shadow(50, 97, 30) +
    legs(50, 84, shade(a, -.4), 10) +
    limb('M22 54 Q10 50 8 40', a) + hand(8, 39) + limb('M78 54 Q90 50 92 40', a) + hand(92, 39) +
    `<path d="M20 30 L80 30 L80 84 L20 84 Z" fill="${a}" ${O}/><path d="M20 30 L10 18 L44 18 L50 30 Z" fill="${shade(a, .15)}" ${O}/><path d="M80 30 L90 18 L56 18 L50 30 Z" fill="${shade(a, -.1)}" ${O}/>` +
    `<rect x="44" y="30" width="12" height="14" fill="${b}" ${O}/><path d="M26 76 L36 76 M26 80 L32 80" fill="none" stroke="${shade(a, -.35)}" stroke-width="2"/>` + face(50, 56, .9) },
  burgie: { label: 'Burgie the burger', tags: 'food truck restaurant burger grill diner', colors: ['#e89a3c', '#3fb34f'], draw: (a, b) => shadow(50, 97, 30) +
    legs(50, 86, '#7a3e17', 10, 6) +
    limb('M16 56 Q6 54 4 44', a) + hand(4, 43) + limb('M84 56 Q94 54 96 44', a) + hand(96, 43) +
    `<path d="M14 70 Q14 82 26 84 L74 84 Q86 82 86 70 Z" fill="${a}" ${O}/>` +
    `<rect x="12" y="62" width="76" height="9" rx="4.5" fill="#6b3416" ${O}/>` +
    `<path d="M10 60 L90 60 L86 66 L78 61 L70 67 L62 61 L54 67 L46 61 L38 67 L30 61 L22 67 L14 61 Z" fill="${b}" ${O}/><path d="M14 56 L86 56 L84 61 L16 61 Z" fill="#ffcc2e" ${O}/>` +
    `<path d="M12 54 Q12 14 50 14 Q88 14 88 54 Z" fill="${a}" ${O}/><path d="M24 30 Q32 20 44 18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>` +
    [[34, 24], [52, 20], [64, 28], [42, 30]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="1.2" fill="#fff6d8"/>`).join('') + face(50, 38, .82) },
  slice: { label: 'Slice the pizza', tags: 'pizza pizzeria food restaurant delivery', colors: ['#ffc845', '#e8314a'], draw: (a, b) => shadow(50, 97, 16) +
    legs(50, 84, '#b8742c', 6) +
    limb('M30 36 Q18 34 15 24', a) + hand(15, 23) + limb('M70 36 Q82 40 85 50', a) + hand(85, 51) +
    `<path d="M50 88 L20 20 Q50 8 80 20 Z" fill="${a}" ${O}/><path d="M16 18 Q50 2 84 18 Q86 26 80 26 Q50 14 20 26 Q14 26 16 18 Z" fill="#d48a3a" ${O}/>` +
    [[38, 58], [60, 52], [50, 74], [32, 34], [68, 32]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${b}" ${O}/>`).join('') +
    `<path d="M42 66 Q44 70 42 74" fill="none" stroke="${a}" stroke-width="2"/>` + eyes(41, 59, 38, 5) + smile(50, 46, 6) },
  cuppa: { label: 'Cuppa the coffee cup', tags: 'cafe coffee bakery catering', colors: ['#ffffff', '#7a4a2a'], draw: (a, b) => shadow() +
    legs(50, 86, b, 8, 6) +
    limb('M26 54 Q14 52 12 42', b) + hand(12, 41) +
    `<path d="M72 46 Q90 46 88 60 Q86 72 70 70" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M72 46 Q90 46 88 60 Q86 72 70 70" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M22 32 L78 32 L72 82 Q70 88 62 88 L38 88 Q30 88 28 82 Z" fill="${a}" ${O}/><path d="M24 46 L76 46 L74 64 L26 64 Z" fill="${b}"/><path d="M22 32 L78 32 L72 82 Q70 88 62 88 L38 88 Q30 88 28 82 Z" fill="none" ${O}/>` +
    `<ellipse cx="50" cy="32" rx="28" ry="6" fill="${shade(b, -.2)}" ${O}/>` +
    `<path d="M40 22 Q36 16 40 10 Q44 4 40 0 M54 22 Q50 16 54 10 Q58 4 54 0" fill="none" stroke="#c7ccd3" stroke-width="3" stroke-linecap="round"/>` + eyes(41, 59, 54, 5) + smile(50, 70, 6.5) + cheeks(33, 67, 68) },
  cupcake: { label: 'Cupcake', tags: 'bakery cake dessert party event', colors: ['#ff8fc0', '#3fb0ff'], draw: (a, b) => shadow() +
    legs(50, 86, shade(b, -.3), 8, 6) +
    limb('M24 62 Q12 60 10 50', b) + hand(10, 49) + limb('M76 62 Q88 60 90 50', b) + hand(90, 49) +
    `<path d="M22 52 L78 52 L70 88 L30 88 Z" fill="${b}" ${O}/><path d="M32 52 L36 88 M44 52 L46 88 M56 52 L54 88 M68 52 L64 88" fill="none" stroke="${shade(b, -.25)}" stroke-width="2.4"/>` +
    `<path d="M16 54 Q12 40 24 36 Q22 22 38 22 Q42 10 56 14 Q72 12 72 26 Q88 28 84 42 Q90 52 80 56 Z" fill="${a}" ${O}/>` +
    `<circle cx="56" cy="10" r="6" fill="#e8314a" ${O}/><path d="M56 4 Q60 -2 64 0" fill="none" ${O}/>` +
    [[30, 32, '#ffd23f'], [46, 26, '#3fb34f'], [66, 32, '#3fb0ff'], [74, 44, '#ffd23f'], [26, 46, '#7c5cff']].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="5" height="2" rx="1" fill="${c}" transform="rotate(${x} ${x} ${y})"/>`).join('') +
    eyes(41, 59, 64, 4.8) + smile(50, 72, 5.5) + cheeks(33, 67, 70, 2.8) },
  chef: { label: 'Chef Bo', tags: 'catering chef restaurant kitchen food', colors: ['#f6c9a0', '#e8314a'], draw: (a, b) => shadow() +
    legs(50, 86, '#2a3342', 8, 6) +
    `<path d="M28 70 Q28 62 38 62 L62 62 Q72 62 72 70 L72 88 L28 88 Z" fill="#fff" ${O}/><path d="M44 62 L50 72 L56 62 Z" fill="${b}" ${O}/>` +
    limb('M30 68 Q18 70 16 60', '#fff') + hand(16, 59, 4.4) + limb('M70 68 Q82 70 84 60', '#fff') + hand(84, 59, 4.4) +
    `<path d="M80 60 L82 34 Q84 28 88 34 L86 60 Z" fill="#c3cad2" ${O}/>` +
    `<circle cx="50" cy="44" r="20" fill="${a}" ${O}/>` +
    `<path d="M30 30 Q20 24 26 14 Q30 4 42 8 Q50 -2 60 8 Q72 4 74 14 Q80 24 70 30 Z" fill="#fff" ${O}/><rect x="30" y="26" width="40" height="8" rx="3" fill="#fff" ${O}/>` +
    eyes(42, 58, 44, 4.4) + `<path d="M40 54 Q45 50 50 54 Q55 50 60 54 Q55 57 50 55 Q45 57 40 54 Z" fill="#5b3a26"/>` + grin(50, 57, 5) + cheeks(36, 64, 52, 2.8) },
  balloon: { label: 'Bloop the balloon', tags: 'event party decoration balloons celebration wedding', colors: ['#ff4f7b', '#ffd23f'], draw: (a, b) => shadow(50, 97, 14) +
    `<path d="M50 78 Q44 84 50 90 Q56 94 50 98" fill="none" stroke="${INK}" stroke-width="2"/>` +
    limb('M24 46 Q12 44 10 34', a) + hand(10, 33) + limb('M76 46 Q88 44 90 34', a) + hand(90, 33) +
    `<ellipse cx="50" cy="42" rx="28" ry="34" fill="${a}" ${O}/><path d="M46 76 L54 76 L52 82 L48 82 Z" fill="${shade(a, -.2)}" ${O}/>` +
    `<path d="M32 30 Q34 16 46 12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M86 10 L88 16 L94 16 L89 20 L91 26 L86 22 L81 26 L83 20 L78 16 L84 16 Z" fill="${b}" ${O}/><circle cx="12" cy="14" r="3" fill="${b}" ${O}/>` + face(50, 44, .9) },
  glossy: { label: 'Glossy the epoxy pour', tags: 'epoxy floor coating garage concrete resin', colors: ['#8a5cff', '#c3cad2'], draw: (a, b) => shadow(50, 97, 34) +
    `<path d="M10 92 Q10 84 26 84 L74 84 Q92 84 90 92 Q90 97 70 97 L30 97 Q10 97 10 92 Z" fill="${a}" ${O}/><path d="M24 89 L44 89" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M60 40 Q64 64 58 86" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M60 40 Q64 64 58 86" fill="none" stroke="${a}" stroke-width="7" stroke-linecap="round"/>` +
    limb('M28 46 Q16 48 14 38', b) + hand(14, 37) +
    `<g transform="rotate(-18 50 34)"><path d="M26 16 L74 16 L70 56 Q70 60 66 60 L34 60 Q30 60 30 56 Z" fill="${b}" ${O}/><ellipse cx="50" cy="16" rx="24" ry="6" fill="${a}" ${O}/><path d="M26 16 Q50 -6 74 16" fill="none" stroke="${INK}" stroke-width="2.6"/>` +
    `<path d="M60 20 Q64 30 62 36 Q60 40 58 36 Q56 30 60 20 Z" fill="${a}" ${O}/>` + eyes(41, 59, 36, 4.8) + smile(50, 45, 5.8) + `</g>` + shine(82, 20, 1.1) + shine(22, 76, .7) },
  pup: { label: 'Pip the pup', tags: 'pet shop grooming dog walking veterinary', colors: ['#c98a4b', '#e8314a'], draw: (a, b) => shadow() +
    legs(50, 84, shade(a, -.3)) +
    `<ellipse cx="50" cy="72" rx="20" ry="16" fill="${a}" ${O}/><ellipse cx="50" cy="76" rx="11" ry="9" fill="#fff4e6"/>` +
    `<path d="M70 70 Q84 64 84 52" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M70 70 Q84 64 84 52" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="50" cy="38" r="24" fill="${a}" ${O}/>` +
    `<path d="M28 24 Q14 26 16 50 Q24 52 30 40 Z" fill="${shade(a, -.3)}" ${O}/><path d="M72 24 Q86 26 84 50 Q76 52 70 40 Z" fill="${shade(a, -.3)}" ${O}/>` +
    `<ellipse cx="50" cy="48" rx="12" ry="9" fill="#fff4e6" ${O}/><ellipse cx="50" cy="43" rx="4.6" ry="3.4" fill="${INK}"/>` +
    eyes(40, 60, 34, 5) + `<path d="M44 51 Q50 56 56 51" fill="none" ${O}/><path d="M48 54 Q50 62 54 56" fill="#f2727f" ${O}/>` +
    `<rect x="34" y="58" width="32" height="6" rx="3" fill="${b}" ${O}/><circle cx="50" cy="66" r="3.4" fill="#ffd23f" ${O}/>` },
  wheelie: { label: 'Zoomy the car', tags: 'driving school auto dealer car service detailing', colors: ['#e8314a', '#9fd8ff'], draw: (a, b) => shadow(50, 94, 40) +
    `<path d="M8 70 Q6 56 18 54 L26 36 Q30 28 40 28 L64 28 Q72 28 78 36 L86 52 Q96 54 94 70 Q94 78 86 78 L14 78 Q8 78 8 70 Z" fill="${a}" ${O}/>` +
    `<path d="M30 52 L36 36 Q38 33 42 33 L48 33 L48 52 Z" fill="${b}" ${O}/><path d="M54 52 L54 33 L62 33 Q66 33 68 36 L76 52 Z" fill="${b}" ${O}/>` +
    `<rect x="84" y="58" width="8" height="5" rx="2" fill="#ffe28a" ${O}/>` +
    [26, 74].map(x => `<circle cx="${x}" cy="80" r="10" fill="${INK}"/><circle cx="${x}" cy="80" r="4.4" fill="#c3cad2"/>`).join('') +
    eyes(40, 60, 62, 5) + grin(50, 70, 6) + `<path d="M24 46 Q26 40 30 38" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>` },
  flexy: { label: 'Flexy the dumbbell', tags: 'gym fitness personal trainer sports', colors: ['#2a3342', '#ff5a1f'], draw: (a, b) => shadow() +
    legs(50, 84, a) +
    `<rect x="4" y="12" width="12" height="30" rx="4" fill="${a}" ${O}/><rect x="84" y="12" width="12" height="30" rx="4" fill="${a}" ${O}/><rect x="16" y="23" width="68" height="8" rx="3" fill="#c3cad2" ${O}/>` +
    limb('M30 58 Q18 52 22 32', b) + hand(22, 30) + limb('M70 58 Q82 52 78 32', b) + hand(78, 30) +
    `<ellipse cx="50" cy="62" rx="24" ry="25" fill="${b}" ${O}/><path d="M34 56 Q36 46 44 42" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".7"/>` +
    `<rect x="28" y="44" width="44" height="6" rx="3" fill="${a}" ${O}/>` + face(50, 62, .85) },
  toolie: { label: 'Toolie the toolbox', tags: 'handyman renovation repair maintenance contractor', colors: ['#e8314a', '#8e99a6'], draw: (a, b) => shadow(50, 97, 32) +
    legs(50, 86, shade(a, -.35), 12, 6) +
    limb('M14 62 Q4 60 3 50', a) + hand(3, 49) + limb('M86 62 Q96 60 97 50', a) + hand(97, 49) +
    `<path d="M38 30 L38 20 Q38 16 42 16 L58 16 Q62 16 62 20 L62 30" fill="none" stroke="${INK}" stroke-width="8"/><path d="M38 30 L38 20 Q38 16 42 16 L58 16 Q62 16 62 20 L62 30" fill="none" stroke="${b}" stroke-width="3.4"/>` +
    `<path d="M24 30 L28 22 L36 30 Z M70 30 L76 18 L80 30 Z" fill="${b}" ${O}/>` +
    `<rect x="12" y="30" width="76" height="56" rx="7" fill="${a}" ${O}/><rect x="12" y="44" width="76" height="6" fill="${shade(a, -.25)}" ${O}/><rect x="44" y="42" width="12" height="10" rx="2" fill="#c3cad2" ${O}/>` +
    face(50, 66, .85) },
  cabby: { label: 'Cabby the kitchen cabinet', tags: 'kitchen cabinets carpentry millwork countertops', colors: ['#2f6f73', '#e9dcc6'], draw: (a, b) => shadow(50, 97, 30) +
    legs(50, 88, shade(a, -.35), 14, 5) +
    limb('M20 56 Q8 54 6 44', a) + hand(6, 43) + limb('M80 56 Q92 54 94 44', a) + hand(94, 43) +
    `<rect x="18" y="32" width="64" height="58" rx="4" fill="${a}" ${O}/><path d="M50 36 L50 88" fill="none" ${O}/>` +
    `<rect x="12" y="22" width="76" height="10" rx="3" fill="${b}" ${O}/><path d="M18 26 L40 26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>` +
    `<rect x="44" y="64" width="3" height="12" rx="1.5" fill="#d9dee4" ${O}/><rect x="53" y="64" width="3" height="12" rx="1.5" fill="#d9dee4" ${O}/>` +
    `<path d="M64 22 L64 6 Q64 2 70 2 L76 2 Q80 2 80 6" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M64 22 L64 6 Q64 2 70 2 L76 2 Q80 2 80 6" fill="none" stroke="#c3cad2" stroke-width="2.6" stroke-linecap="round"/>` +
    face(50, 48, .78) },
  saw: { label: 'Sawyer the saw', tags: 'carpentry woodwork framing decks fences', colors: ['#c3cad2', '#e8a03c'], draw: (a, b) => shadow(50, 97, 30) +
    legs(46, 84, shade(b, -.35), 8) +
    limb('M18 60 Q8 56 6 46', b) + hand(6, 45) +
    `<path d="M14 72 L14 30 Q14 26 18 26 L74 34 L80 72 Z" fill="${a}" ${O}/>` +
    `<path d="M14 72 L18 78 L22 72 L26 78 L30 72 L34 78 L38 72 L42 78 L46 72 L50 78 L54 72 L58 78 L62 72 L66 78 L70 72 L74 78 L80 72" fill="${a}" ${O}/>` +
    `<path d="M20 32 L60 38" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M74 30 L94 30 Q98 30 98 36 L98 66 Q98 72 92 72 L80 72 L74 34 Z" fill="${b}" ${O}/><rect x="83" y="40" width="9" height="20" rx="4" fill="${shade(b, -.3)}" ${O}/>` +
    face(44, 48, .82) },
};

export const MASCOTS = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, { label: v.label, tags: v.tags, colors: v.colors }]));
export const MASCOT_KEYS = Object.keys(C);
/** Inner SVG markup (100 × 100 box) for one mascot in colours a (body) and b (accent). */
export function mascotMarkup(key, a, b) { const m = C[key]; if (!m) return ''; return m.draw(a || m.colors[0], b || m.colors[1]); }
/** Stand-alone SVG string. */
export function mascotSVG(key, a, b, size = 100) { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${mascotMarkup(key, a, b)}</svg>`; }
export { lumOf };
