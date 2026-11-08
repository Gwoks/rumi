# PRD: RUMI v1 — Rust/Axum + SQLite + React SPA rebuild (slug: `rumi-v1`)

- **Status:** FROZEN at Phase 0 (2026-11-08). §5 is the interface contract.
- **Inputs:**
  - the approved plan (`~/.claude/plans/pasted-content-id-0c02-act-as-immutable-twilight.md`)
  - the visual template `../rumi-v0-template/app/page.tsx`
  - the conventions of `../hookbox`
- **Consumers:**
  - the **backend lane**, which owns `backend/` only
  - the **frontend lane**, which owns `src/`, `e2e/`, `public/` and the root tool configs
  - Both lanes code against §5 and never against each other.

> **§5 is FROZEN.** Field names, types, nullability, status codes, error codes, orderings and formats are exact. A lane that needs a change amends §5 first, in this file, and only then changes code. If the text is ambiguous, the stricter reading wins. Examples marked *(example)* show the shape; the values in them are not guaranteed.

---

## 1. Problem

RUMI (Rumah Main Islami) runs Islamic Montessori **weekend pop-up classes** for children aged 3–6 in Jabodetabek, and sells **play kits** for learning at home. The earlier one-shot build (Express + Next.js, now deleted; it is still in git at `cc4ba5a`) is not fit to run in production:

- Anyone could register as an admin.
- The client set its own prices and totals.
- The JWT secret was hardcoded.
- Money was stored as `REAL` and shown in `$`.
- Some screens logged in as demo users automatically.
- There was no CMS, no WhatsApp checkout and no Indonesian copy.

Parents need a trustworthy way to find a class, book a seat for their child, buy kits, and follow their child's progress. Admins need one calm place to run all of it.

## 2. Users

| User | Who | Main jobs |
|---|---|---|
| **Visitor** (anonymous) | A parent browsing on a phone, usually via a WhatsApp link | Read about RUMI, browse classes and kits, fill a cart |
| **Parent** (`PARENT`) | Mother or father of one or more children aged 3–6 | Register with their first child, book seats, buy kits, check out over WhatsApp, see attendance and progress, print a report |
| **Admin** (`ADMIN`) | The RUMI team (founder plus guides) | Edit site content, manage classes and kits, confirm payments, record attendance and assessments, watch the key numbers |

Bahasa Indonesia is the only UI language. Prices are in Rupiah. Times are in WIB (UTC+7).

## 3. Goals and success measures

1. **The server holds the truth for money and stock.** No price, total, seat count or stock level ever comes from the client. Checkout is one atomic transaction that cannot oversell a kit or overbook a class.
2. **Checkout goes through WhatsApp.** The order is created as `PENDING_WA`, and the parent lands in a `wa.me` chat with a prefilled Indonesian message carrying the order code `RUMI-YYYY-NNNN` and the Rupiah total. An admin later marks the order `PAID` or `CANCELLED`.
3. **Security basics.**
   - Registration only ever creates `PARENT` users.
   - Sessions are revocable and live in an HttpOnly cookie.
   - Mutating `/api` requests are CSRF-checked.
   - Auth endpoints are rate-limited.
   - A parent can never see another family's data.
4. **Real data only.** The admin metrics are true aggregates, and nothing is ever filled with fake numbers.
5. **Quality gates.**
   - Backend: `cargo fmt`, `clippy -D warnings` and `cargo test` pass.
   - Frontend: `typecheck`, `test`, `build` and `e2e` pass.
   - Coverage is at least 80% in the scopes the plan names.

## 4. Scope

### 4.1 In scope (v1)

**Public pages:**

| Route | Content |
|---|---|
| `/` (Beranda) | Hero (CMS `home/hero`), the Cara RUMI cards (`home/rumi_way`), the next 3 classes, the latest 4 kits |
| `/who-we-are` | Founder message, philosophy, mission, educators (CMS) |
| `/our-approach` | Intro, the 5 domains as tabs, the Islamic values infographic (CMS) |
| `/weekend-classes` | Filters for location, date range and age, synced to the URL query; seat indicator; detail dialog; "Pesan Kursi" |
| `/play-kits` | Category filter, stock indicator, detail dialog, "Tambah ke Keranjang" |
| `/design-kit` | Public page showing every UI primitive |

**Cart and checkout:**
- A global cart drawer, saved in localStorage.
- A 3-step checkout dialog: Ringkasan, Detail, Konfirmasi. It calls `POST /api/orders` and then opens `wa_url`.

**Auth pages:**
- `/login`
- `/register`: 3 steps (parent, child, success)
- `/forgot-password`
- `/reset-password?token=`

**Parent pages:**
- `/parent/dashboard`, with a child switcher and the tabs Ringkasan, Kehadiran, Perkembangan and Pesanan
- `/parent/report/:childId`, a print-styled report that is printed with `window.print()`

**Admin page:** `/admin/dashboard`, with these tabs:
- Ringkasan (metrics)
- Konten (CMS)
- Kelas
- Kit
- Siswa (directory, profile, assessment logger, attendance)
- Pesanan (mark PAID or CANCELLED)

**Everything else:**
- `NotFound` page
- the `/api/*` endpoints in §5.8
- `/healthz`
- the SPA served by Rust

### 4.2 Non-goals (v1)

- Online payment gateways. Payment is confirmed by hand over WhatsApp.
- Sending email. Password-reset links go through a `Notifier`, and the default `LogNotifier` writes them to the server log. SMTP is a follow-up issue.
- Photo galleries and uploads. The template's gallery and uploader are out of scope.
- Dark mode and other UI languages.
- Parents cancelling their own orders.
- Admin editing or deleting assessments.
- Per-class attendance rosters. Attendance is marked from the student profile.
- Enforcing a child's age against a class's age range at checkout.
- Shipping-status tracking for kits.
- Running more than one instance (SQLite single node).

---

## 5. Frozen API contract

### 5.1 Transport and envelope

**Transport:**
- Every API route lives under `/api`.
- Request and response bodies are UTF-8 JSON. Responses carry `Content-Type: application/json` and `Cache-Control: no-store`.
- An endpoint that takes a body requires `Content-Type: application/json`. Endpoints whose request body is "—" in §5.8 ignore any body and do not require a content type.
- A request body may be at most **64 KiB**. A larger one gets `413 payload_too_large`.
- **Unknown fields in a request body are ignored**, and they never affect behavior: sending `role`, `price_idr`, `total_amount_idr` or `seats_booked` changes nothing. The one exception is a CMS `body` document (§5.7), which is validated strictly.
- Every DTO key is always present in a response. A nullable field is serialized as `null`, never left out.

**Success envelope** (every 2xx):

```json
{ "success": true, "data": <T>, "error": null }
```

- `data` is `null` for deletes, logout, forgot-password and reset-password.
- A success envelope has no `code` key.

**Error envelope** (every 4xx and 5xx under `/api`):

```json
{ "success": false, "data": null, "error": "<pesan untuk pengguna, Bahasa Indonesia>", "code": "<machine_code>" }
```

- `error` is a human-readable Indonesian sentence that the UI may show as-is.
- `code` is one of the codes in §5.2. The UI branches on `code`, never on `error`.
- A `validation_error` **may** also carry `"fields": { "<dotted.path>": "<pesan>" }`, which maps request paths to messages, for example `parent.email`, `child.dob`, `delivery.address`, `items.2.quantity`, or `age` for a query parameter. The key is left out when it does not apply, so the frontend schema is `fields: z.record(z.string()).optional()`.
- No 5xx ever exposes SQL, file paths or stack traces in `error`.

### 5.2 Error codes (complete list)

| HTTP | `code` | Raised when | Default `error` (backend may add specifics) |
|---|---|---|---|
| 400 | `bad_request` | The JSON is malformed, or `Content-Type: application/json` is missing on a body endpoint | "Format permintaan tidak valid." |
| 401 | `unauthorized` | A protected route gets a missing, unknown or expired session, or a session whose user was deleted | "Silakan masuk terlebih dahulu." |
| 401 | `invalid_credentials` | Login with a wrong email or password, or a deleted user. Never says which part was wrong | "Email atau kata sandi salah." |
| 403 | `forbidden` | The user is signed in but has the wrong role | "Anda tidak memiliki akses." |
| 403 | `origin_mismatch` | The CSRF Origin check fails (§5.3.3) | "Permintaan ditolak." |
| 404 | `not_found` | The resource is absent, soft-deleted or hidden. Also used for a parent-owned resource that belongs to someone else, an unknown `/api/*` route, and a path id that is not a positive integer | "Data tidak ditemukan." |
| 405 | `method_not_allowed` | The route exists, but not for this method | "Metode tidak diizinkan." |
| 409 | `conflict` | A generic state conflict: a duplicate CMS `(page_slug, section_key)`, or a delete or status change blocked by active enrollments | specific |
| 409 | `email_taken` | Register with an email that already exists | "Email sudah terdaftar. Silakan masuk." |
| 409 | `item_unavailable` | Checkout: a kit is missing, deleted or inactive, or a class is missing, deleted, not `OPEN` or already started | "{nama} sudah tidak tersedia." |
| 409 | `already_enrolled` | Checkout: the child already has a non-cancelled enrollment in that class | "{anak} sudah terdaftar di kelas {judul}." |
| 409 | `class_full` | Checkout: no seats are left | "Kelas {judul} sudah penuh." |
| 409 | `out_of_stock` | Checkout: there is not enough kit stock | "Stok {nama} tidak mencukupi (tersisa {n})." |
| 409 | `invalid_transition` | The order-status or attendance state machine rejects the change | "Status tidak dapat diubah dari {dari} ke {ke}." |
| 413 | `payload_too_large` | The body is over 64 KiB | "Ukuran permintaan terlalu besar." |
| 422 | `validation_error` | Well-formed JSON breaks a rule in §5; also bad query params, and a PATCH with no recognised field | specific |
| 422 | `invalid_token` | The reset-password token is unknown, expired or already used | "Tautan reset tidak valid atau sudah kedaluwarsa." |
| 429 | `rate_limited` | The auth rate limit is exceeded. Always sent with the header `Retry-After: <integer seconds ≥ 1>` | "Terlalu banyak percobaan. Coba lagi dalam {n} detik." |
| 500 | `internal` | Any unexpected failure, including a panic caught by `CatchPanicLayer` | "Terjadi kesalahan pada server." |
| 503 | `unavailable` | SQLite is busy, the pool times out, or the health DB probe fails | "Layanan sedang sibuk. Coba lagi sebentar lagi." |

