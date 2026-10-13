#!/usr/bin/env python3
# Publish built studio views (build_studio.py output) into the design studio: copies complete bodies (all 5 views)
# to dist/client/studio/mockups/vehicles/g/, writes GEN_ART in mockups.mjs and points the bodies' art at g/ in both models.
# Usage: python3 integrate_studio.py BUILD_DIR
import os, sys, json, re, shutil
B = sys.argv[1]
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'dist')
G = os.path.join(ROOT, 'client', 'studio', 'mockups', 'vehicles', 'g'); os.makedirs(G, exist_ok=True)
VIEWS = ['driver-side', 'passenger-side', 'rear', 'front', 'top']
art = json.load(open(os.path.join(B, 'art.json')))
done = {b: v for b, v in art.items() if all(k in v for k in VIEWS)}
for b in done:
  for v in VIEWS:
    for suf in ('', '-dark', '-mask', '-veil'): shutil.copy(os.path.join(B, f'{b}-{v}{suf}.webp'), G)
  shutil.copy(os.path.join(B, f'{b}-thumb.webp'), G)
mp = os.path.join(ROOT, 'client', 'studio', 'mockups.mjs'); s = open(mp).read()
s = re.sub(r'const GEN_ART=\{.*?\};\n', 'const GEN_ART=' + json.dumps(done, separators=(',', ':')) + ';\n', s, count=1, flags=re.S)
open(mp, 'w').write(s)
for f in (os.path.join(ROOT, 'client', 'studio', 'model.mjs'), os.path.join(ROOT, 'server', 'studio-model.mjs')):
  s = open(f).read()
  for b in done:
    s = re.sub(r'"art":"vehicles/(?:p/|g/)?' + re.escape(b) + r'"(,"photo":true)?', '"art":"vehicles/g/' + b + '","photo":true', s)
  open(f, 'w').write(s)
print('published', len(done), sorted(done))
