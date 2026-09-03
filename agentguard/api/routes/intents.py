# agentguard/api/routes/intents.py
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from agentguard import constants
from agentguard.config import get_policy
from agentguard.core.audit_log import append_audit_entry
from agentguard.core.cart_verifier import take_cart_snapshot, verify_cart_integrity
from agentguard.core.idempotency_guard import check_and_reserve_idempotency_key
from agentguard.core.intent_parser import parse_intent, explain_block, IntentParseError
from agentguard.core.policy_engine import check_policy
from agentguard.core.risk_checker import check_risk
from agentguard.database import get_db
from agentguard.executor.razorpay_client import create_order, create_payment_link
from agentguard.models import (
    Cart, CartItem, CartIntegrityResult, IdempotencyResult,
    PaymentResult, PolicyResult, RiskResult,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Null/pass-through results for gates that were not reached (still written to audit log)
NULL_POLICY = PolicyResult(passed=True)
NULL_CART = CartIntegrityResult(passed=True)
NULL_RISK = RiskResult(passed=True)
NULL_IDEM = IdempotencyResult(passed=True)
NULL_PAYMENT = PaymentResult()


class IntentRequest(BaseModel):
    agent_id: str
    raw_input: str


class IntentResponse(BaseModel):
    intent_id: str
    status: str                               # "allowed" | "blocked"
    block_reason: Optional[str] = None
    block_explanation: Optional[str] = None   # LLM-generated cosmetic explanation
    payment_link_url: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    bounded_intent: Optional[dict] = None


def _get_synthetic_cart(intent_id: str, category: str, amount_paise: int) -> Cart:
    """
    Build a synthetic cart from the catalog matching the intent category.
    Selects the highest-priced item that fits within max_amount_paise.
    Falls back to first item in category if none fit the budget.
    """
    import os
    catalog_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "synthetic", "catalog.json"
    )
    with open(catalog_path) as f:
        catalog = json.load(f)["catalog"]

    matching = [
        item for item in catalog
        if item["category"] == category and item["price_paise"] <= amount_paise
    ]

    if not matching:
        # Fallback: use first item in category regardless of price
        matching = [item for item in catalog if item["category"] == category]

    if not matching:
        raise HTTPException(
            status_code=422,
            detail=f"No catalog items found for category: {category}"
        )

    # Pick the highest-priced item that fits (best value for the intent's budget)
    chosen = sorted(matching, key=lambda x: x["price_paise"], reverse=True)[0]

    return Cart(
        intent_id=intent_id,
        merchant_id=chosen["merchant_id"],
        items=[CartItem(
            sku=chosen["sku"],
            name=chosen["name"],
            price_paise=chosen["price_paise"],
            quantity=1,
            merchant_id=chosen["merchant_id"],
        )]
    )


