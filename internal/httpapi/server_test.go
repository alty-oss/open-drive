package httpapi

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"open-drive/internal/config"
)

func testConfig(t *testing.T) config.Config {
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

type directClient struct {
	handler http.Handler
	cookies []*http.Cookie
}

func (c *directClient) json(t *testing.T, method, url string, body any) *httptest.ResponseRecorder {
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
	for _, cookie := range c.cookies {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	c.handler.ServeHTTP(w, req)
	for _, cookie := range w.Result().Cookies() {
		found := false
		for index, current := range c.cookies {
			if current.Name == cookie.Name {
				c.cookies[index] = cookie
				found = true
			}
		}
		if !found {
			c.cookies = append(c.cookies, cookie)
		}
	}
	return w
}

func TestAuthenticatedCoreContract(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	client := &directClient{handler: s.Handler()}

	login := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"})
	if login.Code != http.StatusOK {
		t.Fatalf("login status=%d", login.Code)
	}

	resp := client.json(t, http.MethodPost, "http://example.test/api/folders", map[string]string{"path": "", "name": "docs"})
	if resp.Code != http.StatusOK {
		t.Fatalf("folder status=%d", resp.Code)
	}
	resp = client.json(t, http.MethodPost, "http://example.test/api/new-file", map[string]string{"path": "docs", "name": "note.txt", "content": "old"})
	if resp.Code != http.StatusOK {
		t.Fatalf("new file status=%d", resp.Code)
	}

	resp = client.json(t, http.MethodGet, "http://example.test/api/file-content/docs/note.txt", nil)
	var editor map[string]any
	if resp.Code != http.StatusOK || json.NewDecoder(resp.Body).Decode(&editor) != nil || editor["content"] != "old" {
		t.Fatalf("editor response status=%d body=%v", resp.Code, editor)
	}
	resp = client.json(t, http.MethodPut, "http://example.test/api/file-content/docs/note.txt", map[string]string{"content": "new"})
	if resp.Code != http.StatusOK {
		t.Fatalf("edit status=%d", resp.Code)
	}

	resp = client.json(t, http.MethodPut, "http://example.test/api/favorites", map[string]string{"path": "docs"})
	if resp.Code != http.StatusOK {
		t.Fatalf("favorite status=%d", resp.Code)
	}
	resp = client.json(t, http.MethodPut, "http://example.test/api/access", map[string]string{"path": "docs/note.txt", "visibility": "public"})
	if resp.Code != http.StatusOK {
		t.Fatalf("access status=%d", resp.Code)
	}

	resp = client.json(t, http.MethodPost, "http://example.test/api/links", map[string]string{"path": "docs/note.txt", "type": "download"})
	if resp.Code != http.StatusCreated {
		t.Fatalf("link status=%d", resp.Code)
	}
	var link struct {
		Token string `json:"token"`
	}
	if json.NewDecoder(resp.Body).Decode(&link) != nil || link.Token == "" {
		t.Fatal("missing link token")
	}
	resp = client.json(t, http.MethodPost, "http://example.test/api/rename", map[string]string{"from": "docs", "newName": "docs-renamed"})
	if resp.Code != http.StatusOK {
		t.Fatalf("rename status=%d", resp.Code)
	}
	resp = client.json(t, http.MethodGet, "http://example.test/api/public-links/"+link.Token, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("public link status=%d", resp.Code)
	}

	resp = client.json(t, http.MethodDelete, "http://example.test/api/files/docs-renamed/note.txt", nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("trash status=%d", resp.Code)
	}
	resp = client.json(t, http.MethodGet, "http://example.test/api/trash", nil)
	var trash []struct {
		ID string `json:"id"`
	}
	if resp.Code != http.StatusOK || json.NewDecoder(resp.Body).Decode(&trash) != nil || len(trash) != 1 {
		t.Fatalf("trash list status=%d items=%d", resp.Code, len(trash))
	}
	resp = client.json(t, http.MethodPost, "http://example.test/api/trash/restore", map[string]string{"id": trash[0].ID})
	if resp.Code != http.StatusOK {
		t.Fatalf("restore status=%d", resp.Code)
	}
}

func TestHealthAndReady(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Index.Reconcile(t.Context()); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		path string
		want int
	}{
		{path: "/healthz", want: http.StatusOK},
		{path: "/readyz", want: http.StatusOK},
	} {
		r := httptest.NewRequest(http.MethodGet, tc.path, nil)
		w := httptest.NewRecorder()
		s.Handler().ServeHTTP(w, r)
		if w.Code != tc.want {
			t.Fatalf("%s: status=%d want=%d body=%s", tc.path, w.Code, tc.want, w.Body.String())
		}
	}
}

func TestSessionSurvivesServerReopenAndStorageCompatibility(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	client := &directClient{handler: s.Handler()}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"}); resp.Code != http.StatusOK {
		t.Fatalf("login status=%d", resp.Code)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	client.handler = reopened.Handler()
	check := client.json(t, http.MethodGet, "http://example.test/api/auth/check", nil)
	var checkBody map[string]bool
	if check.Code != http.StatusOK || json.NewDecoder(check.Body).Decode(&checkBody) != nil || !checkBody["authenticated"] {
		t.Fatalf("session after reopen status=%d body=%v", check.Code, checkBody)
	}

	encodedCookie := url.QueryEscape(client.cookies[0].Value)
	encodedRequest := httptest.NewRequest(http.MethodGet, "http://example.test/api/auth/check", nil)
	encodedRequest.Header.Set("Cookie", "connect.sid="+encodedCookie)
	encodedResponse := httptest.NewRecorder()
	reopened.Handler().ServeHTTP(encodedResponse, encodedRequest)
	var encodedBody map[string]bool
	if encodedResponse.Code != http.StatusOK || json.NewDecoder(encodedResponse.Body).Decode(&encodedBody) != nil || !encodedBody["authenticated"] {
		t.Fatalf("percent-encoded session status=%d body=%v", encodedResponse.Code, encodedBody)
	}
	storageResponse := client.json(t, http.MethodGet, "http://example.test/api/storage", nil)
	var storageBody map[string]any
	if storageResponse.Code != http.StatusOK || json.NewDecoder(storageResponse.Body).Decode(&storageBody) != nil {
		t.Fatalf("storage status=%d body=%s", storageResponse.Code, storageResponse.Body.String())
	}
	if _, ok := storageBody["used"]; !ok || len(storageBody) != 1 {
		t.Fatalf("legacy storage shape=%v", storageBody)
	}
}

func TestRenameRemapsUnicodePathMetadata(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	client := &directClient{handler: s.Handler()}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"}); resp.Code != http.StatusOK {
		t.Fatalf("login status=%d", resp.Code)
	}
	folder := "music"
	if err := os.Mkdir(filepath.Join(cfg.StorageDir, folder), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cfg.StorageDir, folder, "nota.txt"), []byte("nota"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := s.Index.Reconcile(t.Context()); err != nil {
		t.Fatal(err)
	}
	if resp := client.json(t, http.MethodPut, "http://example.test/api/access", map[string]string{"path": folder, "visibility": "public"}); resp.Code != http.StatusOK {
		t.Fatalf("access status=%d", resp.Code)
	}
	if resp := client.json(t, http.MethodPut, "http://example.test/api/favorites", map[string]string{"path": folder}); resp.Code != http.StatusOK {
		t.Fatalf("favorite status=%d", resp.Code)
	}
	created := client.json(t, http.MethodPost, "http://example.test/api/links", map[string]string{"path": folder + "/nota.txt", "type": "share"})
	if created.Code != http.StatusCreated {
		t.Fatalf("link status=%d", created.Code)
	}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/rename", map[string]string{"from": folder, "newName": "file"}); resp.Code != http.StatusOK {
		t.Fatalf("rename status=%d body=%s", resp.Code, resp.Body.String())
	}

	access := client.json(t, http.MethodGet, "http://example.test/api/access?path="+url.QueryEscape("file/nota.txt"), nil)
	var accessBody map[string]any
	if access.Code != http.StatusOK || json.NewDecoder(access.Body).Decode(&accessBody) != nil || accessBody["visibility"] != "public" {
		t.Fatalf("remapped access status=%d body=%v", access.Code, accessBody)
	}
	favorites := client.json(t, http.MethodGet, "http://example.test/api/favorites", nil)
	var favoritesBody struct {
		Items []map[string]any `json:"items"`
	}
	if favorites.Code != http.StatusOK || json.NewDecoder(favorites.Body).Decode(&favoritesBody) != nil || len(favoritesBody.Items) != 1 || favoritesBody.Items[0]["path"] != "file" {
		t.Fatalf("remapped favorite status=%d body=%v", favorites.Code, favoritesBody)
	}
	links := client.json(t, http.MethodGet, "http://example.test/api/links?path="+url.QueryEscape("file/nota.txt"), nil)
	if links.Code != http.StatusOK {
		t.Fatalf("remapped link status=%d body=%s", links.Code, links.Body.String())
	}
}

