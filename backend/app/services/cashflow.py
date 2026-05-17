"""Core treasury simulation: CB_t = CB_{t-1} + I_t - O_t.

The simulator projects the daily closing balance for `horizon_days` ahead and
returns the day-by-day series along with any gap windows (where CB_t < 0).
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import date, timedelta
from typing import Iterable

from ..models import Contract, Expense


@dataclass
class DayPoint:
    day: str           # ISO date
    inflow: float
    outflow: float
    balance: float     # CB_t
    is_gap: bool       # CB_t < 0


@dataclass
class GapWindow:
    start: str
    end: str
    days: int
    max_depth: float   # max |CB_t| inside the window
    cumulative: float  # sum of |CB_t| across the window


@dataclass
class Simulation:
    opening_balance: float
    horizon_days: int
    series: list[DayPoint]
    gaps: list[GapWindow]
    min_balance: float
    min_balance_day: str | None

    def to_dict(self) -> dict:
        return {
            "opening_balance": self.opening_balance,
            "horizon_days": self.horizon_days,
            "series": [asdict(p) for p in self.series],
            "gaps": [asdict(g) for g in self.gaps],
            "min_balance": self.min_balance,
            "min_balance_day": self.min_balance_day,
        }


def simulate(
    opening_balance: float,
    contracts: Iterable[Contract],
    expenses: Iterable[Expense],
    start_day: date | None = None,
    horizon_days: int = 30,
) -> Simulation:
    start_day = start_day or date.today()
    inflows: dict[date, float] = {}
    outflows: dict[date, float] = {}

    for c in contracts:
        if c.status == "received":
            continue
        inflows[c.expected_date] = inflows.get(c.expected_date, 0.0) + c.amount

    for e in expenses:
        if e.status in ("paid", "deferred"):
            continue
        outflows[e.due_date] = outflows.get(e.due_date, 0.0) + e.amount

    series: list[DayPoint] = []
    balance = opening_balance
    min_balance = balance
    min_balance_day: str | None = None

    for i in range(horizon_days):
        d = start_day + timedelta(days=i)
        i_t = inflows.get(d, 0.0)
        o_t = outflows.get(d, 0.0)
        balance = balance + i_t - o_t
        if balance < min_balance:
            min_balance = balance
            min_balance_day = d.isoformat()
        series.append(
            DayPoint(
                day=d.isoformat(),
                inflow=i_t,
                outflow=o_t,
                balance=round(balance, 2),
                is_gap=balance < 0,
            )
        )

    gaps = _extract_gaps(series)
    return Simulation(
        opening_balance=opening_balance,
        horizon_days=horizon_days,
        series=series,
        gaps=gaps,
        min_balance=round(min_balance, 2),
        min_balance_day=min_balance_day,
    )


def _extract_gaps(series: list[DayPoint]) -> list[GapWindow]:
    gaps: list[GapWindow] = []
    cur_start: int | None = None
    for i, p in enumerate(series):
        if p.is_gap and cur_start is None:
            cur_start = i
        elif not p.is_gap and cur_start is not None:
            gaps.append(_window_from_slice(series[cur_start:i]))
            cur_start = None
    if cur_start is not None:
        gaps.append(_window_from_slice(series[cur_start:]))
    return gaps


def _window_from_slice(window: list[DayPoint]) -> GapWindow:
    max_depth = max(abs(p.balance) for p in window)
    cumulative = round(sum(abs(p.balance) for p in window), 2)
    return GapWindow(
        start=window[0].day,
        end=window[-1].day,
        days=len(window),
        max_depth=round(max_depth, 2),
        cumulative=cumulative,
    )
