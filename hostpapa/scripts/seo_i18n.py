#!/usr/bin/env python3
"""Server-side translation of SEO-critical text on the /satin/{fa,fr,es}/ language copies.

usage: python3 seo_i18n.py /home/claude/hp/out        (run after seo_pass.py)

For every fa/fr/es index.html under <out>/new.satingraphic.ca/satin/ it rewrites, in place:
  * <html lang/dir>        -> the page language (fa = rtl), as the client sets it at runtime
  * <title>, og:title, twitter:title   -> translated when the English title text is known
  * meta description, og:description, twitter:description  -> "{translated h1/title} — {localized boilerplate}"
  * the page <h1>          -> translated when known (the client re-applies the static h1 after rendering: SERVER_HEAD)
  * JSON-LD string values that were exactly the old title/h1 text
  * text nodes and alt/aria-label/placeholder inside the header, <main> and the footer, using ONLY the client dictionary
    (TRANSLATIONS in satin.*.js + studio/i18n.mjs), i.e. exactly what the client translator does at runtime.
Translations come from the client dictionary: TRANSLATIONS in satin.*.js + studio/i18n.mjs + /i18n-content.<lang>.mjs
(page copy, loaded by the bundle on fa/fr/es pages; this pass also adds a modulepreload for it), then the optional seo_i18n_strings.json (head/h1 only).
Only text and attribute values change; tags, scripts, the bootstrap JSON and hydration markers are untouched.
English pages are never read for writing. The pass is idempotent: strings that already are a translation are skipped,
so neither this script nor the client can translate them a second time. A title change that would duplicate another
page's title in the same language is not applied.
"""
import ast, glob, html, json, os, re, subprocess, sys, time
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = ('fa', 'fr', 'es')
LOCALE = {'fa': ('fa', 'rtl'), 'fr': ('fr-CA', 'ltr'), 'es': ('es', 'ltr')}
LANG_NAME = {'fr': 'Français', 'es': 'Español', 'fa': 'فارسی'}
MARKER = re.compile(r'^(.*?) – (?:Français|Español|فارسی)$')
PROTECTED = {'script', 'style', 'svg', 'template', 'textarea', 'noscript', 'code', 'pre'}
OPTION_NOVALUE = re.compile(r'<option(?![^>]*\bvalue=)([^>]*)>([^<]*)</option>')
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
TAG = re.compile(r'(<!--.*?-->|<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>)', re.S)
ATTR = re.compile(r'(\s(?:alt|aria-label|placeholder)=")([^"]*)(")')
FA_CHARS = re.compile(r'[؀-ۿ]')

