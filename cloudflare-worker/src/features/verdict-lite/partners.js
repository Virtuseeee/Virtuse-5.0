// Partner Finder's "buy" rule and the published facts of the partners it can
// list, for the paid report. Pure. test/verdict-lite.test.mjs compares the rule
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
};

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
