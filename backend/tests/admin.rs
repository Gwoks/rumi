//! Admin CRUD (#23–#34): CMS registry, classes, kits, soft delete, 409 rules.

mod common;

use axum::http::StatusCode;
use common::*;
use serde_json::{json, Value};

async fn admin_app() -> (TestApp, String) {
    let t = app().await;
    rumi::seed::catalog::seed(&t.pool).await.unwrap();
    let cookie = admin(&t).await;
    (t, cookie)
}

fn prose(heading: &str) -> Value {
    json!({"eyebrow": "Filosofi", "heading": heading, "paragraphs": ["Satu.", "Dua."]})
}

#[tokio::test]
async fn cms_list_filters_and_ordering() {
    let (t, a) = admin_app().await;
    let all = get(&t, "/api/admin/cms", Some(&a)).await;
    let rows = all.data().as_array().unwrap();
    assert_eq!(rows.len(), 9);
    assert_eq!(rows[0]["page_slug"], "home");
    assert_eq!(rows[2]["page_slug"], "our-approach");
    let home = get(&t, "/api/admin/cms?page_slug=home", Some(&a)).await;
    assert_eq!(home.data().as_array().unwrap().len(), 2);
    let bad = get(&t, "/api/admin/cms?page_slug=blog", Some(&a)).await;
    assert_eq!(bad.status, StatusCode::UNPROCESSABLE_ENTITY);
}

#[tokio::test]
async fn cms_create_conflict_delete_and_recreate() {
    let (t, a) = admin_app().await;
    let body =
        json!({"page_slug": "who-we-are", "section_key": "philosophy", "body": prose("Baru")});
    let dupe = call(&t, "POST", "/api/admin/cms", Some(&a), Some(body.clone())).await;
    assert_eq!(dupe.status, StatusCode::CONFLICT);
    assert_eq!(dupe.code(), "conflict");

    let id: i64 = sqlx::query_scalar("SELECT id FROM cms_content WHERE section_key = 'philosophy'")
        .fetch_one(&t.pool)
        .await
        .unwrap();
    let del = call(
        &t,
        "DELETE",
        &format!("/api/admin/cms/{id}"),
        Some(&a),
        None,
    )
    .await;
    assert_eq!(del.status, StatusCode::OK);
    assert_eq!(
        call(
            &t,
            "DELETE",
            &format!("/api/admin/cms/{id}"),
            Some(&a),
            None
        )
        .await
        .status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get(&t, "/api/cms/who-we-are", None).await.data()["sections"]
            .as_array()
            .unwrap()
            .len(),
        3
    );

    let mut again = body;
    again["title"] = json!("  Filosofi Baru ");
    again["sort_order"] = json!(25);
    again["is_active"] = json!(false);
    again["image_url"] = json!("/brand/rumi-logo.svg");
    let created = call(&t, "POST", "/api/admin/cms", Some(&a), Some(again)).await;
    assert_eq!(created.status, StatusCode::CREATED, "{}", created.text);
    let d = created.data();
    assert_eq!(d["title"], "Filosofi Baru");
    assert_eq!(d["sort_order"], 25);
    assert_eq!(d["is_active"], false);
    assert_eq!(d["body"]["heading"], "Baru");
    assert_eq!(d["image_url"], "/brand/rumi-logo.svg");
}

#[tokio::test]
async fn cms_create_validates_registry_and_body_strictly() {
    let (t, a) = admin_app().await;
    let unknown_pair = json!({"page_slug": "home", "section_key": "values", "body": prose("x")});
    let r = call(&t, "POST", "/api/admin/cms", Some(&a), Some(unknown_pair)).await;
    assert!(r.body["fields"]["section_key"].is_string());
    let unknown_page = json!({"page_slug": "blog", "section_key": "hero", "body": {}});
    let r = call(&t, "POST", "/api/admin/cms", Some(&a), Some(unknown_page)).await;
    assert!(r.body["fields"]["page_slug"].is_string());
    let no_key = json!({"page_slug": "home", "body": {}});
    assert!(call(&t, "POST", "/api/admin/cms", Some(&a), Some(no_key))
        .await
        .body["fields"]["section_key"]
        .is_string());

    sqlx::query(
        "UPDATE cms_content SET deleted_at = datetime('now') WHERE section_key = 'philosophy'",
    )
    .execute(&t.pool)
    .await
    .unwrap();
    let mut extra = prose("x");
    extra["extra"] = json!(1);
    let strict = json!({"page_slug": "who-we-are", "section_key": "philosophy", "body": extra, "image_url": "http://x"});
    let r = call(&t, "POST", "/api/admin/cms", Some(&a), Some(strict)).await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(r.body["fields"]["body.extra"].is_string());
    assert!(r.body["fields"]["image_url"].is_string());
    let missing_body = json!({"page_slug": "who-we-are", "section_key": "philosophy"});
    assert!(
        call(&t, "POST", "/api/admin/cms", Some(&a), Some(missing_body))
            .await
            .body["fields"]["body"]
            .is_string()
    );
}

