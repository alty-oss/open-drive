package index

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"strings"
	"time"

	"open-drive/internal/database"
	"open-drive/internal/storage"
)

type Index struct {
	DB    *database.Database
	Store *storage.Store
}

type Item struct {
	Name                    string    `json:"name"`
	Path                    string    `json:"path"`
	IsFolder                bool      `json:"isFolder"`
	IsImage                 bool      `json:"isImage"`
	Size                    int64     `json:"size"`
	Date                    time.Time `json:"date"`
	CreatedAt               time.Time `json:"createdAt"`
	Visibility              string    `json:"visibility"`
	VisibilitySource        string    `json:"visibilitySource"`
	VisibilityInheritedFrom *string   `json:"visibilityInheritedFrom"`
}

type Page struct {
	Items      []Item  `json:"items"`
	NextCursor *string `json:"nextCursor"`
	Total      int     `json:"total"`
}

type SearchOptions struct {
	Query          string
	Type           string
	Cursor         string
	PageSize       int
	MinSize        *int64
	MaxSize        *int64
	ModifiedAfter  *int64
	ModifiedBefore *int64
}

func (i *Index) EnsureReady(ctx context.Context) error {
	var last sql.NullString
	if err := i.DB.DB.QueryRowContext(ctx, "SELECT value FROM meta WHERE key='last_reconcile_at'").Scan(&last); err != nil && err != sql.ErrNoRows {
		return err
	}
	if !last.Valid {
		return i.Reconcile(ctx)
	}
	return nil
}

