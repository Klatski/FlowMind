import { useState } from 'react';
import { addWeeks, addMonths, addQuarters, format } from 'date-fns';
import { fmt } from '../cashflow.js';
import * as storage from '../storage.js';

const TYPES = [
  ['one_time', 'Разовый платёж'],
  ['installment', 'Контракт с графиком'],
  ['recurring', 'Регулярные поступления'],
];

const FREQS = [
  ['weekly', 'Еженедельно'],
  ['monthly', 'Ежемесячно'],
  ['quarterly', 'Ежеквартально'],
];

const FREQ_RU = { weekly: 'еженедельно', monthly: 'ежемесячно', quarterly: 'ежеквартально' };

const todayISO = () => new Date().toISOString().slice(0, 10);

function emptyDraft() {
  return {
    receipt_type: 'one_time',
    counterparty_bin: '',
    counterparty_name: '',
    payment_purpose: '',
    // one-time
    amount: '',
    date: todayISO(),
    // installment
    total_amount: '',
    installments: '4',
    frequency: 'monthly',
    first_date: todayISO(),
    // recurring
    period_amount: '',
    start_date: todayISO(),
    end_date: '',
    open_ended: false,
  };
}

function fmtDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

function kindLabel(c) {
  if (c.receipt_type === 'installment' && c.installment_total) {
    return `${c.installment_index}/${c.installment_total} рассрочка`;
  }
  if (c.receipt_type === 'recurring') {
    return FREQ_RU[c.frequency] || 'регулярно';
  }
  return 'разовый';
}

function nextDate(start, freq, i) {
  const d = new Date(start);
  if (freq === 'weekly') return format(addWeeks(d, i), 'yyyy-MM-dd');
  if (freq === 'quarterly') return format(addQuarters(d, i), 'yyyy-MM-dd');
  return format(addMonths(d, i), 'yyyy-MM-dd');
}

function buildRows(draft) {
  const base = {
    client_id: draft.counterparty_bin.trim(),
    counterparty_name: draft.counterparty_name.trim(),
    title: draft.payment_purpose.trim(),
    currency: 'KZT',
    status: 'expected',
    note: '',
  };

  if (draft.receipt_type === 'one_time') {
    return [{
      ...base,
      amount: Number(draft.amount),
      expected_date: draft.date,
      receipt_type: 'one_time',
      installment_index: null,
      installment_total: null,
      frequency: null,
    }];
  }

  if (draft.receipt_type === 'installment') {
    const n = Math.max(1, Math.floor(Number(draft.installments) || 0));
    const per = Math.round(Number(draft.total_amount) / n);
    return Array.from({ length: n }, (_, i) => ({
      ...base,
      amount: per,
      expected_date: nextDate(draft.first_date, draft.frequency, i),
      receipt_type: 'installment',
      installment_index: i + 1,
      installment_total: n,
      frequency: draft.frequency,
    }));
  }

  // recurring
  const startISO = draft.start_date;
  const amount = Number(draft.period_amount);
  const cap = 12;
  const rows = [];
  for (let i = 0; i < cap; i++) {
    const d = nextDate(startISO, draft.frequency, i);
    if (!draft.open_ended && draft.end_date && d > draft.end_date) break;
    rows.push({
      ...base,
      amount,
      expected_date: d,
      receipt_type: 'recurring',
      installment_index: null,
      installment_total: null,
      frequency: draft.frequency,
    });
  }
  return rows;
}

function validate(draft) {
  if (!/^\d{12}$/.test(draft.counterparty_bin.trim())) return 'БИН должен содержать 12 цифр';
  if (!draft.counterparty_name.trim()) return 'Укажите название контрагента';
  if (!draft.payment_purpose.trim()) return 'Укажите назначение платежа';
  if (draft.receipt_type === 'one_time') {
    if (!(Number(draft.amount) > 0)) return 'Сумма должна быть больше 0';
    if (!draft.date) return 'Укажите дату';
  } else if (draft.receipt_type === 'installment') {
    if (!(Number(draft.total_amount) > 0)) return 'Укажите общую сумму контракта';
    const n = Math.floor(Number(draft.installments));
    if (!(n >= 2 && n <= 36)) return 'Количество платежей от 2 до 36';
    if (!draft.first_date) return 'Укажите дату первого платежа';
  } else {
    if (!(Number(draft.period_amount) > 0)) return 'Укажите сумму за период';
    if (!draft.start_date) return 'Укажите дату начала';
    if (!draft.open_ended && !draft.end_date) return 'Укажите дату окончания или отметьте «без даты окончания»';
    if (draft.end_date && draft.end_date < draft.start_date) return 'Дата окончания раньше начала';
  }
  return null;
}

