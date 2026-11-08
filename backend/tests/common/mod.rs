//! Shared integration-test harness (hookbox `tests/api.rs` shape): the real
//! `router::build_app` over an in-memory SQLite database, driven with
//! `tower::ServiceExt::oneshot`. `call()` sends `Host: localhost`, a matching
//! `Origin` on mutating requests, and an optional session cookie.
#![allow(dead_code)]

use std::sync::Arc;

use axum::body::Body;
use axum::http::{HeaderMap, Method, Request, StatusCode};
use axum::Router;
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tower::ServiceExt;

use rumi::config::{Config, CookieSecure};
use rumi::notifier::RecordingNotifier;
use rumi::router::build_app;
use rumi::state::AppState;

pub const HOST: &str = "localhost";
pub const ORIGIN: &str = "http://localhost";
pub const PASSWORD: &str = "rahasia-123";

pub struct TestApp {
    pub app: Router,
    pub pool: SqlitePool,
    pub cfg: Config,
    pub notifier: Arc<RecordingNotifier>,
}

/// Defaults that do not depend on the process environment.
pub fn test_config() -> Config {
    Config {
        app_port: 8080,
        bind_host: "127.0.0.1".into(),
        database_path: ":memory:".into(),
        static_dir: "does-not-exist".into(),
        public_base_url: String::new(),
        admin_wa_phone: "6281234567890".into(),
        admin_email: String::new(),
        admin_password: String::new(),
        seed_demo: false,
        allow_demo_seed_in_prod: false,
        pending_order_ttl_hours: 48,
        session_ttl_days: 30,
        // Every oneshot request shares the "unknown" client IP; keep the auth
        // buckets out of the way except in the dedicated rate-limit test.
        auth_rate_limit_per_min: 1_000_000,
        order_rate_limit_per_min: 10,
        max_pending_orders_per_parent: 3,
        cookie_secure: CookieSecure::Never,
        sweep_interval_seconds: 300,
    }
}

pub async fn app_with(cfg: Config) -> TestApp {
    let pool = rumi::db::pool(&cfg.database_path).await.expect("pool");
    rumi::db::migrate(&pool).await.expect("migrate");
    let notifier = Arc::new(RecordingNotifier::new());
    let state = AppState::with_notifier(pool.clone(), cfg.clone(), notifier.clone());
    TestApp {
        app: build_app(state),
        pool,
        cfg,
        notifier,
    }
}

pub async fn app() -> TestApp {
    app_with(test_config()).await
}

#[derive(Debug)]
pub struct Resp {
    pub status: StatusCode,
    pub body: Value,
    pub headers: HeaderMap,
    pub text: String,
}

impl Resp {
    pub fn data(&self) -> &Value {
        &self.body["data"]
    }

    pub fn code(&self) -> &str {
        self.body["code"].as_str().unwrap_or("")
    }

    /// `rumi_session=<token>` from `Set-Cookie`, ready to send back.
    pub fn cookie(&self) -> Option<String> {
        self.set_cookie()
            .and_then(|c| c.split(';').next().map(str::to_string))
            .filter(|c| c != "rumi_session=")
    }

    pub fn set_cookie(&self) -> Option<String> {
        self.headers
            .get("set-cookie")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string)
    }

    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name).and_then(|v| v.to_str().ok())
    }
}

pub async fn send(app: &Router, req: Request<Body>) -> Resp {
    let resp = app.clone().oneshot(req).await.expect("oneshot");
    let status = resp.status();
    let headers = resp.headers().clone();
    let bytes = resp.into_body().collect().await.expect("body").to_bytes();
    let text = String::from_utf8_lossy(&bytes).to_string();
    let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    Resp {
        status,
        body,
        headers,
        text,
    }
}

pub fn request(
    method: &str,
    path: &str,
    cookie: Option<&str>,
    body: Option<&Value>,
) -> Request<Body> {
    let method: Method = method.parse().expect("method");
    let mutating = !matches!(method, Method::GET | Method::HEAD);
    let mut b = Request::builder()
        .method(method)
        .uri(path)
        .header("host", HOST);
    if mutating {
        b = b.header("origin", ORIGIN);
    }
    if let Some(c) = cookie {
        b = b.header("cookie", c);
    }
    match body {
        Some(j) => b
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(j).expect("json")))
            .expect("request"),
        None => b.body(Body::empty()).expect("request"),
    }
}

pub async fn call(
    t: &TestApp,
    method: &str,
    path: &str,
    cookie: Option<&str>,
    body: Option<Value>,
) -> Resp {
    send(&t.app, request(method, path, cookie, body.as_ref())).await
}

