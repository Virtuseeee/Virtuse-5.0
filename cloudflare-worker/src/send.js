// POST /send -- one transactional email the visitor asked for: their
// Partner Finder criteria ("plan") or a calculator result ("result").
//
//   { email, hp, lang, kind, source, payload, brief }
//
// Nothing the visitor types ends up in the email except their own
// address. `payload` may only carry ids from fixed lists (goal, country,
// partner, ...) and bounded numbers; every word in the email comes from
// the STRINGS table below. That is what keeps the form from being usable
// to send arbitrary text to someone else's inbox.
//
// MiCA: the email lists the partners that matched the visitor's criteria,
// in the order the Partner Finder showed them. No "best", no reasons, no
// verdict (see CLAUDE.md, 2026-10-06 Partner Finder rename).
//
// Without `brief: true` nothing is stored: the email is sent and that is
// it. With `brief: true` the contact joins the Brief segment exactly like
// POST /subscribe (welcome email only for new contacts).
//
// The `checklist` kind (step 2 of the rollout plan) is not accepted yet:
// it needs verified per-partner steps first.

export const SEND_KINDS = ['plan', 'result'];
export const SEND_SOURCES = ['concierge', 'stacking', 'loan', 'tax'];
export const SITE_LANGS = ['en', 'sk', 'uk', 'cs', 'ru', 'de', 'fr', 'es', 'pl', 'hu'];
export const EMAIL_LANGS = ['en', 'sk', 'cs'];

const SEND_LIMIT_PER_ADDRESS = 3;
const SEND_LIMIT_WINDOW_SECONDS = 60 * 60;
const SITE = 'https://virtuse.com';

// Same 22 partners as the category pages (data/partners.json) and the
// Partner Finder catalog; urls are the tracked links from the cards.
// send.test.mjs fails if a host here is missing from data/partners.json.
export const PARTNERS = {
  '21bitcoin': { name: '21bitcoin', page: 'buy-bitcoin.html', url: 'https://21bitcoin.app.link/invite/?code=VIRTUSE' },
  kraken: { name: 'Kraken', page: 'buy-bitcoin.html', url: 'https://proinvite.kraken.com/9f1e/lj72d37e' },
  'bybit-eu': { name: 'ByBit EU', page: 'buy-bitcoin.html', url: 'https://partner.bybit.eu/b/VIRTUSE' },
  invity: { name: 'Invity', page: 'buy-bitcoin.html', url: 'https://invity.onelink.me/yIY4/j44d7awx' },
  'crypto-com': { name: 'Crypto.com', page: 'buy-bitcoin.html', url: 'https://cryptocom.sjv.io/c/7490229/2051372/25666' },
  trezor: { name: 'Trezor', page: 'secure.html', url: 'https://affil.trezor.io/aff_c?offer_id=133&aff_id=846427' },
  ledger: { name: 'Ledger', page: 'secure.html', url: 'https://shop.ledger.com/?r=3256467ea813' },
  blockstream: { name: 'Blockstream', page: 'secure.html', url: 'https://rewards.blockstream.com/qo0khs' },
  firefish: { name: 'Firefish', page: 'lending.html', url: 'https://app.firefish.io/auth/sign-up?ref=virtuseloan' },
  blockpit: { name: 'Blockpit', page: 'tax.html', url: 'https://app.blockpit.io/register?fpr=virtuse' },
  koinly: { name: 'Koinly', page: 'tax.html', url: 'https://koinly.io/?via=C7DEBFCF&utm_source=affiliate' },
  cointracking: { name: 'CoinTracking', page: 'tax.html', url: 'https://cointracking.info/?ref=V328565' },
  divly: { name: 'Divly', page: 'tax.html', url: 'https://divly.com/?ref=otfkzmf' },
  bitgo: { name: 'BitGo', page: 'treasury.html', url: 'https://bitgo.com' },
  sygnum: { name: 'Sygnum', page: 'treasury.html', url: 'https://sygnum.com' },
  'coinbase-institutional': { name: 'Coinbase Institutional', page: 'treasury.html', url: 'https://coinbase.com/institutional' },
  coinrule: { name: 'Coinrule', page: 'bots.html', url: 'https://coinrule.com/?fp_ref=virtuse' },
  cryptohopper: { name: 'Cryptohopper', page: 'bots.html', url: 'https://www.cryptohopper.com/?atid=40864' },
  revenuebot: { name: 'RevenueBot', page: 'bots.html', url: 'https://app.revenuebot.io/external/r/90928' },
  oneminers: { name: 'OneMiners', page: 'mining.html', url: 'https://oneminers.com/products/?discount=virtuse_buy' },
  'abundant-mines': { name: 'Abundant Mines', page: 'mining.html', url: 'https://abundantmines.com/ref/76/' },
  'power-mining': { name: 'PowerMining', page: 'mining.html', url: 'https://shop.powermining.io/?ref=Virtuse' },
};

