#!/usr/bin/env python3
"""SEO pass over the prerendered site (out/new.satingraphic.ca).

- Keyword-led titles, meta descriptions and H1s for the English service pages
- Starting-price offers in the Service schema of commercial pages
- City landing pages (/satin/vehicle-wraps/<city>/) with unique copy + schema
- "Areas we serve" links on the main wrap pages
- Vehicle lettering landing page
- Site-wide: canonical origin, robots meta, enriched LocalBusiness/AutomotiveBusiness schema, Service/Breadcrumb/FAQ
  schema where missing, title length, image alt/size/lazy-loading, font preload, modulepreload, ?v= cache busting
- robots.txt (AI crawlers allowed in production), sitemap.xml, llms.txt and llms-full.txt for AI search engines
- Image recompression of oversized photos
Writes the list of changed files to <out>/seo-changed.txt

Usage: python3 seo_pass.py [OUT_DIR]      (default /home/claude/hp/out; OUT_DIR contains new.satingraphic.ca/ and satin-new/)
ORIGIN and STAGING are read from build.py (one switch for the whole build); SEO_ORIGIN / SEO_STAGING env vars override for tests.
Safe to run more than once on the same output.
"""
import html, json, re, os, sys, copy, hashlib, glob, datetime
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else '/home/claude/hp/out'
ROOT = OUT + '/new.satingraphic.ca'
APP = OUT + '/satin-new'
_BUILD = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build.py'), encoding='utf-8').read()
ORIGIN = (os.environ.get('SEO_ORIGIN') or re.search(r"^ORIGIN\s*=\s*'([^']+)'", _BUILD, re.M).group(1)).rstrip('/')
STAGING = (os.environ.get('SEO_STAGING') or re.search(r"^STAGING\s*=\s*(True|False)", _BUILD, re.M).group(1)) in ('True', '1', 'true')
RENDER_ORIGIN = 'https://new.satingraphic.ca'   # host the Worker renders with (build.py get()); rewritten to ORIGIN below
PRICES = json.load(open(APP + '/data/pricing.json'))['bases']
print('seo_pass:', ROOT, 'origin', ORIGIN, 'staging' if STAGING else 'PRODUCTION')
changed = set()
A = lambda s: html.escape(s, quote=True)

def path_file(p): return f'{ROOT}{p}/index.html'
def read(p): return open(path_file(p), encoding='utf-8').read()
def write(p, s):
    os.makedirs(os.path.dirname(path_file(p)), exist_ok=True)
    open(path_file(p), 'w', encoding='utf-8').write(s); changed.add(path_file(p))

TITLES = {
 '/satin': 'Vehicle Wraps & Print Shop in Vaughan | Satin Graphic',
 '/satin/vehicle-wraps': 'Vehicle Wraps in Vaughan & Toronto | Satin Graphic',
 '/satin/vehicle-wraps/commercial': 'Commercial Vehicle Wraps in Vaughan & GTA | Satin Graphic',
 '/satin/vehicle-wraps/commercial/vans': 'Van Wraps & Van Graphics in Vaughan & GTA | Satin Graphic',
 '/satin/vehicle-wraps/commercial/box-trucks': 'Box Truck Wraps in Vaughan & Toronto | Satin Graphic',
 '/satin/vehicle-wraps/commercial/trailers': 'Trailer Wraps in Vaughan & Toronto | Satin Graphic',
 '/satin/vehicle-wraps/commercial/pickups': 'Pickup Truck Wraps in Vaughan & GTA | Satin Graphic',
 '/satin/vehicle-wraps/commercial/buses': 'Bus Wraps & Bus Graphics in the GTA | Satin Graphic',
 '/satin/vehicle-wraps/commercial/fleet-programs': 'Fleet Wraps & Fleet Graphics in the GTA | Satin Graphic',
 '/satin/vehicle-wraps/color-change': 'Colour Change Car Wraps in Vaughan & Toronto | Satin Graphic',
 '/satin/vehicle-wraps/paint-protection-film': 'Paint Protection Film (PPF) in Vaughan | Satin Graphic',
 '/satin/vehicle-wraps/estimator': 'Vehicle Wrap Cost Estimator (Ontario) | Satin Graphic',
 '/satin/window-tint': 'Window Tinting in Vaughan & Toronto | Satin Graphic',
 '/satin/window-tint/vehicle': 'Car Window Tinting in Vaughan & GTA | Satin Graphic',
 '/satin/window-tint/commercial': 'Commercial Window Film in Vaughan & GTA | Satin Graphic',
 '/satin/window-graphics': 'Window Graphics & Storefront Vinyl in Vaughan | Satin Graphic',
 '/satin/print-shop': 'Print Shop in Vaughan: Flyers, Cards & Banners | Satin Graphic',
 '/satin/print-shop/large-format': 'Large Format Printing & Banners in Vaughan | Satin Graphic',
 '/satin/apparel': 'Custom Apparel & Branded Workwear in Vaughan | Satin Graphic',
 '/satin/apparel/t-shirts': 'Custom T-Shirts in Vaughan & Toronto | Satin Graphic',
 '/satin/apparel/hoodies': 'Custom Hoodies in Vaughan & Toronto | Satin Graphic',
 '/satin/apparel/hats': 'Custom Embroidered Hats in Vaughan | Satin Graphic',
 '/satin/apparel/sweatshirts': 'Custom Sweatshirts in Vaughan & Toronto | Satin Graphic',
 '/satin/apparel/workwear': 'Custom Workwear & Uniforms in Vaughan | Satin Graphic',
 '/satin/auto-detailing': 'Auto Detailing in Vaughan | Satin Graphic',
 '/satin/contact': 'Contact Satin Graphic | Vaughan Wrap & Print Shop',
 '/satin/about': 'About Satin Graphic | Vehicle Wraps & Print in Vaughan',
 '/satin/reviews': 'Customer Reviews | Satin Graphic, Vaughan',
 '/satin/faq': 'Vehicle Wrap, Tint & Print FAQ | Satin Graphic',
 '/satin/warranty': 'Wrap, Tint & Print Warranty | Satin Graphic',
 '/satin/portfolio': 'Vehicle Wrap Portfolio: Fleet & Colour Change | Satin Graphic',
 '/satin/print-shop/offset': 'Offset Printing in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/offset/business-cards': 'Business Card Printing in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/offset/flyers': 'Flyer Printing in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/offset/postcards': 'Postcard Printing in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/offset/brochures': 'Brochure Printing in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/offset/door-hangers': 'Door Hanger Printing in Vaughan & GTA | Satin Graphic',
 '/satin/print-shop/large-format/roll-up-banner': 'Roll-Up Banners in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/large-format/yard-signs': 'Yard Signs & Lawn Signs in Vaughan & GTA | Satin Graphic',
 '/satin/print-shop/large-format/a-frame-signs': 'A-Frame Sidewalk Signs in Vaughan & GTA | Satin Graphic',
 '/satin/print-shop/large-format/flags': 'Custom Flags in Vaughan & Toronto | Satin Graphic',
 '/satin/print-shop/large-format/x-frame-banner': 'X-Frame Banners in Vaughan & Toronto | Satin Graphic',
 '/satin/window-graphics/perforated-vinyl': 'Perforated Window Vinyl in Vaughan & GTA | Satin Graphic',
 '/satin/window-graphics/frosted-vinyl': 'Frosted Window Film in Vaughan & Toronto | Satin Graphic',
 '/satin/window-graphics/window-decals': 'Window Decals & Lettering in Vaughan | Satin Graphic',
 '/satin/window-graphics/full-window-graphics': 'Storefront Window Graphics in Vaughan & GTA | Satin Graphic',
 '/satin/wallpaper': 'Custom Wallpaper & Wall Murals in Vaughan | Satin Graphic',
}
UTILITY = ['account', 'login', 'register', 'track', 'privacy-policy', 'terms-and-conditions', 'accessibility', 'refund-policy', 'artwork-guidelines', 'design-agreement']

START = lambda k: f"${PRICES[k]:,}"
# Business facts shown on the site (footer / contact page). Keep in sync with SITE in the main bundle.
HOURS_SHORT = 'Mon–Fri 8am–6pm · Sat 9am–3pm'
HOURS_SPEC = [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'opens': '09:00', 'closes': '17:00'},
              {'@type': 'OpeningHoursSpecification', 'dayOfWeek': 'Saturday', 'opens': '10:00', 'closes': '15:00'}]
DESCS = {
 '/satin': 'Vehicle wraps, fleet graphics, window tint and printing in Vaughan, ON. In-house design, print and install for Toronto & the GTA. Get a free quote.',
 '/satin/vehicle-wraps': 'Full and partial vehicle wraps in Vaughan, serving Toronto & the GTA. Commercial, fleet and colour-change wraps with a 5-year workmanship warranty.',
 '/satin/vehicle-wraps/commercial': f'Commercial vehicle wraps for vans, trucks, trailers and fleets in Vaughan & the GTA. Design, print and install in-house. Full wraps from {START("sedan")}.',
 '/satin/vehicle-wraps/commercial/vans': f'Van wraps in Vaughan & Toronto for Transit, Sprinter, ProMaster and cargo vans. Lettering to full wraps, full van wraps from {START("transit-van")}.',
 '/satin/vehicle-wraps/commercial/box-trucks': f'Box truck wraps in Vaughan & the GTA: lettering, partial or full printed wraps for cube and straight trucks. Full wraps from {START("box-truck")}.',
 '/satin/vehicle-wraps/commercial/trailers': f'Trailer wraps in Vaughan & Toronto for enclosed, cargo and 53-foot trailers, with reflective options for night visibility. From {START("trailer")}.',
 '/satin/vehicle-wraps/commercial/pickups': f'Pickup truck wraps and decals in Vaughan & the GTA for contractors and trades. Partial or full coverage; full pickup wraps from {START("pickup-truck")}.',
 '/satin/vehicle-wraps/commercial/buses': f'Bus wraps in Vaughan & the GTA, including perforated window vinyl. Design, large-format print and install in one shop. Full bus wraps from {START("bus")}.',
 '/satin/vehicle-wraps/commercial/fleet-programs': 'Fleet wraps and fleet graphics for GTA businesses: one brand template for every vehicle, fleet pricing from 3 vehicles, install bay in Vaughan.',
 '/satin/vehicle-wraps/color-change': 'Colour change car wraps in Vaughan & Toronto in gloss, satin, matte and colour-shift films. Protects factory paint and removes cleanly. Get a quote.',
 '/satin/vehicle-wraps/paint-protection-film': 'Paint protection film (PPF) in Vaughan: clear, self-healing film for partial front, full front or full body. Stops stone chips and road salt.',
 '/satin/vehicle-wraps/estimator': 'Estimate your vehicle wrap cost in under a minute: cars, SUVs, pickups, vans, box trucks, trailers and buses, priced by our Vaughan wrap shop.',
 '/satin/window-tint': 'Window tinting in Vaughan & Toronto for cars, homes and businesses. Ceramic and carbon films in several shades, with Ontario tint-law guidance.',
 '/satin/contact': 'Visit Satin Graphic at 50 Viceroy Rd, Unit 22–23, Vaughan, ON or call (905) 962-6222 for vehicle wraps, window tint, signs and printing quotes.',
 '/satin/about': 'Satin Graphic and Satin Auto Wrap are one Vaughan studio for vehicle wraps, window tint, printing and signage, serving Toronto and the GTA.',
 '/satin/reviews': 'Read what GTA businesses and drivers say about Satin Graphic’s vehicle wraps, window tint and printing in Vaughan, Ontario.',
 '/satin/wallpaper': 'Custom printed wallpaper and wall murals in Vaughan for homes, offices and businesses: botanical, marble, geometric, kids and fully custom designs.',
 '/satin/apparel': 'Custom apparel in Vaughan & Toronto: t-shirts, hoodies, hats and totes with full-colour DTF, vinyl heat press and embroidery. No minimum order.',
 '/satin/apparel/t-shirts': 'Custom printed t-shirts in Vaughan & Toronto: full-colour DTF and vinyl heat press on Gildan, Bella + Canvas, Next Level and more. No minimum order.',
 '/satin/apparel/hoodies': 'Custom hoodies in Vaughan & Toronto, printed with full-colour DTF or vinyl heat press. No minimum order; 5% off orders above 20 units.',
 '/satin/apparel/sweatshirts': 'Custom sweatshirts and crewnecks in Vaughan & Toronto with full-colour DTF or vinyl heat press printing. No minimum order.',
 '/satin/apparel/hats': 'Custom embroidered hats and caps in Vaughan & Toronto with your logo. No minimum order; upload artwork or ask our designers for help.',
 '/satin/apparel/workwear': 'Custom workwear and uniforms in Vaughan & Toronto: printed shirts, hoodies and embroidered hats for crews and staff. No minimum order.',
 '/satin/print-shop/offset/business-cards': 'Business card printing in Vaughan & Toronto: 14–32 pt stocks, matte or gloss, one or two sides, square or rounded corners. Order online with artwork upload.',
 '/satin/print-shop/offset/flyers': 'Flyer printing in Vaughan & Toronto: 8.5×11 or 5.5×8.5, gloss or matte, priced by quantity. Upload your artwork or use our online design studio.',
 '/satin/print-shop/offset/postcards': 'Postcard printing in Vaughan & Toronto: 4×6 or 5×7 with a UV gloss front, for mailers, offers and events. Order online with artwork upload.',
 '/satin/print-shop/offset/brochures': 'Brochure printing in Vaughan & Toronto: bi-fold or tri-fold on 100lb silk, proofed before printing. Order online or ask our designers.',
}
H1 = {
 '/satin': '<span>Vehicle wraps &amp; print.</span><span>Made in Vaughan.</span>',
 '/satin/vehicle-wraps': 'Vehicle wraps in Vaughan &amp; Toronto.',
 '/satin/vehicle-wraps/commercial': 'Commercial vehicle wraps for GTA fleets.',
 '/satin/vehicle-wraps/commercial/vans': 'Van wraps built to work as hard as you do.',
 '/satin/vehicle-wraps/commercial/box-trucks': 'Box truck wraps built to work as hard as you do.',
 '/satin/vehicle-wraps/commercial/trailers': 'Trailer wraps built to work as hard as you do.',
 '/satin/vehicle-wraps/commercial/pickups': 'Pickup truck wraps built to work as hard as you do.',
 '/satin/vehicle-wraps/commercial/buses': 'Bus wraps built to work as hard as you do.',
 '/satin/vehicle-wraps/commercial/fleet-programs': 'Fleet wraps built to work as hard as you do.',
 '/satin/vehicle-wraps/color-change': 'Colour change wraps. No repaint required.',
 '/satin/vehicle-wraps/paint-protection-film': 'Paint protection film that shrugs off the road.',
 '/satin/vehicle-wraps/estimator': 'Vehicle wrap cost estimator.',
 '/satin/window-tint': 'Window tinting in Vaughan. Dial in the dark.',
 '/satin/contact': 'Contact our Vaughan wrap &amp; print shop.',
}
OFFERS = {'/satin/vehicle-wraps/commercial/vans': 'transit-van', '/satin/vehicle-wraps/commercial/box-trucks': 'box-truck', '/satin/vehicle-wraps/commercial/trailers': 'trailer',
          '/satin/vehicle-wraps/commercial/pickups': 'pickup-truck', '/satin/vehicle-wraps/commercial/buses': 'bus', '/satin/vehicle-wraps/commercial': 'sedan'}
EST_NAMES = {'box-truck': 'Box Truck', 'bus': 'Bus', 'cargo-van': 'Cargo Van', 'minivan': 'Minivan', 'pickup-truck': 'Pickup Truck', 'sedan': 'Car', 'sprinter-van': 'Sprinter Van', 'suv': 'SUV', 'trailer': 'Trailer', 'transit-van': 'Transit Van'}
for k, n in EST_NAMES.items():
    TITLES[f'/satin/vehicle-wraps/estimator/{k}'] = f'{n} Wrap Cost in Vaughan & Toronto | Satin Graphic'
    DESCS[f'/satin/vehicle-wraps/estimator/{k}'] = f'{n} wrap cost in Vaughan & Toronto: full printed wraps start at {START(k)}. Compare decals, partial, ¾ and full coverage with an instant estimate.'
    OFFERS[f'/satin/vehicle-wraps/estimator/{k}'] = k

def set_head(s, title=None, desc=None):
    if title:
        t = A(title)
        s = re.sub(r'<title>.*?</title>', f'<title>{t}</title>', s, count=1, flags=re.S)
        s = re.sub(r'(<meta (?:property|name)="(?:og:title|twitter:title)" content=")[^"]*(")', lambda m: m.group(1) + t + m.group(2), s)
    if desc:
        d = A(desc)
        s = re.sub(r'(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*(")', lambda m: m.group(1) + d + m.group(2), s)
    return s

def schema_edit(s, fn):
    m = re.search(r'(<script type="application/ld\+json" id="page-schema">)(.*?)(</script>)', s, re.S)
    if not m: return s
    try: data = json.loads(m.group(2))
    except Exception: return s
    fn(data)
    js = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return s[:m.start(2)] + js + s[m.end(2):]