**Frontend-only codes** (never sent by the server):

| Code | Meaning |
|---|---|
| `network_error` | `fetch` rejected |
| `contract_mismatch` | the response failed the zod envelope or DTO schema |

**Frontend rule:** when any call returns `unauthorized`, the frontend clears the auth store and redirects to `/login?next=<current path+search>`. `invalid_credentials` never triggers that redirect.

### 5.3 Auth, session cookie, CSRF, rate limiting

#### 5.3.1 Access levels used in §5.8

| Level | Meaning | Failure |
|---|---|---|
| `public` | No session needed | — |
| `PARENT` | A valid session whose user has role `PARENT` | no session → `401 unauthorized`; ADMIN → `403 forbidden` |
| `ADMIN` | A valid session whose user has role `ADMIN` | no session → `401 unauthorized`; PARENT → `403 forbidden` |

**Ownership:** on `/api/me/*`, a child id that does not exist, is soft-deleted, or belongs to another parent returns **`404 not_found`**. All three cases look the same.

#### 5.3.2 Session cookie

| Moment | `Set-Cookie` value |
|---|---|
| Set (on register and login) | `rumi_session=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=<SESSION_TTL_DAYS × 86400>`, plus `; Secure` when §5.10 `COOKIE_SECURE` says so |
| Clear (on logout and reset-password) | `rumi_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` (`Secure` added under the same rule) |

- `<token>` is 32 CSPRNG bytes encoded as base64url without padding (43 characters).
- The server stores only the SHA-256 hex of the token, in `auth_sessions.token_hash`.
- The expiry is fixed at `created_at + SESSION_TTL_DAYS`. It does not slide. Each authenticated request updates `last_seen_at`.
- Login revokes the session named by the incoming `rumi_session` cookie, if there is one, before it creates the new session.
- Reset-password revokes every session of that user.
- The frontend never reads the cookie. Every request uses `credentials: 'same-origin'`.

#### 5.3.3 CSRF Origin check

The check applies to every `POST`, `PUT`, `PATCH` and `DELETE` under `/api`, the auth endpoints included.

- If an `Origin` header is present and its `host[:port]` matches neither the request's `Host` header nor the host of `PUBLIC_BASE_URL`, the server returns **`403 origin_mismatch`**. The scheme is ignored.
- If `Origin` is absent, the request is allowed. Non-browser clients send no Origin and cannot ride a browser cookie.
- `SameSite=Lax` is a second layer of protection.
- **Dev requirement:** the Vite proxy for `/api` must **not** set `changeOrigin`, so `Host` stays `localhost:5173` and matches `Origin`.

#### 5.3.4 Rate limiting

- A token bucket is kept per **(endpoint, client IP)** for four endpoints: `POST /api/auth/register`, `/login`, `/forgot-password` and `/reset-password`.
- Each bucket holds `AUTH_RATE_LIMIT_PER_MIN` tokens and refills continuously at that many tokens per minute.
- Every request takes one token, whatever its outcome.
- When the bucket is empty, the server returns `429 rate_limited` with `Retry-After`.
- The client IP is the TCP peer address. `X-Real-IP` and the first `X-Forwarded-For` entry are trusted **only** when the peer is loopback (nginx). This is hookbox's `effective_client_ip`.

### 5.4 Formats and normalization

#### 5.4.1 Scalar formats

| Name | Format | Example |
|---|---|---|
| `Timestamp` | RFC 3339 UTC, second precision, always ending in `Z`. Regex: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$` | `"2026-11-08T03:15:00Z"` |
| `DateStr` | `YYYY-MM-DD`, and it must be a real calendar date | `"2026-11-14"` |
| `TimeStr` | 24-hour `HH:MM`, regex `TIME_RE` below | `"09:30"` |
| `Idr` | A JSON integer of whole Rupiah. Never a float, never a string | `150000` |
| `Id` | A JSON integer ≥ 1 | `42` |

`TIME_RE` = `^([01][0-9]|2[0-3]):[0-5][0-9]$`

#### 5.4.2 Time zone

All business time is **WIB (`Asia/Jakarta`, a fixed UTC+7 with no DST)**.

| Term | Definition |
|---|---|
| **today** | The current calendar date in WIB |
| **class start** | The instant `date` + `start_time` read in WIB |
| **upcoming class** | A class whose start is later than now |
| **order-code year** | The WIB calendar year of the order's creation instant |

#### 5.4.3 Computed fields

**`age_years`:** the number of full years from `dob` to *today*. The age goes up when today's (month, day) is on or after the dob's (month, day). A 29 February birthday is therefore reached on 1 March in non-leap years.

**`age_range`:** `"{age_min}–{age_max}"`, joined by an EN DASH (U+2013) with no spaces, for example `"3–6"`. The same format is used even when the two numbers are equal.

**`time_slot`:** `"{start_time}–{end_time}"`, joined by an EN DASH with no spaces, for example `"09:30–11:30"`.

**Percentages** (`attendance_rate_pct`, `fill_rate_pct`): an integer from 0 to 100, computed as `round(numerator × 100 / denominator)` with halves rounded up. With integers that is `(n*200 + d) / (2*d)`.

**Rupiah display:**
- The server formats Rupiah only inside the WhatsApp message. `format_rupiah(i64)` must equal `fixtures/rupiah.json`: `"Rp 1.250.000"` and `"-Rp 25.000"`, with an ASCII space and `.` as the thousands separator.
- The frontend's `formatRupiah` must produce the same strings: `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })`, with U+00A0 replaced by U+0020.

#### 5.4.4 Strings

- Before checking lengths, the server **trims** every incoming text field. Passwords are the exception.
- An optional text field that is empty after trimming becomes `null`.
- Lengths count Unicode scalar values: `chars().count()` in Rust, `[...s].length` in TS.

#### 5.4.5 Email

- The server trims and lowercases the email.
- It must be at most 254 characters and match `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- Uniqueness ignores case.

#### 5.4.6 WhatsApp phone normalization

This applies to `phone_wa`, `delivery.phone_wa` and `RUMI_ADMIN_WA_PHONE`, and it is the same on the server and in the client.

1. Remove spaces, `-`, `.`, `(` and `)`.
2. Drop one leading `+`, if there is one.
3. What remains must be all digits; otherwise the number is invalid.
4. Rewrite the prefix:
   - leading `0` → `62` + the rest
   - leading `8` → `62` + the whole string
   - leading `62` → unchanged
   - anything else → invalid
5. The result must match `^62[1-9]\d{7,12}$`, which is 10 to 15 digits in total.

Examples: `"0812-3456-7890"` → `"6281234567890"`; `"+62 812 3456 7890"` → `"6281234567890"`; `"812345678"` → `"62812345678"`.

When a phone number is invalid, the server returns `422 validation_error`.

#### 5.4.7 Passwords

- 8 to 128 characters, not trimmed.
- Stored as argon2id. The hashing runs inside `spawn_blocking`.

#### 5.4.8 Path ids

A `{id}` that is not a positive base-10 integer returns `404 not_found`.

#### 5.4.9 PATCH semantics (every PATCH in §5.8)

- The body is a JSON object.
- A **key that is absent** leaves the field unchanged.
- **`null`** clears the field, but only if the field is nullable. `null` on a non-nullable field returns `422`.
- Only the listed fields are recognized. Any other key is ignored (§5.1).
- A body with **no recognized field** returns `422 validation_error`, with the message "Tidak ada perubahan."
- The same field rules as the matching create apply.
- The server answers with the **full updated DTO**.

#### 5.4.10 Pagination (only where §5.8 says *Paginated*)

| Query param | Rule | Default |
|---|---|---|
| `page` | an integer ≥ 1 | `1` |
| `per_page` | an integer from 1 to 100 | `20` |

A value out of range returns `422`. A page past the end returns an empty `items` array.

The response shape is `Paginated<T>`, defined in §5.6.

#### 5.4.11 Search `q`

- The server trims `q`, and it may be at most 100 characters.
- An empty `q` means no filter.
- Matching is a case-insensitive substring match (`LIKE '%…%'`, with `%` and `_` escaped).

### 5.5 Enums and Indonesian labels

The labels below are the frontend's `t()` strings. The frontend owns them; the server never sends labels.

**`Role`**

| Value | Label |
|---|---|
| `PARENT` | Orang Tua |
| `ADMIN` | Admin |

**`Domain`** (the canonical order is the order below; it is also used as the kit category)

| Value | Label |
|---|---|
| `PRACTICAL_LIFE` | Kehidupan Praktis |
| `SENSORIAL` | Sensorial |
| `LANGUAGE` | Bahasa |
| `MATH` | Matematika |
| `ISLAMIC_STUDIES` | Studi Islam |

**Assessment `level`**: an integer from 1 to 4.

| Level | Label |
|---|---|
| 1 | Mulai Mengenal |
| 2 | Berkembang |
| 3 | Berlatih Mandiri |
| 4 | Menguasai |

**`OrderStatus`**

| Value | Label |
|---|---|
| `PENDING_WA` | Menunggu Konfirmasi |
| `PAID` | Lunas |
| `CANCELLED` | Dibatalkan |

**`ClassStatus`**

| Value | Label |
|---|---|
| `DRAFT` | Draf |
| `OPEN` | Dibuka |
| `CLOSED` | Ditutup |
| `CANCELLED` | Dibatalkan |

A full class keeps its status. `is_full` is derived, and its label is "Penuh".

**`EnrollmentStatus`**

| Value | Label |
|---|---|
| `RESERVED` | Dipesan |
| `CONFIRMED` | Terkonfirmasi |
| `ATTENDED` | Hadir |
| `ABSENT` | Tidak Hadir |
| `CANCELLED` | Dibatalkan |

**`OrderItemType`**: `KIT` (label "Kit") and `CLASS` (label "Kelas").

