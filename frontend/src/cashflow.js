// Client mirror of backend simulator: CB_t = CB_{t-1} + I_t - O_t.
// Lets the UI re-render instantly without a round-trip and keeps things
// working when the backend is offline.
import { addDays, format } from 'date-fns';

export function simulate({ openingBalance, contracts, expenses }, today = new Date(), horizonDays = 30) {
  const inflows = new Map();
  const outflows = new Map();

  for (const c of contracts) {
    if (c.status === 'received') continue;
    inflows.set(c.expected_date, (inflows.get(c.expected_date) || 0) + Number(c.amount));
  }
  for (const e of expenses) {
    if (e.status === 'paid' || e.status === 'deferred') continue;
    outflows.set(e.due_date, (outflows.get(e.due_date) || 0) + Number(e.amount));
  }

  let balance = Number(openingBalance) || 0;
  let minBalance = balance;
  let minBalanceDay = null;
  const series = [];
  for (let i = 0; i < horizonDays; i++) {
    const day = format(addDays(today, i), 'yyyy-MM-dd');
    const inflow = inflows.get(day) || 0;
    const outflow = outflows.get(day) || 0;
    balance = balance + inflow - outflow;
    if (balance < minBalance) {
      minBalance = balance;
      minBalanceDay = day;
    }
    series.push({
      day,
      inflow,
      outflow,
      balance: Math.round(balance * 100) / 100,
      isGap: balance < 0,
    });
  }

  const gaps = extractGaps(series);
  return { series, gaps, minBalance, minBalanceDay, openingBalance };
}

function extractGaps(series) {
  const gaps = [];
  let startIdx = null;
  for (let i = 0; i < series.length; i++) {
    if (series[i].isGap && startIdx === null) startIdx = i;
    else if (!series[i].isGap && startIdx !== null) {
      gaps.push(windowFrom(series.slice(startIdx, i)));
      startIdx = null;
    }
  }
  if (startIdx !== null) gaps.push(windowFrom(series.slice(startIdx)));
  return gaps;
}

function windowFrom(window) {
  const depth = Math.max(...window.map((p) => Math.abs(p.balance)));
  return {
    start: window[0].day,
    end: window[window.length - 1].day,
    days: window.length,
    max_depth: Math.round(depth * 100) / 100,
  };
}

// Heuristic advisor — mirrors backend advise() so the UI works offline.
export function advise({ openingBalance, contracts, expenses }, sim) {
  if (!sim.gaps.length) return [];
  const suggestions = [];
  const seenExpenseIds = new Set();
  const seenContractIds = new Set();

  for (const gap of sim.gaps) {
    const inGap = expenses.filter(
      (e) => e.status === 'scheduled' && e.category !== 'taxes' && e.due_date >= gap.start && e.due_date <= gap.end && !seenExpenseIds.has(e.id),
    );
    inGap.sort((a, b) => b.amount - a.amount);
    for (const e of inGap.slice(0, 3)) {
      seenExpenseIds.add(e.id);
      const newDate = format(addDays(new Date(gap.end), 2), 'yyyy-MM-dd');
      suggestions.push({
        kind: 'defer_expense',
        headline: `Перенесите «${e.title}» с ${e.due_date} на ${newDate}`,
        detail: `Снимет нагрузку ${fmt(e.amount)} ${e.currency} из окна разрыва.`,
        impact: Math.min(Number(e.amount), gap.max_depth),
        payload: { expense_id: e.id, from_date: e.due_date, to_date: newDate },
      });
    }
    const laterInflows = contracts
      .filter((c) => c.status === 'expected' && c.expected_date > gap.end && !seenContractIds.has(c.id))
      .sort((a, b) => b.amount - a.amount);
    for (const c of laterInflows.slice(0, 2)) {
      seenContractIds.add(c.id);
      const counterparty = c.counterparty_name || c.client_id || c.title;
      const ask = Math.max(Number(c.amount) * 0.15, gap.max_depth * 0.25);
      suggestions.push({
        kind: 'pull_inflow',
        headline: `Запросите у «${counterparty}» аванс ≈${fmt(ask)} ${c.currency}`,
        detail: `Поступление ${fmt(c.amount)} ожидается ${c.expected_date} — уже после окна разрыва.`,
        impact: Math.min(ask, gap.max_depth),
        payload: { contract_id: c.id, ask_amount: ask, by_date: gap.start },
      });
    }
    suggestions.push({
      kind: 'overdraft',
      headline: `Вам нужен овердрафт на ${fmt(gap.max_depth)} на ${gap.days} дн (${gap.start} — ${gap.end})`,
      detail: 'Запасной вариант: открыть овердрафт у банка-партнёра под пиковую глубину разрыва.',
      impact: gap.max_depth,
      payload: { amount: gap.max_depth, days: gap.days, from_date: gap.start, to_date: gap.end },
    });
  }
  return suggestions.sort((a, b) => b.impact - a.impact);
}

export function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
}
