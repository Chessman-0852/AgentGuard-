# Phase 2 — Deterministic Policy Gates

> **Status:** [ ] Not started
> **Estimated time:** 3 hours
> **Day:** 1, second block
> **Depends on:** Phase 1 (models, database, policy loader)

---

## Objective

Implement all four deterministic gate modules — Policy Engine, Cart Integrity Verifier, Risk Checker, and Idempotency Guard — as pure, independently unit-testable functions. No LLM calls. No network calls. No external dependencies beyond SQLite.

Every blocking decision in the entire system traces to one of these four modules. They must be correct before the LLM or Razorpay integration is touched.

---

## Scope

- `agentguard/core/policy_engine.py`
- `agentguard/core/cart_verifier.py`
- `agentguard/core/risk_checker.py`
- `agentguard/core/idempotency_guard.py`
- `tests/unit/test_policy_engine.py`
- `tests/unit/test_cart_verifier.py`
- `tests/unit/test_risk_checker.py`
- `tests/unit/test_idempotency_guard.py`

---

## Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Pure functions where possible | Policy engine and risk checker are stateless functions | Enables deterministic unit testing with no DB setup |
| DB access only where required | Cart verifier and idempotency guard need the DB | Cart snapshots and idempotency keys must persist across the authorization/execution gap |
| INSERT-then-check for idempotency | UNIQUE constraint on key, catch IntegrityError | Prevents the check-then-insert race condition; see gptPlan.md §10 |
| No OPA/Rego | Plain Python conditionals | gptPlan.md §7: OPA overhead unjustified at MVP scale; deterministic code is more auditable |
| Velocity window | 60-second sliding window using agent_state.last_request_at | Simple, no Redis required |
| Anomaly score | Advisory float only, never blocks alone | Preserves the core thesis: deterministic rules decide |

---

## Sequential Implementation Tasks

### Task 2.1 — agentguard/core/policy_engine.py

```python
# agentguard/core/policy_engine.py
"""
Deterministic policy evaluation. No LLM calls. No network calls.
Same input + same config = same output, always.
"""
from datetime import datetime
from agentguard.models import BoundedIntent, PolicyResult
from agentguard.config import PolicyConfig
from agentguard import constants


def _get_agent_daily_spend_paise(agent_id: str, db) -> int:
    """Return agent's daily spend in paise. Returns 0 if no history."""
    from sqlalchemy import text
    today = datetime.utcnow().date().isoformat()
    row = db.execute(
        text("SELECT daily_spend_paise FROM agent_state WHERE agent_id=:a AND date=:d"),
        {"a": agent_id, "d": today}
    ).fetchone()
    return row[0] if row else 0


def _get_agent_request_count_last_minute(agent_id: str, db) -> int:
    """Return number of requests from this agent in the past 60 seconds."""
    from sqlalchemy import text
    from datetime import timedelta
    window_start = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
    row = db.execute(
        text("""
            SELECT COUNT(*) FROM intents
            WHERE agent_id=:a AND created_at >= :w
        """),
        {"a": agent_id, "w": window_start}
    ).fetchone()
    return row[0] if row else 0


def check_policy(intent: BoundedIntent, policy: PolicyConfig, db) -> PolicyResult:
    """
    Evaluate all policy rules against the intent. Returns on first failure.
    Order matters: amount check before daily cap, category last.
    """
    # Fail-closed: if policy failed to load, block everything
    if policy.all_blocked:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_POLICY_UNAVAILABLE,
            rule_triggered="policy_unavailable"
        )

    # Rule 1: Transaction cap
    if intent.max_amount_paise > policy.max_transaction_amount_paise:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_EXCEEDS_TRANSACTION_CAP,
            rule_triggered="max_transaction_amount"
        )

    # Rule 2: Daily spend cap
    daily_spend = _get_agent_daily_spend_paise(intent.agent_id, db)
    if daily_spend + intent.max_amount_paise > policy.max_daily_spend_per_agent_paise:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_DAILY_CAP_EXCEEDED,
            rule_triggered="max_daily_spend_per_agent"
        )

    # Rule 3: Category allow-list
    if intent.category not in policy.allowed_categories:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_CATEGORY_NOT_ALLOWED,
            rule_triggered="allowed_categories"
        )

    # Rule 4: Human confirmation threshold (treated as a block at MVP — no async flow)
    if intent.max_amount_paise > policy.requires_human_confirmation_above_paise > 0:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_CONFIRMATION_REQUIRED,
            rule_triggered="requires_human_confirmation_above"
        )

    # Rule 5: Velocity check
    request_count = _get_agent_request_count_last_minute(intent.agent_id, db)
    if request_count >= policy.max_requests_per_minute_per_agent:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_VELOCITY_EXCEEDED,
            rule_triggered="max_requests_per_minute_per_agent"
        )

    return PolicyResult(passed=True)
```