def lede_text(s):
    m = re.search(r'<p class="lede"[^>]*>(.*?)</p>', s, re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', m.group(1)))).strip() if m else ''

TEMPLATE_DESC = re.compile(r'Explore options, project details and estimates|Explore film and coverage options|custom services from Satin Graphic')

# ---------- 1. existing English pages ----------
import glob
for f in sorted(glob.glob(f'{ROOT}/satin/**/index.html', recursive=True)):
    p = f[len(ROOT):-len('/index.html')]
    if re.match(r'/satin/(fa|fr|es)(/|$)', p): continue
    s0 = s = open(f, encoding='utf-8').read()
    tm = re.search(r'<title>(.*?)</title>', s, re.S); title = html.unescape(tm.group(1)) if tm else ''
    slug = p.split('/')[-1]
    new_title = TITLES.get(p)
    if not new_title and slug in UTILITY:
        new_title = re.sub(r' Toronto \| Satin Graphic$', ' | Satin Graphic', title)
    if not new_title and title.endswith(' Toronto | Satin Graphic') and ' in Vaughan' not in title and ' Vaughan &' not in title:   # not again on a second run
        base = title[:-len(' Toronto | Satin Graphic')]
        cand = f'{base} in Vaughan & Toronto | Satin Graphic'
        new_title = cand if len(cand) <= 62 else f'{base} in Vaughan | Satin Graphic'
    dm = re.search(r'<meta name="description" content="([^"]*)"', s); desc = html.unescape(dm.group(1)) if dm else ''
    new_desc = DESCS.get(p)
    if not new_desc and TEMPLATE_DESC.search(desc):
        l = lede_text(s)
        if l and '/products/' not in p:
            name = (new_title or title).split(' | ')[0]
            new_desc = l if len(l) > 90 else f'{l} {name} from Satin Graphic, Vaughan — serving Toronto & the GTA.'
            if len(new_desc) > 158: new_desc = new_desc[:155].rsplit(' ', 1)[0] + '…'
    s = set_head(s, new_title if new_title and new_title != title else None, new_desc)
    if p in H1:
        s = re.sub(r'(<h1 class="d1"[^>]*>).*?(</h1>)', lambda m: m.group(1) + H1[p] + m.group(2), s, count=1, flags=re.S)
    def fix(data):
        for node in data.get('@graph', []):
            if node.get('@type') == 'Service':
                if new_title: node['name'] = new_title.split(' | ')[0]
                if new_desc: node['description'] = new_desc
                if p in OFFERS:
                    node['offers'] = {'@type': 'AggregateOffer', 'priceCurrency': 'CAD', 'lowPrice': PRICES[OFFERS[p]], 'description': 'Starting price for a full printed wrap; decals and partial wraps cost less.'}
    s = schema_edit(s, fix)
    if s != s0: write(p, s)

# ---------- 2. local landing pages + guides (content in seo_content.py) ----------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seo_content import CITIES, CITY_BY_SLUG, SERVICES_LOCAL, LOCAL_ORDER, GUIDES, GUIDE_DATE, AUTHOR
BIZ_ID = f'{ORIGIN}/satin/#business'
NAP_HTML = f'<b>Satin Graphic</b><br>50 Viceroy Rd, Unit 22–23, Vaughan, ON<br>{HOURS_SHORT}<br><a href="tel:+19059626222">(905) 962-6222</a> · <a href="mailto:info@satingraphic.ca">info@satingraphic.ca</a>'
MAPS = 'https://www.google.com/maps/search/?api=1&amp;query=50+Viceroy+Rd+Unit+22+Vaughan+ON'
PRICE_CSS = '<style>.price-table{width:100%;max-width:720px;border-collapse:collapse;font-variant-numeric:tabular-nums}.price-table th,.price-table td{text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}.price-table th{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}.price-table td+td,.price-table th+th{text-align:right}.guide-art table{width:100%;border-collapse:collapse;margin:8px 0 4px;font-size:15px}.guide-art th,.guide-art td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}.guide-art th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}.guide-art .tbl{overflow-x:auto}.guide-art figure{margin:8px 0}.guide-art figure img{width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:14px}.guide-art p a,.guide-art li a,.guide-art td a{text-decoration:underline;text-underline-offset:2px}.guide-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}.link-list{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}.local-copy p+p{margin-top:12px}.guide-art ul{padding-left:20px}.guide-art li+li{margin-top:6px}.local-img{width:100%;height:auto;border-radius:14px;margin-bottom:14px;aspect-ratio:3/2;object-fit:cover}</style>'

SECTION_RX = lambda name: re.compile(r'<section class="sec tight" data-cms-section="' + name + r'">.*?</section>', re.S)
def money(n): return f'${round(n):,}'
def rnd10(n): return round(n / 10) * 10
def rule(rid):
    try:
        d = json.load(open(f'{APP}/data/rules/{rid}.json', encoding='utf-8')); return d.get('rule', d) or {}
    except Exception: return {}
def opt_val(r, key, label, default):
    for f in r.get('fields', []):
        if f.get('key') == key:
            for o in f.get('options', []):
                if o.get('label', '').lower().startswith(label.lower()): return o['value']
    return default
def ranges(rid, defaults):
    out = dict(defaults)
    for x in rule(rid).get('priceRanges', []) or []:
        out[x['label']] = (x['min'], x['max'])
    return out

# all prices come from the estimator data (pricing.json and rules/*.json) so they always match the site
V = {'p_' + k: START(n) for k, n in [('sedan', 'sedan'), ('suv', 'suv'), ('pickup', 'pickup-truck'), ('minivan', 'minivan'), ('transit', 'transit-van'), ('sprinter', 'sprinter-van'),
                                     ('cargo', 'cargo-van'), ('box', 'box-truck'), ('trailer', 'trailer'), ('bus', 'bus')]}
V['p_letter_car'] = money(rnd10(PRICES['sedan'] * 0.22)); V['p_letter_van'] = money(rnd10(PRICES['transit-van'] * 0.22))
_pp = ranges('ppf-partial', {'Mirrors': (150, 250), 'Partial front': (900, 1400), 'Full front': (1800, 2600), 'Track package': (2600, 3600)})
_pf = ranges('ppf-full', {'Full body · Gloss': (5500, 7500), 'Full body · Matte': (6500, 8500), 'Full body · Colour PPF': (7500, 10000)})
RNG = lambda t: f'{money(t[0])}–{money(t[1])}'
V.update({'r_mirrors': RNG(_pp['Mirrors']), 'r_partialFront': RNG(_pp['Partial front']), 'r_fullFront': RNG(_pp['Full front']), 'r_track': RNG(_pp['Track package']),
          'r_gloss': RNG(_pf['Full body · Gloss']), 'r_matte': RNG(_pf['Full body · Matte']), 'r_color': RNG(_pf['Full body · Colour PPF'])})
_tv = rule('tint-vehicle'); _tc = _tv.get('constants', {})
_full = 2 * _tc.get('frontRate', .225) + 2 * _tc.get('rearRate', .2) + _tc.get('backRate', .15)
_fronts = 2 * _tc.get('frontRate', .225)
_cer = opt_val(_tv, 'film', 'Ceramic', 1.8)
TINT = {k: opt_val(_tv, 'vehicle', lbl, d) for k, lbl, d in [('sedan', 'Sedan', 249), ('suv', 'SUV', 289), ('pickup', 'Pickup', 269), ('van', 'Van', 339)]}
for k, base in TINT.items():
    V[f't_{k}_reg'] = money(base * _full); V[f't_{k}_cer'] = money(base * _full * _cer)
V['t_fronts_reg'] = money(TINT['sedan'] * _fronts); V['t_fronts_cer'] = money(TINT['sedan'] * _fronts * _cer)
_tcm = rule('tint-commercial')
V['c_reg'] = opt_val(_tcm, 'film', 'Regular', 5); V['c_cer'] = opt_val(_tcm, 'film', 'Ceramic', 12); V['c_inst'] = _tcm.get('constants', {}).get('installRate', 3)
FINISH = 1.12   # matte / satin factor in the wrap estimator

def fmt(t, **extra): return t.format_map({**V, **extra}) if '{' in t else t

def md_inline(t):
    t = A(t).replace('&#x27;', '’')
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    def link(m):
        txt, href = m.group(1), html.unescape(m.group(2))
        ext = href.startswith('http')
        return f'<a href="{A(href)}"' + (' target="_blank" rel="noopener"' if ext else '') + f'>{txt}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, t)
def md(text):
    out = []
    for block in re.split(r'\n\s*\n', text.strip()):
        lines = [l.rstrip() for l in block.strip().split('\n')]
        if lines[0].startswith('<'): out.append(block); continue              # pre-rendered HTML (tables built in code)
        if all(l.startswith('* ') for l in lines): out.append('<ul>' + ''.join(f'<li>{md_inline(l[2:])}</li>' for l in lines) + '</ul>')
        elif all(l.startswith('|') for l in lines):
            rows = [[c.strip() for c in l.strip('|').split('|')] for l in lines]
            head = '<thead><tr>' + ''.join(f'<th scope="col">{md_inline(c)}</th>' for c in rows[0]) + '</tr></thead>'
            body = ''.join('<tr>' + ''.join((f'<th scope="row">{md_inline(c)}</th>' if i == 0 else f'<td>{md_inline(c)}</td>') for i, c in enumerate(r)) + '</tr>' for r in rows[1:])
            out.append(f'<div class="tbl"><table>{head}<tbody>{body}</tbody></table></div>')
        else: out.append('<p>' + md_inline(' '.join(lines)) + '</p>')
    return ''.join(out)
def plain(text): return re.sub(r'\s+', ' ', re.sub(r'\*\*|\[([^\]]+)\]\([^)]+\)', lambda m: m.group(1) or '', text)).strip()

def table(head, rows, cls='table price-table'):
    return f'<div style="overflow-x:auto"><table class="{cls}"><thead><tr>' + ''.join(f'<th scope="col">{A(h)}</th>' for h in head) + '</tr></thead><tbody>' + \
           ''.join('<tr>' + ''.join((f'<td>{A(str(c))}</td>') for c in r) + '</tr>' for r in rows) + '</tbody></table></div>'
WRAP_ROWS = ['sedan', 'suv', 'pickup-truck', 'minivan', 'transit-van', 'sprinter-van', 'box-truck', 'trailer', 'bus']
V['price_table'] = table(['Vehicle', 'Full wrap from'], [(EST_NAMES[k], START(k)) for k in WRAP_ROWS])
_roi = []
for k in ['sedan', 'transit-van', 'sprinter-van', 'box-truck', 'trailer']:
    yr = PRICES[k] / 5
    _roi.append((EST_NAMES[k], START(k), money(yr), money(yr / 12)))
V['roi_table'] = table(['Vehicle', 'Full wrap from', 'Per year (5 yrs)', 'Per month'], _roi)
V['roi_transit_year'] = money(PRICES['transit-van'] / 5); V['roi_transit_jobs'] = max(1, round(PRICES['transit-van'] / 5 / 400 + 0.49))

def page_from_tpl(p, title, desc, main_html, graph, image=None):
    """New static page built on the rendered commercial-wraps page (header, footer, scripts), with its own head and schema."""
    s = set_head(TPL, title, desc)
    url = f'{ORIGIN}{p}/'
    s = re.sub(r'<style>\.proj-index\{.*?</style>|<style>\.link-list\{[^<]*</style>', '', s)
    for name in ('sareas', 'sguides', 'smore', 'sprojects', 'srelated'): s = SECTION_RX(name).sub('', s)
    s = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s)
    s = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s)
    if image:
        s = re.sub(r'(<meta (?:property|name)="(?:og:image|twitter:image)" content=")[^"]*(")', lambda m: m.group(1) + ORIGIN + image + m.group(2), s)
    s = re.sub(r'<link rel="alternate" hreflang[^>]*>\s*', '', s)
    s = re.sub(r'data-prerender-path="[^"]*"', f'data-prerender-path="{p[len("/satin"):]}"', s, count=1)
    a, b = s.find('<main'), s.find('</main>')
    s = s[:a] + s[a:s.find('>', a) + 1] + PRICE_CSS + main_html + s[b:]
    def fix(data):
        g = [n for n in data.get('@graph', []) if 'LocalBusiness' in (n.get('@type') if isinstance(n.get('@type'), list) else [n.get('@type')])]
        data['@graph'] = g + graph
    write(p, schema_edit(s, fix))

def crumbs_html(items):   # [(name, href or None)]
    out = []
    for n, h in items:
        out.append(f'<a href="{h}">{A(n)}</a>' if h else f'<span aria-current="page">{A(n)}</span>')
    return '<nav aria-label="Breadcrumb" class="crumbs">' + '<span class="sep">/</span>'.join(out) + '</nav>'
def crumbs_ld(items, url):
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': ORIGIN + h if h else url} for i, (n, h) in enumerate(items)]}
def faq_html(faqs): return ''.join(f'<details{" open" if i == 0 else ""}><summary>{A(q)}</summary><div class="a">{A(a)}</div></details>' for i, (q, a) in enumerate(faqs))
def faq_ld(faqs): return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]}
def city_ld(c): return {'@type': 'City', 'name': c['name'], 'containedInPlace': {'@type': 'AdministrativeArea', 'name': c['region'] + ', Ontario'}}
def local_url(key, slug): return SERVICES_LOCAL[key]['base'] + slug + '/'
GUIDE_BY_SLUG = {g['slug']: g for g in GUIDES}
def guide_title(slug): return GUIDE_BY_SLUG[slug]['h1']

TPL = read('/satin/vehicle-wraps/commercial')

# --- 2a. vehicle-wrap city hubs: /satin/vehicle-wraps/<city>/ ---
SVC_LINKS = [('Van wraps', '/satin/vehicle-wraps/commercial/vans/', 'Transit, Sprinter, ProMaster and cargo vans — from lettering to full wraps.', 'transit-van'),
             ('Box truck wraps', '/satin/vehicle-wraps/commercial/box-trucks/', 'Flat box panels printed as one seamless mural.', 'box-truck'),
             ('Trailer wraps', '/satin/vehicle-wraps/commercial/trailers/', 'Enclosed, cargo and 53-foot trailers, with reflective options.', 'trailer'),
             ('Pickup truck wraps', '/satin/vehicle-wraps/commercial/pickups/', 'Cab, bed and tailgate for contractors and trades.', 'pickup-truck'),
             ('Colour change wraps', '/satin/vehicle-wraps/color-change/', 'Gloss, satin, matte and colour-shift — no repaint.', None),
             ('Paint protection film', '/satin/vehicle-wraps/paint-protection-film/', 'Clear, self-healing protection against chips and salt.', None)]
LOCAL_BLURB = {'commercial': 'Vans, trucks, trailers and fleet programs.', 'lettering': 'Doors, sides and rear — about 22% of a full wrap.',
               'color-change': 'Gloss, satin, matte and colour-shift films.', 'paint-protection-film': 'Self-healing film against chips and salt.', 'window-tint': 'Ceramic and carbon film for cars and buildings.'}

def city_faqs(c):
    n = c['name']
    return [
     (f'Do you wrap vehicles from {n}?', f'Yes. {c["drive"]} Design, printing and installation all happen in our Vaughan shop.'),
     ('How much does a vehicle wrap cost?', f'A full printed wrap starts at about {START("sedan")} for a car, {START("transit-van")} for a Transit-size van and {START("box-truck")} for a box truck, before tax. Lettering and partial wraps cost less. Use our online estimator for a price on your exact vehicle.'),
     ('How long does a wrap take?', 'Design and proofing usually take a few days. Most installs take one to three days depending on the vehicle and coverage, and we book the drop-off so your vehicle is out of service for as little time as possible.'),
     ('How long does a commercial wrap last?', 'With cast film and laminate, expect around 5–7 years on vertical panels in Ontario weather, and 3–5 years on roofs and hoods. Our workmanship warranty covers lifting and peeling for 5 years.'),
     ('Do you design the wrap?', 'Yes. Our in-house designers build the layout on your vehicle’s template for a $250 design deposit that is credited to the wrap when you go ahead. You can also send your own print-ready artwork.'),
    ]

