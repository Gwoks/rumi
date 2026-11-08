//! Liveness (`/healthz`, plain text, no DB) and API health (`/api/health`, §5.8.2 #1).

use axum::extract::State;
use axum::http::StatusCode;
use serde_json::json;

use crate::error::{ok, ApiError, ApiResult};
use crate::state::AppState;

pub async fn healthz() -> (StatusCode, &'static str) {
    (StatusCode::OK, "ok")
}

/// `SELECT 1`; a DB failure is `503 unavailable`.
pub async fn api_health(State(state): State<AppState>) -> ApiResult {
    sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::warn!(error = %e, "health probe failed");
            ApiError::unavailable()
        })?;
    ok(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION") }))
}
