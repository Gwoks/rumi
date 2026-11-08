//! `seed` bin: migrate and run the idempotent seed (PRD §5.11.1) on its own.

use rumi::config::Config;
use rumi::{db, seed};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();
    let cfg = Config::from_env();
    db::ensure_parent_dir(&cfg.database_path)?;
    let pool = db::pool(&cfg.database_path).await?;
    db::migrate(&pool).await?;
    let report = seed::run(&pool, &cfg).await?;
    tracing::info!(?report, "rumi seed finished");
    Ok(())
}
