//! Opaque cookie sessions (PRD §5.3.2) and the `rumi_session` cookie helpers
//! (shortener-link `build_cookie` / `clear_cookie`).

use axum::http::header::COOKIE;
use axum::http::HeaderMap;
use sqlx::{SqliteExecutor, SqlitePool};

use crate::config::{Config, CookieSecure};
use crate::ids::{gen_token, hash_secret, TOKEN_BYTES};
use crate::models::user::{User, USER_COLUMNS};

pub const SESSION_COOKIE: &str = "rumi_session";
const USER_AGENT_MAX: usize = 255;

/// Create a session row; returns the raw token (only its hash is stored).
pub async fn create<'e, E: SqliteExecutor<'e>>(
    exec: E,
    user_id: i64,
    ttl_days: i64,
    user_agent: Option<&str>,
    ip: &str,
) -> Result<String, sqlx::Error> {
    let token = gen_token(TOKEN_BYTES);
    let agent: Option<String> = user_agent.map(|ua| ua.chars().take(USER_AGENT_MAX).collect());
    sqlx::query(
        "INSERT INTO auth_sessions (user_id, token_hash, expires_at, user_agent, ip)
         VALUES (?, ?, datetime('now', ?), ?, ?)",
    )
    .bind(user_id)
    .bind(hash_secret(&token))
    .bind(format!("+{ttl_days} days"))
    .bind(agent)
    .bind(ip)
    .execute(exec)
    .await?;
    Ok(token)
}

/// Delete the session named by `token` (no-op if unknown).
pub async fn revoke<'e, E: SqliteExecutor<'e>>(exec: E, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM auth_sessions WHERE token_hash = ?")
        .bind(hash_secret(token))
        .execute(exec)
        .await?;
    Ok(())
}

/// Delete every session of a user (password reset).
pub async fn revoke_all<'e, E: SqliteExecutor<'e>>(
    exec: E,
    user_id: i64,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query("DELETE FROM auth_sessions WHERE user_id = ?")
        .bind(user_id)
        .execute(exec)
        .await?
        .rows_affected())
}

/// Resolve a live, unexpired session to its live user and touch `last_seen_at`.
pub async fn user_for_token(pool: &SqlitePool, token: &str) -> Result<Option<User>, sqlx::Error> {
    let sql = format!(
        "SELECT {USER_COLUMNS}, s.id AS session_id FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.deleted_at IS NULL"
    );
    let row: Option<(i64, String, String, String, String, String, i64)> = sqlx::query_as(&sql)
        .bind(hash_secret(token))
        .fetch_optional(pool)
        .await?;
    let Some((id, email, full_name, phone_wa, role, created_at, session_id)) = row else {
        return Ok(None);
    };
    sqlx::query("UPDATE auth_sessions SET last_seen_at = datetime('now') WHERE id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;
    Ok(Some(User {
        id,
        email,
        full_name,
        phone_wa,
        role,
        created_at,
    }))
}

/// Read one cookie value from the `Cookie` header(s).
pub fn cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|h| h.split(';'))
        .filter_map(|part| part.trim().split_once('='))
        .find(|(n, _)| n.trim() == name)
        .map(|(_, v)| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

/// The session token sent by the browser, if any.
pub fn session_token(headers: &HeaderMap) -> Option<String> {
    cookie_value(headers, SESSION_COOKIE)
}

/// `COOKIE_SECURE` (§5.10): `auto` adds `Secure` for an https base URL or an
/// `X-Forwarded-Proto: https` request.
pub fn wants_secure(cfg: &Config, headers: &HeaderMap) -> bool {
    match cfg.cookie_secure {
        CookieSecure::Always => true,
        CookieSecure::Never => false,
        CookieSecure::Auto => {
            cfg.public_base_url.starts_with("https://")
                || headers
                    .get("x-forwarded-proto")
                    .and_then(|v| v.to_str().ok())
                    .map(|p| p.trim().eq_ignore_ascii_case("https"))
                    .unwrap_or(false)
        }
    }
}

fn cookie(value: &str, max_age: i64, secure: bool) -> String {
    let base =
        format!("{SESSION_COOKIE}={value}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}");
    if secure {
        format!("{base}; Secure")
    } else {
        base
    }
}

/// `rumi_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=<ttl>[; Secure]`.
pub fn set_cookie(token: &str, max_age: i64, secure: bool) -> String {
    cookie(token, max_age, secure)
}

/// `rumi_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0[; Secure]`.
pub fn clear_cookie(secure: bool) -> String {
    cookie("", 0, secure)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn cookie_shapes_match_contract() {
        assert_eq!(
            set_cookie("tok", 2_592_000, false),
            "rumi_session=tok; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000"
        );
        assert_eq!(
            clear_cookie(true),
            "rumi_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure"
        );
    }

    #[test]
    fn cookie_parsing() {
        let mut h = HeaderMap::new();
        h.insert(
            COOKIE,
            HeaderValue::from_static("a=1; rumi_session=abc ; b=2"),
        );
        assert_eq!(session_token(&h).as_deref(), Some("abc"));
        h.insert(COOKIE, HeaderValue::from_static("rumi_session="));
        assert_eq!(session_token(&h), None);
        assert_eq!(session_token(&HeaderMap::new()), None);
    }

    #[test]
    fn secure_flag_modes() {
        let mut cfg = crate::testutil::config();
        let mut https = HeaderMap::new();
        https.insert("x-forwarded-proto", HeaderValue::from_static("https"));
        cfg.cookie_secure = CookieSecure::Auto;
        cfg.public_base_url = String::new();
        assert!(!wants_secure(&cfg, &HeaderMap::new()));
        assert!(wants_secure(&cfg, &https));
        cfg.public_base_url = "https://rumi.id".into();
        assert!(wants_secure(&cfg, &HeaderMap::new()));
        cfg.cookie_secure = CookieSecure::Never;
        assert!(!wants_secure(&cfg, &https));
        cfg.cookie_secure = CookieSecure::Always;
        assert!(wants_secure(&cfg, &HeaderMap::new()));
    }

    #[tokio::test]
    async fn create_resolve_revoke() {
        let pool = crate::testutil::pool().await;
        let uid: i64 = sqlx::query_scalar(
            "INSERT INTO users (email, password_hash, full_name, phone_wa)
             VALUES ('a@x.co', 'h', 'A', '6281211112222') RETURNING id",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let token = create(&pool, uid, 30, Some("ua"), "1.1.1.1").await.unwrap();
        assert_eq!(token.len(), 43);
        let stored: String = sqlx::query_scalar("SELECT token_hash FROM auth_sessions")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stored, hash_secret(&token));
        assert_eq!(
            user_for_token(&pool, &token).await.unwrap().unwrap().id,
            uid
        );
        assert!(user_for_token(&pool, "unknown").await.unwrap().is_none());

        sqlx::query("UPDATE auth_sessions SET expires_at = datetime('now', '-1 second')")
            .execute(&pool)
            .await
            .unwrap();
        assert!(user_for_token(&pool, &token).await.unwrap().is_none());

        let t2 = create(&pool, uid, 30, None, "x").await.unwrap();
        revoke(&pool, &t2).await.unwrap();
        assert!(user_for_token(&pool, &t2).await.unwrap().is_none());
        create(&pool, uid, 30, None, "x").await.unwrap();
        assert_eq!(revoke_all(&pool, uid).await.unwrap(), 2);
    }
}
