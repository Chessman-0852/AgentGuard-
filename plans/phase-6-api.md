# Phase 6 — FastAPI Pipeline Orchestrator

> **Status:** [ ] Not started
> **Estimated time:** 2.5 hours
> **Day:** 2, first block
> **Depends on:** Phases 1-5 (all modules built and tested)

---

## Objective

Wire all five gates, the audit log, and the Razorpay executor into a single sequential pipeline exposed via FastAPI. Implement all seven REST endpoints. After this phase, the complete backend is functional end-to-end.

---

## Scope

- `agentguard/api/main.py` — FastAPI app initialization, startup/shutdown, CORS, logging
- `agentguard/api/routes/intents.py` — `POST /api/v1/intents` (the main pipeline endpoint)
- `agentguard/api/routes/audit.py` — audit log read and chain verify endpoints
- `agentguard/api/routes/webhooks.py` — Razorpay webhook receiver
- `tests/integration/test_pipeline.py` — end-to-end pipeline tests with mocked LLM and Razorpay

---

## Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Pipeline abort on first failure | Each gate checks result; if not passed, write audit entry and raise HTTPException | Matches the five-gate architecture exactly; no gate is skipped |
| Audit entry on every outcome | append_audit_entry() called in every code path (allowed AND blocked) | 100% audit coverage is an acceptance criterion |
| Cart snapshot timing | Snapshot taken immediately after intent is parsed and before policy check | The snapshot represents the cart at the moment of authorization |
| Synthetic cart | For MVP, the cart is derived from the catalog JSON based on the intent category | No real merchant cart API; synthetic catalog provides the item data |
| SSE events | Server-Sent Events endpoint (`GET /api/v1/events`) for Streamlit dashboard polling | Streamlit polls the REST API directly; SSE is a stretch feature |
| Logging | structlog JSON logs with gate-by-gate latency | Enables post-demo log analysis |
| Auth | Simple Bearer token check (HMAC-based) on all /api/ routes | Demo-level auth; not production-grade |

---

## Sequential Implementation Tasks

### Task 6.1 — agentguard/api/main.py

```python
# agentguard/api/main.py
import logging
import os
from contextlib import asynccontextmanager

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agentguard.config import load_policy, setup_sighup_reload
from agentguard.database import init_db

load_dotenv()

# Configure structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("AgentGuard starting up")
    init_db()
    load_policy()
    setup_sighup_reload()
    logger.info("Startup complete — policy loaded, DB initialized")
    yield
    logger.info("AgentGuard shutting down")


app = FastAPI(
    title="AgentGuard",
    description="Agentic Commerce Trust & Policy Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],     # Demo: allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from agentguard.api.routes.intents import router as intents_router
from agentguard.api.routes.audit import router as audit_router
from agentguard.api.routes.webhooks import router as webhooks_router

app.include_router(intents_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(webhooks_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "agentguard"}
```

### Task 6.2 — agentguard/api/routes/intents.py

