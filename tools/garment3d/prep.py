#!/usr/bin/env python3
"""Turns a garment .glb (Sketchfab / Marvelous Designer export) into a small .g3d file for the Design Studio 3D view.
 - all meshes are merged in world space (UVs and textures dropped: the colour and the customer's artwork are applied live),
 - the model is turned to face +z, stood on y = 0, centred, and scaled to inches (--height = real garment height),
 - heavy meshes are simplified by vertex clustering to about --tris triangles,
 - positions are stored as int16, normals as int8, indices as uint32 → ~10× smaller than the source.
usage: prep.py in.glb out.g3d --height 29 --yaw 0 [--tris 70000]"""
import argparse, json, struct, numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def read_glb(path):
    d = open(path, 'rb').read(); jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl]); bin_ = d[20 + jl + 8:]
    def acc(i):
        a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]; t = np.dtype(CT[a['componentType']]); n = NC[a['type']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0); stride = v.get('byteStride', 0) or t.itemsize * n
        raw = np.frombuffer(bin_, dtype=np.uint8, count=stride * (a['count'] - 1) + t.itemsize * n, offset=off)
        out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], t.itemsize * n), strides=(stride, 1)).copy().view(t).reshape(a['count'], n)
        if a.get('normalized'): out = out.astype(np.float32) / np.iinfo(t).max
        return out.astype(np.float64 if t == np.float32 else out.dtype)
    return j, acc

def quat_mat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w), 0], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w), 0], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y), 0], [0, 0, 0, 1]])

def node_mat(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4, 4).T
    T = np.eye(4); T[:3, 3] = n.get('translation', [0, 0, 0])
    S = np.diag(list(n.get('scale', [1, 1, 1])) + [1])
    return T @ quat_mat(n.get('rotation', [0, 0, 0, 1])) @ S

def gather(j, acc, skip=()):
    P, N, I = [], [], []; base = 0
    def walk(i, M):
        nonlocal base
        n = j['nodes'][i]; M = M @ node_mat(n)
        if 'mesh' in n:
            for p in j['meshes'][n['mesh']]['primitives']:
                if p.get('mode', 4) != 4: continue
                mname = j['materials'][p['material']].get('name', '') if 'material' in p else ''
                if any(k.lower() in mname.lower() for k in skip): continue  # e.g. a print patch that came with the model
                pos = acc(p['attributes']['POSITION'])[:, :3]
                pw = (np.c_[pos, np.ones(len(pos))] @ M.T)[:, :3]
                if 'NORMAL' in p['attributes']:
                    nr = acc(p['attributes']['NORMAL'])[:, :3] @ np.linalg.inv(M[:3, :3])
                    nr /= np.linalg.norm(nr, axis=1, keepdims=True) + 1e-12
                else: nr = np.zeros_like(pw)
                idx = acc(p['indices']).ravel().astype(np.int64) if 'indices' in p else np.arange(len(pos))
                P.append(pw); N.append(nr); I.append(idx + base); base += len(pw)
        for c in n.get('children', []): walk(c, M)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return np.concatenate(P), np.concatenate(N), np.concatenate(I).reshape(-1, 3)

def face_normals(P, F):
    return np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])

