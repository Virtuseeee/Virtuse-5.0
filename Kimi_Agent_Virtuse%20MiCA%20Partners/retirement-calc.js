/* Bitcoin Retirement Calculator (retirement-calculator.html, all languages).
   Strings: <script type="application/json" id="rc-i18n"> written by
   i18n-tools/retirement/build_retirement.py; number/date formats from <html lang>.
   No dependencies, ES5. Nothing is stored or sent; the only request is the CoinGecko price. */
(function () {
  'use strict';

  // ---------- pure math (also exposed as window.VBRetire for tests) ----------

  // Simulate from current age with a given starting stack (BTC).
  // Saving years (age < retAge): monthly savings buy BTC at that month's price.
  // Retirement (age >= retAge): the year's inflation-adjusted spending is withdrawn at the start of the year.
  function simulate(startStack, p) {
    var series = [];
    var stack = startStack;
    var yearsToRet = Math.max(0, p.retAge - p.age);
    var depletedAt = null;
    var btcAtRet = 0, valueAtRet = 0, spendAtRet = 0;

    for (var age = p.age; age <= p.life; age++) {
      var t = age - p.age;
      var priceNow = p.price * Math.pow(1 + p.growth, t);
      if (age < p.retAge) {
        for (var m = 0; m < 12; m++) {
          stack += p.dca / (p.price * Math.pow(1 + p.growth, t + m / 12));
        }
      } else {
        var spendNow = p.spend * Math.pow(1 + p.inflation, t);
        if (age === p.retAge) spendAtRet = spendNow;
        stack -= spendNow / priceNow;
        if (stack < 0 && depletedAt === null) { depletedAt = age; stack = 0; }
      }
      if (age === p.retAge - 1) {
        btcAtRet = stack;
        valueAtRet = stack * p.price * Math.pow(1 + p.growth, p.retAge - p.age);
      }
      series.push({ age: age, value: stack * priceNow, phase: age < p.retAge ? 'acc' : 'ret' });
    }
    if (p.retAge <= p.age) { btcAtRet = startStack; valueAtRet = startStack * p.price; }
    if (spendAtRet === 0) spendAtRet = p.spend * Math.pow(1 + p.inflation, yearsToRet);
    return { series: series, depletedAt: depletedAt, btcAtRet: btcAtRet, valueAtRet: valueAtRet, spendAtRet: spendAtRet };
  }

  var NEEDED_CAP = 1e12;
  // Smallest stack today that lasts to life expectancy when retiring at retAge with no more savings.
  // Returns Infinity when even NEEDED_CAP BTC is not enough.
  function btcNeededToday(p) {
    var q = { age: p.age, retAge: p.retAge, life: p.life, dca: 0, spend: p.spend, growth: p.growth, inflation: p.inflation, price: p.price };
    if (p.spend <= 0) return 0;
    var ok = function (s) { return simulate(s, q).depletedAt === null; };
    var hi = 1;
    while (!ok(hi)) {
      hi *= 2;
      if (hi > NEEDED_CAP) return Infinity;
    }
    var lo = 0;
    for (var i = 0; i < 80 && (hi - lo) > hi * 1e-10; i++) {
      var mid = (lo + hi) / 2;
      if (ok(mid)) hi = mid; else lo = mid;
    }
    return hi;
  }

  // "250k", "2.5M", "1,000,000", "1.000.000", "2,5" ... -> number (NaN if not a number)
  function parseNum(raw, kind) {
    var s = String(raw).toLowerCase().replace(/[\s  '’€%]|btc|eur/g, '');
    var neg = false;
    if (s.charAt(0) === '-' || s.charAt(0) === '−') { neg = true; s = s.slice(1); }
    var mult = 1, m = s.match(/(k|mio|mn|m|bn|b)$/);
    if (m) { mult = m[1] === 'k' ? 1e3 : (m[1].charAt(0) === 'b' ? 1e9 : 1e6); s = s.slice(0, -m[1].length); }
    if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return NaN;
    var dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length, i, parts;
    if (dots && commas) {
      var dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
      s = s.split(dec === '.' ? ',' : '.').join('');
      if (s.split(dec).length > 2) return NaN;
      s = s.replace(dec, '.');
    } else if (dots + commas > 1) {
      parts = s.split(dots ? '.' : ',');
      for (i = 1; i < parts.length; i++) if (parts[i].length !== 3) return NaN;
      s = parts.join('');
    } else if (dots + commas === 1) {
      parts = s.split(dots ? '.' : ',');
      var thousands = mult === 1 && kind === 'eur' && parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== '0';
      s = thousands ? parts[0] + parts[1] : (parts[0] || '0') + '.' + parts[1];
    }
    var n = parseFloat(s) * mult;
    if (!isFinite(n)) return NaN;
    return neg ? -n : n;
  }

  window.VBRetire = { simulate: simulate, btcNeededToday: btcNeededToday, parseNum: parseNum };

  // ---------- page ----------
  var dataEl = document.getElementById('rc-i18n');
  if (!dataEl || !document.getElementById('rc-form')) return;
  var S = {};
  try { S = JSON.parse(dataEl.textContent); } catch (e) { S = {}; }
  var lang = document.documentElement.lang || 'en';
  function $(id) { return document.getElementById(id); }
  function tr(key, a, b) {
    var s = S[key] || '';
    return s.replace('{0}', a === undefined ? '' : a).replace('{1}', b === undefined ? '' : b);
  }
  function nf(opts) {
    try { return new Intl.NumberFormat(lang, opts); } catch (e) { return new Intl.NumberFormat('en', opts); }
  }
  function eur(n, digits) {
    if (!isFinite(n)) return '…';
    if (Math.abs(n) >= 1e6) {
      try { return nf({ style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: digits === undefined ? 2 : digits }).format(n); } catch (e) {}
    }
    return nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
  }
  function btc(n) {
    if (!isFinite(n)) return '…';
    var d = n >= 100 ? 1 : n >= 1 ? 2 : 4;
    return nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(n) + ' BTC';
  }
  function plainNum(n, kind) {
    var d = kind === 'btc' ? 8 : kind === 'pct' ? 1 : 0;
    return nf({ maximumFractionDigits: d }).format(n);
  }
  var PCT = /^(sk|cs|de|fr|es)\b/.test(lang) ? '\u00a0%' : '%';   // space before % as on the pages
  function pct(n) { return nf({ maximumFractionDigits: 1 }).format(n) + PCT; }

  var st = { age: 30, ret: 50, life: 85, stack: 0.1, lump: 0, dca: 250, spend: 60000, growth: 20, inf: 2, price: +$('rc-price').value || 74649 };
  var custom = false, manualPrice = false, livePrice = null, liveTime = null;

  // typed field (+ optional slider "<id>-r")
  function bindTyped(key, id, onChange) {
    var inp = $(id), rng = $(id + '-r'), err = $(id + '-e');
    var kind = inp.getAttribute('data-kind'), lo = +inp.getAttribute('data-min'), hi = +inp.getAttribute('data-max');
    function show(msg) { err.textContent = msg || ''; err.hidden = !msg; }
    function syncSlider() { if (rng) rng.value = Math.min(st[key], +rng.max); }
    inp.addEventListener('input', function () {
      if (inp.value.replace(/\s/g, '') === '') { show(''); return; }
      var n = parseNum(inp.value, kind);
      if (isNaN(n)) { show(S.c_err_number); return; }
      if (n > hi) { n = hi; show(tr('c_err_max', plainNum(hi, kind))); }
      else if (n < lo) { n = lo; show(tr('c_err_min', plainNum(lo, kind))); }
      else show('');
      st[key] = n; syncSlider(); if (onChange) onChange('typed'); recalc();
    });
    inp.addEventListener('change', function () { inp.value = plainNum(st[key], kind); });
    if (rng) rng.addEventListener('input', function () {
      st[key] = +rng.value; inp.value = plainNum(st[key], kind); show(''); if (onChange) onChange('slider'); recalc();
    });
    inp.value = plainNum(st[key], kind); syncSlider();
    return { set: function (v) { st[key] = v; inp.value = plainNum(v, kind); syncSlider(); show(''); } };
  }
  function bindAge(key) {
    var rng = $('rc-' + key);
    rng.addEventListener('input', function () { st[key] = +rng.value; recalc(); });
  }

  var fStack = bindTyped('stack', 'rc-stack'), fLump = bindTyped('lump', 'rc-lump'), fDca = bindTyped('dca', 'rc-dca'), fSpend = bindTyped('spend', 'rc-spend');
  var customField = bindTyped('growth', 'rc-gc');
  var priceField = bindTyped('price', 'rc-price', function () { manualPrice = true; priceNote(); });
  bindAge('age'); bindAge('ret'); bindAge('life');
  $('rc-inf').addEventListener('input', function () { st.inf = +$('rc-inf').value; recalc(); });

  var btns = document.querySelectorAll('.rc-btn[data-g]');
  function press(btn) {
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i] === btn ? 'true' : 'false');
    var g = btn.getAttribute('data-g');
    custom = g === 'custom';
    $('rc-custom').hidden = !custom;
    if (!custom) customField.set(+g);
    recalc();
  }
  for (var bi = 0; bi < btns.length; bi++) btns[bi].addEventListener('click', function () { press(this); });

  function fmtTime(sec) {
    var o = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    try { return new Intl.DateTimeFormat(lang, o).format(new Date(sec * 1000)); } catch (e) { return new Date(sec * 1000).toLocaleString(); }
  }
  function priceNote(state) {
    var note = $('rc-price-note');
    if (state === 'loading') { note.textContent = S.c_price_loading; return; }
    if (manualPrice) {
      note.textContent = S.c_price_manual + ' ';
      if (livePrice) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'rc-reset'; b.textContent = S.c_price_reset;
        b.addEventListener('click', function () { manualPrice = false; priceField.set(livePrice); priceNote(); recalc(); });
        note.appendChild(b);
      }
      return;
    }
    note.textContent = livePrice ? tr('c_price_live', fmtTime(liveTime)) : S.c_price_fallback;
  }

  // ---------- chart ----------
  function drawChart(series, retAge) {
    var canvas = $('rc-chart');
    var w = canvas.clientWidth, h = canvas.clientHeight || 280;
    if (!w) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var css = getComputedStyle(document.documentElement);
    var cOrange = css.getPropertyValue('--orange').trim() || '#f7931a';
    var cText = css.getPropertyValue('--text').trim() || '#e6edf3';
    var cLine = css.getPropertyValue('--line-strong').trim() || 'rgba(255,255,255,.14)';
    var cDim = css.getPropertyValue('--dim').trim() || '#7d8590';
    ctx.font = '11px Inter, -apple-system, sans-serif';

    var maxV = 0;
    for (var i = 0; i < series.length; i++) if (isFinite(series[i].value) && series[i].value > maxV) maxV = series[i].value;
    if (!(maxV > 0)) maxV = 1;
    var labels = [], lw = 0;
    var axis = nf({ style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
    for (var g = 0; g <= 4; g++) {
      var txt; try { txt = axis.format(maxV * g / 4); } catch (e) { txt = eur(maxV * g / 4); }
      labels.push(txt); lw = Math.max(lw, ctx.measureText(txt).width);
    }
    var padL = Math.ceil(lw) + 12, padR = 10, padT = 10, padB = 24;
    var minAge = series[0].age, maxAge = series[series.length - 1].age;
    function x(a) { return padL + (a - minAge) / Math.max(1, maxAge - minAge) * (w - padL - padR); }
    function y(v) { return padT + (1 - Math.min(v, maxV) / maxV) * (h - padT - padB); }

    ctx.lineWidth = 1; ctx.textBaseline = 'middle';
    for (g = 0; g <= 4; g++) {
      var yy = Math.round(y(maxV * g / 4)) + 0.5;
      ctx.strokeStyle = cLine; ctx.globalAlpha = g === 0 ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - padR, yy); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = cDim; ctx.textAlign = 'right';
      ctx.fillText(labels[g], padL - 8, yy);
    }
    var span = maxAge - minAge, step = span >= 20 ? 10 : span >= 8 ? 5 : 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (var a = Math.ceil(minAge / step) * step; a <= maxAge; a += step) ctx.fillText(String(a), x(a), h - 6);

    if (retAge > minAge && retAge < maxAge) {
      ctx.strokeStyle = cDim; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x(retAge), padT); ctx.lineTo(x(retAge), h - padB); ctx.stroke();
      ctx.setLineDash([]);
    }
    function phase(acc, color) {
      var pts = [];
      for (var k = 0; k < series.length; k++) {
        var s = series[k];
        if (acc ? s.age <= retAge : s.age >= retAge) pts.push(s);
      }
      if (pts.length < 2) return;
      ctx.beginPath(); ctx.moveTo(x(pts[0].age), y(pts[0].value));
      for (k = 1; k < pts.length; k++) ctx.lineTo(x(pts[k].age), y(pts[k].value));
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineTo(x(pts[pts.length - 1].age), y(0)); ctx.lineTo(x(pts[0].age), y(0)); ctx.closePath();
      ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
    }
    phase(true, cOrange);
    phase(false, cText);
  }

  // ---------- settings in the URL + "Copy link to this result" ----------
  // Same idea as Stacking/Loan: after the first change the URL carries the plan
  // (replaceState), and the share button copies it with utm_source=share.
  var URL_KEYS = ['age', 'ret', 'life', 'stack', 'lump', 'dca', 'spend', 'growth', 'inf'];
  function urlFor(s) {
    var u = new URL(window.location.href);
    for (var i = 0; i < URL_KEYS.length; i++) u.searchParams.set(URL_KEYS[i], String(+s[URL_KEYS[i]].toFixed(8)));
    if (manualPrice) u.searchParams.set('price', String(Math.round(s.price))); else u.searchParams['delete']('price');
    return u;
  }
  function stateKey() { return URL_KEYS.map(function (k) { return st[k]; }).join('|') + '|' + (manualPrice ? st.price : ''); }
  var startKey = null, urlDirty = false, reading = false;
  function writeUrl() {
    if (reading) return;
    if (startKey === null) { startKey = stateKey(); return; }
    if (!urlDirty && stateKey() === startKey) return;
    urlDirty = true;
    try { var u = urlFor(st); window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
  }
  function readUrl() {
    var q;
    try { q = new URL(window.location.href).searchParams; } catch (e) { return; }
    reading = true;
    function num(k) { var v = q.get(k); if (v === null || v === '') return null; var n = +v; return isFinite(n) ? n : null; }
    function clampTo(el, n) { return Math.min(+el.max, Math.max(+el.min, n)); }
    var ages = ['age', 'ret', 'life'];
    for (var i = 0; i < ages.length; i++) {
      var n = num(ages[i]);
      if (n !== null) { var el = $('rc-' + ages[i]); el.value = clampTo(el, Math.round(n)); st[ages[i]] = +el.value; }
    }
    var typed = { stack: ['rc-stack', fStack], lump: ['rc-lump', fLump], dca: ['rc-dca', fDca], spend: ['rc-spend', fSpend] };
    for (var k in typed) {
      var v = num(k);
      if (v === null) continue;
      var inp = $(typed[k][0]);
      typed[k][1].set(Math.min(+inp.getAttribute('data-max'), Math.max(+inp.getAttribute('data-min'), v)));
    }
    var inf = num('inf');
    if (inf !== null) { var ie = $('rc-inf'); ie.value = clampTo(ie, inf); st.inf = +ie.value; }
    var g = num('growth');
    if (g !== null) {
      var gi = $('rc-gc'), gv = Math.min(+gi.getAttribute('data-max'), Math.max(+gi.getAttribute('data-min'), g));
      var match = null;
      for (var b = 0; b < btns.length; b++) if (btns[b].getAttribute('data-g') === String(gv)) match = btns[b];
      if (match) press(match);
      else {
        for (var c = 0; c < btns.length; c++) if (btns[c].getAttribute('data-g') === 'custom') press(btns[c]);
        customField.set(gv);
      }
    }
    var pr = num('price');
    if (pr !== null && pr > 0) {
      var pi = $('rc-price');
      manualPrice = true;
      priceField.set(Math.min(+pi.getAttribute('data-max'), Math.max(+pi.getAttribute('data-min'), pr)));
    }
    reading = false;
  }
  function copyText(text, done) {
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacy()); });
    } else done(legacy());
  }
  function addShare() {
    var chart = document.querySelector('.rc-chart');
    if (!chart || !S.c_share) return;
    var box = document.createElement('div'); box.className = 'rc-share';
    var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rc-link'; btn.setAttribute('data-cta', 'tool_share');
    btn.textContent = S.c_share;
    var live = document.createElement('span'); live.setAttribute('aria-live', 'polite');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    var field = document.createElement('input'); field.readOnly = true; field.hidden = true; field.setAttribute('aria-label', S.c_share_field || S.c_share);
    field.addEventListener('focus', function () { field.select(); });
    box.appendChild(btn); box.appendChild(live); box.appendChild(field);
    chart.parentNode.insertBefore(box, chart.nextSibling);
    var t;
    btn.addEventListener('click', function () {
      var u = urlFor(st);
      var del = [];
      u.searchParams.forEach(function (v, key) { if (key.indexOf('utm_') === 0) del.push(key); });
      for (var i = 0; i < del.length; i++) u.searchParams['delete'](del[i]);
      u.searchParams.set('utm_source', 'share'); u.searchParams.set('utm_medium', 'link'); u.searchParams.set('utm_campaign', 'tool_share_retirement');
      u.hash = '';
      var url = u.toString();
      copyText(url, function (ok) {
        try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'tool_share', tool: 'retirement', page_lang: lang, share_method: ok ? 'copy' : 'copy_failed' }); } catch (e) {}
        if (ok) {
          btn.textContent = S.c_share_done || S.c_share; live.textContent = S.c_share_done || '';
          clearTimeout(t); t = setTimeout(function () { btn.textContent = S.c_share; live.textContent = ''; }, 2500);
        } else { field.value = url; field.hidden = false; field.focus(); }
      });
    });
  }

  // ---------- recalc ----------
  var last = null;
  function recalc() {
    if (st.ret < st.age) { st.ret = st.age; $('rc-ret').value = st.ret; }
    if (st.life < st.ret) { st.life = st.ret; $('rc-life').value = st.life; }
    if (+$('rc-life').value !== st.life) $('rc-life').value = st.life;   // slider min can lift it
    st.life = +$('rc-life').value;
    if (st.life < st.ret) { st.ret = st.life; $('rc-ret').value = st.ret; }
    $('rc-age-v').textContent = st.age; $('rc-ret-v').textContent = st.ret; $('rc-life-v').textContent = st.life;
    $('rc-g-v').textContent = pct(st.growth); $('rc-inf-v').textContent = pct(st.inf);

    var price = st.price > 0 ? st.price : 1;
    var p = { age: st.age, retAge: st.ret, life: st.life, stack: st.stack + st.lump / price, dca: st.dca, spend: st.spend,
              growth: st.growth / 100, inflation: st.inf / 100, price: price };
    var r = simulate(p.stack, p);
    var need = btcNeededToday(p);
    last = { p: p, r: r, need: need };

    var yrs = Math.max(0, p.retAge - p.age);
    $('rc-r-btc').textContent = btc(r.btcAtRet);
    $('rc-r-btc-s').textContent = yrs ? tr('c_res_btc_sub', yrs) : S.c_res_btc_sub_now;
    $('rc-r-val').textContent = eur(r.valueAtRet);
    $('rc-r-sp').textContent = eur(r.spendAtRet);
    $('rc-r-sp-s').textContent = tr('c_res_spend_sub', p.retAge);
    $('rc-r-need-l').textContent = tr('c_res_needed', p.retAge);
    if (isFinite(need)) {
      $('rc-r-need').textContent = btc(need);
      $('rc-r-need-s').textContent = tr('c_res_needed_sub', eur(need * price));
    } else {
      $('rc-r-need').textContent = tr('c_res_needed_more', btc(NEEDED_CAP));
      $('rc-r-need-s').textContent = '';
    }

    var v = $('rc-verdict');
    if (r.depletedAt === null) {
      v.className = 'rc-verdict ok'; $('rc-icon').textContent = '✓';
      $('rc-v-title').textContent = tr('c_ok_title', p.retAge);
      $('rc-v-sub').textContent = tr('c_ok_sub', p.life);
    } else {
      v.className = 'rc-verdict bad'; $('rc-icon').textContent = '!';
      $('rc-v-title').textContent = tr('c_bad_title', r.depletedAt);
      $('rc-v-sub').textContent = tr('c_bad_sub', p.life);
    }
    $('rc-cfo').hidden = !(p.stack >= 5 || p.spend >= 100000);
    drawChart(r.series, p.retAge);
    writeUrl();
  }
  window.VBRetire.last = function () { return last; };

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (last) drawChart(last.r.series, last.p.retAge); }, 120); });

  readUrl();
  addShare();
  priceNote(manualPrice ? undefined : 'loading');
  recalc();

  // live BTC/EUR (CoinGecko); the typed price stays editable
  if (window.fetch) {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur&include_last_updated_at=true')
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (d) {
        var b = d && d.bitcoin;
        if (!b || !(b.eur > 0)) throw new Error('no price');
        livePrice = b.eur; liveTime = b.last_updated_at || Math.floor(Date.now() / 1000);
        if (!manualPrice) { priceField.set(Math.round(livePrice)); recalc(); }
        priceNote();
      })
      .catch(function () { priceNote(); });
  } else { priceNote(); }
})();
