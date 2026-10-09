/* Satin customer accounts: sign-in page (/satin/login/, /satin/register/) and My account (/satin/account/).
   Talks to /api/customer/* (hp/php/satin-new/customer.php). Mounted by the main site bundle. */
const API = '/api/customer/';
const LANG = (location.pathname.match(/^\/satin\/(fa|fr|es)(?=\/|$)/) || [])[1] || 'en';
const BASE = '/satin' + (LANG === 'en' ? '' : '/' + LANG);
const FA = {
  'Sign in': 'ورود', 'Create account': 'ساخت حساب', 'Your account': 'حساب شما', 'Welcome back.': 'خوش برگشتید.', 'Create your account.': 'حساب خود را بسازید.',
  'Continue with Google': 'ادامه با Google', 'Continue with Facebook': 'ادامه با Facebook', 'or': 'یا', 'Email': 'ایمیل', 'Password': 'رمز عبور', 'Full name': 'نام و نام خانوادگی',
  'Phone (optional)': 'تلفن (اختیاری)', 'Forgot password?': 'رمز را فراموش کرده‌اید؟', 'New here?': 'حساب ندارید؟', 'Already have an account?': 'حساب دارید؟',
  'Reset your password': 'بازیابی رمز عبور', 'Send reset link': 'ارسال لینک بازیابی', 'Back to sign in': 'بازگشت به ورود', 'Choose a new password': 'رمز جدید را انتخاب کنید',
  'New password': 'رمز جدید', 'Save new password': 'ذخیرهٔ رمز جدید', 'Confirm your email': 'تأیید ایمیل', 'Confirm and sign in': 'تأیید و ورود',
  'At least 10 characters, with letters and numbers.': 'حداقل ۱۰ نویسه، شامل حرف و عدد.', 'Dashboard': 'داشبورد', 'Orders': 'سفارش‌ها', 'Invoices': 'فاکتورها',
  'Quotes & bookings': 'استعلام‌ها و نوبت‌ها', 'Profile': 'پروفایل', 'Sign out': 'خروج', 'Recent orders': 'سفارش‌های اخیر', 'View all orders': 'همهٔ سفارش‌ها',
  'Order': 'سفارش', 'Date': 'تاریخ', 'Items': 'اقلام', 'Status': 'وضعیت', 'Payment': 'پرداخت', 'Total': 'جمع کل', 'View': 'مشاهده', 'Re-order': 'سفارش مجدد',
  'Pay now': 'پرداخت', 'Paid': 'پرداخت شده', 'Awaiting payment': 'در انتظار پرداخت', 'Refunded': 'بازپرداخت شده', 'Cancelled': 'لغو شده', 'Received': 'دریافت شد',
  'Artwork check': 'بررسی فایل', 'In production': 'در حال تولید', 'Ready': 'آماده', 'Completed': 'تکمیل شد', 'Open': 'باز', 'Overdue': 'سررسید گذشته', 'Partly paid': 'پرداخت جزئی',
  'Balance': 'مانده', 'Due': 'سررسید', 'Save changes': 'ذخیرهٔ تغییرات', 'Company (optional)': 'شرکت (اختیاری)', 'Street address': 'آدرس', 'Unit / suite': 'واحد',
  'City': 'شهر', 'Province': 'استان', 'Postal code': 'کد پستی', 'Change password': 'تغییر رمز عبور', 'Current password': 'رمز فعلی', 'Sign-in methods': 'روش‌های ورود',
  'Connected': 'متصل', 'Connect': 'اتصال', 'Email and password': 'ایمیل و رمز عبور', 'Not set': 'تنظیم نشده', 'Set a password': 'تعیین رمز عبور',
  'No orders yet.': 'هنوز سفارشی ندارید.', 'No invoices yet.': 'هنوز فاکتوری ندارید.', 'No quote or booking requests yet.': 'هنوز استعلام یا نوبتی ندارید.',
  'Start an order': 'شروع سفارش', 'Get a quote': 'درخواست قیمت', 'Design Studio': 'استودیو طراحی', 'Back to orders': 'بازگشت به سفارش‌ها',
  'Delivery': 'تحویل', 'Subtotal': 'جمع جزء', 'Discount': 'تخفیف', 'Shipping': 'ارسال', 'Tax': 'مالیات', 'Artwork & mockups': 'فایل‌ها و پیش‌نمایش',
  'Open orders': 'سفارش‌های باز', 'Unpaid invoices': 'فاکتورهای پرداخت‌نشده', 'Hello': 'سلام', 'Loading…': 'در حال بارگذاری…', 'Saved.': 'ذخیره شد.',
  'Quantity': 'تعداد', 'Size': 'اندازه', 'Design service requested': 'درخواست خدمات طراحی', 'Pay or view': 'مشاهده / پرداخت', 'Reference': 'شماره', 'Service': 'خدمت',
  'Your email is confirmed. Welcome!': 'ایمیل شما تأیید شد. خوش آمدید!', 'Confirm password': 'تکرار رمز', 'Passwords do not match.': 'رمزها یکسان نیستند.',
  'Saved designs': 'طرح‌های ذخیره‌شده', 'Edit': 'ویرایش', 'Order this design': 'سفارش این طرح', 'Download PDF': 'دانلود PDF', 'Mockup PNG': 'پیش‌نمایش PNG', 'Delete': 'حذف',
  'Approved': 'تأیید شده', 'Draft': 'پیش‌نویس', 'No saved designs yet.': 'هنوز طرحی ذخیره نکرده‌اید.', 'Open Design Studio': 'باز کردن استودیو طراحی', 'Delete this design?': 'این طرح حذف شود؟',
  'I agree to the': 'با این موارد موافقم:', 'Terms': 'شرایط', 'Privacy Policy': 'حریم خصوصی', 'Customer area': 'ناحیهٔ مشتری',
};
const t = s => (LANG === 'fa' && FA[s]) || s;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (c, cur = 'CAD') => new Intl.NumberFormat(LANG === 'fa' ? 'en-CA' : LANG + '-CA', { style: 'currency', currency: cur }).format((c || 0) / 100);
const day = s => { if (!s) return '—'; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s); return isNaN(d) ? s : d.toLocaleDateString(LANG === 'fa' ? 'fa-IR' : LANG + '-CA', { year: 'numeric', month: 'short', day: 'numeric' }); };
const safeReturn = v => /^\/satin(?:\/[a-z0-9-]+)*\/?(?:\?[a-z0-9=&_-]*)?$/i.test(v || '') ? v : '';
const ERRORS = {
  cancelled: 'Sign-in was cancelled.', state: 'Your sign-in session expired. Please try again.', provider: 'We could not complete the sign-in with that provider. Please try again or use email.',
  email: 'We need a verified email address from your Google / Facebook account. Please sign in with email instead.', unavailable: 'That sign-in option is not available right now.',
  link: 'This link is invalid, already used or expired. Sign in to get a new one.', disabled: 'This account is disabled. Please contact us.', linked: 'That Google / Facebook profile is already linked to a different Satin account.',
};
const STAGES = ['new', 'artwork_check', 'in_production', 'ready', 'completed'];
const STAGE_LABEL = { new: 'Received', artwork_check: 'Artwork check', in_production: 'In production', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' };
const PAY_LABEL = { paid: 'Paid', awaiting_payment: 'Awaiting payment', refunded: 'Refunded', cancelled: 'Cancelled' };
const INV_LABEL = { paid: 'Paid', open: 'Open', overdue: 'Overdue', partial: 'Partly paid' };
const ICON = {
  google: '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>',
};

let ME = null, CSRF = '', PROVIDERS = { google: false, facebook: false, email: true }, OVERVIEW = null;

async function api(path, data) {
  const opt = data === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF }, body: JSON.stringify(data) };
  const r = await fetch(API + path, opt);
  let v = {}; try { v = await r.json(); } catch { }
  if (!r.ok) { const e = Error(v.error || 'Something went wrong. Please try again.'); e.status = r.status; e.data = v; throw e; }
  return v;
}
function ensureCss() {
  if (document.querySelector('link[data-account-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/account-ui.css?v=2'; l.dataset.accountCss = ''; document.head.append(l);
}
const msgBox = (el, text, ok = false) => { if (el) el.innerHTML = text ? `<div class="acct-msg ${ok ? 'ok' : 'err'}" role="${ok ? 'status' : 'alert'}">${esc(text)}</div>` : ''; };
async function busy(btn, fn) { const old = btn?.textContent; if (btn) { btn.disabled = true; } try { await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = old; } } }
function setHint(on) { document.cookie = 'satin_acct=' + (on ? '1' : '') + '; path=/; samesite=lax' + (on ? '; max-age=' + 30 * 86400 : '; max-age=0'); }

export async function mount(main, path) {
  ensureCss();
  const host = main.querySelector('.page-enter') || main;
  host.innerHTML = `<section class="sec acct-sec"><div class="wrap"><p class="small">${t('Loading…')}</p></div></section>`;
  const q = new URLSearchParams(location.search);
  try { const me = await api('me'); ME = me.customer; CSRF = me.csrf || ''; PROVIDERS = me.providers || PROVIDERS; }
  catch { host.innerHTML = `<section class="sec acct-sec"><div class="wrap"><div class="acct-msg err">Accounts are temporarily unavailable. Please try again later or call 905-962-6222.</div></div></section>`; return; }
  setHint(!!ME);
  if (path === '/account') {
    if (!ME) { location.replace(BASE + '/login/?return=' + encodeURIComponent(location.pathname + location.search)); return; }
    return accountView(host, q);
  }
  if (ME && !q.get('reset')) { const err = q.get('error'); location.replace(err ? BASE + '/account/?tab=profile&error=' + encodeURIComponent(err) : (safeReturn(q.get('return')) || BASE + '/account/')); return; }
  const mode = q.get('reset') ? 'reset' : q.get('verify') ? 'verify' : q.get('forgot') ? 'forgot' : path === '/register' ? 'signup' : 'login';
  const token = q.get('reset') || q.get('verify') || '';
  if (token) { q.delete('reset'); q.delete('verify'); history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '')); } // keep the one-time token out of history and referrers
  loginView(host, mode, { token, ret: safeReturn(q.get('return')), error: ERRORS[q.get('error')] || '' });
}

