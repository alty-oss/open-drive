package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

const gib = int64(1024 * 1024 * 1024)

type Config struct {
	Port               string
	StorageDir         string
	DBPath             string
	SessionSecret      string
	LoginUser          string
	LoginPass          string
	LoginUser2         string
	LoginPass2         string
	MaxUploadSizeBytes int64
	StorageQuotaBytes  int64
	MaxUploadFiles     int
	WatchPolling       bool
	MetadataProbe      string
	ClientDist         string
}

func Load() (Config, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return Config{}, err
	}
	storageDir := envString("STORAGE_DIR", filepath.Join(cwd, "storage"))
	storageDir, err = filepath.Abs(storageDir)
	if err != nil {
		return Config{}, err
	}
	dbPath := envString("DB_PATH", filepath.Join(storageDir, ".data", "index.db"))
	if dbPath != ":memory:" {
		dbPath, err = filepath.Abs(dbPath)
		if err != nil {
			return Config{}, err
		}
	}
	maxUpload, err := envInt64("MAX_UPLOAD_SIZE_BYTES", 5*gib)
	if err != nil {
		return Config{}, err
	}
	quota, err := envInt64("STORAGE_QUOTA_BYTES", 50*gib)
	if err != nil {
		return Config{}, err
	}
	maxFiles, err := envInt("MAX_UPLOAD_FILES", 50)
	if err != nil {
		return Config{}, err
	}
	polling, err := envBool("WATCH_POLLING", false)
	if err != nil {
		return Config{}, err
	}
	return Config{
		Port:               envString("PORT", "3050"),
		StorageDir:         storageDir,
		DBPath:             dbPath,
		SessionSecret:      envString("SESSION_SECRET", "fallback-secret"),
		LoginUser:          os.Getenv("LOGIN_USER"),
		LoginPass:          os.Getenv("LOGIN_PASS"),
		LoginUser2:         os.Getenv("LOGIN_USER2"),
		LoginPass2:         os.Getenv("LOGIN_PASS2"),
		MaxUploadSizeBytes: maxUpload,
		StorageQuotaBytes:  quota,
		MaxUploadFiles:     maxFiles,
		WatchPolling:       polling,
		MetadataProbe:      envString("FFPROBE_PATH", "ffprobe"),
		ClientDist:         envString("CLIENT_DIST", filepath.Join(cwd, "client", "dist")),
	}, nil
}

func envString(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envInt64(key string, fallback int64) (int64, error) {
	value := envString(key, strconv.FormatInt(fallback, 10))
	n, err := strconv.ParseInt(value, 10, 64)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%s invalid", key)
	}
	return n, nil
}

func envInt(key string, fallback int) (int, error) {
	value := envString(key, strconv.Itoa(fallback))
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 {
		return 0, fmt.Errorf("%s invalid", key)
	}
	return n, nil
}

func envBool(key string, fallback bool) (bool, error) {
	value := envString(key, strconv.FormatBool(fallback))
	b, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("%s invalid", key)
	}
	return b, nil
}
