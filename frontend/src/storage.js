// Offline-first storage. Each account has its own slot in localStorage; the
// current session points at one of them via the auth record. On switch/login
// we load the right slot and push it to the backend so AI/sync work against
// the active account's data.
import { api } from './api.js';
import { dataKey, seedForAccount, getAuth as readAuth } from './accounts.js';

const listeners = new Set();

function defaults() {
  return {
    openingBalance: 0,
    contracts: [],
    expenses: [],
    chatHistory: [],
    telegram: { token: null, deepLink: null, qr: null, linked: false },
    sync: { lastPulled: null, lastPushed: null, online: navigator.onLine },
  };
}

function currentKey() {
  const auth = readAuth();
  return auth?.bin ? dataKey(auth.bin) : null;
}

function read() {
  const key = currentKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return { ...defaults(), ...JSON.parse(raw) };
  } catch { return null; }
}

function write(s) {
  const key = currentKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(s));
}

let state = read();
let pushTimer = null;

function notify() { for (const fn of listeners) fn(state); }
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 1500);
}

/**
 * Initialize storage for the currently-authenticated account.
 * If localStorage has data for this account, use it; otherwise seed it from
 * the account-specific demo dataset. Then sync with the backend.
 */
export async function init(account) {
  if (!account) {
    state = null;
    notify();
    return;
  }

  state = read();
  if (!state) {
    state = { ...defaults(), ...seedForAccount(account) };
    write(state);
  }
  notify();

  // Push our local truth to the backend so AI/sync see this account's data.
  // Backend is single-tenant, so we own the slot while logged in.
  await pushNow();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() { return state; }

export function patch(part) {
  if (!state) return;
  state = { ...state, ...part };
  write(state);
  notify();
  schedulePush();
}

export function addContract(c) {
  const id = 'c' + Date.now();
  patch({ contracts: [...state.contracts, { id, ...c }] });
}
export function updateContract(id, c) {
  patch({ contracts: state.contracts.map((x) => (x.id === id ? { ...x, ...c } : x)) });
}
export function removeContract(id) {
  patch({ contracts: state.contracts.filter((x) => x.id !== id) });
}

export function addExpense(e) {
  const id = 'e' + Date.now();
  patch({ expenses: [...state.expenses, { id, ...e }] });
}
export function updateExpense(id, e) {
  patch({ expenses: state.expenses.map((x) => (x.id === id ? { ...x, ...e } : x)) });
}
export function removeExpense(id) {
  patch({ expenses: state.expenses.filter((x) => x.id !== id) });
}

export function setOpeningBalance(v) { patch({ openingBalance: Number(v) || 0 }); }

export function appendChat(role, content) {
  patch({ chatHistory: [...state.chatHistory, { role, content, ts: new Date().toISOString() }] });
}

export function setTelegram(part) {
  patch({ telegram: { ...state.telegram, ...part } });
}

/** Clear in-memory state (used on logout). LocalStorage slot is preserved. */
export function detach() {
  state = null;
  clearTimeout(pushTimer);
  notify();
}

export async function pushNow() {
  if (!state) return;
  const res = await api.push({
    opening_balance: state.openingBalance,
    contracts: state.contracts.map(stripIdForSync),
    expenses: state.expenses.map(stripIdForSync),
  });
  if (res.ok) {
    state = { ...state, sync: { ...state.sync, lastPushed: new Date().toISOString(), online: true } };
    write(state);
    notify();
  } else {
    state = { ...state, sync: { ...state.sync, online: false } };
    write(state);
    notify();
  }
}

function stripIdForSync({ id, updated_at, ...rest }) { return rest; }

window.addEventListener('online', () => { if (state) { patch({ sync: { ...state.sync, online: true } }); pushNow(); } });
window.addEventListener('offline', () => { if (state) patch({ sync: { ...state.sync, online: false } }); });
