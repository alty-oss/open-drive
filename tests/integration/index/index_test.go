package index_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/alty-oss/open-drive/internal/database"
	"github.com/alty-oss/open-drive/internal/index"
	"github.com/alty-oss/open-drive/internal/storage"
)

func TestSearchCursorDoesNotDuplicateItems(t *testing.T) {
	root := t.TempDir()
	store, err := storage.Open(filepath.Join(root, "storage"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	db, err := database.Open(filepath.Join(root, "storage", ".data", "index.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, name := range []string{"alpha.txt", "beta.txt", "gamma.txt"} {
		if err := os.WriteFile(filepath.Join(store.Dir, name), []byte(name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	idx := &index.Index{DB: db, Store: store}
	if err := idx.Reconcile(context.Background()); err != nil {
		t.Fatal(err)
	}

	first, err := idx.Search(context.Background(), "txt", "", "", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(first.Items) != 1 || first.NextCursor == nil {
		t.Fatalf("first page=%+v", first)
	}
	second, err := idx.Search(context.Background(), "txt", "", *first.NextCursor, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Items) != 1 || second.Items[0].Path == first.Items[0].Path {
		t.Fatalf("second page=%+v first=%+v", second, first)
	}
	third, err := idx.Search(context.Background(), "txt", "", *second.NextCursor, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(third.Items) != 1 || third.NextCursor != nil {
		t.Fatalf("third page=%+v", third)
	}
}
