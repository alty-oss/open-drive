
import assert from 'node:assert/strict';
import test from 'node:test';

let React;
let act;
let createRoot;
let useDashboardExplorer;
let useDashboardModal;

test.before(async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });

  React = (await import('react')).default;
  act = React.act;
  ({ createRoot } = await import('react-dom/client'));
  ({ useDashboardExplorer } = await import('../../../src/pages/dashboard/hooks/useDashboardExplorer.ts'));
  ({ useDashboardModal } = await import('../../../src/pages/dashboard/hooks/useDashboardModal.ts'));
});

test.beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

function file(overrides = {}) {
  return {
    path: 'fotos/a.png',
    name: 'a.png',
    isFolder: false,
    isImage: true,
    size: 10,
    date: new Date().toISOString(),
    ...overrides,
  };
}

function mountHarness() {
  const observed = {
    renders: 0,
    api: null,
    currentPath: null,
    activeFilter: null,
    tabs: null,
    activeTab: null,
    activeTabId: null,
    modal: null,
    search: null,
    selectionSize: null,
  };

  function Harness() {
    observed.renders++;

    const navigationResetRef = React.useRef(() => undefined);
    const clearViewRef = React.useRef(() => undefined);
    const [search, setSearch] = React.useState('query');
    const [selection, setSelection] = React.useState(() => new Set(['x']));
    const modal = useDashboardModal();

    const resetExplorerState = React.useCallback(
      () => navigationResetRef.current(),
      [],
    );
    const clearExplorerView = React.useCallback(() => clearViewRef.current(), []);

    const explorer = useDashboardExplorer({
      resetExplorerState,
      clearExplorerView,
      openPreview: modal.openPreview,
    });

    clearViewRef.current = () => {
      setSearch('');
      setSelection(new Set());
    };
    navigationResetRef.current = () => {
      clearViewRef.current();
    };

    observed.api = { explorer, modal };
    observed.currentPath = explorer.currentPath;
    observed.activeFilter = explorer.activeFilter;
    observed.tabs = explorer.tabs;
    observed.activeTab = explorer.activeTab;
    observed.activeTabId = explorer.activeTabId;
    observed.modal = modal.modal;
    observed.search = search;
    observed.selectionSize = selection.size;
    return null;
  }

  const container = document.getElementById('root');
  const root = createRoot(container);
  act(() => root.render(React.createElement(Harness)));
  return { observed, unmount: () => act(() => root.unmount()) };
}

test('navigating to a folder updates the route and clears the view', () => {
  const { observed, unmount } = mountHarness();
  try {
    act(() => observed.api.explorer.handleNavigate('fotos/2024'));

    assert.equal(observed.currentPath, 'fotos/2024');
    assert.equal(observed.activeFilter, null);
    assert.equal(window.location.pathname, '/');
    assert.deepEqual(window.history.state, { path: 'fotos/2024', filter: null });
    assert.equal(observed.search, '');
    assert.equal(observed.selectionSize, 0);
  } finally {
    unmount();
  }
});

test('opening a filter converges without a render loop', () => {
  const { observed, unmount } = mountHarness();
  try {
    const before = observed.renders;
    act(() => observed.api.explorer.setBrowserLocation('', 'links'));
    const afterOpen = observed.renders;

    assert.equal(observed.activeFilter, 'links');
    assert.equal(observed.currentPath, '');
    assert.equal(window.location.pathname, '/');
    assert.deepEqual(window.history.state, { path: '', filter: 'links' });
    assert.ok(
      afterOpen - before < 8,
      `rendered ${afterOpen - before} times while opening the filter; it should settle`,
    );

    act(() => {});
    assert.equal(observed.renders, afterOpen);
  } finally {
    unmount();
  }
});

test('opening a folder navigates in the current explorer', () => {
  const { observed, unmount } = mountHarness();
  try {
    act(() =>
      observed.api.explorer.handleOpen(
        file({ path: 'documentos', name: 'documentos', isFolder: true }),
      ),
    );

    assert.equal(observed.currentPath, 'documentos');
    assert.equal(observed.modal.kind, 'none');
  } finally {
    unmount();
  }
});

test('opening a file shows the preview modal', () => {
  const { observed, unmount } = mountHarness();
  try {
    act(() => observed.api.explorer.handleOpen(file()));

    assert.equal(observed.currentPath, '');
    assert.equal(observed.modal.kind, 'preview');
    assert.equal(observed.modal.file.path, 'fotos/a.png');
    assert.equal(observed.modal.detailsOpen, false);
  } finally {
    unmount();
  }
});

