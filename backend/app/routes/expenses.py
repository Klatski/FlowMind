from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import Expense

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


class ExpenseIn(BaseModel):
    category: str
    title: str
    amount: float
    currency: str = "KZT"
    due_date: str
    status: str = "scheduled"
    note: str = ""


@router.get("")
def list_expenses(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.exec(select(Expense).order_by(Expense.due_date)).all()
    return [_to_dict(e) for e in rows]


@router.post("")
def create_expense(payload: ExpenseIn, session: Session = Depends(get_session)) -> dict:
    e = Expense(**payload.model_dump(exclude={"due_date"}),
                due_date=datetime.fromisoformat(payload.due_date).date())
    session.add(e)
    session.commit()
    session.refresh(e)
    return _to_dict(e)


@router.put("/{expense_id}")
def update_expense(expense_id: int, payload: ExpenseIn,
                   session: Session = Depends(get_session)) -> dict:
    e = session.get(Expense, expense_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    data = payload.model_dump()
    data["due_date"] = datetime.fromisoformat(payload.due_date).date()
    for k, v in data.items():
        setattr(e, k, v)
    e.updated_at = datetime.utcnow()
    session.add(e)
    session.commit()
    session.refresh(e)
    return _to_dict(e)


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, session: Session = Depends(get_session)) -> dict:
    e = session.get(Expense, expense_id)
    if not e:
        raise HTTPException(404, "Expense not found")
    session.delete(e)
    session.commit()
    return {"ok": True}


def _to_dict(e: Expense) -> dict:
    return {
        "id": e.id,
        "category": e.category,
        "title": e.title,
        "amount": e.amount,
        "currency": e.currency,
        "due_date": e.due_date.isoformat(),
        "status": e.status,
        "note": e.note,
        "updated_at": e.updated_at.isoformat(),
    }
