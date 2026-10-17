/* Satin Admin — Our Work (portfolio): add projects with photos and categories, change the tags of shipped projects.
   Needs app.js (window.SatinAdmin). API: /api/admin/portfolio… (hp/php/satin-new/portfolio.php). */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let DATA = null, FILTER = { q: '', source: '', service: '', status: '' };

async function load() { DATA = await A().api('/portfolio'); return DATA; }
async function route(path, params) {
  if (path === '/portfolio/edit') return edit(params);
  return list();
}

/* ---------------- list ---------------- */
async function list() {
  const c = A().shell('Our Work (portfolio)', 'Website', '<div class="card empty">Loading…</div>', '/portfolio');
  $('[data-actions]').innerHTML = '<a class="btn sm" href="#/portfolio/edit">+ Add project</a>';
  try { await load(); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const T = DATA.taxonomy;
  c.innerHTML = `<div class="toolbar"><input class="input" data-q placeholder="Search title, vehicle, client, tag" value="${esc(FILTER.q)}">
    <select class="input" data-src><option value="">All projects</option><option value="custom">Added here</option><option value="static">Original portfolio</option></select>
    <select class="input" data-svc><option value="">All services</option>${Object.entries(T.services).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
    <select class="input" data-st><option value="">Any status</option><option value="published">Published</option><option value="draft">Draft</option><option value="hidden">Hidden</option><option value="featured">Featured</option></select></div>
    <p class="hint" data-count></p><div class="pf-grid" data-list></div>`;
  $('[data-src]', c).value = FILTER.source; $('[data-svc]', c).value = FILTER.service; $('[data-st]', c).value = FILTER.status;
  const draw = () => {
    const words = FILTER.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = DATA.projects.filter(p => {
      const st = p.hidden ? 'hidden' : p.status;
      if (FILTER.source && (FILTER.source === 'custom') !== !!p.custom) return false;
      if (FILTER.service && !(p.services || []).includes(FILTER.service)) return false;
      if (FILTER.status === 'featured' ? !p.featured : FILTER.status && st !== FILTER.status) return false;
      const hay = [p.title, p.slug, p.model, p.client, p.vehicle, p.industry, ...(p.tags || [])].join(' ').toLowerCase();
      return words.every(w => hay.includes(w));
    });
    $('[data-count]', c).textContent = `${rows.length} of ${DATA.projects.length} projects · ${DATA.projects.filter(p => p.custom).length} added here`;
    $('[data-list]', c).innerHTML = rows.slice(0, 300).map(p => {
      const img = p.cover || p.images?.[0];
      const href = p.custom ? `#/portfolio/edit?id=${encodeURIComponent(p.id)}` : `#/portfolio/edit?static=${encodeURIComponent(p.slug)}`;
      return `<a class="pf-card" href="${href}"><div class="pf-ph">${img ? `<img src="${esc(img.thumb || img.src)}" alt="" loading="lazy">` : '<span>No photo</span>'}</div>
        <div class="pf-info"><b>${p.featured ? '★ ' : ''}${esc(p.title || '(untitled)')}</b><small>${esc([p.vehicle, p.model].filter(Boolean).join(' · ') || '—')}</small>
        <div class="pf-pills">${p.custom ? `<span class="pill ${p.status === 'published' ? 'confirmed' : ''}">${p.status === 'published' ? 'Published' : 'Draft'}</span>` : `<span class="pill">Original</span>`}${p.hidden ? '<span class="pill cancelled">Hidden</span>' : ''}${p.overridden ? '<span class="pill contacted">Tags edited</span>' : ''}
        ${(p.services || []).slice(0, 2).map(s => `<span class="pill">${esc(T.services[s] || s)}</span>`).join('')}</div></div></a>`;
    }).join('') || '<div class="card empty">No projects match.</div>';
  };
  let t; $('[data-q]', c).oninput = e => { FILTER.q = e.target.value; clearTimeout(t); t = setTimeout(draw, 150); };
  $('[data-src]', c).onchange = e => { FILTER.source = e.target.value; draw(); };
  $('[data-svc]', c).onchange = e => { FILTER.service = e.target.value; draw(); };
  $('[data-st]', c).onchange = e => { FILTER.status = e.target.value; draw(); };
  draw();
}

/* ---------------- editor ---------------- */
const chips = (name, map, sel) => `<div class="pf-chips">${Object.entries(map).map(([k, v]) => `<label class="pf-chip"><input type="checkbox" name="${name}" value="${k}" ${sel.includes(k) ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>`;
async function edit(params) {
  const id = params.get('id'), slug = params.get('static');
  const c = A().shell(id || slug ? 'Edit project' : 'Add project', '<a href="#/portfolio">Our Work</a>', '<div class="card empty">Loading…</div>', '/portfolio');
  try { if (!DATA) await load(); else load().catch(() => {}); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; return; }
  const T = DATA.taxonomy;
  const found = id ? DATA.projects.find(p => p.custom && p.id === id) : slug ? DATA.projects.find(p => !p.custom && p.slug === slug) : null;
  if ((id || slug) && !found) { c.innerHTML = '<div class="card empty">This project no longer exists. <a href="#/portfolio">Back to Our Work</a></div>'; return; }
  const isStatic = !!slug;
  const P = found ? JSON.parse(JSON.stringify(found)) : { title: '', make: '', model: '', year: '', vehicleType: '', client: '', industry: '', description: '', services: [], finishes: [], tags: [], images: [], featured: false, status: 'draft' };
  // custom projects: the extra tags are what is left after the taxonomy labels
  const known = new Set([...Object.values(T.services), ...Object.values(T.vehicles), ...Object.values(T.finishes)]);
  const derived = new Set(['Commercial wrap', 'Colour change', 'Full Wrap', 'Partial Wrap', 'Decal', 'Channel Wrap', 'Sedan']);
  P.extraTags = (P.tags || []).filter(t => !known.has(t) && !derived.has(t));
  P.images = P.images || [];
  if (isStatic && P.cover && !P.images.some(i => i.src === P.cover.src)) P.images.unshift(P.cover); // the shipped cover is a separate photo: show it in the list
  P.coverIdx = Math.max(0, P.images.findIndex(i => P.cover && i.src === P.cover.src));
  const photoSig = () => JSON.stringify([P.images.map(i => [i.src, i.alt || '']), P.coverIdx]), photos0 = photoSig();
  const canPub = DATA.canPublish;
  const url = found ? `/satin/portfolio/projects/${found.slug}/` : '';
  $('[data-actions]').innerHTML = `${url && (isStatic || found.status === 'published') ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener">View on website ↗</a>` : ''}`;
  c.innerHTML = `<div data-msg></div><form class="pf-edit" data-f novalidate><div class="grid pf-cols">
    <section class="card"><h2>${isStatic ? 'Original project' : 'Project'}</h2>
      ${isStatic ? `<label class="field"><span>Name *</span><input name="title" required maxlength="80" value="${esc(P.title)}" placeholder="e.g. Green Life HVAC"></label>
        <label class="field"><span>Vehicle make &amp; model</span><input name="model" maxlength="80" value="${esc(P.model || '')}" placeholder="e.g. Mercedes Sprinter"></label>
        <p class="hint">${esc([P.vehicle, P.industry, P.coverage].filter(Boolean).join(' · '))}${P.photosEdited ? ' · photos changed in admin' : ''}</p>`
      : `<label class="field"><span>Title *</span><input name="title" required maxlength="120" value="${esc(P.title)}" placeholder="e.g. ABC Plumbing — Ford Transit fleet"></label>
      <div class="pf-row"><label class="field"><span>Make</span><input name="make" maxlength="60" value="${esc(P.make)}" placeholder="Ford"></label><label class="field"><span>Model</span><input name="model" maxlength="60" value="${esc(found ? found.modelName || '' : '')}" placeholder="Transit 250"></label><label class="field"><span>Year</span><input name="year" inputmode="numeric" maxlength="4" value="${esc(P.year)}" placeholder="2024"></label></div>
      <div class="pf-row"><label class="field"><span>Client (optional)</span><input name="client" maxlength="120" value="${esc(P.client)}"></label><label class="field"><span>Industry (optional)</span><input name="industry" maxlength="60" list="pf-ind" value="${esc(P.industry)}"><datalist id="pf-ind">${(DATA.industries || []).map(i => `<option value="${esc(i)}">`).join('')}</datalist></label></div>`}
      <label class="field"><span>Description ${isStatic ? '(optional — replaces the generated text)' : ''}</span><textarea name="description" rows="5" maxlength="4000" placeholder="What we did, materials, colour, timeline…">${esc(isStatic ? (found.description || '') : P.description)}</textarea></label>
      ${isStatic ? '' : `<label class="field"><span>Web address</span><input name="slug" maxlength="80" value="${esc(found ? found.slug : '')}" placeholder="made from the title"><div class="hint">satingraphic.ca/satin/portfolio/projects/<b data-slug>${esc(found ? found.slug : '…')}</b>/</div></label>`}
    </section>
    <section class="card"><h2>Where it shows up</h2><p class="hint" style="margin-top:-6px">Customers filter and search Our Work by these.</p>
      <div class="field"><span>Services</span>${chips('services', T.services, P.services || [])}</div>
      <label class="field"><span>Vehicle type</span><select name="vehicleType"><option value="">—</option>${Object.entries(T.vehicles).map(([k, v]) => `<option value="${k}" ${P.vehicleType === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <div class="field"><span>Finish / colour</span>${chips('finishes', T.finishes, P.finishes || [])}</div>
      <label class="field"><span>Extra search tags</span><input name="tags" maxlength="600" value="${esc(P.extraTags.join(', '))}" placeholder="e.g. Tesla, red, food truck"><div class="hint">Separate with commas.${isStatic ? ' Saving replaces the original tags with the services, vehicle, finish and these tags.' : ''}</div></label>
      <label class="pf-check"><input type="checkbox" name="featured" ${P.featured ? 'checked' : ''}> <span><b>Featured</b> — show at the top of Our Work</span></label>
      ${isStatic ? `<label class="pf-check"><input type="checkbox" name="hidden" ${P.hidden ? 'checked' : ''}> <span><b>Hide</b> from Our Work</span></label>` : `<label class="field" style="margin-top:14px"><span>Status</span><select name="status"><option value="draft">Draft — not on the website</option><option value="published" ${P.status === 'published' ? 'selected' : ''} ${canPub ? '' : 'disabled'}>Published</option></select>${canPub ? '' : '<div class="hint">Publishing needs the “publish website” permission.</div>'}</label>`}
    </section></div>
    ${`<section class="card" style="margin-top:18px"><h2>Photos</h2><p class="hint" style="margin-top:-6px">JPG, PNG or WebP. Photos are resized and converted to WebP on the server. Drag or use the arrows to reorder, <b>Set as cover</b> picks the preview photo shown on Our Work, ✕ removes a photo. To replace a photo, upload the new one and remove the old one.</p>
      <label class="pf-drop" data-drop><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-file hidden><b>Drop photos here</b> or <u>choose files</u><span class="hint" data-up></span></label>
      <div class="pf-photos" data-photos></div></section>`}
    <div class="pf-bar"><button class="btn" type="submit">Save</button>${found ? `<button class="btn ghost" type="button" data-del>${isStatic ? 'Reset to original' : 'Delete project'}</button>` : ''}<a class="btn ghost" href="#/portfolio">Back</a></div></form>`;
  const f = $('[data-f]', c);
  const msg = (m, ok) => { $('[data-msg]', c).innerHTML = m ? `<div class="${ok ? 'okmsg' : 'err'}">${esc(m)}</div>` : ''; };
  {
    drawPhotos(c, P);
    const fileIn = $('[data-file]', c), drop = $('[data-drop]', c);
    fileIn.onchange = () => { upload(c, P, [...fileIn.files]); fileIn.value = ''; };
    drop.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); drop.classList.add('on'); } };
    drop.ondragleave = () => drop.classList.remove('on');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('on'); upload(c, P, [...e.dataTransfer.files].filter(x => /^image\//.test(x.type))); };
  }
  if (!isStatic) {
    const slugEl = f.slug, show = $('[data-slug]', c);
    const slugify = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    const upd = () => { show.textContent = slugify(slugEl.value) || (found ? found.slug : slugify(f.title.value + (f.make.value ? ' ' + f.make.value + ' ' + f.model.value : '')) || '…'); };
    slugEl.oninput = upd; f.title.oninput = upd; f.make.oninput = upd; f.model.oninput = upd;
  }
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', f); btn.disabled = true; msg('');
    const vals = name => $$(`input[name="${name}"]:checked`, f).map(x => x.value);
    const body = { services: vals('services'), finishes: vals('finishes'), vehicleType: f.vehicleType.value, tags: f.tags.value.split(',').map(s => s.trim()).filter(Boolean), description: f.description.value, featured: f.featured.checked };
    try {
      if ($('[data-up]', c).dataset.busy) throw new Error('Wait for the photos to finish uploading.');
      if (isStatic) { const extra = photoSig() !== photos0 ? { photos: P.images.map(i => ({ src: i.src, thumb: i.thumb, width: i.width, height: i.height, alt: i.alt || '' })), cover: P.coverIdx || 0 } : {};
        if (extra.photos && !extra.photos.length) throw new Error('Keep at least one photo.');
        await A().api('/portfolio/save', { ...body, ...extra, staticSlug: slug, hidden: f.hidden.checked, title: f.title.value.trim(), model: f.model.value.trim() }); A().toast('Saved — the website shows it now'); DATA = null; A().go('/portfolio'); return; }
      Object.assign(body, { id: found?.id, title: f.title.value, make: f.make.value, model: f.model.value, year: f.year.value, client: f.client.value, industry: f.industry.value, slug: f.slug.value, status: f.status.value,
        images: P.images.map(i => ({ src: i.src, thumb: i.thumb, width: i.width, height: i.height, alt: i.alt || '' })), cover: P.coverIdx || 0 });
      const r = await A().api('/portfolio/save', body);
      A().toast(r.status === 'published' ? 'Published — it is on Our Work now' : 'Saved as draft');
      DATA = null;
      if (!found) { A().go('/portfolio/edit?id=' + encodeURIComponent(r.id)); return; }
      await load(); edit(new URLSearchParams('id=' + encodeURIComponent(r.id)));
    } catch (er) { msg(er.message); window.scrollTo(0, 0); } finally { btn.disabled = false; }
  };
  const del = $('[data-del]', c);
  if (del) del.onclick = () => A().confirmBox(isStatic ? 'Reset this project?' : 'Delete this project?', isStatic ? 'Its name, photos, services, tags, description and featured/hidden settings go back to the original. Photos you uploaded for it are deleted.' : 'The project page and its photos are removed from the website. This cannot be undone.', async () => {
    try { await A().api('/portfolio/delete', isStatic ? { staticSlug: slug } : { id: found.id }); A().toast(isStatic ? 'Reset' : 'Deleted'); DATA = null; A().go('/portfolio'); } catch (er) { A().toast(er.message); }
  });
}

function drawPhotos(c, P) {
  const box = $('[data-photos]', c);
  box.innerHTML = P.images.length ? P.images.map((i, n) => `<figure class="${n === P.coverIdx ? 'cover' : ''}" draggable="true" data-i="${n}"><img src="${esc(i.thumb || i.src)}" alt="">
    <figcaption><div class="pf-ph-tools">${n === P.coverIdx ? '<b>★ Cover</b>' : `<button type="button" data-cover="${n}">Set as cover</button>`}<span><button type="button" data-mv="${n}" data-d="-1" title="Move left" ${n ? '' : 'disabled'}>←</button><button type="button" data-mv="${n}" data-d="1" title="Move right" ${n < P.images.length - 1 ? '' : 'disabled'}>→</button><button type="button" data-rm="${n}" title="Remove">✕</button></span></div>
    <input class="input" data-alt="${n}" maxlength="200" placeholder="Alt text (describe the photo)" value="${esc(i.alt || '')}"></figcaption></figure>`).join('') : '<p class="hint">No photos yet.</p>';
  const move = (from, to) => { if (to < 0 || to >= P.images.length || from === to) return; const cov = P.images[P.coverIdx]; const [x] = P.images.splice(from, 1); P.images.splice(to, 0, x); P.coverIdx = Math.max(0, P.images.indexOf(cov)); drawPhotos(c, P); };
  $$('[data-cover]', box).forEach(b => b.onclick = () => { P.coverIdx = +b.dataset.cover; drawPhotos(c, P); });
  $$('[data-mv]', box).forEach(b => b.onclick = () => move(+b.dataset.mv, +b.dataset.mv + +b.dataset.d));
  $$('[data-rm]', box).forEach(b => b.onclick = () => { const cov = P.images[P.coverIdx]; P.images.splice(+b.dataset.rm, 1); P.coverIdx = Math.max(0, P.images.indexOf(cov)); drawPhotos(c, P); });
  $$('[data-alt]', box).forEach(inp => inp.oninput = () => { P.images[+inp.dataset.alt].alt = inp.value; });
  let dragFrom = null;
  $$('figure[draggable]', box).forEach(fig => {
    fig.ondragstart = e => { dragFrom = +fig.dataset.i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', fig.dataset.i); fig.classList.add('dragging'); };
    fig.ondragend = () => fig.classList.remove('dragging');
    fig.ondragover = e => { if (dragFrom !== null) { e.preventDefault(); fig.classList.add('over'); } };
    fig.ondragleave = () => fig.classList.remove('over');
    fig.ondrop = e => { e.preventDefault(); e.stopPropagation(); const to = +fig.dataset.i; const from = dragFrom; dragFrom = null; move(from, to); };
  });
}
async function upload(c, P, files) {
  const st = $('[data-up]', c); if (!files.length) return;
  st.dataset.busy = '1'; let done = 0;
  for (const file of files) {
    st.textContent = ` · Uploading ${done + 1} of ${files.length}…`;
    const fd = new FormData(); fd.append('file', file, file.name);
    try {
      const r = await fetch('/api/admin/portfolio/upload', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Upload failed');
      P.images.push(j.image); drawPhotos(c, P);
    } catch (e) { A().toast(`${file.name}: ${e.message}`); }
    done++;
  }
  delete st.dataset.busy; st.textContent = ` · ${done} uploaded — remember to Save`;
}

window.SatinPortfolio = { route };
})();
