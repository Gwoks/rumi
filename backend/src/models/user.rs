//! `users` (PRD §5.6 `User`).

use serde::Serialize;
use sqlx::SqliteExecutor;

pub const ROLE_PARENT: &str = "PARENT";
pub const ROLE_ADMIN: &str = "ADMIN";

#[derive(Debug, Clone, Serialize, sqlx::FromRow, PartialEq, Eq)]
pub struct User {
    pub id: i64,
    pub email: String,
    pub full_name: String,
    pub phone_wa: String,
    pub role: String,
    pub created_at: String,
}

/// Column list for `User` over a `users` alias `u`.
pub const USER_COLUMNS: &str = "u.id, u.email, u.full_name, u.phone_wa, u.role, \
     strftime('%Y-%m-%dT%H:%M:%SZ', u.created_at) AS created_at";

/// A live (not soft-deleted) user by id.
pub async fn find_active<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<User>, sqlx::Error> {
    let sql = format!("SELECT {USER_COLUMNS} FROM users u WHERE u.id = ? AND u.deleted_at IS NULL");
    sqlx::query_as::<_, User>(&sql)
        .bind(id)
        .fetch_optional(exec)
        .await
}

/// A user by id, soft-deleted included (live joins such as a child's parent).
pub async fn find_any<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<User>, sqlx::Error> {
    let sql = format!("SELECT {USER_COLUMNS} FROM users u WHERE u.id = ?");
    sqlx::query_as::<_, User>(&sql)
        .bind(id)
        .fetch_optional(exec)
        .await
}

/// Any user (deleted or not) with this email; email uniqueness ignores case.
pub async fn email_exists<'e, E: SqliteExecutor<'e>>(
    exec: E,
    email: &str,
) -> Result<bool, sqlx::Error> {
    let found: Option<i64> = sqlx::query_scalar("SELECT id FROM users WHERE email = ?")
        .bind(email)
        .fetch_optional(exec)
        .await?;
    Ok(found.is_some())
}

/// `(id, password_hash)` of the live user with this email.
pub async fn login_row<'e, E: SqliteExecutor<'e>>(
    exec: E,
    email: &str,
) -> Result<Option<(i64, String)>, sqlx::Error> {
    sqlx::query_as("SELECT id, password_hash FROM users WHERE email = ? AND deleted_at IS NULL")
        .bind(email)
        .fetch_optional(exec)
        .await
}

pub struct NewUser<'a> {
    pub email: &'a str,
    pub password_hash: &'a str,
    pub full_name: &'a str,
    pub phone_wa: &'a str,
    pub role: &'a str,
}

pub async fn insert<'e, E: SqliteExecutor<'e>>(
    exec: E,
    user: &NewUser<'_>,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO users (email, password_hash, full_name, phone_wa, role)
         VALUES (?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(user.email)
    .bind(user.password_hash)
    .bind(user.full_name)
    .bind(user.phone_wa)
    .bind(user.role)
    .fetch_one(exec)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn insert_find_and_login_row() {
        let pool = crate::testutil::pool().await;
        let id = insert(
            &pool,
            &NewUser {
                email: "nadia@example.com",
                password_hash: "h",
                full_name: "Nadia",
                phone_wa: "6281211112222",
                role: ROLE_PARENT,
            },
        )
        .await
        .unwrap();
        let user = find_active(&pool, id).await.unwrap().unwrap();
        assert_eq!(user.email, "nadia@example.com");
        assert!(user.created_at.ends_with('Z') && user.created_at.contains('T'));
        assert!(email_exists(&pool, "NADIA@example.com").await.unwrap());
        assert_eq!(
            login_row(&pool, "nadia@example.com")
                .await
                .unwrap()
                .unwrap()
                .0,
            id
        );

        sqlx::query("UPDATE users SET deleted_at = datetime('now') WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
        assert!(find_active(&pool, id).await.unwrap().is_none());
        assert!(login_row(&pool, "nadia@example.com")
            .await
            .unwrap()
            .is_none());
        assert!(email_exists(&pool, "nadia@example.com").await.unwrap());
    }
}
