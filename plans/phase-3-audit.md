# Phase 3 — Hash-Chained Audit Log

> **Status:** [ ] Not started
> **Estimated time:** 2 hours
> **Day:** 1, third block
> **Depends on:** Phase 1 (models, database)

---

## Objective

Build the hash-chained, append-only audit log module and the standalone `verify_audit_chain.py` verification script. The audit log is a core deliverable — every request (allowed or blocked) produces exactly one entry, and the hash chain proves the history has not been tampered with. This must be completed and tested before Phase 6 wires it into the pipeline.

---

## Scope

- `agentguard/core/audit_log.py` — append-only write and read functions
- `scripts/verify_audit_chain.py` — standalone CLI verification script (no FastAPI dependency)
- `tests/unit/test_audit_log.py` — chain integrity and tamper detection tests

---

## Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Hash algorithm | SHA-256 | Sufficient for tamper-evidence; no PKI overhead (Blueprint D5) |
| Entry hash formula | SHA-256(JSON(entry_content) + prev_hash) | Chains each entry to the previous; altering any entry breaks all subsequent hashes |
| Genesis | prev_hash = "GENESIS" for the first entry | Deterministic starting point; no special-case logic needed in verification |
| Append-only enforcement | Application-level: only INSERT is called; no UPDATE or DELETE anywhere in audit_log.py | SQLite lacks role-level grants; documented trade-off (Blueprint D2) |
| Payload storage | Full decision record as JSON string in `payload` column | Enables independent verification without joining multiple tables |
| Verification script | Standalone Python script, no FastAPI import | Judges must be able to run `python scripts/verify_audit_chain.py` with only `sqlite3` in stdlib |

---

## Sequential Implementation Tasks

### Task 3.1 — agentguard/core/audit_log.py

