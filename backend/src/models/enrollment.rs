//! `class_enrollments` (PRD §5.6 `Enrollment`).

use serde::Serialize;
use sqlx::SqliteExecutor;

use crate::helpers::dash_join;

#[derive(Debug, Clone, sqlx::FromRow)]
struct EnrollmentRow {
    id: i64,
    class_id: i64,
    class_title: String,
    class_date: String,
    start_time: String,
    end_time: String,
    class_location: String,
    child_id: i64,
    child_name: String,
    order_id: Option<i64>,
    order_code: Option<String>,
    status: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Enrollment {
    pub id: i64,
    pub class_id: i64,
    pub class_title: String,
    pub class_date: String,
    pub class_time_slot: String,
    pub class_location: String,
    pub child_id: i64,
    pub child_name: String,
    pub order_id: Option<i64>,
    pub order_code: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<EnrollmentRow> for Enrollment {
    fn from(r: EnrollmentRow) -> Self {
        Enrollment {
            class_time_slot: dash_join(&r.start_time, &r.end_time),
            id: r.id,
            class_id: r.class_id,
            class_title: r.class_title,
            class_date: r.class_date,
            class_location: r.class_location,
            child_id: r.child_id,
            child_name: r.child_name,
            order_id: r.order_id,
            order_code: r.order_code,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

const ENROLLMENT_SELECT: &str = "SELECT e.id, e.class_id, w.title AS class_title, \
     w.date AS class_date, w.start_time, w.end_time, w.location AS class_location, \
     e.child_id, ch.name AS child_name, oi.order_id, o.order_code, e.status, \
     strftime('%Y-%m-%dT%H:%M:%SZ', e.created_at) AS created_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', e.updated_at) AS updated_at \
     FROM class_enrollments e \
     JOIN weekend_classes w ON w.id = e.class_id \
     JOIN children ch ON ch.id = e.child_id \
     LEFT JOIN order_items oi ON oi.id = e.order_item_id \
     LEFT JOIN orders o ON o.id = oi.order_id";

/// All of a child's enrollments, `ORDER BY class_date DESC, start_time DESC, id DESC`.
pub async fn list_for_child<'e, E: SqliteExecutor<'e>>(
    exec: E,
    child_id: i64,
) -> Result<Vec<Enrollment>, sqlx::Error> {
    let sql = format!(
        "{ENROLLMENT_SELECT} WHERE e.child_id = ? \
         ORDER BY w.date DESC, w.start_time DESC, e.id DESC"
    );
    let rows = sqlx::query_as::<_, EnrollmentRow>(&sql)
        .bind(child_id)
        .fetch_all(exec)
        .await?;
    Ok(rows.into_iter().map(Enrollment::from).collect())
}

pub async fn find<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<Enrollment>, sqlx::Error> {
    let sql = format!("{ENROLLMENT_SELECT} WHERE e.id = ?");
    let row = sqlx::query_as::<_, EnrollmentRow>(&sql)
        .bind(id)
        .fetch_optional(exec)
        .await?;
    Ok(row.map(Enrollment::from))
}
