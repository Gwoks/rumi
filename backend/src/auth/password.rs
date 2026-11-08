//! Password hashing (argon2id), ported from shortener-link `auth/password.rs`.
//! The async wrappers run the CPU-bound work in `spawn_blocking` (§5.4.7).

use std::sync::OnceLock;

use argon2::password_hash::{
    rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::Argon2;

/// Hash a plaintext password with argon2id (default OWASP parameters).
pub fn hash(plain: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plain.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| anyhow::anyhow!("argon2 hash: {e}"))
}

/// Verify a plaintext password; false on any error (malformed hash, mismatch).
pub fn verify(hash: &str, plain: &str) -> bool {
    PasswordHash::new(hash)
        .map(|parsed| {
            Argon2::default()
                .verify_password(plain.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

/// A real argon2 hash of a random secret, so an unknown email costs the same
/// verification time as a wrong password (no user enumeration by timing).
fn dummy_hash() -> &'static str {
    static DUMMY: OnceLock<String> = OnceLock::new();
    DUMMY.get_or_init(|| hash(&crate::ids::gen_token(16)).unwrap_or_default())
}

pub async fn hash_async(plain: String) -> anyhow::Result<String> {
    tokio::task::spawn_blocking(move || hash(&plain)).await?
}

/// Verify against `stored`, or against a dummy hash when there is no user.
pub async fn verify_async(stored: Option<String>, plain: String) -> anyhow::Result<bool> {
    let found = stored.is_some();
    let ok = tokio::task::spawn_blocking(move || {
        let target = stored.unwrap_or_else(|| dummy_hash().to_string());
        verify(&target, &plain)
    })
    .await?;
    Ok(found && ok)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_then_verify_roundtrip() {
        let h = hash("correct horse battery").unwrap();
        assert!(h.starts_with("$argon2id$"));
        assert!(verify(&h, "correct horse battery"));
        assert!(!verify(&h, "wrong"));
        assert!(!verify("not-a-hash", "x"));
    }

    #[tokio::test]
    async fn async_wrappers() {
        let h = hash_async("rahasia-123".into()).await.unwrap();
        assert!(verify_async(Some(h.clone()), "rahasia-123".into())
            .await
            .unwrap());
        assert!(!verify_async(Some(h), "nope".into()).await.unwrap());
        assert!(!verify_async(None, "rahasia-123".into()).await.unwrap());
    }
}
