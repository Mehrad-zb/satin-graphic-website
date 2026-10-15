/* Satin Admin service worker (scope /admin/): makes the admin and the staff chat app installable and fast to open,
   and shows Web Push notifications. It keeps an offline copy of the app shell only (HTML/CSS/JS/icons under /admin/), always network-first.
   API responses (/api/…) and anything with customer data are never cached. */
const VERSION = 'satin-admin-v3';
const SHELL = ['/admin/', '/admin/chat-app/', '/admin/icons/icon-192.png', '/admin/icons/chat-192.png', '/admin/icons/badge-96.png', '/satin/img/logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('satin-admin-') && k !== VERSION && k !== PREFS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

/* Updates must show up immediately after every deploy (admin, chat app and website editor):
   - pages (HTML) and code/styles (.js .mjs .css .json): NETWORK FIRST, revalidated with the server on every load
     (cache: 'no-cache' skips the browser's 10-minute HTTP cache); the saved copy is used only when offline.
   - icons/images: cache first with background refresh (they rarely change).
   - /api/… and anything else: never touched. */
const sameOrigin = url => url.origin === location.origin;
const isAdmin = url => url.pathname.startsWith('/admin/') && !url.pathname.endsWith('/sw.js');
const isCode = url => /\.(css|js|mjs|json)$/.test(url.pathname);
const isImage = url => (isAdmin(url) || url.pathname === '/satin/img/logo.png') && /\.(png|svg|webp|jpg|ico|woff2)$/.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(url) || url.pathname.startsWith('/api/')) return; // never touch API traffic
  if (req.mode === 'navigate' && isAdmin(url)) {
    const shell = url.pathname.startsWith('/admin/chat-app/') ? '/admin/chat-app/' : url.pathname.startsWith('/admin/editor/') ? '/admin/editor/' : '/admin/';
    e.respondWith(fetch(req).then(res => { // (HTML is served with Cache-Control: no-cache)
      if (res.ok && (url.pathname === shell || url.pathname === shell + 'index.html')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(shell, copy)); }
      return res;
    }).catch(() => caches.match(shell).then(r => r || new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;padding:40px 20px;text-align:center"><h1>You are offline</h1><p>Reconnect to the internet to use Satin Admin.</p><button onclick="location.reload()" style="font:inherit;padding:10px 18px">Try again</button>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
    return;
  }
  if (isAdmin(url) && isCode(url)) {
    e.respondWith(fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: false }).then(r => r || caches.match(req, { ignoreSearch: true })).then(r => r || Response.error())));
    return;
  }
  if (isImage(url)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok && res.type === 'basic') c.put(req, res.clone()); return res; }).catch(() => hit || Response.error());
      return hit || net;
    }));
  }
});

/* which app opens website-chat notifications: the separate chat app (default) or this admin app (set by the
   installed admin app, see pwa.js) */
const PREFS = 'satin-admin-prefs';
const getPref = async k => { try { const r = await (await caches.open(PREFS)).match('/__pref/' + k); return r ? await r.text() : ''; } catch { return ''; } };
const setPref = async (k, v) => { try { await (await caches.open(PREFS)).put('/__pref/' + k, new Response(v)); } catch {} };

/* ---------- Web Push ---------- */
async function refreshBadge() {
  try {
    const r = await fetch('/api/admin/badges', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    if (self.navigator.setAppBadge) { if (d.total > 0) await self.navigator.setAppBadge(d.total); else await self.navigator.clearAppBadge(); }
  } catch {}
}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Satin admin', body: e.data ? e.data.text() : '' }; }
  const chat = d.type === 'chat';
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || 'Satin admin', {
      body: d.body || '', tag: d.tag || d.type || 'satin', renotify: true, silent: false, vibrate: [200, 100, 200],
      icon: chat ? '/admin/icons/chat-192.png' : '/admin/icons/icon-192.png', badge: '/admin/icons/badge-96.png',
      data: { url: d.url || '/admin/' }, timestamp: (d.ts || Date.now() / 1000) * 1000
    }),
    refreshBadge(),
    self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage({ type: 'push', payload: d })))
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let target = new URL((e.notification.data && e.notification.data.url) || '/admin/', location.origin);
  if (target.origin !== location.origin) return;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (target.pathname.startsWith('/admin/chat-app/') && !all.some(c => new URL(c.url).pathname.startsWith('/admin/chat-app/'))
      && (await getPref('chat') === 'admin' || all.some(c => new URL(c.url).pathname === '/admin/'))) {
      // open the conversation in the admin app's Chat tab
      const m = target.hash.match(/^#c=([\w-]+)$/);
      target = new URL('/admin/#/chat' + (m ? '?id=' + m[1] : ''), location.origin);
    }
    const appRoot = target.pathname.startsWith('/admin/chat-app/') ? '/admin/chat-app/' : '/admin/';
    const same = all.find(c => new URL(c.url).pathname.startsWith(appRoot) && (appRoot !== '/admin/' || !new URL(c.url).pathname.startsWith('/admin/chat-app/')));
    if (same) { await same.focus(); try { await same.navigate(target.href); } catch { same.postMessage({ type: 'open', url: target.href }); } return; }
    await self.clients.openWindow(target.href);
  })());
});
self.addEventListener('pushsubscriptionchange', e => {
  // the browser rotated the subscription: the page re-subscribes on next open (needs the signed-in session + CSRF)
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage({ type: 'resubscribe' }))));
});
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data && e.data.type === 'prefer-admin') e.waitUntil(setPref('chat', 'admin'));
});
