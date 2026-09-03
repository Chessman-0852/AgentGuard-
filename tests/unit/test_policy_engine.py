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
    """
    Mock DB that returns (daily_spend,) for the first fetchone call
    and (request_count,) for the second.
    """
    db = MagicMock()
    results = [
        (daily_spend,) if daily_spend else (0,),
        (request_count,),
    ]
    call_count = {"n": 0}

    def side_effect():
        val = results[call_count["n"]]
        call_count["n"] = min(call_count["n"] + 1, len(results) - 1)
        return val

    db.execute.return_value.fetchone.side_effect = side_effect
    return db


class TestPolicyEngine:
    def test_policy_unavailable_blocks_all(self):
        intent = make_intent()
        policy = PolicyConfig(all_blocked=True)
        result = check_policy(intent, policy, mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_POLICY_UNAVAILABLE

    def test_at_cap_is_allowed(self):
        """Amount exactly at transaction cap must be ALLOWED — critical boundary condition.
        Confirmation threshold is disabled (0) to isolate the transaction-cap rule."""
        intent = make_intent(max_amount_paise=700000)
        policy = make_policy(requires_human_confirmation_above_paise=0)
        result = check_policy(intent, policy, mock_db())
        assert result.passed

    def test_one_paise_over_cap_is_blocked(self):
        """One paise over cap must be BLOCKED."""
        intent = make_intent(max_amount_paise=700001)
        result = check_policy(intent, make_policy(), mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_EXCEEDS_TRANSACTION_CAP
        assert result.rule_triggered == "max_transaction_amount"

    def test_daily_cap_exceeded_is_blocked(self):
        """daily_spend(900000) + amount(700000) = 1600000 > 1500000 cap."""
        intent = make_intent(max_amount_paise=700000)
        result = check_policy(intent, make_policy(), mock_db(daily_spend=900000))
        assert not result.passed
        assert result.reason == constants.BLOCK_DAILY_CAP_EXCEEDED

    def test_allowed_categories_pass(self):
        for cat in ["footwear", "groceries", "electronics-accessories"]:
            intent = make_intent(category=cat)
            result = check_policy(intent, make_policy(), mock_db())
            assert result.passed, f"Category '{cat}' should be allowed"

    def test_disallowed_category_blocked(self):
        intent = make_intent(category="luxury-watches")
        result = check_policy(intent, make_policy(), mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_CATEGORY_NOT_ALLOWED

    def test_velocity_at_limit_is_allowed(self):
        """4 requests in window (< 5) must be allowed."""
        intent = make_intent()
        result = check_policy(intent, make_policy(), mock_db(request_count=4))
        assert result.passed

    def test_velocity_exceeded_blocked(self):
        """5 requests in window (>= 5 limit) must be blocked."""
        intent = make_intent()
        result = check_policy(intent, make_policy(), mock_db(request_count=5))
        assert not result.passed
        assert result.reason == constants.BLOCK_VELOCITY_EXCEEDED

    def test_confirmation_required_blocks(self):
        """600000 paise (6000 INR) > 500000 paise (5000 INR) confirmation threshold."""
        intent = make_intent(max_amount_paise=600000)
        policy = make_policy(requires_human_confirmation_above_paise=500000)
        result = check_policy(intent, policy, mock_db())
        assert not result.passed
        assert result.reason == constants.BLOCK_CONFIRMATION_REQUIRED

    def test_category_normalization(self):
        """BoundedIntent validator normalises category to lowercase — verify passes."""
        for cat in ["Footwear", "FOOTWEAR", "footwear "]:
            intent = make_intent(category=cat)
            result = check_policy(intent, make_policy(), mock_db())
            assert result.passed, f"Category '{cat}' should normalise and pass"
