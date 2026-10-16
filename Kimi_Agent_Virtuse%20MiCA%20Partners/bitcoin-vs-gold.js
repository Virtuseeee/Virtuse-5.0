/* Bitcoin vs gold, silver and commodities (bitcoin-vs-gold.html, 10 languages).
   Reads data/bitcoin-vs-commodities.json (GitHub raw first, then the local copy),
   re-renders the tables the builder pre-filled, draws the growth and BTC/gold charts
   (plain SVG) and switches USD/EUR (choice shared with asset-returns: vb-ar-ccy).
   Strings: #bvg-i18n ("c_*" keys), config: #bvg-cfg. */
(function () {
  'use strict';
  var I, CFG;
  try { I = JSON.parse(document.getElementById('bvg-i18n').textContent); CFG = JSON.parse(document.getElementById('bvg-cfg').textContent); } catch (e) { return; }
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LOC = CFG.locale, data = null, ccy = 'USD', sortKey = 'ytd', range = 10, on = {};
  CFG.on.forEach(function (k) { on[k] = true; });
  try { if (localStorage.getItem('vb-ar-ccy') === 'EUR') ccy = 'EUR'; } catch (e) {}

  // ----- formatting (Intl, page language) -----
  function nf(v, d) { return new Intl.NumberFormat(LOC, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(v); }
  function pct(v) { if (v == null) return '–'; var p = v * 100; return nf(p, Math.abs(p) < 100 ? 1 : 0) + (CFG.pctSpace ? ' %' : '%'); }
  function money(v, d) { var s = nf(v, d || 0), sym = ccy === 'USD' ? '$' : '€'; return CFG.lang === 'en' ? sym + s : s + ' ' + sym; }
  function dateStr(iso) { return new Date(iso + 'T00:00:00Z').toLocaleDateString(LOC, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  function tint(v) {
    if (v == null) return '';
    var k = Math.min(Math.abs(v) / 0.4, 1), a = (0.10 + 0.32 * k).toFixed(2);
    return 'background:rgba(' + (v >= 0 ? '46,160,90' : '210,60,60') + ',' + a + ');color:' + (v >= 0 ? '#b8f0c8' : '#ffc4c4');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var v = function (o, k) { return o ? o[ccy === 'USD' ? k : k.replace('usd', 'eur')] : null; };   // usd / eur, usdPa / eurPa

  // ----- tables -----
  function assetCell(a) {
    var sub = a.id === 'btc' ? 'BTC-USD' : I.c_via.replace('{t}', a.ticker);
    return '<td class="bvg-a"><b>' + esc(I['c_a_' + a.id]) + '</b><span>' + esc(sub) + '</span></td>';
  }
  function key(a, k) {
    if (k === 'price') return a.spot ? v(a.spot, 'usd') : -1;
    if (k === 'since') return v(a.cumulative, 'usd');
    if (/Pa$/.test(k)) return v(a.periods[k.slice(0, -2)], 'usdPa');
    return v(a.periods[k], 'usd');
  }
  function returnsTable() {
    var cols = [['ytd', I.c_col_ytd], ['y1', I.c_col_1y], ['y5', I.c_col_5y], ['y10', I.c_col_10y]];
    var h = '<thead><tr><th class="bvg-a">' + esc(I.c_col_asset) + '</th><th data-sort="price"' + (sortKey === 'price' ? ' class="on"' : '') + '>' + esc(I.c_col_price) + '</th>';
    cols.forEach(function (c) {
      h += '<th data-sort="' + c[0] + '"' + (sortKey === c[0] ? ' class="on"' : '') + '>' + esc(c[1]) + '</th>';
      if (c[0] === 'y5' || c[0] === 'y10') h += '<th data-sort="' + c[0] + 'Pa"' + (sortKey === c[0] + 'Pa' ? ' class="on"' : '') + '>' + esc(I.c_pa) + '</th>';
    });
    h += '<th data-sort="since"' + (sortKey === 'since' ? ' class="on"' : '') + '>' + esc(I.c_col_since) + '</th></tr></thead><tbody>';
    var rows = data.assets.slice().sort(function (a, b) { return (key(b, sortKey) == null ? -9 : key(b, sortKey)) - (key(a, sortKey) == null ? -9 : key(a, sortKey)); });
    rows.forEach(function (a) {
      h += '<tr class="' + (a.id === 'btc' ? 'bvg-btc' : '') + '">' + assetCell(a);
      if (a.spot) { var p = v(a.spot, 'usd'); h += '<td class="bvg-p">' + money(p, p < 100 ? 2 : 0) + esc(I['c_u_' + a.spot.unit] || '') + '</td>'; }
      else h += '<td class="bvg-p">–</td>';
      cols.forEach(function (c) {
        var p = a.periods[c[0]];
        h += '<td style="' + tint(v(p, 'usd')) + '">' + pct(v(p, 'usd')) + '</td>';
        if (c[0] === 'y5' || c[0] === 'y10') h += '<td class="bvg-pa">' + pct(v(p, 'usdPa')) + '</td>';
      });
      h += '<td style="' + tint(v(a.cumulative, 'usd')) + '">' + pct(v(a.cumulative, 'usd')) + '</td></tr>';
    });
    q('#bvgTable').innerHTML = h + '</tbody>';
    qa('#bvgTable th[data-sort]').forEach(function (th) { th.addEventListener('click', function () { sortKey = th.getAttribute('data-sort'); returnsTable(); }); });
  }
  function yearlyTable() {
    var ys = data.years, h = '<thead><tr><th class="bvg-a">' + esc(I.c_col_asset) + '</th>';
    ys.forEach(function (y) { h += '<th class="bvg-y">' + (y === data.ytdYear ? y + ' ' + esc(I.c_ytd_short) : y) + '</th>'; });
    h += '</tr></thead><tbody>';
    data.assets.forEach(function (a) {
      h += '<tr class="' + (a.id === 'btc' ? 'bvg-btc' : '') + '">' + assetCell(a);
      ys.forEach(function (y) { var r = v(a.annual[y], 'usd'); h += '<td style="' + tint(r) + '">' + pct(r) + '</td>'; });
      h += '</tr>';
    });
    h += '</tbody><tfoot>';
    [[I.c_best, 1], [I.c_worst, -1]].forEach(function (s) {
      h += '<tr><td class="bvg-a">' + esc(s[0]) + '</td>';
      ys.forEach(function (y) {
        var best = null;
        data.assets.forEach(function (a) { var r = v(a.annual[y], 'usd'); if (r != null && (best == null || r * s[1] > best.r * s[1])) best = { r: r, a: a }; });
        h += '<td>' + (best ? esc(I['c_a_' + best.a.id]) : '–') + '</td>';
      });
      h += '</tr>';
    });
    q('#bvgYears').innerHTML = h + '</tfoot>';
  }
  function ratioTable() {
    var g = data.ratio.gold.yearEnd, s = data.ratio.silver.yearEnd;
    var h = '<thead><tr><th class="bvg-a">' + esc(I.c_r_year) + '</th><th>' + esc(I.c_r_gold) + '</th><th>' + esc(I.c_r_silver) + '</th></tr></thead><tbody>';
    data.years.slice().reverse().forEach(function (y) {
      h += '<tr><td class="bvg-a">' + (y === data.ytdYear ? y + ' ' + esc(I.c_ytd_short) : y) + '</td><td>' + nf(g[y], 1) + '</td><td>' + nf(s[y], 0) + '</td></tr>';
    });
    q('#bvgRatioTable').innerHTML = h + '</tbody>';
  }
  function tiles() {
    var by = {}; data.assets.forEach(function (a) { by[a.id] = a; });
    var set = function (k, html) { var e = q('[data-k="' + k + '"] .bd-v'); if (e) e.innerHTML = html; };
    set('rgold', nf(data.ratio.gold.current, 1) + '<small>' + esc(I.c_oz) + '</small>');
    set('rsilver', nf(data.ratio.silver.current, 0) + '<small>' + esc(I.c_oz) + '</small>');
    if (by.btc && by.btc.spot) set('pbtc', money(v(by.btc.spot, 'usd')));
    if (by.gold && by.gold.spot) set('pgold', money(v(by.gold.spot, 'usd')) + '<small>' + esc(I.c_per_oz) + '</small>');
  }

  // ----- charts (SVG, log y, crosshair tooltip) -----
  function fmtTick(y) { return y >= 10000 ? new Intl.NumberFormat(LOC, { notation: 'compact', maximumFractionDigits: 1 }).format(y) : nf(y, y < 10 ? 1 : 0); }
  function niceLogTicks(lo, hi) {
    var t = [], e = Math.floor(Math.log10(lo));
    for (; e <= Math.ceil(Math.log10(hi)); e++) [1, 2, 5].forEach(function (m) { var x = m * Math.pow(10, e); if (x >= lo && x <= hi) t.push(x); });
    while (t.length > 7) t = t.filter(function (x, i) { return i % 2 === 0; });
    return t;
  }
  function xTicks(dates, plotW) {
    var out = [], seen = {}, n = dates.length, span = (new Date(dates[n - 1]) - new Date(dates[0])) / 864e5;
    dates.forEach(function (d, i) {
      var k = span > 1000 ? d.slice(0, 4) : d.slice(0, 7);
      if (!seen[k]) { seen[k] = 1; if (i > 0 || span <= 1000) out.push({ i: i, label: span > 1000 ? k : new Date(d + 'T00:00:00Z').toLocaleDateString(LOC, { month: 'short', timeZone: 'UTC' }) }); }
    });
    var max = Math.max(2, Math.floor(plotW / 46)), step = 1;          // ~46 px per label
    while (out.length / step > max) step++;
    return step === 1 ? out : out.filter(function (x, i) { return i % step === 0; });
  }
  // series: [{id, color, name, values[]}], dates[], fmt(value) for the tooltip
  function draw(svg, tip, dates, series, fmt, label) {
    var W = svg.clientWidth || 600, H = svg.clientHeight || 300, P = { l: 66, r: 16, t: 14, b: 28 };
    var lo = Infinity, hi = -Infinity;
    series.forEach(function (s) { s.values.forEach(function (y) { if (y != null && y > 0) { if (y < lo) lo = y; if (y > hi) hi = y; } }); });
    if (!isFinite(lo)) { svg.innerHTML = ''; return; }
    var ly0 = Math.log10(lo) - 0.03, ly1 = Math.log10(hi) + 0.03;
    var X = function (i) { return P.l + (W - P.l - P.r) * i / Math.max(1, dates.length - 1); };
    var Y = function (y) { return P.t + (H - P.t - P.b) * (1 - (Math.log10(y) - ly0) / (ly1 - ly0)); };
    var h = '';
    niceLogTicks(lo, hi).forEach(function (y) { h += '<line class="grid" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(y) + '" y2="' + Y(y) + '"/><text class="ax" x="' + (P.l - 8) + '" y="' + (Y(y) + 4) + '" text-anchor="end">' + fmtTick(y) + '</text>'; });
    xTicks(dates, W - P.l - P.r).forEach(function (t) { h += '<text class="ax" x="' + X(t.i) + '" y="' + (H - 8) + '" text-anchor="middle">' + t.label + '</text>'; });
    var labels = [];
    series.forEach(function (s) {
      var d = '', last = null;
      s.values.forEach(function (y, i) { if (y == null || y <= 0) return; d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(y).toFixed(1); last = [X(i), Y(y)]; });
      h += '<path class="ln" stroke="' + s.color + '" d="' + d + '"/>';
      if (last && series.length > 1) labels.push({ x: last[0] - 4, y: last[1] - 7, s: s });
    });
    // direct labels at the line ends, pushed apart so they never overlap (the legend names every line too)
    labels.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < labels.length; k++) if (labels[k].y - labels[k - 1].y < 13) labels[k].y = labels[k - 1].y + 13;
    labels.forEach(function (l) { h += '<text class="lbl" fill="' + l.s.color + '" x="' + l.x + '" y="' + Math.min(l.y, H - P.b - 2) + '" text-anchor="end">' + esc(l.s.name) + '</text>'; });
    h += '<g class="hover" style="display:none"><line class="xh" y1="' + P.t + '" y2="' + (H - P.b) + '"/>' + series.map(function (s) { return '<circle class="dot" r="4" fill="' + s.color + '"/>'; }).join('') + '</g>';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = h;
    var hover = q('.hover', svg), line = q('.xh', svg), dots = qa('.dot', svg), box = svg.parentNode;
    function move(ev) {
      var r = svg.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var i = Math.round((x - P.l) / (W - P.l - P.r) * (dates.length - 1)); i = Math.max(0, Math.min(dates.length - 1, i));
      hover.style.display = ''; line.setAttribute('x1', X(i)); line.setAttribute('x2', X(i));
      var t = '<b>' + dateStr(dates[i]) + '</b>';
      series.forEach(function (s, k) {
        var y = s.values[i]; if (y == null || y <= 0) { dots[k].style.display = 'none'; return; }
        dots[k].style.display = ''; dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(y));
        t += '<div><span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span><span>' + fmt(y) + '</span></div>';
      });
      tip.innerHTML = t; tip.style.display = 'block';
      var left = X(i) + 14; if (left + tip.offsetWidth > W) left = X(i) - tip.offsetWidth - 14;
      tip.style.left = (left + box.clientLeft + 10) + 'px'; tip.style.top = '16px';
    }
    function out() { hover.style.display = 'none'; tip.style.display = 'none'; }
    svg.onmousemove = move; svg.onmouseleave = out; svg.ontouchstart = move; svg.ontouchmove = move; svg.ontouchend = out;
  }
  function growthChart() {
    var g = range === 1 ? data.growth.daily : data.growth.weekly, n = g.dates.length, start = 0;
    if (range !== 10) {
      var from = new Date(data.asOf + 'T00:00:00Z'); from.setUTCFullYear(from.getUTCFullYear() - range);
      var f = from.toISOString().slice(0, 10);
      for (start = 0; start < n - 1 && g.dates[start] < f; start++) {}
    }
    var dates = g.dates.slice(start), fx0 = g.fx[start];
    var series = CFG.legend.filter(function (id) { return on[id]; }).map(function (id) {
      var base = g[id][start];
      return { id: id, color: CFG.colors[id], name: I['c_a_' + id], values: g[id].slice(start).map(function (x, i) {
        if (x == null || base == null) return null;
        var r = x / base; if (ccy === 'EUR') r = r * fx0 / g.fx[start + i];
        return CFG.amount * r;
      }) };
    });
    draw(q('#bvgGrowth'), q('#bvgTip1'), dates, series, function (y) { return money(y); });
  }
  function ratioChart() {
    var r = data.ratio.gold, step = Math.max(1, Math.floor(r.dates.length / 1200)), dates = [], vals = [];
    for (var i = 0; i < r.dates.length; i += step) { dates.push(r.dates[i]); vals.push(r.values[i]); }
    if ((r.dates.length - 1) % step) { dates.push(r.dates[r.dates.length - 1]); vals.push(r.values[r.values.length - 1]); }
    draw(q('#bvgRatio'), q('#bvgTip2'), dates, [{ id: 'gold', color: CFG.colors.btc, name: I.c_r_gold, values: vals }], function (y) { return nf(y, 1) + ' ' + I.c_oz; });
  }

  function render() {
    returnsTable(); yearlyTable(); ratioTable(); tiles(); growthChart(); ratioChart();
    q('#bvgAsOf').textContent = I.c_asof.replace('{d}', dateStr(data.asOf));
  }
  function setCcy(c) {
    ccy = c;
    qa('.bd-cur button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cur') === c); });
    try { localStorage.setItem('vb-ar-ccy', c); } catch (e) {}
    if (data) render();
  }
  qa('.bd-cur button').forEach(function (b) { b.addEventListener('click', function () { setCcy(b.getAttribute('data-cur')); }); });
  qa('#bvgRange .seg-btn').forEach(function (b) { b.addEventListener('click', function () {
    range = +b.getAttribute('data-r'); qa('#bvgRange .seg-btn').forEach(function (x) { x.classList.toggle('on', x === b); }); if (data) growthChart();
  }); });
  qa('#bvgLegend button').forEach(function (b) { b.addEventListener('click', function () {
    var id = b.getAttribute('data-id'); on[id] = !on[id]; b.setAttribute('aria-pressed', on[id] ? 'true' : 'false'); if (data) growthChart();
  }); });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (data) { growthChart(); ratioChart(); } }, 150); });

  function load(i) {
    var src = [CFG.raw, CFG.local];
    if (i >= src.length) { q('#bvgAsOf').textContent = I.c_unavailable; return; }
    fetch(src[i], { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (!d || !d.assets || !d.ratio) throw new Error('bad'); data = d; setCcy(ccy); })
      .catch(function () { load(i + 1); });
  }
  setCcy(ccy);
  load(0);
})();
