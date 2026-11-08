//! Checkout (PRD §5.9.1–§5.9.3) and the order state machine (§5.9.4).

mod common;

use axum::http::StatusCode;
use common::*;
use serde_json::{json, Value};

struct World {
    t: TestApp,
    parent: Parent,
    admin: String,
    class: i64,
    kit: i64,
}

async fn world() -> World {
    let t = app().await;
    let parent = register(&t, "nadia@example.com").await;
    let admin = admin(&t).await;
    let class = insert_class(&t.pool, "Bulan & Gerak", 7, 12, 200_000).await;
    let kit = insert_kit(&t.pool, "Nampan Tangan Kecil", 185_000, 12).await;
    World {
        t,
        parent,
        admin,
        class,
        kit,
    }
}

fn class_item(class: i64, child: i64) -> Value {
    json!({"type": "CLASS", "class_id": class, "child_id": child})
}

fn kit_item(kit: i64, quantity: i64) -> Value {
    json!({"type": "KIT", "kit_id": kit, "quantity": quantity})
}

async fn seat_invariant_holds(t: &TestApp) {
    let broken = scalar(
        &t.pool,
        "SELECT COUNT(*) FROM weekend_classes w WHERE w.seats_booked <>
         (SELECT COUNT(*) FROM class_enrollments e WHERE e.class_id = w.id AND e.status <> 'CANCELLED')",
    )
    .await;
    assert_eq!(broken, 0, "seats_booked must equal live enrollments");
}

async fn set_status(w: &World, order: i64, status: &str) -> Resp {
    call(
        &w.t,
        "PATCH",
        &format!("/api/admin/orders/{order}/status"),
        Some(&w.admin),
        Some(json!({"status": status})),
    )
    .await
}

#[tokio::test]
async fn server_prices_win_over_client_fields() {
    let w = world().await;
    let mut body = checkout_body(
        &uuid(1),
        json!([
            {"type": "CLASS", "class_id": w.class, "child_id": w.parent.child_id, "price_idr": 1, "unit_price_idr": 1},
            {"type": "KIT", "kit_id": w.kit, "quantity": 2, "price_idr": 1, "line_total_idr": 2}
        ]),
    );
    body["total_amount_idr"] = json!(1);
    body["status"] = json!("PAID");
    let r = call(
        &w.t,
        "POST",
        "/api/orders",
        Some(&w.parent.cookie),
        Some(body),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    let order = &r.data()["order"];
    assert_eq!(order["status"], "PENDING_WA");
    assert_eq!(order["total_amount_idr"], 570_000);
    assert_eq!(order["items"][0]["type"], "CLASS");
    assert_eq!(order["items"][0]["unit_price_idr"], 200_000);
    assert_eq!(order["items"][0]["enrollment_status"], "RESERVED");
    assert_eq!(order["items"][0]["child_name"], "Amina");
    assert_eq!(order["items"][0]["class_time_slot"], "09:30\u{2013}11:30");
    assert_eq!(order["items"][1]["unit_price_idr"], 185_000);
    assert_eq!(order["items"][1]["line_total_idr"], 370_000);
    assert_eq!(order["items"][1]["child_id"], Value::Null);
    assert_eq!(order["delivery_phone"], "6281211112222");
    assert_eq!(order["parent_name"], "Orang Tua");
    assert_eq!(r.data()["wa_url"], order["wa_url"]);
    assert!(order["expires_at"].as_str().unwrap().ends_with('Z'));
    assert_eq!(order["paid_at"], Value::Null);
    assert_eq!(
        scalar(&w.t.pool, "SELECT seats_booked FROM weekend_classes").await,
        1
    );
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 10);
    seat_invariant_holds(&w.t).await;
}

