//! Demo data (PRD §5.11.4, `SEED_DEMO=true` only): parent Nadia, child Amina,
//! a past CLOSED class, one PAID order `RUMI-2025-0001` and Amina's assessments.
//! The demo order does not change kit stock.

use chrono::NaiveDate;
use sqlx::{SqliteConnection, SqlitePool};

use crate::auth::password::hash_async;
use crate::config::Config;
use crate::models::user::{self, NewUser, ROLE_PARENT};
use crate::seed::catalog::{KEMANG, KIT_KARTU};
use crate::seed::{admin_exists, create_admin, DEMO_ADMIN_EMAIL};
use crate::whatsapp::{build_message, WaItem, WaMessage};

pub const DEMO_PARENT_EMAIL: &str = "nadia@example.com";
const DEMO_PARENT_PASSWORD: &str = "rumi-parent-123";
const DEMO_ADMIN_PASSWORD: &str = "rumi-admin-123";
const PARENT_NAME: &str = "Nadia Rahman";
const PARENT_PHONE: &str = "6281211112222";
const ADDRESS: &str = "Jl. Kemang Raya 12, Jakarta Selatan";
const CLASS_TITLE: &str = "Mengenal Syukur";
const CLASS_FEE: i64 = 175_000;
const KIT_PRICE: i64 = 120_000;
const ORDER_CODE: &str = "RUMI-2025-0001";
const IDEMPOTENCY_KEY: &str = "00000000-0000-4000-8000-000000000001";

/// `(observed_on, with_class, domain, level, milestone, notes)`.
type AssessmentSeed = (
    &'static str,
    bool,
    &'static str,
    i64,
    &'static str,
    Option<&'static str>,
);

const ASSESSMENTS: [AssessmentSeed; 7] = [
    (
        "2026-01-17",
        true,
        "PRACTICAL_LIFE",
        2,
        "Menuang air dari teko kecil dengan hati-hati",
        None,
    ),
    (
        "2026-01-17",
        true,
        "ISLAMIC_STUDIES",
        2,
        "Mengucapkan salam saat menyapa teman",
        None,
    ),
    (
        "2026-10-24",
        false,
        "PRACTICAL_LIFE",
        3,
        "Memilih kegiatan menuang tiga kali dan merapikannya sendiri",
        Some("Konsentrasinya makin tumbuh \u{2014} ia memilih kegiatan yang sama tiga kali."),
    ),
    (
        "2026-10-24",
        false,
        "SENSORIAL",
        3,
        "Mengurutkan silinder dari yang terbesar ke terkecil",
        None,
    ),
    (
        "2026-10-24",
        false,
        "LANGUAGE",
        2,
        "Mengenali bunyi awal nama teman-temannya",
        None,
    ),
    (
        "2026-10-24",
        false,
        "MATH",
        2,
        "Menghitung benda sampai 10",
        None,
    ),
    (
        "2026-10-24",
        false,
        "ISLAMIC_STUDIES",
        3,
        "Membaca basmalah sebelum makan tanpa diingatkan",
        None,
    ),
];

struct Ids {
    admin: i64,
    parent: i64,
    child: i64,
    class: i64,
    kit: i64,
}

/// Seed the demo set once. Returns `true` when it was inserted.
pub async fn seed(pool: &SqlitePool, cfg: &Config) -> anyhow::Result<bool> {
    if user::email_exists(pool, DEMO_PARENT_EMAIL).await? {
        return Ok(false);
    }
    if !admin_exists(pool).await? {
        create_admin(pool, cfg, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD).await?;
    }
    let admin: i64 =
        sqlx::query_scalar("SELECT MIN(id) FROM users WHERE role = 'ADMIN' AND deleted_at IS NULL")
            .fetch_one(pool)
            .await?;
    let kit: Option<i64> = sqlx::query_scalar("SELECT MIN(id) FROM play_kits WHERE name = ?")
        .bind(KIT_KARTU)
        .fetch_one(pool)
        .await?;
    let kit = kit.ok_or_else(|| anyhow::anyhow!("demo seed needs the catalog kit {KIT_KARTU}"))?;
    let password_hash = hash_async(DEMO_PARENT_PASSWORD.to_string()).await?;

    let mut tx = crate::db::begin_immediate(pool).await?;
    let parent = user::insert(
        &mut *tx,
        &NewUser {
            email: DEMO_PARENT_EMAIL,
            password_hash: &password_hash,
            full_name: PARENT_NAME,
            phone_wa: PARENT_PHONE,
            role: ROLE_PARENT,
        },
    )
    .await?;
    let child = insert_child(&mut tx, parent).await?;
    let class = insert_past_class(&mut tx).await?;
    let ids = Ids {
        admin,
        parent,
        child,
        class,
        kit,
    };
    insert_order(&mut tx, &ids).await?;
    insert_assessments(&mut tx, &ids).await?;
    tx.commit().await?;
    Ok(true)
}

async fn insert_child(conn: &mut SqliteConnection, parent: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar("INSERT INTO children (parent_id, name, dob) VALUES (?, 'Amina', '2020-04-15') RETURNING id")
        .bind(parent)
        .fetch_one(conn)
        .await
}

async fn insert_past_class(conn: &mut SqliteConnection) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        "INSERT INTO weekend_classes (title, description, location, age_min, age_max, date,
         start_time, end_time, fee_idr, capacity, seats_booked, status)
         VALUES (?, ?, ?, 3, 6, '2026-01-17', '09:30', '11:30', ?, 12, 1, 'CLOSED') RETURNING id",
    )
    .bind(CLASS_TITLE)
    .bind("Mengenal rasa syukur lewat cerita, lagu, dan kegiatan menyiapkan camilan bersama.")
    .bind(KEMANG)
    .bind(CLASS_FEE)
    .fetch_one(conn)
    .await
}

