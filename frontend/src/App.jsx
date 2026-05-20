import { useEffect, useState } from 'react';
import * as storage from './storage.js';
import { api } from './api.js';
import { clearAuth, DEMO_ACCOUNTS, findAccountByBin, getAuth, setAuth } from './accounts.js';
import Dashboard from './components/Dashboard.jsx';
import AIChat from './components/AIChat.jsx';
import TelegramSetup from './components/TelegramSetup.jsx';
import Settings from './components/Settings.jsx';
import Login from './components/Login.jsx';

const NAV = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'assistant', label: 'AI Treasury' },
  { id: 'telegram',  label: 'Telegram' },
  { id: 'settings',  label: 'Настройки' },
];

export default function App() {
  const [account, setAccount] = useState(() => {
    const auth = getAuth();
    return auth ? findAccountByBin(auth.bin) : null;
  });
  const [state, setState] = useState(storage.getState());
  const [tab, setTab] = useState('dashboard');
  const [horizon, setHorizon] = useState(30);
  const [proposal, setProposal] = useState(null);
  const [proposalError, setProposalError] = useState(null);
  const [proposing, setProposing] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => {
    const unsub = storage.subscribe(setState);
    return unsub;
  }, []);

  useEffect(() => {
    if (account) {
      setAuth({ bin: account.bin, accountId: account.id, loggedInAt: new Date().toISOString() });
      storage.init(account);
      setTab('dashboard');
      clearProposal();
    } else {
      storage.detach();
    }
  }, [account?.bin]);

  async function requestProposal(question, { switchToDashboard = false } = {}) {
    if (switchToDashboard) setTab('dashboard');
    setProposing(true);
    setProposalError(null);
    const res = await api.propose(question, horizon);
    setProposing(false);
    if (!res.ok || !res.data?.ok) {
      const reason = res.data?.reason;
      let message = 'Не удалось получить сценарий от AI.';
      if (reason === 'gemini_unavailable') {
        message = 'Gemini не настроен или вернул пустой ответ. Проверьте GEMINI_API_KEY.';
      } else if (reason === 'not_improving') {
        message = 'AI не нашёл сценарий, который улучшил бы прогноз — все варианты ухудшают баланс. Текущий план уже лучше.';
      }
      setProposalError(message);
      setProposal(null);
      return;
    }
    setProposal(res.data);
  }

  function clearProposal() { setProposal(null); setProposalError(null); }

  function handleLogout() {
    clearAuth();
    setAccount(null);
  }

  function switchAccount(next) {
    setSwitcherOpen(false);
    if (next.bin === account?.bin) return;
    setAccount(next);
  }

  if (!account) {
    return <Login onLogin={setAccount} />;
  }

  if (!state) return <div style={{ padding: 40 }}>Загрузка кабинета {account.company_name}…</div>;

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

        <div className="account-card">
          <button
            type="button"
            className="account-card-inner"
            onClick={() => setSwitcherOpen((s) => !s)}
            title="Сменить аккаунт"
          >
            <div className="account-avatar" style={{ background: `linear-gradient(135deg, ${account.accent}, rgba(11,21,48,0.5))` }}>
              {account.initials}
            </div>
            <div className="account-info">
              <div className="account-name">{account.company_name}</div>
              <div className="account-meta">
                {account.type === 'individual' ? 'ИИН' : 'БИН'} · {account.bin.slice(0, 6)} {account.bin.slice(6)}
              </div>
            </div>
            <div className={`account-chevron ${switcherOpen ? 'open' : ''}`}>▾</div>
          </button>
          {switcherOpen && (
            <div className="account-switcher">
              {DEMO_ACCOUNTS.filter((a) => a.bin !== account.bin).map((a) => (
                <button key={a.id} className="account-switch-item" onClick={() => switchAccount(a)}>
                  <span className="account-avatar sm" style={{ background: `linear-gradient(135deg, ${a.accent}, rgba(11,21,48,0.5))` }}>
                    {a.initials}
                  </span>
                  <span className="account-switch-text">
                    <div className="account-name">{a.company_name}</div>
                    <div className="account-meta">{a.short_tag}</div>
                  </span>
                </button>
              ))}
              <button className="account-switch-item logout" onClick={handleLogout}>
                <span className="account-avatar sm logout-avatar">⎋</span>
                <span className="account-switch-text">
                  <div className="account-name">Выйти</div>
                  <div className="account-meta">К экрану входа</div>
                </span>
              </button>
            </div>
          )}
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
        {tab === 'settings'  && <Settings state={state} account={account} onLogout={handleLogout} />}
      </main>
    </div>
  );
}
