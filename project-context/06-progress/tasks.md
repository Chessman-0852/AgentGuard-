# AgentGuard — Build Tasks

> **Status:** ACTIVE — update this file in real time during the build.
> **Timeline:** Day 1 = Sep 3, 2026 · Day 2 = Sep 4, 2026 · Deadline = Sep 5, 2026
> **Task Status Key:** [ ] not started · [/] in progress · [x] complete · [!] blocked

---

## Phase 0 — Documentation (COMPLETE — before any code)

- [x] Create `project-context/` directory structure (7 categories)
- [x] Write `project-context/01-product/context.md` (product context, personas, goals)
- [x] Write `project-context/02-architecture/decisions.md` (D1-D7 locked, D4=Groq confirmed)
- [x] Write `project-context/02-architecture/architecture.md` (reconciled system design)
- [x] Write `project-context/06-progress/tasks.md` (this file)
- [x] Write `project-context/06-progress/build-log.md` (started)
- [x] Archive `gptPlan.md` -> `project-context/_archive/gptPlan.md`

---

## Day 1 — Core Pipeline

### Hour 1-2.5: Phase 1 — Foundation

- [x] Create project directory structure (matches architecture.md)
- [x] Create Python virtual environment
- [x] Create `requirements.txt` with pinned versions
- [x] Create `agentguard/constants.py` (GENESIS_HASH, status literals, block reason codes)
- [x] Create `agentguard/models.py` (BoundedIntent, Cart, CartItem, all gate result models)
- [x] Create `agentguard/config.py` (PolicyConfig, YAML loader, fail-closed, SIGHUP)
- [x] Create `policy.yaml` (demo configuration — 7000 INR cap, 3 categories)
- [x] Create `agentguard/database.py` (SQLAlchemy engine, WAL mode, init_db())
- [x] Create `migrations/001_initial_schema.sql` (5 tables, SQLite DDL)
- [x] Create `synthetic/catalog.json` (12 SKUs, 3 categories)
- [x] Create `.env.example` (GROQ_API_KEY, Razorpay vars — NO ANTHROPIC_API_KEY)
- [x] Create stub `__init__.py` files for all subpackages
- [x] Run Phase 1 acceptance criteria checks (see plans/phase-1-foundation.md)

**Gate:** Phase 1 complete when `from agentguard.models import BoundedIntent` imports without error AND `init_db()` creates all 5 tables.

### Hour 2.5-5.5: Phase 2 — Deterministic Gates

- [x] Create `agentguard/core/policy_engine.py` (check_policy — 5 rules)
- [x] Create `agentguard/core/cart_verifier.py` (take_cart_snapshot, verify_cart_integrity)
- [x] Create `agentguard/core/risk_checker.py` (check_risk, compute_anomaly_score)
- [x] Create `agentguard/core/idempotency_guard.py` (check_and_reserve, mark_executed, mark_failed)
- [x] Create `tests/unit/test_policy_engine.py` (10 test cases — boundary values)
- [x] Create `tests/unit/test_cart_verifier.py` (6 test cases — hash determinism, tamper, DB)
- [x] Create `tests/unit/test_risk_checker.py` (3 test cases)
- [x] Create `tests/unit/test_idempotency_guard.py` (5 test cases — race condition, retry, cross-agent)
- [x] Run: `pytest tests/unit/ -v` — 33/33 PASSED

**Gate:** `pytest tests/unit/ -v` exits with code 0. No skipped tests.

### Hour 5.5-7.5: Phase 3 — Hash-Chained Audit Log

- [x] Create `agentguard/core/audit_log.py` (append_audit_entry, verify_chain, get_audit_entries)
- [x] Create `scripts/verify_audit_chain.py` (standalone, stdlib only — no fastapi/groq/razorpay imports)
- [x] Create `tests/unit/test_audit_log.py` (6 test cases — chain integrity, tamper detection)
- [x] Verify: no forbidden imports in `scripts/verify_audit_chain.py`

**Gate:** `pytest tests/unit/test_audit_log.py -v` exits code 0; `scripts/verify_audit_chain.py` exits code 0 on empty DB.chain, verify passes; tamper entry 5, verify fails at index 5

**Gate:** Tamper detection test passes before moving to Phase 4.

### Hour 7.5-9.5: Phase 4 — Groq Intent Parser

- [ ] Create `agentguard/core/intent_parser.py` (parse_intent, explain_block, fallback model)
- [ ] Create `tests/unit/test_intent_parser.py` (7 mock-based test cases — no real API calls)
- [ ] Run: `pytest tests/unit/test_intent_parser.py -v` — ALL must pass
- [ ] Manual: test 10 NL inputs against real Groq API (document results in BUILD_LOG)
- [ ] Verify: `parse_intent("buy running shoes, budget 7000", "agent-001")` -> category="footwear", max_amount_paise=700000

**Gate:** 10/10 manual NL inputs return schema-valid BoundedIntent. Document any failures in BUILD_LOG.

### Hour 9.5-11.5: Phase 5 — Razorpay Integration

