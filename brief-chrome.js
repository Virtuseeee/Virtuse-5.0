/* Virtuse Brief reader chrome, shared by article.html and blog.html:
   nav toggle, light/dark theme, live ticker,
   subscribe forms, reading progress, plus desk inference for stories.
   Mirrors the chrome parts of news/news.js (desk-owned) without the desk's
   Pulse / issues / archive fetches.
   Pages may set window.VB_UI (localized strings) and window.VB_LANG
   (Worker welcome-email language) before a form is submitted. */
(function () {
  'use strict';
  var MP = 'https://mempool.space/api';
  // All Brief pages (news, blog, stories, article) set data-theme-key="vb-theme-blog"
  // and default to dark, so one choice applies to the whole Brief (checklist 2.3).
  var THEME_KEY = document.documentElement.getAttribute('data-theme-key') || 'vb-theme';
  // Chrome strings per page language: theme toggle, skip link, CFO nav item and card.
  // stories-build/hubs.mjs and i18n-tools/brief_chrome.py parse this block: keep it strict JSON.
  var CHROME_T = /*CHROME-I18N*/{"en":{"skip":"Skip to content","dark":"Dark","light":"Light","toDark":"Switch to dark theme","toLight":"Switch to light theme","navCfo":"Virtuse CFO","cfoKicker":"Virtuse CFO · Free Verdict","cfoTitle":"Your AI CFO for Bitcoin.","cfoText":"Verdict is free; the fee audit comes with Virtuse CFO. Paid plans, once they open: €9/month or €90/year.","cfoCta":"Get a free verdict →"},"sk":{"skip":"Preskočiť na obsah","dark":"Tmavý","light":"Svetlý","toDark":"Prepnúť na tmavý motív","toLight":"Prepnúť na svetlý motív","navCfo":"Virtuse CFO","cfoKicker":"Verdikt zadarmo","cfoTitle":"Váš AI CFO pre Bitcoin.","cfoText":"Verdict je zadarmo, audit poplatkov príde s Virtuse CFO. Platené plány po spustení: 9 €/mesiac alebo 90 €/rok.","cfoCta":"Získať verdikt zadarmo →"},"cs":{"skip":"Přeskočit na obsah","dark":"Tmavý","light":"Světlý","toDark":"Přepnout na tmavý motiv","toLight":"Přepnout na světlý motiv","navCfo":"Virtuse CFO","cfoKicker":"Verdikt zdarma","cfoTitle":"Váš AI CFO pro Bitcoin.","cfoText":"Verdict je zdarma, audit poplatků přijde s Virtuse CFO. Placené plány po spuštění: 9 €/měsíc nebo 90 €/rok.","cfoCta":"Získat verdikt zdarma →"},"de":{"skip":"Zum Inhalt springen","dark":"Dunkel","light":"Hell","toDark":"Zum dunklen Design wechseln","toLight":"Zum hellen Design wechseln","navCfo":"Virtuse CFO","cfoKicker":"Verdict kostenlos","cfoTitle":"Ihr KI-CFO für Bitcoin.","cfoText":"Verdict ist kostenlos; der Gebühren-Audit kommt mit Virtuse CFO. Bezahlte Pläne nach dem Start: 9 €/Monat oder 90 €/Jahr.","cfoCta":"Kostenloses Verdict anfordern →"},"fr":{"skip":"Aller au contenu","dark":"Sombre","light":"Clair","toDark":"Passer au thème sombre","toLight":"Passer au thème clair","navCfo":"Virtuse CFO","cfoKicker":"Verdict gratuit","cfoTitle":"Votre CFO IA pour le Bitcoin.","cfoText":"Verdict est gratuit ; l'audit des frais arrivera avec Virtuse CFO. Offres payantes à leur ouverture : 9 €/mois ou 90 €/an.","cfoCta":"Obtenir un verdict gratuit →"},"es":{"skip":"Ir al contenido","dark":"Oscuro","light":"Claro","toDark":"Cambiar al tema oscuro","toLight":"Cambiar al tema claro","navCfo":"Virtuse CFO","cfoKicker":"Verdict gratis","cfoTitle":"Su CFO con IA para Bitcoin.","cfoText":"Verdict es gratuito; la auditoría de comisiones llegará con Virtuse CFO. Planes de pago, cuando abran: 9 €/mes o 90 €/año.","cfoCta":"Obtener un veredicto gratis →"},"pl":{"skip":"Przejdź do treści","dark":"Ciemny","light":"Jasny","toDark":"Przełącz na ciemny motyw","toLight":"Przełącz na jasny motyw","navCfo":"Virtuse CFO","cfoKicker":"Verdict za darmo","cfoTitle":"Osobisty AI CFO dla Bitcoina.","cfoText":"Verdict jest bezpłatny; audyt opłat pojawi się w Virtuse CFO. Płatne plany po uruchomieniu: 9 €/miesiąc lub 90 €/rok.","cfoCta":"Odbieram bezpłatny werdykt →"},"hu":{"skip":"Ugrás a tartalomra","dark":"Sötét","light":"Világos","toDark":"Váltás sötét témára","toLight":"Váltás világos témára","navCfo":"Virtuse CFO","cfoKicker":"Virtuse CFO · Ingyenes Verdict","cfoTitle":"Az Ön AI CFO-ja Bitcoinhoz.","cfoText":"A Verdict ingyenes; a díjaudit a Virtuse CFO-val érkezik. Fizetős csomagok indulás után: havi 9 € vagy évi 90 €.","cfoCta":"Ingyenes verdikt kérése →"},"uk":{"skip":"Перейти до змісту","dark":"Темна","light":"Світла","toDark":"Увімкнути темну тему","toLight":"Увімкнути світлу тему","navCfo":"Virtuse CFO","cfoKicker":"Verdict безкоштовно","cfoTitle":"Ваш AI CFO для Біткоїна.","cfoText":"Verdict безкоштовний; аудит комісій з’явиться у Virtuse CFO. Платні плани після запуску: 9 €/міс. або 90 €/рік.","cfoCta":"Отримати вердикт безкоштовно →"},"ru":{"skip":"Перейти к содержанию","dark":"Тёмная","light":"Светлая","toDark":"Включить тёмную тему","toLight":"Включить светлую тему","navCfo":"Virtuse CFO","cfoKicker":"Verdict бесплатно","cfoTitle":"Ваш AI CFO для Биткоина.","cfoText":"Verdict бесплатный; аудит комиссий появится в Virtuse CFO. Платные планы после запуска: 9 €/мес. или 90 €/год.","cfoCta":"Получить вердикт бесплатно →"}}/*END-CHROME-I18N*/;
  var CT = CHROME_T[(document.documentElement.lang || 'en').slice(0, 2)] || CHROME_T.en;
  window.VB_CHROME_T = CT;
  window.VB_CHROME_ALL = CHROME_T;  // article.js swaps VB_CHROME_T for ?lang= readers
  function $(id) { return document.getElementById(id); }
  function j(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function num(n) { return (n == null || isNaN(n)) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function usd(n) { return (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }
  function compact(n) { return (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n); }

  /* Nav hamburger */
  (function () {
    var btn = $('navToggle'), links = $('navLinks');
    if (!btn || !links) return;
    btn.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) document.body.classList.remove('nav-open'); });
  })();

  /* Theme */
  (function () {
    var btn = $('themeToggle'), label = $('themeToggleLabel');
    if (!btn) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    function current() {
      try { var s = localStorage.getItem(THEME_KEY); if (s === 'light' || s === 'dark') return s; } catch (e) {}
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    window.VB_THEME_LABEL = function () { apply(current(), false); };
    function apply(theme, persist) {
      document.documentElement.setAttribute('data-theme', theme);
      if (meta) meta.setAttribute('content', theme === 'light' ? '#FBFBFA' : (THEME_KEY === 'vb-theme-blog' ? '#08090a' : '#111110'));
      if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} }
      var T = window.VB_CHROME_T || CT, toLight = theme === 'dark';
      btn.setAttribute('aria-label', toLight ? T.toLight : T.toDark);
      btn.setAttribute('title', toLight ? T.toLight : T.toDark);
      label.textContent = toLight ? T.light : T.dark;
    }
    btn.addEventListener('click', function () { apply(current() === 'dark' ? 'light' : 'dark', true); });
    apply(current(), false);
  })();

  /* Subscribe — same Worker, lang set by the story's language */
  function bindSubscribe(form, msg) {
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ui = (window.VB_UI || {});
      var label = btn.textContent;
      var email = form.elements.email.value.trim();
      msg.textContent = ''; msg.className = 'subscribe-msg';
      if (!email) { msg.textContent = ui.emailReq || 'Email is required.'; msg.classList.add('err'); return; }
      btn.disabled = true; btn.textContent = ui.sending || 'Sending';
      fetch('https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, hp: form.elements.website.value, lang: window.VB_LANG || 'en' })
      }).then(function (res) {
        return res.json().then(function (d) { return { ok: res.ok, data: d }; });
      }).then(function (r) {
        if (r.ok) { form.reset(); try { localStorage.setItem('vb-brief-sub', '1'); } catch (e) {} msg.textContent = ui.subOk || 'You are on the list. Check your inbox.'; msg.classList.add('ok'); }
        else { msg.textContent = (r.data && r.data.error) || ui.subErr || 'Could not join the list. Try again.'; msg.classList.add('err'); }
      }).catch(function () {
        msg.textContent = ui.netErr || 'Network error. Try again.'; msg.classList.add('err');
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    });
  }
  bindSubscribe($('subscribeForm'), $('subscribeMsg'));
  bindSubscribe($('footerForm'), $('footerMsg'));

  /* Ticker (same six figures as the Brief) */
  var last = null, timer = null;
  function renderTicker(s) {
    var host = $('tickerTrack'); if (!host) return;
    last = s;
    var parts = [['BTC/USD', s.price, ''], ['24h', s.chg, s.chgClass], ['Hashrate', s.hash, ''], ['Fees', s.fee, ''], ['Sats/$', s.sats, ''], ['Block', s.height, '']];
    function sep() { var x = document.createElement('span'); x.className = 'ticker-sep'; x.setAttribute('aria-hidden', 'true'); x.textContent = '•'; return x; }
    function row() {
      var f = document.createDocumentFragment();
      parts.forEach(function (p, i) {
        if (i) f.appendChild(sep());
        var it = document.createElement('span'); it.className = 'ticker-item';
        it.appendChild(document.createTextNode(p[0] + ' '));
        var st = document.createElement('strong'); st.className = p[2]; st.textContent = p[1] || '—';
        it.appendChild(st); f.appendChild(it);
      });
      return f;
    }
    function group(n) { var g = document.createElement('span'); g.className = 'ticker-group'; for (var i = 0; i < n; i++) { g.appendChild(row()); g.appendChild(sep()); } return g; }
    host.textContent = '';
    var probe = group(1); host.appendChild(probe);
    var w = probe.getBoundingClientRect().width || 1;
    var vw = host.parentElement ? host.parentElement.getBoundingClientRect().width : 1200;
    var n = Math.max(1, Math.ceil((vw + 1) / w));
    host.textContent = ''; host.appendChild(group(n)); host.appendChild(group(n));
  }
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(function () { if (last) renderTicker(last); }, 150); });
  /* 24h change from CoinGecko (free, no key); cached 2 minutes per tab to stay under its rate limit. */
  var CG = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true';
  function cg() {
    try {
      var c = JSON.parse(sessionStorage.getItem('vb-cg-btc') || 'null');
      if (c && c.b && Date.now() - c.t < 120000) return Promise.resolve(c.b);
    } catch (e) {}
    return j(CG).then(function (d) {
      var b = d && d.bitcoin; if (!b) throw new Error('no data');
      try { sessionStorage.setItem('vb-cg-btc', JSON.stringify({ t: Date.now(), b: b })); } catch (e) {}
      return b;
    });
  }
  function refresh() {
    var s = { price: '—', sats: '—', chg: '—', chgClass: '', hash: '—', fee: '—', height: '—' };
    renderTicker(s);
    j(MP + '/v1/prices').then(function (p) { s.price = usd(p.USD); s.sats = p.USD ? num(Math.round(1e8 / p.USD)) : '—'; renderTicker(s); }).catch(function () {});
    cg().then(function (b) {
      var n = parseFloat(b.usd_24h_change);
      if (s.price === '—' && b.usd) { s.price = usd(b.usd); s.sats = num(Math.round(1e8 / b.usd)); }
      s.chg = isNaN(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(2) + '%'; s.chgClass = n > 0 ? 'up' : (n < 0 ? 'down' : ''); renderTicker(s);
    }).catch(function () {});
    j(MP + '/blocks/tip/height').then(function (h) { s.height = num(h); renderTicker(s); }).catch(function () {});
    j(MP + '/v1/fees/recommended').then(function (f) { s.fee = f.fastestFee != null ? f.fastestFee + ' sat/vB' : '—'; renderTicker(s); }).catch(function () {});
    j(MP + '/v1/mining/hashrate/3d').then(function (m) { s.hash = compact(m.currentHashrate / 1e18) + ' EH/s'; renderTicker(s); }).catch(function () {});
  }
  refresh();

  /* Reading progress (article only) */
  var bar = $('progressBar');
  if (bar) window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  }, { passive: true });
})();

