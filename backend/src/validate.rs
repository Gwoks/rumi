//! Request-body validation toolkit (PRD §5.4).
//!
//! Bodies are read as `serde_json::Value` so every rule can report a dotted
//! request path in `fields` (e.g. `parent.email`, `items.2.quantity`) and so
//! PATCH can tell "absent" from `null`. Unknown keys are simply never read
//! (§5.1: they are ignored and never affect behavior).

use std::collections::BTreeMap;
use std::sync::{Mutex, MutexGuard};

use serde_json::{Map, Value};

use crate::error::ApiError;
use crate::helpers::{age_years, is_valid_time, parse_date, today_wib};

pub const MSG_REQUIRED: &str = "Wajib diisi.";
pub const MSG_NOT_NULL: &str = "Tidak boleh kosong.";
pub const MSG_NO_CHANGES: &str = "Tidak ada perubahan.";
pub const MAX_CHILD_AGE: i64 = 12;
const EMAIL_MAX: usize = 254;
/// Password rule for register and reset (§5.4.7).
pub const PASSWORD: Rule = Rule::Secret { min: 8, max: 128 };
const IMAGE_URL_MAX: usize = 500;

/// A value ready to bind into SQL.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SqlValue {
    Null,
    Int(i64),
    Text(String),
}

impl SqlValue {
    pub fn as_text(&self) -> Option<&str> {
        match self {
            SqlValue::Text(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_int(&self) -> Option<i64> {
        match self {
            SqlValue::Int(n) => Some(*n),
            _ => None,
        }
    }
}

/// One field rule (§5.4 formats + §5.8 limits).
#[derive(Debug, Clone, Copy)]
pub enum Rule {
    /// Trimmed text, `min..=max` scalar values. With `min == 0`, empty → `null`.
    Text {
        min: usize,
        max: usize,
    },
    Int {
        min: i64,
        max: i64,
    },
    Bool,
    Date,
    /// A date on or before today (WIB).
    PastDate,
    /// A birth date: on or before today (WIB) with `age_years ≤ 12`.
    Dob,
    Time,
    Enum(&'static [&'static str]),
    ImageUrl,
    Email,
    Phone,
    /// Untrimmed secret (passwords, §5.4.7), `min..=max` scalar values.
    Secret {
        min: usize,
        max: usize,
    },
}

fn text_len_msg(min: usize, max: usize) -> String {
    if min == 0 {
        format!("Maksimal {max} karakter.")
    } else {
        format!("Panjang harus {min}\u{2013}{max} karakter.")
    }
}

fn as_str(v: &Value) -> Result<&str, String> {
    v.as_str().ok_or_else(|| "Harus berupa teks.".to_string())
}

fn apply_text(v: &Value, min: usize, max: usize) -> Result<SqlValue, String> {
    let trimmed = as_str(v)?.trim();
    let len = trimmed.chars().count();
    if min == 0 && len == 0 {
        return Ok(SqlValue::Null);
    }
    if len < min || len > max {
        return Err(text_len_msg(min, max));
    }
    Ok(SqlValue::Text(trimmed.to_string()))
}

fn apply_int(v: &Value, min: i64, max: i64) -> Result<SqlValue, String> {
    let n = v
        .as_i64()
        .ok_or_else(|| "Harus berupa bilangan bulat.".to_string())?;
    if n < min || n > max {
        return Err(format!("Harus antara {min} dan {max}."));
    }
    Ok(SqlValue::Int(n))
}

fn apply_date(v: &Value, rule: Rule) -> Result<SqlValue, String> {
    let raw = as_str(v)?.trim();
    let date = parse_date(raw).ok_or_else(|| "Format tanggal harus YYYY-MM-DD.".to_string())?;
    let today = today_wib();
    let needs_past = matches!(rule, Rule::PastDate | Rule::Dob);
    if needs_past && date > today {
        return Err("Tanggal tidak boleh di masa depan.".to_string());
    }
    if matches!(rule, Rule::Dob) && age_years(date, today) > MAX_CHILD_AGE {
        return Err(format!("Usia anak maksimal {MAX_CHILD_AGE} tahun."));
    }
    Ok(SqlValue::Text(raw.to_string()))
}

fn apply_image_url(v: &Value) -> Result<SqlValue, String> {
    let trimmed = as_str(v)?.trim();
    if trimmed.is_empty() {
        return Ok(SqlValue::Null);
    }
    // §5.8.6: `https://…` or a same-origin `/path`; never a protocol-relative
    // `//host` and never a backslash (browsers read `/\host` as `//host`).
    let ok_prefix =
        trimmed.starts_with("https://") || (trimmed.starts_with('/') && !trimmed.starts_with("//"));
    let has_backslash = trimmed.contains('\\');
    if !ok_prefix || has_backslash || trimmed.chars().count() > IMAGE_URL_MAX {
        return Err(
            "Harus diawali https:// atau satu / (bukan //), tanpa \\, maksimal 500 karakter."
                .to_string(),
        );
    }
    Ok(SqlValue::Text(trimmed.to_string()))
}

/// Validate a non-null JSON value against `rule`.
pub fn apply(rule: Rule, v: &Value) -> Result<SqlValue, String> {
    match rule {
        Rule::Text { min, max } => apply_text(v, min, max),
        Rule::Int { min, max } => apply_int(v, min, max),
        Rule::Bool => v
            .as_bool()
            .map(|b| SqlValue::Int(i64::from(b)))
            .ok_or_else(|| "Harus berupa true atau false.".to_string()),
        Rule::Date | Rule::PastDate | Rule::Dob => apply_date(v, rule),
        Rule::Time => {
            let raw = as_str(v)?.trim();
            if is_valid_time(raw) {
                Ok(SqlValue::Text(raw.to_string()))
            } else {
                Err("Format waktu harus HH:MM.".to_string())
            }
        }
        Rule::Enum(allowed) => {
            let raw = as_str(v)?;
            allowed
                .iter()
                .find(|a| **a == raw)
                .map(|a| SqlValue::Text((*a).to_string()))
                .ok_or_else(|| "Nilai tidak dikenal.".to_string())
        }
        Rule::ImageUrl => apply_image_url(v),
        Rule::Email => normalize_email(as_str(v)?)
            .map(SqlValue::Text)
            .ok_or_else(|| "Format email tidak valid.".to_string()),
        Rule::Phone => normalize_phone(as_str(v)?)
            .map(SqlValue::Text)
            .ok_or_else(|| "Nomor WhatsApp tidak valid.".to_string()),
        Rule::Secret { min, max } => {
            let raw = as_str(v)?;
            let len = raw.chars().count();
            if (min..=max).contains(&len) {
                Ok(SqlValue::Text(raw.to_string()))
            } else {
                Err(format!("Kata sandi harus {min}\u{2013}{max} karakter."))
            }
        }
    }
}

/// Email (§5.4.5): trimmed, lowercased, ≤ 254 chars, `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
pub fn normalize_email(raw: &str) -> Option<String> {
    let email = raw.trim().to_lowercase();
    if email.chars().count() > EMAIL_MAX || email.chars().any(char::is_whitespace) {
        return None;
    }
    let (local, domain) = email.split_once('@')?;
    if local.is_empty() || domain.contains('@') {
        return None;
    }
    // Needs a '.' with at least one char on each side inside the domain.
    let dot_ok = domain
        .char_indices()
        .any(|(i, c)| c == '.' && i > 0 && i + 1 < domain.len());
    dot_ok.then_some(email)
}

/// WhatsApp phone normalization (§5.4.6) → `62…`, or `None` when invalid.
pub fn normalize_phone(raw: &str) -> Option<String> {
    let stripped: String = raw
        .chars()
        .filter(|c| !matches!(c, ' ' | '-' | '.' | '(' | ')'))
        .collect();
    let digits = stripped.strip_prefix('+').unwrap_or(&stripped);
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let normalized = if let Some(rest) = digits.strip_prefix('0') {
        format!("62{rest}")
    } else if digits.starts_with('8') {
        format!("62{digits}")
    } else if digits.starts_with("62") {
        digits.to_string()
    } else {
        return None;
    };
    let b = normalized.as_bytes();
    let shape_ok = (10..=15).contains(&b.len()) && b[2] != b'0';
    shape_ok.then_some(normalized)
}

/// Collected field errors keyed by dotted request path (the first message per
/// path wins). A `Mutex` rather than a `RefCell` keeps handler futures `Send`.
#[derive(Default)]
pub struct Errors(Mutex<BTreeMap<String, String>>);

impl Errors {
    pub fn new() -> Self {
        Errors::default()
    }

    fn map(&self) -> MutexGuard<'_, BTreeMap<String, String>> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn add(&self, path: impl Into<String>, message: impl Into<String>) {
        self.map()
            .entry(path.into())
            .or_insert_with(|| message.into());
    }

    pub fn is_empty(&self) -> bool {
        self.map().is_empty()
    }

    pub fn len(&self) -> usize {
        self.map().len()
    }

    /// `Ok(())` when nothing failed, else `422 validation_error` with `fields`.
    pub fn finish(&self) -> Result<(), ApiError> {
        let map = self.map();
        if map.is_empty() {
            Ok(())
        } else {
            Err(ApiError::validation_fields(map.clone()))
        }
    }
}

/// The body must be a JSON object (§5.4.9); anything else is `422`.
pub fn body_object(v: &Value) -> Result<&Map<String, Value>, ApiError> {
    v.as_object()
        .ok_or_else(|| ApiError::validation("Isi permintaan harus berupa objek JSON."))
}

/// Reads fields of one JSON object, recording errors under `prefix.key`.
pub struct Reader<'a> {
    map: &'a Map<String, Value>,
    prefix: String,
    errs: &'a Errors,
}

