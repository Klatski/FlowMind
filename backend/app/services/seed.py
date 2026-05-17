"""Pre-seed the DB with a realistic demo dataset that produces a visible gap."""
from datetime import date, timedelta

from sqlmodel import Session, select

from ..models import AccountSnapshot, Contract, Expense


def seed_if_empty(session: Session) -> None:
    existing = session.exec(select(Contract)).first()
    if existing:
        return

    today = date.today()

    contracts = [
        Contract(client_id="C-001", title="Клиент №1 — оплата контракта Q2", amount=18_500_000, expected_date=today + timedelta(days=3)),
        Contract(client_id="C-002", title="Клиент №2 — SWIFT поступление", amount=22_000_000, expected_date=today + timedelta(days=18)),
        Contract(client_id="C-003", title="Клиент №3 — карточный клиринг", amount=9_300_000, expected_date=today + timedelta(days=14)),
        Contract(client_id="C-004", title="Клиент №4 — SEPA перевод", amount=15_750_000, expected_date=today + timedelta(days=22)),
        Contract(client_id="C-005", title="Клиент №5 — комиссии за услуги", amount=4_200_000, expected_date=today + timedelta(days=9)),
        Contract(client_id="C-006", title="Клиент №6 — лицензионные платежи", amount=6_800_000, expected_date=today + timedelta(days=27)),
    ]

    expenses = [
        Expense(category="salary", title="Зарплата (1-я часть)", amount=12_000_000, due_date=today + timedelta(days=5)),
        Expense(category="taxes", title="ИПН и соц.отчисления", amount=4_500_000, due_date=today + timedelta(days=6)),
        Expense(category="rent", title="Аренда офиса", amount=3_000_000, due_date=today + timedelta(days=8)),
        Expense(category="suppliers", title="Поставщик инфраструктуры", amount=6_200_000, due_date=today + timedelta(days=10)),
        Expense(category="suppliers", title="Расчёт с эквайером", amount=8_900_000, due_date=today + timedelta(days=12)),
        Expense(category="utilities", title="Хостинг и SaaS-подписки", amount=1_500_000, due_date=today + timedelta(days=11)),
        Expense(category="salary", title="Зарплата (2-я часть)", amount=12_000_000, due_date=today + timedelta(days=20)),
        Expense(category="taxes", title="НДС квартал", amount=7_800_000, due_date=today + timedelta(days=15)),
        Expense(category="other", title="Маркетинговые расходы", amount=2_400_000, due_date=today + timedelta(days=16)),
    ]

    snapshot = AccountSnapshot(account="main", balance=5_000_000, as_of=today,
                               note="Стартовый остаток на ностро-счёте (демо)")

    for c in contracts:
        session.add(c)
    for e in expenses:
        session.add(e)
    session.add(snapshot)
    session.commit()
