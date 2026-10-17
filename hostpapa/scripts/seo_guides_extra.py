"""Extra long-form guides (print, signs, window graphics, wallpaper, apparel, vehicle coverage).

Appended to seo_content.GUIDES (same data structure, same mini-markup — see the comment above GUIDES in seo_content.py).
Prices are read from the estimator rules at build time (satin-new/data/rules/*.json and pricing.json) so the
guides always match the configurators; the hard-coded numbers below are only fallbacks if a file is missing.
Placeholders in this file use <<key>> (resolved here), so the texts contain no {braces} for seo_pass.fmt().

GUIDE_IMG_EXTRA / GUIDE_LINKS_EXTRA are optional hooks for seo_pass.py (hero image per guide and the
"Helpful reading" links on service pages); see the lead's notes.
"""
import json, os, re, sys

_OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]) else '/home/claude/hp/out'
_APP = _OUT + '/satin-new/data'

def _rule(rid):
    try:
        d = json.load(open(f'{_APP}/rules/{rid}.json', encoding='utf-8')); return d.get('rule', d) or {}
    except Exception: return {}
def _c(rid, key, default):
    v = _rule(rid).get('constants', {}).get(key)
    return v if isinstance(v, (int, float)) and v else default
def _opt(rid, field, label, default):
    for f in _rule(rid).get('fields', []):
        if f.get('key') == field:
            for o in f.get('options', []):
                if o.get('label', '').lower().startswith(label.lower()) and isinstance(o.get('value'), (int, float)): return o['value']
    return default
def _m(n):
    n = round(n + 1e-9, 2)
    return f'${n:,.0f}' if abs(n - round(n)) < 0.005 else f'${n:,.2f}'
def _r10(n): return round(n / 10) * 10
try: _BASES = json.load(open(f'{_APP}/pricing.json'))['bases']
except Exception: _BASES = {}
_B = lambda k, d: _BASES.get(k, d)

_bc = 'print-business-cards'; _ru = 'print-roll-up-banner'; _xf = 'print-x-frame-banner'; _ys = 'print-yard-signs'; _pb = 'print-poly-bag-lawn-sign'
_pbm = _c(_pb, 'markup', 1.4)
P = {
 # business cards (rule constants)
 'bc_reg500': _m(_c(_bc, 'regularq500', 26)), 'bc_reg1000': _m(_c(_bc, 'regularq1000', 45)), 'bc_lux500': _m(_c(_bc, 'luxuryq500', 34.5)),
 'bc_lux1000': _m(_c(_bc, 'luxuryq1000', 61.5)), 'bc_back': _m(_c(_bc, 'backSide', 6)), 'bc_round': _m(_c(_bc, 'rounded', 4)), 'bc_design': _m(_c(_bc, 'designFee', 100)),
 # roll-up / x-frame
 'ru_1': _m(_c(_ru, 'unit1', 148.74)), 'ru_2': _m(_c(_ru, 'unit2', 140.25)), 'ru_wide': _m(_c(_ru, 'largerSize', 40)), 'ru_prem': _m(_c(_ru, 'premiumStand', 45)),
 'xf_1': _m(_c(_xf, 'unit1', 139.99)), 'xf_big': _m(_c(_xf, 'largerSize', 15)), 'xf_credit': _m(_c(_xf, 'graphicOnlyCredit', 55)),
 'design_print': _m(_c(_ru, 'designFee', 100)),
 # yard signs / poly bags
 'ys_1': _m(_c(_ys, 'unit1', 19.99)), 'ys_10': _m(_c(_ys, 'unit10', 14.56)), 'ys_25': _m(_c(_ys, 'unit25', 11.2)), 'ys_big': _m(_c(_ys, 'largerSize', 9)),
 'ys_back': _m(_c(_ys, 'backSide', 4)), 'ys_stake': _m(_c(_ys, 'stake', 2)),
 'pb_50': _m(_c(_pb, 's0c0q0', 5) * _pbm), 'pb_100': _m(_c(_pb, 's0c0q1', 3.15) * _pbm), 'pb_1000': _m(_c(_pb, 's0c0q4', 2.8) * _pbm), 'pb_design': _m(_c(_pb, 'designFee', 50)),
 # window graphics ($ / sq ft)
 'wg_decal': _m(_opt('glass-window-decals', 'material', 'Single', 12)), 'wg_perf': _m(_opt('glass-perforated-vinyl', 'material', 'Perforated', 9)),
 'wg_frost': _m(_opt('glass-frosted-vinyl', 'material', 'Frosted', 7)), 'wg_full': _m(_opt('glass-full-window-graphics', 'material', 'Regular', 9)),
 'wg_clear': _m(_opt('glass-full-window-graphics', 'material', 'Clear', 10)), 'wg_black': _m(_opt('glass-full-window-graphics', 'material', 'Blackout', 12)),
 'wg_inst': _m(_c('glass-perforated-vinyl', 'installRate', 3)), 'wg_min': _m(_c('glass-perforated-vinyl', 'minimum', 75)),
 # wallpaper ($ / sq ft)
 'wp_flat': _m(_opt('wallpaper-custom', 'material', 'Flat', 7)), 'wp_tex': _m(_opt('wallpaper-custom', 'material', 'Texture', 10)), 'wp_inst': _m(_c('wallpaper-custom', 'installRate', 3)),
 # DTF transfers
 'dtf_sqin': f"${_c('dtf-transfers', 'sqInRate', 0.025):.3f}".rstrip('0'), 'dtf_10': _m(10 * 10 * _c('dtf-transfers', 'sqInRate', 0.025)),
 'dtf_min': _m(_c('dtf-transfers', 'minimum', 0.25)), 'dtf_cut': _m(_c('dtf-transfers', 'cutFee', 0.15)), 'dtf_design': _m(_c('dtf-transfers', 'designFee', 30)),
 # vehicle coverage (pricing.json bases; 22 / 45 / 70 % as in the wrap estimator)
 'v_car': _m(_B('sedan', 2800)), 'v_transit': _m(_B('transit-van', 3950)), 'v_box': _m(_B('box-truck', 5800)), 'v_pickup': _m(_B('pickup-truck', 3200)),
 'v_car_l': _m(_r10(_B('sedan', 2800) * .22)), 'v_car_p': _m(_r10(_B('sedan', 2800) * .45)), 'v_car_q': _m(_r10(_B('sedan', 2800) * .70)),
 'v_tr_l': _m(_r10(_B('transit-van', 3950) * .22)), 'v_tr_p': _m(_r10(_B('transit-van', 3950) * .45)), 'v_tr_q': _m(_r10(_B('transit-van', 3950) * .70)),
 'v_box_l': _m(_r10(_B('box-truck', 5800) * .22)), 'v_box_p': _m(_r10(_B('box-truck', 5800) * .45)), 'v_box_q': _m(_r10(_B('box-truck', 5800) * .70)),
 'v_pk_l': _m(_r10(_B('pickup-truck', 3200) * .22)), 'v_pk_p': _m(_r10(_B('pickup-truck', 3200) * .45)), 'v_pk_q': _m(_r10(_B('pickup-truck', 3200) * .70)),
}

def _sub(t):
    if isinstance(t, str): return re.sub(r'<<(\w+)>>', lambda m: P[m.group(1)], t)
    if isinstance(t, tuple): return tuple(_sub(x) for x in t)
    if isinstance(t, list): return [_sub(x) for x in t]
    if isinstance(t, dict): return {k: _sub(v) for k, v in t.items()}
    return t

