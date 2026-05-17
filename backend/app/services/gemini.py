"""Gemini wrapper for the AI Treasury Assistant.

The frontend sends a user question; the backend attaches the current treasury
context (balances, contracts, expenses, detected gaps) so the model answers as a
domain-aware expert rather than a generic chatbot.
"""
from __future__ import annotations

import json
from typing import Iterable

import google.generativeai as genai

from ..config import settings
from ..models import Contract, Expense
from .cashflow import Simulation

SYSTEM_PROMPT = """
Ты — финансовый ассистент FlowMind. Отвечай так, как говорит опытный казначей
коллеге за чашкой кофе: спокойно, по-человечески, обычными живыми фразами.

КАК ПИСАТЬ:
  • Только сплошной текст, обычная проза. Никаких markdown-символов:
    запрещены **, *, #, -, бэктики, заголовки, нумерованные и маркированные списки.
  • Максимум 2–3 коротких абзаца. В сумме 60–120 слов.
  • Не разбивай ответ по дням. Дату упоминай только если она по-настоящему
    критична (например, дата начала разрыва).
  • Числа пиши обычно: «8,4 млн ₸», «через 12 дней». Без таблиц и колонок.

ЧТО ТЫ ЗНАЕШЬ:
  • Остаток на конец дня = остаток вчера + поступления − списания.
  • Клиринговые задержки: карты 3–5 дней, SWIFT 2–3, SEPA 1–2.
  • Казахстанский банковский календарь, выходные и праздники.
  • Концепцию кассового разрыва, его глубину и стоимость резервов.

СТРУКТУРА ОТВЕТА (без заголовков):
  Первое предложение — главный вывод.
  Дальше пара фраз — почему так, на что опираешься в контексте.
  В конце — короткая рекомендация в одном предложении.

Никогда не цитируй формулу буквами и индексами. Объясняй смыслом.
""".strip()


def _build_context(
    opening_balance: float,
    sim: Simulation,
    contracts: Iterable[Contract],
    expenses: Iterable[Expense],
) -> str:
    payload = {
        "opening_balance": opening_balance,
        "min_balance": sim.min_balance,
        "min_balance_day": sim.min_balance_day,
        "gaps": [
            {"start": g.start, "end": g.end, "days": g.days, "max_depth": g.max_depth}
            for g in sim.gaps
        ],
        "upcoming_contracts": [
            {
                "title": c.title,
                "amount": c.amount,
                "currency": c.currency,
                "date": c.expected_date.isoformat(),
                "status": c.status,
            }
            for c in list(contracts)[:20]
        ],
        "upcoming_expenses": [
            {
                "title": e.title,
                "category": e.category,
                "amount": e.amount,
                "currency": e.currency,
                "date": e.due_date.isoformat(),
                "status": e.status,
            }
            for e in list(expenses)[:20]
        ],
    }
    return "ТЕКУЩИЙ КОНТЕКСТ КАЗНАЧЕЙСТВА:\n" + json.dumps(payload, ensure_ascii=False, indent=2)


def ask_gemini(
    question: str,
    opening_balance: float,
    sim: Simulation,
    contracts: Iterable[Contract],
    expenses: Iterable[Expense],
) -> str:
    if not settings.GEMINI_API_KEY:
        return (
            "[Gemini не настроен] Чтобы включить AI-ассистента, заполните "
            "GEMINI_API_KEY в .env и перезапустите сервер."
        )

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )
    context_block = _build_context(opening_balance, sim, contracts, expenses)
    prompt = f"{context_block}\n\nВОПРОС ПОЛЬЗОВАТЕЛЯ:\n{question}"
    resp = model.generate_content(prompt)
    return (resp.text or "").strip() or "Модель не вернула ответ."
