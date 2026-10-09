// Vector artwork for the 12 shop wrap designs (/satin/shop/vehicle-wrap-designs/<slug>).
// art(slug, W, H, {mirror, zone}) returns an SVG drawn in a W × H box that covers a vehicle side.
// Driver side: the vehicle faces left (u = 0 is the front). mirror=true lays the same design out for the
// passenger side (front on the right) while keeping all type readable. Text is placeholder branding
// ("YOUR LOGO", phone, web) because every design is re-branded for the customer.
export const DESIGNS = [
  { slug: 'delivery-dash', name: 'Delivery Dash', style: 'Sport', c: ['#f26b3a', '#5a5f66'] },
  { slug: 'real-estate-modern', name: 'Real Estate Modern', style: 'Commercial', c: ['#111111', '#c9a24a'] },
  { slug: 'cleaning-sparkle', name: 'Cleaning Sparkle', style: 'Abstract', c: ['#1aa6a6', '#ffffff'] },
  { slug: 'electric-volt', name: 'Electric Volt', style: 'Sport', c: ['#f5d000', '#141414'] },
  { slug: 'hvac-arctic', name: 'HVAC Arctic', style: 'Commercial', c: ['#2563c9', '#e23b3b'] },
  { slug: 'plumbing-pro', name: 'Plumbing Pro', style: 'Commercial', c: ['#1e4fa8', '#ffffff'] },
  { slug: 'landscaping-fresh', name: 'Landscaping Fresh', style: 'Sport', c: ['#2f8f4e', '#a7d46f'] },
  { slug: 'food-truck-feast', name: 'Food Truck Feast', style: 'Abstract', c: ['#e8314a', '#f7b733'] },
  { slug: 'construction-fleet', name: 'Construction Fleet', style: 'Commercial', c: ['#f2b705', '#1a1a1a'] },
  { slug: 'commercial-clean', name: 'Commercial Clean', style: 'Commercial', c: ['#2b4c6f', '#d9e2ec'] },
  { slug: 'sport-stripe', name: 'Sport Stripe', style: 'Sport', c: ['#e8314a', '#2563c9'] },
  { slug: 'abstract-flow', name: 'Abstract Flow', style: 'Abstract', c: ['#d42d80', '#3b82f6'] },
];
const FONT = "Inter, 'Inter Display', Arial, Helvetica, sans-serif";
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; };

// Text block on a readable info card: logo box + tagline + phone/web (+ optional pill line), in u/v units of the zone.
function brand(W, H, z, mirror, ink, accent, card, pill = '') {
  const w = (z.u1 - z.u0) * W, h = (z.v1 - z.v0) * H, y0 = z.v0 * H;
  const bx = mirror ? W - z.u1 * W : z.u0 * W; // mirror the position, never the glyphs
  const fs = Math.min(h * .19, w * .075), pad = fs * .55, iw = w - pad * 2, top = y0 + pad;
  const rows = pill ? 1.22 : 1;
  return `<g id="text-placeholders" font-family="${FONT}" fill="${ink}">
  <rect x="${bx}" y="${y0}" width="${w}" height="${h * rows}" rx="${fs * .45}" fill="${card[0]}" opacity="${card[1]}"/>
  <rect x="${bx + pad}" y="${top}" width="${iw * .6}" height="${h * .36}" rx="${fs * .25}" fill="none" stroke="${ink}" stroke-width="${Math.max(2, fs * .06)}" stroke-dasharray="${fs * .22} ${fs * .16}" opacity=".85"/>
  <text x="${bx + pad + iw * .3}" y="${top + h * .18 + fs * .36}" font-size="${fs}" font-weight="800" text-anchor="middle" letter-spacing="${fs * .04}">YOUR LOGO</text>
  <text x="${bx + pad}" y="${top + h * .36 + fs * .95}" font-size="${fs * .5}" font-weight="600" opacity=".9">Your services · Your tagline here</text>
  <text x="${bx + pad}" y="${y0 + h - pad * .9}" font-size="${fs * .86}" font-weight="900" fill="${accent}">905-000-0000</text>
  <text x="${bx + w - pad}" y="${y0 + h - pad * .9}" font-size="${fs * .58}" font-weight="700" text-anchor="end">yourbrand.ca</text>
  ${pill ? `<rect x="${bx + pad}" y="${y0 + h + fs * .05}" width="${iw}" height="${h * .2 - fs * .1}" rx="${fs * .2}" fill="#141414"/><text x="${bx + w / 2}" y="${y0 + h + h * .1 + fs * .16}" font-size="${fs * .46}" font-weight="800" fill="#fff" text-anchor="middle">${pill}</text>` : ''}
</g>`;
}

