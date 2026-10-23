
import assert from 'node:assert/strict';
import test from 'node:test';

let React;
let act;
let createRoot;
let useFiles;
let fetchImplementation;

const stats = {
  used: 0,
  fileCount: 0,
  folderCount: 0,
  byType: {},
  trashCount: 0,
  trashSize: 0,
  totalUsed: 0,
  quota: 1000,
  available: 1000,
  maxUploadSize: 1000,
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test.before(async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/drive',
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = (...args) => fetchImplementation(...args);

  React = (await import('react')).default;
  act = React.act;
  ({ createRoot } = await import('react-dom/client'));
  ({ useFiles } = await import('../../src/features/explorer/hooks/useFiles.ts'));
});

function mountFiles() {
  const observed = { api: null };

  function Harness() {
    observed.api = useFiles({ currentPath: '', activeFilter: null });
    return null;
  }

  const root = createRoot(document.getElementById('root'));
  act(() => root.render(React.createElement(Harness)));
  return {
    observed,
    unmount: () => act(() => root.unmount()),
  };
}

test('listing exposes loading until the response arrives', async () => {
  let resolveListing;
  const listing = new Promise((resolve) => {
    resolveListing = resolve;
  });
  const file = {
    path: 'nota.txt',
    name: 'nota.txt',
    isFolder: false,
    isImage: false,
    size: 4,
    date: new Date().toISOString(),
  };
  fetchImplementation = (url) =>
    String(url).includes('/api/storage/stats')
      ? Promise.resolve(jsonResponse(stats))
      : listing;

  const { observed, unmount } = mountFiles();
  try {
    assert.equal(observed.api.filesLoading, true);
    assert.equal(observed.api.filesError, null);

    await act(async () => {
      resolveListing(jsonResponse([file]));
      await listing;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    assert.equal(observed.api.filesLoading, false);
    assert.equal(observed.api.filesError, null);
    assert.deepEqual(observed.api.files.map((item) => item.path), ['nota.txt']);
  } finally {
    unmount();
  }
});

test('failure replaces the view with an error and retry recovers', async () => {
  let fail = true;
  fetchImplementation = (url) => {
    if (String(url).includes('/api/storage/stats')) {
      return Promise.resolve(jsonResponse(stats));
    }
    return Promise.resolve(
      fail ? jsonResponse({ error: 'unavailable' }, 503) : jsonResponse([]),
    );
  };

  const { observed, unmount } = mountFiles();
  try {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(observed.api.filesLoading, false);
    assert.match(observed.api.filesError, /503/);

    fail = false;
    await act(async () => {
      await observed.api.refreshFiles();
    });
    assert.equal(observed.api.filesLoading, false);
    assert.equal(observed.api.filesError, null);
  } finally {
    unmount();
  }
});

test('load concatenates cursor pages without duplicating files', async () => {
  const now = new Date().toISOString();
  const first = {
    path: 'a.txt',
    name: 'a.txt',
    isFolder: false,
    isImage: false,
    size: 1,
    date: now,
  };
  const second = { ...first, path: 'b.txt', name: 'b.txt' };
  const listingUrls = [];

  fetchImplementation = (url) => {
    const value = String(url);
    if (value.includes('/api/storage/stats')) {
      return Promise.resolve(jsonResponse(stats));
    }
    listingUrls.push(value);
    return Promise.resolve(
      jsonResponse(
        value.includes('cursor=pagina-2')
          ? { items: [first, second], nextCursor: null, total: 2 }
          : { items: [first], nextCursor: 'pagina-2', total: 2 },
      ),
    );
  };

  const { observed, unmount } = mountFiles();
  try {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(observed.api.hasMore, true);
    assert.equal(observed.api.totalCount, 2);

    await act(async () => {
      await observed.api.loadMore();
    });

    assert.deepEqual(
      observed.api.files.map((item) => item.path),
      ['a.txt', 'b.txt'],
    );
    assert.equal(observed.api.hasMore, false);
    assert.equal(listingUrls.length, 2);
    assert.match(listingUrls[1], /cursor=pagina-2/);
  } finally {
    unmount();
  }
});

function mountNavigableFiles(initialPath) {
  const observed = { api: null, renders: [] };
  const root = createRoot(document.getElementById('root'));

  function Harness({ currentPath }) {
    observed.api = useFiles({ currentPath, activeFilter: null });
    observed.renders.push({
      path: currentPath,
      loading: observed.api.filesLoading,
      files: observed.api.files.map((item) => item.path),
    });
    return null;
  }

  const render = (currentPath) =>
    act(() => root.render(React.createElement(Harness, { currentPath })));
  render(initialPath);
  return {
    observed,
    navigate: render,
    unmount: () => act(() => root.unmount()),
  };
}

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function item(path, isFolder = false) {
  return {
    path,
    name: path.split('/').pop(),
    isFolder,
    isImage: false,
    size: 1,
    date: new Date().toISOString(),
  };
}

test('returning to a visited folder shows the cache without a skeleton and revalidates', async () => {
  const listings = {
    '': [item('fotos', true), item('nota.txt')],
    fotos: [item('fotos/a.png')],
  };
  let hold = null;
  fetchImplementation = (url) => {
    const value = String(url);
    if (value.includes('/api/storage/stats')) {
      return Promise.resolve(jsonResponse(stats));
    }
    const path = new URL(value, 'http://localhost').searchParams.get('path') ?? '';
    return hold
      ? hold.then(() => jsonResponse(listings[path]))
      : Promise.resolve(jsonResponse(listings[path]));
  };

  const { observed, navigate, unmount } = mountNavigableFiles('');
  try {
    await flush();
    navigate('fotos');
    await flush();
    assert.deepEqual(observed.api.files.map((f) => f.path), ['fotos/a.png']);


    let release;
    hold = new Promise((resolve) => {
      release = resolve;
    });
    observed.renders.length = 0;
    navigate('');
    const rootRenders = observed.renders.filter((entry) => entry.path === '');
    assert.ok(
      rootRenders.every((entry) => !entry.loading),
      'no cached root render should show a skeleton',
    );
    assert.deepEqual(observed.api.files.map((f) => f.path), ['fotos', 'nota.txt']);
    assert.equal(observed.api.filesRefreshing, true);

    listings[''] = [item('fotos', true), item('nota.txt'), item('novo.txt')];
    await act(async () => {
      release();
      await hold;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(observed.api.filesRefreshing, false);
    assert.deepEqual(
      observed.api.files.map((f) => f.path),
      ['fotos', 'nota.txt', 'novo.txt'],
    );
  } finally {
    unmount();
  }
});

test('refresh after mutation keeps the list and optimistic removal removes the item immediately', async () => {
  let listing = [item('a.txt'), item('b.txt')];
  fetchImplementation = (url) =>
    Promise.resolve(
      jsonResponse(String(url).includes('/api/storage/stats') ? stats : listing),
    );

  const { observed, navigate, unmount } = mountNavigableFiles('');
  try {
    await flush();
    act(() => observed.api.removeItems(['a.txt']));
    assert.deepEqual(observed.api.files.map((f) => f.path), ['b.txt']);
    assert.equal(observed.api.totalCount, 1);

    listing = [item('b.txt')];
    observed.renders.length = 0;
    await act(async () => {
      await observed.api.refreshFiles();
    });
    assert.ok(observed.renders.every((entry) => !entry.loading));
    assert.deepEqual(observed.api.files.map((f) => f.path), ['b.txt']);
    navigate('');
  } finally {
    unmount();
  }
});

test('prefetch warms the folder and the next navigation shows no skeleton', async () => {
  const listings = { '': [item('docs', true)], docs: [item('docs/x.md')] };
  fetchImplementation = (url) => {
    const value = String(url);
    if (value.includes('/api/storage/stats')) {
      return Promise.resolve(jsonResponse(stats));
    }
    const path = new URL(value, 'http://localhost').searchParams.get('path') ?? '';
    return Promise.resolve(jsonResponse(listings[path]));
  };

  const { observed, navigate, unmount } = mountNavigableFiles('');
  try {
    await flush();
    observed.api.prefetchPath('docs');
    await flush();

    observed.renders.length = 0;
    navigate('docs');
    assert.ok(observed.renders.filter((e) => e.path === 'docs').every((e) => !e.loading));
    assert.deepEqual(observed.api.files.map((f) => f.path), ['docs/x.md']);
    await flush();
  } finally {
    unmount();
  }
});
