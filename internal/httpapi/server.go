package httpapi

import (
	"archive/zip"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"open-drive/internal/auth"
	"open-drive/internal/config"
	"open-drive/internal/database"
	"open-drive/internal/index"
	"open-drive/internal/realtime"
	"open-drive/internal/storage"
)

type Server struct {
	Cfg    config.Config
	DB     *database.Database
	Store  *storage.Store
	Index  *index.Index
	Auth   *auth.Auth
	Hub    *realtime.Hub
	Mux    *http.ServeMux
	mutate sync.Mutex
}

func New(cfg config.Config) (*Server, error) {
	store, err := storage.Open(cfg.StorageDir)
	if err != nil {
		return nil, err
	}
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		store.Close()
		return nil, err
	}
	s := &Server{Cfg: cfg, DB: db, Store: store, Hub: realtime.New()}
	s.Index = &index.Index{DB: db, Store: store}
	s.Auth = auth.New(db, cfg)
	s.Mux = http.NewServeMux()
	s.routes()
	return s, nil
}
func (s *Server) Close() error {
	if s.Store != nil {
		_ = s.Store.Close()
	}
	if s.DB != nil {
		return s.DB.Close()
	}
	return nil
}
func (s *Server) Handler() http.Handler { return s.requestMiddleware(s.Mux) }

