//! Secret-token helpers (hookbox `ids.rs`): CSPRNG base64url tokens that are
//! handed out once and stored only as their SHA-256 hex.

use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

/// Entropy of session and password-reset tokens (PRD §5.3.2, §5.8.3 #11).
pub const TOKEN_BYTES: usize = 32;

/// `n_bytes` of CSPRNG entropy, base64url without padding.
pub fn gen_token(n_bytes: usize) -> String {
    let mut buf = vec![0u8; n_bytes];
    rand::thread_rng().fill_bytes(&mut buf);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

/// `sha256(secret)` as lowercase hex — the only form ever stored.
pub fn hash_secret(secret: &str) -> String {
    hex::encode(Sha256::digest(secret.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_43_char_base64url() {
        let t = gen_token(TOKEN_BYTES);
        assert_eq!(t.len(), 43);
        assert!(t
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'));
        assert_ne!(gen_token(TOKEN_BYTES), gen_token(TOKEN_BYTES));
    }

    #[test]
    fn hash_secret_is_sha256_hex() {
        assert_eq!(
            hash_secret("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
