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
const ORDER_ST = { new: 'New', artwork_check: 'Artwork check', in_production: 'In production', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
const PAY_ST = { paid: 'Paid', awaiting_payment: 'Awaiting payment', refunded: 'Refunded', cancelled: 'Cancelled' };
const cap = t => String(t || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
async function detail(a, reload) {
  if (!a) return;
  const o = A().modal(`<header><h2>${esc(a.name || a.email)}</h2><button class="x" data-close>×</button></header><div class="empty">Loading the full history…</div>`);
  const m = o.querySelector('.modal'); m.style.width = 'min(1080px, 100%)'; m.style.maxHeight = '92vh';
  let d;
  try { d = await A().api('/customer-accounts/detail?id=' + encodeURIComponent(a.id)); } catch (e) { m.innerHTML = `<header><h2>${esc(a.name || a.email)}</h2><button class="x" data-close>×</button></header><div class="err">${esc(e.message)}</div>`; return; }
  const ac = d.account, M = A().money, F = x => !x ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(x) ? esc(new Date(x + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })) : esc(A().fmtDate(x));
  const orders = d.orders || [], designs = d.designs || [], reqs = d.requests || [], invs = d.invoices || [], quotes = d.quotes || [], chats = d.chats || [], agr = d.agreements || [];
  const spent = orders.filter(x => x.payment === 'paid').reduce((t, x) => t + x.total, 0) + invs.filter(x => x.status !== 'void' && x.status !== 'draft').reduce((t, x) => t + x.paid, 0);
  const owing = invs.filter(x => x.status !== 'void' && x.status !== 'draft').reduce((t, x) => t + Math.max(0, x.total - x.paid), 0);
  const row = (k, v) => v ? `<tr><th style="width:140px;text-align:left;color:var(--mut);font-weight:500;vertical-align:top">${k}</th><td>${v}</td></tr>` : '';
  const card = (n, l, tab) => `<button type="button" class="card" data-go="${tab}" style="text-align:left;padding:12px 14px;cursor:pointer;border:1px solid var(--line,#e5e7eb)"><b style="font-size:20px;display:block">${n}</b><small style="color:var(--mut)">${l}</small></button>`;
  const table = (head, rows, empty) => rows.length ? `<table class="table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : `<p class="hint">${empty}</p>`;
  const noAccess = '<p class="hint">Your role cannot see this section.</p>';
  // timeline: everything this person did, newest first
  const ev = [[ac.createdAt, 'Created a website account', ''], ...(ac.lastLogin ? [[ac.lastLogin, 'Last signed in', METHOD[ac.lastMethod] || '']] : []),
    ...orders.map(x => [x.createdAt, `Placed order <a href="#/orders?id=${esc(x.id)}">#${esc(x.number)}</a>`, `${M(x.total, x.currency)} · ${PAY_ST[x.payment] || cap(x.payment)}`]),
    ...orders.filter(x => x.paidAt).map(x => [x.paidAt, `Paid order #${esc(x.number)}`, M(x.total, x.currency)]),
    ...designs.map(x => [x.review?.submittedAt || x.approvedAt || x.updatedAt, x.review ? `Submitted design ${esc(x.ref)} for review` : x.approvedAt ? 'Approved a design' : 'Saved a design', esc([x.product, x.vehicle].filter(Boolean).join(' · '))]),
    ...reqs.map(x => [x.createdAt, `Sent a ${esc(x.type || 'quote')} request <a href="#/requests?q=${esc(x.ref)}">${esc(x.ref)}</a>`, esc(x.service)]),
    ...invs.map(x => [x.date, `Invoice <a href="#/invoices/edit?id=${esc(x.id)}">${esc(x.number)}</a>`, `${M(x.total, x.currency)} · ${cap(x.status)}`]),
    ...quotes.map(x => [x.date, `Price quote <a href="#/quotes/edit?id=${esc(x.id)}">${esc(x.number)}</a>`, `${M(x.total, x.currency)} · ${cap(x.status)}`]),
    ...chats.map(x => [x.createdAt, `Started a <a href="#/chat?id=${esc(x.id)}">live chat</a>`, esc(x.preview || '')]),
    ...agr.map(x => [x.signedAt || x.sentAt || x.createdAt, x.signedAt ? 'Signed an agreement' : 'Agreement sent', esc(x.title)])].filter(x => x[0]).sort((p, q) => String(q[0]).localeCompare(String(p[0])));
  const TABS = [['overview', 'Overview'], ['orders', `Orders (${orders.length})`], ['designs', `Designs (${designs.length})`], ['requests', `Requests (${reqs.length})`], ['billing', `Invoices & quotes (${invs.length + quotes.length})`], ['chats', `Chats (${chats.length})`], ['agreements', `Agreements (${agr.length})`], ['timeline', 'History']];
  const P = {
    overview: `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:14px">${card(orders.length, 'Online orders', 'orders')}${card(designs.length, 'Designs', 'designs')}${card(reqs.length, 'Quote / booking requests', 'requests')}${card(invs.length + quotes.length, 'Invoices & quotes', 'billing')}${card(M(spent), 'Paid so far', 'billing')}${card(owing ? `<span class="warn-t">${M(owing)}</span>` : '—', 'Balance owing', 'billing')}</div>
      <table class="table"><tbody>
      ${row('Email', `<a href="mailto:${esc(ac.email)}">${esc(ac.email)}</a> ${ac.verified ? '<span class="pill confirmed">Confirmed</span>' : '<span class="pill">Not confirmed</span>'}`)}
      ${row('Phone', ac.phone ? `<a href="tel:${esc(ac.phone)}">${esc(ac.phone)}</a>` : '—')}${row('Company', esc(ac.company) || '—')}${row('Address', esc(addrText(ac.address)) || '—')}
      ${row('Sign-in', pills(ac.methods))}${row('Joined', F(ac.createdAt))}${row('Last sign-in', ac.lastLogin ? F(ac.lastLogin) + (ac.lastMethod ? ' · ' + esc(METHOD[ac.lastMethod] || ac.lastMethod) : '') : '—')}${row('Profile updated', F(ac.updatedAt))}
      ${row('Status', ac.status === 'active' ? '<span class="pill confirmed">Active</span>' : '<span class="pill cancelled">Disabled</span>')}
      ${row('Customers', d.customers.length ? d.customers.map(c => `<div><b>${esc(c.name)}</b>${c.company ? ' · ' + esc(c.company) : ''} <a href="#/customers?q=${encodeURIComponent(ac.email)}">Open in Customers →</a>${c.address ? `<small>${esc(c.address)}</small>` : ''}${c.notes ? `<small>Notes: ${esc(c.notes)}</small>` : ''}</div>`).join('') : 'Not in Customers yet')}
      </tbody></table>`,
    orders: d.orders === null ? noAccess : table(['Order', 'Date', 'Items', 'Total', 'Payment', 'Stage', ''], orders.map(x => `<tr><td><b>#${esc(x.number)}</b>${x.shipping ? `<small>${esc(x.shipping)}</small>` : ''}</td><td>${F(x.createdAt)}</td>
        <td>${x.items.map(i => `<div>${esc(i.name)}${i.qty ? ` × ${esc(i.qty)}` : ''}${i.net != null ? ` · ${M(i.net, x.currency)}` : ''}${i.choices ? `<small>${esc(i.choices)}</small>` : ''}</div>`).join('')}</td>
        <td class="num"><b>${M(x.total, x.currency)}</b>${x.card ? `<small>${esc(x.card)}</small>` : ''}</td><td><span class="pill ${x.payment === 'paid' ? 'confirmed' : x.payment === 'awaiting_payment' ? 'pending' : 'cancelled'}">${esc(PAY_ST[x.payment] || cap(x.payment))}</span>${x.paidAt ? `<small>${F(x.paidAt)}</small>` : ''}</td>
        <td>${esc(ORDER_ST[x.stage] || cap(x.stage))}</td><td><a class="btn ghost sm" href="#/orders?id=${esc(x.id)}">Open</a></td></tr>`), 'No online orders yet.'),
    designs: d.designs === null ? noAccess : designs.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">${designs.map(x => { const img = x.mockup || x.thumb; return `<div style="border:1px solid var(--line,#e5e7eb);border-radius:10px;padding:8px">
        ${img ? `<a href="${fileURL(x.id, img, true)}" target="_blank" rel="noopener"><img src="${fileURL(x.id, img, true)}" alt="" loading="lazy" style="width:100%;height:130px;object-fit:contain;background:#f3f4f6;border-radius:8px;display:block"></a>` : '<div style="height:130px;background:#f3f4f6;border-radius:8px"></div>'}
        <b style="display:block;margin-top:6px">${esc(x.product || 'Design')}</b><small>${esc([x.vehicle, x.glass ? 'on windows too' : '', x.ref].filter(Boolean).join(' · '))}</small><small>${F(x.review?.submittedAt || x.approvedAt || x.updatedAt)}</small>
        <div style="margin-top:4px">${x.review ? `<span class="pill ${PILL[x.review.status] || ''}">${esc(STATUS[x.review.status] || x.review.status)}</span>` : x.approvedAt ? '<span class="pill confirmed">Approved</span>' : '<span class="pill">Draft</span>'}</div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${x.files.filter(f => f.role !== 'mockup').map(f => `<a class="btn ghost sm" href="${fileURL(x.id, f.id, false)}" title="${esc(f.name)}">${esc(f.label)}</a>`).join('')}</div></div>`; }).join('')}</div>` : '<p class="hint">No Design Studio designs saved in this account yet.</p>',
    requests: d.requests === null ? noAccess : table(['Reference', 'Date', 'Type', 'Service', 'Preferred', 'Status'], reqs.map(x => `<tr><td><a href="#/requests?q=${esc(x.ref)}"><b>${esc(x.ref)}</b></a></td><td>${F(x.createdAt)}</td><td>${esc(cap(x.type))}</td><td>${esc(x.service)}</td><td>${esc(x.date || '—')}</td><td><span class="pill ${esc(x.status)}">${esc(cap(x.status))}</span></td></tr>`), 'No quote or booking requests from this email.'),
    billing: `<h3 style="margin:4px 0 8px">Invoices</h3>${table(['Invoice', 'Date', 'Title', 'Total', 'Paid', 'Status'], invs.map(x => `<tr><td><a href="#/invoices/edit?id=${esc(x.id)}"><b>${esc(x.number)}</b></a></td><td>${esc(x.date)}</td><td>${esc(x.title)}</td><td class="num">${M(x.total, x.currency)}</td><td class="num">${M(x.paid, x.currency)}</td><td><span class="pill ${x.status === 'paid' ? 'confirmed' : ''}">${esc(cap(x.status))}</span></td></tr>`), d.customers.length ? 'No invoices yet.' : 'No invoices — this member is not in Customers yet.')}
      <h3 style="margin:16px 0 8px">Price quotes</h3>${table(['Quote', 'Date', 'Title', 'Total', 'Status'], quotes.map(x => `<tr><td><a href="#/quotes/edit?id=${esc(x.id)}"><b>${esc(x.number)}</b></a></td><td>${esc(x.date)}</td><td>${esc(x.title)}</td><td class="num">${M(x.total, x.currency)}</td><td><span class="pill ${x.status === 'accepted' ? 'confirmed' : ''}">${esc(cap(x.status))}</span></td></tr>`), 'No price quotes yet.')}`,
    chats: d.chats === null ? noAccess : table(['Started', 'Last message', 'Preview', 'Status', ''], chats.map(x => `<tr><td>${F(x.createdAt)}</td><td>${F(x.lastAt)}</td><td>${esc(x.preview || '')}</td><td>${esc(cap(x.status))}</td><td><a class="btn ghost sm" href="#/chat?id=${esc(x.id)}">Open</a></td></tr>`), 'No live chats from this email.'),
    agreements: d.agreements === null ? noAccess : table(['#', 'Title', 'Sent', 'Signed', 'Status'], agr.map(x => `<tr><td>${x.number || ''}</td><td><a href="#/agreements">${esc(x.title)}</a></td><td>${F(x.sentAt)}</td><td>${F(x.signedAt)}</td><td><span class="pill ${x.status === 'signed' ? 'confirmed' : ''}">${esc(cap(x.status))}</span></td></tr>`), 'No agreements sent to this email.'),
    timeline: ev.length ? `<ul style="list-style:none;padding:0;margin:0">${ev.map(e => `<li style="display:flex;gap:14px;padding:9px 0;border-bottom:1px solid var(--line,#eee)"><span style="min-width:170px;color:var(--mut);font-size:13px">${F(e[0])}</span><span>${e[1]}${e[2] ? `<small style="display:block;color:var(--mut)">${e[2]}</small>` : ''}</span></li>`).join('')}</ul>` : '<p class="hint">Nothing yet.</p>',
  };
  m.innerHTML = `<header><h2>${esc(ac.name || ac.email)} <small class="hint">${esc(ac.email)}</small></h2><button class="x" data-close>×</button></header>
    <div data-tabs style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 14px">${TABS.map(([k, l]) => `<button type="button" class="btn ghost sm" data-tab="${k}">${esc(l)}</button>`).join('')}</div>
    <div data-pane></div>
    <div class="confirm-acts" style="margin-top:16px">
      ${!d.customers.length && A().can('invoices.edit') ? '<button class="btn" data-addc>Add to Customers</button>' : ''}
      ${A().can('members.manage') ? `<button class="btn ghost" data-st>${ac.status === 'active' ? 'Disable account' : 'Enable account'}</button>` : ''}
      <button class="btn ghost" data-close>Close</button></div>`;
  const show = k => { m.querySelector('[data-pane]').innerHTML = P[k]; m.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === k; b.classList.toggle('ghost', !on); }); m.querySelectorAll('[data-pane] [data-go]').forEach(b => b.onclick = () => show(b.dataset.go)); };
  m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));
  show('overview');
  const ad = m.querySelector('[data-addc]');
  if (ad) ad.onclick = async () => { ad.disabled = true;
    try { await A().api('/customers/save', { name: ac.name || ac.email, company: ac.company || '', email: ac.email, phone: ac.phone || '', address: addrText(ac.address) }); A().toast('Added to Customers'); o.remove(); reload(); } catch (e) { A().toast(e.message); ad.disabled = false; } };
  const sb = m.querySelector('[data-st]');
  if (sb) sb.onclick = () => { o.remove(); A().confirmBox(ac.status === 'active' ? 'Disable this account?' : 'Enable this account?', ac.status === 'active' ? 'The customer is signed out and cannot sign in until you enable the account again. Orders and designs are kept.' : 'The customer can sign in again.', async () => {
    try { await A().api('/customer-accounts/status', { id: ac.id, status: ac.status === 'active' ? 'disabled' : 'active' }); reload(); } catch (e) { A().toast(e.message); } }); };
}
window.SatinDesigns = { route: (path, params) => path === '/web-members' ? members(params) : route(), members };
})();
