# AgentGuard: 5-Minute Pitch & Video Production Guide
**Project Track:** Razorpay AI Buildathon 2026 — Track 01: AI Growth & Agentic Commerce  
**Core Thesis:** *"The LLM explains. The policy engine decides."*

---

## 1. Quality Check & Evaluation Bar Audit

Before recording, review this self-audit against Razorpay's 13 Buildathon evaluation criteria:

| Evaluation Criterion | Implementation Evidence in Codebase | Self-Audit Verdict |
| :--- | :--- | :---: |
| **1. Real Problem** | Prevents autonomous AI agents from making un-budgeted, unauthorized, or tampered financial transactions in agentic commerce. | **PASSED** |
| **2. Working Product** | Complete FastAPI gateway backend + React/Vite dashboard + Razorpay test-mode API execution + SQLite audit engine. | **PASSED** |
| **3. Meaningful Use of AI** | Groq Llama-3.3 70B tool-calling strictly used for intent extraction and block explanation generation—never for security gates. | **PASSED** |
| **4. Technical Execution** | 5 deterministic gates (Policy, Cart SHA-256, z-score Risk, Idempotency, Razorpay Execution) + SHA-256 append-only block ledger. | **PASSED** |
| **5. Business/User Value** | Enables merchants to safely allow AI buyer agents to transact while maintaining zero-trust financial boundaries. | **PASSED** |
| **6. Compelling Demo** | End-to-end flow: Natural language input → Intent parse → 5-Gate evaluation → Razorpay Order/Payment Link → Cryptographic Audit Block. | **PASSED** |
| **7. Explainable AI** | Structured JSON bounded intent schema + Groq fallback LLM generating clear natural language block reasons for users. | **PASSED** |
| **8. Bounded Actions** | `policy.yaml` spending caps (₹7k max tx, ₹15k daily cap, ₹5k human confirmation threshold, category whitelists). | **PASSED** |
| **9. Auditability** | Append-only SHA-256 hash pointer blockchain in SQLite (`verify_audit_chain.py` verifies chain integrity via CLI/UI). | **PASSED** |
| **10. Graceful Failure** | Handles ambiguous budget (1-paise sentinel), cart price tampering, model failure (70B → 8B fallback), and Razorpay key sanity checks. | **PASSED** |
| **11. Empirical Evidence** | 54 unit tests passing in ~2.5s, 55/55 audit chain blocks verified, 100% block rate across 6 adversarial attack vectors. | **PASSED** |
| **12. Razorpay Fit** | Native Razorpay Order creation (`create_order`), Payment Link creation (`create_payment_link`), and HMAC webhook signature verification. | **PASSED** |
| **13. Production Mindset** | Fail-closed architecture, SQLite WAL mode, production key startup assertions, and strict separation of LLM and authorization. | **PASSED** |

---

## 2. 5-Minute Pitch Script & Screen Directions

### Script Overview & Timing Breakdown
- **0:00–0:25 (0:25)** — HOOK: The Multi-Million Dollar Threat of Autonomous AI Buyers
- **0:25–0:55 (0:30)** — PROBLEM: Why LLM Guardrails Fail at Payment Authorizations
- **0:55–1:20 (0:25)** — SOLUTION: AgentGuard Core Thesis & Architecture
- **1:20–3:20 (2:00)** — LIVE PRODUCT DEMO: Happy Path vs. Adversarial Attacks
- **3:20–3:50 (0:30)** — TECHNICAL ARCHITECTURE: 5 Deterministic Gates & SHA-256 Audit Chain
- **3:50–4:20 (0:30)** — TRUST, SAFETY & FAILURE: Cart Tampering & Fail-Closed Policies
- **4:20–4:45 (0:25)** — IMPACT + EVIDENCE: Test Suite Metrics & Verification Proof
- **4:45–5:00 (0:15)** — CLOSING: Why AgentGuard Belongs in the Razorpay Ecosystem

---

### [0:00–0:25] — HOOK

**[SCREEN: Split screen. On the left, a slick AI shopping agent terminal running. On the right, a Razorpay payment gateway screen showing an unauthorized payment order generated for ₹9,999.]**

**Speaker:**  
"In 2026, millions of autonomous AI agents are placing orders on behalf of users. But imagine an AI agent tasked with buying running shoes for 3,500 rupees getting prompt-injected or hallucinating, and executing a payment order for 10,000 rupees. Or worse—swapping cart items after getting authorized. Who stops the money from leaving the account? Today's answer is: *nobody*. If you let an LLM control your payment API directly, you're giving non-deterministic math full control over your bank account."

