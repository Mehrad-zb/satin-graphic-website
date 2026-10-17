import os, re, json, sys
ROOT = sys.argv[1]  # docroot
OUTSLOTS = sys.argv[2]
V = ['sedan','suv','pickup-truck','minivan','transit-van','sprinter-van','cargo-van','box-truck','trailer','bus']
FULL = {2800:'sedan',3400:'suv',3200:'pickup-truck',3600:'minivan',3950:'transit-van',4300:'sprinter-van',4200:'cargo-van',5800:'box-truck',4800:'trailer',8500:'bus'}
ROWS = {  # old (decal, partial, full) per vehicle for the coverage tables
 'sedan':(620,1260,2800),'suv':(750,1530,3400),'pickup-truck':(700,1440,3200),'minivan':(790,1620,3600),'transit-van':(870,1780,3950),
 'sprinter-van':(950,1940,4300),'cargo-van':(920,1890,4200),'box-truck':(1280,2610,5800),'trailer':(1060,2160,4800),'bus':(1870,3820,8500)}
DEC = {v[0]:k for k,v in ROWS.items()}
PART = {v[1]:k for k,v in ROWS.items()}
MATTE = {'sedan':3140,'suv':3810,'pickup-truck':3580,'minivan':4030}
MONEY = re.compile(r'\$(\d{1,3}(?:,\d{3})+|\d{3,4})(\.\d\d)?')
def val(m): return int(m.group(1).replace(',',''))
def fmt_of(m): return 'usd2' if m.group(2) else 'usd'
def keyof(v):
    if v in FULL: return FULL[v] + '.full'
    if v in DEC: return DEC[v] + '.decal'
    if v in PART: return PART[v] + '.partial'
    return None
def ranged(s, a, b):
    pre = s[max(0,a-3):a]; post = s[b:b+3]
    return bool(re.search(r'[–—-]\s*$', pre) or re.match(r'^\s*[–—-]', post))
slots = {}; changed = 0; files = []
NUMRE = {'usd': r'\$[\d,]+', 'usd2': r'\$[\d,]+\.\d\d', 'int': r'\d+'}
def gen(txt):
    out = []; p = 0
    for m in re.finditer(r'\$[\d,]+(?:\.\d\d)?|(?<=Price":)\d+|(?<=Price": )\d+', txt):
        out.append(re.escape(txt[p:m.start()])); out.append(r'\$?[\d,]+(?:\.\d\d)?'); p = m.end()
    out.append(re.escape(txt[p:])); return ''.join(out)
def add_slot(rel, s, a, b, key, f):
    n = 30
    while True:
        rb = gen(s[max(0,a-n):a]); ra = gen(s[b:b+6])
        cnt = len(re.findall('(?:' + rb + ')' + NUMRE[f] + '(?=' + ra + ')', s))
        if cnt == 1 or a - n <= 0 or n > 600: break
        n += 30
    if cnt != 1: print('AMBIG', rel, key, cnt)
    slots.setdefault(rel, []).append({'rb': rb, 'ra': ra, 'k': key, 'f': f})
def est_slug(rel):
    m = re.search(r'/vehicle-wraps/estimator/([a-z-]+)/index\.html$', rel); return m.group(1) if m and m.group(1) in V else None
