from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import ChatMessage, Contract, Expense
from ..services.cashflow import simulate
from ..services.gemini import ask_gemini
from .cashflow import _opening_balance

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AskIn(BaseModel):
    question: str
    horizon_days: int = 30


@router.post("/ask")
def ask(payload: AskIn, session: Session = Depends(get_session)) -> dict:
    contracts = session.exec(select(Contract)).all()
    expenses = session.exec(select(Expense)).all()
    opening = _opening_balance(session)
    sim = simulate(opening, contracts, expenses, horizon_days=payload.horizon_days)

    answer = ask_gemini(payload.question, opening, sim, contracts, expenses)

    session.add(ChatMessage(role="user", content=payload.question))
    session.add(ChatMessage(role="assistant", content=answer))
    session.commit()
    return {"answer": answer}


@router.get("/history")
def history(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.exec(select(ChatMessage).order_by(ChatMessage.created_at)).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in rows]
