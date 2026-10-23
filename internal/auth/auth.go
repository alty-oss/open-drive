package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/alty-oss/open-drive/internal/config"
	"github.com/alty-oss/open-drive/internal/database"
)

type Auth struct {
	DB       *database.Database
	Config   config.Config
	mu       sync.Mutex
	attempts map[string]attempt
}
type attempt struct {
	count int
	reset time.Time
}

func New(db *database.Database, cfg config.Config) *Auth {
	return &Auth{DB: db, Config: cfg, attempts: map[string]attempt{}}
}

type sessionData struct {
	Cookie        map[string]any `json:"cookie"`
	Authenticated bool           `json:"authenticated"`
	Username      string         `json:"username"`
}

func (a *Auth) sessionID(r *http.Request) string {
	cookie, err := r.Cookie("connect.sid")
	if err != nil {
		return ""
	}
	value := cookie.Value

	if decoded, err := url.PathUnescape(value); err == nil {
		value = decoded
	}
	if strings.HasPrefix(value, "s:") {
		value = value[2:]
	}
	parts := strings.SplitN(value, ".", 2)
	if len(parts) != 2 {
		return ""
	}
	sig := sign(parts[0], a.Config.SessionSecret)
	if subtle.ConstantTimeCompare([]byte(sig), []byte(parts[1])) != 1 {
		return ""
	}

	var present int
	if err := a.DB.DB.QueryRow("SELECT 1 FROM sessions WHERE sid=?", parts[0]).Scan(&present); err == nil {
		return parts[0]
	}

	decoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return ""
	}
	return string(decoded)
}

func (a *Auth) Current(r *http.Request) (string, bool) {
	sid := a.sessionID(r)
	if sid == "" {
		return "", false
	}
	var data string
	var expires int64
	err := a.DB.DB.QueryRow("SELECT data,expires_at FROM sessions WHERE sid=?", sid).Scan(&data, &expires)
	if err != nil || expires <= time.Now().UnixMilli() {
		if err == nil {
			_, _ = a.DB.DB.Exec("DELETE FROM sessions WHERE sid=?", sid)
		}
		return "", false
	}
	var session sessionData
	if json.Unmarshal([]byte(data), &session) != nil || !session.Authenticated || session.Username == "" {
		return "", false
	}
	return session.Username, true
}

func (a *Auth) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := a.Current(r); !ok {
			writeJSON(w, 401, map[string]string{"error": "Not authenticated"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *Auth) Check(w http.ResponseWriter, r *http.Request) {
	_, ok := a.Current(r)
	writeJSON(w, 200, map[string]bool{"authenticated": ok})
}

func (a *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Remember bool   `json:"remember"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body) != nil {
		writeJSON(w, 400, map[string]string{"error": "Invalid JSON"})
		return
	}
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx > 0 {
		ip = ip[:idx]
	}
	if !a.allow(ip) {
		w.Header().Set("Retry-After", "900")
		writeJSON(w, 429, map[string]string{"error": "Too many login attempts. Try again in 15 minutes."})
		return
	}
	valid := (body.Username == a.Config.LoginUser && body.Password == a.Config.LoginPass) || (a.Config.LoginUser2 != "" && body.Username == a.Config.LoginUser2 && body.Password == a.Config.LoginPass2)
	if !valid {
		a.failed(ip)
		writeJSON(w, 401, map[string]string{"error": "Invalid username or password"})
		return
	}
	a.clear(ip)
	sidBytes := make([]byte, 32)
	if _, err := rand.Read(sidBytes); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Internal server error"})
		return
	}
	sid := base64.RawURLEncoding.EncodeToString(sidBytes)
	maxAge := 24 * time.Hour
	if body.Remember {
		maxAge = 30 * 24 * time.Hour
	}
	expires := time.Now().Add(maxAge)
	session := sessionData{Cookie: map[string]any{"originalMaxAge": maxAge.Milliseconds(), "expires": expires.UTC().Format(time.RFC3339Nano), "httpOnly": true, "path": "/"}, Authenticated: true, Username: body.Username}
	raw, _ := json.Marshal(session)
	if _, err := a.DB.DB.Exec(`INSERT INTO sessions(sid,expires_at,data) VALUES(?,?,?)`, sid, expires.UnixMilli(), raw); err != nil {
		writeJSON(w, 500, map[string]string{"error": "Internal server error"})
		return
	}

	http.SetCookie(w, &http.Cookie{Name: "connect.sid", Value: "s:" + sid + "." + sign(sid, a.Config.SessionSecret), Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: int(maxAge.Seconds())})
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	if sid := a.sessionID(r); sid != "" {
		_, _ = a.DB.DB.Exec("DELETE FROM sessions WHERE sid=?", sid)
	}
	http.SetCookie(w, &http.Cookie{Name: "connect.sid", Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (a *Auth) allow(ip string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	v, ok := a.attempts[ip]
	return !ok || time.Now().After(v.reset) || v.count < 10
}
func (a *Auth) failed(ip string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	v := a.attempts[ip]
	if v.reset.IsZero() || time.Now().After(v.reset) {
		v = attempt{reset: time.Now().Add(15 * time.Minute)}
	}
	v.count++
	a.attempts[ip] = v
}
func (a *Auth) clear(ip string) { a.mu.Lock(); delete(a.attempts, ip); a.mu.Unlock() }
func sign(value, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(value))
	return strings.TrimRight(base64.StdEncoding.EncodeToString(h.Sum(nil)), "=")
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