#[tokio::test]
async fn wa_url_decodes_to_the_prd_template() {
    let w = world().await;
    let items = json!([class_item(w.class, w.parent.child_id), kit_item(w.kit, 2)]);
    let r = checkout(&w.t, &w.parent.cookie, &uuid(1), items).await;
    let url = r.data()["wa_url"].as_str().unwrap().to_string();
    let prefix = "https://wa.me/6281234567890?text=";
    assert!(url.starts_with(prefix));
    let encoded = &url[prefix.len()..];
    assert!(!encoded.contains('+') && !encoded.contains(' '));
    let code = r.data()["order"]["order_code"]
        .as_str()
        .unwrap()
        .to_string();
    let date = rumi::helpers::parse_date(&date_in(7)).unwrap();
    let expected = format!(
        "Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #{code}.\n\n\
Nama Orang Tua: Orang Tua\nNama Anak: Amina\nNo. WhatsApp: 6281211112222\nTotal: Rp 570.000\n\n\
Detail:\n\
- Kelas Bulan & Gerak (Amina) \u{b7} {} \u{b7} 09:30\u{2013}11:30 WIB \u{b7} Rumah Teduh, Kemang (Jakarta Selatan) \u{b7} Rp 200.000\n\
- Kit Nampan Tangan Kecil \u{d7}2 \u{b7} Rp 370.000\n\n\
Penerima: Nadia Rahman\nAlamat: Jl. Kemang Raya 12\n\n\
Mohon info pembayarannya. Terima kasih.",
        rumi::helpers::tanggal_id(date)
    );
    assert_eq!(pct_decode(encoded), expected);
}

#[tokio::test]
async fn order_codes_follow_wib_year_sequence() {
    let w = world().await;
    let year = rumi::services::order_code::wib_year(rumi::helpers::now_utc());
    let first = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(1),
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    let second = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(2),
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    assert_eq!(
        first.data()["order"]["order_code"],
        format!("RUMI-{year}-0001")
    );
    assert_eq!(
        second.data()["order"]["order_code"],
        format!("RUMI-{year}-0002")
    );
    // A failed checkout does not consume a number.
    let failed = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(3),
        json!([kit_item(w.kit, 10), kit_item(w.kit + 99, 1)]),
    )
    .await;
    assert_eq!(failed.status, StatusCode::CONFLICT);
    let third = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(4),
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    assert_eq!(
        third.data()["order"]["order_code"],
        format!("RUMI-{year}-0003")
    );
    let mine = get(&w.t, "/api/me/orders", Some(&w.parent.cookie)).await;
    let codes: Vec<&str> = mine
        .data()
        .as_array()
        .unwrap()
        .iter()
        .map(|o| o["order_code"].as_str().unwrap())
        .collect();
    assert_eq!(codes.len(), 3);
    assert!(codes[0].ends_with("0003"), "newest first: {codes:?}");
}

#[tokio::test]
async fn oversell_is_refused_and_rolls_back_everything() {
    let w = world().await;
    sqlx::query("UPDATE play_kits SET stock = 3")
        .execute(&w.t.pool)
        .await
        .unwrap();
    let items = json!([class_item(w.class, w.parent.child_id), kit_item(w.kit, 4)]);
    let r = checkout(&w.t, &w.parent.cookie, &uuid(1), items).await;
    assert_eq!(r.status, StatusCode::CONFLICT);
    assert_eq!(r.code(), "out_of_stock");
    assert_eq!(
        r.body["error"],
        "Stok Nampan Tangan Kecil tidak mencukupi (tersisa 3)."
    );
    // The class seat taken before the failing kit was rolled back too.
    assert_eq!(
        scalar(&w.t.pool, "SELECT seats_booked FROM weekend_classes").await,
        0
    );
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 3);
    assert_eq!(scalar(&w.t.pool, "SELECT COUNT(*) FROM orders").await, 0);
    assert_eq!(
        scalar(&w.t.pool, "SELECT COUNT(*) FROM class_enrollments").await,
        0
    );
    let ok = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(2),
        json!([kit_item(w.kit, 3)]),
    )
    .await;
    assert_eq!(ok.status, StatusCode::CREATED);
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 0);
}

#[tokio::test]
async fn full_class_and_duplicate_enrollment_are_refused() {
    let w = world().await;
    let tiny = insert_class(&w.t.pool, "Kelas Mungil", 5, 1, 150_000).await;
    let first = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(1),
        json!([class_item(tiny, w.parent.child_id)]),
    )
    .await;
    assert_eq!(first.status, StatusCode::CREATED);

    let again = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(2),
        json!([class_item(tiny, w.parent.child_id)]),
    )
    .await;
    assert_eq!(again.code(), "already_enrolled");
    assert_eq!(
        again.body["error"],
        "Amina sudah terdaftar di kelas Kelas Mungil."
    );

    let other = register(&w.t, "other@example.com").await;
    let full = checkout(
        &w.t,
        &other.cookie,
        &uuid(3),
        json!([class_item(tiny, other.child_id)]),
    )
    .await;
    assert_eq!(full.code(), "class_full");
    assert_eq!(full.body["error"], "Kelas Kelas Mungil sudah penuh.");

    let dupes = json!([
        class_item(w.class, w.parent.child_id),
        class_item(w.class, w.parent.child_id)
    ]);
    let r = checkout(&w.t, &w.parent.cookie, &uuid(4), dupes).await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(r.body["fields"]["items.1"].is_string());
    seat_invariant_holds(&w.t).await;
}

