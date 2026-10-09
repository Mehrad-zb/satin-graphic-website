// Builds the wrap-design product images and the standard download packages.
//   node scripts/wrap-designs/build.mjs [slug ...]
// Needs Playwright + Chromium (PLAYWRIGHT_BROWSERS_PATH) and python3 with Pillow.
// Output:
//   dist/client/satin/img/wrap-designs/<slug>/<view>-<width>.webp   (public mockups, responsive widths, never upscaled)
//   dist/client/satin/img/wrap-designs/manifest.json                 (views + widths + captions, read by wrap-design-ui.mjs)
//   ../hp/php/satin-new/wrap-designs/<slug>.zip                      (PRIVATE download package: SVG + vector PDF + preview + README)
// Mockups put the design on real side-profile vehicle photos (visualizer/cars: photo + paint mask). Only true side views
// exist, so the gallery shows driver side, passenger side (mirrored photo, readable text), other bodies, a native-resolution
// detail crop and the flat layout — no invented 3/4 or roof angles.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { DESIGNS, art } from './art.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); // e.g. PLAYWRIGHT_MODULE=/path/node_modules/playwright/index.mjs
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const CARS = ROOT + '/dist/client/visualizer/cars/';
const OUT = ROOT + '/dist/client/satin/img/wrap-designs/';
const PKG = path.resolve(ROOT, '../hp/php/satin-new/wrap-designs/');
const TMP = fs.mkdtempSync('/tmp/wrapdesigns-');
// Text zones (u = 0 front → 1 rear, v = 0 top → 1 bottom of the paint box) and the template size each body uses.
const BODIES = {
  sprinter: { label: 'High-roof cargo van', zone: { u0: .42, u1: .93, v0: .12, v1: .42 }, size: '170 × 75 in' },
  van: { label: 'Mid-roof cargo van', zone: { u0: .42, u1: .93, v0: .16, v1: .46 }, size: '150 × 62 in' },
  pickup: { label: 'Crew-cab pickup', zone: { u0: .29, u1: .63, v0: .30, v1: .52 }, size: '230 × 46 in' },
  minivan: { label: 'Minivan', zone: { u0: .31, u1: .72, v0: .42, v1: .68 }, size: '200 × 45 in' },
};
const VIEWS = [
  { key: 'hero', car: 'sprinter', mirror: false, caption: 'Driver side · high-roof van', widths: [640, 1100, 1600] },
  { key: 'passenger', car: 'sprinter', mirror: true, caption: 'Passenger side · mirrored layout', widths: [640, 1100, 1600] },
  { key: 'van', car: 'van', mirror: false, caption: 'Driver side · mid-roof van', widths: [640, 1100, 1600] },
  { key: 'pickup', car: 'pickup', mirror: false, caption: 'Driver side · pickup', widths: [640, 1100, 1600] },
  { key: 'minivan', car: 'minivan', mirror: false, caption: 'Driver side · minivan', widths: [640, 1100, 1600] },
  { key: 'detail', car: 'sprinter', mirror: false, crop: [560, 170, 900, 600], caption: 'Detail · branding panel (actual pixels)', widths: [640, 900] },
  { key: 'layout', flat: true, caption: 'Flat layout · driver side panel (vector)', widths: [640, 1100, 1600] },
];
const only = process.argv.slice(2);
const b64 = f => 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');
const browser = await chromium.launch();
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
await page.setContent('<!doctype html><body style="margin:0"></body>');
const cars = {};
for (const c of Object.keys(BODIES)) cars[c] = { photo: b64(CARS + c + '.webp'), mask: b64(CARS + c + '-mask.webp') };
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(PKG, { recursive: true });
const manifest = { generated: new Date().toISOString().slice(0, 10), views: VIEWS.map(v => ({ key: v.key, caption: v.caption, widths: v.widths })), designs: {} };
const resize = (src, dst, widths, crop) => execFileSync('python3', ['-c', `
import sys,json
from PIL import Image
src,dst,widths,crop=sys.argv[1],sys.argv[2],json.loads(sys.argv[3]),json.loads(sys.argv[4])
im=Image.open(src).convert('RGB')
if crop: x,y,w,h=crop; im=im.crop((x,y,x+w,y+h))
for w in widths:
    w=min(w,im.width); h=round(im.height*w/im.width)
    (im if w==im.width else im.resize((w,h),Image.LANCZOS)).save(f'{dst}-{w}.webp','WEBP',quality=84,method=6)
print(im.width,im.height)`, src, dst, JSON.stringify(widths), JSON.stringify(crop || null)]).toString().trim().split(' ').map(Number);

