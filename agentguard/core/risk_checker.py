# agentguard/core/risk_checker.py
"""
Rule-based risk evaluation. Anomaly score is ADVISORY ONLY — never blocks alone.
All blocking decisions come from deterministic rules only.
"""
import statistics
from sqlalchemy import text
from agentguard.models import BoundedIntent, RiskResult
from agentguard.config import PolicyConfig


def _get_agent_transaction_history_paise(agent_id: str, db) -> list[int]:
    """Return list of historical max_amount_paise values for this agent (last 50 completed)."""
    rows = db.execute(
        text("""
            SELECT json_extract(parsed_json, '$.max_amount_paise')
            FROM intents
            WHERE agent_id=:a AND status='completed'
            ORDER BY created_at DESC
            LIMIT 50
        """),
        {"a": agent_id}
    ).fetchall()
    return [row[0] for row in rows if row[0] is not None]


def compute_anomaly_score(agent_id: str, amount_paise: int, db) -> float:
    """
    Z-score of amount against agent's historical amounts.
    Returns 0.0 if fewer than 5 historical transactions (insufficient data).
    ADVISORY ONLY — this score never triggers a block by itself.
    """
    history = _get_agent_transaction_history_paise(agent_id, db)
    if len(history) < 5:
        return 0.0
    mean = statistics.mean(history)
    stdev = statistics.stdev(history)
    if stdev == 0:
        return 0.0
    return (amount_paise - mean) / stdev


def check_risk(intent: BoundedIntent, policy: PolicyConfig, db) -> RiskResult:
    """
    Compute advisory anomaly score. Never blocks on it alone.
    The velocity check lives in policy_engine (Rule 5) to keep single-pass flow.
    """
    anomaly_score = compute_anomaly_score(intent.agent_id, intent.max_amount_paise, db)

    # No deterministic blocking rule in risk checker triggers independently.
    # Anomaly score is logged to audit but does not block.
    return RiskResult(passed=True, anomaly_score=anomaly_score)
