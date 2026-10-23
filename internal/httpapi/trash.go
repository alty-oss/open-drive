package httpapi

import (
	"archive/zip"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/storage"
)

func (s *Server) trashPreview(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var trashPath, name string
	if err := s.db.DB.QueryRowContext(r.Context(), "SELECT trash_path,name FROM trash_items WHERE id=? AND state='active'", id).Scan(&trashPath, &name); err != nil {
		http.NotFound(w, r)
		return
	}

	f, err := s.store.Root.Open(trashPath)
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

func (s *Server) trashList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.DB.QueryContext(r.Context(), `SELECT id,name,original_path,original_parent,trash_path,is_folder,size,created_at,modified_at,deleted_at,state FROM trash_items WHERE state='active' ORDER BY deleted_at DESC,id DESC`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to list trash"})
		return
	}
	defer rows.Close()
	allItems := []map[string]any{}
	for rows.Next() {
		item, ok := scanTrash(rows)
		if ok {
			allItems = append(allItems, item)
		}
	}
	q := r.URL.Query()
	if q.Get("pageSize") == "" && q.Get("cursor") == "" && q.Get("q") == "" {
		writeJSON(w, 200, allItems)
		return
	}
	var cursor trashCursor
	var cursorErr error
	if raw := q.Get("cursor"); raw != "" {
		cursor, cursorErr = decodeTrashCursor(raw)
		if cursorErr != nil {
			writeJSON(w, 400, map[string]string{"error": "Invalid trash pagination cursor", "code": "INVALID_TRASH_CURSOR"})
			return
		}
	}
	term := strings.ToLower(strings.TrimSpace(q.Get("q")))
	filtered := make([]map[string]any, 0, len(allItems))
	for _, item := range allItems {
		if term != "" && !strings.Contains(strings.ToLower(item["name"].(string)), term) && !strings.Contains(strings.ToLower(item["originalPath"].(string)), term) {
			continue
		}
		if cursor.Valid && !trashAfterCursor(item, cursor) {
			continue
		}
		filtered = append(filtered, item)
	}
	limit := clampCompatPageSize(atoi(q.Get("pageSize")), 100, 200)
	items := filtered
	var next any
	if len(filtered) > limit {
		items = filtered[:limit]
		last := items[len(items)-1]
		next = encodeTrashCursor(trashCursor{DeletedAt: parseTimeMillis(last["deletedAt"]), ID: last["id"].(string)})
	}
	writeJSON(w, 200, map[string]any{"items": items, "nextCursor": next, "total": len(filtered)})
}

func (s *Server) deleteFile(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil || rel == "" {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	deleted, err := s.moveToTrash(r, rel)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			writeJSON(w, 404, map[string]string{"error": "Item not found"})
			return
		}
		writeJSON(w, 500, map[string]string{"error": "Unable to delete item"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "id": deleted})
}

func (s *Server) deleteBatch(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Paths []string `json:"paths"`
	}
	if !decode(w, r, &b) {
		return
	}
	count := 0
	for _, raw := range b.Paths {
		if rel, err := storage.Normalize(raw); err == nil && rel != "" {
			if _, err := s.moveToTrash(r, rel); err == nil {
				count++
			}
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "deleted": count})
}

