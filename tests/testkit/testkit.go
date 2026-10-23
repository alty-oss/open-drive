// Package testkit contains shared black-box test infrastructure.
package testkit

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/alty-oss/open-drive/internal/app"
	"github.com/alty-oss/open-drive/internal/config"
)

type Application struct {
	application *app.App
}

func Config(t testing.TB) config.Config {
	t.Helper()
	root := t.TempDir()
	return config.Config{
		Port:               "0",
		StorageDir:         filepath.Join(root, "storage"),
		DBPath:             filepath.Join(root, "storage", ".data", "index.db"),
		SessionSecret:      "test-secret",
		LoginUser:          "test",
		LoginPass:          "pass",
		MaxUploadSizeBytes: 1 << 20,
		StorageQuotaBytes:  10 << 20,
		MaxUploadFiles:     10,
		ClientDist:         filepath.Join(root, "client-dist"),
	}
}

func New(t testing.TB, cfg config.Config) (*Application, error) {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	application, err := app.New(cfg, logger)
	if err != nil {
		return nil, err
	}
	return &Application{application: application}, nil
}

func (a *Application) Handler() http.Handler { return a.application.Handler() }

func (a *Application) Close() error { return a.application.Close() }

type Client struct {
	Handler http.Handler
	Cookies []*http.Cookie
}

func (c *Client) JSON(t testing.TB, method, url string, body any) *httptest.ResponseRecorder {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(method, url, bytes.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	c.AddCookies(req)
	w := httptest.NewRecorder()
	c.Handler.ServeHTTP(w, req)
	for _, cookie := range w.Result().Cookies() {
		found := false
		for index, current := range c.Cookies {
			if current.Name == cookie.Name {
				c.Cookies[index] = cookie
				found = true
			}
		}
		if !found {
			c.Cookies = append(c.Cookies, cookie)
		}
	}
	return w
}

func (c *Client) AddCookies(req *http.Request) {
	for _, cookie := range c.Cookies {
		req.AddCookie(cookie)
	}
}
