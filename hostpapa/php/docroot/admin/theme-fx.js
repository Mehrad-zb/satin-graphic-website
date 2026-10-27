/* Satin Admin — theme switcher (Classic / Glass / Lavender) and page motion.
   Works beside app.js without touching it: watches #app and decorates what app.js renders. */
(() => {
  'use strict';
  const KEY = 'satin-admin-theme';
  const THEMES = [
    ['classic', 'Classic', 'Light grey, clean'],
    ['glass', 'Glass', 'Frosted panels on a sunny blur'],
    ['lav', 'Lavender', 'Light canvas, black icon rail'],
  ];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const get = () => { try { return localStorage.getItem(KEY) || 'classic'; } catch { return 'classic'; } };
  const apply = t => { THEMES.forEach(([k]) => root.classList.toggle('th-' + k, k === t && k !== 'classic')); };
  const set = t => {
    try { localStorage.setItem(KEY, t); } catch {}
    root.classList.add('fx-switch'); apply(t); clearTimeout(set._t); set._t = setTimeout(() => root.classList.remove('fx-switch'), 600);
    document.querySelectorAll('.fx-pop button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  };
  apply(get());

  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7.3" r="1.2"/><circle cx="15" cy="7.6" r="1.2"/></svg>';

  /* switcher button in the desktop top bar */
  function makeSwitcher(extra) {
    const w = document.createElement('div'); w.className = 'fx-sw' + (extra ? ' ' + extra : '');
    const cur = get();
    w.innerHTML = `<button type="button" title="Theme" aria-label="Change theme" aria-haspopup="true">${ICON}</button><div class="fx-pop" hidden role="menu"><b>Theme</b>${THEMES.map(([k, l, d]) => `<button type="button" role="menuitemradio" data-t="${k}" class="${k === cur ? 'on' : ''}"><i class="t-${k}"></i><span>${l}<small>${d}</small></span></button>`).join('')}</div>`;
    const btn = w.firstElementChild, pop = w.lastElementChild;
    btn.onclick = e => { e.stopPropagation(); const open = pop.hidden; closeAll(); pop.hidden = !open; };
    pop.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-t]'); if (b) { set(b.dataset.t); pop.hidden = true; } };
    return w;
  }
  const closeAll = () => document.querySelectorAll('.fx-pop').forEach(p => { p.hidden = true; });
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  /* desktop: in the top bar · phones: at the right of the page title */
  function addSwitcher() {
    const bar = document.querySelector('.wt-icons');
    if (bar && !bar.querySelector('.fx-sw')) bar.insertBefore(makeSwitcher(), bar.firstChild);
    const top = document.querySelector('.main > .top');
    if (top && !top.querySelector('.fx-sw')) { const first = top.firstElementChild; first.after(makeSwitcher('fx-sw-m')); }
  }

  /* tooltips for the icon rail (Glass and Lavender) — fixed so the scrolling rail cannot clip them */
  let tip = null;
  const hideTip = () => { if (tip) { tip.remove(); tip = null; } };
  function railTips() {
    document.querySelectorAll('.nav a:not([data-fx-tip])').forEach(a => {
      a.dataset.fxTip = '1';
      const label = (a.querySelector('span') || a).textContent.trim();
      if (!a.getAttribute('aria-label')) a.setAttribute('aria-label', label);
      a.addEventListener('mouseenter', () => {
        if (!root.classList.contains('th-glass') && !root.classList.contains('th-lav')) return;
        if (innerWidth <= 820) return;
        hideTip(); const r = a.getBoundingClientRect();
        tip = document.createElement('div'); tip.className = 'fx-tipbox'; tip.textContent = label;
        tip.style.left = (r.right + 12) + 'px'; tip.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(tip);
      });
      a.addEventListener('mouseleave', hideTip);
      a.addEventListener('click', hideTip);
    });
  }

  /* page title: words blur in one after another */
  function animateTitle() {
    const h = document.querySelector('.top h1');
    if (!h || h.dataset.fx || reduce) return;
    h.dataset.fx = '1';
    if (h.children.length) return; // titles with markup are left alone
    const words = h.textContent.split(/(\s+)/);
    h.innerHTML = words.map((w, i) => /^\s+$/.test(w) ? w : `<span class="fx-w" style="--fx-i:${i / 2}">${w.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join('');
  }

  /* numbers count up from zero, keeping their format (CA$65,491.21 · 24.2% · 9,2h) */
  function countUp(el) {
    if (el.dataset.fxNum || reduce) return;
    el.dataset.fxNum = '1';
    if (el.children.length) return;
    const txt = el.textContent, m = txt.match(/-?\d[\d,]*(\.\d+)?/);
    if (!m) return;
    const raw = m[0], target = parseFloat(raw.replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    const dec = (m[1] || '').length ? m[1].length - 1 : 0, comma = raw.includes(',');
    const pre = txt.slice(0, m.index), post = txt.slice(m.index + raw.length);
    const fmt = v => pre + (comma ? v.toLocaleString('en-CA', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + post;
    const t0 = performance.now(), dur = 900;
    const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(target * e); if (p < 1) requestAnimationFrame(step); else el.textContent = txt; };
    el.textContent = fmt(0); requestAnimationFrame(step);
  }

  /* content enters in a soft stagger right after a page opens (not while you type in a filter) */
  let window0 = 0;
  function animateContent() {
    if (reduce) return;
    const live = performance.now() - window0 < 1600;
    const c = document.querySelector('[data-content]');
    if (!c || !live) return;
    let i = 0;
    const mark = el => { if (el.dataset.fxIn) return; el.dataset.fxIn = '1'; el.classList.add('fx-in'); el.style.setProperty('--fx-i', Math.min(i++, 12)); };
    [...c.children].forEach(el => { if (el.matches('[data-list]')) { [...el.children].forEach(mark); } else mark(el); });
    c.querySelectorAll('.table tbody tr').forEach((tr, k) => { if (k < 14 && !tr.dataset.fxIn) { tr.dataset.fxIn = '1'; tr.classList.add('fx-in'); tr.style.setProperty('--fx-i', Math.min(i++, 16)); } });
    c.querySelectorAll('.ov-grid b, .stat b, .q-ov b, .kpi b, .kn-c b').forEach(countUp);
  }

  let lastShell = null, queued = false;
  function tick() {
    queued = false;
    const top = document.querySelector('.wtop');
    if (top && top !== lastShell) { lastShell = top; window0 = performance.now(); hideTip(); }
    addSwitcher(); railTips(); animateTitle(); animateContent();
  }
  const mo = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(tick); } });
  const start = () => { const app = document.getElementById('app'); if (app) { mo.observe(app, { childList: true, subtree: true }); tick(); } };
  addEventListener('hashchange', () => { window0 = performance.now(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