/* ---------------- sign in / sign up ---------------- */
function loginView(host, mode, ctx) {
  const ret = ctx.ret;
  const social = (PROVIDERS.google || PROVIDERS.facebook) && (mode === 'login' || mode === 'signup') ? `<div class="acct-social">
      ${PROVIDERS.google ? `<a class="acct-sbtn google" href="/api/customer/oauth/google/start${ret ? '?return=' + encodeURIComponent(ret) : ''}">${ICON.google}<span>${t('Continue with Google')}</span></a>` : ''}
      ${PROVIDERS.facebook ? `<a class="acct-sbtn facebook" href="/api/customer/oauth/facebook/start${ret ? '?return=' + encodeURIComponent(ret) : ''}">${ICON.facebook}<span>${t('Continue with Facebook')}</span></a>` : ''}
    </div>${PROVIDERS.email !== false ? `<div class="acct-or"><span>${t('or')}</span></div>` : ''}` : '';
  const pw = (id, label, auto, hint = '') => `<label class="field"><span class="fl">${t(label)}</span><span class="acct-pw"><input class="inp" id="${id}" name="${id}" type="password" autocomplete="${auto}" required maxlength="200"><button type="button" class="acct-eye" data-eye aria-label="Show password">👁</button></span>${hint ? `<span class="tiny">${t(hint)}</span>` : ''}</label>`;
  const email = `<label class="field"><span class="fl">${t('Email')}</span><input class="inp" name="email" type="email" autocomplete="email" required maxlength="190"></label>`;
  const tabs = mode === 'login' || mode === 'signup' ? `<div class="acct-switch" role="tablist"><button type="button" role="tab" aria-selected="${mode === 'login'}" data-mode="login">${t('Sign in')}</button><button type="button" role="tab" aria-selected="${mode === 'signup'}" data-mode="signup">${t('Create account')}</button></div>` : '';
  let form = '';
  if (mode === 'login') form = `<form data-f="login" novalidate>${email}${pw('password', 'Password', 'current-password')}<button class="btn block" type="submit">${t('Sign in')}</button><p class="small acct-center"><a class="link" href="#" data-mode="forgot">${t('Forgot password?')}</a></p></form>`;
  if (mode === 'signup') form = `<form data-f="signup" novalidate><label class="field"><span class="fl">${t('Full name')}</span><input class="inp" name="name" autocomplete="name" required maxlength="120"></label>${email}
      <label class="field"><span class="fl">${t('Phone (optional)')}</span><input class="inp" name="phone" type="tel" autocomplete="tel" maxlength="40"></label>${pw('password', 'Password', 'new-password', 'At least 10 characters, with letters and numbers.')}
      <input type="text" name="website" class="acct-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="acct-check"><input type="checkbox" name="terms" required><span>${t('I agree to the')} <a class="link" href="${BASE}/terms-and-conditions/" target="_blank">${t('Terms')}</a> · <a class="link" href="${BASE}/privacy-policy/" target="_blank">${t('Privacy Policy')}</a></span></label>
      <button class="btn block" type="submit">${t('Create account')}</button></form>`;
  if (mode === 'forgot') form = `<form data-f="forgot" novalidate><p class="small">Enter the email of your account. We will send you a link to choose a new password.</p>${email}<button class="btn block" type="submit">${t('Send reset link')}</button><p class="small acct-center"><a class="link" href="#" data-mode="login">${t('Back to sign in')}</a></p></form>`;
  if (mode === 'reset') form = `<form data-f="reset" novalidate>${pw('password', 'New password', 'new-password', 'At least 10 characters, with letters and numbers.')}${pw('password2', 'Confirm password', 'new-password')}<button class="btn block" type="submit">${t('Save new password')}</button><p class="small acct-center"><a class="link" href="#" data-mode="forgot">Request a new link</a></p></form>`;
  if (mode === 'verify') form = `<form data-f="verify" novalidate><p class="small">You opened the confirmation link in a different browser. For your security, enter the password you chose when you signed up.</p>${pw('password', 'Password', 'current-password')}<button class="btn block" type="submit">${t('Confirm and sign in')}</button><p class="small acct-center"><a class="link" href="#" data-mode="forgot">${t('Forgot password?')}</a></p></form>`;
  const title = { login: 'Welcome back.', signup: 'Create your account.', forgot: 'Reset your password', reset: 'Choose a new password', verify: 'Confirm your email' }[mode];
  host.innerHTML = `<section class="sec acct-sec"><div class="wrap"><div class="acct-auth">
    <div class="auth acct-card"><span class="eyebrow">${t('Your account')}</span><h1 class="d2 acct-h1">${t(title)}</h1>${tabs}<div data-msg>${ctx.error ? `<div class="acct-msg err" role="alert">${esc(ctx.error)}</div>` : ''}</div>
      ${PROVIDERS.email === false && (mode === 'login' || mode === 'signup') ? social.replace(/<div class="acct-or">.*$/, '') : social + form}</div>
    <aside class="acct-why"><h2>${t('Customer area')}</h2><ul><li>Track every order — artwork check, production, ready for pickup.</li><li>Pay invoices and see your history in one place.</li><li>Re-order the same prints in two clicks.</li><li>Faster checkout with your saved details.</li></ul><p class="tiny">Guest checkout is always available — an account is optional.</p></aside>
  </div></div></section>`;
  const msg = host.querySelector('[data-msg]');
  host.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); const m = b.dataset.mode; history.replaceState(history.state, '', (m === 'signup' ? BASE + '/register/' : BASE + '/login/') + (m === 'forgot' ? '?forgot=1' : '') + (ret && m !== 'forgot' ? '?return=' + encodeURIComponent(ret) : '')); loginView(host, m, { ...ctx, error: '' }); host.querySelector('input')?.focus(); }));
  host.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; }));
  const f = host.querySelector('form[data-f]'); if (!f) return;
  f.addEventListener('submit', e => {
    e.preventDefault(); msgBox(msg, '');
    const v = Object.fromEntries(new FormData(f)); const btn = f.querySelector('[type=submit]');
    if (!f.checkValidity()) { msgBox(msg, mode === 'signup' && !f.terms?.checked ? 'Accept the Terms and Privacy Policy to continue.' : 'Please complete the highlighted fields.'); f.reportValidity(); return; }
    busy(btn, async () => {
      try {
        if (mode === 'login') { const r = await api('login', { email: v.email, password: v.password, return: ret }); CSRF = r.csrf; setHint(true); location.assign(ret || BASE + '/account/'); return; }
        if (mode === 'signup') { const r = await api('signup', { name: v.name, email: v.email, phone: v.phone, password: v.password, terms: !!f.terms.checked, website: v.website, return: ret }); f.innerHTML = `<div class="acct-msg ok" role="status">${esc(r.message)}</div><p class="small">Didn't get it? Check spam, or <a class="link" href="#" data-resend>send it again</a>.</p>`; f.querySelector('[data-resend]').onclick = async ev => { ev.preventDefault(); const x = await api('resend', { email: v.email }).catch(er => ({ message: er.message })); msgBox(msg, x.message, true); }; return; }
        if (mode === 'forgot') { const r = await api('forgot', { email: v.email }); f.innerHTML = `<div class="acct-msg ok" role="status">${esc(r.message)}</div><p class="small acct-center"><a class="link" href="${BASE}/login/">${t('Back to sign in')}</a></p>`; return; }
        if (mode === 'reset') { if (v.password !== v.password2) throw Error(t('Passwords do not match.')); await api('reset', { token: ctx.token, password: v.password }); setHint(true); location.assign(BASE + '/account/?reset=1'); return; }
        if (mode === 'verify') { await api('verify', { token: ctx.token, password: v.password }); setHint(true); location.assign((ret || BASE + '/account/') + ((ret || '').includes('?') ? '&' : '?') + 'welcome=1'); return; }
      } catch (er) { msgBox(msg, er.message); }
    });
  });
}

