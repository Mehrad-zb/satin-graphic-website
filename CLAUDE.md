# Satin website handoff

This checkout contains the latest published Satin Site version 29, retrieved and verified on October 6, 2026. Continue this project rather than rebuilding it.

Read `docs/claude-handoff.md`, `docs/october-2026-update.md`, `docs/checkout-activation.md` and the relevant tests before editing. The original full user request attachment is not included; ask the owner for it before claiming every requested item is complete.

The application is a Cloudflare-compatible Worker with static assets. Editable implementation is primarily `dist/server/` and `dist/client/`; these directories are intentionally versioned. Database schema/migrations are in `db/` and `drizzle/`. Do not discard the static assets or assume a missing React source tree can regenerate them.

Use Node 24 or newer. Run `npm test` and `npm run build` for implementation changes. Preserve authorization, private artwork files, authoritative server prices, draft/publish separation and verified payment webhooks. Keep `dist/server/studio-model.mjs` synchronized with its client model when changing it.

No production credentials or customer database/file-store exports are included. Configure secrets in the hosting environment. Do not enable real payments, shipping, OAuth or digital sales without the actual merchant configuration, rates and licensed assets.

The existing publication is hosted through Sites. A GitHub push alone does not deploy it. Coordinate publication with the owner through the existing hosting workflow; another host needs its own secure authorization and D1/R2 equivalents.
