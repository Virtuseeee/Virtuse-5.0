// ─────────────────────────────────────────────────────────────
// Bitcoin Concierge – data + rule-based routing engine
// Virtuse Layer 2 (non-custodial: the concierge only routes,
// KYC & onboarding always happen on the partner's platform)
//
// Trilingual (en/sk/cs): every display string is a {en, sk, cs}
// LocalizedText, or goes through t(lang, en, sk, cs). Matching logic,
// thresholds and branching are 100% unchanged from the English-only
// version — only how strings are represented changed. Do not rework
// the routing/matching logic itself.
// ─────────────────────────────────────────────────────────────

import { t, tv, L } from './i18n';
import type { Lang, LocalizedText } from './i18n';
export type { Lang, LocalizedText };

export type GoalId =
  | 'buy'
  | 'loan'
  | 'earn'
  | 'treasury'
  | 'mining'
  | 'custody'
  | 'tax';

export type CustodyPref = 'self' | 'assisted' | 'any';
export type AmountBucket = 's' | 'm' | 'l' | 'xl';

export interface GoalOption {
  id: GoalId;
  label: LocalizedText;
  hint: LocalizedText;
}

export interface ChipOption {
  id: string;
  label: LocalizedText;
  hint?: LocalizedText;
}

export interface Partner {
  id: string;
  name: string;
  tagline: LocalizedText;
  goals: GoalId[];
  custody?: CustodyPref[]; // relevant custody fit
  url: string;
  feeNote: LocalizedText;
  countries: string[]; // 'ALL' = all supported countries
  badge?: LocalizedText;
}

export interface Recommendation {
  partner: Partner;
  match: number;
  reasons: string[];
  actionLabel: string;
}

export const GOALS: GoalOption[] = [
  { id: 'buy', label: { en: 'Buy Bitcoin', sk: 'Kúpiť Bitcoin', cs: 'Koupit Bitcoin' }, hint: { en: 'First purchase or regular stacking', sk: 'Prvý nákup alebo pravidelné dokupovanie', cs: 'První nákup nebo pravidelné dokupování' } },
  { id: 'loan', label: { en: 'Bitcoin-backed loan', sk: 'Pôžička kryté Bitcoinom', cs: 'Půjčka krytá Bitcoinem' }, hint: { en: 'Liquidity without selling', sk: 'Likvidita bez predaja', cs: 'Likvidita bez prodeje' } },
  { id: 'earn', label: { en: 'Automate & compound', sk: 'Automatizovať a zhodnocovať', cs: 'Automatizovat a zhodnocovat' }, hint: { en: 'Non-custodial trading & DCA bots', sk: 'Nekustodiálne obchodné a DCA boty', cs: 'Nekustodiální obchodní a DCA boti' } },
  { id: 'treasury', label: { en: 'Corporate treasury', sk: 'Firemný treasury', cs: 'Firemní treasury' }, hint: { en: 'BTC on the balance sheet', sk: 'BTC v súvahe firmy', cs: 'BTC v rozvaze firmy' } },
  { id: 'mining', label: { en: 'Mining', sk: 'Ťažba', cs: 'Těžba' }, hint: { en: 'Earn fresh sats', sk: 'Získavajte nové satoshi', cs: 'Získávejte nové satoshi' } },
  { id: 'custody', label: { en: 'Custody & inheritance', sk: 'Úschova a dedičstvo', cs: 'Úschova a dědictví' }, hint: { en: 'Keys, multisig, legacy', sk: 'Kľúče, multisig, odkaz', cs: 'Klíče, multisig, odkaz' } },
  { id: 'tax', label: { en: 'Tax help', sk: 'Pomoc s daňami', cs: 'Pomoc s daněmi' }, hint: { en: 'Reports & compliance', sk: 'Priznania a compliance', cs: 'Přiznání a compliance' } },
];

export const COUNTRIES: ChipOption[] = [
  { id: 'cz', label: { en: 'Czechia', sk: 'Česko', cs: 'Česko' } },
  { id: 'sk', label: { en: 'Slovakia', sk: 'Slovensko', cs: 'Slovensko' } },
  { id: 'pl', label: { en: 'Poland', sk: 'Poľsko', cs: 'Polsko' } },
  { id: 'at', label: { en: 'Austria', sk: 'Rakúsko', cs: 'Rakousko' } },
  { id: 'de', label: { en: 'Germany', sk: 'Nemecko', cs: 'Německo' } },
  { id: 'hu', label: { en: 'Hungary', sk: 'Maďarsko', cs: 'Maďarsko' } },
  { id: 'si', label: { en: 'Slovenia', sk: 'Slovinsko', cs: 'Slovinsko' } },
  { id: 'hr', label: { en: 'Croatia', sk: 'Chorvátsko', cs: 'Chorvatsko' } },
  { id: 'ro', label: { en: 'Romania', sk: 'Rumunsko', cs: 'Rumunsko' } },
  { id: 'bg', label: { en: 'Bulgaria', sk: 'Bulharsko', cs: 'Bulharsko' } },
  { id: 'nl', label: { en: 'Netherlands', sk: 'Holandsko', cs: 'Nizozemsko' } },
  { id: 'fr', label: { en: 'France', sk: 'Francúzsko', cs: 'Francie' } },
  { id: 'es', label: { en: 'Spain', sk: 'Španielsko', cs: 'Španělsko' } },
];

