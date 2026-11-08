//! Admin students (#35–#36), assessments (#37), attendance (#38), order list
//! (#39) and metrics (#22).

mod common;

use axum::http::StatusCode;
use common::*;
use serde_json::{json, Value};

struct Scene {
    t: TestApp,
    admin: String,
    parent: Parent,
    class: i64,
}

async fn scene() -> Scene {
    let t = app().await;
    let admin = admin(&t).await;
    let parent = register(&t, "nadia@example.com").await;
    let class = insert_class(&t.pool, "Bulan & Gerak", 7, 12, 200_000).await;
    Scene {
        t,
        admin,
        parent,
        class,
    }
}

async fn book(s: &Scene, key: u32) -> (i64, i64) {
    let items = json!([{"type": "CLASS", "class_id": s.class, "child_id": s.parent.child_id}]);
    let r = checkout(&s.t, &s.parent.cookie, &uuid(key), items).await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    let order = r.data()["order"]["id"].as_i64().unwrap();
    let enrollment = scalar(&s.t.pool, "SELECT MAX(id) FROM class_enrollments").await;
    (order, enrollment)
}

async fn set_order(s: &Scene, order: i64, status: &str) -> Resp {
    let path = format!("/api/admin/orders/{order}/status");
    call(
        &s.t,
        "PATCH",
        &path,
        Some(&s.admin),
        Some(json!({ "status": status })),
    )
    .await
}

async fn mark(s: &Scene, enrollment: i64, status: &str) -> Resp {
    let path = format!("/api/admin/enrollments/{enrollment}");
    call(
        &s.t,
        "PATCH",
        &path,
        Some(&s.admin),
        Some(json!({ "status": status })),
    )
    .await
}

#[tokio::test]
async fn student_directory_is_paginated_and_searchable() {
    let s = scene().await;
    let other = register(&s.t, "budi@example.com").await;
    add_child(&s.t, &other.cookie, "Zahra").await;
    let page = get(&s.t, "/api/admin/students?per_page=2", Some(&s.admin)).await;
    assert_eq!(
        page.data()["meta"],
        json!({"page": 1, "per_page": 2, "total": 3})
    );
    let names: Vec<&str> = page.data()["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|i| i["name"].as_str().unwrap())
        .collect();
    assert_eq!(names, vec!["Amina", "Amina"]);
    let second = get(
        &s.t,
        "/api/admin/students?per_page=2&page=2",
        Some(&s.admin),
    )
    .await;
    assert_eq!(second.data()["items"][0]["name"], "Zahra");
    let beyond = get(&s.t, "/api/admin/students?page=9", Some(&s.admin)).await;
    assert_eq!(beyond.data()["items"], json!([]));

    let q = get(&s.t, "/api/admin/students?q=BUDI%40", Some(&s.admin)).await;
    assert_eq!(q.data()["meta"]["total"], 2);
    let item = &q.data()["items"][0];
    assert_eq!(item["parent_email"], "budi@example.com");
    assert_eq!(item["parent_phone_wa"], "6281211112222");
    assert_eq!(item["attendance"]["attendance_rate_pct"], Value::Null);
    assert_eq!(item["latest_assessment_on"], Value::Null);
    let wildcard = get(&s.t, "/api/admin/students?q=%25", Some(&s.admin)).await;
    assert_eq!(wildcard.data()["meta"]["total"], 0);
    for bad in ["per_page=101", "page=0", "per_page=x"] {
        let r = get(&s.t, &format!("/api/admin/students?{bad}"), Some(&s.admin)).await;
        assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY, "{bad}");
    }
}

