//! The response envelope (PRD §5.1, §5.2).
//!
//! * success: `{ "success": true, "data": T, "error": null }` via [`ok`] / [`created`]
//! * error:   `{ "success": false, "data": null, "error": "<pesan>", "code": "<code>" }`
//!   (+ optional `fields` on `validation_error`) via [`ApiError`]'s `IntoResponse`.
//!
//! sqlx failures are logged server-side and surface only as the generic
//! `internal` / `unavailable` messages, so no SQL or path ever leaks.

use std::collections::BTreeMap;

use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::{json, Value};

pub type ApiResult = Result<Response, ApiError>;

#[derive(Debug, Clone)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
    pub fields: Option<BTreeMap<String, String>>,
    pub headers: Vec<(HeaderName, HeaderValue)>,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        ApiError {
            status,
            code,
            message: message.into(),
            fields: None,
            headers: Vec::new(),
        }
    }

    /// Attach a response header (silently skipped if the value is not a valid header).
    pub fn with_header(self, name: &'static str, value: &str) -> Self {
        match HeaderValue::from_str(value) {
            Ok(v) => {
                let headers = self
                    .headers
                    .into_iter()
                    .chain(std::iter::once((HeaderName::from_static(name), v)))
                    .collect();
                ApiError { headers, ..self }
            }
            Err(_) => self,
        }
    }

    pub fn bad_request() -> Self {
        Self::new(
            StatusCode::BAD_REQUEST,
            "bad_request",
            "Format permintaan tidak valid.",
        )
    }

    pub fn unauthorized() -> Self {
        Self::new(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "Silakan masuk terlebih dahulu.",
        )
    }

    pub fn invalid_credentials() -> Self {
        Self::new(
            StatusCode::UNAUTHORIZED,
            "invalid_credentials",
            "Email atau kata sandi salah.",
        )
    }

    pub fn forbidden() -> Self {
        Self::new(
            StatusCode::FORBIDDEN,
            "forbidden",
            "Anda tidak memiliki akses.",
        )
    }

    pub fn origin_mismatch() -> Self {
        Self::new(
            StatusCode::FORBIDDEN,
            "origin_mismatch",
            "Permintaan ditolak.",
        )
    }

    pub fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", "Data tidak ditemukan.")
    }

    pub fn not_found_msg(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", message)
    }

    pub fn method_not_allowed() -> Self {
        Self::new(
            StatusCode::METHOD_NOT_ALLOWED,
            "method_not_allowed",
            "Metode tidak diizinkan.",
        )
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, "conflict", message)
    }

    pub fn email_taken() -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "email_taken",
            "Email sudah terdaftar. Silakan masuk.",
        )
    }

    pub fn item_unavailable(name: &str) -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "item_unavailable",
            format!("{name} sudah tidak tersedia."),
        )
    }

    pub fn already_enrolled(child: &str, class_title: &str) -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "already_enrolled",
            format!("{child} sudah terdaftar di kelas {class_title}."),
        )
    }

    pub fn class_full(class_title: &str) -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "class_full",
            format!("Kelas {class_title} sudah penuh."),
        )
    }

    pub fn out_of_stock(name: &str, left: i64) -> Self {
        Self::new(
            StatusCode::CONFLICT,
            "out_of_stock",
            format!("Stok {name} tidak mencukupi (tersisa {left})."),
        )
    }

    pub fn invalid_transition(from: &str, to: &str) -> Self {
        Self::invalid_transition_msg(format!("Status tidak dapat diubah dari {from} ke {to}."))
    }

    pub fn invalid_transition_msg(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, "invalid_transition", message)
    }

    pub fn payload_too_large() -> Self {
        Self::new(
            StatusCode::PAYLOAD_TOO_LARGE,
            "payload_too_large",
            "Ukuran permintaan terlalu besar.",
        )
    }

    pub fn validation(message: impl Into<String>) -> Self {
        Self::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "validation_error",
            message,
        )
    }

    /// `422 validation_error` with a `fields` map of dotted request paths.
    pub fn validation_fields(fields: BTreeMap<String, String>) -> Self {
        ApiError {
            fields: Some(fields),
            ..Self::validation("Data tidak valid. Periksa kembali isian Anda.")
        }
    }

    /// `422` for a single field.
    pub fn field(path: &str, message: &str) -> Self {
        Self::validation_fields(BTreeMap::from([(path.to_string(), message.to_string())]))
    }

    pub fn invalid_token() -> Self {
        Self::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "invalid_token",
            "Tautan reset tidak valid atau sudah kedaluwarsa.",
        )
    }

    pub fn rate_limited(retry_after: i64) -> Self {
        let secs = retry_after.max(1);
        Self::new(
            StatusCode::TOO_MANY_REQUESTS,
            "rate_limited",
            format!("Terlalu banyak percobaan. Coba lagi dalam {secs} detik."),
        )
        .with_header("retry-after", &secs.to_string())
    }

    pub fn internal() -> Self {
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            "Terjadi kesalahan pada server.",
        )
    }

    pub fn unavailable() -> Self {
        Self::new(
            StatusCode::SERVICE_UNAVAILABLE,
            "unavailable",
            "Layanan sedang sibuk. Coba lagi sebentar lagi.",
        )
    }

    /// The JSON error envelope.
    pub fn body(&self) -> Value {
        let base = json!({
            "success": false,
            "data": null,
            "error": self.message,
            "code": self.code,
        });
        match (&self.fields, base) {
            (Some(fields), Value::Object(map)) => {
                let with_fields = map
                    .into_iter()
                    .chain(std::iter::once(("fields".to_string(), json!(fields))))
                    .collect();
                Value::Object(with_fields)
            }
            (_, other) => other,
        }
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = self.body();
        let mut response = (self.status, Json(body)).into_response();
        for (name, value) in self.headers {
            response.headers_mut().insert(name, value);
        }
        response
    }
}