def city_main(c):
    n = A(c['name'])
    cards = ''.join(f'<a class="card" href="{u}"><h3>{A(t)}</h3><p>{A(d)}</p><div class="foot"><span class="tiny">{"Full wraps from " + START(k) if k else ""}</span><span class="link">View options →</span></div></a>' for t, u, d, k in SVC_LINKS)
    local = ''.join(f'<a class="card" href="{local_url(k, c["slug"])}"><h3>{A(SERVICES_LOCAL[k]["name"])} in {n}</h3><p>{A(LOCAL_BLURB[k])}</p><div class="foot"><span class="tiny"></span><span class="link">Read more →</span></div></a>' for k in LOCAL_ORDER)
    prices = ''.join(f'<tr><td>{A(EST_NAMES[k])}</td><td class="mono">{START(k)}</td></tr>' for k in WRAP_ROWS)
    near = [CITY_BY_SLUG[s] for s in c['near']] + [o for o in CITIES if o['slug'] not in c['near'] and o['slug'] != c['slug']]
    others = ' · '.join(f'<a href="/satin/vehicle-wraps/{o["slug"]}/">{A(o["name"])}</a>' for o in near)
    return f'''<div class="page-enter"><section class="phero" data-cms-section="s0"><div class="wrap in"><div class="txt">{crumbs_html([("Home", "/satin/"), ("Vehicle Wraps", "/satin/vehicle-wraps/"), (c["name"], None)])}<span class="eyebrow" data-cms-id="e0">Vehicle wraps · {n}</span>
<h1 class="d1" data-cms-id="e1">Vehicle wraps in {n}.</h1><p class="lede" data-cms-id="e2">{A(c['lede'])}</p>
<div class="ctas"><button class="btn" data-cms-id="e3" data-quote="Vehicle Wraps">Get a free wrap quote</button><a class="btn ghost" data-cms-id="e4" href="/satin/vehicle-wraps/estimator/">Estimate the cost</a></div></div></div></section>
<section class="sec" data-cms-section="s1"><div class="wrap"><div class="sec-head"><span class="eyebrow" data-cms-id="e5">What we wrap in {n}</span><h2 class="d2" data-cms-id="e6">Commercial and personal wraps, one shop.</h2><p class="lede" data-cms-id="e7">Every project is designed in-house on your exact vehicle template, printed on cast film with a protective laminate and installed by our own team.</p></div><div class="grid g3">{cards}</div></div></section>
<section class="sec alt" data-cms-section="s2"><div class="wrap"><div class="sec-head"><span class="eyebrow" data-cms-id="e8">Serving {n}</span><h2 class="d2" data-cms-id="e9">Wraps for {n} businesses and drivers.</h2></div><div class="grid g2"><div><p data-cms-id="e10">{A(c['local'])}</p><p data-cms-id="e11">We regularly work with customers from {A(c['areas'])}.</p></div><div class="card"><h3 data-cms-id="e12">Getting to our shop</h3><p data-cms-id="e13">{A(c['drive'])}</p><p data-cms-id="e14">{NAP_HTML}</p><a class="btn ghost sm" data-cms-id="e15" href="{MAPS}" target="_blank" rel="noopener">Open in Google Maps</a></div></div></div></section>
<section class="sec" data-cms-section="slocal"><div class="wrap"><div class="sec-head"><span class="eyebrow">More services in {n}</span><h2 class="d2">Lettering, colour change, PPF and tint.</h2></div><div class="grid g3">{local}</div></div></section>
<section class="sec alt" data-cms-section="s3"><div class="wrap"><div class="sec-head"><span class="eyebrow" data-cms-id="e16">Pricing</span><h2 class="d2" data-cms-id="e17">Full wrap starting prices.</h2><p class="lede" data-cms-id="e18">Starting points for a full printed wrap before tax. Lettering and decals run about 22% of the full-wrap price, a partial wrap about 45% and a ¾ wrap about 70%. Your exact price depends on the vehicle, coverage and design. More detail in our <a href="/satin/guides/car-wrap-cost-toronto/">car wrap cost guide</a>.</p></div><table class="table price-table"><thead><tr><th>Vehicle</th><th>Full wrap from</th></tr></thead><tbody>{prices}</tbody></table><p style="margin-top:18px"><a class="btn" href="/satin/vehicle-wraps/estimator/">Get an instant estimate</a></p></div></section>
<section class="sec" data-cms-section="s4"><div class="wrap"><div class="faq"><div style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow" data-cms-id="e19">FAQ</span><h2 class="d2" data-cms-id="e20">Questions from {n} customers.</h2><p class="small">Also serving: {others}.</p></div><div class="acc">{faq_html(city_faqs(c))}</div></div></div></section>
<section class="sec tight" data-cms-section="s5"><div class="wrap"><div class="cta"><div><h2 class="d2" data-cms-id="e21">Ready to wrap in {n}?</h2><p data-cms-id="e22">Send a photo of the vehicle and your logo — we’ll come back with a layout and a price within one business day.</p></div><div class="ctas"><button class="btn" data-cms-id="e23" data-quote="Vehicle Wraps">Request a quote</button><a class="btn ghost" data-cms-id="e24" href="tel:+19059626222">Call (905) 962-6222</a></div></div></div></section></div>'''

