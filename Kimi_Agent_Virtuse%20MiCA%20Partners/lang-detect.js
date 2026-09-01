/*
 * Virtuse browser-language auto-redirect.
 *
 * If a visitor's browser reports Slovak as its preferred language and they
 * land on an English page that has a sk/ counterpart, send them straight to
 * the Slovak page. A manual choice via the EN/SK language switcher (any
 * element with class "lang-opt" and a "lang" attribute) is remembered in
 * localStorage and always wins after that — the auto-redirect never fires
 * again for that visitor once they've picked a language themselves.
 *
 * Include as the FIRST <script> in <head>, right after the CSP/referrer
 * meta tags and before the GTM snippet, so the redirect (if any) happens
 * before the page paints. Root pages: <script src="lang-detect.js">.
 * Pages under sk/: <script src="../lang-detect.js">.
 *
 * Update TRANSLATED below whenever a new page gets a sk/ counterpart —
 * this is easy to forget when scaffolding a page (root-cycles.html
 * shipped with sk/+uk/ siblings and sitemap/hreflang entries but wasn't
 * added here until a later pass). See i18n-tools/README.md.
 *
 * Slovak-only for now by design: uk/ also exists, but no decision has
 * been made yet on whether Ukrainian browsers should get the same
 * auto-redirect treatment.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'vtLangPref';

  // Record an explicit language choice made via the EN/SK switcher so we
  // never fight it on a later visit. Delegated listener: works no matter
  // where in the DOM the switcher lives, and needs no per-page wiring.
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('.lang-opt[lang]') : null;
    if (!el) return;
    try { localStorage.setItem(STORAGE_KEY, el.getAttribute('lang')); } catch (err) { /* ignore */ }
  }, true);

  try {
    // An explicit prior choice always wins — no auto-redirect.
    if (localStorage.getItem(STORAGE_KEY)) return;

    var browserLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
    if (browserLang.indexOf('sk') !== 0) return; // not a Slovak-preferring browser

    var path = window.location.pathname;
    if (path.indexOf('/sk/') !== -1) return; // already on the Slovak site

    var TRANSLATED = [
      'index.html', 'about.html', 'buy-bitcoin.html', 'mining.html', 'lending.html',
      'secure.html', 'treasury.html', 'tax.html', 'bots.html', 'research.html',
      'bitcoin-data.html', 'btc-dominance.html', 'ma-200w.html', 'rainbow-chart.html',
      'root-cycles.html', 'retirement-calculator.html', 'faq.html', 'privacy-policy.html',
      'terms-and-conditions.html', 'aml-compliance.html', '404.html'
    ];

    var file = path.split('/').pop();
    var target = null;

    if (file === '' || file === 'index.html') {
      target = 'sk/index.html';
    } else if (file === 'blog.html') {
      target = 'blog-sk.html'; // blog-sk.html lives at root, not under sk/
    } else if (TRANSLATED.indexOf(file) !== -1) {
      target = 'sk/' + file;
    }
    // Anything else (e.g. article.html, an untranslated page) is left alone.

    if (!target) return;

    var dir = path.slice(0, path.length - file.length);
    window.location.replace(dir + target + window.location.search + window.location.hash);
  } catch (err) {
    /* never let this block the page from loading */
  }
})();
