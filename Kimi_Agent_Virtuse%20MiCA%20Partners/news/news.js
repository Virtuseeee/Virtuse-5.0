/* Virtuse News hub — ticker, pulse, dashboard, issues, WP blog, subscribe. */
(function () {
  'use strict';

  var MP = 'https://mempool.space/api';
  var WP = 'https://blog.virtuse.com/wp-json/wp/v2/posts';
  var WORKER = 'https://virtuse-newsletter.virtuse-ai.workers.dev/subscribe';
  var HALVING_INTERVAL = 210000;
  var ISSUES_PAGE = 6;
  var BLOG_PAGE = 12;
  /* Boxes 16 and Reports 35 are dead; never dump uncategorized or crypto-news (38). */
  var BLOG_CATS = '13,15';
  var TOPICS = {
    Market: /etf|price|market|dump|rally|outflow|inflow|spot bitcoin|dominance|\$[0-9]/i,
    Regulation: /mica|sec|clarity|regulat|digital euro|securities|cftc/i,
    Treasury: /treasury|saylor|strategy|microstrategy|corporate|ibit|blackrock/i,
    Mining: /mining|hashrate|miner|asic|pool/i,
    Policy: /fed|warsh|senate|congress|fomc|government|white house|policy/i,
    Macro: /debt|inflat|dollar|gold|print|peasant|credit card|macro|treasury yield/i
  };

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
  function timeAgo(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var s = Math.round((Date.now() - t) / 1000);
    if (s < 120) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 172800) return 'yesterday';
    return fmtDate(iso);
  }
  function articleUrl(slug) {
    return 'article.html?slug=' + encodeURIComponent(slug);
  }
  function supplyAtHeight(h) {
    var supply = 0, subsidy = 50, remaining = h;
    while (remaining > 0) {
      var blocks = Math.min(remaining, HALVING_INTERVAL);
      supply += blocks * subsidy;
      remaining -= blocks;
      subsidy /= 2;
    }
    return supply;
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
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(2) + '%';
  }

  /* —— Nav —— */
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

  /* —— Subscribe (existing Worker; ENG list via RESEND_SEGMENT_ID) —— */
  (function () {
    var form = $('subscribeForm');
    if (!form) return;
    var msg = $('subscribeMsg');
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements.email.value.trim();
      var hp = form.elements.website.value;
      msg.textContent = '';
      msg.className = 'subscribe-msg';
      if (!email) {
        msg.textContent = 'Email is required.';
        msg.classList.add('err');
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
          msg.textContent = 'You are on the weekly list. Check your inbox.';
          msg.classList.add('ok');
        } else {
          msg.textContent = (result.data && result.data.error) || 'Could not join the list. Try again.';
          msg.classList.add('err');
        }
      }).catch(function () {
        msg.textContent = 'Network error. Try again.';
        msg.classList.add('err');
      }).then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  })();

  /* —— Ticker + dashboard —— */
  function renderTicker(stats) {
    var host = $('tickerTrack');
    if (!host) return;
    var parts = [
      ['BTC/USD', stats.price || '—', ''],
      ['24h', stats.chg || '—', stats.chgClass || ''],
      ['Dominance', stats.dom || '—', ''],
      ['Hashrate', stats.hash || '—', ''],
      ['Fees', stats.fee || '—', ''],
      ['Block', stats.height || '—', '']
    ];
    function row() {
      var frag = document.createDocumentFragment();
      parts.forEach(function (p, i) {
        if (i) {
          var sep = document.createElement('span');
          sep.className = 'ticker-sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '·';
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
    host.textContent = '';
    host.appendChild(row());
    host.appendChild(row());
  }

  function refreshMarket() {
    var stats = { price: '—', chg: '—', chgClass: '', dom: '—', hash: '—', fee: '—', height: '—' };

    j(MP + '/v1/prices').then(function (p) {
      stats.price = usd(p.USD);
      setText('tilePrice', stats.price);
      renderTicker(stats);
    }).catch(function () {});

    j('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(function (t) {
      var n = parseFloat(t.priceChangePercent);
      stats.chg = signedPct(n);
      stats.chgClass = pctClass(n);
      setText('tileChg', stats.chg);
      var el = $('tileChg');
      if (el) { el.className = 'tile-value ' + stats.chgClass; }
      renderTicker(stats);
    }).catch(function () {
      return j('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true').then(function (g) {
        var n = g.bitcoin && g.bitcoin.usd_24h_change;
        stats.chg = signedPct(n);
        stats.chgClass = pctClass(n);
        setText('tileChg', stats.chg);
        var el = $('tileChg');
        if (el) { el.className = 'tile-value ' + stats.chgClass; }
        renderTicker(stats);
      });
    }).catch(function () {});

    j('https://api.coingecko.com/api/v3/global').then(function (g) {
      var d = g.data && g.data.market_cap_percentage && g.data.market_cap_percentage.btc;
      stats.dom = d != null ? d.toFixed(1) + '%' : '—';
      setText('tileDom', stats.dom);
      renderTicker(stats);
    }).catch(function () {});

    j(MP + '/blocks/tip/height').then(function (h) {
      stats.height = num(h);
      setText('tileHeight', stats.height);
      var next = (Math.floor(h / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
      var days = (next - h) * 10 / 60 / 24;
      setText('tileHalving', Math.round(days) + 'd');
      renderTicker(stats);
    }).catch(function () {});

    j(MP + '/v1/fees/recommended').then(function (f) {
      stats.fee = (f.fastestFee != null ? f.fastestFee : '—') + ' sat/vB';
      setText('tileFee', f.fastestFee != null ? f.fastestFee + ' sat/vB' : '—');
      renderTicker(stats);
    }).catch(function () {});

    j(MP + '/v1/mining/hashrate/3d').then(function (m) {
      stats.hash = compact(m.currentHashrate / 1e18) + ' EH/s';
      setText('tileHash', stats.hash);
      renderTicker(stats);
    }).catch(function () {});
  }

  renderTicker({ price: '—', chg: '—', chgClass: '', dom: '—', hash: '—', fee: '—', height: '—' });
  refreshMarket();
  setInterval(refreshMarket, 60000);

  /* —— Pulse —— */
  function renderPulse(items) {
    var list = $('pulseList');
    var empty = $('pulseEmpty');
    if (!list || !empty) return;
    list.textContent = '';
    if (!items || !items.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    items.slice(0, 3).forEach(function (it) {
      var a = document.createElement('a');
      a.className = 'pulse-item';
      a.href = it.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var left = document.createElement('div');
      var h = document.createElement('h3');
      h.textContent = it.title;
      left.appendChild(h);
      var meta = document.createElement('div');
      meta.className = 'pulse-meta';
      meta.textContent = [it.source, timeAgo(it.published)].filter(Boolean).join(' · ');
      a.appendChild(left);
      a.appendChild(meta);
      list.appendChild(a);
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

  /* —— Issues / latest issue —— */
  var issuesState = { all: [], shown: 0 };

  function issueHref(issue) {
    return issue.slug ? articleUrl(issue.slug) : (issue.url || '#');
  }

  function paintHero(issue) {
    if (!issue) return;
    setText('heroKicker', 'This week');
    var title = $('heroTitle');
    if (title) title.textContent = issue.title;
    var excerpt = $('heroExcerpt');
    if (excerpt) excerpt.textContent = issue.excerpt || '';
    var read = $('heroRead');
    if (read) read.href = issueHref(issue);
    var date = $('heroCardDate');
    if (date) date.textContent = fmtDate(issue.date);
    var cardTitle = $('heroCardTitle');
    if (cardTitle) cardTitle.textContent = issue.title;
    var img = $('heroCardImg');
    if (img) {
      if (issue.image) {
        img.src = issue.image;
        img.alt = issue.title;
        img.hidden = false;
      } else {
        img.hidden = true;
      }
    }
    var card = $('heroCard');
    if (card) card.href = issueHref(issue);
  }

  function paintSponsor(sponsor) {
    var slot = $('sponsoredSlot');
    var name = $('sponsoredName');
    if (!slot) return;
    if (sponsor) {
      if (name) name.textContent = sponsor;
      slot.hidden = false;
    } else {
      slot.hidden = true;
    }
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
    var r = document.createElement('div');
    r.className = 'read';
    r.textContent = (issue.read_min ? issue.read_min + ' min read' : 'Read issue');
    a.appendChild(t);
    a.appendChild(h);
    a.appendChild(p);
    a.appendChild(r);
    return a;
  }

  function paintArchive(reset) {
    var grid = $('archiveGrid');
    var btn = $('archiveMore');
    if (!grid) return;
    if (reset) {
      grid.textContent = '';
      issuesState.shown = 0;
    }
    var next = issuesState.all.slice(issuesState.shown, issuesState.shown + ISSUES_PAGE);
    next.forEach(function (issue) { grid.appendChild(archiveCard(issue)); });
    issuesState.shown += next.length;
    if (btn) btn.hidden = issuesState.shown >= issuesState.all.length;
  }

  function mergeIssues(local, wpPosts) {
    var bySlug = {};
    local.forEach(function (i) { if (i.slug) bySlug[i.slug] = i; });
    (wpPosts || []).forEach(function (p) {
      var img = '';
      try { img = p._embedded['wp:featuredmedia'][0].source_url || ''; } catch (e) {}
      var weekly = /weekly-take|weekly take|this week/i.test((img || '') + ' ' + (p.slug || '') + ' ' + strip(p.title && p.title.rendered));
      if (!weekly && bySlug[p.slug]) weekly = true;
      if (!weekly) return;
      if (!bySlug[p.slug]) {
        bySlug[p.slug] = {
          date: (p.date || '').slice(0, 10),
          title: strip(p.title && p.title.rendered),
          excerpt: strip(p.excerpt && p.excerpt.rendered),
          slug: p.slug,
          image: img,
          read_min: 5,
          author: 'Ras Vasilisin'
        };
      }
    });
    return Object.keys(bySlug).map(function (k) { return bySlug[k]; }).sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
  }

  function applyIssues(list, sponsor) {
    paintSponsor(sponsor);
    issuesState.all = list || [];
    paintHero(issuesState.all[0]);
    paintArchive(true);
  }

  function loadIssues() {
    j('news/issues.json').then(function (data) {
      var local = (data && data.issues) || [];
      applyIssues(local, data && data.sponsor);
      j(WP + '?categories=13&per_page=12&_embed=wp:featuredmedia', 8000).then(function (posts) {
        applyIssues(mergeIssues(local, posts || []), data && data.sponsor);
      }).catch(function () { /* keep the local archive */ });
    }).catch(function () {
      applyIssues([], null);
    });
  }
  loadIssues();
  var moreBtn = $('archiveMore');
  if (moreBtn) moreBtn.addEventListener('click', function () { paintArchive(false); });

  /* —— Virtuse Blog (Phase 2 heading: Satoshi Blog) —— */
  var blog = { page: 1, totalPages: 1, topic: '', q: '', posts: [] };

  function imgOf(post) {
    try { return post._embedded['wp:featuredmedia'][0].source_url || ''; } catch (e) { return ''; }
  }
  function authorOf(post) {
    try { return post._embedded.author[0].name || 'Ras Vasilisin'; } catch (e) { return 'Ras Vasilisin'; }
  }
  function catsOk(post) {
    var cats = post.categories || [];
    if (cats.indexOf(16) !== -1 || cats.indexOf(35) !== -1) return false;
    return cats.indexOf(13) !== -1 || cats.indexOf(15) !== -1;
  }
  function topicMatch(post, topic) {
    if (!topic) return true;
    var re = TOPICS[topic];
    if (!re) return true;
    var blob = strip(post.title && post.title.rendered) + ' ' + strip(post.excerpt && post.excerpt.rendered);
    return re.test(blob);
  }

  function blogCard(post) {
    var a = document.createElement('a');
    a.className = 'blog-card';
    a.href = articleUrl(post.slug);
    var img = imgOf(post);
    if (img) {
      var im = document.createElement('img');
      im.src = img;
      im.alt = strip(post.title && post.title.rendered);
      im.loading = 'lazy';
      a.appendChild(im);
    } else {
      var ph = document.createElement('div');
      ph.className = 'blog-card-ph';
      ph.textContent = 'N';
      a.appendChild(ph);
    }
    var body = document.createElement('div');
    body.className = 'blog-card-body';
    var h = document.createElement('h3');
    h.textContent = strip(post.title && post.title.rendered);
    var meta = document.createElement('div');
    meta.className = 'blog-card-meta';
    var au = document.createElement('span');
    au.textContent = authorOf(post);
    var t = document.createElement('span');
    t.textContent = fmtDate(post.date);
    meta.appendChild(au);
    meta.appendChild(t);
    body.appendChild(h);
    body.appendChild(meta);
    a.appendChild(body);
    return a;
  }

  function paintBlog(append) {
    var grid = $('blogGrid');
    var empty = $('blogEmpty');
    if (!grid) return;
    if (!append) grid.textContent = '';
    var shown = blog.posts.filter(function (p) { return catsOk(p) && topicMatch(p, blog.topic); });
    if (blog.q) {
      var q = blog.q.toLowerCase();
      shown = shown.filter(function (p) {
        return (strip(p.title && p.title.rendered) + ' ' + strip(p.excerpt && p.excerpt.rendered)).toLowerCase().indexOf(q) !== -1;
      });
    }
    shown.forEach(function (p) { grid.appendChild(blogCard(p)); });
    if (empty) {
      if (shown.length) {
        empty.hidden = true;
      } else {
        empty.hidden = false;
        if (blog.q || blog.topic) empty.textContent = 'No articles match that filter.';
        else if (!blog.posts.length) empty.textContent = 'Loading the desk…';
        else empty.textContent = 'No articles match that filter.';
      }
    }
  }

  function fetchBlog(reset) {
    if (reset) { blog.page = 1; blog.posts = []; }
    var btn = $('blogMore');
    if (btn) btn.disabled = true;
    var url = WP + '?categories=' + BLOG_CATS + '&per_page=' + BLOG_PAGE + '&page=' + blog.page + '&_embed=wp:featuredmedia,author';
    if (blog.q) url += '&search=' + encodeURIComponent(blog.q);
    var opts = {};
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(10000);
    fetch(url, opts).then(function (r) {
      blog.totalPages = parseInt(r.headers.get('X-WP-TotalPages') || '1', 10);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }).then(function (posts) {
      blog.posts = blog.posts.concat(posts || []);
      paintBlog(false);
      if (btn) {
        btn.disabled = false;
        btn.hidden = blog.page >= blog.totalPages;
      }
    }).catch(function () {
      paintBlog(false);
      var empty = $('blogEmpty');
      if (empty && !blog.posts.length) {
        empty.hidden = false;
        empty.textContent = 'Could not reach the article feed.';
      }
      if (btn) btn.disabled = false;
    });
  }
  fetchBlog(true);

  var blogMore = $('blogMore');
  if (blogMore) {
    blogMore.addEventListener('click', function () {
      blog.page += 1;
      fetchBlog(false);
    });
  }

  var search = $('blogSearch');
  var searchTimer;
  if (search) {
    search.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        blog.q = search.value.trim();
        fetchBlog(true);
      }, 280);
    });
  }

  var chips = document.querySelectorAll('.chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var topic = chip.getAttribute('data-topic') || '';
      if (blog.topic === topic) {
        blog.topic = '';
        chip.setAttribute('aria-pressed', 'false');
      } else {
        blog.topic = topic;
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      }
      paintBlog(false);
    });
  });
})();
