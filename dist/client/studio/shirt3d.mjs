// Design Studio — 3D T-shirt preview (three.js, self-hosted in /studio/vendor/three).
// The shirt is built in code: a front and a back body panel, two set-in sleeves and a ribbed collar. Every panel has its own
// flat UV layout in inches (see PANELS), so a flat artwork made for that panel lands on the right place of the 3D shirt:
//  - "areas" mode: the customer's front / back artwork is drawn in the standard 12 × 16 in print area (DTF / screen print);
//  - "allover" mode: each panel artwork covers the whole cut panel (sublimation, cut & sew).
// Units: 1 = 1 inch. y up (hem y = 0), x to the shirt's left when seen from the front, z towards the viewer.
import * as THREE from './vendor/three/three.module.min.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {RoomEnvironment} from './vendor/three/RoomEnvironment.js';
import {AOP} from './aop-panels.mjs';

/* ---------------- shirt shape ---------------- */
const A = 11.2;            // half chest width
const NECK = 3.4;          // half neck opening width
const NECK_FRONT = 3.6;    // front neckline depth below the neck point
const NECK_BACK = 1.0;     // back neckline depth
const NECK_Y = 29.8;       // neck point (top of the shoulder seam at the collar)
const SHOULDER = {x: 9.7, y: 27.6};  // shoulder point (end of the shoulder seam)
const ARMPIT_Y = 20.4;
const SLEEVE = {len: 8.2, rootY: 3.65, rootZ: 3.0, cuffY: 3.05, cuffZ: 2.55, drop: 33}; // drop = degrees below horizontal

// Flat panel rectangles (inches) used by the UV mapping and by the print files.
export const PANELS = {
  front: {w: 2 * A, h: NECK_Y, label: 'Front'},
  back: {w: 2 * A, h: NECK_Y, label: 'Back'},
  left: {w: 21, h: SLEEVE.len, label: 'Left sleeve'},
  right: {w: 21, h: SLEEVE.len, label: 'Right sleeve'},
};
// Standard print areas (DTF / screen print), in panel inches from the panel's top-left corner.
export const PRINT_AREAS = {
  front: {x: A - 6, y: NECK_FRONT + 3, w: 12, h: 16},
  back: {x: A - 6, y: NECK_BACK + 2.5, w: 12, h: 16},
  left: {x: 21 / 2 - 2, y: 1.5, w: 4, h: 4},
  right: {x: 21 / 2 - 2, y: 1.5, w: 4, h: 4},
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
// half width of the body at height y along the side seam / armhole
function sideX(y) {
  if (y <= ARMPIT_Y) return A - 0.35 * smooth(0, 9, y) * (1 - smooth(9, ARMPIT_Y, y)) - 0.25 * (1 - smooth(0, 3, y)) + 0.0;
  const t = (y - ARMPIT_Y) / (SHOULDER.y - ARMPIT_Y); // armhole: curves in towards the shoulder point
  return lerp(A, SHOULDER.x, Math.pow(t, 0.62));
}
// top edge of a body panel at column x (shoulder line or neckline)
function topY(x, back) {
  const ax = Math.abs(x);
  if (ax >= NECK) { const t = Math.min(1, (ax - NECK) / (SHOULDER.x - NECK)); return lerp(NECK_Y, SHOULDER.y, t); }
  const d = back ? NECK_BACK : NECK_FRONT, u = ax / NECK;
  return NECK_Y - d * Math.sqrt(Math.max(0, 1 - u * u)) * (0.9 + 0.1 * u);
}
// body depth (half thickness) at height y
const bodyDepth = y => 4.75 + 0.6 * smooth(4, 19, y) - 0.25 * smooth(19, 27, y) + 0.15 * (1 - smooth(0, 4, y));
// depth of the top edge: 0 along the shoulder seam, the neck ring at the collar
const topZ = (x, back) => { const u = Math.min(1, Math.abs(x) / NECK); return (back ? 2.6 : 2.9) * Math.sqrt(Math.max(0, 1 - u * u)); };
// gentle folds so the cotton does not look like plastic
const folds = (x, y, back) => 0.10 * Math.sin(x * 0.9 + y * 0.35 + (back ? 1.7 : 0)) * smooth(0, 6, y) * (1 - smooth(16, 22, y))
  + 0.16 * Math.sin(y * 1.6 + x * 0.25) * Math.exp(-Math.pow((Math.abs(x) - 9.2) / 1.6, 2)) * smooth(15, 20, y) * (1 - smooth(20.5, 23, y));

function bodyPanel(back, NS = 64, NT = 72) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NT; j++) {
    const t = j / NT;
    for (let i = 0; i <= NS; i++) {
      const s = -1 + 2 * i / NS;
      const yEdge = t * SHOULDER.y; // where this row meets the side seam
      const half = sideX(yEdge);
      const x = s * half;
      const yt = topY(x, back);
      const y = t * yt;
      // depth: a rounded body section that flattens into the shoulder seam / neck ring at the top edge
      const ell = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), 2.4)), 0.5);
      const zb = bodyDepth(y) * ell;
      // rounded over the shoulders (like a body underneath), opening into the neck ring at the collar
      const R = Math.max(1.5, zb * 0.95), q = Math.min(1, Math.max(0, (y - (yt - R)) / R));
      let z = zb * Math.sqrt(Math.max(0, 1 - q * q)) + topZ(x, back) * q * q + folds(x, y, back) * ell;
      z = Math.max(0.02, z);
      pos.push(x, y, back ? -z : z);
      // flat UV of the panel: u across (as seen from outside), v down from the neck point
      const u = (x + A) / (2 * A);
      uv.push(back ? 1 - u : u, y / NECK_Y);
    }
  }
  const row = NS + 1;
  for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    if (back) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

