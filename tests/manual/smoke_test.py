import json
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000"


def post(path, body):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())


print("=== 1. Health check ===")
h = get("/health")
print(h)
assert h["status"] == "ok"

print("\n=== 2. Policy view ===")
p = get("/api/v1/policy")
print(json.dumps(p, indent=2))

print("\n=== 3. Blocked: category not allowed ===")
r = post("/api/v1/intents", {"agent_id": "AgentBot-001", "raw_input": "buy jewellery for 5000"})
print(json.dumps(r, indent=2))
assert r["status"] == "blocked", f"Expected blocked, got: {r}"
print(f"Block reason: {r.get('block_reason')}")

print("\n=== 4. Blocked: over transaction cap ===")
r = post("/api/v1/intents", {"agent_id": "AgentBot-001", "raw_input": "buy running shoes for 9999"})
print(json.dumps(r, indent=2))
assert r["status"] == "blocked", f"Expected blocked, got: {r}"

print("\n=== 5. ALLOWED: happy path (budget 3500 INR — under both caps) ===")
r = post("/api/v1/intents", {"agent_id": "AgentBot-001", "raw_input": "buy running shoes, budget 3500"})
print(json.dumps(r, indent=2))
assert r["status"] == "allowed", f"Expected allowed, got: {r}"
assert r.get("payment_link_url"), "Expected payment_link_url to be present"

print("\n=== 6. Audit log ===")
a = get("/api/v1/audit")
count = a["count"]
print(f"Total audit entries: {count}")
assert count >= 3, f"Expected >= 3 audit entries, got {count}"

print("\n=== 7. Verify audit chain ===")
v = post("/api/v1/audit/verify", {})
print(json.dumps(v, indent=2))
assert v["intact"] is True, f"Chain broken: {v}"

print("\n=== 8. Webhook invalid signature returns 400 ===")
req = urllib.request.Request(
    BASE + "/webhooks/razorpay",
    data=b'{"event":"payment.captured"}',
    headers={"Content-Type": "application/json", "X-Razorpay-Signature": "badsig"},
    method="POST",
)
try:
    urllib.request.urlopen(req)
    print("FAIL: should have raised 400")
    sys.exit(1)
except urllib.error.HTTPError as e:
    assert e.code == 400, f"Expected 400, got {e.code}"
    print(f"PASS: webhook with invalid sig returned HTTP {e.code}")

print("\n=== ALL ACCEPTANCE CRITERIA PASSED ===")
