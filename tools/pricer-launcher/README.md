# Satin Pricer launcher (Windows)

`SatinPricer.exe` opens https://satingraphic.ca/pricer/ in its own app window (Edge, else Chrome, `--app=` mode).
Prices always come live from the website; the EXE never needs updating for price changes.

Build (any OS with Go):

    GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-H=windowsgui -s -w" -o SatinPricer.exe .

`rsrc_windows_amd64.syso` holds the app icon (built from `satin-pricer.ico`); Go links it automatically.
The built EXE is also served at https://satingraphic.ca/pricer/SatinPricer.exe for the shop computers.
