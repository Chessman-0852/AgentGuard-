-- migrations/001_initial_schema.sql
-- SQLite-compatible schema. Amounts stored as INTEGER paise.

CREATE TABLE IF NOT EXISTS intents (
    intent_id       TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    raw_input       TEXT NOT NULL,
    parsed_json     TEXT,                     -- JSON string of BoundedIntent
    idempotency_key TEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'parsed',
    created_at      TEXT NOT NULL,            -- ISO-8601 UTC
    expires_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_state (
    agent_id              TEXT NOT NULL,
    date                  TEXT NOT NULL,      -- YYYY-MM-DD
    daily_spend_paise     INTEGER NOT NULL DEFAULT 0,
    request_count_today   INTEGER NOT NULL DEFAULT 0,
    last_request_at       TEXT,
    PRIMARY KEY (agent_id, date)
);

-- APPEND-ONLY: Application code must never UPDATE or DELETE from this table.
CREATE TABLE IF NOT EXISTS cart_snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    intent_id       TEXT NOT NULL REFERENCES intents(intent_id),
    cart_hash       TEXT NOT NULL,
    canonical_json  TEXT NOT NULL,
    taken_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    key         TEXT PRIMARY KEY,
    intent_id   TEXT NOT NULL REFERENCES intents(intent_id),
    agent_id    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL,
    executed_at TEXT,
    payment_id  TEXT,
    expires_at  TEXT NOT NULL
);

-- APPEND-ONLY: Application code must never UPDATE or DELETE from this table.
CREATE TABLE IF NOT EXISTS audit_log (
    entry_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    prev_hash       TEXT NOT NULL,
    entry_hash      TEXT NOT NULL UNIQUE,
    intent_id       TEXT REFERENCES intents(intent_id),
    agent_id        TEXT NOT NULL,
    timestamp       TEXT NOT NULL,
    payload         TEXT NOT NULL,            -- JSON string of full decision record
    final_decision  TEXT NOT NULL,            -- "allowed" | "blocked"
    block_reason    TEXT
);

CREATE INDEX IF NOT EXISTS idx_intents_agent ON intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_state_date ON agent_state(agent_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_decision ON audit_log(final_decision);
