#!/usr/bin/env python3
"""Technical SEO audit of the prerendered site (run after seo_pass.py).

Usage: python3 seo_audit.py [OUT_DIR] [--json report.json]
Checks every HTML page under OUT_DIR/new.satingraphic.ca:
  broken internal links (+ links that hit a redirect), duplicate titles / descriptions / H1s, missing or long titles,
  thin pages, orphan pages, canonical consistency, hreflang reciprocity, JSON-LD syntax + required properties,
  mixed content, image file-size outliers, images missing width/height or lazy loading, heading order,
  page weight and the LCP candidate image.
Exit code 1 when an error-level problem is found (broken link, invalid JSON-LD, canonical/hreflang error).
"""
import html, json, os, re, sys, collections
OUT = os.path.abspath(next((a for a in sys.argv[1:] if not a.startswith('--') and not a.endswith('.json')), '/home/claude/hp/out'))
ROOT = OUT + '/new.satingraphic.ca'
JSON_OUT = next((a for a in sys.argv[1:] if a.endswith('.json')), None)
APP = OUT + '/satin-new'
OPT = json.load(open(APP + '/data/optimized-assets.json')) if os.path.exists(APP + '/data/optimized-assets.json') else {}

def clean(x): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x or ''))).strip()

pages = {}
for d, _, files in os.walk(ROOT):
    if 'index.html' in files:
        rel = '/' + os.path.relpath(d, ROOT).replace(os.sep, '/') + '/'
        pages['/' if rel == '/./' else rel] = os.path.join(d, 'index.html')

# paths the server answers without a file (see gen-htaccess.py / api.php)
def server_route(p):
    return (p.startswith('/api/') or p.startswith('/admin') or p in ('/sitemap.xml',) or re.match(r'^/satin/(?:(?:fa|fr|es)/)?checkout/?$', p)
            or p in OPT or (re.match(r'^/satin/img/ext/[0-9a-f]{16}\.\w+$', p) and p.rsplit('/',1)[1] in EXT) or re.match(r'^/invoice/?$', p) or re.match(r'^/[0-9a-f]{32}\.txt$', p))

def resolve(p):
    """-> ('ok'|'redirect'|'missing', target)"""
    if p in pages or os.path.isfile(ROOT + p) or server_route(p): return 'ok', p
    if not p.endswith('/') and (p + '/') in pages: return 'redirect', p + '/'      # Apache DirectorySlash 301
    if p.endswith('/') and os.path.isfile(ROOT + p.rstrip('/')): return 'ok', p
    if os.path.isfile(ROOT + '/notfound.php') or True:
        m = re.match(r'^(/satin/img/.+?)(?:-(?:480|960|1100|1400))?\.(?:png|jpe?g|webp)$', p)
        if m and os.path.isfile(ROOT + m.group(1) + '.optimized.webp'): return 'ok', p   # notfound.php image fallback
    return 'missing', None

_rb = open(ROOT + '/robots.txt').read() if os.path.exists(ROOT + '/robots.txt') else ''
STAGING_BUILD = bool(re.search(r'^Disallow: /\s*$', _rb, re.M)) and 'Allow: /' not in _rb
UTIL_RX = re.compile(r'^/(?:satin/(?:(?:fa|fr|es)/)?)?(account|login|register|track|checkout|cart|pay|404|design-agreement|installation-terms)(/|$)|^/satin/(?:fa|fr|es)/portfolio/projects/')
EXT = json.load(open(APP + '/data/ext-images.json')) if os.path.exists(APP + '/data/ext-images.json') else {}
issues = collections.defaultdict(list)    # kind -> [(page, detail)]
def add(kind, page, detail=''): issues[kind].append((page, detail))
inbound = collections.Counter()
titles, descs, h1s = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
hreflang = {}
canon_of = {}
weights = []
img_sizes = {}

