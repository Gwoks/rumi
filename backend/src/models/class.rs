//! `weekend_classes` (PRD §5.6 `WeekendClass`, §5.8.5 `ClassCreate`/`ClassPatch`).

use serde::Serialize;
use sqlx::SqliteExecutor;

use crate::helpers::{dash_join, is_upcoming, upcoming_sql};
use crate::models::CLASS_STATUSES;
use crate::validate::{FieldSpec, Rule};

const fn spec(key: &'static str, rule: Rule, required: bool, nullable: bool) -> FieldSpec {
    FieldSpec {
        key,
        rule,
        required,
        nullable,
    }
}

/// `ClassCreate` rules; `ClassPatch` = the same fields, all optional.
pub const CLASS_SPECS: [FieldSpec; 12] = [
    spec("title", Rule::Text { min: 3, max: 120 }, true, false),
    spec("description", Rule::Text { min: 1, max: 2000 }, true, false),
    spec("location", Rule::Text { min: 3, max: 160 }, true, false),
    spec("image_url", Rule::ImageUrl, false, true),
    spec("age_min", Rule::Int { min: 0, max: 12 }, true, false),
    spec("age_max", Rule::Int { min: 0, max: 12 }, true, false),
    spec("date", Rule::Date, true, false),
    spec("start_time", Rule::Time, true, false),
    spec("end_time", Rule::Time, true, false),
    spec(
        "fee_idr",
        Rule::Int {
            min: 0,
            max: 100_000_000,
        },
        true,
        false,
    ),
    spec("capacity", Rule::Int { min: 1, max: 200 }, true, false),
    spec("status", Rule::Enum(&CLASS_STATUSES), false, false),
];

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ClassRow {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub location: String,
    pub image_url: Option<String>,
    pub age_min: i64,
    pub age_max: i64,
    pub date: String,
    pub start_time: String,
    pub end_time: String,
    pub fee_idr: i64,
    pub capacity: i64,
    pub seats_booked: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct WeekendClass {
    pub id: i64,
    pub title: String,
    pub description: String,
    pub location: String,
    pub image_url: Option<String>,
    pub age_min: i64,
    pub age_max: i64,
    pub age_range: String,
    pub date: String,
    pub start_time: String,
    pub end_time: String,
    pub time_slot: String,
    pub fee_idr: i64,
    pub capacity: i64,
    pub seats_booked: i64,
    pub seats_left: i64,
    pub is_full: bool,
    pub is_upcoming: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ClassRow> for WeekendClass {
    fn from(r: ClassRow) -> Self {
        let seats_left = (r.capacity - r.seats_booked).max(0);
        WeekendClass {
            age_range: dash_join(r.age_min, r.age_max),
            time_slot: dash_join(&r.start_time, &r.end_time),
            is_upcoming: is_upcoming(&r.date, &r.start_time),
            seats_left,
            is_full: seats_left == 0,
            id: r.id,
            title: r.title,
            description: r.description,
            location: r.location,
            image_url: r.image_url,
            age_min: r.age_min,
            age_max: r.age_max,
            date: r.date,
            start_time: r.start_time,
            end_time: r.end_time,
            fee_idr: r.fee_idr,
            capacity: r.capacity,
            seats_booked: r.seats_booked,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

pub const CLASS_SELECT: &str = "SELECT w.id, w.title, w.description, w.location, w.image_url, \
     w.age_min, w.age_max, w.date, w.start_time, w.end_time, w.fee_idr, w.capacity, \
     w.seats_booked, w.status, \
     strftime('%Y-%m-%dT%H:%M:%SZ', w.created_at) AS created_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', w.updated_at) AS updated_at \
     FROM weekend_classes w";

/// A non-deleted class row by id (any status).
pub async fn find_row<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<ClassRow>, sqlx::Error> {
    let sql = format!("{CLASS_SELECT} WHERE w.id = ? AND w.deleted_at IS NULL");
    sqlx::query_as::<_, ClassRow>(&sql)
        .bind(id)
        .fetch_optional(exec)
        .await
}

/// A non-deleted class by id (any status).
pub async fn find_live<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<WeekendClass>, sqlx::Error> {
    Ok(find_row(exec, id).await?.map(WeekendClass::from))
}

/// Publicly listable: not deleted, `OPEN`, upcoming; `ORDER BY date, start_time, id`.
pub async fn list_public<'e, E: SqliteExecutor<'e>>(
    exec: E,
) -> Result<Vec<WeekendClass>, sqlx::Error> {
    let sql = format!(
        "{CLASS_SELECT} WHERE w.deleted_at IS NULL AND w.status = 'OPEN' AND {} \
         ORDER BY w.date, w.start_time, w.id",
        upcoming_sql("w")
    );
    let rows = sqlx::query_as::<_, ClassRow>(&sql).fetch_all(exec).await?;
    Ok(rows.into_iter().map(WeekendClass::from).collect())
}

/// Admin list: every status and past classes, deleted excluded; newest first.
pub async fn list_admin<'e, E: SqliteExecutor<'e>>(
    exec: E,
    status: Option<&str>,
) -> Result<Vec<WeekendClass>, sqlx::Error> {
    let sql = format!(
        "{CLASS_SELECT} WHERE w.deleted_at IS NULL AND (?1 IS NULL OR w.status = ?1) \
         ORDER BY w.date DESC, w.start_time DESC, w.id DESC"
    );
    let rows = sqlx::query_as::<_, ClassRow>(&sql)
        .bind(status)
        .fetch_all(exec)
        .await?;
    Ok(rows.into_iter().map(WeekendClass::from).collect())
}

/// Count of `RESERVED` / `CONFIRMED` enrollments in a class.
pub async fn active_enrollments<'e, E: SqliteExecutor<'e>>(
    exec: E,
    class_id: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM class_enrollments
         WHERE class_id = ? AND status IN ('RESERVED', 'CONFIRMED')",
    )
    .bind(class_id)
    .fetch_one(exec)
    .await
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// Insert an OPEN class `days_ahead` days from today (WIB) at 09:30.
    pub async fn insert_class(
        pool: &sqlx::SqlitePool,
        title: &str,
        days_ahead: i64,
        capacity: i64,
    ) -> i64 {
        let date = (crate::helpers::today_wib() + chrono::Duration::days(days_ahead))
            .format("%Y-%m-%d")
            .to_string();
        sqlx::query_scalar(
            "INSERT INTO weekend_classes (title, description, location, age_min, age_max, date,
             start_time, end_time, fee_idr, capacity, status)
             VALUES (?, 'd', 'Rumah Teduh', 3, 6, ?, '09:30', '11:30', 200000, ?, 'OPEN') RETURNING id",
        )
        .bind(title)
        .bind(date)
        .bind(capacity)
        .fetch_one(pool)
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn computed_fields_and_listing_filters() {
        let pool = crate::testutil::pool().await;
        let future = insert_class(&pool, "Future", 10, 2).await;
        let past = insert_class(&pool, "Past", -10, 2).await;
        sqlx::query("UPDATE weekend_classes SET seats_booked = 2 WHERE id = ?")
            .bind(future)
            .execute(&pool)
            .await
            .unwrap();
        let class = find_live(&pool, future).await.unwrap().unwrap();
        assert_eq!(class.age_range, "3\u{2013}6");
        assert_eq!(class.time_slot, "09:30\u{2013}11:30");
        assert_eq!(class.seats_left, 0);
        assert!(class.is_full && class.is_upcoming);

        let public = list_public(&pool).await.unwrap();
        assert_eq!(
            public.iter().map(|c| c.id).collect::<Vec<_>>(),
            vec![future]
        );
        let admin = list_admin(&pool, None).await.unwrap();
        assert_eq!(
            admin.iter().map(|c| c.id).collect::<Vec<_>>(),
            vec![future, past]
        );
        assert!(list_admin(&pool, Some("DRAFT")).await.unwrap().is_empty());
        assert_eq!(active_enrollments(&pool, future).await.unwrap(), 0);
    }
}
