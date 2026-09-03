# AgentGuard — Build Log

> **IMPORTANT:** This is a required submission artifact. Write entries in real time during the build.
> A build log written after the fact reads as manufactured — judges notice.
> Format: `[YYYY-MM-DD HH:MM IST] [TYPE] Description`
> Types: DECISION · FAILURE · FIX · NOTE · MILESTONE

---

## Day 0 — Documentation & Architecture (2026-09-03)

---

### [2026-09-03 13:00 IST] [MILESTONE] Project analysis and documentation audit complete

Full audit of all three planning documents completed:
- `Master_AgentGuard.md` (73 KB, 1,885 lines)
- `Docs/AgentGuard_Master_Blueprint.md` (34 KB, 264 lines)
- `Docs/gptPlan.md` (41 KB, 1,529 lines — GPT principal-engineer blueprint)

Key finding: two of the three documents made contradictory infrastructure decisions. Blueprint overrides resolved.

---

### [2026-09-03 13:15 IST] [DECISION] D2 — SQLite selected over PostgreSQL

**Context:** The original `Master_AgentGuard.md` specified PostgreSQL + Docker + EC2 + Nginx (§18, §24).

**Decision:** Switch to SQLite (WAL mode) for this build.

**Rationale:** 2 days remain as of this writing. Docker container networking, EC2 security groups, SSL certs, and database credentials are each a place a demo dies the night before recording, for zero marginal judge credit. A judge evaluates the five-gate pipeline and audit verification — not whether Postgres is behind Nginx.

**Trade-off accepted:** SQLite cannot enforce append-only via role-level REVOKE the way PostgreSQL can. Append-only guarantee on `audit_log` and `cart_snapshots` is enforced in application code. Mitigation: the hash-chain verification itself catches any bypass.

**Migration path:** PostgreSQL + Docker Compose explicitly added to post-MVP roadmap. See `project-context/07-future/roadmap.md`.

---

### [2026-09-03 13:20 IST] [DECISION] D3 — Streamlit selected over React

**Context:** The original spec specified React + Vite + SSE live feed (§21).

**Decision:** Streamlit dashboard.

**Rationale:** The source spec's own §32 Open Question 4 already flagged "Streamlit if solo." This is a solo build with 2 days left. React + SSE = a second toolchain (Node, npm, cross-origin config, WebSocket fallback) under time pressure. Streamlit's `st.rerun()` polling against SQLite delivers the same demo-visible effect.

**Trade-off accepted:** Less polished real-time UX. Acceptable because judges evaluate decision logic, not frontend animation smoothness.

---

### [2026-09-03 13:25 IST] [DECISION] D4 — Groq/Llama-3.3-70b-versatile confirmed as LLM provider

**Context:** There was an internal inconsistency:
- `Master_AgentGuard.md` §14 specified Groq/Llama-3.3-70b-versatile ✅ (original correct decision)
- `Master_AgentGuard.md` §9 code sample accidentally used Anthropic SDK syntax ❌ (copy-paste error)
- `Docs/AgentGuard_Master_Blueprint.md` §7.1 recommended Anthropic Claude (override — rejected)

**Decision:** Groq/Llama-3.3-70b-versatile. The Master document's §14 was correct. The §9 code sample inconsistency was a copy-paste error. The Blueprint's Claude recommendation is rejected.

**Rationale:**
- Groq free tier: $0 cost, 30 req/min on 70B model — sufficient for a 50-100 request demo run
- Strong function-calling/tool-use support — adequate for structured BoundedIntent extraction
- No unnecessary paid API dependency

**Model configuration:**
```
Primary:  llama-3.3-70b-versatile  (GROQ_MODEL_INTENT env var)
Explain:  llama-3.1-8b-instant     (GROQ_MODEL_EXPLAIN env var)
Fallback: mixtral-8x7b-32768       (GROQ_MODEL_FALLBACK env var)
```

**Environment:** Use `GROQ_API_KEY`. Do NOT set `ANTHROPIC_API_KEY` — not used.

---

### [2026-09-03 19:00 IST] [MILESTONE] Documentation Phase 0 complete

The following documents created:
- `project-context/01-product/context.md` — product context, personas, competitive positioning
- `project-context/02-architecture/decisions.md` — D1-D7 decision log
- `project-context/02-architecture/architecture.md` — reconciled system architecture
- `project-context/06-progress/tasks.md` — granular build task list
- `project-context/06-progress/build-log.md` — this file
- `plans/` directory — 8 phase plans with full implementation code

Implementation plans cover: Foundation → Gates → Audit → Intent Parser → Razorpay → API → Dashboard → Demo.

---

## Day 1 — Core Pipeline (2026-09-03)

---

### [2026-09-03 20:20 IST] [MILESTONE] Phase 1 — Foundation & Data Models Complete

Completed all foundation components:
- Directory structure & package scaffolding created
- `requirements.txt` and `.gitignore` configured
- `agentguard/constants.py` with status literals and block codes defined
- `agentguard/models.py` with Pydantic domain & gate result models implemented
- `agentguard/config.py` with fail-closed YAML policy loader implemented
- `policy.yaml` created with 7000 INR cap, 3 allowed categories
- `agentguard/database.py` with SQLite WAL mode and SQLAlchemy session factory set up
- `migrations/001_initial_schema.sql` created with 5 SQLite DDL tables
- `synthetic/catalog.json` created with 12 SKUs across 3 categories
- Validation suite executed: fail-closed test PASSED, paise conversion PASSED, canonical hash determinism PASSED, schema creation PASSED.

