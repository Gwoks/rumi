//! Catalog seed (PRD §5.11.2, §5.11.3): CMS sections, classes and kits.

use serde::Deserialize;
use serde_json::Value;
use sqlx::SqlitePool;

#[derive(Deserialize)]
struct CmsSeed {
    page_slug: String,
    section_key: String,
    title: String,
    sort_order: i64,
    body: Value,
}

const CMS_JSON: &str = include_str!("cms.json");

pub const KEMANG: &str = "Rumah Teduh, Kemang (Jakarta Selatan)";
const BINTARO: &str = "Ruang Kenari, Bintaro (Tangerang Selatan)";
const BSD: &str = "Studio Bambu, BSD City (Tangerang Selatan)";

/// `(title, location, date, start, end, fee_idr, status, description)`.
type ClassSeed = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    i64,
    &'static str,
    &'static str,
);

const CLASSES: [ClassSeed; 5] = [
    ("Bulan & Gerak", KEMANG, "2026-11-14", "09:30", "11:30", 200_000, "OPEN",
     "Mengenal ciptaan Allah lewat gerak tubuh, lagu, dan kisah tentang bulan. Setelah bergerak dan bernyanyi, anak memilih kegiatan menuang dan memilah dengan tenang."),
    ("Tukang Kebun Cilik", BINTARO, "2026-11-21", "09:30", "11:30", 175_000, "OPEN",
     "Menanam benih, menyiram, dan merawat tanaman kecil sambil belajar bersyukur atas rezeki dari bumi."),
    ("Dunia Kita yang Ramah", KEMANG, "2026-11-29", "14:00", "16:00", 150_000, "OPEN",
     "Belajar adab berteman: menyapa dengan salam, menunggu giliran, dan berbagi material dengan lembut."),
    ("Suara & Pasir", BSD, "2026-12-05", "09:30", "11:30", 250_000, "OPEN",
     "Bermain bunyi huruf, menulis di atas pasir, dan mengenal huruf hijaiyah lewat sentuhan."),
    ("Taman Berhitung", BINTARO, "2026-12-12", "09:30", "11:30", 225_000, "DRAFT",
     "Menghitung manik-manik, mengenal angka, dan menyusun pola dari bahan-bahan alam."),
];

/// `(name, category, price_idr, stock, badge_tag, description)`.
type KitSeed = (
    &'static str,
    &'static str,
    i64,
    i64,
    Option<&'static str>,
    &'static str,
);

pub const KIT_KARTU: &str = "Kartu Bulan Gurun";

const KITS: [KitSeed; 4] = [
    ("Nampan Tangan Kecil", "PRACTICAL_LIFE", 185_000, 12, Some("Favorit"),
     "Nampan kayu yang cantik untuk kegiatan menuang, memilah, dan bekerja dengan fokus."),
    (KIT_KARTU, "ISLAMIC_STUDIES", 120_000, 8, None,
     "Kartu percakapan lembut untuk menjelajahi rasa syukur, kebaikan, dan rasa takjub."),
    ("Set Suara & Pasir", "SENSORIAL", 225_000, 4, Some("Baru"),
     "Kartu huruf bertekstur dan permainan bunyi untuk pembaca cilik yang penuh rasa ingin tahu."),
    ("Taman Berhitung", "MATH", 150_000, 16, None,
     "Taman manik-manik dan angka yang ceria untuk mengasah kepekaan bilangan secara langsung."),
];

/// Tables are a fixed allow-list of code constants.
async fn is_empty(pool: &SqlitePool, table: &'static str) -> Result<bool, sqlx::Error> {
    let n: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await?;
    Ok(n == 0)
}

async fn seed_cms(pool: &SqlitePool) -> anyhow::Result<()> {
    let sections: Vec<CmsSeed> = serde_json::from_str(CMS_JSON)?;
    let mut tx = pool.begin().await?;
    for s in sections {
        sqlx::query(
            "INSERT INTO cms_content (page_slug, section_key, title, body_json, sort_order, is_active)
             VALUES (?, ?, ?, ?, ?, 1)",
        )
        .bind(&s.page_slug)
        .bind(&s.section_key)
        .bind(&s.title)
        .bind(s.body.to_string())
        .bind(s.sort_order)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

async fn seed_classes(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    for (title, location, date, start, end, fee, status, description) in CLASSES {
        sqlx::query(
            "INSERT INTO weekend_classes (title, description, location, age_min, age_max, date,
             start_time, end_time, fee_idr, capacity, status)
             VALUES (?, ?, ?, 3, 6, ?, ?, ?, ?, 12, ?)",
        )
        .bind(title)
        .bind(description)
        .bind(location)
        .bind(date)
        .bind(start)
        .bind(end)
        .bind(fee)
        .bind(status)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await
}

async fn seed_kits(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;
    for (name, category, price, stock, badge, description) in KITS {
        sqlx::query(
            "INSERT INTO play_kits (name, category, description, price_idr, stock, badge_tag, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)",
        )
        .bind(name)
        .bind(category)
        .bind(description)
        .bind(price)
        .bind(stock)
        .bind(badge)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await
}

/// Returns which of (cms, classes, kits) were seeded.
pub async fn seed(pool: &SqlitePool) -> anyhow::Result<(bool, bool, bool)> {
    let cms = is_empty(pool, "cms_content").await?;
    if cms {
        seed_cms(pool).await?;
    }
    let classes = is_empty(pool, "weekend_classes").await?;
    if classes {
        seed_classes(pool).await?;
    }
    let kits = is_empty(pool, "play_kits").await?;
    if kits {
        seed_kits(pool).await?;
    }
    Ok((cms, classes, kits))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::cms_schema::{shape_for, validate_body};
    use crate::validate::Errors;

    #[test]
    fn every_seed_body_passes_its_registry_shape() {
        let sections: Vec<CmsSeed> = serde_json::from_str(CMS_JSON).unwrap();
        assert_eq!(sections.len(), 9);
        for s in sections {
            let shape = shape_for(&s.page_slug, &s.section_key).expect("registry pair");
            let errs = Errors::new();
            let normalized = validate_body(shape, &s.body, &errs);
            assert!(
                errs.is_empty(),
                "{}/{}: {:?}",
                s.page_slug,
                s.section_key,
                errs.finish().err()
            );
            assert_eq!(
                normalized.as_ref(),
                Some(&s.body),
                "seed text must already be trimmed"
            );
        }
    }

    #[tokio::test]
    async fn seeds_once_even_after_soft_deletes() {
        let pool = crate::testutil::pool().await;
        assert_eq!(seed(&pool).await.unwrap(), (true, true, true));
        sqlx::query("UPDATE play_kits SET deleted_at = datetime('now')")
            .execute(&pool)
            .await
            .unwrap();
        assert_eq!(seed(&pool).await.unwrap(), (false, false, false));
        let counts: (i64, i64, i64) = sqlx::query_as(
            "SELECT (SELECT COUNT(*) FROM cms_content), (SELECT COUNT(*) FROM weekend_classes),
                    (SELECT COUNT(*) FROM play_kits)",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(counts, (9, 5, 4));
    }
}
