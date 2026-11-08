//! Periodic sweep (PRD §5.9.6, hookbox `tasks/sweep.rs`): auto-cancel expired
//! `PENDING_WA` orders through the order state machine, purge expired sessions
//! and reset tokens, and evict idle rate-limit buckets.

use std::sync::Arc;
use std::time::Duration;

use sqlx::SqlitePool;

use crate::config::Config;
use crate::error::ApiError;
use crate::limiter::Limiter;
use crate::services::order_status::cancel_expired;

/// Buckets idle this long are dropped (§5.9.6 step 4).
pub const LIMITER_IDLE: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SweepReport {
    pub orders_cancelled: u64,
    pub sessions_purged: u64,
    pub resets_purged: u64,
    pub buckets_evicted: usize,
}

/// Run one sweep pass.
pub async fn sweep_once(
    pool: &SqlitePool,
    cfg: &Config,
    limiter: &Limiter,
) -> Result<SweepReport, ApiError> {
    let orders_cancelled = cancel_expired(pool, cfg.pending_order_ttl_hours).await?;
    let sessions_purged =
        sqlx::query("DELETE FROM auth_sessions WHERE expires_at <= datetime('now')")
            .execute(pool)
            .await?
            .rows_affected();
    let resets_purged = sqlx::query(
        "DELETE FROM password_resets
         WHERE expires_at <= datetime('now')
            OR (used_at IS NOT NULL AND used_at <= datetime('now', '-24 hours'))",
    )
    .execute(pool)
    .await?
    .rows_affected();
    Ok(SweepReport {
        orders_cancelled,
        sessions_purged,
        resets_purged,
        buckets_evicted: limiter.evict_idle(LIMITER_IDLE),
    })
}

