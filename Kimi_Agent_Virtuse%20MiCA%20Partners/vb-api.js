/* The site's one client for the newsletter Worker (cloudflare-worker/).
   The only file that names the Worker's URL: every form that posts to it
   (Brief signups, CFO / Verdict waitlist, partner checklist, Verdict) goes
   through window.VB_API.

   Loading: pages with inline form code (the 10 homepages, the 10 cfo.html,
   verdict.html) load it with <script src="vb-api.js?v=3" defer>. The shared
   scripts (site-v2.js, brief-chrome.js, brief-popup.js, news/news.js,
   partner-capture.js, verdict-flow.js) load it on first use with the small
   vbApi() loader they each carry, so the ~1,100 pages that use them need no
   extra tag. After changing this file bump ?v= in all of those places;
   i18n-tools/check_vb_api.py lists them and fails when they disagree.

   i18n-tools/csp_tight.py and stories-build/hubs.mjs read this file (through
   the "/vb-api.js" reference) to keep the Worker in each page's CSP connect-src.

   Plain ES5 like the rest of the site's scripts. */
(function (w) {
  'use strict';
  if (w.VB_API) return;

  var PROD = 'https://virtuse-newsletter.virtuse-ai.workers.dev';
  var STAGING = 'https://virtuse-newsletter-staging.virtuse-ai.workers.dev';
  // staging.virtuse.com and local testing
  var IS_STAGE = location.hostname === 'staging.virtuse.com' || location.hostname === 'localhost';
  // Routes that staging and localhost send to the staging Worker: Verdict open,
  // its paid report (the result id lives in that Worker's store), and
  // WAITLIST_DRY_RUN / SUBSCRIBE_DRY_RUN, so test sign-ups are validated
  // but nothing is stored or e-mailed. /send too (since 2026-11-03, for the
  // Verdict Lite score email): the staging Worker sends it for real, so a
  // staging test reaches the inbox without the production Worker.
  // /pulse.json goes to the production Worker from every host.
  var STAGE_ROUTES = { '/verdict': true, '/verdict/checkout': true, '/verdict/report': true, '/waitlist': true, '/subscribe': true, '/send': true };
  // Requests give up after this long and reject like a network error. The
  // Worker answers /subscribe, /waitlist and /send within a few seconds;
  // /verdict waits for the model (60 s timeout, one retry on the Worker).
  var TIMEOUT_MS = 20000, LONG_TIMEOUT_MS = { '/verdict': 150000 };

  function url(route) {
    return (IS_STAGE && STAGE_ROUTES[route] ? STAGING : PROD) + route;
  }

  // fetch() that aborts after ms. read(res), if given, runs inside the same
  // time limit, so a response whose body stalls also ends. Without
  // AbortController (very old browsers) it is a plain fetch.
  function fetchWithTimeout(resource, init, ms, read) {
    var opts = {}, k, timer;
    for (k in init || {}) opts[k] = init[k];
    if (typeof AbortController === 'function') {
      var ctl = new AbortController();
      opts.signal = ctl.signal;
      timer = setTimeout(function () { ctl.abort(); }, ms);
    }
    var p = fetch(resource, opts);
    if (read) p = p.then(read);
    return p.then(function (v) { clearTimeout(timer); return v; }, function (e) { clearTimeout(timer); throw e; });
  }

  // POST a JSON body to a Worker route. Resolves { ok, status, data } once the
  // JSON answer is read; rejects on a network error, a timeout or a body that
  // is not JSON (callers show their network-error text for all three, as
  // before). body: an object (serialised here) or an already-built string.
  function send(route, body, ms) {
    return fetchWithTimeout(url(route), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }, ms || LONG_TIMEOUT_MS[route] || TIMEOUT_MS, function (res) {
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    });
  }

  // Cloudflare Turnstile, only when the Worker asks for it. The form routes
  // below answer 403 { code: 'captcha', sitekey } when the Worker has the check
  // switched on (cloudflare-worker/src/config.js). Only then does this file load
  // Turnstile from challenges.cloudflare.com, get a token and repeat the request
  // once with it. While the Worker's switch is off, nothing from Turnstile is
  // loaded. The widget shows only if Cloudflare wants the visitor to tick a box.
  // Pages that can run this file allow challenges.cloudflare.com in their CSP
  // script-src and frame-src (i18n-tools/csp_tight.py, stories-build/hubs.mjs).
  var CAPTCHA_ROUTES = { '/subscribe': true, '/send': true, '/waitlist': true };
  var TS_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var TS_KEY = 'vb-ts', TS_WAIT_MS = 60000, tsLoading = null;

  function knownSitekey() { try { return sessionStorage.getItem(TS_KEY) || ''; } catch (e) { return ''; } }
  function loadTurnstile() {
    if (w.turnstile) return Promise.resolve(w.turnstile);
    return tsLoading || (tsLoading = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = TS_SRC; s.async = true;
      s.onload = function () { if (w.turnstile) ok(w.turnstile); else { tsLoading = null; no(new Error('turnstile')); } };
      s.onerror = function () { tsLoading = null; no(new Error('turnstile')); };
      document.head.appendChild(s);
    }));
  }
  // One token for one request. Rejects when Turnstile cannot load, fails or takes too long.
  function captchaToken(sitekey) {
    return loadTurnstile().then(function (ts) {
      return new Promise(function (ok, no) {
        var host = document.createElement('div'), id = null, timer, over = false;
        host.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 24px)';
        document.body.appendChild(host);
        function end(fn, v) {
          if (over) return; over = true; clearTimeout(timer);
          try { if (id !== null) ts.remove(id); } catch (e) {}
          if (host.parentNode) host.parentNode.removeChild(host);
          fn(v);
        }
        timer = setTimeout(function () { end(no, new Error('turnstile timeout')); }, TS_WAIT_MS);
        try {
          id = ts.render(host, {
            sitekey: sitekey, appearance: 'interaction-only', language: (document.documentElement.lang || 'auto').slice(0, 2),
            callback: function (token) { end(ok, token); },
            'error-callback': function () { end(no, new Error('turnstile error')); return true; }
          });
        } catch (e) { end(no, e); }
      });
    });
  }
  function withToken(route, body, ms, sitekey) {
    return captchaToken(sitekey).then(function (token) {
      var o;
      try { o = typeof body === 'string' ? JSON.parse(body) : body; } catch (e) { o = null; }
      if (!o || typeof o !== 'object') return send(route, body, ms);
      var copy = {}, k;
      for (k in o) copy[k] = o[k];
      copy.turnstile = token;
      return send(route, copy, ms);
    }, function () { return send(route, body, ms); });   // no token: the Worker's answer says what is wrong
  }
  function captchaAsk(r) {
    var key = r && r.status === 403 && r.data && r.data.code === 'captcha' && r.data.sitekey;
    return typeof key === 'string' && /^[0-9A-Za-z_-]{10,64}$/.test(key) ? key : '';
  }

  function postJson(route, body, ms) {
    if (!CAPTCHA_ROUTES[route]) return send(route, body, ms);
    // Once the Worker has asked in this tab, later requests bring a token straight away.
    var known = knownSitekey();
    return (known ? withToken(route, body, ms, known) : send(route, body, ms)).then(function (r) {
      var key = captchaAsk(r);
      if (!key) return r;
      try { sessionStorage.setItem(TS_KEY, key); } catch (e) {}
      if (known) return r;                    // a token was sent and refused: show the Worker's answer
      return withToken(route, body, ms, key);
    });
  }

  // Brief signup: POST /subscribe { email, hp, lang } (hp = honeypot). After a
  // successful signup it sets localStorage vb-brief-sub, so brief-popup.js no
  // longer offers the Brief to this browser, whichever form was used.
  var SUB_KEY = 'vb-brief-sub';
  function subscribe(o) {
    return postJson('/subscribe', { email: o.email, hp: o.hp, lang: o.lang }).then(function (r) {
      if (r.ok) try { localStorage.setItem(SUB_KEY, '1'); } catch (e) {}
      return r;
    });
  }

  w.VB_API = { url: url, fetchWithTimeout: fetchWithTimeout, postJson: postJson, subscribe: subscribe, TIMEOUT_MS: TIMEOUT_MS };
})(window);
