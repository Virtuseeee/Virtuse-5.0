// Verdict Lite: the scoring rules on the server, for the paid report. Pure.
// The free score is computed in the browser by verdict-lite.js with the same
// rules; test/verdict-lite.test.mjs runs both over a grid of answers and fails
// when they disagree, so the report never shows a different score than the page.

const NUM_MAX = 1e10;
const COUNTRIES = ['sk', 'cz', 'at', 'de', 'pl', 'hu', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es', 'other'];
const ONE_OF = {
  country: COUNTRIES,
  reserve: ['lt1', '1_3', '3_6', '6p'],
  home: ['own', 'mortgage', 'rent', 'other'],
  debt: ['none', 'lt10', 'gt10'],
  experience: ['hodler', 'new', 'sceptic'],
  custody: ['self', 'assisted', 'any'],
  fall: ['sell', 'wait', 'more'],
  tax_known: ['yes', 'roughly', 'no'],
};
const WORRIES = ['tax', 'keys', 'crash', 'heirs', 'scams', 'fees', 'partner', 'retire'];
const AGES = ['age', 'retire'];
const AMOUNTS = ['savings', 'pension', 'retmonthly', 'homeval', 'mortbal', 'btc', 'monthly'];
const REQUIRED = ['age', 'retire', 'savings', 'btc'];

function number(v, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}

// Only fixed ids and bounded numbers pass; everything else in the body is
// dropped. Returns { ok, value } or { ok: false, error }.
export function validateAnswers(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'answers' };
  const a = {};
  for (const [k, list] of Object.entries(ONE_OF)) {
    if (!list.includes(raw[k])) return { ok: false, error: k };
    a[k] = raw[k];
  }
  for (const k of AGES) {
    const n = number(raw[k], 120);
    if (n === undefined) return { ok: false, error: k };
    a[k] = n;
  }
  for (const k of AMOUNTS) {
    const n = number(raw[k], NUM_MAX);
    if (n === undefined) return { ok: false, error: k };
    a[k] = n;
  }
  for (const k of REQUIRED) if (a[k] === null) return { ok: false, error: k };
  if (a.home === 'mortgage' && a.mortbal === null) return { ok: false, error: 'mortbal' };
  if (a.home !== 'mortgage') a.mortbal = null;
  if (a.home !== 'own' && a.home !== 'mortgage') a.homeval = null;
  const worries = Array.isArray(raw.worries) ? raw.worries : [];
  a.worries = WORRIES.filter((w) => worries.includes(w));
  // Control characters and markup signs go; the name is only ever printed back.
  a.name = typeof raw.name === 'string' ? raw.name.replace(/[\u0000-\u001f\u007f<>&"]/g, '').trim().slice(0, 40) : '';
  return { ok: true, value: a };
}

export function calc(A) {
  const share = A.savings > 0 && A.btc != null ? (A.btc / A.savings) * 100 : null;
  let size = share == null ? 3 : share < 5 ? 10 : share < 20 ? 7 : share < 50 ? 4 : 1;
  const reserve = { '6p': 10, '3_6': 7, '1_3': 4, lt1: 1 }[A.reserve] || 3;
  let debt = { none: 10, lt10: 7, gt10: 3 }[A.debt] || 5;
  const ltv = A.home === 'mortgage' && A.homeval > 0 && A.mortbal != null ? A.mortbal / A.homeval : null;
  if (ltv != null && ltv > 0.8) debt = Math.max(1, debt - 3);
  const years = A.retire != null && A.age != null && +A.retire >= +A.age ? A.retire - A.age : null;
  if (years != null && years < 10 && share != null && share >= 20) size = Math.max(1, size - 2);
  const tax = { yes: 10, roughly: 6 }[A.tax_known] || 2;
  const custody = A.custody === 'self' ? (A.experience !== 'hodler' ? 6 : 9) : A.custody === 'assisted' ? 8 : 4;
  const fall = { more: 10, wait: 10, sell: 4 }[A.fall] || 5;
  const sum = size + reserve + debt + tax + custody + fall;
  return { share, ltv, years, sc: { size, reserve, debt, tax, custody, fall }, total: Math.round(((sum / 60) * 100) / 5) * 5 };
}

export const grade = (t) => (t >= 85 ? 'A' : t >= 70 ? 'B' : t >= 55 ? 'C' : t >= 40 ? 'D' : 'E');
export const bandIndex = (t) => (t >= 70 ? 0 : t >= 55 ? 1 : 2);

// Gaps ranked by the points each area misses, plus a boost for what the person
// worries about. Same order as gaps() in verdict-lite.js.
export function gapIds(A, c) {
  const { sc } = c;
  const w = A.worries || [];
  const pr = {};
  const put = (id, p) => { pr[id] = Math.max(pr[id] || 0, p); };
  if (sc.size < 10) put('size', 10 - sc.size);
  if (sc.reserve < 10) put('reserve', 10 - sc.reserve);
  if (A.debt && A.debt !== 'none') put('debt', A.debt === 'gt10' ? 7 : 3);
  if (c.ltv != null && c.ltv > 0.8) put('mortgage', 4);
  if (sc.tax < 10) put('tax', 10 - sc.tax);
  if (A.custody === 'any') put('custody', 6);
  if (A.custody === 'self' && sc.custody < 10) put('keys', 10 - sc.custody);
  if (A.custody === 'assisted') put('recovery', 2);
  if (sc.fall < 10) put('fall', 10 - sc.fall);
  if (c.years != null && c.years < 10 && (c.share || 0) >= 20) put('retire', 5);
  const boost = worryTargets(A);
  w.forEach((k) => { const id = boost[k]; if (id) pr[id] = (pr[id] || 0) + 3; });
  const ids = Object.keys(pr).sort((x, y) => pr[y] - pr[x]);
  ['heirs', 'records'].forEach((id) => { if (!ids.includes(id)) ids.push(id); });
  return ids.slice(0, 3);
}

// Which gap each worry points at.
export function worryTargets(A) {
  return { tax: 'tax', keys: A.custody === 'assisted' ? 'recovery' : A.custody === 'any' ? 'custody' : 'keys', crash: 'size', heirs: 'heirs', scams: A.custody === 'any' ? 'custody' : 'keys', retire: 'retire' };
}
