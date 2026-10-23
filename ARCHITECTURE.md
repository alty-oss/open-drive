# OpenDrive backend architecture

The Go backend is organized around a small composition root and internal
packages with one-way dependencies:

```text
cmd/open-drive -> internal/app -> internal/httpapi, internal/watch
                                   |
                                   v
                auth, config, database, index, metadata, realtime, storage
```

`cmd/open-drive` handles process concerns only: logging, configuration, signals,
and the exit status. `internal/app` owns resource construction and shutdown. It
opens the database and storage root, reconciles the index, wires the HTTP API and
watcher, and coordinates graceful shutdown.

`internal/httpapi` is the transport layer. Its files are grouped by capability
(files, uploads, downloads, sharing, trash, and metadata), while shared routing,
middleware, and encoding stay separate. Lower-level packages must not import
`internal/app` or `internal/httpapi`.

Packages remain under `internal/` until an external Go API is intentionally
designed. Avoid generic packages such as `utils`, `common`, or `helpers`; new
packages should represent a concrete capability with a concise name.

## Tests

All Go tests use external test packages under `tests/` so they exercise exported
behavior instead of implementation details:

- `tests/unit`: fast tests without database, filesystem watchers, or sockets.
- `tests/integration`: SQLite, filesystem, HTTP handler, and watcher behavior.
- `tests/contract`: network-level HTTP and WebSocket contracts.
- `tests/testkit`: temporary configuration, application setup, and HTTP clients.

Run `npm run test:go` for the fast loop, an individual integration or contract
script when working in that area, and `npm run test:go:all` before merging.
Production packages must never import `tests/testkit`.

## Compatibility

Internal Go constructors may evolve as the architecture changes. HTTP routes,
JSON payloads, WebSocket events, the SQLite schema, and the storage layout should
remain stable unless a deliberate product change documents the migration.
