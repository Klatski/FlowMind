"""The "Что делать?" engine.

Given a Simulation with detected gaps, produce concrete, ranked suggestions:
  * defer the nearest large outflow until after the gap,
  * pull forward the nearest large inflow into the gap window,
  * size an overdraft equal to the peak depth of the gap.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import date, timedelta
from typing import Iterable

from ..models import Contract, Expense
from .actions import is_tax_payment
from .cashflow import GapWindow, Simulation, simulate


@dataclass
class Suggestion:
    kind: str            # defer_expense | pull_inflow | overdraft
    headline: str        # short, user-facing line
    detail: str          # longer explanation
    impact: float        # how much it reduces the gap (KZT)
    confidence: float    # 0..1
    payload: dict        # machine-readable knobs (expense_id, new_date, etc.)


def _iso(d: date) -> str:
    return d.isoformat()


def advise(
    sim: Simulation,
    contracts: Iterable[Contract],
    expenses: Iterable[Expense],
) -> list[Suggestion]:
    if not sim.gaps:
        return []

    expenses = list(expenses)
    contracts = list(contracts)
    suggestions: list[Suggestion] = []
    seen_expense_ids: set = set()
    seen_contract_ids: set = set()

    for gap in sim.gaps:
        suggestions.extend(_suggest_for_gap(gap, contracts, expenses, seen_expense_ids, seen_contract_ids))

    suggestions.sort(key=lambda s: s.impact, reverse=True)
    return suggestions


def _suggest_for_gap(
    gap: GapWindow,
    contracts: list[Contract],
    expenses: list[Expense],
    seen_expense_ids: set,
    seen_contract_ids: set,
) -> list[Suggestion]:
    out: list[Suggestion] = []
    gap_start = date.fromisoformat(gap.start)
    gap_end = date.fromisoformat(gap.end)

    # 1) Defer expenses that fall inside the gap window — largest first.
    #    Tax/mandatory payments are NEVER candidates — see is_tax_payment().
    in_gap_expenses = [
        e for e in expenses
        if e.status == "scheduled" and not is_tax_payment(e)
        and gap_start <= e.due_date <= gap_end and e.id not in seen_expense_ids
    ]
    in_gap_expenses.sort(key=lambda e: e.amount, reverse=True)
    for e in in_gap_expenses[:3]:
        seen_expense_ids.add(e.id)
        new_date = gap_end + timedelta(days=2)
        out.append(Suggestion(
            kind="defer_expense",
            headline=f"Перенесите «{e.title}» с {_iso(e.due_date)} на {_iso(new_date)}",
            detail=(
                f"Это снимет нагрузку {e.amount:,.0f} {e.currency} из окна разрыва "
                f"и сократит дефицит примерно на {min(e.amount, gap.max_depth):,.0f} {e.currency}."
            ),
            impact=min(e.amount, gap.max_depth),
            confidence=0.8,
            payload={
                "expense_id": e.id,
                "from_date": _iso(e.due_date),
                "to_date": _iso(new_date),
            },
        ))

    # 2) Pull forward inflows expected after the gap.
    later_inflows = [
        c for c in contracts
        if c.status == "expected" and c.expected_date > gap_end and c.id not in seen_contract_ids
    ]
    later_inflows.sort(key=lambda c: c.amount, reverse=True)
    for c in later_inflows[:2]:
        seen_contract_ids.add(c.id)
        counterparty = c.counterparty_name or c.client_id or c.title
        ask = max(c.amount * 0.15, gap.max_depth * 0.25)
        out.append(Suggestion(
            kind="pull_inflow",
            headline=f"Запросите у «{counterparty}» аванс ≈{ask:,.0f} {c.currency}",
            detail=(
                f"Поступление {c.amount:,.0f} {c.currency} ожидается {_iso(c.expected_date)}, "
                f"уже после окна разрыва ({gap.start}–{gap.end}). Частичная предоплата "
                f"закроет {min(ask, gap.max_depth):,.0f} от дефицита."
            ),
            impact=min(ask, gap.max_depth),
            confidence=0.55,
            payload={
                "contract_id": c.id,
                "ask_amount": round(ask, 2),
                "by_date": gap.start,
            },
        ))

    # 3) Overdraft sized to peak depth.
    out.append(Suggestion(
        kind="overdraft",
        headline=(
            f"Вам нужен овердрафт на {gap.max_depth:,.0f} на {gap.days} дн "
            f"({gap.start} — {gap.end})"
        ),
        detail=(
            "Запасной вариант: открыть овердрафт у банка-партнёра. Размер равен "
            f"пиковой глубине разрыва ({gap.max_depth:,.0f}), срок — длительности окна."
        ),
        impact=gap.max_depth,
        confidence=0.99,
        payload={
            "amount": gap.max_depth,
            "days": gap.days,
            "from_date": gap.start,
            "to_date": gap.end,
        },
    ))
    return out


def advise_from_inputs(
    opening_balance: float,
    contracts: list[Contract],
    expenses: list[Expense],
    horizon_days: int = 30,
) -> tuple[Simulation, list[Suggestion]]:
    sim = simulate(opening_balance, contracts, expenses, horizon_days=horizon_days)
    return sim, advise(sim, contracts, expenses)


def suggestions_to_dicts(items: list[Suggestion]) -> list[dict]:
    return [asdict(s) for s in items]
