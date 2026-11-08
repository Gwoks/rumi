//! Public catalog and CMS endpoints #2–#6 (PRD §5.8.2).

use axum::extract::State;
use axum::routing::get;
use axum::Router;
use serde::Serialize;

use crate::error::{ok, ApiError, ApiResult};
use crate::extract::{IdPath, QueryParams, SlugPath};
use crate::models::class::{self, WeekendClass};
use crate::models::cms::{self, CmsPage};
use crate::models::cms_schema::is_page;
use crate::models::{kit, DOMAINS};
use crate::state::AppState;
use crate::validate::Errors;

const LOCATION_MAX: usize = 160;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/cms/{page_slug}", get(cms_page))
        .route("/api/classes", get(list_classes))
        .route("/api/classes/{id}", get(get_class))
        .route("/api/kits", get(list_kits))
        .route("/api/kits/{id}", get(get_kit))
}

/// #2: active sections of a registry page.
async fn cms_page(State(state): State<AppState>, SlugPath(slug): SlugPath) -> ApiResult {
    if !is_page(&slug) {
        return Err(ApiError::not_found());
    }
    let sections = cms::public_sections(&state.pool, &slug).await?;
    ok(CmsPage {
        page_slug: slug,
        sections,
    })
}

#[derive(Serialize)]
struct ClassList {
    items: Vec<WeekendClass>,
    locations: Vec<String>,
}

struct ClassFilter {
    location: Option<String>,
    from: Option<chrono::NaiveDate>,
    to: Option<chrono::NaiveDate>,
    age: Option<i64>,
}

fn parse_class_filter(q: &QueryParams) -> Result<ClassFilter, ApiError> {
    let errs = Errors::new();
    let filter = ClassFilter {
        location: q.text_max("location", LOCATION_MAX, &errs),
        from: q.date("from", &errs),
        to: q.date("to", &errs),
        age: q.int("age", 0, 12, &errs),
    };
    if let (Some(from), Some(to)) = (filter.from, filter.to) {
        if from > to {
            errs.add("to", "Tanggal akhir tidak boleh sebelum tanggal awal.");
        }
    }
    errs.finish()?;
    Ok(filter)
}

fn matches(c: &WeekendClass, f: &ClassFilter) -> bool {
    let date = crate::helpers::parse_date(&c.date);
    f.location
        .as_ref()
        .map(|l| c.location.to_lowercase() == l.to_lowercase())
        .unwrap_or(true)
        && f.from
            .map(|from| date.map(|d| d >= from).unwrap_or(false))
            .unwrap_or(true)
        && f.to
            .map(|to| date.map(|d| d <= to).unwrap_or(false))
            .unwrap_or(true)
        && f.age
            .map(|a| c.age_min <= a && a <= c.age_max)
            .unwrap_or(true)
}

/// Distinct locations of every listable class, sorted case-insensitively.
fn locations(all: &[WeekendClass]) -> Vec<String> {
    let mut unique: Vec<String> = all.iter().map(|c| c.location.clone()).collect();
    unique.sort_by(|a, b| {
        a.to_lowercase()
            .cmp(&b.to_lowercase())
            .then_with(|| a.cmp(b))
    });
    unique.dedup();
    unique
}

/// #3: OPEN, upcoming, non-deleted classes + the `locations` facet.
async fn list_classes(State(state): State<AppState>, q: QueryParams) -> ApiResult {
    let filter = parse_class_filter(&q)?;
    let all = class::list_public(&state.pool).await?;
    let facet = locations(&all);
    let items = all.into_iter().filter(|c| matches(c, &filter)).collect();
    ok(ClassList {
        items,
        locations: facet,
    })
}

/// #4: any non-deleted, non-DRAFT class (past and cancelled included).
async fn get_class(State(state): State<AppState>, IdPath(id): IdPath) -> ApiResult {
    let found = class::find_live(&state.pool, id).await?;
    match found.filter(|c| c.status != "DRAFT") {
        Some(c) => ok(c),
        None => Err(ApiError::not_found()),
    }
}

/// #5: active kits (out-of-stock included), optional `category`.
async fn list_kits(State(state): State<AppState>, q: QueryParams) -> ApiResult {
    let errs = Errors::new();
    let category = q.one_of("category", &DOMAINS, &errs);
    errs.finish()?;
    ok(kit::list(&state.pool, category, true).await?)
}

/// #6
async fn get_kit(State(state): State<AppState>, IdPath(id): IdPath) -> ApiResult {
    kit::find(&state.pool, id, true)
        .await?
        .map_or_else(|| Err(ApiError::not_found()), ok)
}
