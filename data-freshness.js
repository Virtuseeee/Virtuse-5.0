/* data-freshness.js: one visible line above data that is older than it should be.
   audits/data-freshness-2026-11-26.md (bod 2a). Load it before the page code that
   renders the data; every call is guarded with `window.VBFresh &&`.

   VBFresh.show(anchor, asOf, opts)
     anchor  element the note is placed before (once; later calls update or remove it);
             with compact the note is an inline span placed right after it instead
     asOf    "YYYY-MM-DD..." of the data shown; missing or unreadable = note too
     opts    { days: threshold in days (default VBFresh.DAYS), lang: page language
               (default <html lang>), compact: true for embeds on other sites: no new block, so
               the iframe keeps its layout }
     returns true when the note is shown

   Today is the calendar day in Europe/Bratislava (as news.js), not the browser's
   own zone. Only EN and SK have the text; other languages show nothing yet.
   Test hook (staging and localhost only): ?fresh_shift=5 moves "today" 5 days ahead. */
(function () {
  'use strict';
  var DAYS = 3; // daily files; the cron also runs on weekends
  var T = {
    en: {
      old: 'These figures are from {date}. The daily update has not arrived, so the numbers may be out of date.',
      none: 'These figures have no date. The daily update may not have arrived, so the numbers may be out of date.',
      locale: 'en-GB'
    },
    sk: {
      old: 'Tieto údaje sú z {date}. Denná aktualizácia neprišla, preto čísla nemusia byť aktuálne.',
      none: 'Pri týchto údajoch chýba dátum. Denná aktualizácia možno neprišla, preto čísla nemusia byť aktuálne.',
      locale: 'sk-SK'
    }
  };

  function shift() {
    var h = location.hostname;
    if (h !== 'staging.virtuse.com' && h !== 'localhost' && h !== '127.0.0.1') return 0;
    var m = /[?&]fresh_shift=(-?\d{1,3})/.exec(location.search);
    return m ? parseInt(m[1], 10) : 0;
  }
  function today() {
    var t = Date.now() + shift() * 864e5;
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
    } catch (e) {
      return new Date(t).toISOString().slice(0, 10);
    }
  }
  function day(v) {
    var s = typeof v === 'string' ? v.slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && isFinite(Date.parse(s + 'T00:00:00Z')) ? s : null;
  }
  function ageDays(asOf) {
    var d = day(asOf);
    return d === null ? null : Math.round((Date.parse(today() + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 864e5);
  }
  function fmt(d, locale) {
    return new Date(d + 'T00:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  var styled = false;
  function style() {
    if (styled) return;
    styled = true;
    var s = document.createElement('style');
    s.textContent =
      '.vb-fresh{display:block;box-sizing:border-box;max-width:100%;margin:0 0 14px;padding:10px 14px;' +
      'border:1px solid rgba(247,147,26,.55);border-radius:8px;background:rgba(247,147,26,.10);' +
      'color:inherit;font-size:14px;line-height:1.45;font-weight:500;text-align:left}' +
      'span.vb-fresh{display:inline;margin:0 0 0 6px;padding:1px 6px;border-radius:4px;font-size:inherit;line-height:inherit;font-weight:600;-webkit-box-decoration-break:clone;box-decoration-break:clone}';
    document.head.appendChild(s);
  }

  function show(anchor, asOf, opts) {
    if (!anchor || !anchor.parentNode) return false;
    opts = opts || {};
    var lang = String(opts.lang || document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    var tx = T[lang];
    var compact = !!opts.compact;
    var prev = compact ? anchor.nextElementSibling : anchor.previousElementSibling;
    if (prev && !prev.classList.contains('vb-fresh')) prev = null;
    var age = ageDays(asOf);
    var limit = typeof opts.days === 'number' ? opts.days : DAYS;
    var stale = age === null || age > limit;
    if (!tx || !stale) {
      if (prev) prev.parentNode.removeChild(prev);
      return false;
    }
    style();
    var p = prev || document.createElement(compact ? 'span' : 'p');
    p.className = 'vb-fresh';
    p.setAttribute('role', 'status');
    p.textContent = age === null ? tx.none : tx.old.replace('{date}', fmt(day(asOf), tx.locale));
    if (!prev) anchor.parentNode.insertBefore(p, compact ? anchor.nextSibling : anchor);
    return true;
  }

  window.VBFresh = { DAYS: DAYS, show: show, ageDays: ageDays, today: today };
})();