**Shared constants:**
- **`LOW_STOCK_THRESHOLD = 5`**. A kit is "low stock" when `stock ≤ 5`, which includes 0. Both lanes use it: the metrics on the backend, the stock indicator on the frontend.
- **`PENDING_ORDER_TTL_HOURS`** comes from the environment (§5.10).

### 5.6 Shared DTOs (Rust `serde` ⇄ TS `zod`; JSON keys are snake_case and exact)

Notation: `T | null` is nullable, and every key is always present. `Timestamp`, `DateStr`, `TimeStr`, `Idr` and `Id` are defined in §5.4.1. `number` always means a JSON integer; there are no floats anywhere in this API.

```ts
type Role = 'PARENT' | 'ADMIN'
type Domain = 'PRACTICAL_LIFE' | 'SENSORIAL' | 'LANGUAGE' | 'MATH' | 'ISLAMIC_STUDIES'
type ClassStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
type OrderStatus = 'PENDING_WA' | 'PAID' | 'CANCELLED'
type EnrollmentStatus = 'RESERVED' | 'CONFIRMED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED'
type OrderItemType = 'KIT' | 'CLASS'

type User = {
  id: Id
  email: string                 // lowercase
  full_name: string
  phone_wa: string              // normalized "62…" (§5.4.6)
  role: 'PARENT' | 'ADMIN'
  created_at: Timestamp
}

type Child = {
  id: Id
  parent_id: Id
  name: string
  dob: DateStr
  age_years: number             // int, computed (§5.4.3)
  notes: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

type CmsSection = {
  id: Id
  page_slug: 'home' | 'who-we-are' | 'our-approach'
  section_key: string           // one of §5.7 for that page
  title: string | null          // admin-facing label; NOT rendered on public pages
  body: object                  // shape fixed per (page_slug, section_key), §5.7
  image_url: string | null      // rendered only by founder_message (portrait); ignored elsewhere
  sort_order: number            // int
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

type CmsPage = {
  page_slug: 'home' | 'who-we-are' | 'our-approach'
  sections: CmsSection[]        // active, non-deleted; ORDER BY sort_order ASC, id ASC
}

type WeekendClass = {
  id: Id
  title: string
  description: string
  location: string
  image_url: string | null
  age_min: number               // int 0–12
  age_max: number               // int age_min–12
  age_range: string             // "3–6" (U+2013)
  date: DateStr
  start_time: TimeStr
  end_time: TimeStr
  time_slot: string             // "09:30–11:30" (U+2013)
  fee_idr: Idr
  capacity: number              // int ≥ 1
  seats_booked: number          // int = count of this class's enrollments with status ≠ CANCELLED
  seats_left: number            // capacity − seats_booked (≥ 0)
  is_full: boolean              // seats_left === 0
  is_upcoming: boolean          // class start (WIB) > now
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
  created_at: Timestamp
  updated_at: Timestamp
}

type ClassList = {
  items: WeekendClass[]         // ORDER BY date ASC, start_time ASC, id ASC
  locations: string[]           // distinct `location` of ALL publicly listable classes (ignores filters), sorted case-insensitively ASC
}

type PlayKit = {
  id: Id
  name: string
  category: Domain
  description: string
  image_url: string | null
  price_idr: Idr
  stock: number                 // int ≥ 0
  badge_tag: string | null      // e.g. "Favorit", "Baru"
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

type OrderItem = {
  id: Id
  type: 'KIT' | 'CLASS'
  name: string                          // snapshot taken at checkout (kit name / class title)
  kit_id: Id | null                     // non-null iff type = KIT
  class_id: Id | null                   // non-null iff type = CLASS
  child_id: Id | null                   // non-null iff type = CLASS
  child_name: string | null             // live (incl. soft-deleted child); non-null iff CLASS
  class_date: DateStr | null            // live; non-null iff CLASS
  class_time_slot: string | null        // live; non-null iff CLASS
  class_location: string | null         // live; non-null iff CLASS
  enrollment_status: EnrollmentStatus | null   // non-null iff CLASS
  unit_price_idr: Idr                   // snapshot
  quantity: number                      // int; KIT 1–10, CLASS always 1
  line_total_idr: Idr                   // unit_price_idr × quantity
}

type Order = {
  id: Id
  order_code: string                    // "RUMI-2026-0001" (§5.9.2)
  parent_id: Id
  parent_name: string                   // live users.full_name
  parent_email: string                  // live users.email
  status: 'PENDING_WA' | 'PAID' | 'CANCELLED'
  total_amount_idr: Idr                 // Σ line_total_idr
  delivery_name: string
  delivery_phone: string                // normalized "62…"
  delivery_address: string | null       // null when the order has no KIT item
  notes: string | null
  items: OrderItem[]                    // ORDER BY id ASC (= request order)
  wa_url: string                        // §5.9.3, rebuilt from the stored message + current RUMI_ADMIN_WA_PHONE
  expires_at: Timestamp | null          // created_at + PENDING_ORDER_TTL_HOURS while PENDING_WA; else null
  paid_at: Timestamp | null
  cancelled_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

type CheckoutResult = { order: Order, wa_url: string }   // wa_url === order.wa_url

type Enrollment = {
  id: Id
  class_id: Id
  class_title: string
  class_date: DateStr
  class_time_slot: string
  class_location: string
  child_id: Id
  child_name: string
  order_id: Id | null
  order_code: string | null
  status: EnrollmentStatus
  created_at: Timestamp
  updated_at: Timestamp
}

type Assessment = {
  id: Id
  child_id: Id
  class_id: Id | null
  class_title: string | null
  assessor_id: Id
  assessor_name: string
  domain: Domain
  level: 1 | 2 | 3 | 4
  milestone: string
  notes: string | null
  observed_on: DateStr
  created_at: Timestamp
}

type DomainLevel = {                    // "latest level per domain"
  domain: Domain
  level: 1 | 2 | 3 | 4 | null           // from the assessment with max (observed_on, id) for that domain; null if none
  observed_on: DateStr | null
  milestone: string | null
}

type AttendanceSummary = {
  attended: number                      // count ATTENDED
  absent: number                        // count ABSENT
  upcoming: number                      // count RESERVED|CONFIRMED whose class is upcoming
  attendance_rate_pct: number | null    // round(attended×100/(attended+absent)); null when attended+absent = 0
}

type ChildReport = {
  child: Child
  latest_levels: DomainLevel[]          // exactly 5, canonical Domain order
  assessments: Assessment[]             // ORDER BY observed_on DESC, id DESC
  attendance: AttendanceSummary
  enrollments: Enrollment[]             // ORDER BY class_date DESC, start_time DESC, id DESC
  generated_at: Timestamp
}

type StudentSummary = {
  id: Id                                // child id
  name: string
  dob: DateStr
  age_years: number
  parent_id: Id
  parent_name: string
  parent_email: string
  parent_phone_wa: string
  active_enrollments: number            // count RESERVED|CONFIRMED
  attendance: AttendanceSummary
  latest_assessment_on: DateStr | null
  created_at: Timestamp
}

type StudentDetail = ChildReport & { parent: User }   // keys: child, parent, latest_levels, assessments, attendance, enrollments, generated_at

type MonthRevenue = { month: string /* "YYYY-MM" (WIB) */, revenue_idr: Idr }
type LowStockKit = { id: Id, name: string, category: Domain, stock: number }
type ClassFill = {
  id: Id, title: string, date: DateStr, time_slot: string, location: string,
  status: ClassStatus, capacity: number, seats_booked: number, seats_left: number,
  fill_rate_pct: number                 // round(seats_booked×100/capacity)
}

type Metrics = {
  total_revenue_idr: Idr                // Σ total_amount_idr WHERE status = PAID
  paid_orders: number                   // count PAID
  pending_orders: number                // count PENDING_WA
  pending_amount_idr: Idr               // Σ total_amount_idr WHERE status = PENDING_WA
  enrolled_students: number             // distinct non-deleted children with ≥1 enrollment in CONFIRMED|ATTENDED|ABSENT
  revenue_by_month: MonthRevenue[]      // exactly 6: the current WIB month and the 5 before it, oldest first, zero-filled; bucketed by paid_at (WIB) of PAID orders
  low_stock_kits: LowStockKit[]         // active, non-deleted, stock ≤ LOW_STOCK_THRESHOLD; ORDER BY stock ASC, name ASC
  upcoming_classes: ClassFill[]         // non-deleted, status OPEN|CLOSED, upcoming; ORDER BY date, start_time, id; LIMIT 5
  generated_at: Timestamp
}

type Paginated<T> = {
  items: T[]
  meta: { page: number, per_page: number, total: number }   // total = rows matching the filter
}

type Health = { status: 'ok', version: string }   // version = CARGO_PKG_VERSION
```

### 5.7 CMS registry and body shapes

The registry is **fixed**:
- `page_slug` must be one of the three pages below, and `section_key` must be one of the keys listed for that page. Any other pair returns `422`.
- Each pair has exactly one shape. The server validates `body` **strictly**:
  - every listed key is required, and unknown keys return `422`;
  - text limits are `short` = 1–120 characters and `long` = 1–1000 characters, both measured after trimming;
  - the serialized `body` may be at most 16 KiB.
- `T | null` means the key is required but may be `null`.

```ts
type Tone = 'teal' | 'orange' | 'yellow'
type IconName = 'heart' | 'hands' | 'sparkles' | 'moon' | 'sun' | 'star' | 'leaf' | 'book'

type HeroBody = {            // home / hero
  eyebrow: short
  heading: short             // rendered as "{heading} {heading_highlight}"
  heading_highlight: short   // the highlighted (primary-colored) tail of the h1
  subheading: long
  art_badge: short           // pill inside the hero art
  art_caption: short         // large caption inside the hero art
  art_motto: short           // text inside the orange circle
  social_proof: short | null
}
type RumiWayBody = {         // home / rumi_way  ("Cara RUMI")
  eyebrow: short, heading: short, intro: long
  cards: { icon: IconName, tone: Tone, title: short, text: long }[]   // 1–6
}
type FounderMessageBody = {  // who-we-are / founder_message
  eyebrow: short, heading: short
  paragraphs: long[]         // 1–6
  signature_name: short, signature_role: short
}
type ProseBody = {           // who-we-are / philosophy, our-approach / intro
  eyebrow: short, heading: short
  paragraphs: long[]         // 1–6
}
type MissionBody = {         // who-we-are / mission
  eyebrow: short, heading: short, statement: long
  points: long[]             // 1–8
}
type EducatorsBody = {       // who-we-are / educators
  eyebrow: short, heading: short, intro: long
  people: { name: short, role: short, bio: long, initials: string /* 1–3 uppercase letters A–Z */, tone: Tone }[]   // 1–12
}
type DomainsBody = {         // our-approach / domains
  eyebrow: short, heading: short, intro: long
  items: { domain: Domain, title: short, summary: long, activities: short[] /* 1–6 */ }[]   // 1–5, domain unique
}
type ValuesBody = {          // our-approach / values
  eyebrow: short, heading: short, intro: long
  items: { icon: IconName, title: short, arabic: short | null, text: long }[]   // 1–8
}
```

