package httpapi

import (
	"net/http"
	"net/url"
	"strings"
)

func (s *Server) requestMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if id == "" {
			id = randomToken(12)
		}
		w.Header().Set("X-Request-Id", id)
		if traversal(r.RequestURI) {
			http.NotFound(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) originAllowed(origin, requestHost string) bool {
	if origin == "" {
		return true
	}
	u, err := http.NewRequest("GET", origin, nil)
	if err != nil {
		return false
	}
	if u.URL.Host == "" || (u.URL.Scheme != "http" && u.URL.Scheme != "https") {
		return false
	}
	return strings.EqualFold(u.URL.Host, requestHost) || strings.EqualFold(u.URL.Hostname(), "localhost") || strings.EqualFold(u.URL.Hostname(), "127.0.0.1")
}

func traversal(raw string) bool {
	v := strings.SplitN(raw, "?", 2)[0]
	for n := 0; n < 2; n++ {
		decoded, err := urlPathUnescape(v)
		if err != nil {
			return true
		}
		v = decoded
	}
	for _, p := range strings.Split(strings.ReplaceAll(v, "\\", "/"), "/") {
		if p == ".." {
			return true
		}
	}
	return false
}

func urlPathUnescape(s string) (string, error) { return url.PathUnescape(s) }
