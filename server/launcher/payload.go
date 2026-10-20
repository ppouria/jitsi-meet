package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// payload is the runtime archive that the build puts next to this file. Its app/ folder holds the
// Lua runtime, Prosody, the Java runtime, Jicofo, Videobridge, the web files and the Prosody plugins.
//
//go:embed payload.tar.gz
var payload []byte

// unpackPayload extracts the archive into root unless app/ already holds this exact payload.
// The app folder is replaced as a whole, so files from an older build cannot stay behind.
func unpackPayload(root string) error {
	sum := sha256.Sum256(payload)
	want := hex.EncodeToString(sum[:])
	app := filepath.Join(root, "app")
	marker := filepath.Join(app, ".payload-sha256")
	if got, err := os.ReadFile(marker); err == nil && string(got) == want {
		return nil
	}
	if err := os.RemoveAll(app); err != nil {
		return err
	}
	gz, err := gzip.NewReader(bytes.NewReader(payload))
	if err != nil {
		return err
	}
	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if err := extractEntry(root, hdr, tr); err != nil {
			return fmt.Errorf("%s: %w", hdr.Name, err)
		}
	}
	return os.WriteFile(marker, []byte(want), 0o644)
}

func extractEntry(root string, hdr *tar.Header, body io.Reader) error {
	target, err := archivePath(root, hdr.Name)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	switch hdr.Typeflag {
	case tar.TypeDir:
		return os.MkdirAll(target, 0o755)
	case tar.TypeReg:
		mode := os.FileMode(0o644)
		if hdr.FileInfo().Mode()&0o111 != 0 {
			mode = 0o755
		}
		f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
		if err != nil {
			return err
		}
		if _, err := io.Copy(f, body); err != nil {
			f.Close()
			return err
		}
		return f.Close()
	case tar.TypeSymlink:
		// The link resolves relative to its own folder, so the resolved path must stay under root.
		if !within(root, filepath.Join(filepath.Dir(target), hdr.Linkname)) {
			return fmt.Errorf("symlink target %q leaves the install root", hdr.Linkname)
		}
		return os.Symlink(hdr.Linkname, target)
	case tar.TypeLink:
		src, err := archivePath(root, hdr.Linkname)
		if err != nil {
			return err
		}
		return os.Link(src, target)
	default:
		return fmt.Errorf("unsupported entry type %q", hdr.Typeflag)
	}
}

// archivePath maps an archive name to a path under root. A name with a ".." part is refused.
func archivePath(root, name string) (string, error) {
	for _, part := range strings.Split(filepath.ToSlash(name), "/") {
		if part == ".." {
			return "", fmt.Errorf("name contains ..")
		}
	}
	return filepath.Join(root, filepath.FromSlash(name)), nil
}

// within reports whether p, after cleaning, is root or lies under it.
func within(root, p string) bool {
	rel, err := filepath.Rel(root, p)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
