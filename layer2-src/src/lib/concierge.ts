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
  // MiCA licence: shown as "MiCA licensed (<regulator>)" + source link.
  licence?: { regulator: LocalizedText; source: string };
  // partner's own page for the feeNote fact; shown as "Source, checked …" (LICENCE_CHECKED date)
  feeSource?: string;
}

export interface Recommendation {
  partner: Partner;
  match: number;
  reasons: string[];
  actionLabel: string;
}

export const GOALS: GoalOption[] = [
  { id: 'buy', label: { en: 'Buy Bitcoin', sk: 'Kúpiť Bitcoin', cs: 'Koupit Bitcoin' }, hint: { en: 'First purchase or regular stacking', sk: 'Prvý nákup alebo pravidelné dokupovanie', cs: 'První nákup nebo pravidelné dokupování' } },
  { id: 'loan', label: { en: 'Bitcoin-backed loan', sk: 'Pôžička krytá Bitcoinom', cs: 'Půjčka krytá Bitcoinem' }, hint: { en: 'Liquidity without selling', sk: 'Likvidita bez predaja', cs: 'Likvidita bez prodeje' } },
  { id: 'earn', label: { en: 'Automate & compound', sk: 'Automatizovať a zhodnocovať', cs: 'Automatizovat a zhodnocovat' }, hint: { en: 'Non-custodial trading & DCA bots', sk: 'Nekustodiálne obchodné a DCA boty', cs: 'Nekustodiální obchodní a DCA boti' } },
  { id: 'treasury', label: { en: 'Corporate treasury', sk: 'Firemné treasury', cs: 'Firemní treasury' }, hint: { en: 'BTC on the balance sheet', sk: 'BTC v súvahe firmy', cs: 'BTC v rozvaze firmy' } },
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
  { id: 'any', label: { en: 'No preference yet', sk: 'Zatiaľ bez preferencie', cs: 'Zatím bez preference' }, hint: { en: 'Show all options', sk: 'Ukážte všetky možnosti', cs: 'Zobrazit všechny možnosti' } },
];

export const AMOUNTS: ChipOption[] = [
  { id: 's', label: { en: '< €1,000', sk: '< 1 000 €', cs: '< 1 000 €' } },
  { id: 'm', label: { en: '€1,000 – 10,000', sk: '1 000 – 10 000 €', cs: '1 000 – 10 000 €' } },
  { id: 'l', label: { en: '€10,000 – 100,000', sk: '10 000 – 100 000 €', cs: '10 000 – 100 000 €' } },
  { id: 'xl', label: { en: '> €100,000', sk: '> 100 000 €', cs: '> 100 000 €' } },
];

// ESMA's MiCA page (interim register of authorised CASPs), the source for
// every licence line below. Checked on the date in LICENCE_CHECKED.
export const ESMA_MICA_URL =
  'https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica';
export const LICENCE_CHECKED: LocalizedText = { en: 'checked 12 Oct 2026', sk: 'overené 12. 10. 2026', cs: 'ověřeno 12. 10. 2026' };

const lic = (regulator: LocalizedText) => ({ regulator, source: ESMA_MICA_URL });

