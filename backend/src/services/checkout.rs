//! Checkout (PRD §5.9.1). The client sends only ids and quantities; the server
//! owns every price, total, seat and stock number.
//!
//! Order of checks (first failure wins): auth (extractor) → per-parent rate
//! limit (route) → idempotent replay → field validation (422) → child
//! ownership (404) → one `BEGIN IMMEDIATE` transaction that re-checks the
//! replay, enforces the `PENDING_WA` cap, reserves seats/stock with
//! conditional UPDATEs, snapshots prices, allocates the order code and stores
//! the WhatsApp message.
//!
//! `BEGIN IMMEDIATE` takes SQLite's write lock up front, so concurrent
//! checkouts queue (busy_timeout) instead of interleaving; the conditional
//! `UPDATE … WHERE seats_booked < capacity` / `stock >= ?` remain the final
//! guard against overselling.

use std::collections::HashMap;

use serde_json::Value;
use sqlx::{SqliteConnection, SqlitePool};

use crate::config::Config;
use crate::error::ApiError;
use crate::helpers::{dash_join, now_utc, parse_date, upcoming_sql};
use crate::models::order::{self, Order};
use crate::models::user::User;
use crate::models::{child, class, kit};
use crate::services::order_code;
use crate::validate::{body_object, Errors, Reader, Rule, MSG_REQUIRED};
use crate::whatsapp::{build_message, WaItem, WaMessage};

const MAX_ITEMS: usize = 20;
const MAX_KIT_QTY: i64 = 10;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutItem {
    Kit { kit_id: i64, quantity: i64 },
    Class { class_id: i64, child_id: i64 },
}

#[derive(Debug, Clone)]
pub struct CheckoutInput {
    pub idempotency_key: String,
    pub items: Vec<CheckoutItem>,
    pub delivery_name: String,
    pub delivery_phone: String,
    pub delivery_address: Option<String>,
    pub notes: Option<String>,
}

pub enum Outcome {
    Created(Order),
    Replayed(Order),
}

/// `^[0-9a-fA-F]{8}-…-[0-9a-fA-F]{12}$`, returned lowercase.
pub fn normalize_uuid(raw: &str) -> Option<String> {
    let groups: Vec<&str> = raw.split('-').collect();
    let lens = [8, 4, 4, 4, 12];
    let ok = groups.len() == lens.len()
        && groups
            .iter()
            .zip(lens)
            .all(|(g, n)| g.len() == n && g.bytes().all(|b| b.is_ascii_hexdigit()));
    ok.then(|| raw.to_ascii_lowercase())
}

/// The idempotency key, read leniently for the replay check (step 2).
pub fn replay_key(body: &Value) -> Option<String> {
    body.get("idempotency_key")
        .and_then(Value::as_str)
        .and_then(normalize_uuid)
}

fn parse_item(item: &Reader<'_>) -> Option<CheckoutItem> {
    match item.raw("type").and_then(Value::as_str) {
        Some("KIT") => Some(CheckoutItem::Kit {
            kit_id: item.req_int("kit_id", 1, i64::MAX),
            quantity: item.req_int("quantity", 1, MAX_KIT_QTY),
        }),
        Some("CLASS") => Some(CheckoutItem::Class {
            class_id: item.req_int("class_id", 1, i64::MAX),
            child_id: item.req_int("child_id", 1, i64::MAX),
        }),
        Some(_) => {
            item.error("type", "Nilai tidak dikenal.");
            None
        }
        None => {
            item.error("type", MSG_REQUIRED);
            None
        }
    }
}

