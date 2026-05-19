# FlowMind — AI Treasury Assistant: Preview & Confirm Architecture

> **Status:** target architecture. The cash-flow simulator, Gemini chat, and
> gap detection are built. The structured-action layer (JSON proposals,
> `apply_actions`, dual-curve preview, Apply button) is the next milestone
> and is marked `Planned` per section below.

## Design Principle

The Gemini-powered assistant does **not** execute changes directly on the
liquidity model. Instead, it follows a **Preview → Confirm** pattern:

1. The user asks a question or describes a scenario in natural language.
2. Gemini returns a **structured action proposal** (JSON), not free text.
3. The Python backend simulates the proposed actions against the cash-flow
   model and renders a **preview curve** alongside the current one.
4. The user explicitly clicks **"Apply"** to commit the scenario.

This matches how real treasury teams operate: AI suggests, humans decide.
It is also stronger as a demo: the side-by-side curves (solid = current,
dashed = preview) make the value of each recommendation visually obvious.

## Responsibility Split

| Component | Owns |
|-----------|------|
| **Gemini** | Natural language understanding, scenario *proposal* |
| **Python backend** | All financial math, balance simulation, action application |
| **Frontend (PWA)** | Dual-curve rendering, action buttons, user confirmation |

Gemini never computes balances. It only names *what to do*; the engine
calculates *what happens*. This keeps numbers accurate and token cost low.

## Structured Output from Gemini  `Planned`

Gemini is called with `response_mime_type: "application/json"` and a fixed
`response_schema`, so the model is guaranteed to return parseable JSON.

Example response:

```json
{
  "explanation": "Перенос аренды с 8-го на 16-е закрывает разрыв 12-го числа.",
  "risk_assessment": "Низкий — договор аренды разрешает оплату до 20-го.",
  "actions": [
    {
      "type": "shift_payment",
      "target_id": "rent_may",
      "from_date": "2026-05-08",
      "to_date": "2026-05-16",
      "amount": 3000000,
      "currency": "KZT"
    }
  ]
}
```

The `actions` array uses an internal vocabulary the Python engine
understands. The MVP supports three action types — enough to demo every
realistic recovery scenario:

- `shift_payment` — move an outflow to a later date
- `request_advance` — add an inflow from a counterparty
- `add_credit_line` — inject an overdraft (inflow + scheduled repayment)

## Backend Flow  `Partial — simulate() exists, apply_actions() planned`

The simulation engine exposes two pure functions:

```
simulate(operations, opening_balance) -> list[BalancePoint]   # built
apply_actions(operations, actions)    -> list[Operation]      # planned
```

Today `simulate()` lives in `backend/app/services/cashflow.py` and is
mirrored client-side in `frontend/src/cashflow.js`. The runtime sequence
on every assistant turn is planned to be:

1. `current = simulate(ops, balance)`           — solid line
2. `actions = call_gemini(state, user_message)` — JSON proposal
3. `preview_ops = apply_actions(ops, actions)`
4. `preview = simulate(preview_ops, balance)`   — dashed line
5. On user confirmation: `ops := preview_ops`

The preview line is computed locally by the engine — never by the LLM —
so the numbers shown on the chart are always trustworthy.

## Frontend Behavior  `Planned`

- The dashboard renders both curves on the same timeline.
- The red "Cash Gap" highlight disappears on the preview curve when the
  proposed actions resolve the deficit — the core wow moment.
- The action button is generated from the JSON payload itself:
  `"Перенести аренду на 16 мая"` rather than a generic "Применить".
- A secondary "Предложить другой вариант" button re-prompts Gemini with
  the rejected proposal in context, producing a different scenario.

## System Prompt (Gemini)  `Built — free-text variant; structured variant planned`

The model is constrained with a strict role definition:

> You are a Treasury AI Assistant. You receive the company's current
> liquidity state and a detected cash gap. Your task is to propose
> exactly one concrete scenario that closes the gap, expressed as a
> JSON action list following the provided schema. You do not compute
> balances — the financial engine handles that. Do not invent
> counterparties or contracts that are not present in the input.

The current Russian free-text prompt lives in
`backend/app/services/gemini.py` and will be replaced with the structured
variant when the JSON schema lands.

## Reliability Notes

- **Cached fallback scenarios.**  `Planned` — a small set of pre-computed
  recommendations bundled with the app, keyed by gap shape (size, timing,
  recurrence). If the Gemini call fails during the demo, the UI degrades
  gracefully to a deterministic suggestion. Today, the heuristic
  `advise()` in `cashflow.js` plays a similar role for the dashboard's
  "Что делать?" panel.
- **Ignore Gemini's numeric predictions.** Fields like
  `expected_min_balance_after` may be used for narrative phrasing only.
  All chart values come from the Python engine.
- **API keys must be rotated.** Both the Gemini key and the Telegram
  bot token were exposed in the project brief and should be revoked
  before any public demo or repository push.

## Why This Wins on the Demo Stage

The judge sees a recruiter-friendly story in under 30 seconds:

1. A red gap appears on the timeline three days ahead.
2. The user types *"как избежать разрыва?"*
3. The assistant proposes a specific, named action with a one-line
   rationale.
4. A ghost curve appears — gap gone.
5. One click commits the change.

The math is real, the AI is bounded, and the human stays in control —
which is exactly the maturity level a treasury product needs to show.
