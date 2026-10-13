#!/usr/bin/env python3
# Estimator vehicle photos: one consistent Satin Graphic look for every category.
# Usage: python3 build_estimator.py SRC_DIR OUT_DIR LOGO [cat ...]
#   SRC_DIR has satin-est-<cat>-bare.png and satin-est-<cat>-wrap.png (transparent driver-side profiles, the wrap is an
#   edit of the bare picture). Writes est-<cat>-bare / -decal / -wrap .webp (+ .png) in OUT_DIR, all three cropped to the
#   same box so they cross-fade in place: bare, bare + Satin logo on the door, Satin fleet wrap + logo.
import os, sys, json
import numpy as np, cv2
from PIL import Image

SRC, OUT, LOGO = sys.argv[1], sys.argv[2], sys.argv[3]
ONLY = sys.argv[4:]
os.makedirs(OUT, exist_ok=True)
logo = np.asarray(Image.open(LOGO).convert('RGB')).astype(np.float32) / 255
lh, lw = logo.shape[:2]

def load(p):
  a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
  return a

def align(ref, mov):
  # translation that puts mov on ref (alpha silhouettes)
  (dx, dy), resp = cv2.phaseCorrelate(ref[..., 3].astype(np.float64), mov[..., 3].astype(np.float64))
  if abs(dx) < 40 and abs(dy) < 40 and (abs(dx) > .5 or abs(dy) > .5):
    M = np.float32([[1, 0, -dx], [0, 1, -dy]])
    mov = cv2.warpAffine(mov, M, (mov.shape[1], mov.shape[0]), flags=cv2.INTER_LINEAR, borderValue=0)
  return mov, (round(dx, 1), round(dy, 1))

def logo_spot(img, front_bias):
  # the biggest logo-shaped box on plain white paint, in the body band, nearest the front door
  a = img[..., 3]; rgb = img[..., :3]; L = rgb.mean(-1); sat = rgb.max(-1) - rgb.min(-1)
  ys, xs = np.where(a > .5); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); hh, ww = y1 - y0, x1 - x0
  white = (a > .95) & (L > .72) & (sat < .07)
  band = np.zeros_like(white); band[int(y0 + .3 * hh):int(y0 + .78 * hh), x0:x1] = True
  m = cv2.erode((white & band).astype(np.uint8), np.ones((5, 5), np.uint8))
  f = 3; m = cv2.resize(m, (m.shape[1] // f, m.shape[0] // f), interpolation=cv2.INTER_NEAREST)
  ii = cv2.integral(m)
  best = None
  for h in range(int(hh * .2 / f), 4, -1):
    w = int(h * lw / lh * 1.12); hp = int(h * 1.5)
    if w * f >= ww * .6: continue
    s = ii[hp:, w:] - ii[:-hp, w:] - ii[hp:, :-w] + ii[:-hp, :-w]
    ok = s >= .985 * w * hp
    if ok.any():
      yy, xx = np.where(ok)
      cx = (xx + w / 2) * f; target = x0 + front_bias * ww
      k = np.argmin(np.abs(cx - target) + .3 * np.abs((yy + hp / 2) * f - (y0 + .55 * hh)))
      best = (int(xx[k]) * f, int(yy[k]) * f, w * f, hp * f, h * f); break
  return best

def put_logo(img, spot):
  x, y, w, hp, h = spot
  lwid = int(w / 1.12); lhei = int(lwid * lh / lw)
  lx = x + (w - lwid) // 2; ly = y + (hp - lhei) // 2
  lg = cv2.resize(logo, (lwid, lhei), interpolation=cv2.INTER_AREA)
  out = img.copy()
  # printed on the panel: multiply keeps the paint's shading and reflections
  out[ly:ly + lhei, lx:lx + lwid, :3] *= lg
  return out

def save(img, path, box):
  x0, y0, x1, y1 = box
  im = Image.fromarray(np.clip(img[y0:y1, x0:x1] * 255, 0, 255).astype(np.uint8), 'RGBA')
  im.save(path + '.png', optimize=True)
  im.save(path + '.webp', quality=88, method=6)
  return im.size

def main():
  cats = sorted({f[len('satin-est-'):-len('-bare.png')] for f in os.listdir(SRC) if f.startswith('satin-est-') and f.endswith('-bare.png')})
  info = {}
  for cat in cats:
    if ONLY and cat not in ONLY: continue
    bp, wp = os.path.join(SRC, f'satin-est-{cat}-bare.png'), os.path.join(SRC, f'satin-est-{cat}-wrap.png')
    if not os.path.exists(wp): continue
    bare = load(bp); wrap = load(wp)
    if wrap.shape != bare.shape: wrap = cv2.resize(wrap, (bare.shape[1], bare.shape[0]), interpolation=cv2.INTER_AREA)
    if bare[..., 3].min() > .9: print(cat, 'no transparency, skipped'); continue
    wrap, sh = align(bare, wrap)
    fb = .28 if cat in ('sedan', 'suv', 'pickup', 'minivan') else .5
    sb = logo_spot(bare, fb); sw = logo_spot(wrap, fb)
    decal = put_logo(bare, sb) if sb else bare
    wrapped = put_logo(wrap, sw) if sw else wrap
    al = np.maximum(bare[..., 3], wrap[..., 3])
    ys, xs = np.where(al > .04)
    pad = 12
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(al.shape[1], xs.max() + pad), min(al.shape[0], ys.max() + pad))
    for name, img in (('bare', bare), ('decal', decal), ('wrap', wrapped)):
      size = save(img, os.path.join(OUT, f'est-{cat}-{name}'), box)
    info[cat] = {'w': size[0], 'h': size[1]}
    print(cat, 'shift', sh, 'logo bare', sb, 'logo wrap', sw, 'size', size, flush=True)
  p = os.path.join(OUT, 'est-sizes.json'); old = json.load(open(p)) if os.path.exists(p) else {}
  old.update(info); json.dump(old, open(p, 'w'))

main()
