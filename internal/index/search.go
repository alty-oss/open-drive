package index

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
)

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
