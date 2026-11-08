//! Auth endpoints #7–#12 (PRD §5.3, §5.8.3).

mod common;

use axum::http::StatusCode;
use common::*;
use serde_json::json;

#[tokio::test]
async fn register_creates_parent_child_and_session_cookie() {
    let t = app().await;
    let r = call(
        &t,
        "POST",
        "/api/auth/register",
        None,
        Some(register_body("  Nadia@Example.com ", "Amina")),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    let user = &r.data()["user"];
    assert_eq!(user["email"], "nadia@example.com");
    assert_eq!(user["role"], "PARENT");
    assert_eq!(user["phone_wa"], "6281211112222");
    assert!(user["created_at"].as_str().unwrap().ends_with('Z'));
    let child = &r.data()["child"];
    assert_eq!(child["name"], "Amina");
    assert_eq!(child["parent_id"], user["id"]);
    assert_eq!(child["notes"], serde_json::Value::Null);
    assert!(child["age_years"].as_i64().unwrap() >= 4);

    let set_cookie = r.set_cookie().unwrap();
    assert!(set_cookie.starts_with("rumi_session="));
    assert!(set_cookie.ends_with("; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000"));
    let token = r
        .cookie()
        .unwrap()
        .trim_start_matches("rumi_session=")
        .to_string();
    assert_eq!(token.len(), 43);
    let stored: String = sqlx::query_scalar("SELECT token_hash FROM auth_sessions")
        .fetch_one(&t.pool)
        .await
        .unwrap();
    assert_eq!(stored, rumi::ids::hash_secret(&token));

    let me = get(&t, "/api/auth/me", r.cookie().as_deref()).await;
    assert_eq!(me.data()["user"]["email"], "nadia@example.com");
}

#[tokio::test]
async fn role_is_never_read_from_the_body() {
    let t = app().await;
    let mut body = register_body("sneaky@example.com", "A");
    body["role"] = json!("ADMIN");
    body["parent"]["role"] = json!("ADMIN");
    let r = call(&t, "POST", "/api/auth/register", None, Some(body)).await;
    assert_eq!(r.status, StatusCode::CREATED);
    assert_eq!(r.data()["user"]["role"], "PARENT");
    assert_eq!(
        scalar(&t.pool, "SELECT COUNT(*) FROM users WHERE role = 'ADMIN'").await,
        0
    );
}

#[tokio::test]
async fn register_is_atomic_and_duplicate_email_is_409() {
    let t = app().await;
    // A child that fails validation means nothing is written.
    let mut bad = register_body("atomic@example.com", "A");
    bad["child"]["dob"] = json!(date_in(5));
    let r = call(&t, "POST", "/api/auth/register", None, Some(bad)).await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(r.body["fields"]["child.dob"].is_string());
    assert_eq!(scalar(&t.pool, "SELECT COUNT(*) FROM users").await, 0);
    assert_eq!(scalar(&t.pool, "SELECT COUNT(*) FROM children").await, 0);

    register(&t, "dupe@example.com").await;
    let again = call(
        &t,
        "POST",
        "/api/auth/register",
        None,
        Some(register_body("DUPE@example.com", "B")),
    )
    .await;
    assert_eq!(again.status, StatusCode::CONFLICT);
    assert_eq!(again.code(), "email_taken");
    assert_eq!(scalar(&t.pool, "SELECT COUNT(*) FROM children").await, 1);
}

#[tokio::test]
async fn register_validates_phone_password_and_child_age() {
    let t = app().await;
    let mut body = register_body("x@example.com", "A");
    body["parent"]["phone_wa"] = json!("12345");
    body["parent"]["password"] = json!("short");
    body["child"]["dob"] = json!("2010-01-01");
    let r = call(&t, "POST", "/api/auth/register", None, Some(body)).await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    for key in ["parent.phone_wa", "parent.password", "child.dob"] {
        assert!(r.body["fields"][key].is_string(), "{key}");
    }
}

#[tokio::test]
async fn login_logout_and_me() {
    let t = app().await;
    register(&t, "nadia@example.com").await;

    let anon = get(&t, "/api/auth/me", None).await;
    assert_eq!(anon.status, StatusCode::OK);
    assert_eq!(
        anon.body,
        json!({"success": true, "data": {"user": null}, "error": null})
    );

    let cookie = login(&t, "NADIA@example.com", PASSWORD).await;
    let me = get(&t, "/api/auth/me", Some(&cookie)).await;
    assert_eq!(me.data()["user"]["email"], "nadia@example.com");

    let out = call(&t, "POST", "/api/auth/logout", Some(&cookie), None).await;
    assert_eq!(out.status, StatusCode::OK);
    assert_eq!(
        out.body,
        json!({"success": true, "data": null, "error": null})
    );
    assert_eq!(
        out.set_cookie().as_deref(),
        Some("rumi_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0")
    );
    let after = get(&t, "/api/auth/me", Some(&cookie)).await;
    assert_eq!(after.data()["user"], serde_json::Value::Null);
    // Logout without a cookie is still 200.
    assert_eq!(
        call(&t, "POST", "/api/auth/logout", None, None)
            .await
            .status,
        StatusCode::OK
    );
}

#[tokio::test]
async fn wrong_password_unknown_email_and_deleted_user_are_invalid_credentials() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    for (email, password) in [
        ("nadia@example.com", "wrong-password"),
        ("ghost@example.com", PASSWORD),
    ] {
        let r = call(
            &t,
            "POST",
            "/api/auth/login",
            None,
            Some(json!({"email": email, "password": password})),
        )
        .await;
        assert_eq!(r.status, StatusCode::UNAUTHORIZED);
        assert_eq!(r.code(), "invalid_credentials");
        assert_eq!(r.body["error"], "Email atau kata sandi salah.");
    }
    sqlx::query("UPDATE users SET deleted_at = datetime('now') WHERE id = ?")
        .bind(p.user_id)
        .execute(&t.pool)
        .await
        .unwrap();
    let r = call(
        &t,
        "POST",
        "/api/auth/login",
        None,
        Some(json!({"email": "nadia@example.com", "password": PASSWORD})),
    )
    .await;
    assert_eq!(r.code(), "invalid_credentials");
    // The deleted user's live session no longer authenticates.
    let me = get(&t, "/api/auth/me", Some(&p.cookie)).await;
    assert_eq!(me.data()["user"], serde_json::Value::Null);
    let bad = call(
        &t,
        "POST",
        "/api/auth/login",
        None,
        Some(json!({"email": "nope", "password": ""})),
    )
    .await;
    assert_eq!(bad.status, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn login_revokes_the_incoming_session() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    let r = call(
        &t,
        "POST",
        "/api/auth/login",
        Some(&p.cookie),
        Some(json!({"email": "nadia@example.com", "password": PASSWORD})),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK);
    let old = get(&t, "/api/auth/me", Some(&p.cookie)).await;
    assert_eq!(old.data()["user"], serde_json::Value::Null);
    let new = get(&t, "/api/auth/me", r.cookie().as_deref()).await;
    assert_eq!(new.data()["user"]["email"], "nadia@example.com");
    assert_eq!(
        scalar(&t.pool, "SELECT COUNT(*) FROM auth_sessions").await,
        1
    );
}

#[tokio::test]
async fn expired_session_is_anonymous() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    sqlx::query("UPDATE auth_sessions SET expires_at = datetime('now', '-1 minute')")
        .execute(&t.pool)
        .await
        .unwrap();
    assert_eq!(
        get(&t, "/api/auth/me", Some(&p.cookie)).await.data()["user"],
        serde_json::Value::Null
    );
    let r = get(&t, "/api/me/children", Some(&p.cookie)).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert_eq!(r.code(), "unauthorized");
}

