//! Admin endpoints #22–#40 (PRD §5.8.5). Every handler takes `AdminUser`, so a
//! parent gets `403 forbidden` and an anonymous caller `401 unauthorized`.

use axum::Router;

use crate::state::AppState;

pub mod classes;
pub mod cms;
pub mod kits;
pub mod metrics;
pub mod orders;
pub mod students;

pub fn router() -> Router<AppState> {
    Router::new()
        .merge(metrics::router())
        .merge(cms::router())
        .merge(classes::router())
        .merge(kits::router())
        .merge(students::router())
        .merge(orders::router())
}