/// Is this a SQLite "database is busy/locked" or pool-timeout condition (→ 503)?
fn is_busy(e: &sqlx::Error) -> bool {
    match e {
        sqlx::Error::PoolTimedOut | sqlx::Error::PoolClosed => true,
        sqlx::Error::Database(db) => {
            let code = db.code().unwrap_or_default();
            // SQLITE_BUSY (5) / SQLITE_LOCKED (6) and their extended codes.
            let primary = code.parse::<i64>().map(|c| c & 0xff).unwrap_or(0);
            primary == 5 || primary == 6
        }
        _ => false,
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        if is_busy(&e) {
            tracing::warn!(error = %e, "sqlite busy");
            return ApiError::unavailable();
        }
        if let sqlx::Error::Database(db) = &e {
            if db.is_unique_violation() {
                tracing::info!(error = %e, "unique violation");
                return ApiError::conflict("Data sudah ada.");
            }
        }
        tracing::error!(error = %e, "sqlite error");
        ApiError::internal()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        tracing::error!(error = %e, "internal error");
        ApiError::internal()
    }
}

#[derive(Serialize)]
struct Envelope<T: Serialize> {
    success: bool,
    data: T,
    error: Option<()>,
}

fn envelope<T: Serialize>(status: StatusCode, data: T) -> Response {
    let body = Envelope {
        success: true,
        data,
        error: None,
    };
    (status, Json(body)).into_response()
}

/// `200 { success: true, data, error: null }`.
pub fn ok<T: Serialize>(data: T) -> ApiResult {
    Ok(envelope(StatusCode::OK, data))
}

/// `201 { success: true, data, error: null }`.
pub fn created<T: Serialize>(data: T) -> ApiResult {
    Ok(envelope(StatusCode::CREATED, data))
}

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    async fn body_of(resp: Response) -> Value {
        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    #[tokio::test]
    async fn error_envelope_shape() {
        let resp = ApiError::not_found().into_response();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body = body_of(resp).await;
        assert_eq!(
            body,
            json!({"success": false, "data": null, "error": "Data tidak ditemukan.", "code": "not_found"})
        );
    }

    #[tokio::test]
    async fn validation_carries_fields() {
        let body = body_of(ApiError::field("parent.email", "x").into_response()).await;
        assert_eq!(body["code"], "validation_error");
        assert_eq!(body["fields"]["parent.email"], "x");
    }

    #[tokio::test]
    async fn success_envelope_has_no_code_key() {
        let resp = created(json!({"a": 1})).unwrap();
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_of(resp).await;
        assert_eq!(
            body,
            json!({"success": true, "data": {"a": 1}, "error": null})
        );
        let null_body = body_of(ok(()).unwrap()).await;
        assert_eq!(
            null_body,
            json!({"success": true, "data": null, "error": null})
        );
    }

    #[test]
    fn rate_limited_sets_retry_after_at_least_one() {
        let e = ApiError::rate_limited(0);
        assert_eq!(e.status, StatusCode::TOO_MANY_REQUESTS);
        assert!(e
            .headers
            .iter()
            .any(|(n, v)| n.as_str() == "retry-after" && v == "1"));
        assert!(e.message.contains("1 detik"));
    }

    #[test]
    fn specific_messages_interpolate() {
        assert_eq!(
            ApiError::out_of_stock("Nampan", 2).message,
            "Stok Nampan tidak mencukupi (tersisa 2)."
        );
        assert_eq!(
            ApiError::invalid_transition("CANCELLED", "PAID").message,
            "Status tidak dapat diubah dari CANCELLED ke PAID."
        );
        assert_eq!(ApiError::class_full("Bulan").code, "class_full");
        assert_eq!(
            ApiError::already_enrolled("Amina", "Bulan").code,
            "already_enrolled"
        );
        assert_eq!(ApiError::item_unavailable("Kit").code, "item_unavailable");
        assert_eq!(ApiError::email_taken().status, StatusCode::CONFLICT);
        assert_eq!(ApiError::invalid_token().code, "invalid_token");
        assert_eq!(ApiError::method_not_allowed().status.as_u16(), 405);
        assert_eq!(ApiError::payload_too_large().status.as_u16(), 413);
        assert_eq!(ApiError::origin_mismatch().code, "origin_mismatch");
        assert_eq!(ApiError::bad_request().status.as_u16(), 400);
        assert_eq!(ApiError::forbidden().status.as_u16(), 403);
        assert_eq!(ApiError::invalid_credentials().status.as_u16(), 401);
        assert_eq!(
            ApiError::unauthorized().to_string(),
            "unauthorized: Silakan masuk terlebih dahulu."
        );
    }

    #[test]
    fn sqlx_errors_map_to_generic_codes() {
        assert_eq!(
            ApiError::from(sqlx::Error::PoolTimedOut).code,
            "unavailable"
        );
        assert_eq!(ApiError::from(sqlx::Error::RowNotFound).code, "internal");
        assert_eq!(ApiError::from(anyhow::anyhow!("boom")).code, "internal");
    }

    #[tokio::test]
    async fn unique_violation_maps_to_conflict() {
        let pool = crate::db::pool(":memory:").await.unwrap();
        crate::db::migrate(&pool).await.unwrap();
        let insert = "INSERT INTO order_code_counters (year, last_seq) VALUES (2026, 1)";
        sqlx::query(insert).execute(&pool).await.unwrap();
        let err = sqlx::query(insert).execute(&pool).await.unwrap_err();
        let api = ApiError::from(err);
        assert_eq!(api.code, "conflict");
        assert!(!api.message.contains("UNIQUE"));
    }
}
