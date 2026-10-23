package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

const SchemaVersion = 7

type Database struct{ DB *sql.DB }

func Open(path string) (*Database, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	for _, pragma := range []string{
		"PRAGMA busy_timeout = 5000",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA journal_mode = WAL",
	} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("%s: %w", pragma, err)
		}
	}
	wrapped := &Database{DB: db}
	if err := wrapped.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return wrapped, nil
}

func (d *Database) Close() error { return d.DB.Close() }

func (d *Database) migrate(ctx context.Context) error {
	var current int
	if err := d.DB.QueryRowContext(ctx, "PRAGMA user_version").Scan(&current); err != nil {
		return err
	}
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS files (
 path TEXT PRIMARY KEY, parent TEXT NOT NULL, name TEXT NOT NULL,
 is_folder INTEGER NOT NULL, size INTEGER NOT NULL, category TEXT NOT NULL,
 mtime_ms INTEGER NOT NULL, birthtime_ms INTEGER NOT NULL,
 seen_gen INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category, mtime_ms DESC);
CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime_ms DESC);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);`,
		`CREATE TABLE IF NOT EXISTS file_metadata (
 path TEXT PRIMARY KEY, mtime_ms INTEGER NOT NULL, size INTEGER NOT NULL,
	kind TEXT NOT NULL, data TEXT NOT NULL, error TEXT, extracted_at INTEGER NOT NULL);`,
		`CREATE TABLE IF NOT EXISTS sessions (
 sid TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);`,
		`CREATE TABLE IF NOT EXISTS access_rules (
 path TEXT PRIMARY KEY, visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
 updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS shared_links (
 id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, path TEXT NOT NULL,
 link_type TEXT NOT NULL CHECK (link_type IN ('share','download')),
 expires_at INTEGER, created_at INTEGER NOT NULL, revoked_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_shared_links_path ON shared_links(path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);`,
		`CREATE TABLE IF NOT EXISTS trash_items (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, original_path TEXT NOT NULL,
 original_parent TEXT NOT NULL, trash_path TEXT NOT NULL UNIQUE,
 is_folder INTEGER NOT NULL CHECK (is_folder IN (0,1)), size INTEGER NOT NULL CHECK (size >= 0),
 created_at INTEGER NOT NULL, modified_at INTEGER NOT NULL, deleted_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','restoring','deleting')));
CREATE INDEX IF NOT EXISTS idx_trash_items_deleted ON trash_items(state, deleted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_trash_items_original ON trash_items(original_path);`,
		`ALTER TABLE shared_links ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shared_links ADD COLUMN last_accessed_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_shared_links_created ON shared_links(created_at DESC, id DESC);`,
		`CREATE TABLE IF NOT EXISTS favorites (
 username TEXT NOT NULL, path TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY (username, path));
CREATE INDEX IF NOT EXISTS idx_favorites_path ON favorites(path);`,
	}
	if current >= SchemaVersion {
		return nil
	}
	tx, err := d.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	for version := current; version < SchemaVersion; version++ {
		if _, err := tx.ExecContext(ctx, migrations[version]); err != nil {
			tx.Rollback()
			return fmt.Errorf("migration %d: %w", version+1, err)
		}
	}
	if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", SchemaVersion)); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}
