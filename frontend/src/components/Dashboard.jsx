import { useMemo, useState } from 'react';
import { advise, fmt, simulate } from '../cashflow.js';
import * as storage from '../storage.js';
import { api } from '../api.js';
import Timeline from './Timeline.jsx';
import ContractsTable from './ContractsTable.jsx';
import ExpensesTable from './ExpensesTable.jsx';
import PageHeader from './PageHeader.jsx';
import FormulaRef from './FormulaRef.jsx';

export default function Dashboard({ state }) {
  const [horizon, setHorizon] = useState(30);
  const [proposal, setProposal] = useState(null);   // { explanation, risk_assessment, actions, applied, skipped, preview }
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState(null);

  const sim = useMemo(
    () => simulate({
      openingBalance: state.openingBalance,
      contracts: state.contracts,
      expenses: state.expenses,
    }, new Date(), horizon),
    [state.openingBalance, state.contracts, state.expenses, horizon],
  );

  const suggestions = useMemo(
    () => advise({ openingBalance: state.openingBalance, contracts: state.contracts, expenses: state.expenses }, sim),
    [state.openingBalance, state.contracts, state.expenses, sim],
  );

  const totalIn = state.contracts.filter((c) => c.status !== 'received').reduce((s, c) => s + Number(c.amount), 0);
  const totalOut = state.expenses.filter((e) => e.status === 'scheduled').reduce((s, e) => s + Number(e.amount), 0);
  const hasGap = sim.gaps.length > 0;
  const firstGap = sim.gaps[0];

  function applySuggestion(s) {
    if (s.kind === 'defer_expense' && s.payload?.expense_id != null) {
      const e = state.expenses.find((x) => String(x.id) === String(s.payload.expense_id));
      if (e) storage.updateExpense(e.id, { ...e, due_date: s.payload.to_date, status: 'deferred' });
    }
  }

  async function requestProposal() {
    setProposing(true);
    setProposeError(null);
    const question = hasGap
      ? `Закрой кассовый разрыв ${firstGap.start}–${firstGap.end} (глубина ${firstGap.max_depth} ₸). Предложи один сценарий.`
      : 'Предложи действие для улучшения ликвидности на ближайшие 30 дней.';
    const res = await api.propose(question, horizon);
    setProposing(false);
    if (!res.ok || !res.data?.ok) {
      setProposeError(res.data?.reason === 'gemini_unavailable'
        ? 'Gemini не настроен или вернул пустой ответ. Проверьте GEMINI_API_KEY.'
        : 'Не удалось получить сценарий от AI.');
      setProposal(null);
      return;
    }
    setProposal(res.data);
  }

  function clearProposal() { setProposal(null); setProposeError(null); }

  const previewSeries = proposal?.preview?.series || null;
  const previewGaps = proposal?.preview?.gaps || null;

  return (
    <>
      <PageHeader
        title="Дашборд ликвидности"
        sub={`Прогноз на ${horizon} дней. Красные участки — кассовые разрывы (баланс ниже нуля).`}
        actions={<FormulaRef />}
      />

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>Текущий остаток</h3>
          <div className="kpi">{fmt(state.openingBalance)} ₸</div>
          <div className="kpi-sub">Стартовая точка прогноза</div>
        </div>
        <div className="card">
          <h3>Минимальный баланс ({horizon} дн)</h3>
          <div className={'kpi ' + (sim.minBalance < 0 ? 'danger' : 'success')}>
            {fmt(sim.minBalance)} ₸
          </div>
          <div className="kpi-sub">
            {sim.minBalanceDay ? `Достигается ${sim.minBalanceDay}` : 'Просадки не прогнозируются'}
          </div>
        </div>
        <div className="card">
          <h3>Прогноз кассового разрыва</h3>
          {hasGap ? (
            <>
              <div className="kpi danger">{fmt(firstGap.max_depth)} ₸</div>
              <div className="kpi-sub">
                Окно {firstGap.start} — {firstGap.end} ({firstGap.days} дн.) ·{' '}
                <span className="tag danger">⚠ Cash Gap</span>
              </div>
            </>
          ) : (
            <>
              <div className="kpi success">Нет</div>
              <div className="kpi-sub">Все обязательства покрыты <span className="tag success">OK</span></div>
            </>
          )}
        </div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px 10px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Интерактивный Timeline</h3>
              <div className="kpi-sub">Поступления: +{fmt(totalIn)} ₸ · Списания: −{fmt(totalOut)} ₸</div>
            </div>
            <select
              className="select-pill"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            >
              <option value={14}>14 дней</option>
              <option value={30}>30 дней</option>
              <option value={60}>60 дней</option>
              <option value={90}>90 дней</option>
            </select>
          </div>
          <Timeline series={sim.series} gaps={sim.gaps}
                    previewSeries={previewSeries} previewGaps={previewGaps} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 10px 4px', flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={requestProposal} disabled={proposing}>
              {proposing ? 'AI думает…' : '✨ AI-сценарий'}
            </button>
            {proposal && (
              <button className="btn sm ghost" onClick={clearProposal}>Скрыть превью</button>
            )}
            {proposeError && (
              <span style={{ color: 'var(--danger)', fontSize: 12 }}>{proposeError}</span>
            )}
            {proposal && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Бирюзовая пунктирная линия — прогноз после применения сценария.
              </span>
            )}
          </div>
          {proposal && (
            <div className="suggestion" style={{ margin: '10px 10px 6px', borderColor: 'rgba(34, 211, 238, 0.4)' }}>
              <div className="head" style={{ color: '#22d3ee' }}>AI-сценарий (предпросмотр)</div>
              <div className="detail">{proposal.explanation}</div>
              {proposal.risk_assessment && (
                <div className="meta"><span>Риск:</span><span style={{ color: 'var(--text-2)' }}>{proposal.risk_assessment}</span></div>
              )}
              {proposal.applied?.length > 0 && (
                <ul style={{ margin: '4px 0 0 18px', color: 'var(--text-2)', fontSize: 12 }}>
                  {proposal.applied.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              )}
              {proposal.skipped?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  Пропущено: {proposal.skipped.join('; ')}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Что делать? — рекомендации</h3>
          {suggestions.length === 0 && (
            <div className="empty">Разрывы не обнаружены — рекомендаций нет.</div>
          )}
          <div className="advisor">
            {suggestions.slice(0, 6).map((s, i) => (
              <div key={i} className={'suggestion ' + (s.kind === 'overdraft' ? 'danger' : '')}>
                <div className="head">{s.headline}</div>
                <div className="detail">{s.detail}</div>
                <div className="meta">
                  <span>Эффект ≈ {fmt(s.impact)} ₸</span>
                  <span>·</span>
                  <span>{labelKind(s.kind)}</span>
                  {s.kind === 'defer_expense' && (
                    <button className="btn sm" style={{ marginLeft: 'auto' }} onClick={() => applySuggestion(s)}>
                      Применить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <ContractsTable state={state} />
        <ExpensesTable state={state} />
      </div>
    </>
  );
}

function labelKind(k) {
  return ({
    defer_expense: 'Перенос платежа',
    pull_inflow: 'Аванс от клиента',
    overdraft: 'Овердрафт',
  })[k] || k;
}
