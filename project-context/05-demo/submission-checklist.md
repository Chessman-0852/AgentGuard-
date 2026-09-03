# AgentGuard — Submission Checklist

> **Source:** `Master_AgentGuard.md` Appendix B + `Docs/AgentGuard_Master_Blueprint.md` §15
> **Last updated:** 2026-09-03
> **Deadline:** September 5, 2026

---

## Repository

- [ ] Public GitHub repository
- [ ] `README.md` — setup instructions, architecture overview, 6 adversarial scenarios listed
- [ ] `policy.yaml` committed to repo root
- [ ] `.env.example` committed (`GROQ_API_KEY`, Razorpay test vars — NO `ANTHROPIC_API_KEY`)
- [ ] `.env` excluded by `.gitignore` — verify no real keys are committed
- [ ] `scripts/verify_audit_chain.py` — present and independently runnable (stdlib only, no pip)
- [ ] `BUILD_LOG.md` — real failures documented, D2/D3/D4 decisions in log
- [ ] `project-context/` directory committed — shows engineering rigor to judges
- [ ] `plans/` directory committed — shows full implementation planning

---

## Code

- [ ] No `ANTHROPIC_API_KEY` anywhere in committed code (confirmed via grep)
- [ ] LLM is NOT on the allow/block decision path (confirmed via code review)
- [ ] Audit log table has no `UPDATE` or `DELETE` in application code
  ```bash
  grep -rn "UPDATE\|DELETE" agentguard/core/audit_log.py
  # Must return zero matches
  grep -rn "UPDATE\|DELETE" agentguard/core/cart_verifier.py
  # Must return zero matches
  ```
- [ ] `RAZORPAY_KEY_ID` starts with `rzp_test_` enforced at startup
- [ ] `verify_audit_chain.py` has no `fastapi`, `groq`, or `razorpay` imports
  ```bash
  grep -n "import fastapi\|import groq\|import razorpay" scripts/verify_audit_chain.py
  # Must return zero matches
  ```

---

## Testing

- [ ] `pytest tests/unit/ -v` — all unit tests pass (no mocked failures)
- [ ] All 6 adversarial scenarios: **100% block rate**
  - [ ] A1: Over-cap (tested at 7001, 8000, 9999 INR)
  - [ ] A2: Cart tamper (POST /demo/cart-tamper returns integrity_check_passed=false)
  - [ ] A3: Replay (second identical request returns replay_detected)
  - [ ] A4: Category violation (luxury category returns category_not_allowed)
  - [ ] A5: Ambiguous intent (no-amount request blocked by policy)
  - [ ] A6: Cross-agent identity (cross-agent key reuse blocked)
- [ ] Legitimate purchases: **≥ 95% allow rate** (10 NL inputs tested, results in BUILD_LOG)
- [ ] Audit chain: **intact after full scenario run**
  ```bash
  python scripts/verify_audit_chain.py --db agentguard.db
  # [PASS] Chain intact — N entries verified
  ```
- [ ] Tamper detection: verified to catch corruption at correct index
  ```bash
  # Manually corrupt entry 5, run verify, confirm exit code 1 and "BROKEN at entry index 5"
  ```

---

## Demo Video

- [ ] Duration: **≤ 5 minutes**
- [ ] Leads with **blocked scenarios**, not the happy path
- [ ] Audit chain verification shown **on camera** against a batch that includes at least one blocked entry
- [ ] One-sentence differentiation stated verbatim in closing beat:
  > *"AgentPay-style systems prove a token was signed correctly. AgentGuard proves — to anyone, independently, after the fact — that the system's entire decision history is internally consistent and was applied the same way every time, including on the requests it blocked."*
- [ ] Streamlit dashboard visible at some point during recording
- [ ] Terminal output visible when running scenario commands

---

## Submission Form

- [ ] GitHub repository URL included
- [ ] Demo video link included
- [ ] Submitted **before September 5, 2026 deadline**

---

## Last-Minute Sanity Checks

Run immediately before submitting:

```bash
# 1. Verify no real API keys in committed code
git grep -n "gsk_" .        # Groq key — must return zero matches
git grep -n "rzp_live_" .   # Razorpay live key — must return zero matches

# 2. Verify the verification script is standalone
python scripts/verify_audit_chain.py --help
# Should print usage without any import errors

# 3. Fresh run of full scenario suite
rm agentguard.db
python -c "from agentguard.database import init_db; init_db()"
uvicorn agentguard.api.main:app --port 8000 &
sleep 2
python synthetic/scenarios.py
# Expected: "ALL SCENARIOS PASSED"

# 4. Final chain verify
python scripts/verify_audit_chain.py --db agentguard.db
# Expected: "[PASS] Chain intact"
```

---

*Merges: `Master_AgentGuard.md` Appendix B + `Docs/AgentGuard_Master_Blueprint.md` §15 Must Have.*
*Supersedes both — this is the single source of truth for submission requirements.*
