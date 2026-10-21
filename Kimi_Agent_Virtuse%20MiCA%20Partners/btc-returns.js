/* Bitcoin returns by month and by year: /bitcoin-returns/<month>/, /bitcoin-returns/<year>/
 * and the summary under the heatmap on btc-monthly-returns.html.
 *
 * One renderer for both sides. i18n-tools/btc-returns/build_returns.py runs it in Node to
 * write the static pages (crawlers and no-JS readers get real numbers); in the browser it
 * runs again on data/btc-monthly-returns.json (GitHub first, the site copy as fallback) and
 * re-renders every [data-vbr] block, so the pages stay current between builds.
 *
 * Same rules as the heatmap script in btc-monthly-returns.html, so the numbers match it:
 * a month's return runs from the previous month-end close to the month-end close
 * (CoinMetrics daily reference rate, USD); the current month (UTC) uses the latest close
 * and is left out of averages, medians, positive shares and ranks; a year runs from the
 * previous December close; 2010 starts with August. Highs, lows and max drawdowns come
 * from the daily closes (data.years, written by btc-monthly-build/build.mjs).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VBReturns = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SLUGS = MONTHS.map(function (m) { return m.toLowerCase(); });
  var BASE = '/bitcoin-returns/';
  var HUB = '/btc-monthly-returns.html';
  var SOURCES = [
    'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/btc-monthly-returns.json',
    '/data/btc-monthly-returns.json'
  ];
  var MIN_POINTS = 3;   // fewer complete data points: the page is noindex and not in the sitemap

  // ------------------------------------------------------------------ formatting
  function key(y, m) { return y + '-' + (m < 10 ? '0' : '') + m; }
  function group(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // Same as the heatmap: one decimal under 100 %, whole numbers above, U+2212 minus.
  function pct(v) {
    if (v == null) return '–';
    var p = v * 100, a = Math.abs(p);
    if (a < 0.05) return '0.0%';
    var s = a >= 1000 ? group(String(Math.round(a))) : a >= 100 ? String(Math.round(a)) : a.toFixed(1);
    return (p > 0 ? '+' : '−') + s + '%';
  }
  function pctAbs(v) { return pct(Math.abs(v)).replace('+', ''); }
  function share(k, n) { return Math.round(100 * k / n) + '%'; }
  function usd(v) {
    if (v == null) return '–';
    if (v >= 100) return '$' + group(String(Math.round(v)));
    return '$' + v.toFixed(v >= 1 ? 2 : 3);
  }
  function day(iso) {
    var p = iso.split('-');
    return (+p[2]) + ' ' + SHORT[+p[1] - 1] + ' ' + p[0];
  }
  function tint(v, cap) {
    if (v == null) return '';
    var k = Math.min(Math.abs(v) / cap, 1), a = (0.10 + 0.65 * k).toFixed(2);
    var c = v >= 0 ? '46,160,90' : '210,60,60';
    return ' style="background:rgba(' + c + ',' + a + ');color:' + (k > 0.55 ? '#fff' : v >= 0 ? '#b8f0c8' : '#ffc4c4') + '"';
  }
  function td(v, cap, cls) {
    return '<td class="vbr-r' + (cls ? ' ' + cls : '') + '"' + tint(v, cap || 0.3) + '>' + pct(v) + '</td>';
  }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : null; }
  function ordinal(n) { return n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); }
  function monthUrl(m) { return BASE + SLUGS[m - 1] + '/'; }
  function yearUrl(y) { return BASE + y + '/'; }

  // ------------------------------------------------------------------ model
  function model(data, now) {
    now = now || new Date();
    var cy = now.getUTCFullYear(), cm = now.getUTCMonth() + 1;
    var f = data.firstClose.month.split('-'), fy = +f[0];
    function close(y, m) { var v = data.closes[key(y, m)]; return v == null ? null : v; }
    function ret(y, m) {
      var a = m === 1 ? close(y - 1, 12) : close(y, m - 1), b = close(y, m);
      return a == null || b == null ? null : b / a - 1;
    }
    var M = { cy: cy, cm: cm, fy: fy, asOf: data.asOf, close: close, months: [], years: {}, yearList: [] };

    var allN = 0, allPos = 0;
    for (var m = 1; m <= 12; m++) {
      var list = [], cur = null;
      for (var y = fy; y <= cy; y++) {
        if (y === cy && m > cm) continue;
        var v = ret(y, m);
        if (v == null) continue;
        var row = { y: y, v: v, close: close(y, m) };
        if (y === cy && m === cm) cur = row; else list.push(row);
      }
      var vals = list.map(function (r) { return r.v; });
      var pos = vals.filter(function (x) { return x > 0; }).length;
      allN += vals.length; allPos += pos;
      var byV = list.slice().sort(function (a, b) { return b.v - a.v; });
      byV.forEach(function (r, i) { r.rank = i + 1; });
      M.months.push({ m: m, name: MONTHS[m - 1], slug: SLUGS[m - 1], list: list, cur: cur, n: vals.length, pos: pos,
        avg: mean(vals), med: median(vals), best: byV[0] || null, worst: byV[byV.length - 1] || null,
        first: list.length ? list[0].y : null, last: list.length ? list[list.length - 1].y : null });
    }
    M.allN = allN; M.allPos = allPos;
    function rankBy(k) {
      M.months.slice().filter(function (x) { return x[k] != null; })
        .sort(function (a, b) { return b[k] - a[k]; })
        .forEach(function (x, i) { x['rank_' + k] = i + 1; });
    }
    rankBy('avg'); rankBy('med');
    M.months.forEach(function (x) { x.share = x.n ? x.pos / x.n : null; });
    rankBy('share');

    // Last complete month (the one before the current month).
    M.lastY = cm === 1 ? cy - 1 : cy; M.lastM = cm === 1 ? 12 : cm - 1;

    for (y = fy + 1; y <= cy; y++) {
      var ytd = y === cy, endM = ytd ? cm : 12, mo = [], done = [];
      for (m = 1; m <= 12; m++) {
        if (ytd && m > cm) { mo.push({ m: m, v: null, future: true }); continue; }
        var r = { m: m, v: ret(y, m), close: close(y, m), cur: ytd && m === cm, prev: ret(y - 1, m) };
        mo.push(r);
        if (!r.cur && r.v != null) done.push(r);
      }
      var start = close(y - 1, 12), end = close(y, endM);
      var sorted = done.slice().sort(function (a, b) { return b.v - a.v; });
      var Y = { y: y, ytd: ytd, start: start, end: end, ret: start != null && end != null ? end / start - 1 : null, months: mo,
        n: done.length, pos: done.filter(function (r) { return r.v > 0; }).length,
        best: sorted[0] || null, worst: sorted[sorted.length - 1] || null, daily: (data.years || {})[y] || null };
      M.years[y] = Y;
      M.yearList.push(y);
    }
    // Full calendar years (the heatmap's Year column: no 2010, no running year).
    var full = M.yearList.filter(function (y) { return !M.years[y].ytd && M.years[y].ret != null; });
    full.slice().sort(function (a, b) { return M.years[b].ret - M.years[a].ret; })
      .forEach(function (y, i) { M.years[y].rank = i + 1; });
    M.fullYears = full;
    M.yearAvg = mean(full.map(function (y) { return M.years[y].ret; }));
    M.yearMed = median(full.map(function (y) { return M.years[y].ret; }));
    return M;
  }

  // ------------------------------------------------------------------ chart
  // Bar chart as inline SVG. items: [{label, v, title, cur}]; bars beyond +-cap are cut and
  // labelled with their value. Works the same in Node and in the browser.
  function bars(items, cap, aria) {
    var W = 720, H = 240, L = 70, R = 8, T = 22, B = 30;
    var vals = items.map(function (i) { return i.v; }).filter(function (v) { return v != null; });
    var hi = Math.min(Math.max.apply(null, vals.concat([0.1])), cap), lo = Math.max(Math.min.apply(null, vals.concat([-0.1])), -cap);
    var step = [0.05, 0.1, 0.25, 0.5, 1, 2, 5].filter(function (s) { return (hi - lo) / s <= 6; })[0] || 5;
    hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step;
    var y = function (v) { return T + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (H - T - B); };
    var bw = (W - L - R) / items.length;
    var s = '<svg class="vbr-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + aria + '">';
    for (var t = lo; t <= hi + 1e-9; t += step) {
      var ty = y(t).toFixed(1);
      s += '<line class="' + (Math.abs(t) < 1e-9 ? 'zero' : 'grid') + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + ty + '" y2="' + ty + '"/>';
      s += '<text class="ax" x="' + (L - 6) + '" y="' + (+ty + 4) + '" text-anchor="end">' + pct(t).replace('.0%', '%') + '</text>';
    }
    var z = y(0), every = items.length > 14 ? 2 : 1;
    items.forEach(function (it, i) {
      var cx = L + bw * i + bw / 2, w = Math.max(bw * 0.62, 2);
      if (i % every === 0 || i === items.length - 1) s += '<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + it.label + '</text>';
      if (it.v == null) return;
      var top = y(it.v), h = Math.max(Math.abs(top - z), 1), cut = Math.abs(it.v) > cap;
      s += '<rect class="' + (it.v >= 0 ? 'up' : 'dn') + (it.cur ? ' cur' : '') + '" x="' + (cx - w / 2).toFixed(1) + '" y="' + Math.min(top, z).toFixed(1) +
        '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"><title>' + it.title + '</title></rect>';
      if (cut) s += '<text class="cut" x="' + cx.toFixed(1) + '" y="' + (it.v > 0 ? top - 5 : top + 12).toFixed(1) + '" text-anchor="middle">' + pct(it.v) + '</text>';
    });
    return s + '</svg>';
  }

  function tile(label, value, sub) {
    return '<div class="bd-m"><span class="bd-l">' + label + '</span><b class="bd-v">' + value + '</b>' + (sub ? '<span class="vbr-sub">' + sub + '</span>' : '') + '</div>';
  }

  // ------------------------------------------------------------------ month page
  function renderMonth(M, m) {
    var X = M.months[m - 1], name = X.name;
    if (!X.n) return { html: '', indexable: false, n: 0 };
    var prevName = MONTHS[(m + 10) % 12], range = X.first + '–' + X.last;
    var html = '<div class="bd-macro vbr-tiles">' +
      tile('Average', pct(X.avg)) + tile('Median', pct(X.med)) +
      tile('Years higher', X.pos + '/' + X.n, share(X.pos, X.n) + ' of years') +
      tile('Best year', pct(X.best.v), X.best.y) + tile('Worst year', pct(X.worst.v), X.worst.y) + '</div>';

    // Observations, only what the numbers show.
    var allShare = M.allPos / M.allN, sh = X.pos / X.n, obs = [];
    obs.push(name + ' closed higher in ' + X.pos + ' of ' + X.n + ' years (' + range + '), ' +
      (sh > allShare + 0.05 ? 'more often than' : sh < allShare - 0.05 ? 'less often than' : 'about as often as') +
      ' the average month (' + share(M.allPos, M.allN) + ' of all months since August 2010).');
    var gap = X.avg - X.med;
    if (gap >= 0.1) obs.push('The average of ' + pct(X.avg) + ' is lifted by ' + X.best.y + ' (' + pct(X.best.v) + '); the median of ' + pct(X.med) + ' is closer to a typical ' + name + '.');
    else if (gap <= -0.1) obs.push('The average of ' + pct(X.avg) + ' is pulled down by ' + X.worst.y + ' (' + pct(X.worst.v) + '); the median of ' + pct(X.med) + ' is closer to a typical ' + name + '.');
    else obs.push('The average (' + pct(X.avg) + ') and the median (' + pct(X.med) + ') are close, so no single year dominates.');
    var rm = X.rank_med, ra = X.rank_avg;
    obs.push(rm === 1 ? 'By median it is the strongest of the 12 months' + (ra === 1 ? ', and by average too.' : '; by average it ranks ' + ordinal(ra) + '.') :
      rm === 12 ? 'By median it is the weakest of the 12 months' + (ra === 12 ? ', and by average too.' : '; by average it ranks ' + ordinal(ra) + '.') :
      'By median it ranks ' + ordinal(rm) + ' of the 12 months, by average ' + ordinal(ra) + '.');
    var k = 0, L = X.list, sign = L[L.length - 1].v > 0;
    for (var i = L.length - 1; i >= 0 && (L[i].v > 0) === sign; i--) k++;
    if (k >= 3) obs.push('It has been ' + (sign ? 'positive' : 'negative') + ' in each of the last ' + k + ' years (' + L[L.length - k].y + '–' + L[L.length - 1].y + ').');
    else obs.push('Last time, in ' + L[L.length - 1].y + ', it returned ' + pct(L[L.length - 1].v) + '.');
    html += '<p class="vbr-obs">' + obs.join(' ') + '</p>';
    if (X.cur) html += '<p class="vbr-note">' + name + ' ' + X.cur.y + ' is still running: ' + pct(X.cur.v) + ' so far (latest close ' + day(M.asOf) + '), not included in the figures above.</p>';

    // Chart: every year, oldest first.
    var items = X.list.map(function (r) { return { label: "'" + String(r.y).slice(2), v: r.v, title: name + ' ' + r.y + ': ' + pct(r.v) }; });
    if (X.cur) items.push({ label: "'" + String(X.cur.y).slice(2), v: X.cur.v, cur: true, title: name + ' ' + X.cur.y + ' (so far): ' + pct(X.cur.v) });
    html += '<div class="vbr-chartbox">' + bars(items, 1, 'Bitcoin return in ' + name + ', each year ' + range) + '</div>';

    // Year by year, newest first.
    var rows = '';
    if (X.cur) rows += '<tr class="vbr-cur"><td class="vbr-a"><a href="' + yearUrl(X.cur.y) + '">' + X.cur.y + '</a> <span>so far</span></td>' + td(X.cur.v) + '<td>' + usd(X.cur.close) + '</td><td>–</td></tr>';
    X.list.slice().reverse().forEach(function (r) {
      var lab = r.y > M.fy ? '<a href="' + yearUrl(r.y) + '">' + r.y + '</a>' : r.y;
      rows += '<tr><td class="vbr-a">' + lab + '</td>' + td(r.v) + '<td>' + usd(r.close) + '</td><td>' + r.rank + '</td></tr>';
    });
    html += '<h2 class="vbr-h">' + name + ' <span>year by year</span></h2>' +
      '<div class="vbr-wrap"><table class="vbr-table"><thead><tr><th class="vbr-a">Year</th><th>Return</th><th>Close, end of ' + SHORT[m - 1] + '</th><th>Rank</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="vbr-note">Return from the last close of ' + prevName + ' to the last close of ' + name + '. Rank 1 = best of ' + X.n + ' years.</p>';

    // Against the other months.
    var t = '';
    M.months.slice().sort(function (a, b) { return b.avg - a.avg; }).forEach(function (o) {
      var me = o.m === m;
      t += '<tr' + (me ? ' class="vbr-me"' : '') + '><td>' + o.rank_avg + '</td><td class="vbr-a">' + (me ? '<b>' + o.name + '</b>' : '<a href="' + monthUrl(o.m) + '">' + o.name + '</a>') + '</td>' +
        td(o.avg) + td(o.med) + '<td>' + o.pos + '/' + o.n + '</td></tr>';
    });
    html += '<h2 class="vbr-h">' + name + ' <span>against the other months</span></h2>' +
      '<div class="vbr-wrap"><table class="vbr-table"><thead><tr><th>Rank</th><th class="vbr-a">Month</th><th>Average</th><th>Median</th><th>Higher</th></tr></thead><tbody>' + t + '</tbody></table></div>' +
      '<p class="vbr-note">Sorted by average return. ' + name + ' ranks ' + ordinal(ra) + ' by average and ' + ordinal(rm) + ' by median. Complete months only.</p>';

    html += '<p class="vbr-pn"><a href="' + monthUrl((m + 10) % 12 + 1) + '">← ' + prevName + '</a><a href="' + HUB + '">All months (heatmap)</a><a href="' + monthUrl(m % 12 + 1) + '">' + MONTHS[m % 12] + ' →</a></p>';

    var title = 'Bitcoin Returns in ' + name + ' (' + range + ') | Virtuse';
    var desc = 'Bitcoin closed ' + name + ' higher in ' + X.pos + ' of ' + X.n + ' years (' + range + '). Average ' + pct(X.avg) + ', median ' + pct(X.med) +
      ', best ' + X.best.y + ' (' + pct(X.best.v) + '), worst ' + X.worst.y + ' (' + pct(X.worst.v) + ').';
    if (desc.length > 155) desc = desc.replace(/, best .*$/, '. Year by year, updated daily.');
    return { html: html, title: title, desc: desc, h1: name, range: range, n: X.n, indexable: X.n >= MIN_POINTS,
      first: X.first, last: X.last, slug: X.slug, name: name };
  }

  // ------------------------------------------------------------------ year page
  function renderYear(M, y) {
    var Y = M.years[y];
    if (!Y) return { html: '', indexable: false, n: 0 };
    var label = y + (Y.ytd ? ' YTD' : ''), D = Y.daily;
    var endLabel = Y.ytd ? 'Latest close (' + day(M.asOf) + ')' : 'End of ' + y;
    var html = '<div class="bd-macro vbr-tiles">' +
      tile(Y.ytd ? 'Return so far' : 'Return ' + y, pct(Y.ret)) +
      tile('End of ' + (y - 1), usd(Y.start)) + tile(endLabel, usd(Y.end)) +
      tile('Max drawdown', D ? pct(D.dd) : '–', D && D.ddT ? 'to ' + day(D.ddT) : '') +
      tile('Months higher', Y.pos + '/' + Y.n, Y.ytd ? 'complete months' : '') + '</div>';

    var obs = [];
    if (Y.ytd) obs.push('So far in ' + y + ' (to ' + day(M.asOf) + '), Bitcoin is ' + (Y.ret >= 0 ? 'up ' : 'down ') + pctAbs(Y.ret) + ', from ' + usd(Y.start) + ' at the end of ' + (y - 1) + ' to ' + usd(Y.end) + '.');
    else obs.push('Bitcoin ' + (Y.ret >= 0 ? 'rose ' : 'fell ') + pctAbs(Y.ret) + ' in ' + y + ', from ' + usd(Y.start) + ' at the end of ' + (y - 1) + ' to ' + usd(Y.end) + ' at the end of ' + y + '.');
    if (Y.n) obs.push(Y.pos + ' of ' + Y.n + (Y.ytd ? ' complete' : '') + ' months closed higher; the best was ' + MONTHS[Y.best.m - 1] + ' (' + pct(Y.best.v) + '), the worst ' + MONTHS[Y.worst.m - 1] + ' (' + pct(Y.worst.v) + ').');
    if (D) {
      var from = D.ddP && D.ddP.slice(0, 4) === String(y) ? 'the high of ' + day(D.ddP) : 'the start of the year';
      obs.push(D.ddT ? 'The deepest fall during the year was ' + pct(D.dd) + ', from ' + from + ' to ' + day(D.ddT) + '; the highest close was ' + usd(D.hi) + ' on ' + day(D.hiD) + '.' :
        'Bitcoin never closed below its start-of-year level; the highest close was ' + usd(D.hi) + ' on ' + day(D.hiD) + '.');
    }
    var P = M.years[y - 1];
    if (!Y.ytd) {
      obs.push('That ranks ' + ordinal(Y.rank) + ' of ' + M.fullYears.length + ' full years since ' + M.fullYears[0] + (P && !P.ytd && P.ret != null ? ', after ' + pct(P.ret) + ' in ' + (y - 1) + '.' : '.'));
    } else if (P && Y.n) {
      var lm = Y.n, a = M.close(y - 2, 12), b = M.close(y - 1, lm), c = M.close(y, lm);
      if (a != null && b != null && c != null) obs.push('Over the same months (' + (lm === 1 ? 'January' : 'January–' + MONTHS[lm - 1]) + '), ' + y + ' returned ' + pct(c / Y.start - 1) + ' against ' + pct(b / a - 1) + ' in ' + (y - 1) + '.');
    }
    html += '<p class="vbr-obs">' + obs.join(' ') + '</p>';
    if (Y.ytd) html += '<p class="vbr-note">' + y + ' is still running: the year-to-date figures use the latest daily close (' + day(M.asOf) + '), and ' + MONTHS[M.cm - 1] + ' is not counted as a complete month.</p>';

    var items = Y.months.map(function (r) { return { label: SHORT[r.m - 1], v: r.future ? null : r.v, cur: r.cur, title: SHORT[r.m - 1] + ' ' + y + (r.cur ? ' (so far)' : '') + ': ' + pct(r.v) }; });
    html += '<div class="vbr-chartbox">' + bars(items, 1, 'Bitcoin return in each month of ' + y) + '</div>';

    var rows = '';
    Y.months.forEach(function (r) {
      var nm = '<a href="' + monthUrl(r.m) + '">' + MONTHS[r.m - 1] + '</a>';
      if (r.future) { rows += '<tr class="vbr-fut"><td class="vbr-a">' + nm + '</td><td>–</td><td>–</td>' + td(r.prev) + '</tr>'; return; }
      rows += '<tr' + (r.cur ? ' class="vbr-cur"' : '') + '><td class="vbr-a">' + nm + (r.cur ? ' <span>so far</span>' : '') + '</td>' + td(r.v) + '<td>' + usd(r.close) + '</td>' + td(r.prev) + '</tr>';
    });
    rows += '<tr class="vbr-tot"><td class="vbr-a">' + (Y.ytd ? 'Year to date' : 'Year') + '</td>' + td(Y.ret, 1.5) + '<td>' + usd(Y.end) + '</td>' + td(P ? (P.ytd ? null : P.ret) : null, 1.5) + '</tr>';
    html += '<h2 class="vbr-h">' + label + ' <span>month by month</span></h2>' +
      '<div class="vbr-wrap"><table class="vbr-table"><thead><tr><th class="vbr-a">Month</th><th>' + y + '</th><th>Month-end close</th><th>' + (y - 1) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="vbr-note">Each month runs from the previous month-end close to its own; the year from the close of ' + (y - 1) + '. ' +
      (D ? 'Lowest close in ' + y + ': ' + usd(D.lo) + ' on ' + day(D.loD) + '. Max drawdown uses daily closes.' : '') + '</p>';

    var pn = '<p class="vbr-pn">' + (M.years[y - 1] ? '<a href="' + yearUrl(y - 1) + '">← ' + (y - 1) + '</a>' : '<span></span>') +
      '<a href="' + HUB + '">All years (heatmap)</a>' + (M.years[y + 1] ? '<a href="' + yearUrl(y + 1) + '">' + (y + 1) + (M.years[y + 1].ytd ? ' YTD' : '') + ' →</a>' : '<span></span>') + '</p>';
    html += pn;

    var title = Y.ytd ? 'Bitcoin Returns ' + y + ' YTD: Month-by-Month | Virtuse' : 'Bitcoin Returns ' + y + ': Month-by-Month Performance | Virtuse';
    var desc = (Y.ytd ? 'Bitcoin ' + y + ' so far: ' : 'Bitcoin in ' + y + ': ') + pct(Y.ret) + ', from ' + usd(Y.start) + ' to ' + usd(Y.end) + '. ' +
      Y.pos + ' of ' + Y.n + ' months higher' + (Y.best ? ', best ' + MONTHS[Y.best.m - 1] + ' (' + pct(Y.best.v) + ')' : '') +
      (D ? ', max drawdown ' + pct(D.dd) : '') + '.';
    if (desc.length > 155) desc = desc.replace(/, max drawdown [^.]*\./, '.');
    return { html: html, title: title, desc: desc, label: label, n: Y.n, indexable: Y.n >= MIN_POINTS, ytd: Y.ytd, y: y };
  }

  // ------------------------------------------------------------------ hub block
  function renderHub(M) {
    var by = function (k, dir) { return M.months.slice().sort(function (a, b) { return dir * (b[k] - a[k]); })[0]; };
    var bm = by('med', 1), wm = by('med', -1), ba = by('avg', 1), wa = by('avg', -1), bs = by('share', 1), ws = by('share', -1);
    var thru = MONTHS[M.lastM - 1] + ' ' + M.lastY;
    var html = '<div class="sec-head one"><div class="sec-copy"><h2>Best and worst months <span>for Bitcoin</span></h2></div></div>' +
      '<div class="bd-macro vbr-tiles">' +
      tile('Strongest month (median)', '<a href="' + monthUrl(bm.m) + '">' + bm.name + '</a>', pct(bm.med) + ' · higher ' + bm.pos + '/' + bm.n) +
      tile('Weakest month (median)', '<a href="' + monthUrl(wm.m) + '">' + wm.name + '</a>', pct(wm.med) + ' · higher ' + wm.pos + '/' + wm.n) +
      tile('Best average', '<a href="' + monthUrl(ba.m) + '">' + ba.name + '</a>', pct(ba.avg) + ' a month on average') +
      tile('Months closed higher', share(M.allPos, M.allN), M.allPos + ' of ' + M.allN + ' since Aug 2010') + '</div>' +
      '<p class="vbr-obs">By median, ' + bm.name + ' has been Bitcoin\'s strongest month (' + pct(bm.med) + ') and ' + wm.name + ' its weakest (' + pct(wm.med) + '). ' +
      'By average, ' + ba.name + ' leads (' + pct(ba.avg) + ')' + (ba.m !== bm.m ? ', lifted by ' + ba.best.y + ' (' + pct(ba.best.v) + ')' : '') + ', and ' + wa.name + ' trails (' + pct(wa.avg) + '). ' +
      bs.name + ' closed higher most often (' + bs.pos + ' of ' + bs.n + ' years), ' + ws.name + ' least often (' + ws.pos + ' of ' + ws.n + '). Complete months through ' + thru + '.</p>';
    var cards = M.months.map(function (o) {
      return '<a class="vbr-card" href="' + monthUrl(o.m) + '"><b>' + o.name + '</b><span>Median ' + pct(o.med) + ' · higher ' + o.pos + '/' + o.n + '</span></a>';
    }).join('');
    html += '<h3 class="vbr-h3">Bitcoin returns by month</h3><div class="vbr-cards">' + cards + '</div>';
    var ys = M.yearList.slice().reverse().map(function (y) {
      var Y = M.years[y];
      return '<a class="vbr-card vbr-yc" href="' + yearUrl(y) + '"><b>' + y + (Y.ytd ? ' YTD' : '') + '</b><span' + (Y.ret >= 0 ? ' class="pos"' : ' class="neg"') + '>' + pct(Y.ret) + '</span></a>';
    }).join('');
    html += '<h3 class="vbr-h3">Bitcoin returns by year</h3><div class="vbr-cards vbr-years">' + ys + '</div>';
    var faq = [
      ['What is the best month for Bitcoin?',
        'By median return, ' + bm.name + ' has been the strongest month (' + pct(bm.med) + ', higher in ' + bm.pos + ' of ' + bm.n + ' years). By average, ' + ba.name + ' leads with ' + pct(ba.avg) +
        (ba.m !== bm.m ? ', mostly because of ' + ba.best.y + ' (' + pct(ba.best.v) + ')' : '') + '. Complete months through ' + thru + '.'],
      ['What is the worst month for Bitcoin?',
        'By median return, ' + wm.name + ' has been the weakest month (' + pct(wm.med) + ', higher in ' + wm.pos + ' of ' + wm.n + ' years). By average, ' + wa.name + ' is last with ' + pct(wa.avg) + '. Complete months through ' + thru + '.'],
      ['How often does Bitcoin finish a month higher?',
        'Of the ' + M.allN + ' complete months from August 2010 to ' + thru + ', Bitcoin closed higher in ' + M.allPos + ' (' + share(M.allPos, M.allN) + '). ' +
        bs.name + ' was up most often (' + bs.pos + ' of ' + bs.n + ' years), ' + ws.name + ' least often (' + ws.pos + ' of ' + ws.n + ').'],
      ['How are the monthly returns calculated?',
        'From the last daily close of the previous month to the last daily close of the month, using CoinMetrics\' Bitcoin reference rate in US dollars. The EUR view divides by the ECB EUR/USD rate at each month end. The running month uses the latest price and is left out of the averages.'],
      ['How often is the data updated?',
        'Every day. The heatmap and the month and year pages read the same data file, rebuilt daily from CoinMetrics and the ECB. Past returns do not predict future returns. This is not investment advice.']
    ];
    return { html: html, faq: faq, thru: thru };
  }

  // ------------------------------------------------------------------ browser refresh
  function auto() {
    var els = [].slice.call(document.querySelectorAll('[data-vbr]'));
    if (!els.length || !window.fetch) return;
    (function next(i) {
      if (i >= SOURCES.length) return;
      fetch(SOURCES[i], { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          if (!d || !d.closes || !d.years) throw new Error('old data');   // before build.mjs wrote years: try the next source
          var M = model(d);
          els.forEach(function (el) {
            if (d.asOf < (el.getAttribute('data-asof') || '')) return;    // older than the page itself
            var s = el.getAttribute('data-vbr').split(':');
            var out = s[0] === 'month' ? renderMonth(M, +s[1]) : s[0] === 'year' ? renderYear(M, +s[1]) : renderHub(M);
            if (out.html) { el.innerHTML = out.html; el.setAttribute('data-asof', d.asOf); }
          });
        })
        .catch(function () { next(i + 1); });
    })(0);
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  }

  return { model: model, renderMonth: renderMonth, renderYear: renderYear, renderHub: renderHub, pct: pct, usd: usd, day: day,
    MONTHS: MONTHS, SLUGS: SLUGS, BASE: BASE, HUB: HUB, MIN_POINTS: MIN_POINTS };
});
