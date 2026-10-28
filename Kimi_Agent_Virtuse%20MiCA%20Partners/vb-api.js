/* The site's one client for the newsletter Worker (cloudflare-worker/).
   The only file that names the Worker's URL: every form that posts to it
   (Brief signups, CFO / Verdict waitlist, partner checklist, Verdict) goes
   through window.VB_API.

   Loading: pages with inline form code (the 10 homepages, the 10 cfo.html,
   verdict.html) load it with <script src="vb-api.js?v=1" defer>. The shared
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
  // Routes that staging and localhost send to the staging Worker (Verdict open,
  // WAITLIST_DRY_RUN: nothing stored or sent). Every other route, /subscribe
  // included, goes to the production Worker from every host.
  var STAGE_ROUTES = { '/verdict': true, '/waitlist': true };
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
  function postJson(route, body, ms) {
    return fetchWithTimeout(url(route), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    }, ms || LONG_TIMEOUT_MS[route] || TIMEOUT_MS, function (res) {
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    });
  }

  // Brief signup: POST /subscribe { email, hp, lang } (hp = honeypot).
  function subscribe(o) {
    return postJson('/subscribe', { email: o.email, hp: o.hp, lang: o.lang });
  }

  w.VB_API = { url: url, fetchWithTimeout: fetchWithTimeout, postJson: postJson, subscribe: subscribe, TIMEOUT_MS: TIMEOUT_MS };
})(window);
