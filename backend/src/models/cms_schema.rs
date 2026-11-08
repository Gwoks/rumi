//! The fixed CMS registry and strict body shapes (PRD §5.7).
//!
//! Every listed key is required, unknown keys are rejected, text is trimmed and
//! length-checked, and the serialized body is at most 16 KiB. Validation returns
//! a new, normalized (trimmed) document; the input is never mutated.

use serde_json::{Map, Value};

use crate::models::DOMAINS;
use crate::validate::{Errors, MSG_REQUIRED};

pub const PAGES: [&str; 3] = ["home", "who-we-are", "our-approach"];
const SHORT_MAX: usize = 120;
const LONG_MAX: usize = 1000;
const BODY_MAX_BYTES: usize = 16 * 1024;
const ICONS: [&str; 8] = [
    "heart", "hands", "sparkles", "moon", "sun", "star", "leaf", "book",
];
const TONES: [&str; 3] = ["teal", "orange", "yellow"];

#[derive(Debug, Clone, Copy)]
pub enum Shape {
    Short,
    Long,
    ShortOrNull,
    Icon,
    Tone,
    Domain,
    Initials,
    List {
        item: &'static Shape,
        min: usize,
        max: usize,
    },
    Objects {
        fields: Fields,
        min: usize,
        max: usize,
        unique: Option<&'static str>,
    },
}

pub type Fields = &'static [(&'static str, Shape)];

const fn list(item: &'static Shape, min: usize, max: usize) -> Shape {
    Shape::List { item, min, max }
}

const PROSE: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("paragraphs", list(&Shape::Long, 1, 6)),
];

const HERO: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("heading_highlight", Shape::Short),
    ("subheading", Shape::Long),
    ("art_badge", Shape::Short),
    ("art_caption", Shape::Short),
    ("art_motto", Shape::Short),
    ("social_proof", Shape::ShortOrNull),
];

const RUMI_WAY: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("intro", Shape::Long),
    (
        "cards",
        Shape::Objects {
            fields: &[
                ("icon", Shape::Icon),
                ("tone", Shape::Tone),
                ("title", Shape::Short),
                ("text", Shape::Long),
            ],
            min: 1,
            max: 6,
            unique: None,
        },
    ),
];

const FOUNDER_MESSAGE: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("paragraphs", list(&Shape::Long, 1, 6)),
    ("signature_name", Shape::Short),
    ("signature_role", Shape::Short),
];

const MISSION: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("statement", Shape::Long),
    ("points", list(&Shape::Long, 1, 8)),
];

const EDUCATORS: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("intro", Shape::Long),
    (
        "people",
        Shape::Objects {
            fields: &[
                ("name", Shape::Short),
                ("role", Shape::Short),
                ("bio", Shape::Long),
                ("initials", Shape::Initials),
                ("tone", Shape::Tone),
            ],
            min: 1,
            max: 12,
            unique: None,
        },
    ),
];

const DOMAINS_BODY: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("intro", Shape::Long),
    (
        "items",
        Shape::Objects {
            fields: &[
                ("domain", Shape::Domain),
                ("title", Shape::Short),
                ("summary", Shape::Long),
                ("activities", list(&Shape::Short, 1, 6)),
            ],
            min: 1,
            max: 5,
            unique: Some("domain"),
        },
    ),
];

const VALUES: Fields = &[
    ("eyebrow", Shape::Short),
    ("heading", Shape::Short),
    ("intro", Shape::Long),
    (
        "items",
        Shape::Objects {
            fields: &[
                ("icon", Shape::Icon),
                ("title", Shape::Short),
                ("arabic", Shape::ShortOrNull),
                ("text", Shape::Long),
            ],
            min: 1,
            max: 8,
            unique: None,
        },
    ),
];

/// `(page_slug, section_key, shape)` — the only pairs that may exist.
pub const REGISTRY: [(&str, &str, Fields); 9] = [
    ("home", "hero", HERO),
    ("home", "rumi_way", RUMI_WAY),
    ("who-we-are", "founder_message", FOUNDER_MESSAGE),
    ("who-we-are", "philosophy", PROSE),
    ("who-we-are", "mission", MISSION),
    ("who-we-are", "educators", EDUCATORS),
    ("our-approach", "intro", PROSE),
    ("our-approach", "domains", DOMAINS_BODY),
    ("our-approach", "values", VALUES),
];

pub fn is_page(slug: &str) -> bool {
    PAGES.contains(&slug)
}

