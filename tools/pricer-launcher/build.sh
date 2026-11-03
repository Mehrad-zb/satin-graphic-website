#!/bin/sh
# Builds SatinPricer.exe and SatinAdmin.exe (+ their launcher*.json auto-update manifests) into ./out
# Bump VERSION for every new release: running copies update themselves on their next start.
set -e
VERSION=${VERSION:-2}
cd "$(dirname "$0")"; mkdir -p out
build() { # name url manifest ico
  tmp=$(mktemp -d); cp main.go go.mod "$tmp/"; python3 mksyso.py "$4" "$tmp/rsrc_windows_amd64.syso" >/dev/null
  (cd "$tmp" && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
    -ldflags "-H=windowsgui -s -w -X main.appURL=$2 -X main.manifestURL=$3 -X main.appVersion=$VERSION" -o "$OLDPWD/out/$1.exe" .)
  rm -rf "$tmp"
  printf '{"version":%s,"url":"https://satingraphic.ca/pricer/%s.exe","sha256":"%s"}\n' "$VERSION" "$1" "$(sha256sum "out/$1.exe" | cut -d' ' -f1)" > "out/$(basename "$3")"
  echo "built out/$1.exe"
}
build SatinPricer https://satingraphic.ca/pricer/ https://satingraphic.ca/pricer/launcher.json satin-pricer.ico
build SatinAdmin https://satingraphic.ca/admin/ https://satingraphic.ca/pricer/launcher-admin.json satin-admin.ico
