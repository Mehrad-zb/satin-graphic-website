/* Satin website editor v3 — entry point. */
import { hooks, commit, S, F } from './core.js?v=8';
import './phone.js?v=8';
import { boot, openPanel } from './panels.js?v=8';
import './inspector.js?v=8';
import './canvas.js?v=8';
import './tools.js?v=8';
hooks.commit = commit;
window.__satinEditor = { S, F, hooks };
boot();
// deep link from the admin app's Website tab: /admin/editor/?panel=pages|menus|theme|seo|media|layers|history|add
{ const k = new URLSearchParams(location.search).get('panel');
  if (/^(add|layers|pages|menus|theme|media|seo|history)$/.test(k || '')) { let n = 0; const t = setInterval(() => { if (document.querySelector('[data-rail]') || ++n > 40) { clearInterval(t); try { openPanel(k); } catch {} } }, 250); } }
