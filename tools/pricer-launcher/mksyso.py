#!/usr/bin/env python3
"""Writes rsrc_windows_amd64.syso (an icon resource Go links into the EXE) from an .ico file — no extra tools needed.
usage: mksyso.py icon.ico out.syso"""
import struct, sys
ico = open(sys.argv[1], 'rb').read()
_, _, n = struct.unpack('<HHH', ico[:6])
imgs = []
for i in range(n):
    w, h, col, res, planes, bits, size, off = struct.unpack('<BBBBHHII', ico[6 + 16 * i:22 + 16 * i])
    imgs.append(((w, h, col, res, planes, bits), ico[off:off + size]))
group = struct.pack('<HHH', 0, 1, n) + b''.join(struct.pack('<BBBBHHIH', *hdr, len(data), i + 1) for i, (hdr, data) in enumerate(imgs))
blobs = [d for _, d in imgs] + [group]                       # data entry k ↔ blob k
dir_sz = lambda cnt: 16 + 8 * cnt
# layout: root(2) | icon L2(n) | group L2(1) | n+1 lang dirs(1 each) | data entries | data
root, l2i = 0, dir_sz(2)
l2g = l2i + dir_sz(n)
lang0 = l2g + dir_sz(1)
de0 = lang0 + (n + 1) * dir_sz(1)
data0 = de0 + 16 * (n + 1)
offs, p = [], data0
for b in blobs:
    p = (p + 7) & ~7; offs.append(p); p += len(b)
sec = bytearray(p)
def dir_at(o, entries):  # entries: [(id, target, is_dir)]
    struct.pack_into('<IIHHHH', sec, o, 0, 0, 0, 0, 0, len(entries))
    for k, (i, t, isd) in enumerate(entries):
        struct.pack_into('<II', sec, o + 16 + 8 * k, i, t | (0x80000000 if isd else 0))
dir_at(root, [(3, l2i, True), (14, l2g, True)])
dir_at(l2i, [(i + 1, lang0 + i * dir_sz(1), True) for i in range(n)])
dir_at(l2g, [(1, lang0 + n * dir_sz(1), True)])
for k in range(n + 1):
    dir_at(lang0 + k * dir_sz(1), [(0x409, de0 + 16 * k, False)])
relocs = []
for k, b in enumerate(blobs):
    struct.pack_into('<IIII', sec, de0 + 16 * k, offs[k], len(b), 0, 0)
    relocs.append(de0 + 16 * k)
    sec[offs[k]:offs[k] + len(b)] = b
sec = bytes(sec)
hdr_sz, sh_sz = 20, 40
raw = hdr_sz + sh_sz
rel_ptr = raw + len(sec)
sym_ptr = rel_ptr + 10 * len(relocs)
out = struct.pack('<HHIIIHH', 0x8664, 1, 0, sym_ptr, 1, 0, 0)
out += struct.pack('<8sIIIIIIHHI', b'.rsrc', 0, 0, len(sec), raw, rel_ptr, 0, len(relocs), 0, 0x40000040)
out += sec + b''.join(struct.pack('<IIH', r, 0, 3) for r in relocs)  # IMAGE_REL_AMD64_ADDR32NB → symbol 0
out += struct.pack('<8sIhHBB', b'.rsrc', 0, 1, 0, 3, 0) + struct.pack('<I', 4)
open(sys.argv[2], 'wb').write(out)
print('wrote', sys.argv[2], len(out), 'bytes,', n, 'icon sizes')
