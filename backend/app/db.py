from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import inspect, text

from .config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)


_SQLITE_COLUMN_PATCHES: dict[str, dict[str, str]] = {
    "contract": {
        "counterparty_name": "TEXT NOT NULL DEFAULT ''",
        "receipt_type": "TEXT NOT NULL DEFAULT 'one_time'",
        "installment_index": "INTEGER",
        "installment_total": "INTEGER",
        "frequency": "TEXT",
    },
}


def _patch_sqlite_columns() -> None:
    # SQLModel.metadata.create_all only creates missing tables, it never adds
    # columns to existing ones. For the hackathon DB we add the new optional
    # columns in-place so older flowmind.db files keep working.
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in _SQLITE_COLUMN_PATCHES.items():
            if not insp.has_table(table):
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols.items():
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN {name} {ddl}'))


def init_db() -> None:
    from . import models  # noqa: F401 — ensure tables are registered

    SQLModel.metadata.create_all(engine)
    _patch_sqlite_columns()


def get_session():
    with Session(engine) as session:
        yield session
