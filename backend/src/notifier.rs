//! Outbound notifications (PRD §4.2, §5.8.3 #11). v1 ships only `LogNotifier`,
//! which writes the reset link to the server log; SMTP is a follow-up issue.

use std::sync::Mutex;

pub trait Notifier: Send + Sync {
    /// Deliver a password-reset link to `email`.
    fn send_password_reset(&self, email: &str, url: &str) -> anyhow::Result<()>;
}

/// Writes reset links to the log (dev/staging delivery channel).
pub struct LogNotifier;

impl Notifier for LogNotifier {
    fn send_password_reset(&self, email: &str, url: &str) -> anyhow::Result<()> {
        tracing::info!(%email, %url, "password reset link (LogNotifier)");
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

    #[test]
    fn recording_notifier_keeps_messages() {
        let n = RecordingNotifier::new();
        n.send_password_reset("a@b.co", "http://x/reset-password?token=t")
            .unwrap();
        assert_eq!(n.sent().len(), 1);
        assert!(LogNotifier.send_password_reset("a@b.co", "u").is_ok());
    }
}
