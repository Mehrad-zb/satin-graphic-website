// Design Studio — 3D garment preview for T-shirts, hoodies, polos and hats (three.js, self-hosted in /studio/vendor/three).
// Real garment models (Sketchfab, CC-BY / Standard licence — credits in /studio/models/CREDITS.txt) are converted by
// tools/garment3d/prep.py into small .g3d files: one mesh in inches, facing +z, standing on y = 0.
// The customer's artwork for each side (front / back; hats front only) is projected onto the cloth like a
// print: a box in front of the print area, the picture shown on the surfaces facing that way. No UV map is needed, so any
// garment model works. Same API as shirt3d.mjs: update({colour, art: {front, back}}), setBackground,
// snapshot, resetView, dispose.
import * as THREE from './vendor/three/three.module.min.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {RoomEnvironment} from './vendor/three/RoomEnvironment.js';

/* per model: where each print area sits (inches). top = top edge of the print, y measured from the hem.
   size = default print area when the designer does not say. */
export const GARMENTS = {
  tshirt: {file: 'tshirt.g3dz', label: 'T-shirt', credit: 'Tabbuso', front: {top: 23.4, size: [12, 16]}, back: {top: 26.0, size: [12, 16]}},
  // polo: the front is a small left-chest logo (the design is trimmed to its edges), the back a large print
  polo: {file: 'polo.g3dz', label: 'Polo', front: {top: 23.0, x: 4.2, size: [4, 4], trim: true}, back: {top: 25.5, size: [11, 13]}},
  hoodie: {file: 'hoodie.g3dz', label: 'Hoodie', credit: 'yogaminggames', front: {top: 20.0, size: [11, 9]}, back: {top: 17.5, size: [12, 13]}},
  sweatshirt: {file: 'sweatshirt.g3dz', label: 'Sweatshirt', credit: 'hasar', front: {top: 21.8, size: [12, 14]}, back: {top: 24.0, size: [12, 14]}},
  cap: {file: 'cap.g3dz', label: 'Cap', credit: 'markdo', cam: 'hat', front: {top: 3.75, size: [4.5, 2.25], trim: true}},
  beanie: {file: 'beanie.g3dz', label: 'Beanie', credit: 'StubbornFunkyDonkey', cam: 'hat', front: {top: 5.2, size: [4, 2.2], trim: true}}
};
/** which model shows a product: garment category + product name */
export function garmentFor(category, name = '') {
  const n = String(name).toLowerCase();
  if (category === 'hats') return /beanie|knit|toque|cuff/.test(n) ? 'beanie' : 'cap';
  if (category === 'hoodies' || /hood/.test(n)) return 'hoodie';
  if (category === 'polos' || /polo/.test(n)) return 'polo';
  if (category === 'sweatshirts' || category === 'long-sleeves' || /sweatshirt/.test(n)) return 'sweatshirt';
  if (category === 't-shirts') return 'tshirt';
  return null;
}

async function loadG3D(url) {
  let b = await fetch(url).then(r => { if (!r.ok) throw Error('model ' + r.status); return r.arrayBuffer(); });
  if (new Uint8Array(b, 0, 2)[0] === 0x1f && new Uint8Array(b, 0, 2)[1] === 0x8b) // .g3dz = gzip (unless the server already unpacked it)
    b = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const dv = new DataView(b); if (dv.getUint32(0, true) !== 0x31443347) throw Error('not a G3D file');
  const hl = dv.getUint32(4, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(b, 8, hl))); let o = 8 + hl;
  const q = new Int16Array(b, o, h.verts * 3); o += h.verts * 6; o += (4 - o % 4) % 4;
  const n8 = new Int8Array(b, o, h.verts * 4); o += h.verts * 4;
  const idx = new Uint32Array(b, o, h.tris * 3);
  const pos = new Float32Array(h.verts * 3), nor = new Float32Array(h.verts * 3), k = h.scale / 32767;
  for (let i = 0; i < h.verts; i++) { pos[i * 3] = q[i * 3] * k; pos[i * 3 + 1] = q[i * 3 + 1] * k; pos[i * 3 + 2] = q[i * 3 + 2] * k; nor[i * 3] = n8[i * 4] / 127; nor[i * 3 + 1] = n8[i * 4 + 1] / 127; nor[i * 3 + 2] = n8[i * 4 + 2] / 127; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingBox(); return g;
}

/* a fine knit bump so the cloth does not look like plastic */
function weave() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let i = 0; i < 128; i++) { const v = Math.sin(i * 1.6) * Math.sin(y * 1.6) * 18 + (Math.random() - .5) * 14; const p = (y * 128 + i) * 4; d.data[p] = 128 + v; d.data[p + 1] = 128 - v; d.data[p + 2] = 255; d.data[p + 3] = 255; }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); return t;
}

