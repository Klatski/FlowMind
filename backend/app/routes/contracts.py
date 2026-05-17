from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import get_session
from ..models import Contract

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


class ContractIn(BaseModel):
    client_id: str
    title: str
    amount: float
    currency: str = "KZT"
    expected_date: str  # ISO
    status: str = "expected"
    note: str = ""


@router.get("")
def list_contracts(session: Session = Depends(get_session)) -> list[dict]:
    rows = session.exec(select(Contract).order_by(Contract.expected_date)).all()
    return [_to_dict(c) for c in rows]


@router.post("")
def create_contract(payload: ContractIn, session: Session = Depends(get_session)) -> dict:
    c = Contract(**payload.model_dump(exclude={"expected_date"}),
                 expected_date=datetime.fromisoformat(payload.expected_date).date())
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_dict(c)


@router.put("/{contract_id}")
def update_contract(contract_id: int, payload: ContractIn,
                    session: Session = Depends(get_session)) -> dict:
    c = session.get(Contract, contract_id)
    if not c:
        raise HTTPException(404, "Contract not found")
    data = payload.model_dump()
    data["expected_date"] = datetime.fromisoformat(payload.expected_date).date()
    for k, v in data.items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()
    session.add(c)
    session.commit()
    session.refresh(c)
    return _to_dict(c)


@router.delete("/{contract_id}")
def delete_contract(contract_id: int, session: Session = Depends(get_session)) -> dict:
    c = session.get(Contract, contract_id)
    if not c:
        raise HTTPException(404, "Contract not found")
    session.delete(c)
    session.commit()
    return {"ok": True}


def _to_dict(c: Contract) -> dict:
    return {
        "id": c.id,
        "client_id": c.client_id,
        "title": c.title,
        "amount": c.amount,
        "currency": c.currency,
        "expected_date": c.expected_date.isoformat(),
        "status": c.status,
        "note": c.note,
        "updated_at": c.updated_at.isoformat(),
    }
