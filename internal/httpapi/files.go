package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/index"
	"github.com/alty-oss/open-drive/internal/realtime"
	"github.com/alty-oss/open-drive/internal/storage"
)

func (s *Server) listFiles(w http.ResponseWriter, r *http.Request) {
	page, err := s.index.List(r.Context(), r.URL.Query().Get("path"), r.URL.Query().Get("cursor"), atoi(r.URL.Query().Get("pageSize")))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid pagination cursor", "code": "INVALID_CURSOR"})
		return
	}
	writeJSON(w, 200, page)
}

func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, err := s.index.SearchWithOptions(r.Context(), index.SearchOptions{
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
	stats, err := s.index.Stats(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to read storage"})
		return
	}
	usage := stats["used"].(int64)
	var trashCount, trashSize int64
	_ = s.db.DB.QueryRowContext(r.Context(), "SELECT COUNT(*), COALESCE(SUM(size),0) FROM trash_items WHERE state='active'").Scan(&trashCount, &trashSize)
	writeJSON(w, 200, map[string]any{"used": usage, "quota": s.cfg.StorageQuotaBytes, "available": max64(0, s.cfg.StorageQuotaBytes-usage-trashSize), "fileCount": stats["fileCount"], "folderCount": stats["folderCount"], "trashCount": trashCount, "trashSize": trashSize, "totalUsed": usage + trashSize, "maxUploadSize": s.cfg.MaxUploadSizeBytes, "byType": stats["byType"]})
}

func (s *Server) storage(w http.ResponseWriter, r *http.Request) {
	stats, err := s.index.Stats(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to read storage"})
		return
	}
	writeJSON(w, 200, map[string]any{"used": stats["used"]})
}

func (s *Server) quotaHasRoom(ctx context.Context, incoming int64) bool {
	stats, err := s.index.Stats(ctx)
	if err != nil {
		return false
	}
	var trashSize int64
	if err := s.db.DB.QueryRowContext(ctx, "SELECT COALESCE(SUM(size),0) FROM trash_items WHERE state='active'").Scan(&trashSize); err != nil {
		return false
	}
	return stats["used"].(int64)+trashSize+incoming <= s.cfg.StorageQuotaBytes
}

func (s *Server) content(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	f, err := s.store.Open(rel)
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
	info, err := s.store.Lstat(rel)
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
	f, err := s.store.Open(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	serveContent(w, r, info.Name(), info.ModTime(), f, true)
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
	if _, err := s.store.Stat(parent); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Folder not found"})
		return
	}
	rel := path.Join(parent, name)
	if _, err := s.store.Stat(rel); err == nil {
		writeJSON(w, 409, map[string]string{"error": "Folder already exists"})
		return
	}
	if err := s.store.Root.Mkdir(rel, 0o755); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to create folder"})
		return
	}
	_ = s.index.Sync(r.Context(), rel)
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
		if _, err := s.store.Stat(rel); errors.Is(err, fs.ErrNotExist) {
			if err := s.store.Root.MkdirAll(rel, 0o755); err == nil {
				created++
			}
		}
	}
	_ = s.index.Sync(r.Context(), base)
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
	f, err := s.store.Root.OpenFile(rel, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
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
	_ = s.index.Sync(r.Context(), rel)
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
	info, err := s.store.Stat(from)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	if _, err := s.store.Stat(to); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Destination folder not found"})
		return
	}
	dest := path.Join(to, path.Base(from))
	if _, err := s.store.Stat(dest); err == nil {
		writeJSON(w, 409, map[string]string{"error": "An item with this name already exists in the destination"})
		return
	}
	if info.IsDir() && (to == from || strings.HasPrefix(to, from+"/")) {
		writeJSON(w, 400, map[string]string{"error": "A folder cannot be moved inside itself"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	if err := s.store.Root.Rename(from, dest); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to move item"})
		return
	}
	if err := s.remapPathMetadata(from, dest); err != nil {
		_ = s.store.Root.Rename(dest, from)
		writeJSON(w, 500, map[string]string{"error": "Unable to update item metadata"})
		return
	}
	_ = s.index.Sync(r.Context(), from, dest)
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
	if _, err := s.store.Stat(from); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	dest := path.Join(parentOf(from), b.NewName)
	if _, err := s.store.Stat(dest); err == nil {
		writeJSON(w, 409, map[string]string{"error": "An item with this name already exists"})
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	if err := s.store.Root.Rename(from, dest); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to rename item"})
		return
	}
	if err := s.remapPathMetadata(from, dest); err != nil {
		_ = s.store.Root.Rename(dest, from)
		writeJSON(w, 500, map[string]string{"error": "Unable to update item metadata"})
		return
	}
	_ = s.index.Sync(r.Context(), from, dest)
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
	if _, err := s.store.Stat(to); err != nil {
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
		if _, err := s.store.Stat(from); err != nil {
			continue
		}
		dest := path.Join(to, path.Base(from))
		dest = s.unique(dest)
		if strings.HasPrefix(dest, from+"/") {
			continue
		}
		if err := copyRoot(s.store, from, dest); err == nil {
			copied++
		}
	}
	if copied > 0 {
		_ = s.index.Sync(r.Context(), to)
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
	if _, err := s.store.Stat(to); err != nil {
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
		info, err := s.store.Stat(from)
		if err != nil {
			continue
		}
		dest := path.Join(to, path.Base(from))
		if _, err := s.store.Stat(dest); err == nil || (info.IsDir() && strings.HasPrefix(to, from+"/")) {
			continue
		}
		if err := s.store.Root.Rename(from, dest); err != nil {
			continue
		}
		if err := s.remapPathMetadata(from, dest); err != nil {
			_ = s.store.Root.Rename(dest, from)
			continue
		}
		moved++
		touched = append(touched, from, dest)
	}
	if moved > 0 {
		_ = s.index.Sync(r.Context(), to)
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
	f, err := s.store.Root.OpenFile(rel, os.O_WRONLY|os.O_TRUNC, 0)
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
	_ = s.index.Sync(r.Context(), rel)
	writeJSON(w, 200, map[string]bool{"ok": true})
	s.emit(r, "edit", map[string]any{"path": parentOf(rel)})
}

func (s *Server) editorRead(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "File not found"})
		return
	}
	f, err := s.store.Open(rel)
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
	s.hub.Publish(payload)
}

func (s *Server) unique(rel string) string {
	if _, err := s.store.Stat(rel); errors.Is(err, fs.ErrNotExist) {
		return rel
	}
	ext := path.Ext(rel)
	base := strings.TrimSuffix(rel, ext)
	for n := 1; n < 1000; n++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, n, ext)
		if _, err := s.store.Stat(candidate); errors.Is(err, fs.ErrNotExist) {
			return candidate
		}
	}
	return rel + "-unique"
}

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

func sanitizeName(v string) string {
	return strings.TrimSpace(strings.NewReplacer("/", "_", "\\", "_").Replace(v))
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