#[tokio::test]
async fn cms_patch_validates_against_the_rows_pair() {
    let (t, a) = admin_app().await;
    let id: i64 = sqlx::query_scalar("SELECT id FROM cms_content WHERE section_key = 'hero'")
        .fetch_one(&t.pool)
        .await
        .unwrap();
    let path = format!("/api/admin/cms/{id}");
    let wrong_shape = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"body": prose("x")})),
    )
    .await;
    assert_eq!(wrong_shape.status, StatusCode::UNPROCESSABLE_ENTITY);
    let null_body = call(&t, "PATCH", &path, Some(&a), Some(json!({"body": null}))).await;
    assert!(null_body.body["fields"]["body"].is_string());
    let nothing = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"page_slug": "who-we-are"})),
    )
    .await;
    assert_eq!(nothing.body["error"], "Tidak ada perubahan.");

    let current = get(&t, "/api/admin/cms?page_slug=home", Some(&a)).await;
    let mut hero = current.data()[0]["body"].clone();
    hero["heading"] = json!("  Ruang tumbuh  ");
    hero["social_proof"] = Value::Null;
    let ok = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"body": hero, "title": null, "sort_order": -5})),
    )
    .await;
    assert_eq!(ok.status, StatusCode::OK, "{}", ok.text);
    assert_eq!(ok.data()["body"]["heading"], "Ruang tumbuh");
    assert_eq!(ok.data()["body"]["social_proof"], Value::Null);
    assert_eq!(ok.data()["title"], Value::Null);
    assert_eq!(ok.data()["sort_order"], -5);
    assert_eq!(ok.data()["page_slug"], "home");
    let missing = call(
        &t,
        "PATCH",
        "/api/admin/cms/9999",
        Some(&a),
        Some(json!({"title": "x"})),
    )
    .await;
    assert_eq!(missing.status, StatusCode::NOT_FOUND);
}

fn class_body(days: i64) -> Value {
    json!({
        "title": "Kelas Baru", "description": "Belajar bersama.", "location": "Studio Bambu, BSD",
        "image_url": null, "age_min": 3, "age_max": 6, "date": date_in(days),
        "start_time": "09:30", "end_time": "11:30", "fee_idr": 150000, "capacity": 2,
        "seats_booked": 2
    })
}

