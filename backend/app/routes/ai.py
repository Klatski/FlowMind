from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import ChatMessage, Contract, Expense
from ..services.actions import apply_actions
from ..services.cashflow import simulate
from ..services.gemini import ask_gemini, propose_scenario
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


@router.post("/propose")
def propose(payload: AskIn, session: Session = Depends(get_session)) -> dict:
    """Preview→Confirm: return a structured proposal + the preview simulation.

    Gemini proposes actions in JSON; the engine applies them and resimulates.
    The response carries everything the UI needs to render a dashed preview
    curve plus an Apply panel — but commits nothing.
    """
    contracts = list(session.exec(select(Contract)).all())
    expenses = list(session.exec(select(Expense)).all())
    opening = _opening_balance(session)
    current = simulate(opening, contracts, expenses, horizon_days=payload.horizon_days)

    proposal = propose_scenario(payload.question, opening, current, contracts, expenses)
    if proposal is None:
        return {
            "ok": False,
            "reason": "gemini_unavailable",
            "explanation": "",
            "risk_assessment": "",
            "actions": [],
            "applied": [],
            "skipped": [],
            "current": current.to_dict(),
            "preview": None,
        }

    new_contracts, new_expenses, report = apply_actions(contracts, expenses, proposal.actions)
    preview = simulate(opening, new_contracts, new_expenses, horizon_days=payload.horizon_days)

    return {
        "ok": True,
        "explanation": proposal.explanation,
        "risk_assessment": proposal.risk_assessment,
        "actions": [a.model_dump(exclude_none=True) for a in proposal.actions],
        "applied": report.applied,
        "skipped": report.skipped,
        "current": current.to_dict(),
        "preview": preview.to_dict(),
    }


@router.get("/history")
def history(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.exec(select(ChatMessage).order_by(ChatMessage.created_at)).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in rows]