export default function ContractsTable({ state }) {
  const [draft, setDraft] = useState(emptyDraft());
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);

  function set(part) { setDraft((d) => ({ ...d, ...part })); setError(null); }

  function submit(ev) {
    ev.preventDefault();
    const err = validate(draft);
    if (err) { setError(err); return; }

    if (editId) {
      const row = {
        client_id: draft.counterparty_bin.trim(),
        counterparty_name: draft.counterparty_name.trim(),
        title: draft.payment_purpose.trim(),
        amount: Number(draft.amount),
        expected_date: draft.date,
        currency: 'KZT',
        status: 'expected',
      };
      storage.updateContract(editId, row);
      setEditId(null);
    } else {
      for (const row of buildRows(draft)) storage.addContract(row);
    }
    setDraft(emptyDraft());
  }

  function startEdit(c) {
    setEditId(c.id);
    setDraft({
      ...emptyDraft(),
      receipt_type: 'one_time',
      counterparty_bin: c.client_id || '',
      counterparty_name: c.counterparty_name || '',
      payment_purpose: c.title || '',
      amount: String(c.amount ?? ''),
      date: c.expected_date || todayISO(),
    });
    setError(null);
  }

  function cancelEdit() { setEditId(null); setDraft(emptyDraft()); setError(null); }

  const isEdit = Boolean(editId);
  const rt = draft.receipt_type;

  return (
    <div className="card">
      <h3>Контракты — ожидаемые поступления</h3>
      <div className="table-scroll" style={{ marginBottom: 12 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Контрагент</th>
              <th>Назначение платежа</th>
              <th className="num">Сумма, ₸</th>
              <th>Дата</th>
              <th>Тип</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.contracts.length === 0 && <tr><td colSpan={6} className="empty">Нет контрактов</td></tr>}
            {state.contracts.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.counterparty_name || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                    БИН {c.client_id}
                  </div>
                </td>
                <td>{c.title}</td>
                <td className="num" style={{ color: '#22c55e' }}>+{fmt(c.amount)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(c.expected_date)}</td>
                <td><span className="tag">{kindLabel(c)}</span></td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn sm ghost" title="Редактировать" aria-label="Редактировать"
                          onClick={() => startEdit(c)}>✎</button>
                  <button className="btn sm ghost" title="Удалить" aria-label="Удалить"
                          onClick={() => storage.removeContract(c.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="form" onSubmit={submit}>
        {!isEdit && (
          <label className="full">Тип поступления
            <select value={rt} onChange={(e) => set({ receipt_type: e.target.value })}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}

        <label>БИН контрагента
          <input value={draft.counterparty_bin} inputMode="numeric" maxLength={12}
                 placeholder="12 цифр"
                 onChange={(e) => set({ counterparty_bin: e.target.value.replace(/\D/g, '') })}
                 required />
        </label>
        <label>Название компании
          <input value={draft.counterparty_name}
                 placeholder='ТОО «Alpha» / АО «KaspiPay»'
                 onChange={(e) => set({ counterparty_name: e.target.value })}
                 required />
        </label>
        <label className="full">Назначение платежа
          <input value={draft.payment_purpose}
                 placeholder="Напр. оплата контракта Q2"
                 onChange={(e) => set({ payment_purpose: e.target.value })}
                 required />
        </label>

        {(isEdit || rt === 'one_time') && (
          <>
            <label>Сумма, ₸
              <input type="number" min="0" step="1" value={draft.amount}
                     onChange={(e) => set({ amount: e.target.value })} required />
            </label>
            <label>Дата поступления
              <input type="date" value={draft.date}
                     onChange={(e) => set({ date: e.target.value })} required />
            </label>
          </>
        )}

        {!isEdit && rt === 'installment' && (
          <>
            <label>Общая сумма контракта, ₸
              <input type="number" min="0" step="1" value={draft.total_amount}
                     onChange={(e) => set({ total_amount: e.target.value })} required />
            </label>
            <label>Количество платежей
              <input type="number" min="2" max="36" step="1" value={draft.installments}
                     onChange={(e) => set({ installments: e.target.value })} required />
            </label>
            <label>Дата первого платежа
              <input type="date" value={draft.first_date}
                     onChange={(e) => set({ first_date: e.target.value })} required />
            </label>
            <label>Частота
              <select value={draft.frequency} onChange={(e) => set({ frequency: e.target.value })}>
                {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div className="full" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Будет создано {Math.max(0, Math.floor(Number(draft.installments) || 0))} записей
              {Number(draft.total_amount) > 0 && Number(draft.installments) > 0 && (
                <> по ≈{fmt(Math.round(Number(draft.total_amount) / Number(draft.installments)))} ₸ каждая</>
              )}.
            </div>
          </>
        )}

        {!isEdit && rt === 'recurring' && (
          <>
            <label>Сумма за период, ₸
              <input type="number" min="0" step="1" value={draft.period_amount}
                     onChange={(e) => set({ period_amount: e.target.value })} required />
            </label>
            <label>Частота
              <select value={draft.frequency} onChange={(e) => set({ frequency: e.target.value })}>
                {FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Дата начала
              <input type="date" value={draft.start_date}
                     onChange={(e) => set({ start_date: e.target.value })} required />
            </label>
            <label>Дата окончания
              <input type="date" value={draft.end_date} disabled={draft.open_ended}
                     onChange={(e) => set({ end_date: e.target.value })} />
            </label>
            <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={draft.open_ended}
                     onChange={(e) => set({ open_ended: e.target.checked, end_date: e.target.checked ? '' : draft.end_date })} />
              <span>Без даты окончания (создать до 12 записей)</span>
            </label>
          </>
        )}

        {error && <div className="full" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}

        <div className="full" style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit">{isEdit ? 'Сохранить' : '+ Добавить контракт'}</button>
          {isEdit && <button className="btn ghost" type="button" onClick={cancelEdit}>Отмена</button>}
        </div>
      </form>
    </div>
  );
}