fn parse_items(r: &Reader<'_>, errs: &Errors) -> Vec<CheckoutItem> {
    let Some(raw_items) = r.array("items", 1, MAX_ITEMS) else {
        return Vec::new();
    };
    let parsed: Vec<(usize, CheckoutItem)> = raw_items
        .iter()
        .enumerate()
        .filter_map(|(i, v)| {
            let item = r.element("items", i, v)?;
            parse_item(&item).map(|it| (i, it))
        })
        .collect();
    for (pos, (i, item)) in parsed.iter().enumerate() {
        let dupe = parsed[..pos].iter().any(|(_, prev)| match (prev, item) {
            (CheckoutItem::Kit { kit_id: a, .. }, CheckoutItem::Kit { kit_id: b, .. }) => a == b,
            (
                CheckoutItem::Class {
                    class_id: a,
                    child_id: c,
                },
                CheckoutItem::Class {
                    class_id: b,
                    child_id: d,
                },
            ) => a == b && c == d,
            _ => false,
        });
        if dupe {
            errs.add(format!("items.{i}"), "Item ganda dalam satu pesanan.");
        }
    }
    parsed.into_iter().map(|(_, item)| item).collect()
}

/// Field validation (step 3).
pub fn parse(body: &Value) -> Result<CheckoutInput, ApiError> {
    let errs = Errors::new();
    let r = Reader::new(body_object(body)?, &errs);
    let idempotency_key = r
        .raw("idempotency_key")
        .and_then(Value::as_str)
        .and_then(normalize_uuid)
        .unwrap_or_else(|| {
            r.error("idempotency_key", "Harus berupa UUID.");
            String::new()
        });
    let items = parse_items(&r, &errs);
    let has_kit = items.iter().any(|i| matches!(i, CheckoutItem::Kit { .. }));
    let delivery = r.object("delivery");
    let read = |key: &str, rule: Rule| {
        delivery
            .as_ref()
            .map(|d| d.req_string(key, rule))
            .unwrap_or_default()
    };
    let delivery_name = read("name", Rule::Text { min: 2, max: 100 });
    let delivery_phone = read("phone_wa", Rule::Phone);
    // A class-only order ignores the address entirely: it is never validated.
    let address = delivery
        .as_ref()
        .filter(|_| has_kit)
        .and_then(|d| d.opt_text("address", 500));
    if has_kit && address.is_none() {
        if let Some(d) = delivery.as_ref() {
            d.error("address", "Alamat wajib diisi untuk pesanan kit.");
        }
    }
    let notes = r.opt_text("notes", 500);
    errs.finish()?;
    Ok(CheckoutInput {
        idempotency_key,
        items,
        delivery_name,
        delivery_phone,
        delivery_address: address,
        notes,
    })
}

/// One reserved line, ready to insert.
struct Reserved {
    item: CheckoutItem,
    name: String,
    unit_price_idr: i64,
    quantity: i64,
    wa: WaItem,
}

impl Reserved {
    fn line_total(&self) -> i64 {
        self.unit_price_idr * self.quantity
    }
}

async fn reserve_class(
    conn: &mut SqliteConnection,
    class_id: i64,
    child_id: i64,
    child_name: &str,
) -> Result<Reserved, ApiError> {
    let row = class::find_row(&mut *conn, class_id)
        .await?
        .ok_or_else(|| ApiError::item_unavailable("Kelas yang dipilih"))?;
    if row.status != "OPEN" || !crate::helpers::is_upcoming(&row.date, &row.start_time) {
        return Err(ApiError::item_unavailable(&format!("Kelas {}", row.title)));
    }
    let taken: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM class_enrollments WHERE class_id = ? AND child_id = ? AND status <> 'CANCELLED'",
    )
    .bind(class_id)
    .bind(child_id)
    .fetch_one(&mut *conn)
    .await?;
    if taken > 0 {
        return Err(ApiError::already_enrolled(child_name, &row.title));
    }
    let sql = format!(
        "UPDATE weekend_classes SET seats_booked = seats_booked + 1
         WHERE id = ? AND deleted_at IS NULL AND status = 'OPEN' AND seats_booked < capacity AND {}",
        upcoming_sql("weekend_classes")
    );
    let changed = sqlx::query(&sql)
        .bind(class_id)
        .execute(&mut *conn)
        .await?
        .rows_affected();
    if changed == 0 {
        return Err(ApiError::class_full(&row.title));
    }
    let date = parse_date(&row.date).ok_or_else(ApiError::internal)?;
    Ok(Reserved {
        item: CheckoutItem::Class { class_id, child_id },
        name: row.title.clone(),
        unit_price_idr: row.fee_idr,
        quantity: 1,
        wa: WaItem::Class {
            title: row.title,
            child_name: child_name.to_string(),
            date,
            time_slot: dash_join(&row.start_time, &row.end_time),
            location: row.location,
            line_total_idr: row.fee_idr,
        },
    })
}

