/* Bitcoin Data: public companies holding Bitcoin (#treasuries).
   data/btc-treasuries.json is rebuilt daily by macro-build/build.mjs from
   CoinGecko's public-company treasury list. Read from GitHub first so the live
   site stays fresh without an upload; the site's copy is the fallback. */
(function () {
  'use strict';
  var RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/btc-treasuries.json';
  var LOCAL = 'data/btc-treasuries.json';
  var TOP = 25;
  var box = document.getElementById('treasuries');
  if (!box) return;
  var body = box.querySelector('tbody');
  var meta = box.querySelector('.tr-meta');
  var more = box.querySelector('.tr-more');
  var search = box.querySelector('.tr-search');
  var data = null;
  var showAll = false;

  function get(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }
  function fmt(n, d) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: d || 0 }); }
  function usd(n) {
    if (!n) return '–';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
    return '$' + fmt(n);
  }
  function cell(tr, text, cls) {
    var td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    tr.appendChild(td);
  }
  function render() {
    if (!data) return;
    var q = (search && search.value || '').trim().toLowerCase();
    var rows = data.companies.map(function (c, i) { c.rank = i + 1; return c; });
    if (q) rows = rows.filter(function (c) { return (c.name + ' ' + c.symbol + ' ' + c.country).toLowerCase().indexOf(q) >= 0; });
    else if (!showAll) rows = rows.slice(0, TOP);
    body.textContent = '';
    rows.forEach(function (c) {
      var tr = document.createElement('tr');
      cell(tr, c.rank, 'tr-rank');
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = c.name;
      tr.appendChild(th);
      cell(tr, c.symbol || '', 'tr-sym');
      cell(tr, c.country || '', 'tr-ctry');
      cell(tr, fmt(c.btc), 'tr-num');
      cell(tr, usd(c.usd), 'tr-num');
      cell(tr, c.pct_supply != null ? Number(c.pct_supply).toFixed(3) + '%' : '–', 'tr-num');
      body.appendChild(tr);
    });
    if (!rows.length) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 7;
      td.textContent = 'No company matches.';
      tr.appendChild(td);
      body.appendChild(tr);
    }
    if (more) {
      more.hidden = !!q || data.companies.length <= TOP;
      more.textContent = showAll ? 'Show top ' + TOP : 'Show all ' + data.companies.length + ' companies';
    }
  }
  function paint(d) {
    if (!d || !Array.isArray(d.companies) || !d.companies.length) return;
    data = d;
    if (meta) {
      var asOf = d.as_of ? new Date(d.as_of + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
      meta.textContent = d.count + ' public companies hold ' + fmt(d.total_btc) + ' BTC' + (asOf ? ', as of ' + asOf : '') + '. Source: CoinGecko. Holdings as the companies report them.';
    }
    render();
  }
  if (more) more.addEventListener('click', function () { showAll = !showAll; render(); });
  if (search) search.addEventListener('input', render);
  get(RAW).catch(function () { return get(LOCAL); }).then(paint).catch(function () {
    if (meta) meta.textContent = 'Treasury data is unavailable right now.';
  });
})();
