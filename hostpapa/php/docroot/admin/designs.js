/* Satin Admin — Studio designs: every design customers approved or submitted for review in Design Studio.
   Filters: status, date range, search (customer, email, phone, reference, product). Opens the mockup and print files. Needs app.js (window.SatinAdmin). */
(() => {
const A = () => window.SatinAdmin;
const esc = s => A().esc(s);
const STATUS = { submitted: 'Submitted · new', reviewing: 'In review', quoted: 'Quote sent', approved_customer: 'Customer approved', production: 'In production', done: 'Done', cancelled: 'Cancelled' };
const PILL = { submitted: 'pending', reviewing: 'confirmed', quoted: 'confirmed', approved_customer: 'confirmed', production: 'confirmed', done: 'completed', cancelled: 'cancelled' };
const day = s => (s || '').slice(0, 10);
const RANGES = [['all', 'All time'], ['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['year', 'This year'], ['custom', 'Custom dates']];
function rangeDates(r, from, to) {
  const now = new Date(), iso = d => d.toISOString().slice(0, 10), back = n => { const d = new Date(now); d.setDate(d.getDate() - n + 1); return iso(d); };
  if (r === 'today') return [iso(now), iso(now)];
  if (/^\d+$/.test(r)) return [back(+r), iso(now)];
  if (r === 'year') return [now.getFullYear() + '-01-01', iso(now)];
  if (r === 'custom') return [from || '', to || ''];
  return ['', ''];
}
const fileURL = (d, id, inline) => `/api/admin/shop/designs/file?design=${encodeURIComponent(d)}&id=${encodeURIComponent(id)}${inline ? '&inline=1' : ''}`;

async function route() {
  const c = A().shell('Studio designs', 'Online orders', '<div class="card empty">Loading…</div>', '/designs');
  let data;
  try { data = await A().api('/shop/designs'); } catch (e) { c.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  const all = data.designs || [];
  c.innerHTML = `<div class="card"><div class="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <input class="input" data-q placeholder="Search customer, email, phone, reference, product" style="flex:1;min-width:220px">
      <select class="input" data-st style="width:auto"><option value="">All designs</option><option value="review" selected>Submitted for review</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}<option value="approved">Approved only (not submitted)</option></select>
      <select class="input" data-range style="width:auto">${RANGES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
      <span data-custom style="display:none;gap:6px;align-items:center"><input class="input" type="date" data-from style="width:auto"> – <input class="input" type="date" data-to style="width:auto"></span>
    </div><p class="hint" data-count style="margin:10px 0"></p><div data-list></div></div>`;
  const $ = s => c.querySelector(s);
  const draw = () => {
    const q = $('[data-q]').value.trim().toLowerCase(), st = $('[data-st]').value, rg = $('[data-range]').value;
    $('[data-custom]').style.display = rg === 'custom' ? 'inline-flex' : 'none';
    const [f, t] = rangeDates(rg, $('[data-from]').value, $('[data-to]').value);
    const rows = all.filter(d => {
      const when = day(d.submittedAt || d.approvedAt || d.updatedAt);
      if (f && when < f) return false; if (t && when > t) return false;
      if (st === 'review' && !d.review) return false;
      if (st === 'approved' && d.review) return false;
      if (STATUS[st] && (d.review?.status || '') !== st) return false;
      if (q && ![d.ref, d.product, d.vehicle, d.customer?.name, d.customer?.email, d.customer?.phone, d.id].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    $('[data-count]').textContent = `${rows.length} of ${all.length} designs`;
    $('[data-list]').innerHTML = rows.length ? `<table class="table"><thead><tr><th style="width:140px">Mockup</th><th>Design</th><th>Customer</th><th>Date</th><th>Status</th><th>Files</th></tr></thead><tbody>${rows.map(d => `<tr>
      <td>${d.mockup ? `<a href="${fileURL(d.id, d.mockup, true)}" target="_blank" rel="noopener"><img src="${fileURL(d.id, d.mockup, true)}" alt="" loading="lazy" style="width:130px;height:86px;object-fit:contain;background:#f3f4f6;border-radius:8px;display:block"></a>` : '—'}</td>
      <td><b>${esc(d.ref || d.id.slice(0, 8))}</b><small>${esc(d.product)}${d.vehicle ? ' · ' + esc(d.vehicle) : ''}${d.glass ? ' · design on windows' : ''}</small></td>
      <td>${d.customer ? `<b>${esc(d.customer.name || '—')}</b><small>${esc([d.customer.email, d.customer.phone].filter(Boolean).join(' · '))}</small>` : '<small>Not signed in</small>'}</td>
      <td>${esc(A().fmtDate(d.submittedAt || d.approvedAt || d.updatedAt))}</td>
      <td>${d.review ? `<select class="input" data-status="${esc(d.id)}" style="width:auto">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${d.review.status === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : '<span class="pill">Approved</span>'}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:4px;max-width:360px">${d.files.map(x => `<a class="btn ghost sm" href="${fileURL(d.id, x.id, x.role === 'mockup' || x.role === 'preview')}" ${x.role === 'mockup' || x.role === 'preview' ? 'target="_blank" rel="noopener"' : ''} title="${esc(x.name)}">${esc(x.label)}</a>`).join('')}</div></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">${all.length ? 'No designs match these filters.' : 'No customer has approved or submitted a design yet.'}</div>`;
    c.querySelectorAll('[data-status]').forEach(s => s.onchange = async () => {
      try { await A().api('/shop/designs/status', { id: s.dataset.status, status: s.value }); const d = all.find(x => x.id === s.dataset.status); if (d?.review) d.review.status = s.value; A().toast('Status saved'); } catch (e) { A().toast(e.message); }
    });
  };
  c.querySelectorAll('[data-q],[data-st],[data-range],[data-from],[data-to]').forEach(el => { el.oninput = draw; el.onchange = draw; });
  draw();
}
/* ---------- Website members: everyone who created an account on the website ---------- */
const METHOD = { email: 'Email', password: 'Email', google: 'Google', facebook: 'Facebook' };
const addrText = a => a ? [a.street1, a.street2, [a.city, a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
const pills = l => (l || []).map(m => `<span class="pill ${m === 'google' ? 'confirmed' : m === 'facebook' ? 'contacted' : ''}">${METHOD[m] || esc(m)}</span>`).join(' ') || '—';
async function members(params) {
  const c = A().shell('Website members', 'Business', '<div class="card empty">Loading…</div>', '/web-members');
  let acc, des = { designs: [] }, cus = { customers: [] };
  try {
    [acc, des, cus] = await Promise.all([A().api('/customer-accounts'), A().can('orders.view') ? A().api('/shop/designs').catch(() => ({ designs: [] })) : des, A().api('/customers').catch(() => ({ customers: [] }))]);
  } catch (e) { c.innerHTML = `<div class="card empty">${esc(e.message)}</div>`; return; }
  const all = acc.accounts || [];
  const custBy = {}; (cus.customers || []).forEach(x => { if (x.email) custBy[String(x.email).toLowerCase()] = x; });
  const desBy = {}; (des.designs || []).forEach(d => { const k = d.customer?.id || ''; if (k) (desBy[k] = desBy[k] || []).push(d); });
  all.forEach(a => { a.designs = desBy[a.id] || []; a.cust = custBy[String(a.email).toLowerCase()] || null; });
  c.innerHTML = `<div class="card"><div class="toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
      <input class="input" data-q placeholder="Search name, email, phone, company, address" value="${esc(params?.get('q') || '')}" style="flex:1;min-width:220px">
      <select class="input" data-by style="width:auto"><option value="createdAt">Joined</option><option value="lastLogin">Last sign-in</option></select>
      <select class="input" data-range style="width:auto">${RANGES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>
      <span data-custom style="display:none;gap:6px;align-items:center"><input class="input" type="date" data-from style="width:auto"> – <input class="input" type="date" data-to style="width:auto"></span>
      <select class="input" data-m style="width:auto"><option value="">Any sign-in</option><option value="email">Email</option><option value="google">Google</option><option value="facebook">Facebook</option></select>
      <select class="input" data-f style="width:auto"><option value="">All members</option><option value="designs">With designs</option><option value="orders">With orders</option><option value="unverified">Email not confirmed</option><option value="nocust">Not in Customers</option><option value="disabled">Disabled</option></select>
    </div><p class="hint" data-count style="margin:10px 0"></p><div data-list></div></div>`;
  const $ = s => c.querySelector(s);
  let rows = all;
  const draw = () => {
    const q = $('[data-q]').value.trim().toLowerCase(), by = $('[data-by]').value, rg = $('[data-range]').value, m = $('[data-m]').value, fl = $('[data-f]').value;
    $('[data-custom]').style.display = rg === 'custom' ? 'inline-flex' : 'none';
    const [f, t] = rangeDates(rg, $('[data-from]').value, $('[data-to]').value);
    rows = all.filter(a => {
      const when = day(a[by]);
      if ((f || t) && !when) return false; if (f && when < f) return false; if (t && when > t) return false;
      if (m && !(a.methods || []).includes(m)) return false;
      if (fl === 'designs' && !a.designs.length) return false; if (fl === 'orders' && !a.orders) return false;
      if (fl === 'unverified' && a.verified) return false; if (fl === 'nocust' && a.cust) return false; if (fl === 'disabled' && a.status === 'active') return false;
      if (q && ![a.name, a.email, a.phone, a.company, addrText(a.address)].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    $('[data-count]').textContent = `${rows.length} of ${all.length} members`;
    $('[data-list]').innerHTML = rows.length ? `<table class="table"><thead><tr><th>Member</th><th>Sign-in</th><th>Email</th><th class="num">Orders</th><th class="num">Designs</th><th>Joined</th><th>Last sign-in</th><th></th></tr></thead><tbody>${rows.slice(0, 500).map(a => `<tr data-open="${esc(a.id)}" style="cursor:pointer">
      <td><b>${esc(a.name || '—')}</b>${a.cust ? ' <span class="pill confirmed" title="Also in Customers">Customer</span>' : ''}<small>${esc([a.email, a.phone, a.company].filter(Boolean).join(' · '))}</small></td><td>${pills(a.methods)}</td>
      <td>${a.verified ? '<span class="pill confirmed">Confirmed</span>' : '<span class="pill">Not confirmed</span>'}${a.status !== 'active' ? ' <span class="pill cancelled">Disabled</span>' : ''}</td>
      <td class="num">${a.orders || 0}</td><td class="num">${a.designs.length ? `<b>${a.designs.length}</b>` : '0'}</td>
      <td>${esc(A().fmtDate(a.createdAt))}</td><td>${a.lastLogin ? esc(A().fmtDate(a.lastLogin)) : '—'}</td><td style="text-align:right"><button class="btn ghost sm" data-open="${esc(a.id)}">View</button></td></tr>`).join('')}</tbody></table>${rows.length > 500 ? '<p class="hint">Showing the first 500 — search or filter to narrow the list. Export includes every match.</p>' : ''}`
      : `<div class="empty">${all.length ? 'No members match these filters.' : 'No one has created a website account yet.'}</div>`;
    c.querySelectorAll('tr[data-open]').forEach(tr => tr.onclick = () => detail(all.find(a => a.id === tr.dataset.open), () => members(params)));
  };
  const ac = c.closest('main')?.querySelector('[data-actions]') || document.querySelector('[data-actions]');
  if (ac) { ac.innerHTML = '<button class="btn ghost sm" data-exp>⬇ Export CSV</button>'; ac.querySelector('[data-exp]').onclick = () => A().downloadCSV('website-members.csv', [['Name', 'Email', 'Phone', 'Company', 'Address', 'Sign-in', 'Email confirmed', 'Status', 'Orders', 'Designs', 'Joined', 'Last sign-in'], ...rows.map(a => [a.name, a.email, a.phone, a.company, addrText(a.address), (a.methods || []).join(' / '), a.verified ? 'yes' : 'no', a.status, a.orders || 0, a.designs.length, day(a.createdAt), day(a.lastLogin)])]); }
  c.querySelectorAll('[data-q],[data-by],[data-range],[data-from],[data-to],[data-m],[data-f]').forEach(el => { el.oninput = draw; el.onchange = draw; });
  draw();
}
function detail(a, reload) {
  if (!a) return;
  const ds = a.designs || [];
  const row = (k, v) => v ? `<tr><th style="width:130px;text-align:left;color:var(--mut);font-weight:500">${k}</th><td>${v}</td></tr>` : '';
  const o = A().modal(`<header><h2>${esc(a.name || a.email)}</h2><button class="x" data-close>×</button></header>
    <table class="table" style="margin-bottom:12px"><tbody>
      ${row('Email', `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a> ${a.verified ? '<span class="pill confirmed">Confirmed</span>' : '<span class="pill">Not confirmed</span>'}`)}
      ${row('Phone', a.phone ? `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>` : '')}${row('Company', esc(a.company))}${row('Address', esc(addrText(a.address)))}
      ${row('Sign-in', pills(a.methods))}${row('Joined', esc(A().fmtDate(a.createdAt)))}${row('Last sign-in', a.lastLogin ? esc(A().fmtDate(a.lastLogin)) + (a.lastMethod ? ' · ' + esc(METHOD[a.lastMethod] || a.lastMethod) : '') : '—')}
      ${row('Status', a.status === 'active' ? 'Active' : '<span class="pill cancelled">Disabled</span>')}
      ${row('Orders', a.orders ? `<a href="#/orders?q=${encodeURIComponent(a.email)}">${a.orders} order${a.orders > 1 ? 's' : ''} →</a>` : '0')}
      ${row('Customers', a.cust ? `In Customers · ${a.cust.invoices} invoice${a.cust.invoices === 1 ? '' : 's'} <a href="#/customers?q=${encodeURIComponent(a.email)}">Open →</a>` : 'Not in Customers yet')}
    </tbody></table>
    <h3 style="margin:6px 0">Designs <small class="hint">${ds.length}</small></h3>
    ${ds.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px">${ds.map(d => `<div style="border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px">
      ${d.mockup ? `<a href="${fileURL(d.id, d.mockup, true)}" target="_blank" rel="noopener"><img src="${fileURL(d.id, d.mockup, true)}" alt="" loading="lazy" style="width:100%;height:110px;object-fit:contain;background:#f3f4f6;border-radius:8px;display:block"></a>` : ''}
      <b style="display:block;margin-top:6px">${esc(d.product)}</b><small>${esc([d.vehicle, d.ref, A().fmtDate(d.submittedAt || d.approvedAt || d.updatedAt)].filter(Boolean).join(' · '))}</small>
      <div style="margin-top:4px">${d.review ? `<span class="pill ${PILL[d.review.status] || ''}">${esc(STATUS[d.review.status] || d.review.status)}</span>` : '<span class="pill">Approved</span>'}</div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${d.files.filter(x => x.role !== 'mockup').map(x => `<a class="btn ghost sm" href="${fileURL(d.id, x.id, false)}" title="${esc(x.name)}">${esc(x.label)}</a>`).join('')}</div></div>`).join('')}</div>
      <p><a class="btn ghost sm" href="#/designs" data-close>Open Studio designs →</a></p>` : `<p class="hint">${A().can('orders.view') ? 'This member has not approved or submitted a Design Studio design yet.' : 'You need Online orders access to see designs.'}</p>`}
    <div class="confirm-acts" style="margin-top:14px">
      ${!a.cust && A().can('invoices.edit') ? '<button class="btn" data-addc>Add to Customers</button>' : ''}
      ${A().can('members.manage') ? `<button class="btn ghost" data-st>${a.status === 'active' ? 'Disable account' : 'Enable account'}</button>` : ''}
      <button class="btn ghost" data-close>Close</button></div>`);
  const ad = o.querySelector('[data-addc]');
  if (ad) ad.onclick = async () => { ad.disabled = true;
    try { await A().api('/customers/save', { name: a.name || a.email, company: a.company || '', email: a.email, phone: a.phone || '', address: addrText(a.address) }); A().toast('Added to Customers'); o.remove(); reload(); } catch (e) { A().toast(e.message); ad.disabled = false; } };
  const sb = o.querySelector('[data-st]');
  if (sb) sb.onclick = () => { o.remove(); A().confirmBox(a.status === 'active' ? 'Disable this account?' : 'Enable this account?', a.status === 'active' ? 'The customer is signed out and cannot sign in until you enable the account again. Orders and designs are kept.' : 'The customer can sign in again.', async () => {
    try { await A().api('/customer-accounts/status', { id: a.id, status: a.status === 'active' ? 'disabled' : 'active' }); reload(); } catch (e) { A().toast(e.message); } }); };
}
window.SatinDesigns = { route: (path, params) => path === '/web-members' ? members(params) : route(), members };
})();
