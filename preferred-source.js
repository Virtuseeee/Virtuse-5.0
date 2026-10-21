/* Google Search "preferred source" button (Top Stories, AI Mode, AI Overviews).
 * https://developers.google.com/search/docs/appearance/preferred-sources
 *
 * Markup: <div class="vb-pref" data-pref-source data-pref-themes="dark light">
 *           <a data-pref-link href="https://www.google.com/preferences/source?q=virtuse.com" ...>…</a>
 *         </div>
 *
 * Without analytics consent only the deeplink shows and no Google script loads.
 * With consent (stored vb-consent with a:true, or the vb:consent event that
 * cookie-consent.js fires when the visitor chooses) the Google button is added
 * and news.google.com/swg/js/v1/publisher.js loads once; the link hides as soon
 * as the button has rendered (it stays if the script is blocked).
 * publisher.js only renders buttons that exist when it loads, so pages with a
 * light/dark switch get one button per theme in data-pref-themes, and CSS shows
 * the one that matches html[data-theme].
 * Clicks push dataLayer {event: 'preferred_source_click', link_type: 'button' |
 * 'deeplink', page_lang}; GA4 gets it only through a GTM tag (consent applies).
 */
(function () {
  'use strict';
  var SRC = 'https://news.google.com/swg/js/v1/publisher.js';
  var boxes = [].slice.call(document.querySelectorAll('[data-pref-source]'));
  if (!boxes.length) return;
  var html = document.documentElement;
  var lang = (html.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();

  var css = document.createElement('style');
  css.textContent =
    '.vb-pref.vb-pref-on [data-pref-link]{display:none}' +
    'html[data-theme="light"] .vb-pref-btn[data-theme="dark"],' +
    'html:not([data-theme="light"]) .vb-pref-btn[data-theme="light"]{display:none!important}';
  document.head.appendChild(css);

  boxes.forEach(function (box) {
    box.addEventListener('click', function (e) {
      var t = e.target;
      var type = t.closest('[data-pref-link]') ? 'deeplink' : t.closest('.vb-pref-btn') ? 'button' : '';
      if (type) (window.dataLayer = window.dataLayer || []).push({ event: 'preferred_source_click', link_type: type, page_lang: lang });
    });
  });

  function consented() {
    try {
      var c = JSON.parse(localStorage.getItem('vb-consent'));
      return !!(c && c.v === 1 && Date.now() - c.t < 31536000000 && c.a);
    } catch (e) { return false; }
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    boxes.forEach(function (box) {
      var themes = (box.getAttribute('data-pref-themes') || html.getAttribute('data-theme') || 'dark').split(/\s+/);
      themes.forEach(function (th) {
        var b = document.createElement('div');
        b.className = 'vb-pref-btn';
        b.setAttribute('google-add-preferred-source-btn', '');
        b.setAttribute('data-theme', th === 'light' ? 'light' : 'dark');
        b.setAttribute('data-lang', lang);
        box.insertBefore(b, box.firstChild);
        new MutationObserver(function (m, obs) {
          if (b.getAttribute('data-initialized') === 'true') { box.classList.add('vb-pref-on'); obs.disconnect(); }
        }).observe(b, { attributes: true, attributeFilter: ['data-initialized'] });
      });
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = SRC;
    document.head.appendChild(s);
  }

  if (consented()) start();
  else document.addEventListener('vb:consent', function (e) { if (e.detail && e.detail.analytics) start(); });
})();
