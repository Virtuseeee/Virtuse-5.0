/* partner-click.js: push every click to a partner's site into the dataLayer as
   event "partner_click" (partner, partner_category, link_type, link_host, page_lang).
   Sends nothing itself: GTM forwards it to GA4 under the Consent Mode set in each page's head.
   The host map below is generated from data/partners.json by i18n-tools/build_partner_click.py;
   don't edit it by hand. The script never blocks or delays the link. */
(function () {
  // BEGIN PARTNER HOSTS (generated)
  var HOSTS = {
    "21bitcoin.app.link": ["21bitcoin", "buy"],
    "abundantmines.com": ["Abundant Mines", "mining"],
    "affil.trezor.io": ["Trezor", "custody"],
    "app.blockpit.io": ["Blockpit", "tax"],
    "app.firefish.io": ["Firefish", "loans"],
    "app.revenuebot.io": ["RevenueBot", "bots"],
    "bitgo.com": ["BitGo", "treasury"],
    "coinbase.com": ["Coinbase", "treasury"],
    "coinrule.com": ["Coinrule", "bots"],
    "cointracking.info": ["CoinTracking", "tax"],
    "cryptocom.sjv.io": ["Crypto.com", "buy"],
    "cryptohopper.com": ["Cryptohopper", "bots"],
    "divly.com": ["Divly", "tax"],
    "invity.onelink.me": ["Invity", "buy"],
    "koinly.io": ["Koinly", "tax"],
    "kraken.com": ["Kraken", "buy"],
    "oneminers.com": ["OneMiners", "mining"],
    "partner.bybit.eu": ["ByBit EU", "buy"],
    "proinvite.kraken.com": ["Kraken", "buy"],
    "rewards.blockstream.com": ["Blockstream", "custody"],
    "shop.ledger.com": ["Ledger", "custody"],
    "shop.powermining.io": ["PowerMining", "mining"],
    "sygnum.com": ["Sygnum", "treasury"]
  };
  // END PARTNER HOSTS

  function lookup(host) {
    host = host.toLowerCase().replace(/^www\./, '');
    while (host.indexOf('.') > 0) {
      if (HOSTS[host]) return HOSTS[host];
      host = host.slice(host.indexOf('.') + 1);
    }
    return null;
  }

  function track(e) {
    if (e.type === 'auxclick' && e.button !== 1) return;  // middle click only
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !/^https?:$/.test(a.protocol)) return;
    var p = lookup(a.hostname);
    if (!p) return;
    try {
      (window.dataLayer = window.dataLayer || []).push({
        event: 'partner_click',
        partner: p[0],
        partner_category: p[1],
        link_type: /\bbtn-primary\b/.test(a.className) ? 'cta' : 'other',
        link_host: a.hostname.replace(/^www\./, ''),
        page_lang: (document.documentElement.lang || 'en').slice(0, 2)
      });
    } catch (err) {}
  }

  document.addEventListener('click', track, true);
  document.addEventListener('auxclick', track, true);
})();
