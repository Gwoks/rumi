//! Public catalog + CMS (#2–#6) and the parent's children (#13–#19).

mod common;

use axum::http::StatusCode;
use common::*;
use serde_json::{json, Value};

const KEMANG: &str = "Rumah Teduh, Kemang (Jakarta Selatan)";

async fn set(t: &TestApp, sql: &str, id: i64) {
    sqlx::query(sql).bind(id).execute(&t.pool).await.unwrap();
}

#[tokio::test]
async fn cms_pages_render_active_sections_in_order() {
    let t = app().await;
    rumi::seed::catalog::seed(&t.pool).await.unwrap();
    let home = get(&t, "/api/cms/home", None).await;
    assert_eq!(home.status, StatusCode::OK);
    assert_eq!(home.data()["page_slug"], "home");
    let keys: Vec<&str> = home.data()["sections"]
        .as_array()
        .unwrap()
        .iter()
        .map(|s| s["section_key"].as_str().unwrap())
        .collect();
    assert_eq!(keys, vec!["hero", "rumi_way"]);
    let hero = &home.data()["sections"][0];
    assert_eq!(hero["body"]["heading_highlight"], "bertanya & bertumbuh.");
    assert_eq!(hero["title"], "Hero Beranda");
    assert_eq!(hero["is_active"], true);
    assert_eq!(hero["image_url"], Value::Null);

    sqlx::query("UPDATE cms_content SET is_active = 0 WHERE section_key = 'hero'")
        .execute(&t.pool)
        .await
        .unwrap();
    let after = get(&t, "/api/cms/home", None).await;
    assert_eq!(after.data()["sections"].as_array().unwrap().len(), 1);
    let who = get(&t, "/api/cms/who-we-are", None).await;
    assert_eq!(who.data()["sections"].as_array().unwrap().len(), 4);
    assert_eq!(
        get(&t, "/api/cms/blog", None).await.status,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn empty_page_has_no_sections() {
    let t = app().await;
    let r = get(&t, "/api/cms/our-approach", None).await;
    assert_eq!(r.data()["sections"], json!([]));
}

struct Classes {
    a: i64,
    b: i64,
    past: i64,
    draft: i64,
    cancelled: i64,
    deleted: i64,
}

async fn classes(t: &TestApp) -> Classes {
    let a = insert_class(&t.pool, "A", 7, 12, 200_000).await;
    let b = insert_class(&t.pool, "B", 14, 12, 175_000).await;
    set(
        t,
        "UPDATE weekend_classes SET location = 'Ruang Kenari, Bintaro', age_min = 4 WHERE id = ?",
        b,
    )
    .await;
    let past = insert_class(&t.pool, "Past", -3, 12, 1).await;
    let draft = insert_class(&t.pool, "Draft", 10, 12, 1).await;
    set(
        t,
        "UPDATE weekend_classes SET status = 'DRAFT' WHERE id = ?",
        draft,
    )
    .await;
    let cancelled = insert_class(&t.pool, "Batal", 10, 12, 1).await;
    set(
        t,
        "UPDATE weekend_classes SET status = 'CANCELLED' WHERE id = ?",
        cancelled,
    )
    .await;
    let deleted = insert_class(&t.pool, "Hapus", 5, 12, 1).await;
    set(
        t,
        "UPDATE weekend_classes SET deleted_at = datetime('now') WHERE id = ?",
        deleted,
    )
    .await;
    Classes {
        a,
        b,
        past,
        draft,
        cancelled,
        deleted,
    }
}

fn ids(r: &Resp) -> Vec<i64> {
    r.data()["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["id"].as_i64().unwrap())
        .collect()
}

#[tokio::test]
async fn class_list_shows_open_upcoming_with_filters_and_facet() {
    let t = app().await;
    let c = classes(&t).await;
    let all = get(&t, "/api/classes", None).await;
    assert_eq!(ids(&all), vec![c.a, c.b]);
    assert_eq!(
        all.data()["locations"],
        json!(["Ruang Kenari, Bintaro", KEMANG])
    );
    let first = &all.data()["items"][0];
    assert_eq!(first["age_range"], "3\u{2013}6");
    assert_eq!(first["seats_left"], 12);
    assert_eq!(first["is_full"], false);
    assert_eq!(first["is_upcoming"], true);

    let by_location = get(
        &t,
        "/api/classes?location=rumah%20teduh,%20kemang%20(jakarta%20selatan)",
        None,
    )
    .await;
    assert_eq!(ids(&by_location), vec![c.a]);
    assert_eq!(by_location.data()["locations"].as_array().unwrap().len(), 2);
    let from = get(&t, &format!("/api/classes?from={}", date_in(10)), None).await;
    assert_eq!(ids(&from), vec![c.b]);
    let to = get(&t, &format!("/api/classes?to={}", date_in(10)), None).await;
    assert_eq!(ids(&to), vec![c.a]);
    let age = get(&t, "/api/classes?age=3", None).await;
    assert_eq!(ids(&age), vec![c.a]);
}

#[tokio::test]
async fn class_list_rejects_bad_query_params() {
    let t = app().await;
    for (query, field) in [
        ("age=13", "age"),
        ("age=x", "age"),
        ("from=2026-13-01", "from"),
        (
            &format!("from={}&to={}", date_in(5), date_in(1)) as &str,
            "to",
        ),
    ] {
        let r = get(&t, &format!("/api/classes?{query}"), None).await;
        assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY, "{query}");
        assert!(r.body["fields"][field].is_string(), "{query}");
    }
    let long = format!("/api/classes?location={}", "x".repeat(161));
    assert_eq!(
        get(&t, &long, None).await.status,
        StatusCode::UNPROCESSABLE_ENTITY
    );
}

#[tokio::test]
async fn class_detail_visibility() {
    let t = app().await;
    let c = classes(&t).await;
    assert_eq!(
        get(&t, &format!("/api/classes/{}", c.a), None).await.status,
        StatusCode::OK
    );
    let past = get(&t, &format!("/api/classes/{}", c.past), None).await;
    assert_eq!(past.status, StatusCode::OK);
    assert_eq!(past.data()["is_upcoming"], false);
    assert_eq!(
        get(&t, &format!("/api/classes/{}", c.cancelled), None)
            .await
            .data()["status"],
        "CANCELLED"
    );
    for hidden in [c.draft, c.deleted, 9_999] {
        assert_eq!(
            get(&t, &format!("/api/classes/{hidden}"), None)
                .await
                .status,
            StatusCode::NOT_FOUND
        );
    }
}

#[tokio::test]
async fn kits_list_active_including_out_of_stock() {
    let t = app().await;
    let a = insert_kit(&t.pool, "Nampan", 185_000, 0).await;
    let b = insert_kit(&t.pool, "Kartu", 120_000, 8).await;
    set(
        &t,
        "UPDATE play_kits SET category = 'ISLAMIC_STUDIES' WHERE id = ?",
        b,
    )
    .await;
    let hidden = insert_kit(&t.pool, "Nonaktif", 1, 1).await;
    set(
        &t,
        "UPDATE play_kits SET is_active = 0 WHERE id = ?",
        hidden,
    )
    .await;

    let all = get(&t, "/api/kits", None).await;
    let names: Vec<&str> = all
        .data()
        .as_array()
        .unwrap()
        .iter()
        .map(|k| k["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, vec!["Kartu", "Nampan"]);
    assert_eq!(all.data()[1]["stock"], 0);
    assert_eq!(all.data()[1]["badge_tag"], Value::Null);
    let math = get(&t, "/api/kits?category=ISLAMIC_STUDIES", None).await;
    assert_eq!(math.data().as_array().unwrap().len(), 1);
    let bad = get(&t, "/api/kits?category=COOKING", None).await;
    assert_eq!(bad.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(bad.body["fields"]["category"].is_string());

    assert_eq!(
        get(&t, &format!("/api/kits/{a}"), None).await.data()["price_idr"],
        185_000
    );
    assert_eq!(
        get(&t, &format!("/api/kits/{hidden}"), None).await.status,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn children_crud_for_the_owner() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    let id = add_child(&t, &p.cookie, "  Zaid  ").await;
    let list = get(&t, "/api/me/children", Some(&p.cookie)).await;
    let names: Vec<&str> = list
        .data()
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, vec!["Amina", "Zaid"]);

    let path = format!("/api/me/children/{id}");
    let patched = call(
        &t,
        "PATCH",
        &path,
        Some(&p.cookie),
        Some(json!({"notes": "Suka melukis", "name": "Zaid R."})),
    )
    .await;
    assert_eq!(patched.status, StatusCode::OK);
    assert_eq!(patched.data()["notes"], "Suka melukis");
    assert_eq!(patched.data()["name"], "Zaid R.");
    let cleared = call(
        &t,
        "PATCH",
        &path,
        Some(&p.cookie),
        Some(json!({"notes": null})),
    )
    .await;
    assert_eq!(cleared.data()["notes"], Value::Null);
    let not_null = call(
        &t,
        "PATCH",
        &path,
        Some(&p.cookie),
        Some(json!({"dob": null})),
    )
    .await;
    assert_eq!(not_null.status, StatusCode::UNPROCESSABLE_ENTITY);
    let nothing = call(
        &t,
        "PATCH",
        &path,
        Some(&p.cookie),
        Some(json!({"color": "blue"})),
    )
    .await;
    assert_eq!(nothing.body["error"], "Tidak ada perubahan.");
    let bad = call(
        &t,
        "POST",
        "/api/me/children",
        Some(&p.cookie),
        Some(json!({"name": "", "dob": "2026-02-30"})),
    )
    .await;
    assert!(bad.body["fields"]["name"].is_string() && bad.body["fields"]["dob"].is_string());

    let deleted = call(&t, "DELETE", &path, Some(&p.cookie), None).await;
    assert_eq!(
        deleted.body,
        json!({"success": true, "data": null, "error": null})
    );
    assert_eq!(
        call(&t, "DELETE", &path, Some(&p.cookie), None)
            .await
            .status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get(&t, "/api/me/children", Some(&p.cookie))
            .await
            .data()
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn child_with_active_seat_cannot_be_deleted() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    let class = insert_class(&t.pool, "Bulan", 7, 12, 1).await;
    let items = json!([{"type": "CLASS", "class_id": class, "child_id": p.child_id}]);
    assert_eq!(
        checkout(&t, &p.cookie, &uuid(1), items).await.status,
        StatusCode::CREATED
    );
    let r = call(
        &t,
        "DELETE",
        &format!("/api/me/children/{}", p.child_id),
        Some(&p.cookie),
        None,
    )
    .await;
    assert_eq!(r.status, StatusCode::CONFLICT);
    assert_eq!(r.code(), "conflict");
    assert_eq!(r.body["error"], "Anak masih memiliki kelas aktif.");
}

#[tokio::test]
async fn child_views_for_the_owner() {
    let t = app().await;
    let p = register(&t, "nadia@example.com").await;
    let class = insert_class(&t.pool, "Bulan", 7, 12, 1).await;
    let items = json!([{"type": "CLASS", "class_id": class, "child_id": p.child_id}]);
    let order = checkout(&t, &p.cookie, &uuid(1), items).await;
    let base = format!("/api/me/children/{}", p.child_id);

    assert_eq!(
        get(&t, &format!("{base}/assessments"), Some(&p.cookie))
            .await
            .data(),
        &json!([])
    );
    let enrollments = get(&t, &format!("{base}/enrollments"), Some(&p.cookie)).await;
    let e = &enrollments.data()[0];
    assert_eq!(e["status"], "RESERVED");
    assert_eq!(e["class_title"], "Bulan");
    assert_eq!(e["order_code"], order.data()["order"]["order_code"]);
    assert_eq!(e["class_time_slot"], "09:30\u{2013}11:30");

    let report = get(&t, &format!("{base}/report"), Some(&p.cookie)).await;
    assert_eq!(report.status, StatusCode::OK);
    let data = report.data();
    assert_eq!(data["child"]["id"], p.child_id);
    assert_eq!(data["latest_levels"].as_array().unwrap().len(), 5);
    assert_eq!(data["latest_levels"][0]["domain"], "PRACTICAL_LIFE");
    assert_eq!(data["latest_levels"][0]["level"], Value::Null);
    assert_eq!(
        data["attendance"],
        json!({"attended": 0, "absent": 0, "upcoming": 1, "attendance_rate_pct": null})
    );
    assert_eq!(data["enrollments"].as_array().unwrap().len(), 1);
    assert!(data["generated_at"].as_str().unwrap().ends_with('Z'));
}