@router.post("/intents", response_model=IntentResponse)
def process_intent(request: IntentRequest, db: Session = Depends(get_db)):
    """
    Main pipeline endpoint. Processes a natural-language purchase intent through
    all five deterministic gates and executes via Razorpay if all gates pass.

    Pipeline sequence:
        Parse → Policy → Cart Snapshot+Verify → Risk → Idempotency → Execute → Audit
    """
    start_time = time.time()
    policy = get_policy()

    # -----------------------------------------------------------------------
    # Stage 1: Intent Parsing (only LLM call on the critical path)
    # -----------------------------------------------------------------------
    try:
        intent = parse_intent(request.raw_input, request.agent_id)
    except IntentParseError as e:
        raise HTTPException(
            status_code=422,
            detail={"error": "parse_failed", "detail": str(e)}
        )

    # Persist intent to DB (INSERT OR IGNORE handles idempotent re-submissions)
    db.execute(
        text("""
            INSERT OR IGNORE INTO intents
            (intent_id, agent_id, raw_input, parsed_json, idempotency_key, status, created_at, expires_at)
            VALUES (:iid, :aid, :raw, :parsed, :key, 'parsed', :now, :exp)
        """),
        {
            "iid": intent.intent_id,
            "aid": intent.agent_id,
            "raw": intent.raw_input,
            "parsed": json.dumps(intent.model_dump(), default=str),
            "key": intent.idempotency_key,
            "now": intent.created_at.isoformat(),
            "exp": (intent.created_at.timestamp() + intent.ttl_seconds),
        }
    )
    db.commit()

    # If the key already existed, use the persisted intent_id to satisfy foreign keys
    existing_row = db.execute(
        text("SELECT intent_id FROM intents WHERE idempotency_key = :k"),
        {"k": intent.idempotency_key}
    ).fetchone()
    if existing_row:
        intent.intent_id = existing_row[0]

    gate_start = time.time()

    # -----------------------------------------------------------------------
    # Stage 2: Policy Engine (deterministic, no LLM)
    # -----------------------------------------------------------------------
    policy_result = check_policy(intent, policy, db)
    logger.info(
        f"Policy gate: passed={policy_result.passed}, "
        f"reason={policy_result.reason}, "
        f"latency={int((time.time()-gate_start)*1000)}ms"
    )

    if not policy_result.passed:
        explanation = explain_block(
            intent.raw_input,
            policy_result.reason or "",
            policy_result.rule_triggered
        )
        append_audit_entry(
            intent, constants.DECISION_BLOCKED,
            policy_result, NULL_CART, NULL_RISK, NULL_IDEM, NULL_PAYMENT, db
        )
        return IntentResponse(
            intent_id=intent.intent_id,
            status="blocked",
            block_reason=policy_result.reason,
            block_explanation=explanation,
            bounded_intent=intent.model_dump(mode="json"),
        )

    # -----------------------------------------------------------------------
    # Stage 3: Cart Snapshot + Integrity Verification
    # -----------------------------------------------------------------------
    cart = _get_synthetic_cart(intent.intent_id, intent.category, intent.max_amount_paise)
    
    # Enforce budget invariant: cart total cannot exceed authorized max_amount_paise
    if cart.total_paise() > intent.max_amount_paise:
        cart_result = CartIntegrityResult(
            passed=False,
            reason="exceeds_transaction_cap",
            changed_fields=["price_paise"],
        )
        append_audit_entry(
            intent, constants.DECISION_BLOCKED,
            policy_result, cart_result, NULL_RISK, NULL_IDEM, NULL_PAYMENT, db
        )
        return IntentResponse(
            intent_id=intent.intent_id,
            status="blocked",
            block_reason="exceeds_transaction_cap",
            block_explanation="The items in the cart exceed your authorized budget ceiling.",
            bounded_intent=intent.model_dump(mode="json"),
        )

    take_cart_snapshot(intent.intent_id, cart, db)
    # Verify immediately (for demo: simulates the auth→exec time gap)
    cart_result = verify_cart_integrity(intent.intent_id, cart, db)

    if not cart_result.passed:
        append_audit_entry(
            intent, constants.DECISION_BLOCKED,
            policy_result, cart_result, NULL_RISK, NULL_IDEM, NULL_PAYMENT, db
        )
        return IntentResponse(
            intent_id=intent.intent_id,
            status="blocked",
            block_reason=cart_result.reason,
            bounded_intent=intent.model_dump(mode="json"),
        )

    # -----------------------------------------------------------------------
    # Stage 4: Risk Check (advisory anomaly score — never blocks alone)
    # -----------------------------------------------------------------------
    risk_result = check_risk(intent, policy, db)
    # risk_result.passed is always True for MVP; anomaly_score is logged in audit

    # -----------------------------------------------------------------------
    # Stage 5: Idempotency Guard (replay + cross-agent detection)
    # -----------------------------------------------------------------------
    idempotency_result = check_and_reserve_idempotency_key(
        intent.idempotency_key,
        intent.intent_id,
        intent.agent_id,
        policy.idempotency_key_ttl_seconds,
        db
    )

    if not idempotency_result.passed:
        append_audit_entry(
            intent, constants.DECISION_BLOCKED,
            policy_result, cart_result, risk_result, idempotency_result, NULL_PAYMENT, db
        )
        return IntentResponse(
            intent_id=intent.intent_id,
            status="blocked",
            block_reason=idempotency_result.reason,
            bounded_intent=intent.model_dump(mode="json"),
        )

    # -----------------------------------------------------------------------
    # Stage 6: Action Executor (Razorpay test-mode)
    # -----------------------------------------------------------------------
    payment_result = NULL_PAYMENT
    try:
        order = create_order(
            intent_id=intent.intent_id,
            agent_id=intent.agent_id,
            amount_paise=cart.total_paise(),
            category=intent.category,
            idempotency_key=intent.idempotency_key,
        )
        link = create_payment_link(
            intent_id=intent.intent_id,
            order_id=order.order_id,
            amount_paise=cart.total_paise(),
            item_description=intent.item_description,
        )
        payment_result = PaymentResult(
            razorpay_order_id=order.order_id,
            payment_link_url=link.short_url,
            status="pending",
        )
    except Exception as e:
        logger.error(f"Razorpay execution failed: {e}")
        append_audit_entry(
            intent, constants.DECISION_BLOCKED,
            policy_result, cart_result, risk_result, idempotency_result, NULL_PAYMENT, db
        )
        raise HTTPException(
            status_code=502,
            detail={"error": "razorpay_failed", "detail": str(e)}
        )

    # -----------------------------------------------------------------------
    # Audit: ALLOWED path — every allowed request has exactly one audit entry
    # -----------------------------------------------------------------------
    elapsed_ms = int((time.time() - start_time) * 1000)
    logger.info(f"Intent {intent.intent_id} ALLOWED in {elapsed_ms}ms")
    append_audit_entry(
        intent, constants.DECISION_ALLOWED,
        policy_result, cart_result, risk_result, idempotency_result, payment_result, db
    )

    return IntentResponse(
        intent_id=intent.intent_id,
        status="allowed",
        payment_link_url=payment_result.payment_link_url,
        razorpay_order_id=payment_result.razorpay_order_id,
        bounded_intent=intent.model_dump(mode="json"),
    )


