//! `/api` route tree (PRD §5.8). Every path is spelled out in full so the
//! index in §5.8.1 can be checked against this file at a glance.

use axum::routing::get;
use axum::Router;
use serde::Serialize;
use serde_json::{json, Value};

use crate::extract::Page;
use crate::state::AppState;

pub mod admin;
pub mod auth;
pub mod health;
pub mod parent;
pub mod public;
pub mod spa;

pub fn api_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/api/health", get(health::api_health))
        .merge(public::router())
        .merge(auth::router(state))
        .merge(parent::router())
        .merge(admin::router())
}

/// `Paginated<T>` (§5.6): `{ items, meta: { page, per_page, total } }`.
pub fn paginated<T: Serialize>(items: Vec<T>, page: Page, total: i64) -> Value {
    json!({
        "items": items,
        "meta": { "page": page.page, "per_page": page.per_page, "total": total },
    })
}