### Task 2.2 — agentguard/core/cart_verifier.py

```python
# agentguard/core/cart_verifier.py
"""
Cart integrity verification via SHA-256 hash comparison.
Append-only: take_snapshot() only INSERTs, never UPDATEs.
"""
import hashlib
import json
import uuid
from datetime import datetime
from sqlalchemy import text
from agentguard.models import Cart, CartIntegrityResult
from agentguard import constants


def _compute_cart_hash(cart: Cart) -> str:
    """SHA-256 of the deterministic canonical_dict. Sorted keys, integer paise."""
    canonical = json.dumps(cart.canonical_dict(), sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def take_cart_snapshot(intent_id: str, cart: Cart, db) -> str:
    """
    Hash the cart and store the snapshot. Returns the cart_hash.
    APPEND-ONLY: no UPDATE or DELETE ever called here.
    """
    cart_hash = _compute_cart_hash(cart)
    canonical_json = json.dumps(cart.canonical_dict(), sort_keys=True, ensure_ascii=True)
    db.execute(
        text("""
            INSERT OR IGNORE INTO cart_snapshots
            (snapshot_id, intent_id, cart_hash, canonical_json, taken_at)
            VALUES (:sid, :iid, :hash, :json, :ts)
        """),
        {
            "sid": str(uuid.uuid4()),
            "iid": intent_id,
            "hash": cart_hash,
            "json": canonical_json,
            "ts": datetime.utcnow().isoformat(),
        }
    )
    db.commit()
    return cart_hash


def verify_cart_integrity(intent_id: str, current_cart: Cart, db) -> CartIntegrityResult:
    """
    Compare the current cart hash against the stored snapshot.
    Fail-closed: if no snapshot exists, return failed result.
    """
    row = db.execute(
        text("SELECT cart_hash, canonical_json FROM cart_snapshots WHERE intent_id=:iid ORDER BY taken_at ASC LIMIT 1"),
        {"iid": intent_id}
    ).fetchone()

    if not row:
        return CartIntegrityResult(
            passed=False,
            reason=constants.BLOCK_NO_CART_SNAPSHOT,
            changed_fields=["snapshot_missing"]
        )

    stored_hash, stored_json = row[0], row[1]
    current_hash = _compute_cart_hash(current_cart)

    if current_hash == stored_hash:
        return CartIntegrityResult(passed=True)

    # Compute diff: which top-level fields changed
    stored_dict = json.loads(stored_json)
    current_dict = current_cart.canonical_dict()
    changed_fields = _compute_diff(stored_dict, current_dict)

    return CartIntegrityResult(
        passed=False,
        reason=constants.BLOCK_CART_INTEGRITY_FAILURE,
        changed_fields=changed_fields
    )


def _compute_diff(stored: dict, current: dict) -> list[str]:
    """Return list of top-level field names that differ."""
    changed = []
    all_keys = set(stored.keys()) | set(current.keys())
    for k in all_keys:
        if stored.get(k) != current.get(k):
            changed.append(k)
    return sorted(changed)
```

