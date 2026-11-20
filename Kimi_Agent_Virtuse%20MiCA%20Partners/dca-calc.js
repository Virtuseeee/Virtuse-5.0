/* Historical Bitcoin DCA calculator on /bitcoin-dca-calculator/ and its 9 language versions.
 *
 * One renderer for both sides (same idea as btc-returns.js): seo-build/generate.mjs runs it in
 * Node on seo-build/data/dca-snapshot.json to write the static result, chart and table; in the
 * browser it runs again on data/btc-monthly-returns.json (GitHub first, the site copy as
 * fallback, the snapshot embedded in the page if both fail).
 *
 * Rules: one purchase of the same amount at every month-end close, from the chosen month to the
 * last complete month. The stack is valued at the latest close in the data. USD closes are the
 * CoinMetrics reference rate; EUR = USD close / ECB EUR/USD of the same day. No fees, no spreads.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VBDca = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SOURCES = [
    'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/btc-monthly-returns.json',
    '/data/btc-monthly-returns.json'
  ];
  var MIN_START = '2014-01';
  var DEFAULTS = { amount: 100, start: '2020-01', ccy: 'EUR' };
  var AMOUNT_MIN = 10, AMOUNT_MAX = 100000;
  var PCT_SPACE = { sk: 1, cs: 1, de: 1, fr: 1, es: 1 };
  var NBSP = ' ';
  // Amount slider stops (typed values may go up to AMOUNT_MAX), like the stepped sliders in Stacking Strategist.
  var STEPS = (function () {
    var a = [], v;
    for (v = 10; v < 100; v += 10) a.push(v);
    for (v = 100; v < 1000; v += 50) a.push(v);
    for (v = 1000; v <= 5000; v += 250) a.push(v);
    return a;
  })();
  function stepIndex(v) { var i = 0; while (i < STEPS.length - 1 && STEPS[i + 1] <= v) i++; return i; }
  function monthList(data) {
    var end = lastFull(data), out = [], y = +MIN_START.slice(0, 4), m = +MIN_START.slice(5), k;
    for (;;) { k = y + '-' + (m < 10 ? '0' : '') + m; if (k > end) break; out.push(k); if (++m > 12) { m = 1; y++; } }
    return out;
  }

  // ------------------------------------------------------------------ data
  function keys(data) { return Object.keys(data.closes).sort(); }
  function daysIn(k) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); }
  // The newest key holds the latest daily close; it is a complete month only on its last day.
  function lastFull(data) {
    var ks = keys(data), last = ks[ks.length - 1];
    var asOf = data.asOf || '';
    if (asOf.slice(0, 7) === last && +asOf.slice(8, 10) < daysIn(last)) return ks[ks.length - 2];
    return last;
  }
  function price(data, k, ccy) {
    var c = data.closes[k];
    if (c == null) return null;
    if (ccy === 'USD') return c;
    var r = data.eurusd && data.eurusd[k];
    return r ? c / r : null;
  }
  function clampAmount(v) {
    v = Math.round(Number(v));
    if (!isFinite(v) || v < AMOUNT_MIN) return AMOUNT_MIN;
    return v > AMOUNT_MAX ? AMOUNT_MAX : v;
  }
  function clampStart(data, k) {
    var end = lastFull(data);
    if (!/^\d{4}-\d{2}$/.test(k || '') || k < MIN_START) return MIN_START;
    return k > end ? end : k;
  }

  function model(data, amount, start, ccy) {
    var ks = keys(data), end = lastFull(data), latest = ks[ks.length - 1];
    var btc = 0, invested = 0, n = 0, first = null, series = [];
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (k < start || k > end) continue;
      var p = price(data, k, ccy);
      if (!p) continue;
      if (first == null) first = p;
      btc += amount / p; invested += amount; n++;
      series.push({ k: k, invested: invested, value: btc * p });
    }
    var pv = price(data, latest, ccy);
    var value = btc * pv;
    if (latest !== end && n) series.push({ k: latest, invested: invested, value: value });
    var lump = first ? invested / first * pv : 0;
    return {
      amount: amount, start: start, ccy: ccy, n: n, invested: invested, btc: btc, value: value,
      avg: btc ? invested / btc : 0, change: invested ? value / invested - 1 : 0,
      lump: lump, lumpChange: invested ? lump / invested - 1 : 0,
      series: series, end: end, asOf: data.asOf
    };
  }

  // One row per starting January.
  function byYear(data, amount, ccy) {
    var end = lastFull(data), rows = [];
    for (var y = +MIN_START.slice(0, 4); y + '-01' <= end; y++) rows.push(model(data, amount, y + '-01', ccy));
    return rows;
  }

  // ------------------------------------------------------------------ formatting
  function fmt(lang, locale, ccy) {
    var cur = new Intl.NumberFormat(locale, { style: 'currency', currency: ccy, maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' });
    var compact = new Intl.NumberFormat(locale, { style: 'currency', currency: ccy, notation: 'compact', maximumSignificantDigits: 3, currencyDisplay: 'narrowSymbol' });
    var mon = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var dayF = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return {
      money: function (v) { return cur.format(Math.round(v)); },
      compact: function (v) { return compact.format(v); },
      btc: function (v) { return v.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + NBSP + 'BTC'; },
      pct: function (v) {
        var a = Math.abs(v * 100), d = a >= 100 ? 0 : 1;
        return (v < 0 ? '−' : '+') + a.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) + (PCT_SPACE[lang] ? NBSP : '') + '%';
      },
      month: function (k) { var p = k.split('-'); return mon.format(new Date(Date.UTC(+p[0], +p[1] - 1, 1))); },
      day: function (iso) { var p = iso.split('-'); return dayF.format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))); }
    };
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }

  // ------------------------------------------------------------------ rendering
  // Lines are an SVG stretched to the box; labels are HTML so they keep their size on phones.
  function chart(m, T, F) {
    var s = m.series;
    if (s.length < 2) return '';
    var max = 0;
    s.forEach(function (p) { max = Math.max(max, p.value, p.invested); });
    var x = function (i) { return 100 * i / (s.length - 1); };
    var y = function (v) { return 100 * (1 - v / max); };
    var line = function (key) { return s.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(p[key]).toFixed(2); }).join(''); };
    var grid = '', ylab = '', xlab = '';
    for (var g = 1; g <= 3; g++) {
      var gy = y(max * g / 3).toFixed(2);
      grid += '<line x1="0" x2="100" y1="' + gy + '" y2="' + gy + '" class="dca-grid"/>';
      ylab += '<span class="dca-y" style="top:' + gy + '%">' + esc(F.compact(max * g / 3)) + '</span>';
    }
    var years = [], seen = {};
    s.forEach(function (p, i) { var yr = p.k.slice(0, 4); if (p.k.slice(5) === '01' && !seen[yr]) { seen[yr] = 1; years.push({ i: i, y: yr }); } });
    var step = Math.ceil(years.length / 6) || 1;
    years.forEach(function (yv, j) {
      if (j % step || x(yv.i) > 94) return;
      xlab += '<span style="left:' + x(yv.i).toFixed(2) + '%"' + (yv.i === 0 ? ' class="dca-x0"' : '') + '>' + yv.y + '</span>';
    });
    var area = line('value') + 'L100 100L0 100Z';
    return '<figure class="dca-chart"><div class="dca-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="' + esc(T.chart_aria) + '">' +
      grid + '<path d="' + area + '" class="dca-area"/><path d="' + line('invested') + '" class="dca-line-inv"/><path d="' + line('value') + '" class="dca-line-val"/>' +
      '</svg>' + ylab + '</div><div class="dca-x" aria-hidden="true">' + xlab + '</div>' +
      '<figcaption><span class="dca-key dca-key-val"></span>' + esc(T.leg_value) + ' <span class="dca-key dca-key-inv"></span>' + esc(T.leg_inv) + '</figcaption></figure>';
  }

  // Stat row + chart, laid out like the Stacking Strategist result panel.
  function results(m, T, F) {
    var stat = function (label, value, sub, cls) {
      return '<div class="dca-stat' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    };
    return '<div class="dca-stats">' +
      stat(T.r_invested, F.money(m.invested), fill(T.r_n, { n: m.n, a: F.money(m.amount) })) +
      stat(T.r_value, F.money(m.value), fill(T.r_change, { p: F.pct(m.change) }), 'dca-main') +
      stat(T.r_btc, F.btc(m.btc), fill(T.r_avg, { p: F.money(m.avg) })) +
      '</div>' + chart(m, T, F) +
      '<p class="dca-lump">' + esc(fill(T.r_lump, { start: F.month(m.start) })) + ': <b>' + esc(F.money(m.lump)) + '</b> <span>' + esc(F.pct(m.lumpChange)) + '</span></p>';
  }

  function table(rows, T, F) {
    var heads = [T.t_start, T.r_invested, T.r_btc, T.t_value, T.t_change];
    var body = rows.map(function (m) {
      var cells = [F.month(m.start), F.money(m.invested), F.btc(m.btc), F.money(m.value), F.pct(m.change)];
      return '<tr>' + cells.map(function (c, i) { return '<td data-label="' + esc(heads[i]) + '">' + esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr>' + heads.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function note(m, T, F) { return fill(T.note, { d: F.day(m.asOf) }); }

  // ------------------------------------------------------------------ browser
  function init() {
    var app = document.getElementById('dcaApp'), cfgEl = document.getElementById('dcaI18n');
    if (!app || !cfgEl) return;
    var cfg = JSON.parse(cfgEl.textContent), T = cfg.T, data = cfg.snap;
    var $ = function (id) { return document.getElementById(id); };
    var each = function (sel, fn) { Array.prototype.forEach.call(app.querySelectorAll(sel), fn); };
    var q = new URLSearchParams(location.search);
    var st = {
      amount: clampAmount(q.get('amount') || DEFAULTS.amount),
      start: clampStart(data, q.get('start') || DEFAULTS.start),
      ccy: q.get('ccy') === 'USD' ? 'USD' : 'EUR'
    };
    var amountEl = $('dcaAmount'), amountR = $('dcaAmountR'), startR = $('dcaStartR');
    var fillRange = function (el) { el.style.setProperty('--p', (100 * (el.value - el.min) / ((el.max - el.min) || 1)) + '%'); };

    function paint(keepAmount) {
      st.start = clampStart(data, st.start);
      var F = fmt(cfg.lang, cfg.locale, st.ccy), m = model(data, st.amount, st.start, st.ccy), months = monthList(data);
      $('dcaOut').innerHTML = results(m, T, F);
      $('dcaTable').innerHTML = table(byYear(data, st.amount, st.ccy), T, F);
      $('dcaNote').textContent = note(m, T, F);
      // summary box: same default example as the static text (EUR), with live numbers
      var ansP = document.querySelector('.answer p');
      if (ansP && T.ans && cfg.ansRest != null) {
        var Fd = fmt(cfg.lang, cfg.locale, DEFAULTS.ccy), md = model(data, DEFAULTS.amount, DEFAULTS.start, DEFAULTS.ccy);
        ansP.textContent = fill(T.ans, { a: Fd.money(md.amount), inv: Fd.money(md.invested), val: Fd.money(md.value), d: Fd.day(md.asOf) }) + cfg.ansRest;
      }
      var a = F.money(st.amount);
      each('[data-dca-amt]', function (el) { el.textContent = a; });
      each('[data-dca-fee]', function (el) { el.textContent = F.money(st.amount * 12 * Number(el.getAttribute('data-dca-fee'))); });
      each('[data-dca-sym]', function (el) { el.textContent = st.ccy === 'USD' ? '$' : '€'; });
      if (!keepAmount) amountEl.value = st.amount;
      amountR.max = STEPS.length - 1; amountR.value = stepIndex(st.amount); fillRange(amountR);
      startR.max = months.length - 1; startR.value = Math.max(0, months.indexOf(st.start)); fillRange(startR);
      $('dcaStartV').textContent = F.month(st.start);
      $('dcaYear').value = st.start.slice(0, 4);
      $('dcaMonth').value = st.start.slice(5);
      each('[data-ccy]', function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ccy') === st.ccy ? 'true' : 'false'); });
    }
    function url(extra) {
      var p = new URLSearchParams();
      p.set('amount', st.amount); p.set('start', st.start); p.set('ccy', st.ccy);
      return location.pathname + '?' + p.toString() + (extra || '');
    }
    function changed(keepAmount) {
      paint(keepAmount);
      try { history.replaceState(null, '', url()); } catch (e) {}
    }
    var typed = function (v) { return Number(String(v).replace(/[^0-9]/g, '')); };

    amountEl.addEventListener('input', function () {
      var v = typed(this.value);
      if (v >= AMOUNT_MIN && v <= AMOUNT_MAX) { st.amount = v; changed(true); }
    });
    amountEl.addEventListener('change', function () { st.amount = clampAmount(typed(this.value)); changed(); });
    amountR.addEventListener('input', function () { st.amount = STEPS[+this.value]; changed(); });
    startR.addEventListener('input', function () { st.start = monthList(data)[+this.value]; changed(); });
    var pick = function () { st.start = $('dcaYear').value + '-' + $('dcaMonth').value; changed(); };
    $('dcaYear').addEventListener('change', pick);
    $('dcaMonth').addEventListener('change', pick);
    each('[data-ccy]', function (b) { b.addEventListener('click', function () { st.ccy = b.getAttribute('data-ccy'); changed(); }); });
    var share = $('dcaShare');
    if (share) share.addEventListener('click', function () {
      var link = location.origin + url('&utm_source=share&utm_medium=link&utm_campaign=tool_share_dca');
      var label = share.querySelector('span') || share;
      var done = function () {
        label.textContent = T.copied;
        setTimeout(function () { label.textContent = T.share; }, 2200);
        (window.dataLayer = window.dataLayer || []).push({ event: 'tool_share', tool: 'dca', page_lang: cfg.lang, share_method: 'copy' });
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { prompt(T.share, link); });
      else prompt(T.share, link);
    });

    paint();
    (function load(i) {
      if (i >= SOURCES.length) return;
      fetch(SOURCES[i], { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
        if (!d || !d.closes || !d.eurusd || !d.asOf || d.asOf < data.asOf) throw 0;
        data = d; paint();
      }).catch(function () { load(i + 1); });
    })(0);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }

  return {
    MIN_START: MIN_START, DEFAULTS: DEFAULTS, AMOUNT_MIN: AMOUNT_MIN, AMOUNT_MAX: AMOUNT_MAX,
    STEPS: STEPS, stepIndex: stepIndex, monthList: monthList, lastFull: lastFull, model: model, byYear: byYear, fmt: fmt, results: results, table: table, note: note, fill: fill
  };
});