fn token_from(url: &str) -> String {
    url.split("#token=").nth(1).unwrap().to_string()
}

async fn forgot(t: &TestApp, email: &str) -> Resp {
    call(
        t,
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(json!({"email": email})),
    )
    .await
}

async fn reset(t: &TestApp, token: &str, password: &str) -> Resp {
    call(
        t,
        "POST",
        "/api/auth/reset-password",
        None,
        Some(json!({"token": token, "password": password})),
    )
    .await
}

#[tokio::test]
async fn a_new_reset_link_invalidates_the_older_ones() {
    let t = app().await;
    register(&t, "nadia@example.com").await;
    forgot(&t, "nadia@example.com").await;
    forgot(&t, "nadia@example.com").await;
    let sent = t.notifier.sent();
    let (old, new) = (token_from(&sent[0].1), token_from(&sent[1].1));
    assert_ne!(old, new);
    assert_eq!(
        reset(&t, &old, "kata-sandi-lama").await.code(),
        "invalid_token"
    );
    assert_eq!(
        reset(&t, &new, "kata-sandi-baru").await.status,
        StatusCode::OK
    );
    login(&t, "nadia@example.com", "kata-sandi-baru").await;
}

#[tokio::test]
async fn a_successful_reset_burns_every_unused_token_of_that_user() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    forgot(&t, "nadia@example.com").await;
    let token = token_from(&t.notifier.sent()[0].1);
    // A stale token issued another way (e.g. before this rule) must die too.
    sqlx::query(
        "INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES (?, 'stale-hash', datetime('now', '+30 minutes'))",
    )
    .bind(p.user_id)
    .execute(&t.pool)
    .await
    .unwrap();
    assert_eq!(
        reset(&t, &token, "kata-sandi-baru").await.status,
        StatusCode::OK
    );
    let unused = scalar(
        &t.pool,
        "SELECT COUNT(*) FROM password_resets WHERE used_at IS NULL",
    )
    .await;
    assert_eq!(unused, 0);
}

