# Master Project Document — AgentGuard
### Agentic Commerce Trust & Policy Gateway — A Payment Firewall for AI Buyers

> **Revision:** 1.0 | **Date:** 2026-08-23 | **Track:** 01 — AI Growth & Agentic Commerce
> **Deadline:** September 5, 2026 | **Source PRD:** `PRD_AgentGuard.md`
> **Composite Win Probability:** 8/10 | **Internship Signal:** 9–9.5/10

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Philosophy](#2-vision--philosophy)
3. [Problem Statement](#3-problem-statement)
4. [Design Principles](#4-design-principles)
5. [User Personas](#5-user-personas)
6. [Product Goals & Anti-Goals](#6-product-goals--anti-goals)
7. [Core Concepts & Mental Models](#7-core-concepts--mental-models)
8. [User Journey & Workflows](#8-user-journey--workflows)
9. [Feature Specifications](#9-feature-specifications)
10. [Information Architecture](#10-information-architecture)
11. [UX & Interaction Design](#11-ux--interaction-design)
12. [System Architecture](#12-system-architecture)
13. [Data Architecture](#13-data-architecture)
14. [AI/ML Architecture](#14-aiml-architecture)
15. [APIs & Integrations](#15-apis--integrations)
16. [Security & Compliance](#16-security--compliance)
17. [Cost & Scalability Considerations](#17-cost--scalability-considerations)
18. [Technical Stack & Infrastructure](#18-technical-stack--infrastructure)
19. [State Management & Data Flow](#19-state-management--data-flow)
20. [Backend Architecture](#20-backend-architecture)
21. [Frontend Architecture](#21-frontend-architecture)
22. [Testing Strategy](#22-testing-strategy)
23. [Observability & Monitoring](#23-observability--monitoring)
24. [Deployment Strategy](#24-deployment-strategy)
25. [Engineering Constraints](#25-engineering-constraints)
26. [Performance Requirements](#26-performance-requirements)
27. [Success Metrics & KPIs](#27-success-metrics--kpis)
28. [Demo Flow](#28-demo-flow)
29. [MVP Scope](#29-mvp-scope)
30. [Post-MVP Roadmap](#30-post-mvp-roadmap)
31. [Risks & Mitigations](#31-risks--mitigations)
32. [Open Questions](#32-open-questions)
33. [Glossary](#33-glossary)

---

## 1. Executive Summary

**AgentGuard** is a middleware policy and verification gateway that sits between an inbound AI buyer agent and Razorpay's payment execution APIs. It answers the single most important open question in agentic commerce: *"How do you stop an AI agent from doing something you didn't authorize, while still letting it transact autonomously?"*

The core thesis is deliberately contrarian: **the LLM explains, the policy engine decides.** Every money-moving authorization traces to deterministic, auditable code — not an LLM call. This separation is both technically correct and commercially defensible.

**What it does in one breath:** Accept natural-language purchase intent from an AI buyer → parse it into a bounded, structured authorization object → run four deterministic gates (policy, cart-integrity, risk, idempotency) → execute only cleared requests against Razorpay's test-mode APIs → write every decision (allowed or blocked) to a hash-chained, tamper-evident audit log.

**Why it wins:** It addresses the *actual* open problem Razorpay named on its own tracks page. The happy-path checkout already exists (SuperU, Nugget). The adversarial-failure story — over-cap, cart tampering, replay — is the differentiator, and this project is built around those blocked scenarios, not the happy path.

---

## 2. Vision & Philosophy

### North Star
Build the trust infrastructure layer that makes agentic commerce safe enough to actually deploy. Not a checkout bot, but the policy firewall *behind* every checkout bot.

### Core Philosophical Commitment
> "The LLM explains, the policy engine decides."

This principle is non-negotiable and must be stated explicitly throughout all documentation, the demo, and the pitch. It means:
- LLMs are used for: natural language understanding, structured intent extraction, human-readable explanations of decisions.
- LLMs are **never** used for: authorization allow/block decisions, financial risk judgments, identity verification.

### Design Philosophy
1. **Depth over breadth.** One working, tested, demo-able gateway beats four half-finished protocol adapters.
2. **Honesty by design.** Simulated personas are labeled as simulated. Metrics include false-positive rates. The build log documents real failures.
3. **Config-driven policy.** Business rules live in a YAML file, not in code. Operators can change limits without a deployment.
4. **Auditability as a first-class feature.** Every decision is logged, chained, and independently verifiable. Auditability is not bolted on — it is load-bearing.

---

## 3. Problem Statement

### The Landscape
Agentic commerce is live and accelerating. Razorpay already ships NPCI Unified Agent Protocol (UAP) pilots, Agent Studio, and in-app conversational purchase pilots. A global protocol race is underway — ACP (OpenAI/Stripe), AP2 (Google), x402 (Coinbase), UAP (NPCI) — with no interoperability and no dominant standard.

### The Obvious Submission (and Why It's Wrong)
The obvious hackathon entry is "an LLM that completes checkout." Razorpay already ships this (SuperU, Nugget-by-Zomato). It is not a differentiator and does not address the actual open problem.

### The Actual Open Problem
Agentic commerce introduces failure modes that traditional checkout never had:

| Failure Mode | Description |
|---|---|
| **Prompt Injection** | Malicious content in a product description manipulates the agent's purchase decision |
| **Price/Product Substitution** | Cart contents change silently between authorization and execution |
| **Spend Limit Violation** | Agent exceeds the user-defined spending cap |
| **Ambiguous Intent** | Natural-language request is underspecified or could authorize a broader purchase than intended |
| **Authorization Replay** | A previously-executed authorization is re-submitted, attempting a duplicate charge |
| **Cross-Agent Identity Confusion** | One agent's token is used by a different agent |

No existing tool provides a transparent, auditable, revocable answer to: **"How do you bound an AI agent's spending authority and prove it was honored?"**

### Business Impact
- Merchants cannot safely enable AI buyers without a trust layer
- Razorpay cannot fully de-risk its own agentic-commerce roadmap without a reference policy implementation
- No existing payment infrastructure provides bounded, auditable, revocable authorization for AI buyers

---

## 4. Design Principles

| # | Principle | Operational Meaning |
|---|---|---|
| **P1** | LLM explains, code decides | LLMs never sit on the allow/block decision path |
| **P2** | Config, not code, for policy | All business rules are in a YAML config file, hot-swappable |
| **P3** | Every decision is logged | Blocked and allowed decisions both produce audit entries |
| **P4** | Honest simulation | Simulated AI buyers are labeled as such; no false claims of real protocol traffic |
| **P5** | Fail closed | Ambiguous or unknown states default to block, not allow |
| **P6** | Depth over breadth | One well-built path beats four broken adapters |
| **P7** | Auditability is load-bearing | The audit log is not a debugging afterthought — it is a core deliverable |
| **P8** | Security by architecture | Idempotency, cart-integrity, and policy checks are architectural gates, not optional middleware |

---

## 5. User Personas

### Persona 1 — The Razorpay Merchant (Primary)
- **Name:** Arjun, founder of a D2C running-gear brand
- **Context:** Experimenting with an AI shopping assistant on his storefront; wants customers' AI agents to be able to reorder without human friction, but is terrified of rogue purchases or unauthorized charges
- **Pain Point:** No way to bound what an AI buyer is allowed to purchase; no audit trail if something goes wrong
- **Goal:** Enable AI-powered purchasing with confidence that his store is protected
- **How AgentGuard helps:** Arjun configures a policy YAML (max 7,000 per transaction, footwear category only) and knows every AI purchase request passes through verifiable gates before touching the Razorpay API

### Persona 2 — The Razorpay Platform Team (Secondary)
- **Name:** Priya, PM on the Agent Studio / Agentic Commerce team at Razorpay
- **Context:** Building out agent-native payment infrastructure; needs a reference policy layer to de-risk the roadmap
- **Pain Point:** No existing reference implementation of bounded authorization for AI buyers
- **Goal:** Understand how a production-grade policy gateway should be architected
- **How AgentGuard helps:** Provides a working, auditable reference architecture that can be adapted for Razorpay's own product roadmap

### Persona 3 — The Simulated AI Buyer (System Actor)
- **Name:** AgentBot-001
- **Context:** An ACP-style JSON request sender, or a natural-language chat agent
- **Behavior:** Sends purchase intents in natural language; may (in adversarial scenarios) attempt to exceed caps, tamper with carts, or replay authorizations
- **Not a real user** — documented as a simulation throughout

### Persona 4 — The Hackathon Judge (Evaluator)
- **Name:** Senior Razorpay Engineer or PM
- **Goal:** Evaluate technical depth, defensibility of design decisions, and production-readiness signals
- **What they want to see:** A blocked adversarial scenario, a live hash-chain verification, and a clear statement of why the LLM does not decide

---

## 6. Product Goals & Anti-Goals

### Goals

| ID | Goal |
|---|---|
| G1 | Build a policy/verification middleware layer between an AI buyer and Razorpay's payment APIs |
| G2 | Support one real settlement rail (Razorpay test-mode) plus one convincingly simulated AI buyer persona |
| G3 | Parse natural-language purchase intent into a structured, bounded BoundedIntent object |
| G4 | Enforce a config-driven policy engine (spend caps, category allow-lists, confirmation thresholds) |
| G5 | Verify cart integrity: detect and block silent post-authorization changes to price, quantity, merchant, or currency |
| G6 | Produce a hash-chained, append-only audit log of every decision |
| G7 | Demo 2-3 explicit blocked scenarios alongside one successful end-to-end purchase |

### Anti-Goals (Hard Cuts)

| Anti-Goal | Reason |
|---|---|
| Working adapters for all four protocols (ACP, AP2, x402, UAP) | Public reference implementations are sparse; four half-finished adapters beat zero complete ones |
| Agent-readable catalog/manifest generator as a centerpiece | Commoditized — Cloudflare ships an official template; 30 minutes of scaffolding, not a demo highlight |
| Real cryptographic PKI or external notarization service | SHA-256 hash-chaining is sufficient to prove the concept |
| General-purpose ML anomaly model as load-bearing safety mechanism | Rule-based checks are the safety-critical path; ML is optional, advisory-only |
| LLM on the money-moving decision path | Violates the core thesis; every authorization must trace to deterministic policy code |

---

## 7. Core Concepts & Mental Models

### The BoundedIntent Object
The foundational data structure of the entire system. Every purchase request, regardless of its source format, is normalized into this schema before any processing occurs.

```typescript
interface BoundedIntent {
  agent_id: string;
  intent_id: string;
  idempotency_key: string;
  category: string;
  item_description: string;
  max_amount: number;           // INR
  currency: "INR";
  merchant_constraints: {
    allowed_merchant_ids?: string[];
    blocked_merchant_ids?: string[];
  };
  ttl_seconds: number;
  created_at: string;
  raw_input: string;
}
```

### The Five-Gate Pipeline
Every inbound purchase request passes through five sequential gates. **Failure at any gate immediately stops processing, logs the block, and returns a reason.**

```
[Intent Parser] -> [Policy Engine] -> [Cart Integrity] -> [Risk Check] -> [Idempotency Guard] -> [Action Executor]
```

Each gate is independently unit-testable, independently deployable, and independently auditable.

### The Audit Chain Mental Model
Think of the audit log like a blockchain: each entry contains the hash of the previous entry. Tamper with any entry and the chain breaks. A 10-line verification script can prove the entire history is intact. This is not cryptographic security — it is auditability at low cost.

### The LLM Boundary

```
[LLM ZONE]
  - Parse natural language
  - Explain blocked decisions
  (advisory, never authoritative)

         <-> structured JSON only <->

[DETERMINISTIC ZONE]
  - Policy engine (allow/block)
  - Cart integrity check
  - Risk rules
  - Idempotency guard
  - Razorpay API calls
```

---

## 8. User Journey & Workflows

### Happy Path — Legitimate AI Purchase

```
User configures policy YAML
         |
AI Buyer sends "buy running shoes, budget 7,000"
         |
AgentGuard receives request via REST endpoint
         |
Intent Parser (Claude): NL -> BoundedIntent JSON
         |
Policy Engine: checks spend cap (7,000 <= 7,000 PASS), category ("footwear" in allow-list PASS)
         |
Cart Integrity Verifier: snapshot taken; no changes detected PASS
         |
Risk Check: velocity under 5 req/min PASS, amount within normal range PASS
         |
Idempotency Guard: idempotency_key not seen before PASS
         |
Action Executor: POST /v1/orders -> POST /v1/payment_links (Razorpay test-mode)
         |
Webhook received: payment.captured
         |
Audit Log: entry written with all five gate results + payment outcome
         |
Dashboard: +1 to allowed count, receipt shown
```

### Blocked Path 1 — Over-Cap Purchase

```
AI Buyer: "buy running shoes for 9,999"
         |
Intent Parser: max_amount = 9,999
         |
Policy Engine: 9,999 > max_transaction_amount (7,000) -> BLOCK
         |
Audit Log: blocked entry written
         |
Response: {status: "blocked", reason: "exceeds_transaction_cap", cap: 7000, requested: 9999}
         |
Claude: generates plain-English explanation for dashboard display
```

### Blocked Path 2 — Cart Tampering

```
AI Buyer authorizes: 1x running shoes at 2,000 -> cart snapshot hashed
         |
Between authorization and execution: cart modified to 1x shoes at 5,000
         |
Cart Integrity Verifier: hash(current_cart) != hash(authorized_cart) -> BLOCK
         |
Audit Log: blocked with diff of changed fields
         |
Response: {status: "blocked", reason: "cart_integrity_failure", changed_fields: ["price"]}
```

### Blocked Path 3 — Authorization Replay

```
AI Buyer resends an already-executed idempotency_key
         |
Idempotency Guard: key found with status "executed" -> BLOCK
         |
Audit Log: replay attempt logged
         |
Response: {status: "blocked", reason: "replay_detected", original_execution_at: "..."}
```

### Admin Workflow — Audit Log Verification

```
Judge/Admin opens the audit log UI or runs the CLI verification script
         |
Script iterates entries: verify SHA-256(entry[n-1]) == entry[n].prev_hash
         |
If all entries pass: "Chain intact — N entries verified"
         |
If any entry fails: "Chain broken at entry N — possible tampering detected"
```

---

## 9. Feature Specifications

### Feature 1 — Intent Parser

**Purpose:** Transform unstructured natural-language purchase requests into typed, bounded, machine-readable authorization objects.

**User Value:** Removes the need for AI buyers to speak a specific API protocol; makes the system protocol-agnostic at the input layer.

**Functional Requirements:**
- Accept free-text purchase intent via REST POST endpoint
- Use Claude with tool-use/structured output to extract: category, max_amount, currency, merchant_constraints, ttl
- Validate extracted values against a JSON Schema before passing downstream
- Reject intents that produce invalid schema (e.g., negative amount, empty category)
- Generate a deterministic idempotency_key = SHA-256(agent_id + intent_hash + time_bucket_15min)
- Return the full BoundedIntent object as a JSON response

**Non-Functional Requirements:**
- Parse latency P95 < 2,000ms (LLM call included)
- Must fail safe: if LLM returns malformed JSON, return 422 with error, do not proceed

**UX Behavior:**
- Dashboard shows raw input alongside parsed BoundedIntent for each request
- Ambiguous parses are flagged visually with a "Needs human review" badge

**Backend Flow:**
```python
async def parse_intent(raw_input: str, agent_id: str) -> BoundedIntent:
    prompt = build_structured_prompt(raw_input)
    response = await claude_client.messages.create(
        model="claude-opus-4-5",
        tools=[bounded_intent_tool_schema],
        tool_choice={"type": "tool", "name": "create_bounded_intent"},
        messages=[{"role": "user", "content": prompt}]
    )
    intent_dict = response.content[0].input
    validated = BoundedIntent(**intent_dict)  # Pydantic validation
    validated.idempotency_key = generate_idempotency_key(agent_id, validated)
    return validated
```

**Data Model Impact:**
- New table: intents (intent_id, agent_id, raw_input, parsed_json, created_at, status)

**API Requirements:**
```
POST /api/v1/intents
Content-Type: application/json
Body: { "agent_id": "str", "raw_input": "str" }
Response 200: { "intent_id": "uuid", "bounded_intent": {...}, "status": "parsed" }
Response 422: { "error": "parse_failed", "detail": "..." }
```

**Edge Cases:**
- Empty input string -> 400 Bad Request
- LLM timeout -> 504, do not cache partial result
- Amount in non-INR currency mentioned -> attempt conversion or flag for human review
- Multiple items in one request -> parse as highest-cost item, flag the rest

**Failure Handling:**
- LLM call fails: return 503, log error, do not create audit entry
- Schema validation fails: return 422, create an audit entry with status "parse_rejected"

**Testing Requirements:**
- Unit: 20+ NL inputs covering normal, ambiguous, and adversarial phrasings
- Verify schema validation catches negative amounts, empty categories, missing fields
- Verify idempotency key is deterministic for identical inputs in the same 15-min bucket

---

### Feature 2 — Policy Engine

**Purpose:** Enforce merchant-configured business rules against a parsed BoundedIntent before any payment action.

**User Value:** Merchants can define exactly what an AI buyer is allowed to purchase, without writing code.

**Functional Requirements:**
- Load policy configuration from policy.yaml at startup (and reload on SIGHUP without restart)
- Enforce independently: max_transaction_amount, max_daily_spend_per_agent, allowed_categories, requires_human_confirmation_above, max_requests_per_minute_per_agent, idempotency_key_ttl
- Return a PolicyResult object: {passed: bool, reason: str | null, rule_triggered: str | null}
- Never call an LLM in this component

**Policy Configuration Schema:**
```yaml
# policy.yaml
max_transaction_amount: 7000
max_daily_spend_per_agent: 15000
requires_human_confirmation_above: 5000
allowed_categories:
  - footwear
  - groceries
  - electronics-accessories
max_requests_per_minute_per_agent: 5
idempotency_key_ttl: 24h
```

**Non-Functional Requirements:**
- Policy check latency < 10ms (database lookups only, no network calls)
- Policy decisions are fully deterministic: same input + same config = same output, always

**Backend Flow:**
```python
def check_policy(intent: BoundedIntent, policy: PolicyConfig, agent_state: AgentState) -> PolicyResult:
    if intent.max_amount > policy.max_transaction_amount:
        return PolicyResult(passed=False, reason="exceeds_transaction_cap", rule="max_transaction_amount")
    if agent_state.daily_spend + intent.max_amount > policy.max_daily_spend_per_agent:
        return PolicyResult(passed=False, reason="daily_cap_exceeded", rule="max_daily_spend_per_agent")
    if intent.category not in policy.allowed_categories:
        return PolicyResult(passed=False, reason="category_not_allowed", rule="allowed_categories")
    return PolicyResult(passed=True)
```

**Data Model Impact:**
- New table: agent_state (agent_id, date, daily_spend, request_count_this_minute, last_request_at)

**Edge Cases:**
- Agent has no prior history -> treat daily_spend as 0
- Policy file missing or malformed -> start in fail-closed mode (block all requests)
- Category value uses different casing -> normalize before comparison

**Testing Requirements:**
- Unit test each rule in isolation with boundary values (at limit, one under, one over)
- Integration test with policy file reload (send SIGHUP, verify new limits apply)
- Test fail-closed behavior when policy.yaml is absent

---

### Feature 3 — Cart Integrity Verifier

**Purpose:** Detect and block silent post-authorization changes to cart contents.

**User Value:** Prevents fraud where a merchant or malicious intermediary modifies the cart after an AI buyer authorizes the original contents.

**Functional Requirements:**
- At authorization time: hash the canonical cart representation and store it
- At execution time: recompute the hash and compare to stored hash
- If hashes differ: block execution, extract and log the diff
- Fields covered: price_per_item, quantity, merchant_id, currency, delivery_fee, total_amount
- Canonical form: sorted JSON keys, string-normalized amounts (store in paise, not rupees)

**Cart Snapshot Schema:**
```typescript
interface CartSnapshot {
  intent_id: string;
  snapshot_taken_at: string;
  cart_hash: string;
  canonical_cart_json: string;
  items: CartItem[];
}

interface CartItem {
  sku: string;
  name: string;
  price_paise: number;
  quantity: number;
  merchant_id: string;
}
```

**Non-Functional Requirements:**
- Hash computation < 1ms for catalogs up to 1,000 items
- Stored snapshots must not be mutable after creation (append-only table)

**Backend Flow:**
```python
def take_cart_snapshot(intent_id: str, cart: Cart) -> CartSnapshot:
    canonical = json.dumps(cart.to_dict(), sort_keys=True, ensure_ascii=True)
    cart_hash = hashlib.sha256(canonical.encode()).hexdigest()
    return CartSnapshot(intent_id=intent_id, cart_hash=cart_hash, canonical_cart_json=canonical)

def verify_cart_integrity(intent_id: str, current_cart: Cart) -> CartIntegrityResult:
    snapshot = db.get_cart_snapshot(intent_id)
    current_hash = compute_hash(current_cart)
    if current_hash != snapshot.cart_hash:
        diff = compute_diff(snapshot.canonical_cart_json, current_cart.to_json())
        return CartIntegrityResult(passed=False, changed_fields=diff)
    return CartIntegrityResult(passed=True)
```

**Edge Cases:**
- No snapshot found for intent_id -> block (fail-closed)
- Float price comparison issues -> always store and compare prices in integer paise

**Testing Requirements:**
- Test unchanged cart (pass), price change (block), quantity change (block), merchant change (block)
- Verify diff extraction correctly identifies which fields changed

---

### Feature 4 — Risk Check (Rule-Based)

**Purpose:** Catch velocity abuse and unusual transaction patterns before execution.

**Functional Requirements:**
- Velocity check: count requests from agent_id in the past 60 seconds; block if > max_requests_per_minute_per_agent
- Amount check: flag if amount is > 3x this agent's median historical transaction (advisory only)
- Category check: flag if intent.category is unusual for this agent's history (advisory)
- All blocking decisions must be from deterministic rules; anomaly flags are advisory only

**Non-Functional Requirements:**
- Risk check latency < 50ms

**Optional Stretch — Anomaly Z-Score:**
```python
def compute_amount_anomaly_score(agent_id: str, amount: float) -> float:
    """Advisory only. Never blocks without a deterministic rule co-signing."""
    history = db.get_agent_transaction_history(agent_id)
    if len(history) < 5:
        return 0.0
    mean = statistics.mean(history)
    stdev = statistics.stdev(history)
    return (amount - mean) / stdev if stdev > 0 else 0.0
```

---

### Feature 5 — Idempotency Guard

**Purpose:** Prevent replay attacks where a previously-executed authorization is re-submitted.

**Functional Requirements:**
- Maintain a key-value store of idempotency_key -> {status, executed_at, payment_id}
- On each request: if key found with status "executed", block with reason "replay_detected"
- Key TTL: configurable via idempotency_key_ttl in policy.yaml (default 24h)

**Data Model:**
```sql
CREATE TABLE idempotency_keys (
  key VARCHAR(64) PRIMARY KEY,
  intent_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  payment_id VARCHAR(100),
  expires_at TIMESTAMPTZ NOT NULL
);
```

**Edge Cases:**
- Key found but status is "failed" -> allow retry (payment failed, not a replay)
- Key found but status is "pending" -> block (in-flight request or race condition)
- Key found but expires_at is past -> treat as new request

---

### Feature 6 — Action Executor (Razorpay Integration)

**Purpose:** Execute the payment action on Razorpay's test-mode APIs after all gates have passed.

**Functional Requirements:**
- Create a Razorpay Order: POST /v1/orders with amount, currency, receipt, notes
- Create a Razorpay Payment Link: POST /v1/payment_links for the test-mode checkout flow
- Register webhook handlers for: payment.captured, payment.failed, order.paid
- On webhook receipt: update idempotency key status, update audit log, update agent daily spend
- Use test-mode API keys exclusively

**Razorpay Order Creation:**
```python
async def create_razorpay_order(intent: BoundedIntent, cart: Cart) -> RazorpayOrder:
    order_data = {
        "amount": cart.total_amount_paise,
        "currency": "INR",
        "receipt": intent.idempotency_key[:40],
        "notes": {
            "agent_id": intent.agent_id,
            "intent_id": str(intent.intent_id),
            "category": intent.category
        }
    }
    return await razorpay_client.orders.create(order_data)
```

**Edge Cases:**
- Razorpay API returns 5xx -> retry once with exponential backoff, then fail gracefully
- Webhook arrives out of order -> handle idempotently
- Webhook signature validation fails -> reject and log

---

### Feature 7 — Hash-Chained Audit Log

**Purpose:** Provide a tamper-evident, append-only record of every decision made by the system.

**User Value:** Merchants, regulators, and auditors can independently verify that the system behaved as claimed.

**Functional Requirements:**
- Every request (allowed or blocked) produces exactly one audit entry
- Each entry contains: prev_hash, intent_id, intent_summary, policy_result, cart_check_result, risk_check_result, idempotency_check_result, final_decision, payment_result, timestamp
- Entry hash = SHA-256(JSON.stringify(entry) + prev_hash)
- First entry: prev_hash = "GENESIS"
- Database enforcement: no UPDATE or DELETE on audit_log table
- CLI verification script: independently runnable

**Audit Entry Schema:**
```typescript
interface AuditEntry {
  entry_id: number;
  prev_hash: string;
  entry_hash: string;
  intent_id: string;
  agent_id: string;
  timestamp: string;
  raw_input: string;
  bounded_intent: object;
  policy_result: { passed: boolean; reason: string | null; rule_triggered: string | null; };
  cart_integrity_result: { passed: boolean; changed_fields: string[] | null; };
  risk_check_result: { passed: boolean; anomaly_score: number | null; };
  idempotency_result: { passed: boolean; reason: string | null; };
  final_decision: "allowed" | "blocked";
  block_reason: string | null;
  payment_result: {
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    status: "success" | "failed" | "pending" | null;
  };
}
```

**Verification Script (verify_audit_chain.py):**
```python
#!/usr/bin/env python3
import hashlib, json, sys
from db import get_all_audit_entries_ordered

entries = get_all_audit_entries_ordered()
prev_hash = "GENESIS"
for i, entry in enumerate(entries):
    content = {k: v for k, v in entry.items() if k != "entry_hash"}
    computed = hashlib.sha256((json.dumps(content, sort_keys=True) + prev_hash).encode()).hexdigest()
    if computed != entry["entry_hash"]:
        print(f"Chain broken at entry {i} (entry_id={entry['entry_id']})", file=sys.stderr)
        sys.exit(1)
    prev_hash = entry["entry_hash"]
print(f"Chain intact -- {len(entries)} entries verified")
```

**Testing Requirements:**
- Unit: verify chain builds correctly for a sequence of 10 entries
- Unit: verify a tampered entry breaks the chain at the correct index
- Integration: run verification script on a real populated database after a demo run

---

### Feature 8 — Dashboard

**Purpose:** Provide a real-time visual summary of system decisions, blocked scenarios, and audit-chain status.

**Functional Requirements:**
- Show: total requests (allowed vs. blocked), block-reason breakdown, per-agent spend vs. cap
- Show: audit-chain verification status (run verification on demand)
- Show: individual request detail on click (full decision trail for each gate)
- Show: real-time feed of incoming requests with their status
- Support: running the hash-chain verification script from the UI

**Dashboard Sections:**
1. Summary Cards: Total Requests, Allowed, Blocked, Audit Chain Status
2. Block Reason Chart: Pie/bar chart of why requests were blocked
3. Per-Agent Spend Tracker: Each agent's daily spend vs. configured cap
4. Live Request Feed: Streaming table of recent requests with status badges
5. Request Detail Drawer: Click any request to see all five gate results
6. Audit Log Viewer: Paginated list of audit entries with hash display

---

## 10. Information Architecture

```
AgentGuard System
|-- /api                           (Backend REST API)
|   |-- /v1/intents                POST - receive and parse incoming purchase intent
|   |-- /v1/agents/{id}/policy     GET - view policy for an agent
|   |-- /v1/audit                  GET - retrieve audit entries (paginated)
|   |-- /v1/audit/verify           POST - run hash-chain verification
|   `-- /webhooks/razorpay         POST - receive Razorpay payment webhooks
|-- /dashboard                     (Frontend React App)
|   |-- /                          Summary dashboard
|   |-- /requests                  Request feed + detail
|   |-- /agents                    Per-agent spend tracker
|   `-- /audit                     Audit log viewer + verification runner
|-- /config
|   `-- policy.yaml                Merchant policy configuration
|-- /scripts
|   `-- verify_audit_chain.py      Standalone verification script
`-- /data
    `-- synthetic/                 Synthetic merchant catalog + request generator
```

---

## 11. UX & Interaction Design

### Design Aesthetic
- Dark theme with high-contrast status indicators (green = allowed, red = blocked, yellow = flagged)
- Real-time updates via WebSocket or Server-Sent Events for the request feed
- Minimal but information-dense — judges are technical; prioritize data clarity over decoration

### Key Interaction Patterns

**1. Request Detail Drawer**
Clicking any request row opens a slide-in drawer showing all five gate results in a vertical step-flow. Each gate shows: status icon, rule checked, result, time taken.

**2. Block Reason Display**
Blocked requests show: (a) the deterministic reason code, (b) the Claude-generated plain-English explanation, (c) the specific policy rule violated.

**3. Audit Chain Verification**
A prominent "Verify Chain" button on the audit log page runs the verification and shows a live terminal-style output. Green checkmark = intact. Red X = broken at entry N.

**4. Policy Config Viewer**
A read-only display of the active policy.yaml with each value highlighted when it's the reason a request was blocked.

### Wireframe — Main Dashboard
```
+------------------------------------------------------------+
| AgentGuard                                  [Verify Chain] |
+------------+---------------+--------------+----------------+
| Total: 47  | Allowed: 31   | Blocked: 16  | Chain: INTACT  |
+------------+---------------+--------------+----------------+
| LIVE REQUEST FEED                  BLOCK REASONS (Chart)   |
| +-------------------------------+  +--------------------+  |
| | PASS AgentBot-001 2000 shoes  |  | Over-cap: 8        |  |
| | FAIL AgentBot-001 9999 shoes  |  | Cart tamper: 4     |  |
| | FAIL AgentBot-002 replay      |  | Replay: 3          |  |
| +-------------------------------+  +--------------------+  |
| PER-AGENT SPEND VS. CAP                                    |
| AgentBot-001: [======----] 8,200 / 15,000                 |
| AgentBot-002: [==--------] 2,500 / 15,000                 |
+------------------------------------------------------------+
```

---

## 12. System Architecture

### High-Level Architecture

```
[EXTERNAL LAYER]
  [Simulated AI Buyer]
  "buy running shoes, budget 7,000"
         |
         | HTTP POST /api/v1/intents
         v
[AGENTGUARD GATEWAY]

  STAGE 1: Intent Parser
  Claude (structured output) -> BoundedIntent JSON
  Pydantic schema validation -> reject invalid
         |
  STAGE 2: Policy Engine
  Deterministic rule evaluation against policy.yaml
  Spend cap, category, confirmation threshold
         |
  STAGE 3: Cart Integrity Verifier
  SHA-256 hash comparison: authorized vs. execution cart
         |
  STAGE 4: Risk Check
  Velocity, amount anomaly (advisory), category history
         |
  STAGE 5: Idempotency Guard
  idempotency_key lookup -> replay detection
         |
  STAGE 6: Action Executor
  POST /v1/orders -> POST /v1/payment_links (test-mode only)
         |
         v
[RAZORPAY TEST MODE]
  Orders API, Payment Links API
  Webhooks: payment.captured etc.
         |
         v webhook callback
[SHARED INFRASTRUCTURE]
  Hash-Chained Audit Log (append-only)
  verify_audit_chain.py
  PostgreSQL: intents, agent_state, idempotency_keys, audit_log
  React Dashboard: live feed, block reasons, audit viewer
```

### Component Responsibilities

| Component | Responsibility | LLM Used? |
|---|---|---|
| Intent Parser | NL -> BoundedIntent | Yes (Groq — Llama-3.3-70b) |
| Policy Engine | Rule evaluation | No |
| Cart Integrity Verifier | Hash comparison | No |
| Risk Check | Velocity + anomaly | No (anomaly is advisory) |
| Idempotency Guard | Replay prevention | No |
| Action Executor | Razorpay API calls | No |
| Audit Log | Append-only record | No |
| Dashboard | Visualization | No |
| Block Explainer | Plain-English reason | Yes (Groq — Llama-3.1-8b-instant, post-decision) |

---

## 13. Data Architecture

### Database: PostgreSQL

**Principle:** Append-only for audit log and cart snapshots. No UPDATE or DELETE on these tables, enforced at the database layer.

### Table: intents
```sql
CREATE TABLE intents (
  intent_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        VARCHAR(100) NOT NULL,
  raw_input       TEXT NOT NULL,
  parsed_json     JSONB,
  idempotency_key VARCHAR(64) UNIQUE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'parsed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);
```

### Table: agent_state
```sql
CREATE TABLE agent_state (
  agent_id              VARCHAR(100) NOT NULL,
  date                  DATE NOT NULL,
  daily_spend_paise     BIGINT NOT NULL DEFAULT 0,
  request_count_today   INT NOT NULL DEFAULT 0,
  last_request_at       TIMESTAMPTZ,
  PRIMARY KEY (agent_id, date)
);
```

### Table: cart_snapshots (append-only)
```sql
CREATE TABLE cart_snapshots (
  snapshot_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id      UUID NOT NULL REFERENCES intents(intent_id),
  cart_hash      VARCHAR(64) NOT NULL,
  canonical_json TEXT NOT NULL,
  taken_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Row-level security: no UPDATE, no DELETE
```

### Table: idempotency_keys
```sql
CREATE TABLE idempotency_keys (
  key         VARCHAR(64) PRIMARY KEY,
  intent_id   UUID NOT NULL REFERENCES intents(intent_id),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at TIMESTAMPTZ,
  payment_id  VARCHAR(100),
  expires_at  TIMESTAMPTZ NOT NULL
);
```

### Table: audit_log (append-only, hash-chained)
```sql
CREATE TABLE audit_log (
  entry_id        BIGSERIAL PRIMARY KEY,
  prev_hash       VARCHAR(64) NOT NULL,
  entry_hash      VARCHAR(64) NOT NULL UNIQUE,
  intent_id       UUID REFERENCES intents(intent_id),
  agent_id        VARCHAR(100) NOT NULL,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload         JSONB NOT NULL,
  final_decision  VARCHAR(10) NOT NULL,
  block_reason    VARCHAR(100)
);
REVOKE UPDATE, DELETE ON audit_log FROM agentguard_app;
```

### Synthetic Merchant Catalog
```json
{
  "catalog": [
    { "sku": "SHOE-001", "name": "Running Shoes Pro", "category": "footwear", "price_paise": 350000 },
    { "sku": "SHOE-002", "name": "Trail Running Shoes", "category": "footwear", "price_paise": 450000 },
    { "sku": "GROC-001", "name": "Organic Muesli 1kg", "category": "groceries", "price_paise": 52000 },
    { "sku": "ELEC-001", "name": "USB-C Hub 7-port", "category": "electronics-accessories", "price_paise": 189900 }
  ]
}
```

---

## 14. AI/ML Architecture

### LLM Provider: Groq API (Free Tier)

Groq is used instead of Anthropic. Groq provides free API access with extremely low inference latency (often 10–50× faster than hosted Claude), making it ideal for a hackathon. The integration pattern (function calling / structured output) is OpenAI-compatible.

**Used for exactly two tasks:**
1. **Intent Parsing** — function calling / structured output. The model is constrained to fill the BoundedIntent schema. The function schema acts as a hard type boundary.
2. **Block Explanation** — after the deterministic policy engine makes a block decision, the model generates a human-readable plain-English explanation for the dashboard. This is cosmetic — it never changes the decision.

**Explicitly NOT used for:**
- Allow/block decisions
- Any financial risk judgment
- Any identity verification
- Any cart integrity check

### Recommended Groq Models for AgentGuard

| Use Case | Model | Reason |
|---|---|---|
| **Intent Parsing (primary)** | `llama-3.3-70b-versatile` | Best function-calling accuracy; highest structured-output reliability; 70B parameters handle ambiguous NL well |
| **Block Explanation (secondary)** | `llama-3.1-8b-instant` | Ultra-low latency (~100ms); block explanations are cosmetic and do not require 70B accuracy |
| **Fallback if rate-limited** | `mixtral-8x7b-32768` | Good function calling, long 32k context window if needed |

> **Why llama-3.3-70b-versatile for parsing?** Intent parsing is the only LLM call on the critical path. A misparse (e.g., wrong category, missing max_amount) can cause a false block or false allow — the 70B model reduces this risk significantly. The free Groq tier is generous enough for a hackathon demo.

### Groq Client Integration
```python
from groq import Groq
import os

client = Groq(api_key=os.environ["GROQ_API_KEY"])

async def parse_intent(raw_input: str, agent_id: str) -> BoundedIntent:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": raw_input}
        ],
        tools=[BOUNDED_INTENT_TOOL],
        tool_choice={"type": "function", "function": {"name": "create_bounded_intent"}},
        temperature=0,    # Deterministic output for consistent parsing
        max_tokens=512,
    )
    tool_call = response.choices[0].message.tool_calls[0]
    intent_dict = json.loads(tool_call.function.arguments)
    validated = BoundedIntent(**intent_dict)   # Pydantic validation
    validated.idempotency_key = generate_idempotency_key(agent_id, validated)
    return validated
```

### Intent Parsing Prompt Architecture
```python
SYSTEM_PROMPT = """
You are a purchase intent parser for AgentGuard, a payment security system.
Extract structured purchase intent from natural language.
You MUST call the create_bounded_intent function with the extracted data.
NEVER guess an amount that is not stated. If no amount is stated, set max_amount to null.
Always respond using the function call — never in plain text.
"""

BOUNDED_INTENT_TOOL = {
    "type": "function",
    "function": {
        "name": "create_bounded_intent",
        "description": "Create a structured bounded purchase intent from natural language",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Product category (e.g. footwear, groceries)"},
                "max_amount": {"type": "number", "description": "Maximum spend in INR. null if not stated."},
                "item_description": {"type": "string", "description": "Human-readable item description"},
                "merchant_constraints": {"type": "object", "description": "Optional merchant restrictions"},
                "ttl_seconds": {"type": "integer", "default": 3600}
            },
            "required": ["category", "item_description"]
        }
    }
}
```

### Optional Stretch — Anomaly Z-Score
- Compute z-score of intent.max_amount against agent's historical transaction amounts
- Flag as anomalous if z-score > 2.5
- Advisory only — appears in the audit log but cannot block a request unless a deterministic rule also triggers

### Model Selection Summary
- **Primary (intent parsing):** `llama-3.3-70b-versatile` — highest accuracy, supports function calling
- **Secondary (block explanation):** `llama-3.1-8b-instant` — lowest latency (~100ms), cosmetic use only
- **Fallback:** `mixtral-8x7b-32768` — long context, solid function calling
- All calls use `temperature=0` for deterministic structured output

---

## 15. APIs & Integrations

### Internal REST API

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/v1/intents | Submit a purchase intent for processing |
| GET | /api/v1/intents/{id} | Get full decision trail for an intent |
| GET | /api/v1/agents/{id}/spend | Get agent's current daily spend and limits |
| GET | /api/v1/audit | List audit entries (paginated, filterable) |
| POST | /api/v1/audit/verify | Run hash-chain verification |
| GET | /api/v1/policy | View current active policy config |
| POST | /webhooks/razorpay | Receive Razorpay payment webhooks |

### Razorpay API Integration

**Orders API:**
```
POST https://api.razorpay.com/v1/orders
Authorization: Basic <base64(key_id:key_secret)>
Body: { "amount": 350000, "currency": "INR", "receipt": "...", "notes": {...} }
Response: { "id": "order_XXX", "amount": 350000, "status": "created" }
```

**Payment Links API:**
```
POST https://api.razorpay.com/v1/payment_links
Body: { "amount": 350000, "currency": "INR", "description": "...", "order_id": "order_XXX" }
Response: { "id": "plink_XXX", "short_url": "https://rzp.io/...", "status": "created" }
```

**Webhook Events:**
| Event | Action |
|---|---|
| payment.captured | Update idempotency key to "executed", update audit log |
| payment.failed | Update idempotency key to "failed", update audit log |
| order.paid | Confirm order completion, update agent daily spend |

**Webhook Signature Validation:**
```python
import hmac, hashlib

def validate_razorpay_webhook(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### Synthetic AI Buyer Request Generator
```python
SCENARIOS = {
    "happy_path":   {"text": "buy running shoes, budget 7,000", "agent_id": "AgentBot-001"},
    "over_cap":     {"text": "buy running shoes for 9,999", "agent_id": "AgentBot-001"},
    "cart_tamper":  {"text": "buy shoes at 2,000", "tamper": {"price": 5000}},
    "replay":       {"text": "[replay of previous intent_id]"},
    "ambiguous":    {"text": "get me some shoes"},
}
```

---

## 16. Security & Compliance

### API Security
- All internal API endpoints require a Bearer token (HMAC-signed, short TTL)
- Razorpay webhook endpoint validates the X-Razorpay-Signature header before processing
- Test-mode keys stored in environment variables, never in code or config files
- Rate limiting on all public-facing endpoints

### Data Security
- No real customer PII — all data is synthetic or derived from Razorpay test-mode responses
- Audit log table: UPDATE and DELETE privileges revoked at the PostgreSQL role level
- Cart snapshots table: same append-only enforcement
- All database connections use TLS

### Audit Trail Integrity
- Hash-chaining provides tamper-evidence (not cryptographic signing — explicitly out of scope)
- Any modification to a historical audit entry breaks the chain at that point
- Verification script is independently runnable by any party with database read access

### Policy as a Security Boundary
- Policy config is loaded once at startup (or on SIGHUP)
- A malformed or missing policy.yaml causes the system to start in fail-closed mode
- Policy is not modifiable via API — only via file system, requiring server access

---

## 17. Cost & Scalability Considerations

### Groq API Costs (Demo Scale)
- **Free tier:** Groq's free API tier provides generous rate limits (approx. 14,400 requests/day on llama-3.3-70b-versatile, 30 requests/min)
- Each intent parse: ~300 tokens in, ~150 tokens out — **$0.00 on the free tier**
- Each block explanation: ~200 tokens in, ~100 tokens out — **$0.00 on the free tier**
- Demo run of 50-100 intents: **$0.00 total**
- Rate limit risk: 30 req/min for 70B model; pacing requests at demo speed is fine
- If rate-limited during demo: switch to `llama-3.1-8b-instant` (60 req/min limit) as a fallback

### Scalability Architecture (Post-MVP framing)
- The intent parser is the only LLM-dependent component and the primary latency bottleneck
- All other gates are in-process, sub-10ms, horizontally scalable without coordination
- The audit log is append-only, naturally shardable by time range
- The idempotency key store can be moved to Redis for sub-millisecond lookup at scale

---

## 18. Technical Stack & Infrastructure

### Backend
- **Language:** Python 3.12+
- **Framework:** FastAPI (async, Pydantic-native)
- **LLM Client:** `groq` Python SDK (`pip install groq`) — OpenAI-compatible interface
- **Razorpay Client:** `razorpay` Python SDK
- **Database ORM:** SQLAlchemy 2.0 (async) with Alembic migrations
- **Validation:** Pydantic v2
- **Config:** PyYAML for policy config, python-dotenv for secrets

### Database
- **Primary:** PostgreSQL 16+ (append-only enforcement via role grants)

### Frontend
- **Framework:** React 18 with TypeScript
- **Build tool:** Vite
- **Data fetching:** TanStack Query
- **Charts:** Recharts or Chart.js
- **Real-time:** Server-Sent Events (SSE) for live request feed
- **Alternative (if time is short):** Streamlit

### Infrastructure
- **Cloud:** AWS EC2 (t3.small or t3.medium, Ubuntu 22.04 LTS)
- **CI/CD:** GitHub Actions (separate repo, separate EC2)
- **Reverse Proxy:** Nginx (routes ports, handles SSL termination)
- **SSL:** Let's Encrypt via certbot (free)
- **Process Manager:** systemd or Docker Compose on EC2
- **Environment:** .env file on EC2 (never committed to repo)

### Synthetic Data
- **Generator:** Plain Python + faker library
- **Catalog:** JSON file, 10-30 SKUs across 3 categories

---

## 19. State Management & Data Flow

### Request Lifecycle State Machine

```
[NEW] -> Intent received
  |
[PARSING] -> Groq (Llama) processing
  |
[POLICY_CHECK] -> Rule evaluation
  |
[CART_CHECK] -> Hash comparison
  |
[RISK_CHECK] -> Velocity check
  |
[IDEMPOTENCY_CHECK] -> Replay detection
  |
[EXECUTING] -> Razorpay API call in flight
  |
[COMPLETED] -> Payment captured (terminal)
[BLOCKED]   -> Any gate failure (terminal)
[FAILED]    -> Razorpay payment failed (terminal)
```

Any transition from EXECUTING or later must update the idempotency key status atomically.

---

## 20. Backend Architecture

### Project Structure

```
agentguard/
|-- api/
|   |-- main.py
|   |-- routes/
|   |   |-- intents.py
|   |   |-- audit.py
|   |   `-- webhooks.py
|   `-- middleware/
|       `-- auth.py
|-- core/
|   |-- intent_parser.py
|   |-- policy_engine.py
|   |-- cart_verifier.py
|   |-- risk_checker.py
|   `-- idempotency_guard.py
|-- executor/
|   `-- razorpay_client.py
|-- audit/
|   |-- log.py
|   `-- verify.py
|-- models/
|   |-- bounded_intent.py
|   |-- audit_entry.py
|   `-- db.py
|-- config/
|   `-- loader.py
|-- synthetic/
|   |-- catalog.json
|   |-- buyer_generator.py
|   `-- scenarios.py
|-- scripts/
|   `-- verify_audit_chain.py
|-- tests/
|   |-- unit/
|   `-- integration/
|-- policy.yaml
|-- .env.example
|-- docker-compose.yml
`-- requirements.txt
```

### Gateway Pipeline Orchestrator
```python
async def process_intent(request: IntentRequest) -> IntentResponse:
    intent = await intent_parser.parse(request.raw_input, request.agent_id)

    policy_result = policy_engine.check(intent)
    if not policy_result.passed:
        audit_log.append(intent, policy_result, final_decision="blocked")
        raise HTTPException(403, detail=policy_result)

    snapshot = cart_verifier.take_snapshot(intent.intent_id, get_cart(intent))
    cart_result = cart_verifier.verify(intent.intent_id, get_current_cart(intent))
    if not cart_result.passed:
        audit_log.append(intent, cart_result=cart_result, final_decision="blocked")
        raise HTTPException(403, detail=cart_result)

    risk_result = risk_checker.check(intent)
    if not risk_result.passed:
        audit_log.append(intent, risk_result=risk_result, final_decision="blocked")
        raise HTTPException(403, detail=risk_result)

    idempotency_result = idempotency_guard.check(intent.idempotency_key)
    if not idempotency_result.passed:
        audit_log.append(intent, idempotency_result=idempotency_result, final_decision="blocked")
        raise HTTPException(409, detail=idempotency_result)

    order = await razorpay_client.create_order(intent, get_cart(intent))
    payment_link = await razorpay_client.create_payment_link(order)

    audit_log.append(intent, all_results, final_decision="allowed", payment=order)
    return IntentResponse(status="allowed", payment_link=payment_link.short_url)
```

---

## 21. Frontend Architecture

### React App Structure

```
dashboard/
`-- src/
    |-- components/
    |   |-- SummaryCards.tsx
    |   |-- RequestFeed.tsx
    |   |-- BlockReasonChart.tsx
    |   |-- AgentSpendTracker.tsx
    |   |-- RequestDetailDrawer.tsx
    |   `-- AuditLogViewer.tsx
    |-- pages/
    |   |-- Dashboard.tsx
    |   |-- Requests.tsx
    |   `-- Audit.tsx
    |-- hooks/
    |   |-- useSSEFeed.ts
    |   `-- useAuditVerify.ts
    |-- api/
    |   `-- agentguard.ts
    `-- App.tsx
```

### Real-Time Feed via SSE
```typescript
export function useSSEFeed(onEvent: (event: RequestEvent) => void) {
  useEffect(() => {
    const es = new EventSource('/api/v1/events');
    es.onmessage = (e) => onEvent(JSON.parse(e.data));
    return () => es.close();
  }, []);
}
```

---

## 22. Testing Strategy

### Test Pyramid
```
                   [E2E Tests] (2-3 full demo scenarios)
               [Integration Tests] (per component)
           [Unit Tests] (every rule, every edge case)
```

### Unit Tests — Policy Engine
```python
def test_over_cap_blocked():
    intent = BoundedIntent(max_amount=7001, category="footwear")
    result = policy_engine.check(intent, policy=default_policy)
    assert not result.passed
    assert result.rule_triggered == "max_transaction_amount"

def test_at_cap_allowed():
    intent = BoundedIntent(max_amount=7000, category="footwear")
    result = policy_engine.check(intent, policy=default_policy)
    assert result.passed

def test_category_blocked():
    intent = BoundedIntent(category="luxury-watches", max_amount=500)
    result = policy_engine.check(intent, policy=default_policy)
    assert not result.passed
```

### Unit Tests — Cart Integrity
```python
def test_unchanged_cart_passes():
    cart_verifier.take_snapshot("intent-001", cart)
    result = cart_verifier.verify("intent-001", cart)
    assert result.passed

def test_price_change_blocked():
    cart_verifier.take_snapshot("intent-001", cart)
    tampered = cart.with_price(cart.price * 2)
    result = cart_verifier.verify("intent-001", tampered)
    assert not result.passed
    assert "price_paise" in result.changed_fields
```

### Unit Tests — Audit Chain
```python
def test_chain_intact():
    entries = [build_entry(i) for i in range(10)]
    assert audit_verifier.verify(entries) == (True, 10)

def test_tampered_entry_detected():
    entries = [build_entry(i) for i in range(10)]
    entries[5]["payload"]["amount"] = 99999
    intact, broken_at = audit_verifier.verify(entries)
    assert not intact
    assert broken_at == 5
```

### Adversarial Test Set (mandatory before demo recording)
- [ ] Over-cap purchase: 100% block rate
- [ ] Cart tampering (price, quantity, merchant): 100% block rate
- [ ] Authorization replay: 100% block rate
- [ ] Category-not-allowed: 100% block rate
- [ ] Legitimate purchases (10+ variations): >95% allow rate

---

## 23. Observability & Monitoring

### Logging
- Structured JSON logs from FastAPI (via structlog)
- Every gate decision logged with: intent_id, gate_name, passed, reason, latency_ms

### Metrics (Demo-Scale — Dashboard Only)
- Total requests processed
- Allow/block rates by reason
- Per-agent daily spend vs. cap
- Gate-by-gate latency (P50, P95)
- Audit chain verification status

### Alerts (Post-MVP)
- Policy.yaml missing or malformed -> start in fail-closed mode, log CRITICAL
- Audit chain broken -> log CRITICAL, halt new writes until investigated

---

## 24. Deployment Strategy

### Overview
AgentGuard is deployed as a standalone project on a dedicated AWS EC2 instance, with GitHub Actions handling CI/CD from the GitHub repo. Nginx runs as a reverse proxy in front of FastAPI and serves the React dashboard. PostgreSQL runs in a Docker container on the same instance.

```
[GitHub Repo: agentguard]
         |
   push to main branch
         |
   GitHub Actions workflow
         |
   SSH into EC2 + docker compose up --build
         |
[AWS EC2 Instance]
  Nginx (:80/:443)
    |-- /api      --> FastAPI (:8000)
    |-- /         --> React build (:3000 or static files)
  PostgreSQL (:5432, internal only)
  Docker Compose manages all services
```

---

### Step 1 — EC2 Instance Setup (One-time)

```bash
# 1. Launch EC2: Ubuntu 22.04 LTS, t3.small minimum, t3.medium recommended
# 2. Security Group inbound rules:
#    - Port 22  (SSH)   — your IP only
#    - Port 80  (HTTP)  — 0.0.0.0/0
#    - Port 443 (HTTPS) — 0.0.0.0/0
# 3. Assign an Elastic IP to the instance

# SSH into the instance
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Install Docker + Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git nginx certbot python3-certbot-nginx
sudo usermod -aG docker ubuntu
newgrp docker

# Create app directory
mkdir -p /home/ubuntu/agentguard
```

---

### Step 2 — Nginx Configuration

```nginx
# /etc/nginx/sites-available/agentguard
server {
    listen 80;
    server_name agentguard.yourdomain.com;  # Replace with your domain or EC2 IP

    # API — FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Razorpay webhooks
    location /webhooks/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE endpoint — disable buffering
    location /api/v1/events {
        proxy_pass http://127.0.0.1:8000;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # React dashboard — serve static build
    location / {
        root /home/ubuntu/agentguard/dashboard/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable and test
sudo ln -s /etc/nginx/sites-available/agentguard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL via Let's Encrypt (if you have a domain)
sudo certbot --nginx -d agentguard.yourdomain.com
```

---

### Step 3 — Docker Compose on EC2

```yaml
# docker-compose.yml (committed to repo, no secrets)
version: '3.8'
services:
  api:
    build: .
    ports: ["8000:8000"]
    env_file: .env           # .env lives on EC2, never in repo
    volumes:
      - ./policy.yaml:/app/policy.yaml
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: agentguard
      POSTGRES_USER: agentguard
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agentguard"]
      interval: 10s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

---

### Step 4 — .env File on EC2 (Never Commit This)

Create this file at `/home/ubuntu/agentguard/.env` directly on the EC2 instance:

```bash
# /home/ubuntu/agentguard/.env
# ============================================================
# AgentGuard — Environment Configuration
# DO NOT commit this file. Add .env to .gitignore.
# ============================================================

# ----- Groq API (LLM — Intent Parsing & Block Explanation) -----
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Primary model for intent parsing (structured output)
GROQ_MODEL_INTENT=llama-3.3-70b-versatile
# Secondary model for block explanations (cosmetic, low-latency)
GROQ_MODEL_EXPLAIN=llama-3.1-8b-instant
# Fallback model if primary is rate-limited
GROQ_MODEL_FALLBACK=mixtral-8x7b-32768

# ----- Razorpay (Test Mode ONLY) -----
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Reminder: register webhook URL in Razorpay dashboard:
# https://agentguard.yourdomain.com/webhooks/razorpay
# Events: payment.captured, payment.failed, order.paid

# ----- PostgreSQL Database -----
DB_PASSWORD=your_strong_random_password_here
DATABASE_URL=postgresql://agentguard:${DB_PASSWORD}@db:5432/agentguard

# ----- Application Security -----
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your_64_char_hex_secret_here

# ----- CORS & Hosting -----
ALLOWED_ORIGINS=https://agentguard.yourdomain.com,http://localhost:3000
# Set to your EC2 domain or IP
APP_HOST=agentguard.yourdomain.com

# ----- App Behaviour -----
ENVIRONMENT=production        # or 'development'
LOG_LEVEL=INFO
```

---

### Step 5 — .env.example (Commit This to Repo)

```bash
# .env.example — committed to repo as a template
# Copy to .env and fill in real values on your EC2 instance

GROQ_API_KEY=
GROQ_MODEL_INTENT=llama-3.3-70b-versatile
GROQ_MODEL_EXPLAIN=llama-3.1-8b-instant
GROQ_MODEL_FALLBACK=mixtral-8x7b-32768

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

DB_PASSWORD=
DATABASE_URL=postgresql://agentguard:changeme@db:5432/agentguard

SECRET_KEY=
ALLOWED_ORIGINS=http://localhost:3000
APP_HOST=localhost

ENVIRONMENT=development
LOG_LEVEL=DEBUG
```

---

### Step 6 — GitHub Actions CI/CD Workflow

Create this file at `.github/workflows/deploy.yml` in the repo:

```yaml
name: Deploy AgentGuard to EC2

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run unit tests
        run: pytest tests/unit/ -v
        env:
          # Unit tests use mock LLM — no real API key needed
          GROQ_API_KEY: test_key_not_used_in_unit_tests
          DATABASE_URL: sqlite:///./test.db
          SECRET_KEY: test_secret_key_32_chars_minimum

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build React dashboard
        working-directory: ./dashboard
        run: |
          npm ci
          npm run build

      - name: Copy files to EC2 via rsync
        uses: burnett01/rsync-deployments@7.0.1
        with:
          switches: -avzr --delete --exclude='.env' --exclude='node_modules' --exclude='__pycache__'
          path: ./
          remote_path: /home/ubuntu/agentguard
          remote_host: ${{ secrets.EC2_HOST }}
          remote_user: ${{ secrets.EC2_USERNAME }}
          remote_key: ${{ secrets.EC2_SSH_PRIVATE_KEY }}

      - name: Deploy on EC2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_SSH_PRIVATE_KEY }}
          script: |
            cd /home/ubuntu/agentguard

            # Pull latest (rsync already copied, but in case of direct push)
            # docker compose pull

            # Run DB migrations
            docker compose run --rm api alembic upgrade head

            # Restart services
            docker compose up --build -d

            # Reload Nginx to pick up any config changes
            sudo systemctl reload nginx

            echo "AgentGuard deployed successfully"
```

### GitHub Repository Secrets (Settings -> Secrets -> Actions)

| Secret Name | Value |
|---|---|
| `EC2_HOST` | Your EC2 Elastic IP or domain |
| `EC2_SSH_PRIVATE_KEY` | Full contents of your EC2 .pem key file |
| `EC2_USERNAME` | `ubuntu` (Ubuntu AMI) |

> All application secrets (GROQ_API_KEY, RAZORPAY_KEY_SECRET, etc.) are stored in `.env` **directly on the EC2 instance**, not in GitHub Secrets. The deploy workflow uses rsync with `--exclude='.env'` so it never overwrites the live .env file.

---

### Deployment Checklist (First-Time Setup)

- [ ] EC2 instance launched (Ubuntu 22.04, t3.small+), Elastic IP assigned
- [ ] Security groups open: ports 22, 80, 443
- [ ] Docker + Docker Compose + Nginx + certbot installed on EC2
- [ ] `/home/ubuntu/agentguard/.env` created with all real values
- [ ] Nginx config created and enabled at `/etc/nginx/sites-available/agentguard`
- [ ] SSL certificate obtained via certbot (if using a domain)
- [ ] Razorpay webhook URL registered: `https://agentguard.yourdomain.com/webhooks/razorpay`
- [ ] GitHub repo secrets set: `EC2_HOST`, `EC2_SSH_PRIVATE_KEY`, `EC2_USERNAME`
- [ ] First manual deploy: `docker compose up --build -d` on EC2
- [ ] First Alembic migration: `docker compose run --rm api alembic upgrade head`
- [ ] Push to `main` branch and verify GitHub Actions workflow passes

---

## 25. Engineering Constraints

| Constraint | Value | Reason |
|---|---|---|
| Timeline | 13 build days (Aug 23 - Sep 5, 2026) | Hackathon deadline |
| Protocol adapters | One (Razorpay test-mode) | Depth over breadth |
| LLM on decision path | Not permitted | Core thesis: deterministic policy decides |
| Live money | Not permitted | Test-mode only |
| Real customer PII | Not permitted | Synthetic data only |
| Cryptographic PKI | Not required | SHA-256 hash-chaining is sufficient |
| ML as primary safety mechanism | Not permitted | Rule-based is the safety-critical path |

---

## 26. Performance Requirements

| Operation | Target Latency (P95) |
|---|---|
| Intent parsing (Groq — llama-3.3-70b-versatile) | < 800ms |
| Policy engine check | < 10ms |
| Cart integrity check | < 5ms |
| Risk check | < 50ms |
| Idempotency guard | < 5ms |
| Razorpay order creation | < 1,000ms |
| End-to-end (all gates + Razorpay) | < 4,000ms |
| Audit log write | < 20ms |
| Hash-chain verification (100 entries) | < 500ms |
| Dashboard page load | < 2,000ms |

---

## 27. Success Metrics & KPIs

| Metric | Target | How to Measure |
|---|---|---|
| Checkout success rate (legitimate requests) | >= 95% | Pass rate on the legitimate test set |
| Block rate on adversarial set | 100% | Every deliberate attack scenario is blocked |
| False-block rate (legitimate requests) | < 5% | Report honestly |
| Audit coverage | 100% | Every money-moving action has an audit entry |
| Audit chain integrity | Pass | Run verify_audit_chain.py live on a full batch |
| End-to-end latency | <= 4,000ms P95 | Measured and displayed on dashboard |

---

## 28. Demo Flow

**Total: 5 minutes. Lead with blocked scenarios, not the happy path.**

| Time | Beat | What to Show |
|---|---|---|
| 0:00-0:30 | Thesis | "Everyone's building an AI that can buy things. We built the layer that stops it from buying the wrong thing." |
| 0:30-1:30 | Happy Path | Agent sends "buy running shoes, budget 7,000" -> policy passes -> Razorpay test-mode payment completes -> receipt + audit entry |
| 1:30-2:15 | Blocked: Over-cap | Same agent tries 9,999 -> policy engine blocks -> reason displayed instantly |
| 2:15-3:00 | Blocked: Cart Tamper | Show authorized cart (2,000 shoes) -> modify price to 5,000 -> integrity checker catches it -> diff shown |
| 3:00-3:45 | Blocked: Replay | Resend already-executed request -> idempotency guard no-ops it -> "duplicate detected" |
| 3:45-4:30 | Audit Chain Verification | Open audit log -> run verify_audit_chain.py live -> "Chain intact -- N entries verified" |
| 4:30-5:00 | Close | "Every gate here is deterministic code, not an LLM call -- the LLM only explains what happened. That's the design decision we want to defend." |

**Critical:** Rehearse the verification step at least 3 times before recording, on a batch that includes at least one blocked entry.

---

## 29. MVP Scope

### In MVP

| Feature | Status |
|---|---|
| Intent parser (Claude, structured output) | Core |
| Policy engine (all 6 rules from policy.yaml) | Core |
| Cart integrity verifier (SHA-256 hash diff) | Core |
| Risk check (velocity, advisory anomaly) | Core |
| Idempotency guard (replay prevention) | Core |
| Razorpay test-mode integration (Orders + Payment Links) | Core |
| Razorpay webhooks (payment.captured, payment.failed) | Core |
| Hash-chained audit log | Core |
| Audit verification script | Core |
| React dashboard (summary + live feed + request detail) | Core |
| Synthetic AI buyer request generator | Core |
| Synthetic merchant catalog (10-30 SKUs) | Core |
| All 5 demo scenarios (1 happy + 4 blocked) | Core |
| policy.yaml config file (committed to repo) | Core |
| BUILD_LOG.md with real failures | Required for submission |
| README + architecture diagram | Required for submission |

### Explicitly Out of MVP

| Feature | Why Cut |
|---|---|
| ACP/AP2/x402 protocol adapters | Sparse public implementations; depth over breadth |
| Real cryptographic PKI | SHA-256 sufficient for demo |
| ML anomaly model as blocking mechanism | Advisory only |
| WhatsApp/voice notifications | Not relevant to AgentGuard |
| Real customer PII | Synthetic only |
| Live money / production keys | Test-mode only |

---

## 30. Post-MVP Roadmap

### Phase 2 — Protocol Adapters
- Implement one real ACP adapter using the existing adapter pattern boundary
- Document exact interface changes required for AP2 and x402

### Phase 3 — Multi-Merchant Policy Management
- Per-merchant policy YAML management via an admin API
- Policy versioning and rollback

### Phase 4 — Advanced Risk Engine
- ML anomaly model on production transaction history
- At-risk mandate prediction (predictive, not reactive)
- Behavioral agent fingerprinting across sessions

### Phase 5 — Real Cryptographic Signing
- Replace SHA-256 hash-chaining with ECDSA-signed entries
- External notarization service integration

### Phase 6 — Agent Identity & Delegation
- Agent credential registry (agent_id -> public key)
- OAuth-style delegation tokens
- Cross-agent trust hierarchy

---

## 31. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Simulated AI buyer looks obviously scripted | Medium | Medium | Vary phrasing; include genuinely ambiguous NL requests |
| Judges ask "which real protocol does this implement?" | High | Low | Frame as "the trust/policy layer any protocol would sit behind" |
| Scope creep into second/third protocol adapter | Medium | High | If you start one, stop -- go polish the audit log instead |
| Hash-chain verification script has a bug live | Low | High | Rehearse verification >=3 times before recording |
| Intent parser produces technically-valid but semantically nonsensical JSON | Medium | Medium | Tight Pydantic schema validation; this is your BUILD_LOG story |
| Claude structured output fails to use the tool | Low | Low | Retry once; if still failing, fall back to regex extraction |
| Razorpay webhooks not arriving promptly | Low | Medium | Use Razorpay dashboard to manually trigger webhook events during demo |

---

## 32. Open Questions

1. **Protocol adapter boundary:** Should the Intent Parser accept both NL (current) and structured JSON (ACP/AP2) in MVP? **Assumption:** NL only for MVP.

2. **Confirmation flow for requires_human_confirmation_above:** For MVP, this results in a blocked status with reason "confirmation_required" shown in the dashboard. An actual async confirmation flow is Post-MVP.

3. **Subscription API choice:** Default assumption is one-off purchases (Orders/Payment Links). Recurring via Subscriptions API is a stretch goal.

4. **Dashboard technology:** React if 2+ engineers; Streamlit if solo.

5. **Synthetic catalog SKUs:** 12 SKUs across 3 categories (4 per category) — enough to make the allow-list meaningful without complexity.

---

## 33. Glossary

| Term | Definition |
|---|---|
| AgentGuard | This system -- the policy and verification middleware between AI buyers and Razorpay |
| BoundedIntent | The core data structure representing a parsed, bounded purchase authorization request |
| Idempotency Key | A deterministic token that uniquely identifies a purchase intent; prevents replay attacks |
| Hash-Chained Audit Log | An append-only log where each entry contains the SHA-256 hash of the previous entry |
| Policy Engine | The deterministic rule evaluator; the component that makes allow/block decisions |
| Cart Integrity | The property that cart contents have not changed since authorization |
| Replay Attack | Resubmitting an already-executed authorization to trigger a duplicate payment |
| Cart Tampering | Modifying cart contents after authorization but before execution |
| TTL | Time-to-live; how long a BoundedIntent remains valid |
| Fail-Closed | Default behavior when state is ambiguous: block the request, not allow it |
| ACP | Agent Commerce Protocol (OpenAI/Stripe) |
| UAP | Unified Agent Protocol (NPCI) -- India's proposed standard for agentic commerce |
| AP2 | Google's proposed agentic commerce protocol |
| x402 | Coinbase's proposed HTTP 402-based payment protocol |
| Test-Mode | Razorpay's sandbox environment; no real money moves |
| Paise | The smallest unit of INR (1 INR = 100 paise); store all amounts in paise to avoid floating-point errors |
| Synthetic AI Buyer | The simulated agent sending purchase requests in the demo -- explicitly labeled as a simulation |

---

## Appendix A — 13-Day Build Plan

| Days | Date | Focus |
|---|---|---|
| 1-2 | Aug 23-24 | Design BoundedIntent schema; build policy.yaml format; create synthetic merchant catalog (12 SKUs) + AI-buyer request generator (5 scenario types) |
| 3-5 | Aug 25-27 | Build intent parser (Claude, structured output); build policy engine as an independently unit-testable module |
| 6-7 | Aug 28-29 | Build cart integrity verifier + idempotency guard; wire Razorpay test-mode Orders + Payment Links API |
| 8-9 | Aug 30-31 | Build hash-chained audit log + verification script; build React dashboard |
| 10 | Sep 1 | Run full adversarial test set end-to-end; fix false blocks/misses |
| 11 | Sep 2 | Polish demo flow exactly per Section 28; rehearse timing |
| 12 | Sep 3 | Record 5-min pitch video; write README + architecture diagram + BUILD_LOG.md |
| 13 | Sep 4-5 | Buffer: repo cleanup, re-record if needed, submit early |

## Appendix B — Submission Checklist

- [ ] Public GitHub repo with a clean README and setup instructions
- [ ] Architecture diagram (reuse Section 12)
- [ ] 5-minute pitch video following Section 28, leading with adversarial "blocked" moments
- [ ] BUILD_LOG.md with genuine real failures encountered
- [ ] policy.yaml committed to repo
- [ ] verify_audit_chain.py included and independently runnable by a judge
- [ ] 100% of adversarial test scenarios blocked (verified before recording demo)

---

*Master Project Document for AgentGuard -- v1.0 -- Generated from PRD_AgentGuard.md -- 2026-08-23*
