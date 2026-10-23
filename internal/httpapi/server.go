package httpapi

import (
	"net/http"
	"sync"

	"github.com/alty-oss/open-drive/internal/auth"
	"github.com/alty-oss/open-drive/internal/config"
	"github.com/alty-oss/open-drive/internal/database"
	"github.com/alty-oss/open-drive/internal/index"
	"github.com/alty-oss/open-drive/internal/realtime"
	"github.com/alty-oss/open-drive/internal/storage"
)

type Server struct {
	cfg    config.Config
	db     *database.Database
	store  *storage.Store
	index  *index.Index
	auth   *auth.Auth
	hub    *realtime.Hub
	mux    *http.ServeMux
	mutate sync.Mutex
}

// Dependencies contains the resources owned by the application and consumed by
// the HTTP transport. Server does not open or close any of these resources.
type Dependencies struct {
	Config config.Config
	DB     *database.Database
	Store  *storage.Store
	Index  *index.Index
	Auth   *auth.Auth
	Hub    *realtime.Hub
}

func New(deps Dependencies) *Server {
	s := &Server{
		cfg:   deps.Config,
		db:    deps.DB,
		store: deps.Store,
		index: deps.Index,
		auth:  deps.Auth,
		hub:   deps.Hub,
		mux:   http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) Handler() http.Handler { return s.requestMiddleware(s.mux) }
