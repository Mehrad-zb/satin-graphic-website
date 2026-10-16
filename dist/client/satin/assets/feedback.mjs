/* "How did you hear about us?" — a small corner card, shown once per visitor after ~25 s on the site or after reading
   half of a page. Closing it or answering hides it for good on this device. Answers: POST /api/feedback (feedback.php),
   shown in Admin → Home → Customer report. Loaded by the satin bundle. */
const T = {
  en: { q: 'How did you hear about us?', sub: 'One tap — it helps a small local shop a lot.', o: { google: 'Google search', maps: 'Google Maps', ai: 'ChatGPT / AI search', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', referral: 'Friend / referral', vehicle: 'Saw a wrapped vehicle', other: 'Other' }, ref: 'Who referred you? (optional)', oth: 'Where did you find us? (optional)', send: 'Send', thanks: 'Thank you!', thanks2: 'Your answer helps us a lot.', close: 'Close' },
  fa: { q: 'از کجا با ما آشنا شدید؟', sub: 'فقط یک انتخاب — خیلی به ما کمک می‌کند.', o: { google: 'جستجوی گوگل', maps: 'گوگل مپس', ai: 'ChatGPT / جستجوی هوش مصنوعی', instagram: 'اینستاگرام', facebook: 'فیسبوک', tiktok: 'تیک‌تاک', youtube: 'یوتیوب', referral: 'معرفی دوست / آشنا', vehicle: 'ماشین رپ‌شده دیدم', other: 'سایر' }, ref: 'چه کسی شما را معرفی کرد؟ (اختیاری)', oth: 'کجا ما را پیدا کردید؟ (اختیاری)', send: 'ارسال', thanks: 'ممنون!', thanks2: 'جواب شما خیلی به ما کمک می‌کند.', close: 'بستن' },
  fr: { q: 'Comment nous avez-vous connus ?', sub: 'Un seul clic — ça aide beaucoup une entreprise locale.', o: { google: 'Recherche Google', maps: 'Google Maps', ai: 'ChatGPT / recherche IA', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', referral: 'Ami / recommandation', vehicle: 'Vu un véhicule wrappé', other: 'Autre' }, ref: 'Qui vous a recommandé ? (facultatif)', oth: 'Où nous avez-vous trouvés ? (facultatif)', send: 'Envoyer', thanks: 'Merci !', thanks2: 'Votre réponse nous aide beaucoup.', close: 'Fermer' },
  es: { q: '¿Cómo nos conociste?', sub: 'Un toque — ayuda mucho a un negocio local.', o: { google: 'Búsqueda en Google', maps: 'Google Maps', ai: 'ChatGPT / búsqueda con IA', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', referral: 'Amigo / recomendación', vehicle: 'Vi un vehículo rotulado', other: 'Otro' }, ref: '¿Quién te recomendó? (opcional)', oth: '¿Dónde nos encontraste? (opcional)', send: 'Enviar', thanks: '¡Gracias!', thanks2: 'Tu respuesta nos ayuda mucho.', close: 'Cerrar' }
};
const ICONS = { google: 'G', maps: '📍', ai: '✦', instagram: '◎', facebook: 'f', tiktok: '♪', youtube: '▶', referral: '🤝', vehicle: '🚐', other: '…' };
const KEY = 'satinFb';
const CSS = `.sfb{position:fixed;left:16px;bottom:16px;z-index:60;width:min(340px,calc(100vw - 32px));background:#fff;color:#16181d;border-radius:16px;box-shadow:0 10px 40px #0000002e,0 0 0 1px #0000000d;padding:16px 16px 14px;font:14px/1.4 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;transform:translateY(calc(100% + 30px));opacity:0;transition:transform .45s cubic-bezier(.2,.9,.3,1.2),opacity .3s}
.sfb.in{transform:none;opacity:1}.sfb[dir=rtl]{left:auto;right:16px;font-family:Vazirmatn,Tahoma,system-ui,sans-serif}
.sfb h2{font-size:15.5px;margin:0 26px 2px 0;letter-spacing:-.01em}.sfb[dir=rtl] h2{margin:0 0 2px 26px}
.sfb p{margin:0 0 12px;color:#6b7280;font-size:12.5px}
.sfb .x{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;background:transparent;border-radius:50%;font-size:20px;line-height:1;color:#9ca3af;cursor:pointer}.sfb[dir=rtl] .x{right:auto;left:8px}
.sfb .x:hover{background:#f3f4f6;color:#16181d}
.sfb .g{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.sfb .g button{display:flex;align-items:center;gap:7px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:8px 9px;font:inherit;font-size:13px;color:#16181d;cursor:pointer;text-align:start;min-height:40px;transition:border-color .15s,background .15s}
.sfb .g button:hover{border-color:#c91c50;background:#fff5fa}
.sfb .g i{font-style:normal;flex:none;width:22px;height:22px;border-radius:6px;background:#fde8ef;color:#c91c50;display:grid;place-items:center;font-size:12px;font-weight:800}
.sfb .more{display:flex;gap:6px;margin-top:4px}.sfb .more input{flex:1;min-width:0;border:1px solid #d1d5db;border-radius:10px;padding:9px 10px;font:inherit;font-size:16px}
.sfb .more button{border:0;background:#c91c50;color:#fff;border-radius:10px;padding:0 14px;font:inherit;font-weight:700;cursor:pointer}
.sfb .ty{text-align:center;padding:6px 0 2px}.sfb .ty b{display:block;font-size:17px;margin-bottom:2px}.sfb .ty span{color:#6b7280;font-size:13px}.sfb .ty em{font-style:normal;font-size:30px;display:block;margin-bottom:4px}
@media (max-width:560px){.sfb{left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);width:auto;padding:14px 14px 12px}.sfb[dir=rtl]{right:10px}.sfb .g button{padding:7px 8px;font-size:12.5px;min-height:38px}}
.sfb .open{display:none}
@media (max-width:560px){.sfb.mini{padding:10px 12px;cursor:pointer}.sfb.mini h2{margin:0 60px 0 0;font-size:14.5px}.sfb[dir=rtl].mini h2{margin:0 0 0 60px}.sfb.mini p,.sfb.mini .g{display:none}.sfb.mini .x{top:4px}.sfb.mini .open{display:grid;position:absolute;top:7px;right:42px;width:28px;height:28px;border-radius:50%;border:0;background:#fde8ef;color:#c91c50;place-items:center;font-size:15px;font-weight:800;cursor:pointer}.sfb[dir=rtl].mini .open{right:auto;left:42px}}
@media (prefers-reduced-motion:reduce){.sfb{transition:none}}`;

const get = () => { try { return localStorage.getItem(KEY); } catch { return '1'; } };
const set = v => { try { localStorage.setItem(KEY, v); } catch {} };

export function init({ id = '', lang = 'en' } = {}) {
  if (get() || window.frameElement || navigator.webdriver) return;
  try { if (localStorage.getItem('satinStaff') === '1') return; } catch {}
  if (/^\/satin\/(?:(?:fa|fr|es)\/)?(cart|checkout|account|pay|invoice|sign|order|login)/.test(location.pathname)) return;
  const t = T[lang] || T.en;
  let shown = false, timer = 0;
  const free = () => !document.querySelector('.consent-banner') && !document.querySelector('.scw.open') && !document.querySelector('dialog[open]');
  const tryShow = () => { if (shown || get()) return; if (!free()) { clearTimeout(timer); timer = setTimeout(tryShow, 4000); return; } shown = true; removeEventListener('scroll', onScroll); show(); };
  const started = Date.now();
  // time on the site carries over between pages of the same visit
  let spent = 0; try { spent = +sessionStorage.getItem('satinFbT') || 0; } catch {}
  const wait = Math.max(3000, 25000 - spent);
  timer = setTimeout(tryShow, wait);
  addEventListener('pagehide', () => { try { sessionStorage.setItem('satinFbT', String(spent + Date.now() - started)); } catch {} });
  const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; if (h > 400 && scrollY / h > .5 && Date.now() - started > 8000) tryShow(); };
  addEventListener('scroll', onScroll, { passive: true });

  function show() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = document.createElement('aside'); el.className = 'sfb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', t.q);
    if (lang === 'fa') el.dir = 'rtl';
    if (innerWidth <= 560) el.classList.add('mini');
    el.innerHTML = `<button class="x" type="button" aria-label="${t.close}">×</button><button class="open" type="button" aria-label="${t.q}" aria-expanded="false">⌃</button><h2>${t.q}</h2><p>${t.sub}</p><div class="g">${Object.entries(t.o).map(([k, v]) => `<button type="button" data-k="${k}"><i aria-hidden="true">${ICONS[k]}</i>${v}</button>`).join('')}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    const hide = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 500); };
    el.onclick = e => { if (el.classList.contains('mini') && !e.target.closest('.x')) { el.classList.remove('mini'); el.querySelector('.open')?.setAttribute('aria-expanded', 'true'); } };
    el.querySelector('.x').onclick = () => { set('closed:' + new Date().toISOString().slice(0, 10)); hide(); };
    const send = (choice, detail = '') => {
      set('answered:' + choice);
      fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice, detail, id, path: location.pathname, w: innerWidth }), keepalive: true }).catch(() => {});
      el.innerHTML = `<div class="ty" role="status"><em>🙏</em><b>${t.thanks}</b><span>${t.thanks2}</span></div>`;
      setTimeout(hide, 2600);
    };
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k !== 'other' && k !== 'referral') return send(k);
      el.querySelector('.g').outerHTML = `<form class="more"><input maxlength="140" placeholder="${k === 'referral' ? t.ref : t.oth}" aria-label="${k === 'referral' ? t.ref : t.oth}"><button>${t.send}</button></form>`;
      const f = el.querySelector('.more'); f.querySelector('input').focus();
      f.onsubmit = e => { e.preventDefault(); send(k, f.querySelector('input').value.trim()); };
    });
  }
}
