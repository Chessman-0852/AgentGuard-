# tests/unit/test_intent_parser.py
"""
Unit tests use mocked Groq responses — no real API calls.
All tests run fully offline.
"""
import json
import pytest
from unittest.mock import MagicMock, patch
from agentguard.core.intent_parser import parse_intent, _generate_idempotency_key, IntentParseError
from agentguard.models import BoundedIntent


def _mock_groq_response(category: str, item_description: str, max_amount_inr=None, ttl_seconds=3600):
    """Build a mock Groq response object with a tool call."""
    args = {"category": category, "item_description": item_description, "ttl_seconds": ttl_seconds}
    if max_amount_inr is not None:
        args["max_amount_inr"] = max_amount_inr

    tool_call = MagicMock()
    tool_call.function.arguments = json.dumps(args)

    message = MagicMock()
    message.tool_calls = [tool_call]

    choice = MagicMock()
    choice.message = message

    response = MagicMock()
    response.choices = [choice]
    return response


class TestIntentParser:

    @patch("agentguard.core.intent_parser._get_client")
    def test_happy_path_with_amount(self, mock_get_client):
        """Standard case: NL with amount produces correct paise conversion."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_groq_response(
            category="footwear", item_description="running shoes", max_amount_inr=7000
        )
        mock_get_client.return_value = mock_client

        intent = parse_intent("buy running shoes, budget 7000", "agent-001")
        assert isinstance(intent, BoundedIntent)
        assert intent.category == "footwear"
        assert intent.max_amount_paise == 700000   # 7000 INR = 700000 paise
        assert intent.agent_id == "agent-001"
        assert intent.idempotency_key != ""
        assert len(intent.idempotency_key) == 64   # SHA-256 hex digest is always 64 chars

    @patch("agentguard.core.intent_parser._get_client")
    def test_category_normalized_to_lowercase(self, mock_get_client):
        """BoundedIntent validator must normalise category regardless of LLM casing."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_groq_response(
            category="Footwear", item_description="shoes", max_amount_inr=3000
        )
        mock_get_client.return_value = mock_client
        intent = parse_intent("buy Footwear", "agent-001")
        assert intent.category == "footwear"

    @patch("agentguard.core.intent_parser._get_client")
    def test_no_amount_stated_uses_1_paise_sentinel(self, mock_get_client):
        """When LLM omits max_amount_inr, parser must use 1 paise sentinel."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = _mock_groq_response(
            category="footwear", item_description="some shoes"
            # no max_amount_inr — omitted
        )
        mock_get_client.return_value = mock_client
        intent = parse_intent("get me some shoes", "agent-001")
        assert intent.max_amount_paise == 1   # sentinel — policy engine will block

    def test_empty_input_raises_parse_error(self):
        """Empty raw_input must raise IntentParseError before any API call is made."""
        with pytest.raises(IntentParseError, match="empty"):
            parse_intent("", "agent-001")

    def test_whitespace_only_input_raises_parse_error(self):
        """Whitespace-only input must also raise IntentParseError."""
        with pytest.raises(IntentParseError, match="empty"):
            parse_intent("   ", "agent-001")

    @patch("agentguard.core.intent_parser._get_client")
    def test_no_tool_call_raises_parse_error(self, mock_get_client):
        """LLM responding without a tool call must raise IntentParseError."""
        mock_client = MagicMock()
        message = MagicMock()
        message.tool_calls = []   # LLM skipped the tool
        choice = MagicMock()
        choice.message = message
        response = MagicMock()
        response.choices = [choice]
        mock_client.chat.completions.create.return_value = response
        mock_get_client.return_value = mock_client
        with pytest.raises(IntentParseError, match="did not call"):
            parse_intent("buy shoes", "agent-001")

    def test_idempotency_key_deterministic_same_bucket(self):
        """Two calls with identical inputs in the same time bucket produce the same key."""
        intent = BoundedIntent(
            agent_id="agent-001",
            category="footwear",
            item_description="shoes",
            max_amount_paise=700000,
        )
        k1 = _generate_idempotency_key("agent-001", intent)
        k2 = _generate_idempotency_key("agent-001", intent)
        assert k1 == k2, "Same input in same time bucket must produce same key"
        assert len(k1) == 64

    def test_idempotency_key_different_agents_differ(self):
        """Different agent_id must produce a different idempotency key."""
        intent = BoundedIntent(
            agent_id="agent-001",
            category="footwear",
            item_description="shoes",
            max_amount_paise=700000,
        )
        k1 = _generate_idempotency_key("agent-001", intent)
        k2 = _generate_idempotency_key("agent-002", intent)
        assert k1 != k2

    @patch("agentguard.core.intent_parser._get_client")
    def test_fallback_model_used_when_primary_fails(self, mock_get_client):
        """When primary model raises, the fallback model should be tried and succeed."""
        mock_client = MagicMock()
        # First call (primary) raises; second call (fallback) succeeds
        mock_client.chat.completions.create.side_effect = [
            Exception("Rate limited"),
            _mock_groq_response(category="groceries", item_description="oats", max_amount_inr=500),
        ]
        mock_get_client.return_value = mock_client

        intent = parse_intent("buy oats for 500", "agent-001")
        assert intent.category == "groceries"
        assert intent.max_amount_paise == 50000
        assert mock_client.chat.completions.create.call_count == 2   # primary + fallback

    @patch("agentguard.core.intent_parser._get_client")
    def test_both_models_fail_raises_parse_error(self, mock_get_client):
        """When both primary and fallback fail, IntentParseError must be raised."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("Service unavailable")
        mock_get_client.return_value = mock_client
        with pytest.raises(IntentParseError, match="All models failed"):
            parse_intent("buy shoes for 5000", "agent-001")
