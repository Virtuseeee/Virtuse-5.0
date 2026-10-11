/* Virtuse Bitcoin Data (bitcoin-data.html, design v2): live values with loading, stale and error states.
   Sources: mempool.space (price, blocks, fees, hashrate, difficulty), CoinGecko (24 h change, market cap,
   price history), data/asset-returns.json (year-to-date comparison). Strings come from #bdI18n. */
(function () {
  'use strict';
  var I = {};
  try { I = JSON.parse(document.getElementById('bdI18n').textContent); } catch (e) { return; }
  var MP = 'https://mempool.space/api', CG = 'https://api.coingecko.com/api/v3', BN = 'https://api.binance.com/api/v3';
  var cgNext = 0; // CoinGecko's free API is rate-limited: at most one price call every 5 minutes, Binance as fallback
  var LOC = I.locale || 'en-GB', STALE = 5 * 60 * 1000, HALVING = 210000;
  var cur = I.cur || 'USD';
  try { var saved = localStorage.getItem('vb-bd-cur'); if (saved === 'USD' || saved === 'EUR') cur = saved; } catch (e) {}
  var st = { price: null, chg: null, mcap: null, height: null, days: 90, hist: {} };
  var groups = { price: { ok: 0, fail: false }, net: { ok: 0, fail: false }, supply: { ok: 0, fail: false }, macro: { ok: 0, fail: false } };

  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function nf(n, d) { return Number(n).toLocaleString(LOC, { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); }
  function money(n, c, d) { return new Intl.NumberFormat(LOC, { style: 'currency', currency: c, maximumFractionDigits: d || 0, minimumFractionDigits: d || 0, currencyDisplay: 'narrowSymbol' }).format(n); }
  function moneyBig(n, c) { return new Intl.NumberFormat(LOC, { style: 'currency', currency: c, notation: 'compact', maximumFractionDigits: 2, currencyDisplay: 'narrowSymbol' }).format(n); }
  function pct(n, d, sign) { return (sign && n > 0 ? '+' : '') + nf(n, d) + I.pct; }
  function set(key, html) { qa('[data-k="' + key + '"]').forEach(function (el) { var v = el.classList.contains('bd-m') ? q('.bd-v', el) : el; v.innerHTML = html; el.classList.remove('err'); }); }
  function j(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function ok(g) { groups[g].ok = Date.now(); groups[g].fail = false; paint(); }
  function fail(g) { groups[g].fail = true; paint(); }

  // timestamps, stale (> 5 min) and error states per section
  function paint() {
    var now = Date.now();
    qa('.bd-src').forEach(function (p) {
      var gs = p.getAttribute('data-g').split(' '), last = Math.min.apply(null, gs.map(function (g) { return groups[g].ok || 0; }));
      var anyFail = gs.some(function (g) { return groups[g].fail; });
      var t = q('.bd-time', p), btn = q('.bd-retry', p);
      p.classList.toggle('is-stale', !!last && now - last > STALE);
      p.classList.toggle('is-err', anyFail && !last);
      if (last) t.textContent = I.updated + ' ' + new Date(last).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit' }) + ' (' + I.your_time + ')' + (now - last > STALE ? ' · ' + I.stale : '');
      else if (anyFail) t.textContent = I.unavailable;
      if (btn) btn.hidden = !(anyFail && (!last || now - last > STALE));
    });
    // a slot that never loaded shows the error text instead of a skeleton forever
    qa('.sk').forEach(function (s) {
      var box = s.closest('[data-g]') || s.closest('section'); if (!box) return;
      var gs = (box.getAttribute('data-g') || sectionGroup(box)).split(' ');
      if (gs.some(function (g) { return groups[g] && groups[g].fail && !groups[g].ok; })) s.outerHTML = '<span class="bd-na">' + I.unavailable + '</span>';
    });
  }
  function sectionGroup(sec) { return { market: 'price', network: 'net', supply: 'supply', macro: 'macro' }[sec.id] || 'price'; }

  function ago(ts) {
    var s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
    var v = s < 60 ? s + ' ' + I.u_s : s < 3600 ? Math.floor(s / 60) + ' ' + I.u_min : Math.floor(s / 3600) + ' ' + I.u_h;
    return I.n_block_ago.replace('{t}', v);
  }
  function supplyAt(h) { var s = 0, sub = 50, r = h + 1; while (r > 0) { var b = Math.min(r, HALVING); s += b * sub; r -= b; sub /= 2; } return s; }
  function dateIn(ms) { return new Date(Date.now() + ms).toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric' }); }

  function renderPrice() {
    if (!st.price) return;
    var p = st.price[cur];
    set('price', money(p, cur));
    if (st.chg && st.chg[cur] != null) { var c = st.chg[cur]; set('chg', pct(c, 2, true)); qa('[data-k="chg"]').forEach(function (e) { e.className = 'bd-chg ' + (c >= 0 ? 'up' : 'down'); }); }
    set('sats', nf(Math.round(1e8 / p)));
    qa('.bd-cur button').forEach(function (b) { var on = b.getAttribute('data-cur') === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    var lbl = q('[data-k="sats"] .bd-l'); if (lbl) lbl.textContent = cur === 'EUR' ? I.p_sats_eur : I.p_sats;
    if (st.height != null) set('mcap', moneyBig(supplyAt(st.height) * p, cur));
    else if (st.mcap && st.mcap[cur]) set('mcap', moneyBig(st.mcap[cur], cur));
    chart();
  }

  function loadPrice() {
    var a = j(MP + '/v1/prices').then(function (p) { st.price = { USD: p.USD, EUR: p.EUR }; renderPrice(); });
    var b = Promise.resolve();
    if (Date.now() >= cgNext || !st.chg) {
      cgNext = Date.now() + 5 * 60 * 1000;
      b = j(CG + '/simple/price?ids=bitcoin&vs_currencies=usd,eur&include_24hr_change=true&include_market_cap=true').then(function (g) {
        var x = g.bitcoin || {}; if (x.usd_24h_change == null) throw new Error('cg');
        st.chg = { USD: x.usd_24h_change, EUR: x.eur_24h_change }; st.mcap = { USD: x.usd_market_cap, EUR: x.eur_market_cap };
        if (!st.price && x.usd) st.price = { USD: x.usd, EUR: x.eur };
        renderPrice();
      }).catch(function () {
        return Promise.all([j(BN + '/ticker/24hr?symbol=BTCUSDT'), j(BN + '/ticker/24hr?symbol=BTCEUR')]).then(function (t) {
          st.chg = { USD: +t[0].priceChangePercent, EUR: +t[1].priceChangePercent };
          if (!st.price) st.price = { USD: +t[0].lastPrice, EUR: +t[1].lastPrice };
          renderPrice();
        });
      });
    }
    Promise.all([a.catch(function () { return 'x'; }), b.catch(function () { return 'x'; })]).then(function (r) {
      if (st.price) ok('price'); else fail('price');
    });
  }

  function chart() {
    var h = st.hist[cur + st.days];
    if (!h) {
      if (st.hist[cur + st.days] === undefined) {
        st.hist[cur + st.days] = null;
        var key = cur + st.days, c = cur, days = st.days;
        j(CG + '/coins/bitcoin/market_chart?vs_currency=' + c.toLowerCase() + '&days=' + days + '&interval=daily').then(function (d) {
          var v = (d.prices || []).map(function (x) { return x[1]; }); if (v.length < 2) throw new Error('cg'); return v;
        }).catch(function () {
          return j(BN + '/klines?symbol=BTC' + (c === 'USD' ? 'USDT' : 'EUR') + '&interval=1d&limit=' + days).then(function (k) { return k.map(function (x) { return +x[4]; }); });
        }).then(function (v) { st.hist[key] = v; chart(); }).catch(function () { delete st.hist[key]; });
      }
      return;
    }
    if (h.length < 2) return;
    var mn = Math.min.apply(null, h), mx = Math.max.apply(null, h), W = 600, H = 160, pad = 8;
    var pts = h.map(function (v, i) { return [i / (h.length - 1) * W, H - pad - (v - mn) / (mx - mn || 1) * (H - 2 * pad)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    q('#bdLine').setAttribute('d', line); q('#bdArea').setAttribute('d', line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z');
    q('#bdMin').textContent = money(mn, cur); q('#bdMax').textContent = money(mx, cur);
    q('#bdChartLbl').textContent = I.p_chart.replace('{n}', st.days);
  }

  function loadNet() {
    var jobs = [
      // one call for the tip: block height (hero) and latest block (network) can't disagree
      j(MP + '/v1/blocks').then(function (bs) {
        var b = bs[0]; if (!b) throw new Error('no block');
        st.height = b.height;
        set('height', nf(b.height)); set('bheight', nf(b.height)); set('bago', ago(b.timestamp));
        set('btx', nf(b.tx_count)); set('bsize', nf(b.size / 1e6, 2) + ' MB');
        set('bminer', (b.extras && b.extras.pool && b.extras.pool.name) || I.n_unknown);
        var sup = supplyAt(b.height);
        set('supply', nf(Math.floor(sup)) + ' BTC'); set('suppct', pct(sup / 21e6 * 100, 2));
        qa('[data-k="supbar"]').forEach(function (e) { e.style.width = (sup / 21e6 * 100).toFixed(2) + '%'; });
        var next = (Math.floor(b.height / HALVING) + 1) * HALVING, left = next - b.height;
        set('halving', nf(left)); set('halvsub', I.s_halving_sub.replace('{d}', dateIn(left * 600000)));
        renderPrice(); ok('supply');
      }).catch(function () { fail('supply'); throw new Error('blocks'); }),
      j(MP + '/v1/fees/recommended').then(function (f) {
        set('fee', nf(f.fastestFee)); set('ffast', nf(f.fastestFee) + ' sat/vB'); set('f30', nf(f.halfHourFee) + ' sat/vB');
        set('f60', nf(f.hourFee) + ' sat/vB'); set('fmin', nf(f.minimumFee) + ' sat/vB');
      }),
      j(MP + '/v1/mining/hashrate/3d').then(function (m) {
        set('hash', nf(m.currentHashrate / 1e18) + ' EH/s');
        set('diff', nf(m.currentDifficulty / 1e12, 2) + ' T');
      }),
      j(MP + '/v1/difficulty-adjustment').then(function (d) {
        set('adj', pct(d.difficultyChange, 2, true));
        set('adjpct', pct(d.progressPercent, 1)); set('adjleft', nf(d.remainingBlocks));
        set('adjdate', new Date(d.estimatedRetargetDate).toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric' }));
        qa('[data-k="adjbar"]').forEach(function (e) { e.style.width = Math.min(100, d.progressPercent).toFixed(1) + '%'; });
      })
    ];
    var settled = jobs.map(function (p) { return p.then(function () { return 1; }, function () { return 0; }); });
    Promise.all(settled).then(function (r) { if (r.indexOf(1) >= 0) ok('net'); else fail('net'); });
  }

  function loadMacro() {
    var box = q('[data-g="macro"]'); if (!box) return;
    j(I.raw).catch(function () { return j(I.local); }).then(function (d) {
      var by = {}; (d.rows || []).forEach(function (r) { by[r.ticker] = r; });
      ['BTC', 'GLD', 'SPY', 'BND'].forEach(function (tk) {
        var r = by[tk]; if (!r || !r.returns || !r.returns.length) return;
        var y = r.returns[r.returns.length - 1] * 100;
        set('ytd-' + tk, '<span class="' + (y >= 0 ? 'up' : 'down') + '">' + pct(y, 1, true) + '</span>');
      });
      ok('macro');
    }).catch(function () { fail('macro'); });
  }

  qa('.bd-cur button').forEach(function (b) { b.addEventListener('click', function () { cur = b.getAttribute('data-cur'); try { localStorage.setItem('vb-bd-cur', cur); } catch (e) {} renderPrice(); }); });
  qa('.bd-range [data-days]').forEach(function (b) { b.addEventListener('click', function () {
    st.days = +b.getAttribute('data-days'); qa('.bd-range [data-days]').forEach(function (x) { x.classList.toggle('on', x === b); }); chart();
  }); });
  qa('.bd-retry').forEach(function (b) { b.addEventListener('click', function () { refresh(); }); });

  function refresh() { loadPrice(); loadNet(); }
  refresh(); loadMacro();
  setInterval(refresh, 60000);
  setInterval(paint, 30000);
})();
