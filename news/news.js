/* Virtuse Brief: ticker, theme, pulse, issues, blog, subscribe. */
(function () {
  'use strict';

  /* Language: news.html is English, sk/news.html Slovak (same script). */
  var LANG = /^sk/i.test(document.documentElement.lang || '') ? 'sk' : 'en';
  var LOC = LANG === 'sk' ? 'sk-SK' : 'en-US';
  var I18N = {
    en: {
      pulseUnavailable: 'Pulse unavailable', updated: 'Updated', updatedNow: 'Updated just now', ago: 'ago', min: 'min', h: 'h',
      deskUpdating: 'Desk updating. The next update is on its way.', today: 'Today', story: 'Story', yesterday: 'Yesterday', earlier: 'Earlier',
      switchTo: 'Switch to ', themeWord: ' theme', light: 'light', dark: 'dark',
      emailRequired: 'Email is required.', emailInvalid: 'Please enter a valid email address.', sending: 'Sending',
      subOk: 'You are on the list. Check your inbox.', subFail: 'Could not join the list. Try again.', netErr: 'Network error. Try again.',
      fullStory: 'Full story', readBrief: 'Read this Brief', readAt: 'Read at ', readEssay: 'Read essay',
      beforeRelease: 'Before the release', liveFigures: 'Live figures', unavailable: 'unavailable', gold: 'Gold',
      yoy: 'y/y', mom: 'm/m', flash: 'flash', yoyNotPub: 'y/y not published by BLS', d1: '1d',
      last: 'Last', next: 'Next', expects: 'Market expects', asOf: 'as of', stale: 'older than 3 days',
      kalshiNote: 'Market expects: Kalshi prediction markets, implied probability of the most likely outcome',
      tagNames: { ETF: 'ETF', Macro: 'Macro', World: 'World', Policy: 'Policy', Mining: 'Mining', Security: 'Security' },
      inEnglish: 'In English', source: 'Source', ecbRate: 'ECB deposit rate', btcEur: 'BTC in EUR', skInfl: 'Inflation, Slovakia', nextDecision: 'next decision'
    },
    sk: {
      pulseUnavailable: 'Pulse je nedostupný', updated: 'Aktualizované pred', updatedNow: 'Aktualizované práve teraz', ago: '', min: 'min', h: 'h',
      deskUpdating: 'Redakcia aktualizuje. Ďalšia aktualizácia je na ceste.', today: 'Dnes', story: 'Článok', yesterday: 'Včera', earlier: 'Skôr',
      switchTo: 'Prepnúť na ', themeWord: ' režim', light: 'svetlý', dark: 'tmavý',
      emailRequired: 'Zadaj e-mail.', emailInvalid: 'Zadaj platnú e-mailovú adresu.', sending: 'Odosiela sa',
      subOk: 'Si na zozname. Skontroluj si schránku.', subFail: 'Prihlásenie sa nepodarilo. Skús to znova.', netErr: 'Chyba siete. Skús to znova.',
      fullStory: 'Celý článok', readBrief: 'Čítať Brief', readAt: 'Čítať na ', readEssay: 'Čítať esej',
      beforeRelease: 'Pred zverejnením', liveFigures: 'Živé údaje', unavailable: 'nedostupné', gold: 'Zlato',
      yoy: 'r/r', mom: 'm/m', flash: 'predbežne', yoyNotPub: 'r/r BLS nezverejnil', d1: '1 d',
      last: 'Naposledy', next: 'Ďalej', expects: 'Trh čaká', asOf: 'k', stale: 'staršie ako 3 dni',
      kalshiNote: 'Trh čaká: trhy predikcií Kalshi, implikovaná pravdepodobnosť najčastejšieho scenára',
      tagNames: { ETF: 'ETF', Macro: 'Makro', World: 'Svet', Policy: 'Regulácia', Mining: 'Ťažba', Security: 'Bezpečnosť' },
      inEnglish: 'Text v angličtine', source: 'Zdroj', ecbRate: 'Sadzba ECB (depozitná)', btcEur: 'BTC v EUR', skInfl: 'Inflácia na Slovensku', nextDecision: 'ďalšie rozhodnutie'
    }
  };
  function tr(k) { var v = I18N[LANG][k]; return v == null ? I18N.en[k] : v; }
  function tagLabel(t) { return (tr('tagNames') || {})[t] || t; }
  /* Pulse copy in the page language. The desk sends title_sk / excerpt_sk;
     on sk/news.html an item without them shows the English text (en: true),
     marked with markEn(). Filters and tag guesses always read the English. */
  function localCopy(it) {
    var sk = LANG === 'sk' && it && typeof it.title_sk === 'string' && it.title_sk.trim();
    if (sk) return { title: it.title_sk, excerpt: typeof it.excerpt_sk === 'string' ? it.excerpt_sk : '', en: false };
    return { title: (it && it.title) || '', excerpt: (it && it.excerpt) || '', en: LANG === 'sk' };
  }
  function markEn(el) {
    var m = document.createElement('span');
    m.className = 'lang-mark';
    m.lang = 'en';
    m.title = tr('inEnglish');
    m.setAttribute('aria-label', tr('inEnglish'));
    m.textContent = 'EN';
    el.appendChild(m);
  }

  var MP = 'https://mempool.space/api';
  var WP = LANG === 'sk' ? 'https://blog.virtuse.com/sk/wp-json/wp/v2/posts' : 'https://blog.virtuse.com/wp-json/wp/v2/posts';
  var STORY_BASE = LANG === 'sk' ? '/sk/stories/' : '/stories/';

  // Newsletter Worker client (vb-api.js), loaded on first use. The same loader
  // sits in every shared script that posts to the Worker; see vb-api.js.
  function vbApi() {
    if (window.VB_API) return Promise.resolve(window.VB_API);
    return window.VB_API_LOADING || (window.VB_API_LOADING = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = '/vb-api.js?v=2';
      s.onload = function () { if (window.VB_API) ok(window.VB_API); else no(new Error('vb-api.js')); };
      s.onerror = function () { window.VB_API_LOADING = null; no(new Error('vb-api.js')); };
      document.head.appendChild(s);
    }));
  }
  /* Fallback only: the featured card follows the newest issue in news/issues.json. */
  var FEATURED_SLUG = 'who-actually-controls-your-money';
  /* The newest issue from issues.json; a cover hosted on this site (not blog.virtuse.com) is kept
     as the featured cover, the WordPress featured image does not replace it. */
  var LATEST_ISSUE = null;
  var THEME_KEY = 'vb-theme-blog';
  var THEME_DARK = '#08090a';
  var THEME_LIGHT = '#FBFBFA';
  var PULSE_MAX = 4;
  var PULSE_TAGS = ['ETF', 'Macro', 'World', 'Policy', 'Mining', 'Security'];
  /* Tags that may run without Bitcoin in the text (world and macro news). */
  var PULSE_OPEN_TAGS = ['Macro', 'World'];
  var BLOG_CATS = LANG === 'sk' ? '26' : '13,15';
  var BLOG_MAX = 3;
  var ISSUES_MAX = 4;
  /* Placeholder for a missing figure (no em/en dashes in page text). */
  var NA = '\u2026';

  function $(id) { return document.getElementById(id); }
  function j(url, ms) {
    var opts = {};
    if (ms && typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      opts.signal = AbortSignal.timeout(ms);
    }
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }
  /* No em/en dashes in page text: number ranges get a hyphen, other dashes a comma. */
  function undash(s) {
    return String(s == null ? '' : s)
      .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1-$2')
      .replace(/\s*[\u2013\u2014]\s*/g, ', ')
      .replace(/^,\s*/, '')
      .replace(/,\s*([.,;:!?])/g, '$1');
  }
  function strip(s) {
    var doc = new DOMParser().parseFromString(s || '', 'text/html');
    return undash((doc.body.textContent || '').replace('[…]', '…').trim());
  }
  function num(n, d) {
    if (n == null || isNaN(n)) return NA;
    return n.toLocaleString(LOC, { maximumFractionDigits: d == null ? 0 : d });
  }
  function usd(n) {
    if (n == null || isNaN(n)) return NA;
    if (LANG === 'sk') return Math.round(n).toLocaleString('sk-SK') + '\u00a0$';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }
  function compact(n) {
    if (n == null || isNaN(n)) return NA;
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }
  /* Network hashrate from H/s: "982 EH/s" below one zettahash, "1.03 ZH/s" from there. */
  function hashrate(hs) {
    if (hs == null || isNaN(hs) || hs <= 0) return NA;
    var eh = hs / 1e18;
    if (eh >= 1000) return (eh / 1000).toFixed(2) + ' ZH/s';
    return num(eh, eh >= 100 ? 0 : 1) + ' EH/s';
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(LANG === 'sk' ? 'sk-SK' : 'en-GB', { day: 'numeric', month: LANG === 'sk' ? 'long' : 'short', year: 'numeric' });
  }
  /* Edition links go straight to /stories/<slug>/. A missing story page falls back to the
     stories hub (the server 301s article.html?slug= there too). data-issue-slug marks them. */
  var STORY = {};
  function storyPath(slug) {
    return STORY_BASE + encodeURIComponent(slug) + '/';
  }
  function issueLink(slug) {
    return storyPath(slug);
  }
  function linkStories() {
    var links = document.querySelectorAll('a[data-issue-slug]');
    var seen = {};
    [].forEach.call(links, function (a) {
      var slug = a.getAttribute('data-issue-slug');
      if (!slug || seen[slug]) return;
      seen[slug] = 1;
      var apply = function (href) {
        [].forEach.call(document.querySelectorAll('a[data-issue-slug]'), function (x) {
          if (x.getAttribute('data-issue-slug') === slug) x.setAttribute('href', href);
        });
      };
      apply(storyPath(slug));
      if (STORY[slug] === true || STORY[slug] === false || STORY[slug] === 'pending') return;
      STORY[slug] = 'pending';
      fetch(storyPath(slug), { method: 'HEAD' }).then(function (r) {
        STORY[slug] = !!(r.ok && !r.redirected);
        if (!STORY[slug]) apply(STORY_BASE);
      }).catch(function () { STORY[slug] = false; apply(STORY_BASE); });
    });
  }
  function setText(id, v) {
    var el = $(id);
    if (el) el.textContent = v;
  }
  function pctClass(n) {
    if (n == null || isNaN(n) || n === 0) return '';
    return n > 0 ? 'up' : 'down';
  }
  function signedPct(n, d) {
    if (n == null || isNaN(n)) return NA;
    var v = Number(n).toLocaleString(LOC, { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
    return (n > 0 ? '+' : '') + v + (LANG === 'sk' ? '\u00a0%' : '%');
  }
  function compactBtcK(n) {
    if (n == null || isNaN(n)) return NA;
    var k = n / 1000;
    var s = k.toFixed(1).replace(/\.0$/, '');
    return '$' + s + 'k';
  }
  function feeBand(satVb) {
    if (satVb == null || isNaN(satVb)) return NA;
    if (satVb <= 5) return 'low';
    if (satVb <= 20) return 'normal';
    return 'high';
  }
  /* The desk's clock is Europe/Bratislava, for both the strip and the Pulse header
     (not the visitor's zone, and not Paris or the issue's UTC noon). */
  var DESK_TZ = 'Europe/Bratislava';
  function deskYmd(d) { return d.toLocaleDateString('en-CA', { timeZone: DESK_TZ }); }
  function deskHhmm(d) { return d.toLocaleTimeString('en-GB', { timeZone: DESK_TZ, hour: '2-digit', minute: '2-digit', hour12: false }); }
  /* Pulse header while the desk has items: always "Updated today · HH:MM" (Ras, 2026-11-06).
     HH:MM is the feed's own stamp when that stamp is today, otherwise the time the page opened.
     No items at all stays "Pulse unavailable" (renderPulse). */
  var PULSE_UNAVAILABLE = tr('pulseUnavailable');
  /* "Updated X h ago" from the feed's own stamp (handover F1, 2026-11-11: the old
     "Updated today · HH:MM" hid a stale desk). Over 8 h on a weekday 07-23 h
     Bratislava time shows a quiet "Desk updating" line under the header. */
  var STALE_H = 8;
  function pulseAgeH(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return null;
    return (Date.now() - d.getTime()) / 36e5;
  }
  function formatPulseUpdated(iso) {
    var hrs = pulseAgeH(iso);
    if (hrs == null) return tr('pulseUnavailable');
    var mins = Math.max(0, Math.round(hrs * 60));
    if (mins < 2) return tr('updatedNow');
    var span = mins < 60 ? mins + '\u00a0' + tr('min') : Math.floor(hrs) + '\u00a0' + tr('h');
    return LANG === 'sk' ? tr('updated') + ' ' + span : tr('updated') + ' ' + span + ' ' + tr('ago');
  }
  function deskHoursNow() {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: DESK_TZ, weekday: 'short', hour: '2-digit', hour12: false }).formatToParts(new Date());
    var wd = '', hr = 0;
    parts.forEach(function (x) { if (x.type === 'weekday') wd = x.value; if (x.type === 'hour') hr = parseInt(x.value, 10); });
    return !/Sat|Sun/.test(wd) && hr >= 7 && hr < 23;
  }
  function applyPulseStale(iso) {
    var el = $('pulseStale');
    if (!el) return;
    var hrs = pulseAgeH(iso);
    var stale = hrs != null && hrs > STALE_H && deskHoursNow();
    el.textContent = stale ? tr('deskUpdating') : '';
    el.hidden = !stale;
  }
  /* The strip under the logo is today's date, on every load, whatever issues.json holds.
     The latest issue's own date lives only on the featured eyebrow (paintFeatured). */
  function applyTodayStrip() {
    var p = document.querySelector('.edition-strip .edition');
    if (!p) return;
    var now = new Date();
    var t = document.createElement('time');
    t.setAttribute('datetime', deskYmd(now));
    t.textContent = LANG === 'sk'
      ? now.toLocaleDateString('sk-SK', { timeZone: DESK_TZ, weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
      : now.toLocaleDateString('en-US', { timeZone: DESK_TZ, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    p.textContent = tr('today') + ' · ';
    p.appendChild(t);
  }
  applyTodayStrip();
  function applyFearGreed(fg) {
    if (!fg || fg.value == null || fg.value === '') return;
    setText('tileFg', String(fg.value) + ' / 100');
    var FG_SK = { 'extreme fear': 'Extrémny strach', 'fear': 'Strach', 'neutral': 'Neutrálne', 'greed': 'Chamtivosť', 'extreme greed': 'Extrémna chamtivosť' };
    var fgLabel = fg.label ? String(fg.label) : 'alternative.me';
    if (LANG === 'sk' && FG_SK[fgLabel.toLowerCase()]) fgLabel = FG_SK[fgLabel.toLowerCase()];
    setText('tileFgLabel', fgLabel);
  }
  function compactArchiveTitle(it) {
    var title = (localCopy(it).title || '').replace(/\s+/g, ' ').trim();
    if (title.length > 72) title = title.slice(0, 69).replace(/\s+\S*$/, '') + '…';
    return undash(title) || tr('story');
  }
  function renderArchive(archive) {
    var host = $('pulseArchive');
    if (!host) return;
    host.textContent = '';
    var items = [];
    var labelText = tr('yesterday');
    if (archive && Array.isArray(archive.items)) {
      items = archive.items;
      if (archive.label && LANG === 'en') labelText = archive.label;
    } else if (Array.isArray(archive)) {
      items = archive;
    }
    items = items.filter(Boolean).slice(0, 2);
    if (!items.length) {
      host.hidden = true;
      return;
    }
    var label = document.createElement('p');
    label.className = 'desk-label';
    label.textContent = labelText;
    host.appendChild(label);
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = it.url || '#';
      if (it.url && /^https?:/i.test(it.url)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      if (localCopy(it).en) {
        a.appendChild(document.createTextNode(tagLabel(inferTag(it)) + ' · '));
        var en = document.createElement('span');
        en.lang = 'en';
        en.textContent = compactArchiveTitle(it);
        a.appendChild(en);
        markEn(a);
      } else {
        a.textContent = tagLabel(inferTag(it)) + ' · ' + compactArchiveTitle(it);
      }
      host.appendChild(a);
    });
    host.hidden = false;
  }
  var pulseStamp;
  function applyPulseMeta(data) {
    pulseStamp = data && data.updated;
    applyPulseStale(pulseStamp);
    renderArchive(data && data.archive);
    applyFearGreed(data && data.fear_greed);
  }

  /* Nav hamburger */
  (function () {
    var btn = $('navToggle');
    var links = $('navLinks');
    if (!btn || !links) return;
    btn.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) document.body.classList.remove('nav-open');
    });
  })();

  /* Theme: default dark (shared with blog + stories), persist vb-theme-blog, update theme-color. */
  (function () {
    var btn = $('themeToggle');
    var label = $('themeToggleLabel');
    var meta = document.querySelector('meta[name="theme-color"]');
    function current() {
      try {
        var stored = localStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
      } catch (e) {}
      return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }
    function apply(theme, persist) {
      document.documentElement.setAttribute('data-theme', theme);
      if (meta) meta.setAttribute('content', theme === 'light' ? THEME_LIGHT : THEME_DARK);
      if (persist) {
        try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
      }
      if (!btn) return;
      var next = theme === 'dark' ? 'light' : 'dark';
      var cap = next.charAt(0).toUpperCase() + next.slice(1);
      btn.setAttribute('aria-label', tr('switchTo') + tr(next) + tr('themeWord'));
      btn.setAttribute('title', tr(next) + tr('themeWord'));
      if (label) label.textContent = LANG === 'sk' ? tr(next).charAt(0).toUpperCase() + tr(next).slice(1) : cap;
    }
    if (btn) {
      btn.addEventListener('click', function () {
        apply(current() === 'dark' ? 'light' : 'dark', true);
      });
    }
    apply(current(), false);
  })();

  /* Subscribe: existing Worker, ENG list. Same address check as the Worker (config.js EMAIL_RE). */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function bindSubscribe(form, msg) {
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    var label = btn.textContent;
    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var email = form.elements.email.value.trim();
      var hp = form.elements.website.value;
      if (msg) {
        msg.textContent = '';
        msg.className = 'subscribe-msg';
      }
      if (!email) {
        if (msg) {
          msg.textContent = tr('emailRequired');
          msg.classList.add('err');
        }
        return;
      }
      if (!EMAIL_RE.test(email)) {
        if (msg) {
          msg.textContent = tr('emailInvalid');
          msg.classList.add('err');
        }
        return;
      }
      busy = true;
      btn.disabled = true;
      btn.textContent = tr('sending');
      vbApi().then(function (api) {
        return api.subscribe({ email: email, hp: hp, lang: LANG });
      }).then(function (result) {
        if (result.ok) {
          form.reset();
          if (msg) {
            msg.textContent = tr('subOk');
            msg.classList.add('ok');
          }
        } else if (msg) {
          msg.textContent = (result.data && result.data.error) || tr('subFail');
          msg.classList.add('err');
        }
      }).catch(function () {
        if (msg) {
          msg.textContent = tr('netErr');
          msg.classList.add('err');
        }
      }).then(function () {
        busy = false;
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  }
  bindSubscribe($('subscribeStripForm'), $('subscribeStripMsg'));
  bindSubscribe($('subscribeForm'), $('subscribeMsg'));

  /* Macro figures: data/macro.json (macro-build/build.mjs, daily via the
     Asset returns Action). Read from GitHub first so production stays fresh
     without an upload; the site's own copy is the fallback. */
  var MACRO_RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/macro.json';
  var macro = null;
  var btcUsd = null;
  function fmtNum(n, d) { return n == null || isNaN(n) ? NA : Number(n).toLocaleString(LOC, { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function pctStr(n, d) { return fmtNum(n, d) + (LANG === 'sk' ? ' %' : '%'); }
  function monthShort(ym) {
    if (!ym) return '';
    var d = new Date(ym.length === 7 ? ym + '-01T12:00:00Z' : ym + 'T12:00:00Z');
    return isNaN(d.getTime()) ? ym : d.toLocaleDateString(LANG === 'sk' ? 'sk-SK' : 'en-US', { month: 'short', timeZone: 'UTC' }).replace(/\.$/, '');
  }
  function dayShort(ymd) {
    var d = new Date(String(ymd).slice(0, 10) + 'T12:00:00Z');
    if (isNaN(d.getTime())) return ymd;
    return LANG === 'sk'
      ? d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '.'
      : d.getUTCDate() + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getUTCMonth()];
  }
  function link(href, text, cls) {
    var a = document.createElement('a');
    a.href = href;
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.textContent = text;
    if (cls) a.className = cls;
    return a;
  }
  function setChg(id, pct) {
    var el = $(id);
    if (!el) return;
    if (pct == null || isNaN(pct)) { el.textContent = NA; return; }
    el.textContent = signedPct(pct) + ' · ' + tr('d1');
    el.className = 'tile-sub ' + pctClass(pct);
  }

  function paintGold() {
    var g = macro && macro.quotes && macro.quotes.gold;
    if (!g || !btcUsd) return;
    setText('tileGold', fmtNum(btcUsd / g.value, 1) + ' oz');
    setText('tileGoldSub', tr('gold') + ' ' + (LANG === 'sk' ? fmtNum(g.value, 0) + '\u00a0$/oz' : '$' + fmtNum(g.value, 0) + '/oz'));
  }
  function macroTicker() {
    var q = macro && macro.quotes;
    if (!q) return [];
    var out = [];
    function add(label, x, d, prefix, suffix) {
      if (!x) return;
      var v = prefix === '$' && LANG === 'sk' ? fmtNum(x.value, d) + '\u00a0$' : (prefix || '') + fmtNum(x.value, d) + (suffix || '');
      out.push([label, x.change_pct == null ? v : v + ' ' + signedPct(x.change_pct), pctClass(x.change_pct)]);
    }
    add('S&P 500', q.spx, 0);
    add(tr('gold'), q.gold, 0, '$');
    add('Brent', q.brent, 2, '$');
    add('EUR/USD', q.eurusd, 4);
    if (q.us10y) {
      var bp = q.us10y.prev != null ? Math.round((q.us10y.value - q.us10y.prev) * 100) : null;
      out.push(['US 10Y', pctStr(q.us10y.value, 2) + (bp == null ? '' : ' ' + (bp > 0 ? '+' : '') + bp + ' bp'), bp == null ? '' : pctClass(bp)]);
    }
    return out;
  }
  /* F2: US CPI shows the last y/y BLS published + the latest m/m; euro area
     carries "flash" while Eurostat marks the figure as estimated. */
  function paintInflation(inf) {
    var us = inf.us, ea = inf.ea;
    if (!us && !ea) return;
    setText('tileInfl', (us ? fmtNum(us.value, 1) : NA) + ' / ' + (ea ? fmtNum(ea.value, 1) : NA) + (LANG === 'sk' ? ' %' : '%'));
    setText('tileInflSub', tr('yoy') + ' · US ' + (us ? monthShort(us.month) : NA) + ' · ' + (LANG === 'sk' ? 'EÚ ' : 'EU ') +
      (ea ? monthShort(ea.month) + (ea.flash ? ' ' + tr('flash') : '') : NA));
    var note = $('tileInflNote');
    if (note && us && us.mom != null) {
      note.textContent = 'US ' + monthShort(us.mom_month) + ' ' + signedPct(us.mom, 1) + ' ' + tr('mom');
      if (us.yoy_published === false) {
        note.appendChild(document.createTextNode(' · '));
        note.appendChild(link(us.note_url || us.source_url, tr('yoyNotPub')));
      }
      note.hidden = false;
    }
  }
  /* Central banks: rate + next decision (table in the Newsletter rail). */
  function paintBanks(cb) {
    Array.prototype.forEach.call(document.querySelectorAll('#cbRows tr[data-cb]'), function (row) {
      var b = cb[row.getAttribute('data-cb')];
      var tds = row.querySelectorAll('td');
      if (!b || tds.length < 2) return;
      tds[0].textContent = LANG === 'sk' ? String(b.rate).replace(/\./g, ',').replace('%', '\u00a0%') : b.rate;
      tds[0].title = b.label + ' · ' + b.source;
      tds[1].textContent = b.next_meeting ? dayShort(b.next_meeting) : NA;
    });
  }
  /* F1: events that already happened, used to demote "ahead of CPI" stories. */
  function recentEvents() { return (macro && macro.recent_events) || []; }
  function paintCalendar(m) {
    var cal = (m.calendar || []).filter(function (e) { return e.date >= deskYmd(new Date()); }).slice(0, 4);
    var list = $('calList');
    var box = $('pulseCalendar');
    if (!list || !box || !cal.length) return;
    list.textContent = '';
    cal.forEach(function (e) {
      var li = document.createElement('li');
      var t = document.createElement('time');
      t.setAttribute('datetime', e.time || e.date);
      t.textContent = dayShort(e.date);
      li.appendChild(t);
      li.appendChild(e.url ? link(e.url, LANG === 'sk' && e.title_sk ? e.title_sk : e.title) : document.createTextNode(e.title));
      list.appendChild(li);
    });
    box.hidden = false;
  }

  function paintMacro(m) {
    macro = m;
    var q = m.quotes || {};
    if (q.spx) { setText('tileSpx', fmtNum(q.spx.value, 0)); setChg('tileSpxChg', q.spx.change_pct); }
    if (q.eurusd) { setText('tileEur', fmtNum(q.eurusd.value, 4)); setChg('tileEurChg', q.eurusd.change_pct); }
    paintInflation(m.inflation || {});
    paintGold();
    paintBanks(m.central_banks || {});
    paintCalendar(m);
    if (lastTickerStats) renderTicker(lastTickerStats);
    if (lastPulseItems) renderPulse(lastPulseItems);
  }
  /* GitHub copy and the site's own copy: whichever was generated later wins
     (staging and a fresh deploy can be ahead of main; a failed fetch is skipped). */
  function loadMacro() {
    var tries = [j(MACRO_RAW, 6000), j('/data/macro.json?v=' + Date.now().toString().slice(0, 6), 6000)].map(function (p) {
      return p.then(function (m) { return m && m.quotes ? m : null; }, function () { return null; });
    });
    Promise.all(tries).then(function (res) {
      var best = res.filter(Boolean).sort(function (a, b) { return String(b.generated || '').localeCompare(String(a.generated || '')); })[0];
      if (best) paintMacro(best);
    });
  }
  loadMacro();

  /* Ticker + by-the-numbers tiles. */
  var lastTickerStats = null;
  var tickerResizeTimer = null;
  function renderTicker(stats) {
    var host = $('tickerTrack');
    if (!host) return;
    lastTickerStats = stats;
    var parts = [
      ['BTC/USD', stats.price || NA, ''],
      ['24h', stats.chg || NA, stats.chgClass || ''],
      ['Hashrate', stats.hash || NA, ''],
      ['Fees', stats.fee || NA, ''],
      ['Sats/$', stats.sats || NA, ''],
      ['Block', stats.height || NA, '']
    ];
    macroTicker().forEach(function (m) { parts.push(m); });
    function row() {
      var frag = document.createDocumentFragment();
      parts.forEach(function (p, i) {
        if (i) {
          var sep = document.createElement('span');
          sep.className = 'ticker-sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '•';
          frag.appendChild(sep);
        }
        var item = document.createElement('span');
        item.className = 'ticker-item';
        item.innerHTML = p[0] + ' <strong class="' + p[2] + '"></strong>';
        item.querySelector('strong').textContent = p[1];
        frag.appendChild(item);
      });
      return frag;
    }
    function trailingSep() {
      var sep = document.createElement('span');
      sep.className = 'ticker-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '•';
      return sep;
    }
    function makeGroup(copies) {
      var g = document.createElement('span');
      g.className = 'ticker-group';
      for (var i = 0; i < copies; i++) {
        g.appendChild(row());
        g.appendChild(trailingSep());
      }
      return g;
    }
    var allMissing = parts.every(function (p) { return p[1] === NA; });
    if (allMissing && stats.settled) {
      parts = [[tr('liveFigures'), tr('unavailable'), '']];
    }
    host.textContent = '';
    var probe = makeGroup(1);
    host.appendChild(probe);
    var rowW = probe.getBoundingClientRect().width;
    var parent = host.parentElement;
    var viewW = parent ? parent.getBoundingClientRect().width : 1200;
    var copies = Math.max(1, Math.ceil((viewW + 1) / Math.max(rowW, 1)));
    host.textContent = '';
    host.appendChild(makeGroup(copies));
    var loop = makeGroup(copies);
    loop.setAttribute('aria-hidden', 'true');
    host.appendChild(loop);
  }

  window.addEventListener('resize', function () {
    if (tickerResizeTimer) clearTimeout(tickerResizeTimer);
    tickerResizeTimer = setTimeout(function () {
      if (lastTickerStats) renderTicker(lastTickerStats);
    }, 150);
  });

  var LIVE_MS = 8000;
  var UNAVAILABLE = 'n/a';
  /* A figure that never arrived reads "n/a" after its fetch fails; a later failure keeps the last good value. */
  var lastGood = {};
  function liveFail(stats, key, id) {
    if (lastGood[key]) return;
    stats[key] = UNAVAILABLE;
    setText(id, UNAVAILABLE);
    renderTicker(stats);
  }
  function liveOk(stats, key, id, value) {
    lastGood[key] = true;
    stats[key] = value;
    setText(id, value);
  }
  function refreshMarket() {
    var stats = {
      price: NA, sats: NA, chg: NA, chgClass: '', hash: NA, fee: NA, height: NA,
      priceRaw: null, chgRaw: null, feeRaw: null, settled: false
    };
    var pending = 5;
    function done() { pending -= 1; if (pending <= 0) { stats.settled = true; renderTicker(stats); } }

    j(MP + '/v1/prices', LIVE_MS).then(function (p) {
      stats.priceRaw = p.USD;
      btcUsd = p.USD; paintGold();
      liveOk(stats, 'price', 'tilePrice', usd(p.USD));
      liveOk(stats, 'sats', 'tileSats', p.USD ? num(Math.round(1e8 / p.USD)) : NA);
      renderTicker(stats);
    }).catch(function () {
      liveFail(stats, 'price', 'tilePrice');
      liveFail(stats, 'sats', 'tileSats');
    }).then(done);

    j('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', LIVE_MS).then(function (t) {
      var last = parseFloat(t.lastPrice);
      var n = parseFloat(t.priceChangePercent);
      if (!isNaN(last)) {
        stats.priceRaw = last;
        btcUsd = last; paintGold();
        liveOk(stats, 'price', 'tilePrice', usd(last));
        liveOk(stats, 'sats', 'tileSats', num(Math.round(1e8 / last)));
      }
      if (isNaN(n)) throw new Error('no change');
      stats.chgRaw = n;
      liveOk(stats, 'chg', 'tileChg', signedPct(n));
      stats.chgClass = pctClass(n);
      var el = $('tileChg');
      if (el) el.className = 'tile-sub ' + stats.chgClass;
      renderTicker(stats);
    }).catch(function () {
      return j('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true', LIVE_MS).then(function (g) {
        var n = g.bitcoin && g.bitcoin.usd_24h_change;
        var px = g.bitcoin && g.bitcoin.usd;
        if (px != null && !isNaN(px)) {
          stats.priceRaw = px;
          btcUsd = px; paintGold();
          liveOk(stats, 'price', 'tilePrice', usd(px));
          liveOk(stats, 'sats', 'tileSats', num(Math.round(1e8 / px)));
        }
        if (n == null || isNaN(n)) throw new Error('no change');
        stats.chgRaw = n;
          liveOk(stats, 'chg', 'tileChg', signedPct(n));
        stats.chgClass = pctClass(n);
        var el = $('tileChg');
        if (el) el.className = 'tile-sub ' + stats.chgClass;
        renderTicker(stats);
      });
    }).catch(function () {
      liveFail(stats, 'chg', 'tileChg');
    }).then(done);

    j(MP + '/blocks/tip/height', LIVE_MS).then(function (h) {
      liveOk(stats, 'height', 'tileHeight', num(h));
      renderTicker(stats);
    }).catch(function () { liveFail(stats, 'height', 'tileHeight'); }).then(done);

    j(MP + '/v1/fees/recommended', LIVE_MS).then(function (f) {
      stats.feeRaw = f.fastestFee;
      if (f.fastestFee == null) throw new Error('no fee');
      liveOk(stats, 'fee', 'tileFee', f.fastestFee + ' sat/vB · ' + feeBand(f.fastestFee));
      renderTicker(stats);
    }).catch(function () { liveFail(stats, 'fee', 'tileFee'); }).then(done);

    j(MP + '/v1/mining/hashrate/3d', LIVE_MS).then(function (m) {
      liveOk(stats, 'hash', 'tileHash', hashrate(m.currentHashrate));
      renderTicker(stats);
    }).catch(function () { liveFail(stats, 'hash', 'tileHash'); }).then(done);
  }
  renderTicker({ price: NA, sats: NA, chg: NA, chgClass: '', hash: NA, fee: NA, height: NA, settled: false });
  refreshMarket();
  setInterval(refreshMarket, 60000);

  /* Pulse: Bitcoin-only, max 3 (layout), TAG icon + copy + Read at {Outlet}. */
  function isDeskStory(item) {
    if (!item) return false;
    var src = (item.source || '').toLowerCase();
    if (/weekly take|virtuse/.test(src)) return true;
    return /article\.html(\?|$)/i.test(item.url || '');
  }
  function isBitcoinOnly(item) {
    var blob = ((item && item.title) || '') + ' ' + ((item && item.excerpt) || '');
    if (!/bitcoin|\bbtc\b/i.test(blob)) return false;
    if (/solana|\beth\b|ethereum|\bxrp\b|dogecoin|memecoin|altcoin/i.test(blob) && !/bitcoin|\bbtc\b/i.test(blob)) return false;
    return true;
  }
  function outletCta(item) {
    if (!item) return tr('fullStory');
    if (isDeskStory(item)) return tr('readBrief');
    var src = (item.source || '').replace(/\s+/g, ' ').trim();
    if (!src) return tr('fullStory');
    if (/crypto\s*slate/i.test(src)) return tr('readAt') + 'CryptoSlate';
    return tr('readAt') + src;
  }
  function firstSentence(text) {
    var m = (text || '').match(/.*?[.!?](?=\s|$)/);
    return m ? m[0].trim() : (text || '').trim();
  }
  function twoSentences(item) {
    var title = ((item && item.title) || '').replace(/\s+/g, ' ').trim();
    var excerpt = ((item && item.excerpt) || '').replace(/\s+/g, ' ').trim();
    if (title && !/[.!?]$/.test(title)) title += '.';
    if (title && excerpt) return (title + ' ' + firstSentence(excerpt)).trim();
    return firstSentence(title || excerpt);
  }
  function inferTag(item) {
    var explicit = item && item.tag ? String(item.tag).trim() : '';
    if (/^fed$/i.test(explicit)) return 'Macro';
    if (explicit) {
      var hit = PULSE_TAGS.filter(function (t) {
        return t.toLowerCase() === explicit.toLowerCase();
      })[0];
      if (hit) return hit;
    }
    var blob = (((item && item.title) || '') + ' ' + ((item && item.excerpt) || '')).toLowerCase();
    if (/\betfs?\b|ishares|spot fund/.test(blob)) return 'ETF';
    if (/\bfed\b|fomc|powell|jackson hole|\bcpi\b|inflation|interest rate|central bank|\becb\b|\bgdp\b|recession|bond yield|treasury yield/.test(blob)) return 'Macro';
    if (/miner|hashrate|hash rate|difficulty adjustment/.test(blob)) return 'Mining';
    if (/hack|exploit|stolen|custody breach|\bsecurity\b/.test(blob)) return 'Security';
    return 'Policy';
  }
  function pulseIcon(tag) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#ico-' + tag.toLowerCase());
    svg.appendChild(use);
    return svg;
  }
  /* F1: a story written "ahead of" a release (CPI, jobs report, a rate
     decision) that has since happened drops below the others and is labelled
     "Before the release", so it never leads the Pulse after the numbers are out. */
  var BEFORE_RE = /\b(ahead of|before|awaits?|braces? for|on the eve of|faces?\b[^.]{0,40}\btest)\b/i;
  var EVENT_RE = {
    cpi: /\b(cpi|inflation (data|report|print|figures?))\b/i,
    nfp: /\b(nfp|jobs report|payrolls|non-?farm)\b/i,
    fed: /\b(fomc|fed (decision|meeting)|powell)\b/i,
    ecb: /\becb\b/i,
    boe: /\b(boe|bank of england)\b/i,
    boj: /\b(boj|bank of japan)\b/i
  };
  function beforeRelease(it) {
    var blob = ((it && it.title) || '') + ' ' + ((it && it.excerpt) || '');
    if (!BEFORE_RE.test(blob)) return null;
    var pub = Date.parse(it.published || '') || 0;
    var now = Date.now();
    var hit = null;
    recentEvents().forEach(function (e) {
      var t = Date.parse(e.time || e.date);
      if (!hit && EVENT_RE[e.kind] && EVENT_RE[e.kind].test(blob) && t <= now && pub < t) hit = e;
    });
    return hit;
  }
  var lastPulseItems = null;
  function renderPulse(items) {
    var list = $('pulseList');
    var empty = $('pulseEmpty');
    if (!list || !empty) return;
    lastPulseItems = items;
    list.textContent = '';
    var shorts = (items || []).filter(function (it) {
      if (!it || isDeskStory(it)) return false;
      return PULSE_OPEN_TAGS.indexOf(inferTag(it)) !== -1 || isBitcoinOnly(it);
    }).slice(0, PULSE_MAX).map(function (it) {
      return { it: it, before: beforeRelease(it) };
    });
    shorts = shorts.filter(function (x) { return !x.before; }).concat(shorts.filter(function (x) { return x.before; }));
    if (!shorts.length) {
      setText('pulseUpdated', PULSE_UNAVAILABLE);
      empty.hidden = false;
      return;
    }
    setText('pulseUpdated', formatPulseUpdated(pulseStamp));
    empty.hidden = true;
    shorts.forEach(function (x) {
      var it = x.it;
      var article = document.createElement('article');
      article.className = 'pulse-item' + (x.before ? ' is-before' : '');
      var tagName = inferTag(it);
      var tag = document.createElement('span');
      tag.className = 'pulse-tag';
      tag.appendChild(pulseIcon(tagName));
      tag.appendChild(document.createTextNode(tagLabel(tagName)));
      if (x.before) {
        var bf = document.createElement('span');
        bf.className = 'pulse-before';
        bf.textContent = tr('beforeRelease') + ' · ' + (LANG === 'sk' && x.before.title_sk ? x.before.title_sk : x.before.title);
        tag.appendChild(bf);
      }
      var text = localCopy(it);
      if (text.en) markEn(tag);
      var copy = document.createElement('p');
      copy.className = 'pulse-copy';
      if (text.en) copy.lang = 'en';
      copy.textContent = undash(twoSentences(text));
      var read = document.createElement('a');
      read.className = 'read';
      read.href = it.url || '#';
      if (it.url && /^https?:/i.test(it.url)) {
        read.target = '_blank';
        read.rel = 'noopener noreferrer';
      }
      read.textContent = outletCta(it);
      article.appendChild(tag);
      article.appendChild(copy);
      article.appendChild(read);
      list.appendChild(article);
    });
  }
  var PULSE_LOCAL = '/news/news-pulse.json?v=20261110';
  /* Worker GET /pulse.json, 3 s limit (the local copy is the fallback). */
  function fetchPulseRemote() {
    return vbApi().then(function (api) {
      return api.fetchWithTimeout(api.url('/pulse.json'), {}, 3000, function (r) {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
    }).then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items.length) throw new Error('bad remote pulse');
      return data;
    });
  }
  /* Test hook, staging and localhost only: ?pulse_fixture=sk loads
     /news/test/pulse-sk.json instead of the Worker. */
  function pulseFixture() {
    if (!/^(staging\.virtuse\.com|localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
    var m = /[?&]pulse_fixture=([a-z0-9-]+)/.exec(location.search);
    return m ? '/news/test/pulse-' + m[1] + '.json' : null;
  }
  function loadPulseData() {
    var fx = pulseFixture();
    if (fx) return j(fx);
    return fetchPulseRemote().catch(function () {
      return j(PULSE_LOCAL);
    });
  }
  function loadPulse() {
    loadPulseData().then(function (data) {
      applyPulseMeta(data || {});
      var local = (data && data.items) || [];
      if (data && data.feed) {
        return j(data.feed, 5000).then(function (remote) {
          var items = (remote && remote.items) || remote;
          renderPulse(Array.isArray(items) && items.length ? items : local);
        }).catch(function () { renderPulse(local); });
      }
      renderPulse(local);
    }).catch(function () {
      applyPulseMeta({});
      renderPulse([]);
    });
  }
  loadPulse();

  /* Tools: a live example in each card.
     Retirement: BTC × price ÷ (spending × 12), no growth or inflation (the full
     calculator goes year by year). Price: CoinGecko BTC/EUR, else the
     calculator's own default. Returns: data/asset-returns.json (same file as
     the Asset Class Returns page). Tax: copied from seo-build/data
     (seo-data.json + meta.json taxSk), as of Q3 2026; update with them. */
  var TOOLS_T = {
    en: {
      years: function (y) { return y === 1 ? 'year' : 'years'; }, lessThanYear: 'Less than 1 year',
      at: ' at ', perMonth: '/mo', priceNote: function (p, live) { return (live ? 'At today’s ' : 'Example at ') + p + '/BTC, with no growth or inflation.'; },
      stack: 'Stack', spending: 'Spending',
      assets: { BTC: 'Bitcoin', DBC: 'Commodities', SPY: 'US stocks', GLD: 'Gold', VGK: 'EU stocks', BIL: 'Cash' },
      kicker: function (y, r1, n, p1, yrs, r2, p2) { return y + ' so far: <em>' + r1 + ' of ' + n + '</em> (' + p1 + '). Over ' + yrs + ' years: <em>' + r2 + ' of ' + n + '</em> (' + p2 + ' a year).'; },
      arNote: function (d) { return 'Yahoo Finance, USD total return, as of ' + d + '.'; },
      ord: function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
    },
    sk: {
      years: function (y) { var n = Math.round(y); if (Math.abs(y - n) > 0.05) return 'roka'; return n === 1 ? 'rok' : (n >= 2 && n <= 4 ? 'roky' : 'rokov'); }, lessThanYear: 'Menej ako 1 rok',
      at: ' pri ', perMonth: '/mes.', priceNote: function (p, live) { return (live ? 'Pri dnešnej cene ' : 'Príklad pri cene ') + p + '/BTC, bez rastu a inflácie.'; },
      stack: 'Zásoba', spending: 'Výdavky',
      assets: { BTC: 'Bitcoin', DBC: 'Komodity', SPY: 'US akcie', GLD: 'Zlato', VGK: 'Eur. akcie', BIL: 'Hotovosť' },
      kicker: function (y, r1, n, p1, yrs, r2, p2) { return y + ' zatiaľ: <em>' + r1 + ' z ' + n + '</em> (' + p1 + '). Za ' + yrs + ' roka: <em>' + r2 + ' z ' + n + '</em> (' + p2 + ' ročne).'; },
      arNote: function (d) { return 'Yahoo Finance, total return v USD, k ' + d + '.'; },
      ord: function (n) { return n + '.'; }
    }
  };
  var TAX = [
      { id: 'cz', code: 'CZ', en: "Czechia", sk: "Česko",
        enLine: "15% income tax (23% above threshold). Tax-free after 3 years of holding (up to CZK 40 million a year), or if total crypto sale proceeds in the year are at most CZK 100,000.",
        skLine: "15 % daň z príjmov (23 % nad stanovenou hranicou). Bez dane po 3 rokoch držby (do 40 miliónov Kč ročne) alebo ak úhrn príjmov z predaja kryptoaktív v roku nepresiahne 100 000 Kč." },
      { id: 'sk', code: 'SK', en: "Slovakia", sk: "Slovensko",
        enLine: "19 to 35% income tax. No holding-period exemption.",
        skLine: "19 až 35 % daň z príjmov. Bez oslobodenia podľa doby držby." },
      { id: 'pl', code: 'PL', en: "Poland", sk: "Poľsko",
        enLine: "19% flat capital gains tax. No holding-period exemption.",
        skLine: "19 % jednotná daň z kapitálových výnosov. Bez oslobodenia podľa doby držby." },
      { id: 'at', code: 'AT', en: "Austria", sk: "Rakúsko",
        enLine: "27.5% KESt (capital gains tax). Tax-free after 1 year only for crypto bought before March 2021.",
        skLine: "27,5 % KESt (daň z kapitálových výnosov). Po 1 roku bez dane len pri kryptomenách kúpených pred marcom 2021." },
      { id: 'de', code: 'DE', en: "Germany", sk: "Nemecko",
        enLine: "Up to 45% income tax (progressive). 0% after a 1-year holding period.",
        skLine: "Až 45 % daň z príjmov (progresívna). 0 % po 1-ročnej dobe držby." },
      { id: 'hu', code: 'HU', en: "Hungary", sk: "Maďarsko",
        enLine: "15% personal income tax on crypto income. No holding-period exemption.",
        skLine: "15 % daň z príjmov z kryptoaktív. Bez oslobodenia podľa doby držby." },
      { id: 'si', code: 'SI', en: "Slovenia", sk: "Slovinsko",
        enLine: "No tax on private disposal gains (business trading is taxed).",
        skLine: "Súkromné zisky z predaja sa nezdaňujú (podnikateľské obchodovanie áno)." },
      { id: 'hr', code: 'HR', en: "Croatia", sk: "Chorvátsko",
        enLine: "12% on crypto gains (since 2024). Tax-free after a 2-year holding period.",
        skLine: "12 % zo ziskov z kryptomien (od roku 2024). Bez dane po 2 rokoch držby." },
      { id: 'ro', code: 'RO', en: "Romania", sk: "Rumunsko",
        enLine: "16% income tax on crypto gains (10% until 2025). No holding-period exemption.",
        skLine: "16 % daň z príjmov zo ziskov z kryptomien (do roku 2025: 10 %). Bez oslobodenia podľa doby držby." },
      { id: 'bg', code: 'BG', en: "Bulgaria", sk: "Bulharsko",
        enLine: "10% flat tax on gains. No holding-period exemption.",
        skLine: "10 % jednotná daň zo ziskov. Bez oslobodenia podľa doby držby." },
      { id: 'nl', code: 'NL', en: "Netherlands", sk: "Holandsko",
        enLine: "Box 3 wealth tax on a deemed return (about 36% of the assumed yield). Tax-free allowance (€59,357 per person, 2026).",
        skLine: "Majetková daň Box 3 (približne 36 % z predpokladaného výnosu). Nezdaniteľná časť (59 357 € na osobu, 2026)." },
      { id: 'fr', code: 'FR', en: "France", sk: "Francúzsko",
        enLine: "31.4% flat tax (PFU: 12.8% income tax + 18.6% social charges, 2026). No holding-period exemption.",
        skLine: "31,4 % paušálna daň (PFU: 12,8 % daň z príjmov + 18,6 % sociálne odvody, 2026). Bez oslobodenia podľa doby držby." },
      { id: 'es', code: 'ES', en: "Spain", sk: "Španielsko",
        enLine: "19 to 30% progressive tax on savings income. No holding-period exemption.",
        skLine: "19 až 30 % progresívna daň z kapitálových príjmov. Bez oslobodenia podľa doby držby." }
  ];
  function initTools() {
    var T = TOOLS_T[LANG];
    var grid = document.getElementById('toolsGrid');
    if (!grid) return;
    var price = 74649, live = false, stackBtc = 1, spend = 2000, taxId = LANG === 'sk' ? 'sk' : 'de';
    function n1(v, d) { return Number(v).toLocaleString(LOC, { minimumFractionDigits: d, maximumFractionDigits: d }); }
    function eur(v) { return Number(Math.round(v)).toLocaleString(LOC, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); }
    function pct(v) { var x = v * 100, a = Math.abs(x); return (x >= 0 ? '+' : '−') + n1(a, a >= 10 ? 0 : 1); }
    function pctFull(v) { var x = v * 100; return (x >= 0 ? '+' : '\u2212') + n1(Math.abs(x), 1) + (LANG === 'sk' ? '\u00a0%' : '%'); }
    function chips(box, values, label, current, pick) {
      box.innerHTML = '';
      values.forEach(function (v) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tool-chip';
        b.textContent = label(v);
        b.setAttribute('aria-pressed', v === current ? 'true' : 'false');
        b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); pick(v); });
        box.appendChild(b);
      });
    }
    function renderRc() {
      var y = (stackBtc * price) / (spend * 12);
      setText('rcYears', y < 1 ? T.lessThanYear : '≈ ' + n1(y, 1) + ' ' + T.years(y));
      setText('rcSub', n1(stackBtc, stackBtc < 1 ? 1 : 0) + ' BTC' + T.at + eur(spend) + T.perMonth);
      setText('rcNote', T.priceNote(eur(price), live));
      chips(document.getElementById('rcStackChips'), [0.5, 1, 2], function (v) { return n1(v, v < 1 ? 1 : 0) + ' BTC'; }, stackBtc, function (v) { stackBtc = v; renderRc(); });
      chips(document.getElementById('rcSpendChips'), [1000, 2000, 3000], eur, spend, function (v) { spend = v; renderRc(); });
    }
    function renderTax() {
      chips(document.getElementById('taxChips'), TAX.map(function (c) { return c.id; }), function (id) {
        return TAX.filter(function (c) { return c.id === id; })[0].code;
      }, taxId, function (id) { taxId = id; renderTax(); });
      var btns = document.querySelectorAll('#taxChips .tool-chip');
      TAX.forEach(function (c, i) { if (btns[i]) btns[i].setAttribute('aria-label', c[LANG]); });
      var c = TAX.filter(function (x) { return x.id === taxId; })[0];
      var line = document.getElementById('taxLine');
      line.innerHTML = '';
      var strong = document.createElement('strong');
      strong.textContent = c[LANG] + ': ';
      line.appendChild(strong);
      line.appendChild(document.createTextNode(LANG === 'sk' ? c.skLine : c.enLine));
    }
    function renderReturns(d) {
      var keep = ['BTC', 'DBC', 'SPY', 'GLD', 'VGK', 'BIL'];
      var years = d.years.slice(-6), off = d.years.length - 6;
      var head = document.querySelector('#arTable thead'), body = document.querySelector('#arTable tbody');
      head.innerHTML = '<tr><th class="ar-name"></th>' + years.map(function (y) { return '<th>’' + String(y).slice(2) + '</th>'; }).join('') + '</tr>';
      body.innerHTML = '';
      keep.forEach(function (t) {
        var row = d.rows.filter(function (r) { return r.ticker === t; })[0];
        if (!row) return;
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.className = 'ar-name'; th.scope = 'row'; th.textContent = T.assets[t];
        tr.appendChild(th);
        row.returns.slice(off).forEach(function (v) {
          var td = document.createElement('td');
          if (v == null) { td.textContent = NA; } else {
            td.className = 'ar-cell ' + (v >= 0.5 ? 'is-pos-hi' : v >= 0.1 ? 'is-pos' : v >= 0 ? 'is-pos-lo' : v > -0.1 ? 'is-neg-lo' : v > -0.5 ? 'is-neg' : 'is-neg-hi');
            td.textContent = pct(v);
          }
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      var btc = d.rows.filter(function (r) { return r.ticker === 'BTC'; })[0];
      var last = d.rows.filter(function (r) { return r.returns[r.returns.length - 1] != null; });
      var ann = d.rows.filter(function (r) { return r.annualized != null; });
      if (btc && last.length === ann.length) {
        var ytd = btc.returns[btc.returns.length - 1];
        var r1 = 1 + last.filter(function (r) { return r.returns[r.returns.length - 1] > ytd; }).length;
        var r2 = 1 + ann.filter(function (r) { return r.annualized > btc.annualized; }).length;
        document.getElementById('arKicker').innerHTML = T.kicker(d.ytdYear, T.ord(r1), last.length, pctFull(ytd), n1(d.yearsElapsed, 1), T.ord(r2), pctFull(btc.annualized));
      }
      var p = String(d.asOf).split('-');
      setText('arNote', T.arNote(LANG === 'sk' ? (+p[2]) + '. ' + (+p[1]) + '. ' + p[0] : new Date(d.asOf + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })));
    }
    renderRc();
    renderTax();
    j('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur', LIVE_MS).then(function (g) {
      var p = g && g.bitcoin && +g.bitcoin.eur;
      if (p > 0) { price = p; live = true; renderRc(); }
    }).catch(function () {});
    j('https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/asset-returns.json', LIVE_MS)
      .catch(function () { return j('/data/asset-returns.json', LIVE_MS); })
      .then(renderReturns)
      .catch(function () { var t = document.getElementById('arTable'); if (t) t.hidden = true; });
  }
  initTools();


  /* Newsletter issues with cover images. */
  function issueHref(issue) {
    if (issue.url) return issue.url;
    return issue.slug ? issueLink(issue.slug) : '#';
  }
  function markIssue(a, slug) {
    if (slug) a.setAttribute('data-issue-slug', slug);
  }
  function archiveCard(issue) {
    var a = document.createElement('a');
    a.className = 'archive-card';
    a.href = issueHref(issue);
    if (!issue.url) markIssue(a, issue.slug);
    if (issue.lang) a.setAttribute('hreflang', issue.lang);
    if (issue.image) {
      var img = document.createElement('img');
      img.loading = 'lazy';
      sizedImg(img, issue.image, CARD_SIZES);
      img.alt = undash(issue.title || '');
      a.appendChild(img);
    }
    var t = document.createElement('time');
    t.dateTime = issue.date;
    t.textContent = fmtDate(issue.date);
    var h = document.createElement('h3');
    h.textContent = undash(issue.title);
    var p = document.createElement('p');
    p.textContent = undash(issue.excerpt || '');
    a.appendChild(t);
    a.appendChild(h);
    a.appendChild(p);
    return a;
  }
  function paintArchive(issues) {
    var grid = $('archiveGrid');
    if (!grid) return;
    grid.textContent = '';
    (issues || []).filter(function (issue) {
      return issue && issue.slug !== FEATURED_SLUG && !issue.essay;
    }).slice(0, ISSUES_MAX).forEach(function (issue) {
      grid.appendChild(archiveCard(issue));
    });
    linkStories();
    alignDataDesk();
    [].forEach.call(grid.querySelectorAll('img'), function (img) {
      if (!img.complete) img.addEventListener('load', alignDataDesk);
    });
  }

  /* Right rail matches the Newsletter list height.
     Data desk fills row 1; Partners top aligns with issues row 2. */
  var deskAlignTimer = null;
  function issuesRow2Top(cards) {
    if (!cards.length) return null;
    var firstBottom = cards[0].getBoundingClientRect().bottom;
    var i;
    for (i = 1; i < cards.length; i++) {
      var top = cards[i].getBoundingClientRect().top;
      if (top > firstBottom + 2) return top;
    }
    return null;
  }
  function alignDataDesk() {
    var rail = $('issuesRail');
    var desk = $('data-desk');
    var cards = document.querySelectorAll('#archiveGrid .archive-card');
    if (!rail) return;
    if (!window.matchMedia('(min-width: 1021px)').matches || cards.length < 2) {
      rail.style.minHeight = '';
      if (desk) {
        desk.style.height = '';
        desk.style.maxHeight = '';
        desk.style.flex = '';
      }
      return;
    }
    var band = rail.parentElement;
    if (!band) return;
    var last = cards[cards.length - 1];
    var top = band.getBoundingClientRect().top;
    var railTop = rail.getBoundingClientRect().top;
    var bottom = last.getBoundingClientRect().bottom;
    rail.style.minHeight = Math.max(0, Math.round(bottom - top)) + 'px';
    var row2 = issuesRow2Top(cards);
    if (desk && row2 != null) {
      var gap = parseFloat(window.getComputedStyle(rail).rowGap) || 0;
      var deskH = Math.max(0, Math.round(row2 - railTop - gap));
      desk.style.flex = '0 0 auto';
      desk.style.height = deskH + 'px';
      desk.style.maxHeight = deskH + 'px';
    }
  }
  window.addEventListener('resize', function () {
    if (deskAlignTimer) clearTimeout(deskAlignTimer);
    deskAlignTimer = setTimeout(alignDataDesk, 80);
  });
  if (typeof ResizeObserver === 'function') {
    var archiveForAlign = $('archiveGrid');
    if (archiveForAlign) {
      new ResizeObserver(alignDataDesk).observe(archiveForAlign);
    }
  }

  /* Magazine: essay + related WP posts, no empty placeholders. */
  function imgOf(post) {
    try { return post._embedded['wp:featuredmedia'][0].source_url || ''; } catch (e) { return ''; }
  }
  /* WordPress keeps smaller copies of every upload (300 / 768 / 1024 / 1536 px).
     SRCSET maps an original's URL to those copies (same shape only, no square crops),
     filled from the WordPress answers, so phones take a 768 px copy instead of the
     original (Lighthouse mobile: 2.3 MB of images, cover LCP 7.5 s). */
  var FEATURED_SIZES = '(max-width: 800px) calc(100vw - 32px), 510px';
  var CARD_SIZES = '(max-width: 480px) calc(100vw - 32px), 410px';
  var SRCSET = {};
  function remember(posts) {
    (posts || []).forEach(function (p) {
      try {
        var m = p._embedded['wp:featuredmedia'][0], d = m.media_details, ratio = d.width / d.height, seen = {}, out = [];
        var all = Object.keys(d.sizes || {}).map(function (k) { return d.sizes[k]; });
        all.push({ width: d.width, height: d.height, source_url: m.source_url });
        all.forEach(function (x) {
          if (!x || !x.width || !x.height || !x.source_url || seen[x.width]) return;
          if (Math.abs(x.width / x.height - ratio) > 0.02 * ratio) return;
          seen[x.width] = 1; out.push(x.source_url + ' ' + x.width + 'w');
        });
        if (out.length > 1) {
          SRCSET[m.source_url] = out.join(', ');
          // issues.json sometimes names a smaller copy instead of the original
          all.forEach(function (x) { if (x && x.source_url && !SRCSET[x.source_url]) SRCSET[x.source_url] = SRCSET[m.source_url]; });
        }
      } catch (e) { /* no featured image */ }
    });
  }
  function sizedImg(img, url, sizes) {
    var ss = SRCSET[url];
    if (ss) { img.sizes = sizes; img.srcset = ss; } else img.removeAttribute('srcset');
    img.src = url;
  }
  /* Images already on the page when an answer arrives; one that has already
     finished loading is left alone (no second download). */
  function upgradeImages() {
    Array.prototype.forEach.call(document.querySelectorAll('img'), function (img) {
      var ss = SRCSET[img.getAttribute('src')];
      if (!ss || img.hasAttribute('srcset') || (img.complete && img.naturalWidth)) return;
      img.sizes = img.closest('.featured-cover') ? FEATURED_SIZES : CARD_SIZES;
      img.srcset = ss;
    });
  }
  function blogCardFromIssue(issue) {
    var a = document.createElement('a');
    a.className = 'blog-card';
    a.href = issueHref(issue);
    markIssue(a, issue.slug);
    if (issue.image) {
      var img = document.createElement('img');
      img.loading = 'lazy';
      sizedImg(img, issue.image, CARD_SIZES);
      img.alt = undash(issue.title || '');
      a.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'blog-card-body';
    var meta = document.createElement('div');
    meta.className = 'blog-card-meta';
    meta.textContent = [issue.author || 'Ras Vasilisin', fmtDate(issue.date)].filter(Boolean).join(' · ');
    var h = document.createElement('h3');
    h.textContent = undash(issue.title);
    var read = document.createElement('span');
    read.className = 'read';
    read.textContent = tr('readEssay');
    body.appendChild(meta);
    body.appendChild(h);
    body.appendChild(read);
    a.appendChild(body);
    return a;
  }
  function blogCardFromWp(post) {
    var a = document.createElement('a');
    a.className = 'blog-card';
    a.href = issueLink(post.slug);
    markIssue(a, post.slug);
    var imgUrl = imgOf(post);
    if (imgUrl) {
      var img = document.createElement('img');
      img.loading = 'lazy';
      sizedImg(img, imgUrl, CARD_SIZES);
      img.alt = strip(post.title && post.title.rendered);
      a.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'blog-card-body';
    var meta = document.createElement('div');
    meta.className = 'blog-card-meta';
    meta.textContent = fmtDate(post.date);
    var h = document.createElement('h3');
    h.textContent = strip(post.title && post.title.rendered);
    var read = document.createElement('span');
    read.className = 'read';
    read.textContent = tr('readEssay');
    body.appendChild(meta);
    body.appendChild(h);
    body.appendChild(read);
    a.appendChild(body);
    return a;
  }
  function dateMs(iso) {
    var t = Date.parse(iso || '');
    return isNaN(t) ? 0 : t;
  }
  /* Newest non-essay issue from news/issues.json (dates are YYYY-MM-DD). */
  function latestIssue(issues) {
    var best = null;
    (issues || []).forEach(function (issue) {
      if (!issue || !issue.slug || issue.essay || !issue.title || issue.lang) return;
      if (!best || String(issue.date || '') > String(best.date || '')) best = issue;
    });
    return best;
  }
  function fmtEditionDate(ymd) {
    var d = new Date(String(ymd || '') + 'T12:00:00Z');
    if (isNaN(d.getTime())) return '';
    return LANG === 'sk'
      ? d.toLocaleDateString('sk-SK', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
      : d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function issueFacts(issue) {
    if (issue.facts && issue.facts.length) return issue.facts.slice(0, 3).map(undash);
    var parts = undash(issue.excerpt || '').match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
    return parts.map(function (x) { return x.trim().replace(/[.]$/, ''); }).filter(Boolean).slice(0, 3);
  }
  /* The static HTML card is a fallback. If issues.json has a newer issue, rewrite the card from it
     (eyebrow date, cover, headline, facts, links), so a new issue needs only a JSON entry.
     The headline stays the card's H2 (.featured-title); the page H1 is "Virtuse Brief". */
  function setBriefShare(path) {
    var a = document.getElementById('briefShareLinkedIn');
    if (!a || !path) return;
    if (path.charAt(0) !== '/') path = '/' + path;
    var page = 'https://virtuse.com' + path;
    page += (page.indexOf('?') === -1 ? '?' : '&') + 'utm_source=linkedin&utm_medium=social&utm_campaign=brief_share';
    a.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(page);
  }
  function paintFeatured(issue) {
    var card = $('featured');
    if (!card || !issue) return;
    var href = issueLink(issue.slug);
    setBriefShare(href);
    var head = card.querySelector('.featured-title a');
    if (head && head.getAttribute('data-issue-slug') === issue.slug) return;

    var t = card.querySelector('.featured-eyebrow time');
    var label = fmtEditionDate(issue.date);
    if (t && label) {
      t.setAttribute('datetime', issue.date);
      t.textContent = label;
    }
    var img = card.querySelector('.featured-cover img');
    if (img && issue.image) {
      img.removeAttribute('width');
      img.removeAttribute('height');
      sizedImg(img, issue.image, FEATURED_SIZES);
      img.alt = undash(issue.title);
    }
    if (head) {
      head.textContent = undash(issue.title);
      head.setAttribute('href', href);
      markIssue(head, issue.slug);
    }
    var list = card.querySelector('.featured-brief-facts');
    if (list) {
      var facts = issueFacts(issue);
      list.textContent = '';
      facts.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f;
        list.appendChild(li);
      });
      list.hidden = !facts.length;
    }
    var read = card.querySelector('.featured-brief-actions .btn-quiet');
    if (read) {
      read.setAttribute('href', href);
      markIssue(read, issue.slug);
    }
    paintAltLang(issue);
    linkStories();
  }
  /* "Čítať po slovensky" / "Read in English": the translation from the stories' hreflang
     (seo-ops/news_sk_map.py writes alt_url into issues.json and issues-sk.json). No translation, no link. */
  function paintAltLang(issue) {
    var a = $('featuredAltLang');
    if (!a) return;
    if (issue && issue.alt_url) { a.href = issue.alt_url; a.hidden = false; }
    else a.hidden = true;
  }
  function ownCover(issue) {
    return !!(issue && issue.image && !/^https?:\/\/blog\.virtuse\.com\//.test(issue.image));
  }
  /* The server-rendered cover (/news/covers/, already painted, the LCP image) is never swapped for the WordPress copy. */
  function ownCoverPainted(img) {
    return /^\/news\/covers\//.test(img.getAttribute('src') || '');
  }
  function applyFeaturedCover(post) {
    var img = document.querySelector('#featured .featured-cover img');
    if (!img || !post || ownCover(LATEST_ISSUE) || ownCoverPainted(img)) return;
    var url = imgOf(post);
    if (!url || img.getAttribute('src') === url) return;
    sizedImg(img, url, FEATURED_SIZES);
  }
  function paintBlog(issues, wpPosts) {
    var section = $('blog');
    var grid = $('blogGrid');
    if (!section || !grid) return;
    var skip = {};
    skip[FEATURED_SLUG] = true;
    (issues || []).forEach(function (issue) {
      if (issue && issue.slug && !issue.essay) skip[issue.slug] = true;
    });

    var candidates = [];
    (issues || []).forEach(function (issue) {
      if (!issue || !issue.essay || !issue.slug || skip[issue.slug]) return;
      skip[issue.slug] = true;
      candidates.push({ date: dateMs(issue.date), node: blogCardFromIssue(issue) });
    });
    (wpPosts || []).forEach(function (post) {
      if (!post || !post.slug || skip[post.slug]) return;
      skip[post.slug] = true;
      candidates.push({ date: dateMs(post.date), node: blogCardFromWp(post) });
    });
    candidates.sort(function (a, b) { return b.date - a.date; });
    var cards = candidates.slice(0, BLOG_MAX).map(function (c) { return c.node; });

    grid.textContent = '';
    if (!cards.length) {
      section.hidden = true;
      return;
    }
    cards.forEach(function (card) { grid.appendChild(card); });
    section.hidden = false;
    linkStories();
  }

  j(LANG === 'sk' ? '/news/issues-sk.json?v=20261112' : '/news/issues.json?v=20261112').then(function (data) {
    var list = (data && data.issues) || [];
    var latest = latestIssue(list);
    if (latest) {
      FEATURED_SLUG = latest.slug;
      LATEST_ISSUE = latest;
      paintFeatured(latest);
      paintAltLang(latest);
    }
    paintArchive(list);
    paintBlog(list, []);
    j(WP + '?categories=' + BLOG_CATS + '&per_page=12&orderby=date&order=desc&_embed=wp:featuredmedia', 8000).then(function (posts) {
      remember(posts);
      paintBlog(list, posts || []);
      upgradeImages();
    }).catch(function () { /* keep the local essay if any */ });
    // One request for every issue's post (featured cover + the smaller image copies).
    var slugs = [FEATURED_SLUG];
    list.forEach(function (i) { if (i.slug && slugs.indexOf(i.slug) < 0) slugs.push(i.slug); });
    j(WP + '?slug=' + encodeURIComponent(slugs.slice(0, 50).join(',')) + '&per_page=50&_embed=wp:featuredmedia', 8000).then(function (posts) {
      remember(posts);
      applyFeaturedCover((posts || []).filter(function (p) { return p.slug === FEATURED_SLUG; })[0] || null);
      upgradeImages();
    }).catch(function () { /* keep the static HTML cover */ });
  }).catch(function () {
    paintArchive([]);
    paintBlog([], []);
  });

})();