func (s *Server) routes() {
	s.Mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
	s.Mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.Index.EnsureReady(r.Context()); err != nil {
			writeJSON(w, 503, map[string]string{"error": "not ready"})
			return
		}
		writeJSON(w, 200, map[string]string{"status": "ready"})
	})
	s.Mux.HandleFunc("GET /api/auth/check", s.Auth.Check)
	s.Mux.HandleFunc("POST /api/auth/login", s.Auth.Login)
	s.Mux.HandleFunc("POST /api/auth/logout", s.Auth.Logout)
	s.Mux.HandleFunc("GET /api/events", func(w http.ResponseWriter, r *http.Request) {
		s.Hub.ServeHTTP(w, r, func(origin string) bool { return s.originAllowed(origin, r.Host) }, func(req *http.Request) bool { _, ok := s.Auth.Current(req); return ok })
	})
	s.Mux.Handle("GET /api/files", s.Auth.Require(http.HandlerFunc(s.listFiles)))
	s.Mux.Handle("GET /api/search", s.Auth.Require(http.HandlerFunc(s.search)))
	s.Mux.Handle("GET /api/storage/stats", s.Auth.Require(http.HandlerFunc(s.stats)))
	s.Mux.Handle("GET /api/storage", s.Auth.Require(http.HandlerFunc(s.storage)))
	s.Mux.Handle("GET /api/favorites", s.Auth.Require(http.HandlerFunc(s.favorites)))
	s.Mux.Handle("PUT /api/favorites", s.Auth.Require(http.HandlerFunc(s.favorites)))
	s.Mux.Handle("DELETE /api/favorites", s.Auth.Require(http.HandlerFunc(s.favorites)))
	s.Mux.Handle("GET /api/access", s.Auth.Require(http.HandlerFunc(s.access)))
	s.Mux.Handle("PUT /api/access", s.Auth.Require(http.HandlerFunc(s.access)))
	s.Mux.Handle("DELETE /api/access", s.Auth.Require(http.HandlerFunc(s.access)))
	s.Mux.Handle("GET /api/links", s.Auth.Require(http.HandlerFunc(s.links)))
	s.Mux.Handle("POST /api/links", s.Auth.Require(http.HandlerFunc(s.links)))
	s.Mux.Handle("DELETE /api/links/{id}", s.Auth.Require(http.HandlerFunc(s.linkAction)))
	s.Mux.Handle("DELETE /api/links/{id}/purge", s.Auth.Require(http.HandlerFunc(s.linkPurge)))
	s.Mux.Handle("POST /api/links/purge", s.Auth.Require(http.HandlerFunc(s.linksPurge)))
	s.Mux.Handle("GET /api/links/all", s.Auth.Require(http.HandlerFunc(s.linksAll)))
	s.Mux.Handle("GET /api/metadata/{filePath...}", s.Auth.Require(http.HandlerFunc(s.metadata)))
	s.Mux.Handle("GET /api/subtitles/{filePath...}", s.Auth.Require(http.HandlerFunc(s.subtitles)))
	s.Mux.Handle("GET /api/subtitle/{filePath...}", s.Auth.Require(http.HandlerFunc(s.subtitle)))
	s.Mux.Handle("GET /api/trash", s.Auth.Require(http.HandlerFunc(s.trashList)))
	s.Mux.Handle("POST /api/delete-batch", s.Auth.Require(http.HandlerFunc(s.deleteBatch)))
	s.Mux.Handle("POST /api/trash/restore", s.Auth.Require(http.HandlerFunc(s.trashRestore)))
	s.Mux.Handle("POST /api/trash/delete", s.Auth.Require(http.HandlerFunc(s.trashDelete)))
	s.Mux.Handle("POST /api/trash/empty", s.Auth.Require(http.HandlerFunc(s.trashEmpty)))
	s.Mux.Handle("GET /api/download-trash-zip", s.Auth.Require(http.HandlerFunc(s.downloadTrashZip)))
	s.Mux.Handle("POST /api/download-trash-zip", s.Auth.Require(http.HandlerFunc(s.downloadTrashZip)))
	s.Mux.Handle("DELETE /api/files/{filePath...}", s.Auth.Require(http.HandlerFunc(s.deleteFile)))
	s.Mux.Handle("GET /api/content/{filePath...}", s.Auth.Require(http.HandlerFunc(s.content)))
	s.Mux.Handle("GET /api/file-content/{filePath...}", s.Auth.Require(http.HandlerFunc(s.editorRead)))
	s.Mux.Handle("PUT /api/file-content/{filePath...}", s.Auth.Require(http.HandlerFunc(s.edit)))
	s.Mux.Handle("POST /api/folders", s.Auth.Require(http.HandlerFunc(s.createFolder)))
	s.Mux.Handle("POST /api/ensure-folders", s.Auth.Require(http.HandlerFunc(s.ensureFolders)))
	s.Mux.Handle("POST /api/new-file", s.Auth.Require(http.HandlerFunc(s.newFile)))
	s.Mux.Handle("POST /api/move", s.Auth.Require(http.HandlerFunc(s.move)))
	s.Mux.Handle("POST /api/rename", s.Auth.Require(http.HandlerFunc(s.rename)))
	s.Mux.Handle("POST /api/copy-batch", s.Auth.Require(http.HandlerFunc(s.copyBatch)))
	s.Mux.Handle("POST /api/move-batch", s.Auth.Require(http.HandlerFunc(s.moveBatch)))
	s.Mux.Handle("POST /api/upload", s.Auth.Require(http.HandlerFunc(s.upload)))
	s.Mux.Handle("POST /api/check-duplicates", s.Auth.Require(http.HandlerFunc(s.duplicates)))
	s.Mux.Handle("POST /api/upload-chunk/init", s.Auth.Require(http.HandlerFunc(s.chunkInit)))
	s.Mux.Handle("POST /api/upload-chunk/{uploadId}", s.Auth.Require(http.HandlerFunc(s.chunkPart)))
	s.Mux.Handle("POST /api/upload-chunk/{uploadId}/complete", s.Auth.Require(http.HandlerFunc(s.chunkComplete)))
	s.Mux.Handle("DELETE /api/upload-chunk/{uploadId}", s.Auth.Require(http.HandlerFunc(s.chunkCancel)))
	s.Mux.Handle("GET /api/download-zip", s.Auth.Require(http.HandlerFunc(s.downloadZip)))
	s.Mux.Handle("GET /api/download-zip-batch", s.Auth.Require(http.HandlerFunc(s.downloadZipBatch)))
	s.Mux.Handle("POST /api/download-zip-batch", s.Auth.Require(http.HandlerFunc(s.downloadZipBatch)))
	s.Mux.Handle("GET /t/{id}", s.Auth.Require(http.HandlerFunc(s.trashPreview)))
	s.Mux.HandleFunc("GET /api/public-links/{token}", s.publicLinkInfo)
	s.Mux.HandleFunc("GET /api/public-links/{token}/content", s.publicLinkContent)
	s.Mux.HandleFunc("GET /api/public-links/{token}/download", s.publicLinkContent)
	s.Mux.HandleFunc("GET /api/public-path/{filePath...}", s.publicPath)
	s.Mux.HandleFunc("GET /api/public-path-download/{filePath...}", s.publicPath)
	s.Mux.HandleFunc("GET /s/{token}", s.publicLinkContent)
	s.Mux.HandleFunc("GET /d/{token}", s.frontend)
	s.Mux.HandleFunc("GET /f/{filePath...}", s.publicFile)
	s.Mux.HandleFunc("GET /", s.frontend)
}