const GOALS = ['buy', 'loan', 'earn', 'treasury', 'mining', 'custody', 'tax'];
const COUNTRIES = ['cz', 'sk', 'pl', 'at', 'de', 'hu', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es'];
const EXPERIENCE = ['new', 'hodler'];
const CUSTODY = ['self', 'assisted', 'any'];
const AMOUNTS = ['s', 'm', 'l', 'xl'];
const FREQUENCIES = ['weekly', 'monthly'];

// Result fields per calculator: [key, unit, min, max]. Units decide the
// formatting; anything outside the bounds rejects the request.
const RESULT_FIELDS = {
  stacking: [
    ['initial', 'eur', 0, 10_000_000],
    ['contribution', 'eur', 0, 1_000_000],
    ['frequency', 'frequency'],
    ['years', 'years', 1, 50],
    ['returnPct', 'pct', -100, 1000],
    ['invested', 'eur', 0, 100_000_000],
    ['projected', 'eur', 0, 10_000_000_000],
    ['lowestFeePartner', 'partner'],
  ],
  loan: [
    ['cashNeeded', 'eur', 0, 100_000_000],
    ['btcPrice', 'eur', 1, 100_000_000],
    ['ltvPct', 'pct', 0, 100],
    ['aprPct', 'pct', 0, 100],
    ['years', 'years', 0, 50],
    ['taxIfSold', 'eur', 0, 100_000_000],
    ['interestTotal', 'eur', 0, 100_000_000],
    ['collateralBtc', 'btc', 0, 21_000_000],
    ['liquidationPrice', 'eur', 0, 100_000_000],
  ],
  tax: [
    ['country', 'country'],
    ['inheritanceScore', 'score', 0, 100],
  ],
};

const TOOL_PAGE = { stacking: 'stacking.html', loan: 'loan.html', tax: 'tax-agent.html', concierge: 'concierge.html' };

const STRINGS = {
  en: {
    planSubject: 'Your Partner Finder criteria',
    planTitle: 'Your criteria and the partners that match them',
    planIntro: 'You asked us to send what you saw in the Partner Finder on virtuse.com. Here it is.',
    criteria: 'Your answers',
    matches: 'Partners matching your criteria',
    matchesNote: 'Listed in the order the Partner Finder showed them. The order comes from fixed rules based on your answers, never from commission.',
    openPartner: 'Open {0}',
    seeCard: 'Details on virtuse.com',
    resultSubject: { stacking: 'Your Stacking Strategist result', loan: 'Your Loan & Liquidity Copilot result', tax: 'Your Tax & Inheritance Agent result' },
    resultTitle: 'Your result',
    resultIntro: 'You asked us to send the numbers you saw on virtuse.com. They are the result of your inputs and assumptions at the time.',
    reopen: 'Open the calculator again',
    taxNote: 'The country rules are shown in the Tax & Inheritance Agent. Indicative overview, not tax advice.',
    disclaimer: 'Educational information only, not financial, tax or legal advice. Virtuse does not hold your funds or keys; sign-up and KYC happen on each partner\'s own platform. Some links are affiliate links.',
    why: 'You get this one email because you asked for it on virtuse.com. We did not add you to any list.',
    whyBrief: 'You also asked for the Virtuse Brief; the welcome email explains how to unsubscribe.',
    labels: {
      goal: 'Goal', country: 'Country', experience: 'Experience', custody: 'Custody', amount: 'Amount',
      initial: 'Initial amount', contribution: 'Regular purchase', frequency: 'Frequency', years: 'Period',
      returnPct: 'Assumed yearly return', invested: 'Total invested', projected: 'Projected value',
      lowestFeePartner: 'Lowest fee at your amount',
      cashNeeded: 'Cash needed', btcPrice: 'Bitcoin price used', ltvPct: 'Loan-to-value', aprPct: 'Interest rate (yearly)',
      taxIfSold: 'Tax if you sell', interestTotal: 'Total interest', collateralBtc: 'Collateral', liquidationPrice: 'Liquidation price',
      inheritanceScore: 'Inheritance readiness',
    },
    years: (n) => (n === 1 ? '1 year' : `${n} years`),
    values: {
      goal: { buy: 'Buy Bitcoin', loan: 'Bitcoin-backed loan', earn: 'Automate & compound', treasury: 'Corporate treasury', mining: 'Mining', custody: 'Custody & inheritance', tax: 'Tax help' },
      experience: { new: 'New to Bitcoin', hodler: 'I already hold Bitcoin' },
      custody: { self: 'Self-custody', assisted: 'Assisted custody', any: 'No preference yet' },
      amount: { s: '< €1,000', m: '€1,000 – 10,000', l: '€10,000 – 100,000', xl: '> €100,000' },
      frequency: { weekly: 'Weekly', monthly: 'Monthly' },
      country: { cz: 'Czechia', sk: 'Slovakia', pl: 'Poland', at: 'Austria', de: 'Germany', hu: 'Hungary', si: 'Slovenia', hr: 'Croatia', ro: 'Romania', bg: 'Bulgaria', nl: 'Netherlands', fr: 'France', es: 'Spain' },
    },
  },
  sk: {
    planSubject: 'Vaše kritériá z Partner Finder',
    planTitle: 'Vaše kritériá a partneri, ktorí im zodpovedajú',
    planIntro: 'Požiadali ste nás o zaslanie toho, čo ste videli v Partner Finder na virtuse.com. Tu to je.',
    criteria: 'Vaše odpovede',
    matches: 'Partneri, ktorí zodpovedajú vašim kritériám',
    matchesNote: 'V poradí, v akom ich ukázal Partner Finder. Poradie určujú pevné pravidlá podľa vašich odpovedí, nikdy nie provízia.',
    openPartner: 'Otvoriť {0}',
    seeCard: 'Podrobnosti na virtuse.com',
    resultSubject: { stacking: 'Váš výsledok zo Stacking Strategist', loan: 'Váš výsledok z Loan & Liquidity Copilot', tax: 'Váš výsledok z Tax & Inheritance Agent' },
    resultTitle: 'Váš výsledok',
    resultIntro: 'Požiadali ste nás o zaslanie čísel, ktoré ste videli na virtuse.com. Vychádzajú z vašich vstupov a predpokladov v tom čase.',
    reopen: 'Otvoriť kalkulačku znova',
    taxNote: 'Pravidlá krajiny nájdete v Tax & Inheritance Agent. Orientačný prehľad, nie daňové poradenstvo.',
    disclaimer: 'Len vzdelávacie informácie, nie finančné, daňové ani právne poradenstvo. Virtuse nedrží vaše prostriedky ani kľúče; registrácia a KYC prebiehajú na platforme každého partnera. Niektoré odkazy sú affiliate odkazy.',
    why: 'Tento jeden email dostávate, lebo ste oň požiadali na virtuse.com. Nepridali sme vás do žiadneho zoznamu.',
    whyBrief: 'Prihlásili ste sa aj na Virtuse Brief; ako sa odhlásiť, nájdete v uvítacom emaile.',
    labels: {
      goal: 'Cieľ', country: 'Krajina', experience: 'Skúsenosti', custody: 'Úschova', amount: 'Suma',
      initial: 'Počiatočná suma', contribution: 'Pravidelný nákup', frequency: 'Frekvencia', years: 'Obdobie',
      returnPct: 'Predpokladaný ročný výnos', invested: 'Spolu investované', projected: 'Odhadovaná hodnota',
      lowestFeePartner: 'Najnižší poplatok pri vašej sume',
      cashNeeded: 'Potrebná hotovosť', btcPrice: 'Použitá cena Bitcoinu', ltvPct: 'Pomer úveru k hodnote (LTV)', aprPct: 'Úroková sadzba (ročná)',
      taxIfSold: 'Daň pri predaji', interestTotal: 'Úroky spolu', collateralBtc: 'Zábezpeka', liquidationPrice: 'Likvidačná cena',
      inheritanceScore: 'Pripravenosť na dedičstvo',
    },
    years: (n) => (n === 1 ? '1 rok' : n >= 2 && n <= 4 ? `${n} roky` : `${n} rokov`),
    values: {
      goal: { buy: 'Kúpiť Bitcoin', loan: 'Pôžička krytá Bitcoinom', earn: 'Automatizovať a zhodnocovať', treasury: 'Firemný treasury', mining: 'Ťažba', custody: 'Úschova a dedičstvo', tax: 'Pomoc s daňami' },
      experience: { new: 'Nový v Bitcoine', hodler: 'Už vlastním Bitcoin' },
      custody: { self: 'Vlastná úschova', assisted: 'Asistovaná úschova', any: 'Zatiaľ bez preferencie' },
      amount: { s: '< 1 000 €', m: '1 000 – 10 000 €', l: '10 000 – 100 000 €', xl: '> 100 000 €' },
      frequency: { weekly: 'Týždenne', monthly: 'Mesačne' },
      country: { cz: 'Česko', sk: 'Slovensko', pl: 'Poľsko', at: 'Rakúsko', de: 'Nemecko', hu: 'Maďarsko', si: 'Slovinsko', hr: 'Chorvátsko', ro: 'Rumunsko', bg: 'Bulharsko', nl: 'Holandsko', fr: 'Francúzsko', es: 'Španielsko' },
    },
  },
  cs: {
    planSubject: 'Vaše kritéria z Partner Finder',
    planTitle: 'Vaše kritéria a partneři, kteří jim odpovídají',
    planIntro: 'Požádali jste nás o zaslání toho, co jste viděli v Partner Finder na virtuse.com. Tady to je.',
    criteria: 'Vaše odpovědi',
    matches: 'Partneři, kteří odpovídají vašim kritériím',
    matchesNote: 'V pořadí, v jakém je ukázal Partner Finder. Pořadí určují pevná pravidla podle vašich odpovědí, nikdy ne provize.',
    openPartner: 'Otevřít {0}',
    seeCard: 'Podrobnosti na virtuse.com',
    resultSubject: { stacking: 'Váš výsledek ze Stacking Strategist', loan: 'Váš výsledek z Loan & Liquidity Copilot', tax: 'Váš výsledek z Tax & Inheritance Agent' },
    resultTitle: 'Váš výsledek',
    resultIntro: 'Požádali jste nás o zaslání čísel, která jste viděli na virtuse.com. Vycházejí z vašich vstupů a předpokladů v daném okamžiku.',
    reopen: 'Otevřít kalkulačku znovu',
    taxNote: 'Pravidla země najdete v Tax & Inheritance Agent. Orientační přehled, ne daňové poradenství.',
    disclaimer: 'Pouze vzdělávací informace, ne finanční, daňové ani právní poradenství. Virtuse nedrží vaše prostředky ani klíče; registrace a KYC probíhají na platformě každého partnera. Některé odkazy jsou affiliate odkazy.',
    why: 'Tento jeden email dostáváte, protože jste o něj požádali na virtuse.com. Nepřidali jsme vás do žádného seznamu.',
    whyBrief: 'Přihlásili jste se také k Virtuse Brief; jak se odhlásit, najdete v uvítacím emailu.',
    labels: {
      goal: 'Cíl', country: 'Země', experience: 'Zkušenosti', custody: 'Úschova', amount: 'Částka',
      initial: 'Počáteční částka', contribution: 'Pravidelný nákup', frequency: 'Frekvence', years: 'Období',
      returnPct: 'Předpokládaný roční výnos', invested: 'Celkem investováno', projected: 'Odhadovaná hodnota',
      lowestFeePartner: 'Nejnižší poplatek při vaší částce',
      cashNeeded: 'Potřebná hotovost', btcPrice: 'Použitá cena Bitcoinu', ltvPct: 'Poměr úvěru k hodnotě (LTV)', aprPct: 'Úroková sazba (roční)',
      taxIfSold: 'Daň při prodeji', interestTotal: 'Úroky celkem', collateralBtc: 'Zajištění', liquidationPrice: 'Likvidační cena',
      inheritanceScore: 'Připravenost na dědictví',
    },
    years: (n) => (n === 1 ? '1 rok' : n >= 2 && n <= 4 ? `${n} roky` : `${n} let`),
    values: {
      goal: { buy: 'Koupit Bitcoin', loan: 'Půjčka krytá Bitcoinem', earn: 'Automatizovat a zhodnocovat', treasury: 'Firemní treasury', mining: 'Těžba', custody: 'Úschova a dědictví', tax: 'Pomoc s daněmi' },
      experience: { new: 'Nový v Bitcoinu', hodler: 'Už vlastním Bitcoin' },
      custody: { self: 'Vlastní úschova', assisted: 'Asistovaná úschova', any: 'Zatím bez preference' },
      amount: { s: '< 1 000 €', m: '1 000 – 10 000 €', l: '10 000 – 100 000 €', xl: '> 100 000 €' },
      frequency: { weekly: 'Týdně', monthly: 'Měsíčně' },
      country: { cz: 'Česko', sk: 'Slovensko', pl: 'Polsko', at: 'Rakousko', de: 'Německo', hu: 'Maďarsko', si: 'Slovinsko', hr: 'Chorvatsko', ro: 'Rumunsko', bg: 'Bulharsko', nl: 'Nizozemsko', fr: 'Francie', es: 'Španělsko' },
    },
  },
};

const LOCALES = { en: 'en-IE', sk: 'sk-SK', cs: 'cs-CZ' };

// --- validation ------------------------------------------------------------

function oneOf(list, value) {
  return typeof value === 'string' && list.includes(value);
}

function finiteIn(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

// Returns { ok: true, value } with only known keys kept, or { ok: false, error }.
export function validatePayload(kind, source, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'payload must be an object' };
  }
  if (kind === 'plan') {
    if (source !== 'concierge') return { ok: false, error: 'plan needs source concierge' };
    const { goal, country, experience, custody, amount, partners } = payload;
    if (!oneOf(GOALS, goal)) return { ok: false, error: 'bad goal' };
    if (!oneOf(COUNTRIES, country)) return { ok: false, error: 'bad country' };
    if (!oneOf(EXPERIENCE, experience)) return { ok: false, error: 'bad experience' };
    if (!oneOf(CUSTODY, custody)) return { ok: false, error: 'bad custody' };
    if (!oneOf(AMOUNTS, amount)) return { ok: false, error: 'bad amount' };
    if (!Array.isArray(partners) || partners.length < 1 || partners.length > 3) {
      return { ok: false, error: 'partners must list 1 to 3 ids' };
    }
    if (!partners.every((id) => typeof id === 'string' && Object.hasOwn(PARTNERS, id))) {
      return { ok: false, error: 'unknown partner' };
    }
    if (new Set(partners).size !== partners.length) return { ok: false, error: 'duplicate partner' };
    return { ok: true, value: { goal, country, experience, custody, amount, partners: [...partners] } };
  }
  if (kind === 'result') {
    const fields = RESULT_FIELDS[source];
    if (!fields) return { ok: false, error: 'result needs source stacking, loan or tax' };
    const value = {};
    for (const [key, unit, min, max] of fields) {
      const v = payload[key];
      if (unit === 'frequency' ? !oneOf(FREQUENCIES, v)
        : unit === 'country' ? !oneOf(COUNTRIES, v)
        : unit === 'partner' ? !(typeof v === 'string' && Object.hasOwn(PARTNERS, v))
        : !finiteIn(v, min, max)) {
        return { ok: false, error: `bad ${key}` };
      }
      value[key] = v;
    }
    return { ok: true, value };
  }
  return { ok: false, error: 'unknown kind' };
}

