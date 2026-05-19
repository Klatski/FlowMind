// Demo accounts + per-account seed data + auth helpers.
// FlowMind acts as a single-tenant treasury for the currently-active account.
// On login we hydrate the per-account dataset from localStorage (or seed it)
// and push it to the backend so AI/sync see the right data.
import { addDays, format } from 'date-fns';

const iso = (d) => format(d, 'yyyy-MM-dd');

const AUTH_KEY = 'flowmind:auth';

export const DEMO_ACCOUNTS = [
  {
    id: 'alpha',
    type: 'company',
    bin: '180440012349',
    password: 'alpha2026',
    company_name: 'ТОО «AlphaTech Solutions»',
    role: 'Финансовый директор',
    user_name: 'Айдар Бектұров',
    tagline: 'Финтех-стартап · близкий кассовый разрыв',
    short_tag: 'Финтех',
    initials: 'AT',
    accent: '#3b82f6',
  },
  {
    id: 'sapa',
    type: 'company',
    bin: '170240005566',
    password: 'sapa2026',
    company_name: 'ТОО «Sapa Logistics»',
    role: 'CFO',
    user_name: 'Динара Жумабекова',
    tagline: 'Логистика · регулярные поступления',
    short_tag: 'Логистика',
    initials: 'SL',
    accent: '#22d3ee',
  },
  {
    id: 'kasym',
    type: 'individual',
    bin: '920305400125',
    password: 'kasym2026',
    company_name: 'ИП Касымова А.Б.',
    role: 'Индивидуальный предприниматель',
    user_name: 'Айгерим Касымова',
    tagline: 'Розничная торговля · карточный клиринг',
    short_tag: 'Розница',
    initials: 'АК',
    accent: '#a78bfa',
  },
];

export function dataKey(bin) {
  return `flowmind:data:${bin}`;
}

export function getAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.bin) return null;
    return parsed;
  } catch { return null; }
}

export function setAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function findAccountByBin(rawBin) {
  const bin = normalizeBin(rawBin);
  return DEMO_ACCOUNTS.find((a) => a.bin === bin) || null;
}

export function normalizeBin(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/** Length-only check, used to enable the submit button as the user types. */
export function isBinLength(raw) {
  return normalizeBin(raw).length === 12;
}

/**
 * Validate Kazakhstan BIN/IIN by official checksum algorithm.
 *   - 12 digits total
 *   - First date segment must be plausible (year/month, optionally day for IIN)
 *   - Two-pass weighted checksum: try weights1; if result is 10, retry weights2
 */
export function isValidKzBin(raw) {
  const digits = normalizeBin(raw);
  if (digits.length !== 12) return false;

  const d = digits.split('').map(Number);

  // Structural sanity: months 01-12, day (if present) 01-31.
  const mm = d[2] * 10 + d[3];
  if (mm < 1 || mm > 12) return false;
  // For IIN (individuals) the next pair is a day-of-month.
  // Heuristic: 7th digit 1-6 => IIN (century+gender code), so check day.
  if (d[6] >= 1 && d[6] <= 6) {
    const dd = d[4] * 10 + d[5];
    if (dd < 1 || dd > 31) return false;
  }

  const W1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const W2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];

  const weighted = (W) => {
    let s = 0;
    for (let i = 0; i < 11; i++) s += d[i] * W[i];
    return s % 11;
  };

  let check = weighted(W1);
  if (check === 10) {
    check = weighted(W2);
    if (check === 10) return false;
  }
  return check === d[11];
}

/** Verify BIN + password against demo accounts. */
export function verifyCredentials(rawBin, password) {
  const bin = normalizeBin(rawBin);
  const account = DEMO_ACCOUNTS.find((a) => a.bin === bin);
  if (!account) return { ok: false, reason: 'not_found' };
  if ((account.password || '') !== (password || '')) return { ok: false, reason: 'bad_password' };
  return { ok: true, account };
}

export function seedForAccount(account, today = new Date()) {
  if (account.id === 'alpha') return seedAlpha(today);
  if (account.id === 'sapa') return seedSapa(today);
  if (account.id === 'kasym') return seedKasym(today);
  return seedAlpha(today);
}

function welcomeFor(account) {
  return {
    role: 'assistant',
    content:
      `Здравствуйте, ${account.user_name}. Я вижу финансовый прогноз компании «${account.company_name}» на ближайшие 30 дней. ` +
      `Спросите про разрывы, поступления или сценарии — я подскажу.`,
  };
}

