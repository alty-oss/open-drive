package index

import (
	"strings"
)

func clampPageSize(value, def, max int) int {
	if value == 0 {
		value = def
	}
	if value < 1 {
		value = 1
	}
	if value > max {
		value = max
	}
	return value
}

func escapeLike(s string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(s)
}
