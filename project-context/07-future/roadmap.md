# AgentGuard — Post-MVP Roadmap

> **Source:** `Master_AgentGuard.md` §30 + `Docs/AgentGuard_Master_Blueprint.md` §13 (reordered)
> **Last updated:** 2026-09-03
> **Status:** Post-hackathon. Do not attempt any item below before the September 5 deadline.

---

## Phase 1 — Current MVP (Hackathon Submission)

Everything in `tasks.md`. See that document for the current build plan.

**Scope:** Single Python process, SQLite, Streamlit, Groq/Llama, Razorpay test-mode, 6 adversarial scenarios.

---

## Phase 2 — Protocol Adapters + Infrastructure Migration

*Target: First weeks post-hackathon*

### 2a — AP2 Mandate as Accepted Input Format

Accept an AP2 Intent/Cart Mandate JWT as an alternative input to the intent parser. The BoundedIntent schema already sits at the right level of abstraction to accept a parsed AP2 mandate — this is an adapter, not a redesign.

Implementation sketch:
```
POST /api/v2/intents
Content-Type: application/ap2-mandate+jwt

[signed AP2 Cart Mandate]
  |
  v
AP2MandateAdapter.parse(mandate) -> BoundedIntent
  |
  v
[Same five-gate pipeline — unchanged]
```

This directly addresses the most likely post-submission judge question and demonstrates AgentGuard's protocol-agnostic positioning.

### 2b — Infrastructure Migration (D2/D3 trade-offs resolved)

| Component | Current (MVP) | Phase 2 Target |
|---|---|---|
| Database | SQLite (WAL mode, app-enforced append-only) | PostgreSQL with role-level REVOKE UPDATE/DELETE on audit_log and cart_snapshots |
| Dashboard | Streamlit (st.rerun() polling) | React + Vite + SSE/WebSocket live feed |
| Deployment | Local uvicorn | Docker Compose + EC2 + Nginx + GitHub Actions |

These migrations restore the D2/D3 trade-offs explicitly accepted during the hackathon build. The functionality is identical — only the infrastructure changes.

### 2c — ACP Adapter

Accept ACP-format checkout session payloads as an input format. ACP's spec is production-stable (Apache-2.0, joint OpenAI/Stripe/Meta governance, live on Etsy/Shopify since Sep 2025).

---

## Phase 3 — Cryptographic Audit Hardening

| Feature | Description |
|---|---|
| ECDSA-signed audit entries | Each audit entry gets an ECDSA signature in addition to the SHA-256 hash-chain — adds authorship non-repudiation (who signed, not just that the content is unchanged) |
| External notarization | Periodic merkle root submission to a timestamping authority |
| Multi-party audit log | Separate write path for merchant-controlled log vs. AgentGuard-controlled log |

---

## Phase 4 — Agent Credential Registry

| Feature | Description |
|---|---|
| Agent credential store | JWT-based agent identity with scoped permissions |
| Cross-agent delegation | Agent A can delegate a bounded subset of its permissions to Agent B |
| UAP integration | When UAP publishes a public spec and SDK, add a UAP-compatible trust registry adapter |

---

## Phase 5 — Advisory ML Layer

| Feature | Description |
|---|---|
| Transaction anomaly model | Trained on real transaction history; z-score-based flagging |
| Advisory only — never blocks | The ML score appears in the audit log and dashboard but cannot block a request |
| Integration with Risk Check | risk_result.anomaly_score already exists in the data model — plug in here |

**Non-negotiable constraint:** The ML layer is ALWAYS advisory. It NEVER has veto power over a purchase. This is not a compromise — it is P1 ("LLM explains, code decides") applied to ML as well.

---

## Phase 6 — Multi-Tenant SaaS

| Feature | Description |
|---|---|
| Merchant isolation | Per-merchant policy.yaml stored in DB; not on the filesystem |
| Multi-tenant DB schema | Tenant ID on every table; row-level security |
| Merchant dashboard | Each merchant sees only their own agents and audit log |
| Policy API | Merchants can update their policy via API, not only by editing a file |

---

## What Post-MVP Explicitly Does NOT Include

- LLM on the decision path — ever
- Circumventing the deterministic policy engine
- "AI decides the risk score" — risk scoring remains rules-based or advisory-ML

---

*Extracted from: `Master_AgentGuard.md` §30 · `Docs/AgentGuard_Master_Blueprint.md` §13 (AP2 adapter elevated to Phase 2).*
*Supersedes: §30 of Master_AgentGuard.md.*