| `page_slug` | `section_key` | Body type | Seed `title` | Seed `sort_order` |
|---|---|---|---|---|
| `home` | `hero` | `HeroBody` | Hero Beranda | 10 |
| `home` | `rumi_way` | `RumiWayBody` | Cara RUMI | 20 |
| `who-we-are` | `founder_message` | `FounderMessageBody` | Pesan Pendiri | 10 |
| `who-we-are` | `philosophy` | `ProseBody` | Filosofi | 20 |
| `who-we-are` | `mission` | `MissionBody` | Misi | 30 |
| `who-we-are` | `educators` | `EducatorsBody` | Para Pendamping | 40 |
| `our-approach` | `intro` | `ProseBody` | Pengantar Pendekatan | 10 |
| `our-approach` | `domains` | `DomainsBody` | Lima Ranah | 20 |
| `our-approach` | `values` | `ValuesBody` | Nilai Islami | 30 |

**Frontend icon mapping** (lucide):

| `IconName` | lucide icon |
|---|---|
| `heart` | `Heart` |
| `hands` | `HandHeart` |
| `sparkles` | `Sparkles` |
| `moon` | `Moon` |
| `sun` | `Sun` |
| `star` | `Star` |
| `leaf` | `Leaf` |
| `book` | `BookOpen` |

`Tone` maps to soft-tint tokens (see `DESIGN.md`).

**Rendering rules:**
- A public page renders only the section keys it knows, in `sort_order`.
- A known key that is missing (deleted or inactive) is simply not rendered, and the page must not crash.
- Text from `arabic` is rendered with `lang="ar" dir="rtl"`.

The seed bodies are in §5.11.3.

### 5.8 Endpoints

#### 5.8.1 Index

| # | Method | Path | Access | Request | Success |
|---|---|---|---|---|---|
| 1 | GET | `/api/health` | public | — | `200 Health` |
| 2 | GET | `/api/cms/{page_slug}` | public | — | `200 CmsPage` |
| 3 | GET | `/api/classes` | public | query | `200 ClassList` |
| 4 | GET | `/api/classes/{id}` | public | — | `200 WeekendClass` |
| 5 | GET | `/api/kits` | public | query | `200 PlayKit[]` |
| 6 | GET | `/api/kits/{id}` | public | — | `200 PlayKit` |
| 7 | POST | `/api/auth/register` | public, rate-limited | `RegisterBody` | `201 { user: User, child: Child }` + cookie |
| 8 | POST | `/api/auth/login` | public, rate-limited | `LoginBody` | `200 { user: User }` + cookie |
| 9 | POST | `/api/auth/logout` | public | — | `200 null` + clear cookie |
| 10 | GET | `/api/auth/me` | public | — | `200 { user: User \| null }` |
| 11 | POST | `/api/auth/forgot-password` | public, rate-limited | `{ email }` | `200 null` |
| 12 | POST | `/api/auth/reset-password` | public, rate-limited | `{ token, password }` | `200 null` + clear cookie |
| 13 | GET | `/api/me/children` | PARENT | — | `200 Child[]` |
| 14 | POST | `/api/me/children` | PARENT | `ChildInput` | `201 Child` |
| 15 | PATCH | `/api/me/children/{id}` | PARENT | `ChildPatch` | `200 Child` |
| 16 | DELETE | `/api/me/children/{id}` | PARENT | — | `200 null` |
| 17 | GET | `/api/me/children/{id}/assessments` | PARENT | — | `200 Assessment[]` |
| 18 | GET | `/api/me/children/{id}/enrollments` | PARENT | — | `200 Enrollment[]` |
| 19 | GET | `/api/me/children/{id}/report` | PARENT | — | `200 ChildReport` |
| 20 | GET | `/api/me/orders` | PARENT | — | `200 Order[]` |
| 21 | POST | `/api/orders` | PARENT | `CheckoutBody` | `201 CheckoutResult` (replay: `200`) |
| 22 | GET | `/api/admin/metrics` | ADMIN | — | `200 Metrics` |
| 23 | GET | `/api/admin/cms` | ADMIN | query | `200 CmsSection[]` |
| 24 | POST | `/api/admin/cms` | ADMIN | `CmsCreate` | `201 CmsSection` |
| 25 | PATCH | `/api/admin/cms/{id}` | ADMIN | `CmsPatch` | `200 CmsSection` |
| 26 | DELETE | `/api/admin/cms/{id}` | ADMIN | — | `200 null` |
| 27 | GET | `/api/admin/classes` | ADMIN | query | `200 WeekendClass[]` |
| 28 | POST | `/api/admin/classes` | ADMIN | `ClassCreate` | `201 WeekendClass` |
| 29 | PATCH | `/api/admin/classes/{id}` | ADMIN | `ClassPatch` | `200 WeekendClass` |
| 30 | DELETE | `/api/admin/classes/{id}` | ADMIN | — | `200 null` |
| 31 | GET | `/api/admin/kits` | ADMIN | query | `200 PlayKit[]` |
| 32 | POST | `/api/admin/kits` | ADMIN | `KitCreate` | `201 PlayKit` |
| 33 | PATCH | `/api/admin/kits/{id}` | ADMIN | `KitPatch` | `200 PlayKit` |
| 34 | DELETE | `/api/admin/kits/{id}` | ADMIN | — | `200 null` |
| 35 | GET | `/api/admin/students` | ADMIN | query | `200 Paginated<StudentSummary>` |
| 36 | GET | `/api/admin/students/{id}` | ADMIN | — | `200 StudentDetail` |
| 37 | POST | `/api/admin/assessments` | ADMIN | `AssessmentCreate` | `201 Assessment` |
| 38 | PATCH | `/api/admin/enrollments/{id}` | ADMIN | `{ status }` | `200 Enrollment` |
| 39 | GET | `/api/admin/orders` | ADMIN | query | `200 Paginated<Order>` |
| 40 | PATCH | `/api/admin/orders/{id}/status` | ADMIN | `{ status }` | `200 Order` |

**Errors that apply to every endpoint** and are not repeated below:
- `400 bad_request`, `413 payload_too_large` and `422 validation_error` on any endpoint that takes a body or a query
- `401 unauthorized` and `403 forbidden` on any non-public endpoint
- `403 origin_mismatch` on any mutating method
- `404 not_found` on any endpoint with an `{id}`
- `500 internal` and `503 unavailable` on every endpoint

#### 5.8.2 Public

**#1 `GET /api/health`**
- Runs `SELECT 1`.
- Success: `200 { status: "ok", version }`.
- If the DB fails, the response is `503 unavailable`.

**#2 `GET /api/cms/{page_slug}`**
- `page_slug` must be in the registry; otherwise `404`.
- Returns `CmsPage`. A page with no active sections returns `sections: []`.

**#3 `GET /api/classes`**

A class is listed when all of these hold:
- it is not deleted;
- its `status` is `OPEN`;
- it is upcoming.

Query parameters (all optional; a bad value returns `422` with `fields.<param>`):

| Param | Type | Rule |
|---|---|---|
| `location` | string ≤ 160 | An **exact** match on `location`, ignoring case |
| `from` | `DateStr` | `date ≥ from` |
| `to` | `DateStr` | `date ≤ to`. If `from > to`, the response is `422` |
| `age` | int 0–12 | `age_min ≤ age ≤ age_max` |

Success: `200 ClassList`.

**#4 `GET /api/classes/{id}`**
- Visible when the class is not deleted and its `status ≠ DRAFT`. Past and cancelled classes are visible, so the cart and the enrollment views can explain their state.
- Otherwise `404`.

**#5 `GET /api/kits`**
- Lists kits that are not deleted and have `is_active = true`. Out-of-stock kits are **included**.
- Optional query: `category` must be a `Domain`; otherwise `422`.
- Ordered by `created_at DESC, id DESC`.

**#6 `GET /api/kits/{id}`**
- Visible when the kit is not deleted and `is_active = true`.
- Otherwise `404`.

#### 5.8.3 Auth

```ts
type ChildInput = {
  name: string              // 1–80
  dob: DateStr              // ≤ today (WIB); resulting age_years ≤ 12
  notes?: string | null     // ≤ 500
}
type RegisterBody = {
  parent: {
    full_name: string       // 2–100
    email: string           // §5.4.5
    phone_wa: string        // §5.4.6
    password: string        // §5.4.7
  }
  child: ChildInput
}
type LoginBody = { email: string, password: string }   // email normalized; password 1–128
```

**#7 `POST /api/auth/register`**
- Creates the `PARENT` user and the first child in **one transaction**. The role is never read from the body.
- Creates a session and sets the cookie.
- Success: `201 { user, child }`.
- Errors: `409 email_taken`, `429 rate_limited`.

**#8 `POST /api/auth/login`**
- Success: `200 { user }`, and the cookie is set.
- Errors: `401 invalid_credentials`, `429 rate_limited`.
- A soft-deleted user gets `invalid_credentials`.

**#9 `POST /api/auth/logout`**
- Deletes the session named by the cookie, if there is one, and always clears the cookie.
- Always returns `200 null`.

**#10 `GET /api/auth/me`**
- Returns `200 { user: User }` for a valid session.
- Returns `200 { user: null }` when there is no valid session. It **never** returns 401.
- The frontend auth store bootstraps from this call.

