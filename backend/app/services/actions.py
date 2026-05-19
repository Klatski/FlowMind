"""Structured action vocabulary for the AI Treasury Assistant.

Gemini proposes; this module applies. Three action types are enough to demo
every realistic recovery scenario:

  - shift_payment    -> move a scheduled expense to a later date
  - request_advance  -> add an inflow (typically a counterparty prepayment)
  - add_credit_line  -> overdraft: inflow now + outflow on the repay date

Target resolution prefers the row's real id and falls back to a (title, date)
tuple, then a fuzzy title match, so the LLM has some forgiveness if it cannot
echo the exact id back. Unresolvable shift_payment actions are dropped with a
note rather than failing the whole proposal.

The functions here are pure: they take Contract/Expense lists in, return
*new* lists out. Callers (the /propose endpoint, the apply step) decide
whether to commit.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable, Literal

from pydantic import BaseModel, Field

from ..models import Contract, Expense


# ── Tax / mandatory payment guard ────────────────────────────────────────
#
# Treasury rule: налоговые и обязательные платежи (НДС, ИПН, КПН, соц.отчисления,
# ОСМС, ОПВ, акциз) НЕ переносятся — за просрочку начисляются пени и штрафы по
# Налоговому кодексу РК и закону «Об обязательном социальном страховании».
# Этот guard блокирует любое предложение AI/эвристик отложить такой платёж.

_TAX_CATEGORIES = {"taxes", "tax", "налоги"}

_TAX_TITLE_KEYWORDS = (
    "ндс", "ипн", "кпн", "налог",
    "соц.отчислен", "соцотчислен", "соц отчислен",
    "осмс", "восмс", "опв", "обязательн. пенс", "обяз. пенс",
    "акциз", "пенс. взнос", "пенс.взнос",
)


def is_tax_payment(expense: Expense) -> bool:
    """True if the expense is a tax/mandatory contribution that must not be deferred."""
    if (expense.category or "").strip().lower() in _TAX_CATEGORIES:
        return True
    title = (expense.title or "").lower()
    return any(kw in title for kw in _TAX_TITLE_KEYWORDS)


# ── JSON schema fed to Gemini ────────────────────────────────────────────
#
# Kept as a single flat object with a `type` discriminator so the schema is
# trivially Vertex/Gemini-compatible (no anyOf). Python validates which
# fields are meaningful per type after parsing.

ACTION_TYPES = ("shift_payment", "request_advance", "add_credit_line")

ACTION_JSON_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": list(ACTION_TYPES)},
        # shift_payment
        "target_id": {"type": "string"},
        "target_title": {"type": "string"},
        "target_date": {"type": "string"},   # ISO yyyy-mm-dd
        "to_date": {"type": "string"},
        # request_advance
        "counterparty_bin": {"type": "string"},
        "counterparty_name": {"type": "string"},
        "title": {"type": "string"},
        "amount": {"type": "number"},
        "currency": {"type": "string"},
        "date": {"type": "string"},
        # add_credit_line
        "start_date": {"type": "string"},
        "repay_date": {"type": "string"},
        "note": {"type": "string"},
    },
    "required": ["type"],
}

PROPOSAL_JSON_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "explanation": {"type": "string"},
        "risk_assessment": {"type": "string"},
        "actions": {"type": "array", "items": ACTION_JSON_SCHEMA},
    },
    "required": ["explanation", "risk_assessment", "actions"],
}


# ── Internal Pydantic mirror (used after parsing the JSON Gemini returns) ─

class ProposedAction(BaseModel):
    type: Literal["shift_payment", "request_advance", "add_credit_line"]
    target_id: str | None = None
    target_title: str | None = None
    target_date: str | None = None
    to_date: str | None = None
    counterparty_bin: str | None = None
    counterparty_name: str | None = None
    title: str | None = None
    amount: float | None = None
    currency: str = "KZT"
    date: str | None = None
    start_date: str | None = None
    repay_date: str | None = None
    note: str = ""


class AssistantProposal(BaseModel):
    explanation: str
    risk_assessment: str = ""
    actions: list[ProposedAction] = Field(default_factory=list)


# ── Target resolution ────────────────────────────────────────────────────

def _iso(d: date) -> str:
    return d.isoformat()


def resolve_expense(
    expenses: Iterable[Expense],
    *,
    target_id: str | None,
    target_title: str | None,
    target_date: str | None,
) -> Expense | None:
    rows = list(expenses)
    if target_id:
        for e in rows:
            if str(e.id) == str(target_id):
                return e
    if target_title and target_date:
        for e in rows:
            if e.title.strip().lower() == target_title.strip().lower() \
               and _iso(e.due_date) == target_date:
                return e
    if target_title:
        needle = target_title.strip().lower()
        for e in rows:
            if needle and needle in e.title.lower():
                return e
    return None


# ── Action application ───────────────────────────────────────────────────

@dataclass
class ApplyReport:
    applied: list[str]          # one human-readable line per applied action
    skipped: list[str]          # one human-readable line per dropped action


def apply_actions(
    contracts: Iterable[Contract],
    expenses: Iterable[Expense],
    actions: Iterable[ProposedAction],
) -> tuple[list[Contract], list[Expense], ApplyReport]:
    """Return new contracts/expenses lists with the actions applied.

    Deep-copies the inputs so callers can compare the original simulation
    against the preview without aliasing. Never mutates the DB.
    """
    new_contracts = [copy.copy(c) for c in contracts]
    new_expenses = [copy.copy(e) for e in expenses]
    applied: list[str] = []
    skipped: list[str] = []

    for a in actions:
        if a.type == "shift_payment":
            e = resolve_expense(
                new_expenses,
                target_id=a.target_id,
                target_title=a.target_title,
                target_date=a.target_date,
            )
            if not e:
                skipped.append(
                    f"shift_payment: не найден расход (id={a.target_id!r}, "
                    f"title={a.target_title!r})"
                )
                continue
            if is_tax_payment(e):
                skipped.append(
                    f"shift_payment «{e.title}»: перенос налоговых и обязательных "
                    f"платежей запрещён (пени и штрафы по НК РК)"
                )
                continue
            if not a.to_date:
                skipped.append(f"shift_payment «{e.title}»: не указана новая дата")
                continue
            try:
                new_date = datetime.fromisoformat(a.to_date).date()
            except ValueError:
                skipped.append(f"shift_payment «{e.title}»: некорректная дата {a.to_date!r}")
                continue
            e.due_date = new_date
            applied.append(f"Перенесён расход «{e.title}» на {a.to_date}")

        elif a.type == "request_advance":
            if not (a.amount and a.amount > 0):
                skipped.append("request_advance: пустая или отрицательная сумма")
                continue
            if not a.date:
                skipped.append("request_advance: не указана дата поступления")
                continue
            try:
                d = datetime.fromisoformat(a.date).date()
            except ValueError:
                skipped.append(f"request_advance: некорректная дата {a.date!r}")
                continue
            new_contracts.append(Contract(
                id=None,  # preview-only; not persisted
                client_id=(a.counterparty_bin or "").strip(),
                counterparty_name=(a.counterparty_name or "").strip(),
                title=(a.title or "Запрошенный аванс").strip(),
                amount=float(a.amount),
                currency=a.currency or "KZT",
                expected_date=d,
                status="expected",
                receipt_type="one_time",
                note=a.note or "AI: предложенный аванс",
            ))
            applied.append(
                f"Запрошен аванс {a.amount:,.0f} {a.currency or 'KZT'} "
                f"от «{a.counterparty_name or '—'}» на {a.date}"
            )

        elif a.type == "add_credit_line":
            if not (a.amount and a.amount > 0):
                skipped.append("add_credit_line: пустая или отрицательная сумма")
                continue
            if not a.start_date or not a.repay_date:
                skipped.append("add_credit_line: нужны start_date и repay_date")
                continue
            try:
                ds = datetime.fromisoformat(a.start_date).date()
                dr = datetime.fromisoformat(a.repay_date).date()
            except ValueError:
                skipped.append("add_credit_line: некорректные даты")
                continue
            new_contracts.append(Contract(
                id=None,
                client_id="",
                counterparty_name="Овердрафт банка-партнёра",
                title=a.title or "Овердрафт (тело)",
                amount=float(a.amount),
                currency=a.currency or "KZT",
                expected_date=ds,
                status="expected",
                receipt_type="one_time",
                note=a.note or "AI: предложенная кредитная линия",
            ))
            new_expenses.append(Expense(
                id=None,
                category="other",
                title=(a.title or "Овердрафт") + " — погашение",
                amount=float(a.amount),
                currency=a.currency or "KZT",
                due_date=dr,
                status="scheduled",
                note=a.note or "AI: предложенный возврат овердрафта",
            ))
            applied.append(
                f"Овердрафт {a.amount:,.0f} {a.currency or 'KZT'}: "
                f"{a.start_date} → возврат {a.repay_date}"
            )

        else:
            skipped.append(f"Неизвестный тип действия: {a.type}")

    return new_contracts, new_expenses, ApplyReport(applied=applied, skipped=skipped)
