/* Virtuse Brief — theme, capture, pulse, issues, data desk, Ras Take. */
(function () {
  'use strict';

  var MP = 'https://mempool.space/api';
  var WORKER = 'https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe';
  var FEATURED_SLUG = 'bitcoin-fell-below-77000-etfs-sold-fed-looms';
  var THEME_KEY = 'vb-theme';
  var THEME_DARK = '#111110';
  var THEME_LIGHT = '#FBFBFA';
  var PULSE_MAX = 5;

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
  function usd(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }
  function compact(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function articleUrl(slug) {
    return 'article.html?slug=' + encodeURIComponent(slug);
  }
  function setText(id, v) {
    var el = $(id);
    if (el) el.textContent = v;
  }
  function pctClass(n) {
    if (n == null || isNaN(n) || n === 0) return '';
    return n > 0 ? 'up' : 'down';
  }
  function signedPct(n) {
    if (n == null || isNaN(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  /* Theme: default dark, persist vb-theme, update theme-color. ~40 lines. */
  (function () {
    var btn = $('themeToggle');
    var label = $('themeToggleLabel');
    var meta = document.querySelector('meta[name="theme-color"]');
    function current() {
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
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      btn.setAttribute('title', cap + ' theme');
      if (label) label.textContent = cap;
    }
    if (btn) {
      btn.addEventListener('click', function () {
        apply(current() === 'dark' ? 'light' : 'dark', true);
      });
    }
    apply(current(), false);
  })();

  /* Sticky compact form after Featured Brief, desktop only, not first paint. */
  (function () {
    var form = $('subscribeStripForm');
    var featured = $('featured');
    var join = $('subscribe');
    if (!form || !featured) return;
    var mq = window.matchMedia('(min-width: 1021px)');
    var seenScroll = false;
    function update() {
      if (!seenScroll || !mq.matches) {
        form.classList.remove('is-sticky');
        document.body.classList.remove('capture-sticky');
        return;
      }
      var featuredPast = featured.getBoundingClientRect().bottom <= 0;
      var joinInView = join && join.getBoundingClientRect().top < window.innerHeight;
      var sticky = featuredPast && !joinInView;
      form.classList.toggle('is-sticky', sticky);
      document.body.classList.toggle('capture-sticky', sticky);
    }
    window.addEventListener('scroll', function () {
      seenScroll = true;
      update();
    }, { passive: true });
    if (mq.addEventListener) mq.addEventListener('change', update);
    else if (mq.addListener) mq.addListener(update);
  })();

  /* Subscribe — existing Worker, ENG list. */
  function bindSubscribe(form, msg) {
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    var label = btn.textContent;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements.email.value.trim();
      var hp = form.elements.website.value;
      if (msg) {
        msg.textContent = '';
        msg.className = 'subscribe-msg';
      }
      if (!email) {
        if (msg) {
          msg.textContent = 'Email is required.';
          msg.classList.add('err');
        }
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending';
      fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, hp: hp, lang: 'en' })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (result) {
        if (result.ok) {
          form.reset();
          if (msg) {
            msg.textContent = 'You are on the list. Check your inbox.';
            msg.classList.add('ok');
          }
        } else if (msg) {
          msg.textContent = (result.data && result.data.error) || 'Could not join the list. Try again.';
          msg.classList.add('err');
        }
      }).catch(function () {
        if (msg) {
          msg.textContent = 'Network error. Try again.';
          msg.classList.add('err');
        }
      }).then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  }
  bindSubscribe($('subscribeStripForm'), $('subscribeStripMsg'));
  bindSubscribe($('subscribeForm'), $('subscribeMsg'));

  /* Masthead BTC/USD (omit if dash) + Data desk (4 figures). */
  function setMastPrice(value) {
    var wrap = $('mastBtc');
    var el = $('mastPrice');
    if (!wrap || !el) return;
    if (!value || value === '—') {
      wrap.hidden = true;
      el.textContent = '';
      return;
    }
    el.textContent = value;
    wrap.hidden = false;
  }

  function refreshMarket() {
    j(MP + '/v1/prices').then(function (p) {
      var price = usd(p.USD);
      setText('tilePrice', price);
      setMastPrice(price);
    }).catch(function () {
      setMastPrice('');
    });

    j('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(function (t) {
      var n = parseFloat(t.priceChangePercent);
      setText('tileChg', signedPct(n));
      var el = $('tileChg');
      if (el) el.className = 'tile-value ' + pctClass(n);
    }).catch(function () {
      return j('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(function (g) {
        var n = g.bitcoin && g.bitcoin.usd_24h_change;
        setText('tileChg', signedPct(n));
        var el = $('tileChg');
        if (el) el.className = 'tile-value ' + pctClass(n);
      });
    }).catch(function () {});

    j(MP + '/v1/fees/recommended').then(function (f) {
      setText('tileFee', f.fastestFee != null ? f.fastestFee + ' sat/vB' : '—');
    }).catch(function () {});

    j(MP + '/v1/mining/hashrate/3d').then(function (m) {
      setText('tileHash', compact(m.currentHashrate / 1e18) + ' EH/s');
    }).catch(function () {});
  }
  refreshMarket();
  setInterval(refreshMarket, 60000);

  /* Pulse: Bitcoin-only, 4–5 max, TAG + 2 sentences + Read at {Outlet}. */
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
    if (!item) return 'Full story';
    if (isDeskStory(item)) return 'Read this Brief';
    var src = (item.source || '').replace(/\s+/g, ' ').trim();
    if (!src) return 'Full story';
    if (/crypto\s*slate/i.test(src)) return 'Read at CryptoSlate';
    return 'Read at ' + src;
  }
  function firstSentence(text) {
    var m = (text || '').match(/[^.!?]+[.!?]+|[^.!?]+$/);
    return m ? m[0].trim() : '';
  }
  function twoSentences(item) {
    var title = ((item && item.title) || '').replace(/\s+/g, ' ').trim();
    var excerpt = ((item && item.excerpt) || '').replace(/\s+/g, ' ').trim();
    if (title && !/[.!?]$/.test(title)) title += '.';
    if (title && excerpt) return (title + ' ' + firstSentence(excerpt)).trim();
    return firstSentence(title || excerpt);
  }
  function renderPulse(items) {
    var list = $('pulseList');
    var empty = $('pulseEmpty');
    if (!list || !empty) return;
    list.textContent = '';
    var shorts = (items || []).filter(function (it) {
      return it && !isDeskStory(it) && isBitcoinOnly(it);
    }).slice(0, PULSE_MAX);
    if (!shorts.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    shorts.forEach(function (it) {
      var article = document.createElement('article');
      article.className = 'pulse-item';
      var tag = document.createElement('span');
      tag.className = 'pulse-tag';
      tag.textContent = (it.source || 'Desk').replace(/\s+/g, ' ').trim();
      var copy = document.createElement('p');
      copy.className = 'pulse-copy';
      copy.textContent = twoSentences(it);
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
  function loadPulse() {
    j('news/news-pulse.json').then(function (data) {
      var local = (data && data.items) || [];
      if (data && data.feed) {
        return j(data.feed).then(function (remote) {
          var items = (remote && remote.items) || remote;
          renderPulse(Array.isArray(items) && items.length ? items : local);
        }).catch(function () { renderPulse(local); });
      }
      renderPulse(local);
    }).catch(function () { renderPulse([]); });
  }
  loadPulse();

  /* Latest issues + Ras Take (omit block if no essay). */
  function issueHref(issue) {
    return issue.slug ? articleUrl(issue.slug) : (issue.url || '#');
  }
  function archiveCard(issue) {
    var a = document.createElement('a');
    a.className = 'archive-card';
    a.href = issueHref(issue);
    var t = document.createElement('time');
    t.dateTime = issue.date;
    t.textContent = fmtDate(issue.date);
    var h = document.createElement('h3');
    h.textContent = issue.title;
    var p = document.createElement('p');
    p.textContent = issue.excerpt || '';
    a.appendChild(t);
    a.appendChild(h);
    a.appendChild(p);
    return a;
  }
  function paintRasTake(issues) {
    var section = $('rasTake');
    if (!section) return;
    var essay = null;
    (issues || []).some(function (issue) {
      if (issue && issue.essay) { essay = issue; return true; }
      return false;
    });
    if (!essay) {
      section.hidden = true;
      return;
    }
    setText('rasTitle', essay.title || '');
    setText('rasDek', essay.excerpt || '');
    var link = $('rasRead');
    if (link) link.href = issueHref(essay);
    section.hidden = false;
  }
  function paintArchive(issues) {
    var grid = $('archiveGrid');
    if (!grid) return;
    grid.textContent = '';
    (issues || []).filter(function (issue) {
      return issue && issue.slug !== FEATURED_SLUG && !issue.essay;
    }).forEach(function (issue) {
      grid.appendChild(archiveCard(issue));
    });
  }
  j('news/issues.json').then(function (data) {
    var list = (data && data.issues) || [];
    paintArchive(list);
    paintRasTake(list);
  }).catch(function () {
    paintArchive([]);
    paintRasTake([]);
  });
})();