async fn reserve_kit(
    conn: &mut SqliteConnection,
    kit_id: i64,
    quantity: i64,
) -> Result<Reserved, ApiError> {
    let kit = kit::find(&mut *conn, kit_id, false)
        .await?
        .ok_or_else(|| ApiError::item_unavailable("Kit yang dipilih"))?;
    if !kit.is_active {
        return Err(ApiError::item_unavailable(&kit.name));
    }
    let changed = sqlx::query(
        "UPDATE play_kits SET stock = stock - ?1
         WHERE id = ?2 AND stock >= ?1 AND deleted_at IS NULL AND is_active = 1",
    )
    .bind(quantity)
    .bind(kit_id)
    .execute(&mut *conn)
    .await?
    .rows_affected();
    if changed == 0 {
        return Err(ApiError::out_of_stock(&kit.name, kit.stock));
    }
    Ok(Reserved {
        item: CheckoutItem::Kit { kit_id, quantity },
        name: kit.name.clone(),
        unit_price_idr: kit.price_idr,
        quantity,
        wa: WaItem::Kit {
            name: kit.name,
            quantity,
            line_total_idr: kit.price_idr * quantity,
        },
    })
}

async fn insert_lines(
    conn: &mut SqliteConnection,
    order_id: i64,
    lines: &[Reserved],
) -> Result<(), sqlx::Error> {
    for line in lines {
        let (kind, class_id, kit_id, child_id) = match line.item {
            CheckoutItem::Class { class_id, child_id } => {
                ("CLASS", Some(class_id), None, Some(child_id))
            }
            CheckoutItem::Kit { kit_id, .. } => ("KIT", None, Some(kit_id), None),
        };
        let item_id: i64 = sqlx::query_scalar(
            "INSERT INTO order_items (order_id, item_type, class_id, kit_id, child_id, name_snapshot,
             unit_price_idr, quantity, line_total_idr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
        )
        .bind(order_id)
        .bind(kind)
        .bind(class_id)
        .bind(kit_id)
        .bind(child_id)
        .bind(&line.name)
        .bind(line.unit_price_idr)
        .bind(line.quantity)
        .bind(line.line_total())
        .fetch_one(&mut *conn)
        .await?;
        if let (Some(class_id), Some(child_id)) = (class_id, child_id) {
            sqlx::query(
                "INSERT INTO class_enrollments (class_id, child_id, order_item_id, status)
                 VALUES (?, ?, ?, 'RESERVED')",
            )
            .bind(class_id)
            .bind(child_id)
            .bind(item_id)
            .execute(&mut *conn)
            .await?;
        }
    }
    Ok(())
}

/// Step 4: every `child_id` must be a live child of the caller.
async fn owned_child_names(
    pool: &SqlitePool,
    parent_id: i64,
    items: &[CheckoutItem],
) -> Result<HashMap<i64, String>, ApiError> {
    let mut names = HashMap::new();
    for item in items {
        if let CheckoutItem::Class { child_id, .. } = item {
            let child = child::find_owned(pool, parent_id, *child_id)
                .await?
                .ok_or_else(|| ApiError::not_found_msg("Data anak tidak ditemukan."))?;
            names.insert(*child_id, child.name);
        }
    }
    Ok(names)
}

