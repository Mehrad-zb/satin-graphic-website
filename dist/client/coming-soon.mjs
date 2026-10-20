/* "Coming soon" pages — loaded by site-extras.mjs on every public page.
   To launch a page: remove its path from SOON below (or empty the list). Nothing else needs to change.
   - the page itself stays reachable, but its content is blurred behind a "Coming soon" card with Back to home
   - menu links to it get a small "Soon" badge
   - cards that link to it (e.g. on /satin/shop) are blurred with a "Coming soon" label */
export const SOON = [
  '/satin/shop/materials-tools',
  '/satin/shop/vehicle-wrap-designs',
];

const LANG = (location.pathname.match(/^\/satin\/(fa|fr|es)(?=\/|$)/) || [])[1] || 'en';
const T = {
  en: { soon: 'Soon', title: 'Coming soon', text: 'We’re putting the finishing touches on this section. It will open here shortly.', home: 'Back to home', shop: 'Browse the shop', card: 'Coming soon' },
  fa: { soon: 'به‌زودی', title: 'به‌زودی', text: 'این بخش در حال تکمیل است و به‌زودی همین‌جا در دسترس قرار می‌گیرد.', home: 'بازگشت به صفحه اصلی', shop: 'رفتن به فروشگاه', card: 'به‌زودی' },
  fr: { soon: 'Bientôt', title: 'Bientôt disponible', text: 'Nous mettons la touche finale à cette section. Elle ouvrira ici très bientôt.', home: 'Retour à l’accueil', shop: 'Voir la boutique', card: 'Bientôt disponible' },
  es: { soon: 'Pronto', title: 'Próximamente', text: 'Estamos terminando esta sección. Muy pronto estará disponible aquí.', home: 'Volver al inicio', shop: 'Ver la tienda', card: 'Próximamente' },
}[LANG];
const base = LANG === 'en' ? '/satin' : '/satin/' + LANG;
const norm = h => { try { const u = new URL(h, location.origin); if (u.origin !== location.origin) return ''; return u.pathname.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/, '/satin').replace(/\/+$/, ''); } catch { return ''; } };
const isSoon = h => SOON.includes(norm(h));

const CSS = `
.cs-badge{display:inline-block;margin-inline-start:6px;padding:1px 7px;border-radius:999px;background:#fff0f4;color:#c91c50;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;vertical-align:middle;line-height:1.6}
.cs-card{position:relative;overflow:hidden}
.cs-card>*{filter:blur(5px);opacity:.75}
.cs-card>.cs-tag{filter:none;opacity:1;position:absolute;inset:0;display:grid;place-items:center;z-index:2}
.cs-card>.cs-tag span{background:#1d1d1fe6;color:#fff;font-weight:800;font-size:14px;letter-spacing:.04em;padding:9px 16px;border-radius:999px;box-shadow:0 10px 24px -10px #0008}
html.cs-page main .page-enter{filter:blur(7px);pointer-events:none;user-select:none;max-height:120vh;overflow:hidden}
.cs-ov{position:fixed;inset:0;z-index:1500;display:grid;place-items:center;padding:16px;background:#f5f5f7a6;backdrop-filter:blur(2px)}
.cs-box{background:#fff;border-radius:24px;max-width:460px;width:100%;padding:30px 26px;text-align:center;box-shadow:0 30px 70px -30px #0f172a73}
.cs-ico{width:58px;height:58px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;background:#fff0f4;color:#c91c50}
.cs-box h2{margin:0 0 8px;font-size:28px;letter-spacing:-.01em;color:#1d1d1f}
.cs-box p{margin:0 0 20px;color:#6e6e73;line-height:1.5}
.cs-acts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.cs-acts a{display:inline-flex;align-items:center;justify-content:center;padding:11px 18px;border-radius:999px;font-weight:700;text-decoration:none;font-size:15px}
.cs-acts .p{background:#c91c50;color:#fff}
.cs-acts .g{background:#f2f2f4;color:#1d1d1f}
`;

function decorate(root = document) {
  for (const a of root.querySelectorAll('a[href]')) {
    if (a.dataset.cs || !isSoon(a.getAttribute('href'))) continue;
    a.dataset.cs = '1';
    if (a.closest('main') && (a.classList.contains('card') || a.querySelector('img,picture,.art'))) {
      a.classList.add('cs-card');
      a.insertAdjacentHTML('beforeend', `<div class="cs-tag"><span>${T.card}</span></div>`);
    } else if (!a.closest('main') && a.textContent.trim() && !a.querySelector('img,picture')) {
      a.insertAdjacentHTML('beforeend', `<span class="cs-badge">${T.soon}</span>`);
    }
  }
}

let shown = '';
function page() {
  const here = norm(location.pathname);
  const on = SOON.includes(here);
  document.documentElement.classList.toggle('cs-page', on);
  if (!on) { document.querySelector('.cs-ov')?.remove(); shown = ''; return; }
  if (shown === here && document.querySelector('.cs-ov')) return;
  shown = here;
  document.querySelector('.cs-ov')?.remove();
  const icon = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  document.body.insertAdjacentHTML('beforeend', `<div class="cs-ov" role="dialog" aria-modal="true" aria-labelledby="cs-t"><div class="cs-box"><div class="cs-ico">${icon}</div><h2 id="cs-t">${T.title}</h2><p>${T.text}</p><div class="cs-acts"><a class="p" href="${base}/">${T.home}</a><a class="g" href="${base}/shop/">${T.shop}</a></div></div></div>`);
}

if (SOON.length) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const run = () => { try { page(); decorate(); } catch (e) { console.warn('coming-soon', e); } };
  run();
  let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; run(); }); }).observe(document.body, { childList: true, subtree: true });
  addEventListener('popstate', () => setTimeout(run, 50));
}
