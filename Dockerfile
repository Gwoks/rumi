# RUMI — single Rust/Axum binary over WAL SQLite, serving the JSON API and the
# Vite/React SPA from dist/. No Node at runtime, no Postgres, no Redis.
#
# Multi-stage: (1) build the SPA with pnpm -> dist/, (2) build the Rust binaries
# --release, (3) copy both into a slim runtime image.
#
# Layer order is cache-friendly: each build stage copies its manifest + lockfile
# and installs/compiles dependencies BEFORE copying sources, so an app-code edit
# only re-runs the last, cheap layers.

# --- stage 1: frontend (Vite -> dist/) ---------------------------------------
FROM node:22-slim AS frontend
WORKDIR /app
# pnpm comes from package.json "packageManager" via corepack; never prompt.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# Only the SPA build inputs, so a backend-only change keeps this stage cached.
COPY index.html vite.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs ./
COPY public ./public
COPY src ./src
RUN pnpm build

# --- stage 2: backend (cargo --release) --------------------------------------
# Pinned to bookworm to match the runtime's glibc: the floating `rust:1-slim`
# tag follows newer Debian releases, and a binary linked there can fail on
# bookworm with "GLIBC_2.xx not found".
FROM rust:1-slim-bookworm AS backend
WORKDIR /build/backend
# Dependency layer: compile every crate in Cargo.lock against stub targets, so
# this (slow) layer stays cached until Cargo.toml / Cargo.lock change.
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir -p src/bin \
    && echo 'fn main() {}' > src/main.rs \
    && echo 'fn main() {}' > src/bin/seed.rs \
    && touch src/lib.rs \
    && cargo build --release --bins --locked \
    && rm -rf src
# App layer: real sources + the migrations `sqlx::migrate!` embeds at compile
# time. `touch` forces cargo to rebuild the crate even when the copied files
# carry mtimes older than the stubs above.
COPY backend/migrations ./migrations
COPY backend/src ./src
RUN touch src/main.rs src/lib.rs src/bin/seed.rs \
    && cargo build --release --bins --locked

# --- stage 3: runtime --------------------------------------------------------
FROM debian:bookworm-slim AS runtime
ENV APP_PORT=8080 \
    APP_BIND_HOST=0.0.0.0 \
    DATABASE_PATH=/app/data/rumi.db \
    STATIC_DIR=/app/dist
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 rumi \
    && mkdir -p /app/data \
    && chown -R rumi:rumi /app

COPY --from=backend /build/backend/target/release/rumi /usr/local/bin/rumi
COPY --from=backend /build/backend/target/release/seed /usr/local/bin/seed
# dist/ stays root-owned: the app only reads it.
COPY --from=frontend /app/dist /app/dist

USER rumi
EXPOSE 8080

# Liveness via /healthz (PRD §5.12: plain `ok`, no DB query).
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD ["/bin/sh", "-c", "wget -q -O- \"http://127.0.0.1:${APP_PORT:-8080}/healthz\" >/dev/null 2>&1 || exit 1"]

# Seed on first run (idempotent; the binary also seeds at startup), then serve
# the single binary.
CMD ["/bin/sh", "-c", "seed || true; exec rumi"]
