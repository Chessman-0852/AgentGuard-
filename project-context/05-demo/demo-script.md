# AgentGuard — Demo Script

> **Source:** `Master_AgentGuard.md` §28 + `Docs/AgentGuard_Master_Blueprint.md` §6 (extended to 6 scenarios)
> **Last updated:** 2026-09-03
> **Target duration:** ≤ 5 minutes

---

## Pre-Recording Checklist

Complete ALL items before starting the recording. Do not record until every box is checked.

```
ENVIRONMENT
[ ] Fresh agentguard.db (delete old one)
[ ] uvicorn running on port 8000, no errors in terminal
[ ] GET /health returns {"status":"ok"}
[ ] streamlit running on port 8501, dashboard loads
[ ] Both terminals visible on screen

VALIDATION
[ ] python synthetic/scenarios.py -- ALL 7 PASS
[ ] pytest tests/integration/test_adversarial.py -v -- ALL 8 PASS
[ ] GET /api/v1/audit shows >= 7 entries
[ ] python scripts/verify_audit_chain.py -- "Chain intact"
[ ] Dashboard "Verify Chain" button shows green

REHEARSAL
[ ] Full demo rehearsed at least 3 times
[ ] Timing within 5 minutes
[ ] Audit verification step rehearsed with blocked entries in the log
[ ] Differentiation sentence memorized (see Beat 6 below)
```

---

## The 5-Minute Demo Script

### Beat 0 — Open (0:00-0:30)

**What to show:** Terminal / README / architecture diagram

**What to say:**
> "Everyone is building an AI that can buy things. We built the layer that stops it from buying the wrong thing.
>
> AgentGuard is a deterministic policy and verification gateway. The LLM extracts purchase intent from natural language. But the LLM never decides whether to allow or block a payment. That decision belongs entirely to deterministic, auditable code.
>
> Let's see what that looks like in practice — starting with the requests that get blocked."

---

### Beat 1 — H1: Happy Path (0:30-1:30)

**Command:**
```bash
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes, budget 7000"}' \
  | python -m json.tool
```

**What to show:** Response with `status="allowed"` and `payment_link_url`

**What to say:**
> "A legitimate request: 7,000 rupees for running shoes. The Groq/Llama-3.3-70b model parses it into a typed BoundedIntent. Then five deterministic gates check it: transaction cap, category allow-list, cart integrity, velocity, and idempotency. All five pass. Razorpay order created — here's the payment link. And the entire decision — all gate results, the Razorpay order ID, everything — written to the audit log in one append-only entry."

---

### Beat 2 — A1: Over-Cap (1:30-2:15)

**Command:**
```bash
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes for 9999"}' \
  | python -m json.tool
```

**What to show:** Response with `status="blocked"`, `block_reason="exceeds_transaction_cap"`, and the LLM-generated `block_explanation`

**What to say:**
> "Same product. 9,999 rupees. The policy engine sees 9,999 exceeds the 7,000 limit — blocked. Razorpay is never called. The LLM explains the block in plain English after the fact — cosmetically. It did not make this decision."

---

### Beat 3 — A2: Cart Tamper (2:15-3:00)

**Command:**
```bash
curl -s -X POST http://localhost:8000/api/v1/demo/cart-tamper | python -m json.tool
```

**What to show:** Response with `integrity_check_passed=false`, `changed_fields`, authorized vs. tampered prices

**What to say:**
> "Cart tampering: the merchant's system authorized shoes at 3,500 rupees. Between authorization and execution, the price changed to 5,000. The cart integrity gate takes a SHA-256 snapshot at authorization time. At execution, the hash doesn't match — blocked. Changed fields: price. The agent literally cannot pay more than was authorized, even if the merchant tries to charge more."

---

### Beat 4 — A3: Replay Attack (3:00-3:30)

**Command:**
```bash
# Re-run the exact same request as Beat 1 (same agent, same input, same 15-min bucket)
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy running shoes, budget 7000"}' \
  | python -m json.tool
```

**What to show:** Response with `status="blocked"`, `block_reason="replay_detected"`

**What to say:**
> "Same request, same agent — but this authorization was already executed. The idempotency guard sees the key in the database with status executed — replay blocked. The guard uses an INSERT-then-catch-IntegrityError pattern, so it's race-safe even under concurrent requests."

---

### Beat 5 — A4: Category Violation (3:30-4:00)

**Command:**
```bash
curl -s -X POST http://localhost:8000/api/v1/intents \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"AgentBot-001","raw_input":"buy a luxury watch for 5000"}' \
  | python -m json.tool
```

**What to show:** Response with `status="blocked"`, `block_reason="category_not_allowed"`

**What to say:**
> "Category violation — watches aren't on the allow-list. Policy engine blocks before any Razorpay call. The merchant configures this in policy.yaml — no code, no deployment, hot-reloadable."

---

### Beat 6 — Audit Chain Verification (4:00-4:30)

**Command:**
```bash
python scripts/verify_audit_chain.py --db agentguard.db
```

**What to show:** Output: `[PASS] Chain intact — N entries verified`

**Then:** Click "Verify Chain" button in the Streamlit dashboard

**What to say:**
> "Every decision — allowed and blocked — produced exactly one audit entry. Here's the chain verification. Any third party with database read access can run this script. No AgentGuard dashboard required, no API key, just Python standard library.
>
> This is the key differentiator: [SAY VERBATIM] AgentPay-style systems prove a token was signed correctly. AgentGuard proves — to anyone, independently, after the fact — that the system's entire decision history is internally consistent and was applied the same way every time, including on the requests it blocked."

---

### Beat 7 — Close (4:30-5:00)

**What to show:** Streamlit dashboard summary cards

**What to say:**
> "All four major agentic commerce protocols — ACP, AP2, x402, UAP — explicitly disclaim fraud modeling and policy enforcement. That gap is real. AgentGuard is the reference implementation of what sits in that gap: config-driven, independently auditable, protocol-agnostic. The merchant edits a YAML file. Every decision is deterministic. And the proof of correctness is a 10-line script anyone can run."

---

## Fallback Procedures

| Problem | Fallback |
|---|---|
| Groq rate-limited during recording | Pause 60 seconds; free tier resets per minute. Use `--delay 2` in scenario runner. |
| Razorpay webhook not arriving | Show the payment link URL as proof of execution. Say "webhook processing is async — the link is live." |
| Streamlit "Verify Chain" hangs | Run `python scripts/verify_audit_chain.py` in terminal instead — same output. |
| Server crashes mid-demo | Restart with `uvicorn agentguard.api.main:app --port 8000`. SQLite state is preserved. |

---

*Extracted from: `Master_AgentGuard.md` §28 (3 scenarios) + `Docs/AgentGuard_Master_Blueprint.md` §6 (extended to 6 scenarios).*
*Differentiation sentence (Beat 6) from: `Docs/AgentGuard_Master_Blueprint.md` §4.3.*
