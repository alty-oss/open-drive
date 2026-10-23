package httpapi

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func (s *Server) frontend(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/f/") {
		http.NotFound(w, r)
		return
	}
	if requested := strings.TrimPrefix(path.Clean(r.URL.Path), "/"); requested != "" && requested != "." {
		asset := filepath.Join(s.cfg.ClientDist, filepath.FromSlash(requested))
		if info, err := os.Stat(asset); err == nil && !info.IsDir() {
			http.ServeFile(w, r, asset)
			return
		}
	}
	indexPath := filepath.Join(s.cfg.ClientDist, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Frontend not built"})
		return
	}
	http.ServeFile(w, r, indexPath)
}