```python
# agentguard/core/audit_log.py
"""
Hash-chained, append-only audit log.
INVARIANT: This module never calls UPDATE or DELETE on the audit_log table.
Every request — allowed or blocked — produces exactly one entry.
Entry hash formula: SHA-256(json.dumps(content, sort_keys=True) + prev_hash)
"""
import hashlib
import json
import logging
from datetime import datetime
from sqlalchemy import text
from agentguard import constants
from agentguard.models import BoundedIntent, PolicyResult, CartIntegrityResult, RiskResult, IdempotencyResult, PaymentResult

logger = logging.getLogger(__name__)


def _compute_entry_hash(entry_content: dict, prev_hash: str) -> str:
    """
    Hash = SHA-256(canonical_json(entry_content) + prev_hash)
    entry_content must NOT include the entry_hash field itself.
    """
    payload_str = json.dumps(entry_content, sort_keys=True, ensure_ascii=True, default=str)
    raw = (payload_str + prev_hash).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _get_last_entry(db) -> tuple[int, str]:
    """Return (entry_id, entry_hash) of the most recent audit entry, or (0, GENESIS)."""
    row = db.execute(
        text("SELECT entry_id, entry_hash FROM audit_log ORDER BY entry_id DESC LIMIT 1")
    ).fetchone()
    if not row:
        return 0, constants.GENESIS_HASH
    return row[0], row[1]


def append_audit_entry(
    intent: BoundedIntent,
    final_decision: str,
    policy_result: PolicyResult,
    cart_result: CartIntegrityResult,
    risk_result: RiskResult,
    idempotency_result: IdempotencyResult,
    payment_result: PaymentResult,
    db,
) -> str:
    """
    Append one audit entry. Returns the new entry_hash.
    Thread-safety note: for SQLite single-process demo, serialized writes are sufficient.
    """
    _, prev_hash = _get_last_entry(db)

    # Build the content dict (everything except entry_hash itself)
    content = {
        "intent_id": intent.intent_id,
        "agent_id": intent.agent_id,
        "timestamp": datetime.utcnow().isoformat(),
        "raw_input": intent.raw_input,
        "bounded_intent": {
            "category": intent.category,
            "item_description": intent.item_description,
            "max_amount_paise": intent.max_amount_paise,
            "currency": intent.currency,
            "ttl_seconds": intent.ttl_seconds,
        },
        "policy_result": {
            "passed": policy_result.passed,
            "reason": policy_result.reason,
            "rule_triggered": policy_result.rule_triggered,
        },
        "cart_integrity_result": {
            "passed": cart_result.passed,
            "changed_fields": cart_result.changed_fields,
            "reason": cart_result.reason,
        },
        "risk_check_result": {
            "passed": risk_result.passed,
            "anomaly_score": risk_result.anomaly_score,
            "reason": risk_result.reason,
        },
        "idempotency_result": {
            "passed": idempotency_result.passed,
            "reason": idempotency_result.reason,
        },
        "final_decision": final_decision,
        "block_reason": _first_block_reason(policy_result, cart_result, risk_result, idempotency_result),
        "payment_result": {
            "razorpay_order_id": payment_result.razorpay_order_id,
            "razorpay_payment_id": payment_result.razorpay_payment_id,
            "payment_link_url": payment_result.payment_link_url,
            "status": payment_result.status,
        },
    }

    entry_hash = _compute_entry_hash(content, prev_hash)

    db.execute(
        text("""
            INSERT INTO audit_log
            (prev_hash, entry_hash, intent_id, agent_id, timestamp, payload, final_decision, block_reason)
            VALUES (:prev, :hash, :iid, :aid, :ts, :payload, :decision, :block)
        """),
        {
            "prev": prev_hash,
            "hash": entry_hash,
            "iid": intent.intent_id,
            "aid": intent.agent_id,
            "ts": content["timestamp"],
            "payload": json.dumps(content, sort_keys=True, default=str),
            "decision": final_decision,
            "block": content["block_reason"],
        }
    )
    db.commit()
    logger.info(f"Audit entry appended: decision={final_decision}, hash={entry_hash[:16]}...")
    return entry_hash


def _first_block_reason(*results) -> str | None:
    """Return the first non-None reason from gate results, or None if allowed."""
    for r in results:
        if hasattr(r, "reason") and r.reason:
            return r.reason
    return None


def get_audit_entries(db, limit: int = 100, offset: int = 0) -> list[dict]:
    """Return audit entries ordered by entry_id ASC (chronological)."""
    rows = db.execute(
        text("""
            SELECT entry_id, prev_hash, entry_hash, agent_id, timestamp, payload, final_decision, block_reason
            FROM audit_log
            ORDER BY entry_id ASC
            LIMIT :lim OFFSET :off
        """),
        {"lim": limit, "off": offset}
    ).fetchall()
    return [
        {
            "entry_id": r[0],
            "prev_hash": r[1],
            "entry_hash": r[2],
            "agent_id": r[3],
            "timestamp": r[4],
            "payload": json.loads(r[5]),
            "final_decision": r[6],
            "block_reason": r[7],
        }
        for r in rows
    ]


def verify_chain(db) -> tuple[bool, int, str]:
    """
    Verify the entire hash chain.
    Returns: (is_intact: bool, entries_checked: int, message: str)
    """
    rows = db.execute(
        text("SELECT entry_id, prev_hash, entry_hash, payload FROM audit_log ORDER BY entry_id ASC")
    ).fetchall()

    if not rows:
        return True, 0, "Chain intact — 0 entries (empty log)"

    prev_hash = constants.GENESIS_HASH
    for i, (entry_id, stored_prev, stored_hash, payload_str) in enumerate(rows):
        if stored_prev != prev_hash:
            return False, i, f"Chain broken at entry {i} (entry_id={entry_id}): prev_hash mismatch"

        payload = json.loads(payload_str)
        computed = _compute_entry_hash(payload, stored_prev)
        if computed != stored_hash:
            return False, i, f"Chain broken at entry {i} (entry_id={entry_id}): hash mismatch"

        prev_hash = stored_hash

    return True, len(rows), f"Chain intact — {len(rows)} entries verified"
```

### Task 3.2 — scripts/verify_audit_chain.py

