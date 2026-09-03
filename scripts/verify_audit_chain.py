#!/usr/bin/env python3
"""
AgentGuard — Standalone Audit Chain Verification Script

Usage:
    python scripts/verify_audit_chain.py
    python scripts/verify_audit_chain.py --db /path/to/agentguard.db

This script has NO dependency on FastAPI, Groq, or Razorpay.
It requires only Python standard library + sqlite3.
A judge can run this with: python scripts/verify_audit_chain.py
"""
import argparse
import hashlib
import json
import sqlite3
import sys

GENESIS_HASH = "GENESIS"


def compute_entry_hash(payload_str: str, prev_hash: str) -> str:
    """
    Re-derive entry hash from the stored payload string and prev_hash.
    MUST use identical parameters to the write path in audit_log.py:
      json.dumps(..., sort_keys=True, ensure_ascii=True, default=str)
    """
    # Re-serialise with identical parameters to the write path
    payload_dict = json.loads(payload_str)
    canonical_payload = json.dumps(payload_dict, sort_keys=True, ensure_ascii=True, default=str)
    raw = (canonical_payload + prev_hash).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def verify_chain(db_path: str) -> tuple[bool, int, str]:
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT entry_id, prev_hash, entry_hash, payload FROM audit_log ORDER BY entry_id ASC"
        )
        rows = cursor.fetchall()
        conn.close()
    except sqlite3.OperationalError as e:
        return False, 0, f"Database error: {e}"

    if not rows:
        return True, 0, "Chain intact — 0 entries (empty log)"

    prev_hash = GENESIS_HASH
    for i, row in enumerate(rows):
        entry_id = row["entry_id"]
        stored_prev = row["prev_hash"]
        stored_hash = row["entry_hash"]
        payload_str = row["payload"]

        if stored_prev != prev_hash:
            return False, i, (
                f"Chain BROKEN at entry index {i} (entry_id={entry_id})\n"
                f"  Expected prev_hash: {prev_hash[:16]}...\n"
                f"  Stored  prev_hash:  {stored_prev[:16]}..."
            )

        computed = compute_entry_hash(payload_str, stored_prev)

        if computed != stored_hash:
            return False, i, (
                f"Chain BROKEN at entry index {i} (entry_id={entry_id})\n"
                f"  Computed hash: {computed[:16]}...\n"
                f"  Stored   hash: {stored_hash[:16]}..."
            )

        prev_hash = stored_hash

    return True, len(rows), f"Chain intact — {len(rows)} entries verified"


def main():
    parser = argparse.ArgumentParser(description="Verify AgentGuard audit chain integrity")
    parser.add_argument("--db", default="agentguard.db", help="Path to SQLite database file")
    args = parser.parse_args()

    print(f"Verifying audit chain in: {args.db}")
    print("-" * 60)

    intact, count, message = verify_chain(args.db)

    if intact:
        print(f"[PASS] {message}")
        sys.exit(0)
    else:
        print(f"[FAIL] {message}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