function sleeve(sign, NU = 64, NL = 28) {
  const pos = [], uv = [], idx = [];
  const drop = SLEEVE.drop * Math.PI / 180, dir = new THREE.Vector3(sign * Math.cos(drop), -Math.sin(drop), 0);
  const root = new THREE.Vector3(sign * (sideX(24) - 2.0), 24.0, 0);
  for (let j = 0; j <= NL; j++) {
    const l = j / NL;
    // the ring starts vertical (fits the armhole) and turns to face along the sleeve
    const n = new THREE.Vector3(sign, 0, 0).lerp(dir, smooth(0, 0.55, l)).normalize();
    const up = new THREE.Vector3(0, 0, 1).cross(n).normalize().multiplyScalar(sign); // in-plane "up" of the ring
    const c = root.clone().addScaledVector(dir, SLEEVE.len * l + 1.2 * l * (1 - l));
    const ry = lerp(SLEEVE.rootY, SLEEVE.cuffY, smooth(0, 1, l)), rz = lerp(SLEEVE.rootZ, SLEEVE.cuffZ, l);
    for (let i = 0; i <= NU; i++) {
      const a = i / NU * Math.PI * 2; // a = 0 under the arm (seam), a = π on top of the sleeve
      const f = 1 + 0.025 * Math.sin(a * 3 + l * 9) * l;
      const p = c.clone().addScaledVector(up, -Math.cos(a) * ry * f).add(new THREE.Vector3(0, 0, Math.sin(a) * rz * f * sign));
      pos.push(p.x, p.y, p.z);
      uv.push(sign > 0 ? 1 - i / NU : i / NU, l);
    }
  }
  const row = NU + 1;
  for (let j = 0; j < NL; j++) for (let i = 0; i < NU; i++) {
    const a = j * row + i, b = a + 1, c2 = a + row, d = c2 + 1;
    if (sign > 0) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

function collar(N = 120) {
  const pos = [], idx = [];
  const ring = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * Math.PI * 2; // 0 = front centre
    const x = Math.sin(a) * NECK, back = Math.cos(a) < 0;
    const y = topY(x, back), z = (back ? -1 : 1) * topZ(x, back);
    ring.push(new THREE.Vector3(x, y, z));
  }
  const H = 0.62;
  for (let i = 0; i <= N; i++) {
    const p = ring[i], c = new THREE.Vector3(0, p.y, 0), out = p.clone().sub(c).setY(0).normalize();
    pos.push(p.x - out.x * 0.05, p.y - 0.15, p.z - out.z * 0.05);
    pos.push(p.x - out.x * 0.16, p.y + H, p.z - out.z * 0.16);
  }
  for (let i = 0; i < N; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------------- fabric textures ---------------- */
function weaveNormal() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), im = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = (j * S + i) * 4, a = Math.sin(i * 0.8) * 0.5 + Math.sin(j * 0.8 + (i % 2) * 1.2) * 0.5, n = (Math.random() - 0.5) * 0.6;
    im.data[k] = 128 + (a + n) * 18; im.data[k + 1] = 128 + (Math.cos(j * 0.8) * 0.5 + n) * 18; im.data[k + 2] = 255; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(26, 26); return t;
}
function ribNormal() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d');
  for (let i = 0; i < 64; i++) { const v = 128 + Math.sin(i / 64 * Math.PI * 2 * 4) * 60; x.fillStyle = `rgb(${v},128,255)`; x.fillRect(i, 0, 1, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 1); return t;
}

/** Paints one panel: garment colour, then (areas) the artwork in the print area or (allover) the artwork over the whole panel. */
function paintPanel(canvas, key, colour, art, mode) {
  const P = PANELS[key], px = canvas.width / P.w, ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = colour; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!art) return;
  if (mode === 'allover') { ctx.drawImage(art, 0, 0, canvas.width, canvas.height); return; }
  const r = PRINT_AREAS[key]; if (!r) return;
  // the artwork keeps its proportions inside the print area, centred at the top like a real print
  const aw = art.width || art.naturalWidth, ah = art.height || art.naturalHeight, s = Math.min(r.w / aw, r.h / ah);
  const w = aw * s, h = ah * s;
  ctx.drawImage(art, (r.x + (r.w - w) / 2) * px, r.y * px, w * px, h * px);
}

