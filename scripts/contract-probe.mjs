#!/usr/bin/env node

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('Usage: node scripts/contract-probe.mjs http://127.0.0.1:PORT');
  process.exit(2);
}

let cookie = '';
async function request(method, route, body) {
  const headers = { Cookie: cookie };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookies = response.headers.getSetCookie?.() || [];
  if (setCookies.length > 0) cookie = setCookies[0].split(';', 1)[0];
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, text, json };
}

function expect(response, status, label) {
  if (response.status !== status) {
    throw new Error(`${label}: expected ${status}, received ${response.status}: ${response.text.slice(0, 240)}`);
  }
}

const suffix = `probe-${process.pid}`;
const folder = `${suffix}-docs`;
const file = `${folder}/hello.txt`;

const login = await request('POST', '/api/auth/login', { username: process.env.LOGIN_USER || 'test', password: process.env.LOGIN_PASS || 'pass' });
expect(login, 200, 'login');
const check = await request('GET', '/api/auth/check');
expect(check, 200, 'auth check');
if (!check.json?.authenticated) throw new Error('auth check did not authenticate');

const folderResponse = await request('POST', '/api/folders', { path: '', name: folder });
expect(folderResponse, 200, 'create folder');
const fileResponse = await request('POST', '/api/new-file', { path: folder, name: 'hello.txt', content: 'one' });
expect(fileResponse, 200, 'create file');

const listing = await request('GET', `/api/files?path=${encodeURIComponent(folder)}`);
expect(listing, 200, 'listing');
const listingItems = Array.isArray(listing.json) ? listing.json : listing.json?.items;
if (!listingItems?.some((item) => item.path === file)) throw new Error('file missing from listing');

const search = await request('GET', `/api/search?q=${encodeURIComponent('hello')}`);
expect(search, 200, 'search');
const searchItems = Array.isArray(search.json) ? search.json : search.json?.items;
if (!searchItems?.some((item) => item.path === file)) throw new Error('file missing from search');

const editor = await request('GET', `/api/file-content/${file}`);
expect(editor, 200, 'editor read');
if (editor.json?.content !== 'one') throw new Error('initial content mismatch');
const edit = await request('PUT', `/api/file-content/${file}`, { content: 'two' });
expect(edit, 200, 'editor write');

const access = await request('PUT', '/api/access', { path: file, visibility: 'public' });
expect(access, 200, 'public access');
const link = await request('POST', '/api/links', { path: file, type: 'download' });
expect(link, 201, 'create link');
if (!link.json?.token) throw new Error('link has no token');
const publicDownload = await request('GET', `/api/public-links/${encodeURIComponent(link.json.token)}/download`);
expect(publicDownload, 200, 'public download');
if (publicDownload.text !== 'two') throw new Error('public download mismatch');

const storage = await request('GET', '/api/storage');
expect(storage, 200, 'storage');
if (typeof storage.json?.used !== 'number') throw new Error('unexpected storage response shape');

const deleted = await request('DELETE', `/api/files/${file}`);
expect(deleted, 200, 'trash delete');
const trash = await request('GET', '/api/trash');
expect(trash, 200, 'trash list');
const trashItems = Array.isArray(trash.json) ? trash.json : trash.json?.items;
const trashItem = trashItems?.find((item) => item.originalPath === file);
if (!trashItem?.id) throw new Error('item missing from trash');
const restored = await request('POST', '/api/trash/restore', { id: trashItem.id });
expect(restored, 200, 'trash restore');

console.log(JSON.stringify({
  ok: true,
  folder,
  file,
  statuses: {
    login: login.status,
    listing: listing.status,
    search: search.status,
    editor: editor.status,
    publicDownload: publicDownload.status,
    trash: trash.status,
    restored: restored.status,
  },
}));
