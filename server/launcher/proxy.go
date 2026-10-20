package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
)

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
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		if info, err := os.Stat(filepath.Join(webRoot, filepath.FromSlash(p))); err == nil && !info.IsDir() {
			files.ServeHTTP(w, r)
			return
		}
		// A room path such as /MyRoom belongs to the app. A path with an extension is a missing file.
		if path.Ext(p) != "" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(webRoot, "index.html"))
	})
	return mux
}
