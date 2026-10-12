/* Satin Graphic — Wrap Visualizer segmentation worker.
   Runs Segment Anything (SlimSAM, quantised) in the visitor's browser with transformers.js — the photo never leaves the device.
   Messages in:  {type:'load'} · {type:'embed', id, bitmap} · {type:'decode', id, points:[[x,y,label],...] (x,y normalised 0..1)}
   Messages out: {type:'ready', device} · {type:'progress', pct} · {type:'embedded', id} · {type:'mask', id, w, h, data:Uint8Array, score} · {type:'error', message} */
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';
const MODEL = 'Xenova/slimsam-77-uniform';
let T = null, model = null, processor = null, device = 'wasm';
let current = null; // {id, inputs, embeddings}

async function load() {
  if (model) return;
  T = await import(LIB);
  T.env.allowLocalModels = false;
  const progress = p => { if (p && p.status === 'progress' && p.total) postMessage({ type: 'progress', pct: Math.round(100 * p.loaded / p.total), file: p.file }); };
  try {
    if ('gpu' in navigator && await navigator.gpu.requestAdapter()) device = 'webgpu';
  } catch { device = 'wasm'; }
  try { // image encoder on the GPU; the small prompt decoder runs many times per photo and is fastest on the CPU
    model = device === 'webgpu'
      ? await T.SamModel.from_pretrained(MODEL, { dtype: { vision_encoder: 'fp16', prompt_encoder_mask_decoder: 'q8' }, device: { vision_encoder: 'webgpu', prompt_encoder_mask_decoder: 'wasm' }, progress_callback: progress })
      : await T.SamModel.from_pretrained(MODEL, { dtype: 'q8', device, progress_callback: progress });
  } catch (e) { // WebGPU can fail on some drivers: fall back to WASM
    device = 'wasm'; model = await T.SamModel.from_pretrained(MODEL, { dtype: 'q8', device, progress_callback: progress });
  }
  processor = await T.AutoProcessor.from_pretrained(MODEL);
}

async function embed(id, bitmap) {
  await load();
  try { await embedWith(id, bitmap); }
  catch (e) { // some WebGPU drivers load the model but fail on inference: retry on WASM
    if (device !== 'webgpu') throw e;
    device = 'wasm'; model = await T.SamModel.from_pretrained(MODEL, { dtype: 'q8', device }); await embedWith(id, bitmap);
  }
}
async function embedWith(id, bitmap) {
  const c = new OffscreenCanvas(bitmap.width, bitmap.height), g = c.getContext('2d'); g.drawImage(bitmap, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const image = new T.RawImage(d.data, c.width, c.height, 4).rgb();
  const inputs = await processor(image);
  const embeddings = await model.get_image_embeddings(inputs);
  current = { id, inputs, embeddings, w: c.width, h: c.height };
}

async function decode(id, points, lowres) {
  if (!current || current.id !== id) throw new Error('Image not ready');
  const [rh, rw] = current.inputs.reshaped_input_sizes[0];
  const pts = points.map(p => [p[0] * rw, p[1] * rh]);
  const input_points = new T.Tensor('float32', pts.flat(), [1, 1, pts.length, 2]);
  const input_labels = new T.Tensor('int64', points.map(p => BigInt(p[2] ? 1 : 0)), [1, 1, pts.length]);
  const out = await model({ ...current.embeddings, input_points, input_labels });
  if (lowres) { // raw 256×256 logits cropped to the image (the model input is the photo resized to 1024 and padded): fast probes
    const pm = out.pred_masks, d = pm.dims, H4 = d[d.length - 2], W4 = d[d.length - 1], S = 1024 / H4;
    const ch = Math.min(H4, Math.ceil(rh / S)), cw = Math.min(W4, Math.ceil(rw / S)), plane = cw * ch, data = new Uint8Array(plane * 3), src = pm.data;
    for (let k = 0; k < 3; k++) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) data[k * plane + y * cw + x] = src[k * H4 * W4 + y * W4 + x] > 0 ? 255 : 0;
    return { w: cw, h: ch, data, scores: Array.from(out.iou_scores.data), lowres: true };
  }
  const masks = await processor.post_process_masks(out.pred_masks, current.inputs.original_sizes, current.inputs.reshaped_input_sizes);
  const scores = out.iou_scores.data;
  let best = 0; for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const m = masks[0]; // [1, 3, H, W] bool
  const [, , H, W] = m.dims, plane = W * H, src = m.data, data = new Uint8Array(plane * 3);
  // all three candidates (part → whole object), planar; the caller picks
  for (let i = 0; i < plane * 3; i++) data[i] = src[i] ? 255 : 0;
  const areas = [0, 1, 2].map(k => { let a = 0; for (let i = k * plane; i < (k + 1) * plane; i++) a += src[i] ? 1 : 0; return a; });
  return { w: W, h: H, data, score: scores[best], best, areas: Array.from(areas), scores: Array.from(scores) };
}

self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'load') { await load(); postMessage({ type: 'ready', device, seq: m.seq }); }
    else if (m.type === 'embed') { await embed(m.id, m.bitmap); postMessage({ type: 'embedded', id: m.id, device, seq: m.seq }); }
    else if (m.type === 'decode') { const t0 = performance.now(), r = await decode(m.id, m.points, m.lowres); r.ms = Math.round(performance.now() - t0); postMessage({ type: 'mask', id: m.id, seq: m.seq, ...r }, [r.data.buffer]); }
  } catch (err) { postMessage({ type: 'error', message: String(err && err.message || err), seq: m.seq }); }
};
