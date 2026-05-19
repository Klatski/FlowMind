from fastapi import APIRouter, Depends
from sqlmodel import Session

from ..db import get_session
from ..services.seed import _clear_all, seed_if_empty

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/reseed")
def reseed(session: Session = Depends(get_session)) -> dict:
    """Force-clear the database and reseed with demo data."""
    _clear_all(session)
    seed_if_empty(session)
    return {"ok": True, "message": "Database reseeded with demo data"}
