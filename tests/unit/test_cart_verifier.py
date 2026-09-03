# tests/unit/test_cart_verifier.py
import pytest
from unittest.mock import MagicMock
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker
from agentguard.models import Cart, CartItem
from agentguard.core.cart_verifier import take_cart_snapshot, verify_cart_integrity, _compute_cart_hash
from agentguard import constants


def make_cart(price_paise=350000, quantity=1, sku="SHOE-001"):
    return Cart(
        intent_id="intent-001",
        merchant_id="merchant-001",
        items=[CartItem(sku=sku, name="shoe", price_paise=price_paise, quantity=quantity, merchant_id="merchant-001")]
    )


def make_test_db(tmp_path):
    """Create a fresh SQLite DB with all tables from the migration script."""
    db_path = str(tmp_path / "test.db")
    eng = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

    @event.listens_for(eng, "connect")
    def set_wal(conn, _):
        conn.execute("PRAGMA journal_mode=WAL")
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
    # Seed a dummy intent row (FK required by cart_snapshots)
    db.execute(text(
        "INSERT INTO intents (intent_id, agent_id, raw_input, idempotency_key, created_at, expires_at) "
        "VALUES ('intent-001', 'agent-001', 'test', 'key-001', '2026-01-01T00:00:00', '2026-12-31T00:00:00')"
    ))
    db.commit()
    return db


class TestCartVerifierHashing:
    def test_identical_cart_produces_identical_hash(self):
        cart = make_cart()
        h1 = _compute_cart_hash(cart)
        h2 = _compute_cart_hash(cart)
        assert h1 == h2, "Same cart must produce same hash"

    def test_price_change_produces_different_hash(self):
        cart_original = make_cart(price_paise=350000)
        cart_tampered = make_cart(price_paise=700000)
        assert _compute_cart_hash(cart_original) != _compute_cart_hash(cart_tampered)

    def test_quantity_change_produces_different_hash(self):
        cart_original = make_cart(quantity=1)
        cart_tampered = make_cart(quantity=2)
        assert _compute_cart_hash(cart_original) != _compute_cart_hash(cart_tampered)

    def test_no_snapshot_fails_closed(self):
        db = MagicMock()
        db.execute.return_value.fetchone.return_value = None
        result = verify_cart_integrity("intent-xxx", make_cart(), db)
        assert not result.passed
        assert result.reason == constants.BLOCK_NO_CART_SNAPSHOT
        assert "snapshot_missing" in result.changed_fields


class TestCartVerifierDB:
    def test_unchanged_cart_passes_after_snapshot(self, tmp_path):
        db = make_test_db(tmp_path)
        cart = make_cart()
        take_cart_snapshot("intent-001", cart, db)
        result = verify_cart_integrity("intent-001", cart, db)
        assert result.passed

    def test_tampered_price_fails_after_snapshot(self, tmp_path):
        db = make_test_db(tmp_path)
        original_cart = make_cart(price_paise=350000)
        take_cart_snapshot("intent-001", original_cart, db)

        tampered_cart = make_cart(price_paise=500000)
        result = verify_cart_integrity("intent-001", tampered_cart, db)
        assert not result.passed
        assert result.reason == constants.BLOCK_CART_INTEGRITY_FAILURE
        assert "items" in result.changed_fields