#[tokio::test]
async fn forgot_and_reset_password_flow_revokes_sessions() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    let second = login(&t, "nadia@example.com", PASSWORD).await;

    let unknown = call(
        &t,
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(json!({"email": "ghost@example.com"})),
    )
    .await;
    assert_eq!(unknown.status, StatusCode::OK);
    assert!(t.notifier.sent().is_empty());
    let bad = call(
        &t,
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(json!({"email": "bad"})),
    )
    .await;
    assert_eq!(bad.status, StatusCode::UNPROCESSABLE_ENTITY);

    let r = call(
        &t,
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(json!({"email": "Nadia@example.com"})),
    )
    .await;
    assert_eq!(
        r.body,
        json!({"success": true, "data": null, "error": null})
    );
    let sent = t.notifier.sent();
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0].0, "nadia@example.com");
    // The token rides in the fragment, never in the query (§5.8.3 #11).
    assert!(sent[0]
        .1
        .starts_with("http://localhost:8080/reset-password#token="));
    assert!(!sent[0].1.contains('?'));
    let token = token_from(&sent[0].1);
    assert_eq!(token.len(), 43);

    let reset = call(
        &t,
        "POST",
        "/api/auth/reset-password",
        None,
        Some(json!({"token": token, "password": "kata-sandi-baru"})),
    )
    .await;
    assert_eq!(reset.status, StatusCode::OK, "{}", reset.text);
    assert_eq!(reset.data(), &serde_json::Value::Null);
    assert!(reset.set_cookie().unwrap().contains("Max-Age=0"));
    for cookie in [&p.cookie, &second] {
        assert_eq!(
            get(&t, "/api/auth/me", Some(cookie)).await.data()["user"],
            serde_json::Value::Null
        );
    }
    assert_eq!(
        scalar(&t.pool, "SELECT COUNT(*) FROM auth_sessions").await,
        0
    );
    login(&t, "nadia@example.com", "kata-sandi-baru").await;

    let reused = call(
        &t,
        "POST",
        "/api/auth/reset-password",
        None,
        Some(json!({"token": token, "password": "lagi-lagi-123"})),
    )
    .await;
    assert_eq!(reused.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(reused.code(), "invalid_token");
}

#[tokio::test]
async fn reset_rejects_unknown_expired_and_weak_input() {
    let cfg = rumi::config::Config {
        public_base_url: "https://rumi-stg.kasibah.com".into(),
        ..test_config()
    };
    let t = app_with(cfg).await;
    register(&t, "nadia@example.com").await;
    call(
        &t,
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(json!({"email": "nadia@example.com"})),
    )
    .await;
    let url = t.notifier.sent()[0].1.clone();
    assert!(url.starts_with("https://rumi-stg.kasibah.com/reset-password#token="));
    let token = token_from(&url);

    let weak = call(
        &t,
        "POST",
        "/api/auth/reset-password",
        None,
        Some(json!({"token": token, "password": "short"})),
    )
    .await;
    assert_eq!(weak.code(), "validation_error");
    let unknown = call(
        &t,
        "POST",
        "/api/auth/reset-password",
        None,
        Some(json!({"token": "nope", "password": "panjang-sekali"})),
    )
    .await;
    assert_eq!(unknown.code(), "invalid_token");
    sqlx::query("UPDATE password_resets SET expires_at = datetime('now', '-1 minute')")
        .execute(&t.pool)
        .await
        .unwrap();
    let expired = call(
        &t,
        "POST",
        "/api/auth/reset-password",
        None,
        Some(json!({"token": token, "password": "panjang-sekali"})),
    )
    .await;
    assert_eq!(expired.code(), "invalid_token");
}

#[tokio::test]
async fn secure_cookie_when_forwarded_https() {
    let cfg = rumi::config::Config {
        cookie_secure: rumi::config::CookieSecure::Auto,
        ..test_config()
    };
    let t = app_with(cfg).await;
    let req = axum::http::Request::builder()
        .method("POST")
        .uri("/api/auth/register")
        .header("host", HOST)
        .header("x-forwarded-proto", "https")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            serde_json::to_vec(&register_body("s@example.com", "A")).unwrap(),
        ))
        .unwrap();
    let r = send(&t.app, req).await;
    assert!(r.set_cookie().unwrap().ends_with("; Secure"));
}

