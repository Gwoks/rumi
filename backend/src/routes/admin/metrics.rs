//! #22 `GET /api/admin/metrics`.

use axum::extract::State;
use axum::routing::get;
use axum::Router;

use crate::auth::AdminUser;
use crate::error::{ok, ApiResult};
use crate::services::metrics;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/admin/metrics", get(get_metrics))
}

async fn get_metrics(State(state): State<AppState>, _admin: AdminUser) -> ApiResult {
    ok(metrics::compute(&state.pool).await?)
}
