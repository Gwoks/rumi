//! Env-driven configuration (PRD §5.10), ported from hookbox `config.rs`.
//!
//! The app never crashes on a missing or malformed variable: every value falls
//! back to a safe default (logging a WARN where §5.10 says so).

use crate::validate::normalize_phone;

/// Default admin WhatsApp number used for `wa.me` links (§5.10).
pub const DEFAULT_ADMIN_WA_PHONE: &str = "6281234567890";
/// Default cap on a parent's `PENDING_WA` orders (§5.9.1, §5.10).
pub const DEFAULT_MAX_PENDING_ORDERS: i64 = 3;
/// Default per-parent checkout bucket, requests per minute (§5.3.4).
pub const DEFAULT_ORDER_RATE_LIMIT_PER_MIN: i64 = 10;

fn str_env(name: &str, fallback: &str) -> String {
    match std::env::var(name) {
        Ok(v) if !v.trim().is_empty() => v,
        _ => fallback.to_string(),
    }
}

fn int_env(name: &str, fallback: i64) -> i64 {
    match std::env::var(name) {
        Ok(v) if !v.trim().is_empty() => v.trim().parse::<i64>().unwrap_or(fallback),
        _ => fallback,
    }
}

fn bool_env(name: &str, fallback: bool) -> bool {
    match std::env::var(name) {
        Ok(v) if !v.trim().is_empty() => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        _ => fallback,
    }
}

/// `COOKIE_SECURE`: `true`, `false` or `auto` (§5.10).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CookieSecure {
    Always,
    Never,
    Auto,
}

impl CookieSecure {
    fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => CookieSecure::Always,
            "false" | "0" | "no" | "off" => CookieSecure::Never,
            _ => CookieSecure::Auto,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Config {
    pub app_port: u16,
    pub bind_host: String,
    pub database_path: String,
    pub static_dir: String,
    /// Normalized without a trailing `/` (may be empty).
    pub public_base_url: String,
    /// Normalized `62…` digits.
    pub admin_wa_phone: String,
    pub admin_email: String,
    pub admin_password: String,
    pub seed_demo: bool,
    /// `ALLOW_DEMO_SEED_IN_PROD`: lets `SEED_DEMO` run on an `https://` base URL.
    pub allow_demo_seed_in_prod: bool,
    pub pending_order_ttl_hours: i64,
    pub session_ttl_days: i64,
    pub auth_rate_limit_per_min: i64,
    /// Per-parent `POST /api/orders` bucket (§5.3.4); `<= 0` disables it.
    pub order_rate_limit_per_min: i64,
    /// Most `PENDING_WA` orders per parent (§5.9.1); `0` disables the cap.
    pub max_pending_orders_per_parent: i64,
    pub cookie_secure: CookieSecure,
    pub sweep_interval_seconds: u64,
}

/// `MAX_PENDING_ORDERS_PER_PARENT`: `0` disables the cap; a negative value
/// falls back to the default (§5.10).
fn max_pending_orders() -> i64 {
    let raw = int_env("MAX_PENDING_ORDERS_PER_PARENT", DEFAULT_MAX_PENDING_ORDERS);
    if raw < 0 {
        tracing::warn!("MAX_PENDING_ORDERS_PER_PARENT is negative; using the default");
        return DEFAULT_MAX_PENDING_ORDERS;
    }
    raw
}

impl Config {
    pub fn from_env() -> Self {
        let raw_phone = str_env("RUMI_ADMIN_WA_PHONE", DEFAULT_ADMIN_WA_PHONE);
        let admin_wa_phone = normalize_phone(&raw_phone).unwrap_or_else(|| {
            tracing::warn!("RUMI_ADMIN_WA_PHONE is invalid; falling back to the default");
            DEFAULT_ADMIN_WA_PHONE.to_string()
        });
        let port = int_env("APP_PORT", 8080);
        Config {
            app_port: u16::try_from(port).unwrap_or(8080),
            bind_host: str_env("APP_BIND_HOST", "0.0.0.0"),
            database_path: str_env("DATABASE_PATH", "data/rumi.db"),
            static_dir: str_env("STATIC_DIR", "dist"),
            public_base_url: str_env("PUBLIC_BASE_URL", "")
                .trim()
                .trim_end_matches('/')
                .to_string(),
            admin_wa_phone,
            admin_email: str_env("ADMIN_EMAIL", "").trim().to_string(),
            admin_password: str_env("ADMIN_PASSWORD", ""),
            seed_demo: bool_env("SEED_DEMO", false),
            allow_demo_seed_in_prod: bool_env("ALLOW_DEMO_SEED_IN_PROD", false),
            pending_order_ttl_hours: int_env("PENDING_ORDER_TTL_HOURS", 48).max(1),
            session_ttl_days: int_env("SESSION_TTL_DAYS", 30).max(1),
            auth_rate_limit_per_min: int_env("AUTH_RATE_LIMIT_PER_MIN", 10),
            order_rate_limit_per_min: int_env(
                "ORDER_RATE_LIMIT_PER_MIN",
                DEFAULT_ORDER_RATE_LIMIT_PER_MIN,
            ),
            max_pending_orders_per_parent: max_pending_orders(),
            cookie_secure: CookieSecure::parse(&str_env("COOKIE_SECURE", "auto")),
            sweep_interval_seconds: u64::try_from(int_env("SWEEP_INTERVAL_SECONDS", 300))
                .unwrap_or(300)
                .max(1),
        }
    }

