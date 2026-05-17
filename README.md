# FlowMind — Predictive Liquidity PWA

Treasury PWA that forecasts cash flow, flags cash gaps (CB_t < 0), recommends
concrete actions, exposes a Gemini-powered AI assistant, and pushes alerts to
Telegram. Full spec: [`FlowMind.md`](./FlowMind.md).

## Stack
| Layer    | Tech |
|----------|------|
| Frontend | React 18 + Vite, `vite-plugin-pwa`, Recharts, dark navy theme |
| Backend  | FastAPI + SQLModel (SQLite), `google-generativeai`, `python-telegram-bot` |
| Storage  | Offline-first LocalStorage on the client, synced with SQLite via `/api/sync` |
| AI       | Gemini (proxied — key never leaves the server) |
| Alerts   | Long-polling Telegram bot in a background thread + 60 s alert loop |

## One-time setup

### 1. Fill in secrets
Open the root `.env` (already created) and verify the two keys:
```
GEMINI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=YourBotUsername   # ← set this to your bot's @username
```
> **⚠️ Rotate the values you pasted into the chat — treat them as leaked.**
> Generate a new Gemini key at <https://aistudio.google.com/app/apikey>
> and reissue the bot token via `/revoke` in @BotFather on Telegram.

### 2. Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```
Backend lives at <http://127.0.0.1:8000>; `/api/health` reports whether
Gemini/Telegram are configured. On first start the SQLite DB is created and
seeded with the demo dataset.

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev
```
PWA dev server: <http://localhost:5173>. Vite proxies `/api/*` to the backend.
Open the page in Chrome → install as PWA from the address bar.

## How the pieces talk
```
Browser (React PWA, LocalStorage)
   │   fetch /api/...
   ▼
FastAPI (uvicorn)
 ├── /api/contracts, /api/expenses  → CRUD
 ├── /api/cashflow/simulate         → CB_t series + gap windows
 ├── /api/cashflow/advise           → "Что делать?" suggestions
 ├── /api/ai/ask                    → Gemini, with treasury context
 ├── /api/telegram/link             → QR + deep link
 └── /api/sync/{push,pull}          → bulk offline sync
        │
        ├─ telegram_bot (thread)     → /start <token> binds chat
        └─ alerts (asyncio task)     → every 60 s: re-simulate, push on new gap
```
The cash-flow simulator (`CB_t = CB_{t-1} + I_t − O_t`) exists in two places by
design: `backend/app/services/cashflow.py` is authoritative; `frontend/src/cashflow.js`
mirrors it so the UI re-renders instantly and keeps working fully offline.

## Demo data
First launch seeds 6 contracts and 9 expenses calibrated to produce a visible
red cash gap around day 12. Reset from `Настройки → Загрузить демо-данные`.

## Project layout
```
backend/
  app/
    main.py            — FastAPI app + lifespan (init DB, seed, start bot, start alerts)
    config.py          — pydantic-settings (loads ../.env)
    db.py, models.py
    routes/            — contracts, expenses, cashflow, ai, telegram, sync
    services/
      cashflow.py      — simulator (authoritative)
      advisor.py       — "Что делать?" engine
      gemini.py        — Gemini wrapper + system prompt
      telegram_bot.py  — long-polling bot
      seed.py
    alerts.py          — background gap-detection → Telegram push
  run.py
  requirements.txt
  .env.example

frontend/
  src/
    App.jsx            — sidebar + tabs
    cashflow.js        — client-side simulator + advisor (mirror of backend)
    storage.js         — LocalStorage + debounced sync
    seed.js            — same demo data as backend
    api.js             — backend client
    components/
      Dashboard.jsx, Timeline.jsx
      ContractsTable.jsx, ExpensesTable.jsx
      AIChat.jsx, TelegramSetup.jsx, Settings.jsx
    styles.css
  vite.config.js       — PWA manifest + /api proxy
  index.html, package.json
```

## Notes
* The Telegram QR/deep link uses the bot username from `.env` — set
  `TELEGRAM_BOT_USERNAME` before generating links.
* PNG icons in `frontend/public/` are placeholders — replace with real assets
  before shipping.
* The alerts loop dedupes by gap signature, so users don't get spammed on every
  iteration; a new alert only fires when the gap window changes.