async fn reserve_all(
    conn: &mut SqliteConnection,
    items: &[CheckoutItem],
    names: &HashMap<i64, String>,
) -> Result<Vec<Reserved>, ApiError> {
    let mut lines = Vec::with_capacity(items.len());
    for item in items {
        let line = match *item {
            CheckoutItem::Class { class_id, child_id } => {
                let name = names.get(&child_id).map(String::as_str).unwrap_or_default();
                reserve_class(conn, class_id, child_id, name).await?
            }
            CheckoutItem::Kit { kit_id, quantity } => reserve_kit(conn, kit_id, quantity).await?,
        };
        lines.push(line);
    }
    Ok(lines)
}

async fn existing_order_id(
    conn: &mut SqliteConnection,
    parent_id: i64,
    key: &str,
) -> Result<Option<i64>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM orders WHERE parent_id = ? AND idempotency_key = ?")
        .bind(parent_id)
        .bind(key)
        .fetch_optional(conn)
        .await
}

/// §5.9.1 step 5: refuse a new order while the parent already holds
/// `max_pending` orders in `PENDING_WA` (`0` disables the cap).
async fn ensure_pending_capacity(
    conn: &mut SqliteConnection,
    parent_id: i64,
    max_pending: i64,
) -> Result<(), ApiError> {
    if max_pending <= 0 {
        return Ok(());
    }
    let pending: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM orders WHERE parent_id = ? AND status = 'PENDING_WA'",
    )
    .bind(parent_id)
    .fetch_one(conn)
    .await?;
    if pending >= max_pending {
        return Err(ApiError::too_many_pending_orders(pending));
    }
    Ok(())
}

