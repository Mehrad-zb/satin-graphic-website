/* Satin Graphic customer app service worker (scope "/"), registered by /site-app.js on the public pages.
   Purpose: make the website an installable app (Android/desktop "Install", Play Store TWA, iOS home screen) and show a
   friendly offline screen. It deliberately caches NOTHING of the website itself, so every deploy is live at once:
   - page navigations under /satin/ go to the network (navigation preload, browser HTTP rules: HTML is no-cache);
     only when the network fails is the built-in offline page shown;
   - JS / CSS / JSON / images / fonts are not intercepted at all (normal browser behaviour, same as without a worker);
   - /api/, /admin/ (it has its own worker, /admin/sw.js), checkout, payment, account, login, invoice and tracking pages are
     never touched, not even for the offline page;
   - the only cache holds the app icon used by the offline page.
   Emergency switch-off: replace this file with
     self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));
*/
const VERSION = 'satin-site-v1';
const ICON = '/satin/img/app/icon-192.png';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.add(new Request(ICON, { cache: 'reload' }))).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();   // only our own old caches; the admin worker's satin-admin-* caches are left alone
    await Promise.all(keys.filter(k => k.startsWith('satin-site-') && k !== VERSION).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch {} }
    await self.clients.claim();
  })());
});

// pages that must always come straight from the server, even offline (private, payment or admin)
const PRIVATE = /^\/satin\/(?:(?:fa|fr|es)\/)?(?:account|login|register|checkout|track)(?:\/|$)/;
const handled = url => url.origin === location.origin && url.pathname.startsWith('/satin/') && !PRIVATE.test(url.pathname);

const OFFLINE_EN = ['You are offline', 'Check your internet connection and try again.', 'Try again', 'ltr'];
const OFFLINE = lang => {
  const t = {
    en: ['You are offline', 'Check your internet connection and try again.', 'Try again', 'ltr'],
    fr: ['Vous êtes hors ligne', 'Vérifiez votre connexion Internet et réessayez.', 'Réessayer', 'ltr'],
    es: ['Sin conexión', 'Revisa tu conexión a Internet e inténtalo de nuevo.', 'Reintentar', 'ltr'],
    fa: ['اتصال اینترنت برقرار نیست', 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.', 'تلاش دوباره', 'rtl']
  }[lang] || OFFLINE_EN;
  const [h, p, b, dir] = t;
  return `<!doctype html><html lang="${lang}" dir="${dir}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#ffffff"><title>Satin Graphic</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#fff;color:#0f1a2c;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Vazirmatn,sans-serif;padding:24px;box-sizing:border-box;text-align:center}
main{max-width:420px}img{width:96px;height:96px;border-radius:22px;box-shadow:0 6px 24px rgba(15,26,44,.12)}h1{font-size:1.5rem;margin:22px 0 8px}p{color:#5b687c;margin:0 0 24px}
button{font:inherit;font-weight:600;color:#fff;background:#c91c50;border:0;border-radius:999px;padding:12px 26px;cursor:pointer}</style>
<main><img src="${ICON}" alt="Satin Graphic"><h1>${h}</h1><p>${p}</p><button onclick="location.reload()">${b}</button></main>
<script>addEventListener('online',()=>location.reload())</script></html>`;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname === ICON) {   // the offline page's icon: network, cached copy when offline
    e.respondWith(fetch(req).catch(() => caches.match(ICON).then(r => r || Response.error())));
    return;
  }
  if (req.mode !== 'navigate' || !handled(url)) return;   // everything else: untouched, straight to the network
  e.respondWith((async () => {
    try {
      const pre = await e.preloadResponse;
      if (pre) return pre;
      return await fetch(req);
    } catch {
      const lang = (url.pathname.match(/^\/satin\/(fa|fr|es)\//) || [])[1] || 'en';
      return new Response(OFFLINE(lang), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
  })());
});
