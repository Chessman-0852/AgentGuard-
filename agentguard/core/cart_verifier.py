# agentguard/core/cart_verifier.py
"""
Cart integrity verification via SHA-256 hash comparison.
Append-only: take_snapshot() only INSERTs, never UPDATEs.
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone
from sqlalchemy import text
from agentguard.models import Cart, CartIntegrityResult
from agentguard import constants


def _compute_cart_hash(cart: Cart) -> str:
    """SHA-256 of the deterministic canonical_dict. Sorted keys, integer paise."""
    canonical = json.dumps(cart.canonical_dict(), sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def take_cart_snapshot(intent_id: str, cart: Cart, db) -> str:
    """
    Hash the cart and store the snapshot. Returns the cart_hash.
    APPEND-ONLY: no UPDATE or DELETE ever called here.
    """
    cart_hash = _compute_cart_hash(cart)
    canonical_json = json.dumps(cart.canonical_dict(), sort_keys=True, ensure_ascii=True)
    db.execute(
        text("""
            INSERT OR IGNORE INTO cart_snapshots
            (snapshot_id, intent_id, cart_hash, canonical_json, taken_at)
            VALUES (:sid, :iid, :hash, :json, :ts)
        """),
        {
            "sid": str(uuid.uuid4()),
            "iid": intent_id,
            "hash": cart_hash,
            "json": canonical_json,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
    )
    db.commit()
    return cart_hash


def verify_cart_integrity(intent_id: str, current_cart: Cart, db) -> CartIntegrityResult:
    """
    Compare the current cart hash against the stored snapshot.
    Fail-closed: if no snapshot exists, return failed result.
    """
    row = db.execute(
        text("SELECT cart_hash, canonical_json FROM cart_snapshots WHERE intent_id=:iid ORDER BY taken_at ASC LIMIT 1"),
        {"iid": intent_id}
    ).fetchone()

    if not row:
        return CartIntegrityResult(
            passed=False,
            reason=constants.BLOCK_NO_CART_SNAPSHOT,
            changed_fields=["snapshot_missing"]
        )

    stored_hash, stored_json = row[0], row[1]
    current_hash = _compute_cart_hash(current_cart)

    if current_hash == stored_hash:
        return CartIntegrityResult(passed=True)

    # Compute diff: which top-level fields changed
    stored_dict = json.loads(stored_json)
    current_dict = current_cart.canonical_dict()
    changed_fields = _compute_diff(stored_dict, current_dict)

    return CartIntegrityResult(
        passed=False,
        reason=constants.BLOCK_CART_INTEGRITY_FAILURE,
        changed_fields=changed_fields
    )


def _compute_diff(stored: dict, current: dict) -> list[str]:
    """Return list of top-level field names that differ."""
    changed = []
    all_keys = set(stored.keys()) | set(current.keys())
    for k in all_keys:
        if stored.get(k) != current.get(k):
            changed.append(k)
    return sorted(changed)
