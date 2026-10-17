#!/usr/bin/env python3
"""Deploy zips from hp/pkg: text files + chosen binary dirs, <= 7.5 MB each. Usage: mkzips.py NAME [binary/dir/prefix ...]"""
import os, sys, zipfile
P = '/home/claude/hp/pkg'; OUT = '/home/claude/hp/zips'; LIMIT = 7.5 * 1024 * 1024
name = sys.argv[1]; bins = sys.argv[2:]
TEXT = ('.html', '.mjs', '.js', '.css', '.json', '.txt', '.xml', '.php', '.webmanifest', '.svg', '.htaccess', '.user.ini')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.startswith(name + '-'): os.remove(os.path.join(OUT, f))
files = []
for root, _, fs in os.walk(P):
    for f in fs:
        full = os.path.join(root, f); rel = os.path.relpath(full, P)
        if rel == 'satin-new/config.php' or rel.startswith('satin-new/storage') or '/portfolio/images/u' in rel: continue
        if f.endswith(TEXT) or f in ('.htaccess', '.user.ini') or any(rel.startswith(b) for b in bins):
            arc = rel.replace('new.satingraphic.ca/', 'public_html/', 1) if rel.startswith('new.satingraphic.ca/') else rel
            files.append((full, arc, os.path.getsize(full)))
files.sort(key=lambda x: x[1])
n, cur, size = 0, None, 0
for full, arc, sz in files:
    if cur is None or size + sz > LIMIT:
        if cur: cur.close()
        n += 1; cur = zipfile.ZipFile(f'{OUT}/{name}-{n:02d}.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9); size = 0
    cur.write(full, arc); size += sz * (0.25 if arc.endswith(TEXT) else 1)
cur.close()
for f in sorted(os.listdir(OUT)):
    if f.startswith(name + '-'): print(f, os.path.getsize(os.path.join(OUT, f)))
