//! RUMI backend — one Axum binary over WAL SQLite that serves the JSON API
//! (`/api/*`) and the built React SPA (`dist/`). Library crate so `main.rs` and
//! the `seed` bin share modules. The API contract is
//! `docs/features/rumi-v1/prd.md` §5.

pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod extract;
pub mod helpers;
pub mod ids;
pub mod limiter;
pub mod middleware;
pub mod models;
pub mod money;
pub mod notifier;
pub mod patch;
pub mod router;
pub mod routes;
pub mod seed;
pub mod services;
pub mod state;
pub mod tasks;
pub mod validate;
pub mod whatsapp;

#[cfg(test)]
pub mod testutil;
