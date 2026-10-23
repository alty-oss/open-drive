package httpapi

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/storage"
)

func (s *Server) username(r *http.Request) string {
	name, _ := s.auth.Current(r)
	return name
}

func (s *Server) remapPathMetadata(from, to string) error {
	if from == "" || to == "" || from == to {
		return nil
	}
	tx, err := s.db.DB.Begin()
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
		info, statErr := s.store.Stat(rel)
		if err != nil || statErr != nil || !info.IsDir() || rel == "" {
			writeJSON(w, 404, map[string]string{"error": "Folder not found"})
			return
		}
		_, _ = s.db.DB.ExecContext(r.Context(), "INSERT OR IGNORE INTO favorites(username,path,created_at) VALUES(?,?,?)", username, rel, time.Now().UnixMilli())
		s.writeFavorites(w, r, username)
	case http.MethodDelete:
		rel, _ := storage.Normalize(r.URL.Query().Get("path"))
		_, _ = s.db.DB.ExecContext(r.Context(), "DELETE FROM favorites WHERE username=? AND path=?", username, rel)
		s.writeFavorites(w, r, username)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Server) writeFavorites(w http.ResponseWriter, r *http.Request, username string) {
	rows, err := s.db.DB.QueryContext(r.Context(), "SELECT path FROM favorites WHERE username=? ORDER BY created_at,path", username)
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
		if _, statErr := s.store.Stat(rel); statErr != nil {
			writeJSON(w, 404, map[string]string{"error": "Item not found"})
			return
		}
		_, err = s.db.DB.ExecContext(r.Context(), `INSERT INTO access_rules(path,visibility,updated_at) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET visibility=excluded.visibility,updated_at=excluded.updated_at`, rel, b.Visibility, time.Now().UnixMilli())
	} else if r.Method == http.MethodDelete {
		if err == nil {
			_, err = s.db.DB.ExecContext(r.Context(), "DELETE FROM access_rules WHERE path=?", rel)
		}
	}
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	info, statErr := s.store.Stat(rel)
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
		if s.db.DB.QueryRow("SELECT visibility FROM access_rules WHERE path=?", candidate).Scan(&v) == nil {
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
		rows, err := s.db.DB.QueryContext(r.Context(), "SELECT id,token,path,link_type,expires_at,created_at,revoked_at,access_count,last_accessed_at FROM shared_links WHERE path=? ORDER BY created_at DESC", rel)
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
		if _, err := s.store.Stat(rel); err != nil {
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
		_, err = s.db.DB.ExecContext(r.Context(), "INSERT INTO shared_links(id,token,path,link_type,expires_at,created_at,revoked_at) VALUES(?,?,?,?,?,?,NULL)", id, token, rel, b.Type, expires, time.Now().UnixMilli())
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
		result, err := s.db.DB.ExecContext(r.Context(), "UPDATE shared_links SET revoked_at=COALESCE(revoked_at,?) WHERE id=?", time.Now().UnixMilli(), id)
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
	result, err := s.db.DB.ExecContext(r.Context(), "DELETE FROM shared_links WHERE revoked_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at <= ?)", time.Now().UnixMilli())
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to clear link history"})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "removed": mustRows(result)})
}

func (s *Server) linkPurge(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var expires, revoked sql.NullInt64
	if err := s.db.DB.QueryRowContext(r.Context(), "SELECT expires_at,revoked_at FROM shared_links WHERE id=?", id).Scan(&expires, &revoked); err != nil {
		writeJSON(w, 404, map[string]string{"error": "Link not found"})
		return
	}
	if !revoked.Valid && (!expires.Valid || expires.Int64 > time.Now().UnixMilli()) {
		writeJSON(w, 409, map[string]string{"error": "Revoke the link before deleting it from history", "code": "LINK_STILL_ACTIVE"})
		return
	}
	_, _ = s.db.DB.ExecContext(r.Context(), "DELETE FROM shared_links WHERE id=?", id)
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
	rows, err := s.db.DB.QueryContext(r.Context(), `SELECT
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
		if entries, readErr := fs.ReadDir(s.store.FS(), target); readErr == nil {
			children = []any{}
			for _, entry := range entries {
				child := path.Join(target, entry.Name())
				childInfo, statErr := s.store.Stat(child)
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
	_, _ = s.db.DB.Exec("UPDATE shared_links SET access_count=access_count+1,last_accessed_at=? WHERE id=?", time.Now().UnixMilli(), link.id)
	if isDownload || isLegacyShare {
		s.downloadTarget(w, r, target, info, path.Base(target))
		return
	}
	f, err := s.store.Open(target)
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
	f, err := s.store.Open(rel)
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
	info, err := s.store.Stat(target)
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
	info, err := s.store.Stat(rel)
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
		page, _ := s.index.List(r.Context(), rel, "", 200)
		for _, child := range page.Items {
			if v, _, _ := s.visibility(child.Path); v == "public" {
				if childInfo, statErr := s.store.Stat(child.Path); statErr == nil {
					children = append(children, s.publicItem(child.Path, childInfo))
				}
			}
		}
	}
	writeJSON(w, 200, map[string]any{"mode": "public", "item": s.publicItem(rel, info), "children": children})
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
	err := s.db.DB.QueryRow("SELECT id,path,link_type,expires_at,revoked_at FROM shared_links WHERE token=?", token).Scan(&link.id, &link.path, &link.typ, &expires, &revoked)
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

func randomBase64Token(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return base64.RawURLEncoding.EncodeToString([]byte(randomToken(n)))
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
