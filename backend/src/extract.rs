//! Request extractors that reject with the API envelope (PRD §5.1, §5.4.8).

use std::collections::HashMap;
use std::net::SocketAddr;

use axum::extract::rejection::JsonRejection;
use axum::extract::{ConnectInfo, FromRequest, FromRequestParts, Path, Query, Request};
use axum::http::request::Parts;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use chrono::NaiveDate;
use serde::de::DeserializeOwned;

use crate::error::ApiError;
use crate::helpers::parse_date;
use crate::validate::Errors;

/// `Json<T>` whose rejection is the envelope: malformed JSON or a missing
/// `Content-Type: application/json` → `400 bad_request`, an oversized body →
/// `413 payload_too_large`, a type mismatch → `422 validation_error`.
pub struct ApiJson<T>(pub T);

impl<S, T> FromRequest<S> for ApiJson<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(req, state)
            .await
            .map(|Json(v)| ApiJson(v))
            .map_err(map_json_rejection)
    }
}

fn map_json_rejection(rejection: JsonRejection) -> ApiError {
    match rejection {
        JsonRejection::JsonDataError(_) => {
            ApiError::validation("Data tidak valid. Periksa kembali isian Anda.")
        }
        other if other.status() == StatusCode::PAYLOAD_TOO_LARGE => ApiError::payload_too_large(),
        _ => ApiError::bad_request(),
    }
}

/// A positive base-10 integer path id; anything else is `404 not_found`.
pub struct IdPath(pub i64);

/// Parse a path id (§5.4.8): ASCII digits only, value ≥ 1.
pub fn parse_id(raw: &str) -> Option<i64> {
    if raw.is_empty() || !raw.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    raw.parse::<i64>().ok().filter(|id| *id >= 1)
}

impl<S: Send + Sync> FromRequestParts<S> for IdPath {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let Path(raw) = Path::<String>::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::not_found())?;
        parse_id(&raw).map(IdPath).ok_or_else(ApiError::not_found)
    }
}

/// A single string path segment (e.g. a CMS page slug); bad encoding → 404.
pub struct SlugPath(pub String);

impl<S: Send + Sync> FromRequestParts<S> for SlugPath {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<String>::from_request_parts(parts, state)
            .await
            .map(|Path(s)| SlugPath(s))
            .map_err(|_| ApiError::not_found())
    }
}

/// Default and maximum page sizes (§5.4.10).
pub const DEFAULT_PER_PAGE: i64 = 20;
pub const MAX_PER_PAGE: i64 = 100;
/// Maximum length of the search parameter `q` (§5.4.11).
pub const MAX_Q_LEN: usize = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Page {
    pub page: i64,
    pub per_page: i64,
}

impl Page {
    pub fn offset(&self) -> i64 {
        (self.page - 1) * self.per_page
    }
}

/// Query-string parameters (last value wins). Rule violations are recorded in
/// an [`Errors`] under the parameter name (`fields.<param>`).
pub struct QueryParams(pub HashMap<String, String>);

impl<S: Send + Sync> FromRequestParts<S> for QueryParams {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        Query::<HashMap<String, String>>::try_from_uri(&parts.uri)
            .map(|Query(map)| QueryParams(map))
            .map_err(|_| ApiError::bad_request())
    }
}

impl QueryParams {
    /// The trimmed value, or `None` when absent or blank.
    pub fn text(&self, key: &str) -> Option<String> {
        self.0
            .get(key)
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
    }

    pub fn text_max(&self, key: &str, max: usize, errs: &Errors) -> Option<String> {
        let value = self.text(key)?;
        if value.chars().count() > max {
            errs.add(key, format!("Maksimal {max} karakter."));
            return None;
        }
        Some(value)
    }

    pub fn int(&self, key: &str, min: i64, max: i64, errs: &Errors) -> Option<i64> {
        let raw = self.text(key)?;
        match raw.parse::<i64>() {
            Ok(n) if (min..=max).contains(&n) => Some(n),
            _ => {
                errs.add(key, format!("Harus bilangan bulat antara {min} dan {max}."));
                None
            }
        }
    }

    pub fn date(&self, key: &str, errs: &Errors) -> Option<NaiveDate> {
        let raw = self.text(key)?;
        let parsed = parse_date(&raw);
        if parsed.is_none() {
            errs.add(key, "Format tanggal harus YYYY-MM-DD.");
        }
        parsed
    }

    pub fn one_of(
        &self,
        key: &str,
        allowed: &[&'static str],
        errs: &Errors,
    ) -> Option<&'static str> {
        let raw = self.text(key)?;
        let found = allowed.iter().copied().find(|a| *a == raw);
        if found.is_none() {
            errs.add(key, "Nilai tidak dikenal.");
        }
        found
    }

    /// `q` (§5.4.11): trimmed, ≤ 100 chars; empty means no filter.
    pub fn search(&self, errs: &Errors) -> Option<String> {
        self.text_max("q", MAX_Q_LEN, errs)
    }

    /// `page` / `per_page` (§5.4.10).
    pub fn page(&self, errs: &Errors) -> Page {
        Page {
            page: self.int("page", 1, i64::from(i32::MAX), errs).unwrap_or(1),
            per_page: self
                .int("per_page", 1, MAX_PER_PAGE, errs)
                .unwrap_or(DEFAULT_PER_PAGE),
        }
    }
}