pub fn shape_for(page_slug: &str, section_key: &str) -> Option<Fields> {
    REGISTRY
        .iter()
        .find(|(p, k, _)| *p == page_slug && *k == section_key)
        .map(|(_, _, fields)| *fields)
}

fn text(v: &Value, max: usize, path: &str, errs: &Errors) -> Option<Value> {
    let Some(s) = v.as_str() else {
        errs.add(path, "Harus berupa teks.");
        return None;
    };
    let trimmed = s.trim();
    let len = trimmed.chars().count();
    if (1..=max).contains(&len) {
        Some(Value::String(trimmed.to_string()))
    } else {
        errs.add(path, format!("Panjang harus 1\u{2013}{max} karakter."));
        None
    }
}

fn choice(v: &Value, allowed: &[&str], path: &str, errs: &Errors) -> Option<Value> {
    match v.as_str() {
        Some(s) if allowed.contains(&s) => Some(Value::String(s.to_string())),
        _ => {
            errs.add(path, "Nilai tidak dikenal.");
            None
        }
    }
}

fn initials(v: &Value, path: &str, errs: &Errors) -> Option<Value> {
    let trimmed = v.as_str().map(str::trim).unwrap_or_default();
    let ok = (1..=3).contains(&trimmed.len()) && trimmed.bytes().all(|b| b.is_ascii_uppercase());
    if ok {
        Some(Value::String(trimmed.to_string()))
    } else {
        errs.add(path, "Harus 1\u{2013}3 huruf kapital A\u{2013}Z.");
        None
    }
}

fn array<'v>(
    v: &'v Value,
    min: usize,
    max: usize,
    path: &str,
    errs: &Errors,
) -> Option<&'v Vec<Value>> {
    match v.as_array() {
        Some(items) if (min..=max).contains(&items.len()) => Some(items),
        Some(_) => {
            errs.add(path, format!("Jumlah harus {min}\u{2013}{max}."));
            None
        }
        None => {
            errs.add(path, "Harus berupa daftar.");
            None
        }
    }
}

fn objects(
    v: &Value,
    fields: Fields,
    bounds: (usize, usize),
    unique: Option<&str>,
    path: &str,
    errs: &Errors,
) -> Option<Value> {
    let items = array(v, bounds.0, bounds.1, path, errs)?;
    let checked: Vec<Option<Value>> = items
        .iter()
        .enumerate()
        .map(|(i, item)| object(fields, item, &format!("{path}.{i}"), errs))
        .collect();
    if let Some(key) = unique {
        let values: Vec<&Value> = items.iter().filter_map(|i| i.get(key)).collect();
        let has_dupe = values
            .iter()
            .enumerate()
            .any(|(i, v)| values[..i].contains(v));
        if has_dupe {
            errs.add(path, format!("Nilai {key} harus unik."));
        }
    }
    checked
        .into_iter()
        .collect::<Option<Vec<Value>>>()
        .map(Value::Array)
}

fn check(shape: &Shape, v: &Value, path: &str, errs: &Errors) -> Option<Value> {
    match *shape {
        Shape::Short => text(v, SHORT_MAX, path, errs),
        Shape::Long => text(v, LONG_MAX, path, errs),
        Shape::ShortOrNull if v.is_null() => Some(Value::Null),
        Shape::ShortOrNull => text(v, SHORT_MAX, path, errs),
        Shape::Icon => choice(v, &ICONS, path, errs),
        Shape::Tone => choice(v, &TONES, path, errs),
        Shape::Domain => choice(v, &DOMAINS, path, errs),
        Shape::Initials => initials(v, path, errs),
        Shape::List { item, min, max } => {
            let items = array(v, min, max, path, errs)?;
            items
                .iter()
                .enumerate()
                .map(|(i, x)| check(item, x, &format!("{path}.{i}"), errs))
                .collect::<Vec<_>>()
                .into_iter()
                .collect::<Option<Vec<Value>>>()
                .map(Value::Array)
        }
        Shape::Objects {
            fields,
            min,
            max,
            unique,
        } => objects(v, fields, (min, max), unique, path, errs),
    }
}

