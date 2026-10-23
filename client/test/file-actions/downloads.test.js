import assert from 'node:assert/strict';
import test from 'node:test';
import { visibleItemsDownloadRequest } from '../../src/features/file-actions/lib/downloads.ts';

function item(path, overrides = {}) {
  return {
    path,
    name: path.split('/').at(-1),
    isFolder: false,
    isImage: false,
    size: 1,
    date: new Date().toISOString(),
    ...overrides,
  };
}

test('Download all sends exactly the visible paths', () => {
  const request = visibleItemsDownloadRequest(null, [
    item('album/a.png'),
    item('outra foto.png'),
  ]);

  assert.equal(request.action, '/api/download-zip-batch');
  assert.equal(request.parameter, 'paths');
  assert.deepEqual(request.values, [
    'album/a.png',
    'outra foto.png',
  ]);
});

test('Download all in trash uses ids and the protected trash route', () => {
  const request = visibleItemsDownloadRequest('trash', [
    item('trash-id-1', { isTrash: true }),
    item('trash-id-2', { isTrash: true }),
  ]);

  assert.equal(request.action, '/api/download-trash-zip');
  assert.equal(request.parameter, 'ids');
  assert.deepEqual(request.values, [
    'trash-id-1',
    'trash-id-2',
  ]);
});

test('Download all does not navigate from an empty view', () => {
  assert.equal(visibleItemsDownloadRequest(null, []), null);
});
