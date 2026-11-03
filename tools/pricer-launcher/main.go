// Satin launcher (SatinPricer.exe and SatinAdmin.exe): opens a satingraphic.ca app as its own window (Edge or Chrome app mode).
// Auto-update: after opening the window it reads https://satingraphic.ca/pricer/launcher.json; when that names a
// newer version it downloads the new EXE, checks its SHA-256, and swaps it in place (the running file is renamed
// to SatinPricer.exe.old, which the next start removes). The new version runs from the next start.
// The price app itself is always live from the website, so it never needs the EXE to change.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// set per app at build time with -ldflags "-X main.appURL=… -X main.manifestURL=…" (see build.sh)
var (
	appURL      = "https://satingraphic.ca/pricer/"
	manifestURL = "https://satingraphic.ca/pricer/launcher.json"
	appVersion  = "2"
)

type manifest struct {
	Version int    `json:"version"`
	URL     string `json:"url"`
	SHA256  string `json:"sha256"`
}

func main() {
	self, _ := os.Executable()
	if self != "" {
		os.Remove(self + ".old") // leftover from the last update
	}
	openApp()
	if self != "" {
		update(self)
	}
}

func openApp() {
	var browsers []string
	for _, env := range []string{"ProgramFiles(x86)", "ProgramFiles", "LocalAppData"} {
		base := os.Getenv(env)
		if base == "" {
			continue
		}
		browsers = append(browsers,
			filepath.Join(base, "Microsoft", "Edge", "Application", "msedge.exe"),
			filepath.Join(base, "Google", "Chrome", "Application", "chrome.exe"))
	}
	for _, b := range browsers {
		if _, err := os.Stat(b); err != nil {
			continue
		}
		cmd := exec.Command(b, "--app="+appURL, "--window-size=1440,900")
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		if cmd.Start() == nil {
			return
		}
	}
	// no Edge/Chrome found: open in the default browser
	exec.Command("rundll32", "url.dll,FileProtocolHandler", appURL).Start()
}

func update(self string) {
	c := &http.Client{Timeout: 60 * time.Second}
	r, err := c.Get(manifestURL)
	if err != nil {
		return
	}
	var m manifest
	err = json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&m)
	r.Body.Close()
	if err != nil || m.Version <= atoi(appVersion) || m.SHA256 == "" || !strings.HasPrefix(m.URL, "https://satingraphic.ca/") {
		return
	}
	r, err = c.Get(m.URL)
	if err != nil {
		return
	}
	defer r.Body.Close()
	if r.StatusCode != 200 {
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 64<<20))
	if err != nil || len(data) < 1024 {
		return
	}
	sum := sha256.Sum256(data)
	if !strings.EqualFold(hex.EncodeToString(sum[:]), m.SHA256) {
		return // damaged or wrong download: keep the current version
	}
	tmp := self + ".new"
	if os.WriteFile(tmp, data, 0o755) != nil {
		return
	}
	os.Remove(self + ".old")
	if os.Rename(self, self+".old") != nil { // Windows allows renaming a running EXE
		os.Remove(tmp)
		return
	}
	if os.Rename(tmp, self) != nil {
		os.Rename(self+".old", self) // put the old one back
	}
}

func atoi(s string) int { n, _ := strconv.Atoi(s); return n }
