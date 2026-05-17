import { useState } from 'react';
import { fmt } from '../cashflow.js';
import * as storage from '../storage.js';

const empty = {
  client_id: '', title: '', amount: '', currency: 'KZT',
  expected_date: new Date().toISOString().slice(0, 10), status: 'expected', note: '',
};

export default function ContractsTable({ state }) {
  const [draft, setDraft] = useState(empty);
  const [editId, setEditId] = useState(null);

  function submit(ev) {
    ev.preventDefault();
    const row = { ...draft, amount: Number(draft.amount) };
    if (editId) { storage.updateContract(editId, row); setEditId(null); }
    else storage.addContract(row);
    setDraft(empty);
  }

  function edit(c) { setEditId(c.id); setDraft({ ...c, amount: String(c.amount) }); }

  return (
    <div className="card">
      <h3>Контракты — ожидаемые поступления</h3>
      <table className="data" style={{ marginBottom: 12 }}>
        <thead><tr><th>Клиент</th><th>Назначение</th><th className="num">Сумма</th><th>Дата</th><th></th></tr></thead>
        <tbody>
          {state.contracts.length === 0 && <tr><td colSpan={5} className="empty">Нет контрактов</td></tr>}
          {state.contracts.map((c) => (
            <tr key={c.id}>
              <td>{c.client_id}</td>
              <td>{c.title}</td>
              <td className="num" style={{ color: '#22c55e' }}>+{fmt(c.amount)}</td>
              <td>{c.expected_date}</td>
              <td style={{ textAlign: 'right' }}>
                <button className="btn sm ghost" onClick={() => edit(c)}>✎</button>
                <button className="btn sm ghost" onClick={() => storage.removeContract(c.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="form" onSubmit={submit}>
        <label>Клиент ID
          <input value={draft.client_id} onChange={(e) => setDraft({ ...draft, client_id: e.target.value })} required />
        </label>
        <label>Назначение
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        </label>
        <label>Сумма
          <input type="number" min="0" step="1" value={draft.amount}
                 onChange={(e) => setDraft({ ...draft, amount: e.target.value })} required />
        </label>
        <label>Дата поступления
          <input type="date" value={draft.expected_date}
                 onChange={(e) => setDraft({ ...draft, expected_date: e.target.value })} required />
        </label>
        <div className="full" style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit">{editId ? 'Сохранить' : '+ Добавить контракт'}</button>
          {editId && <button className="btn ghost" type="button" onClick={() => { setEditId(null); setDraft(empty); }}>Отмена</button>}
        </div>
      </form>
    </div>
  );
}
