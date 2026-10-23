package httpapi

import (
	"archive/zip"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/storage"
)

func serveContent(w http.ResponseWriter, r *http.Request, name string, mtime time.Time, f *os.File, public bool, download ...bool) {
	headerName := safeHeaderFilename(name)
	buf := make([]byte, 512)
	n, _ := f.ReadAt(buf, 0)
	ctype := http.DetectContentType(buf[:n])
	if ctype == "text/html; charset=utf-8" || strings.HasSuffix(strings.ToLower(name), ".html") || strings.HasSuffix(strings.ToLower(name), ".htm") {
		w.Header().Set("Content-Disposition", `attachment; filename="`+headerName+`"`)
	} else {
		w.Header().Set("Content-Disposition", `inline; filename="`+headerName+`"`)
	}
	if ctype != "application/octet-stream" {
		w.Header().Set("Content-Type", ctype)
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if public {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "no-cache")
	} else {
		w.Header().Set("Cache-Control", "private, no-store")
	}
	if ctype == "image/svg+xml" {
		w.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'")
	}
	if len(download) > 0 && download[0] {
		w.Header().Set("Content-Disposition", `attachment; filename="`+headerName+`"`)
	}
	http.ServeContent(w, r, name, mtime, f)
}

func (s *Server) downloadZip(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("path")
	rel, err := storage.Normalize(raw)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Folder not found"})
		return
	}
	info, err := s.store.Stat(rel)
	if err != nil || !info.IsDir() {
		writeJSON(w, 404, map[string]string{"error": "Folder not found"})
		return
	}
	name := "open-drive.zip"
	if rel != "" {
		name = path.Base(rel) + ".zip"
	}
	s.zip(w, r, []string{rel}, name)
}

func (s *Server) downloadZipBatch(w http.ResponseWriter, r *http.Request) {
	var rawPaths []string
	if r.Method == http.MethodGet {
		rawPaths = append(rawPaths, r.URL.Query()["paths"]...)
	} else {
		var b struct {
			Paths []string `json:"paths"`
		}
		if !decode(w, r, &b) {
			return
		}
		rawPaths = b.Paths
	}
	if len(rawPaths) == 0 {
		writeJSON(w, 400, map[string]string{"error": "No items specified"})
		return
	}
	paths := []string{}
	for _, raw := range rawPaths {
		if n, e := storage.Normalize(raw); e == nil {
			if _, statErr := s.store.Stat(n); statErr == nil {
				paths = append(paths, n)
			}
		}
	}
	if len(paths) == 0 {
		writeJSON(w, 404, map[string]string{"error": "No items found"})
		return
	}
	s.zip(w, r, paths, "open-drive.zip")
}

func (s *Server) zip(w http.ResponseWriter, r *http.Request, roots []string, name string) {
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="`+safeHeaderFilename(name)+`"`)
	zw := zip.NewWriter(w)
	seen := map[string]bool{}
	for _, root := range roots {
		if root == "" {
			root = "."
		}
		_ = fs.WalkDir(s.store.FS(), root, func(rel string, e fs.DirEntry, err error) error {
			if err != nil || e.IsDir() || storage.IsInternal(rel) {
				return nil
			}
			if seen[rel] {
				return nil
			}
			seen[rel] = true
			f, err := s.store.Open(rel)
			if err != nil {
				return nil
			}
			defer f.Close()
			h := &zip.FileHeader{Name: strings.TrimPrefix(rel, "./"), Method: zip.Deflate}
			if info, e := e.Info(); e == nil {
				h.SetModTime(info.ModTime())
			}
			out, zipErr := zw.CreateHeader(h)
			if zipErr == nil {
				_, _ = io.Copy(out, f)
			}
			return nil
		})
	}
	_ = zw.Close()
}

func (s *Server) zipDirectory(w http.ResponseWriter, r *http.Request, root, name string, publicOnly bool) {
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="`+safeHeaderFilename(name)+`.zip"`)
	zw := zip.NewWriter(w)
	err := fs.WalkDir(s.store.FS(), root, func(rel string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if rel == root || storage.IsInternal(rel) || entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if publicOnly {
			visibility, _, _ := s.visibility(rel)
			if visibility != "public" {
				if entry.IsDir() {
					return fs.SkipDir
				}
				return nil
			}
		}
		if entry.IsDir() {
			return nil
		}
		info, infoErr := entry.Info()
		if infoErr != nil || !info.Mode().IsRegular() {
			return nil
		}
		file, openErr := s.store.Open(rel)
		if openErr != nil {
			return nil
		}
		defer file.Close()
		archiveName := strings.TrimPrefix(rel, strings.TrimSuffix(root, "/")+"/")
		if archiveName == rel && root != "." {
			return nil
		}
		header := &zip.FileHeader{Name: archiveName, Method: zip.Deflate}
		header.SetModTime(info.ModTime())
		out, createErr := zw.CreateHeader(header)
		if createErr != nil {
			return createErr
		}
		_, copyErr := io.Copy(out, file)
		return copyErr
	})
	closeErr := zw.Close()
	if err != nil || closeErr != nil {
		return
	}
}

func (s *Server) zipFileName() string { return "open-drive.zip" }

func safeHeaderFilename(name string) string {
	return strings.NewReplacer("\"", "_", "\r", "_", "\n", "_").Replace(name)
}

func indexIsImage(v string) bool {
	ext := strings.ToLower(path.Ext(v))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg":
		return true
	}
	return false
}
