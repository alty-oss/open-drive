package httpapi

import (
	"archive/zip"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"

	"open-drive/internal/metadata"
	"open-drive/internal/storage"
)

func (s *Server) username(r *http.Request) string {
	name, _ := s.Auth.Current(r)
	return name
}

func (s *Server) remapPathMetadata(from, to string) error {
	if from == "" || to == "" || from == to {
		return nil
	}
	tx, err := s.DB.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	escapedFrom := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(from)
	oldPrefix := escapedFrom + "/%"
	for _, table := range []string{"access_rules", "shared_links", "favorites"} {

		query := "UPDATE " + table + " SET path = CASE WHEN path = ? THEN ? ELSE ? || substr(path, length(?) + 1) END WHERE path = ? OR path LIKE ? ESCAPE '\\'"
		if _, err := tx.Exec(query, from, to, to, from, from, oldPrefix); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Server) favorites(w http.ResponseWriter, r *http.Request) {
	username := s.username(r)
	switch r.Method {
	case http.MethodGet:
		s.writeFavorites(w, r, username)
	case http.MethodPut:
		var b struct {
			Path string `json:"path"`
		}
		if !decode(w, r, &b) {
			return
		}
		rel, err := storage.Normalize(b.Path)
		info, statErr := s.Store.Stat(rel)
		if err != nil || statErr != nil || !info.IsDir() || rel == "" {
			writeJSON(w, 404, map[string]string{"error": "Folder not found"})
			return
		}
		_, _ = s.DB.DB.ExecContext(r.Context(), "INSERT OR IGNORE INTO favorites(username,path,created_at) VALUES(?,?,?)", username, rel, time.Now().UnixMilli())
		s.writeFavorites(w, r, username)
	case http.MethodDelete:
		rel, _ := storage.Normalize(r.URL.Query().Get("path"))
		_, _ = s.DB.DB.ExecContext(r.Context(), "DELETE FROM favorites WHERE username=? AND path=?", username, rel)
		s.writeFavorites(w, r, username)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) writeFavorites(w http.ResponseWriter, r *http.Request, username string) {
	rows, err := s.DB.DB.QueryContext(r.Context(), "SELECT path FROM favorites WHERE username=? ORDER BY created_at,path", username)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to list favorites"})
		return
	}
	defer rows.Close()
	items := []map[string]string{}
	for rows.Next() {
		var p string
		if rows.Scan(&p) == nil {
			items = append(items, map[string]string{"path": p, "name": path.Base(p)})
		}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) access(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.URL.Query().Get("path"))
	if r.Method == http.MethodPut {
		var b struct {
			Path       string `json:"path"`
			Visibility string `json:"visibility"`
		}
		if !decode(w, r, &b) {
			return
		}
		rel, err = storage.Normalize(b.Path)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "Invalid path"})
			return
		}
		if b.Visibility != "public" && b.Visibility != "private" {
			writeJSON(w, 400, map[string]string{"error": "Invalid visibility", "code": "INVALID_VISIBILITY"})
			return
		}
		if _, statErr := s.Store.Stat(rel); statErr != nil {
			writeJSON(w, 404, map[string]string{"error": "Item not found"})
			return
		}
		_, err = s.DB.DB.ExecContext(r.Context(), `INSERT INTO access_rules(path,visibility,updated_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET visibility=excluded.visibility,updated_at=excluded.updated_at`, rel, b.Visibility, time.Now().UnixMilli())
	} else if r.Method == http.MethodDelete {
		if err == nil {
			_, err = s.DB.DB.ExecContext(r.Context(), "DELETE FROM access_rules WHERE path=?", rel)
		}
	}
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	info, statErr := s.Store.Stat(rel)
	if statErr != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	visibility, source, inherited := s.visibility(rel)
	writeJSON(w, 200, map[string]any{"ok": true, "path": rel, "isFolder": info.IsDir(), "visibility": visibility, "isPublic": visibility == "public", "source": source, "inheritedFrom": inherited})
}

