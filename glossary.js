/* Bitcoin glossary: search (ignores case and diacritics), topic filter, A–Z, ?q= and #anchor.
   Without JS every term stays visible. Built pages: seo-build/glossary.mjs. */
(function () {
  var tools = document.getElementById('glTools');
  if (!tools) return;
  var q = document.getElementById('glQ');
  var count = document.getElementById('glCount');
  var empty = document.getElementById('glEmpty');
  var chips = [].slice.call(tools.querySelectorAll('.gl-chip'));
  var terms = [].slice.call(document.querySelectorAll('.gl-term'));
  var groups = [].slice.call(document.querySelectorAll('.gl-group'));
  var az = [].slice.call(tools.querySelectorAll('.gl-az a'));
  var cat = '';
  function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var hay = terms.map(function (t) { return fold(t.textContent + ' ' + (t.getAttribute('data-k') || '')); });

  q.closest('label').hidden = false;
  tools.querySelector('.gl-chips').hidden = false;
  count.hidden = false;

  function apply(push) {
    var words = fold(q.value.trim()).split(/\s+/).filter(Boolean);
    var shown = 0;
    terms.forEach(function (t, i) {
      var ok = (!cat || t.getAttribute('data-cat') === cat) && words.every(function (w) { return hay[i].indexOf(w) >= 0; });
      t.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(function (g) {
      var any = g.querySelector('.gl-term:not([hidden])');
      g.hidden = !any;
    });
    az.forEach(function (a) {
      var g = document.getElementById(a.getAttribute('href').slice(1));
      a.classList.toggle('off', !g || g.hidden);
    });
    count.textContent = shown === 1 ? count.getAttribute('data-one') : count.getAttribute('data-many').replace('{n}', shown);
    empty.hidden = shown > 0;
    if (push) {
      var u = new URL(location.href);
      if (q.value.trim()) u.searchParams.set('q', q.value.trim()); else u.searchParams.delete('q');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      cat = c.getAttribute('data-cat');
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      apply(false);
    });
  });
  var timer;
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { apply(true); }, 120); });

  // #anchor: highlight the term and make sure no filter hides it.
  function focusHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var t = id && document.getElementById(id);
    if (!t || !t.classList.contains('gl-term')) return;
    if (t.hidden) { q.value = ''; cat = ''; chips.forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-cat') === '' ? 'true' : 'false'); }); apply(true); }
    terms.forEach(function (x) { x.classList.remove('gl-hit'); });
    t.classList.add('gl-hit');
    t.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('hashchange', focusHash);

  // "#" next to each term copies its link.
  var toast;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.gl-anchor');
    if (!a || !navigator.clipboard) return;
    var url = location.origin + location.pathname + a.getAttribute('href');
    navigator.clipboard.writeText(url).then(function () {
      if (!toast) { toast = document.createElement('div'); toast.className = 'gl-toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
      toast.textContent = count.getAttribute('data-copied');
      toast.hidden = false;
      clearTimeout(toast.t); toast.t = setTimeout(function () { toast.hidden = true; }, 1600);
    }, function () {});
  });

  var start = new URLSearchParams(location.search).get('q');
  if (start) q.value = start;
  apply(false);
  if (location.hash) focusHash();
})();