// Every entry below is a real partner with a real, currently-live
// affiliate/referral link taken directly from the matching page on
// virtuse.com (buy-bitcoin.html, mining.html, secure.html, tax.html,
// treasury.html, lending.html, bots.html). The concierge must never
// recommend a partner the site doesn't actually feature, and every
// "Continue to partner" click must land on that partner's own site via
// our tracked link, not a virtuse.com page. If a category ever has no
// affiliate/referral link for a given partner, link to that partner's
// plain site instead of inventing a tracked URL.
// Claims: licences only via `licence` (regulator + ESMA source); no
// superlatives or figures we can't source.
export const PARTNERS: Partner[] = [
  // ── Buy Bitcoin (buy-bitcoin.html) ──
  {
    id: '21bitcoin',
    name: '21bitcoin',
    tagline: { en: 'Bitcoin-only app for buying and saving', sk: 'Aplikácia len pre Bitcoin na nákup a sporenie', cs: 'Aplikace jen pro Bitcoin na nákup a spoření' },
    goals: ['buy'],
    custody: ['any', 'assisted'],
    url: 'https://21bitcoin.app.link/invite/?code=VIRTUSE',
    feeNote: { en: 'Auto-Invest savings plan: 0% fees from day 8 (0.99%, or 0.79% with a referral code, for the first 7 days)', sk: 'Sporiaci plán Auto-Invest: 0 % poplatky od 8. dňa (prvých 7 dní 0,99 % alebo 0,79 % s odporúčacím kódom)', cs: 'Spořicí plán Auto-Invest: 0 % poplatky od 8. dne (prvních 7 dní 0,99 % nebo 0,79 % s doporučujícím kódem)' },
    feeSource: 'https://21bitcoin.app/en/fees',
    countries: ['ALL'],
    licence: lic({ en: 'FMA Austria', sk: 'FMA Rakúsko', cs: 'FMA Rakousko' }),
  },
  {
    id: 'kraken',
    name: 'Kraken',
    tagline: { en: 'Exchange with EUR trading, founded in 2011', sk: 'Burza s obchodovaním v EUR, založená v roku 2011', cs: 'Burza s obchodováním v EUR, založená v roce 2011' },
    goals: ['buy'],
    custody: ['any', 'self'],
    url: 'https://proinvite.kraken.com/9f1e/lj72d37e',
    feeNote: { en: 'Pro trading fees from 0.8%', sk: 'Poplatky Pro trading od 0,8 %', cs: 'Poplatky Pro trading od 0,8 %' },
    countries: ['ALL'],
    licence: lic({ en: 'Central Bank of Ireland', sk: 'Centrálna banka Írska', cs: 'Centrální banka Irska' }),
  },
  {
    id: 'bybit-eu',
    name: 'Bybit EU',
    tagline: { en: "Bybit's EU exchange, based in Vienna", sk: 'EÚ burza Bybit so sídlom vo Viedni', cs: 'EU burza Bybit se sídlem ve Vídni' },
    goals: ['buy'],
    custody: ['any'],
    url: 'https://partner.bybit.eu/b/VIRTUSE',
    feeNote: { en: 'Spot trading fees from 0.25%', sk: 'Poplatky za spot obchodovanie od 0,25 %', cs: 'Poplatky za spotové obchodování od 0,25 %' },
    countries: ['ALL'],
    licence: lic({ en: 'FMA Austria', sk: 'FMA Rakúsko', cs: 'FMA Rakousko' }),
  },
  {
    id: 'invity',
    name: 'Invity',
    tagline: { en: 'Bitcoin-only app with Auto Buy and Auto Send to your own wallet', sk: 'Aplikácia len pre Bitcoin s Auto Buy a Auto Send do vlastnej peňaženky', cs: 'Aplikace jen pro Bitcoin s Auto Buy a Auto Send do vlastní peněženky' },
    goals: ['buy'],
    custody: ['any'],
    url: 'https://invity.onelink.me/yIY4/j44d7awx',
    feeNote: { en: 'Customer Bitcoin held in BitGo institutional custody', sk: 'Bitcoin klientov v inštitucionálnej úschove BitGo', cs: 'Bitcoin klientů v institucionální úschově BitGo' },
    feeSource: 'https://www.invity.io/',
    countries: ['ALL'],
    badge: { en: 'Bitcoin only', sk: 'Iba Bitcoin', cs: 'Jen Bitcoin' },
    licence: lic({ en: 'Czech National Bank', sk: 'Česká národná banka', cs: 'Česká národní banka' }),
  },
  {
    id: 'crypto-com',
    name: 'Crypto.com',
    tagline: { en: 'Platform with spot buying and the Crypto.com Visa Card', sk: 'Platforma so spotovým nákupom a kartou Crypto.com Visa', cs: 'Platforma se spotovým nákupem a kartou Crypto.com Visa' },
    goals: ['buy'],
    custody: ['any'],
    url: 'https://cryptocom.sjv.io/c/7490229/2051372/25666',
    feeNote: { en: 'Card and wider asset coverage', sk: 'Karta a širšia ponuka aktív', cs: 'Karta a širší nabídka aktiv' },
    countries: ['ALL'],
    licence: lic({ en: 'MFSA Malta', sk: 'MFSA Malta', cs: 'MFSA Malta' }),
  },

  // ── Custody (secure.html) ──
  {
    id: 'trezor',
    name: 'Trezor',
    tagline: { en: 'Bitcoin hardware wallet, since 2013', sk: 'Hardvérová peňaženka pre Bitcoin, od roku 2013', cs: 'Hardwarová peněženka pro Bitcoin, od roku 2013' },
    goals: ['custody', 'buy'],
    custody: ['self'],
    url: 'https://affil.trezor.io/aff_c?offer_id=133&aff_id=846427',
    feeNote: { en: 'Open-source hardware and firmware', sk: 'Open-source hardvér aj firmvér', cs: 'Open-source hardware i firmware' },
    countries: ['ALL'],
    badge: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' },
  },
  {
    id: 'ledger',
    name: 'Ledger',
    tagline: { en: 'Hardware wallet with the Ledger Live app', sk: 'Hardvérová peňaženka s aplikáciou Ledger Live', cs: 'Hardwarová peněženka s aplikací Ledger Live' },
    goals: ['custody'],
    custody: ['self'],
    url: 'https://shop.ledger.com/?r=3256467ea813',
    feeNote: { en: 'Certified Secure Element chip', sk: 'Certifikovaný čip Secure Element', cs: 'Certifikovaný čip Secure Element' },
    countries: ['ALL'],
    badge: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' },
  },
  {
    id: 'blockstream',
    name: 'Blockstream',
    tagline: { en: 'Multisig and collaborative custody tools', sk: 'Nástroje pre multisig a kolaboratívnu úschovu', cs: 'Nástroje pro multisig a kolaborativní úschovu' },
    goals: ['custody'],
    custody: ['self'],
    url: 'https://rewards.blockstream.com/qo0khs',
    feeNote: { en: 'Blockstream Jade: open-source, no secure element', sk: 'Blockstream Jade: open-source, bez secure elementu', cs: 'Blockstream Jade: open-source, bez secure elementu' },
    countries: ['ALL'],
    badge: { en: 'Self-custody', sk: 'Vlastná úschova', cs: 'Vlastní úschova' },
  },

  {
    id: 'umbrel',
    name: 'Umbrel',
    tagline: { en: 'Home server for running your own Bitcoin node', sk: 'Domáci server na prevádzku vlastného Bitcoin uzla', cs: 'Domácí server pro provoz vlastního Bitcoin uzlu' },
    goals: ['custody'],
    custody: ['self'],
    url: 'https://a.umbrel.com/virtuse',
    feeNote: { en: 'Umbrel Home: your own Bitcoin node, not a wallet', sk: 'Umbrel Home: váš vlastný Bitcoin uzol, nie peňaženka', cs: 'Umbrel Home: váš vlastní Bitcoin uzel, ne peněženka' },
    countries: ['ALL'],
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
    licence: lic({ en: 'NBS Slovakia', sk: 'NBS Slovensko', cs: 'NBS Slovensko' }),
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
    tagline: { en: 'Crypto tax tracker, since 2013', sk: 'Nástroj na sledovanie kryptodaní, od roku 2013', cs: 'Nástroj pro sledování kryptodaní, od roku 2013' },
    goals: ['tax'],
    url: 'https://cointracking.info/?ref=V328565',
    feeNote: { en: '300+ exchange integrations; free up to 200 transactions', sk: '300+ integrácií búrz; zdarma do 200 transakcií', cs: '300+ integrací burz; zdarma do 200 transakcí' },
    countries: ['ALL'],
  },
  {
    id: 'divly',
    name: 'Divly',
    tagline: { en: 'Crypto tax report tool', sk: 'Nástroj na daňové výkazy z kryptomien', cs: 'Nástroj pro daňové výkazy z kryptoměn' },
    goals: ['tax'],
    url: 'https://divly.com/?ref=otfkzmf',
    feeNote: { en: '14-minute import-to-report', sk: 'Od importu k výkazu za 14 minút', cs: 'Od importu k výkazu za 14 minut' },
    countries: ['ALL'],
  },

  // ── Treasury (treasury.html) ──
  {
    id: 'bitgo',
    name: 'BitGo',
    tagline: { en: 'Institutional custodian', sk: 'Inštitucionálny kustodián', cs: 'Institucionální kustodián' },
    goals: ['treasury'],
    url: 'https://bitgo.com',
    feeNote: { en: 'Custody for companies and funds', sk: 'Úschova pre firmy a fondy', cs: 'Úschova pro firmy a fondy' },
    countries: ['ALL'],
    licence: lic({ en: 'BaFin Germany', sk: 'BaFin Nemecko', cs: 'BaFin Německo' }),
  },
  {
    id: 'sygnum',
    name: 'Sygnum',
    tagline: { en: 'Digital asset bank', sk: 'Banka pre digitálne aktíva', cs: 'Banka pro digitální aktiva' },
    goals: ['treasury'],
    url: 'https://sygnum.com',
    feeNote: { en: 'Discretionary treasury mandates', sk: 'Diskrečné treasury mandáty', cs: 'Diskreční treasury mandáty' },
    countries: ['ALL'],
    licence: lic({ en: 'FMA Liechtenstein', sk: 'FMA Lichtenštajnsko', cs: 'FMA Lichtenštejnsko' }),
  },
  {
    id: 'coinbase-institutional',
    name: 'Coinbase Institutional',
    tagline: { en: 'Institutional custody and trading', sk: 'Inštitucionálna úschova a obchodovanie', cs: 'Institucionální úschova a obchodování' },
    goals: ['treasury'],
    url: 'https://coinbase.com/institutional',
    feeNote: { en: 'For larger company allocations', sk: 'Pre väčšie firemné alokácie', cs: 'Pro větší firemní alokace' },
    countries: ['ALL'],
    licence: lic({ en: 'CSSF Luxembourg', sk: 'CSSF Luxembursko', cs: 'CSSF Lucembursko' }),
  },

  // ── Bots (bots.html) ──
  {
    id: 'coinrule',
    name: 'Coinrule',
    tagline: { en: 'Explicitly non-custodial, trade-only API bots', sk: 'Výslovne nekustodiálne, API boty len na obchodovanie', cs: 'Výslovně nekustodiální, API boti jen pro obchodování' },
    goals: ['earn'],
    custody: ['self', 'any'],
    url: 'https://coinrule.com/?fp_ref=virtuse',
    feeNote: { en: '150+ strategy templates', sk: '150+ šablón stratégií', cs: '150+ šablon strategií' },
    countries: ['ALL'],
    badge: { en: 'Non-custodial', sk: 'Nekustodiálne', cs: 'Nekustodiální' },
  },
  {
    id: 'cryptohopper',
    name: 'Cryptohopper',
    tagline: { en: 'Bot platform with copy trading and paper trading', sk: 'Platforma botov s copy tradingom a papierovým obchodovaním', cs: 'Platforma botů s copy tradingem a papírovým obchodováním' },
    goals: ['earn'],
    custody: ['self', 'any'],
    url: 'https://www.cryptohopper.com/?atid=40864',
    feeNote: { en: '3-day free trial', sk: '3-dňová skúšobná verzia zdarma', cs: '3denní zkušební verze zdarma' },
    countries: ['ALL'],
  },
  {
    id: 'revenuebot',
    name: 'RevenueBot',
    tagline: { en: 'Cloud DCA and grid bots, Bitcoin-focused', sk: 'Cloudové DCA a grid boty zamerané na Bitcoin', cs: 'Cloudoví DCA a grid boti zaměření na Bitcoin' },
    goals: ['earn'],
    custody: ['self', 'any'],
    url: 'https://app.revenuebot.io/external/r/90928',
    feeNote: { en: 'Referral commissions paid in BTC', sk: 'Provízie za odporúčanie vyplácané v BTC', cs: 'Provize za doporučení vyplácené v BTC' },
    countries: ['ALL'],
  },

  // ── Mining (mining.html) ──
  {
    id: 'oneminers',
    name: 'OneMiners',
    tagline: { en: 'ASIC reseller with EU/Nordic hosting', sk: 'Predajca ASIC s hostingom v EÚ/Škandinávii', cs: 'Prodejce ASIC s hostingem v EU/Skandinávii' },
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
    feeNote: { en: 'Hosting for mid-to-large miners', sk: 'Hosting pre stredných a veľkých ťažiarov', cs: 'Hosting pro střední a velké těžaře' },
    countries: ['ALL'],
  },
  {
    id: 'power-mining',
    name: 'Power Mining',
    tagline: { en: 'Open-source mining hardware specialist (Bitaxe)', sk: 'Špecialista na open-source ťažobný hardvér (Bitaxe)', cs: 'Specialista na open-source těžební hardware (Bitaxe)' },
    goals: ['mining'],
    url: 'https://shop.powermining.io/?ref=Virtuse',
    feeNote: { en: 'EU warehouse, fast shipping', sk: 'Sklad v EÚ, rýchle doručenie', cs: 'Sklad v EU, rychlé doručení' },
    countries: ['ALL'],
  },
  {
    id: 'solo-satoshi',
    name: 'Solo Satoshi',
    tagline: { en: 'Open-source home miners (Bitaxe, NerdQaxe)', sk: 'Open-source domáce ťažobné zariadenia (Bitaxe, NerdQaxe)', cs: 'Open-source domácí těžební zařízení (Bitaxe, NerdQaxe)' },
    goals: ['mining'],
    url: 'https://www.solosatoshi.com/aff/8822/',
    feeNote: { en: 'Based in Texas, USA; ships worldwide', sk: 'Sídlo v Texase (USA), doručenie do celého sveta', cs: 'Sídlo v Texasu (USA), doručení do celého světa' },
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
          tv(lang, `Simple start for newcomers in {0}: a Bitcoin-only app.`, `Jednoduchý štart pre začiatočníkov ({0}): aplikácia len pre Bitcoin.`, `Jednoduchý start pro začátečníky ({0}): aplikace jen pro Bitcoin.`, [countryName(lang, a.country)]),
        ]);
      } else {
        push('kraken', 93, [
          tv(lang, `Exchange with EUR trading pairs for {0}.`, `Burza s obchodnými pármi v EUR pre sumu {0}.`, `Burza s obchodními páry v EUR pro částku {0}.`, [amountLabel(lang, a.amount)]),
          t(lang,
            'Founded in 2011.',
            'Založená v roku 2011.',
            'Založená v roce 2011.'),
        ]);
      }
      if (a.custody !== 'self') {
        // Not for self-custody: Invity keeps customer Bitcoin in BitGo custody.
        push('invity', 80, [
          t(lang,
            'Bitcoin-only app: buy once or with Auto Buy, then withdraw to your own wallet at any time or let Auto Send move it automatically.',
            'Aplikácia len pre Bitcoin: nakúpte jednorazovo alebo cez Auto Buy a kedykoľvek si ho vyberte do vlastnej peňaženky, alebo ho tam automaticky presunie Auto Send.',
            'Aplikace jen pro Bitcoin: nakupte jednorázově nebo přes Auto Buy a kdykoli si ho vyberte do vlastní peněženky, nebo ho tam automaticky přesune Auto Send.'),
        ]);
      }
      if (a.amount === 'l' || a.amount === 'xl') {
        push('bybit-eu', 84, [
          t(lang,
            'For larger amounts, a spot order book exchange with EUR pairs.',
            'Pri väčších sumách burza so spotovým orderbookom a pármi v EUR.',
            'U větších částek burza se spotovou knihou objednávek a páry v EUR.'),
        ]);
      } else if (a.custody !== 'self') {
        push('crypto-com', 78, [
          t(lang,
            'If you want more than spot buying: card and wider asset coverage.',
            'Ak chcete viac než len spotový nákup: karta a širšia ponuka aktív.',
            'Pokud chcete víc než jen spotový nákup: karta a širší nabídka aktiv.'),
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
            'Bitcoin-backed P2P loans, market-driven rates. Note: Firefish assumes self-custody via multisig escrow.',
            'P2P pôžičky kryté Bitcoinom, trhové úrokové sadzby. Pozor: Firefish predpokladá vlastnú úschovu cez multisig escrow.',
            'P2P půjčky kryté Bitcoinem, tržní úrokové sazby. Pozor: Firefish předpokládá vlastní úschovu přes multisig escrow.'),
          t(lang,
            'If you prefer assisted custody, set that up first, then come back for the loan.',
            'Ak preferujete asistovanú úschovu, najprv si ju zariaďte a potom sa vráťte k pôžičke.',
            'Pokud preferujete asistovanou úschovu, nejprve si ji zařiďte a pak se vraťte k půjčce.'),
        ]);
      } else {
        push('firefish', 97, [
          t(lang, 'Borrow EUR against your bitcoin and keep 100% of the upside.', 'Požičajte si EUR oproti svojmu bitcoinu a ponechajte si 100 % potenciálneho zisku.', 'Půjčte si EUR se zajištěním svým Bitcoinem a ponechte si 100 % potenciálního zisku.'),
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
            'Copy trading, paper trading and a 3-day free trial before you commit.',
            'Copy trading, papierové obchodovanie a 3-dňová skúšobná verzia zdarma, kým sa rozhodnete.',
            'Copy trading, papírové obchodování a 3denní zkušební verze zdarma, než se rozhodnete.'),
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
            'Explicitly non-custodial: trade-only API keys, no withdrawal permissions, your Bitcoin never leaves your exchange.',
            'Výslovne nekustodiálne: API kľúče len na obchodovanie, bez oprávnenia na výber, váš Bitcoin nikdy neopustí burzu.',
            'Výslovně nekustodiální: API klíče jen pro obchodování, bez oprávnění k výběru, váš Bitcoin nikdy neopustí burzu.'),
          t(lang, '150+ strategy templates with a backtesting engine.', '150+ šablón stratégií s backtestovacím nástrojom.', '150+ šablon strategií s backtestovacím nástrojem.'),
        ]);
        push('revenuebot', 78, [
          t(lang,
            'A simpler, Bitcoin-focused cloud DCA/grid setup.',
            'Jednoduchšie cloudové DCA/grid riešenie zamerané na Bitcoin.',
            'Jednodušší cloudové DCA/grid řešení zaměřené na Bitcoin.'),
        ]);
      }
      break;
    }
    case 'treasury': {
      push('bitgo', 94, [
        tv(lang, `Institutional custodian for companies in {0}.`, `Inštitucionálny kustodián pre firmy ({0}).`, `Institucionální kustodián pro firmy ({0}).`, [countryName(lang, a.country)]),
      ]);
      push('sygnum', 82, [
        t(lang,
          'Digital asset bank with discretionary treasury mandates, including rebalancing and hedging.',
          'Banka pre digitálne aktíva s diskrečnými treasury mandátmi vrátane rebalancovania a hedgingu.',
          'Banka pro digitální aktiva s diskrečními treasury mandáty včetně rebalancování a hedgingu.'),
      ]);
      if (a.amount === 'xl') {
        push('coinbase-institutional', 74, [
          t(lang,
            'For larger allocations: institutional custody and trading.',
            'Pre väčšie alokácie: inštitucionálna úschova a obchodovanie.',
            'Pro větší alokace: institucionální úschova a obchodování.'),
        ]);
      }
      break;
    }
    case 'mining': {
      if (a.experience === 'new') {
        push('oneminers', 92, [
          t(lang,
            'ASIC reseller with hosting in Norway, Finland and Ethiopia: a simple first hosted contract.',
            'Predajca ASIC s hostingom v Nórsku, Fínsku a Etiópii: jednoduchá prvá hostovaná zmluva.',
            'Prodejce ASIC s hostingem v Norsku, Finsku a Etiopii: jednoduchá první hostovaná smlouva.'),
        ]);
      } else {
        push('abundant-mines', 90, [
          t(lang,
            'Professionally managed, renewable-energy mining infrastructure for mid-to-large scale miners.',
            'Profesionálne spravovaná ťažobná infraštruktúra na obnoviteľnú energiu pre stredných a veľkých ťažiarov.',
            'Profesionálně spravovaná těžební infrastruktura na obnovitelnou energii pro střední a velké těžaře.'),
        ]);
      }
      push('power-mining', 72, [
        t(lang,
          'For Bitcoin purists: open-source mining hardware (Bitaxe), EU warehouse for fast shipping.',
          'Pre bitcoinových puristov: open-source ťažobný hardvér (Bitaxe), sklad v EÚ pre rýchle doručenie.',
          'Pro bitcoinové puristy: open-source těžební hardware (Bitaxe), sklad v EU pro rychlé doručení.'),
      ]);
      push('solo-satoshi', 70, [
        t(lang,
          'Open-source home miners (Bitaxe and NerdQaxe) from Texas, shipped worldwide.',
          'Open-source domáce ťažobné zariadenia (Bitaxe a NerdQaxe) z Texasu, s doručením do celého sveta.',
          'Open-source domácí těžební zařízení (Bitaxe a NerdQaxe) z Texasu, s doručením do celého světa.'),
      ]);
      break;
    }
    case 'custody': {
      if (a.experience === 'new') {
        push('trezor', 97, [
          t(lang,
            'Bitcoin hardware wallet since 2013, with open-source hardware and firmware: a simple place to start.',
            'Hardvérová peňaženka pre Bitcoin od roku 2013, s open-source hardvérom aj firmvérom: jednoduchý začiatok.',
            'Hardwarová peněženka pro Bitcoin od roku 2013, s open-source hardwarem i firmwarem: jednoduchý začátek.'),
        ]);
      } else {
        push('blockstream', 95, [
          t(lang,
            'Native support for multisig and collaborative custody vaults: the setup that answers "what happens to my bitcoin".',
            'Natívna podpora multisigu a trezorov s kolaboratívnou úschovou: riešenie na otázku „čo sa stane s mojím bitcoinom“.',
            'Nativní podpora multisigu a trezorů s kolaborativní úschovou: odpověď na otázku „co se stane s mým Bitcoinem“.'),
        ]);
      }
      push('ledger', 76, [
        t(lang,
          'Hardware wallet with a certified Secure Element chip and the Ledger Live app.',
          'Hardvérová peňaženka s certifikovaným čipom Secure Element a aplikáciou Ledger Live.',
          'Hardwarová peněženka s certifikovaným čipem Secure Element a aplikací Ledger Live.'),
      ]);
      push('umbrel', 68, [
        t(lang,
          'Your own Bitcoin node at home: check your own transactions instead of trusting someone else\'s server. Works alongside any hardware wallet.',
          'Vlastný Bitcoin uzol doma: overujte si vlastné transakcie namiesto dôvery v cudzí server. Funguje s akoukoľvek hardvérovou peňaženkou.',
          'Vlastní bitcoinový uzel doma: ověřujte si vlastní transakce místo důvěry v cizí server. Funguje s jakoukoli hardwarovou peněženkou.'),
      ]);
      break;
    }
    case 'tax': {
      if (['de', 'at', 'nl', 'es'].includes(a.country ?? '')) {
        push('blockpit', 95, [
          tv(lang, `Country-specific reports built for {0}: Austrian-built, 700+ integrations.`, `Výkazy šité na mieru pre {0}: rakúsky nástroj, 700+ integrácií.`, `Výkazy šité na míru pro {0}: rakouský nástroj, 700+ integrací.`, [countryName(lang, a.country)]),
          t(lang, 'Free portfolio tracking tier.', 'Bezplatná úroveň sledovania portfólia.', 'Bezplatná úroveň sledování portfolia.'),
        ]);
      } else {
        push('koinly', 92, [
          tv(lang, `Covers 100+ countries including {0}, across 400+ exchanges and wallets.`, `Pokrýva 100+ krajín vrátane {0}, naprieč 400+ burzami a peňaženkami.`, `Pokrývá 100+ zemí včetně {0}, napříč 400+ burzami a peněženkami.`, [countryName(lang, a.country)]),
          t(lang, 'Free to track: you only pay when you download the report.', 'Sledovanie zdarma: platíte len pri stiahnutí výkazu.', 'Sledování zdarma: platíte jen při stažení výkazu.'),
        ]);
      }
      push('cointracking', 74, [
        t(lang,
          'Tracking crypto tax since 2013, 300+ exchange integrations.',
          'Sleduje kryptodane od roku 2013, 300+ integrácií búrz.',
          'Sleduje kryptodaně od roku 2013, 300+ integrací burz.'),
      ]);
      push('divly', 66, [
        t(lang,
          'A short import-to-report flow, if speed matters more to you than breadth of integrations.',
          'Krátky postup od importu k výkazu, ak je pre vás rýchlosť dôležitejšia než šírka integrácií.',
          'Krátký postup od importu k výkazu, pokud je pro vás rychlost důležitější než šířka integrací.'),
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