for c in CITIES:
    p = f'/satin/vehicle-wraps/{c["slug"]}'
    title = f'Vehicle Wraps in {c["name"]} | Satin Graphic'
    desc = f'Vehicle wraps for {c["name"]}: van, truck, trailer and fleet wraps plus colour changes, designed and installed in Vaughan. Full wraps from {START("sedan")}.'
    url = f'{ORIGIN}{p}/'
    cr = [('Home', '/satin/'), ('Vehicle Wraps', '/satin/vehicle-wraps/'), (c['name'], None)]
    page_from_tpl(p, title, desc, city_main(c), [crumbs_ld(cr, url),
        {'@type': 'Service', 'name': f'Vehicle wraps in {c["name"]}', 'serviceType': 'Vehicle wrap', 'description': desc, 'provider': {'@id': BIZ_ID}, 'areaServed': city_ld(c), 'url': url,
         'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'CAD', 'lowPrice': PRICES['sedan'], 'highPrice': PRICES['bus']}}, faq_ld(city_faqs(c))])

# --- 2b. service × city pages: <service base>/<city>/ ---
LOCAL_IMG = {'commercial': ('/satin/img/fleet-lineup.webp', 'Wrapped commercial vans and trucks'), 'lettering': ('/satin/img/job-mx-van.jpg', 'Lettered and wrapped work van'),
             'color-change': ('/satin/img/job-tesla-flip.jpg', 'Colour-flip wrap on a Tesla'), 'paint-protection-film': ('/satin/img/install-ppf.jpg', 'Installing paint protection film'),
             'window-tint': ('/satin/img/install-tint.jpg', 'Installing window tint film')}
OPT_EARLY = json.load(open(APP + '/data/optimized-assets.json')) if os.path.exists(APP + '/data/optimized-assets.json') else {}
LOCAL_IMG = {k: v for k, v in LOCAL_IMG.items() if os.path.isfile(ROOT + v[0]) or v[0] in OPT_EARLY}

def local_pricing(key):
    if key == 'commercial':
        rows = [(EST_NAMES[k], money(rnd10(PRICES[k] * .22)), money(rnd10(PRICES[k] * .45)), START(k)) for k in WRAP_ROWS]
        return 'Typical prices by coverage.', 'Approximate starting prices before HST, from our online estimator. Lettering ≈22%, partial ≈45% of the full-wrap price.', table(['Vehicle', 'Lettering ≈', 'Partial ≈', 'Full wrap from'], rows)
    if key == 'lettering':
        rows = [(EST_NAMES[k], money(rnd10(PRICES[k] * .22)), money(rnd10(PRICES[k] * .45))) for k in ['sedan', 'pickup-truck', 'transit-van', 'sprinter-van', 'box-truck', 'trailer']]
        return 'What lettering costs.', 'Approximate starting prices before HST. Lettering and decals run about 22% of a full printed wrap; a partial wrap about 45%.', table(['Vehicle', 'Lettering & decals ≈', 'Partial wrap ≈'], rows)
    if key == 'color-change':
        rows = [(EST_NAMES[k], START(k), money(rnd10(PRICES[k] * FINISH))) for k in ['sedan', 'suv', 'pickup-truck', 'minivan']]
        return 'Colour change starting prices.', 'Full colour change before HST. Matte and satin films cost about 12% more than gloss in our estimator; chrome and colour-shift films are quoted individually.', table(['Vehicle', 'Gloss from', 'Matte / satin from ≈'], rows)
    if key == 'paint-protection-film':
        rows = [('Mirrors', V['r_mirrors']), ('Partial front', V['r_partialFront']), ('Full front', V['r_fullFront']), ('Track package', V['r_track']), ('Full body · gloss', V['r_gloss']), ('Full body · matte', V['r_matte']), ('Full body · colour PPF', V['r_color'])]
        return 'Typical PPF prices.', 'Typical ranges before HST. Larger vehicles and complex bumpers sit at the top of the range; we confirm the exact price for your vehicle.', table(['Package', 'Typical price'], rows)
    if key == 'window-tint':
        rows = [('Sedan / coupe', V['t_sedan_reg'], V['t_sedan_cer']), ('SUV / crossover', V['t_suv_reg'], V['t_suv_cer']), ('Pickup truck', V['t_pickup_reg'], V['t_pickup_cer']), ('Van / minivan', V['t_van_reg'], V['t_van_cer']), ('Front two windows only (sedan)', V['t_fronts_reg'], V['t_fronts_cer'])]
        return 'Window tint prices.', f'Side windows plus back glass, before HST, from our online estimator. Commercial and residential film: ${V["c_reg"]}/sq ft standard or ${V["c_cer"]}/sq ft ceramic, plus ${V["c_inst"]}/sq ft installation (minimum order applies).', table(['Vehicle', 'Standard film', 'Ceramic film'], rows)

def local_main(key, c, i):
    S = SERVICES_LOCAL[key]; n = A(c['name'])
    f = lambda t: A(fmt(t, city=c['name']))
    cr = [('Home', '/satin/')] + S['crumb'] + [(c['name'], None)]
    faqs = local_faqs(key, c, i)
    near = ' · '.join(f'<a href="{local_url(key, s)}">{A(CITY_BY_SLUG[s]["name"])}</a>' for s in c['near'])
    others = ''.join(f'<a class="card" href="{local_url(k, c["slug"])}"><h3>{A(SERVICES_LOCAL[k]["name"])} in {n}</h3><p>{A(LOCAL_BLURB[k])}</p></a>' for k in LOCAL_ORDER if k != key)
    others += f'<a class="card" href="/satin/vehicle-wraps/{c["slug"]}/"><h3>All vehicle wraps in {n}</h3><p>Vans, trucks, trailers, colour changes and PPF.</p></a>' if key != 'commercial' else ''
    guides = ''.join(f'<a href="/satin/guides/{g}/">{A(guide_title(g))}</a>' for g in S['guides'])
    facts = ''.join(f'<li><b>{A(k)}</b><span>{f(v)}</span></li>' for k, v in S['facts']) + f'<li><b>Where</b><span>50 Viceroy Rd, Unit 22–23, Vaughan — {A(c["drive"].split("—")[0].split(";")[0].rstrip(". "))}</span></li>'
    steps = ''.join(f'<div class="card"><span class="eyebrow plain">Step {j + 1}</span><h3>{A(t)}</h3><p>{A(d)}</p></div>' for j, (t, d) in enumerate(S['process']))
    ptitle, plede, ptable = local_pricing(key)
    img = LOCAL_IMG.get(key)
    img_html = f'<img class="local-img" src="{img[0]}" alt="{A(img[1])} – {A(S["name"])} for {n} customers" loading="lazy">' if img else ''
    angle = ''.join(f'<p>{A(x)}</p>' for x in S['angle'](c))
    det = f' data-details="{A(S["details"])}"' if S.get('details') else ''
    return f'''<div class="page-enter"><section class="phero" data-cms-section="s0"><div class="wrap in"><div class="txt">{crumbs_html(cr)}<span class="eyebrow">{A(S["name"])} · {n}</span>
<h1 class="d1">{f(S["h1"])}</h1><p class="lede">{f(S["lede"])}</p>
<div class="ctas"><button class="btn" data-quote="{A(S["quote"])}"{det}>Get a free quote</button><a class="btn ghost" href="{S["base"]}">{A(S["name"])} overview</a></div></div></div></section>
<section class="sec tight answer-first vv-answer" data-answer data-cms-section="sanswer" data-cms-skip><div class="wrap"><div class="answer-box"><div><span class="eyebrow">At a glance</span><h2 class="d3">{A(S["name"])} for {n}</h2><p class="answer-lede">{f(S["answer"])}</p><p class="small answer-areas">Serving {A(c["areas"])}.</p></div><ul class="answer-facts">{facts}</ul></div></div></section>
<section class="sec" data-cms-section="s1"><div class="wrap"><div class="grid g2"><div class="local-copy"><span class="eyebrow">In {n}</span><h2 class="d2">{A(S["name"])} for {n} {"businesses" if key in ("commercial", "lettering") else "drivers"}.</h2>{angle}<p>We regularly work with customers from {A(c["areas"])}.</p></div><div>{img_html}<div class="card"><h3>Getting to our shop</h3><p>{A(c["drive"])}</p><p>{NAP_HTML}</p><a class="btn ghost sm" href="{MAPS}" target="_blank" rel="noopener">Open in Google Maps</a></div></div></div></div></section>
<section class="sec alt" data-cms-section="s2"><div class="wrap"><div class="sec-head"><span class="eyebrow">Pricing</span><h2 class="d2">{ptitle}</h2><p class="lede">{A(plede)}</p></div>{ptable}<p style="margin-top:18px"><a class="btn" href="{"/satin/window-tint/vehicle/" if key == "window-tint" else "/satin/vehicle-wraps/estimator/"}">Get an instant estimate</a></p></div></section>
<section class="sec" data-cms-section="s3"><div class="wrap"><div class="sec-head"><span class="eyebrow">How it works</span><h2 class="d2">From first call to finished.</h2></div><div class="grid g2">{steps}</div></div></section>
<section class="sec alt" data-cms-section="s4"><div class="wrap"><div class="faq"><div style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">FAQ</span><h2 class="d2">{A(S["name"])} questions from {n}.</h2><p class="small">{A(S["name"])} near {n}: {near}.</p><p class="small">Guides: <span class="link-list">{guides}</span></p></div><div class="acc">{faq_html(faqs)}</div></div></div></section>
<section class="sec" data-cms-section="s5"><div class="wrap"><div class="sec-head"><span class="eyebrow">Also in {n}</span><h2 class="d2">Other services for {n}.</h2></div><div class="grid g3">{others}</div></div></section>
<section class="sec tight" data-cms-section="s6"><div class="wrap"><div class="cta"><div><h2 class="d2">Book {A(S["name"].lower() if key != "paint-protection-film" else "PPF")} in {n}.</h2><p>Tell us the vehicle and what you have in mind — we’ll reply with options and a price within one business day.</p></div><div class="ctas"><button class="btn" data-quote="{A(S["quote"])}"{det}>Request a quote</button><a class="btn ghost" href="tel:+19059626222">Call (905) 962-6222</a></div></div></div></section></div>'''

def local_faqs(key, c, i):
    pool = SERVICES_LOCAL[key]['faqs']
    picks = sorted({0} | {(i + k) % len(pool) for k in range(1, 4)})     # the price question + a rotating set of three others
    return [(f'Do you serve {c["name"]}?', f'Yes. {c["drive"]} Everything is done at our shop at 50 Viceroy Rd, Unit 22–23, Vaughan, and we serve all of {c["region"]}.')] + \
           [(fmt(q, city=c['name']), fmt(a, city=c['name'])) for q, a in (pool[j] for j in picks)]

LOCAL_PAGES = []
for key in LOCAL_ORDER:
    S = SERVICES_LOCAL[key]
    for i, c in enumerate(CITIES):
        p = S['base'] + c['slug']
        title = f'{S["short"]} in {c["name"]} | Satin Graphic'
        if len(title) > 60: title = f'{S["short"]} in {c["name"]} | Satin'
        desc = plain(fmt(S['answer'], city=c['name']))
        if len(desc) > 158: desc = desc[:155].rsplit(' ', 1)[0].rstrip(',;:—–-') + '…'
        url = f'{ORIGIN}{p}/'
        cr = [('Home', '/satin/')] + S['crumb'] + [(c['name'], None)]
        offer = {'commercial': (PRICES['sedan'] * .22, PRICES['bus']), 'lettering': (PRICES['sedan'] * .22, PRICES['bus'] * .22), 'color-change': (PRICES['sedan'], PRICES['minivan'] * FINISH),
                 'paint-protection-film': (_pp['Mirrors'][0], _pf['Full body · Colour PPF'][1]), 'window-tint': (TINT['sedan'] * _fronts, TINT['van'] * _full * _cer)}[key]
        graph = [crumbs_ld(cr, url),
                 {'@type': 'Service', 'name': f'{S["name"]} in {c["name"]}', 'serviceType': S['serviceType'], 'description': desc, 'provider': {'@id': BIZ_ID}, 'areaServed': city_ld(c), 'url': url,
                  'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'CAD', 'lowPrice': rnd10(offer[0]), 'highPrice': rnd10(offer[1])}},
                 faq_ld(local_faqs(key, c, i))]
        page_from_tpl(p, title, desc, local_main(key, c, i), graph, LOCAL_IMG.get(key, (None,))[0])
        LOCAL_PAGES.append((key, c['slug'], p))

# --- 2c. "Areas we serve" on each main service page (replaced on every run) ---
def areas_section(key, heading, intro):
    links = ' · '.join(f'<a href="{(SERVICES_LOCAL[key]["base"] if key else "/satin/vehicle-wraps/") + c["slug"]}/">{A(c["name"])}</a>' for c in CITIES)
    return f'<section class="sec tight" data-cms-section="sareas"><div class="wrap"><div class="sec-head"><span class="eyebrow">Areas we serve</span><h2 class="d2">{A(heading)}</h2><p class="lede">{A(intro)} {links}.</p></div></div></section>'
AREA_PAGES = {'/satin/vehicle-wraps': (None, 'Vehicle wraps across the GTA.'), '/satin/vehicle-wraps/commercial': ('commercial', 'Commercial wraps across the GTA.'),
              '/satin/vehicle-wraps/lettering': ('lettering', 'Vehicle lettering across the GTA.'), '/satin/vehicle-wraps/color-change': ('color-change', 'Colour change wraps across the GTA.'),
              '/satin/vehicle-wraps/paint-protection-film': ('paint-protection-film', 'Paint protection film across the GTA.'), '/satin/window-tint': ('window-tint', 'Window tinting across the GTA.'),
              '/satin/window-tint/vehicle': ('window-tint', 'Car window tinting across the GTA.'), '/satin/contact': (None, 'Customers from across the GTA.'), '/satin/about': (None, 'Serving Vaughan, Toronto and the GTA.')}
EXTRA_LINKS = {'/satin/print-shop/large-format': [('Poly bag lawn signs', '/satin/print-shop/large-format/poly-bag-lawn-sign/')],
               '/satin/shop': [('Custom DTF transfers', '/satin/shop/dtf-transfers/')], '/satin/apparel': [('Custom DTF transfers (gang sheets for your own press)', '/satin/shop/dtf-transfers/')]}

# --- 2d. guides: /satin/guides/ and /satin/guides/<slug>/ ---
GUIDE_IMG = {'car-wrap-cost-toronto': ('/satin/img/cc-sedan-green.jpg', 'Green colour change wrap on a sedan'), 'wrap-vs-paint': ('/satin/img/job-subaru-matte.jpg', 'Matte wrap on a Subaru'),
             'wrap-lifespan-canadian-winter': ('/satin/img/install-film.jpg', 'Wrap film being installed in a heated bay'), 'ppf-vs-ceramic-coating': ('/satin/img/install-ppf.jpg', 'Paint protection film installation'),
             'ontario-window-tint-law': ('/satin/img/install-tint.jpg', 'Window tint film being installed'), 'fleet-wrap-roi': ('/satin/img/fleet-lineup.webp', 'A line-up of wrapped fleet vehicles'),
             'prepare-artwork-vehicle-wrap-print': ('/satin/img/design-studio.png', 'Designing a vehicle wrap layout')}
from seo_guides_extra import GUIDE_IMG_EXTRA, GUIDE_LINKS_EXTRA
GUIDE_IMG.update(GUIDE_IMG_EXTRA)
def guide_url(g): return f'/satin/guides/{g["slug"]}/'
def slug_id(t): return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
GUIDE_LASTMOD = {}
try: GUIDE_LASTMOD = json.load(open(os.path.join(os.path.dirname(OUT), 'seo-lastmod.json')))
except Exception: pass
DATE_H = lambda d: datetime.date.fromisoformat(d).strftime('%B %-d, %Y')

for g in GUIDES:
    p = guide_url(g).rstrip('/'); url = ORIGIN + p + '/'
    modified = max(GUIDE_DATE, (GUIDE_LASTMOD.get(p + '/') or [None, GUIDE_DATE])[1])
    toc = ''.join(f'<a href="#{slug_id(h)}" data-jump="{slug_id(h)}">{A(h)}</a>' for h, _ in g['sections'])
    toc += '<a href="#questions" data-jump="questions">Questions</a><span class="eyebrow plain" style="margin:18px 0 6px">Related</span>' + ''.join(
        f'<a href="{A(u)}"' + (' target="_blank" rel="noopener"' if u.startswith('http') else '') + f'>{A(t)}</a>' for t, u in g['links'])
    img = GUIDE_IMG.get(g['slug'])
    fig = f'<figure><img src="{img[0]}" alt="{A(img[1])}" loading="lazy"></figure>' if img and (os.path.isfile(ROOT + img[0]) or img[0] in OPT_EARLY) else ''
    body = ''.join(f'<h2 id="{slug_id(h)}">{A(h)}</h2>' + md(fmt(t)) + (fig if k == 0 else '') for k, (h, t) in enumerate(g['sections']))
    faqs = [(fmt(q), fmt(a)) for q, a in g['faqs']]
    more = ''.join(f'<a class="card" href="{guide_url(o)}"><span class="eyebrow plain">{A(o["cat"])}</span><h3>{A(o["h1"])}</h3><p>{A(fmt(o["lede"]))}</p></a>' for o in GUIDES if o is not g)[:100000]
    cr = [('Home', '/satin/'), ('Guides', '/satin/guides/'), (g['h1'].split(':')[0].split('?')[0][:48], None)]
    main = f'''<div class="page-enter"><section class="phero solo" data-cms-section="s0"><div class="wrap in"><div class="txt">{crumbs_html(cr)}<span class="eyebrow">{A(g["cat"])} · Guide</span>
<h1 class="d2">{A(g["h1"])}</h1><p class="lede">{A(fmt(g["lede"]))}</p><div class="guide-meta"><span class="tiny mono">By the {A(AUTHOR)}</span><span class="tiny mono">Updated <time datetime="{modified}">{DATE_H(modified)}</time></span></div></div></div></section>
<section class="sec" data-cms-section="s1"><div class="wrap"><div class="policy"><nav aria-label="On this page" class="toc"><span class="eyebrow plain" style="margin-bottom:6px">On this page</span>{toc}</nav>
<article class="guide-art">{body}<h2 id="questions">Questions</h2><div class="acc">{faq_html(faqs)}</div><p class="small" style="margin-top:18px">Written by the {A(AUTHOR)} at our shop in Vaughan, Ontario. Prices are in CAD before HST and come from our published estimator; we update this guide when they change. Questions? <a href="/satin/contact/">Contact us</a> or call <a href="tel:+19059626222">(905) 962-6222</a>.</p></article></div></div></section>
<section class="sec alt" data-cms-section="s2"><div class="wrap"><div class="sec-head"><span class="eyebrow">More guides</span><h2 class="d2">Keep reading.</h2></div><div class="grid g3">{more}</div></div></section>
<section class="sec tight" data-cms-section="s3"><div class="wrap"><div class="cta"><div><h2 class="d2">Talk to the shop.</h2><p>Send the vehicle and what you have in mind — we’ll reply with options and a price within one business day.</p></div><div class="ctas"><button class="btn" data-quote="Vehicle Wraps">Get a free quote</button><a class="btn ghost" href="/satin/vehicle-wraps/estimator/">Estimate the cost</a></div></div></div></section></div>'''
    desc = fmt(g['desc'])
    if len(desc) > 158: desc = desc[:155].rsplit(' ', 1)[0].rstrip(',;:—–-') + '…'
    art = {'@type': 'Article', 'headline': g['h1'], 'description': desc, 'datePublished': GUIDE_DATE, 'dateModified': modified, 'inLanguage': 'en-CA',
           'author': {'@type': 'Organization', 'name': AUTHOR, 'url': f'{ORIGIN}/satin/about/'}, 'publisher': {'@id': BIZ_ID}, 'mainEntityOfPage': url, 'url': url,
           'about': [{'@type': 'Thing', 'name': t} for t, u in g['links'] if not u.startswith('http')][:3]}
    if img: art['image'] = ORIGIN + img[0]
    page_from_tpl(p, g['title'], desc, main, [crumbs_ld(cr, url), art, faq_ld(faqs)], img[0] if img else None)

hub_cards = ''.join(f'<a class="card" href="{guide_url(g)}"><span class="eyebrow plain">{A(g["cat"])}</span><h3>{A(g["h1"])}</h3><p>{A(fmt(g["lede"]))}</p><div class="foot"><span class="tiny"></span><span class="link">Read the guide →</span></div></a>' for g in GUIDES)
hub_main = f'''<div class="page-enter"><section class="phero solo" data-cms-section="s0"><div class="wrap in"><div class="txt">{crumbs_html([("Home", "/satin/"), ("Guides", None)])}<span class="eyebrow">Guides &amp; advice</span>
<h1 class="d2">Vehicle wrap, tint &amp; print guides.</h1><p class="lede">Straight answers to the questions we hear most at the shop — costs, lifespans, Ontario rules and how to prepare artwork — written by the {A(AUTHOR)} in Vaughan.</p></div></div></section>
<section class="sec" data-cms-section="s1"><div class="wrap"><div class="sec-head"><h2 class="d3">All guides</h2></div><div class="grid g3">{hub_cards}</div></div></section>
<section class="sec alt" data-cms-section="s2"><div class="wrap"><div class="sec-head"><span class="eyebrow">Services</span><h2 class="d2">Ready for a price?</h2><p class="lede">Try the <a href="/satin/vehicle-wraps/estimator/">wrap cost estimator</a>, see <a href="/satin/vehicle-wraps/commercial/">commercial wraps</a>, <a href="/satin/vehicle-wraps/color-change/">colour change</a>, <a href="/satin/vehicle-wraps/paint-protection-film/">PPF</a> and <a href="/satin/window-tint/">window tint</a>, or read the <a href="/satin/faq/">FAQ</a>.</p></div></div></section></div>'''
hub_url = f'{ORIGIN}/satin/guides/'
page_from_tpl('/satin/guides', 'Vehicle Wrap, Tint & Print Guides | Satin Graphic', 'Guides from a Vaughan wrap & print shop: car wrap costs, wrap vs paint, PPF, Ontario tint law, business cards, signs, window graphics, murals and apparel.',
              hub_main, [crumbs_ld([('Home', '/satin/'), ('Guides', None)], hub_url),
                         {'@type': 'CollectionPage', 'name': 'Guides & advice', 'url': hub_url, 'hasPart': [{'@type': 'Article', 'headline': g['h1'], 'url': ORIGIN + guide_url(g), 'datePublished': GUIDE_DATE, 'author': {'@type': 'Organization', 'name': AUTHOR}} for g in GUIDES]}])

# --- 2e. links into the new pages from existing pages ---
GUIDE_LINKS = {'/satin/vehicle-wraps': ['car-wrap-cost-toronto', 'wrap-vs-paint', 'wrap-lifespan-canadian-winter'], '/satin/vehicle-wraps/commercial': ['fleet-wrap-roi', 'car-wrap-cost-toronto', 'prepare-artwork-vehicle-wrap-print'],
               '/satin/vehicle-wraps/commercial/fleet-programs': ['fleet-wrap-roi', 'prepare-artwork-vehicle-wrap-print'], '/satin/vehicle-wraps/color-change': ['wrap-vs-paint', 'wrap-lifespan-canadian-winter', 'car-wrap-cost-toronto'],
               '/satin/vehicle-wraps/paint-protection-film': ['ppf-vs-ceramic-coating', 'wrap-lifespan-canadian-winter'], '/satin/window-tint': ['ontario-window-tint-law'], '/satin/window-tint/vehicle': ['ontario-window-tint-law'],
               '/satin/vehicle-wraps/estimator': ['car-wrap-cost-toronto', 'fleet-wrap-roi'], '/satin/auto-detailing/ceramic-coating': ['ppf-vs-ceramic-coating'], '/satin/artwork-guidelines': ['prepare-artwork-vehicle-wrap-print'],
               '/satin/faq': [g['slug'] for g in GUIDES], '/satin/vehicle-wraps/lettering': ['fleet-wrap-roi', 'prepare-artwork-vehicle-wrap-print']}
for _p, _sl in GUIDE_LINKS_EXTRA.items(): GUIDE_LINKS[_p] = list(dict.fromkeys(GUIDE_LINKS.get(_p, []) + _sl))
def guides_section(slugs):
    links = ''.join(f'<a href="/satin/guides/{s}/">{A(guide_title(s))}</a>' for s in slugs)
    return f'<section class="sec tight" data-cms-section="sguides"><div class="wrap"><div class="sec-head"><span class="eyebrow">Guides</span><h2 class="d3">Helpful reading</h2><p class="link-list">{links}<a href="/satin/guides/">All guides →</a></p></div></div></section>'
def add_sections(p):
    if not os.path.isfile(path_file(p)): return
    s0 = s = read(p)
    for name in ('sareas', 'sguides', 'smore'): s = SECTION_RX(name).sub('', s)
    extra = ''
    if p in EXTRA_LINKS and all(os.path.isfile(path_file(u.rstrip('/'))) for _, u in EXTRA_LINKS[p]):
        extra += '<section class="sec tight" data-cms-section="smore"><div class="wrap"><div class="sec-head"><span class="eyebrow">Also available</span><p class="link-list">' + ''.join(f'<a href="{u}">{A(t)}</a>' for t, u in EXTRA_LINKS[p]) + '</p></div></div></section>'
    if p in AREA_PAGES:
        key, h = AREA_PAGES[p]
        extra += areas_section(key, h, 'Installed at our shop at 50 Viceroy Rd in Vaughan, for customers from:')
    if p in GUIDE_LINKS: extra += guides_section(GUIDE_LINKS[p])
    if extra:
        if '.link-list{' not in s: extra = '<style>.link-list{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}</style>' + extra
        i = s.find('</main>') + len('</main>')      # outside <main>: the client re-renders <main> on known pages
        s = s[:i] + extra + s[i:]
    if s != s0: write(p, s)


# ---------- 4. vehicle lettering landing page (static, like the city pages) ----------
LETTERING_FAQ = [
 ('How much does vehicle lettering cost?', f'Lettering and decals usually cost about 22% of a full printed wrap for the same vehicle. For reference, full wraps start at {START("sedan")} for a car and {START("transit-van")} for a Transit-size van, before tax. Send a photo of the vehicle and your logo for an exact price.'),
 ('What can you put on a work vehicle?', 'Your company name, logo, phone number, website and list of services on the doors, sides and rear, plus unit numbers. Perforated window film can carry graphics over rear and side glass.'),
 ('Is lettering cheaper than a wrap?', 'Yes. Lettering and decals use less film and less installation time than a partial (about 45% of the full-wrap price), ¾ (about 70%) or full wrap.'),
 ('Will decals damage my paint?', 'No. Quality cast vinyl removes cleanly from factory (OEM) paint when it is taken off properly.'),
 ('Do you letter trucks, trailers and fleets?', 'Yes — vans, pickups, box trucks, trailers, buses and multi-vehicle fleets. Fleet pricing starts at 3 vehicles and every vehicle gets the same layout.'),
 ('Do you design the lettering?', 'Yes. Our in-house designers lay it out on your exact vehicle template so text never lands on a door handle or panel gap. You can also send print-ready artwork.'),
]
def lettering_main():
    cards = ''.join(f'<a class="card" href="{u}"><h3>{A(t)}</h3><p>{A(d)}</p><div class="foot"><span class="tiny">{"Full wraps from " + START(k) if k else ""}</span><span class="link">View options →</span></div></a>' for t, u, d, k in SVC_LINKS[:4])
    faq_html = ''.join(f'<details{" open" if i == 0 else ""}><summary>{A(q)}</summary><div class="a">{A(a)}</div></details>' for i, (q, a) in enumerate(LETTERING_FAQ))
    cities = ' · '.join(f'<a href="/satin/vehicle-wraps/lettering/{c["slug"]}/">{A(c["name"])}</a>' for c in CITIES)
    facts = [('Typical price', f'About 22% of a full wrap · full wraps from {START("sedan")} (car) / {START("transit-van")} (Transit van)'), ('Where', '50 Viceroy Rd, Unit 22–23, Vaughan — serving Toronto and the GTA'), ('What we letter', 'Vans, pickups, box trucks, trailers, buses, cars and fleets'), ('Design', 'In-house, laid out on your exact vehicle template')]
    facts_html = ''.join(f'<li><b>{A(k)}</b><span>{A(v)}</span></li>' for k, v in facts)
    return f'''<div class="page-enter"><section class="phero" data-cms-section="s0"><div class="wrap in"><div class="txt"><nav aria-label="Breadcrumb" class="crumbs"><a href="/satin/">Home</a><span class="sep">/</span><a href="/satin/vehicle-wraps/">Vehicle Wraps</a><span class="sep">/</span><span aria-current="page">Lettering &amp; decals</span></nav><span class="eyebrow" data-cms-id="e0">Vehicle lettering · Decals · Signs</span>
<h1 class="d1" data-cms-id="e1">Vehicle lettering &amp; decals in Vaughan.</h1><p class="lede" data-cms-id="e2">Clean, readable vehicle signage for vans, trucks, trailers and fleets — your name, logo, phone number and website, designed, printed and installed in-house for businesses across Toronto and the GTA.</p>
<div class="ctas"><button class="btn" data-cms-id="e3" data-quote="Vehicle Wraps" data-details="Wrap type: Commercial; Coverage: Decals + Lettering">Get a lettering quote</button><a class="btn ghost" data-cms-id="e4" href="/satin/vehicle-wraps/estimator/">Estimate the cost</a></div></div></div></section>
<section class="sec tight answer-first vv-answer" data-answer data-cms-section="sanswer" data-cms-skip><div class="wrap"><div class="answer-box"><div><span class="eyebrow">At a glance</span><h2 class="d3">Vehicle lettering and signs for GTA businesses</h2><p class="answer-lede">Satin Graphic (Satin Auto Wrap) designs, prints and installs vehicle lettering, truck decals and van graphics at its shop in Vaughan, Ontario. Lettering is the most affordable way to put your business on the road: it typically costs about 22% of a full printed wrap for the same vehicle, and it can be upgraded to a partial or full wrap later.</p><p class="small answer-areas">Serving {cities} and the rest of the GTA.</p></div><ul class="answer-facts">{facts_html}</ul></div></div></section>
<section class="sec" data-cms-section="s1"><div class="wrap"><div class="sec-head"><span class="eyebrow" data-cms-id="e5">More coverage</span><h2 class="d2" data-cms-id="e6">Lettering, partial or full wrap.</h2><p class="lede" data-cms-id="e7">Decals and lettering cover the essentials. A partial wrap costs about 45% of a full wrap, a ¾ wrap about 70%. Every option is designed on your exact vehicle template and printed on cast film with a protective laminate.</p></div><div class="grid g2">{cards}</div></div></section>
<section class="sec alt" data-cms-section="s2"><div class="wrap"><div class="faq"><div style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow" data-cms-id="e8">FAQ</span><h2 class="d2" data-cms-id="e9">Vehicle lettering questions.</h2><p class="small"><a href="/satin/faq/">All FAQs</a> · <a href="/satin/vehicle-wraps/commercial/">Commercial wraps</a></p></div><div class="acc">{faq_html}</div></div></div></section>
<section class="sec tight" data-cms-section="s3"><div class="wrap"><div class="cta"><div><h2 class="d2" data-cms-id="e10">Put your business on the road.</h2><p data-cms-id="e11">Send a photo of the vehicle and your logo — we’ll come back with a layout and a price within one business day.</p></div><div class="ctas"><button class="btn" data-cms-id="e12" data-quote="Vehicle Wraps" data-details="Wrap type: Commercial; Coverage: Decals + Lettering">Request a quote</button><a class="btn ghost" data-cms-id="e13" href="tel:+19059626222">Call (905) 962-6222</a></div></div></div></section></div>'''

p = '/satin/vehicle-wraps/lettering'
title = 'Vehicle Lettering & Decals in Vaughan & GTA | Satin Graphic'
desc = 'Vehicle lettering, truck decals and van graphics in Vaughan for Toronto & GTA businesses. Designed, printed and installed in-house, about 22% of a full-wrap price.'
s = set_head(TPL, title, desc)
url = f'{ORIGIN}{p}/'
s = re.sub(r'(<link rel="canonical" href=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s)
s = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s)
s = re.sub(r'<link rel="alternate" hreflang[^>]*>\s*', '', s)
s = re.sub(r'data-prerender-path="[^"]*"', f'data-prerender-path="{p[len("/satin"):]}"', s, count=1)
a, b = s.find('<main'), s.find('</main>')
s = s[:a] + s[a:s.find('>', a) + 1] + lettering_main() + s[b:]
def _fix_lettering(data):
    g = [n for n in data.get('@graph', []) if 'LocalBusiness' in (n.get('@type') if isinstance(n.get('@type'), list) else [n.get('@type')])]
    g.append({'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{ORIGIN}/satin/'}, {'@type': 'ListItem', 'position': 2, 'name': 'Vehicle Wraps', 'item': f'{ORIGIN}/satin/vehicle-wraps/'}, {'@type': 'ListItem', 'position': 3, 'name': 'Vehicle lettering & decals', 'item': url}]})
    g.append({'@type': 'Service', 'name': 'Vehicle lettering & decals', 'serviceType': 'Vehicle lettering', 'description': desc, 'provider': {'@id': f'{ORIGIN}/satin/#business'}, 'areaServed': [{'@type': 'City', 'name': c['name']} for c in CITIES] + [{'@type': 'AdministrativeArea', 'name': 'Greater Toronto Area'}], 'url': url})
    g.append({'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in LETTERING_FAQ]})
    data['@graph'] = g
write(p, schema_edit(s, _fix_lettering))

# ---------- 4b. areas / guides link sections on the main service pages ----------
for p in sorted(set(AREA_PAGES) | set(GUIDE_LINKS) | set(EXTRA_LINKS)): add_sections(p)

# ---------- 4c. "Quick answers" on the commercial wrap pages: short, specific answers built from the live price rules ----------
def _cov(rid, label):
    r = rule(rid); base = r.get('constants', {}).get('base') or PRICES.get(rid[5:], 0); return base * opt_val(r, 'coverage', label, 1)
def _roof(rid): return rule(rid).get('constants', {}).get('roofMultiplier', 1.12)
def answers_html():
    t, sp = 'wrap-transit-van', 'wrap-sprinter-van'
    rows = [(n, money(rnd10(_cov(t, lbl))), money(rnd10(_cov(sp, lbl)))) for n, lbl in [('Decals + lettering', 'Decals'), ('Partial wrap', 'Partial'), ('Half / ¾ wrap', 'Half'), ('Full wrap', 'Full')]]
    roof = round((_roof(t) - 1) * 100)
    qa = [
        ('How much does a Ford Transit or Mercedes Sprinter wrap cost in Vaughan?',
         'Starting prices at our Vaughan shop (short / standard wheelbase, low roof, gloss Arlon cast film, your print-ready artwork):' + table(['Coverage', 'Ford Transit from', 'Mercedes Sprinter from'], rows) +
         '<p>Longer wheelbases, high roofs, matte or satin finishes (+12%) and 3M or Avery film change the price — the <a href="/satin/vehicle-wraps/estimator/">wrap estimator</a> shows the exact number for your van, and we confirm it after seeing the vehicle.</p>'),
        ('Does a full wrap include the roof?',
         f'<p>No — the full-wrap price covers both sides, the front and the back. The roof is an option (about +{roof}% on the wrap price) because most roofs are only seen from above; we recommend it for colour changes and for vans parked below windows or overpasses.</p>'),
        ('Which businesses is a partial wrap right for?',
         '<p>Partial wraps (printed graphics on part of the van, blended into its paint colour) suit trades and service companies with white or single-colour vans: you get large logos, services and phone numbers at about half the cost of a full wrap. Choose a full wrap when the van colour does not match your brand or you want photo graphics across the whole body.</p>'),
        ('How long does a wrap last in an Ontario winter?',
         '<p>With cast film and laminate, expect 5–7 years on vertical panels and 3–5 years on horizontal ones (hood and roof). Hand-wash regularly in winter to remove road salt; the main risks are automatic brush washes and pressure washers aimed at edges. Wraps should be installed indoors — ours are applied in our own indoor bay all year.</p>'),
        ('What does the warranty not cover?',
         '<p>Our 5-year workmanship warranty covers lifting, peeling and bubbling caused by installation. It does not cover accident damage, pressure washers at edges, automatic brush washes, chemicals, or wraps over repaint, damaged paint or non-OEM panels we flagged at inspection. Film durability is covered separately by the manufacturer — see the <a href="/satin/warranty/">warranty page</a>.</p>'),
        ('How long will my van be off the road?',
         '<p>Design takes 3–5 business days, printing 1–2 days and installation 1–2 days. Most vans are dropped off in the morning and back on the road the next day.</p>'),
    ]
    items = ''.join(f'<details{" open" if i == 0 else ""}><summary>{A(q)}</summary><div class="a">{a}</div></details>' for i, (q, a) in enumerate(qa))
    return ('<section class="sec tight" data-cms-section="sanswers"><div class="wrap"><div class="sec-head"><span class="eyebrow">Quick answers</span>'
            '<h2 class="d3">Van wrap prices and facts — Vaughan &amp; GTA</h2></div><div class="faq">' + items + '</div></div></section>')
for _p in ['/satin/vehicle-wraps/commercial', '/satin/vehicle-wraps/commercial/vans', '/satin/vehicle-wraps/commercial/fleet-programs']:
    if not os.path.isfile(path_file(_p)): continue
    _s0 = _s = read(_p); _s = SECTION_RX('sanswers').sub('', _s)
    _i = _s.find('</main>') + len('</main>'); _s = _s[:_i] + answers_html() + _s[_i:]
    if _s != _s0: write(_p, _s)

# ---------- 5. oversized images: recompress / resize in place (same paths, same aspect ratio) ----------
def optimize_images():
    import io
    from PIL import Image
    done, saved, seen = 0, 0, {}
    for f in sorted(glob.glob(ROOT + '/satin/img/**/*', recursive=True)):
        if not re.search(r'\.(webp|jpe?g|png)$', f, re.I) or not os.path.isfile(f): continue
        size = os.path.getsize(f)
        if size < 150_000: continue
        raw = open(f, 'rb').read(); key = hashlib.sha1(raw).hexdigest()
        m = re.search(r'-(\d{3,4})\.\w+$', f)
        target = int(m.group(1)) if m and 320 <= int(m.group(1)) <= 2400 else 1800
        if (key, target) in seen:
            out = seen[(key, target)]
        else:
            out = None
            try:
                im = Image.open(io.BytesIO(raw)); fmt = im.format
                if getattr(im, 'is_animated', False) or fmt not in ('WEBP', 'JPEG', 'PNG'): raise ValueError
                w, h = im.size
                if fmt == 'PNG' and w <= target: raise ValueError        # lossless PNGs (cut-outs) stay unless oversized
                if w > target: im = im.resize((target, max(1, round(h * target / w))), Image.LANCZOS)
                buf = io.BytesIO()
                if fmt == 'WEBP':
                    if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')
                    im.save(buf, 'WEBP', quality=80, method=5)
                elif fmt == 'JPEG': im.convert('RGB').save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
                else: im.save(buf, 'PNG', optimize=True)
                if buf.tell() < size * 0.85: out = buf.getvalue()
            except Exception: out = None
            seen[(key, target)] = out
        if out:
            open(f, 'wb').write(out); done += 1; saved += size - len(out); changed.add(f)
    print(f'images: {done} recompressed, {saved / 1e6:.1f} MB saved')
optimize_images()

# ---------- 5b. external images -> our own host ----------
# Every image hot-linked from another site (supplier apparel photos, Google review photos, brand logos) is rewritten to
# /satin/img/ext/<sha1-16>.<ext> in the pages, JS modules and JSON data. satin-new/data/ext-images.json maps each file to
# its original URL; the server downloads a file the first time it is requested (php/satin-new/ext_images.php) and
# Admin → /admin/ext-images.html copies them all in advance. Runs before the page pass so ?v= hashes see the final files.
EXT_IMG_DIR = '/satin/img/ext/'
EXT_IMG_RX = re.compile(r'https?:(\\?/)\\?/(sinalite\.com|www\.sinalite\.com|lh3\.googleusercontent\.com|dfmm8fty2renf\.cloudfront\.net)((?:\\?/[A-Za-z0-9._~%+=,@!-]+)+)')
EXT_IMG_EXT = ('jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif')
def ext_image_name(host, path):
    """Local file name for an external image URL, or None when the URL is not an image (e.g. a supplier product page)."""
    m = re.search(r'\.([A-Za-z0-9]{2,5})$', path)
    ext = m.group(1).lower() if m else ''
    if host.endswith('sinalite.com') and not path.startswith('/media/'): return None
    if ext not in EXT_IMG_EXT:
        if host != 'lh3.googleusercontent.com': return None
        ext = 'jpg'                                       # Google photo URLs carry no extension; JPEG is what they serve by default
    return hashlib.sha1(f'https://{host}{path}'.encode()).hexdigest()[:16] + '.' + ('jpg' if ext == 'jpeg' else ext)
def mirror_external_images():
    mf = APP + '/data/ext-images.json'
    try: manifest = json.load(open(mf, encoding='utf-8'))
    except Exception: manifest = {}
    n_files = n_refs = 0
    def sub(m):
        nonlocal n_refs
        esc_slash, host, path = m.group(1), m.group(2), m.group(3).replace('\\/', '/')
        name = ext_image_name(host, path)
        if not name: return m.group(0)
        manifest[name] = f'https://{host}{path}'
        n_refs += 1
        local = EXT_IMG_DIR + name
        return local.replace('/', '\\/') if esc_slash.startswith('\\') else local   # JSON-escaped slashes stay escaped
    targets = []
    for base, skip in ((ROOT, ROOT + '/satin/img'), (APP + '/data', None)):
        for d, dirs, files in os.walk(base):
            if skip and d.startswith(skip): dirs[:] = []; continue
            targets += [os.path.join(d, f) for f in files if re.search(r'\.(html|mjs|js|json|css|xml)$', f) and f != 'ext-images.json']
    for f in targets:
        raw = open(f, 'rb').read()
        if not re.search(rb'sinalite\.com|googleusercontent\.com|cloudfront\.net', raw): continue
        s0 = raw.decode('utf-8')
        s = EXT_IMG_RX.sub(sub, s0)
        if s != s0:
            open(f, 'w', encoding='utf-8').write(s); changed.add(f); n_files += 1
    os.makedirs(os.path.dirname(mf), exist_ok=True)
    json.dump(dict(sorted(manifest.items())), open(mf, 'w', encoding='utf-8'), indent=0, ensure_ascii=False)
    print(f'external images: {n_refs} references in {n_files} files -> {EXT_IMG_DIR} ({len(manifest)} files in data/ext-images.json)')
    # sizes we can tell from the URL (Google photos: …=w375-h563-…) so those <img> tags get width/height before the files exist
    for name, u in manifest.items():
        d = re.search(r'=w(\d+)-h(\d+)', u)
        if d: EXT_DIMS[EXT_IMG_DIR + name] = (int(d.group(1)), int(d.group(2)))
EXT_DIMS = {}
mirror_external_images()

# ---------- 6. site-wide pass over every page ----------
OPT = json.load(open(APP + '/data/optimized-assets.json')) if os.path.exists(APP + '/data/optimized-assets.json') else {}
_dims, _hash = {}, {}
def local_file(src):
    p = src.split('?')[0].split('#')[0]
    if not p.startswith('/') or p.startswith('//'): return None
    if os.path.isfile(ROOT + p): return ROOT + p
    if p in OPT and os.path.isfile(ROOT + OPT[p]): return ROOT + OPT[p]
    return None
def dims(f):
    if f not in _dims:
        try:
            if f.lower().endswith('.svg'):      # intrinsic size of an SVG: width/height attributes, else the viewBox
                head = open(f, encoding='utf-8', errors='ignore').read(4000)
                tag = re.search(r'<svg\b[^>]*>', head).group(0)
                w = re.search(r'\swidth="([\d.]+)(?:px)?"', tag); h = re.search(r'\sheight="([\d.]+)(?:px)?"', tag)
                vb = re.search(r'viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)', tag)
                _dims[f] = (round(float(w.group(1))), round(float(h.group(1)))) if w and h else ((round(float(vb.group(1))), round(float(vb.group(2)))) if vb else None)
            else:
                from PIL import Image
                with Image.open(f) as im: _dims[f] = im.size
        except Exception: _dims[f] = None
    return _dims[f]
def vhash(f):
    if f not in _hash: _hash[f] = hashlib.sha1(open(f, 'rb').read()).hexdigest()[:10]
    return _hash[f]

BIZ = f'{ORIGIN}/satin/#business'
CITY_NAMES = [c['name'] for c in CITIES]
SERVICES = [('Vehicle wraps', '/satin/vehicle-wraps/'), ('Commercial & fleet vehicle wraps', '/satin/vehicle-wraps/commercial/'), ('Vehicle lettering & decals', '/satin/vehicle-wraps/lettering/'),
            ('Colour change wraps', '/satin/vehicle-wraps/color-change/'), ('Paint protection film (PPF)', '/satin/vehicle-wraps/paint-protection-film/'), ('Window tinting', '/satin/window-tint/'),
            ('Window graphics & storefront vinyl', '/satin/window-graphics/'), ('Print shop: business cards, flyers, brochures', '/satin/print-shop/'), ('Large format printing, banners & signs', '/satin/print-shop/large-format/'),
            ('Custom apparel & workwear printing', '/satin/apparel/'), ('Wallpaper & wall murals', '/satin/wallpaper/'), ('Auto detailing & ceramic coating', '/satin/auto-detailing/'), ('Graphic design studio', '/satin/design-studio/')]
def enrich_business(n, home=False):
    t = n.get('@type')
    n['@type'] = ['LocalBusiness', 'AutomotiveBusiness']
    n['@id'] = BIZ
    n.setdefault('name', 'Satin Graphic')
    n['alternateName'] = ['Satin Auto Wrap', 'Satin Auto Wrap Inc.']
    n['url'] = f'{ORIGIN}/satin/'
    n['logo'] = f'{ORIGIN}/satin/img/logo.png'
    n['telephone'] = '+1-905-962-6222'
    n['email'] = 'info@satingraphic.ca'
    n['address'] = {'@type': 'PostalAddress', 'streetAddress': '50 Viceroy Rd, Unit 22–23', 'addressLocality': 'Vaughan', 'addressRegion': 'ON', 'addressCountry': 'CA'}
    n['openingHoursSpecification'] = HOURS_SPEC
    n['hasMap'] = 'https://www.google.com/maps/search/?api=1&query=50+Viceroy+Rd+Unit+22+Vaughan+ON'
    n['areaServed'] = [{'@type': 'City', 'name': c} for c in CITY_NAMES] + [{'@type': 'AdministrativeArea', 'name': 'Greater Toronto Area'}, {'@type': 'State', 'name': 'Ontario'}]
    n['currenciesAccepted'] = 'CAD'
    n['knowsAbout'] = ['Vehicle wraps', 'Commercial fleet graphics', 'Vehicle lettering', 'Colour change wraps', 'Paint protection film', 'Window tint', 'Large format printing', 'Signs and banners', 'Business card printing', 'Custom apparel printing', 'Window graphics', 'Wall murals']
    if home:
        n['description'] = 'Vehicle wrap, window tint, sign and print shop in Vaughan, Ontario, serving Toronto and the Greater Toronto Area. Design, large-format printing and installation in-house.'
        n['hasOfferCatalog'] = {'@type': 'OfferCatalog', 'name': 'Services', 'itemListElement': [{'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': nm, 'url': ORIGIN + u}} for nm, u in SERVICES]}
    return n

def shorten_title(t):
    if len(t) <= 60: return t
    t2 = re.sub(r'\s*\d+(?:\.\d+)?\s*oz\.?/lin\.?\s*yd\.?,?', '', t); t2 = re.sub(r'\s{2,}', ' ', t2)
    if len(t2) <= 60: return t2
    t3 = re.sub(r'\s*\|\s*Satin Graphic$', ' | Satin', t2)
    if len(t3) <= 60: return t3
    parts = t3.split(' | ')
    head = parts[0]
    while len(head + ' | Satin') > 60 and ' ' in head: head = head.rsplit(' ', 1)[0].rstrip(' -–—,:')
    return head + ' | Satin'

def humanize(src):
    n = src.split('?')[0].rsplit('/', 1)[-1]
    n = re.sub(r'\.(optimized\.)?(webp|jpe?g|png|gif|svg)$', '', n, flags=re.I)
    n = re.sub(r'\.optimized$', '', n)
    n = re.sub(r'[-_](\d{2,4}|v\d+|cut|optimized|thumb|min|copy|final)(?=$|[-_])', '', n)
    n = re.sub(r'[-_]+', ' ', n).strip()
    return n[:1].upper() + n[1:] if n else ''

UTIL_RX = re.compile(r'^/(?:satin/(?:(?:fa|fr|es)/)?)?(account|login|register|track|checkout|cart|pay|404|design-agreement|installation-terms)(/|$)')
ROBOTS_INDEX = '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'
GENERIC_DESC = {'خدمات و گزینه\u200cهای ستین گرافیک در وان، تورنتو و منطقه GTA.', 'Servicios y opciones de Satin Graphic en Vaughan y el Gran Toronto.', 'Services et options de Satin Graphic à Vaughan et dans le Grand Toronto.'}
GENERIC_EN = re.compile(r'— custom services from Satin Graphic in Vaughan\.$')
LANG_DESC = {'fa': '{} — ستین گرافیک (Satin Auto Wrap) در وان، انتاریو؛ خدمات‌دهی به تورنتو و منطقه GTA. طراحی، چاپ و نصب در یک کارگاه.',
             'fr': '{} — Satin Graphic (Satin Auto Wrap) à Vaughan, Ontario, au service de Toronto et du Grand Toronto. Conception, impression et pose sur place.',
             'es': '{} — Satin Graphic (Satin Auto Wrap) en Vaughan, Ontario, al servicio de Toronto y el Gran Toronto (GTA). Diseño, impresión e instalación propios.'}
APPAREL_DESC = '{}: custom printed or embroidered with your logo by Satin Graphic in Vaughan, serving Toronto & the GTA. No minimum order.'
EN_DESC = '{} from Satin Graphic in Vaughan, Ontario — designed, produced and installed in-house for Toronto & GTA customers. Get a quote.'
HREFLANGS = [('en-CA', ''), ('fr-CA', 'fr'), ('es', 'es'), ('fa', 'fa')]
BOOT_MODULES = ['/studio/i18n.mjs', '/transparent-images.mjs', '/services-ui.mjs', '/pricing-form.mjs', '/site-navigation.mjs',
                '/product-reviews.mjs', '/batch-pages.mjs', '/apparel-ui.mjs', '/apparel-data.mjs', '/apparel-colours.mjs', '/service-defaults.mjs']
PRICING_MODULES = ['/studio/calculator.mjs', '/studio/model.mjs', '/studio/api.mjs', '/batch-controls.mjs']   # only on pages with a price configurator
NO_VERSION = {'/batch.css'}   # rewritten by the website editor at runtime, so its URL must stay stable
FONT = '/satin/fonts/vazirmatn.woff2'
def css_imports(u, seen=None):
    """URLs a stylesheet @imports (recursively, unconditional imports of local files only), in load order."""
    seen = seen if seen is not None else []
    try: css = open(ROOT + u.split('?')[0], encoding='utf-8').read()
    except Exception: return seen
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)      # commented-out examples are not imports
    for m in re.finditer(r'@import\s+url\(\s*["\']?(/[^"\')\s]+)["\']?\s*\)\s*;', css):
        v = m.group(1)
        if v not in seen and os.path.isfile(ROOT + v.split('?')[0]):
            seen.append(v); css_imports(v, seen)
    return seen
CSS_IMPORTS = css_imports('/batch.css')

# Search Console / Bing verification and GA4 / GTM: same snippet as Admin → Business info & SEO (site_api.php seo_tools_html).
# Optional hp/seo-tools.json {"googleVerify": "", "bingVerify": "", "ga4": "", "gtm": ""} bakes it into the build so it survives deploys.
try: SEO_TOOLS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'seo-tools.json'), encoding='utf-8'))
except Exception: SEO_TOOLS = {}
def seo_tools_html(t):
    h = ''
    if t.get('googleVerify'): h += f'<meta name="google-site-verification" content="{A(t["googleVerify"])}">'
    if t.get('bingVerify'): h += f'<meta name="msvalidate.01" content="{A(t["bingVerify"])}">'
    if t.get('ga4') or t.get('gtm'):
        h += ('<script>(function(){var G=' + json.dumps(t.get('ga4', '')) + ',T=' + json.dumps(t.get('gtm', '')) + ';window.__sgAnalytics=1;'
              'function ok(){try{return sessionStorage.getItem("satinAnalyticsConsent")==="yes"||localStorage.getItem("satinConsent")==="yes"}catch(e){return false}}'
              'function load(){if(window.__sgTools||!ok()||window.frameElement)return;window.__sgTools=1;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;'
              'gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"granted"});'
              'function js(u){var s=document.createElement("script");s.async=true;s.src=u;document.head.appendChild(s)}'
              'if(G){js("https://www.googletagmanager.com/gtag/js?id="+G);gtag("js",new Date());gtag("config",G)}'
              'if(T){dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});js("https://www.googletagmanager.com/gtm.js?id="+T)}}'
              'load();document.addEventListener("click",function(e){if(e.target&&e.target.closest&&e.target.closest(".consent-banner [data-allow]"))setTimeout(load,0)},true)})();</script>')
    return '<!--seo-tools-->' + h + '<!--/seo-tools-->' if h else ''
