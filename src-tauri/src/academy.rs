use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use reqwest::{StatusCode, header};
use serde::{Deserialize, Serialize};
use tauri::Manager;

const ACADEMY_URL: &str =
    "https://raw.githubusercontent.com/markodowd/zero-to-mastery-links/main/academy.csv";
const MAX_CSV_BYTES: usize = 2 * 1024 * 1024;

const WEEK_SECS: u64 = 7 * 24 * 60 * 60;
// Upstream updates Mondays at 06:00 UTC; checking from 07:00 gives it an hour to land.
// 1970-01-05 07:00 UTC was a Monday, so every weekly boundary is this plus whole weeks.
const FIRST_MONDAY_SYNC_SECS: u64 = (4 * 24 + 7) * 60 * 60;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Course {
    uuid: String,
    name: String,
}

fn parse_courses(bytes: &[u8]) -> Result<Vec<Course>, String> {
    if bytes.len() > MAX_CSV_BYTES {
        return Err("Academy CSV exceeds the 2 MiB size limit.".into());
    }

    // Flexible parsing tolerates upstream adding columns; only `uuid` and `course_name` are required.
    let mut reader = csv::ReaderBuilder::new().flexible(true).from_reader(bytes);
    let headers = reader
        .headers()
        .map_err(|error| format!("Could not read academy CSV headers: {error}"))?;
    let column = |name: &str| headers.iter().position(|header| header.trim() == name);
    let uuid_column = column("uuid").ok_or("Academy CSV must have a uuid column.")?;
    let course_column =
        column("course_name").ok_or("Academy CSV must have a course_name column.")?;

    let mut courses = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|error| format!("Invalid academy CSV row: {error}"))?;
        let uuid = record.get(uuid_column).unwrap_or_default().trim();
        if uuid.is_empty() {
            return Err("Academy CSV contains an empty course uuid.".into());
        }
        let name = record.get(course_column).unwrap_or_default().trim();
        if name.is_empty() {
            return Err("Academy CSV contains an empty course name.".into());
        }
        courses.push(Course {
            uuid: uuid.to_owned(),
            name: name.to_owned(),
        });
    }

    if courses.is_empty() {
        return Err("Academy CSV contains no courses.".into());
    }
    Ok(courses)
}

fn cache_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join("data").join("academy.csv"))
        .map_err(|error| format!("Could not locate the academy data folder: {error}"))
}

fn sync_state_path(cache_path: &Path) -> PathBuf {
    cache_path.with_file_name("academy-sync.json")
}

fn read_cache(path: &Path) -> Result<Option<Vec<Course>>, String> {
    match fs::read(path) {
        Ok(bytes) => parse_courses(&bytes).map(Some),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read cached academy CSV: {error}")),
    }
}

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let directory = path.parent().ok_or("Data path has no parent directory.")?;
    fs::create_dir_all(directory)
        .map_err(|error| format!("Could not create data folder: {error}"))?;
    // A same-directory temporary file keeps the previous file intact until replacement.
    let mut file = tempfile::NamedTempFile::new_in(directory)
        .map_err(|error| format!("Could not create data file: {error}"))?;
    file.write_all(bytes)
        .and_then(|_| file.as_file().sync_all())
        .map_err(|error| format!("Could not write data: {error}"))?;
    file.persist(path)
        .map_err(|error| format!("Could not replace data: {error}"))?;
    Ok(())
}

fn save_cache(path: &Path, bytes: &[u8]) -> Result<Vec<Course>, String> {
    let courses = parse_courses(bytes)?;
    write_atomic(path, bytes)?;
    Ok(courses)
}

/// When the last successful check happened and the ETag of the cached CSV.
#[derive(Debug, Default, PartialEq, Serialize, Deserialize)]
struct SyncState {
    checked_at: u64,
    etag: Option<String>,
}

