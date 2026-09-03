# agentguard/api/routes/webhooks.py
import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from agentguard.database import get_db
from agentguard.executor.razorpay_client import (
    validate_webhook_signature,
    handle_payment_captured,
    handle_payment_failed,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receive and process Razorpay webhook events.
    CRITICAL: HMAC-SHA256 signature is validated on the raw body BEFORE any JSON parsing.
    Webhooks may arrive multiple times — all handlers are idempotent.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

    if not validate_webhook_signature(raw_body, signature, webhook_secret):
        logger.warning("Invalid webhook signature rejected — possible replay or tampering")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event")
    logger.info(f"Webhook received: event={event}")

    if event == "payment.captured":
        handle_payment_captured(payload, db)
    elif event == "payment.failed":
        handle_payment_failed(payload, db)
    elif event == "order.paid":
        pass   # Covered by payment.captured — no additional action needed

    return {"status": "received", "event": event}