// --- rendering -------------------------------------------------------------

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sitePage(siteLang, page) {
  return siteLang === 'en' ? `${SITE}/${page}` : `${SITE}/${siteLang}/${page}`;
}

function withUtm(url, kind, content) {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'email');
  u.searchParams.set('utm_medium', kind);
  u.searchParams.set('utm_campaign', 'capture');
  if (content) u.searchParams.set('utm_content', content);
  return u.toString();
}

function formatValue(S, emailLang, unit, v) {
  const loc = LOCALES[emailLang];
  const num = (n, d = 0) => new Intl.NumberFormat(loc, { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
  switch (unit) {
    case 'eur':
      return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(v);
    case 'pct':
      return `${num(v, Number.isInteger(v) ? 0 : 1)}${emailLang === 'en' ? '' : ' '}%`;
    case 'btc':
      return `${num(v, 4)} BTC`;
    case 'years':
      return S.years(v);
    case 'score':
      return `${num(v)} / 100`;
    case 'frequency':
      return S.values.frequency[v];
    case 'country':
      return S.values.country[v];
    case 'partner':
      return PARTNERS[v].name;
    default:
      return String(v);
  }
}

function rows(pairs) {
  return pairs
    .map(([label, value]) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #e3ddd0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5c564c;">${esc(label)}</td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #e3ddd0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#16120c;">${esc(value)}</td>
</tr>`)
    .join('\n');
}

function button(href, label) {
  return `<a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background-color:#16120c;color:#ffffff;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;">${esc(label)}</a>`;
}

function layout({ lang, title, intro, body, footer }) {
  return `<!DOCTYPE html>
<html lang="${esc(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f4f1ea;color:#16120c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:#ffffff;border:1px solid #e3ddd0;border-radius:12px;">
<tr><td style="padding:28px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:800;"><span style="color:#5FAEDE;">V</span>irtuse</td></tr>
<tr><td style="padding:8px 32px 0 32px;">
<h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px;font-weight:600;color:#16120c;">${esc(title)}</h1>
<p style="margin:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:#3d382f;">${esc(intro)}</p>
${body}
</td></tr>
<tr><td style="padding:24px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7a7366;">${footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function footerHtml(S, brief) {
  return [S.disclaimer, S.why, brief ? S.whyBrief : '']
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 8px 0;">${esc(p)}</p>`)
    .join('');
}

// Returns { subject, html } for an already-validated request.
export function renderSendEmail({ kind, source, payload, lang, brief }) {
  const siteLang = SITE_LANGS.includes(lang) ? lang : 'en';
  const emailLang = EMAIL_LANGS.includes(lang) ? lang : 'en';
  const S = STRINGS[emailLang];

  if (kind === 'plan') {
    const criteria = rows(
      ['goal', 'country', 'experience', 'custody', 'amount'].map((k) => [S.labels[k], S.values[k][payload[k]]])
    );
    const partners = payload.partners
      .map((id) => {
        const p = PARTNERS[id];
        return `<tr><td style="padding:14px 0;border-bottom:1px solid #e3ddd0;">
<p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#16120c;">${esc(p.name)}</p>
${button(withUtm(p.url, kind, id), S.openPartner.replace('{0}', p.name))}
<a href="${esc(withUtm(sitePage(siteLang, p.page), kind, id))}" style="margin-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#5c564c;">${esc(S.seeCard)}</a>
</td></tr>`;
      })
      .join('\n');
    const body = `<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a7366;">${esc(S.criteria)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">${criteria}</table>
<p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a7366;">${esc(S.matches)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${partners}</table>
<p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#7a7366;">${esc(S.matchesNote)}</p>`;
    return {
      subject: S.planSubject,
      html: layout({ lang: emailLang, title: S.planTitle, intro: S.planIntro, body, footer: footerHtml(S, brief) }),
    };
  }

  // kind === 'result'
  const fields = RESULT_FIELDS[source];
  const table = rows(fields.map(([key, unit]) => [S.labels[key] || '', formatValue(S, emailLang, unit, payload[key])]));
  let toolUrl = sitePage(siteLang, TOOL_PAGE[source]);
  if (source === 'tax') toolUrl += `?country=${payload.country}`;
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">${table}</table>
${source === 'tax' ? `<p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#5c564c;">${esc(S.taxNote)}</p>` : ''}
${button(withUtm(toolUrl, kind, source), S.reopen)}`;
  return {
    subject: S.resultSubject[source],
    html: layout({ lang: emailLang, title: S.resultTitle, intro: S.resultIntro, body, footer: footerHtml(S, brief) }),
  };
}

// --- request handler ---------------------------------------------------------

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Per-address limit, on top of the per-IP one. The key is a hash so the
// KV namespace never holds plain addresses.
async function isAddressLimited(env, email) {
  const key = `sendlimit:${await sha256Hex(email.trim().toLowerCase())}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || '0', 10);
  if (current >= SEND_LIMIT_PER_ADDRESS) return true;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: SEND_LIMIT_WINDOW_SECONDS });
  return false;
}

