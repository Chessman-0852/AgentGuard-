# Phase 7 — Streamlit Dashboard

> **Status:** [ ] Not started
> **Estimated time:** 2.5 hours
> **Day:** 2, second block
> **Depends on:** Phase 6 (API endpoints are live and returning data)

---

## Objective

Build the Streamlit dashboard that gives judges and merchants a real-time view of all decisions, block reasons, per-agent spend, and audit chain status. The dashboard must include a working "Verify Chain" button that runs the verification and displays the result — this is a demo beat.

---

## Scope

- `dashboard/app.py` — complete Streamlit application
- Five dashboard sections: Summary Cards, Live Request Feed, Block Reason Chart, Per-Agent Spend Tracker, Audit Log Viewer + Verify Chain button

---

## Design Decisions & Rationale

| Decision | Choice | Rationale |
|---|---|---|
| Streamlit over React | Streamlit | Blueprint D3: eliminates second toolchain, SSE complexity, cross-origin issues under 2-day timeline |
| Direct SQLite reads | Dashboard reads from agentguard.db directly (not via FastAPI) | Avoids HTTP overhead; Streamlit and FastAPI share the SQLite file; WAL mode allows concurrent reads |
| Auto-refresh | `st.rerun()` with `time.sleep(3)` in a loop | Provides live-like feed without WebSocket or SSE; sufficient for demo |
| Verify Chain button | Calls `subprocess.run([sys.executable, 'scripts/verify_audit_chain.py'])` | Runs the same script a judge would run from the CLI; proves the script works, not just the UI |
| Color coding | Green = allowed, Red = blocked, Yellow = flagged/pending | Matches the design spec from Master_AgentGuard.md §11 |

---

## Sequential Implementation Tasks

### Task 7.1 — dashboard/app.py