/// The client IP (§5.3.4, hookbox `effective_client_ip`): the TCP peer, except
/// that `X-Real-IP` / the first `X-Forwarded-For` hop are trusted when the peer
/// is loopback (nginx on the same host).
pub fn effective_client_ip(peer: Option<SocketAddr>, headers: &HeaderMap) -> String {
    let peer_ip = peer.map(|addr| addr.ip());
    if peer_ip.map(|ip| ip.is_loopback()).unwrap_or(false) {
        let header = |name: &str| {
            headers
                .get(name)
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.split(',').next())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        };
        if let Some(ip) = header("x-real-ip").or_else(|| header("x-forwarded-for")) {
            return ip;
        }
    }
    peer_ip
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// The client IP of a request, read from its `ConnectInfo` extension.
pub fn client_ip(extensions: &axum::http::Extensions, headers: &HeaderMap) -> String {
    let peer = extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| *addr);
    effective_client_ip(peer, headers)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::HeaderValue;

    fn addr(ip: &str) -> Option<SocketAddr> {
        Some(SocketAddr::new(ip.parse().unwrap(), 1234))
    }

    #[test]
    fn path_ids_must_be_positive_integers() {
        assert_eq!(parse_id("42"), Some(42));
        assert_eq!(parse_id("007"), Some(7));
        for bad in ["0", "-1", "+1", "1.5", "abc", "", "99999999999999999999"] {
            assert_eq!(parse_id(bad), None, "{bad}");
        }
    }

    #[test]
    fn client_ip_trusts_proxy_headers_only_from_loopback() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.7, 10.0.0.1"),
        );
        assert_eq!(
            effective_client_ip(addr("127.0.0.1"), &headers),
            "203.0.113.7"
        );
        assert_eq!(
            effective_client_ip(addr("198.51.100.9"), &headers),
            "198.51.100.9"
        );
        headers.insert("x-real-ip", HeaderValue::from_static("192.0.2.1"));
        assert_eq!(effective_client_ip(addr("::1"), &headers), "192.0.2.1");
        assert_eq!(
            effective_client_ip(addr("127.0.0.1"), &HeaderMap::new()),
            "127.0.0.1"
        );
        assert_eq!(effective_client_ip(None, &HeaderMap::new()), "unknown");
        assert_eq!(
            client_ip(&axum::http::Extensions::new(), &HeaderMap::new()),
            "unknown"
        );
    }

    fn params(pairs: &[(&str, &str)]) -> QueryParams {
        QueryParams(
            pairs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        )
    }

    #[test]
    fn query_params_validate_and_record_errors() {
        let errs = Errors::new();
        let q = params(&[
            ("age", "4"),
            ("from", "2026-11-01"),
            ("q", "  "),
            ("status", "PAID"),
        ]);
        assert_eq!(q.int("age", 0, 12, &errs), Some(4));
        assert!(q.date("from", &errs).is_some());
        assert_eq!(q.search(&errs), None);
        assert_eq!(q.one_of("status", &["PAID"], &errs), Some("PAID"));
        assert_eq!(
            q.page(&errs),
            Page {
                page: 1,
                per_page: 20
            }
        );
        assert!(errs.is_empty());

        let bad = params(&[
            ("age", "x"),
            ("from", "2026-13-01"),
            ("page", "0"),
            ("per_page", "101"),
            ("status", "NOPE"),
        ]);
        assert_eq!(bad.int("age", 0, 12, &errs), None);
        assert_eq!(bad.date("from", &errs), None);
        bad.page(&errs);
        bad.one_of("status", &["PAID"], &errs);
        let fields = errs.finish().unwrap_err().fields.unwrap();
        for key in ["age", "from", "page", "per_page", "status"] {
            assert!(fields.contains_key(key), "{key}");
        }
        let long = params(&[("q", &"x".repeat(101))]);
        let errs2 = Errors::new();
        assert_eq!(long.search(&errs2), None);
        assert!(!errs2.is_empty());
        assert_eq!(
            Page {
                page: 3,
                per_page: 20
            }
            .offset(),
            40
        );
    }

    #[tokio::test]
    async fn api_json_rejections_map_to_envelope_codes() {
        let req = |ct: Option<&str>, body: &str| {
            let b = Request::builder().method("POST").uri("/x");
            let b = match ct {
                Some(ct) => b.header("content-type", ct),
                None => b,
            };
            b.body(Body::from(body.to_string())).unwrap()
        };
        let missing_ct = ApiJson::<serde_json::Value>::from_request(req(None, "{}"), &()).await;
        assert_eq!(missing_ct.err().unwrap().code, "bad_request");
        let bad_json =
            ApiJson::<serde_json::Value>::from_request(req(Some("application/json"), "{"), &())
                .await;
        assert_eq!(bad_json.err().unwrap().code, "bad_request");
        let wrong_type =
            ApiJson::<Vec<i64>>::from_request(req(Some("application/json"), "{}"), &()).await;
        assert_eq!(wrong_type.err().unwrap().code, "validation_error");
        let good = ApiJson::<serde_json::Value>::from_request(
            req(Some("application/json"), "{\"a\":1}"),
            &(),
        )
        .await;
        assert!(good.is_ok());
    }
}
