//! `cms_content` (PRD §5.6 `CmsSection` / `CmsPage`, §5.8.5 #23–#26).

use serde::Serialize;
use serde_json::Value;
use sqlx::SqliteExecutor;

use crate::validate::{FieldSpec, Rule};

/// Plain columns accepted by `CmsCreate` / `CmsPatch` (`body` is validated
/// separately against the registry shape; slug and key are immutable).
pub const CMS_SPECS: [FieldSpec; 4] = [
    FieldSpec {
        key: "title",
        rule: Rule::Text { min: 0, max: 120 },
        required: false,
        nullable: true,
    },
    FieldSpec {
        key: "image_url",
        rule: Rule::ImageUrl,
        required: false,
        nullable: true,
    },
    FieldSpec {
        key: "sort_order",
        rule: Rule::Int {
            min: -1000,
            max: 1000,
        },
        required: false,
        nullable: false,
    },
    FieldSpec {
        key: "is_active",
        rule: Rule::Bool,
        required: false,
        nullable: false,
    },
];

#[derive(Debug, Clone, sqlx::FromRow)]
struct CmsRow {
    id: i64,
    page_slug: String,
    section_key: String,
    title: Option<String>,
    body_json: String,
    image_url: Option<String>,
    sort_order: i64,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct CmsSection {
    pub id: i64,
    pub page_slug: String,
    pub section_key: String,
    pub title: Option<String>,
    pub body: Value,
    pub image_url: Option<String>,
    pub sort_order: i64,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CmsRow> for CmsSection {
    fn from(r: CmsRow) -> Self {
        CmsSection {
            body: serde_json::from_str(&r.body_json).unwrap_or(Value::Null),
            id: r.id,
            page_slug: r.page_slug,
            section_key: r.section_key,
            title: r.title,
            image_url: r.image_url,
            sort_order: r.sort_order,
            is_active: r.is_active,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CmsPage {
    pub page_slug: String,
    pub sections: Vec<CmsSection>,
}

const CMS_SELECT: &str = "SELECT c.id, c.page_slug, c.section_key, c.title, c.body_json, \
     c.image_url, c.sort_order, c.is_active, \
     strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) AS created_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', c.updated_at) AS updated_at \
     FROM cms_content c";

/// Active, non-deleted sections of a page, `ORDER BY sort_order, id` (#2).
pub async fn public_sections<'e, E: SqliteExecutor<'e>>(
    exec: E,
    page_slug: &str,
) -> Result<Vec<CmsSection>, sqlx::Error> {
    let sql = format!(
        "{CMS_SELECT} WHERE c.page_slug = ? AND c.is_active = 1 AND c.deleted_at IS NULL \
         ORDER BY c.sort_order, c.id"
    );
    let rows = sqlx::query_as::<_, CmsRow>(&sql)
        .bind(page_slug)
        .fetch_all(exec)
        .await?;
    Ok(rows.into_iter().map(CmsSection::from).collect())
}

/// Admin list: inactive included, deleted excluded, `ORDER BY page_slug, sort_order, id` (#23).
pub async fn admin_list<'e, E: SqliteExecutor<'e>>(
    exec: E,
    page_slug: Option<&str>,
) -> Result<Vec<CmsSection>, sqlx::Error> {
    let sql = format!(
        "{CMS_SELECT} WHERE c.deleted_at IS NULL AND (?1 IS NULL OR c.page_slug = ?1) \
         ORDER BY c.page_slug, c.sort_order, c.id"
    );
    let rows = sqlx::query_as::<_, CmsRow>(&sql)
        .bind(page_slug)
        .fetch_all(exec)
        .await?;
    Ok(rows.into_iter().map(CmsSection::from).collect())
}

/// A non-deleted section by id.
pub async fn find<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<CmsSection>, sqlx::Error> {
    let sql = format!("{CMS_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL");
    let row = sqlx::query_as::<_, CmsRow>(&sql)
        .bind(id)
        .fetch_optional(exec)
        .await?;
    Ok(row.map(CmsSection::from))
}

/// Is there a live row for this `(page_slug, section_key)` pair?
pub async fn pair_exists<'e, E: SqliteExecutor<'e>>(
    exec: E,
    page_slug: &str,
    section_key: &str,
) -> Result<bool, sqlx::Error> {
    let found: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM cms_content WHERE page_slug = ? AND section_key = ? AND deleted_at IS NULL",
    )
    .bind(page_slug)
    .bind(section_key)
    .fetch_optional(exec)
    .await?;
    Ok(found.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn public_vs_admin_visibility() {
        let pool = crate::testutil::pool().await;
        for (key, active, order) in [("hero", 1, 20), ("rumi_way", 0, 10)] {
            sqlx::query(
                "INSERT INTO cms_content (page_slug, section_key, body_json, is_active, sort_order)
                 VALUES ('home', ?, '{\"a\":1}', ?, ?)",
            )
            .bind(key)
            .bind(active)
            .bind(order)
            .execute(&pool)
            .await
            .unwrap();
        }
        let public = public_sections(&pool, "home").await.unwrap();
        assert_eq!(public.len(), 1);
        assert_eq!(public[0].body["a"], 1);
        let admin = admin_list(&pool, Some("home")).await.unwrap();
        assert_eq!(admin[0].section_key, "rumi_way");
        assert!(admin_list(&pool, Some("who-we-are"))
            .await
            .unwrap()
            .is_empty());
        assert!(pair_exists(&pool, "home", "hero").await.unwrap());
        assert!(find(&pool, admin[0].id).await.unwrap().is_some());
    }
}
