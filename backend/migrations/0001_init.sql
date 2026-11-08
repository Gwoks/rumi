-- migrations/0001_init.sql ---------------------------------------------------
-- RUMI v1 schema (PRD docs/features/rumi-v1/prd.md §5, plan "Schema").
--
-- Conventions:
--   * Timestamps are TEXT `YYYY-MM-DD HH:MM:SS` in UTC (`datetime('now')`); the
--     API renders them as RFC 3339 `…Z`.
--   * Dates are TEXT `YYYY-MM-DD`, times TEXT `HH:MM` (business time = WIB).
--   * Money is INTEGER whole Rupiah (`*_idr`), never REAL.
--   * Soft delete via `deleted_at`; every read filters `deleted_at IS NULL`.
--   * CHECK constraints on money, stock and enums are defense in depth: the API
--     validates first, the schema refuses anything that slips through.
--   * Index names follow `idx_<table>_<cols>`.
-- WAL, foreign_keys and busy_timeout are set when the pool opens (db.rs).

CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL COLLATE NOCASE UNIQUE,      -- stored lowercase
    password_hash TEXT    NOT NULL,                            -- argon2id PHC string
    full_name     TEXT    NOT NULL,
    phone_wa      TEXT    NOT NULL,                            -- normalized "62…"
    role          TEXT    NOT NULL DEFAULT 'PARENT' CHECK (role IN ('PARENT', 'ADMIN')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at    TEXT
);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE auth_sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT    NOT NULL UNIQUE,                      -- sha256 hex of the cookie token
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at   TEXT    NOT NULL,                             -- fixed, never slides
    last_seen_at TEXT    NOT NULL DEFAULT (datetime('now')),
    user_agent   TEXT,
    ip           TEXT
);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE password_resets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT    NOT NULL UNIQUE,                        -- sha256 hex, single use
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT    NOT NULL,
    used_at    TEXT
);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX idx_password_resets_expires_at ON password_resets(expires_at);

CREATE TABLE children (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id  INTEGER NOT NULL REFERENCES users(id),
    name       TEXT    NOT NULL,
    dob        TEXT    NOT NULL,                               -- age is computed, never stored
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
);
CREATE INDEX idx_children_parent_id ON children(parent_id);
CREATE INDEX idx_children_name ON children(name);

CREATE TABLE cms_content (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    page_slug   TEXT    NOT NULL CHECK (page_slug IN ('home', 'who-we-are', 'our-approach')),
    section_key TEXT    NOT NULL,
    title       TEXT,                                          -- admin-facing label only
    body_json   TEXT    NOT NULL CHECK (json_valid(body_json)),
    image_url   TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT
);
-- One live row per (page, section); a soft-deleted pair can be created again.
CREATE UNIQUE INDEX idx_cms_content_page_slug_section_key
    ON cms_content(page_slug, section_key) WHERE deleted_at IS NULL;

CREATE TABLE weekend_classes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL,
    location     TEXT    NOT NULL,
    image_url    TEXT,
    age_min      INTEGER NOT NULL CHECK (age_min BETWEEN 0 AND 12),
    age_max      INTEGER NOT NULL CHECK (age_max BETWEEN age_min AND 12),
    date         TEXT    NOT NULL,
    start_time   TEXT    NOT NULL,
    end_time     TEXT    NOT NULL CHECK (end_time > start_time),
    fee_idr      INTEGER NOT NULL CHECK (fee_idr >= 0),
    capacity     INTEGER NOT NULL CHECK (capacity > 0),
    seats_booked INTEGER NOT NULL DEFAULT 0 CHECK (seats_booked >= 0 AND seats_booked <= capacity),
    status       TEXT    NOT NULL DEFAULT 'DRAFT'
                 CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at   TEXT
);
CREATE INDEX idx_weekend_classes_status_date ON weekend_classes(status, date, start_time);

CREATE TABLE play_kits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL
                CHECK (category IN ('PRACTICAL_LIFE', 'SENSORIAL', 'LANGUAGE', 'MATH', 'ISLAMIC_STUDIES')),
    description TEXT    NOT NULL,
    image_url   TEXT,
    price_idr   INTEGER NOT NULL CHECK (price_idr >= 0),
    stock       INTEGER NOT NULL CHECK (stock >= 0),
    badge_tag   TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT
);
CREATE INDEX idx_play_kits_category ON play_kits(category);

