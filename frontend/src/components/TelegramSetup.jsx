import { useEffect, useState } from 'react';
import { api } from '../api.js';
import * as storage from '../storage.js';
import PageHeader from './PageHeader.jsx';

export default function TelegramSetup({ state }) {
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const tg = state.telegram;

  async function generate() {
    setBusy(true);
    const res = await api.linkTelegram();
    if (res.ok) {
      storage.setTelegram({
        token: res.data.user_token,
        deepLink: res.data.deep_link,
        qr: res.data.qr_png_base64,
        botUsername: res.data.bot_username,
        linked: false,
      });
    } else {
      setStatusMsg('Не удалось связаться с backend.');
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!tg.token || tg.linked) return undefined;
    const t = setInterval(async () => {
      const res = await api.linkStatus(tg.token);
      if (res.ok && res.data.linked) {
        storage.setTelegram({ linked: true, username: res.data.username });
        clearInterval(t);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [tg.token, tg.linked]);

  async function testAlert() {
    setBusy(true);
    const res = await api.sendAlert(
      '🔔 Тест FlowMind: alert-канал работает. Проверка с дашборда.',
    );
    setStatusMsg(res.ok ? `Отправлено в ${res.data.sent} чат(ов).` : 'Ошибка отправки.');
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        title="Telegram-оповещения"
        sub="Бот моментально присылает push-уведомление, как только система обнаруживает прогнозный кассовый разрыв."
      />

      <div className="card">
        {!tg.token && (
          <>
            <p>Сгенерируйте уникальную ссылку, чтобы привязать ваш Telegram-аккаунт к FlowMind.</p>
            <button className="btn" onClick={generate} disabled={busy}>
              {busy ? 'Создание…' : '➕ Сгенерировать QR / ссылку'}
            </button>
          </>
        )}

        {tg.token && (
          <div className="qr-box">
            {tg.qr && <img src={`data:image/png;base64,${tg.qr}`} alt="QR в Telegram" />}
            <div style={{ flex: 1 }}>
              <h3>Шаг 1 — Откройте бота</h3>
              <p>
                <a href={tg.deepLink} target="_blank" rel="noreferrer">{tg.deepLink}</a>
              </p>
              <h3>Шаг 2 — Нажмите Start</h3>
              <p style={{ color: 'var(--text-2)' }}>
                Токен <code>{tg.token}</code> будет передан боту автоматически.
              </p>

              <div style={{ marginTop: 16 }}>
                {tg.linked
                  ? <span className="tag success">✓ Связано {tg.username ? `@${tg.username}` : ''}</span>
                  : <span className="tag">Ожидаем подключения…</span>}
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button className="btn ghost" onClick={generate} disabled={busy}>Сгенерировать новый</button>
                <button className="btn" onClick={testAlert} disabled={busy || !tg.linked}>📨 Отправить тестовый alert</button>
              </div>
              {statusMsg && <div style={{ marginTop: 10, color: 'var(--text-2)' }}>{statusMsg}</div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