func (s *Server) requestMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if id == "" {
			id = randomToken(12)
		}
		w.Header().Set("X-Request-Id", id)
		if traversal(r.RequestURI) {
			http.NotFound(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func (s *Server) originAllowed(origin, requestHost string) bool {
	if origin == "" {
		return true
	}
	u, err := http.NewRequest("GET", origin, nil)
	if err != nil {
		return false
	}
	if u.URL.Host == "" || (u.URL.Scheme != "http" && u.URL.Scheme != "https") {
		return false
	}
	return strings.EqualFold(u.URL.Host, requestHost) || strings.EqualFold(u.URL.Hostname(), "localhost") || strings.EqualFold(u.URL.Hostname(), "127.0.0.1")
}
func traversal(raw string) bool {
	v := strings.SplitN(raw, "?", 2)[0]
	for n := 0; n < 2; n++ {
		decoded, err := urlPathUnescape(v)
		if err != nil {
			return true
		}
		v = decoded
	}
	for _, p := range strings.Split(strings.ReplaceAll(v, "\\", "/"), "/") {
		if p == ".." {
			return true
		}
	}
	return false
}
func urlPathUnescape(s string) (string, error) { return url.PathUnescape(s) }

func (s *Server) listFiles(w http.ResponseWriter, r *http.Request) {
	page, err := s.Index.List(r.Context(), r.URL.Query().Get("path"), r.URL.Query().Get("cursor"), atoi(r.URL.Query().Get("pageSize")))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid pagination cursor", "code": "INVALID_CURSOR"})
		return
	}
	writeJSON(w, 200, page)
}
func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.Index.SearchWithOptions(r.Context(), index.SearchOptions{
		Query:          q.Get("q"),
		Type:           q.Get("type"),
		Cursor:         q.Get("cursor"),
		PageSize:       atoi(q.Get("pageSize")),
		MinSize:        optionalInt64(q.Get("minSize")),
		MaxSize:        optionalInt64(q.Get("maxSize")),
		ModifiedAfter:  optionalInt64(q.Get("modifiedAfter")),
		ModifiedBefore: optionalInt64(q.Get("modifiedBefore")),
	})
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": err.Error(), "code": "INVALID_CURSOR"})
		return
	}
	writeJSON(w, 200, page)
}
func (s *Server) stats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.Index.Stats(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to read storage"})
		return
	}
	usage := stats["used"].(int64)
	var trashCount, trashSize int64
	_ = s.DB.DB.QueryRowContext(r.Context(), "SELECT COUNT(*), COALESCE(SUM(size),0) FROM trash_items WHERE state='active'").Scan(&trashCount, &trashSize)
	writeJSON(w, 200, map[string]any{"used": usage, "quota": s.Cfg.StorageQuotaBytes, "available": max64(0, s.Cfg.StorageQuotaBytes-usage-trashSize), "fileCount": stats["fileCount"], "folderCount": stats["folderCount"], "trashCount": trashCount, "trashSize": trashSize, "totalUsed": usage + trashSize, "maxUploadSize": s.Cfg.MaxUploadSizeBytes, "byType": stats["byType"]})
}

func (s *Server) storage(w http.ResponseWriter, r *http.Request) {
	stats, err := s.Index.Stats(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to read storage"})
		return
	}
	writeJSON(w, 200, map[string]any{"used": stats["used"]})
}

func (s *Server) quotaHasRoom(ctx context.Context, incoming int64) bool {
	stats, err := s.Index.Stats(ctx)
	if err != nil {
		return false
	}
	var trashSize int64
	if err := s.DB.DB.QueryRowContext(ctx, "SELECT COALESCE(SUM(size),0) FROM trash_items WHERE state='active'").Scan(&trashSize); err != nil {
		return false
	}
	return stats["used"].(int64)+trashSize+incoming <= s.Cfg.StorageQuotaBytes
}