/* ---------------- My account ---------------- */
const TABS = [['dashboard', 'Dashboard'], ['orders', 'Orders'], ['designs', 'Saved designs'], ['invoices', 'Invoices'], ['requests', 'Quotes & bookings'], ['profile', 'Profile']];
function go(params) { const u = new URL(BASE + '/account/', location.origin); for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v); history.pushState(null, '', u.pathname + u.search); }
async function accountView(host, q) {
  const tab = TABS.some(x => x[0] === q.get('tab')) ? q.get('tab') : (q.get('order') ? 'orders' : 'dashboard');
  host.innerHTML = `<section class="sec acct-sec"><div class="wrap"><div class="acct-head"><div><span class="eyebrow">${t('Your account')}</span><h1 class="d2 acct-h1">${t('Hello')}, ${esc((ME.name || '').split(' ')[0] || ME.email)}</h1><p class="small">${esc(ME.email)}</p></div>
    <a class="btn sm" href="${BASE}/print-shop/">${t('Start an order')}</a></div>
    <div class="acct-layout"><nav class="acct-nav" aria-label="${t('Your account')}">${TABS.map(([k, l]) => `<a href="${BASE}/account/?tab=${k}" data-tab="${k}" ${k === tab ? 'aria-current="page"' : ''}>${t(l)}</a>`).join('')}<button type="button" data-logout>${t('Sign out')}</button></nav>
    <div class="acct-main" data-main><p class="small">${t('Loading…')}</p></div></div></div></section>`;
  host.querySelectorAll('[data-tab]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go({ tab: a.dataset.tab }); accountView(host, new URLSearchParams(location.search)); }));
  host.querySelector('[data-logout]').onclick = async () => { try { await api('logout', {}); } catch { } setHint(false); ME = null; OVERVIEW = null; location.assign(BASE + '/'); };
  const main = host.querySelector('[data-main]');
  const flash = q.get('welcome') ? t('Your email is confirmed. Welcome!') : q.get('reset') ? 'Your new password is saved.' : ERRORS[q.get('error')] || '';
  try {
    if (!OVERVIEW || q.get('welcome') || q.get('refresh')) OVERVIEW = await api('overview');
    ME = OVERVIEW.customer;
    if (q.get('order')) await orderView(main, q.get('order'), host);
    else if (tab === 'designs') await designsView(main, host);
    else ({ dashboard, orders: ordersView, designs: designsView, invoices: invoicesView, requests: requestsView, profile: profileView })[tab](main, host);
    if (flash) main.insertAdjacentHTML('afterbegin', `<div class="acct-msg ${q.get('error') ? 'err' : 'ok'}" role="status">${esc(flash)}</div>`);
  } catch (e) {
    if (e.status === 401) { setHint(false); location.replace(BASE + '/login/?return=' + encodeURIComponent(location.pathname + location.search)); return; }
    main.innerHTML = `<div class="acct-msg err">${esc(e.message)}</div>`;
  }
  main.querySelectorAll('[data-open-order]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go({ order: a.dataset.openOrder }); accountView(host, new URLSearchParams(location.search)); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
}
const chip = (text, cls = '') => `<span class="acct-chip ${cls}">${esc(t(text))}</span>`;
const stageChip = s => chip(STAGE_LABEL[s] || s, s === 'cancelled' ? 'bad' : s === 'completed' || s === 'ready' ? 'good' : 'info');
const payChip = p => chip(PAY_LABEL[p] || p, p === 'paid' ? 'good' : p === 'awaiting_payment' ? 'warn' : 'bad');
const orderLink = o => `<a class="link" href="${BASE}/account/?order=${encodeURIComponent(o.id)}" data-open-order="${esc(o.id)}">${esc(o.reference)}</a>`;
function ordersTable(list) {
  if (!list.length) return `<div class="acct-empty"><p>${t('No orders yet.')}</p><a class="btn sm" href="${BASE}/print-shop/">${t('Start an order')}</a></div>`;
  return `<div class="acct-table" role="table"><div class="acct-tr acct-th" role="row"><span>${t('Order')}</span><span>${t('Date')}</span><span>${t('Items')}</span><span>${t('Status')}</span><span>${t('Payment')}</span><span class="num">${t('Total')}</span></div>
    ${list.map(o => `<div class="acct-tr" role="row"><span data-l="${t('Order')}">${orderLink(o)}</span><span data-l="${t('Date')}">${day(o.createdAt)}</span><span data-l="${t('Items')}" class="acct-items">${esc(o.items.slice(0, 2).join(', '))}${o.count > 2 ? ` +${o.count - 2}` : ''}</span><span data-l="${t('Status')}">${stageChip(o.stage)}</span><span data-l="${t('Payment')}">${payChip(o.payment)}</span><span data-l="${t('Total')}" class="num"><b>${money(o.total, o.currency)}</b></span></div>`).join('')}</div>`;
}
function dashboard(main) {
  const o = OVERVIEW.orders, inv = OVERVIEW.invoices;
  const open = o.filter(x => !['completed', 'cancelled'].includes(x.stage)).length, unpaid = inv.filter(i => i.balance > 0);
  const due = o.filter(x => x.payment === 'awaiting_payment' && x.stage !== 'cancelled');
  main.innerHTML = `<div class="acct-stats"><div class="acct-stat"><b>${open}</b><span>${t('Open orders')}</span></div><div class="acct-stat"><b>${due.length}</b><span>${t('Awaiting payment')}</span></div><div class="acct-stat"><b>${money(unpaid.reduce((n, i) => n + i.balance, 0))}</b><span>${t('Unpaid invoices')}</span></div></div>
    ${!ME.emailVerified ? '<div class="acct-msg err">Confirm your email address to see orders placed with it.</div>' : ''}
    <div class="acct-block"><div class="acct-bh"><h2>${t('Recent orders')}</h2>${o.length > 5 ? `<a class="link" href="${BASE}/account/?tab=orders" data-tab-link="orders">${t('View all orders')}</a>` : ''}</div>${ordersTable(o.slice(0, 5))}</div>
    ${unpaid.length ? `<div class="acct-block"><div class="acct-bh"><h2>${t('Unpaid invoices')}</h2></div>${invoiceTable(unpaid)}</div>` : ''}
    <div class="acct-quick"><a class="card hov" href="${BASE}/print-shop/"><b>${t('Start an order')}</b><span class="small">Business cards, banners, signs, decals…</span></a><a class="card hov" href="${BASE}/design-studio/"><b>${t('Design Studio')}</b><span class="small">Design online and approve your proof.</span></a><a class="card hov" href="${BASE}/contact/"><b>${t('Get a quote')}</b><span class="small">Vehicle wraps, window graphics and custom jobs.</span></a></div>`;
  main.querySelector('[data-tab-link]')?.addEventListener('click', e => { e.preventDefault(); main.closest('.acct-sec').querySelector('[data-tab="orders"]').click(); });
}
function ordersView(main) { main.innerHTML = `<div class="acct-block"><div class="acct-bh"><h2>${t('Orders')}</h2></div>${ordersTable(OVERVIEW.orders)}</div>`; }
function invoiceTable(list) {
  if (!list.length) return `<div class="acct-empty"><p>${t('No invoices yet.')}</p></div>`;
  return `<div class="acct-table inv" role="table"><div class="acct-tr acct-th" role="row"><span>#</span><span>${t('Date')}</span><span>${t('Due')}</span><span>${t('Status')}</span><span class="num">${t('Total')}</span><span class="num">${t('Balance')}</span><span></span></div>
    ${list.map(i => `<div class="acct-tr" role="row"><span data-l="#"><b>${esc(i.number)}</b>${i.title ? `<small class="tiny"> ${esc(i.title)}</small>` : ''}</span><span data-l="${t('Date')}">${day(i.issueDate)}</span><span data-l="${t('Due')}">${day(i.dueDate)}</span><span data-l="${t('Status')}">${chip(INV_LABEL[i.status] || i.status, i.status === 'paid' ? 'good' : i.status === 'overdue' ? 'bad' : 'warn')}</span><span data-l="${t('Total')}" class="num">${money(i.total, i.currency)}</span><span data-l="${t('Balance')}" class="num"><b>${money(i.balance, i.currency)}</b></span><span class="num"><a class="btn sm ${i.balance > 0 ? '' : 'ghost'}" href="${esc(i.url)}">${i.balance > 0 ? t('Pay or view') : t('View')}</a></span></div>`).join('')}</div>`;
}
function invoicesView(main) { main.innerHTML = `<div class="acct-block"><div class="acct-bh"><h2>${t('Invoices')}</h2></div>${invoiceTable(OVERVIEW.invoices)}</div>`; }
function requestsView(main) {
  const r = OVERVIEW.requests;
  main.innerHTML = `<div class="acct-block"><div class="acct-bh"><h2>${t('Quotes & bookings')}</h2><a class="link" href="${BASE}/contact/">${t('Get a quote')}</a></div>${r.length ? `<div class="acct-table req" role="table"><div class="acct-tr acct-th" role="row"><span>${t('Reference')}</span><span>${t('Date')}</span><span>${t('Service')}</span><span>${t('Status')}</span></div>
    ${r.map(x => `<div class="acct-tr" role="row"><span data-l="${t('Reference')}"><b>${esc(x.reference)}</b></span><span data-l="${t('Date')}">${day(x.createdAt)}${x.date ? `<small class="tiny"> → ${esc(x.date)} ${esc(x.time)}</small>` : ''}</span><span data-l="${t('Service')}">${esc(x.service)} <small class="tiny">${esc(x.type === 'booking' ? 'Booking' : 'Quote')}</small></span><span data-l="${t('Status')}">${chip(x.statusLabel, x.status === 'cancelled' ? 'bad' : x.status === 'completed' || x.status === 'confirmed' ? 'good' : 'info')}</span></div>`).join('')}</div>` : `<div class="acct-empty"><p>${t('No quote or booking requests yet.')}</p></div>`}</div>`;
}
async function orderView(main, id, host) {
  const { order: o } = await api('order?id=' + encodeURIComponent(id));
  const cancelled = o.stage === 'cancelled', at = STAGES.indexOf(o.stage);
  const steps = cancelled ? `<div class="acct-msg err">${t('Cancelled')}</div>` : `<ol class="acct-steps">${STAGES.map((s, n) => `<li class="${n < at ? 'done' : n === at ? 'now' : ''}" ${n === at ? 'aria-current="step"' : ''}><span>${n + 1}</span>${esc(t(STAGE_LABEL[s]))}${o.history.filter(h => h.stage === s).slice(-1).map(h => `<small>${day(h.at)}</small>`).join('')}</li>`).join('')}</ol>`;
  const fileUrl = (f, inline) => `/api/customer/file?order=${encodeURIComponent(o.id)}&id=${encodeURIComponent(f.id)}${inline ? '&inline=1' : ''}`;
  const a = o.address || {};
  main.innerHTML = `<p><a class="link" href="${BASE}/account/?tab=orders" data-back>← ${t('Back to orders')}</a></p>
    <div class="acct-block"><div class="acct-bh"><div><h2>${t('Order')} ${esc(o.reference)}</h2><p class="small">${day(o.createdAt)} · ${o.count} ${t('Items').toLowerCase()}</p></div><div class="acct-acts">${payChip(o.payment)} ${o.payUrl ? `<a class="btn sm red" href="${esc(o.payUrl)}" rel="noopener">${t('Pay now')}</a>` : ''}<button class="btn sm ghost" data-reorder>${t('Re-order')}</button></div></div>
    ${steps}<div data-ro-msg></div></div>
    <div class="acct-block">${o.items.map(i => `<div class="acct-item"><div class="acct-thumbs">${i.images.length ? i.images.slice(0, 3).map(f => `<a href="${fileUrl(f, true)}" target="_blank" rel="noopener" title="${esc(f.name)}"><img src="${fileUrl(f, true)}" alt="${esc(f.role)}" loading="lazy"></a>`).join('') : `<div class="acct-noimg">${i.files.length ? 'PDF' : '—'}</div>`}</div>
      <div class="acct-idet"><h3>${esc(i.jobName || i.name)}</h3>${i.jobName ? `<p class="tiny">${esc(i.name)}</p>` : ''}<p class="small">${t('Quantity')}: ${esc(i.quantity)}${i.width && i.width !== '—' ? ` · ${t('Size')}: ${esc(i.width)} × ${esc(i.height)} in` : ''}${i.sides ? ` · ${esc(i.sides)} side(s)` : ''}</p>
        ${i.choices.length ? `<ul class="acct-choices">${i.choices.map(c => `<li><span>${esc(c.label)}</span> ${esc(c.text)}</li>`).join('')}</ul>` : ''}${i.designRequested ? `<p class="tiny">${t('Design service requested')}</p>` : ''}
        ${i.files.length ? `<p class="acct-files">${i.files.map(f => `<a class="link" href="${fileUrl(f, false)}">${esc(f.name)}</a>`).join(' ')}</p>` : ''}${i.path ? `<p><a class="link" href="${esc(i.path)}">Order this product again with changes</a></p>` : ''}</div>
      <div class="acct-iprice">${money(i.price, o.currency)}</div></div>`).join('')}
    <div class="acct-totals"><div><span>${t('Subtotal')}</span><b>${money(o.subtotal)}</b></div>${o.discount ? `<div><span>${t('Discount')} ${esc(o.coupon)}</span><b>−${money(o.discount)}</b></div>` : ''}<div><span>${t('Shipping')} ${o.shippingMethod ? '· ' + esc(o.shippingMethod) : ''}</span><b>${money(o.shipping)}</b></div><div><span>${t('Tax')} ${o.taxRate ? o.taxRate + '%' : ''}</span><b>${money(o.tax)}</b></div><div class="grand"><span>${t('Total')} · CAD</span><b>${money(o.total)}</b></div></div></div>
    <div class="acct-block acct-addr"><h3>${t('Delivery')}</h3><p class="small">${esc(a.name || '')}${a.company ? '<br>' + esc(a.company) : ''}<br>${esc(a.street1 || '')} ${esc(a.street2 || '')}<br>${esc(a.city || '')}${a.state ? ', ' + esc(a.state) : ''} ${esc(a.zip || '')}${a.phone ? '<br>' + esc(a.phone) : ''}</p>${o.notes ? `<p class="small"><b>Notes:</b> ${esc(o.notes)}</p>` : ''}<p class="tiny">Questions about this order? Call (905) 962-6222 or email info@satingraphic.ca with reference ${esc(o.reference)}.</p></div>`;
  main.querySelector('[data-back]').addEventListener('click', e => { e.preventDefault(); host.querySelector('[data-tab="orders"]').click(); });
  const rb = main.querySelector('[data-reorder]');
  rb.addEventListener('click', () => busy(rb, async () => {
    const box = main.querySelector('[data-ro-msg]');
    try {
      const r = await api('reorder', { id: o.id });
      const notes = [r.priceChanged ? 'Prices are recalculated at today’s rates.' : '', r.needsArtwork ? `${r.needsArtwork} item(s) need artwork again — open the product page to upload it.` : '', r.skipped.length ? 'Not added: ' + r.skipped.join(', ') + '.' : ''].filter(Boolean).join(' ');
      box.innerHTML = `<div class="acct-msg ok" role="status">${r.added ? `${r.added} item(s) added to your cart.` : 'These items are already in your cart.'} ${esc(notes)} <a class="btn sm" href="/satin/checkout/">Go to checkout</a></div>`;
    } catch (e) { msgBox(box, e.message); }
  }));
}
/* ---------------- Design Studio designs saved to the account ---------------- */
let PRODUCTS = null;
const loadProducts = async () => PRODUCTS || (PRODUCTS = (await import('/studio/model.mjs')).PRODUCTS);
const local = p => (p || '').replace(/^\/satin(?=\/|$)/, BASE);
const designFile = (d, id, inline) => `/api/customer/design-file?design=${encodeURIComponent(d.id)}&id=${encodeURIComponent(id)}${inline ? '&inline=1' : ''}`;
async function blobURL(url) { const r = await fetch(url, { credentials: 'same-origin' }); if (!r.ok) throw Error('Could not load the file.'); const b = await r.blob(); return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result); f.onerror = rej; f.readAsDataURL(b); }); }
async function designsView(main) {
  const [{ designs }, products] = await Promise.all([api('designs'), loadProducts().catch(() => [])]);
  const prod = id => products.find(p => p.id === id);
  const nameOf = d => { const p = prod(d.productId); return p ? (p.group === 'Apparel' ? p.name.split('|')[0].trim() : p.name) : d.productId; };
  const card = d => { const img = d.thumb || d.mockup;
    return `<article class="acct-design" data-design="${esc(d.id)}"><div class="acct-design-img">${img ? `<img src="${designFile(d, img, true)}" alt="${esc(nameOf(d))}" loading="lazy">` : '<span>—</span>'}</div>
      <div class="acct-design-body"><h3 data-no-translate>${esc(nameOf(d))}</h3><p class="small">${day(d.updatedAt)} · ${d.approved ? chip('Approved', 'good') : chip('Draft', 'info')}</p>
      <div class="acct-design-acts"><button class="btn sm" data-dact="order">${t('Order this design')}</button><button class="btn sm ghost" data-dact="edit">${t('Edit')}</button>
      <button class="btn sm ghost" data-dact="pdf">${t('Download PDF')}</button>${img ? `<a class="btn sm ghost" href="${designFile(d, img, false)}" download="${esc(d.productId)}-mockup.png">${t('Mockup PNG')}</a>` : ''}<button class="btn sm ghost acct-danger" data-dact="delete">${t('Delete')}</button></div><div data-dmsg></div></div></article>`; };
  main.innerHTML = `<div class="acct-block"><div class="acct-bh"><div><h2>${t('Saved designs')}</h2><p class="small">Designs you save or approve in Design Studio while signed in. Re-open them to edit, download them or order them any time.</p></div><a class="btn sm ghost" href="${BASE}/design-studio/">${t('Open Design Studio')}</a></div>
    ${designs.length ? `<div class="acct-designs">${designs.map(card).join('')}</div>` : `<div class="acct-empty"><p>${t('No saved designs yet.')}</p><a class="btn sm" href="${BASE}/design-studio/">${t('Open Design Studio')}</a></div>`}</div>`;
  main.querySelectorAll('[data-dact]').forEach(b => b.addEventListener('click', () => {
    const el = b.closest('[data-design]'), d = designs.find(x => x.id === el.dataset.design), box = el.querySelector('[data-dmsg]'), p = prod(d.productId), act = b.dataset.dact;
    busy(b, async () => {
      try {
        msgBox(box, '');
        if (act === 'delete') { if (!confirm(t('Delete this design?'))) return; await api('designs/delete', { id: d.id }); el.remove(); return; }
        if (act === 'pdf' && d.approved && d.prints.length) {
          const { pdfFromRasters } = await import('/studio/pdf.mjs');
          const pages = []; for (const f of d.prints) pages.push({ image: await blobURL(designFile(d, f.id, true)), widthIn: f.widthIn, heightIn: f.heightIn, bleedIn: f.bleedIn || 0, dpi: f.dpi });
          const a = document.createElement('a'); a.href = URL.createObjectURL(await pdfFromRasters(pages, nameOf(d) + ' - Satin Graphic Design Studio')); a.download = d.productId + '-print-ready.pdf'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return;
        }
        if (!p) throw Error('This product is no longer available in Design Studio.');
        const o = await api('designs/open', { id: d.id }); // brings the design (and its files) into this browser's studio session
        const studio = (extra) => local('/satin/design-studio/') + '?' + new URLSearchParams({ product: o.productId, designId: o.id, ...extra });
        if (act === 'edit') location.assign(studio({}));
        else if (act === 'pdf') location.assign(studio({ export: 'pdf' }));
        else if (act === 'order') {
          if (!o.approved) { location.assign(studio({ review: '1' })); return; }
          const u = new URL(local(p.path).replace(/\/?$/, '/'), location.origin); u.searchParams.set('designId', o.id); if (d.values && Object.keys(d.values).length) u.searchParams.set('values', JSON.stringify(d.values)); location.assign(u.pathname + u.search);
        }
      } catch (e) { msgBox(box, e.message); }
    });
  }));
}
function profileView(main) {
  const a = ME.address || {}, m = ME.methods;
  const field = (name, label, val, attrs = '') => `<label class="field"><span class="fl">${t(label)}</span><input class="inp" name="${name}" value="${esc(val || '')}" ${attrs}></label>`;
  const prov = (k, label) => `<div class="acct-meth"><span>${k === 'google' ? ICON.google : k === 'facebook' ? `<span class="fb">${ICON.facebook}</span>` : '✉'} ${esc(label)}</span>${m[k] ? chip('Connected', 'good') : k === 'password' ? `<span class="tiny">${t('Not set')}</span>` : PROVIDERS[k] ? `<a class="btn sm ghost" href="/api/customer/oauth/${k}/start?return=${encodeURIComponent(BASE + '/account/?tab=profile')}">${t('Connect')}</a>` : `<span class="tiny">—</span>`}</div>`;
  main.innerHTML = `<div class="acct-block"><div class="acct-bh"><h2>${t('Profile')}</h2></div><div data-pmsg></div><form data-profile class="acct-form">
      <div class="acct-g2">${field('name', 'Full name', ME.name, 'required maxlength="120" autocomplete="name"')}${field('email', 'Email', ME.email, 'disabled')}${field('phone', 'Phone (optional)', ME.phone, 'type="tel" maxlength="40" autocomplete="tel"')}${field('company', 'Company (optional)', ME.company, 'maxlength="160" autocomplete="organization"')}</div>
      <div class="acct-g2">${field('street1', 'Street address', a.street1, 'maxlength="160" autocomplete="address-line1"')}${field('street2', 'Unit / suite', a.street2, 'maxlength="160" autocomplete="address-line2"')}${field('city', 'City', a.city, 'maxlength="160" autocomplete="address-level2"')}
      <label class="field"><span class="fl">${t('Province')}</span><select class="inp" name="state">${['ON', 'QC', 'BC', 'AB', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'PE', 'SK', 'YT'].map(x => `<option ${x === (a.state || 'ON') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>${field('zip', 'Postal code', a.zip, 'maxlength="7" autocomplete="postal-code" placeholder="L4K 2M4"')}</div>
      <div><button class="btn" type="submit">${t('Save changes')}</button></div></form></div>
    <div class="acct-block"><div class="acct-bh"><h2>${t('Sign-in methods')}</h2></div>${prov('password', t('Email and password'))}${prov('google', 'Google')}${prov('facebook', 'Facebook')}</div>
    <div class="acct-block"><div class="acct-bh"><h2>${m.password ? t('Change password') : t('Set a password')}</h2></div><div data-wmsg></div><form data-pw class="acct-form acct-narrow">
      ${m.password ? `<label class="field"><span class="fl">${t('Current password')}</span><input class="inp" type="password" name="current" autocomplete="current-password" required></label>` : ''}
      <label class="field"><span class="fl">${t('New password')}</span><input class="inp" type="password" name="password" autocomplete="new-password" required minlength="10"><span class="tiny">${t('At least 10 characters, with letters and numbers.')}</span></label>
      <label class="field"><span class="fl">${t('Confirm password')}</span><input class="inp" type="password" name="password2" autocomplete="new-password" required></label>
      <div><button class="btn" type="submit">${m.password ? t('Change password') : t('Set a password')}</button></div></form></div>`;
  const pf = main.querySelector('[data-profile]');
  pf.addEventListener('submit', e => { e.preventDefault(); const v = Object.fromEntries(new FormData(pf)); const box = main.querySelector('[data-pmsg]');
    busy(pf.querySelector('[type=submit]'), async () => { try { const r = await api('profile', { name: v.name, phone: v.phone, company: v.company, address: { street1: v.street1, street2: v.street2, city: v.city, state: v.state, zip: v.zip } }); ME = r.customer; OVERVIEW.customer = r.customer; msgBox(box, t('Saved.'), true); } catch (er) { msgBox(box, er.message); } }); });
  const wf = main.querySelector('[data-pw]');
  wf.addEventListener('submit', e => { e.preventDefault(); const v = Object.fromEntries(new FormData(wf)); const box = main.querySelector('[data-wmsg]');
    if (v.password !== v.password2) { msgBox(box, t('Passwords do not match.')); return; }
    busy(wf.querySelector('[type=submit]'), async () => { try { const r = await api('password', { current: v.current || '', password: v.password }); CSRF = r.csrf; ME = r.customer; OVERVIEW.customer = r.customer; wf.reset(); msgBox(box, 'Password saved. Other devices were signed out.', true); } catch (er) { msgBox(box, er.message); } }); });
}