#[tokio::test]
async fn auth_endpoints_are_rate_limited_per_endpoint_with_retry_after() {
    let cfg = rumi::config::Config {
        auth_rate_limit_per_min: 2,
        ..test_config()
    };
    let t = app_with(cfg).await;
    let body = json!({"email": "ghost@example.com", "password": "whatever"});
    for _ in 0..2 {
        let r = call(&t, "POST", "/api/auth/login", None, Some(body.clone())).await;
        assert_eq!(r.code(), "invalid_credentials");
    }
    // Every request takes a token, even a malformed one.
    let limited = call(&t, "POST", "/api/auth/login", None, Some(json!([]))).await;
    assert_eq!(limited.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(limited.code(), "rate_limited");
    let retry: i64 = limited.header("retry-after").unwrap().parse().unwrap();
    assert!(retry >= 1);
    // Another endpoint has its own bucket; me/logout are not limited.
    let forgot = call(
        &t,
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(json!({"email": "a@b.co"})),
    )
    .await;
    assert_eq!(forgot.status, StatusCode::OK);
    for _ in 0..5 {
        assert_eq!(get(&t, "/api/auth/me", None).await.status, StatusCode::OK);
    }
}

/// A request that arrived through nginx on loopback for `client`.
fn forgot_from(client: &str) -> axum::http::Request<axum::body::Body> {
    let mut req = request(
        "POST",
        "/api/auth/forgot-password",
        None,
        Some(&json!({"email": "a@b.co"})),
    );
    let peer: std::net::SocketAddr = "[::1]:40000".parse().unwrap();
    req.extensions_mut()
        .insert(axum::extract::ConnectInfo(peer));
    req.headers_mut()
        .insert("x-real-ip", client.parse().unwrap());
    req
}

#[tokio::test]
async fn ipv6_clients_share_one_bucket_per_64() {
    let cfg = rumi::config::Config {
        auth_rate_limit_per_min: 1,
        ..test_config()
    };
    let t = app_with(cfg).await;
    let status = |r: Resp| r.status;
    assert_eq!(
        status(send(&t.app, forgot_from("2001:db8:1:2::1")).await),
        StatusCode::OK
    );
    // Another address in the same /64 is the same subscriber.
    let rotated = send(&t.app, forgot_from("2001:db8:1:2:abcd:ef01:2345:6789")).await;
    assert_eq!(rotated.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(rotated.code(), "rate_limited");
    // A different /64 and an IPv4 client have their own buckets.
    assert_eq!(
        status(send(&t.app, forgot_from("2001:db8:1:3::1")).await),
        StatusCode::OK
    );
    assert_eq!(
        status(send(&t.app, forgot_from("203.0.113.7")).await),
        StatusCode::OK
    );
    // IPv4-mapped IPv6 counts as the IPv4 address.
    assert_eq!(
        status(send(&t.app, forgot_from("::ffff:203.0.113.7")).await),
        StatusCode::TOO_MANY_REQUESTS
    );
}

async fn login_as(t: &TestApp, email: &str, password: &str) -> Resp {
    call(
        t,
        "POST",
        "/api/auth/login",
        None,
        Some(json!({"email": email, "password": password})),
    )
    .await
}

#[tokio::test]
async fn five_failed_logins_lock_that_email_even_for_the_right_password() {
    let t = app().await;
    register(&t, "nadia@example.com").await;
    for _ in 0..5 {
        let r = login_as(&t, "nadia@example.com", "salah-sandi").await;
        assert_eq!(r.code(), "invalid_credentials");
    }
    let locked = login_as(&t, "Nadia@Example.com", PASSWORD).await;
    assert_eq!(locked.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(locked.code(), "rate_limited");
    let retry: i64 = locked.header("retry-after").unwrap().parse().unwrap();
    assert!((1..=180).contains(&retry), "{retry}");
    // Other accounts are untouched.
    register(&t, "siti@example.com").await;
    assert_eq!(
        login_as(&t, "siti@example.com", PASSWORD).await.status,
        StatusCode::OK
    );
    // Unknown emails are bucketed the same way (no account enumeration).
    for _ in 0..5 {
        login_as(&t, "ghost@example.com", "x").await;
    }
    assert_eq!(
        login_as(&t, "ghost@example.com", "x").await.code(),
        "rate_limited"
    );
}

#[tokio::test]
async fn a_successful_login_clears_the_failure_bucket() {
    let t = app().await;
    register(&t, "nadia@example.com").await;
    for _ in 0..4 {
        login_as(&t, "nadia@example.com", "salah-sandi").await;
    }
    assert_eq!(
        login_as(&t, "nadia@example.com", PASSWORD).await.status,
        StatusCode::OK
    );
    for _ in 0..4 {
        let r = login_as(&t, "nadia@example.com", "salah-sandi").await;
        assert_eq!(r.code(), "invalid_credentials");
    }
    assert_eq!(
        login_as(&t, "nadia@example.com", PASSWORD).await.status,
        StatusCode::OK
    );
}
