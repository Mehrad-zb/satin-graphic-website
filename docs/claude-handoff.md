# Continue the Satin website

## Current integrated website — October 6, 2026

The owner subsequently requested the apparel editor inside the main website. Version 32 removes every T-shirt redirect to the separate studio. Product options, private uploads, saved designs, approvals and the return to the product page now use the main site's existing workflow. T-shirts use the original flat garment photograph with no human models; other apparel uses blank garment illustrations. Artwork / My Files / Designs tabs, quick text, name, number and the sample Satin logo are available in the apparel editor. PNG, JPG, WebP and safe SVG uploads are supported.

Main T-shirt editor: https://satin-graphic-website.mehrad-tr.chatgpt.site/satin/design-studio/?product=apparel-men-g500

Version 32 also removes the top Home promotional slider and places Log in beside the header cart in all 377 pre-rendered public pages and the client-rendered header. Offset product templates no longer reference undefined vehicle-design state. Apparel routes now match complete path segments, so `/apparel-ui.mjs`, `/apparel-data.mjs` and `/apparel-colours.mjs` return JavaScript instead of apparel-page HTML. Source commit: `cafd3e570e77e38194cf7d6953a8de03df15fcdd`. Existing data has not been deleted.

## Verified starting point

- Published website: https://satin-graphic-website.mehrad-tr.chatgpt.site
- Admin login: https://satin-graphic-website.mehrad-tr.chatgpt.site/admin/login
- Site project: `appgprj_6ac142017f40819191489e0d0deace96`
- Latest published version: 32
- Exact current Site source commit: `cafd3e570e77e38194cf7d6953a8de03df15fcdd`
- GitHub repository: https://github.com/Mehrad-zb/satin-graphic-website

The GitHub handoff copies that source tree, excluding its environment-specific `node_modules` symlink, and adds these handoff documents. GitHub history is preserved. Dependencies should be installed locally when needed rather than using the original temporary dependency path.

## What is already present

Website and admin, product/pricing/form management, page and menu editing, portfolio/gallery, print and apparel design flows, private artwork storage, checkout and payment adapter code. Version 29 fixes public navigation, portfolio editing, editor IDs, apparel category state, wallpaper composition, promotions and material images. See `docs/october-2026-update.md` for the detailed implemented changes and limitations.

## Remaining work and required inputs

1. Review the owner's complete request attachment against the implementation. It was supplied in the earlier chat but is not available in this export. Do not infer that this summary captures every requested change.
2. Perform visual and interactive browser QA, including mobile layouts, the public website, admin editors, product forms, wallpaper and artwork/mockup flows. Earlier browser QA for the final version was unverified.
3. Connect and verify the actual Square/PayPal merchant accounts, signed webhooks, authoritative amounts and idempotency. Existing automated provider tests use mocks; payments are not confirmed live. Read `docs/checkout-activation.md`.
4. Complete customer authentication/account access with verified customer identity. The requested Sinalite private customer dashboard was not inspected. Request a reference screenshot/access if visual parity is needed.
5. Connect shipping with verified origin, package dimensions/weights, credentials and actual carrier rates. UPS activation remains outstanding; the current adapter documentation describes Shippo. Resolve the owner's intended carrier integration before implementation.
6. Obtain exact supplier prices, supported sizes and original templates for custom flyers/postcards. Those prices remain quote-only when supplier values are unavailable.
7. Obtain licensed digital designs/vector originals and previews before enabling their sales. Replace illustrative wrap gallery/mockup assets with approved real assets where requested.
8. Review garment colour previews, embroidery and product-specific mockups against the owner's expectations. Embroidery visuals do not provide production digitization files.
9. New wallpaper room photos need matching wall masks/foreground assets. Test positioning, zoom, upload and reset on each scene.

## Runtime and data

The Site manifest binds D1 as `DB` and R2 as `FILES`. This repository includes schema and migrations, not live customer records, invoices, orders, uploads or database-backed admin changes. The existing Site retains those records. Do not create destructive migrations or replace saved settings with defaults.

Admin identity uses the Sites hosting context and a server-side temporary-session mechanism. Passwords and signing keys must remain outside the repository. Public/customer identity and owner/admin identity are distinct. A deployment on another host must implement equivalent trusted sessions rather than trusting arbitrary identity headers.

## Verification on handoff

Version 32 passed all 24 automated test entries locally. Additional regressions execute all five Offset templates, verify apparel JavaScript routing, and exercise private JPEG/WebP uploads. Local browser QA verified the integrated apparel editor, text/name controls, sample-logo upload, file and saved-design tabs, colour changes, mockup generation and approval returning to the same product with its options. Browser navigation into Business Cards now displays the product form without errors. This does not establish merchant acceptance, carrier connectivity or exhaustive QA of unrelated sections.

Use `npm test` and `npm run build` with Node 24+. Existing code is in versioned Worker/static output; preserve assets and inspect the build verifier before adopting a different framework.

## Publishing

Committing/pushing to GitHub does not update the current live Site automatically. Return reviewed changes to the owner for publication through the existing Sites workflow. Moving hosts requires explicit hosting setup, auth, data migration and secrets configuration.