func (s *Server) visibility(rel string) (string, string, *string) {
	for candidate := rel; ; candidate = parentOf(candidate) {
		var v string
		if s.DB.DB.QueryRow("SELECT visibility FROM access_rules WHERE path=?", candidate).Scan(&v) == nil {
			if candidate == rel {
				return v, "explicit", nil
			}
			return v, "inherited", &candidate
		}
		if candidate == "" {
			break
		}
	}
	return "private", "default", nil
}

func (s *Server) links(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		rel, err := storage.Normalize(r.URL.Query().Get("path"))
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "Invalid path"})
			return
		}
		rows, err := s.DB.DB.QueryContext(r.Context(), "SELECT id,token,path,link_type,expires_at,created_at,revoked_at,access_count,last_accessed_at FROM shared_links WHERE path=? ORDER BY created_at DESC", rel)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "Unable to list links"})
			return
		}
		defer rows.Close()
		items := []map[string]any{}
		for rows.Next() {
			if item, ok := scanLink(rows); ok {
				items = append(items, item)
			}
		}
		writeJSON(w, 200, map[string]any{"path": rel, "links": items})
		return
	}
	if r.Method == http.MethodPost {
		var b struct {
			Path      string `json:"path"`
			Type      string `json:"type"`
			ExpiresAt string `json:"expiresAt"`
		}
		if !decode(w, r, &b) {
			return
		}
		rel, err := storage.Normalize(b.Path)
		if err != nil || (b.Type != "share" && b.Type != "download") {
			writeJSON(w, 400, map[string]string{"error": "Invalid link type"})
			return
		}
		if _, err := s.Store.Stat(rel); err != nil {
			writeJSON(w, 404, map[string]string{"error": "Item not found"})
			return
		}
		var expires any
		if b.ExpiresAt != "" {
			t, parseErr := time.Parse(time.RFC3339, b.ExpiresAt)
			if parseErr != nil || !t.After(time.Now()) {
				writeJSON(w, 400, map[string]string{"error": "Expiration must be in the future", "code": "INVALID_EXPIRATION"})
				return
			}
			expires = t.UnixMilli()
		}
		id := randomToken(16)
		token := randomBase64Token(32)
		_, err = s.DB.DB.ExecContext(r.Context(), "INSERT INTO shared_links(id,token,path,link_type,expires_at,created_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)", id, token, rel, b.Type, expires, time.Now().UnixMilli())
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": "Unable to create link"})
			return
		}
		writeJSON(w, 201, linkObject(id, token, rel, b.Type, expires, time.Now().UnixMilli(), nil, 0, nil))
		return
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (s *Server) linkAction(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if r.Method == http.MethodDelete {
		result, err := s.DB.DB.ExecContext(r.Context(), "UPDATE shared_links SET revoked_at=COALESCE(revoked_at,?) WHERE id=?", time.Now().UnixMilli(), id)
		if err != nil || mustRows(result) == 0 {
			writeJSON(w, 404, map[string]string{"error": "Link not found"})
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
		return
	}
	w.WriteHeader(http.StatusMethodNotAllowed)
}

func (s *Server) linksPurge(w http.ResponseWriter, r *http.Request) {
	result, err := s.DB.DB.ExecContext(r.Context(), "DELETE FROM shared_links WHERE revoked_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at <= ?)", time.Now().UnixMilli())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to clear link history"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "removed": mustRows(result)})
}

func (s *Server) linkPurge(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var expires, revoked sql.NullInt64
	if err := s.DB.DB.QueryRowContext(r.Context(), "SELECT expires_at,revoked_at FROM shared_links WHERE id=?", id).Scan(&expires, &revoked); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Link not found"})
		return
	}
	if !revoked.Valid && (!expires.Valid || expires.Int64 > time.Now().UnixMilli()) {
		writeJSON(w, 409, map[string]string{"error": "Revoke the link before deleting it from history", "code": "LINK_STILL_ACTIVE"})
		return
	}
	_, _ = s.DB.DB.ExecContext(r.Context(), "DELETE FROM shared_links WHERE id=?", id)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) linksAll(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	statusFilter := q.Get("status")
	if statusFilter != "" && statusFilter != "all" && statusFilter != "active" && statusFilter != "expired" && statusFilter != "revoked" && statusFilter != "inactive" {
		statusFilter = "all"
	}
	typeFilter := q.Get("type")
	if typeFilter != "share" && typeFilter != "download" {
		typeFilter = ""
	}
	searchFilter := strings.ToLower(strings.TrimSpace(q.Get("search")))
	rows, err := s.DB.DB.QueryContext(r.Context(), `SELECT
		shared_links.id, shared_links.token, shared_links.path, shared_links.link_type,
		shared_links.expires_at, shared_links.created_at, shared_links.revoked_at,
		shared_links.access_count, shared_links.last_accessed_at,
		CASE WHEN files.path IS NULL THEN 0 ELSE 1 END,
		COALESCE(files.is_folder, 0)
		FROM shared_links LEFT JOIN files ON files.path = shared_links.path
		ORDER BY shared_links.created_at DESC, shared_links.id DESC`)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to list links"})
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	counts := map[string]int{"all": 0, "active": 0, "expired": 0, "revoked": 0}
	var cursor linkCursor
	if raw := q.Get("cursor"); raw != "" {
		cursor, err = decodeLinkCursor(raw)
		if err != nil {
			writeJSON(w, 400, map[string]string{"error": "Invalid pagination cursor", "code": "INVALID_CURSOR"})
			return
		}
	}
	limit := clampCompatPageSize(atoi(q.Get("pageSize")), 50, 100)
	filtered := []map[string]any{}
	for rows.Next() {
		item, exists, isFolder, ok := scanLinkWithTarget(rows)
		if !ok {
			continue
		}
		status := item["status"].(string)
		counts["all"]++
		if status == "active" || status == "expired" || status == "revoked" {
			counts[status]++
		}
		if statusFilter == "inactive" {
			if status != "expired" && status != "revoked" {
				continue
			}
		} else if statusFilter != "" && statusFilter != "all" && statusFilter != status {
			continue
		}
		if typeFilter != "" && item["type"] != typeFilter {
			continue
		}
		if searchFilter != "" && !strings.Contains(strings.ToLower(item["path"].(string)), searchFilter) {
			continue
		}
		if cursor.Valid && !linkAfterCursor(item, cursor) {
			continue
		}
		item["targetExists"] = exists
		item["isFolder"] = isFolder
		filtered = append(filtered, item)
	}
	if len(filtered) > limit {
		items = filtered[:limit]
	} else {
		items = filtered
	}
	var next any
	if len(filtered) > limit {
		last := items[len(items)-1]
		next = encodeLinkCursor(linkCursor{CreatedAt: parseTimeMillis(last["createdAt"]), ID: last["id"].(string)})
	}
	writeJSON(w, 200, map[string]any{"items": items, "nextCursor": next, "counts": counts})
}

