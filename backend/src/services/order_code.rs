//! Order codes `RUMI-{YYYY}-{NNNN}` (PRD §5.9.2). The sequence is per WIB year
//! and is allocated inside the checkout transaction, so a rolled-back checkout
//! never consumes a number.

use chrono::{Datelike, NaiveDateTime};
use sqlx::SqliteConnection;

use crate::helpers::to_wib;

/// The order-code year: the WIB calendar year of `now_utc`.
pub fn wib_year(now_utc: NaiveDateTime) -> i32 {
    to_wib(now_utc).year()
}

/// `RUMI-2026-0001`; from 10000 on the sequence prints at natural width.
pub fn format_code(year: i32, seq: i64) -> String {
    format!("RUMI-{year}-{seq:04}")
}

/// Bump and return the next code for `year` (UPSERT … RETURNING).
pub async fn allocate(conn: &mut SqliteConnection, year: i32) -> Result<String, sqlx::Error> {
    let seq: i64 = sqlx::query_scalar(
        "INSERT INTO order_code_counters (year, last_seq) VALUES (?, 1)
         ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
         RETURNING last_seq",
    )
    .bind(year)
    .fetch_one(conn)
    .await?;
    Ok(format_code(year, seq))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::helpers::parse_db_ts;

    #[test]
    fn code_format_and_width() {
        assert_eq!(format_code(2026, 1), "RUMI-2026-0001");
        assert_eq!(format_code(2026, 41), "RUMI-2026-0041");
        assert_eq!(format_code(2026, 10_000), "RUMI-2026-10000");
    }

    #[test]
    fn year_is_wib() {
        // 2026-12-31 17:00 UTC is already 2027-01-01 00:00 WIB.
        assert_eq!(wib_year(parse_db_ts("2026-12-31 17:00:00").unwrap()), 2027);
        assert_eq!(wib_year(parse_db_ts("2026-12-31 16:59:59").unwrap()), 2026);
    }

    #[tokio::test]
    async fn sequence_per_year_and_rollback_does_not_consume() {
        let pool = crate::testutil::pool().await;
        let mut conn = pool.acquire().await.unwrap();
        assert_eq!(allocate(&mut conn, 2026).await.unwrap(), "RUMI-2026-0001");
        assert_eq!(allocate(&mut conn, 2026).await.unwrap(), "RUMI-2026-0002");
        assert_eq!(allocate(&mut conn, 2027).await.unwrap(), "RUMI-2027-0001");
        drop(conn);
        {
            let mut tx = crate::db::begin_immediate(&pool).await.unwrap();
            assert_eq!(allocate(&mut tx, 2026).await.unwrap(), "RUMI-2026-0003");
        }
        let mut conn = pool.acquire().await.unwrap();
        assert_eq!(allocate(&mut conn, 2026).await.unwrap(), "RUMI-2026-0003");
    }
}
