from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Contract(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: str = Field(index=True)           # legacy: holds counterparty BIN
    counterparty_name: str = ""                  # short legal name, e.g. ТОО «Alpha»
    title: str                                   # payment purpose
    amount: float
    currency: str = "KZT"
    expected_date: date
    status: str = "expected"                     # expected | received | overdue
    receipt_type: str = "one_time"               # one_time | installment | recurring
    installment_index: Optional[int] = None      # 1-based position in schedule
    installment_total: Optional[int] = None      # total installments in schedule
    frequency: Optional[str] = None              # weekly | monthly | quarterly
    note: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str = Field(index=True)  # salary | taxes | rent | utilities | suppliers | other
    title: str
    amount: float
    currency: str = "KZT"
    due_date: date
    status: str = "scheduled"  # scheduled | paid | deferred
    note: str = ""
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AccountSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account: str = Field(default="main", index=True)
    balance: float
    as_of: date
    note: str = ""


class TelegramLink(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_token: str = Field(index=True, unique=True)  # shared secret to bind chat
    chat_id: Optional[int] = Field(default=None, index=True)
    username: Optional[str] = None
    linked_at: Optional[datetime] = None


class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    role: str  # user | assistant
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