### Task 2.3 — agentguard/core/risk_checker.py

```python
# agentguard/core/risk_checker.py
"""
Rule-based risk evaluation. Anomaly score is ADVISORY ONLY — never blocks alone.
All blocking decisions come from deterministic rules only.
"""
import statistics
from sqlalchemy import text
from agentguard.models import BoundedIntent, RiskResult
from agentguard.config import PolicyConfig
from agentguard import constants


def _get_agent_transaction_history_paise(agent_id: str, db) -> list[int]:
    """Return list of historical max_amount_paise values for this agent."""
    rows = db.execute(
        text("""
            SELECT json_extract(parsed_json, '$.max_amount_paise')
            FROM intents
            WHERE agent_id=:a AND status='completed'
            ORDER BY created_at DESC
            LIMIT 50
        """),
        {"a": agent_id}
    ).fetchall()
    return [row[0] for row in rows if row[0] is not None]


def compute_anomaly_score(agent_id: str, amount_paise: int, db) -> float:
    """
    Z-score of amount against agent's historical amounts.
    Returns 0.0 if fewer than 5 historical transactions (insufficient data).
    ADVISORY ONLY — this score never triggers a block by itself.
    """
    history = _get_agent_transaction_history_paise(agent_id, db)
    if len(history) < 5:
        return 0.0
    mean = statistics.mean(history)
    stdev = statistics.stdev(history)
    if stdev == 0:
        return 0.0
    return (amount_paise - mean) / stdev


def check_risk(intent: BoundedIntent, policy: PolicyConfig, db) -> RiskResult:
    """
    Deterministic risk check (velocity is already checked in policy_engine).
    Computes advisory anomaly score but never blocks on it alone.
    """
    anomaly_score = compute_anomaly_score(intent.agent_id, intent.max_amount_paise, db)

    # No deterministic blocking rule in risk checker currently triggers independently.
    # The velocity check lives in policy_engine (Rule 5) to keep the single-pass flow.
    # Anomaly score is logged to audit but does not block.
    return RiskResult(passed=True, anomaly_score=anomaly_score)
```

### Task 2.4 — agentguard/core/idempotency_guard.py

