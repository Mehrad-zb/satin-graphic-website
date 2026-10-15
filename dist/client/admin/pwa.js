/* Satin Admin — the phone app layer. The admin itself IS the app (one code base): every admin page and every future
   admin/editor update shows up here automatically. This file adds, on top of app.js (window.SatinAdmin):
   - bottom tab bar (Home · Chat · Sales · Website · More) with "new" badges, hub pages #/sales #/website #/more built from
     the admin menu (NAV) so a section added to the admin later appears in "More" without touching this file;
   - top bar back button, chat as a full-screen messenger, sheets for modals and menus (CSS in mobile.css);
   - Home quick actions + key numbers (existing APIs only);
   - "Install app" help banner and an "Update available" bar when a new version is deployed;
   - badges (per staff member, cleared when the section is opened) with the app icon badge, and the Notifications page.
   Needs app.js and push-client.js. */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const P = () => window.SatinPush;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const narrow = () => matchMedia('(max-width: 820px)').matches;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pathNow = () => (location.hash.slice(1) || '/').split('?')[0];
const qsNow = () => new URLSearchParams((location.hash.split('?')[1]) || '');

const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12z"/>',
  sales: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9.5 8h5M9.5 12h5M9.5 16h2.5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z"/>',
  more: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  dots: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
  pages: '<path d="M7 3h8l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  theme: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/>',
  seo: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k] || k}</svg>`;

/* ---------- where each page lives in the app ---------- */
const SALES = ['/invoices', '/orders', '/requests', '/customers', '/coupons'];
const WEBSITE = ['/editor', '/portfolio', '/banner', '/business'];
const ROOTS = ['/', '/chat', '/sales', '/website', '/more'];
const hubOf = path => {
  if (path === '/') return '/';
  if (path === '/chat' || path.startsWith('/chat/')) return '/chat';
  if (ROOTS.includes(path)) return path;
  const base = '/' + path.split('/')[1];
  return SALES.includes(base) ? '/sales' : WEBSITE.includes(base) ? '/website' : '/more';
};
const parentOf = path => {
  if (ROOTS.includes(path)) return null;
  const segs = path.split('/').filter(Boolean);
  return segs.length > 1 ? '/' + segs[0] : hubOf(path);
};
const SUB = {
  '/requests': 'Quote requests and bookings from the website', '/orders': 'Online shop orders, artwork and payment links',
  '/invoices': 'Create, send and track invoices', '/customers': 'Contacts, balances, import & export', '/coupons': 'Discount codes for the shop',
  '/payments': 'Square & PayPal connection', '/editor': 'Change text, photos, sections and pages', '/catalog': 'Products, prices, options and reviews',
  '/templates': 'Vehicle templates for wrap pricing', '/banner': 'Slides at the top of the home page', '/portfolio': 'Projects shown on “Our Work”',
  '/business': 'Name, address, hours, Google & SEO', '/customer-login': 'Customer accounts, Google / Facebook sign-in',
  '/members': 'Staff, invitations, roles and permissions', '/activity': 'Who changed what, and when', '/notifications': 'Push notifications on this phone, install the app',
  '/account': 'Your profile and password'
};

/* ---------- badges ---------- */
const SECTIONS = { orders: '/orders', requests: '/requests', chat: '/chat', invoices: '/invoices', customers: '/customers', catalog: '/catalog' };
const LABELS = { orders: 'new online orders / payments', requests: 'new quote & booking requests', chat: 'unread chats', invoices: 'new invoice payments', customers: 'new customer accounts', catalog: 'new product reviews' };
let badges = {}, total = 0, baseTitle = 'Satin Admin', timer = 0;
const secOfPath = p => Object.keys(SECTIONS).find(k => SECTIONS[k] === p);
const setBadge = (el, n, title, pulse) => {
  let b = el.querySelector(':scope > .navb');
  if (!n) { b?.remove(); return; }
  if (!b) { b = document.createElement('span'); b.className = 'navb'; el.append(b); }
  const t = n > 99 ? '99+' : String(n);
  if (b.textContent !== t) b.textContent = t;
  if (title && b.title !== title) b.title = title;
  if (b.classList.contains('chat') !== !!pulse) b.classList.toggle('chat', !!pulse);
};
function paint() {
  for (const [sec, path] of Object.entries(SECTIONS)) {
    const n = badges[sec] || 0;
    $$(`.nav a[href="#${path}"], [data-badge="${sec}"]`).forEach(a => setBadge(a, n, `${n} ${LABELS[sec]}`, sec === 'chat'));
  }
  // tab badges: sum of the sections that live under each tab
  $$('.bnav a[data-tab]').forEach(a => {
    const tab = a.dataset.tab;
    const n = Object.entries(SECTIONS).reduce((s, [sec, p]) => s + (hubOf(p) === tab ? (badges[sec] || 0) : 0), 0);
    setBadge(a, n, '', tab === '/chat');
  });
  const t = (total ? `(${total}) ` : '') + baseTitle; if (document.title !== t) document.title = t;
  P()?.appBadge(total);
}
async function poll() {
  clearTimeout(timer);
  try { if (A()?.me) { const d = await A().api('/badges'); badges = d.badges || {}; total = d.total || 0; paint(); } } catch {}
  timer = setTimeout(poll, document.hidden ? 120000 : 25000);
}
async function markSeen() {
  const sec = secOfPath(pathNow());
  if (!sec || sec === 'chat' || !A()?.me || !badges[sec]) return;
  try { const d = await A().api('/badges/seen', { section: sec }); badges = d.badges || badges; total = d.total ?? total; paint(); } catch {}
}
let cameFrom = '';
addEventListener('hashchange', e => {
  cameFrom = (new URL(e.oldURL).hash.slice(1) || '/').split('?')[0];
  setTimeout(markSeen, 600); closeDrawer(); window.scrollTo(0, 0);
});
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type === 'push') poll();
  if (e.data?.type === 'resubscribe' && A()?.me) P()?.resync(A().api);
  if (e.data?.type === 'open' && e.data.url) location.href = e.data.url;
});

/* ---------- bottom tab bar ---------- */
function tabs() {
  const a = A(); const any = (...p) => p.some(x => a.can(x));
  return [['/', 'Home', 'home', true], ['/chat', 'Chat', 'chat', a.can('chat.view')], ['/sales', 'Sales', 'sales', any('invoices.view', 'orders.view', 'requests.view')],
    ['/website', 'Website', 'web', any('site.edit', 'settings.edit')], ['/more', 'More', 'more', true]].filter(t => t[3]);
}
function bottomNav() {
  const a = A(); if (!a?.me) { $('.bnav')?.remove(); return; }
  const cur = hubOf(pathNow());
  let nav = $('.bnav');
  const html = tabs().map(([p, l, i]) => `<a href="#${p}" data-tab="${p}" class="${cur === p ? 'on' : ''}" ${cur === p ? 'aria-current="page"' : ''}>${svg(i)}<span>${l}</span></a>`).join('');
  if (!nav) { nav = document.createElement('nav'); nav.className = 'bnav'; nav.setAttribute('aria-label', 'Main'); document.body.append(nav); }
  if (nav.dataset.html !== html) { nav.innerHTML = html; nav.dataset.html = html; paint(); }
  if (!document.body.classList.contains('has-bnav')) document.body.classList.add('has-bnav');
}
function closeDrawer() { $('[data-side]')?.classList.remove('open'); }
document.addEventListener('click', e => { const s = $('[data-side].open'); if (s && !s.contains(e.target) && !e.target.closest('[data-menu],[data-bmenu]')) closeDrawer(); });
// tapping the tab you are on goes back to its first page (like native apps)
document.addEventListener('click', e => { const t = e.target.closest('.bnav a[data-tab]'); if (t && pathNow() !== t.dataset.tab && hubOf(pathNow()) === t.dataset.tab) { e.preventDefault(); A().go(t.dataset.tab); } });

/* ---------- hub pages: #/sales, #/website, #/more ---------- */
function navItems() { const a = A(); return (a.nav || []).filter(n => n.group || !n.perm || a.can(n.perm)); }
function row(it) {
  return `<a class="hub-row${it.primary ? ' primary' : ''}" href="${esc(it.href)}"${it.ext ? ' target="_blank" rel="noopener"' : ''}${it.data ? ' ' + it.data : ''}><span class="hub-ic">${it.icon}</span><span class="hub-t"><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span>${it.sec ? `<span class="hub-b" data-badge="${it.sec}"></span>` : ''}<span class="hub-chev">${svg('chev')}</span></a>`;
}
const fromNav = n => ({ href: n.href || '#' + n.path, label: n.label, sub: SUB[n.path] || '', icon: A().icon(n.icon), sec: secOfPath(n.path) });
const section = (title, items) => items.length ? `<section class="hub-sec">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="hub-list">${items.map(row).join('')}</div></section>` : '';
function hub(path) {
  const a = A(), can = a.can, items = navItems();
  const T = { '/sales': 'Sales', '/website': 'Website', '/more': 'More' }[path];
  const c = a.shell(T, 'Satin Admin', '', path);
  let html = '';
  if (path === '/sales') {
    html += section('', [
      can('invoices.edit') && { href: '#/invoices/edit', label: 'New invoice', sub: 'Line items, taxes, deposit, send by email or link', icon: svg('plus'), primary: true },
      can('invoices.edit') && { href: '#/invoices?status=open', label: 'Record a payment', sub: 'Pick an unpaid invoice, then “Record payment”', icon: svg('cash') }
    ].filter(Boolean));
    html += section('Sales', SALES.map(p => items.find(n => n.path === p)).filter(Boolean).map(fromNav));
    if (can('invoices.edit') && can('settings.edit')) html += section('Settings', [{ href: '#/invoices/settings', label: 'Invoice settings', sub: 'Business info on invoices, taxes, numbering, email text', icon: svg('cog') }]);
  } else if (path === '/website') {
    html += `<div class="hub-hero">${can('site.edit') ? `<a class="btn" href="/admin/editor/">${svg('edit')} Edit website</a>` : ''}<a class="btn ghost" href="/satin/" target="_blank" rel="noopener">${svg('eye')} View site</a></div>`;
    if (can('site.edit')) html += section('Website editor', [
      { href: '/admin/editor/?panel=pages', label: 'Pages', sub: 'Open, add and arrange pages', icon: svg('pages') },
      { href: '/admin/editor/?panel=menus', label: 'Site menu', sub: 'Links in the header menu', icon: svg('menu') },
      { href: '/admin/editor/?panel=theme', label: 'Theme, colours & fonts', sub: 'Whole-site look', icon: svg('theme') },
      { href: '/admin/editor/?panel=seo', label: 'Page SEO', sub: 'Title and description Google shows for each page', icon: svg('seo') }
    ]);
    const content = WEBSITE.filter(p => p !== '/editor').map(p => items.find(n => n.path === p)).filter(Boolean).map(fromNav);
    if (can('site.edit')) content.splice(1, 0, { href: '#/portfolio/edit', label: 'Add Our Work project', sub: 'Photos, vehicle, service', icon: svg('plus') });
    html += section('Content & SEO', content);
  } else {
    // everything that is not on another tab, grouped like the admin menu; new admin sections appear here automatically
    let group = '', groups = [];
    for (const n of items) {
      if (n.group) { group = n.group; continue; }
      if (n.path === '/' || n.path === '/chat' || SALES.includes(n.path) || WEBSITE.includes(n.path)) continue;
      let g = groups.find(x => x.t === group); if (!g) groups.push(g = { t: group, items: [] });
      g.items.push(fromNav(n));
      if (n.path === '/catalog') g.items.push({ href: '#/catalog/supplier', label: 'Supplier prices', sub: 'Apparel & stickers: supplier cost × markup', icon: svg('truck') }, { href: '#/catalog/categories', label: 'Product categories', sub: 'Order and names of the shop categories', icon: svg('tag') });
    }
    if (can('chat.manage')) groups.splice(Math.min(1, groups.length), 0, { t: 'Live chat', items: [
      { href: '#/chat/kb', label: 'Chat assistant Q&A', sub: 'Answers the website assistant gives', icon: svg('book') },
      { href: '#/chat/import', label: 'Import chat history', sub: 'Learn answers from past WhatsApp chats', icon: svg('chat') },
      { href: '#/chat/settings', label: 'Chat settings', sub: 'Office hours, greeting, quick replies', icon: svg('cog') }] });
    html += groups.map(g => section(g.t, g.items)).join('');
    html += section('App', [
      !standalone() && { href: '#/notifications', label: 'Install this app on your phone', sub: P()?.ios ? 'Safari: Share → Add to Home Screen' : 'Opens full screen, with notifications', icon: svg('phone') },
      { href: '/admin/chat-app/', label: 'Satin Chat (staff chat app)', sub: 'Separate chat-only app for staff', icon: svg('chat') },
      { href: '#/more', label: 'Sign out', sub: `${a.me.name} · ${a.me.email || ''}`, icon: svg('out'), data: 'data-signout' }
    ].filter(Boolean));
  }
  c.innerHTML = `<div class="hub">${html}</div>`;
  const so = $('[data-signout]', c); if (so) so.onclick = async e => { e.preventDefault(); await a.api('/logout', {}).catch(() => {}); location.hash = '#/login'; location.reload(); };
  paint();
}

/* ---------- Home: quick actions + key numbers ---------- */
async function home(el, { overview, analytics } = {}) {
  const a = A(); if (!el || !a) return;
  const can = a.can;
  const qa = [
    can('invoices.edit') && ['#/invoices/edit', 'New invoice', 'plus', 'primary'],
    can('chat.view') && ['#/chat', 'Open chat', 'chat', '', 'chat'],
    can('invoices.edit') && ['#/invoices?status=open', 'Record payment', 'cash'],
    can('pricing.edit') && ['#/catalog', 'Change prices', 'tag'],
    can('site.edit') && ['#/portfolio/edit', 'Add Our Work project', 'image'],
    can('site.edit') && ['/admin/editor/', 'Edit website', 'edit'],
    ['/satin/', 'View site', 'eye', 'ext']
  ].filter(Boolean);
  const inv = analytics && analytics.invoices, sess = analytics?.metrics?.sessions;
  el.innerHTML = `<div class="qa" role="list">${qa.map(([h, l, i, k, sec]) => `<a role="listitem" class="qa-b${k === 'primary' ? ' primary' : ''}" href="${h}"${k === 'ext' ? ' target="_blank" rel="noopener"' : ''}${sec ? ` data-badge="${sec}"` : ''}><span class="qa-i">${svg(i)}</span><span>${l}</span></a>`).join('')}</div>
    <div class="kn" data-kn>
      ${inv ? `<a class="kn-c" href="#/invoices?status=open"><small>Unpaid invoices</small><b>${a.money(inv.outstanding)}</b><span>${inv.open} open${inv.overdue ? ` · <em>${a.money(inv.overdue)} overdue</em>` : ''}</span></a>` : ''}
      ${can('chat.view') ? `<a class="kn-c" href="#/chat"><small>Unread chats</small><b data-kn-chat>…</b><span>Website live chat</span></a>` : ''}
      ${can('orders.view') ? `<a class="kn-c" href="#/orders"><small>New orders</small><b data-kn-orders>…</b><span>Online shop</span></a>` : ''}
      ${overview && overview.requests ? `<a class="kn-c" href="#/requests"><small>New requests</small><b>${overview.requests.new}</b><span>${overview.requests.bookings} upcoming booking${overview.requests.bookings === 1 ? '' : 's'}</span></a>` : ''}
      ${sess && sess.series && sess.series.length ? `<div class="kn-c"><small>Visits today</small><b>${sess.series[sess.series.length - 1]}</b><span>${analytics.activeNow ? `${analytics.activeNow} on the site now` : 'Website sessions'}</span></div>` : ''}
    </div>
    ${can('orders.view') ? '<div class="card kn-orders" data-recent hidden><h2>Recent orders <a class="sub" href="#/orders">View all</a></h2><div data-recent-list></div></div>' : ''}`;
  paint();
  try {
    const d = await a.api('/badges'); badges = d.badges || badges; total = d.total ?? total; paint();
    const kc = $('[data-kn-chat]', el); if (kc) kc.textContent = String(badges.chat || 0);
    const ko = $('[data-kn-orders]', el); if (ko) ko.textContent = String(badges.orders || 0);
  } catch {}
  if (can('orders.view')) try {
    const d = await a.api('/shop/orders'); const rows = (d.orders || []).slice(0, 3); const box = $('[data-recent]', el);
    if (box && rows.length) {
      box.hidden = false;
      $('[data-recent-list]', box).innerHTML = rows.map(o => `<a class="ro" href="#/orders?id=${encodeURIComponent(o.id)}"><span><b>${esc(o.reference)}</b><small>${esc(o.name)} · ${esc(o.summary || '')}</small></span><span class="ro-r"><b>${a.money(o.total)}</b><small>${esc((d.statuses || {})[o.status] || o.status)}</small></span></a>`).join('');
    }
  } catch {}
}

/* ---------- tables become labelled cards on small screens ---------- */
function labelTables(root) {
  $$('table.table', root).forEach(t => {
    const heads = $$('thead th', t).map(th => th.textContent.trim());
    if (!heads.length) return;
    $$('tbody tr', t).forEach(tr => { if (tr.dataset.lab) return; tr.dataset.lab = '1'; [...tr.children].forEach((td, i) => { if (td.tagName === 'TD' && !td.hasAttribute('data-label') && heads[i] && !td.hasAttribute('colspan')) td.setAttribute('data-label', heads[i]); }); });
  });
}

/* ---------- page chrome: back button, chat messenger, sheets, keyboards ---------- */
function goBack() {
  const path = pathNow();
  if (path === '/chat' && qsNow().has('id')) { if (history.state && history.state.chatThread) history.back(); else A().go('/chat'); return; }
  const parent = parentOf(path); if (!parent) return;
  if (cameFrom === parent) history.back(); else A().go(parent);
}
function decorate() {
  const path = pathNow();
  // back button in the top bar (shown on phones by CSS)
  const top = $('.top > div:first-child');
  const parent = parentOf(path);
  if (top) {
    let bb = $('.app-back', top);
    if (parent && !bb) { bb = document.createElement('button'); bb.type = 'button'; bb.className = 'app-back'; bb.setAttribute('aria-label', 'Back'); bb.innerHTML = svg('back'); bb.onclick = goBack; top.prepend(bb); }
    if (!parent && bb) bb.remove();
  }
  const cls = document.body.classList;
  const tab = 'tab-' + (hubOf(path).slice(1) || 'home');
  [...cls].filter(k => k.startsWith('tab-') && k !== tab).forEach(k => cls.remove(k)); if (!cls.contains(tab)) cls.add(tab);
  // chat: conversation list → full-screen thread
  const head = $('.chat-view .chat-head');
  const thread = path === '/chat' && !!head;
  if (cls.contains('chat-thread') !== thread) cls.toggle('chat-thread', thread);
  if (head && !$('.chat-back', head)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chat-back'; b.setAttribute('aria-label', 'Back to chats'); b.innerHTML = svg('back'); b.onclick = goBack; head.prepend(b);
    const acts = $('.chat-acts', head);
    if (acts) { const m = document.createElement('button'); m.type = 'button'; m.className = 'chat-more'; m.setAttribute('aria-label', 'Chat actions'); m.innerHTML = svg('dots'); m.onclick = e => { e.stopPropagation(); acts.classList.toggle('open'); }; acts.before(m); }
  }
  const rta = $('.chat-reply textarea');
  if (rta && !rta.dataset.grow) { rta.dataset.grow = '1'; rta.setAttribute('enterkeyhint', 'enter'); if (narrow()) { rta.placeholder = 'Message…'; rta.rows = 1; } const grow = () => { if (!narrow()) { rta.style.height = ''; return; } rta.style.height = 'auto'; rta.style.height = Math.min(140, rta.scrollHeight + 2) + 'px'; }; rta.addEventListener('input', grow); grow(); }
  // number keyboards
  // (only where negatives are not allowed: the iPhone decimal pad has no minus key)
  $$('input[type=number]:not([inputmode])').forEach(i => { if (i.min !== '' && +i.min >= 0) i.setAttribute('inputmode', i.step === '1' ? 'numeric' : 'decimal'); });
  $$('input[type=tel]:not([inputmode])').forEach(i => i.setAttribute('inputmode', 'tel'));
  // modals: the last row of buttons becomes a sticky action bar on phones
  $$('.overlay .modal:not([data-sheet]), .overlay .drawer:not([data-sheet])').forEach(m => {
    const rows = $$(':scope > div, :scope > form > div, :scope > div > form > div', m).filter(d => d.children.length && [...d.children].every(x => x.matches('button, a.btn, span')) && d.querySelector('button.btn, a.btn') && !d.nextElementSibling);
    if (!rows.length) return; // content may still be loading: try again on the next change
    m.dataset.sheet = '1'; rows[rows.length - 1].classList.add('sheet-acts');
  });
  if ($('.overlay') ? !cls.contains('has-overlay') : cls.contains('has-overlay')) cls.toggle('has-overlay', !!$('.overlay'));
}
document.addEventListener('click', e => { if (!e.target.closest('.chat-more')) $$('.chat-acts.open').forEach(x => x.classList.remove('open')); });

/* the phone keyboard shrinks the visual viewport: keep the chat composer above it */
const vv = window.visualViewport;
function syncVV() { if (!vv) return; const r = document.documentElement.style; r.setProperty('--vvh', vv.height + 'px'); r.setProperty('--vvt', vv.offsetTop + 'px'); }
vv?.addEventListener('resize', syncVV); vv?.addEventListener('scroll', syncVV); syncVV();

/* ---------- "Install app" banner (first phone visits, until dismissed or installed) ---------- */
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
function installBanner() {
  const el = $('.app-install');
  const want = A()?.me && !standalone() && narrow() && !store.get('satin-admin-install-hide') && ROOTS.includes(pathNow()) && pathNow() !== '/chat'; // only on Home and the tab pages, never over a form
  if (!want) { el?.remove(); return; }
  const can = !!P()?.canInstall(), ios = !!P()?.ios;
  const key = (can ? 'a' : '') + (ios ? 'i' : '');
  if (el && el.dataset.k === key) return;
  const b = el || document.createElement('div'); b.className = 'app-install'; b.dataset.k = key; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Install the app');
  b.innerHTML = `<img src="/admin/icons/icon-192.png" alt="" width="44" height="44"><div class="ai-t"><b>Install Satin Admin</b><small>${ios ? `Tap <span class="ai-share">${svg('share')}</span> Share, then <b>Add to Home Screen</b>.` : can ? 'Opens full screen from your home screen, with notifications.' : 'Browser menu <b>⋮</b> → <b>Install app</b> (or Add to Home screen).'}</small></div>${can ? '<button class="btn sm" type="button" data-ai-go>Install</button>' : ''}<button class="x" type="button" data-ai-x aria-label="Dismiss">×</button>`;
  if (!el) document.body.append(b);
  $('[data-ai-x]', b).onclick = () => { store.set('satin-admin-install-hide', '1'); b.remove(); };
  const go = $('[data-ai-go]', b); if (go) go.onclick = async () => { if (await P().install()) { store.set('satin-admin-install-hide', '1'); b.remove(); A().toast('Installed — open Satin Admin from your home screen'); } };
}
document.addEventListener('satin-installable', () => { installBanner(); if (pathNow() === '/notifications' && A()?.me) route(); });
addEventListener('appinstalled', () => { store.set('satin-admin-install-hide', '1'); $('.app-install')?.remove(); });

/* ---------- "Update available" (a new admin version was deployed) ---------- */
// index.html lists every admin script/stylesheet with a version (?v=…). When the deployed list differs from the one this
// page started with, or a file changed on the server (ETag / Last-Modified), offer a reload. The service worker is
// network-first, so the reload always gets the new files.
const assetList = doc => [...doc.querySelectorAll('script[src], link[rel=stylesheet][href]')].map(e => e.getAttribute('src') || e.getAttribute('href')).filter(u => /^\/admin\//.test(u)).sort().join('|');
const BOOT_SIG = assetList(document);
let validators = null, updateShown = false, lastCheck = 0;
async function checkUpdate() {
  if (updateShown || Date.now() - lastCheck < 60000) return; lastCheck = Date.now();
  try {
    const r = await fetch('/admin/', { cache: 'no-store', credentials: 'same-origin' }); if (!r.ok) return;
    const sig = assetList(new DOMParser().parseFromString(await r.text(), 'text/html'));
    let changed = !!sig && sig !== BOOT_SIG;
    if (!changed) {
      const vals = await Promise.all(BOOT_SIG.split('|').map(u => fetch(u, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }).then(x => x.headers.get('etag') || x.headers.get('last-modified') || '').catch(() => '')));
      const cur = vals.join('|');
      if (validators === null) validators = cur; else if (vals.some(Boolean) && cur !== validators) changed = true;
    }
    if (changed) showUpdate();
  } catch {}
}
function showUpdate() {
  if (updateShown) return; updateShown = true;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'app-update';
  b.innerHTML = '<b>Update available</b><span>Tap to reload the newest version</span>';
  b.onclick = () => { b.disabled = true; navigator.serviceWorker?.getRegistration('/admin/').then(r => r?.waiting?.postMessage('skipWaiting')).finally(() => location.reload()); };
  document.body.append(b);
}
navigator.serviceWorker?.getRegistration('/admin/').then(reg => {
  if (!reg) return;
  reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(); }); });
}).catch(() => {});
setTimeout(checkUpdate, 8000); setInterval(() => { if (!document.hidden) checkUpdate(); }, 10 * 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { poll(); checkUpdate(); navigator.serviceWorker?.getRegistration('/admin/').then(r => r?.update()).catch(() => {}); } });

/* ---------- watch the app shell ---------- */
let painted = false, raf = 0;
const tick = () => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    if (!A()?.me) { $('.bnav')?.remove(); $('.app-install')?.remove(); document.body.classList.remove('has-bnav'); return; }
    bottomNav(); labelTables(document.getElementById('app')); decorate(); paint(); installBanner();
    if (!painted) {
      painted = true; poll(); setTimeout(markSeen, 800);
      // chat notifications open in this app (instead of the separate chat app) once it is installed
      if (standalone()) navigator.serviceWorker?.ready.then(r => r.active?.postMessage({ type: 'prefer-admin' })).catch(() => {});
    }
  });
};
new MutationObserver(tick).observe(document.getElementById('app'), { childList: true, subtree: true });
new MutationObserver(tick).observe(document.body, { childList: true });
addEventListener('resize', tick);

/* ---------- Notifications & app page (#/notifications) ---------- */
async function route() {
  const a = A();
  const c = a.shell('Notifications & app', 'Team', '<div class="card empty">Loading…</div>', '/notifications');
  const draw = async () => {
    const st = await P().state(a.api);
    const dev = st.devices || [];
    const curPrefs = {}; // this device's saved choices (matched by a hash of its push endpoint)
    const h = st.endpoint && crypto.subtle ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(st.endpoint)))].map(b => b.toString(16).padStart(2, '0')).join('') : '';
    const here = dev.find(d => d.endpointHash === h) || null;
    for (const e of st.events) curPrefs[e] = here ? here.prefs[e] !== false : true;
    c.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Install on your phone</h2>
        <p class="hint">Install the admin and the chat inbox like apps: they open full-screen from your home screen, and can show notifications and a badge with the number of new items.</p>
        <div class="pwa-apps">
          <a class="pwa-app" href="/admin/chat-app/" target="_blank" rel="noopener"><img src="/admin/icons/chat-192.png" alt=""><span><b>Satin Chat</b><small>WhatsApp-style inbox for website chats</small></span></a>
          <div class="pwa-app"><img src="/admin/icons/icon-192.png" alt=""><span><b>Satin Admin</b><small>Orders, quotes, invoices, customers, prices</small></span></div>
        </div>
        ${P().canInstall() ? '<button class="btn sm" data-install>Install Satin Admin</button>' : ''}
        <details class="pwa-how" ${P().standalone() ? '' : 'open'}><summary>How to install</summary>
          <p><b>iPhone / iPad (Safari):</b> tap Share <span aria-hidden="true">⎋</span> → <b>Add to Home Screen</b>. Open the app from the home screen to turn on notifications (iOS 16.4 or newer).</p>
          <p><b>Android (Chrome):</b> menu ⋮ → <b>Install app</b> (or “Add to Home screen”).</p>
          <p><b>Computer (Chrome / Edge):</b> the install icon in the address bar.</p>
          <p class="hint">Installing and notifications need the secure https:// address of the site.</p></details>
      </div>
      <div class="card"><h2>Notifications on this device</h2>
        ${!st.secure ? '<div class="err">Open the admin over https:// to use notifications.</div>' : !st.supported ? `<div class="err">${st.ios && !st.standalone ? 'On iPhone/iPad: add this app to your Home Screen first, open it from there, then come back to this page.' : 'This browser cannot receive push notifications. Use Chrome, Edge, Firefox or Safari.'}</div>` : ''}
        <p class="hint">Get a notification when something new happens, even when the admin is closed. Choose what this device should get:</p>
        <div class="pwa-prefs">${st.events.map(e => `<label><input type="checkbox" data-pref="${e}" ${curPrefs[e] ? 'checked' : ''}> ${esc(P().EVENTS[e] || e)}</label>`).join('') || '<p class="hint">Your role has no notification types.</p>'}</div>
        <div class="shop-acts">${st.subscribed ? '<button class="btn sm" data-save>Save choices</button> <button class="btn ghost sm" data-test>Send a test</button> <button class="btn danger sm" data-off>Turn off on this device</button>'
          : `<button class="btn sm" data-on ${st.supported && st.events.length ? '' : 'disabled'}>Turn on notifications</button>`}</div>
        <p class="hint" data-out>${st.permission === 'denied' ? 'Notifications are blocked for this site in the browser settings.' : st.subscribed ? '✓ This device gets notifications.' : ''}</p>
        ${dev.length ? `<h3 style="margin-top:18px">Your devices</h3><table class="table mini"><thead><tr><th>Device</th><th>Last delivered</th><th></th></tr></thead><tbody>${dev.map(d => `<tr><td>${esc(device(d.agent))}${d === here ? ' <span class="pill confirmed">this device</span>' : ''}</td><td>${d.lastOkAt ? esc(a.fmtDate(d.lastOkAt)) : '—'}${d.fails ? ` <span class="pill warn">${d.fails} failed</span>` : ''}</td><td><button class="btn ghost sm" data-rm="${esc(d.id)}">Remove</button></td></tr>`).join('')}</tbody></table>` : ''}
      </div></div>
      <div class="card" style="margin-top:18px"><h2>Badges</h2><p class="hint">The red numbers on the menu show what is new since you last opened that page: ${Object.values(LABELS).join(', ')}. They clear when you open the page (live chat: when you open the conversation). On an installed app the same total shows on the app icon where the phone supports it.</p></div>
      ${a.can('settings.edit') ? `<div class="card" style="margin-top:18px" data-mailcard><h2>Email delivery (invoices, orders, account emails)</h2>
        <p class="hint">So customers get your emails in their inbox (not spam), send them through your real mailbox. Recommended for Google Workspace: server <b>smtp.gmail.com</b>, port <b>587</b>, user <b>info@satingraphic.ca</b> and a Google <b>app password</b> (Google Account → Security → 2-Step Verification → App passwords). Leave the server empty to use the hosting mail server.</p>
        <div class="form-grid"><label>SMTP server<input data-m="host" placeholder="smtp.gmail.com"></label><label>Port<select data-m="port"><option>587</option><option>465</option><option>25</option><option>2525</option></select></label>
        <label>Mailbox (user)<input data-m="user" type="email" placeholder="info@satingraphic.ca"></label><label>Password / app password<input data-m="pass" type="password" autocomplete="new-password" placeholder="unchanged"></label>
        <label>Sender name<input data-m="fromName" placeholder="Satin Graphic"></label><label>Reply-to address<input data-m="replyTo" type="email" placeholder="info@satingraphic.ca"></label>
        <label>From address without SMTP<input data-m="from" type="email" placeholder="no-reply@satingraphic.ca"></label></div>
        <div class="shop-acts"><button class="btn sm" data-msave>Save</button> <input data-mto type="email" placeholder="test address" style="max-width:220px"> <button class="btn ghost sm" data-mtest>Send a test email</button></div>
        <p class="hint" data-mout></p></div>` : ''}`;
    const prefs = () => Object.fromEntries($$('[data-pref]', c).map(i => [i.dataset.pref, i.checked]));
    const out = $('[data-out]', c);
    const busy = (b, fn) => async () => { b.disabled = true; try { await fn(); } catch (e) { out.textContent = e.message; out.className = 'err'; } finally { b.disabled = false; } };
    const on = $('[data-on]', c); if (on) on.onclick = busy(on, async () => { await P().enable(a.api, prefs()); a.toast('Notifications are on for this device'); draw(); });
    const sv = $('[data-save]', c); if (sv) sv.onclick = busy(sv, async () => { await P().setPrefs(a.api, prefs()); a.toast('Saved'); });
    const tb = $('[data-test]', c); if (tb) tb.onclick = busy(tb, async () => { const r = await a.api('/push/test', {}); out.className = r.ok ? 'okmsg' : 'err'; out.textContent = r.ok ? `Test sent to ${r.sent} of ${r.total} device(s).` : `The push service did not accept it (code ${r.codes.join(', ')}).`; });
    const off = $('[data-off]', c); if (off) off.onclick = busy(off, async () => { await P().disable(a.api); a.toast('Notifications turned off'); draw(); });
    $$('[data-rm]', c).forEach(b => b.onclick = busy(b, async () => { await a.api('/push/unsubscribe', { id: b.dataset.rm }); draw(); }));
    const mc = $('[data-mailcard]', c);
    if (mc) {
      const mo = $('[data-mout]', mc), f = k => $(`[data-m="${k}"]`, mc);
      a.api('/push/mail').then(m => { for (const k of ['host', 'user', 'fromName', 'replyTo', 'from']) f(k).value = m[k] || ''; f('port').value = String(m.port || 587); f('pass').placeholder = m.hasPass ? 'saved — leave empty to keep' : 'app password'; $('[data-mto]', mc).value = a.me?.email || ''; }).catch(e => { mo.textContent = e.message; });
      const mb = (b, fn) => async () => { b.disabled = true; mo.className = 'hint'; try { await fn(); } catch (e) { mo.textContent = e.message; mo.className = 'err'; } finally { b.disabled = false; } };
      const ms = $('[data-msave]', mc); ms.onclick = mb(ms, async () => { const v = {}; for (const k of ['host', 'user', 'pass', 'fromName', 'replyTo', 'from']) v[k] = f(k).value.trim(); v.port = Number(f('port').value); await a.api('/push/mail', v); f('pass').value = ''; mo.textContent = 'Saved. Send a test to check.'; mo.className = 'okmsg'; });
      const mt = $('[data-mtest]', mc); mt.onclick = mb(mt, async () => { const r = await a.api('/push/mail/test', { to: $('[data-mto]', mc).value.trim() }); mo.className = r.ok && !r.smtpError ? 'okmsg' : 'err'; mo.textContent = r.ok ? `Sent via ${r.via}.` + (r.smtpError ? ` SMTP did not work (${r.smtpError}), so the hosting mail server was used — check the mailbox and app password.` : ' Check the inbox (and the spam folder the first time).') : 'The email could not be sent.'; });
    }
    const ib = $('[data-install]', c); if (ib) ib.onclick = async () => { if (await P().install()) a.toast('Installed'); draw(); };
  };
  try { await draw(); } catch (e) { c.innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
}
function device(ua) {
  ua = ua || ''; const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} on ${os}`;
}

try { localStorage.setItem('satinStaff', '1'); } catch {}
window.SatinPWA = { route, hub, home, poll, checkUpdate, get badges() { return badges; } };
})();
