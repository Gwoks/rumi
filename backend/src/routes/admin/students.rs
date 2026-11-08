//! Students #35–#36, assessments #37 and attendance #38 (PRD §5.8.5, §5.9.5).

use axum::extract::State;
use axum::routing::{get, patch, post};
use axum::Router;
use serde_json::Value;

use crate::auth::AdminUser;
use crate::error::{created, ok, ApiError, ApiResult};
use crate::extract::{ApiJson, IdPath, QueryParams};
use crate::helpers::{parse_date, today_wib};
use crate::models::assessment::{self, ASSESSMENT_SPECS};
use crate::models::{child, class, enrollment, user};
use crate::routes::paginated;
use crate::services::report;
use crate::state::AppState;
use crate::validate::{body_object, change, parse_create, Errors, Reader, Rule, SqlValue};

const ATTENDANCE_TARGETS: [&str; 2] = ["ATTENDED", "ABSENT"];

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/students", get(list))
        .route("/api/admin/students/{id}", get(detail))
        .route("/api/admin/assessments", post(create_assessment))
        .route("/api/admin/enrollments/{id}", patch(mark_attendance))
}

/// #35 (paginated)
async fn list(State(state): State<AppState>, _admin: AdminUser, q: QueryParams) -> ApiResult {
    let errs = Errors::new();
    let search = q.search(&errs);
    let page = q.page(&errs);
    errs.finish()?;
    let (items, total) = report::student_page(&state.pool, search.as_deref(), page).await?;
    ok(paginated(items, page, total))
}