/* ---------------- real garment model (studio/models/tshirt-man.json, one UV atlas) ---------------- */
// Regions of the UV atlas (fractions of the texture, y down) and the inches per atlas unit, measured from the model.
const atlasRect = (k, extra) => ({x: AOP.atlas[k][0], y: AOP.atlas[k][1], w: AOP.atlas[k][2], h: AOP.atlas[k][3], ...extra});
export const ATLAS = {
  front: atlasRect('front', {ipu: [47.2, 34.5], neck: .320, printTop: .345}),
  back: atlasRect('back', {ipu: [48.2, 34.5], neck: .248, printTop: .315}),
  left: atlasRect('left', {ipu: [61.1, 66.0]}),
  right: atlasRect('right', {ipu: [62.1, 66.3]}),
  rib: atlasRect('rib', {}),
};
export const MODEL_PANELS = Object.fromEntries(['front', 'back', 'left', 'right'].map(k => [k, {w: +(ATLAS[k].w * ATLAS[k].ipu[0]).toFixed(1), h: +(ATLAS[k].h * ATLAS[k].ipu[1]).toFixed(1)}]));
function paintAtlas(canvas, st) {
  const S = canvas.width, c = canvas.getContext('2d'), R = (r) => [r.x * S, r.y * S, r.w * S, r.h * S];
  c.fillStyle = st.colour || '#ffffff'; c.fillRect(0, 0, S, S);
  c.fillStyle = st.collar || st.colour || '#ffffff'; c.fillRect(...R(ATLAS.rib));
  for (const k of ['front', 'back', 'left', 'right']) {
    const art = st.art?.[k]; if (!art) continue; const r = ATLAS[k];
    if (st.mode === 'allover') { c.drawImage(art, ...R(r)); continue; } // the UV island is the cut piece: bleed outside it is never sampled
    if (k === 'left' || k === 'right') continue;
    // print area (12 × 16 in by default, st.area for oversize): 3 in under the front neckline, 2.5 in under the back neckline, centred
    const aw = art.width || art.naturalWidth, ah = art.height || art.naturalHeight, pw = st.area?.w || 12, ph = st.area?.h || 16, s = Math.min(pw / aw, ph / ah);
    const w = aw * s / r.ipu[0], h = ah * s / r.ipu[1], top = r.printTop, cx = r.x + r.w / 2;
    c.drawImage(art, (cx - w / 2) * S, top * S, w * S, h * S);
  }
}
async function loadModel(url) {
  const d = await fetch(url).then(r => { if (!r.ok) throw Error('model'); return r.json(); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
  // the mannequin stands turned ~28° in the source scene: face the front (+z), then centre it
  g.setIndex(d.idx); g.rotateY(-61.7 * Math.PI / 180); g.computeBoundingBox(); const bb = g.boundingBox; g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); return g;
}

/**
 * Mounts the 3D shirt in `host` (an element with a size). Returns {update, setBackground, snapshot, resetView, dispose}.
 * update({colour, collar, mode, art: {front, back, left, right}}) — art values are images/canvases/bitmaps (or null).
 */
export function mountShirt3D(host, opts = {}) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 1000); camera.position.set(16, 21, 84);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 14.5, 0); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 34; controls.maxDistance = 130;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.85; controls.rotateSpeed = 0.8;

  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(18, 40, 30); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, {left: -30, right: 30, top: 40, bottom: -10, near: 1, far: 120}); key.shadow.radius = 6; key.shadow.bias = -0.0005;
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x9aa0aa, 0.8));
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-22, 30, -36); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-30, 10, 20); scene.add(fill);
  const backKey = new THREE.DirectionalLight(0xffffff, 1.1); backKey.position.set(-16, 38, -34); scene.add(backKey);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({opacity: 0.16}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4.5; floor.receiveShadow = true; scene.add(floor);

  const weave = weaveNormal(), rib = ribNormal();
  const canvases = {}, textures = {}, mats = {};
  const shirt = new THREE.Group(); scene.add(shirt);
  const geo = opts.model ? {} : {front: bodyPanel(false), back: bodyPanel(true), left: sleeve(1), right: sleeve(-1)};
  for (const k of Object.keys(geo)) {
    const P = PANELS[k], c = document.createElement('canvas'); c.width = 1400; c.height = Math.round(1400 * P.h / P.w); canvases[k] = c;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false; textures[k] = t;
    // the panel canvas is drawn top-down (y from the neck point); UV v goes up from the hem → flip in the texture matrix
    t.repeat.set(1, -1); t.offset.set(0, 1);
    mats[k] = new THREE.MeshPhysicalMaterial({map: t, roughness: 0.92, metalness: 0, normalMap: weave, normalScale: new THREE.Vector2(0.35, 0.35), sheen: 0.3, sheenRoughness: 0.85, sheenColor: new THREE.Color(0xffffff), side: THREE.FrontSide});
    const m = new THREE.Mesh(geo[k], mats[k]); m.castShadow = true; m.receiveShadow = true; shirt.add(m);
    const inner = new THREE.Mesh(geo[k], new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1, side: THREE.BackSide})); inner.userData.inner = true; shirt.add(inner);
  }
  // sleeve UV is around × along; the sleeve panel is drawn with "along" downwards
  for (const k of ['left', 'right']) if (textures[k]) { textures[k].repeat.set(1, -1); textures[k].offset.set(0, 1); }
  const collarMat = new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.95, normalMap: rib, normalScale: new THREE.Vector2(0.6, 0.6), sheen: 0.5, side: THREE.DoubleSide});
  if (!opts.model) { const col = new THREE.Mesh(collar(), collarMat); col.castShadow = true; shirt.add(col); }
  // real garment: one mesh, one atlas texture
  let atlas = null, atlasTex = null, atlasMat = null;
  if (opts.model) {
    atlas = document.createElement('canvas'); atlas.width = atlas.height = 2048;
    atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
    atlasMat = new THREE.MeshPhysicalMaterial({map: atlasTex, roughness: 0.9, metalness: 0, normalMap: weave, normalScale: new THREE.Vector2(0.3, 0.3), sheen: 0.3, sheenRoughness: 0.85, side: THREE.FrontSide});
    const innerMat = new THREE.MeshStandardMaterial({color: 0xdddddd, roughness: 1, side: THREE.BackSide});
    loadModel(opts.model).then(g => { const m = new THREE.Mesh(g, atlasMat); m.castShadow = m.receiveShadow = true; const inn = new THREE.Mesh(g, innerMat); inn.userData.inner = true; shirt.add(m, inn); update({}); opts.onReady?.(); })
      .catch(e => { console.warn('3D model', e); opts.onError?.(e); });
  }
  shirt.position.y = 0;

  let state = {colour: '#ffffff', collar: null, mode: 'areas', art: {}};
  function update(next = {}) {
    state = {...state, ...next, art: {...state.art, ...(next.art || {})}};
    const base = state.colour || '#ffffff';
    for (const k of Object.keys(canvases)) { paintPanel(canvases[k], k, base, state.art[k], state.mode); textures[k].needsUpdate = true; }
    if (atlas) { paintAtlas(atlas, state); atlasTex.needsUpdate = true; atlasMat.sheenColor.copy(new THREE.Color(base).lerp(new THREE.Color(0xffffff), 0.35)); }
    const inner = new THREE.Color(base).multiplyScalar(0.78);
    shirt.children.forEach(m => { if (m.userData.inner) m.material.color.copy(inner); });
    collarMat.color.set(state.collar || base);
    const sh = new THREE.Color(base).lerp(new THREE.Color(0xffffff), 0.35); for (const k of Object.keys(mats)) mats[k].sheenColor.copy(sh);
  }
  function setBackground(c) { scene.background = new THREE.Color(c || '#eceef1'); }
  setBackground(opts.background); update(opts);

  function size() { const r = host.getBoundingClientRect(), w = Math.max(10, r.width), h = Math.max(10, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(size); ro.observe(host); size();
  let raf = 0, alive = true; const loop = () => { if (!alive) return; raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }; loop();
  function resetView(view = 'front') {
    const p = {front: [16, 21, 84], back: [-16, 21, -84], left: [84, 21, 12], right: [-84, 21, 12]}[view] || [16, 21, 84];
    camera.position.set(...p); controls.target.set(0, 14.5, 0); controls.update();
  }
  function snapshot(type = 'image/png') { renderer.render(scene, camera); return renderer.domElement.toDataURL(type); }
  function dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); pm.dispose(); renderer.domElement.remove(); }
  return {update, setBackground, snapshot, resetView, dispose, canvases};
}
