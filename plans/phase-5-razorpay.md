# Phase 5 — Razorpay Action Executor & Webhooks

> **Status:** [ ] Not started
> **Estimated time:** 2 hours
> **Day:** 1, fifth block
> **Depends on:** Phase 4 (BoundedIntent is fully parsed and validated)

---

## Objective

Implement the Razorpay integration: creating Orders and Payment Links in test-mode, receiving and validating webhooks, and updating the idempotency key and agent state on payment outcome. This phase completes Day 1. After this phase, all backend logic is in place.

---

## Scope

- `agentguard/executor/razorpay_client.py` — Orders API, Payment Links API, HMAC webhook validation
- Webhook payload handlers for `payment.captured`, `payment.failed`, `order.paid`
- `tests/unit/test_razorpay_client.py` — HMAC validation unit tests (no real API calls)

---

## Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Test-mode only | `rzp_test_` key prefix enforced at startup | Non-negotiable constraint; production keys must never be used |
| Payment Links over Checkout | `POST /v1/payment_links` | Simpler for demo; provides a short URL that can be shown in the dashboard |
| intent_id as reference_id | Set `reference_id=intent_id` on the Payment Link | Allows webhook event to be traced back to the AgentGuard intent without a lookup |
| HMAC on raw body | Validate `X-Razorpay-Signature` before parsing JSON | gptPlan.md §13: parse the JSON only after signature is verified on the raw bytes |
| Idempotent webhook handling | Check idempotency status before updating | Webhooks may arrive multiple times (Razorpay retries on non-200); must be safe to process twice |
| Retry on 5xx | One retry with 2s backoff | Razorpay occasional transient errors; log both attempts to BUILD_LOG |

---

## Sequential Implementation Tasks

### Task 5.1 — agentguard/executor/razorpay_client.py

```python
# agentguard/executor/razorpay_client.py
"""
Razorpay test-mode integration.
CONSTRAINT: This module ONLY uses test-mode API keys.
            A startup assertion enforces this.
"""
import hmac
import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Optional

import razorpay

logger = logging.getLogger(__name__)

_client: Optional[razorpay.Client] = None


def _get_client() -> razorpay.Client:
    global _client
    if _client is None:
        key_id = os.environ["RAZORPAY_KEY_ID"]
        key_secret = os.environ["RAZORPAY_KEY_SECRET"]

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
    Amount must be in paise (integer). Returns order_id for Payment Link creation.
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
        except razorpay.errors.BadRequestError as e:
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
    Create a Razorpay Payment Link for the order.
    reference_id is set to intent_id so webhooks can trace back to AgentGuard.
    """
    link_data = {
        "amount": amount_paise,
        "currency": "INR",
        "description": item_description[:255],
        "reference_id": intent_id,           # trace webhook -> intent
        "order_id": order_id,
        "callback_url": "",                  # No callback for demo
        "callback_method": "",
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
        except razorpay.errors.BadRequestError as e:
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
    """
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


# --------------------------------------------------------------------------
# Webhook event handlers
# --------------------------------------------------------------------------

def handle_payment_captured(event_payload: dict, db) -> None:
    """
    payment.captured: Mark idempotency key as executed, update agent daily spend.
    Idempotent: safe to call multiple times for the same event.
    """
    from sqlalchemy import text
    from datetime import datetime

    payment = event_payload.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment.get("order_id")
    payment_id = payment.get("id")
    amount_paise = payment.get("amount", 0)

    if not order_id or not payment_id:
        logger.warning("payment.captured event missing order_id or payment_id")
        return

    # Find the idempotency key for this order
    row = db.execute(
        text("""
            SELECT ik.key, ik.intent_id, i.agent_id
            FROM idempotency_keys ik
            JOIN intents i ON ik.intent_id = i.intent_id
            WHERE i.parsed_json LIKE :order_pattern
               OR ik.key IN (
                   SELECT receipt FROM (
                       SELECT notes->'receipt' as receipt FROM intents WHERE parsed_json LIKE :order_pattern2
                   )
               )
        """),
        {"order_pattern": f"%{order_id}%", "order_pattern2": f"%{order_id}%"}
    ).fetchone()

    # Simpler approach: find by order_id stored in intent parsed_json
    row = db.execute(
        text("SELECT key, intent_id, agent_id FROM idempotency_keys WHERE payment_id=:pid OR intent_id IN (SELECT intent_id FROM intents WHERE parsed_json LIKE :pat)"),
        {"pid": payment_id, "pat": f"%{order_id}%"}
    ).fetchone()

    if not row:
        logger.warning(f"No idempotency key found for order_id={order_id}")
        return

    key, intent_id, agent_id = row[0], row[1], row[2]

    # Update idempotency key: pending -> executed
    db.execute(
        text("""
            UPDATE idempotency_keys
            SET status='executed', executed_at=:now, payment_id=:pid
            WHERE key=:k AND status='pending'
        """),
        {"k": key, "now": datetime.utcnow().isoformat(), "pid": payment_id}
    )

    # Update agent daily spend
    today = datetime.utcnow().date().isoformat()
    db.execute(
        text("""
            INSERT INTO agent_state (agent_id, date, daily_spend_paise, request_count_today, last_request_at)
            VALUES (:a, :d, :spend, 1, :now)
            ON CONFLICT(agent_id, date) DO UPDATE SET
                daily_spend_paise = daily_spend_paise + :spend,
                request_count_today = request_count_today + 1,
                last_request_at = :now
        """),
        {"a": agent_id, "d": today, "spend": amount_paise, "now": datetime.utcnow().isoformat()}
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
    payment.failed: Mark idempotency key as failed (retry allowed).
    """
    from sqlalchemy import text
    from datetime import datetime

    payment = event_payload.get("payload", {}).get("payment", {}).get("entity", {})
    payment_id = payment.get("id")
    order_id = payment.get("order_id")

    if not payment_id:
        return

    row = db.execute(
        text("SELECT key, intent_id FROM idempotency_keys WHERE intent_id IN (SELECT intent_id FROM intents WHERE parsed_json LIKE :pat)"),
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
    logger.info(f"payment.failed processed: payment_id={payment_id}")
```