const SIDES = ['front', 'back'];
const trimCache = new WeakMap();
/** the picture cut to its non-transparent part (cached per image) */
function trimmed(img) {
  if (trimCache.has(img)) return trimCache.get(img);
  const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight, k = Math.min(1, 600 / Math.max(W, H));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k));
  const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  let out = img;
  if (x1 >= 0) { const o = document.createElement('canvas'), sx = x0 / k, sy = y0 / k, sw = (x1 - x0 + 1) / k, sh = (y1 - y0 + 1) / k; o.width = Math.round(sw); o.height = Math.round(sh); o.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, o.width, o.height); out = o; }
  trimCache.set(img, out); return out;
}
/** box (centre, axes) of one print area on the model, in model inches */
function decalFrame(cfg, side, box, w, h) {
  const s = cfg[side]; if (!s) return null;
  const c = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  if (side === 'front' || side === 'back') {
    const f = side === 'front' ? 1 : -1, depth = box.max.z - box.min.z;
    c.set(side === 'front' ? (s.x || 0) : -(s.x || 0), s.top - h / 2, f * depth / 4); right.set(f, 0, 0); dir.set(0, 0, f);
    return {c, right, up, dir, d: depth / 2 + 2};
  }
  const f = side === 'left' ? 1 : -1; c.set(...s.at);
  if (s.axis === 'arm') { right.set(0, 0, -f); up.set(0, 1, 0); }
  else right.set(0, 0, -f);
  dir.set(f, 0, 0); c.x += f * 1.5;
  return {c, right, up, dir, d: 10};
}