CREATE TABLE orders (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code         TEXT    NOT NULL UNIQUE,                -- RUMI-YYYY-NNNN (WIB year)
    parent_id          INTEGER NOT NULL REFERENCES users(id),
    total_amount_idr   INTEGER NOT NULL CHECK (total_amount_idr >= 0),
    status             TEXT    NOT NULL DEFAULT 'PENDING_WA'
                       CHECK (status IN ('PENDING_WA', 'PAID', 'CANCELLED')),
    delivery_name      TEXT    NOT NULL,
    delivery_phone     TEXT    NOT NULL,
    delivery_address   TEXT,
    notes              TEXT,
    wa_message_payload TEXT    NOT NULL,                       -- raw (unencoded) WhatsApp text
    idempotency_key    TEXT    NOT NULL,                       -- lowercase UUID
    paid_at            TEXT,
    cancelled_at       TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (parent_id, idempotency_key)                        -- a double-submit never makes two orders
);
CREATE INDEX idx_orders_parent_id_created_at ON orders(parent_id, created_at);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at);

CREATE TABLE order_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_type      TEXT    NOT NULL CHECK (item_type IN ('CLASS', 'KIT')),
    class_id       INTEGER REFERENCES weekend_classes(id),
    kit_id         INTEGER REFERENCES play_kits(id),
    child_id       INTEGER REFERENCES children(id),
    name_snapshot  TEXT    NOT NULL,
    unit_price_idr INTEGER NOT NULL CHECK (unit_price_idr >= 0),
    quantity       INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    line_total_idr INTEGER NOT NULL CHECK (line_total_idr = unit_price_idr * quantity),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (item_type = 'CLASS' AND class_id IS NOT NULL AND child_id IS NOT NULL
             AND kit_id IS NULL AND quantity = 1)
        OR
        (item_type = 'KIT' AND kit_id IS NOT NULL AND class_id IS NULL AND child_id IS NULL)
    )
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE TABLE class_enrollments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id      INTEGER NOT NULL REFERENCES weekend_classes(id),
    child_id      INTEGER NOT NULL REFERENCES children(id),
    order_item_id INTEGER UNIQUE REFERENCES order_items(id),
    status        TEXT    NOT NULL DEFAULT 'RESERVED'
                  CHECK (status IN ('RESERVED', 'CONFIRMED', 'ATTENDED', 'ABSENT', 'CANCELLED')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
-- A child holds at most one live (non-cancelled) seat per class.
CREATE UNIQUE INDEX idx_class_enrollments_class_id_child_id
    ON class_enrollments(class_id, child_id) WHERE status <> 'CANCELLED';
CREATE INDEX idx_class_enrollments_child_id ON class_enrollments(child_id);

CREATE TABLE student_assessments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id    INTEGER NOT NULL REFERENCES children(id),
    class_id    INTEGER REFERENCES weekend_classes(id),
    assessor_id INTEGER NOT NULL REFERENCES users(id),
    domain      TEXT    NOT NULL
                CHECK (domain IN ('PRACTICAL_LIFE', 'SENSORIAL', 'LANGUAGE', 'MATH', 'ISLAMIC_STUDIES')),
    level       INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
    milestone   TEXT    NOT NULL,
    notes       TEXT,
    observed_on TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_student_assessments_child_id_observed_on
    ON student_assessments(child_id, observed_on);

CREATE TABLE order_code_counters (
    year     INTEGER PRIMARY KEY,                              -- WIB calendar year
    last_seq INTEGER NOT NULL CHECK (last_seq >= 0)
);

-- updated_at triggers ---------------------------------------------------------
-- Fire only when the UPDATE did not set updated_at itself; recursive triggers are
-- off by default, so the inner UPDATE does not re-fire.

CREATE TRIGGER trg_users_updated_at AFTER UPDATE ON users
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_children_updated_at AFTER UPDATE ON children
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE children SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_cms_content_updated_at AFTER UPDATE ON cms_content
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE cms_content SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_weekend_classes_updated_at AFTER UPDATE ON weekend_classes
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE weekend_classes SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_play_kits_updated_at AFTER UPDATE ON play_kits
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE play_kits SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_orders_updated_at AFTER UPDATE ON orders
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id; END;

CREATE TRIGGER trg_class_enrollments_updated_at AFTER UPDATE ON class_enrollments
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE class_enrollments SET updated_at = datetime('now') WHERE id = NEW.id; END;