function seedAlpha(today) {
  const contracts = [
    { id: 'a_c1', client_id: '050940007823', counterparty_name: 'АО «KaspiPay»', title: 'Эквайринг — клиринг карт', amount: 18_500_000, currency: 'KZT', expected_date: iso(addDays(today, 3)), status: 'expected', receipt_type: 'one_time', installment_index: null, installment_total: null, frequency: null, note: '' },
    { id: 'a_c2', client_id: '210340004451', counterparty_name: 'ТОО «BetaPay KZ»', title: 'SEPA — поступление по инвойсу №142', amount: 15_750_000, currency: 'KZT', expected_date: iso(addDays(today, 22)), status: 'expected', receipt_type: 'one_time', installment_index: null, installment_total: null, frequency: null, note: '' },
    { id: 'a_c3', client_id: '991240006628', counterparty_name: 'АО «Tengri Bank»', title: 'Лицензионный платёж', amount: 6_800_000, currency: 'KZT', expected_date: iso(addDays(today, 27)), status: 'expected', receipt_type: 'one_time', installment_index: null, installment_total: null, frequency: null, note: '' },
    { id: 'a_c4', client_id: '230540001177', counterparty_name: 'ТОО «Sapa Commerce»', title: 'Ежемесячная комиссия', amount: 1_400_000, currency: 'KZT', expected_date: iso(addDays(today, 9)), status: 'expected', receipt_type: 'recurring', installment_index: null, installment_total: null, frequency: 'monthly', note: '' },
  ];
  const expenses = [
    { id: 'a_e1', category: 'salary',    title: 'Зарплата (1-я часть)',     amount: 12_000_000, currency: 'KZT', due_date: iso(addDays(today, 5)),  status: 'scheduled', note: '' },
    { id: 'a_e2', category: 'taxes',     title: 'ИПН и соц.отчисления',     amount: 4_500_000,  currency: 'KZT', due_date: iso(addDays(today, 6)),  status: 'scheduled', note: '' },
    { id: 'a_e3', category: 'rent',      title: 'Аренда офиса',             amount: 3_000_000,  currency: 'KZT', due_date: iso(addDays(today, 8)),  status: 'scheduled', note: '' },
    { id: 'a_e4', category: 'suppliers', title: 'Поставщик инфраструктуры', amount: 6_200_000,  currency: 'KZT', due_date: iso(addDays(today, 10)), status: 'scheduled', note: '' },
    { id: 'a_e5', category: 'suppliers', title: 'Расчёт с эквайером',       amount: 8_900_000,  currency: 'KZT', due_date: iso(addDays(today, 12)), status: 'scheduled', note: '' },
    { id: 'a_e6', category: 'utilities', title: 'Хостинг и SaaS-подписки',  amount: 1_500_000,  currency: 'KZT', due_date: iso(addDays(today, 11)), status: 'scheduled', note: '' },
    { id: 'a_e7', category: 'salary',    title: 'Зарплата (2-я часть)',     amount: 12_000_000, currency: 'KZT', due_date: iso(addDays(today, 20)), status: 'scheduled', note: '' },
    { id: 'a_e8', category: 'taxes',     title: 'НДС квартал',              amount: 7_800_000,  currency: 'KZT', due_date: iso(addDays(today, 15)), status: 'scheduled', note: '' },
    { id: 'a_e9', category: 'other',     title: 'Маркетинговые расходы',    amount: 2_400_000,  currency: 'KZT', due_date: iso(addDays(today, 16)), status: 'scheduled', note: '' },
  ];
  return {
    openingBalance: 5_000_000,
    contracts,
    expenses,
    chatHistory: [welcomeFor(DEMO_ACCOUNTS[0])],
  };
}

