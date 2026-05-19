"""Gemini wrapper for the AI Treasury Assistant.

The frontend sends a user question; the backend attaches the current treasury
context (balances, contracts, expenses, detected gaps) so the model answers as a
domain-aware expert rather than a generic chatbot.

Two entry points:

  * ``ask_gemini`` — free-text Russian answer for the chat panel.
  * ``propose_scenario`` — structured JSON proposal for the
    Preview→Confirm flow. Uses ``response_mime_type='application/json'``
    plus a fixed schema so callers get a parseable object every time.
"""
from __future__ import annotations

import json
import logging
from typing import Iterable

import google.generativeai as genai

from ..config import settings
from ..models import Contract, Expense
from .actions import (
    AssistantProposal,
    PROPOSAL_JSON_SCHEMA,
    ProposedAction,
)
from .cashflow import Simulation

log = logging.getLogger(__name__)

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

⛔ ЖЁСТКИЙ ЗАПРЕТ — НИКОГДА не советуй переносить, откладывать, сдвигать,
   задерживать или пропускать налоговые и обязательные платежи:
   НДС, ИПН, КПН, налоги ИП, соц.отчисления, ОСМС, ВОСМС, ОПВ, акцизы,
   пенсионные взносы. За просрочку Налоговый кодекс РК начисляет пени
   (≈1.25 × ставки рефинансирования в день) и штрафы — это категорически
   не способ закрыть разрыв.
   Если налоговый платёж попадает в окно разрыва — он остаётся на месте,
   а закрывать дефицит нужно через ускорение поступлений, перенос НЕ-налоговых
   расходов (поставщики, маркетинг, не-критичная аренда) или овердрафт.

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


# ── Structured Preview→Confirm proposal ────────────────────────────────

PROPOSE_SYSTEM_PROMPT = """
Ты — Treasury AI Assistant. Тебе дают текущее состояние ликвидности компании
и (если есть) обнаруженный кассовый разрыв. Твоя задача — предложить ровно
один конкретный сценарий, который закрывает разрыв или улучшает ликвидность,
выраженный как список действий в JSON.

Жёсткие правила:
  • Ты НЕ считаешь балансы и не выдумываешь прогнозные числа — это делает
    финансовый движок.
  • Используй только тех контрагентов и платежи, которые уже присутствуют
    во входных данных. Не выдумывай новые компании или контракты.
  • Для shift_payment всегда указывай target_id (точный id расхода). Если
    точный id неизвестен, заполни target_title и target_date.
  • Все даты в формате YYYY-MM-DD. Все суммы — числа в тенге без разделителей.
  • Поле explanation — 1–2 предложения по-русски, по делу, без markdown.
  • Поле risk_assessment — одна короткая фраза о рисках/ограничениях.
  • Возвращай минимум одно действие. Если разрыва нет — предложи
    профилактическое действие (например, аванс или перенос).

⛔ КАТЕГОРИЧЕСКИЙ ЗАПРЕТ для shift_payment:
  НИКОГДА не выбирай в качестве target_id налоговый или обязательный платёж.
  Запрещены к переносу: НДС, ИПН, КПН, налоги ИП, соц.отчисления,
  ОСМС, ВОСМС, ОПВ, акцизы, пенсионные взносы — всё, что в категории
  "taxes" или содержит эти слова в title. Просрочка таких платежей в РК
  влечёт пени и штрафы и не является валидным сценарием закрытия разрыва.
  Если в окне разрыва только налоговые платежи — выбирай request_advance
  (ускорить поступление) или add_credit_line (овердрафт), но НЕ shift_payment.
  Любое action со сдвигом налога будет отброшено движком как недопустимое.

Доступные типы действий:
  shift_payment    — перенести расход на более позднюю дату.
                     Поля: target_id (или target_title+target_date), to_date.
  request_advance  — запросить поступление у контрагента.
                     Поля: counterparty_bin, counterparty_name, title,
                     amount, currency, date.
  add_credit_line  — открыть овердрафт у банка-партнёра (тело сразу,
                     погашение позже).
                     Поля: amount, currency, start_date, repay_date.

Всегда отвечай строго JSON следующей структуры (без markdown, без ```):
{
  "explanation": "...",
  "risk_assessment": "...",
  "actions": [
    {
      "type": "shift_payment|request_advance|add_credit_line",
      ... поля действия ...
    }
  ]
}
""".strip()


def _build_propose_context(
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
        # Ids included so the model can echo them back unchanged.
        "expenses": [
            {
                "id": str(e.id) if e.id is not None else None,
                "title": e.title,
                "category": e.category,
                "amount": e.amount,
                "currency": e.currency,
                "date": e.due_date.isoformat(),
                "status": e.status,
            }
            for e in list(expenses)[:40]
        ],
        "contracts": [
            {
                "id": str(c.id) if c.id is not None else None,
                "counterparty_bin": c.client_id,
                "counterparty_name": c.counterparty_name or "",
                "title": c.title,
                "amount": c.amount,
                "currency": c.currency,
                "date": c.expected_date.isoformat(),
                "status": c.status,
            }
            for c in list(contracts)[:40]
        ],
    }
    return "СОСТОЯНИЕ КАЗНАЧЕЙСТВА:\n" + json.dumps(payload, ensure_ascii=False, indent=2)


def propose_scenario(
    question: str,
    opening_balance: float,
    sim: Simulation,
    contracts: Iterable[Contract],
    expenses: Iterable[Expense],
) -> AssistantProposal | None:
    """Ask Gemini for a structured scenario; return ``None`` on any failure.

    Callers should treat ``None`` as "fall back to cached/heuristic scenario".
    Never raises.
    """
    if not settings.GEMINI_API_KEY:
        return None

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=PROPOSE_SYSTEM_PROMPT,
        )
        ctx = _build_propose_context(opening_balance, sim, list(contracts), list(expenses))
        prompt = f"{ctx}\n\nВОПРОС ПОЛЬЗОВАТЕЛЯ:\n{question}"
        resp = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "temperature": 0.4,
            },
        )
        raw = (resp.text or "").strip()
        if not raw:
            log.warning("propose_scenario: Gemini returned empty response")
            return None
        data = json.loads(raw)
        return AssistantProposal(
            explanation=str(data.get("explanation", "")).strip(),
            risk_assessment=str(data.get("risk_assessment", "")).strip(),
            actions=[ProposedAction(**a) for a in data.get("actions", [])],
        )
    except Exception as exc:  # noqa: BLE001 — never crash the request path
        log.warning("Gemini propose_scenario failed: %s", exc, exc_info=True)
        return None