```python
# dashboard/app.py
"""
AgentGuard — Streamlit Dashboard
Reads directly from SQLite for low-latency updates.
Auto-refreshes every 3 seconds.
"""
import json
import os
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timedelta

import streamlit as st
import pandas as pd

# -----------------------------------------------------------------------
# Page configuration
# -----------------------------------------------------------------------
st.set_page_config(
    page_title="AgentGuard — Policy Gateway",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

DB_PATH = os.environ.get("DATABASE_URL", "sqlite:///./agentguard.db").replace("sqlite:///", "")
VERIFY_SCRIPT = os.path.join(os.path.dirname(__file__), "..", "scripts", "verify_audit_chain.py")

# -----------------------------------------------------------------------
# Database helpers (direct SQLite — read-only access)
# -----------------------------------------------------------------------

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def load_audit_entries(limit: int = 200) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT entry_id, agent_id, timestamp, payload, final_decision, block_reason "
            "FROM audit_log ORDER BY entry_id DESC LIMIT ?", (limit,)
        ).fetchall()
    entries = []
    for row in rows:
        payload = json.loads(row["payload"])
        entries.append({
            "entry_id": row["entry_id"],
            "agent_id": row["agent_id"],
            "timestamp": row["timestamp"],
            "final_decision": row["final_decision"],
            "block_reason": row["block_reason"] or "",
            "category": payload.get("bounded_intent", {}).get("category", ""),
            "amount_inr": payload.get("bounded_intent", {}).get("max_amount_paise", 0) / 100,
            "raw_input": payload.get("raw_input", "")[:80],
        })
    return entries


def load_agent_spend() -> list[dict]:
    today = datetime.utcnow().date().isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT agent_id, daily_spend_paise, request_count_today "
            "FROM agent_state WHERE date=?", (today,)
        ).fetchall()
    return [{"agent_id": r["agent_id"], "spend_paise": r["daily_spend_paise"],
             "spend_inr": r["daily_spend_paise"] / 100, "requests": r["request_count_today"]}
            for r in rows]


def run_chain_verification() -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, VERIFY_SCRIPT, "--db", DB_PATH],
        capture_output=True, text=True, timeout=30
    )
    output = result.stdout + result.stderr
    return result.returncode == 0, output.strip()


# -----------------------------------------------------------------------
# Dashboard layout
# -----------------------------------------------------------------------

st.title("🛡️ AgentGuard — Agentic Commerce Policy Gateway")
st.caption("LLM explains. Policy engine decides. Every decision is audited.")
st.divider()

# Auto-refresh toggle
col_refresh, col_spacer = st.columns([1, 5])
with col_refresh:
    auto_refresh = st.toggle("Auto-refresh (3s)", value=True)

# -----------------------------------------------------------------------
# Section 1: Summary Cards
# -----------------------------------------------------------------------
entries = load_audit_entries()
total = len(entries)
allowed = sum(1 for e in entries if e["final_decision"] == "allowed")
blocked = total - allowed
block_rate = (blocked / total * 100) if total > 0 else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Total Requests", total)
col2.metric("Allowed", allowed, delta=None)
col3.metric("Blocked", blocked, delta=None)
col4.metric("Block Rate", f"{block_rate:.1f}%")

st.divider()

# -----------------------------------------------------------------------
# Section 2: Live Request Feed + Block Reason Chart
# -----------------------------------------------------------------------
col_feed, col_chart = st.columns([3, 2])

with col_feed:
    st.subheader("📡 Live Request Feed")
    if entries:
        df = pd.DataFrame(entries[:50])
        df["status"] = df["final_decision"].apply(
            lambda x: "✅ ALLOWED" if x == "allowed" else "❌ BLOCKED"
        )
        df["amount"] = df["amount_inr"].apply(lambda x: f"₹{x:,.0f}")
        display_df = df[["status", "agent_id", "amount", "category", "block_reason", "timestamp"]].copy()
        display_df.columns = ["Status", "Agent", "Amount", "Category", "Block Reason", "Time"]
        st.dataframe(
            display_df,
            use_container_width=True,
            height=300,
        )
    else:
        st.info("No requests yet. Run the scenario generator to populate the feed.")

with col_chart:
    st.subheader("🚫 Block Reasons")
    blocked_entries = [e for e in entries if e["final_decision"] == "blocked" and e["block_reason"]]
    if blocked_entries:
        reason_counts = {}
        for e in blocked_entries:
            reason = e["block_reason"].replace("_", " ").title()
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        reason_df = pd.DataFrame(list(reason_counts.items()), columns=["Reason", "Count"])
        reason_df = reason_df.sort_values("Count", ascending=False)
        st.bar_chart(reason_df.set_index("Reason"))
    else:
        st.info("No blocked requests yet.")

st.divider()

# -----------------------------------------------------------------------
# Section 3: Per-Agent Spend Tracker
# -----------------------------------------------------------------------
st.subheader("💰 Per-Agent Spend vs. Daily Cap")
agent_spends = load_agent_spend()

# Get daily cap from policy
try:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from agentguard.config import get_policy
    policy = get_policy()
    daily_cap_inr = policy.max_daily_spend_per_agent_paise / 100
except Exception:
    daily_cap_inr = 15000

if agent_spends:
    for agent in agent_spends:
        pct = min(agent["spend_inr"] / daily_cap_inr, 1.0)
        col_agent, col_bar, col_val = st.columns([2, 5, 2])
        with col_agent:
            st.write(agent["agent_id"])
        with col_bar:
            st.progress(pct)
        with col_val:
            st.write(f"₹{agent['spend_inr']:,.0f} / ₹{daily_cap_inr:,.0f}")
else:
    st.info("No agent spend data yet.")

st.divider()

# -----------------------------------------------------------------------
# Section 4: Audit Log Viewer + Verify Chain
# -----------------------------------------------------------------------
col_audit_title, col_verify_btn = st.columns([4, 1])
with col_audit_title:
    st.subheader("🔗 Audit Chain")
with col_verify_btn:
    verify_clicked = st.button("🔍 Verify Chain", type="primary")

if verify_clicked:
    with st.spinner("Running verify_audit_chain.py..."):
        intact, output = run_chain_verification()
    if intact:
        st.success(f"✅ {output}")
    else:
        st.error(f"❌ {output}")

# Audit log table
if entries:
    audit_display = [
        {
            "ID": e["entry_id"],
            "Decision": "✅" if e["final_decision"] == "allowed" else "❌",
            "Agent": e["agent_id"],
            "Category": e["category"],
            "Amount (₹)": f"{e['amount_inr']:,.0f}",
            "Block Reason": e["block_reason"] or "—",
            "Time": e["timestamp"][:19],
        }
        for e in entries[:30]
    ]
    st.dataframe(pd.DataFrame(audit_display), use_container_width=True, height=250)

# -----------------------------------------------------------------------
# Section 5: Request Detail (click-to-expand via selectbox)
# -----------------------------------------------------------------------
st.divider()
st.subheader("🔎 Request Detail")
if entries:
    entry_ids = [f"ID {e['entry_id']} — {e['final_decision'].upper()} — {e['raw_input'][:60]}" for e in entries[:20]]
    selected = st.selectbox("Select a request to inspect:", entry_ids)
    selected_idx = entry_ids.index(selected)
    selected_entry = entries[selected_idx]
    with get_connection() as conn:
        row = conn.execute(
            "SELECT payload FROM audit_log WHERE entry_id=?", (selected_entry["entry_id"],)
        ).fetchone()
    if row:
        payload = json.loads(row["payload"])
        st.json(payload)

# -----------------------------------------------------------------------
# Auto-refresh
# -----------------------------------------------------------------------
if auto_refresh:
    time.sleep(3)
    st.rerun()
```

