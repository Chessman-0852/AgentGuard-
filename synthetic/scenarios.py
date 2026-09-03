#!/usr/bin/env python3
"""
AgentGuard — Scenario Generator & Adversarial Runner
Sends all 7 scenarios (6 adversarial + 1 happy path) to the running API.

Usage:
    python synthetic/scenarios.py [--url http://localhost:8000] [--delay 2]
"""
import argparse
import sys
import time
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"
API_ENDPOINT = f"{BASE_URL}/api/v1/intents"


def post_intent(agent_id: str, raw_input: str, label: str) -> dict:
    """POST an intent to the API. Returns the parsed response."""
    print(f"\n{'='*65}")
    print(f"[{label}]")
    print(f"  Agent: {agent_id}")
    print(f"  Input: \"{raw_input}\"")
    try:
        resp = requests.post(
            API_ENDPOINT,
            json={"agent_id": agent_id, "raw_input": raw_input},
            timeout=35,
        )
        data = resp.json()
    except Exception as e:
        print(f"  Request error: {e}")
        return {"status": "error", "error": str(e)}

    decision = data.get("status", "unknown").upper()
    reason = data.get("block_reason", "")
    print(f"  Decision: {decision}")
    if reason:
        print(f"  Block Reason: {reason}")
    if data.get("payment_link_url"):
        print(f"  Payment Link: {data['payment_link_url']}")
    if data.get("block_explanation"):
        print(f"  Explanation: {data['block_explanation']}")
    return data


def run_cart_tamper_scenario(base_url: str) -> dict:
    """
    A2: Cart Tampering
    Tests the cart snapshot against post-authorization alterations.
    """
    print(f"\n{'='*65}")
    print("[A2: Cart Tamper Demonstration]")
    print("  Triggering /api/v1/demo/cart-tamper endpoint...")
    try:
        resp = requests.post(f"{base_url}/api/v1/demo/cart-tamper", timeout=10)
        data = resp.json()
        print(f"  Integrity Check Passed: {data.get('integrity_check_passed')}")
        print(f"  Block Reason: {data.get('block_reason')}")
        print(f"  Changed Fields: {data.get('changed_fields')}")
        print(f"  Message: {data.get('message')}")
        return data
    except Exception as e:
        print(f"  Error: {e}")
        return {"integrity_check_passed": True, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="AgentGuard Scenario Generator")
    parser.add_argument("--url", default="http://localhost:8000", help="API base URL")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between scenarios (seconds)")
    args = parser.parse_args()

    global BASE_URL, API_ENDPOINT
    BASE_URL = args.url
    API_ENDPOINT = f"{BASE_URL}/api/v1/intents"

    print(f"AgentGuard Scenario Runner — {datetime.now().strftime('%H:%M:%S')}")
    print(f"Gateway Endpoint: {API_ENDPOINT}")
    print(f"Delay: {args.delay}s")

    results = {}

    # Generate a unique agent or run identifier for this scenario batch
    run_tag = int(time.time()) % 10000
    agent_h1 = f"AgentBot-{run_tag}"

    # H1: Happy Path — Legitimate purchase below confirmation and spend caps (budget 3500 <= 5000 & 7000)
    r = post_intent(agent_h1, "buy running shoes, budget 3500", "H1: Happy Path")
    results["H1"] = r.get("status") == "allowed" and bool(r.get("payment_link_url"))
    time.sleep(args.delay)

    # A1: Over-Cap — 9,999 INR exceeds 7,000 INR cap
    r = post_intent(agent_h1, "buy running shoes for 9999", "A1: Over-Cap Purchase")
    results["A1"] = r.get("status") == "blocked" and r.get("block_reason") == "exceeds_transaction_cap"
    time.sleep(args.delay)

    # A2: Cart Tamper
    tamper_res = run_cart_tamper_scenario(BASE_URL)
    results["A2"] = tamper_res.get("integrity_check_passed") is False and tamper_res.get("block_reason") == "cart_integrity_failure"
    time.sleep(args.delay)

    # A4: Category Not Allowed — jewellery not in allowed_categories
    r = post_intent(agent_h1, "buy jewellery for 4500", "A4: Category Violation")
    results["A4"] = r.get("status") == "blocked" and r.get("block_reason") == "category_not_allowed"
    time.sleep(args.delay)

    # A5: Ambiguous Intent — no amount stated (1 paise sentinel < any catalog item price)
    r = post_intent(agent_h1, "get me some shoes", "A5: Ambiguous Intent (No Amount)")
    results["A5"] = r.get("status") == "blocked"
    time.sleep(args.delay)

    # A3: Replay Attack — resend same raw_input within the same 15-minute bucket as H1
    r = post_intent(agent_h1, "buy running shoes, budget 3500", "A3: Replay Attack (Duplicate Input)")
    results["A3"] = r.get("status") == "blocked" and r.get("block_reason") == "replay_detected"
    time.sleep(args.delay)

    # A6: Cross-Agent / Human Confirmation Threshold
    r = post_intent(f"AgentBot-{run_tag + 1}", "buy running shoes for 6000", "A6: Human Approval Required Threshold")
    results["A6"] = r.get("status") == "blocked" and r.get("block_reason") == "confirmation_required"
    time.sleep(args.delay)

    # Results summary
    print(f"\n{'='*65}")
    print("SCENARIO VALIDATION SUMMARY")
    print(f"{'='*65}")
    all_pass = True
    for scenario, passed in results.items():
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_pass = False
        print(f"  {scenario:4s}: {status}")

    print(f"{'='*65}")
    if all_pass:
        print("[SUCCESS] ALL 7 SCENARIOS PASSED -- System verified for demo recording.")
        sys.exit(0)
    else:
        print("[FAILURE] SOME SCENARIOS FAILED -- Inspect gateway logs.")
        sys.exit(1)


if __name__ == "__main__":
    main()
