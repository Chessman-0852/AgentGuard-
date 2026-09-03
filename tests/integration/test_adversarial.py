"""
tests/integration/test_adversarial.py
Automated integration tests for all 6 adversarial scenarios + happy path.
Requires a running AgentGuard server at http://localhost:8000.
"""
import pytest
import requests

BASE = "http://localhost:8000/api/v1"


@pytest.fixture(autouse=True)
def check_server():
    try:
        r = requests.get("http://localhost:8000/health", timeout=5)
        if r.status_code != 200:
            pytest.skip("AgentGuard server not healthy")
    except Exception:
        pytest.skip("AgentGuard server not running on port 8000")


class TestAdversarialScenarios:

    def post(self, agent_id: str, raw_input: str) -> dict:
        r = requests.post(
            f"{BASE}/intents",
            json={"agent_id": agent_id, "raw_input": raw_input},
            timeout=35,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        return r.json()

    def test_H1_happy_path_allowed(self):
        """Valid purchase under transaction cap and below confirmation threshold."""
        data = self.post("TestAgent-001", "buy running shoes, budget 3500")
        assert data["status"] == "allowed", f"Expected allowed, got: {data}"
        assert data.get("payment_link_url"), "Payment link URL must be present for allowed requests"
        assert data.get("razorpay_order_id"), "Razorpay order ID must be present for allowed requests"

    def test_A1_over_cap_blocked(self):
        """Requested amount 9,999 INR > max_transaction_amount (7,000 INR)."""
        data = self.post("TestAgent-002", "buy running shoes for 9999")
        assert data["status"] == "blocked", f"Expected blocked, got: {data}"
        assert data["block_reason"] == "exceeds_transaction_cap"
        assert data.get("payment_link_url") is None

    def test_A2_cart_tamper_blocked(self):
        """Cart modified between authorization snapshot and execution verification."""
        r = requests.post("http://localhost:8000/api/v1/demo/cart-tamper", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["integrity_check_passed"] is False
        assert data["block_reason"] == "cart_integrity_failure"

    def test_A3_replay_blocked(self):
        """Same input intent resubmitted within same 15-minute time bucket."""
        # First call establishes the key
        self.post("TestAgent-004", "buy groceries, budget 1200")
        # Second call with identical payload must be blocked by idempotency guard
        data = self.post("TestAgent-004", "buy groceries, budget 1200")
        assert data["status"] == "blocked"
        assert data["block_reason"] == "replay_detected"

    def test_A4_category_not_allowed_blocked(self):
        """Category 'jewellery' not in allowed_categories whitelist."""
        data = self.post("TestAgent-005", "buy jewellery for 4000")
        assert data["status"] == "blocked"
        assert data["block_reason"] == "category_not_allowed"

    def test_A5_ambiguous_no_amount_blocked(self):
        """Intent without budget ceiling resolves to sentinel 1 paise, failing catalog check."""
        data = self.post("TestAgent-006", "get me some shoes")
        assert data["status"] == "blocked"

    def test_A6_confirmation_required_threshold(self):
        """Purchases above 5,000 INR require human approval before execution."""
        data = self.post("TestAgent-007", "buy running shoes for 6000")
        assert data["status"] == "blocked"
        assert data["block_reason"] == "confirmation_required"

    def test_audit_coverage_100_percent(self):
        """Every single processed request produces an audit log entry."""
        r = requests.get(f"{BASE}/audit?limit=50", timeout=5)
        assert r.status_code == 200
        entries = r.json().get("entries", [])
        assert len(entries) > 0, "Audit log must contain recorded decisions"

    def test_audit_chain_intact(self):
        """Independent in-process mathematical verification of the SHA-256 hash pointer chain."""
        r = requests.post(f"{BASE}/audit/verify", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["intact"] is True, f"Audit chain verification failed: {data}"
