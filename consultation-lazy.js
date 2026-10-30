/*
 * Loads consultation-widget.js (72 KB) only when a visitor is about to use it:
 * on the first hover, focus or touch of a [data-consultation-trigger], and opens
 * the widget on click. Until then it costs nothing on page load.
 *
 * Also defines a stand-in window.VirtuseConsultation, so code that opens the widget
 * directly (verdict-flow.js) still works; the real widget replaces it when it loads.
 * Bump WIDGET's ?v= together with any change to consultation-widget.js.
 */
(function () {
  if (window.VirtuseConsultation) return;
  var WIDGET = 'consultation-widget.js?v=20261030';
  var me = document.currentScript;
  var src = me && me.src ? me.src.replace(/consultation-lazy\.js[^#]*$/, WIDGET) : '/' + WIDGET;
  var p = null, ready = false;

  function load() {
    return p || (p = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { ready = true; ok(); };
      s.onerror = function () { p = null; fail(); };
      document.head.appendChild(s);
    }));
  }
  function trigger(e) { return e.target && e.target.closest ? e.target.closest('[data-consultation-trigger]') : null; }

  ['pointerover', 'focusin', 'touchstart'].forEach(function (t) {
    document.addEventListener(t, function (e) { if (trigger(e)) load(); }, { passive: true });
  });
  document.addEventListener('click', function (e) {
    var b = trigger(e);
    if (!b || ready) return; // once loaded, the widget's own click handlers take over
    e.preventDefault();
    load().then(function () {
      b.focus();
      window.VirtuseConsultation.open(b.getAttribute('data-consultation-lang') || document.documentElement.lang || 'en');
    });
  });

  window.VirtuseConsultation = {
    open: function (lang) {
      var from = document.activeElement;
      load().then(function () {
        if (from && from.focus) from.focus();
        window.VirtuseConsultation.open(lang);
      });
    },
    close: function () {}
  };
})();
