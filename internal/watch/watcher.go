package watch

import (
	"context"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"

	"github.com/alty-oss/open-drive/internal/index"
	"github.com/alty-oss/open-drive/internal/realtime"
	"github.com/alty-oss/open-drive/internal/storage"
)

type Watcher struct {
	store   *storage.Store
	index   *index.Index
	hub     *realtime.Hub
	polling bool

	mu        sync.Mutex
	timer     *time.Timer
	ready     chan struct{}
	readyOnce sync.Once
}

func New(store *storage.Store, idx *index.Index, hub *realtime.Hub, polling bool) *Watcher {
	return &Watcher{store: store, index: idx, hub: hub, polling: polling, ready: make(chan struct{})}
}

func (w *Watcher) WaitReady(ctx context.Context) error {
	select {
	case <-w.ready:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (w *Watcher) signalReady() { w.readyOnce.Do(func() { close(w.ready) }) }

func (w *Watcher) Run(ctx context.Context) error {
	defer w.cancelPending()
	if w.polling {
		w.signalReady()
		return w.runPolling(ctx)
	}
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	defer fw.Close()
	if err := w.addDirectories(fw); err != nil {
		return err
	}
	w.signalReady()
	for {
		select {
		case <-ctx.Done():
			return nil
		case err, ok := <-fw.Errors:
			if !ok {
				return nil
			}
			_ = err
		case event, ok := <-fw.Events:
			if !ok {
				return nil
			}
			if w.isInternal(event.Name) {
				continue
			}
			if event.Op&fsnotify.Create != 0 {
				_ = w.addDirectoryIfNeeded(fw, event.Name)
			}
			if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Remove|fsnotify.Rename) != 0 {
				w.schedule(ctx, event.Name)
			}
		}
	}
}

func (w *Watcher) runPolling(ctx context.Context) error {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			_ = w.index.Sync(ctx)
			w.hub.Publish(realtime.Event{Event: "watch-sync", Path: ""})
		}
	}
}

func (w *Watcher) addDirectories(fw *fsnotify.Watcher) error {
	return filepath.WalkDir(w.store.Dir, func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			return nil
		}
		if name != w.store.Dir && w.isInternal(name) {
			return filepath.SkipDir
		}
		return fw.Add(name)
	})
}

func (w *Watcher) addDirectoryIfNeeded(fw *fsnotify.Watcher, name string) error {
	info, err := os.Stat(name)
	if err != nil {
		return err
	}
	if !info.IsDir() {
		return nil
	}

	return fw.Add(name)
}

func (w *Watcher) schedule(ctx context.Context, name string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.timer != nil {
		w.timer.Stop()
	}
	w.timer = time.AfterFunc(150*time.Millisecond, func() {
		if err := w.index.Sync(ctx); err == nil {
			rel, relErr := filepath.Rel(w.store.Dir, name)
			if relErr != nil {
				rel = ""
			}
			rel = filepath.ToSlash(rel)
			w.hub.Publish(realtime.Event{Event: "external-change", Path: rel})
		}
	})
}

func (w *Watcher) cancelPending() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.timer != nil {
		w.timer.Stop()
		w.timer = nil
	}
}

func (w *Watcher) isInternal(name string) bool {
	rel, err := filepath.Rel(w.store.Dir, name)
	if err != nil {
		return true
	}
	slashRel := filepath.ToSlash(rel)
	return storage.IsInternal(slashRel) || slashRel == ".." || strings.HasPrefix(slashRel, "../")
}
