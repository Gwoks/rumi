//! Test-only support (hookbox `testutil.rs`).
//!
//! `std::env::{set_var,remove_var}` mutate process-global state shared by every
//! test in the binary. Tests that touch the environment hold `env_lock()` for
//! the whole set → `Config::from_env()` → assert window.

use std::sync::{Mutex, MutexGuard, OnceLock};

use sqlx::SqlitePool;

static ENV_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();

/// Acquire the process-global environment lock (poison-tolerant).
pub fn env_lock() -> MutexGuard<'static, ()> {
    ENV_MUTEX
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// A fresh, migrated in-memory database.
pub async fn pool() -> SqlitePool {
    let pool = crate::db::pool(":memory:").await.expect("pool");
    crate::db::migrate(&pool).await.expect("migrate");
    pool
}

/// A config built from defaults, independent of the process environment.
pub fn config() -> crate::config::Config {
    let _guard = env_lock();
    crate::config::Config::from_env()
}
