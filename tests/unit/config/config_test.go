package config_test

import (
	"path/filepath"
	"testing"

	"github.com/alty-oss/open-drive/internal/config"
)

func TestLoadDefaults(t *testing.T) {
	for _, key := range []string{
		"PORT", "STORAGE_DIR", "DB_PATH", "SESSION_SECRET", "LOGIN_USER", "LOGIN_PASS",
		"LOGIN_USER2", "LOGIN_PASS2", "MAX_UPLOAD_SIZE_BYTES", "STORAGE_QUOTA_BYTES",
		"MAX_UPLOAD_FILES", "WATCH_POLLING", "FFPROBE_PATH", "CLIENT_DIST",
	} {
		t.Setenv(key, "")
	}
	cfg, err := config.Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "3050" || cfg.MaxUploadFiles != 50 || cfg.WatchPolling {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if !filepath.IsAbs(cfg.StorageDir) || !filepath.IsAbs(cfg.DBPath) || !filepath.IsAbs(cfg.ClientDist) {
		t.Fatalf("paths must be absolute: storage=%q db=%q client=%q", cfg.StorageDir, cfg.DBPath, cfg.ClientDist)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name  string
		key   string
		value string
	}{
		{name: "upload size", key: "MAX_UPLOAD_SIZE_BYTES", value: "-1"},
		{name: "quota", key: "STORAGE_QUOTA_BYTES", value: "many"},
		{name: "file count", key: "MAX_UPLOAD_FILES", value: "0"},
		{name: "polling", key: "WATCH_POLLING", value: "sometimes"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv(test.key, test.value)
			if _, err := config.Load(); err == nil {
				t.Fatalf("config.Load accepted %s=%q", test.key, test.value)
			}
		})
	}
}
