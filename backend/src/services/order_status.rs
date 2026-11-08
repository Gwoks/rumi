//! The order state machine (PRD §5.9.4), shared by the admin endpoint and the
//! sweep. Every transition runs in one `BEGIN IMMEDIATE` transaction.
//!
//! | From → To               | Effects                                                    |
//! |-------------------------|------------------------------------------------------------|
//! | PENDING_WA → PAID       | `paid_at`; RESERVED enrollments → CONFIRMED                 |
//! | PENDING_WA → CANCELLED  | `cancelled_at`; kit stock back; RESERVED/CONFIRMED → CANCELLED, seats back |
//! | PAID → CANCELLED        | same; ATTENDED/ABSENT stay and keep their seat             |
//! | anything else           | `409 invalid_transition`                                   |

use sqlx::{SqliteConnection, SqlitePool};

use crate::error::ApiError;

pub fn is_allowed(from: &str, to: &str) -> bool {
    matches!(
        (from, to),
        ("PENDING_WA", "PAID") | ("PENDING_WA", "CANCELLED") | ("PAID", "CANCELLED")
    )
}

async fn mark_paid(conn: &mut SqliteConnection, order_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE orders SET status = 'PAID', paid_at = datetime('now') WHERE id = ?")
        .bind(order_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query(
        "UPDATE class_enrollments SET status = 'CONFIRMED'
         WHERE status = 'RESERVED'
           AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)",
    )
    .bind(order_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Release stock and seats (even for soft-deleted kits/classes), then cancel.
async fn cancel(conn: &mut SqliteConnection, order_id: i64) -> Result<(), sqlx::Error> {
    let statements = [
        "UPDATE play_kits SET stock = stock + (
             SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
             WHERE oi.order_id = ?1 AND oi.kit_id = play_kits.id)
         WHERE id IN (SELECT kit_id FROM order_items WHERE order_id = ?1 AND item_type = 'KIT')",
        "UPDATE weekend_classes SET seats_booked = seats_booked - (
             SELECT COUNT(*) FROM class_enrollments e
             JOIN order_items oi ON oi.id = e.order_item_id
             WHERE oi.order_id = ?1 AND e.class_id = weekend_classes.id
               AND e.status IN ('RESERVED', 'CONFIRMED'))
         WHERE id IN (SELECT class_id FROM order_items WHERE order_id = ?1 AND item_type = 'CLASS')",
        "UPDATE class_enrollments SET status = 'CANCELLED'
         WHERE status IN ('RESERVED', 'CONFIRMED')
           AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?1)",
        "UPDATE orders SET status = 'CANCELLED', cancelled_at = datetime('now') WHERE id = ?1",
    ];
    for sql in statements {
        sqlx::query(sql).bind(order_id).execute(&mut *conn).await?;
    }
    Ok(())
}

/// Move order `order_id` to `to` (`PAID` or `CANCELLED`).
pub async fn transition(pool: &SqlitePool, order_id: i64, to: &str) -> Result<(), ApiError> {
    let mut tx = crate::db::begin_immediate(pool).await?;
    let from: Option<String> = sqlx::query_scalar("SELECT status FROM orders WHERE id = ?")
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await?;
    let from = from.ok_or_else(ApiError::not_found)?;
    if !is_allowed(&from, to) {
        return Err(ApiError::invalid_transition(&from, to));
    }
    match to {
        "PAID" => mark_paid(&mut tx, order_id).await?,
        _ => cancel(&mut tx, order_id).await?,
    }
    tx.commit().await?;
    Ok(())
}

/// Sweep step 1 (§5.9.6): cancel every `PENDING_WA` order older than the TTL.
/// Returns how many were cancelled.
pub async fn cancel_expired(pool: &SqlitePool, ttl_hours: i64) -> Result<u64, ApiError> {
    let ids: Vec<i64> = sqlx::query_scalar(
        "SELECT id FROM orders WHERE status = 'PENDING_WA' AND created_at <= datetime('now', ?)",
    )
    .bind(format!("-{ttl_hours} hours"))
    .fetch_all(pool)
    .await?;
    let mut cancelled = 0;
    for id in ids {
        match transition(pool, id, "CANCELLED").await {
            Ok(()) => cancelled += 1,
            // Paid or cancelled meanwhile by an admin: nothing to do.
            Err(e) if e.code == "invalid_transition" => {}
            Err(e) => return Err(e),
        }
    }
    Ok(cancelled)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transition_table() {
        assert!(is_allowed("PENDING_WA", "PAID"));
        assert!(is_allowed("PENDING_WA", "CANCELLED"));
        assert!(is_allowed("PAID", "CANCELLED"));
        for (from, to) in [
            ("PAID", "PAID"),
            ("CANCELLED", "PAID"),
            ("CANCELLED", "CANCELLED"),
            ("PENDING_WA", "PENDING_WA"),
            ("PAID", "PENDING_WA"),
        ] {
            assert!(!is_allowed(from, to), "{from}->{to}");
        }
    }

    #[tokio::test]
    async fn unknown_order_is_404() {
        let pool = crate::testutil::pool().await;
        assert_eq!(
            transition(&pool, 99, "PAID").await.unwrap_err().code,
            "not_found"
        );
    }
}