```python
#!/usr/bin/env python3
"""
AgentGuard — Standalone Audit Chain Verification Script

Usage:
    python scripts/verify_audit_chain.py
    python scripts/verify_audit_chain.py --db /path/to/agentguard.db

This script has NO dependency on FastAPI, Groq, or Razorpay.
It requires only Python standard library + sqlite3.
A judge can run this with: python scripts/verify_audit_chain.py
"""
import argparse
import hashlib
import json
import sqlite3
import sys

GENESIS_HASH = "GENESIS"


def compute_entry_hash(payload_str: str, prev_hash: str) -> str:
    raw = (payload_str + prev_hash).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def verify_chain(db_path: str) -> tuple[bool, int, str]:
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT entry_id, prev_hash, entry_hash, payload FROM audit_log ORDER BY entry_id ASC"
        )
        rows = cursor.fetchall()
        conn.close()
    except sqlite3.OperationalError as e:
        return False, 0, f"Database error: {e}"

    if not rows:
        return True, 0, "Chain intact — 0 entries (empty log)"

    prev_hash = GENESIS_HASH
    for i, row in enumerate(rows):
        entry_id = row["entry_id"]
        stored_prev = row["prev_hash"]
        stored_hash = row["entry_hash"]
        payload_str = row["payload"]

        if stored_prev != prev_hash:
            return False, i, (
                f"Chain BROKEN at entry index {i} (entry_id={entry_id})\n"
                f"  Expected prev_hash: {prev_hash[:16]}...\n"
                f"  Stored  prev_hash:  {stored_prev[:16]}..."
            )

        # Re-derive the payload string with sorted keys (must match write path)
        payload_dict = json.loads(payload_str)
        canonical_payload = json.dumps(payload_dict, sort_keys=True, ensure_ascii=True, default=str)
        computed = hashlib.sha256((canonical_payload + stored_prev).encode("utf-8")).hexdigest()

        if computed != stored_hash:
            return False, i, (
                f"Chain BROKEN at entry index {i} (entry_id={entry_id})\n"
                f"  Computed hash: {computed[:16]}...\n"
                f"  Stored   hash: {stored_hash[:16]}..."
            )

        prev_hash = stored_hash

    return True, len(rows), f"Chain intact — {len(rows)} entries verified"


def main():
    parser = argparse.ArgumentParser(description="Verify AgentGuard audit chain integrity")
    parser.add_argument("--db", default="agentguard.db", help="Path to SQLite database file")
    args = parser.parse_args()

    print(f"Verifying audit chain in: {args.db}")
    print("-" * 60)

    intact, count, message = verify_chain(args.db)

    if intact:
        print(f"[PASS] {message}")
        sys.exit(0)
    else:
        print(f"[FAIL] {message}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

### Task 3.3 — tests/unit/test_audit_log.py

```python
# tests/unit/test_audit_log.py
import hashlib
import json
import pytest
from datetime import datetime
from agentguard import constants
from agentguard.core.audit_log import _compute_entry_hash, verify_chain
from agentguard.models import (
    BoundedIntent, PolicyResult, CartIntegrityResult,
    RiskResult, IdempotencyResult, PaymentResult
)


