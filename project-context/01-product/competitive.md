# AgentGuard — Competitive Analysis

> **Source:** `Docs/AgentGuard_Master_Blueprint.md` §2-4 + `Docs/gptPlan.md` §2-3 (OWASP/NIST citations)
> **Last updated:** 2026-09-03

---

## Protocol Landscape (as of September 2026)

| Protocol | Owner(s) | What it actually governs | What it does NOT solve |
|---|---|---|---|
| **ACP** | OpenAI + Stripe + Meta | Checkout session, cart, OAuth-style auth delegation | Fraud modeling, PSP authorization semantics, dispute liability |
| **AP2** | Google + 60+ partners | Cryptographic mandate signing (ES256 JWTs) — authorization proof | Dispute-liability resolution, merchant policy enforcement |
| **x402** | Coinbase + Linux Foundation (AWS, Anthropic, Circle) | HTTP 402 machine-to-machine micropayments in stablecoins | Consumer-agent authorization bounds, merchant policy |
| **UAP** | NPCI (India) | Agent trust registry for UPI | No public spec as of Sep 2026 — cannot disclaim anything yet |

**Evidence-based conclusion:** All four protocols solve *discovery, checkout-session, cryptographic-authorization,* or *settlement* problems. None of them ship a deterministic, config-driven, merchant-side policy engine with an independent audit-verification story.

**Strongest citation:** ACP's published spec explicitly states it is "out of scope: PSP authorization/capture semantics, fraud modeling, tax." AP2's documentation states "AP2 provides audit trails but does not yet solve who is liable." UAP has no public spec. This is not a strawman — the gap is real and textually documented.

---

## Razorpay's Own Production Context

Razorpay + NPCI have run live agentic commerce pilots since Oct 2025:
- Oct 2025: agentic UPI payments in ChatGPT (Razorpay + NPCI + OpenAI)
- Feb 2026: agentic payments on Claude (Zomato/Swiggy/Zepto) with **per-merchant spending limits and consent-based authentication**

This is the strongest external validation: Razorpay's own production systems already encode ad hoc bounded-spend rules — the same fields AgentGuard's `max_transaction_amount` / `allowed_categories` formalizes.

**Strongest pitch framing:** "We built the reference implementation of the policy pattern Razorpay already ships informally in production, made it config-driven and independently auditable."

---

## Direct Competitor: AgentPay (Prajeeth-12/AgentPay)

The most important known competitor in the same track (Razorpay AI Buildathon 2026, Track 01).

### What AgentPay Does
- AP2-mandate-based (ES256/JWT) budget-bounded shopping agent
- Simulated NPCI UAP trust registry
- Real Razorpay test-mode order/payment-link creation
- "Immutable audit trail" (mechanism unspecified in public README)
- One demo scenario: budget violation blocked

### AgentGuard vs AgentPay

| Dimension | AgentPay | AgentGuard |
|---|---|---|
| Authorization mechanism | Cryptographic mandate signing (ES256 JWT) — constraint carried by the token | Server-side deterministic policy against hot-reloadable YAML — constraint evaluated by the gateway |
| Adversarial scenarios | One (budget violation) | Six (over-cap, cart tamper, replay, category violation, ambiguous intent, cross-agent identity) |
| Audit mechanism | "Immutable audit trail" — mechanism unspecified | SHA-256 hash-chain + standalone CLI: `python verify_audit_chain.py` — any judge can run independently |
| Policy mutability | Fixed at session start | Hot-reloadable via SIGHUP, no redeploy |
| Protocol claim | "UAP-compatible" (UAP has no public spec — unverifiable) | "The policy layer any protocol sits behind" (verifiably true today) |
| Limitations | Does not prove the system's history is internally consistent — only that individual tokens were signed | Does not prove authorship non-repudiation the way signed mandates do |

### Where to NOT claim differentiation

Do not claim superiority over AP2's mandate concept in the abstract. Google's mandate model is more cryptographically rigorous (ECDSA signing proves authorship non-repudiation; AgentGuard's hash-chain does not). A judge who knows AP2 will notice overclaiming.

**Correct framing:** Complementary layering — an AP2 Intent/Cart Mandate could be one valid *input format* to AgentGuard's policy engine in post-MVP (the BoundedIntent schema sits at the right level of abstraction to accept it). State this as intellectual honesty — it costs nothing and defuses the "gotcha" question.

---

## OWASP & NIST Risk Context

*(Source: gptPlan.md §2 — these are OWASP/NIST citations, not AgentGuard's own assertions)*

**OWASP Top 10 for LLM Applications:**
- LLM08: Excessive Agency — agents taking unintended actions with real-world consequences
- LLM09: Overreliance — systems placing unwarranted trust in LLM outputs

**NIST AI Risk Management Framework:**
> "Autonomous agents introduce security challenges because model outputs are connected to software capable of taking real-world actions."

**OWASP ASVS / WSTG:** recommends deterministic policy enforcement, audit logging, and rate limiting — all of which AgentGuard implements.

**How AgentGuard maps:**

| OWASP/NIST Risk | AgentGuard Gate |
|---|---|
| Excessive autonomy | Policy engine (spend caps + category allow-list) |
| Tool abuse | Idempotency guard (replay prevention) |
| High-impact action abuse | Cart integrity verifier |
| Decision manipulation | LLM boundary — parser produces data, code decides |
| Prompt injection → purchase manipulation | Parser isolated; injected text cannot escape structured schema |

---

## Positioning Statement

**AgentGuard is not a fifth protocol.** It is the policy layer any of ACP, AP2, x402, or UAP would sit behind.

This positioning is:
- Verifiably true today (all four protocols disclaim policy enforcement)
- Protocol-agnostic (no dependency on any specific protocol being live)
- Immune to the "but UAP is coming" objection (AgentGuard predates and works without any protocol)

---

*Merged from: `Docs/AgentGuard_Master_Blueprint.md` §2-4 · `Docs/gptPlan.md` §2-3 (OWASP/NIST citations unique to gptPlan.md).*
*gptPlan.md archived at `project-context/_archive/gptPlan.md` — do not delete; it is a cited source.*