func TestWebSocketOriginPolicy(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if !s.originAllowed("http://example.test", "example.test") {
		t.Fatal("same-host origin should be allowed")
	}
	if s.originAllowed("https://evil.example", "example.test") || s.originAllowed("null", "example.test") {
		t.Fatal("arbitrary origin should be rejected")
	}
}

func TestPublicFileAndTraversalGuard(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := os.WriteFile(filepath.Join(cfg.StorageDir, "hello.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.DB.Exec("INSERT INTO access_rules(path,visibility,updated_at) VALUES(?,?,?)", "hello.txt", "public", 1); err != nil {
		t.Fatal(err)
	}

	r := httptest.NewRequest(http.MethodGet, "/f/hello.txt", nil)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK || w.Body.String() != "hello" {
		t.Fatalf("public file: status=%d body=%q", w.Code, w.Body.String())
	}

	r = httptest.NewRequest(http.MethodGet, "/f/%2e%2e/%2e%2e/etc/passwd", nil)
	w = httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("traversal: status=%d want=%d", w.Code, http.StatusNotFound)
	}
}

func TestPublicFolderDownloadFiltersPrivateDescendantsAndTrashPreview(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	client := &directClient{handler: s.Handler()}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"}); resp.Code != http.StatusOK {
		t.Fatalf("login status=%d", resp.Code)
	}
	publicDir := filepath.Join(cfg.StorageDir, "public")
	if err := os.MkdirAll(publicDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(publicDir, "visible.txt"), []byte("visible"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(publicDir, "private.txt"), []byte("private"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := s.DB.DB.Exec("INSERT INTO access_rules(path,visibility,updated_at) VALUES(?,?,?),(?,?,?)", "public", "public", 1, "public/private.txt", "private", 1); err != nil {
		t.Fatal(err)
	}
	if err := s.Index.Reconcile(t.Context()); err != nil {
		t.Fatal(err)
	}

	r := httptest.NewRequest(http.MethodGet, "/api/public-path-download/public", nil)
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK || w.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("public zip status=%d type=%q", w.Code, w.Header().Get("Content-Type"))
	}
	archive, err := zip.NewReader(bytes.NewReader(w.Body.Bytes()), int64(w.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, entry := range archive.File {
		names[entry.Name] = true
	}
	if !names["visible.txt"] || names["private.txt"] {
		t.Fatalf("public archive entries=%v", names)
	}

	deleted := client.json(t, http.MethodDelete, "http://example.test/api/files/public/visible.txt", nil)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status=%d", deleted.Code)
	}
	var deletedBody struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(deleted.Body).Decode(&deletedBody); err != nil || deletedBody.ID == "" {
		t.Fatalf("delete response=%s", deleted.Body.String())
	}
	preview := client.json(t, http.MethodGet, "http://example.test/t/"+deletedBody.ID, nil)
	if preview.Code != http.StatusOK || preview.Body.String() != "visible" {
		t.Fatalf("trash preview status=%d body=%q", preview.Code, preview.Body.String())
	}
}

func TestLinksAndTrashPaginationContract(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	client := &directClient{handler: s.Handler()}

	if resp := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"}); resp.Code != http.StatusOK {
		t.Fatalf("login status=%d", resp.Code)
	}
	for _, name := range []string{"link-a.txt", "link-b.txt", "link-c.txt"} {
		if err := os.WriteFile(filepath.Join(cfg.StorageDir, name), []byte(name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.Index.Reconcile(t.Context()); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"link-a.txt", "link-b.txt", "link-c.txt"} {
		resp := client.json(t, http.MethodPost, "http://example.test/api/links", map[string]string{"path": name, "type": "download"})
		if resp.Code != http.StatusCreated {
			t.Fatalf("create link %s status=%d body=%s", name, resp.Code, resp.Body.String())
		}
	}

	page := client.json(t, http.MethodGet, "http://example.test/api/links/all?pageSize=1", nil)
	if page.Code != http.StatusOK {
		t.Fatalf("links page status=%d", page.Code)
	}
	var linksPage struct {
		Items      []map[string]any `json:"items"`
		NextCursor string           `json:"nextCursor"`
	}
	if err := json.NewDecoder(page.Body).Decode(&linksPage); err != nil {
		t.Fatal(err)
	}
	if len(linksPage.Items) != 1 || linksPage.NextCursor == "" {
		t.Fatalf("unexpected first links page: %+v", linksPage)
	}
	second := client.json(t, http.MethodGet, "http://example.test/api/links/all?pageSize=1&cursor="+linksPage.NextCursor, nil)
	if second.Code != http.StatusOK {
		t.Fatalf("second links page status=%d", second.Code)
	}
	var secondLinks struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.NewDecoder(second.Body).Decode(&secondLinks); err != nil {
		t.Fatal(err)
	}
	if len(secondLinks.Items) != 1 && len(secondLinks.Items) != 0 {
		t.Fatalf("unexpected second links page: %+v", secondLinks)
	}
	invalid := client.json(t, http.MethodGet, "http://example.test/api/links/all?cursor=lixo", nil)
	if invalid.Code != http.StatusBadRequest {
		t.Fatalf("invalid links cursor status=%d", invalid.Code)
	}

	if resp := client.json(t, http.MethodDelete, "http://example.test/api/files/link-a.txt", nil); resp.Code != http.StatusOK {
		t.Fatalf("trash move status=%d", resp.Code)
	}
	linksAfterDelete := client.json(t, http.MethodGet, "http://example.test/api/links/all?search=link-a", nil)
	var orphanPage struct {
		Items []map[string]any `json:"items"`
	}
	if linksAfterDelete.Code != http.StatusOK || json.NewDecoder(linksAfterDelete.Body).Decode(&orphanPage) != nil || len(orphanPage.Items) != 1 {
		t.Fatalf("orphan link response status=%d body=%s", linksAfterDelete.Code, linksAfterDelete.Body.String())
	}
	if orphanPage.Items[0]["targetExists"] != false || orphanPage.Items[0]["status"] != "revoked" {
		t.Fatalf("orphan link metadata: %+v", orphanPage.Items[0])
	}
	for _, name := range []string{"link-b.txt", "link-c.txt"} {
		if resp := client.json(t, http.MethodDelete, "http://example.test/api/files/"+name, nil); resp.Code != http.StatusOK {
			t.Fatalf("trash move %s status=%d", name, resp.Code)
		}
	}

	trashPage := client.json(t, http.MethodGet, "http://example.test/api/trash?pageSize=1", nil)
	if trashPage.Code != http.StatusOK {
		t.Fatalf("trash page status=%d", trashPage.Code)
	}
	var pagedTrash struct {
		Items      []map[string]any `json:"items"`
		NextCursor string           `json:"nextCursor"`
		Total      int              `json:"total"`
	}
	if err := json.NewDecoder(trashPage.Body).Decode(&pagedTrash); err != nil {
		t.Fatal(err)
	}
	if len(pagedTrash.Items) != 1 || pagedTrash.Total != 3 || pagedTrash.NextCursor == "" {
		t.Fatalf("unexpected trash page: %+v", pagedTrash)
	}
	trashSecond := client.json(t, http.MethodGet, "http://example.test/api/trash?pageSize=1&cursor="+pagedTrash.NextCursor, nil)
	if trashSecond.Code != http.StatusOK {
		t.Fatalf("second trash page status=%d", trashSecond.Code)
	}
	var secondTrash struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.NewDecoder(trashSecond.Body).Decode(&secondTrash); err != nil {
		t.Fatal(err)
	}
	if len(secondTrash.Items) != 1 || secondTrash.Items[0]["id"] == pagedTrash.Items[0]["id"] {
		t.Fatalf("unexpected second trash page: %+v", secondTrash)
	}
	invalidTrash := client.json(t, http.MethodGet, "http://example.test/api/trash?pageSize=1&cursor=lixo", nil)
	if invalidTrash.Code != http.StatusBadRequest {
		t.Fatalf("invalid trash cursor status=%d", invalidTrash.Code)
	}
}

func TestUploadsAreTransactionalAndChunksValidateChecksums(t *testing.T) {
	cfg := testConfig(t)
	cfg.StorageQuotaBytes = 5
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	client := &directClient{handler: s.Handler()}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"}); resp.Code != http.StatusOK {
		t.Fatalf("login status=%d", resp.Code)
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, file := range []struct {
		name string
		data string
	}{
		{name: "first.txt", data: "123"},
		{name: "second.txt", data: "456"},
	} {
		part, err := writer.CreateFormFile("files", file.name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(file.data)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/upload?path=", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	for _, cookie := range client.cookies {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, req)
	if w.Code != http.StatusInsufficientStorage {
		t.Fatalf("quota upload status=%d body=%s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(cfg.StorageDir, "first.txt")); !os.IsNotExist(err) {
		t.Fatalf("first file survived failed batch: err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(cfg.StorageDir, "second.txt")); !os.IsNotExist(err) {
		t.Fatalf("second file survived failed batch: err=%v", err)
	}
	s.Cfg.StorageQuotaBytes = 20

	checksum := sha256.Sum256([]byte("abc"))
	initResp := client.json(t, http.MethodPost, "http://example.test/api/upload-chunk/init", map[string]any{
		"filename": "chunk.txt", "totalChunks": 1, "fileSize": 3, "destPath": "", "autorename": false,
	})
	if initResp.Code != http.StatusOK {
		t.Fatalf("chunk init status=%d body=%s", initResp.Code, initResp.Body.String())
	}
	var initBody struct {
		UploadID string `json:"uploadId"`
	}
	if err := json.NewDecoder(initResp.Body).Decode(&initBody); err != nil || initBody.UploadID == "" {
		t.Fatalf("chunk init body=%s", initResp.Body.String())
	}

	var chunkBody bytes.Buffer
	chunkWriter := multipart.NewWriter(&chunkBody)
	chunkPart, err := chunkWriter.CreateFormFile("chunk", "chunk")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := chunkPart.Write([]byte("abc")); err != nil {
		t.Fatal(err)
	}
	if err := chunkWriter.Close(); err != nil {
		t.Fatal(err)
	}
	chunkReq := httptest.NewRequest(http.MethodPost, "/api/upload-chunk/"+initBody.UploadID+"?index=0", &chunkBody)
	chunkReq.Header.Set("Content-Type", chunkWriter.FormDataContentType())
	chunkReq.Header.Set("X-Chunk-SHA256", hex.EncodeToString(checksum[:]))
	for _, cookie := range client.cookies {
		chunkReq.AddCookie(cookie)
	}
	chunkResp := httptest.NewRecorder()
	s.Handler().ServeHTTP(chunkResp, chunkReq)
	if chunkResp.Code != http.StatusOK {
		t.Fatalf("chunk part status=%d body=%s", chunkResp.Code, chunkResp.Body.String())
	}
	complete := client.json(t, http.MethodPost, "http://example.test/api/upload-chunk/"+initBody.UploadID+"/complete", nil)
	if complete.Code != http.StatusOK {
		t.Fatalf("chunk complete status=%d body=%s", complete.Code, complete.Body.String())
	}
	if content, err := os.ReadFile(filepath.Join(cfg.StorageDir, "chunk.txt")); err != nil || string(content) != "abc" {
		t.Fatalf("completed chunk content=%q err=%v", content, err)
	}

	shortInit := client.json(t, http.MethodPost, "http://example.test/api/upload-chunk/init", map[string]any{
		"filename": "short.txt", "totalChunks": 1, "fileSize": 3, "destPath": "", "autorename": false,
	})
	var shortBody struct {
		UploadID string `json:"uploadId"`
	}
	if err := json.NewDecoder(shortInit.Body).Decode(&shortBody); err != nil {
		t.Fatal(err)
	}
	var shortBytes bytes.Buffer
	shortWriter := multipart.NewWriter(&shortBytes)
	shortPart, err := shortWriter.CreateFormFile("chunk", "chunk")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = shortPart.Write([]byte("ab"))
	_ = shortWriter.Close()
	shortReq := httptest.NewRequest(http.MethodPost, "/api/upload-chunk/"+shortBody.UploadID+"?index=0", &shortBytes)
	shortReq.Header.Set("Content-Type", shortWriter.FormDataContentType())
	for _, cookie := range client.cookies {
		shortReq.AddCookie(cookie)
	}
	shortResp := httptest.NewRecorder()
	s.Handler().ServeHTTP(shortResp, shortReq)
	if shortResp.Code != http.StatusUnprocessableEntity {
		t.Fatalf("short chunk status=%d body=%s", shortResp.Code, shortResp.Body.String())
	}
}

func TestConcurrentTrashRestoreHasSingleWinner(t *testing.T) {
	cfg := testConfig(t)
	s, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	client := &directClient{handler: s.Handler()}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/auth/login", map[string]any{"username": "test", "password": "pass"}); resp.Code != http.StatusOK {
		t.Fatalf("login status=%d", resp.Code)
	}
	if resp := client.json(t, http.MethodPost, "http://example.test/api/new-file", map[string]string{"name": "race.txt", "content": "safe"}); resp.Code != http.StatusOK {
		t.Fatalf("new file status=%d", resp.Code)
	}
	deleted := client.json(t, http.MethodDelete, "http://example.test/api/files/race.txt", nil)
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	var deletedBody struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(deleted.Body).Decode(&deletedBody); err != nil || deletedBody.ID == "" {
		t.Fatalf("delete body=%s", deleted.Body.String())
	}

	var wg sync.WaitGroup
	statuses := make(chan int, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			body, _ := json.Marshal(map[string]string{"id": deletedBody.ID})
			req := httptest.NewRequest(http.MethodPost, "/api/trash/restore", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			for _, cookie := range client.cookies {
				req.AddCookie(cookie)
			}
			resp := httptest.NewRecorder()
			s.Handler().ServeHTTP(resp, req)
			statuses <- resp.Code
		}()
	}
	wg.Wait()
	close(statuses)
	winners, notFound := 0, 0
	for status := range statuses {
		switch status {
		case http.StatusOK:
			winners++
		case http.StatusNotFound:
			notFound++
		default:
			t.Fatalf("unexpected concurrent restore status=%d", status)
		}
	}
	if winners != 1 || notFound != 7 {
		t.Fatalf("restore winners=%d notFound=%d", winners, notFound)
	}
	content, err := os.ReadFile(filepath.Join(cfg.StorageDir, "race.txt"))
	if err != nil || string(content) != "safe" {
		t.Fatalf("restored content=%q err=%v", content, err)
	}
}
