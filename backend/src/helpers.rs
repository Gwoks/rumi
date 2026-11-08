//! Time, date and small formatting helpers (PRD §5.4).
//!
//! The DB stores UTC `YYYY-MM-DD HH:MM:SS`; the API emits RFC 3339 `…Z`.
//! Business time is WIB, a fixed UTC+7 with no DST (§5.4.2).

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, NaiveTime, Utc};

/// WIB offset from UTC, in hours.
pub const WIB_OFFSET_HOURS: i64 = 7;
const DB_TS_FORMAT: &str = "%Y-%m-%d %H:%M:%S";
const EN_DASH: char = '\u{2013}';

pub fn now_utc() -> NaiveDateTime {
    Utc::now().naive_utc()
}

pub fn to_wib(utc: NaiveDateTime) -> NaiveDateTime {
    utc + Duration::hours(WIB_OFFSET_HOURS)
}

/// Today's calendar date in WIB.
pub fn today_wib() -> NaiveDate {
    to_wib(now_utc()).date()
}

/// A UTC instant formatted for DB storage (`YYYY-MM-DD HH:MM:SS`).
pub fn db_ts(utc: NaiveDateTime) -> String {
    utc.format(DB_TS_FORMAT).to_string()
}

/// Parse a stored timestamp (`YYYY-MM-DD HH:MM:SS`, tolerating `T`/`Z`).
pub fn parse_db_ts(raw: &str) -> Option<NaiveDateTime> {
    let cleaned = raw.trim().trim_end_matches('Z').replacen('T', " ", 1);
    let seconds = cleaned.split('.').next().unwrap_or(&cleaned);
    NaiveDateTime::parse_from_str(seconds, DB_TS_FORMAT).ok()
}

/// RFC 3339 UTC at second precision: `2026-11-08T03:15:00Z`.
pub fn rfc3339(utc: NaiveDateTime) -> String {
    utc.format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

/// Convert a stored timestamp to the API `Timestamp` format.
pub fn ts(raw: &str) -> String {
    parse_db_ts(raw)
        .map(rfc3339)
        .unwrap_or_else(|| raw.to_string())
}

pub fn opt_ts(raw: Option<&str>) -> Option<String> {
    raw.map(ts)
}

/// Strict `YYYY-MM-DD` that must also be a real calendar date.
pub fn parse_date(raw: &str) -> Option<NaiveDate> {
    let bytes = raw.as_bytes();
    let shape_ok = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit());
    if !shape_ok {
        return None;
    }
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").ok()
}

/// `TIME_RE` = `^([01][0-9]|2[0-3]):[0-5][0-9]$`.
pub fn is_valid_time(raw: &str) -> bool {
    let b = raw.as_bytes();
    if b.len() != 5 || b[2] != b':' {
        return false;
    }
    let hour_ok = matches!(
        (b[0], b[1]),
        (b'0'..=b'1', b'0'..=b'9') | (b'2', b'0'..=b'3')
    );
    let minute_ok = matches!((b[3], b[4]), (b'0'..=b'5', b'0'..=b'9'));
    hour_ok && minute_ok
}

/// Full years from `dob` to `today` (§5.4.3); a 29 Feb birthday is reached on 1 Mar.
pub fn age_years(dob: NaiveDate, today: NaiveDate) -> i64 {
    let years = i64::from(today.year() - dob.year());
    if (today.month(), today.day()) >= (dob.month(), dob.day()) {
        years
    } else {
        years - 1
    }
}

/// The UTC instant of a class start (`date` + `start_time` read in WIB).
pub fn class_start_utc(date: &str, start_time: &str) -> Option<NaiveDateTime> {
    let day = parse_date(date)?;
    let time = NaiveTime::parse_from_str(start_time, "%H:%M").ok()?;
    Some(day.and_time(time) - Duration::hours(WIB_OFFSET_HOURS))
}

/// Is the class start later than `now_utc`?
pub fn is_upcoming_at(date: &str, start_time: &str, now: NaiveDateTime) -> bool {
    class_start_utc(date, start_time)
        .map(|start| start > now)
        .unwrap_or(false)
}

pub fn is_upcoming(date: &str, start_time: &str) -> bool {
    is_upcoming_at(date, start_time, now_utc())
}

/// SQL predicate for "the class start (WIB) is later than now", over a
/// `weekend_classes` alias. The alias is always a code constant, never input.
pub fn upcoming_sql(alias: &str) -> String {
    format!(
        "datetime({alias}.date || ' ' || {alias}.start_time || ':00', '-{WIB_OFFSET_HOURS} hours') \
         > datetime('now')"
    )
}

/// `"{a}–{b}"` joined by an EN DASH with no spaces (§5.4.3).
pub fn dash_join(a: impl std::fmt::Display, b: impl std::fmt::Display) -> String {
    format!("{a}{EN_DASH}{b}")
}

/// `round(n × 100 / d)` with halves rounded up, as integers (§5.4.3).
pub fn pct_round(numerator: i64, denominator: i64) -> i64 {
    if denominator <= 0 {
        return 0;
    }
    (numerator * 200 + denominator) / (2 * denominator)
}