for dp, dn, fn in os.walk(ROOT + '/satin'):
    if 'index.html' not in fn: continue
    rel = (dp + '/index.html')[len(ROOT):]
    if not re.search(r'/vehicle-wraps(/|$)|/guides/(car-wrap-cost|wrap-vs-paint|vehicle-lettering|fleet-wrap)', rel) and not re.match(r'^/satin/(fa/|fr/|es/)?index\.html$', rel): continue
    s = open(ROOT + rel, encoding='utf-8').read(); orig = s
    if 'data-wp=' in s: continue
    slug = est_slug(rel)
    out = []; pos = 0
    # tokenise: scripts, tags, text
    for m in re.finditer(r'<script\b[^>]*>.*?</script>|<[^>]+>', s, re.S):
        out.append(('t', s[pos:m.start()])); out.append(('s' if m.group(0).startswith('<script') else 'g', m.group(0))); pos = m.end()
    out.append(('t', s[pos:]))
    # table rows: map token values by row match
    rowkey = {}  # absolute char index of token -> key
    for tr in re.finditer(r'<tr\b.*?</tr>', s, re.S):
        body = tr.group(0); toks = [(m.start()+tr.start(), val(m)) for m in MONEY.finditer(body)]
        vals = [v for _, v in toks]
        for veh, (d, p, f) in ROWS.items():
            if vals == [d, p, f]:
                for (i, v), part in zip(toks, ['decal','partial','full']): rowkey[i] = veh + '.' + part
            elif vals == [d, p]:
                for (i, v), part in zip(toks, ['decal','partial']): rowkey[i] = veh + '.' + part
            elif veh in MATTE and vals == [f, MATTE[veh]]:
                rowkey[toks[0][0]] = veh + '.full'; rowkey[toks[1][0]] = veh + '.matte'
            elif vals == [f] and len(toks) == 1 and re.search(r'>\s*(Car|SUV|Pickup Truck|Minivan|Transit Van|Sprinter Van|ProMaster|Box Truck|Trailer|Bus)\s*<', body):
                rowkey[toks[0][0]] = veh + '.full'
    res = []; idx = 0
    for kind, chunk in out:
        start = idx; idx += len(chunk)
        if kind == 'g':
            if re.match(r'<meta\b', chunk) or re.search(r'\b(alt|title|aria-label)="', chunk):
                def rep_attr(m):
                    v = val(m)
                    if keyof(v) and not ranged(chunk, m.start(), m.end()):
                        return '\0' + keyof(v) + '|' + fmt_of(m) + '\0' + m.group(0) + '\0'
                    return m.group(0)
                chunk = MONEY.sub(rep_attr, chunk)
            res.append(chunk); continue
        if kind == 's':
            if 'application/ld+json' in chunk:
                def rep_ld(m):
                    v = val(m)
                    if keyof(v) and not ranged(chunk, m.start(), m.end()): return '\0' + keyof(v) + '|' + fmt_of(m) + '\0' + m.group(0) + '\0'
                    return m.group(0)
                chunk = MONEY.sub(rep_ld, chunk)
                def rep_off(m):
                    lo, hi = int(m.group(2)), (int(m.group(4)) if m.group(4) else None)
                    if hi is None:
                        k = FULL.get(lo); kl = k + '.full' if k else None; kh = None
                    else:
                        kl, kh = {(620,8500):('min.decal','max.full'),(2800,8500):('min.full','max.full'),(2800,4030):('sedan.full','max.matte4'),(620,1870):('min.decal','max.decal')}.get((lo,hi),(None,None))
                    o = m.group(1) + ('\0'+kl+'|int\0'+str(lo)+'\0' if kl else str(lo))
                    if m.group(3): o += m.group(3) + ('\0'+kh+'|int\0'+str(hi)+'\0' if kh else str(hi))
                    return o
                chunk = re.sub(r'("lowPrice":)(\d+)(?:(,"highPrice":)(\d+))?', rep_off, chunk)
            res.append(chunk); continue
        # text
        def rep_t(m, start=start, chunk=chunk):
            if ranged(chunk, m.start(), m.end()): return m.group(0)
            key = rowkey.get(start + m.start())
            if not key:
                pre = chunk[:m.start()]
                if slug and re.search(r'Vehicle base\s*$|Base du véhicule\s*$|Base del vehículo\s*$|پایه خودرو\s*$', pre[-40:]): key = slug + '.base'
                else: key = keyof(val(m))
            if not key: return m.group(0)
            return '<span data-wp="' + key + '|' + fmt_of(m) + '">' + m.group(0) + '</span>'
        res.append(MONEY.sub(rep_t, chunk))
    s2 = ''.join(res)
    # estimator item pages: the prerendered "Your estimate $X" total
    if slug:
        s2 = re.sub(r'(data-order-choices><div><span>[^<]*</span>\s*<strong>)<span data-wp="[a-z-]+\.full\|', lambda m: m.group(1)+'<span data-wp="'+slug+'.base|', s2)
        s2 = re.sub(r'(data-order-total><b>)(\$[\d,]+(?:\.\d\d)?)(</b>)', lambda m: m.group(1)+'<span data-wp="'+slug+'.full|'+('usd2' if '.' in m.group(2) else 'usd')+'">'+m.group(2)+'</span>'+m.group(3), s2)
        s2 = re.sub(r'(Your estimate|Votre estimation|Su estimación|برآورد شما)(</span>\s*<div[^>]*>)(\$[\d,]+(?:\.\d\d)?)', lambda m: m.group(1)+m.group(2)+'<span data-wp="'+slug+'.full|'+('usd2' if '.' in m.group(3) else 'usd')+'">'+m.group(3)+'</span>', s2, count=1)
    # convert \0key|fmt\0number\0 placeholders (attributes / JSON-LD) into slots
    final = []; p = 0
    for m in re.finditer(r'\0([a-z0-9.-]+)\|(\w+)\0([^\0]*)\0', s2):
        final.append(s2[p:m.start()]); p = m.end()
    # rebuild with slot anchors computed on the final text
    clean = re.sub(r'\0([a-z0-9.-]+)\|(\w+)\0([^\0]*)\0', lambda m: m.group(3), s2)
    off = 0; c_pos_list = []
    for m in re.finditer(r'\0([a-z0-9.-]+)\|(\w+)\0([^\0]*)\0', s2):
        cpos = m.start() - off; c_pos_list.append((cpos, cpos + len(m.group(3)), m.group(1), m.group(2))); off += len(m.group(0)) - len(m.group(3))
    for a, b, k, f in c_pos_list: add_slot(rel, clean, a, b, k, f)
    if clean != orig:
        open(ROOT + rel, 'w', encoding='utf-8').write(clean); changed += 1; files.append(rel)
json.dump({'v': 1, 'files': files, 'slots': slots}, open(OUTSLOTS, 'w'), ensure_ascii=False, indent=0)
print('changed', changed, 'slots', sum(len(v) for v in slots.values()))