_GUIDES = [
 # ------------------------------------------------------------------ 1
 {'slug': 'business-card-design-tips', 'cat': 'How-to',
  'title': 'How to Design a Business Card: 13 Rules | Satin Graphic',
  'h1': 'How to design a business card that works: 13 rules',
  'desc': '13 practical rules for a business card people keep: what to include, layout, fonts, colour, paper and print-ready files — from a Vaughan print shop.',
  'lede': 'A business card is small, so every millimetre has a job. These are the rules we use when we lay out cards for GTA businesses — and the mistakes we see most often on files sent to print.',
  'sections': [
   ('Why the card still matters', '''A business card is usually the first printed piece of a brand that someone holds in their hand, and it is often the one they keep in a wallet, a cardholder or a pile on a desk. It is also the cheapest piece of marketing you will buy: at our shop, 500 regular 14 pt matte cards start at <<bc_reg500>> before tax. Because it is so inexpensive, the difference between a card that works and one that gets thrown out comes down almost entirely to design and paper — not budget.

The thirteen rules below are grouped into content, layout, type and colour, and production. Follow them and the card will read clearly, look professional and print without surprises.'''),
   ('Content: decide what the card must do', '''**1. Start with one job.** Decide what you want the person to do after meeting you — call, book online, visit the shop, follow you on Instagram — and make that the most visible contact detail. Everything else supports it.

**2. Include only what someone will use.** For most local businesses that is: your name, title, business name and logo, one phone number, one email, the website, and the address if customers visit you. Fax numbers, three phone lines and every social handle you own make the card harder to read.

**3. Say what you do.** A logo and a name are not always enough — “Acme Group” could be anything. Add a short line such as “Residential HVAC · Vaughan & York Region” or “Custom kitchen cabinetry · Woodbridge”. A clear line of service turns a card into a reminder of why someone should call.

**4. Use the back.** Printing both sides adds only <<bc_back>> to an order at our shop, and it doubles the space. Put the logo and tagline on one side and the contact details on the other, or use the back for a short list of services, a map pin, opening hours or a QR code to your booking page or reviews.'''),
   ('Layout: give it room', '''**5. Respect the trim, bleed and safe area.** A standard North American card is 3.5 × 2 in. Build the file at 3.75 × 2.25 in so that colour and images run 0.125 in (3 mm) past every edge — the bleed — and keep text and logos at least 0.125 in inside the trim line. Cutting machines are precise but not perfect, and anything right on the edge can be trimmed off or look off-centre.

**6. Leave white space.** Crowded cards look cheap. Group related information (name and title; phone, email and web) and leave clear space between groups. Aligning everything to one or two edges usually looks better than centring every line.

**7. Make the hierarchy obvious.** The eye should land on the name or logo first, then the main contact method, then the rest. Achieve that with size and weight, not with five different colours.'''),
   ('Type and colour', '''**8. Keep fonts readable at small sizes.** Use no more than two typefaces. Body text below about 7 pt becomes hard to read, especially for older customers, and very thin or script fonts break up in print. Phone numbers and emails deserve a clean, simple font.

**9. Work in CMYK and use proper black.** Screens show RGB colour; presses print CMYK. Bright RGB blues, greens and oranges shift when converted, so design in CMYK from the start and give us Pantone references for brand colours. Small text should be 100% black (K only) so it stays sharp; large solid black areas look richer in rich black (C60 M40 Y40 K100).

**10. Use high contrast.** Light grey text on white, or dark blue on black, looks elegant on a monitor and disappears on paper. If in doubt, increase the contrast.'''),
   ('Paper, finishes and production', '''**11. Choose the stock for the impression you want.** Our regular cards are 14 pt matte — practical, easy to write on and good for most trades and service businesses. Luxury cards are 16 pt with a soft-touch finish, which is slightly thicker and has a velvety feel in the hand; 500 start at <<bc_lux500>>. Matte and soft-touch surfaces reduce glare and fingerprints. If you want to write appointment times on the card, avoid high-gloss coatings.

**12. Use special touches with purpose.** Rounded corners (<<bc_round>> extra on our configurator) feel softer and suit wellness, beauty and family-oriented brands; square corners read as classic and corporate. Whatever you choose, use it consistently with your other printed pieces.

**13. Send a print-ready file and approve the proof.** Export a PDF (PDF/X-1a or “High Quality Print”) at 300 DPI with crop marks and bleed, fonts outlined or embedded, and images embedded. Single pages, not spreads. We send a digital proof before anything goes to press — read every digit of the phone number and email aloud before you approve it. Typos on cards are the single most common reprint we see.'''),
   ('Quick checklist before you order', '''| Check | Spec |
| Trim size | 3.5 × 2 in |
| Document size with bleed | 3.75 × 2.25 in (0.125 in bleed each side) |
| Safe area | Text and logos 0.125 in inside the trim |
| Resolution | 300 DPI at final size |
| Colour | CMYK; small text 100% K; large blacks C60 M40 Y40 K100 |
| File | Print-ready PDF; AI, EPS, packaged INDD, TIFF or PSD also accepted |
| Fonts | Outlined or embedded |

Standard production is 7–10 business days after proof approval. If you need cards for a specific event, tell us the date when you order and we’ll confirm what’s possible.'''),
   ('No designer? No problem', '''If you have a logo but no layout, choose the design option on the [business cards page](/satin/print-shop/offset/business-cards/) (<<bc_design>>) and our team will set it up from your logo and details, then send a proof. If you don’t have a logo yet, start with our [design services](/satin/shop/design-services/). Planning a matching set? The same layout rules apply to [flyers](/satin/print-shop/offset/flyers/), [postcards](/satin/print-shop/offset/postcards/) and [door hangers](/satin/print-shop/offset/door-hangers/), and our [artwork guidelines](/satin/artwork-guidelines/) cover file setup for every product.'''),
  ],
  'faqs': [('What size is a standard business card in Canada?', '3.5 × 2 inches, the same as the US standard. Build the file at 3.75 × 2.25 inches to include a 0.125-inch bleed on every side.'),
           ('What should be on a business card?', 'Your name and title, business name and logo, one phone number, one email, your website, the address if customers visit you, and a short line that says what you do. Use the back for services, hours or a QR code.'),
           ('What paper thickness is best for business cards?', 'Our regular cards are 14 pt matte, which feels solid and is easy to write on. For a more premium feel, choose our 16 pt soft-touch luxury cards.'),
           ('Should I put a QR code on my business card?', 'If it leads somewhere useful — booking, reviews or a portfolio — yes. Print it at least about 0.75 in square with a quiet margin around it, and test it on the proof.'),
           ('How long does business card printing take?', 'Standard production at our shop is 7–10 business days after you approve the proof and pay.')],
  'links': [('Business cards', '/satin/print-shop/offset/business-cards/'), ('Design services', '/satin/shop/design-services/'), ('Artwork guidelines', '/satin/artwork-guidelines/')]},

 # ------------------------------------------------------------------ 2
 {'slug': 'wall-mural-wallpaper-materials', 'cat': 'Buying advice',
  'title': 'Which Wall Mural Material Should I Choose? | Satin Graphic',
  'h1': 'Which wall mural material should you choose?',
  'desc': 'Flat matte or texture, removable or permanent adhesive: how to choose a custom wall mural material, with prices, wall prep and install tips.',
  'lede': 'Custom wall murals look simple, but the material decides how they look up close, how they clean and whether they come off cleanly later. Here is how to choose.',
  'sections': [
   ('The short answer', '''Choose by three things: **the finish you want to see**, **how long the mural should stay up**, and **the wall it’s going on**. For most homes and offices, a flat matte finish with removable adhesive is the safest choice. Choose a textured finish when you want depth and a tactile, canvas-like surface — especially for photographic and botanical designs — and permanent adhesive for high-traffic commercial walls that will stay for years.

At our shop, custom murals are printed to your exact wall size: Flat Matte is <<wp_flat>> per sq ft and Texture is <<wp_tex>> per sq ft, before tax. Removable and permanent adhesive cost the same, and professional installation is <<wp_inst>> per sq ft. You can upload your own image and preview it on a room photo on our [custom wallpaper page](/satin/wallpaper/custom/).'''),
   ('Finish: flat matte or texture', '''| | Flat Matte | Texture |
| Look | Smooth, low reflection, crisp detail | Tactile surface with visual depth |
| Best for | Graphics, logos, text, geometric patterns, kids’ rooms | Photography, botanical and landscape scenes, feature walls |
| Glare | Very low — good opposite windows | Low; texture breaks up reflections further |
| Hides wall flaws | Somewhat | Better — the texture masks minor bumps |
| Price at our shop | <<wp_flat>> / sq ft | <<wp_tex>> / sq ft |

A matte surface is the natural choice for anything with fine lines or small text, because the image stays sharp and readable from any angle. Texture flatters imagery: forests, marble, watercolour and vintage-style artwork look richer on it, and the surface helps hide small imperfections in drywall.'''),
   ('Adhesive: removable or permanent', '''**Removable adhesive** is designed to come off the wall when you’re done — ideal for rentals, condos, children’s rooms that will change in a few years, seasonal displays and offices that rebrand. **Permanent adhesive** bonds more strongly, which suits commercial corridors, restaurants, gyms and reception walls where people lean, brush past or clean the wall often.

One honest caveat that we also print on our product pages: removable does not guarantee damage-free removal on every painted surface. Fresh paint, poor-quality paint or drywall that was never primed can lift with any adhesive. Test a small piece in an inconspicuous spot first, and if you’re in a rental, check with your landlord or condo board before installing.'''),
   ('Is your wall ready?', '''Most problems with murals come from the wall, not the print. Before you order:

* **Let new paint cure fully.** Fresh paint keeps releasing solvents and moisture for weeks. Paint manufacturers usually recommend waiting several weeks before applying adhesive products — ask your painter or check the paint’s data sheet.
* **Check the paint type.** Very washable or “scrubbable” paints and some low-sheen finishes with slick additives can resist adhesion. Matte or eggshell latex on primed drywall is ideal.
* **Smooth, clean and dry.** Fill holes, sand bumps and wipe off dust and grease. Heavily textured walls (stipple or popcorn) aren’t suitable.
* **Avoid damp walls.** Bathrooms with showers and exterior walls with condensation problems will undermine any adhesive.'''),
   ('Homes vs businesses', '''**Homes.** Feature walls in living rooms, bedrooms and nurseries are the classic use. Matte with removable adhesive keeps your options open. Browse our ready-made [botanical](/satin/wallpaper/botanical/), [marble](/satin/wallpaper/marble/), [geometric](/satin/wallpaper/geometric/), [kids](/satin/wallpaper/kids/) and [bedroom](/satin/wallpaper/bedroom/) collections, or upload your own photo.

**Offices and retail.** A branded wall behind reception or in a meeting room is one of the most cost-effective ways to make a space feel like your company — see our [office collection](/satin/wallpaper/office/). For high-traffic areas, choose permanent adhesive.

**Restaurants and public spaces.** In commercial interiors, landlords, insurers or inspectors may ask about the fire performance of wall finishes. In Canada the usual test for interior finishes is CAN/ULC-S102 (surface burning characteristics). Ask us for the material’s spec sheet before you order so you can share it with your landlord or contractor.'''),
   ('Measuring and artwork', '''Measure the widest and tallest points of the wall in inches and add a trimming allowance — walls, floors and ceilings are rarely perfectly square. Note windows, outlets and doors so the important parts of the image don’t land on them. For artwork, 100–150 DPI at final size is enough for a wall viewed from a few feet away; a phone photo can work for a smaller wall but rarely for a large one, so send the original file and we’ll check it during preflight. Our [artwork guide](/satin/guides/prepare-artwork-vehicle-wrap-print/) covers resolution and bleed for every product.

We send a proof before printing so you can confirm colour, crop and scale. Panels are printed in order and should be hung from the centre outward, aligning the first panel carefully and trimming only after alignment is checked.'''),
   ('DIY or professional install?', '''A single accent wall in a home is a realistic DIY project for a patient person with a helper, a level, a smoothing tool and a sharp knife. Choose professional installation (<<wp_inst>> per sq ft at our shop) for large or tall walls, stairwells, commercial spaces, permanent adhesive, or whenever a perfect pattern match across panels matters. Installation scope is confirmed before production.'''),
  ],
  'faqs': [('What is the best material for a wall mural?', 'For most homes and offices, a flat matte finish with removable adhesive. Choose a textured finish for photographic or botanical designs, and permanent adhesive for high-traffic commercial walls.'),
           ('How much does a custom wall mural cost?', 'At our shop, Flat Matte is {wp_flat} per sq ft and Texture is {wp_tex} per sq ft before tax, with optional installation at {wp_inst} per sq ft. A 12 × 8 ft wall (96 sq ft) in Flat Matte is about {wp_eg} before installation.'),
           ('Is removable wallpaper really removable?', 'It is designed to remove cleanly from properly cured, primed paint, but no adhesive can guarantee damage-free removal on every painted surface. Test a small piece first.'),
           ('How long should I wait after painting before installing a mural?', 'Long enough for the paint to cure fully — usually several weeks. Check the paint manufacturer’s guidance.'),
           ('Can I use my own photo?', 'Yes. Upload it on the custom wallpaper page; 100–150 DPI at final size is ideal, and we check every file before printing.')],
  'links': [('Custom wall murals', '/satin/wallpaper/custom/'), ('Wallpaper collections', '/satin/wallpaper/'), ('Office wallpaper', '/satin/wallpaper/office/')]},

 # ------------------------------------------------------------------ 3
 {'slug': 'make-local-business-visible', 'cat': 'Business',
  'title': '7 Ways to Make Your Local Business Visible | Satin Graphic',
  'h1': '7 ways to make your business visible in the GTA',
  'desc': 'Practical ways for GTA businesses to get noticed: Google profile, window graphics, vehicle lettering, sidewalk and yard signs, print and apparel.',
  'lede': 'Most local customers find a business in one of two ways: they search for it, or they see it. Here are seven practical ways to be seen more often — and how to make each one count.',
  'sections': [
   ('Start with the basics: be findable and consistent', '''Before spending on signage or print, make sure people who see your name can find you. Claim and complete your **Google Business Profile**: correct category, hours, phone, website, service area and real photos of your work, your team and your storefront or vehicles. Use exactly the same business name, address and phone number on your website, your profile, your vehicles and your printed materials. Consistency helps customers trust what they see, and it avoids the frustration of a wrong number printed on a van.

Then pick one visual identity — logo, two or three brand colours, one or two fonts — and use it everywhere. Each of the seven channels below works better when people recognise it as the same company.'''),
   ('1. Storefront and window graphics', '''If you have a storefront, the glass is your most valuable advertising space. Someone walking or driving past decides in seconds whether you’re open, what you sell and whether it’s for them.

* **Hours, logo and phone on the door** — single-colour [window decals](/satin/window-graphics/window-decals/) are inexpensive and easy to update.
* **A large, readable message for drivers** — [perforated vinyl](/satin/window-graphics/perforated-vinyl/) carries a full-colour image outside while you still see out from inside.
* **Privacy with branding** — [frosted vinyl](/satin/window-graphics/frosted-vinyl/) with a cut-out logo works well for clinics and offices.

Most plazas require landlord approval and sometimes a municipal sign permit for exterior signage, so check before you order. Our [storefront window graphics guide](/satin/guides/storefront-window-graphics-guide/) compares the options in detail.'''),
   ('2. Vehicle lettering and wraps', '''For trades, home services, delivery and mobile businesses, the vehicle is often the biggest sign the business owns — and it is parked in customers’ driveways, in busy plazas and on the 400-series highways every day. Even simple [vehicle lettering](/satin/vehicle-wraps/lettering/) with your name, service and phone number turns a work van into a moving business card; a [commercial wrap](/satin/vehicle-wraps/commercial/) makes it unmistakable.

Keep the message short: who you are, what you do, and one way to contact you. A phone number or web address should be readable from the next lane. If you’re unsure how much coverage you need, see our guide to [lettering vs partial vs full wraps](/satin/guides/vehicle-lettering-vs-partial-vs-full-wrap/), and our [fleet wrap ROI guide](/satin/guides/fleet-wrap-roi/) shows how to work out whether it pays for itself.'''),
   ('3. Sidewalk signs and flags', '''For street-front shops, cafés and service counters, a sidewalk sign catches people at walking pace. An [A-frame sign](/satin/print-shop/large-format/a-frame-signs/) with interchangeable faces lets you change the offer weekly. [Feather and teardrop flags](/satin/print-shop/large-format/flags/) add height and movement for plazas, grand openings and car lots where your sign is set back from the road.

Many municipalities, including Toronto, regulate signs placed on the public sidewalk or boulevard, and plazas often have their own rules — check before you put anything out in front of the property line.'''),
   ('4. Yard signs and lawn signs', '''If you work at customers’ homes — landscaping, roofing, renovation, painting, pools, real estate — a sign on the lawn during and after the job is seen by the neighbours most likely to need the same service. Ask the homeowner’s permission, keep the sign simple (logo, service, phone or website) and collect it when the job ends. Corrugated plastic [yard signs](/satin/print-shop/large-format/yard-signs/) with H-stakes are reusable; [poly bag lawn signs](/satin/print-shop/large-format/poly-bag-lawn-sign/) are the budget option for large quantities. Our [yard sign guide](/satin/guides/yard-signs-lawn-signs-guide/) covers sizes, prices and local rules.'''),
   ('5. Printed pieces that stay in people’s hands', '''Print still works when it reaches the right people at the right moment.

* **[Business cards](/satin/print-shop/offset/business-cards/)** for every conversation — see our [business card design rules](/satin/guides/business-card-design-tips/).
* **[Door hangers](/satin/print-shop/offset/door-hangers/)** for the streets around a job you’re already working on.
* **[Postcards](/satin/print-shop/offset/postcards/)** for direct mail. Canada Post’s neighbourhood mail service can deliver unaddressed mail to chosen routes; check its current options and rates.
* **[Flyers](/satin/print-shop/offset/flyers/)** for counters, community boards and events.

Give every printed piece a single offer and a way to track it — a dedicated landing page, a promo code or a QR code — so you know what worked.'''),
   ('6. Banners and displays for events', '''Trade shows, community festivals, farmers’ markets and open houses put you in front of hundreds of local people in a day. A [roll-up banner](/satin/print-shop/large-format/roll-up-banner/) sets up in a minute and makes even a folding table look professional; a [vinyl banner](/satin/print-shop/large-format/vinyl-banners/) with grommets works on fences, tents and storefronts for grand openings. See our [roll-up banner and trade show guide](/satin/guides/roll-up-banner-trade-show-guide/) for sizes and design tips.'''),
   ('7. Branded apparel', '''Uniforms do two jobs: customers know who just knocked on the door, and your team advertises the business at the coffee shop, the hardware store and the job site. Branded [T-shirts, hoodies, hats and workwear](/satin/apparel/) are inexpensive per piece and there’s no minimum order at our shop. Our [custom apparel printing guide](/satin/guides/custom-apparel-printing-methods/) explains which decoration method suits which garment.'''),
   ('Measure what works', '''Ask every new customer how they heard about you and write it down. Use a different phone number, landing page or promo code on different channels where you can. Within a few months you’ll know which of the seven is worth doubling down on — and which to drop. If you’d like help putting a plan together, our team can design and produce everything from the van to the business cards under one roof, and our [social media](/satin/social-media-services/) and [website design](/satin/website-design/) services cover the online side.'''),
  ],
  'faqs': [('What is the cheapest way to advertise a local business?', 'A complete Google Business Profile costs nothing. After that, the lowest-cost physical options are usually window decals, vehicle lettering, yard signs and business cards — each is a one-time cost that keeps working.'),
           ('Do I need a permit for a storefront sign in Vaughan or Toronto?', 'Exterior signs often need landlord approval and may need a municipal sign permit; rules differ between municipalities and sign types. Check with your landlord and the city before installing. We can supply drawings for an application.'),
           ('Is vehicle lettering worth it for a small business?', 'For most service businesses, yes: it costs about 22% of a full wrap and puts your name in front of people every day the vehicle is on the road or parked at a job.'),
           ('How do I know which advertising is working?', 'Ask every new customer how they found you, and use separate phone numbers, landing pages or promo codes for different channels where you can.')],
  'links': [('Window graphics', '/satin/window-graphics/'), ('Vehicle lettering', '/satin/vehicle-wraps/lettering/'), ('Large format printing', '/satin/print-shop/large-format/')]},

 # ------------------------------------------------------------------ 4
 {'slug': 'vehicle-lettering-vs-partial-vs-full-wrap', 'cat': 'Pricing',
  'title': 'Vehicle Lettering vs Partial vs Full Wrap | Satin Graphic',
  'h1': 'Vehicle lettering vs partial wrap vs full wrap: which do you need?',
  'desc': 'Lettering, partial, ¾ or full wrap? What each covers, real GTA prices for cars, vans, pickups and box trucks, and how to choose for your business.',
  'lede': 'The four levels of vehicle branding, what each one actually covers, what it costs at our Vaughan shop, and how to pick the right one for your business and budget.',
  'sections': [
   ('The short answer', '''* **Lettering and decals** — name, logo, phone and website on the doors and rear. The lowest cost, about 22% of a full wrap.
* **Partial wrap** — printed graphics over part of the vehicle (often the rear half or the lower sides), blended into the paint colour. About 45% of a full wrap.
* **¾ wrap** — most of the vehicle, usually leaving the hood, roof or front end in the original paint. About 70% of a full wrap.
* **Full wrap** — every painted panel covered, for maximum impact and a completely custom look.

If your vehicle’s paint colour works with your brand and the budget is tight, start with lettering or a partial wrap. If the vehicle is your main advertising, or the paint colour clashes with your brand, a full wrap is usually worth it.'''),
   ('Prices at our shop', '''These are starting prices from our own [wrap estimator](/satin/vehicle-wraps/estimator/), in CAD before HST, using the same coverage percentages as the estimator:

| Vehicle | Lettering (~22%) | Partial (~45%) | ¾ wrap (~70%) | Full wrap |
| Car | <<v_car_l>> | <<v_car_p>> | <<v_car_q>> | <<v_car>> |
| Pickup truck | <<v_pk_l>> | <<v_pk_p>> | <<v_pk_q>> | <<v_pickup>> |
| Transit-size van | <<v_tr_l>> | <<v_tr_p>> | <<v_tr_q>> | <<v_transit>> |
| Box truck | <<v_box_l>> | <<v_box_p>> | <<v_box_q>> | <<v_box>> |

The exact number depends on the vehicle’s size and body, the finish, and how complex the design is. If you need us to create a printed commercial design, our design service is $250 + tax; simple lettering layouts are usually straightforward. Our [car wrap cost guide](/satin/guides/car-wrap-cost-toronto/) explains every factor that moves the price.'''),
   ('Lettering and decals', '''Lettering is cut or printed vinyl applied directly to the paint: your business name, what you do, phone number, website and logo — typically on both front doors, the rear doors or tailgate, and sometimes the hood. It is ideal for:

* Trades and service vans where the vehicle colour is white, black or silver.
* Businesses that need a lot of vehicles branded quickly on a budget.
* Owners who want a simple, professional look rather than a billboard.

The limit is impact: lettering informs people who are already looking at the vehicle, but it rarely stops someone who isn’t. Good lettering is all about readability — large, high-contrast type and a phone number that can be read from the next lane. See [vehicle lettering](/satin/vehicle-wraps/lettering/) for examples.'''),
   ('Partial and ¾ wraps', '''A partial wrap prints a design over a section of the vehicle and blends it into the paint — for example a graphic that sweeps from the rear doors along the lower half of each side. Done well, it looks like a full wrap from many angles for roughly half the price. The design has to be built around the paint colour, so it works best on white, black, silver and grey vehicles, where it’s easy to match.

A ¾ wrap covers most of the body and usually leaves the hood, roof or front bumper in paint. It is a common choice for vans and box trucks where the sides and rear are the advertising and the front is just the front. Both options are printed on the same cast film and laminate as a full wrap, so they last just as long.'''),
   ('Full wraps', '''A full wrap covers every painted panel and lets you choose any background colour, image or pattern. It turns the vehicle into a completely branded object that people remember, and it protects the paint underneath from light scratches and UV fading. It is the best choice when:

* The vehicle is your main advertising, such as food trucks, mobile services and delivery fleets.
* The paint colour clashes with your brand.
* You want photographic imagery or a design that needs every panel.

On box trucks and trailers, the flat sides are effectively billboards; see [box truck wraps](/satin/vehicle-wraps/commercial/box-trucks/) and [trailer wraps](/satin/vehicle-wraps/commercial/trailers/).'''),
   ('How to choose', '''| If… | Consider |
| Budget is tight and the paint is white, black or silver | Lettering or a partial wrap |
| You need to brand several vehicles quickly | Lettering now, upgrade later with the same design |
| The vehicle is your main advertising | ¾ or full wrap |
| The paint colour clashes with your brand | Full wrap |
| You lease the vehicle | Any — film removes cleanly from factory paint (check your lease terms) |
| The vehicle has damaged or repainted panels | Talk to us first — film can lift poor paint on removal |

A design built on your exact vehicle template can grow with you: many fleets start with lettering or a partial wrap and move to full wraps as the business grows, keeping the same layout so every vehicle reads as one company. Our [fleet programs](/satin/vehicle-wraps/commercial/fleet-programs/) keep that template on file.'''),
   ('Rear windows and glass', '''Perforated window film lets a design continue across the rear and rear-side windows while the driver still sees out from inside. Keep the windshield and the front side windows clear, and make sure both outside mirrors are in good working order; our [Ontario window tint law guide](/satin/guides/ontario-window-tint-law/) explains how the rules treat each window. Fine text over glass is hard to read through the perforations, so we keep phone numbers on solid panels.'''),
   ('What every option has in common', '''Whichever level you choose, the work is designed on a template for your exact year, make and model, printed in-house on cast vinyl with a protective laminate, and installed in our climate-controlled bay in Vaughan. Our workmanship warranty covers lifting and peeling for 5 years — see the [warranty](/satin/warranty/) page for details. Typical lifespans are covered in our guide to [how long wraps last in Canadian winters](/satin/guides/wrap-lifespan-canadian-winter/).'''),
  ],
  'faqs': [('How much does van lettering cost?', 'At our shop, lettering and decals on a Transit-size van start at about {v_tr_l} before HST — about 22% of the {v_transit} full-wrap price. The final price depends on size and coverage.'),
           ('Is a partial wrap worth it?', 'Often, yes. A well-designed partial wrap costs about 45% of a full wrap and, on white, black or silver vehicles, can look nearly as striking from the side and rear.'),
           ('What is the difference between a ¾ wrap and a full wrap?', 'A ¾ wrap covers most of the body but usually leaves the hood, roof or front end in the original paint. A full wrap covers every painted panel.'),
           ('Can I upgrade from lettering to a full wrap later?', 'Yes. If the original layout was built on your vehicle template, we can extend the same design into a partial or full wrap.'),
           ('Do decals damage paint?', 'Not factory paint in good condition. Quality vinyl removes cleanly with heat within its rated life. Repainted or damaged panels can lift with the film.')],
  'links': [('Vehicle lettering', '/satin/vehicle-wraps/lettering/'), ('Commercial wraps', '/satin/vehicle-wraps/commercial/'), ('Wrap cost estimator', '/satin/vehicle-wraps/estimator/')]},

 # ------------------------------------------------------------------ 5
 {'slug': 'roll-up-banner-trade-show-guide', 'cat': 'Buying advice',
  'title': 'Roll-Up Banner & Trade Show Display Guide | Satin Graphic',
  'h1': 'Roll-up banners and trade show displays: a buying guide',
  'desc': 'Choosing a roll-up banner or X-frame for trade shows and events: sizes, stands, prices, design that reads across the aisle, and care tips.',
  'lede': 'A good portable display makes a folding table look like a real booth. Here’s how to choose the right size and stand, design it to be read from across the aisle, and keep it looking good show after show.',
  'sections': [
   ('Roll-up, X-frame or something bigger?', '''| | Roll-up (retractable) banner | X-frame banner |
| How it works | Graphic rolls into the base cassette and pulls up onto a pole | Graphic hooks onto the corners of a sprung X-shaped frame |
| Setup | About a minute, no loose parts | A few minutes |
| Sizes at our shop | 33 × 80 in or 47 × 80 in | 24 × 63 in or 32 × 71 in |
| Price at our shop | From <<ru_1>> each (33 × 80 in, standard stand) | From <<xf_1>> each (24 × 63 in, frame included) |
| Best for | Trade shows, lobbies, receptions, repeated use | Budget events, short-term promotions, tight spaces |
| Change the graphic | Replacement graphic installed into the cassette | Very easy — graphic-only orders available |

Both are **indoor products**. Wind tips them over and sun and rain shorten their life, so for outdoor events use [vinyl banners](/satin/print-shop/large-format/vinyl-banners/), [flags](/satin/print-shop/large-format/flags/) or an [A-frame sign](/satin/print-shop/large-format/a-frame-signs/) instead.

For a standard 10 × 10 ft booth, two or three roll-ups side by side create a simple back wall for less than most fabric pop-up displays.'''),
   ('Choosing size and stand', '''**33 × 80 in** is the most common size: it fits behind a 6 ft table, in a hotel ballroom or beside a reception desk, and it’s easy to carry. **47 × 80 in** (<<ru_wide>> more per banner at our shop) gives you about 40% more width for photography or a wider layout and makes a stronger back wall when you only have room for one or two.

The **standard stand** is light and economical — perfect for occasional events. The **premium stand** (<<ru_prem>> more) is the sturdier option, better suited to frequent setup, travel and busy aisles where people brush past. If you’ll use the banner more than a few times a year, or ship it to shows, it’s worth the upgrade — ask us for the current hardware details.

Ordering several? Multiple roll-ups come down to <<ru_2>> each on our configurator, and matching graphics across a set looks far more professional than mixing old and new banners.'''),
   ('Design that works from across the aisle', '''Visitors walk past a booth in a few seconds, usually from 3 to 5 metres away. Design for that distance, not for your monitor.

* **Logo and one message at the top.** The top third of the banner is at eye level and is visible over tables and crowds. Put your logo and a short headline there — what you do, in five to seven words.
* **Nothing important at the bottom.** The lowest part of the banner is hidden behind tables, chairs and people, and a few inches disappear into the base. Use it for colour, a pattern or a background image.
* **Big type.** Headlines should be readable at a distance; as a rough guide, aim for letters several inches tall. If you can’t read it at arm’s length on a printed letter-size mock-up scaled down to 10%, it’s too small.
* **Three or four points, not a brochure.** Lists of 12 services go unread. Put details in a [brochure](/satin/print-shop/offset/brochures/) or on a [flyer](/satin/print-shop/offset/flyers/) on the table.
* **A clear next step.** Website, phone or a QR code at chest height so visitors can scan it.
* **High contrast.** Exhibition halls are lit from above with mixed colour temperatures; low-contrast designs look washed out.'''),
   ('Artwork specs', '''| Spec | Value |
| Final size | 33 × 80 in or 47 × 80 in (X-frame: 24 × 63 or 32 × 71 in) |
| Resolution | 100–150 DPI at final size |
| Scale | Build at 100%, or at 25% with four times the resolution |
| Colour | CMYK; Pantone references for brand colours |
| Fonts | Outlined, and send an editable copy too |
| File types | PDF, AI or EPS; TIFF or JPG at 150 DPI for photos |

We print in-house on a latex large-format press, and every order comes with a digital proof at scale so you can judge how the layout reads before it prints. No designer? Add design to your order (<<design_print>>) and we’ll build the layout from your logo and copy. More file-prep detail is in our [artwork guide](/satin/guides/prepare-artwork-vehicle-wrap-print/).'''),
   ('Planning for a show', '''* **Read the exhibitor manual first.** Venues and organisers set rules on booth height, placement and materials; some ask for flame-retardant certification for display materials. Check before you order.
* **Order early.** Most large-format pieces are ready in 2–5 business days after proof approval, but proofs and revisions take time too — allow at least two weeks before the show.
* **Order the whole booth at once.** Roll-ups, a table throw, [business cards](/satin/print-shop/offset/business-cards/), brochures and [stickers](/satin/print-shop/labels/die-cut-stickers/) printed together match in colour.
* **Bring branded apparel.** Matching [T-shirts or polos](/satin/apparel/) make your team easy to find in a busy hall.'''),
   ('Making a roll-up last', '''* Retract the banner slowly, guiding it with your hand — letting it snap back is the most common way to crease or tear a graphic.
* Keep it in its carry bag and store it at room temperature; avoid leaving it in a hot car in summer or a freezing trailer in winter.
* Wipe the surface with a soft, damp cloth only.
* When your message changes, order a replacement graphic and reuse the stand.'''),
  ],
  'faqs': [('What size roll-up banner should I get?', '33 × 80 in is the standard and fits most tables and spaces. Choose 47 × 80 in if you have room and want a wider layout or a stronger back wall.'),
           ('How much does a roll-up banner cost?', 'At our shop, a 33 × 80 in roll-up with a standard stand starts at {ru_1} before tax, including printing and the stand. Larger size and premium stand are optional upgrades.'),
           ('Can roll-up banners be used outdoors?', 'They are designed for indoor use. Wind tips them over easily. For outdoor events, use vinyl banners, flags or A-frame signs.'),
           ('How long does it take to print a roll-up banner?', 'Most large-format pieces are ready in 2–5 business days after proof approval.'),
           ('Can I replace the graphic and keep the stand?', 'Yes. Replacement graphics are available for roll-ups and X-frames.')],
  'links': [('Roll-up banners', '/satin/print-shop/large-format/roll-up-banner/'), ('X-frame banners', '/satin/print-shop/large-format/x-frame-banner/'), ('Large format printing', '/satin/print-shop/large-format/')]},

 # ------------------------------------------------------------------ 6
 {'slug': 'yard-signs-lawn-signs-guide', 'cat': 'Buying advice',
  'title': 'Yard Signs & Lawn Signs Guide (GTA) | Satin Graphic',
  'h1': 'Coroplast yard signs and lawn signs: sizes, prices and rules',
  'desc': 'Coroplast vs poly bag lawn signs: sizes, single or double-sided, H-stakes, design tips, GTA prices and the local sign rules to check first.',
  'lede': 'Yard signs are one of the cheapest ways to get your name in front of a neighbourhood. Here’s how to choose the right type and size, design one that reads from a moving car, and stay on the right side of local sign rules.',
  'sections': [
   ('Coroplast or poly bag?', '''There are two common kinds of lawn sign:

| | Coroplast (corrugated plastic) yard sign | Poly bag lawn sign |
| What it is | Rigid fluted plastic board, printed in full colour | Printed plastic sleeve that slides over a wire frame |
| Look | Full colour, photos and gradients | One to three spot colours |
| Durability | Rated for 2–3 years outdoors; reusable | Short-term; best for single campaigns |
| Sizes at our shop | 18 × 24 in or 24 × 36 in | 24 × 20 in or 32 × 20 in |
| Best for | Contractors, real estate, events, directional signs | Large runs — elections, community campaigns, promotions |

**Coroplast** is the workhorse: full-colour printing, stiff enough to stay readable in wind, and reusable for job after job. **Poly bag signs** are the budget option when you need hundreds of identical signs for a short period and a simple one- to three-colour design is enough.'''),
   ('Prices at our shop', '''From our online configurators, before tax:

* **Coroplast yard signs (18 × 24 in, single-sided):** <<ys_1>> for one sign, dropping to <<ys_10>> each from 10 and <<ys_25>> each from 25. The 24 × 36 in size adds <<ys_big>> per sign, double-sided printing <<ys_back>>, and an H-stake <<ys_stake>>.
* **Poly bag lawn signs (24 × 20 in, one colour):** about <<pb_50>> each for 50, <<pb_100>> each for 100 and <<pb_1000>> each for 1,000.

There’s no minimum on coroplast signs — one is fine. See [yard signs](/satin/print-shop/large-format/yard-signs/) and [poly bag lawn signs](/satin/print-shop/large-format/poly-bag-lawn-sign/) for the live calculators.'''),
   ('Size, sides and stakes', '''**18 × 24 in** is the standard lawn sign — big enough to read from the street in a residential neighbourhood, small enough to carry a stack in a car. **24 × 36 in** reads from further away and suits corner lots, wider roads, construction sites and open houses.

**Double-sided** printing is worth it whenever the sign stands perpendicular to the road, so drivers see it in both directions. For a sign facing the street flat against a fence, single-sided is enough.

**H-stakes** (wire stakes that slide into the flutes of the coroplast) are the standard way to mount a yard sign in grass. If you’re mounting to a fence, wall or post instead, skip the stakes and ask about grommets or screws.'''),
   ('Design that reads from a moving car', '''A yard sign is usually seen for two or three seconds from a car 10 to 20 metres away. Design accordingly:

* **Five to seven words maximum** — for example, “Kitchen renovation by [Your Company]” plus a phone number or short web address.
* **One contact method,** printed as large as possible. A short, memorable website often works better than a phone number for people who see it while driving.
* **Thick, simple fonts** and strong contrast: dark on light or light on dark. Avoid thin scripts and light colours on white.
* **Big logo, small decoration.** Photos rarely read at a distance on a sign this size.
* **QR codes** only make sense for people on foot — useful for real estate and open houses, less so for signs aimed at traffic.

Artwork should be built at final size at 100–150 DPI, with a 0.25 in bleed for rigid signs. For poly bag signs, vector artwork in one to three solid spot colours works best. If you need help, add design to your order.'''),
   ('Real estate signs', '''Agents use coroplast for open-house and directional signs and often use a 24 × 36 in sign with a rider or a post-mounted panel for listings. A few practical tips:

* Keep the brokerage branding consistent with your board’s and brokerage’s requirements — check your brokerage’s sign policy before printing.
* Directional arrows should be double-sided and huge; the arrow is the message.
* Order a few spares; directional signs disappear.'''),
   ('Rules to check before you stake a sign', '''Where you can put a temporary sign is set by **municipal sign by-laws**, which differ between Vaughan, Toronto, Markham, Mississauga, Brampton and every other GTA municipality. Common themes:

* **Private property:** you generally need the owner’s permission, and some by-laws limit size, number and how long a temporary sign can stay up.
* **Public property:** placing signs on boulevards, medians, road allowances, parks and utility poles is often restricted or prohibited, and municipalities can remove signs placed there.
* **Election signs** follow separate rules on when they can go up and must come down, set by each municipality for municipal elections and also affected by provincial and federal election rules.
* **Sight lines:** never place a sign where it blocks drivers’ view at corners or driveways.

This is general information, not legal advice. Check the current sign by-law on your city’s website or call 311 (where available) before a campaign.'''),
   ('Making signs last', '''Coroplast and the latex inks we print with are rated for 2–3 years outdoors, but most signs are retired long before they fade because they get bent, lost or outdated. Store reusable signs flat and dry, pull stakes straight up to avoid splitting the flutes, and design “evergreen” job-site signs without dates or prices so you can reuse them for years.'''),
  ],
  'faqs': [('What is the standard yard sign size?', '18 × 24 inches. Choose 24 × 36 inches for corner lots, busier roads or when you need to be read from further away.'),
           ('How long do coroplast signs last outside?', 'Printed coroplast signs are rated for about 2–3 years outdoors. Most are retired earlier because they get bent or the message changes.'),
           ('How much do yard signs cost?', 'At our shop, an 18 × 24 in single-sided coroplast sign is {ys_1} for one, falling to {ys_25} each from 25 signs, before tax. Poly bag lawn signs start around {pb_1000} each in quantities of 1,000.'),
           ('Can I put a sign on the boulevard in front of my business?', 'Often not without permission. Boulevards and road allowances are usually public property and are covered by municipal sign by-laws. Check with your city before placing a sign there.'),
           ('Should I choose single- or double-sided?', 'Double-sided if the sign stands perpendicular to the road so drivers see it from both directions; single-sided if it faces the street flat.')],
  'links': [('Yard signs', '/satin/print-shop/large-format/yard-signs/'), ('Poly bag lawn signs', '/satin/print-shop/large-format/poly-bag-lawn-sign/'), ('Large format printing', '/satin/print-shop/large-format/')]},

 # ------------------------------------------------------------------ 7
 {'slug': 'storefront-window-graphics-guide', 'cat': 'Buying advice',
  'title': 'Storefront Window Graphics: Which Film? | Satin Graphic',
  'h1': 'Storefront window graphics: perforated, frosted, decals or full print?',
  'desc': 'Cut decals, perforated one-way vinyl, frosted film or full print? Compare storefront window graphics: prices, lifespan, install and permits.',
  'lede': 'Your windows are the biggest sign you already pay for. Here’s how to choose the right film for each job — advertising, privacy or just your hours on the door — and what it costs.',
  'sections': [
   ('Four films, four jobs', '''| Film | What it does | Price at our shop | Typical life |
| Cut vinyl decals | Single-colour logo, hours, lettering | <<wg_decal>> / sq ft | 5–7 years |
| Perforated (one-way) vinyl | Full-colour image outside, see-through from inside | <<wg_perf>> / sq ft | 2–3 years outdoors |
| Frosted (etched-look) vinyl | Privacy while passing light; cut-out logos | <<wg_frost>> / sq ft | 5–7 years |
| Full printed window graphics | Full-colour opaque or clear print across panes | From <<wg_full>> / sq ft | 2–3 years outdoors, longer inside |

Prices are before tax, with a <<wg_min>> minimum per order; professional installation adds <<wg_inst>> per sq ft. For full window graphics we offer regular printed vinyl (<<wg_full>>), clear film (<<wg_clear>>) and blackout film with grey adhesive (<<wg_black>>) for back-of-house glass that must be completely opaque.'''),
   ('Cut vinyl decals: hours, logo and the essentials', '''Single-colour cut vinyl is the classic storefront door: logo, business name, hours, phone, website and perhaps “Open” and payment symbols. It is crisp, inexpensive, easy to update when hours change, and long-lasting when made from cast vinyl. White reads best on most glass; on a light interior, a dark colour may work better. Cut vinyl needs **vector artwork** — AI, EPS, SVG or PDF with fonts outlined — and no strokes thinner than about 0.1 in. See [window decals](/satin/window-graphics/window-decals/).'''),
   ('Perforated vinyl: advertise without losing the view', '''One-way perforated film is printed on one side and punched with thousands of small holes. From outside, the eye reads the print; from inside, the dark backing disappears and staff and customers can still see out. It is the go-to for storefront campaigns, restaurant windows, gyms and the rear windows of commercial vehicles.

Things to know:

* Visibility from inside is reduced, not perfect — and it’s weaker at night when the interior is brighter than the street.
* Fine text and thin lines break up across the holes. Keep type large and bold.
* Rain can fill the holes and briefly reduce visibility; a laminate on outdoor installs helps.
* It is a shorter-life film than cut vinyl, typically 2–3 years outdoors — ideal for campaigns that change anyway.

See [perforated vinyl](/satin/window-graphics/perforated-vinyl/).'''),
   ('Frosted film: privacy with branding', '''Frosted film gives clear glass an etched or sandblasted look. It blocks the direct view while letting light through, which makes it ideal for clinics, law offices, meeting rooms, washrooms and ground-floor offices facing a parking lot. Popular approaches:

* **An eye-level band** (often roughly 36–60 in from the floor) keeps sightlines open above and below.
* **Full panes** for complete privacy.
* **Negative-space logos, stripes or gradients** cut into the frost, so the privacy layer doubles as branding.

Frosted film is usually installed on the inside of the glass, where it’s protected from weather and cleaning. See [frosted vinyl](/satin/window-graphics/frosted-vinyl/). If you also want heat or glare control, look at [commercial window film](/satin/window-tint/commercial/).'''),
   ('Full window graphics: the whole glass is the sign', '''Printed films can turn a run of panes into one continuous image — a seasonal campaign, a product launch, a “coming soon” takeover for a unit under renovation, or a full brand environment. Use opaque or blackout film where you want to hide what’s behind (storage, kitchens, construction), and clear film where you want the image to float on glass. Every pane is measured and templated so the image lines up across mullions. See [full window graphics](/satin/window-graphics/full-window-graphics/).'''),
   ('Inside or outside the glass?', '''* **Outside (first surface)** gives the crispest read from the street and is standard for opaque decals and perforated film.
* **Inside (second surface, reverse-applied)** protects the graphic from weather, snow-clearing, cleaning crews and vandalism. It is what we recommend for frosted film and long-term lettering.

Some inside installs on double-glazed or low-E glass need care, because dark films can raise the glass temperature in direct sun. We check the glass type before recommending a film.'''),
   ('Permits, landlords and practical limits', '''Most plazas and shopping centres require landlord approval for anything on the glass, and many have design rules about colours, coverage and placement. Municipalities regulate signs too: some sign by-laws distinguish between window signs and exterior signs, and some limit how much of the window can be covered or require a permit. Rules differ between Vaughan, Toronto and other GTA municipalities, so check with your landlord and city before a large install. We can supply drawings for an application.

Also think about safety and operations: keep glass doors visible enough that people don’t walk into them (a band of frost or decals at eye level helps), don’t cover exit signage, and leave staff a clear view of the entrance if that matters for security.'''),
   ('Measuring and ordering', '''Send a straight-on photo of the windows from outside and the width × height of each pane in inches. If you can’t measure, we can scale from a known object — a standard door is usually about 36 in wide — for the estimate, and we confirm measurements on site before anything is cut. We proof the design on a photo of your actual window, to scale, so you can judge the size of the lettering and the sightlines. Most glass jobs install in half a day, and storefronts are usually done before opening hours. Need help with the layout? Our [artwork guide](/satin/guides/prepare-artwork-vehicle-wrap-print/) covers file prep, and design can be added to any order.'''),
  ],
  'faqs': [('What is the best window film for storefront advertising?', 'Perforated one-way vinyl for full-colour images that you can still see out through, cut vinyl decals for logos and hours, and full printed graphics for short campaigns or opaque coverage.'),
           ('Can you see through perforated window film?', 'Yes, from inside — the view is slightly darker, like looking through a screen. From outside, people see the printed image. Visibility through it is reduced at night when the inside is brighter.'),
           ('How much do storefront window graphics cost?', 'At our shop, before tax: cut decals {wg_decal} per sq ft, perforated vinyl {wg_perf}, frosted film {wg_frost} and printed window graphics from {wg_full}, with a {wg_min} minimum. Installation is {wg_inst} per sq ft.'),
           ('Do I need a permit for window graphics in Vaughan or Toronto?', 'It depends on the municipality, the size and whether the sign is inside or outside the glass. Always check with your landlord and the city before a large install.'),
           ('Will window vinyl damage the glass?', 'No. Quality films remove cleanly from glass with heat within their rated life.')],
  'links': [('Window graphics', '/satin/window-graphics/'), ('Perforated vinyl', '/satin/window-graphics/perforated-vinyl/'), ('Frosted vinyl', '/satin/window-graphics/frosted-vinyl/')]},

 # ------------------------------------------------------------------ 8
 {'slug': 'custom-apparel-printing-methods', 'cat': 'Buying advice',
  'title': 'DTF vs Vinyl vs Embroidery vs Screen Print | Satin Graphic',
  'h1': 'Custom apparel printing: DTF vs vinyl vs embroidery vs screen print',
  'desc': 'DTF, heat-transfer vinyl, embroidery or screen print? Compare custom apparel methods on look, durability, minimums and cost for shirts and hats.',
  'lede': 'The decoration method matters as much as the garment. Here’s how DTF, heat-transfer vinyl, embroidery and screen printing compare — and which one to choose for team shirts, uniforms, merch and hats.',
  'sections': [
   ('The short answer', '''* **DTF (direct-to-film)** — full-colour designs, photos and gradients on almost any fabric, with no minimum. The best all-rounder for small and medium runs.
* **Heat-transfer vinyl (HTV)** — solid-colour logos, names and numbers. Clean and durable for simple designs.
* **Embroidery** — stitched logos for hats, polos, jackets and workwear. The most premium and long-lasting look.
* **Screen printing** — economical for large runs of simple, few-colour designs, but with set-up costs per colour.

Our [apparel shop](/satin/apparel/) offers DTF and vinyl heat press on T-shirts, hoodies, sweatshirts and workwear, and embroidery on hats and polos. There’s no minimum order, and orders of more than 20 pieces get 5% off.'''),
   ('Side-by-side', '''| | DTF | Heat-transfer vinyl | Embroidery | Screen print |
| Colours | Unlimited, including photos and gradients | One per layer; best for 1–2 colours | Thread colours; limited fine detail | One screen per colour |
| Minimum | None | None | Small runs possible; logos are digitized once | Set-up makes small runs expensive |
| Feel | Thin, flexible film on the fabric | Smooth, slightly thicker layer | Raised stitching | Ink in the fabric; very soft with water-based inks |
| Fabrics | Cotton, polyester, blends, nylon and more | Most fabrics with the right vinyl | Thicker fabrics: polos, caps, jackets, fleece | Cotton and blends; others with special inks |
| Best for | Full-colour logos, events, small teams, merch | Names, numbers, simple logos | Uniforms, hats, corporate wear | Large runs of the same simple design |'''),
   ('DTF: full colour without minimums', '''With DTF, the design is printed in full colour plus a white base layer onto a special film, coated with a hot-melt adhesive powder and cured. The transfer is then heat-pressed onto the garment. Because it’s printed digitally, a 12-colour logo or a photo costs the same to produce as a one-colour logo, and there are no screens to set up — one shirt or a hundred.

DTF works on cotton, polyester and blends, and on dark garments as well as light ones, which makes it the most versatile method for mixed orders. The print sits on top of the fabric as a thin, flexible layer; large solid areas feel heavier than small logos, so designs with some open space feel more comfortable on big prints.

If you have your own heat press, you can order **DTF transfers** on their own: at our shop they’re priced by area at <<dtf_sqin>> per square inch (a 10 × 10 in transfer is <<dtf_10>>), with a <<dtf_min>> minimum per transfer and optional pre-cutting at <<dtf_cut>> each. Gang sheets let you fit many logos on one sheet. See [custom DTF transfers](/satin/shop/dtf-transfers/).'''),
   ('Heat-transfer vinyl: names, numbers and simple logos', '''HTV is cut from sheets of solid-colour vinyl, the excess is weeded away, and the design is heat-pressed onto the garment. It gives very clean edges and vivid solid colours, which is perfect for sports names and numbers, staff names on the back of uniforms and simple one- or two-colour logos. It is less suited to complex, multi-colour artwork, fine detail or gradients — that’s where DTF wins.'''),
   ('Embroidery: the premium, long-lasting choice', '''Embroidery stitches the design directly into the fabric with thread. It has texture, looks premium and survives years of industrial washing, which is why it is the standard for corporate polos, caps, jackets and workwear. Things to plan for:

* **Detail is limited by thread.** Very small text and fine lines don’t stitch well; simplify the logo for small placements such as a left chest or a cap front.
* **Colours are matched to thread,** so gradients and photos are not suitable.
* **Fabric weight matters.** Embroidery suits structured caps, piqué polos, fleece and canvas better than thin T-shirts.

At our shop, embroidery is available on [hats](/satin/apparel/hats/) and polos.'''),
   ('Screen printing: when the run is big and the design is simple', '''Screen printing pushes ink through a mesh stencil, one screen per colour. Once the screens are made, each additional print is quick and inexpensive, and with good inks the result is soft and very durable. The catch is set-up: each colour needs its own screen, so short runs and multi-colour designs are expensive per piece, and changing a design means new screens.

Screen printing isn’t one of the options in our online apparel configurator. If you’re planning a very large run of a simple design, ask us and we’ll tell you honestly which method makes more sense.'''),
   ('Choosing for common jobs', '''| Job | Our usual recommendation |
| Staff T-shirts and hoodies with a full-colour logo | DTF |
| Sports team jerseys with names and numbers | Heat-transfer vinyl (or DTF for multi-colour) |
| Corporate polos and caps | Embroidery |
| One-off event or family-reunion shirts | DTF |
| Hi-vis and workwear for trades crews | DTF or vinyl, depending on the fabric |
| Merch for resale with photo artwork | DTF |
| Thousands of identical one-colour shirts | Ask about screen printing |'''),
   ('Artwork and care', '''For DTF, send a transparent PNG at 300 DPI at printed size, or vector artwork (SVG, AI, EPS or PDF). For vinyl and embroidery, vector artwork is best. Typical placements are a left chest logo about 3–4 in wide and a full front or back print up to about 12 in wide on adult sizes. If you need help, add design to your order — <<dtf_design>> on apparel at our shop.

To make any decorated garment last: wash inside out in cold or warm water, avoid bleach and fabric softener, tumble dry low or hang to dry, and never iron directly on a print. Follow the care instructions for the specific garment, too — the fabric often wears out before a good print does.'''),
  ],
  'faqs': [('What is the difference between DTF and screen printing?', 'DTF prints a full-colour transfer digitally and heat-presses it onto the garment, with no set-up per colour and no minimums. Screen printing uses one screen per colour, which is economical for large runs of simple designs but expensive for small or multi-colour orders.'),
           ('How long does DTF printing last?', 'A quality DTF transfer, properly pressed and washed inside out in cool water, typically lasts many dozens of washes. Hot washes, harsh detergents and high dryer heat shorten its life.'),
           ('Is embroidery better than printing?', 'For hats, polos, jackets and corporate wear, embroidery looks more premium and lasts longer. For full-colour designs, photos or thin T-shirts, printing is the better choice.'),
           ('Is there a minimum order for custom shirts?', 'Not at our shop. You can order a single shirt, and orders of more than 20 pieces get 5% off.'),
           ('Can I buy DTF transfers to press myself?', 'Yes. Order custom DTF transfers by size or as a gang sheet, priced by area.')],
  'links': [('Custom apparel', '/satin/apparel/'), ('Custom DTF transfers', '/satin/shop/dtf-transfers/'), ('Hats', '/satin/apparel/hats/')]},
]

