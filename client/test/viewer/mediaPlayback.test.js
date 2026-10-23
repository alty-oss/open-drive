
import assert from 'node:assert/strict';
import test from 'node:test';

let React;
let act;
let createRoot;
let useMediaPlayback;

class FakeMedia extends EventTarget {
  currentTime = 0;
  duration = 120;
  ended = false;
  loop = false;
  muted = false;
  volume = 1;
  src = '/audio.mp3';
  pauseCalls = 0;
  playCalls = 0;
  loadCalls = 0;
  #paused = true;

  get paused() {
    return this.#paused;
  }

  pause() {
    this.pauseCalls++;
    this.#paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  async play() {
    this.playCalls++;
    this.#paused = false;
    this.dispatchEvent(new Event('play'));
  }

  load() {
    this.loadCalls++;
    this.currentTime = 0;
    this.dispatchEvent(new Event('loadstart'));
  }
}

test.before(async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    { url: 'http://localhost/drive', pretendToBeVisual: true },
  );

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
    dom.window,
  );
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
    dom.window,
  );
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import('react')).default;
  act = React.act;
  ({ createRoot } = await import('react-dom/client'));
  ({ useMediaPlayback } = await import('../../src/features/viewer/hooks/useMediaPlayback.ts'));
});

test.beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
});

function mountPlayback(media, options = {}) {
  const observed = { playback: null };

  function Harness() {
    const ref = React.useRef(media);
    observed.playback = useMediaPlayback(ref, {
      src: media.src,
      active: true,
      ...options,
    });
    return null;
  }

  const root = createRoot(document.getElementById('root'));
  return {
    observed,
    mount: () =>
      act(async () => {
        root.render(
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(Harness),
          ),
        );
        await Promise.resolve();
      }),
    unmount: () => act(() => root.unmount()),
  };
}

test('StrictMode preserves the source and unmount stops playback', async () => {
  const media = new FakeMedia();
  const harness = mountPlayback(media);

  await harness.mount();
  assert.equal(media.paused, false);
  assert.equal(media.src, '/audio.mp3');
  assert.ok(media.loadCalls >= 2);

  harness.unmount();
  assert.equal(media.paused, true);
  assert.equal(media.src, '/audio.mp3');
});

test('time and progress follow media events', async () => {
  const media = new FakeMedia();
  const harness = mountPlayback(media);

  await harness.mount();
  try {
    act(() => {
      media.duration = 200;
      media.dispatchEvent(new Event('durationchange'));
      media.currentTime = 50;
      media.dispatchEvent(new Event('timeupdate'));
    });

    assert.equal(harness.observed.playback.duration, 200);
    assert.equal(harness.observed.playback.currentTime, 50);
    assert.equal(harness.observed.playback.progress, 0.25);
  } finally {
    harness.unmount();
  }
});
