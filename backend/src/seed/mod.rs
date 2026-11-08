//! Seeding (PRD §5.11): runs at startup after migrations and from
//! `cargo run --bin seed`. Every step is idempotent.
//!
//! 1. Catalog (every environment): CMS, classes and kits, each only when its
//!    table has no rows at all (deleted rows included).
//! 2. Admin bootstrap when no `ADMIN` exists: `ADMIN_EMAIL`/`ADMIN_PASSWORD`,
//!    else the demo admin under `SEED_DEMO=true`, else a WARN.
//! 3. Demo data under `SEED_DEMO=true` while `nadia@example.com` is absent.

use sqlx::SqlitePool;

use crate::auth::password::hash_async;
use crate::config::Config;
use crate::models::user::{self, NewUser, ROLE_ADMIN};
use crate::validate::normalize_email;

pub mod catalog;
pub mod demo;

pub const DEMO_ADMIN_EMAIL: &str = "admin@rumi.id";
const DEMO_ADMIN_PASSWORD: &str = "rumi-admin-123";
const ADMIN_NAME: &str = "Admin RUMI";
const ADMIN_PASSWORD_MIN: usize = 8;

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SeedReport {
    pub cms: bool,
    pub classes: bool,
    pub kits: bool,
    pub admin_created: Option<String>,
    pub demo: bool,
}

pub async fn run(pool: &SqlitePool, cfg: &Config) -> anyhow::Result<SeedReport> {
    let (cms, classes, kits) = catalog::seed(pool).await?;
    let admin_created = bootstrap_admin(pool, cfg).await?;
    let demo = cfg.seed_demo && demo::seed(pool, cfg).await?;
    Ok(SeedReport {
        cms,
        classes,
        kits,
        admin_created,
        demo,
    })
}

pub async fn admin_exists(pool: &SqlitePool) -> Result<bool, sqlx::Error> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL",
    )
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

/// Insert an ADMIN user; the password is hashed off the async runtime.
pub async fn create_admin(
    pool: &SqlitePool,
    cfg: &Config,
    email: &str,
    password: &str,
) -> anyhow::Result<i64> {
    let password_hash = hash_async(password.to_string()).await?;
    let id = user::insert(
        pool,
        &NewUser {
            email,
            password_hash: &password_hash,
            full_name: ADMIN_NAME,
            phone_wa: &cfg.admin_wa_phone,
            role: ROLE_ADMIN,
        },
    )
    .await?;
    Ok(id)
}

/// §5.11.1 admin bootstrap. Returns the email of a newly created admin.
async fn bootstrap_admin(pool: &SqlitePool, cfg: &Config) -> anyhow::Result<Option<String>> {
    if admin_exists(pool).await? {
        return Ok(None);
    }
    if !cfg.admin_email.is_empty() && !cfg.admin_password.is_empty() {
        if cfg.admin_password.chars().count() < ADMIN_PASSWORD_MIN {
            tracing::error!(
                "ADMIN_PASSWORD is shorter than {ADMIN_PASSWORD_MIN} characters; no admin created"
            );
            return Ok(None);
        }
        let Some(email) = normalize_email(&cfg.admin_email) else {
            tracing::error!("ADMIN_EMAIL is not a valid email; no admin created");
            return Ok(None);
        };
        if user::email_exists(pool, &email).await? {
            tracing::error!("ADMIN_EMAIL already belongs to another account; no admin created");
            return Ok(None);
        }
        create_admin(pool, cfg, &email, &cfg.admin_password).await?;
        return Ok(Some(email));
    }
    if cfg.seed_demo {
        create_admin(pool, cfg, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD).await?;
        return Ok(Some(DEMO_ADMIN_EMAIL.to_string()));
    }
    tracing::warn!("no admin account: set ADMIN_EMAIL and ADMIN_PASSWORD");
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(email: &str, password: &str, demo: bool) -> Config {
        Config {
            admin_email: email.into(),
            admin_password: password.into(),
            seed_demo: demo,
            ..crate::testutil::config()
        }
    }

    async fn admins(pool: &SqlitePool) -> Vec<String> {
        sqlx::query_scalar("SELECT email FROM users WHERE role = 'ADMIN' ORDER BY id")
            .fetch_all(pool)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn env_admin_is_created_once() {
        let pool = crate::testutil::pool().await;
        let c = cfg(" Boss@Rumi.ID ", "rahasia-panjang", false);
        let first = run(&pool, &c).await.unwrap();
        assert!(first.cms && first.classes && first.kits);
        assert_eq!(first.admin_created.as_deref(), Some("boss@rumi.id"));
        assert!(!first.demo);
        let second = run(&pool, &c).await.unwrap();
        assert_eq!(second, SeedReport::default());
        assert_eq!(admins(&pool).await, vec!["boss@rumi.id"]);
    }

    #[tokio::test]
    async fn short_or_invalid_env_admin_is_refused() {
        let pool = crate::testutil::pool().await;
        run(&pool, &cfg("boss@rumi.id", "short", false))
            .await
            .unwrap();
        run(&pool, &cfg("not-an-email", "long-enough-pw", false))
            .await
            .unwrap();
        run(&pool, &cfg("", "", false)).await.unwrap();
        assert!(admins(&pool).await.is_empty());
    }

    #[tokio::test]
    async fn demo_mode_creates_demo_admin_when_env_is_unset() {
        let pool = crate::testutil::pool().await;
        let report = run(&pool, &cfg("", "", true)).await.unwrap();
        assert_eq!(report.admin_created.as_deref(), Some(DEMO_ADMIN_EMAIL));
        assert!(report.demo);
        assert_eq!(admins(&pool).await, vec![DEMO_ADMIN_EMAIL]);
    }
}
