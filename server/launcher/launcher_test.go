package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestPatchConfigJS(t *testing.T) {
	t.Parallel()
	src := "domain: 'jitsi-meet.example.com', muc: 'conference.' + subdomain + 'jitsi-meet.example.com',\n" +
		"bosh: 'https://jitsi-meet.example.com/' + subdir + 'http-bind',\n" +
		"websocket: 'wss://jitsi-meet.example.com/' + subdir + 'xmpp-websocket',"
	got := patchConfigJS(src, settings{PublicHost: "94.184.37.80", Domain: "meet.local"})
	for _, want := range []string{
		"domain: 'meet.local'",
		"muc: 'conference.' + subdomain + 'meet.local'",
		"bosh: 'https://94.184.37.80/' + subdir + 'http-bind'",
		"websocket: 'wss://94.184.37.80/' + subdir + 'xmpp-websocket'",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("patched config.js lacks %q:\n%s", want, got)
		}
	}
	if strings.Contains(got, "example.com") {
		t.Errorf("the example host is still in config.js:\n%s", got)
	}
}

func TestArchivePathRefusesDotDot(t *testing.T) {
	t.Parallel()
	if _, err := archivePath("/opt/jitsi-meet", "app/../../etc/passwd"); err == nil {
		t.Error("archivePath accepted a name with ..")
	}
	got, err := archivePath("/opt/jitsi-meet", "app/lua/bin/lua")
	if err != nil || got != filepath.Join("/opt/jitsi-meet", "app", "lua", "bin", "lua") {
		t.Errorf("archivePath(app/lua/bin/lua) = %q, %v", got, err)
	}
}

func TestWithinRejectsEscape(t *testing.T) {
	t.Parallel()
	root := "/opt/jitsi-meet"
	if within(root, filepath.Join(root, "app", "lib", "..", "..", "..", "etc")) {
		t.Error("a symlink target that climbs out of the install root was accepted")
	}
	if !within(root, filepath.Join(root, "app", "lua", "bin", "lua")) {
		t.Error("a path under the install root was refused")
	}
}

func TestRenderTemplatesFillsEveryPlaceholder(t *testing.T) {
	t.Parallel()
	s := settings{PublicHost: "94.184.37.80", Domain: "meet.local", AuthDomain: "auth.meet.local", HTTPSListen: ":443", UDPPort: 10000}
	d := templateData{settings: s, AppDir: "/opt/jitsi-meet/app", DataDir: "/opt/jitsi-meet/data", FocusPassword: "f", JVBPassword: "j"}
	for _, name := range []string{"prosody.cfg.lua.tmpl", "jicofo.conf.tmpl", "jvb.conf.tmpl"} {
		out, err := renderTemplate(name, d)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if strings.Contains(out, "{{") {
			t.Errorf("%s has an unfilled placeholder", name)
		}
	}
}

func TestSettingsRejectBadHost(t *testing.T) {
	t.Setenv("JITSI_PUBLIC_HOST", "bad host;rm")
	if _, err := settingsFromEnv(); err == nil {
		t.Error("settingsFromEnv accepted a host name with spaces and punctuation")
	}
}