func (s *Server) content(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	f, err := s.Store.Open(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	serveContent(w, r, info.Name(), info.ModTime(), f, false)
}
func (s *Server) publicFile(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	info, err := s.Store.Lstat(rel)
	if err != nil || info.Mode()&os.ModeSymlink != 0 {
		http.NotFound(w, r)
		return
	}
	visibility, _, _ := s.visibility(rel)
	if visibility != "public" {
		http.Redirect(w, r, "/file-not-found", http.StatusFound)
		return
	}
	if info.IsDir() {
		parts := strings.Split(rel, "/")
		for i, part := range parts {
			parts[i] = url.PathEscape(part)
		}
		http.Redirect(w, r, "/public/"+strings.Join(parts, "/"), http.StatusFound)
		return
	}
	if !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	f, err := s.Store.Open(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	serveContent(w, r, info.Name(), info.ModTime(), f, true)
}

func (s *Server) trashPreview(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var trashPath, name string
	if err := s.DB.DB.QueryRowContext(r.Context(), "SELECT trash_path,name FROM trash_items WHERE id=? AND state='active'", id).Scan(&trashPath, &name); err != nil {
		http.NotFound(w, r)
		return
	}

	f, err := s.Store.Root.Open(trashPath)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	serveContent(w, r, name, info.ModTime(), f, false)
}
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

func (s *Server) createFolder(w http.ResponseWriter, r *http.Request) {
	var b struct{ Name, Path string }
	if !decode(w, r, &b) {
		return
	}
	name := sanitizeName(b.Name)
	parent, err := storage.Normalize(b.Path)
	if err != nil || name == "" {
		writeJSON(w, 400, map[string]string{"error": "Invalid name"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	if _, err := s.Store.Stat(parent); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Folder not found"})
		return
	}
	rel := path.Join(parent, name)
	if _, err := s.Store.Stat(rel); err == nil {
		writeJSON(w, 409, map[string]string{"error": "Folder already exists"})
		return
	}
	if err := s.Store.Root.Mkdir(rel, 0o755); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to create folder"})
		return
	}
	_ = s.Index.Sync(r.Context(), rel)
	writeJSON(w, 200, map[string]any{"ok": true, "name": name})
	s.emit(r, "new-folder", map[string]any{"path": b.Path})
}
func (s *Server) ensureFolders(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Path    string
		Folders []string
	}
	if !decode(w, r, &b) {
		return
	}
	if len(b.Folders) > 500 {
		writeJSON(w, 400, map[string]string{"error": "Too many folders in one request"})
		return
	}
	base, err := storage.Normalize(b.Path)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	created := 0
	s.mutate.Lock()
	defer s.mutate.Unlock()
	for _, raw := range b.Folders {
		clean := strings.Trim(strings.ReplaceAll(raw, "\\", "/"), "/")
		if clean == "" {
			continue
		}
		rel, err := storage.Normalize(path.Join(base, clean))
		if err != nil || rel == base {
			continue
		}
		if _, err := s.Store.Stat(rel); errors.Is(err, fs.ErrNotExist) {
			if err := s.Store.Root.MkdirAll(rel, 0o755); err == nil {
				created++
			}
		}
	}
	_ = s.Index.Sync(r.Context(), base)
	writeJSON(w, 200, map[string]any{"ok": true, "created": created})
	if created > 0 {
		s.emit(r, "new-folder", map[string]any{"path": b.Path})
	}
}
func (s *Server) newFile(w http.ResponseWriter, r *http.Request) {
	var b struct{ Name, Path, Content string }
	if !decode(w, r, &b) {
		return
	}
	name := sanitizeName(b.Name)
	if name == "" || len(name) > 255 {
		writeJSON(w, 400, map[string]string{"error": "Invalid name"})
		return
	}
	if len([]byte(b.Content)) > 64*1024 {
		writeJSON(w, 413, map[string]string{"error": "Initial content is too large"})
		return
	}
	parent, err := storage.Normalize(b.Path)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	rel := path.Join(parent, name)
	s.mutate.Lock()
	defer s.mutate.Unlock()
	f, err := s.Store.Root.OpenFile(rel, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		if errors.Is(err, fs.ErrExist) {
			writeJSON(w, 409, map[string]string{"error": "An item with this name already exists"})
		} else {
			writeJSON(w, 500, map[string]string{"error": "Unable to create file"})
		}
		return
	}
	_, err = f.WriteString(b.Content)
	f.Close()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to write file"})
		return
	}
	_ = s.Index.Sync(r.Context(), rel)
	writeJSON(w, 200, map[string]any{"ok": true, "name": name, "path": rel})
	s.emit(r, "new-file", map[string]any{"path": b.Path})
}

func (s *Server) move(w http.ResponseWriter, r *http.Request) {
	var b struct{ From, To string }
	if !decode(w, r, &b) {
		return
	}
	from, err := storage.Normalize(b.From)
	to, err2 := storage.Normalize(b.To)
	if err != nil || err2 != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	info, err := s.Store.Stat(from)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	if _, err := s.Store.Stat(to); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Destination folder not found"})
		return
	}
	dest := path.Join(to, path.Base(from))
	if _, err := s.Store.Stat(dest); err == nil {
		writeJSON(w, 409, map[string]string{"error": "An item with this name already exists in the destination"})
		return
	}
	if info.IsDir() && (to == from || strings.HasPrefix(to, from+"/")) {
		writeJSON(w, 400, map[string]string{"error": "A folder cannot be moved inside itself"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	if err := s.Store.Root.Rename(from, dest); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to move item"})
		return
	}
	if err := s.remapPathMetadata(from, dest); err != nil {
		_ = s.Store.Root.Rename(dest, from)
		writeJSON(w, 500, map[string]string{"error": "Unable to update item metadata"})
		return
	}
	_ = s.Index.Sync(r.Context(), from, dest)
	writeJSON(w, 200, map[string]bool{"ok": true})
	s.emit(r, "move", map[string]any{"from": b.From, "to": b.To, "paths": []string{parentOf(from), parentOf(dest)}})
}
func (s *Server) rename(w http.ResponseWriter, r *http.Request) {
	var b struct{ From, NewName string }
	if !decode(w, r, &b) {
		return
	}
	from, err := storage.Normalize(b.From)
	if err != nil || b.NewName == "" || len(b.NewName) > 255 || strings.ContainsAny(b.NewName, "/\\") {
		writeJSON(w, 400, map[string]string{"error": "Invalid path or name"})
		return
	}
	if _, err := s.Store.Stat(from); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	dest := path.Join(parentOf(from), b.NewName)
	if _, err := s.Store.Stat(dest); err == nil {
		writeJSON(w, 409, map[string]string{"error": "An item with this name already exists"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	if err := s.Store.Root.Rename(from, dest); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to rename item"})
		return
	}
	if err := s.remapPathMetadata(from, dest); err != nil {
		_ = s.Store.Root.Rename(dest, from)
		writeJSON(w, 500, map[string]string{"error": "Unable to update item metadata"})
		return
	}
	_ = s.Index.Sync(r.Context(), from, dest)
	writeJSON(w, 200, map[string]bool{"ok": true})
	s.emit(r, "rename", map[string]any{"path": parentOf(from)})
}
func (s *Server) copyBatch(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Paths []string
		To    string
	}
	if !decode(w, r, &b) {
		return
	}
	if len(b.Paths) == 0 {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	to, err := storage.Normalize(b.To)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	if _, err := s.Store.Stat(to); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Destination folder not found"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	copied := 0
	for _, raw := range b.Paths {
		from, err := storage.Normalize(raw)
		if err != nil {
			continue
		}
		if _, err := s.Store.Stat(from); err != nil {
			continue
		}
		dest := path.Join(to, path.Base(from))
		dest = s.unique(dest)
		if strings.HasPrefix(dest, from+"/") {
			continue
		}
		if err := copyRoot(s.Store, from, dest); err == nil {
			copied++
		}
	}
	if copied > 0 {
		_ = s.Index.Sync(r.Context(), to)
	}
	writeJSON(w, 200, map[string]any{"ok": true, "copied": copied})
	if copied > 0 {
		s.emit(r, "copy-batch", map[string]any{"to": b.To})
	}
}
func (s *Server) moveBatch(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Paths []string
		To    string
	}
	if !decode(w, r, &b) {
		return
	}
	if len(b.Paths) == 0 {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	to, err := storage.Normalize(b.To)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	if _, err := s.Store.Stat(to); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Destination folder not found"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	moved := 0
	touched := []string{}
	for _, raw := range b.Paths {
		from, err := storage.Normalize(raw)
		if err != nil {
			continue
		}
		info, err := s.Store.Stat(from)
		if err != nil {
			continue
		}
		dest := path.Join(to, path.Base(from))
		if _, err := s.Store.Stat(dest); err == nil || (info.IsDir() && strings.HasPrefix(to, from+"/")) {
			continue
		}
		if err := s.Store.Root.Rename(from, dest); err != nil {
			continue
		}
		if err := s.remapPathMetadata(from, dest); err != nil {
			_ = s.Store.Root.Rename(dest, from)
			continue
		}
		moved++
		touched = append(touched, from, dest)
	}
	if moved > 0 {
		_ = s.Index.Sync(r.Context(), to)
	}
	writeJSON(w, 200, map[string]any{"ok": true, "moved": moved})
	if moved > 0 {
		s.emit(r, "move-batch", map[string]any{"to": b.To, "paths": parents(touched)})
	}
}

func (s *Server) edit(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, (5<<20)+(64<<10))).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid content"})
		return
	}
	if len([]byte(body.Content)) > 5<<20 {
		writeJSON(w, 413, map[string]string{"error": "Content is too large"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	f, err := s.Store.Root.OpenFile(rel, os.O_WRONLY|os.O_TRUNC, 0)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	_, err = f.WriteString(body.Content)
	f.Close()
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to save file"})
		return
	}
	_ = s.Index.Sync(r.Context(), rel)
	writeJSON(w, 200, map[string]bool{"ok": true})
	s.emit(r, "edit", map[string]any{"path": parentOf(rel)})
}

func (s *Server) editorRead(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "File not found"})
		return
	}
	f, err := s.Store.Open(rel)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "File not found"})
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		writeJSON(w, 400, map[string]string{"error": "A folder cannot be edited"})
		return
	}
	if info.Size() > 5<<20 {
		writeJSON(w, 413, map[string]string{"error": "File is too large to edit"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(f, 5<<20+1))
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to read file"})
		return
	}
	if len(body) > 5<<20 {
		writeJSON(w, 413, map[string]string{"error": "File is too large to edit"})
		return
	}
	writeJSON(w, 200, map[string]any{"content": string(body), "size": info.Size(), "modifiedAt": info.ModTime().UTC().Format(time.RFC3339Nano)})
}

