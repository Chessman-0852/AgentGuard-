# agentguard/executor/razorpay_client.py
"""
Razorpay test-mode integration.
CONSTRAINT: This module ONLY uses test-mode API keys.
            A startup assertion enforces this — production keys are rejected immediately.
"""
import hmac
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import razorpay

logger = logging.getLogger(__name__)

_client: Optional[razorpay.Client] = None


def _get_client() -> razorpay.Client:
    global _client
    if _client is None:
        key_id = os.environ.get("RAZORPAY_KEY_ID", "")
        key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")

        # Enforce test-mode — reject production keys at startup
        if not key_id.startswith("rzp_test_"):
            raise RuntimeError(
                f"RAZORPAY_KEY_ID must start with 'rzp_test_' — production keys are NOT allowed. Got: {key_id[:15]}..."
            )

        _client = razorpay.Client(auth=(key_id, key_secret))
        logger.info("Razorpay test-mode client initialized")
    return _client


@dataclass
class RazorpayOrderResult:
    order_id: str
    amount_paise: int
    status: str
    receipt: str


@dataclass
class RazorpayPaymentLinkResult:
    link_id: str
    short_url: str
    order_id: str
    status: str


def create_order(
    intent_id: str,
    agent_id: str,
    amount_paise: int,
    category: str,
    idempotency_key: str,
) -> RazorpayOrderResult:
    """
    Create a Razorpay Order in test mode.
    Amount must be in paise (integer). Returns RazorpayOrderResult with order_id.
    Retries once on transient 5xx errors with 2s backoff.
    """
    receipt = idempotency_key[:40]   # Razorpay receipt max 40 chars
    order_data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "notes": {
            "agent_id": agent_id,
            "intent_id": intent_id,
            "category": category,
        },
    }

    for attempt in range(2):
        try:
            order = _get_client().order.create(data=order_data)
            logger.info(f"Razorpay order created: {order['id']} for intent {intent_id}")
            return RazorpayOrderResult(
                order_id=order["id"],
                amount_paise=order["amount"],
                status=order["status"],
                receipt=receipt,
            )
        except razorpay.errors.BadRequestError:
            raise   # 4xx errors are not retryable
        except Exception as e:
            if attempt == 0:
                logger.warning(f"Order creation failed (attempt 1), retrying in 2s: {e}")
                time.sleep(2)
            else:
                raise RuntimeError(f"Razorpay order creation failed after 2 attempts: {e}") from e


def create_payment_link(
    intent_id: str,
    order_id: str,
    amount_paise: int,
    item_description: str,
) -> RazorpayPaymentLinkResult:
    """
    Create a Razorpay Payment Link tied to the order.
    reference_id=intent_id so webhook events can be traced back to the AgentGuard intent.
    """
    link_data = {
        "amount": amount_paise,
        "currency": "INR",
        "description": item_description[:255],
        "reference_id": intent_id,           # trace webhook -> intent
        "notes": {
            "intent_id": intent_id,
            "razorpay_order_id": order_id,   # stored in notes for traceability
        },
    }

    for attempt in range(2):
        try:
            link = _get_client().payment_link.create(data=link_data)
            logger.info(f"Payment link created: {link['id']} -> {link['short_url']}")
            return RazorpayPaymentLinkResult(
                link_id=link["id"],
                short_url=link["short_url"],
                order_id=order_id,
                status=link["status"],
            )
        except razorpay.errors.BadRequestError:
            raise
        except Exception as e:
            if attempt == 0:
                logger.warning(f"Payment link creation failed (attempt 1), retrying in 2s: {e}")
                time.sleep(2)
            else:
                raise RuntimeError(f"Payment link creation failed after 2 attempts: {e}") from e


# --------------------------------------------------------------------------
# Webhook signature validation
# --------------------------------------------------------------------------

def validate_webhook_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """
    Validate Razorpay webhook HMAC-SHA256 signature.
    CRITICAL: raw_body must be the raw request body bytes — not parsed JSON.
    Returns True if signature is valid, False otherwise.
    Uses hmac.compare_digest to prevent timing attacks.
    """
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


# --------------------------------------------------------------------------
# Webhook event handlers
# --------------------------------------------------------------------------

def handle_payment_captured(event_payload: dict, db) -> None:
    """
    payment.captured: Mark idempotency key as executed, update agent daily spend.
    Idempotent: safe to call multiple times for the same event (WHERE status='pending').
    """
    from sqlalchemy import text

    payment = event_payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment.get("order_id")
    payment_id = payment.get("id")
    amount_paise = payment.get("amount", 0)

    if not order_id or not payment_id:
        logger.warning("payment.captured event missing order_id or payment_id — skipping")
        return

    # Find idempotency key by order_id stored in intent's parsed_json notes
    row = db.execute(
        text(
            "SELECT key, intent_id, agent_id FROM idempotency_keys "
            "WHERE payment_id=:pid "
            "OR intent_id IN (SELECT intent_id FROM intents WHERE parsed_json LIKE :pat)"
        ),
        {"pid": payment_id, "pat": f"%{order_id}%"}
    ).fetchone()

    if not row:
        logger.warning(f"No idempotency key found for order_id={order_id}")
        return

    key, intent_id, agent_id = row[0], row[1], row[2]
    now = datetime.now(timezone.utc).isoformat()
    today = datetime.now(timezone.utc).date().isoformat()

    # Transition pending -> executed (idempotent: WHERE status='pending' prevents double-update)
    db.execute(
        text("""
            UPDATE idempotency_keys
            SET status='executed', executed_at=:now, payment_id=:pid
            WHERE key=:k AND status='pending'
        """),
        {"k": key, "now": now, "pid": payment_id}
    )

    # Upsert agent daily spend
    db.execute(
        text("""
            INSERT INTO agent_state (agent_id, date, daily_spend_paise, request_count_today, last_request_at)
            VALUES (:a, :d, :spend, 1, :now)
            ON CONFLICT(agent_id, date) DO UPDATE SET
                daily_spend_paise = daily_spend_paise + :spend,
                request_count_today = request_count_today + 1,
                last_request_at = :now
        """),
        {"a": agent_id, "d": today, "spend": amount_paise, "now": now}
    )

    # Update intent status to completed
    db.execute(
        text("UPDATE intents SET status='completed' WHERE intent_id=:iid"),
        {"iid": intent_id}
    )
    db.commit()
    logger.info(f"payment.captured processed: payment_id={payment_id}, agent={agent_id}, amount={amount_paise}p")


def handle_payment_failed(event_payload: dict, db) -> None:
    """
    payment.failed: Mark idempotency key as failed (retry allowed for next attempt).
    """
    from sqlalchemy import text

    payment = event_payload.get("payload", {}).get("payment", {}).get("entity", {})
    payment_id = payment.get("id")
    order_id = payment.get("order_id")

    if not payment_id:
        return

    row = db.execute(
        text(
            "SELECT key, intent_id FROM idempotency_keys "
            "WHERE intent_id IN (SELECT intent_id FROM intents WHERE parsed_json LIKE :pat)"
        ),
        {"pat": f"%{order_id}%"}
    ).fetchone()

    if not row:
        return

    key, intent_id = row[0], row[1]
    db.execute(
        text("UPDATE idempotency_keys SET status='failed' WHERE key=:k AND status='pending'"),
        {"k": key}
    )
    db.execute(
        text("UPDATE intents SET status='failed' WHERE intent_id=:iid"),
        {"iid": intent_id}
    )
    db.commit()
    logger.info(f"payment.failed processed: payment_id={payment_id}, intent={intent_id}")
