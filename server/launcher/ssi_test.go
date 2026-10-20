package main

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestServeHTMLExpandsIncludes(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "config.js"), []byte("var config = {};"), 0o644); err != nil {
		t.Fatal(err)
	}
	page := `<script><!--#include virtual="/config.js" --></script><!--#include virtual="/missing.html" -->done`
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte(page), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	serveHTML(rec, root, filepath.Join(root, "index.html"))
	got := rec.Body.String()
	if !strings.Contains(got, "var config = {};") || strings.Contains(got, "#include") || !strings.HasSuffix(got, "done") {
		t.Errorf("includes not expanded: %q", got)
	}
}

func TestServeHTMLRefusesEscapingInclude(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	secret := filepath.Join(filepath.Dir(root), "secret-outside.txt")
	if err := os.WriteFile(secret, []byte("SECRET"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Remove(secret) })
	page := `<!--#include virtual="/../secret-outside.txt" -->`
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte(page), 0o644); err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	serveHTML(rec, root, filepath.Join(root, "index.html"))
	if strings.Contains(rec.Body.String(), "SECRET") {
		t.Error("an include read a file outside the web root")
	}
}
