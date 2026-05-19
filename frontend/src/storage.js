// Offline-first storage. LocalStorage is the source of truth in the browser.
// On startup we try to pull from the backend; on every mutation we debounce a
// push back. This is intentionally simple (last-write-wins) — appropriate for
// a single-user hackathon demo.
import { api } from './api.js';
import { seedData } from './seed.js';

const KEY = 'flowmind:v3';
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

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return { ...defaults(), ...JSON.parse(raw) };
  } catch { return null; }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

let state = read();
let pushTimer = null;

function notify() { for (const fn of listeners) fn(state); }
function schedulePush() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 1500);
}

export async function init() {
  if (!state) {
    state = { ...defaults(), ...seedData() };
    write(state);
  }
  notify();

  const pulled = await api.pull();
  if (pulled.ok && pulled.data && (pulled.data.contracts?.length || pulled.data.expenses?.length)) {
    state = {
      ...state,
      openingBalance: pulled.data.opening_balance || state.openingBalance,
      contracts: pulled.data.contracts.map((c) => ({ ...c, id: String(c.id) })),
      expenses: pulled.data.expenses.map((e) => ({ ...e, id: String(e.id) })),
      sync: { ...state.sync, lastPulled: new Date().toISOString(), online: true },
    };
    write(state);
    notify();
  } else {
    pushNow();
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function getState() { return state; }

export function patch(part) {
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

export async function pushNow() {
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

window.addEventListener('online', () => { patch({ sync: { ...state.sync, online: true } }); pushNow(); });
window.addEventListener('offline', () => { patch({ sync: { ...state.sync, online: false } }); });
