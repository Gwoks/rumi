//! Rupiah formatting (PRD §5.4.3). The server formats money only inside the
//! WhatsApp message; the frontend's `formatRupiah` must produce the same strings.
//! Both are tested against the shared `fixtures/rupiah.json`.

/// `"Rp 1.250.000"`, `"-Rp 25.000"`: ASCII space, `.` thousands separator.
pub fn format_rupiah(amount: i64) -> String {
    let digits = amount.unsigned_abs().to_string();
    let len = digits.len();
    let grouped: String = digits
        .chars()
        .enumerate()
        .flat_map(|(i, c)| {
            let needs_dot = i > 0 && (len - i).is_multiple_of(3);
            needs_dot
                .then_some('.')
                .into_iter()
                .chain(std::iter::once(c))
        })
        .collect();
    let sign = if amount < 0 { "-" } else { "" };
    format!("{sign}Rp {grouped}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Deserialize)]
    struct Case {
        amount: i64,
        formatted: String,
    }

    #[test]
    fn matches_shared_fixture() {
        let cases: Vec<Case> =
            serde_json::from_str(include_str!("../../fixtures/rupiah.json")).unwrap();
        assert!(!cases.is_empty());
        for case in cases {
            assert_eq!(
                format_rupiah(case.amount),
                case.formatted,
                "{}",
                case.amount
            );
        }
    }

    #[test]
    fn extremes_do_not_overflow() {
        assert_eq!(format_rupiah(i64::MIN), "-Rp 9.223.372.036.854.775.808");
        assert_eq!(format_rupiah(1), "Rp 1");
    }
}
