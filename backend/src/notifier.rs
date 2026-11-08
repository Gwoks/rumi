//! Outbound notifications (PRD §4.2, §5.8.3 #11, §6.23). v1 ships only
//! `LogNotifier`; SMTP is a follow-up issue (rumi-0sw.10).
//!
//! The reset link is a bearer credential, so `LogNotifier` writes it to the
//! log only in development (`PUBLIC_BASE_URL` empty or not `https://`). On a
//! public deployment it logs a masked email and "reset requested" instead.

use std::sync::Mutex;

use crate::config::Config;

pub trait Notifier: Send + Sync {
    /// Deliver a password-reset link to `email`.
    fn send_password_reset(&self, email: &str, url: &str) -> anyhow::Result<()>;
}

/// `nadia@example.com` → `n***@example.com`; no `@` → `***`.
pub fn mask_email(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let first: String = local.chars().take(1).collect();
            format!("{first}***@{domain}")
        }
        None => "***".to_string(),
    }
}

/// Writes reset requests to the log (the v1 delivery channel).
pub struct LogNotifier {
    reveal_links: bool,
}

impl LogNotifier {
    /// `reveal_links`: log the full reset URL (development only).
    pub fn new(reveal_links: bool) -> Self {
        LogNotifier { reveal_links }
    }

    /// Reveal links only when the deployment is not public `https://`.
    pub fn for_config(cfg: &Config) -> Self {
        Self::new(!cfg.is_public_https())
    }

    pub fn reveals_links(&self) -> bool {
        self.reveal_links
    }
}

impl Notifier for LogNotifier {
    fn send_password_reset(&self, email: &str, url: &str) -> anyhow::Result<()> {
        if self.reveal_links {
            tracing::info!(%email, %url, "password reset link (LogNotifier, development only)");
        } else {
            let email = mask_email(email);
            tracing::info!(%email, "password reset requested (link not logged; SMTP pending)");
        }
        Ok(())
    }
}

/// Keeps every message in memory; used by tests to read the reset link.
#[derive(Default)]
pub struct RecordingNotifier {
    sent: Mutex<Vec<(String, String)>>,
}

impl RecordingNotifier {
    pub fn new() -> Self {
        RecordingNotifier::default()
    }

    /// All `(email, url)` pairs sent so far.
    pub fn sent(&self) -> Vec<(String, String)> {
        self.sent
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
}

impl Notifier for RecordingNotifier {
    fn send_password_reset(&self, email: &str, url: &str) -> anyhow::Result<()> {
        self.sent
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .push((email.to_string(), url.to_string()));
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tracing_subscriber::fmt::MakeWriter;

    const URL: &str = "https://rumi.id/reset-password#token=SECRET-TOKEN";

    #[test]
    fn recording_notifier_keeps_messages() {
        let n = RecordingNotifier::new();
        n.send_password_reset("a@b.co", "http://x/reset-password#token=t")
            .unwrap();
        assert_eq!(n.sent().len(), 1);
    }

    #[test]
    fn emails_are_masked_to_first_letter_and_domain() {
        assert_eq!(mask_email("nadia@example.com"), "n***@example.com");
        assert_eq!(mask_email("a@b.co"), "a***@b.co");
        assert_eq!(mask_email("@b.co"), "***@b.co");
        assert_eq!(mask_email("no-at-sign"), "***");
    }

    #[derive(Clone, Default)]
    struct Capture(Arc<Mutex<Vec<u8>>>);

    impl std::io::Write for Capture {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    impl<'a> MakeWriter<'a> for Capture {
        type Writer = Capture;
        fn make_writer(&'a self) -> Self::Writer {
            self.clone()
        }
    }

    fn logged(notifier: &LogNotifier) -> String {
        let capture = Capture::default();
        let subscriber = tracing_subscriber::fmt()
            .with_writer(capture.clone())
            .with_ansi(false)
            .finish();
        tracing::subscriber::with_default(subscriber, || {
            notifier
                .send_password_reset("nadia@example.com", URL)
                .unwrap();
        });
        let bytes = capture.0.lock().unwrap_or_else(|p| p.into_inner()).clone();
        String::from_utf8_lossy(&bytes).to_string()
    }

    #[test]
    fn production_logs_never_contain_the_link_or_the_full_email() {
        let line = logged(&LogNotifier::new(false));
        assert!(line.contains("reset requested"), "{line}");
        assert!(line.contains("n***@example.com"), "{line}");
        assert!(!line.contains("SECRET-TOKEN"), "{line}");
        assert!(!line.contains("nadia@example.com"), "{line}");
    }

    #[test]
    fn development_logs_the_link_for_manual_testing() {
        let line = logged(&LogNotifier::new(true));
        assert!(line.contains(URL), "{line}");
    }

    #[test]
    fn links_are_revealed_only_off_https() {
        let dev = crate::testutil::config();
        assert!(LogNotifier::for_config(&dev).reveals_links());
        let http = Config {
            public_base_url: "http://rumi.local".into(),
            ..crate::testutil::config()
        };
        assert!(LogNotifier::for_config(&http).reveals_links());
        let prod = Config {
            public_base_url: "https://rumi.id".into(),
            ..crate::testutil::config()
        };
        assert!(!LogNotifier::for_config(&prod).reveals_links());
    }
}
