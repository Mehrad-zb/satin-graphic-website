import os, re, json, html
ROOT='/home/claude/hp/pkg/new.satingraphic.ca'
keep={'men-g500','men-g200','men-g640','women-g500l','women-g640l','youth-g500b','youth-g200b','men-88181','women-78181','men-7002','men-g180','men-g185','youth-g185b','hats-6006','hats-6606','hats-6277','totes-q-tees-q800','totes-q-tees-q4400'}
cities=set(json.load(open('/home/claude/hp/seo-lastmod.json')).keys()) if False else set()
skip_exact={'/satin/checkout','/satin/account','/satin/register','/satin/apparel/workwear'}
CAT={'vehicle-wraps':'Vehicle wraps','print-shop':'Print shop','apparel':'Apparel','window-tint':'Window tint','window-graphics':'Window graphics','wallpaper':'Wallpaper','auto-detailing':'Auto detailing','shop':'Shop','guides':'Guides'}
prods={}
_P=json.load(open('/home/claude/hp/pkg/satin-new/data/products.json'))
for x in (_P['products'] if isinstance(_P,dict) else _P):
    if isinstance(x,dict) and x.get('path'): prods.setdefault(x['path'],{}).update({k:v for k,v in x.items() if v})
KW={'polos':'polo shirt','t-shirts':'t-shirt tee','hoodies':'hoodie','sweatshirts':'sweatshirt crewneck','hats':'hat cap','totes':'tote bag'}
GW={'youth':'kids youth','women':'women ladies','men':'men'}
rows=[]
for dp,dn,fn in os.walk(ROOT+'/satin'):
    if 'index.html' not in fn: continue
    p=dp[len(ROOT):]
    if re.match(r'^/satin/(fa|fr|es)(/|$)',p) or p.startswith('/satin/portfolio/') or p in skip_exact: continue
    m=re.match(r'^/satin/apparel/products/(.+)$',p)
    if m and m.group(1) not in keep: continue
    s=open(dp+'/index.html',encoding='utf-8',errors='ignore').read(200000)
    if re.search(r'<meta name="robots" content="[^"]*noindex',s): continue
    t=re.search(r'<title>(.*?)</title>',s,re.S); t=html.unescape(t.group(1).strip()) if t else p
    t=re.sub(r'\s*[|·–-]\s*Satin Graphic.*$','',t)
    d=re.search(r'<meta name="description" content="([^"]*)"',s); d=html.unescape(d.group(1)) if d else ''
    d=re.sub(r'\s*[:;,]?\s*[^.:;]*\$\d[^.;]*[.;]?', '.', d).replace('..','.').strip(' .')+'.' if '$' in d else d
    h=re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S); h=html.unescape(re.sub('<[^>]+>','',h.group(1))).strip() if h else ''
    seg=p.split('/')[2] if p.count('/')>=2 else ''
    pr=prods.get(p,{}); k=' '.join(filter(None,[KW.get(pr.get('category',''),''),GW.get(pr.get('group',''),'')]))
    rows.append({'k':k,'p':p+'/' if p!='/satin' else '/satin/','t':t,'h':h if h!=t else '','d':d[:180],'c':CAT.get(seg,'')})
rows.sort(key=lambda r:(r['p'].count('/'),r['p']))
json.dump({'v':1,'pages':rows},open(ROOT+'/search-index.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(rows), os.path.getsize(ROOT+'/search-index.json'))
