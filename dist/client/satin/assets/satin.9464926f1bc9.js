(async()=>{
const [{DICT:STUDIO_TRANSLATIONS,observeTranslations},{transparentImages},serviceUI,pricingForms,{replaceConfig}]=await Promise.all([import('/studio/i18n.mjs'),import('/transparent-images.mjs'),import('/services-ui.mjs'),import('/studio/calculator.mjs'),import('/pricing-form.mjs')]);
await serviceUI.loadServices();
const {menuHTML}=await import('/site-navigation.mjs');
let contentGeneration=0;
if(!document.querySelector('[href="/cms/portfolio.css"]')){const c=document.createElement('link');c.rel='stylesheet';c.href='/cms/portfolio.css';document.head.append(c);}
const {portfolioPage,portfolioSEO,mountPortfolio}=await import('/cms/portfolio.mjs');
const LOGO = "/satin/img/logo.png";
/* ============ SITE DATA — edit content here ============ */
const SITE = {
  name: "Satin Graphic",
  base: "/satin",
  origin: "https://satin-graphic-website.mehrad-tr.chatgpt.site",
  languages: [{ code: "en", locale: "en-CA", name: "English", dir: "ltr" }, { code: "fr", locale: "fr-CA", name: "Français", dir: "ltr" }, { code: "es", locale: "es", name: "Español", dir: "ltr" }, { code: "fa", locale: "fa", name: "فارسی", dir: "rtl" }],
  address: "50 Viceroy Rd, Unit 22–23",
  region: "ON",
  country: "CA",
  phone: "(905) 962-6222",
  email: "info@satingraphic.ca",
  city: "Vaughan, Ontario",
  area: "Serving the Greater Toronto Area — shop visits by appointment.",
  hours: [["Mon – Fri", "8:00 – 18:00"], ["Saturday", "9:00 – 15:00"], ["Sunday", "Closed"]],
};

const MATERIAL_BRANDS = [
  ["3M", "IJ180 wrap film · 8518 laminate"], 
   ["XPEL", "Paint protection film"], ["LLumar", "Ceramic & carbon window film"], ["Oracal", "Cut vinyl & decals"],
];

const SERVICES = [
  { key: "wraps", photo: "job-greenlife-van", name: "Vehicle Wraps", path: "/vehicle-wraps", art: "fleet", blurb: "Commercial fleets, colour-change and PPF, installed in-house." },
  { key: "print", photo: "pr-bc-1", name: "Print Shop", path: "/print-shop", art: "print", blurb: "Business cards to building-sized banners, printed on site." },
  { key: "apparel", name: "Apparel", path: "/apparel", art: "apparel", blurb: "DTF and Vinyl Heat Press; embroidery on caps and polos on shirts, hoodies and workwear." },
  { key: "glass", photo: "office-glass", name: "Window Graphics", path: "/window-graphics", art: "glass", blurb: "Decals, frosted privacy film and full storefront takeovers." },
  { key: "wall", photo: "mu-tropical-living", name: "Wallpaper", path: "/wallpaper", art: "wall", blurb: "Custom murals and patterns for homes and offices." },
  { key: "tint", photo: "install-tint", name: "Window Tint", path: "/window-tint", art: "tint", blurb: "Ceramic, carbon and dyed film for vehicles and buildings." },
];

/* ---------- portfolio ---------- */
const WORK = {
  home: [["12-Van Delivery Fleet Refresh", "Fleet Wrap"], ["Satin Slate Full Wrap — F-150", "Color Change"], ["Frosted Privacy Film, Corner Office", "Window Graphics"], ["Trade Show Booth & Collateral Set", "Print"], ["150-Piece Crew Uniform Rollout", "Apparel"], ["Reception Mural, Tech Startup HQ", "Wallpaper"]],
  about: [["12-Van Delivery Fleet Refresh", "Fleet Wrap"], ["Satin Slate Full Wrap — F-150", "Color Change"], ["Frosted Privacy Film, Corner Office", "Window Graphics"], ["Trade Show Booth & Collateral Set", "Print"], ["150-Piece Crew Uniform Rollout", "Apparel"], ["Reception Mural, Tech Startup HQ", "Wallpaper"], ["Full-Vehicle PPF, GT Coupe", "PPF"], ["Ceramic Tint, Corporate Sedan Fleet", "Window Tint"], ["26-Unit Cargo Van Rebrand", "Fleet Wrap"]],
  fleet: [["12-Van Delivery Fleet Refresh", "Fleet Wrap"], ["26-Unit Cargo Van Rebrand", "Fleet Wrap"], ["HVAC service fleet, full wrap", "Fleet Wrap"], ["Plumbing van, ¾ wrap + decals", "Fleet Wrap"], ["Landscaping crew trucks", "Fleet Wrap"], ["Electrical contractor, partial wrap", "Fleet Wrap"]],
  color: [["Satin Slate Full Wrap — F-150", "Color Change"], ["Full-Vehicle PPF, GT Coupe", "PPF"], ["Satin dark grey, SUV", "Color Change"], ["Gloss midnight blue, sedan", "Color Change"], ["Colour-flip, coupe", "Color Change"], ["Matte black roof & hood", "Color Change"]],
  ppf: [["Satin Slate Full Wrap — F-150", "Color Change"], ["Full-Vehicle PPF, GT Coupe", "PPF"], ["Full-front PPF, new SUV", "PPF"], ["Track pack, sports sedan", "PPF"], ["Matte PPF full body", "PPF"], ["Headlight & mirror film", "PPF"]],
  estimate: [["12-Van Delivery Fleet Refresh", "Fleet Wrap"], ["Satin Slate Full Wrap — F-150", "Color Change"], ["26-Unit Cargo Van Rebrand", "Fleet Wrap"], ["Satin black full wrap", "Color Change"], ["Contractor pickup, partial wrap", "Fleet Wrap"], ["Delivery van, full wrap", "Fleet Wrap"]],
  offset: [["Trade Show Booth & Collateral Set", "Print"], ["Soft-touch business cards, real estate", "Print"], ["Tri-fold brochures, dental clinic", "Print"], ["Event flyers, 5,000-piece run", "Print"], ["Postcards for a direct-mail campaign", "Print"], ["Door hangers, home services", "Print"]],
  large: [["Trade Show Booth & Collateral Set", "Print"], ["Trade show roll-ups, three-set", "Large Format"], ["Grand-opening vinyl banner", "Large Format"], ["Real estate yard signs, 200 pcs", "Large Format"], ["Feather flags, car dealership", "Large Format"], ["Café A-frame, double-sided", "Large Format"]],
  apparel: [["150-Piece Crew Uniform Rollout", "Apparel"], ["Embroidered polos, property management", "Apparel"], ["Screen-printed event tees, 500 pcs", "Apparel"], ["Safety-green workwear with reflective print", "Apparel"], ["Hoodies with DTF full-front", "Apparel"], ["Embroidered caps, landscaping crew", "Apparel"]],
  glass: [["Frosted Privacy Film, Corner Office", "Window Graphics"], ["Storefront hours & logo decals", "Window Graphics"], ["Frosted band, law office boardroom", "Window Graphics"], ["Perforated campaign, full storefront", "Window Graphics"], ["Full-colour print, clinic partitions", "Window Graphics"], ["Reverse-cut lettering, café door", "Window Graphics"]],
  tint: [["Ceramic Tint, Corporate Sedan Fleet", "Window Tint"], ["Ceramic 35%, family SUV", "Window Tint"], ["Carbon 20%, pickup fleet", "Window Tint"], ["Solar film, west-facing office", "Window Tint"], ["Frosted privacy, boardroom", "Window Tint"], ["Security film, retail storefront", "Window Tint"]],
  wall: [["Reception Mural, Tech Startup HQ", "Wallpaper"], ["Wordmark mural, tech reception", "Wallpaper"], ["Botanical pattern, nursery", "Wallpaper"], ["Blueprint grid, meeting room", "Wallpaper"], ["Photo mural, restaurant feature wall", "Wallpaper"], ["Textured neutral, hotel corridor", "Wallpaper"]],
  design: [["Fleet identity, HVAC contractor", "Vehicle wrap design"], ["Logo & brand kit, landscaping", "Logo design"], ["Tri-fold brochure, dental clinic", "Print design"], ["Storefront window layout, café", "Window graphics design"], ["Crew uniform artwork", "Apparel design"], ["Trade-show banner set", "Banner design"]],
  web: [["HVAC contractor — Business site", "Website"], ["Landscaping — Starter site", "Website"], ["Boutique retailer — E-commerce", "Website"], ["Dental clinic — Booking system", "Website"], ["Food truck — Menu & locations", "Website"], ["Auto detailer — Quote estimator", "Website"]],
};
const HOME_STRIP = [["job-greenlife-van", "GreenLife · full van wrap"], ["job-tesla-flip", "Tesla Model Y · colour-flip"], ["job-red-van", "Ideal Air Systems · van wrap"], ["job-subaru-matte", "SUV · matte colour change"], ["job-icecream-van", "Ice cream truck · full wrap"], ["job-fence-pickup", "FenceIt.ca · pickup wrap"], ["job-merc-green", "Mercedes SLK · satin green"], ["job-mx-van", "M&X Electrical · van lettering"], ["job-beetle-flip", "VW Beetle · colour-flip"], ["job-camaro", "Camaro · custom wrap"]];
/* Real photos per category (img/<name>.jpg) — swap names here to update the site */
const CAT_PHOTOS = {
  "Fleet Wrap": ["job-greenlife-van", "job-red-van", "job-mx-van", "job-icecream-van", "job-fence-pickup", "job-van-2", "show-van-1"],
  "Color Change": ["job-tesla-flip", "job-subaru-matte", "job-merc-green", "job-beetle-flip", "job-camaro", "cc-audi-green"],
  "PPF": ["install-ppf", "ppf-audi-1", "reflection", "ppf-audi-3", "detail-hand", "install-detail"],
  "Window Graphics": ["office-glass", "floor-graphic", "wall-restaurant"],
  "Print": ["pr-brochure", "pr-bc-black", "pr-booklet", "pr-flyer", "pr-postcard", "pr-doorhanger"],
  "Large Format": ["pr-backdrop", "pr-rollup", "pr-vinyl-banner", "pr-yard-sign", "pr-flag-feather", "pr-aframe"],
  "Wallpaper": ["mu-custom-office", "mu-office-workhard", "mu-nursery", "mu-blueprint-living", "mu-restaurant", "wall-restaurant"],
  "Window Tint": ["install-tint", "tint-1", "tint-levels", "tint-3", "office-glass", "reflection"],
  "Website": ["web-1", "web-wrap", "web-3", "web-4", "web-5", "web-6"],
  "General": ["show-van-1", "show-van-2", "show-trailer"],
  "Vehicle wrap design": ["show-van-3"], "Logo design": ["pr-stickers"], "Print design": ["pr-brochure-2"], "Window graphics design": ["office-glass"], "Banner design": ["pr-vinyl-banner-2"],
};
/* Estimator / commercial vehicle photos: bare, decals, wrapped */
const VEH_PHOTOS = {
  sedan: ["sedan-bare", "dec-sedan", "sedan-wrapped"], suv: ["suv-bare", "dec-suv", "suv-wrapped"], pickup: ["pickup-bare", "dec-pickup", "pickup-wrapped"],
  minivan: ["van-bare", "dec-smallvan", "van-wrapped"], van: ["sprinter-bare", "dec-sprinter", "sprinter-wrapped"], fullsuv: ["suv-full-bare", "dec-suv-full", "suv-full-wrapped"],
};
const CAT_ART = { "Fleet Wrap": "fleet", "Color Change": "color", "PPF": "ppf", "Window Graphics": "glass", "Print": "print", "Large Format": "banner", "Apparel": "apparel", "Wallpaper": "wall", "Window Tint": "tint", "Website": "web", "General": "fleet" };

const TESTIMONIALS = [
  { q: "Every van in our fleet matches down to the finish. Install ran overnight so we never lost a route.", who: "Operations Lead", org: "Regional Delivery Fleet", svc: "Vehicle Wraps" },
  { q: "We sent one file and had a colour-accurate proof back in hours. The satin finish looks better than the factory paint.", who: "Owner", org: "Independent Auto Detailer", svc: "Vehicle Wraps" },
  { q: "They handled our signage, cards and event banners from one order — one invoice, one point of contact.", who: "Marketing Coordinator", org: "Regional Construction Co.", svc: "Print Shop" },
  { q: "The frosted film cut our reception glare and gave us privacy without losing natural light.", who: "Office Manager", org: "Professional Services Firm", svc: "Window Graphics" },
];

/* ---------- processes ---------- */
const PROCESS = {
  wrap: [["Consult & measure", "We confirm the vehicle, year and trim, then measure or template every panel we’ll cover."], ["Design & proof", "Your artwork goes onto a to-scale vehicle template. You approve a proof before print."], ["Print & laminate", "Printed in-house on cast wrap film and sealed under a matching laminate for UV and abrasion."], ["Prep & install", "The vehicle is decontaminated, then wrapped panel by panel in a climate-controlled bay."], ["Post-heat & inspect", "Edges and recesses are post-heated to lock the film, then the whole vehicle is inspected."]],
  ppf: [["Paint correction", "New vehicles get a decontamination wash; used ones get a light polish so defects aren’t sealed under the film."], ["Pattern cut", "Film is plotter-cut to your exact year / trim so panel edges are wrapped, not trimmed on paint."], ["Install", "Applied wet in a dust-controlled bay; edges tucked; film squeegeed and heat-set."], ["Cure & inspect", "48 hours to cure. Any moisture pockets clear on their own within a week."]],
  print: [["Start from the template", "Set up your document at the final size with the bleed and safe area shown in the table."], ["Work in CMYK at 300 DPI", "Convert RGB images before export; anything under 150 DPI at print size will look soft."], ["Outline fonts, embed images", "Or send the fonts along. Linked images that aren’t embedded arrive as grey boxes."], ["Export a print-ready PDF", "PDF/X-1a or “High Quality Print” with crop marks and bleed. Single pages, not spreads."], ["We proof before we print", "You’ll get a digital proof to approve. Nothing goes to press until you sign off."]],
  apparel: [["Send your logo", "Vector (AI, EPS, SVG, PDF) if you have it; a high-res PNG works for DTF."], ["Pick garment, colour and placement", "Use the customizer, or tell us and we’ll set it up."], ["Approve the mockup", "We send a proof with the print sized in inches on the garment colour you chose."], ["Production", "5–7 business days for most orders; rush on request."]],
  glass: [["Measure the glass", "Width and height of each pane, plus a photo of the window from outside. We confirm on site."], ["Send vector artwork", "Logos and lettering as AI, EPS, SVG or PDF with fonts outlined — cut vinyl can’t use a JPG."], ["Approve the proof", "We show the graphic on your window photo, to scale, so you see the sightline before it’s cut."], ["Production & install", "Most glass jobs install in half a day; storefronts are usually done before opening hours."]],
  tintV: [["Pick the tier", "Compare heat rejection, UV block and glare reduction in the film table on the tint hub."], ["Confirm the glass", "Body style and which windows — the estimator handles it."], ["Book the install", "Most vehicles are done in 2–4 hours while you wait."], ["Cure & enjoy", "Leave the glass alone for a few days; the film settles fully within a week."]],
  tintC: [["Pick the tier", "Compare heat rejection, UV block and glare reduction in the film table on the tint hub."], ["Confirm the glass", "Send pane count and sizes or book a free site measure."], ["Book the install", "Scheduled around your hours; no downtime for staff."], ["Cure & enjoy", "Leave the glass alone for a few days; the film settles fully within a week."]],
  wall: [["Measure & photograph", "Send dimensions and a photo; the calculator on this page prices it live."], ["Choose a pattern or upload", "Pattern library, your own artwork, or a design brief for our team."], ["Approve the wall proof", "We show the artwork scaled on your wall photo before printing."], ["Print & install", "Numbered panels; installed by us or shipped with instructions."]],
  design: [["Brief & deposit", "Fill in the form above with your files and notes."], ["Concepts", "You receive the concepts included in your package."], ["Revisions", "Pick a direction; we refine within the revision allowance."], ["Files", "Final approval, then print-ready and source files — or straight into production with us."]],
  wrapDesign: [["Choose the design", "Pick the layout, then the purchase option below."], ["Send vehicle & branding", "We template it to your vehicle and drop in your logo and details."], ["Approve the mockup", "A to-scale mockup on your vehicle outline, with two rounds of tweaks."], ["Files or install", "Download the files, or book the wrap with us and the file fee is credited."]],
  web: [["Discovery", "A short call about your customers, your services and what the site has to do."], ["Design", "Homepage concept for approval, then the remaining pages."], ["Build & content", "We build while you (or we) finish the copy and photos."], ["Review & launch", "You review on a staging link; we launch and hand over training."]],
};

/* ---------- FAQ ---------- */
const FAQ = {
  general: { name: "General", items: [
    ["How do I get a quote?", "Use the estimator on any product page, add configured items to the quote cart, or hit “Get a Quote” anywhere on the site. Tell us what you need and we reply within one business day with a firm price."],
    ["Where are you located and what are your hours?", "We are in Vaughan, Ontario, serving the Greater Toronto Area. Monday to Friday 8:00–18:00, Saturday 9:00–15:00, closed Sunday. Shop visits are by appointment so the right person is available."],
    ["Do you offer design services?", "Yes — an in-house team designs wraps, print, apparel, window graphics and websites. Design deposits are credited to production when you go ahead."],
    ["Can I pay online?", "Quotes are confirmed by email and paid by Interac e-Transfer, credit card or cheque. Online checkout is coming; for now every order is a quote so we can check the artwork first."],
    ["Do you ship?", "Pickup in Vaughan is free; we ship print and apparel across Canada by courier and install wraps, tint, glass and wall graphics across the GTA."],
    ["What warranty do you offer?", "Five years on wrap workmanship, ten on PPF film, lifetime on tint film, and reprints for any print job that doesn’t match its approved proof. The full terms are on the Warranty page."]]},
  wraps: { name: "Vehicle wraps", items: [
    ["How long does a van wrap last?", "With cast film and laminate, expect 5–7 years on vertical panels in Ontario weather. Horizontal surfaces (hood and roof) see more sun and typically run 3–5 years. Our workmanship warranty covers lifting and peeling for 5 years."],
    ["Will the wrap damage the paint?", "No — on factory OEM paint the film removes cleanly and actually protects the finish underneath. Repainted or damaged panels can lift with the wrap, which we flag during the inspection before we quote."],
    ["Can I wrap only part of the vehicle?", "Yes. Decals and lettering, a partial wrap, a half / ¾ wrap and a full wrap are all priced separately — the coverage cards above show the split. Partial wraps are designed so the vehicle’s own colour becomes part of the layout."],
    ["Do you handle the design?", "We do. Our in-house team builds the layout on your vehicle’s template for a $250 design deposit that’s credited to the wrap when you proceed. If you already have artwork, send it and we’ll proof it at scale."],
    ["How do I look after it?", "Hand wash with a mild automotive soap, keep pressure washers at least 60 cm from edges, and skip wax on matte or satin finishes. We send a care sheet with every install."],
    ["What about multiple vehicles?", "Fleet pricing kicks in at three or more vehicles and includes a brand template so every new vehicle you add matches the last one exactly."],
    ["Do you wrap the roof of a van?", "Rarely — it’s not visible from the street, so most fleet wraps stop at the roofline. If your vans park under office windows or in a downtown core, a roof panel with your logo is a cheap add-on."]]},
  estimator: { name: "Wrap price estimator", items: [
    ["How accurate is the online estimate?", "Usually within 10–15% of the final quote. The vehicle-specific questions on this page (roof height, cab size, box length) are exactly what drives the film count, so answer them as best you can."],
    ["Does the price include design?", "Basic layout of supplied artwork is included. Fully custom design is a $250 deposit that comes off the wrap price when you go ahead."],
    ["Why does the finish change the price?", "Matte, satin and especially chrome / colour-flip films cost more per metre and take longer to install cleanly. Gloss is the baseline."],
    ["Can I get a firm quote without visiting?", "Send us photos of all four sides and a clear shot of any damage. For most vehicles that’s enough to firm the number up; we confirm on drop-off."],
    ["How long will my vehicle be off the road?", "Sedans and SUVs are usually one day; vans and pickups one to two; box trucks, trailers and buses two to three depending on coverage."]]},
  color: { name: "Colour change", items: [
    ["Does a colour-change wrap hurt resale value?", "The opposite, usually — the film has been protecting the original paint, and it comes off cleanly on OEM finishes. Many owners remove it before sale to reveal a like-new finish."],
    ["How long does the colour last?", "Gloss films run 5–7 years; matte and satin 3–5 years; chrome and colour-flip 2–3 years on horizontal surfaces. All of them longer if the vehicle is garaged."],
    ["Can you match a specific paint colour?", "We can get close with the standard ranges, and printed colour-change film lets us hit an exact swatch when a close match isn’t enough."],
    ["Are door jambs included?", "Not by default. Most customers skip them; if you want a full match with the doors open, add jambs and we’ll quote the extra labour."],
    ["Can I take it through a car wash?", "Touchless washes are fine. Brush washes will eventually scuff the film, especially matte and satin — hand washing is best."]]},
  ppf: { name: "Paint protection film", items: [
    ["Can you see the film?", "On a properly installed job, no — the edges are wrapped around panel edges and the film is optically clear. A close look at the hood may show a faint edge line on partial-front packages, which is why many customers choose full-hood coverage."],
    ["How long does PPF last?", "XPEL Ultimate Plus carries a 10-year manufacturer warranty against yellowing, cracking and delamination. Most installs outlast that."],
    ["Does it yellow?", "Older films did. Modern urethane films with a UV-stable top coat don’t yellow within their warranty period."],
    ["PPF or ceramic coating?", "They do different jobs. Ceramic coating makes washing easier and adds gloss but doesn’t stop rock chips. PPF stops chips. The best result is PPF on the front with ceramic over everything."],
    ["Can I get PPF over a wrap?", "Yes, on a fresh wrap — it’s a common combination for matte colour changes that need protection from stains."]]},
  offset: { name: "Offset print", items: [
    ["How fast can I get them?", "Standard turnaround is 2–4 business days after proof approval. Next-day rush is available on most products for a 30% surcharge — ask when you order."],
    ["Will the colours match my screen?", "Screens are RGB and backlit; print is CMYK on paper, so bright blues and greens shift a little. Build your file in CMYK and, if a colour is critical, ask for a hard-copy proof or a Pantone match."],
    ["What if I don’t have a print-ready file?", "Send what you have — a logo, a Word document, a photo — and choose the design service option. We’ll lay it out, send a proof and only print once you approve it."],
    ["Can I see a sample before ordering?", "Yes. Drop by the shop to feel the stocks, or we can mail a sample pack of the papers you’re deciding between."],
    ["Do you ship?", "Pickup in Vaughan is free. We ship across Canada by courier; shipping is quoted by weight and shown before you confirm."],
    ["What’s your reprint policy?", "If a job doesn’t match the approved proof — wrong colour, trim, or a defect — we reprint it at no charge. Typos in the approved file are on the proof, so please check it carefully."]]},
  large: { name: "Large format", items: [
    ["How long will it last outside?", "Vinyl banners and coroplast signs are rated for 2–3 years outdoors. Flags see more wind stress and typically last 6–12 months in constant use. Roll-ups and X-frames are indoor products."],
    ["Can you install it?", "Yes — choose “Installation requested” and we’ll quote hanging, mounting or staking on site across the GTA."],
    ["Is the hardware included?", "Where the configurator says so, yes: grommets on banners, H-stakes with yard signs, the stand with roll-ups, the pole kit with flags and the frame with A-frames. Replacement graphics alone are available for all of them."],
    ["What resolution do I need?", "Far less than you’d think. 100–150 DPI at final size is plenty for a banner read from a metre or more away. A logo as vector will always be sharp at any size."],
    ["Can I order one, or is there a minimum?", "No minimum. One banner, one sign, one flag — pricing scales down at quantity, but single pieces are welcome."],
    ["13 oz or 18 oz?", "13 oz is the standard for most banners. 18 oz is heavier and stiffer — choose it for permanent outdoor installs or anything wider than 8 ft."]]},
  apparel: { name: "Apparel", items: [
    ["Is there a minimum order?", "No minimum order. DTF and Vinyl Heat Press are available; embroidery is available for caps and polos. Orders above 20 pieces receive 5% off."],
    ["Which method should I choose?", "Screen print for simple logos in volume; DTF for full-colour or photographic art in any quantity; embroidery for a premium, long-lasting finish on polos, caps and workwear; vinyl for names and numbers."],
    ["Can I mix sizes and colours?", "Yes. One order can have any mix of sizes; garment colours can be mixed as long as the print colours stay the same."],
    ["Will the print crack or fade?", "Screen prints and embroidery outlast the garment when washed inside-out in cold water. DTF is rated for 50+ washes. We include care instructions with every order."],
    ["Can I supply my own garments?", "Sometimes — ask first. We can’t guarantee results on fabrics we haven’t tested, and we don’t replace customer-supplied garments if a print fails."]]},
  glass: { name: "Window graphics", items: [
    ["Inside or outside the glass?", "Outside gives the crispest read from the street and is standard for opaque decals and perforated film. Inside (reverse-applied) protects the graphic from weather and vandalism and is what we recommend for frosted film and long-term lettering."],
    ["How long does it last?", "Cast opaque vinyl and frosted film: 5–7 years. Perforated and printed films: 2–3 years outdoors, longer inside."],
    ["Will it come off cleanly?", "Yes, within the film’s rated life. Cheap calendared vinyl left on for a decade is what leaves residue; we use cast films and remove them with heat."],
    ["Can I see it before it’s installed?", "We proof every job on a photo of your actual window, to scale, so you can judge the sightline and the size of the lettering."],
    ["What about landlord approvals?", "Most plazas require a sign permit or landlord sign-off for exterior graphics. We can supply drawings for the application."]]},
  tint: { name: "Window tint", items: [
    ["Is it legal?", "In Ontario, nothing may be applied to the windshield below the manufacturer’s AS-1 line, and front side windows must not substantially obscure the interior. Rear windows are unrestricted. We’ll recommend compliant options for your fronts."],
    ["Will it bubble or turn purple?", "Dyed films from years ago did. Modern carbon and ceramic films are colour-stable and carry a lifetime manufacturer warranty against bubbling, peeling and fading."],
    ["How dark should I go?", "For heat, choose the tier (ceramic) not the darkness. For privacy, 20% on rear glass is the common choice. Use the VLT preview on the tint hub to compare."],
    ["Does it affect phone or GPS signal?", "Metallic films can. Carbon and ceramic are non-metallic and have no effect on signal."],
    ["How do I clean it?", "Wait a week, then use a soft cloth and an ammonia-free cleaner. Never scrape the film."]]},
  wall: { name: "Wallpaper", items: [
    ["Can I install it myself?", "Peel-and-stick, yes — it’s repositionable and comes with numbered panels and instructions. Removable and commercial-grade vinyl are pasted and are best installed by us for seamless matches."],
    ["Will it damage the paint when removed?", "Not on a properly primed wall within the film’s rated life. Unprimed drywall or fresh paint can pull, which is why we ask about wall prep first."],
    ["Is it washable?", "All three materials wipe clean with a damp cloth. The textured commercial grade is scrubbable and rated for corridors, clinics and restaurants."],
    ["How do I get a photo big enough?", "For a full wall you need roughly 100 DPI at final size — a 12 ft wall wants an image around 14,000 px wide. Stock libraries sell that size; phone photos usually won’t hold up. We can advise before you buy."]]},
  designs: { name: "Wrap designs", items: [
    ["Will someone else have the same wrap?", "The layout is shared; the colours, logo and details are yours. We won’t sell the same design to a direct competitor in the same city — tell us your trade and area when you order."],
    ["Can I change more than colours and text?", "Two rounds of colour and text changes are included. Bigger changes — new imagery or a different layout — move it into a custom design at our design-services rate, with the file price credited."],
    ["Which file formats do I get?", "A layered Adobe Illustrator file and a print-ready PDF at full scale, plus a JPG mockup on your vehicle outline."],
    ["Can another shop print it?", "Yes — the files are shop-agnostic. Or bring the vehicle to us and the file fee comes off the wrap."]]},
  designsvc: { name: "Design services", items: [
    ["Is the deposit refundable?", "Not once design work has started — it covers the designer’s time on concepts. It is credited in full against the wrap, print run or apparel order it was designed for."],
    ["What if I need more revisions?", "Additional rounds are billed at $75 each. Most projects finish within the included allowance because the brief form asks for everything up front."],
    ["Do I get the source files?", "Yes. Layered AI or PSD files plus print-ready PDFs are delivered on final approval, and you own the artwork."],
    ["Can you redraw a low-quality logo?", "Yes — vector logo recreation is a $95 add-on and is usually done before the concept work starts so everything built on it is sharp."]]},
  web: { name: "Website design", items: [
    ["How long does a website take?", "Starter sites launch in 2–3 weeks, business sites in 3–4, e-commerce in 4–6. The biggest variable is how quickly content and photos come together — we can write and shoot them if you’d rather."],
    ["Do I own the site?", "Yes. The design, the code and the content are yours. If you leave, we hand over everything and help you move hosting."],
    ["Can I update it myself?", "Every package includes a CMS for the pages you’ll change — services, prices, photos, blog — and a training session. Structural changes we handle for you."],
    ["What about hosting and the domain?", "We register or transfer the domain in your name and set up hosting on your account. Care plans bundle hosting, backups, updates and small changes for a monthly fee."],
    ["Is the estimate binding?", "It’s a starting point based on the options you pick. After a discovery call we send a fixed-price proposal — no hourly surprises."]]},
};

/* ---------- Vehicle wraps ---------- */
const COVERAGE = [
  ["Decals + Lettering", "Essential branding for doors, sides and rear.", .22],
  ["Partial Wrap", "Strategic printed coverage with strong visual impact.", .45],
  ["Half / ¾ Wrap", "More coverage while balancing budget and visibility.", .70],
  ["Full Wrap", "Maximum brand presence across the vehicle body.", 1],
];
const COMMERCIAL = [
  { slug: "vans", photo: "job-greenlife-van", name: "Vans", one: "van", veh: "van", blurb: "The most common fleet canvas — full-side graphics read at a distance." },
  { slug: "pickups", photo: "job-fence-pickup", name: "Pickups", one: "pickup", veh: "pickup", blurb: "Bed, cab and tailgate wrapped as one continuous canvas." },
  { slug: "box-trucks", name: "Box Trucks", one: "box truck", veh: "box", blurb: "Flat box panels printed as one seamless mural." },
  { slug: "trailers", photo: "show-trailer", name: "Trailers", one: "trailer", veh: "trailer", blurb: "Highway-speed visibility with reflective or high-contrast options." },
  { slug: "buses", name: "Buses", one: "bus", veh: "bus", blurb: "Full exterior wraps, including perforated vinyl over glass." },
  { slug: "fleet-programs", photo: "job-mx-van", name: "Fleet Programs", one: "fleet", veh: "van", blurb: "One consistent brand system, rolled out across every vehicle you own.", fleet: true },
];
const FINISHES = [{name:"Gloss",m:1,d:"Smooth, reflective finish."},{name:"Matte",m:1.1,d:"Low-reflection finish. 10% additional."},{name:"Satin",m:1.1,d:"Soft sheen between gloss and matte. 10% additional."}];
let PRICING={roofMultiplier:1.12,designDeposit:250};
const ESTIMATOR = [
  { slug: "sedan", photoKey: "sedan", name: "Sedan", veh: "sedan", base: 2800, d: "Compact and mid-size cars.", q: [["Body size", [["Compact", 1], ["Mid-size", 1.08], ["Full-size", 1.16]]]] },
  { slug: "suv", photoKey: "fullsuv", name: "SUV", veh: "suv", base: 3400, d: "Mid-size and full-size SUVs.", q: [["SUV size", [["Mid-size", 1], ["Full-size", 1.15]]]] },
  { slug: "pickup-truck", photoKey: "pickup", name: "Pickup Truck", veh: "pickup", base: 3200, d: "Choose your cab and bed size.", q: [["Cab size", [["Single", 1], ["Double", 1.08], ["Crew", 1.14]]], ["Bed size", [["Short", 1], ["Medium", 1.05], ["Long", 1.1]]]] },
  { slug: "minivan", photoKey: "minivan", name: "Minivan", veh: "minivan", base: 3600, d: "Passenger and delivery minivans.", q: [["Body style", [["Passenger", 1], ["Cargo", .96]]]] },
  { slug: "transit-van", photoKey: "van", name: "Transit Van", veh: "van", base: 3950, d: "Short or long wheelbase, low to high roof.", q: [["Transit size", [["Short Wheel", 1], ["Long Wheel", 1.1]]], ["Roof size", [["Low Roof", 1], ["Mid Roof", 1.06], ["High Roof", 1.12]]], ["Extended van", [["No", 1], ["Yes", 1.08]]]] },
  { slug: "sprinter-van", photoKey: "van", name: "Sprinter Van", veh: "van", base: 4300, d: "Choose wheelbase and roof height.", q: [["Wheelbase", [["Standard", 1], ["Long", 1.1], ["Extra Long", 1.18]]], ["Roof height", [["Low", 1], ["High", 1.1]]], ["Extended van", [["No", 1], ["Yes", 1.08]]]] },
  { slug: "cargo-van", photoKey: "van", name: "Cargo Van", veh: "van", base: 4200, d: "Other cargo and delivery vans.", q: [["Wheelbase", [["Standard", 1], ["Long", 1.1]]], ["Roof height", [["Low", 1], ["Medium", 1.05], ["High", 1.1]]]] },
  { slug: "box-truck", name: "Box Truck", veh: "box", base: 5800, d: "Configure box dimensions and cab coverage.", q: [["Box dimensions", [["12–16 ft", 1], ["17–20 ft", 1.18], ["21–26 ft", 1.36]]], ["Coverage area", [["Box only", 1], ["Box + Cab", 1.22]]]] },
  { slug: "trailer", name: "Trailer", veh: "trailer", base: 4800, d: "Enclosed trailers of different lengths.", q: [["Trailer dimensions", [["12–24 ft", 1], ["25–40 ft", 1.4], ["40+ ft", 1.75]]], ["Front style", [["Flat", 1], ["V-nose", 1.06]]], ["Coverage area", [["Sides only", 1], ["Rear + Sides", 1.12], ["Front + Sides", 1.12]]]] },
  { slug: "bus", name: "Bus", veh: "bus", base: 8500, d: "School buses, shuttles and coaches.", q: [["Bus type", [["School", 1], ["Shuttle", .92], ["Coach", 1.12]]], ["Dimensions", [["20–30 ft", 1], ["30–40 ft", 1.25], ["40+ ft", 1.5]]], ["Window coverage", [["None", 1], ["Perforated graphics", 1.1]]]] },
];
const WRAP_MATERIALS = [["3M", 1]];

/* ---------- Print shop ---------- */
const OFFSET = [
  { slug: "business-cards", photo: "pr-bc-1", name: "Business Cards", h: "Make the first introduction feel like you.", d: "Choose your style, finish and quantity.", from: "$26.00", fromQ: "100", list: "14–32 pt stock · Matte or gloss · 1–2 sides",
    q: [500, 1000, 2500, 5000], p: [44.99, 64.99, 119, 189], trim: "3.5 × 2 in (bleed size 3.75 × 2.25 in)",
    opts: [["Card collection", [["Regular", 0, "Clear and practical for everyday use."], ["Luxury", 18, "Soft-touch premium stock."]]], ["Print sides", [["One side", 0], ["Double side", 6]]], ["Corners", [["Square corners", 0], ["Rounded corners", 4]]]],
    about: ["The card you hand over says more than the pitch.", "Regular or Luxury? Regular cards keep your brand clear and practical. Luxury cards add a softer, more premium feel.", "Corners & templates: square corners give a classic look. Rounded corners feel softer. Use the matching 3.5 × 2 in template and keep important content inside the safe area."] },
  { slug: "flyers", photo: "pr-flyer", name: "Flyers", h: "Spread the word. Beautifully.", d: "Launches, promotions and everyday announcements, printed to stand out.", from: "$83.30", fromQ: "250", list: "8.5×11 or 5.5×8.5 · Gloss or matte",
    q: [500, 1000, 2500, 5000], p: [89, 129, 249, 399], trim: "5.5 × 8.5 in or 8.5 × 11 in (+0.125 in bleed)",
    opts: [["Size", [["5.5 × 8.5 in", 0], ["8.5 × 11 in", 8], ["Custom", 12]]], ["Print sides", [["One side", 0], ["Double side", 6]]], ["Finish", [["Matte", 0], ["Gloss", 0]]]],
    about: ["Details that make the difference.", "Flyers do one job: get read in the three seconds someone holds them. We print on 100 lb silk or gloss text so photos stay sharp and colour stays rich.", "Choose half-letter for hand-outs and counters, full letter for menus, price lists and mail drops."] },
  { slug: "postcards", photo: "pr-postcard", name: "Postcards", h: "Turn your next promotion into a tangible connection.", d: "A format built for short offers and memorable mailers.", from: "$65.45", fromQ: "250", list: "4×6 or 5×7 · UV gloss front",
    q: [500, 1000, 2500, 5000], p: [69, 99, 189, 299], trim: "4 × 6, 5 × 7 or 6 × 9 in (+0.125 in bleed)",
    opts: [["Size", [["4 × 6 in", 0], ["5 × 7 in", 10], ["6 × 9 in", 18]]], ["Print sides", [["One side", 0], ["Double side", 6]]], ["Finish", [["Matte", 0], ["Gloss", 0]]]],
    about: ["Details that make the difference.", "Postcards are the shortest route from your offer to a kitchen counter. A heavy 16 pt stock with a UV gloss front makes the image the first thing people notice.", "Leave the back clear for addressing if you’re mailing through Canada Post — we’ll check the indicia area on the proof."] },
  { slug: "brochures", photo: "pr-brochure", name: "Brochures", h: "Your story. Unfolded.", d: "Give your products and services room to shine with a carefully folded brand story.", from: "$269.09", fromQ: "100", list: "Bi-fold or tri-fold · 100lb silk",
    q: [500, 1000, 2500, 5000], p: [189, 279, 549, 899], trim: "8.5 × 11, 8.5 × 14 or 11 × 17 in flat (+0.125 in bleed)",
    opts: [["Size", [["8.5 × 11 in", 0], ["8.5 × 14 in", 14], ["11 × 17 in", 24]]], ["Fold", [["Bi-fold", 0], ["Tri-fold", 6], ["Z-fold", 6]]], ["Finish", [["Matte", 0], ["Gloss", 0]]]],
    about: ["Details that make the difference.", "A brochure is read in order, so the fold decides the story. Bi-folds open like a book; tri-folds reveal one panel at a time; Z-folds open flat in one pull.", "Every fold product includes a die line in the template so nothing important lands in a crease."] },
  { slug: "door-hangers", photo: "pr-doorhanger", name: "Door Hangers", h: "Get your message to their door.", d: "Reach your neighbourhood with door hangers made for local promotions.", from: "$88.00", fromQ: "250", list: "3.5×8.5 or 4.25×11 · Die-cut hanger",
    q: [500, 1000, 2500, 5000], p: [99, 149, 279, 449], trim: "3.5 × 8.5 or 4.25 × 11 in with die-cut hole",
    opts: [["Size", [["3.5 × 8.5 in", 0], ["4.25 × 11 in", 10]]], ["Print sides", [["One side", 0], ["Double side", 6]]], ["Finish", [["Matte", 0], ["Gloss", 0]]]],
    about: ["Details that make the difference.", "Door hangers land where flyers can’t: on the handle, at eye level, impossible to miss. Thick 14 pt stock holds up to wind and rain for the day it needs to.", "Keep text clear of the die-cut hole and slit — the template marks the no-go zone."] },
];
const LARGE = [
  { slug: "roll-up-banner", photo: "pr-rollup", name: "Roll-Up Banner", d: "Portable retractable displays for events and receptions.", from: "From $148.74", base: 129, unit: "ea",
    opts: [["Size", [["33 × 80 in", 0], ["47 × 80 in", 40]]], ["Stand", [["Standard stand", 0], ["Premium stand", 45]]], ["Installation", [["Not required", 0], ["Requested", 60]]]], size: "33 × 80 or 47 × 80 in" },
  { slug: "vinyl-banners", photo: "pr-vinyl-banner", name: "Vinyl Banners", d: "Bold, flexible signage for indoor and outdoor use.", from: "From $2.80 / sq ft", sqft: 6.5, custom: true,
    opts: [["Material", [["13oz Banner vinyl", 0], ["18oz Banner vinyl", 1.5]]], ["Print sides", [["Single side", 0], ["Double side", 3]]], ["Hardware", [["Included (grommets)", 0], ["Not included", 0]]], ["Installation", [["Not required", 0], ["Requested", 60]]]], size: "Custom width × height" },
  { slug: "x-frame-banner", photo: "pr-xframe", name: "X-Frame Banner", d: "Lightweight displays with replaceable graphics.", from: "From $139.99", base: 79, unit: "ea",
    opts: [["Size", [["24 × 63 in", 0], ["32 × 71 in", 20]]], ["Frame", [["Included", 0], ["Graphic only", -25]]], ["Installation", [["Not required", 0], ["Requested", 60]]]], size: "24 × 63 or 32 × 71 in" },
  { slug: "yard-signs", photo: "pr-yard-sign", name: "Yard Signs", d: "Local advertising, directional signs and property marketing.", from: "From $19.99 ea", base: 14, unit: "ea",
    opts: [["Size", [["18 × 24 in", 0], ["24 × 36 in", 9]]], ["Print sides", [["Single side", 0], ["Double side", 4]]], ["Hardware", [["H-stakes included", 0], ["No stakes", -2]]]], size: "18 × 24 or 24 × 36 in coroplast" },
  { slug: "flags", photo: "pr-flag-feather", name: "Flags", d: "Eye-catching flags for entrances and events.", from: "From $149.99", base: 99, unit: "ea",
    opts: [["Shape", [["Feather", 0], ["Teardrop", 0], ["Rectangle", 10]]], ["Size", [["Small · 8 ft", 0], ["Medium · 11 ft", 40], ["Large · 15 ft", 90]]], ["Base", [["Ground spike", 0], ["Cross base + water bag", 35]]]], size: "8, 11 or 15 ft pole kits" },
  { slug: "a-frame-signs", photo: "pr-aframe", name: "A-Frame Signs", d: "Sidewalk displays with interchangeable sign faces.", from: "From $304.99", base: 149, unit: "ea",
    opts: [["Faces", [["24 × 36 in", 0], ["Wide 28 × 44 in", 45]]], ["Print sides", [["Single side", 0], ["Double side", 30]]], ["Frame", [["Included", 0], ["Faces only", -80]]]], size: "24 × 36 in faces" },
];

/* ---------- Apparel ---------- */
const APPAREL = [
  { slug: "t-shirts", name: "T-Shirts", g: "tee", h: "Your brand. Worn your way.", ppc: 17.99, sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] },
  { slug: "hoodies", name: "Hoodies", g: "hoodie", h: "Built for cold mornings and brand mornings.", ppc: 38.99, sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] },
  { slug: "sweatshirts", name: "Sweatshirts", g: "crew", h: "Everyday comfort, always on-brand.", ppc: 32.99, sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] },
  { slug: "hats", name: "Hats & Caps", g: "cap", h: "Custom hats", ppc: 19.99, sizes: ["Adjustable"] },
  { slug: "workwear", name: "Workwear", g: "work", h: "Uniforms that hold up to the job.", ppc: 44.99, sizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"] },
];
const APP_COLORS = [["Black", "#1b1b1d"], ["White", "#f7f7f5"], ["Heather Grey", "#a9a9ad"], ["Navy", "#1f2a44"], ["Forest", "#22412f"], ["Maroon", "#5b1f2a"], ["Safety Green", "#c6e33a"]];
const APP_METHODS = [["DTF", 1.15, "Full-colour prints, no minimum."], ["Vinyl Heat Press", 1.1, "Names, numbers and solid-colour artwork."]];

/* ---------- Window graphics ---------- */
const GLASS_MAT = { "Frosted Etch": 7, "Perforated One-Way": 9, "Cast Opaque Colour": 6, "Full-Colour Digital Print": 12 };
const GLASS = [
  { slug: "full-window-graphics", name: "Full Window Graphics", kicker: "Window Graphics · Full", h: "Floor-to-ceiling storefront takeovers.", d: "Digitally printed graphics across every pane — campaigns, seasonal takeovers and full brand environments.", uses: ["Storefront run", "Full building facade", "Interior glass partitions"], mats: ["Perforated One-Way", "Cast Opaque Colour", "Full-Colour Digital Print"], about: ["Campaign or permanent?", "Printed films turn every pane into one continuous image. Perforated film keeps the view out; opaque print blocks it completely for back-of-house glass."] },
  { slug: "perforated-vinyl", name: "Perforated Vinyl", kicker: "Window Graphics · Perforated", h: "A full graphic outside. A clear view inside.", d: "One-way perforated film prints a full-colour image on the glass while staff and customers still see out.", uses: ["Single window", "Storefront run", "Vehicle rear glass"], mats: ["Perforated One-Way"], about: ["How one-way works", "The film is printed on one side and punched with thousands of small holes. From outside the eye reads the print; from inside, the dark backing disappears and you see through."] },
  { slug: "frosted-vinyl", photo: "office-glass", name: "Frosted Vinyl", kicker: "Window Graphics · Frosted", h: "Privacy without losing the light.", d: "Etched-glass look for meeting rooms, offices and clinic partitions — with cut-out logos or patterns if you want them.", uses: ["Privacy band (eye level)", "Full pane", "Full pane with cut-out logo"], mats: ["Frosted Etch"], about: ["Band or full pane?", "An eye-level band keeps sightlines open above and below; a full pane gives complete privacy while still passing natural light. Frosted film can be cut with negative-space logos, stripes or gradients so the privacy layer doubles as branding."] },
  { slug: "window-decals", name: "Window Decals", kicker: "Window Graphics · Decals", h: "Hours, logos and lettering, cut to the glass.", d: "Cut-vinyl decals for storefront doors and windows — quick to produce, easy to update.", uses: ["Door panel", "Single window", "Multiple windows"], mats: ["Cast Opaque Colour", "Full-Colour Digital Print"], about: ["Cut or printed?", "Cut vinyl gives crisp single-colour lettering with no background at all. Printed decals handle full-colour logos and photos, contour-cut to shape."] },
];

/* ---------- Tint ---------- */
const FILMS = [
  { name: "Ceramic", tier: "$$$", heat: 80, uv: 99.9, glare: 85, d: "Maximum heat rejection without extra darkness.", m: 1.8, sqft: 12 },
  { name: "Carbon", tier: "$$", heat: 60, uv: 99, glare: 75, d: "No signal interference, rich colour that won’t fade.", m: 1.35, sqft: 8 },
  { name: "Dyed", tier: "$", heat: 35, uv: 99, glare: 60, d: "Budget-friendly, flat non-reflective black look.", m: 1, sqft: 5 },
];
const TINT_BODY = [["Sedan / Coupe", 249], ["SUV / Crossover", 289], ["Pickup Truck", 269], ["Van / Minivan", 339]];
const TINT_COVER = [["Front two windows only", .45], ["Rear windows + back glass", .7], ["All side windows + back glass", 1], ["All windows + windshield sun strip", 1.12]];

/* ---------- Wallpaper ---------- */
const PATTERNS = { /* [name, room photo, flat texture used on the live wall preview] */
  Home: [["Living room", [["Tropical Bloom", "mu-tropical-living", "mu-tropical"], ["Bird of Paradise", "mu-blueprint-living", "mu-leaves"], ["Geometric Stone", "mu-geo", "mu-marble"]]], ["Bedroom", [["Night Garden", "mu-tropical-bed", "mu-tropical"], ["3D Panels", "mu-bedroom-3d", "mu-marble"], ["Teal Facets", "mu-teal", "mu-green-marble"]]], ["Kids room", [["Big Dream", "mu-kids-rainbow", "mu-houses"], ["Little Riders", "mu-nursery", "mu-houses"], ["Little Town", "mu-houses", "mu-houses"]]]],
  Office: [["Reception", [["Work Hard", "mu-office-workhard", "mu-marble"], ["Custom Wall Mural", "mu-custom-office", "mu-forest"], ["Palm Office", "mu-office-leaves", "mu-palms"]]], ["Meeting rooms", [["Jungle Boardroom", "mu-office-leaves-2", "mu-palms"], ["Forest Mist", "mu-forest", "mu-forest"], ["Green Marble", "mu-green-marble", "mu-green-marble"]]]],
  Other: [["Hospitality & retail", [["Café Sketch", "mu-restaurant", "mu-marble"], ["Retro Mixtape", "mu-restaurant-2", "mu-houses"], ["Tropical Leaves", "mu-tropical", "mu-tropical"]]]],
};
const WALL_MAT = [["Standard Removable Vinyl", 3.25], ["Peel & Stick", 4], ["Textured Commercial Grade", 4.5]];

/* ---------- Shop ---------- */
const WRAP_DESIGNS = [
  { slug: "delivery-dash", name: "Delivery Dash", style: "Sport", ind: "Logistics", col: "Orange / Grey", c: ["#f26b3a", "#5a5f66"], d: "Motion stripes and a large tracking-URL panel for courier fleets." },
  { slug: "real-estate-modern", name: "Real Estate Modern", style: "Commercial", ind: "Real estate", col: "Black / Gold", c: ["#111", "#c9a24a"], d: "Minimal, premium layout with a headshot panel and QR block." },
  { slug: "cleaning-sparkle", name: "Cleaning Sparkle", style: "Abstract", ind: "Cleaning", col: "Teal / White", c: ["#1aa6a6", "#ffffff"], d: "Light, bright layout with sparkle accents for cleaning services." },
  { slug: "electric-volt", name: "Electric Volt", style: "Sport", ind: "Trades & services", col: "Yellow / Black", c: ["#f5d000", "#141414"], d: "Lightning accent stripes for electrical contractors." },
  { slug: "hvac-arctic", name: "HVAC Arctic", style: "Commercial", ind: "Trades & services", col: "Blue / Red", c: ["#2563c9", "#e23b3b"], d: "Hot-and-cold split graphic for heating and cooling companies." },
  { slug: "plumbing-pro", name: "Plumbing Pro", style: "Commercial", ind: "Trades & services", col: "Blue / White", c: ["#1e4fa8", "#ffffff"], d: "Water-wave motif with a bold phone-number panel." },
  { slug: "landscaping-fresh", name: "Landscaping Fresh", style: "Sport", ind: "Landscaping", col: "Green / Brand colours", c: ["#2f8f4e", "#a7d46f"], d: "Natural tones with a clean service-list layout." },
  { slug: "food-truck-feast", name: "Food Truck Feast", style: "Abstract", ind: "Food & beverage", col: "Multi-colour", c: ["#e8314a", "#f7b733"], d: "Appetite-driven imagery and oversized menu type." },
  { slug: "construction-fleet", name: "Construction Fleet", style: "Commercial", ind: "Construction", col: "Yellow / Black", c: ["#f2b705", "#1a1a1a"], d: "High-visibility, safety-forward layout with chevron accents." },
  { slug: "commercial-clean", name: "Commercial Clean", style: "Commercial", ind: "Trades & services", col: "Brand colours", c: ["#2b4c6f", "#d9e2ec"], d: "Artwork built around your logo, services and phone number." },
  { slug: "sport-stripe", name: "Sport Stripe", style: "Sport", ind: "General", col: "Multi-colour", c: ["#e8314a", "#2563c9"], d: "Performance-inspired stripes and angled graphics." },
  { slug: "abstract-flow", name: "Abstract Flow", style: "Abstract", ind: "General", col: "Multi-colour", c: ["#d42d80", "#3b82f6"], d: "Bold shapes and expressive colour that work on any trade." },
];
const DESIGN_DIRECTIONS = [["As shown", null], ["Signal Blue", ["#2563c9", "#9cc0ff"]], ["Brass", ["#8a6a2b", "#e3c27a"]], ["Forest", ["#22412f", "#7fb48a"]], ["Ember", ["#a3281f", "#f08a5d"]]];
const TEMPLATE_DB = {
  Ford: { Transit: ["Cargo · Low roof", "Cargo · High roof", "Passenger"], "F-150": ["Regular Cab", "Crew Cab"], Escape: ["SUV"] },
  Chevrolet: { Express: ["Cargo", "Passenger"], Silverado: ["Regular Cab", "Crew Cab"] },
  "Mercedes-Benz": { Sprinter: ["Cargo · Standard roof", "Cargo · High roof", "Passenger"] },
  Ram: { ProMaster: ["Cargo · Low roof", "Cargo · High roof"], "1500": ["Quad Cab", "Crew Cab"] },
};
const DESIGN_SERVICES = [
  ["Vehicle Wrap Design", 250, "2–3 initial concepts · up to 10 revisions"], ["Logo Design", 150, "3 concepts · 3 revisions · brand colours"],
  ["Business Card / Flyer / Brochure Design", 75, "2 concepts · 3 revisions"], ["Banner / Sign Design", 75, "2 concepts · 3 revisions"],
  ["Window Graphics Design", 100, "Layout on your window photo · 3 revisions"], ["Apparel Design", 75, "2 concepts · placement mockups"],
];
const MATERIALS = [
  { group: "Wrap films", d: "Choose brand, colour, finish and roll length.", items: [["Cast Vinyl Roll (per ft)", 12, "3M", "In stock"]] },
  { group: "Application tools", d: "Squeegees, blades and precision installation tools.", items: [["Squeegee & Install Kit", 59, "3M", "In stock"], ["Knifeless Tape Kit", 39, "3M", "In stock"], ["Heat Gun & IR Thermometer", 129, "3M", "Special order"]] },
  { group: "Finishing essentials", d: "Preparation and finishing supplies.", items: [["Laminate — Gloss / Matte / Satin (per ft)", 6, "3M", "In stock"], ["Surface Prep Cleaner", 18, "3M", "In stock"], ["Edge Sealer Pen", 24, "3M", "Special order"]] },
];

/* ---------- Website design ---------- */
const WEB_PKGS = [
  { name: "Starter Website", from: "From $999", time: "2–3 weeks", f: ["Up to 5 pages", "Responsive design", "Contact form", "Basic SEO setup", "Social media links", "Google Maps", "Basic animations"] },
  { name: "Business Website", from: "From $1,799", time: "3–4 weeks", pop: true, f: ["Up to 10 pages", "Everything in Starter", "Blog / news", "Advanced contact forms", "Gallery / portfolio", "Google Reviews feed", "CMS + training", "Analytics setup"] },
  { name: "E-commerce Website", from: "From $2,999", time: "4–6 weeks", f: ["Everything in Business", "Online store", "Product pages", "Shopping cart & checkout", "Payment integration", "Customer accounts", "Order management", "Product filters"] },
  { name: "Custom Website", from: "Custom quote", time: "Scoped", f: ["Advanced calculators", "Price / quote estimators", "Product customizers", "Customer portals", "Custom integrations", "Booking systems", "Advanced e-commerce", "Custom databases"] },
];
const WEB_TYPES = [["Landing page", 799], ["Portfolio / brochure", 999], ["Business", 1499], ["E-commerce", 2799], ["Custom web app", 4500]];
const WEB_PAGES = [["1–5", 0], ["6–10", 400], ["11–20", 900], ["20+", 1600]];
const WEB_FEATS = [["E-commerce", 1200], ["Online payment", 350], ["Booking system", 450], ["Customer login", 600], ["Price calculator", 500], ["Quote estimator", 550], ["Product customizer", 900], ["Blog", 250], ["Multilingual website", 700], ["Live chat", 150], ["Advanced contact forms", 150], ["Google Reviews", 120], ["Google Maps", 50], ["Gallery / portfolio", 150], ["SEO setup", 250], ["Copywriting", 400], ["Logo / branding", 350]];

/* ---------- Policies ---------- */
const POLICIES = {
  "warranty": { t: "Warranty", k: "Policy", d: "What we stand behind, for how long, and how to make a claim.", s: [
    ["Vehicle wraps and commercial graphics", ["Workmanship warranty: 5 years against lifting, peeling and bubbling caused by installation, on vehicles with OEM paint in good condition. Film and print durability are covered separately by the manufacturer (3M) — typically 5–7 years vertical and 3–5 years horizontal for printed wraps, and 2–7 years for colour-change films depending on finish.", "Not covered: damage from accidents, pressure washers at edges, automatic brush washes, chemicals, or wraps applied over repaint, damaged paint or non-OEM panels we flagged at inspection."]],
    ["Paint protection film", ["Film warranty: 10 years from the manufacturer against yellowing, cracking, bubbling, delamination and staining. Workmanship: 5 years. Self-healing covers light swirls and scuffs; it does not cover cuts, punctures or rock impacts that penetrate the film."]],
    ["Window tint", ["Lifetime manufacturer warranty on the film against bubbling, peeling, cracking, fading and colour change, for as long as you own the vehicle or property, plus a 2-year workmanship warranty. Warranty cards are issued at installation; keep yours for claims."]],
    ["Window graphics and wallpaper", ["Workmanship warranty: 2 years against lifting and peeling on properly prepared surfaces. Film durability per manufacturer rating (2–7 years by product). Not covered: surfaces we advised against (fresh paint, unprimed drywall, damaged glass), removal by the customer, or damage from cleaning with abrasives or ammonia."]],
    ["Print and apparel", ["Print orders are warranted to match the approved proof and to be free of manufacturing defects at delivery — see Defects and reprints on the Orders policy. Apparel decoration is warranted for 50 washes when the care label is followed (wash inside-out in cold water, no bleach, low heat or hang dry). Outdoor print products carry the durability ratings listed on their pages."]],
    ["Websites", ["Every website includes 30 days of post-launch fixes for defects in what we built. Ongoing updates, content changes and third-party service outages are covered by a care plan, not the warranty."]],
    ["Making a claim", ["Email info@satingraphic.ca with your invoice number, photos of the issue and the date it appeared. Call (905) 555-0148 if it is urgent.", "We inspect within 10 business days (in person for vehicles and installations) and repair, replace or reprint the affected area at no charge if it is covered.", "Warranties are for the original purchaser and are not transferable unless stated on the manufacturer’s card."]]]},
  "artwork-guidelines": { t: "Artwork Guidelines", k: "Help", d: "How to prepare files so your proof matches your screen and your print matches your proof.", s: [
    ["File formats we accept", ["*Best: print-ready PDF (PDF/X-1a or “High Quality Print”) with bleed and crop marks.", "*Vector: AI, EPS, SVG — required for cut vinyl, embroidery and any logo we scale up.", "*Raster: TIFF, PSD (flattened), PNG or JPG at the resolution listed for the product.", "*Layouts: InDesign packages (with links and fonts) are welcome. Word, PowerPoint, Canva and Publisher files are not print-ready; we can rebuild them as a design service."]],
    ["Resolution", ["*Offset print (cards, flyers, brochures): 300 DPI at final size.", "*Large format and wallpaper: 100–150 DPI at final size, or 25% scale at 4× that resolution.", "*Vehicle wraps: 72–100 DPI at full vehicle scale; vector wherever possible.", "*Apparel (DTF): 300 DPI at the printed size, PNG with a transparent background.", "Screenshots and web images (72 DPI) are almost never usable — ask before you build on one."]],
    ["Bleed, trim and safe area", ["Anything that touches the edge must extend past it, and anything important must stay well inside it.", "*Offset print: 0.125 in (3 mm) bleed on all sides; keep text and logos 0.125 in inside the trim.", "*Rigid signs: 0.25 in bleed. Banners: 1 in bleed, and keep text 3 in from the edges where hems and grommets land.", "*Wallpaper: 2 in top and bottom, 1 in per side — walls are never square.", "*Vehicle wraps: we template every panel; leave 2 in of extra artwork past every panel edge shown on the template."]],
    ["Colour", ["*Work in CMYK. RGB files are converted, and bright blues, greens and oranges will shift.", "*Give us Pantone references for brand colours and we will match them on press and on vinyl.", "*Use rich black (C60 M40 Y40 K100) for large solid areas; use 100% K only for small text.", "*Never rely on your monitor for colour approval — request a hard-copy proof for anything critical."]],
    ["Fonts and images", ["*Outline (convert to curves) all text, or embed the fonts in the PDF.", "*Embed linked images or include them in a package. Missing links arrive as grey boxes.", "*Keep text above 6 pt for print and 0.25 in tall for embroidery and cut vinyl.", "*Minimum stroke weight: 0.25 pt for print, 0.1 in for cut vinyl."]],
    ["Templates", ["Every print product page lists its trim and bleed size; door hangers and folded products include die lines. For vehicles, ask for the template before designing — we send the exact outline with panel dimensions for your year, make and model. Templates for apparel placements and window graphics are supplied with your proof."]],
    ["Sending files", ["Upload through the product page or the quote form (up to 25 MB per file). For larger files send a WeTransfer, Dropbox or Google Drive link in the notes. Name files with the product and side, for example “businesscard-front.pdf”."]],
    ["Not sure?", ["Send what you have. We preflight every file and tell you what, if anything, needs fixing before you pay for a proof. Or choose the design service option and we will build it for you."]]]},
  "refund-policy": { t: "Orders, Shipping & Returns", k: "Policy", d: "How orders are confirmed, when they ship, and what happens if something is wrong.", s: [
    ["When an order is confirmed", ["An order is confirmed when you approve the proof and payment (or the required deposit) is received. Turnaround times start from that moment, not from when the request was sent."]],
    ["Turnaround", ["*Offset print (cards, flyers, brochures): 2–4 business days.", "*Large format (banners, signs, flags): 2–3 business days.", "*Apparel: 5–7 business days.", "*Window graphics and wallpaper: 3–5 business days plus installation scheduling.", "*Vehicle wraps, PPF and tint: scheduled on booking; typically 1–3 days in the shop.", "Rush production is available on most print products for a surcharge — ask before you approve the proof."]],
    ["Pickup and shipping", ["Pickup at our Vaughan, Ontario facility is free. We hold completed orders for 30 days; unclaimed orders after that may be recycled and are non-refundable.", "We ship across Canada by courier; the cost is quoted by weight and destination before you confirm. Orders over $500 within the GTA ship free.", "Risk passes to you when the courier collects the package. We pack to prevent damage; if a package arrives damaged, photograph it before opening and contact us within 48 hours so we can claim against the carrier and reprint."]],
    ["Custom-made goods", ["Everything we make is produced to your artwork and specifications, so it cannot be resold. For that reason we do not accept returns or offer refunds for change of mind, ordering the wrong size or quantity, or errors that were present in the proof you approved."]],
    ["Defects and reprints", ["If your order does not match the approved proof — wrong colour, size, stock, misregistration, trimming faults, or a manufacturing defect — tell us within 7 days of pickup or delivery. We will reprint the affected quantity at no charge, or refund it if a reprint is not practical. We may ask for photos or the return of the defective goods."]],
    ["Cancellations", ["*Before proof approval: cancel at any time at no charge; design deposits are not refundable once design work has started.", "*After proof approval, before production: we charge for materials ordered and time spent (typically 25%).", "*After production starts: custom-printed orders cannot be cancelled. Wrap and installation bookings cancelled with less than 48 hours’ notice forfeit 25% of the deposit."]],
    ["Materials and tools", ["Unopened, unused vinyl rolls, laminates and tools from the shop may be returned within 14 days for a refund less a 15% restocking fee. Cut lengths of film are custom and non-returnable."]],
    ["How to reach us", ["Email info@satingraphic.ca with your order or quote reference, or call (905) 555-0148 during business hours. We reply within one business day."]]]},
  "privacy-policy": { t: "Privacy Policy", k: "Legal", d: "How Satin Graphic collects, uses and protects your personal information.", s: [
    ["Who this covers", ["This policy applies to personal information collected by Satin Graphic (“we”, “us”) through this website, our quote and contact forms, our newsletter, phone and email, and in our Vaughan, Ontario facility. We comply with Canada’s Personal Information Protection and Electronic Documents Act (PIPEDA)."]],
    ["What we collect", ["We collect only what we need to quote, produce and deliver your order, and to stay in touch about it:", "*Contact details — name, email, phone, business name and address.", "*Project details — the vehicle, product, quantities, measurements and options you configure, plus any artwork or photos you upload.", "*Order and payment records — invoices, deposits and payment confirmations (card numbers are processed by our payment provider and never stored by us).", "*Website usage — pages visited, device type and approximate location, collected through cookies and analytics.", "*Newsletter subscription — your email address, if you sign up."]],
    ["How we use it", ["*To prepare quotes, proofs and mockups, and to produce and deliver what you order.", "*To contact you about your project — proof approvals, scheduling, pickup and delivery.", "*To send project updates and occasional offers if you subscribed; every email includes an unsubscribe link.", "*To keep accounting and warranty records, which we retain for seven years as required by the Canada Revenue Agency.", "*To improve the website and our services using aggregated, de-identified analytics."]],
    ["Who we share it with", ["We do not sell or rent personal information. We share it only with service providers who need it to do their part of your job — our payment processor, courier and shipping partners, email delivery service, cloud hosting and analytics — each bound to protect it and use it only for us. We may also disclose information where the law requires it."]],
    ["Your artwork and files", ["Files you upload are stored on our servers and used only to produce your order. We keep them so reprints match exactly; ask us to delete them at any time after the job is complete. We may photograph finished work for our portfolio unless you tell us not to when you order."]],
    ["Cookies", ["This site uses a small number of cookies and local-storage entries: to remember the items in your quote cart, and for anonymous analytics that help us see which pages are useful. You can block cookies in your browser; the quote cart will then reset between visits."]],
    ["How we protect it", ["Data is transmitted over encrypted connections (HTTPS) and stored on access-controlled systems. Only staff who need it to complete your order can see it. No system is perfectly secure; if a breach affects your information we will notify you and the Office of the Privacy Commissioner as PIPEDA requires."]],
    ["Your rights", ["You can ask to see the personal information we hold about you, correct it, withdraw consent to marketing, or have it deleted where we are not required to keep it. Email info@satingraphic.ca or call (905) 555-0148; we respond within 30 days. If you are not satisfied, you may contact the Office of the Privacy Commissioner of Canada."]],
    ["Changes to this policy", ["We update this page when our practices change and note the date at the top. Continued use of the site after a change means you accept the updated policy."]]]},
  "terms-and-conditions": { t: "Terms & Conditions", k: "Legal", d: "The terms that apply to every quote, order and service from Satin Graphic.", s: [
    ["Agreement", ["By requesting a quote, approving a proof or placing an order with Satin Graphic you agree to these terms, our Privacy Policy and the Orders, Shipping & Returns policy. If you are ordering for a business you confirm you are authorized to bind it."]],
    ["Quotes and estimates", ["*Online estimators show starting prices based on the options you select. They are not binding quotes.", "*Written quotes are valid for 30 days and are based on the information you provide. Changes to size, quantity, materials, vehicle condition or artwork may change the price.", "*Vehicle wrap, tint and window-graphic quotes are confirmed after we inspect the vehicle or measure the glass. Quotes exclude HST unless stated."]],
    ["Deposits and payment", ["*Print orders are paid in full before production. Wraps, installations and website projects require a 50% deposit to schedule, with the balance due on completion or before delivery.", "*Design deposits are non-refundable once concept work has started and are credited against the production order they were designed for.", "*We accept Interac e-Transfer, Visa, Mastercard and cheque (cleared before release). Overdue balances accrue 2% per month.", "*Finished goods remain our property until paid in full."]],
    ["Artwork, proofs and approval", ["*You are responsible for the content of the artwork you supply or approve — spelling, phone numbers, images and rights to use them. Production starts only after you approve a proof, and the approved proof is what we print.", "*We do not proofread. Errors present in an approved proof are reprinted at your cost.", "*Colour on screen is not a reliable guide to print colour. We match Pantone references where specified; otherwise commercially reasonable colour variation is normal and not a defect.", "*You confirm you own or are licensed to use all logos, images, fonts and text you supply, and you indemnify us against claims arising from their use."]],
    ["Production and turnaround", ["*Turnaround times are estimates measured in business days from proof approval and receipt of payment. We are not liable for delays caused by material availability, weather, courier performance or late approvals.", "*Print quantities may vary by up to 5% over or under, which is standard trade practice; you are billed for the quantity delivered."]],
    ["Vehicle services", ["*Wraps and PPF adhere properly only to factory OEM paint in good condition. We inspect and note existing damage, repaint, rust or peeling clear coat before starting, and we are not responsible for paint that lifts with the film in those areas.", "*Vehicles must arrive clean and free of personal items. We are not responsible for items left inside.", "*Removal of an existing wrap or tint is billed separately.", "*Window tint is installed to Ontario Highway Traffic Act guidelines as we understand them; compliance with laws in other jurisdictions is your responsibility."]],
    ["Cancellations and changes", ["Orders may be cancelled without charge until a proof is approved. After approval, cancellations are charged for work done and materials ordered. Custom-printed goods cannot be cancelled once production has started. See the Orders, Shipping & Returns policy for details."]],
    ["Warranty and liability", ["Our workmanship warranties are described on the Warranty page and are the only warranties we give. To the extent the law allows, our total liability for any order is limited to the amount you paid for it, and we are not liable for indirect or consequential loss such as lost business or downtime.", "Nothing in these terms limits rights you have under the Ontario Consumer Protection Act that cannot be waived."]],
    ["Intellectual property", ["Artwork we create is licensed to you for the project it was created for once paid in full; source files are provided on design-service packages that include them. Ready-made wrap designs are licensed per vehicle as described on their pages. We may show finished work in our portfolio unless you ask us not to in writing."]],
    ["Website use", ["The content of this site is ours or licensed to us. You may not scrape, copy or republish it. Prices and availability shown online may change without notice; obvious errors do not bind us."]],
    ["Governing law", ["These terms are governed by the laws of Ontario and the federal laws of Canada applicable in Ontario. Disputes will be heard in the courts of Ontario. Questions: info@satingraphic.ca · (905) 555-0148."]]]},
  "accessibility": { t: "Accessibility", k: "Legal", d: "Our commitment to making this website and our Vaughan, Ontario facility usable by everyone.", s: [
    ["Our commitment", ["Satin Graphic is committed to providing goods, services and information in a way that respects the dignity and independence of people with disabilities, in accordance with the Accessibility for Ontarians with Disabilities Act (AODA) and the Integrated Accessibility Standards Regulation."]],
    ["This website", ["We aim to meet WCAG 2.1 Level AA. The site is built with semantic HTML, keyboard-operable menus and forms, visible focus states, text alternatives for images, sufficient colour contrast, and it respects reduced-motion preferences. Some product configurators are visual by nature; every one can also be completed by phone or email."]],
    ["Our facility", ["*Step-free entrance and accessible parking at the front of the building.", "*Service animals and support persons are welcome throughout customer areas.", "*Documents such as quotes and proofs can be provided in large print or by email on request.", "*Staff receive AODA customer-service training."]],
    ["Feedback and requests", ["If you have difficulty using any part of this site or our services, or would like this information in another format, contact info@satingraphic.ca or (905) 555-0148. We respond within 5 business days and will work with you to provide what you need."]]]},
};

/* Quote wizard per service */
const QUOTE_SERVICES = ["Vehicle Wraps", "Print Shop", "Apparel", "Window Graphics", "Wallpaper", "Window Tint", "Shop / General"];
const QUOTE_DETAILS = {
  "Vehicle Wraps": [["Vehicle type", ["Sedan", "SUV", "Pickup Truck", "Minivan", "Transit Van", "Sprinter Van", "Cargo Van", "Box Truck", "Trailer", "Bus"]], ["Wrap type", ["Commercial", "Color change", "Paint protection"]], ["Coverage", ["Full Wrap", "Decals + Lettering", "Partial Wrap", "¾ Wrap"]], ["Finish", ["Gloss", "Matte", "Satin", "Satin Chrome / Colour-Flip"]]],
  "Print Shop": [["Product", ["Business Cards", "Flyers", "Postcards", "Brochures", "Door Hangers", "Roll-Up Banner", "Vinyl Banners", "X-Frame Banner", "Yard Signs", "Flags", "A-Frame Signs"]], ["Quantity", ["1–10", "11–100", "101–500", "500–1,000", "1,000+"]], ["Artwork", ["I have print-ready files", "I need design services"]]],
  "Apparel": [["Garment", ["T-Shirts", "Hoodies", "Sweatshirts", "Hats & Caps", "Workwear"]], ["Decoration", ["Screen Print", "Embroidery", "DTF Transfer", "Vinyl (Heat Press)", "Not sure"]], ["Quantity", ["1–11", "12–23", "24–99", "100+"]]],
  "Window Graphics": [["Product", ["Window Decals", "Frosted Vinyl", "Perforated Vinyl", "Full Window Graphics"]], ["Material", ["Regular vinyl", "Blackout film · grey adhesive", "Clear film", "Perforated vinyl", "Single-colour calendered vinyl", "Full-colour digital print"]], ["Installation", ["Professional install", "Self-install (material only)"]], ["Number of panes", ["1", "2–4", "5–10", "10+"]]],
  "Wallpaper": [["Space", ["Home", "Office", "Retail / hospitality", "Other"]], ["Material", ["Standard Removable Vinyl", "Peel & Stick", "Textured Commercial Grade", "Not sure"]], ["Installation", ["Include installation", "Not included"]]],
  "Window Tint": [["Tint for", ["Vehicle", "Commercial building", "Home"]], ["Film", ["Ceramic", "Carbon", "Dyed", "Not sure"]], ["Coverage", ["Front two windows", "Rear + back glass", "All windows", "Site measure needed"]]],
  "Shop / General": [["Topic", ["Vehicle wrap designs", "Vehicle templates", "Design services", "Vehicle wrap prints", "Materials & tools", "Website design", "Something else"]]],
};

/* Home video: keep text and media configuration here. */
const HOME_VIDEO = {
  src: "/satin/video/home-project-v4.mp4",
  poster: "/satin/img/home-white-v3.jpg",
  label: "Vehicle wrapping visual concept",
  eyebrow: "Scroll through the transformation",
  caption: "A visual look at the transformation. Your project starts with a custom design.",
  play: "Play video", pause: "Pause video", replay: "Replay video", scrub: "Drag to explore", scroll: "Scroll to explore",
  steps: [
    ["01 · Your idea", "A clear starting point.", "Tell us about your vehicle, brand and goals. We build a design around them."],
    ["02 · Your design", "Made for your vehicle.", "Artwork, film and finish come together in a proof before production starts."],
    ["03 · Your finish", "Ready for the road.", "Our team prints, prepares and installs your graphics, then checks the finished result."]
  ]
};

/* SEO_MAP_START */
const SEO = {
  "/": {
    "title": "Vehicle Wraps & Printing Toronto | Satin Graphic",
    "description": "Vehicle wraps, printing, apparel and window graphics in Vaughan, serving Toronto and the GTA. Explore options and request a quote from Satin Graphic.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/about": {
    "title": "About Toronto | Satin Graphic",
    "description": "About in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/contact": {
    "title": "Contact Toronto | Satin Graphic",
    "description": "Contact in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/reviews": {
    "title": "Reviews Toronto | Satin Graphic",
    "description": "Reviews in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/faq": {
    "title": "FAQ Toronto | Satin Graphic",
    "description": "FAQ in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/track": {
    "title": "Track Toronto | Satin Graphic",
    "description": "Track in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": true
  },
  "/website-design": {
    "title": "Website Design Toronto | Satin Graphic",
    "description": "Website Design in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/vehicle-wraps": {
    "title": "Vehicle Wraps Toronto | Satin Graphic",
    "description": "Vehicle Wraps in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial": {
    "title": "Commercial Vehicle Wraps Toronto | Satin Graphic",
    "description": "Commercial Vehicle Wraps in Vaughan, serving Toronto and the GTA. Explore film and coverage options and request a quote from Satin Graphic.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial/vans": {
    "title": "Vans Commercial Wraps Toronto | Satin Graphic",
    "description": "Vans in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial/pickups": {
    "title": "Pickups Commercial Wraps Toronto | Satin Graphic",
    "description": "Pickups in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial/box-trucks": {
    "title": "Box Trucks Commercial Wraps Toronto | Satin Graphic",
    "description": "Box Trucks in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial/trailers": {
    "title": "Trailers Commercial Wraps Toronto | Satin Graphic",
    "description": "Trailers in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial/buses": {
    "title": "Buses Commercial Wraps Toronto | Satin Graphic",
    "description": "Buses in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/commercial/fleet-programs": {
    "title": "Fleet Programs Commercial Wraps Toronto | Satin Graphic",
    "description": "Fleet Programs in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/color-change": {
    "title": "Color Change Toronto | Satin Graphic",
    "description": "Color Change in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/paint-protection-film": {
    "title": "Paint Protection Film Toronto | Satin Graphic",
    "description": "Paint Protection Film in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator": {
    "title": "Estimator Toronto | Satin Graphic",
    "description": "Estimator in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/sedan": {
    "title": "Sedan Wrap Cost Toronto | Satin Graphic",
    "description": "Sedan in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/suv": {
    "title": "SUV Wrap Cost Toronto | Satin Graphic",
    "description": "SUV in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/pickup-truck": {
    "title": "Pickup Truck Wrap Cost Toronto | Satin Graphic",
    "description": "Pickup Truck in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/minivan": {
    "title": "Minivan Wrap Cost Toronto | Satin Graphic",
    "description": "Minivan in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/transit-van": {
    "title": "Transit Van Wrap Cost Toronto | Satin Graphic",
    "description": "Transit Van in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/sprinter-van": {
    "title": "Sprinter Van Wrap Cost Toronto | Satin Graphic",
    "description": "Sprinter Van in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/cargo-van": {
    "title": "Cargo Van Wrap Cost Toronto | Satin Graphic",
    "description": "Cargo Van in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/box-truck": {
    "title": "Box Truck Wrap Cost Toronto | Satin Graphic",
    "description": "Box Truck in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/trailer": {
    "title": "Trailer Wrap Cost Toronto | Satin Graphic",
    "description": "Trailer in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/vehicle-wraps/estimator/bus": {
    "title": "Bus Wrap Cost Toronto | Satin Graphic",
    "description": "Bus in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sprinter-wrapped",
    "noindex": false
  },
  "/print-shop": {
    "title": "Print Shop Toronto | Satin Graphic",
    "description": "Print Shop in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/offset": {
    "title": "Offset Toronto | Satin Graphic",
    "description": "Offset in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/offset/business-cards": {
    "title": "Business Cards Toronto | Satin Graphic",
    "description": "Business Cards in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/offset/flyers": {
    "title": "Flyers Toronto | Satin Graphic",
    "description": "Flyers in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/offset/postcards": {
    "title": "Postcards Toronto | Satin Graphic",
    "description": "Postcards in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/offset/brochures": {
    "title": "Brochures Toronto | Satin Graphic",
    "description": "Brochures in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/offset/door-hangers": {
    "title": "Door Hangers Toronto | Satin Graphic",
    "description": "Door Hangers in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format": {
    "title": "Large Format Toronto | Satin Graphic",
    "description": "Large Format in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format/roll-up-banner": {
    "title": "Roll-Up Banner Toronto | Satin Graphic",
    "description": "Roll-Up Banner in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format/vinyl-banners": {
    "title": "Vinyl Banners Toronto | Satin Graphic",
    "description": "Vinyl Banners in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format/x-frame-banner": {
    "title": "X-Frame Banner Toronto | Satin Graphic",
    "description": "X-Frame Banner in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format/yard-signs": {
    "title": "Yard Signs Toronto | Satin Graphic",
    "description": "Yard Signs in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format/flags": {
    "title": "Flags Toronto | Satin Graphic",
    "description": "Flags in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/print-shop/large-format/a-frame-signs": {
    "title": "A-Frame Signs Toronto | Satin Graphic",
    "description": "A-Frame Signs in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "pr-bc-1",
    "noindex": false
  },
  "/apparel": {
    "title": "Apparel Toronto | Satin Graphic",
    "description": "Apparel in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sg-hero",
    "noindex": false
  },
  "/apparel/t-shirts": {
    "title": "T-Shirts Toronto | Satin Graphic",
    "description": "T-Shirts in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sg-hero",
    "noindex": false
  },
  "/apparel/hoodies": {
    "title": "Hoodies Toronto | Satin Graphic",
    "description": "Hoodies in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sg-hero",
    "noindex": false
  },
  "/apparel/sweatshirts": {
    "title": "Sweatshirts Toronto | Satin Graphic",
    "description": "Sweatshirts in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sg-hero",
    "noindex": false
  },
  "/apparel/hats": {
    "title": "Hats & Caps Toronto | Satin Graphic",
    "description": "Hats & Caps in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sg-hero",
    "noindex": false
  },
  "/apparel/workwear": {
    "title": "Workwear Toronto | Satin Graphic",
    "description": "Workwear in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "sg-hero",
    "noindex": false
  },
  "/window-graphics": {
    "title": "Window Graphics Toronto | Satin Graphic",
    "description": "Window Graphics in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-graphics/full-window-graphics": {
    "title": "Full Window Graphics Toronto | Satin Graphic",
    "description": "Full Window Graphics in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-graphics/perforated-vinyl": {
    "title": "Perforated Vinyl Toronto | Satin Graphic",
    "description": "Perforated Vinyl in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-graphics/frosted-vinyl": {
    "title": "Frosted Vinyl Toronto | Satin Graphic",
    "description": "Frosted Vinyl in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-graphics/window-decals": {
    "title": "Window Decals Toronto | Satin Graphic",
    "description": "Window Decals in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-tint": {
    "title": "Window Tint Toronto | Satin Graphic",
    "description": "Window Tint in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-tint/vehicle": {
    "title": "Vehicle Window Tint Toronto | Satin Graphic",
    "description": "Vehicle Window Tint in Vaughan, serving Toronto and the GTA. Explore film and coverage options and request a quote from Satin Graphic.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/window-tint/commercial": {
    "title": "Commercial Window Tint Toronto | Satin Graphic",
    "description": "Commercial Window Tint in Vaughan, serving Toronto and the GTA. Explore film and coverage options and request a quote from Satin Graphic.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/wallpaper": {
    "title": "Wallpaper Toronto | Satin Graphic",
    "description": "Wallpaper in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop": {
    "title": "Shop Toronto | Satin Graphic",
    "description": "Shop in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs": {
    "title": "Wrap Designs Toronto | Satin Graphic",
    "description": "Wrap Designs in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/delivery-dash": {
    "title": "Delivery Dash Wrap Design Toronto | Satin Graphic",
    "description": "Delivery Dash in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/real-estate-modern": {
    "title": "Real Estate Modern Wrap Design Toronto | Satin Graphic",
    "description": "Real Estate Modern in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/cleaning-sparkle": {
    "title": "Cleaning Sparkle Wrap Design Toronto | Satin Graphic",
    "description": "Cleaning Sparkle in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/electric-volt": {
    "title": "Electric Volt Wrap Design Toronto | Satin Graphic",
    "description": "Electric Volt in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/hvac-arctic": {
    "title": "HVAC Arctic Wrap Design Toronto | Satin Graphic",
    "description": "HVAC Arctic in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/plumbing-pro": {
    "title": "Plumbing Pro Wrap Design Toronto | Satin Graphic",
    "description": "Plumbing Pro in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/landscaping-fresh": {
    "title": "Landscaping Fresh Wrap Design Toronto | Satin Graphic",
    "description": "Landscaping Fresh in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/food-truck-feast": {
    "title": "Food Truck Feast Wrap Design Toronto | Satin Graphic",
    "description": "Food Truck Feast in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/construction-fleet": {
    "title": "Construction Fleet Wrap Design Toronto | Satin Graphic",
    "description": "Construction Fleet in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/commercial-clean": {
    "title": "Commercial Clean Wrap Design Toronto | Satin Graphic",
    "description": "Commercial Clean in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/sport-stripe": {
    "title": "Sport Stripe Wrap Design Toronto | Satin Graphic",
    "description": "Sport Stripe in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-designs/abstract-flow": {
    "title": "Abstract Flow Wrap Design Toronto | Satin Graphic",
    "description": "Abstract Flow in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-templates": {
    "title": "Vehicle Templates Toronto | Satin Graphic",
    "description": "Vehicle Templates in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/design-services": {
    "title": "Design Services Toronto | Satin Graphic",
    "description": "Design Services in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/vehicle-wrap-prints": {
    "title": "Wrap Prints Toronto | Satin Graphic",
    "description": "Wrap Prints in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/shop/materials-tools": {
    "title": "Materials & Tools Toronto | Satin Graphic",
    "description": "Materials & Tools in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/login": {
    "title": "Login Toronto | Satin Graphic",
    "description": "Login in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": true
  },
  "/register": {
    "title": "Register Toronto | Satin Graphic",
    "description": "Register in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": true
  },
  "/account": {
    "title": "Account Toronto | Satin Graphic",
    "description": "Account in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": true
  },
  "/warranty": {
    "title": "Warranty Toronto | Satin Graphic",
    "description": "Warranty in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/artwork-guidelines": {
    "title": "Artwork Guidelines Toronto | Satin Graphic",
    "description": "Artwork Guidelines in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/refund-policy": {
    "title": "Orders, Shipping & Returns Toronto | Satin Graphic",
    "description": "Orders, Shipping & Returns in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/privacy-policy": {
    "title": "Privacy Policy Toronto | Satin Graphic",
    "description": "Privacy Policy in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/terms-and-conditions": {
    "title": "Terms & Conditions Toronto | Satin Graphic",
    "description": "Terms & Conditions in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/accessibility": {
    "title": "Accessibility Toronto | Satin Graphic",
    "description": "Accessibility in Vaughan and Toronto/GTA. Explore options, project details and estimates from Satin Graphic. Request a quote for your project.",
    "image": "home-video-poster",
    "noindex": false
  },
  "/404": {
    "title": "Page Not Found | Satin Graphic",
    "description": "This page could not be found. Explore Satin Graphic services or contact our team.",
    "image": "home-video-poster",
    "noindex": true
  }
};

/* IMAGE_SIZES_START */
const IMAGE_SIZES = {"install-detail.jpg":[900,900],"mu-blueprint-living.jpg":[1100,743],"tint-4.jpg":[1100,401],"cc-audi-green.jpg":[1100,401],"pr-brochure-2.jpg":[1100,1100],"job-camaro.jpg":[1050,1400],"job-van-2.jpg":[1400,709],"mu-office-leaves.jpg":[750,750],"job-mx-van.jpg":[1400,709],"pr-real-estate.jpg":[1100,1100],"pr-booklet.jpg":[1100,1100],"pr-postcard-black.jpg":[1100,1100],"pr-sandwich.jpg":[1100,1100],"home-video-v3-poster.jpg":[910,512],"mu-office-workhard.jpg":[1400,1400],"pr-flag-feather.jpg":[1100,1100],"pr-doorhanger.jpg":[1100,1100],"logo-satinauto.jpg":[1000,584],"job-beetle-flip.jpg":[525,394],"pr-flyer-2.jpg":[1100,1100],"pr-brochure.jpg":[1100,1100],"van-wrapped.jpg":[1100,508],"mu-geo.jpg":[1400,1400],"mu-office-leaves-2.jpg":[750,750],"pr-vinyl-banner-2.jpg":[1100,1100],"suv-full-wrapped.jpg":[1100,401],"pr-rollup.jpg":[1100,1100],"pickup-wrapped.jpg":[1100,401],"show-van-3.jpg":[787,1400],"install-film.jpg":[1100,733],"web-6.jpg":[1100,1100],"wall-restaurant.jpg":[1100,824],"mu-bedroom-3d.jpg":[1400,1400],"mu-teal.jpg":[1400,1400],"mu-tropical-living.jpg":[750,750],"pr-rollup-2.jpg":[1100,1100],"web-5.jpg":[1100,1100],"tint-1.jpg":[1100,401],"web-2.jpg":[1100,1100],"mu-tropical.jpg":[750,750],"job-tesla-flip.jpg":[1050,1400],"dec-sprinter-2.jpg":[1100,508],"mu-marble.jpg":[750,750],"pr-bc-black.jpg":[750,750],"office-glass.jpg":[1100,564],"pr-magnet-pickup.jpg":[1100,1100],"suv-bare.jpg":[1100,401],"wrapping-banner.jpg":[1100,515],"ppf-audi-3.jpg":[1100,469],"dec-pickup.jpg":[1100,401],"dec-sedan.jpg":[1100,401],"dec-suv.jpg":[1100,401],"show-van-1.jpg":[787,1400],"floor-graphic.jpg":[1080,608],"reflection.jpg":[1100,733],"cc-suv-green.jpg":[1100,401],"van-bare.jpg":[1100,508],"mu-restaurant-2.jpg":[1400,1400],"pickup-bare.jpg":[1100,401],"logo.png":[483,78],"web-3.jpg":[1100,1100],"pr-flags-row.jpg":[1100,1100],"tint-2.jpg":[1100,401],"sprinter-wrapped-2.jpg":[1100,508],"mu-leaves.jpg":[750,750],"mu-green-marble.jpg":[750,750],"pr-greeting.jpg":[1100,1100],"cc-pickup-green.jpg":[1100,383],"ppf-audi-2.jpg":[1100,469],"cc-audi-bare.jpg":[1100,401],"mu-custom-office.jpg":[750,750],"lambo.jpg":[1100,488],"mu-nursery.jpg":[750,750],"pr-xframe.jpg":[1100,1100],"car-red.jpg":[1100,425],"pr-aframe.jpg":[1100,1100],"sedan-bare.jpg":[1100,401],"pr-tentcard.jpg":[1100,1100],"show-van-2.jpg":[787,1400],"job-merc-green.jpg":[525,394],"job-fence-pickup.jpg":[1400,709],"pr-flyer.jpg":[1100,1100],"detail-hand.jpg":[1100,618],"job-greenlife-van.jpg":[1400,709],"suv-wrapped.jpg":[1100,401],"mu-houses.jpg":[750,750],"sedan-wrapped-2.jpg":[1100,401],"pr-magnet-suv.jpg":[1100,1100],"cc-bmw-green.jpg":[1100,401],"cc-sedan-green.jpg":[1100,401],"pr-bc-2.jpg":[750,750],"web-1.jpg":[1100,1100],"suv-full-bare.jpg":[1100,401],"pr-pole-banner.jpg":[1100,1100],"sprinter-wrapped.jpg":[1100,508],"mu-kids-rainbow.jpg":[1400,1400],"pr-envelope.jpg":[1100,1100],"pr-postcard.jpg":[1100,1100],"dec-smallvan.jpg":[1100,508],"pr-flag-square.jpg":[1100,1100],"pr-backdrop.jpg":[1100,1100],"pr-letterhead.jpg":[1100,1100],"sprinter-bare.jpg":[1100,508],"mu-palms.jpg":[750,750],"pr-vinyl-banner.jpg":[1100,1100],"job-subaru-matte.jpg":[960,1280],"install-tint.jpg":[900,900],"dec-suv-full.jpg":[1100,401],"job-icecream-van.jpg":[1400,709],"ppf-audi-1.jpg":[1100,469],"show-trailer.jpg":[787,1400],"tint-3.jpg":[1100,401],"pr-poster.jpg":[1100,1100],"mu-forest.jpg":[750,750],"tint-levels.jpg":[1100,618],"sedan-wrapped.jpg":[1100,401],"install-orange.jpg":[900,900],"mu-tropical-bed.jpg":[750,750],"web-4.jpg":[1100,1100],"pr-bc-1.jpg":[750,750],"pr-yard-sign.jpg":[1100,1100],"pr-stickers.jpg":[1100,1100],"pr-canvas.jpg":[1100,1100],"cc-half.jpg":[1100,401],"install-ppf.jpg":[1100,638],"pr-doorhanger-2.jpg":[1100,1100],"web-wrap.jpg":[1100,1100],"sg-hero.jpg":[1399,555],"dec-sprinter.jpg":[1100,508],"job-red-van.jpg":[1400,709],"mu-restaurant.jpg":[1400,1400]};

/* Shared interface translations. Internal option values stay in English for pricing. */
const TRANSLATIONS = {
  "Home": {
    "fr": "Accueil",
    "es": "Inicio",
    "fa": "خانه"
  },
  "Vehicle Wraps": {
    "fr": "Habillage de véhicules",
    "es": "Rotulación de vehículos",
    "fa": "رپ خودرو"
  },
  "Commercial Wraps": {
    "fr": "Habillage commercial",
    "es": "Rotulación comercial",
    "fa": "رپ تجاری"
  },
  "Commercial Wrap": {
    "fr": "Habillage commercial",
    "es": "Rotulación comercial",
    "fa": "رپ تجاری"
  },
  "Commercial wrap": {
    "fr": "Habillage commercial",
    "es": "Rotulación comercial",
    "fa": "رپ تجاری"
  },
  "Commercial wraps": {
    "fr": "Habillage commercial",
    "es": "Rotulación comercial",
    "fa": "رپ تجاری"
  },
  "Commercial": {
    "fr": "Commercial",
    "es": "Comercial",
    "fa": "تجاری"
  },
  "Color Change": {
    "fr": "Changement de couleur",
    "es": "Cambio de color",
    "fa": "تغییر رنگ"
  },
  "Color change": {
    "fr": "Changement de couleur",
    "es": "Cambio de color",
    "fa": "تغییر رنگ"
  },
  "Color change wrap": {
    "fr": "Habillage de couleur",
    "es": "Vinilo de cambio de color",
    "fa": "رپ تغییر رنگ"
  },
  "Color Change & PPF": {
    "fr": "Couleur et PPF",
    "es": "Color y PPF",
    "fa": "تغییر رنگ و محافظ رنگ"
  },
  "Paint Protection Film": {
    "fr": "Film de protection de peinture",
    "es": "Película protectora de pintura",
    "fa": "فیلم محافظ رنگ"
  },
  "Paint protection film": {
    "fr": "Film de protection de peinture",
    "es": "Película protectora de pintura",
    "fa": "فیلم محافظ رنگ"
  },
  "Price Estimator": {
    "fr": "Estimateur de prix",
    "es": "Calculadora de precios",
    "fa": "محاسبه قیمت"
  },
  "Price estimator": {
    "fr": "Estimateur de prix",
    "es": "Calculadora de precios",
    "fa": "محاسبه قیمت"
  },
  "Open estimator": {
    "fr": "Ouvrir l’estimateur",
    "es": "Abrir calculadora",
    "fa": "باز کردن محاسبه‌گر"
  },
  "Open price estimator": {
    "fr": "Estimer le prix",
    "es": "Calcular precio",
    "fa": "محاسبه قیمت"
  },
  "Print Shop": {
    "fr": "Imprimerie",
    "es": "Imprenta",
    "fa": "چاپخانه"
  },
  "Print shop": {
    "fr": "Imprimerie",
    "es": "Imprenta",
    "fa": "چاپخانه"
  },
  "Offset Printing": {
    "fr": "Impression offset",
    "es": "Impresión offset",
    "fa": "چاپ افست"
  },
  "Offset printing": {
    "fr": "Impression offset",
    "es": "Impresión offset",
    "fa": "چاپ افست"
  },
  "Large Format": {
    "fr": "Grand format",
    "es": "Gran formato",
    "fa": "چاپ لارج فرمت"
  },
  "Large format": {
    "fr": "Grand format",
    "es": "Gran formato",
    "fa": "چاپ لارج فرمت"
  },
  "Apparel": {
    "fr": "Vêtements personnalisés",
    "es": "Ropa personalizada",
    "fa": "پوشاک سفارشی"
  },
  "Custom Apparel": {
    "fr": "Vêtements personnalisés",
    "es": "Ropa personalizada",
    "fa": "پوشاک سفارشی"
  },
  "Window Graphics": {
    "fr": "Graphiques pour vitrines",
    "es": "Gráficos para ventanas",
    "fa": "گرافیک شیشه"
  },
  "Window graphics": {
    "fr": "Graphiques pour vitrines",
    "es": "Gráficos para ventanas",
    "fa": "گرافیک شیشه"
  },
  "Windows & Walls": {
    "fr": "Vitres et murs",
    "es": "Ventanas y paredes",
    "fa": "شیشه و دیوار"
  },
  "Window Tint": {
    "fr": "Vitres teintées",
    "es": "Polarizado de ventanas",
    "fa": "دودی شیشه"
  },
  "Window tint": {
    "fr": "Vitres teintées",
    "es": "Polarizado de ventanas",
    "fa": "دودی شیشه"
  },
  "Vehicle tint": {
    "fr": "Vitres teintées pour véhicules",
    "es": "Polarizado de vehículos",
    "fa": "دودی شیشه خودرو"
  },
  "Commercial tint": {
    "fr": "Film solaire commercial",
    "es": "Polarizado comercial",
    "fa": "دودی شیشه تجاری"
  },
  "Wallpaper": {
    "fr": "Papier peint",
    "es": "Papel tapiz",
    "fa": "کاغذ دیواری"
  },
  "Shop": {
    "fr": "Boutique",
    "es": "Tienda",
    "fa": "فروشگاه"
  },
  "Vehicle wrap designs": {
    "fr": "Modèles d’habillage",
    "es": "Diseños de rotulación",
    "fa": "طرح‌های رپ خودرو"
  },
  "Vehicle Wrap Designs": {
    "fr": "Modèles d’habillage",
    "es": "Diseños de rotulación",
    "fa": "طرح‌های رپ خودرو"
  },
  "Vehicle templates": {
    "fr": "Gabarits de véhicules",
    "es": "Plantillas de vehículos",
    "fa": "تمپلیت خودرو"
  },
  "Vehicle Templates": {
    "fr": "Gabarits de véhicules",
    "es": "Plantillas de vehículos",
    "fa": "تمپلیت خودرو"
  },
  "Design services": {
    "fr": "Services de design",
    "es": "Servicios de diseño",
    "fa": "خدمات طراحی"
  },
  "Design Services": {
    "fr": "Services de design",
    "es": "Servicios de diseño",
    "fa": "خدمات طراحی"
  },
  "Vehicle wrap prints": {
    "fr": "Impression pour habillage",
    "es": "Impresiones para rotulación",
    "fa": "چاپ رپ خودرو"
  },
  "Materials & tools": {
    "fr": "Matériaux et outils",
    "es": "Materiales y herramientas",
    "fa": "متریال و ابزار"
  },
  "Materials & Tools": {
    "fr": "Matériaux et outils",
    "es": "Materiales y herramientas",
    "fa": "متریال و ابزار"
  },
  "Website design": {
    "fr": "Création de sites Web",
    "es": "Diseño web",
    "fa": "طراحی وب‌سایت"
  },
  "Website Design": {
    "fr": "Création de sites Web",
    "es": "Diseño web",
    "fa": "طراحی وب‌سایت"
  },
  "About": {
    "fr": "À propos",
    "es": "Nosotros",
    "fa": "درباره ما"
  },
  "About Satin Graphic": {
    "fr": "À propos de Satin Graphic",
    "es": "Sobre Satin Graphic",
    "fa": "درباره ستین گرافیک"
  },
  "Contact": {
    "fr": "Contact",
    "es": "Contacto",
    "fa": "تماس با ما"
  },
  "Reviews": {
    "fr": "Avis",
    "es": "Reseñas",
    "fa": "نظر مشتریان"
  },
  "FAQ": {
    "fr": "Questions fréquentes",
    "es": "Preguntas frecuentes",
    "fa": "سوالات متداول"
  },
  "Track": {
    "fr": "Suivi",
    "es": "Seguimiento",
    "fa": "پیگیری"
  },
  "Track order": {
    "fr": "Suivre une commande",
    "es": "Seguir pedido",
    "fa": "پیگیری سفارش"
  },
  "Track an order": {
    "fr": "Suivre une commande",
    "es": "Seguir pedido",
    "fa": "پیگیری سفارش"
  },
  "Login": {
    "fr": "Connexion",
    "es": "Iniciar sesión",
    "fa": "ورود"
  },
  "Log in": {
    "fr": "Se connecter",
    "es": "Iniciar sesión",
    "fa": "ورود"
  },
  "Register": {
    "fr": "Inscription",
    "es": "Registrarse",
    "fa": "ثبت‌نام"
  },
  "Account": {
    "fr": "Compte",
    "es": "Cuenta",
    "fa": "حساب کاربری"
  },
  "My account": {
    "fr": "Mon compte",
    "es": "Mi cuenta",
    "fa": "حساب من"
  },
  "Get a quote": {
    "fr": "Demander un devis",
    "es": "Solicitar presupuesto",
    "fa": "درخواست قیمت"
  },
  "Start a quote": {
    "fr": "Demander un devis",
    "es": "Solicitar presupuesto",
    "fa": "درخواست قیمت"
  },
  "Get a wrap quote": {
    "fr": "Demander un devis d’habillage",
    "es": "Presupuesto de rotulación",
    "fa": "درخواست قیمت رپ"
  },
  "See our work": {
    "fr": "Voir nos réalisations",
    "es": "Ver nuestros trabajos",
    "fa": "دیدن نمونه کارها"
  },
  "See all projects": {
    "fr": "Voir tous les projets",
    "es": "Ver todos los proyectos",
    "fa": "دیدن همه پروژه‌ها"
  },
  "View full portfolio": {
    "fr": "Voir le portfolio",
    "es": "Ver portafolio",
    "fa": "دیدن نمونه کارها"
  },
  "Explore": {
    "fr": "Découvrir",
    "es": "Explorar",
    "fa": "بیشتر ببینید"
  },
  "Open": {
    "fr": "Ouvrir",
    "es": "Abrir",
    "fa": "باز کردن"
  },
  "Services": {
    "fr": "Services",
    "es": "Servicios",
    "fa": "خدمات"
  },
  "Company": {
    "fr": "Entreprise",
    "es": "Empresa",
    "fa": "شرکت"
  },
  "Help": {
    "fr": "Aide",
    "es": "Ayuda",
    "fa": "راهنما"
  },
  "Help & policies": {
    "fr": "Aide et politiques",
    "es": "Ayuda y políticas",
    "fa": "راهنما و قوانین"
  },
  "Print & more": {
    "fr": "Impression et plus",
    "es": "Impresión y más",
    "fa": "چاپ و خدمات دیگر"
  },
  "Artwork guidelines": {
    "fr": "Consignes pour les fichiers",
    "es": "Guía de archivos",
    "fa": "راهنمای فایل طراحی"
  },
  "Warranty": {
    "fr": "Garantie",
    "es": "Garantía",
    "fa": "گارانتی"
  },
  "Orders & shipping": {
    "fr": "Commandes et livraison",
    "es": "Pedidos y envíos",
    "fa": "سفارش و ارسال"
  },
  "Orders, shipping & returns": {
    "fr": "Commandes, livraison et retours",
    "es": "Pedidos, envíos y devoluciones",
    "fa": "سفارش، ارسال و مرجوعی"
  },
  "Privacy policy": {
    "fr": "Politique de confidentialité",
    "es": "Política de privacidad",
    "fa": "حریم خصوصی"
  },
  "Terms & conditions": {
    "fr": "Conditions générales",
    "es": "Términos y condiciones",
    "fa": "شرایط و قوانین"
  },
  "Accessibility": {
    "fr": "Accessibilité",
    "es": "Accesibilidad",
    "fa": "دسترس‌پذیری"
  },
  "Subscribe": {
    "fr": "S’abonner",
    "es": "Suscribirse",
    "fa": "عضویت"
  },
  "Email for project tips": {
    "fr": "Courriel pour nos conseils",
    "es": "Correo para consejos",
    "fa": "ایمیل برای نکته‌های کاربردی"
  },
  "Email for newsletter": {
    "fr": "Courriel pour l’infolettre",
    "es": "Correo para boletín",
    "fa": "ایمیل خبرنامه"
  },
  "Skip to content": {
    "fr": "Aller au contenu",
    "es": "Saltar al contenido",
    "fa": "رفتن به محتوا"
  },
  "Satin Graphic home": {
    "fr": "Accueil de Satin Graphic",
    "es": "Inicio de Satin Graphic",
    "fa": "خانه ستین گرافیک"
  },
  "Main": {
    "fr": "Navigation principale",
    "es": "Navegación principal",
    "fa": "منوی اصلی"
  },
  "Open quote cart": {
    "fr": "Ouvrir le panier de devis",
    "es": "Abrir cesta de presupuesto",
    "fa": "باز کردن سبد درخواست قیمت"
  },
  "Open menu": {
    "fr": "Ouvrir le menu",
    "es": "Abrir menú",
    "fa": "باز کردن منو"
  },
  "Close menu": {
    "fr": "Fermer le menu",
    "es": "Cerrar menú",
    "fa": "بستن منو"
  },
  "Close": {
    "fr": "Fermer",
    "es": "Cerrar",
    "fa": "بستن"
  },
  "Menu": {
    "fr": "Menu",
    "es": "Menú",
    "fa": "منو"
  },
  "Language": {
    "fr": "Langue",
    "es": "Idioma",
    "fa": "زبان"
  },
  "Play video": {
    "fr": "Lire la vidéo",
    "es": "Reproducir video",
    "fa": "پخش ویدئو"
  },
  "Pause video": {
    "fr": "Mettre en pause",
    "es": "Pausar video",
    "fa": "توقف ویدئو"
  },
  "Replay video": {
    "fr": "Revoir la vidéo",
    "es": "Repetir video",
    "fa": "پخش دوباره"
  },
  "Drag to explore": {
    "fr": "Faites glisser pour explorer",
    "es": "Arrastra para explorar",
    "fa": "برای دیدن مراحل بکشید"
  },
  "Scroll to explore": {
    "fr": "Défilez pour explorer",
    "es": "Desplázate para explorar",
    "fa": "برای دیدن مراحل اسکرول کنید"
  },
  "Scroll through the transformation": {
    "fr": "Défilez pour voir la transformation",
    "es": "Desplázate por la transformación",
    "fa": "با اسکرول تغییر را ببینید"
  },
  "Vehicle wrapping visual concept": {
    "fr": "Concept visuel d’habillage de véhicule",
    "es": "Concepto visual de rotulación",
    "fa": "نمایش مفهومی رپ خودرو"
  },
  "A visual look at the transformation. Your project starts with a custom design.": {
    "fr": "Un aperçu de la transformation. Votre projet commence par un design sur mesure.",
    "es": "Una mirada a la transformación. Tu proyecto comienza con un diseño personalizado.",
    "fa": "نمایی از تغییر ظاهر خودرو؛ پروژه شما با یک طراحی اختصاصی شروع می‌شود."
  },
  "01 · Your idea": {
    "fr": "01 · Votre idée",
    "es": "01 · Tu idea",
    "fa": "۰۱ · ایده شما"
  },
  "02 · Your design": {
    "fr": "02 · Votre design",
    "es": "02 · Tu diseño",
    "fa": "۰۲ · طراحی شما"
  },
  "03 · Your finish": {
    "fr": "03 · Le résultat",
    "es": "03 · Tu acabado",
    "fa": "۰۳ · نتیجه نهایی"
  },
  "A clear starting point.": {
    "fr": "Un point de départ clair.",
    "es": "Un punto de partida claro.",
    "fa": "یک شروع روشن."
  },
  "Made for your vehicle.": {
    "fr": "Conçu pour votre véhicule.",
    "es": "Hecho para tu vehículo.",
    "fa": "طراحی‌شده برای خودرو شما."
  },
  "Ready for the road.": {
    "fr": "Prêt pour la route.",
    "es": "Listo para la carretera.",
    "fa": "آماده برای جاده."
  },
  "Tell us about your vehicle, brand and goals. We build a design around them.": {
    "fr": "Parlez-nous de votre véhicule, de votre marque et de vos objectifs. Nous créons un design adapté.",
    "es": "Cuéntanos sobre tu vehículo, marca y objetivos. Creamos un diseño a tu medida.",
    "fa": "از خودرو، برند و هدفتان بگویید؛ طراحی را بر همان اساس آماده می‌کنیم."
  },
  "Artwork, film and finish come together in a proof before production starts.": {
    "fr": "Le visuel, le film et la finition sont réunis dans une épreuve avant la production.",
    "es": "El diseño, el vinilo y el acabado se presentan en una prueba antes de producir.",
    "fa": "طرح، متریال و پوشش نهایی پیش از تولید در پیش‌نمایش تایید می‌شوند."
  },
  "Our team prints, prepares and installs your graphics, then checks the finished result.": {
    "fr": "Notre équipe imprime, prépare et installe vos graphiques, puis vérifie le résultat.",
    "es": "Nuestro equipo imprime, prepara e instala tus gráficos y revisa el resultado.",
    "fa": "تیم ما طرح را چاپ، آماده و نصب می‌کند و نتیجه نهایی را بررسی می‌کند."
  },
  "Business Cards": {
    "fr": "Cartes professionnelles",
    "es": "Tarjetas de presentación",
    "fa": "کارت ویزیت"
  },
  "Business cards": {
    "fr": "Cartes professionnelles",
    "es": "Tarjetas de presentación",
    "fa": "کارت ویزیت"
  },
  "Flyers": {
    "fr": "Dépliants publicitaires",
    "es": "Volantes",
    "fa": "تراکت"
  },
  "Postcards": {
    "fr": "Cartes postales",
    "es": "Postales",
    "fa": "کارت پستال"
  },
  "Brochures": {
    "fr": "Brochures",
    "es": "Folletos",
    "fa": "بروشور"
  },
  "Door Hangers": {
    "fr": "Accroche-portes",
    "es": "Colgadores de puerta",
    "fa": "آویز در"
  },
  "Roll-Up Banner": {
    "fr": "Bannière rétractable",
    "es": "Banner enrollable",
    "fa": "رول‌آپ بنر"
  },
  "Vinyl Banners": {
    "fr": "Bannières en vinyle",
    "es": "Banners de vinilo",
    "fa": "بنر واینال"
  },
  "X-Frame Banner": {
    "fr": "Bannière en X",
    "es": "Banner en X",
    "fa": "بنر ایکس‌فریم"
  },
  "Yard Signs": {
    "fr": "Enseignes de pelouse",
    "es": "Carteles de jardín",
    "fa": "تابلو محوطه"
  },
  "Flags": {
    "fr": "Drapeaux",
    "es": "Banderas",
    "fa": "پرچم"
  },
  "A-Frame Signs": {
    "fr": "Enseignes en A",
    "es": "Carteles en A",
    "fa": "تابلو ای‌فریم"
  },
  "T-Shirts": {
    "fr": "T-shirts",
    "es": "Camisetas",
    "fa": "تی‌شرت"
  },
  "Hoodies": {
    "fr": "Sweats à capuche",
    "es": "Sudaderas con capucha",
    "fa": "هودی"
  },
  "Sweatshirts": {
    "fr": "Chandails molletonnés",
    "es": "Sudaderas",
    "fa": "سویشرت"
  },
  "Hats": {
    "fr": "Casquettes",
    "es": "Gorras",
    "fa": "کلاه"
  },
  "Workwear": {
    "fr": "Vêtements de travail",
    "es": "Ropa de trabajo",
    "fa": "لباس کار"
  },
  "Vans": {
    "fr": "Fourgonnettes",
    "es": "Furgonetas",
    "fa": "ون"
  },
  "Pickups": {
    "fr": "Camionnettes",
    "es": "Camionetas",
    "fa": "پیکاپ"
  },
  "Box Trucks": {
    "fr": "Camions fourgons",
    "es": "Camiones de caja",
    "fa": "کامیون اتاق‌دار"
  },
  "Trailers": {
    "fr": "Remorques",
    "es": "Remolques",
    "fa": "تریلر"
  },
  "Buses": {
    "fr": "Autobus",
    "es": "Autobuses",
    "fa": "اتوبوس"
  },
  "Fleet Programs": {
    "fr": "Programmes de flotte",
    "es": "Programas de flota",
    "fa": "برنامه ناوگان"
  },
  "Sedan": {
    "fr": "Berline",
    "es": "Sedán",
    "fa": "سدان"
  },
  "SUV": {
    "fr": "VUS",
    "es": "SUV",
    "fa": "شاسی‌بلند"
  },
  "Pickup Truck": {
    "fr": "Camionnette",
    "es": "Camioneta",
    "fa": "پیکاپ"
  },
  "Minivan": {
    "fr": "Minifourgonnette",
    "es": "Minivan",
    "fa": "مینی‌ون"
  },
  "Transit Van": {
    "fr": "Fourgonnette Transit",
    "es": "Furgoneta Transit",
    "fa": "ون ترانزیت"
  },
  "Sprinter Van": {
    "fr": "Fourgonnette Sprinter",
    "es": "Furgoneta Sprinter",
    "fa": "ون اسپرینتر"
  },
  "Cargo Van": {
    "fr": "Fourgonnette utilitaire",
    "es": "Furgoneta de carga",
    "fa": "ون باربری"
  },
  "Box Truck": {
    "fr": "Camion fourgon",
    "es": "Camión de caja",
    "fa": "کامیون اتاق‌دار"
  },
  "Trailer": {
    "fr": "Remorque",
    "es": "Remolque",
    "fa": "تریلر"
  },
  "Bus": {
    "fr": "Autobus",
    "es": "Autobús",
    "fa": "اتوبوس"
  },
  "Full Window Graphics": {
    "fr": "Graphiques pleine vitre",
    "es": "Gráficos de ventana completa",
    "fa": "پوشش کامل شیشه"
  },
  "Perforated Vinyl": {
    "fr": "Vinyle perforé",
    "es": "Vinilo perforado",
    "fa": "واینال مش"
  },
  "Frosted Vinyl": {
    "fr": "Vinyle dépoli",
    "es": "Vinilo esmerilado",
    "fa": "واینال فراست"
  },
  "Window Decals": {
    "fr": "Autocollants pour vitres",
    "es": "Calcomanías para ventanas",
    "fa": "استیکر شیشه"
  },
  "Full window graphics": {
    "fr": "Graphiques pleine vitre",
    "es": "Gráficos de ventana completa",
    "fa": "پوشش کامل شیشه"
  },
  "Perforated vinyl": {
    "fr": "Vinyle perforé",
    "es": "Vinilo perforado",
    "fa": "واینال مش"
  },
  "Frosted vinyl": {
    "fr": "Vinyle dépoli",
    "es": "Vinilo esmerilado",
    "fa": "واینال فراست"
  },
  "Window decals": {
    "fr": "Autocollants pour vitres",
    "es": "Calcomanías para ventanas",
    "fa": "استیکر شیشه"
  },
  "Decoration": {
    "fr": "Marquage",
    "es": "Personalización",
    "fa": "چاپ و تزئین"
  },
  "Screen print": {
    "fr": "Sérigraphie",
    "es": "Serigrafía",
    "fa": "چاپ سیلک"
  },
  "Embroidery": {
    "fr": "Broderie",
    "es": "Bordado",
    "fa": "گلدوزی"
  },
  "DTF transfer": {
    "fr": "Transfert DTF",
    "es": "Transferencia DTF",
    "fa": "ترانسفر DTF"
  },
  "Heat-press vinyl": {
    "fr": "Vinyle thermocollant",
    "es": "Vinilo textil",
    "fa": "واینال حرارتی"
  },
  "Office": {
    "fr": "Bureau",
    "es": "Oficina",
    "fa": "دفتر کار"
  },
  "Custom": {
    "fr": "Sur mesure",
    "es": "Personalizado",
    "fa": "سفارشی"
  },
  "Your estimate": {
    "fr": "Votre estimation",
    "es": "Tu estimación",
    "fa": "برآورد قیمت شما"
  },
  "Add to quote cart": {
    "fr": "Ajouter au panier de devis",
    "es": "Añadir a cesta de presupuesto",
    "fa": "افزودن به سبد قیمت"
  },
  "Quote cart": {
    "fr": "Panier de devis",
    "es": "Cesta de presupuesto",
    "fa": "سبد درخواست قیمت"
  },
  "Your quote cart is empty": {
    "fr": "Votre panier est vide",
    "es": "Tu cesta está vacía",
    "fa": "سبد درخواست قیمت خالی است"
  },
  "Estimated total": {
    "fr": "Total estimé",
    "es": "Total estimado",
    "fa": "جمع برآورد"
  },
  "Keep browsing": {
    "fr": "Continuer à parcourir",
    "es": "Seguir explorando",
    "fa": "ادامه بازدید"
  },
  "Remove": {
    "fr": "Supprimer",
    "es": "Eliminar",
    "fa": "حذف"
  },
  "Quoted": {
    "fr": "Sur devis",
    "es": "A cotizar",
    "fa": "نیازمند استعلام"
  },
  "Request quote for these items": {
    "fr": "Demander un devis pour ces articles",
    "es": "Solicitar presupuesto de estos artículos",
    "fa": "درخواست قیمت برای این موارد"
  },
  "Browse the print shop": {
    "fr": "Parcourir l’imprimerie",
    "es": "Explorar imprenta",
    "fa": "دیدن محصولات چاپی"
  },
  "Quantity": {
    "fr": "Quantité",
    "es": "Cantidad",
    "fa": "تعداد"
  },
  "Qty": {
    "fr": "Qté",
    "es": "Cant.",
    "fa": "تعداد"
  },
  "Material": {
    "fr": "Matériau",
    "es": "Material",
    "fa": "متریال"
  },
  "Finish": {
    "fr": "Finition",
    "es": "Acabado",
    "fa": "پوشش نهایی"
  },
  "Coverage": {
    "fr": "Couverture",
    "es": "Cobertura",
    "fa": "میزان پوشش"
  },
  "Roof": {
    "fr": "Toit",
    "es": "Techo",
    "fa": "سقف"
  },
  "Design": {
    "fr": "Design",
    "es": "Diseño",
    "fa": "طراحی"
  },
  "Design service": {
    "fr": "Service de design",
    "es": "Servicio de diseño",
    "fa": "خدمات طراحی"
  },
  "Design assistance": {
    "fr": "Aide au design",
    "es": "Ayuda de diseño",
    "fa": "کمک در طراحی"
  },
  "Width (ft)": {
    "fr": "Largeur (pi)",
    "es": "Ancho (pies)",
    "fa": "عرض (فوت)"
  },
  "Height (ft)": {
    "fr": "Hauteur (pi)",
    "es": "Alto (pies)",
    "fa": "ارتفاع (فوت)"
  },
  "Width (in)": {
    "fr": "Largeur (po)",
    "es": "Ancho (pulgadas)",
    "fa": "عرض (اینچ)"
  },
  "Height (in)": {
    "fr": "Hauteur (po)",
    "es": "Alto (pulgadas)",
    "fa": "ارتفاع (اینچ)"
  },
  "Width": {
    "fr": "Largeur",
    "es": "Ancho",
    "fa": "عرض"
  },
  "Height": {
    "fr": "Hauteur",
    "es": "Alto",
    "fa": "ارتفاع"
  },
  "Installation": {
    "fr": "Installation",
    "es": "Instalación",
    "fa": "نصب"
  },
  "Professional installation": {
    "fr": "Installation professionnelle",
    "es": "Instalación profesional",
    "fa": "نصب حرفه‌ای"
  },
  "Yes": {
    "fr": "Oui",
    "es": "Sí",
    "fa": "بله"
  },
  "No": {
    "fr": "Non",
    "es": "No",
    "fa": "خیر"
  },
  "Full": {
    "fr": "Complet",
    "es": "Completo",
    "fa": "کامل"
  },
  "Full wrap": {
    "fr": "Habillage complet",
    "es": "Rotulación completa",
    "fa": "رپ کامل"
  },
  "Partial": {
    "fr": "Partiel",
    "es": "Parcial",
    "fa": "نیمه"
  },
  "Partial wrap": {
    "fr": "Habillage partiel",
    "es": "Rotulación parcial",
    "fa": "رپ جزئی"
  },
  "Decals": {
    "fr": "Autocollants",
    "es": "Calcomanías",
    "fa": "استیکر"
  },
  "Gloss": {
    "fr": "Brillant",
    "es": "Brillante",
    "fa": "براق"
  },
  "Matte": {
    "fr": "Mat",
    "es": "Mate",
    "fa": "مات"
  },
  "Satin": {
    "fr": "Satiné",
    "es": "Satinado",
    "fa": "ساتین"
  },
  "Satin Chrome": {
    "fr": "Chrome satiné",
    "es": "Cromo satinado",
    "fa": "کروم ساتین"
  },
  "Colour-Flip": {
    "fr": "Couleur changeante",
    "es": "Color cambiante",
    "fa": "رنگ متغیر"
  },
  "Ceramic": {
    "fr": "Céramique",
    "es": "Cerámico",
    "fa": "سرامیک"
  },
  "Carbon": {
    "fr": "Carbone",
    "es": "Carbono",
    "fa": "کربن"
  },
  "Dyed": {
    "fr": "Teinté",
    "es": "Teñido",
    "fa": "رنگی"
  },
  "Standard": {
    "fr": "Standard",
    "es": "Estándar",
    "fa": "استاندارد"
  },
  "Peel & Stick": {
    "fr": "Autocollant",
    "es": "Autoadhesivo",
    "fa": "خودچسب"
  },
  "Textured": {
    "fr": "Texturé",
    "es": "Texturizado",
    "fa": "بافت‌دار"
  },
  "Name": {
    "fr": "Nom",
    "es": "Nombre",
    "fa": "نام"
  },
  "Full name": {
    "fr": "Nom complet",
    "es": "Nombre completo",
    "fa": "نام و نام خانوادگی"
  },
  "Email": {
    "fr": "Courriel",
    "es": "Correo electrónico",
    "fa": "ایمیل"
  },
  "Email address": {
    "fr": "Adresse courriel",
    "es": "Correo electrónico",
    "fa": "آدرس ایمیل"
  },
  "Phone": {
    "fr": "Téléphone",
    "es": "Teléfono",
    "fa": "تلفن"
  },
  "Company name": {
    "fr": "Nom de l’entreprise",
    "es": "Nombre de empresa",
    "fa": "نام شرکت"
  },
  "Message": {
    "fr": "Message",
    "es": "Mensaje",
    "fa": "پیام"
  },
  "Send message": {
    "fr": "Envoyer le message",
    "es": "Enviar mensaje",
    "fa": "ارسال پیام"
  },
  "Password": {
    "fr": "Mot de passe",
    "es": "Contraseña",
    "fa": "رمز عبور"
  },
  "Confirm password": {
    "fr": "Confirmer le mot de passe",
    "es": "Confirmar contraseña",
    "fa": "تکرار رمز عبور"
  },
  "Create account": {
    "fr": "Créer un compte",
    "es": "Crear cuenta",
    "fa": "ساخت حساب"
  },
  "Continue": {
    "fr": "Continuer",
    "es": "Continuar",
    "fa": "ادامه"
  },
  "Next": {
    "fr": "Suivant",
    "es": "Siguiente",
    "fa": "بعدی"
  },
  "Back": {
    "fr": "Retour",
    "es": "Atrás",
    "fa": "بازگشت"
  },
  "Submit": {
    "fr": "Envoyer",
    "es": "Enviar",
    "fa": "ثبت"
  },
  "Upload artwork": {
    "fr": "Téléverser un fichier",
    "es": "Subir diseño",
    "fa": "آپلود فایل طراحی"
  },
  "File attached": {
    "fr": "Fichier joint",
    "es": "Archivo adjunto",
    "fa": "فایل اضافه شد"
  },
  "Details": {
    "fr": "Détails",
    "es": "Detalles",
    "fa": "جزئیات"
  },
  "Order number": {
    "fr": "Numéro de commande",
    "es": "Número de pedido",
    "fa": "شماره سفارش"
  },
  "Page map": {
    "fr": "Plan des pages",
    "es": "Mapa de páginas",
    "fa": "نقشه صفحات"
  },
  "Recent work": {
    "fr": "Réalisations récentes",
    "es": "Trabajos recientes",
    "fa": "نمونه کارهای اخیر"
  },
  "Selected projects": {
    "fr": "Projets sélectionnés",
    "es": "Proyectos seleccionados",
    "fa": "پروژه‌های منتخب"
  },
  "Related work": {
    "fr": "Réalisations similaires",
    "es": "Trabajos relacionados",
    "fa": "کارهای مرتبط"
  },
  "How it works": {
    "fr": "Comment ça fonctionne",
    "es": "Cómo funciona",
    "fa": "مراحل کار"
  },
  "Get started": {
    "fr": "Commencer",
    "es": "Comenzar",
    "fa": "شروع کنید"
  },
  "Vehicle": {
    "fr": "Véhicule",
    "es": "Vehículo",
    "fa": "خودرو"
  },
  "Product": {
    "fr": "Produit",
    "es": "Producto",
    "fa": "محصول"
  },
  "Contact us": {
    "fr": "Contactez-nous",
    "es": "Contáctanos",
    "fa": "تماس با ما"
  },
  "Location": {
    "fr": "Emplacement",
    "es": "Ubicación",
    "fa": "موقعیت"
  },
  "Hours": {
    "fr": "Horaires",
    "es": "Horario",
    "fa": "ساعت کاری"
  },
  "View": {
    "fr": "Voir",
    "es": "Ver",
    "fa": "مشاهده"
  },
  "FROM": {
    "fr": "À PARTIR DE",
    "es": "DESDE",
    "fa": "از"
  },
  "from": {
    "fr": "à partir de",
    "es": "desde",
    "fa": "از"
  },
  "Options": {
    "fr": "Options",
    "es": "Opciones",
    "fa": "گزینه‌ها"
  },
  "Choose your vehicle": {
    "fr": "Choisissez votre véhicule",
    "es": "Elige tu vehículo",
    "fa": "خودرو را انتخاب کنید"
  },
  "Choose your service": {
    "fr": "Choisissez votre service",
    "es": "Elige tu servicio",
    "fa": "خدمت را انتخاب کنید"
  },
  "Choose a service": {
    "fr": "Choisissez un service",
    "es": "Elige un servicio",
    "fa": "یک خدمت انتخاب کنید"
  },
  "See your logo on it": {
    "fr": "Visualisez votre logo",
    "es": "Visualiza tu logo",
    "fa": "لوگوی خود را ببینید"
  },
  "All vehicle wraps": {
    "fr": "Tous les habillages",
    "es": "Todas las rotulaciones",
    "fa": "همه خدمات رپ"
  },
  "All print shop": {
    "fr": "Toute l’imprimerie",
    "es": "Toda la imprenta",
    "fa": "همه محصولات چاپی"
  },
  "All apparel": {
    "fr": "Tous les vêtements",
    "es": "Toda la ropa",
    "fa": "همه پوشاک"
  },
  "All window graphics": {
    "fr": "Tous les graphiques pour vitres",
    "es": "Todos los gráficos de ventanas",
    "fa": "همه خدمات گرافیک شیشه"
  },
  "All shop": {
    "fr": "Toute la boutique",
    "es": "Toda la tienda",
    "fa": "همه محصولات فروشگاه"
  },
  "Vehicle wraps": {
    "fr": "Habillage de véhicules",
    "es": "Rotulación de vehículos",
    "fa": "رپ خودرو"
  },
  "Print": {
    "fr": "Impression",
    "es": "Impresión",
    "fa": "چاپ"
  },
  "Graphics": {
    "fr": "Graphiques",
    "es": "Gráficos",
    "fa": "گرافیک"
  }
};

/* Homepage copy authored separately in each language. */
const HOME_CONTENT = {
  "copy": {
    "en": {
      "kicker": "Vehicle wraps · Print · Apparel · Graphics",
      "headline": [
        "Your brand.",
        "Every surface."
      ],
      "intro": "Vehicle wraps, print, apparel and window graphics. Designed, produced and installed by one team in Vaughan, serving Toronto and the GTA.",
      "servicesKicker": "What we do",
      "servicesTitle": "One team. Your whole brand.",
      "servicesIntro": "Choose a service, explore the options and build your estimate.",
      "workKicker": "Our work",
      "workTitle": "Made here. Seen everywhere.",
      "workIntro": "A selection of vehicle projects from our workshop.",
      "processKicker": "From idea to installation",
      "processTitle": "Clear steps. A consistent result.",
      "process": [
        [
          "Tell us your plan",
          "Share your vehicle, measurements, artwork and goals."
        ],
        [
          "Approve your design",
          "Review the layout, materials and finish before production."
        ],
        [
          "Print and install",
          "We prepare your graphics, arrange installation and check the finished result."
        ]
      ],
      "ctaTitle": "Let’s bring your brand to life.",
      "ctaText": "Tell us what you want to wrap, print or create. We’ll help you choose the next step.",
      "stats": [
        [
          "Vaughan",
          "Ontario, Canada"
        ],
        [
          "CAD",
          "Prices in Canadian dollars"
        ],
        [
          "Design",
          "Through to installation"
        ],
        [
          "GTA",
          "Toronto and surrounding areas"
        ]
      ],
      "seoTitle": "Vehicle Wraps & Printing Toronto | Satin Graphic",
      "seoDescription": "Vehicle wraps, printing, apparel and window graphics in Vaughan, serving Toronto and the GTA. Explore services and request a custom quote."
    },
    "fr": {
      "kicker": "Habillage · Impression · Vêtements · Graphiques",
      "headline": [
        "Votre marque.",
        "Sur chaque surface."
      ],
      "intro": "Habillage de véhicules, impression, vêtements et graphiques pour vitrines. Une seule équipe à Vaughan, au service de Toronto et du Grand Toronto.",
      "servicesKicker": "Nos services",
      "servicesTitle": "Une équipe. Toute votre marque.",
      "servicesIntro": "Choisissez un service, explorez les options et préparez votre estimation.",
      "workKicker": "Nos réalisations",
      "workTitle": "Créé ici. Vu partout.",
      "workIntro": "Une sélection de projets de véhicules réalisés dans notre atelier.",
      "processKicker": "De l’idée à l’installation",
      "processTitle": "Des étapes claires. Un résultat cohérent.",
      "process": [
        [
          "Présentez votre projet",
          "Partagez votre véhicule, vos dimensions, vos fichiers et vos objectifs."
        ],
        [
          "Approuvez le design",
          "Vérifiez la disposition, les matériaux et la finition avant la production."
        ],
        [
          "Impression et installation",
          "Nous préparons les graphiques, organisons l’installation et vérifions le résultat."
        ]
      ],
      "ctaTitle": "Donnons vie à votre marque.",
      "ctaText": "Dites-nous ce que vous souhaitez habiller, imprimer ou créer. Nous vous aiderons à choisir la prochaine étape.",
      "stats": [
        [
          "Vaughan",
          "Ontario, Canada"
        ],
        [
          "CAD",
          "Prix en dollars canadiens"
        ],
        [
          "Design",
          "Jusqu’à l’installation"
        ],
        [
          "Grand Toronto",
          "Toronto et ses environs"
        ]
      ],
      "seoTitle": "Habillage et impression Toronto | Satin Graphic",
      "seoDescription": "Habillage de véhicules, impression, vêtements et graphiques pour vitrines à Vaughan et dans le Grand Toronto. Demandez un devis personnalisé."
    },
    "es": {
      "kicker": "Rotulación · Impresión · Ropa · Gráficos",
      "headline": [
        "Tu marca.",
        "En cada superficie."
      ],
      "intro": "Rotulación de vehículos, impresión, ropa y gráficos para ventanas. Un solo equipo en Vaughan, al servicio de Toronto y del Gran Toronto.",
      "servicesKicker": "Nuestros servicios",
      "servicesTitle": "Un equipo. Toda tu marca.",
      "servicesIntro": "Elige un servicio, explora las opciones y prepara tu estimación.",
      "workKicker": "Nuestros trabajos",
      "workTitle": "Hecho aquí. Visto en todas partes.",
      "workIntro": "Una selección de proyectos de vehículos de nuestro taller.",
      "processKicker": "De la idea a la instalación",
      "processTitle": "Pasos claros. Un resultado coherente.",
      "process": [
        [
          "Cuéntanos tu proyecto",
          "Comparte tu vehículo, medidas, archivos y objetivos."
        ],
        [
          "Aprueba el diseño",
          "Revisa la distribución, los materiales y el acabado antes de producir."
        ],
        [
          "Impresión e instalación",
          "Preparamos los gráficos, organizamos la instalación y revisamos el resultado."
        ]
      ],
      "ctaTitle": "Demos vida a tu marca.",
      "ctaText": "Cuéntanos qué quieres rotular, imprimir o crear. Te ayudaremos a elegir el siguiente paso.",
      "stats": [
        [
          "Vaughan",
          "Ontario, Canadá"
        ],
        [
          "CAD",
          "Precios en dólares canadienses"
        ],
        [
          "Diseño",
          "Hasta la instalación"
        ],
        [
          "Gran Toronto",
          "Toronto y sus alrededores"
        ]
      ],
      "seoTitle": "Rotulación e impresión Toronto | Satin Graphic",
      "seoDescription": "Rotulación de vehículos, impresión, ropa y gráficos para ventanas en Vaughan y el Gran Toronto. Explora servicios y solicita un presupuesto."
    },
    "fa": {
      "kicker": "رپ خودرو · چاپ · پوشاک · گرافیک",
      "headline": [
        "برند شما.",
        "روی هر سطح."
      ],
      "intro": "رپ خودرو، چاپ، پوشاک و گرافیک شیشه؛ طراحی، تولید و نصب توسط یک تیم در وان، برای تورنتو و منطقه GTA.",
      "servicesKicker": "خدمات ما",
      "servicesTitle": "یک تیم برای تمام نیازهای برند شما.",
      "servicesIntro": "خدمت موردنظر را انتخاب کنید، گزینه‌ها را ببینید و برآورد قیمت بگیرید.",
      "workKicker": "نمونه کارها",
      "workTitle": "اینجا ساخته می‌شود؛ همه‌جا دیده می‌شود.",
      "workIntro": "منتخبی از پروژه‌های خودرو در کارگاه ما.",
      "processKicker": "از ایده تا نصب",
      "processTitle": "مراحل روشن؛ نتیجه‌ای هماهنگ.",
      "process": [
        [
          "پروژه‌تان را توضیح دهید",
          "مدل خودرو، اندازه‌ها، فایل طراحی و هدفتان را با ما در میان بگذارید."
        ],
        [
          "طراحی را تایید کنید",
          "چیدمان، متریال و پوشش نهایی را پیش از تولید بررسی کنید."
        ],
        [
          "چاپ و نصب",
          "گرافیک را آماده می‌کنیم، نصب را هماهنگ می‌کنیم و نتیجه نهایی را بررسی می‌کنیم."
        ]
      ],
      "ctaTitle": "به برندتان جان بدهیم.",
      "ctaText": "بگویید چه چیزی را می‌خواهید رپ، چاپ یا طراحی کنید؛ در انتخاب مرحله بعد کمک می‌کنیم.",
      "stats": [
        [
          "وان",
          "انتاریو، کانادا"
        ],
        [
          "CAD",
          "قیمت‌ها به دلار کانادا"
        ],
        [
          "طراحی",
          "تا اجرای نصب"
        ],
        [
          "GTA",
          "تورنتو و شهرهای اطراف"
        ]
      ],
      "seoTitle": "رپ خودرو و چاپ در تورنتو | Satin Graphic",
      "seoDescription": "رپ خودرو، چاپ، پوشاک و گرافیک شیشه در وان، تورنتو و منطقه GTA. خدمات را ببینید و برای پروژه خود درخواست قیمت کنید."
    }
  },
  "services": [
    {
      "name": "Vehicle Wraps",
      "description": {
        "en": "Commercial graphics, colour changes and paint protection.",
        "fr": "Habillage commercial, changement de couleur et protection de peinture.",
        "es": "Gráficos comerciales, cambio de color y protección de pintura.",
        "fa": "رپ تجاری، تغییر رنگ و محافظت از رنگ خودرو."
      },
      "path": "/vehicle-wraps",
      "photo": "job-greenlife-van",
      "icon": "truck"
    },
    {
      "name": "Print Shop",
      "description": {
        "en": "Business cards, brochures, banners and signs.",
        "fr": "Cartes professionnelles, brochures, bannières et enseignes.",
        "es": "Tarjetas, folletos, banners y carteles.",
        "fa": "کارت ویزیت، بروشور، بنر و تابلو."
      },
      "path": "/print-shop",
      "photo": "pr-bc-black",
      "icon": "print"
    },
    {
      "name": "Apparel",
      "description": {
        "en": "Custom shirts, hoodies, hats and workwear.",
        "fr": "T-shirts, sweats, casquettes et vêtements de travail personnalisés.",
        "es": "Camisetas, sudaderas, gorras y ropa de trabajo personalizada.",
        "fa": "تی‌شرت، هودی، کلاه و لباس کار سفارشی."
      },
      "path": "/apparel",
      "photo": "pr-stickers",
      "icon": "shirt"
    },
    {
      "name": "Window Graphics",
      "description": {
        "en": "Storefront branding, privacy film and window decals.",
        "fr": "Image de marque pour vitrines, films d’intimité et autocollants.",
        "es": "Gráficos comerciales, películas de privacidad y calcomanías.",
        "fa": "برندسازی ویترین، فیلم حریم خصوصی و استیکر شیشه."
      },
      "path": "/window-graphics",
      "photo": "office-glass",
      "icon": "window"
    },
    {
      "name": "Window Tint",
      "description": {
        "en": "Film options for vehicles and commercial spaces.",
        "fr": "Films pour véhicules et espaces commerciaux.",
        "es": "Películas para vehículos y espacios comerciales.",
        "fa": "انواع فیلم شیشه برای خودرو و فضای تجاری."
      },
      "path": "/window-tint",
      "photo": "install-tint",
      "icon": "sun"
    },
    {
      "name": "Wallpaper",
      "description": {
        "en": "Custom murals and printed wall coverings.",
        "fr": "Murales sur mesure et revêtements muraux imprimés.",
        "es": "Murales personalizados y revestimientos impresos.",
        "fa": "طرح دیواری سفارشی و پوشش چاپی دیوار."
      },
      "path": "/wallpaper",
      "photo": "mu-blueprint-living",
      "icon": "brush"
    },
    {
      "name": "Shop",
      "description": {
        "en": "Wrap designs, templates, prints, materials and tools.",
        "fr": "Designs, gabarits, impressions, matériaux et outils.",
        "es": "Diseños, plantillas, impresiones, materiales y herramientas.",
        "fa": "طرح رپ، تمپلیت، چاپ، متریال و ابزار."
      },
      "path": "/shop",
      "photo": "show-van-1",
      "icon": "pkg"
    },
    {
      "name": "Website design",
      "description": {
        "en": "A website built around your business and customers.",
        "fr": "Un site conçu pour votre entreprise et vos clients.",
        "es": "Un sitio diseñado para tu negocio y tus clientes.",
        "fa": "وب‌سایتی متناسب با کسب‌وکار و مشتریان شما."
      },
      "path": "/website-design",
      "photo": "web-2",
      "icon": "globe"
    }
  ],
  "work": [
    {
      "photo": "job-greenlife-van",
      "title": {
        "en": "Commercial van wrap",
        "fr": "Habillage de fourgonnette",
        "es": "Rotulación de furgoneta",
        "fa": "رپ ون تجاری"
      }
    },
    {
      "photo": "job-tesla-flip",
      "title": {
        "en": "Tesla colour change",
        "fr": "Changement de couleur Tesla",
        "es": "Cambio de color Tesla",
        "fa": "تغییر رنگ تسلا"
      }
    },
    {
      "photo": "job-fence-pickup",
      "title": {
        "en": "Branded pickup",
        "fr": "Camionnette de marque",
        "es": "Camioneta rotulada",
        "fa": "برندسازی پیکاپ"
      }
    }
  ]
};
const LANGUAGE_COPY = {
  "fr": {
    "draft": "Cette page est en cours de traduction. Certains détails restent en anglais.",
    "footer": "Habillage, impression, vêtements, graphiques pour vitres et murs : une seule équipe.",
    "prices": "Prix en CAD",
    "description": "Services et options de Satin Graphic à Vaughan et dans le Grand Toronto."
  },
  "es": {
    "draft": "Esta página está en traducción. Algunos detalles siguen en inglés.",
    "footer": "Rotulación, impresión, ropa y gráficos para ventanas y paredes: un solo equipo.",
    "prices": "Precios en CAD",
    "description": "Servicios y opciones de Satin Graphic en Vaughan y el Gran Toronto."
  },
  "fa": {
    "draft": "ترجمه این صفحه در حال تکمیل است؛ بعضی جزئیات فعلاً به انگلیسی نمایش داده می‌شوند.",
    "footer": "رپ خودرو، چاپ، پوشاک و گرافیک شیشه و دیوار؛ با یک تیم.",
    "prices": "قیمت‌ها به دلار کانادا",
    "description": "خدمات و گزینه‌های ستین گرافیک در وان، تورنتو و منطقه GTA."
  }
};

const RESPONSIVE_IMAGES = {"install-detail.jpg":[["install-detail-480.webp",480],["install-detail-900.webp",900]],"mu-blueprint-living.jpg":[["mu-blueprint-living-480.webp",480],["mu-blueprint-living-960.webp",960],["mu-blueprint-living-1100.webp",1100]],"tint-4.jpg":[["tint-4-480.webp",480],["tint-4-960.webp",960],["tint-4-1100.webp",1100]],"cc-audi-green.jpg":[["cc-audi-green-480.webp",480],["cc-audi-green-960.webp",960],["cc-audi-green-1100.webp",1100]],"pr-brochure-2.jpg":[["pr-brochure-2-480.webp",480],["pr-brochure-2-960.webp",960],["pr-brochure-2-1100.webp",1100]],"job-camaro.jpg":[["job-camaro-480.webp",480],["job-camaro-960.webp",960],["job-camaro-1050.webp",1050]],"job-van-2.jpg":[["job-van-2-480.webp",480],["job-van-2-960.webp",960],["job-van-2-1400.webp",1400]],"mu-office-leaves.jpg":[["mu-office-leaves-480.webp",480],["mu-office-leaves-750.webp",750]],"job-mx-van.jpg":[["job-mx-van-480.webp",480],["job-mx-van-960.webp",960],["job-mx-van-1400.webp",1400]],"pr-real-estate.jpg":[["pr-real-estate-480.webp",480],["pr-real-estate-960.webp",960],["pr-real-estate-1100.webp",1100]],"pr-booklet.jpg":[["pr-booklet-480.webp",480],["pr-booklet-960.webp",960],["pr-booklet-1100.webp",1100]],"pr-postcard-black.jpg":[["pr-postcard-black-480.webp",480],["pr-postcard-black-960.webp",960],["pr-postcard-black-1100.webp",1100]],"pr-sandwich.jpg":[["pr-sandwich-480.webp",480],["pr-sandwich-960.webp",960],["pr-sandwich-1100.webp",1100]],"home-video-v3-poster.jpg":[["home-video-poster-480.webp",480],["home-video-poster-910.webp",910]],"mu-office-workhard.jpg":[["mu-office-workhard-480.webp",480],["mu-office-workhard-960.webp",960],["mu-office-workhard-1400.webp",1400]],"pr-flag-feather.jpg":[["pr-flag-feather-480.webp",480],["pr-flag-feather-960.webp",960],["pr-flag-feather-1100.webp",1100]],"pr-doorhanger.jpg":[["pr-doorhanger-480.webp",480],["pr-doorhanger-960.webp",960],["pr-doorhanger-1100.webp",1100]],"logo-satinauto.jpg":[["logo-satinauto-480.webp",480],["logo-satinauto-960.webp",960],["logo-satinauto-1000.webp",1000]],"job-beetle-flip.jpg":[["job-beetle-flip-480.webp",480],["job-beetle-flip-525.webp",525]],"pr-flyer-2.jpg":[["pr-flyer-2-480.webp",480],["pr-flyer-2-960.webp",960],["pr-flyer-2-1100.webp",1100]],"pr-brochure.jpg":[["pr-brochure-480.webp",480],["pr-brochure-960.webp",960],["pr-brochure-1100.webp",1100]],"van-wrapped.jpg":[["van-wrapped-480.webp",480],["van-wrapped-960.webp",960],["van-wrapped-1100.webp",1100]],"mu-geo.jpg":[["mu-geo-480.webp",480],["mu-geo-960.webp",960],["mu-geo-1400.webp",1400]],"mu-office-leaves-2.jpg":[["mu-office-leaves-2-480.webp",480],["mu-office-leaves-2-750.webp",750]],"pr-vinyl-banner-2.jpg":[["pr-vinyl-banner-2-480.webp",480],["pr-vinyl-banner-2-960.webp",960],["pr-vinyl-banner-2-1100.webp",1100]],"suv-full-wrapped.jpg":[["suv-full-wrapped-480.webp",480],["suv-full-wrapped-960.webp",960],["suv-full-wrapped-1100.webp",1100]],"pr-rollup.jpg":[["pr-rollup-480.webp",480],["pr-rollup-960.webp",960],["pr-rollup-1100.webp",1100]],"pickup-wrapped.jpg":[["pickup-wrapped-480.webp",480],["pickup-wrapped-960.webp",960],["pickup-wrapped-1100.webp",1100]],"show-van-3.jpg":[["show-van-3-480.webp",480],["show-van-3-787.webp",787]],"install-film.jpg":[["install-film-480.webp",480],["install-film-960.webp",960],["install-film-1100.webp",1100]],"web-6.jpg":[["web-6-480.webp",480],["web-6-960.webp",960],["web-6-1100.webp",1100]],"wall-restaurant.jpg":[["wall-restaurant-480.webp",480],["wall-restaurant-960.webp",960],["wall-restaurant-1100.webp",1100]],"mu-bedroom-3d.jpg":[["mu-bedroom-3d-480.webp",480],["mu-bedroom-3d-960.webp",960],["mu-bedroom-3d-1400.webp",1400]],"mu-teal.jpg":[["mu-teal-480.webp",480],["mu-teal-960.webp",960],["mu-teal-1400.webp",1400]],"mu-tropical-living.jpg":[["mu-tropical-living-480.webp",480],["mu-tropical-living-750.webp",750]],"pr-rollup-2.jpg":[["pr-rollup-2-480.webp",480],["pr-rollup-2-960.webp",960],["pr-rollup-2-1100.webp",1100]],"web-5.jpg":[["web-5-480.webp",480],["web-5-960.webp",960],["web-5-1100.webp",1100]],"tint-1.jpg":[["tint-1-480.webp",480],["tint-1-960.webp",960],["tint-1-1100.webp",1100]],"web-2.jpg":[["web-2-480.webp",480],["web-2-960.webp",960],["web-2-1100.webp",1100]],"mu-tropical.jpg":[["mu-tropical-480.webp",480],["mu-tropical-750.webp",750]],"job-tesla-flip.jpg":[["job-tesla-flip-480.webp",480],["job-tesla-flip-960.webp",960],["job-tesla-flip-1050.webp",1050]],"dec-sprinter-2.jpg":[["dec-sprinter-2-480.webp",480],["dec-sprinter-2-960.webp",960],["dec-sprinter-2-1100.webp",1100]],"mu-marble.jpg":[["mu-marble-480.webp",480],["mu-marble-750.webp",750]],"pr-bc-black.jpg":[["pr-bc-black-480.webp",480],["pr-bc-black-750.webp",750]],"office-glass.jpg":[["office-glass-480.webp",480],["office-glass-960.webp",960],["office-glass-1100.webp",1100]],"pr-magnet-pickup.jpg":[["pr-magnet-pickup-480.webp",480],["pr-magnet-pickup-960.webp",960],["pr-magnet-pickup-1100.webp",1100]],"suv-bare.jpg":[["suv-bare-480.webp",480],["suv-bare-960.webp",960],["suv-bare-1100.webp",1100]],"wrapping-banner.jpg":[["wrapping-banner-480.webp",480],["wrapping-banner-960.webp",960],["wrapping-banner-1100.webp",1100]],"ppf-audi-3.jpg":[["ppf-audi-3-480.webp",480],["ppf-audi-3-960.webp",960],["ppf-audi-3-1100.webp",1100]],"dec-pickup.jpg":[["dec-pickup-480.webp",480],["dec-pickup-960.webp",960],["dec-pickup-1100.webp",1100]],"dec-sedan.jpg":[["dec-sedan-480.webp",480],["dec-sedan-960.webp",960],["dec-sedan-1100.webp",1100]],"dec-suv.jpg":[["dec-suv-480.webp",480],["dec-suv-960.webp",960],["dec-suv-1100.webp",1100]],"show-van-1.jpg":[["show-van-1-480.webp",480],["show-van-1-787.webp",787]],"floor-graphic.jpg":[["floor-graphic-480.webp",480],["floor-graphic-960.webp",960],["floor-graphic-1080.webp",1080]],"reflection.jpg":[["reflection-480.webp",480],["reflection-960.webp",960],["reflection-1100.webp",1100]],"cc-suv-green.jpg":[["cc-suv-green-480.webp",480],["cc-suv-green-960.webp",960],["cc-suv-green-1100.webp",1100]],"van-bare.jpg":[["van-bare-480.webp",480],["van-bare-960.webp",960],["van-bare-1100.webp",1100]],"mu-restaurant-2.jpg":[["mu-restaurant-2-480.webp",480],["mu-restaurant-2-960.webp",960],["mu-restaurant-2-1400.webp",1400]],"pickup-bare.jpg":[["pickup-bare-480.webp",480],["pickup-bare-960.webp",960],["pickup-bare-1100.webp",1100]],"web-3.jpg":[["web-3-480.webp",480],["web-3-960.webp",960],["web-3-1100.webp",1100]],"pr-flags-row.jpg":[["pr-flags-row-480.webp",480],["pr-flags-row-960.webp",960],["pr-flags-row-1100.webp",1100]],"tint-2.jpg":[["tint-2-480.webp",480],["tint-2-960.webp",960],["tint-2-1100.webp",1100]],"sprinter-wrapped-2.jpg":[["sprinter-wrapped-2-480.webp",480],["sprinter-wrapped-2-960.webp",960],["sprinter-wrapped-2-1100.webp",1100]],"mu-leaves.jpg":[["mu-leaves-480.webp",480],["mu-leaves-750.webp",750]],"mu-green-marble.jpg":[["mu-green-marble-480.webp",480],["mu-green-marble-750.webp",750]],"pr-greeting.jpg":[["pr-greeting-480.webp",480],["pr-greeting-960.webp",960],["pr-greeting-1100.webp",1100]],"cc-pickup-green.jpg":[["cc-pickup-green-480.webp",480],["cc-pickup-green-960.webp",960],["cc-pickup-green-1100.webp",1100]],"ppf-audi-2.jpg":[["ppf-audi-2-480.webp",480],["ppf-audi-2-960.webp",960],["ppf-audi-2-1100.webp",1100]],"cc-audi-bare.jpg":[["cc-audi-bare-480.webp",480],["cc-audi-bare-960.webp",960],["cc-audi-bare-1100.webp",1100]],"mu-custom-office.jpg":[["mu-custom-office-480.webp",480],["mu-custom-office-750.webp",750]],"lambo.jpg":[["lambo-480.webp",480],["lambo-960.webp",960],["lambo-1100.webp",1100]],"mu-nursery.jpg":[["mu-nursery-480.webp",480],["mu-nursery-750.webp",750]],"pr-xframe.jpg":[["pr-xframe-480.webp",480],["pr-xframe-960.webp",960],["pr-xframe-1100.webp",1100]],"car-red.jpg":[["car-red-480.webp",480],["car-red-960.webp",960],["car-red-1100.webp",1100]],"pr-aframe.jpg":[["pr-aframe-480.webp",480],["pr-aframe-960.webp",960],["pr-aframe-1100.webp",1100]],"sedan-bare.jpg":[["sedan-bare-480.webp",480],["sedan-bare-960.webp",960],["sedan-bare-1100.webp",1100]],"pr-tentcard.jpg":[["pr-tentcard-480.webp",480],["pr-tentcard-960.webp",960],["pr-tentcard-1100.webp",1100]],"show-van-2.jpg":[["show-van-2-480.webp",480],["show-van-2-787.webp",787]],"job-merc-green.jpg":[["job-merc-green-480.webp",480],["job-merc-green-525.webp",525]],"job-fence-pickup.jpg":[["job-fence-pickup-480.webp",480],["job-fence-pickup-960.webp",960],["job-fence-pickup-1400.webp",1400]],"pr-flyer.jpg":[["pr-flyer-480.webp",480],["pr-flyer-960.webp",960],["pr-flyer-1100.webp",1100]],"detail-hand.jpg":[["detail-hand-480.webp",480],["detail-hand-960.webp",960],["detail-hand-1100.webp",1100]],"job-greenlife-van.jpg":[["job-greenlife-van-480.webp",480],["job-greenlife-van-960.webp",960],["job-greenlife-van-1400.webp",1400]],"suv-wrapped.jpg":[["suv-wrapped-480.webp",480],["suv-wrapped-960.webp",960],["suv-wrapped-1100.webp",1100]],"mu-houses.jpg":[["mu-houses-480.webp",480],["mu-houses-750.webp",750]],"sedan-wrapped-2.jpg":[["sedan-wrapped-2-480.webp",480],["sedan-wrapped-2-960.webp",960],["sedan-wrapped-2-1100.webp",1100]],"pr-magnet-suv.jpg":[["pr-magnet-suv-480.webp",480],["pr-magnet-suv-960.webp",960],["pr-magnet-suv-1100.webp",1100]],"cc-bmw-green.jpg":[["cc-bmw-green-480.webp",480],["cc-bmw-green-960.webp",960],["cc-bmw-green-1100.webp",1100]],"cc-sedan-green.jpg":[["cc-sedan-green-480.webp",480],["cc-sedan-green-960.webp",960],["cc-sedan-green-1100.webp",1100]],"pr-bc-2.jpg":[["pr-bc-2-480.webp",480],["pr-bc-2-750.webp",750]],"web-1.jpg":[["web-1-480.webp",480],["web-1-960.webp",960],["web-1-1100.webp",1100]],"suv-full-bare.jpg":[["suv-full-bare-480.webp",480],["suv-full-bare-960.webp",960],["suv-full-bare-1100.webp",1100]],"pr-pole-banner.jpg":[["pr-pole-banner-480.webp",480],["pr-pole-banner-960.webp",960],["pr-pole-banner-1100.webp",1100]],"sprinter-wrapped.jpg":[["sprinter-wrapped-480.webp",480],["sprinter-wrapped-960.webp",960],["sprinter-wrapped-1100.webp",1100]],"mu-kids-rainbow.jpg":[["mu-kids-rainbow-480.webp",480],["mu-kids-rainbow-960.webp",960],["mu-kids-rainbow-1400.webp",1400]],"pr-envelope.jpg":[["pr-envelope-480.webp",480],["pr-envelope-960.webp",960],["pr-envelope-1100.webp",1100]],"pr-postcard.jpg":[["pr-postcard-480.webp",480],["pr-postcard-960.webp",960],["pr-postcard-1100.webp",1100]],"dec-smallvan.jpg":[["dec-smallvan-480.webp",480],["dec-smallvan-960.webp",960],["dec-smallvan-1100.webp",1100]],"pr-flag-square.jpg":[["pr-flag-square-480.webp",480],["pr-flag-square-960.webp",960],["pr-flag-square-1100.webp",1100]],"pr-backdrop.jpg":[["pr-backdrop-480.webp",480],["pr-backdrop-960.webp",960],["pr-backdrop-1100.webp",1100]],"pr-letterhead.jpg":[["pr-letterhead-480.webp",480],["pr-letterhead-960.webp",960],["pr-letterhead-1100.webp",1100]],"sprinter-bare.jpg":[["sprinter-bare-480.webp",480],["sprinter-bare-960.webp",960],["sprinter-bare-1100.webp",1100]],"mu-palms.jpg":[["mu-palms-480.webp",480],["mu-palms-750.webp",750]],"pr-vinyl-banner.jpg":[["pr-vinyl-banner-480.webp",480],["pr-vinyl-banner-960.webp",960],["pr-vinyl-banner-1100.webp",1100]],"job-subaru-matte.jpg":[["job-subaru-matte-480.webp",480],["job-subaru-matte-960.webp",960]],"install-tint.jpg":[["install-tint-480.webp",480],["install-tint-900.webp",900]],"dec-suv-full.jpg":[["dec-suv-full-480.webp",480],["dec-suv-full-960.webp",960],["dec-suv-full-1100.webp",1100]],"job-icecream-van.jpg":[["job-icecream-van-480.webp",480],["job-icecream-van-960.webp",960],["job-icecream-van-1400.webp",1400]],"ppf-audi-1.jpg":[["ppf-audi-1-480.webp",480],["ppf-audi-1-960.webp",960],["ppf-audi-1-1100.webp",1100]],"show-trailer.jpg":[["show-trailer-480.webp",480],["show-trailer-787.webp",787]],"tint-3.jpg":[["tint-3-480.webp",480],["tint-3-960.webp",960],["tint-3-1100.webp",1100]],"pr-poster.jpg":[["pr-poster-480.webp",480],["pr-poster-960.webp",960],["pr-poster-1100.webp",1100]],"mu-forest.jpg":[["mu-forest-480.webp",480],["mu-forest-750.webp",750]],"tint-levels.jpg":[["tint-levels-480.webp",480],["tint-levels-960.webp",960],["tint-levels-1100.webp",1100]],"sedan-wrapped.jpg":[["sedan-wrapped-480.webp",480],["sedan-wrapped-960.webp",960],["sedan-wrapped-1100.webp",1100]],"install-orange.jpg":[["install-orange-480.webp",480],["install-orange-900.webp",900]],"mu-tropical-bed.jpg":[["mu-tropical-bed-480.webp",480],["mu-tropical-bed-750.webp",750]],"web-4.jpg":[["web-4-480.webp",480],["web-4-960.webp",960],["web-4-1100.webp",1100]],"pr-bc-1.jpg":[["pr-bc-1-480.webp",480],["pr-bc-1-750.webp",750]],"pr-yard-sign.jpg":[["pr-yard-sign-480.webp",480],["pr-yard-sign-960.webp",960],["pr-yard-sign-1100.webp",1100]],"pr-stickers.jpg":[["pr-stickers-480.webp",480],["pr-stickers-960.webp",960],["pr-stickers-1100.webp",1100]],"pr-canvas.jpg":[["pr-canvas-480.webp",480],["pr-canvas-960.webp",960],["pr-canvas-1100.webp",1100]],"cc-half.jpg":[["cc-half-480.webp",480],["cc-half-960.webp",960],["cc-half-1100.webp",1100]],"install-ppf.jpg":[["install-ppf-480.webp",480],["install-ppf-960.webp",960],["install-ppf-1100.webp",1100]],"pr-doorhanger-2.jpg":[["pr-doorhanger-2-480.webp",480],["pr-doorhanger-2-960.webp",960],["pr-doorhanger-2-1100.webp",1100]],"web-wrap.jpg":[["web-wrap-480.webp",480],["web-wrap-960.webp",960],["web-wrap-1100.webp",1100]],"sg-hero.jpg":[["sg-hero-480.webp",480],["sg-hero-960.webp",960],["sg-hero-1399.webp",1399]],"dec-sprinter.jpg":[["dec-sprinter-480.webp",480],["dec-sprinter-960.webp",960],["dec-sprinter-1100.webp",1100]],"job-red-van.jpg":[["job-red-van-480.webp",480],["job-red-van-960.webp",960],["job-red-van-1400.webp",1400]],"mu-restaurant.jpg":[["mu-restaurant-480.webp",480],["mu-restaurant-960.webp",960],["mu-restaurant-1400.webp",1400]]};

Object.assign(TRANSLATIONS,STUDIO_TRANSLATIONS);
TRANSLATIONS["or call"]={fr:"ou appelez",es:"o llama",fa:"یا تماس بگیرید"};

/* ============ UI helpers, icons, art, shared sections ============ */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n, d) => "$" + Number(n).toLocaleString("en-CA", { minimumFractionDigits: d ?? (n % 1 ? 2 : 0), maximumFractionDigits: d ?? 2 });
const money2 = n => money(n, 2);
/* Languages use real URLs. English keeps the existing /satin/ URLs. */
function languageFromPath(path) { const code=path.split('/').filter(Boolean)[1];return ['fr','es','fa'].includes(code)?code:'en'; }
let LANG=globalThis.__PRERENDER__?'en':languageFromPath(location.pathname);
function tr(value) {
  const text=String(value??'');if(LANG==='en')return text;
  const clean=text.trim(),entry=TRANSLATIONS[clean]||Object.entries(TRANSLATIONS).find(([key])=>key.toLowerCase()===clean.toLowerCase())?.[1];
  return entry?.[LANG]?text.replace(clean,entry[LANG]):text;
}
globalThis.satinTranslate=tr;
function languageHref(path,code) {
  const i=path.search(/[?#]/),base=i<0?path:path.slice(0,i),suffix=i<0?'':path.slice(i);
  return SITE.base+(code==='en'?'':'/'+code)+(base==='/'?'/':base.replace(/\/$/,'')+'/')+suffix;
}
function languageSelector(path='/') {
  return `<label class="language-control">${icon('globe',18)}<span class="sr">${esc(tr('Language'))}</span><select data-language aria-label="${esc(tr('Language'))}">${SITE.languages.map(l=>`<option value="${l.code}" ${l.code===LANG?'selected':''} lang="${l.locale}" dir="${l.dir}">${esc(l.name)}</option>`).join('')}</select></label>`;
}
function localizedHTML(html) {
  if(LANG==='en')return html;
  // Translate display text and accessible labels, never option values, keys or URLs.
  let protectedTag=null;
  html=html.replace(/<option(?![^>]*\bvalue=)([^>]*)>([^<]*)<\/option>/g,(m,attrs,label)=>'<option'+attrs+' value="'+esc(label)+'">'+label+'</option>');
  return html.split(/(<[^>]+>)/g).map(part=>{
    if(part.startsWith('<')){
      if(/^<(svg|script|style)\b/.test(part))protectedTag=part.match(/^<(\w+)/)[1];
      if(protectedTag&&part.startsWith('</'+protectedTag))protectedTag=null;
      return protectedTag?part:part.replace(/\b(alt|aria-label|placeholder)="([^"]*)"/g,(m,key,value)=>key+'="'+esc(tr(value.replace(/&amp;/g,'&')))+'"');
    }
    return protectedTag?part:tr(part);
  }).join('');
}
function localizeDOM(root) {
  if(LANG==='en'||!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while(n=walker.nextNode()){if(!n.parentElement.closest('script,style,svg')){const value=tr(n.textContent);if(value!==n.textContent)n.textContent=value;}}
  root.querySelectorAll('[aria-label],[placeholder],img[alt]').forEach(el=>['aria-label','placeholder','alt'].forEach(key=>{if(el.hasAttribute(key))el.setAttribute(key,tr(el.getAttribute(key)))}));
}
function localizedPage(path,page) {
  if(LANG==='en')return page;
  let html=localizedHTML(page.html);
  if(path!=='/') {
    const name=localizedRouteName(path);
    html=html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/,(m,a,b)=>a+esc(name)+b);
    if(path!=='/design-studio')html='<div class="translation-note" role="note">'+esc(LANGUAGE_COPY[LANG].draft)+'</div>'+html;
    // Mark English body copy honestly while the specialist translation is being reviewed.
    html=html.replace(/<p([^>]*)>([^<]+)<\/p>/g,(m,attrs,text)=>/[a-zA-Z]/.test(text)&&text.length>70&&!/[\u0600-\u06ff]/.test(text)&&tr(text)===text?'<p'+attrs+' lang="en" dir="ltr">'+text+'</p>':m);
  }
  return {...page,html};
}
function localizedRouteName(path) {
  const service=Object.values(SERVICE_COPY).find(s=>s.path===path);if(service&&LANG==='fa')return service.fa;
  const name=(SEO[path]?.title||SEO['/404'].title).split(' | ')[0].replace(/ Toronto$/,'');
  return tr(name);
}
function alternateLanguages(path) {
  // Only fully translated pages may advertise alternate indexing versions.
  if(path!=='/')return [];
  return [...SITE.languages.map(l=>({code:l.locale,url:SITE.origin+languageHref(path,l.code)})),{code:'x-default',url:SITE.origin+languageHref(path,'en')}];
}

const href = p => languageHref(p,LANG);
const A = (p, inner, cls = "", extra = "") => `<a href="${href(p)}" class="${cls}" ${extra}>${inner}</a>`;
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
let _uid = 0; const uid = p => (p || "u") + (++_uid);

const IC = {
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', chev: '<path d="M6 9l6 6 6-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', check: '<path d="M5 12l5 5L20 7"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" stroke="none"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', truck: '<path d="M2 6h12v10H2zM14 9h4l3 3v4h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2"/><path d="M7 14h10v7H7z"/>', shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>', brush: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M3 21c2 0 3-1 3-3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  pkg: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', spark: '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  heat: '<path d="M8 21c-2-2-2-5 0-7s2-5 0-7M14 21c-2-2-2-5 0-7s2-5 0-7"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
const icon = (n, w = 18) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

/* ---------- vehicle silhouettes (viewBox 0 0 400 170) ---------- */
const VEH = {
  van: { b: "M20 140 L20 52 Q22 30 46 28 L292 26 Q314 26 324 44 L352 92 Q374 98 380 114 L380 140 Z", w: "M302 40 L318 44 L344 92 L302 92 Z M240 40 L290 40 L290 92 L240 92 Z", wh: [[84, 142, 22], [320, 142, 22]] },
  sedan: { b: "M20 132 Q18 110 40 104 L112 96 Q142 62 192 58 L250 58 Q292 60 320 94 L362 102 Q382 108 382 124 L380 134 L20 134 Z", w: "M130 96 Q152 70 192 68 L222 68 L222 96 Z M232 68 L250 68 Q282 70 302 96 L232 96 Z", wh: [[96, 136, 24], [306, 136, 24]] },
  suv: { b: "M20 134 L22 92 Q24 66 50 62 L252 58 Q282 58 302 86 L356 96 Q380 102 380 120 L378 136 L20 136 Z", w: "M72 70 L170 68 L170 92 L72 92 Z M180 68 L240 66 Q262 68 280 92 L180 92 Z", wh: [[92, 138, 25], [306, 138, 25]] },
  pickup: { b: "M20 136 L20 92 L172 92 L174 60 Q176 52 188 52 L262 52 Q282 54 296 86 L352 94 Q378 100 380 118 L378 136 Z", w: "M188 60 L258 60 Q272 62 284 88 L188 88 Z", wh: [[84, 138, 24], [312, 138, 24]] },
  minivan: { b: "M20 134 L22 76 Q26 50 60 48 L252 46 Q288 48 318 86 L360 96 Q380 104 380 122 L378 136 L20 136 Z", w: "M62 58 L150 57 L150 88 L62 88 Z M160 57 L252 56 Q276 58 296 88 L160 88 Z", wh: [[92, 138, 23], [312, 138, 23]] },
  box: { b: "M14 132 L14 26 L268 26 L268 132 Z M274 132 L274 64 L330 64 Q346 64 354 80 L372 102 Q382 108 382 120 L380 132 Z", w: "M288 72 L330 72 Q338 72 344 82 L356 100 L288 100 Z", wh: [[66, 136, 21], [206, 136, 21], [336, 136, 21]] },
  trailer: { b: "M18 128 L18 30 L340 30 L340 128 Z", w: "", wh: [[226, 134, 19], [270, 134, 19]], x: '<path d="M340 116 L390 120" stroke="var(--mut)" stroke-width="4" stroke-linecap="round"/>' },
  bus: { b: "M12 138 L12 40 Q12 26 28 26 L364 26 Q386 26 388 48 L390 138 Z", w: "M36 42 h50 v38 h-50z M96 42 h50 v38 h-50z M156 42 h50 v38 h-50z M216 42 h50 v38 h-50z M276 42 h50 v38 h-50z M336 42 h36 v52 h-36z", wh: [[82, 142, 22], [318, 142, 22]] },
};
const PALS = [["#e8314a", "#d42d80"], ["#2b4c6f", "#7aa5d6"], ["#1d7f55", "#a7d46f"], ["#26262a", "#8d8d93"], ["#2563c9", "#9cc0ff"], ["#5b1f2a", "#e8314a"], ["#3c4a5c", "#c3ccd6"]];
const pal = seed => PALS[Math.abs(seed) % PALS.length];
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function vehicleSVG(type = "van", o = {}) {
  const v = VEH[type] || VEH.van, id = uid("v"), [c1, c2] = o.c || pal(o.seed || 0);
  const mode = o.mode || "wrap";
  let fill = "";
  if (mode === "wrap") fill = `<rect x="0" y="0" width="400" height="170" fill="${o.base || "#f4f4f2"}"/>
    <path d="M-10 170 L150 20 L230 20 L70 170 Z" fill="${c1}"/><path d="M90 170 L250 20 L280 20 L120 170 Z" fill="${c2}"/>
    <path d="M300 170 L420 50 L420 170 Z" fill="${c1}" opacity=".9"/>
    <text x="40" y="${type === "sedan" || type === "suv" || type === "minivan" || type === "pickup" ? 122 : 96}" font-family="Vazirmatn,sans-serif" font-weight="800" font-size="${type === "bus" || type === "box" || type === "trailer" ? 26 : 18}" fill="#141414" opacity=".85">${esc(o.text || "SATIN")}</text>`;
  else if (mode === "color") fill = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="#0d0d0f"/></linearGradient><linearGradient id="${id}s" x1="0" x2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${o.gloss ?? .45}"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <rect width="400" height="170" fill="url(#${id}g)"/><rect class="${o.anim ? "sheen" : ""}" x="-100" y="0" width="600" height="170" fill="url(#${id}s)"/>`;
  else if (mode === "bare") fill = `<rect width="400" height="170" fill="var(--card)"/>`;
  return `<svg viewBox="0 0 400 170" ${o.cls ? `class="${o.cls}"` : ""} aria-hidden="true"><defs><clipPath id="${id}"><path d="${v.b}"/></clipPath></defs>
    <ellipse cx="200" cy="${v.wh[0][1] + v.wh[0][2] - 2}" rx="190" ry="7" fill="#000" opacity=".08"/>
    ${v.x || ""}<g clip-path="url(#${id})">${fill}</g>
    <path d="${v.b}" fill="none" stroke="${mode === "bare" ? "var(--ink)" : "rgba(0,0,0,.25)"}" stroke-width="${mode === "bare" ? 1.6 : 1}" ${mode === "bare" ? 'stroke-dasharray="5 4"' : ""}/>
    ${v.w ? `<path d="${v.w}" fill="${mode === "bare" ? "none" : "#1d2228"}" stroke="${mode === "bare" ? "var(--mut)" : "none"}" opacity="${mode === "bare" ? 1 : .82}"/>` : ""}
    ${v.wh.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#18191b"/><circle cx="${x}" cy="${y}" r="${r * .45}" fill="#9a9ca1"/>`).join("")}
  </svg>`;
}

/* ---------- real photos (img/<name>.jpg) ---------- */
const BLACK_BG = /^(sedan|suv|pickup|van|sprinter|dec|cc|ppf-audi|tint-\d|car-red|lambo)/;
function photo(name, o = {}) {
  const printPhoto = Object.entries({"pr-bc":"print-business-cards","pr-flyer":"print-flyers","pr-postcard":"print-postcards","pr-brochure":"print-brochures","pr-doorhanger":"print-door-hangers"}).find(([prefix])=>name.startsWith(prefix))?.[1];
  const photoSrc = `${SITE.base}/img/${printPhoto||name}.${printPhoto||transparentImages.includes(name)?"png":"jpg"}`;
  const fit = o.fit || (BLACK_BG.test(name) ? "contain" : "cover");
  const bg = fit === "contain" ? "transparent" : "var(--bg-3)";
  return `<div class="art photo ${o.cls || ""}" style="background:${bg};${o.style || ""}"><img src="${photoSrc}" alt="${esc(o.alt || o.label || "")}" loading="lazy" decoding="async" style="object-fit:${fit};${o.pos ? "object-position:" + o.pos : ""}"></div>`;
}
const _catCount = {};
function catPhoto(cat) { const list = CAT_PHOTOS[cat]; if (!list) return null; const n = _catCount[cat] = (_catCount[cat] || 0) + 1; return list[(n - 1) % list.length]; }

/* ---------- generated art placeholders ---------- */
function art(kind, o = {}) {
  if (o.photo) return photo(o.photo, o);
  const seed = o.seed ?? hash(o.label || kind), [c1, c2] = o.c || pal(seed);
  const tag = o.tag === false ? "" : `<span class="tag">${esc(o.tag || "Photo coming soon")}</span>`;
  let bg = "", inner = "";
  const vehOf = o.veh || ["van", "pickup", "box", "suv", "sedan", "trailer"][seed % 6];
  switch (kind) {
    case "fleet": case "van":
      bg = `linear-gradient(160deg,var(--bg-2),var(--bg-3))`; inner = `<div style="position:absolute;inset:12% 8% 8%">${vehicleSVG(kind === "van" ? "van" : vehOf, { seed, c: [c1, c2], text: o.text })}</div>`; break;
    case "color": bg = `radial-gradient(120% 90% at 70% 20%,var(--bg-2),var(--bg-3))`; inner = `<div style="position:absolute;inset:18% 8% 10%">${vehicleSVG(o.veh || ["sedan", "suv", "pickup"][seed % 3], { mode: "color", c: [c1, c2] })}</div>`; break;
    case "ppf": bg = `linear-gradient(180deg,var(--bg-2),var(--bg-3))`; inner = `<div style="position:absolute;inset:18% 8% 10%">${vehicleSVG("sedan", { mode: "color", c: ["#c9ced6", "#f4f6f8"], gloss: .8 })}</div><div style="position:absolute;inset:0;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.55) 50%,transparent 60%)"></div>`; break;
    case "print": bg = `linear-gradient(150deg,var(--bg-2),var(--bg-3))`;
      inner = `<svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet"><g transform="translate(200 135)">
        <rect x="-150" y="-70" width="170" height="100" rx="6" fill="${c1}" transform="rotate(-10)"/><rect x="-60" y="-80" width="170" height="100" rx="6" fill="#fff" stroke="#ddd" transform="rotate(6)"/>
        <rect x="-40" y="-60" width="70" height="8" rx="3" fill="#141414" transform="rotate(6)"/><rect x="-40" y="-44" width="110" height="5" rx="2" fill="#bbb" transform="rotate(6)"/>
        <rect x="40" y="-20" width="120" height="150" rx="4" fill="${c2}" transform="rotate(14)"/></g></svg>`; break;
    case "banner": bg = `linear-gradient(150deg,var(--bg-2),var(--bg-3))`;
      inner = `<svg viewBox="0 0 400 260"><rect x="150" y="30" width="100" height="200" rx="3" fill="${c1}"/><rect x="150" y="30" width="100" height="70" fill="${c2}"/><rect x="165" y="120" width="70" height="10" rx="3" fill="#fff"/><rect x="165" y="138" width="50" height="6" rx="3" fill="#fff" opacity=".7"/><rect x="140" y="228" width="120" height="10" rx="4" fill="#2a2a2e"/><rect x="40" y="70" width="80" height="160" rx="3" fill="#fff" stroke="#ddd"/><rect x="50" y="80" width="60" height="60" fill="${c2}" opacity=".6"/><rect x="280" y="90" width="90" height="140" rx="3" fill="#2a2a2e"/><rect x="290" y="100" width="70" height="40" fill="${c1}"/></svg>`; break;
    case "apparel": bg = `linear-gradient(150deg,var(--bg-2),var(--bg-3))`; inner = `<svg viewBox="0 0 400 260">${garment(o.g || "tee", o.gc || ["#1b1b1d", "#f7f7f5", "#1f2a44", "#a9a9ad"][seed % 4], c1)}</svg>`; break;
    case "glass": bg = `linear-gradient(180deg,#dfe7ee,#c9d4de)`;
      inner = `<svg viewBox="0 0 400 260" preserveAspectRatio="none"><rect x="0" y="0" width="400" height="260" fill="#dce6ee"/>${[0, 1, 2, 3].map(i => `<rect x="${12 + i * 97}" y="14" width="88" height="232" fill="#eef3f7" stroke="#b9c6d1" stroke-width="3"/><rect x="${12 + i * 97}" y="100" width="88" height="56" fill="#fff" opacity=".75"/>`).join("")}<text x="200" y="136" text-anchor="middle" font-family="Vazirmatn,sans-serif" font-weight="800" font-size="22" fill="${c1}">${esc(o.text || "OPEN 9–6")}</text></svg>`; break;
    case "tint": bg = `linear-gradient(160deg,#2b3038,#0f1114)`;
      inner = `<svg viewBox="0 0 400 260" preserveAspectRatio="none"><defs><linearGradient id="t${seed}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="400" height="260" fill="url(#t${seed})"/>${[0, 1, 2].map(i => `<rect x="${20 + i * 125}" y="20" width="110" height="220" fill="none" stroke="#5a616b" stroke-width="3"/>`).join("")}</svg>`; break;
    case "wall": bg = patternBg(o.pattern || ["leaf", "grid", "stripe", "bloom", "topo", "arc"][seed % 6]); break;
    case "web": bg = `linear-gradient(150deg,var(--bg-2),var(--bg-3))`;
      inner = `<svg viewBox="0 0 400 260"><rect x="40" y="30" width="320" height="200" rx="10" fill="#fff" stroke="#d9d9d9"/><rect x="40" y="30" width="320" height="24" rx="10" fill="#efefef"/><circle cx="56" cy="42" r="4" fill="#e8314a"/><circle cx="70" cy="42" r="4" fill="#ccc"/><rect x="60" y="74" width="140" height="16" rx="4" fill="#141414"/><rect x="60" y="98" width="110" height="8" rx="3" fill="#bbb"/><rect x="60" y="118" width="70" height="22" rx="6" fill="${c1}"/><rect x="220" y="70" width="120" height="90" rx="8" fill="${c2}" opacity=".7"/><rect x="60" y="176" width="80" height="40" rx="6" fill="#f2f2f2"/><rect x="160" y="176" width="80" height="40" rx="6" fill="#f2f2f2"/><rect x="260" y="176" width="80" height="40" rx="6" fill="#f2f2f2"/></svg>`; break;
    case "design": bg = `linear-gradient(135deg,${o.c ? o.c[0] : c1},${o.c ? o.c[1] : c2})`; inner = `<div style="position:absolute;inset:16% 6% 8%">${vehicleSVG(o.veh || "van", { c: o.c || [c1, c2], base: o.base || "#fff", text: o.text || "YOUR BRAND" })}</div>`; break;
    case "swatch": bg = `linear-gradient(135deg,${c1},${c2})`; break;
    case "person": bg = `linear-gradient(160deg,var(--bg-2),var(--bg-3))`; inner = `<span style="position:relative;z-index:1">${esc(o.text || "")}</span>`; break;
    default: bg = `linear-gradient(135deg,${c1},${c2})`;
  }
  return `<div class="art ${o.cls || ""}" style="background:${bg};${o.style || ""}" role="img" aria-label="${esc(o.label || kind)}">${inner}${tag}</div>`;
}

function patternBg(p, scale = 1) {
  const s = n => n * scale + "px";
  const P = {
    stripe: `repeating-linear-gradient(90deg,#e9e4dc 0 ${s(18)},#d8d0c4 ${s(18)} ${s(22)},#efeae3 ${s(22)} ${s(40)})`,
    leaf: `radial-gradient(circle at 30% 30%,#7ea27a ${s(6)},transparent ${s(7)}) 0 0/${s(46)} ${s(46)},radial-gradient(ellipse at 70% 70%,#5b7f5c ${s(9)},transparent ${s(10)}) 0 0/${s(46)} ${s(46)},#e9e1d1`,
    linen: `repeating-linear-gradient(0deg,rgba(0,0,0,.035) 0 1px,transparent 1px ${s(4)}),repeating-linear-gradient(90deg,rgba(0,0,0,.035) 0 1px,transparent 1px ${s(5)}),#ece7df`,
    cloud: `radial-gradient(circle at 25% 35%,#fff ${s(16)},transparent ${s(17)}) 0 0/${s(80)} ${s(60)},radial-gradient(circle at 75% 70%,#fff ${s(12)},transparent ${s(13)}) 0 0/${s(80)} ${s(60)},#cfdcea`,
    bloom: `radial-gradient(circle,#c86a8a ${s(5)},transparent ${s(6)}) 0 0/${s(36)} ${s(36)},radial-gradient(circle,#e3b0c1 ${s(3)},transparent ${s(4)}) ${s(18)} ${s(18)}/${s(36)} ${s(36)},#1d2238`,
    sand: `linear-gradient(180deg,#e6d3b8,#d4b893)`,
    galaxy: `radial-gradient(circle,#fff ${s(1.5)},transparent ${s(2)}) 0 0/${s(30)} ${s(30)},radial-gradient(circle,#ffd6f0 ${s(1)},transparent ${s(1.6)}) ${s(14)} ${s(9)}/${s(22)} ${s(22)},linear-gradient(160deg,#1b1f4a,#3b1f5a)`,
    jungle: `radial-gradient(ellipse at 50% 100%,#3f8a4f ${s(14)},transparent ${s(15)}) 0 0/${s(40)} ${s(40)},#cfe7c4`,
    arc: `repeating-radial-gradient(circle at 50% 110%,#e8314a 0 ${s(10)},#f6a04d ${s(10)} ${s(20)},#f5d76e ${s(20)} ${s(30)},#7cc59a ${s(30)} ${s(40)},#6aa7e0 ${s(40)} ${s(50)},#faf7f0 ${s(50)} ${s(70)})`,
    grid: `linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px) 0 0/${s(24)} ${s(24)},linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px) 0 0/${s(24)} ${s(24)},#2b4c6f`,
    cgrid: `linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px) 0 0/${s(28)} ${s(28)},linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px) 0 0/${s(28)} ${s(28)},#2a2b2f`,
    word: `repeating-linear-gradient(135deg,#f3f3f1 0 ${s(26)},#e8314a ${s(26)} ${s(30)},#f3f3f1 ${s(30)} ${s(56)})`,
    sage: `linear-gradient(180deg,#b9c8b3,#a3b69c)`,
    topo: `repeating-radial-gradient(ellipse at 30% 40%,#e9ece6 0 ${s(8)},#c9d1c6 ${s(8)} ${s(9)})`,
  };
  return P[p] || P.linen;
}

function garment(g, color, accent, place = "Left Chest", logo) {
  const dark = ["#1b1b1d", "#1f2a44", "#22412f", "#5b1f2a"].includes(color);
  const stroke = dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.18)";
  const shapes = {
    tee: "M150 40 L120 52 L80 90 L104 118 L126 102 L126 236 L274 236 L274 102 L296 118 L320 90 L280 52 L250 40 Q200 66 150 40 Z",
    crew: "M150 40 L118 54 L84 150 L108 160 L128 104 L128 236 L272 236 L272 104 L292 160 L316 150 L282 54 L250 40 Q200 62 150 40 Z",
    hoodie: "M150 46 L118 58 L84 160 L108 170 L128 108 L128 238 L272 238 L272 108 L292 170 L316 160 L282 58 L250 46 Q248 14 200 14 Q152 14 150 46 Z",
    work: "M150 40 L118 54 L84 156 L108 166 L128 104 L128 238 L272 238 L272 104 L292 166 L316 156 L282 54 L250 40 L200 60 Z",
    cap: "M110 150 Q110 70 200 66 Q290 70 290 150 Z M110 150 Q200 136 330 162 Q300 176 200 168 L110 160 Z",
  };
  const pos = { "Left Chest": [232, 96, 30], "Full Front": [200, 140, 70], "Sleeve": [108, 110, 18], "Full Back": [200, 140, 70], "Front": [200, 112, 40] };
  const [x, y, sz] = g === "cap" ? [200, 112, 40] : (pos[place] || pos["Left Chest"]);
  const mark = logo ? `<image href="${logo}" x="${x - sz}" y="${y - sz * .6}" width="${sz * 2}" height="${sz * 1.2}" preserveAspectRatio="xMidYMid meet"/>`
    : `<g><rect x="${x - sz}" y="${y - sz * .45}" width="${sz * 2}" height="${sz * .9}" rx="${sz * .15}" fill="${accent}"/><text x="${x}" y="${y + sz * .16}" text-anchor="middle" font-family="Vazirmatn,sans-serif" font-weight="800" font-size="${sz * .42}" fill="#fff">LOGO</text></g>`;
  return `<path d="${shapes[g] || shapes.tee}" fill="${color}" stroke="${stroke}" stroke-width="2"/>${g === "hoodie" ? `<path d="M170 46 Q200 76 230 46" fill="none" stroke="${stroke}" stroke-width="3"/><path d="M150 180 h100 v34 h-100z" fill="none" stroke="${stroke}" stroke-width="2"/>` : ""}${g === "work" ? `<path d="M200 60 V238" stroke="${stroke}" stroke-width="2"/><rect x="146" y="120" width="34" height="30" fill="none" stroke="${stroke}" stroke-width="2"/><rect x="220" y="120" width="34" height="30" fill="none" stroke="${stroke}" stroke-width="2"/>` : ""}${mark}`;
}

/* ---------- shared sections ---------- */
const crumbs = list => `<nav class="crumbs" aria-label="Breadcrumb">${list.map((c, i) => i < list.length - 1 ? `${A(c[1], esc(c[0]))}<span class="sep">/</span>` : `<span aria-current="page">${esc(c[0])}</span>`).join("")}</nav>`;

function hero(o) {
  return `<section class="phero ${o.art ? "" : "solo"}"><div class="wrap in">
    <div class="txt">${o.crumbs ? crumbs(o.crumbs) : ""}${o.kicker ? `<span class="eyebrow">${esc(o.kicker)}</span>` : ""}
      <h1 class="${o.big === false ? "d2" : "d1"}">${o.title}</h1>${o.lede ? `<p class="lede">${o.lede}</p>` : ""}
      ${o.ctas ? `<div class="ctas">${o.ctas}</div>` : ""}${o.after || ""}</div>
    ${o.art ? `<div>${o.art}</div>` : ""}</div></section>`;
}
const secHead = (eb, title, lede, right) => right
  ? `<div class="sec-head row"><div>${eb ? `<span class="eyebrow">${esc(eb)}</span>` : ""}<h2 class="d2">${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ""}</div>${right}</div>`
  : `<div class="sec-head">${eb ? `<span class="eyebrow">${esc(eb)}</span>` : ""}<h2 class="d2">${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ""}</div>`;
const sec = (inner, cls = "", id = "") => `<section class="sec ${cls}" ${id ? `id="${id}"` : ""}><div class="wrap">${inner}</div></section>`;
const quoteBtn = (label = "Get a quote", svc = "", cls = "btn", details = "") => `<button class="${cls}" data-quote="${esc(svc)}" ${details ? `data-details="${esc(details)}"` : ""}>${esc(label)} ${icon("arrow", 16).replace("<svg", '<svg class="arrow"')}</button>`;

function linkCards(items, cols = 3, o = {}) {
  return `<div class="grid g${cols}">${items.map(it => `<a class="card" href="${href(it.path)}">
    ${it.art || ""}<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><h3>${esc(it.name)}</h3>${it.chip ? `<span class="chip">${esc(it.chip)}</span>` : ""}</div>
    <p>${esc(it.d || "")}</p><div class="foot">${it.price ? `<span class="price">${esc(it.price)}</span>` : "<span></span>"}<span class="link">${esc(it.cta || o.cta || "Explore")} ${icon("arrow", 14).replace("<svg", '<svg class="arrow"')}</span></div></a>`).join("")}</div>`;
}
const feats = (items, cols = 4) => `<div class="grid g${cols}">${items.map(([t, d, ic]) => `<div class="feat">${ic ? `<span class="ico">${icon(ic)}</span>` : ""}<b>${esc(t)}</b><p>${esc(d)}</p></div>`).join("")}</div>`;
const spec = rows => `<div class="spec">${rows.map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${v}</span></div>`).join("")}</div>`;
const steps = list => `<ol class="steps-list">${list.map(([t, d]) => `<li><div><b>${esc(t)}</b><span>${esc(d)}</span></div></li>`).join("")}</ol>`;
function workGrid(list, o = {}) {
  Object.keys(_catCount).forEach(k => delete _catCount[k]);
  return `<div class="work ${o.big ? "big" : ""}">${list.map(([t, c], i) => `<div class="w" data-cat="${esc(c)}">${art(CAT_ART[c] || "fleet", { label: t, seed: hash(t), tag: c, photo: catPhoto(c) })}<b>${esc(t)}</b><span class="tiny">${esc(c)}</span></div>`).join("")}</div>`;
}
function workSec(title, list, o = {}) {
  return sec(secHead("Recent work", title, o.lede, A("/portfolio", `Full portfolio ${icon("arrow", 14).replace("<svg", '<svg class="arrow"')}`, "link")) + workGrid(list, o), o.cls || "");
}
function faqSec(keyOrItems, o = {}) {
  const items = Array.isArray(keyOrItems) ? keyOrItems : FAQ[keyOrItems].items;
  return sec(`<div class="faq"><div style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">FAQ</span><h2 class="d2">${o.title || "Questions we get asked most."}</h2><p class="small">Still unsure? Send us a note and we’ll answer within one business day.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">${A("/faq", "All FAQs", "btn ghost sm")}${A("/contact", "Contact us", "btn ghost sm")}</div></div>
    <div class="acc">${items.map(([q, a], i) => `<details ${i === 0 && o.open !== false ? "open" : ""}><summary>${esc(q)}</summary><div class="a">${esc(a)}</div></details>`).join("")}</div></div>`, o.cls || "");
}
function ctaBand(title, text, label, svc, o = {}) {
  return sec(`<div class="cta"><div><h2 class="d2">${title}</h2>${text ? `<p>${text}</p>` : ""}</div><div class="acts">${o.btn || quoteBtn(label || "Start a quote", svc || "")}${o.note ? `<span class="tel">${o.note}</span>` : (SITE.phone && !SITE.phone.includes('555-') ? `<span class="tel">${esc(tr('or call'))} <bdi>${SITE.phone}</bdi></span>` : '')}</div></div>`, "tight");
}
const coverageCards = () => `<div class="grid g4">${COVERAGE.map(([n, d, p]) => `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><span class="mono tiny">${Math.round(p * 100)}%</span><div class="bar-m" style="width:60%"><i style="width:${p * 100}%"></i></div></div><h3>${n}</h3><p>${d}</p><span class="tiny">${Math.round(p * 100)}% of full-wrap price</span></div>`).join("")}</div>`;
const stars = (n = 5) => `<span class="stars" role="img" aria-label="${n} out of 5">${icon("star", 14).repeat(n)}</span>`;
const quotes = list => `<div class="grid g2">${list.map(t => `<figure class="quote" style="margin:0">${stars()}<q>${esc(t.q)}</q><figcaption class="who"><span class="av">${esc(t.who.split(" ").map(w => w[0]).join("").slice(0, 2))}</span><span><b style="display:block;font-size:14.5px">${esc(t.who)}</b><span class="tiny">${esc(t.org)}</span></span></figcaption></figure>`).join("")}</div>`;
const marquee = () => { const it = MATERIAL_BRANDS.map(([b, d]) => `<div class="it"><b>${esc(b)}</b><span>${esc(d)}</span></div>`).join(""); return `<div class="marq" aria-label="Materials we use"><div class="tr">${it}${it}</div></div>`; };

/* option group (segmented) — used by configurators */
function seg(name, opts, sel, o = {}) {
  return `<div class="og"><span class="lab">${esc(name)}</span><div class="seg ${o.cards ? "cards" : ""}" data-group="${esc(o.key || name)}">${opts.map((op, i) => {
    const [label, extra, sub] = Array.isArray(op) ? op : [op];
    const tag = o.showPrice && extra !== undefined ? (o.fmt ? o.fmt(extra) : (extra === 0 ? "included" : (extra > 0 ? "+" : "") + money2(extra))) : "";
    return `<button type="button" data-val="${esc(label)}" aria-pressed="${(sel ?? 0) === i || sel === label}">${o.cards ? `<b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}${tag ? `<em>${esc(tag)}</em>` : ""}` : `${esc(label)}${tag ? ` <span class="tiny">${esc(tag)}</span>` : ""}`}</button>`;
  }).join("")}</div></div>`;
}
const dropzone = (title, sub, id) => `<label class="drop" for="${id}">${icon("upload", 22)}<span><b data-drop-title>${esc(title)}</b><span class="tiny">${esc(sub)}</span></span><input type="file" id="${id}" data-drop></label>`;
const field = (label, input, cls = "") => `<label class="field ${cls}"><span class="fl">${esc(label)}</span>${input}</label>`;

/* Metadata shared by static output and client navigation. */
const plainText = html => String(html).replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
function pageSEO(path, page) {
  if(page.portfolio)return portfolioSEO(LANG,path,page,parseLocation().query);
  let meta = {...(SEO[path] || SEO['/404'])};
  if(LANG!=='en') {
    const c=HOME_CONTENT.copy[LANG];
    meta=path==='/'?{...meta,title:c.seoTitle,description:c.seoDescription}:{...meta,title:localizedRouteName(path)+' | Satin Graphic',description:LANGUAGE_COPY[LANG].description,noindex:true};
  }
  const canonical = SITE.origin + href(path);
  const business = {"@type":"LocalBusiness","@id":SITE.origin+SITE.base+"/#business",name:SITE.name,url:SITE.origin+href('/'),image:SITE.origin+SITE.base+"/img/logo.png",email:SITE.email,areaServed:["Vaughan","Toronto","Greater Toronto Area"],address:{"@type":"PostalAddress",addressLocality:"Vaughan",addressRegion:SITE.region,addressCountry:SITE.country}};
  if (SITE.address) business.address.streetAddress=SITE.address;
  if (SITE.phone && !SITE.phone.includes('555-')) business.telephone=SITE.phone;
  const graph=[business];
  if (path!=='/') {
    const parts=path.split('/').filter(Boolean);
    graph.push({"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:tr("Home"),item:SITE.origin+href('/')},...parts.map((part,i)=>({"@type":"ListItem",position:i+2,name:(SEO['/'+parts.slice(0,i+1).join('/')]?.title||part).split(' | ')[0].replace(/ Toronto$/,''),item:SITE.origin+href('/'+parts.slice(0,i+1).join('/'))}))]});
  }
  if (!meta.noindex && !path.startsWith('/shop') && !['/','/about','/contact','/reviews','/faq'].includes(path) && !Object.hasOwn(POLICIES,path.slice(1))) graph.push({"@type":"Service",name:meta.title.split(' | ')[0],description:meta.description,provider:{"@id":business['@id']},areaServed:"Greater Toronto Area",url:canonical});
  const estimate = initialEstimate(page);
  if(page.cfg && estimate && estimate.total>0 && path.startsWith('/shop/')) graph.push({'@type':'Product',name:page.cfg.name,description:meta.description,image:SITE.origin+SITE.base+'/img/'+meta.image+'.jpg',url:canonical,offers:{'@type':'Offer',price:estimate.total.toFixed(2),priceCurrency:'CAD',url:canonical,description:'Configured starting estimate; final quote confirmed by Satin Graphic.'}});
  const faqs=[];
  for (const m of page.html.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/details>/g)) {
    const q=plainText(m[1]),a=plainText(m[2]);if(q.endsWith('?')&&a) faqs.push({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}});
  }
  if(faqs.length) graph.push({"@type":"FAQPage",mainEntity:faqs});
  return {...meta,canonical,image:SITE.origin+SITE.base+'/img/'+meta.image+'.jpg',jsonld:{"@context":"https://schema.org","@graph":graph}};
}
function updateSEO(path,page) {
  const seo=pageSEO(path,page);document.title=seo.title;
  const set=(selector,content)=>{const el=document.querySelector(selector);if(el)el.setAttribute('content',content)};
  set('meta[name="description"]',seo.description);set('meta[name="robots"]',seo.noindex?'noindex,follow':'index,follow');
  for(const key of ['title','description','image']){set('meta[property="og:'+key+'"]',seo[key]);set('meta[name="twitter:'+key+'"]',seo[key]);}
  set('meta[property="og:url"]',seo.canonical);
  const locale=SITE.languages.find(l=>l.code===LANG);document.documentElement.lang=locale.locale;document.documentElement.dir=locale.dir;
  set('meta[property="og:locale"]',locale.locale.replace('-','_'));
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(el=>el.remove());
  alternateLanguages(path).forEach(a=>{const el=document.createElement('link');el.rel='alternate';el.hreflang=a.code;el.href=a.url;document.head.appendChild(el);});
  const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=seo.canonical;
  const schema=document.getElementById('page-schema');if(schema)schema.textContent=JSON.stringify(seo.jsonld);
}

function initialEstimate(page) {
  if (!page.cfg) return null;
  const state={}, attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  for(const m of page.html.matchAll(/<div[^>]*data-group="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)) {
    const button=[...m[2].matchAll(/<button\b([^>]*)>/g)].map(m=>attrs(m[1])).find(a=>a['aria-pressed']==='true');
    if(button)state[m[1]]=button['data-val'];
  }
  for(const m of page.html.matchAll(/<input\b([^>]*)>/g)){const a=attrs(m[1]);if(a['data-k'])state[a['data-k']]=a.value||'';}
  for(const m of page.html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)){
    const a=attrs(m[1]);if(!a['data-k'])continue;const opt=m[2].match(/<option\b([^>]*)>([^<]*)/);if(opt)state[a['data-k']]=attrs(opt[1]).value||plainText(opt[2]);
  }
  try { const estimate=page.cfg.calc(state);return Number.isFinite(estimate.total)?estimate:null; }catch{return null;}
}
function estimateHTML(page) {
  const e=initialEstimate(page);if(!e)return page.html;
  return page.html.replace(/(<b\b[^>]*data-total[^>]*>)[\s\S]*?(<\/b>)/,(m,a,b)=>a+esc(e.total?(e.money2?money2(e.total):money(e.total)):'Quoted')+b);
}
function imageHTML(html,eager=false) {
  let first=true;
  return html.replace(/<img\b([^>]*)>/g,(tag,attrs)=>{
    const file=attrs.match(/src="\/satin\/img\/([^"?]+)"/)?.[1];if(!file)return tag;
    const size=IMAGE_SIZES[file];
    if(size){if(!/\bwidth=/.test(attrs))attrs+=' width="'+size[0]+'"';if(!/\bheight=/.test(attrs))attrs+=' height="'+size[1]+'"';}
    if(/alt=""/.test(attrs)){
      const caption=file.replace(/\.(jpg|png)$/,'').replace(/^(pr-|cc-|dec-|mu-|job-|show-)/,prefix=>({'pr-':'Print sample ','cc-':'Colour change wrap ','dec-':'Vehicle decals ','mu-':'Wallpaper sample ','job-':'Vehicle wrap ','show-':'Vehicle wrap '}[prefix])).replace(/[-_]/g,' ').replace(/\s+\d+$/,'');
      attrs=attrs.replace('alt=""','alt="'+esc(caption+' — Satin Graphic')+'"');
    }
    if(first&&eager){attrs=attrs.replace(/\sloading="lazy"/,'');attrs+=' loading="eager" fetchpriority="high"';}first=false;
    const img='<img'+attrs+'>';
    const variants=RESPONSIVE_IMAGES[file];if(!variants)return img;
    const sources=variants.map(([name,w])=>SITE.base+'/img/'+name+' '+w+'w').join(', ');
    return '<picture><source type="image/webp" srcset="'+sources+'" sizes="(max-width:700px) calc(100vw - 32px), (max-width:1060px) 48vw, 620px">'+img+'</picture>';
  });
}

/* ============ Pages: home + vehicle wraps ============ */
const PAGES = {};
const arrowSm = () => icon("arrow", 14).replace("<svg", '<svg class="arrow"');

/* summary panel used by every configurator */
function summaryBox(o = {}) {
  return `<aside class="summary" aria-live="polite">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow plain">${esc(o.label || "Your estimate")}</span>${o.chip ? `<span class="chip">${esc(o.chip)}</span>` : ""}</div>
    <div class="total"><b data-total>$0</b><span class="tiny" data-sub>${esc(o.sub || "")}</span></div>
    <div class="lines" data-lines></div>
    <p class="tiny" data-note>${o.note || ""}</p>
    <div style="display:flex;flex-direction:column;gap:8px">${o.add !== false ? `<button class="btn block" data-add>${esc(o.addLabel || "Add to quote cart")}</button>` : ""}${o.second || ""}</div>
  </aside>`;
}

/* ---------- wrap reveal story ---------- */
function revealStory(stepsArr, o = {}) {
  const id = uid("rv");
  return `<section class="reveal-story" data-reveal id="${id}"><div class="wrap stick">
    <div><span class="eyebrow">${esc(o.eyebrow || "Scroll to watch it wrap")}</span>
      <div class="steps" style="margin-top:18px">${stepsArr.map(([k, t, d], i) => `<div class="step ${i === 0 ? "on" : ""}"><span class="mono tiny">${esc(k)}</span><h2 class="d2">${esc(t)}</h2><p class="lede">${esc(d)}</p></div>`).join("")}</div>
      <div class="meter">${stepsArr.map(() => "<i><b></b></i>").join("")}</div>
      ${o.cta ? `<div style="margin-top:26px">${o.cta}</div>` : ""}</div>
    <div class="stage">
      <div class="ph" aria-label="Vehicle being wrapped, panel by panel"><img src="${SITE.base}/img/${(o.pair || ["sprinter-bare"])[0]}.jpg" alt="Bare vehicle before wrapping" loading="lazy"><div class="rv-mask"><img class="top" data-top src="${SITE.base}/img/${(o.pair || [, "sprinter-wrapped"])[1]}.jpg" alt="Same vehicle fully wrapped" loading="lazy"></div><i class="edge" data-edge></i></div>
      <span class="hint" data-pct>0% applied</span>
    </div></div></section>`;
}

function homeVideoStory() {
  return `<section class="video-story" data-video-story><div class="wrap video-stick">
    <div class="video-copy"><span class="eyebrow">${esc(HOME_VIDEO.eyebrow)}</span>
      <div class="video-steps">${HOME_VIDEO.steps.map(([k, h, d], i) => `<div class="video-step ${i === 0 ? "active" : ""}" data-video-step="${i}"><span class="tiny">${esc(k)}</span><h2 class="d2">${esc(h)}</h2><p class="lede">${esc(d)}</p></div>`).join("")}</div>
      ${quoteBtn("Start a quote", "Vehicle Wraps", "btn")}
    </div>
    <figure class="video-figure">
      <div class="video-frame"><video data-scroll-video muted playsinline preload="none" disablepictureinpicture disableremoteplayback width="910" height="512" poster="${HOME_VIDEO.poster}" aria-label="${esc(HOME_VIDEO.label)}"><source src="${HOME_VIDEO.src}" type="video/mp4">${esc(HOME_VIDEO.caption)}</video></div>
    </figure>
  </div></section>`;
}

const HOME_REFRESH = {
  en: {labels:['Projects completed','Projects in progress','Successful projects','Customer satisfaction','Years of experience'],reviewKicker:'The words that matter most',reviewTitle:'Five stars. From our customers.',reviewText:'Your trust is our strongest recommendation.',reviewLink:'Read our Google reviews',clients:'Brands we work with',clientTitle:'In good company.',materials:'Materials & technology',materialTitle:'Quality starts with what we use.',materialText:'Premium films, protection and print technology. Chosen for the finish. Built for the long run.'},
  fr: {labels:['Projets réalisés','Projets en cours','Projets réussis','Satisfaction client','Années d’expérience'],reviewKicker:'La voix de nos clients',reviewTitle:'Cinq étoiles. Par nos clients.',reviewText:'Votre confiance est notre meilleure recommandation.',reviewLink:'Lire nos avis Google',clients:'Les marques avec lesquelles nous travaillons',clientTitle:'Bien entourés.',materials:'Matériaux et technologie',materialTitle:'La qualité commence par nos matériaux.',materialText:'Films haut de gamme, protection et technologie d’impression. Pour une finition durable.'},
  es: {labels:['Proyectos completados','Proyectos en proceso','Proyectos exitosos','Satisfacción del cliente','Años de experiencia'],reviewKicker:'La voz de nuestros clientes',reviewTitle:'Cinco estrellas. De nuestros clientes.',reviewText:'Tu confianza es nuestra mejor recomendación.',reviewLink:'Leer nuestras reseñas en Google',clients:'Marcas con las que trabajamos',clientTitle:'En buena compañía.',materials:'Materiales y tecnología',materialTitle:'La calidad empieza con los materiales.',materialText:'Películas premium, protección y tecnología de impresión. Para un acabado duradero.'},
  fa: {labels:['پروژه‌های انجام‌شده','پروژه‌های در حال انجام','پروژه‌های موفق','رضایت مشتریان','سال تجربه'],reviewKicker:'صدای مشتریان ما',reviewTitle:'پنج ستاره، از طرف مشتریان ما.',reviewText:'اعتماد شما، بهترین توصیه برای ماست.',reviewLink:'مشاهده نظرات در گوگل',clients:'برندهایی که با آن‌ها کار می‌کنیم',clientTitle:'در کنار برندهای معتبر.',materials:'متریال و تکنولوژی',materialTitle:'کیفیت از انتخاب متریال شروع می‌شود.',materialText:'فیلم‌های ممتاز، محافظت و تکنولوژی چاپ؛ برای کیفیتی که ماندگار باشد.'}
};
const HOME_CLIENT_LOGOS = [
  ['TTC','ttc','https://www.ttc.ca/'],['Metrolinx','metrolinx','https://www.metrolinx.com/'],['YRT','yrt','https://www.yrt.ca/'],['Save on Energy','saveonenergy','https://saveonenergy.ca/'],['Toronto District School Board','tdsb','https://www.tdsb.on.ca/'],['Canada Energy Audit','cea','https://www.canadaenergyaudit.ca/'],['Canadian Cancer Society','cancer','https://cancer.ca/en/']
];
const HOME_MATERIAL_LOGOS = [
  ['3M','3m','https://www.3mcanada.ca/'],['XPEL','xpel','https://www.xpel.com/'],['Mimaki','mimaki','https://mimaki.com/'],['ORAFOL / ORACAL','oracal','https://www.orafol.com/'],['TeckWrap','teckwrap','https://teckwrap.com/'],['KPMF','kpmf','https://www.kpmf.com/'],['HEXIS','hexis','https://www.hexis-graphics.com/en/']
];
function homeCounters() {
  const c=HOME_REFRESH[LANG]||HOME_REFRESH.en;
  return `<section class="home-numbers" aria-label="${esc(c.labels.join(', '))}"><div class="wrap"><div class="counter-grid">${[[9753,0,''],[34,0,''],[100,0,'%'],[5,1,''],[11,0,'']].map(([v,d,s],i)=>`<div class="counter-item"><b data-count="${v}" data-decimals="${d}" data-suf="${s}">${v.toLocaleString('en-CA',{minimumFractionDigits:d,maximumFractionDigits:d})}${s}</b><span>${esc(c.labels[i])}</span></div>`).join('')}</div></div></section>`;
}
const HOME_LOGO_FILES = {"teckwrap":"teckwrap.png","kpmf":"kpmf.png","hexis":"hexis.svg","cea":"cea.png","cancer":"cancer-canada.svg","ttc": "ttc.svg", "metrolinx": "metrolinx.svg", "yrt": "yrt.svg", "saveonenergy": "save-on-energy.svg", "tdsb": "tdsb.jpg", "3m": "3m.svg", "avery": "avery-dennison.png", "arlon": "arlon.webp", "xpel": "xpel.svg", "mimaki": "mimaki.svg", "oracal": "orafol.svg"};
function homeLogoLinks(logos) {
  return logos.map(([name,key,url])=>`<a class="brand-logo brand-${key}" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)}"><img src="${SITE.base}/img/brands/${HOME_LOGO_FILES[key]}" alt="${esc(name)}" loading="lazy" width="180" height="80"></a>`).join('');
}
const HOME_GOOGLE_REVIEWS = [{"name": "M Fard", "text": "professional, efficient, and detail-oriented.", "kind": "excerpt", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmMT5a4QKAK7mU5_AgmuOR5xf10cKR00PFy8NO7CJ8WTRmxDzHUSLvCz3lpbwMFEgRbx6M1z3_-DKcA7okZWP7RoBLxM455Qdj7lEGnlZ46XNOaqsKYQxMh1vv49r9QkUFqpgDfbv6x0Rhzf=w375-h281-p-k-no"}, {"name": "Vahit DinÃ§", "text": "my van looks even better than in my dreams.", "kind": "excerpt"}, {"name": "Swift Safe", "text": "clean, sharp, and very professional.", "kind": "excerpt", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmPygUXhp8LtxChhZ0suxLvtB1R3i68IMfdB0HraURteSJG07TaMCN_RHZawYxOoHAyaZIxZ4IaKPosZCEJWjkg4vrzFz9dBqBa4F6VkRLqNCn7x1o5ZDf7kF_j-VKA2GpELQ5RHiLXodyQ=w375-h563-p-k-no"}, {"name": "babak Zamani", "text": "Pleased with the vehicle work and the overall experience.", "kind": "summary"}, {"name": "Last King Construction Inc.", "text": "Praised the truck design, workmanship and helpful communication.", "kind": "summary", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmPZnNjskwo8BTfAsz0PENE_FBH1aWG9Et3Rs14ftSO2OvcCqQk2X0kEZlfIdIEByiVNx20ivL5qa0iSb2Yt6l1OUa-5gzNU-kKxAZgX1s6LGjr4nFJCsILTu0RK2JmWVmSMzOisNHG-NbDJ=w375-h281-p-k-no"}, {"name": "moon tarar", "text": "Happy with the company truck graphics and careful workmanship.", "kind": "summary", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmPkQcopOvZ6t5cvTewLchud_l5XdIpLKnKmJt6DsBZgrfNpErHnAZYIX8303oexJFq65nPiyiANIbvN_75CFIxX5idJ_NuH5pcYK28vy07MMOK_SOmyjbBYmFBatCingPXNoc3yzA8QAq4=w375-h563-p-k-no"}, {"name": "Chris Keough", "text": "The team realised a personal rear-window graphic concept others could not produce.", "kind": "summary", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmMHwR9Zeq6Djvz4y61qb9A6Z0CUFOsNe_JkLesngPPjOBVLNvMg8c0LhHTmTuJtXTE-Y8uLOwHLjEMSTqOp6qt6dJ0qlzQ79viJslL5g4QMEdeFXv1wOW3CjzVHSR6bnJ_DHcMPvLK-Vpbc=w750-h563-p-k-no"}, {"name": "Sam Matin", "text": "Highlighted creative support and strong care throughout the commercial vehicle project.", "kind": "summary", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmPZ3TBcBXjjv79f98tP42t0sgx6_wK9_oCfeBDswI0reR8YRi4rtBOkNKhiLsswOelL9MuYYsa882u3uaoVrregxJmDORI-fUV_CxXIdPKWmO3shDhyFIJKKEFQhhjq9Ad5xONZ-uHo7G9o=w375-h563-p-k-no"}, {"name": "Brentt", "text": "The van graphics surpassed expectations, with neat alignment and a crisp design.", "kind": "summary", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmOX_qctp8RjB1ab4HxhYWOKLbn10QdnMyV3Lz26AZtWTPGUc0pmQpgclvuAEkB0Os88V2k-jfCVarfVNLadmfLvWFoM93kQIzTaTQlaf-TW6jQfPVPdOMtKBbCRWvM1pka9cc-A6ybVdT2W=w375-h563-p-k-no"}, {"name": "Amir Behnam", "text": "Pleased with the matte protective film installation and the team's expertise.", "kind": "summary", "photo": "https://lh3.googleusercontent.com/grass-cs/ACvplmPRi-sqQTLH9HH_kqUYBqNChzHTNtIemgVJHb0bGQLviFKEzLftQGBLrG5nO7p0kDs9VZNVy5AfMeuT0o1C1yDn7D9F908kljWcMrn8Zs07bcfwvuN6UY3CbdwGJyPtQ7rXmuaIXwXHV2nR=w375-h563-p-k-no"}];
const GOOGLE_REVIEW_URL='https://www.google.com/maps/search/?api=1&query=SatinGraphic.ca+Vaughan';
function homeReviewCarousel(){
 const labels=LANG==='fa'?['نظرات مشتریان','توقف اسلایدها','نظرات بعدی']:['Customer reviews','Pause slides','Next reviews'];
 return `<div class="review-carousel" data-review-carousel aria-roledescription="carousel" aria-label="${labels[0]}"><div class="review-slides">${HOME_GOOGLE_REVIEWS.map((r,i)=>`<article class="review-slide${i<2?' active':''}" data-review-slide aria-hidden="${i>=2}" lang="en" dir="ltr"><span class="rating-stars" aria-label="5 stars">★★★★★</span><blockquote>${r.kind==='excerpt'?'“':''}${esc(r.text)}${r.kind==='excerpt'?'”':''}</blockquote>${r.photo?`<img class="review-photo" src="${r.photo}" alt="Photo shared with ${esc(r.name)}'s Google review" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">`:''}<div class="review-person"><span class="review-avatar" aria-hidden="true">${esc(r.name[0])}</span><div><b>${esc(r.name)}</b><span>Google review · ${r.kind}</span></div></div><a href="${GOOGLE_REVIEW_URL}" target="_blank" rel="noopener noreferrer" ${i>=2?'tabindex="-1"':''}>Read on Google</a></article>`).join('')}</div><div class="review-controls"><span class="small">${LANG==='fa'?'۱۰ نظر واقعی · نمایش تصادفی':'10 real reviews · random rotation'}</span><button type="button" class="review-pause" data-review-pause aria-pressed="false">${labels[1]}</button><button type="button" class="review-next" data-review-next aria-label="${labels[2]}">›</button></div></div>`;
}
const PROCESS_V3 = {
  en:[['Tell us your idea','Call or email us. We’ll discuss your project, goals and the surface you want to transform.'],['Design it together','Our designer creates your artwork. You review the proof before we move forward.'],['Print with precision','We print and prepare your graphics using the right film and finish for your project.'],['Install the transformation','Our installers apply the vinyl, finish every edge and check the final result.']],
  fa:[['ایده‌ات را با ما در میان بگذار','تماس بگیر یا ایمیل بفرست؛ دربارهٔ پروژه، هدفت و جزئیات کار صحبت می‌کنیم.'],['با هم طراحی می‌کنیم','طراح ما طرح را آماده می‌کند؛ پیش از تولید، نمونهٔ نهایی را بررسی و تأیید می‌کنی.'],['چاپ دقیق و حرفه‌ای','طرح با متریال و روکش مناسب چاپ و برای نصب آماده می‌شود.'],['تغییر را اجرا می‌کنیم','تیم ما وینیل را نصب می‌کند، لبه‌ها را پرداخت می‌کند و نتیجهٔ نهایی را بررسی می‌کند.']],
  fr:[['Parlez-nous de votre idée','Appelez-nous ou envoyez un courriel pour discuter de votre projet.'],['Créons votre design','Notre designer prépare votre visuel. Vous approuvez la maquette avant la production.'],['Imprimons avec précision','Nous imprimons et préparons les graphismes avec les matériaux adaptés.'],['Installons la transformation','Notre équipe pose le vinyle, soigne les finitions et vérifie le résultat.']],
  es:[['Cuéntanos tu idea','Llámanos o envíanos un correo para hablar de tu proyecto.'],['Diseñamos juntos','Nuestro diseñador prepara el arte. Apruebas la prueba antes de producir.'],['Imprimimos con precisión','Imprimimos y preparamos los gráficos con los materiales adecuados.'],['Instalamos el cambio','Nuestro equipo aplica el vinilo, termina los bordes y revisa el resultado.']]
};
function processVector(i){
  const paths=[
    '<circle cx="34" cy="23" r="10"/><path d="M14 77V62c0-13 9-22 20-22s20 9 20 22v15M25 55v22M43 55v22M54 47l9-7M66 14c-3 2-6 9-4 16s7 14 11 15l7-5-5-9-6 2-4-9 5-4-4-6z"/><path class="vector-accent" d="M76 14c7 5 10 12 10 21M79 7c10 6 15 16 15 28"/>',
    '<circle cx="22" cy="21" r="9"/><path d="M7 77V55c0-11 7-19 15-19 9 0 16 7 16 17v6l12 5M17 50v16l15 9M40 77h48M52 67l-4 10"/><rect x="43" y="18" width="44" height="34" rx="4"/><path d="M65 52v10M55 62h20"/><path class="vector-accent" d="M52 29l8 7-8 7M65 43h12"/>',
    '<path d="M27 28V10h42v18M21 64H12V34h72v30H74"/><rect x="26" y="48" width="44" height="36" rx="2"/><path d="M36 62h24M36 71h17"/><circle class="vector-accent" cx="72" cy="39" r="2"/>',
    '<path d="M7 62V43l12-5 9-20h39l13 24 9 4v16M21 62h53M24 38h48M47 20v18"/><circle cx="21" cy="65" r="9"/><circle cx="75" cy="65" r="9"/><path class="vector-accent" d="M35 45h30v12H35zM65 45l8-7v14l-8 5M33 45l-5 12"/>'
  ];
  return `<svg viewBox="0 0 96 96" width="96" height="96" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[i]}</svg>`;
}
function homeScrollProcess(){
  const steps=PROCESS_V3[LANG]||PROCESS_V3.en;
  const c=HOME_CONTENT.copy[LANG]||HOME_CONTENT.copy.en;
  return `<section class="process-story" data-process-story><div class="wrap process-stick"><div class="sec-head"><span class="eyebrow">${esc(c.processKicker)}</span><h2 class="d2">${esc(c.processTitle)}</h2></div><div class="process-layout"><div class="process-visual">${steps.map(([h,d],i)=>`<div class="process-vector${i===0?' active':''}" data-process-vector>${processVector(i)}</div>`).join('')}<div class="process-line"><span data-process-progress></span></div></div><div class="process-copy">${steps.map(([h,d],i)=>`<article class="process-step${i===0?' active':''}" data-process-step><span class="process-index">0${i+1} / 04</span><h3>${esc(h)}</h3><p class="lede" data-process-type>${esc(d)}</p></article>`).join('')}</div></div><div class="process-waypoints" aria-hidden="true">${steps.map(([h],i)=>`<span data-process-point="${i}" class="${i===0?'active':''}">${esc(h)}</span>`).join('')}</div></div></section>`;
}
function processStoryTick(){
  const section=document.querySelector('[data-process-story]');if(!section||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const r=section.getBoundingClientRect(),head=document.querySelector('.hdr')?.offsetHeight||68;
  const progress=Math.max(0,Math.min(.9999,(head-r.top)/Math.max(1,r.height-(innerHeight-head))));
  const index=Math.floor(progress*4),phase=progress*4-index;
  section.querySelectorAll('[data-process-step]').forEach((e,i)=>{e.classList.toggle('active',i===index);e.setAttribute('aria-hidden',i!==index);e.style.setProperty('--written',Math.min(1,phase*2.5));});
  section.querySelectorAll('[data-process-vector]').forEach((e,i)=>e.classList.toggle('active',i===index));
  section.querySelectorAll('[data-process-point]').forEach((e,i)=>e.classList.toggle('active',i===index));
  section.querySelector('[data-process-progress]').style.transform=`scaleX(${progress})`;
}
function bindReviewCarousel(root){
 const el=root.querySelector('[data-review-carousel]');if(!el)return;
 const slides=[...el.querySelectorAll('[data-review-slide]')];
 const order=slides.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 let current=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,visible=false,hover=false,focused=false;
 const show=()=>{const active=[0,1].map(n=>order[(current+n)%order.length]);slides.forEach((s,i)=>{const on=active.includes(i);s.classList.toggle('active',on);s.setAttribute('aria-hidden',!on);s.querySelector('a').tabIndex=on?0:-1;s.style.order=active.indexOf(i);});};show();
 const pause=el.querySelector('[data-review-pause]');pause.setAttribute('aria-pressed',paused);
 pause.addEventListener('click',()=>{paused=!paused;pause.setAttribute('aria-pressed',paused);pause.textContent=paused?(LANG==='fa'?'ادامهٔ اسلایدها':'Resume slides'):(LANG==='fa'?'توقف اسلایدها':'Pause slides');});
 el.querySelector('[data-review-next]').addEventListener('click',()=>{current=(current+2)%order.length;show();});
 el.addEventListener('mouseenter',()=>hover=true);el.addEventListener('mouseleave',()=>hover=false);
 el.addEventListener('focusin',()=>focused=true);el.addEventListener('focusout',e=>focused=el.contains(e.relatedTarget));
 const observer=new IntersectionObserver(entries=>visible=entries.some(e=>e.isIntersecting));observer.observe(el);
 const timer=setInterval(()=>{if(visible&&!paused&&!hover&&!focused&&!document.hidden){current=(current+2)%order.length;show();}},6500);
 el._cleanup=()=>{clearInterval(timer);observer.disconnect();};
}

function homeTrust() {
  const c=HOME_REFRESH[LANG]||HOME_REFRESH.en;
  return `<section class="home-reviews sec"><div class="wrap"><div class="google-review-layout"><div><span class="eyebrow">${esc(c.reviewKicker)}</span><h2 class="d2">${esc(c.reviewTitle)}</h2><p class="lede">${esc(c.reviewText)}</p><a class="review-link" href="https://www.google.com/maps/search/?api=1&query=SatinGraphic.ca+Vaughan" target="_blank" rel="noopener noreferrer">${esc(c.reviewLink)}</a></div><a class="google-rating" href="https://www.google.com/maps/search/?api=1&query=SatinGraphic.ca+Vaughan" target="_blank" rel="noopener noreferrer" aria-label="5.0 out of 5 on Google"><span class="google-word" aria-label="Google"><i>G</i><i>o</i><i>o</i><i>g</i><i>l</i><i>e</i></span><div class="rating-score">5.0<span>/ 5</span></div><span class="rating-stars" aria-label="5 stars">★★★★★</span><span class="rating-label">Google Reviews · 204</span></a></div><div class="review-carousel-wrap">${homeReviewCarousel()}</div></div></section><section class="home-clients sec"><div class="wrap"><div class="sec-head"><span class="eyebrow">${esc(c.clients)}</span><h2 class="d2">${esc(c.clientTitle)}</h2></div><div class="logo-row">${homeLogoLinks(HOME_CLIENT_LOGOS)}</div></div></section>`;
}
function homeMaterials() {
  const c=HOME_REFRESH[LANG]||HOME_REFRESH.en;
  return `<section class="home-materials sec"><div class="wrap"><div class="sec-head"><span class="eyebrow">${esc(c.materials)}</span><h2 class="d2">${esc(c.materialTitle)}</h2><p class="lede">${esc(c.materialText)}</p></div><div class="logo-row materials-row">${homeLogoLinks(HOME_MATERIAL_LOGOS)}</div></div></section>`;
}

/* ---------- HOME ---------- */
PAGES.home = () => {
  const c=HOME_CONTENT.copy[LANG]||HOME_CONTENT.copy.en;
  return {title:c.seoTitle,html:`
  <section class="hhero"><div class="wrap"><div class="top"><div style="display:flex;flex-direction:column;gap:18px;min-width:0"><span class="eyebrow">${esc(c.kicker)}</span><h1 class="d1">${c.headline.map(h=>`<span>${esc(h)}</span>`).join('')}</h1></div><div style="display:flex;flex-direction:column;gap:18px;max-width:420px"><p class="lede">${esc(c.intro)}</p><div style="display:flex;gap:10px;flex-wrap:wrap">${quoteBtn(tr('Start a quote'))}${A('/portfolio',tr('See our work'),'btn ghost')}</div></div></div></div></section>
  ${homeCounters()}
  ${homeVideoStory()}
  ${homeTrust()}
  ${sec(secHead(c.servicesKicker,c.servicesTitle,c.servicesIntro)+`<div class="svc home-services">${HOME_CONTENT.services.map(s=>`<a href="${href(s.path)}"><span class="service-icon">${icon(s.icon,22)}</span><h3>${esc(tr(s.name))}</h3><p class="small">${esc(s.description[LANG]||s.description.en)}</p>${art(s.icon==='shirt'?'apparel':'photo',{photo:s.icon==='shirt'?null:s.photo,alt:tr(s.name)+' — Satin Graphic',tag:false})}<span class="link">${esc(tr('Explore'))} ${arrowSm()}</span></a>`).join('')}</div>`)}
  ${homeMaterials()}
  ${sec(secHead(c.workKicker,c.workTitle,c.workIntro)+`<div class="home-work">${HOME_CONTENT.work.map(w=>`<figure>${art('photo',{photo:w.photo,alt:w.title[LANG]||w.title.en,tag:false})}<figcaption>${esc(w.title[LANG]||w.title.en)}</figcaption></figure>`).join('')}</div>`,'alt')}
  ${homeScrollProcess()}
  ${ctaBand(c.ctaTitle,c.ctaText,tr('Start a quote'))}`};
};

/* ---------- VEHICLE WRAPS HUB ---------- */
PAGES.wraps = () => ({
  title: "Vehicle Wraps",
  html: hero({ kicker: "Vehicle Wraps", title: "Turn the fleet into media.", lede: "Commercial fleet graphics, full colour-change wraps and paint protection film — designed, printed and installed in-house.", crumbs: [["Home", "/"], ["Vehicle Wraps"]], ctas: quoteBtn("Get a wrap quote", "Vehicle Wraps") + A("/vehicle-wraps/estimator", "Open price estimator", "btn ghost"), art: art("fleet", { photo: "job-greenlife-van", alt: "GreenLife van wrap by Satin" }) }) +
    sec(secHead("Choose the transformation", "Four ways to change how your vehicle looks, works and gets noticed.") + linkCards([
      { name: "Commercial Wraps", path: "/vehicle-wraps/commercial", d: "Brand your business vehicles with high-impact printed graphics, from decals to a full wrap.", art: art("fleet", { photo: "job-mx-van" }) },
      { name: "Color Change", path: "/vehicle-wraps/color-change", d: "Premium finishes for a completely new look without repainting.", art: art("color", { photo: "job-tesla-flip", pos: "center 60%" }) },
      { name: "Paint Protection Film", path: "/vehicle-wraps/paint-protection-film", d: "Clear protection for high-impact areas or the entire vehicle.", art: art("ppf", { photo: "install-ppf" }) },
      { name: "Price Estimator", path: "/vehicle-wraps/estimator", d: "Choose your vehicle, coverage and finish to see a starting price.", art: art("fleet", { photo: "sprinter-bare" }) },
    ], 4)) +
    sec(`<div class="split" style="align-items:center"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Instant price estimator</span><h2 class="d2">Plan your wrap before you visit.</h2><p class="lede">Choose your vehicle, coverage, roof and finish to get an instant starting estimate.</p><p class="tiny">3M · Professional installation · 5-year wrap warranty</p></div>
      <div class="card" style="padding:26px;gap:14px"><span class="eyebrow plain">Reference configuration</span><h3 class="d3">Transit High Roof Long Wheel</h3><p class="small">Full commercial wrap · roof not included</p><div style="display:flex;align-items:baseline;gap:10px"><span class="tiny">FROM</span><b style="font-size:44px;letter-spacing:-.03em">$3,950</b></div>${A("/vehicle-wraps/estimator/transit-van", `Open price estimator ${arrowSm()}`, "btn")}</div></div>`, "alt") +
    revealStory([["01 — Bare panel", "Bare panel", "We start from a clean, decontaminated panel and take exact measurements."], ["02 — Design proof", "Design proof", "A to-scale digital proof is built and approved before anything is printed."], ["03 — Print & laminate", "Print & laminate", "The design is printed in-house and sealed under a protective laminate."], ["04 — Installed wrap", "Installed wrap", "Certified installers apply the wrap panel by panel, heat-formed around every edge."]], { eyebrow: "How a wrap comes together", pair: ["van-bare", "van-wrapped"] }) +
    faqSec("wraps") + ctaBand("One vehicle or twenty. Start with a quote.", "Tell us the vehicle and what you have in mind. We’ll send a ballpark within one business day.", "Get a wrap quote", "Vehicle Wraps"),
});

/* ---------- COMMERCIAL ---------- */
PAGES.commercial = () => ({
  title: "Commercial Wraps",
  html: hero({ kicker: "Commercial Vehicle Wraps", title: "Your fleet should look as professional as you are.", lede: "Custom commercial wraps built for visibility, consistency and long-term use — from one van to a complete fleet.", crumbs: [["Home", "/"], ["Vehicle Wraps", "/vehicle-wraps"], ["Commercial Wraps"]], ctas: quoteBtn("Get a commercial wrap quote", "Vehicle Wraps"), art: art("fleet", { photo: "job-red-van" }) }) +
    sec(secHead("Coverage", "Choose the right level of coverage.", "From clean lettering to maximum-impact full wraps.") + coverageCards()) +
    sec(secHead("Built around your vehicle", "One brand. Every vehicle in your fleet.") + linkCards(COMMERCIAL.map((c, i) => ({ name: c.name, path: "/vehicle-wraps/commercial/" + c.slug, d: c.blurb, cta: "View options", art: art("fleet", { veh: c.veh, seed: i, tag: false, photo: c.photo }) })), 3), "alt") +
    workSec("Fleets we’ve wrapped", WORK.fleet, { lede: "Recent fleet and commercial work from the shop floor." }) +
    faqSec("wraps", { cls: "alt" }) +
    ctaBand("One vehicle or twenty. Start with a quote.", "Typical full-wrap pricing starts around $2,800.00, confirmed after we see the vehicle.", "Get a commercial wrap quote", "Vehicle Wraps"),
});

PAGES.commercialItem = ({ slug }) => {
  const c = COMMERCIAL.find(x => x.slug === slug); if (!c) return null;
  const one = c.one;
  return {
    title: c.name,
    html: hero({ kicker: "Commercial Wraps · " + c.name, title: `${c.name} built to work as hard as you do.`, lede: c.blurb, crumbs: [["Home", "/"], ["Vehicle Wraps", "/vehicle-wraps"], ["Commercial", "/vehicle-wraps/commercial"], [c.name]], ctas: quoteBtn(`Get a quote for ${c.name.toLowerCase()}`, "Vehicle Wraps", "btn", `Vehicle: ${c.name}`) + A("/vehicle-wraps/estimator", "Price estimator", "btn ghost"), art: art("fleet", { veh: c.veh, seed: hash(slug), tag: c.name, photo: c.photo }) }) +
      sec(secHead("Coverage", "Choose the right level of coverage.") + coverageCards()) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Why wrap your ${one}</span><h2 class="d2">${c.fleet ? "One brand system. Every vehicle, every year." : "A moving billboard that pays for itself."}</h2>
        <div class="prose"><p>${c.fleet ? "A fleet program starts with one brand template built on your most common vehicle, then adapts it to every other body style you run. New vehicles join the fleet already matching the last one — same colours, same layout, same phone number placement." : `${c.name} spend the whole working day in traffic, at job sites and parked outside customers’ homes. A wrap turns every one of those hours into brand impressions — with a one-time cost instead of a monthly ad spend.`}</p>
        <p>We design around the vehicle, not just on top of it: door handles, seams, body lines and windows are all mapped on the template so phone numbers never land on a gap and logos never fold around a corner.</p></div></div>
        ${feats([["Designed to the template", "Every panel is laid out on a to-scale vehicle outline before print.", "ruler"], ["Cast film, laminated", "3M IJ180 under a matching UV laminate.", "layers"], ["Certified installers", "Installed in our own bay by our own team — never subcontracted.", "shield"], ["Minimal downtime", "Most vehicles are back on the road the next day.", "clock"]], 2)}</div>`, "alt") +
      sec(secHead("How it works", "From first sketch to the road.", "What we need from you, and what happens on our side.") + `<div class="split">${spec([["What we need", "Vehicle year, make, model and trim · logo as vector (AI, EPS, SVG or PDF) · brand colours"], ["Design", "Design services: $250 + tax; any project credit is confirmed in writing"], ["Film", "3M IJ180mC-10 cast vinyl, with gloss, matte or satin laminate"], ["Lead time", "Design 3–5 business days · print 1–2 days · install 1–2 days"], ["Care", "Hand wash only; no pressure washing at edges; no wax on matte finishes"]])}<div style="display:flex;flex-direction:column;gap:16px">${steps(PROCESS.wrap)}<div class="note">${icon("file")}<span>Have your own designer? Ask us for the vehicle template first — we’ll send the exact outline with panel dimensions. ${A("/artwork-guidelines", "Full artwork guidelines", "link")}</span></div></div></div>`) +
      workSec(`${c.name} we’ve wrapped`, WORK.fleet, { lede: "Recent fleet and commercial work from the shop floor.", cls: "alt" }) +
      faqSec("wraps") + ctaBand(`Ready to brand your ${one}?`, "Tell us the vehicle and what you have in mind. We’ll send a ballpark within one business day and a firm quote after we see it.", `Get a quote for ${c.name.toLowerCase()}`, "Vehicle Wraps"),
  };
};

/* ---------- COLOUR CHANGE ---------- */
PAGES.colorChange = () => ({
  title: "Color Change Wrap",
  html: hero({ kicker: "Color Change Wrap", title: "A new colour, no repaint required.", lede: "Premium finishes for a completely new look — fully reversible, and easier on resale value than paint.", crumbs: [["Home", "/"], ["Vehicle Wraps", "/vehicle-wraps"], ["Color Change"]], ctas: quoteBtn("Get a colour change quote", "Vehicle Wraps", "btn", "Coverage: Colour Change"), art: art("color", { photo: "job-tesla-flip", pos: "center 62%" }) }) +
    sec(secHead("Popular on", "Every body style, matched to the panel gaps.") + `<div class="grid g5" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${[["Car / Sedan", "Factory-line panel gaps templated for a seamless finish.", "cc-bmw-green"], ["SUV / Crossover", "Popular in satin and colour-flip finishes.", "cc-suv-green"], ["Pickup Truck", "Bed rail and mirror caps matched or contrasted.", "cc-pickup-green"], ["Coupe & sports car", "Wheel arches and spoilers wrapped in one piece where the film allows.", "cc-audi-green"], ["Tesla & EV", "Panel gaps and camera cut-outs templated to factory spec.", "job-tesla-flip"]].map(([t, d, v], i) => `<div class="card">${art("color", { photo: v })}<h3>${t}</h3><p>${d}</p></div>`).join("")}</div>`) +
    sec(`<div class="split" style="align-items:center"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Finish options</span><h2 class="d2">Pick a finish to preview its character.</h2>
      ${seg("Finish", FINISHES.map(f => f.name), 0, { key: "finish" })}
      <div class="og"><span class="lab">Colour</span><div class="swatches" data-swatches>${[["#2f3a46", "#8b9bab"], ["#0f1a3a", "#4a6cc4"], ["#1d3b2a", "#78b28d"], ["#3a1012", "#e8314a"], ["#1b1b1d", "#6b6b70"], ["#c9ced6", "#ffffff"]].map((c, i) => `<button type="button" aria-label="Colour ${i + 1}" data-c="${c.join(",")}" aria-pressed="${i === 0}" style="background:linear-gradient(135deg,${c[1]},${c[0]})"></button>`).join("")}</div></div>
      <p class="lede" data-finish-d><b>Gloss.</b> ${FINISHES[0].d}</p>${quoteBtn("Get a color change quote", "Vehicle Wraps")}</div>
      <div class="finish-stage" data-finish-stage>${vehicleSVG("sedan", { mode: "color", c: ["#2f3a46", "#8b9bab"], anim: true, gloss: .55 })}</div></div>`, "alt") +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Why colour change</span><h2 class="d2">Every finish paint can’t do, and a few it can.</h2><div class="prose"><p>A colour-change wrap replaces the visible colour of the vehicle with cast vinyl film — gloss, satin, matte, satin chrome or colour-flip — without touching the paint underneath. It protects the factory finish, holds resale value, and comes off cleanly when you want the original colour back.</p><p>We disassemble handles, lights and trim where needed so the film tucks behind edges rather than being cut on the panel, and we template panel gaps and camera cut-outs on modern vehicles so the finish looks factory.</p></div></div>
      ${feats([["150+ colours", "Explore the 3M wrap colour range, sampled in-shop.", "drop"], ["Protects the paint", "Stone chips and swirls land on the film, not the clear coat.", "shield"], ["Fully reversible", "Removes cleanly from OEM paint, even years later.", "layers"], ["Door jambs optional", "Add jambs for a colour match when the doors are open.", "ruler"]], 2)}</div>`) +
    sec(secHead("Before you book", "What to know about a colour change.") + `<div class="split">${spec([["Paint condition", "Must be OEM or a fully cured, professionally applied repaint. Peeling clear coat can’t be wrapped."], ["Finish care", "Matte and satin: no wax, no polish, no automatic brush washes. Gloss: treat like paint."], ["Lead time", "Film ordered to colour — allow 3–5 days for material plus 2–3 days in the bay"], ["Warranty", "5-year workmanship; film warranty per manufacturer (3–7 years by finish)"], ["Registration", "Ontario doesn’t require you to update the colour on your ownership, but your insurer may want to know"]])}<div style="display:flex;flex-direction:column;gap:16px">${steps(PROCESS.wrap)}<div class="note">${icon("eye")}<span>Book a 20-minute sample session — we keep swatch books of every finish so you can see it on the actual vehicle in daylight.</span></div></div></div>`, "alt") +
    workSec("Recent colour changes", WORK.color) + faqSec("color", { cls: "alt" }) +
    ctaBand("Pick a finish, we’ll do the rest.", "Tell us the vehicle and the finish you’re after. We’ll confirm film availability and a firm price.", "Get a colour change quote", "Vehicle Wraps"),
  init(root) {
    const stage = root.querySelector("[data-finish-stage]"), d = root.querySelector("[data-finish-d]");
    let cols = ["#2f3a46", "#8b9bab"], fin = FINISHES[0];
    const draw = () => {
      const g = { Gloss: .55, Matte: 0, Satin: .22, "Satin Chrome": .9, "Colour-Flip": .7 }[fin.name];
      const c = fin.name === "Colour-Flip" ? [cols[0], "#d42d80"] : fin.name === "Satin Chrome" ? [cols[0], "#f0f2f5"] : cols;
      stage.innerHTML = vehicleSVG("sedan", { mode: "color", c, anim: g > 0, gloss: g });
      d.innerHTML = `<b>${esc(fin.name)}.</b> ${esc(fin.d)}`;
    };
    root.querySelector('[data-group="finish"]').addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); fin = FINISHES.find(f => f.name === b.dataset.val); draw(); });
    root.querySelector("[data-swatches]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); cols = b.dataset.c.split(","); draw(); });
  },
});

/* ---------- PPF ---------- */
PAGES.ppf = () => ({
  title: "Paint Protection Film",
  html: hero({ kicker: "Paint Protection Film", title: "Clear protection that shrugs off the road.", lede: "Self-healing film for high-impact areas or the entire vehicle — invisible until it saves your paint.", crumbs: [["Home", "/"], ["Vehicle Wraps", "/vehicle-wraps"], ["Paint Protection Film"]], ctas: quoteBtn("Get a PPF quote", "Vehicle Wraps", "btn", "Coverage: Paint Protection Film"), art: art("ppf", { photo: "install-ppf" }) }) +
    sec(secHead("Packages", "Two ways to cover it.") + `<div class="grid g2">${[["Partial Front PPF", "Hood, fenders, mirrors and front bumper — the zone that takes the most rock-chip impact.", "Front-end panels"], ["Full Vehicle PPF", "Every painted panel covered in self-healing film that shrugs off light swirl marks with heat.", "Full body"]].map(([t, d, c], i) => `<div class="card" style="padding:26px">${art("ppf", { photo: i ? "ppf-audi-3" : "ppf-audi-1", style: "aspect-ratio:16/8" })}<h3 class="d3">${t}</h3><p>${d}</p><div class="foot"><span class="tiny">Coverage: ${c} · Warranty: 10 yr clarity</span>${quoteBtn("Get a quote", "Vehicle Wraps", "btn sm", "Coverage: " + t)}</div></div>`).join("")}</div>`) +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Why PPF</span><h2 class="d2">Invisible until the day it saves your paint.</h2><div class="prose"><p>Paint protection film is a thick, optically clear urethane applied to the panels that take the most abuse — bumper, hood, fenders, mirrors and rocker panels — or the entire vehicle. Rock chips, bug etching and light scratches stop at the film. Its top coat self-heals light swirls with heat from the sun or a hot rinse.</p><p>We cut film on plotter patterns specific to your vehicle’s year and trim, so edges are wrapped around panels rather than cut on the paint.</p></div></div>
      ${feats([["Rock-chip proof", "8 mil urethane absorbs impacts that would chip clear coat.", "shield"], ["Self-healing top coat", "Light swirls and scuffs disappear with warmth.", "heat"], ["Hydrophobic", "Sheds water and road grime; stays clear for a decade.", "drop"], ["Computer-cut patterns", "Vehicle-specific templates — no blades on your paint.", "ruler"]], 2)}</div>`, "alt") +
    sec(secHead("Coverage options", "Choose how much of the vehicle to protect.") + `<div class="split">${spec([["Partial front", "Full bumper, 18–24 in of hood and fenders, mirror caps"], ["Full front", "Full bumper, full hood, full fenders, mirrors, headlights"], ["Track pack", "Full front plus rocker panels, A-pillars, roof leading edge, rear wheel arches"], ["Full body", "Every painted panel; optional matte finish film for a satin look"], ["Care", "Wash after 48 hours; no wax with abrasives; ceramic coat on top is recommended"]])}${steps(PROCESS.ppf)}</div>`) +
    workSec("Protected vehicles", WORK.ppf, { cls: "alt" }) + faqSec("ppf") +
    ctaBand("Protect it before the first road trip.", "Tell us the vehicle and how much coverage you want. New-vehicle bookings get priority scheduling.", "Get a PPF quote", "Vehicle Wraps"),
});

/* ---------- ESTIMATOR ---------- */
PAGES.estimator = () => ({
  title: "Price Estimator",
  html: hero({ kicker: "Wrap Price Estimator", title: "First, choose your vehicle.", lede: "Explore your vehicle category, then choose its size, wrap coverage, material and finish for a tailored estimate.", crumbs: [["Home", "/"], ["Vehicle Wraps", "/vehicle-wraps"], ["Price Estimator"]] }) +
    sec(secHead("Find your vehicle category", "Every category prices differently — pick yours to get specific.") + linkCards(ESTIMATOR.map((v, i) => ({ name: v.name, path: "/vehicle-wraps/estimator/" + v.slug, d: v.d, price: "From " + money(v.base), cta: "Build estimate", art: art("fleet", { veh: v.veh, seed: i, tag: false, photo: v.photoKey ? VEH_PHOTOS[v.photoKey][0] : null }) })), 4)) +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">How the estimator works</span><h2 class="d2">An honest starting price, straight from our quote table.</h2><div class="prose"><p>Each category starts from the square footage of film that vehicle class needs, then scales it by coverage (decals through full wrap), material and finish. The vehicle-specific questions on each page — roof height, cab size, box length — are exactly what moves the real quote.</p><p>It’s the same table our estimators use. The final number moves only for things we can’t see online: paint condition, roof coverage, complex bumpers, or removal of an old wrap.</p></div></div>
      ${feats([["Sized to the body", "Base price reflects the film area for this vehicle class.", "ruler"], ["Coverage scales it", "Decals, partial, ¾ or full wrap — pick what you need.", "layers"], ["Finish matters", "Gloss is standard; matte, satin and chrome carry a premium.", "drop"], ["No surprise add-ons", "Print, laminate and install are included. Custom design adds $250 when selected.", "check"]], 2)}</div>`, "alt") +
    revealStory([["Bare panel", "Every estimate ends the same way.", "Measured, proofed, printed and installed in-house."], ["Applied", "Printed and laminated.", "Cast film under a matching laminate, heat-formed to the body."], ["Finished", "A finished wrap.", "The same process behind every price on this page."]], { eyebrow: "See it in motion", pair: ["suv-full-bare", "suv-full-wrapped"], cta: quoteBtn("Start a real quote", "Vehicle Wraps", "btn ghost") }) +
    faqSec("estimator") + ctaBand("Prefer to talk it through?", "Send a few photos and we’ll firm up a number without a visit.", "Request a firm quote", "Vehicle Wraps"),
});

PAGES.estimatorItem = ({ slug }) => {
  const v = ESTIMATOR.find(x => x.slug === slug); if (!v) return null;
  return {
    title: `${v.name} Wrap Estimate`,
    html: hero({ kicker: "Price Estimator", title: `${v.name} wrap estimate`, lede: v.d, big: false, crumbs: [["Home", "/"], ["Vehicle Wraps", "/vehicle-wraps"], ["Estimator", "/vehicle-wraps/estimator"], [v.name]] }) +
      sec(`<div class="cfg"><div class="opts">
        ${v.photoKey ? `<div class="vehstage" data-vs><img src="${SITE.base}/img/${VEH_PHOTOS[v.photoKey][0]}.jpg" alt="${esc(v.name)} before wrapping"><img data-vs-dec src="${SITE.base}/img/${VEH_PHOTOS[v.photoKey][1]}.jpg" alt="${esc(v.name)} with decals" style="opacity:0"><img data-vs-wrap src="${SITE.base}/img/${VEH_PHOTOS[v.photoKey][2]}.jpg" alt="${esc(v.name)} wrapped"></div><p class="tiny" style="text-align:center;margin-top:-14px" data-vs-cap>Preview updates with the wrap type you choose.</p>` : `<div class="card" style="padding:18px;background:var(--bg-2)">${vehicleSVG(v.veh, { c: ["#141414", "#e8314a"], text: v.name.toUpperCase() })}</div>`}
        <span class="eyebrow plain">01 / Your vehicle</span>
        ${v.q.map(([n, o]) => seg(n, o.map(x => x[0]), 0, { key: n })).join("")}
        <span class="eyebrow plain">02 / Your wrap</span>
        ${seg("Wrap type", COVERAGE.map(c => [c[0], c[2], c[1]]), 3, { key: "Wrap type", cards: true, showPrice: true, fmt: x => "× " + x.toFixed(2) })}
        ${seg("Add roof wrap?", ["No", "Yes"], 0, { key: "Roof" })}
        ${seg("Finish", FINISHES.map(f => [f.name === "Satin Chrome" ? "Satin Chrome / Colour-Flip" : f.name, f.m]).filter((f, i) => i < 4), 0, { key: "Finish", showPrice: true, fmt: x => "× " + x.toFixed(2) })}
        ${seg("Material", WRAP_MATERIALS, 0, { key: "Material", showPrice: true, fmt: x => "× " + x.toFixed(2) })}
        ${seg("Design services", [["Not needed", 0], ["Design services — "+money(PRICING.designDeposit)+" deposit", PRICING.designDeposit]], 0, { key: "Design" })}
      </div>${summaryBox({ label: "Your estimate", sub: "Starting price", addLabel: "Add to quote cart", second: quoteBtn("Get exact quote", "Vehicle Wraps", "btn ghost block") + A("/vehicle-wraps/estimator", "Change vehicle", "btn ghost block"), note: "Final pricing depends on the confirmed vehicle and scope." })}</div>`) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About this estimate</span><h2 class="d2">What goes into a ${v.name.toLowerCase()} wrap price.</h2><div class="prose"><p>The estimator starts from the square footage of film a typical ${v.name.toLowerCase()} needs, then scales it by coverage, material and finish. ${esc(v.d)}</p><p>It is a genuine starting price, not a lead-capture guess — the same table our estimators quote from. The final number moves only for things we can’t see online: paint condition, roof coverage, complex bumpers, or removal of an old wrap.</p></div></div>
        ${spec([["Included", "Template, proof, print, laminate, installation, post-heat and inspection"], ["Not included", "Roof (unless selected), old wrap removal, bodywork, HST"], ["Materials", "3M cast vinyl with matching laminate"], ["Valid for", "30 days from the date of your firm quote"]])}</div>`, "alt") +
      workSec("Wraps on similar vehicles", WORK.estimate) + faqSec("estimator", { cls: "alt" }) +
      ctaBand("Want the exact number?", "Send the configuration above with a few photos and we’ll firm up the quote — no visit needed for most vehicles.", "Request a firm quote", "Vehicle Wraps"),
    cfg: {
      name: `${v.name} wrap`,
      calc(s) {
        let m = 1; const lines = [[`${v.name} base`, money(v.base)]];
        v.q.forEach(([n, o]) => { const f = o.find(x => x[0] === s[n]) || o[0]; m *= f[1]; if (f[1] !== 1) lines.push([`${n}: ${f[0]}`, "× " + f[1].toFixed(2)]); });
        const cov = COVERAGE.find(c => c[0] === s["Wrap type"]) || COVERAGE[3]; m *= cov[2]; lines.push([cov[0], "× " + cov[2].toFixed(2)]);
        const fin = FINISHES.find(f => s.Finish && s.Finish.startsWith(f.name)) || FINISHES[0]; m *= fin.m; lines.push([`${fin.name === "Satin Chrome" ? "Satin Chrome / Colour-Flip" : fin.name} finish`, "× " + fin.m.toFixed(2)]);
        const mat = WRAP_MATERIALS.find(x => x[0] === s.Material) || WRAP_MATERIALS[0]; m *= mat[1]; lines.push([mat[0] + " film", "× " + mat[1].toFixed(2)]);
        if (s.Roof === "Yes") { m *= PRICING.roofMultiplier; lines.push(["Roof wrap", "× "+PRICING.roofMultiplier.toFixed(2)]); }
        let total = Math.round(v.base * m / 10) * 10;
        if (s.Design && s.Design.startsWith("Design")) { lines.push(["Design deposit (credited)", "+"+money(PRICING.designDeposit)]); total += PRICING.designDeposit; }
        return { total, lines, sub: "Starting price · CAD", note: `Reference configuration: ${v.q.map(([n]) => `${n}: ${s[n]}`).join(" · ")}. Final pricing depends on the confirmed vehicle and scope.` };
      },
      onChange(root, s) {
        const st = root.querySelector("[data-vs]"); if (!st) return;
        const cov = COVERAGE.find(c => c[0] === s["Wrap type"]) || COVERAGE[3], dec = cov[2] < .3;
        st.querySelector("[data-vs-dec]").style.opacity = dec ? 1 : 0;
        st.querySelector("[data-vs-wrap]").style.clipPath = dec ? "inset(0 100% 0 0)" : `inset(0 ${Math.round((1 - cov[2]) * 100)}% 0 0)`;
        root.querySelector("[data-vs-cap]").textContent = `${cov[0]} · ${Math.round(cov[2] * 100)}% of full-wrap price`;
      },
    },
  };
};

/* ============ Pages: print, apparel, glass, tint, wallpaper ============ */
const guideRows = (o) => [["Trim size", o.trim], ["Bleed", "0.125 in (3 mm) on all sides"], ["Safe area", "Keep text and logos 0.125 in inside the trim"], ["Resolution", "300 DPI at final size"], ["Colour", "CMYK; rich black C60 M40 Y40 K100 for large solids"], ["File types", "Print-ready PDF preferred · AI, EPS, INDD (packaged), TIFF, PSD"], ["Fonts", "Outlined or embedded"]];

/* ---------- PRINT SHOP HUB ---------- */
PAGES.printShop = () => ({
  title: "Print Shop",
  html: hero({ kicker: "Print Shop", title: "From a stack of cards to a building-sized banner.", lede: "Offset and large-format printing, priced by the piece and proofed before it ever hits a press.", crumbs: [["Home", "/"], ["Print Shop"]], ctas: A("/print-shop/offset", "Offset printing", "btn") + A("/print-shop/large-format", "Large format", "btn ghost"), art: art("print", { photo: "sg-hero", fit: "contain" }) }) +
    sec(`<div class="grid g2">
      <a class="card" href="${href("/print-shop/offset")}" style="padding:28px">${art("print", { photo: "pr-bc-1" })}<span class="eyebrow">Offset printing</span><h3 class="d3">Cards, flyers and folded stories.</h3><p>Premium paper products for everyday brand moments — five products, each with its own artwork path.</p><span class="link" style="align-self:flex-start">Explore offset printing ${arrowSm()}</span></a>
      <a class="card" href="${href("/print-shop/large-format")}" style="padding:28px">${art("banner", { photo: "pr-rollup" })}<span class="eyebrow">Large format</span><h3 class="d3">Banners, signs and displays.</h3><p>Give your message the space it deserves — six formats, configured and quoted in minutes.</p><span class="link" style="align-self:flex-start">Explore large format ${arrowSm()}</span></a></div>`) +
    serviceUI.printBanner() +
    sec(secHead("Offset printing", "Paper products", "", A("/print-shop/offset", `All offset products ${arrowSm()}`, "link")) + linkCards(OFFSET.slice(0, 4).map((p, i) => ({ name: p.name, path: "/print-shop/offset/" + p.slug, d: p.list, price: `${p.from} / ${p.fromQ}`, cta: "Design & price", art: art("print", { photo: p.photo }) })), 4)) +
    sec(secHead("Large format printing", "Banners, signs & displays", "", A("/print-shop/large-format", `All large format ${arrowSm()}`, "link")) + linkCards(LARGE.map((p, i) => ({ name: p.name, path: "/print-shop/large-format/" + p.slug, d: p.d, price: p.from, art: art("banner", { photo: p.photo }) })), 3), "alt") +
    ctaBand("Not sure which product fits?", "Tell us where it’s going and how many you need. We’ll recommend stock, size and finish.", "Ask a print specialist", "Print Shop"),
  cfg: {
    name: "Business cards",
    calc(s) {
      const qp = { "100": 24.99, "250": 34.99, "500": 44.99, "1,000": 64.99, "2,500": 119 }; const base = qp[s.qty] ?? 34.99;
      const st = { "14pt Matte": 0, "16pt Gloss UV": 8, "32pt Suede": 22, "Kraft Uncoated": 6 }[s.stock] || 0, sd = s.sides === "Double-sided" ? 6 : 0;
      return { total: base + st + sd, money2: true, lines: [[`${s.qty} cards`, money2(base)], [s.stock, st ? "+" + money2(st) : "included"], [s.sides, sd ? "+" + money2(sd) : "included"]], sub: "Total · CAD" };
    },
  },
});

/* ---------- OFFSET ---------- */
PAGES.offset = () => ({
  title: "Offset Printing",
  html: hero({ kicker: "Print Shop · Offset", title: "Make every impression count.", lede: "Thoughtful paper, rich colour and considered finishes. Find the right print for your next introduction.", crumbs: [["Home", "/"], ["Print Shop", "/print-shop"], ["Offset Printing"]], art: art("print", { photo: "pr-brochure" }) }) +
    sec(secHead("Explore offset printing", "Choose a category to see products, options and artwork guidance.") + linkCards(OFFSET.map((p, i) => ({ name: p.name, path: "/print-shop/offset/" + p.slug, d: p.d, price: `${p.from} / ${p.fromQ}`, art: art("print", { photo: p.photo, tag: false }) })), 3)) +
    faqSec("offset", { cls: "alt" }) + ctaBand("Need a hand choosing paper?", "Drop by to feel the stocks, or ask for a sample pack in the mail.", "Ask a print specialist", "Print Shop"),
});

PAGES.offsetItem = ({ slug }) => {
  const p = OFFSET.find(x => x.slug === slug); if (!p) return null;
  return {
    title: p.name,
    html: hero({ kicker: "Print Shop · " + p.name, title: p.h, lede: p.d, crumbs: [["Home", "/"], ["Print Shop", "/print-shop"], ["Offset", "/print-shop/offset"], [p.name]], big: false, art: art("print", { photo: p.photo, alt: p.name }) }) +
      sec(`<div class="grid g3 design-preview-gallery">${["van","pickup","box"].map(v=>`<article class="card">${vehicleSVG(v,{c:d.c,text:d.name.toUpperCase()})}<p>${v==='box'?'Box truck':v} · design illustration</p></article>`).join('')}</div>`) + sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">Make it yours</span>
        ${p.opts.map(([n, o]) => seg(n, o, 0, { key: n, cards: o.some(x => x[2]), showPrice: true })).join("")}
        ${seg("Quantity", p.q.map(q => q.toLocaleString("en-CA")), 0, { key: "qty" })}
        ${seg("Artwork", [["I have my design", 0, "Upload print-ready artwork."], ["I need design services", 100, "We design it for you."]], 0, { key: "art", cards: true, showPrice: true })}
        ${dropzone("Drop your print-ready artwork", "PDF, AI or EPS · front and back files for double-sided printing.", "of-up")}
      </div>${summaryBox({ label: "Your order", sub: "Total · CAD", note: "CAD · tax and delivery calculated at checkout." })}</div>`) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About our ${esc(p.name.toLowerCase())}</span><h2 class="d2">${esc(p.about[0])}</h2><div class="prose">${p.about.slice(1).map(t => `<p>${esc(t)}</p>`).join("")}</div></div>
        ${feats([["Press-quality colour", "Calibrated CMYK output; Pantone matching on request.", "drop"], ["Premium stocks", "14–32 pt cards, 100 lb silk and gloss text, kraft and recycled options.", "layers"], ["Proofed before print", "A PDF proof to approve — hard-copy proofs available.", "eye"], ["Fast turnaround", "Most runs are ready in 2–4 business days; rush available.", "clock"]], 2)}</div>`, "alt") +
      sec(secHead("Guidelines & file prep", "Set your file up right the first time.", "Follow the specs below and your proof will match your screen. Templates and a full guide are on the artwork page.") + `<div class="split">${spec(guideRows(p))}<div style="display:flex;flex-direction:column;gap:16px">${steps(PROCESS.print)}<div class="note">${icon("brush")}<span>No file? Choose “I need design services” in the configurator and our team will build it from your logo and copy. ${A("/artwork-guidelines", "Full artwork guidelines", "link")}</span></div></div></div>`) +
      workSec("Recently off the press", WORK.offset, { cls: "alt" }) + faqSec("offset") +
      ctaBand(`Need a hand with your ${p.name.toLowerCase()}?`, "Not sure about stock, quantity or finish? Tell us how they’ll be used and we’ll recommend the right combination.", "Ask a print specialist", "Print Shop"),
    cfg: {
      name: p.name,
      calc(s) {
        const qi = p.q.findIndex(q => q.toLocaleString("en-CA") === s.qty), base = p.p[qi < 0 ? 0 : qi];
        const lines = [[`${p.name} · ${s.qty}`, money2(base)]]; let total = base;
        p.opts.forEach(([n, o]) => { const f = o.find(x => x[0] === s[n]) || o[0]; total += f[1]; lines.push([f[0], f[1] ? "+" + money2(f[1]) : "included"]); });
        if (s.art === "I need design services") { total += 100; lines.push(["Design services", "+$100.00"]); }
        return { total, money2: true, lines, sub: "Total · CAD" };
      },
    },
  };
};

/* ---------- LARGE FORMAT ---------- */
PAGES.large = () => ({
  title: "Large Format Printing",
  html: hero({ kicker: "Print Shop · Large Format", title: "Your brand. Impossible to miss.", lede: "High-impact banners, signs and displays for storefronts, events and everything in between.", crumbs: [["Home", "/"], ["Print Shop", "/print-shop"], ["Large Format Printing"]], art: art("banner", { photo: "pr-backdrop" }) }) +
    sec(secHead("Explore large format printing", "Choose a category to see products, options and artwork guidance.") + linkCards(LARGE.map((p, i) => ({ name: p.name, path: "/print-shop/large-format/" + p.slug, d: p.d, price: p.from, art: art("banner", { photo: p.photo }) })), 3)) +
    faqSec("large", { cls: "alt" }) + ctaBand("Need signage by a date?", "Tell us the size, quantity and the day you need it. We’ll confirm production and installation slots straight away.", "Request a quote", "Print Shop"),
});

PAGES.largeItem = ({ slug }) => {
  const p = LARGE.find(x => x.slug === slug); if (!p) return null;
  return {
    title: p.name,
    html: hero({ kicker: "Print Shop · Large Format", title: p.name, lede: p.d, crumbs: [["Home", "/"], ["Print Shop", "/print-shop"], ["Large Format", "/print-shop/large-format"], [p.name]], big: false, art: art("banner", { photo: p.photo, alt: p.name }) }) +
      sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">Large format · product</span>
        ${p.custom ? `<div class="og"><span class="lab">Size (ft)</span><div class="fields">${field("Width (ft)", `<input class="inp" type="number" min="1" max="50" step="0.5" value="6" data-k="w" id="lf-w">`)}${field("Height (ft)", `<input class="inp" type="number" min="1" max="10" step="0.5" value="3" data-k="h" id="lf-h">`)}</div></div>` : ""}
        <div class="og"><span class="lab">Quantity</span><div class="stepper"><button type="button" data-step="-1" aria-label="Fewer">−</button><input type="number" min="1" value="1" data-k="qty" id="lf-q" aria-label="Quantity"><button type="button" data-step="1" aria-label="More">+</button></div></div>
        ${p.opts.map(([n, o]) => seg(n, o, 0, { key: n, showPrice: true, fmt: x => x === 0 ? "" : (x > 0 ? "+" : "−") + money2(Math.abs(x)) + (p.custom && n !== "Installation" ? "/sq ft" : "") })).join("")}
        ${dropzone("Drop your artwork", "PDF, AI, EPS, JPG or PNG", "lf-up")}
      </div>${summaryBox({ label: "Estimate", sub: "Before tax", note: `${esc(p.from)} · final price confirmed on quote.`, second: quoteBtn("Request a quote", "Print Shop", "btn ghost block", "Product: " + p.name) })}</div>`) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About ${esc(p.name.toLowerCase())}</span><h2 class="d2">${esc(p.name)} that hold up outdoors.</h2><div class="prose"><p>${esc(p.d)} Printed in-house on a latex large-format press with UV-stable inks, so colour stays true through a season of sun and rain.</p><p>Every large-format order includes finishing — hemming, grommets, stakes, frames or poles as the product needs — and a digital proof at scale so you can see how the layout reads from across a room or a parking lot.</p></div></div>
        ${feats([["UV-stable inks", "Latex inks rated for 2–3 years outdoors unlaminated.", "sun"], ["Finished, not just printed", "Hems, grommets and hardware included where listed.", "check"], ["Custom sizes", "Standard formats or any size up to 10 ft wide seamless.", "ruler"], ["Ready in days", "Most pieces ship in 2–3 business days after proof.", "clock"]], 2)}</div>`, "alt") +
      sec(secHead("Guidelines & file prep", "Big prints, simple file rules.", "Large format is forgiving on resolution but strict on file type and colour. Here’s what works.") + `<div class="split">${spec([["Final size", p.size], ["Scale", "Build at 100% or at 25% with 4× resolution"], ["Resolution", "100–150 DPI at final size (300 DPI is unnecessary and huge)"], ["Bleed", "1 in on all sides for banners; 0.25 in for rigid signs"], ["Colour", "CMYK; Pantone references welcome for brand colours"], ["File types", "PDF, AI, EPS · TIFF or JPG at 150 DPI for photos"], ["Fonts", "Outlined — banners are often edited last-minute, so send editable too"]])}<div style="display:flex;flex-direction:column;gap:16px">${steps(PROCESS.print)}<div class="note">${icon("ruler")}<span>Keep important text at least 3 in from banner edges where grommets and hems land.</span></div></div></div>`) +
      workSec("Signs and banners we’ve made", WORK.large, { cls: "alt" }) + faqSec("large") +
      ctaBand(`Need ${p.name.toLowerCase()} by a date?`, "Tell us the size, quantity and the day you need them. We’ll confirm production and installation slots straight away.", "Request a quote", "Print Shop"),
    cfg: {
      name: p.name,
      calc(s) {
        const q = Math.max(1, +s.qty || 1); const lines = []; let unit;
        if (p.custom) {
          const w = +s.w || 0, h = +s.h || 0, area = Math.max(1, w * h); let rate = p.sqft;
          p.opts.forEach(([n, o]) => { if (n === "Installation") return; const f = o.find(x => x[0] === s[n]) || o[0]; rate += f[1]; });
          unit = area * rate; lines.push([`${w} × ${h} ft · ${area.toFixed(1)} sq ft`, money2(rate) + "/sq ft"]);
        } else {
          unit = p.base; lines.push([p.name, money2(p.base) + " ea"]);
          p.opts.forEach(([n, o]) => { if (n === "Installation") return; const f = o.find(x => x[0] === s[n]) || o[0]; unit += f[1]; if (f[1]) lines.push([f[0], (f[1] > 0 ? "+" : "−") + money2(Math.abs(f[1]))]); });
        }
        let total = unit * q; lines.push(["Quantity", "× " + q]);
        if (s.Installation === "Requested") { total += 60; lines.push(["Installation (from)", "+$60.00"]); }
        return { total, money2: true, lines, sub: "Before tax · CAD" };
      },
    },
  };
};

/* ---------- APPAREL ---------- */
PAGES.apparel = () => ({
  title: "Apparel",
  html: hero({ kicker: "Apparel & Custom Printing", title: "Wear the brand.", lede: "DTF and Vinyl Heat Press; embroidery on caps and polos transfer on shirts, hoodies, caps and workwear — upload your logo and preview it before you order.", crumbs: [["Home", "/"], ["Apparel"]], ctas: quoteBtn("Request an apparel quote", "Apparel"), art: art("apparel", { g: "hoodie", gc: "#1b1b1d", seed: 0, tag: "Crew hoodie" }) }) +
    sec(secHead("Start with your favourite fit", "Choose a garment to customize.") + linkCards(APPAREL.map((a, i) => ({ name: a.name, path: "/apparel/" + a.slug, d: "Choose your style, explore colours and see your artwork on the model.", price: `From ${money2(a.ppc)}/pc`, cta: "Customize", art: art("apparel", { g: a.g, gc: APP_COLORS[i % 5][1], seed: i, tag: false }) })), 3)) +
    sec(feats([["Quality blanks", "Brand-name garments in a full size run, XS–3XL and up.", "shirt"], ["Decoration that fits your garment", "DTF and Vinyl Heat Press. Embroidery for hats and polos.", "layers"], ["Real mockup to approve", "Your logo, at size, on the actual garment colour.", "eye"], ["Team & fleet orders", "Names, numbers and mixed sizes on one order.", "user"]]), "alt") +
    faqSec("apparel") + ctaBand("Need a team outfitted?", "Send your logo and a rough size breakdown; we’ll return a mockup and a per-piece price within one business day.", "Request an apparel quote", "Apparel"),
});

PAGES.apparelItem = ({ slug }) => {
  const g = APPAREL.find(x => x.slug === slug); if (!g) return null;
  const positions = g.g === "cap" ? ["Front"] : ["Left Chest", "Full Front", "Sleeve", "Full Back"];
  return {
    title: g.name,
    html: hero({ kicker: "Apparel · " + g.name, title: g.h, lede: "Choose your style, explore colours and see your artwork on the model.", crumbs: [["Home", "/"], ["Apparel", "/apparel"], [g.name]], big: false }) +
      sec(`<div class="cfg"><div class="opts">
        <div class="card" style="padding:12px;background:var(--bg-2)"><svg viewBox="0 0 400 260" data-garment style="width:100%;height:auto">${garment(g.g, APP_COLORS[0][1], "#e8314a", positions[0])}</svg><p class="tiny" style="text-align:center" data-gcap>${APP_COLORS[0][0]} · ${positions[0]}</p></div>
        <div class="og"><span class="lab">Colour</span><div class="swatches" data-group="color">${APP_COLORS.map(([n, c], i) => `<button type="button" data-val="${n}" data-hex="${c}" aria-label="${n}" aria-pressed="${i === 0}" style="background:${c}"></button>`).join("")}</div></div>
        ${g.sizes.length > 1 ? seg("Size", g.sizes, 3, { key: "size" }) : seg("Size", g.sizes, 0, { key: "size" })}
        ${seg("Decoration method", APP_METHODS.map(([n, m, d]) => [n, m, d]), 0, { key: "method", cards: true })}
        ${seg("Print position & size", positions, 0, { key: "pos" })}
        ${dropzone("Drop your logo", "PNG with transparent background works best — it appears on the garment above", "ap-up")}
        ${seg("Design assistance", [["I have my artwork", 0, "Ready to print as uploaded."], ["I need design assistance", 100, "We’ll clean up or build your artwork."]], 0, { key: "assist", cards: true, showPrice: true })}
        <div class="og"><span class="lab">Quantity</span><div class="stepper"><button type="button" data-step="-1" aria-label="Fewer">−</button><input type="number" min="1" value="12" data-k="qty" id="ap-q" aria-label="Quantity"><button type="button" data-step="1" aria-label="More">+</button></div><span class="tiny">No minimum order. Orders above 20 pieces receive 5% off.</span></div>
      </div>${summaryBox({ label: "Your mockup", addLabel: "Confirm mockup", second: quoteBtn("Request quote instead", "Apparel", "btn ghost block", "Garment: " + g.name) })}</div>`) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About our ${esc(g.name.toLowerCase())}</span><h2 class="d2">${esc(g.name)} your team will actually wear.</h2><div class="prose"><p>We stock trusted blanks — Gildan, Bella+Canvas, Champion and Carhartt — and decorate them in-house.</p><p>The customizer above shows the print on the garment, but the real mockup we send for approval uses your actual logo, sized in inches, on the exact garment colour you chose. Nothing prints until you approve it.</p></div></div>
        ${feats([["Quality blanks", "Brand-name garments in a full size run, XS–3XL and up.", "shirt"], ["Decoration that fits your garment", "DTF and Vinyl Heat Press. Embroidery for hats and polos.", "layers"], ["Real mockup to approve", "Your logo, at size, on the actual garment colour.", "eye"], ["Team & fleet orders", "Names, numbers and mixed sizes on one order.", "user"]], 2)}</div>`, "alt") +
      sec(secHead("Guidelines & file prep", "Artwork that prints clean on fabric.", "Which method suits your artwork, and what file to send for it.") + `<div class="split">${spec([["Screen print", "Vector artwork, 1–4 spot colours · best value at 24+ pieces"], ["DTF transfer", "Any artwork, full colour · PNG with transparent background, 300 DPI at print size"], ["Embroidery", "Vector logo; we digitize it (one-time $45 fee) · keep text above 0.25 in tall"], ["Heat-press vinyl", "Vector; solid colours only · ideal for names and numbers"], ["Print sizes", "Left chest 3.5–4 in · full front up to 12 × 14 in · full back up to 13 × 16 in · sleeve 3 in"], ["Sizing", "Mixed sizes welcome on one order; size chart on request"]])}<div style="display:flex;flex-direction:column;gap:16px">${steps(PROCESS.apparel)}<div class="note">${icon("drop")}<span>Screen print and embroidery colours are matched to Pantone; DTF is full-colour CMYK.</span></div></div></div>`) +
      workSec("Teams we’ve dressed", WORK.apparel, { cls: "alt" }) + faqSec("apparel") +
      ctaBand("Need a team outfitted?", "Send your logo and a rough size breakdown; we’ll return a mockup and a per-piece price within one business day.", "Request an apparel quote", "Apparel"),
    cfg: {
      name: g.name,
      calc(s) {
        const q = Math.max(1, +s.qty || 1), m = (APP_METHODS.find(x => x[0] === s.method) || APP_METHODS[0]);
        const brk = q >= 100 ? .82 : q >= 50 ? .9 : q >= 24 ? .95 : 1;
        const ppc = g.ppc * m[1] * brk; let total = ppc * q; const lines = [[`${g.name} · ${s.color || "Black"}`, money2(g.ppc) + "/pc"], [m[0], "× " + m[1].toFixed(2)]];
        if (brk < 1) lines.push(["Volume break", "× " + brk.toFixed(2)]);
        lines.push(["Quantity", "× " + q]);
        if (s.assist === "I need design assistance") { total += 100; lines.push(["Design assistance", "+$100.00"]); }
        return { total, money2: true, lines, sub: `${money2(ppc)}/pc · ${q} pcs, ${m[0].toLowerCase()}` };
      },
      onChange(root, s) {
        const svg = root.querySelector("[data-garment]"), c = APP_COLORS.find(x => x[0] === s.color) || APP_COLORS[0];
        svg.innerHTML = garment(g.g, c[1], "#e8314a", s.pos || positions[0], root._logo);
        root.querySelector("[data-gcap]").textContent = `${c[0]} · ${s.pos || positions[0]}`;
      },
    },
  };
};

/* ---------- WINDOW GRAPHICS ---------- */
function glassCalc(s, mats) {
  const w = +s.w || 0, h = +s.h || 0, n = Math.max(1, +s.n || 1), area = w * h * n;
  const mat = mats.includes(s.mat) ? s.mat : mats[0], rate = GLASS_MAT[mat];
  const matCost = area * rate, inst = s.inst && s.inst.startsWith("Professional") ? area * 1.75 : 0;
  let total = matCost + inst; const lines = [[`${area.toFixed(1)} sq ft × ${mat}`, money(Math.round(matCost))], ["Installation", inst ? money(Math.round(inst)) : "Self-install"]];
  if (s.use) lines.push([s.use, n + (n > 1 ? " panes" : " pane")]);
  if (s.art === "I need design services") { total += 100; lines.push(["Design services", "+$100"]); }
  return { total: Math.max(75, Math.round(total)), lines, sub: "Estimated total", note: "$75 minimum per order. Measurements confirmed on-site for the final quote." };
}
const glassInputs = (pre, n = true) => `<div class="og"><span class="lab">Measure the glass</span><div class="fields" style="grid-template-columns:repeat(${n ? 3 : 2},minmax(0,1fr))">${field(n ? "Width per pane (ft)" : "Width (ft)", `<input class="inp" type="number" min="0.5" step="0.5" value="6" data-k="w" id="${pre}-w">`)}${field(n ? "Height per pane (ft)" : "Height (ft)", `<input class="inp" type="number" min="0.5" step="0.5" value="4" data-k="h" id="${pre}-h">`)}${n ? field("Number of panes", `<input class="inp" type="number" min="1" step="1" value="1" data-k="n" id="${pre}-n">`) : ""}</div></div>`;

PAGES.glass = () => ({
  title: "Window Graphics",
  html: hero({ kicker: "Window Graphics", title: "Glass, branded.", lede: "Decals, frosted privacy film and full storefront takeovers — measured, quoted and cut to your exact panes.", crumbs: [["Home", "/"], ["Window Graphics"]], ctas: quoteBtn("Request a window graphics quote", "Window Graphics"), art: art("glass", { photo: "office-glass" }) }) +
    sec(secHead("Choose what you need", "Four ways to put your brand on glass.") + linkCards(GLASS.map((g, i) => ({ name: g.name, path: "/window-graphics/" + g.slug, d: g.d, art: art("glass", { seed: i, text: ["SALE", "OPEN", "PRIVATE", "HOURS"][i], tag: false, photo: g.photo }) })), 4)) +
    sec(secHead("Price estimator", "Measure the glass") + `<div class="cfg"><div class="opts">${glassInputs("gh", false)}
      ${seg("Material", Object.entries(GLASS_MAT).map(([k, v]) => [k, v]), 0, { key: "mat", showPrice: true, fmt: v => "$" + v + " / sq ft" })}
      ${seg("Installation", ["Self-Install (material only)", "Professional Install"], 0, { key: "inst" })}</div>
      ${summaryBox({ label: "Estimated total", add: false, second: quoteBtn("Request exact quote", "Window Graphics", "btn block") })}</div>`, "alt") +
    faqSec("glass") + ctaBand("Send us a photo of the glass.", "A straight-on photo and rough measurements are enough for a firm estimate. We confirm on site before anything is cut.", "Request a window graphics quote", "Window Graphics"),
  cfg: { name: "Window graphics", calc: s => glassCalc(s, Object.keys(GLASS_MAT)) },
});

PAGES.glassItem = ({ slug }) => {
  const g = GLASS.find(x => x.slug === slug); if (!g) return null;
  return {
    title: g.name,
    html: hero({ kicker: g.kicker, title: g.h, lede: g.d, crumbs: [["Home", "/"], ["Window Graphics", "/window-graphics"], [g.name]], big: false }) +
      sec(`<div class="cfg"><div class="opts">${glassInputs("gi")}
        ${seg("Coverage", g.uses, 0, { key: "use" })}
        ${seg("Material", g.mats.map(m => [m, GLASS_MAT[m]]), 0, { key: "mat", showPrice: true, fmt: v => "$" + v + " / sq ft" })}
        ${seg("Installation", ["Professional install", "Self-install (material only)"], 0, { key: "inst" })}
        ${seg("Artwork", [["I have my artwork", 0, "Vector logo or print-ready file."], ["I need design services", 100, "We design it to your measurements."]], 0, { key: "art", cards: true, showPrice: true })}
        ${dropzone("Drop your artwork or a photo of the glass", "PDF, AI, EPS, JPG or PNG · a photo of the window helps us template it", "gi-up")}
      </div>${summaryBox({ label: "Estimated total", second: quoteBtn("Request exact quote", "Window Graphics", "btn ghost block", "Product: " + g.name) })}</div>`) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About ${esc(g.name.toLowerCase())}</span><h2 class="d2">Details that make the difference.</h2><div class="prose"><p><b>${esc(g.about[0])}</b> ${esc(g.about[1])}</p></div></div>
        ${feats([["Measured on site", "Every pane templated so panels line up across the run.", "ruler"], ["UV-stable films", "Cast vinyl and laminated prints rated for outdoor use.", "sun"], ["Proofed on your window", "The layout is shown on a photo of your glass before we cut.", "eye"], ["Installed before opening", "Storefront installs scheduled around your hours.", "clock"]], 2)}</div>`, "alt") +
      sec(secHead("Guidelines & file prep", "Measuring the glass and preparing artwork.") + `<div class="split">${spec([["Measurements", "Width × height of each pane in inches or feet, plus a straight-on photo from outside"], ["Cut vinyl artwork", "Vector only (AI, EPS, SVG, PDF), fonts outlined, no strokes thinner than 0.1 in"], ["Printed artwork", "PDF or TIFF at 100–150 DPI at final size, CMYK, 1 in bleed"], ["Application", "Second-surface (inside) or first-surface (outside) — we recommend per product"], ["Removal", "Clean removal from glass; residue-free within the film’s rated life"]])}<div style="display:flex;flex-direction:column;gap:16px">${steps(PROCESS.glass)}<div class="note">${icon("ruler")}<span>Not sure how to measure? Send the photo — we can scale from a known object (a door is usually 36 in wide) for the estimate and confirm on site.</span></div></div></div>`) +
      workSec("Glass we’ve branded", WORK.glass, { cls: "alt" }) + faqSec("glass") +
      ctaBand("Send us a photo of the glass.", "A straight-on photo and rough measurements are enough for a firm estimate. We confirm on site before anything is cut.", "Request a window graphics quote", "Window Graphics"),
    cfg: { name: g.name, calc: s => glassCalc(s, g.mats) },
  };
};

/* ---------- WINDOW TINT ---------- */
const vltNote = v => v >= 70 ? "Near-clear film — heat and UV protection without a visible tint." : v >= 50 ? "At 50% VLT, interiors stay bright and visible from outside — a common choice for street-level retail glass." : v >= 35 ? "Below 70% VLT, front windows may not meet minimums in some provinces. We’ll confirm compliant options for your vehicle and region before install." : v >= 20 ? "Popular for rear glass — strong privacy while staying easy to see out of at night." : "Limo-dark. Rear glass only on road vehicles in Ontario.";
const vltName = v => v >= 70 ? "Clear" : v >= 50 ? "Light" : v >= 35 ? "Medium" : v >= 20 ? "Dark" : "Limo";
const vltBlock = (val = 35) => `<div class="og"><span class="lab">Visible light transmission (VLT)</span>
  <div class="vlt-glass"><div class="scene" style="background:linear-gradient(180deg,#9cc3e6 0 55%,#6d8f5a 55% 100%)"><svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%"><circle cx="320" cy="50" r="22" fill="#fff4c2"/><rect x="40" y="70" width="70" height="60" fill="#d9d4cb"/><rect x="130" y="50" width="50" height="80" fill="#c6c0b6"/><rect x="0" y="130" width="400" height="70" fill="#5f7d4f"/></svg></div><div class="film" data-film style="opacity:${(1 - val / 100) * .92}"></div>
  <span class="tag" style="position:absolute;left:12px;top:10px;bottom:auto" data-vlt-tag>${val}% · ${vltName(val)}</span></div>
  <input type="range" class="range" min="5" max="70" step="1" value="${val}" data-k="vlt" id="vlt-${uid()}" aria-label="VLT percent">
  <p class="small" data-vlt-note>${vltNote(val)}</p></div>`;
const filmTable = () => `<div class="compare">${FILMS.map(f => `<div class="card"><div style="display:flex;justify-content:space-between"><h3>${f.name}</h3><span class="mono">${f.tier}</span></div><p>${f.d}</p>${[["Heat Rejection", f.heat], ["UV Block", f.uv], ["Glare Reduction", f.glare]].map(([l, v]) => `<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between" class="tiny"><span>${l}</span><span class="mono">${v}%</span></div><div class="bar-m"><i style="width:${v}%"></i></div></div>`).join("")}</div>`).join("")}</div>`;
function bindVlt(root) {
  root.querySelectorAll("input[data-k=vlt]").forEach(r => r.addEventListener("input", () => {
    const v = +r.value, box = r.closest(".og"); box.querySelector("[data-film]").style.opacity = (1 - v / 100) * .92;
    box.querySelector("[data-vlt-tag]").textContent = `${v}% · ${vltName(v)}`; box.querySelector("[data-vlt-note]").textContent = vltNote(v);
  }));
}

PAGES.tint = () => ({
  title: "Window Tint",
  html: hero({ kicker: "Window Tint", title: "Dial in the dark.", lede: "Ceramic, carbon and dyed film for vehicles and buildings. Drag the slider to see how each VLT% reads on glass.", crumbs: [["Home", "/"], ["Window Tint"]], art: art("tint", { photo: "install-tint" }) }) +
    sec(secHead("Choose what you need", "Each option opens its own estimator.") + linkCards([{ name: "Vehicle Tint", path: "/window-tint/vehicle", d: "Sedan · SUV · Pickup · Van — priced by body style, coverage and film tier.", cta: "Build estimate", art: art("color", { photo: "tint-1" }) }, { name: "Commercial Tint", path: "/window-tint/commercial", d: "Storefronts · Offices · Skylights — priced by square foot of glass and film tier.", cta: "Build estimate", art: art("tint", { photo: "office-glass" }) }], 2)) +
    sec(`<div class="split" style="align-items:center"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Preview</span><h2 class="d2">See how each VLT% reads on glass.</h2><p class="lede">VLT is the share of visible light that passes through the film. Lower numbers are darker. Heat rejection comes from the film tier, not the darkness.</p></div>${vltBlock(35)}</div>`, "alt") +
    sec(secHead("Film comparison", "Pick a film tier") + filmTable()) +
    ctaBand("Ready to book it in?", "We’ll confirm the exact film and pricing for your vehicle or building before anything goes on the glass.", "Request exact quote", "Window Tint"),
  init: bindVlt,
});

PAGES.tintVehicle = () => ({
  title: "Vehicle Tint",
  html: hero({ kicker: "Window Tint · Vehicle", title: "Cooler cabin. Cleaner look.", lede: "Carbon and ceramic film cut to your exact glass — heat rejection, UV block and privacy, without the purple fade.", crumbs: [["Home", "/"], ["Window Tint", "/window-tint"], ["Vehicle"]], big: false, art: art("tint", { photo: "tint-levels" }) }) +
    sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">01 / Your vehicle</span>
      ${seg("Body style", TINT_BODY.map(b => b[0]), 0, { key: "body" })}${seg("Coverage", TINT_COVER.map(c => c[0]), 2, { key: "cover" })}
      <span class="eyebrow plain">02 / Your film</span>
      ${seg("Film", FILMS.map(f => [f.name, f.m, `${f.heat}% heat rejection · ${f.tier}`]), 1, { key: "film", cards: true })}${vltBlock(35)}
    </div>${summaryBox({ label: "Your estimate", sub: "Installed", second: quoteBtn("Book it in", "Window Tint", "btn ghost block", "Tint for: Vehicle"), note: "Lifetime warranty against bubbling, peeling and fading on carbon and ceramic film. Final price confirmed at drop-off." })}</div>`) +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About vehicle tint</span><h2 class="d2">Cooler, quieter, and no purple fade.</h2><div class="prose"><p>Window film blocks heat and UV without needing to be dark: a ceramic film at 50% VLT can reject more heat than a cheap dyed film at 5%. We carry dyed, carbon and ceramic tiers, computer-cut to your exact glass so there are no gaps or hand-trimmed edges.</p><p>Film is applied to the inside of the glass in a dust-controlled bay. Rear glass with defroster lines is shrunk and fitted in one piece.</p></div></div>
      ${feats([["Heat rejection", "Ceramic film blocks infrared heat without extra darkness.", "heat"], ["99% UV block", "Protects interiors, skin and fabrics from fading.", "sun"], ["Computer-cut", "Patterns cut to your exact glass — no blades on the vehicle or frame.", "ruler"], ["Lifetime film warranty", "Manufacturer-backed against bubbling, fading and peeling.", "shield"]], 2)}</div>`, "alt") +
    sec(secHead("Choosing a film", "Darkness and heat rejection are different things.") + `<div class="split">${spec([["Ontario law", "No tint on the windshield below the AS-1 line; front side windows must not “substantially obscure” the interior — we recommend 35% or lighter on fronts"], ["Dyed", "Budget tier · 35% heat rejection · may fade over years"], ["Carbon", "No signal interference · 60% heat rejection · colour-stable"], ["Ceramic", "Top tier · 80% heat rejection · clearest view at night"], ["Cure time", "Leave windows up for 3–5 days; light haze clears as moisture dries"]])}${steps(PROCESS.tintV)}</div>`) +
    workSec("Recent tint installs", WORK.tint, { cls: "alt" }) + faqSec("tint") + ctaBand("Book a tint install.", "Tell us the vehicle and the tier you’re leaning toward. Most installs are same-week.", "Request a tint quote", "Window Tint"),
  init: bindVlt,
  cfg: {
    name: "Vehicle tint",
    calc(s) {
      const b = TINT_BODY.find(x => x[0] === s.body) || TINT_BODY[0], c = TINT_COVER.find(x => x[0] === s.cover) || TINT_COVER[2], f = FILMS.find(x => x.name === s.film) || FILMS[1];
      return { total: Math.round(b[1] * c[1] * f.m), lines: [[`${b[0]} base`, money(b[1])], [c[0], "× " + c[1].toFixed(2)], [`${f.name} film`, "× " + f.m.toFixed(2)], ["VLT", (s.vlt || 35) + "%"]], sub: "Installed · CAD" };
    },
  },
});

PAGES.tintCommercial = () => ({
  title: "Commercial Tint",
  html: hero({ kicker: "Window Tint · Commercial", title: "Glare down. Bills down. View intact.", lede: "Solar and privacy film for storefronts, offices and skylights, measured on site and installed after hours.", crumbs: [["Home", "/"], ["Window Tint", "/window-tint"], ["Commercial"]], big: false, art: art("tint", { photo: "office-glass" }) }) +
    sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">01 / Your glass</span>
      ${seg("Glass type", ["Storefront / street-level", "Office partitions", "Skylights / atrium", "Residential"], 0, { key: "glass" })}${glassInputs("tc")}
      <span class="eyebrow plain">02 / Your film</span>
      ${seg("Film", FILMS.map(f => [f.name, f.sqft, `${f.heat}% heat rejection · ${f.tier}`]), 0, { key: "film", cards: true })}${vltBlock(50)}
    </div>${summaryBox({ label: "Your estimate", sub: "Installed", second: quoteBtn("Request site measure", "Window Tint", "btn ghost block", "Tint for: Commercial building"), note: "$150 minimum per visit. We measure every pane on site before confirming the final price." })}</div>`) +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About commercial tint</span><h2 class="d2">Cut glare and cooling bills without darkening the view.</h2><div class="prose"><p>Commercial solar film can reject up to 80% of solar heat and 99% of UV, cutting glare on screens and easing the load on your HVAC. Privacy, frosted and security films are available for partitions, ground-floor glass and after-hours protection.</p><p>We measure on site, install after hours where needed, and supply spec sheets for LEED or landlord approval.</p></div></div>
      ${feats([["Heat rejection", "Ceramic film blocks infrared heat without extra darkness.", "heat"], ["99% UV block", "Protects interiors, skin and fabrics from fading.", "sun"], ["Computer-cut", "Patterns cut to your exact glass — no blades on the frame.", "ruler"], ["Lifetime film warranty", "Manufacturer-backed against bubbling, fading and peeling.", "shield"]], 2)}</div>`, "alt") +
    sec(secHead("Choosing a film", "Darkness and heat rejection are different things.") + `<div class="split">${spec([["Solar control", "Neutral or reflective films from 15–70% VLT, up to 80% heat rejection"], ["Privacy & frosted", "One-way mirror, dusted crystal, and gradient bands"], ["Safety & security", "4–8 mil films that hold shattered glass in place"], ["Glass types", "We check for tempered, laminated and low-E glass before recommending a film"], ["Install", "After-hours available; typical office done in one evening"]])}${steps(PROCESS.tintC)}</div>`) +
    workSec("Recent tint installs", WORK.tint, { cls: "alt" }) + faqSec("tint") + ctaBand("Book a tint install.", "Send pane sizes or ask for a free site measure. We’ll quote film options side by side.", "Request a site measure", "Window Tint"),
  init: bindVlt,
  cfg: {
    name: "Commercial tint",
    calc(s) {
      const area = (+s.w || 0) * (+s.h || 0) * Math.max(1, +s.n || 1), f = FILMS.find(x => x.name === s.film) || FILMS[0];
      const mat = area * f.sqft, inst = area * 2.25;
      return { total: Math.max(150, Math.round(mat + inst)), lines: [[`${area.toFixed(0)} sq ft × ${f.name}`, money(Math.round(mat))], ["Installation", money(Math.round(inst))], [s.glass || "Storefront / street-level", (s.n || 1) + " panes"], ["VLT", (s.vlt || 50) + "%"]], sub: "Installed · CAD" };
    },
  },
});

/* ---------- WALLPAPER ---------- */
PAGES.wallpaper = (p, q) => {
  const space = ({ home: "Home", office: "Office", custom: "Custom", other: "Other" })[(q.get("space") || "").toLowerCase()] || "Home";
  return {
    title: "Wallpaper",
    html: hero({ kicker: "Wallpaper", title: "Walls, worth a second look.", lede: "Pattern murals for homes and offices, plus fully custom prints from your own artwork.", crumbs: [["Home", "/"], ["Wallpaper"]], ctas: A("/wallpaper#patterns", "Browse patterns", "btn") + quoteBtn("Request a wallpaper quote", "Wallpaper", "btn ghost"), art: art("wall", { photo: "mu-tropical-living" }) }) +
      sec(secHead("Browse patterns", "Find your pattern") + `<div class="tabs" data-space>${["Home", "Office", "Other", "Custom"].map(s => `<button type="button" data-val="${s}" aria-pressed="${s === space}">${s}</button>`).join("")}</div><div data-patterns></div>`, "", "patterns") +
      sec(secHead("Calculate", "Enter wall dimensions and project options.") + `<div class="cfg"><div class="opts">
        <div class="fields" style="grid-template-columns:repeat(3,minmax(0,1fr))">${field("Wall width (ft)", `<input class="inp" type="number" min="1" step="0.5" value="12" data-k="w" id="wp-w">`)}${field("Wall height (ft)", `<input class="inp" type="number" min="1" step="0.5" value="9" data-k="h" id="wp-h">`)}${field("Quantity (walls)", `<input class="inp" type="number" min="1" step="1" value="1" data-k="n" id="wp-n">`)}</div>
        ${seg("Material", WALL_MAT.map(([n, r]) => [n, r]), 0, { key: "mat", showPrice: true, fmt: v => "$" + v + " / sq ft" })}
        ${seg("Installation", ["Include installation", "Not included"], 0, { key: "inst" })}
        ${seg("Design type", ["Choose a pattern", "Upload custom artwork", "I need design services"], 0, { key: "dtype" })}
        ${dropzone("Drop your artwork or wall photo", "PDF, AI, EPS, JPG or PNG", "wp-up")}
        <div class="og"><span class="lab">Live wall preview</span><div class="wall"><div class="w" data-wall></div></div><span class="tiny" data-wall-cap>Artwork scales to the entered wall dimensions.</span></div>
      </div>${summaryBox({ label: "Estimated total", sub: "", second: quoteBtn("Request a wallpaper quote", "Wallpaper", "btn ghost block"), note: "Price updates from width × height × quantity + selected material + installation. Final rolls confirmed after a site measure." })}</div>`, "alt") +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About custom wallpaper</span><h2 class="d2">Printed to your wall, not cut from a roll.</h2><div class="prose"><p>Every wallpaper job is printed to the exact height and width of your wall in numbered panels, so a mural, pattern or brand graphic lands where you designed it — no wasted repeats, no awkward seams at the corner.</p><p>Choose a removable vinyl for rentals and offices, a peel-and-stick for quick refreshes, or a textured commercial grade for high-traffic walls that need to be scrubbed.</p></div></div>
        ${feats([["Printed to size", "Panels cut to your wall height; no wasted repeats.", "ruler"], ["Three materials", "Removable, peel-and-stick, and textured commercial grade.", "layers"], ["Patterns or your art", "Pick from the pattern library or upload your own.", "brush"], ["Installed by us", "Optional professional install, seams matched.", "check"]], 2)}</div>`) +
      sec(secHead("Guidelines & file prep", "Measuring the wall and preparing artwork.") + `<div class="split">${spec([["Measurements", "Wall width × height at the tallest point; note doors, windows and outlets"], ["Artwork", "PDF, TIFF or JPG at 100–150 DPI at full wall size (or 25% scale at 600 DPI)"], ["Bleed", "2 in top and bottom, 1 in per side — walls are never square"], ["Wall prep", "Smooth, primed, fully cured paint (30 days). No fresh latex, no textured stucco"], ["Removal", "Removable vinyl peels clean from primed walls within 3 years"]])}${steps(PROCESS.wall)}</div>`, "alt") +
      workSec("Walls we’ve covered", WORK.wall) + faqSec("wall", { cls: "alt" }) +
      ctaBand("Have a wall in mind?", "Send the dimensions and a photo. We’ll price material and install, and proof your artwork on the wall.", "Request a wallpaper quote", "Wallpaper"),
    init(root) {
      let pat = "mu-tropical";
      const box = root.querySelector("[data-patterns]");
      const drawPatterns = sp => {
        if (sp === "Custom") { box.innerHTML = `<div class="split" style="align-items:center"><div class="prose"><h3 class="d3">Your artwork, your wall.</h3><p>Upload a photo, illustration or brand graphic in the calculator below. We scale it to your wall, proof it on a photo of the room, and print it in numbered panels.</p></div>${art("wall", { photo: "mu-custom-office" })}</div>`; return; }
        box.innerHTML = PATTERNS[sp].map(([room, list]) => `<div style="margin-bottom:28px"><span class="eyebrow plain" style="margin-bottom:12px;display:block">${esc(room)}</span><div class="grid g3">${list.map(([n, ph, k]) => `<button type="button" class="card hov" data-pat="${k}" style="text-align:left">${photo(ph, { style: "aspect-ratio:16/10;border-radius:12px", alt: n })}<b>${esc(n)}</b><span class="tiny">Tap to preview on your wall</span></button>`).join("")}</div></div>`).join("");
      };
      drawPatterns(space === "Custom" ? "Custom" : space);
      root.querySelector("[data-space]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); drawPatterns(b.dataset.val); });
      box.addEventListener("click", e => { const b = e.target.closest("[data-pat]"); if (!b) return; pat = b.dataset.pat; root._pat = pat; root.querySelector("[data-wall]").scrollIntoView({ behavior: "smooth", block: "center" }); root._recalc && root._recalc(); toast("Pattern applied to the wall preview"); });
      root._pat = pat;
    },
    cfg: {
      name: "Wallpaper",
      calc(s) {
        const w = +s.w || 0, h = +s.h || 0, n = Math.max(1, +s.n || 1), area = w * h * n, m = WALL_MAT.find(x => x[0] === s.mat) || WALL_MAT[0];
        const mat = area * m[1], inst = s.inst === "Include installation" ? area * .85 : 0; let total = mat + inst;
        const lines = [["Wall area", `${area.toFixed(0)} sq ft`], [`${m[0]}`, money(Math.round(mat))], ["Installation", inst ? money(Math.round(inst)) : "Not included"], ["Approx. rolls needed", String(Math.ceil(area / 28))]];
        if (s.dtype === "I need design services") { total += 150; lines.push(["Design services", "+$150"]); }
        return { total: Math.round(total), lines, sub: `${area.toFixed(0)} sq ft` };
      },
      onChange(root, s) {
        const el = root.querySelector("[data-wall]"); const w = +s.w || 1, h = +s.h || 1, r = w / h;
        const W = r >= 4 / 3 ? 100 : r / (4 / 3) * 100;
        el.style.width = W + "%"; el.style.aspectRatio = `${w} / ${h}`; el.style.height = "auto";
        el.style.background = root._wallImg ? `center/cover url(${root._wallImg})` : `center/cover url(${SITE.base}/img/${root._pat || "mu-tropical"}.jpg)`;
        root.querySelector("[data-wall-cap]").textContent = `${w} × ${h} ft wall${(+s.n || 1) > 1 ? ` · ${s.n} walls` : ""}`;
      },
    },
  };
};


/* ============ Pages: shop, website, company, account, policies ============ */
PAGES.shop = () => ({
  title: "Shop",
  html: hero({ kicker: "The Satin Shop", title: "Your next project starts here.", lede: "Find a ready-made design, the right vehicle template, or a designer to bring your idea to life — plus the materials, templates and ready-made designs to install it yourself.", crumbs: [["Home", "/"], ["Shop"]], art: art("design", { photo: "show-van-2" }) }) +
    sec(secHead("What would you like to create?", "Five ways to get moving.") + linkCards([
      { name: "Vehicle Wrap Designs", path: "/shop/vehicle-wrap-designs", d: "Browse artwork by style, colour and industry.", art: art("design", { photo: "show-van-1" }) },
      { name: "Vehicle Templates", path: "/shop/vehicle-templates", d: "Find your make, model, year and body style.", art: `<div class="art" style="aspect-ratio:16/10;border-radius:12px;background:var(--bg-2)"><div style="position:absolute;inset:14% 8%">${vehicleSVG("van", { mode: "bare" })}</div></div>` },
      { name: "Design Services", path: "/shop/design-services", d: "Choose a project and review your design package.", art: art("web", { photo: "wrapping-banner" }) },
      { name: "Vehicle Wrap Prints", path: "/shop/vehicle-wrap-prints", d: "Upload artwork and configure your printed film.", art: art("print", { photo: "install-orange" }) },
      { name: "Materials & Tools", path: "/shop/materials-tools", d: "Films, squeegees and installation essentials.", art: art("swatch", { photo: "install-film" }) },
      { name: "Website Design", path: "/website-design", d: "Responsive, conversion-focused websites that match your brand.", art: art("web", { photo: "web-2" }) },
    ], 3)) + ctaBand("Not sure where to start?", "Tell us what you’re working on and we’ll point you to the right design, template or service.", "Ask us", "Shop / General"),
});

PAGES.wrapDesigns = () => ({
  title: "Vehicle Wrap Designs",
  html: hero({ kicker: "Vehicle Wrap Designs", title: "A different look starts here.", lede: "Explore ready-made wrap artwork by style or industry. Open a design to preview it, pick your colours and choose a digital file or a printed and installed wrap.", crumbs: [["Home", "/"], ["Shop", "/shop"], ["Vehicle Wrap Designs"]] }) +
    sec(`<div class="filters" data-filters>
      <div class="row"><span>Style</span><div class="tabs" style="margin:0" data-f="style">${["All styles", "Abstract", "Commercial", "Sport"].map((s, i) => `<button type="button" data-val="${s}" aria-pressed="${i === 0}">${s}</button>`).join("")}</div></div>
      <div class="row"><span>Industry</span><div class="tabs" style="margin:0" data-f="ind">${["All industries", ...new Set(WRAP_DESIGNS.map(d => d.ind))].map((s, i) => `<button type="button" data-val="${s}" aria-pressed="${i === 0}">${s}</button>`).join("")}</div></div>
      <div class="row"><span>Colour</span><div class="tabs" style="margin:0" data-f="col">${["All colours", ...new Set(WRAP_DESIGNS.map(d => d.col))].map((s, i) => `<button type="button" data-val="${s}" aria-pressed="${i === 0}">${s}</button>`).join("")}</div></div></div>
      ${secHead("Discover your next wrap", `<span data-count>12</span> designs ready to adapt.`, "Digital file $149 · printed & installed quoted")}
      <div class="grid g3" data-designs>${WRAP_DESIGNS.map(d => `<a class="card" href="${href("/shop/vehicle-wrap-designs/" + d.slug)}" data-style="${d.style}" data-ind="${d.ind}" data-col="${d.col}">${art("design", { c: d.c, veh: ["van", "pickup", "box"][hash(d.slug) % 3], text: d.name.toUpperCase(), tag: false })}<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip">${d.style}</span><span class="chip">${d.col}</span></div><h3>${d.name}</h3><p>${d.d}</p><div class="foot"><span class="tiny">${d.ind}</span><span class="price">$149</span></div></a>`).join("")}</div>
      <div class="empty" data-empty hidden>No designs match those filters. Try a different style or colour.</div>`) +
    faqSec("designs", { title: "How ready-made designs work.", cls: "alt" }) +
    ctaBand("Don’t see your trade?", "We add designs every month. Tell us your industry and we’ll either point you to the closest match or scope a custom layout.", "Ask about a custom design", "Shop / General"),
  init(root) {
    const f = { style: "All styles", ind: "All industries", col: "All colours" };
    root.querySelector("[data-filters]").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return; pressOne(b); f[b.parentElement.dataset.f] = b.dataset.val; let n = 0;
      root.querySelectorAll("[data-designs]>a").forEach(a => { const ok = (f.style.startsWith("All") || a.dataset.style === f.style) && (f.ind.startsWith("All") || a.dataset.ind === f.ind) && (f.col.startsWith("All") || a.dataset.col === f.col); a.hidden = !ok; n += ok; });
      root.querySelector("[data-count]").textContent = n; root.querySelector("[data-empty]").hidden = n > 0;
    });
  },
});

PAGES.wrapDesign = ({ slug }) => {
  const d = WRAP_DESIGNS.find(x => x.slug === slug); if (!d) return null;
  const similar = WRAP_DESIGNS.filter(x => x !== d && (x.ind === d.ind || x.style === d.style)).slice(0, 3);
  return {
    title: d.name,
    html: hero({ kicker: "Wrap design · " + d.style, title: d.name, lede: d.d, crumbs: [["Home", "/"], ["Shop", "/shop"], ["Wrap Designs", "/shop/vehicle-wrap-designs"], [d.name]], big: false }) +
      sec(`<div class="grid g3 design-preview-gallery">${["van","pickup","box"].map(v=>`<article class="card">${vehicleSVG(v,{c:d.c,text:d.name.toUpperCase()})}<p>${v==='box'?'Box truck':v} · design illustration</p></article>`).join('')}</div>`) + sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">Make it yours</span><h2 class="d3">Preview a colour direction, then choose how to buy.</h2>
        <div class="card" style="padding:14px;background:var(--bg-2)"><div data-dprev>${vehicleSVG("van", { c: d.c, text: d.name.toUpperCase() })}</div><div style="display:flex;justify-content:center;gap:8px" data-vehs>${["van", "pickup", "box"].map((v, i) => `<button class="chip" type="button" data-veh="${v}" aria-pressed="${i === 0}" style="cursor:pointer">${v === "box" ? "Box truck" : v[0].toUpperCase() + v.slice(1)}</button>`).join("")}</div></div>
        ${seg("Colour direction", DESIGN_DIRECTIONS.map(x => x[0]), 0, { key: "dir" })}
        ${seg("Purchase option", [["Digital artwork file", 149, "Layered AI + print-ready PDF, adapted to your vehicle and colours."], ["Printed & installed on my vehicle", 0, "Quoted after vehicle details — the file fee is credited."]], 0, { key: "buy", cards: true, showPrice: true, fmt: v => v ? money(v) : "Quoted" })}
      </div>${summaryBox({ label: d.name, addLabel: "Add file to quote cart", second: quoteBtn("Get this design quoted", "Vehicle Wraps", "btn ghost block", "Design: " + d.name), note: "We adapt the layout to your vehicle and branding before delivering files. The fee is credited if we later wrap the vehicle." })}</div>`) +
      sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">About this design</span><h2 class="d2">${esc(d.name)}: ready in days, not weeks.</h2><div class="prose"><p>${esc(d.d)} This is a finished wrap layout built on a standard vehicle template; we adapt it to your exact make and model and swap in your logo, colours, phone number and web address.</p><p>Buy the digital file to print anywhere, or have us print and install it — the file price is credited back if you go ahead with a wrap.</p></div></div>
        ${feats([["Fast turnaround", "Adapted to your vehicle and branding in 2–3 business days.", "clock"], ["Your colours", "Every design re-colours to your brand palette.", "drop"], ["Print-ready files", "Layered AI/PDF at scale, ready for any wrap shop.", "file"], ["Credited to the wrap", "File price comes off if we print and install it.", "check"]], 2)}</div>`, "alt") +
      sec(secHead("What we need", "Adapting the design to your vehicle.") + `<div class="split">${spec([["Vehicle", "Year, make, model, wheelbase and roof height"], ["Branding", "Logo as vector, brand colours (Pantone or hex), phone, web, tagline"], ["Delivery", "Layered AI + print-ready PDF at 1:1 scale, plus a mockup on your vehicle"], ["Licence", "Single-vehicle licence; fleet licence available for multiple vehicles"], ["Revisions", "Two rounds of colour/text changes included"]])}${steps(PROCESS.wrapDesign)}</div>`) +
      faqSec("designs", { cls: "alt" }) +
      sec(secHead("Similar designs", `More for ${esc(d.ind.toLowerCase())}`, "", A("/shop/vehicle-wrap-designs", `All designs ${arrowSm()}`, "link")) + linkCards(similar.map(x => ({ name: x.name, path: "/shop/vehicle-wrap-designs/" + x.slug, d: x.d, chip: x.style, price: "$149", art: art("design", { c: x.c, text: x.name.toUpperCase(), tag: false }) })), 3)) +
      ctaBand("Want this on your vehicle?", "Tell us the vehicle and your trade. We’ll mock it up in your colours before you commit.", "Get this design quoted", "Vehicle Wraps"),
    cfg: {
      name: d.name + " design",
      calc(s) { const file = s.buy !== "Printed & installed on my vehicle"; return { total: file ? 149 : 0, lines: [["Colour direction", s.dir || "As shown"], ["Includes", "2 revision rounds"], ["Turnaround", "2–3 business days"]], sub: file ? "Digital file" : "Quoted after vehicle details" }; },
      onChange(root, s) {
        const dir = DESIGN_DIRECTIONS.find(x => x[0] === s.dir); const c = dir && dir[1] ? dir[1] : d.c;
        root.querySelector("[data-dprev]").innerHTML = vehicleSVG(root._veh || "van", { c, text: d.name.toUpperCase() });
      },
    },
    init(root) { root.querySelector("[data-vehs]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); root._veh = b.dataset.veh; root._recalc(); }); },
  };
};

PAGES.managedProduct=({slug})=>({title:'Shop product',html:sec('<div data-managed-product></div>'),init(root){import('/studio/catalog.mjs').then(m=>m.mountManagedProduct(root,slug));}});
PAGES.templates = () => ({title:"Vehicle Templates",html:hero({kicker:"Vehicle Templates",title:"Find your vehicle template.",lede:"Choose make, model, year and trim. Match the body before ordering.",crumbs:[["Home","/"],["Shop","/shop"],["Vehicle Templates"]]})+sec('<div data-vehicle-catalog></div>'),init(root){import('/studio/catalog.mjs').then(m=>m.mountCatalog(root,{add:item=>Cart.add(item)}));}});

PAGES.designServices = () => ({
  title: "Design Services",
  html: hero({ kicker: "Design Services", title: "Choose your project. Meet your designer.", lede: "Select what you need designed, review your package and price, then share your brief and artwork.", crumbs: [["Home", "/"], ["Shop", "/shop"], ["Design Services"]], big: false }) +
    sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">What do you need designed?</span>
      ${seg("Design service", DESIGN_SERVICES.map(([n, p, inc]) => [n, p, inc]), 0, { key: "svc", cards: true, showPrice: true, fmt: v => money(v) + " deposit" })}
      ${seg("Vehicle / project type", ["Cargo · Low roof", "Cargo · High roof", "Passenger", "Regular Cab", "Crew Cab", "Not a vehicle"], 0, { key: "type" })}
      ${seg("Design scope", ["New design", "Adapt an existing design"], 0, { key: "scope" })}
      <div class="fields">${field("Business name", `<input class="inp" id="ds-biz" placeholder="e.g. Northline HVAC">`, "full")}${field("Your brief", `<textarea id="ds-brief" placeholder="What should it say, who is it for, colours you like or dislike"></textarea>`, "full")}</div>
      ${dropzone("Upload logo & references", "PDF, AI, EPS, JPG or PNG", "ds-up")}
    </div>${summaryBox({ label: "Design deposit", addLabel: "Review design order", second: quoteBtn("Talk to a designer", "Shop / General", "btn ghost block", "Topic: Design services"), note: "Credited to total if you proceed. Non-refundable once design work begins." })}</div>`) +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">How design works here</span><h2 class="d2">A deposit, a brief, and concepts within days.</h2><div class="prose"><p>Every design project starts with a deposit that is credited back to the job when we produce it. You get a set number of concepts and revisions per package, a to-scale proof on the real vehicle, print or garment template, and print-ready files at the end.</p><p>The designers are the same team that preps files for our own presses and wrap bay, so what they draw is always producible — no surprises when it goes to print.</p></div></div>
      ${feats([["In-house designers", "Same team that preflights every job we print.", "brush"], ["Deposit credited", "The design fee comes off the production invoice.", "check"], ["Concepts + revisions", "Set per package, listed before you commit.", "layers"], ["Files you own", "Layered source files and print-ready exports.", "file"]], 2)}</div>`, "alt") +
    sec(secHead("What to send", "The better the brief, the faster the first concept.") + `<div class="split">${spec([["Logo", "Vector (AI, EPS, SVG, PDF). A JPG works to start; we can redraw it as an add-on"], ["Brand", "Colours (Pantone / hex), fonts, any brand guide, examples you like and dislike"], ["Content", "Exact text: phone, web, tagline, services list — spelling as it should print"], ["Vehicle / product", "Year, make, model and trim for wraps; product and size for print; garment for apparel"], ["Timeline", "First concepts in 3–5 business days; revisions in 1–2 each"]])}${steps(PROCESS.design)}</div>`) +
    workSec("Recent design work", WORK.design, { cls: "alt" }) + faqSec("designsvc") +
    ctaBand("Not sure which package fits?", "Describe the project in a sentence and we’ll point you to the right one — or scope something custom.", "Talk to a designer", "Shop / General"),
  cfg: { name: "Design services", calc(s) { const d = DESIGN_SERVICES.find(x => x[0] === s.svc) || DESIGN_SERVICES[0]; return { total: d[1], lines: [[d[0], money(d[1])], ["Includes", d[2]], ["Scope", s.scope || "New design"]], sub: "Deposit" }; } },
});

PAGES.wrapPrints = () => ({
  title: "Vehicle Wrap Prints",
  html: hero({ kicker: "Vehicle Wrap Prints", title: "Your artwork. Ready to wrap.", lede: "Upload your print-ready artwork, choose your film and finish, and configure your print order.", crumbs: [["Home", "/"], ["Shop", "/shop"], ["Vehicle Wrap Prints"]], big: false }) +
    sec(`<div class="cfg"><div class="opts"><span class="eyebrow plain">01 / Upload your artwork</span>
      ${dropzone("Choose artwork", "PDF, AI, EPS, TIFF — include your final dimensions and bleed.", "wpr-up")}
      <span class="eyebrow plain">02 / Configure your print</span>
      ${seg("Material", [["3M IJ180", 9]], 0, { key: "mat", showPrice: true, fmt: v => "$" + v + " / sq ft" })}
      ${seg("Finish", ["Gloss", "Matte", "Satin"], 0, { key: "fin" })}
      <div class="fields" style="grid-template-columns:repeat(3,minmax(0,1fr))">${field("Width (in)", `<input class="inp" type="number" min="1" value="120" data-k="w" id="wpr-w">`)}${field("Height (in)", `<input class="inp" type="number" min="1" value="54" data-k="h" id="wpr-h">`)}${field("Quantity", `<input class="inp" type="number" min="1" value="1" data-k="q" id="wpr-q">`)}</div>
      ${seg("Delivery", ["Shop pickup", "Shipping"], 0, { key: "del" })}
    </div>${summaryBox({ label: "Your print order", addLabel: "Review artwork", note: "Check file size, scale, bleed and resolution before checkout. Printed with matching laminate." })}</div>`) +
    sec(spec([["Resolution", "72–100 DPI at full vehicle scale; vector wherever possible"], ["Bleed", "2 in of extra artwork past every panel edge"], ["Colour", "CMYK; Pantone references welcome"], ["Laminate", "Matching cast laminate included in the price"], ["Turnaround", "Print 1–2 business days after artwork check"]]), "alt") +
    ctaBand("Not sure your file is ready?", "Send it over. We preflight every file and tell you what needs fixing before you pay.", "Ask about my file", "Shop / General"),
  cfg: { name: "Vehicle wrap print", calc(s) { const area = (+s.w || 0) * (+s.h || 0) / 144 * Math.max(1, +s.q || 1), r = 9; let t = area * r + (s.del === "Shipping" ? 35 : 0); return { total: t, money2: true, lines: [[`${area.toFixed(1)} sq ft · ${s.mat}`, money2(area * r)], [`${s.fin} laminate`, "included"], [s.del, s.del === "Shipping" ? "+$35.00" : "Free"]], sub: "Before tax · CAD" }; } },
});

PAGES.materials = () => ({
  title: "Materials & Tools",
  html: hero({ kicker: "Materials & Tools", title: "Built for the hands-on work.", lede: "Explore wrap films, application tools and finishing essentials for your next installation.", crumbs: [["Home", "/"], ["Shop", "/shop"], ["Materials & Tools"]] }) +
    sec(`${secHead("Stock your next installation", "Filter by category, brand or availability.")}<div class="filters" data-mfilters><div class="row"><span>Brand</span><div class="tabs" style="margin:0" data-f="brand">${["All brands", "3M"].map((b, i) => `<button type="button" data-val="${b}" aria-pressed="${i === 0}">${b}</button>`).join("")}</div></div><div class="row"><span>Availability</span><div class="tabs" style="margin:0" data-f="av">${["All products", "In stock", "Special order"].map((b, i) => `<button type="button" data-val="${b}" aria-pressed="${i === 0}">${b}</button>`).join("")}</div></div></div>
    ${MATERIALS.map(g => `<div style="margin-bottom:34px" data-mgroup><div style="margin-bottom:14px"><h3 class="d3">${g.group}</h3><p class="small">${g.d}</p></div><div class="grid g3">${g.items.map(([n, p, b, av], i) => `<div class="card" data-brand="${b}" data-av="${av}">${art("swatch", { seed: hash(n), tag: false, style: "aspect-ratio:16/8;border-radius:12px" })}<div style="display:flex;gap:6px"><span class="chip">${b}</span><span class="chip ${av === "In stock" ? "good" : ""}">${av}</span></div><b>${n}</b><div class="foot"><span class="price">${money(p)} <span class="tiny">EST.</span></span><button class="btn sm" data-addmat="${esc(n)}" data-price="${p}">Add to quote cart</button></div></div>`).join("")}</div></div>`).join("")}`),
  init(root) {
    const f = { brand: "All brands", av: "All products" };
    root.querySelector("[data-mfilters]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); f[b.parentElement.dataset.f] = b.dataset.val;
      root.querySelectorAll("[data-brand]").forEach(c => c.hidden = !((f.brand.startsWith("All") || c.dataset.brand === f.brand) && (f.av.startsWith("All") || c.dataset.av === f.av)));
      root.querySelectorAll("[data-mgroup]").forEach(g => g.hidden = ![...g.querySelectorAll("[data-brand]")].some(c => !c.hidden)); });
    import('/studio/catalog.mjs').then(m=>m.mountMaterials(root));
  },
});

/* ---------- WEBSITE DESIGN ---------- */
PAGES.web = () => ({
  title: "Website Design",
  html: hero({ kicker: "Website Design", title: "Websites designed to turn visitors into customers.", lede: "Professional websites for businesses that need more than a good-looking homepage. We design responsive, conversion-focused sites built around your brand, services and customers.", crumbs: [["Home", "/"], ["Website Design"]], ctas: A("/website-design#packages", "View packages", "btn") + quoteBtn("Request custom quote", "Shop / General", "btn ghost", "Topic: Website design"), art: art("web", { photo: "web-2" }),
    after: `<div class="grid g4" style="margin-top:14px">${[["$999", "Starter from"], ["2–6 weeks", "Typical timeline"], ["Optional", "Hosting"], ["30 days", "Support included"]].map(([a, b]) => `<div><b style="font-size:20px">${a}</b><div class="tiny">${b}</div></div>`).join("")}</div>` }) +
    sec(secHead("Packages", "Choose your package.", "Fixed scope, fixed price. Every package includes responsive design, hosting setup and 30 days of post-launch support.") + `<div class="pkg">${WEB_PKGS.map(p => `<div class="card ${p.pop ? "pop" : ""}">${p.pop ? '<span class="chip red" style="align-self:flex-start">Most popular</span>' : ""}<h3>${p.name}</h3><div><b style="font-size:26px;letter-spacing:-.02em">${p.from}</b><div class="tiny">${p.time}</div></div><ul>${p.f.map(x => `<li>${x}</li>`).join("")}</ul><div class="foot">${quoteBtn(p.from.startsWith("Custom") ? "Request quote" : "Get started", "Shop / General", "btn sm block", "Package: " + p.name)}</div></div>`).join("")}</div>`, "", "packages") +
    sec(secHead("Build your website", "Configure the site you need — get an estimated price.") + `<div class="cfg"><div class="opts">
      ${seg("Number of pages", WEB_PAGES.map(p => p[0]), 1, { key: "pages" })}
      ${seg("Website type", WEB_TYPES.map(([n, p]) => [n, p, "from " + money(p)]), 2, { key: "type", cards: true })}
      <div class="og"><span class="lab">Add features</span><div class="seg cards" data-multi="feat">${WEB_FEATS.map(([n, p]) => `<button type="button" data-val="${n}" aria-pressed="${["Blog", "Advanced contact forms", "Google Maps", "Gallery / portfolio", "SEO setup"].includes(n)}"><b>${n}</b><em>+${money(p)}</em></button>`).join("")}</div></div>
    </div>${summaryBox({ label: "Estimated project", addLabel: "Request this website", note: "Estimate only — not a final quote. After a short discovery call we send a fixed-price proposal." })}</div>`, "alt") +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow">Why us for your website</span><h2 class="d2">The same team that brands your fleet builds your site.</h2><div class="prose"><p>Your website is the first place a customer checks after seeing a wrapped van or a business card. We design it with the same brand system — same colours, type and photography — so the vehicle, the storefront and the site all read as one business.</p><p>Every site is responsive, built on a modern stack with fast load times, basic SEO set up on day one, and handed over with training so you can update it yourself.</p></div></div>
      ${feats([["Responsive by default", "Looks right on phones, tablets and desktop.", "globe"], ["Fast and SEO-ready", "Optimized images, metadata, sitemap and Google Business setup.", "bolt"], ["On-brand", "Matches the wraps, print and signage we already make for you.", "brush"], ["Yours to edit", "A simple CMS with training, or we maintain it for you.", "user"]], 2)}</div>`) +
    sec(secHead("How a project runs", "From brief to launch.") + `<div class="split">${spec([["What we need", "Logo and brand assets, page list, service descriptions, photos (or we shoot / source them)"], ["Design", "Homepage concept first, then inner pages once the direction is approved"], ["Build", "Modern responsive front end; CMS for pages you’ll edit; forms wired to your inbox"], ["Launch", "Domain, hosting and analytics set up; redirects from any old site"], ["After launch", "30 days of fixes included; monthly care plans available"]])}${steps(PROCESS.web)}</div>`, "alt") +
    workSec("Sites we’ve launched", WORK.web) + faqSec("web", { cls: "alt" }) +
    ctaBand("Let’s scope your website.", "Send the estimate above with a few lines about your business. We’ll come back with a proposal and timeline.", "Request a website proposal", "Shop / General"),
  cfg: {
    name: "Website project",
    calc(s) {
      const t = WEB_TYPES.find(x => x[0] === s.type) || WEB_TYPES[2], pg = WEB_PAGES.find(x => x[0] === s.pages) || WEB_PAGES[1];
      const feats = (s.feat || []).map(n => WEB_FEATS.find(f => f[0] === n)).filter(Boolean);
      const total = t[1] + pg[1] + feats.reduce((a, f) => a + f[1], 0);
      const weeks = total < 1500 ? "2–3 weeks" : total < 2800 ? "3–4 weeks" : total < 4500 ? "4–6 weeks" : "6–10 weeks";
      return { total, lines: [["Website type", t[0]], ["Number of pages", pg[0]], ["Selected features", feats.length ? feats.map(f => f[0]).join(", ") : "None"], ["Estimated timeline", weeks]], sub: "Estimate" };
    },
  },
});

/* ---------- ABOUT ---------- */
PAGES.about = () => ({
  title: "About",
  html: hero({ kicker: "About Satin Graphic", title: "Two shops. One studio.", lede: "Satin Graphic started as a print shop. Satin Auto Wrap grew up wrapping fleets. We’ve brought both under one name, one facility and one team — so a client never has to choose which shop to call.", crumbs: [["Home", "/"], ["About"]], ctas: quoteBtn("Start a quote") + A("/contact", "Contact us", "btn ghost"), art: art("fleet", { photo: "job-subaru-matte", pos: "center 35%", alt: "Matte wrap in the Satin Auto Wrap shop" }) }) +
    sec(`<div class="timeline">${[["Chapter 1", "A print shop opens", "Satin Graphic starts small — offset printing, signage and a growing list of local repeat clients."], ["Chapter 2", "Satin Auto Wrap joins in", "A dedicated vehicle wrap division builds out a climate-controlled install bay and a certified installer team."], ["Chapter 3", "One studio, today", "Both brands now share one facility, one design team and one point of contact for every service on this site."]].map(([k, t, d]) => `<div class="card"><span class="mono tiny">${k}</span><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
      <div class="stats">${[["500+", "Vehicles wrapped per year", 500, "+"], ["10,000+", "Print jobs completed", 10000, "+"], ["12+", "In-house equipment stations", 12, "+"], ["48 hr", "Average proof turnaround", 48, " hr"]].map(([v, l, n, s]) => `<div><b data-count="${n}" data-suf="${s}">${v}</b><span>${l}</span></div>`).join("")}</div>`) +
    sec(secHead("Selected work", "Recent projects") + `<div class="tabs" data-wf>${["All", "Fleet Wrap", "Color Change", "Window Graphics", "Print", "Apparel", "Wallpaper", "PPF", "Window Tint"].map((c, i) => `<button type="button" data-val="${c}" aria-pressed="${i === 0}">${c}</button>`).join("")}</div>${workGrid(WORK.about)}`, "alt", "selected-work") +
    sec(secHead("Our facility", "What’s on the floor") + `<div class="grid g3">${[["Large-Format Printers", "Latex and UV flatbed presses for wrap film, banners and rigid signage.", "print"], ["Roll Lamination Line", "Gloss, matte and satin laminate applied under heat and pressure for durability.", "layers"], ["Climate-Controlled Install Bay", "Dust-filtered, temperature-controlled bays for clean wrap and PPF installs.", "truck"], ["Offset & Digital Press", "Short and long-run printing for cards, brochures and collateral.", "file"], ["In-House Design Studio", "Every proof — vehicle, print or apparel — is designed on-site before it’s produced.", "brush"], ["Apparel Decoration", "DTF and Vinyl Heat Press; embroidery on caps and polos presses for team and fleet uniforms.", "shirt"]].map(([t, d, ic], i) => `<div class="card">${["pr-vinyl-banner-2", "install-film", "install-orange", "pr-booklet", "web-wrap", null][i] ? photo(["pr-vinyl-banner-2", "install-film", "install-orange", "pr-booklet", "web-wrap"][i], { style: "aspect-ratio:16/10;border-radius:12px;margin:-8px -8px 6px", alt: t }) : `<span class="ico">${icon(ic)}</span>`}<h3>${t}</h3><p>${d}</p></div>`).join("")}</div>`) +
    sec(secHead("Our values", "How we work") + `<div class="grid g4">${[["Precision", "Templates and proofs are checked panel-by-panel before anything goes to print."], ["Craftsmanship", "Every wrap is installed by our certified in-house team — never subcontracted out."], ["Turnaround", "Most print orders ship in 48 hours; most wraps install in a single day."], ["Partnership", "One point of contact from first sketch to final install, across every service."]].map(([t, d], i) => `<div class="feat"><span class="mono tiny">0${i + 1}</span><b>${t}</b><p>${d}</p></div>`).join("")}</div>`, "alt") +
    sec(secHead("Our team", "Who you’ll talk to") + `<div class="team">${[["RK", "Ryan K.", "Lead Installer, Vehicle Wraps"], ["SM", "Sarah M.", "Print Production Manager"], ["AT", "Andre T.", "Senior Graphic Designer"], ["JD", "Jenna D.", "Client Success Lead"]].map(([i, n, r]) => `<div class="p">${art("person", { text: i, tag: "Portrait coming soon" })}<b>${n}</b><span class="tiny">${r}</span></div>`).join("")}</div>`) +
    ctaBand("Have a surface in mind?", "Tell us what you’re covering and we’ll price it out.", "Start a quote"),
  init(root) {
    root.querySelector("[data-wf]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); const c = b.dataset.val; root.querySelectorAll("#selected-work .w").forEach(w => w.hidden = !(c === "All" || w.dataset.cat === c)); });
  },
});

/* ---------- CONTACT ---------- */
PAGES.contact = () => ({
  title: "Contact",
  html: hero({ kicker: "Contact", title: "Let’s spec the job.", lede: "Call, email or send a request below — most quotes go out within one business day.", crumbs: [["Home", "/"], ["Contact"]], art: art("fleet", { photo: "install-film" }) }) +
    sec(`<div class="split"><div style="display:flex;flex-direction:column;gap:14px">
      ${[["phone", "Phone", SITE.phone], ["mail", "Email", SITE.email], ["pin", "Location", SITE.address+", "+SITE.city], ["clock", "Hours", "Mon–Fri · 8am–6pm"]].map(([ic, l, v]) => `<div class="card" style="flex-direction:row;align-items:center;gap:14px;padding:16px 18px"><span class="ico">${icon(ic)}</span><span style="flex:1;min-width:0"><span class="tiny">${l}</span><b style="display:block;user-select:all">${esc(v)}</b></span>${ic === "phone" || ic === "mail" ? `<button class="btn ghost sm" data-copy="${esc(v)}">Copy</button>` : ""}</div>`).join("")}
      <div class="card" style="gap:6px"><b>${esc(SITE.address)}<br>${esc(SITE.city)}</b><p class="small">${esc(SITE.area)}</p>${SITE.hours.map(([d, h]) => `<div style="display:flex;justify-content:space-between;font-size:14.5px;border-top:1px solid var(--line-soft);padding-top:6px"><span>${d}</span><span class="mono">${h}</span></div>`).join("")}</div></div>
      <form class="card" style="padding:26px;gap:16px" data-form="contact" novalidate><h2 class="d3">Send a message</h2><div class="fields">
        ${field("Name", `<input class="inp" id="c-name" required autocomplete="name">`)}${field("Email", `<input class="inp" id="c-email" type="email" required autocomplete="email">`)}
        ${field("Phone", `<input class="inp" id="c-phone" type="tel" autocomplete="tel">`)}${field("Service", `<select class="inp" id="c-svc">${["Vehicle Wraps", "Print Shop", "Apparel", "Window Graphics", "Wallpaper", "Window Tint", "Something else"].map(s => `<option>${s}</option>`).join("")}</select>`)}
        ${field("Message", `<textarea id="c-msg" required></textarea>`, "full")}</div>
        <button class="btn" type="submit">Send message</button><p class="tiny" data-form-msg>Preview site: messages are not sent yet. They’ll go to ${esc(SITE.email)} once the back end is connected.</p></form></div>`),
});

/* ---------- REVIEWS ---------- */
PAGES.reviews = () => ({
  title: "Reviews",
  html: hero({ kicker: "Reviews", title: "What clients say.", lede: "Feedback from fleet managers, shop owners and office teams we’ve worked with.", crumbs: [["Home", "/"], ["Reviews"]],
    after: `<div style="display:flex;align-items:center;gap:14px;margin-top:6px"><b style="font-size:44px;letter-spacing:-.03em">4.9</b><div>${stars()}<div class="tiny">Average client rating</div></div></div>` }) +
    sec(`<div class="tabs" data-rf>${["All services", "Vehicle Wraps", "Print Shop", "Apparel", "Window Graphics", "Wallpaper", "Window Tint", "Shop / General"].map((c, i) => `<button type="button" data-val="${c}" aria-pressed="${i === 0}">${c}</button>`).join("")}</div>
      <div data-rlist>${quotes(TESTIMONIALS)}</div><div class="empty" data-rempty hidden>No reviews for this service yet.</div>
      <div class="note" style="margin-top:22px">${icon("star")}<span>These are the sample testimonials from the current site. Real Google reviews can be pulled in here once the back end is connected.</span></div>`) +
    ctaBand("Worked with us?", "We’d love to hear how the job held up.", "Leave feedback", "Shop / General"),
  init(root) {
    root.querySelector("[data-rf]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); const c = b.dataset.val;
      const list = TESTIMONIALS.filter(t => c === "All services" || t.svc === c); root.querySelector("[data-rlist]").innerHTML = list.length ? quotes(list) : ""; root.querySelector("[data-rempty]").hidden = !!list.length; });
  },
});

/* ---------- FAQ ---------- */
PAGES.faq = () => {
  const keys = ["general", "wraps", "estimator", "color", "ppf", "offset", "large", "apparel", "glass", "tint", "wall", "designs", "designsvc", "web"];
  return {
    title: "FAQ",
    html: hero({ kicker: "Help", title: "Frequently asked questions.", lede: "Everything customers ask before they order — quotes, files, turnaround, care and warranties.", crumbs: [["Home", "/"], ["FAQ"]] }) +
      sec(`<div class="policy"><nav class="toc" aria-label="Topics">${keys.map(k => `<a href="#" data-jump="faq-${k}">${FAQ[k].name} <span class="mono tiny">${FAQ[k].items.length}</span></a>`).join("")}${A("/artwork-guidelines", "Artwork guidelines")}</nav>
        <div style="display:flex;flex-direction:column;gap:30px;min-width:0"><div class="field"><span class="fl">Search the answers</span><input class="inp" id="faq-q" type="search" placeholder="e.g. warranty, bleed, how long"></div>
        ${keys.map(k => `<div id="faq-${k}" data-faqgrp><span class="eyebrow" style="margin-bottom:10px">${FAQ[k].name}</span><div class="acc">${FAQ[k].items.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="a">${esc(a)}</div></details>`).join("")}</div></div>`).join("")}
        <div class="empty" data-fempty hidden>No answers match that search. Try fewer words, or ask us directly.</div></div></div>`) +
      ctaBand("Didn’t find it?", "Send us the question. Real answers from the people who do the work, within one business day.", "Ask a question", "Shop / General"),
    init(root) {
      const q = root.querySelector("#faq-q");
      q.addEventListener("input", () => { const t = q.value.trim().toLowerCase(); let any = false;
        root.querySelectorAll("[data-faqgrp]").forEach(g => { let n = 0; g.querySelectorAll("details").forEach(d => { const ok = !t || d.textContent.toLowerCase().includes(t); d.hidden = !ok; if (ok) n++; if (t && ok) d.open = true; }); g.hidden = !n; any = any || n; });
        root.querySelector("[data-fempty]").hidden = any; });
    },
  };
};

/* ---------- TRACK ---------- */
PAGES.track = () => {
  const tabs = [["Quote", "Quote reference number", "Email used on the request", "Q-24817"], ["Order", "Order number", "Email used on the request", "SG-10442"], ["Ticket", "Support ticket reference", "Email used on the request", "T-3021"], ["Invoice", "Invoice number", "Email on the invoice", "INV-2026-118"]];
  return {
    title: "Track Order",
    html: hero({ kicker: "Track", title: "Track a quote, order or ticket", lede: "Enter the reference from your confirmation email and the email address you used.", crumbs: [["Home", "/"], ["Track"]], big: false }) +
      sec(`<div style="max-width:620px"><div class="tabs" data-tt>${tabs.map((t, i) => `<button type="button" data-val="${i}" aria-pressed="${i === 0}">${t[0]}</button>`).join("")}</div>
        ${tabs.map((t, i) => `<form class="card" style="padding:24px;gap:14px" data-form="track" data-tab="${i}" ${i ? "hidden" : ""} novalidate><div class="fields">${field(t[1] + " *", `<input class="inp" id="tr-ref-${i}" required placeholder="${t[3]}">`)}${field(t[2] + " *", `<input class="inp" id="tr-em-${i}" type="email" required placeholder="you@company.ca">`)}</div><button class="btn" type="submit">Track</button><div data-form-msg></div></form>`).join("")}</div>`),
    init(root) { root.querySelector("[data-tt]").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pressOne(b); root.querySelectorAll("[data-tab]").forEach(f => f.hidden = f.dataset.tab !== b.dataset.val); }); },
  };
};

/* ---------- ACCOUNT ---------- */
const authForm = (reg) => `<form class="auth" data-form="${reg ? "register" : "login"}" novalidate><span class="eyebrow">${reg ? "New customer" : "Your account"}</span><h1 class="d2" style="font-size:32px">${reg ? "Create your account." : "Welcome back."}</h1>
  ${reg ? field("Name", `<input class="inp" id="rg-name" required autocomplete="name">`) : ""}${field("Email", `<input class="inp" id="${reg ? "rg" : "lg"}-email" type="email" required autocomplete="email">`)}
  ${reg ? field("Phone (optional)", `<input class="inp" id="rg-phone" type="tel" autocomplete="tel">`) : ""}${field("Password", `<input class="inp" id="${reg ? "rg" : "lg"}-pass" type="password" required autocomplete="${reg ? "new-password" : "current-password"}">`)}
  <button class="btn block" type="submit">${reg ? "Create account" : "Sign in"}</button><div data-form-msg></div>
  <p class="small" style="text-align:center">${reg ? `Already have an account? ${A("/login", "Sign in", "link")}` : `New here? ${A("/register", "Create an account", "link")}`}</p></form>`;
PAGES.login = () => ({ title: "Login", html: sec(authForm(false)) });
PAGES.account = () => ({ title: "Account", html: sec(authForm(false)) });
PAGES.register = () => ({ title: "Register", html: sec(authForm(true)) });

/* ---------- POLICIES ---------- */
PAGES.policy = ({ key }) => {
  const p = POLICIES[key]; if (!p) return null;
  const others = Object.entries(POLICIES).filter(([k]) => k !== key);
  return {
    title: p.t,
    html: hero({ kicker: p.k, title: p.t, lede: p.d, crumbs: [["Home", "/"], [p.t]], big: false, after: `<span class="tiny mono">Last updated September 1, 2026</span>` }) +
      sec(`<div class="policy"><nav class="toc" aria-label="On this page"><span class="eyebrow plain" style="margin-bottom:6px">On this page</span>${p.s.map(([h]) => `<a href="#" data-jump="${slugify(h)}">${esc(h)}</a>`).join("")}<span class="eyebrow plain" style="margin:18px 0 6px">Other policies</span>${others.map(([k, o]) => A("/" + k, esc(o.t))).join("")}</nav>
        <article>${p.s.map(([h, paras]) => { let out = `<h2 id="${slugify(h)}">${esc(h)}</h2>`; let list = []; const flush = () => { if (list.length) { out += `<ul>${list.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`; list = []; } };
          paras.forEach(t => { if (t.startsWith("*")) list.push(t.slice(1)); else { flush(); out += `<p>${esc(t)}</p>`; } }); flush(); return out; }).join("")}
          <div class="note" style="margin-top:20px">${icon("mail")}<span>Questions about this page? ${A("/contact", "Contact us", "link")} and we’ll answer within one business day. ${A("/faq", "Read the FAQ", "link")}</span></div></article></div>`),
  };
};

PAGES.notFound = () => ({ title: "Page Not Found", html: `<section class="notfound"><div class="wrap" style="display:flex;flex-direction:column;gap:18px;align-items:center"><div style="width:min(360px,80vw)">${vehicleSVG("van", { mode: "bare" })}</div><span class="eyebrow">404</span><h1 class="d2">That page took a wrong turn.</h1><p class="lede">The page you were looking for doesn’t exist or has moved.</p>${A("/", "Back to home", "btn")}</div></section>` });


/* ============ App: router, chrome, cart, quote wizard, effects ============ */
function pressOne(b) { [...b.parentElement.children].forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); }
let _tt; function toast(msg) { const t = document.getElementById("toast"); t.innerHTML = icon("check", 16) + esc(tr(msg)); t.classList.add("on"); clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove("on"), 2400); }
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } } };

/* Shared service pages and persisted booking / quote requests. */
Object.entries({"Auto Detailing": "دیتیلینگ خودرو", "Auto detailing": "دیتیلینگ خودرو", "Interior detailing": "دیتیلینگ داخل خودرو", "Exterior detailing": "دیتیلینگ بدنه خودرو", "Paint correction": "اصلاح رنگ و پولیش", "Ceramic coating": "سرامیک خودرو", "Social media services": "خدمات شبکه‌های اجتماعی", "Videography": "ویدیوگرافی", "Design Studio": "استودیوی طراحی", "Book an appointment": "رزرو وقت", "Price plans": "پلن‌های قیمت", "Build your quote": "درخواست قیمت", "Book auto detailing": "رزرو دیتیلینگ", "Vehicle Care": "مراقبت از خودرو", "Restore & Protect": "بازسازی و محافظت", "Plan Your Visit": "برنامه‌ریزی مراجعه"}).forEach(([k,fa])=>TRANSLATIONS[k]={...(TRANSLATIONS[k]||{}),fa});
const SERVICE_COPY = {
  detailing: {path:'/auto-detailing',name:'Auto Detailing',fa:'دیتیلینگ خودرو',kicker:'Clean. Restore. Protect.',title:'A fresh finish. A better drive.',intro:'Auto detailing in Vaughan, serving Toronto and the GTA. Choose interior care, exterior detailing, paint correction or ceramic coating around your vehicle and the way you use it.',image:'service-detailing',items:[['Interior detailing','Vacuuming, surface cleaning and focused care for seats, carpets and trim. Tell us about stains, pet hair and odours so we can scope the work.'],['Exterior detailing','A careful hand wash, wheel cleaning and paint decontamination before the appropriate finish protection.'],['Paint correction','Assess the paint under proper lighting, then choose a polishing approach for swirls and light defects. Results depend on paint condition.'],['Ceramic coating','Prepare the surface, apply a suitable coating and provide aftercare guidance. Coatings support easier cleaning; they do not replace PPF or prevent every scratch.']],plans:[['Refresh',['Interior refresh','Exterior hand wash','Vehicle assessment']],['Deep Detail',['Interior deep clean','Paint decontamination','Finish protection']],['Restore & Protect',['Paint correction assessment','Ceramic coating options','Aftercare guidance']]],options:['Interior detailing','Exterior detailing','Paint correction','Ceramic coating','Pet hair removal','Upholstery cleaning'],faq:[['What affects the price?','Vehicle size, condition, the services selected and the preparation required. We confirm a written quote before work begins.'],['Is my booking immediately confirmed?','Your preferred date and time are a request. We contact you to agree the scope, price and available appointment.']]},
  interior: {path:'/auto-detailing/interior-detailing',name:'Interior Detailing',fa:'دیتیلینگ داخل خودرو',title:'A cabin worth settling into.',intro:'Interior car detailing in Vaughan for everyday vehicles, family cars and working fleets. We scope the cleaning around the materials, stains and condition of your cabin.',image:'service-detailing',items:[['Seats & carpets','Vacuuming and fabric cleaning suited to the material and condition.'],['Trim & touchpoints','Clean door panels, consoles and frequently touched surfaces.'],['Finishing care','Interior glass and material-appropriate care for a tidy finish.']],plans:[['Interior Refresh',['Vacuuming','Touchpoint cleaning','Interior glass']],['Deep Interior',['Detailed cabin cleaning','Upholstery assessment','Carpet care']],['Custom Care',['Pet hair assessment','Stain assessment','Vehicle-specific scope']]],options:['Interior detailing','Pet hair removal','Upholstery cleaning'],faq:[['Can every stain or smell be removed?','Some stains and odours need specialist treatment or may be permanent. We assess these before confirming your quote.']]},
  exterior: {path:'/auto-detailing/exterior-detailing',name:'Exterior Detailing',fa:'دیتیلینگ بدنه خودرو',title:'Bring the finish back into focus.',intro:'Exterior auto detailing in Vaughan, from careful hand washing to decontamination and finish protection. For wrapped cars, we choose an approach appropriate to the film and finish.',image:'service-detailing',items:[['Wash & wheels','Clean the body, wheels and accessible exterior details.'],['Decontamination','Assess bonded contamination and select suitable products and techniques.'],['Protect the finish','Discuss paint, gloss vinyl and matte film care before choosing protection.']],plans:[['Exterior Refresh',['Hand wash','Wheel cleaning','Drying']],['Deep Exterior',['Wash','Paint decontamination','Finish care']],['Protected Finish',['Preparation assessment','Protection options','Aftercare guidance']]],options:['Exterior detailing','Paint correction','Ceramic coating'],faq:[['Can you detail a wrapped vehicle?','Tell us the film brand and finish. Matte and satin films need different care from glossy paint.']]},
  correction: {path:'/auto-detailing/paint-correction',name:'Paint Correction',fa:'اصلاح و پولیش رنگ',title:'Clarity starts with preparation.',intro:'Paint correction in Vaughan for visible swirls and light paint defects. We inspect the finish and agree a realistic polishing scope before starting.',image:'service-detailing',items:[['Inspect','Assess visible defects and paint condition.'],['Refine','Agree a suitable polishing approach for the vehicle.'],['Protect','Discuss a sealant or ceramic coating after correction.']],plans:[['Gloss Enhancement',['Paint assessment','Light polishing scope','Finish care']],['Correction',['Defect assessment','Tailored polishing scope','Preparation']],['Correction + Coating',['Correction assessment','Coating consultation','Aftercare']]],options:['Paint correction','Exterior detailing','Ceramic coating'],faq:[['Will correction remove deep scratches?','Deep scratches, chips and paint damage may require refinishing. Correction is scoped to the condition of the existing paint.']]},
  ceramic: {path:'/auto-detailing/ceramic-coating',name:'Ceramic Coating',fa:'سرامیک خودرو',title:'A considered layer of protection.',intro:'Ceramic coating in Vaughan with preparation tailored to your paint and vehicle use. Compare coating options and request an assessment before selecting a package.',image:'service-detailing',items:[['Surface preparation','Wash and decontaminate, with paint correction scoped where needed.'],['Coating application','Choose a suitable coating and agree the surfaces included.'],['Care after collection','Follow the product-specific curing and maintenance guidance.']],plans:[['Paint Coating',['Preparation assessment','Paint coating options','Care guide']],['Correction + Coating',['Polishing assessment','Paint coating options','Care guide']],['Custom Protection',['Discuss paint, glass and wheels','Vehicle-specific scope','Maintenance guidance']]],options:['Ceramic coating','Paint correction','Exterior detailing'],faq:[['Does ceramic coating prevent scratches?','Ceramic coating is not a substitute for paint protection film and does not make paint scratch-proof.'],['How long will it last?','Longevity depends on the product, preparation, use and maintenance. Product and coverage details are confirmed in your quote.']]},
  social: {path:'/social-media-services',name:'Social Media Services',fa:'خدمات شبکه‌های اجتماعی',kicker:'A consistent brand. Every feed.',title:'Make your brand part of the conversation.',intro:'Social media services for Vaughan, Toronto and GTA businesses. Build a consistent presence with branded content, a practical publishing plan and creative assets aligned with your website and print.',image:'service-social',items:[['Content planning','Define your audience, channels and content themes around business goals.'],['Branded content','Create posts, stories and short-form content using a consistent visual system.'],['Publishing & reporting','Agree the publishing scope, review process and reporting cadence. Paid media spend is scoped separately.']],plans:[['Content Starter',['Channel review','Content themes','Branded post templates']],['Monthly Presence',['Content calendar','Post and story production','Agreed publishing scope']],['Campaign Partner',['Campaign creative','Short-form content scope','Reporting and review']]],options:['Social strategy','Post design','Short-form video','Content calendar','Publishing support','Campaign creative'],faq:[['Are ad budgets included?','Advertising spend is separate. Any ad management scope is agreed before the campaign.'],['Who approves the content?','We agree a review and approval process before publishing any content for your brand.']]},
  video: {path:'/videography',name:'Videography',fa:'خدمات ویدیوگرافی',kicker:'Your story. In motion.',title:'Give your brand a moving story.',intro:'Business videography in Vaughan, Toronto and the GTA. From brand films to product content and social clips, we plan the shoot around the audience, message and where the video will be used.',image:'service-video',items:[['Plan the story','Agree the brief, audience, shot list and deliverables before filming.'],['Capture the details','Scope the location, filming time, people and audio requirements.'],['Edit for the channel','Agree editing, captions, formats and revision rounds for the final delivery.']],plans:[['Social Clips',['Creative brief','Short-form shoot scope','Vertical delivery']],['Brand Story',['Story planning','Business filming','Website and social formats']],['Campaign Production',['Multi-asset brief','Production scope','Channel-specific edits']]],options:['Brand film','Product video','Social clips','Event coverage','Editing','Captions'],faq:[['What affects the price?','Shoot duration, locations, crew needs, editing, usage and the deliverables required.'],['Can we reuse the video on social media?','We can scope versions for your website and social channels. Music and usage rights are agreed as part of the project.']]}
};
const v4t=(en,fa)=>LANG==='fa'?fa:en;
function serviceImage(key,alt,cls=''){return `<figure class="service-image ${cls}"><img src="${SITE.base}/img/${key}.jpg" alt="${esc(alt)}" width="1200" height="800" loading="lazy"><figcaption>${v4t('Illustrative image','تصویر نمایشی')}</figcaption></figure>`;}
function newServicePage(key){
 const d=SERVICE_COPY[key],isAuto=d.path.startsWith('/auto-detailing');
 const name=v4t(d.name,d.fa);
 const cards=d.items.map(([title,text],i)=>`<article class="service-feature"><span class="step-num">0${i+1}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('');
 return {title:name,html:`<div class="wrap">${crumbs([['Home','/'],[isAuto?'Auto Detailing':'Creative Services',isAuto?'/auto-detailing':'/website-design'],[name]])}</div><section class="sec service-hero"><div class="wrap split"><div><span class="eyebrow">${v4t(d.kicker||'Vehicle care · Vaughan', 'خدمات حرفه‌ای · وان')}</span><h1 class="d1">${v4t(d.title,d.fa)}</h1><p class="lede" ${LANG==='fa'?'lang="en" dir="ltr"':''}>${esc(d.intro)}</p><div class="service-actions"><a class="btn" href="#packages">${v4t('Explore price plans','مشاهده پلن‌ها')}</a><a class="btn ghost" href="#configure">${v4t('Build your quote','درخواست قیمت')}</a>${isAuto?A('/auto-detailing/booking',v4t('Book an appointment','رزرو وقت'),'btn ghost'):''}</div></div>${serviceImage(d.image,d.name+' service illustration')}</div></section>
 ${sec(secHead(v4t('What is included','جزئیات خدمات'),v4t('Carefully scoped. Clearly explained.','خدمات روشن و متناسب با نیاز شما.'))+`<div class="service-features">${cards}</div>`)}
 ${key==='detailing'?sec(secHead(v4t('Explore vehicle care','خدمات خودرو'),v4t('Choose the care your car needs.','خدمت مناسب خودرو را انتخاب کنید.'))+`<div class="grid g4">${['interior','exterior','correction','ceramic'].map(k=>{const s=SERVICE_COPY[k];return A(s.path,`<span class="eyebrow">${v4t('Explore service','مشاهده خدمت')}</span><h3>${v4t(s.name,s.fa)}</h3><p class="small">${esc(s.intro)}</p>`,'card service-link');}).join('')}</div>`,'alt'):''}
 ${sec(secHead(v4t('Price plans','پلن‌های قیمت'),v4t('Choose a starting point. We will tailor the scope.','پلن خود را انتخاب کنید؛ جزئیات را با هم مشخص می‌کنیم.'),v4t('Every plan is quoted individually. No payment is taken here.','قیمت هر پلن پس از بررسی اعلام می‌شود؛ اینجا پرداختی انجام نمی‌شود.'))+`<div class="pkg service-plans">${d.plans.map(([n,features],i)=>`<article class="card ${i===1?'pop':''}"><span class="eyebrow">0${i+1}</span><h3>${esc(n)}</h3><b class="plan-price">${v4t('Request pricing','درخواست قیمت')}</b><ul>${features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul><button class="btn ghost" data-service-plan="${esc(n)}">${v4t('Choose plan','انتخاب پلن')}</button></article>`).join('')}</div>`,'alt','packages')}
 ${sec(secHead(v4t('Build your quote','ساخت درخواست قیمت'),v4t('Select the services you need.','خدمات موردنیازتان را انتخاب کنید.'))+`<form data-service-request data-service-key="${key}" class="service-request"><div class="service-options">${isAuto?`<label class="field"><span>${v4t('Vehicle size','نوع خودرو')}</span><select name="vehicleSize" required><option value="Sedan">${v4t('Sedan / coupe','سواری / کوپه')}</option><option value="SUV">SUV / Crossover</option><option value="Truck / van">${v4t('Truck / van','وانت / ون')}</option></select></label><label class="field"><span>${v4t('Vehicle make, model and year','برند، مدل و سال خودرو')}</span><input name="vehicle" maxlength="120" required></label>`:''}<fieldset><legend>${v4t('Services','خدمات')}</legend><div class="service-checkboxes">${d.options.map((s,i)=>`<label><input type="checkbox" name="services" value="${esc(s)}" ${i===0?'checked':''}><span>${esc(s)}</span></label>`).join('')}</div></fieldset><label class="field"><span>${v4t('Selected plan (optional)','پلن انتخابی (اختیاری)')}</span><select name="plan"><option value="">${v4t('Custom selection','انتخاب سفارشی')}</option>${d.plans.map(([n])=>`<option>${esc(n)}</option>`).join('')}</select></label><label class="field"><span>${v4t('Project details','توضیحات')}</span><textarea name="notes" rows="4" maxlength="2000"></textarea></label></div><aside class="request-summary"><span class="eyebrow">${v4t('Your request','درخواست شما')}</span><h3>${esc(name)}</h3><p data-selection-summary></p><b class="plan-price">${v4t('Price on request','قیمت پس از بررسی')}</b><p class="small">${v4t('We confirm scope and pricing before any work begins.','قبل از شروع کار، جزئیات و قیمت تأیید می‌شود.')}</p>${requestContactFields()}<button type="submit" class="btn block">${v4t('Send quote request','ارسال درخواست قیمت')}</button><p class="request-status" role="status" data-request-status></p></aside></form>`,'','configure')}
 ${sec(secHead('FAQ',v4t('Before you get started.','پیش از شروع.'))+`<div class="faq">${d.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><div>${esc(a)}</div></details>`).join('')}</div>`)}
 `,init:bindServiceRequests};
}
function requestContactFields(){return `<label class="field"><span>${v4t('Your name','نام شما')}</span><input name="name" autocomplete="name" maxlength="120" required></label><label class="field"><span>${v4t('Email','ایمیل')}</span><input name="email" type="email" autocomplete="email" maxlength="254" required></label><label class="field"><span>${v4t('Phone (optional)','تلفن (اختیاری)')}</span><input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><label class="request-consent"><input type="checkbox" name="consent" required> <span>${v4t('Satin Graphic may contact me about this request.','ستین گرافیک می‌تواند برای این درخواست با من تماس بگیرد.')}</span></label><label class="request-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>`;}
function bookingPage(){return {title:v4t('Book Auto Detailing','رزرو دیتیلینگ خودرو'),html:hero({kicker:v4t('Auto Detailing · Online booking','دیتیلینگ خودرو · رزرو آنلاین'),title:v4t('Make time for your vehicle.','برای خودروتان وقت بگذارید.'),lede:v4t('Choose your services and preferred appointment. Your request is saved online; our team confirms availability and pricing before the appointment is final. Times are in America/Toronto.','خدمات و زمان پیشنهادی را انتخاب کنید. درخواست آنلاین ثبت می‌شود؛ وقت و قیمت پس از تأیید تیم ما قطعی خواهد شد. زمان‌ها به وقت تورنتو هستند.'),crumbs:[['Home','/'],['Auto Detailing','/auto-detailing'],['Booking']]})+sec(`<form data-service-request data-service-key="detailing" data-booking class="service-request"><div class="service-options"><span class="eyebrow">${v4t('01 · Your vehicle & services','۰۱ · خودرو و خدمات')}</span><label class="field"><span>${v4t('Vehicle make, model and year','برند، مدل و سال خودرو')}</span><input name="vehicle" maxlength="120" required></label><fieldset><legend>${v4t('Services','خدمات')}</legend><div class="service-checkboxes">${SERVICE_COPY.detailing.options.map((s,i)=>`<label><input type="checkbox" name="services" value="${s}" ${i===0?'checked':''}><span>${s}</span></label>`).join('')}</div></fieldset><span class="eyebrow">${v4t('02 · Preferred appointment','۰۲ · زمان پیشنهادی')}</span><div class="grid g2"><label class="field"><span>${v4t('Preferred date','تاریخ پیشنهادی')}</span><input name="date" type="date" required></label><label class="field"><span>${v4t('Preferred time · Toronto','ساعت پیشنهادی · تورنتو')}</span><input name="time" type="time" required></label></div><p class="small">${v4t('This is a preferred time, subject to confirmation. If it is unavailable, we will suggest an alternative.','این زمان پیشنهادی است و نیاز به تأیید دارد؛ در صورت نبود ظرفیت، زمان دیگری پیشنهاد می‌دهیم.')}</p><label class="field"><span>${v4t('Notes','توضیحات')}</span><textarea name="notes" rows="4" maxlength="2000"></textarea></label></div><aside class="request-summary"><span class="eyebrow">${v4t('03 · Contact details','۰۳ · اطلاعات تماس')}</span><h3>${v4t('Your appointment request','درخواست وقت شما')}</h3><p data-selection-summary></p>${requestContactFields()}<button type="submit" class="btn block">${v4t('Request appointment','ثبت درخواست وقت')}</button><p role="status" class="request-status" data-request-status></p></aside></form>`),init:bindServiceRequests};}
function bindServiceRequests(root){
 root.querySelectorAll('form[data-service-request]').forEach(f=>{
   let requestId=crypto.randomUUID();
   const date=f.querySelector('[name=date]');if(date)date.min=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const summary=()=>{f.querySelector('[data-selection-summary]').textContent=[...f.querySelectorAll('[name=services]:checked')].map(c=>c.value).join(' · ')||v4t('Select at least one service.','حداقل یک خدمت انتخاب کنید.');};summary();f.addEventListener('change',summary);
   root.querySelectorAll('[data-service-plan]').forEach(b=>b.addEventListener('click',()=>{f.querySelector('[name=plan]').value=b.dataset.servicePlan;f.scrollIntoView({behavior:'smooth',block:'start'});}));
   f.addEventListener('submit',async e=>{e.preventDefault();if(!f.reportValidity())return;const selected=[...f.querySelectorAll('[name=services]:checked')].map(c=>c.value),status=f.querySelector('[data-request-status]');if(!selected.length){status.textContent=v4t('Select at least one service.','حداقل یک خدمت انتخاب کنید.');return;}
    const fd=new FormData(f),button=f.querySelector('[type=submit]');button.disabled=true;status.textContent=v4t('Saving your request…','در حال ثبت درخواست…');
    try{const response=await fetch('/api/service-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:requestId,formPath:location.pathname.replace(/\/$/,''),type:f.hasAttribute('data-booking')?'booking':'quote',service:SERVICE_COPY[f.dataset.serviceKey].name,services:selected,name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone')||'',vehicle:fd.get('vehicle')||'',vehicleSize:fd.get('vehicleSize')||'',plan:fd.get('plan')||'',notes:fd.get('notes')||'',date:fd.get('date')||'',time:fd.get('time')||'',consent:fd.get('consent')==='on',custom:Object.fromEntries([...fd].filter(([k])=>k.startsWith('custom_')).map(([k,v])=>[k.slice(7),String(v)])),website:fd.get('website')||''})});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save your request.');status.textContent=v4t('Request saved. Reference: ','درخواست ثبت شد. کد پیگیری: ')+data.reference+' — '+v4t('Our team will contact you to confirm the details.','تیم ما برای تأیید جزئیات تماس می‌گیرد.');status.classList.add('success');f.querySelectorAll('input,select,textarea').forEach(i=>i.disabled=true);button.textContent=v4t('Request saved','درخواست ثبت شد');}
    catch(error){status.classList.remove('success');status.textContent=v4t('Your request was not saved. Please retry or contact info@satingraphic.ca. ','درخواست ثبت نشد. دوباره تلاش کنید یا به info@satingraphic.ca پیام بدهید. ')+error.message;button.disabled=false;}
   });
 });
}
function studioPage(){return {title:'Design Studio',html:'<section><div data-print-studio><div class="wrap sec"><h1 class="d2">Design Studio</h1><p class="lede">Business cards, flyers, brochures and banners.</p><p>Loading your design workspace…</p></div></div></section>',init:root=>{import('/studio/designer.mjs').then(m=>m.mountStudio(root)).catch(e=>{const el=root.querySelector('[data-print-studio]');if(el)el.innerHTML='<div class="wrap sec"><h1>Design Studio</h1><p>The designer could not load. Refresh the page to retry.</p></div>';});}};}

Object.keys(SERVICE_COPY).forEach(k=>{const d=SERVICE_COPY[k];SEO[d.path]={title:d.name+' Vaughan & Toronto | Satin Graphic',description:d.intro,image:d.image,noindex:false};});
SEO['/auto-detailing/booking']={title:'Book Auto Detailing Vaughan | Satin Graphic',description:'Request an auto detailing, paint correction or ceramic coating appointment in Vaughan. Select services and your preferred time online.',image:'service-detailing',noindex:false};
SEO['/design-studio']={title:'Design Studio — Print & Apparel | Satin Graphic',description:'Design business cards, flyers, brochures and banners. Add text and uploads, preview your artwork and submit a priced print order for review.',image:'ap-shirt',noindex:false};


PAGES.reviews=()=>({title:'Reviews',html:hero({kicker:'Customer reviews',title:'The words that matter most.',lede:'5.0 out of 5 on Google, based on 204 reviews observed October 4, 2026. Explore ten verified excerpts and summaries below, or read the original reviews on Google.',crumbs:[['Home','/'],['Reviews']]})+sec(homeReviewCarousel(),'alt')});

/* ---------- routes ---------- */
const ROUTES = [
 ['/portfolio',(_p,q)=>portfolioPage(LANG,'/portfolio',q,serviceUI.projects)],['/portfolio/:category',(p,q)=>['commercial','colour-change'].includes(p.category)?portfolioPage(LANG,'/portfolio/'+p.category,q,serviceUI.projects):null],['/portfolio/projects/:slug',(p,q)=>portfolioPage(LANG,'/portfolio/projects/'+p.slug,q,serviceUI.projects)],
 ...Object.keys(SERVICE_COPY).map(k=>[SERVICE_COPY[k].path,()=>newServicePage(k)]),["/auto-detailing/booking",bookingPage],["/design-studio",studioPage],
  ["/", PAGES.home], ["/vehicle-wraps", PAGES.wraps], ["/vehicle-wraps/commercial", PAGES.commercial], ["/vehicle-wraps/commercial/:slug", PAGES.commercialItem],
  ["/vehicle-wraps/color-change", PAGES.colorChange], ["/vehicle-wraps/paint-protection-film", PAGES.ppf], ["/vehicle-wraps/estimator", PAGES.estimator], ["/vehicle-wraps/estimator/:slug", PAGES.estimatorItem],
  ["/print-shop", PAGES.printShop], ["/print-shop/offset", PAGES.offset], ["/print-shop/offset/:slug", PAGES.offsetItem], ["/print-shop/large-format", PAGES.large], ["/print-shop/large-format/:slug", PAGES.largeItem],
  ["/apparel", PAGES.apparel], ["/apparel/:slug", PAGES.apparelItem], ["/window-graphics", PAGES.glass], ["/window-graphics/:slug", PAGES.glassItem],
  ["/window-tint", PAGES.tint], ["/window-tint/vehicle", PAGES.tintVehicle], ["/window-tint/commercial", PAGES.tintCommercial], ["/wallpaper", PAGES.wallpaper],
  ["/shop/products/:slug", PAGES.managedProduct], ["/shop", PAGES.shop], ["/shop/vehicle-wrap-designs", PAGES.wrapDesigns], ["/shop/vehicle-wrap-designs/:slug", PAGES.wrapDesign], ["/shop/vehicle-templates", PAGES.templates],
  ["/shop/design-services", PAGES.designServices], ["/shop/vehicle-wrap-prints", PAGES.wrapPrints], ["/shop/materials-tools", PAGES.materials], ["/website-design", PAGES.web],
  ["/about", PAGES.about], ["/contact", PAGES.contact], ["/reviews", PAGES.reviews], ["/faq", PAGES.faq], ["/track", PAGES.track], ["/login", PAGES.login], ["/register", PAGES.register], ["/account", PAGES.account],
  ...Object.keys(POLICIES).map(k => ["/" + k, () => PAGES.policy({ key: k })]),
];
function match(path) {
  const segs = path.split("/").filter(Boolean);
  for (const [pat, fn] of ROUTES) { const ps = pat.split("/").filter(Boolean); if (ps.length !== segs.length) continue; const params = {}; let ok = true;
    ps.forEach((p, i) => { if (p[0] === ":") { try { params[p.slice(1)] = decodeURIComponent(segs[i]); } catch { ok = false; } } else if (p !== segs[i]) ok = false; }); if (ok) return [fn, params]; }
  return [null, {}];
}
function parseLocation() {
  const inside = location.pathname === SITE.base || location.pathname.startsWith(SITE.base + "/");
  let path = inside ? location.pathname.slice(SITE.base.length) || "/" : "/404";
  LANG=languageFromPath(location.pathname);
  if(LANG!=='en')path=path.slice(LANG.length+1)||'/';
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const query = new URLSearchParams(location.search);
  let anchor = "";
  try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { }
  return { path, query, anchor, full: href(path) + location.search };
}
function migrateHash() {
  // Keep previously shared hash links working, including their query and anchor.
  if (!location.hash.startsWith("#" + SITE.base)) return false;
  const legacy = new URL(location.hash.slice(1), location.origin);
  if (legacy.pathname !== SITE.base && !legacy.pathname.startsWith(SITE.base + "/")) return false;
  const path = legacy.pathname.slice(SITE.base.length) || "/";
  history.replaceState(null, "", href(path) + legacy.search + legacy.hash);
  return true;
}
function navigate(url) {
  history.pushState(null, "", url.pathname + url.search + url.hash);
  render();
}

/* ---------- chrome ---------- */
const MEGA = {
  wraps: { label: "Vehicle Wraps", cols: [["Commercial Wrap", [["All vehicle wraps", "/vehicle-wraps", 1], ["Commercial wrap", "/vehicle-wraps/commercial", 1], ...COMMERCIAL.map(c => [c.name, "/vehicle-wraps/commercial/" + c.slug])]], ["Color Change & PPF", [["Color change wrap", "/vehicle-wraps/color-change"], ["Paint protection film", "/vehicle-wraps/paint-protection-film"]]], ["Price Estimator", [["Open estimator", "/vehicle-wraps/estimator", 1], ...ESTIMATOR.slice(0, 6).map(e => [e.name, "/vehicle-wraps/estimator/" + e.slug])]]], promo: ["Price estimator", "Pick a vehicle, coverage and finish for a starting price in under a minute.", "/vehicle-wraps/estimator", "fleet", "sprinter-wrapped"] },
  print: { label: "Print Shop", cols: [["Offset Printing", [["All print shop", "/print-shop", 1], ["Offset printing", "/print-shop/offset", 1], ...OFFSET.map(o => [o.name, "/print-shop/offset/" + o.slug])]], ["Large Format", [["Large format", "/print-shop/large-format", 1], ...LARGE.map(o => [o.name, "/print-shop/large-format/" + o.slug])]], ["Help", [["Artwork guidelines", "/artwork-guidelines"], ["Orders & shipping", "/refund-policy"], ["Track an order", "/track"]]]], promo: ["Business cards", "Configure stock, sides and quantity — live price as you go.", "/print-shop/offset/business-cards", "print", "pr-bc-1"] },
  apparel: { label: "Apparel", cols: [["Custom Apparel", [["All apparel", "/apparel", 1], ...APPAREL.map(a => [a.name, "/apparel/" + a.slug])]], ["Decoration", [["DTF print", "/apparel/t-shirts"], ["Embroidery", "/apparel/hats"], ["DTF transfer", "/apparel/hoodies"], ["Heat-press vinyl", "/apparel/workwear"]]], ["Help", [["Apparel artwork guide", "/artwork-guidelines"], ["Warranty", "/warranty"]]]], promo: ["See your logo on it", "Upload a logo and preview it on the garment before you order.", "/apparel", "apparel", "satin-shirt"] },
  windows: { label: "Windows & Walls", cols: [["Window Graphics", [["All window graphics", "/window-graphics", 1], ...GLASS.map(g => [g.name, "/window-graphics/" + g.slug])]], ["Window Tint", [["Window tint", "/window-tint", 1], ["Vehicle tint", "/window-tint/vehicle"], ["Commercial tint", "/window-tint/commercial"]]], ["Wallpaper", [["Wallpaper", "/wallpaper", 1], ["Home", "/wallpaper?space=home"], ["Office", "/wallpaper?space=office"], ["Custom", "/wallpaper?space=custom"]]]], promo: ["VLT preview", "Drag the slider to see how each tint percentage reads on glass.", "/window-tint", "tint", "install-tint"] },
  shop: { label: "Shop", cols: [["Shop", [["All shop", "/shop", 1], ["Vehicle wrap designs", "/shop/vehicle-wrap-designs"], ["Vehicle templates", "/shop/vehicle-templates"], ["Design services", "/shop/design-services"], ["Vehicle wrap prints", "/shop/vehicle-wrap-prints"], ["Materials & tools", "/shop/materials-tools"]]], ["Services", [["Website design", "/website-design", 1]]], ["Company", [["About", "/about"], ["Reviews", "/reviews"], ["FAQ", "/faq"], ["Contact", "/contact"]]]], promo: ["Website design", "The same team that brands your fleet builds your site.", "/website-design", "web", "web-2"] },
};

MEGA.wraps?.cols[1][1].push(['Vehicle window tint','/window-tint/vehicle']);
MEGA.detailing={label:'Auto Detailing',cols:[['Vehicle Care',[['Auto detailing','/auto-detailing',1],['Interior detailing','/auto-detailing/interior-detailing'],['Exterior detailing','/auto-detailing/exterior-detailing']]],['Restore & Protect',[['Paint correction','/auto-detailing/paint-correction'],['Ceramic coating','/auto-detailing/ceramic-coating']]],['Plan Your Visit',[['Price plans','/auto-detailing#packages',1],['Build your quote','/auto-detailing#configure'],['Book an appointment','/auto-detailing/booking']]]],promo:['Book your vehicle care','Select services and request your preferred appointment.','/auto-detailing/booking','fleet','install-detail']};
MEGA.shop.cols[1][1].push(['Social media services','/social-media-services',1],['Videography','/videography',1]);

const navigationSeed=document.querySelector('[data-navigation-bootstrap]');const managedNavigation=navigationSeed?JSON.parse(navigationSeed.textContent).items:null;
if(managedNavigation)for(const m of managedNavigation){const original=MEGA[m.key];MEGA[m.key]={label:m.label,cols:m.groups.map(g=>[g.label,g.links.filter(l=>l.active!==false).map(l=>[l.label,l.href.replace(/^\/satin/, '')])]),promo:original?.promo||[m.label,'Explore '+m.label,m.href.replace(/^\/satin/,''),'print','pr-bc-1']};}

function header() {
  return `<a class="sr" href="#main" data-skip>Skip to content</a><header class="hdr"><div class="wrap bar">
    <a class="logo" href="${href("/")}" aria-label="Satin Graphic home"><img src="${LOGO}" alt="Satin Graphic" width="483" height="78"></a>
    ${A("/design-studio", "Design Studio", "studio-nav studio-entry")}<nav class="nav" aria-label="Main">${managedNavigation?menuHTML(managedNavigation,false,(location.pathname.match(/^\/satin\/(fa|fr|es)(?:\/|$)/)?.[1]||'en')):`${Object.entries(MEGA).map(([k, m]) => `<button type="button" data-mega="${k}" aria-expanded="false">${m.label}<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></button>`).join("")}${A("/portfolio", "Our Work", "studio-nav")}${A("/design-studio", "Design Studio", "studio-nav")}`}</nav>
    <div class="right">${languageSelector()}${quoteBtn("Get a quote", "", "btn sm q-desk")}<button class="icon-btn" data-cart aria-label="Open cart">${icon("cart")}<span class="badge" data-n="0" data-cart-n>0</span></button><button class="icon-btn burger" data-burger aria-label="Open menu">${icon("menu")}</button></div></div>
    <div class="mega" data-megapanel><div class="wrap in"></div></div></header>`;
}
function megaHTML(k) {
  const m = MEGA[k];
  return m.cols.map(([h, links]) => `<div class="col"><h4>${h}</h4>${links.map(([t, p, top]) => A(p, esc(t), top ? "top" : "")).join("")}</div>`).join("") +
    `<a class="promo" href="${href(m.promo[2])}">${art(m.promo[3], { seed: 2, tag: false, photo: m.promo[4] })}<b>${m.promo[0]}</b><span class="small">${m.promo[1]}</span><span class="link" style="align-self:flex-start">Open ${arrowSm()}</span></a>`;
}
function drawer() {
  return `<div class="drawer" data-drawer><div class="scrim" data-close-drawer></div><div class="panel" role="dialog" aria-label="Menu">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><img src="${LOGO}" alt="" style="height:20px" class="dlogo"><button class="icon-btn" data-close-drawer aria-label="Close menu">${icon("close")}</button></div>
    ${managedNavigation?menuHTML(managedNavigation,true,(location.pathname.match(/^\/satin\/(fa|fr|es)(?:\/|$)/)?.[1]||'en')):`${Object.values(MEGA).map(m => `<details><summary>${m.label}${icon("chev", 16)}</summary>${m.cols.map(([, links]) => links.map(([t, p]) => A(p, esc(t))).join("")).join("")}</details>`).join("")}
    ${A("/design-studio", "Design Studio", "plain-link studio-nav")}${A("/portfolio", tr("Our work"), "plain-link")}${A("/about", "About", "plain-link")}${A("/contact", "Contact", "plain-link")}${A("/faq", "FAQ", "plain-link")}${A("/login", "Login", "plain-link")}
`}
    <div style="margin-top:16px">${quoteBtn("Get a quote", "", "btn block")}</div><p class="tiny" style="margin-top:10px">${SITE.phone.includes('555-')?'':SITE.phone}</p></div></div>`;
}
function footer() {
  const col = (h, links) => `<div class="col"><h2>${h}</h2>${links.map(([t, p]) => A(p, esc(t))).join("")}</div>`;
  return `<footer class="ftr"><div class="wrap"><div class="top">
    <div style="display:flex;flex-direction:column;gap:12px;max-width:340px"><img src="${LOGO}" alt="Satin Graphic" style="height:24px;width:auto;align-self:flex-start" class="flogo" width="483" height="78"><p class="small">${LANG==='en'?'Vehicle wraps, print shop, apparel, window graphics, wallpaper and window tint — one studio, one facility.':LANGUAGE_COPY[LANG].footer}</p>
      <p class="small">${SITE.phone.includes('555-')?'':`<span style="user-select:all">${SITE.phone}</span> · `}<span style="user-select:all">${SITE.email}</span><br><span dir="ltr">${SITE.address}<br>${SITE.city}</span></p>
      <form class="news" data-form="news" novalidate><input class="inp" type="email" id="nl-email" placeholder="Email for project tips" aria-label="Email for newsletter" required><button class="btn sm" type="submit">Subscribe</button></form></div>
    ${col("Services", [["Auto detailing", "/auto-detailing"], ["Book auto detailing", "/auto-detailing/booking"], ["Vehicle wraps", "/vehicle-wraps"], ["Commercial wraps", "/vehicle-wraps/commercial"], ["Color change", "/vehicle-wraps/color-change"], ["Paint protection film", "/vehicle-wraps/paint-protection-film"], ["Price estimator", "/vehicle-wraps/estimator"], ["Window tint", "/window-tint"]])}
    ${col("Print & more", [["Print shop", "/print-shop"], ["Offset printing", "/print-shop/offset"], ["Large format", "/print-shop/large-format"], ["Apparel", "/apparel"], ["Window graphics", "/window-graphics"], ["Wallpaper", "/wallpaper"], ["Website design", "/website-design"], ["Social media services", "/social-media-services"], ["Videography", "/videography"], ["Design Studio", "/design-studio"]])}
    ${col("Company", [["Our work", "/portfolio"], ["About", "/about"], ["Reviews", "/reviews"], ["Shop", "/shop"], ["Contact", "/contact"], ["FAQ", "/faq"], ["Track order", "/track"], ["Log in", "/login"]])}
    ${col("Help & policies", [["Artwork guidelines", "/artwork-guidelines"], ["Warranty", "/warranty"], ["Orders, shipping & returns", "/refund-policy"], ["Privacy policy", "/privacy-policy"], ["Terms & conditions", "/terms-and-conditions"], ["Accessibility", "/accessibility"]])}
  </div><div class="bot"><span>© 2026 Satin Graphic · Satin Auto Wrap</span><span>${LANG==='en'?'Prices in CAD':LANGUAGE_COPY[LANG].prices} · ${esc(SITE.city)}</span></div></div></footer>`;
}

/* ---------- cart ---------- */
const Cart = {
  items: store.get("sg-cart", []),
  save() { store.set("sg-cart", this.items); const n = this.items.length; document.querySelectorAll("[data-cart-n]").forEach(b => { b.textContent = n; b.dataset.n = n; }); },
  add(it) { this.items.push({ ...it, id: Date.now() + Math.random() }); this.save(); toast(`${it.name} added to cart`); const b = document.querySelector("[data-cart]"); b && b.classList.remove("bump"); void (b && b.offsetWidth); b && b.classList.add("bump"); },
  remove(id) { this.items = this.items.filter(i => i.id != id); this.save(); },
  open() {
    if(this.items.some(i=>i.pricing&&!i.pricePending)){location.assign("/satin/checkout/");return;}
    const total = this.items.reduce((a, i) => a + (i.total || 0), 0);
    openModal(`<div><span class="eyebrow">Quote cart</span><h2 class="d3" style="margin-top:8px">${this.items.length ? `${this.items.length} item${this.items.length > 1 ? "s" : ""} to quote` : "Your quote cart is empty"}</h2></div>
      ${this.items.length ? `<div>${this.items.map(i => `<div class="cart-item"><div><b>${esc(i.name)}</b><div class="d">${(i.lines || []).map(esc).join(" · ")}</div></div><div style="text-align:right"><span class="price">${i.pricePending?"Price pending":i.total ? money2(i.total) : "Quoted"}</span><br><button class="tiny link" data-rm="${i.id}">Remove</button></div></div>`).join("")}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="small">${this.items.some(i=>i.pricePending)?"Known charges · other prices pending":"Estimated total"}</span><b style="font-size:26px">${money2(total)}</b></div>
      <div class="mfoot"><button class="btn ghost" data-close>Keep browsing</button>${this.items.some(i=>i.pricing?.ruleId?.startsWith("print-"))?`<button class="btn" data-print-checkout>Print checkout</button>`:""}<button class="btn ghost" data-cart-quote>Request quote for these items ${arrowSm()}</button></div>`
      : `<p class="small">Configure a product on any page and choose “Add to quote cart”. Everything you add is sent as one quote request.</p><div class="mfoot"><span></span>${A("/print-shop", "Browse the print shop", "btn")}</div>`}`);
  },
};

/* ---------- modal ---------- */
function openModal(html, wide) {
  const m = document.getElementById("modal"); m.querySelector(".box").className = "box" + (wide ? " wide" : ""); m.querySelector("[data-mbody]").innerHTML = localizedHTML(html);
  m.classList.add("open"); document.body.style.overflow = "hidden"; setTimeout(() => (m.querySelector("input,select,button:not(.close)") || m.querySelector(".close")).focus(), 60);
}
function closeModal() { document.getElementById("modal").classList.remove("open"); document.body.style.overflow = ""; }

/* ---------- quote wizard ---------- */
const Q = { svc: "", details: {}, step: 0, contact: {}, fromCart: false };
function openQuote(svc = "", preset = "", fromCart = false, estimate = "") {
  Object.assign(Q, { svc, details: {}, step: svc ? 1 : 0, contact: Q.contact || {}, fromCart, estimate, id:crypto.randomUUID() });
  preset.split(";").map(s => s.split(":").map(x => x.trim())).forEach(([k, v]) => { if (k && v) Q.details[k] = v; });
  if (fromCart) Q.step = 2;
  renderQuote();
}
window.satinOpenQuote=openQuote;
function quoteNeedsDesign(){return Q.fromCart?Cart.items.some(i=>i.pricing?.values?.design||i.pricing?.ruleId==='design-services'):/Design/i.test(Q.svc||'');}
function renderQuote() {
  const total = 3, s = Q.step, svcList = QUOTE_SERVICES;
  const bar = `<div class="prog">${[0, 1, 2].map(i => `<i class="${i <= s ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (s === 0) body = `<h3 class="d3">What are we quoting?</h3><div class="seg cards" data-qsvc>${svcList.map(x => `<button type="button" data-val="${x}" aria-pressed="${Q.svc === x}"><b>${x}</b></button>`).join("")}</div>`;
  if (s === 1) { const d = QUOTE_DETAILS[Q.svc] || []; body = `<h3 class="d3">A few details</h3><p class="small">${esc(Q.svc)}</p><div class="fields">${d.map(([n, opts], i) => field(n, `<select class="inp" id="qd-${i}" data-qd="${esc(n)}">${opts.map(o => `<option ${Q.details[n] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`, d.length === 1 ? "full" : "")).join("")}</div>`; }
  if (s === 2) body = `<h3 class="d3">How should we reach you?</h3>${Q.fromCart ? `<div class="note">${icon("cart")}<span>${Cart.items.length} item(s) from your quote cart will be attached.</span></div>` : ""}<div class="fields">
    ${field("Name", `<input class="inp" id="q-name" required autocomplete="name" value="${esc(Q.contact.name || "")}">`)}${field("Email", `<input class="inp" id="q-email" type="email" required autocomplete="email" value="${esc(Q.contact.email || "")}">`)}
    ${field("Phone", `<input class="inp" id="q-phone" type="tel" required autocomplete="tel" value="${esc(Q.contact.phone || "")}">`)}${field("Preferred contact", `<select class="inp" id="q-pref"><option>Email</option><option>Phone call</option><option>Text message</option></select>`)}
    ${field("Notes", `<textarea id="q-notes" placeholder="Anything else we should know?">${esc(Q.contact.notes || "")}</textarea>`, "full")}</div><label class="field">Add document (optional)<input id="q-document" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,image/svg+xml"></label><p class="small">Share a design, sample or supporting document. Support: info@satingraphic.ca.</p><div id="q-design-agreement" class="service-terms"><label><input id="q-design-accept" type="checkbox"> I have read and agree to the <a target="_blank" href="/satin/design-agreement/">Vehicle Wrap Design Agreement</a>.</label><p class="small">Design contact: <a href="mailto:${esc(serviceUI.settings.designEmail)}">${esc(serviceUI.settings.designEmail)}</a></p></div><label class="request-consent"><input id="q-consent" type="checkbox"> I agree to be contacted about this request and have read the <a href="/satin/privacy-policy/">privacy policy</a>.</label><p class="tiny" data-qerr style="color:var(--accent)"></p>`;
  openModal(`<div><span class="eyebrow">Request a quote</span><span class="tiny mono" style="float:right">Step ${s + 1} / ${total}</span></div>${bar}${body}
    <div class="mfoot"><button class="btn ghost" data-qback ${s === 0 ? "disabled style=\"opacity:.4\"" : ""}>Back</button><button class="btn" data-qnext>${s === 2 ? "Submit request" : "Continue"} ${arrowSm()}</button></div>`);  if(s===2)document.getElementById('q-design-agreement').hidden=!quoteNeedsDesign();
}
async function quoteNext() {
  const m = document.getElementById("modal");
  if (Q.step === 0) { const b = m.querySelector("[data-qsvc] [aria-pressed=true]"); if (!b) { toast("Choose a service to continue"); return; } Q.svc = b.dataset.val; Q.step = 1; return renderQuote(); }
  if (Q.step === 1) { m.querySelectorAll("[data-qd]").forEach(s => Q.details[s.dataset.qd] = s.value); Q.step = 2; return renderQuote(); }
  const g = id => m.querySelector("#" + id).value.trim(); Q.contact = { name: g("q-name"), email: g("q-email"), phone: g("q-phone"), notes: g("q-notes") };
  const err = !Q.contact.name ? "Add your name so we know who to reply to." : !/^\S+@\S+\.\S+$/.test(Q.contact.email) ? "Add a valid email address — that’s where the quote goes." : !Q.contact.phone ? "Add your contact phone number." : "";
  if (err) { m.querySelector("[data-qerr]").textContent = err; return; }
  if(!m.querySelector('#q-consent').checked){m.querySelector('[data-qerr]').textContent='Please agree to contact about this request.';return;}
  const designRequested=quoteNeedsDesign(),designTermsAccepted=m.querySelector('#q-design-accept').checked;if(designRequested&&!designTermsAccepted){m.querySelector('[data-qerr]').textContent='Please read and accept the design agreement.';return;}
  const button=m.querySelector('[data-qnext]');button.disabled=true;button.textContent='Saving…';
  try{
   const attachments=[];const documents=[...m.querySelector('#q-document').files];if(documents.length){await fetch('/api/studio/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});for(const file of documents){const fd=new FormData();fd.set('file',file);const rr=await fetch('/api/studio/upload',{method:'POST',body:fd}),d=await rr.json();if(!rr.ok)throw Error(d.error);attachments.push(d.file.id);}}
   const details=Object.fromEntries(Object.entries(Q.details).map(([k,v],i)=>['option_'+i,k+': '+v]));
   const response=await fetch('/api/quote-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:Q.id,service:Q.svc||'Shop / General',...Q.contact,details,attachments,consent:true,designRequested,designTermsAccepted,contactPreference:g('q-pref'),estimate:Q.fromCart?JSON.stringify(Cart.items):Q.estimate||''})});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');
   if(Q.fromCart){Cart.items=[];Cart.save();}
   openModal(`<span class="ok-big">${icon('check')}</span><h3 class="d3">Request saved.</h3><p>Your reference is <b>${esc(data.reference)}</b>. Our team will contact you about scope and pricing.</p><p class="small">Artwork can be emailed to info@satingraphic.ca with this reference.</p><button class="btn" data-close>Done</button>`);
  }catch(e){m.querySelector('[data-qerr]').textContent=e.message;button.disabled=false;button.textContent='Submit request';}
}

/* ---------- configurators ---------- */
function mountCfg(root, cfg) {
  const box = root.querySelector(".cfg"); if (!box) return;
  const state = {};
  const read = () => {
    box.querySelectorAll("[data-group]").forEach(g => { const b = g.querySelector('[aria-pressed="true"]'); state[g.dataset.group] = b ? b.dataset.val : undefined; });
    box.querySelectorAll("[data-multi]").forEach(g => { state[g.dataset.multi] = [...g.querySelectorAll('[aria-pressed="true"]')].map(b => b.dataset.val); });
    box.querySelectorAll("[data-k]").forEach(i => { state[i.dataset.k] = i.value; });
  };
  let last;
  const recalc = () => {
    read(); const r = cfg.calc(state); cfg.onChange && cfg.onChange(root, state);
    const tot = box.querySelector("[data-total]"); const txt = r.total ? (r.money2 ? money2(r.total) : money(r.total)) : "Quoted";
    if (tot && tot.textContent !== txt) { tot.textContent = txt; if (last !== undefined) { tot.classList.remove("bump"); void tot.offsetWidth; tot.classList.add("bump"); } }
    last = r.total; box.querySelector("[data-lines]").innerHTML = r.lines.map(([a, b]) => `<div><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join("");
    if (r.sub !== undefined) box.querySelector("[data-sub]").textContent = r.sub; if (r.note) box.querySelector("[data-note]").textContent = r.note;
    root._last = r;localizeDOM(box);
  };
  root._recalc = recalc;
  box.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.parentElement.matches("[data-group]")) { pressOne(b); recalc(); }
    else if (b.parentElement.matches("[data-multi]")) { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); recalc(); }
    else if (b.dataset.step) { const i = b.parentElement.querySelector("input"); i.value = Math.max(+i.min || 1, (+i.value || 0) + +b.dataset.step); recalc(); }
    else if (b.hasAttribute("data-add")) { read(); const r = cfg.calc(state); Cart.add({ name: cfg.name, lines: r.lines.slice(0, 4).map(([a, v]) => `${a}: ${v}`), total: r.total }); }
  });
  box.addEventListener("input", e => { if (e.target.matches("[data-k]")) recalc(); });
  recalc();
}

/* ---------- uploads ---------- */
function bindDrops(root) {
  root.querySelectorAll("[data-drop]").forEach(inp => {
    const lab = inp.closest(".drop");
    ["dragover", "dragenter"].forEach(ev => lab.addEventListener(ev, e => { e.preventDefault(); lab.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => lab.addEventListener(ev, () => lab.classList.remove("over")));
    lab.addEventListener("drop", e => { e.preventDefault(); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
    inp.addEventListener("change", () => inp.files[0] && handle(inp.files[0]));
    function handle(f) {
      lab.querySelector("[data-drop-title]").textContent = `${f.name} · ${(f.size / 1024 / 1024).toFixed(1)} MB`;
      if (/^image\//.test(f.type)) { const r = new FileReader(); r.onload = () => { if (inp.id === "ap-up") root._logo = r.result; if (inp.id === "wp-up") root._wallImg = r.result; root._recalc && root._recalc(); }; r.readAsDataURL(f); }
      toast("File attached");
    }
  });
}

/* ---------- forms ---------- */
function bindForms(root) {
  root.querySelectorAll("form[data-form]").forEach(f => f.addEventListener("submit", e => {
    e.preventDefault(); const msg = f.querySelector("[data-form-msg]");
    const bad = [...f.querySelectorAll("[required]")].find(i => !i.value.trim() || (i.type === "email" && !/^\S+@\S+\.\S+$/.test(i.value)));
    if (bad) { bad.focus(); if (msg) msg.innerHTML = `<span style="color:var(--accent)">Check “${esc(bad.closest(".field")?.querySelector(".fl")?.textContent || "this field")}” — it’s required${bad.type === "email" ? " and needs a valid email" : ""}.</span>`; else toast("Add a valid email address"); return; }
    const t = f.dataset.form;
    if (t === "news") { toast("Subscribed — preview only"); f.reset(); return; }
    if (t === "contact") { msg.innerHTML = `<span style="color:var(--good)">Message ready. In this preview nothing is sent; once the back end is connected it goes to ${esc(SITE.email)}.</span>`; toast("Message sent (preview)"); f.reset(); return; }
    if (t === "track") { msg.innerHTML = `<div class="summary" style="position:static;box-shadow:none;margin-top:6px"><div style="display:flex;justify-content:space-between;align-items:center"><b class="mono">${esc(f.querySelector("input").value)}</b><span class="chip good">In production</span></div><div class="lines"><div><span>Proof approved</span><span>Sep 28</span></div><div><span>Printing</span><span>Sep 30</span></div><div><span>Ready for pickup</span><span>Est. Oct 3</span></div></div><p class="tiny">Sample status — live tracking connects to the back end later.</p></div>`; return; }
    msg.innerHTML = `<span class="small">Customer accounts switch on when the back end is connected. For now, use the quote form and we’ll reply by email.</span>`;
  }));
}

/* ---------- effects ---------- */
let io;
function bindEffects(root) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  io && io.disconnect();
  root.classList.toggle("motion-ready", !reduced);
  if (!reduced && "IntersectionObserver" in window) {
    io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in-view"); io.unobserve(e.target);
        if (e.target.hasAttribute("data-count")) {
          const el = e.target, value = Number(el.dataset.count), start = performance.now();
          const tick = time => {
            if (!el.isConnected) return;
            const p = Math.min(1, (time - start) / 1100);
            const decimals=Number(el.dataset.decimals||0);
            el.textContent = (value * (1 - Math.pow(1 - p, 3))).toLocaleString("en-CA",{minimumFractionDigits:decimals,maximumFractionDigits:decimals}) + (el.dataset.suf || "");
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }
    }), { threshold: .08, rootMargin: "0px 0px -3% 0px" });
    root.querySelectorAll(".sec-head, .sec .card, .sec .feat, .work .w, .quote, .svc a, .steps-list li, .spec, .cta, .stats > div").forEach((el, i) => {
      el.setAttribute("data-scroll-entrance", "");
      el.style.transitionDelay = (i % 4) * 45 + "ms";
      if (el.getBoundingClientRect().bottom <= 0) el.classList.add("in-view"); else io.observe(el);
    });
    root.querySelectorAll("[data-count]").forEach(el => io.observe(el));
  }
}

function bindVideoStory(root) {
  const section=root.querySelector('[data-video-story]');if(!section)return;
  const video=section.querySelector('video');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  video.controls=false;video.muted=true;video.defaultMuted=true;
  let targetProgress=0,unlocking=false,lastSeekTarget=-1;
  const load=()=>{if(video.dataset.loaded)return;video.dataset.loaded='true';video.preload='auto';video.load();};
  const seek=()=>{
    if(reduced||!video.isConnected||unlocking||video.seeking||video.readyState<2||!Number.isFinite(video.duration))return;
    const target=targetProgress*Math.max(0,video.duration-.05);
    if(Math.abs(lastSeekTarget-target)>.025){try{lastSeekTarget=target;video.currentTime=target;}catch{lastSeekTarget=-1;}}
  };
  const unlock=()=>{
    if(reduced||video.dataset.unlocked||unlocking)return;
    load();unlocking=true;
    const play=video.play();
    if(play&&play.then)play.then(()=>{video.pause();video.dataset.unlocked='true';unlocking=false;seek();}).catch(()=>{unlocking=false;seek();});
    else{video.pause();unlocking=false;seek();}
  };
  const observer='IntersectionObserver' in window?new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){load();observer.disconnect();}},{rootMargin:'600px 0px'}):null;
  if(!reduced){if(observer)observer.observe(section);else load();}
  const touchUnlock=()=>{if(section.getBoundingClientRect().top<innerHeight+600)unlock();};
  window.addEventListener('touchstart',touchUnlock,{passive:true});
  section.addEventListener('pointerdown',unlock,{passive:true});
  section._scrollSeek=p=>{targetProgress=p;seek();};
  ['loadedmetadata','loadeddata','canplay'].forEach(name=>video.addEventListener(name,()=>{videoStoryTick();seek();}));
  video.addEventListener('seeked',seek);video.addEventListener('progress',seek);
  section._cleanup=()=>{observer?.disconnect();video.pause();window.removeEventListener('touchstart',touchUnlock);};
}
function videoStoryTick() {
  const section=document.querySelector('[data-video-story]');if(!section||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const r=section.getBoundingClientRect(),head=document.querySelector('.hdr')?.offsetHeight||68;
  const p=Math.max(0,Math.min(1,(head-r.top)/Math.max(1,r.height-(innerHeight-head))));
  section.querySelectorAll('[data-video-step]').forEach((step,i)=>step.classList.toggle('active',i===Math.min(2,Math.floor(p*3))));
  section._scrollSeek?.(p);
}
function revealTick() {
  videoStoryTick();
  processStoryTick();
  document.querySelectorAll("[data-reveal]").forEach(sec => {
    const r = sec.getBoundingClientRect(), stick = sec.querySelector(".stick"), vh = innerHeight;
    const sticky = getComputedStyle(stick).position === "sticky";
    let p = sticky ? -r.top / Math.max(1, r.height - (vh - 68)) : (vh - r.top) / (r.height + vh) * 1.6 - .25;
    p = Math.max(0, Math.min(1, p));
    const w = Math.max(0, Math.min(1, (p - .08) / .8)), steps = sec.querySelectorAll(".step"), n = steps.length;
    const idx = Math.min(n - 1, Math.floor(p * n * .999));
    steps.forEach((s, i) => s.classList.toggle("on", i === idx));
    sec.querySelectorAll(".meter b").forEach((b, i) => b.style.transform = `scaleX(${Math.max(0, Math.min(1, p * n - i))})`);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = reduced ? 1 : w;
    sec.style.setProperty("--wrap-progress", progress);
    const stageWidth = sec.querySelector(".stage .ph")?.getBoundingClientRect().width || 0;
    sec.style.setProperty("--edge-px", progress * stageWidth + "px");
    const edge = sec.querySelector("[data-edge]"); edge.style.opacity = !reduced && w > 0 && w < 1 ? 1 : 0;
    sec.querySelector("[data-pct]").textContent = `${Math.round(w * 100)}% applied`;
  });
}

/* ---------- render ---------- */
let current = null;
async function render(hydrate = false) {
  const oldLanguage=LANG;
  const { path, query, anchor, full } = parseLocation();
  if(oldLanguage!==LANG){document.querySelector('[data-review-carousel]')?._cleanup?.();document.querySelector('[data-video-story]')?._cleanup?.();document.getElementById('app').innerHTML=appHTML();hydrate=false;Cart.save();bindForms(document.querySelector('.ftr'));}
  const [fn, params] = match(path);
  let page = ['/login','/register','/account'].includes(path)?{title:'Your Satin account',html:hero({kicker:'Satin account',title:'Your account.',lede:'Sign in to write product reviews and access your account.',crumbs:[['Home','/'],['Account']]})+sec('<a class="btn" href="/signin-with-chatgpt?return_to=%2Fsatin%2Faccount%2F">Log in with ChatGPT</a><p class="small">Product purchases can also be completed as a guest.</p>')}:serviceUI.customPage(path) || (fn ? fn(params, query) : null); if (!page) page = PAGES.notFound();
  page=localizedPage(path,page);
  if(serviceUI.customPage(path))hydrate=false;
  const main = document.getElementById("main");
  const seeded=main.querySelector("[data-pricing-bootstrap]");
  const seededHTML=seeded?.dataset.path===location.pathname.replace(/^\/satin\/(fa|fr|es)(?=\/|$)/,"/satin").replace(/\/$/,"")?main.querySelector(".rule-cfg")?.outerHTML:null;
  if (!hydrate) {main.querySelector('[data-print-studio]')?._studioCleanup?.();main.querySelector("[data-video-story]")?._cleanup?.();main.querySelector("[data-review-carousel]")?._cleanup?.();}
  if (!hydrate) main.innerHTML = `<div class="page-enter">${imageHTML(page.html, path !== "/")}</div>`;
  main.classList.remove("x");
  updateSEO(path, page);
  document.querySelector("[data-path]").textContent = full;
  closeMega(); document.querySelector("[data-drawer]").classList.remove("open");
  if(seededHTML){main.innerHTML=replaceConfig(main.innerHTML,seededHTML);main.querySelector(".rule-cfg").after(seeded);}else if(page.cfg){const cfg=main.querySelector(".cfg");if(cfg)cfg.classList.add("pricing-pending");}
  if(page.cfg&&!seededHTML)mountCfg(main,page.cfg);
  page.init && page.init(main);
  if(page.portfolio)mountPortfolio(main,navigate);
  bindDrops(main); bindForms(main); bindEffects(main); bindVideoStory(main); bindReviewCarousel(main);
  localizeDOM(main);
  globalThis._publicTranslationObserver?.();
  globalThis._publicTranslationObserver=observeTranslations(main);
  localizeDOM(document.querySelector('.ftr'));
  document.documentElement.style.setProperty('--nav-h',(document.querySelector('.hdr')?.offsetHeight||76)+'px');
  current = page;
  if (anchor) setTimeout(() => { const t = document.getElementById(anchor); t && t.scrollIntoView({ behavior: "smooth" }); }, 80); else if (!hydrate) window.scrollTo(0, 0);
  revealTick();

  applySiteContent();
  await serviceUI.mountEnhancements(main,path).catch(console.error);
  globalThis.satinAddToCart=item=>Cart.add(item);
  import('/studio/catalog.mjs').then(m=>m.mountManagedShop(main)).catch(()=>{});
  if(!path.startsWith('/shop/products/')&&!main.querySelector('[data-print-studio]'))await pricingForms.mountPricingForm(main,{add:item=>Cart.add(item)}).catch(()=>{main.querySelector('.pricing-pending')?.classList.remove('pricing-pending');});
  applySiteContent();globalThis.__satinReady=true;window.dispatchEvent(new Event('satin-page-rendered'));
}

/* ---------- mega menu ---------- */
let megaKey = null;
function openMega(k) { const p = document.querySelector("[data-megapanel]"); if (megaKey === k) return closeMega(); megaKey = k; p.querySelector(".in").innerHTML = localizedHTML(megaHTML(k)); p.classList.add("open"); document.querySelectorAll("[data-mega]").forEach(b => b.setAttribute("aria-expanded", b.dataset.mega === k)); }
function closeMega() { megaKey = null; const p = document.querySelector("[data-megapanel]"); p && p.classList.remove("open"); document.querySelectorAll("[data-mega]").forEach(b => b.setAttribute("aria-expanded", "false")); }

/* ---------- page map (preview tool) ---------- */
function sitemapGroups() {
  return [
    ["Main", [["Home", "/"], ["Our work", "/portfolio"], ["About", "/about"], ["Contact", "/contact"], ["Reviews", "/reviews"], ["FAQ", "/faq"], ["Track", "/track"], ["Website Design", "/website-design"]]],
    ["Vehicle Wraps", [["Vehicle Wraps", "/vehicle-wraps"], ["Commercial", "/vehicle-wraps/commercial"], ...COMMERCIAL.map(c => ["— " + c.name, "/vehicle-wraps/commercial/" + c.slug]), ["Color Change", "/vehicle-wraps/color-change"], ["Paint Protection Film", "/vehicle-wraps/paint-protection-film"], ["Estimator", "/vehicle-wraps/estimator"], ...ESTIMATOR.map(e => ["— " + e.name, "/vehicle-wraps/estimator/" + e.slug])]],
    ["Print Shop", [["Print Shop", "/print-shop"], ["Offset", "/print-shop/offset"], ...OFFSET.map(o => ["— " + o.name, "/print-shop/offset/" + o.slug]), ["Large Format", "/print-shop/large-format"], ...LARGE.map(o => ["— " + o.name, "/print-shop/large-format/" + o.slug])]],
    ["Apparel", [["Apparel", "/apparel"], ...APPAREL.map(a => ["— " + a.name, "/apparel/" + a.slug])]],
    ["Windows & Walls", [["Window Graphics", "/window-graphics"], ...GLASS.map(g => ["— " + g.name, "/window-graphics/" + g.slug]), ["Window Tint", "/window-tint"], ["— Vehicle", "/window-tint/vehicle"], ["— Commercial", "/window-tint/commercial"], ["Wallpaper", "/wallpaper"]]],
    ["Shop", [["Shop", "/shop"], ["Wrap Designs", "/shop/vehicle-wrap-designs"], ...WRAP_DESIGNS.map(d => ["— " + d.name, "/shop/vehicle-wrap-designs/" + d.slug]), ["Vehicle Templates", "/shop/vehicle-templates"], ["Design Services", "/shop/design-services"], ["Wrap Prints", "/shop/vehicle-wrap-prints"], ["Materials & Tools", "/shop/materials-tools"]]],
    ["Account", [["Login", "/login"], ["Register", "/register"], ["Account", "/account"]]],
    ["Policies", Object.entries(POLICIES).map(([k, p]) => [p.t, "/" + k])],
  ];
}
function openMap() {
  const g = sitemapGroups(), n = g.reduce((a, [, l]) => a + l.length, 0);
  openModal(`<div><span class="eyebrow">Preview · page map</span><h2 class="d3" style="margin-top:8px">${n} pages under ${SITE.base}</h2><p class="small">Jump to any page. Tell Claude the path shown here when you want a page changed.</p></div>
    <div class="map-list">${g.map(([h, l]) => `<div class="grp"><h4>${h}</h4>${l.map(([t, p]) => `<a href="${href(p)}" data-close>${esc(t)}<span>${SITE.base}${p === "/" ? "" : p}</span></a>`).join("")}</div>`).join("")}</div>`, true);
}

/* ---------- boot ---------- */
function appHTML(pageHTML = "", full = "") {
  return localizedHTML(header() + `<main id="main" tabindex="-1"><div class="page-enter">${pageHTML}</div></main>` + footer() + drawer() +
    `<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="scrim" data-close></div><div class="box"><button class="icon-btn close" data-close aria-label="Close">${icon("close")}</button><div data-mbody style="display:flex;flex-direction:column;gap:20px"></div></div></div>
     <div class="toast" id="toast" role="status"></div>
     <div class="pv" aria-label="Preview tools"><span class="path" data-path>${esc(full)}</span><button class="btn sm" data-map>Page map</button></div>`);
}
function boot() {
  for(const nav of document.querySelectorAll('.hdr .nav'))if(!nav.querySelector('a[href$="/portfolio/"]'))nav.insertAdjacentHTML('beforeend',A("/portfolio","Our Work","studio-nav"));
  const migrated = migrateHash();
  const app = document.getElementById("app");
  const hydrate = !/^(\/print-shop$|\/wallpaper|\/vehicle-wraps|\/auto-detailing|\/window-graphics|\/apparel|\/shop\/vehicle-templates)/.test(parseLocation().path) && !migrated && !location.search && app.dataset.prerenderPath === parseLocation().path && !!document.getElementById("main");
  if (!document.getElementById("main")) app.innerHTML = appHTML();
  Cart.save();bindForms(document.querySelector('.ftr'));
  document.addEventListener('change',e=>{
    if(e.target.matches('[data-language]')){
      const {path,query,anchor}=parseLocation(),code=e.target.value;
      const suffix=(query.toString()?'?'+query.toString():'')+(anchor?'#'+encodeURIComponent(anchor):'');
      navigate(new URL(languageHref(path,code)+suffix,location.origin));
    }
  });
  document.addEventListener("click", e => {
    const t = e.target;
    const q = t.closest("[data-quote]"); if (q) { e.preventDefault(); closeMega(); openQuote(q.dataset.quote, q.dataset.details || "",false,q.dataset.estimate||""); return; }
    if (t.closest("[data-mega]")) { openMega(t.closest("[data-mega]").dataset.mega); return; }
    if (t.closest("[data-cart]")) { Cart.open(); return; }
    if (t.closest("[data-rm]")) { Cart.remove(t.closest("[data-rm]").dataset.rm); Cart.open(); return; }
    if (t.closest("[data-print-checkout]")) { location.assign("/satin/checkout/"); return; }
    if (t.closest("[data-cart-quote]")) { openQuote("Shop / General", "", true); return; }
    if (t.closest("[data-qnext]")) { quoteNext(); return; }
    if (t.closest("[data-qback]")) { Q.step = Math.max(0, Q.step - 1); if (Q.step === 1 && !Q.svc) Q.step = 0; renderQuote(); return; }
    if (t.closest("[data-qsvc] button")) { pressOne(t.closest("button")); return; }
    if (t.closest("[data-burger]")) { document.querySelector("[data-drawer]").classList.add("open"); return; }
    if (t.closest("[data-close-drawer]")) { document.querySelector("[data-drawer]").classList.remove("open"); return; }
    if (t.closest("[data-map]")) { openMap(); return; }
    if (t.closest("[data-close]")) { closeModal(); if (!t.closest("a[href]")) return; }
    if (t.closest("[data-skip]")) { e.preventDefault(); document.getElementById("main").focus(); return; }
    const j = t.closest("[data-jump]"); if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.jump); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const c = t.closest("[data-copy]"); if (c) { const v = c.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast("Copied " + v)).catch(() => toast(v)); return; }
    const link = t.closest("a[href]");
    if (link && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !link.hasAttribute("download") && (!link.target || link.target === "_self")) {
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && (url.pathname === SITE.base || url.pathname.startsWith(SITE.base + "/"))) {
        e.preventDefault(); closeModal(); navigate(url); return;
      }
    }
    if (megaKey && !t.closest(".hdr")) closeMega();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeMega(); document.querySelector("[data-drawer]").classList.remove("open"); } });
  let ticking = false;
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { revealTick(); ticking = false; }); } }, { passive: true });
  const headerSize=()=>{document.documentElement.style.setProperty('--nav-h',(document.querySelector('.hdr')?.offsetHeight||76)+'px');revealTick();};
  addEventListener('resize',headerSize);headerSize();
  addEventListener("popstate", () => render());
  addEventListener("hashchange", () => { if (migrateHash()) render(); });
  render(hydrate);
}
if (!globalThis.__PRERENDER__) boot();


async function applySiteContent(){
 if(window.frameElement&&new URLSearchParams(location.search).has('cms'))return;
 const generation=++contentGeneration,page=location.pathname.replace(/\/$/,'');
 try{const r=await fetch('/api/site-content?path='+encodeURIComponent(page));if(!r.ok)return;const c=await r.json();if(generation!==contentGeneration)return;applyContent(c);}
 catch(e){console.warn('Content overrides unavailable');}
}
function applyContent(c){
 import('/cms/runtime.mjs').then(m=>m.apply(document.getElementById('main'),c));
 for(const edit of c.edits||[]){let el;try{el=document.querySelector(edit.selector);}catch{continue;}if(!el)continue;if(edit.type==='text')el.textContent=edit.value;else if(edit.type==='image'&&el.tagName==='IMG'){el.removeAttribute('srcset');el.closest('picture')?.querySelectorAll('source').forEach(s=>s.remove());el.src=edit.value;}}
 const parent=document.querySelector('#main>.page-enter');if(parent){const nodes=[...parent.children];const order=c.order||[];if(order.length===nodes.length&&new Set(order).size===nodes.length&&order.every(i=>i<nodes.length))order.forEach(i=>parent.append(nodes[i]));}
 document.querySelectorAll('[data-custom-fields]').forEach(e=>e.remove());
 for(const f of document.querySelectorAll('form[data-service-request]')){const wrap=document.createElement('div');wrap.dataset.customFields='';wrap.className='grid';for(const field of c.fields||[]){const label=document.createElement('label');label.className='field';const span=document.createElement('span');span.textContent=field.label;const input=document.createElement(field.type==='textarea'?'textarea':'input');if(field.type!=='textarea')input.type=field.type;input.name='custom_'+field.key;input.required=field.required;input.maxLength=1000;label.append(span,input);wrap.append(label);}f.querySelector('.service-options')?.append(wrap);}
}
window.satinApplyContent=applyContent;
if(!globalThis.__PRERENDER__){
 let visitorId=crypto.randomUUID();
 const sendVisit=()=>{if(sessionStorage.getItem('satinAnalyticsConsent')==='yes'&&document.visibilityState==='visible'&&!window.frameElement)fetch('/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:visitorId,path:location.pathname,consent:true})}).catch(()=>{});};
 if(!window.frameElement&&!sessionStorage.getItem('satinAnalyticsConsent')){const banner=document.createElement('aside');banner.className='consent-banner';banner.setAttribute('aria-label','Visitor analytics');banner.innerHTML='<p>Allow anonymous visit measurement? This shares your current page and approximate city with Satin Graphic for this visit.</p><div><button class="btn sm" data-allow>Allow</button><button class="btn sm ghost" data-decline>Decline</button></div>';document.body.append(banner);banner.addEventListener('click',e=>{if(e.target.closest('[data-allow],[data-decline]')){sessionStorage.setItem('satinAnalyticsConsent',e.target.closest('[data-allow]')?'yes':'no');banner.remove();sendVisit();}});}
 setInterval(sendVisit,30000);sendVisit();
}

if(!globalThis.__PRERENDER__){fetch('/api/pricing').then(r=>r.ok?r.json():null).then(p=>{if(!p)return;PRICING=p;for(const vehicle of ESTIMATOR)if(Number.isFinite(p.bases?.[vehicle.slug]))vehicle.base=p.bases[vehicle.slug];}).catch(()=>{});}

})();