- [ ] Create `agentguard/executor/razorpay_client.py` (create_order, create_payment_link, webhook handlers)
- [ ] Create `tests/unit/test_razorpay_client.py` (5 test cases — HMAC validation, production key guard)
- [ ] Run: `pytest tests/unit/test_razorpay_client.py -v` — ALL must pass
- [ ] Manual: `create_order()` with test credentials returns order_id starting with "order_"
- [ ] Manual: `create_payment_link()` returns short_url starting with "https://rzp.io/"
- [ ] Verify: startup assertion rejects rzp_live_ keys with RuntimeError

**Gate:** Manual Razorpay order creation succeeds in test-mode before Day 1 ends.

---

## Day 2 — API, Dashboard, Demo

### Hour 1-3.5: Phase 6 — FastAPI Pipeline Orchestrator

- [ ] Create `agentguard/api/main.py` (FastAPI app, lifespan, CORS, router registration)
- [ ] Create `agentguard/api/routes/intents.py` (POST /intents pipeline orchestrator, all 7 endpoints)
- [ ] Create `agentguard/api/routes/audit.py` (GET /audit, POST /audit/verify)
- [ ] Create `agentguard/api/routes/webhooks.py` (POST /webhooks/razorpay with HMAC validation)
- [ ] Run: `uvicorn agentguard.api.main:app --port 8000` starts without error
- [ ] Smoke test: happy path returns status="allowed" with payment_link_url
- [ ] Smoke test: over-cap returns status="blocked", block_reason="exceeds_transaction_cap"
- [ ] Smoke test: POST /api/v1/audit/verify returns intact=true after 2 requests
- [ ] Smoke test: webhook without valid signature returns HTTP 400

**Gate:** All 4 smoke tests pass before moving to Phase 7.

### Hour 3.5-6: Phase 7 — Streamlit Dashboard

- [ ] Create `dashboard/app.py` (5 sections: summary cards, live feed, block chart, spend tracker, audit + verify)
- [ ] Run: `streamlit run dashboard/app.py --server.port 8501` starts without error
- [ ] Dashboard: summary cards show correct counts after 5 test scenarios
- [ ] Dashboard: "Verify Chain" button returns green success on clean chain
- [ ] Dashboard: auto-refresh updates feed every ~3 seconds (observe for 15 seconds)

**Gate:** Verify Chain button works before moving to Phase 8.

### Hour 6-9.5: Phase 8 — Adversarial Test Suite + Demo Prep

- [ ] Create `synthetic/scenarios.py` (7-scenario automated runner)
- [ ] Create `tests/integration/test_adversarial.py` (8 test cases)
- [ ] Run: `python synthetic/scenarios.py` — exits with code 0 (all 7 scenarios pass)
- [ ] Run: `pytest tests/integration/test_adversarial.py -v` — all 8 tests pass
- [ ] A1: over-cap blocked at 100% (test 3 different amounts: 7001, 8000, 9999)
- [ ] A2: cart tamper blocked — /api/v1/demo/cart-tamper returns integrity_check_passed=false
- [ ] A3: replay blocked — second identical request returns replay_detected
- [ ] A4: category violation blocked — "luxury watch" returns category_not_allowed
- [ ] A5: ambiguous intent blocked — no-amount request blocked by policy
- [ ] A6: cross-agent identity blocked — verified in idempotency guard
- [ ] Audit chain intact after full scenario run
- [ ] Tamper test: modify entry 5, run verify, confirm "BROKEN at entry index 5"
- [ ] Run: `python scripts/verify_audit_chain.py --db agentguard.db` returns exit code 0

### Hour 9.5-11: Demo Rehearsals + Submission Artifacts

- [ ] Demo rehearsed 3 times, timing <= 5 minutes
- [ ] Verify Chain step rehearsed with a batch containing at least one blocked entry
- [ ] Pre-recording checklist (plans/phase-8-demo.md) — ALL items green
- [ ] Create `README.md` (setup instructions, architecture description, 6 scenario list)
- [ ] Finalize `BUILD_LOG.md` (all real failures documented, D2/D3/D4 decisions in log)
- [ ] Record 5-minute demo video
- [ ] Complete submission form

---

## Submission Checklist

### Repository
- [ ] Public GitHub repo
- [ ] README.md with setup + run instructions + architecture
- [ ] policy.yaml committed
- [ ] .env.example committed (real .env excluded by .gitignore)
- [ ] scripts/verify_audit_chain.py present and independently runnable
- [ ] BUILD_LOG.md with real failures + D2/D3/D4 documented

### Testing
- [ ] All 6 adversarial scenarios: 100% block rate
- [ ] Legitimate purchases: >= 95% allow rate
- [ ] Audit chain: intact after full scenario run
- [ ] Tamper detection: catches corruption at correct index

### Demo Video
- [ ] 5 minutes or under
- [ ] Leads with blocked scenarios, not happy path
- [ ] Audit chain verification shown on camera
- [ ] One-sentence differentiation stated in closing

### Submission
- [ ] Video link included
- [ ] GitHub repo link included
- [ ] Submitted before September 5, 2026 deadline

---

*This file is the authoritative live view of build progress. Mark items [x] as they are completed.*
*Replaces: Master_AgentGuard.md Appendix A (13-day plan — obsolete) and Blueprint §9 (2-day plan — prose format).*
