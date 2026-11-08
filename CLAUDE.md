# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

**Quality gates.** Run both before closing any issue that changed code.

```bash
# Backend (Rust crate `rumi`, in backend/)
cd backend && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
cd backend && cargo llvm-cov --fail-under-lines 80        # coverage gate (one-time: cargo install cargo-llvm-cov)

# Frontend (Vite SPA, repo root)
pnpm install && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm test -- --coverage                                   # ≥ 80% on src/lib, src/api, src/stores, src/components
```

**Development** (two terminals):

```bash
cd backend && SEED_DEMO=true cargo run   # API on :8080 (demo: admin@rumi.id / rumi-admin-123, nadia@example.com / rumi-parent-123)
pnpm dev                                 # SPA on :5173; Vite proxies /api → http://localhost:8080 (NO changeOrigin, see PRD §5.3.3)
```

**Full stack locally** (Rust serves the built SPA):

```bash
pnpm build && (cd backend && STATIC_DIR=../dist SEED_DEMO=true RUMI_ADMIN_WA_PHONE=6281234567890 cargo run)
# → http://localhost:8080   (liveness: /healthz, API health: /api/health)
```

**Other commands:**
- `cd backend && cargo run --bin seed` seeds the database on its own (idempotent).
- `docker compose up --build` runs the production-like stack.

## Architecture Overview

RUMI (Rumah Main Islami) has two parts: Islamic Montessori weekend pop-up classes, and a play-kit store for ages 3–6 with a manual WhatsApp checkout. It mirrors `../hookbox`: a **Rust Axum + sqlx/SQLite backend** serves the JSON API **and** a **Vite + React 18 + TS + Tailwind 3.4 SPA** built into `dist/`. The old Express/Next build was deleted; it is still in git at `cc4ba5a`.

```
backend/                 Rust crate `rumi` (bins: rumi, seed); axum 0.8, sqlx SQLite (WAL), argon2, tracing
  migrations/            0001_init.sql (INTEGER IDR, CHECKs on money/stock/enums, soft delete deleted_at)
  src/                   config, db, error (envelope), extract (ApiJson), auth/ (cookie sessions, RBAC
                         extractors), models/, services/ (checkout, order_code, order_status, metrics),
                         routes/ (public, auth, parent, admin/*, spa, health), tasks/sweep, seed, whatsapp, money
  tests/                 integration tests: tower::ServiceExt::oneshot on in-memory SQLite
src/                     React SPA: api/ (zod-validated client), stores/ (cart), lib/ (copy, format, domains,
                         create-store), components/{ui,rumi,admin}, screens/{public,auth,parent,admin}
e2e/                     Playwright journeys on a mock backend + static guards (no-hex, contract, import boundaries)
fixtures/rupiah.json     shared Rupiah formatter cases for the Rust and TS tests
public/brand/            optimized logo + icons
docs/features/rumi-v1/   prd.md — §5 is the FROZEN API contract both lanes code against
DESIGN.md                visual system (tokens, recipes, a11y rules)
Dockerfile, docker-compose.yml, deploy/, .github/workflows/
```

**Request flow.** Browser → (nginx in prod) → Rust `:8080`, which routes:
- `/api/*` → handlers → `services/` → SQLite;
- `/healthz` → plain `ok`;
- `/assets/*` → immutable static files;
- everything else → `dist/` with an `index.html` SPA fallback.

An unknown `/api/*` path returns a JSON 404, never the SPA.

**Auth:**
- Login or register sets an opaque `rumi_session` HttpOnly cookie. The server stores only its SHA-256 hash in `auth_sessions`.
- The `CurrentUser`, `ParentUser` and `AdminUser` extractors enforce RBAC.
- Parent-owned resources answer 404 for both "absent" and "not yours".
- Mutating `/api` calls are Origin-checked (CSRF).

**Checkout (`POST /api/orders`):**
- The client sends only ids and quantities.
- One `BEGIN IMMEDIATE` transaction reserves seats and stock with conditional UPDATEs, snapshots prices, allocates `RUMI-YYYY-NNNN` (WIB year) and builds the Indonesian WhatsApp message.
- It returns `{order, wa_url}`, and the order starts as `PENDING_WA`.
- An admin marks the order `PAID` (enrollments become CONFIRMED) or `CANCELLED` (stock and seats are released).
- A background sweep auto-cancels `PENDING_WA` orders after `PENDING_ORDER_TTL_HOURS` and purges expired sessions and reset tokens.