#[tokio::test]
async fn class_create_rules() {
    let (t, a) = admin_app().await;
    let r = call(
        &t,
        "POST",
        "/api/admin/classes",
        Some(&a),
        Some(class_body(10)),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    assert_eq!(r.data()["status"], "DRAFT");
    assert_eq!(
        r.data()["seats_booked"],
        0,
        "seats_booked is never client-set"
    );
    assert_eq!(r.data()["time_slot"], "09:30\u{2013}11:30");

    let mut past = class_body(-1);
    past["status"] = json!("OPEN");
    assert!(call(&t, "POST", "/api/admin/classes", Some(&a), Some(past))
        .await
        .body["fields"]["date"]
        .is_string());
    let mut ages = class_body(10);
    ages["age_min"] = json!(6);
    ages["age_max"] = json!(3);
    ages["end_time"] = json!("09:00");
    let r = call(&t, "POST", "/api/admin/classes", Some(&a), Some(ages)).await;
    assert!(r.body["fields"]["age_max"].is_string() && r.body["fields"]["end_time"].is_string());
    let r = call(
        &t,
        "POST",
        "/api/admin/classes",
        Some(&a),
        Some(json!({"status": "LIVE"})),
    )
    .await;
    assert!(r.body["fields"]["title"].is_string() && r.body["fields"]["status"].is_string());

    let list = get(&t, "/api/admin/classes?status=DRAFT", Some(&a)).await;
    assert_eq!(list.data().as_array().unwrap().len(), 2);
    let bad = get(&t, "/api/admin/classes?status=LIVE", Some(&a)).await;
    assert_eq!(bad.status, StatusCode::UNPROCESSABLE_ENTITY);
}

async fn booked_class(t: &TestApp, a: &str) -> (i64, i64) {
    let p = register(t, "nadia@example.com").await;
    let created = call(
        t,
        "POST",
        "/api/admin/classes",
        Some(a),
        Some(class_body(10)),
    )
    .await;
    let id = created.data()["id"].as_i64().unwrap();
    call(
        t,
        "PATCH",
        &format!("/api/admin/classes/{id}"),
        Some(a),
        Some(json!({"status": "OPEN"})),
    )
    .await;
    let items = json!([{"type": "CLASS", "class_id": id, "child_id": p.child_id}]);
    let order = checkout(t, &p.cookie, &uuid(1), items).await;
    assert_eq!(order.status, StatusCode::CREATED, "{}", order.text);
    (id, order.data()["order"]["id"].as_i64().unwrap())
}

#[tokio::test]
async fn class_patch_and_delete_rules() {
    let (t, a) = admin_app().await;
    let (id, order) = booked_class(&t, &a).await;
    let path = format!("/api/admin/classes/{id}");

    let shrink = call(&t, "PATCH", &path, Some(&a), Some(json!({"capacity": 0}))).await;
    assert!(shrink.body["fields"]["capacity"].is_string());
    let below = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"capacity": 1, "seats_booked": 0})),
    )
    .await;
    assert_eq!(below.status, StatusCode::OK);
    assert_eq!(below.data()["seats_booked"], 1);
    assert_eq!(below.data()["is_full"], true);
    let past = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"date": date_in(-3)})),
    )
    .await;
    assert!(past.body["fields"]["date"].is_string());
    let times = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"end_time": "08:00"})),
    )
    .await;
    assert!(times.body["fields"]["end_time"].is_string());

    for status in ["CANCELLED", "DRAFT"] {
        let r = call(
            &t,
            "PATCH",
            &path,
            Some(&a),
            Some(json!({"status": status})),
        )
        .await;
        assert_eq!(r.status, StatusCode::CONFLICT, "{status}");
        assert_eq!(r.body["error"], "Batalkan pesanan terkait terlebih dahulu.");
    }
    let closed = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"status": "CLOSED", "title": "Kelas Tutup"})),
    )
    .await;
    assert_eq!(closed.data()["status"], "CLOSED");
    assert_eq!(
        call(&t, "DELETE", &path, Some(&a), None).await.status,
        StatusCode::CONFLICT
    );

    let cancel = call(
        &t,
        "PATCH",
        &format!("/api/admin/orders/{order}/status"),
        Some(&a),
        Some(json!({"status": "CANCELLED"})),
    )
    .await;
    assert_eq!(cancel.status, StatusCode::OK);
    assert_eq!(
        call(&t, "DELETE", &path, Some(&a), None).await.status,
        StatusCode::OK
    );
    assert_eq!(
        call(&t, "PATCH", &path, Some(&a), Some(json!({"title": "x"})))
            .await
            .status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(&t, "DELETE", &path, Some(&a), None).await.status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get(&t, &format!("/api/classes/{id}"), None).await.status,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn kit_crud_and_soft_delete() {
    let (t, a) = admin_app().await;
    let body = json!({"name": "Puzzle Hijaiyah", "category": "LANGUAGE", "description": "Kayu.", "price_idr": 99000, "stock": 3});
    let created = call(&t, "POST", "/api/admin/kits", Some(&a), Some(body)).await;
    assert_eq!(created.status, StatusCode::CREATED, "{}", created.text);
    assert_eq!(created.data()["is_active"], true);
    assert_eq!(created.data()["badge_tag"], Value::Null);
    let id = created.data()["id"].as_i64().unwrap();
    let path = format!("/api/admin/kits/{id}");

    let bad = call(
        &t,
        "POST",
        "/api/admin/kits",
        Some(&a),
        Some(json!({"category": "COOKING", "price_idr": -1})),
    )
    .await;
    for key in ["name", "category", "price_idr", "stock", "description"] {
        assert!(bad.body["fields"][key].is_string(), "{key}");
    }

    let patched = call(
        &t,
        "PATCH",
        &path,
        Some(&a),
        Some(json!({"stock": 40, "badge_tag": "Baru", "is_active": false})),
    )
    .await;
    assert_eq!(patched.data()["stock"], 40);
    assert_eq!(patched.data()["badge_tag"], "Baru");
    assert_eq!(
        get(&t, &format!("/api/kits/{id}"), None).await.status,
        StatusCode::NOT_FOUND
    );
    let admin_list = get(&t, "/api/admin/kits?category=LANGUAGE", Some(&a)).await;
    assert_eq!(admin_list.data().as_array().unwrap().len(), 1);
    assert_eq!(
        get(&t, "/api/admin/kits?category=X", Some(&a)).await.status,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    let empty = call(&t, "PATCH", &path, Some(&a), Some(json!({}))).await;
    assert_eq!(empty.body["error"], "Tidak ada perubahan.");
    let not_null = call(&t, "PATCH", &path, Some(&a), Some(json!({"name": null}))).await;
    assert!(not_null.body["fields"]["name"].is_string());

    assert_eq!(
        call(&t, "DELETE", &path, Some(&a), None).await.status,
        StatusCode::OK
    );
    assert_eq!(
        call(&t, "DELETE", &path, Some(&a), None).await.status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        call(&t, "PATCH", &path, Some(&a), Some(json!({"stock": 1})))
            .await
            .status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get(&t, "/api/admin/kits", Some(&a))
            .await
            .data()
            .as_array()
            .unwrap()
            .len(),
        4
    );
}