export const EXPERIENCE: ChipOption[] = [
  { id: 'new', label: { en: 'New to Bitcoin', sk: 'Nový v Bitcoine', cs: 'Nový v Bitcoinu' }, hint: { en: 'First purchase, learning the ropes', sk: 'Prvý nákup, zoznamovanie sa', cs: 'První nákup, seznamování se' } },
  { id: 'hodler', label: { en: 'I already hold Bitcoin', sk: 'Už vlastním Bitcoin', cs: 'Už vlastním Bitcoin' }, hint: { en: 'Looking to optimize', sk: 'Chcem to optimalizovať', cs: 'Chci to optimalizovat' } },
];

export const CUSTODY: ChipOption[] = [
  { id: 'self', label: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' }, hint: { en: 'My keys, my coins', sk: 'Moje kľúče, moje mince', cs: 'Moje klíče, moje mince' } },
  { id: 'assisted', label: { en: 'Assisted custody', sk: 'Asistovaná úschova', cs: 'Asistovaná úschova' }, hint: { en: 'Help with keys & recovery', sk: 'Pomoc s kľúčmi a obnovou', cs: 'Pomoc s klíči a obnovou' } },
  { id: 'any', label: { en: 'No preference yet', sk: 'Zatiaľ bez preferencie', cs: 'Zatím bez preference' }, hint: { en: 'Show all options', sk: 'Ukážte všetky možnosti', cs: 'Ukažte všechny možnosti' } },
];

export const AMOUNTS: ChipOption[] = [
  { id: 's', label: { en: '< €1,000', sk: '< 1 000 €', cs: '< 1 000 €' } },
  { id: 'm', label: { en: '€1,000 – 10,000', sk: '1 000 – 10 000 €', cs: '1 000 – 10 000 €' } },
  { id: 'l', label: { en: '€10,000 – 100,000', sk: '10 000 – 100 000 €', cs: '10 000 – 100 000 €' } },
  { id: 'xl', label: { en: '> €100,000', sk: '> 100 000 €', cs: '> 100 000 €' } },
];

// Every entry below is a real partner with a real, currently-live
// affiliate/referral link taken directly from the matching page on
// virtuse.com (buy-bitcoin.html, mining.html, secure.html, tax.html,
// treasury.html, lending.html, bots.html) — the concierge must never
// recommend a partner the site doesn't actually feature, and every
// "Continue to partner" click must land on that partner's own site via
// our tracked link, not a virtuse.com page. If a category ever has no
// affiliate/referral link for a given partner, link to that partner's
// plain site instead of inventing a tracked URL — never fall back to a
// virtuse.com page for a "continue to partner" action.
export const PARTNERS: Partner[] = [
  // ── Buy Bitcoin (buy-bitcoin.html) ──
  {
    id: '21bitcoin',
    name: '21bitcoin',
    tagline: { en: 'Bitcoin-only app, FMA MiCAR licensed — insured custody', sk: 'Aplikácia len pre Bitcoin, licencia FMA MiCAR — poistená úschova', cs: 'Aplikace jen pro Bitcoin, licence FMA MiCAR — pojištěná úschova' },
    goals: ['buy'],
    custody: ['any', 'assisted'],
    url: 'https://21bitcoin.app.link/invite/?code=VIRTUSE',
    feeNote: { en: 'Auto-Invest savings plan with 0% fees', sk: 'Sporiaci plán Auto-Invest s 0 % poplatkami', cs: 'Spořicí plán Auto-Invest s 0 % poplatky' },
    countries: ['ALL'],
    badge: { en: 'MiCA-licensed', sk: 's licenciou MiCA', cs: 's licencí MiCA' },
  },
  {
    id: 'kraken',
    name: 'Kraken',
    tagline: { en: 'Veteran EU exchange — deep EUR liquidity since 2011', sk: 'Skúsená EÚ burza — hlboká EUR likvidita od roku 2011', cs: 'Zkušená EU burza — hluboká EUR likvidita od roku 2011' },
    goals: ['buy'],
    custody: ['any', 'self'],
    url: 'https://proinvite.kraken.com/9f1e/lj72d37e',
    feeNote: { en: 'Pro trading fees from 0.8%', sk: 'Poplatky Pro trading od 0,8 %', cs: 'Poplatky Pro trading od 0,8 %' },
    countries: ['ALL'],
    badge: { en: 'MiCA-licensed', sk: 's licenciou MiCA', cs: 's licencí MiCA' },
  },
  {
    id: 'bybit-eu',
    name: 'ByBit EU',
    tagline: { en: 'Top-3 global exchange, EU-licensed in Vienna', sk: 'Burza v top 3 celosvetovo, licencovaná v EÚ vo Viedni', cs: 'Burza v top 3 celosvětově, licencovaná v EU ve Vídni' },
    goals: ['buy'],
    custody: ['any'],
    url: 'https://partner.bybit.eu/b/VIRTUSE',
    feeNote: { en: 'Spot trading fees from 0.25%', sk: 'Poplatky za spot obchodovanie od 0,25 %', cs: 'Poplatky za spotové obchodování od 0,25 %' },
    countries: ['ALL'],
    badge: { en: 'MiCA-licensed', sk: 's licenciou MiCA', cs: 's licencí MiCA' },
  },
  {
    id: 'invity',
    name: 'Invity',
    tagline: { en: 'Bitcoin-only app with Auto Buy and Auto Send to your own wallet', sk: 'Aplikácia len pre Bitcoin s Auto Buy a Auto Send do vlastnej peňaženky', cs: 'Aplikace jen pro Bitcoin s Auto Buy a Auto Send do vlastní peněženky' },
    goals: ['buy'],
    custody: ['any'],
    url: 'https://invity.onelink.me/yIY4/j44d7awx',
    feeNote: { en: 'From the SatoshiLabs group; Bitcoin held with BitGo until you withdraw it', sk: 'Zo skupiny SatoshiLabs; Bitcoin u správcu BitGo, kým ho nevyberiete', cs: 'Ze skupiny SatoshiLabs; Bitcoin u správce BitGo, dokud ho nevyberete' },
    countries: ['ALL'],
    badge: { en: 'Bitcoin only', sk: 'Iba Bitcoin', cs: 'Jen Bitcoin' },
  },
  {
    id: 'crypto-com',
    name: 'Crypto.com',
    tagline: { en: 'Large global platform with full EEA passporting', sk: 'Veľká globálna platforma s plným EHP passportingom', cs: 'Velká globální platforma s plným EHP passportingem' },
    goals: ['buy'],
    custody: ['any'],
    url: 'https://cryptocom.sjv.io/c/7490229/2051372/25666',
    feeNote: { en: 'Deep liquidity; Crypto.com Visa Card supported', sk: 'Hlboká likvidita; podporovaná Crypto.com Visa karta', cs: 'Hluboká likvidita; podporovaná karta Crypto.com Visa' },
    countries: ['ALL'],
    badge: { en: 'MiCA-licensed', sk: 's licenciou MiCA', cs: 's licencí MiCA' },
  },

  // ── Custody (secure.html) ──
  {
    id: 'trezor',
    name: 'Trezor',
    tagline: { en: 'The original Bitcoin hardware wallet, since 2013', sk: 'Pôvodná hardvérová peňaženka pre Bitcoin, od roku 2013', cs: 'Původní hardwarová peněženka pro Bitcoin, od roku 2013' },
    goals: ['custody', 'buy'],
    custody: ['self'],
    url: 'https://affil.trezor.io/aff_c?offer_id=133&aff_id=846427',
    feeNote: { en: 'Fully open-source hardware and firmware', sk: 'Plne open-source hardvér aj firmvér', cs: 'Plně open-source hardware i firmware' },
    countries: ['ALL'],
    badge: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' },
  },
  {
    id: 'ledger',
    name: 'Ledger',
    tagline: { en: "World's most popular hardware wallet — 7M+ sold", sk: 'Najpopulárnejšia hardvérová peňaženka na svete — predaných 7M+', cs: 'Nejpopulárnější hardwarová peněženka na světě — prodáno 7M+' },
    goals: ['custody'],
    custody: ['self'],
    url: 'https://shop.ledger.com/?r=3256467ea813',
    feeNote: { en: 'Certified Secure Element chip; Ledger Live app', sk: 'Certifikovaný čip Secure Element; aplikácia Ledger Live', cs: 'Certifikovaný čip Secure Element; aplikace Ledger Live' },
    countries: ['ALL'],
    badge: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' },
  },
  {
    id: 'blockstream',
    name: 'Blockstream',
    tagline: { en: 'Bitcoin Core-grade infra — multisig & collaborative custody', sk: 'Infraštruktúra na úrovni Bitcoin Core — multisig a kolaboratívna úschova', cs: 'Infrastruktura na úrovni Bitcoin Core — multisig a kolaborativní úschova' },
    goals: ['custody'],
    custody: ['self'],
    url: 'https://rewards.blockstream.com/qo0khs',
    feeNote: { en: 'Blockstream Jade — fully open-source, no secure element', sk: 'Blockstream Jade — plne open-source, bez secure elementu', cs: 'Blockstream Jade — plně open-source, bez secure elementu' },
    countries: ['ALL'],
    badge: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' },
  },

  // ── Loans (lending.html) ──
  {
    id: 'firefish',
    name: 'Firefish',
    tagline: { en: 'Bitcoin-backed P2P loans, multisig-secured', sk: 'P2P pôžičky kryté Bitcoinom, zabezpečené multisigom', cs: 'P2P půjčky kryté Bitcoinem, zabezpečené multisigem' },
    goals: ['loan'],
    custody: ['self'],
    url: 'https://app.firefish.io/auth/sign-up?ref=virtuseloan',
    feeNote: { en: 'Market-driven rates; no credit checks', sk: 'Trhové úrokové sadzby; bez kontroly bonity', cs: 'Tržní úrokové sazby; bez kontroly bonity' },
    countries: ['ALL'],
    badge: { en: 'Bitcoin-native', sk: 'Natívne pre Bitcoin', cs: 'Nativní pro Bitcoin' },
  },

  // ── Tax (tax.html) ──
  {
    id: 'blockpit',
    name: 'Blockpit',
    tagline: { en: 'Austrian-built tax tool, country-specific EU reports', sk: 'Rakúsky daňový nástroj, výkazy podľa konkrétnej krajiny EÚ', cs: 'Rakouský daňový nástroj, výkazy podle konkrétní země EU' },
    goals: ['tax'],
    url: 'https://app.blockpit.io/register?fpr=virtuse',
    feeNote: { en: 'Free portfolio tracking tier; 700+ integrations', sk: 'Bezplatné sledovanie portfólia; 700+ integrácií', cs: 'Bezplatné sledování portfolia; 700+ integrací' },
    countries: ['ALL'],
  },
  {
    id: 'koinly',
    name: 'Koinly',
    tagline: { en: 'AI-matched transfers across 400+ exchanges, 100+ countries', sk: 'AI párovanie prevodov naprieč 400+ burzami, 100+ krajinami', cs: 'AI párování převodů napříč 400+ burzami, 100+ zeměmi' },
    goals: ['tax'],
    url: 'https://koinly.io/?via=C7DEBFCF&utm_source=affiliate',
    feeNote: { en: 'Free to track; pay only when you download the report', sk: 'Sledovanie zdarma; platíte len pri stiahnutí výkazu', cs: 'Sledování zdarma; platíte jen při stažení výkazu' },
    countries: ['ALL'],
  },
  {
    id: 'cointracking',
    name: 'CoinTracking',
    tagline: { en: 'The veteran crypto tax tracker, since 2013', sk: 'Skúsený nástroj na sledovanie kryptodaní, od roku 2013', cs: 'Zkušený nástroj pro sledování kryptoDaní, od roku 2013' },
    goals: ['tax'],
    url: 'https://cointracking.info/?ref=V328565',
    feeNote: { en: '300+ exchange integrations; free up to 200 transactions', sk: '300+ integrácií búrz; zdarma do 200 transakcií', cs: '300+ integrací burz; zdarma do 200 transakcí' },
    countries: ['ALL'],
  },
  {
    id: 'divly',
    name: 'Divly',
    tagline: { en: 'Privacy-first tax tool, no KYC required', sk: 'Daňový nástroj s dôrazom na súkromie, bez potreby KYC', cs: 'Daňový nástroj s důrazem na soukromí, bez nutnosti KYC' },
    goals: ['tax'],
    url: 'https://divly.com/?ref=otfkzmf',
    feeNote: { en: '14-minute import-to-report', sk: 'Od importu k výkazu za 14 minút', cs: 'Od importu k výkazu za 14 minut' },
    countries: ['ALL'],
  },

  // ── Treasury (treasury.html) ──
  {
    id: 'bitgo',
    name: 'BitGo',
    tagline: { en: 'Institutional custodian, MiCA CASP via BaFin Germany', sk: 'Inštitucionálny kustodián, MiCA CASP cez nemecký BaFin', cs: 'Institucionální kustodián, MiCA CASP přes německý BaFin' },
    goals: ['treasury'],
    url: 'https://bitgo.com',
    feeNote: { en: '$250M insurance coverage; already serves 21bitcoin', sk: 'Poistné krytie 250 mil. USD; už slúži 21bitcoin', cs: 'Pojistné krytí 250 mil. USD; už slouží 21bitcoin' },
    countries: ['ALL'],
    badge: { en: 'MiCA-licensed', sk: 's licenciou MiCA', cs: 's licencí MiCA' },
  },
  {
    id: 'sygnum',
    name: 'Sygnum',
    tagline: { en: "World's first regulated digital asset bank", sk: 'Prvá regulovaná banka pre digitálne aktíva na svete', cs: 'První regulovaná banka pro digitální aktiva na světě' },
    goals: ['treasury'],
    url: 'https://sygnum.com',
    feeNote: { en: 'FINMA banking license; discretionary treasury mandates', sk: 'Banková licencia FINMA; diskrečné treasury mandáty', cs: 'Bankovní licence FINMA; diskreční treasury mandáty' },
    countries: ['ALL'],
    badge: { en: 'Regulated bank', sk: 'Regulovaná banka', cs: 'Regulovaná banka' },
  },
  {
    id: 'coinbase-institutional',
    name: 'Coinbase Institutional',
    tagline: { en: 'Largest regulated crypto custodian globally', sk: 'Najväčší regulovaný kryptokustodián na svete', cs: 'Největší regulovaný kryptokustodián na světě' },
    goals: ['treasury'],
    url: 'https://coinbase.com/institutional',
    feeNote: { en: 'MiCA CASP via CSSF Luxembourg; SOC 2 Type II', sk: 'MiCA CASP cez luxemburský CSSF; SOC 2 Type II', cs: 'MiCA CASP přes lucemburský CSSF; SOC 2 Type II' },
    countries: ['ALL'],
    badge: { en: 'MiCA-licensed', sk: 's licenciou MiCA', cs: 's licencí MiCA' },
  },

  // ── Bots (bots.html) ──
  {
    id: 'coinrule',
    name: 'Coinrule',
    tagline: { en: 'Explicitly non-custodial, trade-only API bots', sk: 'Výslovne nekustodiálne, API boty len na obchodovanie', cs: 'Výslovně nekustodiální, API boti jen pro obchodování' },
    goals: ['earn'],
    custody: ['self', 'any'],
    url: 'https://coinrule.com/?fp_ref=virtuse',
    feeNote: { en: '150+ strategy templates; Y Combinator backed', sk: '150+ šablón stratégií; podporené Y Combinator', cs: '150+ šablon strategií; podpořeno Y Combinator' },
    countries: ['ALL'],
    badge: { en: 'Non-custodial', sk: 'Nekustodiálne', cs: 'Nekustodiální' },
  },
  {
    id: 'cryptohopper',
    name: 'Cryptohopper',
    tagline: { en: 'The most beginner-friendly bot platform', sk: 'Platforma botov najprívetivejšia pre začiatočníkov', cs: 'Platforma botů nejpřívětivější pro začátečníky' },
    goals: ['earn'],
    custody: ['self', 'any'],
    url: 'https://www.cryptohopper.com/?atid=40864',
    feeNote: { en: 'Copy trading, paper trading, 30-day free trial', sk: 'Copy trading, papierové obchodovanie, 30-dňová skúšobná verzia', cs: 'Copy trading, papírové obchodování, 30denní zkušební verze' },
    countries: ['ALL'],
  },
  {
    id: 'revenuebot',
    name: 'RevenueBot',
    tagline: { en: 'Cloud DCA and grid bots, Bitcoin-focused', sk: 'Cloudové DCA a grid boty zamerané na Bitcoin', cs: 'Cloudoví DCA a grid boti zaměření na Bitcoin' },
    goals: ['earn'],
    custody: ['self', 'any'],
    url: 'https://app.revenuebot.io/external/r/90928',
    feeNote: { en: 'Referral commissions paid in BTC', sk: 'Referral provízie vyplácané v BTC', cs: 'Referral provize vyplácené v BTC' },
    countries: ['ALL'],
  },

  // ── Mining (mining.html) ──
  {
    id: 'oneminers',
    name: 'OneMiners',
    tagline: { en: 'Top 5 EU ASIC reseller with EU/Nordic hosting', sk: 'Top 5 predajca ASIC v EÚ s hostingom v EÚ/Škandinávii', cs: 'Top 5 prodejce ASIC v EU s hostingem v EU/Skandinávii' },
    goals: ['mining'],
    url: 'https://oneminers.com/products/?discount=virtuse_buy',
    feeNote: { en: 'Hosting in Norway, Finland, and Ethiopia', sk: 'Hosting v Nórsku, Fínsku a Etiópii', cs: 'Hosting v Norsku, Finsku a Etiopii' },
    countries: ['ALL'],
  },
  {
    id: 'abundant-mines',
    name: 'Abundant Mines',
    tagline: { en: 'Professionally managed, renewable-energy mining', sk: 'Profesionálne spravovaná ťažba na obnoviteľnú energiu', cs: 'Profesionálně spravovaná těžba na obnovitelnou energii' },
    goals: ['mining'],
    url: 'https://abundantmines.com/ref/76/',
    feeNote: { en: 'Enterprise-grade facilities for mid-to-large miners', sk: 'Zariadenia podnikovej úrovne pre stredných a veľkých ťažiarov', cs: 'Zařízení podnikové úrovně pro střední a velké těžaře' },
    countries: ['ALL'],
  },
  {
    id: 'power-mining',
    name: 'Power Mining',
    tagline: { en: 'Open-source mining hardware specialist (Bitaxe)', sk: 'Špecialista na open-source ťažobný hardvér (Bitaxe)', cs: 'Specialista na open-source těžební hardware (Bitaxe)' },
    goals: ['mining'],
    url: 'https://shop.powermining.io/?ref=Virtuse',
    feeNote: { en: 'EU warehouse, fast shipping; 22,000+ products sold', sk: 'Sklad v EÚ, rýchle doručenie; predaných 22 000+ produktov', cs: 'Sklad v EU, rychlé doručení; prodáno 22 000+ produktů' },
    countries: ['ALL'],
  },
];

export interface Answers {
  goal?: GoalId;
  country?: string;
  experience?: 'new' | 'hodler';
  custody?: CustodyPref;
  amount?: AmountBucket;
}

const countryName = (lang: Lang, id?: string) =>
  L(COUNTRIES.find((c) => c.id === id)?.label, lang) ?? t(lang, 'your country', 'vašu krajinu', 'vaši zemi');

const amountLabel = (lang: Lang, id?: AmountBucket) =>
  L(AMOUNTS.find((a) => a.id === id)?.label, lang) ?? t(lang, 'your amount', 'vašu sumu', 'vaši částku');

export function needsCustodyStep(goal?: GoalId): boolean {
  return goal === 'buy' || goal === 'loan' || goal === 'custody';
}

export function recommend(a: Answers, lang: Lang = 'en'): Recommendation[] {
  const recs: Recommendation[] = [];
  const push = (pid: string, match: number, reasons: string[], actionLabel?: string) => {
    const partner = PARTNERS.find((p) => p.id === pid);
    if (partner) recs.push({ partner, match, reasons, actionLabel: actionLabel ?? t(lang, 'Continue to partner', 'Pokračovať k partnerovi', 'Pokračovat k partnerovi') });
  };

  switch (a.goal) {
    case 'buy': {
      if (a.experience === 'new') {
        push('21bitcoin', 96, [
          tv(lang, `Simplest start for newcomers in {0} — FMA MiCAR licensed, insured Bitcoin custody.`, `Najjednoduchší štart pre začiatočníkov ({0}) — licencia FMA MiCAR, poistená úschova Bitcoinu.`, `Nejjednodušší start pro začátečníky ({0}) — licence FMA MiCAR, pojištěná úschova Bitcoinu.`, [countryName(lang, a.country)]),
          t(lang,
            'Auto-Invest savings plan with 0% fees; 100,000+ European users.',
            'Sporiaci plán Auto-Invest s 0 % poplatkami; 100 000+ európskych používateľov.',
            'Spořicí plán Auto-Invest s 0 % poplatky; 100 000+ evropských uživatelů.'),
        ]);
      } else {
        push('kraken', 93, [
          tv(lang, `Veteran EU exchange with deep EUR liquidity for {0}.`, `Skúsená EÚ burza s hlbokou EUR likviditou pre sumu {0}.`, `Zkušená EU burza s hlubokou EUR likviditou pro částku {0}.`, [amountLabel(lang, a.amount)]),
          t(lang,
            'Founded 2011 — MiCA licensed via the Central Bank of Ireland.',
            'Založená v roku 2011 — licencia MiCA cez Írsku centrálnu banku.',
            'Založená v roce 2011 — licence MiCA přes Irskou centrální banku.'),
        ]);
      }
      if (a.custody !== 'self') {
        // Not for self-custody: Invity holds Bitcoin with BitGo until withdrawal.
        push('invity', 80, [
          t(lang,
            'Bitcoin-only app: buy once or with Auto Buy, then withdraw to your own wallet at any time or let Auto Send move it automatically.',
            'Aplikácia len pre Bitcoin: nakúpte jednorazovo alebo cez Auto Buy a kedykoľvek si ho vyberte do vlastnej peňaženky, alebo ho tam automaticky presunie Auto Send.',
            'Aplikace jen pro Bitcoin: nakupte jednorázově nebo přes Auto Buy a kdykoli si ho vyberte do vlastní peněženky, nebo ho tam automaticky přesune Auto Send.'),
          t(lang,
            'Licensed by the Czech National Bank as a CASP under MiCA; part of the SatoshiLabs group, the makers of Trezor.',
            'Licencia Českej národnej banky (CASP podľa MiCA); súčasť skupiny SatoshiLabs, tvorcov Trezoru.',
            'Licence České národní banky (CASP podle MiCA); součást skupiny SatoshiLabs, tvůrců Trezoru.'),
        ]);
      }
      if (a.amount === 'l' || a.amount === 'xl') {
        push('bybit-eu', 84, [
          t(lang,
            'For larger amounts, a top-3 global exchange gives you deeper order books and tighter spreads.',
            'Pri väčších sumách vám burza v top 3 celosvetovo ponúkne hlbšie orderbooky a nižšie spready.',
            'U větších částek vám burza v top 3 celosvětově nabídne hlubší orderbooky a nižší spready.'),
        ]);
      } else if (a.custody !== 'self') {
        push('crypto-com', 78, [
          t(lang,
            'A large global platform with full EEA passporting if you want more than spot buying — card, wider asset coverage.',
            'Veľká globálna platforma s plným EHP passportingom, ak chcete viac než len spotový nákup — karta, širšia ponuka aktív.',
            'Velká globální platforma s plným EHP passportingem, pokud chcete víc než jen spotový nákup — karta, širší nabídka aktiv.'),
        ]);
      }
      if (a.custody === 'self' && a.experience !== 'new') {
        push('trezor', 74, [
          t(lang,
            'Since you want self-custody: move your Bitcoin off any exchange onto your own hardware wallet as soon as you buy.',
            'Keďže chcete vlastnú úschovu: presuňte si Bitcoin z burzy do vlastnej hardvérovej peňaženky hneď po nákupe.',
            'Když chcete vlastní úschovu: přesuňte si Bitcoin z burzy do vlastní hardwarové peněženky hned po nákupu.'),
        ]);
      }
      break;
    }
    case 'loan': {
      if (a.custody === 'assisted') {
        push('firefish', 80, [
          t(lang,
            'Bitcoin-backed P2P loans, market-driven rates — but note: Firefish assumes self-custody via multisig escrow.',
            'P2P pôžičky kryté Bitcoinom, trhové úrokové sadzby — pozor: Firefish predpokladá vlastnú úschovu cez multisig escrow.',
            'P2P půjčky kryté Bitcoinem, tržní úrokové sazby — pozor: Firefish předpokládá vlastní úschovu přes multisig escrow.'),
          t(lang,
            'If you prefer assisted custody, set that up first, then come back for the loan.',
            'Ak preferujete asistovanú úschovu, najprv si ju zariaďte a potom sa vráťte k pôžičke.',
            'Pokud preferujete asistovanou úschovu, nejprve si ji zařiďte a pak se vraťte k půjčce.'),
        ]);
      } else {
        push('firefish', 97, [
          t(lang, 'Borrow EUR against your bitcoin — keep 100% of the upside.', 'Požičajte si EUR oproti svojmu bitcoinu — ponechajte si 100 % potenciálneho zisku.', 'Půjčte si EUR oproti svému bitcoinu — ponechte si 100 % potenciálního zisku.'),
          t(lang, 'No credit checks, no sale, no taxable event in most EU jurisdictions.', 'Bez kontroly bonity, bez predaja, vo väčšine jurisdikcií EÚ bez zdaniteľnej udalosti.', 'Bez kontroly bonity, bez prodeje, ve většině jurisdikcí EU bez zdanitelné události.'),
          tv(lang, `Works for {0} in {1} via multisig-secured P2P.`, `Funguje pre sumu {0} ({1}) cez P2P zabezpečené multisigom.`, `Funguje pro částku {0} ({1}) přes P2P zabezpečené multisigem.`, [amountLabel(lang, a.amount), countryName(lang, a.country)]),
        ]);
      }
      break;
    }
    case 'earn': {
      if (a.experience === 'new') {
        push('cryptohopper', 90, [
          t(lang,
            'The most beginner-friendly bot platform — copy trading, paper trading, and a 30-day free trial before you commit.',
            'Platforma botov najprívetivejšia pre začiatočníkov — copy trading, papierové obchodovanie a 30-dňová skúšobná verzia zadarmo.',
            'Platforma botů nejpřívětivější pro začátečníky — copy trading, papírové obchodování a 30denní zkušební verze zdarma.'),
        ]);
        push('coinrule', 80, [
          t(lang,
            '150+ ready-made strategy templates for when you want to graduate to building your own rules.',
            '150+ hotových šablón stratégií pre chvíľu, keď budete chcieť vytvárať vlastné pravidlá.',
            '150+ hotových šablon strategií pro chvíli, kdy budete chtít vytvářet vlastní pravidla.'),
        ]);
      } else {
        push('coinrule', 90, [
          t(lang,
            'Explicitly non-custodial — trade-only API keys, no withdrawal permissions, your Bitcoin never leaves your exchange.',
            'Výslovne nekustodiálne — API kľúče len na obchodovanie, bez oprávnenia na výber, váš Bitcoin nikdy neopustí burzu.',
            'Výslovně nekustodiální — API klíče jen pro obchodování, bez oprávnění k výběru, váš Bitcoin nikdy neopustí burzu.'),
          t(lang, '150+ strategy templates with a backtesting engine.', '150+ šablón stratégií s backtestovacím nástrojom.', '150+ šablon strategií s backtestovacím nástrojem.'),
        ]);
        push('revenuebot', 78, [
          t(lang,
            'A simpler, Bitcoin-focused cloud DCA/grid setup — referral commissions even pay out in BTC.',
            'Jednoduchšie cloudové DCA/grid riešenie zamerané na Bitcoin — referral provízie sa vyplácajú aj v BTC.',
            'Jednodušší cloudové DCA/grid řešení zaměřené na Bitcoin — referral provize se vyplácejí i v BTC.'),
        ]);
      }
      break;
    }
    case 'treasury': {
      push('bitgo', 94, [
        tv(lang, `MiCA CASP-licensed institutional custodian for {0} — $250M insurance coverage.`, `Inštitucionálny kustodián s licenciou MiCA CASP pre {0} — poistné krytie 250 mil. USD.`, `Institucionální kustodián s licencí MiCA CASP pro {0} — pojistné krytí 250 mil. USD.`, [countryName(lang, a.country)]),
        t(lang, 'Already serves 21bitcoin; proven European infrastructure.', 'Už slúži 21bitcoin; overená európska infraštruktúra.', 'Už slouží 21bitcoin; ověřená evropská infrastruktura.'),
      ]);
      push('sygnum', 82, [
        t(lang,
          "World's first regulated digital asset bank — discretionary treasury mandates, including rebalancing and hedging.",
          'Prvá regulovaná banka pre digitálne aktíva na svete — diskrečné treasury mandáty vrátane rebalancovania a hedgingu.',
          'První regulovaná banka pro digitální aktiva na světě — diskreční treasury mandáty včetně rebalancování a hedgingu.'),
      ]);
      if (a.amount === 'xl') {
        push('coinbase-institutional', 74, [
          t(lang,
            'For the largest allocations: the largest regulated crypto custodian globally, MiCA CASP via CSSF Luxembourg.',
            'Pre najväčšie alokácie: najväčší regulovaný kryptokustodián na svete, MiCA CASP cez luxemburský CSSF.',
            'Pro největší alokace: největší regulovaný kryptokustodián na světě, MiCA CASP přes lucemburský CSSF.'),
        ]);
      }
      break;
    }
    case 'mining': {
      if (a.experience === 'new') {
        push('oneminers', 92, [
          t(lang,
            'Top 5 EU ASIC reseller with hosting in Norway, Finland, and Ethiopia — an easy first hosted contract.',
            'Top 5 predajca ASIC v EÚ s hostingom v Nórsku, Fínsku a Etiópii — jednoduchá prvá hostovaná zmluva.',
            'Top 5 prodejce ASIC v EU s hostingem v Norsku, Finsku a Etiopii — jednoduchá první hostovaná smlouva.'),
        ]);
      } else {
        push('abundant-mines', 90, [
          t(lang,
            'Professionally managed, renewable-energy mining infrastructure — built for mid-to-large scale miners.',
            'Profesionálne spravovaná ťažobná infraštruktúra na obnoviteľnú energiu — pre stredných a veľkých ťažiarov.',
            'Profesionálně spravovaná těžební infrastruktura na obnovitelnou energii — pro střední a velké těžaře.'),
        ]);
      }
      push('power-mining', 72, [
        t(lang,
          'For Bitcoin purists: open-source mining hardware (Bitaxe), EU warehouse for fast shipping.',
          'Pre bitcoinových purstov: open-source ťažobný hardvér (Bitaxe), sklad v EÚ pre rýchle doručenie.',
          'Pro bitcoinové puristy: open-source těžební hardware (Bitaxe), sklad v EU pro rychlé doručení.'),
      ]);
      break;
    }
    case 'custody': {
      if (a.experience === 'new') {
        push('trezor', 97, [
          t(lang,
            'The original Bitcoin hardware wallet, since 2013 — fully open-source hardware and firmware, easiest to start with.',
            'Pôvodná hardvérová peňaženka pre Bitcoin, od roku 2013 — plne open-source hardvér aj firmvér, najjednoduchší začiatok.',
            'Původní hardwarová peněženka pro Bitcoin, od roku 2013 — plně open-source hardware i firmware, nejjednodušší začátek.'),
        ]);
      } else {
        push('blockstream', 95, [
          t(lang,
            'Native support for multisig and collaborative custody vaults — the setup that answers "what happens to my bitcoin".',
            'Natívna podpora multisigu a kolaboratívnych custody trezorov — riešenie na otázku „čo sa stane s mojím bitcoinom".',
            'Nativní podpora multisigu a kolaborativních custody trezorů — řešení na otázku „co se stane s mým bitcoinem".'),
        ]);
      }
      push('ledger', 76, [
        t(lang,
          "World's most popular hardware wallet — 7M+ devices sold, certified Secure Element chip.",
          'Najpopulárnejšia hardvérová peňaženka na svete — predaných 7M+ kusov, certifikovaný čip Secure Element.',
          'Nejpopulárnější hardwarová peněženka na světě — prodáno 7M+ kusů, certifikovaný čip Secure Element.'),
      ]);
      break;
    }
    case 'tax': {
      if (['de', 'at', 'nl', 'es'].includes(a.country ?? '')) {
        push('blockpit', 95, [
          tv(lang, `Country-specific reports built for {0} — Austrian-built, 700+ integrations.`, `Výkazy šité na mieru pre {0} — rakúsky nástroj, 700+ integrácií.`, `Výkazy šité na míru pro {0} — rakouský nástroj, 700+ integrací.`, [countryName(lang, a.country)]),
          t(lang, 'Free portfolio tracking tier.', 'Bezplatná úroveň sledovania portfólia.', 'Bezplatná úroveň sledování portfolia.'),
        ]);
      } else {
        push('koinly', 92, [
          tv(lang, `Covers 100+ countries including {0}, across 400+ exchanges and wallets.`, `Pokrýva 100+ krajín vrátane {0}, naprieč 400+ burzami a peňaženkami.`, `Pokrývá 100+ zemí včetně {0}, napříč 400+ burzami a peněženkami.`, [countryName(lang, a.country)]),
          t(lang, 'Free to track — you only pay when you download the report.', 'Sledovanie zdarma — platíte len pri stiahnutí výkazu.', 'Sledování zdarma — platíte jen při stažení výkazu.'),
        ]);
      }
      push('cointracking', 74, [
        t(lang,
          'The veteran option — tracking crypto tax since 2013, 300+ exchange integrations.',
          'Skúsená voľba — sleduje kryptodane od roku 2013, 300+ integrácií búrz.',
          'Zkušená volba — sleduje kryptoDaně od roku 2013, 300+ integrací burz.'),
      ]);
      push('divly', 66, [
        t(lang,
          'Privacy-first and no KYC required, if that matters more to you than breadth of integrations.',
          'Dôraz na súkromie a bez potreby KYC, ak je to pre vás dôležitejšie než šírka integrácií.',
          'Důraz na soukromí a bez nutnosti KYC, pokud je to pro vás důležitější než šířka integrací.'),
      ]);
      break;
    }
  }

  return recs
    .sort((x, y) => y.match - x.match)
    .slice(0, 3);
}

export function summaryLine(a: Answers, lang: Lang = 'en'): string {
  const goal = L(GOALS.find((g) => g.id === a.goal)?.label, lang) ?? t(lang, 'your goal', 'váš cieľ', 'váš cíl');
  const parts = [
    `${t(lang, 'Goal', 'Cieľ', 'Cíl')}: ${goal}`,
    `${t(lang, 'Country', 'Krajina', 'Země')}: ${countryName(lang, a.country)}`,
  ];
  if (a.experience) parts.push(a.experience === 'new' ? t(lang, 'New to Bitcoin', 'Nový v Bitcoine', 'Nový v Bitcoinu') : t(lang, 'Already holding BTC', 'Už vlastní BTC', 'Už vlastní BTC'));
  if (a.custody && needsCustodyStep(a.goal)) {
    parts.push(`${t(lang, 'Custody', 'Úschova', 'Úschova')}: ${L(CUSTODY.find((c) => c.id === a.custody)?.label, lang)}`);
  }
  parts.push(`${t(lang, 'Amount', 'Suma', 'Částka')}: ${amountLabel(lang, a.amount)}`);
  return parts.join('  ·  ');
}
