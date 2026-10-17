/* Satin Admin — shared helpers for the installable apps: service worker registration and Web Push subscription.
   Used by the admin (pwa.js) and the staff chat app (/admin/chat-app/). window.SatinPush = { … } */
(() => {
'use strict';
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
const b64ToBytes = s => { const p = '='.repeat((4 - s.length % 4) % 4); const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, c => c.charCodeAt(0)); };
let regP = null;
function register() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(null);
  return regP ||= navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(e => { console.warn('Service worker:', e); return null; });
}
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
async function state(api) {
  const out = { supported: supported(), permission: 'Notification' in window ? Notification.permission : 'unsupported', subscribed: false, endpoint: '', devices: [], events: [], prefs: null, ios, standalone: standalone(), secure: window.isSecureContext };
  try { const d = await api('/push/key'); out.devices = d.devices; out.events = d.events; out.publicKey = d.publicKey; } catch (e) { out.error = e.message; }
  if (out.supported) {
    const reg = await register();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { out.subscribed = true; out.endpoint = sub.endpoint; }
  }
  return out;
}
async function enable(api, prefs) {
  if (!supported()) throw new Error(ios && !standalone() ? 'On iPhone/iPad, first add this app to your Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on.' : 'This browser cannot receive push notifications here. Use Chrome, Edge, Firefox or Safari over HTTPS.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in the browser’s site settings and try again.');
  const reg = await register(); await navigator.serviceWorker.ready;
  const { publicKey } = await api('/push/key');
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const cur = sub.options && sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
    const want = b64ToBytes(publicKey);
    if (cur && (cur.length !== want.length || cur.some((v, i) => v !== want[i]))) { await sub.unsubscribe(); sub = null; }
  }
  sub ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  await api('/push/subscribe', { subscription: sub.toJSON(), prefs });
  return sub;
}
async function disable(api) {
  const reg = await register(); const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { await api('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
}
async function setPrefs(api, prefs) {
  const reg = await register(); const sub = reg && await reg.pushManager.getSubscription();
  if (!sub) throw new Error('Turn notifications on for this device first.');
  return api('/push/prefs', { endpoint: sub.endpoint, prefs });
}
/** Re-sends the current subscription after the browser rotated it (service worker asks via postMessage). */
async function resync(api) { try { const reg = await register(); const sub = reg && await reg.pushManager.getSubscription(); if (sub && Notification.permission === 'granted') await api('/push/subscribe', { subscription: sub.toJSON() }); } catch {} }
/** App icon badge (installed app, where supported). */
function appBadge(n) { try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch {} }
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; document.dispatchEvent(new Event('satin-installable')); });
async function install() { if (!installEvt) return false; installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; return r && r.outcome === 'accepted'; }
window.SatinPush = { supported, register, state, enable, disable, setPrefs, resync, appBadge, install, canInstall: () => !!installEvt, standalone, ios,
  EVENTS: { chat: 'New website chat messages', orders: 'New online orders and payments', requests: 'New quote and booking requests' } };
register();
})();
