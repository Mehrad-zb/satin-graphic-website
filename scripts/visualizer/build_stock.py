# Builds Wrap Visualizer "stock car" assets from paired studio photos of the same car in gloss white and gloss black
# (identical pose/lighting; generated once per model). The difference between the two photos is the paint:
#   D = L_white - L_black  (diffuse shading: how much light each panel receives)
#   S = L_black            (clear-coat reflections: identical on any colour)
# so any film can be re-lit with the car's real shading and reflections.
# Usage: python3 build_stock.py SRC_DIR OUT_DIR   (SRC_DIR has <slug>-white.png + <slug>-black.png and cars.json)
import numpy as np, cv2, json, os, sys
from PIL import Image
from scipy import ndimage
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
lin = lambda x: np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
enc = lambda a: (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
cars = json.load(open(os.path.join(SRC, 'cars.json')))
# Satin Graphic wordmark printed on the (blank) front plate, like a dealer plate
LOGO = np.asarray(Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../dist/client/satin/img/logo.optimized.webp')).convert('RGB')).astype(np.float32) / 255
def plate_logo(img, pc):
  cs, _ = cv2.findContours(pc.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
  if not cs: return img
  c = max(cs, key=cv2.contourArea); peri = cv2.arcLength(c, True); quad = None
  for e in np.linspace(0.01, 0.08, 15):
    a = cv2.approxPolyDP(c, e * peri, True)
    if len(a) == 4: quad = a.reshape(4, 2).astype(np.float32); break
  if quad is None: quad = cv2.boxPoints(cv2.minAreaRect(c)).astype(np.float32)
  sm, df = quad.sum(1), np.diff(quad, axis=1).ravel()
  quad = np.array([quad[sm.argmin()], quad[df.argmin()], quad[sm.argmax()], quad[df.argmax()]], np.float32)  # tl, tr, br, bl
  pw_, ph_ = 600, 220; card = np.ones((ph_, pw_, 3), np.float32)
  lw = int(pw_ * 0.84); lh = int(lw * LOGO.shape[0] / LOGO.shape[1])
  card[(ph_ - lh) // 2:(ph_ - lh) // 2 + lh, (pw_ - lw) // 2:(pw_ - lw) // 2 + lw] = cv2.resize(LOGO, (lw, lh), interpolation=cv2.INTER_AREA)
  # keep clear of the plate's rounded frame
  ins = 0.07; src = np.float32([[pw_ * ins, ph_ * ins * 2], [pw_ * (1 - ins), ph_ * ins * 2], [pw_ * (1 - ins), ph_ * (1 - ins * 2)], [pw_ * ins, ph_ * (1 - ins * 2)]])
  M = cv2.getPerspectiveTransform(np.float32([[0, 0], [pw_, 0], [pw_, ph_], [0, ph_]]), quad)
  Hh, Ww = img.shape[:2]
  warped = cv2.warpPerspective(card, M, (Ww, Hh), flags=cv2.INTER_AREA, borderValue=(1, 1, 1))
  # print onto the plate: multiply keeps the plate's own shading and reflections
  return img * warped
index = []
old = {}
if os.path.exists(os.path.join(OUT, 'stock.json')):
  for c in json.load(open(os.path.join(OUT, 'stock.json'))).get('cars', []): old[c['id']] = c
only = sys.argv[3:]
for car in cars:
  slug = car['id']
  wp, bp = os.path.join(SRC, slug + '-white.png'), os.path.join(SRC, slug + '-black.png')
  if not (os.path.exists(wp) and os.path.exists(bp)):
    if slug in old: index.append(old[slug])
    continue
  if only and slug not in only:
    if slug in old: index.append(old[slug])
    continue
  Wt = np.asarray(Image.open(wp).convert('RGB')).astype(np.float32) / 255
  Bk = np.asarray(Image.open(bp).convert('RGB')).astype(np.float32) / 255
  if Bk.shape != Wt.shape: Bk = cv2.resize(Bk, (Wt.shape[1], Wt.shape[0]), interpolation=cv2.INTER_AREA)
  H, W = Wt.shape[:2]
  Lw, Lb = lin(Wt).mean(-1), lin(Bk).mean(-1)
  dd = Lw - Lb
  L = Wt.mean(-1); sat = Wt.max(-1) - Wt.min(-1)
  # paint: hysteresis threshold on the white/black difference (strong seeds, weaker shaded panels connected to them)
  strong = dd > 0.22
  strong = cv2.morphologyEx(strong.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
  weak = dd > 0.06
  lab, n = ndimage.label(weak)
  keep = np.zeros(n + 1, bool); keep[np.unique(lab[strong])] = True; keep[0] = False
  paint = keep[lab]
  lab, n = ndimage.label(paint)
  if n:
    sizes = ndimage.sum(paint, lab, range(1, n + 1)); big = np.zeros(n + 1, bool); big[1:] = sizes > 600; paint = big[lab]
  # body silhouette: anything that differs from the (smooth) studio background, plus the paint
  bgest = cv2.GaussianBlur(cv2.medianBlur((Wt * 255).astype(np.uint8), 31).astype(np.float32) / 255, (0, 0), 40)
  carm = (np.abs(Wt - bgest).sum(-1) > 0.12) | paint
  carm = cv2.morphologyEx(carm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)).astype(bool)
  ys, xs = np.where(paint); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
  ch = y1 - y0
  # glass: large dark, unpainted regions in the upper half of the car (for window tint)
  non = (carm & ~paint & (L < 0.6) & (sat < 0.18)).astype(np.uint8)
  non = cv2.morphologyEx(non, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
  lab, n = ndimage.label(non)
  glass = np.zeros((H, W), bool)
  for i, sl in enumerate(ndimage.find_objects(lab), 1):
    if sl is None: continue
    comp = lab[sl] == i; area = comp.sum(); cy = (sl[0].start + sl[0].stop) / 2
    if area > 1500 and cy < y0 + 0.42 * ch and (sl[1].stop - sl[1].start) > 40 and L[sl][comp].mean() < 0.42: glass[sl] |= comp
  glass = ndimage.binary_fill_holes(cv2.morphologyEx(glass.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)).astype(bool)) & ~paint
  # licence plate: the generative black edit can move it a few pixels. Find the bright rectangle in the black photo,
  # locate the same plate in the white photo by edge matching, keep that out of the paint and inpaint the sliver it left.
  fix = np.zeros((H, W), bool); plates = []
  Lk = Bk.mean(-1); satk = Bk.max(-1) - Bk.min(-1)
  gw = cv2.magnitude(cv2.Sobel(Wt.mean(-1), cv2.CV_32F, 1, 0), cv2.Sobel(Wt.mean(-1), cv2.CV_32F, 0, 1))
  gk = cv2.magnitude(cv2.Sobel(Lk, cv2.CV_32F, 1, 0), cv2.Sobel(Lk, cv2.CV_32F, 0, 1))
  # bright, neutral and flat; the plate's own edge cuts it off from a chrome / silver bumper around it
  lab, n = ndimage.label(cv2.morphologyEx(((Lk > 0.6) & (satk < 0.12) & (gk < 0.25)).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)))
  for i, sl in enumerate(ndimage.find_objects(lab), 1):
    if sl is None: continue
    comp = lab[sl] == i; h_, w_ = comp.shape; cy = (sl[0].start + sl[0].stop) / 2
    if comp.sum() < 600 or not (1.6 < w_ / max(1, h_) < 6) or comp.mean() < 0.7 or not (y0 + 0.3 * ch < cy < y1): continue
    vals = Lk[sl][comp]
    if vals.mean() < 0.68 or vals.std() > 0.08: continue  # a blank plate is evenly white; chrome trim is not
    if (sl[1].start + sl[1].stop) / 2 > x0 + 0.45 * (x1 - x0) or w_ > 0.22 * (x1 - x0): continue  # front plate: the car faces left
    # grow back the 1-2 px rim the flatness test removed, so the outline matches the real plate edge
    g = np.zeros((H, W), np.uint8); g[sl] = comp; g = cv2.dilate(g, np.ones((5, 5), np.uint8))
    sl = ndimage.find_objects(g)[0]; comp = g[sl] > 0; h_, w_ = comp.shape
    m, r = 6, 28
    ty0, ty1, tx0, tx1 = sl[0].start - m, sl[0].stop + m, sl[1].start - m, sl[1].stop + m
    sy0, sy1, sx0, sx1 = ty0 - r, ty1 + r, tx0 - r, tx1 + r
    if sy0 < 0 or sx0 < 0 or sy1 > H or sx1 > W: continue
    # template = the plate's outline only (the paint around it differs between the photos, the plate edge does not)
    outline = np.zeros((ty1 - ty0, tx1 - tx0), np.uint8); outline[m:m + h_, m:m + w_] = comp
    outline = cv2.GaussianBlur(cv2.morphologyEx(outline, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 1)
    res = cv2.matchTemplate(gw[sy0:sy1, sx0:sx1], outline, cv2.TM_CCOEFF_NORMED)
    yy_, xx_ = np.mgrid[0:res.shape[0], 0:res.shape[1]]
    res = res - 0.012 * np.hypot(yy_ - r, xx_ - r)  # small shifts are far more likely than big ones
    _, score, _, (bx, by) = cv2.minMaxLoc(res); dy, dx = by - r, bx - r
    pk = np.zeros((H, W), bool); pk[sl] = comp; pk = cv2.dilate(pk.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    pw = np.roll(np.roll(pk, dy, 0), dx, 1) if score > 0.2 else pk
    print('  plate', sl[1].start, sl[0].start, w_, h_, 'shift', dx, dy, 'score', round(score, 2))
    pc = np.zeros((H, W), bool); pc[sl] = comp
    if score > 0.2: pc = np.roll(np.roll(pc, dy, 0), dx, 1)
    plates.append(pc)
    fix |= pk & ~pw; paint &= ~pw; paint |= pk & ~pw & ndimage.binary_dilation(paint, iterations=3)
  # fill pin-holes in the paint (badges, sensors are kept out only if they are big)
  filled = ndimage.binary_fill_holes(paint)
  holes = filled & ~paint
  lab, n = ndimage.label(holes)
  if n:
    sizes = ndimage.sum(holes, lab, range(1, n + 1)); small = np.zeros(n + 1, bool); small[1:] = sizes < 250; paint |= small[lab]
  pf = cv2.GaussianBlur(paint.astype(np.float32), (0, 0), 0.8)
  # shading maps
  D = np.clip(dd, 0, None) / 0.8
  pm = paint
  D = D / max(1e-3, np.percentile(D[pm], 93)); D = np.clip(D, 0, 1.3)
  S = np.clip(Lb, 0, 1)
  if fix.any():
    fx = cv2.dilate(fix.astype(np.uint8), np.ones((3, 3), np.uint8))
    D = cv2.inpaint(np.clip(D / 1.3 * 255, 0, 255).astype(np.uint8), fx, 6, cv2.INPAINT_TELEA).astype(np.float32) / 255 * 1.3
    S = cv2.inpaint((S * 255).astype(np.uint8), fx, 6, cv2.INPAINT_TELEA).astype(np.float32) / 255
  yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
  yrel = np.clip((yy - y0) / max(1, ch), 0, 1)
  E = (0.18 + 0.72 * (1 - yrel) ** 1.3) * (0.55 + 0.45 * np.clip(D, 0, 1)) + 0.5 * S
  E = np.clip(cv2.GaussianBlur(E.astype(np.float32), (0, 0), 1.5), 0, 1)
  maps = np.dstack([enc(np.sqrt(np.clip(D, 0, 1.3) / 1.3)), enc(np.sqrt(S)), enc(E)])
  maps[pf < 0.01] = 0
  photo = Wt.copy()
  for pc in plates: photo = plate_logo(photo, pc)
  Image.fromarray(enc(photo)).save(os.path.join(OUT, slug + '.webp'), quality=90, method=6)
  Image.fromarray(maps).save(os.path.join(OUT, slug + '-maps.webp'), lossless=True, quality=100, method=6)
  Image.fromarray(np.dstack([enc(pf), enc(cv2.GaussianBlur(glass.astype(np.float32), (0, 0), 0.8)), np.zeros((H, W), np.uint8)])).save(os.path.join(OUT, slug + '-mask.webp'), lossless=True, quality=100, method=6)
  m = 20; th = Image.fromarray(enc(Wt)).crop((max(0, x0 - m), max(0, y0 - m), min(W, x1 + m), min(H, y1 + m))); th.thumbnail((320, 180)); th.save(os.path.join(OUT, slug + '-thumb.webp'), quality=82, method=6)
  rec = {'id': slug, 'make': car['make'], 'model': car['model'], 'body': car.get('body', 'car'), 'est': car.get('est', 'sedan'), 'quote': car.get('quote', car['model']), 'w': W, 'h': H, 'angle': car.get('angle', '3/4 front')}
  index.append(rec)
  print(slug, W, H, 'paint px', int(pm.sum()), 'glass px', int(glass.sum()), [os.path.getsize(os.path.join(OUT, slug + s)) // 1024 for s in ['.webp', '-maps.webp', '-mask.webp']])
order = [c['id'] for c in cars]
index.sort(key=lambda c: order.index(c['id']) if c['id'] in order else 999)
json.dump({'cars': index}, open(os.path.join(OUT, 'stock.json'), 'w'), indent=0)
