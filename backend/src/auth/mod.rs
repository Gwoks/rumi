//! Authentication (PRD §5.3): argon2id passwords, opaque cookie sessions stored
//! as SHA-256 hashes, and the RBAC extractors.

pub mod extractor;
pub mod password;
pub mod session;

pub use extractor::{AdminUser, CurrentUser, OptionalUser, ParentUser};
