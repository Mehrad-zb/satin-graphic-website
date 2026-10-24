/* Satin Admin — Customer login (Google / Facebook / email settings) and website customer accounts. Needs app.js (window.SatinAdmin). */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const METHOD = { email: 'Email', password: 'Email', google: 'Google', facebook: 'Facebook' };
const methodPills = list => list.length ? list.map(m => `<span class="pill ${m === 'google' ? 'confirmed' : m === 'facebook' ? 'contacted' : ''}">${METHOD[m] || esc(m)}</span>`).join(' ') : '<span class="hint">—</span>';

async function route(path) {
  if (path === '/customer-login') return view();
}

async function view() {
  const c = A().shell('Customer login & accounts', 'Website', '<div class="card empty">Loading…</div>', '/customer-login');
  const canSet = A().can('settings.edit'), canList = A().can('invoices.view');
  const [st, acc] = await Promise.all([canSet ? A().api('/customer-login') : null, canList ? A().api('/customer-accounts') : null]);
  const s = st && st.settings;
  const copy = (v, key) => `<div class="copy"><input class="input" readonly value="${esc(v)}" data-copyval="${key}"><button class="btn ghost sm" type="button" data-copy="${key}">Copy</button></div>`;
  c.innerHTML = `${s ? `<div class="grid g2 shop-provs">
      <div class="card shop-prov"><b>Google</b> ${s.google.ready ? '<span class="pill confirmed">On</span>' : '<span class="pill">Not configured</span>'}<small>${s.google.ready ? 'Customers see “Continue with Google” on the sign-in page.' : 'The Google button stays hidden until the Client ID and secret are saved.'}</small></div>
      <div class="card shop-prov"><b>Facebook</b> ${s.facebook.ready ? '<span class="pill confirmed">On</span>' : '<span class="pill">Not configured</span>'}<small>${s.facebook.ready ? 'Customers see “Continue with Facebook”.' : 'The Facebook button stays hidden until the App ID and secret are saved.'}</small></div></div>
    <div class="grid g2 shop-pay"><div class="card"><h2>Sign-in options</h2><div data-msg></div><form data-f>
      <label class="field"><span><input type="checkbox" name="emailEnabled" ${s.emailEnabled ? 'checked' : ''} style="width:auto"> Email &amp; password sign-up and sign-in</span><div class="hint">New accounts must confirm their email before they can sign in. Orders and invoices are matched to an account by its confirmed email.</div></label>
      <h3 style="margin:18px 0 6px">Google</h3>
      <label class="field"><span>Client ID</span><input name="googleClientId" value="${esc(s.google.clientId)}" placeholder="1234567890-abc….apps.googleusercontent.com" autocomplete="off"></label>
      <label class="field"><span>Client secret ${s.google.secretSet ? `<small class="pill">${esc(s.google.secretHint)}</small>` : ''}</span><input name="googleClientSecret" type="password" autocomplete="new-password" placeholder="${s.google.secretSet ? 'Saved — leave empty to keep it' : 'Paste the client secret (GOCSPX-…)'}"><div class="hint">Write-only: after saving, only the last 4 characters are shown.</div></label>
      <label class="field"><span>Authorized redirect URI — paste this in Google Cloud</span>${copy(s.google.redirectUri, 'g')}</label>
      <label class="field"><span>Authorized JavaScript origin</span>${copy(s.google.origin, 'go')}</label>
      <label class="field"><span><input type="checkbox" name="googleEnabled" ${s.google.enabled ? 'checked' : ''} style="width:auto"> Show “Continue with Google”</span></label>
      <h3 style="margin:18px 0 6px">Facebook</h3>
      <label class="field"><span>App ID</span><input name="facebookAppId" value="${esc(s.facebook.appId)}" placeholder="e.g. 1234567890123456" autocomplete="off"></label>
      <label class="field"><span>App secret ${s.facebook.secretSet ? `<small class="pill">${esc(s.facebook.secretHint)}</small>` : ''}</span><input name="facebookAppSecret" type="password" autocomplete="new-password" placeholder="${s.facebook.secretSet ? 'Saved — leave empty to keep it' : 'Paste the App secret'}"></label>
      <label class="field"><span>Valid OAuth Redirect URI — paste this in Meta for Developers</span>${copy(s.facebook.redirectUri, 'f')}</label>
      <label class="field"><span><input type="checkbox" name="facebookEnabled" ${s.facebook.enabled ? 'checked' : ''} style="width:auto"> Show “Continue with Facebook”</span></label>
      <div class="shop-acts"><button class="btn" type="submit">Save</button>${s.google.secretSet ? '<button class="btn danger sm" type="button" data-clear="Google">Remove Google secret</button>' : ''}${s.facebook.secretSet ? '<button class="btn danger sm" type="button" data-clear="Facebook">Remove Facebook secret</button>' : ''}</div>
      ${s.updatedAt ? `<p class="hint">Last saved ${esc(A().fmtDate(s.updatedAt))} by ${esc(s.updatedBy || '—')}</p>` : ''}
      <p class="hint">Test: open <a href="/satin/login/" target="_blank" rel="noopener">/satin/login/</a> in a private window after saving.</p>
    </form></div>
    <div class="card shop-help"><h2>Google setup / راه‌اندازی Google</h2>
      <ol><li>Open <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">console.cloud.google.com</a> and create (or pick) a project, e.g. “Satin Website”.</li>
      <li><b>Google Auth Platform → Branding</b> (OAuth consent screen): app name <b>Satin Graphic</b>, support email, logo, home page <code>https://satingraphic.ca</code>, privacy policy and terms links; <b>Authorized domains</b>: <code>satingraphic.ca</code>. <b>Audience</b>: External, then <b>Publish app</b>. Scopes needed: only <code>openid</code>, <code>email</code>, <code>profile</code>.</li>
      <li><b>Clients → Create client</b> → type <b>Web application</b>. Add the <b>Authorized JavaScript origin</b> and the <b>Authorized redirect URI</b> shown here (exactly, including https and the path).</li>
      <li>Copy the <b>Client ID</b> and <b>Client secret</b>, paste them here and Save.</li></ol>
      <div dir="rtl" lang="fa" class="shop-fa"><ol><li>به <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noopener">console.cloud.google.com</a> بروید و یک پروژه بسازید (مثلاً Satin Website).</li>
      <li>در <b>Google Auth Platform → Branding</b> نام اپ را <b>Satin Graphic</b> بگذارید، ایمیل پشتیبانی، لوگو، آدرس سایت و لینک Privacy Policy و Terms را وارد کنید و در <b>Authorized domains</b> دامنهٔ <code>satingraphic.ca</code> را اضافه کنید. در <b>Audience</b> گزینهٔ External را انتخاب و <b>Publish app</b> را بزنید. فقط دسترسی‌های openid، email و profile لازم است.</li>
      <li>در <b>Clients → Create client</b> نوع <b>Web application</b> را انتخاب کنید. <b>Authorized JavaScript origin</b> و <b>Authorized redirect URI</b> همین صفحه را دقیقاً کپی کنید.</li>
      <li><b>Client ID</b> و <b>Client secret</b> را کپی کنید، اینجا وارد کنید و ذخیره بزنید.</li></ol></div>
      <h2 style="margin-top:22px">Facebook setup / راه‌اندازی Facebook</h2>
      <ol><li>Open <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> → <b>Create app</b> → use case <b>Authenticate and request data from users with Facebook Login</b>.</li>
      <li><b>Use cases → Facebook Login → Customize</b>: add the <b>email</b> permission (public_profile is included).</li>
      <li><b>Facebook Login → Settings</b>: paste the <b>Valid OAuth Redirect URI</b> shown here. Keep Client OAuth login, Web OAuth login, Enforce HTTPS and Strict Mode <b>on</b>.</li>
      <li><b>App settings → Basic</b>: App domains <code>satingraphic.ca</code>, Privacy Policy URL, Terms of Service URL, User data deletion → instructions URL (your privacy policy page), category and icon. Copy the <b>App ID</b> and the <b>App secret</b> (Show) and paste them here.</li>
      <li>Switch the app to <b>Live</b> (Publish). In development mode only people with a role on the app can sign in.</li></ol>
      <div dir="rtl" lang="fa" class="shop-fa"><ol><li>به <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener">developers.facebook.com/apps</a> بروید ← <b>Create app</b> ← کاربرد <b>Authenticate and request data from users with Facebook Login</b>.</li>
      <li>در <b>Use cases → Facebook Login → Customize</b> مجوز <b>email</b> را اضافه کنید.</li>
      <li>در <b>Facebook Login → Settings</b> آدرس <b>Valid OAuth Redirect URI</b> همین صفحه را وارد کنید؛ گزینه‌های Client OAuth login، Web OAuth login، Enforce HTTPS و Strict Mode روشن بمانند.</li>
      <li>در <b>App settings → Basic</b> دامنهٔ <code>satingraphic.ca</code>، لینک Privacy Policy، Terms و User data deletion (صفحهٔ حریم خصوصی) را وارد کنید. <b>App ID</b> و <b>App secret</b> را کپی و اینجا ذخیره کنید.</li>
      <li>اپ را <b>Live</b> کنید؛ در حالت Development فقط افرادی که روی اپ نقش دارند می‌توانند وارد شوند.</li></ol>
      <p>کلیدهای مخفی (Secret) فقط در دیتابیس سرور ذخیره می‌شوند و دیگر نمایش داده نمی‌شوند (فقط ۴ رقم آخر). دکمه‌های Google و Facebook تا وقتی تنظیم نشده‌اند به مشتری نشان داده نمی‌شوند.</p></div></div></div>` : ''}
    ${acc ? `<div class="card" style="margin-top:18px"><h2>Website accounts <small class="hint">${acc.accounts.length}</small> <a class="btn ghost sm" href="#/web-members" style="float:right">Open Website members (filters, designs) →</a></h2><div class="toolbar"><input class="input" data-q placeholder="Search name, email, phone"></div><div data-list></div></div>` : ''}`;
  c.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText($(`[data-copyval="${b.dataset.copy}"]`, c).value); A().toast('Copied'); });
  const f = $('[data-f]', c);
  const msg = t => { $('[data-msg]', c).innerHTML = `<div class="err">${esc(t)}</div>`; };
  if (f) {
    f.onsubmit = async e => { e.preventDefault();
      try { await A().api('/customer-login', { emailEnabled: f.emailEnabled.checked, googleClientId: f.googleClientId.value.trim(), googleClientSecret: f.googleClientSecret.value.trim(), googleEnabled: f.googleEnabled.checked,
          facebookAppId: f.facebookAppId.value.trim(), facebookAppSecret: f.facebookAppSecret.value.trim(), facebookEnabled: f.facebookEnabled.checked });
        A().toast('Customer login settings saved'); view(); } catch (er) { msg(er.message); } };
    c.querySelectorAll('[data-clear]').forEach(b => b.onclick = () => A().confirmBox(`Remove the ${b.dataset.clear} secret?`, `“Continue with ${b.dataset.clear}” disappears from the sign-in page until you enter it again.`, async () => {
      try { await A().api('/customer-login', b.dataset.clear === 'Google' ? { clearGoogle: true } : { clearFacebook: true }); view(); } catch (er) { msg(er.message); } }));
  }
  if (acc) {
    const draw = () => {
      const q = $('[data-q]', c).value.trim().toLowerCase();
      const rows = acc.accounts.filter(a => !q || [a.name, a.email, a.phone, a.company].join(' ').toLowerCase().includes(q));
      $('[data-list]', c).innerHTML = rows.length ? `<table class="table"><thead><tr><th>Customer</th><th>Sign-in</th><th>Email</th><th class="num">Orders</th><th>Joined</th><th>Last sign-in</th><th></th></tr></thead><tbody>${rows.slice(0, 500).map(a => `<tr>
        <td><b>${esc(a.name)}</b><small>${esc([a.email, a.phone].filter(Boolean).join(' · '))}</small></td><td>${methodPills(a.methods)}</td>
        <td>${a.verified ? '<span class="pill confirmed">Confirmed</span>' : '<span class="pill">Not confirmed</span>'}${a.status !== 'active' ? ' <span class="pill cancelled">Disabled</span>' : ''}</td>
        <td class="num">${a.orders ? `<a href="#/orders?q=${encodeURIComponent(a.email)}">${a.orders}</a>` : '0'}</td><td>${esc(A().fmtDate(a.createdAt))}</td><td>${a.lastLogin ? esc(A().fmtDate(a.lastLogin)) + (a.lastMethod ? ` <small>${esc(METHOD[a.lastMethod] || a.lastMethod)}</small>` : '') : '—'}</td>
        <td style="text-align:right">${A().can('members.manage') ? `<button class="btn ghost sm" data-st="${esc(a.id)}" data-to="${a.status === 'active' ? 'disabled' : 'active'}">${a.status === 'active' ? 'Disable' : 'Enable'}</button>` : ''}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">${acc.accounts.length ? 'No accounts match.' : 'No customer has created a website account yet.'}</div>`;
      c.querySelectorAll('[data-st]').forEach(b => b.onclick = () => A().confirmBox(b.dataset.to === 'disabled' ? 'Disable this account?' : 'Enable this account?', b.dataset.to === 'disabled' ? 'The customer is signed out and cannot sign in until you enable the account again. Orders are kept.' : 'The customer can sign in again.', async () => {
        try { await A().api('/customer-accounts/status', { id: b.dataset.st, status: b.dataset.to }); view(); } catch (er) { A().toast(er.message); } }));
    };
    $('[data-q]', c).oninput = draw; draw();
  }
}

window.SatinCustLogin = { route, methodPills };
})();