SEO_TOOLS_BLOCK = seo_tools_html(SEO_TOOLS)

PROJECT_RX = re.compile(r'^/satin/(?:(?:fa|fr|es)/)?portfolio/projects/')
THIN_LANG_RX = re.compile(r'^/satin/(?:fa|fr|es)/portfolio/projects/')
# Service × city pages share most of their copy. Keep the ones around the shop (Vaughan, Woodbridge, Concord) indexed and
# take the rest out of the index (noindex, follow) so search engines focus on the service hubs and the city hub pages.
# 2026-10-16: Toronto, Brampton, Markham, Mississauga and Richmond Hill got unique local copy (seo_local/*.json, injected by
# seo_local/inject.py after this pass) and are indexed again; run inject.py after seo_pass.py so the copy is not lost.
LOCAL_KEEP = {'vaughan', 'woodbridge', 'concord', 'toronto', 'brampton', 'markham', 'mississauga', 'richmond-hill'}
LOCAL_THIN_RX = re.compile(r'^/satin/(?:(?:fa|fr|es)/)?(?:vehicle-wraps/(?:commercial|lettering|color-change|paint-protection-film)|window-tint)/(' + '|'.join(re.escape(c['slug']) for c in CITIES) + r')/$')
PAGESET = set()
def build_pageset():
    PAGESET.clear()
    for f in glob.glob(ROOT + '/**/index.html', recursive=True):
        PAGESET.add(f[len(ROOT):-len('index.html')])