export function mountGarment3D(host, opts = {}) {
  const cfg = GARMENTS[opts.garment] || GARMENTS.tshirt;
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement); renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  let credit = null;
  if (cfg.credit) { // CC BY 4.0 attribution
    credit = document.createElement('a'); credit.href = '/studio/models/CREDITS.txt'; credit.target = '_blank'; credit.rel = 'noopener';
    credit.textContent = `3D model: ${cfg.credit} · CC BY 4.0`; credit.style.cssText = 'position:absolute;left:10px;bottom:8px;font:11px/1.2 system-ui,sans-serif;color:#6b7280;text-decoration:none;background:#ffffffb3;padding:3px 7px;border-radius:6px;z-index:2';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.append(credit);
  }
  const scene = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0005;
  const rim = new THREE.DirectionalLight(0xffffff, 0.9), back = new THREE.DirectionalLight(0xffffff, 0.9);
  scene.add(key, rim, back, new THREE.HemisphereLight(0xffffff, 0x9aa0aa, 0.75));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({opacity: 0.15}));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false; controls.minPolarAngle = 0.3; controls.maxPolarAngle = 1.9; controls.rotateSpeed = 0.8;

  // decals: up to 4 projected pictures, mixed into the cloth colour in the fragment shader
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
  const U = {dT0: {value: blank}, dT1: {value: blank}, dT2: {value: blank}, dT3: {value: blank},
    dM: {value: [0, 1, 2, 3].map(() => new THREE.Matrix4())}, dD: {value: [0, 1, 2, 3].map(() => new THREE.Vector3())}, dOn: {value: [0, 0, 0, 0]}};
  const mat = new THREE.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.88, metalness: 0, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff),
    normalMap: weave(), normalScale: new THREE.Vector2(0.25, 0.25), side: THREE.DoubleSide});
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vP;\nvarying vec3 vNo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position; vNo = normal;');
    sh.fragmentShader = `varying vec3 vP;\nvarying vec3 vNo;\nuniform sampler2D dT0, dT1, dT2, dT3;\nuniform mat4 dM[4];\nuniform vec3 dD[4];\nuniform float dOn[4];
vec4 decal(sampler2D t, int i) {
  if (dOn[i] < 0.5) return vec4(0.0);
  vec4 p = dM[i] * vec4(vP, 1.0);
  if (abs(p.x) > 0.5 || abs(p.y) > 0.5 || abs(p.z) > 0.5) return vec4(0.0);
  float f = dot(normalize(vNo), dD[i]) * (gl_FrontFacing ? 1.0 : -1.0);
  if (f < 0.12) return vec4(0.0);
  vec4 c = texture2D(t, vec2(p.x + 0.5, p.y + 0.5));
  c.a *= smoothstep(0.12, 0.3, f);
  return c;
}
` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec4 a = decal(dT0, 0); diffuseColor.rgb = mix(diffuseColor.rgb, a.rgb, a.a);
    a = decal(dT1, 1); diffuseColor.rgb = mix(diffuseColor.rgb, a.rgb, a.a);
    a = decal(dT2, 2); diffuseColor.rgb = mix(diffuseColor.rgb, a.rgb, a.a);
    a = decal(dT3, 3); diffuseColor.rgb = mix(diffuseColor.rgb, a.rgb, a.a); }`);
  };

  let mesh = null, box = null, state = {colour: '#ffffff', art: {}, areas: opts.areas || {}};
  const tex = {};
  function applyDecals() {
    if (!box) return;
    SIDES.forEach((k, i) => {
      const art = state.art[k], area = state.areas[k] || {}, s = cfg[k];
      if (!art || !s) { U.dOn.value[i] = 0; return; }
      // the artwork image is the whole print area: fit the box to it (keeps the picture's shape)
      let pic = art;
      if (s.trim) pic = trimmed(art); // logo placements: only the drawn part counts, fitted into the small area
      const aw = pic.width || pic.naturalWidth || 1, ah = pic.height || pic.naturalHeight || 1;
      let w = s.trim ? s.size[0] : area.w || s.size[0], h = s.trim ? s.size[1] : area.h || s.size[1]; const r = aw / ah; if (w / h > r) w = h * r; else h = w / r;
      const fr = decalFrame(cfg, k, box, w, h); if (!fr) { U.dOn.value[i] = 0; return; }
      const zAxis = new THREE.Vector3().crossVectors(fr.right, fr.up).normalize(), up = new THREE.Vector3().crossVectors(zAxis, fr.right).normalize();
      const m = new THREE.Matrix4().makeBasis(fr.right.clone().multiplyScalar(w), up.multiplyScalar(h), zAxis.multiplyScalar(fr.d * 2)).setPosition(fr.c);
      U.dM.value[i].copy(m).invert(); U.dD.value[i].copy(fr.dir); U.dOn.value[i] = 1;
      let t = tex[k]; if (!t || t.image !== pic) { t?.dispose(); t = tex[k] = new THREE.Texture(pic); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
      t.needsUpdate = true; U['dT' + i].value = t;
    });
  }
  function update(next = {}) {
    state = {...state, ...next, art: {...state.art, ...(next.art || {})}, areas: {...state.areas, ...(next.areas || {})}};
    const col = new THREE.Color(state.colour || '#ffffff'); mat.color.copy(col); mat.sheenColor.copy(col.clone().lerp(new THREE.Color(0xffffff), 0.4));
    applyDecals();
  }
  function frame(view = 'front') {
    if (!box) return; const sz = box.getSize(new THREE.Vector3()), hat = cfg.cam === 'hat';
    const ty = hat ? sz.y * 0.5 : sz.y * 0.52, dist = Math.max(sz.x * (hat ? 1.2 : 0.9), sz.y * 1.25, hat ? sz.z * 1.05 : 0) / (2 * Math.tan(THREE.MathUtils.degToRad(14))) * 1.05;
    const a = {front: 0.18, back: Math.PI + 0.18, left: Math.PI / 2, right: -Math.PI / 2}[view] ?? 0.18, lift = hat ? 0.35 : 0.12;
    camera.position.set(Math.sin(a) * dist, ty + dist * lift, Math.cos(a) * dist); controls.target.set(0, ty, 0);
    controls.minDistance = dist * 0.45; controls.maxDistance = dist * 1.8; camera.near = dist / 50; camera.far = dist * 10; camera.updateProjectionMatrix(); controls.update();
    key.position.set(sz.x, sz.y * 2.2, dist * 0.8); rim.position.set(-sz.x * 1.5, sz.y * 1.4, -dist * 0.7); back.position.set(sz.x, sz.y, -dist);
    const sc = key.shadow.camera, e = Math.max(sz.x, sz.z) * 1.2; Object.assign(sc, {left: -e, right: e, top: sz.y * 1.4, bottom: -e, near: 0.1, far: dist * 4}); sc.updateProjectionMatrix();
  }
  loadG3D((opts.base || '/studio/models/') + cfg.file).then(g => {
    mesh = new THREE.Mesh(g, mat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); box = g.boundingBox.clone();
    frame('front'); update({}); opts.onReady?.();
  }).catch(e => { console.warn('3D garment', e); opts.onError?.(e); });

  function setBackground(c) { scene.background = new THREE.Color(c || '#eceef1'); }
  setBackground(opts.background); update(opts);
  function size() { const r = host.getBoundingClientRect(), w = Math.max(10, r.width), h = Math.max(10, r.height); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(size); ro.observe(host); size();
  let raf = 0, alive = true; const loop = () => { if (!alive) return; raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }; loop();
  function snapshot(type = 'image/png') { renderer.render(scene, camera); return renderer.domElement.toDataURL(type); }
  function dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); Object.values(tex).forEach(t => t.dispose()); renderer.dispose(); pm.dispose(); renderer.domElement.remove(); credit?.remove(); }
  return {update, setBackground, snapshot, resetView: frame, dispose, sides: SIDES.filter(k => cfg[k])};
}
