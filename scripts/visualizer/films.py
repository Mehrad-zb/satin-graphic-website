import json
# Approximate on-screen colours for real colour-change film product lines. Names/codes are for reference only;
# always confirm against a physical swatch in the shop. Format per row: name, finish, family, hex[, code][, hex2 for colour-flow]
L={}
L['3m']=('3M','2080 Wrap Film',[
('Gloss White','gloss','white','#f3f3f1','2080-G10'),('Gloss Black','gloss','black','#0d0d0f','2080-G12'),('Gloss Hot Rod Red','gloss','red','#b3121c','2080-G13'),
('Gloss Burnt Orange','gloss','orange','#c8461a','2080-G14'),('Gloss Bright Yellow','gloss','yellow','#f2c400','2080-G15'),('Gloss Sunflower','gloss','yellow','#f4a900','2080-G25'),
('Gloss Storm Gray','gloss','grey','#5d6266','2080-G31'),('Gloss Intense Blue','gloss','blue','#0f3f95','2080-G47'),('Gloss Flame Red','gloss','red','#d0201f','2080-G53'),
('Gloss Lemon Sting','gloss','yellow','#e3e02a','2080-G55'),('Gloss Sky Blue','gloss','blue','#4f9fd6','2080-G77'),('Gloss Light Ivory','gloss','white','#ece3cc','2080-G79'),
('Gloss Dark Red','gloss','red','#6e0f17','2080-G83'),('Gloss Green Envy','gloss','green','#3f8a2c','2080-G336'),('Gloss Blue Raspberry','gloss','blue','#1f63c6','2080-G337'),
('Gloss Dragon Fire Red','gloss','red','#a5151d','2080-G363'),('Gloss Kelly Green','gloss','green','#127a3a'),('Gloss Fiery Orange','gloss','orange','#e8601c'),
('Gloss Cosmic Blue','gloss','blue','#16244f'),('Gloss Plum Explosion','gloss','purple','#4a1f4d'),('Gloss Hot Pink','gloss','pink','#d1347a'),
('Gloss White Aluminum','gloss-metallic','silver','#c9cbcc','2080-G120'),('Gloss Anthracite','gloss-metallic','grey','#3b3f43','2080-G201'),
('Gloss Charcoal Metallic','gloss-metallic','grey','#2c2e31','2080-G211'),('Gloss Black Metallic','gloss-metallic','black','#16171a','2080-G212'),
('Gloss Blue Metallic','gloss-metallic','blue','#1f4f9a','2080-G378'),('Gloss Deep Blue Metallic','gloss-metallic','blue','#13264f'),('Gloss Red Metallic','gloss-metallic','red','#8e1420'),
('Gloss Liquid Copper','gloss-metallic','copper','#9b5232'),('Gloss Gold Metallic','gloss-metallic','gold','#a5843f'),('Gloss Atomic Teal','gloss-metallic','green','#127a7c'),
('Satin White','satin','white','#ececea','2080-S10'),('Satin Black','satin','black','#151517','2080-S12'),('Satin Battleship Gray','satin','grey','#6c7175','2080-S51'),
('Satin Apple Green','satin','green','#6ca83a','2080-S196'),('Satin Thundercloud','satin','grey','#4e545a','2080-S271'),('Satin Perfect Blue','satin','blue','#1d4c9e','2080-S347'),
('Satin Smoldering Red','satin','red','#8c1a1d','2080-S363'),('Satin Key West','satin','blue','#3aa6b9'),('Satin Dark Gray','satin','grey','#3a3d41'),
('Satin White Aluminum','satin-metallic','silver','#c3c5c6','2080-S120'),('Satin Ocean Shimmer','satin-metallic','blue','#2a5d86'),('Satin Canyon Copper','satin-metallic','copper','#8b5a3c'),
('Satin Vampire Red','satin-metallic','red','#5e1418'),('Satin Gold Dust Black','satin-metallic','black','#24211c'),
('Satin Pearl White','pearl','white','#eeece6','2080-SP10'),('Satin Frozen Vanilla','pearl','white','#e8e3d6'),
('Matte White','matte','white','#e9e9e7','2080-M10'),('Matte Black','matte','black','#1a1a1c','2080-M12'),('Matte Red','matte','red','#a2181f','2080-M13'),
('Matte Silver','matte-metallic','silver','#a4a7aa','2080-M21'),('Matte Deep Black','matte','black','#0e0e10','2080-M22'),('Matte Red Metallic','matte-metallic','red','#7b1a1f','2080-M203'),
('Matte Charcoal Metallic','matte-metallic','grey','#3d4044','2080-M211'),('Matte Blue Metallic','matte-metallic','blue','#2a4b7c','2080-M227'),
('Matte Gray Aluminum','matte-metallic','grey','#7d8083','2080-M230'),('Matte Dark Gray','matte','grey','#45484c','2080-M261'),('Matte Pine Green Metallic','matte-metallic','green','#2f4a39'),
('Matte Military Green','matte','green','#4f5638'),('Matte Brown Metallic','matte-metallic','brown','#4c3a2e'),
('Brushed Aluminum','brushed','silver','#b9bcbe','2080-BR120'),('Brushed Steel','brushed','grey','#7a7e82','2080-BR201'),('Brushed Black Metallic','brushed','black','#2a2b2e','2080-BR212'),
('Brushed Titanium','brushed','grey','#8e8a84','2080-BR230'),
('Carbon Fiber Black','carbon','black','#1b1c1f','2080-CFS12'),('Carbon Fiber Anthracite','carbon','grey','#34373b','2080-CFS201'),
('Satin Flip Psychedelic','colorflow','flip','#7a3d8c','2080-SP59','#2f8a6a'),('Satin Flip Volcanic Flare','colorflow','flip','#9a2a2a','2080-SP236','#b8892a'),
('Satin Flip Glacial Frost','colorflow','flip','#c9d6dc','2080-SP277','#8fa6c7'),('Satin Flip Ghost Pearl','colorflow','flip','#e9e6e6','2080-SP280','#b9a8d6'),
('Gloss Flip Deep Space','colorflow','flip','#1d1f3d','2080-GP278','#5a2a6e'),
])
L['avery']=('Avery Dennison','SW900 Supreme Wrapping Film',[
('Gloss White','gloss','white','#f2f2f0'),('Gloss Black','gloss','black','#0e0e10'),('Gloss Carmine Red','gloss','red','#a9141f'),('Gloss Cardinal Red','gloss','red','#7e1219'),
('Gloss Soft Red','gloss','red','#c9302c'),('Gloss Orange','gloss','orange','#e05a14'),('Gloss Bright Orange','gloss','orange','#f0761e'),('Gloss Yellow','gloss','yellow','#f3c300'),
('Gloss Grass Green','gloss','green','#3a8f2f'),('Gloss Dark Green','gloss','green','#14402c'),('Gloss Lime Green','gloss','green','#8dc63f'),('Gloss Blue','gloss','blue','#1450a8'),
('Gloss Light Blue','gloss','blue','#5aa3d9'),('Gloss Dark Blue','gloss','blue','#14234d'),('Gloss Purple','gloss','purple','#4f2a7a'),('Gloss Pink','gloss','pink','#e46aa0'),
('Gloss Grey','gloss','grey','#6e7377'),('Gloss Rock Grey','gloss','grey','#4a4e52'),('Gloss Brown','gloss','brown','#4a3022'),('Gloss Sand','gloss','brown','#c2ae8a'),
('Gloss Metallic Black','gloss-metallic','black','#17181b'),('Gloss Metallic Dark Grey','gloss-metallic','grey','#3a3d41'),('Gloss Metallic Silver','gloss-metallic','silver','#b8bbbe'),
('Gloss Metallic Quicksilver','gloss-metallic','silver','#9ea2a6'),('Gloss Metallic Blue','gloss-metallic','blue','#1d4891'),('Gloss Metallic Dark Blue','gloss-metallic','blue','#152a55'),
('Gloss Metallic Red','gloss-metallic','red','#8f1520'),('Gloss Metallic Green','gloss-metallic','green','#23573a'),('Gloss Metallic Gold','gloss-metallic','gold','#a5873f'),
('Gloss Metallic Bronze','gloss-metallic','bronze','#7a5532'),('Gloss Metallic Purple','gloss-metallic','purple','#4b2a6b'),('Gloss Metallic Pink','gloss-metallic','pink','#c4557f'),
('Satin Black','satin','black','#161618'),('Satin White','satin','white','#ebebe9'),('Satin Dark Grey','satin','grey','#3c3f43'),('Satin Grey','satin','grey','#73777b'),
('Satin Khaki Green','satin','green','#6b6a4c'),('Satin Dark Basalt','satin','grey','#2e3134'),('Satin Metallic Black','satin-metallic','black','#1c1d20'),
('Satin Metallic Charcoal','satin-metallic','grey','#35383c'),('Satin Metallic Silver','satin-metallic','silver','#a9acaf'),('Satin Metallic Blue','satin-metallic','blue','#22457e'),
('Satin Metallic Red','satin-metallic','red','#7d1820'),('Satin Metallic Copper','satin-metallic','copper','#8a5434'),('Satin Metallic Bronze','satin-metallic','bronze','#6e5136'),
('Satin Pearl White','pearl','white','#ecebe6'),('Satin Pearl Nightfall Blue','pearl','blue','#1b2c56'),('Gloss Pearl White','pearl','white','#f1efe9'),('Gloss Pearl Dark Grey','pearl','grey','#3e4044'),
('Matte Black','matte','black','#1a1a1c'),('Matte White','matte','white','#e7e7e5'),('Matte Grey','matte','grey','#6f7377'),('Matte Khaki Green','matte','green','#61644a'),
('Matte Olive Green','matte','green','#4a5236'),('Matte Red','matte','red','#9a1c22'),('Matte Blue','matte','blue','#24488a'),
('Matte Metallic Charcoal','matte-metallic','grey','#3a3c40'),('Matte Metallic Silver','matte-metallic','silver','#9fa2a5'),('Matte Metallic Brown','matte-metallic','brown','#4a392e'),
('Matte Metallic Blue','matte-metallic','blue','#294a7a'),('Matte Metallic Apple Green','matte-metallic','green','#6f9a3a'),('Matte Metallic Burgundy','matte-metallic','red','#4e1a22'),
('Diamond Silver','diamond','silver','#c2c4c6'),('Diamond Black','diamond','black','#1b1c1f'),('Diamond Blue','diamond','blue','#1e4a9a'),('Diamond Red','diamond','red','#9b1721'),
('Brushed Aluminium','brushed','silver','#b7babc'),('Brushed Steel','brushed','grey','#7c8084'),('Brushed Titanium','brushed','grey','#8c8781'),('Brushed Black','brushed','black','#29292b'),
('Brushed Bronze','brushed','bronze','#8a6a4a'),
('Carbon Fiber Black','carbon','black','#1c1d20'),('Carbon Fiber Anthracite','carbon','grey','#36393d'),
('ColorFlow Rushing Riptide','colorflow','flip','#1f5aa8','','#2f9a7c'),('ColorFlow Lightning Ridge','colorflow','flip','#b39a3c','','#3a8a5a'),
('ColorFlow Rising Sun','colorflow','flip','#b02a2a','','#d29a2a'),('ColorFlow Urban Jungle','colorflow','flip','#9aa29a','','#3f6e4a'),
('ColorFlow Roaring Thunder','colorflow','flip','#6a2a8a','','#1f4f9a'),('ColorFlow Fresh Spring','colorflow','flip','#c7b44a','','#7aa83f'),
('Conform Chrome Silver','chrome','silver','#d6d9dc'),('Conform Chrome Black','chrome','black','#3a3c40'),('Conform Chrome Gold','chrome','gold','#c79a3a'),
('Conform Chrome Blue','chrome','blue','#2a5bb0'),('Conform Chrome Red','chrome','red','#a8202a'),
])
L['kpmf']=('KPMF','Vinyl Wrap Films',[
('Gloss Black','gloss','black','#0f0f11'),('Gloss White','gloss','white','#f1f1ef'),('Gloss Hot Lava','gloss','red','#c11d22'),('Gloss Racing Red','gloss','red','#b5141c'),
('Gloss Sunset Orange','gloss','orange','#e2601c'),('Gloss Sunflower Yellow','gloss','yellow','#f2b500'),('Gloss Racing Green','gloss','green','#13402a'),('Gloss Royal Blue','gloss','blue','#1a3f96'),
('Gloss Nardo Grey','gloss','grey','#8a8d8f'),('Gloss Battleship Grey','gloss','grey','#5b6064'),('Gloss Purple','gloss','purple','#47286b'),
('Gloss Iron Metallic','gloss-metallic','grey','#3e4145'),('Gloss Starlight Silver','gloss-metallic','silver','#bcbec1'),('Gloss Ocean Blue Metallic','gloss-metallic','blue','#204a82'),
('Gloss Burgundy Metallic','gloss-metallic','red','#5c1620'),('Gloss Champagne Metallic','gloss-metallic','gold','#b8a17a'),
('Matt Black','matte','black','#19191b'),('Matt White','matte','white','#e6e6e4'),('Matt Nardo Grey','matte','grey','#85888a'),('Matt Army Green','matte','green','#4b5336'),
('Matt Midnight Blue','matte','blue','#1b2846'),('Matt Iron Metallic','matte-metallic','grey','#3c3f43'),('Matt Bronze Metallic','matte-metallic','bronze','#6c5238'),
('Satin Black','satin','black','#161618'),('Satin Graphite','satin','grey','#3b3e42'),('Satin Arctic White','satin','white','#ebebe9'),('Satin Electric Blue','satin','blue','#1d58b4'),
('Satin Iridescent Black/Gold','pearl','black','#25221c'),('Satin Iridescent White/Blue','pearl','white','#e3e8ee'),
('Matt Iridescent Blue/Green','colorflow','flip','#24508a','','#2f8a6f'),('Gloss Iridescent Purple/Gold','colorflow','flip','#55307a','','#b08c3a'),
('Gloss Iridescent Red/Gold','colorflow','flip','#8e1f2a','','#c08a2a'),('Matt Iridescent Gold/Green','colorflow','flip','#9a8740','','#4d7f4a'),
('Brushed Aluminium','brushed','silver','#b4b7ba'),('Brushed Gunmetal','brushed','grey','#5a5d61'),('Starlight Black','diamond','black','#1c1d22'),('Starlight Blue','diamond','blue','#1c3e85'),
('Carbon Black','carbon','black','#1c1d20'),('Mirror Chrome Silver','chrome','silver','#d8dadd'),('Mirror Chrome Rose Gold','chrome','pink','#c98f84'),
])
L['oracal']=('ORACAL','970RA Premium Wrapping Cast',[
('Black Gloss','gloss','black','#0f0f11'),('White Gloss','gloss','white','#f0f0ee'),('Red Gloss','gloss','red','#b3141d'),('Signal Yellow Gloss','gloss','yellow','#f0b400'),
('Pastel Orange Gloss','gloss','orange','#ea6a1f'),('Traffic Blue Gloss','gloss','blue','#14468f'),('Gentian Blue Gloss','gloss','blue','#1c3d78'),('Lime Green Gloss','gloss','green','#7cb23a'),
('Dark Green Gloss','gloss','green','#17432d'),('Telegrey Gloss','gloss','grey','#878b8e'),('Dark Grey Gloss','gloss','grey','#4b4f53'),('Violet Gloss','gloss','purple','#5a2d7a'),
('Anthracite Metallic Gloss','gloss-metallic','grey','#383b3f'),('Graphite Metallic Gloss','gloss-metallic','grey','#4b4e52'),('Silver Grey Metallic Gloss','gloss-metallic','silver','#a9acaf'),
('Blue Metallic Gloss','gloss-metallic','blue','#22508f'),('Wine Red Metallic Gloss','gloss-metallic','red','#5b1620'),('Gold Metallic Gloss','gloss-metallic','gold','#a8883f'),
('Black Matt','matte','black','#1a1a1c'),('White Matt','matte','white','#e5e5e3'),('Grey Matt','matte','grey','#6c7074'),('Olive Matt','matte','green','#4e5638'),
('Anthracite Metallic Matt','matte-metallic','grey','#3c3e42'),('Silver Grey Metallic Matt','matte-metallic','silver','#9c9fa2'),('Copper Metallic Matt','matte-metallic','copper','#7f5236'),
('Black Satin','satin','black','#161618'),('Graphite Satin','satin','grey','#3d4044'),
('Shift Effect Purple/Gold','colorflow','flip','#5a2f7c','','#b8923a'),('Shift Effect Blue/Green','colorflow','flip','#1f4f96','','#2c8a6e'),('Shift Effect Silver/Grey','colorflow','flip','#c8cacc','','#6f7377'),
('Brushed Aluminium','brushed','silver','#b5b8bb'),('Carbon Black','carbon','black','#1d1e21'),
])
out=[]
for bid,(brand,line,rows) in L.items():
  for r in rows:
    name,fin,fam,hx=r[:4]; code=r[4] if len(r)>4 else ''; hx2=r[5] if len(r)>5 else ''
    slug=bid+'-'+(code.lower().replace('2080-','') if code else '')
    slug=(bid+'-'+name.lower()).replace('/','-').replace(' ','-') if not code else slug
    o={'id':slug,'brand':bid,'name':name,'finish':fin,'family':fam,'hex':hx}
    if code:o['code']=code
    if hx2:o['hex2']=hx2
    out.append(o)
ids=[o['id'] for o in out]; assert len(ids)==len(set(ids)),[i for i in ids if ids.count(i)>1]
doc={'note':'Approximate on-screen colours for reference only. Screens vary - always confirm with a physical swatch in the shop. Product names and codes belong to their manufacturers.',
 'brands':{k:{'name':v[0],'line':v[1]} for k,v in L.items()},'films':out}
json.dump(doc,open('/home/claude/gh-satin/dist/client/visualizer/films.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(out),{k:sum(1 for o in out if o['brand']==k) for k in L})