/* Desks: WordPress posts carry no desk field, so the desk is inferred from
   the story text (title counts double). Whole-word matching, so "ban" does
   not hit "bank". Each desk maps to the matching hub service page. Keywords
   are English; translated stories fall back to Markets more often until a
   real WP desk tag exists. */
(function () {
  var DESKS = [
    { id: 'mining',   href: 'mining.html',      words: ['mining', 'miner', 'miners', 'hashrate', 'hash rate', 'difficulty', 'asic', 'asics', 'halving'] },
    { id: 'treasury', href: 'treasury.html',    words: ['treasury', 'treasuries', 'saylor', 'microstrategy', 'balance sheet', 'corporate', 'corporations'] },
    { id: 'custody',  href: 'secure.html',      words: ['custody', 'self-custody', 'custodian', 'wallet', 'wallets', 'private key', 'private keys', 'inheritance', 'multisig', 'seed phrase'] },
    { id: 'policy',   href: 'tax.html',         words: ['regulation', 'regulators', 'mica', 'cbdc', 'cbdcs', 'digital euro', 'sec', 'law', 'laws', 'tax', 'taxes', 'ban', 'government', 'surveillance'] },
    { id: 'macro',    href: 'lending.html',     words: ['fed', 'warsh', 'powell', 'inflation', 'interest rates', 'rate hike', 'debt', 'dollar', 'gold', 'money printing', 'yield', 'yields', 'recession', 'dedollarization', 'de-dollarization'] },
    { id: 'markets',  href: 'buy-bitcoin.html', words: ['etf', 'etfs', 'ibit', 'blackrock', 'price', 'rally', 'sell-off', 'liquidations', 'support', 'resistance', 'flows', 'bull', 'bear'] }
  ];
  function strip(s) {
    var d = new DOMParser().parseFromString(s || '', 'text/html');
    return (d.body.textContent || '');
  }
  var RX = DESKS.map(function (d) {
    return new RegExp('(^|[^a-z0-9-])(' + d.words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?=[^a-z0-9-]|$)', 'g');
  });
  window.VB_DESKS = DESKS;
  // post: a WP REST post object; uses title + content if present, else excerpt.
  window.VB_inferDesk = function (post) {
    var t = strip(post.title && post.title.rendered);
    var body = strip((post.content && post.content.rendered) || (post.excerpt && post.excerpt.rendered));
    var text = (t + ' ' + t + ' ' + body).toLowerCase();
    var best = DESKS[DESKS.length - 1], bestScore = 0;
    RX.forEach(function (rx, i) {
      var m = text.match(rx), score = m ? m.length : 0;
      if (score > bestScore) { best = DESKS[i]; bestScore = score; }
    });
    return best;
  };
})();