REQ = {  # Google rich-result required properties (subset relevant to this site)
    'BreadcrumbList': ['itemListElement'], 'FAQPage': ['mainEntity'], 'Product': ['name'], 'Article': ['headline'], 'BlogPosting': ['headline'],
    'LocalBusiness': ['name', 'address'], 'Service': ['name'], 'Offer': [], 'AggregateOffer': ['lowPrice', 'priceCurrency'], 'Review': ['author', 'reviewRating'],
    'AggregateRating': ['ratingValue'], 'ImageObject': [], 'VideoObject': ['name', 'thumbnailUrl', 'uploadDate'], 'HowTo': ['name', 'step'], 'ItemList': ['itemListElement'],
}
def check_node(n, page, path='@graph'):
    if isinstance(n, list):
        for i, x in enumerate(n): check_node(x, page, f'{path}[{i}]')
        return
    if not isinstance(n, dict): return
    t = n.get('@type'); ts = t if isinstance(t, list) else [t]
    for tt in ts:
        for r in REQ.get(tt, []):
            if n.get(r) in (None, '', []): add('schema-missing-prop', page, f'{tt}.{r} at {path}')
        if tt == 'Product' and not any(k in n for k in ('offers', 'review', 'aggregateRating')): add('schema-product-no-offer', page, n.get('name', '')[:60])
        if tt == 'Offer' and 'price' in n and 'priceCurrency' not in n: add('schema-missing-prop', page, 'Offer.priceCurrency')
        if tt == 'FAQPage':
            for q in n.get('mainEntity', []):
                if not q.get('name') or not (q.get('acceptedAnswer') or {}).get('text'): add('schema-missing-prop', page, 'FAQ question/answer empty')
        if tt == 'BreadcrumbList':
            for i, it in enumerate(n.get('itemListElement', [])):
                if it.get('position') != i + 1 or not it.get('name'): add('schema-missing-prop', page, 'Breadcrumb position/name')
                if i < len(n['itemListElement']) - 1 and not it.get('item'): add('schema-missing-prop', page, 'Breadcrumb item URL')
        if tt in ('Article', 'BlogPosting') and not n.get('datePublished'): add('schema-recommended', page, 'Article.datePublished')
        if tt == 'AggregateRating' or 'aggregateRating' in n: add('schema-review-check', page, 'aggregateRating present — make sure it is not self-serving on LocalBusiness')
    for k, v in n.items():
        if isinstance(v, (dict, list)): check_node(v, page, f'{path}.{k}')

for page, f in sorted(pages.items()):
    s = open(f, encoding='utf-8', errors='replace').read()
    weights.append((len(s.encode()), page))
    robots = re.search(r'<meta name="robots" content="([^"]*)"', s)
    noindex = bool(robots and 'noindex' in robots.group(1))
    if STAGING_BUILD: noindex = bool(UTIL_RX.match(page))      # staging: every page is noindex; audit as production
    refresh = 'http-equiv="refresh"' in s
    lang_dir = re.match(r'^/satin/(fa|fr|es)/', page)
    # links
    for href in re.findall(r'\shref="([^"]+)"', s):
        if href.startswith(('http://', 'https://', 'mailto:', 'tel:', '#', 'javascript:', 'data:', '//')):
            if href.startswith('http://') and not re.match(r'http://(www\.)?w3\.org|http://schema\.org', href): add('mixed-content-link', page, href)
            continue
        p = html.unescape(href).split('#')[0].split('?')[0]
        if not p.startswith('/'): continue
        st, tgt = resolve(p)
        if st == 'missing': add('broken-link', page, p)
        elif st == 'redirect': add('redirect-link', page, f'{p} -> {tgt}')
        if tgt in pages and tgt != page: inbound[tgt] += 1
    for src in re.findall(r'\s(?:src|srcset|poster)="([^"]+)"', s):
        for u in [x.strip().split(' ')[0] for x in src.split(',')]:
            if u.startswith('http://'): add('mixed-content', page, u)
            elif u.startswith('/'):
                p = u.split('?')[0].split('#')[0]
                if resolve(p)[0] == 'missing': add('broken-resource', page, p)
    if refresh: continue
    head = s.split('</head>')[0]
    a, b = s.find('<main'), s.find('</main>'); main = s[a:b] if a >= 0 else ''
    # title / description / h1
    t = re.search(r'<title>(.*?)</title>', head, re.S); title = html.unescape(t.group(1)).strip() if t else ''
    d = re.search(r'<meta name="description" content="([^"]*)"', head); desc = html.unescape(d.group(1)) if d else ''
    if not title: add('missing-title', page)
    elif len(title) > 65: add('long-title', page, f'{len(title)}: {title}')
    if not noindex:
        if not desc: add('missing-description', page)
        elif len(desc) > 165: add('long-description', page, str(len(desc)))
        elif len(desc) < 70: add('short-description', page, desc)
        titles[title].append(page); descs[desc].append(page)
    h1 = re.findall(r'<h1[^>]*>(.*?)</h1>', main, re.S)
    if not main: pass
    elif len(h1) == 0: add('missing-h1', page)
    elif len(h1) > 1: add('multiple-h1', page, str(len(h1)))
    if h1 and not noindex: h1s[clean(h1[0]).lower()].append(page)
    # heading order
    levels = [int(x) for x in re.findall(r'<h([1-6])\b', main)]
    prev = 1
    for lv in levels:
        if lv > prev + 1: add('heading-skip', page, f'h{prev} -> h{lv}'); break
        prev = lv
    # thin content
    text = clean(re.sub(r'<(script|style|nav|form|select)[^>]*>.*?</\1>', ' ', main, flags=re.S))
    words = len(text.split())
    if main and not noindex and words < 250 and not lang_dir: add('thin-page', page, f'{words} words')
    # canonical
    c = re.search(r'<link rel="canonical" href="([^"]+)"', head)
    origin = None
    if c:
        canon = c.group(1); m = re.match(r'(https?://[^/]+)(/.*)', canon)
        origin = m.group(1) if m else None
        cp = m.group(2) if m else canon
        canon_of[page] = cp
        if cp != page and not noindex: add('canonical-other', page, cp)
        if cp not in pages: add('canonical-missing-target', page, cp)
        if canon.startswith('http://'): add('canonical-http', page, canon)
    elif not noindex and page.startswith('/satin/'): add('missing-canonical', page)
    og = re.search(r'<meta property="og:url" content="([^"]+)"', head)
    if c and og and og.group(1) != c.group(1): add('og-url-mismatch', page, og.group(1))
    # hreflang
    alts = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', head)
    hreflang[page] = {hl: re.sub(r'^https?://[^/]+', '', u) for hl, u in alts}
    # JSON-LD
    for js in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', s, re.S):
        try: data = json.loads(js)
        except Exception as e: add('schema-invalid-json', page, str(e)[:80]); continue
        if '@context' not in data: add('schema-missing-prop', page, '@context')
        check_node(data.get('@graph', data), page)
    # images
    first_main_img = None
    for mm in re.finditer(r'<img\b[^>]*>', s):
        tag = mm.group(0)
        src = re.search(r'\ssrc="([^"]+)"', tag); src = src.group(1) if src else ''
        if not re.search(r'\salt="', tag): add('img-missing-alt', page, src)
        if src.startswith('/') and not src.startswith('//'):
            if not (re.search(r'\swidth=', tag) and re.search(r'\sheight=', tag)): add('img-missing-dimensions', page, src)
            p = src.split('?')[0]
            fpath = ROOT + p if os.path.isfile(ROOT + p) else (ROOT + OPT[p] if p in OPT and os.path.isfile(ROOT + OPT[p]) else None)
            if fpath: img_sizes[p] = os.path.getsize(fpath)
        in_main = a >= 0 and a < mm.start() < b
        if in_main:
            if first_main_img is None:
                first_main_img = src
                if 'loading="lazy"' in tag: add('lcp-lazy', page, src)
            elif 'loading=' not in tag and 'fetchpriority' not in tag: add('img-not-lazy', page, src)