#[tokio::test]
async fn idempotent_replay_returns_the_same_order_with_200() {
    let w = world().await;
    let key = "8F14E45F-CEEA-4E7A-9C1B-0A1B2C3D4E5F";
    let first = checkout(&w.t, &w.parent.cookie, key, json!([kit_item(w.kit, 2)])).await;
    assert_eq!(first.status, StatusCode::CREATED);
    let replay = checkout(
        &w.t,
        &w.parent.cookie,
        &key.to_lowercase(),
        json!([kit_item(w.kit, 5)]),
    )
    .await;
    assert_eq!(replay.status, StatusCode::OK);
    assert_eq!(replay.data()["order"]["id"], first.data()["order"]["id"]);
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 10);
    assert_eq!(scalar(&w.t.pool, "SELECT COUNT(*) FROM orders").await, 1);
    // Replays return the order as it is now, with no other checks.
    let id = first.data()["order"]["id"].as_i64().unwrap();
    assert_eq!(set_status(&w, id, "CANCELLED").await.status, StatusCode::OK);
    let body = json!({"idempotency_key": key, "items": "ignored"});
    let late = call(
        &w.t,
        "POST",
        "/api/orders",
        Some(&w.parent.cookie),
        Some(body),
    )
    .await;
    assert_eq!(late.status, StatusCode::OK);
    assert_eq!(late.data()["order"]["status"], "CANCELLED");
}

#[tokio::test]
async fn unavailable_items_are_409() {
    let w = world().await;
    let draft = insert_class(&w.t.pool, "Draf", 9, 12, 1).await;
    let past = insert_class(&w.t.pool, "Lampau", -2, 12, 1).await;
    let deleted = insert_class(&w.t.pool, "Terhapus", 9, 12, 1).await;
    sqlx::query("UPDATE weekend_classes SET status = 'DRAFT' WHERE id = ?")
        .bind(draft)
        .execute(&w.t.pool)
        .await
        .unwrap();
    sqlx::query("UPDATE weekend_classes SET deleted_at = datetime('now') WHERE id = ?")
        .bind(deleted)
        .execute(&w.t.pool)
        .await
        .unwrap();
    let inactive = insert_kit(&w.t.pool, "Nonaktif", 1, 5).await;
    sqlx::query("UPDATE play_kits SET is_active = 0 WHERE id = ?")
        .bind(inactive)
        .execute(&w.t.pool)
        .await
        .unwrap();
    let cases = [
        (class_item(draft, w.parent.child_id), "Kelas Draf"),
        (class_item(past, w.parent.child_id), "Kelas Lampau"),
        (class_item(deleted, w.parent.child_id), "Kelas yang dipilih"),
        (class_item(9_999, w.parent.child_id), "Kelas yang dipilih"),
        (kit_item(inactive, 1), "Nonaktif"),
        (kit_item(9_999, 1), "Kit yang dipilih"),
    ];
    for (i, (item, name)) in cases.into_iter().enumerate() {
        let r = checkout(&w.t, &w.parent.cookie, &uuid(10 + i as u32), json!([item])).await;
        assert_eq!(r.status, StatusCode::CONFLICT, "case {i}: {}", r.text);
        assert_eq!(r.code(), "item_unavailable", "case {i}");
        assert_eq!(
            r.body["error"],
            format!("{name} sudah tidak tersedia."),
            "case {i}"
        );
    }
}

