#!/usr/bin/env python3
"""Build the HostPapa (PHP) package of the Satin site from the local Worker render.
Output: /home/claude/hp/out/new.satingraphic.ca (docroot) + /home/claude/hp/out/satin-new (private app)."""
import json, os, re, shutil, sys, urllib.request, urllib.parse, concurrent.futures as cf

SRC = '/home/claude/gh-satin/dist/client'
WORKER = 'http://127.0.0.1:8790'
OUT = '/home/claude/hp/out'
DOC = OUT + '/new.satingraphic.ca'
APP = OUT + '/satin-new'
ORIGIN = 'https://satingraphic.ca'
OLD = 'https://satin-graphic-website.mehrad-tr.chatgpt.site'
STAGING = False

def get(path, host='new.satingraphic.ca'):
    req = urllib.request.Request(WORKER + path, headers={'Host': host, 'X-Forwarded-Proto': 'https'})
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read(), {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e: return e.code, e.read(), {k.lower(): v for k, v in e.headers.items()}

shutil.rmtree(OUT, ignore_errors=True)
# 1. static assets (everything except html, which is re-rendered)
def ign(d, names):
    return [n for n in names if n.endswith('.html') and os.path.isfile(os.path.join(d, n)) and n != 'robots.txt']
shutil.copytree(SRC, DOC, ignore=ign)
os.makedirs(APP + '/data/rules', exist_ok=True); os.makedirs(APP + '/data/seeds', exist_ok=True)

# 2. HTML pages: every index.html in the client tree + sitemap + crawl of internal links
from urllib.parse import urlparse
seen = set(); queue = []
def add(url):
    url = urlparse(url).path
    if not url.startswith('/') or url.startswith('/api/') or url.startswith('/admin') or re.search(r'\.[a-z0-9]{2,5}$', url): return
    if not url.endswith('/'): url += '/'
    if url not in seen: seen.add(url); queue.append(url)
for root, dirs, files in os.walk(SRC):
    if 'index.html' in files:
        rel = os.path.relpath(root, SRC).replace(os.sep, '/')
        add('/' if rel == '.' else '/' + rel + '/')
for u in re.findall(r'<loc>https?://[^/]+(/[^<]*)</loc>', open(SRC + '/satin/sitemap.xml').read()): add(u)
for u in ['/satin/print-shop/large-format/poly-bag-lawn-sign/','/satin/shop/dtf-transfers/','/satin/installation-terms/','/satin/design-agreement/']: add(u)

BOOT = re.compile(r'<script type="application/json" data-service-bootstrap>.*?</script>', re.S)
def fix(text):
    text = text.replace(OLD, ORIGIN)
    if STAGING:
        text = re.sub(r'<meta name="robots" content="[^"]*">', '', text)
        text = text.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">', 1)
    return text

LINK = re.compile(r'href="(/[^"#?]*)')
def render(url):
    st, body, h = get(url)
    if st != 200 or 'text/html' not in h.get('content-type', ''): return url, st, []
    raw = body.decode('utf-8')
    mb = BOOT.search(raw)
    if mb and not os.path.exists(DOC + '/service-bootstrap.json'):
        open(DOC + '/service-bootstrap.json', 'w', encoding='utf-8').write(re.sub(r'^<script[^>]*>|</script>$', '', mb.group(0)))
    t = fix(BOOT.sub('<script type="application/json" data-service-bootstrap-src="/service-bootstrap.json"></script>', raw))
    dst = os.path.join(DOC, url.lstrip('/'), 'index.html'); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(t)
    return url, st, LINK.findall(t)
stats = {}
with cf.ThreadPoolExecutor(8) as ex:
    while queue:
        batch, queue[:] = list(queue), []
        for url, st, links in ex.map(render, batch):
            stats[st] = stats.get(st, 0) + 1
            for l in links: add(l)
print('pages', stats, 'total', len(seen))
pages = [(None, u) for u in seen]

# 3. JSON snapshots
for name, path in [('service-settings', '/api/service-settings'), ('projects', '/api/projects'), ('products', '/api/products'),
                   ('rules-previews', '/api/rules/previews'), ('pricing', '/api/pricing'), ('navigation', '/api/navigation'),
                   ('templates', '/api/templates'), ('vehicles', '/api/vehicles')]:
    st, body, _ = get(path); assert st == 200, (path, st)
    open(f'{APP}/data/{name}.json', 'wb').write(fix(body.decode()).encode())
ids = sorted({p.get('ruleId') or p.get('id') for p in json.load(open(APP + '/data/products.json'))['products']})
for i in ids:
    st, body, _ = get('/api/rules?id=' + urllib.parse.quote(i))
    if st == 200 and json.loads(body).get('rule'): open(f'{APP}/data/rules/{i}.json', 'wb').write(body)
def seed(item):
    rel, url = item
    st, body, _ = get('/api/rules?path=' + urllib.parse.quote(url))
    if st == 200 and json.loads(body).get('rule'):
        key = url.rstrip('/') or '/'
        open(f"{APP}/data/seeds/{urllib.parse.quote(key, safe='')}.json", 'wb').write(body)
        return 1
    return 0
with cf.ThreadPoolExecutor(8) as ex:
    print('seeds', sum(ex.map(seed, [p for p in pages if p[1].startswith('/satin')])))
print('rules', len(os.listdir(APP + '/data/rules')))

# 4. optimized asset map (full map, including generated sizes)
import subprocess
subprocess.run(['node','--no-warnings','-e',"import('/home/claude/gh-satin/dist/server/optimized-assets.mjs').then(m=>require('fs').writeFileSync('"+APP+"/data/optimized-assets.json',JSON.stringify(m.optimizedAssets)))"],check=True)

# 4b. physical copies for legacy image URLs (nginx serves image extensions without running .htaccess rewrites)
for src, dst in json.load(open(APP + '/data/optimized-assets.json')).items():
    if os.path.exists(DOC + dst) and not os.path.exists(DOC + src):
        os.makedirs(os.path.dirname(DOC + src), exist_ok=True); shutil.copyfile(DOC + dst, DOC + src)

# 5. sitemap / robots for staging
for f in ['satin/sitemap.xml']:
    p = os.path.join(DOC, f)
    if os.path.exists(p): open(p, 'w').write(open(p).read().replace(OLD, ORIGIN))
open(DOC + '/robots.txt', 'w').write('User-agent: *\nDisallow: /\n' if STAGING else 'User-agent: *\nAllow: /\nSitemap: ' + ORIGIN + '/satin/sitemap.xml\n')
shutil.copy(DOC + '/satin/fonts/vazirmatn.woff2', DOC + '/satin/fonts/Vazirmatn.woff2')
for lang in ['', 'fa/', 'fr/', 'es/']:
    d = DOC + '/satin/' + lang + 'checkout'; os.makedirs(d, exist_ok=True); shutil.copy(DOC + '/checkout/index.html', d + '/index.html')
print('done')
