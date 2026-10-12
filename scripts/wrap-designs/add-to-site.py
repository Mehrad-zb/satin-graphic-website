#!/usr/bin/env python3
"""Add the mascot wrap designs (scripts/wrap-designs/mascot-designs.mjs) to the site: shop list (bundle WRAP_DESIGNS),
SEO entries, price rules design-<slug> (client + server studio model), page translations, static pages (en/fa/fr/es),
admin pages.json and the sitemap. Idempotent: designs already present are skipped."""
import json, os, re, shutil, subprocess
ROOT = '/home/claude/gh-satin'
C = ROOT + '/dist/client'
designs = json.loads(subprocess.check_output(['node', '-e', "import('./scripts/wrap-designs/mascot-designs.mjs').then(m=>console.log(JSON.stringify(m.MASCOT_DESIGNS)))"], cwd=ROOT))
TR = json.load(open(ROOT + '/scripts/wrap-designs/mascot-i18n.json'))
js = lambda v: json.dumps(v, ensure_ascii=False)

# 1. bundle: WRAP_DESIGNS + SEO
B = C + '/satin/assets/satin.9464926f1bc9.js'; s = open(B).read()
anchor = s.index('  { slug: "abstract-flow"'); end = s.index('\n', anchor) + 1
add = ''.join(f'  {{ slug: {js(d["slug"])}, name: {js(d["name"])}, style: "Mascot", ind: {js(d["ind"])}, col: {js(d["col"])}, c: {js(d["c"])}, d: {js(d["d"])} }},\n' for d in designs if f'slug: "{d["slug"]}"' not in s)
s = s[:end] + add + s[end:]
seo_anchor = s.index('  "/shop/vehicle-wrap-designs/abstract-flow": {'); seo_end = s.index('  },\n', seo_anchor) + 5
seo = ''.join(f'  "/shop/vehicle-wrap-designs/{d["slug"]}": {{\n    "title": {js(d["name"] + " Wrap Design Toronto | Satin Graphic")},\n    "description": {js(d["name"] + " — " + d["d"] + " Ready-made vehicle wrap design from Satin Graphic, Vaughan & Toronto.")},\n    "image": "home-video-poster",\n    "noindex": false\n  }},\n' for d in designs if f'"/shop/vehicle-wrap-designs/{d["slug"]}"' not in s)
s = s[:seo_end] + seo + s[seo_end:]
open(B, 'w').write(s)

# 2. rules
for f in [C + '/studio/model.mjs', ROOT + '/dist/server/studio-model.mjs']:
    m = open(f).read()
    i = m.index('{"id":"design-delivery-dash"'); depth = 0
    for j in range(i, len(m)):
        depth += {'{': 1, '}': -1}.get(m[j], 0)
        if depth == 0: break
    tpl = m[i:j + 1]
    i2 = m.index('{"id":"design-abstract-flow"'); depth = 0
    for k in range(i2, len(m)):
        depth += {'{': 1, '}': -1}.get(m[k], 0)
        if depth == 0: break
    rules = ''.join(',' + tpl.replace('delivery-dash', d['slug']).replace('Delivery Dash', d['name']) for d in designs if f'"design-{d["slug"]}"' not in m)
    m = m[:k + 1] + rules + m[k + 1:]
    open(f, 'w').write(m)

# 3. translations
suffix = ' This is a finished wrap layout built on a standard vehicle template; we adapt it to your exact make and model and swap in your logo, colours, phone number and web address.'
for lang in ['fa', 'fr', 'es']:
    f = C + f'/i18n-content.{lang}.mjs'; t = open(f).read()
    get = lambda key: json.loads(re.search(re.escape(js(key)) + r':(\{[^}]*\})', t).group(1))[lang]
    sfx = get('Motion stripes and a large tracking-URL panel for courier fleets.' + suffix)[len(get('Motion stripes and a large tracking-URL panel for courier fleets.')):]
    pat = {k: get(k.replace('X', 'Delivery Dash')).replace('Delivery Dash', '{}') for k in ['X design', 'X: ready in days, not weeks.', 'X Wrap Design', 'X Wrap Design in Vaughan & Toronto']}
    entries = {}
    for k, v in TR.items():
        if '-' not in k: entries[k] = v[lang]
    for d in designs:
        for k, p in pat.items(): entries[k.replace('X', d['name'])] = p.format(d['name'])
        entries[d['d']] = TR[d['slug']][lang]; entries[d['d'] + suffix] = TR[d['slug']][lang] + sfx
        entries[d['name'] + ' Wrap Design Toronto | Satin Graphic'] = pat['X Wrap Design'].format(d['name']) + ' | Satin Graphic'
    new = ''.join(f'{js(k)}:{{{js(lang)}: {js(v)}}},\n' for k, v in entries.items() if (js(k) + ':{') not in t)
    t = t[:t.rindex('};')] + new + t[t.rindex('};'):]
    open(f, 'w').write(t)

# 4. static pages (copied from delivery-dash, then refreshed by prerender)
src_desc = {'en': 'Motion stripes and a large tracking-URL panel for courier fleets.'}
for lang in ['fa', 'fr', 'es']:
    t = open(C + f'/i18n-content.{lang}.mjs').read()
    src_desc[lang] = json.loads(re.search(re.escape(js(src_desc['en'])) + r':(\{[^}]*\})', t).group(1))[lang]
created = []
for lang in ['en', 'fa', 'fr', 'es']:
    base = C + '/satin' + ('' if lang == 'en' else '/' + lang) + '/shop/vehicle-wrap-designs/'
    tpl = open(base + 'delivery-dash/index.html').read()
    for d in designs:
        out = base + d['slug'] + '/index.html'
        if os.path.exists(out): continue
        os.makedirs(os.path.dirname(out), exist_ok=True)
        desc = d['d'] if lang == 'en' else TR[d['slug']][lang]
        h = tpl.replace(src_desc[lang], desc).replace('delivery-dash', d['slug']).replace('Delivery Dash', d['name']).replace('DELIVERY DASH', d['name'].upper())
        open(out, 'w').write(h); created.append(('' if lang == 'en' else '/' + lang) + '/shop/vehicle-wrap-designs/' + d['slug'])

# 5. admin pages.json + sitemap
P = C + '/admin/pages.json'; pj = json.load(open(P)); have = {x['path'] for x in (pj if isinstance(pj, list) else pj.get('pages', []))}
lst = pj if isinstance(pj, list) else pj['pages']
for lang in ['es', 'fa', 'fr', 'en']:
    for d in designs:
        p = '/satin' + ('' if lang == 'en' else '/' + lang) + '/shop/vehicle-wrap-designs/' + d['slug']
        if p not in have: lst.append({'path': p, 'lang': lang, 'title': d['name']})
json.dump(pj, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
S = C + '/satin/sitemap.xml'; sm = open(S).read()
host = re.search(r'<loc>(https?://[^/]+)/satin/shop/vehicle-wrap-designs/delivery-dash/</loc>', sm).group(1)
urls = ''.join(f'<url><loc>{host}/satin/shop/vehicle-wrap-designs/{d["slug"]}/</loc></url>' for d in designs if f'/vehicle-wrap-designs/{d["slug"]}/' not in sm)
sm = sm.replace('</urlset>', urls + '</urlset>'); open(S, 'w').write(sm)
print('designs', len(designs), 'pages created', len(created))
open('/tmp/claude-0/new-design-pages.txt', 'w').write('\n'.join('/satin' + p for p in created))
