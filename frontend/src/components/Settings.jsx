import { useState } from 'react';
import * as storage from '../storage.js';
import { fmt } from '../cashflow.js';
import { seedData } from '../seed.js';
import PageHeader from './PageHeader.jsx';

export default function Settings({ state }) {
  const [bal, setBal] = useState(String(state.openingBalance));

  function save() { storage.setOpeningBalance(bal); }
  function resync() { storage.pushNow(); }
  function reseed() {
    if (!confirm('Сбросить локальные данные и загрузить демо-набор?')) return;
    const seed = seedData();
    storage.patch({
      openingBalance: seed.openingBalance,
      contracts: seed.contracts,
      expenses: seed.expenses,
      chatHistory: seed.chatHistory,
    });
  }
  function wipe() {
    if (!confirm('Полностью очистить все данные? Это нельзя отменить.')) return;
    storage.patch({ openingBalance: 0, contracts: [], expenses: [], chatHistory: [] });
  }

  return (
    <>
      <PageHeader title="Настройки" sub="Стартовый остаток и управление локальными данными." />

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
