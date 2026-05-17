import { useEffect, useRef, useState } from 'react';

const SECTIONS = [
  {
    title: 'Основная формула баланса',
    visual: (
      <div className="fr-formula">
        <div className="fr-row">
          <span className="fr-term">Баланс<sub>сегодня</sub></span>
          <span className="fr-eq">=</span>
          <span className="fr-term">Баланс<sub>вчера</sub></span>
          <span className="fr-op">+</span>
          <span className="fr-term fr-in">Поступления</span>
          <span className="fr-op">−</span>
          <span className="fr-term fr-out">Списания</span>
        </div>
      </div>
    ),
    rows: [
      { sym: 'Баланс', sub: 'сегодня', label: 'Остаток средств в конце текущего дня', color: 'var(--text-1)' },
      { sym: 'Баланс', sub: 'вчера', label: 'Остаток на конец предыдущего дня (стартовая точка)', color: 'var(--text-2)' },
      { sym: 'Поступления', label: 'Входящие платежи: оплата контрактов, клиринги, авансы', color: '#22c55e' },
      { sym: 'Списания', label: 'Зарплата + Налоги + Аренда + Поставщики + прочие расходы', color: '#f59e0b' },
    ],
  },
  {
    title: 'Кассовый разрыв',
    visual: (
      <div className="fr-formula">
        <div className="fr-row fr-gap-row">
          <span className="fr-term">Баланс<sub>сегодня</sub></span>
          <span className="fr-eq" style={{ color: '#ef4444' }}>&lt; 0</span>
          <span className="fr-label-gap">→ Кассовый разрыв</span>
        </div>
      </div>
    ),
    rows: [
      { sym: 'Cash Gap', label: 'Ситуация, когда обязательства нужно выполнять, а денег ещё нет.', color: '#ef4444' },
      { sym: 'Глубина', label: '|Баланс| — точная сумма недостачи в конкретный день', color: '#fca5a5' },
      { sym: 'Окно', label: 'Период (от–до), на протяжении которого баланс остаётся отрицательным', color: '#fca5a5' },
    ],
  },
  {
    title: 'Как считаются списания',
    visual: (
      <div className="fr-formula">
        <div className="fr-row">
          <span className="fr-term fr-out">Списания</span>
          <span className="fr-eq">=</span>
          <span className="fr-components">Зарплата + Налоги + Аренда + Поставщики + …</span>
        </div>
      </div>
    ),
    rows: [
      { sym: 'Зарплата', label: 'Выплаты сотрудникам (обычно 2 раза в месяц)', color: 'var(--text-2)' },
      { sym: 'Налоги', label: 'ИПН, НДС, социальные отчисления', color: 'var(--text-2)' },
      { sym: 'Поставщики', label: 'Эквайер, инфраструктура, SaaS-сервисы', color: 'var(--text-2)' },
    ],
  },
];

export default function FormulaRef() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  return (
    <>
      <button className="fr-trigger" onClick={() => setOpen(true)} title="Справка по формулам">
        <span className="fr-icon">∑</span>
        <span>Формулы</span>
      </button>

      {open && (
        <div className="fr-backdrop">
          <div className="fr-modal" ref={ref}>
            <div className="fr-modal-header">
              <div>
                <div className="fr-modal-title">Математика FlowMind</div>
                <div className="fr-modal-sub">Как работают формулы расчёта ликвидности</div>
              </div>
              <button className="fr-close" onClick={() => setOpen(false)}>✕</button>
            </div>

            <div className="fr-modal-body">
              {SECTIONS.map((s, i) => (
                <div key={i} className="fr-section">
                  <div className="fr-section-title">{s.title}</div>
                  {s.visual}
                  <div className="fr-glossary">
                    {s.rows.map((r, j) => (
                      <div key={j} className="fr-def">
                        <div className="fr-sym" style={{ color: r.color }}>
                          {r.sym}{r.sub && <sub>{r.sub}</sub>}
                        </div>
                        <div className="fr-def-text">{r.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