pub async fn get(t: &TestApp, path: &str, cookie: Option<&str>) -> Resp {
    call(t, "GET", path, cookie, None).await
}

// --- fixtures -------------------------------------------------------------

pub fn date_in(days: i64) -> String {
    (rumi::helpers::today_wib() + chrono::Duration::days(days))
        .format("%Y-%m-%d")
        .to_string()
}

pub fn uuid(n: u32) -> String {
    format!("00000000-0000-4000-8000-{n:012}")
}

pub fn register_body(email: &str, child: &str) -> Value {
    json!({
        "parent": {"full_name": "Orang Tua", "email": email, "phone_wa": "0812-1111-2222", "password": PASSWORD},
        "child": {"name": child, "dob": "2021-03-10", "notes": null}
    })
}

pub struct Parent {
    pub cookie: String,
    pub user_id: i64,
    pub child_id: i64,
}

/// Register a parent with one child through the API.
pub async fn register(t: &TestApp, email: &str) -> Parent {
    let r = call(
        t,
        "POST",
        "/api/auth/register",
        None,
        Some(register_body(email, "Amina")),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "register: {}", r.text);
    Parent {
        cookie: r.cookie().expect("cookie"),
        user_id: r.data()["user"]["id"].as_i64().expect("user id"),
        child_id: r.data()["child"]["id"].as_i64().expect("child id"),
    }
}

/// Create an admin directly and sign in through the API; returns the cookie.
pub async fn admin(t: &TestApp) -> String {
    let email = "admin@rumi.id";
    rumi::seed::create_admin(&t.pool, &t.cfg, email, PASSWORD)
        .await
        .expect("admin");
    login(t, email, PASSWORD).await
}

pub async fn login(t: &TestApp, email: &str, password: &str) -> String {
    let r = call(
        t,
        "POST",
        "/api/auth/login",
        None,
        Some(json!({"email": email, "password": password})),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "login: {}", r.text);
    r.cookie().expect("cookie")
}

pub async fn add_child(t: &TestApp, cookie: &str, name: &str) -> i64 {
    let r = call(
        t,
        "POST",
        "/api/me/children",
        Some(cookie),
        Some(json!({"name": name, "dob": "2022-01-01"})),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "child: {}", r.text);
    r.data()["id"].as_i64().expect("id")
}

/// An OPEN class `days` days from today (WIB) at 09:30–11:30.
pub async fn insert_class(
    pool: &SqlitePool,
    title: &str,
    days: i64,
    capacity: i64,
    fee: i64,
) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO weekend_classes (title, description, location, age_min, age_max, date,
         start_time, end_time, fee_idr, capacity, status)
         VALUES (?, 'Deskripsi', 'Rumah Teduh, Kemang (Jakarta Selatan)', 3, 6, ?, '09:30', '11:30', ?, ?, 'OPEN')
         RETURNING id",
    )
    .bind(title)
    .bind(date_in(days))
    .bind(fee)
    .bind(capacity)
    .fetch_one(pool)
    .await
    .expect("class")
}

pub async fn insert_kit(pool: &SqlitePool, name: &str, price: i64, stock: i64) -> i64 {
    sqlx::query_scalar(
        "INSERT INTO play_kits (name, category, description, price_idr, stock)
         VALUES (?, 'PRACTICAL_LIFE', 'Deskripsi', ?, ?) RETURNING id",
    )
    .bind(name)
    .bind(price)
    .bind(stock)
    .fetch_one(pool)
    .await
    .expect("kit")
}

pub async fn scalar(pool: &SqlitePool, sql: &str) -> i64 {
    sqlx::query_scalar(sql)
        .fetch_one(pool)
        .await
        .expect("scalar")
}

pub fn delivery() -> Value {
    json!({"name": "Nadia Rahman", "phone_wa": "0812-1111-2222", "address": "Jl. Kemang Raya 12"})
}

pub fn checkout_body(key: &str, items: Value) -> Value {
    json!({"idempotency_key": key, "items": items, "delivery": delivery()})
}

pub async fn checkout(t: &TestApp, cookie: &str, key: &str, items: Value) -> Resp {
    call(
        t,
        "POST",
        "/api/orders",
        Some(cookie),
        Some(checkout_body(key, items)),
    )
    .await
}

/// Percent-decode a `wa.me` `text=` value.
pub fn pct_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).expect("hex");
            out.push(u8::from_str_radix(hex, 16).expect("hex digit"));
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).expect("utf8")
}
