/*
 * Virtuse Bitcoin Concierge — sticky launcher (sitewide).
 *
 * A small floating bubble, bottom-right, on every EN top-level page.
 * Clicking it opens the Concierge (concierge.html) in an embedded
 * overlay panel via <iframe> — full screen on mobile, a fixed-size
 * panel (~620px tall) on desktop.
 *
 * Perf: this script is meant to be loaded with `defer`. It only ever
 * builds the (cheap) bubble button eagerly; the iframe itself — the
 * only network-heavy part — is created lazily, on first click, so the
 * launcher adds no extra request and no render-blocking work to the
 * host page's load.
 *
 * CSS: all rules are injected here (not a separate stylesheet, to
 * keep this a single extra <script> tag per page, matching the
 * lang-detect.js pattern) and every class/id is prefixed `vc-` to
 * avoid colliding with a page's own styles or the legacy AngularJS
 * bundle on the homepage.
 *
 * Include as a deferred script near the end of <body> (or in <head>
 * with `defer`) on every top-level EN page:
 *   <script src="concierge-launcher.js" defer></script>
 * Pages under sk//uk//cs/ are out of scope for this MVP rollout — see
 * CLAUDE.md's Concierge session notes.
 */
(function () {
  'use strict';

  function init() {
    injectStyles();
    var bubble = buildBubble();
    document.body.appendChild(bubble);

    var overlay = null; // built lazily on first open

    bubble.addEventListener('click', function () {
      if (!overlay) overlay = buildOverlay();
      if (!overlay.isConnected) document.body.appendChild(overlay);
      openOverlay(overlay);
    });
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.id = 'vc-launcher-styles';
    style.textContent = [
      '.vc-bubble{position:fixed;right:20px;bottom:20px;z-index:99998;',
      'display:flex;align-items:center;gap:10px;cursor:pointer;',
      'background:#17171a;border:1px solid rgba(255,255,255,0.1);',
      'border-radius:999px;padding:10px 10px 10px 10px;',
      'box-shadow:0 8px 28px rgba(0,0,0,0.35);',
      'font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
      'transition:transform .15s ease,box-shadow .15s ease;}',
      '.vc-bubble:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(0,0,0,0.45);}',
      '.vc-bubble-icon{flex:none;width:44px;height:44px;border-radius:50%;',
      'background:#f7931a;color:#0b0b0c;display:flex;align-items:center;',
      'justify-content:center;font-weight:800;font-size:20px;line-height:1;}',
      '.vc-bubble-copy{display:none;flex-direction:column;padding-right:6px;',
      'max-width:210px;}',
      '.vc-bubble:hover .vc-bubble-copy,.vc-bubble:focus-visible .vc-bubble-copy{display:flex;}',
      '.vc-bubble-title{font-size:12.5px;font-weight:700;color:#f2f2f3;',
      'line-height:1.3;}',
      '.vc-bubble-sub{font-size:10.5px;color:#8b949e;line-height:1.3;margin-top:2px;}',
      '@media (max-width:520px){.vc-bubble{right:14px;bottom:14px;}',
      '.vc-bubble-copy{display:none !important;}}',
      '.vc-overlay{position:fixed;inset:0;z-index:99999;display:none;',
      'align-items:flex-end;justify-content:flex-end;',
      'background:rgba(6,6,7,0.55);padding:24px;}',
      '.vc-overlay.vc-open{display:flex;}',
      '.vc-panel{position:relative;width:420px;max-width:100%;height:620px;',
      'max-height:calc(100vh - 48px);border-radius:18px;overflow:hidden;',
      'background:#0b0b0c;border:1px solid rgba(255,255,255,0.12);',
      'box-shadow:0 24px 64px rgba(0,0,0,0.5);}',
      '.vc-panel iframe{width:100%;height:100%;border:0;display:block;}',
      '.vc-close{position:absolute;top:10px;right:10px;z-index:1;width:32px;',
      'height:32px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);',
      'background:rgba(11,11,12,0.75);color:#e6edf3;font-size:16px;',
      'line-height:1;cursor:pointer;display:flex;align-items:center;',
      'justify-content:center;}',
      '.vc-close:hover{background:rgba(255,255,255,0.12);}',
      '@media (max-width:640px){.vc-overlay{padding:0;align-items:stretch;',
      'justify-content:stretch;}',
      '.vc-panel{width:100%;height:100%;max-height:none;border-radius:0;',
      'border:0;}}',
    ].join('');
    document.head.appendChild(style);
  }

  function buildBubble() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vc-bubble';
    btn.setAttribute('aria-label', 'Open Bitcoin Concierge — which Bitcoin service is right for me?');
    btn.innerHTML =
      '<span class="vc-bubble-icon">₿</span>' +
      '<span class="vc-bubble-copy">' +
      '<span class="vc-bubble-title">Which Bitcoin service is right for me?</span>' +
      '<span class="vc-bubble-sub">Free · No sign-up · We never hold your keys</span>' +
      '</span>';
    return btn;
  }

  function buildOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'vc-overlay';
    overlay.id = 'vc-overlay';

    var panel = document.createElement('div');
    panel.className = 'vc-panel';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'vc-close';
    close.setAttribute('aria-label', 'Close Bitcoin Concierge');
    close.innerHTML = '✕';
    close.addEventListener('click', function () {
      closeOverlay(overlay);
    });

    var iframe = document.createElement('iframe');
    iframe.src = resolveConciergeUrl() + '?utm_source=concierge&utm_medium=launcher';
    iframe.title = 'Virtuse Bitcoin Concierge';
    iframe.loading = 'lazy';

    panel.appendChild(close);
    panel.appendChild(iframe);
    overlay.appendChild(panel);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOverlay(overlay);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('vc-open')) closeOverlay(overlay);
    });

    return overlay;
  }

  function resolveConciergeUrl() {
    // Root-level pages -> concierge.html next to them. Any page nested
    // one level deep (mining_deploy/, buybitcoin/, hero/ deploy
    // variants) would need '../concierge.html' — out of scope for this
    // MVP rollout (top-level EN pages only), so a single relative path
    // is correct here.
    return 'concierge.html';
  }

  function openOverlay(overlay) {
    overlay.classList.add('vc-open');
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('vc-open');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
