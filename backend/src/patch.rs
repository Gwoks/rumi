//! Allow-listed INSERT/UPDATE builders (hookbox `routes/api.rs` PATCH pattern).
//!
//! Only `&'static str` column names from the per-resource `FieldSpec` lists are
//! concatenated into SQL; every value is a bind parameter.

use sqlx::sqlite::SqliteArguments;
use sqlx::{Sqlite, SqliteExecutor};

use crate::validate::{Changes, SqlValue};

type Query<'q> = sqlx::query::Query<'q, Sqlite, SqliteArguments<'q>>;

fn bind<'q>(query: Query<'q>, value: &'q SqlValue) -> Query<'q> {
    match value {
        SqlValue::Null => query.bind(Option::<String>::None),
        SqlValue::Int(n) => query.bind(*n),
        SqlValue::Text(s) => query.bind(s.as_str()),
    }
}

/// `INSERT INTO {table} ({cols}) VALUES (?, …) RETURNING id`.
pub async fn insert<'e, E: SqliteExecutor<'e>>(
    exec: E,
    table: &'static str,
    changes: &Changes,
) -> Result<i64, sqlx::Error> {
    let cols: Vec<&str> = changes.iter().map(|(c, _)| *c).collect();
    let marks = vec!["?"; cols.len()].join(", ");
    let sql = format!(
        "INSERT INTO {table} ({}) VALUES ({marks}) RETURNING id",
        cols.join(", ")
    );
    let query = changes
        .iter()
        .fold(sqlx::query_scalar::<_, i64>(&sql), |q, (_, v)| match v {
            SqlValue::Null => q.bind(Option::<String>::None),
            SqlValue::Int(n) => q.bind(*n),
            SqlValue::Text(s) => q.bind(s.as_str()),
        });
    query.fetch_one(exec).await
}

/// `UPDATE {table} SET col = ?, … WHERE id = ? AND deleted_at IS NULL`.
/// Returns the number of rows changed (0 when the row is absent or deleted).
pub async fn update<'e, E: SqliteExecutor<'e>>(
    exec: E,
    table: &'static str,
    id: i64,
    changes: &Changes,
) -> Result<u64, sqlx::Error> {
    if changes.is_empty() {
        return Ok(0);
    }
    let sets: Vec<String> = changes.iter().map(|(c, _)| format!("{c} = ?")).collect();
    let sql = format!(
        "UPDATE {table} SET {} WHERE id = ? AND deleted_at IS NULL",
        sets.join(", ")
    );
    let query = changes
        .iter()
        .fold(sqlx::query(&sql), |q, (_, v)| bind(q, v))
        .bind(id);
    Ok(query.execute(exec).await?.rows_affected())
}

/// Soft delete: `UPDATE {table} SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`.
pub async fn soft_delete<'e, E: SqliteExecutor<'e>>(
    exec: E,
    table: &'static str,
    id: i64,
) -> Result<u64, sqlx::Error> {
    let sql = format!(
        "UPDATE {table} SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL"
    );
    Ok(sqlx::query(&sql)
        .bind(id)
        .execute(exec)
        .await?
        .rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn insert_update_soft_delete_round_trip() {
        let pool = crate::testutil::pool().await;
        let changes: Changes = vec![
            ("name", SqlValue::Text("Kit".into())),
            ("category", SqlValue::Text("MATH".into())),
            ("description", SqlValue::Text("d".into())),
            ("image_url", SqlValue::Null),
            ("price_idr", SqlValue::Int(1000)),
            ("stock", SqlValue::Int(3)),
        ];
        let id = insert(&pool, "play_kits", &changes).await.unwrap();
        assert!(id > 0);

        let patch: Changes = vec![
            ("stock", SqlValue::Int(9)),
            ("badge_tag", SqlValue::Text("Baru".into())),
        ];
        assert_eq!(update(&pool, "play_kits", id, &patch).await.unwrap(), 1);
        assert_eq!(
            update(&pool, "play_kits", id, &Vec::new()).await.unwrap(),
            0
        );
        let (stock, badge): (i64, Option<String>) =
            sqlx::query_as("SELECT stock, badge_tag FROM play_kits WHERE id = ?")
                .bind(id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!((stock, badge.as_deref()), (9, Some("Baru")));

        assert_eq!(soft_delete(&pool, "play_kits", id).await.unwrap(), 1);
        assert_eq!(soft_delete(&pool, "play_kits", id).await.unwrap(), 0);
        assert_eq!(update(&pool, "play_kits", id, &patch).await.unwrap(), 0);
    }
}