func (s *Server) metadata(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	info, err := s.Store.Stat(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	category := "other"
	if info.IsDir() {
		category = "folder"
	}
	item := map[string]any{"path": rel, "name": path.Base(rel), "size": info.Size(), "category": category, "extension": strings.TrimPrefix(path.Ext(rel), "."), "modifiedAt": info.ModTime().UTC().Format(time.RFC3339Nano), "createdAt": info.ModTime().UTC().Format(time.RFC3339Nano), "kind": "none"}
	if info.IsDir() {
		item["kind"] = "folder"
	} else {
		kind, data, extractionError := s.fileMetadata(r.Context(), rel, info)
		item["kind"] = kind
		for key, value := range data {
			item[key] = value
		}
		if extractionError != "" {
			item["error"] = extractionError
		}
	}
	visibility, source, inherited := s.visibility(rel)
	item["visibility"], item["visibilitySource"], item["visibilityInheritedFrom"] = visibility, source, inherited
	writeJSON(w, 200, item)
}

func (s *Server) fileMetadata(ctx context.Context, rel string, info fs.FileInfo) (string, map[string]any, string) {
	var kind, rawData, cachedError string
	err := s.DB.DB.QueryRowContext(ctx, "SELECT kind,data,COALESCE(error,'') FROM file_metadata WHERE path=? AND mtime_ms=? AND size=?", rel, info.ModTime().UnixMilli(), info.Size()).Scan(&kind, &rawData, &cachedError)
	if err == nil {
		data := map[string]any{}
		if json.Unmarshal([]byte(rawData), &data) == nil {
			return kind, data, cachedError
		}
	}
	kind, data, extractionErr := metadata.Extract(ctx, filepath.Join(s.Cfg.StorageDir, filepath.FromSlash(rel)), s.Cfg.MetadataProbe)
	raw, _ := json.Marshal(data)
	errorText := ""
	if extractionErr != nil {
		errorText = extractionErr.Error()
	}
	_, _ = s.DB.DB.ExecContext(ctx, `INSERT INTO file_metadata(path,mtime_ms,size,kind,data,error,extracted_at) VALUES(?,?,?,?,?,?,?)
ON CONFLICT(path) DO UPDATE SET mtime_ms=excluded.mtime_ms,size=excluded.size,kind=excluded.kind,data=excluded.data,error=excluded.error,extracted_at=excluded.extracted_at`, rel, info.ModTime().UnixMilli(), info.Size(), kind, string(raw), errorText, time.Now().UnixMilli())
	return kind, data, errorText
}

func (s *Server) subtitles(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		writeJSON(w, 200, []any{})
		return
	}
	dir, video := path.Dir(rel), path.Base(rel)
	base := strings.TrimSuffix(video, path.Ext(video))
	entries, err := fs.ReadDir(s.Store.FS(), dir)
	if err != nil {
		writeJSON(w, 200, []any{})
		return
	}
	tracks := []map[string]string{}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasPrefix(entry.Name(), base) {
			continue
		}
		ext := strings.ToLower(path.Ext(entry.Name()))
		if ext != ".srt" && ext != ".vtt" {
			continue
		}
		tracks = append(tracks, map[string]string{"label": strings.TrimSuffix(strings.TrimPrefix(entry.Name(), base), ext), "path": path.Join(dir, entry.Name())})
	}
	writeJSON(w, 200, tracks)
}

