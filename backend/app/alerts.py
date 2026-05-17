"""Background loop that re-runs the simulation and pushes Telegram alerts
when a new gap is detected. Keeps the last alert hash to avoid spam.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging

from sqlmodel import Session, select

from .db import engine
from .models import Contract, Expense, TelegramLink
from .routes.cashflow import _opening_balance
from .services.cashflow import simulate
from .services.telegram_bot import send_alert_sync

log = logging.getLogger(__name__)
_last_hash: str | None = None
_task: asyncio.Task | None = None


def _gaps_hash(gaps: list) -> str:
    sig = ";".join(f"{g.start}->{g.end}:{g.max_depth}" for g in gaps)
    return hashlib.sha1(sig.encode()).hexdigest()


def _format(gaps: list) -> str:
    if not gaps:
        return "Все чисто — кассовых разрывов в горизонте 30 дней не прогнозируется. ✅"
    first = gaps[0]
    return (
        f"⚠️ <b>Прогнозируется кассовый разрыв</b>\n"
        f"Окно: <b>{first.start} — {first.end}</b> ({first.days} дн.)\n"
        f"Глубина: <b>{first.max_depth:,.0f}</b>\n\n"
        f"Откройте FlowMind, чтобы выбрать сценарий действий."
    )


async def _loop(interval_seconds: int) -> None:
    global _last_hash
    while True:
        try:
            with Session(engine) as s:
                contracts = s.exec(select(Contract)).all()
                expenses = s.exec(select(Expense)).all()
                opening = _opening_balance(s)
                sim = simulate(opening, contracts, expenses, horizon_days=30)
                h = _gaps_hash(sim.gaps)
                if h != _last_hash and sim.gaps:
                    text = _format(sim.gaps)
                    links = s.exec(select(TelegramLink).where(TelegramLink.chat_id.is_not(None))).all()
                    for link in links:
                        send_alert_sync(link.chat_id, text)
                _last_hash = h
        except Exception:  # noqa: BLE001
            log.exception("alerts loop iteration failed")
        await asyncio.sleep(interval_seconds)


def start_alerts(interval_seconds: int = 60) -> None:
    global _task
    if _task and not _task.done():
        return
    _task = asyncio.get_event_loop().create_task(_loop(interval_seconds))
