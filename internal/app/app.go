// Package app composes the OpenDrive process and owns its resource lifecycle.
package app

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/alty-oss/open-drive/internal/auth"
	"github.com/alty-oss/open-drive/internal/config"
	"github.com/alty-oss/open-drive/internal/database"
	"github.com/alty-oss/open-drive/internal/httpapi"
	"github.com/alty-oss/open-drive/internal/index"
	"github.com/alty-oss/open-drive/internal/realtime"
	"github.com/alty-oss/open-drive/internal/storage"
	"github.com/alty-oss/open-drive/internal/watch"
)

type App struct {
	cfg      config.Config
	logger   *slog.Logger
	db       *database.Database
	store    *storage.Store
	index    *index.Index
	hub      *realtime.Hub
	api      *httpapi.Server
	close    sync.Once
	closeErr error
}

func New(cfg config.Config, logger *slog.Logger) (*App, error) {
	if logger == nil {
		logger = slog.Default()
	}
	store, err := storage.Open(cfg.StorageDir)
	if err != nil {
		return nil, err
	}
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		_ = store.Close()
		return nil, err
	}
	idx := &index.Index{DB: db, Store: store}
	if err := idx.Reconcile(context.Background()); err != nil {
		_ = db.Close()
		_ = store.Close()
		return nil, err
	}
	hub := realtime.New()
	authenticator := auth.New(db, cfg)
	api := httpapi.New(httpapi.Dependencies{
		Config: cfg,
		DB:     db,
		Store:  store,
		Index:  idx,
		Auth:   authenticator,
		Hub:    hub,
	})
	return &App{cfg: cfg, logger: logger, db: db, store: store, index: idx, hub: hub, api: api}, nil
}

func (a *App) Handler() http.Handler { return a.api.Handler() }

func (a *App) Run(ctx context.Context) error {
	runCtx, cancel := context.WithCancel(ctx)

	watcher := watch.New(a.store, a.index, a.hub, a.cfg.WatchPolling)
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		if err := watcher.Run(runCtx); err != nil && !errors.Is(err, context.Canceled) {
			a.logger.Error("watcher", "error", err)
		}
	}()
	defer func() {
		cancel()
		<-watcherDone
	}()

	server := &http.Server{
		Addr:              ":" + a.cfg.Port,
		Handler:           a.Handler(),
		ReadHeaderTimeout: 15 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	serverErr := make(chan error, 1)
	go func() {
		a.logger.Info("server.started", "addr", server.Addr, "storage", a.cfg.StorageDir)
		serverErr <- server.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return nil
	case err := <-serverErr:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func (a *App) Close() error {
	a.close.Do(func() {
		if a.store != nil {
			_ = a.store.Close()
		}
		if a.db != nil {
			a.closeErr = a.db.Close()
		}
	})
	return a.closeErr
}
