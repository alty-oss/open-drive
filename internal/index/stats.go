package index

import (
	"context"
	"path"
	"strings"
)

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
