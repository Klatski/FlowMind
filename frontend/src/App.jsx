import { useEffect, useState } from 'react';
import * as storage from './storage.js';
import { api } from './api.js';
import Dashboard from './components/Dashboard.jsx';
import AIChat from './components/AIChat.jsx';
import TelegramSetup from './components/TelegramSetup.jsx';
import Settings from './components/Settings.jsx';

const NAV = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'assistant', label: 'AI Treasury' },
  { id: 'telegram',  label: 'Telegram' },
  { id: 'settings',  label: 'Настройки' },
];

export default function App() {
  const [state, setState] = useState(storage.getState());
  const [tab, setTab] = useState('dashboard');
  const [horizon, setHorizon] = useState(30);
  const [proposal, setProposal] = useState(null);
  const [proposalError, setProposalError] = useState(null);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    const unsub = storage.subscribe(setState);
    storage.init();
    return unsub;
  }, []);

  async function requestProposal(question, { switchToDashboard = false } = {}) {
    if (switchToDashboard) setTab('dashboard');
    setProposing(true);
    setProposalError(null);
    const res = await api.propose(question, horizon);
    setProposing(false);
    if (!res.ok || !res.data?.ok) {
      setProposalError(res.data?.reason === 'gemini_unavailable'
        ? 'Gemini не настроен или вернул пустой ответ. Проверьте GEMINI_API_KEY.'
        : 'Не удалось получить сценарий от AI.');
      setProposal(null);
      return;
    }
    setProposal(res.data);
  }

  function clearProposal() { setProposal(null); setProposalError(null); }

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
            <span>{n.label}</span>
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
        {tab === 'dashboard' && (
          <Dashboard
            state={state}
            horizon={horizon}
            setHorizon={setHorizon}
            proposal={proposal}
            proposing={proposing}
            proposalError={proposalError}
            requestProposal={(q) => requestProposal(q)}
            clearProposal={clearProposal}
          />
        )}
        {tab === 'assistant' && (
          <AIChat
            state={state}
            proposing={proposing}
            onShowOnChart={(q) => requestProposal(q, { switchToDashboard: true })}
          />
        )}
        {tab === 'telegram'  && <TelegramSetup state={state} />}
        {tab === 'settings'  && <Settings state={state} />}
      </main>
    </div>
  );
}