// deps: { json, isRateLimited, addContact, sendWelcomeEmail, emailRe, welcomeLangs }
export async function handleSend(request, env, origin, deps) {
  const { json } = deps;
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' }, origin);
  }
  const { email, hp, lang: rawLang, kind, source, payload, brief } = body || {};

  if (hp) return json(200, { ok: true }, origin);

  if (!email || typeof email !== 'string' || email.length > 254 || !deps.emailRe.test(email)) {
    return json(400, { error: 'Please enter a valid email address.' }, origin);
  }
  if (!oneOf(SEND_KINDS, kind) || !oneOf(SEND_SOURCES, source)) {
    return json(400, { error: 'Invalid request.' }, origin);
  }
  const checked = validatePayload(kind, source, payload);
  if (!checked.ok) return json(400, { error: 'Invalid request.', detail: checked.error }, origin);

  const lang = oneOf(SITE_LANGS, rawLang) ? rawLang : 'en';
  const wantsBrief = brief === true;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if ((await deps.isRateLimited(env, ip)) || (await isAddressLimited(env, email))) {
    return json(429, { error: 'Too many attempts. Please try again later.' }, origin);
  }

  const { subject, html } = renderSendEmail({ kind, source, payload: checked.value, lang, brief: wantsBrief });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_SEND_FROM || env.RESEND_FROM_EMAIL,
        to: [email],
        ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
        subject,
        html,
        tags: [
          { name: 'kind', value: kind },
          { name: 'source', value: source },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend send failed (status ${res.status}): ${text.slice(0, 300)}`);
    }

    if (wantsBrief) {
      // Same as POST /subscribe: the Brief welcome language follows the
      // page language when there is a welcome template for it.
      const briefLang = deps.welcomeLangs.includes(lang) ? lang : 'en';
      const result = await deps.addContact(env, email, briefLang);
      if (result.created) await deps.sendWelcomeEmail(env, email, briefLang);
    }
    return json(200, { ok: true }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: 'Something went wrong. Please try again in a moment.' }, origin);
  }
}