# site-level
for t, ps in titles.items():
    if len(ps) > 1: add('duplicate-title', ps[0], f'{len(ps)}× "{t}" e.g. {ps[1:4]}')
for d, ps in descs.items():
    if d and len(ps) > 1: add('duplicate-description', ps[0], f'{len(ps)}× e.g. {ps[1:4]}')
for h, ps in h1s.items():
    if h and len(ps) > 1: add('duplicate-h1', ps[0], f'{len(ps)}× "{h[:60]}" e.g. {ps[1:4]}')
sitemap = set()
if os.path.exists(ROOT + '/satin/sitemap.xml'):
    sitemap = {re.sub(r'^https?://[^/]+', '', u) for u in re.findall(r'<loc>([^<]+)</loc>', open(ROOT + '/satin/sitemap.xml').read())}
    for u in sitemap:
        if u not in pages: add('sitemap-missing-page', u)
for page in pages:
    if page.startswith('/satin/') and page in sitemap and inbound[page] == 0 and not re.match(r'^/satin/(fa|fr|es)/', page):
        add('orphan', page, 'in sitemap, no internal links')
for page, alts in hreflang.items():
    for hl, u in alts.items():
        if u not in pages: add('hreflang-missing-target', page, f'{hl} {u}'); continue
        back = hreflang.get(u, {})
        if page not in back.values(): add('hreflang-not-reciprocal', page, f'{hl} {u}')
    if alts and page not in alts.values(): add('hreflang-no-self', page)
big = sorted(((v, k) for k, v in img_sizes.items() if v > 350_000), reverse=True)
for v, k in big: add('large-image', k, f'{v/1e3:.0f} KB')
for w, p in sorted(weights, reverse=True)[:10]:
    if w > 250_000: add('heavy-html', p, f'{w/1e3:.0f} KB')

ERRORS = {'broken-link', 'broken-resource', 'schema-invalid-json', 'canonical-missing-target', 'hreflang-missing-target', 'hreflang-not-reciprocal', 'mixed-content', 'sitemap-missing-page'}
print(f'SEO audit: {len(pages)} pages, {len(sitemap)} sitemap URLs')
for kind in sorted(issues, key=lambda k: (k not in ERRORS, k)):
    rows = issues[kind]
    uniq = collections.Counter(d for _, d in rows)
    print(f'\n[{"ERROR" if kind in ERRORS else "warn"}] {kind}: {len(rows)}')
    shown = 0
    for (pg, det) in rows:
        if shown >= 12: print('   …'); break
        print(f'   {pg}  {det}'); shown += 1
if JSON_OUT: json.dump({k: v for k, v in issues.items()}, open(JSON_OUT, 'w'), indent=1)
sys.exit(1 if any(k in ERRORS for k in issues) else 0)
