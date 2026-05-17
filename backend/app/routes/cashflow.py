from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, desc

from ..db import get_session
from ..models import AccountSnapshot, Contract, Expense
from ..services.advisor import advise, suggestions_to_dicts
from ..services.cashflow import simulate

router = APIRouter(prefix="/api/cashflow", tags=["cashflow"])


def _opening_balance(session: Session) -> float:
    snap = session.exec(
        select(AccountSnapshot).order_by(desc(AccountSnapshot.as_of)).limit(1)
    ).first()
    return snap.balance if snap else 0.0


@router.get("/simulate")
def simulate_endpoint(
    horizon_days: int = Query(30, ge=1, le=180),
    session: Session = Depends(get_session),
) -> dict:
    contracts = session.exec(select(Contract)).all()
    expenses = session.exec(select(Expense)).all()
    opening = _opening_balance(session)
    sim = simulate(opening, contracts, expenses, horizon_days=horizon_days)
    return sim.to_dict()


@router.get("/advise")
def advise_endpoint(
    horizon_days: int = Query(30, ge=1, le=180),
    session: Session = Depends(get_session),
) -> dict:
    contracts = session.exec(select(Contract)).all()
    expenses = session.exec(select(Expense)).all()
    opening = _opening_balance(session)
    sim = simulate(opening, contracts, expenses, horizon_days=horizon_days)
    suggestions = advise(sim, contracts, expenses)
    return {
        "simulation": sim.to_dict(),
        "suggestions": suggestions_to_dicts(suggestions),
    }


@router.get("/balance")
def balance(session: Session = Depends(get_session)) -> dict:
    return {"opening_balance": _opening_balance(session), "as_of": date.today().isoformat()}


@router.post("/balance")
def set_balance(payload: dict, session: Session = Depends(get_session)) -> dict:
    snap = AccountSnapshot(
        account=payload.get("account", "main"),
        balance=float(payload["balance"]),
        as_of=date.fromisoformat(payload.get("as_of", date.today().isoformat())),
        note=payload.get("note", ""),
    )
    session.add(snap)
    session.commit()
    session.refresh(snap)
    return {"opening_balance": snap.balance, "as_of": snap.as_of.isoformat()}
