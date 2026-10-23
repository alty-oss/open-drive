package index

import (
	"context"
	"database/sql"
	"io/fs"
	"path"
	"strings"
	"time"

	"github.com/alty-oss/open-drive/internal/storage"
)

func (i *Index) EnsureReady(ctx context.Context) error {
	var last sql.NullString
	if err := i.DB.DB.QueryRowContext(ctx, "SELECT value FROM meta WHERE key='last_reconcile_at'").Scan(&last); err != nil && err != sql.ErrNoRows {
		return err
	}
	if !last.Valid {
		return i.Reconcile(ctx)
	}
	return nil
}

func (i *Index) Reconcile(ctx context.Context) error {
	var current int64
	_ = i.DB.DB.QueryRowContext(ctx, "SELECT CAST(value AS INTEGER) FROM meta WHERE key='generation'").Scan(&current)
	generation := current + 1
	tx, err := i.DB.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO meta(key,value) VALUES('generation',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, generation); err != nil {
		tx.Rollback()
		return err
	}
	stmt, err := tx.PrepareContext(ctx, `INSERT INTO files(path,parent,name,is_folder,size,category,mtime_ms,birthtime_ms,seen_gen)
VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET parent=excluded.parent,name=excluded.name,
is_folder=excluded.is_folder,size=excluded.size,category=excluded.category,mtime_ms=excluded.mtime_ms,
birthtime_ms=excluded.birthtime_ms,seen_gen=excluded.seen_gen`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	err = fs.WalkDir(i.Store.FS(), ".", func(rel string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if storage.IsNotFound(walkErr) {
				return nil
			}
			return walkErr
		}
		if rel == "." {
			return nil
		}
		rel = path.Clean(strings.TrimPrefix(rel, "./"))
		if storage.IsInternal(rel) {
			if entry.IsDir() {
				return fs.SkipDir
			}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		isFolder := info.IsDir()
		parent := path.Dir(rel)
		if parent == "." {
			parent = ""
		}
		category := categoryFor(rel, isFolder)
		if _, err := stmt.ExecContext(ctx, rel, parent, path.Base(rel), boolInt(isFolder), sizeOf(info, isFolder), category,
			info.ModTime().UnixMilli(), birthtime(info), generation); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM files WHERE seen_gen != ?", generation); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO meta(key,value) VALUES('last_reconcile_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, time.Now().UnixMilli()); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (i *Index) Sync(ctx context.Context, rels ...string) error {

	return i.Reconcile(ctx)
}

func sizeOf(info fs.FileInfo, folder bool) int64 {
	if folder {
		return 0
	}
	return info.Size()
}

func birthtime(info fs.FileInfo) int64 { return info.ModTime().UnixMilli() }

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
