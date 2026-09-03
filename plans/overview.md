# AgentGuard — Implementation Plans Overview

> **Stack:** Python 3.12 · FastAPI · SQLite (WAL) · Groq/Llama-3.3-70b-versatile · Streamlit · Razorpay test-mode
> **Deadline:** September 5, 2026 | **Effective build time:** ~36 hours across 2 days

---

## Phase Breakdown Rationale

The eight phases are ordered so that **no phase requires a component that has not been built and tested in a prior phase.** Each phase ends with a system that is independently runnable and verifiable. There are no big-bang integration moments.

Risk sequencing: the riskiest components (Groq LLM call, Razorpay API) are introduced only after all deterministic logic is unit-tested and stable. A Groq rate-limit or Razorpay API error never blocks testing of the policy gates.

---

## Dependency Graph

```
Phase 1 (Foundation)
    |
    +------------------+
    v                  v
Phase 2 (Gates)   Phase 3 (Audit)
    |                  |
    +--------+---------+
             v
         Phase 4 (Intent Parser)
             |
             v
         Phase 5 (Razorpay)
             |
             v
         Phase 6 (API / Orchestrator)
             |
             +------------------+
             v                  v
        Phase 7 (UI)     Phase 8 (Tests+Demo)
```

Phase 2 (Gates) and Phase 3 (Audit) are parallel — neither depends on the other. Both depend only on Phase 1.

---

## Phase Summary Table

| Phase | Name | Day | Est. Hours | Depends On | Key Deliverable |
|---|---|---|---|---|---|
| 1 | Foundation & Data Models | 1 | 2.5h | — | Project skeleton, SQLite schema, BoundedIntent model, policy loader |
| 2 | Deterministic Policy Gates | 1 | 3h | 1 | Policy engine, cart verifier, risk checker, idempotency guard — all unit-tested |
| 3 | Hash-Chained Audit Log | 1 | 2h | 1 | Append-only audit module + verify_audit_chain.py |
| 4 | Groq Intent Parser | 1 | 2h | 1,2,3 | Groq/Llama-3.3-70b function-calling, Pydantic validation, idempotency key generation |
| 5 | Razorpay Action Executor | 1 | 2h | 4 | Razorpay Orders + Payment Links + webhook handler |
| 6 | FastAPI Pipeline Orchestrator | 2 | 2.5h | 2,3,4,5 | All gates wired into sequential pipeline, all 7 REST endpoints live |
| 7 | Streamlit Dashboard | 2 | 2.5h | 6 | Live feed, block-reason chart, spend tracker, Verify Chain button |
| 8 | Adversarial Test Suite & Demo | 2 | 3.5h | all | 6 scenarios at 100% block rate, rehearsed demo, README, BUILD_LOG |

**Total estimated implementation time:** ~20 focused hours.

---

## Implementation Order

### Day 1 (Phases 1-5)

| Time | Phase | Task |
|---|---|---|
| 09:00-11:30 | Phase 1 | Project scaffold, models, SQLite, policy loader |
| 11:30-14:30 | Phase 2 | All four deterministic gates + unit tests |
| 14:30-16:30 | Phase 3 | Audit log + verify script + tamper test |
| 16:30-18:30 | Phase 4 | Groq integration + 10 NL parse tests |
| 18:30-20:30 | Phase 5 | Razorpay Orders + Payment Links + webhook |

### Day 2 (Phases 6-8 + recording)

| Time | Phase | Task |
|---|---|---|
| 09:00-11:30 | Phase 6 | FastAPI orchestrator + routes + smoke test |
| 11:30-14:00 | Phase 7 | Streamlit dashboard |
| 14:00-17:30 | Phase 8 | Full adversarial suite + scenario generator + rehearsals |
| 17:30-20:00 | — | Record demo, write README + BUILD_LOG, final submission |

---

## Progress Tracking

Mark each phase with:
- [ ] Not started
- [/] In progress
- [x] Complete — all acceptance criteria met

**Cut scope priority if time slips:** Cut Phase 7 (dashboard polish) first. Never cut Phase 2 (gates), Phase 3 (audit), or Phase 8 (adversarial tests). Those three are the submission differentiators.

---

## File Index

```
plans/
+-- overview.md                    <- This file
+-- phase-1-foundation.md          <- Project scaffold, models, DB, policy loader
+-- phase-2-gates.md               <- Policy engine, cart verifier, risk, idempotency
+-- phase-3-audit.md               <- Hash-chained audit log + verify script
+-- phase-4-intent-parser.md       <- Groq/Llama integration + structured output
+-- phase-5-razorpay.md            <- Orders, Payment Links, webhook handler
+-- phase-6-api.md                 <- FastAPI orchestrator + all REST routes
+-- phase-7-dashboard.md           <- Streamlit UI
+-- phase-8-demo.md                <- Adversarial tests + scenario runner + demo prep
```

---

## Overall Deliverables Checklist

### Code
- [ ] agentguard/ Python package
- [ ] dashboard/app.py Streamlit app
- [ ] scripts/verify_audit_chain.py (independently runnable)
- [ ] synthetic/scenarios.py (scenario generator)
- [ ] tests/unit/ and tests/integration/

### Config & Data
- [ ] policy.yaml committed to repo
- [ ] .env.example committed to repo
- [ ] synthetic/catalog.json (12 SKUs, 3 categories)
- [ ] SQLite migration scripts in migrations/

### Documentation
- [ ] README.md with setup instructions + architecture diagram
- [ ] BUILD_LOG.md with real failures + D1-D7 decisions

### Demo
- [ ] 5-minute video following demo-script.md
- [ ] All 6 adversarial scenarios passing at 100% block rate before recording

---

## Architectural Constraints (Non-Negotiable Across All Phases)

| Constraint | Rule |
|---|---|
| LLM on decision path | NEVER. LLM used only for NL->BoundedIntent parsing and cosmetic block explanations. |
| Fail-closed | Any ambiguous state (missing policy.yaml, missing snapshot, unknown agent) -> BLOCK. |
| All amounts in paise | Every monetary value stored and compared as integer paise. Never float rupees. |
| Audit log | Append-only. No UPDATE or DELETE in application code on audit_log table. |
| Cart snapshots | Append-only. No UPDATE or DELETE on cart_snapshots table. |
| Idempotency race | INSERT-then-check, not check-then-INSERT. Unique DB constraint on key column. |
| Webhook trust | Never trust a webhook without first validating HMAC-SHA256 signature on raw body. |
| Test-mode only | All Razorpay calls use test-mode keys exclusively. |
