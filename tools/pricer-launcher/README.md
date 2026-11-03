# Satin Windows apps (SatinPricer.exe + SatinAdmin.exe)

One small Go launcher, built twice:
- `SatinPricer.exe` opens https://satingraphic.ca/pricer/ in its own app window (Edge, else Chrome, `--app=` mode).
- `SatinAdmin.exe` opens https://satingraphic.ca/admin/ the same way.

The pages are always live from the website, so price and admin changes never need a new EXE.

Auto-update of the EXE itself: on every start the launcher reads `/pricer/launcher.json` (or `launcher-admin.json`).
When its `version` is higher than the built-in one, it downloads the new EXE, checks the SHA-256 and swaps it in place;
the new version runs from the next start.

Release: `VERSION=3 ./build.sh` → upload `out/*.exe` and `out/launcher*.json` to `public_html/pricer/`.
`mksyso.py` turns an .ico into the icon resource (`rsrc_windows_amd64.syso`) without extra tools.
