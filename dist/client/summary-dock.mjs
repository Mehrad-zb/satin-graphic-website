// Summary dock: a slim bottom bar with the order total and the page's primary button.
// It appears only while the summary panel's own button is off-screen (phones, long apparel or
// checkout pages) and hides as soon as that button is fully visible. It never computes prices or
// submits anything itself: it mirrors the panel's total text, and its button scrolls to and clicks
// the real button, so every existing hook, validation and disabled state keeps working.
// Desktop sticky panels with a .sum-foot also get their height fitted to the visible screen.
const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

export function mountSummaryDock(box, o = {}) {
  if (!box || box._summaryDock) return;
  const panel = () => box.querySelector(o.panel || '.rule-summary');
  if (!o.primary && !panel()) return;
  const primary = o.primary || (() => {
    const a = panel(), add = a?.querySelector('[data-rule-add]');
    return add && !add.hidden ? add : a?.querySelector('[data-quote]') || add;
  });
  const totals = o.totals || (() => {
    const a = panel(), t = a?.querySelector('[data-order-total]'), grand = a?.querySelector('[data-rule-price] .total');
    if (text(t?.querySelector('b'))) return [text(t.querySelector('b')), text(t.querySelector('span'))];
    if (grand) return [text(grand.lastElementChild), text(grand.firstElementChild)];
    return [text(t), ''];
  });

  const dock = document.createElement('div');
  dock.className = 'sum-dock';
  dock.setAttribute('aria-hidden', 'true'); // a duplicate of the panel's own controls; assistive tech uses the real ones
  dock.setAttribute('data-no-translate', ''); // it copies text that is already translated
  dock.innerHTML = '<div class="sum-dock-t"><b></b><small></small></div><button type="button" class="btn" tabindex="-1"></button>';
  const b = dock.querySelector('b'), small = dock.querySelector('small'), btn = dock.querySelector('button');
  document.body.append(dock);
  box._summaryDock = dock;

  let boxOn = false, footOn = false, watched = null;
  const seen = new WeakMap();
  const show = () => {
    const on = boxOn && !footOn && box.isConnected && !!btn.textContent;
    dock.classList.toggle('on', on);
    document.documentElement.classList.toggle('sum-dock-on', on);
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    for (const e of es) seen.set(e.target, e.isIntersecting && e.intersectionRatio > 0.98);
    footOn = !!(watched && seen.get(watched)); show();
  }, { threshold: [0, 0.5, 0.99, 1] }) : null;

  // desktop: until the sticky panel reaches its resting place it starts lower on the screen, so its
  // height follows its real top edge; the pinned totals + button then never fall below the fold
  let fr = 0;
  const fit = () => {
    fr = 0;
    const a = panel();
    if (!a || !a.querySelector(':scope > .sum-foot')) return;
    if (innerWidth <= 800) { a.style.removeProperty('--sum-fit'); return; }
    const top = Math.max(a.getBoundingClientRect().top, parseFloat(getComputedStyle(a).top) || 0);
    a.style.setProperty('--sum-fit', Math.max(300, Math.round(innerHeight - top - 16)) + 'px');
  };
  const req = () => { if (!fr) fr = requestAnimationFrame(fit); };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req);

  let raf = 0;
  const update = () => {
    raf = 0;
    const [big, sub] = totals();
    b.textContent = big || ''; small.textContent = sub || '';
    dock.classList.toggle('no-total', !big);
    const p = primary();
    btn.textContent = text(p);
    btn.disabled = !!p?.disabled;
    if (p !== watched) { if (io) { if (watched) io.unobserve(watched); if (p) io.observe(p); } watched = p || null; footOn = !!(p && seen.get(p)); }
    show(); fit();
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  const mo = new MutationObserver(schedule);
  mo.observe(box, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });

  btn.onclick = () => {
    const p = primary();
    if (!p) return;
    p.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    p.click();
  };

  if (io) new IntersectionObserver(es => { for (const e of es) boxOn = e.isIntersecting; show(); }, { rootMargin: '-64px 0px -40px 0px' }).observe(box);
  update();

  // the configurator can be replaced (language switch, product change): drop the dock with it
  const gone = new MutationObserver(() => {
    if (box.isConnected) return;
    dock.remove(); document.documentElement.classList.remove('sum-dock-on');
    gone.disconnect(); mo.disconnect(); io?.disconnect();
    removeEventListener('scroll', req); removeEventListener('resize', req);
  });
  gone.observe(document.body, { childList: true, subtree: true });
}
