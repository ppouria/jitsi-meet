// Command jitsi-meet-server runs a complete Jitsi Meet server from one binary: Prosody (XMPP), Jicofo
// (the conference focus), Videobridge (the media server) and the web app behind HTTPS. It runs as the
// jitsi-meet user, which systemd gives the right to bind port 443. Settings come from the environment.
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

// installRoot is fixed because Prosody and the Lua rocks store absolute paths from the build.
const installRoot = "/opt/jitsi-meet"

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	if os.Geteuid() == 0 {
		return fmt.Errorf("run as the jitsi-meet user, not as root: Prosody refuses to start as root")
	}
	s, err := settingsFromEnv()
	if err != nil {
		return err
	}
	app := filepath.Join(installRoot, "app")
	data := filepath.Join(installRoot, "data")
	if err := os.MkdirAll(filepath.Join(data, "jvb"), 0o755); err != nil {
		return err
	}
	if err := unpackPayload(installRoot); err != nil {
		return fmt.Errorf("unpack: %w", err)
	}
	sec, err := loadOrCreateSecrets(filepath.Join(data, "secrets.json"))
	if err != nil {
		return err
	}
	caPath, err := ensureTLS(filepath.Join(data, "tls"), s.PublicHost)
	if err != nil {
		return fmt.Errorf("tls: %w", err)
	}
	prosodyCfg, jicofoCfg, jvbCfg, err := writeConfigs(s, sec, app, data)
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}
	log.Printf("browsers that open the page must trust the CA certificate %s", caPath)

	env := runtimeEnv(app)
	lua := filepath.Join(app, "lua", "bin", "lua")
	prosodyBin := filepath.Join(app, "prosody", "bin", "prosody")
	prosodyctl := filepath.Join(app, "prosody", "bin", "prosodyctl")
	java := filepath.Join(app, "jre", "bin", "java")

	// Accounts are written to the Prosody data folder, so Prosody does not need to be running yet.
	// A failure is logged and not fatal, because the account may already exist from an earlier start.
	for _, acc := range []struct{ user, pass string }{{"focus", sec.FocusPassword}, {"jvb", sec.JVBPassword}} {
		cmd := exec.Command(lua, prosodyctl, "--config", prosodyCfg, "register", acc.user, s.AuthDomain, acc.pass)
		cmd.Env = env
		if out, err := cmd.CombinedOutput(); err != nil {
			log.Printf("register %s@%s: %v: %s", acc.user, s.AuthDomain, err, strings.TrimSpace(string(out)))
		}
	}

	exits := make(chan exit, 8)
	alive := map[string]*child{}
	defer stopAll(alive, exits)
	start := func(name, bin string, args ...string) error {
		c, err := startChild(name, env, bin, args...)
		if err != nil {
			return err
		}
		alive[name] = c
		watch(c, exits)
		return nil
	}

	if err := start("prosody", lua, prosodyBin, "--config", prosodyCfg); err != nil {
		return err
	}
	if err := waitPort("127.0.0.1:5280", 2*time.Minute); err != nil {
		return fmt.Errorf("prosody: %w", err)
	}
	if err := start("jicofo", java,
		"-Xmx512m", "-Djdk.tls.ephemeralDHKeySize=2048", "-Dconfig.file="+jicofoCfg,
		"-cp", filepath.Join(app, "jicofo", "jicofo.jar")+":"+filepath.Join(app, "jicofo", "lib")+"/*",
		"org.jitsi.jicofo.Main",
	); err != nil {
		return err
	}
	if err := start("jvb", java,
		"--enable-native-access=ALL-UNNAMED", "-Xmx2g", "-Dconfig.file="+jvbCfg,
		"-Dnet.java.sip.communicator.SC_HOME_DIR_LOCATION="+filepath.Join(data, "jvb"),
		"-Dnet.java.sip.communicator.SC_HOME_DIR_NAME=jvb",
		"-Djava.library.path="+filepath.Join(app, "jvb", "lib", "native", "linux-64"),
		"-cp", filepath.Join(app, "jvb", "jitsi-videobridge.jar")+":"+filepath.Join(app, "jvb", "lib")+"/*",
		"org.jitsi.videobridge.MainKt",
	); err != nil {
		return err
	}

	prosodyURL := &url.URL{Scheme: "http", Host: "127.0.0.1:5280"}
	srv := &http.Server{
		Addr:              s.HTTPSListen,
		Handler:           webHandler(filepath.Join(app, "web"), prosodyURL, s.Domain),
		ReadHeaderTimeout: 15 * time.Second,
	}
	httpsErr := make(chan error, 1)
	go func() {
		httpsErr <- srv.ListenAndServeTLS(filepath.Join(data, "tls", "server.crt"), filepath.Join(data, "tls", "server.key"))
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	log.Printf("Jitsi Meet is starting at https://%s%s/ (XMPP domain %s)", s.PublicHost, s.HTTPSListen, s.Domain)
	select {
	case <-ctx.Done():
		log.Print("stopping")
		_ = srv.Close()
		return nil
	case e := <-exits:
		delete(alive, e.name)
		return fmt.Errorf("%s stopped: %v", e.name, e.err)
	case err := <-httpsErr:
		return fmt.Errorf("https: %w", err)
	}
}

// runtimeEnv is the environment of the Prosody process: Lua finds the rocks that the build installed.
func runtimeEnv(app string) []string {
	rocks := filepath.Join(app, "rocks")
	return append(os.Environ(),
		"LUA_PATH="+filepath.Join(rocks, "share", "lua", "5.4", "?.lua")+";"+filepath.Join(rocks, "share", "lua", "5.4", "?", "init.lua")+";;",
		"LUA_CPATH="+filepath.Join(rocks, "lib", "lua", "5.4", "?.so")+";;",
	)
}

// stopAll asks every running child to stop, and kills the ones that are still running after 20 seconds.
func stopAll(alive map[string]*child, exits <-chan exit) {
	if len(alive) == 0 {
		return
	}
	for _, c := range alive {
		_ = c.cmd.Process.Signal(syscall.SIGTERM)
	}
	deadline := time.After(20 * time.Second)
	for len(alive) > 0 {
		select {
		case e := <-exits:
			delete(alive, e.name)
		case <-deadline:
			for _, c := range alive {
				_ = c.cmd.Process.Kill()
			}
			return
		}
	}
}
