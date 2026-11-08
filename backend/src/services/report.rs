//! Child progress views (PRD §5.6 `ChildReport`, `StudentSummary`, `StudentDetail`).

use serde::Serialize;
use sqlx::{SqliteExecutor, SqlitePool};

use crate::extract::Page;
use crate::helpers::{
    age_years, like_pattern, now_utc, parse_date, pct_round, rfc3339, today_wib, upcoming_sql,
};
use crate::models::assessment::{self, Assessment};
use crate::models::child::Child;
use crate::models::enrollment::{self, Enrollment};
use crate::models::user::User;
use crate::models::DOMAINS;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AttendanceSummary {
    pub attended: i64,
    pub absent: i64,
    pub upcoming: i64,
    pub attendance_rate_pct: Option<i64>,
}

impl AttendanceSummary {
    pub fn new(attended: i64, absent: i64, upcoming: i64) -> Self {
        let held = attended + absent;
        AttendanceSummary {
            attended,
            absent,
            upcoming,
            attendance_rate_pct: (held > 0).then(|| pct_round(attended, held)),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DomainLevel {
    pub domain: String,
    pub level: Option<i64>,
    pub observed_on: Option<String>,
    pub milestone: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ChildReport {
    pub child: Child,
    pub latest_levels: Vec<DomainLevel>,
    pub assessments: Vec<Assessment>,
    pub attendance: AttendanceSummary,
    pub enrollments: Vec<Enrollment>,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StudentDetail {
    pub child: Child,
    pub parent: User,
    pub latest_levels: Vec<DomainLevel>,
    pub assessments: Vec<Assessment>,
    pub attendance: AttendanceSummary,
    pub enrollments: Vec<Enrollment>,
    pub generated_at: String,
}

/// Exactly 5 entries in canonical domain order, each from the assessment with
/// the greatest `(observed_on, id)`; expects `assessments` sorted that way DESC.
pub fn latest_levels(assessments: &[Assessment]) -> Vec<DomainLevel> {
    DOMAINS
        .iter()
        .map(|domain| {
            let latest = assessments.iter().find(|a| a.domain == *domain);
            DomainLevel {
                domain: (*domain).to_string(),
                level: latest.map(|a| a.level),
                observed_on: latest.map(|a| a.observed_on.clone()),
                milestone: latest.map(|a| a.milestone.clone()),
            }
        })
        .collect()
}

/// Attendance counts for one child (§5.6 `AttendanceSummary`).
pub async fn attendance<'e, E: SqliteExecutor<'e>>(
    exec: E,
    child_id: i64,
) -> Result<AttendanceSummary, sqlx::Error> {
    let sql = format!(
        "SELECT COALESCE(SUM(e.status = 'ATTENDED'), 0), COALESCE(SUM(e.status = 'ABSENT'), 0),
                COALESCE(SUM(e.status IN ('RESERVED', 'CONFIRMED') AND {}), 0)
         FROM class_enrollments e JOIN weekend_classes w ON w.id = e.class_id
         WHERE e.child_id = ?",
        upcoming_sql("w")
    );
    let (attended, absent, upcoming): (i64, i64, i64) =
        sqlx::query_as(&sql).bind(child_id).fetch_one(exec).await?;
    Ok(AttendanceSummary::new(attended, absent, upcoming))
}

/// Build the full report for an (already authorized) child.
pub async fn child_report(pool: &SqlitePool, child: Child) -> Result<ChildReport, sqlx::Error> {
    let assessments = assessment::list_for_child(pool, child.id).await?;
    let enrollments = enrollment::list_for_child(pool, child.id).await?;
    let attendance = attendance(pool, child.id).await?;
    Ok(ChildReport {
        latest_levels: latest_levels(&assessments),
        child,
        assessments,
        attendance,
        enrollments,
        generated_at: rfc3339(now_utc()),
    })
}

pub fn student_detail(report: ChildReport, parent: User) -> StudentDetail {
    StudentDetail {
        child: report.child,
        parent,
        latest_levels: report.latest_levels,
        assessments: report.assessments,
        attendance: report.attendance,
        enrollments: report.enrollments,
        generated_at: report.generated_at,
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct StudentSummary {
    pub id: i64,
    pub name: String,
    pub dob: String,
    pub age_years: i64,
    pub parent_id: i64,
    pub parent_name: String,
    pub parent_email: String,
    pub parent_phone_wa: String,
    pub active_enrollments: i64,
    pub attendance: AttendanceSummary,
    pub latest_assessment_on: Option<String>,
    pub created_at: String,
}

#[derive(sqlx::FromRow)]
struct StudentRow {
    id: i64,
    name: String,
    dob: String,
    parent_id: i64,
    parent_name: String,
    parent_email: String,
    parent_phone_wa: String,
    active_enrollments: i64,
    attended: i64,
    absent: i64,
    upcoming: i64,
    latest_assessment_on: Option<String>,
    created_at: String,
}

impl From<StudentRow> for StudentSummary {
    fn from(r: StudentRow) -> Self {
        StudentSummary {
            age_years: parse_date(&r.dob)
                .map(|d| age_years(d, today_wib()))
                .unwrap_or_default(),
            attendance: AttendanceSummary::new(r.attended, r.absent, r.upcoming),
            id: r.id,
            name: r.name,
            dob: r.dob,
            parent_id: r.parent_id,
            parent_name: r.parent_name,
            parent_email: r.parent_email,
            parent_phone_wa: r.parent_phone_wa,
            active_enrollments: r.active_enrollments,
            latest_assessment_on: r.latest_assessment_on,
            created_at: r.created_at,
        }
    }
}

const STUDENT_FILTER: &str = "FROM children c JOIN users u ON u.id = c.parent_id \
     WHERE c.deleted_at IS NULL AND (?1 IS NULL OR c.name LIKE ?1 ESCAPE '\\' \
     OR u.full_name LIKE ?1 ESCAPE '\\' OR u.email LIKE ?1 ESCAPE '\\')";

fn student_select() -> String {
    format!(
        "SELECT c.id, c.name, c.dob, c.parent_id, u.full_name AS parent_name, u.email AS parent_email,
           u.phone_wa AS parent_phone_wa,
           (SELECT COUNT(*) FROM class_enrollments e WHERE e.child_id = c.id
              AND e.status IN ('RESERVED', 'CONFIRMED')) AS active_enrollments,
           (SELECT COUNT(*) FROM class_enrollments e WHERE e.child_id = c.id AND e.status = 'ATTENDED') AS attended,
           (SELECT COUNT(*) FROM class_enrollments e WHERE e.child_id = c.id AND e.status = 'ABSENT') AS absent,
           (SELECT COUNT(*) FROM class_enrollments e JOIN weekend_classes w ON w.id = e.class_id
              WHERE e.child_id = c.id AND e.status IN ('RESERVED', 'CONFIRMED') AND {}) AS upcoming,
           (SELECT MAX(a.observed_on) FROM student_assessments a WHERE a.child_id = c.id) AS latest_assessment_on,
           strftime('%Y-%m-%dT%H:%M:%SZ', c.created_at) AS created_at
         {STUDENT_FILTER}",
        upcoming_sql("w")
    )
}

/// Admin directory (#35): live children, `q` over child/parent name and email,
/// `ORDER BY name ASC, id ASC`, paginated.
pub async fn student_page(
    pool: &SqlitePool,
    q: Option<&str>,
    page: Page,
) -> Result<(Vec<StudentSummary>, i64), sqlx::Error> {
    let pattern = q.map(like_pattern);
    let total: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) {STUDENT_FILTER}"))
        .bind(&pattern)
        .fetch_one(pool)
        .await?;
    let sql = format!(
        "{} ORDER BY c.name, c.id LIMIT ?2 OFFSET ?3",
        student_select()
    );
    let rows = sqlx::query_as::<_, StudentRow>(&sql)
        .bind(&pattern)
        .bind(page.per_page)
        .bind(page.offset())
        .fetch_all(pool)
        .await?;
    Ok((rows.into_iter().map(StudentSummary::from).collect(), total))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assessment(id: i64, domain: &str, level: i64, observed_on: &str) -> Assessment {
        Assessment {
            id,
            child_id: 1,
            class_id: None,
            class_title: None,
            assessor_id: 1,
            assessor_name: "A".into(),
            domain: domain.into(),
            level,
            milestone: format!("m{id}"),
            notes: None,
            observed_on: observed_on.into(),
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn latest_levels_has_five_in_canonical_order() {
        // Sorted DESC by (observed_on, id), as the query returns them.
        let list = vec![
            assessment(3, "MATH", 3, "2026-10-24"),
            assessment(2, "MATH", 1, "2026-01-17"),
            assessment(1, "PRACTICAL_LIFE", 2, "2026-01-17"),
        ];
        let levels = latest_levels(&list);
        assert_eq!(levels.len(), 5);
        assert_eq!(levels[0].domain, "PRACTICAL_LIFE");
        assert_eq!(levels[0].level, Some(2));
        assert_eq!(levels[3].domain, "MATH");
        assert_eq!(levels[3].level, Some(3));
        assert_eq!(levels[3].milestone.as_deref(), Some("m3"));
        assert_eq!(levels[1].level, None);
        assert_eq!(levels[1].observed_on, None);
    }

    #[test]
    fn attendance_rate_rounds_half_up_and_is_null_without_history() {
        assert_eq!(AttendanceSummary::new(0, 0, 2).attendance_rate_pct, None);
        assert_eq!(
            AttendanceSummary::new(1, 1, 0).attendance_rate_pct,
            Some(50)
        );
        assert_eq!(
            AttendanceSummary::new(2, 1, 0).attendance_rate_pct,
            Some(67)
        );
        assert_eq!(
            AttendanceSummary::new(1, 7, 0).attendance_rate_pct,
            Some(13)
        );
    }
}
