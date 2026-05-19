import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from .alerts import start_alerts
from .config import settings
from .db import engine, init_db
from .routes import admin, ai, cashflow, contracts, expenses, sync, telegram
from .services.seed import seed_if_empty
from .services.telegram_bot import start_bot_thread

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as s:
        seed_if_empty(s)
    start_bot_thread()
    start_alerts(interval_seconds=60)
    yield


app = FastAPI(title="FlowMind", version="0.1.0", lifespan=lifespan)

_allowed_origins = [o.strip() for o in settings.FRONTEND_ORIGIN.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins + ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(contracts.router)
app.include_router(expenses.router)
app.include_router(cashflow.router)
app.include_router(ai.router)
app.include_router(telegram.router)
app.include_router(sync.router)
app.include_router(admin.router)


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "gemini": bool(settings.GEMINI_API_KEY),
        "telegram": bool(settings.TELEGRAM_BOT_TOKEN),
    }
