// Mirror of backend seed so the PWA looks alive even without a server.
import { addDays, format } from 'date-fns';

const iso = (d) => format(d, 'yyyy-MM-dd');

export function seedData(today = new Date()) {
  return {
    openingBalance: 5_000_000,
    contracts: [
      { id: 'c1', client_id: 'C-001', title: 'Клиент №1 — оплата контракта Q2', amount: 18_500_000, currency: 'KZT', expected_date: iso(addDays(today, 3)), status: 'expected', note: '' },
      { id: 'c2', client_id: 'C-002', title: 'Клиент №2 — SWIFT поступление', amount: 22_000_000, currency: 'KZT', expected_date: iso(addDays(today, 18)), status: 'expected', note: '' },
      { id: 'c3', client_id: 'C-003', title: 'Клиент №3 — карточный клиринг', amount: 9_300_000, currency: 'KZT', expected_date: iso(addDays(today, 14)), status: 'expected', note: '' },
      { id: 'c4', client_id: 'C-004', title: 'Клиент №4 — SEPA перевод', amount: 15_750_000, currency: 'KZT', expected_date: iso(addDays(today, 22)), status: 'expected', note: '' },
      { id: 'c5', client_id: 'C-005', title: 'Клиент №5 — комиссии за услуги', amount: 4_200_000, currency: 'KZT', expected_date: iso(addDays(today, 9)), status: 'expected', note: '' },
      { id: 'c6', client_id: 'C-006', title: 'Клиент №6 — лицензионные платежи', amount: 6_800_000, currency: 'KZT', expected_date: iso(addDays(today, 27)), status: 'expected', note: '' },
    ],
    expenses: [
      { id: 'e1', category: 'salary', title: 'Зарплата (1-я часть)', amount: 12_000_000, currency: 'KZT', due_date: iso(addDays(today, 5)), status: 'scheduled', note: '' },
      { id: 'e2', category: 'taxes', title: 'ИПН и соц.отчисления', amount: 4_500_000, currency: 'KZT', due_date: iso(addDays(today, 6)), status: 'scheduled', note: '' },
      { id: 'e3', category: 'rent', title: 'Аренда офиса', amount: 3_000_000, currency: 'KZT', due_date: iso(addDays(today, 8)), status: 'scheduled', note: '' },
      { id: 'e4', category: 'suppliers', title: 'Поставщик инфраструктуры', amount: 6_200_000, currency: 'KZT', due_date: iso(addDays(today, 10)), status: 'scheduled', note: '' },
      { id: 'e5', category: 'suppliers', title: 'Расчёт с эквайером', amount: 8_900_000, currency: 'KZT', due_date: iso(addDays(today, 12)), status: 'scheduled', note: '' },
      { id: 'e6', category: 'utilities', title: 'Хостинг и SaaS-подписки', amount: 1_500_000, currency: 'KZT', due_date: iso(addDays(today, 11)), status: 'scheduled', note: '' },
      { id: 'e7', category: 'salary', title: 'Зарплата (2-я часть)', amount: 12_000_000, currency: 'KZT', due_date: iso(addDays(today, 20)), status: 'scheduled', note: '' },
      { id: 'e8', category: 'taxes', title: 'НДС квартал', amount: 7_800_000, currency: 'KZT', due_date: iso(addDays(today, 15)), status: 'scheduled', note: '' },
      { id: 'e9', category: 'other', title: 'Маркетинговые расходы', amount: 2_400_000, currency: 'KZT', due_date: iso(addDays(today, 16)), status: 'scheduled', note: '' },
    ],
    chatHistory: [
      { role: 'assistant', content: 'Добро пожаловать в FlowMind. Я вижу прогноз на 30 дней вперёд. Спросите, например: «Что будет с балансом, если SEPA задержится на день?»' },
    ],
  };
}