class TestAuditChain:

    def _make_entry_content(self, i: int) -> dict:
        return {
            "intent_id": f"intent-{i:03d}",
            "agent_id": "agent-001",
            "timestamp": f"2026-09-03T10:0{i}:00",
            "raw_input": f"buy shoes {i}",
            "bounded_intent": {"category": "footwear", "max_amount_paise": 350000},
            "policy_result": {"passed": True, "reason": None, "rule_triggered": None},
            "cart_integrity_result": {"passed": True, "changed_fields": [], "reason": None},
            "risk_check_result": {"passed": True, "anomaly_score": 0.0, "reason": None},
            "idempotency_result": {"passed": True, "reason": None},
            "final_decision": "allowed",
            "block_reason": None,
            "payment_result": {"razorpay_order_id": f"order_{i}", "status": "success"},
        }

    def test_entry_hash_deterministic(self):
        content = self._make_entry_content(1)
        h1 = _compute_entry_hash(content, "GENESIS")
        h2 = _compute_entry_hash(content, "GENESIS")
        assert h1 == h2

    def test_first_entry_uses_genesis(self):
        content = self._make_entry_content(1)
        h = _compute_entry_hash(content, constants.GENESIS_HASH)
        assert len(h) == 64  # SHA-256 hex digest

    def test_chain_of_10_entries_intact(self, tmp_path):
        """Build 10 chained entries manually and verify they pass."""
        import sqlite3, os
        db_path = str(tmp_path / "test.db")
        conn = sqlite3.connect(db_path)
        conn.execute("""
            CREATE TABLE audit_log (
                entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
                prev_hash TEXT, entry_hash TEXT UNIQUE,
                intent_id TEXT, agent_id TEXT, timestamp TEXT,
                payload TEXT, final_decision TEXT, block_reason TEXT
            )
        """)
        prev_hash = constants.GENESIS_HASH
        for i in range(10):
            content = self._make_entry_content(i)
            payload_str = json.dumps(content, sort_keys=True, ensure_ascii=True, default=str)
            entry_hash = hashlib.sha256((payload_str + prev_hash).encode()).hexdigest()
            conn.execute(
                "INSERT INTO audit_log (prev_hash, entry_hash, intent_id, agent_id, timestamp, payload, final_decision) VALUES (?,?,?,?,?,?,?)",
                (prev_hash, entry_hash, content["intent_id"], "agent-001", content["timestamp"], payload_str, "allowed")
            )
            prev_hash = entry_hash
        conn.commit()
        conn.close()

        # Now verify using the standalone script logic
        import subprocess, sys
        result = subprocess.run(
            [sys.executable, "scripts/verify_audit_chain.py", "--db", db_path],
            capture_output=True, text=True
        )
        assert result.returncode == 0, f"Verification failed: {result.stdout}\n{result.stderr}"
        assert "Chain intact" in result.stdout
        assert "10 entries verified" in result.stdout

    def test_tampered_entry_detected_at_correct_index(self, tmp_path):
        """Tamper entry at index 5; verify script catches it at index 5."""
        import sqlite3
        db_path = str(tmp_path / "tampered.db")
        conn = sqlite3.connect(db_path)
        conn.execute("""
            CREATE TABLE audit_log (
                entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
                prev_hash TEXT, entry_hash TEXT UNIQUE,
                intent_id TEXT, agent_id TEXT, timestamp TEXT,
                payload TEXT, final_decision TEXT, block_reason TEXT
            )
        """)
        prev_hash = constants.GENESIS_HASH
        for i in range(10):
            content = self._make_entry_content(i)
            payload_str = json.dumps(content, sort_keys=True, ensure_ascii=True, default=str)
            entry_hash = hashlib.sha256((payload_str + prev_hash).encode()).hexdigest()
            conn.execute(
                "INSERT INTO audit_log (prev_hash, entry_hash, intent_id, agent_id, timestamp, payload, final_decision) VALUES (?,?,?,?,?,?,?)",
                (prev_hash, entry_hash, content["intent_id"], "agent-001", content["timestamp"], payload_str, "allowed")
            )
            prev_hash = entry_hash
        conn.commit()

        # TAMPER: modify amount in entry 5's payload
        rows = conn.execute("SELECT entry_id, payload FROM audit_log ORDER BY entry_id").fetchall()
        tampered_entry_id = rows[5][0]
        original_payload = json.loads(rows[5][1])
        original_payload["bounded_intent"]["max_amount_paise"] = 99999999  # tamper
        conn.execute(
            "UPDATE audit_log SET payload=? WHERE entry_id=?",
            (json.dumps(original_payload, sort_keys=True), tampered_entry_id)
        )
        conn.commit()
        conn.close()

        import subprocess, sys
        result = subprocess.run(
            [sys.executable, "scripts/verify_audit_chain.py", "--db", db_path],
            capture_output=True, text=True
        )
        assert result.returncode == 1, "Tampered chain should fail verification"
        assert "BROKEN" in result.stderr
        assert "entry index 5" in result.stderr
```

---

## Validation Strategy

```bash
# Run audit unit tests
pytest tests/unit/test_audit_log.py -v

# Manual verification against a real populated DB (run after Phase 6 smoke test)
python scripts/verify_audit_chain.py --db agentguard.db

# Verify tamper detection works on a manually corrupted DB
python scripts/verify_audit_chain.py --db tests/fixtures/tampered.db
```

---

## Acceptance Criteria

- [ ] `pytest tests/unit/test_audit_log.py` — all 4 tests pass
- [ ] `_compute_entry_hash(content, prev_hash)` is deterministic for identical inputs
- [ ] A chain of 10 entries passes `verify_audit_chain.py` with exit code 0
- [ ] Tampering the payload of entry at index 5 causes `verify_audit_chain.py` to exit with code 1 and print "BROKEN at entry index 5"
- [ ] `scripts/verify_audit_chain.py --db nonexistent.db` exits with code 1 and a database error message
- [ ] `scripts/verify_audit_chain.py` has no import of `fastapi`, `groq`, or `razorpay` (verified by grep)

```bash
grep -n "import fastapi\|import groq\|import razorpay" scripts/verify_audit_chain.py
# Must return no matches
```

---

## Risks & Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Payload JSON serialization differs between write and verify paths | Medium | High | Both paths use `json.dumps(..., sort_keys=True, ensure_ascii=True, default=str)` — identical parameters |
| append_audit_entry called concurrently from two requests | Low | Medium | SQLite serializes writes; single-process FastAPI demo has no concurrent writes |
| Verification script finds 0 entries on first run | Low | Low | Returns exit code 0 with "0 entries" message — correct behavior for empty log |

---

## Deliverables

- `agentguard/core/audit_log.py`
- `scripts/verify_audit_chain.py` (standalone, stdlib only)
- `tests/unit/test_audit_log.py` (4 test cases)

---

## Documentation Updates

- `BUILD_LOG.md`: Note that the verification script uses stdlib only, no pip dependencies, so judges can run it without a virtualenv.
