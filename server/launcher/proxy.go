package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
)

// ssiInclude matches the server-side include that the upstream index page uses, for example
// <!--#include virtual="/config.js" -->. Nginx expands it with its ssi directive; the launcher does the same.
var ssiInclude = regexp.MustCompile(`<!--#include virtual="([^"]+)" -->`)

// webHandler serves the web app from webRoot. The BOSH and websocket paths go to Prosody on loopback.
// Prosody picks the virtual host from the Host header, so the proxy sends the XMPP domain there.
func webHandler(webRoot string, prosody *url.URL, xmppDomain string) http.Handler {
	files := http.FileServer(http.Dir(webRoot))
	bosh := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(prosody)
			pr.Out.Host = xmppDomain
		},
	}
	mux := http.NewServeMux()
	mux.Handle("/http-bind", bosh)
	mux.Handle("/xmpp-websocket", bosh)
	// The account service is not installed here. Its API paths must not return the app page.
	mux.HandleFunc("/account/", http.NotFound)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		file := filepath.Join(webRoot, filepath.FromSlash(p))
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			if path.Ext(p) == ".html" {
				serveHTML(w, webRoot, file)
				return
			}
			files.ServeHTTP(w, r)
			return
		}
		// A room path such as /MyRoom belongs to the app. A path with an extension is a missing file.
		if path.Ext(p) != "" {
			http.NotFound(w, r)
			return
		}
		serveHTML(w, webRoot, filepath.Join(webRoot, "index.html"))
	})
	return mux
}

// serveHTML writes a page with its server-side includes expanded. A missing include becomes empty, and an
// include can only name a file under webRoot.
func serveHTML(w http.ResponseWriter, webRoot, file string) {
	b, err := os.ReadFile(file)
	if err != nil {
		http.NotFound(w, nil)
		return
	}
	out := ssiInclude.ReplaceAllFunc(b, func(m []byte) []byte {
		name := ssiInclude.FindSubmatch(m)[1]
		inc, err := os.ReadFile(filepath.Join(webRoot, filepath.FromSlash(path.Clean("/"+string(name)))))
		if err != nil {
			return nil
		}
		return inc
	})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(out)
}
