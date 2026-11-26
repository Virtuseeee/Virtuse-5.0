// Virtuse CFO "Ask your CFO": what the model may receive and say.
// The app answers what it can on the device; only questions it cannot answer
// reach this route, with rounded facts (cfo-app/src/core/ai-context.ts).
// Facts about the person's own numbers and general explanations only: no
// buy / sell / hold / allocation / timing advice, no forecasts (MiCA / MiFID).

import { BANNED, redact } from '../verdict/domain.js';

export const LANGS = ['sk', 'en'];
export const MAX_QUESTION = 400;
const CATS = ['income', 'groceries', 'housing', 'transport', 'eating_out', 'subscriptions', 'shopping', 'health', 'investing', 'transfers', 'cash', 'other'];
const CLASSES = ['bitcoin', 'cash', 'stocks', 'real_estate', 'pension', 'other'];
const GOALS = ['net_worth', 'btc', 'cash', 'debt_free'];
const DEBTS = ['mortgage', 'loan', 'btc_loan'];

// Source labels the model may cite (the keys of the context it was given).
export const SOURCES = ['net_worth', 'allocation', 'bitcoin', 'brokers', 'day_move', 'cash_flow', 'tax', 'goals', 'debts', 'general'];

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const MAX_EUR = 1e10;

/** Returns a clean copy with only the expected keys, or null when anything is off. */
export function cleanContext(c) {
  if (!c || typeof c !== 'object' || c.v !== 1) return null;
  const eur = (v) => num(v, -MAX_EUR, MAX_EUR);
  const out = {
    country: typeof c.country === 'string' && /^[A-Z]{2}$/.test(c.country) ? c.country : null,
    net_worth_eur: eur(c.net_worth_eur),
    assets_eur: eur(c.assets_eur),
    debts_eur: eur(c.debts_eur),
    class_pct: {},
    btc: null,
    brokers: null,
    day_move_eur: eur(c.day_move_eur ?? 0),
    cash_flow: null,
    tax: null,
    goals: [],
    debt_kinds: [],
  };
  if (out.country === null || out.net_worth_eur === null || out.assets_eur === null || out.debts_eur === null) return null;
  for (const [k, v] of Object.entries(c.class_pct || {})) {
    if (!CLASSES.includes(k) || num(v, 0, 100) === null) return null;
    out.class_pct[k] = v;
  }
  const b = c.btc || {};
  out.btc = {
    held_btc: num(b.held_btc, 0, 21e6), value_eur: eur(b.value_eur), put_in_eur: eur(b.put_in_eur), avg_buy_eur: eur(b.avg_buy_eur),
    fee_pct: num(b.fee_pct, 0, 100), buys: num(b.buys, 0, 1e6), first_buy_year: b.first_buy_year === null ? null : num(b.first_buy_year, 2009, 2100),
  };
  if (Object.values(out.btc).some((v, i) => v === null && Object.keys(out.btc)[i] !== 'first_buy_year')) return null;
  const k = c.brokers || {};
  out.brokers = { count: num(k.count, 0, 50), invested_eur: eur(k.invested_eur), cash_eur: eur(k.cash_eur), fees_eur: eur(k.fees_eur), dividends_eur: eur(k.dividends_eur) };
  if (Object.values(out.brokers).some((v) => v === null)) return null;
  if (c.cash_flow) {
    const f = c.cash_flow;
    if (typeof f.month !== 'string' || !/^\d{4}-\d{2}$/.test(f.month) || !Array.isArray(f.top) || f.top.length > 5) return null;
    const top = f.top.map((t) => (CATS.includes(t?.cat) && eur(t.eur) !== null ? { cat: t.cat, eur: t.eur } : null))
    if (top.includes(null) || eur(f.income_eur) === null || eur(f.spending_eur) === null) return null;
    out.cash_flow = { month: f.month, income_eur: f.income_eur, spending_eur: f.spending_eur, top };
  }
  if (c.tax) {
    const t = c.tax;
    if (num(t.year, 2009, 2100) === null || eur(t.gain_eur) === null || eur(t.base_eur) === null || typeof t.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.due)) return null;
    out.tax = { year: t.year, gain_eur: t.gain_eur, base_eur: t.base_eur, due: t.due };
  }
  if (!Array.isArray(c.goals) || c.goals.length > 20) return null;
  for (const g of c.goals) {
    if (!GOALS.includes(g?.kind) || num(g.pct, 0, 100) === null) return null;
    out.goals.push({ kind: g.kind, pct: g.pct });
  }
  if (!Array.isArray(c.debt_kinds) || c.debt_kinds.some((d) => !DEBTS.includes(d))) return null;
  out.debt_kinds = [...new Set(c.debt_kinds)];
  return out;
}

