# Rust backend

The academy module loads course names from the `course` column in the upstream
[academy CSV](https://github.com/ztm-desktop-application/zero-to-mastery-links/blob/main/academy.csv)
and exposes them to the dashboard through Tauri commands. It keeps a local CSV
cache so saved courses can be shown while the app checks for updates.

The backend checks weekly, uses the upstream ETag to avoid downloading unchanged
data, and replaces the cache only after validating the downloaded CSV. The
`load_courses` and `sync_courses` commands are implemented in `src/academy.rs`.

## Commands

- `load_courses` returns the cached course names, or `null` when there is no
  cache yet.
- `sync_courses({ force })` checks upstream when a check is due (or when `force`
  is `true`) and returns the new course names, or `null` when nothing changed.

Neither command exposes course URLs.

## Parsing

`reqwest` downloads the CSV and the `csv` crate reads the `course_name` column by name,
including quoted names containing commas; other columns are ignored. A CSV with
no `course_name` column, an empty course name, or no courses is rejected.

## Local cache

The cache is stored at `data/academy.csv` inside Tauri's per-user local
application-data directory. On Windows this is typically
`%LOCALAPPDATA%\com.mark.ztm-desktop-app\data\academy.csv`. It is not written into
the Git checkout or installation folder, which may be read-only in a packaged
app.

Downloads have a 30-second timeout and a 2 MiB size limit. Only a valid,
nonempty CSV replaces the cache, using an atomic file replacement, so a failed or
invalid download leaves the previous cache intact.

## Sync schedule

The upstream CSV updates every Monday at 06:00 UTC, so the app does not download
it on every launch. It downloads on first run (or whenever there is no valid
cache), then checks again only once a week, on the first check after Monday
07:00 UTC. Each check sends the previous `ETag` as `If-None-Match`, so an
unchanged file costs a `304` with no body, and identical content never rewrites
the cache.

The last check time and `ETag` are stored next to the cache in
`data/academy-sync.json`; deleting it makes the next launch check immediately. A
failed check is not recorded, so the next launch tries again.

## Tests

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

To also verify a live download, a conditional `304` request, and a local-cache
round trip, run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored
```