#[tokio::test]
async fn delivery_rules_and_field_validation() {
    let w = world().await;
    let mut body = checkout_body(&uuid(1), json!([kit_item(w.kit, 1)]));
    body["delivery"]["address"] = json!("   ");
    let r = call(
        &w.t,
        "POST",
        "/api/orders",
        Some(&w.parent.cookie),
        Some(body),
    )
    .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    assert!(r.body["fields"]["delivery.address"].is_string());

    let mut class_only = checkout_body(&uuid(2), json!([class_item(w.class, w.parent.child_id)]));
    class_only["notes"] = json!("  Anak alergi kacang  ");
    let ok = call(
        &w.t,
        "POST",
        "/api/orders",
        Some(&w.parent.cookie),
        Some(class_only),
    )
    .await;
    assert_eq!(ok.status, StatusCode::CREATED);
    assert_eq!(ok.data()["order"]["delivery_address"], Value::Null);
    assert_eq!(ok.data()["order"]["notes"], "Anak alergi kacang");
    let text = pct_decode(
        ok.data()["wa_url"]
            .as_str()
            .unwrap()
            .split("text=")
            .nth(1)
            .unwrap(),
    );
    assert!(!text.contains("Alamat:"));
    assert!(text.contains("\nCatatan: Anak alergi kacang\n"));

    let too_many: Vec<Value> = (0..21).map(|i| kit_item(i + 1, 1)).collect();
    let r = checkout(&w.t, &w.parent.cookie, &uuid(3), json!(too_many)).await;
    assert!(r.body["fields"]["items"].is_string());
    let r = checkout(
        &w.t,
        &w.parent.cookie,
        "not-a-uuid",
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    assert!(r.body["fields"]["idempotency_key"].is_string());
}

#[tokio::test]
async fn state_machine_pay_then_cancel_releases_seats_and_stock() {
    let w = world().await;
    let items = json!([class_item(w.class, w.parent.child_id), kit_item(w.kit, 2)]);
    let r = checkout(&w.t, &w.parent.cookie, &uuid(1), items).await;
    let id = r.data()["order"]["id"].as_i64().unwrap();

    let paid = set_status(&w, id, "PAID").await;
    assert_eq!(paid.status, StatusCode::OK, "{}", paid.text);
    assert_eq!(paid.data()["status"], "PAID");
    assert!(paid.data()["paid_at"].as_str().unwrap().ends_with('Z'));
    assert_eq!(paid.data()["expires_at"], Value::Null);
    assert_eq!(paid.data()["items"][0]["enrollment_status"], "CONFIRMED");

    let twice = set_status(&w, id, "PAID").await;
    assert_eq!(twice.status, StatusCode::CONFLICT);
    assert_eq!(twice.code(), "invalid_transition");
    assert_eq!(
        twice.body["error"],
        "Status tidak dapat diubah dari PAID ke PAID."
    );

    let cancelled = set_status(&w, id, "CANCELLED").await;
    assert_eq!(cancelled.data()["status"], "CANCELLED");
    assert_eq!(
        cancelled.data()["items"][0]["enrollment_status"],
        "CANCELLED"
    );
    assert!(cancelled.data()["cancelled_at"].is_string());
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 12);
    assert_eq!(
        scalar(&w.t.pool, "SELECT seats_booked FROM weekend_classes").await,
        0
    );
    seat_invariant_holds(&w.t).await;

    assert_eq!(
        set_status(&w, id, "PAID").await.code(),
        "invalid_transition"
    );
    assert_eq!(
        set_status(&w, id, "PENDING_WA").await.code(),
        "validation_error"
    );
    assert_eq!(
        set_status(&w, 9_999, "PAID").await.status,
        StatusCode::NOT_FOUND
    );
    // The seat is free again: the same child can book the class anew.
    let rebook = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(2),
        json!([class_item(w.class, w.parent.child_id)]),
    )
    .await;
    assert_eq!(rebook.status, StatusCode::CREATED);
}