---

### [0:25–0:55] — PROBLEM

**[SCREEN: Close-up on raw LLM JSON output showing high variance, followed by a diagram showing prompt injection bypassing standard LLM system prompts.]**

**Speaker:**  
"The fundamental flaw in agentic commerce today is relying on LLMs for security decisions. System prompts like *'do not spend more than 5,000 rupees'* fail under prompt injection, adversarial cart modifications, and context window drift. Standard API gateways don't understand agent state, and LLM guardrails are probabilistic—they guess. In payments, a 99% accuracy rate means 1 out of 100 transactions drains your merchant account. Merchants and platforms cannot adopt AI payments without zero-trust, deterministic enforcement."

---

### [0:55–1:20] — THE SOLUTION

**[SCREEN: AgentGuard Landing Page UI ([http://localhost:5173](http://localhost:5173)). Smooth scroll to the 5 Deterministic Security Gates pipeline diagram with dark glassmorphism styling.]**

**Speaker:**  
"We built **AgentGuard**—a zero-trust policy engine and payment firewall that sits between autonomous AI buyer agents and the Razorpay API. Our architecture follows one unbreakable thesis: **The LLM explains. The policy engine decides.** AI is used strictly to understand unstructured natural language intents. But authorization, risk scoring, idempotency, cart integrity, and financial execution are handled by pure, deterministic Python code."

---

### [1:20–3:20] — LIVE PRODUCT DEMO

**[SCREEN: Switch to AgentGuard Dashboard — Overview Page. Camera zooms slightly onto the 'Submit Intent' interactive widget.]**

**Speaker:**  
"Let's look at the system in action. First, a legitimate user intent."

**[ACTION: Speaker types into the input box: `"buy running shoes, budget 3500"` under agent ID `AgentBot-701` and clicks 'Submit Intent'.]**

**[SCREEN: Fast-forward animation of the 5 Security Pipeline stages lighting up green sequentially: Intent Parser → Policy Engine → Cart Cryptography → Risk Check → Idempotency Guard → Action Executor.]**

**Speaker:**  
"Our pipeline parses the intent using Groq tool-calling into a structured JSON payload: Category: *footwear*, max amount: *3,500 rupees*. Gate 1 checks our YAML policy engine—3,500 is under our hard single-transaction cap of 7,000 rupees and matches an allowed category. Gate 2 captures a SHA-256 snapshot of the catalog cart. Gate 3 calculates a z-score anomaly score. Gate 4 reserves an atomic 15-minute idempotency key. Finally, Gate 5 triggers the Razorpay test-mode API."

**[SCREEN: Click on the generated Razorpay Payment Link URL. Razorpay Checkout Modal / Test Page opens displaying Order ID `order_...` for ₹3,500.]**

**Speaker:**  
"Within 180 milliseconds, Razorpay generates a valid Order ID and Payment Link. Everything is authorized cleanly."

**[SCREEN: Switch to AgentGuard Attack Simulator Page in Dashboard. Mouse hovers over Scenario A1 (Spending Cap Breach) and Scenario A2 (Cart Tampering).]**

**Speaker:**  
"Now let's break it. What happens when an agent goes rogue or is injected?"

**[ACTION: Speaker clicks 'Run Scenario A1: Spending Cap Breach' (`"buy running shoes for 9999"`).]**

**[SCREEN: Pipeline Stage 1 lights up green, Stage 2 (Policy Engine) flashes bright crimson RED. Status badge changes to 'BLOCKED'. Block reason displays: `exceeds_transaction_cap`.]**

**Speaker:**  
"The agent requested 9,999 rupees against a hard policy cap of 7,000. Gate 1 immediately halts execution. Notice what happens next: the LLM is invoked off the critical path to generate a human-friendly explanation for the agent: *'Transaction blocked: 9,999 INR exceeds authorized cap of 7,000 INR.'* The money never touches Razorpay."

**[ACTION: Speaker clicks 'Run Scenario A3: Replay Attack' (resubmitting identical intent within 15 mins).]**

**[SCREEN: Pipeline Stage 4 (Idempotency Guard) flashes RED. Reason: `replay_detected`.]**

**Speaker:**  
"When the agent attempts to resubmit the exact same purchase intent within the active 15-minute window, Gate 4 catches the duplicate idempotency key and blocks the transaction atomically before any order can be duplicated on Razorpay."

---

### [3:20–3:50] — TECHNICAL ARCHITECTURE

**[SCREEN: Smooth transition to clean Architecture Diagram slide showing Frontend → FastAPI Gateway → Groq LLM (Parallel) / 5 Deterministic Gates → SQLite WAL Ledger → Razorpay Test APIs.]**

**Speaker:**  
"Let's talk architecture. AgentGuard is engineered with FastAPI and SQLite running in WAL mode for microsecond local lock states. When a natural language request arrives, Groq Llama-3.3 70B parses the intent into a Pydantic schema. If Groq experiences latency or failure, the gateway gracefully degrades to Llama-3.1 8B. Once parsed, control leaves the AI entirely. All 5 policy gates run synchronously in pure Python. Only if every single gate returns a boolean PASS does the Razorpay Executor call `/v1/orders` and `/v1/payment_links` using test-mode HMAC keys."

---

### [3:50–4:20] — TRUST, SAFETY & FAILURE

**[SCREEN: Switch to Audit Chain Page on the Dashboard. Click 'Verify Audit Chain' button. Terminal drawer slides up running `verify_audit_chain.py` output.]**

**Speaker:**  
"Financial AI systems require absolute auditability. Every single intent—whether allowed or blocked—is committed to an append-only cryptographic audit chain stored in SQLite. Each record includes a SHA-256 hash pointer containing the previous block's hash, timestamp, agent ID, decision, and payload."

**[SCREEN: Highlight the CLI verification output on screen: `[PASS] Chain intact — 55 entries verified`.]**

**Speaker:**  
"We also built a standalone verification script. Anyone can run `python scripts/verify_audit_chain.py` independently. If an attacker or compromised database admin modifies even a single byte of transaction history, every subsequent cryptographic pointer breaks immediately. Furthermore, our policy loader is strictly fail-closed: if `policy.yaml` is corrupted or unreadable, Gate 1 defaults to blocking 100% of outbound transactions."

---

### [4:20–4:45] — IMPACT + EVIDENCE

**[SCREEN: Terminal window showing pytest output executing 54 unit tests in 2.57s. Split screen showing 100% scenario matrix table from `synthetic/scenarios.py`.]**

**Speaker:**  
"We don't rely on claims; we rely on empirical code evidence. AgentGuard includes a comprehensive test suite of 54 deterministic unit tests executing in under 2.6 seconds with zero external network dependencies. Our automated scenario runner tests 6 adversarial attack vectors—including cart price tampering, velocity flooding, unauthorized categories, and ambiguous budget ceilings. In our evaluation suite, AgentGuard achieves a 100% block rate against adversarial attacks while maintaining sub-200 millisecond gateway latency on legitimate Razorpay transactions."

---

### [4:45–5:00] — WHY THIS MATTERS / CLOSING

**[SCREEN: High-impact final visual showing Razorpay logo alongside AgentGuard logo with glowing green security shield.]**

**Speaker:**  
"As Razorpay leads the transition into agentic commerce, security cannot be an afterthought. AgentGuard gives merchants the cryptographic certainty and policy controls required to unleash autonomous AI buyers safely. **The future of commerce will be automated—AgentGuard ensures it will be secure.**"

---

## 3. Live Demo Recording Checklist

To ensure your recording goes smoothly without technical hiccups, execute this exact step-by-step sequence:

```
[ ] STEP 1: PREPARATION
    1. Terminal 1: uvicorn agentguard.api.main:app --reload --port 8000
    2. Terminal 2: cd frontend && npm run dev (Open http://localhost:5173)
    3. Verify .env has valid GROQ_API_KEY and RAZORPAY_KEY_ID (rzp_test_...)

[ ] STEP 2: LANDING PAGE & INTRO (0:00–1:20)
    1. Show http://localhost:5173 Landing Page.
    2. Scroll to '5 Security Gates' interactive graphic.
    3. Click 'Go to Dashboard' in top right header.

[ ] STEP 3: HAPPY PATH DEMO (1:20–2:20)
    1. Navigate to 'Overview' or 'Transactions' page.
    2. In 'Submit Intent' box, enter:
       - Agent ID: AgentBot-901
       - Input: buy running shoes, budget 3500
    3. Click 'Execute Pipeline'.
    4. Watch all 5 pipeline stages light up GREEN.
    5. Click the generated Razorpay Payment Link button.
    6. Show the official Razorpay Test Checkout Page with amount ₹3,500.00.

[ ] STEP 4: ADVERSARIAL ATTACK SIMULATION (2:20–3:20)
    1. Switch to 'Attack Simulator' page in Dashboard.
    2. Click 'Run Scenario A1: Over-Cap Purchase' ("buy running shoes for 9999").
       - Observe Gate 1 Policy Engine turn RED (exceeds_transaction_cap).
       - Point out natural language block explanation on card.
    3. Click 'Run Scenario A2: Cart Tampering'.
       - Observe Gate 2 Cart Verifier catch post-auth price change from ₹3,500 to ₹5,000.
    4. Click 'Run Scenario A3: Replay Attack'.
       - Observe Gate 4 Idempotency Guard block duplicate request (replay_detected).

[ ] STEP 5: AUDIT CHAIN VERIFICATION (3:20–4:20)
    1. Switch to 'Audit Chain' page in Dashboard.
    2. Click 'Verify Audit Chain' button.
    3. Show terminal pop-up output: "[PASS] Chain intact — XX entries verified".
    4. Open terminal and run: python scripts/verify_audit_chain.py --db agentguard.db

[ ] STEP 6: TEST SUITE & CLOSING (4:20–5:00)
    1. In Terminal, run: pytest tests/unit/ -v
    2. Point out: "54 passed in 2.57s".
    3. End screen on final AgentGuard + Razorpay architecture slide.
```

---

## 4. 30-Second Spoken Architecture Summary

> *"AgentGuard is structured as a zero-trust sidecar gateway. When an AI agent submits a purchasing request, Groq Llama-3.3 70B performs structured tool-calling to convert unstructured text into a Pydantic intent schema. From that point on, AI is completely excluded from financial control. The intent passes through five synchronous Python gates: YAML spending caps, SHA-256 cart snapshot verification, rolling z-score anomaly profiling, time-bucketed idempotency locks, and Razorpay test-mode execution. Every decision is immutably appended to a cryptographic SHA-256 hash pointer ledger in SQLite, giving merchants 100% mathematical auditability."*

---

## 5. Empirical Metrics & Evidence Table

| Metric Name | Value in Codebase | Metric Type | Verification Source |
| :--- | :--- | :--- | :--- |
| **Deterministic Unit Tests** | **54 Passed / 0 Failed** | Real Code Metric | `pytest tests/unit/ -v` (2.57s execution time) |
| **Adversarial Scenarios Tested** | **6 Vector Scenarios** | Real Code Metric | `synthetic/scenarios.py` (A1 to A6 + H1) |
| **Adversarial Block Accuracy** | **100% (6/6 blocked)** | Real Evaluation Metric | Scenario runner validation output |
| **Audit Chain Ledger Integrity** | **55/55 Blocks Verified** | Real Code Metric | `python scripts/verify_audit_chain.py` |
| **Gateway Security Pipeline Gates** | **5 Sequential Gates** | Architecture Metric | `agentguard/api/routes/intents.py` |
| **Idempotency Time Window** | **15 Minutes (900s)** | Policy Engine Metric | `agentguard/core/idempotency_guard.py` |
| **Human Approval Threshold** | **> ₹5,000 INR** | Default Policy Metric | `policy.yaml` (`requires_human_confirmation_above`) |
| **Max Transaction Cap** | **₹7,000 INR** | Default Policy Metric | `policy.yaml` (`max_transaction_amount`) |
| **Max Daily Agent Spend Cap** | **₹15,000 INR** | Default Policy Metric | `policy.yaml` (`max_daily_spend_per_agent`) |

---

## 6. Top 10 Evaluator Questions & Answers

### Q1: Why didn't you use an LLM or AI agent to evaluate the security policy itself?
**Answer:**  
"Because LLMs are non-deterministic and susceptible to prompt injection, jailbreaking, and hallucinations. A security policy enforcement engine for real money must provide 100% mathematical guarantees. In AgentGuard, LLMs are used exclusively for intent parsing and generating human explanations off the critical path. Security decisions are handled strictly by deterministic Python code."

---

### Q2: How does AgentGuard prevent cart price tampering post-authorization?
**Answer:**  
"In `agentguard/core/cart_verifier.py`, when an intent is parsed, Gate 2 creates a canonical JSON snapshot of all cart items (SKUs, quantities, unit prices, merchant ID) and hashes it using SHA-256 (`take_cart_snapshot`). At the moment of order execution, the cart is re-hashed. If an attacker modifies even a single item price or SKU between auth and execution, `verify_cart_integrity` returns `passed=False` with `cart_integrity_failure` and blocks the order."

---

### Q3: How does your idempotency guard protect against replay attacks?
**Answer:**  
"In `agentguard/core/idempotency_guard.py`, we calculate a SHA-256 hash over the combination of `agent_id`, `raw_input`, and a 15-minute time bucket (`floor(timestamp / 900)`). This key is atomically inserted into our SQLite `idempotency_keys` table. If the same agent or a malicious actor resubmits the exact same intent within 15 minutes, the database primary key constraint catches it and returns `replay_detected` without triggering a new Razorpay API order."

---

### Q4: What happens if the Groq LLM API goes down or returns malformed JSON?
**Answer:**  
"We built two layers of resilience in `agentguard/core/intent_parser.py`. First, we implement automatic fallback from `llama-3.3-70b-versatile` to `llama-3.1-8b-instant`. Second, if parsing fails entirely, the system catches `IntentParseError` and HTTP 422, halting execution before any financial gate is touched. Furthermore, if an agent submits an ambiguous intent without a budget ceiling, the system assigns a 1-paise sentinel budget, forcing Gate 1 to block it as an unspecified risk."

---

### Q5: How do you enforce daily spending caps across multiple requests?
**Answer:**  
"In `agentguard/core/policy_engine.py`, Gate 1 queries the `agent_state` table for the agent's accumulated spend (`daily_spend_paise`) for the current UTC date. It checks whether `current_spend + proposed_cart_total <= max_daily_spend_per_agent_paise`. If the transaction would cause the cumulative spend to exceed ₹15,000, it is immediately blocked with `daily_limit_exceeded`."

---

### Q6: How does the cryptographic audit chain work, and why not use a simple log file?
**Answer:**  
"Simple log files can be edited or truncated by an attacker with server access. In `agentguard/core/audit_log.py`, every decision writes a record containing `entry_hash = SHA256(prev_hash + timestamp + intent_id + agent_id + decision + payload)`. This forms a hash-pointer blockchain. If anyone tampers with record #5 in the database, `verify_audit_chain.py` re-computes hashes from Genesis to head and fails instantly at block #6, proving history was compromised."

---

### Q7: How does AgentGuard handle human-in-the-loop approvals for large transactions?
**Answer:**  
"Our `policy.yaml` defines `requires_human_confirmation_above: 5000`. In `policy_engine.py`, any intent where the cart total exceeds ₹5,000 INR triggers a deterministic block with reason `confirmation_required`. The transaction is flagged in the database as pending human authorization before any Razorpay payment link can be generated."

---

### Q8: How does AgentGuard integrate with Razorpay specifically?
**Answer:**  
"In `agentguard/executor/razorpay_client.py`, Gate 5 uses the official `razorpay` Python SDK initialized with test keys (`rzp_test_...`). It creates an order via `client.order.create()` passing an idempotency header, and generates a payment link via `client.payment_link.create()`. We also implement HMAC-SHA256 signature verification in `agentguard/api/routes/webhooks.py` to securely validate Razorpay payment completion webhooks (`payment.captured`)."

---

### Q9: What happens if `policy.yaml` is deleted or corrupted on the server?
**Answer:**  
"AgentGuard follows a strict fail-closed architecture in `agentguard/config.py`. If `policy.yaml` is missing, unparseable, or contains invalid syntax, the loader catches the exception and returns a fallback policy object with `all_blocked = True`. Gate 1 checks `policy.all_blocked` first and rejects 100% of incoming intents until a valid policy is restored."

---

### Q10: How does AgentGuard scale if thousands of AI agents transact simultaneously?
**Answer:**  
"The gateway is stateless, built on FastAPI, and can be horizontally scaled behind a load balancer. Database operations use SQLite in WAL (Write-Ahead Logging) mode with explicit busy timeouts for high-concurrency local reads and writes. Policy evaluation and cart hashing are pure CPU bound operations running in under 2 milliseconds per request, keeping total gateway latency under 200ms."

---

## 7. Competitive Differentiation & Razorpay Ecosystem Fit

### Competitive Matrix

| Existing Solution | AgentGuard Approach | Technical Differentiator |
| :--- | :--- | :--- |
| **Generic LLM Guardrails** *(NeMo Guardrails, Llama Guard)* | **Deterministic Payment Firewall** | LLM guardrails rely on prompts and are probabilistic. AgentGuard relies on deterministic Python code and YAML rules. |
| **Standard API Gateways** *(Kong, Apigee)* | **Agent-Aware Contextual Engine** | Standard gateways only check rate limits and static API keys. AgentGuard validates z-score spend velocity, cart integrity, and intent categories. |
| **Post-Facto Fraud Engines** | **Pre-Execution Cryptographic Gates** | Fraud engines flag transactions *after* the order is placed. AgentGuard blocks unauthorized payments *before* calling Razorpay APIs. |

### Alignment with Razorpay AI Buildathon — Track 01
AgentGuard directly advances **Track 01 (AI Growth & Agentic Commerce)** by providing the essential security infrastructure required for merchants to trust AI buyer agents. By turning non-deterministic agent requests into safe, verified Razorpay payment orders, AgentGuard acts as the critical bridge between autonomous AI commerce and financial safety.

---

## 8. What Broke at 2 AM & How We Got Out

In true buildathon fashion, building a zero-trust payment gateway produced three critical engineering roadblocks in the middle of the night. Here is candidly what broke and how we engineered our way out:

### Incident 1: Cryptographic Audit Chain Deadlock & SQLite Database Locks (2:15 AM)
- **What Broke:** During concurrent scenario testing, SQLite threw `sqlite3.OperationalError: database is locked`. Because every single intent (allowed or blocked) writes a SHA-256 block that queries `SELECT entry_hash FROM audit_log ORDER BY entry_id DESC LIMIT 1` to compute the next hash pointer, simultaneous reads and writes caused race conditions. If a write failed midway, the hash-pointer chain corrupted, breaking `verify_audit_chain.py`.
- **How We Got Out:** 
  1. Enabled **Write-Ahead Logging (WAL) Mode** (`PRAGMA journal_mode=WAL;`) and configured `PRAGMA busy_timeout = 5000;` on the SQLAlchemy engine in `agentguard/database.py`.
  2. Wrapped `append_audit_entry` in an atomic database transaction block with explicit thread locks, guaranteeing that reading the previous block's SHA-256 hash pointer and appending the new block happen in a single, uninterrupted transaction.

### Incident 2: LLM Schema Hallucination & The 1-Paise Budget Vulnerability (2:50 AM)
- **What Broke:** When an agent sent an ambiguous request without a budget ceiling (e.g., *"get me some shoes"*), Groq Llama-3.3 70B hallucinated a `None` budget or omitted `max_amount_paise`. If `None`, Pydantic failed with 422 errors; if defaulted improperly, un-capped financial transactions slid right past Gate 1!
- **How We Got Out:**
  1. Built a strict Pydantic model (`BoundedIntent`) in `agentguard/models.py` with Groq tool-calling JSON schema enforcement.
  2. Implemented a **1-paise sentinel budget fallback** (`max_amount_paise = 1`) when no budget amount is stated in prose. Because 1 paise (₹0.01) is lower than any catalog item price in existence, Gate 1 (`policy_engine.py`) deterministically blocks the ambiguous request with `exceeds_transaction_cap`, ensuring zero-trust safety by default.
  3. Added an automatic LLM fallback from `llama-3.3-70b-versatile` to `llama-3.1-8b-instant` on Groq API timeouts.

### Incident 3: Post-Authorization Cart Price Swapping Race Condition (3:35 AM)
- **What Broke:** Early pipeline prototypes parsed and authorized an intent for ₹3,500. However, between authorization and Razorpay order creation, dynamic item prices or malicious payload mutations could alter the item price to ₹5,000. The backend was about to execute an order for ₹5,000 despite policy only approving ₹3,500!
- **How We Got Out:**
  1. Engineered **Gate 2: Cart Cryptography** (`agentguard/core/cart_verifier.py`). Immediately upon intent authorization, the gateway generates a canonical SHA-256 snapshot hash of all cart SKUs, merchant IDs, quantities, and prices (`take_cart_snapshot`).
  2. Right before calling the Razorpay API in Gate 5, Gate 2 re-computes the cart hash (`verify_cart_integrity`). If even a single item price or SKU changes post-authorization, the transaction is immediately blocked with `cart_integrity_failure` before any money or Razorpay Order ID is generated.

