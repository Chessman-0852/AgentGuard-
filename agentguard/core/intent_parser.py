# agentguard/core/intent_parser.py
"""
Groq/Llama-3.3-70b-versatile intent parser.
Transforms natural-language purchase requests into validated BoundedIntent objects.

LLM BOUNDARY: This is the ONLY place an LLM is called for intent extraction.
The LLM produces structured data. It NEVER decides allow/block.
"""
import hashlib
import json
import logging
import os
from datetime import datetime, timezone

from groq import Groq
from agentguard.models import BoundedIntent, MerchantConstraints

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# Groq client — lazy singleton
# --------------------------------------------------------------------------
_groq_client: Groq | None = None


def _get_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable not set")
        _groq_client = Groq(api_key=api_key)
    return _groq_client


# --------------------------------------------------------------------------
# Tool schema for Groq function-calling
# --------------------------------------------------------------------------
BOUNDED_INTENT_TOOL = {
    "type": "function",
    "function": {
        "name": "create_bounded_intent",
        "description": (
            "Create a structured bounded purchase intent from natural language. "
            "Extract the purchase category, maximum budget, and item description "
            "from the user's request."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": (
                        "Product category in lowercase. Use 'footwear' for shoes/boots, "
                        "'groceries' for food/nutrition, 'electronics-accessories' for "
                        "gadgets/tech accessories. If unclear, use the closest match."
                    ),
                },
                "item_description": {
                    "type": "string",
                    "description": "Human-readable description of what the user wants to buy.",
                },
                "max_amount_inr": {
                    "type": "number",
                    "description": (
                        "Maximum budget in Indian Rupees (INR). "
                        "NEVER guess. If no amount is stated, omit this field."
                    ),
                },
                "ttl_seconds": {
                    "type": "integer",
                    "description": "How long this intent should remain valid, in seconds. Default 3600.",
                    "default": 3600,
                },
                "allowed_merchant_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Optional list of merchant IDs the agent is restricted to. "
                        "Leave empty if not specified."
                    ),
                },
            },
            "required": ["category", "item_description"],
        },
    },
}

SYSTEM_PROMPT = """You are a purchase intent parser for AgentGuard, a payment security gateway.
Your ONLY job is to extract structured purchase intent from natural language.

Rules:
1. You MUST call the create_bounded_intent function. Never respond in plain text.
2. NEVER guess max_amount_inr if it is not stated. Omit the field entirely.
3. Normalize category to lowercase.
4. If the input is empty, nonsensical, or contains no purchase intent, still call the function but set item_description to describe the issue.
5. You are NOT deciding whether to approve the purchase. You are only extracting intent structure.
"""


class IntentParseError(Exception):
    """Raised when the LLM fails to produce a valid BoundedIntent."""
    pass