func (s *Server) downloadZip(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("path")
	rel, err := storage.Normalize(raw)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Folder not found"})
		return
	}
	info, err := s.Store.Stat(rel)
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
			if _, statErr := s.Store.Stat(n); statErr == nil {
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
		_ = fs.WalkDir(s.Store.FS(), root, func(rel string, e fs.DirEntry, err error) error {
			if err != nil || e.IsDir() || storage.IsInternal(rel) {
				return nil
			}
			if seen[rel] {
				return nil
			}
			seen[rel] = true
			f, err := s.Store.Open(rel)
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
	err := fs.WalkDir(s.Store.FS(), root, func(rel string, entry fs.DirEntry, walkErr error) error {
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
		file, openErr := s.Store.Open(rel)
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

func (s *Server) duplicates(w http.ResponseWriter, r *http.Request) {
	var b struct{ Filenames []string }
	if !decode(w, r, &b) {
		return
	}
	dir, e := storage.Normalize(r.URL.Query().Get("path"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	dups := []string{}
	for _, name := range b.Filenames {
		name = sanitizeName(name)
		if _, e := s.Store.Stat(path.Join(dir, name)); e == nil {
			dups = append(dups, name)
		}
	}
	writeJSON(w, 200, map[string]any{"duplicates": dups})
}

type chunkMeta struct {
	Filename    string `json:"filename"`
	TotalChunks int    `json:"totalChunks"`
	FileSize    int64  `json:"fileSize"`
	DestPath    string `json:"destPath"`
	Autorename  bool   `json:"autorename"`
	CreatedAt   int64  `json:"createdAt"`
}

func (s *Server) chunkInit(w http.ResponseWriter, r *http.Request) {
	var m chunkMeta
	if !decode(w, r, &m) {
		return
	}
	m.Filename = sanitizeName(m.Filename)
	if m.Filename == "" || len(m.Filename) > 255 {
		writeJSON(w, 400, map[string]string{"error": "Invalid filename", "code": "INVALID_FILENAME"})
		return
	}
	if m.FileSize <= 0 || m.FileSize > s.Cfg.MaxUploadSizeBytes {
		writeJSON(w, 413, map[string]string{"error": "Invalid file size", "code": "UPLOAD_TOO_LARGE"})
		return
	}
	dest, err := storage.Normalize(m.DestPath)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path", "code": "INVALID_DESTINATION"})
		return
	}
	m.DestPath = dest
	expectedChunks := int((m.FileSize + 50*1024*1024 - 1) / (50 * 1024 * 1024))
	if m.TotalChunks != expectedChunks {
		writeJSON(w, 400, map[string]string{"error": "Invalid chunk count", "code": "INVALID_CHUNK_COUNT"})
		return
	}
	if !s.quotaHasRoom(r.Context(), m.FileSize) {
		writeJSON(w, 507, map[string]string{"error": "Insufficient storage space", "code": "STORAGE_QUOTA_EXCEEDED"})
		return
	}
	m.CreatedAt = time.Now().UnixMilli()
	id := randomToken(16)
	dir := filepath.Join(s.Cfg.StorageDir, ".chunks", id)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to start upload"})
		return
	}
	raw, _ := json.Marshal(m)
	if err := os.WriteFile(filepath.Join(dir, "_meta.json"), raw, 0o600); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to start upload"})
		return
	}
	writeJSON(w, 200, map[string]any{"uploadId": id, "chunkSize": 50 * 1024 * 1024})
}
func (s *Server) chunkPart(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("uploadId")
	if !validID(id) {
		writeJSON(w, 400, map[string]string{"error": "Invalid upload ID"})
		return
	}

	s.mutate.Lock()
	defer s.mutate.Unlock()
	index, err := strconv.Atoi(r.URL.Query().Get("index"))
	if err != nil || index < 0 {
		writeJSON(w, 400, map[string]string{"error": "Invalid chunk index", "code": "INVALID_CHUNK_INDEX"})
		return
	}
	dir := filepath.Join(s.Cfg.StorageDir, ".chunks", id)
	raw, err := os.ReadFile(filepath.Join(dir, "_meta.json"))
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Upload not found", "code": "UPLOAD_NOT_FOUND"})
		return
	}
	var meta chunkMeta
	if json.Unmarshal(raw, &meta) != nil || index >= meta.TotalChunks {
		writeJSON(w, 400, map[string]string{"error": "Invalid chunk index", "code": "INVALID_CHUNK_INDEX"})
		return
	}
	part, _, err := r.FormFile("chunk")
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Chunk is required", "code": "CHUNK_REQUIRED"})
		return
	}
	defer part.Close()
	dst := filepath.Join(dir, strconv.Itoa(index))
	f, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Upload not found"})
		return
	}
	h := sha256.New()
	n, copyErr := io.Copy(io.MultiWriter(f, h), io.LimitReader(part, 50*1024*1024+1))
	f.Close()
	if copyErr != nil || n > 50*1024*1024 {
		writeJSON(w, 422, map[string]string{"error": "Invalid chunk"})
		return
	}
	expectedSize := int64(50 * 1024 * 1024)
	if index == meta.TotalChunks-1 {
		expectedSize = meta.FileSize - int64(50*1024*1024)*(int64(meta.TotalChunks)-1)
	}
	if n != expectedSize {
		_ = os.Remove(dst)
		writeJSON(w, 422, map[string]string{"error": "Chunk size does not match the expected size", "code": "INVALID_CHUNK_SIZE"})
		return
	}
	sum := hex.EncodeToString(h.Sum(nil))
	if expected := r.Header.Get("X-Chunk-SHA256"); expected != "" && expected != sum {
		_ = os.Remove(dst)
		writeJSON(w, 422, map[string]string{"error": "Chunk checksum does not match", "code": "CHUNK_CHECKSUM_MISMATCH"})
		return
	}
	if err := os.WriteFile(filepath.Join(dir, strconv.Itoa(index)+".sha256"), []byte(sum), 0o600); err != nil {
		_ = os.Remove(dst)
		writeJSON(w, 500, map[string]string{"error": "Unable to record chunk checksum"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "checksum": sum, "size": n})
}
func (s *Server) chunkComplete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("uploadId")
	if !validID(id) {
		writeJSON(w, 400, map[string]string{"error": "Invalid upload ID"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	dir := filepath.Join(s.Cfg.StorageDir, ".chunks", id)
	raw, err := os.ReadFile(filepath.Join(dir, "_meta.json"))
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Upload not found"})
		return
	}
	var m chunkMeta
	if json.Unmarshal(raw, &m) != nil {
		writeJSON(w, 422, map[string]string{"error": "Invalid upload"})
		return
	}
	destDir, err := storage.Normalize(m.DestPath)
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid destination"})
		return
	}
	if destDir != "" {
		if err := s.Store.Root.MkdirAll(destDir, 0o755); err != nil {
			writeJSON(w, 500, map[string]string{"error": "Invalid destination"})
			return
		}
	}
	name := m.Filename
	rel := path.Join(destDir, name)
	if m.Autorename {
		rel = s.unique(rel)
	}
	temp := rel + ".uploading-" + id
	out, err := s.Store.Root.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to assemble upload"})
		return
	}
	h := sha256.New()
	var total int64
	for n := 0; n < m.TotalChunks; n++ {
		p := filepath.Join(dir, strconv.Itoa(n))
		checksumPath := filepath.Join(dir, strconv.Itoa(n)+".sha256")
		in, e := os.Open(p)
		if e != nil {
			out.Close()
			s.Store.Root.Remove(temp)
			writeJSON(w, 409, map[string]string{"error": "Upload incomplete", "code": "UPLOAD_INCOMPLETE"})
			return
		}
		expectedChecksum, readChecksumErr := os.ReadFile(checksumPath)
		if readChecksumErr != nil || len(strings.TrimSpace(string(expectedChecksum))) != 64 {
			in.Close()
			out.Close()
			s.Store.Root.Remove(temp)
			writeJSON(w, 422, map[string]string{"error": "Invalid chunk", "code": "INVALID_CHUNK"})
			return
		}
		chunkHash := sha256.New()
		nn, e := io.Copy(io.MultiWriter(out, h, chunkHash), in)
		in.Close()
		total += nn
		if e != nil {
			out.Close()
			s.Store.Root.Remove(temp)
			writeJSON(w, 422, map[string]string{"error": "Invalid chunk"})
			return
		}
		if !strings.EqualFold(strings.TrimSpace(string(expectedChecksum)), hex.EncodeToString(chunkHash.Sum(nil))) {
			out.Close()
			s.Store.Root.Remove(temp)
			writeJSON(w, 422, map[string]string{"error": "Chunk checksum does not match", "code": "CHUNK_CHECKSUM_MISMATCH"})
			return
		}
	}
	out.Sync()
	out.Close()
	if total != m.FileSize {
		s.Store.Root.Remove(temp)
		writeJSON(w, 422, map[string]string{"error": "Final upload size does not match"})
		return
	}
	if !s.quotaHasRoom(r.Context(), total) {
		s.Store.Root.Remove(temp)
		writeJSON(w, 507, map[string]string{"error": "Insufficient storage space", "code": "STORAGE_QUOTA_EXCEEDED"})
		return
	}
	if err := s.Store.Root.Rename(temp, rel); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to publish upload"})
		return
	}
	_ = os.RemoveAll(dir)
	_ = s.Index.Sync(r.Context(), rel)
	writeJSON(w, 200, map[string]any{"ok": true, "checksum": hex.EncodeToString(h.Sum(nil)), "file": map[string]any{"name": path.Base(rel), "size": total, "isImage": indexIsImage(rel)}})
	s.emit(r, "upload", map[string]any{"path": m.DestPath})
}
func (s *Server) chunkCancel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("uploadId")
	if !validID(id) {
		writeJSON(w, 400, map[string]string{"error": "Invalid upload ID"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	_ = os.RemoveAll(filepath.Join(s.Cfg.StorageDir, ".chunks", id))
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	dest, err := storage.Normalize(r.URL.Query().Get("path"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	if dest != "" {
		if err := s.Store.Root.MkdirAll(dest, 0o755); err != nil {
			writeJSON(w, 404, map[string]string{"error": "Folder not found"})
			return
		}
	}
	mr, err := r.MultipartReader()
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid multipart request"})
		return
	}
	uploaded := []map[string]any{}
	type pendingUpload struct {
		temp string
		rel  string
		size int64
	}
	pending := []pendingUpload{}
	var pendingBytes int64
	cleanup := func() {
		for _, file := range pending {
			_ = s.Store.Root.Remove(file.temp)
		}
	}
	count := 0
	for {
		part, e := mr.NextPart()
		if errors.Is(e, io.EOF) {
			break
		}
		if e != nil {
			cleanup()
			writeJSON(w, 400, map[string]string{"error": "Invalid upload"})
			return
		}
		if part.FormName() != "files" {
			continue
		}
		count++
		if count > s.Cfg.MaxUploadFiles {
			cleanup()
			writeJSON(w, 400, map[string]string{"error": "Too many files"})
			return
		}
		name := sanitizeName(part.FileName())
		if name == "" {
			continue
		}
		rel := path.Join(dest, name)
		if r.URL.Query().Get("autorename") == "true" {
			rel = s.unique(rel)
		}
		temp := rel + ".uploading-" + randomToken(6)
		f, e := s.Store.Root.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if e != nil {
			cleanup()
			writeJSON(w, 500, map[string]string{"error": "Unable to start upload"})
			return
		}
		n, e := io.CopyN(f, part, s.Cfg.MaxUploadSizeBytes+1)
		f.Sync()
		f.Close()
		if e != nil && e != io.EOF {
			s.Store.Root.Remove(temp)
			cleanup()
			writeJSON(w, 413, map[string]string{"error": "Content exceeds the allowed limit"})
			return
		}
		if n > s.Cfg.MaxUploadSizeBytes {
			s.Store.Root.Remove(temp)
			cleanup()
			writeJSON(w, 413, map[string]string{"error": "Content exceeds the allowed limit"})
			return
		}
		pendingBytes += n
		pending = append(pending, pendingUpload{temp: temp, rel: rel, size: n})
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	if !s.quotaHasRoom(r.Context(), pendingBytes) {
		cleanup()
		writeJSON(w, 507, map[string]string{"error": "Insufficient storage space", "code": "STORAGE_QUOTA_EXCEEDED"})
		return
	}
	published := []string{}
	for _, file := range pending {
		if err := s.Store.Root.Rename(file.temp, file.rel); err != nil {
			for _, rel := range published {
				_ = s.Store.Root.Remove(rel)
			}
			cleanup()
			writeJSON(w, 500, map[string]string{"error": "Unable to publish upload"})
			return
		}
		published = append(published, file.rel)
		uploaded = append(uploaded, map[string]any{"name": path.Base(file.rel), "size": file.size, "isImage": indexIsImage(file.rel)})
	}
	_ = s.Index.Sync(r.Context(), dest)
	writeJSON(w, 200, map[string]any{"ok": true, "files": uploaded})
	if len(uploaded) > 0 {
		s.emit(r, "upload", map[string]any{"path": dest})
	}
}

func (s *Server) frontend(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/f/") {
		http.NotFound(w, r)
		return
	}
	if requested := strings.TrimPrefix(path.Clean(r.URL.Path), "/"); requested != "" && requested != "." {
		asset := filepath.Join(s.Cfg.ClientDist, filepath.FromSlash(requested))
		if info, err := os.Stat(asset); err == nil && !info.IsDir() {
			http.ServeFile(w, r, asset)
			return
		}
	}
	indexPath := filepath.Join(s.Cfg.ClientDist, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Frontend not built"})
		return
	}
	http.ServeFile(w, r, indexPath)
}

func (s *Server) emit(r *http.Request, event string, data map[string]any) {
	origin := r.Header.Get("X-Client-ID")
	payload := realtime.Event{Event: event, OriginID: origin}
	if v, ok := data["path"].(string); ok {
		payload.Path = v
	}
	if v, ok := data["from"].(string); ok {
		payload.From = v
	}
	if v, ok := data["to"].(string); ok {
		payload.To = v
	}
	if v, ok := data["paths"].([]string); ok {
		payload.Paths = v
	}
	s.Hub.Publish(payload)
}
func (s *Server) unique(rel string) string {
	if _, err := s.Store.Stat(rel); errors.Is(err, fs.ErrNotExist) {
		return rel
	}
	ext := path.Ext(rel)
	base := strings.TrimSuffix(rel, ext)
	for n := 1; n < 1000; n++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, n, ext)
		if _, err := s.Store.Stat(candidate); errors.Is(err, fs.ErrNotExist) {
			return candidate
		}
	}
	return rel + "-unique"
}
func (s *Server) zipFileName() string { return "open-drive.zip" }
func copyRoot(s *storage.Store, from, to string) error {
	info, err := s.Stat(from)
	if err != nil {
		return err
	}
	if info.IsDir() {
		if err := s.Root.MkdirAll(to, 0o755); err != nil {
			return err
		}
		entries, err := fs.ReadDir(s.FS(), from)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			if err := copyRoot(s, path.Join(from, entry.Name()), path.Join(to, entry.Name())); err != nil {
				return err
			}
		}
		return nil
	}
	in, err := s.Open(from)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := s.Root.OpenFile(to, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(v); err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid JSON"})
		return false
	}
	return true
}

func safeHeaderFilename(name string) string {
	return strings.NewReplacer("\"", "_", "\r", "_", "\n", "_").Replace(name)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func atoi(v string) int { n, _ := strconv.Atoi(v); return n }
func optionalInt64(v string) *int64 {
	if v == "" {
		return nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n < 0 {
		return nil
	}
	return &n
}
func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
func parentOf(v string) string {
	p := path.Dir(v)
	if p == "." {
		return ""
	}
	return p
}
func sanitizeName(v string) string {
	return strings.TrimSpace(strings.NewReplacer("/", "_", "\\", "_").Replace(v))
}
func validID(v string) bool {
	if len(v) < 8 || len(v) > 64 {
		return false
	}
	for _, r := range v {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
			return false
		}
	}
	return true
}
func randomToken(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(b)
}
func parents(paths []string) []string {
	set := map[string]bool{}
	for _, p := range paths {
		set[parentOf(p)] = true
	}
	out := []string{}
	for p := range set {
		out = append(out, p)
	}
	return out
}
func indexIsImage(v string) bool {
	ext := strings.ToLower(path.Ext(v))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg":
		return true
	}
	return false
}
