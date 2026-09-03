# agentguard/models.py
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class MerchantConstraints(BaseModel):
    allowed_merchant_ids: list[str] = Field(default_factory=list)
    blocked_merchant_ids: list[str] = Field(default_factory=list)


class BoundedIntent(BaseModel):
    intent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str
    idempotency_key: str = ""          # Set by intent_parser after creation
    category: str
    item_description: str
    max_amount_paise: int              # Always in paise; NEVER float rupees
    currency: str = "INR"
    merchant_constraints: MerchantConstraints = Field(default_factory=MerchantConstraints)
    ttl_seconds: int = 3600
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_input: str = ""

    @field_validator("category")
    @classmethod
    def normalize_category(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("max_amount_paise")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("max_amount_paise must be positive")
        return v


class CartItem(BaseModel):
    sku: str
    name: str
    price_paise: int        # Integer paise — no floats
    quantity: int
    merchant_id: str

    @field_validator("price_paise", "quantity")
    @classmethod
    def must_be_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("price_paise and quantity must be positive")
        return v


class Cart(BaseModel):
    intent_id: str
    merchant_id: str
    currency: str = "INR"
    items: list[CartItem]

    def total_paise(self) -> int:
        return sum(item.price_paise * item.quantity for item in self.items)

    def canonical_dict(self) -> dict:
        """Deterministic representation for hashing. Sorted keys, sorted items."""
        return {
            "currency": self.currency,
            "items": sorted(
                [
                    {
                        "merchant_id": item.merchant_id,
                        "price_paise": item.price_paise,
                        "quantity": item.quantity,
                        "sku": item.sku,
                    }
                    for item in self.items
                ],
                key=lambda x: x["sku"],
            ),
            "merchant_id": self.merchant_id,
        }


# --- Gate Result Models ---

class PolicyResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    rule_triggered: Optional[str] = None


class CartIntegrityResult(BaseModel):
    passed: bool
    changed_fields: list[str] = Field(default_factory=list)
    reason: Optional[str] = None


class RiskResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    rule_triggered: Optional[str] = None
    anomaly_score: float = 0.0        # Advisory only — never blocks alone


class IdempotencyResult(BaseModel):
    passed: bool
    reason: Optional[str] = None
    original_execution_at: Optional[datetime] = None


# --- Audit Entry (write path; read path uses DB row directly) ---

class GateResults(BaseModel):
    policy: PolicyResult
    cart_integrity: CartIntegrityResult
    risk: RiskResult
    idempotency: IdempotencyResult


class PaymentResult(BaseModel):
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    payment_link_url: Optional[str] = None
    status: Optional[str] = None     # "success" | "failed" | "pending" | None
