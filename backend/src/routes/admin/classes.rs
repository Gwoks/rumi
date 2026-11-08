//! Class CRUD #27–#30 (PRD §5.8.5) with soft delete and the active-enrollment
//! 409 rules from §6 #13. PATCH runs in one `BEGIN IMMEDIATE` transaction so the
//! capacity check cannot race a concurrent checkout.

use axum::extract::State;
use axum::routing::{get, patch};
use axum::Router;
use serde_json::Value;

use crate::auth::AdminUser;
use crate::error::{created, ok, ApiError, ApiResult};
use crate::extract::{ApiJson, IdPath, QueryParams};
use crate::helpers::is_upcoming;
use crate::models::class::{self, ClassRow, CLASS_SPECS};
use crate::models::CLASS_STATUSES;
use crate::state::AppState;
use crate::validate::{
    body_object, change, ensure_any_known, parse_create, parse_patch, Changes, Errors, Reader,
    SqlValue,
};

const ACTIVE_ENROLLMENTS: &str = "Batalkan pesanan terkait terlebih dahulu.";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/classes", get(list).post(create))
        .route("/api/admin/classes/{id}", patch(update).delete(remove))
}

/// The values a class would have after applying `changes` to `base`.
struct Merged {
    age_min: i64,
    age_max: i64,
    date: String,
    start_time: String,
    end_time: String,
    capacity: i64,
}

fn merged(changes: &Changes, base: Option<&ClassRow>) -> Merged {
    let int = |key: &str, fallback: i64| {
        change(changes, key)
            .and_then(SqlValue::as_int)
            .unwrap_or(fallback)
    };
    let text = |key: &str, fallback: &str| {
        change(changes, key)
            .and_then(SqlValue::as_text)
            .unwrap_or(fallback)
            .to_string()
    };
    Merged {
        age_min: int("age_min", base.map(|b| b.age_min).unwrap_or_default()),
        age_max: int("age_max", base.map(|b| b.age_max).unwrap_or_default()),
        date: text("date", base.map(|b| b.date.as_str()).unwrap_or_default()),
        start_time: text(
            "start_time",
            base.map(|b| b.start_time.as_str()).unwrap_or_default(),
        ),
        end_time: text(
            "end_time",
            base.map(|b| b.end_time.as_str()).unwrap_or_default(),
        ),
        capacity: int("capacity", base.map(|b| b.capacity).unwrap_or(1)),
    }
}

/// Cross-field rules shared by create and PATCH.
fn check_rules(m: &Merged, check_start: bool, seats_booked: i64, errs: &Errors) {
    if m.age_max < m.age_min {
        errs.add("age_max", "Usia maksimal harus ≥ usia minimal.");
    }
    if m.end_time <= m.start_time {
        errs.add("end_time", "Jam selesai harus setelah jam mulai.");
    }
    if check_start && !is_upcoming(&m.date, &m.start_time) {
        errs.add("date", "Jadwal kelas harus di masa depan.");
    }
    if m.capacity < seats_booked {
        errs.add(
            "capacity",
            format!("Kapasitas tidak boleh kurang dari kursi terisi ({seats_booked})."),
        );
    }
}

/// #27: every status and past classes; optional `status` filter.
async fn list(State(state): State<AppState>, _admin: AdminUser, q: QueryParams) -> ApiResult {
    let errs = Errors::new();
    let status = q.one_of("status", &CLASS_STATUSES, &errs);
    errs.finish()?;
    ok(class::list_admin(&state.pool, status).await?)
}

/// #28: the class start must be upcoming.
async fn create(
    State(state): State<AppState>,
    _admin: AdminUser,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let changes = parse_create(&r, &CLASS_SPECS);
    errs.finish()?;
    check_rules(&merged(&changes, None), true, 0, &errs);
    errs.finish()?;
    let id = crate::patch::insert(&state.pool, "weekend_classes", &changes).await?;
    created(
        class::find_live(&state.pool, id)
            .await?
            .ok_or_else(ApiError::internal)?,
    )
}

fn deactivates(changes: &Changes) -> bool {
    matches!(
        change(changes, "status").and_then(SqlValue::as_text),
        Some("CANCELLED" | "DRAFT")
    )
}

/// #29
async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    IdPath(id): IdPath,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let mut tx = crate::db::begin_immediate(&state.pool).await?;
    let row = class::find_row(&mut *tx, id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    ensure_any_known(&r, &CLASS_SPECS)?;
    let changes = parse_patch(&r, &CLASS_SPECS);
    errs.finish()?;
    let reschedules = r.has("date") || r.has("start_time");
    check_rules(
        &merged(&changes, Some(&row)),
        reschedules,
        row.seats_booked,
        &errs,
    );
    errs.finish()?;
    if deactivates(&changes) && class::active_enrollments(&mut *tx, id).await? > 0 {
        return Err(ApiError::conflict(ACTIVE_ENROLLMENTS));
    }
    crate::patch::update(&mut *tx, "weekend_classes", id, &changes).await?;
    tx.commit().await?;
    ok(class::find_live(&state.pool, id)
        .await?
        .ok_or_else(ApiError::not_found)?)
}

/// #30: soft delete, blocked while RESERVED/CONFIRMED enrollments exist.
async fn remove(State(state): State<AppState>, _admin: AdminUser, IdPath(id): IdPath) -> ApiResult {
    let mut tx = crate::db::begin_immediate(&state.pool).await?;
    class::find_row(&mut *tx, id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    if class::active_enrollments(&mut *tx, id).await? > 0 {
        return Err(ApiError::conflict(ACTIVE_ENROLLMENTS));
    }
    crate::patch::soft_delete(&mut *tx, "weekend_classes", id).await?;
    tx.commit().await?;
    ok(())
}
