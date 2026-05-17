// Thin client for the FastAPI backend. Every call gracefully fails so the UI
// can fall back to LocalStorage and the in-browser simulator.

const BASE = '/api';

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

async function call(method, path, body) {
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return { ok: false, status: res.status, data: await safeJson(res) };
    return { ok: true, data: await safeJson(res) };
  } catch (err) {
    return { ok: false, offline: true, error: String(err) };
  }
}

export const api = {
  health: () => call('GET', '/health'),

  pull: () => call('GET', '/sync/pull'),
  push: (payload) => call('POST', '/sync/push', payload),

  ask: (question, horizonDays = 30) => call('POST', '/ai/ask', { question, horizon_days: horizonDays }),

  linkTelegram: () => call('POST', '/telegram/link'),
  linkStatus: (token) => call('GET', `/telegram/status/${token}`),
  sendAlert: (message) => call('POST', '/telegram/alert', { message }),
};
