# AgentGuard — Project Context

> **Last updated:** 2026-09-03 | **Status:** Active build — T-minus ~48 hours
> **Authoritative since:** This file supersedes the executive summary sections of all three source documents.

---

## One-Sentence Definition

**AgentGuard is an authorization firewall for AI agents: the LLM can propose what to buy, but only deterministic policy and verification code can authorize money to move.**

*(Source: gptPlan.md §1 — confirmed as the strongest framing across all three planning documents)*

---

## The Pitch (30 seconds)

> "Everyone is building an AI that can buy things. We built the layer that stops it from buying the wrong thing. AgentGuard is a deterministic policy and verification gateway that sits between an AI buyer and Razorpay's payment APIs. The LLM explains. The policy engine decides. Every decision is audited in a hash-chained log that any judge can verify independently with a single command."

---

## North Star

Build the trust infrastructure layer that makes agentic commerce safe enough to actually deploy. Not a checkout bot — the policy firewall *behind* every checkout bot.

---

## Core Philosophical Commitment (Non-Negotiable)

> "The LLM explains, the policy engine decides."

- **LLMs are used for:** natural language → structured intent extraction; human-readable explanations of blocked decisions (cosmetic only).
- **LLMs are NEVER used for:** authorization allow/block decisions, financial risk judgments, identity verification.

This principle must be stated explicitly in documentation, the demo, and the pitch. It is architecturally enforced: the policy engine is a pure deterministic function with no LLM calls.

---

## Problem Statement

### The Landscape

Agentic commerce is live and accelerating. A global protocol race is underway — ACP (OpenAI/Stripe), AP2 (Google), x402 (Coinbase), UAP (NPCI) — with no interoperability and no dominant standard.

**The obvious hackathon entry** is "an LLM that completes checkout." Razorpay already ships this (SuperU, Nugget-by-Zomato). It is not a differentiator.

### The Actual Open Problem

All four major protocols explicitly disclaim fraud/policy/liability resolution:

| Protocol | What it governs | What it explicitly does NOT solve |
|---|---|---|
| ACP (OpenAI/Stripe) | Checkout session, cart, OAuth delegation | Fraud modeling, PSP authorization semantics |
| AP2 (Google) | Cryptographic mandate signing | Dispute-liability resolution, merchant policy enforcement |
| x402 (Coinbase) | Machine-to-machine HTTP micropayments | Consumer agent authorization, policy bounds |
| UAP (NPCI) | Agent trust registry | No public specification yet — cannot disclaim anything |

**The precise gap:** There is no config-driven, independently auditable, protocol-agnostic reference implementation of "bound an agent's spending authority and prove it was honored."

### Agentic Failure Modes AgentGuard Addresses

| Failure Mode | How AgentGuard handles it |
|---|---|
| Spend limit violation | Policy engine enforces max_transaction_amount and max_daily_spend_per_agent |
| Price/product substitution | Cart integrity verifier: SHA-256 hash of canonical cart at authorization vs. execution |
| Authorization replay | Idempotency guard: SQLite UNIQUE constraint, INSERT-then-check race-safe |
| Prompt injection | Parser returns structured object; injected text cannot change policy gates |
| Ambiguous intent | 1-paise sentinel triggers policy block; no guessing |
| Cross-agent identity confusion | Idempotency key is bound to agent_id; different agent with same key is rejected |

---

## Why AgentGuard Wins

### vs. The Obvious "LLM Checkout" Entry

Direct evidence: Razorpay already ships this. Building another one is not differentiated.

### vs. AgentPay (the AP2-based Track 01 competitor)

The only known direct competitor in Razorpay AI Buildathon 2026 Track 01 is `Prajeeth-12/AgentPay` — an AP2-mandate-based ES256/JWT authorization system.

| Dimension | AgentPay | AgentGuard |
|---|---|---|
| Authorization mechanism | Cryptographic mandate (ES256 JWT) — constraint carried by the token | Server-side deterministic policy against hot-reloadable YAML — constraint evaluated by the gateway |
| Adversarial scenarios shown | One (budget violation) | Six (over-cap, cart tamper, replay, category, ambiguous intent, cross-agent identity) |
| Audit verification | "Immutable audit trail" — mechanism unspecified | SHA-256 hash-chain + standalone CLI: `python verify_audit_chain.py` — any judge can run it |
| Policy mutability | Fixed at session start | Hot-reloadable via SIGHUP, no redeploy, merchant-operable |
| Protocol claim | "UAP-compatible" (UAP has no public spec — claim is unverifiable) | "The policy layer any protocol sits behind" — verifiably true today |

**One-sentence differentiation (use verbatim in demo close):**
> *"AgentPay-style systems prove a token was signed correctly. AgentGuard proves — to anyone, independently, after the fact — that the system's entire decision history is internally consistent and was applied the same way every time, including on the requests it blocked."*

### Razorpay's Own Production Validation

Razorpay + NPCI's live Claude-based agentic payment pilots (Zomato/Swiggy/Zepto, Feb 2026) already encode bounded-spend rules with per-merchant spending limits — the same fields AgentGuard's `max_transaction_amount` / `allowed_categories` formalizes. This is external validation that the problem is real, not manufactured.

**Strongest pitch framing:** "We built the reference implementation of the policy pattern Razorpay already ships informally in production, made it config-driven and independently auditable."

---

## Design Principles

