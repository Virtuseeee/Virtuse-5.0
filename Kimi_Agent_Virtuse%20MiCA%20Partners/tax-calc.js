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
  function mount() {
    var form = document.getElementById('tc-form');
    if (!form) return;
    var R = JSON.parse(document.getElementById('tc-rules').textContent);
    var S = JSON.parse(document.getElementById('tc-i18n').textContent);
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
    var date = function (d) {
      return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T00:00:00Z'));
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
    var cBtns = [].slice.call(document.querySelectorAll('#tc-country [data-c]'));
    var country = form.getAttribute('data-default') || 'sk';
    var q = new URLSearchParams(location.search);
    if (q.get('country') && R.countries[q.get('country')]) country = q.get('country');
    ['proceeds', 'cost', 'other'].forEach(function (k) { if (q.get(k) && !isNaN(+q.get(k))) $('tc-' + k).value = q.get(k); });
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('bought') || '')) $('tc-bought').value = q.get('bought');
    $('tc-bought').max = today;
    if (!$('tc-bought').value) {   // default: bought six months ago
      var d6 = new Date(); d6.setUTCMonth(d6.getUTCMonth() - 6); $('tc-bought').value = d6.toISOString().slice(0, 10);
    }

    function run() {
      cBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-c') === country ? 'true' : 'false'); });
      var r = R.countries[country];
      var otherOn = r.kind === 'bands' || r.kind === 'de';
      $('tc-other-f').hidden = !otherOn;
      if (otherOn) $('tc-other-l').textContent = S['other_' + (r.base === 'savings' ? 'savings' : country === 'de' ? 'de' : 'total')];
      var p = num($('tc-proceeds')), c = num($('tc-cost')), o = otherOn ? num($('tc-other')) : 0;
      var bought = $('tc-bought').value;
      var bad = isNaN(p) || isNaN(c) || (otherOn && isNaN(o)) || !/^\d{4}-\d{2}-\d{2}$/.test(bought) || bought > today || p > 1e9 || c > 1e9;
      $('tc-err').hidden = !bad;
      if (bad) { $('tc-err').textContent = S.err; return; }
      var x = compute(R, country, { proceeds: p, cost: c, bought: bought, today: today, other: o });
      var name = S['n_' + country];
      var v = { country: name, gain: eur(x.gain), years: (S.yrs || {})[r.holdYears || r.oldHoldYears] || '', date: x.holdDate ? date(x.holdDate) : '',
                limit: r.exemptProceedsMax ? (r.currency === 'CZK' ? new Intl.NumberFormat(loc).format(r.exemptProceedsMax) + ' CZK' : eur(r.exemptProceedsMax)) : '',
                rate: r.rate != null ? pct(r.rate) : '' };
      var head, sub = '';
      if (x.status === 'taxed') { head = fill(S.h_taxed, { total: eur(x.total), eff: pct(x.eff) }); sub = fill(S.s_taxed, v); }
      else { head = S['h_' + x.status + (x.reason ? '_' + x.reason : '')]; sub = fill(S['s_' + x.status + (x.reason ? '_' + x.reason : '')] || '', v); }
      $('tc-v-title').textContent = head;
      $('tc-v-sub').textContent = sub;
      $('tc-verdict').className = 'tc-verdict glow' + (x.status === 'taxed' ? ' due' : '');
      $('tc-r-gain').textContent = eur(x.gain);
      $('tc-r-tax').textContent = eur(x.total);
      $('tc-r-net').textContent = eur(x.net);
      $('tc-r-eff').textContent = x.status === 'taxed' ? pct(x.eff) : pct(0);
      // the working, line by line
      var rows = '';
      if (x.status === 'taxed' || x.status === 'loss' || x.status === 'exempt') {
        rows += '<tr><th>' + esc(S.w_proceeds) + '</th><td>' + eur(p, 2) + '</td></tr>';
        rows += '<tr><th>' + esc(S.w_cost) + '</th><td>−' + eur(c, 2) + '</td></tr>';
        rows += '<tr class="sum"><th>' + esc(S.w_gain) + '</th><td>' + eur(x.gain, 2) + '</td></tr>';
      }
      x.lines.forEach(function (l) {
        var lab = l.key === 'band' ? fill(S.w_band, { rate: pct(l.rate), base: eur(l.base, 2) })
          : l.key === 'levy' ? fill(S.w_levy, { rate: pct(l.rate), base: eur(l.base, 2) })
          : l.key === 'income' ? fill(S.w_income, { rate: pct(l.rate), base: eur(l.base, 2) })
          : fill(S.w_tax, { rate: pct(l.rate), base: eur(l.base, 2) });
        rows += '<tr><th>' + esc(lab) + '</th><td>' + eur(l.amount, 2) + '</td></tr>';
      });
      if (x.status === 'taxed') {
        rows += '<tr class="sum"><th>' + esc(S.w_total) + '</th><td>' + eur(x.total, 2) + '</td></tr>';
        rows += '<tr><th>' + esc(S.w_net) + '</th><td>' + eur(x.net, 2) + '</td></tr>';
      }
      $('tc-work').innerHTML = rows;
      $('tc-work-w').hidden = !rows;
      // what the rule leaves out (country notes), the source, review status
      $('tc-notes').innerHTML = (S['note_' + country] || []).map(function (n) { return '<li>' + n + '</li>'; }).join('');
      var src = document.querySelector('#tc-table tr[data-c="' + country + '"] a[target=_blank]');
      $('tc-src').innerHTML = src ? fill(S.src, { link: '<a href="' + src.href + '" target="_blank" rel="noopener">' + esc(src.textContent) + '</a>' }) : '';
      $('tc-rev').textContent = x.reviewed ? S.rev_yes : S.rev_no;
      $('tc-rev').className = 'tc-rev ' + (x.reviewed ? 'y' : 'n');
      var qs = new URLSearchParams({ country: country, proceeds: p, cost: c, bought: bought });
      if (otherOn && o) qs.set('other', o);
      history.replaceState(null, '', location.pathname + '?' + qs.toString() + location.hash);
      window.dataLayer && window.dataLayer.push({ event: 'tax_calc', tax_country: country, tax_status: x.status });
    }
    var timer;
    function later() { clearTimeout(timer); timer = setTimeout(run, 250); }
    cBtns.forEach(function (b) { b.addEventListener('click', function () { country = b.getAttribute('data-c'); run(); }); });
    form.addEventListener('input', later);
    form.addEventListener('change', run);
    run();
  }

  return { compute: compute, deTax: deTax, addYears: addYears, mount: mount };
});
