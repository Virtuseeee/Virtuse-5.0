/* Animated Verdict sample card (Anna 75/100) for the homepage #verdict panel.
   Same markup, copy and timing as the verdict.html hero card (verdict-lite.js), without any of the funnel logic.
   Runs only while on screen; prefers-reduced-motion shows the finished card. */
(function () {
  var el = document.getElementById('mlDemo');
  if (!el) return;
  var COPY = {
    en: { top: 'VERDICT REPORT · SAMPLE', title: 'Anna’s Bitcoin plan check', meta: '41 · Slovakia · first purchase · own keys', scale: ['Basics missing', 'A few gaps', 'Basics in place'], pill: 'B · Basics in place', nums: [['Planned', '€20,000 · 13%'], ['After a 70% fall', '€6,000 left'], ['Monthly', '€200'], ['Cash reserve', '3 to 6 months']], areas: ['Size', 'Reserve', 'Debts', 'Tax', 'Custody', 'Behaviour'] },
    sk: { top: 'VERDICT REPORT · VZOR', title: 'Plán Bitcoinu: Anna', meta: '41 · Slovensko · prvý nákup · vlastné kľúče', scale: ['Chýbajú základy', 'Pár medzier', 'Základy máte'], pill: 'B · Základy máte', nums: [['Plánuje', '20 000 € · 13 %'], ['Po poklese o 70 %', 'zostane 6 000 €'], ['Mesačne', '200 €'], ['Rezerva', '3 až 6 mesiacov']], areas: ['Veľkosť', 'Rezerva', 'Dlhy', 'Dane', 'Úschova', 'Správanie'] }
  };
  var D = COPY[document.documentElement.lang] || COPY.en;
  el.innerHTML = '<div class="dm-top"><span>' + D.top + '</span><span class="dm-dots"><i></i><i></i><i></i><i></i></span></div>' +
    '<div class="dm-st"><b class="dm-t">' + D.title + '</b><span class="dm-meta">' + D.meta + '</span></div>' +
    '<div class="dm-st dm-score"><div class="dm-n"><b>75</b><small>/100</small></div><div class="dm-scale"><div class="dm-lbl"><span>' + D.scale[0] + '</span><span>' + D.scale[1] + '</span><span>' + D.scale[2] + '</span></div><div class="dm-track"><i></i></div><span class="dm-pill">' + D.pill + '</span></div></div>' +
    '<div class="dm-st dm-nums">' + D.nums.map(function (x) { return '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div>' +
    '<div class="dm-st dm-areas">' + [7, 7, 10, 6, 6, 10].map(function (v, i) { return '<div class="' + (v <= 6 ? 'lo' : '') + '"><span>' + D.areas[i] + '</span><i><em style="--w:' + v * 10 + '%"></em></i><b>' + v + '</b></div>'; }).join('') + '</div>';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { el.classList.add('all'); return; }

  var st = el.querySelectorAll('.dm-st'), dots = el.querySelectorAll('.dm-dots i'), n = el.querySelector('.dm-n b');
  var timers = [], visible = false;
  function clear() { timers.forEach(clearTimeout); timers = []; }
  function loop() {
    clear();
    st.forEach(function (x) { x.classList.remove('on'); });
    dots.forEach(function (x) { x.classList.remove('on'); });
    st.forEach(function (x, k) {
      timers.push(setTimeout(function () {
        x.classList.add('on');
        if (dots[k]) dots[k].classList.add('on');
        if (x.classList.contains('dm-score')) {
          var t0 = performance.now();
          (function f(now) { var q = Math.min(1, (now - t0) / 1100); n.textContent = Math.round(75 * (1 - Math.pow(1 - q, 3))); if (q < 1) requestAnimationFrame(f); })(t0);
        }
      }, 250 + k * 750));
    });
    timers.push(setTimeout(function () { if (visible) loop(); }, 250 + st.length * 750 + 4500));
  }
  new IntersectionObserver(function (entries) {
    var now = entries[entries.length - 1].isIntersecting;
    if (now && !visible) { visible = true; loop(); }
    else if (!now && visible) { visible = false; clear(); st.forEach(function (x) { x.classList.add('on'); }); dots.forEach(function (x) { x.classList.add('on'); }); n.textContent = '75'; }
  }, { threshold: 0.25 }).observe(el);
})();
