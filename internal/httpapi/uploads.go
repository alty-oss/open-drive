package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/storage"
)

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
		if _, e := s.store.Stat(path.Join(dir, name)); e == nil {
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
	if m.FileSize <= 0 || m.FileSize > s.cfg.MaxUploadSizeBytes {
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
	dir := filepath.Join(s.cfg.StorageDir, ".chunks", id)
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
	dir := filepath.Join(s.cfg.StorageDir, ".chunks", id)
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
	dir := filepath.Join(s.cfg.StorageDir, ".chunks", id)
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
		if err := s.store.Root.MkdirAll(destDir, 0o755); err != nil {
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
	out, err := s.store.Root.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
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
			s.store.Root.Remove(temp)
			writeJSON(w, 409, map[string]string{"error": "Upload incomplete", "code": "UPLOAD_INCOMPLETE"})
			return
		}
		expectedChecksum, readChecksumErr := os.ReadFile(checksumPath)
		if readChecksumErr != nil || len(strings.TrimSpace(string(expectedChecksum))) != 64 {
			in.Close()
			out.Close()
			s.store.Root.Remove(temp)
			writeJSON(w, 422, map[string]string{"error": "Invalid chunk", "code": "INVALID_CHUNK"})
			return
		}
		chunkHash := sha256.New()
		nn, e := io.Copy(io.MultiWriter(out, h, chunkHash), in)
		in.Close()
		total += nn
		if e != nil {
			out.Close()
			s.store.Root.Remove(temp)
			writeJSON(w, 422, map[string]string{"error": "Invalid chunk"})
			return
		}
		if !strings.EqualFold(strings.TrimSpace(string(expectedChecksum)), hex.EncodeToString(chunkHash.Sum(nil))) {
			out.Close()
			s.store.Root.Remove(temp)
			writeJSON(w, 422, map[string]string{"error": "Chunk checksum does not match", "code": "CHUNK_CHECKSUM_MISMATCH"})
			return
		}
	}
	out.Sync()
	out.Close()
	if total != m.FileSize {
		s.store.Root.Remove(temp)
		writeJSON(w, 422, map[string]string{"error": "Final upload size does not match"})
		return
	}
	if !s.quotaHasRoom(r.Context(), total) {
		s.store.Root.Remove(temp)
		writeJSON(w, 507, map[string]string{"error": "Insufficient storage space", "code": "STORAGE_QUOTA_EXCEEDED"})
		return
	}
	if err := s.store.Root.Rename(temp, rel); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Unable to publish upload"})
		return
	}
	_ = os.RemoveAll(dir)
	_ = s.index.Sync(r.Context(), rel)
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
	_ = os.RemoveAll(filepath.Join(s.cfg.StorageDir, ".chunks", id))
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	dest, err := storage.Normalize(r.URL.Query().Get("path"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid path"})
		return
	}
	if dest != "" {
		if err := s.store.Root.MkdirAll(dest, 0o755); err != nil {
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
			_ = s.store.Root.Remove(file.temp)
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
		if count > s.cfg.MaxUploadFiles {
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
		f, e := s.store.Root.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if e != nil {
			cleanup()
			writeJSON(w, 500, map[string]string{"error": "Unable to start upload"})
			return
		}
		n, e := io.CopyN(f, part, s.cfg.MaxUploadSizeBytes+1)
		f.Sync()
		f.Close()
		if e != nil && e != io.EOF {
			s.store.Root.Remove(temp)
			cleanup()
			writeJSON(w, 413, map[string]string{"error": "Content exceeds the allowed limit"})
			return
		}
		if n > s.cfg.MaxUploadSizeBytes {
			s.store.Root.Remove(temp)
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
		if err := s.store.Root.Rename(file.temp, file.rel); err != nil {
			for _, rel := range published {
				_ = s.store.Root.Remove(rel)
			}
			cleanup()
			writeJSON(w, 500, map[string]string{"error": "Unable to publish upload"})
			return
		}
		published = append(published, file.rel)
		uploaded = append(uploaded, map[string]any{"name": path.Base(file.rel), "size": file.size, "isImage": indexIsImage(file.rel)})
	}
	_ = s.index.Sync(r.Context(), dest)
	writeJSON(w, 200, map[string]any{"ok": true, "files": uploaded})
	if len(uploaded) > 0 {
		s.emit(r, "upload", map[string]any{"path": dest})
	}
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
