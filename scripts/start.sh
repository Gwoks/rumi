#!/usr/bin/env bash
# RUMI — build the React SPA + Rust backend, then run the single binary.
# The binary serves the /api JSON API and the SPA (from dist/) over one WAL
# SQLite file, and runs the expiry sweep in-process. No Node at runtime.
set -euo pipefail

cd "$(dirname "$0")/.."

# Load .env if present (export every assignment).
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

echo "==> Building frontend (Vite -> dist/)"
pnpm install --frozen-lockfile
pnpm build

echo "==> Building backend (cargo --release)"
( cd backend && cargo build --release --bins )

# Paths are relative to the repo root (this script's cwd) unless .env sets them.
export DATABASE_PATH="${DATABASE_PATH:-data/rumi.db}"
export STATIC_DIR="${STATIC_DIR:-dist}"

# Migrate + seed also run inside the binary at startup; the idempotent seed bin
# runs first on a fresh DB (or with SEED=1) so its report shows up front.
mkdir -p "$(dirname "$DATABASE_PATH")"
if [ "${SEED:-0}" = "1" ] || [ ! -f "$DATABASE_PATH" ]; then
  echo "==> Seeding ($DATABASE_PATH)"
  ./backend/target/release/seed || echo "WARN: seed failed; rumi retries seeding at startup" >&2
fi

echo "==> Starting rumi on ${APP_BIND_HOST:-0.0.0.0}:${APP_PORT:-8080}"
exec ./backend/target/release/rumi
