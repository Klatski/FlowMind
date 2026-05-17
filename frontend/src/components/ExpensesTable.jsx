import { useState } from 'react';
import { fmt } from '../cashflow.js';
import * as storage from '../storage.js';

const CATS = [
  ['salary', 'Зарплата'],
  ['taxes', 'Налоги'],
  ['rent', 'Аренда'],
  ['utilities', 'Услуги/SaaS'],
  ['suppliers', 'Поставщики'],
  ['other', 'Прочее'],
];

const empty = {
  category: 'other', title: '', amount: '', currency: 'KZT',
  due_date: new Date().toISOString().slice(0, 10), status: 'scheduled', note: '',
};

export default function ExpensesTable({ state }) {
  const [draft, setDraft] = useState(empty);
  const [editId, setEditId] = useState(null);

  function submit(ev) {
    ev.preventDefault();
    const row = { ...draft, amount: Number(draft.amount) };
    if (editId) { storage.updateExpense(editId, row); setEditId(null); }
    else storage.addExpense(row);
    setDraft(empty);
  }
  function edit(e) { setEditId(e.id); setDraft({ ...e, amount: String(e.amount) }); }

  return (
    <div className="card">
      <h3>Расходы — запланированные списания</h3>
      <table className="data" style={{ marginBottom: 12 }}>
        <thead><tr><th>Категория</th><th>Назначение</th><th className="num">Сумма</th><th>Дата</th><th>Стат.</th><th></th></tr></thead>
        <tbody>
          {state.expenses.length === 0 && <tr><td colSpan={6} className="empty">Нет расходов</td></tr>}
          {state.expenses.map((e) => (
            <tr key={e.id}>
              <td><span className="tag">{labelCat(e.category)}</span></td>
              <td>{e.title}</td>
              <td className="num" style={{ color: '#f59e0b' }}>−{fmt(e.amount)}</td>
              <td>{e.due_date}</td>
              <td>{e.status === 'deferred' ? <span className="tag">отложен</span> : ''}</td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn sm ghost" onClick={() => edit(e)}>✎</button>
                <button className="btn sm ghost" onClick={() => storage.removeExpense(e.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="form" onSubmit={submit}>
        <label>Категория
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Назначение
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        </label>
        <label>Сумма
          <input type="number" min="0" step="1" value={draft.amount}
                 onChange={(e) => setDraft({ ...draft, amount: e.target.value })} required />
        </label>
        <label>Дата списания
          <input type="date" value={draft.due_date}
                 onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} required />
        </label>
        <div className="full" style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit">{editId ? 'Сохранить' : '+ Добавить расход'}</button>
          {editId && <button className="btn ghost" type="button" onClick={() => { setEditId(null); setDraft(empty); }}>Отмена</button>}
        </div>
      </form>
    </div>
  );
}

function labelCat(v) { return Object.fromEntries(CATS)[v] || v; }
