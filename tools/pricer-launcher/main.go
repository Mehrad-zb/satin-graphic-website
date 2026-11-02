// Satin Pricer launcher: opens https://satingraphic.ca/pricer/ as its own app window (Edge or Chrome app mode).
package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

const appURL = "https://satingraphic.ca/pricer/"

func main() {
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
