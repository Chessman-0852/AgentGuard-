# AgentGuard — Master Technical Blueprint
### Principal Engineering Review & Long-Term Source of Truth
**Prepared:** September 3, 2026 | **Deadline:** September 5, 2026 (**T-minus ~48 hours**) | **Source:** `Master_AgentGuard.md` v1.0 + external protocol/competitive research

> **Read this first:** The original build plan (§Appendix A of the source spec) assumed 13 days from Aug 23 to Sep 5. As of this writing it is Sep 3 — **two build days remain, not thirteen**. Every recommendation below is filtered through that reality. Where the source spec's "Core MVP" scope is no longer achievable in the time left, this document says so explicitly and tells you what to cut. This is the single most important piece of engineering judgment in this report — treat §14 (Project Readiness Assessment) as load-bearing.

---

## 1. Executive Summary

AgentGuard is a **deterministic policy and verification gateway** inserted between a natural-language AI purchase agent and Razorpay's payment execution APIs. Its thesis — *the LLM explains, the policy engine decides* — is sound, defensible, and, based on the competitive landscape uncovered during this review, **is the correct differentiator for this specific hackathon track**, but it is not automatically differentiated by itself. A rival submission to the same track (`Prajeeth-12/AgentPay`, also Track 01 of the Razorpay AI Buildathon) has already shipped a working prototype built on Google's AP2 cryptographic mandate model with ES256-signed open/closed mandates, a simulated NPCI UAP trust registry, and a three-panel demo UI. That project's core selling point — "the agent literally cannot override the budget" — is a cryptographic-authorization framing of the *same* underlying idea AgentGuard expresses as "the policy engine decides." This means the burden of proof for AgentGuard is no longer "did you build a policy gateway" but **"is your gateway more auditable, more adversarially tested, and more clearly mapped onto the real protocol landscape than the other one."**

The recommended path is: **keep the five/six-gate deterministic pipeline and the hash-chained audit log as the centerpiece (this is genuinely under-served relative to AP2-style crypto-mandate demos, which tend to show the happy path and one blocked case, not a full adversarial suite)**, but tighten the story around three things that are cheap to build and expensive for a judge to ignore:

1. **A clear, one-slide positioning statement** that AgentGuard is *protocol-agnostic policy infrastructure* — the layer any of ACP, AP2, x402, or UAP would sit behind — rather than a fifth competing protocol. This directly answers Persona 4's (the judge's) most likely objection and pre-empts comparison with AP2-mandate-based competitors.
2. **A materially larger, harder adversarial test suite than a typical hackathon demo** (six failure modes, not two), because that breadth is the one dimension competitors have not shown depth in.
3. **A live, independently-runnable audit verification step** — this is a five-minute, high-trust demo beat that a signed-JWT mandate system does not have an equivalent of (verifying a signature proves a mandate was signed; it does not prove the *system's history* is internally consistent — hash-chaining does).

Given the compressed timeline, the recommended build target is a **single-process FastAPI monolith with SQLite (not PostgreSQL/Docker/EC2), a Streamlit dashboard (not React), and Anthropic Claude for intent parsing (not Groq/Llama)** — collapsing three of the source spec's infrastructure decisions into choices that eliminate entire categories of two-day risk (container orchestration, DNS/SSL, cross-origin SSE, a second language runtime) without changing anything the judge actually evaluates. This is the single highest-leverage architectural change recommended in this document.

---

## 2. Literature & Related Work Synthesis

### 2.1 The protocol landscape (verified against current sources, not the source spec's assumptions)

The source document's protocol list (ACP, AP2, x402, UAP) is accurate but was written with a snapshot of each protocol that has since moved. A synthesis of where each stands as of September 2026:

| Protocol | Owner(s) | What it actually governs | Maturity signal | Relevance to AgentGuard |
|---|---|---|---|---|
| **ACP** (Agentic Commerce Protocol) | OpenAI + Stripe (Meta joined as a co-author of the open standard) | The *checkout session* — cart, fulfillment, payment-token delegation, OAuth-style auth delegation. Explicitly **out of scope**: PSP authorization/capture semantics, fraud modeling, tax. | Live in production since Sep 2025 (ChatGPT Instant Checkout, Etsy/Shopify); date-versioned spec, latest snapshot 2026-04-17; Apache-2.0, jointly governed. | ACP's explicit exclusion of fraud modeling and authorization semantics is the clearest textual evidence that a policy/fraud layer like AgentGuard is a real, unfilled gap **even in the most mature protocol**, not a strawman. |
| **AP2** (Agent Payments Protocol) | Google, with Mastercard, PayPal, Coinbase, Amex, Adyen, Salesforce and 60+ launch partners | *Authorization proof* via three signed Mandates (Intent → Cart → Payment), carried as W3C Verifiable Credentials/JWTs. Explicitly does **not** move money or settle transactions — it produces a cryptographic record that *a rail can settle against*. | v0.2.0 (Apr 2026), production pilots (PayPal most advanced), 60+ partners. Composes with A2A (agent-to-agent) and MCP (tool access). | This is the closest conceptual competitor to AgentGuard's `BoundedIntent`. AP2's mandate is a **cryptographically signed authorization boundary**; AgentGuard's BoundedIntent is a **server-side, policy-checked authorization boundary**. They are not mutually exclusive — see §4.2. |
| **x402** | Coinbase + Cloudflare (now under Linux Foundation as of Apr 2026, with AWS, Anthropic, Circle as members) | Machine-to-machine *settlement* via HTTP 402, in stablecoins (USDC/EURC), for sub-dollar API/content payments. | Real production volume (169M+ transactions in year one per Coinbase; live on Base, Solana, Arbitrum, Polygon). Explicitly a **settlement rail**, not an authorization or policy layer — it composes with AP2 (`a2a-x402` extension lets an AP2 mandate authorize an x402 settlement). | Out of scope for AgentGuard correctly (per the source spec's anti-goals) — x402 solves a different problem (agent-pays-machine micropayments), not consumer-agent-buys-product authorization. Worth one sentence in the demo to show awareness, not an integration. |
| **UAP** (Unified Agent Protocol) | NPCI (India), announced July 2026, still **pre-launch with no public specification** | Registering, verifying, and authorizing trusted agents to transact over UPI, reusing existing UPI Circle / Reserve Pay consent mechanisms, without a specific product-level policy language. | Confirmed as a national-infrastructure initiative (Global Fintech Fest 2026), but as of this writing has **no public spec, no SDK, no reference implementation** from NPCI itself. | This is the single most important fact for the "novelty" narrative: **UAP has no public implementation, and AgentGuard is not claiming to be one** — it is a merchant-side policy reference that plugs in *underneath* whatever consent/registry layer UAP eventually standardizes. State this explicitly to pre-empt "which protocol are you implementing?" |

**Evidence-based conclusion:** all four protocols solve *discovery, checkout-session, cryptographic-authorization,* or *settlement* problems. None of them ship a deterministic, config-driven, merchant-side **policy engine** with an independent audit-verification story. That gap is real, not manufactured — ACP explicitly disclaims fraud modeling, AP2 explicitly disclaims dispute-liability resolution ("AP2 provides audit trails but does not yet solve who is liable"), and UAP has no public spec at all. AgentGuard's positioning as "the trust/policy layer any protocol would sit behind" is therefore defensible on the current evidence, not just a rhetorical hedge.

### 2.2 Adjacent industry practice: Razorpay's own agentic-commerce activity

Razorpay is not a passive judge of this space — it is an active participant, which changes what "impressive" looks like to Persona 2 (the Razorpay PM):
- Razorpay + NPCI + OpenAI piloted agentic UPI payments in ChatGPT (Oct 2025).
- Razorpay + NPCI launched agentic payments on **Claude** in Feb 2026 (Zomato/Swiggy/Zepto), using a **one-time consent-based authentication with per-merchant spending limits** — this is functionally a production analog of AgentGuard's `max_transaction_amount` / `allowed_categories` policy fields. This is strong external validation that Razorpay's own production systems already need exactly the kind of bounded-spend policy object AgentGuard proposes to formalize and make auditable.
- This means the strongest pitch framing is not "we invented a new idea" but **"we built the reference implementation of the policy pattern Razorpay already ships informally in production, made it config-driven and independently auditable."** That is a materially stronger claim than the source spec's current framing and should replace it in the pitch script (§6 of source spec / demo script).

### 2.3 Direct competitive precedent (critical finding)

A public repository, `Prajeeth-12/AgentPay` — **explicitly built for the same Razorpay AI Buildathon 2026, Track 01** — already demonstrates: an AP2-mandate-based (ES256/JWT) budget-bounded shopping agent, a simulated UAP trust registry, real Razorpay test-mode order/payment-link creation, an immutable audit trail, and a documented "budget violation blocked" demo beat, with a candid build-log ("What Broke at 2 AM") in the same spirit the source spec requires of `BUILD_LOG.md`.

**This is not a reason to abandon AgentGuard.** It is a reason to sharpen differentiation deliberately (see §4). The two projects are architecturally distinct in a way that is easy to articulate to a judge:

| Dimension | AgentPay (competitor) | AgentGuard (this project) |
|---|---|---|
| Authorization mechanism | Cryptographic mandate signing (ES256 JWT) — the constraint is *carried by the token* | Server-side deterministic policy evaluation against a hot-reloadable YAML config — the constraint is *evaluated by the gateway* |
| Adversarial breadth shown | One scenario (budget violation) | Six scenarios (over-cap, cart tamper, replay, category violation, ambiguous intent, cross-agent identity) — per source spec §3 |
| Audit mechanism | "Immutable audit trail" (mechanism unspecified in public README) | Hash-chained, independently-verifiable via a 10-line CLI script a judge can run themselves |
| Policy mutability | Not exposed (budget set once at session start) | Hot-reloadable via SIGHUP, no redeploy, merchant-operable |
| Positioning | "UAP-compatible platform" (implies protocol compliance UAP cannot yet verify, since UAP has no public spec) | "The policy layer any protocol sits behind" (protocol-agnostic, verifiably true today) |

---

## 3. Problem Analysis

### 3.1 Restated problem (evidence-grounded)
Every major agentic-commerce protocol either explicitly disclaims fraud/policy/liability resolution (ACP, AP2) or has no public implementation to disclaim anything (UAP). Simultaneously, Razorpay's own live pilots already encode ad hoc bounded-spend rules. The gap is therefore precise: **there is no config-driven, independently auditable, protocol-agnostic reference implementation of "bound an agent's spending authority and prove it was honored."** This is the same framing as the source spec, now backed by four external citations rather than assertion.

### 3.2 Requirements derived from the gap
1. **Functional:** parse unbounded natural language into a bounded, typed authorization object; evaluate that object against merchant-defined, hot-reloadable rules; detect tampering between authorization and execution; prevent replay; execute against a real settlement rail; record every decision tamper-evidently.
2. **Non-functional:** the decision path must be fully deterministic and explainable without re-running an LLM; the audit mechanism must be verifiable by a third party with no special tooling; the system must fail closed on any ambiguous or missing state.
3. **Constraint (new, from this review):** the artifact must be **legible to a judge in under 5 minutes** and must **pre-empt direct comparison with at least one already-public competing submission** in the same track.

### 3.3 Assumptions carried forward from the source spec (engineering judgment, not evidence)
- One settlement rail (Razorpay test-mode) is sufficient to prove the pattern; this is correct and should not be revisited given the timeline.
- Natural-language-only input (no ACP/AP2 JSON ingestion) is sufficient for MVP; correct for the same reason, and doubly correct now given two days remain.

---

## 4. Novelty & Differentiation Assessment

### 4.1 What is genuinely novel
Not the idea of "policy gateway for AI purchases" — the AgentPay competitor and Razorpay's own Claude pilot both express variants of it. What is novel, relative to every artifact found in this review, is the **combination** of: (a) config-file-as-policy-boundary (not code, not a signed token) that a non-engineer merchant persona can edit and hot-reload, and (b) an audit mechanism whose integrity a third party can verify **without trusting AgentGuard's own dashboard** — hash-chain verification is adversarial-proof in a way "the UI says the trail is immutable" is not. No other artifact surfaced in this research pairs those two properties.

### 4.2 Where AgentGuard should explicitly *not* claim differentiation
Do not claim novelty over AP2's mandate concept in the abstract — Google's mandate model is more cryptographically rigorous than AgentGuard's plaintext BoundedIntent + hash-chain, and a judge who knows AP2 will notice if the pitch overclaims. The correct claim is **complementary layering**: an AP2 Intent/Cart Mandate could be one *valid input format* to AgentGuard's policy engine in a post-MVP world (see §13), exactly the way the source spec already frames ACP/AP2/x402/UAP as protocol adapters at the input boundary. State this in the demo as intellectual honesty — it costs nothing and defuses the most likely "gotcha" question.

### 4.3 Recommendation
Adopt this one-sentence differentiation, to be used verbatim in the pitch: *"AgentPay-style systems prove a token was signed correctly; AgentGuard proves — to anyone, independently, after the fact — that the system's entire decision history is internally consistent and was applied the same way every time, including on the requests it blocked."*

---

## 5. Recommended System Architecture

### 5.1 Primary recommendation: collapse the infrastructure, keep the pipeline
**Recommended:** single Python process (FastAPI, async), SQLite (WAL mode) as the only datastore, Anthropic Claude (Haiku or Sonnet, structured tool-use) as the sole LLM call, Streamlit as the dashboard, deployed as a single `uvicorn` process on one machine (or simply run locally for the recorded demo) — no Docker Compose, no Nginx, no EC2, no GitHub Actions deploy pipeline.

**Why (justification):** the source spec's Docker/Postgres/EC2/Nginx/GitHub-Actions stack (§18, §24) is the right design for a product with users; it is the wrong design for a judged artifact with **48 hours left and one demo recording as the actual deliverable**. Every layer in that stack (DNS, SSL certs, security groups, container networking, CI secrets) is a place a two-day project dies the night before recording, for zero marginal credit — a judge scores the five-gate pipeline, the adversarial coverage, and the audit verification, not whether Postgres is behind Nginx. SQLite with WAL mode fully supports the append-only/no-UPDATE/no-DELETE requirement (enforce it in application code plus a `CHECK`/trigger, since SQLite role-based grants don't exist — this is a **necessary substitution**, not a shortcut, and must be called out in `BUILD_LOG.md` as a documented, deliberate trade-off).

**Alternatives considered and rejected:**
- *PostgreSQL + Docker Compose + EC2 (source spec's original plan):* rejected now purely on time — it was correct advice for a 13-day build and is over-engineering for a 2-day build. If the project continues post-hackathon, migrate then (see §13).
- *React + Vite dashboard:* rejected for the same reason — the source spec's own §32 Open Question 4 already flags "Streamlit if solo," and a solo build with 2 days left is definitionally the Streamlit branch of that decision tree. React's SSE/WebSocket real-time feed is a nice-to-have; Streamlit's `st.rerun()` polling loop against SQLite delivers the same *demo-visible* effect (a live feed that updates) with an order of magnitude less integration risk.
- *Groq (Llama-3.3-70b) for intent parsing (source spec's stated choice):* reconsidered — see §7.1.

### 5.2 Architecture diagram (component view)

```
[Synthetic AI Buyer / Scenario Runner]  (Python script, 6 scenario types)
              |  HTTP POST /intents
              v
[FastAPI app — single process]
   Stage 1  Intent Parser        -> Claude structured tool-use -> BoundedIntent (Pydantic-validated)
   Stage 2  Policy Engine        -> pure function against policy.yaml (hot-reload on SIGHUP)
   Stage 3  Cart Integrity Check -> SHA-256(canonical cart) diff
   Stage 4  Risk Check           -> velocity + advisory z-score (never blocks alone)
   Stage 5  Idempotency Guard    -> SQLite key lookup, TTL-based
   Stage 6  Action Executor      -> Razorpay Orders + Payment Links (test-mode)
              |
   Audit Log -> hash-chained append-only SQLite table, entry_hash = SHA256(entry + prev_hash)
              |
[Streamlit Dashboard]  <- polls SQLite directly (read-only) -> live feed, block-reason chart,
                            per-agent spend bars, "Verify Chain" button -> shells out to
                            verify_audit_chain.py and streams stdout
```

This is the source spec's own six-stage pipeline (§12) with the infrastructure ring removed, not a redesign of the core logic — the core logic was already correct.

---

## 6. End-to-End System Workflow

Unchanged from the source spec's own user-journey documentation (§8), which is well-specified and does not need re-litigating: happy path (parse → policy pass → cart-integrity pass → risk pass → idempotency pass → Razorpay order/payment-link → webhook → audit entry), and three blocked paths (over-cap, cart-tamper, replay). **Addition recommended for this review:** add a fourth and fifth blocked-path walkthrough to the demo script — category-not-allowed and ambiguous-intent-requires-confirmation — because six-scenario adversarial breadth is the concrete, low-cost differentiator identified in §4.3, and the source spec's own demo flow (§28) only scripts three of the six failure modes it defines in §3.

---

## 7. Core Technology & Design Review

### 7.1 LLM provider for intent parsing — reconsidered
**Recommended: Anthropic Claude (e.g., a current small/mid-tier model) via structured tool-use, temperature 0**, not Groq/Llama-3.3-70b as the source spec states.

**Justification:** the source spec's own §9 Feature 1 backend-flow code sample already calls the Anthropic Python SDK (`claude_client.messages.create(..., tools=[bounded_intent_tool_schema], tool_choice={"type": "tool", ...})`) — the spec is internally inconsistent between §9 (Claude) and §14 (Groq/Llama). Given that inconsistency has to be resolved anyway, Claude's tool-use is the more mature, more reliable structured-output path for exactly the ambiguous/adversarial NL inputs (§9's own edge cases: multi-item requests, non-INR mentions, empty categories) that this project's test suite is built to stress. Groq's free-tier latency advantage (the spec's stated reason for choosing it) matters for a production SLA; it does not matter for a 5-minute recorded demo where a 1–2 second parse is invisible to the viewer.

**Alternative considered:** Groq/Llama-3.3-70b-versatile (source spec's stated primary) — rejected for this build only because of the internal inconsistency above and because eliminating a second API-key dependency (Groq + Anthropic) reduces demo-day failure surface, which is the dominant risk factor with two days left. If free-tier cost is a hard constraint, Groq remains a reasonable fallback; document the choice either way in `BUILD_LOG.md` rather than leaving the two sections of the spec contradicting each other.

### 7.2 Hash-chained audit log vs. cryptographic signing
**Recommended (unchanged from source spec):** SHA-256 hash-chaining, explicitly not real PKI/ECDSA signing.

**Justification:** hash-chaining proves *internal consistency* (nothing was altered after the fact) at near-zero implementation cost and is independently verifiable by a judge running a 10-line script with database read access — no shared secret, no key management. Full ECDSA signing (as AP2 and the AgentPay competitor use) additionally proves *who* authored an entry, which matters for multi-party non-repudiation but is not the property this project needs to demonstrate; it is the property AP2-style systems already demonstrate well. Duplicating it would spend the remaining two days competing on the competitor's strength instead of this project's own.

### 7.3 Policy-as-YAML vs. policy-as-code vs. policy-as-signed-mandate
**Recommended (unchanged from source spec):** YAML, hot-reloadable via SIGHUP, fail-closed on missing/malformed file.

**Alternatives considered:** (a) policy-as-code (rejected — violates P2, and defeats the "no-code merchant control" persona-1 story); (b) policy-as-signed-mandate, AP2-style (rejected for the reason in §4.2 — this is the competitor's model, not a gap this project should also try to fill under time pressure; it is worth one sentence acknowledging it as a valid alternative design, which itself signals engineering maturity to a judge).

### 7.4 Idempotency store
**Recommended (adjusted for infra collapse):** a SQLite table exactly as specified in the source spec's §9 Feature 5 schema, not Redis. The source spec already correctly scopes Redis as a **post-MVP, at-scale** optimization (§17) — that framing was already correct and is reinforced, not changed, by the infra-collapse recommendation.

---

## 8. Design Decision Log

| # | Decision | Alternatives considered | Justification | Trade-off accepted |
|---|---|---|---|---|
| D1 | Deterministic policy engine, LLM never on the decision path | LLM-adjudicated risk scoring; hybrid LLM+rules voting | Auditable, reproducible, defensible under judge cross-examination; matches ACP/AP2's own explicit exclusion of "fraud modeling" as unsolved | Cannot catch novel fraud patterns a rule wasn't written for — mitigated by advisory-only anomaly scoring (§9 Feature 4) |
| D2 | SQLite (not PostgreSQL) for this build | PostgreSQL + Docker + EC2 (original spec) | Timeline (2 days left) dominates; SQLite WAL supports the append-only guarantee via app-level enforcement | Loses PostgreSQL's role-level `REVOKE UPDATE/DELETE` guarantee; must document as a known limitation, not hide it |
| D3 | Streamlit (not React) dashboard | React + Vite + SSE (original spec) | Source spec's own contingency plan for a solo build; eliminates a second toolchain and cross-origin/streaming risk under time pressure | Less polished real-time UX; acceptable because judges evaluate decision logic, not frontend polish |
| D4 | Claude (not Groq/Llama) for intent parsing | Groq Llama-3.3-70b-versatile (spec's stated choice, contradicted by spec's own code sample) | Resolves an internal spec inconsistency; one fewer API dependency to fail on demo day; tool-use maturity for adversarial NL | Loses Groq's raw-latency advantage, irrelevant at demo scale |
| D5 | SHA-256 hash-chain audit log, not ECDSA signing | Full PKI/ECDSA signing (AP2/AgentPay-style) | Matches the property this project needs to prove (internal consistency, independently verifiable) at minimal cost; differentiates from the mandate-signing approach already demonstrated by a competing submission | Does not prove *authorship* non-repudiation the way signed mandates do — acceptable, out of scope per source spec's own P8/anti-goals |
| D6 | Six scripted adversarial scenarios in the demo, not three | Ship only the three scenarios in the source spec's §28 demo flow | Adversarial breadth is the cheapest, highest-leverage differentiator against the AgentPay competitor's single-scenario demo | Slightly longer demo; recommend trimming the happy-path beat, not the adversarial beats, to stay near 5 minutes |
| D7 | Explicit "protocol-agnostic policy layer, not a fifth protocol" framing in the pitch | Silence on protocol positioning (source spec's original framing, implicitly the same but not stated as a rebuttal) | Directly pre-empts the single most likely judge question, now that a public UAP-branded competitor exists in the same track | None — this is free (a sentence, not an engineering cost) |

---

## 9. Engineering & Implementation Strategy

Given two build days, sequence work strictly by demo-critical-path, not by the source spec's original 13-day plan (Appendix A), which is no longer executable as sequenced.

**Day 1 (today, Sep 3):**
1. `BoundedIntent` Pydantic schema + `policy.yaml` loader with fail-closed behavior (2–3 hrs) — this one artifact unblocks everything downstream and is the highest-risk single point of failure if malformed.
2. Policy engine + cart-integrity verifier + idempotency guard as pure, independently unit-tested functions (source spec's §9 code samples are implementation-ready — use them near-verbatim).
3. Intent parser wired to Claude tool-use; validate against 10+ NL inputs spanning the six adversarial categories.
4. Razorpay test-mode Orders + Payment Links wiring; webhook handler with HMAC signature validation (source spec's §15 code sample is correct as-is).

**Day 2 (Sep 4):**
5. Hash-chained audit log + `verify_audit_chain.py`, tested against a deliberately tampered entry to confirm it actually detects breakage (this is the single most important thing to test before recording, per the source spec's own §31 risk table).
6. Streamlit dashboard: summary cards, block-reason breakdown, live feed, "Verify Chain" button.
7. Run the full six-scenario adversarial suite end-to-end; fix any false blocks/false allows.
8. Record the 5-minute demo (source spec §28, extended per D6); write `README.md`, `BUILD_LOG.md`, architecture diagram.

**Buffer:** none remains — if Day 1 items 1–4 slip past midnight, cut the dashboard polish and Streamlit's chart component first; never cut the adversarial test suite or the audit verification script, since those are what §4's differentiation argument depends on.

---

## 10. Validation & Evaluation Strategy

Adopt the source spec's own success metrics (§27) unchanged — they are well-chosen (100% adversarial block rate, ≥95% legitimate allow rate, 100% audit coverage, verified chain integrity) — but add one evaluation step this review surfaces as necessary: **run `verify_audit_chain.py` against a deliberately corrupted database row as a unit test**, not only against a clean run. The source spec's §22 already specifies this test (`test_tampered_entry_detected`) — the addition here is operational, not technical: rehearse the *failure* demo (chain broken, red X, correct entry index) on camera at least once, not only the success path, because a verification script that has only ever been shown succeeding is less convincing to a technical judge than one shown catching a real break.

---

## 11. Technical Gaps & Improvement Opportunities

1. **Cross-agent identity confusion** (source spec §3's sixth failure mode) has no corresponding feature spec anywhere in §9 — it is named as a problem but never implemented or tested. Given time, add a minimal check (idempotency key bound to `agent_id`; reject if a key is replayed under a different `agent_id`) — this closes the one adversarial scenario the source spec itself leaves unaddressed.
2. **Ambiguous-intent handling** is specified as a dashboard badge ("needs human review") but has no explicit test case in §22's adversarial checklist. Add it as the fifth scripted demo beat per §6/D6.
3. **Webhook-ordering edge case** ("webhook arrives out of order") is named in §9 Feature 6 but not given a concrete handling rule — recommend: idempotency status transitions are monotonic (`pending → executed` or `pending → failed`, never backwards), enforced with a single `CASE` guard in the update statement.

---

## 12. Risks, Assumptions & Limitations

The source spec's §31 risk table is accurate and should be kept as-is, with two additions surfaced by this review:

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| A judge has seen or will see the AgentPay competitor submission and asks "how is this different?" | Medium–High (same track, public repo) | High if unaddressed | Lead with the §4.3 one-sentence differentiation; do not wait to be asked |
| Infra-collapse decisions (SQLite, Streamlit, Claude) are not documented as deliberate, and read as "ran out of time" rather than "engineering judgment" | Medium | Medium (signal, not function) | State each substitution explicitly in `BUILD_LOG.md` with the one-line justification from §8's Design Decision Log |

**Limitations, stated plainly (per source spec's own P4 "Honest simulation" principle):** the AI buyer is simulated and labeled as such; hash-chaining is tamper-evidence, not cryptographic non-repudiation; SQLite's append-only guarantee is enforced in application code, not at the database-role level, in this build.

---

## 13. Scalability & Future Enhancements

The source spec's own post-MVP roadmap (§30, phases 2–6) remains the correct long-horizon plan and needs only one reordering given the findings in §4.2: **elevate "AP2 mandate as an accepted input format" to Phase 2**, alongside the existing ACP-adapter phase, since the differentiation research in this review shows that is the most natural and lowest-risk interoperability story (AgentGuard's policy engine evaluating a signed AP2 Cart Mandate instead of a freshly-parsed NL string is a small adapter, not a redesign — the BoundedIntent schema already sits at the right level of abstraction to accept it). Migrating the datastore back to PostgreSQL and the dashboard to React (per §5.1's D2/D3 trade-offs) should also be an explicit, named Phase 2 item, not an implicit assumption.

---

## 14. Project Readiness Assessment

**Current readiness against the source spec's own MVP checklist (§29), assessed as of Sep 3, 2026:** the core logic in §9's feature specs and §12's architecture is fully implementation-ready — the code samples in the source document are correct and largely copy-paste-ready, which is the single biggest asset this project has going into the final 48 hours. The gap is entirely in **infrastructure scope that this review recommends cutting** (§5.1) and in **the two adversarial scenarios not yet scripted into a demo** (§6, §11). There is no remaining technical uncertainty in this plan — every remaining task is execution, not design. That is the correct state to be in with two days left, and it is why this review's primary contribution is subtractive (cut Docker/Postgres/React/Groq) rather than additive.

**Composite recommendation:** proceed with the source spec's technical design in full; adopt §5.1's infrastructure substitutions immediately (today) to protect the remaining time budget; do not attempt any post-MVP feature (§13) before the deadline.

---

## 15. Prioritized Implementation Roadmap

### Must Have (ship-blocking, both days)
- `BoundedIntent` schema + Pydantic validation + fail-closed `policy.yaml` loader
- Policy engine (all rules) + cart-integrity verifier + idempotency guard, each independently unit-tested
- Claude-based intent parser (structured tool-use, temperature 0)
- Razorpay test-mode Orders + Payment Links + webhook handling with signature validation
- Hash-chained audit log + `verify_audit_chain.py`, tested against a deliberately tampered entry
- All six adversarial scenarios (over-cap, cart-tamper, replay, category-blocked, ambiguous-intent, cross-agent-identity) scripted and passing at 100% block rate
- `README.md`, `BUILD_LOG.md` with real documented failures, architecture diagram, `policy.yaml` committed

### Should Have (if Day 1 finishes on schedule)
- Streamlit dashboard: summary cards, live feed, block-reason chart, per-agent spend bars, "Verify Chain" button
- Structured JSON logging (`structlog`) with gate-by-gate latency
- Synthetic catalog (12 SKUs / 3 categories) + scenario generator as a standalone, re-runnable script

### Nice to Have (only if both above are done with hours to spare)
- Advisory anomaly z-score on transaction amount (explicitly non-blocking)
- Dashboard "Policy Config Viewer" highlighting the specific rule that triggered a block
- A short written note in the README explicitly positioning AgentGuard relative to ACP/AP2/x402/UAP (content drafted in §2.1/§4.3 above — this is nearly free to include and directly strengthens judge-facing differentiation)

### Future Work (explicitly post-deadline, do not attempt now)
- PostgreSQL + Docker Compose + EC2 + Nginx + GitHub Actions deployment (source spec §18/§24, deferred per §5.1/§13)
- React dashboard with SSE live feed
- AP2 Mandate as an accepted alternate input format to the intent parser (§13)
- ECDSA-signed audit entries / external notarization
- Agent credential registry and cross-agent delegation tokens
- ML anomaly model trained on real transaction history (kept advisory-only even then, per P1/anti-goals)

---

*This blueprint synthesizes `Master_AgentGuard.md` v1.0 with external verification of the ACP, AP2, x402, and UAP protocol landscape and one direct competitive artifact in the same hackathon track, current as of September 3, 2026. Where this document overrides a decision in the source spec, the override and its justification are recorded in §8; where it does not, the source spec's original specification remains authoritative and implementation-ready as written.*
