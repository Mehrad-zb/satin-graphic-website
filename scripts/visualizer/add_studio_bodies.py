#!/usr/bin/env python3
# Adds the bodies listed in studio-new-bodies.json to the studio models (client and server) once their photos are built
# (BUILD_DIR/art.json has all five views); integrate_studio.py then points them at vehicles/g/.
# Usage: python3 add_studio_bodies.py BUILD_DIR
import os, sys, json
B = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..', 'dist')
VIEWS = ['driver-side', 'passenger-side', 'rear', 'front', 'top']
art = json.load(open(os.path.join(B, 'art.json')))
new = json.load(open(os.path.join(HERE, 'studio-new-bodies.json')))
def body_json(b):
  L, H, W = b['spec']['length'], b['spec']['height'], b['spec']['width']
  views = [{'key': 'driver-side', 'label': 'Driver side', 'width': L, 'height': H}, {'key': 'passenger-side', 'label': 'Passenger side', 'width': L, 'height': H},
           {'key': 'rear', 'label': 'Rear', 'width': W, 'height': H}, {'key': 'front', 'label': 'Front end', 'width': W, 'height': H}, {'key': 'top', 'label': 'Top / roof', 'width': L, 'height': W}]
  o = {'id': b['id'], 'name': b['name'], 'type': b['type'], 'spec': b['spec'], 'price': b['price'], 'art': 'vehicles/g/' + b['id'], 'photo': True, 'views': views}
  return json.dumps(o, ensure_ascii=False, separators=(',', ':'))
def end_of_bodies(s, pid):
  i = s.index('"id":"' + pid + '"'); j = s.index('"bodies":[', i) + len('"bodies":[')
  depth = 1; k = j
  while depth:
    c = s[k]
    if c == '"':
      k += 1
      while s[k] != '"': k += 2 if s[k] == '\\' else 1
    elif c in '[{': depth += 1
    elif c in ']}': depth -= 1
    k += 1
  return k - 1  # index of the closing ]
added = []
for f in (os.path.join(ROOT, 'client', 'studio', 'model.mjs'), os.path.join(ROOT, 'server', 'studio-model.mjs')):
  s = open(f, encoding='utf8').read()
  for pid, bodies in new.items():
    for b in bodies:
      if '"id":"' + b['id'] + '"' in s or not all(v in art.get(b['id'], {}) for v in VIEWS): continue
      e = end_of_bodies(s, pid); s = s[:e] + ',' + body_json(b) + s[e:]; added.append((os.path.basename(f), b['id']))
  open(f, 'w', encoding='utf8').write(s)
print('added', added)