**#11 `POST /api/auth/forgot-password`**
- Body: `{ email: string }`.
- An email in the wrong format gets `422`.
- Otherwise the response is **always** `200 null`, whether or not the email exists.
- If an active user has that email:
  1. Create a single-use token (32 CSPRNG bytes, base64url) that lives **60 minutes**. Only its SHA-256 is stored.
  2. Call `Notifier::send_password_reset(email, url)` with `url = {base}/reset-password?token={token}`. `{base}` is `PUBLIC_BASE_URL` with any trailing `/` removed; if it is empty, `{base}` is `http://localhost:{APP_PORT}`.
- Errors: `429 rate_limited`.

**#12 `POST /api/auth/reset-password`**
- Body: `{ token: string /* 1–200 */, password: string /* §5.4.7 */ }`.
- A token that is unknown, expired or already used gets `422 invalid_token`.
- On success the server:
  1. sets the new password hash;
  2. marks the token used;
  3. **deletes every session of that user**;
  4. clears the cookie.
- It does **not** sign the user in.
- Success: `200 null`.
- Errors: `429 rate_limited`.

#### 5.8.4 Parent

```ts
type ChildPatch = { name?: string, dob?: DateStr, notes?: string | null }   // rules as ChildInput
```

**#13 `GET /api/me/children`**
- Returns the caller's children that are not deleted.
- Ordered by `created_at ASC, id ASC`.

**#14 `POST /api/me/children`**
- Body: `ChildInput`.
- Success: `201 Child`.

**#15 `PATCH /api/me/children/{id}`**
- Body: `ChildPatch`.
- Success: `200 Child`.

**#16 `DELETE /api/me/children/{id}`**
- A soft delete that sets `deleted_at`.
- If the child has any enrollment with status `RESERVED` or `CONFIRMED`, the response is `409 conflict` with the message "Anak masih memiliki kelas aktif."
- Success: `200 null`.

**#17 `GET /api/me/children/{id}/assessments`**
- Ordered by `observed_on DESC, id DESC`.

**#18 `GET /api/me/children/{id}/enrollments`**
- All statuses are included.
- Ordered by `class_date DESC, start_time DESC, id DESC`.

**#19 `GET /api/me/children/{id}/report`**
- Returns `ChildReport` (§5.6).

**#20 `GET /api/me/orders`**
- Returns the caller's orders.
- Ordered by `created_at DESC, id DESC`.

**#21 `POST /api/orders`** (checkout)

```ts
type CheckoutItem =
  | { type: 'KIT', kit_id: Id, quantity: number /* int 1–10 */ }
  | { type: 'CLASS', class_id: Id, child_id: Id }
type CheckoutBody = {
  idempotency_key: string   // UUID ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$, stored lowercase
  items: CheckoutItem[]     // 1–20; no two KIT items with the same kit_id; no two CLASS items with the same (class_id, child_id)
  delivery: {
    name: string            // 2–100
    phone_wa: string        // §5.4.6
    address?: string | null // ≤ 500; REQUIRED (non-empty) iff any KIT item; ignored and stored null when there is no KIT item
  }
  notes?: string | null     // ≤ 500
}
```

- Success: `201 CheckoutResult` for a new order, or `200 CheckoutResult` for an idempotent replay.
- Errors: `404 not_found` when a `child_id` is not the caller's; `409 item_unavailable | already_enrolled | class_full | out_of_stock`.
- The full algorithm is in §5.9.1.

#### 5.8.5 Admin

**#22 `GET /api/admin/metrics`**
- Returns `Metrics` (§5.6).

