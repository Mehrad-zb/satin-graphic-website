/* Cart shared across a signed-in customer's devices.
   The cart itself stays in localStorage['sg-cart'] (the site bundle and checkout read it there); while the
   "satin_acct" hint cookie is set, it is merged with the account copy at /api/customer/cart (customer.php).
   Three-way merge per item id, against the ids this browser last synced (localStorage['sg-cart-synced']):
     - on the server and here        → kept (server copy: artwork ids are rewritten for this browser)
     - only on the server            → added elsewhere → kept, unless it was synced here before (removed here → dropped)
     - only here                     → added here → kept, unless it was synced before (removed elsewhere → dropped)
   Every change is pushed (debounced). Dispatches "satin-cart-synced" {items} on window after each merge. */
const KEY = 'sg-cart', SYNCED = 'sg-cart-synced', API = '/api/customer/cart';
const signedIn = () => /(?:^|;\s*)satin_acct=1/.test(document.cookie);
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
const idOf = i => String(i && i.id);
let csrf = '', revision = null, customer = null, running = null, timer = null, again = false;

export function mergeCarts(server, local, base) {
  const inServer = new Set(server.map(idOf)), inLocal = new Set(local.map(idOf)), out = [];
  for (const i of server) { const k = idOf(i); if (inLocal.has(k) || !base.has(k)) out.push(i); }
  for (const i of local) { const k = idOf(i); if (!inServer.has(k) && !base.has(k)) out.push(i); }
  return out;
}
async function fetchServer() {
  const r = await fetch(API, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (r.status === 401) return null; // signed out (the hint cookie is cleared by /api/customer/me)
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || 'Cart sync failed');
  csrf = d.csrf || ''; revision = d.revision; customer = d.customer;
  return Array.isArray(d.items) ? d.items : [];
}
async function pushServer(items) {
  const body = JSON.stringify({ items, revision });
  const send = method => fetch(API, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body });
  let r = await send('PUT');
  if ([403, 405, 501].includes(r.status) && !(r.headers.get('content-type') || '').includes('json')) r = await send('POST'); // hosts that block PUT
  const d = await r.json().catch(() => ({}));
  if (r.status === 409) return false;
  if (!r.ok) throw Error(d.error || 'Cart sync failed');
  revision = d.revision;
  return true;
}
/** Merges the account cart into this browser (and pushes local changes). Resolves to the merged items, or null when not signed in. */
export function syncCart() {
  if (!signedIn()) return Promise.resolve(null);
  if (running) { again = true; return running; }
  running = (async () => {
    for (let n = 0; n < 4; n++) {
      const server = await fetchServer();
      if (!server) return null;
      const st = read(SYNCED, null), base = new Set(st && st.customer === customer && Array.isArray(st.ids) ? st.ids.map(String) : []);
      const before = localStorage.getItem(KEY), local = read(KEY, []);
      const merged = mergeCarts(server, Array.isArray(local) ? local : [], base);
      if (JSON.stringify(merged) !== JSON.stringify(server) && !(await pushServer(merged))) continue; // changed on another device meanwhile: merge again
      if (localStorage.getItem(KEY) !== before) continue; // changed in this browser meanwhile
      write(KEY, merged); write(SYNCED, { customer, ids: merged.map(idOf) });
      dispatchEvent(new CustomEvent('satin-cart-synced', { detail: { items: merged } }));
      return merged;
    }
    return null;
  })().catch(e => { console.warn('cart sync:', e.message); return null; }).finally(() => { running = null; if (again) { again = false; scheduleCartPush(); } });
  return running;
}
/** Pushes a local change soon (several quick changes are sent together). */
export function scheduleCartPush(delay = 500) {
  if (!signedIn()) return;
  clearTimeout(timer); timer = setTimeout(() => { syncCart(); }, delay);
}
/** Signing out on this browser: the account cart stays on the server; this browser forgets it. */
export function forgetCart() { try { localStorage.removeItem(KEY); localStorage.removeItem(SYNCED); } catch { } }