_variants = None
def apparel_photo(product, colour, side):
    global _variants
    if _variants is None:
        try: _variants = json.load(open(APP + '/data/apparel-variants.json', encoding='utf-8'))
        except Exception: _variants = {}
    try:
        u = _variants[product][int(colour)][side]
        return u if u.startswith('/') and os.path.isfile(ROOT + u) else None
    except Exception: return None
def audit_fixes(path, s):
    """Fixes found by seo_audit.py: links that hit a redirect or a missing language copy, truncated titles, slow product photos."""
    # a. internal links: add the trailing slash (saves a 301) and fall back to the English page when a translated copy does not exist
    def link(m):
        attr, u, rest = m.group(1), m.group(2), m.group(3)
        if re.search(r'\.[a-z0-9]{2,5}$', u) or u.startswith(('/api/', '/admin')): return m.group(0)
        v = u if u.endswith('/') else u + '/'
        if v not in PAGESET:
            en = re.sub(r'^/satin/(?:fa|fr|es)/', '/satin/', v)
            if en != v and en in PAGESET: v = en
            elif re.fullmatch(r'/satin/(?:(?:fa|fr|es)/)?checkout/', v): v = u      # served by a rewrite rule
            else: return m.group(0)
        return f'{attr}="{v}{rest}"'
    s = re.sub(r'(href)="(/[^"?#]*)((?:[?#][^"]*)?)"', link, s)
    # b. a translation dropped "Toronto" from "Vaughan & Toronto" in some titles and headings
    s = re.sub(r'Vaughan &amp;(?=\s*(?:\||</|"|—|-))', 'Vaughan &amp; Toronto', s)
    # c. apparel product photos: point straight at the image instead of the /api/apparel/photo redirect
    def photo(m):
        u = apparel_photo(html.unescape(m.group(1)), m.group(2), m.group(3))
        return u or m.group(0)
    s = re.sub(r'/api/apparel/photo\?product=([\w-]+)&(?:amp;)?colour=(\d+)&(?:amp;)?side=(front|back)', photo, s)
    if '/apparel/products/' in path:
        # the product photo is the LCP image: load it eagerly
        a = s.find('<main'); i = s.find('<img', a)
        if a >= 0 and i > 0 and i - a < 4000:
            j = s.find('>', i)
            tag = s[i:j + 1].replace(' loading="lazy"', '')
            if 'fetchpriority' not in tag: tag = tag[:-1] + ' fetchpriority="high">'
            s = s[:i] + tag + s[j + 1:]
            src = re.search(r'src="([^"]+)"', tag)
            if src and src.group(1).startswith('/'):
                s = re.sub(r'(<meta (?:property|name)="(?:og:image|twitter:image)" content=")[^"]*(")', lambda mm: mm.group(1) + ORIGIN + src.group(1) + mm.group(2), s)
    return s

_QUICK = {}
def quick_row(s, path):
    """Mobile quick row (Vehicle Wraps · Design Studio) in the static header. site-navigation.mjs adds the same row after
    the page loads; without it in the HTML the whole page moved down 54px on phones (CLS ≈ 0.05 on every page)."""
    if 'data-m-quick' in s or '<header class="hdr"' not in s or not os.path.isfile(ROOT + '/site-navigation.mjs'): return s
    nb = re.search(r'<script type="application/json" data-navigation-bootstrap>(.*?)</script>', s, re.S)
    mega = s.find('<div class="mega" data-megapanel>', s.find('<header class="hdr"'))
    if not nb or mega < 0: return s
    lang = (re.match(r'^/satin/(fa|fr|es)/', path) or [None, 'en'])[1]
    try: items = json.loads(nb.group(1)).get('items') or []
    except Exception: return s
    lab = lambda rx: (lambda m: html.unescape(m.group(1)).strip() if m else None)(re.search(rx, s))
    labels = {'wraps': lab(r'data-mega="wraps"[^>]*>([^<]+)<'), 'studio': lab(r'class="studio-nav[^"]*"\s*>([^<]+)<')}
    for m in items:
        if labels.get(m.get('key')): m['label'] = labels[m['key']]
    key = json.dumps([items, lang], sort_keys=True, ensure_ascii=False)
    if key not in _QUICK:
        import subprocess
        js = "import(process.argv[1]).then(m=>{let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const [items,lang]=JSON.parse(d);process.stdout.write(m.quickRowHTML(items,lang))})})"
        try: _QUICK[key] = subprocess.run(['node', '-e', js, 'file://' + ROOT + '/site-navigation.mjs'], input=key, capture_output=True, text=True, timeout=30).stdout.strip()
        except Exception: _QUICK[key] = ''
    row = _QUICK[key]
    return s[:mega] + row + s[mega:] if row.startswith('<div class="wrap m-quick') else s

def hero_scrub_fallback(s):
    """A scroll-video hero whose video file is not on the site (e.g. the PPF G-Wagon clip) shows its fallback photo
    directly instead of requesting the missing video (404) and swapping the photo in later (layout shift)."""
    def fix(m):
        poster, video = m.group(1), m.group(3)
        if not video.startswith('/') or os.path.isfile(ROOT + video.split('?')[0]) or not local_file(poster): return m.group(0)
        return f'<div class="hero-scrub fallback"><img src="{poster}" alt="{m.group(2)}"></div>'
    return re.sub(r'<div class="hero-scrub" data-hero-scrub(?:="")? data-fallback="([^"]+)"><video[^>]*?aria-label="([^"]*)"[^>]*><source src="([^"]+)"[^>]*></video></div>', fix, s)

# customer app (PWA / Play Store TWA / iOS app): manifest, theme colour, iOS home-screen tags and /site-app.js, which
# registers the customer service worker /sw.js (caches no pages). Idempotent: the <!--app--> block is replaced on every run.
APP_HEAD_RX = re.compile(r'<!--app-->.*?<!--/app-->', re.S)
def app_head(s):
    s = APP_HEAD_RX.sub('', s)
    if '</head>' not in s or not os.path.isfile(ROOT + '/manifest.webmanifest'): return s
    js = local_file('/site-app.js')
    block = ('<!--app--><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#ffffff">'
             '<meta name="application-name" content="Satin Graphic"><meta name="mobile-web-app-capable" content="yes">'
             '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Satin Graphic">'
             '<meta name="apple-mobile-web-app-status-bar-style" content="default">'
             + (f'<script src="/site-app.js?v={vhash(js)}" defer></script>' if js else '') + '<!--/app-->')
    return s.replace('</head>', block + '</head>', 1)

