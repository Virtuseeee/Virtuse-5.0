/* Virtuse Brief reader chrome, shared by article.html and blog.html:
   nav toggle, light/dark theme (same vb-theme key as news.html), live ticker,
   subscribe forms, reading progress, plus desk inference for stories.
   Mirrors the chrome parts of news/news.js (desk-owned) without the desk's
   Pulse / issues / archive fetches.
   Pages may set window.VB_UI (localized strings) and window.VB_LANG
   (Worker welcome-email language) before a form is submitted. */
(function () {
  'use strict';
  var MP = 'https://mempool.space/api';
  // Storage key per section: news.html keeps 'vb-theme' (default light);
  // blog + article set data-theme-key="vb-theme-blog" (default dark), so a
  // choice made on one section doesn't override the other's default.
  var THEME_KEY = document.documentElement.getAttribute('data-theme-key') || 'vb-theme';
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

  /* Theme — same key and default as news.html */
  (function () {
    var btn = $('themeToggle'), label = $('themeToggleLabel');
    if (!btn) return;
    var meta = document.querySelector('meta[name="theme-color"]');
    function current() {
      try { var s = localStorage.getItem(THEME_KEY); if (s === 'light' || s === 'dark') return s; } catch (e) {}
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    function apply(theme, persist) {
      document.documentElement.setAttribute('data-theme', theme);
      if (meta) meta.setAttribute('content', theme === 'light' ? '#FBFBFA' : (THEME_KEY === 'vb-theme-blog' ? '#08090a' : '#111110'));
      if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} }
      var next = theme === 'dark' ? 'light' : 'dark';
      var cap = next.charAt(0).toUpperCase() + next.slice(1);
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      btn.setAttribute('title', cap + ' theme');
      label.textContent = cap;
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
        if (r.ok) { form.reset(); msg.textContent = ui.subOk || 'You are on the list. Check your inbox.'; msg.classList.add('ok'); }
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
  function refresh() {
    var s = { price: '—', sats: '—', chg: '—', chgClass: '', hash: '—', fee: '—', height: '—' };
    renderTicker(s);
    j(MP + '/v1/prices').then(function (p) { s.price = usd(p.USD); s.sats = p.USD ? num(Math.round(1e8 / p.USD)) : '—'; renderTicker(s); }).catch(function () {});
    j('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(function (t) {
      var n = parseFloat(t.priceChangePercent);
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
