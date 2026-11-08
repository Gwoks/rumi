//! Admin metrics (PRD §5.6 `Metrics`, §5.8.5 #22). Real aggregates only.

use std::collections::HashMap;

use serde::Serialize;
use sqlx::SqlitePool;

use crate::helpers::{
    dash_join, now_utc, pct_round, recent_months, rfc3339, today_wib, upcoming_sql,
    WIB_OFFSET_HOURS,
};
use crate::models::LOW_STOCK_THRESHOLD;

const REVENUE_MONTHS: u32 = 6;
const UPCOMING_LIMIT: i64 = 5;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MonthRevenue {
    pub month: String,
    pub revenue_idr: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, sqlx::FromRow)]
pub struct LowStockKit {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub stock: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ClassFill {
    pub id: i64,
    pub title: String,
    pub date: String,
    pub time_slot: String,
    pub location: String,
    pub status: String,
    pub capacity: i64,
    pub seats_booked: i64,
    pub seats_left: i64,
    pub fill_rate_pct: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Metrics {
    pub total_revenue_idr: i64,
    pub paid_orders: i64,
    pub pending_orders: i64,
    pub pending_amount_idr: i64,
    pub enrolled_students: i64,
    pub revenue_by_month: Vec<MonthRevenue>,
    pub low_stock_kits: Vec<LowStockKit>,
    pub upcoming_classes: Vec<ClassFill>,
    pub generated_at: String,
}

/// `(count, sum)` of orders in `status`.
async fn order_totals(pool: &SqlitePool, status: &str) -> Result<(i64, i64), sqlx::Error> {
    sqlx::query_as(
        "SELECT COUNT(*), COALESCE(SUM(total_amount_idr), 0) FROM orders WHERE status = ?",
    )
    .bind(status)
    .fetch_one(pool)
    .await
}

async fn enrolled_students(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(DISTINCT e.child_id) FROM class_enrollments e
         JOIN children c ON c.id = e.child_id
         WHERE c.deleted_at IS NULL AND e.status IN ('CONFIRMED', 'ATTENDED', 'ABSENT')",
    )
    .fetch_one(pool)
    .await
}

/// Exactly 6 WIB months (oldest first), zero-filled, bucketed by `paid_at` (WIB).
async fn revenue_by_month(pool: &SqlitePool) -> Result<Vec<MonthRevenue>, sqlx::Error> {
    let months = recent_months(today_wib(), REVENUE_MONTHS);
    let oldest = months.first().cloned().unwrap_or_default();
    let rows: Vec<(String, i64)> = sqlx::query_as(&format!(
        "SELECT strftime('%Y-%m', paid_at, '+{WIB_OFFSET_HOURS} hours') AS month,
                SUM(total_amount_idr)
         FROM orders WHERE status = 'PAID' AND paid_at IS NOT NULL
         GROUP BY month HAVING month >= ?"
    ))
    .bind(&oldest)
    .fetch_all(pool)
    .await?;
    let sums: HashMap<String, i64> = rows.into_iter().collect();
    Ok(months
        .into_iter()
        .map(|month| MonthRevenue {
            revenue_idr: sums.get(&month).copied().unwrap_or(0),
            month,
        })
        .collect())
}

async fn low_stock(pool: &SqlitePool) -> Result<Vec<LowStockKit>, sqlx::Error> {
    sqlx::query_as(
        "SELECT id, name, category, stock FROM play_kits
         WHERE deleted_at IS NULL AND is_active = 1 AND stock <= ?
         ORDER BY stock ASC, name ASC",
    )
    .bind(LOW_STOCK_THRESHOLD)
    .fetch_all(pool)
    .await
}

type FillRow = (
    i64,
    String,
    String,
    String,
    String,
    String,
    String,
    i64,
    i64,
);

async fn upcoming_classes(pool: &SqlitePool) -> Result<Vec<ClassFill>, sqlx::Error> {
    let sql = format!(
        "SELECT w.id, w.title, w.date, w.start_time, w.end_time, w.location, w.status,
                w.capacity, w.seats_booked
         FROM weekend_classes w
         WHERE w.deleted_at IS NULL AND w.status IN ('OPEN', 'CLOSED') AND {}
         ORDER BY w.date, w.start_time, w.id LIMIT ?",
        upcoming_sql("w")
    );
    let rows: Vec<FillRow> = sqlx::query_as(&sql)
        .bind(UPCOMING_LIMIT)
        .fetch_all(pool)
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, title, date, start, end, location, status, capacity, booked)| ClassFill {
                id,
                title,
                date,
                time_slot: dash_join(start, end),
                location,
                status,
                capacity,
                seats_booked: booked,
                seats_left: (capacity - booked).max(0),
                fill_rate_pct: pct_round(booked, capacity),
            },
        )
        .collect())
}

pub async fn compute(pool: &SqlitePool) -> Result<Metrics, sqlx::Error> {
    let (paid_orders, total_revenue_idr) = order_totals(pool, "PAID").await?;
    let (pending_orders, pending_amount_idr) = order_totals(pool, "PENDING_WA").await?;
    Ok(Metrics {
        total_revenue_idr,
        paid_orders,
        pending_orders,
        pending_amount_idr,
        enrolled_students: enrolled_students(pool).await?,
        revenue_by_month: revenue_by_month(pool).await?,
        low_stock_kits: low_stock(pool).await?,
        upcoming_classes: upcoming_classes(pool).await?,
        generated_at: rfc3339(now_utc()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn empty_database_yields_zeroes_and_six_months() {
        let pool = crate::testutil::pool().await;
        let m = compute(&pool).await.unwrap();
        assert_eq!(m.total_revenue_idr, 0);
        assert_eq!(m.pending_orders, 0);
        assert_eq!(m.enrolled_students, 0);
        assert_eq!(m.revenue_by_month.len(), 6);
        assert!(m.revenue_by_month.iter().all(|r| r.revenue_idr == 0));
        assert!(m.low_stock_kits.is_empty() && m.upcoming_classes.is_empty());
    }
}