---

### [2026-09-03 20:28 IST] [FAILURE + FIX] test_at_cap_is_allowed failed on first run

**Error:** `PolicyResult(passed=False, reason='confirmation_required')`

**Root cause:** Test intent used `max_amount_paise=700000` (7000 INR) which is above the `requires_human_confirmation_above_paise=500000` (5000 INR) threshold. Rule 4 (confirmation) correctly fired before the transaction-cap boundary could be verified. The engine was correct; the test was misconfigured.

**Fix:** Isolated the transaction-cap boundary test by setting `requires_human_confirmation_above_paise=0` (disabled) in that specific test case.

---

### [2026-09-03 20:30 IST] [MILESTONE] Phase 2 — Deterministic Policy Gates Complete

All four gate modules implemented and fully tested:
- `agentguard/core/policy_engine.py` — 5 deterministic rules, no LLM calls
- `agentguard/core/cart_verifier.py` — SHA-256 hash snapshot + diff, append-only
- `agentguard/core/risk_checker.py` — advisory anomaly z-score only, NEVER blocks alone
- `agentguard/core/idempotency_guard.py` — INSERT-then-catch-IntegrityError (race-safe)

`pytest tests/unit/` → **33 passed, 0 failed, 0 regressions.**

---

### [2026-09-03 20:35 IST] [MILESTONE] Phase 3 — Cryptographic Audit Log Complete

Implemented append-only hash pointer chain in SQLite (`audit_log.py`) and standalone CLI verification script `scripts/verify_audit_chain.py` requiring zero external dependencies. Verified chain intact across simulated transactions and confirmed tamper detection triggers on single-byte edits.

---

### [2026-09-03 20:45 IST] [MILESTONE] Phase 4 — Groq Intent Parser & Explainer Complete

Configured Groq tool-calling extraction pipeline. Resolved decommissioned model IDs by selecting active models (`qwen/qwen3.6-27b` with `qwen/qwen3.8-27b` fallback, `openai/gpt-oss-20b` for natural language block explainer). Verified 10/10 manual NL inputs and prompt injection handling.

---

### [2026-09-03 20:50 IST] [MILESTONE] Phase 5 — Razorpay Test-Mode Executor Complete

Implemented `razorpay_client.py` enforcing `rzp_test_` key prefixes at startup. Resolved extra field rejections on Razorpay payment link endpoints. Verified live sandbox order creation and HMAC-SHA256 signature verification.

---

### [2026-09-03 21:30 IST] [MILESTONE] Phase 6 — FastAPI Pipeline Orchestration Complete

All 5 gates wired sequentially behind `POST /api/v1/intents` with 100% audit log coverage. Implemented live policy views, per-agent spend limits, and HMAC webhook receivers. All smoke tests and unit regression tests (54/54) passing.

---

### [2026-09-04 00:50 IST] [DECISION] D3 Override — Full React/Vite Frontend Built for Production

**Context:** Prompt instruction and Design Spec `08-design.md` required building the full interactive frontend (Landing Page + Multi-page Control Plane Dashboard) instead of a simple Streamlit MVP.

**Implementation:**
- Scaffolding: React 18, Vite, TypeScript, Tailwind CSS v3, Framer Motion, Lucide Icons, Recharts, React Router v6.
- Status Translation Layer: Created `statusTranslations.ts` to ensure zero internal backend error codes or developer jargon reach any UI element.
- Landing page with 11 sequential sections per §25.
- Control Plane with 7 views: Overview (Golden Demo screen §29), Transactions, Attack Simulator, Audit Chain Ledger, Policies, Agent Governance, and Infrastructure Settings.
- Complete responsive pass and accessible focus states across all interactive components.

Production bundle compiled successfully with zero type errors.

---

### [2026-09-04 01:10 IST] [MILESTONE] Phase 8 — Adversarial Test Suite & Demo Preparation Complete

- Implemented automated adversarial scenario generator `synthetic/scenarios.py` covering all 6 adversarial vectors + legitimate purchase.
- Implemented `/demo/cart-tamper` demo endpoint to demonstrate cryptographic cart tampering detection.
- Authored integration test suite `tests/integration/test_adversarial.py` (9 tests covering H1, A1-A6, 100% audit coverage, and chain integrity).
- Verified: All 9 adversarial integration tests PASSED.
- Verified: All 7 automated scenarios PASSED (100% block rate on threats).
- Verified: `scripts/verify_audit_chain.py` independently validates 31 entries as unbroken.
- Authored complete public-facing `README.md` with system overview, architecture diagram, and verification instructions.

---

## Entry Guidelines

**What MUST be logged:**
- Every design decision made during implementation (even small ones)
- Every failure encountered, with exact error message
- Every fix applied, with the root cause
- Every dependency or API behavior that was surprising
- Time milestones (phase completions, first working smoke test, first adversarial scenario passing)

**What NOT to log:**
- Successes that went exactly as planned
- Routine code that matched the spec

**Why this matters:**
A judge reading a build log with only successes assumes it was fabricated. A build log with real failures, wrong turns, and fixes is a signal of engineering maturity.

---

*This file is a required submission artifact. Keep it open in a text editor throughout the build.*
*First entry written: 2026-09-03 13:00 IST. Decisions D2, D3, D4 documented at start of build.*
