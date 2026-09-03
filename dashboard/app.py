# dashboard/app.py
"""
AgentGuard — Streamlit Security Dashboard

Reads directly from SQLite for low-latency, zero-HTTP-overhead updates.
Auto-refreshes every 3 seconds.
Run: streamlit run dashboard/app.py --server.port 8501
"""
import json
import os
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone

import pandas as pd
import streamlit as st

# -----------------------------------------------------------------------
# Page configuration
# -----------------------------------------------------------------------
st.set_page_config(
    page_title="AgentGuard — Policy Gateway",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Resolve DB path from env var (strips sqlite:/// prefix if present)
_raw_db = os.environ.get("DATABASE_URL", "sqlite:///./agentguard.db")
DB_PATH = _raw_db.replace("sqlite:///./", "").replace("sqlite:///", "")

VERIFY_SCRIPT = os.path.join(os.path.dirname(__file__), "..", "scripts", "verify_audit_chain.py")


# -----------------------------------------------------------------------
# Database helpers — direct SQLite read-only access
# WAL mode allows concurrent reads while FastAPI writes
# -----------------------------------------------------------------------

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def load_audit_entries(limit: int = 200) -> list[dict]:
    try:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT entry_id, agent_id, timestamp, payload, final_decision, block_reason "
                "FROM audit_log ORDER BY entry_id DESC LIMIT ?", (limit,)
            ).fetchall()
    except sqlite3.OperationalError:
        return []  # DB not yet initialized

    entries = []
    for row in rows:
        try:
            payload = json.loads(row["payload"])
        except Exception:
            payload = {}
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
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        with get_connection() as conn:
            rows = conn.execute(
                "SELECT agent_id, daily_spend_paise, request_count_today "
                "FROM agent_state WHERE date=?", (today,)
            ).fetchall()
    except sqlite3.OperationalError:
        return []
    return [
        {
            "agent_id": r["agent_id"],
            "spend_paise": r["daily_spend_paise"],
            "spend_inr": r["daily_spend_paise"] / 100,
            "requests": r["request_count_today"],
        }
        for r in rows
    ]


def run_chain_verification() -> tuple[bool, str]:
    """Invoke the standalone verify_audit_chain.py exactly as a judge would from CLI."""
    result = subprocess.run(
        [sys.executable, VERIFY_SCRIPT, "--db", DB_PATH],
        capture_output=True, text=True, timeout=30
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode == 0, output


def get_daily_cap_inr() -> float:
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from agentguard.config import get_policy
        return get_policy().max_daily_spend_per_agent_paise / 100
    except Exception:
        return 15000.0


# -----------------------------------------------------------------------
# Dashboard layout
# -----------------------------------------------------------------------

st.title("🛡️ AgentGuard — Agentic Commerce Policy Gateway")
st.caption("LLM explains. Policy engine decides. Every decision is hash-chained and audited.")
st.divider()

# Auto-refresh toggle
col_refresh, col_spacer = st.columns([1, 5])
with col_refresh:
    auto_refresh = st.toggle("Auto-refresh (3s)", value=True, key="auto_refresh")

# -----------------------------------------------------------------------
# Section 1: Summary Cards
# -----------------------------------------------------------------------
entries = load_audit_entries()
total = len(entries)
allowed = sum(1 for e in entries if e["final_decision"] == "allowed")
blocked = total - allowed
block_rate = (blocked / total * 100) if total > 0 else 0.0

col1, col2, col3, col4 = st.columns(4)
col1.metric("📊 Total Requests", total)
col2.metric("✅ Allowed", allowed)
col3.metric("❌ Blocked", blocked)
col4.metric("🚫 Block Rate", f"{block_rate:.1f}%")

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
        st.dataframe(display_df, use_container_width=True, height=300)
    else:
        st.info("No requests yet. Start the FastAPI server and send some requests.")

with col_chart:
    st.subheader("🚫 Block Reasons")
    blocked_entries = [e for e in entries if e["final_decision"] == "blocked" and e["block_reason"]]
    if blocked_entries:
        reason_counts: dict[str, int] = {}
        for e in blocked_entries:
            reason = e["block_reason"].replace("_", " ").title()
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
        reason_df = pd.DataFrame(
            list(reason_counts.items()), columns=["Reason", "Count"]
        ).sort_values("Count", ascending=False)
        st.bar_chart(reason_df.set_index("Reason"))
    else:
        st.info("No blocked requests yet.")

st.divider()

# -----------------------------------------------------------------------
# Section 3: Per-Agent Spend Tracker
# -----------------------------------------------------------------------
st.subheader("💰 Per-Agent Spend vs. Daily Cap")
agent_spends = load_agent_spend()
daily_cap_inr = get_daily_cap_inr()

if agent_spends:
    for agent in agent_spends:
        pct = min(agent["spend_inr"] / daily_cap_inr, 1.0)
        col_agent, col_bar, col_val = st.columns([2, 5, 2])
        with col_agent:
            st.write(f"**{agent['agent_id']}**")
        with col_bar:
            color = "red" if pct > 0.8 else "normal"
            st.progress(pct)
        with col_val:
            st.write(f"₹{agent['spend_inr']:,.0f} / ₹{daily_cap_inr:,.0f}")
else:
    st.info("No agent spend data yet. Spend is recorded after payment.captured webhook.")

st.divider()

# -----------------------------------------------------------------------
# Section 4: Audit Chain Viewer + Verify Chain Button
# -----------------------------------------------------------------------
col_audit_title, col_verify_btn = st.columns([4, 1])
with col_audit_title:
    st.subheader("🔗 Audit Chain")
with col_verify_btn:
    verify_clicked = st.button("🔍 Verify Chain", type="primary", key="verify_btn")

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
# Section 5: Request Detail Inspector
# -----------------------------------------------------------------------
st.divider()
st.subheader("🔎 Request Detail Inspector")
if entries:
    entry_ids = [
        f"ID {e['entry_id']} — {e['final_decision'].upper()} — {e['raw_input'][:60]}"
        for e in entries[:20]
    ]
    selected = st.selectbox("Select a request to inspect:", entry_ids, key="detail_select")
    selected_idx = entry_ids.index(selected)
    selected_entry = entries[selected_idx]
    try:
        with get_connection() as conn:
            row = conn.execute(
                "SELECT payload FROM audit_log WHERE entry_id=?",
                (selected_entry["entry_id"],)
            ).fetchone()
        if row:
            st.json(json.loads(row["payload"]))
    except Exception as e:
        st.error(f"Error loading detail: {e}")

# -----------------------------------------------------------------------
# Auto-refresh
# -----------------------------------------------------------------------
if auto_refresh:
    time.sleep(3)
    st.rerun()
