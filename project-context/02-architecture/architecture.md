# AgentGuard — System Architecture

> **Status:** LOCKED for this build. Do not change without updating decisions.md.
> **Last updated:** 2026-09-03
> **Source:** `Master_AgentGuard.md` §12 (pipeline) + `Docs/AgentGuard_Master_Blueprint.md` §5 (infra override) + `Docs/gptPlan.md` §4-5

---

## Current Build Target

This is the reconciled architecture for the 2-day hackathon build. Every decision below is documented in `decisions.md`.

| Component | Choice | Decision Ref |
|---|---|---|
| Language | Python 3.12+ | — |
| Framework | FastAPI (async) | — |
| LLM (intent parsing) | Groq API — llama-3.3-70b-versatile | D4 |
| LLM (block explanation) | Groq API — llama-3.1-8b-instant | D4 |
| Database | SQLite (WAL mode) | D2 |
| Dashboard | Streamlit | D3 |
| Payment rail | Razorpay test-mode (Orders + Payment Links) | — |
| Deployment | Single uvicorn process, local for demo recording | D2/D3 |

---

## Component Architecture

```
[Synthetic AI Buyer / Scenario Runner]
         |  HTTP POST /api/v1/intents
         v
[FastAPI app — single uvicorn process]
   Stage 1  Intent Parser        -> Groq llama-3.3-70b-versatile (tool-use) -> BoundedIntent (Pydantic)
   Stage 2  Policy Engine        -> pure Python function against policy.yaml (hot-reload on SIGHUP)
   Stage 3  Cart Integrity Check -> SHA-256(canonical_cart_json) diff
   Stage 4  Risk Check           -> velocity rules + advisory z-score (NEVER blocks alone)
   Stage 5  Idempotency Guard    -> SQLite UNIQUE constraint, INSERT-then-check (race-safe)
   Stage 6  Action Executor      -> Razorpay Orders + Payment Links (test-mode only)
         |
   Audit Log -> hash-chained append-only SQLite table
                entry_hash = SHA-256(json(entry_content) + prev_hash)
         |
[Streamlit Dashboard]  <- polls SQLite directly (WAL read-only)
   - Summary cards (total/allowed/blocked/block rate)
   - Live request feed (color-coded status)
   - Block reason breakdown chart
   - Per-agent spend progress bars vs. daily cap
   - "Verify Chain" button -> shells out to verify_audit_chain.py -> stdout displayed
```

---

## The Five-Gate Pipeline

Every inbound purchase request passes through five sequential gates. **Failure at any gate immediately stops processing, writes an audit entry, and returns a block reason.** No gate is skipped. No gate is re-ordered.

```
[Intent Parser]
      |
      v
[Policy Engine]          <- Gate 1: amount cap, daily cap, category allow-list, velocity
      |
      v
[Cart Integrity]         <- Gate 2: SHA-256 hash comparison at authorization vs. execution
      |
      v
[Risk Check]             <- Gate 3: velocity (deterministic), anomaly score (advisory only)
      |
      v
[Idempotency Guard]      <- Gate 4: replay prevention via SQLite UNIQUE constraint
      |
      v
[Action Executor]        <- Final: Razorpay Orders + Payment Links (test-mode)
      |
      v
[Hash-Chained Audit Log] <- Written on EVERY outcome (allowed AND blocked)
```

---

## The LLM Boundary

This is the most important architectural invariant. It is enforced in code, not just documented.

```
INSIDE the LLM boundary (Groq is called):
  - agentguard/core/intent_parser.py: parse_intent() -> BoundedIntent
  - agentguard/core/intent_parser.py: explain_block()  -> cosmetic string

OUTSIDE the LLM boundary (deterministic code only):
  - agentguard/core/policy_engine.py:      check_policy()
  - agentguard/core/cart_verifier.py:      verify_cart_integrity()
  - agentguard/core/risk_checker.py:       check_risk()
  - agentguard/core/idempotency_guard.py:  check_and_reserve_idempotency_key()
  - agentguard/core/audit_log.py:          append_audit_entry()
  - agentguard/executor/razorpay_client.py: create_order(), create_payment_link()
```

**The LLM never sees the allow/block result. The allow/block result is never sent back to the LLM.**

---

## Directory Structure

