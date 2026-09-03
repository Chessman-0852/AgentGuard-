# agentguard/constants.py

GENESIS_HASH = "GENESIS"

# Intent lifecycle statuses
STATUS_PARSED = "parsed"
STATUS_POLICY_CHECK = "policy_check"
STATUS_CART_CHECK = "cart_check"
STATUS_RISK_CHECK = "risk_check"
STATUS_IDEMPOTENCY_CHECK = "idempotency_check"
STATUS_EXECUTING = "executing"
STATUS_COMPLETED = "completed"
STATUS_BLOCKED = "blocked"
STATUS_FAILED = "failed"

# Idempotency key statuses
IDEM_STATUS_PENDING = "pending"
IDEM_STATUS_EXECUTED = "executed"
IDEM_STATUS_FAILED = "failed"

# Block reason codes (deterministic, never from LLM)
BLOCK_EXCEEDS_TRANSACTION_CAP = "exceeds_transaction_cap"
BLOCK_DAILY_CAP_EXCEEDED = "daily_cap_exceeded"
BLOCK_CATEGORY_NOT_ALLOWED = "category_not_allowed"
BLOCK_CONFIRMATION_REQUIRED = "confirmation_required"
BLOCK_VELOCITY_EXCEEDED = "velocity_exceeded"
BLOCK_CART_INTEGRITY_FAILURE = "cart_integrity_failure"
BLOCK_REPLAY_DETECTED = "replay_detected"
BLOCK_INTENT_EXPIRED = "intent_expired"
BLOCK_POLICY_UNAVAILABLE = "policy_unavailable"
BLOCK_NO_CART_SNAPSHOT = "no_cart_snapshot"
BLOCK_CROSS_AGENT_IDENTITY = "cross_agent_identity_violation"

# Final decision values
DECISION_ALLOWED = "allowed"
DECISION_BLOCKED = "blocked"