# FAQ answers use {key} (not <<key>>) because they are written as plain strings; resolve both here.
P['wp_eg'] = f"${round(96 * float(P['wp_flat'].strip('$').replace(',', ''))):,}"
def _sub_all(t):
    t = _sub(t)
    if isinstance(t, str): return re.sub(r'\{(\w+)\}', lambda m: P.get(m.group(1), m.group(0)), t)
    if isinstance(t, tuple): return tuple(_sub_all(x) for x in t)
    if isinstance(t, list): return [_sub_all(x) for x in t]
    if isinstance(t, dict): return {k: _sub_all(v) for k, v in t.items()}
    return t
GUIDES_EXTRA = [_sub_all(g) for g in _GUIDES]
for _g in GUIDES_EXTRA:      # nothing left for seo_pass.fmt() to trip over
    _blob = json.dumps(_g, ensure_ascii=False)
    assert '<<' not in _blob and not re.search(r'\{\w+\}', _blob), _g['slug']

# Optional hooks for seo_pass.py (see module docstring)
GUIDE_IMG_EXTRA = {
 'business-card-design-tips': ('/satin/img/pr-bc-1.jpg', 'Printed business cards on a desk'),
 'wall-mural-wallpaper-materials': ('/satin/img/mu-office-leaves.jpg', 'Custom printed wall mural in an office'),
 'make-local-business-visible': ('/satin/img/show-van-1.jpg', 'A branded service van parked outside a business'),
 'vehicle-lettering-vs-partial-vs-full-wrap': ('/satin/img/dec-sprinter.jpg', 'Commercial lettering on a Sprinter van'),
 'roll-up-banner-trade-show-guide': ('/satin/img/pr-rollup.jpg', 'Retractable roll-up banner display'),
 'yard-signs-lawn-signs-guide': ('/satin/img/pr-yard-sign.jpg', 'Printed coroplast yard sign on H-stakes'),
 'storefront-window-graphics-guide': ('/satin/img/office-glass.jpg', 'Frosted vinyl graphics on office glass'),
 'custom-apparel-printing-methods': ('/satin/img/satin-shirt.png', 'Custom printed T-shirt with a logo'),
}
GUIDE_LINKS_EXTRA = {   # service page -> guide slugs to add to its "Helpful reading" block
 '/satin/print-shop/offset/business-cards': ['business-card-design-tips', 'prepare-artwork-vehicle-wrap-print'],
 '/satin/print-shop/offset': ['business-card-design-tips', 'make-local-business-visible'],
 '/satin/print-shop': ['business-card-design-tips', 'roll-up-banner-trade-show-guide', 'yard-signs-lawn-signs-guide'],
 '/satin/print-shop/large-format': ['roll-up-banner-trade-show-guide', 'yard-signs-lawn-signs-guide', 'make-local-business-visible'],
 '/satin/print-shop/large-format/roll-up-banner': ['roll-up-banner-trade-show-guide'],
 '/satin/print-shop/large-format/x-frame-banner': ['roll-up-banner-trade-show-guide'],
 '/satin/print-shop/large-format/yard-signs': ['yard-signs-lawn-signs-guide'],
 '/satin/print-shop/large-format/poly-bag-lawn-sign': ['yard-signs-lawn-signs-guide'],
 '/satin/wallpaper': ['wall-mural-wallpaper-materials'],
 '/satin/wallpaper/custom': ['wall-mural-wallpaper-materials'],
 '/satin/window-graphics': ['storefront-window-graphics-guide', 'make-local-business-visible'],
 '/satin/window-graphics/perforated-vinyl': ['storefront-window-graphics-guide'],
 '/satin/window-graphics/frosted-vinyl': ['storefront-window-graphics-guide'],
 '/satin/window-graphics/window-decals': ['storefront-window-graphics-guide'],
 '/satin/window-graphics/full-window-graphics': ['storefront-window-graphics-guide'],
 '/satin/apparel': ['custom-apparel-printing-methods'],
 '/satin/shop/dtf-transfers': ['custom-apparel-printing-methods'],
 '/satin/vehicle-wraps/lettering': ['vehicle-lettering-vs-partial-vs-full-wrap'],
 '/satin/vehicle-wraps/commercial': ['vehicle-lettering-vs-partial-vs-full-wrap'],
 '/satin/vehicle-wraps/estimator': ['vehicle-lettering-vs-partial-vs-full-wrap'],
}
# Old Wix blog posts -> new guides (for data/old-site-redirects.json)
OLD_POST_REDIRECTS = {
 '/post/how-to-design-a-business-card-13-golden-rules': '/satin/guides/business-card-design-tips/',
 '/post/which-wall-mural-material-should-i-choose': '/satin/guides/wall-mural-wallpaper-materials/',
 '/post/7-ways-to-make-your-business-visible': '/satin/guides/make-local-business-visible/',
}
