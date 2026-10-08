/* Satin Graphic website chat widget.
   Loaded on every page by the main bundle: import('/chat-widget.mjs'). Talks to the PHP API at /api/chat/*.
   The visitor's chat token lives only in localStorage and is sent in the X-Chat-Token header (never in URLs). */
const CSS_VERSION = '1';
const KEY = 'satinChat';
const FA = (document.documentElement.lang || '').toLowerCase().startsWith('fa');
const T = FA ? {
  title: 'ستین گرافیک', online: 'همکاران ما آنلاین هستند', open: 'معمولاً در چند دقیقه پاسخ می‌دهیم', closed: 'خارج از ساعت کاری — با ایمیل پاسخ می‌دهیم',
  hint: 'سؤالی دارید؟ با ما گفتگو کنید', intro: 'قبل از شروع، لطفاً نام و ایمیل خود را بنویسید. شماره تلفن اختیاری است.',
  name: 'نام', email: 'ایمیل', phone: 'تلفن (اختیاری)', start: 'شروع گفتگو', privacy: 'این اطلاعات فقط برای پاسخ به شما استفاده می‌شود.', policy: 'حریم خصوصی',
  placeholder: 'پیام خود را بنویسید…', send: 'ارسال', human: 'صحبت با همکاران', wa: 'واتس‌اپ', end: 'پایان گفتگو', close: 'بستن', openChat: 'باز کردن گفتگو',
  errName: 'لطفاً نام خود را بنویسید.', errEmail: 'لطفاً یک ایمیل معتبر بنویسید.', errPhone: 'شماره تلفن را بررسی کنید (یا خالی بگذارید).',
  waiting: 'در انتظار همکاران…', ended: 'این گفتگو بسته شد. می‌توانید گفتگوی تازه‌ای شروع کنید.', newChat: 'گفتگوی جدید', staff: 'ستین گرافیک', failed: 'ارسال نشد. دوباره تلاش کنید.',
  confirmEnd: 'گفتگو پایان یابد؟', foot: 'دستیار ممکن است اشتباه کند — قیمت نهایی را همکاران ما تأیید می‌کنند.'
} : {
  title: 'Satin Graphic', online: 'Our team is online', open: 'We usually reply in a few minutes', closed: 'Closed now — we’ll reply by email',
  hint: 'Questions? Chat with us', intro: 'Before we start, may I have your name and email? Phone is optional.',
  name: 'Name', email: 'Email', phone: 'Phone (optional)', start: 'Start chat', privacy: 'We use these details only to reply to you.', policy: 'Privacy policy',
  placeholder: 'Type your message…', send: 'Send', human: 'Talk to a person', wa: 'WhatsApp', end: 'End chat', close: 'Close chat', openChat: 'Open chat',
  errName: 'Please enter your name.', errEmail: 'Please enter a valid email address.', errPhone: 'Please check the phone number (or leave it empty).',
  waiting: 'Waiting for our team…', ended: 'This chat has ended. You can start a new one any time.', newChat: 'Start a new chat', staff: 'Satin Graphic', failed: 'Not sent. Please try again.',
  confirmEnd: 'End this chat?', foot: 'The assistant can make mistakes — our team confirms final prices.'
};
const ICON = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1 2.7 11.6 11.6 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>'
};

const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} }
};
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const page = () => location.pathname.slice(0, 250);

