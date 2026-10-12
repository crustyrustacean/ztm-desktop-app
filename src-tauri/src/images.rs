use std::{
    borrow::Cow,
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};

use sha2::{Digest, Sha256};
use tauri::{
    Manager, UriSchemeResponder,
    http::{Request, Response, StatusCode, header},
};

use crate::academy::{run_blocking, write_atomic};

/// URI scheme the webview uses for course artwork, e.g. `course-image://localhost/<id>`.
pub const SCHEME: &str = "course-image";
const MAX_IMAGE_BYTES: usize = 5 * 1024 * 1024;

/// Remote URLs for the image IDs handed to the webview, so the protocol handler only
/// ever fetches artwork listed in the academy CSV rather than arbitrary URLs.
#[derive(Default)]
pub struct CourseImages {
    urls: Mutex<HashMap<String, String>>,
}

impl CourseImages {
    pub fn remember<'a>(&self, images: impl IntoIterator<Item = (&'a str, &'a str)>) {
        let mut urls = self.urls.lock().unwrap_or_else(|error| error.into_inner());
        urls.extend(
            images
                .into_iter()
                .map(|(id, url)| (id.to_owned(), url.to_owned())),
        );
    }

    fn url(&self, id: &str) -> Option<String> {
        let urls = self.urls.lock().unwrap_or_else(|error| error.into_inner());
        urls.get(id).cloned()
    }
}

/// Stable, filename-safe ID for an image URL. A changed URL yields a new ID, so stale
/// artwork is never served from the cache.
pub fn image_id(url: &str) -> String {
    Sha256::digest(url.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn is_image_id(id: &str) -> bool {
    id.len() == 64
        && id
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

/// Content type from the file signature; anything else (such as an HTML error page) is rejected.
fn image_type(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

pub fn images_dir(academy_cache: &Path) -> PathBuf {
    academy_cache.with_file_name("images")
}

/// Deletes cached artwork no longer referenced by the course list.
pub fn prune(directory: &Path, keep: &HashSet<String>) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        if name.to_str().is_some_and(|name| !keep.contains(name))
            && let Err(error) = fs::remove_file(entry.path())
        {
            eprintln!("Could not remove stale course image: {error}");
        }
    }
}

fn read_cached(path: &Path) -> Option<Vec<u8>> {
    fs::read(path)
        .ok()
        .filter(|bytes| image_type(bytes).is_some())
}

async fn download_image(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("Could not create image HTTP client: {error}"))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| format!("Could not download course image: {error}"))?;

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Could not read course image download: {error}"))?
    {
        if chunk.len() > MAX_IMAGE_BYTES - bytes.len() {
            return Err("Course image exceeds the 5 MiB size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    if image_type(&bytes).is_none() {
        return Err("Course image download is not a supported image.".into());
    }
    Ok(bytes)
}

/// Serves a cached image, downloading and caching it first if needed.
async fn load_image(app: &tauri::AppHandle, id: &str) -> Result<Vec<u8>, StatusCode> {
    if !is_image_id(id) {
        return Err(StatusCode::NOT_FOUND);
    }
    let path = crate::academy::cache_path(app)
        .map(|cache| images_dir(&cache).join(id))
        .map_err(|error| {
            eprintln!("{error}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let cached = {
        let path = path.clone();
        run_blocking(move || read_cached(&path)).await
    };
    if let Ok(Some(bytes)) = cached {
        return Ok(bytes);
    }

    let url = app
        .state::<CourseImages>()
        .url(id)
        .ok_or(StatusCode::NOT_FOUND)?;
    let bytes = download_image(&url).await.map_err(|error| {
        eprintln!("{error}");
        StatusCode::BAD_GATEWAY
    })?;
    // A failed write only means the next request downloads again.
    let to_save = bytes.clone();
    if let Ok(Err(error)) = run_blocking(move || write_atomic(&path, &to_save)).await {
        eprintln!("Could not cache course image: {error}");
    }
    Ok(bytes)
}

fn respond(status: StatusCode, content_type: &str, body: Vec<u8>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        // IDs are derived from the image URL, so a given ID's bytes never change.
        .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
        .body(Cow::Owned(body))
        .unwrap_or_default()
}

pub fn handle_request(
    app: tauri::AppHandle,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let id = request.uri().path().trim_start_matches('/').to_owned();
    tauri::async_runtime::spawn(async move {
        let response = match load_image(&app, &id).await {
            Ok(bytes) => respond(
                StatusCode::OK,
                image_type(&bytes).unwrap_or("application/octet-stream"),
                bytes,
            ),
            Err(status) => Response::builder()
                .status(status)
                .body(Cow::Borrowed(&[][..]))
                .unwrap_or_default(),
        };
        responder.respond(response);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_ids_are_stable_hex_digests() {
        let id = image_id("https://example.com/a.png");
        assert!(is_image_id(&id));
        assert_eq!(id, image_id("https://example.com/a.png"));
        assert_ne!(id, image_id("https://example.com/b.png"));
    }

    #[test]
    fn rejects_ids_that_could_escape_the_cache_folder() {
        for id in [
            "",
            "../academy.csv",
            "ABC",
            &"a".repeat(63),
            &"g".repeat(64),
        ] {
            assert!(!is_image_id(id));
        }
    }

    #[test]
    fn recognises_supported_image_signatures_only() {
        assert_eq!(image_type(b"\x89PNG\r\n\x1a\nrest"), Some("image/png"));
        assert_eq!(image_type(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
        assert_eq!(image_type(b"GIF89a..."), Some("image/gif"));
        assert_eq!(image_type(b"RIFF\0\0\0\0WEBPVP8 "), Some("image/webp"));
        assert_eq!(image_type(b"<!doctype html>"), None);
        assert_eq!(image_type(b""), None);
    }

    #[test]
    fn prune_keeps_only_referenced_images() {
        let directory = tempfile::tempdir().unwrap();
        let keep = image_id("keep");
        fs::write(directory.path().join(&keep), b"x").unwrap();
        fs::write(directory.path().join(image_id("stale")), b"x").unwrap();
        prune(directory.path(), &HashSet::from([keep.clone()]));
        let remaining: Vec<_> = fs::read_dir(directory.path())
            .unwrap()
            .map(|entry| entry.unwrap().file_name().into_string().unwrap())
            .collect();
        assert_eq!(remaining, [keep]);
    }
}
