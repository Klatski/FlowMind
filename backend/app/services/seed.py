"""Pre-seed the DB with a realistic demo dataset that produces a visible gap."""
from datetime import date, timedelta

from sqlmodel import Session, select

from ..models import AccountSnapshot, Contract, Expense


COUNTERPARTIES = [
    ("180440012345", "ТОО «AlphaTech Solutions»"),
    ("050940007823", "АО «KaspiPay»"),
    ("210340004451", "ТОО «BetaPay KZ»"),
    ("170240009934", "АО «Tengri Logistics»"),
    ("230540001177", "ТОО «Sapa Commerce»"),
    ("991240006628", "АО «Qazaq Digital»"),
]


def seed_if_empty(session: Session) -> None:
    existing = session.exec(select(Contract)).first()
    if existing:
        return

    today = date.today()

    bin0, name0 = COUNTERPARTIES[0]
    bin1, name1 = COUNTERPARTIES[1]
    bin2, name2 = COUNTERPARTIES[2]
    bin3, name3 = COUNTERPARTIES[3]
    bin4, name4 = COUNTERPARTIES[4]
    bin5, name5 = COUNTERPARTIES[5]

    contracts = [
        Contract(
            client_id=bin0, counterparty_name=name0,
            title="Оплата контракта Q2",
            amount=18_500_000, expected_date=today + timedelta(days=3),
            receipt_type="one_time",
        ),
        Contract(
            client_id=bin1, counterparty_name=name1,
            title="SWIFT — поступление по договору №88",
            amount=22_000_000, expected_date=today + timedelta(days=18),
            receipt_type="one_time",
        ),
        Contract(
            client_id=bin2, counterparty_name=name2,
            title="Карточный клиринг",
            amount=9_300_000, expected_date=today + timedelta(days=14),
            receipt_type="one_time",
        ),
        Contract(
            client_id=bin3, counterparty_name=name3,
            title="SEPA — инвойс №142",
            amount=15_750_000, expected_date=today + timedelta(days=22),
            receipt_type="one_time",
        ),
        Contract(
            client_id=bin4, counterparty_name=name4,
            title="Ежемесячная комиссия за обслуживание",
            amount=4_200_000, expected_date=today + timedelta(days=9),
            receipt_type="recurring", frequency="monthly",
        ),
        Contract(
            client_id=bin5, counterparty_name=name5,
            title="Лицензионный платёж",
            amount=6_800_000, expected_date=today + timedelta(days=27),
            receipt_type="one_time",
        ),
    ]

    expenses = [
        Expense(category="salary",    title="Зарплата (1-я часть)",     amount=12_000_000, due_date=today + timedelta(days=5)),
        Expense(category="taxes",     title="ИПН и соц.отчисления",     amount=4_500_000,  due_date=today + timedelta(days=6)),
        Expense(category="rent",      title="Аренда офиса",             amount=3_000_000,  due_date=today + timedelta(days=8)),
        Expense(category="suppliers", title="Поставщик инфраструктуры", amount=6_200_000,  due_date=today + timedelta(days=10)),
        Expense(category="suppliers", title="Расчёт с эквайером",       amount=8_900_000,  due_date=today + timedelta(days=12)),
        Expense(category="utilities", title="Хостинг и SaaS-подписки",  amount=1_500_000,  due_date=today + timedelta(days=11)),
        Expense(category="salary",    title="Зарплата (2-я часть)",     amount=12_000_000, due_date=today + timedelta(days=20)),
        Expense(category="taxes",     title="НДС квартал",              amount=7_800_000,  due_date=today + timedelta(days=15)),
        Expense(category="other",     title="Маркетинговые расходы",    amount=2_400_000,  due_date=today + timedelta(days=16)),
    ]

    snapshot = AccountSnapshot(
        account="main", balance=5_000_000, as_of=today,
        note="Стартовый остаток на ностро-счёте (демо)",
    )

    for c in contracts:
        session.add(c)
    for e in expenses:
        session.add(e)
    session.add(snapshot)
    session.commit()
