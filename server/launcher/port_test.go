package main

import (
	"strings"
	"testing"
)

// The web app must call the port the server listens on, or its BOSH connection fails.
func TestPatchConfigJSKeepsACustomPort(t *testing.T) {
	src := "serviceUrl: 'https://jitsi-meet.example.com/http-bind'"
	got := patchConfigJS(src, settings{PublicHost: "94.184.37.80", Domain: "meet.local", TLSMode: "internal", HTTPSListen: ":8443"})
	if !strings.Contains(got, "https://94.184.37.80:8443/http-bind") {
		t.Fatalf("custom port missing from the BOSH URL: %s", got)
	}
	got = patchConfigJS(src, settings{PublicHost: "94.184.37.80", Domain: "meet.local", TLSMode: "internal", HTTPSListen: ":443"})
	if !strings.Contains(got, "https://94.184.37.80/http-bind") {
		t.Fatalf("default port must not be written: %s", got)
	}
	got = patchConfigJS("serviceUrl: 'https://jitsi-meet.example.com/http-bind'", settings{PublicHost: "10.0.0.5", Domain: "meet.local", TLSMode: "http", HTTPListen: ":8080"})
	if !strings.Contains(got, "http://10.0.0.5:8080/http-bind") {
		t.Fatalf("http mode should use its own port: %s", got)
	}
}