**Frontend:**
- A flat `createBrowserRouter`, with `<RequireRole role="PARENT|ADMIN">` guarding protected routes.
- One `api` object, with one method per contract route.
- `parseJsonResponse` validates `envelope(schema)` with zod. A mismatch becomes `contract_mismatch`, and a 401 `unauthorized` redirects to `/login?next=…`.
- `authStore` (`src/api/auth-store.ts`) is **in memory only**: it bootstraps from `GET /api/auth/me`, and login, register and logout write a PII-free timestamp under `rumi-auth-signal` so other tabs silently re-check `/api/auth/me`. A failed re-check keeps an already-`ready` session instead of unmounting the dashboard.
- Only `cartStore` (`src/stores/cart.ts`) persists, to localStorage (`rumi-cart-v1`), and syncs across tabs through the `storage` event.
- Both are `createStore` instances (`src/lib/create-store.ts`; the cart passes a `persist` option) read through `useSyncExternalStore` hooks.

## Conventions & Patterns

### Source of truth and lanes

- **`docs/features/rumi-v1/prd.md` §5 is FROZEN.** It fixes the endpoints, DTO field names, nullability, status and error codes, orderings, the WhatsApp template and the seed data. Backend and frontend both code against it and never against each other. To change it, amend §5 first and then the code.
- **Lane ownership** (disjoint, so parallel work causes no conflicts):

  | Lane | Owns |
  |---|---|
  | backend | `backend/` |
  | frontend | `src/`, `e2e/`, `public/`, `index.html`, and the root configs (`package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `postcss.config.mjs`, `.prettierrc`) |
  | shared, read-mostly | `fixtures/`, `docs/`, `DESIGN.md`, `CLAUDE.md` |

- Tasks are tracked in **beads** (`bd`). One epic has one issue per phase, linked by dependencies; see the beads section above.

### Cross-cutting rules (both lanes)

**The API envelope is always the same.**
- Success: `{ "success": true, "data": T, "error": null }`.
- Error: `{ "success": false, "data": null, "error": "<Indonesian message>", "code": "<machine_code>" }`, with an optional `fields` map on `validation_error`.
- The UI branches on `code`, never on `error`.

**Money:**
- **Integer IDR everywhere**: `*_idr` fields, `INTEGER` columns with `CHECK ≥ 0`. Never floats, and never `$`.
- Money is formatted only at the edge: Rust `money::format_rupiah` and TS `formatRupiah`. **Both** are tested against `fixtures/rupiah.json`.

**Time:**
- The DB stores UTC. The API emits RFC 3339 `…Z` strings at second precision, `YYYY-MM-DD` dates and `HH:MM` times.
- **Business time is WIB (UTC+7):** "today", class start and bookability, the order-code year, and "upcoming".

**The server is authoritative** for prices, totals, stock, seats, roles and order status. Unknown request fields are ignored, so a client-sent `price_idr` or `role` changes nothing.

**Copy:**
- The UI is in **Bahasa Indonesia** only.
- Backend error messages are Indonesian sentences.
- Frontend strings come from `t()` in `src/lib/copy/` (`index.ts` exports `t()`; the strings live in per-area files `common.ts`, `public.ts`, `auth.ts`, `parent.ts`, `admin.ts` and `design-kit.ts`, whose key prefixes `copy.test.ts` enforces). There are no inline literals in components.

**Security:**
- No secrets in code. The admin account comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; demo data appears only with `SEED_DEMO=true`, and is refused on an `https://` `PUBLIC_BASE_URL` unless `ALLOW_DEMO_SEED_IN_PROD=true`.
- Logs never include cookies, passwords, tokens or request bodies.

### Backend (Rust)

**Copied from hookbox:**
- `main.rs` startup order: tracing → `Config::from_env` → pool → migrate → seed-if-empty → `AppState::new` → spawn sweep → `build_app` → serve with `ConnectInfo` and graceful shutdown.
- `config.rs` reads env vars through the `str_env` / `int_env` / `bool_env` helpers, falling back to safe defaults without crashing.
- `db.rs` turns on WAL, `foreign_keys` and `busy_timeout`, and runs `sqlx::migrate!`.

**axum 0.8:**
- Path syntax is `/{id}`, and there is no `async_trait`.
- Handlers return `Result<_, ApiError>`, using the `ok(data)` and `created(data)` helpers.
- Bodies come in through `ApiJson<T>`, which wraps `JsonRejection` in the envelope.
- sqlx UNIQUE violations map to 409. Other sqlx errors are logged and become a generic 500 or 503.

**Queries:**
- Use parameterized `sqlx::query(...)` with binds only.
- The PATCH builder concatenates only **allow-listed column names**, never values.
- Soft delete uses `deleted_at`, and every read filters `deleted_at IS NULL`.

**Rules:**
- No `unwrap()` or `expect()` in request paths.
- Run argon2 inside `spawn_blocking`.
- Keep functions under 50 lines and files under 800.

**Tests:**
- Write them first (TDD).
- `tests/` integration tests call the router through `tower::ServiceExt::oneshot` on in-memory SQLite.
- They must cover auth, RBAC, envelope shape, checkout (oversell, double-booking, idempotency, ownership 404, price tampering ignored) and the order-status state machine.

### Frontend (React SPA)

**Style:**
- `.prettierrc`: single quotes, no semicolons.
- File names are kebab-case.
- Use **named exports** only.
- Import through the `@/` alias, which maps to `src/`.

**API:**
- Fetch only through `src/api/` (`http.ts` → `client.ts`).
- Every response is parsed with the zod schemas in `src/api/schemas.ts`, which mirror PRD §5.6 exactly.
- Requests use `credentials: 'same-origin'`.
- Screens never call `fetch` directly; `e2e/import-boundaries.spec.ts` enforces this.

**State:**
- `createStore` (`src/lib/create-store.ts`) holds a listener `Set`; with the optional `persist` option it also writes localStorage and listens for the cross-tab `storage` event (used by the cart only — auth stays in memory).
- Components read it through `useSyncExternalStore` hooks (`useAuth`, `useCart`).
- Don't add Redux, Zustand or react-query.

**Libraries:**
- UI primitives are built on Radix (dialog, tabs, toast, slot, dropdown).
- Icons come from `lucide-react`.
- There is no chart library: charts are hand-rolled SVG or div bars.

**Tests:**
- Vitest + Testing Library for units and components, accessibility-first (query by role and label).
- Playwright e2e runs on `e2e/mock-backend.ts`.
- `e2e/contract.spec.ts` checks every mock payload against the zod schemas.

### Design system

`DESIGN.md` (repo root) is the canonical visual style reference for the frontend (`src/`). It describes RUMI as a "sunlit Saturday-morning playroom":
- **Surfaces:** a warm paper canvas (`#FDFBF7`), white cards with hairline slate borders (`#E2E8F0`), and no resting shadows.
- **Color:**
  - brand teal (`#2A9D8F`) as the calm anchor;
  - warm orange (`#FA8C42`) as the commitment CTA, with dark `accent-on` text;
  - sunny yellow (`#FAD02C`) as the highlight;
  - soft tints (`#E7F4F0` / `#FFF1E6` / `#FFF7CF`) for chips, tiles and notes;
  - ink text (`#2D3748`).
- **Type:** Inter, with tight negative tracking on display sizes.
- **Radii:** 12px controls (`rounded-xl`), 16px cards (`rounded-2xl`), 28px modals (`rounded-modal`), fully rounded pills.

**Read DESIGN.md before any UI work.** Colors, spacing, radii, motion and component treatments must follow its token, recipe, accessibility and Do's-and-Don'ts sections rather than being improvised per screen.

The design is implemented as a **semantic-token system**, not per-component styling:

- `src/globals.css` is the **only** file where raw hex, `rgb()` or `hsl()` color values may appear.
  - It defines the primitive palette as RGB channel triples, then maps the primitives to semantic CSS custom properties (`--color-canvas`, `--color-ink`, `--color-primary-strong`, `--color-accent-on`, …).
  - It also holds the shadow and motion tokens, the base layer and the template's reduced-motion block.
  - It is light-only in v1; the semantic layer keeps dark mode cheap to add later.
- `tailwind.config.ts` turns those vars into Tailwind utilities with `rgb(var(--color-…) / <alpha-value>)`, so opacity modifiers work.
  - It **replaces** the default color palette, so `bg-white`, `text-slate-500` and similar classes do not exist.
  - It adds the type scale (`text-display`, `text-h1`, …, `text-overline`), the radii (`rounded-modal`, `rounded-hero`), the shadows, the durations and easings, and the z-index tokens.
- Components and screens use **semantic Tailwind classes only**. Never write a raw hex, an inline color style, an arbitrary color class (`bg-[#…]`) or a one-off shadow. `e2e/no-hex.spec.ts` enforces this for all of `src/` except `globals.css`.
- **Accessibility (WCAG 2.2 AA) is part of the token contract:**
  - Text on teal uses `primary-strong` (`#1F7A70`). Brand `#2A9D8F` is only for fills, icons and large display text.
  - Text on orange is `accent-on` (`#1A202C`), never white.
  - Orange or yellow text uses the `*-strong` shades.
  - Every interactive element has the 2px `outline-focus` ring.
  - Status is never shown by color alone.
  - Every transform animation is `motion-safe:`.

When you add or restyle UI:
1. Change the tokens in `src/globals.css` and `tailwind.config.ts`, not component-local styles.
2. Re-run `pnpm e2e`, which covers `no-hex` and the journeys.
3. Look over `/design-kit` (the public primitives page) before calling a visual change done.