```python
# agentguard/core/idempotency_guard.py
"""
Replay attack prevention via SQLite unique constraint.
Uses INSERT-then-catch-IntegrityError to prevent race conditions.
"""
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from agentguard.models import IdempotencyResult
from agentguard import constants


def check_and_reserve_idempotency_key(
    idempotency_key: str,
    intent_id: str,
    agent_id: str,
    ttl_seconds: int,
    db,
) -> IdempotencyResult:
    """
    Attempt to INSERT the idempotency key. If the INSERT succeeds, the request
    is new and allowed to proceed. If it fails (IntegrityError), check the status
    of the existing record.

    Status transitions:
      pending   -> block (in-flight or race condition)
      executed  -> block (replay attack)
      failed    -> allow retry (payment failed, not a replay)
      expired   -> allow (treat as new request)
    """
    now = datetime.utcnow()
    expires_at = now + timedelta(seconds=ttl_seconds)

    # Try to INSERT — this is atomic and race-safe due to UNIQUE PRIMARY KEY
    try:
        db.execute(
            text("""
                INSERT INTO idempotency_keys
                (key, intent_id, agent_id, status, created_at, expires_at)
                VALUES (:k, :iid, :aid, 'pending', :now, :exp)
            """),
            {
                "k": idempotency_key,
                "iid": intent_id,
                "aid": agent_id,
                "now": now.isoformat(),
                "exp": expires_at.isoformat(),
            }
        )
        db.commit()
        return IdempotencyResult(passed=True)
    except IntegrityError:
        db.rollback()

    # Key already exists — look up its state
    row = db.execute(
        text("SELECT status, executed_at, expires_at, agent_id FROM idempotency_keys WHERE key=:k"),
        {"k": idempotency_key}
    ).fetchone()

    if not row:
        # Should be impossible — INSERT failed but SELECT found nothing
        return IdempotencyResult(passed=False, reason=constants.BLOCK_REPLAY_DETECTED)

    status, executed_at_str, expires_at_str, existing_agent_id = row

    # Cross-agent identity confusion: same key, different agent
    if existing_agent_id != agent_id:
        return IdempotencyResult(passed=False, reason=constants.BLOCK_CROSS_AGENT_IDENTITY)

    # Expired key: treat as new
    if expires_at_str and datetime.fromisoformat(expires_at_str) < now:
        return IdempotencyResult(passed=True)

    if status == constants.IDEM_STATUS_FAILED:
        # Payment failed — allow retry
        db.execute(
            text("UPDATE idempotency_keys SET status='pending', created_at=:now, expires_at=:exp WHERE key=:k"),
            {"k": idempotency_key, "now": now.isoformat(), "exp": expires_at.isoformat()}
        )
        db.commit()
        return IdempotencyResult(passed=True)

    if status == constants.IDEM_STATUS_EXECUTED:
        exec_at = datetime.fromisoformat(executed_at_str) if executed_at_str else None
        return IdempotencyResult(
            passed=False,
            reason=constants.BLOCK_REPLAY_DETECTED,
            original_execution_at=exec_at
        )

    # status == pending: in-flight or race condition — block
    return IdempotencyResult(passed=False, reason=constants.BLOCK_REPLAY_DETECTED)


def mark_idempotency_key_executed(idempotency_key: str, payment_id: str, db) -> None:
    """Called after successful Razorpay payment. Transitions pending -> executed."""
    db.execute(
        text("""
            UPDATE idempotency_keys
            SET status='executed', executed_at=:now, payment_id=:pid
            WHERE key=:k
        """),
        {"k": idempotency_key, "now": datetime.utcnow().isoformat(), "pid": payment_id}
    )
    db.commit()


def mark_idempotency_key_failed(idempotency_key: str, db) -> None:
    """Called after failed Razorpay payment. Transitions pending -> failed (retry allowed)."""
    db.execute(
        text("UPDATE idempotency_keys SET status='failed' WHERE key=:k"),
        {"k": idempotency_key}
    )
    db.commit()
```

### Task 2.5 — Write Unit Tests

Create `tests/unit/test_policy_engine.py`:

