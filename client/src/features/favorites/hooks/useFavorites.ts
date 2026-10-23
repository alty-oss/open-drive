import { useCallback, useEffect, useMemo, useState } from "react";
import { logClientError } from "@/shared/lib/logger";
import {
  addFavorite,
  fetchFavorites,
  removeFavorite,
  type Favorite,
} from "../api/favoritesApi";

interface UseFavoritesOptions {
  onToast: (message: string) => void;
}






export function useFavorites({ onToast }: UseFavoritesOptions) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const refresh = useCallback(async () => {
    try {
      setFavorites(await fetchFavorites());
    } catch (error) {
      logClientError("favorites.load_failed", error);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchFavorites(controller.signal)
      .then(setFavorites)
      .catch((error) => {
        if (controller.signal.aborted) return;
        logClientError("favorites.load_failed", error);
      });
    return () => controller.abort();
  }, []);

  const paths = useMemo(
    () => new Set(favorites.map((favorite) => favorite.path)),
    [favorites],
  );
  const isFavorite = useCallback((path: string) => paths.has(path), [paths]);

  const toggleFavorite = useCallback(
    async (path: string) => {
      const removing = paths.has(path);
      try {
        setFavorites(
          removing ? await removeFavorite(path) : await addFavorite(path),
        );
      } catch (error) {
        logClientError("favorites.toggle_failed", error, { path });
        onToast(
          removing
            ? "Unable to remove the favorite"
            : "Unable to favorite the folder",
        );
      }
    },
    [onToast, paths],
  );

  return { favorites, isFavorite, toggleFavorite, refresh };
}