#[tokio::test]
async fn student_detail_and_assessments() {
    let s = scene().await;
    let child = s.parent.child_id;
    let body = json!({"child_id": child, "class_id": s.class, "domain": "MATH", "level": 3,
                      "milestone": "  Menghitung sampai 10  ", "notes": "", "observed_on": date_in(0)});
    let r = call(
        &s.t,
        "POST",
        "/api/admin/assessments",
        Some(&s.admin),
        Some(body),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    assert_eq!(r.data()["assessor_name"], "Admin RUMI");
    assert_eq!(r.data()["class_title"], "Bulan & Gerak");
    assert_eq!(r.data()["milestone"], "Menghitung sampai 10");
    assert_eq!(r.data()["notes"], Value::Null);

    let bad = json!({"child_id": child, "domain": "ART", "level": 5, "milestone": "", "observed_on": date_in(1)});
    let r = call(
        &s.t,
        "POST",
        "/api/admin/assessments",
        Some(&s.admin),
        Some(bad),
    )
    .await;
    for key in ["domain", "level", "milestone", "observed_on"] {
        assert!(r.body["fields"][key].is_string(), "{key}");
    }
    let base = json!({"domain": "MATH", "level": 1, "milestone": "m", "observed_on": date_in(0)});
    let mut ghost_child = base.clone();
    ghost_child["child_id"] = json!(9_999);
    assert_eq!(
        call(
            &s.t,
            "POST",
            "/api/admin/assessments",
            Some(&s.admin),
            Some(ghost_child)
        )
        .await
        .status,
        StatusCode::NOT_FOUND
    );
    let mut ghost_class = base;
    ghost_class["child_id"] = json!(child);
    ghost_class["class_id"] = json!(9_999);
    assert_eq!(
        call(
            &s.t,
            "POST",
            "/api/admin/assessments",
            Some(&s.admin),
            Some(ghost_class)
        )
        .await
        .status,
        StatusCode::NOT_FOUND
    );

    let detail = get(
        &s.t,
        &format!("/api/admin/students/{child}"),
        Some(&s.admin),
    )
    .await;
    assert_eq!(detail.status, StatusCode::OK);
    let d = detail.data();
    assert_eq!(d["parent"]["email"], "nadia@example.com");
    assert_eq!(
        d["latest_levels"][3],
        json!({"domain": "MATH", "level": 3, "observed_on": date_in(0), "milestone": "Menghitung sampai 10"})
    );
    assert_eq!(d["assessments"].as_array().unwrap().len(), 1);
    let summary = get(&s.t, "/api/admin/students?q=nadia", Some(&s.admin)).await;
    assert_eq!(
        summary.data()["items"][0]["latest_assessment_on"],
        date_in(0)
    );
    // A parent sees the same assessment.
    let mine = get(
        &s.t,
        &format!("/api/me/children/{child}/assessments"),
        Some(&s.parent.cookie),
    )
    .await;
    assert_eq!(mine.data().as_array().unwrap().len(), 1);
    assert_eq!(
        get(&s.t, "/api/admin/students/9999", Some(&s.admin))
            .await
            .status,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn attendance_marking_rules() {
    let s = scene().await;
    let (order, enrollment) = book(&s, 1).await;
    let reserved = mark(&s, enrollment, "ATTENDED").await;
    assert_eq!(reserved.status, StatusCode::CONFLICT);
    assert_eq!(reserved.code(), "invalid_transition");
    set_order(&s, order, "PAID").await;
    let future = mark(&s, enrollment, "ATTENDED").await;
    assert_eq!(
        future.body["error"],
        "Kehadiran hanya dapat dicatat pada atau setelah tanggal kelas."
    );

    sqlx::query("UPDATE weekend_classes SET date = ?")
        .bind(date_in(0))
        .execute(&s.t.pool)
        .await
        .unwrap();
    let attended = mark(&s, enrollment, "ATTENDED").await;
    assert_eq!(attended.status, StatusCode::OK, "{}", attended.text);
    assert_eq!(attended.data()["status"], "ATTENDED");
    assert_eq!(attended.data()["order_id"], order);
    assert_eq!(
        mark(&s, enrollment, "ATTENDED").await.status,
        StatusCode::OK
    );
    assert_eq!(
        mark(&s, enrollment, "ABSENT").await.data()["status"],
        "ABSENT"
    );
    assert_eq!(
        mark(&s, enrollment, "CANCELLED").await.status,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(
        mark(&s, 9_999, "ABSENT").await.status,
        StatusCode::NOT_FOUND
    );
    let report = get(
        &s.t,
        &format!("/api/me/children/{}/report", s.parent.child_id),
        Some(&s.parent.cookie),
    )
    .await;
    assert_eq!(
        report.data()["attendance"],
        json!({"attended": 0, "absent": 1, "upcoming": 0, "attendance_rate_pct": 0})
    );
}

#[tokio::test]
async fn admin_order_list_filters_and_paginates() {
    let s = scene().await;
    let (first, _) = book(&s, 1).await;
    let kit = insert_kit(&s.t.pool, "Nampan", 185_000, 9).await;
    let second = checkout(
        &s.t,
        &s.parent.cookie,
        &uuid(2),
        json!([{"type": "KIT", "kit_id": kit, "quantity": 1}]),
    )
    .await;
    set_order(&s, first, "PAID").await;

    let all = get(&s.t, "/api/admin/orders", Some(&s.admin)).await;
    assert_eq!(
        all.data()["meta"],
        json!({"page": 1, "per_page": 20, "total": 2})
    );
    assert_eq!(all.data()["items"][0]["id"], second.data()["order"]["id"]);
    let paid = get(&s.t, "/api/admin/orders?status=PAID", Some(&s.admin)).await;
    assert_eq!(paid.data()["items"][0]["id"], first);
    let code = second.data()["order"]["order_code"]
        .as_str()
        .unwrap()
        .to_string();
    let by_code = get(&s.t, &format!("/api/admin/orders?q={code}"), Some(&s.admin)).await;
    assert_eq!(by_code.data()["meta"]["total"], 1);
    let by_name = get(
        &s.t,
        "/api/admin/orders?q=orang%20tua&per_page=1&page=2",
        Some(&s.admin),
    )
    .await;
    assert_eq!(by_name.data()["meta"]["total"], 2);
    assert_eq!(by_name.data()["items"].as_array().unwrap().len(), 1);
    assert_eq!(
        get(&s.t, "/api/admin/orders?status=LUNAS", Some(&s.admin))
            .await
            .status,
        StatusCode::UNPROCESSABLE_ENTITY
    );
}

#[tokio::test]
async fn metrics_are_real_aggregates() {
    let s = scene().await;
    let low = insert_kit(&s.t.pool, "Langka", 50_000, 2).await;
    insert_kit(&s.t.pool, "Banyak", 10_000, 50).await;
    let (paid, _) = book(&s, 1).await;
    let pending = checkout(
        &s.t,
        &s.parent.cookie,
        &uuid(2),
        json!([{"type": "KIT", "kit_id": low, "quantity": 1}]),
    )
    .await;
    let cancelled = checkout(
        &s.t,
        &s.parent.cookie,
        &uuid(3),
        json!([{"type": "KIT", "kit_id": low, "quantity": 1}]),
    )
    .await;
    set_order(&s, paid, "PAID").await;
    set_order(
        &s,
        cancelled.data()["order"]["id"].as_i64().unwrap(),
        "CANCELLED",
    )
    .await;
    assert_eq!(pending.status, StatusCode::CREATED);

    let m = get(&s.t, "/api/admin/metrics", Some(&s.admin)).await;
    assert_eq!(m.status, StatusCode::OK);
    let d = m.data();
    assert_eq!(d["total_revenue_idr"], 200_000);
    assert_eq!(d["paid_orders"], 1);
    assert_eq!(d["pending_orders"], 1);
    assert_eq!(d["pending_amount_idr"], 50_000);
    assert_eq!(d["enrolled_students"], 1);
    let months = d["revenue_by_month"].as_array().unwrap();
    assert_eq!(months.len(), 6);
    assert_eq!(months[5]["revenue_idr"], 200_000);
    assert_eq!(
        months[5]["month"],
        rumi::helpers::today_wib().format("%Y-%m").to_string()
    );
    assert!(months[..5].iter().all(|m| m["revenue_idr"] == 0));
    assert_eq!(
        d["low_stock_kits"],
        json!([{"id": low, "name": "Langka", "category": "PRACTICAL_LIFE", "stock": 1}])
    );
    let fill = &d["upcoming_classes"][0];
    assert_eq!(fill["seats_booked"], 1);
    assert_eq!(fill["seats_left"], 11);
    assert_eq!(fill["fill_rate_pct"], 8);
    assert_eq!(fill["time_slot"], "09:30\u{2013}11:30");
    assert!(d["generated_at"].as_str().unwrap().ends_with('Z'));
}
