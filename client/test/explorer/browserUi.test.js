import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEmptyStateActionIds,
  getHeaderMoreActionIds,
} from '../../src/features/explorer/model/browserUi.ts';

test('empty states offer the appropriate contextual action', () => {
  assert.deepEqual(getEmptyStateActionIds('report', null), ['clear-search']);
  assert.deepEqual(getEmptyStateActionIds('', null), ['upload', 'new-folder']);
  assert.deepEqual(getEmptyStateActionIds('', 'links'), ['go-to-drive']);
  assert.deepEqual(getEmptyStateActionIds('', 'trash'), []);
});

test('More menu contains available secondary actions', () => {
  assert.deepEqual(getHeaderMoreActionIds(false, null), ['download-visible']);
  assert.deepEqual(getHeaderMoreActionIds(true, 'links'), [
    'paste',
    'download-visible',
  ]);
  assert.deepEqual(getHeaderMoreActionIds(false, 'trash'), [
    'download-visible',
    'empty-trash',
  ]);
});
