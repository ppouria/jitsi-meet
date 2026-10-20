package main

import (
	"bytes"
	"crypto/rand"
	"embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"text/template"
)

//go:embed templates/*.tmpl
var templateFS embed.FS

// settings are read from the environment. The installer writes them into the systemd unit.
type settings struct {
	PublicHost  string // host name or IP address that browsers use; it serves HTTPS
	Domain      string // XMPP domain for conferences, for example meet.local
	AuthDomain  string // "auth." + Domain, where the focus and JVB accounts live
	HTTPSListen string // address for the HTTPS listener, for example :443
	UDPPort     int    // Videobridge media port (ICE over UDP)
}

var (
	hostRe   = regexp.MustCompile(`^[A-Za-z0-9.-]+$`)
	domainRe = regexp.MustCompile(`^[a-z0-9][a-z0-9.-]*[a-z0-9]$`)
)

func settingsFromEnv() (settings, error) {
	s := settings{
		PublicHost:  os.Getenv("JITSI_PUBLIC_HOST"),
		Domain:      envOr("JITSI_XMPP_DOMAIN", "meet.local"),
		HTTPSListen: envOr("JITSI_HTTPS_LISTEN", ":443"),
	}
	if !hostRe.MatchString(s.PublicHost) {
		return s, fmt.Errorf("JITSI_PUBLIC_HOST must be a host name or IP address, got %q", s.PublicHost)
	}
	if !domainRe.MatchString(s.Domain) {
		return s, fmt.Errorf("JITSI_XMPP_DOMAIN must be a lower-case domain name, got %q", s.Domain)
	}
	port, err := strconv.Atoi(envOr("JITSI_UDP_PORT", "10000"))
	if err != nil || port < 1 || port > 65535 {
		return s, fmt.Errorf("JITSI_UDP_PORT must be a port number")
	}
	s.UDPPort = port
	s.AuthDomain = "auth." + s.Domain
	return s, nil
}

func envOr(name, def string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return def
}

// secrets are the passwords of the focus and JVB accounts. They are made on the first start.
type secrets struct {
	FocusPassword string `json:"focus_password"`
	JVBPassword   string `json:"jvb_password"`
}

func loadOrCreateSecrets(path string) (*secrets, error) {
	if b, err := os.ReadFile(path); err == nil {
		var s secrets
		if err := json.Unmarshal(b, &s); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		if s.FocusPassword != "" && s.JVBPassword != "" {
			return &s, nil
		}
	}
	s := &secrets{FocusPassword: randomSecret(), JVBPassword: randomSecret()}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return nil, err
	}
	return s, os.WriteFile(path, b, 0o600)
}

func randomSecret() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err) // the system random source does not fail in practice; a broken one must stop the start
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// templateData is the shared input of the Prosody, Jicofo and Videobridge templates.
type templateData struct {
	settings
	AppDir        string
	DataDir       string
	FocusPassword string
	JVBPassword   string
}

// writeConfigs renders the three server configs into dir and patches the web app's config.js.
func writeConfigs(s settings, sec *secrets, appDir, dataDir string) (prosodyCfg, jicofoCfg, jvbCfg string, err error) {
	conf := filepath.Join(dataDir, "conf")
	// Prosody looks for its certs folder even when it serves no TLS, so it is created here.
	if err := os.MkdirAll(filepath.Join(conf, "certs"), 0o755); err != nil {
		return "", "", "", err
	}
	d := templateData{settings: s, AppDir: appDir, DataDir: dataDir, FocusPassword: sec.FocusPassword, JVBPassword: sec.JVBPassword}
	files := map[string]string{
		"prosody.cfg.lua": "prosody.cfg.lua.tmpl",
		"jicofo.conf":     "jicofo.conf.tmpl",
		"jvb.conf":        "jvb.conf.tmpl",
	}
	paths := map[string]string{}
	for out, tmplName := range files {
		body, err := renderTemplate(tmplName, d)
		if err != nil {
			return "", "", "", err
		}
		p := filepath.Join(conf, out)
		if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
			return "", "", "", err
		}
		paths[out] = p
	}
	src, err := os.ReadFile(filepath.Join(appDir, "web", "config.js.orig"))
	if err != nil {
		return "", "", "", err
	}
	if err := os.WriteFile(filepath.Join(appDir, "web", "config.js"), []byte(patchConfigJS(string(src), s)), 0o644); err != nil {
		return "", "", "", err
	}
	return paths["prosody.cfg.lua"], paths["jicofo.conf"], paths["jvb.conf"], nil
}

func renderTemplate(name string, data any) (string, error) {
	t, err := template.ParseFS(templateFS, "templates/"+name)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// patchConfigJS points the web app at this server. The upstream file names the example host in three
// places: BOSH and websocket URLs (the public host) and the XMPP domain of the conference rooms.
func patchConfigJS(src string, s settings) string {
	out := strings.ReplaceAll(src, "https://jitsi-meet.example.com/", "https://"+s.PublicHost+"/")
	out = strings.ReplaceAll(out, "wss://jitsi-meet.example.com/", "wss://"+s.PublicHost+"/")
	return strings.ReplaceAll(out, "jitsi-meet.example.com", s.Domain)
}
