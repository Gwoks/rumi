//! `rumi` entrypoint (hookbox startup order): tracing → Config → pool →
//! migrate → seed → AppState → sweep → router → serve with ConnectInfo and
//! graceful shutdown on Ctrl-C / SIGTERM.

use std::net::SocketAddr;

use rumi::config::Config;
use rumi::state::AppState;
use rumi::tasks::sweep;
use rumi::{db, router, seed};

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
    match seed::run(&pool, &cfg).await {
        Ok(report) => tracing::info!(?report, "seed"),
        Err(e) => tracing::warn!(error = %e, "seed skipped"),
    }

    let addr = format!("{}:{}", cfg.bind_host, cfg.app_port);
    let state = AppState::new(pool, cfg);
    let _sweep = sweep::spawn(state.pool.clone(), state.cfg.clone(), state.limiter.clone());
    let app = router::build_app(state);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("rumi listening on {addr}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;
    tracing::info!("rumi stopped");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::warn!(error = %e, "ctrl-c handler failed");
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => {
                tracing::warn!(error = %e, "SIGTERM handler failed");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}
