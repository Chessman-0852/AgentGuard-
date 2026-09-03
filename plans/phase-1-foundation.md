# Phase 1 — Foundation & Data Models

> **Status:** [ ] Not started
> **Estimated time:** 2.5 hours
> **Day:** 1, first task
> **Depends on:** Nothing — this is the root phase

---

## Objective

Create the complete project skeleton, all Pydantic data models, the SQLite database schema, the policy.yaml configuration loader, and the synthetic merchant catalog. Every subsequent phase imports from this phase.

---

## Scope

- Project directory structure
- Python virtual environment and `requirements.txt`
- All Pydantic models (`BoundedIntent`, `CartItem`, `CartSnapshot`, `PolicyResult`, `CartIntegrityResult`, `RiskResult`, `IdempotencyResult`, `AuditEntry`)
- SQLite schema (5 tables) with WAL mode enabled and append-only enforcement
- `policy.yaml` with the demo configuration
- `PolicyConfig` loader with fail-closed behavior
- `.env.example` template
- Synthetic merchant catalog (`synthetic/catalog.json`, 12 SKUs)
- Shared constants (`agentguard/constants.py`)

---

## Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Database | SQLite (WAL mode) | Blueprint D2: 2-day timeline eliminates need for PostgreSQL/Docker overhead |
| ORM | SQLAlchemy 2.0 (sync, not async) | Simplest for SQLite; async adds complexity with no benefit at demo scale |
| Schema enforcement | Application-level append-only guards | SQLite has no role-level REVOKE; documented trade-off in BUILD_LOG |
| Amount representation | Integer paise everywhere | Prevents float comparison errors; Razorpay API also uses smallest currency unit |
| Policy format | YAML file, loaded at startup | Blueprint D2/D3: config-driven, hot-reloadable, no-code merchant control |
| Fail-closed | Missing or malformed policy.yaml -> PolicyConfig with all_blocked=True | P5 principle: ambiguous state defaults to block |

---

## Directory Structure

Create the following structure verbatim:

```
agentguard/                  # Root project directory
+-- agentguard/              # Python package
|   +-- __init__.py
|   +-- constants.py         # GENESIS_HASH, status literals, category list
|   +-- models.py            # All Pydantic models
|   +-- config.py            # PolicyConfig + YAML loader
|   +-- database.py          # SQLAlchemy engine, session, Base
|   +-- core/
|   |   +-- __init__.py
|   |   +-- policy_engine.py
|   |   +-- cart_verifier.py
|   |   +-- risk_checker.py
|   |   +-- idempotency_guard.py
|   |   +-- intent_parser.py
|   |   +-- audit_log.py
|   +-- executor/
|   |   +-- __init__.py
|   |   +-- razorpay_client.py
|   +-- api/
|   |   +-- __init__.py
|   |   +-- main.py
|   |   +-- routes/
|   |       +-- __init__.py
|   |       +-- intents.py
|   |       +-- audit.py
|   |       +-- webhooks.py
+-- dashboard/
|   +-- app.py
+-- synthetic/
|   +-- catalog.json
|   +-- scenarios.py
+-- migrations/
|   +-- 001_initial_schema.sql
+-- scripts/
|   +-- verify_audit_chain.py
+-- tests/
|   +-- __init__.py
|   +-- unit/
|   |   +-- __init__.py
|   |   +-- test_policy_engine.py
|   |   +-- test_cart_verifier.py
|   |   +-- test_risk_checker.py
|   |   +-- test_idempotency_guard.py
|   |   +-- test_audit_log.py
|   +-- integration/
|       +-- __init__.py
|       +-- test_pipeline.py
+-- policy.yaml
+-- .env.example
+-- requirements.txt
+-- README.md
+-- BUILD_LOG.md
+-- .gitignore
```

---

## Sequential Implementation Tasks

### Task 1.1 — Create project directory and virtual environment

```bash
# Run from the directory where you want the project
mkdir agentguard && cd agentguard
python -m venv venv
venv\Scripts\activate   # Windows
# OR: source venv/bin/activate  (Linux/Mac)
```