func (i *Index) Reconcile(ctx context.Context) error {
	var current int64
	_ = i.DB.DB.QueryRowContext(ctx, "SELECT CAST(value AS INTEGER) FROM meta WHERE key='generation'").Scan(&current)
	generation := current + 1
	tx, err := i.DB.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO meta(key,value) VALUES('generation',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, generation); err != nil {
		tx.Rollback()
		return err
	}
	stmt, err := tx.PrepareContext(ctx, `INSERT INTO files(path,parent,name,is_folder,size,category,mtime_ms,birthtime_ms,seen_gen)
VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET parent=excluded.parent,name=excluded.name,
is_folder=excluded.is_folder,size=excluded.size,category=excluded.category,mtime_ms=excluded.mtime_ms,
birthtime_ms=excluded.birthtime_ms,seen_gen=excluded.seen_gen`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	err = fs.WalkDir(i.Store.FS(), ".", func(rel string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if storage.IsNotFound(walkErr) {
				return nil
			}
			return walkErr
		}
		if rel == "." {
			return nil
		}
		rel = path.Clean(strings.TrimPrefix(rel, "./"))
		if storage.IsInternal(rel) {
			if entry.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		isFolder := info.IsDir()
		parent := path.Dir(rel)
		if parent == "." {
			parent = ""
		}
		category := categoryFor(rel, isFolder)
		if _, err := stmt.ExecContext(ctx, rel, parent, path.Base(rel), boolInt(isFolder), sizeOf(info, isFolder), category,
			info.ModTime().UnixMilli(), birthtime(info), generation); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM files WHERE seen_gen != ?", generation); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO meta(key,value) VALUES('last_reconcile_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, time.Now().UnixMilli()); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (i *Index) Sync(ctx context.Context, rels ...string) error {

	return i.Reconcile(ctx)
}

func (i *Index) List(ctx context.Context, parent, cursor string, pageSize int) (Page, error) {
	if err := i.EnsureReady(ctx); err != nil {
		return Page{}, err
	}
	parent, err := storage.Normalize(parent)
	if err != nil {
		return Page{Items: []Item{}, Total: 0}, nil
	}
	limit := clampPageSize(pageSize, 100, 200)
	afterFolder, afterPath, err := decodeListCursor(cursor, parent)
	if err != nil {
		return Page{}, err
	}
	query := `SELECT path,name,is_folder,size,mtime_ms,birthtime_ms FROM files WHERE parent=?`
	args := []any{parent}
	if cursor != "" {
		query += ` AND (is_folder < ? OR (is_folder = ? AND (path COLLATE NOCASE > ? COLLATE NOCASE OR (path COLLATE NOCASE = ? COLLATE NOCASE AND path > ?))))`
		args = append(args, afterFolder, afterFolder, afterPath, afterPath, afterPath)
	}
	query += ` ORDER BY is_folder DESC, path COLLATE NOCASE ASC, path ASC LIMIT ?`
	args = append(args, limit+1)
	rows, err := i.DB.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return Page{}, err
	}
	rawItems := []struct {
		path, name string
		folder     bool
		size       int64
		mtime      int64
		birth      int64
	}{}
	for rows.Next() {
		var p, n string
		var folder int
		var size, mtime, birth int64
		if err := rows.Scan(&p, &n, &folder, &size, &mtime, &birth); err != nil {
			rows.Close()
			return Page{}, err
		}
		rawItems = append(rawItems, struct {
			path, name string
			folder     bool
			size       int64
			mtime      int64
			birth      int64
		}{p, n, folder != 0, size, mtime, birth})
	}
	rowErr := rows.Err()
	rows.Close()
	items := make([]Item, 0, len(rawItems))
	for _, row := range rawItems {
		items = append(items, i.item(ctx, row.path, row.name, row.folder, row.size, row.mtime, row.birth))
	}
	var total int
	if err := i.DB.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM files WHERE parent=?", parent).Scan(&total); err != nil {
		return Page{}, err
	}
	var next *string
	if len(items) > limit {
		last := items[limit-1]
		encoded := encodeListCursor(parent, last.IsFolder, last.Path)
		next = &encoded
		items = items[:limit]
	}
	return Page{Items: items, NextCursor: next, Total: total}, rowErr
}

func (i *Index) Search(ctx context.Context, query, typ, cursor string, pageSize int) (Page, error) {
	return i.SearchWithOptions(ctx, SearchOptions{
		Query: query, Type: typ, Cursor: cursor, PageSize: pageSize,
	})
}

func (i *Index) SearchWithOptions(ctx context.Context, options SearchOptions) (Page, error) {
	if err := i.EnsureReady(ctx); err != nil {
		return Page{}, err
	}
	query := strings.TrimSpace(options.Query)
	if query == "" {
		return Page{Items: []Item{}, Total: 0}, nil
	}
	typ := normalizeSearchType(options.Type)
	limit := clampPageSize(options.PageSize, 100, 200)
	pattern := "%" + escapeLike(query) + "%"
	where := `(name LIKE ? ESCAPE '\' COLLATE NOCASE OR path LIKE ? ESCAPE '\' COLLATE NOCASE)`
	args := []any{pattern, pattern}
	switch typ {
	case "folder":
		where += " AND is_folder=1"
	case "document":
		where += " AND is_folder=0 AND category IN ('text','code','pdf')"
	case "image", "video", "audio", "other":
		where += " AND is_folder=0 AND category=?"
		args = append(args, typ)
	}
	if options.MinSize != nil {
		where += " AND is_folder=0 AND size>=?"
		args = append(args, *options.MinSize)
	}
	if options.MaxSize != nil {
		where += " AND is_folder=0 AND size<=?"
		args = append(args, *options.MaxSize)
	}
	if options.ModifiedAfter != nil {
		where += " AND mtime_ms>=?"
		args = append(args, *options.ModifiedAfter)
	}
	if options.ModifiedBefore != nil {
		where += " AND mtime_ms<=?"
		args = append(args, *options.ModifiedBefore)
	}
	signature := searchSignature(query, typ, options)
	after := searchCursor{Rank: 0, IsFolder: 1, MTime: 1<<63 - 1}
	if options.Cursor != "" {
		var err error
		after, err = decodeSearchCursorWithSignature(options.Cursor, signature)
		if err != nil {
			return Page{}, err
		}
	}
	var total int
	if err := i.DB.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM files WHERE ("+where+")", args...).Scan(&total); err != nil {
		return Page{}, err
	}
	queryArgs := []any{query, escapeLike(query) + "%"}
	queryArgs = append(queryArgs, args...)
	statement := `WITH ranked AS (
SELECT path,name,is_folder,size,mtime_ms,birthtime_ms,
CASE WHEN name = ? COLLATE NOCASE THEN 0
     WHEN name LIKE ? ESCAPE '\' COLLATE NOCASE THEN 1
     ELSE 2 END AS search_rank
FROM files WHERE (` + where + `)
) SELECT path,name,is_folder,size,mtime_ms,birthtime_ms FROM ranked`
	if options.Cursor != "" {
		statement += " WHERE (search_rank > ? OR (search_rank = ? AND (is_folder < ? OR (is_folder = ? AND (mtime_ms < ? OR (mtime_ms = ? AND (path COLLATE NOCASE > ? COLLATE NOCASE OR (path COLLATE NOCASE = ? COLLATE NOCASE AND path > ?))))))))"
		queryArgs = append(queryArgs, after.Rank, after.Rank, after.IsFolder, after.IsFolder, after.MTime, after.MTime, after.Path, after.Path, after.Path)
	}
	statement += " ORDER BY search_rank ASC, is_folder DESC, mtime_ms DESC, path COLLATE NOCASE ASC, path ASC LIMIT ?"
	queryArgs = append(queryArgs, limit+1)
	rows, err := i.DB.DB.QueryContext(ctx, statement, queryArgs...)
	if err != nil {
		return Page{}, err
	}
	rawItems := []struct {
		path, name string
		folder     bool
		size       int64
		mtime      int64
		birth      int64
	}{}
	for rows.Next() {
		var p, n string
		var folder int
		var size, mtime, birth int64
		if err := rows.Scan(&p, &n, &folder, &size, &mtime, &birth); err != nil {
			rows.Close()
			return Page{}, err
		}
		rawItems = append(rawItems, struct {
			path, name string
			folder     bool
			size       int64
			mtime      int64
			birth      int64
		}{p, n, folder != 0, size, mtime, birth})
	}
	rowErr := rows.Err()
	rows.Close()
	items := make([]Item, 0, len(rawItems))
	for _, row := range rawItems {
		items = append(items, i.item(ctx, row.path, row.name, row.folder, row.size, row.mtime, row.birth))
	}
	var next *string
	if len(items) > limit {
		last := items[limit-1]
		encoded := encodeSearchCursor(query, typ, last.IsFolder, last.Path, last.Date.UnixMilli(), searchRank(last.Name, query), signature)
		next = &encoded
		items = items[:limit]
	}
	return Page{Items: items, NextCursor: next, Total: total}, rowErr
}