### Task 5.2 — tests/unit/test_razorpay_client.py

```python
# tests/unit/test_razorpay_client.py
import hmac
import hashlib
import pytest
from agentguard.executor.razorpay_client import validate_webhook_signature


class TestWebhookValidation:

    def _make_signature(self, body: bytes, secret: str) -> str:
        return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    def test_valid_signature_returns_true(self):
        body = b'{"event":"payment.captured"}'
        secret = "test_webhook_secret_abc123"
        sig = self._make_signature(body, secret)
        assert validate_webhook_signature(body, sig, secret) is True

    def test_invalid_signature_returns_false(self):
        body = b'{"event":"payment.captured"}'
        secret = "test_webhook_secret_abc123"
        assert validate_webhook_signature(body, "invalid_signature", secret) is False

    def test_tampered_body_returns_false(self):
        body = b'{"event":"payment.captured"}'
        secret = "test_webhook_secret_abc123"
        sig = self._make_signature(body, secret)
        tampered = b'{"event":"payment.captured","amount":9999999}'
        assert validate_webhook_signature(tampered, sig, secret) is False

    def test_wrong_secret_returns_false(self):
        body = b'{"event":"payment.captured"}'
        correct_secret = "correct_secret"
        wrong_secret = "wrong_secret"
        sig = self._make_signature(body, correct_secret)
        assert validate_webhook_signature(body, sig, wrong_secret) is False

    def test_production_key_rejected_at_startup(self, monkeypatch):
        import os
        monkeypatch.setenv("RAZORPAY_KEY_ID", "rzp_live_productionkey")
        monkeypatch.setenv("RAZORPAY_KEY_SECRET", "somesecret")
        # Reset the cached client
        import agentguard.executor.razorpay_client as rc
        rc._client = None
        with pytest.raises(RuntimeError, match="rzp_test_"):
            rc._get_client()
        rc._client = None  # cleanup
```

---

## Validation Strategy

```bash
# Unit tests (no Razorpay API key required)
pytest tests/unit/test_razorpay_client.py -v

# Manual integration test (requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env)
python -c "
from dotenv import load_dotenv; load_dotenv()
from agentguard.executor.razorpay_client import create_order, create_payment_link
order = create_order('test-intent-001', 'agent-001', 350000, 'footwear', 'testkey001')
print(f'Order: {order.order_id}, status: {order.status}')
link = create_payment_link('test-intent-001', order.order_id, 350000, 'Running shoes')
print(f'Link: {link.short_url}')
"
```

---

## Acceptance Criteria

- [ ] `pytest tests/unit/test_razorpay_client.py` — all 5 tests pass
- [ ] `validate_webhook_signature(body, correct_sig, secret)` returns `True`
- [ ] `validate_webhook_signature(tampered_body, correct_sig, secret)` returns `False`
- [ ] Startup assertion: `RAZORPAY_KEY_ID` starting with `rzp_live_` raises `RuntimeError`
- [ ] Manual: `create_order()` with test credentials returns an `order_id` starting with `order_`
- [ ] Manual: `create_payment_link()` returns a `short_url` starting with `https://rzp.io/`
- [ ] `handle_payment_captured()` updates idempotency key status to `executed` (integration test in Phase 6)

---

## Risks & Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Razorpay test-mode webhook not delivering to localhost | Medium | Medium | Use Razorpay dashboard "Send Test Webhook" feature during demo |
| Payment Link order_id mismatch with webhook order_id | Low | High | Use reference_id=intent_id on Payment Link to trace event back to intent |
| Webhook arrives before intent record is committed to DB | Very Low | Low | SQLite WAL mode; single-process serializes writes |

---

## Deliverables

- `agentguard/executor/razorpay_client.py`
- `tests/unit/test_razorpay_client.py` (5 test cases)

---

## Documentation Updates

- `BUILD_LOG.md`: Note any Razorpay API quirks encountered (e.g., Payment Link requiring order to be in specific status).
- `.env.example`: Already includes all Razorpay vars from Phase 1. Confirm webhook secret is registered in Razorpay dashboard.
