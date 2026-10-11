/* Satin Graphic customer app layer (all public pages; linked by hp/seo_pass.py app_head()).
   - registers the customer service worker /sw.js (scope "/": installable app + offline screen; it caches no pages)
   - remembers that the visitor came from an app (?source=app|android|ios, installed PWA, or the iOS app's user agent)
     and marks <html data-app="…"> so CSS/JS can adapt; the ?source= parameter is removed from the address afterwards
   - iOS app: navigator.share() → the native share sheet, through the app's "satinShare" message handler
   No tracking, no storage beyond sessionStorage["satin-app"]. */
(() => {
  'use strict';
  let app = '';
  try {
    const u = new URL(location.href), src = u.searchParams.get('source');
    if (/^(app|android|ios)$/.test(src || '')) {
      sessionStorage.setItem('satin-app', src);
      u.searchParams.delete('source');
      history.replaceState(history.state, '', u.pathname + (u.search === '?' ? '' : u.search) + u.hash);
    }
    app = sessionStorage.getItem('satin-app') || '';
  } catch {}
  if (/\bSatinGraphicApp\/[\d.]+ \(iOS\)/.test(navigator.userAgent)) app = 'ios';
  else if (!app && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)) app = 'app';
  if (app) document.documentElement.dataset.app = app;

  const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.satinShare;
  if (bridge && !navigator.share) {
    try {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: data => { bridge.postMessage({ title: String(data?.title || ''), text: String(data?.text || ''), url: String(data?.url || location.href) }); return Promise.resolve(); }
      });
    } catch {}
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
    }, { once: true });
  }
})();
