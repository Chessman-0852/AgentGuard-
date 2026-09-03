# tests/unit/test_risk_checker.py
import pytest
from unittest.mock import MagicMock
from agentguard.models import BoundedIntent
from agentguard.config import PolicyConfig
from agentguard.core.risk_checker import check_risk, compute_anomaly_score


def make_intent(amount_paise=350000):
    return BoundedIntent(
        agent_id="agent-001",
        category="footwear",
        item_description="running shoes",
        max_amount_paise=amount_paise,
        raw_input="buy shoes",
    )


def make_policy():
    return PolicyConfig(
        max_transaction_amount_paise=700000,
        max_daily_spend_per_agent_paise=1500000,
        requires_human_confirmation_above_paise=500000,
        allowed_categories=["footwear"],
        max_requests_per_minute_per_agent=5,
        idempotency_key_ttl_seconds=86400,
        all_blocked=False,
    )


class TestRiskChecker:
    def test_always_passes_with_advisory_score(self):
        """Risk checker never blocks — result.passed must always be True."""
        db = MagicMock()
        db.execute.return_value.fetchall.return_value = []
        intent = make_intent()
        result = check_risk(intent, make_policy(), db)
        assert result.passed is True
        assert isinstance(result.anomaly_score, float)

    def test_anomaly_score_zero_with_fewer_than_5_transactions(self):
        """Insufficient history (< 5 records) must return anomaly_score=0.0."""
        db = MagicMock()
        # Return 3 historical records (< 5 required)
        db.execute.return_value.fetchall.return_value = [
            (300000,), (350000,), (400000,)
        ]
        score = compute_anomaly_score("agent-001", 999999, db)
        assert score == 0.0

    def test_anomaly_score_nonzero_with_sufficient_history(self):
        """With >= 5 historical records, anomaly score is a real number."""
        db = MagicMock()
        db.execute.return_value.fetchall.return_value = [
            (300000,), (320000,), (310000,), (330000,), (340000,)
        ]
        score = compute_anomaly_score("agent-001", 1000000, db)
        # Should be significantly above 0 for a very large outlier
        assert score > 0.0
