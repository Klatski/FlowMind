import { useState } from 'react';
import * as storage from '../storage.js';
import { fmt } from '../cashflow.js';
import { seedForAccount } from '../accounts.js';
import PageHeader from './PageHeader.jsx';

export default function Settings({ state, account, onLogout }) {
  const [bal, setBal] = useState(String(state.openingBalance));

  function save() { storage.setOpeningBalance(bal); }
  function resync() { storage.pushNow(); }
  function reseed() {
    if (!confirm(`Сбросить данные «${account.company_name}» и загрузить демо-набор?`)) return;
    const seed = seedForAccount(account);
    storage.patch({
      openingBalance: seed.openingBalance,
      contracts: seed.contracts,
      expenses: seed.expenses,
      chatHistory: seed.chatHistory,
    });
  }
  function wipe() {
    if (!confirm('Полностью очистить все данные этого аккаунта? Это нельзя отменить.')) return;
    storage.patch({ openingBalance: 0, contracts: [], expenses: [], chatHistory: [] });
  }

  return (
    <>
      <PageHeader title="Настройки" sub="Управление аккаунтом и локальными данными." />

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Текущий аккаунт</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          <div className="account-avatar" style={{ background: `linear-gradient(135deg, ${account.accent}, rgba(11,21,48,0.5))`, width: 52, height: 52, fontSize: 18 }}>
            {account.initials}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{account.company_name}</div>
            <div className="kpi-sub">
              {account.type === 'individual' ? 'ИИН' : 'БИН'} · {account.bin.slice(0, 6)} {account.bin.slice(6)} · {account.role}
            </div>
            <div className="kpi-sub">Пользователь: {account.user_name}</div>
          </div>
          <button className="btn ghost" onClick={onLogout}>⎋ Выйти из аккаунта</button>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Стартовый остаток на счёте</h3>
          <p className="kpi-sub">Текущее значение: {fmt(state.openingBalance)} ₸</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number" min="0" step="1" value={bal}
              onChange={(e) => setBal(e.target.value)}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.04)', color: 'inherit',
                border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
              }}
            />
            <button className="btn" onClick={save}>Сохранить</button>
          </div>
        </div>

        <div className="card">
          <h3>Синхронизация</h3>
          <p className="kpi-sub">
            Статус: {state.sync.online ? 'онлайн' : 'оффлайн'} ·
            последний push: {state.sync.lastPushed ? new Date(state.sync.lastPushed).toLocaleString('ru-RU') : '—'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={resync}>↻ Принудительный push</button>
            <button className="btn ghost" onClick={reseed}>Загрузить демо-данные</button>
            <button className="btn danger" onClick={wipe}>Очистить всё</button>
          </div>
        </div>
      </div>
    </>
  );
}