```python
# agentguard/api/routes/intents.py
import json
import logging
import time
from datetime import datetime
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

# Null results for gates that were not reached (used in audit entry)
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
    status: str                          # "allowed" | "blocked"
    block_reason: Optional[str] = None
    block_explanation: Optional[str] = None   # LLM-generated, cosmetic
    payment_link_url: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    bounded_intent: Optional[dict] = None


def _get_synthetic_cart(intent_id: str, category: str, amount_paise: int) -> Cart:
    """
    Build a synthetic cart from the catalog matching the intent category.
    For demo: find the cheapest item in category that fits within max_amount_paise.
    """
    import os
    catalog_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "synthetic", "catalog.json")
    with open(catalog_path) as f:
        catalog = json.load(f)["catalog"]

    matching = [item for item in catalog if item["category"] == category and item["price_paise"] <= amount_paise]

    if not matching:
        # Fallback: use first item in category regardless of price
        matching = [item for item in catalog if item["category"] == category]

    if not matching:
        raise HTTPException(status_code=422, detail=f"No catalog items found for category: {category}")

    # Pick the item closest to max_amount (best value for money)
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
    all five gates and executes via Razorpay if all gates pass.

    Pipeline: Parse -> Policy -> Cart Snapshot + Verify -> Risk -> Idempotency -> Execute -> Audit
    """
    start_time = time.time()
    policy = get_policy()

    # -----------------------------------------------------------------------
    # Stage 1: Intent Parsing (only LLM call on the critical path)
    # -----------------------------------------------------------------------
    try:
        intent = parse_intent(request.raw_input, request.agent_id)
    except IntentParseError as e:
        raise HTTPException(status_code=422, detail={"error": "parse_failed", "detail": str(e)})

    # Persist intent to DB
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

    gate_start = time.time()

    # -----------------------------------------------------------------------
    # Stage 2: Policy Engine (deterministic, no LLM)
    # -----------------------------------------------------------------------
    policy_result = check_policy(intent, policy, db)
    logger.info(f"Policy gate: passed={policy_result.passed}, latency={int((time.time()-gate_start)*1000)}ms")

    if not policy_result.passed:
        explanation = explain_block(intent.raw_input, policy_result.reason or "", policy_result.rule_triggered)
        append_audit_entry(intent, constants.DECISION_BLOCKED, policy_result, NULL_CART, NULL_RISK, NULL_IDEM, NULL_PAYMENT, db)
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
    take_cart_snapshot(intent.intent_id, cart, db)
    # For MVP demo: verify immediately (simulates the auth->exec gap)
    cart_result = verify_cart_integrity(intent.intent_id, cart, db)

    if not cart_result.passed:
        append_audit_entry(intent, constants.DECISION_BLOCKED, policy_result, cart_result, NULL_RISK, NULL_IDEM, NULL_PAYMENT, db)
        return IntentResponse(
            intent_id=intent.intent_id,
            status="blocked",
            block_reason=cart_result.reason,
            bounded_intent=intent.model_dump(mode="json"),
        )

    # -----------------------------------------------------------------------
    # Stage 4: Risk Check (advisory anomaly + velocity already in policy)
    # -----------------------------------------------------------------------
    risk_result = check_risk(intent, policy, db)
    # risk_result.passed is always True for MVP (anomaly is advisory only)

    # -----------------------------------------------------------------------
    # Stage 5: Idempotency Guard (replay detection)
    # -----------------------------------------------------------------------
    idempotency_result = check_and_reserve_idempotency_key(
        intent.idempotency_key, intent.intent_id, intent.agent_id,
        policy.idempotency_key_ttl_seconds, db
    )

    if not idempotency_result.passed:
        append_audit_entry(intent, constants.DECISION_BLOCKED, policy_result, cart_result, risk_result, idempotency_result, NULL_PAYMENT, db)
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
        # Mark idempotency key as failed to allow retry
        from agentguard.executor.razorpay_client import handle_payment_failed
        # Don't call handle_payment_failed here (no payment_id yet); just log
        append_audit_entry(intent, constants.DECISION_BLOCKED, policy_result, cart_result, risk_result, idempotency_result, NULL_PAYMENT, db)
        raise HTTPException(status_code=502, detail={"error": "razorpay_failed", "detail": str(e)})

    # -----------------------------------------------------------------------
    # Audit: ALLOWED path
    # -----------------------------------------------------------------------
    elapsed_ms = int((time.time() - start_time) * 1000)
    logger.info(f"Intent {intent.intent_id} ALLOWED in {elapsed_ms}ms")
    append_audit_entry(intent, constants.DECISION_ALLOWED, policy_result, cart_result, risk_result, idempotency_result, payment_result, db)

    return IntentResponse(
        intent_id=intent.intent_id,
        status="allowed",
        payment_link_url=payment_result.payment_link_url,
        razorpay_order_id=payment_result.razorpay_order_id,
        bounded_intent=intent.model_dump(mode="json"),
    )


@router.get("/intents/{intent_id}")
def get_intent(intent_id: str, db: Session = Depends(get_db)):
    """Get full decision trail for a specific intent."""
    row = db.execute(
        text("SELECT * FROM audit_log WHERE intent_id=:iid ORDER BY entry_id DESC LIMIT 1"),
        {"iid": intent_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Intent not found in audit log")
    return {"entry_id": row[0], "final_decision": row[6], "payload": json.loads(row[5])}


@router.get("/agents/{agent_id}/spend")
def get_agent_spend(agent_id: str, db: Session = Depends(get_db)):
    """Get agent's current daily spend and limits."""
    from datetime import datetime
    today = datetime.utcnow().date().isoformat()
    row = db.execute(
        text("SELECT daily_spend_paise, request_count_today FROM agent_state WHERE agent_id=:a AND date=:d"),
        {"a": agent_id, "d": today}
    ).fetchone()
    from agentguard.config import get_policy
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
    """Return the currently active policy configuration."""
    from agentguard.config import get_policy
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
```