#[tokio::test]
async fn cancelling_keeps_attended_seats_and_releases_deleted_items() {
    let w = world().await;
    let items = json!([class_item(w.class, w.parent.child_id), kit_item(w.kit, 2)]);
    let r = checkout(&w.t, &w.parent.cookie, &uuid(1), items).await;
    let id = r.data()["order"]["id"].as_i64().unwrap();
    set_status(&w, id, "PAID").await;
    sqlx::query("UPDATE class_enrollments SET status = 'ATTENDED'")
        .execute(&w.t.pool)
        .await
        .unwrap();
    sqlx::query("UPDATE play_kits SET deleted_at = datetime('now')")
        .execute(&w.t.pool)
        .await
        .unwrap();

    let cancelled = set_status(&w, id, "CANCELLED").await;
    assert_eq!(cancelled.status, StatusCode::OK);
    assert_eq!(
        cancelled.data()["items"][0]["enrollment_status"],
        "ATTENDED"
    );
    assert_eq!(
        scalar(&w.t.pool, "SELECT seats_booked FROM weekend_classes").await,
        1
    );
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 12);
    seat_invariant_holds(&w.t).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_checkouts_never_oversell() {
    let dir = tempfile::tempdir().unwrap();
    let cfg = rumi::config::Config {
        database_path: dir.path().join("race.db").to_string_lossy().to_string(),
        ..test_config()
    };
    let t = app_with(cfg).await;
    let kit = insert_kit(&t.pool, "Langka", 100_000, 3).await;
    let class = insert_class(&t.pool, "Sempit", 7, 2, 50_000).await;
    let mut parents = Vec::new();
    for i in 0..8 {
        parents.push(register(&t, &format!("p{i}@example.com")).await);
    }
    let handles: Vec<_> = parents
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let app = t.app.clone();
            let items = json!([kit_item(kit, 1), class_item(class, p.child_id)]);
            let req = request(
                "POST",
                "/api/orders",
                Some(&p.cookie),
                Some(&checkout_body(&uuid(i as u32), items)),
            );
            tokio::spawn(async move { send(&app, req).await })
        })
        .collect();
    let mut created = 0;
    for h in handles {
        let r = h.await.unwrap();
        match r.status {
            StatusCode::CREATED => created += 1,
            StatusCode::CONFLICT => assert!(
                matches!(r.code(), "out_of_stock" | "class_full"),
                "{}",
                r.text
            ),
            other => panic!("unexpected {other}: {}", r.text),
        }
    }
    assert_eq!(created, 2, "the 2-seat class is the binding constraint");
    assert_eq!(scalar(&t.pool, "SELECT stock FROM play_kits").await, 1);
    assert_eq!(
        scalar(&t.pool, "SELECT seats_booked FROM weekend_classes").await,
        2
    );
    seat_invariant_holds(&t).await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_duplicate_submits_create_one_order() {
    let dir = tempfile::tempdir().unwrap();
    let cfg = rumi::config::Config {
        database_path: dir.path().join("dupe.db").to_string_lossy().to_string(),
        ..test_config()
    };
    let t = app_with(cfg).await;
    let p = register(&t, "p@example.com").await;
    let class = insert_class(&t.pool, "Satu", 7, 5, 50_000).await;
    let body = checkout_body(&uuid(7), json!([class_item(class, p.child_id)]));
    let handles: Vec<_> = (0..5)
        .map(|_| {
            let app = t.app.clone();
            let req = request("POST", "/api/orders", Some(&p.cookie), Some(&body));
            tokio::spawn(async move { send(&app, req).await })
        })
        .collect();
    let mut statuses = Vec::new();
    for h in handles {
        statuses.push(h.await.unwrap().status);
    }
    assert_eq!(
        statuses
            .iter()
            .filter(|s| **s == StatusCode::CREATED)
            .count(),
        1
    );
    assert_eq!(statuses.iter().filter(|s| **s == StatusCode::OK).count(), 4);
    assert_eq!(scalar(&t.pool, "SELECT COUNT(*) FROM orders").await, 1);
    assert_eq!(
        scalar(&t.pool, "SELECT seats_booked FROM weekend_classes").await,
        1
    );
}

