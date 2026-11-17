/* Funds vs Bitcoin (funds-vs-bitcoin.html, sk/fondy-vs-bitcoin.html).
   Re-renders the table from /data/funds-vs-bitcoin.json and adds filters, user sorting,
   nominal / after-inflation returns and the growth chart. Default order is neutral
   (company, type, name, as in the data file); there is no ranking and no verdict colour.
   Built pages: i18n-tools/funds-vs-bitcoin/build_fvb.py. */
(function () {
  'use strict';
  var T = JSON.parse(document.getElementById('fvb-i18n').textContent);
  var CFG = JSON.parse(document.getElementById('fvb-cfg').textContent);
  var D = null;
  var S = { type: 'all', company: '', mode: 'nominal', key: null, dir: 1, range: 10 };
  var $ = function (id) { return document.getElementById(id); };

  function nf(v, d) {
    return v.toLocaleString(CFG.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(v) { return nf(v * 100, 1) + (CFG.pctSpace ? ' %' : '%'); }
  function eur(v) { var s = nf(v, 0); return CFG.lang === 'en' ? '€' + s : s + ' €'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function val(o) { return o && o.value != null ? o.value : null; }
  function na(o) { return '<abbr title="' + esc((o && o.reason) || '') + '">' + T.c_na + '</abbr>'; }
  function cell(o) { return '<td>' + (val(o) == null ? na(o) : pct(o.value)) + '</td>'; }
  function feeCell(f) {
    var cap = f.managementFeeCap, why = esc((f.managementFee && f.managementFee.reason) || '');
    if (val(cap) == null) return '<td><abbr title="' + why + '">' + T.c_na + '</abbr></td>';
    return '<td><abbr title="' + why + '">' + T.c_fee_cap.replace('{v}', pct(cap.value)) + '</abbr></td>';
  }
  function ret(f, y) { return f[(S.mode === 'real' ? 'real' : 'return') + y + 'y']; }

  function row(f, btc) {
    var h = '<tr' + (btc ? '' : ' data-id="' + f.id + '"') + '><td class="fvb-f"><b>' + (btc ? 'Bitcoin' : esc(f.name)) + '</b><span>' +
      (btc ? T.c_btc_sub : esc(f.company)) + '</span></td><td class="fvb-t">' + T['type_' + (btc ? 'bitcoin' : f.type)] + '</td>';
    [1, 5, 10].forEach(function (y) { h += cell(ret(f, y)); });
    return h + cell(f.maxDrawdown10y) + cell(f.volatility10y) + feeCell(f) + '</tr>';
  }

  function sortVal(f, k) {
    switch (k) {
      case 'name': return f.name.toLowerCase();
      case 'type': return T['type_' + f.type];
      case 'r1': return val(ret(f, 1));
      case 'r5': return val(ret(f, 5));
      case 'r10': return val(ret(f, 10));
      case 'dd': return val(f.maxDrawdown10y);
      case 'vol': return val(f.volatility10y);
      case 'fee': return val(f.managementFeeCap);
    }
    return null;
  }

  function visible() {
    return D.funds.filter(function (f) {
      return (S.type === 'all' || f.type === S.type) && (!S.company || f.company === S.company);
    });
  }

  function renderTable() {
    var list = visible().slice();
    if (S.key) {
      list.sort(function (a, b) {
        var x = sortVal(a, S.key), y = sortVal(b, S.key);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * S.dir;
      });
    }
    document.querySelector('#fvbTable tbody.fvb-ref').innerHTML = row(D.bitcoin, true);
    $('fvbRows').innerHTML = list.map(function (f) { return row(f, false); }).join('');
    $('fvbCount').textContent = T.c_count.replace('{n}', list.length).replace('{t}', D.funds.length);
    document.querySelectorAll('#fvbTable thead th').forEach(function (th) {
      if (th.dataset.k === S.key) th.setAttribute('aria-sort', S.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    renderChart();
  }

  /* ---------------- chart ---------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }

  function renderChart() {
    var svg = $('fvbChart'), tip = $('fvbTip');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    tip.style.display = 'none';
    var weeks = D.weeks, end = weeks[weeks.length - 1];
    var start = (+end.slice(0, 4) - S.range) + end.slice(4);
    var i0 = 0; while (i0 < weeks.length && weeks[i0] < start) i0++;
    var dates = weeks.slice(i0);
    var log = S.range > 1;
    $('fvbScale').textContent = log ? T.ch_log : T.ch_lin;
    function series(arr) {
      var s = arr.slice(i0);
      if (s.some(function (v) { return v == null; })) return null;
      return s.map(function (v) { return CFG.amount * v / s[0]; });
    }
    var lines = [];
    visible().forEach(function (f) { var s = series(f.weekly); if (s) lines.push({ name: f.name, s: s, btc: false }); });
    var bs = series(D.bitcoin.weekly);
    if (bs) lines.push({ name: 'Bitcoin', s: bs, btc: true });
    var W = svg.clientWidth || 800, H = svg.clientHeight || 360, L = 64, R = 12, Tp = 10, Bt = 26;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var lo = Infinity, hi = -Infinity;
    lines.forEach(function (l) { l.s.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
    if (!isFinite(lo)) return;
    var f = log ? Math.log : function (v) { return v; };
    var ylo = f(lo * 0.95), yhi = f(hi * 1.05);
    var X = function (i) { return L + (W - L - R) * i / (dates.length - 1); };
    var Y = function (v) { return Tp + (H - Tp - Bt) * (1 - (f(v) - ylo) / (yhi - ylo)); };
    // y ticks
    var ticks = [];
    if (log) {
      [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6].forEach(function (v) { if (v >= lo * 0.95 && v <= hi * 1.05) ticks.push(v); });
    } else {
      var step = Math.pow(10, Math.floor(Math.log10((hi - lo) || 1))) / 2, v = Math.ceil(lo / step) * step;
      for (; v <= hi; v += step) ticks.push(v);
      if (ticks.length > 7) ticks = ticks.filter(function (_, i) { return i % 2 === 0; });
    }
    ticks.forEach(function (v) {
      var y = Y(v);
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'grid' }));
      var tx = el('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ax' }); tx.textContent = eur(v); svg.appendChild(tx);
    });
    // x ticks: years (or quarters for 1y)
    var lastLab = null;
    dates.forEach(function (d, i) {
      var lab = S.range === 1 ? d.slice(0, 7) : d.slice(0, 4);
      if (lab === lastLab) return;
      if (S.range === 1 && ['01', '04', '07', '10'].indexOf(d.slice(5, 7)) < 0) { lastLab = lab; return; }
      lastLab = lab;
      if (i === 0) return;
      var tx = el('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', 'class': 'ax' }); tx.textContent = S.range === 1 ? d.slice(5, 7) + '/' + d.slice(2, 4) : lab;
      svg.appendChild(tx);
    });
    var paths = [];
    lines.forEach(function (l) {
      var p = l.s.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
      var path = el('path', { d: p, 'class': 'ln ' + (l.btc ? 'btc' : 'fund') });
      svg.appendChild(path); paths.push(path);
    });
    // keep Bitcoin on top
    if (bs) svg.appendChild(paths[paths.length - 1]);
    var xh = el('line', { 'class': 'xh', y1: Tp, y2: H - Bt, x1: -10, x2: -10 }); svg.appendChild(xh);
    if (!lines.some(function (l) { return !l.btc; })) {
      var nt = el('text', { x: L + 8, y: Tp + 16, 'class': 'ax' }); nt.textContent = T.c_no_funds; svg.appendChild(nt);
    }
    function move(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left,
        py = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
      var sx = px * W / r.width, sy = py * H / r.height;
      var i = Math.round((sx - L) / (W - L - R) * (dates.length - 1));
      if (i < 0 || i >= dates.length) { tip.style.display = 'none'; return; }
      var near = -1, best = Infinity;
      lines.forEach(function (l, k) { if (l.btc) return; var dy = Math.abs(Y(l.s[i]) - sy); if (dy < best) { best = dy; near = k; } });
      paths.forEach(function (p, k) { p.classList.toggle('hi', k === near); });
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i));
      var h = '<b>' + dates[i] + '</b>';
      if (bs) h += '<div><span>Bitcoin</span><span>' + eur(bs[i]) + '</span></div>';
      if (near >= 0) h += '<div><span>' + esc(lines[near].name) + '</span><span>' + eur(lines[near].s[i]) + '</span></div>';
      tip.innerHTML = h; tip.style.display = 'block';
      var tw = tip.offsetWidth, left = px + 14; if (left + tw > r.width) left = px - tw - 14;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, py - 20) + 'px';
    }
    svg.onmousemove = move; svg.ontouchstart = move; svg.ontouchmove = move;
    svg.onmouseleave = function () { tip.style.display = 'none'; paths.forEach(function (p) { p.classList.remove('hi'); }); xh.setAttribute('x1', -10); xh.setAttribute('x2', -10); };
  }

  /* ---------------- controls ---------------- */
  function press(group, attr, v) {
    group.querySelectorAll('button').forEach(function (b) {
      var on = b.getAttribute(attr) === String(v);
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function wire() {
    $('fvbCtrl').classList.remove('fvb-wait');   // space is reserved in the HTML (no layout shift)
    $('fvbType').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.type = b.dataset.type; press($('fvbType'), 'data-type', S.type); renderTable();
    });
    $('fvbCompany').addEventListener('change', function (e) { S.company = e.target.value; renderTable(); });
    $('fvbMode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.mode = b.dataset.mode; press($('fvbMode'), 'data-mode', S.mode); renderTable();
    });
    $('fvbReset').addEventListener('click', function () { S.key = null; S.dir = 1; renderTable(); });
    document.querySelectorAll('#fvbTable thead th').forEach(function (th) {
      th.querySelector('button').addEventListener('click', function () {
        var k = th.dataset.k;
        if (S.key === k) S.dir = -S.dir; else { S.key = k; S.dir = (k === 'name' || k === 'type') ? 1 : -1; }
        renderTable();
      });
    });
    $('fvbRange').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.range = +b.dataset.r; press($('fvbRange'), 'data-r', S.range); renderChart();
    });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(renderChart, 150); });
  }

  /* ---------------- phase 2: mutual funds and ETFs ---------------- */
  var P = { type: 'all', mode: 'nominal', key: null, dir: 1 };
  function dateStr(iso) {
    var p = iso.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString(CFG.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');
  }
  function cell2(o) { return '<td>' + (val(o) == null ? na(o) : nf(o.value * 100, 2) + (CFG.pctSpace ? ' %' : '%')) + '</td>'; }
  function ret2(f, y) { return f[(P.mode === 'real' ? 'real' : 'return') + y + 'y']; }
  function p2ref() {
    var c = {}, best = null;
    D.investmentFunds.funds.forEach(function (f) { c[f.asOf] = (c[f.asOf] || 0) + 1; });
    Object.keys(c).forEach(function (d) { if (!best || c[d] > c[best] || (c[d] === c[best] && d > best)) best = d; });
    return best;
  }
  function row2(f) {
    if (!f) {
      var d = p2ref(), b = D.investmentFunds.bitcoin[d], nb = '<td><abbr title="' + esc(T.p2_btc_cost) + '">' + T.c_na + '</abbr></td>';
      var h = '<tr><td class="fvb-f"><b>Bitcoin</b><span>' + T.p2_btc_sub.replace('{d}', dateStr(d)) + '</span></td><td class="fvb-t">' + T.type_bitcoin + '</td>';
      [1, 5, 10].forEach(function (y) { h += cell(ret2(b, y)); });
      return h + nb + nb + nb + '<td class="fvb-d"><a href="https://docs.coinmetrics.io/asset-metrics/market/priceusd" target="_blank" rel="noopener">CoinMetrics</a></td></tr>';
    }
    var r = '<tr data-id="' + f.id + '" data-type="' + f.type + '"><td class="fvb-f"><b>' + esc(f.name) + '</b><span>' + esc(f.company) + ' · ' + f.isin +
      '</span></td><td class="fvb-t">' + T['p2_type_' + f.type] + '</td>';
    [1, 5, 10].forEach(function (y) { r += cell(ret2(f, y)); });
    r += cell2(f.ongoingCosts) + cell2(f.entryCostMax) + cell2(f.exitCost);
    return r + '<td class="fvb-d"><a href="' + esc(f.kidUrl) + '" target="_blank" rel="noopener">' + T.p2_kid + '</a> · <a href="' + esc(f.factsheetUrl) +
      '" target="_blank" rel="noopener">' + T.p2_fs + '</a><span>' + T.p2_asof.replace('{d}', dateStr(f.asOf)) + '</span></td></tr>';
  }
  function sortVal2(f, k) {
    switch (k) {
      case 'name': return f.name.toLowerCase();
      case 'type': return T['p2_type_' + f.type];
      case 'r1': return val(ret2(f, 1));
      case 'r5': return val(ret2(f, 5));
      case 'r10': return val(ret2(f, 10));
      case 'oc': return val(f.ongoingCosts);
      case 'entry': return val(f.entryCostMax);
      case 'exit': return val(f.exitCost);
    }
    return null;
  }
  function renderP2() {
    var all = D.investmentFunds.funds, list = all.filter(function (f) { return P.type === 'all' || f.type === P.type; });
    if (P.key) {
      list.sort(function (a, b) {
        var x = sortVal2(a, P.key), y = sortVal2(b, P.key);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * P.dir;
      });
    }
    document.querySelector('#fvbP2Table tbody.fvb-ref').innerHTML = row2(null);
    $('fvbP2Rows').innerHTML = list.map(row2).join('');
    $('fvbP2Count').textContent = T.c_count.replace('{n}', list.length).replace('{t}', all.length);
    document.querySelectorAll('#fvbP2Table thead th').forEach(function (th) {
      if (th.dataset.k === P.key) th.setAttribute('aria-sort', P.dir > 0 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }
  function wireP2() {
    if (!D.investmentFunds || !$('fvbP2Ctrl')) return;
    $('fvbP2Ctrl').classList.remove('fvb-wait');
    $('fvbP2Type').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      P.type = b.dataset.type; press($('fvbP2Type'), 'data-type', P.type); renderP2();
    });
    $('fvbP2Mode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      P.mode = b.dataset.mode; press($('fvbP2Mode'), 'data-mode', P.mode); renderP2();
    });
    $('fvbP2Reset').addEventListener('click', function () { P.key = null; P.dir = 1; renderP2(); });
    document.querySelectorAll('#fvbP2Table thead th').forEach(function (th) {
      var btn = th.querySelector('button'); if (!btn) return;
      btn.addEventListener('click', function () {
        var k = th.dataset.k;
        if (P.key === k) P.dir = -P.dir; else { P.key = k; P.dir = (k === 'name' || k === 'type') ? 1 : -1; }
        renderP2();
      });
    });
    renderP2();
  }

  fetch(CFG.data, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { D = d; wire(); renderTable(); wireP2(); })
    .catch(function () {
      var n = document.querySelector('#chart .fvb-note'); if (n) n.textContent = T.c_err;
    });
})();
