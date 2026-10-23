package watch_test

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/alty-oss/open-drive/internal/database"
	"github.com/alty-oss/open-drive/internal/index"
	"github.com/alty-oss/open-drive/internal/realtime"
	"github.com/alty-oss/open-drive/internal/storage"
	"github.com/alty-oss/open-drive/internal/watch"
)

func TestWatcherReconcilesExternalChanges(t *testing.T) {
	for _, polling := range []bool{false, true} {
		t.Run(map[bool]string{false: "native", true: "polling"}[polling], func(t *testing.T) {
			root := t.TempDir()
			store, err := storage.Open(filepath.Join(root, "storage"))
			if err != nil {
				t.Fatal(err)
			}
			defer store.Close()
			db, err := database.Open(filepath.Join(store.Dir, ".data", "index.db"))
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			idx := &index.Index{DB: db, Store: store}
			if err := idx.Reconcile(context.Background()); err != nil {
				t.Fatal(err)
			}

			watcher := watch.New(store, idx, realtime.New(), polling)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			done := make(chan error, 1)
			go func() { done <- watcher.Run(ctx) }()
			readyCtx, readyCancel := context.WithTimeout(context.Background(), 3*time.Second)
			if err := watcher.WaitReady(readyCtx); err != nil {
				readyCancel()
				t.Fatal(err)
			}
			readyCancel()

			file := filepath.Join(store.Dir, "external.txt")
			if err := os.WriteFile(file, []byte("one"), 0o644); err != nil {
				t.Fatal(err)
			}
			waitForIndex(t, idx, "external.txt", 3)

			if err := os.WriteFile(file, []byte("updated"), 0o644); err != nil {
				t.Fatal(err)
			}
			waitForIndex(t, idx, "external.txt", 7)

			if err := os.MkdirAll(filepath.Join(store.Dir, "imported", "nested"), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(store.Dir, "imported", "nested", "doc.txt"), []byte("abc"), 0o644); err != nil {
				t.Fatal(err)
			}
			waitForIndex(t, idx, "imported/nested/doc.txt", 3)

			if err := os.Remove(file); err != nil {
				t.Fatal(err)
			}
			waitForIndexRemoval(t, idx, "external.txt")

			if err := os.WriteFile(filepath.Join(store.Dir, ".data", "ignored"), []byte("noise"), 0o644); err != nil {
				t.Fatal(err)
			}
			time.Sleep(250 * time.Millisecond)
			if _, err := indexedSize(idx, "ignored"); err == nil {
				t.Fatal("internal file entered the index")
			}

			cancel()
			select {
			case err := <-done:
				if err != nil {
					t.Fatal(err)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("watcher did not stop")
			}
		})
	}
}

func waitForIndex(t *testing.T, idx *index.Index, rel string, wantSize int64) {
	t.Helper()
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		if size, err := indexedSize(idx, rel); err == nil && size == wantSize {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	size, err := indexedSize(idx, rel)
	t.Fatalf("%s not synchronized: size=%d err=%v", rel, size, err)
}

func waitForIndexRemoval(t *testing.T, idx *index.Index, rel string) {
	t.Helper()
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := indexedSize(idx, rel); err == sql.ErrNoRows {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("%s is still in the index", rel)
}

func indexedSize(idx *index.Index, rel string) (int64, error) {
	var size int64
	err := idx.DB.DB.QueryRow("SELECT size FROM files WHERE path=?", rel).Scan(&size)
	return size, err
}
