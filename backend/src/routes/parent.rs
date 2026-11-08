//! Parent endpoints #13–#21 (PRD §5.8.4). A child id that is absent, deleted
//! or another parent's always answers `404 not_found` (§5.3.1).

use axum::extract::State;
use axum::routing::{get, patch, post};
use axum::Router;
use serde_json::{json, Value};

use crate::auth::ParentUser;
use crate::error::{created, ok, ApiError, ApiResult};
use crate::extract::{ApiJson, IdPath};
use crate::models::child::{self, Child, CHILD_SPECS};
use crate::models::order::{self, Order};
use crate::models::{assessment, enrollment};
use crate::services::checkout::{self, Outcome};
use crate::services::report;
use crate::state::AppState;
use crate::validate::{body_object, ensure_any_known, parse_create, parse_patch, Errors, Reader};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/me/children", get(list_children).post(create_child))
        .route(
            "/api/me/children/{id}",
            patch(patch_child).delete(delete_child),
        )
        .route("/api/me/children/{id}/assessments", get(child_assessments))
        .route("/api/me/children/{id}/enrollments", get(child_enrollments))
        .route("/api/me/children/{id}/report", get(child_report))
        .route("/api/me/orders", get(my_orders))
        .route("/api/orders", post(create_order))
}

async fn owned(state: &AppState, parent_id: i64, child_id: i64) -> Result<Child, ApiError> {
    child::find_owned(&state.pool, parent_id, child_id)
        .await?
        .ok_or_else(ApiError::not_found)
}

/// #13
async fn list_children(State(state): State<AppState>, ParentUser(user): ParentUser) -> ApiResult {
    ok(child::list_for_parent(&state.pool, user.id).await?)
}

/// #14
async fn create_child(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let changes = parse_create(&r, &CHILD_SPECS);
    errs.finish()?;
    let id = child::insert(&state.pool, user.id, &changes).await?;
    created(owned(&state, user.id, id).await?)
}

/// #15
async fn patch_child(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    IdPath(id): IdPath,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    owned(&state, user.id, id).await?;
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    ensure_any_known(&r, &CHILD_SPECS)?;
    let changes = parse_patch(&r, &CHILD_SPECS);
    errs.finish()?;
    crate::patch::update(&state.pool, "children", id, &changes).await?;
    ok(owned(&state, user.id, id).await?)
}

/// #16: soft delete; refused while the child holds an active seat.
async fn delete_child(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    IdPath(id): IdPath,
) -> ApiResult {
    let mut tx = crate::db::begin_immediate(&state.pool).await?;
    child::find_owned(&mut *tx, user.id, id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    if child::has_active_enrollments(&mut *tx, id).await? {
        return Err(ApiError::conflict("Anak masih memiliki kelas aktif."));
    }
    crate::patch::soft_delete(&mut *tx, "children", id).await?;
    tx.commit().await?;
    ok(())
}

/// #17
async fn child_assessments(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    IdPath(id): IdPath,
) -> ApiResult {
    owned(&state, user.id, id).await?;
    ok(assessment::list_for_child(&state.pool, id).await?)
}

/// #18
async fn child_enrollments(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    IdPath(id): IdPath,
) -> ApiResult {
    owned(&state, user.id, id).await?;
    ok(enrollment::list_for_child(&state.pool, id).await?)
}

/// #19
async fn child_report(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    IdPath(id): IdPath,
) -> ApiResult {
    let child = owned(&state, user.id, id).await?;
    ok(report::child_report(&state.pool, child).await?)
}

/// #20
async fn my_orders(State(state): State<AppState>, ParentUser(user): ParentUser) -> ApiResult {
    ok(order::list_for_parent(&state.pool, &state.cfg, user.id).await?)
}

fn checkout_result(order: Order) -> Value {
    json!({ "wa_url": order.wa_url.clone(), "order": order })
}

/// #21: checkout (§5.9.1). `201` for a new order, `200` for a replay.
async fn create_order(
    State(state): State<AppState>,
    ParentUser(user): ParentUser,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    if let Some(key) = checkout::replay_key(&body) {
        if let Some(existing) = order::find_by_key(&state.pool, &state.cfg, user.id, &key).await? {
            return ok(checkout_result(existing));
        }
    }
    let input = checkout::parse(&body)?;
    match checkout::checkout(&state.pool, &state.cfg, &user, &input).await? {
        Outcome::Created(order) => created(checkout_result(order)),
        Outcome::Replayed(order) => ok(checkout_result(order)),
    }
}
