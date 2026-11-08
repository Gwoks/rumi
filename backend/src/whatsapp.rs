//! The WhatsApp checkout message and `wa.me` URL (PRD §5.9.3). Pure functions.

use chrono::NaiveDate;

use crate::helpers::tanggal_id;
use crate::money::format_rupiah;

/// One order line as it appears in the message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WaItem {
    Class {
        title: String,
        child_name: String,
        date: NaiveDate,
        time_slot: String,
        location: String,
        line_total_idr: i64,
    },
    Kit {
        name: String,
        quantity: i64,
        line_total_idr: i64,
    },
}

#[derive(Debug, Clone)]
pub struct WaMessage<'a> {
    pub order_code: &'a str,
    pub parent_name: &'a str,
    pub phone_wa: &'a str,
    pub total_amount_idr: i64,
    pub items: &'a [WaItem],
    pub delivery_name: &'a str,
    pub address: Option<&'a str>,
    pub notes: Option<&'a str>,
}

fn item_line(item: &WaItem) -> String {
    match item {
        WaItem::Class {
            title,
            child_name,
            date,
            time_slot,
            location,
            line_total_idr,
        } => format!(
            "- Kelas {title} ({child_name}) \u{b7} {} \u{b7} {time_slot} WIB \u{b7} {location} \u{b7} {}",
            tanggal_id(*date),
            format_rupiah(*line_total_idr)
        ),
        WaItem::Kit {
            name,
            quantity,
            line_total_idr,
        } => format!(
            "- Kit {name} \u{d7}{quantity} \u{b7} {}",
            format_rupiah(*line_total_idr)
        ),
    }
}

/// Distinct child names of the CLASS items in order of first appearance, or `-`.
fn child_names(items: &[WaItem]) -> String {
    let names = items
        .iter()
        .fold(Vec::<&str>::new(), |acc, item| match item {
            WaItem::Class { child_name, .. } if !acc.contains(&child_name.as_str()) => acc
                .into_iter()
                .chain(std::iter::once(child_name.as_str()))
                .collect(),
            _ => acc,
        });
    if names.is_empty() {
        "-".to_string()
    } else {
        names.join(", ")
    }
}

/// Build the exact §5.9.3 message (LF-joined, no trailing newline).
pub fn build_message(m: &WaMessage<'_>) -> String {
    let header = vec![
        format!(
            "Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #{}.",
            m.order_code
        ),
        String::new(),
        format!("Nama Orang Tua: {}", m.parent_name),
        format!("Nama Anak: {}", child_names(m.items)),
        format!("No. WhatsApp: {}", m.phone_wa),
        format!("Total: {}", format_rupiah(m.total_amount_idr)),
        String::new(),
        "Detail:".to_string(),
    ];
    let delivery = std::iter::once(format!("Penerima: {}", m.delivery_name))
        .chain(m.address.map(|a| format!("Alamat: {a}")))
        .chain(m.notes.map(|n| format!("Catatan: {n}")));
    header
        .into_iter()
        .chain(m.items.iter().map(item_line))
        .chain(std::iter::once(String::new()))
        .chain(delivery)
        .chain([
            String::new(),
            "Mohon info pembayarannya. Terima kasih.".to_string(),
        ])
        .collect::<Vec<_>>()
        .join("\n")
}

/// Percent-encode every UTF-8 byte except RFC 3986 unreserved `A–Z a–z 0–9 - _ . ~`,
/// with uppercase hex (a space is `%20`, never `+`).
pub fn pct(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect()
}

