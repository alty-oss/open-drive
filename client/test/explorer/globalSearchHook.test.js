
import assert from "node:assert/strict";
import test from "node:test";

let React;
let act;
let createRoot;
let useGlobalSearch;

test.before(async () => {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    {
      url: "http://localhost/drive",
      pretendToBeVisual: true,
    },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ useGlobalSearch } = await import("../../src/features/explorer/hooks/useGlobalSearch.ts"));
});

test("search enters loading immediately during debounce", async () => {
  const observed = { current: null };
  let resolveFetch;
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls++;
    return new Promise((resolve) => {
      resolveFetch = resolve;
    });
  };

  function Harness({ query }) {
    observed.current = useGlobalSearch(query);
    return null;
  }

  const root = createRoot(document.getElementById("root"));
  try {
    act(() => root.render(React.createElement(Harness, { query: "" })));
    act(() => root.render(React.createElement(Harness, { query: "lua" })));

    assert.equal(observed.current.active, true);
    assert.equal(observed.current.loading, true);
    assert.deepEqual(observed.current.files, []);

    await act(
      () => new Promise((resolve) => window.setTimeout(resolve, 240)),
    );
    assert.equal(fetchCalls, 1);

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          items: [
            {
              path: "lua.txt",
              name: "lua.txt",
              isFolder: false,
              isImage: false,
              size: 10,
              date: "2026-07-30T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          total: 1,
        }),
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    assert.equal(observed.current.loading, false);
    assert.equal(observed.current.files.length, 1);
  } finally {
    act(() => root.unmount());
  }
});
