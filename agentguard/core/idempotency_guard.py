# agentguard/core/idempotency_guard.py
"""
Replay attack prevention via SQLite unique constraint.
Uses INSERT-then-catch-IntegrityError to prevent race conditions.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from agentguard.models import IdempotencyResult
from agentguard import constants


def check_and_reserve_idempotency_key(
    idempotency_key: str,
    intent_id: str,
    agent_id: str,
    ttl_seconds: int,
    db,
) -> IdempotencyResult:
    """
    Attempt to INSERT the idempotency key. If the INSERT succeeds, the request
    is new and allowed to proceed. If it fails (IntegrityError), check the status
    of the existing record.

    Status transitions:
      pending   -> block (in-flight or race condition)
      executed  -> block (replay attack)
      failed    -> allow retry (payment failed, not a replay)
      expired   -> allow (treat as new request)
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)

    # Try to INSERT — this is atomic and race-safe due to UNIQUE PRIMARY KEY
    try:
        db.execute(
            text("""
                INSERT INTO idempotency_keys
                (key, intent_id, agent_id, status, created_at, expires_at)
                VALUES (:k, :iid, :aid, 'pending', :now, :exp)
            """),
            {
                "k": idempotency_key,
                "iid": intent_id,
                "aid": agent_id,
                "now": now.isoformat(),
                "exp": expires_at.isoformat(),
            }
        )
        db.commit()
        return IdempotencyResult(passed=True)
    except IntegrityError:
        db.rollback()

    # Key already exists — look up its state
    row = db.execute(
        text("SELECT status, executed_at, expires_at, agent_id FROM idempotency_keys WHERE key=:k"),
        {"k": idempotency_key}
    ).fetchone()

    if not row:
        # Should be impossible — INSERT failed but SELECT found nothing
        return IdempotencyResult(passed=False, reason=constants.BLOCK_REPLAY_DETECTED)

    status, executed_at_str, expires_at_str, existing_agent_id = row

    # Cross-agent identity confusion: same key, different agent
    if existing_agent_id != agent_id:
        return IdempotencyResult(passed=False, reason=constants.BLOCK_CROSS_AGENT_IDENTITY)

    # Expired key: treat as new
    if expires_at_str and datetime.fromisoformat(expires_at_str).replace(tzinfo=timezone.utc) < now:
        return IdempotencyResult(passed=True)

    if status == constants.IDEM_STATUS_FAILED:
        # Payment failed — allow retry by resetting key to pending
        db.execute(
            text("UPDATE idempotency_keys SET status='pending', created_at=:now, expires_at=:exp WHERE key=:k"),
            {"k": idempotency_key, "now": now.isoformat(), "exp": expires_at.isoformat()}
        )
        db.commit()
        return IdempotencyResult(passed=True)

    if status == constants.IDEM_STATUS_EXECUTED:
        exec_at = datetime.fromisoformat(executed_at_str) if executed_at_str else None
        return IdempotencyResult(
            passed=False,
            reason=constants.BLOCK_REPLAY_DETECTED,
            original_execution_at=exec_at
        )

    # status == pending: in-flight or race condition — block
    return IdempotencyResult(passed=False, reason=constants.BLOCK_REPLAY_DETECTED)


def mark_idempotency_key_executed(idempotency_key: str, payment_id: str, db) -> None:
    """Called after successful Razorpay payment. Transitions pending -> executed."""
    db.execute(
        text("""
            UPDATE idempotency_keys
            SET status='executed', executed_at=:now, payment_id=:pid
            WHERE key=:k
        """),
        {
            "k": idempotency_key,
            "now": datetime.now(timezone.utc).isoformat(),
            "pid": payment_id,
        }
    )
    db.commit()


def mark_idempotency_key_failed(idempotency_key: str, db) -> None:
    """Called after failed Razorpay payment. Transitions pending -> failed (retry allowed)."""
    db.execute(
        text("UPDATE idempotency_keys SET status='failed' WHERE key=:k"),
        {"k": idempotency_key}
    )
    db.commit()
