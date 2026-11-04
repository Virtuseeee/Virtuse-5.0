// Partner Finder's "buy", "custody" and "tax" rules and the published facts of
// the partners they can list, for the paid report. Pure. test/verdict-lite.test.mjs compares the rule
// with the built Partner Finder (pf-recommend.js) and the facts with its catalog,
// so the report never lists anyone Partner Finder would not. Do not sort by
// commission or add reasons: the report lists partners that meet the criteria
// alphabetically, it does not pick one.

export const PARTNERS = {
  '21bitcoin': { name: '21bitcoin', url: 'https://21bitcoin.app.link/invite/?code=VIRTUSE', en: { tagline: 'Bitcoin-only app for buying and saving', licence: 'FMA Austria', fee: 'Auto-Invest savings plan: 0% fees from day 8 (0.99%, or 0.79% with a referral code, for the first 7 days)' }, sk: { tagline: 'Aplikácia len pre Bitcoin na nákup a sporenie', licence: 'FMA Rakúsko', fee: 'Sporiaci plán Auto-Invest: 0 % poplatky od 8. dňa (prvých 7 dní 0,99 % alebo 0,79 % s odporúčacím kódom)' } },
  'bybit-eu': { name: 'Bybit EU', url: 'https://partner.bybit.eu/b/VIRTUSE', en: { tagline: "Bybit's EU exchange, based in Vienna", licence: 'FMA Austria', fee: 'Spot trading fees from 0.25%' }, sk: { tagline: 'EÚ burza Bybit so sídlom vo Viedni', licence: 'FMA Rakúsko', fee: 'Poplatky za spot obchodovanie od 0,25 %' } },
  'crypto-com': { name: 'Crypto.com', url: 'https://cryptocom.sjv.io/c/7490229/2051372/25666', en: { tagline: 'Platform with spot buying and the Crypto.com Visa Card', licence: 'MFSA Malta', fee: 'Card and an EU-regulated app' }, sk: { tagline: 'Platforma so spotovým nákupom a kartou Crypto.com Visa', licence: 'MFSA Malta', fee: 'Karta a aplikácia regulovaná v EÚ' } },
  invity: { name: 'Invity', url: 'https://invity.onelink.me/yIY4/j44d7awx', en: { tagline: 'Bitcoin-only app with Auto Buy and Auto Send to your own wallet', licence: 'Czech National Bank', fee: 'Customer Bitcoin held in BitGo institutional custody' }, sk: { tagline: 'Aplikácia len pre Bitcoin s Auto Buy a Auto Send do vlastnej peňaženky', licence: 'Česká národná banka', fee: 'Bitcoin klientov v inštitucionálnej úschove BitGo' } },
  kraken: { name: 'Kraken', url: 'https://proinvite.kraken.com/9f1e/lj72d37e', en: { tagline: 'Exchange with EUR trading, founded in 2011', licence: 'Central Bank of Ireland', fee: 'Pro trading fees from 0.8%' }, sk: { tagline: 'Burza s obchodovaním v EUR, založená v roku 2011', licence: 'Centrálna banka Írska', fee: 'Poplatky Pro trading od 0,8 %' } },
  trezor: { name: 'Trezor', url: 'https://affil.trezor.io/aff_c?offer_id=133&aff_id=846427', en: { tagline: 'Bitcoin hardware wallet, since 2013', licence: '', fee: 'Open-source hardware and firmware' }, sk: { tagline: 'Hardvérová peňaženka pre Bitcoin, od roku 2013', licence: '', fee: 'Open-source hardvér aj firmvér' } },
  ledger: { name: 'Ledger', url: 'https://shop.ledger.com/?r=3256467ea813', en: { tagline: 'Hardware wallet with the Ledger Live app', licence: '', fee: 'Certified Secure Element chip' }, sk: { tagline: 'Hardvérová peňaženka s aplikáciou Ledger Live', licence: '', fee: 'Certifikovaný čip Secure Element' } },
  blockstream: { name: 'Blockstream', url: 'https://rewards.blockstream.com/qo0khs', en: { tagline: 'Multisig and collaborative custody tools', licence: '', fee: 'Blockstream Jade: open-source, no secure element' }, sk: { tagline: 'Nástroje pre multisig a kolaboratívnu úschovu', licence: '', fee: 'Blockstream Jade: open-source, bez secure elementu' } },
  umbrel: { name: 'Umbrel', url: 'https://a.umbrel.com/virtuse', en: { tagline: 'Home server for running your own Bitcoin node', licence: '', fee: 'Umbrel Home: your own Bitcoin node, not a wallet' }, sk: { tagline: 'Domáci server na prevádzku vlastného Bitcoin uzla', licence: '', fee: 'Umbrel Home: váš vlastný Bitcoin uzol, nie peňaženka' } },
  blockpit: { name: 'Blockpit', url: 'https://app.blockpit.io/register?fpr=virtuse', en: { tagline: 'Austrian-built tax tool, country-specific EU reports', licence: '', fee: 'Free portfolio tracking tier; 700+ integrations' }, sk: { tagline: 'Rakúsky daňový nástroj, výkazy podľa konkrétnej krajiny EÚ', licence: '', fee: 'Bezplatné sledovanie portfólia; 700+ integrácií' } },
  koinly: { name: 'Koinly', url: 'https://koinly.io/?via=C7DEBFCF&utm_source=affiliate', en: { tagline: 'AI-matched transfers across 400+ exchanges, 100+ countries', licence: '', fee: 'Free to track; pay only when you download the report' }, sk: { tagline: 'AI párovanie prevodov naprieč 400+ burzami, 100+ krajinami', licence: '', fee: 'Sledovanie zdarma; platíte len pri stiahnutí výkazu' } },
  cointracking: { name: 'CoinTracking', url: 'https://cointracking.info/?ref=V328565', en: { tagline: 'Crypto tax tracker, since 2013', licence: '', fee: '300+ exchange integrations; free up to 200 transactions' }, sk: { tagline: 'Nástroj na sledovanie kryptodaní, od roku 2013', licence: '', fee: '300+ integrácií búrz; zdarma do 200 transakcií' } },
  divly: { name: 'Divly', url: 'https://divly.com/?ref=otfkzmf', en: { tagline: 'Crypto tax report tool', licence: '', fee: '14-minute import-to-report' }, sk: { tagline: 'Nástroj na daňové výkazy z kryptomien', licence: '', fee: 'Od importu k výkazu za 14 minút' } },
};