```
agentguard/                    <- repo root
+-- agentguard/                <- Python package
|   +-- __init__.py
|   +-- constants.py           <- GENESIS_HASH, status literals, block reason codes
|   +-- models.py              <- BoundedIntent, Cart, CartItem, all gate result models
|   +-- config.py              <- PolicyConfig, YAML loader, fail-closed behavior, SIGHUP reload
|   +-- database.py            <- SQLAlchemy engine, WAL mode setup, init_db()
|   +-- core/
|   |   +-- policy_engine.py   <- Gate 1: check_policy()
|   |   +-- cart_verifier.py   <- Gate 2: take_cart_snapshot(), verify_cart_integrity()
|   |   +-- risk_checker.py    <- Gate 3: check_risk(), compute_anomaly_score()
|   |   +-- idempotency_guard.py <- Gate 4: check_and_reserve_idempotency_key()
|   |   +-- intent_parser.py   <- Groq tool-use, parse_intent(), explain_block()
|   |   +-- audit_log.py       <- append_audit_entry(), verify_chain(), get_audit_entries()
|   +-- executor/
|   |   +-- razorpay_client.py <- create_order(), create_payment_link(), webhook handlers
|   +-- api/
|       +-- main.py            <- FastAPI app, lifespan, CORS, router registration
|       +-- routes/
|           +-- intents.py     <- POST /api/v1/intents (main pipeline endpoint)
|           +-- audit.py       <- GET /api/v1/audit, POST /api/v1/audit/verify
|           +-- webhooks.py    <- POST /webhooks/razorpay
+-- dashboard/
|   +-- app.py                 <- Complete Streamlit dashboard
+-- synthetic/
|   +-- catalog.json           <- 12 SKUs across 3 categories (4 each)
|   +-- scenarios.py           <- Automated 7-scenario runner
+-- migrations/
|   +-- 001_initial_schema.sql <- All DDL (5 tables, SQLite-compatible)
+-- scripts/
|   +-- verify_audit_chain.py  <- Standalone, stdlib-only audit verification
+-- tests/
|   +-- unit/                  <- Gate unit tests (offline, no API keys)
|   +-- integration/           <- Adversarial test suite (requires running server)
+-- project-context/           <- This directory
+-- plans/                     <- Phase-by-phase implementation plans
+-- policy.yaml                <- Demo policy configuration
+-- .env.example               <- Required environment variables template
+-- requirements.txt           <- All pip dependencies with pinned versions
+-- README.md
+-- BUILD_LOG.md
```

---

## SQLite Schema (5 Tables)

```sql
-- All amounts stored as INTEGER paise. Never float rupees.

CREATE TABLE intents (
    intent_id       TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    raw_input       TEXT NOT NULL,
    parsed_json     TEXT,                     -- JSON string of BoundedIntent
    idempotency_key TEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'parsed',
    created_at      TEXT NOT NULL,            -- ISO-8601 UTC
    expires_at      TEXT NOT NULL
);

CREATE TABLE agent_state (
    agent_id              TEXT NOT NULL,
    date                  TEXT NOT NULL,      -- YYYY-MM-DD
    daily_spend_paise     INTEGER NOT NULL DEFAULT 0,
    request_count_today   INTEGER NOT NULL DEFAULT 0,
    last_request_at       TEXT,
    PRIMARY KEY (agent_id, date)
);

-- APPEND-ONLY: no UPDATE or DELETE in application code
CREATE TABLE cart_snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    intent_id       TEXT NOT NULL REFERENCES intents(intent_id),
    cart_hash       TEXT NOT NULL,
    canonical_json  TEXT NOT NULL,
    taken_at        TEXT NOT NULL
);

CREATE TABLE idempotency_keys (
    key         TEXT PRIMARY KEY,
    intent_id   TEXT NOT NULL REFERENCES intents(intent_id),
    agent_id    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL,
    executed_at TEXT,
    payment_id  TEXT,
    expires_at  TEXT NOT NULL
);

-- APPEND-ONLY: no UPDATE or DELETE in application code
CREATE TABLE audit_log (
    entry_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    prev_hash       TEXT NOT NULL,
    entry_hash      TEXT NOT NULL UNIQUE,
    intent_id       TEXT REFERENCES intents(intent_id),
    agent_id        TEXT NOT NULL,
    timestamp       TEXT NOT NULL,
    payload         TEXT NOT NULL,            -- Full JSON decision record
    final_decision  TEXT NOT NULL,            -- "allowed" | "blocked"
    block_reason    TEXT
);
```

---

## Request Lifecycle (Happy Path)