func (s *Server) moveToTrash(r *http.Request, rel string) (string, error) {
	s.mutate.Lock()
	defer s.mutate.Unlock()
	info, err := s.store.Stat(rel)
	if err != nil {
		return "", err
	}
	id := randomToken(16)
	trashRel := path.Join(".trash/items", id)
	if err := s.store.Root.Rename(rel, trashRel); err != nil {
		return "", err
	}
	now := time.Now().UnixMilli()
	_, err = s.db.DB.ExecContext(r.Context(), `INSERT INTO trash_items(id,name,original_path,original_parent,trash_path,is_folder,size,created_at,modified_at,deleted_at,state) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, id, path.Base(rel), rel, parentOf(rel), trashRel, boolInt(info.IsDir()), max64(info.Size(), 0), info.ModTime().UnixMilli(), info.ModTime().UnixMilli(), now, "active")
	if err != nil {
		_ = s.store.Root.Rename(trashRel, rel)
		return "", err
	}
	prefix := escapeLike(rel) + "/%"
	_, _ = s.db.DB.ExecContext(r.Context(), "DELETE FROM access_rules WHERE path=? OR path LIKE ? ESCAPE '\\'", rel, prefix)
	_, _ = s.db.DB.ExecContext(r.Context(), "UPDATE shared_links SET revoked_at=COALESCE(revoked_at,?) WHERE path=? OR path LIKE ? ESCAPE '\\'", now, rel, prefix)
	_, _ = s.db.DB.ExecContext(r.Context(), "DELETE FROM favorites WHERE path=? OR path LIKE ? ESCAPE '\\'", rel, prefix)
	_ = s.index.Sync(r.Context(), rel)
	s.emit(r, "trash", map[string]any{"path": parentOf(rel)})
	return id, nil
}

func (s *Server) trashRestore(w http.ResponseWriter, r *http.Request) {
	var b struct {
		ID string `json:"id"`
	}
	if !decode(w, r, &b) {
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	var original, trashPath string
	if err := s.db.DB.QueryRowContext(r.Context(), "SELECT original_path,trash_path FROM trash_items WHERE id=? AND state='active'", b.ID).Scan(&original, &trashPath); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	dest := original
	if _, err := s.store.Stat(dest); err == nil {
		dest = s.uniqueRestorePath(original)
	}
	if err := s.store.Root.MkdirAll(path.Dir(dest), 0o755); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to restore item"})
		return
	}
	if err := s.store.Root.Rename(trashPath, dest); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to restore item"})
		return
	}
	if _, err := s.db.DB.ExecContext(r.Context(), "DELETE FROM trash_items WHERE id=?", b.ID); err != nil {
		_ = s.store.Root.Rename(dest, trashPath)
		writeJSON(w, 500, map[string]string{"error": "Unable to finish restore"})
		return
	}
	_ = s.index.Sync(r.Context(), dest)
	writeJSON(w, 200, map[string]any{"ok": true, "restoredPath": dest, "renamed": dest != original})
}

func (s *Server) trashDelete(w http.ResponseWriter, r *http.Request) {
	var b struct {
		ID  string   `json:"id"`
		IDs []string `json:"ids"`
	}
	if !decode(w, r, &b) {
		return
	}
	s.mutate.Lock()
	defer s.mutate.Unlock()
	ids := b.IDs
	if b.ID != "" {
		ids = append(ids, b.ID)
	}
	deleted := 0
	for _, id := range ids {
		var trashPath string
		if s.db.DB.QueryRowContext(r.Context(), "SELECT trash_path FROM trash_items WHERE id=?", id).Scan(&trashPath) != nil {
			continue
		}
		_ = s.store.Root.RemoveAll(trashPath)
		if result, err := s.db.DB.ExecContext(r.Context(), "DELETE FROM trash_items WHERE id=?", id); err == nil && mustRows(result) > 0 {
			deleted++
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "deleted": deleted})
}

func (s *Server) trashEmpty(w http.ResponseWriter, r *http.Request) {
	s.mutate.Lock()
	defer s.mutate.Unlock()
	rows, _ := s.db.DB.QueryContext(r.Context(), "SELECT id,trash_path FROM trash_items WHERE state='active'")
	ids := []string{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, p string
			if rows.Scan(&id, &p) == nil {
				_ = s.store.Root.RemoveAll(p)
				ids = append(ids, id)
			}
		}
	}
	for _, id := range ids {
		_, _ = s.db.DB.ExecContext(r.Context(), "DELETE FROM trash_items WHERE id=?", id)
	}
	writeJSON(w, 200, map[string]any{"ok": true, "deleted": len(ids)})
}

func (s *Server) downloadTrashZip(w http.ResponseWriter, r *http.Request) {
	var ids []string
	if r.Method == http.MethodPost {
		if err := r.ParseForm(); err == nil {
			ids = append(ids, r.Form["ids"]...)
		}
	} else {
		ids = append(ids, r.URL.Query()["ids"]...)
	}
	if len(ids) == 0 {
		writeJSON(w, 400, map[string]string{"error": "No items specified"})
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="open-drive.zip"`)
	zw := zip.NewWriter(w)
	for _, id := range ids {
		var trashPath, name string
		if s.db.DB.QueryRowContext(r.Context(), "SELECT trash_path,name FROM trash_items WHERE id=? AND state='active'", id).Scan(&trashPath, &name) != nil {
			continue
		}
		_ = fs.WalkDir(s.store.FS(), trashPath, func(rel string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil || entry.IsDir() {
				return nil
			}
			f, err := s.store.Root.Open(rel)
			if err != nil {
				return nil
			}
			defer f.Close()
			archiveName := name
			if rel != trashPath {
				archiveName = path.Join(name, strings.TrimPrefix(rel, trashPath+"/"))
			}
			h := &zip.FileHeader{Name: archiveName, Method: zip.Deflate}
			if info, infoErr := entry.Info(); infoErr == nil {
				h.SetModTime(info.ModTime())
			}
			out, createErr := zw.CreateHeader(h)
			if createErr == nil {
				_, _ = io.Copy(out, f)
			}
			return nil
		})
	}
	_ = zw.Close()
}

