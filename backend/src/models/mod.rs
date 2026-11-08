//! DTOs (PRD §5.6) and their queries, one module per table family.
//!
//! Row timestamps are formatted in SQL with `strftime('%Y-%m-%dT%H:%M:%SZ', …)`
//! so every `Timestamp` leaves the database already in RFC 3339 `…Z` form.

pub mod assessment;
pub mod child;
pub mod class;
pub mod cms;
pub mod cms_schema;
pub mod enrollment;
pub mod kit;
pub mod order;
pub mod user;

/// `Domain`, in canonical order (§5.5); also the kit category.
pub const DOMAINS: [&str; 5] = [
    "PRACTICAL_LIFE",
    "SENSORIAL",
    "LANGUAGE",
    "MATH",
    "ISLAMIC_STUDIES",
];
pub const CLASS_STATUSES: [&str; 4] = ["DRAFT", "OPEN", "CLOSED", "CANCELLED"];
pub const ORDER_STATUSES: [&str; 3] = ["PENDING_WA", "PAID", "CANCELLED"];
/// A kit is "low stock" when `stock ≤ 5` (§5.5).
pub const LOW_STOCK_THRESHOLD: i64 = 5;
