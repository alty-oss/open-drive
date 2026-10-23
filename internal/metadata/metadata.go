package metadata

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/rwcarlsen/goexif/exif"
)

func Extract(ctx context.Context, filename, probe string) (string, map[string]any, error) {
	ext := strings.ToLower(path.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp":
		data := map[string]any{}
		if file, err := os.Open(filename); err == nil {
			if config, _, decodeErr := image.DecodeConfig(file); decodeErr == nil {
				data["width"], data["height"] = config.Width, config.Height
			}
			file.Close()
		}
		if exifData, err := readExif(filename); err == nil {
			mergeExif(data, exifData)
		}
		return "image", data, nil
	case ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".mp4", ".webm", ".mov", ".mkv", ".avi":
		data, err := probeMedia(ctx, filename, probe)
		kind := "video"
		switch ext {
		case ".mp3", ".wav", ".flac", ".ogg", ".m4a":
			kind = "audio"
		}
		return kind, data, err
	default:
		return "none", map[string]any{}, nil
	}
}

func readExif(filename string) (*exif.Exif, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return exif.Decode(file)
}

func mergeExif(data map[string]any, x *exif.Exif) {
	stringValue := func(name exif.FieldName) string {
		tag, err := x.Get(name)
		if err != nil {
			return ""
		}
		value, _ := tag.StringVal()
		return strings.TrimSpace(value)
	}
	rational := func(name exif.FieldName) (float64, bool) {
		tag, err := x.Get(name)
		if err != nil {
			return 0, false
		}
		num, den, err := tag.Rat2(0)
		if err != nil || den == 0 {
			return 0, false
		}
		return float64(num) / float64(den), true
	}
	if makeName, model := stringValue(exif.Make), stringValue(exif.Model); makeName != "" || model != "" {
		if makeName != "" && model != "" {
			data["camera"] = makeName + " " + model
		} else if makeName != "" {
			data["camera"] = makeName
		} else {
			data["camera"] = model
		}
	}
	if value := stringValue(exif.DateTimeOriginal); value != "" {
		if parsed, err := time.ParseInLocation("2006:01:02 15:04:05", value, time.Local); err == nil {
			data["takenAt"] = parsed.Format(time.RFC3339)
		}
	}
	if tag, err := x.Get(exif.ISOSpeedRatings); err == nil {
		if value, err := tag.Int64(0); err == nil {
			data["iso"] = value
		}
	}
	if value, ok := rational(exif.FNumber); ok {
		data["aperture"] = round(value, 1)
	}
	if value, ok := rational(exif.ExposureTime); ok {
		if value >= 1 {
			data["shutter"] = fmt.Sprintf("%.1f s", value)
		} else if value > 0 {
			data["shutter"] = fmt.Sprintf("1/%d s", int(0.5+1/value))
		}
	}
	if value, ok := rational(exif.FocalLength); ok {
		data["focalLength"] = round(value, 1)
	}
	lat, lon := gpsCoordinate(x, exif.GPSLatitude, exif.GPSLatitudeRef), gpsCoordinate(x, exif.GPSLongitude, exif.GPSLongitudeRef)
	if lat != nil && lon != nil {
		data["gps"] = map[string]float64{"latitude": *lat, "longitude": *lon}
	}
}

func gpsCoordinate(x *exif.Exif, valueName, refName exif.FieldName) *float64 {
	value, err := x.Get(valueName)
	if err != nil {
		return nil
	}
	var degrees float64
	for index := 0; index < 3; index++ {
		num, den, ratErr := value.Rat2(index)
		if ratErr != nil || den == 0 {
			return nil
		}
		part := float64(num) / float64(den)
		degrees += part / []float64{1, 60, 3600}[index]
	}
	ref, err := x.Get(refName)
	if err != nil {
		return nil
	}
	direction, _ := ref.StringVal()
	if strings.EqualFold(strings.TrimSpace(direction), "S") || strings.EqualFold(strings.TrimSpace(direction), "W") {
		degrees = -degrees
	}
	return &degrees
}

func probeMedia(ctx context.Context, filename, probe string) (map[string]any, error) {
	if probe == "" {
		return map[string]any{}, fmt.Errorf("ffprobe is not configured")
	}
	probeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	command := exec.CommandContext(probeCtx, probe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", filename)
	raw, err := command.Output()
	if err != nil {
		return map[string]any{}, err
	}
	var result struct {
		Streams []struct {
			CodecType  string `json:"codec_type"`
			CodecName  string `json:"codec_name"`
			Width      int    `json:"width"`
			Height     int    `json:"height"`
			SampleRate string `json:"sample_rate"`
			Channels   int    `json:"channels"`
		}
		Format struct {
			Duration string `json:"duration"`
			BitRate  string `json:"bit_rate"`
			Format   string `json:"format_name"`
		}
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return map[string]any{}, err
	}
	data := map[string]any{"container": result.Format.Format}
	if duration, err := strconv.ParseFloat(result.Format.Duration, 64); err == nil {
		data["durationMs"] = int64(duration * 1000)
	}
	if bitrate, err := strconv.ParseInt(result.Format.BitRate, 10, 64); err == nil {
		data["bitrate"] = bitrate
	}
	for _, stream := range result.Streams {
		if stream.CodecType == "video" {
			data["codec"] = stream.CodecName
			if stream.Width > 0 {
				data["width"], data["height"] = stream.Width, stream.Height
			}
			break
		}
		if stream.CodecType == "audio" {
			data["codec"] = stream.CodecName
			if rate, err := strconv.Atoi(stream.SampleRate); err == nil {
				data["sampleRate"] = rate
			}
			if stream.Channels > 0 {
				data["channels"] = stream.Channels
			}
			break
		}
	}
	return data, nil
}

func round(value float64, decimals int) float64 {
	factor := 1.0
	for n := 0; n < decimals; n++ {
		factor *= 10
	}
	return float64(int(value*factor+0.5)) / factor
}