fn object(fields: Fields, v: &Value, path: &str, errs: &Errors) -> Option<Value> {
    let Some(map) = v.as_object() else {
        errs.add(path, "Harus berupa objek.");
        return None;
    };
    map.keys()
        .filter(|k| !fields.iter().any(|(name, _)| name == k))
        .for_each(|k| errs.add(format!("{path}.{k}"), "Kolom tidak dikenal."));
    let checked: Vec<Option<(String, Value)>> = fields
        .iter()
        .map(|(name, shape)| {
            let field_path = format!("{path}.{name}");
            match map.get(*name) {
                None => {
                    errs.add(field_path, MSG_REQUIRED);
                    None
                }
                Some(value) => {
                    check(shape, value, &field_path, errs).map(|nv| (name.to_string(), nv))
                }
            }
        })
        .collect();
    checked
        .into_iter()
        .collect::<Option<Map<String, Value>>>()
        .map(Value::Object)
}

/// Validate `body` against `fields`, recording errors under `body.…`. Returns
/// the normalized document when valid.
pub fn validate_body(fields: Fields, body: &Value, errs: &Errors) -> Option<Value> {
    let size = serde_json::to_string(body)
        .map(|s| s.len())
        .unwrap_or(usize::MAX);
    if size > BODY_MAX_BYTES {
        errs.add("body", "Ukuran body maksimal 16 KiB.");
        return None;
    }
    object(fields, body, "body", errs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fields_of(errs: &Errors) -> Vec<String> {
        errs.finish()
            .err()
            .and_then(|e| e.fields)
            .map(|f| f.keys().cloned().collect())
            .unwrap_or_default()
    }

    #[test]
    fn registry_lookup() {
        assert!(shape_for("home", "hero").is_some());
        assert!(shape_for("home", "values").is_none());
        assert!(is_page("who-we-are"));
        assert!(!is_page("blog"));
    }

    #[test]
    fn valid_prose_is_trimmed() {
        let errs = Errors::new();
        let body = json!({"eyebrow": " E ", "heading": "H", "paragraphs": ["  P  "]});
        let out = validate_body(PROSE, &body, &errs).unwrap();
        assert!(errs.is_empty());
        assert_eq!(
            out,
            json!({"eyebrow": "E", "heading": "H", "paragraphs": ["P"]})
        );
    }

    #[test]
    fn strictness_unknown_missing_and_limits() {
        let errs = Errors::new();
        let body = json!({"eyebrow": "", "paragraphs": [], "extra": 1});
        assert!(validate_body(PROSE, &body, &errs).is_none());
        let fields = fields_of(&errs);
        for key in [
            "body.eyebrow",
            "body.heading",
            "body.paragraphs",
            "body.extra",
        ] {
            assert!(fields.contains(&key.to_string()), "{key}: {fields:?}");
        }
    }

    #[test]
    fn nested_objects_enums_initials_and_uniqueness() {
        let errs = Errors::new();
        let body = json!({
            "eyebrow": "E", "heading": "H", "intro": "I",
            "items": [
                {"domain": "MATH", "title": "T", "summary": "S", "activities": ["a"]},
                {"domain": "MATH", "title": "T", "summary": "S", "activities": [1]}
            ]
        });
        assert!(validate_body(DOMAINS_BODY, &body, &errs).is_none());
        let fields = fields_of(&errs);
        assert!(fields.contains(&"body.items".to_string()));
        assert!(fields.contains(&"body.items.1.activities.0".to_string()));

        let errs2 = Errors::new();
        let people = json!({
            "eyebrow": "E", "heading": "H", "intro": "I",
            "people": [{"name": "N", "role": "R", "bio": "B", "initials": "nr", "tone": "pink"}]
        });
        assert!(validate_body(EDUCATORS, &people, &errs2).is_none());
        let fields2 = fields_of(&errs2);
        assert!(fields2.contains(&"body.people.0.initials".to_string()));
        assert!(fields2.contains(&"body.people.0.tone".to_string()));
    }

    #[test]
    fn nullable_short_and_type_errors() {
        let errs = Errors::new();
        let body = json!({
            "eyebrow": "E", "heading": "H", "intro": "I",
            "items": [{"icon": "sun", "title": "T", "arabic": null, "text": "x"}]
        });
        assert!(validate_body(VALUES, &body, &errs).is_some());
        let errs2 = Errors::new();
        assert!(validate_body(VALUES, &json!([1]), &errs2).is_none());
        let errs3 = Errors::new();
        let big = json!({"eyebrow": "x".repeat(17 * 1024)});
        assert!(validate_body(VALUES, &big, &errs3).is_none());
        assert_eq!(fields_of(&errs3), vec!["body".to_string()]);
        let errs4 = Errors::new();
        let wrong = json!({"eyebrow": 1, "heading": "H", "intro": "I", "items": "x"});
        assert!(validate_body(VALUES, &wrong, &errs4).is_none());
    }
}
