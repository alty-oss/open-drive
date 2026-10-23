<p align="center">
  <img src="client/public/brand-mark.png" alt="OpenDrive" width="180">
</p>

<h1 align="center">OpenDrive</h1>

<p align="center">A filesystem-first, self-hosted alternative to cloud drives.</p>

# OpenDrive

OpenDrive is a self-hosted alternative to cloud drives. It treats the server
filesystem as the source of truth and adds a web interface for browsing,
searching, editing, sharing, previewing, and downloading files.

It is designed for a VPS, home server, or private infrastructure where the
storage directory should remain directly accessible and easy to back up.

## Run with Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Open `http://localhost:3050` and set `LOGIN_USER`, `LOGIN_PASS`, and
`SESSION_SECRET` before exposing the service to a network.

The current login is intentionally a minimal deployment guard. It will be
replaced by proper user accounts and a complete authentication system in a
future release.

The host directory `./storage` is mounted into the container at
`/app/storage`. It contains the user files, the SQLite index, active upload
chunks, and trash data.

For a production VPS, including HTTPS, health checks, updates, backups,
restoration, and troubleshooting, follow [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Database direction

SQLite remains the right default for the current single-server architecture:
the database is local to the filesystem, easy to back up, and keeps deployment
simple. A PostgreSQL backend should be evaluated when OpenDrive needs multiple
application instances, higher write concurrency, a remote database, or
high-availability replication. The user files should remain on the filesystem
in either design.

## Configuration

The main environment variables are:

| Variable | Purpose |
| --- | --- |
| `LOGIN_USER` / `LOGIN_PASS` | Primary account credentials |
| `SESSION_SECRET` | Session signing secret |
| `PORT` | HTTP port, default `3050` |
| `STORAGE_DIR` | Filesystem root, default `./storage` |
| `DB_PATH` | SQLite path, default `STORAGE_DIR/.data/index.db` |
| `STORAGE_QUOTA_BYTES` | Total storage quota |
| `MAX_UPLOAD_SIZE_BYTES` | Maximum size of one file |
| `WATCH_POLLING` | Poll the filesystem when native events do not cross a mount |

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

For a faster backend loop, use `npm run test:go`. The integration and network
contract suites can be run independently with `npm run test:go:integration` and
`npm run test:go:contract`; `npm run test:go:all` runs every Go suite.

The backend package boundaries and dependency rules are documented in
[`ARCHITECTURE.md`](ARCHITECTURE.md).

The Go backend listens on port `3050`. The React frontend uses Vite during
development and is embedded from `client/dist` in the production container.

## Backup

Stop OpenDrive before copying `storage/`. Back up the complete directory,
including `.data`, `.trash`, and `.chunks`, then store the archive separately
from the server.
