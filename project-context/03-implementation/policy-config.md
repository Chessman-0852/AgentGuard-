# AgentGuard — Policy Configuration

> **Source:** `Master_AgentGuard.md` §9 Feature 2
> **Last updated:** 2026-09-03

---

## Overview

All merchant business rules live in `policy.yaml`. No code changes are needed to change limits.

The policy file is loaded at startup and hot-reloadable via SIGHUP (no restart required).

**Fail-closed behavior:** If `policy.yaml` is missing, unreadable, or malformed — ALL requests are blocked. The system never fails open.

---

## policy.yaml Reference

```yaml
# AgentGuard — Merchant Policy Configuration
# Edit this file to change purchase authorization rules.
# Hot-reload: kill -HUP <uvicorn-pid> (or restart the server on Windows)

# Maximum amount per single transaction (INR)
# Requests above this amount are blocked with reason: exceeds_transaction_cap
max_transaction_amount: 7000

# Maximum total spend per agent per day (INR)
# Calculated from payment.captured webhooks; blocked with reason: daily_spend_cap_exceeded
max_daily_spend_per_agent: 15000

# Requests above this amount require human confirmation (INR)
# For MVP: treated as a block (reason: human_confirmation_required)
# Post-MVP: trigger an async approval flow
requires_human_confirmation_above: 5000

# Product categories the AI buyer is allowed to purchase from
# Any category not in this list is blocked with reason: category_not_allowed
# Categories must match the parsed intent.category exactly (lowercase)
allowed_categories:
  - footwear
  - groceries
  - electronics-accessories

# Maximum requests per minute per agent (velocity control)
# Blocked with reason: velocity_limit_exceeded
max_requests_per_minute_per_agent: 5

# How long an idempotency key stays reserved before it expires (seconds)
# After expiry, the same intent can be re-submitted (replay window closed)
idempotency_key_ttl_seconds: 3600

# Emergency kill switch — set to true to block ALL purchases immediately
# Does NOT require a code deployment; takes effect on next SIGHUP reload
all_blocked: false
```

---

## Policy Rules — Implementation Detail

The policy engine evaluates rules in this fixed order. First failure wins.

| # | Rule | Field | Condition | Block Reason |
|---|---|---|---|---|
| 1 | Emergency block | `all_blocked` | if True | `emergency_block_all` |
| 2 | Transaction cap | `max_transaction_amount` | intent.max_amount_paise > cap_paise | `exceeds_transaction_cap` |
| 3 | Category allow-list | `allowed_categories` | intent.category not in list | `category_not_allowed` |
| 4 | Daily spend cap | `max_daily_spend_per_agent` | (daily_spend + amount) > cap_paise | `daily_spend_cap_exceeded` |
| 5 | Velocity limit | `max_requests_per_minute_per_agent` | requests in last 60s >= limit | `velocity_limit_exceeded` |
| 6 | Human confirmation | `requires_human_confirmation_above` | amount > threshold (MVP: block) | `human_confirmation_required` |

**Note on Rule 2 (Transaction Cap):** The comparison is `intent.max_amount_paise > policy_cap_paise`. A purchase exactly at the cap (`max_amount_paise == cap_paise`) is **allowed**. This is a boundary condition tested explicitly in `tests/unit/test_policy_engine.py`.

---

## SIGHUP Hot-Reload

```bash
# Find the uvicorn process ID
pgrep -f "uvicorn agentguard"

# Send reload signal
kill -HUP <pid>
```

Server log on successful reload:
```
INFO — Policy reloaded on SIGHUP: max_transaction_amount=500000p, categories=['footwear']
```

Server log on malformed file:
```
CRITICAL — policy.yaml reload failed: [parse error detail]. Keeping previous policy.
```

---

## Adding a New Category

1. Edit `policy.yaml` — add the new category to `allowed_categories`
2. Add matching SKUs to `synthetic/catalog.json`
3. Reload: `kill -HUP <uvicorn-pid>`

No code changes required.

---

## Demo Policy Configuration

The values shipped in `policy.yaml` are tuned for the demo:
- **7,000 INR cap** — allows standard footwear (3,500-7,000 INR) but blocks the "over-cap" scenario at 9,999 INR
- **3 categories** — enough to demonstrate "category not allowed" for watches, jewelry, etc.
- **5 req/min velocity** — low enough to demonstrate the velocity block with a rapid-fire script

---

*Extracted from: `Master_AgentGuard.md` §9 Feature 2. See `agentguard/config.py` for loader implementation.*