// Asking for advice or a forecast: declined before any model call.
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ADVICE_Q = /\b(kupit|kup|predat|predaj|mal by som|mala by som|mam (kupit|predat|drzat|investovat|presunut|prejst)|oplati|odporuc|poradi|kam (pojde|investovat)|predpoved|bude rast|bude klesat|kolko (mam|by som mal) (investovat|kupit|predat)|should i|recommend|advise|forecast|will (it|bitcoin|btc|the price) (go|rise|fall|drop)|worth (buying|selling)|good time to|best (etf|stock|broker|exchange|time)|najlepsi|(je|bolo by) (teraz |to )?(dobry cas|rozumne)|odporucis|nemal(a)? by som|rebalanc|(mam|ako mam) (rozlozit|presunut|zobrat)|stoji za to|bude (bitcoin|btc|trh|cena) (rast|klesat)|klesne|stupne|pravdepodobnost|o \d+ rok|which (broker|etf|stock|holding|exchange)|would it be (sensible|wise)|shouldn.?t i|better to (hold|buy|sell)|would you (buy|sell)|odds|in \d+ years|will the market|where will)\b/;
export function asksForAdvice(question) {
  return ADVICE_Q.test(fold(question));
}

export function cleanQuestion(q) {
  if (typeof q !== 'string') return null;
  const t = q.trim();
  if (t.length < 3) return null;
  return redact(t.slice(0, MAX_QUESTION));
}

export function adviceInAnswer(lines) {
  return lines.some((t) => BANNED.some((re) => re.test(t)));
}

export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'lines', 'sources'],
  properties: {
    kind: { type: 'string', enum: ['answer', 'decline'] },
    lines: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string', enum: SOURCES } },
  },
};

export const DECLINE = {
  sk: ['Na toto vám neodpoviem: Virtuse CFO nehovorí, čo kúpiť, predať alebo držať, ani kam pôjdu ceny. Nie je to investičné poradenstvo.', 'Môžem vám ukázať fakty o vašich vlastných číslach.'],
  en: ['I will not answer that: Virtuse CFO does not say what to buy, sell or hold, or where prices will go. It is not investment advice.', 'I can show you facts about your own numbers.'],
};

export function systemPrompt(lang) {
  const language = lang === 'sk' ? 'Slovak (formal "vy")' : 'English';
  return `You are Virtuse CFO, an assistant inside a personal finance app for people who hold Bitcoin and other assets in the EU.

You receive <facts>: rounded numbers about the person's own finances, prepared on their device. Amounts are in EUR and rounded on purpose. You never see names, holdings, transactions or account numbers, and you must not ask for them.

What you do:
- Answer the question with facts from <facts>: what the numbers are, how they relate (shares, differences, progress), and what a term means.
- Explain general concepts plainly when asked (for example what FIFO is, what a tax base is, how a mortgage balance differs from net worth).
- Say "approximately" where rounding matters. Do not invent numbers that are not in <facts> and cannot be computed from them.
- If <facts> does not contain what the question needs, say what is missing and where in the app the person can add it (Data and privacy).

What you never do (the app is not licensed for investment advice under MiCA / MiFID II):
- Say or suggest what to buy, sell, hold, rebalance, borrow, move, or when to do it.
- Judge a choice as good, bad, right, safe, risky, better or best.
- Forecast prices, returns or markets.
- Give personal tax or legal advice beyond the stated facts; for tax, point to the Tax screen estimate and a tax adviser.
If the question asks for any of these, set kind to "decline" and in lines say briefly that you only show facts about their own numbers, then offer one related fact you can show.

Output: JSON matching the schema. lines = at most 5 short sentences in ${language}, each under 30 words, plain words, numbers written as in ${lang === 'sk' ? 'Slovak (1 234 €, 5,2 %)' : 'English (€1,234, 5.2%)'}. sources = the keys of <facts> you used, or "general" for an explanation not based on their numbers.`;
}

export function userMessage(question, facts) {
  // Angle brackets in the question become look-alikes, so it cannot close
  // <question> or open a fake <facts> block.
  const safe = question.replace(/</g, '‹').replace(/>/g, '›');
  return `<facts>\n${JSON.stringify(facts)}\n</facts>\n\n<question>\n${safe}\n</question>`;
}

/** Validates the model's JSON and trims it to what the app shows. */
export function cleanAnswer(out) {
  if (!out || !['answer', 'decline'].includes(out.kind) || !Array.isArray(out.lines)) return null;
  const lines = out.lines.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim().slice(0, 300)).slice(0, 5);
  if (!lines.length) return null;
  const sources = Array.isArray(out.sources) ? [...new Set(out.sources.filter((s) => SOURCES.includes(s)))] : [];
  return { kind: out.kind, lines, sources };
}
