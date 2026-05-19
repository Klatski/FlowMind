// Mirror of backend seed so the PWA looks alive even without a server.
import { addDays, format } from 'date-fns';

const iso = (d) => format(d, 'yyyy-MM-dd');

export function seedData(today = new Date()) {
  const contracts = [];

  // One-time payment.
  contracts.push({
    id: 'c1',
    client_id: '180440012345',
    counterparty_name: 'ТОО «Alpha Trade»',
    title: 'Оплата контракта Q2',
    amount: 18_500_000, currency: 'KZT',
    expected_date: iso(addDays(today, 3)),
    status: 'expected',
    receipt_type: 'one_time',
    installment_index: null, installment_total: null, frequency: null,
    note: '',
  });

  // 4-installment schedule for AO «KaspiPay».
  const schedStart = addDays(today, 7);
  for (let i = 0; i < 4; i++) {
    contracts.push({
      id: 'c2_' + (i + 1),
      client_id: '050940000123',
      counterparty_name: 'АО «KaspiPay»',
      title: 'Эквайринг — рассрочка договора',
      amount: 5_500_000, currency: 'KZT',
      expected_date: iso(addDays(schedStart, i * 30)),
      status: 'expected',
      receipt_type: 'installment',
      installment_index: i + 1, installment_total: 4,
      frequency: 'monthly',
      note: '',
    });
  }

  // SEPA one-off.
  contracts.push({
    id: 'c3',
    client_id: '210340007788',
    counterparty_name: 'ТОО «BetaPay KZ»',
    title: 'SEPA — поступление по инвойсу №142',
    amount: 15_750_000, currency: 'KZT',
    expected_date: iso(addDays(today, 22)),
    status: 'expected',
    receipt_type: 'one_time',
    installment_index: null, installment_total: null, frequency: null,
    note: '',
  });

  // Recurring monthly subscription fee, 3 months visible in horizon.
  for (let i = 0; i < 3; i++) {
    contracts.push({
      id: 'c4_' + (i + 1),
      client_id: '170240005566',
      counterparty_name: 'ТОО «Sapa Logistics»',
      title: 'Ежемесячная комиссия за обслуживание',
      amount: 1_400_000, currency: 'KZT',
      expected_date: iso(addDays(today, 9 + i * 30)),
      status: 'expected',
      receipt_type: 'recurring',
      installment_index: null, installment_total: null,
      frequency: 'monthly',
      note: '',
    });
  }

  // License payment, one-off.
  contracts.push({
    id: 'c5',
    client_id: '230540009912',
    counterparty_name: 'АО «Tengri Bank»',
    title: 'Лицензионный платёж',
    amount: 6_800_000, currency: 'KZT',
    expected_date: iso(addDays(today, 27)),
    status: 'expected',
    receipt_type: 'one_time',
    installment_index: null, installment_total: null, frequency: null,
    note: '',
  });

  return {
    openingBalance: 5_000_000,
    contracts,
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
