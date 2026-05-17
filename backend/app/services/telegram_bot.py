"""Telegram integration.

Two-way:
  * Outgoing — send a push when the simulation detects a gap.
  * Incoming — a /start <user_token> command binds a chat to a TelegramLink row.

To keep the demo simple we run the bot via long-polling in a background thread,
started during FastAPI's lifespan event.
"""
from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime

import httpx
from sqlmodel import Session, select
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

from ..config import settings
from ..db import engine
from ..models import TelegramLink

log = logging.getLogger(__name__)
_application: Application | None = None
_thread: threading.Thread | None = None


async def _cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    args = context.args or []
    chat = update.effective_chat
    user = update.effective_user
    if not chat:
        return

    if not args:
        await context.bot.send_message(
            chat_id=chat.id,
            text=(
                "Привет! Я — FlowMind alert bot.\n"
                "Откройте приложение и отсканируйте QR-код, чтобы привязать чат."
            ),
        )
        return

    token = args[0].strip()
    with Session(engine) as s:
        link = s.exec(select(TelegramLink).where(TelegramLink.user_token == token)).first()
        if not link:
            await context.bot.send_message(
                chat_id=chat.id,
                text="Токен не найден. Сгенерируйте новый в приложении.",
            )
            return
        link.chat_id = chat.id
        link.username = user.username if user else None
        link.linked_at = datetime.utcnow()
        s.add(link)
        s.commit()
    await context.bot.send_message(
        chat_id=chat.id,
        text="Связка готова. Теперь вы будете получать алерты о кассовых разрывах.",
    )


def _run_bot() -> None:
    global _application
    asyncio.set_event_loop(asyncio.new_event_loop())
    _application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    _application.add_handler(CommandHandler("start", _cmd_start))
    log.info("Telegram bot polling started")
    _application.run_polling(close_loop=False, stop_signals=None)


def start_bot_thread() -> None:
    global _thread
    if not settings.TELEGRAM_BOT_TOKEN:
        log.warning("TELEGRAM_BOT_TOKEN not set — bot is disabled")
        return
    if _thread and _thread.is_alive():
        return
    _thread = threading.Thread(target=_run_bot, daemon=True, name="tg-bot")
    _thread.start()


def send_alert_sync(chat_id: int, text: str) -> bool:
    """Stateless send via Bot API — safe to call from any thread."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        r = httpx.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=10.0)
        r.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001 — log and degrade gracefully
        log.warning("Telegram send failed: %s", exc)
        return False
