package storage_test

import (
	"errors"
	"testing"

	"github.com/alty-oss/open-drive/internal/storage"
)

func TestNormalize(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "root", input: "", want: ""},
		{name: "clean relative path", input: "docs/../notes/file.txt", want: "notes/file.txt"},
		{name: "windows separators", input: `docs\notes.txt`, want: "docs/notes.txt"},
		{name: "parent traversal", input: "../secret", wantErr: true},
		{name: "absolute path", input: "/etc/passwd", wantErr: true},
		{name: "database directory", input: ".data/index.db", wantErr: true},
		{name: "trash directory", input: ".trash/items/file", wantErr: true},
		{name: "chunk directory", input: ".chunks/upload", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := storage.Normalize(test.input)
			if test.wantErr {
				if !errors.Is(err, storage.ErrInvalidPath) {
					t.Fatalf("Normalize(%q) error=%v", test.input, err)
				}
				return
			}
			if err != nil || got != test.want {
				t.Fatalf("Normalize(%q)=(%q,%v), want (%q,nil)", test.input, got, err, test.want)
			}
		})
	}
}

func TestIsInternal(t *testing.T) {
	for _, path := range []string{".data", ".data/index.db", ".trash/items", `.chunks\part`} {
		if !storage.IsInternal(path) {
			t.Errorf("IsInternal(%q)=false", path)
		}
	}
	for _, path := range []string{"", ".", "data/file", "docs/.trash/file"} {
		if storage.IsInternal(path) {
			t.Errorf("IsInternal(%q)=true", path)
		}
	}
}