func (i *Index) Stats(ctx context.Context) (map[string]any, error) {
	if err := i.EnsureReady(ctx); err != nil {
		return nil, err
	}
	stats := map[string]any{"used": int64(0), "fileCount": 0, "folderCount": 0, "byType": map[string]any{}}
	byType := stats["byType"].(map[string]any)
	rows, err := i.DB.DB.QueryContext(ctx, "SELECT category,COUNT(*),COALESCE(SUM(size),0) FROM files WHERE is_folder=0 GROUP BY category")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var used int64
	var files int
	for rows.Next() {
		var cat string
		var count int
		var size int64
		if err := rows.Scan(&cat, &count, &size); err != nil {
			return nil, err
		}
		byType[cat] = map[string]any{"count": count, "size": size}
		used += size
		files += count
	}
	var folders int
	if err := i.DB.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM files WHERE is_folder=1").Scan(&folders); err != nil {
		return nil, err
	}
	stats["used"] = used
	stats["fileCount"] = files
	stats["folderCount"] = folders
	return stats, nil
}

func (i *Index) item(ctx context.Context, p, n string, folder bool, size, mtime, birth int64) Item {
	visibility, source, inherited := i.visibility(p)
	return Item{Name: n, Path: p, IsFolder: folder, IsImage: !folder && isImage(n), Size: func() int64 {
		if folder {
			return 0
		}
		return size
	}(), Date: time.UnixMilli(mtime).UTC(), CreatedAt: time.UnixMilli(birth).UTC(), Visibility: visibility, VisibilitySource: source, VisibilityInheritedFrom: inherited}
}

