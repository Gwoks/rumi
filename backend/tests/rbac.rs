//! Access levels and ownership (PRD §5.3.1).

mod common;

use axum::http::StatusCode;
use common::*;
use serde_json::json;

const PARENT_GETS: [&str; 2] = ["/api/me/children", "/api/me/orders"];
const ADMIN_GETS: [&str; 6] = [
    "/api/admin/metrics",
    "/api/admin/cms",
    "/api/admin/classes",
    "/api/admin/kits",
    "/api/admin/students",
    "/api/admin/orders",
];

#[tokio::test]
async fn anonymous_gets_401_on_protected_routes() {
    let t = app().await;
    for path in PARENT_GETS.iter().chain(ADMIN_GETS.iter()) {
        let r = get(&t, path, None).await;
        assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{path}");
        assert_eq!(r.code(), "unauthorized");
    }
    let r = call(&t, "POST", "/api/orders", None, Some(json!({}))).await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    let bogus = get(
        &t,
        "/api/me/children",
        Some("rumi_session=not-a-real-token"),
    )
    .await;
    assert_eq!(bogus.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn parent_cannot_reach_admin_routes() {
    let t = app().await;
    let p = register(&t, "parent@example.com").await;
    for path in ADMIN_GETS {
        let r = get(&t, path, Some(&p.cookie)).await;
        assert_eq!(r.status, StatusCode::FORBIDDEN, "{path}");
        assert_eq!(r.code(), "forbidden");
    }
    let writes = [
        ("POST", "/api/admin/kits"),
        ("PATCH", "/api/admin/orders/1/status"),
        ("DELETE", "/api/admin/classes/1"),
        ("POST", "/api/admin/assessments"),
        ("PATCH", "/api/admin/enrollments/1"),
    ];
    for (method, path) in writes {
        let r = call(&t, method, path, Some(&p.cookie), Some(json!({}))).await;
        assert_eq!(r.status, StatusCode::FORBIDDEN, "{method} {path}");
    }
}

#[tokio::test]
async fn admin_cannot_use_parent_routes() {
    let t = app().await;
    let cookie = admin(&t).await;
    for path in PARENT_GETS {
        assert_eq!(
            get(&t, path, Some(&cookie)).await.status,
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    let r = call(&t, "POST", "/api/orders", Some(&cookie), Some(json!({}))).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn parent_a_cannot_touch_parent_b_children() {
    let t = app().await;
    let a = register(&t, "a@example.com").await;
    let b = register(&t, "b@example.com").await;
    let child = b.child_id;
    for suffix in ["assessments", "enrollments", "report"] {
        let r = get(
            &t,
            &format!("/api/me/children/{child}/{suffix}"),
            Some(&a.cookie),
        )
        .await;
        assert_eq!(r.status, StatusCode::NOT_FOUND, "{suffix}");
        assert_eq!(r.code(), "not_found");
    }
    let patch = call(
        &t,
        "PATCH",
        &format!("/api/me/children/{child}"),
        Some(&a.cookie),
        Some(json!({"name": "X"})),
    )
    .await;
    assert_eq!(patch.status, StatusCode::NOT_FOUND);
    let delete = call(
        &t,
        "DELETE",
        &format!("/api/me/children/{child}"),
        Some(&a.cookie),
        None,
    )
    .await;
    assert_eq!(delete.status, StatusCode::NOT_FOUND);
    // B still sees the child untouched.
    let list = get(&t, "/api/me/children", Some(&b.cookie)).await;
    assert_eq!(list.data()[0]["name"], "Amina");
    let a_list = get(&t, "/api/me/children", Some(&a.cookie)).await;
    assert_eq!(a_list.data().as_array().unwrap().len(), 1);
    assert_eq!(a_list.data()[0]["id"], a.child_id);
}

#[tokio::test]
async fn checkout_with_someone_elses_child_is_404() {
    let t = app().await;
    let a = register(&t, "a@example.com").await;
    let b = register(&t, "b@example.com").await;
    let class = insert_class(&t.pool, "Bulan & Gerak", 7, 12, 200_000).await;
    let items = json!([{"type": "CLASS", "class_id": class, "child_id": b.child_id}]);
    let r = checkout(&t, &a.cookie, &uuid(1), items).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
    assert_eq!(r.body["error"], "Data anak tidak ditemukan.");
    assert_eq!(
        scalar(&t.pool, "SELECT seats_booked FROM weekend_classes").await,
        0
    );
    assert_eq!(scalar(&t.pool, "SELECT COUNT(*) FROM orders").await, 0);
}

#[tokio::test]
async fn parents_only_see_their_own_orders() {
    let t = app().await;
    let a = register(&t, "a@example.com").await;
    let b = register(&t, "b@example.com").await;
    let kit = insert_kit(&t.pool, "Nampan", 185_000, 5).await;
    let r = checkout(
        &t,
        &a.cookie,
        &uuid(1),
        json!([{"type": "KIT", "kit_id": kit, "quantity": 1}]),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED);
    assert_eq!(
        get(&t, "/api/me/orders", Some(&a.cookie))
            .await
            .data()
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert!(get(&t, "/api/me/orders", Some(&b.cookie))
        .await
        .data()
        .as_array()
        .unwrap()
        .is_empty());
    // Same idempotency key from another parent is a different order.
    let other = checkout(
        &t,
        &b.cookie,
        &uuid(1),
        json!([{"type": "KIT", "kit_id": kit, "quantity": 1}]),
    )
    .await;
    assert_eq!(other.status, StatusCode::CREATED);
}