def _generate_idempotency_key(agent_id: str, intent: BoundedIntent) -> str:
    """
    Deterministic idempotency key.
    Formula: SHA-256(agent_id + category + item_description + max_amount_paise + 15min_bucket)
    Same request in the same 15-minute window produces the same key.
    """
    now = datetime.now(timezone.utc)
    bucket = (now.hour * 4) + (now.minute // 15)   # 0-95 — 15-minute window index
    bucket_str = f"{now.date().isoformat()}-{bucket}"
    raw = f"{agent_id}|{intent.category}|{intent.item_description}|{intent.max_amount_paise}|{bucket_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_intent(raw_input: str, agent_id: str) -> BoundedIntent:
    """
    Call Groq, extract BoundedIntent, validate with Pydantic, generate idempotency key.
    Raises IntentParseError on any failure — caller should return HTTP 422.

    Args:
        raw_input: Natural language purchase request from the AI buyer.
        agent_id: Identifier of the requesting agent.

    Returns:
        Validated BoundedIntent with idempotency_key set.
    """
    if not raw_input or not raw_input.strip():
        raise IntentParseError("raw_input is empty")

    model = os.environ.get("GROQ_MODEL_INTENT", "llama-3.3-70b-versatile")
    fallback_model = os.environ.get("GROQ_MODEL_FALLBACK", "mixtral-8x7b-32768")

    response = None
    for attempt, model_name in enumerate([model, fallback_model]):
        try:
            response = _get_client().chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": raw_input},
                ],
                tools=[BOUNDED_INTENT_TOOL],
                tool_choice={"type": "function", "function": {"name": "create_bounded_intent"}},
                temperature=0,
                max_tokens=512,
            )
            break   # success — exit retry loop
        except Exception as e:
            if attempt == 0:
                logger.warning(f"Primary model {model_name} failed ({e}); trying fallback")
                continue
            raise IntentParseError(f"All models failed: {e}") from e

    if response is None:
        raise IntentParseError("No response from any model")

    # Extract tool call arguments
    message = response.choices[0].message
    if not message.tool_calls:
        raise IntentParseError("LLM did not call the create_bounded_intent tool")

    try:
        args = json.loads(message.tool_calls[0].function.arguments)
    except json.JSONDecodeError as e:
        raise IntentParseError(f"LLM returned malformed JSON: {e}")

    # Convert INR → paise immediately; all downstream code uses paise
    max_amount_inr = args.get("max_amount_inr")
    if max_amount_inr is None:
        # No amount stated — use 1 paise as sentinel; policy engine will block on any real item
        max_amount_paise = 1
        logger.info(f"No amount stated in intent: '{raw_input[:50]}'")
    else:
        max_amount_paise = int(round(float(max_amount_inr) * 100))
        if max_amount_paise <= 0:
            raise IntentParseError(f"Invalid amount extracted: {max_amount_inr} INR")

    merchant_constraints = MerchantConstraints(
        allowed_merchant_ids=args.get("allowed_merchant_ids", [])
    )

    try:
        intent = BoundedIntent(
            agent_id=agent_id,
            category=args.get("category", "unknown"),
            item_description=args.get("item_description", ""),
            max_amount_paise=max_amount_paise,
            merchant_constraints=merchant_constraints,
            ttl_seconds=int(args.get("ttl_seconds", 3600)),
            raw_input=raw_input,
        )
    except Exception as e:
        raise IntentParseError(f"Pydantic validation failed: {e}") from e

    intent.idempotency_key = _generate_idempotency_key(agent_id, intent)
    logger.info(
        f"Intent parsed: category={intent.category}, "
        f"amount={intent.max_amount_paise}p, "
        f"key={intent.idempotency_key[:16]}..."
    )
    return intent


# --------------------------------------------------------------------------
# Block explainer — cosmetic only, runs POST-decision
# --------------------------------------------------------------------------
EXPLAIN_SYSTEM_PROMPT = """You are a clear, concise payment policy explainer.
Given a blocked purchase request and the reason it was blocked, write 1-2 sentences
explaining to the AI buyer why the purchase was rejected. Be specific about the rule that was violated.
Do NOT suggest workarounds. Do NOT use technical jargon."""


def explain_block(raw_input: str, block_reason: str, rule_triggered: str | None) -> str:
    """
    Generate a human-readable explanation of why a request was blocked.
    Uses llama-3.1-8b-instant for low latency (~100ms).
    COSMETIC ONLY — this result is NEVER used to make allow/block decisions.
    Returns empty string on any error (block explanation failure must never affect the system).
    """
    model = os.environ.get("GROQ_MODEL_EXPLAIN", "llama-3.1-8b-instant")
    prompt = (
        f"Purchase request: \"{raw_input}\"\n"
        f"Block reason code: {block_reason}\n"
        f"Rule violated: {rule_triggered or 'policy rule'}\n\n"
        "Explain in 1-2 plain sentences why this purchase was rejected."
    )
    try:
        response = _get_client().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": EXPLAIN_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Block explanation failed (non-critical): {e}")
        return ""
