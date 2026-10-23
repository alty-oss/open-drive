package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/metadata"
	"github.com/alty-oss/open-drive/internal/storage"
)

func (s *Server) metadata(w http.ResponseWriter, r *http.Request) {
	rel, err := storage.Normalize(r.PathValue("filePath"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	info, err := s.store.Stat(rel)
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
	err := s.db.DB.QueryRowContext(ctx, "SELECT kind,data,COALESCE(error,'') FROM file_metadata WHERE path=? AND mtime_ms=? AND size=?", rel, info.ModTime().UnixMilli(), info.Size()).Scan(&kind, &rawData, &cachedError)
	if err == nil {
		data := map[string]any{}
		if json.Unmarshal([]byte(rawData), &data) == nil {
			return kind, data, cachedError
		}
	}
	kind, data, extractionErr := metadata.Extract(ctx, filepath.Join(s.cfg.StorageDir, filepath.FromSlash(rel)), s.cfg.MetadataProbe)
	raw, _ := json.Marshal(data)
	errorText := ""
	if extractionErr != nil {
		errorText = extractionErr.Error()
	}
	_, _ = s.db.DB.ExecContext(ctx, `INSERT INTO file_metadata(path,mtime_ms,size,kind,data,error,extracted_at) VALUES(?,?,?,?,?,?,?)
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
	entries, err := fs.ReadDir(s.store.FS(), dir)
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
	f, err := s.store.Open(rel)
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
