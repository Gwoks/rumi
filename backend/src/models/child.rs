//! `children` (PRD §5.6 `Child`, §5.8.4 `ChildInput` / `ChildPatch`).

use serde::Serialize;
use sqlx::SqliteExecutor;

use crate::helpers::{age_years, parse_date, today_wib};
use crate::validate::{Changes, FieldSpec, Rule, SqlValue};

/// `ChildInput` rules; `ChildPatch` uses the same list (§5.8.4).
pub const CHILD_SPECS: [FieldSpec; 3] = [
    FieldSpec {
        key: "name",
        rule: Rule::Text { min: 1, max: 80 },
        required: true,
        nullable: false,
    },
    FieldSpec {
        key: "dob",
        rule: Rule::Dob,
        required: true,
        nullable: false,
    },
    FieldSpec {
        key: "notes",
        rule: Rule::Text { min: 0, max: 500 },
        required: false,
        nullable: true,
    },
];

#[derive(Debug, Clone, sqlx::FromRow)]
struct ChildRow {
    id: i64,
    parent_id: i64,
    name: String,
    dob: String,
    notes: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Child {
    pub id: i64,
    pub parent_id: i64,
    pub name: String,
    pub dob: String,
    pub age_years: i64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ChildRow> for Child {
    fn from(row: ChildRow) -> Self {
        let age = parse_date(&row.dob)
            .map(|dob| age_years(dob, today_wib()))
            .unwrap_or_default();
        Child {
            id: row.id,
            parent_id: row.parent_id,
            name: row.name,
            dob: row.dob,
            age_years: age,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

const CHILD_SELECT: &str = "SELECT c.id, c.parent_id, c.name, c.dob, c.notes, \
     strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) AS created_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', c.updated_at) AS updated_at \
     FROM children c";

/// The parent's live children, `ORDER BY created_at ASC, id ASC` (§5.8.4 #13).
pub async fn list_for_parent<'e, E: SqliteExecutor<'e>>(
    exec: E,
    parent_id: i64,
) -> Result<Vec<Child>, sqlx::Error> {
    let sql = format!(
        "{CHILD_SELECT} WHERE c.parent_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at, c.id"
    );
    let rows = sqlx::query_as::<_, ChildRow>(&sql)
        .bind(parent_id)
        .fetch_all(exec)
        .await?;
    Ok(rows.into_iter().map(Child::from).collect())
}

/// A live child owned by `parent_id` (absent, deleted and foreign look the same).
pub async fn find_owned<'e, E: SqliteExecutor<'e>>(
    exec: E,
    parent_id: i64,
    child_id: i64,
) -> Result<Option<Child>, sqlx::Error> {
    let sql = format!("{CHILD_SELECT} WHERE c.id = ? AND c.parent_id = ? AND c.deleted_at IS NULL");
    let row = sqlx::query_as::<_, ChildRow>(&sql)
        .bind(child_id)
        .bind(parent_id)
        .fetch_optional(exec)
        .await?;
    Ok(row.map(Child::from))
}

/// A live child by id (admin views).
pub async fn find_active<'e, E: SqliteExecutor<'e>>(
    exec: E,
    child_id: i64,
) -> Result<Option<Child>, sqlx::Error> {
    let sql = format!("{CHILD_SELECT} WHERE c.id = ? AND c.deleted_at IS NULL");
    let row = sqlx::query_as::<_, ChildRow>(&sql)
        .bind(child_id)
        .fetch_optional(exec)
        .await?;
    Ok(row.map(Child::from))
}

/// Insert a child for `parent_id` from validated `CHILD_SPECS` changes.
pub async fn insert<'e, E: SqliteExecutor<'e>>(
    exec: E,
    parent_id: i64,
    changes: &Changes,
) -> Result<i64, sqlx::Error> {
    let with_parent: Changes = changes
        .iter()
        .cloned()
        .chain(std::iter::once(("parent_id", SqlValue::Int(parent_id))))
        .collect();
    crate::patch::insert(exec, "children", &with_parent).await
}

/// Does the child hold a `RESERVED` or `CONFIRMED` enrollment?
pub async fn has_active_enrollments<'e, E: SqliteExecutor<'e>>(
    exec: E,
    child_id: i64,
) -> Result<bool, sqlx::Error> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM class_enrollments
         WHERE child_id = ? AND status IN ('RESERVED', 'CONFIRMED')",
    )
    .bind(child_id)
    .fetch_one(exec)
    .await?;
    Ok(n > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn parent(pool: &sqlx::SqlitePool, email: &str) -> i64 {
        sqlx::query_scalar(
            "INSERT INTO users (email, password_hash, full_name, phone_wa)
             VALUES (?, 'h', 'P', '6281211112222') RETURNING id",
        )
        .bind(email)
        .fetch_one(pool)
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn ownership_and_age() {
        let pool = crate::testutil::pool().await;
        let a = parent(&pool, "a@x.co").await;
        let b = parent(&pool, "b@x.co").await;
        let changes: Changes = vec![
            ("name", SqlValue::Text("Amina".into())),
            ("dob", SqlValue::Text("2020-04-15".into())),
        ];
        let id = insert(&pool, a, &changes).await.unwrap();
        let child = find_owned(&pool, a, id).await.unwrap().unwrap();
        assert_eq!(child.name, "Amina");
        assert_eq!(child.notes, None);
        assert_eq!(
            child.age_years,
            age_years(parse_date("2020-04-15").unwrap(), today_wib())
        );
        assert!(find_owned(&pool, b, id).await.unwrap().is_none());
        assert!(find_active(&pool, id).await.unwrap().is_some());
        assert_eq!(list_for_parent(&pool, a).await.unwrap().len(), 1);
        assert!(list_for_parent(&pool, b).await.unwrap().is_empty());
        assert!(!has_active_enrollments(&pool, id).await.unwrap());
    }
}
