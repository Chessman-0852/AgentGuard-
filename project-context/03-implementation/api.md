# AgentGuard — API Reference

> **Source:** `Master_AgentGuard.md` §10, §15
> **Last updated:** 2026-09-03

---

## Base URL

```
http://localhost:8000   (local development and demo recording)
```

---

## Endpoints

### POST /api/v1/intents

**The main pipeline endpoint.** Accepts a natural-language purchase request and runs it through all five gates.

**Request:**
```json
{
  "agent_id": "AgentBot-001",
  "raw_input": "buy running shoes, budget 7000"
}
```

**Response — Allowed:**
```json
{
  "intent_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "allowed",
  "payment_link_url": "https://rzp.io/l/abc123",
  "razorpay_order_id": "order_PwHzBzKIaHtMBU",
  "bounded_intent": {
    "category": "footwear",
    "item_description": "running shoes",
    "max_amount_paise": 700000
  }
}
```

**Response — Blocked:**
```json
{
  "intent_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "blocked",
  "block_reason": "exceeds_transaction_cap",
  "block_explanation": "This purchase of running shoes for ₹9,999 exceeds the maximum allowed transaction amount of ₹7,000 per purchase.",
  "bounded_intent": {
    "category": "footwear",
    "item_description": "running shoes",
    "max_amount_paise": 999900
  }
}
```

**Error — Parse failure:**
```json
HTTP 422
{"error": "parse_failed", "detail": "raw_input is empty"}
```

**Block Reason Codes:**
| Code | Trigger |
|---|---|
| `exceeds_transaction_cap` | max_amount_paise > policy.max_transaction_amount_paise |
| `daily_spend_cap_exceeded` | agent's daily_spend_paise + amount > policy.max_daily_spend_per_agent_paise |
| `category_not_allowed` | intent.category not in policy.allowed_categories |
| `velocity_limit_exceeded` | requests in last 60s > policy.max_requests_per_minute_per_agent |
| `human_confirmation_required` | amount > policy.requires_human_confirmation_above_paise (treated as block for MVP) |
| `emergency_block_all` | policy.all_blocked = true |
| `cart_integrity_failure` | SHA-256 hash of execution cart != stored authorized cart hash |
| `replay_detected` | idempotency_key already in DB with status="executed" |
| `cross_agent_identity_violation` | idempotency_key belongs to a different agent_id |

---

### GET /api/v1/intents/{intent_id}

Get the full decision trail for a specific intent.

**Response:**
```json
{
  "entry_id": 5,
  "final_decision": "blocked",
  "payload": { ... full audit entry payload ... }
}
```

---

### GET /api/v1/agents/{agent_id}/spend

Get an agent's current daily spend vs. policy limit.

**Response:**
```json
{
  "agent_id": "AgentBot-001",
  "date": "2026-09-03",
  "daily_spend_paise": 350000,
  "daily_spend_inr": 3500,
  "daily_cap_paise": 1500000,
  "daily_cap_inr": 15000,
  "request_count_today": 3
}
```

---

### GET /api/v1/audit

List audit log entries (chronological, oldest first).

**Query params:**
- `limit` (default: 50, max: 200)
- `offset` (default: 0)

**Response:**
```json
{
  "entries": [
    {
      "entry_id": 1,
      "prev_hash": "GENESIS",
      "entry_hash": "a3f4...",
      "agent_id": "AgentBot-001",
      "timestamp": "2026-09-03T14:30:00",
      "payload": { ... },
      "final_decision": "allowed",
      "block_reason": null
    }
  ],
  "count": 1
}
```

---

### POST /api/v1/audit/verify

Run the hash-chain integrity verification on the entire audit log.

**Response — intact:**
```json
{
  "intact": true,
  "entries_checked": 47,
  "message": "Chain intact — 47 entries verified"
}
```

**Response — broken:**
```json
{
  "intact": false,
  "entries_checked": 5,
  "message": "Chain broken at entry index 5 (entry_id=6): hash mismatch"
}
```

---

### GET /api/v1/policy

View the currently loaded policy configuration. Read-only.

**Response:**
```json
{
  "max_transaction_amount_inr": 7000,
  "max_daily_spend_per_agent_inr": 15000,
  "requires_human_confirmation_above_inr": 5000,
  "allowed_categories": ["footwear", "groceries", "electronics-accessories"],
  "max_requests_per_minute_per_agent": 5,
  "idempotency_key_ttl_seconds": 3600,
  "all_blocked": false
}
```

---

### POST /webhooks/razorpay

Receive and validate Razorpay webhook events. HMAC-SHA256 signature validated before JSON is parsed.

**Required header:**
```
X-Razorpay-Signature: <hmac-sha256-of-raw-body>
```

**Handled events:**
| Event | Action |
|---|---|
| `payment.captured` | Update idempotency key status to "executed"; update agent daily spend; update intent status to "completed" |
| `payment.failed` | Update idempotency key status to "failed" (allows retry) |
| `order.paid` | No additional action (covered by payment.captured) |

**Response — valid signature:**
```json
{"status": "received", "event": "payment.captured"}
```

**Response — invalid signature:**
```
HTTP 400
{"detail": "Invalid webhook signature"}
```

---

### POST /api/v1/demo/cart-tamper *(demo only)*

Demonstrates cart integrity checking. Creates a snapshot at ₹3,500 then verifies against a ₹5,000 cart.

**Response:**
```json
{
  "scenario": "cart_tamper_demonstration",
  "authorized_price_inr": 3500,
  "tampered_price_inr": 5000,
  "integrity_check_passed": false,
  "block_reason": "cart_integrity_failure",
  "changed_fields": ["items"],
  "message": "Cart integrity check caught the price change"
}
```

---

### GET /health

Health check.

```json
{"status": "ok", "service": "agentguard"}
```

---

*Extracted from: `Master_AgentGuard.md` §10, §15. Adapted for Groq and SQLite.*
