#!/usr/bin/env python3
# Design-studio vehicle views from paired renders (same vehicle, same camera: gloss white + the same picture edited to gloss black).
# Usage: python3 build_studio.py SRC_DIR OUT_DIR [body ...]
#   SRC_DIR has satin-st-<body>-<view>-white.png / -black.png (views: driver-side, passenger-side, rear, front, top)
#   OUT_DIR gets <body>-<view>.webp (white photo), -dark.webp (black photo, for repainting), -mask.webp (paint in alpha),
#   -veil.webp (everything that is not paint, drawn over the artwork in the editor), <body>-thumb.webp, and art.json:
#   {body: {view: [box x, box y, box width, crop x, crop y, crop w, crop h]}} in 1536 x 1024 image pixels.
import os, sys, json
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

SRC, OUT = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3:]
VIEWS = ['driver-side', 'passenger-side', 'rear', 'front', 'top']
SIZE = (1536, 1024)
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'client', 'studio'))

def lin(a): return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)

def specs():
  # body dimensions from the studio model (inches): view artboards are L x H (sides), W x H (front/rear), L x W (top)
  import subprocess
  js = "import('./model.mjs').then(m=>{const o={};for(const p of m.PRODUCTS)for(const b of p.bodies||[])o[b.id]=b.spec;console.log(JSON.stringify(o));})"
  out = subprocess.run(['node', '-e', js], cwd=os.path.join(os.path.dirname(__file__), '..', '..', 'dist', 'client', 'studio'), capture_output=True, text=True).stdout
  return json.loads(out)
SPEC = specs()

