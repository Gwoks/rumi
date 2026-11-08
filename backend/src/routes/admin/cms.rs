//! CMS CRUD #23–#26 over the fixed registry (PRD §5.7).

use axum::extract::State;
use axum::routing::{get, patch};
use axum::Router;
use serde_json::Value;

use crate::auth::AdminUser;
use crate::error::{created, ok, ApiError, ApiResult};
use crate::extract::{ApiJson, IdPath, QueryParams};
use crate::models::cms::{self, CMS_SPECS};
use crate::models::cms_schema::{is_page, shape_for, validate_body, PAGES};
use crate::state::AppState;
use crate::validate::{
    body_object, parse_create, parse_patch, Changes, Errors, Reader, SqlValue, MSG_NOT_NULL,
    MSG_NO_CHANGES, MSG_REQUIRED,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/cms", get(list).post(create))
        .route("/api/admin/cms/{id}", patch(update).delete(remove))
}

/// #23: optional `page_slug` filter (must be a registry page).
async fn list(State(state): State<AppState>, _admin: AdminUser, q: QueryParams) -> ApiResult {
    let errs = Errors::new();
    let page = q.one_of("page_slug", &PAGES, &errs);
    errs.finish()?;
    ok(cms::admin_list(&state.pool, page).await?)
}

/// Validate `body` against the pair's shape → the `body_json` change.
fn body_change(
    r: &Reader<'_>,
    page_slug: &str,
    section_key: &str,
    errs: &Errors,
) -> Option<(&'static str, SqlValue)> {
    let raw = r.raw("body")?;
    if raw.is_null() {
        errs.add("body", MSG_NOT_NULL);
        return None;
    }
    let shape = shape_for(page_slug, section_key)?;
    let normalized = validate_body(shape, raw, errs)?;
    Some(("body_json", SqlValue::Text(normalized.to_string())))
}

fn registry_pair(r: &Reader<'_>, errs: &Errors) -> Option<(String, String)> {
    let page = r
        .raw("page_slug")
        .and_then(Value::as_str)
        .filter(|p| is_page(p));
    let key = r.raw("section_key").and_then(Value::as_str);
    match (page, key) {
        (None, _) => errs.add("page_slug", "Halaman tidak dikenal."),
        (Some(_), None) => errs.add("section_key", MSG_REQUIRED),
        (Some(p), Some(k)) if shape_for(p, k).is_some() => {
            return Some((p.to_string(), k.to_string()))
        }
        (Some(_), Some(_)) => errs.add("section_key", "Bagian tidak dikenal untuk halaman ini."),
    }
    None
}

/// #24: a live row with the same pair → `409 conflict`.
async fn create(
    State(state): State<AppState>,
    _admin: AdminUser,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    let pair = registry_pair(&r, &errs);
    let fields = parse_create(&r, &CMS_SPECS);
    if !r.has("body") {
        errs.add("body", MSG_REQUIRED);
    }
    let body_json = pair
        .as_ref()
        .and_then(|(p, k)| body_change(&r, p, k, &errs));
    errs.finish()?;
    let (page_slug, section_key) = pair.ok_or_else(ApiError::internal)?;
    if cms::pair_exists(&state.pool, &page_slug, &section_key).await? {
        return Err(ApiError::conflict(
            "Bagian ini sudah ada. Ubah bagian yang ada.",
        ));
    }
    let changes: Changes = fields
        .into_iter()
        .chain(body_json)
        .chain([
            ("page_slug", SqlValue::Text(page_slug)),
            ("section_key", SqlValue::Text(section_key)),
        ])
        .collect();
    let id = crate::patch::insert(&state.pool, "cms_content", &changes).await?;
    created(
        cms::find(&state.pool, id)
            .await?
            .ok_or_else(ApiError::internal)?,
    )
}

/// #25: `body` is validated against the row's own pair.
async fn update(
    State(state): State<AppState>,
    _admin: AdminUser,
    IdPath(id): IdPath,
    ApiJson(body): ApiJson<Value>,
) -> ApiResult {
    let row = cms::find(&state.pool, id)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let errs = Errors::new();
    let r = Reader::new(body_object(&body)?, &errs);
    if !r.has("body") && !CMS_SPECS.iter().any(|s| r.has(s.key)) {
        return Err(ApiError::validation(MSG_NO_CHANGES));
    }
    let body_json = body_change(&r, &row.page_slug, &row.section_key, &errs);
    let changes: Changes = parse_patch(&r, &CMS_SPECS)
        .into_iter()
        .chain(body_json)
        .collect();
    errs.finish()?;
    crate::patch::update(&state.pool, "cms_content", id, &changes).await?;
    ok(cms::find(&state.pool, id)
        .await?
        .ok_or_else(ApiError::not_found)?)
}

/// #26: soft delete; the pair can be created again afterwards.
async fn remove(State(state): State<AppState>, _admin: AdminUser, IdPath(id): IdPath) -> ApiResult {
    match crate::patch::soft_delete(&state.pool, "cms_content", id).await? {
        0 => Err(ApiError::not_found()),
        _ => ok(()),
    }
}
