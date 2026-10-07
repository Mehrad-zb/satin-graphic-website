# Satin update — 6 October 2026

Admin: `/admin/`. The owner signs in using the existing authenticated account.

- **Services**: edit daily promotion slides, text, image, link and button; drag slides to reorder.
- **Menus**: edit every menu and submenu; publish the navigation changes.
- **Products**: edit descriptions, galleries, artwork requirements, templates, stock and product availability. Upload downloadable design files. Vector templates have their own file and preview controls; new templates default to CAD $25.
- **Pricing forms**: edit field labels, options, order, ranges, constants, calculation formula and tax/deposit settings. Test an example in the panel before saving. Updated forms preserve subsequent owner edits.
- **Web editor**: click page text/images to edit existing content; use the existing page editor to arrange sections.
- **Template requests**: find requests for missing vehicle vectors in the separate request tab.

Full wraps were reduced by 10% while decal pricing was preserved. Transit short-wheelbase low-roof full wrap without the roof starts at $3,200 before tax and optional design. Lawn signs use the supplied table × 1.40, plus $50 when design is selected. Large format design is $100; apparel $30; wallpaper $150. Wrap prints use $8/sq ft, decals $12 for 3M or $10 for Arlon, optional $100 delivery and 20% rush surcharge.

Products with confirmed prices use Cart → Shipping → Payment. File uploads and preflight checks now appear on product pages. A customer may accept print-file warnings; cut-decal/wrap-print vector dimensions are enforced separately. Files remain private. Download links require a confirmed paid order and the browser session used for purchase.

Customer reviews require authenticated login. Five-star example text is explicitly labelled as demonstration content, never attributed to invented customers.

## Dependencies and limitations

- Payment credentials must be connected before real payments can succeed. Payment adapters were tested with mocked Square/PayPal responses, not real charges.
- UPS carrier quotes require the shipping integration credentials. GTA delivery remains $50 for ordinary physical shop orders.
- Sinalite blocked public supplier pricing/template retrieval. Custom flyer/postcard prices remain quote-only until exact supplier costs and supported dimensions are entered. The custom formula multiplies those costs by two; it does not infer a supplier price.
- Digital designs/templates need the owner's licensed files and previews uploaded before sales. Default wrap-design gallery vehicles are illustrative SVG previews; replace with real rendered multi-angle portfolio assets as available.
- Apparel previews use the selected garment colour with higher-resolution canvas output and official Gildan supplementary model photos. Embroidery is illustrative; it is not a stitch production simulation or embroidery digitization file.
- Wallpaper masks the empty wall of the supplied room scene. Other room photographs need their own wall mask/foreground preparation.
- Ontario front-window tint guidance is stricter than the requested “below 20%” warning. The UI warns for front-side choices below 70% VLT; a waiver is not shown as authorization for an unlawful installation.

Validation: 15 automated test entries passed, including owner protection, persistent admin forms, checkout/private uploads, authoritative pricing, multiple files, supplier-price fallback, review login and vector-scale checks. All authored JavaScript parsed successfully and the production archive passed the packaging size check. Visual browser interaction has not been verified in this environment.


## Resumed validation and fixes

Public navigation no longer references an undefined DEFAULT_NAVIGATION. Opening an Our Work editor no longer runs unrelated promotion code. New Web Editor nodes receive unique IDs while existing IDs are preserved. Apparel category state is respected; Workwear filters relevant existing garments. Wallpaper accepts images only and provides a photographed foreground layer, room-specific wall mask, zoom down to 25%, dragging and reset. Promotion appearance/timing and partner video plan content persist through service settings. DTF includes transfer-by-size and gang-sheet formats. Vector preflight rejects raster-bearing SVG and PDF files without printable paths.

The existing 15 checks and five regression checks passed. Browser interaction and full visual/mobile QA remain unverified because the required browser workflow skill is unavailable. Original supplier templates/custom prices, licensed digital assets, exact garment/embroidery previews and real payment/UPS activation remain dependencies rather than completed live integrations. Unverified Zeus package prices were replaced by quote-only, editable plan text.

Flat Matte and Texture cards now use generated, unbranded material sample images. They are labelled illustrative and do not represent an exact supplier substrate.
