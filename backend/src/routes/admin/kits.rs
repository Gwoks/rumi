//! Kit CRUD #31–#34 with soft delete.

use axum::extract::State;
use axum::routing::{get, patch};
use axum::Router;
use serde_json::Value;

use crate::auth::AdminUser;
use crate::error::{created, ok, ApiError, ApiResult};
use crate::extract::{ApiJson, IdPath, QueryParams};
use crate::models::kit::{self, KIT_SPECS};
use crate::models::DOMAINS;
use crate::state::AppState;
use crate::validate::{body_object, ensure_any_known, parse_create, parse_patch, Errors, Reader};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/kits", get(list).post(create))
        .route("/api/admin/kits/{id}", patch(update).delete(remove))
}

async fn found(state: &AppState, id: i64) -> ApiResult {
    kit::find(&state.pool, id, false)
        .await?
        .map_or_else(|| Err(ApiError::not_found()), ok)
}

/// #31: inactive included, deleted excluded.
async fn list(State(state): State<AppState>, _admin: AdminUser, q: QueryParams) -> ApiResult {
    let errs = Errors::new();
    let category = q.one_of("category", &DOMAINS, &errs);
    errs.finish()?;
    ok(kit::list(&state.pool, category, false).await?)
}

/// #32
async fn create(
    State(state): State<AppState>,
    _admin: AdminUser,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let changes = parse_create(&r, &KIT_SPECS);
    errs.finish()?;
    let id = crate::patch::insert(&state.pool, "play_kits", &changes).await?;
    let kit = kit::find(&state.pool, id, false)
        .await?
        .ok_or_else(ApiError::internal)?;
    created(kit)
}

/// #33: `stock` is set directly (last write wins).
async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    IdPath(id): IdPath,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    kit::find(&state.pool, id, false)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    ensure_any_known(&r, &KIT_SPECS)?;
    let changes = parse_patch(&r, &KIT_SPECS);
    errs.finish()?;
    crate::patch::update(&state.pool, "play_kits", id, &changes).await?;
    found(&state, id).await
}

/// #34
async fn remove(State(state): State<AppState>, _admin: AdminUser, IdPath(id): IdPath) -> ApiResult {
    match crate::patch::soft_delete(&state.pool, "play_kits", id).await? {
        0 => Err(ApiError::not_found()),
        _ => ok(()),
    }
}
