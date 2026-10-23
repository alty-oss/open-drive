package realtime

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type Event struct {
	V        int      `json:"v"`
	Type     string   `json:"type"`
	Event    string   `json:"event,omitempty"`
	Path     string   `json:"path,omitempty"`
	From     string   `json:"from,omitempty"`
	To       string   `json:"to,omitempty"`
	Paths    []string `json:"paths,omitempty"`
	OriginID string   `json:"originId,omitempty"`
}
type client struct {
	id    string
	conn  *websocket.Conn
	queue chan Event
}
type Hub struct {
	mu      sync.RWMutex
	clients map[string]*client
}

func New() *Hub { return &Hub{clients: map[string]*client{}} }

func (h *Hub) Publish(event Event) {
	event.V = 1
	event.Type = "file-change"
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.clients {
		select {
		case c.queue <- event:
		default:
			go c.conn.Close(websocket.StatusTryAgainLater, "slow client")
		}
	}
}

func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request, originAllowed func(string) bool, authenticated func(*http.Request) bool) {
	if !authenticated(r) {
		http.Error(w, "Not authenticated", http.StatusUnauthorized)
		return
	}
	origin := r.Header.Get("Origin")
	if origin != "" && !originAllowed(origin) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		return
	}
	id := randomID()
	c := &client{id: id, conn: conn, queue: make(chan Event, 64)}
	h.mu.Lock()
	h.clients[id] = c
	h.mu.Unlock()
	defer func() { h.mu.Lock(); delete(h.clients, id); h.mu.Unlock(); conn.CloseNow() }()
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	_ = wsjson.Write(ctx, conn, Event{V: 1, Type: "hello", OriginID: id})
	go func() {
		for {
			var ignored any
			if err := wsjson.Read(ctx, conn, &ignored); err != nil {
				cancel()
				return
			}
		}
	}()
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				_ = conn.Ping(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
	for {
		select {
		case msg := <-c.queue:
			writeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := wsjson.Write(writeCtx, conn, msg)
			cancel()
			if err != nil {
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func randomID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
