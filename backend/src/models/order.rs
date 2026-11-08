//! `orders` + `order_items` (PRD §5.6 `Order` / `OrderItem`).
//!
//! Orders are loaded in two queries (orders, then all their items) so lists
//! never do N+1 lookups. `wa_url` is rebuilt from the stored message and the
//! current `RUMI_ADMIN_WA_PHONE`; `expires_at` is derived while `PENDING_WA`.

use std::collections::HashMap;

use chrono::Duration;
use serde::Serialize;
use sqlx::SqlitePool;

use crate::config::Config;
use crate::extract::Page;
use crate::helpers::{dash_join, like_pattern, parse_db_ts, rfc3339};
use crate::whatsapp::wa_url;

#[derive(Debug, Clone, sqlx::FromRow)]
struct OrderRow {
    id: i64,
    order_code: String,
    parent_id: i64,
    parent_name: String,
    parent_email: String,
    status: String,
    total_amount_idr: i64,
    delivery_name: String,
    delivery_phone: String,
    delivery_address: Option<String>,
    notes: Option<String>,
    wa_message_payload: String,
    created_raw: String,
    paid_at: Option<String>,
    cancelled_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct ItemRow {
    id: i64,
    order_id: i64,
    item_type: String,
    name_snapshot: String,
    kit_id: Option<i64>,
    class_id: Option<i64>,
    child_id: Option<i64>,
    child_name: Option<String>,
    class_date: Option<String>,
    start_time: Option<String>,
    end_time: Option<String>,
    class_location: Option<String>,
    enrollment_status: Option<String>,
    unit_price_idr: i64,
    quantity: i64,
    line_total_idr: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct OrderItem {
    pub id: i64,
    #[serde(rename = "type")]
    pub item_type: String,
    pub name: String,
    pub kit_id: Option<i64>,
    pub class_id: Option<i64>,
    pub child_id: Option<i64>,
    pub child_name: Option<String>,
    pub class_date: Option<String>,
    pub class_time_slot: Option<String>,
    pub class_location: Option<String>,
    pub enrollment_status: Option<String>,
    pub unit_price_idr: i64,
    pub quantity: i64,
    pub line_total_idr: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Order {
    pub id: i64,
    pub order_code: String,
    pub parent_id: i64,
    pub parent_name: String,
    pub parent_email: String,
    pub status: String,
    pub total_amount_idr: i64,
    pub delivery_name: String,
    pub delivery_phone: String,
    pub delivery_address: Option<String>,
    pub notes: Option<String>,
    pub items: Vec<OrderItem>,
    pub wa_url: String,
    pub expires_at: Option<String>,
    pub paid_at: Option<String>,
    pub cancelled_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

const ORDER_SELECT: &str = "SELECT o.id, o.order_code, o.parent_id, u.full_name AS parent_name, \
     u.email AS parent_email, o.status, o.total_amount_idr, o.delivery_name, o.delivery_phone, \
     o.delivery_address, o.notes, o.wa_message_payload, o.created_at AS created_raw, \
     strftime('%Y-%m-%dT%H:%M:%SZ', o.paid_at) AS paid_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', o.cancelled_at) AS cancelled_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', o.created_at) AS created_at, \
     strftime('%Y-%m-%dT%H:%M:%SZ', o.updated_at) AS updated_at \
     FROM orders o JOIN users u ON u.id = o.parent_id";

const ITEM_SELECT: &str = "SELECT oi.id, oi.order_id, oi.item_type, oi.name_snapshot, oi.kit_id, \
     oi.class_id, oi.child_id, ch.name AS child_name, w.date AS class_date, w.start_time, \
     w.end_time, w.location AS class_location, e.status AS enrollment_status, \
     oi.unit_price_idr, oi.quantity, oi.line_total_idr \
     FROM order_items oi \
     LEFT JOIN children ch ON ch.id = oi.child_id \
     LEFT JOIN weekend_classes w ON w.id = oi.class_id \
     LEFT JOIN class_enrollments e ON e.order_item_id = oi.id";

impl From<ItemRow> for OrderItem {
    fn from(r: ItemRow) -> Self {
        let time_slot = match (&r.start_time, &r.end_time) {
            (Some(start), Some(end)) => Some(dash_join(start, end)),
            _ => None,
        };
        OrderItem {
            id: r.id,
            item_type: r.item_type,
            name: r.name_snapshot,
            kit_id: r.kit_id,
            class_id: r.class_id,
            child_id: r.child_id,
            child_name: r.child_name,
            class_date: r.class_date,
            class_time_slot: time_slot,
            class_location: r.class_location,
            enrollment_status: r.enrollment_status,
            unit_price_idr: r.unit_price_idr,
            quantity: r.quantity,
            line_total_idr: r.line_total_idr,
        }
    }
}

fn to_order(r: OrderRow, items: Vec<OrderItem>, cfg: &Config) -> Order {
    let expires_at = (r.status == "PENDING_WA")
        .then(|| parse_db_ts(&r.created_raw))
        .flatten()
        .map(|created| rfc3339(created + Duration::hours(cfg.pending_order_ttl_hours)));
    Order {
        wa_url: wa_url(&cfg.admin_wa_phone, &r.wa_message_payload),
        expires_at,
        items,
        id: r.id,
        order_code: r.order_code,
        parent_id: r.parent_id,
        parent_name: r.parent_name,
        parent_email: r.parent_email,
        status: r.status,
        total_amount_idr: r.total_amount_idr,
        delivery_name: r.delivery_name,
        delivery_phone: r.delivery_phone,
        delivery_address: r.delivery_address,
        notes: r.notes,
        paid_at: r.paid_at,
        cancelled_at: r.cancelled_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
    }
}

fn placeholders(n: usize) -> String {
    vec!["?"; n].join(", ")
}

/// Load orders by id, returned in the order of `ids`.
pub async fn load(pool: &SqlitePool, cfg: &Config, ids: &[i64]) -> Result<Vec<Order>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let marks = placeholders(ids.len());
    let order_sql = format!("{ORDER_SELECT} WHERE o.id IN ({marks})");
    let rows = ids
        .iter()
        .fold(sqlx::query_as::<_, OrderRow>(&order_sql), |q, id| {
            q.bind(id)
        })
        .fetch_all(pool)
        .await?;
    let item_sql = format!("{ITEM_SELECT} WHERE oi.order_id IN ({marks}) ORDER BY oi.id");
    let items = ids
        .iter()
        .fold(sqlx::query_as::<_, ItemRow>(&item_sql), |q, id| q.bind(id))
        .fetch_all(pool)
        .await?;
    let mut by_order: HashMap<i64, Vec<OrderItem>> = HashMap::new();
    for item in items {
        by_order
            .entry(item.order_id)
            .or_default()
            .push(OrderItem::from(item));
    }
    let mut by_id: HashMap<i64, OrderRow> = rows.into_iter().map(|r| (r.id, r)).collect();
    Ok(ids
        .iter()
        .filter_map(|id| by_id.remove(id))
        .map(|row| {
            let items = by_order.remove(&row.id).unwrap_or_default();
            to_order(row, items, cfg)
        })
        .collect())
}

pub async fn find(pool: &SqlitePool, cfg: &Config, id: i64) -> Result<Option<Order>, sqlx::Error> {
    Ok(load(pool, cfg, &[id]).await?.into_iter().next())
}

/// The parent's order with this idempotency key, if any.
pub async fn find_by_key(
    pool: &SqlitePool,
    cfg: &Config,
    parent_id: i64,
    key: &str,
) -> Result<Option<Order>, sqlx::Error> {
    let id: Option<i64> =
        sqlx::query_scalar("SELECT id FROM orders WHERE parent_id = ? AND idempotency_key = ?")
            .bind(parent_id)
            .bind(key)
            .fetch_optional(pool)
            .await?;
    match id {
        Some(id) => find(pool, cfg, id).await,
        None => Ok(None),
    }
}

/// The parent's orders, `ORDER BY created_at DESC, id DESC` (#20).
pub async fn list_for_parent(
    pool: &SqlitePool,
    cfg: &Config,
    parent_id: i64,
) -> Result<Vec<Order>, sqlx::Error> {
    let ids: Vec<i64> = sqlx::query_scalar(
        "SELECT id FROM orders WHERE parent_id = ? ORDER BY created_at DESC, id DESC",
    )
    .bind(parent_id)
    .fetch_all(pool)
    .await?;
    load(pool, cfg, &ids).await
}

const ADMIN_FILTER: &str = "FROM orders o JOIN users u ON u.id = o.parent_id \
     WHERE (?1 IS NULL OR o.status = ?1) AND (?2 IS NULL OR o.order_code LIKE ?2 ESCAPE '\\' \
     OR u.full_name LIKE ?2 ESCAPE '\\' OR u.email LIKE ?2 ESCAPE '\\')";

/// Admin list (#39): optional status and `q`, newest first, paginated.
pub async fn admin_page(
    pool: &SqlitePool,
    cfg: &Config,
    status: Option<&str>,
    q: Option<&str>,
    page: Page,
) -> Result<(Vec<Order>, i64), sqlx::Error> {
    let pattern = q.map(like_pattern);
    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) {ADMIN_FILTER}"))
        .bind(status)
        .bind(&pattern)
        .fetch_one(pool)
        .await?;
    let ids: Vec<i64> = sqlx::query_scalar(&format!(
        "SELECT o.id {ADMIN_FILTER} ORDER BY o.created_at DESC, o.id DESC LIMIT ?3 OFFSET ?4"
    ))
    .bind(status)
    .bind(&pattern)
    .bind(page.per_page)
    .bind(page.offset())
    .fetch_all(pool)
    .await?;
    Ok((load(pool, cfg, &ids).await?, total))
}
