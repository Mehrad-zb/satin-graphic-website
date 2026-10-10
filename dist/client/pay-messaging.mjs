// Buy-now-pay-later messaging under a product's total: Afterpay (Square Web Payments SDK messaging element) and
// PayPal Pay Later (PayPal's official message component, rendered unedited). Both providers decide eligibility
// themselves: if the seller, location or amount is not eligible they render nothing, and so do we.
// Only shown when /api/payments/config reports the provider connected and the owner's toggle on (Admin → Payments).
// It never changes prices: it reads the total the configurator already shows (data-amount in cents, or its en-CA text).
let cfgP = null, sqP = null;
const scripts = {};
const loadScript = src => scripts[src] ||= new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = src; s.async = true;
  const t = setTimeout(() => rej(new Error('timeout')), 15000);
  s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); delete scripts[src]; rej(new Error('load ' + src)); };
  document.head.append(s);
});
const config = () => cfgP ||= fetch('/api/payments/config', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
const squarePayments = sq => sqP ||= loadScript(sq.sdk).then(() => window.Square.payments(sq.applicationId, sq.locationId));
let n = 0;

function amountOf(el) {
  if (!el) return 0;
  if ('amount' in el.dataset) return /^\d+$/.test(el.dataset.amount) ? +el.dataset.amount : 0; // set by the configurator: '' = not payable online
  const b = el.querySelector('b') || el, m = (b.textContent || '').replace(/\s/g, '').match(/\$([\d,]+\.\d{2})/);
  return m ? Math.round(parseFloat(m[1].replace(/,/g, '')) * 100) : 0;
}

export async function mountPayMessaging(box, o = {}) {
  if (!box || box._payMsg) return;
  box._payMsg = true;
  const cfg = await config();
  if (!cfg.square && !cfg.paypal) return;
  if (!document.getElementById('pay-msg-css')) {
    const st = document.createElement('style'); st.id = 'pay-msg-css';
    st.textContent = '.pay-msgs{display:grid;gap:6px;margin:4px 0 12px;font-size:13px;line-height:1.35}.pay-msgs[hidden],.pay-msgs>[hidden]{display:none}.pay-msgs>div{min-height:18px}';
    document.head.append(st);
  }
  const id = 'pm' + (++n);
  const wrap = document.createElement('div');
  wrap.className = 'pay-msgs'; wrap.hidden = true;
  wrap.setAttribute('data-no-translate', '');
  wrap.innerHTML = `${cfg.square ? `<div id="${id}-ap" class="pay-msg-ap" hidden></div>` : ''}${cfg.paypal ? `<div class="pay-msg-pp" hidden></div>` : ''}`;
  const totalEl = () => box.querySelector(o.total || '[data-order-total]');
  // shown right under the visible estimated total (the pinned summary footer), else under the total itself
  const anchor = () => box.querySelector(o.anchor || '.sum-foot > [data-rule-price]') || totalEl();
  let last = -1, timer = 0, ap = null, run = 0;

  const draw = async () => {
    timer = 0;
    const t = totalEl();
    if (!t) return;
    const at = anchor();
    if (at && wrap.previousElementSibling !== at) at.after(wrap); // the configurator may rebuild its summary
    const amt = amountOf(t);
    if (amt === last) return;
    last = amt; const my = ++run;
    if (amt <= 0) { wrap.hidden = true; return; }
    const value = (amt / 100).toFixed(2);
    if (cfg.square) {
      const el = wrap.querySelector('.pay-msg-ap');
      try {
        const payments = await squarePayments(cfg.square);
        if (my !== run) return;
        try { await ap?.destroy(); } catch {}
        ap = null;
        const req = payments.paymentRequest({ countryCode: 'CA', currencyCode: 'CAD', total: { amount: value, label: 'Total' }, requestShippingContact: false, requestBillingContact: false });
        const inst = await payments.afterpayClearpay(req); // throws when the seller / amount is not eligible
        if (my !== run) { try { await inst.destroy(); } catch {} return; }
        ap = inst; el.hidden = false; wrap.hidden = false;
        // each price gets its own fresh slot: an older render that finishes late lands in a detached slot, never next to the new one
        const slot = document.createElement('div'); slot.id = id + '-ap' + my; el.replaceChildren(slot);
        await inst.attachMessaging('#' + slot.id, { modalLinkStyle: 'circled-info-icon' });
        if (my !== run) slot.remove();
      } catch (e) { if (my === run) { el.hidden = true; el.innerHTML = ''; } }
    }
    if (cfg.paypal) {
      const el = wrap.querySelector('.pay-msg-pp');
      try {
        await loadScript('https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(cfg.paypal.clientId) + '&currency=CAD&components=messages&enable-funding=paylater');
        if (my !== run || !window.paypal?.Messages) return;
        el.hidden = false; wrap.hidden = false;
        const slot = document.createElement('div'); el.replaceChildren(slot);
        await window.paypal.Messages({ amount: value, currency: 'CAD', placement: 'product', style: { layout: 'text', logo: { type: 'inline' }, text: { size: 12 } } }).render(slot);
        if (my !== run) slot.remove();
      } catch (e) { if (my === run) el.hidden = true; }
    }
    if (wrap.querySelectorAll(':scope>div:not([hidden])').length === 0) wrap.hidden = true;
  };
  const schedule = () => { if (!timer) timer = setTimeout(draw, 450); };
  new MutationObserver(muts => { if (muts.every(m => wrap.contains(m.target))) return; schedule(); })
    .observe(box, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-amount'] });
  schedule();
}