for (const d of DESIGNS) {
  if (only.length && !only.includes(d.slug)) continue;
  const dir = OUT + d.slug + '/'; fs.mkdirSync(dir, { recursive: true });
  const entry = manifest.designs[d.slug] = { name: d.name, colours: d.c, views: {} };
  for (const v of VIEWS) {
    let png;
    if (v.flat) {
      const W = 2400, H = Math.round(2400 * 54 / 144), svg = art(d.slug, W, H, { zone: BODIES.sprinter.zone });
      png = await page.evaluate(async ({ svg, W, H }) => {
        const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode();
        const pad = 90, c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2 + 60; const g = c.getContext('2d');
        g.fillStyle = '#eef0f3'; g.fillRect(0, 0, c.width, c.height); g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
        g.drawImage(img, pad, pad, W, H); g.shadowColor = 'transparent';
        g.strokeStyle = '#e8314a'; g.setLineDash([18, 12]); g.lineWidth = 4; g.strokeRect(pad + 24, pad + 24, W - 48, H - 48);
        g.fillStyle = '#4b5563'; g.font = '600 34px Inter, Arial'; g.fillText('Driver side panel · scaled 1:1 to your vehicle template · dashed line = safe area', pad, H + pad + 62);
        return c.toDataURL('image/png');
      }, { svg, W, H });
    } else {
      const body = BODIES[v.car];
      png = await page.evaluate(async ({ car, svgFor, mirror }) => {
        const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
        const [photo, mask] = await Promise.all([load(car.photo), load(car.mask)]);
        const Wc = photo.width, Hc = photo.height, cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
        const [mc, mg] = cv(Wc, Hc); if (mirror) { mg.translate(Wc, 0); mg.scale(-1, 1); } mg.drawImage(mask, 0, 0);
        const md = mg.getImageData(0, 0, Wc, Hc), px = md.data; let x0 = Wc, y0 = Hc, x1 = 0, y1 = 0;
        for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) { const i = (y * Wc + x) * 4, r = px[i]; if (r > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        return { box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
      }, { car: cars[v.car], svgFor: null, mirror: v.mirror });
      const [bx, by, bw, bh] = png.box, svg = art(d.slug, bw, bh, { mirror: v.mirror, zone: body.zone });
      png = await page.evaluate(async ({ car, svg, mirror, box }) => {
        const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
        const [photo, mask, a] = await Promise.all([load(car.photo), load(car.mask), load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg))]);
        const Wc = photo.width, Hc = photo.height, cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
        const flip = g => { if (mirror) { g.translate(Wc, 0); g.scale(-1, 1); } };
        const [c, g] = cv(Wc, Hc); g.save(); flip(g); g.drawImage(photo, 0, 0); g.restore();
        const [mc, mg] = cv(Wc, Hc); mg.save(); flip(mg); mg.drawImage(mask, 0, 0); mg.restore();
        const [o, og] = cv(Wc, Hc); og.drawImage(a, box[0], box[1], box[2], box[3]);
        const od = og.getImageData(0, 0, Wc, Hc), md = mg.getImageData(0, 0, Wc, Hc).data;
        for (let i = 0; i < od.data.length; i += 4) od.data[i + 3] = Math.round(od.data[i + 3] * Math.max(0, md[i] - md[i + 1] * .5) / 255); // paint (R), not glass (G)
        og.putImageData(od, 0, 0);
        g.globalCompositeOperation = 'multiply'; g.drawImage(o, 0, 0); g.globalCompositeOperation = 'source-over';
        return c.toDataURL('image/png');
      }, { car: cars[v.car], svg, mirror: v.mirror, box: png.box });
    }
    const tmp = TMP + '/' + d.slug + '-' + v.key + '.png'; fs.writeFileSync(tmp, Buffer.from(png.split(',')[1], 'base64'));
    for (const f of fs.readdirSync(dir)) if (f.startsWith(v.key + '-')) fs.unlinkSync(dir + f);
    const [w, h] = resize(tmp, dir + v.key, v.widths, v.crop);
    entry.views[v.key] = { w, h, widths: v.widths.map(x => Math.min(x, w)).filter((x, i, a) => a.indexOf(x) === i) };
  }
  // ---- private download package ----
  const pk = TMP + '/' + d.slug; fs.mkdirSync(pk, { recursive: true });
  const W = 14400, H = 5400; // 144 × 54 in panel at 100 units per inch
  for (const [side, mirror] of [['driver-side', false], ['passenger-side', true]]) {
    const svg = art(d.slug, W, H, { mirror, zone: BODIES.sprinter.zone }).replace('<svg ', '<svg data-units="0.01in" ').replace(`width="${W}" height="${H}"`, 'width="144in" height="54in"');
    fs.writeFileSync(`${pk}/${d.slug}_${side}_144x54in.svg`, svg);
  }
  const pdfPage = await browser.newPage();
  const sides = ['driver-side', 'passenger-side'].map(s => fs.readFileSync(`${pk}/${d.slug}_${s}_144x54in.svg`, 'utf8').replace('width="144in" height="54in"', 'width="100%" height="100%"'));
  await pdfPage.setContent(`<!doctype html><style>@page{size:144in 54in;margin:0}html,body{margin:0}div{width:144in;height:54in;page-break-after:always;overflow:hidden}svg{display:block}</style>${sides.map(s => `<div>${s}</div>`).join('')}`);
  await pdfPage.pdf({ path: `${pk}/${d.slug}_print-ready_144x54in.pdf`, width: '144in', height: '54in', printBackground: true });
  await pdfPage.close();
  execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"JPEG",quality=90)', TMP + '/' + d.slug + '-hero.png', `${pk}/${d.slug}_preview.jpg`]);
  fs.writeFileSync(`${pk}/README.txt`, `${d.name} — vehicle wrap design (Satin Graphic)
=====================================================

Files
- ${d.slug}_print-ready_144x54in.pdf  Vector PDF, page 1 driver side, page 2 passenger side, 144 × 54 in at 1:1.
                                     Opens in Adobe Illustrator, CorelDRAW, Affinity Designer, Inkscape, Adobe Acrobat, FlexiSIGN / SAi.
- ${d.slug}_driver-side_144x54in.svg  Layered vector source (layers: background, graphics, text-placeholders).
- ${d.slug}_passenger-side_144x54in.svg
- ${d.slug}_preview.jpg               Mockup preview (not for print).

How to use
1. Open the PDF or SVG in your design software and replace the placeholder logo, services, phone number and web address.
2. Scale the panel to your vehicle template (measure the vehicle; keep 2-3 in bleed on every edge).
3. Convert text to outlines and export at 1:1 for your printer (or send it to Satin Graphic to print and install).

Colours: ${d.c.join(', ')} (sRGB). Ask us for Pantone / CMYK matches before printing.

Licence (summary): single-business licence for vehicles you own or operate. Resale or redistribution of the design files is not permitted.
Full terms: https://satingraphic.ca/satin/design-agreement/

Need it adjusted to your exact vehicle? Order "Need adjustment for your vehicle" or email info@satingraphic.ca · 905-962-6222.
`);
  fs.rmSync(`${PKG}/${d.slug}.zip`, { force: true });
  execFileSync('python3', ['-c', 'import sys,os,zipfile\nz=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED)\nfor f in sorted(os.listdir(sys.argv[1])): z.write(os.path.join(sys.argv[1],f),"'+d.slug+'-wrap-design/"+f)\nz.close()', pk, `${PKG}/${d.slug}.zip`]);
  entry.package = { file: `${d.slug}-wrap-design.zip`, bytes: fs.statSync(`${PKG}/${d.slug}.zip`).size, files: fs.readdirSync(pk).sort() };
  console.log(d.slug, JSON.stringify(entry.views.hero), entry.package.bytes);
}
const mf = OUT + 'manifest.json';
if (only.length && fs.existsSync(mf)) { const old = JSON.parse(fs.readFileSync(mf, 'utf8')); manifest.designs = { ...old.designs, ...manifest.designs }; }
fs.writeFileSync(mf, JSON.stringify(manifest));
await browser.close(); fs.rmSync(TMP, { recursive: true, force: true });
