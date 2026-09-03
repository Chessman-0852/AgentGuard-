# AgentGuard — Data Models

> **Source:** `Master_AgentGuard.md` §7, §9, §13 · Adapted for SQLite (not PostgreSQL)
> **Last updated:** 2026-09-03

---

## Core Domain Objects

### BoundedIntent

The central authorization object. Every purchase request is parsed into this structure before any gate is run. If parsing fails, no downstream processing occurs.

```python
class MerchantConstraints(BaseModel):
    allowed_merchant_ids: list[str] = Field(default_factory=list)
    blocked_merchant_ids: list[str] = Field(default_factory=list)

class BoundedIntent(BaseModel):
    intent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    category: str                        # lowercase; e.g. "footwear", "groceries"
    item_description: str
    max_amount_paise: int               # ALWAYS in paise. Never float rupees.
    currency: str = "INR"
    ttl_seconds: int = 3600
    merchant_constraints: MerchantConstraints = Field(default_factory=MerchantConstraints)
    idempotency_key: str = ""           # Set by parser after extraction
    raw_input: str = ""                 # Original NL string
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

**Amount Invariant:** `max_amount_paise` is ALWAYS stored as integer paise (1 INR = 100 paise). The conversion from INR happens exactly once, in the intent parser. All downstream gates compare integers only.

**Category:** Lowercase, normalized string. Must match a value in `policy.yaml:allowed_categories` for the request to pass the policy gate.

**Idempotency Key Formula:** `SHA-256(agent_id + "|" + category + "|" + item_description + "|" + max_amount_paise + "|" + date_15min_bucket)`

---

### Cart & CartItem

```python
class CartItem(BaseModel):
    sku: str
    name: str
    price_paise: int                    # Always integer paise
    quantity: int
    merchant_id: str

class Cart(BaseModel):
    intent_id: str
    merchant_id: str
    items: list[CartItem]

    def total_paise(self) -> int:
        return sum(item.price_paise * item.quantity for item in self.items)

    def canonical_dict(self) -> dict:
        """Deterministic dict for hash computation. Sort keys to ensure order independence."""
        return {
            "intent_id": self.intent_id,
            "merchant_id": self.merchant_id,
            "items": sorted([
                {"sku": i.sku, "name": i.name, "price_paise": i.price_paise,
                 "quantity": i.quantity, "merchant_id": i.merchant_id}
                for i in self.items
            ], key=lambda x: x["sku"]),
        }
```

**Cart Hash Formula:** `SHA-256(json.dumps(cart.canonical_dict(), sort_keys=True))`

---

## Gate Result Models

Each gate returns a typed result object. These are written directly into the audit log payload.

```python
class PolicyResult(BaseModel):
    passed: bool
    reason: str | None = None          # block_reason code if blocked
    rule_triggered: str | None = None  # e.g. "max_transaction_amount"

class CartIntegrityResult(BaseModel):
    passed: bool
    changed_fields: list[str] = Field(default_factory=list)
    reason: str | None = None

class RiskResult(BaseModel):
    passed: bool
    anomaly_score: float = 0.0
    reason: str | None = None

class IdempotencyResult(BaseModel):
    passed: bool
    reason: str | None = None          # e.g. "replay_detected"

class PaymentResult(BaseModel):
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    payment_link_url: str | None = None
    status: str = "not_attempted"
```

---

## Policy Configuration Model

```python
class PolicyConfig(BaseModel):
    max_transaction_amount_paise: int           # e.g. 700000 (7000 INR)
    max_daily_spend_per_agent_paise: int        # e.g. 1500000 (15000 INR)
    requires_human_confirmation_above_paise: int # e.g. 500000 (5000 INR) — treated as block for MVP
    allowed_categories: list[str]               # e.g. ["footwear", "groceries", "electronics-accessories"]
    max_requests_per_minute_per_agent: int      # e.g. 5
    idempotency_key_ttl_seconds: int            # e.g. 3600
    all_blocked: bool = False                   # Emergency kill switch: block ALL purchases if True