/// Spawn the periodic sweep loop (first run after one interval).
pub fn spawn(
    pool: SqlitePool,
    cfg: Arc<Config>,
    limiter: Arc<Limiter>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(cfg.sweep_interval_seconds));
        tick.tick().await;
        loop {
            tick.tick().await;
            match sweep_once(&pool, &cfg, &limiter).await {
                Ok(report) if report != SweepReport::default() => tracing::info!(?report, "sweep"),
                Ok(_) => {}
                Err(e) => tracing::warn!(error = %e, "sweep failed (continuing)"),
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn exec(pool: &SqlitePool, sql: &str) {
        sqlx::query(sql).execute(pool).await.unwrap();
    }

    async fn count(pool: &SqlitePool, sql: &str) -> i64 {
        sqlx::query_scalar(sql).fetch_one(pool).await.unwrap()
    }

    /// Parent 1 with children 1 and 2, class 1 (2 seats booked), kit 1 (stock 5).
    async fn fixture() -> SqlitePool {
        let pool = crate::testutil::pool().await;
        exec(
            &pool,
            "INSERT INTO users (id, email, password_hash, full_name, phone_wa)
                     VALUES (1, 'p@x.co', 'h', 'P', '6281211112222')",
        )
        .await;
        exec(
            &pool,
            "INSERT INTO children (id, parent_id, name, dob)
                     VALUES (1, 1, 'A', '2021-01-01'), (2, 1, 'B', '2021-01-01')",
        )
        .await;
        exec(&pool, "INSERT INTO weekend_classes (id, title, description, location, age_min, age_max, date,
                     start_time, end_time, fee_idr, capacity, seats_booked, status)
                     VALUES (1, 'K', 'd', 'L', 3, 6, '2099-01-01', '09:30', '11:30', 0, 12, 2, 'OPEN')").await;
        exec(
            &pool,
            "INSERT INTO play_kits (id, name, category, description, price_idr, stock)
                     VALUES (1, 'Kit', 'MATH', 'd', 0, 5)",
        )
        .await;
        pool
    }

    /// A PENDING_WA order created `age` ago holding a seat for `child` and,
    /// when `kit_qty > 0`, that many units of kit 1.
    async fn pending_order(pool: &SqlitePool, id: i64, age: &str, child: i64, kit_qty: i64) {
        exec(pool, &format!(
            "INSERT INTO orders (id, order_code, parent_id, total_amount_idr, delivery_name, delivery_phone,
             wa_message_payload, idempotency_key, created_at)
             VALUES ({id}, 'RUMI-2026-000{id}', 1, 0, 'N', '6281211112222', 'm', 'k{id}', datetime('now', '{age}'))"
        )).await;
        exec(pool, &format!(
            "INSERT INTO order_items (id, order_id, item_type, class_id, child_id, name_snapshot,
             unit_price_idr, quantity, line_total_idr) VALUES ({id}1, {id}, 'CLASS', 1, {child}, 'K', 0, 1, 0)"
        )).await;
        exec(
            pool,
            &format!(
                "INSERT INTO class_enrollments (class_id, child_id, order_item_id, status)
             VALUES (1, {child}, {id}1, 'RESERVED')"
            ),
        )
        .await;
        if kit_qty > 0 {
            exec(pool, &format!(
                "INSERT INTO order_items (id, order_id, item_type, kit_id, name_snapshot, unit_price_idr,
                 quantity, line_total_idr) VALUES ({id}2, {id}, 'KIT', 1, 'Kit', 0, {kit_qty}, 0)"
            )).await;
        }
    }

    async fn tokens(pool: &SqlitePool) {
        exec(pool, "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES
                    (1, 'old', datetime('now', '-1 minute')), (1, 'live', datetime('now', '+1 day'))").await;
        exec(
            pool,
            "INSERT INTO password_resets (user_id, token_hash, expires_at, used_at) VALUES
                    (1, 'expired', datetime('now', '-1 minute'), NULL),
                    (1, 'used-long-ago', datetime('now', '+1 hour'), datetime('now', '-25 hours')),
                    (1, 'used-recently', datetime('now', '+1 hour'), datetime('now', '-1 hour')),
                    (1, 'live', datetime('now', '+1 hour'), NULL)",
        )
        .await;
    }

    #[tokio::test]
    async fn sweep_cancels_expired_orders_and_purges_tokens() {
        let pool = fixture().await;
        pending_order(&pool, 1, "-49 hours", 1, 2).await;
        pending_order(&pool, 2, "-1 hours", 2, 0).await;
        tokens(&pool).await;
        let limiter = Limiter::new();
        limiter.check("auth:/api/auth/login:1.1.1.1", 10, 60);
        let cfg = crate::testutil::config();

        let report = sweep_once(&pool, &cfg, &limiter).await.unwrap();
        let expected = SweepReport {
            orders_cancelled: 1,
            sessions_purged: 1,
            resets_purged: 2,
            buckets_evicted: 0,
        };
        assert_eq!(report, expected);
        assert_eq!(
            count(&pool, "SELECT COUNT(*) FROM orders WHERE id = 1 AND status = 'CANCELLED' AND cancelled_at IS NOT NULL").await,
            1
        );
        assert_eq!(
            count(
                &pool,
                "SELECT COUNT(*) FROM orders WHERE id = 2 AND status = 'PENDING_WA'"
            )
            .await,
            1
        );
        assert_eq!(count(&pool, "SELECT stock FROM play_kits").await, 7);
        assert_eq!(
            count(&pool, "SELECT seats_booked FROM weekend_classes").await,
            1
        );
        assert_eq!(
            count(
                &pool,
                "SELECT COUNT(*) FROM class_enrollments WHERE status = 'CANCELLED'"
            )
            .await,
            1
        );
        assert_eq!(count(&pool, "SELECT COUNT(*) FROM auth_sessions").await, 1);
        assert_eq!(
            count(&pool, "SELECT COUNT(*) FROM password_resets").await,
            2
        );

        // A second pass has nothing left to do.
        assert_eq!(
            sweep_once(&pool, &cfg, &limiter).await.unwrap(),
            SweepReport::default()
        );
    }

    #[tokio::test]
    async fn ttl_comes_from_config() {
        let pool = fixture().await;
        pending_order(&pool, 1, "-3 hours", 1, 1).await;
        let cfg = crate::config::Config {
            pending_order_ttl_hours: 2,
            ..crate::testutil::config()
        };
        let report = sweep_once(&pool, &cfg, &Limiter::new()).await.unwrap();
        assert_eq!(report.orders_cancelled, 1);
    }

    #[tokio::test]
    async fn spawned_loop_runs_and_can_be_aborted() {
        let pool = fixture().await;
        let cfg = std::sync::Arc::new(crate::config::Config {
            sweep_interval_seconds: 1,
            ..crate::testutil::config()
        });
        let handle = spawn(pool, cfg, std::sync::Arc::new(Limiter::new()));
        tokio::time::sleep(Duration::from_millis(1100)).await;
        assert!(!handle.is_finished());
        handle.abort();
    }
}
