import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sortFileItems,
} from '../../src/features/explorer/model/sorting.ts';

const item = (name, options = {}) => ({
  path: options.path ?? name,
  name,
  isFolder: options.isFolder ?? false,
  isImage: false,
  size: options.size ?? 0,
  date: options.data ?? '2026-01-01T00:00:00.000Z',
});

test('sorting keeps folders before files', () => {
  const files = [
    item('z.txt', { size: 2 }),
    item('A folder', { isFolder: true }),
    item('a.txt', { size: 1 }),
    item('Z folder', { isFolder: true }),
  ];

  assert.deepEqual(
    sortFileItems(files, 'name', 'asc').map((file) => file.name),
    ['A folder', 'Z folder', 'a.txt', 'z.txt'],
  );
  assert.deepEqual(
    sortFileItems(files, 'size', 'desc').map((file) => file.name),
    ['A folder', 'Z folder', 'z.txt', 'a.txt'],
  );
});