/** Plain text → DOM with safe links for site paths, https URLs, emails and phone numbers. */
function richText(text) {
  const frag = document.createDocumentFragment();
  const re = /(https:\/\/[^\s<>"')]+|\/satin\/[A-Za-z0-9\/_-]*|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\(?\b\d{3}\)?[ .-]\d{3}-\d{4}\b)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    let s = m[0], tail = '';
    const p = s.match(/[.,;:!?]+$/); if (p) { tail = p[0]; s = s.slice(0, -tail.length); }
    const a = document.createElement('a'); a.textContent = s;
    if (s.includes('@') && !s.startsWith('http')) a.href = 'mailto:' + s;
    else if (/^\(?\d/.test(s)) a.href = 'tel:+1' + s.replace(/\D/g, '');
    else { a.href = s; if (s.startsWith('http') && !s.startsWith(location.origin)) { a.target = '_blank'; a.rel = 'noopener nofollow'; } }
    frag.append(a); if (tail) frag.append(tail);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

async function call(path, body, token) {
  const h = {}; if (token) h['X-Chat-Token'] = token;
  const opt = body === undefined ? { headers: h } : { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const r = await fetch('/api/chat' + path, { credentials: 'same-origin', cache: 'no-store', ...opt });
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(d.error || T.failed); e.status = r.status; e.data = d; throw e; }
  return d;
}

async function init() {
  if (window.frameElement || document.querySelector('.scw') || /^\/(admin|cms|studio|invoice)\b/.test(location.pathname)) return;
  let cfg;
  try { cfg = await call('/config'); } catch { return; }
  if (!cfg.enabled) return;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/chat-widget.css?v=' + CSS_VERSION; document.head.append(css);
  await new Promise(res => { css.onload = res; css.onerror = res; setTimeout(res, 1500); });

  let S = store.get(); // { token, lastId, open, unread, hinted }
  let lastId = 0, mode = 'bot', status = 'open', busy = false, timer = 0, ended = false;
  const max = cfg.maxLength || 1000;

  const root = el('div', 'scw'); root.dir = FA ? 'rtl' : 'ltr'; if (FA) root.lang = 'fa';
  root.innerHTML = `
    <div class="scw-hint" hidden></div>
    <section class="scw-panel" role="dialog" aria-modal="false" aria-label="${T.title}" hidden>
      <header class="scw-head"><div class="scw-ava" aria-hidden="true">S</div><div class="scw-ttl"><b>${T.title}</b><small><span class="scw-dot"></span><span data-status></span></small></div>
        <button type="button" class="scw-x" data-close aria-label="${T.close}">${ICON.x}</button></header>
      <div class="scw-log" data-log role="log" aria-live="polite"></div>
      <div class="scw-acts" data-acts hidden>
        <button type="button" class="scw-chip human" data-human>${ICON.person}<span>${T.human}</span></button>
        <a class="scw-chip wa" data-wa target="_blank" rel="noopener" hidden>${ICON.wa}<span>${T.wa}</span></a>
        <button type="button" class="scw-chip" data-end>${T.end}</button>
      </div>
      <form class="scw-comp" data-comp hidden><label class="scw-hp">Leave empty<input tabindex="-1" autocomplete="off" name="website"></label>
        <textarea rows="1" maxlength="${max}" placeholder="${T.placeholder}" aria-label="${T.placeholder}"></textarea>
        <button type="submit" class="scw-send" aria-label="${T.send}">${ICON.send}</button></form>
      <div class="scw-count" data-count></div>
      <div class="scw-foot">${T.foot}</div>
    </section>
    <button type="button" class="scw-launch" aria-label="${T.openChat}" aria-expanded="false">${ICON.chat}<span class="scw-badge" hidden>0</span></button>`;
  document.body.append(root);
  const $ = s => root.querySelector(s);
  const panel = $('.scw-panel'), log = $('[data-log]'), launch = $('.scw-launch'), badge = $('.scw-badge'), comp = $('[data-comp]'), ta = comp.querySelector('textarea'),
    acts = $('[data-acts]'), humanBtn = $('[data-human]'), wa = $('[data-wa]'), hint = $('.scw-hint'), count = $('[data-count]');
  if (cfg.whatsapp) { wa.href = cfg.whatsapp; wa.hidden = false; }
  $('[data-status]').textContent = cfg.staffOnline && cfg.openNow ? T.online : cfg.openNow ? T.open : T.closed;
  $('.scw-dot').classList.toggle('on', !!(cfg.staffOnline && cfg.openNow));

  /* --- keep clear of the cookie/analytics consent banner (and other bottom popups) --- */
  const lift = () => {
    const b = document.querySelector('.consent-banner');
    const h = b && b.offsetParent !== null ? b.getBoundingClientRect() : null;
    root.style.setProperty('--scw-lift', h ? Math.max(0, innerHeight - h.top) + 'px' : '0px');
  };
  lift(); new MutationObserver(lift).observe(document.body, { childList: true }); addEventListener('resize', lift);

  /* --- rendering --- */
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function bubble(m) {
    const b = el('div', 'scw-m ' + m.sender); if (m.id) b.dataset.id = m.id;
    if (m.sender === 'staff') { const w = el('span', 'scw-who'); w.textContent = (m.staffName ? m.staffName.split(' ')[0] + ' · ' : '') + T.staff; b.append(w); }
    b.append(richText(String(m.body || '')));
    if (Array.isArray(m.links) && m.links.length) {
      const l = el('div', 'scw-links');
      for (const x of m.links.slice(0, 4)) { if (typeof x.url !== 'string' || !/^(\/|https:\/\/)/.test(x.url)) continue; const a = document.createElement('a'); a.href = x.url; a.textContent = x.title || x.url; if (x.url.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener'; } l.append(a); }
      b.append(l);
    }
    return b;
  }
  function add(msgs, fromPoll) {
    let fresh = 0;
    for (const m of msgs || []) {
      if (m.id <= lastId || log.querySelector(`[data-id="${m.id}"]`)) continue;
      log.querySelector('.scw-typing')?.remove();
      log.append(bubble(m)); lastId = m.id; if (m.sender !== 'visitor') fresh++;
    }
    if (fresh && fromPoll && panel.hidden) { S.unread = (S.unread || 0) + fresh; save(); showBadge(); }
    if (fresh || !fromPoll) scroll();
  }
  const save = () => { S.lastId = lastId; store.set(S); };
  const showBadge = () => { badge.hidden = !(S.unread > 0); badge.textContent = String(Math.min(9, S.unread || 0)) + (S.unread > 9 ? '+' : ''); };
  function typing(on) { log.querySelector('.scw-typing')?.remove(); if (on) { log.append(el('div', 'scw-typing', '<i></i><i></i><i></i>')); scroll(); } }
  function waitingNote(on) { log.querySelector('[data-wait]')?.remove(); if (on) { const w = el('div', 'scw-m system'); w.dataset.wait = '1'; w.textContent = T.waiting; log.append(w); } }
  function applyState(d) {
    if (d.mode) mode = d.mode; if (d.status) status = d.status;
    humanBtn.hidden = mode === 'human' && !d.emailed && status === 'open';
    waitingNote(!!d.waiting);
    if (d.offerHuman) { humanBtn.hidden = false; humanBtn.classList.remove('pulse'); void humanBtn.offsetWidth; humanBtn.classList.add('pulse'); }
    if (status === 'closed' && !ended) showEnded();
  }
  function showEnded() {
    ended = true; comp.hidden = true; acts.hidden = true; waitingNote(false);
    const box = el('div', 'scw-m system'); box.textContent = T.ended + ' ';
    const b = el('button', 'scw-chip'); b.type = 'button'; b.textContent = T.newChat; b.style.marginTop = '8px';
    b.onclick = () => { store.clear(); S = {}; lastId = 0; mode = 'bot'; status = 'open'; ended = false; render(); };
    box.append(document.createElement('br'), b); log.append(box); scroll();
  }

  /* --- intake form (name, email, phone) --- */
  function intake() {
    const f = el('form', 'scw-form'); f.noValidate = true;
    f.innerHTML = `<div>${T.intro}</div>
      <label>${T.name}<input name="name" autocomplete="name" maxlength="80" required></label>
      <label>${T.email}<input name="email" type="email" autocomplete="email" maxlength="254" required dir="ltr"></label>
      <label>${T.phone}<input name="phone" type="tel" autocomplete="tel" maxlength="25" dir="ltr"></label>
      <label class="scw-hp">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <div class="scw-err" role="alert"></div>
      <button class="scw-btn" type="submit">${T.start}</button>
      <div class="scw-note">${T.privacy} <a href="/satin/privacy-policy/">${T.policy}</a></div>`;
    const err = f.querySelector('.scw-err');
    const bad = (input, msg) => { f.querySelectorAll('input').forEach(i => i.removeAttribute('aria-invalid')); if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); } err.textContent = msg; };
    f.onsubmit = async e => {
      e.preventDefault();
      const name = f.name.value.trim(), email = f.email.value.trim(), phone = f.phone.value.trim();
      if (name.length < 2) return bad(f.name, T.errName);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(f.email, T.errEmail);
      if (phone && (!/^[+()\d\s.\-]{7,25}$/.test(phone) || phone.replace(/\D/g, '').length < 7)) return bad(f.phone, T.errPhone);
      const btn = f.querySelector('button'); btn.disabled = true; bad(null, '');
      try {
        const d = await call('/start', { name, email, phone, page: page(), lang: FA ? 'fa' : 'en', website: f.website.value });
        S = { token: d.token, lastId: 0 }; save();
        f.remove(); comp.hidden = false; acts.hidden = false; add(d.messages); applyState(d); save(); ta.focus(); schedule();
      } catch (er) { bad(er.data?.field ? f[er.data.field] : null, er.message); btn.disabled = false; }
    };
    return f;
  }

  function render() {
    log.textContent = ''; ended = false;
    log.append(bubble({ sender: 'bot', body: FA ? (cfg.welcomeFa || cfg.welcome) : cfg.welcome }));
    if (!S.token) { comp.hidden = true; acts.hidden = true; log.append(intake()); return; }
    comp.hidden = false; acts.hidden = false; lastId = 0;
    poll(true);
  }

  /* --- polling: every 3 s while open, slower while closed, paused in background tabs --- */
  async function poll(full) {
    if (!S.token || busy) return;
    try {
      const d = await call('/poll?after=' + (full ? 0 : lastId), undefined, S.token);
      add(d.messages, !full); applyState(d); save();
    } catch (e) {
      if (e.status === 404 && e.data?.expired) { store.clear(); S = {}; if (!panel.hidden) render(); }
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!S.token || ended) return;
    const ms = document.hidden ? 60000 : !panel.hidden ? 3000 : mode === 'human' ? 10000 : 30000;
    timer = setTimeout(async () => { if (!document.hidden) await poll(false); schedule(); }, ms);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(false); schedule(); });

  /* --- open / close --- */
  let rendered = false;
  function setOpen(open) {
    panel.hidden = !open; root.classList.toggle('open', open); launch.setAttribute('aria-expanded', String(open)); hint.hidden = true;
    S.open = open; if (open) { S.unread = 0; S.hinted = 1; showBadge(); }
    save();
    if (open) { if (!rendered) { rendered = true; render(); } else scroll(); setTimeout(() => (S.token ? ta : log.querySelector('input'))?.focus(), 50); }
    else launch.focus({ preventScroll: true });
    schedule();
  }
  launch.onclick = () => setOpen(panel.hidden);
  $('[data-close]').onclick = () => setOpen(false);
  hint.onclick = () => setOpen(true);
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

  /* --- sending --- */
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; const n = ta.value.length; count.textContent = n > max * 0.8 ? `${n} / ${max}` : ''; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); comp.requestSubmit(); } });
  comp.onsubmit = async e => {
    e.preventDefault();
    const text = ta.value.trim(); if (!text || busy || !S.token) return;
    if (comp.website.value) return;
    busy = true; const btn = comp.querySelector('button'); btn.disabled = true;
    const tmp = bubble({ sender: 'visitor', body: text }); tmp.classList.add('pending'); log.append(tmp); scroll();
    ta.value = ''; grow();
    if (mode === 'bot') setTimeout(() => { if (busy) typing(true); }, 250);
    try {
      const d = await call('/send', { text, page: page(), after: lastId }, S.token);
      tmp.remove(); add(d.messages); applyState(d); save();
    } catch (er) {
      typing(false); tmp.remove(); ta.value = text; grow();
      const m = el('div', 'scw-m system'); m.textContent = er.message || T.failed; log.append(m); scroll();
      if (er.status === 404 && er.data?.expired) { store.clear(); S = {}; render(); }
    } finally { busy = false; btn.disabled = false; ta.focus(); schedule(); }
  };
  humanBtn.onclick = async () => {
    if (!S.token) return; humanBtn.disabled = true;
    try { const d = await call('/human', { after: lastId }, S.token); add(d.messages); applyState(d); save(); }
    catch (er) { const m = el('div', 'scw-m system'); m.textContent = er.message; log.append(m); scroll(); }
    finally { humanBtn.disabled = false; schedule(); }
  };
  $('[data-end]').onclick = async () => {
    if (!S.token || !confirm(T.confirmEnd)) return;
    try { await call('/end', {}, S.token); } catch {}
    status = 'closed'; showEnded(); store.clear(); S = {};
  };

  /* --- restore state across page navigation --- */
  showBadge();
  if (S.token) { if (S.open && innerWidth > 560) setOpen(true); else { lastId = S.lastId || 0; schedule(); } }
  else if (!S.hinted) setTimeout(() => { if (panel.hidden && !store.get().hinted) { hint.textContent = T.hint; hint.hidden = false; S.hinted = 1; save(); setTimeout(() => { hint.hidden = true; }, 9000); } }, 12000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
