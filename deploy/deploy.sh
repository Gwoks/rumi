#!/bin/bash
# =============================================================================
# Deploy RUMI to the VPS (default domain: rumi-stg.kasibah.com).
#
# Run it from the repo checkout on the server (`bash deploy/deploy.sh`). The
# "Deploy to VPS" GitHub Actions workflow (.github/workflows/deploy.yml) runs
# this SAME script over SSH, so a manual deploy can't drift from CI.
#
# Steps: pull origin/main -> build the SPA + Rust binaries -> render the
# systemd unit and nginx site from deploy/ templates -> certbot -> nginx -t +
# reload -> restart rumi -> verify /healthz and /api/health through nginx.
#
# Env overrides: APP_DIR, DOMAIN, APP_PORT, PUBLIC_BASE_URL.
# Secrets (ADMIN_EMAIL, ADMIN_PASSWORD, RUMI_ADMIN_WA_PHONE) are NOT handled
# here: they live in /etc/rumi/rumi.env (root:root, 0600), read by systemd.
# =============================================================================
set -euo pipefail

SERVICE_NAME="rumi"
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DOMAIN="${DOMAIN:-rumi-stg.kasibah.com}"
APP_PORT="${APP_PORT:-8080}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-https://$DOMAIN}"
ENV_FILE="/etc/rumi/rumi.env"
HEALTH_ATTEMPTS=15
HEALTH_DELAY_SECONDS=2

# Substitute every {{PLACEHOLDER}} in a deploy/ template and print the result.
render() {
  sed "s|{{APP_DIR}}|$APP_DIR|g; s|{{APP_PORT}}|$APP_PORT|g; s|{{PUBLIC_BASE_URL}}|$PUBLIC_BASE_URL|g; s|{{DOMAIN}}|$DOMAIN|g" "$1"
}

# Poll a URL until it answers 2xx, so a slow start isn't reported as a failure.
wait_healthy() {
  local url="$1"
  local attempt
  for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if curl -fsS -o /dev/null "$url"; then
      echo "    ok: $url"
      return 0
    fi
    echo "    waiting for $url ($attempt/$HEALTH_ATTEMPTS)"
    sleep "$HEALTH_DELAY_SECONDS"
  done
  echo "ERROR: $url is not healthy after $HEALTH_ATTEMPTS attempts" >&2
  sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager >&2 || true
  return 1
}

main() {
  cd "$APP_DIR"

  echo "==> Pulling latest code"
  git fetch origin main
  git reset --hard origin/main

  echo "==> Installing dependencies and building frontend"
  pnpm install --frozen-lockfile
  pnpm build

  echo "==> Building Rust backend"
  if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.cargo/env"
  fi
  (cd backend && cargo build --release --bins --locked)

  echo "==> Preparing data dir, permissions and secrets"
  mkdir -p "$APP_DIR/data"
  # The SQLite DB holds sessions and password hashes: owner-only.
  chmod 700 "$APP_DIR/data"
  # nginx (www-data) must be able to traverse into $APP_DIR/dist.
  sudo chmod o+x "$(dirname "$APP_DIR")"
  if ! sudo test -f "$ENV_FILE"; then
    echo "WARN: $ENV_FILE is missing - no admin account will be bootstrapped." >&2
    echo "      Create it (root:root, 0600) with ADMIN_EMAIL, ADMIN_PASSWORD and RUMI_ADMIN_WA_PHONE." >&2
  fi

  echo "==> Rendering and installing systemd service"
  render "$APP_DIR/deploy/rumi.service" | sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null

  echo "==> Rendering and installing nginx config"
  render "$APP_DIR/deploy/nginx.conf" | sudo tee "/etc/nginx/sites-available/$SERVICE_NAME" > /dev/null
  sudo ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/$SERVICE_NAME"
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t

  echo "==> Ensuring TLS certificate"
  # Re-rendering above dropped certbot's TLS block. Non-interactively, certbot
  # re-installs the existing cert (or issues one on the first deploy). A
  # certbot failure is tolerated here; the HTTPS health check below catches it.
  sudo certbot --nginx -d "$DOMAIN" \
    --noninteractive --agree-tos --register-unsafely-without-email --redirect || true

  echo "==> Reloading nginx and restarting $SERVICE_NAME"
  sudo nginx -t
  sudo systemctl reload nginx
  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME"
  sudo systemctl restart "$SERVICE_NAME"

  echo "==> Verifying health"
  wait_healthy "http://127.0.0.1:$APP_PORT/healthz"
  wait_healthy "$PUBLIC_BASE_URL/healthz"
  wait_healthy "$PUBLIC_BASE_URL/api/health"

  echo "$SERVICE_NAME deployed successfully to $PUBLIC_BASE_URL"
}

# Everything runs inside main(), and `exit` sits on the same line, so bash has
# parsed the whole script before `git reset --hard` can rewrite this file.
main "$@"; exit
