
import assert from "node:assert/strict";
import test from "node:test";

let React;
let act;
let createRoot;
let useFavorites;

test.before(async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    { url: "http://localhost/", pretendToBeVisual: true },
  );
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ useFavorites } = await import(
    "../../src/features/favorites/hooks/useFavorites.ts"
  ));
});

function json(body, status = 200) {
  return Promise.resolve({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
}

async function mountFavorites(fetchStub) {
  const observed = { current: null, toasts: [] };
  globalThis.fetch = fetchStub;

  function Harness() {
    observed.current = useFavorites({
      onToast: (message) => observed.toasts.push(message),
    });
    return null;
  }

  const root = createRoot(document.getElementById("root"));
  await act(async () => root.render(React.createElement(Harness)));
  return { observed, unmount: () => act(() => root.unmount()) };
}

test("loads account favorites on mount", async () => {
  const { observed, unmount } = await mountFavorites(() =>
    json({ items: [{ path: "fotos/2024", name: "2024" }] }),
  );
  try {
    assert.deepEqual(observed.current.favorites, [
      { path: "fotos/2024", name: "2024" },
    ]);
    assert.equal(observed.current.isFavorite("fotos/2024"), true);
    assert.equal(observed.current.isFavorite("fotos"), false);
  } finally {
    await unmount();
  }
});

test("toggles a favorite using the server response", async () => {
  const calls = [];
  const { observed, unmount } = await mountFavorites((url, options = {}) => {
    calls.push(`${options.method ?? "GET"} ${url}`);
    if (options.method === "PUT") {
      return json({ items: [{ path: "docs", name: "docs" }] });
    }
    if (options.method === "DELETE") return json({ items: [] });
    return json({ items: [] });
  });
  try {
    await act(() => observed.current.toggleFavorite("docs"));
    assert.equal(observed.current.isFavorite("docs"), true);

    await act(() => observed.current.toggleFavorite("docs"));
    assert.equal(observed.current.isFavorite("docs"), false);
    assert.deepEqual(calls, [
      "GET /api/favorites",
      "PUT /api/favorites",
      "DELETE /api/favorites?path=docs",
    ]);
  } finally {
    await unmount();
  }
});

test("favorite failure shows an error and preserves the list", async () => {
  const originalError = console.error;
  console.error = () => {};
  const { observed, unmount } = await mountFavorites((url, options = {}) =>
    options.method === "PUT" ? json({}, 500) : json({ items: [] }),
  );
  try {
    await act(() => observed.current.toggleFavorite("docs"));
    assert.deepEqual(observed.current.favorites, []);
    assert.deepEqual(observed.toasts, ["Unable to favorite the folder"]);
  } finally {
    console.error = originalError;
    await unmount();
  }
});