| # | Principle | Operational Meaning |
|---|---|---|
| P1 | LLM explains, code decides | LLMs never sit on the allow/block decision path |
| P2 | Config, not code, for policy | All business rules are in policy.yaml; hot-swappable via SIGHUP |
| P3 | Every decision is logged | Both blocked AND allowed decisions produce audit entries |
| P4 | Honest simulation | AI buyers are labeled as simulated; no false claims of real protocol traffic |
| P5 | Fail closed | Ambiguous or unknown states default to BLOCK, not allow |
| P6 | Depth over breadth | One tested path beats four broken adapters |
| P7 | Auditability is load-bearing | The audit log is not debugging afterthought — it is a core deliverable |
| P8 | Security by architecture | Idempotency, cart-integrity, and policy checks are gates, not optional middleware |

---

## User Personas

### Persona 1 — The Razorpay Merchant (Primary)
- **Name:** Arjun, founder of a D2C running-gear brand
- **Pain Point:** No way to bound what an AI buyer is allowed to purchase; no audit trail if something goes wrong
- **Goal:** Enable AI-powered purchasing with confidence that his store is protected
- **How AgentGuard helps:** Arjun edits `policy.yaml` (max 7,000 per transaction, footwear category only) — no code, no redeploy. Every AI purchase request passes through verifiable gates before touching the Razorpay API.

### Persona 2 — The Razorpay Platform Team (Secondary)
- **Name:** Priya, PM on the Agent Studio / Agentic Commerce team
- **Pain Point:** No reference policy layer to de-risk the agentic-commerce roadmap
- **Goal:** Understand how a production-grade policy gateway should be architected
- **How AgentGuard helps:** Working, auditable reference architecture that can be adapted for Razorpay's own product roadmap

### Persona 3 — The Simulated AI Buyer (System Actor)
- **Name:** AgentBot-001
- **Context:** Python script sending NL purchase requests; in adversarial scenarios attempts over-cap, cart tamper, replay
- **Explicitly labeled as a simulation throughout**

### Persona 4 — The Hackathon Judge (Evaluator)
- **Goal:** Evaluate technical depth, defensibility of design decisions, production-readiness signals
- **What they want to see:** A blocked adversarial scenario, a live hash-chain verification, a clear statement of why the LLM does not decide

---

## Product Goals

| ID | Goal |
|---|---|
| G1 | Build a policy/verification middleware layer between an AI buyer and Razorpay's payment APIs |
| G2 | Support one real settlement rail (Razorpay test-mode) + one convincingly simulated AI buyer persona |
| G3 | Parse natural-language purchase intent into a structured, bounded BoundedIntent object |
| G4 | Enforce a config-driven policy engine (spend caps, category allow-lists, confirmation thresholds) |
| G5 | Verify cart integrity: detect and block silent post-authorization changes |
| G6 | Produce a hash-chained, append-only audit log of every decision |
| G7 | Demo 6 blocked adversarial scenarios alongside one successful end-to-end purchase |

## Anti-Goals (Hard Cuts)

| Anti-Goal | Reason |
|---|---|
| Working adapters for all four protocols | Four half-finished adapters beat zero complete ones |
| Real PKI/ECDSA signing | SHA-256 hash-chaining sufficient to prove the concept |
| ML anomaly model as load-bearing safety mechanism | Rule-based checks are safety-critical; ML is optional and advisory-only |
| LLM on the money-moving decision path | Violates core thesis; every authorization must trace to deterministic policy code |
| Docker/Postgres/EC2/Nginx stack | 2-day timeline; SQLite + Streamlit eliminate an entire risk category |

---

## OWASP / Industry Risk Context

*(Source: gptPlan.md §2 — these are the standard-body citations grounding AgentGuard's relevance)*

OWASP identifies excessive autonomy, tool abuse, high-impact action abuse, decision manipulation, and prompt injection as the key agent risks. NIST describes autonomous agents as introducing security challenges because model outputs are connected to software capable of taking real-world actions.

AgentGuard's deterministic pipeline directly addresses each of these: no autonomy without policy clearance, no tool call without idempotency protection, no high-impact action without spend-cap enforcement, decisions by deterministic code not model output, cart integrity blocking post-authorization manipulation.

---

## Glossary

| Term | Definition |
|---|---|
| BoundedIntent | The core data structure: a parsed, typed, validated purchase authorization request |
| Idempotency Key | Deterministic token uniquely identifying a purchase intent; prevents replay attacks |
| Hash-Chained Audit Log | Append-only log where each entry contains SHA-256 of the previous entry |
| Policy Engine | The deterministic rule evaluator; the component that makes all allow/block decisions |
| Cart Integrity | The property that cart contents have not changed since authorization |
| Replay Attack | Resubmitting an already-executed authorization to trigger a duplicate payment |
| Cart Tampering | Modifying cart contents after authorization but before execution |
| TTL | Time-to-live; how long a BoundedIntent remains valid |
| Fail-Closed | Default behavior when state is ambiguous: block the request, not allow it |
| Paise | Smallest unit of INR (1 INR = 100 paise); all amounts stored as integer paise |
| Synthetic AI Buyer | Simulated agent sending purchase requests in the demo — explicitly labeled as simulation |
| ACP | Agent Commerce Protocol (OpenAI + Stripe + Meta) |
| AP2 | Agent Payments Protocol (Google + 60+ partners) |
| x402 | HTTP 402-based machine-to-machine payment protocol (Coinbase, Linux Foundation) |
| UAP | Unified Agent Protocol (NPCI) — pre-launch, no public spec as of Sep 2026 |
| Test-Mode | Razorpay sandbox environment; no real money moves |

---

*Extracted from: `Master_AgentGuard.md` §1-6, §33 · `gptPlan.md` §1-3 · `Docs/AgentGuard_Master_Blueprint.md` §1-4*
*Supersedes: Executive summary sections in all three source documents.*