func (s *Server) subtitle(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	ext := strings.ToLower(path.Ext(rel))
	if ext != ".srt" && ext != ".vtt" {
		writeJSON(w, 400, map[string]string{"error": "Unsupported subtitle format"})
		return
	}
	f, err := s.Store.Open(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	body, err := io.ReadAll(io.LimitReader(f, 5<<20+1))
	if err != nil || len(body) > 5<<20 {
		writeJSON(w, 413, map[string]string{"error": "Subtitle is too large"})
		return
	}
	text := string(body)
	if ext == ".srt" {
		text = "WEBVTT\n\n" + strings.ReplaceAll(text, ",", ".")
	}
	w.Header().Set("Content-Type", "text/vtt; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write([]byte(text))
}

func (s *Server) publicLinkInfo(w http.ResponseWriter, r *http.Request) {
	link, ok := s.resolveLink(r.PathValue("token"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	target, info, ok := s.linkTarget(r, link)
	if !ok {
		http.NotFound(w, r)
		return
	}
	children := []any(nil)
	if link.typ == "share" && info.IsDir() {
		if entries, readErr := fs.ReadDir(s.Store.FS(), target); readErr == nil {
			children = []any{}
			for _, entry := range entries {
				child := path.Join(target, entry.Name())
				childInfo, statErr := s.Store.Stat(child)
				if statErr == nil && !storage.IsInternal(child) {
					children = append(children, s.publicItem(child, childInfo))
				}
			}
		}
	}
	writeJSON(w, 200, map[string]any{"mode": link.typ, "expiresAt": link.expiresAt, "rootName": path.Base(link.path), "item": s.publicItem(target, info), "children": children})
}

func (s *Server) publicLinkContent(w http.ResponseWriter, r *http.Request) {
	link, ok := s.resolveLink(r.PathValue("token"))
	if !ok {
		http.NotFound(w, r)
		return
	}
	target, info, ok := s.linkTarget(r, link)
	if !ok {
		http.NotFound(w, r)
		return
	}
	isDownload := strings.HasSuffix(r.URL.Path, "/download")
	isLegacyShare := strings.HasPrefix(r.URL.Path, "/s/")
	if isLegacyShare && link.typ != "share" {
		http.NotFound(w, r)
		return
	}
	if info.IsDir() && !isDownload && !isLegacyShare {
		http.NotFound(w, r)
		return
	}
	_, _ = s.DB.DB.Exec("UPDATE shared_links SET access_count=access_count+1,last_accessed_at=? WHERE id=?", time.Now().UnixMilli(), link.id)
	if isDownload || isLegacyShare {
		s.downloadTarget(w, r, target, info, path.Base(target))
		return
	}
	f, err := s.Store.Open(target)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	serveContent(w, r, path.Base(target), info.ModTime(), f, true)
}

func (s *Server) downloadTarget(w http.ResponseWriter, r *http.Request, rel string, info fs.FileInfo, name string) {
	if info.IsDir() {
		s.zipDirectory(w, r, rel, name, false)
		return
	}
	f, err := s.Store.Open(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	serveContent(w, r, name, info.ModTime(), f, true, true)
}

func (s *Server) linkTarget(r *http.Request, link resolvedLink) (string, fs.FileInfo, bool) {
	target := link.path
	child := strings.TrimSpace(r.URL.Query().Get("path"))
	if child != "" {
		if link.typ == "download" || strings.HasPrefix(child, "/") || strings.ContainsAny(child, `\\`) {
			return "", nil, false
		}
		child = path.Clean(child)
		if child == "." || child == ".." || strings.HasPrefix(child, "../") {
			return "", nil, false
		}
		target = path.Join(link.path, child)
	}
	info, err := s.Store.Stat(target)
	if err != nil {
		return "", nil, false
	}
	if child != "" {
		root := path.Clean(link.path)
		if !strings.HasPrefix(target, root+"/") {
			return "", nil, false
		}
	}
	return target, info, true
}

func (s *Server) publicPath(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil || rel == "" {
		http.NotFound(w, r)
		return
	}
	visibility, _, _ := s.visibility(rel)
	if visibility != "public" {
		http.NotFound(w, r)
		return
	}
	info, err := s.Store.Stat(rel)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if strings.HasPrefix(r.URL.Path, "/api/public-path-download/") {
		if info.IsDir() {
			s.zipDirectory(w, r, rel, path.Base(rel), true)
		} else {
			s.downloadTarget(w, r, rel, info, path.Base(rel))
		}
		return
	}
	children := []any{}
	if info.IsDir() {
		page, _ := s.Index.List(r.Context(), rel, "", 200)
		for _, child := range page.Items {
			if v, _, _ := s.visibility(child.Path); v == "public" {
				if childInfo, statErr := s.Store.Stat(child.Path); statErr == nil {
					children = append(children, s.publicItem(child.Path, childInfo))
				}
			}
		}
	}
	writeJSON(w, 200, map[string]any{"mode": "public", "item": s.publicItem(rel, info), "children": children})
}

func (s *Server) trashList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.DB.DB.QueryContext(r.Context(), `SELECT id,name,original_path,original_parent,trash_path,is_folder,size,created_at,modified_at,deleted_at,state FROM trash_items WHERE state='active' ORDER BY deleted_at DESC,id DESC`)
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
	info, err := s.Store.Stat(rel)
	if err != nil {
		return "", err
	}
	id := randomToken(16)
	trashRel := path.Join(".trash/items", id)
	if err := s.Store.Root.Rename(rel, trashRel); err != nil {
		return "", err
	}
	now := time.Now().UnixMilli()
	_, err = s.DB.DB.ExecContext(r.Context(), `INSERT INTO trash_items(id,name,original_path,original_parent,trash_path,is_folder,size,created_at,modified_at,deleted_at,state) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, id, path.Base(rel), rel, parentOf(rel), trashRel, boolInt(info.IsDir()), max64(info.Size(), 0), info.ModTime().UnixMilli(), info.ModTime().UnixMilli(), now, "active")
	if err != nil {
		_ = s.Store.Root.Rename(trashRel, rel)
		return "", err
	}
	prefix := escapeLike(rel) + "/%"
	_, _ = s.DB.DB.ExecContext(r.Context(), "DELETE FROM access_rules WHERE path=? OR path LIKE ? ESCAPE '\\'", rel, prefix)
	_, _ = s.DB.DB.ExecContext(r.Context(), "UPDATE shared_links SET revoked_at=COALESCE(revoked_at,?) WHERE path=? OR path LIKE ? ESCAPE '\\'", now, rel, prefix)
	_, _ = s.DB.DB.ExecContext(r.Context(), "DELETE FROM favorites WHERE path=? OR path LIKE ? ESCAPE '\\'", rel, prefix)
	_ = s.Index.Sync(r.Context(), rel)
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
	if err := s.DB.DB.QueryRowContext(r.Context(), "SELECT original_path,trash_path FROM trash_items WHERE id=? AND state='active'", b.ID).Scan(&original, &trashPath); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Item not found"})
		return
	}
	dest := original
	if _, err := s.Store.Stat(dest); err == nil {
		dest = s.uniqueRestorePath(original)
	}
	if err := s.Store.Root.MkdirAll(path.Dir(dest), 0o755); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to restore item"})
		return
	}
	if err := s.Store.Root.Rename(trashPath, dest); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to restore item"})
		return
	}
	if _, err := s.DB.DB.ExecContext(r.Context(), "DELETE FROM trash_items WHERE id=?", b.ID); err != nil {
		_ = s.Store.Root.Rename(dest, trashPath)
		writeJSON(w, 500, map[string]string{"error": "Unable to finish restore"})
		return
	}
	_ = s.Index.Sync(r.Context(), dest)
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
		if s.DB.DB.QueryRowContext(r.Context(), "SELECT trash_path FROM trash_items WHERE id=?", id).Scan(&trashPath) != nil {
			continue
		}
		_ = s.Store.Root.RemoveAll(trashPath)
		if result, err := s.DB.DB.ExecContext(r.Context(), "DELETE FROM trash_items WHERE id=?", id); err == nil && mustRows(result) > 0 {
			deleted++
		}
	}
	writeJSON(w, 200, map[string]any{"ok": true, "deleted": deleted})
}

func (s *Server) trashEmpty(w http.ResponseWriter, r *http.Request) {
	s.mutate.Lock()
	defer s.mutate.Unlock()
	rows, _ := s.DB.DB.QueryContext(r.Context(), "SELECT id,trash_path FROM trash_items WHERE state='active'")
	ids := []string{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, p string
			if rows.Scan(&id, &p) == nil {
				_ = s.Store.Root.RemoveAll(p)
				ids = append(ids, id)
			}
		}
	}
	for _, id := range ids {
		_, _ = s.DB.DB.ExecContext(r.Context(), "DELETE FROM trash_items WHERE id=?", id)
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
		if s.DB.DB.QueryRowContext(r.Context(), "SELECT trash_path,name FROM trash_items WHERE id=? AND state='active'", id).Scan(&trashPath, &name) != nil {
			continue
		}
		_ = fs.WalkDir(s.Store.FS(), trashPath, func(rel string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil || entry.IsDir() {
				return nil
			}
			f, err := s.Store.Root.Open(rel)
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
		if _, err := s.Store.Stat(candidate); errors.Is(err, fs.ErrNotExist) {
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

func (s *Server) publicItem(rel string, info fs.FileInfo) map[string]any {
	category := "other"
	if info.IsDir() {
		category = "folder"
	}
	return map[string]any{"path": rel, "name": path.Base(rel), "isFolder": info.IsDir(), "size": info.Size(), "category": category, "modifiedAt": info.ModTime().UTC().Format(time.RFC3339Nano), "createdAt": info.ModTime().UTC().Format(time.RFC3339Nano)}
}

type resolvedLink struct {
	id, path, typ string
	expiresAt     any
}

func (s *Server) resolveLink(token string) (resolvedLink, bool) {
	var link resolvedLink
	var expires, revoked sql.NullInt64
	if len(token) != 43 {
		return link, false
	}
	err := s.DB.DB.QueryRow("SELECT id,path,link_type,expires_at,revoked_at FROM shared_links WHERE token=?", token).Scan(&link.id, &link.path, &link.typ, &expires, &revoked)
	if err != nil || revoked.Valid || expires.Valid && expires.Int64 <= time.Now().UnixMilli() {
		return resolvedLink{}, false
	}
	if expires.Valid {
		link.expiresAt = time.UnixMilli(expires.Int64).UTC().Format(time.RFC3339Nano)
	}
	return link, true
}

func linkObject(id, token, rel, typ string, expires any, created int64, revoked any, count int64, accessed any) map[string]any {
	status := "active"
	if revoked != nil {
		status = "revoked"
	}
	if n, ok := expires.(int64); ok {
		if n <= time.Now().UnixMilli() {
			status = "expired"
		}
		expires = time.UnixMilli(n).UTC().Format(time.RFC3339Nano)
	}
	if value, ok := expires.(string); ok {
		if parsed, err := time.Parse(time.RFC3339Nano, value); err == nil && parsed.UnixMilli() <= time.Now().UnixMilli() {
			status = "expired"
		}
	}
	return map[string]any{"id": id, "token": token, "url": "/" + map[bool]string{true: "s", false: "d"}[typ == "share"] + "/" + token, "path": rel, "type": typ, "expiresAt": expires, "createdAt": time.UnixMilli(created).UTC().Format(time.RFC3339Nano), "revokedAt": revoked, "status": status, "accessCount": count, "lastAccessedAt": accessed}
}

func scanLink(rows interface{ Scan(...any) error }) (map[string]any, bool) {
	var id, token, rel, typ string
	var expires, created, revoked, accessed sql.NullInt64
	var count int64
	if rows.Scan(&id, &token, &rel, &typ, &expires, &created, &revoked, &count, &accessed) != nil {
		return nil, false
	}
	var expiresValue any
	if expires.Valid {
		expiresValue = time.UnixMilli(expires.Int64).UTC().Format(time.RFC3339Nano)
	}
	var revokedValue any
	if revoked.Valid {
		revokedValue = time.UnixMilli(revoked.Int64).UTC().Format(time.RFC3339Nano)
	}
	var accessedValue any
	if accessed.Valid {
		accessedValue = time.UnixMilli(accessed.Int64).UTC().Format(time.RFC3339Nano)
	}
	return linkObject(id, token, rel, typ, expiresValue, created.Int64, revokedValue, count, accessedValue), true
}

type linkCursor struct {
	CreatedAt int64
	ID        string
	Valid     bool
}

func encodeLinkCursor(cursor linkCursor) string {
	raw, _ := json.Marshal(map[string]any{"v": 1, "kind": "links", "createdAt": cursor.CreatedAt, "id": cursor.ID})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeLinkCursor(raw string) (linkCursor, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return linkCursor{}, errors.New("cursor invalid")
	}
	var value struct {
		V         int    `json:"v"`
		Kind      string `json:"kind"`
		CreatedAt int64  `json:"createdAt"`
		ID        string `json:"id"`
	}
	if json.Unmarshal(decoded, &value) != nil || value.V != 1 || value.Kind != "links" || value.CreatedAt < 0 || value.ID == "" {
		return linkCursor{}, errors.New("cursor invalid")
	}
	return linkCursor{CreatedAt: value.CreatedAt, ID: value.ID, Valid: true}, nil
}

func linkAfterCursor(item map[string]any, cursor linkCursor) bool {
	created := parseTimeMillis(item["createdAt"])
	id, _ := item["id"].(string)
	return created < cursor.CreatedAt || (created == cursor.CreatedAt && id < cursor.ID)
}

func scanLinkWithTarget(rows interface{ Scan(...any) error }) (map[string]any, bool, bool, bool) {
	var id, token, rel, typ string
	var expires, created, revoked, accessed sql.NullInt64
	var count int64
	var exists, isFolder int
	if rows.Scan(&id, &token, &rel, &typ, &expires, &created, &revoked, &count, &accessed, &exists, &isFolder) != nil {
		return nil, false, false, false
	}
	var expiresValue any
	if expires.Valid {
		expiresValue = time.UnixMilli(expires.Int64).UTC().Format(time.RFC3339Nano)
	}
	var revokedValue any
	if revoked.Valid {
		revokedValue = time.UnixMilli(revoked.Int64).UTC().Format(time.RFC3339Nano)
	}
	var accessedValue any
	if accessed.Valid {
		accessedValue = time.UnixMilli(accessed.Int64).UTC().Format(time.RFC3339Nano)
	}
	return linkObject(id, token, rel, typ, expiresValue, created.Int64, revokedValue, count, accessedValue), exists != 0, isFolder != 0, true
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
func randomBase64Token(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return base64.RawURLEncoding.EncodeToString([]byte(randomToken(n)))
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