```
1. POST /api/v1/intents {"agent_id": "AgentBot-001", "raw_input": "buy running shoes, budget 7000"}
2. Intent Parser: Groq llama-3.3-70b-versatile tool-use -> BoundedIntent{category="footwear", max_amount_paise=700000}
3. INSERT INTO intents
4. Policy Engine: 700000 <= 700000 PASS, "footwear" in allowed_categories PASS, velocity < 5 PASS
5. Cart snapshot: canonical_dict -> SHA-256 -> stored in cart_snapshots
6. Cart integrity: current hash == stored hash PASS
7. Risk check: velocity rules PASS, anomaly_score=0.0 (advisory)
8. Idempotency: INSERT idempotency_key (success) PASS
9. Razorpay: POST /v1/orders -> order_id | POST /v1/payment_links -> short_url
10. Audit: append_audit_entry(decision="allowed", all gate results, payment_result)
11. Response: {status: "allowed", payment_link_url: "https://rzp.io/...", intent_id: "..."}
```

## Request Lifecycle (Blocked Path — Over-Cap)

```
1. POST /api/v1/intents {"agent_id": "AgentBot-001", "raw_input": "buy running shoes for 9999"}
2. Intent Parser: -> BoundedIntent{category="footwear", max_amount_paise=999900}
3. INSERT INTO intents
4. Policy Engine: 999900 > 700000 -> BLOCK reason="exceeds_transaction_cap"
5. explain_block() -> Groq llama-3.1-8b-instant -> human explanation string (cosmetic)
6. Audit: append_audit_entry(decision="blocked", block_reason="exceeds_transaction_cap")
7. Response: {status: "blocked", block_reason: "exceeds_transaction_cap", block_explanation: "..."}
--- Razorpay is NEVER called ---
```

---

## Audit Chain Architecture

```
Entry 0 (first ever):
  prev_hash = "GENESIS"
  content   = { ...full decision record... }
  entry_hash = SHA-256(json.dumps(content, sort_keys=True) + "GENESIS")

Entry 1:
  prev_hash = entry_hash[0]
  entry_hash = SHA-256(json.dumps(content, sort_keys=True) + entry_hash[0])

Entry N:
  prev_hash = entry_hash[N-1]
  entry_hash = SHA-256(json.dumps(content, sort_keys=True) + entry_hash[N-1])
```

**Tamper detection:** If any entry's payload is modified, its hash changes. All subsequent entries become invalid (their `prev_hash` no longer matches). `verify_audit_chain.py` detects this and reports the exact entry index where the chain broke.

---

## Performance Targets (per gate, P95)

| Gate | Target |
|---|---|
| Policy engine | < 10ms (no network calls) |
| Cart integrity | < 1ms (pure computation) |
| Risk check | < 50ms (2 DB queries) |
| Idempotency guard | < 10ms (1 DB INSERT) |
| Intent parser (Groq) | < 2,000ms (LLM network call) |
| Razorpay executor | < 3,000ms (2 API calls) |
| Audit log append | < 5ms (1 DB INSERT) |

---

## Security Model

| Property | Mechanism |
|---|---|
| Fail-closed | Missing policy.yaml -> block all; missing cart snapshot -> block; unknown agent -> block |
| Append-only audit | No UPDATE/DELETE in audit_log.py or cart_verifier.py (verifiable by grep) |
| Webhook trust | HMAC-SHA256 signature validated on raw body before JSON parse |
| Test-mode enforcement | RAZORPAY_KEY_ID must start with "rzp_test_" — assertion at startup |
| Idempotency race safety | INSERT-then-catch-IntegrityError; never check-then-INSERT |

---

## Scalability Notes (Post-MVP)

The following changes are explicitly deferred to after submission. Do not attempt before deadline:

| Item | Post-MVP Action | Decision Ref |
|---|---|---|
| PostgreSQL | Replace SQLite with PostgreSQL + proper role-level grants | D2 |
| React dashboard | Replace Streamlit with React + SSE live feed | D3 |
| AP2 mandate input | Add BoundedIntent parser adapter accepting AP2 Cart Mandate JWT | OQ1 |
| ECDSA signing | Add ECDSA-signed audit entries for non-repudiation | D5 |
| Agent credential registry | Token-based cross-agent delegation | Blueprint §13 |

---

*Extracted from: `Master_AgentGuard.md` §12 (pipeline) · `Docs/AgentGuard_Master_Blueprint.md` §5 (infra) · `Docs/gptPlan.md` §4-5 (architecture diagram)*
*Supersedes: §12, §18-21 of Master_AgentGuard.md and §5 of Blueprint.*