impl<'a> Reader<'a> {
    pub fn new(map: &'a Map<String, Value>, errs: &'a Errors) -> Self {
        Reader {
            map,
            prefix: String::new(),
            errs,
        }
    }

    pub fn path(&self, key: &str) -> String {
        if self.prefix.is_empty() {
            key.to_string()
        } else {
            format!("{}.{key}", self.prefix)
        }
    }

    pub fn has(&self, key: &str) -> bool {
        self.map.contains_key(key)
    }

    pub fn raw(&self, key: &str) -> Option<&'a Value> {
        self.map.get(key)
    }

    pub fn error(&self, key: &str, message: impl Into<String>) {
        self.errs.add(self.path(key), message);
    }

    /// Generic field read. Absent → `None` (error if `required`); `null` →
    /// `Some(Null)` when `nullable`, else an error; otherwise the rule applies.
    pub fn field(&self, key: &str, rule: Rule, required: bool, nullable: bool) -> Option<SqlValue> {
        match self.map.get(key) {
            None => {
                if required {
                    self.error(key, MSG_REQUIRED);
                }
                None
            }
            Some(Value::Null) if nullable => Some(SqlValue::Null),
            Some(Value::Null) => {
                self.error(key, if required { MSG_REQUIRED } else { MSG_NOT_NULL });
                None
            }
            Some(v) => match apply(rule, v) {
                Ok(SqlValue::Null) if !nullable => {
                    self.error(key, MSG_REQUIRED);
                    None
                }
                Ok(value) => Some(value),
                Err(msg) => {
                    self.error(key, msg);
                    None
                }
            },
        }
    }

    /// A required, non-null string (`""` when invalid; the error is recorded).
    pub fn req_string(&self, key: &str, rule: Rule) -> String {
        self.field(key, rule, true, false)
            .and_then(|v| v.as_text().map(str::to_string))
            .unwrap_or_default()
    }

    /// A required, non-null integer (`0` when invalid).
    pub fn req_int(&self, key: &str, min: i64, max: i64) -> i64 {
        self.field(key, Rule::Int { min, max }, true, false)
            .and_then(|v| v.as_int())
            .unwrap_or_default()
    }

    /// An optional, nullable text field; empty after trimming → `None`.
    pub fn opt_text(&self, key: &str, max: usize) -> Option<String> {
        self.field(key, Rule::Text { min: 0, max }, false, true)
            .and_then(|v| v.as_text().map(str::to_string))
    }

    /// A required nested object.
    pub fn object(&self, key: &str) -> Option<Reader<'a>> {
        match self.map.get(key) {
            Some(Value::Object(map)) => Some(self.child(map, self.path(key))),
            Some(_) => {
                self.error(key, "Harus berupa objek.");
                None
            }
            None => {
                self.error(key, MSG_REQUIRED);
                None
            }
        }
    }

    /// A required array with `min..=max` elements.
    pub fn array(&self, key: &str, min: usize, max: usize) -> Option<&'a Vec<Value>> {
        match self.map.get(key) {
            Some(Value::Array(items)) if (min..=max).contains(&items.len()) => Some(items),
            Some(Value::Array(_)) => {
                self.error(key, format!("Jumlah harus {min}\u{2013}{max}."));
                None
            }
            Some(_) => {
                self.error(key, "Harus berupa daftar.");
                None
            }
            None => {
                self.error(key, MSG_REQUIRED);
                None
            }
        }
    }

    /// A reader over element `index` of an array read from `key`.
    pub fn element(&self, key: &str, index: usize, value: &'a Value) -> Option<Reader<'a>> {
        let path = format!("{}.{index}", self.path(key));
        match value {
            Value::Object(map) => Some(self.child(map, path)),
            _ => {
                self.errs.add(path, "Harus berupa objek.");
                None
            }
        }
    }

    fn child(&self, map: &'a Map<String, Value>, prefix: String) -> Reader<'a> {
        Reader {
            map,
            prefix,
            errs: self.errs,
        }
    }
}

/// A field accepted by a create/PATCH endpoint. `key` doubles as the column
/// name, so only these code constants ever reach SQL text.
#[derive(Debug, Clone, Copy)]
pub struct FieldSpec {
    pub key: &'static str,
    pub rule: Rule,
    pub required: bool,
    pub nullable: bool,
}

pub type Changes = Vec<(&'static str, SqlValue)>;

/// Create: required fields must be present; absent optional ones are omitted
/// (the column default applies).
pub fn parse_create(r: &Reader<'_>, specs: &[FieldSpec]) -> Changes {
    specs
        .iter()
        .filter_map(|s| {
            r.field(s.key, s.rule, s.required, s.nullable)
                .map(|v| (s.key, v))
        })
        .collect()
}

/// PATCH (§5.4.9): only present fields; `null` clears nullable fields only.
pub fn parse_patch(r: &Reader<'_>, specs: &[FieldSpec]) -> Changes {
    specs
        .iter()
        .filter(|s| r.has(s.key))
        .filter_map(|s| {
            r.field(s.key, s.rule, false, s.nullable)
                .map(|v| (s.key, v))
        })
        .collect()
}

/// `422 "Tidak ada perubahan."` when a PATCH body has no recognized field.
pub fn ensure_any_known(r: &Reader<'_>, specs: &[FieldSpec]) -> Result<(), ApiError> {
    if specs.iter().any(|s| r.has(s.key)) {
        Ok(())
    } else {
        Err(ApiError::validation(MSG_NO_CHANGES))
    }
}

/// Look up a parsed change by key.
pub fn change<'c>(changes: &'c Changes, key: &str) -> Option<&'c SqlValue> {
    changes.iter().find(|(k, _)| *k == key).map(|(_, v)| v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    use serde_json::json;

    #[test]
    fn phone_normalization_examples() {
        assert_eq!(
            normalize_phone("0812-3456-7890").as_deref(),
            Some("6281234567890")
        );
        assert_eq!(
            normalize_phone("+62 812 3456 7890").as_deref(),
            Some("6281234567890")
        );
        assert_eq!(normalize_phone("812345678").as_deref(), Some("62812345678"));
        assert_eq!(
            normalize_phone("(0812) 1111.2222").as_deref(),
            Some("6281211112222")
        );
        for bad in [
            "",
            "+",
            "12345",
            "620812345678",
            "08abc",
            "62812",
            "6281234567890123",
            "++62812345678",
        ] {
            assert_eq!(normalize_phone(bad), None, "{bad}");
        }
    }

    #[test]
    fn email_normalization() {
        assert_eq!(
            normalize_email("  Nadia@Example.COM ").as_deref(),
            Some("nadia@example.com")
        );
        for bad in [
            "", "a@b", "a@.b", "a@b.", "@b.co", "a b@c.co", "a@b@c.co", "plain",
        ] {
            assert_eq!(normalize_email(bad), None, "{bad}");
        }
        let long = format!("{}@x.co", "a".repeat(250));
        assert_eq!(normalize_email(&long), None);
    }

    #[test]
    fn rules_accept_and_reject() {
        let text = Rule::Text { min: 2, max: 5 };
        assert_eq!(
            apply(text, &json!("  ab ")),
            Ok(SqlValue::Text("ab".into()))
        );
        assert!(apply(text, &json!("a")).is_err());
        assert!(apply(text, &json!(5)).is_err());
        assert_eq!(
            apply(Rule::Text { min: 0, max: 5 }, &json!("  ")),
            Ok(SqlValue::Null)
        );
        assert_eq!(
            apply(Rule::Int { min: 1, max: 4 }, &json!(4)),
            Ok(SqlValue::Int(4))
        );
        assert!(apply(Rule::Int { min: 1, max: 4 }, &json!(5)).is_err());
        assert!(apply(Rule::Int { min: 1, max: 4 }, &json!(2.5)).is_err());
        assert_eq!(apply(Rule::Bool, &json!(true)), Ok(SqlValue::Int(1)));
        assert!(apply(Rule::Bool, &json!("true")).is_err());
        assert!(apply(Rule::Time, &json!("09:30")).is_ok());
        assert!(apply(Rule::Time, &json!("9:30")).is_err());
        assert!(apply(Rule::Enum(&["A", "B"]), &json!("B")).is_ok());
        assert!(apply(Rule::Enum(&["A", "B"]), &json!("C")).is_err());
        assert!(apply(Rule::ImageUrl, &json!("https://x.id/a.png")).is_ok());
        assert!(apply(Rule::ImageUrl, &json!("/brand/a.svg")).is_ok());
        assert!(apply(Rule::ImageUrl, &json!("http://x.id/a.png")).is_err());
        // Protocol-relative and backslash tricks point at another host.
        for bad in [
            "//evil.example/a.png",
            "/\\evil.example/a.png",
            "/brand\\a.svg",
            "https://x.id\\@evil.example/a.png",
        ] {
            assert!(apply(Rule::ImageUrl, &json!(bad)).is_err(), "{bad}");
        }
        assert_eq!(apply(Rule::ImageUrl, &json!("")), Ok(SqlValue::Null));
        assert_eq!(
            apply(PASSWORD, &json!("  short ")),
            Ok(SqlValue::Text("  short ".into()))
        );
        assert!(apply(PASSWORD, &json!("short")).is_err());
        assert!(apply(Rule::Email, &json!("x")).is_err());
        assert!(apply(Rule::Phone, &json!("x")).is_err());
    }

    #[test]
    fn date_rules_use_wib_today() {
        let today = today_wib();
        let tomorrow = (today + Duration::days(1)).format("%Y-%m-%d").to_string();
        let today_s = today.format("%Y-%m-%d").to_string();
        assert!(apply(Rule::Date, &json!(tomorrow)).is_ok());
        assert!(apply(Rule::PastDate, &json!(tomorrow)).is_err());
        assert!(apply(Rule::PastDate, &json!(today_s)).is_ok());
        assert!(apply(Rule::Dob, &json!("2000-01-01")).is_err());
        assert!(apply(Rule::Dob, &json!("2026-02-30")).is_err());
    }

    #[test]
    fn reader_collects_dotted_paths() {
        let body = json!({"parent": {"email": "bad"}, "items": [{"quantity": 0}, 7]});
        let errs = Errors::new();
        let r = Reader::new(body.as_object().unwrap(), &errs);
        let parent = r.object("parent").unwrap();
        parent.req_string("email", Rule::Email);
        parent.req_string("full_name", Rule::Text { min: 2, max: 100 });
        let items = r.array("items", 1, 20).unwrap();
        let first = r.element("items", 0, &items[0]).unwrap();
        first.req_int("quantity", 1, 10);
        assert!(r.element("items", 1, &items[1]).is_none());
        r.object("delivery");
        let err = errs.finish().unwrap_err();
        let fields = err.fields.unwrap();
        assert!(fields.contains_key("parent.email"));
        assert_eq!(fields["parent.full_name"], MSG_REQUIRED);
        assert!(fields.contains_key("items.0.quantity"));
        assert!(fields.contains_key("items.1"));
        assert!(fields.contains_key("delivery"));
    }

    #[test]
    fn create_and_patch_parsing() {
        const SPECS: [FieldSpec; 2] = [
            FieldSpec {
                key: "name",
                rule: Rule::Text { min: 1, max: 10 },
                required: true,
                nullable: false,
            },
            FieldSpec {
                key: "notes",
                rule: Rule::Text { min: 0, max: 10 },
                required: false,
                nullable: true,
            },
        ];
        let errs = Errors::new();
        let body = json!({"name": "A", "unknown": 1});
        let r = Reader::new(body.as_object().unwrap(), &errs);
        let created = parse_create(&r, &SPECS);
        assert_eq!(created, vec![("name", SqlValue::Text("A".into()))]);
        assert!(errs.finish().is_ok());

        let patch_body = json!({"notes": null, "name": null});
        let errs2 = Errors::new();
        let r2 = Reader::new(patch_body.as_object().unwrap(), &errs2);
        let patched = parse_patch(&r2, &SPECS);
        assert_eq!(patched, vec![("notes", SqlValue::Null)]);
        assert_eq!(change(&patched, "notes"), Some(&SqlValue::Null));
        assert_eq!(
            errs2.finish().unwrap_err().fields.unwrap()["name"],
            MSG_NOT_NULL
        );

        let empty = json!({"other": 1});
        let errs3 = Errors::new();
        let r3 = Reader::new(empty.as_object().unwrap(), &errs3);
        assert_eq!(
            ensure_any_known(&r3, &SPECS).unwrap_err().message,
            MSG_NO_CHANGES
        );
        assert!(body_object(&json!([1])).is_err());
    }

    #[test]
    fn array_shape_errors() {
        let body = json!({"a": [], "b": "x"});
        let errs = Errors::new();
        let r = Reader::new(body.as_object().unwrap(), &errs);
        assert!(r.array("a", 1, 2).is_none());
        assert!(r.array("b", 1, 2).is_none());
        assert!(r.array("c", 1, 2).is_none());
        assert!(r.object("b").is_none());
        assert_eq!(r.opt_text("missing", 5), None);
        // "b" fails twice; the first message wins, so three paths remain.
        assert_eq!(errs.len(), 3);
    }
}