func (s *Server) uniqueRestorePath(original string) string {
	ext := path.Ext(original)
	base := strings.TrimSuffix(original, ext)
	for n := 1; n < 10000; n++ {
		suffix := " (restored)"
		if n > 1 {
			suffix = fmt.Sprintf(" (restored %d)", n)
		}
		candidate := base + suffix + ext
		if _, err := s.store.Stat(candidate); errors.Is(err, fs.ErrNotExist) {
			return candidate
		}
	}
	return original + "-restored"
}

func scanTrash(rows interface{ Scan(...any) error }) (map[string]any, bool) {
	var id, name, original, parent, trashPath, state string
	var folder int
	var size, created, modified, deleted int64
	if rows.Scan(&id, &name, &original, &parent, &trashPath, &folder, &size, &created, &modified, &deleted, &state) != nil {
		return nil, false
	}
	return map[string]any{"id": id, "path": id, "name": name, "originalPath": original, "originalParent": parent, "trashPath": trashPath, "isFolder": folder != 0, "size": size, "date": time.UnixMilli(deleted).UTC().Format(time.RFC3339Nano), "createdAt": time.UnixMilli(created).UTC().Format(time.RFC3339Nano), "modifiedAt": time.UnixMilli(modified).UTC().Format(time.RFC3339Nano), "deletedAt": time.UnixMilli(deleted).UTC().Format(time.RFC3339Nano), "isTrash": true, "state": state}, true
}

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

type trashCursor struct {
	DeletedAt int64
	ID        string
	Valid     bool
}

func encodeTrashCursor(cursor trashCursor) string {
	raw, _ := json.Marshal(map[string]any{"v": 1, "deletedAt": cursor.DeletedAt, "id": cursor.ID})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeTrashCursor(raw string) (trashCursor, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return trashCursor{}, errors.New("cursor invalid")
	}
	var value struct {
		V         int    `json:"v"`
		DeletedAt int64  `json:"deletedAt"`
		ID        string `json:"id"`
	}
	if json.Unmarshal(decoded, &value) != nil || value.V != 1 || value.DeletedAt < 0 || value.ID == "" {
		return trashCursor{}, errors.New("cursor invalid")
	}
	return trashCursor{DeletedAt: value.DeletedAt, ID: value.ID, Valid: true}, nil
}

func trashAfterCursor(item map[string]any, cursor trashCursor) bool {
	deleted := parseTimeMillis(item["deletedAt"])
	id, _ := item["id"].(string)
	return deleted < cursor.DeletedAt || (deleted == cursor.DeletedAt && id < cursor.ID)
}

func parseTimeMillis(value any) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case string:
		if parsed, err := time.Parse(time.RFC3339Nano, v); err == nil {
			return parsed.UnixMilli()
		}
	}
	return 0
}

func escapeLike(value string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(value)
}

func clampCompatPageSize(value, defaultValue, maximum int) int {
	if value == 0 {
		return defaultValue
	}
	if value < 1 {
		return 1
	}
	if value > maximum {
		return maximum
	}
	return value
}

func mustRows(result sql.Result) int64 { n, _ := result.RowsAffected(); return n }