---

## Running the Dashboard

```bash
# From the project root, with .env loaded:
streamlit run dashboard/app.py --server.port 8501

# Dashboard will be available at: http://localhost:8501
```

---

## Validation Strategy

1. Start the FastAPI server: `uvicorn agentguard.api.main:app --port 8000`
2. Run 3-5 scenario requests via the scenario generator (Phase 8 script, run early)
3. Open `http://localhost:8501`
4. Verify:
   - Summary cards show correct total/allowed/blocked counts
   - Live feed shows recent requests with correct status badges
   - Block reason chart shows bars for each block reason
   - Agent spend progress bars show correct percentages
   - "Verify Chain" button runs and returns "Chain intact — N entries verified"
   - Request Detail shows the full payload for any selected request

---

## Acceptance Criteria

- [ ] `streamlit run dashboard/app.py` starts without error
- [ ] Dashboard loads at `http://localhost:8501` without exceptions
- [ ] Summary cards show correct counts after running 5 test scenarios
- [ ] An over-cap blocked request appears as "❌ BLOCKED" in the live feed with `block_reason="exceeds_transaction_cap"`
- [ ] Block reason chart shows bars (requires at least 1 blocked request)
- [ ] Per-agent spend tracker shows at least one agent with a non-zero progress bar
- [ ] "Verify Chain" button executes and displays the output of `verify_audit_chain.py`
- [ ] A chain of 5+ entries shows "Chain intact — N entries verified" in green
- [ ] Request Detail section shows full JSON payload for any selected entry
- [ ] Auto-refresh updates the feed every ~3 seconds (visually verify for 15 seconds)

---

## Risks & Trade-offs

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SQLite file locked by FastAPI during dashboard read | Low | Medium | SQLite WAL mode allows concurrent readers; no locking issue expected |
| Streamlit rerun causing UI flicker | Low | Low | Acceptable for demo; use st.empty() containers to reduce flicker if needed |
| subprocess.run for verify hangs | Very Low | Medium | timeout=30 parameter set; displays spinner during execution |
| Dashboard and FastAPI not sharing same DB file | Medium | High | Both use DATABASE_URL env var; ensure .env is loaded for both processes |

---

## Deliverables

- `dashboard/app.py` (complete Streamlit application)

---

## Documentation Updates

- `BUILD_LOG.md`: Note that Streamlit reads SQLite directly — document this as the intentional architecture choice (not a workaround).
- `README.md`: Add "Running the Dashboard" section with the `streamlit run` command.
