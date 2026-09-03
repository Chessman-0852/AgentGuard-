# agentguard/api/routes/audit.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from agentguard.database import get_db
from agentguard.core.audit_log import get_audit_entries, verify_chain

router = APIRouter()


@router.get("/audit")
def list_audit_entries(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Return paginated audit log entries in chronological order."""
    entries = get_audit_entries(db, limit=limit, offset=offset)
    return {"entries": entries, "count": len(entries)}


@router.post("/audit/verify")
def verify_audit_chain(db: Session = Depends(get_db)):
    """Verify the entire hash chain integrity in-process. Returns intact=true if clean."""
    intact, count, message = verify_chain(db)
    return {"intact": intact, "entries_checked": count, "message": message}