**CMS (#23–#26):**

```ts
type CmsCreate = {
  page_slug: string; section_key: string                 // must be a registry pair (§5.7)
  title?: string | null                                  // ≤ 120
  body: object                                           // validated against the pair's shape
  image_url?: string | null                              // §5.8.6
  sort_order?: number                                    // int −1000–1000, default 0
  is_active?: boolean                                    // default true
}
type CmsPatch = { title?, body?, image_url?, sort_order?, is_active? }   // page_slug/section_key are immutable (ignored if sent)
```

| # | Endpoint | Rules |
|---|---|---|
| 23 | `GET /api/admin/cms` | Optional `page_slug` filter (must be a registry page). Includes inactive sections and excludes deleted ones. Ordered by `page_slug ASC, sort_order ASC, id ASC` |
| 24 | `POST /api/admin/cms` | A live (not deleted) row with the same pair gets `409 conflict`. Success: `201` |
| 25 | `PATCH /api/admin/cms/{id}` | `body` is validated against the row's own pair |
| 26 | `DELETE /api/admin/cms/{id}` | Soft delete. The pair can then be created again |

**Classes (#27–#30):**

```ts
type ClassCreate = {
  title: string             // 3–120
  description: string       // 1–2000
  location: string          // 3–160
  image_url?: string | null // §5.8.6
  age_min: number           // int 0–12
  age_max: number           // int age_min–12
  date: DateStr
  start_time: TimeStr
  end_time: TimeStr         // > start_time
  fee_idr: Idr              // 0–100_000_000
  capacity: number          // int 1–200
  status?: ClassStatus      // default 'DRAFT'
}
type ClassPatch = Partial<ClassCreate>   // seats_booked is never patchable
```

| # | Endpoint | Rules |
|---|---|---|
| 27 | `GET /api/admin/classes` | Optional `status` filter. Every status and past classes are included; deleted classes are excluded. Ordered by `date DESC, start_time DESC, id DESC` |
| 28 | `POST /api/admin/classes` | The class start must be upcoming; otherwise `422` with `fields.date` |
| 29 | `PATCH /api/admin/classes/{id}` | See the rules below |
| 30 | `DELETE /api/admin/classes/{id}` | Soft delete. Blocked with `409 conflict` while the class has any `RESERVED` or `CONFIRMED` enrollment |

Rules for #29 (`PATCH /api/admin/classes/{id}`):
- If `date` or `start_time` is present, the resulting start must be upcoming; otherwise `422`.
- The resulting `age_max` must be `≥ age_min`, and `end_time` must be `> start_time`.
- `capacity` must be at least `seats_booked`; otherwise `422` with `fields.capacity`.
- Setting `status` to `CANCELLED` or `DRAFT` while the class has any `RESERVED` or `CONFIRMED` enrollment gets `409 conflict`, with the message "Batalkan pesanan terkait terlebih dahulu."

**Kits (#31–#34):**

```ts
type KitCreate = {
  name: string              // 2–120
  category: Domain
  description: string       // 1–2000
  image_url?: string | null // §5.8.6
  price_idr: Idr            // 0–100_000_000
  stock: number             // int 0–100_000
  badge_tag?: string | null // ≤ 24
  is_active?: boolean       // default true
}
type KitPatch = Partial<KitCreate>
```

| # | Endpoint | Rules |
|---|---|---|
| 31 | `GET /api/admin/kits` | Optional `category` filter. Includes inactive kits and excludes deleted ones. Ordered by `created_at DESC, id DESC` |
| 32 | `POST /api/admin/kits` | Success: `201` |
| 33 | `PATCH /api/admin/kits/{id}` | `stock` is set directly; last write wins |
| 34 | `DELETE /api/admin/kits/{id}` | Soft delete. Pending orders still release stock correctly if they are cancelled |

**Students (#35–#36):**

**#35 `GET /api/admin/students`** returns a *Paginated* list (§5.4.10) of children that are not deleted.
- `q` (§5.4.11) matches the child's name, the parent's `full_name` or the parent's email.
- Ordered by `name ASC, id ASC`.

**#36 `GET /api/admin/students/{id}`** returns `StudentDetail` for a child that is not deleted.

**Assessments and attendance (#37–#38):**

```ts
type AssessmentCreate = {
  child_id: Id              // non-deleted child; else 404
  class_id?: Id | null      // if set: non-deleted class; else 404
  domain: Domain
  level: number             // int 1–4
  milestone: string         // 1–200
  notes?: string | null     // ≤ 1000
  observed_on: DateStr      // ≤ today (WIB)
}
```

**#37 `POST /api/admin/assessments`**
- `assessor_id` is the calling admin.
- Success: `201 Assessment`.

**#38 `PATCH /api/admin/enrollments/{id}`**
- Body: `{ status: 'ATTENDED' | 'ABSENT' }`. Any other value gets `422`.
- The transition rules are in §5.9.5.
- Success: `200 Enrollment`.

**Orders (#39–#40):**

**#39 `GET /api/admin/orders`** returns a *Paginated* list.
- Optional `status` filter, which must be an `OrderStatus`.
- `q` matches `order_code`, the parent's `full_name` or the parent's email.
- Ordered by `created_at DESC, id DESC`.

**#40 `PATCH /api/admin/orders/{id}/status`**
- Body: `{ status: 'PAID' | 'CANCELLED' }`. Any other value, including `PENDING_WA`, gets `422`.
- The transition rules are in §5.9.4.
- Success: `200 Order`.
- Errors: `409 invalid_transition`.

#### 5.8.6 Shared field rule: `image_url`

`image_url` is either `null` or a string of at most 500 characters that starts with `https://` or with `/` (a same-origin path such as `/brand/…`). Anything else gets `422`.

### 5.9 Business rules

#### 5.9.1 Checkout (`POST /api/orders`)

The steps run in this order, and the first failure wins:

1. **Auth.** The caller must be `PARENT`. Then the body is parsed (§5.1).
2. **Idempotent replay.** If an order exists with `(parent_id, idempotency_key)`, the server returns `200 { order, wa_url }` for it **as it is now**. The status may already be `PAID` or `CANCELLED`. Nothing else is checked, and nothing is changed.
3. **Field validation** (`422`). This covers the rules in §5.8.4: item count, duplicates, quantities, delivery fields, address-if-kit and notes.
4. **Ownership.** Every `child_id` must belong to the caller and not be deleted. Otherwise `404 not_found` ("Data anak tidak ditemukan.").
5. **Transaction.** One `BEGIN IMMEDIATE` transaction handles the items in request order. On the first failure everything rolls back, so nothing is reserved.
   - **CLASS item:**
     1. If the class is missing, deleted, not `OPEN` or not upcoming → `409 item_unavailable`.
     2. If the child has a non-`CANCELLED` enrollment in that class → `409 already_enrolled`.
     3. Run `UPDATE weekend_classes SET seats_booked = seats_booked + 1 WHERE id = ? AND seats_booked < capacity AND …` (repeating step 1's conditions). If 0 rows change → `409 class_full`.
     4. The snapshot is the class `title` at `unit_price_idr = fee_idr` and `quantity = 1`.
   - **KIT item:**
     1. If the kit is missing, deleted or `is_active = false` → `409 item_unavailable`.
     2. Run `UPDATE play_kits SET stock = stock - ? WHERE id = ? AND stock >= ? AND …`. If 0 rows change → `409 out_of_stock`, and the message names the stock that is left.
     3. The snapshot is the kit `name` at `unit_price_idr = price_idr`, with `line_total_idr = price_idr × quantity`.
   - Next, the server computes `total_amount_idr = Σ line_total_idr`, which may be 0.
   - It allocates the order code (§5.9.2) and builds the WhatsApp message (§5.9.3).
   - It inserts the `orders` row with status `PENDING_WA`, stores the raw message in `wa_message_payload`, and inserts the `order_items` in request order.
   - For each CLASS item it inserts one `class_enrollments` row with status **`RESERVED`**.
   - Then it commits.
6. The response is `201 { order, wa_url }`.

**Concurrent duplicates.** Two concurrent requests can carry the same key. When the second one hits the `UNIQUE(parent_id, idempotency_key)` violation, it rolls back, reads the winning order, and returns `200` with it.

**Ignored client fields.** Client-supplied prices and totals are ignored (§5.1).

#### 5.9.2 Order code

- The format is `RUMI-{YYYY}-{NNNN}`:
  - `YYYY` is the order-code year (WIB);
  - `NNNN` is the sequence within that year, zero-padded to 4 digits. From 10000 on it is printed at its natural width.
- Allocation runs inside the checkout transaction: `INSERT INTO order_code_counters(year, last_seq) VALUES (?, 1) ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`.
- A replay never allocates a code.
- A rolled-back checkout does not use up a sequence number, because the counter update rolls back with it.

#### 5.9.3 WhatsApp message and URL

The message is a pure function of the order. Lines are joined with `\n` (LF), with no trailing newline. The exact template is below; `⏎` marks an empty line.

```
Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #{order_code}.
⏎
Nama Orang Tua: {parent.full_name}
Nama Anak: {child names}
No. WhatsApp: {delivery.phone_wa}
Total: {format_rupiah(total_amount_idr)}
⏎
Detail:
{one line per item, in item order}
⏎
Penerima: {delivery.name}
Alamat: {delivery.address}            ← line omitted when address is null
Catatan: {notes}                      ← line omitted when notes is null
⏎
Mohon info pembayarannya. Terima kasih.
```

**Placeholders and item lines:**
- `{child names}` lists the distinct child names of the CLASS items, in order of first appearance, joined with `", "`. It is `-` when there is no CLASS item.
- A CLASS item line is `- Kelas {title} ({child name}) · {tanggal} · {time_slot} WIB · {location} · {format_rupiah(line_total_idr)}`.
- A KIT item line is `- Kit {name} ×{quantity} · {format_rupiah(line_total_idr)}`.

**Separators:**
- `·` is U+00B7 MIDDLE DOT, with one space on each side.
- `×` is U+00D7.
- The apostrophe in *Assalamu'alaikum* is ASCII `'`.

**`{tanggal}`** is `{Hari}, {d} {Bulan} {yyyy}`, with no leading zero on the day, for example `Sabtu, 14 November 2026`.
- Day names: `Minggu`, `Senin`, `Selasa`, `Rabu`, `Kamis`, `Jumat`, `Sabtu`.
- Month names: `Januari`, `Februari`, `Maret`, `April`, `Mei`, `Juni`, `Juli`, `Agustus`, `September`, `Oktober`, `November`, `Desember`.

**URL:** `wa_url = "https://wa.me/" + RUMI_ADMIN_WA_PHONE (normalized digits) + "?text=" + pct(message)`.
- `pct` percent-encodes the UTF-8 bytes of **every** character except the RFC 3986 unreserved set `A–Z a–z 0–9 - _ . ~`.
- Hex digits are uppercase.
- So a space becomes `%20` (**never `+`**), a newline `%0A`, `'` becomes `%27`, `#` becomes `%23`, and `·` becomes `%C2%B7`.
- Only the backend builds this URL. The frontend only opens it.

*(example)* The data:
- parent Nadia Rahman with child Amina;
- class "Bulan & Gerak" on 2026-11-14, 09:30–11:30, at Rp 200.000;
- 2 × "Nampan Tangan Kecil" at Rp 185.000 each;
- address given and no notes.

The resulting message:

```
Assalamu'alaikum Admin RUMI, saya ingin konfirmasi pesanan #RUMI-2026-0001.

Nama Orang Tua: Nadia Rahman
Nama Anak: Amina
No. WhatsApp: 6281211112222
Total: Rp 570.000

Detail:
- Kelas Bulan & Gerak (Amina) · Sabtu, 14 November 2026 · 09:30–11:30 WIB · Rumah Teduh, Kemang (Jakarta Selatan) · Rp 200.000
- Kit Nampan Tangan Kecil ×2 · Rp 370.000

Penerima: Nadia Rahman
Alamat: Jl. Kemang Raya 12, Jakarta Selatan

Mohon info pembayarannya. Terima kasih.
```

The URL with `RUMI_ADMIN_WA_PHONE=6281234567890` starts with:
`https://wa.me/6281234567890?text=Assalamu%27alaikum%20Admin%20RUMI%2C%20saya%20ingin%20konfirmasi%20pesanan%20%23RUMI-2026-0001.%0A%0ANama%20Orang%20Tua%3A%20Nadia%20Rahman%0A…`

The class line encodes to `-%20Kelas%20Bulan%20%26%20Gerak%20%28Amina%29%20%C2%B7%20Sabtu%2C%2014%20November%202026%20%C2%B7%2009%3A30%E2%80%9311%3A30%20WIB%20%C2%B7%20…`.

#### 5.9.4 Order state machine (`PATCH /api/admin/orders/{id}/status`, plus the sweep)

All the changes for one transition happen in one transaction.

| From → To | Effects |
|---|---|
| `PENDING_WA` → `PAID` | Set `paid_at = now`. The order's enrollments in `RESERVED` become `CONFIRMED` |
| `PENDING_WA` → `CANCELLED` | Set `cancelled_at = now`. Each KIT item puts `quantity` back into `stock`. Each CLASS enrollment in `RESERVED` or `CONFIRMED` becomes `CANCELLED` and gives back one seat (`seats_booked − 1`) |
| `PAID` → `CANCELLED` | The same effects. Enrollments already in `ATTENDED` or `ABSENT` **stay unchanged and keep their seat**, because they are historical facts |
| anything else | `409 invalid_transition`. This covers the same status, any change out of `CANCELLED`, and `PAID` → `PAID` |

- Stock and seats are released even when the kit or class has since been soft-deleted or closed.
- **Seat invariant (always true):** `weekend_classes.seats_booked` equals the count of that class's `class_enrollments` with `status ≠ 'CANCELLED'`, and `0 ≤ seats_booked ≤ capacity`.

#### 5.9.5 Enrollment and attendance (`PATCH /api/admin/enrollments/{id}`)

| Rule | Detail |
|---|---|
| Allowed when | the current status is `CONFIRMED`, `ATTENDED` or `ABSENT` **and** the class `date ≤ today` (WIB) |
| Allowed targets | `ATTENDED` or `ABSENT`. An admin may switch between the two to correct a mistake |
| Same status | Returns `200` with the enrollment unchanged |
| `RESERVED` or `CANCELLED` | `409 invalid_transition`. An unpaid seat must be marked `PAID` on its order first |
| Class date in the future | `409 invalid_transition`, with the message "Kehadiran hanya dapat dicatat pada atau setelah tanggal kelas." |

#### 5.9.6 Sweep task (every `SWEEP_INTERVAL_SECONDS`)

1. Cancel every `PENDING_WA` order where `now ≥ created_at + PENDING_ORDER_TTL_HOURS`, using exactly the §5.9.4 `PENDING_WA → CANCELLED` effects.
2. Delete `auth_sessions` rows that have expired.
3. Delete `password_resets` rows that expired, or that were used more than 24 hours ago.
4. Evict rate-limit buckets that have been idle for at least 10 minutes.

### 5.10 Configuration (environment)

The app never crashes because a variable is missing. It falls back to a safe default and logs a `WARN` where noted.

| Variable | Default | Meaning |
|---|---|---|
| `APP_PORT` | `8080` | HTTP listen port |
| `APP_BIND_HOST` | `0.0.0.0` | Bind address |
| `DATABASE_PATH` | `data/rumi.db` | SQLite file. The path is relative to the process cwd, and the parent directory is created if it is missing |
| `STATIC_DIR` | `dist` | Built SPA, relative to cwd. For a local full-stack run from `backend/`, use `STATIC_DIR=../dist` |
| `PUBLIC_BASE_URL` | `""` | e.g. `https://rumi-stg.kasibah.com`. Used for reset links, the Origin allow-list and `COOKIE_SECURE=auto` |
| `RUMI_ADMIN_WA_PHONE` | `6281234567890` | The admin's WhatsApp number for `wa.me`, normalized per §5.4.6. If it is invalid, the server falls back to the default and logs a WARN |
| `ADMIN_EMAIL` | `""` | Bootstrap admin email (§5.11.1) |
| `ADMIN_PASSWORD` | `""` | Bootstrap admin password, at least 8 characters. A shorter one is refused with an ERROR log, and no admin is created |
| `SEED_DEMO` | `false` | When `true`, adds the demo accounts and data (§5.11.4) |
| `PENDING_ORDER_TTL_HOURS` | `48` | Auto-cancel window for `PENDING_WA` orders |
| `SESSION_TTL_DAYS` | `30` | Session and cookie lifetime |
| `AUTH_RATE_LIMIT_PER_MIN` | `10` | Bucket size and refill per minute, per (endpoint, IP) |
| `COOKIE_SECURE` | `auto` | `true`, `false` or `auto`. `auto` adds `Secure` when `PUBLIC_BASE_URL` starts with `https://` or the request has `X-Forwarded-Proto: https` |
| `SWEEP_INTERVAL_SECONDS` | `300` | How often the sweep task runs |
| `RUST_LOG` | `info` | tracing `EnvFilter` |

### 5.11 Seed data

#### 5.11.1 Seeding rules (when they run)

Seeding runs at startup after migrations, and from `cargo run --bin seed`. Every step is idempotent.

**Catalog.** If a table has no rows at all, deleted rows included, its catalog seed is inserted:
- `cms_content` gets §5.11.3;
- `weekend_classes` gets §5.11.2;
- `play_kits` gets §5.11.2.

The catalog is seeded in **every** environment.

**Admin bootstrap.** This runs only when no `ADMIN` user exists:

| Condition | Result |
|---|---|
| `ADMIN_EMAIL` and `ADMIN_PASSWORD` are both set | Create the admin with `full_name "Admin RUMI"` and `phone_wa` = `RUMI_ADMIN_WA_PHONE` |
| Otherwise, `SEED_DEMO=true` | Create `admin@rumi.id` with password `rumi-admin-123` |
| Otherwise | Log a WARN: "no admin account" |

**Demo data** (§5.11.4) is added only when `SEED_DEMO=true` and `nadia@example.com` does not exist yet.

#### 5.11.2 Classes and kits (catalog)

**Venues (exact `location` strings):**
- `Rumah Teduh, Kemang (Jakarta Selatan)`
- `Ruang Kenari, Bintaro (Tangerang Selatan)`
- `Studio Bambu, BSD City (Tangerang Selatan)`

**Classes.** Every class has `age_min 3`, `age_max 6`, `capacity 12`, `seats_booked 0` and `image_url null`.

| title | location | date | start–end | fee_idr | status | description |
|---|---|---|---|---|---|---|
| Bulan & Gerak | Rumah Teduh, Kemang (Jakarta Selatan) | 2026-11-14 (Sab) | 09:30–11:30 | 200000 | OPEN | Mengenal ciptaan Allah lewat gerak tubuh, lagu, dan kisah tentang bulan. Setelah bergerak dan bernyanyi, anak memilih kegiatan menuang dan memilah dengan tenang. |
| Tukang Kebun Cilik | Ruang Kenari, Bintaro (Tangerang Selatan) | 2026-11-21 (Sab) | 09:30–11:30 | 175000 | OPEN | Menanam benih, menyiram, dan merawat tanaman kecil sambil belajar bersyukur atas rezeki dari bumi. |
| Dunia Kita yang Ramah | Rumah Teduh, Kemang (Jakarta Selatan) | 2026-11-29 (Min) | 14:00–16:00 | 150000 | OPEN | Belajar adab berteman: menyapa dengan salam, menunggu giliran, dan berbagi material dengan lembut. |
| Suara & Pasir | Studio Bambu, BSD City (Tangerang Selatan) | 2026-12-05 (Sab) | 09:30–11:30 | 250000 | OPEN | Bermain bunyi huruf, menulis di atas pasir, dan mengenal huruf hijaiyah lewat sentuhan. |
| Taman Berhitung | Ruang Kenari, Bintaro (Tangerang Selatan) | 2026-12-12 (Sab) | 09:30–11:30 | 225000 | DRAFT | Menghitung manik-manik, mengenal angka, dan menyusun pola dari bahan-bahan alam. |

**Kits.** These are the template kits in Indonesian. Every kit has `is_active true` and `image_url null`. They are inserted in the order below.

| name | category | price_idr | stock | badge_tag | description |
|---|---|---|---|---|---|
| Nampan Tangan Kecil | PRACTICAL_LIFE | 185000 | 12 | Favorit | Nampan kayu yang cantik untuk kegiatan menuang, memilah, dan bekerja dengan fokus. |
| Kartu Bulan Gurun | ISLAMIC_STUDIES | 120000 | 8 | null | Kartu percakapan lembut untuk menjelajahi rasa syukur, kebaikan, dan rasa takjub. |
| Set Suara & Pasir | SENSORIAL | 225000 | 4 | Baru | Kartu huruf bertekstur dan permainan bunyi untuk pembaca cilik yang penuh rasa ingin tahu. |
| Taman Berhitung | MATH | 150000 | 16 | null | Taman manik-manik dan angka yang ceria untuk mengasah kepekaan bilangan secara langsung. |

#### 5.11.3 CMS bodies (catalog)

Every section is seeded with `is_active true` and `image_url null`. The titles and `sort_order` values are in the §5.7 table.

```jsonc
// home / hero
{ "eyebrow": "Belajar akhir pekan untuk usia 3–6 tahun",
  "heading": "Ruang kecil untuk",
  "heading_highlight": "bertanya & bertumbuh.",
  "subheading": "RUMI adalah pop-up Montessori yang hangat, tempat anak-anak menjelajahi iman, kemandirian, dan kegembiraan belajar — dengan sepenuh hati.",
  "art_badge": "Sabtu pagi",
  "art_caption": "Material indah. Pertanyaan besar.",
  "art_motto": "tumbuh dengan takjub",
  "social_proof": "Kelas kecil, maksimal 12 anak per sesi" }

// home / rumi_way
{ "eyebrow": "Cara RUMI",
  "heading": "Ruang yang disiapkan untuk hati yang penuh rasa ingin tahu.",
  "intro": "Setiap pop-up dirancang agar terasa tenang, bermakna, dan menggembirakan — tempat anak memilih kegiatan yang berarti dan menemukan ritmenya sendiri.",
  "cards": [
    { "icon": "heart", "tone": "teal", "title": "Berakar pada adab", "text": "Nilai iman dirajut dengan lembut melalui cerita, lagu, dan cara kita saling peduli." },
    { "icon": "hands", "tone": "orange", "title": "Tangan sebelum layar", "text": "Anak belajar lewat material nyata, gerak tubuh, dan rasa puas saat berhasil melakukannya sendiri." },
    { "icon": "sparkles", "tone": "yellow", "title": "Rasa takjub disambut", "text": "Kami memberi ruang untuk pertanyaan, konsentrasi, kesalahan, dan kegembiraan." } ] }

// who-we-are / founder_message
{ "eyebrow": "Pesan pendiri",
  "heading": "Tangan-tangan kecil, didampingi kampung yang peduli.",
  "paragraphs": [
    "RUMI berawal dari satu keyakinan sederhana: anak-anak layak mendapat tempat di mana iman dan rasa ingin tahu tumbuh berdampingan.",
    "Sebagai ibu dan pemandu Montessori, saya ingin menghadirkan ruang yang tenang dan tertata — tempat anak boleh memilih, mencoba, dan menemukan makna dengan caranya sendiri." ],
  "signature_name": "Nadia Rahman",
  "signature_role": "Pendiri & Pemandu Belajar" }

// who-we-are / philosophy
{ "eyebrow": "Filosofi kami",
  "heading": "Ikuti anak, rawat fitrahnya.",
  "paragraphs": [
    "Kami percaya setiap anak lahir dengan fitrah: rasa ingin tahu, keinginan untuk mandiri, dan hati yang terbuka. Pendekatan Montessori memberi kami cara untuk menghormati fitrah itu — mengamati, menyiapkan lingkungan, lalu mundur selangkah.",
    "Nilai-nilai Islam tidak kami ajarkan sebagai pelajaran terpisah, tetapi kami rajut ke dalam keseharian: salam saat datang, doa sebelum makan, dan cara kita memperlakukan teman serta material." ] }

// who-we-are / mission
{ "eyebrow": "Misi",
  "heading": "Menumbuhkan anak yang mandiri, penuh takjub, dan beradab.",
  "statement": "Menghadirkan ruang belajar akhir pekan yang tenang dan bermakna, tempat iman dan rasa ingin tahu anak usia 3–6 tahun tumbuh berdampingan.",
  "points": [
    "Kelas kecil dengan pendamping terlatih, maksimal 12 anak per sesi.",
    "Material Montessori nyata — tangan dulu, layar belakangan.",
    "Bermitra dengan orang tua lewat catatan perkembangan yang jujur dan hangat." ] }

// who-we-are / educators
{ "eyebrow": "Orang-orang di balik RUMI",
  "heading": "Para pendamping kami",
  "intro": "Tim kecil kami menyiapkan ruang yang tenang dan tertata, agar setiap anak bisa tumbuh dengan ritmenya sendiri.",
  "people": [
    { "name": "Nadia Rahman", "role": "Pendiri & Pemandu Belajar", "bio": "Seorang ibu, pemandu Montessori, dan pembelajar sepanjang hayat tentang cara anak-anak memaknai dunia.", "initials": "NR", "tone": "teal" },
    { "name": "Ustazah Mariam Yusuf", "role": "Guru Utama Montessori", "bio": "Membawa 12 tahun pengalaman pendidikan anak usia dini dan kecintaan yang lembut pada cerita.", "initials": "MY", "tone": "orange" },
    { "name": "Hana Karim", "role": "Pemandu Studi Islam", "bio": "Membantu anak-anak mengenal adab, rasa syukur, dan rasa takjub melalui momen sehari-hari.", "initials": "HK", "tone": "yellow" } ] }

// our-approach / intro
{ "eyebrow": "Pendekatan kami",
  "heading": "Montessori yang berakar pada nilai-nilai Islam.",
  "paragraphs": [
    "Setiap sesi RUMI mengikuti ritme anak: lingkaran pembuka dengan salam dan doa, waktu kerja bebas dengan material yang telah disiapkan, lalu penutup dengan cerita dan refleksi.",
    "Kami mengamati, bukan menghakimi. Catatan perkembangan membantu orang tua melihat apa yang sedang tumbuh — dan undangan apa yang bisa diberikan selanjutnya." ] }

// our-approach / domains
{ "eyebrow": "Lima ranah belajar",
  "heading": "Apa saja yang anak jelajahi di RUMI",
  "intro": "Pilih setiap ranah untuk melihat contoh kegiatan yang biasa kami siapkan.",
  "items": [
    { "domain": "PRACTICAL_LIFE", "title": "Kehidupan Praktis", "summary": "Menumbuhkan kemandirian lewat pekerjaan sehari-hari.", "activities": ["Menuang air dan biji-bijian", "Melipat kain dan merapikan alas kerja", "Menyiapkan camilan sederhana"] },
    { "domain": "SENSORIAL", "title": "Sensorial", "summary": "Mengasah indra lewat material yang indah dan teratur.", "activities": ["Mengurutkan silinder berdasarkan ukuran", "Mencocokkan bunyi dan tekstur", "Mengenali warna dan gradasinya"] },
    { "domain": "LANGUAGE", "title": "Bahasa", "summary": "Menemukan rasa percaya diri lewat cerita dan bunyi baru.", "activities": ["Kartu huruf amplas", "Mendongeng dan bercakap-cakap", "Bermain bunyi awal kata"] },
    { "domain": "MATH", "title": "Matematika", "summary": "Membangun kepekaan bilangan, satu manik demi satu manik.", "activities": ["Menghitung dengan tangga manik-manik", "Mencocokkan angka dan jumlah benda", "Mengenal bentuk geometri"] },
    { "domain": "ISLAMIC_STUDIES", "title": "Studi Islam", "summary": "Menumbuhkan hati yang berakar pada rasa takjub dan adab.", "activities": ["Kisah para nabi yang lembut", "Doa harian dan basmalah", "Mengenal huruf hijaiyah"] } ] }

// our-approach / values
{ "eyebrow": "Nilai-nilai Islami",
  "heading": "Lima nilai yang kami rawat setiap pekan",
  "intro": "Nilai-nilai ini hadir dalam cerita, lagu, dan kebiasaan kecil di setiap sesi.",
  "items": [
    { "icon": "heart", "title": "Adab", "arabic": "أدب", "text": "Santun kepada Allah, sesama, dan alam — dimulai dari salam, senyum, dan antre dengan sabar." },
    { "icon": "sun", "title": "Syukur", "arabic": "شكر", "text": "Belajar berterima kasih atas hal-hal kecil: air, teman, dan kesempatan untuk mencoba." },
    { "icon": "hands", "title": "Rahmah", "arabic": "رحمة", "text": "Kasih sayang yang tampak dari cara kita merawat material, teman, dan diri sendiri." },
    { "icon": "star", "title": "Amanah", "arabic": "أمانة", "text": "Tanggung jawab sederhana: mengembalikan material ke tempatnya dan menuntaskan pekerjaan yang dipilih." },
    { "icon": "leaf", "title": "Sabar", "arabic": "صبر", "text": "Memberi waktu untuk mencoba lagi, menunggu giliran, dan tumbuh perlahan." } ] }
```

#### 5.11.4 Demo data (`SEED_DEMO=true` only)

**Accounts:**

| Email | Password | Role | full_name | phone_wa |
|---|---|---|---|---|
| `admin@rumi.id` | `rumi-admin-123` | ADMIN | Admin RUMI | `RUMI_ADMIN_WA_PHONE` |
| `nadia@example.com` | `rumi-parent-123` | PARENT | Nadia Rahman | `6281211112222` |

The admin row is created only if the §5.11.1 admin bootstrap has not already made one.

**Child:** **Amina**, `dob 2020-04-15`, notes `null`. Amina's parent is Nadia.

**Past class:** "Mengenal Syukur".

| Field | Value |
|---|---|
| location | Rumah Teduh, Kemang (Jakarta Selatan) |
| date and time | 2026-01-17, 09:30–11:30 |
| fee | 175000 |
| ages | 3–6 |
| capacity | 12 |
| status | `CLOSED` |
| seats_booked | 1 |
| description | "Mengenal rasa syukur lewat cerita, lagu, dan kegiatan menyiapkan camilan bersama." |

**One order:**

| Field | Value |
|---|---|
| order_code | **`RUMI-2025-0001`**, so a fresh checkout in 2026 still gets `RUMI-2026-0001` |
| status | `PAID` |
| created_at | `2025-12-28T03:00:00Z` |
| paid_at | `2025-12-29T02:00:00Z` |
| delivery | name "Nadia Rahman", phone `6281211112222`, address "Jl. Kemang Raya 12, Jakarta Selatan" |
| items | CLASS "Mengenal Syukur" for Amina at 175000; KIT "Kartu Bulan Gurun" ×1 at 120000 |
| total | 295000 |
| enrollment | Amina in "Mengenal Syukur", `ATTENDED` |
| counter | `order_code_counters (2025, 1)` |
| idempotency_key | any fixed UUID |
| message | `wa_message_payload` built per §5.9.3 |

The demo order does **not** change the kit stock in §5.11.2.

**Assessments for Amina.** The assessor is the demo admin.

| observed_on | class | domain | level | milestone | notes |
|---|---|---|---|---|---|
| 2026-01-17 | Mengenal Syukur | PRACTICAL_LIFE | 2 | Menuang air dari teko kecil dengan hati-hati | null |
| 2026-01-17 | Mengenal Syukur | ISLAMIC_STUDIES | 2 | Mengucapkan salam saat menyapa teman | null |
| 2026-10-24 | null | PRACTICAL_LIFE | 3 | Memilih kegiatan menuang tiga kali dan merapikannya sendiri | Konsentrasinya makin tumbuh — ia memilih kegiatan yang sama tiga kali. |
| 2026-10-24 | null | SENSORIAL | 3 | Mengurutkan silinder dari yang terbesar ke terkecil | null |
| 2026-10-24 | null | LANGUAGE | 2 | Mengenali bunyi awal nama teman-temannya | null |
| 2026-10-24 | null | MATH | 2 | Menghitung benda sampai 10 | null |
| 2026-10-24 | null | ISLAMIC_STUDIES | 3 | Membaca basmalah sebelum makan tanpa diingatkan | null |

### 5.12 Non-API routes and headers

**Non-API routes:**

| Request | Response |
|---|---|
| `GET /healthz` | `200 text/plain` with the body `ok`. It is not enveloped and does not query the DB. Docker uses it as a liveness probe |
| `GET` on an unknown path under `/api` | `404 not_found`, in the envelope. It never falls back to the SPA |
| `GET /assets/*` | Static files from `STATIC_DIR`, with `Cache-Control: public, max-age=31536000, immutable` |
| Any other `GET` | A static file if one exists; otherwise `index.html`, the SPA fallback, with `Cache-Control: no-cache` |

**Security headers on every response:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

The SPA bundles its fonts (`@fontsource-variable/inter`) and the logo, so the CSP needs no outside origins.

**Logging:** `TraceLayer` never logs request or response headers or bodies, so no cookies and no passwords appear in the log.

---

## 6. Decisions beyond the plan (made at Phase 0, binding through §5)

1. **`GET /api/auth/me` is public.** It returns `{ user: null }` when there is no session, instead of 401. The SPA bootstraps without a 401 round trip, and the redirect-on-401 rule stays simple.
2. **More error codes.** §5.2 adds these to the brief's list:
   - `bad_request` (400)
   - `invalid_credentials` (401), kept apart from `unauthorized` so that a failed login never triggers the global redirect
   - `origin_mismatch` (403)
   - `method_not_allowed` (405)
   - `email_taken` (409)
   - `item_unavailable` (409)
   - `already_enrolled` (409)
   - `payload_too_large` (413)
   - `invalid_token` (422)
   - `unavailable` (503)
3. **Optional `fields` map on `validation_error`**, so forms can show the error next to the field.
4. **Unknown request fields are ignored, not rejected.** This follows the plan's "price tampering ignored" test. CMS `body` documents are the one strict exception, because they are stored verbatim.
5. **The CMS registry is fixed.** There are 9 `(page_slug, section_key)` pairs, each with its own shape, validated strictly on the server. CMS `title` is an admin-only label.
6. **`ClassList` adds a `locations` facet**, so the location filter options don't need a second request.
7. **The location filter matches exactly**, ignoring case. Its options come from the facet.
8. **Extra computed fields:** `WeekendClass.is_upcoming` and `Order.expires_at`.
9. **`Order.wa_url` is on every order**, so a parent can reopen WhatsApp from the Pesanan tab. For the same reason, `OrderItem` carries live class and child details along with the `enrollment_status`.
10. **Metrics include more than the plan listed.** Besides what the plan asks for, `Metrics` has `paid_orders`, `pending_amount_idr` and `revenue_by_month` (6 months, zero-filled) for the template's revenue bars, and `ClassFill.fill_rate_pct`. `enrolled_students` counts children with a paid-backed enrollment (CONFIRMED, ATTENDED or ABSENT).
11. **Admin orders and admin students are paginated** (`Paginated<T>`). Every other list is bounded and comes back unpaginated.
12. **Bookability is defined by the class start in WIB.** A class can be booked only while `date + start_time` in WIB is still in the future. The public list shows `OPEN` classes that are upcoming.
13. **Blocking rules for active enrollments.** Deleting a child, deleting a class, or setting a class to `DRAFT` or `CANCELLED` is refused with `409 conflict` while active (`RESERVED` or `CONFIRMED`) enrollments exist.
14. **Attendance rules.**
    - Attendance can be marked only for `CONFIRMED`, `ATTENDED` or `ABSENT` enrollments.
    - It can be marked only on or after the class date.
    - Cancelling a `PAID` order leaves `ATTENDED` and `ABSENT` enrollments, and their seats, as they are.
15. **The WhatsApp wording is fixed exactly** (§5.9.3). It opens with "Assalamu'alaikum Admin RUMI", which is natural Indonesian word order.
16. **Strict percent-encoding:** only the RFC 3986 unreserved characters stay unencoded.
17. **The demo order is dated December 2025** (`RUMI-2025-0001`), so the plan's verification step still sees `RUMI-2026-0001` for the first new checkout. The demo also adds a past `CLOSED` class.
18. **Two more environment variables:** `SWEEP_INTERVAL_SECONDS` (300) and `RUST_LOG`. `RUMI_ADMIN_WA_PHONE` defaults to `6281234567890`. `STATIC_DIR` keeps the default `dist`; for local full-stack runs from `backend/`, set `STATIC_DIR=../dist`.
19. **The Vite `/api` proxy must not use `changeOrigin`**, so that the Origin CSRF check passes in development.
20. **The session expiry is fixed.** It does not slide. Reset-password does not sign the user in.
21. **Child age is not checked against the class's age range at checkout.** This is listed as a non-goal; it can be added later as `409 age_out_of_range`.
