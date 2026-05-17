import { useEffect, useState } from 'react';
import * as storage from './storage.js';
import Dashboard from './components/Dashboard.jsx';
import AIChat from './components/AIChat.jsx';
import TelegramSetup from './components/TelegramSetup.jsx';
import Settings from './components/Settings.jsx';

const NAV = [
  { id: 'dashboard', label: 'Дашборд', icon: '📊' },
  { id: 'assistant', label: 'AI Treasury', icon: '🤖' },
  { id: 'telegram',  label: 'Telegram', icon: '✈️' },
  { id: 'settings',  label: 'Настройки', icon: '⚙️' },
];

export default function App() {
  const [state, setState] = useState(storage.getState());
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    const unsub = storage.subscribe(setState);
    storage.init();
    return unsub;
  }, []);

  if (!state) return <div style={{ padding: 40 }}>Загрузка…</div>;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-name">FlowMind</div>
            <div className="brand-tag">Predictive Liquidity</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
            <span>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <div className="nav-spacer" />
        <div className="sync-pill">
          <span className={`dot ${state.sync.online ? 'online' : 'offline'}`} />
          {state.sync.online ? 'Онлайн' : 'Оффлайн'}
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
            {state.sync.lastPushed
              ? 'Синхр: ' + new Date(state.sync.lastPushed).toLocaleTimeString('ru-RU')
              : 'Не синхронизировано'}
          </div>
        </div>
      </aside>

      <main className={`main ${tab === 'assistant' ? 'main-chat' : ''}`}>
        {tab === 'dashboard' && <Dashboard state={state} />}
        {tab === 'assistant' && <AIChat state={state} />}
        {tab === 'telegram'  && <TelegramSetup state={state} />}
        {tab === 'settings'  && <Settings state={state} />}
      </main>
    </div>
  );
}
