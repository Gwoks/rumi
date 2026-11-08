//! Cross-cutting `/api` middleware (PRD §5.1, §5.3.3, §5.3.4).
//!
//! `api_guard` runs on every request but acts only under `/api`:
//!   1. a `Content-Length` above 64 KiB → `413 payload_too_large`;
//!   2. `POST|PUT|PATCH|DELETE` with a foreign `Origin` → `403 origin_mismatch`;
//!   3. responses get `Cache-Control: no-store`, and a bare 404/405 produced by
//!      the router itself is rewritten into the JSON envelope.

use axum::extract::{Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_LENGTH, CONTENT_TYPE, HOST, ORIGIN};
use axum::http::{HeaderValue, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use crate::config::Config;
use crate::error::ApiError;
use crate::extract::{client_ip, rate_limit_subject};
use crate::limiter::Limiter;
use crate::state::AppState;

/// Maximum request body (§5.1).
pub const MAX_BODY_BYTES: usize = 64 * 1024;
/// Rate-limit window for the per-minute buckets, in seconds (§5.3.4).
pub const RATE_WINDOW_SECS: i64 = 60;

pub fn is_api_path(path: &str) -> bool {
    path == "/api" || path.starts_with("/api/")
}

fn is_mutating(method: &Method) -> bool {
    matches!(
        *method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    )
}

/// `host[:port]` of an origin or URL, lowercased; the scheme is ignored.
fn authority(url: &str) -> Option<String> {
    let rest = url.split_once("://").map(|(_, r)| r).unwrap_or(url);
    let host = rest.split(['/', '?', '#']).next().unwrap_or("").trim();
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

/// §5.3.3: an `Origin` must match the request `Host` or the `PUBLIC_BASE_URL` host.
pub fn origin_allowed(origin: &str, host: Option<&str>, public_base_url: &str) -> bool {
    let Some(origin_host) = authority(origin) else {
        return false;
    };
    let matches_host = host
        .map(|h| h.trim().eq_ignore_ascii_case(&origin_host))
        .unwrap_or(false);
    let matches_base = authority(public_base_url)
        .map(|base| base == origin_host)
        .unwrap_or(false);
    matches_host || matches_base
}

fn check_request(cfg: &Config, req: &Request) -> Result<(), ApiError> {
    let too_large = req
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<u64>().ok())
        .map(|len| len > MAX_BODY_BYTES as u64)
        .unwrap_or(false);
    if too_large {
        return Err(ApiError::payload_too_large());
    }
    if !is_mutating(req.method()) {
        return Ok(());
    }
    let Some(origin) = req.headers().get(ORIGIN) else {
        return Ok(());
    };
    let host = req.headers().get(HOST).and_then(|v| v.to_str().ok());
    let allowed = origin
        .to_str()
        .map(|o| origin_allowed(o, host, &cfg.public_base_url))
        .unwrap_or(false);
    if allowed {
        Ok(())
    } else {
        Err(ApiError::origin_mismatch())
    }
}

fn is_json(resp: &Response) -> bool {
    resp.headers()
        .get(CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|ct| ct.starts_with("application/json"))
        .unwrap_or(false)
}

/// Rewrite router-generated (non-JSON) 404/405 responses into the envelope.
fn envelope_fallthrough(resp: Response) -> Response {
    if is_json(&resp) {
        return resp;
    }
    let replacement = match resp.status() {
        StatusCode::NOT_FOUND => ApiError::not_found(),
        StatusCode::METHOD_NOT_ALLOWED => ApiError::method_not_allowed(),
        _ => return resp,
    };
    let allow = resp.headers().get(axum::http::header::ALLOW).cloned();
    let mut out = replacement.into_response();
    if let Some(allow) = allow {
        out.headers_mut().insert(axum::http::header::ALLOW, allow);
    }
    out
}

fn no_store(mut resp: Response) -> Response {
    resp.headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    resp
}

pub async fn api_guard(State(state): State<AppState>, req: Request, next: Next) -> Response {
    if !is_api_path(req.uri().path()) {
        return next.run(req).await;
    }
    if let Err(e) = check_request(&state.cfg, &req) {
        return no_store(e.into_response());
    }
    let resp = next.run(req).await;
    no_store(envelope_fallthrough(resp))
}

/// Take one token from `key`'s bucket, or answer `429 rate_limited` with
/// `Retry-After` when it is empty (§5.3.4).
pub fn take_token(
    limiter: &Limiter,
    key: &str,
    limit: i64,
    window_secs: i64,
) -> Result<(), ApiError> {
    let result = limiter.check(key, limit, window_secs);
    if result.allowed {
        Ok(())
    } else {
        Err(ApiError::rate_limited(result.retry_after))
    }
}

/// Per-(endpoint, client subject) token bucket for the auth endpoints
/// (§5.3.4). IPv6 clients share one bucket per /64. Runs before body
/// extraction, so every request takes a token.
pub async fn auth_rate_limit(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let subject = rate_limit_subject(&client_ip(req.extensions(), req.headers()));
    let key = format!("auth:{}:{subject}", req.uri().path());
    let limit = state.cfg.auth_rate_limit_per_min;
    match take_token(&state.limiter, &key, limit, RATE_WINDOW_SECS) {
        Ok(()) => next.run(req).await,
        Err(e) => e.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_matching_ignores_scheme_and_case() {
        assert!(origin_allowed(
            "http://localhost:5173",
            Some("localhost:5173"),
            ""
        ));
        assert!(origin_allowed("https://RUMI.id", Some("rumi.id"), ""));
        assert!(!origin_allowed(
            "http://localhost:5173",
            Some("localhost:8080"),
            ""
        ));
        assert!(origin_allowed(
            "https://rumi-stg.kasibah.com",
            Some("127.0.0.1:8080"),
            "https://rumi-stg.kasibah.com"
        ));
        assert!(!origin_allowed(
            "https://evil.example",
            Some("rumi.id"),
            "https://rumi.id"
        ));
        assert!(!origin_allowed("null", None, ""));
        assert!(!origin_allowed("", Some("rumi.id"), ""));
    }

    #[test]
    fn api_paths() {
        assert!(is_api_path("/api"));
        assert!(is_api_path("/api/health"));
        assert!(!is_api_path("/apiary"));
        assert!(!is_api_path("/"));
    }

    #[test]
    fn authority_strips_paths() {
        assert_eq!(
            authority("https://a.b:8443/x?y").as_deref(),
            Some("a.b:8443")
        );
        assert_eq!(authority("a.b").as_deref(), Some("a.b"));
        assert_eq!(authority("https://"), None);
    }
}