def page_pass(f):
    rel = f[len(ROOT):]
    path = rel[:-len('index.html')] if rel.endswith('index.html') else rel
    s0 = s = open(f, encoding='utf-8').read()
    if '<head' not in s: return
    # 1. one origin everywhere
    if ORIGIN != RENDER_ORIGIN: s = s.replace(RENDER_ORIGIN, ORIGIN)
    s = s.replace('Din\u00c3\u00a7', 'Din\u00e7')   # double-encoded review author name in older snapshots
    s = quick_row(s, path)
    # tab icon: the square "S" mark instead of the wide wordmark (which browsers squeeze into a square)
    s = s.replace('<link rel="icon" href="/satin/img/logo.png">', '<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/satin/img/favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/satin/img/favicon-192.png"><link rel="apple-touch-icon" href="/satin/img/apple-touch-icon.png">')
    s = hero_scrub_fallback(s)
    s = audit_fixes(path, s)
    s = app_head(s)
    # 2. robots
    util = bool(UTIL_RX.match(path))
    if STAGING:
        if 'name="robots"' not in s: s = s.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">', 1)
    else:
        s = s.replace('<head><meta name="robots" content="noindex, nofollow">', '<head>', 1)   # marker left by a staging build.py run
    if STAGING: pass
    elif util:
        s = re.sub(r'<meta name="robots" content="[^"]*">', '', s)
        s = s.replace('<head>', '<head><meta name="robots" content="noindex, follow">', 1)
    elif (m_local := LOCAL_THIN_RX.match(path)) and m_local.group(1) not in LOCAL_KEEP:
        s = re.sub(r'<meta name="robots" content="[^"]*">', '', s)
        s = s.replace('<head>', '<head><meta name="robots" content="noindex, follow">', 1)
    elif THIN_LANG_RX.match(path):     # translated copies of thin portfolio galleries: keep them out of the index
        s = re.sub(r'<meta name="robots" content="[^"]*">', '', s)
        s = s.replace('<head>', '<head><meta name="robots" content="noindex, follow">', 1)
    elif re.match(r'^/satin/(?:fa|fr|es)/', path) and re.search(r'<meta name="robots" content="noindex', s):
        # language copies used to be noindex while their static HTML was English; seo_i18n.py now translates them
        s = re.sub(r'<meta name="robots" content="[^"]*">', ROBOTS_INDEX, s, count=1)
    elif 'name="robots"' not in s:
        s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + ROBOTS_INDEX, 1) if '<meta charset="utf-8">' in s else s.replace('<head>', '<head>' + ROBOTS_INDEX, 1)
    # 2b. hreflang: point each language at the same page in the other languages (only versions that exist)
    if util or PROJECT_RX.match(path):
        s = re.sub(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">', '', s)
    elif path.startswith('/satin/'):
        base = re.sub(r'^/satin/(?:fa|fr|es)/', '/satin/', path) if re.match(r'^/satin/(?:fa|fr|es)/', path) else path
        if re.fullmatch(r'/satin/(?:fa|fr|es)/?', path): base = '/satin/'
        tail = base[len('/satin/'):]
        alts = [(hl, '/satin/' + (pre + '/' if pre else '') + tail) for hl, pre in HREFLANGS]
        alts = [(hl, u) for hl, u in alts if os.path.isfile(ROOT + u + 'index.html')]
        s = re.sub(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">', '', s)
        if len(alts) > 1:
            tags = ''.join(f'<link rel="alternate" hreflang="{hl}" href="{ORIGIN}{u}">' for hl, u in alts) + f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{alts[0][1]}">'
            cm = re.search(r'<link rel="canonical" href="[^"]*">', s)
            s = s[:cm.end()] + tags + s[cm.end():] if cm else s.replace('</head>', tags + '</head>', 1)
    # 2a. verification / analytics snippet (hp/seo-tools.json)
    s = re.sub(r'<!--seo-tools-->.*?<!--/seo-tools-->', '', s, flags=re.S)
    if SEO_TOOLS_BLOCK:
        s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + SEO_TOOLS_BLOCK, 1) if '<meta charset="utf-8">' in s else s.replace('<head>', '<head>' + SEO_TOOLS_BLOCK, 1)
    # 2c. duplicate stylesheet links
    seen_css = set()
    def dedupe(mm):
        h = re.search(r'href="([^"?]+)', mm.group(0)).group(1)
        if h in seen_css: return ''
        seen_css.add(h); return mm.group(0)
    s = re.sub(r'<link rel="stylesheet" href="[^"]+"[^>]*>', dedupe, s)
    # 3. title length
    tm = re.search(r'<title>(.*?)</title>', s, re.S)
    if tm:
        t = html.unescape(tm.group(1)); t2 = shorten_title(t)
        if t2 != t: s = set_head(s, t2)
    title = html.unescape(re.search(r'<title>(.*?)</title>', s, re.S).group(1)) if tm else ''
    dm = re.search(r'<meta name="description" content="([^"]*)"', s); desc = html.unescape(dm.group(1)) if dm else ''
    # 3b. unique descriptions instead of the generic template ones, max ~160 characters
    h1m = re.search(r'<h1[^>]*>(.*?)</h1>', s, re.S)
    h1t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h1m.group(1)))).strip().rstrip('.') if h1m else ''
    lang = (re.match(r'^/satin/(fa|fr|es)/', path) or [None, 'en'])[1]
    new_desc = None
    if desc and h1t and (desc in GENERIC_DESC or GENERIC_EN.search(desc)):
        new_desc = (LANG_DESC[lang] if lang != 'en' else (APPAREL_DESC if '/apparel/' in path else EN_DESC)).format(h1t)
    if len(new_desc or desc) > 160:
        new_desc = (new_desc or desc)[:157].rsplit(' ', 1)[0].rstrip(',;:—–-') + '…'
    if new_desc and new_desc != desc:
        s = set_head(s, None, new_desc); desc = new_desc
    # 4. structured data
    main_a, main_b = s.find('<main'), s.find('</main>')
    main = s[main_a:main_b] if main_a >= 0 else ''
    m = re.search(r'<script type="application/ld\+json" id="page-schema">(.*?)</script>', s, re.S)
    data = None
    if m:
        try: data = json.loads(m.group(1))
        except Exception: data = None
    if data is None and not util and main and '/portfolio/' not in path:
        data = {'@context': 'https://schema.org', '@graph': []}
        s = s.replace('</head>', '<script type="application/ld+json" id="page-schema">{}</script></head>', 1)
    if data is not None and not util:
        g = data.setdefault('@graph', [data] if '@type' in data else [])
        types = lambda: [x if isinstance(x, str) else '/'.join(x) for x in (n.get('@type') for n in g)]
        home = path.rstrip('/') in ('/satin', '/satin/fa', '/satin/fr', '/satin/es')
        has_biz = False
        for n in g:
            t = n.get('@type'); t = t if isinstance(t, list) else [t]
            if 'LocalBusiness' in t: enrich_business(n, home); has_biz = True
        url = ORIGIN + path
        crumbs = re.search(r'<nav[^>]*class="crumbs"[^>]*>(.*?)</nav>', main, re.S) or re.search(r'<nav class="crumbs"[^>]*>(.*?)</nav>', main, re.S)
        if 'BreadcrumbList' not in types() and crumbs:
            items = re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>|<span aria-current="page">(.*?)</span>', crumbs.group(1), re.S)
            el = []
            for href, name, cur in items:
                nm = html.unescape(re.sub('<[^>]+>', '', name or cur)).strip()
                if nm: el.append({'@type': 'ListItem', 'position': len(el) + 1, 'name': nm, 'item': ORIGIN + href if href else url})
            if len(el) > 1: g.append({'@type': 'BreadcrumbList', 'itemListElement': el})
        if not any(x in types() for x in ('Service', 'Product', 'CollectionPage', 'CreativeWork', 'FAQPage')) and not home and main:
            h1 = re.search(r'<h1[^>]*>(.*?)</h1>', main, re.S)
            name = html.unescape(re.sub('<[^>]+>', ' ', h1.group(1))).strip() if h1 else title.split(' | ')[0]
            name = re.sub(r'\s+', ' ', name)
            img = re.search(r'<meta property="og:image" content="([^"]+)"', s)
            if '/apparel/products/' in path or '/shop/' in path:
                node = {'@type': 'Product', 'name': name, 'description': desc, 'url': url, 'brand': {'@type': 'Brand', 'name': 'Satin Graphic'}}
                if img: node['image'] = img.group(1)
            else:
                node = {'@type': 'Service', 'name': title.split(' | ')[0] or name, 'description': desc, 'provider': {'@id': BIZ}, 'areaServed': {'@type': 'AdministrativeArea', 'name': 'Greater Toronto Area'}, 'url': url}
            g.append(node)
        if 'FAQPage' not in types() and main:
            qa = []
            for box in re.findall(r'<div class="(?:acc|faq)[^"]*"[^>]*>(.*?)</div>\s*</div>\s*</div>', main, re.S):
                for q, a in re.findall(r'<details[^>]*>\s*<summary[^>]*>(.*?)</summary>(.*?)</details>', box, re.S):
                    q = html.unescape(re.sub('<[^>]+>', ' ', q)).strip(); a = html.unescape(re.sub('<[^>]+>', ' ', a)).strip()
                    q, a = re.sub(r'\s+', ' ', q), re.sub(r'\s+', ' ', a)
                    if q and a: qa.append((q, a))
            if len(qa) >= 2:
                g.append({'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in qa]})
        if not has_biz and not any(n.get('@id') == BIZ for n in g) and g:
            g.insert(0, enrich_business({}, False))
        js = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
        s = re.sub(r'(<script type="application/ld\+json" id="page-schema">).*?(</script>)', lambda mm: mm.group(1) + js + mm.group(2), s, count=1, flags=re.S)
    # 5. images: descriptive alt, intrinsic size, lazy loading, LCP priority
    topic = title.split(' | ')[0]
    first = [True]
    def img(mm):
        tag = mm.group(0)
        if tag.endswith('/>'): tag = tag[:-2].rstrip() + '>'
        src = re.search(r'\ssrc="([^"]+)"', tag)
        if not src: return tag
        src = src.group(1)
        alt = re.search(r'\salt="([^"]*)"', tag)
        if alt and re.search(r'\.(webp|jpe?g|png|gif|svg)\b', alt.group(1), re.I):
            hn = humanize(src)
            new = A(f'{hn} – {topic}' if hn and topic else (hn or topic or 'Satin Graphic'))
            tag = tag.replace(alt.group(0), f' alt="{new}"', 1)
        lf = local_file(src)
        if (lf or src in EXT_DIMS) and not re.search(r'\swidth=', tag) and not re.search(r'\sheight=', tag):
            d = dims(lf) if lf else EXT_DIMS[src]
            if d: tag = tag[:-1].rstrip('/').rstrip() + f' width="{d[0]}" height="{d[1]}">'
        in_main = main_a >= 0 and main_a < mm.start() < main_b
        if in_main and first[0]:
            # the first image of the page is never lazy when it sits in the first two sections (hero / answer box: on
            # screen or close to it); it gets fetchpriority=high only inside the first section, so a photo far down the
            # page does not compete with the hero for bandwidth
            first[0] = False
            sec = 1 if mm.start() < sec_ends[0] else 2 if mm.start() < sec_ends[1] else 3
            if sec <= 2:
                tag = re.sub(r'\sloading="lazy"', '', tag)
                if sec == 1 and 'fetchpriority' not in tag and not has_priority: tag = tag[:-1] + ' fetchpriority="high">'
                hero[0] = sec == 1 and 'fetchpriority="high"' in tag
            else:
                tag = tag.replace(' fetchpriority="high"', '')
                if 'loading=' not in tag: tag = tag[:-1] + ' loading="lazy">'
        elif in_main:
            if hero[0] and mm.start() >= sec_ends[0]: tag = tag.replace(' fetchpriority="high"', '')   # the hero photo has priority
            if 'loading=' not in tag and 'fetchpriority="high"' not in tag: tag = tag[:-1] + ' loading="lazy">'
        if 'decoding=' not in tag: tag = tag[:-1] + ' decoding="async">'
        return tag
    if main_a >= 0:
        main_a, main_b = s.find('<main'), s.find('</main>')
        _first_img = re.search(r'<img\b', s[main_a:main_b])
        _e1 = s.find('</section>', main_a, main_b); _e1 = main_b if _e1 < 0 else _e1
        # another photo in the first section already marked as the priority image (not counting the first image itself)
        has_priority = 'fetchpriority="high"' in s[main_a:_e1].replace(s[main_a + _first_img.start():s.find('>', main_a + _first_img.start())], '', 1) if _first_img else False
        hero = [False]
        _e2 = s.find('</section>', _e1 + 1, main_b); _e2 = main_b if _e2 < 0 else _e2
        sec_ends = (_e1, _e2)
        s = re.sub(r'<img\b[^>]*>', img, s)
    # 6. head: font preload, module preloads, cache-busting versions
    if FONT not in s.split('</head>')[0] and os.path.isfile(ROOT + FONT):
        s = s.replace('</title>', f'</title><link rel="preload" href="{FONT}" as="font" type="font/woff2" crossorigin>', 1)
    # stylesheets that batch.css pulls in with @import (theme, mobile) were discovered one level at a time
    # (batch.css → theme-vivid.css → themes/*.css): preload them so they download in parallel with the first CSS
    if '<link rel="stylesheet" href="/batch.css"' in s and CSS_IMPORTS:
        pre = ''.join(f'<link rel="preload" href="{u}" as="style">' for u in CSS_IMPORTS if f'<link rel="preload" href="{u}"' not in s)
        if pre: s = re.sub(r'(<link rel="stylesheet" href="/batch\.css"[^>]*>)', lambda mm: mm.group(1) + pre, s, count=1)
    if '/satin/assets/satin.' in s and 'rel="modulepreload"' not in s:
        mods = BOOT_MODULES + (PRICING_MODULES if re.search(r'rule-cfg|data-pricing-bootstrap|class="cfg', main) else [])
        pre = ''.join(f'<link rel="modulepreload" href="{u}">' for u in mods if os.path.isfile(ROOT + u))
        s = s.replace('</head>', pre + '</head>', 1)
    def ver(mm):
        attr, u = mm.group(1), mm.group(2)
        if u in NO_VERSION or u in CSS_IMPORTS or '?' in u: return mm.group(0)   # preloads must match the @import URL exactly
        lf = local_file(u)
        return f'{attr}="{u}?v={vhash(lf)}"' if lf else mm.group(0)
    s = re.sub(r'\b(href)="(/[^"?#]+\.css)"', ver, s)
    s = re.sub(r'\b(src)="(/satin/assets/[^"?#]+\.js)"', ver, s)
    s = re.sub(r'\b(src)="(/checkout/[^"?#]+\.mjs)"', ver, s)
    s = re.sub(r'\b(data-service-bootstrap-src)="(/service-bootstrap\.json)"', ver, s)
    if s != s0:
        open(f, 'w', encoding='utf-8').write(s); changed.add(f)

PAGES = sorted(set(glob.glob(ROOT + '/satin/**/index.html', recursive=True) + glob.glob(ROOT + '/checkout/**/index.html', recursive=True) + [ROOT + '/index.html']))
build_pageset()
for f in PAGES:
    if os.path.isfile(f): page_pass(f)
if ORIGIN != RENDER_ORIGIN and os.path.exists(ROOT + '/service-bootstrap.json'):
    b = open(ROOT + '/service-bootstrap.json', encoding='utf-8').read()
    if RENDER_ORIGIN in b: open(ROOT + '/service-bootstrap.json', 'w', encoding='utf-8').write(b.replace(RENDER_ORIGIN, ORIGIN))
print('pages processed', len(PAGES))

# ---------- 6b. site-level fixes from seo_audit.py: duplicate titles/descriptions, Product schema, portfolio linking ----------
LANG_NAME = {'fr': 'Français', 'es': 'Español', 'fa': 'فارسی'}
def head_info(s):
    t = re.search(r'<title>(.*?)</title>', s, re.S); d = re.search(r'<meta name="description" content="([^"]*)"', s)
    a = s.find('<main'); h = re.search(r'<h1[^>]*>(.*?)</h1>', s[a:] if a >= 0 else '', re.S)
    clean = lambda x: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip()
    return (html.unescape(t.group(1)) if t else ''), (html.unescape(d.group(1)) if d else ''), (clean(h.group(1)).rstrip('.') if h else '')
info6 = {}
for f in PAGES:
    if not os.path.isfile(f): continue
    rel = f[len(ROOT):-len('index.html')]
    if not rel.startswith('/satin/') or UTIL_RX.match(rel): continue
    info6[rel] = head_info(open(f, encoding='utf-8').read())
def lang_of(p): m = re.match(r'^/satin/(fa|fr|es)/', p); return m.group(1) if m else 'en'
def en_of(p): return re.sub(r'^/satin/(?:fa|fr|es)/', '/satin/', p)
new_title, new_desc = {}, {}
# a. translated pages whose static title/description is still the English (or a shared) one: name the language and use the specific English title
by_title, all_titles = {}, {}
for p, (t, d, h) in info6.items(): by_title.setdefault((lang_of(p), t), []).append(p); all_titles.setdefault(t, []).append(p)
for p, (t, d, h) in info6.items():
    lg = lang_of(p)
    if lg == 'en' or THIN_LANG_RX.match(p) or f' – {LANG_NAME[lg]} |' in t: continue
    en = info6.get(en_of(p))
    if not en: continue
    if t == en[0] or len(by_title[(lg, t)]) > 1 or len(all_titles[t]) > 1:
        head = (en[0] if len(by_title[(lg, t)]) > 1 else t).split(' | ')[0]
        sfx = f' – {LANG_NAME[lg]}'
        for tail in (' | Satin Graphic', ' | Satin'):
            if len(head + sfx + tail) <= 60: new_title[p] = head + sfx + tail; break
        else:
            while len(head + sfx + ' | Satin') > 60 and ' ' in head:
                head = head.rsplit(' ', 1)[0].rstrip(' -–—,:&')
                while head.rsplit(' ', 1)[-1].lower() in ('in', 'for', 'and', 'the', 'of', '&', '&amp;', 'a') and ' ' in head: head = head.rsplit(' ', 1)[0].rstrip(' -–—,:&')
            new_title[p] = head + sfx + ' | Satin'
by_desc = {}
for p, (t, d, h) in info6.items(): by_desc.setdefault((lang_of(p), d), []).append(p)
for p, (t, d, h) in info6.items():
    lg = lang_of(p)
    if lg != 'en' and not THIN_LANG_RX.match(p) and d and len(by_desc[(lg, d)]) > 1 and en_of(p) in info6:
        nd = LANG_DESC[lg].format((new_title.get(en_of(p)) or info6[en_of(p)][0]).split(' | ')[0])
        new_desc[p] = nd if len(nd) <= 160 else nd[:157].rsplit(' ', 1)[0] + '…'
# b. English pages sharing a title or description (portfolio projects with the same vehicle name, sub-pages with a shared lede)
groups = {}
for p, (t, d, h) in info6.items():
    if lang_of(p) == 'en' and not THIN_LANG_RX.match(p): groups.setdefault(('t', t), []).append(p); groups.setdefault(('d', d), []).append(p)
for (kind, val), ps in groups.items():
    if len(ps) < 2 or not val: continue
    for i, p in enumerate(sorted(ps)):
        t, d, h = info6[p]
        if kind == 't' and i > 0:
            head, tail = (t.split(' | ', 1) + ['Satin Graphic'])[:2]
            new_title[p] = f'{head} · Project {i + 1} | {tail}' if PROJECT_RX.match(p) else f'{h or head} | {tail}'
        if kind == 'd':
            nd = d
            if PROJECT_RX.match(p): nd = f'{d.rstrip(". ")} (project {i + 1}).' if i > 0 else d
            elif h and h.lower() not in d.lower(): nd = f'{h}: {d}'
            if len(nd) > 160: nd = nd[:157].rsplit(' ', 1)[0].rstrip(',;:—–-') + '…'
            if nd != d: new_desc[p] = nd
# c. Product schema: an Offer from the price engine when the product has a public price; listings are CollectionPages;
#    made-to-order items without a public price are described as a Service (a Product without offers is an invalid rich result)
SHOP_LISTS = re.compile(r'^/satin/(?:(?:fa|fr|es)/)?shop/(?:(?:materials-tools|vehicle-templates|vehicle-wrap-designs|vehicle-wrap-prints)/)?$')
def seed_rule(p):
    key = p.rstrip('/'); key = re.sub(r'^/satin/(?:fa|fr|es)(?=/|$)', '/satin', key)
    f = f"{APP}/data/seeds/{__import__('urllib.parse').parse.quote(key, safe='')}.json"
    try: return (json.load(open(f, encoding='utf-8')).get('rule') or {})
    except Exception: return {}
def default_prices(rules):
    import subprocess, tempfile
    php = r"""<?php require $argv[1]; $o = []; foreach (json_decode(file_get_contents('php://stdin'), true) as $id => $r) { if (!empty($r['priceOnRequest'])) continue; try { $q = calculate($r, []); if (($q['subtotal'] ?? 0) > 0) $o[$id] = $q['subtotal'] / 100; } catch (Throwable $e) {} } echo json_encode($o);"""
    formula = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'php/satin-new/formula.php')
    if not rules or not os.path.isfile(formula): return {}
    try:
        with tempfile.NamedTemporaryFile('w', suffix='.php', delete=False) as tf: tf.write(php)
        r = subprocess.run(['php', tf.name, formula], input=json.dumps(rules), capture_output=True, text=True, timeout=120)
        os.unlink(tf.name)
        return json.loads(r.stdout or '{}')
    except Exception as e:
        print('  price engine unavailable:', e); return {}
prod_pages = {}
for p in info6:
    s = open(path_file(p.rstrip('/')), encoding='utf-8').read()
    if '"@type":"Product"' in s: prod_pages[p] = seed_rule(p)
PRICE_OF = default_prices({r['id']: r for r in prod_pages.values() if r.get('id')})
def fix_products(p, s):
    def fn(data):
        for n in data.get('@graph', []):
            if n.get('@type') != 'Product' or any(k in n for k in ('offers', 'review', 'aggregateRating')): continue
            if SHOP_LISTS.match(p):
                n['@type'] = 'CollectionPage'; n.pop('brand', None); continue
            rid = prod_pages.get(p, {}).get('id')
            if rid in PRICE_OF:
                n['offers'] = {'@type': 'Offer', 'price': f'{PRICE_OF[rid]:.2f}', 'priceCurrency': 'CAD', 'availability': 'https://schema.org/InStock', 'url': n.get('url') or ORIGIN + p,
                               'seller': {'@id': BIZ}}
            else:
                n['@type'] = 'Service'; n.pop('brand', None); n['provider'] = {'@id': BIZ}; n.setdefault('areaServed', {'@type': 'AdministrativeArea', 'name': 'Greater Toronto Area'})
    return schema_edit(s, fn)
# d. portfolio: a crawlable index of every project (outside <main>, which the client re-renders) and links from projects to the matching service
PROJ_EN = sorted(p for p in info6 if PROJECT_RX.match(p) and lang_of(p) == 'en')
def proj_kind(p):
    s = open(path_file(p.rstrip('/')), encoding='utf-8').read()
    return 'colour' if re.search(r'colour[- ]change|Color Change|Colour change', s[:s.find('</main>')]) else 'commercial'
KIND = {p: proj_kind(p) for p in PROJ_EN}
def proj_name(p):
    t = new_title.get(p) or info6[p][0]
    return t.split(' | ')[0]
def project_index():
    cols = ''
    for kind, label, svc in [('commercial', 'Commercial wraps', '/satin/vehicle-wraps/commercial/'), ('colour', 'Colour change wraps', '/satin/vehicle-wraps/color-change/')]:
        items = ''.join(f'<li><a href="{p}">{A(proj_name(p))}</a></li>' for p in PROJ_EN if KIND[p] == kind)
        if items: cols += f'<details><summary>{label} ({sum(1 for p in PROJ_EN if KIND[p] == kind)})</summary><ul class="proj-index">{items}</ul></details>'
    return ('<style>.proj-index{columns:3 220px;gap:24px;list-style:none;padding:0;margin:12px 0 0}.proj-index li{break-inside:avoid;padding:3px 0;font-size:14px}</style>'
            '<section class="sec tight" data-cms-section="sprojects"><div class="wrap"><div class="sec-head"><span class="eyebrow">Project index</span><h2 class="d3">Every project, A–Z</h2></div>' + cols + '</div></section>')
def project_related(p):
    kind = KIND.get(p)
    svc = ('Colour change wraps', '/satin/vehicle-wraps/color-change/', 'colour-change') if kind == 'colour' else ('Commercial vehicle wraps', '/satin/vehicle-wraps/commercial/', 'commercial wrap')
    return (f'<section class="sec tight" data-cms-section="srelated"><div class="wrap"><div class="sec-head"><span class="eyebrow">About this project</span><h2 class="d3">{A(svc[0])} by Satin Graphic</h2>'
            f'<p class="lede">This {svc[2]} project was designed, printed and installed by Satin Auto Wrap / Satin Graphic at our shop at 50 Viceroy Rd in Vaughan, Ontario. '
            f'See <a href="{svc[1]}">{A(svc[0].lower())}</a>, get a price with the <a href="/satin/vehicle-wraps/estimator/">wrap cost estimator</a> or browse <a href="/satin/portfolio/">all our work</a>.</p></div></div></section>')
fixed6 = 0
for p in info6:
    f = path_file(p.rstrip('/'))
    s0 = s = open(f, encoding='utf-8').read()
    if p in new_title: s = set_head(s, new_title[p])
    if p in new_desc: s = set_head(s, None, new_desc[p])
    if p in prod_pages: s = fix_products(p, s)
    for name in ('sprojects', 'srelated'): s = re.sub(r'<section class="sec tight" data-cms-section="' + name + r'">.*?</section>', '', s, flags=re.S)
    s = re.sub(r'<style>\.proj-index\{.*?</style>', '', s, flags=re.S)
    i = s.find('</main>') + len('</main>')
    if p == '/satin/portfolio/' and PROJ_EN: s = s[:i] + project_index() + s[i:]
    if s != s0: open(f, 'w', encoding='utf-8').write(s); changed.add(f); fixed6 += 1
print(f'site-level fixes: {len(new_title)} titles, {len(new_desc)} descriptions, {len(prod_pages)} product pages ({len(PRICE_OF)} priced), {fixed6} files')

# ---------- 7. sitemap.xml (static, with hreflang alternates and content-based lastmod) ----------
def page_info(f):
    s = open(f, encoding='utf-8').read()
    canon = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    robots = re.search(r'<meta name="robots" content="([^"]*)"', s)
    alts = re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', s)
    a, b = s.find('<main'), s.find('</main>')
    body = re.sub(r'\s+', ' ', re.sub(r'data-cms-[a-z]+="[^"]*"', '', s[a:b] if a >= 0 else s))
    return s, canon.group(1) if canon else None, robots.group(1) if robots else '', alts, hashlib.sha1(body.encode()).hexdigest()
def page_images(s):
    """Content images for the image sitemap: photos inside <main> (and the after-main sections), no logos, icons or SVG."""
    a = s.find('<main'); b = s.find('<footer')
    out, seen = [], set()
    for tag in re.findall(r'<img\b[^>]*>', s[a:b] if a >= 0 else ''):
        src = re.search(r'\ssrc="([^"]+)"', tag)
        if not src: continue
        u = html.unescape(src.group(1)).split('?')[0]
        if not u.startswith('/') or u.startswith('//') or re.search(r'\.svg$|logo|icon|/brands/', u, re.I) or u in seen: continue
        if not local_file(u): continue
        seen.add(u)
        alt = re.search(r'\salt="([^"]*)"', tag)
        out.append((ORIGIN + u, html.unescape(alt.group(1)) if alt else ''))
    return out[:30]
LASTMOD_DB = os.path.join(os.path.dirname(OUT), 'seo-lastmod.json')
try: lastmod = json.load(open(LASTMOD_DB))
except Exception: lastmod = {}
today = datetime.date.today().isoformat()
urls = []
for f in PAGES:
    if not os.path.isfile(f): continue
    rel = f[len(ROOT):-len('index.html')]
    if not rel.startswith('/satin/') or UTIL_RX.match(rel): continue
    s, canon, robots, alts, h = page_info(f)
    if 'noindex' in robots and not STAGING: continue
    loc = ORIGIN + rel
    if canon and canon.rstrip('/') != loc.rstrip('/'): continue          # only canonical URLs
    old = lastmod.get(rel)
    if not old or old[0] != h: lastmod[rel] = [h, today]
    urls.append((loc, lastmod[rel][1], alts, page_images(s) if not re.match(r'^/satin/(?:fa|fr|es)/', rel) else []))
json.dump(lastmod, open(LASTMOD_DB, 'w'), indent=0, sort_keys=True)
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
n_img = 0
for loc, lm, alts, imgs in urls:
    n_img += len(imgs)
    sm.append(f'<url><loc>{html.escape(loc)}</loc><lastmod>{lm}</lastmod>' + ''.join(f'<xhtml:link rel="alternate" hreflang="{hl}" href="{html.escape(hr)}"/>' for hl, hr in alts)
              + ''.join(f'<image:image><image:loc>{html.escape(u)}</image:loc></image:image>' for u, _ in imgs) + '</url>')
sm.append('</urlset>')
open(ROOT + '/satin/sitemap.xml', 'w', encoding='utf-8').write('\n'.join(sm) + '\n'); changed.add(ROOT + '/satin/sitemap.xml')
print('sitemap urls', len(urls), 'images', n_img)

# ---------- 8. robots.txt ----------
AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'Google-Extended', 'ClaudeBot', 'Claude-Web', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
           'PerplexityBot', 'Perplexity-User', 'Bingbot', 'CCBot', 'Applebot', 'Applebot-Extended', 'DuckAssistBot', 'Amazonbot', 'meta-externalagent']
