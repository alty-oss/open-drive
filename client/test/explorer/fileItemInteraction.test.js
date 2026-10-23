
import assert from 'node:assert/strict';
import test from 'node:test';

let React;
let act;
let createRoot;
let useFileItemInteraction;

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

  React = (await import('react')).default;
  act = React.act;
  ({ createRoot } = await import('react-dom/client'));
  ({ useFileItemInteraction } = await import(
    '../../src/features/explorer/hooks/useFileItemInteraction.ts'
  ));
});

function mountInteraction() {
  const calls = {
    focused: 0,
    selected: 0,
    toggled: 0,
    opened: 0,
    context: 0,
  };
  const observed = { api: null };
  const file = {
    path: 'fotos/a.png',
    name: 'a.png',
    isFolder: false,
    isImage: true,
    size: 10,
    date: new Date().toISOString(),
  };

  function Harness() {
    observed.api = useFileItemInteraction({
      file,
      onFocusPath: () => calls.focused++,
      onSelect: () => calls.selected++,
      onToggleSelect: () => calls.toggled++,
      onOpen: () => calls.opened++,
      onContextMenu: () => calls.context++,
    });
    return null;
  }

  const root = createRoot(document.getElementById('root'));
  act(() => root.render(React.createElement(Harness)));
  return {
    calls,
    observed,
    unmount: () => act(() => root.unmount()),
  };
}

test('a simple touch opens the item without changing the selection', () => {
  const { calls, observed, unmount } = mountInteraction();
  try {
    act(() => {
      observed.api.onPointerDown({
        pointerType: 'touch',
        clientX: 10,
        clientY: 10,
      });
      observed.api.onPointerUp();
      observed.api.onClick();
    });

    assert.equal(calls.opened, 1);
    assert.equal(calls.selected, 0);
    assert.equal(calls.toggled, 0);
    assert.equal(calls.focused, 1);
  } finally {
    unmount();
  }
});

test('mouse click preserves click selection', () => {
  const { calls, observed, unmount } = mountInteraction();
  try {
    act(() => {
      observed.api.onPointerDown({
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
      });
      observed.api.onClick();
    });

    assert.equal(calls.opened, 0);
    assert.equal(calls.selected, 1);
    assert.equal(calls.focused, 1);
  } finally {
    unmount();
  }
});

test('a long touch toggles selection and suppresses the next open', async () => {
  const { calls, observed, unmount } = mountInteraction();
  try {
    act(() => {
      observed.api.onPointerDown({
        pointerType: 'touch',
        clientX: 10,
        clientY: 10,
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 480));
    act(() => {
      observed.api.onPointerUp();
      observed.api.onClick();
    });

    assert.equal(calls.toggled, 1);
    assert.equal(calls.opened, 0);
    assert.equal(calls.selected, 0);
    assert.equal(calls.focused, 1);
  } finally {
    unmount();
  }
});
