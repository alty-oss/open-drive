export interface Favorite {
  path: string;
  name: string;
}

async function readFavorites(response: Response, errorLabel: string) {
  if (!response.ok) throw new Error(`${errorLabel} (${response.status})`);
  const body = await response.json();
  return (body.items ?? []) as Favorite[];
}

export async function fetchFavorites(signal?: AbortSignal) {
  return readFavorites(
    await fetch("/api/favorites", { signal }),
    "Unable to load favorites",
  );
}

export async function addFavorite(path: string) {
  return readFavorites(
    await fetch("/api/favorites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }),
    "Unable to favorite folder",
  );
}

export async function removeFavorite(path: string) {
  return readFavorites(
    await fetch(`/api/favorites?${new URLSearchParams({ path })}`, {
      method: "DELETE",
    }),
    "Unable to remove favorite",
  );
}