```

---

## Database Tables (SQLite DDL)

All amounts stored as INTEGER paise. ISO-8601 UTC strings for timestamps (SQLite has no native TIMESTAMPTZ).

### intents
```sql
CREATE TABLE IF NOT EXISTS intents (
    intent_id       TEXT PRIMARY KEY,
    agent_id        TEXT NOT NULL,
    raw_input       TEXT NOT NULL,
    parsed_json     TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'parsed',
    created_at      TEXT NOT NULL,
    expires_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_intents_agent_id ON intents(agent_id);
CREATE INDEX IF NOT EXISTS idx_intents_status ON intents(status);
```

### agent_state
```sql
CREATE TABLE IF NOT EXISTS agent_state (
    agent_id              TEXT NOT NULL,
    date                  TEXT NOT NULL,
    daily_spend_paise     INTEGER NOT NULL DEFAULT 0,
    request_count_today   INTEGER NOT NULL DEFAULT 0,
    last_request_at       TEXT,
    PRIMARY KEY (agent_id, date)
);
```

### cart_snapshots (APPEND-ONLY)
```sql
-- APPEND-ONLY: no UPDATE or DELETE in agentguard/core/cart_verifier.py
CREATE TABLE IF NOT EXISTS cart_snapshots (
    snapshot_id     TEXT PRIMARY KEY,
    intent_id       TEXT NOT NULL REFERENCES intents(intent_id),
    cart_hash       TEXT NOT NULL,
    canonical_json  TEXT NOT NULL,
    taken_at        TEXT NOT NULL
);
```

### idempotency_keys
```sql
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
```

### audit_log (APPEND-ONLY)
```sql
-- APPEND-ONLY: no UPDATE or DELETE in agentguard/core/audit_log.py
CREATE TABLE IF NOT EXISTS audit_log (
    entry_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    prev_hash       TEXT NOT NULL,
    entry_hash      TEXT NOT NULL UNIQUE,
    intent_id       TEXT REFERENCES intents(intent_id),
    agent_id        TEXT NOT NULL,
    timestamp       TEXT NOT NULL,
    payload         TEXT NOT NULL,   -- Full JSON decision record
    final_decision  TEXT NOT NULL,   -- "allowed" | "blocked"
    block_reason    TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_id ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_final_decision ON audit_log(final_decision);
```

---

## Block Reason Codes

These are the only valid values for `block_reason`. Using constants prevents typos.

```python
# agentguard/constants.py
GENESIS_HASH = "GENESIS"

# Block reason codes
BLOCK_EXCEEDS_CAP = "exceeds_transaction_cap"
BLOCK_DAILY_CAP = "daily_spend_cap_exceeded"
BLOCK_CATEGORY = "category_not_allowed"
BLOCK_VELOCITY = "velocity_limit_exceeded"
BLOCK_HUMAN_REQUIRED = "human_confirmation_required"
BLOCK_ALL_BLOCKED = "emergency_block_all"
BLOCK_CART_INTEGRITY = "cart_integrity_failure"
BLOCK_REPLAY = "replay_detected"
BLOCK_CROSS_AGENT = "cross_agent_identity_violation"
BLOCK_PARSE_FAILED = "parse_failed"

# Decision codes
DECISION_ALLOWED = "allowed"
DECISION_BLOCKED = "blocked"

# Idempotency key status
KEY_STATUS_PENDING = "pending"
KEY_STATUS_EXECUTED = "executed"
KEY_STATUS_FAILED = "failed"
```

---

## Audit Log Entry Payload Schema

Every audit entry stores a complete, self-contained JSON record. The entry can be verified independently of any other table.

```json
{
  "intent_id": "uuid-string",
  "agent_id": "AgentBot-001",
  "timestamp": "2026-09-03T14:30:00.000Z",
  "raw_input": "buy running shoes, budget 7000",
  "bounded_intent": {
    "category": "footwear",
    "item_description": "running shoes",
    "max_amount_paise": 700000,
    "currency": "INR",
    "ttl_seconds": 3600
  },
  "policy_result": {
    "passed": true,
    "reason": null,
    "rule_triggered": null
  },
  "cart_integrity_result": {
    "passed": true,
    "changed_fields": [],
    "reason": null
  },
  "risk_check_result": {
    "passed": true,
    "anomaly_score": 0.0,
    "reason": null
  },
  "idempotency_result": {
    "passed": true,
    "reason": null
  },
  "final_decision": "allowed",
  "block_reason": null,
  "payment_result": {
    "razorpay_order_id": "order_XYZ",
    "payment_link_url": "https://rzp.io/l/abc",
    "status": "pending"
  }
}
```

---

*Extracted from: `Master_AgentGuard.md` §7, §13 · Adapted for SQLite. See `agentguard/models.py` for implementation.*
