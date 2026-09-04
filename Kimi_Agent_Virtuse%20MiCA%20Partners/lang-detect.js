/*
 * Virtuse browser-language auto-redirect.
 *
 * If a visitor's browser reports Slovak, Ukrainian, Czech, or Russian as
 * its preferred language and they land on an English page that has a
 * matching translated counterpart, send them straight to that page. A
 * manual choice via the language switcher (any element with class
 * "lang-opt" and a "lang" attribute) is remembered in localStorage and
 * always wins after that — the auto-redirect never fires again for that
 * visitor once they've picked a language themselves.
 *
 * Include as the FIRST <script> in <head>, right after the CSP/referrer
 * meta tags and before the GTM snippet, so the redirect (if any) happens
 * before the page paints. Root pages: <script src="lang-detect.js">.
 * Pages under sk//uk//cs//ru/: <script src="../lang-detect.js">.
 *
 * Update TRANSLATED below whenever a new page gets a translated
 * counterpart in ANY of the four languages — this is easy to forget when
 * scaffolding a page (root-cycles.html shipped with sk/+uk/ siblings and
 * sitemap/hreflang entries but wasn't added here until a later pass). See
 * i18n-tools/README.md.
 *
 * Russian rollout targets EU-resident Russian speakers specifically, not
 * the Russian Federation market -- doesn't change any redirect logic
 * here, browser locale 'ru' is 'ru' regardless of the visitor's country.
 *
 * blog.html is a special case, handled separately per language below:
 * sk -> blog-sk.html (root-level, suffix pattern), uk -> uk/blog.html,
 * ru -> ru/blog.html (both UI-only shells over the English WP feed);
 * cs -> no cs/blog.html exists yet, so Czech browsers landing on
 * blog.html are left alone.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'vtLangPref';

  // Record an explicit language choice made via the language switcher so we
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
    var targetLang = null;
    if (browserLang.indexOf('sk') === 0) targetLang = 'sk';
    else if (browserLang.indexOf('uk') === 0) targetLang = 'uk';
    else if (browserLang.indexOf('cs') === 0) targetLang = 'cs';
    else if (browserLang.indexOf('ru') === 0) targetLang = 'ru';
    if (!targetLang) return; // not a Slovak/Ukrainian/Czech/Russian-preferring browser

    var path = window.location.pathname;
    // Already on any translated section? No-op regardless of which one.
    if (path.indexOf('/sk/') !== -1 || path.indexOf('/uk/') !== -1 || path.indexOf('/cs/') !== -1 || path.indexOf('/ru/') !== -1) return;

    var TRANSLATED = [
      'index.html', 'about.html', 'buy-bitcoin.html', 'mining.html', 'lending.html',
      'secure.html', 'treasury.html', 'tax.html', 'bots.html', 'research.html',
      'bitcoin-data.html', 'btc-dominance.html', 'ma-200w.html', 'rainbow-chart.html',
      'root-cycles.html', 'retirement-calculator.html', 'faq.html', 'privacy-policy.html',
      'terms-and-conditions.html', 'aml-compliance.html', '404.html'
    ];

    var file = path.split('/').pop();
    var target = null;

    if (file === 'blog.html') {
      if (targetLang === 'sk') target = 'blog-sk.html'; // lives at root, not under sk/
      else if (targetLang === 'uk') target = 'uk/blog.html';
      else if (targetLang === 'ru') target = 'ru/blog.html';
      // cs: no cs/blog.html yet — target stays null, page is left alone.
    } else if (file === '' || file === 'index.html' || TRANSLATED.indexOf(file) !== -1) {
      var name = (file === '' ? 'index.html' : file);
      target = targetLang + '/' + name;
    }
    // Anything else (e.g. article.html, an untranslated page) is left alone.

    if (!target) return;

    var dir = path.slice(0, path.length - file.length);
    window.location.replace(dir + target + window.location.search + window.location.hash);
  } catch (err) {
    /* never let this block the page from loading */
  }
})();