@router.get("/intents/{intent_id}")
def get_intent(intent_id: str, db: Session = Depends(get_db)):
    """Get the full decision trail for a specific intent from the audit log."""
    row = db.execute(
        text("SELECT * FROM audit_log WHERE intent_id=:iid ORDER BY entry_id DESC LIMIT 1"),
        {"iid": intent_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Intent not found in audit log")
    return {
        "entry_id": row[0],
        "final_decision": row[6],
        "payload": json.loads(row[5])
    }


@router.get("/agents/{agent_id}/spend")
def get_agent_spend(agent_id: str, db: Session = Depends(get_db)):
    """Get agent's current daily spend and policy limits."""
    today = datetime.now(timezone.utc).date().isoformat()
    row = db.execute(
        text(
            "SELECT daily_spend_paise, request_count_today FROM agent_state "
            "WHERE agent_id=:a AND date=:d"
        ),
        {"a": agent_id, "d": today}
    ).fetchone()
    policy = get_policy()
    return {
        "agent_id": agent_id,
        "date": today,
        "daily_spend_paise": row[0] if row else 0,
        "daily_spend_inr": (row[0] / 100) if row else 0,
        "daily_cap_paise": policy.max_daily_spend_per_agent_paise,
        "daily_cap_inr": policy.max_daily_spend_per_agent_paise / 100,
        "request_count_today": row[1] if row else 0,
    }


@router.get("/policy")
def get_policy_view():
    """Return the currently active policy configuration (human-readable INR values)."""
    p = get_policy()
    return {
        "max_transaction_amount_inr": p.max_transaction_amount_paise / 100,
        "max_daily_spend_per_agent_inr": p.max_daily_spend_per_agent_paise / 100,
        "requires_human_confirmation_above_inr": p.requires_human_confirmation_above_paise / 100,
        "allowed_categories": p.allowed_categories,
        "max_requests_per_minute_per_agent": p.max_requests_per_minute_per_agent,
        "idempotency_key_ttl_seconds": p.idempotency_key_ttl_seconds,
        "all_blocked": p.all_blocked,
    }


@router.post("/demo/cart-tamper")
def demonstrate_cart_tamper(db: Session = Depends(get_db)):
    """
    Demo-only endpoint: create a cart snapshot, then verify against a tampered cart.
    Returns the CartIntegrityResult showing the detected tamper.
    Used during the demo and integration test suite to prove cart integrity check.
    """
    import uuid
    from datetime import datetime, timezone
    from agentguard.models import Cart, CartItem
    from agentguard.core.cart_verifier import take_cart_snapshot, verify_cart_integrity

    intent_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()

    db.execute(
        text("""
            INSERT INTO intents (intent_id, agent_id, raw_input, idempotency_key, status, created_at, expires_at)
            VALUES (:iid, 'demo-agent', 'cart tamper demo', :key, 'parsed', :now, :exp)
        """),
        {"iid": intent_id, "key": f"demo-{intent_id[:8]}", "now": now_iso, "exp": 9999999999.0}
    )
    db.commit()

    # Authorized cart: 1 running shoe at 3,500 INR (350,000 paise)
    authorized_cart = Cart(
        intent_id=intent_id,
        merchant_id="merchant-001",
        items=[CartItem(sku="SHOE-001", name="Running Shoes Pro", price_paise=350000, quantity=1, merchant_id="merchant-001")]
    )
    take_cart_snapshot(intent_id, authorized_cart, db)

    # Tampered cart: same item but price altered to 5,000 INR (500,000 paise)
    tampered_cart = Cart(
        intent_id=intent_id,
        merchant_id="merchant-001",
        items=[CartItem(sku="SHOE-001", name="Running Shoes Pro", price_paise=500000, quantity=1, merchant_id="merchant-001")]
    )

    result = verify_cart_integrity(intent_id, tampered_cart, db)
    return {
        "scenario": "cart_tamper_demonstration",
        "authorized_price_inr": 3500,
        "tampered_price_inr": 5000,
        "integrity_check_passed": result.passed,
        "block_reason": result.reason,
        "changed_fields": result.changed_fields,
        "message": "Cart integrity check caught the price change" if not result.passed else "Unexpected: check passed"
    }
