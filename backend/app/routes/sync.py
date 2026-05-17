"""Bulk sync endpoint for the offline-first client.

The frontend keeps everything in LocalStorage and posts the full dataset here
when it's online. The backend uses a last-write-wins strategy: incoming rows
overwrite the local DB completely. Simple and predictable for the demo.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import AccountSnapshot, Contract, Expense
from .contracts import _to_dict as contract_dict
from .expenses import _to_dict as expense_dict

router = APIRouter(prefix="/api/sync", tags=["sync"])


class SyncContract(BaseModel):
    client_id: str
    title: str
    amount: float
    currency: str = "KZT"
    expected_date: str
    status: str = "expected"
    note: str = ""


class SyncExpense(BaseModel):
    category: str
    title: str
    amount: float
    currency: str = "KZT"
    due_date: str
    status: str = "scheduled"
    note: str = ""


class SyncPayload(BaseModel):
    opening_balance: float | None = None
    contracts: list[SyncContract] = []
    expenses: list[SyncExpense] = []


@router.post("/push")
def push(payload: SyncPayload, session: Session = Depends(get_session)) -> dict:
    for c in session.exec(select(Contract)).all():
        session.delete(c)
    for e in session.exec(select(Expense)).all():
        session.delete(e)
    session.commit()

    for c in payload.contracts:
        session.add(Contract(
            **c.model_dump(exclude={"expected_date"}),
            expected_date=datetime.fromisoformat(c.expected_date).date(),
        ))
    for e in payload.expenses:
        session.add(Expense(
            **e.model_dump(exclude={"due_date"}),
            due_date=datetime.fromisoformat(e.due_date).date(),
        ))

    if payload.opening_balance is not None:
        session.add(AccountSnapshot(
            account="main",
            balance=payload.opening_balance,
            as_of=datetime.utcnow().date(),
            note="synced from client",
        ))

    session.commit()
    return {"ok": True, "contracts": len(payload.contracts), "expenses": len(payload.expenses)}


@router.get("/pull")
def pull(session: Session = Depends(get_session)) -> dict:
    contracts = [contract_dict(c) for c in session.exec(select(Contract).order_by(Contract.expected_date)).all()]
    expenses = [expense_dict(e) for e in session.exec(select(Expense).order_by(Expense.due_date)).all()]
    snap = session.exec(select(AccountSnapshot).order_by(AccountSnapshot.as_of.desc()).limit(1)).first()
    return {
        "opening_balance": snap.balance if snap else 0.0,
        "contracts": contracts,
        "expenses": expenses,
    }
