//! SQLite pool + pragmas + migrations (hookbox `db.rs`): WAL, foreign keys and a
//! busy timeout, so `BEGIN IMMEDIATE` writers queue instead of failing.

use std::str::FromStr;
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::{Sqlite, SqlitePool, Transaction};

/// How long a writer waits for the SQLite lock before giving up (→ 503).
const BUSY_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_CONNECTIONS: u32 = 8;

/// Open (creating if missing) a WAL-mode SQLite pool with foreign keys enforced.
/// `":memory:"` opens a private shared-cache in-memory database (tests).
pub async fn pool(sqlite_path: &str) -> anyhow::Result<SqlitePool> {
    let url = if sqlite_path == ":memory:" {
        "sqlite::memory:".to_string()
    } else {
        format!("sqlite://{sqlite_path}")
    };
    let opts = SqliteConnectOptions::from_str(&url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(BUSY_TIMEOUT)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect_with(opts)
        .await?;
    Ok(pool)
}

/// Run the embedded migrations from `./migrations`.
pub async fn migrate(pool: &SqlitePool) -> anyhow::Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

/// Ensure the parent directory of a file-backed database exists.
pub fn ensure_parent_dir(sqlite_path: &str) -> std::io::Result<()> {
    if sqlite_path == ":memory:" {
        return Ok(());
    }
    match std::path::Path::new(sqlite_path).parent() {
        Some(parent) if !parent.as_os_str().is_empty() => std::fs::create_dir_all(parent),
        _ => Ok(()),
    }
}

/// Start a write transaction with `BEGIN IMMEDIATE`: the write lock is taken up
/// front (waiting up to the busy timeout), so read-then-write sequences inside
/// it can never be invalidated by a concurrent writer. Dropping the returned
/// transaction without `commit()` rolls it back.
pub async fn begin_immediate(
    pool: &SqlitePool,
) -> Result<Transaction<'static, Sqlite>, sqlx::Error> {
    pool.begin_with("BEGIN IMMEDIATE").await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn migrate_creates_schema_and_enforces_checks() {
        let pool = pool(":memory:").await.unwrap();
        migrate(&pool).await.unwrap();
        let tables: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN
             ('users','auth_sessions','password_resets','children','cms_content',
              'weekend_classes','play_kits','orders','order_items','class_enrollments',
              'student_assessments','order_code_counters')",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(tables, 12);

        // A negative price violates the CHECK constraint.
        let bad = sqlx::query(
            "INSERT INTO play_kits (name, category, description, price_idr, stock)
             VALUES ('x', 'MATH', 'd', -1, 0)",
        )
        .execute(&pool)
        .await;
        assert!(bad.is_err());
        // An unknown role violates the CHECK constraint.
        let bad_role = sqlx::query(
            "INSERT INTO users (email, password_hash, full_name, phone_wa, role)
             VALUES ('a@b.co', 'h', 'n', '62812345678', 'ROOT')",
        )
        .execute(&pool)
        .await;
        assert!(bad_role.is_err());
    }

    #[tokio::test]
    async fn updated_at_trigger_bumps_on_update() {
        let pool = pool(":memory:").await.unwrap();
        migrate(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO play_kits (name, category, description, price_idr, stock, updated_at)
             VALUES ('k', 'MATH', 'd', 1, 1, '2000-01-01 00:00:00')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE play_kits SET stock = 2")
            .execute(&pool)
            .await
            .unwrap();
        let updated: String = sqlx::query_scalar("SELECT updated_at FROM play_kits")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_ne!(updated, "2000-01-01 00:00:00");
    }

    #[tokio::test]
    async fn begin_immediate_rolls_back_on_drop() {
        let pool = pool(":memory:").await.unwrap();
        migrate(&pool).await.unwrap();
        {
            let mut tx = begin_immediate(&pool).await.unwrap();
            sqlx::query("INSERT INTO order_code_counters (year, last_seq) VALUES (2026, 5)")
                .execute(&mut *tx)
                .await
                .unwrap();
            // dropped without commit
        }
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM order_code_counters")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn ensure_parent_dir_creates_missing_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/deeper/rumi.db");
        ensure_parent_dir(path.to_str().unwrap()).unwrap();
        assert!(dir.path().join("nested/deeper").is_dir());
        ensure_parent_dir(":memory:").unwrap();
        ensure_parent_dir("rumi.db").unwrap();
    }
}
