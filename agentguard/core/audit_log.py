# agentguard/core/audit_log.py
"""
Hash-chained, append-only audit log.
INVARIANT: This module never calls UPDATE or DELETE on the audit_log table.
Every request — allowed or blocked — produces exactly one entry.
Entry hash formula: SHA-256(json.dumps(content, sort_keys=True) + prev_hash)
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from sqlalchemy import text
from agentguard import constants
from agentguard.models import (
    BoundedIntent, PolicyResult, CartIntegrityResult,
    RiskResult, IdempotencyResult, PaymentResult,
)

logger = logging.getLogger(__name__)


def _compute_entry_hash(entry_content: dict, prev_hash: str) -> str:
    """
    Hash = SHA-256(canonical_json(entry_content) + prev_hash)
    entry_content must NOT include the entry_hash field itself.
    Both write and verify paths use identical json.dumps parameters.
    """
    payload_str = json.dumps(entry_content, sort_keys=True, ensure_ascii=True, default=str)
    raw = (payload_str + prev_hash).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _get_last_entry(db) -> tuple[int, str]:
    """Return (entry_id, entry_hash) of the most recent audit entry, or (0, GENESIS)."""
    row = db.execute(
        text("SELECT entry_id, entry_hash FROM audit_log ORDER BY entry_id DESC LIMIT 1")
    ).fetchone()
    if not row:
        return 0, constants.GENESIS_HASH
    return row[0], row[1]


def append_audit_entry(
    intent: BoundedIntent,
    final_decision: str,
    policy_result: PolicyResult,
    cart_result: CartIntegrityResult,
    risk_result: RiskResult,
    idempotency_result: IdempotencyResult,
    payment_result: PaymentResult,
    db,
) -> str:
    """
    Append one audit entry. Returns the new entry_hash.
    Thread-safety note: SQLite serializes writes; single-process demo is safe.
    """
    _, prev_hash = _get_last_entry(db)

    # Build the content dict — everything except entry_hash itself
    content = {
        "intent_id": intent.intent_id,
        "agent_id": intent.agent_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "raw_input": intent.raw_input,
        "bounded_intent": {
            "category": intent.category,
            "item_description": intent.item_description,
            "max_amount_paise": intent.max_amount_paise,
            "currency": intent.currency,
            "ttl_seconds": intent.ttl_seconds,
        },
        "policy_result": {
            "passed": policy_result.passed,
            "reason": policy_result.reason,
            "rule_triggered": policy_result.rule_triggered,
        },
        "cart_integrity_result": {
            "passed": cart_result.passed,
            "changed_fields": cart_result.changed_fields,
            "reason": cart_result.reason,
        },
        "risk_check_result": {
            "passed": risk_result.passed,
            "anomaly_score": risk_result.anomaly_score,
            "reason": risk_result.reason,
        },
        "idempotency_result": {
            "passed": idempotency_result.passed,
            "reason": idempotency_result.reason,
        },
        "final_decision": final_decision,
        "block_reason": _first_block_reason(policy_result, cart_result, risk_result, idempotency_result),
        "payment_result": {
            "razorpay_order_id": payment_result.razorpay_order_id,
            "razorpay_payment_id": payment_result.razorpay_payment_id,
            "payment_link_url": payment_result.payment_link_url,
            "status": payment_result.status,
        },
    }

    entry_hash = _compute_entry_hash(content, prev_hash)

    db.execute(
        text("""
            INSERT INTO audit_log
            (prev_hash, entry_hash, intent_id, agent_id, timestamp, payload, final_decision, block_reason)
            VALUES (:prev, :hash, :iid, :aid, :ts, :payload, :decision, :block)
        """),
        {
            "prev": prev_hash,
            "hash": entry_hash,
            "iid": intent.intent_id,
            "aid": intent.agent_id,
            "ts": content["timestamp"],
            "payload": json.dumps(content, sort_keys=True, ensure_ascii=True, default=str),
            "decision": final_decision,
            "block": content["block_reason"],
        }
    )
    db.commit()
    logger.info(f"Audit entry appended: decision={final_decision}, hash={entry_hash[:16]}...")
    return entry_hash


def _first_block_reason(*results) -> str | None:
    """Return the first non-None reason from gate results, or None if allowed."""
    for r in results:
        if hasattr(r, "reason") and r.reason:
            return r.reason
    return None


def get_audit_entries(db, limit: int = 100, offset: int = 0) -> list[dict]:
    """Return audit entries ordered by entry_id ASC (chronological)."""
    rows = db.execute(
        text("""
            SELECT entry_id, prev_hash, entry_hash, agent_id, timestamp, payload, final_decision, block_reason
            FROM audit_log
            ORDER BY entry_id ASC
            LIMIT :lim OFFSET :off
        """),
        {"lim": limit, "off": offset}
    ).fetchall()
    return [
        {
            "entry_id": r[0],
            "prev_hash": r[1],
            "entry_hash": r[2],
            "agent_id": r[3],
            "timestamp": r[4],
            "payload": json.loads(r[5]),
            "final_decision": r[6],
            "block_reason": r[7],
        }
        for r in rows
    ]


def verify_chain(db) -> tuple[bool, int, str]:
    """
    Verify the entire hash chain in-process (uses SQLAlchemy session).
    Returns: (is_intact: bool, entries_checked: int, message: str)
    """
    rows = db.execute(
        text("SELECT entry_id, prev_hash, entry_hash, payload FROM audit_log ORDER BY entry_id ASC")
    ).fetchall()

    if not rows:
        return True, 0, "Chain intact — 0 entries (empty log)"

    prev_hash = constants.GENESIS_HASH
    for i, (entry_id, stored_prev, stored_hash, payload_str) in enumerate(rows):
        if stored_prev != prev_hash:
            return False, i, f"Chain broken at entry {i} (entry_id={entry_id}): prev_hash mismatch"

        payload = json.loads(payload_str)
        computed = _compute_entry_hash(payload, stored_prev)
        if computed != stored_hash:
            return False, i, f"Chain broken at entry {i} (entry_id={entry_id}): hash mismatch"

        prev_hash = stored_hash

    return True, len(rows), f"Chain intact — {len(rows)} entries verified"
