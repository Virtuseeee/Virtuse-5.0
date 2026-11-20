/* Bitcoin tax calculator (/bitcoin-tax-calculator.html): one sale by a private person, 13 EU countries.
 * Rules: seo-build/data/tax-rules.json, inlined into the page as <script type="application/json" id="tc-rules">.
 * Strings: <script type="application/json" id="tc-i18n">. The same file runs in Node (tests, builder):
 *   const T = require('./tax-calc.js'); T.compute(rules, 'sk', {...})
 * No advice: it prints the arithmetic of the published rule and what it leaves out. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VBTaxCalc = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { api.mount(); });
    else api.mount();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  function cents(x) { return Math.round(x * 100) / 100; }

  // Date 'YYYY-MM-DD' plus n years (29 Feb + 1 year = 28 Feb).
  function addYears(d, n) {
    var y = +d.slice(0, 4) + n, m = +d.slice(5, 7), day = +d.slice(8, 10);
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return y + '-' + d.slice(5, 7) + '-' + ('0' + Math.min(day, last)).slice(-2);
  }
  // Held for MORE than n years: the sale day is after the n-th anniversary.
  function heldMore(bought, today, n) { return today > addYears(bought, n); }

  // Progressive bands [[upper, rate], ..., [null, rate]] on a whole base: tax and the slice per band.
  function bandSlices(bands, from, to) {
    var out = [], lo = 0;
    for (var i = 0; i < bands.length; i++) {
      var hi = bands[i][0] == null ? Infinity : bands[i][0];
      var a = Math.max(from, lo), b = Math.min(to, hi);
      if (b > a) out.push({ base: cents(b - a), rate: bands[i][1], amount: (b - a) * bands[i][1] / 100, upto: bands[i][0] });
      lo = hi;
    }
    return out;
  }

  // German income tax, § 32a(1) EStG from tax year 2026, single assessment (Grundtarif).
  function deTax(zvE) {
    var x = Math.floor(Math.max(0, zvE)), t;
    if (x <= 12348) t = 0;
    else if (x <= 17799) { var y = (x - 12348) / 10000; t = (914.51 * y + 1400) * y; }
    else if (x <= 69878) { var z = (x - 17799) / 10000; t = (173.10 * z + 2397) * z + 1034.87; }
    else if (x <= 277825) t = 0.42 * x - 11135.63;
    else t = 0.45 * x - 19470.38;
    return Math.floor(t);
  }

  /* input: { proceeds, cost, bought: 'YYYY-MM-DD', today: 'YYYY-MM-DD', other }  (euros)
   * returns { status, reason, gain, tax, levy, total, net, eff, lines, holdDate, reviewed } */
  function compute(rules, id, inp) {
    var r = rules.countries[id];
    if (!r) throw new Error('unknown country ' + id);
    var fx = r.currency && r.currency !== 'EUR' ? rules.fx[r.currency] : 1;
    var proceeds = Math.max(0, +inp.proceeds || 0), cost = Math.max(0, +inp.cost || 0), other = Math.max(0, +inp.other || 0);
    var gain = cents(proceeds - cost);
    var res = { country: id, kind: r.kind, status: 'taxed', reason: '', gain: gain, tax: 0, levy: 0, total: 0,
                net: cents(proceeds), eff: 0, lines: [], holdDate: '', reviewed: !!r.reviewed };
    function done(status, reason) { res.status = status; res.reason = reason || ''; return res; }

    if (r.kind === 'none') return done('none');
    if (r.kind === 'box3') return done('box3');
    if (gain <= 0) return done('loss');

    if (r.oldBefore && inp.bought < r.oldBefore) {
      if (heldMore(inp.bought, inp.today, r.oldHoldYears)) return done('exempt', 'old');
    }
    if (r.holdYears) {
      res.holdDate = addYears(inp.bought, r.holdYears);
      if (heldMore(inp.bought, inp.today, r.holdYears)) {
        if (r.holdCap && proceeds * fx > r.holdCap) return done('over', 'holdCap');
        return done('exempt', 'hold');
      }
    }
    if (r.exemptProceedsMax && proceeds * fx <= r.exemptProceedsMax) return done('exempt', 'small');

    if (r.kind === 'flat') {
      res.lines.push({ key: 'tax', base: gain, rate: r.rate, amount: cents(gain * r.rate / 100) });
    } else if (r.kind === 'bands') {
      var bands = r.bands.map(function (b) { return [b[0] == null ? null : b[0] / fx, b[1]]; });
      bandSlices(bands, other, other + gain).forEach(function (s) {
        res.lines.push({ key: 'band', base: s.base, rate: s.rate, amount: cents(s.amount), upto: s.upto });
      });
    } else if (r.kind === 'de') {
      if (gain < r.freigrenze) return done('exempt', 'freigrenze');
      var t = deTax(other + gain) - deTax(other);
      res.lines.push({ key: 'income', base: gain, rate: cents(t / gain * 100), amount: t });
    }
    res.tax = cents(res.lines.reduce(function (s, l) { return s + l.amount; }, 0));
    if (r.levy) { res.levy = cents(gain * r.levy / 100); res.lines.push({ key: 'levy', base: gain, rate: r.levy, amount: res.levy }); }
    res.total = cents(res.tax + res.levy);
    res.net = cents(proceeds - res.total);
    res.eff = cents(res.total / gain * 100);
    return res;
  }

  /* ---------- page ---------- */
  // Approximate BTC/EUR price in a month: the mean of the month-end closes before and after it.
  function monthPrice(data, m) {
    var keys = Object.keys(data.closes).sort(), k = keys.indexOf(m);
    if (k < 1 || !data.eurusd[m] || !data.eurusd[keys[k - 1]]) return 0;
    return (data.closes[keys[k - 1]] / data.eurusd[keys[k - 1]] + data.closes[m] / data.eurusd[m]) / 2;
  }

  function mount() {
    var form = document.getElementById('tc-form');
    if (!form) return;
    var R = JSON.parse(document.getElementById('tc-rules').textContent);
    var S = JSON.parse(document.getElementById('tc-i18n').textContent);
    var ORDER = JSON.parse(form.getAttribute('data-order'));
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    var loc = lang === 'sk' ? 'sk-SK' : 'en-GB';
    var $ = function (id) { return document.getElementById(id); };
    var today = new Date().toISOString().slice(0, 10);
    var eur = function (n, d) {
      return new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n);
    };
    var pct = function (n) {
      var s = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }).format(n);
      return lang === 'sk' ? s + ' %' : s + '%';
    };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var fill = function (s, v) { return s.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; }); };
    function num(el) {
      var s = String(el.value).replace(/[\s €]/g, '');
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // 1.000.000
      s = s.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
      var m = /^(\d+(?:\.\d+)?)([km])?$/i.exec(s);
      if (!m) return NaN;
      return +m[1] * (m[2] ? (m[2].toLowerCase() === 'k' ? 1e3 : 1e6) : 1);
    }
    var sel = $('tc-country'), modeBtns = [].slice.call(document.querySelectorAll('#tc-mode [data-mode]'));
    var mode = 'exact', prices = null, live = null, pricesFailed = false;
    var q = new URLSearchParams(location.search);
    if (q.get('country') && R.countries[q.get('country')]) sel.value = q.get('country');
    if (q.get('mode') === 'est') mode = 'est';
    ['proceeds', 'cost', 'other', 'invested'].forEach(function (k) { if (q.get(k) && !isNaN(+q.get(k))) $('tc-' + k).value = q.get(k); });
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('bought') || '')) $('tc-bought').value = q.get('bought');
    if (/^\d{4}-\d{2}$/.test(q.get('month') || '')) $('tc-month').value = q.get('month');
    $('tc-bought').max = today;
    $('tc-month').max = today.slice(0, 7);
    if (!$('tc-bought').value) {   // default: bought six months ago
      var d6 = new Date(); d6.setUTCMonth(d6.getUTCMonth() - 6); $('tc-bought').value = d6.toISOString().slice(0, 10);
    }

    function loadPrices() {
      if (prices || pricesFailed === 'loading') return;
      pricesFailed = 'loading';
      fetch('/data/btc-monthly-returns.json').then(function (r) { return r.json(); }).then(function (d) {
        prices = d; pricesFailed = false; run();
      }).catch(function () { pricesFailed = true; run(); });
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur').then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.bitcoin && d.bitcoin.eur > 0) { live = d.bitcoin.eur; run(); } }).catch(function () {});
    }

    // The sale as the engine wants it, from either mode. Returns null (and shows why) when it cannot be worked out.
    function sale() {
      var o = num($('tc-other'));
      if (isNaN(o)) return null;
      if (mode === 'exact') {
        var p = num($('tc-proceeds')), c = num($('tc-cost')), b = $('tc-bought').value;
        if (isNaN(p) || isNaN(c) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b > today || p > 1e9 || c > 1e9) return null;
        return { proceeds: p, cost: c, bought: b, today: today, other: o };
      }
      var inv = num($('tc-invested')), m = $('tc-month').value;
      $('tc-est').textContent = '';
      if (isNaN(inv) || inv <= 0 || inv > 1e9 || !/^\d{4}-\d{2}$/.test(m) || m > today.slice(0, 7)) return null;
      if (!prices) { loadPrices(); $('tc-est').textContent = pricesFailed === true ? S.est_err : S.est_loading; return 'wait'; }
      var p0 = monthPrice(prices, m);
      if (!p0) { $('tc-est').textContent = S.est_err; return 'wait'; }
      var keys = Object.keys(prices.closes).sort(), lastK = keys[keys.length - 1];
      var p1 = live || prices.closes[lastK] / prices.eurusd[lastK];
      var btc = inv / p0, end = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).toISOString().slice(0, 10);
      var mLabel = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m + '-15T00:00:00Z'));
      $('tc-est').textContent = fill(S.est_line, { btc: new Intl.NumberFormat(loc, { maximumFractionDigits: 4 }).format(btc), p0: eur(p0), month: mLabel,
        val: eur(btc * p1), p1: eur(p1), src: live ? S.est_live : fill(S.est_close, { date: prices.asOf }) });
      return { proceeds: Math.round(btc * p1), cost: inv, bought: end > today ? today : end, today: today, other: o };
    }

    function why(x, r) {   // short reason for a row in the comparison
      var yrs = (S.yrs || {})[r.holdYears || r.oldHoldYears] || '';
      if (x.status === 'taxed') return fill(S.r_taxed, { eff: pct(x.eff) });
      return fill(S['r_' + x.status + (x.reason ? '_' + x.reason : '')] || '', { years: yrs });
    }

    function run() {
      modeBtns.forEach(function (b) {
        var on = b.getAttribute('data-mode') === mode;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $('tc-exact').hidden = mode !== 'exact';
      $('tc-estf').hidden = mode !== 'est';
      var country = sel.value, r = R.countries[country];
      var inp = sale();
      $('tc-err').hidden = inp !== null;
      $('tc-out').classList.toggle('off', !inp || inp === 'wait');
      if (!inp) { $('tc-err').textContent = S.err; return; }
      if (inp === 'wait') return;
      var calc = function (id) {   // Spain's bands run on savings income only: counted without other savings income
        var rr = R.countries[id];
        return compute(R, id, { proceeds: inp.proceeds, cost: inp.cost, bought: inp.bought, today: today, other: rr.base === 'savings' ? 0 : inp.other });
      };
      var x = calc(country), name = S['n_' + country];
      var v = { country: name, gain: eur(x.gain), years: (S.yrs || {})[r.holdYears || r.oldHoldYears] || '',
                limit: r.exemptProceedsMax ? (r.currency === 'CZK' ? new Intl.NumberFormat(loc).format(r.exemptProceedsMax) + ' CZK' : eur(r.exemptProceedsMax)) : '' };
      var key = x.status + (x.reason ? '_' + x.reason : '');
      $('tc-v-title').textContent = x.status === 'taxed' ? S.h_taxed : S['h_' + key];
      $('tc-v-sub').textContent = fill(S['s_' + key] || '', v);
      $('tc-r-tax').textContent = eur(x.total);
      $('tc-r-gain').textContent = eur(x.gain);
      $('tc-r-net').textContent = eur(x.net);
      $('tc-r-eff').textContent = pct(x.status === 'taxed' ? x.eff : 0);
      // the working, line by line
      var rows = '';
      if (x.status === 'taxed' || x.status === 'loss' || x.status === 'exempt') {
        rows += '<tr><th>' + esc(S.w_proceeds) + '</th><td>' + eur(inp.proceeds, 2) + '</td></tr>';
        rows += '<tr><th>' + esc(S.w_cost) + '</th><td>−' + eur(inp.cost, 2) + '</td></tr>';
        rows += '<tr class="sum"><th>' + esc(S.w_gain) + '</th><td>' + eur(x.gain, 2) + '</td></tr>';
      }
      x.lines.forEach(function (l) {
        var k = l.key === 'band' ? S.w_band : l.key === 'levy' ? S.w_levy : l.key === 'income' ? S.w_income : S.w_tax;
        rows += '<tr><th>' + esc(fill(k, { rate: pct(l.rate), base: eur(l.base, 2) })) + '</th><td>' + eur(l.amount, 2) + '</td></tr>';
      });
      if (x.status === 'taxed') {
        rows += '<tr class="sum"><th>' + esc(S.w_total) + '</th><td>' + eur(x.total, 2) + '</td></tr>';
        rows += '<tr><th>' + esc(S.w_net) + '</th><td>' + eur(x.net, 2) + '</td></tr>';
      }
      $('tc-work').innerHTML = rows;
      $('tc-work-w').hidden = !rows;
      var notes = S['note_' + country] || [];
      $('tc-notes').innerHTML = notes.map(function (n) { return '<li>' + n + '</li>'; }).join('');
      $('tc-notes-w').hidden = !notes.length;
      var src = document.querySelector('#tc-table [data-c="' + country + '"] a[target=_blank]');
      $('tc-src').innerHTML = src ? fill(S.src, { link: '<a href="' + src.href + '" target="_blank" rel="noopener">' + esc(src.textContent) + '</a>' }) : '';
      $('tc-rev').textContent = x.reviewed ? S.rev_yes : S.rev_no;
      $('tc-rev').className = 'tc-rev ' + (x.reviewed ? 'y' : 'n');

      // the same sale in all 13 countries, lowest tax first (the page order breaks ties)
      var all = ORDER.map(function (id, i) { return { id: id, i: i, x: id === country ? x : calc(id) }; });
      all.sort(function (a, b) { return a.x.total - b.x.total || a.i - b.i; });
      var max = all[all.length - 1].x.total || 1, low = all[0].x.total;
      $('tc-cmp').innerHTML = all.map(function (a) {
        var home = a.id === country;
        return '<div class="tc-cmp-row' + (home ? ' home' : '') + '"><span class="tc-cmp-n"><b>' + esc(S['n_' + a.id]) +
          (home ? ' <span class="tc-you">' + esc(S.cmp_home) + '</span>' : '') + '</b><small>' + esc(why(a.x, R.countries[a.id])) + '</small></span>' +
          '<span class="tc-cmp-bar" aria-hidden="true"><i style="width:' + (a.x.total / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="tc-cmp-t">' + eur(a.x.total) + '</span><span class="tc-cmp-k">' + eur(a.x.net) + '</span></div>';
      }).join('');
      var best = all.filter(function (a) { return a.x.total === low; }).map(function (a) { return S['n_' + a.id]; });
      $('tc-cmp-sum').innerHTML = x.total <= low
        ? fill(S.cmp_best, { home: esc(name), a: '<b>' + eur(x.total) + '</b>' })
        : fill(S.cmp_diff, { home: esc(name), a: '<b>' + eur(x.total) + '</b>', best: esc(best.slice(0, 3).join(', ')), b: '<b>' + eur(low) + '</b>',
            d: '<b class="hp-480">' + eur(x.total - low) + '</b>' });

      var qs = new URLSearchParams({ country: country });
      if (mode === 'est') { qs.set('mode', 'est'); qs.set('invested', inp.cost); qs.set('month', $('tc-month').value); }
      else { qs.set('proceeds', inp.proceeds); qs.set('cost', inp.cost); qs.set('bought', inp.bought); }
      if (inp.other) qs.set('other', inp.other);
      history.replaceState(null, '', location.pathname + '?' + qs.toString() + location.hash);
    }
    var timer;
    function later() { clearTimeout(timer); timer = setTimeout(run, 250); }
    modeBtns.forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); run(); }); });
    form.addEventListener('input', later);
    form.addEventListener('change', function () {
      run();
      window.dataLayer && window.dataLayer.push({ event: 'tax_calc', tax_country: sel.value, tax_mode: mode });
    });
    run();
  }

  return { compute: compute, deTax: deTax, addYears: addYears, monthPrice: monthPrice, mount: mount };
});
