/* Virtuse logo loader: plays the 3D V-mark intro (2 s) over the page once per
   browser session, then fades out. Load it synchronously in <head>, right after
   the theme script, so the cover is painted before any content:
     <script src="brand/logo-loader.js"></script>
   Never shown with prefers-reduced-motion, with ?noloader, or a second time in
   the same tab session (?loader=1 forces it for testing). Any click, key, wheel
   or touch skips it; if the video cannot start within 900 ms (slow network,
   autoplay blocked, no codec) the page is revealed immediately. */
(function () {
  var d = document, h = d.documentElement, q = location.search;
  var KEY = 'vb-logo-loader';
  try {
    if (/[?&]noloader\b/.test(q)) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var forced = /[?&]loader=1\b/.test(q);
    if (!forced && sessionStorage.getItem(KEY) === '1') return;
    sessionStorage.setItem(KEY, '1');
  } catch (e) { return; }

  var me = d.currentScript;
  var base = me && me.src ? me.src.replace(/[^\/]*(\?.*)?$/, '') : 'brand/';
  var light = h.getAttribute('data-theme') === 'light';
  var bg = light ? '#FBFBFA' : '#08090a';
  var name = 'virtuse-logo-loader-' + (light ? 'light' : 'dark');

  var st = d.createElement('style');
  st.textContent =
    'html.vb-ll{overflow:hidden}' +
    'html.vb-ll::after{content:"";position:fixed;inset:0;z-index:2147483646;background:' + bg + '}' +
    '.vb-ll-ov{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:' + bg + ';opacity:1;transition:opacity .45s ease;cursor:pointer}' +
    '.vb-ll-ov.out{opacity:0;pointer-events:none}' +
    // The video is rendered on pure black (dark) / pure white (light) and blended
    // with screen / multiply, so its own background disappears into the page
    // colour whatever the decoder does to near-black or near-white.
    '.vb-ll-ov video{display:block;width:min(60vw,280px);height:auto;aspect-ratio:1/1;mix-blend-mode:' + (light ? 'multiply' : 'screen') + ';' +
    '-webkit-mask-image:radial-gradient(closest-side,#000 64%,transparent 100%);mask-image:radial-gradient(closest-side,#000 64%,transparent 100%)}';
  (d.head || h).appendChild(st);
  h.classList.add('vb-ll');

  var done = false, ov = null, startTimer = null, maxTimer = null;
  function finish() {
    if (done) return; done = true;
    clearTimeout(startTimer); clearTimeout(maxTimer);
    ['click', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.removeEventListener(t, finish, true); });
    h.classList.remove('vb-ll');
    if (!ov) return;
    ov.classList.add('out');
    setTimeout(function () { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 500);
  }
  ['click', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { window.addEventListener(t, finish, true); });
  maxTimer = setTimeout(finish, 3600);

  function mount() {
    if (done) return;
    ov = d.createElement('div');
    ov.className = 'vb-ll-ov';
    ov.setAttribute('aria-hidden', 'true');
    var v = d.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('disablepictureinpicture', '');
    var last = null;
    [['mp4', 'video/mp4'], ['webm', 'video/webm']].forEach(function (s) {
      var src = d.createElement('source'); src.src = base + name + '.' + s[0]; src.type = s[1]; v.appendChild(src); last = src;
    });
    // Only give up when the last candidate fails; an unsupported mp4 fires
    // 'error' on its <source> before the browser tries the webm.
    last.addEventListener('error', finish);
    v.addEventListener('error', finish);
    v.addEventListener('ended', finish);
    v.addEventListener('playing', function () { clearTimeout(startTimer); });
    startTimer = setTimeout(finish, 900);
    ov.appendChild(v);
    d.body.appendChild(ov);
    var p = v.play && v.play();
    if (p && p.catch) p.catch(finish);
  }
  if (d.body) mount(); else d.addEventListener('DOMContentLoaded', mount);
})();
