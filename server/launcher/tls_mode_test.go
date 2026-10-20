package main

import (
	"strings"
	"testing"
)

func TestPatchConfigJSHTTPMode(t *testing.T) {
	t.Parallel()
	src := "domain: 'jitsi-meet.example.com',\n" +
		"bosh: 'https://jitsi-meet.example.com/' + subdir + 'http-bind',\n" +
		"websocket: 'wss://jitsi-meet.example.com/' + subdir + 'xmpp-websocket',"
	got := patchConfigJS(src, settings{PublicHost: "10.0.0.5", Domain: "meet.local", TLSMode: "http"})
	for _, want := range []string{"domain: 'meet.local'", "bosh: 'http://10.0.0.5/' + subdir", "websocket: 'ws://10.0.0.5/' + subdir"} {
		if !strings.Contains(got, want) {
			t.Errorf("http mode config.js lacks %q:\n%s", want, got)
		}
	}
}

func TestPatchConfigJSTurnsOffAccountService(t *testing.T) {
	t.Parallel()
	got := patchConfigJS("accountServiceUrl: '/account/api',", settings{PublicHost: "10.0.0.5", Domain: "meet.local", TLSMode: "internal"})
	if got != "accountServiceUrl: ''," {
		t.Errorf("accountServiceUrl not blanked: %q", got)
	}
}

func TestSettingsRejectUnknownTLSMode(t *testing.T) {
	t.Setenv("JITSI_PUBLIC_HOST", "10.0.0.5")
	t.Setenv("JITSI_TLS", "plain")
	if _, err := settingsFromEnv(); err == nil {
		t.Error("settingsFromEnv accepted an unknown JITSI_TLS value")
	}
}