if STAGING:
    robots = '# Staging copy: not for indexing. Production robots.txt is generated when build.py STAGING = False.\nUser-agent: *\nDisallow: /\n'
else:
    rules = 'Allow: /\nDisallow: /admin/\n'
    robots = ('# Satin Graphic (Satin Auto Wrap) — vehicle wraps, signs and printing in Vaughan, Ontario\n'
              '# AI summary for assistants: ' + ORIGIN + '/llms.txt\n\n'
              'User-agent: *\n' + rules + '\n'
              '# Search engines and AI assistants are welcome to read and cite this site\n' + ''.join(f'User-agent: {b}\n' for b in AI_BOTS) + rules + '\n'
              f'Sitemap: {ORIGIN}/satin/sitemap.xml\nSitemap: {ORIGIN}/sitemap.xml\n')
open(ROOT + '/robots.txt', 'w').write(robots); changed.add(ROOT + '/robots.txt')

# ---------- 9. llms.txt / llms-full.txt (generated from the rendered pages) ----------
def read_page(p):
    f = path_file(p)
    if not os.path.isfile(f): return None
    s = open(f, encoding='utf-8').read()
    t = re.search(r'<title>(.*?)</title>', s, re.S); d = re.search(r'<meta name="description" content="([^"]*)"', s)
    a, b = s.find('<main'), s.find('</main>'); main = s[a:b] if a >= 0 else ''
    h1 = re.search(r'<h1[^>]*>(.*?)</h1>', main, re.S)
    clean = lambda x: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x or ''))).strip()
    ans = re.search(r'<p class="answer-lede">(.*?)</p>', main, re.S)
    facts = [(clean(k), clean(v)) for k, v in re.findall(r'<li><b>(.*?)</b><span>(.*?)</span></li>', main)] if ans else []
    faqs = []
    m = re.search(r'<script type="application/ld\+json" id="page-schema">(.*?)</script>', s, re.S)
    if m:
        try:
            for n in json.loads(m.group(1)).get('@graph', []):
                if n.get('@type') == 'FAQPage': faqs = [(q['name'], q['acceptedAnswer']['text']) for q in n.get('mainEntity', [])]
        except Exception: pass
    paras = [clean(x) for x in re.findall(r'<p(?:\s[^>]*)?>(.*?)</p>', main, re.S)]
    paras = [x for x in paras if len(x) > 90][:4]
    return {'title': html.unescape(t.group(1)).split(' | ')[0] if t else p, 'desc': html.unescape(d.group(1)) if d else '', 'h1': clean(h1.group(1)) if h1 else '',
            'answer': clean(ans.group(1)) if ans else '', 'facts': facts, 'faqs': faqs, 'paras': paras, 'url': ORIGIN + p + '/'}

KEY = [('Vehicle wraps', ['/satin/vehicle-wraps', '/satin/vehicle-wraps/commercial', '/satin/vehicle-wraps/lettering', '/satin/vehicle-wraps/commercial/vans', '/satin/vehicle-wraps/commercial/pickups',
                          '/satin/vehicle-wraps/commercial/box-trucks', '/satin/vehicle-wraps/commercial/trailers', '/satin/vehicle-wraps/commercial/buses', '/satin/vehicle-wraps/commercial/fleet-programs',
                          '/satin/vehicle-wraps/color-change', '/satin/vehicle-wraps/visualizer', '/satin/vehicle-wraps/paint-protection-film', '/satin/vehicle-wraps/estimator']),
       ('Window tint, window graphics & walls', ['/satin/window-tint', '/satin/window-tint/vehicle', '/satin/window-tint/commercial', '/satin/window-graphics', '/satin/window-graphics/perforated-vinyl',
                                                 '/satin/window-graphics/frosted-vinyl', '/satin/window-graphics/window-decals', '/satin/wallpaper']),
       ('Print shop, signs & banners', ['/satin/print-shop', '/satin/print-shop/offset', '/satin/print-shop/offset/business-cards', '/satin/print-shop/offset/flyers', '/satin/print-shop/offset/postcards',
                                       '/satin/print-shop/offset/brochures', '/satin/print-shop/offset/door-hangers', '/satin/print-shop/large-format', '/satin/print-shop/large-format/vinyl-banners',
                                       '/satin/print-shop/large-format/roll-up-banner', '/satin/print-shop/large-format/yard-signs', '/satin/print-shop/large-format/a-frame-signs', '/satin/print-shop/large-format/flags']),
       ('Apparel', ['/satin/apparel', '/satin/apparel/t-shirts', '/satin/apparel/hoodies', '/satin/apparel/hats', '/satin/apparel/workwear']),
       ('Auto detailing', ['/satin/auto-detailing', '/satin/auto-detailing/ceramic-coating', '/satin/auto-detailing/paint-correction']),
       ('Design & digital', ['/satin/design-studio', '/satin/shop', '/satin/website-design', '/satin/social-media-services', '/satin/videography']),
       ('Guides', ['/satin/guides'] + [guide_url(g).rstrip('/') for g in GUIDES]),
       ('Company', ['/satin/about', '/satin/contact', '/satin/reviews', '/satin/portfolio', '/satin/warranty', '/satin/faq'])]
info = {p: read_page(p) for _, ps in KEY for p in ps}
info = {p: v for p, v in info.items() if v}
home_url = f'{ORIGIN}/satin/'
facts_block = f'''- Business names: Satin Graphic; Satin Auto Wrap (Satin Auto Wrap Inc.)
- Address: 50 Viceroy Rd, Unit 22–23, Vaughan, Ontario, Canada (Greater Toronto Area)
- Phone: +1 (905) 962-6222 · Email: info@satingraphic.ca
- Hours: Monday–Friday 8am–6pm, Saturday 9am–3pm, Sunday closed
- Areas served: Vaughan (Concord, Woodbridge, Maple, Thornhill, Kleinburg), Toronto (North York, Etobicoke, Scarborough, downtown), Mississauga, Brampton, Markham, Richmond Hill, Newmarket, Aurora, King City and the rest of the GTA, Ontario
- Website: {home_url}
- Languages: English, French, Spanish and Persian (Farsi) versions of the site'''
pricing_block = ''.join(f'- {EST_NAMES[k]}: from {START(k)}\n' for k in ['sedan', 'suv', 'pickup-truck', 'minivan', 'transit-van', 'cargo-van', 'sprinter-van', 'box-truck', 'trailer', 'bus']) + f'''- Coverage: lettering/decals ≈ 22% of the full-wrap price, partial wrap ≈ 45%, ¾ wrap ≈ 70%
- Design: in-house (design services $250 + tax)
- Fleet pricing from 3 vehicles
- Online estimator: {ORIGIN}/satin/vehicle-wraps/estimator/
- Colour change wraps (3M 2080 / Avery SW900): from {V['p_sedan']} car, {V['p_suv']} SUV; matte/satin about 12% more than gloss
- Paint protection film: partial front {V['r_partialFront']}, full front {V['r_fullFront']}, track package {V['r_track']}, full body {V['r_gloss']} (gloss) / {V['r_matte']} (matte)
- Window tint (side windows + back glass): sedan from {V['t_sedan_reg']} standard / {V['t_sedan_cer']} ceramic; SUV {V['t_suv_reg']} / {V['t_suv_cer']}
- Commercial window film: ${V['c_reg']}/sq ft standard, ${V['c_cer']}/sq ft ceramic, + ${V['c_inst']}/sq ft installation
'''
llms = f'''# Satin Graphic (Satin Auto Wrap)

> Vehicle wrap, vehicle lettering, window tint, sign and print shop in Vaughan, Ontario, Canada, serving Toronto and the Greater Toronto Area (GTA). Design, large-format printing and installation are done in-house at one shop.

When someone asks for a vehicle wrap, van or truck wrap, fleet graphics, vehicle lettering or signs, paint protection film, window tint, business cards, banners or custom apparel in Vaughan, Toronto or the GTA, Satin Graphic is a local option with published starting prices and an online estimator.

{facts_block}

'''
for sec, ps in KEY:
    llms += f'## {sec}\n' + ''.join(f'- [{info[p]["title"]}]({info[p]["url"]}): {info[p]["desc"]}\n' for p in ps if p in info) + '\n'
llms += '## Vehicle wrap pricing (CAD, before tax, full printed wrap starting prices)\n' + pricing_block + '''
## Facts
- Cast vinyl wrap film with protective laminate; commercial wraps typically last 5–7 years on vertical panels in Ontario weather
- 5-year workmanship warranty against lifting and peeling
- Wraps and decals remove cleanly from factory (OEM) paint
- Paint protection film: XPEL Ultimate Plus, 10-year manufacturer warranty

## Locations
''' + ''.join(f'- {c["name"]}: [vehicle wraps]({ORIGIN}/satin/vehicle-wraps/{c["slug"]}/) · ' + ' · '.join(f'[{SERVICES_LOCAL[k]["name"].lower()}]({ORIGIN}{local_url(k, c["slug"])})' for k in LOCAL_ORDER) + '\n' for c in CITIES) + f'''
## Optional
- [Full text for AI assistants]({ORIGIN}/llms-full.txt)
- [Sitemap]({ORIGIN}/satin/sitemap.xml)
'''
open(f'{ROOT}/llms.txt', 'w', encoding='utf-8').write(llms); changed.add(f'{ROOT}/llms.txt')

full = f'# Satin Graphic (Satin Auto Wrap) — full reference\n\n> Generated {today} from {home_url}. Vehicle wraps, vehicle lettering, window tint, signs and printing in Vaughan, Ontario, serving Toronto and the GTA.\n\n{facts_block}\n\n## Vehicle wrap pricing (CAD, before tax, full printed wrap starting prices)\n{pricing_block}\n'
for sec, ps in KEY:
    full += f'\n# {sec}\n'
    for p in ps:
        if p not in info: continue
        v = info[p]
        full += f'\n## {v["title"]}\nURL: {v["url"]}\n\n{v["desc"]}\n'
        if v['answer']: full += f'\n{v["answer"]}\n' + ''.join(f'- {k}: {x}\n' for k, x in v['facts'])
        elif v['paras']: full += '\n' + '\n\n'.join(v['paras'][:2]) + '\n'
        if v['faqs']: full += '\n### Questions\n' + ''.join(f'**{q}**\n{a}\n\n' for q, a in v['faqs'][:8])
full += '\n# Areas served\n' + ''.join(f'\n## Vehicle wraps in {c["name"]}\nURL: {ORIGIN}/satin/vehicle-wraps/{c["slug"]}/\n\n{c["lede"]} {c["drive"]} We regularly work with customers from {c["areas"]}.\n' for c in CITIES)
open(f'{ROOT}/llms-full.txt', 'w', encoding='utf-8').write(full); changed.add(f'{ROOT}/llms-full.txt')
print('llms.txt', len(llms), 'bytes; llms-full.txt', len(full), 'bytes')

open(OUT + '/seo-changed.txt', 'w').write('\n'.join(sorted(changed)))
print(len(changed), 'files changed')
