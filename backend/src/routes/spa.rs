//! SPA static serving with an `index.html` fallback (hookbox `routes/spa.rs`,
//! PRD §5.12). `/assets/*` (hashed Vite output) is cached immutably; everything
//! else revalidates. Unknown `/api/*` never reaches here (see `router.rs`).

use std::path::{Component, Path};

use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderValue, Method, Request, StatusCode};
use axum::response::Response;

use crate::state::AppState;

const IMMUTABLE: &str = "public, max-age=31536000, immutable";
const NO_CACHE: &str = "no-cache";

fn content_type_for(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" | "map" => "application/json",
        "webmanifest" => "application/manifest+json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

/// A request path is safe when it has no `..`, root or prefix components.
fn is_safe(rel: &str) -> bool {
    !rel.contains('\0')
        && !rel.contains('\\')
        && Path::new(rel)
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir))
}

fn file_response(path: &str, bytes: Vec<u8>, cache: &'static str) -> Response {
    let mut resp = Response::new(Body::from(bytes));
    let headers = resp.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(content_type_for(path)),
    );
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    resp
}

fn plain(status: StatusCode, text: &'static str) -> Response {
    let mut resp = Response::new(Body::from(text));
    *resp.status_mut() = status;
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    resp
}

/// Serve `STATIC_DIR/<path>` if it is a file, else `STATIC_DIR/index.html`.
pub async fn serve_spa(State(state): State<AppState>, req: Request<Body>) -> Response {
    if req.method() != Method::GET && req.method() != Method::HEAD {
        return plain(StatusCode::NOT_FOUND, "Not Found");
    }
    let rel = req.uri().path().trim_start_matches('/');
    if !is_safe(rel) {
        return plain(StatusCode::NOT_FOUND, "Not Found");
    }
    let dir = Path::new(&state.cfg.static_dir);
    if !rel.is_empty() {
        let candidate = dir.join(rel);
        if tokio::fs::metadata(&candidate)
            .await
            .map(|m| m.is_file())
            .unwrap_or(false)
        {
            if let Ok(bytes) = tokio::fs::read(&candidate).await {
                let cache = if rel.starts_with("assets/") {
                    IMMUTABLE
                } else {
                    NO_CACHE
                };
                return file_response(rel, bytes, cache);
            }
        }
    }
    match tokio::fs::read(dir.join("index.html")).await {
        Ok(bytes) => file_response("index.html", bytes, NO_CACHE),
        Err(_) => plain(StatusCode::NOT_FOUND, "Not Found"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn traversal_is_rejected() {
        assert!(is_safe("assets/app.js"));
        assert!(is_safe(""));
        assert!(!is_safe("../etc/passwd"));
        assert!(!is_safe("assets/../../x"));
        assert!(!is_safe("a\\..\\b"));
    }

    #[test]
    fn content_types() {
        assert_eq!(content_type_for("a.js"), "text/javascript; charset=utf-8");
        assert_eq!(content_type_for("a.woff2"), "font/woff2");
        assert_eq!(content_type_for("noext"), "application/octet-stream");
    }
}