    /// `{base}` for password-reset links (§5.8.3 #11): `PUBLIC_BASE_URL`, or
    /// `http://localhost:{APP_PORT}` when it is empty.
    pub fn link_base(&self) -> String {
        if self.public_base_url.is_empty() {
            format!("http://localhost:{}", self.app_port)
        } else {
            self.public_base_url.clone()
        }
    }

    /// A public deployment: `PUBLIC_BASE_URL` starts with `https://`.
    pub fn is_public_https(&self) -> bool {
        self.public_base_url
            .get(..8)
            .is_some_and(|scheme| scheme.eq_ignore_ascii_case("https://"))
    }

    /// §5.11.1 demo guard: `SEED_DEMO` runs unless this is a public `https://`
    /// deployment without `ALLOW_DEMO_SEED_IN_PROD=true`.
    pub fn demo_seed_allowed(&self) -> bool {
        self.seed_demo && (!self.is_public_https() || self.allow_demo_seed_in_prod)
    }

    /// Session lifetime in seconds (cookie `Max-Age`).
    pub fn session_ttl_seconds(&self) -> i64 {
        self.session_ttl_days * 86_400
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEYS: [&str; 17] = [
        "APP_PORT",
        "APP_BIND_HOST",
        "DATABASE_PATH",
        "STATIC_DIR",
        "PUBLIC_BASE_URL",
        "RUMI_ADMIN_WA_PHONE",
        "ADMIN_EMAIL",
        "ADMIN_PASSWORD",
        "SEED_DEMO",
        "PENDING_ORDER_TTL_HOURS",
        "SESSION_TTL_DAYS",
        "AUTH_RATE_LIMIT_PER_MIN",
        "COOKIE_SECURE",
        "SWEEP_INTERVAL_SECONDS",
        "ALLOW_DEMO_SEED_IN_PROD",
        "ORDER_RATE_LIMIT_PER_MIN",
        "MAX_PENDING_ORDERS_PER_PARENT",
    ];

    fn clear() {
        for k in KEYS {
            std::env::remove_var(k);
        }
    }

    #[test]
    fn defaults_apply_without_env() {
        let _guard = crate::testutil::env_lock();
        clear();
        let cfg = Config::from_env();
        assert_eq!(cfg.app_port, 8080);
        assert_eq!(cfg.bind_host, "0.0.0.0");
        assert_eq!(cfg.database_path, "data/rumi.db");
        assert_eq!(cfg.static_dir, "dist");
        assert_eq!(cfg.public_base_url, "");
        assert_eq!(cfg.admin_wa_phone, DEFAULT_ADMIN_WA_PHONE);
        assert!(!cfg.seed_demo);
        assert_eq!(cfg.pending_order_ttl_hours, 48);
        assert_eq!(cfg.session_ttl_days, 30);
        assert_eq!(cfg.session_ttl_seconds(), 30 * 86_400);
        assert_eq!(cfg.auth_rate_limit_per_min, 10);
        assert_eq!(cfg.cookie_secure, CookieSecure::Auto);
        assert_eq!(cfg.sweep_interval_seconds, 300);
        assert_eq!(cfg.link_base(), "http://localhost:8080");
        assert!(!cfg.allow_demo_seed_in_prod);
        assert_eq!(cfg.order_rate_limit_per_min, 10);
        assert_eq!(cfg.max_pending_orders_per_parent, 3);
    }

    #[test]
    fn checkout_limits_and_demo_override_come_from_env() {
        let _guard = crate::testutil::env_lock();
        clear();
        std::env::set_var("ALLOW_DEMO_SEED_IN_PROD", "true");
        std::env::set_var("ORDER_RATE_LIMIT_PER_MIN", "4");
        std::env::set_var("MAX_PENDING_ORDERS_PER_PARENT", "0");
        let cfg = Config::from_env();
        std::env::set_var("MAX_PENDING_ORDERS_PER_PARENT", "-2");
        let negative = Config::from_env();
        clear();
        assert!(cfg.allow_demo_seed_in_prod);
        assert_eq!(cfg.order_rate_limit_per_min, 4);
        assert_eq!(cfg.max_pending_orders_per_parent, 0);
        assert_eq!(negative.max_pending_orders_per_parent, 3);
    }

    fn with_base(base: &str, seed_demo: bool, allow_prod: bool) -> Config {
        Config {
            public_base_url: base.to_string(),
            seed_demo,
            allow_demo_seed_in_prod: allow_prod,
            ..crate::testutil::config()
        }
    }

    #[test]
    fn public_https_deployments_are_detected() {
        assert!(!with_base("", false, false).is_public_https());
        assert!(!with_base("http://rumi.local", false, false).is_public_https());
        assert!(with_base("https://rumi.id", false, false).is_public_https());
        assert!(with_base("HTTPS://RUMI.ID", false, false).is_public_https());
    }

    #[test]
    fn demo_seed_is_refused_on_https_unless_explicitly_allowed() {
        assert!(!with_base("", false, false).demo_seed_allowed());
        assert!(with_base("", true, false).demo_seed_allowed());
        assert!(with_base("http://localhost:8080", true, false).demo_seed_allowed());
        assert!(!with_base("https://rumi.id", true, false).demo_seed_allowed());
        assert!(with_base("https://rumi.id", true, true).demo_seed_allowed());
        assert!(!with_base("https://rumi.id", false, true).demo_seed_allowed());
    }

    #[test]
    fn env_overrides_and_normalization() {
        let _guard = crate::testutil::env_lock();
        clear();
        std::env::set_var("PUBLIC_BASE_URL", " https://rumi-stg.kasibah.com/ ");
        std::env::set_var("RUMI_ADMIN_WA_PHONE", "0812-1111-2222");
        std::env::set_var("SEED_DEMO", "true");
        std::env::set_var("COOKIE_SECURE", "false");
        std::env::set_var("APP_PORT", "not-a-number");
        let cfg = Config::from_env();
        clear();
        assert_eq!(cfg.public_base_url, "https://rumi-stg.kasibah.com");
        assert_eq!(cfg.link_base(), "https://rumi-stg.kasibah.com");
        assert_eq!(cfg.admin_wa_phone, "6281211112222");
        assert!(cfg.seed_demo);
        assert_eq!(cfg.cookie_secure, CookieSecure::Never);
        assert_eq!(cfg.app_port, 8080);
    }

    #[test]
    fn invalid_admin_phone_falls_back_to_default() {
        let _guard = crate::testutil::env_lock();
        clear();
        std::env::set_var("RUMI_ADMIN_WA_PHONE", "12345");
        let cfg = Config::from_env();
        clear();
        assert_eq!(cfg.admin_wa_phone, DEFAULT_ADMIN_WA_PHONE);
    }

    #[test]
    fn cookie_secure_parses_all_modes() {
        assert_eq!(CookieSecure::parse("TRUE"), CookieSecure::Always);
        assert_eq!(CookieSecure::parse("off"), CookieSecure::Never);
        assert_eq!(CookieSecure::parse("auto"), CookieSecure::Auto);
        assert_eq!(CookieSecure::parse("weird"), CookieSecure::Auto);
    }
}
