/* Satin Admin — Live chat inbox, chat knowledge base and chat settings. Needs app.js (window.SatinAdmin). */
(() => {
'use strict';
const A = () => window.SatinAdmin;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ago = s => { if (!s) return ''; const d = (Date.now() - new Date(s)) / 1000; if (d < 60) return 'now'; if (d < 3600) return Math.floor(d / 60) + ' min'; if (d < 86400) return Math.floor(d / 3600) + ' h'; return new Date(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
const time = s => new Date(s).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
let timers = [];
const stop = () => { timers.forEach(clearTimeout); timers = []; };
const onChat = () => location.hash.startsWith('#/chat');

const fmtSize = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fileUrl = (f, thumb) => '/api/admin/chat/file?id=' + encodeURIComponent(f.id) + (thumb ? '&thumb=1' : '');
/** Attachment cards for a message (staff session cookie authorizes the file URLs). */
function filesHtml(files) {
  return (files || []).map(f => `<div class="chat-file">${f.thumb ? `<a href="${fileUrl(f)}" target="_blank" rel="noopener" class="chat-thumb"><img src="${fileUrl(f, true)}" alt="${esc(f.name)}" loading="lazy"${f.width && f.height ? ` style="aspect-ratio:${+f.width}/${+f.height}"` : ''}></a>` : ''}
    <a class="chat-frow" href="${fileUrl(f)}${f.image ? '&download=1' : ''}" ${f.image ? 'download' : ''}><span class="chat-fic">${esc((f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase())}</span><span><b>${esc(f.name)}</b><small>${fmtSize(f.size)} · Download</small></span></a></div>`).join('');
}
/** Sends a file (+ optional caption) into a conversation as the signed-in staff member. */
async function uploadStaffFile(convId, file, text) {
  const fd = new FormData(); fd.append('id', convId); fd.append('file', file, file.name); if (text) fd.append('text', text);
  const r = await fetch('/api/admin/chat/upload', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf }, body: fd });
  let d = {}; try { d = await r.json(); } catch {}
  if (!r.ok) throw new Error(d.error || (r.status === 413 ? 'This file is too large.' : 'Upload failed.'));
  return d;
}
window.SatinChatFiles = { filesHtml, uploadStaffFile, fmtSize, fileUrl };

function tabs(active) {
  const t = [['/chat', 'Inbox'], ...(A().can('chat.manage') ? [['/chat/kb', 'Knowledge base'], ['/chat/import', 'Import chat history'], ['/chat/settings', 'Settings']] : [])];
  return t.length > 1 ? `<div class="tabs">${t.map(([p, l]) => `<button data-go="${p}" class="${p === active ? 'on' : ''}">${l}</button>`).join('')}</div>` : '';
}
function bindTabs(c) { $$('[data-go]', c).forEach(b => b.onclick = () => A().go(b.dataset.go)); }

function route(path, params) {
  stop();
  if (path === '/chat/kb') return A().can('chat.manage') ? viewKb() : A().go('/chat');
  if (path === '/chat/settings') return A().can('chat.manage') ? viewSettings() : A().go('/chat');
  if (path === '/chat/import') return A().can('chat.manage') ? viewImport() : A().go('/chat');
  return viewInbox(params);
}

/* ================= inbox ================= */
async function viewInbox(params) {
  const c = A().shell('Live chat', 'Business', '', '/chat');
  c.innerHTML = `${tabs('/chat')}<a class="chat-applink" href="/admin/chat-app/"><img src="/admin/icons/chat-192.png" alt=""><span>On your phone, use the <b>Satin Chat</b> app — WhatsApp-style inbox with notifications.</span></a><div class="chat-wrap">
    <div class="chat-list card"><div class="chat-filters"><input class="input" data-q placeholder="Search name, email, phone">
      <div class="chat-fl"><select class="input" data-st><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select>
      <select class="input" data-f><option value="">All chats</option><option value="unread">Unread</option><option value="waiting">Waiting for a person</option></select></div></div>
      <div data-hours class="chat-hours"></div><div data-list class="chat-items"><div class="empty">Loading…</div></div></div>
    <div class="chat-view card" data-view><div class="empty">Choose a conversation.</div></div></div>`;
  bindTabs(c);
  let current = params.get('id') || '';
  const list = $('[data-list]');
  const load = async () => {
    try {
      const qs = new URLSearchParams({ status: $('[data-st]').value, filter: $('[data-f]').value, q: $('[data-q]').value });
      const d = await A().api('/chat/conversations?' + qs);
      $('[data-hours]').innerHTML = `<span class="chat-dot ${d.openNow ? 'on' : ''}"></span>${d.openNow ? 'Open now' : 'Closed now — visitors are told we reply by email'} · <small>${esc(d.hours)}</small>`;
      list.innerHTML = d.conversations.length ? d.conversations.map(x => `<button class="chat-item ${x.id === current ? 'on' : ''} ${x.unread ? 'unread' : ''}" data-id="${esc(x.id)}">
          <span class="chat-item-top"><b>${esc(x.name)}</b><small>${esc(ago(x.lastMessageAt))}</small></span>
          <span class="chat-item-prev">${esc(x.preview)}</span>
          <span class="chat-item-tags">${x.waiting ? '<span class="pill warn">Waiting</span>' : ''}${x.emailed ? '<span class="pill">Emailed</span>' : ''}${x.mode === 'bot' ? '<span class="pill">Assistant</span>' : ''}${x.status === 'closed' ? '<span class="pill">Closed</span>' : ''}${x.unread ? `<span class="chat-unread">${x.unread}</span>` : ''}</span></button>`).join('')
        : '<div class="empty">No conversations here yet.</div>';
      $$('[data-id]', list).forEach(b => b.onclick = () => { current = b.dataset.id; if (matchMedia('(max-width: 820px)').matches && !/[?&]id=/.test(location.hash)) history.pushState({ chatThread: 1 }, '', '#/chat?id=' + current); else history.replaceState(history.state, '', '#/chat?id=' + current); $$('.chat-item', list).forEach(i => i.classList.toggle('on', i === b)); b.classList.remove('unread'); openConv(current, load); });
    } catch (e) { list.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  };
  let t; $('[data-q]').oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $('[data-st]').onchange = load; $('[data-f]').onchange = load;
  const loop = async () => { if (!onChat()) return; await load(); timers.push(setTimeout(loop, 6000)); };
  await loop();
  if (current) openConv(current, load);
}

let convToken = 0;
async function openConv(id, reloadList) {
  const view = $('[data-view]'); if (!view) return;
  const my = ++convToken; let lastId = 0, conv = null;
  view.innerHTML = '<div class="empty">Loading…</div>';
  const canReply = A().can('chat.reply');
  const msgHtml = m => {
    const who = { visitor: esc(conv.name), bot: 'Assistant', staff: esc(m.staffName || 'Staff'), system: '' }[m.sender] ?? '';
    const links = (m.links || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title || l.url)}</a>`).join('');
    return `<div class="chat-msg ${esc(m.sender)}" data-mid="${m.id}">${who ? `<small>${who} · ${esc(time(m.createdAt))}${m.source && m.sender === 'bot' ? ' · ' + esc({ kb: 'Q&A', pages: 'website pages', ai: 'AI', smalltalk: 'greeting', none: 'no answer' }[m.source] || m.source) : ''}</small>` : ''}${m.body ? `<div class="chat-body">${esc(m.body)}</div>` : ''}${filesHtml(m.files)}${links ? `<div class="chat-links">${links}</div>` : ''}</div>`;
  };
  const head = () => `<header class="chat-head"><div><h2>${esc(conv.name)} <span class="chat-pres ${conv.online ? 'on' : ''}" data-pres>${conv.typing ? 'typing…' : conv.online ? 'online' : ''}</span> ${conv.status === 'closed' ? '<span class="pill">Closed</span>' : '<span class="pill confirmed">Open</span>'} ${conv.waiting ? '<span class="pill warn">Waiting for a person</span>' : ''}</h2>
      <small><a href="mailto:${esc(conv.email)}">${esc(conv.email)}</a>${conv.phone ? ` · <a href="tel:${esc(conv.phone)}">${esc(conv.phone)}</a>` : ''} · on <a href="${esc(conv.page)}" target="_blank" rel="noopener">${esc(conv.page)}</a></small></div>
    <div class="chat-acts"><button class="btn ghost sm" data-lead>Details</button><a class="btn ghost sm" href="/api/admin/chat/export?id=${encodeURIComponent(conv.id)}">Export</a>
      ${canReply ? `<button class="btn ghost sm" data-toggle>${conv.status === 'closed' ? 'Reopen' : 'Close chat'}</button>` : ''}${A().can('chat.manage') ? '<button class="btn danger sm" data-del>Delete</button>' : ''}</div></header>`;
  let d;
  try { d = await A().api('/chat/conversation?id=' + encodeURIComponent(id)); } catch (e) { view.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  if (my !== convToken) return;
  conv = d.conversation;
  const qr = d.quickReplies || [];
  view.innerHTML = `<div data-head>${head()}</div><div class="chat-log" data-log></div>
    ${canReply ? `<form class="chat-reply" data-reply>${qr.length ? `<div class="chat-qr">${qr.map((q, i) => `<button type="button" class="chip" data-qr="${i}" title="${esc(q)}">${esc(q.length > 42 ? q.slice(0, 40) + '…' : q)}</button>`).join('')}</div>` : ''}
      <textarea class="input" name="text" rows="3" maxlength="2000" placeholder="Write a reply… (Ctrl+Enter to send)"></textarea>
      <div class="chat-send"><label class="hint"><input type="checkbox" name="mail"> Also email this reply to ${esc(conv.email)}</label><span style="display:flex;gap:8px"><input type="file" data-file hidden accept="image/*,.heic,.pdf,.ai,.eps,.svg,.zip"><button class="btn ghost sm" type="button" data-attach title="Send a file (image, PDF, AI, EPS, SVG, ZIP — up to 20 MB)">📎 File</button><button class="btn sm" type="submit">Send reply</button></span></div></form>` : '<p class="hint" style="padding:0 16px">You can read chats but your role cannot reply.</p>'}`;
  const log = $('[data-log]', view);
  const addMsgs = ms => { const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80; for (const m of ms) { if (m.id <= lastId) continue; log.insertAdjacentHTML('beforeend', msgHtml(m)); lastId = m.id; } if (near || ms.length) log.scrollTop = log.scrollHeight; };
  addMsgs(d.messages); log.scrollTop = log.scrollHeight;
  if (matchMedia('(max-width: 820px)').matches) view.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const bindHead = () => {
    $('[data-lead]', view).onclick = () => A().modal(`<header><h2>Visitor details</h2><button class="x" data-close>×</button></header><dl class="kv">
      <dt>Name</dt><dd>${esc(conv.name)}</dd><dt>Email</dt><dd><a href="mailto:${esc(conv.email)}">${esc(conv.email)}</a></dd><dt>Phone</dt><dd>${conv.phone ? `<a href="tel:${esc(conv.phone)}">${esc(conv.phone)}</a>` : '—'}</dd>
      <dt>Current page</dt><dd><a href="${esc(conv.page)}" target="_blank" rel="noopener">${esc(conv.page)}</a></dd><dt>First page</dt><dd>${esc(conv.firstPage)}</dd><dt>Language</dt><dd>${conv.lang === 'fa' ? 'Persian page' : 'English page'}</dd>
      <dt>Started</dt><dd>${esc(A().fmtDate(conv.createdAt))}</dd><dt>Asked for a person</dt><dd>${conv.humanRequestedAt ? esc(A().fmtDate(conv.humanRequestedAt)) : 'No'}</dd><dt>Owner emailed</dt><dd>${conv.emailed ? 'Yes' : 'No'}</dd>
      <dt>IP</dt><dd>${esc(conv.ip)}</dd><dt>Browser</dt><dd><small>${esc(conv.agent)}</small></dd></dl>
      ${A().can('invoices.edit') ? '' : ''}<p class="hint">Use these details only to answer this enquiry.</p>`);
    const tg = $('[data-toggle]', view); if (tg) tg.onclick = async () => { try { await A().api('/chat/status', { id: conv.id, status: conv.status === 'closed' ? 'open' : 'closed' }); A().toast(conv.status === 'closed' ? 'Chat reopened' : 'Chat closed'); await refresh(); reloadList(); } catch (e) { A().toast(e.message); } };
    const del = $('[data-del]', view); if (del) del.onclick = () => A().confirmBox('Delete this chat?', 'The conversation and the visitor details are removed permanently. Export it first if you need a copy.', async () => { try { await A().api('/chat/delete', { id: conv.id }); A().toast('Chat deleted'); history.replaceState(null, '', '#/chat'); view.innerHTML = '<div class="empty">Choose a conversation.</div>'; convToken++; reloadList(); } catch (e) { A().toast(e.message); } });
  };
  bindHead();
  const refresh = async () => {
    const x = await A().api('/chat/conversation?id=' + encodeURIComponent(conv.id) + '&after=' + lastId);
    if (my !== convToken) return;
    const changed = x.conversation.status !== conv.status || x.conversation.waiting !== conv.waiting || x.conversation.page !== conv.page;
    conv = x.conversation; addMsgs(x.messages);
    const pr = $('[data-pres]', view); if (pr) { pr.textContent = conv.typing ? 'typing…' : conv.online ? 'online' : ''; pr.classList.toggle('on', !!conv.online); }
    if (changed) { $('[data-head]', view).innerHTML = head(); bindHead(); }
  };
  const f = $('[data-reply]', view);
  if (f) {
    $$('[data-qr]', f).forEach(b => b.onclick = () => { const ta = f.text; ta.value = (ta.value ? ta.value.trimEnd() + ' ' : '') + qr[+b.dataset.qr]; ta.focus(); });
    f.text.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } };
    let typedAt = 0;
    f.text.oninput = () => { if (f.text.value.trim() && Date.now() - typedAt > 4000) { typedAt = Date.now(); A().api('/chat/typing', { id: conv.id }).catch(() => {}); } };
    const fileIn = $('[data-file]', f), ab = $('[data-attach]', f);
    ab.onclick = () => fileIn.click();
    fileIn.onchange = async () => {
      const file = fileIn.files[0]; fileIn.value = ''; if (!file) return;
      if (file.size > 20 * 1048576) return A().toast('Files can be up to 20 MB.');
      ab.disabled = true; ab.textContent = 'Sending…';
      try { await uploadStaffFile(conv.id, file, f.text.value.trim()); f.text.value = ''; await refresh(); reloadList(); }
      catch (er) { A().toast(er.message); } finally { ab.disabled = false; ab.textContent = '📎 File'; }
    };
    f.onsubmit = async e => {
      e.preventDefault(); const text = f.text.value.trim(); if (!text) return;
      const b = f.querySelector('button[type=submit]'); b.disabled = true;
      try { const r = await A().api('/chat/reply', { id: conv.id, text, emailVisitor: f.mail.checked }); f.text.value = ''; f.mail.checked = false; if (r.emailed) A().toast('Reply sent and emailed'); await refresh(); reloadList(); }
      catch (er) { A().toast(er.message); } finally { b.disabled = false; f.text.focus(); }
    };
  }
  const loop = async () => { if (my !== convToken || !onChat()) return; try { await refresh(); } catch {} timers.push(setTimeout(loop, 3000)); };
  timers.push(setTimeout(loop, 3000));
  reloadList();
}

/* ================= knowledge base ================= */
async function viewKb() {
  const c = A().shell('Live chat', 'Business', '<div class="card empty">Loading…</div>', '/chat');
  const d = await A().api('/chat/kb');
  let entries = d.entries, index = d.index;
  const draw = () => {
    c.innerHTML = `${tabs('/chat/kb')}<div class="grid g2 chat-kb-top">
      <div class="card"><h2>Try a question</h2><form data-try class="chat-try"><input class="input" name="q" placeholder="e.g. How much is a van wrap?" maxlength="1000"><button class="btn sm" type="submit">Ask</button></form><div data-try-out class="hint">The assistant answers from the Q&amp;A below first, then from the text of your website pages.</div></div>
      <div class="card"><h2>Website pages index</h2><p class="hint" data-idx>${index ? `${index.pages} pages · ${index.chunks} text blocks · built ${esc(A().fmtDate(index.builtAt))}` : 'Not built yet — it is built automatically on the first question, or press Rebuild.'}</p>
        <button class="btn ghost sm" data-rebuild>Rebuild index</button><p class="hint">Rebuild after you publish website changes, so the assistant sees the new text.</p></div></div>
      <p class="hint" style="margin-top:12px">${entries.length} questions & answers. Tip: write <code>{hours}</code> in an answer to show the office hours from Settings. Learn from real conversations with <a href="#/chat/import">Import chat history</a>.</p>
      <div class="toolbar" style="margin-top:18px"><input class="input" data-filter placeholder="Filter questions"><button class="btn sm" data-add>Add Q&amp;A</button></div>
      <table class="table chat-kb"><thead><tr><th>Question</th><th>Answer</th><th>Link</th><th>On</th><th></th></tr></thead><tbody>${entries.map(e => `<tr data-row="${esc(e.id)}"><td><b>${esc(e.question)}</b><small>${esc(e.keywords)}</small></td><td>${esc(e.answer.length > 180 ? e.answer.slice(0, 178) + '…' : e.answer)}${e.answerFa ? ' <span class="pill" title="Has a Persian answer">فا</span>' : ''}</td><td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a>` : '—'}</td><td>${e.enabled ? 'Yes' : '<span class="pill">Off</span>'}</td>
        <td style="white-space:nowrap;text-align:right"><button class="btn ghost sm" data-edit="${esc(e.id)}">Edit</button> <button class="btn danger sm" data-delq="${esc(e.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No entries yet.</td></tr>'}</tbody></table>`;
    bindTabs(c);
    $('[data-filter]', c).oninput = e => { const q = e.target.value.toLowerCase(); $$('tr[data-row]', c).forEach(tr => tr.hidden = !tr.textContent.toLowerCase().includes(q)); };
    $('[data-add]', c).onclick = () => edit(null);
    $$('[data-edit]', c).forEach(b => b.onclick = () => edit(entries.find(e => e.id === b.dataset.edit)));
    $$('[data-delq]', c).forEach(b => b.onclick = () => A().confirmBox('Delete this Q&A?', entries.find(e => e.id === b.dataset.delq)?.question || '', async () => { try { await A().api('/chat/kb/delete', { id: b.dataset.delq }); entries = entries.filter(e => e.id !== b.dataset.delq); draw(); A().toast('Deleted'); } catch (er) { A().toast(er.message); } }));
    $('[data-rebuild]', c).onclick = async e => { const b = e.target; b.disabled = true; b.textContent = 'Rebuilding…'; try { const r = await A().api('/chat/index/rebuild', {}); index = r.index; A().toast(`Indexed ${index.pages} pages`); draw(); } catch (er) { A().toast(er.message); b.disabled = false; b.textContent = 'Rebuild index'; } };
    const tf = $('[data-try]', c);
    tf.onsubmit = async e => {
      e.preventDefault(); const out = $('[data-try-out]', c); out.innerHTML = 'Thinking…';
      try {
        const r = await A().api('/chat/test', { q: tf.q.value });
        out.innerHTML = `<div class="chat-msg bot"><small>Answer · ${esc({ kb: 'from Q&A', pages: 'from website pages', ai: 'AI', smalltalk: 'greeting', none: 'no good match — offers a person' }[r.answer.source] || r.answer.source)}</small><div class="chat-body">${esc(r.answer.text)}</div>${(r.answer.links || []).length ? `<div class="chat-links">${r.answer.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join('')}</div>` : ''}</div>
          <details><summary>Why this answer?</summary><p>Search words: ${esc(r.terms.join(', ') || '—')}</p><p><b>Q&amp;A matches</b><br>${r.kb.map(k => `${esc(k.question)} <small>(score ${k.score}, ${Math.round(k.coverage * 100)}% of words)</small>`).join('<br>') || '—'}</p><p><b>Page matches</b><br>${r.pages.map(p => `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> <small>(score ${p.score}, ${Math.round(p.coverage * 100)}%)</small>`).join('<br>') || '—'}</p></details>`;
      } catch (er) { out.innerHTML = `<div class="err">${esc(er.message)}</div>`; }
    };
  };
  const edit = e => {
    const o = A().modal(`<header><h2>${e ? 'Edit' : 'Add'} Q&amp;A</h2><button class="x" data-close>×</button></header><form data-f>
      <label class="field"><span>Question</span><input name="question" maxlength="300" required value="${esc(e?.question)}" placeholder="How much does a van wrap cost?"></label>
      <label class="field"><span>Answer</span><textarea name="answer" rows="5" maxlength="3000" required>${esc(e?.answer)}</textarea><div class="hint">Plain text. Phone numbers, emails and /satin/… links become clickable. Only state prices that are on the website.</div></label>
      <label class="field"><span>Answer in Persian (optional)</span><textarea name="answerFa" rows="4" maxlength="3000" dir="rtl" lang="fa">${esc(e?.answerFa)}</textarea><div class="hint">Shown to visitors on Persian pages or who write in Persian. Empty = the English answer is used.</div></label>
      <label class="field"><span>Extra keywords (optional)</span><input name="keywords" maxlength="500" value="${esc(e?.keywords)}" placeholder="other words visitors use, e.g. cost price how much van sprinter"><div class="hint">Persian keywords work too (e.g. قیمت).</div></label>
      <label class="field"><span>Link to a page (optional)</span><input name="url" maxlength="300" value="${esc(e?.url)}" placeholder="/satin/vehicle-wraps/"></label>
      <label class="field"><span><input type="checkbox" name="enabled" ${!e || e.enabled ? 'checked' : ''} style="width:auto"> Use this answer</span></label>
      <div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">Save</button></div></form>`);
    const f = $('[data-f]', o);
    f.onsubmit = async ev => {
      ev.preventDefault();
      try {
        const r = await A().api('/chat/kb/save', { entry: { id: e?.id || '', question: f.question.value, answer: f.answer.value, answerFa: f.answerFa.value, keywords: f.keywords.value, url: f.url.value, enabled: f.enabled.checked } });
        if (e) entries = entries.map(x => x.id === e.id ? r.entry : x); else entries.push(r.entry);
        o.remove(); draw(); A().toast('Saved');
      } catch (er) { A().toast(er.message); }
    };
  };
  draw();
}

/* ================= import chat history (WhatsApp export → Q&A suggestions) ================= */
async function viewImport() {
  const c = A().shell('Live chat', 'Business', '', '/chat');
  let file = null, res = null, ai = false;
  try { ai = !!(await A().api('/chat/settings')).settings.aiEnabled; } catch {}
  c.innerHTML = `${tabs('/chat/import')}<div class="grid g2">
    <div class="card"><h2>Teach the assistant from real chats</h2>
      <p class="hint">Upload a chat exported from WhatsApp Business. Questions customers asked and the answers your team gave become <b>suggestions</b>. Nothing is added until you review and approve it.</p>
      <form data-up class="imp-up"><input type="file" name="file" accept=".txt,.zip,text/plain,application/zip" required><button class="btn sm" type="submit">Read chat</button></form>
      <div data-who></div><div data-msg></div></div>
    <div class="card"><h2>How to export from WhatsApp</h2><ol class="imp-how"><li>Open the chat with a customer (or a group).</li><li>Android: ⋮ → <b>More</b> → <b>Export chat</b>. iPhone: tap the name → <b>Export Chat</b>.</li><li>Choose <b>Without media</b> (smaller) and save or email the file to yourself.</li><li>Upload the <code>.txt</code> or <code>.zip</code> here. You can upload several chats inside one ZIP.</li></ol>
      <p class="hint"><b>Privacy:</b> the file is read on your own server and deleted right away. Phone numbers, emails, street addresses, postal codes, links and the people’s names are removed from the suggestions. ${ai ? 'The optional “Tidy with AI” button sends only the cleaned suggestions to the AI service you set up in Settings.' : 'Nothing is sent to any other service.'}</p>
      <div dir="rtl" lang="fa" class="shop-fa"><b>خروجی گرفتن از واتس‌اپ:</b> چت را باز کنید ← ⋮ ← More ← Export chat ← Without media. فایل ‎.txt یا ‎.zip را این‌جا آپلود کنید. شماره تلفن، ایمیل، آدرس و نام افراد حذف می‌شود و تا شما تأیید نکنید چیزی ذخیره نمی‌شود.</div></div></div>
    <div data-out></div>`;
  bindTabs(c);
  const msg = (t, ok) => { $('[data-msg]', c).innerHTML = t ? `<div class="${ok ? 'okmsg' : 'err'}">${esc(t)}</div>` : ''; };
  const run = async business => {
    const fd = new FormData(); fd.append('file', file, file.name); if (business) fd.append('business', business);
    msg('Reading…', true);
    const r = await fetch('/api/admin/chat/import', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': A().csrf }, body: fd });
    let d = {}; try { d = await r.json(); } catch {}
    if (!r.ok) throw new Error(d.error || 'The chat could not be read.');
    res = d; msg(d.error || `${d.messages} messages in ${d.chats} chat${d.chats === 1 ? '' : 's'} · ${d.candidates.length} suggestion${d.candidates.length === 1 ? '' : 's'}`, !d.error);
    $('[data-who]', c).innerHTML = d.participants.length > 1 ? `<div class="imp-who"><b>Who is the business?</b> <span class="hint">(answers are taken from this person)</span>${d.participants.map((p, i) => `<label><input type="radio" name="biz" value="${i}" ${p.name === d.business ? 'checked' : ''}> ${esc(p.name)} <small>${p.messages} msgs</small></label>`).join('')}</div>` : '';
    $$('[name=biz]', c).forEach(rb => rb.onchange = () => run(d.participants[+rb.value].name).catch(e => msg(e.message)));
    draw();
  };
  $('[data-up]', c).onsubmit = async e => {
    e.preventDefault(); file = e.target.file.files[0]; if (!file) return;
    const b = e.target.querySelector('button'); b.disabled = true;
    try { await run(''); } catch (er) { msg(er.message); } finally { b.disabled = false; }
  };
  const draw = () => {
    const out = $('[data-out]', c);
    if (!res || !res.candidates.length) { out.innerHTML = res ? '<div class="card empty" style="margin-top:18px">No question-and-answer pairs were found. Try choosing the other person as the business above.</div>' : ''; return; }
    out.innerHTML = `<div class="toolbar imp-bar"><b>${res.candidates.length} suggestions</b><button class="btn ghost sm" data-all>Select all</button><button class="btn ghost sm" data-none>Select none</button>${ai ? '<button class="btn ghost sm" data-ai>Tidy selected with AI</button>' : ''}<button class="btn sm" data-add>Add selected to knowledge base</button></div>
      <div class="imp-list">${res.candidates.map((x, i) => `<div class="card imp-c" data-i="${i}">
        <label class="imp-pick"><input type="checkbox" data-pick> Use</label>
        <div class="imp-meta">${x.count > 1 ? `<span class="pill">asked ${x.count}×</span>` : ''}${x.similar ? `<span class="pill warn" title="An existing Q&A may already answer this">similar: ${esc(x.similar)}</span>` : ''}</div>
        <label class="field"><span>Question</span><input class="input" dir="auto" data-k="question" maxlength="300" value="${esc(x.question)}"></label>
        <label class="field"><span>Answer</span><textarea class="input" dir="auto" data-k="answer" rows="3" maxlength="3000">${esc(x.answer)}</textarea></label>
        ${x.answerFa ? `<label class="field"><span>Persian answer</span><textarea class="input" data-k="answerFa" rows="3" maxlength="3000" dir="rtl">${esc(x.answerFa)}</textarea></label>` : ''}
        <label class="field"><span>Keywords</span><input class="input" data-k="keywords" maxlength="500" value="${esc(x.keywords)}"></label>
        ${x.alternatives && x.alternatives.length ? `<details><summary class="hint">Other answers your team gave (${x.alternatives.length})</summary>${x.alternatives.map(a => `<p class="imp-alt" dir="auto">${esc(a)} <button type="button" class="linkbtn" data-use="${esc(a)}">Use this</button></p>`).join('')}</details>` : ''}
      </div>`).join('')}</div>`;
    const sync = () => $$('.imp-c', out).forEach(card => { const x = res.candidates[+card.dataset.i]; $$('[data-k]', card).forEach(inp => x[inp.dataset.k] = inp.value); x.picked = $('[data-pick]', card).checked; });
    $$('[data-use]', out).forEach(b => b.onclick = () => { b.closest('.imp-c').querySelector('[data-k=answer]').value = b.dataset.use; });
    $('[data-all]', out).onclick = () => $$('[data-pick]', out).forEach(x => x.checked = true);
    $('[data-none]', out).onclick = () => $$('[data-pick]', out).forEach(x => x.checked = false);
    $('[data-add]', out).onclick = async ev => {
      sync(); const pick = res.candidates.filter(x => x.picked && x.question.trim() && (x.answer.trim() || (x.answerFa || '').trim()));
      if (!pick.length) return A().toast('Tick “Use” on the suggestions you want to add.');
      ev.target.disabled = true;
      try { const r = await A().api('/chat/kb/bulk', { entries: pick.map(x => ({ question: x.question, answer: x.answer.trim() || x.answerFa, answerFa: x.answerFa || '', keywords: x.keywords })) });
        A().toast(`Added ${r.added} Q&A to the knowledge base`); res.candidates = res.candidates.filter(x => !x.picked); draw(); }
      catch (er) { A().toast(er.message); } finally { ev.target.disabled = false; }
    };
    const aib = $('[data-ai]', out); if (aib) aib.onclick = async () => {
      sync(); const pick = res.candidates.filter(x => x.picked); if (!pick.length) return A().toast('Tick the suggestions to tidy (up to 40).');
      aib.disabled = true; aib.textContent = 'Tidying…';
      try { const r = await A().api('/chat/import/ai', { candidates: pick.slice(0, 40) }); res.candidates = [...r.candidates, ...res.candidates.filter(x => !x.picked)]; draw(); A().toast(`AI rewrote ${r.candidates.length} suggestions — review them before adding`); }
      catch (er) { A().toast(er.message); aib.disabled = false; aib.textContent = 'Tidy selected with AI'; }
    };
  };
}

/* ================= settings ================= */
async function viewSettings() {
  const c = A().shell('Live chat', 'Business', '<div class="card empty">Loading…</div>', '/chat');
  let s = (await A().api('/chat/settings')).settings;
  const draw = () => {
    c.innerHTML = `${tabs('/chat/settings')}<form data-f class="grid g2 chat-set">
      <div class="card"><h2>Chat widget</h2>
        <label class="field"><span><input type="checkbox" name="enabled" ${s.enabled ? 'checked' : ''} style="width:auto"> Show the chat bubble on the website</span></label>
        <label class="field"><span>Welcome message (English pages)</span><textarea name="welcome" rows="3" maxlength="500">${esc(s.welcome)}</textarea></label>
        <label class="field"><span>Welcome message (Persian pages)</span><textarea name="welcomeFa" rows="3" maxlength="500" dir="rtl">${esc(s.welcomeFa)}</textarea></label>
        <label class="field"><span>WhatsApp number (optional)</span><input name="whatsapp" value="${esc(s.whatsapp)}" placeholder="19059626222" inputmode="tel"><div class="hint">Full international number, digits only (Canada starts with 1). Leave empty to hide the “WhatsApp” button.</div></label>
        <label class="field"><span>Email for chat alerts</span><input name="notifyEmail" type="email" value="${esc(s.notifyEmail)}" placeholder="${esc(s.defaultNotify || 'info@satingraphic.ca')}"><div class="hint">Gets the transcript when a visitor asks for a person outside office hours or nobody replies in time. Empty = ${esc(s.defaultNotify || 'site notification email')}.</div></label>
        <label class="field"><span>Minutes to wait for a team reply before emailing</span><input name="waitMinutes" type="number" min="1" max="30" value="${esc(s.waitMinutes)}"></label>
        <label class="field"><span>Quick replies (one per line)</span><textarea name="quickReplies" rows="6">${esc(s.quickReplies.join('\n'))}</textarea></label>
      </div>
      <div>
      <div class="card"><h2>Office hours <small class="pill ${s.openNow ? 'confirmed' : ''}">${s.openNow ? 'Open now' : 'Closed now'}</small></h2><p class="hint">Toronto time. Outside these hours “Talk to a person” tells the visitor we will reply by email, and you get the transcript by email.</p>
        <table class="chat-hours-t">${s.days.map((day, i) => { const h = s.hours[i]; return `<tr data-day="${i}"><td>${day}</td><td><label class="hint"><input type="checkbox" data-closed ${h.closed ? 'checked' : ''}> Closed</label></td><td><input class="input" type="time" data-open value="${esc(h.open)}" ${h.closed ? 'disabled' : ''}></td><td><input class="input" type="time" data-close value="${esc(h.close)}" ${h.closed ? 'disabled' : ''}></td></tr>`; }).join('')}</table></div>
      <div class="card" style="margin-top:18px"><h2>AI answers (optional) ${s.aiKeySet ? `<small class="pill">${esc(s.aiKeyHint)}</small>` : ''}</h2>
        <p class="hint">Without a key the assistant still works: it answers from your Q&amp;A list and website text. With an Anthropic API key it writes natural answers, using only your Q&amp;A and website pages, never inventing prices and offering a person when unsure. Usage is billed by Anthropic to your account.</p>
        <label class="field"><span><input type="checkbox" name="aiEnabled" ${s.aiEnabled ? 'checked' : ''} style="width:auto"> Use AI for answers</span></label>
        <label class="field"><span>Anthropic API key</span><input name="aiKey" type="password" autocomplete="new-password" placeholder="${s.aiKeySet ? 'Saved — leave empty to keep it' : 'sk-ant-…'}"><div class="hint">Write-only: after saving, only the last 4 characters are shown. The key is never sent back to the browser.</div></label>
        <label class="field"><span>Model</span><input name="aiModel" value="${esc(s.aiModel)}" placeholder="${esc(s.defaultModel)}"></label>
        <div class="shop-acts"><button type="button" class="btn ghost sm" data-test ${s.aiKeySet ? '' : 'disabled'}>Test AI connection</button>${s.aiKeySet ? '<button type="button" class="btn danger sm" data-clear>Remove key</button>' : ''}</div><div data-test-out></div>
        <div class="chat-help"><b>Where do I get a key?</b><ol><li>Go to <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> and sign in (or create an account).</li><li>Add a payment method under <b>Billing</b> (or buy credits) and set a monthly spend limit.</li><li>Open <b>API keys</b> → <b>Create key</b>, name it “Satin website chat” and copy it (it starts with <code>sk-ant-</code>).</li><li>Paste it above, tick “Use AI for answers”, save and press <b>Test AI connection</b>.</li></ol>
        <div dir="rtl" lang="fa" class="shop-fa"><b>کلید API را از کجا بگیرم؟</b><ol><li>به <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> بروید و وارد شوید (یا حساب بسازید).</li><li>در بخش <b>Billing</b> روش پرداخت اضافه کنید (یا اعتبار بخرید) و سقف هزینهٔ ماهانه تعیین کنید.</li><li>در بخش <b>API keys</b> روی <b>Create key</b> بزنید، نام «Satin website chat» بگذارید و کلید را کپی کنید (با <code>sk-ant-</code> شروع می‌شود).</li><li>کلید را این‌جا وارد کنید، «Use AI for answers» را تیک بزنید، ذخیره کنید و <b>Test AI connection</b> را بزنید.</li></ol>
        <p>بدون کلید هم دستیار کار می‌کند و از پرسش‌وپاسخ‌ها و متن صفحات سایت جواب می‌دهد.</p></div></div>
      </div></div>
      <div class="shop-acts" style="grid-column:1/-1"><button class="btn" type="submit">Save chat settings</button>${s.updatedAt ? `<span class="hint">Last saved ${esc(A().fmtDate(s.updatedAt))} by ${esc(s.updatedBy || '—')}</span>` : ''}</div></form>`;
    bindTabs(c);
    const f = $('[data-f]', c);
    $$('[data-closed]', f).forEach(cb => cb.onchange = () => { const tr = cb.closest('tr'); $$('input[type=time]', tr).forEach(i => i.disabled = cb.checked); });
    const save = async extra => {
      const hours = $$('tr[data-day]', f).map(tr => ({ closed: $('[data-closed]', tr).checked, open: $('[data-open]', tr).value, close: $('[data-close]', tr).value }));
      const body = { enabled: f.enabled.checked, welcome: f.welcome.value, welcomeFa: f.welcomeFa.value, whatsapp: f.whatsapp.value, notifyEmail: f.notifyEmail.value, waitMinutes: +f.waitMinutes.value,
        quickReplies: f.quickReplies.value.split('\n').map(x => x.trim()).filter(Boolean), hours, aiEnabled: f.aiEnabled.checked, aiModel: f.aiModel.value, aiKey: f.aiKey.value, ...extra };
      try { s = (await A().api('/chat/settings', body)).settings; A().toast('Chat settings saved'); draw(); } catch (e) { A().toast(e.message); }
    };
    f.onsubmit = e => { e.preventDefault(); save({}); };
    const cl = $('[data-clear]', f); if (cl) cl.onclick = () => A().confirmBox('Remove the API key?', 'AI answers stop; the assistant keeps answering from your Q&A and website pages.', () => save({ clearAiKey: true, aiKey: '', aiEnabled: false }));
    const tb = $('[data-test]', f); if (tb) tb.onclick = async () => { tb.disabled = true; const out = $('[data-test-out]', f); out.innerHTML = '<p class="hint">Testing…</p>';
      try { const r = await A().api('/chat/settings/test-ai', {}); out.innerHTML = r.ok ? `<div class="okmsg">Connected — model ${esc(r.model)} answered.</div>` : `<div class="err">${esc(r.error)}</div>`; } catch (e) { out.innerHTML = `<div class="err">${esc(e.message)}</div>`; } tb.disabled = false; };
  };
  draw();
}

/* nav badges: pwa.js (/api/admin/badges) */

window.SatinChat = { route };
})();
