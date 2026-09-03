# agentguard/core/policy_engine.py
"""
Deterministic policy evaluation. No LLM calls. No network calls.
Same input + same config = same output, always.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from agentguard.models import BoundedIntent, PolicyResult
from agentguard.config import PolicyConfig
from agentguard import constants


def _get_agent_daily_spend_paise(agent_id: str, db) -> int:
    """Return agent's daily spend in paise. Returns 0 if no history."""
    today = datetime.now(timezone.utc).date().isoformat()
    row = db.execute(
        text("SELECT daily_spend_paise FROM agent_state WHERE agent_id=:a AND date=:d"),
        {"a": agent_id, "d": today}
    ).fetchone()
    return row[0] if row else 0


def _get_agent_request_count_last_minute(agent_id: str, db) -> int:
    """Return number of requests from this agent in the past 60 seconds."""
    window_start = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()
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
    Rule order: fail-closed > transaction cap > daily cap > category > confirmation > velocity.
    """
    # Fail-closed: if policy failed to load, block everything
    if policy.all_blocked:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_POLICY_UNAVAILABLE,
            rule_triggered="policy_unavailable"
        )

    # Rule 1: Transaction cap — at cap is ALLOWED; one paise over is BLOCKED
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

    # Rule 3: Category allow-list (category is already normalised by BoundedIntent validator)
    if intent.category not in policy.allowed_categories:
        return PolicyResult(
            passed=False,
            reason=constants.BLOCK_CATEGORY_NOT_ALLOWED,
            rule_triggered="allowed_categories"
        )

    # Rule 4: Human confirmation threshold (treated as a block at MVP — no async flow)
    if policy.requires_human_confirmation_above_paise > 0 and \
            intent.max_amount_paise > policy.requires_human_confirmation_above_paise:
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