#[tokio::test]
async fn pending_orders_are_capped_per_parent_but_replays_still_answer_200() {
    let w = world().await;
    let mut ids = Vec::new();
    for n in 1..=3 {
        let r = checkout(
            &w.t,
            &w.parent.cookie,
            &uuid(n),
            json!([kit_item(w.kit, 1)]),
        )
        .await;
        assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
        ids.push(r.data()["order"]["id"].as_i64().unwrap());
    }
    let capped = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(4),
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    assert_eq!(capped.status, StatusCode::CONFLICT);
    assert_eq!(capped.code(), "too_many_pending_orders");
    assert!(
        capped.body["error"].as_str().unwrap().contains("3 pesanan"),
        "{}",
        capped.text
    );
    // Nothing was reserved or numbered for the refused order.
    assert_eq!(scalar(&w.t.pool, "SELECT stock FROM play_kits").await, 9);
    assert_eq!(scalar(&w.t.pool, "SELECT COUNT(*) FROM orders").await, 3);

    // A replay of an existing order is answered before the cap.
    let replay = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(1),
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    assert_eq!(replay.status, StatusCode::OK);
    assert_eq!(replay.data()["order"]["id"], ids[0]);

    // Another parent is not affected.
    let other = register(&w.t, "siti@example.com").await;
    let theirs = checkout(&w.t, &other.cookie, &uuid(9), json!([kit_item(w.kit, 1)])).await;
    assert_eq!(theirs.status, StatusCode::CREATED);

    // Paid and cancelled orders do not count.
    assert_eq!(set_status(&w, ids[0], "PAID").await.status, StatusCode::OK);
    assert_eq!(
        set_status(&w, ids[1], "CANCELLED").await.status,
        StatusCode::OK
    );
    for n in 5..=6 {
        let r = checkout(
            &w.t,
            &w.parent.cookie,
            &uuid(n),
            json!([kit_item(w.kit, 1)]),
        )
        .await;
        assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    }
    let again = checkout(
        &w.t,
        &w.parent.cookie,
        &uuid(7),
        json!([kit_item(w.kit, 1)]),
    )
    .await;
    assert_eq!(again.code(), "too_many_pending_orders");
}

#[tokio::test]
async fn zero_disables_the_pending_cap() {
    let cfg = rumi::config::Config {
        max_pending_orders_per_parent: 0,
        ..test_config()
    };
    let t = app_with(cfg).await;
    let p = register(&t, "nadia@example.com").await;
    let kit = insert_kit(&t.pool, "Kit", 1_000, 50).await;
    for n in 1..=5 {
        let r = checkout(&t, &p.cookie, &uuid(n), json!([kit_item(kit, 1)])).await;
        assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    }
}

#[tokio::test]
async fn checkout_is_rate_limited_per_parent() {
    let cfg = rumi::config::Config {
        order_rate_limit_per_min: 2,
        max_pending_orders_per_parent: 0,
        ..test_config()
    };
    let t = app_with(cfg).await;
    let p = register(&t, "nadia@example.com").await;
    let kit = insert_kit(&t.pool, "Kit", 1_000, 50).await;
    for n in 1..=2 {
        let r = checkout(&t, &p.cookie, &uuid(n), json!([kit_item(kit, 1)])).await;
        assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    }
    let limited = checkout(&t, &p.cookie, &uuid(3), json!([kit_item(kit, 1)])).await;
    assert_eq!(limited.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(limited.code(), "rate_limited");
    let retry: i64 = limited.header("retry-after").unwrap().parse().unwrap();
    assert!(retry >= 1);
    assert_eq!(scalar(&t.pool, "SELECT COUNT(*) FROM orders").await, 2);
    // The bucket is per parent, not global.
    let other = register(&t, "siti@example.com").await;
    let theirs = checkout(&t, &other.cookie, &uuid(4), json!([kit_item(kit, 1)])).await;
    assert_eq!(theirs.status, StatusCode::CREATED);
}

#[tokio::test]
async fn class_only_checkout_ignores_the_address_entirely() {
    let w = world().await;
    let body = json!({
        "idempotency_key": uuid(1),
        "items": [class_item(w.class, w.parent.child_id)],
        "delivery": {"name": "Nadia Rahman", "phone_wa": "0812-1111-2222", "address": "x".repeat(600)},
    });
    let r = call(
        &w.t,
        "POST",
        "/api/orders",
        Some(&w.parent.cookie),
        Some(body),
    )
    .await;
    assert_eq!(r.status, StatusCode::CREATED, "{}", r.text);
    assert_eq!(r.data()["order"]["delivery_address"], Value::Null);
    let odd = json!({
        "idempotency_key": uuid(2),
        "items": [class_item(w.class, w.parent.child_id)],
        "delivery": {"name": "Nadia Rahman", "phone_wa": "0812-1111-2222", "address": 42},
    });
    let r2 = call(
        &w.t,
        "POST",
        "/api/orders",
        Some(&w.parent.cookie),
        Some(odd),
    )
    .await;
    assert_eq!(r2.code(), "already_enrolled", "{}", r2.text);
}
