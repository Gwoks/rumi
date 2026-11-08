//! `play_kits` (PRD §5.6 `PlayKit`, §5.8.5 `KitCreate`/`KitPatch`).

use serde::Serialize;
use sqlx::SqliteExecutor;

use crate::models::DOMAINS;
use crate::validate::{FieldSpec, Rule};

const fn spec(key: &'static str, rule: Rule, required: bool, nullable: bool) -> FieldSpec {
    FieldSpec {
        key,
        rule,
        required,
        nullable,
    }
}

/// `KitCreate` rules; `KitPatch` = the same fields, all optional.
pub const KIT_SPECS: [FieldSpec; 8] = [
    spec("name", Rule::Text { min: 2, max: 120 }, true, false),
    spec("category", Rule::Enum(&DOMAINS), true, false),
    spec("description", Rule::Text { min: 1, max: 2000 }, true, false),
    spec("image_url", Rule::ImageUrl, false, true),
    spec(
        "price_idr",
        Rule::Int {
            min: 0,
            max: 100_000_000,
        },
        true,
        false,
    ),
    spec(
        "stock",
        Rule::Int {
            min: 0,
            max: 100_000,
        },
        true,
        false,
    ),
    spec("badge_tag", Rule::Text { min: 0, max: 24 }, false, true),
    spec("is_active", Rule::Bool, false, false),
];

#[derive(Debug, Clone, Serialize, sqlx::FromRow, PartialEq, Eq)]
pub struct PlayKit {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub description: String,
    pub image_url: Option<String>,
    pub price_idr: i64,
    pub stock: i64,
    pub badge_tag: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

const KIT_SELECT: &str = "SELECT k.id, k.name, k.category, k.description, k.image_url, \
     k.price_idr, k.stock, k.badge_tag, k.is_active, \
     strftime('%Y-%m-%dT%H:%M:%SZ', k.created_at) AS created_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', k.updated_at) AS updated_at \
     FROM play_kits k";

/// Kits ordered `created_at DESC, id DESC`, optionally by category; public
/// lists only active kits (out-of-stock included).
pub async fn list<'e, E: SqliteExecutor<'e>>(
    exec: E,
    category: Option<&str>,
    active_only: bool,
) -> Result<Vec<PlayKit>, sqlx::Error> {
    let sql = format!(
        "{KIT_SELECT} WHERE k.deleted_at IS NULL AND (?1 IS NULL OR k.category = ?1) \
         AND (?2 = 0 OR k.is_active = 1) ORDER BY k.created_at DESC, k.id DESC"
    );
    sqlx::query_as::<_, PlayKit>(&sql)
        .bind(category)
        .bind(i64::from(active_only))
        .fetch_all(exec)
        .await
}

/// A non-deleted kit by id; `active_only` also hides inactive kits.
pub async fn find<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
    active_only: bool,
) -> Result<Option<PlayKit>, sqlx::Error> {
    let sql = format!(
        "{KIT_SELECT} WHERE k.id = ? AND k.deleted_at IS NULL AND (? = 0 OR k.is_active = 1)"
    );
    sqlx::query_as::<_, PlayKit>(&sql)
        .bind(id)
        .bind(i64::from(active_only))
        .fetch_optional(exec)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn public_lists_hide_inactive_and_deleted() {
        let pool = crate::testutil::pool().await;
        for (name, active, deleted) in [("A", 1, false), ("B", 0, false), ("C", 1, true)] {
            sqlx::query(
                "INSERT INTO play_kits (name, category, description, price_idr, stock, is_active, deleted_at)
                 VALUES (?, 'MATH', 'd', 1000, 0, ?, CASE WHEN ? THEN datetime('now') END)",
            )
            .bind(name)
            .bind(active)
            .bind(deleted)
            .execute(&pool)
            .await
            .unwrap();
        }
        let public: Vec<String> = list(&pool, None, true)
            .await
            .unwrap()
            .into_iter()
            .map(|k| k.name)
            .collect();
        assert_eq!(public, vec!["A"]);
        let admin: Vec<String> = list(&pool, None, false)
            .await
            .unwrap()
            .into_iter()
            .map(|k| k.name)
            .collect();
        assert_eq!(admin, vec!["B", "A"]);
        assert!(list(&pool, Some("SENSORIAL"), false)
            .await
            .unwrap()
            .is_empty());
        assert!(find(&pool, 2, true).await.unwrap().is_none());
        assert!(find(&pool, 2, false).await.unwrap().is_some());
        assert!(find(&pool, 3, false).await.unwrap().is_none());
    }
}