async fn insert_order(
    conn: &mut SqliteConnection,
    parent: &User,
    input: &CheckoutInput,
    lines: &[Reserved],
) -> Result<i64, ApiError> {
    let total: i64 = lines.iter().map(Reserved::line_total).sum();
    let code = order_code::allocate(&mut *conn, order_code::wib_year(now_utc())).await?;
    let wa_items: Vec<WaItem> = lines.iter().map(|l| l.wa.clone()).collect();
    let message = build_message(&WaMessage {
        order_code: &code,
        parent_name: &parent.full_name,
        phone_wa: &input.delivery_phone,
        total_amount_idr: total,
        items: &wa_items,
        delivery_name: &input.delivery_name,
        address: input.delivery_address.as_deref(),
        notes: input.notes.as_deref(),
    });
    let order_id: i64 = sqlx::query_scalar(
        "INSERT INTO orders (order_code, parent_id, total_amount_idr, status, delivery_name,
         delivery_phone, delivery_address, notes, wa_message_payload, idempotency_key)
         VALUES (?, ?, ?, 'PENDING_WA', ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(&code)
    .bind(parent.id)
    .bind(total)
    .bind(&input.delivery_name)
    .bind(&input.delivery_phone)
    .bind(&input.delivery_address)
    .bind(&input.notes)
    .bind(&message)
    .bind(&input.idempotency_key)
    .fetch_one(&mut *conn)
    .await?;
    insert_lines(conn, order_id, lines).await?;
    Ok(order_id)
}

async fn load(pool: &SqlitePool, cfg: &Config, id: i64) -> Result<Order, ApiError> {
    order::find(pool, cfg, id)
        .await?
        .ok_or_else(ApiError::internal)
}

/// Steps 4–6. Step 2 (replay) is repeated inside the transaction so two
/// concurrent submits with one key resolve to the same order, and it runs
/// before the pending cap so a replay always answers `200`.
pub async fn checkout(
    pool: &SqlitePool,
    cfg: &Config,
    parent: &User,
    input: &CheckoutInput,
) -> Result<Outcome, ApiError> {
    let names = owned_child_names(pool, parent.id, &input.items).await?;
    let mut tx = crate::db::begin_immediate(pool).await?;
    if let Some(id) = existing_order_id(&mut tx, parent.id, &input.idempotency_key).await? {
        drop(tx);
        return Ok(Outcome::Replayed(load(pool, cfg, id).await?));
    }
    ensure_pending_capacity(&mut tx, parent.id, cfg.max_pending_orders_per_parent).await?;
    let lines = reserve_all(&mut tx, &input.items, &names).await?;
    let order_id = match insert_order(&mut tx, parent, input, &lines).await {
        Ok(id) => id,
        // Safety net: a UNIQUE(parent_id, idempotency_key) race replays the winner.
        Err(e) if e.code == "conflict" => {
            drop(tx);
            let winner = order::find_by_key(pool, cfg, parent.id, &input.idempotency_key).await?;
            return winner.map(Outcome::Replayed).ok_or(e);
        }
        Err(e) => return Err(e),
    };
    tx.commit().await?;
    Ok(Outcome::Created(load(pool, cfg, order_id).await?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn uuid_normalization() {
        assert_eq!(
            normalize_uuid("8F14E45F-CEEA-4E7A-9C1B-0A1B2C3D4E5F").as_deref(),
            Some("8f14e45f-ceea-4e7a-9c1b-0a1b2c3d4e5f")
        );
        for bad in [
            "",
            "not-a-uuid",
            "8f14e45f-ceea-4e7a-9c1b-0a1b2c3d4e5",
            "8f14e45fceea4e7a9c1b0a1b2c3d4e5f",
            "g f14e45f-ceea-4e7a-9c1b-0a1b2c3d4e5f",
        ] {
            assert_eq!(normalize_uuid(bad), None, "{bad}");
        }
        assert_eq!(replay_key(&json!({"idempotency_key": 5})), None);
    }

    fn body(items: Value, address: Value) -> Value {
        json!({
            "idempotency_key": "8f14e45f-ceea-4e7a-9c1b-0a1b2c3d4e5f",
            "items": items,
            "delivery": {"name": "Nadia", "phone_wa": "0812-1111-2222", "address": address},
        })
    }

    #[test]
    fn parse_accepts_valid_and_drops_address_without_kits() {
        let input = parse(&body(
            json!([{"type": "CLASS", "class_id": 1, "child_id": 2}]),
            json!("Jl. X"),
        ))
        .unwrap();
        assert_eq!(
            input.items,
            vec![CheckoutItem::Class {
                class_id: 1,
                child_id: 2
            }]
        );
        assert_eq!(input.delivery_phone, "6281211112222");
        assert_eq!(input.delivery_address, None);
        let with_kit = parse(&body(
            json!([{"type": "KIT", "kit_id": 1, "quantity": 2, "price_idr": 1}]),
            json!("Jl. X"),
        ))
        .unwrap();
        assert_eq!(with_kit.delivery_address.as_deref(), Some("Jl. X"));
    }

    #[test]
    fn parse_reports_field_paths() {
        let bad = json!({
            "idempotency_key": "nope",
            "items": [
                {"type": "KIT", "kit_id": 1, "quantity": 11},
                {"type": "KIT", "kit_id": 1, "quantity": 1},
                {"type": "BOOK"},
                {"type": "CLASS", "class_id": 0}
            ],
            "delivery": {"name": "N", "phone_wa": "123"},
            "notes": 5
        });
        let fields = parse(&bad).unwrap_err().fields.unwrap();
        for key in [
            "idempotency_key",
            "items.0.quantity",
            "items.1",
            "items.2.type",
            "items.3.class_id",
            "items.3.child_id",
            "delivery.name",
            "delivery.phone_wa",
            "delivery.address",
            "notes",
        ] {
            assert!(fields.contains_key(key), "{key}: {fields:?}");
        }
        let empty = parse(&json!({"items": []})).unwrap_err().fields.unwrap();
        assert!(empty.contains_key("items") && empty.contains_key("delivery"));
    }
}
