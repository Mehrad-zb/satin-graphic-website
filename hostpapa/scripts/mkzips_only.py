#!/usr/bin/env python3
"""Incremental deploy zips: only files under the given pkg-relative prefixes (text or binary), <= 7.5 MB each.
Usage: mkzips_only.py NAME prefix [prefix ...]   e.g. new.satingraphic.ca/visualizer/ satin-new/wrap-designs/x.zip"""
import os, sys, zipfile
P = '/home/claude/hp/pkg'; OUT = '/home/claude/hp/zips'; LIMIT = 7.5 * 1024 * 1024
name = sys.argv[1]; pre = sys.argv[2:]
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.startswith(name + '-'): os.remove(os.path.join(OUT, f))
files = []
for root, _, fs in os.walk(P):
    for f in fs:
        full = os.path.join(root, f); rel = os.path.relpath(full, P)
        if rel == 'satin-new/config.php' or rel.startswith('satin-new/storage'): continue
        if any(rel.startswith(b) for b in pre):
            arc = rel.replace('new.satingraphic.ca/', 'public_html/', 1) if rel.startswith('new.satingraphic.ca/') else rel
            files.append((full, arc, os.path.getsize(full)))
files.sort(key=lambda x: x[1])
n, cur, size = 0, None, 0
for full, arc, sz in files:
    comp = sz * (0.3 if arc.endswith(('.html', '.mjs', '.js', '.css', '.json', '.txt', '.xml', '.svg')) else 1)
    if cur is None or size + comp > LIMIT:
        if cur: cur.close()
        n += 1; cur = zipfile.ZipFile(f'{OUT}/{name}-{n:02d}.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9); size = 0
    cur.write(full, arc); size += comp
if cur: cur.close()
print(len(files), 'files')
for f in sorted(os.listdir(OUT)):
    if f.startswith(name + '-'): print(f, os.path.getsize(os.path.join(OUT, f)))
