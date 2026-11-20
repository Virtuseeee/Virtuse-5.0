/* Historical Bitcoin DCA calculator on /bitcoin-dca-calculator/ and its 9 language versions.
 *
 * One renderer for both sides (same idea as btc-returns.js): seo-build/generate.mjs runs it in
 * Node on seo-build/data/dca-snapshot.json to write the static result, chart and table; in the
 * browser it runs again on data/btc-monthly-returns.json (the site copy first, then GitHub; the
 * snapshot embedded in the page if both fail).
 *
 * Rules: one purchase of the same amount at every month-end close, from the chosen month to the
 * last complete month. The stack, and the one-purchase comparison, are valued at that same last
 * complete month-end close, never at a close inside a month that is still running. USD closes are
 * the CoinMetrics reference rate; EUR = USD close / ECB EUR/USD of the same day. No fees, no spreads.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VBDca = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // The repo folder is literally named "Kimi_Agent_Virtuse%20MiCA%20Partners", so its "%" is sent as "%25".
  var SOURCES = [
    '/data/btc-monthly-returns.json',
    'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/btc-monthly-returns.json'
  ];
  var MIN_START = '2014-01';
  var DEFAULTS = { amount: 100, start: '2020-01', ccy: 'EUR' };
  var AMOUNT_MIN = 10, AMOUNT_MAX = 100000;
  var PCT_SPACE = { sk: 1, cs: 1, de: 1, fr: 1, es: 1 };
  var NBSP = String.fromCharCode(160), MINUS = String.fromCharCode(8722), EURO = String.fromCharCode(8364);
  // Slovak dates are written without the ordinal point ("31 októbra 2026"); "k" takes the dative ("k 31 októbru 2026").
  var SK_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
  var SK_DAT = ['januáru', 'februáru', 'marcu', 'aprílu', 'máju', 'júnu', 'júlu', 'augustu', 'septembru', 'októbru', 'novembru', 'decembru'];
  // Amount slider stops, up to the same limit as the typed field. Typed whole numbers between stops stay as typed.
  var STEPS = (function () {
    var a = [], v;
    for (v = 10; v < 100; v += 10) a.push(v);
    for (v = 100; v < 1000; v += 50) a.push(v);
    for (v = 1000; v < 5000; v += 250) a.push(v);
    return a.concat([5000, 7500, 10000, 15000, 20000, 25000, 50000, 75000, 100000]);
  })();
  function stepIndex(v) { var i = 0; while (i < STEPS.length - 1 && STEPS[i + 1] <= v) i++; return i; }

  // ------------------------------------------------------------------ data
  function keys(data) { return Object.keys(data.closes).sort(); }
  function daysIn(k) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1], 0)).getUTCDate(); }
  function lastDay(k) { return k + '-' + daysIn(k); }
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
  function monthList(data) {
    var end = lastFull(data), out = [], y = +MIN_START.slice(0, 4), m = +MIN_START.slice(5), k;
    for (;;) { k = y + '-' + (m < 10 ? '0' : '') + m; if (k > end) break; out.push(k); if (++m > 12) { m = 1; y++; } }
    return out;
  }

  function model(data, amount, start, ccy) {
    var ks = keys(data), end = lastFull(data);
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
    var pv = price(data, end, ccy);          // last complete month-end close
    var value = btc * pv;
    var lump = first ? invested / first * pv : 0;
    return {
      amount: amount, start: start, ccy: ccy, n: n, invested: invested, btc: btc, value: value,
      avg: btc ? invested / btc : 0, change: invested ? value / invested - 1 : 0,
      lump: lump, lumpChange: invested ? lump / invested - 1 : 0,
      series: series, end: end, asOf: lastDay(end)
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
    var mon = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    var dayF = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    var day = function (iso, names) {
      var p = iso.split('-');
      if (lang === 'sk') return (+p[2]) + ' ' + (names || SK_GEN)[+p[1] - 1] + ' ' + p[0];
      return dayF.format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
    };
    return {
      money: function (v) { return cur.format(Math.round(v)); },
      btc: function (v) { return v.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + NBSP + 'BTC'; },
      pct: function (v) {
        var a = Math.abs(v * 100), d = a >= 100 ? 0 : 1;
        return (v < 0 ? MINUS : '+') + a.toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d }) + (PCT_SPACE[lang] ? NBSP : '') + '%';
      },
      month: function (k) { var p = k.split('-'); return mon.format(new Date(Date.UTC(+p[0], +p[1] - 1, 1))); },
      day: function (iso) { return day(iso); },             // "from / of / checked on <date>"
      dayTo: function (iso) { return day(iso, SK_DAT); }    // after Slovak "k": dative
    };
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }

  // ------------------------------------------------------------------ rendering
  // Lines are an SVG stretched to the box; labels are HTML so they keep their size on phones.
  // Y labels sit in a gutter left of the plot (never on the line); grid lines are round amounts.
  function chart(m, T, F) {
    var s = m.series;
    if (s.length < 2) return '';
    var max = 0;
    s.forEach(function (p) { max = Math.max(max, p.value, p.invested); });
    var x = function (i) { return 100 * i / (s.length - 1); };
    var y = function (v) { return 100 * (1 - v / max); };
    var line = function (key) { return s.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(2) + ' ' + y(p[key]).toFixed(2); }).join(''); };
    var raw = max / 3, pow = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), n = raw / pow;
    var step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
    var grid = '', ylab = '', xlab = '', longest = 0;
    for (var gv = step; gv <= max * 1.0001; gv += step) {
      var gy = y(gv).toFixed(2), label = F.money(gv);
      longest = Math.max(longest, label.length);
      grid += '<line x1="0" x2="100" y1="' + gy + '" y2="' + gy + '" class="dca-grid"/>';
      ylab += '<span class="dca-y" style="top:' + gy + '%">' + esc(label) + '</span>';
    }
    var years = [], seen = {};
    s.forEach(function (p, i) { var yr = p.k.slice(0, 4); if (p.k.slice(5) === '01' && !seen[yr]) { seen[yr] = 1; years.push({ i: i, y: yr }); } });
    var every = Math.ceil(years.length / 6) || 1;
    years.forEach(function (yv, j) {
      if (j % every || x(yv.i) > 94) return;
      xlab += '<span style="left:' + x(yv.i).toFixed(2) + '%"' + (yv.i === 0 ? ' class="dca-x0"' : '') + '>' + yv.y + '</span>';
    });
    var area = line('value') + 'L100 100L0 100Z';
    return '<figure class="dca-chart" style="--g:' + Math.round(longest * 6.3 + 12) + 'px"><div class="dca-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="' + esc(T.chart_aria) + '">' +
      grid + '<path d="' + area + '" class="dca-area"/><path d="' + line('invested') + '" class="dca-line-inv"/><path d="' + line('value') + '" class="dca-line-val"/>' +
      '</svg>' + ylab + '</div><div class="dca-x" aria-hidden="true">' + xlab + '</div>' +
      '<figcaption><span class="dca-key dca-key-val"></span>' + esc(T.leg_value) + ' <span class="dca-key dca-key-inv"></span>' + esc(T.leg_inv) + '</figcaption></figure>';
  }

  // Stat row + chart, laid out like the Stacking Strategist result panel. The value label carries its date.
  function results(m, T, F) {
    var stat = function (label, value, sub, cls) {
      return '<div class="dca-stat' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    };
    return '<div class="dca-stats">' +
      stat(T.r_invested, F.money(m.invested), fill(T.r_n, { n: m.n, a: F.money(m.amount) })) +
      stat(fill(T.r_value, { d: F.dayTo(m.asOf) }), F.money(m.value), fill(T.r_change, { p: F.pct(m.change) }), 'dca-main') +
      stat(T.r_btc, F.btc(m.btc), fill(T.r_avg, { p: F.money(m.avg) })) +
      '</div>' + chart(m, T, F) +
      '<p class="dca-lump">' + esc(fill(T.r_lump, { start: F.month(m.start) })) + ': <b>' + esc(F.money(m.lump)) + '</b> <span>' + esc(F.pct(m.lumpChange)) + '</span></p>';
  }

  function table(rows, T, F) {
    var asOf = rows.length ? rows[0].asOf : '';
    var heads = [T.t_start, T.r_invested, T.r_btc, fill(T.r_value, { d: asOf ? F.dayTo(asOf) : '' }), T.t_change];
    var body = rows.map(function (m) {
      var cells = [F.month(m.start), F.money(m.invested), F.btc(m.btc), F.money(m.value), F.pct(m.change)];
      return '<tr>' + cells.map(function (c, i) { return '<td data-label="' + esc(heads[i]) + '">' + esc(c) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="table-wrap"><table><thead><tr>' + heads.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function note(m, T, F) { return fill(T.note, { d: F.day(m.asOf) }); }
  // First sentence of the summary box (default plan, EUR).
  function summary(data, T, lang, locale) {
    var F = fmt(lang, locale, DEFAULTS.ccy), m = model(data, DEFAULTS.amount, DEFAULTS.start, DEFAULTS.ccy);
    return fill(T.ans, { a: F.money(m.amount), inv: F.money(m.invested), val: F.money(m.value), d: F.dayTo(m.asOf) });
  }

  // ------------------------------------------------------------------ browser
  function init() {
    var app = document.getElementById('dcaApp'), cfgEl = document.getElementById('dcaI18n');
    if (!app || !cfgEl) return;
    var cfg = JSON.parse(cfgEl.textContent), T = cfg.T, data = cfg.snap;
    var $ = function (id) { return document.getElementById(id); };
    var each = function (sel, fn, root) { Array.prototype.forEach.call((root || app).querySelectorAll(sel), fn); };
    var q = new URLSearchParams(location.search);
    var typed = function (v) { return Number(String(v).replace(/[^0-9]/g, '')); };
    var hasParams = q.has('amount') || q.has('start') || q.has('ccy');
    var st = {
      amount: q.has('amount') ? clampAmount(typed(q.get('amount'))) : DEFAULTS.amount,
      start: clampStart(data, q.get('start') || DEFAULTS.start),
      ccy: String(q.get('ccy') || '').toUpperCase() === 'USD' ? 'USD' : 'EUR'
    };
    var amountEl = $('dcaAmount'), amountR = $('dcaAmountR'), startR = $('dcaStartR'), msgEl = $('dcaMsg');
    var fillRange = function (el) { el.style.setProperty('--p', (100 * (el.value - el.min) / ((el.max - el.min) || 1)) + '%'); };
    var msg = '';
    var say = function (text) { msg = text || ''; if (msgEl) { msgEl.textContent = msg; msgEl.hidden = !msg; } };
    var monthName = function (k) { return fmt(cfg.lang, cfg.locale, st.ccy).month(k); };
    var amountMsg = function (v) { return v < AMOUNT_MIN ? T.msg_min : v > AMOUNT_MAX ? T.msg_max : ''; };
    // Start months after the last complete month are not offered; a start beyond it is clamped and said so.
    var setStart = function (k) {
      var end = lastFull(data);
      if (/^\d{4}-\d{2}$/.test(k || '') && k > end) { st.start = end; return fill(T.msg_last, { m: monthName(end) }); }
      st.start = clampStart(data, k);
      return '';
    };

    function paint(keepAmount) {
      st.start = clampStart(data, st.start);
      var F = fmt(cfg.lang, cfg.locale, st.ccy), m = model(data, st.amount, st.start, st.ccy), months = monthList(data), end = lastFull(data);
      $('dcaOut').innerHTML = results(m, T, F);
      $('dcaTable').innerHTML = table(byYear(data, st.amount, st.ccy), T, F);
      $('dcaNote').textContent = note(m, T, F);
      var ansP = document.querySelector('.answer p');
      if (ansP && T.ans && cfg.ansRest != null) ansP.textContent = summary(data, T, cfg.lang, cfg.locale) + cfg.ansRest;
      var a = F.money(st.amount);
      each('[data-dca-amt]', function (el) { el.textContent = a; });
      each('[data-dca-fee]', function (el) { el.textContent = F.money(st.amount * 12 * Number(el.getAttribute('data-dca-fee'))); });
      each('[data-dca-sym]', function (el) { el.textContent = st.ccy === 'USD' ? '$' : EURO; });
      if (!keepAmount) amountEl.value = st.amount;
      amountR.max = STEPS.length - 1; amountR.value = stepIndex(st.amount); fillRange(amountR);
      startR.max = months.length - 1; startR.value = Math.max(0, months.indexOf(st.start)); fillRange(startR);
      $('dcaStartV').textContent = F.month(st.start);
      var yearEl = $('dcaYear'), monthEl = $('dcaMonth'), endY = end.slice(0, 4), y;
      for (y = +yearEl.options[yearEl.options.length - 1].value + 1; y <= +endY; y++) yearEl.add(new Option(y, y));
      each('option', function (o) { o.hidden = o.disabled = o.value > endY; }, yearEl);
      yearEl.value = st.start.slice(0, 4);
      each('option', function (o) { o.hidden = o.disabled = yearEl.value === endY && o.value > end.slice(5); }, monthEl);
      monthEl.value = st.start.slice(5);
      each('[data-ccy]', function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-ccy') === st.ccy ? 'true' : 'false'); });
      // language links keep the plan
      var isDefault = st.amount === DEFAULTS.amount && st.start === DEFAULTS.start && st.ccy === DEFAULTS.ccy;
      each('a[hreflang]', function (l) { if (/dca/.test(l.pathname)) l.search = isDefault ? '' : query(); }, document);
    }
    function query() {
      var p = new URLSearchParams();
      p.set('amount', st.amount); p.set('start', st.start); p.set('ccy', st.ccy);
      return '?' + p.toString();
    }
    function changed(keepAmount) {
      paint(keepAmount);
      try { history.replaceState(null, '', location.pathname + query()); } catch (e) {}
    }

    amountEl.addEventListener('input', function () {
      var v = typed(this.value);
      if (v >= AMOUNT_MIN && v <= AMOUNT_MAX) { st.amount = v; say(''); changed(true); }
    });
    var settle = function () {
      var v = typed(amountEl.value);
      st.amount = clampAmount(v); say(amountMsg(v)); changed();
    };
    amountEl.addEventListener('change', settle);
    amountEl.addEventListener('blur', function () { if (amountEl.value !== String(st.amount)) settle(); });
    amountR.addEventListener('input', function () { st.amount = STEPS[+this.value]; say(''); changed(); });
    startR.addEventListener('input', function () { say(setStart(monthList(data)[+this.value])); changed(); });
    var pick = function () { say(setStart($('dcaYear').value + '-' + $('dcaMonth').value)); changed(); };
    $('dcaYear').addEventListener('change', pick);
    $('dcaMonth').addEventListener('change', pick);
    each('[data-ccy]', function (b) { b.addEventListener('click', function () { st.ccy = b.getAttribute('data-ccy'); changed(); }); });
    var share = $('dcaShare');
    if (share) share.addEventListener('click', function () {
      var link = location.origin + location.pathname + query() + '&utm_source=share&utm_medium=link&utm_campaign=tool_share_dca';
      var label = share.querySelector('span') || share;
      var done = function () {
        label.textContent = T.copied;
        setTimeout(function () { label.textContent = T.share; }, 2200);
        (window.dataLayer = window.dataLayer || []).push({ event: 'tool_share', tool: 'dca', page_lang: cfg.lang, share_method: 'copy' });
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { prompt(T.share, link); });
      else prompt(T.share, link);
    });

    // values from the address: say when one was clamped, and write the clean address back
    var first = [];
    if (q.has('amount')) first.push(amountMsg(typed(q.get('amount'))));
    if (q.has('start')) first.push(setStart(q.get('start')));
    say(first.filter(Boolean).join(' '));
    if (hasParams) changed(); else paint();

    // Site copy first, then GitHub. A file replaces the current data only when it holds a later
    // complete month, so a close inside a running month never changes the result.
    (function load(i) {
      if (i >= SOURCES.length) return;
      fetch(SOURCES[i], { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
        if (d && d.closes && d.eurusd && d.asOf && lastFull(d) > lastFull(data)) { data = d; paint(); }
      }).catch(function () {}).then(function () { load(i + 1); });
    })(0);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }

  return {
    MIN_START: MIN_START, DEFAULTS: DEFAULTS, AMOUNT_MIN: AMOUNT_MIN, AMOUNT_MAX: AMOUNT_MAX, STEPS: STEPS,
    stepIndex: stepIndex, monthList: monthList, lastFull: lastFull, lastDay: lastDay, clampAmount: clampAmount, clampStart: clampStart,
    model: model, byYear: byYear, fmt: fmt, results: results, table: table, note: note, summary: summary, fill: fill
  };
});