```python
# tests/unit/test_policy_engine.py
import pytest
from unittest.mock import MagicMock
from agentguard.models import BoundedIntent
from agentguard.config import PolicyConfig
from agentguard.core.policy_engine import check_policy
from agentguard import constants


def make_intent(**kwargs):
    defaults = dict(
        agent_id="agent-001",
        category="footwear",
        item_description="running shoes",
        max_amount_paise=350000,
        raw_input="buy shoes",
    )
    defaults.update(kwargs)
    return BoundedIntent(**defaults)


def make_policy(**kwargs):
    defaults = dict(
        max_transaction_amount_paise=700000,
        max_daily_spend_per_agent_paise=1500000,
        requires_human_confirmation_above_paise=500000,
        allowed_categories=["footwear", "groceries", "electronics-accessories"],
        max_requests_per_minute_per_agent=5,
        idempotency_key_ttl_seconds=86400,
        all_blocked=False,
    )
    defaults.update(kwargs)
    return PolicyConfig(**defaults)


def mock_db(daily_spend=0, request_count=0):
    db = MagicMock()
    db.execute.return_value.fetchone.side_effect = [
        (daily_spend,) if daily_spend else None,
        (request_count,),
    ]
    return db


class TestPolicyEngine:
    def test_policy_unavailable_blocks_all(self):
        intent = make_intent()
        policy = PolicyConfig(all_blocked=True)
        result = check_policy(intent, policy, mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_POLICY_UNAVAILABLE

    def test_at_cap_is_allowed(self):
        intent = make_intent(max_amount_paise=700000)
        result = check_policy(intent, make_policy(), mock_db())
        assert result.passed

    def test_one_paise_over_cap_is_blocked(self):
        intent = make_intent(max_amount_paise=700001)
        result = check_policy(intent, make_policy(), mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_EXCEEDS_TRANSACTION_CAP
        assert result.rule_triggered == "max_transaction_amount"

    def test_daily_cap_exceeded_is_blocked(self):
        intent = make_intent(max_amount_paise=700000)
        # daily_spend=900000, request = 700000, total = 1600000 > 1500000
        result = check_policy(intent, make_policy(), mock_db(daily_spend=900000))
        assert not result.passed
        assert result.reason == constants.BLOCK_DAILY_CAP_EXCEEDED

    def test_allowed_category_passes(self):
        for cat in ["footwear", "groceries", "electronics-accessories"]:
            intent = make_intent(category=cat)
            result = check_policy(intent, make_policy(), mock_db())
            assert result.passed, f"Category {cat} should be allowed"

    def test_disallowed_category_blocked(self):
        intent = make_intent(category="luxury-watches")
        result = check_policy(intent, make_policy(), mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_CATEGORY_NOT_ALLOWED

    def test_velocity_exceeded_blocked(self):
        intent = make_intent()
        result = check_policy(intent, make_policy(), mock_db(request_count=5))
        assert not result.passed
        assert result.reason == constants.BLOCK_VELOCITY_EXCEEDED

    def test_confirmation_required_blocks(self):
        # 600000 paise = 6000 INR > 5000 INR confirmation threshold
        intent = make_intent(max_amount_paise=600000)
        policy = make_policy(requires_human_confirmation_above_paise=500000)
        result = check_policy(intent, policy, mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_CONFIRMATION_REQUIRED

    def test_category_normalization(self):
        # "Footwear" and "FOOTWEAR" should both pass
        for cat in ["Footwear", "FOOTWEAR", "footwear "]:
            intent = make_intent(category=cat)
            result = check_policy(intent, make_policy(), mock_db())
            assert result.passed, f"Category '{cat}' should normalize to 'footwear'"
```

Create `tests/unit/test_cart_verifier.py`:

```python
# tests/unit/test_cart_verifier.py
import pytest
from unittest.mock import MagicMock, patch
from agentguard.models import Cart, CartItem
from agentguard.core.cart_verifier import take_cart_snapshot, verify_cart_integrity, _compute_cart_hash
from agentguard import constants


def make_cart(price_paise=350000, quantity=1, sku="SHOE-001"):
    return Cart(
        intent_id="intent-001",
        merchant_id="merchant-001",
        items=[CartItem(sku=sku, name="shoe", price_paise=price_paise, quantity=quantity, merchant_id="merchant-001")]
    )


class TestCartVerifier:
    def test_identical_cart_passes(self):
        cart = make_cart()
        h1 = _compute_cart_hash(cart)
        h2 = _compute_cart_hash(cart)
        assert h1 == h2, "Same cart must produce same hash"

    def test_price_change_changes_hash(self):
        cart_original = make_cart(price_paise=350000)
        cart_tampered = make_cart(price_paise=700000)
        assert _compute_cart_hash(cart_original) != _compute_cart_hash(cart_tampered)

    def test_quantity_change_changes_hash(self):
        cart_original = make_cart(quantity=1)
        cart_tampered = make_cart(quantity=2)
        assert _compute_cart_hash(cart_original) != _compute_cart_hash(cart_tampered)

    def test_no_snapshot_fails_closed(self):
        db = MagicMock()
        db.execute.return_value.fetchone.return_value = None
        result = verify_cart_integrity("intent-xxx", make_cart(), db)
        assert not result.passed
        assert result.reason == constants.BLOCK_NO_CART_SNAPSHOT

    def test_unchanged_cart_passes_after_snapshot(self, tmp_path):
        """Integration-style: write snapshot then verify same cart passes."""
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        from agentguard.database import Base, init_db
        import os
        db_path = str(tmp_path / "test.db")
        from agentguard.database import engine as _e
        # Use a fresh in-memory engine for this test
        from sqlalchemy import create_engine as ce, text, event
        eng = ce(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        @event.listens_for(eng, "connect")
        def set_wal(conn, _): conn.execute("PRAGMA journal_mode=WAL")
        Session = sessionmaker(bind=eng)
        with open("migrations/001_initial_schema.sql") as f:
            sql = f.read()
        with eng.connect() as conn:
            for stmt in sql.split(";"):
                s = stmt.strip()
                if s: conn.execute(text(s))
            conn.commit()
        db = Session()
        # Create a dummy intent row first (FK constraint)
        db.execute(text("INSERT INTO intents (intent_id, agent_id, raw_input, idempotency_key, created_at, expires_at) VALUES ('intent-001', 'agent-001', 'test', 'key-001', '2026-01-01', '2026-12-31')"))
        db.commit()

        cart = make_cart()
        take_cart_snapshot("intent-001", cart, db)
        result = verify_cart_integrity("intent-001", cart, db)
        assert result.passed

    def test_tampered_price_blocked_with_diff(self, tmp_path):
        # Same setup as above — use shared fixture in real test suite
        pass  # Implemented as integration test in tests/integration/test_pipeline.py
```

