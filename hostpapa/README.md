# HostPapa version (satingraphic.ca)

The live site runs on HostPapa (cPanel, PHP 8 + SQLite), not on Sites/Cloudflare.

- `php/docroot/` – files that go into `public_html/` on top of the static build (admin panel, API entry, CMS, invoice page).
- `php/satin-new/` – PHP backend (`/home/satin617/satin-new`): API, admin API, catalog, pricing, checkout, e-sign, push, mail.
  `storage/` (SQLite database) and `wrap-designs/` (large design files) are not in git.
- `data/` – catalog data published with the site (price rules, products, navigation, wrap price slots, seeds).
- `scripts/` – build and deploy tools: `build.py` renders `dist/client` into static pages, `package.sh` assembles the
  upload package, `mkzips_list.py` makes deploy zips, `wrap-price-slots.py` marks every wrap price in the pages so
  Admin → Wrap estimator updates them, `search-index-build.py` builds the header search index.

`dist/client/` in the repo root is the shared front-end source used by both versions.
