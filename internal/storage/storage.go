package storage

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

var ErrInvalidPath = errors.New("path invalid")
var internalDirs = map[string]bool{".data": true, ".trash": true, ".chunks": true}

type Store struct {
	Dir  string
	Root *os.Root
}

func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	for _, name := range []string{".data", ".trash/items", ".chunks"} {
		if err := root.MkdirAll(name, 0o755); err != nil {
			root.Close()
			return nil, err
		}
	}
	return &Store{Dir: dir, Root: root}, nil
}

func (s *Store) Close() error { return s.Root.Close() }

func IsInternal(rel string) bool {
	rel = strings.Trim(strings.ReplaceAll(rel, "\\", "/"), "/")
	if rel == "." || rel == "" {
		return false
	}
	first := strings.Split(rel, "/")[0]
	return internalDirs[first]
}

func Normalize(rel string) (string, error) {
	rel = strings.ReplaceAll(strings.TrimSpace(rel), "\\", "/")
	if rel == "" || rel == "." {
		return "", nil
	}
	if strings.IndexByte(rel, 0) >= 0 || strings.HasPrefix(rel, "/") {
		return "", ErrInvalidPath
	}
	clean := filepath.ToSlash(filepath.Clean(rel))
	if clean == "." {
		return "", nil
	}
	if clean == ".." || strings.HasPrefix(clean, "../") || filepath.IsAbs(clean) {
		return "", ErrInvalidPath
	}
	if IsInternal(clean) {
		return "", ErrInvalidPath
	}
	return clean, nil
}

func (s *Store) Open(rel string) (*os.File, error) {
	normalized, err := Normalize(rel)
	if err != nil {
		return nil, err
	}
	return s.Root.Open(normalized)
}

func (s *Store) Stat(rel string) (fs.FileInfo, error) {
	normalized, err := Normalize(rel)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		normalized = "."
	}
	return s.Root.Stat(normalized)
}

func (s *Store) Lstat(rel string) (fs.FileInfo, error) {
	normalized, err := Normalize(rel)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		normalized = "."
	}
	return s.Root.Lstat(normalized)
}

func (s *Store) Abs(rel string) (string, error) {
	normalized, err := Normalize(rel)
	if err != nil {
		return "", err
	}
	return filepath.Join(s.Dir, filepath.FromSlash(normalized)), nil
}

func (s *Store) FS() fs.FS { return s.Root.FS() }

func IsNotFound(err error) bool { return errors.Is(err, fs.ErrNotExist) }
