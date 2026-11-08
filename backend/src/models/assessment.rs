//! `student_assessments` (PRD §5.6 `Assessment`, §5.8.5 #37 `AssessmentCreate`).

use serde::Serialize;
use sqlx::SqliteExecutor;

use crate::models::DOMAINS;
use crate::validate::{FieldSpec, Rule};

const fn spec(key: &'static str, rule: Rule, required: bool, nullable: bool) -> FieldSpec {
    FieldSpec {
        key,
        rule,
        required,
        nullable,
    }
}

/// `AssessmentCreate` rules (`child_id` / `class_id` existence is checked after).
pub const ASSESSMENT_SPECS: [FieldSpec; 7] = [
    spec(
        "child_id",
        Rule::Int {
            min: 1,
            max: i64::MAX,
        },
        true,
        false,
    ),
    spec(
        "class_id",
        Rule::Int {
            min: 1,
            max: i64::MAX,
        },
        false,
        true,
    ),
    spec("domain", Rule::Enum(&DOMAINS), true, false),
    spec("level", Rule::Int { min: 1, max: 4 }, true, false),
    spec("milestone", Rule::Text { min: 1, max: 200 }, true, false),
    spec("notes", Rule::Text { min: 0, max: 1000 }, false, true),
    spec("observed_on", Rule::PastDate, true, false),
];

#[derive(Debug, Clone, Serialize, sqlx::FromRow, PartialEq, Eq)]
pub struct Assessment {
    pub id: i64,
    pub child_id: i64,
    pub class_id: Option<i64>,
    pub class_title: Option<String>,
    pub assessor_id: i64,
    pub assessor_name: String,
    pub domain: String,
    pub level: i64,
    pub milestone: String,
    pub notes: Option<String>,
    pub observed_on: String,
    pub created_at: String,
}

const ASSESSMENT_SELECT: &str = "SELECT a.id, a.child_id, a.class_id, w.title AS class_title, \
     a.assessor_id, u.full_name AS assessor_name, a.domain, a.level, a.milestone, a.notes, \
     a.observed_on, strftime('%Y-%m-%dT%H:%M:%SZ', a.created_at) AS created_at \
     FROM student_assessments a \
     JOIN users u ON u.id = a.assessor_id \
     LEFT JOIN weekend_classes w ON w.id = a.class_id";

/// A child's assessments, `ORDER BY observed_on DESC, id DESC`.
pub async fn list_for_child<'e, E: SqliteExecutor<'e>>(
    exec: E,
    child_id: i64,
) -> Result<Vec<Assessment>, sqlx::Error> {
    let sql =
        format!("{ASSESSMENT_SELECT} WHERE a.child_id = ? ORDER BY a.observed_on DESC, a.id DESC");
    sqlx::query_as::<_, Assessment>(&sql)
        .bind(child_id)
        .fetch_all(exec)
        .await
}

pub async fn find<'e, E: SqliteExecutor<'e>>(
    exec: E,
    id: i64,
) -> Result<Option<Assessment>, sqlx::Error> {
    let sql = format!("{ASSESSMENT_SELECT} WHERE a.id = ?");
    sqlx::query_as::<_, Assessment>(&sql)
        .bind(id)
        .fetch_optional(exec)
        .await
}