test('folders and filters can open in independent tabs', () => {
  const { observed, unmount } = mountHarness();
  try {
    const rootTabId = observed.activeTabId;

    act(() =>
      observed.api.explorer.handleOpenFolderInNewTab(
        file({ path: 'projetos', name: 'projetos', isFolder: true }),
      ),
    );

    assert.equal(observed.tabs.length, 2);
    assert.equal(observed.currentPath, 'projetos');
    assert.notEqual(observed.activeTabId, rootTabId);

    act(() => observed.api.explorer.handleActivateTab(rootTabId));
    assert.equal(observed.currentPath, '');

    act(() => observed.api.explorer.handleOpenFilterInNewTab('links'));
    assert.equal(observed.activeFilter, 'links');
    assert.equal(observed.tabs.at(-1).name, 'Links');
  } finally {
    unmount();
  }
});

test('closing the active tab returns to the neighboring tab', () => {
  const { observed, unmount } = mountHarness();
  try {
    const rootTabId = observed.activeTabId;
    act(() =>
      observed.api.explorer.handleOpenFolderInNewTab(
        file({ path: 'documentos', name: 'documentos', isFolder: true }),
      ),
    );
    const folderTabId = observed.activeTabId;

    act(() => observed.api.explorer.handleCloseTab(folderTabId));

    assert.equal(observed.tabs.length, 1);
    assert.equal(observed.activeTabId, rootTabId);
    assert.equal(observed.currentPath, '');
  } finally {
    unmount();
  }
});

test('new tab button always creates a new tab at the root', () => {
  const { observed, unmount } = mountHarness();
  try {
    const firstTabId = observed.activeTabId;

    act(() => observed.api.explorer.handleNewTab());

    assert.equal(observed.tabs.length, 2);
    assert.notEqual(observed.activeTabId, firstTabId);
    assert.equal(observed.tabs.at(-1).name, 'My Drive');
    assert.equal(observed.currentPath, '');
  } finally {
    unmount();
  }
});

test('reload always returns home with one tab', () => {
  const first = mountHarness();
  act(() =>
    first.observed.api.explorer.handleOpenFolderInNewTab(
      file({ path: 'projects/archive', name: 'archive', isFolder: true }),
    ),
  );
  first.unmount();

  window.history.replaceState(null, '', '/drive/projects/archive');
  const second = mountHarness();
  try {
    assert.equal(second.observed.tabs.length, 1);
    assert.equal(second.observed.currentPath, '');
    assert.equal(second.observed.activeFilter, null);
    assert.equal(second.observed.activeTab.path, '');
    assert.equal(window.location.pathname, '/');
  } finally {
    second.unmount();
  }
});

test('details reuse Quick Look with the inspector open', () => {
  const { observed, unmount } = mountHarness();
  try {
    act(() => observed.api.modal.openDetails(file()));
    assert.equal(observed.modal.kind, 'preview');
    assert.equal(observed.modal.detailsOpen, true);

    act(() => observed.api.modal.togglePreviewDetails());
    assert.equal(observed.modal.detailsOpen, false);
  } finally {
    unmount();
  }
});

test('editor modal tracks dirty state to protect closing', () => {
  const { observed, unmount } = mountHarness();
  try {
    act(() => observed.api.modal.openEditor(file({ path: 'notes.md', name: 'notes.md' })));
    assert.equal(observed.modal.kind, 'editor');
    assert.equal(observed.modal.dirty, false);

    act(() => observed.api.modal.setEditorDirty(true));
    assert.equal(observed.modal.kind, 'editor');
    assert.equal(observed.modal.dirty, true);
  } finally {
    unmount();
  }
});

test('going back restores the state location and clears the view', () => {
  const { observed, unmount } = mountHarness();
  try {
    act(() => observed.api.explorer.handleNavigate('fotos'));
    assert.equal(observed.currentPath, 'fotos');

    act(() => {
      window.dispatchEvent(new window.PopStateEvent('popstate', { state: null }));
    });

    assert.equal(observed.currentPath, '');
    assert.equal(observed.activeFilter, null);
    assert.equal(observed.search, '');
    assert.equal(observed.selectionSize, 0);
  } finally {
    unmount();
  }
});
