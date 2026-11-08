//! In-memory token-bucket rate limiter, ported from hookbox `limiter.rs`
//! (proportional refill, `retry_after`, idle eviction, bounded map).
//!
//! PRD §5.3.4: one bucket per (endpoint, client IP) holding
//! `AUTH_RATE_LIMIT_PER_MIN` tokens, refilled continuously at that rate. Every
//! request takes one token. `limit <= 0` means unlimited. The auth endpoints
//! are low-traffic, so a single mutex-guarded map is plenty (KISS).

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

/// Upper bound on tracked buckets; past it the oldest tenth is trimmed in one batch.
const MAX_BUCKETS: usize = 50_000;
const TRIM_TARGET: usize = MAX_BUCKETS * 9 / 10;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub retry_after: i64,
}

struct Bucket {
    tokens: f64,
    last_refill: Instant,
}

#[derive(Default)]
pub struct Limiter {
    buckets: Mutex<HashMap<String, Bucket>>,
}

impl Limiter {
    pub fn new() -> Self {
        Limiter::default()
    }

    fn map(&self) -> MutexGuard<'_, HashMap<String, Bucket>> {
        self.buckets
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn len(&self) -> usize {
        self.map().len()
    }

    pub fn is_empty(&self) -> bool {
        self.map().is_empty()
    }

    /// Check and consume one token for `key` against `limit` per `window_secs`.
    pub fn check(&self, key: &str, limit: i64, window_secs: i64) -> RateLimitResult {
        self.check_at(key, limit, window_secs, Instant::now())
    }

    fn check_at(&self, key: &str, limit: i64, window_secs: i64, now: Instant) -> RateLimitResult {
        if limit <= 0 || window_secs <= 0 {
            return RateLimitResult {
                allowed: true,
                retry_after: 0,
            };
        }
        let capacity = limit as f64;
        let refill_per_sec = capacity / window_secs as f64;
        let mut map = self.map();
        if map.len() >= MAX_BUCKETS && !map.contains_key(key) {
            trim(&mut map);
        }
        let bucket = map.entry(key.to_string()).or_insert(Bucket {
            tokens: capacity,
            last_refill: now,
        });
        let elapsed = now
            .saturating_duration_since(bucket.last_refill)
            .as_secs_f64();
        let refilled = (bucket.tokens + elapsed * refill_per_sec).min(capacity);
        bucket.last_refill = now;
        if refilled >= 1.0 {
            bucket.tokens = refilled - 1.0;
            return RateLimitResult {
                allowed: true,
                retry_after: 0,
            };
        }
        bucket.tokens = refilled;
        let retry_after = ((1.0 - refilled) / refill_per_sec).ceil() as i64;
        RateLimitResult {
            allowed: false,
            retry_after: retry_after.max(1),
        }
    }

    /// Drop buckets idle for at least `idle` (called by the sweep task).
    pub fn evict_idle(&self, idle: Duration) -> usize {
        let now = Instant::now();
        let mut map = self.map();
        let before = map.len();
        map.retain(|_, b| now.saturating_duration_since(b.last_refill) < idle);
        before - map.len()
    }
}

/// Evict the least-recently-used overflow in one pass so the scan is amortized.
fn trim(map: &mut HashMap<String, Bucket>) {
    let overflow = map.len().saturating_sub(TRIM_TARGET);
    let mut by_age: Vec<(String, Instant)> = map
        .iter()
        .map(|(k, b)| (k.clone(), b.last_refill))
        .collect();
    by_age.sort_unstable_by_key(|(_, seen)| *seen);
    for (k, _) in by_age.into_iter().take(overflow) {
        map.remove(&k);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unlimited_when_limit_not_positive() {
        let l = Limiter::new();
        for _ in 0..100 {
            assert!(l.check("k", 0, 60).allowed);
        }
        assert!(l.check("k", -1, 60).allowed);
        assert!(l.is_empty());
    }

    #[test]
    fn exhausts_then_reports_retry_after() {
        let l = Limiter::new();
        let now = Instant::now();
        for _ in 0..3 {
            assert!(l.check_at("k", 3, 60, now).allowed);
        }
        let blocked = l.check_at("k", 3, 60, now);
        assert!(!blocked.allowed);
        // 3/min ⇒ one token every 20 s.
        assert_eq!(blocked.retry_after, 20);
        // After 20 s a token is back.
        assert!(
            l.check_at("k", 3, 60, now + Duration::from_secs(20))
                .allowed
        );
    }

    #[test]
    fn keys_are_isolated() {
        let l = Limiter::new();
        assert!(l.check("auth:/login:1.1.1.1", 1, 60).allowed);
        assert!(!l.check("auth:/login:1.1.1.1", 1, 60).allowed);
        assert!(l.check("auth:/login:2.2.2.2", 1, 60).allowed);
        assert!(l.check("auth:/register:1.1.1.1", 1, 60).allowed);
        assert_eq!(l.len(), 3);
    }

    #[test]
    fn evict_idle_drops_stale_buckets() {
        let l = Limiter::new();
        l.check("a", 5, 60);
        l.check("b", 5, 60);
        assert_eq!(l.evict_idle(Duration::from_secs(600)), 0);
        assert_eq!(l.evict_idle(Duration::ZERO), 2);
        assert!(l.is_empty());
    }

    #[test]
    fn map_stays_bounded() {
        let l = Limiter::new();
        for i in 0..(MAX_BUCKETS + 10) {
            l.check(&format!("k{i}"), 5, 60);
        }
        assert!(l.len() <= MAX_BUCKETS);
    }
}
