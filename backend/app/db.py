from sqlmodel import SQLModel, create_engine, Session

from .config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)


def init_db() -> None:
    from . import models  # noqa: F401 — ensure tables are registered

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