/// `https://wa.me/{phone}?text={pct(message)}`.
pub fn wa_url(admin_phone: &str, message: &str) -> String {
    format!("https://wa.me/{admin_phone}?text={}", pct(message))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example_items() -> Vec<WaItem> {
        vec![
            WaItem::Class {
                title: "Bulan & Gerak".into(),
                child_name: "Amina".into(),
                date: NaiveDate::from_ymd_opt(2026, 11, 14).unwrap(),
                time_slot: "09:30\u{2013}11:30".into(),
                location: "Rumah Teduh, Kemang (Jakarta Selatan)".into(),
                line_total_idr: 200_000,
            },
            WaItem::Kit {
                name: "Nampan Tangan Kecil".into(),
                quantity: 2,
                line_total_idr: 370_000,
            },
        ]
    }

    fn example_message(items: &[WaItem]) -> WaMessage<'_> {
        WaMessage {
            order_code: "RUMI-2026-0001",
            parent_name: "Nadia Rahman",
            phone_wa: "6281211112222",
            total_amount_idr: 570_000,
            items,
            delivery_name: "Nadia Rahman",
            address: Some("Jl. Kemang Raya 12, Jakarta Selatan"),
            notes: None,
        }
    }

    #[test]
    fn prd_example_message_is_exact() {
        let items = example_items();
        let expected = "Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #RUMI-2026-0001.\n\
\n\
Nama Orang Tua: Nadia Rahman\n\
Nama Anak: Amina\n\
No. WhatsApp: 6281211112222\n\
Total: Rp 570.000\n\
\n\
Detail:\n\
- Kelas Bulan & Gerak (Amina) \u{b7} Sabtu, 14 November 2026 \u{b7} 09:30\u{2013}11:30 WIB \u{b7} Rumah Teduh, Kemang (Jakarta Selatan) \u{b7} Rp 200.000\n\
- Kit Nampan Tangan Kecil \u{d7}2 \u{b7} Rp 370.000\n\
\n\
Penerima: Nadia Rahman\n\
Alamat: Jl. Kemang Raya 12, Jakarta Selatan\n\
\n\
Mohon info pembayarannya. Terima kasih.";
        assert_eq!(build_message(&example_message(&items)), expected);
    }

    #[test]
    fn prd_example_url_prefix_and_class_line() {
        let items = example_items();
        let url = wa_url("6281234567890", &build_message(&example_message(&items)));
        assert!(url.starts_with(
            "https://wa.me/6281234567890?text=Assalamu%27alaikum%20Admin%20RUMI%2C%20saya%20ingin%20konfirmasi%20pesanan%20%23RUMI-2026-0001.%0A%0ANama%20Orang%20Tua%3A%20Nadia%20Rahman%0A"
        ));
        assert!(url.contains(
            "-%20Kelas%20Bulan%20%26%20Gerak%20%28Amina%29%20%C2%B7%20Sabtu%2C%2014%20November%202026%20%C2%B7%2009%3A30%E2%80%9311%3A30%20WIB%20%C2%B7%20"
        ));
        assert!(!url.contains('+'));
        assert!(!url.contains(' '));
    }

    #[test]
    fn kit_only_order_uses_dash_and_notes_line() {
        let items = vec![WaItem::Kit {
            name: "Kartu".into(),
            quantity: 1,
            line_total_idr: 120_000,
        }];
        let msg = WaMessage {
            notes: Some("Tolong dibungkus"),
            ..example_message(&items)
        };
        let text = build_message(&msg);
        assert!(text.contains("\nNama Anak: -\n"));
        assert!(text.contains("\nCatatan: Tolong dibungkus\n"));
        assert!(!text.ends_with('\n'));
    }

    #[test]
    fn child_names_are_distinct_in_first_appearance_order() {
        let class = |child: &str| WaItem::Class {
            title: "T".into(),
            child_name: child.into(),
            date: NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
            time_slot: "x".into(),
            location: "y".into(),
            line_total_idr: 0,
        };
        let items = vec![class("Zaid"), class("Amina"), class("Zaid")];
        assert_eq!(child_names(&items), "Zaid, Amina");
    }

    #[test]
    fn pct_encodes_everything_but_unreserved() {
        assert_eq!(
            pct("A-z_0.~ '#\n\u{b7}+/"),
            "A-z_0.~%20%27%23%0A%C2%B7%2B%2F"
        );
    }
}