const DAY_NAMES: [&str; 7] = [
    "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
];
const MONTH_NAMES: [&str; 12] = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];

/// `{Hari}, {d} {Bulan} {yyyy}`, e.g. `Sabtu, 14 November 2026` (§5.9.3).
pub fn tanggal_id(date: NaiveDate) -> String {
    let day = DAY_NAMES[date.weekday().num_days_from_sunday() as usize];
    let month = MONTH_NAMES[date.month0() as usize];
    format!("{day}, {} {month} {}", date.day(), date.year())
}

/// The `n` WIB months ending with the current one, oldest first, as `YYYY-MM`.
pub fn recent_months(today: NaiveDate, n: u32) -> Vec<String> {
    let current = today.year() * 12 + today.month0() as i32;
    (0..n as i32)
        .rev()
        .map(|back| {
            let idx = current - back;
            format!("{:04}-{:02}", idx.div_euclid(12), idx.rem_euclid(12) + 1)
        })
        .collect()
}

/// Escape `%`, `_` and `\` for a `LIKE … ESCAPE '\'` substring pattern.
pub fn like_pattern(q: &str) -> String {
    let escaped: String = q
        .chars()
        .flat_map(|c| match c {
            '%' | '_' | '\\' => vec!['\\', c],
            other => vec![other],
        })
        .collect();
    format!("%{escaped}%")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        parse_date(s).unwrap()
    }

    #[test]
    fn timestamps_render_as_rfc3339_z() {
        assert_eq!(ts("2026-11-08 03:15:00"), "2026-11-08T03:15:00Z");
        assert_eq!(ts("2026-11-08T03:15:00Z"), "2026-11-08T03:15:00Z");
        assert_eq!(ts("garbage"), "garbage");
        assert_eq!(opt_ts(None), None);
        let now = parse_db_ts("2026-01-02 03:04:05").unwrap();
        assert_eq!(db_ts(now), "2026-01-02 03:04:05");
    }

    #[test]
    fn strict_dates() {
        assert!(parse_date("2026-02-28").is_some());
        assert!(parse_date("2024-02-29").is_some());
        assert!(parse_date("2026-02-29").is_none());
        assert!(parse_date("2026-2-28").is_none());
        assert!(parse_date("2026/02/28").is_none());
        assert!(parse_date("20260228").is_none());
    }

    #[test]
    fn time_regex() {
        for ok in ["00:00", "09:30", "19:59", "23:59"] {
            assert!(is_valid_time(ok), "{ok}");
        }
        for bad in [
            "24:00", "9:30", "09:60", "09-30", "29:00", "ab:cd", "09:301",
        ] {
            assert!(!is_valid_time(bad), "{bad}");
        }
    }

    #[test]
    fn age_counts_full_years_and_leap_birthdays() {
        assert_eq!(age_years(d("2020-04-15"), d("2026-04-14")), 5);
        assert_eq!(age_years(d("2020-04-15"), d("2026-04-15")), 6);
        assert_eq!(age_years(d("2020-02-29"), d("2025-02-28")), 4);
        assert_eq!(age_years(d("2020-02-29"), d("2025-03-01")), 5);
        assert_eq!(age_years(d("2026-01-01"), d("2026-01-01")), 0);
    }

    #[test]
    fn class_start_is_read_in_wib() {
        let start = class_start_utc("2026-11-14", "09:30").unwrap();
        assert_eq!(rfc3339(start), "2026-11-14T02:30:00Z");
        let just_before = parse_db_ts("2026-11-14 02:29:59").unwrap();
        let at = parse_db_ts("2026-11-14 02:30:00").unwrap();
        assert!(is_upcoming_at("2026-11-14", "09:30", just_before));
        assert!(!is_upcoming_at("2026-11-14", "09:30", at));
        assert!(!is_upcoming_at("bad", "09:30", at));
    }

    #[test]
    fn dash_and_percent() {
        assert_eq!(dash_join(3, 6), "3\u{2013}6");
        assert_eq!(dash_join("09:30", "11:30"), "09:30\u{2013}11:30");
        assert_eq!(pct_round(1, 12), 8);
        assert_eq!(pct_round(1, 8), 13); // 12.5 rounds up
        assert_eq!(pct_round(0, 12), 0);
        assert_eq!(pct_round(12, 12), 100);
        assert_eq!(pct_round(1, 0), 0);
    }

    #[test]
    fn indonesian_long_date() {
        assert_eq!(tanggal_id(d("2026-11-14")), "Sabtu, 14 November 2026");
        assert_eq!(tanggal_id(d("2026-11-29")), "Minggu, 29 November 2026");
        assert_eq!(tanggal_id(d("2026-01-05")), "Senin, 5 Januari 2026");
    }

    #[test]
    fn recent_months_wrap_years() {
        assert_eq!(
            recent_months(d("2026-02-10"), 6),
            vec!["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]
        );
    }

    #[test]
    fn like_pattern_escapes_wildcards() {
        assert_eq!(like_pattern("a%b_c\\"), "%a\\%b\\_c\\\\%");
        assert_eq!(upcoming_sql("w").matches("w.date").count(), 1);
    }
}
