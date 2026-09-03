# AgentGuard

**Deterministic Authorization Gateway & Payment Firewall for AI Agents**

> *"The LLM can propose what to buy, but only deterministic policy and verification code can authorize money to move."*

AgentGuard is a zero-trust policy and cryptographic verification gateway that sits between autonomous AI buyer agents and payment gateways (Razorpay test-mode). It provides an answer to the core security challenge in agentic commerce: *"How do you stop an autonomous AI agent from doing something unauthorized, while still allowing it to transact freely within safe boundaries?"*

---

## The Core Thesis

**The LLM explains. The policy engine decides.**

- **AI/LLMs are used for:** Unstructured natural language intent understanding, category mapping, budget ceiling extraction, and generating user-friendly explanations when transactions are blocked.
- **AI/LLMs are NEVER used for:** Authorization decisions, financial risk judgments, rate-limiting, or cryptographic identity validation. All security gates are pure, deterministic code.

---

## Five Deterministic Security Gates

Every purchase request must pass five sequential checkpoints before any payment order can be executed:

```
AI AGENT ("Buy running shoes, budget ₹3,500")
   │
   ▼
[Intent Parser — Groq tool-calling extraction]
   │
   ▼
[Gate 1: Policy Engine] ───► Evaluates hard max transaction cap, daily quota & allowed categories
   │ (PASS)
   ▼
[Gate 2: Cart Cryptography] ──► SHA-256 canonical snapshot verification; catches post-auth tampering
   │ (PASS)
   ▼
[Gate 3: Risk Assessment] ──► Statistical rolling z-score anomaly profiling (advisory)
   │ (PASS)
   ▼
[Gate 4: Replay Guard] ───► Atomic 15-minute time-bucketed idempotency reservation
   │ (PASS)
   ▼
[Gate 5: Action Executor] ──► Razorpay test-mode order generation & secure payment link creation
   │
   ▼
[Audit Chain Proof] ──► Append-only SHA-256 hash pointer block recorded to immutable ledger
```

---

## Adversarial Attacks Stopped in Real Time

AgentGuard is verified against 6 common commerce attack vectors:

| Attack Vector | Simulated Scenario | Outcome | Deterministic Block Reason |
|---|---|---|---|
| **A1: Spending Cap Breach** | AI requests items at ₹9,999 (cap: ₹7,000) | ✕ BLOCKED | `exceeds_transaction_cap` |
| **A2: Cart Tampering** | Cart price altered from ₹3,500 to ₹5,000 post-auth | ✕ BLOCKED | `cart_integrity_failure` |
| **A3: Idempotency Replay** | Identical intent resubmitted within active bucket | ✕ BLOCKED | `replay_detected` |
| **A4: Category Violation** | Intent requests item in unauthorized category | ✕ BLOCKED | `category_not_allowed` |
| **A5: Ambiguous Intent** | Intent without budget ceiling (sentinel 1 paise) | ✕ BLOCKED | `exceeds_transaction_cap` |
| **A6: Approval Bypass** | Order exceeds human verification threshold (₹5,000) | ✕ BLOCKED | `confirmation_required` |
| **H1: Legitimate Intent** | Authorized footwear purchase under ₹5,000 | ✓ APPROVED | Razorpay Order & Payment Link issued |

---

## Independent Audit Chain Verification

Any stakeholder or auditor can mathematically verify the complete transaction history without external dependencies using only Python's standard library:

```bash
python scripts/verify_audit_chain.py --db agentguard.db
```

Output:
```
Verifying audit chain in: agentguard.db
------------------------------------------------------------
[PASS] Chain intact — 31 entries verified
```

Altering even a single byte anywhere in history breaks the SHA-256 hash pointers across all subsequent blocks immediately.

---

## Project Structure

```
AgentGuard/
├── agentguard/                  # Core Python package
│   ├── api/                     # FastAPI app, routers (intents, audit, webhooks)
│   ├── core/                    # Security gates (policy, cart, risk, idempotency, intent)
│   ├── executor/                # Razorpay test-mode client & HMAC webhook validator
│   ├── config.py                # Fail-closed YAML policy loader
│   ├── database.py              # SQLite connection (WAL mode)
│   └── models.py                # Core Pydantic domain models
├── frontend/                    # Complete React + Vite + Tailwind frontend
│   ├── src/lib/                 # Status translation layer (zero dev jargon) & API client
│   ├── src/components/          # 14 UI components (SecurityPipeline, StatusBadge, etc.)
│   ├── src/layouts/             # AppShell (sidebar + topbar navigation)
│   └── src/pages/               # LandingPage + 7 Dashboard Views
├── scripts/                     # Standalone verify_audit_chain.py
├── synthetic/                   # Scenarios runner & 12-item catalog
├── tests/                       # Unit and integration test suites
├── policy.yaml                  # Configurable merchant spending rules
└── requirements.txt             # Python dependencies
```

---

## Quickstart & Installation

### 1. Environment Setup

```bash
git clone https://github.com/Chessman-0852/AgentGuard-.git
cd AgentGuard-
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # Linux / macOS

pip install -r requirements.txt
cp .env.example .env
```

Ensure `.env` contains your test keys:
- `GROQ_API_KEY`: Groq Cloud API key
- `RAZORPAY_KEY_ID`: `rzp_test_...` (Production keys are rejected at startup)
- `RAZORPAY_KEY_SECRET`: Razorpay test secret

### 2. Run the Gateway Server

```bash
uvicorn agentguard.api.main:app --reload --port 8000
```

### 3. Run the Frontend Dashboard & Landing Page

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Run the Adversarial Scenario Runner

In another terminal:
```bash
python synthetic/scenarios.py
```

### 5. Run Automated Tests

```bash
# Run unit tests (54 deterministic tests, 0 external API calls)
pytest tests/unit/ -v

# Run adversarial integration tests (against live server)
pytest tests/integration/test_adversarial.py -v
```

---

## Built For

Razorpay AI Buildathon 2026 — Track 01: AI Growth & Agentic Commerce.
