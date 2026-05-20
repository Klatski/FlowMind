import { useEffect, useState } from 'react';
import * as storage from './storage.js';
import { api } from './api.js';
import { clearAuth, DEMO_ACCOUNTS, findAccountByBin, setAuth } from './accounts.js';
import Dashboard from './components/Dashboard.jsx';
import AIChat from './components/AIChat.jsx';
import TelegramSetup from './components/TelegramSetup.jsx';
import Settings from './components/Settings.jsx';
import Login from './components/Login.jsx';

const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6"/>
    <rect x="11" y="2" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6"/>
    <rect x="2" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6"/>
    <rect x="11" y="11" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.6"/>
  </svg>
);
const IconAI = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2.5l1.8 5H17l-4.2 3 1.6 5L10 12.8l-4.4 2.7 1.6-5L3 7.5h5.2L10 2.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
);
const IconTelegram = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M2 10l15.5-7-5 15-4.5-5.5L2 10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M8 12.5l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);
const IconSettings = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const NAV = [
  { id: 'dashboard', label: 'Дашборд',  shortLabel: 'Дашборд',  icon: <IconDashboard /> },
  { id: 'assistant', label: 'AI Treasury', shortLabel: 'AI',      icon: <IconAI /> },
  { id: 'telegram',  label: 'Telegram',  shortLabel: 'Telegram',  icon: <IconTelegram /> },
  { id: 'settings',  label: 'Настройки', shortLabel: 'Настройки', icon: <IconSettings /> },
];

function SwitcherList({ account, onSwitch, onLogout }) {
  return (
    <div className="account-switcher">
      {DEMO_ACCOUNTS.filter((a) => a.bin !== account.bin).map((a) => (
        <button key={a.id} className="account-switch-item" onClick={() => onSwitch(a)}>
          <span className="account-avatar sm" style={{ background: `linear-gradient(135deg, ${a.accent}, rgba(11,21,48,0.5))` }}>
            {a.initials}
          </span>
          <span className="account-switch-text">
            <div className="account-name">{a.company_name}</div>
            <div className="account-meta">{a.short_tag}</div>
          </span>
        </button>
      ))}
      <button className="account-switch-item logout" onClick={onLogout}>
        <span className="account-avatar sm logout-avatar">⎋</span>
        <span className="account-switch-text">
          <div className="account-name">Выйти</div>
          <div className="account-meta">К экрану входа</div>
        </span>
      </button>
    </div>
  );
}

export default function App() {
  // Always start at login — no auto-login from localStorage
  const [account, setAccount] = useState(null);
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
    setSwitcherOpen(false);
  }

  function switchAccount(next) {
    setSwitcherOpen(false);
    if (next.bin === account?.bin) return;
    setAccount(next);
  }

  if (!account) return <Login onLogin={setAccount} />;
  if (!state) return <div style={{ padding: 40 }}>Загрузка кабинета {account.company_name}…</div>;

  const online = state.sync.online;
  const avatarStyle = { background: `linear-gradient(135deg, ${account.accent}, rgba(11,21,48,0.5))` };

  return (
    <div className="app" onClick={() => switcherOpen && setSwitcherOpen(false)}>

      {/* ── Mobile top header (hidden on desktop) ────────────────── */}
      <header className="app-header" onClick={(e) => e.stopPropagation()}>
        <div className="app-header-brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-name">FlowMind</div>
            <div className="brand-tag">Predictive Liquidity</div>
          </div>
        </div>

        <div className="app-header-right">
          <span className={`dot ${online ? 'online' : 'offline'}`} title={online ? 'Онлайн' : 'Оффлайн'} />
          <div className="account-card header-account-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="account-card-inner"
              onClick={() => setSwitcherOpen((s) => !s)}
              title="Аккаунт"
            >
              <div className="account-avatar" style={avatarStyle}>{account.initials}</div>
              <div className="account-info">
                <div className="account-name">{account.company_name}</div>
                <div className="account-meta">
                  {account.type === 'individual' ? 'ИИН' : 'БИН'} · {account.bin.slice(0, 6)} {account.bin.slice(6)}
                </div>
              </div>
              <div className={`account-chevron ${switcherOpen ? 'open' : ''}`}>▾</div>
            </button>
            {switcherOpen && (
              <SwitcherList account={account} onSwitch={switchAccount} onLogout={handleLogout} />
            )}
          </div>
        </div>
      </header>

      {/* ── Desktop sidebar (hidden on mobile) ───────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <div className="brand-name">FlowMind</div>
            <div className="brand-tag">Predictive Liquidity</div>
          </div>
        </div>

        <div className="account-card" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="account-card-inner"
            onClick={() => setSwitcherOpen((s) => !s)}
            title="Сменить аккаунт"
          >
            <div className="account-avatar" style={avatarStyle}>{account.initials}</div>
            <div className="account-info">
              <div className="account-name">{account.company_name}</div>
              <div className="account-meta">
                {account.type === 'individual' ? 'ИИН' : 'БИН'} · {account.bin.slice(0, 6)} {account.bin.slice(6)}
              </div>
            </div>
            <div className={`account-chevron ${switcherOpen ? 'open' : ''}`}>▾</div>
          </button>
          {switcherOpen && (
            <SwitcherList account={account} onSwitch={switchAccount} onLogout={handleLogout} />
          )}
        </div>

        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
            <span className="nav-item-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}

        <div className="nav-spacer" />
        <div className="sync-pill">
          <span className={`dot ${online ? 'online' : 'offline'}`} />
          {online ? 'Онлайн' : 'Оффлайн'}
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
            {state.sync.lastPushed
              ? 'Синхр: ' + new Date(state.sync.lastPushed).toLocaleTimeString('ru-RU')
              : 'Не синхронизировано'}
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
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

      {/* ── Mobile bottom nav (hidden on desktop) ────────────────── */}
      <nav className="bottom-nav" onClick={(e) => e.stopPropagation()}>
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`bottom-nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => { setTab(n.id); setSwitcherOpen(false); }}
          >
            <span className="bottom-nav-icon">{n.icon}</span>
            <span className="bottom-nav-label">{n.shortLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