// Partners whose catalog line above is a published fee or price. On every other
// card the report says the price is on the partner's site, so all cards carry
// the same fields.
export const PRICED = ['21bitcoin', 'bybit-eu', 'kraken', 'blockpit', 'koinly', 'cointracking'];

export const amountBucket = (btc) => (!btc ? '' : btc < 1000 ? 's' : btc < 10000 ? 'm' : btc < 100000 ? 'l' : 'xl');

// Same branches as recommend() for goal "buy" in layer2-src/src/lib/concierge.ts,
// with the experience Partner Finder receives (a sceptic counts as new).
export function matchingPartners(A) {
  const experience = A.experience === 'hodler' ? 'hodler' : 'new';
  const amount = amountBucket(A.btc);
  const ids = [experience === 'new' ? '21bitcoin' : 'kraken'];
  if (A.custody !== 'self') ids.push('invity');
  if (amount === 'l' || amount === 'xl') ids.push('bybit-eu');
  else if (A.custody !== 'self') ids.push('crypto-com');
  if (A.custody === 'self' && experience !== 'new') ids.push('trezor');
  return ids;
}

// Same branches as recommend() for goal "custody".
export const custodyPartners = (A) => [A.experience === 'hodler' ? 'blockstream' : 'trezor', 'ledger', 'umbrel'];

// Same branches as recommend() for goal "tax".
export const taxPartners = (A) => [['de', 'at', 'nl', 'es'].includes(A.country) ? 'blockpit' : 'koinly', 'cointracking', 'divly'];
