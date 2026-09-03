# AgentGuard — Design Decision Log

> **Format:** Append-only. Add new decisions below D7. Never edit past decisions.
> **Last updated:** 2026-09-03
> **Source:** Extracted verbatim from `Docs/AgentGuard_Master_Blueprint.md` §8, then updated for Groq confirmation.

---

## Decision Log

| # | Decision | Alternatives Considered | Justification | Trade-off Accepted |
|---|---|---|---|---|
| D1 | Deterministic policy engine; LLM never on the decision path | LLM-adjudicated risk scoring; hybrid LLM+rules voting | Auditable, reproducible, defensible under judge cross-examination; matches ACP/AP2's own explicit exclusion of "fraud modeling" as unsolved | Cannot catch novel fraud patterns a rule wasn't written for — mitigated by advisory-only anomaly scoring |
| D2 | SQLite (not PostgreSQL) for this build | PostgreSQL + Docker + EC2 (original spec) | Timeline (2 days left) dominates; SQLite WAL supports the append-only guarantee via app-level enforcement | Loses PostgreSQL's role-level REVOKE UPDATE/DELETE guarantee; documented as known limitation in BUILD_LOG |
| D3 | Streamlit (not React) dashboard | React + Vite + SSE (original spec) | Source spec's own contingency plan for a solo build; eliminates a second toolchain and cross-origin/streaming risk under time pressure | Less polished real-time UX; acceptable because judges evaluate decision logic, not frontend polish |
| D4 | **Groq/Llama-3.3-70b-versatile confirmed as LLM provider** (NOT Claude/Anthropic) | Anthropic Claude (Blueprint §7.1 override — rejected); Groq/Llama (Master §14 original choice — confirmed) | Groq free tier: $0 cost, 30 req/min on 70B model, sufficient for 50-100 request demo run. Strong function-calling support for structured BoundedIntent extraction. The Blueprint's Claude recommendation is rejected. The code sample inconsistency in Master §9 (which accidentally used Anthropic SDK syntax) was a copy-paste error and does not change the provider decision. | Groq's free-tier rate limit (30 req/min) requires pacing the scenario generator — use `--delay 2` flag. Fallback model: `mixtral-8x7b-32768` (60 req/min). |
| D5 | SHA-256 hash-chain audit log, not ECDSA signing | Full PKI/ECDSA signing (AP2/AgentPay-style) | Matches the property this project needs to prove (internal consistency, independently verifiable) at minimal cost; differentiates from the mandate-signing approach already demonstrated by a competing submission | Does not prove authorship non-repudiation the way signed mandates do — acceptable, out of scope per P8/anti-goals |
| D6 | Six scripted adversarial scenarios in the demo, not three | Ship only the three scenarios in the source spec's §28 demo flow | Adversarial breadth is the cheapest, highest-leverage differentiator against the AgentPay competitor's single-scenario demo | Slightly longer demo; trim happy-path beat, not adversarial beats, to stay near 5 minutes |
| D7 | Explicit "protocol-agnostic policy layer, not a fifth protocol" framing in the pitch | Silence on protocol positioning (source spec's original framing) | Directly pre-empts the most likely judge question, now that a public UAP-branded competitor exists in the same track | None — this is a sentence, not an engineering cost |

---

## D4 Detail — Groq/Llama Confirmed

**Date:** 2026-09-03  
**Decision-maker:** Project author  
**Status:** LOCKED — do not re-open

**Model configuration:**
```
Primary (intent parsing):  llama-3.3-70b-versatile  (GROQ_MODEL_INTENT)
Secondary (block explain):  llama-3.1-8b-instant     (GROQ_MODEL_EXPLAIN)
Fallback (if rate-limited): mixtral-8x7b-32768       (GROQ_MODEL_FALLBACK)
```

**Environment variables:**
```bash
GROQ_API_KEY=gsk_...
GROQ_MODEL_INTENT=llama-3.3-70b-versatile
GROQ_MODEL_EXPLAIN=llama-3.1-8b-instant
GROQ_MODEL_FALLBACK=mixtral-8x7b-32768
# DO NOT SET: ANTHROPIC_API_KEY — not used in this project
```

**Why not Claude (Blueprint §7.1 recommendation):**
1. Free tier cost: Groq = $0. Claude = paid API.
2. Rate limits: Groq 70B = 30 req/min, sufficient for demo. No payment needed.
3. The Master spec (§14) already specified Groq — this restores the original decision.
4. The Blueprint's Claude recommendation was based on resolving a perceived inconsistency. That inconsistency was a copy-paste error in §9's code sample, not a real design decision.

---

## D2 Detail — SQLite Trade-off (append-only enforcement)

**Known limitation (must state in BUILD_LOG and README):**

SQLite does not support role-level `REVOKE UPDATE/DELETE` the way PostgreSQL does. Append-only guarantee on `audit_log` and `cart_snapshots` tables is enforced in **application code only**:
- No `UPDATE` or `DELETE` statement is written anywhere in `agentguard/core/audit_log.py` or `agentguard/core/cart_verifier.py`
- Code review can verify this: `grep -rn "UPDATE\|DELETE" agentguard/core/audit_log.py` must return zero matches

This is a documented, deliberate trade-off — not a shortcut. The mitigation is the hash-chain verification itself: any bypass of the application-level guard would be detected by `verify_audit_chain.py`.

---

## Open Questions (from Master §32)

| # | Question | Status |
|---|---|---|
| OQ1 | Where exactly is the protocol adapter boundary? Does AgentGuard receive a raw NL string, an ACP JSON payload, or an AP2 signed mandate? | Resolved for MVP: raw NL string only. ACP/AP2 adapters are post-MVP (see roadmap.md). |
| OQ2 | What is the UX for human confirmation flow when requires_human_confirmation_above is triggered? | Resolved for MVP: treated as a block. No async confirmation flow. User must submit a separate authorized request under the threshold. |
| OQ3 | How large can the merchant catalog be before hash computation becomes the bottleneck? | Not a concern for demo: catalog is 12 SKUs. Hash computation < 1ms for catalogs up to 1,000 items (per spec). |

---

## Reserved Space for Implementation-Time Decisions

*(Add decisions here as they are made during the build)*

| Date | # | Decision | Reason |
|---|---|---|---|
| 2026-09-03 | D2 | SQLite + WAL mode selected | 2-day timeline |
| 2026-09-03 | D3 | Streamlit selected | 2-day timeline, no second toolchain |
| 2026-09-03 | D4 | Groq/Llama-3.3-70b confirmed | Free tier, original Master spec decision |
| | D8 | | |

---

*Extracted from: `Docs/AgentGuard_Master_Blueprint.md` §8 (verbatim) + `Master_AgentGuard.md` §32 (open questions)*
*Supersedes: Blueprint §8 Decision Log — this file is the single source of truth for design decisions.*
