# AgentGuard — Setup & Run Instructions

> **Audience:** Anyone setting up AgentGuard for the first time — judges, contributors.
> **Last updated:** 2026-09-03
> **Time to first working server:** ~10 minutes

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.12+ | Use `python --version` to check |
| pip | latest | `pip install --upgrade pip` |
| Git | any | For cloning |
| Groq API key | free | Sign up at console.groq.com — free tier, no credit card |
| Razorpay test credentials | free | Sign up at dashboard.razorpay.com — test-mode, no real money |

---

## 1. Clone and Set Up

```bash
git clone https://github.com/your-username/agentguard
cd agentguard

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux / Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 2. Configure Environment Variables

```bash
# Copy the template
cp .env.example .env
```

Open `.env` and fill in the following values:

```bash
# Required: Groq API (free at console.groq.com)
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL_INTENT=llama-3.3-70b-versatile
GROQ_MODEL_EXPLAIN=llama-3.1-8b-instant
GROQ_MODEL_FALLBACK=mixtral-8x7b-32768

# Required: Razorpay test-mode (dashboard.razorpay.com -> Settings -> API Keys -> Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_test_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Database (SQLite — path relative to project root)
DATABASE_URL=sqlite:///./agentguard.db

# Optional: override log level
LOG_LEVEL=INFO
```

> **NEVER commit your real .env file.** The `.gitignore` already excludes it.
> `RAZORPAY_KEY_ID` **must** start with `rzp_test_` — the server rejects live keys at startup.

---

## 3. Initialize the Database

```bash
python -c "from agentguard.database import init_db; init_db()"
```

Expected output:
```
INFO — Database initialized: 5 tables created (intents, agent_state, cart_snapshots, idempotency_keys, audit_log)
```

---

## 4. Start the API Server

```bash
uvicorn agentguard.api.main:app --reload --port 8000
```

Expected output:
```
INFO — AgentGuard starting up
INFO — Database initialized (already exists — skipping DDL)
INFO — Policy loaded: max_transaction_amount=700000p, categories=['footwear', 'groceries', 'electronics-accessories']
INFO — Application startup complete.
INFO — Uvicorn running on http://127.0.0.1:8000
```

Verify the server is live:
```bash
curl http://localhost:8000/health
# {"status":"ok","service":"agentguard"}
```

---

## 5. Start the Dashboard

In a **separate terminal** (with venv activated):

```bash
streamlit run dashboard/app.py --server.port 8501
```

Open `http://localhost:8501` in your browser. The dashboard reads SQLite directly — it does not make API calls.

---

## 6. Run Your First Request

```bash
# Happy path — should be ALLOWED
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes, budget 7000"}' | python -m json.tool
```

Expected:
```json
{
  "intent_id": "...",
  "status": "allowed",
  "payment_link_url": "https://rzp.io/l/...",
  "razorpay_order_id": "order_..."
}
```

```bash
# Over-cap — should be BLOCKED
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes for 9999"}' | python -m json.tool
```

Expected:
```json
{
  "intent_id": "...",
  "status": "blocked",
  "block_reason": "exceeds_transaction_cap",
  "block_explanation": "..."
}
```

---

## 7. Run the Full Demo Scenario Suite

```bash
python synthetic/scenarios.py --delay 2
```

This sends all 7 scenarios (1 happy path + 6 adversarial) to the running API. Expected: all scenarios report PASS.

---

## 8. Verify the Audit Chain

```bash
# After running some scenarios:
python scripts/verify_audit_chain.py --db agentguard.db
```

Expected:
```
Verifying audit chain in: agentguard.db
------------------------------------------------------------
[PASS] Chain intact — N entries verified
```

---

## 9. Run the Test Suite

```bash
# Unit tests (no API key needed — uses mocks)
pytest tests/unit/ -v

# Integration tests (requires running server + API keys)
pytest tests/integration/ -v
```

---

## 10. Hot-Reload the Policy (without restarting)

Edit `policy.yaml` to change any value (e.g., lower the transaction cap), then send a SIGHUP:

```bash
# Linux/Mac
kill -HUP $(pgrep -f "uvicorn agentguard")

# Windows: the server watches policy.yaml when --reload is active
# Or: restart uvicorn — takes < 2 seconds
```

The next request will use the new policy values. No code changes, no redeploy.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `GROQ_API_KEY not set` | Ensure `.env` file exists and `python-dotenv` is in requirements.txt |
| `RAZORPAY_KEY_ID must start with rzp_test_` | You accidentally set a live key. Use test credentials. |
| `No catalog items found for category` | The intent parsed a category not in `synthetic/catalog.json` — check LLM output |
| `Chain broken at entry N` | The audit log has been tampered with. Do not modify the SQLite DB directly. |
| Dashboard shows no data | Ensure both `DATABASE_URL` in `.env` points to the same `agentguard.db` path for both processes |
| Streamlit `ModuleNotFoundError` | Ensure venv is activated for the Streamlit terminal too |

---

*Written from scratch (no existing instructions document existed). Update this file when setup steps change.*