fn demo_message() -> String {
    let items = [
        WaItem::Class {
            title: CLASS_TITLE.into(),
            child_name: "Amina".into(),
            date: NaiveDate::from_ymd_opt(2026, 1, 17).unwrap_or_default(),
            time_slot: "09:30\u{2013}11:30".into(),
            location: KEMANG.into(),
            line_total_idr: CLASS_FEE,
        },
        WaItem::Kit {
            name: KIT_KARTU.into(),
            quantity: 1,
            line_total_idr: KIT_PRICE,
        },
    ];
    build_message(&WaMessage {
        order_code: ORDER_CODE,
        parent_name: PARENT_NAME,
        phone_wa: PARENT_PHONE,
        total_amount_idr: CLASS_FEE + KIT_PRICE,
        items: &items,
        delivery_name: PARENT_NAME,
        address: Some(ADDRESS),
        notes: None,
    })
}

async fn insert_order(conn: &mut SqliteConnection, ids: &Ids) -> Result<(), sqlx::Error> {
    let order: i64 = sqlx::query_scalar(
        "INSERT INTO orders (order_code, parent_id, total_amount_idr, status, delivery_name,
         delivery_phone, delivery_address, wa_message_payload, idempotency_key, paid_at,
         created_at, updated_at)
         VALUES (?, ?, ?, 'PAID', ?, ?, ?, ?, ?, '2025-12-29 02:00:00', '2025-12-28 03:00:00',
                 '2025-12-29 02:00:00') RETURNING id",
    )
    .bind(ORDER_CODE)
    .bind(ids.parent)
    .bind(CLASS_FEE + KIT_PRICE)
    .bind(PARENT_NAME)
    .bind(PARENT_PHONE)
    .bind(ADDRESS)
    .bind(demo_message())
    .bind(IDEMPOTENCY_KEY)
    .fetch_one(&mut *conn)
    .await?;
    let class_item: i64 = sqlx::query_scalar(
        "INSERT INTO order_items (order_id, item_type, class_id, child_id, name_snapshot,
         unit_price_idr, quantity, line_total_idr) VALUES (?, 'CLASS', ?, ?, ?, ?, 1, ?) RETURNING id",
    )
    .bind(order)
    .bind(ids.class)
    .bind(ids.child)
    .bind(CLASS_TITLE)
    .bind(CLASS_FEE)
    .bind(CLASS_FEE)
    .fetch_one(&mut *conn)
    .await?;
    sqlx::query(
        "INSERT INTO order_items (order_id, item_type, kit_id, name_snapshot, unit_price_idr,
         quantity, line_total_idr) VALUES (?, 'KIT', ?, ?, ?, 1, ?)",
    )
    .bind(order)
    .bind(ids.kit)
    .bind(KIT_KARTU)
    .bind(KIT_PRICE)
    .bind(KIT_PRICE)
    .execute(&mut *conn)
    .await?;
    sqlx::query(
        "INSERT INTO class_enrollments (class_id, child_id, order_item_id, status) VALUES (?, ?, ?, 'ATTENDED')",
    )
    .bind(ids.class)
    .bind(ids.child)
    .bind(class_item)
    .execute(&mut *conn)
    .await?;
    sqlx::query(
        "INSERT INTO order_code_counters (year, last_seq) VALUES (2025, 1)
         ON CONFLICT(year) DO UPDATE SET last_seq = MAX(last_seq, 1)",
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

async fn insert_assessments(conn: &mut SqliteConnection, ids: &Ids) -> Result<(), sqlx::Error> {
    for (observed_on, with_class, domain, level, milestone, notes) in ASSESSMENTS {
        sqlx::query(
            "INSERT INTO student_assessments (child_id, class_id, assessor_id, domain, level,
             milestone, notes, observed_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(ids.child)
        .bind(with_class.then_some(ids.class))
        .bind(ids.admin)
        .bind(domain)
        .bind(level)
        .bind(milestone)
        .bind(notes)
        .bind(observed_on)
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn demo_is_seeded_once_and_matches_prd() {
        let pool = crate::testutil::pool().await;
        let cfg = Config {
            seed_demo: true,
            admin_email: String::new(),
            admin_password: String::new(),
            ..crate::testutil::config()
        };
        crate::seed::catalog::seed(&pool).await.unwrap();
        assert!(seed(&pool, &cfg).await.unwrap());
        assert!(!seed(&pool, &cfg).await.unwrap());

        let order = crate::models::order::find(&pool, &cfg, 1)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(order.order_code, ORDER_CODE);
        assert_eq!(order.status, "PAID");
        assert_eq!(order.total_amount_idr, 295_000);
        assert_eq!(order.created_at, "2025-12-28T03:00:00Z");
        assert_eq!(order.paid_at.as_deref(), Some("2025-12-29T02:00:00Z"));
        assert_eq!(order.expires_at, None);
        assert_eq!(order.items.len(), 2);
        assert_eq!(
            order.items[0].enrollment_status.as_deref(),
            Some("ATTENDED")
        );
        assert!(order.wa_url.contains("RUMI-2025-0001"));

        let counter: i64 =
            sqlx::query_scalar("SELECT last_seq FROM order_code_counters WHERE year = 2025")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(counter, 1);
        let assessments: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM student_assessments")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(assessments, 7);
        let stock: i64 = sqlx::query_scalar("SELECT stock FROM play_kits WHERE name = ?")
            .bind(KIT_KARTU)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(stock, 8, "demo order must not touch kit stock");
    }
}