def cluster(P, N, F, target):
    """vertex clustering: snap vertices to a grid, merge each cell, drop collapsed triangles; grid refined until ≤ target"""
    span = (P.max(0) - P.min(0)).max(); lo, hi = span / 2000, span / 40; best = None
    for _ in range(14):
        h = (lo * hi) ** .5
        key = np.floor((P - P.min(0)) / h).astype(np.int64)
        sgn = 0
        k = (key[:, 0] * 73856093) ^ (key[:, 1] * 19349663) ^ (key[:, 2] * 83492791) ^ (sgn * 1000003)
        uniq, inv = np.unique(k, return_inverse=True)
        f = inv[F]; ok = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2]); f = f[ok]
        f = np.unique(np.sort(f, 1), axis=0, return_index=True)[1]; nf = len(f)
        if nf > target: lo = h          # too many triangles: bigger cells
        else: hi = h; best = h          # small enough: try finer cells for more detail
        if best and abs(nf - target) / target < .08: break
    h = best or hi
    key = np.floor((P - P.min(0)) / h).astype(np.int64); sgn = 0
    k = (key[:, 0] * 73856093) ^ (key[:, 1] * 19349663) ^ (key[:, 2] * 83492791) ^ (sgn * 1000003)
    uniq, inv = np.unique(k, return_inverse=True); m = len(uniq)
    cnt = np.bincount(inv, minlength=m)[:, None]
    P2 = np.zeros((m, 3)); np.add.at(P2, inv, P); P2 /= cnt
    N2 = np.zeros((m, 3)); np.add.at(N2, inv, N)
    F2 = inv[F]; ok = (F2[:, 0] != F2[:, 1]) & (F2[:, 1] != F2[:, 2]) & (F2[:, 0] != F2[:, 2]); F2 = F2[ok]
    # keep triangle winding consistent with the original surface normals
    fn = face_normals(P2, F2); avg = N2[F2].sum(1); flip = (fn * avg).sum(1) < 0; F2[flip] = F2[flip][:, [0, 2, 1]]
    _, keep = np.unique(np.sort(F2, 1), axis=0, return_index=True); F2 = F2[np.sort(keep)]
    used = np.unique(F2); remap = -np.ones(m, np.int64); remap[used] = np.arange(len(used))
    return P2[used], N2[used], remap[F2]

def vertex_normals(P, F):
    fn = face_normals(P, F); N = np.zeros_like(P)
    for c in range(3): np.add.at(N, F[:, c], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--height', type=float, required=True); ap.add_argument('--yaw', type=float, default=0); ap.add_argument('--pitch', type=float, default=0)
    ap.add_argument('--tris', type=int, default=70000); ap.add_argument('--outer', action='store_true'); ap.add_argument('--skip', default=''); a = ap.parse_args()
    j, acc = read_glb(a.src); P, N, F = gather(j, acc, [k for k in a.skip.split(',') if k])
    for ang, axis in ((a.pitch, 0), (a.yaw, 1)):
        if not ang: continue
        t = np.radians(ang); c, s = np.cos(t), np.sin(t)
        R = np.array([[1, 0, 0], [0, c, -s], [0, s, c]]) if axis == 0 else np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
        P = P @ R.T; N = N @ R.T
    if not np.abs(N).sum(): N = vertex_normals(P, F)
    src_tris = len(F)
    if a.outer:  # cloth exported with thickness: keep only the outside layer (the inside is drawn as its back face)
        # outward = away from the body: horizontally from the torso axis, plus upwards on the shoulders
        cen = (P.min(0) + P.max(0)) / 2; fc = P[F].mean(1); rad = fc - cen; rad[:, 1] = np.maximum(0, fc[:, 1] - (P.min(0)[1] + 0.62 * (P.max(0)[1] - P.min(0)[1]))) * 2
        fn = face_normals(P, F); avgN = N[F].sum(1); fn = np.where(((fn * avgN).sum(1) < 0)[:, None], -fn, fn)
        F = F[(fn * rad).sum(1) > 0]
        used = np.unique(F); remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used)); P, N, F = P[used], N[used], remap[F]
    if len(F) > a.tris: P, N, F = cluster(P, N, F, a.tris)
    N = vertex_normals(P, F)  # smooth normals of the final surface
    lo, hi = P.min(0), P.max(0); s = a.height / (hi[1] - lo[1])
    P = (P - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) * s
    lo, hi = P.min(0), P.max(0); ext = np.maximum(np.abs(lo), np.abs(hi)).max()
    q = np.round(P / ext * 32767).astype(np.int16); n8 = np.round(N * 127).astype(np.int8)
    head = json.dumps({'v': 1, 'verts': len(P), 'tris': len(F), 'scale': float(ext), 'min': lo.round(3).tolist(), 'max': hi.round(3).tolist()}).encode()
    head += b' ' * (-len(head) % 4)
    with open(a.dst, 'wb') as o:
        o.write(b'G3D1'); o.write(struct.pack('<I', len(head))); o.write(head)
        o.write(q.tobytes()); o.write(b'\0' * (-q.nbytes % 4)); o.write(np.c_[n8, np.zeros(len(n8), np.int8)].tobytes()); o.write(F.astype(np.uint32).tobytes())
    print(f'{a.src}: {src_tris} → {len(F)} triangles, {len(P)} vertices, size {hi - lo} in, {round(len(open(a.dst, "rb").read()) / 1e6, 2)} MB')

main()