const MOTIF = {
  // Speed stripes sweeping forward from the rear + a tracking-URL panel.
  'delivery-dash': (W, H, [a, b]) => `
    <path d="M${W * .30} ${H} L${W * .62} 0 L${W * .74} 0 L${W * .42} ${H} Z" fill="${a}"/>
    <path d="M${W * .45} ${H} L${W * .77} 0 L${W * .82} 0 L${W * .50} ${H} Z" fill="${b}"/>
    <path d="M${W * .56} ${H} L${W * .88} 0 L${W * 1.05} 0 L${W * 1.05} ${H} Z" fill="${a}"/>
    <path d="M0 ${H * .80} L${W * .40} ${H * .80} L${W * .36} ${H * .88} L0 ${H * .88} Z" fill="${b}"/>`,
  'real-estate-modern': (W, H, [a, b]) => `
    <path d="M${W * .38} 0 L${W * 1.05} 0 L${W * 1.05} ${H} L${W * .26} ${H} Z" fill="${a}"/>
    <path d="M${W * .355} 0 L${W * .372} 0 L${W * .252} ${H} L${W * .235} ${H} Z" fill="${b}"/>
    <rect x="0" y="${H * .86}" width="${W * .3}" height="${H * .03}" fill="${b}"/>
    <circle cx="${W * .72}" cy="${H * .7}" r="${H * .12}" fill="none" stroke="${b}" stroke-width="${H * .012}"/>
    <rect x="${W * .845}" y="${H * .6}" width="${H * .2}" height="${H * .2}" fill="#fff"/><rect x="${W * .845 + H * .03}" y="${H * .63}" width="${H * .06}" height="${H * .06}" fill="${a}"/><rect x="${W * .845 + H * .11}" y="${H * .63}" width="${H * .06}" height="${H * .06}" fill="${a}"/><rect x="${W * .845 + H * .03}" y="${H * .71}" width="${H * .06}" height="${H * .06}" fill="${a}"/>`,
  'cleaning-sparkle': (W, H, [a]) => {
    const star = (x, y, r, o = 1) => `<path d="M${x} ${y - r} Q${x + r * .18} ${y - r * .18} ${x + r} ${y} Q${x + r * .18} ${y + r * .18} ${x} ${y + r} Q${x - r * .18} ${y + r * .18} ${x - r} ${y} Q${x - r * .18} ${y - r * .18} ${x} ${y - r} Z" fill="${a}" opacity="${o}"/>`;
    return `<path d="M0 ${H * .70} C${W * .25} ${H * .55} ${W * .45} ${H * .9} ${W * .7} ${H * .68} S${W} ${H * .58} ${W * 1.05} ${H * .62} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>
    <path d="M0 ${H * .80} C${W * .3} ${H * .68} ${W * .5} ${H * .98} ${W * .75} ${H * .80} S${W} ${H * .72} ${W * 1.05} ${H * .76}" fill="none" stroke="#fff" stroke-width="${H * .025}" opacity=".85"/>
    ${star(W * .93, H * .2, H * .09)}${star(W * .86, H * .36, H * .05, .8)}${star(W * .97, H * .42, H * .04, .7)}${star(W * .12, H * .5, H * .05, .6)}`;
  },
  'electric-volt': (W, H, [a, b]) => `
    <rect x="0" y="0" width="${W * 1.05}" height="${H}" fill="${b}"/>
    <path d="M${W * .30} ${H} L${W * .52} ${H * .48} L${W * .47} ${H * .48} L${W * .66} 0 L${W * .74} 0 L${W * .58} ${H * .40} L${W * .64} ${H * .40} L${W * .40} ${H} Z" fill="${a}"/>
    <path d="M${W * .78} ${H} L${W * .9} ${H * .55} L${W * .87} ${H * .55} L${W * 1.0} ${H * .1} L${W * 1.05} ${H * .1} L${W * 1.05} ${H} Z" fill="${a}"/>
    <rect x="0" y="${H * .84}" width="${W * .32}" height="${H * .04}" fill="${a}"/>`,
  'hvac-arctic': (W, H, [a, b]) => `
    <path d="M0 0 L${W * .58} 0 L${W * .44} ${H} L0 ${H} Z" fill="${a}"/>
    <path d="M${W * .64} 0 L${W * 1.05} 0 L${W * 1.05} ${H} L${W * .50} ${H} Z" fill="${b}"/>
    <path d="M${W * .58} 0 L${W * .64} 0 L${W * .50} ${H} L${W * .44} ${H} Z" fill="#fff"/>
    <g stroke="#fff" stroke-width="${H * .018}" stroke-linecap="round" opacity=".9" transform="translate(${W * .14} ${H * .74})">${[0, 60, 120].map(r => `<path transform="rotate(${r})" d="M0 ${-H * .09} L0 ${H * .09} M${-H * .03} ${-H * .06} L0 ${-H * .09} L${H * .03} ${-H * .06} M${-H * .03} ${H * .06} L0 ${H * .09} L${H * .03} ${H * .06}"/>`).join('')}</g>
    <path transform="translate(${W * .93} ${H * .78})" d="M0 ${-H * .11} C${H * .07} ${-H * .04} ${H * .08} ${H * .02} ${H * .04} ${H * .08} C${H * .02} ${H * .03} ${-H * .01} ${H * .02} ${-H * .02} ${-H * .02} C${-H * .06} ${H * .02} ${-H * .07} ${H * .06} ${-H * .04} ${H * .09} C${-H * .1} ${H * .05} ${-H * .08} ${-H * .05} 0 ${-H * .11} Z" fill="#fff" opacity=".9"/>`,
  'plumbing-pro': (W, H, [a]) => `
    <path d="M0 ${H * .62} C${W * .15} ${H * .5} ${W * .3} ${H * .74} ${W * .45} ${H * .62} S${W * .75} ${H * .5} ${W * .9} ${H * .62} S${W * 1.05} ${H * .7} ${W * 1.05} ${H * .66} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>
    <path d="M0 ${H * .74} C${W * .15} ${H * .62} ${W * .3} ${H * .86} ${W * .45} ${H * .74} S${W * .75} ${H * .62} ${W * .9} ${H * .74} S${W * 1.05} ${H * .82} ${W * 1.05} ${H * .78}" fill="none" stroke="#7fb2ff" stroke-width="${H * .03}"/>
    <path transform="translate(${W * .93} ${H * .3})" d="M0 ${-H * .12} C${H * .08} 0 ${H * .09} ${H * .06} ${H * .06} ${H * .1} A${H * .085} ${H * .085} 0 0 1 ${-H * .06} ${H * .1} C${-H * .09} ${H * .06} ${-H * .08} 0 0 ${-H * .12} Z" fill="${a}"/>`,
  'landscaping-fresh': (W, H, [a, b]) => `
    <path d="M0 ${H * .72} C${W * .2} ${H * .58} ${W * .4} ${H * .66} ${W * .6} ${H * .56} S${W * .9} ${H * .5} ${W * 1.05} ${H * .46} L${W * 1.05} ${H} L0 ${H} Z" fill="${b}"/>
    <path d="M0 ${H * .82} C${W * .25} ${H * .7} ${W * .45} ${H * .8} ${W * .65} ${H * .7} S${W * .95} ${H * .64} ${W * 1.05} ${H * .62} L${W * 1.05} ${H} L0 ${H} Z" fill="${a}"/>
    ${[[.88, .2, 1], [.95, .3, .8], [.82, .33, .7]].map(([u, v, s]) => `<path transform="translate(${W * u} ${H * v}) rotate(${-30 + u * 40}) scale(${s})" d="M0 ${H * .1} C${H * .1} ${H * .02} ${H * .08} ${-H * .08} 0 ${-H * .12} C${-H * .08} ${-H * .08} ${-H * .1} ${H * .02} 0 ${H * .1} Z" fill="${a}"/>`).join('')}`,
  'food-truck-feast': (W, H, [a, b]) => `
    <rect x="0" y="0" width="${W * 1.05}" height="${H}" fill="${a}"/>
    <path d="M0 ${H * .66} C${W * .3} ${H * .52} ${W * .6} ${H * .82} ${W * 1.05} ${H * .6} L${W * 1.05} ${H} L0 ${H} Z" fill="${b}"/>
    ${Array.from({ length: 26 }, (_, i) => `<circle cx="${W * (0.05 + (i * 37 % 100) / 105)}" cy="${H * (0.08 + (i * 53 % 40) / 100)}" r="${H * (.008 + (i % 4) * .004)}" fill="${b}" opacity=".55"/>`).join('')}`,
  'construction-fleet': (W, H, [a, b]) => `
    <rect x="0" y="${H * .68}" width="${W * 1.05}" height="${H * .32}" fill="${b}"/>
    ${Array.from({ length: 14 }, (_, i) => `<path d="M${W * .02 + i * W * .075} ${H * .7} l${W * .03} 0 l${W * .03} ${H * .14} l${-W * .03} ${H * .14} l${-W * .03} 0 l${W * .03} ${-H * .14} Z" fill="${a}"/>`).join('')}
    <path d="M${W * .72} 0 L${W * 1.05} 0 L${W * 1.05} ${H * .68} L${W * .58} ${H * .68} Z" fill="${a}"/>`,
  'commercial-clean': (W, H, [a, b]) => `
    <rect x="0" y="0" width="${W * 1.05}" height="${H}" fill="${b}"/>
    <path d="M${W * .36} ${H * .54} L${W * 1.05} ${H * .54} L${W * 1.05} ${H} L${W * .26} ${H} Z" fill="${a}"/>
    <rect x="0" y="${H * .8}" width="${W * .24}" height="${H * .2}" fill="${a}"/>
    <g font-family="${FONT}" font-weight="700" font-size="${H * .04}" fill="#fff"><text x="${W * .42}" y="${H * .63}">SERVICE ONE · SERVICE TWO · SERVICE THREE · SERVICE FOUR</text></g>`,
  'sport-stripe': (W, H, [a, b]) => `
    <path d="M0 ${H * .55} L${W * 1.05} ${H * .28} L${W * 1.05} ${H * .42} L0 ${H * .69} Z" fill="${a}"/>
    <path d="M0 ${H * .72} L${W * 1.05} ${H * .45} L${W * 1.05} ${H * .51} L0 ${H * .78} Z" fill="${b}"/>
    <path d="M0 ${H * .81} L${W * 1.05} ${H * .54} L${W * 1.05} ${H * .57} L0 ${H * .84} Z" fill="${a}"/>`,
  'abstract-flow': (W, H, [a, b]) => `
    <path d="M${W * .2} ${H} C${W * .35} ${H * .5} ${W * .55} ${H * .9} ${W * .7} ${H * .3} S${W * .95} ${-H * .1} ${W * 1.05} ${H * .1} L${W * 1.05} ${H} Z" fill="${a}"/>
    <path d="M${W * .45} ${H} C${W * .6} ${H * .6} ${W * .75} ${H * .95} ${W * .85} ${H * .45} S${W} ${H * .2} ${W * 1.05} ${H * .3} L${W * 1.05} ${H} Z" fill="${b}" opacity=".92"/>
    <circle cx="${W * .12}" cy="${H * .78}" r="${H * .07}" fill="${b}" opacity=".85"/><circle cx="${W * .2}" cy="${H * .7}" r="${H * .035}" fill="${a}"/>`,
};
// Designs whose info card is dark (white type) and the colour of the phone number.
const DARK = new Set(['electric-volt', 'real-estate-modern', 'food-truck-feast']);
const ACCENT = { 'electric-volt': '#f5d000', 'real-estate-modern': '#c9a24a', 'food-truck-feast': '#ffd166', 'cleaning-sparkle': '#128585', 'construction-fleet': '#141414', 'landscaping-fresh': '#2f8f4e', 'commercial-clean': '#2b4c6f' };

export function art(slug, W, H, o = {}) {
  const d = DESIGNS.find(x => x.slug === slug); if (!d) throw Error('unknown design ' + slug);
  const z = o.zone || { u0: .44, u1: .94, v0: .16, v1: .52 };
  const dark = DARK.has(slug), ink = dark ? '#ffffff' : '#141414';
  const accent = ACCENT[slug] || (lum(d.c[0]) > .7 ? '#141414' : d.c[0]);
  const card = dark ? ['#0d0f12', .78] : ['#ffffff', .93];
  const pill = slug === 'delivery-dash' ? 'TRACK YOUR DELIVERY · yourbrand.ca/track' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<title>${d.name} — vehicle wrap design (${o.mirror ? 'passenger' : 'driver'} side)</title>
<g id="background"><rect width="${W}" height="${H}" fill="#f7f7f5"/></g>
<g id="graphics"${o.mirror ? ` transform="matrix(-1 0 0 1 ${W} 0)"` : ''}>${MOTIF[slug](W, H, d.c)}</g>
${brand(W, H, z, !!o.mirror, ink, accent, card, pill)}
</svg>`;
}