function seedSapa(today) {
  const contracts = [];
  for (let i = 0; i < 4; i++) {
    contracts.push({
      id: 's_c' + (i + 1), client_id: '180440012345',
      counterparty_name: 'ТОО «AlphaTech Solutions»',
      title: 'Логистический контракт — еженедельный платёж',
      amount: 4_800_000, currency: 'KZT',
      expected_date: iso(addDays(today, 3 + i * 7)),
      status: 'expected', receipt_type: 'recurring',
      installment_index: null, installment_total: null, frequency: 'weekly', note: '',
    });
  }
  contracts.push({ id: 's_c5', client_id: '050940007823', counterparty_name: 'АО «KaspiPay»', title: 'Аванс по контракту Q3', amount: 11_500_000, currency: 'KZT', expected_date: iso(addDays(today, 5)), status: 'expected', receipt_type: 'one_time', installment_index: null, installment_total: null, frequency: null, note: '' });
  contracts.push({ id: 's_c6', client_id: '991240006628', counterparty_name: 'АО «Tengri Bank»', title: 'Возврат депозита', amount: 7_500_000, currency: 'KZT', expected_date: iso(addDays(today, 18)), status: 'expected', receipt_type: 'one_time', installment_index: null, installment_total: null, frequency: null, note: '' });
  const expenses = [
    { id: 's_e1', category: 'salary',    title: 'ФОТ водителей (аванс)',    amount: 8_500_000, currency: 'KZT', due_date: iso(addDays(today, 4)),  status: 'scheduled', note: '' },
    { id: 's_e2', category: 'suppliers', title: 'Топливо и обслуживание ТС',amount: 5_200_000, currency: 'KZT', due_date: iso(addDays(today, 9)),  status: 'scheduled', note: '' },
    { id: 's_e3', category: 'rent',      title: 'Аренда складов и боксов',  amount: 2_400_000, currency: 'KZT', due_date: iso(addDays(today, 11)), status: 'scheduled', note: '' },
    { id: 's_e4', category: 'taxes',     title: 'НДС квартал',              amount: 3_800_000, currency: 'KZT', due_date: iso(addDays(today, 15)), status: 'scheduled', note: '' },
    { id: 's_e5', category: 'salary',    title: 'ФОТ водителей (2-я часть)',amount: 8_500_000, currency: 'KZT', due_date: iso(addDays(today, 20)), status: 'scheduled', note: '' },
    { id: 's_e6', category: 'suppliers', title: 'Запчасти и ремонт',        amount: 1_900_000, currency: 'KZT', due_date: iso(addDays(today, 22)), status: 'scheduled', note: '' },
    { id: 's_e7', category: 'utilities', title: 'Связь, IT и подписки',     amount: 850_000,   currency: 'KZT', due_date: iso(addDays(today, 14)), status: 'scheduled', note: '' },
  ];
  return {
    openingBalance: 12_400_000,
    contracts,
    expenses,
    chatHistory: [welcomeFor(DEMO_ACCOUNTS[1])],
  };
}

function seedKasym(today) {
  const contracts = [];
  const amounts = [1_200_000, 1_350_000, 1_280_000, 1_400_000];
  for (let i = 0; i < 4; i++) {
    contracts.push({
      id: 'k_c' + (i + 1), client_id: '050940007823',
      counterparty_name: 'АО «KaspiPay»',
      title: 'Карты — клиринг за неделю',
      amount: amounts[i], currency: 'KZT',
      expected_date: iso(addDays(today, 2 + i * 7)),
      status: 'expected', receipt_type: 'recurring',
      installment_index: null, installment_total: null, frequency: 'weekly', note: '',
    });
  }
  contracts.push({ id: 'k_c5', client_id: '230540001177', counterparty_name: 'ТОО «Sapa Commerce»', title: 'Оплата за партию товара', amount: 2_800_000, currency: 'KZT', expected_date: iso(addDays(today, 12)), status: 'expected', receipt_type: 'one_time', installment_index: null, installment_total: null, frequency: null, note: '' });
  const expenses = [
    { id: 'k_e1', category: 'suppliers', title: 'Закуп товара у поставщика', amount: 2_400_000, currency: 'KZT', due_date: iso(addDays(today, 6)),  status: 'scheduled', note: '' },
    { id: 'k_e2', category: 'rent',      title: 'Аренда торговой точки',     amount: 600_000,   currency: 'KZT', due_date: iso(addDays(today, 5)),  status: 'scheduled', note: '' },
    { id: 'k_e3', category: 'salary',    title: 'Зарплата сотрудникам',      amount: 1_500_000, currency: 'KZT', due_date: iso(addDays(today, 14)), status: 'scheduled', note: '' },
    { id: 'k_e4', category: 'taxes',     title: 'Налоги ИП (упрощёнка)',     amount: 320_000,   currency: 'KZT', due_date: iso(addDays(today, 10)), status: 'scheduled', note: '' },
    { id: 'k_e5', category: 'utilities', title: 'Коммунальные услуги',       amount: 180_000,   currency: 'KZT', due_date: iso(addDays(today, 18)), status: 'scheduled', note: '' },
    { id: 'k_e6', category: 'suppliers', title: 'Эквайринговая комиссия',    amount: 140_000,   currency: 'KZT', due_date: iso(addDays(today, 21)), status: 'scheduled', note: '' },
  ];
  return {
    openingBalance: 1_800_000,
    contracts,
    expenses,
    chatHistory: [welcomeFor(DEMO_ACCOUNTS[2])],
  };
}
