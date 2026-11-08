//! Transport-level contract (PRD §5.1, §5.2, §5.3.3, §5.12): envelope shape,
//! 400/404/405/413/422, Origin check, headers, SPA fallback, panics.

mod common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::*;
use serde_json::{json, Value};

#[tokio::test]
async fn health_endpoints() {
    let t = app().await;
    let r = get(&t, "/api/health", None).await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(
        r.body,
        json!({"success": true, "data": {"status": "ok", "version": env!("CARGO_PKG_VERSION")}, "error": null})
    );
    assert_eq!(r.header("cache-control"), Some("no-store"));
    assert!(r
        .header("content-type")
        .unwrap()
        .starts_with("application/json"));

    let live = get(&t, "/healthz", None).await;
    assert_eq!(live.status, StatusCode::OK);
    assert_eq!(live.text, "ok");
}

#[tokio::test]
async fn health_reports_unavailable_when_db_is_closed() {
    let t = app().await;
    t.pool.close().await;
    let r = get(&t, "/api/health", None).await;
    assert_eq!(r.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(r.code(), "unavailable");
}

#[tokio::test]
async fn unknown_api_route_is_json_404_never_spa() {
    let t = app().await;
    for path in ["/api/nope", "/api", "/api/admin/unknown/deep"] {
        let r = get(&t, path, None).await;
        assert_eq!(r.status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(
            r.body,
            json!({"success": false, "data": null, "error": "Data tidak ditemukan.", "code": "not_found"})
        );
        assert_eq!(r.header("cache-control"), Some("no-store"));
    }
}

#[tokio::test]
async fn wrong_method_is_405_envelope() {
    let t = app().await;
    let r = call(&t, "DELETE", "/api/classes", None, None).await;
    assert_eq!(r.status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(r.code(), "method_not_allowed");
    assert!(r.header("allow").is_some());
}

#[tokio::test]
async fn non_numeric_path_ids_are_404() {
    let t = app().await;
    for path in [
        "/api/classes/abc",
        "/api/classes/0",
        "/api/classes/-1",
        "/api/kits/1.5",
    ] {
        let r = get(&t, path, None).await;
        assert_eq!(r.status, StatusCode::NOT_FOUND, "{path}");
        assert_eq!(r.code(), "not_found");
    }
}

#[tokio::test]
async fn malformed_json_and_missing_content_type_are_400() {
    let t = app().await;
    let bad_json = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("host", HOST)
        .header("content-type", "application/json")
        .body(Body::from("{not json"))
        .unwrap();
    let r = send(&t.app, bad_json).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    assert_eq!(r.code(), "bad_request");

    let no_ct = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("host", HOST)
        .body(Body::from("{}"))
        .unwrap();
    let r = send(&t.app, no_ct).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn validation_errors_are_422_with_fields() {
    let t = app().await;
    let r = call(
        &t,
        "POST",
        "/api/auth/register",
        None,
        Some(json!({"parent": {}, "child": {"dob": "x"}})),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(r.code(), "validation_error");
    let fields = r.body["fields"].as_object().unwrap();
    for key in [
        "parent.email",
        "parent.full_name",
        "parent.phone_wa",
        "parent.password",
        "child.name",
        "child.dob",
    ] {
        assert!(fields.contains_key(key), "{key}");
    }
    let not_object = call(&t, "POST", "/api/auth/login", None, Some(json!([1, 2]))).await;
    assert_eq!(not_object.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(not_object.body.get("fields").is_none());
}

#[tokio::test]
async fn oversized_bodies_are_413() {
    let t = app().await;
    let declared = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("host", HOST)
        .header("content-type", "application/json")
        .header("content-length", "70000")
        .body(Body::from("{}"))
        .unwrap();
    let r = send(&t.app, declared).await;
    assert_eq!(r.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(r.code(), "payload_too_large");

    // No Content-Length (streamed): the extractor's limit catches it.
    let big = json!({"email": "a@b.co", "password": "x".repeat(70 * 1024)});
    let streamed = Request::builder()
        .method("POST")
        .uri("/api/auth/login")
        .header("host", HOST)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&big).unwrap()))
        .unwrap();
    let r = send(&t.app, streamed).await;
    assert_eq!(r.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(r.code(), "payload_too_large");
}

fn with_origin(origin: Option<&str>, host: &str) -> Request<Body> {
    let b = Request::builder()
        .method("POST")
        .uri("/api/auth/logout")
        .header("host", host);
    let b = match origin {
        Some(o) => b.header("origin", o),
        None => b,
    };
    b.body(Body::empty()).unwrap()
}

#[tokio::test]
async fn origin_check_on_mutating_requests() {
    let t = app().await;
    let foreign = send(
        &t.app,
        with_origin(Some("https://evil.example"), "localhost:8080"),
    )
    .await;
    assert_eq!(foreign.status, StatusCode::FORBIDDEN);
    assert_eq!(foreign.code(), "origin_mismatch");
    let same = send(
        &t.app,
        with_origin(Some("http://localhost:8080"), "localhost:8080"),
    )
    .await;
    assert_eq!(same.status, StatusCode::OK);
    let absent = send(&t.app, with_origin(None, "localhost:8080")).await;
    assert_eq!(absent.status, StatusCode::OK);
    // GETs are never Origin-checked.
    let get_req = Request::builder()
        .uri("/api/health")
        .header("host", HOST)
        .header("origin", "https://evil.example")
        .body(Body::empty())
        .unwrap();
    assert_eq!(send(&t.app, get_req).await.status, StatusCode::OK);
}

#[tokio::test]
async fn public_base_url_host_is_an_allowed_origin() {
    let cfg = rumi::config::Config {
        public_base_url: "https://rumi-stg.kasibah.com".into(),
        ..test_config()
    };
    let t = app_with(cfg).await;
    let r = send(
        &t.app,
        with_origin(Some("https://rumi-stg.kasibah.com"), "127.0.0.1:8080"),
    )
    .await;
    assert_eq!(r.status, StatusCode::OK);
}

#[tokio::test]
async fn security_headers_on_every_response() {
    let t = app().await;
    for path in ["/api/health", "/healthz", "/api/nope", "/some/page"] {
        let r = get(&t, path, None).await;
        assert_eq!(
            r.header("x-content-type-options"),
            Some("nosniff"),
            "{path}"
        );
        assert_eq!(r.header("x-frame-options"), Some("DENY"));
        assert_eq!(
            r.header("referrer-policy"),
            Some("strict-origin-when-cross-origin")
        );
        assert!(r
            .header("content-security-policy")
            .unwrap()
            .contains("frame-ancestors 'none'"));
    }
}

#[tokio::test]
async fn spa_serves_files_assets_and_index_fallback() {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("index.html"), "<html>rumi</html>").unwrap();
    std::fs::create_dir(dir.path().join("assets")).unwrap();
    std::fs::write(dir.path().join("assets/app.js"), "console.log(1)").unwrap();
    std::fs::write(dir.path().join("robots.txt"), "ok").unwrap();
    let cfg = rumi::config::Config {
        static_dir: dir.path().to_string_lossy().to_string(),
        ..test_config()
    };
    let t = app_with(cfg).await;

    let asset = get(&t, "/assets/app.js", None).await;
    assert_eq!(asset.status, StatusCode::OK);
    assert_eq!(
        asset.header("cache-control"),
        Some("public, max-age=31536000, immutable")
    );
    assert!(asset
        .header("content-type")
        .unwrap()
        .starts_with("text/javascript"));

    let file = get(&t, "/robots.txt", None).await;
    assert_eq!(file.text, "ok");
    assert_eq!(file.header("cache-control"), Some("no-cache"));

    for path in ["/", "/parent/dashboard", "/weekend-classes?age=4"] {
        let page = get(&t, path, None).await;
        assert_eq!(page.status, StatusCode::OK, "{path}");
        assert_eq!(page.text, "<html>rumi</html>");
        assert_eq!(page.header("cache-control"), Some("no-cache"));
    }
    let traversal = get(&t, "/assets/../../etc/passwd", None).await;
    assert_eq!(traversal.status, StatusCode::NOT_FOUND);
    assert!(!traversal.text.contains("root:"));
    let post = call(&t, "POST", "/some/page", None, None).await;
    assert_eq!(post.status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn spa_without_build_is_plain_404() {
    let t = app().await;
    let r = get(&t, "/", None).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
    assert_eq!(r.body, Value::Null);
}
