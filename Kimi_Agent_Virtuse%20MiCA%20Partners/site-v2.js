/* site-v2.js: shared behaviour for design-v2 pages (from the v2 homepage, 2026-10-09).
   Texts come from window.VB_I18N (set inline by translated pages); English is the default. */
(function () {
  var T = window.VB_I18N || {};
  function t(k, d) { return T[k] != null ? T[k] : d; }
  var LANG = (document.documentElement.lang || 'en').slice(0, 2);
  var LOC = { en: 'en-IE', sk: 'sk-SK', cs: 'cs-CZ', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', pl: 'pl-PL', hu: 'hu-HU', uk: 'uk-UA', ru: 'ru-RU' }[LANG] || 'en-IE';
  var EUR_AFTER = LANG !== 'en';
  function eur(n) { var s = Math.round(n).toLocaleString(LOC); return EUR_AFTER ? s + ' €' : '€' + s; }
  window.VB = { t: t, LANG: LANG, LOC: LOC, eur: eur };

  // CFO stage (meta vb-cfo-stage: wait | audit)
  document.body.classList.toggle('stage-wait', (document.querySelector('meta[name="vb-cfo-stage"]') || {}).content !== 'audit');

  // NAV v2: menu button, dropdown groups
  (function () {
    var nav = document.querySelector('.nav'), btn = document.getElementById('menuBtn');
    if (!nav) return;
    if (btn) {
      var set = function (open) { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? t('closeMenu', 'Close menu') : t('openMenu', 'Open menu')); };
      btn.addEventListener('click', function () { set(!nav.classList.contains('open')); });
      document.querySelectorAll('#navLinks a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    }
    var groups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));
    function closeAll(except) { groups.forEach(function (g) { if (g !== except) { g.classList.remove('open'); g.querySelector('.nav-group-btn').setAttribute('aria-expanded', 'false'); } }); }
    groups.forEach(function (g) {
      var b = g.querySelector('.nav-group-btn');
      b.addEventListener('click', function (e) { e.stopPropagation(); var o = !g.classList.contains('open'); closeAll(g); g.classList.toggle('open', o); b.setAttribute('aria-expanded', String(o)); });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.nav-group')) closeAll(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  })();

  // Language menu
  (function () {
    var wrap = document.getElementById('langMenu'); if (!wrap) return;
    var btn = wrap.querySelector('.lang-menu-btn');
    btn.addEventListener('click', function (e) { e.stopPropagation(); var o = !wrap.classList.contains('open'); wrap.classList.toggle('open', o); btn.setAttribute('aria-expanded', String(o)); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  })();

  // Stage badges
  (function () {
    var audit = !document.body.classList.contains('stage-wait');
    document.querySelectorAll('.nav-badge, .cfo-foot-badge').forEach(function (b) { b.textContent = audit ? t('new', 'New') : t('soon', 'Soon'); });
  })();

  // Footer wordmark: letters rise in once when the footer comes into view
  (function () {
    var wm = document.querySelector('.footer-wordmark'); if (!wm) return;
    var icon = wm.querySelector('.footer-wordmark-icon-wrap'); if (icon) icon.style.setProperty('--d', '0ms');
    wm.querySelectorAll('.wl').forEach(function (l, i) { l.style.setProperty('--d', (120 + i * 70) + 'ms'); });
    if (!document.documentElement.classList.contains('anim') || !('IntersectionObserver' in window)) { wm.classList.add('in'); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { wm.classList.add('in'); io.disconnect(); } }); }, { threshold: 0.2 });
    io.observe(wm);
  })();

  // Fee calculator (#amt slider + #feeRows), as on the homepage
  (function () {
    var amt = document.getElementById('amt'), out = document.getElementById('amtOut'); if (!amt || !out) return;
    var rows = document.querySelectorAll('#feeRows .row[data-pct]');
    function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
    function update() {
      var m = Number(amt.value);
      out.textContent = m.toLocaleString(LOC);
      rows.forEach(function (r) {
        var p = Number(r.dataset.pct);
        r.querySelector('.yr').textContent = eur(m * 12 * p / 100);
        var f = r.querySelector('.fill'); if (f) f.style.width = (p === 0 ? 2 : (p / 0.8) * 100) + '%';
      });
      var y = m * 12 * 0.8 / 100;
      set('diffYr', eur(y)); set('saveEnd', eur(y * 10)); set('diffBase', eur(m * 12)); set('diff10', eur(y * 10));
    }
    amt.addEventListener('input', update); update();
  })();

  // Hero comparison table: "Show all 5" on phones
  (function () {
    var b = document.getElementById('hcToggle'); if (!b) return;
    var box = b.closest('.hcard'), more = b.textContent, less = b.getAttribute('data-less');
    b.addEventListener('click', function () { var o = box.classList.toggle('show-all'); b.setAttribute('aria-expanded', String(o)); b.textContent = o ? less : more; });
  })();

  // Partner cards: details open on wide screens, collapsed on phones
  (function () {
    var ds = document.querySelectorAll('details.pc-more'); if (!ds.length || !window.matchMedia) return;
    var mq = window.matchMedia('(max-width: 640px)');
    function apply() { ds.forEach(function (d) { d.open = !mq.matches; }); }
    apply(); if (mq.addEventListener) mq.addEventListener('change', apply);
  })();

  // Brief: live BTC/EUR sparkline (Binance daily closes, 90 days); hidden if the fetch fails
  (function () {
    var box = document.getElementById('btcSpark'); if (!box) return;
    fetch('https://api.binance.com/api/v3/klines?symbol=BTCEUR&interval=1d&limit=90').then(function (r) { return r.json(); }).then(function (k) {
      var c = k.map(function (x) { return Number(x[4]); }).filter(function (v) { return v > 0; }); if (c.length < 10) return;
      var lo = Math.min.apply(null, c), hi = Math.max.apply(null, c), W = 300, H = 56;
      var pts = c.map(function (v, i) { return [i / (c.length - 1) * W, H - 4 - (v - lo) / (hi - lo || 1) * (H - 8)]; });
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      document.getElementById('btcLine').setAttribute('d', d);
      document.getElementById('btcArea').setAttribute('d', d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z');
      var last = c[c.length - 1], chg = (last / c[0] - 1) * 100;
      document.getElementById('btcLast').textContent = eur(last);
      var pct = chg.toFixed(1); if (LANG !== 'en') pct = pct.replace('.', ',');
      var e = document.getElementById('btcChg'); e.textContent = (chg >= 0 ? '+' : '') + pct + (/^(sk|cs|de|fr|es)$/.test(LANG) ? ' %' : '%'); e.className = chg >= 0 ? 'up' : 'down';
      box.hidden = false;
    }).catch(function () {});
  })();

  // Latest Brief: newest non-essay issue in news/issues.json (static card is the fallback)
  (function () {
    var card = document.getElementById('briefIssue'); if (!card) return;
    var root = card.getAttribute('data-root') || '';
    fetch(root + 'news/issues.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      var iss = (d.issues || []).filter(function (x) { return x && x.slug && x.title && !x.essay; })[0]; if (!iss) return;
      var when = new Date(iss.date + 'T12:00:00Z').toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
      card.href = root + 'article.html?slug=' + encodeURIComponent(iss.slug) + (LANG !== 'en' ? '&lang=' + LANG : '');
      document.getElementById('briefMeta').textContent = t('latestBrief', 'Latest Brief · ') + when + ' · ' + (iss.read_min || 3) + t('min', ' min');
      document.getElementById('briefTitle').textContent = iss.title + t('briefLangNote', '');
      document.getElementById('briefExcerpt').textContent = iss.excerpt || '';
      var img = document.getElementById('briefImg'); if (img && iss.image) { img.src = iss.image; img.alt = t('coverImage', 'Cover image: ') + iss.title; }
    }).catch(function () {});
  })();

  // Brief signup -> the newsletter Worker
  (function () {
    var form = document.getElementById('briefForm'), msg = document.getElementById('briefMsg'); if (!form) return;
    var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements['email'].value.trim(), hp = form.elements['website'].value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = t('badEmail', 'Please enter a valid email address.'); return; }
      msg.textContent = ''; btn.disabled = true; btn.textContent = t('sending', 'Sending...');
      fetch('https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, hp: hp, lang: LANG })
      }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (r) {
          if (r.ok) {
            form.reset(); msg.textContent = t('subscribed', "You're in. Brief goes out Monday.");
            (window.dataLayer = window.dataLayer || []).push({ event: 'capture_submit', capture_source: form.getAttribute('data-source') || 'page_brief', capture_brief: true });
          } else { msg.textContent = (r.data && r.data.error) || t('error', 'Something went wrong. Please try again.'); }
        })
        .catch(function () { msg.textContent = t('netError', 'Network error. Please try again.'); })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  })();
})();

/* MOTION v1 (see CSS). Reveals, word-by-word headline, count-ups, bar growth, spotlight. */
(function () {
  var root = document.documentElement;
  var on = root.classList.contains('anim') && 'IntersectionObserver' in window;
  if (!on) root.classList.remove('anim');
  try {
  var GROUPS = '.pgrid, .guide-links, .cat-stats, .shelf6, .tiles, .plans3, .plans, .problem-grid, .how-log, .ask-side, .assure-row, .tools, .promises, .proof, .feature, .cfo-panel, .ask, .calc, .footer-columns';
  var CARDS = '.pcard2, .shelf6 > a, .tile, .plan, .problem-card, .tool, .promises > *, .ask-side > div, .audit-card, #buy .panel, .demo, .chat-panel, .code';

  // spotlight works with or without motion
  document.querySelectorAll('.pcard2, .shelf6 > a, .tile, .plan, .problem-card, .tool, .audit-card, #buy .panel, .demo').forEach(function (c) {
    c.classList.add('spot');
    c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
  });
  if (!on) return;

  // 1. headline words
  function split(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--d', (i++ * 45) + 'ms'); w.textContent = part; frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('w')) walk(n);
      });
    })(el);
    return i;
  }
  var h1 = document.querySelector('main h1');
  var heroWords = h1 ? split(h1) : 0;
  if (h1) requestAnimationFrame(function () { requestAnimationFrame(function () { h1.classList.add('split-in'); }); });

  // 2. mark reveal targets
  var heroBox = h1 ? h1.parentElement : null;
  if (heroBox) Array.prototype.slice.call(heroBox.children).forEach(function (c, k) {
    if (c === h1) return; c.classList.add('rv'); c.style.setProperty('--d', (heroWords * 45 + 120 + k * 90) + 'ms');
  });
  if (heroBox && heroBox.nextElementSibling && heroBox.parentElement.tagName !== 'MAIN') {
    var side = heroBox.nextElementSibling; side.classList.add('rv', 'rv-card'); side.style.setProperty('--d', '250ms');
  }
  document.querySelectorAll('main section, footer').forEach(function (sec) {
    var head = sec.querySelector('.sec-head');
    if (head) Array.prototype.slice.call(head.querySelectorAll('h2, .sec-sub, .k, .note, p.lead')).forEach(function (c, k) { c.classList.add('rv'); c.style.setProperty('--d', (k * 90) + 'ms'); });
  });
  document.querySelectorAll(GROUPS).forEach(function (g) {
    if (g.closest('.rv') && !g.closest('.feature, .cfo-panel, .ask')) return;
    Array.prototype.slice.call(g.children).forEach(function (c, k) {
      c.classList.add('rv'); if (c.matches(CARDS)) c.classList.add('rv-card');
      c.style.setProperty('--d', (Math.min(k, 6) * 90) + 'ms');
    });
  });
  document.querySelectorAll('main section > *:not(.sec-head):not(.rv), .co-ticker, .billing, .shelf-disclose, .close > *').forEach(function (b) {
    if (b.querySelector('.rv') || b.closest('.rv') || b.matches('.note')) return;
    b.classList.add('rv');
  });

  // 3. bars wait until seen
  document.querySelectorAll('#buy .panel, .audit-card').forEach(function (c) { c.classList.add('bars-wait'); });

  // 4. count-ups for big figures written as text, e.g. €341
  function countUp(el) {
    if (el.dataset.counted) return; el.dataset.counted = '1';
    var node = el.firstChild; if (!node || node.nodeType !== 3) return;
    var m = node.textContent.match(/^(\s*[€$]?)([\d,]+)(.*)$/); if (!m) return;
    var target = Number(m[2].replace(/,/g, '')), t0 = performance.now();
    (function tick(t) { var p = Math.min(1, (t - t0) / 1200); node.textContent = m[1] + Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IE') + m[3]; if (p < 1) requestAnimationFrame(tick); })(t0);
  }

  // 5. observe
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      el.classList.add('in');
      if (el.classList.contains('how-log') || el.querySelector('.how-log')) {
        var log = el.classList.contains('how-log') ? el : el.querySelector('.how-log');
        log.querySelectorAll('.how-log-dot').forEach(function (d, k) { d.style.setProperty('--dd', (500 + k * 260) + 'ms'); });
        log.classList.add('drawn');
      }
      el.querySelectorAll('.bars-wait').forEach(function (b) { setTimeout(function () { b.classList.remove('bars-wait'); }, 350); });
      if (el.classList.contains('bars-wait')) setTimeout(function () { el.classList.remove('bars-wait'); }, 350);
      el.querySelectorAll('.audit-card .big').forEach(countUp);
      if (el.matches('.audit-card')) el.querySelectorAll('.big').forEach(countUp);
    });
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  document.querySelectorAll('.how-log').forEach(function (el) { io.observe(el); });

  // safety: never leave content hidden
  setTimeout(function () { document.querySelectorAll('.rv:not(.in)').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < innerHeight * 1.5) el.classList.add('in'); }); }, 1200);
  } catch (err) { root.classList.remove('anim'); }
})();
