# Online print checkout

Print products use upload → file confirmation → cart → shipping → payment. Product selections control design charges; checkout does not add a design fee. Defaults: offset $100, window graphics $150, vehicle estimator $250. Admin product pricing controls the configured amounts.

Payment integrations are implemented, but production payments remain disabled until merchant credentials, webhooks and a real merchant sandbox test are complete. No payment secrets are included in the source. Google/Apple/email customer authentication is a separate integration and is not active.

## Merchant configuration

Set secrets in the site's runtime environment, never in source or browser code.

Square: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY`, optionally `SQUARE_WEBHOOK_URL` for the exact externally registered webhook URL. Set `SQUARE_ENVIRONMENT=sandbox` for merchant sandbox testing; otherwise the live API is used. Webhook path: `/api/payments/webhook/square`; subscribe to payment updates. API version: 2026-09-16.

PayPal: `PAYPAL_CLIENT_ID`, secret `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`. Set `PAYPAL_ENVIRONMENT=sandbox` for merchant sandbox testing; otherwise the live API is used. Webhook path: `/api/payments/webhook/paypal`; subscribe to payment capture completion. The server verifies provider signatures, order ownership, currency and amount. Captures run only after buyer approval and use an idempotency key.

Set `CHECKOUT_PAYMENTS_ENABLED=true` only after testing the connected merchant account. A gateway becomes available only when its credentials and webhook verification configuration are present. Local tests use mocked gateway responses; they do not verify merchant acceptance or charge a card.

The delivery address and ordered price are frozen in a private order snapshot. A redirect or client-supplied amount cannot mark an order paid. Verified paid orders appear in Admin → Requests as Print checkout, with the artwork and production review status. Printing still requires artwork preflight; effective image DPI, CMYK and fonts are flagged for review rather than falsely approved.

Ontario orders and shop pickup use 13% HST. Configure `CHECKOUT_TAX_RATES_JSON` for other provinces after confirming the business's applicable tax registrations. Unsupported delivery provinces are blocked at payment. Finite-stock products require inventory reservation before enabling their checkout; they are currently blocked at payment. Refunds and disputes are managed in the merchant provider; automated refund synchronization is a subsequent integration.

## Shipping

Pickup is free. Eligible GTA addresses receive $50 next-business-day delivery before tax, after production is complete. Carrier calculation uses `SHIPPO_API_KEY`, `SHIPPING_ORIGIN_JSON`, and `SHIPPING_PACKAGES_JSON` keyed by `ruleId:quantity`. Actual packed weights and dimensions are required. Carrier rates are refreshed before payment if the selected rate is older than 30 minutes.

## Owner editing

Admin → Catalog → Products → Edit product controls description, Details, File Prep steps, reviews, PDF downloads and pricing. Upload additional PDFs, edit their labels, remove them, then Save product. An empty template list stays empty. Local template assets are served from `/print-templates/`; external supplier guide URLs are rejected.

Admin → Website Editor → Menus controls main menu labels, page links, visibility, order and submenu groups/links. Publish menus applies navigation to desktop and mobile across all pages. Page content still has its own draft/publish workflow. The page picker uses page/product names rather than marketing section headings.

## Verification

`npm test` (Node 24+) exercises real SQLite migrations, session ownership, artwork validation, authoritative pricing, stale revisions, GTA boundaries, gateway idempotency, provider amount checks, webhook verification, paid order persistence, menu ownership and template editing/removal. `npm run build` validates authored Worker/static output and packaging limits. Checkout DOM was also exercised with a simulated PDF renderer; this is not a live card or visual browser test.
