# tests/unit/test_audit_log.py
import hashlib
import json
import pytest
import sqlite3
import subprocess
import sys
from agentguard import constants
from agentguard.core.audit_log import _compute_entry_hash, verify_chain, append_audit_entry
from agentguard.models import (
    BoundedIntent, PolicyResult, CartIntegrityResult,
    RiskResult, IdempotencyResult, PaymentResult,
)
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker


def make_entry_content(i: int) -> dict:
    return {
        "intent_id": f"intent-{i:03d}",
        "agent_id": "agent-001",
        "timestamp": f"2026-09-03T10:0{i}:00+00:00",
        "raw_input": f"buy shoes {i}",
        "bounded_intent": {
            "category": "footwear",
            "item_description": "running shoes",
            "max_amount_paise": 350000,
            "currency": "INR",
            "ttl_seconds": 3600,
        },
        "policy_result": {"passed": True, "reason": None, "rule_triggered": None},
        "cart_integrity_result": {"passed": True, "changed_fields": [], "reason": None},
        "risk_check_result": {"passed": True, "anomaly_score": 0.0, "reason": None},
        "idempotency_result": {"passed": True, "reason": None},
        "final_decision": "allowed",
        "block_reason": None,
        "payment_result": {
            "razorpay_order_id": f"order_{i}",
            "razorpay_payment_id": None,
            "payment_link_url": None,
            "status": "success",
        },
    }


def build_chain_db(db_path: str, num_entries: int = 10) -> None:
    """Write a correct hash chain into a raw SQLite file."""
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE audit_log (
            entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
            prev_hash TEXT NOT NULL,
            entry_hash TEXT NOT NULL UNIQUE,
            intent_id TEXT,
            agent_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            payload TEXT NOT NULL,
            final_decision TEXT NOT NULL,
            block_reason TEXT
        )
    """)
    prev_hash = constants.GENESIS_HASH
    for i in range(num_entries):
        content = make_entry_content(i)
        payload_str = json.dumps(content, sort_keys=True, ensure_ascii=True, default=str)
        entry_hash = hashlib.sha256((payload_str + prev_hash).encode("utf-8")).hexdigest()
        conn.execute(
            "INSERT INTO audit_log (prev_hash, entry_hash, intent_id, agent_id, timestamp, payload, final_decision) "
            "VALUES (?,?,?,?,?,?,?)",
            (prev_hash, entry_hash, content["intent_id"], "agent-001", content["timestamp"], payload_str, "allowed")
        )
        prev_hash = entry_hash
    conn.commit()
    conn.close()


def make_test_sqlalchemy_db(tmp_path):
    """Create a fresh SQLAlchemy session for append_audit_entry tests."""
    db_path = str(tmp_path / "audit_test.db")
    eng = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

    @event.listens_for(eng, "connect")
    def set_pragma(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")

    Session = sessionmaker(bind=eng)
    with open("migrations/001_initial_schema.sql") as f:
        sql = f.read()
    with eng.connect() as conn:
        for stmt in sql.split(";"):
            s = stmt.strip()
            if s:
                conn.execute(text(s))
        conn.commit()

    db = Session()
    # Seed a dummy intent row (FK required)
    db.execute(text(
        "INSERT INTO intents (intent_id, agent_id, raw_input, idempotency_key, created_at, expires_at) "
        "VALUES ('intent-001', 'agent-001', 'buy shoes', 'key-001', '2026-01-01T00:00:00', '2026-12-31T00:00:00')"
    ))
    db.commit()
    return db


class TestAuditChain:

    def test_entry_hash_deterministic(self):
        """Same content + same prev_hash must always produce the same hash."""
        content = make_entry_content(1)
        h1 = _compute_entry_hash(content, "GENESIS")
        h2 = _compute_entry_hash(content, "GENESIS")
        assert h1 == h2

    def test_first_entry_uses_genesis(self):
        """First entry hashes against the GENESIS sentinel — verify output is valid SHA-256."""
        content = make_entry_content(1)
        h = _compute_entry_hash(content, constants.GENESIS_HASH)
        assert len(h) == 64   # SHA-256 produces a 64-character hex digest
        assert all(c in "0123456789abcdef" for c in h)

    def test_chain_of_10_entries_intact(self, tmp_path):
        """Build a 10-entry chain and verify it passes the standalone script."""
        db_path = str(tmp_path / "test.db")
        build_chain_db(db_path, num_entries=10)

        result = subprocess.run(
            [sys.executable, "scripts/verify_audit_chain.py", "--db", db_path],
            capture_output=True, text=True
        )
        assert result.returncode == 0, f"Verification failed:\nSTDOUT:{result.stdout}\nSTDERR:{result.stderr}"
        assert "Chain intact" in result.stdout
        assert "10 entries verified" in result.stdout

    def test_tampered_entry_detected_at_correct_index(self, tmp_path):
        """Tamper payload at index 5; verify script reports BROKEN at entry index 5."""
        db_path = str(tmp_path / "tampered.db")
        build_chain_db(db_path, num_entries=10)

        conn = sqlite3.connect(db_path)
        rows = conn.execute("SELECT entry_id, payload FROM audit_log ORDER BY entry_id").fetchall()
        tampered_entry_id = rows[5][0]
        original_payload = json.loads(rows[5][1])
        original_payload["bounded_intent"]["max_amount_paise"] = 99999999  # tamper the amount
        conn.execute(
            "UPDATE audit_log SET payload=? WHERE entry_id=?",
            (json.dumps(original_payload, sort_keys=True), tampered_entry_id)
        )
        conn.commit()
        conn.close()

        result = subprocess.run(
            [sys.executable, "scripts/verify_audit_chain.py", "--db", db_path],
            capture_output=True, text=True
        )
        assert result.returncode == 1, "Tampered chain should fail verification"
        assert "BROKEN" in result.stderr
        assert "entry index 5" in result.stderr

    def test_nonexistent_db_fails_with_error(self, tmp_path):
        """Script must exit code 1 with a database error for a missing DB file."""
        result = subprocess.run(
            [sys.executable, "scripts/verify_audit_chain.py", "--db", str(tmp_path / "nonexistent.db")],
            capture_output=True, text=True
        )
        assert result.returncode == 1
        assert "Database error" in result.stderr or "error" in result.stderr.lower()

    def test_append_and_verify_chain_in_process(self, tmp_path):
        """Write 3 entries via append_audit_entry then verify chain in-process."""
        db = make_test_sqlalchemy_db(tmp_path)

        intent = BoundedIntent(
            intent_id="intent-001",
            agent_id="agent-001",
            category="footwear",
            item_description="running shoes",
            max_amount_paise=350000,
            raw_input="buy shoes",
        )
        policy_ok = PolicyResult(passed=True)
        cart_ok = CartIntegrityResult(passed=True)
        risk_ok = RiskResult(passed=True, anomaly_score=0.0)
        idem_ok = IdempotencyResult(passed=True)
        payment_ok = PaymentResult(razorpay_order_id="order_001", status="success")

        append_audit_entry(intent, constants.DECISION_ALLOWED, policy_ok, cart_ok, risk_ok, idem_ok, payment_ok, db)
        append_audit_entry(intent, constants.DECISION_ALLOWED, policy_ok, cart_ok, risk_ok, idem_ok, payment_ok, db)
        append_audit_entry(intent, constants.DECISION_ALLOWED, policy_ok, cart_ok, risk_ok, idem_ok, payment_ok, db)

        intact, count, msg = verify_chain(db)
        assert intact is True
        assert count == 3
        assert "3 entries verified" in msg
