# tests/unit/test_idempotency_guard.py
import pytest
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker
from agentguard.core.idempotency_guard import (
    check_and_reserve_idempotency_key,
    mark_idempotency_key_executed,
    mark_idempotency_key_failed,
)
from agentguard import constants


def make_test_db(tmp_path):
    """Create a fresh in-process SQLite DB with all tables."""
    db_path = str(tmp_path / "idem_test.db")
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
        "VALUES ('intent-001', 'agent-001', 'buy shoes', 'idem-key-001', '2026-01-01T00:00:00', '2026-12-31T00:00:00')"
    ))
    db.commit()
    return db


KEY = "idem-key-001"
AGENT = "agent-001"
INTENT = "intent-001"
TTL = 86400


class TestIdempotencyGuard:
    def test_new_key_is_allowed(self, tmp_path):
        """First reservation of a key must succeed."""
        db = make_test_db(tmp_path)
        result = check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        assert result.passed is True

    def test_pending_key_blocks_replay(self, tmp_path):
        """Second call with same key (status=pending) must block."""
        db = make_test_db(tmp_path)
        check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        result = check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        assert result.passed is False
        assert result.reason == constants.BLOCK_REPLAY_DETECTED

    def test_executed_key_blocks_replay(self, tmp_path):
        """Key marked as executed must block on re-submission."""
        db = make_test_db(tmp_path)
        check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        mark_idempotency_key_executed(KEY, "pay_test123", db)
        result = check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        assert result.passed is False
        assert result.reason == constants.BLOCK_REPLAY_DETECTED

    def test_failed_key_allows_retry(self, tmp_path):
        """Key marked as failed (Razorpay payment failed) must allow a retry."""
        db = make_test_db(tmp_path)
        check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        mark_idempotency_key_failed(KEY, db)
        result = check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        assert result.passed is True

    def test_cross_agent_identity_violation(self, tmp_path):
        """Same key presented by a different agent must be blocked."""
        db = make_test_db(tmp_path)
        check_and_reserve_idempotency_key(KEY, INTENT, AGENT, TTL, db)
        result = check_and_reserve_idempotency_key(KEY, INTENT, "agent-EVIL", TTL, db)
        assert result.passed is False
        assert result.reason == constants.BLOCK_CROSS_AGENT_IDENTITY
