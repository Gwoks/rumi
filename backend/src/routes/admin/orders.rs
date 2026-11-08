//! Orders #39–#40 (PRD §5.8.5, state machine §5.9.4).

use axum::extract::State;
use axum::routing::{get, patch};
use axum::Router;
use serde_json::Value;

use crate::auth::AdminUser;
use crate::error::{ok, ApiError, ApiResult};
use crate::extract::{ApiJson, IdPath, QueryParams};
use crate::models::order;
use crate::models::ORDER_STATUSES;
use crate::routes::paginated;
use crate::services::order_status;
use crate::state::AppState;
use crate::validate::{body_object, Errors, Reader, Rule};

const STATUS_TARGETS: [&str; 2] = ["PAID", "CANCELLED"];

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/orders", get(list))
        .route("/api/admin/orders/{id}/status", patch(set_status))
}

/// #39 (paginated): optional `status`, `q` over code / parent name / email.
async fn list(State(state): State<AppState>, _admin: AdminUser, q: QueryParams) -> ApiResult {
    let errs = Errors::new();
    let status = q.one_of("status", &ORDER_STATUSES, &errs);
    let search = q.search(&errs);
    let page = q.page(&errs);
    errs.finish()?;
    let (items, total) =
        order::admin_page(&state.pool, &state.cfg, status, search.as_deref(), page).await?;
    ok(paginated(items, page, total))
}

/// #40: `{ status: 'PAID' | 'CANCELLED' }`.
async fn set_status(
    State(state): State<AppState>,
    _admin: AdminUser,
    IdPath(id): IdPath,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let to = r.req_string("status", Rule::Enum(&STATUS_TARGETS));
    errs.finish()?;
    order_status::transition(&state.pool, id, &to).await?;
    ok(order::find(&state.pool, &state.cfg, id)
        .await?
        .ok_or_else(ApiError::not_found)?)
}