fn read_sync_state(path: &Path) -> SyncState {
    // A missing or unreadable state only means the next check runs immediately.
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save_sync_state(path: &Path, state: &SyncState) {
    let result = serde_json::to_vec(state)
        .map_err(|error| error.to_string())
        .and_then(|bytes| write_atomic(path, &bytes));
    if let Err(error) = result {
        eprintln!("Could not save academy sync state: {error}");
    }
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

/// Unix time of the most recent Monday 07:00 UTC at or before `now`.
fn latest_sync_boundary(now: u64) -> u64 {
    now - now.saturating_sub(FIRST_MONDAY_SYNC_SECS) % WEEK_SECS
}

fn is_sync_due(checked_at: u64, now: u64) -> bool {
    checked_at < latest_sync_boundary(now)
}

enum Download {
    NotModified,
    Modified {
        bytes: Vec<u8>,
        etag: Option<String>,
    },
}

async fn download_csv(etag: Option<&str>) -> Result<Download, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("Could not create academy HTTP client: {error}"))?;
    let mut request = client.get(ACADEMY_URL);
    if let Some(etag) = etag {
        request = request.header(header::IF_NONE_MATCH, etag);
    }
    let mut response = request
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| format!("Could not download academy CSV: {error}"))?;
    if response.status() == StatusCode::NOT_MODIFIED {
        return Ok(Download::NotModified);
    }
    let etag = response
        .headers()
        .get(header::ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Could not read academy download: {error}"))?
    {
        if chunk.len() > MAX_CSV_BYTES - bytes.len() {
            return Err("Academy CSV exceeds the 2 MiB size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(Download::Modified { bytes, etag })
}

/// Stores a download and returns the new course list, or `None` when nothing changed.
fn apply_download(
    cache_path: &Path,
    download: Download,
    previous_etag: Option<String>,
    now: u64,
) -> Result<Option<Vec<Course>>, String> {
    let (courses, etag) = match download {
        Download::NotModified => (None, previous_etag),
        Download::Modified { bytes, etag } => {
            let unchanged = fs::read(cache_path).is_ok_and(|cached| cached == bytes);
            let courses = if unchanged {
                None
            } else {
                Some(save_cache(cache_path, &bytes)?)
            };
            (courses, etag)
        }
    };
    save_sync_state(
        &sync_state_path(cache_path),
        &SyncState {
            checked_at: now,
            etag,
        },
    );
    Ok(courses)
}

async fn run_blocking<T: Send + 'static>(
    task: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| format!("Academy cache task failed: {error}"))
}

#[tauri::command]
pub async fn load_courses(app: tauri::AppHandle) -> Result<Option<Vec<Course>>, String> {
    let path = cache_path(&app)?;
    run_blocking(move || read_cache(&path)).await?
}

/// Checks upstream for course changes on first run, then once per weekly boundary
/// (Monday 07:00 UTC) unless `force` is set. Returns `None` when the cache is unchanged.
#[tauri::command]
pub async fn sync_courses(
    app: tauri::AppHandle,
    force: bool,
) -> Result<Option<Vec<Course>>, String> {
    let path = cache_path(&app)?;
    let (state, has_valid_cache) = {
        let path = path.clone();
        run_blocking(move || {
            let state = read_sync_state(&sync_state_path(&path));
            (state, matches!(read_cache(&path), Ok(Some(_))))
        })
        .await?
    };
    let now = unix_now();
    if has_valid_cache && !force && !is_sync_due(state.checked_at, now) {
        return Ok(None);
    }

    // Without a valid cache, a 304 would leave nothing to show, so always fetch the body.
    let etag = state.etag.filter(|_| has_valid_cache);
    let download = download_csv(etag.as_deref()).await?;
    run_blocking(move || apply_download(&path, download, etag, now)).await?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn courses(entries: &[(&str, &str)]) -> Vec<Course> {
        entries
            .iter()
            .map(|(uuid, name)| Course {
                uuid: (*uuid).into(),
                name: (*name).into(),
            })
            .collect()
    }

    #[test]
    fn parses_uuids_and_names_in_source_order() {
        let bytes = b"uuid,course_name,url\r\n a1 ,Rust,https://example.com\r\nb2,\"React, Redux\", \r\nc3, Python ,\r\n";
        assert_eq!(
            parse_courses(bytes).unwrap(),
            courses(&[("a1", "Rust"), ("b2", "React, Redux"), ("c3", "Python")])
        );
    }

    #[test]
    fn supports_escaped_quotes_and_multiline_names() {
        let bytes = b"uuid,course_name,url\na1,\"Learn \"\"Rust\"\"\",\nb2,\"Web\nDevelopment\",\n";
        assert_eq!(
            parse_courses(bytes).unwrap(),
            courses(&[("a1", "Learn \"Rust\""), ("b2", "Web\nDevelopment")])
        );
    }

    #[test]
    fn rejects_invalid_headers_rows_and_empty_lists() {
        for bytes in [
            &b"uuid,name,url\na1,Rust,\n"[..],
            &b"uuid,course,url\na1,Rust,\n"[..],
            &b"course_name,url\nRust,\n"[..],
            &b"uuid,course_name,url\n"[..],
            &b"uuid,course_name,url\na1, ,\n"[..],
            &b"uuid,course_name,url\n ,Rust,\n"[..],
            &b"uuid,url,course_name\na1,https://example.com\n"[..],
            &b"<!doctype html><html>error</html>"[..],
            &b"uuid,course_name,url\na1,\xff,\n"[..],
        ] {
            assert!(parse_courses(bytes).is_err());
        }
    }

    #[test]
    fn finds_course_column_by_name_and_ignores_extra_columns() {
        let bytes =
            b"url,course_name,category,uuid\nhttps://example.com,Rust,Systems,a1\n,Python,,b2\n";
        assert_eq!(
            parse_courses(bytes).unwrap(),
            courses(&[("a1", "Rust"), ("b2", "Python")])
        );
    }

    #[test]
    fn rejects_oversized_csv() {
        assert!(parse_courses(&vec![b'x'; MAX_CSV_BYTES + 1]).is_err());
    }

    #[test]
    fn missing_cache_is_distinct_from_invalid_cache() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("academy.csv");
        assert_eq!(read_cache(&path).unwrap(), None);
        fs::write(&path, b"invalid").unwrap();
        assert!(read_cache(&path).is_err());
    }

    #[test]
    fn persists_and_replaces_cache_without_leaving_temporary_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data").join("academy.csv");
        save_cache(&path, b"uuid,course_name\na1,Rust\n").unwrap();
        save_cache(&path, b"uuid,course_name\nb2,Python\n").unwrap();
        assert_eq!(
            read_cache(&path).unwrap(),
            Some(courses(&[("b2", "Python")]))
        );
        assert_eq!(fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
    }

    #[test]
    fn invalid_download_preserves_previous_cache() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("academy.csv");
        let valid = b"uuid,course_name\na1,Rust\n";
        save_cache(&path, valid).unwrap();
        assert!(save_cache(&path, b"uuid,course_name\n").is_err());
        assert_eq!(fs::read(&path).unwrap(), valid);
    }

    // 2026-10-12 07:00 UTC, a Monday.
    const MONDAY_0700: u64 = 1_791_788_400;

    #[test]
    fn sync_boundary_is_most_recent_monday_0700_utc() {
        assert_eq!(latest_sync_boundary(MONDAY_0700), MONDAY_0700);
        assert_eq!(latest_sync_boundary(MONDAY_0700 + 3 * 86_400), MONDAY_0700);
        assert_eq!(
            latest_sync_boundary(MONDAY_0700 - 1),
            MONDAY_0700 - WEEK_SECS
        );
    }

    #[test]
    fn sync_is_due_once_per_week_after_monday_0700_utc() {
        // Checked Sunday: due from Monday 07:00, not before.
        let sunday = MONDAY_0700 - 86_400;
        assert!(!is_sync_due(sunday, MONDAY_0700 - 1));
        assert!(is_sync_due(sunday, MONDAY_0700));
        // Checked Monday 07:30: not due again until the following Monday.
        let checked = MONDAY_0700 + 1_800;
        assert!(!is_sync_due(checked, MONDAY_0700 + WEEK_SECS - 1));
        assert!(is_sync_due(checked, MONDAY_0700 + WEEK_SECS));
        // Never checked.
        assert!(is_sync_due(0, MONDAY_0700));
    }

    #[test]
    fn unchanged_downloads_keep_cache_and_record_check() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("academy.csv");
        let bytes = b"uuid,course_name\na1,Rust\n".to_vec();
        let etag = |tag: &str| Some(format!("\"{tag}\""));

        let first = Download::Modified {
            bytes: bytes.clone(),
            etag: etag("a"),
        };
        assert_eq!(
            apply_download(&path, first, None, 1).unwrap(),
            Some(courses(&[("a1", "Rust")]))
        );

        let same = Download::Modified {
            bytes,
            etag: etag("b"),
        };
        assert_eq!(apply_download(&path, same, None, 2).unwrap(), None);

        assert_eq!(
            apply_download(&path, Download::NotModified, etag("b"), 3).unwrap(),
            None
        );
        assert_eq!(
            read_sync_state(&sync_state_path(&path)),
            SyncState {
                checked_at: 3,
                etag: etag("b")
            }
        );
    }

    #[test]
    #[ignore = "requires access to the upstream GitHub CSV"]
    fn downloads_upstream_and_round_trips_local_cache() {
        let Download::Modified { bytes, etag } =
            tauri::async_runtime::block_on(download_csv(None)).unwrap()
        else {
            panic!("unconditional request returned 304");
        };
        let etag = etag.expect("GitHub raw responses include an ETag");
        assert!(matches!(
            tauri::async_runtime::block_on(download_csv(Some(&etag))).unwrap(),
            Download::NotModified
        ));
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data").join("academy.csv");
        let courses = save_cache(&path, &bytes).unwrap();
        assert!(!courses.is_empty());
        assert_eq!(fs::read(&path).unwrap(), bytes);
        assert_eq!(read_cache(&path).unwrap(), Some(courses));
    }
}