def align(Wt, Bk):
  # the generative edit can nudge the whole picture a few pixels: undo a pure translation found on edge maps
  def edges(a):
    g = cv2.GaussianBlur(a.mean(-1), (0, 0), 1.5)
    return cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
  (dx, dy), resp = cv2.phaseCorrelate(edges(Wt).astype(np.float64), edges(Bk).astype(np.float64))
  if resp > 0.05 and abs(dx) < 25 and abs(dy) < 25 and (abs(dx) > 0.5 or abs(dy) > 0.5):
    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    Bk = cv2.warpAffine(Bk, M, (Bk.shape[1], Bk.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return Bk, (round(dx, 1), round(dy, 1))
  return Bk, (0, 0)

def build(body, view):
  wp = os.path.join(SRC, f'satin-st-{body}-{view}-white.png'); bp = os.path.join(SRC, f'satin-st-{body}-{view}-black.png')
  if not (os.path.exists(wp) and os.path.exists(bp)): return None
  Wi = Image.open(wp).convert('RGB'); Bi = Image.open(bp).convert('RGB')
  if Wi.size != SIZE: Wi = Wi.resize(SIZE, Image.LANCZOS)
  if Bi.size != SIZE: Bi = Bi.resize(SIZE, Image.LANCZOS)
  Wt = np.asarray(Wi).astype(np.float32) / 255; Bk = np.asarray(Bi).astype(np.float32) / 255
  Bk, shift = align(Wt, Bk)
  H, W = Wt.shape[:2]
  dd = lin(Wt).mean(-1) - lin(Bk).mean(-1)
  L = Wt.mean(-1); Lb = Bk.mean(-1); sat = Wt.max(-1) - Wt.min(-1)
  strong = cv2.morphologyEx((dd > 0.22).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
  lab, n = ndimage.label(dd > 0.06)
  keep = np.zeros(n + 1, bool); keep[np.unique(lab[strong])] = True; keep[0] = False
  paint = keep[lab]
  lab, n = ndimage.label(paint)
  if n:
    sizes = ndimage.sum(paint, lab, range(1, n + 1)); big = np.zeros(n + 1, bool); big[1:] = sizes > max(600, 0.01 * sizes.max()); paint = big[lab]
  if paint.sum() < 2000: return None
  # vehicle silhouette: the paint plus everything dark in both pictures (glass, tyres, trim) that touches it
  dk = (L < 0.5) & (Lb < 0.5)
  obj = paint | dk
  near = cv2.dilate(paint.astype(np.uint8), np.ones((25, 25), np.uint8)).astype(bool)
  lab, n = ndimage.label(cv2.morphologyEx(obj.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8)))
  keep = np.zeros(n + 1, bool); keep[np.unique(lab[near & obj])] = True; keep[0] = False
  carm = ndimage.binary_fill_holes(cv2.morphologyEx(keep[lab].astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8)).astype(bool))
  ys, xs = np.where(paint); y0, y1 = ys.min(), ys.max(); ch = y1 - y0
  # wheels: the black edit can darken rims; a tyre stays dark in both photos and rings its rim
  dark = cv2.morphologyEx(((L < 0.24) & (Lb < 0.24) & carm).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool)
  holes = (ndimage.binary_fill_holes(dark) & ~dark).astype(np.uint8)
  grp = cv2.morphologyEx(holes, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
  lab, n = ndimage.label(grp); wheels = np.zeros((H, W), np.uint8)
  if view in ('driver-side', 'passenger-side'):  # rims only show from the side; front/rear tyres are seen edge-on
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
      if sl is None: continue
      pts = np.argwhere((lab[sl] == i) & (holes[sl] > 0))
      if len(pts) < 200: continue
      hull = np.zeros(lab[sl].shape, np.uint8); cv2.fillConvexPoly(hull, cv2.convexHull(pts[:, ::-1].astype(np.int32)), 1)
      h_, w_ = hull.shape; cy = (sl[0].start + sl[0].stop) / 2
      if h_ > 0.12 * ch and cy > y0 + 0.5 * ch and 0.3 < w_ / h_ < 1.6 and hull.mean() > 0.5 and holes[sl][hull > 0].mean() > 0.25: wheels[sl] |= hull
  if os.environ.get('SDEBUG'): print(' [wheels', int(wheels.sum()), 'paint', int(paint.sum()), 'carm', int(carm.sum()), ']', end='')
  paint &= ~cv2.dilate(wheels, np.ones((5, 5), np.uint8)).astype(bool)
  paint &= carm
  if os.environ.get('SDEBUG'): print(' [after carm', int(paint.sum()), ']', end='')
  # floor the black edit darkened (reflections, shadow) reads as paint; where the white photo still shows plain studio
  # background at the edge of the silhouette, it is background. Background is interpolated from pixels well away.
  far = ~cv2.dilate((carm | paint).astype(np.uint8), np.ones((31, 31), np.uint8)).astype(bool)
  fw = far.astype(np.float32)
  bgL = cv2.GaussianBlur(L * fw, (0, 0), 45) / np.maximum(cv2.GaussianBlur(fw, (0, 0), 45), 1e-4)
  tex = cv2.GaussianBlur(np.abs(cv2.Laplacian(L, cv2.CV_32F, ksize=3)), (0, 0), 2)
  bgl = (((np.abs(L - bgL) < 0.025) & (tex < 0.02)) | ((dd < 0.15) & (tex < 0.03))) & paint
  lab, n = ndimage.label(bgl)
  if n:
    ext = cv2.dilate((~carm).astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    edge = np.zeros(n + 1, bool); edge[np.unique(lab[ext & bgl])] = True; edge[0] = False
    drop = cv2.dilate(edge[lab].astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & paint & ((np.abs(L - bgL) < 0.04) | (dd < 0.18))
    if drop.any(): print(f'  floor {int(drop.sum())}px', end='')
    paint &= ~drop; carm = carm & ~drop
    lab, n = ndimage.label(paint)
    if n:
      sizes = ndimage.sum(paint, lab, range(1, n + 1)); big = np.zeros(n + 1, bool); big[1:] = sizes > max(600, 0.01 * sizes.max()); paint = big[lab]
  if view == 'top':
    # the black edit also darkens the floor shadow, which then looks like paint. The far side of the body (top of the
    # picture) has no shadow: take that edge and the body's length, and the real width/length ratio gives the near side.
    sp = SPEC.get(body, {})
    cols = np.where(paint.any(0))[0]; px0, px1 = cols.min(), cols.max(); plen = px1 - px0
    mid = paint[:, int(px0 + .2 * plen):int(px1 - .2 * plen)]
    tops = np.array([np.argmax(c) for c in mid.T if c.any()])
    ytop = int(np.median(tops)) if len(tops) else int(np.where(paint.any(1))[0].min())
    ew = plen * sp.get('width', 80) / sp.get('length', 220)
    ybot = int(ytop + ew * 1.04)
    paint[ybot + 4:] = False; carm = carm.copy(); carm[ybot + 12:] = False
    top_box = [float(px0), float(ytop), float(plen), float(ew)]
  # small specks and pin-holes
  paint = cv2.morphologyEx(paint.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
  lab, n = ndimage.label(~paint & carm)
  if n:
    sizes = ndimage.sum(~paint & carm, lab, range(1, n + 1)); small = np.zeros(n + 1, bool); small[1:] = sizes < 120; paint |= small[lab]
  # soft edges: 1 px inside the paint edge, so artwork never spills onto trim
  core = cv2.erode(paint.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(np.float32)
  ma = np.clip(cv2.GaussianBlur(core, (0, 0), 0.8) * 1.15, 0, 1)
  bgalpha = 198 / 255
  va = np.where(carm, 1.0, bgalpha)
  va = np.clip(va * (1 - ma), 0, 1)
  base = os.path.join(OUT, f'{body}-{view}')
  Wi.save(base + '.webp', quality=86, method=6)
  Image.fromarray(np.clip(Bk * 255, 0, 255).astype(np.uint8)).save(base + '-dark.webp', quality=82, method=6)
  mrgba = np.zeros((H, W, 4), np.uint8); mrgba[..., :3] = 255; mrgba[..., 3] = (ma * 255).astype(np.uint8)
  Image.fromarray(mrgba).save(base + '-mask.webp', quality=90, method=6)
  vrgba = np.dstack([(Wt * 255).astype(np.uint8), (va * 255).astype(np.uint8)])
  Image.fromarray(vrgba).save(base + '-veil.webp', quality=86, method=6)
  # placement: the artboard is the body's real outline (side L x H, front/rear W x H, top L x W)
  s = SPEC.get(body, {}); Ls, Hs, Ws = s.get('length'), s.get('height'), s.get('width')
  cys, cxs = np.where(carm); cy0, cy1 = cys.min(), cys.max()
  tyre = dark & ~cv2.dilate(paint.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
  ground = cy1
  if view != 'top':
    # the ground is under the lowest dark parts (tyres) within the body's width; a chrome bumper can cut them off the silhouette
    pys, pxs = np.where(paint); py0, py1, px0, px1 = pys.min(), pys.max(), pxs.min(), pxs.max()
    reg = np.zeros_like(dk); reg[py0:min(H, py1 + (py1 - py0)), px0:px1 + 1] = True
    dys = np.where(dk & reg & ~cv2.dilate(paint.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool))[0]
    if len(dys) > 500: ground = max(int(np.percentile(dys, 99.7)) + 2, min(cy1, H - 1))
  hh = ground - cy0
  # the photo is a generated picture, not a measured drawing: fit the artboard to the body as photographed
  # (a thin antenna or mirror does not count), and keep the height separately from the width
  rwid = carm.sum(1); top = int(np.argmax(rwid > 0.03 * max(1, rwid.max())))
  if view in ('driver-side', 'passenger-side'):
    rows = carm[top:int(ground - 0.1 * (ground - top))]
    cols = np.where(rows.any(0))[0]; bx0, bx1 = cols.min(), cols.max()
    box = [float(bx0), float(top), float(bx1 - bx0), float(ground - top)]
  elif view in ('front', 'rear'):
    rows = carm[int(top + 0.55 * (ground - top)):int(ground - 0.08 * (ground - top))]
    cols = np.where(rows.any(0))[0]; bx0, bx1 = cols.min(), cols.max()
    box = [float(bx0), float(top), float(bx1 - bx0), float(ground - top)]
  else:
    box = top_box
  bh = box[3]
  cols = np.where(carm.any(0))[0]
  pad = 36
  cx0 = max(0, min(int(box[0]), cols.min()) - pad); cx1 = min(W, max(int(box[0] + box[2]), cols.max()) + pad)
  cy0c = max(0, min(int(box[1]), cy0) - pad); cy1c = min(H, max(int(box[1] + bh), ground) + pad)
  crop = [cx0, cy0c, cx1 - cx0, cy1c - cy0c]
  ratio = (ground - cy0) / max(1, (cols.max() - cols.min()))
  print(f'{body} {view}: shift {shift} paint {int(paint.sum())} box {[round(float(v), 1) for v in box]} crop {[int(v) for v in crop]}', flush=True)
  return [round(float(v), 1) for v in box[:3]] + [int(v) for v in crop] + [0, round(float(box[3]), 1)]

def main():
  import re
  rx = re.compile(r'^satin-st-(.+)-(' + '|'.join(VIEWS) + r')-(white|black)\.png$')
  bodies = sorted({m.group(1) for m in map(rx.match, os.listdir(SRC)) if m})
  bodies = [b for b in bodies if not ONLY or b in ONLY]
  artp = os.path.join(OUT, 'art.json')
  art = json.load(open(artp)) if os.path.exists(artp) else {}
  for body in bodies:
    got = {}
    for v in VIEWS:
      r = build(body, v)
      if r: got[v] = r
    if not got: continue
    art[body] = {**art.get(body, {}), **got}
    dv = os.path.join(OUT, f'{body}-driver-side.webp')
    if os.path.exists(dv) and 'driver-side' in got:
      x, y, w, h = got['driver-side'][3:7]
      im = Image.open(dv).convert('RGB').crop((x, y, x + w, y + h))
      im.thumbnail((480, 320), Image.LANCZOS)
      t = Image.new('RGB', (480, 320), im.getpixel((2, 2))); t.paste(im, ((480 - im.size[0]) // 2, (320 - im.size[1]) // 2))
      t.save(os.path.join(OUT, f'{body}-thumb.webp'), quality=84, method=6)
  json.dump(art, open(artp, 'w'), indent=0)

main()