/// #36
async fn detail(State(state): State<AppState>, _admin: AdminUser, IdPath(id): IdPath) -> ApiResult {
    let child = child::find_active(&state.pool, id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let parent = user::find_any(&state.pool, child.parent_id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let report = report::child_report(&state.pool, child).await?;
    ok(report::student_detail(report, parent))
}

/// #37: the assessor is the calling admin.
async fn create_assessment(
    State(state): State<AppState>,
    AdminUser(admin): AdminUser,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let changes = parse_create(&r, &ASSESSMENT_SPECS);
    errs.finish()?;
    let child_id = change(&changes, "child_id")
        .and_then(SqlValue::as_int)
        .unwrap_or_default();
    if child::find_active(&state.pool, child_id).await?.is_none() {
        return Err(ApiError::not_found_msg("Data anak tidak ditemukan."));
    }
    if let Some(class_id) = change(&changes, "class_id").and_then(SqlValue::as_int) {
        if class::find_live(&state.pool, class_id).await?.is_none() {
            return Err(ApiError::not_found_msg("Kelas tidak ditemukan."));
        }
    }
    let with_assessor = changes
        .into_iter()
        .chain(std::iter::once(("assessor_id", SqlValue::Int(admin.id))))
        .collect();
    let id = crate::patch::insert(&state.pool, "student_assessments", &with_assessor).await?;
    created(
        assessment::find(&state.pool, id)
            .await?
            .ok_or_else(ApiError::internal)?,
    )
}

/// §5.9.5: may the enrollment move from `from` to `to` given the class date?
fn attendance_guard(from: &str, to: &str, class_date: &str) -> Result<(), ApiError> {
    if !matches!(from, "CONFIRMED" | "ATTENDED" | "ABSENT") {
        return Err(ApiError::invalid_transition(from, to));
    }
    let held = parse_date(class_date)
        .map(|d| d <= today_wib())
        .unwrap_or(false);
    if !held {
        return Err(ApiError::invalid_transition_msg(
            "Kehadiran hanya dapat dicatat pada atau setelah tanggal kelas.",
        ));
    }
    Ok(())
}

/// Compare-and-set `from` → `to` (§6.30): if another request changed the
/// enrollment since it was read, nothing is written and the answer is
/// `409 invalid_transition` instead of a silent success.
async fn set_attendance(
    pool: &sqlx::SqlitePool,
    id: i64,
    from: &str,
    to: &str,
) -> Result<(), ApiError> {
    let changed =
        sqlx::query("UPDATE class_enrollments SET status = ? WHERE id = ? AND status = ?")
            .bind(to)
            .bind(id)
            .bind(from)
            .execute(pool)
            .await?
            .rows_affected();
    if changed == 0 {
        return Err(ApiError::invalid_transition(from, to));
    }
    Ok(())
}

/// #38: `{ status: 'ATTENDED' | 'ABSENT' }`.
async fn mark_attendance(
    State(state): State<AppState>,
    _admin: AdminUser,
    IdPath(id): IdPath,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let to = r.req_string("status", Rule::Enum(&ATTENDANCE_TARGETS));
    errs.finish()?;
    let current = enrollment::find(&state.pool, id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    attendance_guard(&current.status, &to, &current.class_date)?;
    if current.status != to {
        set_attendance(&state.pool, id, &current.status, &to).await?;
    }
    ok(enrollment::find(&state.pool, id)
        .await?
        .ok_or_else(ApiError::not_found)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One enrollment (id 1) in `status` for a past class.
    async fn enrollment_in(status: &str) -> sqlx::SqlitePool {
        let pool = crate::testutil::pool().await;
        let statements = [
            "INSERT INTO users (id, email, password_hash, full_name, phone_wa)
             VALUES (1, 'p@x.co', 'h', 'P', '6281211112222')",
            "INSERT INTO children (id, parent_id, name, dob) VALUES (1, 1, 'A', '2021-01-01')",
            "INSERT INTO weekend_classes (id, title, description, location, age_min, age_max, date,
             start_time, end_time, fee_idr, capacity, seats_booked, status)
             VALUES (1, 'K', 'd', 'L', 3, 6, '2020-01-01', '09:30', '11:30', 0, 12, 1, 'CLOSED')",
            "INSERT INTO orders (id, order_code, parent_id, total_amount_idr, delivery_name,
             delivery_phone, wa_message_payload, idempotency_key)
             VALUES (1, 'RUMI-2020-0001', 1, 0, 'N', '6281211112222', 'm', 'k1')",
            "INSERT INTO order_items (id, order_id, item_type, class_id, child_id, name_snapshot,
             unit_price_idr, quantity, line_total_idr) VALUES (1, 1, 'CLASS', 1, 1, 'K', 0, 1, 0)",
        ];
        for sql in statements {
            sqlx::query(sql).execute(&pool).await.unwrap();
        }
        sqlx::query(
            "INSERT INTO class_enrollments (id, class_id, child_id, order_item_id, status)
             VALUES (1, 1, 1, 1, ?)",
        )
        .bind(status)
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn attendance_update_is_a_compare_and_set() {
        let pool = enrollment_in("CONFIRMED").await;
        set_attendance(&pool, 1, "CONFIRMED", "ATTENDED")
            .await
            .unwrap();
        let now = enrollment::find(&pool, 1).await.unwrap().unwrap();
        assert_eq!(now.status, "ATTENDED");
        // A stale read (the row changed meanwhile) must not report success.
        let stale = set_attendance(&pool, 1, "CONFIRMED", "ABSENT")
            .await
            .unwrap_err();
        assert_eq!(stale.code, "invalid_transition");
        let still = enrollment::find(&pool, 1).await.unwrap().unwrap();
        assert_eq!(still.status, "ATTENDED");
    }

    #[tokio::test]
    async fn a_cancelled_enrollment_is_never_overwritten() {
        let pool = enrollment_in("CANCELLED").await;
        let err = set_attendance(&pool, 1, "CONFIRMED", "ATTENDED")
            .await
            .unwrap_err();
        assert_eq!(err.code, "invalid_transition");
    }

    #[test]
    fn attendance_rules() {
        let past = "2020-01-01";
        let future = (today_wib() + chrono::Duration::days(3))
            .format("%Y-%m-%d")
            .to_string();
        assert!(attendance_guard("CONFIRMED", "ATTENDED", past).is_ok());
        assert!(attendance_guard("ABSENT", "ATTENDED", past).is_ok());
        assert_eq!(
            attendance_guard("RESERVED", "ATTENDED", past)
                .unwrap_err()
                .code,
            "invalid_transition"
        );
        assert_eq!(
            attendance_guard("CANCELLED", "ABSENT", past)
                .unwrap_err()
                .code,
            "invalid_transition"
        );
        let err = attendance_guard("CONFIRMED", "ATTENDED", &future).unwrap_err();
        assert!(err.message.contains("tanggal kelas"));
    }
}
