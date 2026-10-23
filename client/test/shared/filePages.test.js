import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendUniqueFiles,
  normalizeFilePage,
} from '../../src/shared/files/pagination.ts';

const file = (path) => ({
  path,
  name: path,
  isFolder: false,
  isImage: false,
  size: 1,
  date: '2026-01-01T00:00:00.000Z',
});

test('normalizes the legacy response as a completed page', () => {
  assert.deepEqual(normalizeFilePage([file('a.txt')]), {
    items: [file('a.txt')],
    nextCursor: null,
    total: 1,
  });
});

test('concatenates pages while removing duplicate paths', () => {
  assert.deepEqual(
    appendUniqueFiles(
      [file('a.txt'), file('b.txt')],
      [file('b.txt'), file('c.txt')],
    ).map((item) => item.path),
    ['a.txt', 'b.txt', 'c.txt'],
  );
});
