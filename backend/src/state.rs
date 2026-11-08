//! Shared Axum application state (hookbox `state.rs`).

use std::sync::Arc;

use sqlx::SqlitePool;

use crate::config::Config;
use crate::limiter::Limiter;
use crate::notifier::{LogNotifier, Notifier};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub cfg: Arc<Config>,
    pub limiter: Arc<Limiter>,
    pub notifier: Arc<dyn Notifier>,
}

impl AppState {
    /// Production wiring: the `LogNotifier`, revealing links only in development.
    pub fn new(pool: SqlitePool, cfg: Config) -> Self {
        let notifier = Arc::new(LogNotifier::for_config(&cfg));
        Self::with_notifier(pool, cfg, notifier)
    }

    pub fn with_notifier(pool: SqlitePool, cfg: Config, notifier: Arc<dyn Notifier>) -> Self {
        AppState {
            pool,
            cfg: Arc::new(cfg),
            limiter: Arc::new(Limiter::new()),
            notifier,
        }
    }
}
