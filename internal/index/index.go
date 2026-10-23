package index

import (
	"context"
	"path"
	"time"

	"github.com/alty-oss/open-drive/internal/database"
	"github.com/alty-oss/open-drive/internal/storage"
)

type Index struct {
	DB    *database.Database
	Store *storage.Store
}

type Item struct {
	Name                    string    `json:"name"`
	Path                    string    `json:"path"`
	IsFolder                bool      `json:"isFolder"`
	IsImage                 bool      `json:"isImage"`
	Size                    int64     `json:"size"`
	Date                    time.Time `json:"date"`
	CreatedAt               time.Time `json:"createdAt"`
	Visibility              string    `json:"visibility"`
	VisibilitySource        string    `json:"visibilitySource"`
	VisibilityInheritedFrom *string   `json:"visibilityInheritedFrom"`
}

type Page struct {
	Items      []Item  `json:"items"`
	NextCursor *string `json:"nextCursor"`
	Total      int     `json:"total"`
}

type SearchOptions struct {
	Query          string
	Type           string
	Cursor         string
	PageSize       int
	MinSize        *int64
	MaxSize        *int64
	ModifiedAfter  *int64
	ModifiedBefore *int64
}

func (i *Index) item(ctx context.Context, p, n string, folder bool, size, mtime, birth int64) Item {
	visibility, source, inherited := i.visibility(p)
	return Item{Name: n, Path: p, IsFolder: folder, IsImage: !folder && isImage(n), Size: func() int64 {
		if folder {
			return 0
		}
		return size
	}(), Date: time.UnixMilli(mtime).UTC(), CreatedAt: time.UnixMilli(birth).UTC(), Visibility: visibility, VisibilitySource: source, VisibilityInheritedFrom: inherited}
}

func (i *Index) visibility(rel string) (string, string, *string) {
	for candidate := rel; ; candidate = path.Dir(candidate) {
		if candidate == "." {
			candidate = ""
		}
		var visibility string
		if i.DB.DB.QueryRow("SELECT visibility FROM access_rules WHERE path=?", candidate).Scan(&visibility) == nil {
			if candidate == rel {
				return visibility, "explicit", nil
			}
			inherited := candidate
			return visibility, "inherited", &inherited
		}
		if candidate == "" {
			break
		}
	}
	return "private", "default", nil
}
