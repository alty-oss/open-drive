import assert from 'node:assert/strict';
import test from 'node:test';
import { foldersAffectedBy } from '../../../src/pages/dashboard/model/fileChanges.ts';

const sorted = (set) => [...set].sort();

test('move affects the item source folder and destination', () => {
  assert.deepEqual(
    sorted(foldersAffectedBy({ event: 'move', from: 'fotos/a.png', to: 'file' })),
    ['file', 'fotos'],
  );
});

test('batches use the folders provided by the server', () => {
  assert.deepEqual(
    sorted(foldersAffectedBy({ event: 'trash-batch', paths: ['', 'docs'] })),
    ['', 'docs'],
  );
});

test('access-changed also affects the folder that lists the item', () => {
  assert.deepEqual(
    sorted(foldersAffectedBy({ event: 'access-changed', path: 'docs/a.txt' })),
    ['docs', 'docs/a.txt'],
  );
});

test('event without a location requests a current view reload', () => {
  assert.equal(foldersAffectedBy({ event: 'trash-empty' }), null);
  assert.equal(foldersAffectedBy({ event: 'index-ready' }), null);
});
