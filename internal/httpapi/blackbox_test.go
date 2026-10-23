package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

func TestBlackBoxHTTPAndWebSocketContract(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Index.Reconcile(t.Context()); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(s.Handler())
	defer server.Close()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client := &http.Client{Jar: jar}

	loginBody, _ := json.Marshal(map[string]string{"username": "test", "password": "pass"})
	login, err := client.Post(server.URL+"/api/auth/login", "application/json", bytes.NewReader(loginBody))
	if err != nil {
		t.Fatal(err)
	}
	if login.StatusCode != http.StatusOK {
		login.Body.Close()
		t.Fatalf("login status=%d", login.StatusCode)
	}
	login.Body.Close()

	check, err := client.Get(server.URL + "/api/auth/check")
	if err != nil {
		t.Fatal(err)
	}
	var checkBody map[string]bool
	if check.StatusCode != http.StatusOK || json.NewDecoder(check.Body).Decode(&checkBody) != nil || !checkBody["authenticated"] {
		check.Body.Close()
		t.Fatalf("auth check status=%d body=%v", check.StatusCode, checkBody)
	}
	check.Body.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/api/events"
	wsOrigin, _ := url.Parse(server.URL)
	cookies := jar.Cookies(wsOrigin)
	wsHeaders := http.Header{"Origin": []string{server.URL}}
	for _, cookie := range cookies {
		wsHeaders.Add("Cookie", cookie.Name+"="+cookie.Value)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, response, err := websocket.Dial(ctx, wsURL, &websocket.DialOptions{HTTPHeader: wsHeaders})
	if err != nil {
		if response != nil {
			response.Body.Close()
		}
		t.Fatal(err)
	}
	defer conn.CloseNow()

	var hello struct {
		Type     string `json:"type"`
		OriginID string `json:"originId"`
	}
	if err := wsjson.Read(ctx, conn, &hello); err != nil {
		t.Fatal(err)
	}
	if hello.Type != "hello" || hello.OriginID == "" {
		t.Fatalf("unexpected websocket hello: %+v", hello)
	}

	newFileBody, _ := json.Marshal(map[string]string{"name": "blackbox.txt", "path": "", "content": "ok"})
	request, err := http.NewRequest(http.MethodPost, server.URL+"/api/new-file", bytes.NewReader(newFileBody))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Client-ID", "contract-client")
	created, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	if created.StatusCode != http.StatusOK {
		created.Body.Close()
		t.Fatalf("new file status=%d", created.StatusCode)
	}
	created.Body.Close()

	var event struct {
		Type     string `json:"type"`
		Event    string `json:"event"`
		Path     string `json:"path"`
		OriginID string `json:"originId"`
	}
	if err := wsjson.Read(ctx, conn, &event); err != nil {
		t.Fatal(err)
	}
	if event.Type != "file-change" || event.Event != "new-file" || event.Path != "" || event.OriginID != "contract-client" {
		t.Fatalf("unexpected websocket event: %+v", event)
	}
}
