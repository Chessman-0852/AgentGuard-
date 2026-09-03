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

**Design note (idempotency):** INSERT-then-catch-IntegrityError is intentional. SELECT-then-INSERT has a TOCTOU race window. The UNIQUE PRIMARY KEY makes the INSERT atomic — only one concurrent thread wins. Documented here as security-critical non-obvious design.

**Design note (anomaly score):** `compute_anomaly_score()` is advisory only. Returns 0.0 if fewer than 5 historical transactions. Appears in the audit log but NEVER contributes to a block decision.

`pytest tests/unit/` → **33 passed, 0 failed, 0 regressions.**

---

### [TEMPLATE — copy for each entry]

**[YYYY-MM-DD HH:MM IST] [TYPE] Short description**

Context:
Decision/Failure/Fix:
Impact:

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
