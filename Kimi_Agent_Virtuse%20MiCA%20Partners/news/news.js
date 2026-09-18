/* Virtuse Brief — ticker, theme, pulse, issues, blog, subscribe. */
(function () {
  'use strict';

  var MP = 'https://mempool.space/api';
  var WP = 'https://blog.virtuse.com/wp-json/wp/v2/posts';
  var WORKER = 'https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe';
  var FEATURED_SLUG = 'bitcoin-fell-below-77000-etfs-sold-fed-looms';
  var THEME_KEY = 'vb-theme';
  var THEME_DARK = '#111110';
  var THEME_LIGHT = '#FBFBFA';
  var PULSE_MAX = 5;
  var PULSE_TAGS = ['ETF', 'Fed', 'Policy', 'Mining', 'Security'];
  var BLOG_CATS = '13,15';
  var BLOG_MAX = 3;

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
  function strip(s) {
    var doc = new DOMParser().parseFromString(s || '', 'text/html');
    return (doc.body.textContent || '').replace('[…]', '…').trim();
  }
  function num(n, d) {
    if (n == null || isNaN(n)) return '—';
    return n.toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });
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

  /* Theme: default dark, persist vb-theme, update theme-color. */
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

  /* Ticker + by-the-numbers tiles. */
  var lastTickerStats = null;
  var tickerResizeTimer = null;
  function renderTicker(stats) {
    var host = $('tickerTrack');
    if (!host) return;
    lastTickerStats = stats;
    var parts = [
      ['BTC/USD', stats.price || '—', ''],
      ['24h', stats.chg || '—', stats.chgClass || ''],
      ['Hashrate', stats.hash || '—', ''],
      ['Fees', stats.fee || '—', ''],
      ['Sats/$', stats.sats || '—', ''],
      ['Block', stats.height || '—', '']
    ];
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
    host.textContent = '';
    var probe = makeGroup(1);
    host.appendChild(probe);
    var rowW = probe.getBoundingClientRect().width;
    var parent = host.parentElement;
    var viewW = parent ? parent.getBoundingClientRect().width : 1200;
    var copies = Math.max(1, Math.ceil((viewW + 1) / Math.max(rowW, 1)));
    host.textContent = '';
    host.appendChild(makeGroup(copies));
    host.appendChild(makeGroup(copies));
  }

  window.addEventListener('resize', function () {
    if (tickerResizeTimer) clearTimeout(tickerResizeTimer);
    tickerResizeTimer = setTimeout(function () {
      if (lastTickerStats) renderTicker(lastTickerStats);
    }, 150);
  });

  function refreshMarket() {
    var stats = { price: '—', sats: '—', chg: '—', chgClass: '', hash: '—', fee: '—', height: '—' };

    j(MP + '/v1/prices').then(function (p) {
      stats.price = usd(p.USD);
      stats.sats = p.USD ? num(Math.round(1e8 / p.USD)) : '—';
      setText('tilePrice', stats.price);
      setText('tileSats', stats.sats);
      renderTicker(stats);
    }).catch(function () {});

    j('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(function (t) {
      var n = parseFloat(t.priceChangePercent);
      stats.chg = signedPct(n);
      stats.chgClass = pctClass(n);
      setText('tileChg', stats.chg);
      var el = $('tileChg');
      if (el) el.className = 'tile-value ' + stats.chgClass;
      renderTicker(stats);
    }).catch(function () {
      return j('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(function (g) {
        var n = g.bitcoin && g.bitcoin.usd_24h_change;
        stats.chg = signedPct(n);
        stats.chgClass = pctClass(n);
        setText('tileChg', stats.chg);
        var el = $('tileChg');
        if (el) el.className = 'tile-value ' + stats.chgClass;
        renderTicker(stats);
      });
    }).catch(function () {});

    j(MP + '/blocks/tip/height').then(function (h) {
      stats.height = num(h);
      setText('tileHeight', stats.height);
      renderTicker(stats);
    }).catch(function () {});

    j(MP + '/v1/fees/recommended').then(function (f) {
      stats.fee = f.fastestFee != null ? f.fastestFee + ' sat/vB' : '—';
      setText('tileFee', f.fastestFee != null ? f.fastestFee + ' sat/vB' : '—');
      renderTicker(stats);
    }).catch(function () {});

    j(MP + '/v1/mining/hashrate/3d').then(function (m) {
      stats.hash = compact(m.currentHashrate / 1e18) + ' EH/s';
      setText('tileHash', stats.hash);
      renderTicker(stats);
    }).catch(function () {});
  }
  renderTicker({ price: '—', sats: '—', chg: '—', chgClass: '', hash: '—', fee: '—', height: '—' });
  refreshMarket();
  setInterval(refreshMarket, 60000);

  /* Pulse: Bitcoin-only, 4–5 max, TAG icon + copy + Read at {Outlet}. */
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
    if (explicit) {
      var hit = PULSE_TAGS.filter(function (t) {
        return t.toLowerCase() === explicit.toLowerCase();
      })[0];
      if (hit) return hit;
    }
    var blob = (((item && item.title) || '') + ' ' + ((item && item.excerpt) || '')).toLowerCase();
    if (/\betfs?\b|ishares|spot fund/.test(blob)) return 'ETF';
    if (/\bfed\b|fomc|powell|jackson hole/.test(blob)) return 'Fed';
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
      var tagName = inferTag(it);
      var tag = document.createElement('span');
      tag.className = 'pulse-tag';
      tag.appendChild(pulseIcon(tagName));
      tag.appendChild(document.createTextNode(tagName));
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

  /* Latest issues with cover images. */
  function issueHref(issue) {
    return issue.slug ? articleUrl(issue.slug) : (issue.url || '#');
  }
  function archiveCard(issue) {
    var a = document.createElement('a');
    a.className = 'archive-card';
    a.href = issueHref(issue);
    if (issue.image) {
      var img = document.createElement('img');
      img.src = issue.image;
      img.alt = issue.title || '';
      img.loading = 'lazy';
      a.appendChild(img);
    }
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

  /* Blog / Ras Take — essay + related WP posts, no empty placeholders. */
  function imgOf(post) {
    try { return post._embedded['wp:featuredmedia'][0].source_url || ''; } catch (e) { return ''; }
  }
  function blogCardFromIssue(issue) {
    var a = document.createElement('a');
    a.className = 'blog-card';
    a.href = issueHref(issue);
    if (issue.image) {
      var img = document.createElement('img');
      img.src = issue.image;
      img.alt = issue.title || '';
      img.loading = 'lazy';
      a.appendChild(img);
    }
    var body = document.createElement('div');
    body.className = 'blog-card-body';
    var meta = document.createElement('div');
    meta.className = 'blog-card-meta';
    meta.textContent = [issue.author || 'Ras Vasilisin', fmtDate(issue.date)].filter(Boolean).join(' · ');
    var h = document.createElement('h3');
    h.textContent = issue.title;
    var read = document.createElement('span');
    read.className = 'read';
    read.textContent = 'Read essay';
    body.appendChild(meta);
    body.appendChild(h);
    body.appendChild(read);
    a.appendChild(body);
    return a;
  }
  function blogCardFromWp(post) {
    var a = document.createElement('a');
    a.className = 'blog-card';
    a.href = articleUrl(post.slug);
    var imgUrl = imgOf(post);
    if (imgUrl) {
      var img = document.createElement('img');
      img.src = imgUrl;
      img.alt = strip(post.title && post.title.rendered);
      img.loading = 'lazy';
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
    read.textContent = 'Read essay';
    body.appendChild(meta);
    body.appendChild(h);
    body.appendChild(read);
    a.appendChild(body);
    return a;
  }
  function paintBlog(issues, wpPosts) {
    var section = $('blog');
    var grid = $('blogGrid');
    if (!section || !grid) return;
    var essay = null;
    (issues || []).some(function (issue) {
      if (issue && issue.essay) { essay = issue; return true; }
      return false;
    });
    var skip = {};
    skip[FEATURED_SLUG] = true;
    (issues || []).forEach(function (issue) {
      if (issue && issue.slug && !issue.essay) skip[issue.slug] = true;
    });
    if (essay && essay.slug) skip[essay.slug] = true;

    var cards = [];
    if (essay) cards.push(blogCardFromIssue(essay));
    (wpPosts || []).forEach(function (post) {
      if (cards.length >= BLOG_MAX) return;
      if (!post || !post.slug || skip[post.slug]) return;
      skip[post.slug] = true;
      cards.push(blogCardFromWp(post));
    });
    grid.textContent = '';
    if (!cards.length) {
      section.hidden = true;
      return;
    }
    cards.forEach(function (card) { grid.appendChild(card); });
    section.hidden = false;
  }

  j('news/issues.json').then(function (data) {
    var list = (data && data.issues) || [];
    paintArchive(list);
    paintBlog(list, []);
    j(WP + '?categories=' + BLOG_CATS + '&per_page=12&_embed=wp:featuredmedia', 8000).then(function (posts) {
      paintBlog(list, posts || []);
    }).catch(function () { /* keep the local essay if any */ });
  }).catch(function () {
    paintArchive([]);
    paintBlog([], []);
  });

  /* Data desk tabs: click + arrow/Home/End, no live metrics. */
  (function () {
    var root = $('data-desk');
    if (!root) return;
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    var panels = [].slice.call(root.querySelectorAll('[role="tabpanel"]'));
    if (!tabs.length) return;

    function select(id, moveFocus) {
      tabs.forEach(function (tab) {
        var on = tab.id === id;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (on && moveFocus) tab.focus();
      });
      panels.forEach(function (panel) {
        var on = panel.getAttribute('aria-labelledby') === id;
        if (on) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab.id, false); });
      tab.addEventListener('keydown', function (e) {
        var next = i;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault();
        select(tabs[next].id, true);
      });
    });
  })();
})();