Create `.gitignore`:
```
venv/
__pycache__/
*.pyc
.env
*.db
*.db-journal
*.db-wal
*.db-shm
.pytest_cache/
```

### Task 1.2 — Create requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy==2.0.35
pydantic==2.9.2
pydantic-settings==2.5.2
pyyaml==6.0.2
python-dotenv==1.0.1
groq==0.11.0
razorpay==1.4.1
streamlit==1.38.0
structlog==24.4.0
pytest==8.3.3
pytest-asyncio==0.24.0
httpx==0.27.2
```

Install: `pip install -r requirements.txt`

### Task 1.3 — Create agentguard/constants.py

```python
# agentguard/constants.py

GENESIS_HASH = "GENESIS"

# Intent lifecycle statuses
STATUS_PARSED = "parsed"
STATUS_POLICY_CHECK = "policy_check"
STATUS_CART_CHECK = "cart_check"
STATUS_RISK_CHECK = "risk_check"
STATUS_IDEMPOTENCY_CHECK = "idempotency_check"
STATUS_EXECUTING = "executing"
STATUS_COMPLETED = "completed"
STATUS_BLOCKED = "blocked"
STATUS_FAILED = "failed"

# Idempotency key statuses
IDEM_STATUS_PENDING = "pending"
IDEM_STATUS_EXECUTED = "executed"
IDEM_STATUS_FAILED = "failed"

# Block reason codes (deterministic, never from LLM)
BLOCK_EXCEEDS_TRANSACTION_CAP = "exceeds_transaction_cap"
BLOCK_DAILY_CAP_EXCEEDED = "daily_cap_exceeded"
BLOCK_CATEGORY_NOT_ALLOWED = "category_not_allowed"
BLOCK_CONFIRMATION_REQUIRED = "confirmation_required"
BLOCK_VELOCITY_EXCEEDED = "velocity_exceeded"
BLOCK_CART_INTEGRITY_FAILURE = "cart_integrity_failure"
BLOCK_REPLAY_DETECTED = "replay_detected"
BLOCK_INTENT_EXPIRED = "intent_expired"
BLOCK_POLICY_UNAVAILABLE = "policy_unavailable"
BLOCK_NO_CART_SNAPSHOT = "no_cart_snapshot"
BLOCK_CROSS_AGENT_IDENTITY = "cross_agent_identity_violation"

# Final decision values
DECISION_ALLOWED = "allowed"
DECISION_BLOCKED = "blocked"
```

### Task 1.4 — Create agentguard/models.py

```python
# agentguard/models.py
from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class MerchantConstraints(BaseModel):
    allowed_merchant_ids: list[str] = Field(default_factory=list)
    blocked_merchant_ids: list[str] = Field(default_factory=list)


