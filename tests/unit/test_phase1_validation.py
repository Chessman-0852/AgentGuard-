# tests/unit/test_phase1_validation.py
import os
import json
import sqlite3
import hashlib
import pytest
from pydantic import ValidationError
from agentguard.models import BoundedIntent, Cart, CartItem, MerchantConstraints
from agentguard.config import load_policy, PolicyConfig
from agentguard.database import init_db, engine

def test_package_imports():
    assert BoundedIntent is not None
    assert Cart is not None

def test_valid_policy_load():
    p = load_policy("policy.yaml")
    assert p.all_blocked is False
    assert p.max_transaction_amount_paise == 700000
    assert p.max_daily_spend_per_agent_paise == 1500000
    assert p.requires_human_confirmation_above_paise == 500000
    assert p.allowed_categories == ["footwear", "groceries", "electronics-accessories"]
    assert p.max_requests_per_minute_per_agent == 5
    assert p.idempotency_key_ttl_seconds == 86400

def test_fail_closed_policy_load():
    p = load_policy("/nonexistent.yaml")
    assert p.all_blocked is True

def test_database_initialization_and_tables():
    init_db()
    assert os.path.exists("agentguard.db")
    conn = sqlite3.connect("agentguard.db")
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = {row[0] for row in cursor.fetchall()}
    conn.close()
    
    expected_tables = {"intents", "agent_state", "cart_snapshots", "idempotency_keys", "audit_log"}
    assert expected_tables.issubset(tables), f"Missing tables: {expected_tables - tables}"

def test_cart_canonical_dict_determinism():
    c = Cart(
        intent_id="test-intent",
        merchant_id="m-001",
        items=[
            CartItem(sku="SHOE-002", name="B Shoe", price_paise=450000, quantity=1, merchant_id="m-001"),
            CartItem(sku="SHOE-001", name="A Shoe", price_paise=350000, quantity=1, merchant_id="m-001"),
        ]
    )
    d1 = c.canonical_dict()
    d2 = c.canonical_dict()
    assert d1 == d2
    # Ensure items sorted by SKU
    assert d1["items"][0]["sku"] == "SHOE-001"
    assert d1["items"][1]["sku"] == "SHOE-002"
    
    h1 = hashlib.sha256(json.dumps(d1, sort_keys=True).encode()).hexdigest()
    h2 = hashlib.sha256(json.dumps(d2, sort_keys=True).encode()).hexdigest()
    assert h1 == h2

def test_bounded_intent_negative_amount_validation():
    with pytest.raises(ValidationError):
        BoundedIntent(
            agent_id="agent-001",
            category="footwear",
            item_description="test shoe",
            max_amount_paise=-100
        )

def test_policy_yaml_exists():
    assert os.path.exists("policy.yaml")

def test_env_example_exists():
    assert os.path.exists(".env.example")
    with open(".env.example") as f:
        content = f.read()
    assert "GROQ_API_KEY" in content
    assert "RAZORPAY_KEY_ID" in content
    assert "RAZORPAY_KEY_SECRET" in content

def test_synthetic_catalog():
    assert os.path.exists("synthetic/catalog.json")
    with open("synthetic/catalog.json") as f:
        data = json.load(f)
    catalog = data.get("catalog", [])
    assert len(catalog) == 12
    categories = {}
    for item in catalog:
        cat = item["category"]
        categories[cat] = categories.get(cat, 0) + 1
    assert categories == {
        "footwear": 4,
        "groceries": 4,
        "electronics-accessories": 4
    }
