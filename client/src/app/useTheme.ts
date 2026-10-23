import { useCallback, useEffect, useState } from "react";
import type { ThemeMode } from "@/shared/ui/theme";

export type { ThemeMode } from "@/shared/ui/theme";

const STORAGE_KEY = "open-drive:theme-v1";

function initialTheme(): ThemeMode {
  if (
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "light"
  ) {
    return "light";
  }
  return "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
    document
      .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#141516" : "#f0f2f5");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}
