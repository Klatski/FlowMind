import io
import secrets
from base64 import b64encode

import qrcode
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import settings
from ..db import get_session
from ..models import TelegramLink
from ..services.telegram_bot import send_alert_sync

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


class AlertIn(BaseModel):
    message: str


@router.post("/link")
def create_link(session: Session = Depends(get_session)) -> dict:
    token = secrets.token_urlsafe(12)
    link = TelegramLink(user_token=token)
    session.add(link)
    session.commit()
    session.refresh(link)

    deep_link = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start={token}"

    img = qrcode.make(deep_link)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = b64encode(buf.getvalue()).decode("ascii")

    return {
        "user_token": token,
        "deep_link": deep_link,
        "qr_png_base64": qr_b64,
        "bot_username": settings.TELEGRAM_BOT_USERNAME,
    }


@router.get("/status/{user_token}")
def link_status(user_token: str, session: Session = Depends(get_session)) -> dict:
    link = session.exec(select(TelegramLink).where(TelegramLink.user_token == user_token)).first()
    if not link:
        return {"linked": False}
    return {
        "linked": link.chat_id is not None,
        "chat_id": link.chat_id,
        "username": link.username,
        "linked_at": link.linked_at.isoformat() if link.linked_at else None,
    }


@router.post("/alert")
def send_alert(payload: AlertIn, session: Session = Depends(get_session)) -> dict:
    """Broadcast a message to every linked chat. Useful for manual test from UI."""
    links = session.exec(select(TelegramLink).where(TelegramLink.chat_id.is_not(None))).all()
    sent = 0
    for link in links:
        if send_alert_sync(link.chat_id, payload.message):
            sent += 1
    return {"sent": sent, "total": len(links)}