---

## Validation Strategy

```bash
# Run all unit tests for Phase 2
pytest tests/unit/test_policy_engine.py -v
pytest tests/unit/test_cart_verifier.py -v
pytest tests/unit/test_risk_checker.py -v
pytest tests/unit/test_idempotency_guard.py -v

# All must pass before moving to Phase 3
```

---

## Acceptance Criteria

- [ ] `pytest tests/unit/test_policy_engine.py` — all 9 tests pass
- [ ] At-cap intent (max_amount_paise=700000) passes policy check
- [ ] One-paise-over-cap intent (max_amount_paise=700001) is blocked with `reason="exceeds_transaction_cap"`
- [ ] Category "luxury-watches" is blocked with `reason="category_not_allowed"`
- [ ] Missing policy.yaml (all_blocked=True) blocks all intents with `reason="policy_unavailable"`
- [ ] `_compute_cart_hash()` is deterministic: identical carts produce identical hashes
- [ ] Cart with changed `price_paise` produces a different hash than the original
- [ ] No snapshot found -> `CartIntegrityResult(passed=False, reason="no_cart_snapshot")`
- [ ] `check_and_reserve_idempotency_key()` with a new key returns `passed=True`
- [ ] Second call with same key and status "pending" returns `passed=False, reason="replay_detected"`
- [ ] Third call after `mark_idempotency_key_failed()` returns `passed=True` (retry allowed)
- [ ] Same key, different agent_id returns `passed=False, reason="cross_agent_identity_violation"`
- [ ] `compute_anomaly_score()` returns 0.0 when fewer than 5 historical transactions

---

## Risks & Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SQLite IntegrityError not raised as expected | Low | High | Test with in-memory SQLite in unit test for idempotency guard |
| Canonical cart JSON non-determinism (key ordering) | Low | High | Always use `json.dumps(..., sort_keys=True)` — verified in acceptance criteria |
| SIGHUP policy reload changing policy mid-test | Low | Low | Unit tests use hardcoded PolicyConfig objects, not loaded from file |

---

## Deliverables

- `agentguard/core/policy_engine.py`
- `agentguard/core/cart_verifier.py`
- `agentguard/core/risk_checker.py`
- `agentguard/core/idempotency_guard.py`
- `tests/unit/test_policy_engine.py` (9 test cases)
- `tests/unit/test_cart_verifier.py` (4 test cases)
- `tests/unit/test_risk_checker.py` (2 test cases)
- `tests/unit/test_idempotency_guard.py` (4 test cases)

---

## Documentation Updates

- `BUILD_LOG.md`: Note the INSERT-then-catch-IntegrityError decision for race-safe idempotency.
- `BUILD_LOG.md`: Note that anomaly score is advisory only — document why it does not block.