class BoundedIntent(BaseModel):
    intent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    idempotency_key: str = ""          # Set by intent_parser after creation
    category: str
    item_description: str
    max_amount_paise: int              # Always in paise; NEVER float rupees
    currency: str = "INR"
    merchant_constraints: MerchantConstraints = Field(default_factory=MerchantConstraints)
    ttl_seconds: int = 3600
    created_at: datetime = Field(default_factory=datetime.utcnow)
    raw_input: str = ""

    @field_validator("category")
    @classmethod
    def normalize_category(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("max_amount_paise")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("max_amount_paise must be positive")
        return v


class CartItem(BaseModel):
    sku: str
    name: str
    price_paise: int        # Integer paise — no floats
    quantity: int
    merchant_id: str

    @field_validator("price_paise", "quantity")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("price_paise and quantity must be positive")
        return v


class Cart(BaseModel):
    intent_id: str
    merchant_id: str
    currency: str = "INR"
    items: list[CartItem]

    def total_paise(self) -> int:
        return sum(item.price_paise * item.quantity for item in self.items)

    def canonical_dict(self) -> dict:
        """Deterministic representation for hashing. Sorted keys, sorted items."""
        return {
            "currency": self.currency,
            "items": sorted(
                [
                    {
                        "merchant_id": item.merchant_id,
                        "price_paise": item.price_paise,
                        "quantity": item.quantity,
                        "sku": item.sku,
                    }
                    for item in self.items
                ],
                key=lambda x: x["sku"],
            ),
            "merchant_id": self.merchant_id,
        }


# --- Gate Result Models ---

class PolicyResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    rule_triggered: Optional[str] = None


class CartIntegrityResult(BaseModel):
    passed: bool
    changed_fields: list[str] = Field(default_factory=list)
    reason: Optional[str] = None


class RiskResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    rule_triggered: Optional[str] = None
    anomaly_score: float = 0.0        # Advisory only — never blocks alone


class IdempotencyResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    original_execution_at: Optional[datetime] = None


# --- Audit Entry (write path; read path uses DB row directly) ---

class GateResults(BaseModel):
    policy: PolicyResult
    cart_integrity: CartIntegrityResult
    risk: RiskResult
    idempotency: IdempotencyResult


class PaymentResult(BaseModel):
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    payment_link_url: Optional[str] = None
    status: Optional[str] = None     # "success" | "failed" | "pending" | None
```

### Task 1.5 — Create agentguard/config.py

```python
# agentguard/config.py
import signal
import logging
from dataclasses import dataclass, field
from typing import Optional
import yaml

logger = logging.getLogger(__name__)

POLICY_FILE_PATH = "policy.yaml"


@dataclass
class PolicyConfig:
    max_transaction_amount_paise: int = 0          # 0 = block all (fail-closed default)
    max_daily_spend_per_agent_paise: int = 0
    requires_human_confirmation_above_paise: int = 0
    allowed_categories: list = field(default_factory=list)
    max_requests_per_minute_per_agent: int = 0
    idempotency_key_ttl_seconds: int = 86400       # 24h default
    all_blocked: bool = True                       # True until a valid policy is loaded


_current_policy: Optional[PolicyConfig] = None


def _parse_ttl(ttl_str: str) -> int:
    """Parse '24h' -> 86400, '30m' -> 1800, integers treated as seconds."""
    ttl_str = str(ttl_str).strip()
    if ttl_str.endswith("h"):
        return int(ttl_str[:-1]) * 3600
    if ttl_str.endswith("m"):
        return int(ttl_str[:-1]) * 60
    return int(ttl_str)


def _rupees_to_paise(rupees) -> int:
    """Convert a rupee value (int or float) to integer paise."""
    return int(round(float(rupees) * 100))


def load_policy(path: str = POLICY_FILE_PATH) -> PolicyConfig:
    """Load policy.yaml. Returns a fail-closed PolicyConfig on any error."""
    global _current_policy
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise ValueError("policy.yaml must be a YAML mapping")

        _current_policy = PolicyConfig(
            max_transaction_amount_paise=_rupees_to_paise(data["max_transaction_amount"]),
            max_daily_spend_per_agent_paise=_rupees_to_paise(data["max_daily_spend_per_agent"]),
            requires_human_confirmation_above_paise=_rupees_to_paise(
                data.get("requires_human_confirmation_above", 0)
            ),
            allowed_categories=[c.strip().lower() for c in data.get("allowed_categories", [])],
            max_requests_per_minute_per_agent=int(data.get("max_requests_per_minute_per_agent", 5)),
            idempotency_key_ttl_seconds=_parse_ttl(data.get("idempotency_key_ttl", "24h")),
            all_blocked=False,
        )
        logger.info(f"Policy loaded from {path}")
        return _current_policy
    except Exception as e:
        logger.critical(f"Failed to load policy from {path}: {e}. Starting in FAIL-CLOSED mode.")
        _current_policy = PolicyConfig(all_blocked=True)
        return _current_policy


def get_policy() -> PolicyConfig:
    """Return the current loaded policy. Loads on first call."""
    global _current_policy
    if _current_policy is None:
        load_policy()
    return _current_policy


def setup_sighup_reload():
    """Register SIGHUP handler to hot-reload policy without restart."""
    def _handler(signum, frame):
        logger.info("SIGHUP received — reloading policy.yaml")
        load_policy()
    signal.signal(signal.SIGHUP, _handler)
```

### Task 1.6 — Create policy.yaml

```yaml
# policy.yaml — AgentGuard demo configuration
# Amounts in INR (rupees). System converts to paise internally.

max_transaction_amount: 7000
max_daily_spend_per_agent: 15000
requires_human_confirmation_above: 5000

allowed_categories:
  - footwear
  - groceries
  - electronics-accessories

max_requests_per_minute_per_agent: 5
idempotency_key_ttl: 24h
```

### Task 1.7 — Create agentguard/database.py

```python
# agentguard/database.py
import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agentguard.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

# Enable WAL mode for SQLite — required for concurrent reads during Streamlit polling
if "sqlite" in DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_wal_mode(dbapi_conn, connection_record):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Task 1.8 — Create migrations/001_initial_schema.sql

```sql
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
```

### Task 1.9 — Create DB migration runner

Add to `agentguard/database.py`:

```python
def init_db():
    """Create all tables from the migration SQL file."""
    migration_path = os.path.join(os.path.dirname(__file__), "..", "migrations", "001_initial_schema.sql")
    with open(migration_path, "r") as f:
        sql = f.read()
    with engine.connect() as conn:
        for statement in sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))
        conn.commit()
```

### Task 1.10 — Create synthetic/catalog.json

```json
{
  "catalog": [
    {"sku": "SHOE-001", "name": "Running Shoes Pro", "category": "footwear", "price_paise": 350000, "merchant_id": "merchant-001"},
    {"sku": "SHOE-002", "name": "Trail Running Shoes", "category": "footwear", "price_paise": 450000, "merchant_id": "merchant-001"},
    {"sku": "SHOE-003", "name": "Road Running Shoes Lite", "category": "footwear", "price_paise": 280000, "merchant_id": "merchant-001"},
    {"sku": "SHOE-004", "name": "Marathon Racing Flats", "category": "footwear", "price_paise": 699900, "merchant_id": "merchant-001"},
    {"sku": "GROC-001", "name": "Organic Muesli 1kg", "category": "groceries", "price_paise": 52000, "merchant_id": "merchant-002"},
    {"sku": "GROC-002", "name": "Oat Milk 1L x6", "category": "groceries", "price_paise": 89400, "merchant_id": "merchant-002"},
    {"sku": "GROC-003", "name": "Whey Protein 1kg", "category": "groceries", "price_paise": 249900, "merchant_id": "merchant-002"},
    {"sku": "GROC-004", "name": "Electrolyte Sachets x20", "category": "groceries", "price_paise": 45000, "merchant_id": "merchant-002"},
    {"sku": "ELEC-001", "name": "USB-C Hub 7-port", "category": "electronics-accessories", "price_paise": 189900, "merchant_id": "merchant-003"},
    {"sku": "ELEC-002", "name": "Wireless Earbuds Sport", "category": "electronics-accessories", "price_paise": 399900, "merchant_id": "merchant-003"},
    {"sku": "ELEC-003", "name": "Running GPS Watch Strap", "category": "electronics-accessories", "price_paise": 149900, "merchant_id": "merchant-003"},
    {"sku": "ELEC-004", "name": "Heart Rate Monitor Chest Strap", "category": "electronics-accessories", "price_paise": 279900, "merchant_id": "merchant-003"}
  ]
}
```

### Task 1.11 — Create .env.example

```bash
# .env.example — Copy to .env and fill in real values. NEVER commit .env.
# -----------------------------------------------------------------------

# Groq API (LLM — Intent Parsing & Block Explanation)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL_INTENT=llama-3.3-70b-versatile
GROQ_MODEL_EXPLAIN=llama-3.1-8b-instant
GROQ_MODEL_FALLBACK=mixtral-8x7b-32768

# Razorpay (TEST MODE ONLY — never use production keys)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Database
DATABASE_URL=sqlite:///./agentguard.db

# App
SECRET_KEY=generate_with_python_secrets_token_hex_32
LOG_LEVEL=DEBUG
```

---

## Validation Strategy

Run the following after completing all tasks:

```bash
# 1. Verify package imports cleanly
python -c "from agentguard.models import BoundedIntent, Cart; print('models OK')"
python -c "from agentguard.config import load_policy; p = load_policy(); print(f'policy OK: {p.all_blocked}')"
python -c "from agentguard.database import init_db; init_db(); print('DB init OK')"

# 2. Verify fail-closed behavior
python -c "
from agentguard.config import load_policy
p = load_policy('/nonexistent.yaml')
assert p.all_blocked == True, 'FAIL: policy should be fail-closed'
print('Fail-closed OK')
"

# 3. Verify paise conversion
python -c "
from agentguard.config import load_policy
p = load_policy()
assert p.max_transaction_amount_paise == 700000, f'FAIL: expected 700000, got {p.max_transaction_amount_paise}'
print(f'Paise conversion OK: 7000 INR = {p.max_transaction_amount_paise} paise')
"

# 4. Verify cart canonical hashing is deterministic
python -c "
from agentguard.models import Cart, CartItem
c = Cart(intent_id='x', merchant_id='m', items=[
    CartItem(sku='A', name='shoe', price_paise=100, quantity=1, merchant_id='m'),
    CartItem(sku='B', name='sock', price_paise=50, quantity=2, merchant_id='m'),
])
import json, hashlib
h1 = hashlib.sha256(json.dumps(c.canonical_dict(), sort_keys=True).encode()).hexdigest()
h2 = hashlib.sha256(json.dumps(c.canonical_dict(), sort_keys=True).encode()).hexdigest()
assert h1 == h2
print(f'Canonical hash deterministic: {h1[:16]}...')
"
```

---

## Acceptance Criteria

All of the following must be true before Phase 1 is marked complete:

- [ ] `pip install -r requirements.txt` succeeds with no errors
- [ ] `from agentguard.models import BoundedIntent` imports without error
- [ ] `from agentguard.config import load_policy` imports without error
- [ ] `load_policy()` with valid `policy.yaml` returns `all_blocked=False` and `max_transaction_amount_paise=700000`
- [ ] `load_policy("/nonexistent.yaml")` returns `all_blocked=True` (fail-closed)
- [ ] `from agentguard.database import init_db; init_db()` creates `agentguard.db` with all 5 tables
- [ ] `Cart.canonical_dict()` produces identical output on two calls with the same input (determinism test)
- [ ] `BoundedIntent(max_amount_paise=-100, ...)` raises a `ValidationError`
- [ ] `policy.yaml` exists in repo root and parses without error
- [ ] `.env.example` exists in repo root with all required variable names
- [ ] `synthetic/catalog.json` contains exactly 12 items across 3 categories (4 per category)

---

## Risks & Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SQLite WAL mode not enabling correctly | Low | Medium | Add assertion in init_db() that `PRAGMA journal_mode` returns "wal" |
| Pydantic v2 breaking changes vs v1 API | Low | Low | requirements.txt pins pydantic==2.9.2; use model_config instead of class Config |
| SIGHUP not available on Windows | Medium | Low | setup_sighup_reload() is a no-op on Windows; policy reload happens at startup only |

---

## Deliverables

- `agentguard/` package with `__init__.py`, `constants.py`, `models.py`, `config.py`, `database.py`
- `agentguard/core/__init__.py`, `agentguard/executor/__init__.py`, `agentguard/api/__init__.py` (empty stubs)
- `migrations/001_initial_schema.sql`
- `policy.yaml`
- `.env.example`
- `synthetic/catalog.json` (12 SKUs)
- `requirements.txt`

---

## Documentation Updates

- Start `BUILD_LOG.md` with first entry: `[D4] Groq/Llama-3.3-70b-versatile confirmed as LLM provider`
- Start `BUILD_LOG.md` with second entry: `[D2] SQLite WAL selected over PostgreSQL — 2-day timeline constraint`
- Start `BUILD_LOG.md` with third entry: `[D3] Streamlit selected over React — eliminates second toolchain`
