package index

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/alty-oss/open-drive/internal/storage"
)

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
