import { useState } from 'react';
import {
  DEMO_ACCOUNTS,
  findAccountByBin,
  isBinLength,
  isValidKzBin,
  normalizeBin,
  verifyCredentials,
} from '../accounts.js';

export default function Login({ onLogin }) {
  const [bin, setBin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleaned = normalizeBin(bin);
    if (!isBinLength(cleaned)) {
      setError('БИН/ИИН должен содержать ровно 12 цифр.');
      return;
    }
    if (!isValidKzBin(cleaned)) {
      setError('Некорректный БИН/ИИН — не сходится контрольная сумма.');
      return;
    }
    if (!findAccountByBin(cleaned)) {
      setError('Аккаунт не найден. Используйте один из демо-аккаунтов ниже.');
      return;
    }
    if (!password.trim()) {
      setError('Введите пароль.');
      return;
    }

    const res = verifyCredentials(cleaned, password);
    if (!res.ok) {
      setError(res.reason === 'bad_password' ? 'Неверный пароль.' : 'Не удалось войти.');
      return;
    }
    onLogin(res.account);
  }

  function formatBin(raw) {
    const n = normalizeBin(raw).slice(0, 12);
    if (n.length <= 6) return n;
    return n.slice(0, 6) + ' ' + n.slice(6);
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-shell">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark" style={{ width: 48, height: 48, borderRadius: '50%' }} />
            <div>
              <div className="login-brand-name">FlowMind</div>
              <div className="login-brand-tag">Predictive Liquidity для финтех-команд</div>
            </div>
          </div>

          <h1 className="login-title">Вход в кабинет</h1>
          <p className="login-sub">
            Войдите по БИН (бизнес) или ИИН (индивидуальный предприниматель) и паролю.
            FlowMind подтянет ваш прогноз ликвидности на 30 дней.
          </p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>БИН / ИИН</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="180440 012349"
                value={formatBin(bin)}
                onChange={(e) => { setBin(e.target.value); setError(''); }}
                className="login-input"
                maxLength={13}
              />
            </label>

            <label className="login-field">
              <span>Пароль</span>
              <div className="login-pass-wrap">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Ваш пароль"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="login-input"
                />
                <button
                  type="button"
                  className="login-pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                  title={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </label>

            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn login-submit">Войти</button>
          </form>

          <div className="login-divider"><span>Или попробуйте демо-аккаунты</span></div>

          <div className="demo-grid">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="demo-card"
                onClick={() => onLogin(a)}
              >
                <div className="demo-avatar" style={{ background: `linear-gradient(135deg, ${a.accent}, rgba(11,21,48,0.6))` }}>
                  {a.initials}
                </div>
                <div className="demo-info">
                  <div className="demo-name">{a.company_name}</div>
                  <div className="demo-bin">
                    {a.type === 'individual' ? 'ИИН' : 'БИН'} · {a.bin.slice(0, 6)} {a.bin.slice(6)}
                  </div>
                  <div className="demo-pass">
                    пароль: <code>{a.password}</code>
                  </div>
                </div>
                <div className="demo-arrow">→</div>
              </button>
            ))}
          </div>

          <div className="login-foot">
            Демо-данные не отправляются никуда, кроме вашего бэкенда FlowMind.
          </div>
        </div>
      </div>
    </div>
  );
}