def esc_text(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def esc_attr(s): return esc_text(s).replace('"', '&quot;')

# ---------- dictionaries ----------
def load_client_dict(doc):
    try:
        r = subprocess.run(['node', '--no-warnings', os.path.join(HERE, 'runner', 'i18n-dict.mjs'), doc], capture_output=True, text=True, timeout=120)
        if r.returncode: raise RuntimeError(r.stderr.strip()[-400:])
        return json.loads(r.stdout)['dict']
    except Exception as e:
        print('seo_i18n: WARNING client dictionary unavailable (' + str(e) + '); using seo_i18n_strings.json only', file=sys.stderr)
        return {}

def load_lang_desc():
    """LANG_DESC templates from seo_pass.py (parsed, not executed) so descriptions stay in the same format."""
    try:
        for node in ast.walk(ast.parse(open(os.path.join(HERE, 'seo_pass.py'), encoding='utf-8').read())):
            if isinstance(node, ast.Assign) and any(getattr(t, 'id', None) == 'LANG_DESC' for t in node.targets):
                return ast.literal_eval(node.value)
    except Exception: pass
    return {}

class Lookup:
    def __init__(self, entries):
        self.exact = {}; self.lower = {}
        for k, v in entries.items():
            if not isinstance(v, dict): continue
            self.exact[k] = v
            self.lower.setdefault(k.lower(), v)      # first key wins, like Array.find in the client
    def get(self, clean, lang):
        e = self.exact.get(clean) or self.lower.get(clean.lower())
        return (e or {}).get(lang)

CLIENT = SUPP = None
DOC = ''
VALUES = {}          # lang -> set of strings that already are translations (never translated again)
LANG_DESC = {}

def init(client, supp, lang_desc, doc=''):
    global CLIENT, SUPP, VALUES, LANG_DESC, DOC
    DOC = doc
    CLIENT, SUPP, LANG_DESC = Lookup(client), Lookup(supp), lang_desc
    VALUES = {l: {v[l].strip() for d in (client, supp) for v in d.values() if isinstance(v, dict) and v.get(l)} for l in LANGS}

def translate(text, lang, supplemental=True):
    """Client tr() semantics: whole trimmed string lookup, exact then case-insensitive; keeps surrounding whitespace."""
    clean = text.strip()
    if not clean or clean in VALUES[lang]: return text
    v = CLIENT.get(clean, lang) or (SUPP.get(clean, lang) if supplemental else None)
    return text.replace(clean, v, 1) if v else text

def tr_head(s, lang):
    """Translate a head string (title text / h1 text / description prefix), tolerating a trailing period."""
    if not s: return None
    t = translate(s, lang)
    if t != s: return t
    if s.endswith('.'): return None
    t = translate(s + '.', lang)
    return t.rstrip('.') if t != s + '.' else None

# ---------- page rewriting ----------
def body_pass(seg, lang):
    """Translate text nodes and alt/aria-label/placeholder in an HTML fragment with the client dictionary only."""
    out, prot, notr = [], 0, []   # notr: stack of [tagname, depth] for [data-no-translate] elements
    n = 0
    # like localizedHTML() in the client: an <option> without value= keeps its English label as the value before its text is translated
    seg = OPTION_NOVALUE.sub(lambda m: m.group(0) if translate(html.unescape(m.group(2)), lang, False) == html.unescape(m.group(2))
                             else '<option' + m.group(1) + ' value="' + esc_attr(html.unescape(m.group(2))) + '">' + m.group(2) + '</option>', seg)
    for part in TAG.split(seg):
        if not part: continue
        if part.startswith('<'):
            if part.startswith('<!--'): out.append(part); continue
            m = re.match(r'<(/?)([a-zA-Z][\w-]*)', part)
            if m:
                closing, name = m.group(1) == '/', m.group(2).lower()
                selfclose = part.endswith('/>') or name in VOID
                if notr:
                    if name == notr[-1][0] and not selfclose: notr[-1][1] += -1 if closing else 1
                    if notr[-1][1] == 0: notr.pop()
                elif not closing and not selfclose and 'data-no-translate' in part: notr.append([name, 1])
                if name in PROTECTED and not selfclose: prot += -1 if closing else 1
                prot = max(prot, 0)
                if not closing and not prot and not notr and name not in PROTECTED:
                    def attr(a):
                        nonlocal n
                        old = html.unescape(a.group(2)); new = translate(old, lang, False)
                        if new == old: return a.group(0)
                        n += 1; return a.group(1) + esc_attr(new) + a.group(3)
                    part = ATTR.sub(attr, part)
            out.append(part)
        elif prot or notr or not part.strip():
            out.append(part)
        else:
            old = html.unescape(part); new = translate(old, lang, False)
            if new != old: n += 1; out.append(esc_text(new))
            else: out.append(part)
    return ''.join(out), n

def set_meta(s, attr, key, value):
    rx = re.compile(r'(<meta ' + attr + '="' + re.escape(key) + r'" content=")([^"]*)(")')
    return rx.sub(lambda m: m.group(1) + esc_attr(value) + m.group(3), s, count=1)

def get_meta(s, attr, key):
    m = re.search(r'<meta ' + attr + '="' + re.escape(key) + r'" content="([^"]*)"', s)
    return html.unescape(m.group(1)) if m else None

PROJECT_WORD = {'fr': 'projet', 'es': 'proyecto', 'fa': 'پروژه'}
FA_DIGITS = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')

def get_title(s):
    m = re.search(r'<title>(.*?)</title>', s, re.S)
    return html.unescape(m.group(1)) if m else None

def set_title(s, t):
    m = re.search(r'<title>(.*?)</title>', s, re.S)
    return s[:m.start()] + '<title>' + esc_text(t) + '</title>' + s[m.end():]

def fit_title(head):
    for tail in (' | Satin Graphic', ' | Satin'):
        if len(head + tail) <= 60: return head + tail
    return head + ' | Satin'

def new_description(d, lang):
    if not d or ' — ' not in d: return None
    x, rest = d.split(' — ', 1)
    t = tr_head(x, lang)
    if not t: return None
    tpl = LANG_DESC.get(lang)
    if tpl and '{}' in tpl and tpl.split('{}', 1)[1].startswith(' — ' + rest.rstrip('…').rstrip()):
        nd = tpl.format(t.rstrip('.'))
    else:
        nd = t.rstrip('.') + ' — ' + rest
    if len(nd) > 160: nd = nd[:157].rsplit(' ', 1)[0].rstrip(',;:—–-') + '…'
    return nd if nd != d else None

def process(job):
    path, lang, en_path, allow_title = job
    s0 = s = open(path, encoding='utf-8').read()
    stats = {'title': 0, 'h1': 0, 'desc': 0, 'lang': 0, 'preload': 0, 'text': 0, 'jsonld': 0}
    repl = {}   # old string -> new string, for JSON-LD
    # 1. <html lang dir>
    loc, d = LOCALE[lang]
    m = re.search(r'<html\b[^>]*>', s)
    if m:
        tag = m.group(0); new = re.sub(r'\s(lang|dir)="[^"]*"', '', tag)[:-1] + f' lang="{loc}" dir="{d}">'
        if not re.search(r'\slang="' + re.escape(loc) + '"', tag) or not re.search(r'\sdir="' + d + '"', tag):
            s = s.replace(tag, new, 1); stats['lang'] = 1
    # 1b. preload this language's page-copy dictionary (the bundle imports it first thing on fa/fr/es pages)
    pre = '/i18n-content.' + lang + '.mjs'
    if 'href="' + pre + '"' not in s and '</head>' in s and os.path.isfile(os.path.join(DOC, pre.lstrip('/'))):
        s = s.replace('</head>', '<link rel="modulepreload" href="' + pre + '"></head>', 1); stats['preload'] = 1
    # 2. <title> (+ og/twitter)
    tm = re.search(r'<title>(.*?)</title>', s, re.S)
    old_title = html.unescape(tm.group(1)) if tm else ''
    new_title = None
    if tm and allow_title and ' | ' in old_title:
        head = old_title.rsplit(' | ', 1)[0]
        cands = []
        mk = MARKER.match(head)
        en_head = None
        if en_path and os.path.isfile(en_path):
            em = re.search(r'<title>(.*?)</title>', open(en_path, encoding='utf-8').read(), re.S)
            en_head = html.unescape(em.group(1)).rsplit(' | ', 1)[0] if em else None
        if mk: cands = [en_head, mk.group(1)]
        elif ' · ' not in head and (head == en_head or (lang == 'fa' and not FA_CHARS.search(head))): cands = [head]
        for c in cands:
            t = tr_head(c, lang) if c else None
            if t: new_title = fit_title(t); break
        if new_title and new_title != old_title:
            s = s[:tm.start()] + '<title>' + esc_text(new_title) + '</title>' + s[tm.end():]
            for attr, key in (('property', 'og:title'), ('name', 'twitter:title')):
                if get_meta(s, attr, key) == old_title: s = set_meta(s, attr, key, new_title)
            stats['title'] = 1; repl[old_title] = new_title
            if mk: repl[mk.group(1)] = new_title.rsplit(' | ', 1)[0]
        else: new_title = None
    # 3. <h1> inside <main>
    a = s.find('<main')
    hm = re.compile(r'(<h1\b[^>]*>)(.*?)(</h1>)', re.S).search(s, a if a >= 0 else 0)
    if hm:
        inner = hm.group(2); text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', inner))).strip()
        new_inner = None
        if '<' not in inner:
            t = translate(html.unescape(inner), lang)
            if t != html.unescape(inner): new_inner = esc_text(t)
        else:   # inline markup: translate each text segment
            parts = TAG.split(inner); ch = False
            for i, p in enumerate(parts):
                if p and not p.startswith('<') and p.strip():
                    t = translate(html.unescape(p), lang)
                    if t != html.unescape(p): parts[i] = esc_text(t); ch = True
            if ch: new_inner = ''.join(parts)
        if new_inner is not None:
            s = s[:hm.start()] + hm.group(1) + new_inner + hm.group(3) + s[hm.end():]
            stats['h1'] = 1
            repl[text] = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', new_inner))).strip()
    # 4. descriptions
    for attr, key in (('name', 'description'), ('property', 'og:description'), ('name', 'twitter:description')):
        dsc = get_meta(s, attr, key); nd = new_description(dsc, lang)
        if nd: s = set_meta(s, attr, key, nd); stats['desc'] = 1; repl[dsc] = nd
    # 4b. English disambiguates same-named portfolio projects with "· Project N"; carry that over so titles/descriptions stay unique
    if en_path and os.path.isfile(en_path):
        em = re.search(r'<title>(.*?) · Project (\d+) \| ', open(en_path, encoding='utf-8').read())
        if em:
            num = em.group(2) if lang != 'fa' else em.group(2).translate(FA_DIGITS)
            word = PROJECT_WORD[lang]
            cur = get_title(s)
            if cur and ' | ' in cur:
                head0, tail = cur.rsplit(' | ', 1)
                parts = [x.strip(' ·') for x in head0.split(' · ')]
                parts = [x for x in parts if x and not re.fullmatch(r'(?i)' + re.escape(word) + r'(\s+\S+)?', x)]
                head = ' · '.join(parts)
            if cur and ' | ' in cur and (head + ' · ' + word.capitalize() + ' ' + num + ' | ' + tail) != cur:
                nt = head + ' · ' + word.capitalize() + ' ' + num + ' | ' + tail
                s = set_title(s, nt)
                for attr, key in (('property', 'og:title'), ('name', 'twitter:title')):
                    if get_meta(s, attr, key) == cur: s = set_meta(s, attr, key, nt)
                repl[cur] = nt; stats['title'] = 1
                if new_title: new_title = nt
            for attr, key in (('name', 'description'), ('property', 'og:description'), ('name', 'twitter:description')):
                dsc = get_meta(s, attr, key)
                if dsc and (word + ' ' + num).lower() not in dsc.lower():
                    nd = dsc.rstrip('.…').rstrip() + ' (' + word + ' ' + num + ').'
                    if len(nd) > 160: nd = dsc[:160 - len(word + num) - 6].rsplit(' ', 1)[0].rstrip(',;:—–-.') + ' (' + word + ' ' + num + ').'
                    s = set_meta(s, attr, key, nd); stats['desc'] = 1; repl[dsc] = nd
    # 5. JSON-LD: values that were exactly an old string
    if repl:
        def fix_ld(m):
            body = m.group(2)
            for old, new in repl.items():
                if not old or old == new: continue
                for ea in (False, True):
                    o = json.dumps(old, ensure_ascii=ea); nw = json.dumps(new, ensure_ascii=ea).replace('</', '<\\/')
                    if o in body: body = body.replace(o, nw); stats['jsonld'] += 1
            return m.group(1) + body + m.group(3)
        s = re.sub(r'(<script type="application/ld\+json"[^>]*>)(.*?)(</script>)', fix_ld, s, flags=re.S)
    # 6. visible text in the header, <main> and the footer (client dictionary only)
    for rx in (re.compile(r'(<header\b[^>]*class="[^"]*\bhdr\b[^"]*"[^>]*>)(.*?)(</header>)', re.S), re.compile(r'(<main\b[^>]*>)(.*?)(</main>)', re.S),
               re.compile(r'(<footer\b[^>]*class="[^"]*\bftr\b[^"]*"[^>]*>)(.*?)(</footer>)', re.S)):
        mm = rx.search(s)
        if mm:
            seg, n = body_pass(mm.group(2), lang)
            if n: s = s[:mm.start(2)] + seg + s[mm.end(2):]; stats['text'] += n
    if s != s0:
        with open(path, 'w', encoding='utf-8') as f: f.write(s)
    return path, lang, old_title, new_title, stats, s != s0

def main():
    if len(sys.argv) != 2: print(__doc__.split('\n')[2]); sys.exit(2)
    t0 = time.time()
    doc = os.path.join(sys.argv[1], 'new.satingraphic.ca')
    base = os.path.join(doc, 'satin')
    client = load_client_dict(doc)
    sp = os.path.join(HERE, 'seo_i18n_strings.json')   # optional extra head-only strings; page copy lives in /i18n-content.<lang>.mjs
    supp = json.load(open(sp, encoding='utf-8'))['strings'] if os.path.isfile(sp) else {}
    # a supplemental value must never be an English key: that would let the client translate it again
    both = Lookup({**supp, **client})
    for k, v in list(supp.items()):
        for l, t in list(v.items()):
            if both.get(t.strip(), l) not in (None, t.strip()):
                print(f'seo_i18n: WARNING dropping {l} translation of {k!r}: {t!r} is itself a dictionary key', file=sys.stderr); del v[l]
    init(client, supp, load_lang_desc(), doc)
    jobs = []
    for lang in LANGS:
        for f in sorted(glob.glob(os.path.join(base, lang, '**', 'index.html'), recursive=True)):
            rel = os.path.relpath(f, os.path.join(base, lang))
            jobs.append((f, lang, os.path.join(base, rel), True))
    # current titles per language (for the no-new-duplicates rule)
    def titles_now(paths):
        r = {}
        for f in paths:
            m = re.search(r'<title>(.*?)</title>', open(f, encoding='utf-8').read(), re.S)
            r[f] = html.unescape(m.group(1)) if m else ''
        return r
    before = titles_now([j[0] for j in jobs])
    workers = min(8, os.cpu_count() or 2)
    with ProcessPoolExecutor(workers, initializer=init, initargs=(client, supp, LANG_DESC, doc)) as ex:
        results = list(ex.map(process, jobs, chunksize=16))
    # undo title changes that collide with another page's title in the same language
    after = titles_now([j[0] for j in jobs]); redo = []
    for lang in LANGS:
        seen = {}
        for path, lg, old, new, st, ch in results:
            if lg == lang: seen.setdefault(after[path], []).append((path, old, new))
        for t, lst in seen.items():
            changed = [x for x in lst if x[2]]
            if len(lst) > 1 and changed and not all(before[p] == t for p, _, _ in lst):
                for p, old, new in changed: redo.append((p, old, new))
    for p, old, new in redo:
        s = open(p, encoding='utf-8').read()
        s = s.replace('<title>' + esc_text(new) + '</title>', '<title>' + esc_text(old) + '</title>', 1)
        for attr, key in (('property', 'og:title'), ('name', 'twitter:title')):
            if get_meta(s, attr, key) == new: s = set_meta(s, attr, key, old)
        open(p, 'w', encoding='utf-8').write(s)
        print('seo_i18n: kept original title (would duplicate):', os.path.relpath(p, doc), file=sys.stderr)
    tot = {}
    for *_, st, ch in results:
        for k, v in st.items(): tot[k] = tot.get(k, 0) + (1 if v and k not in ('text', 'jsonld') else v)
    tot['title'] -= len(redo)
    final = titles_now([j[0] for j in jobs]) if redo else after
    left = sum(1 for t in final.values() if MARKER.match(t.rsplit(' | ', 1)[0]))
    print(f"seo_i18n: {len(jobs)} pages ({', '.join(LANGS)}), {sum(1 for r in results if r[5])} rewritten in {time.time() - t0:.1f}s — "
          f"titles {tot.get('title', 0)}, h1 {tot.get('h1', 0)}, descriptions {tot.get('desc', 0)}, html lang {tot.get('lang', 0)}, preloads {tot.get('preload', 0)}, "
          f"text nodes {tot.get('text', 0)}, json-ld {tot.get('jsonld', 0)}; titles still marked '– language': {left}; dictionary {len(client)}+{len(supp)}")

if __name__ == '__main__':
    main()