### Task 6.3 — agentguard/api/routes/audit.py

```python
# agentguard/api/routes/audit.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from agentguard.database import get_db
from agentguard.core.audit_log import get_audit_entries, verify_chain

router = APIRouter()


@router.get("/audit")
def list_audit_entries(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    entries = get_audit_entries(db, limit=limit, offset=offset)
    return {"entries": entries, "count": len(entries)}


@router.post("/audit/verify")
def verify_audit_chain(db: Session = Depends(get_db)):
    intact, count, message = verify_chain(db)
    return {"intact": intact, "entries_checked": count, "message": message}
```

### Task 6.4 — agentguard/api/routes/webhooks.py

```python
# agentguard/api/routes/webhooks.py
import json
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from agentguard.database import get_db
from agentguard.executor.razorpay_client import (
    validate_webhook_signature, handle_payment_captured, handle_payment_failed
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receive and process Razorpay webhook events.
    CRITICAL: Validate HMAC-SHA256 signature on raw body before parsing.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

    if not validate_webhook_signature(raw_body, signature, webhook_secret):
        logger.warning(f"Invalid webhook signature rejected")
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
        pass  # Covered by payment.captured; no additional action needed

    return {"status": "received", "event": event}
```

### Task 6.5 — Run the end-to-end smoke test

```bash
# Start the server
uvicorn agentguard.api.main:app --reload --port 8000

# In another terminal — run the smoke test sequence
# 1. Happy path
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes, budget 7000"}' | python -m json.tool

# 2. Over-cap
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes for 9999"}' | python -m json.tool

# 3. Verify audit chain
curl -s -X POST http://localhost:8000/api/v1/audit/verify | python -m json.tool

# Expected:
# Request 1: status="allowed", payment_link_url present
# Request 2: status="blocked", block_reason="exceeds_transaction_cap"
# Verify: intact=true, entries_checked=2
```

---

## Acceptance Criteria

- [ ] `uvicorn agentguard.api.main:app --port 8000` starts without error
- [ ] `GET /health` returns `{"status": "ok"}`
- [ ] `POST /api/v1/intents` with `raw_input="buy running shoes, budget 7000"` returns `status="allowed"` and a `payment_link_url`
- [ ] `POST /api/v1/intents` with `raw_input="buy running shoes for 9999"` returns `status="blocked"`, `block_reason="exceeds_transaction_cap"`
- [ ] `POST /api/v1/intents` with `raw_input="buy luxury watches for 5000"` returns `status="blocked"`, `block_reason="category_not_allowed"`
- [ ] `POST /api/v1/audit/verify` returns `intact=true` after the above two requests
- [ ] Every request (allowed and blocked) produces exactly one audit log entry (verified by `GET /api/v1/audit`)
- [ ] `POST /webhooks/razorpay` without a valid signature returns HTTP 400

---

## Deliverables

- `agentguard/api/main.py`
- `agentguard/api/routes/intents.py`
- `agentguard/api/routes/audit.py`
- `agentguard/api/routes/webhooks.py`
- Integration test results documented in BUILD_LOG.md

---

## Documentation Updates

- `BUILD_LOG.md`: Document any pipeline wiring issues found during integration.
- `BUILD_LOG.md`: Note actual P95 latency measured for each gate during smoke test.
