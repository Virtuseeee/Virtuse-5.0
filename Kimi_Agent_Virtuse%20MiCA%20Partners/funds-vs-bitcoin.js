/* Funds vs Bitcoin (funds-vs-bitcoin.html, sk/fondy-vs-bitcoin.html), redesign 2026-11-18.
   Reads /data/funds-vs-bitcoin.json and drives the three steps (group, period, amount),
   the hero numbers, the chart, the cards, search and filters, and the two full tables.
   Default order is neutral (manager, type, name, as in the data file); no ranking, no verdict colour.
   Missing values are shown in words with the reason from the data file, never estimated.
   Built pages: i18n-tools/funds-vs-bitcoin/build_fvb.py. */
(function () {
  'use strict';
  var T = JSON.parse(document.getElementById('fvb-i18n').textContent);
  var CFG = JSON.parse(document.getElementById('fvb-cfg').textContent);
  var EN = CFG.lang === 'en';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- cookie banner: on the first visit move it into the page flow so it never covers the content ---------- */
  (function () {
    var stored = null;
    try { stored = localStorage.getItem('vb-consent'); } catch (e) {}
    if (stored) return;
    var slot = $('fvbCcSlot'); if (!slot) return;
    function place(el) { el.classList.add('fvb-cc-flow'); slot.appendChild(el); }
    var first = document.querySelector('body > .vb-cc');
    if (first) { place(first); return; }
    var mo = new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && n.classList.contains('vb-cc') && n.parentNode === document.body) { place(n); mo.disconnect(); }
        });
      });
    });
    mo.observe(document.body, { childList: true });
    setTimeout(function () { mo.disconnect(); }, 10000);
  })();

  var D = null;
  var S = { g: 'pillar', y: 10, amt: CFG.amount, mode: 'once', ret: 'nominal', type: 'all', company: '', q: '', full: false,
            t1: { key: null, dir: 1 }, t2: { key: null, dir: 1 } };
  var LAST = { once: CFG.amount, monthly: CFG.monthly };

  /* ---------- formatting (same as the Python builder) ---------- */
  function nf(v, d) {
    var s = Math.abs(v).toLocaleString(CFG.locale, { minimumFractionDigits: d, maximumFractionDigits: d });
    var neg = v < 0 && Number(Math.abs(v).toFixed(d)) !== 0;
    return (neg ? '−' : '') + s;
  }
  function pct(v, d) { return nf(v * 100, d == null ? 1 : d) + (CFG.pctSpace ? ' %' : '%'); }
  function eur(v) { var s = nf(v, 0); return EN ? '€' + s : s + ' €'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SK_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
  function dateStr(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + (EN ? EN_M : SK_GEN)[+p[1] - 1] + ' ' + p[0]; }
  function val(o) { return o && o.value != null ? o.value : null; }
  function reason(o) { o = o || {}; return (EN ? o.reasonEn : o.reason) || ''; }
  function miss(o) { return '<span class="miss" title="' + esc(reason(o)) + '">' + T.miss + '</span>'; }
  function cell(o, d) { return '<td>' + (val(o) == null ? miss(o) : pct(o.value, d)) + '</td>'; }
  function tkey(t) { return 'type_' + t.replace(/-/g, '_'); }
  function fold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  /* ---------- groups ---------- */
  function group(g) {
    if (g === 'pillar') return D.funds;
    return D.investmentFunds.funds.filter(function (f) { return (f.type.indexOf('etf') === 0) === (g === 'etf'); });
  }
  function refDate(fs) {
    var c = {}, best = null;
    fs.forEach(function (f) { c[f.asOf] = (c[f.asOf] || 0) + 1; });
    Object.keys(c).forEach(function (d) { if (!best || c[d] > c[best] || (c[d] === c[best] && d > best)) best = d; });
    return best;
  }
  function btcFor(g) {
    if (g === 'pillar') return { b: D.bitcoin, d: D.asOf };
    var d = refDate(group(g)); return { b: D.investmentFunds.bitcoin[d], d: d };
  }
  function inflFor(g, y) {
    if (g === 'pillar') return D.inflation.pa[y + 'y'].value;
    var b = btcFor(g).b;
    return (1 + b['return' + y + 'y'].value) / (1 + b['real' + y + 'y'].value) - 1;
  }
  function ret(f, y) { return f[(S.ret === 'real' ? 'real' : 'return') + y + 'y']; }
  function usdOnly(f) {
    var r = (f.return1y && f.return1y.reason) || '';
    return f.return1y && f.return1y.value == null && (r.indexOf('Emitent zverejňuje výnos tohto ETF len v amerických dolároch') === 0 ||
      r.indexOf('Správa emitenta tabuľku výkonnosti neobsahuje') === 0);
  }
  function visible() {
    var q = fold(S.q.trim());
    return group(S.g).filter(function (f) {
      if (S.type !== 'all' && f.type !== S.type) return false;
      if (S.company && f.company !== S.company) return false;
      if (S.full && val(f.return10y) == null) return false;
      if (q && fold(f.name + ' ' + f.company + ' ' + (f.isin || '')).indexOf(q) < 0) return false;
      return true;
    });
  }
  function haveLine(n, t, y) {
    return T['have_' + y].replace('{n}', n).replace('{t}', t).replace('{z}', String(t).charAt(0) === '7' || t === 17 ? 'zo' : 'z')
      .replace('{v}', n === 1 ? 'has' : 'have');
  }
  function retLab(y) { return T['ret_lab_' + y] + (S.ret === 'real' ? ' ' + T.c_real : ''); }

  /* ---------- hero numbers and date line ---------- */
  function renderNums(list) {
    var bd = btcFor(S.g), y = S.y;
    $('fvbNumB').textContent = pct(val(ret(bd.b, y)));
    $('fvbNumBs').textContent = retLab(y) + ', ' + T.asof_short.replace('{d}', dateStr(bd.d));
    var vs = list.map(function (f) { return val(ret(f, y)); }).filter(function (v) { return v != null; });
    $('fvbNumGk').textContent = T['num_grp_' + S.g];
    $('fvbNumG').textContent = vs.length ? T.range.replace('{a}', pct(Math.min.apply(null, vs))).replace('{b}', pct(Math.max.apply(null, vs))) : T.miss;
    $('fvbNumGs').textContent = retLab(y) + '; ' + haveLine(vs.length, list.length, y);
    $('fvbNumI').textContent = pct(inflFor(S.g, y));
    $('fvbNumIs').textContent = T['num_infl_s_' + y];
    var p = bd.b.price.value;
    $('fvbDate').innerHTML = T[S.g === 'pillar' ? 'date_pillar' : 'date_p2'].replace('{d}', dateStr(bd.d)).replace('{p}', eur(p));
  }

  /* ---------- cards ---------- */
  function feeLine(f) {
    if (S.g === 'pillar') {
      var mf = f.managementFee;
      if (val(mf) != null) return T.fee_statute_line.replace('{v}', '<a href="' + esc(mf.source) + '" target="_blank" rel="noopener">' + pct(mf.value) + '</a>');
      return T.fee_cap_line.replace('{v}', pct(f.managementFeeCap.value));
    }
    var s = val(f.ongoingCosts) != null ? T.fee_oc_line.replace('{v}', pct(f.ongoingCosts.value, 2)) : T.miss;
    if (val(f.entryCostMax) != null) s += ', ' + T.fee_entry_line.replace('{v}', pct(f.entryCostMax.value, 2));
    return s;
  }
  function card(f) {
    var y = S.y, o = ret(f, y), r;
    if (val(o) != null) r = '<p class="r">' + pct(o.value) + '<small>' + retLab(y) + '</small></p>';
    else if (usdOnly(f)) r = '<p class="r miss" title="' + esc(reason(o)) + '">' + T.usd_only + '</p>';
    else r = '<p class="r miss">' + esc(T.card_miss.replace('{y}', T['hz' + y]) + ' ' + reason(f['return' + y + 'y'])) + '</p>';
    var dl = '';
    if (val(f.maxDrawdown10y) != null) dl += '<div><dt>' + T.card_dd + '</dt><dd>' + pct(f.maxDrawdown10y.value) + '</dd></div>';
    dl += '<div><dt>' + T.card_fee + '</dt><dd>' + feeLine(f) + '</dd></div>';
    var src = S.g === 'pillar'
      ? '<a href="' + esc(f.unitValue.source) + '" target="_blank" rel="noopener">' + T.src_adss + '</a> · ' + T.asof_short.replace('{d}', dateStr(D.asOf))
      : '<a href="' + esc(f.kidUrl) + '" target="_blank" rel="noopener">' + T.src_kid + '</a> · <a href="' + esc(f.factsheetUrl) +
        '" target="_blank" rel="noopener">' + T.src_report + '</a> · ' + T.asof_short.replace('{d}', dateStr(f.asOf));
    return '<article class="fvb-card" data-id="' + esc(f.id) + '"><header><h3>' + esc(f.name) + '</h3><p class="m">' + esc(f.company) + ' · ' +
      T[tkey(f.type)] + '</p></header>' + r + '<dl>' + dl + '</dl><p class="src">' + src + '</p></article>';
  }
  function btcCard() {
    var bd = btcFor(S.g), o = ret(bd.b, S.y), dl = '';
    if (S.g === 'pillar') dl += '<div><dt>' + T.card_dd + '</dt><dd>' + pct(bd.b.maxDrawdown10y.value) + '</dd></div>';
    dl += '<div><dt>' + T.card_fee + '</dt><dd>' + T.btc_fee + '</dd></div>';
    return '<article class="fvb-card btc"><header><h3>Bitcoin</h3><p class="m">' + T.btc_ref + '</p></header><p class="r">' + pct(o.value) +
      '<small>' + retLab(S.y) + '</small></p><dl>' + dl + '</dl><p class="src"><a href="' + esc(bd.b.price.source) +
      '" target="_blank" rel="noopener">CoinMetrics</a> · ' + T.asof_short.replace('{d}', dateStr(bd.d)) + '</p></article>';
  }
  function renderCards(list) {
    $('fvbCards').innerHTML = btcCard() + (list.length ? list.map(card).join('') : '<p class="fvb-empty">' + T.end_none + '</p>');
    $('fvbCount').textContent = T.count.replace('{n}', list.length).replace('{t}', group(S.g).length);
  }

  /* ---------- filters that depend on the group ---------- */
  function renderFilters() {
    var fs = group(S.g), types = CFG.types[S.g];
    var h = '<button type="button" class="fvb-chip" data-t="all" aria-pressed="' + (S.type === 'all') + '">' + T.type_all + ' <small>' + fs.length + '</small></button>';
    types.forEach(function (k) {
      var n = fs.filter(function (f) { return f.type === k; }).length;
      if (n) h += '<button type="button" class="fvb-chip" data-t="' + k + '" aria-pressed="' + (S.type === k) + '">' + T[tkey(k)] + ' <small>' + n + '</small></button>';
    });
    $('fvbType').innerHTML = h;
    var cs = {}; fs.forEach(function (f) { cs[f.company] = 1; });
    $('fvbCompany').innerHTML = '<option value="">' + esc(T.company_all) + '</option>' + Object.keys(cs).sort().map(function (c) {
      return '<option' + (c === S.company ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
  }

  /* ---------- chart ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function predLab() { return T['pred_' + S.y]; }

  function renderChart(list) {
    var svg = $('fvbChart'), tip = $('fvbTip');
    clear(svg); tip.style.display = 'none'; svg.onmousemove = svg.ontouchstart = svg.ontouchmove = svg.onmouseleave = null;
    $('fvbChartH').textContent = (S.mode === 'once' ? T.chart_h_once : T.chart_h_monthly).replace('{a}', eur(S.amt)).replace('{p}', predLab());
    if (S.g === 'pillar') return lineChart(svg, tip, list);
    return barChart(svg, list);
  }

  function lineChart(svg, tip, list) {
    svg.style.height = '';
    var weeks = D.weeks, end = weeks[weeks.length - 1];
    var start = (+end.slice(0, 4) - S.y) + end.slice(4);
    var i0 = 0; while (i0 < weeks.length && weeks[i0] < start) i0++;
    var dates = weeks.slice(i0), monthly = S.mode === 'monthly';
    var log = !monthly && S.y > 1;
    $('fvbScale').textContent = log ? T.ch_log : T.ch_lin;
    $('fvbChartNote').textContent = monthly ? T.chart_note_monthly : T.chart_note_pillar;
    var inv = [];
    function series(arr) {
      var s = arr.slice(i0);
      if (s.some(function (v) { return v == null; })) return null;
      if (!monthly) return s.map(function (v) { return S.amt * v / s[0]; });
      var units = 0, paid = 0, out = [];
      s.forEach(function (v, i) {
        if (i === 0 || dates[i].slice(5, 7) !== dates[i - 1].slice(5, 7)) { units += S.amt / v; paid += S.amt; }
        out.push(units * v); inv[i] = paid;
      });
      return out;
    }
    var lines = [];
    list.forEach(function (f) { var s = series(f.weekly); if (s) lines.push({ name: f.name, s: s, btc: false }); });
    var bs = series(D.bitcoin.weekly);
    if (bs) lines.push({ name: 'Bitcoin', s: bs, btc: true });
    var invested = monthly ? inv.slice() : null;
    var W = svg.clientWidth || 800, H = svg.clientHeight || 380, L = 70, R = 12, Tp = 10, Bt = 26;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var lo = Infinity, hi = -Infinity;
    lines.concat(invested ? [{ s: invested }] : []).forEach(function (l) { l.s.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; }); });
    if (!isFinite(lo)) return;
    if (!log) lo = Math.min(lo, 0);
    var f = log ? Math.log : function (v) { return v; };
    var ylo = log ? f(lo * 0.95) : lo, yhi = f(hi * 1.05);
    var X = function (i) { return L + (W - L - R) * i / (dates.length - 1); };
    var Y = function (v) { return Tp + (H - Tp - Bt) * (1 - (f(Math.max(v, log ? 1e-9 : -Infinity)) - ylo) / (yhi - ylo)); };
    var ticks = [];
    if (log) {
      var m = Math.pow(10, Math.floor(Math.log10(lo * 0.95)));
      for (var b = m; b <= hi * 1.05 * 10; b *= 10) [1, 2, 5].forEach(function (k) { var v = b * k; if (v >= lo * 0.95 && v <= hi * 1.05) ticks.push(v); });
    } else {
      var step = Math.pow(10, Math.floor(Math.log10((hi - lo) || 1))) / 2, v = Math.ceil(lo / step) * step;
      for (; v <= hi; v += step) ticks.push(v);
      while (ticks.length > 7) ticks = ticks.filter(function (_, i) { return i % 2 === 0; });
    }
    L = 14 + 6.6 * Math.max.apply(null, ticks.map(function (v) { return eur(v).length; }).concat([4]));
    ticks.forEach(function (v) {
      var y = Y(v);
      svg.appendChild(el('line', { x1: L, x2: W - R, y1: y, y2: y, 'class': 'grid' }));
      var tx = el('text', { x: L - 6, y: y + 4, 'text-anchor': 'end', 'class': 'ax' }); tx.textContent = eur(v); svg.appendChild(tx);
    });
    var lastLab = null, lastX = -1e9, gap = S.y === 1 ? 40 : 38;
    dates.forEach(function (d, i) {
      var lab = S.y === 1 ? d.slice(0, 7) : d.slice(0, 4);
      if (lab === lastLab) return;
      if (S.y === 1 && ['01', '04', '07', '10'].indexOf(d.slice(5, 7)) < 0) { lastLab = lab; return; }
      lastLab = lab;
      if (i === 0 || X(i) - lastX < gap || X(i) > W - R - 14) return;
      lastX = X(i);
      var tx = el('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', 'class': 'ax' });
      tx.textContent = S.y === 1 ? d.slice(5, 7) + '/' + d.slice(2, 4) : lab; svg.appendChild(tx);
    });
    function path(s) { return s.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(''); }
    if (invested) svg.appendChild(el('path', { d: path(invested), 'class': 'ln inv' }));
    var paths = [];
    lines.forEach(function (l) { var p = el('path', { d: path(l.s), 'class': 'ln ' + (l.btc ? 'btc' : 'fund') }); svg.appendChild(p); paths.push(p); });
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
      var h = '<b>' + dateStr(dates[i]) + '</b>';
      if (invested) h += '<div><span>' + T.c_invested + '</span><span>' + eur(invested[i]) + '</span></div>';
      if (bs) h += '<div><span>Bitcoin</span><span>' + eur(bs[i]) + '</span></div>';
      if (near >= 0) h += '<div><span>' + esc(lines[near].name) + '</span><span>' + eur(lines[near].s[i]) + '</span></div>';
      tip.innerHTML = h; tip.style.display = 'block';
      var tw = tip.offsetWidth, left = px + 14; if (left + tw > r.width) left = px - tw - 14;
      tip.style.left = Math.max(0, left) + 'px'; tip.style.top = Math.max(0, py - 20) + 'px';
    }
    svg.onmousemove = move; svg.ontouchstart = move; svg.ontouchmove = move;
    svg.onmouseleave = function () { tip.style.display = 'none'; paths.forEach(function (p) { p.classList.remove('hi'); }); xh.setAttribute('x1', -10); xh.setAttribute('x2', -10); };
    var ends = lines.filter(function (l) { return !l.btc; }).map(function (l) { return l.s[l.s.length - 1]; });
    renderEnds(bs ? bs[bs.length - 1] : null, ends, D.asOf, monthly ? invested[invested.length - 1] : S.amt,
      T.end_note.replace('{s}', dateStr(dates[0])).replace('{e}', dateStr(dates[dates.length - 1])).replace('{y}', T['hz' + S.y]));
  }

  function barChart(svg, list) {
    $('fvbScale').textContent = T.ch_lin;
    var bd = btcFor(S.g);
    if (S.mode === 'monthly') {
      svg.style.height = '120px';
      svg.setAttribute('viewBox', '0 0 ' + (svg.clientWidth || 800) + ' 120');
      var nt = el('text', { x: 16, y: 40, 'class': 'ax' }); nt.textContent = T.chart_note_monthly_p2; svg.appendChild(nt);
      $('fvbChartNote').textContent = T.chart_note_monthly_p2;
      $('fvbEnds').innerHTML = '';
      return;
    }
    $('fvbChartNote').textContent = T.chart_note_p2;
    var y = S.y, rows = [];
    var bv = val(bd.b['return' + y + 'y']);
    if (bv != null) rows.push({ name: 'Bitcoin', v: S.amt * Math.pow(1 + bv, y), btc: true, d: bd.d });
    list.forEach(function (f) {
      var r = val(f['return' + y + 'y']);
      if (r != null) rows.push({ name: f.name, v: S.amt * Math.pow(1 + r, y), btc: false, d: f.asOf });
    });
    var W = svg.clientWidth || 800, narrow = W < 560, rowH = narrow ? 40 : 26, top = 8;
    var H = top + rows.length * rowH + 8;
    svg.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var labW = narrow ? 0 : Math.min(300, W * 0.36), L = labW + 8, R = 86;
    var vals = rows.map(function (r) { return r.v; }).concat([S.amt]);
    var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    var lg = hi / lo > 5, base = lo * 0.5;
    $('fvbScale').textContent = lg ? T.ch_log_bar : T.ch_lin;
    var X = lg ? function (v) { return L + (W - L - R) * (Math.log(v) - Math.log(base)) / (Math.log(hi) - Math.log(base)); }
               : function (v) { return L + (W - L - R) * v / hi; };
    var xa = X(S.amt);
    svg.appendChild(el('line', { x1: xa, x2: xa, y1: 0, y2: H, 'class': 'xh' }));
    rows.forEach(function (r, i) {
      var y0 = top + i * rowH, bh = narrow ? 14 : 16, by = narrow ? y0 + 20 : y0 + 4;
      var lab = el('text', { x: narrow ? 0 : labW, y: narrow ? y0 + 13 : y0 + 16, 'text-anchor': narrow ? 'start' : 'end', 'class': 'bl' });
      lab.textContent = r.name.length > 46 ? r.name.slice(0, 44) + '…' : r.name; svg.appendChild(lab);
      svg.appendChild(el('rect', { x: L, y: by, width: Math.max(1, X(r.v) - L), height: bh, rx: 3, 'class': 'bar' + (r.btc ? ' btc' : '') }));
      var vt = el('text', { x: X(r.v) + 6, y: by + bh - 3, 'class': 'bv' }); vt.textContent = eur(r.v); svg.appendChild(vt);
    });
    if (rows.length < 2) { var nt2 = el('text', { x: 8, y: H - 6, 'class': 'ax' }); nt2.textContent = T.end_none; svg.appendChild(nt2); }
    var ends = rows.filter(function (r) { return !r.btc; }).map(function (r) { return r.v; });
    renderEnds(bv != null ? S.amt * Math.pow(1 + bv, y) : null, ends, bd.d, S.amt);
  }

  function renderEnds(b, ends, d, paid, note) {
    var s = T.end_s.replace('{d}', dateStr(d)).replace('{inv}', eur(paid));
    var g = ends.length ? T.range.replace('{a}', eur(Math.min.apply(null, ends))).replace('{b}', eur(Math.max.apply(null, ends))) : T.miss;
    $('fvbEnds').innerHTML = '<div class="fvb-end btc"><span class="k">' + T.end_btc + '</span><span class="v">' + (b == null ? T.miss : eur(b)) +
      '</span><p class="s">' + s + '</p></div><div class="fvb-end"><span class="k">' + T.end_grp + '</span><span class="v">' + g +
      '</span><p class="s">' + (ends.length ? s : T.end_none) + '</p></div>' + (note ? '<p class="fvb-endnote">' + esc(note) + '</p>' : '');
  }

  /* ---------- full tables ---------- */
  function t1Row(f, btc) {
    var h = '<tr' + (btc ? '' : ' data-id="' + f.id + '"') + '><td class="fvb-f"><b>' + (btc ? 'Bitcoin' : esc(f.name)) + '</b><span>' +
      (btc ? T.btc_ref : esc(f.company)) + '</span></td><td class="fvb-t">' + (btc ? T.type_bitcoin : T[tkey(f.type)]) + '</td>';
    [1, 5, 10].forEach(function (y) { h += cell(ret(f, y)); });
    h += cell(f.maxDrawdown10y) + cell(f.volatility10y);
    if (btc) return h + '<td>' + T.btc_fee_short + '</td></tr>';
    var mf = f.managementFee;
    if (val(mf) == null) return h + cell(mf) + '</tr>';
    return h + '<td><a href="' + esc(mf.source) + '" target="_blank" rel="noopener" title="' + esc(EN ? mf.sourceLabelEn : mf.sourceLabel) + '">' + pct(mf.value) + '</a></td></tr>';
  }
  function t2Row(f) {
    if (!f) {
      var bd = btcFor('fund'), nb = '<td class="fvb-x">' + T.btc_fee_short + '</td>';
      var h = '<tr><td class="fvb-f"><b>Bitcoin</b><span>' + T.btc_ref + ', ' + T.asof_short.replace('{d}', dateStr(bd.d)) + '</span></td><td class="fvb-t">' + T.type_bitcoin + '</td>';
      [1, 5, 10].forEach(function (y) { h += cell(ret(bd.b, y)); });
      return h + nb + nb + nb + '<td class="fvb-d"><a href="' + esc(bd.b.price.source) + '" target="_blank" rel="noopener">CoinMetrics</a></td></tr>';
    }
    var r = '<tr data-id="' + f.id + '"><td class="fvb-f"><b>' + esc(f.name) + '</b><span>' + esc(f.company) + ' · ' + f.isin + '</span></td><td class="fvb-t">' + T[tkey(f.type)] + '</td>';
    if (usdOnly(f)) r += '<td class="fvb-x" colspan="3" title="' + esc(reason(f.return1y)) + '">' + T.usd_only + '</td>';
    else [1, 5, 10].forEach(function (y) { r += cell(ret(f, y)); });
    r += cell(f.ongoingCosts, 2) + cell(f.entryCostMax, 2) + cell(f.exitCost, 2);
    return r + '<td class="fvb-d"><a href="' + esc(f.kidUrl) + '" target="_blank" rel="noopener">' + T.src_kid + '</a> · <a href="' + esc(f.factsheetUrl) +
      '" target="_blank" rel="noopener">' + T.src_report + '</a><span>' + T.asof_short.replace('{d}', dateStr(f.asOf)) + '</span></td></tr>';
  }
  function sortVal(f, k) {
    switch (k) {
      case 'name': return fold(f.name);
      case 'type': return T[tkey(f.type)];
      case 'r1': return val(ret(f, 1));
      case 'r5': return val(ret(f, 5));
      case 'r10': return val(ret(f, 10));
      case 'dd': return val(f.maxDrawdown10y);
      case 'vol': return val(f.volatility10y);
      case 'fee': return val(f.managementFee);
      case 'oc': return val(f.ongoingCosts);
      case 'entry': return val(f.entryCostMax);
      case 'exit': return val(f.exitCost);
    }
    return null;
  }
  function sorted(list, st) {
    list = list.slice();
    if (!st.key) return list;
    return list.sort(function (a, b) {
      var x = sortVal(a, st.key), y = sortVal(b, st.key);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * st.dir;
    });
  }
  function renderTables() {
    document.querySelector('#fvbT1 tbody.fvb-ref').innerHTML = t1Row(D.bitcoin, true);
    $('fvbT1Rows').innerHTML = sorted(D.funds, S.t1).map(function (f) { return t1Row(f, false); }).join('');
    document.querySelector('#fvbT2 tbody.fvb-ref').innerHTML = t2Row(null);
    $('fvbT2Rows').innerHTML = sorted(D.investmentFunds.funds, S.t2).map(t2Row).join('');
    [['fvbT1', S.t1], ['fvbT2', S.t2]].forEach(function (p) {
      document.querySelectorAll('#' + p[0] + ' thead th').forEach(function (th) {
        if (th.dataset.k === p[1].key) th.setAttribute('aria-sort', p[1].dir > 0 ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
      });
    });
  }

  /* ---------- render all ---------- */
  function render() {
    var list = visible();
    renderNums(list);
    renderCards(list);
    renderChart(list);
    renderTables();
  }

  /* ---------- controls ---------- */
  function press(box, attr, v) {
    box.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === String(v) ? 'true' : 'false'); });
  }
  function setAmount() {
    var r = $('fvbAmt');
    if (S.mode === 'once') { r.min = 1000; r.max = 100000; r.step = 1000; }
    else { r.min = 25; r.max = 2000; r.step = 25; }
    r.value = S.amt;
    $('fvbAmtOut').textContent = eur(S.amt);
    $('fvbAmtLab').textContent = S.mode === 'once' ? T.amt_once : T.amt_monthly;
  }
  function wire() {
    $('fvbGroup').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.g = b.dataset.g; S.type = 'all'; S.company = ''; press($('fvbGroup'), 'data-g', S.g); renderFilters(); render();
    });
    $('fvbHorizon').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.y = +b.dataset.y; press($('fvbHorizon'), 'data-y', S.y); render();
    });
    var raf = 0;
    $('fvbAmt').addEventListener('input', function (e) {
      S.amt = +e.target.value; LAST[S.mode] = S.amt; $('fvbAmtOut').textContent = eur(S.amt);
      cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { renderChart(visible()); });
    });
    $('fvbMode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.mode = b.dataset.m; S.amt = LAST[S.mode]; press($('fvbMode'), 'data-m', S.mode); setAmount(); renderChart(visible());
    });
    $('fvbType').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.type = b.dataset.t; press($('fvbType'), 'data-t', S.type); render();
    });
    $('fvbCompany').addEventListener('change', function (e) { S.company = e.target.value; render(); });
    $('fvbQ').addEventListener('input', function (e) { S.q = e.target.value; render(); });
    $('fvbFull').addEventListener('click', function () {
      S.full = !S.full; $('fvbFull').setAttribute('aria-pressed', S.full ? 'true' : 'false'); render();
    });
    $('fvbRet').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      S.ret = b.dataset.r; press($('fvbRet'), 'data-r', S.ret); render();
    });
    [['fvbT1', 't1'], ['fvbT2', 't2']].forEach(function (p) {
      document.querySelectorAll('#' + p[0] + ' thead th').forEach(function (th) {
        var btn = th.querySelector('button'); if (!btn) return;
        btn.addEventListener('click', function () {
          var st = S[p[1]], k = th.dataset.k;
          if (st.key === k) st.dir = -st.dir; else { st.key = k; st.dir = (k === 'name' || k === 'type') ? 1 : -1; }
          renderTables();
        });
      });
    });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { renderChart(visible()); }, 150); });
  }

  fetch(CFG.data, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { D = d; setAmount(); wire(); renderFilters(); render(); })
    .catch(function () { var n = $('fvbChartNote'); if (n) n.textContent = T.c_err; });
})();