func (i *Index) visibility(rel string) (string, string, *string) {
	for candidate := rel; ; candidate = path.Dir(candidate) {
		if candidate == "." {
			candidate = ""
		}
		var visibility string
		if i.DB.DB.QueryRow("SELECT visibility FROM access_rules WHERE path=?", candidate).Scan(&visibility) == nil {
			if candidate == rel {
				return visibility, "explicit", nil
			}
			inherited := candidate
			return visibility, "inherited", &inherited
		}
		if candidate == "" {
			break
		}
	}
	return "private", "default", nil
}
func categoryFor(name string, folder bool) string {
	if folder {
		return "folder"
	}
	lower := strings.ToLower(path.Ext(name))
	switch lower {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg":
		return "image"
	case ".mp4", ".webm", ".mov", ".mkv", ".avi":
		return "video"
	case ".mp3", ".wav", ".flac", ".ogg", ".m4a":
		return "audio"
	case ".pdf":
		return "pdf"
	case ".md", ".txt", ".json", ".csv", ".srt", ".vtt":
		return "text"
	case ".js", ".ts", ".tsx", ".css", ".html", ".go", ".py", ".sh":
		return "code"
	}
	return "other"
}
func isImage(name string) bool { return categoryFor(name, false) == "image" }
func sizeOf(info fs.FileInfo, folder bool) int64 {
	if folder {
		return 0
	}
	return info.Size()
}
func birthtime(info fs.FileInfo) int64 { return info.ModTime().UnixMilli() }
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
func clampPageSize(value, def, max int) int {
	if value == 0 {
		value = def
	}
	if value < 1 {
		value = 1
	}
	if value > max {
		value = max
	}
	return value
}
func escapeLike(s string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(s)
}
func encodeListCursor(kind string, folder bool, p string) string {
	raw, _ := json.Marshal(map[string]any{"v": 1, "kind": kind, "isFolder": boolInt(folder), "path": p})
	return base64.RawURLEncoding.EncodeToString(raw)
}
func decodeListCursor(raw, kind string) (int, string, error) {
	if raw == "" {
		return 1, "", nil
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return 0, "", fmt.Errorf("cursor invalid")
	}
	var v map[string]any
	if json.Unmarshal(data, &v) != nil || v["v"] != float64(1) || v["kind"] != kind {
		return 0, "", fmt.Errorf("cursor invalid")
	}
	folder, ok := v["isFolder"].(float64)
	p, okp := v["path"].(string)
	if !ok || !okp {
		return 0, "", fmt.Errorf("cursor invalid")
	}
	return int(folder), p, nil
}

type searchCursor struct {
	Rank       int
	IsFolder   int
	Path       string
	MTime      int64
	Signature  string
	Query      string
	cursorType string
}

func normalizeSearchType(typ string) string {
	switch typ {
	case "folder", "image", "video", "audio", "document", "other":
		return typ
	default:
		return "all"
	}
}

func searchRank(name, query string) int {
	lowerName, lowerQuery := strings.ToLower(name), strings.ToLower(query)
	if lowerName == lowerQuery {
		return 0
	}
	if strings.HasPrefix(lowerName, lowerQuery) {
		return 1
	}
	return 2
}

func searchSignature(query, typ string, options SearchOptions) string {
	raw, _ := json.Marshal([]any{query, typ, options.MinSize, options.MaxSize, options.ModifiedAfter, options.ModifiedBefore})
	return string(raw)
}

func encodeSearchCursor(query, typ string, folder bool, p string, mtime int64, rank int, signature string) string {
	raw, _ := json.Marshal(map[string]any{"v": 1, "kind": "search", "query": query, "type": typ, "rank": rank, "signature": signature, "isFolder": boolInt(folder), "path": p, "mtime": mtime})
	return base64.RawURLEncoding.EncodeToString(raw)
}

func decodeSearchCursor(raw, query, typ string) (searchCursor, error) {
	cursor, err := decodeSearchCursorWithSignature(raw, "")
	if err != nil {
		return searchCursor{}, err
	}
	if cursor.Query != query || cursor.cursorType != normalizeSearchType(typ) {
		return searchCursor{}, fmt.Errorf("invalid search cursor")
	}
	return cursor, nil
}

func decodeSearchCursorWithSignature(raw, signature string) (searchCursor, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return searchCursor{}, fmt.Errorf("invalid search cursor")
	}
	var value struct {
		V         int
		Kind      string
		Query     string
		Type      string
		Rank      int
		Signature string
		IsFolder  int
		Path      string
		MTime     int64
	}
	if json.Unmarshal(decoded, &value) != nil || value.V != 1 || value.Kind != "search" || value.Query == "" || normalizeSearchType(value.Type) != value.Type || (signature != "" && value.Signature != signature) || (value.IsFolder != 0 && value.IsFolder != 1) || value.Path == "" || value.MTime < 0 || value.Rank < 0 || value.Rank > 2 {
		return searchCursor{}, fmt.Errorf("invalid search cursor")
	}
	return searchCursor{Rank: value.Rank, IsFolder: value.IsFolder, Path: value.Path, MTime: value.MTime, Signature: value.Signature, Query: value.Query, cursorType: value.Type}, nil
}

var _ = sha256.Sum256
