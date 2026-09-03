# agentguard/config.py
import signal
import logging
from dataclasses import dataclass, field
from typing import Optional
import yaml

logger = logging.getLogger(__name__)

POLICY_FILE_PATH = "policy.yaml"


@dataclass
class PolicyConfig:
    max_transaction_amount_paise: int = 0          # 0 = block all (fail-closed default)
    max_daily_spend_per_agent_paise: int = 0
    requires_human_confirmation_above_paise: int = 0
    allowed_categories: list = field(default_factory=list)
    max_requests_per_minute_per_agent: int = 0
    idempotency_key_ttl_seconds: int = 86400       # 24h default
    all_blocked: bool = True                       # True until a valid policy is loaded


_current_policy: Optional[PolicyConfig] = None


def _parse_ttl(ttl_str: str) -> int:
    """Parse '24h' -> 86400, '30m' -> 1800, integers treated as seconds."""
    ttl_str = str(ttl_str).strip()
    if ttl_str.endswith("h"):
        return int(ttl_str[:-1]) * 3600
    if ttl_str.endswith("m"):
        return int(ttl_str[:-1]) * 60
    return int(ttl_str)


def _rupees_to_paise(rupees) -> int:
    """Convert a rupee value (int or float) to integer paise."""
    return int(round(float(rupees) * 100))


def load_policy(path: str = POLICY_FILE_PATH) -> PolicyConfig:
    """Load policy.yaml. Returns a fail-closed PolicyConfig on any error."""
    global _current_policy
    try:
        with open(path, "r") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise ValueError("policy.yaml must be a YAML mapping")

        _current_policy = PolicyConfig(
            max_transaction_amount_paise=_rupees_to_paise(data["max_transaction_amount"]),
            max_daily_spend_per_agent_paise=_rupees_to_paise(data["max_daily_spend_per_agent"]),
            requires_human_confirmation_above_paise=_rupees_to_paise(
                data.get("requires_human_confirmation_above", 0)
            ),
            allowed_categories=[c.strip().lower() for c in data.get("allowed_categories", [])],
            max_requests_per_minute_per_agent=int(data.get("max_requests_per_minute_per_agent", 5)),
            idempotency_key_ttl_seconds=_parse_ttl(data.get("idempotency_key_ttl", "24h")),
            all_blocked=False,
        )
        logger.info(f"Policy loaded from {path}")
        return _current_policy
    except Exception as e:
        logger.critical(f"Failed to load policy from {path}: {e}. Starting in FAIL-CLOSED mode.")
        _current_policy = PolicyConfig(all_blocked=True)
        return _current_policy


def get_policy() -> PolicyConfig:
    """Return the current loaded policy. Loads on first call."""
    global _current_policy
    if _current_policy is None:
        load_policy()
    return _current_policy


def setup_sighup_reload():
    """Register SIGHUP handler to hot-reload policy without restart (if OS supports it)."""
    if hasattr(signal, "SIGHUP"):
        def _handler(signum, frame):
            logger.info("SIGHUP received — reloading policy.yaml")
            load_policy()
        signal.signal(signal.SIGHUP, _handler)
