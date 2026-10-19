# Satin Graphic — SEO launch checklist (satingraphic.ca)

## A. Build the production package
1. `hp/build.py`: set `ORIGIN = 'https://satingraphic.ca'` and `STAGING = False`. (`seo_pass.py` and `gen-htaccess.py` read both values from build.py.)
2. Optional: create `hp/seo-tools.json` to bake the verification/analytics tags into every page at build time, so they survive every deploy:
   `{"googleVerify": "<token>", "bingVerify": "<32-hex>", "ga4": "G-XXXXXXX", "gtm": ""}`
3. Run `bash make.sh`, then `python3 seo_audit.py /home/claude/hp/out`. The audit exits 1 on errors. A clean production run currently shows only the known PPF video 404 (see D). Then run `bash package.sh`.
4. Check the output:
   - `robots.txt` is `Allow: /` and lists both sitemaps.
   - No page has `noindex`, except account, checkout and login pages and the fr/es/fa portfolio project copies.
   - `.htaccess` has no `X-Robots-Tag`, but it does have the https/no-www 301 and the `/` → `/satin/` 301.
   - Searching `grep -r new.satingraphic.ca` finds nothing.
5. Upload `pkg/new.satingraphic.ca` to the satingraphic.ca docroot and `pkg/satin-new` beside it. Then point `config.php` at the production database.

## B. Right after go-live (same day)
1. Test that these return 301: `http://`, `www.`, `/`, and `/satin/vehicle-wraps` (no trailing slash).
2. Test that these return 200: `/satin/sitemap.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`.
3. Old Wix/other URLs: list the top URLs from the old site (in Search Console, Pages → indexed) and add a 301 for each one in `.htaccess` (via gen-htaccess.py), so none of them return 404.
4. **Admin → Business info & SEO**:
   - Fill in the postal code (it is blank, and the site does not know it) and the latitude/longitude from Google Maps.
   - Add the Google Business Profile, Facebook, Instagram and LinkedIn URLs under "Social & directory links".
   - Click **Save & update all pages**.
5. On the same admin screen, under **Search & analytics tools**:
   - Paste the Search Console HTML-tag token, the Bing `msvalidate.01` code and the GA4 ID (GTM is optional).
   - Click **Generate** for the IndexNow key, then **Save & apply to all pages**.
   - Open `https://satingraphic.ca/<key>.txt`; it should show the key.
   - Click **Submit sitemap to IndexNow**.
   - After every redeploy, open this screen. If it reports pages that are missing the current settings, press Save again (or use seo-tools.json).
6. **Google Search Console**:
   - Add a Domain property by DNS TXT record. It survives deploys, so prefer it.
   - Submit `https://satingraphic.ca/satin/sitemap.xml`.
   - Use URL Inspection → Request indexing for `/satin/`, `/satin/vehicle-wraps/`, `/satin/vehicle-wraps/commercial/`, `/satin/window-tint/` and `/satin/guides/`.
   - If the old site was on another domain, use the Change of Address tool.
7. **Bing Webmaster Tools**: import the site from Search Console and submit the sitemap. IndexNow already covers Bing.
8. Run the Rich Results Test on these pages: a city page (`/satin/vehicle-wraps/commercial/toronto/`), a guide, a priced product (`/satin/shop/dtf-transfers/`) and the home page.
9. Run PageSpeed Insights on mobile for the home page, `/satin/vehicle-wraps/` and one apparel product.
10. GA4:
    - Mark `generate_lead` (quote submit) and phone-link clicks as key events. GTM is the easiest place to add these.
    - Link GA4 to Search Console.

## C. First 8 weeks
- Weekly in Search Console, check:
  - Pages → "Crawled – currently not indexed" (watch the city × service pages and portfolio projects).
  - Enhancements.
  - Performance by query or page for "vehicle wraps <city>" terms.
- Update guide prices when estimator prices change. The tables regenerate on build; the "Updated" date follows content changes.
- Add one real project per month to the portfolio, with a short write-up (vehicle, film, city). Real case studies are the best local content.

## D. Known open items (code)
- The PPF hero video `/satin/video/gwagon-ppf.mp4` is missing (404 on every load of the PPF page; the image fallback shows). Upload the video or remove it from the hero.
- Apparel listing pages hot-link supplier photos from sinalite.com, so the first card image is lazy-loaded and external. Hosting these locally would help LCP and privacy.
- About 241 pages skip from h1 to h3 (card titles). This is cosmetic for SEO; fix it in the page templates when convenient.
- The fr/es/fa pages are mostly English in the static HTML, and translation happens client-side. Titles now carry the language name, and the hreflang pairs are correct. Server-side translated titles, descriptions and H1s would be the next step.
- The tint pages say "we recommend 35% or lighter on fronts". Ontario inspection standards for 2017+ vehicles are reported at about 70% VLT on the front side windows (see the guide), so the owner should review that wording.

## E. Off-site checklist
**Google Business Profile**
- Primary category: Vehicle wrapping service (or "Car wrapping service" if that is what the GBP list offers).
- Secondary categories: Window tinting service, Sign shop, Print shop, Graphic designer, Screen printer / T-shirt printing, Auto detailing, Car detailing service.
- Services: add each one with a short description and "from" price matching the site. These include commercial/fleet wraps, colour change, lettering & decals, PPF, vehicle tint, commercial window film, window graphics, large-format printing, business cards, apparel printing and wallpaper.
- Hours: Mon–Fri 8–6, Sat 9–3. NAP exactly as follows: "Satin Graphic", 50 Viceroy Rd, Unit 22–23, Vaughan, ON, (905) 695-9147, website `https://satingraphic.ca/satin/`.
- Photos: 3–5 new shop and job photos per week for the first month, then weekly.
- Posts: one per week (finished job, seasonal tip, a link to a guide).
- Q&A: seed with real customer questions.
- Products: estimator vehicle types with "from" prices.

**Other profiles**
- Bing Places (import from GBP).
- Apple Business Connect: claim the place, add the logo, hours and categories, and Showcases.

**Citations (identical NAP everywhere)**
- Yelp.ca, Yellow Pages (yp.ca), Canada411, Cylex, Hotfrog, Foursquare, n49, Find-us-here, Opendi.
- Facebook and Instagram business pages, LinkedIn company page.
- Better Business Bureau (optional).
- Vaughan Chamber of Commerce directory.
- Houzz, for wallpaper and window film.

**Reviews**
- Ask every customer at pickup: send a direct GBP review link by SMS or email the same day.
- Add a QR code card at the counter.
- Reply to every review within 48 hours. Never incentivize or gate reviews.
- Mention the city and service naturally in replies.

**Backlinks**
- Manufacturer installer locators: 3M (Certified Graphics Installer / 3M Preferred), Avery Dennison (Certified Wrap Installer / Avery Dennison Supreme Wrapping Film installer map), XPEL and STEK dealer locators, and the window-film brands carried. Get listed once certified.
- Vaughan Chamber of Commerce and York Region business directories, BIA (business improvement area) listings.
- Local sponsorships with a link: minor sports teams, school events, charity car shows.
- Supplier and partner "featured installer" pages.
- Customer fleets: ask commercial clients for a "vehicle graphics by Satin Graphic" credit link.
- Local press for notable fleet rollouts.
- Guest guides, e.g. "Ontario tint law" for local car clubs and dealerships.
