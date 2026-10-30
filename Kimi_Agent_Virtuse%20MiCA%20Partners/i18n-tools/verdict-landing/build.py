# -*- coding: utf-8 -*-
"""Verdict landing (approved mockup 2026-10-27) on <lang>/verdict.html.

The landing sits above the Verdict funnel on the same page. The page has two
states: the landing, and the funnel (#start, html.vl-app). Deep links that
hand over a plan, ?flow=1, ?report=1 and a reload during a run open the
funnel directly, so result and PDF links keep working.

Usage (from the site folder): python3 i18n-tools/verdict-landing/build.py
Rebuilds verdict-landing.css and both pages; idempotent (markers VL:START/END)."""
import json, os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import signals as SG
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.path.join(HERE, '..', '..'))
V = '20261028a'

LANGS = {
  'en': {'page': 'verdict.html', 'cfo': 'cfo.html',
         'title': 'Verdict: empower investors to make smart decisions | Virtuse',
         'desc': 'Verdict scores how complete your Bitcoin plan is on 10 signals, names the weakest point and gives one next step. Free. Not investment advice.',
         'pricing_eyebrow': 'Pricing', 'pricing_h2': 'Three levels. <span>Start with a free Verdict.</span>',
         'cta': 'Get your free Verdict', 'back': '← About Verdict', 'free_items': ['Score 0–100 and band', 'Executive summary', 'The bottleneck: the signal that decides the score', 'What holds / what breaks, assumptions (headline)', 'Next steps, with the tool to check them'],
         'report_items': ['All 10 signals with scores and reasons', 'Type 1 vs Type 2: reversible or not?', "Regret minimizer: what you'd wish you knew", 'Risks &amp; Plan B', 'What holds / what breaks and assumptions in full', 'Next steps with owner and deadline', 'A PDF to keep, no subscription']},
  'sk': {'page': 'sk/verdict.html', 'cfo': 'sk/cfo.html',
         'title': 'Verdict: pomáhame investorom robiť múdre rozhodnutia | Virtuse',
         'desc': 'Verdict ohodnotí úplnosť vášho bitcoinového plánu na 10 signáloch, pomenuje najslabšie miesto a dá jeden ďalší krok. Zadarmo. Nie je to investičné poradenstvo.',
         'pricing_eyebrow': 'Ceny', 'pricing_h2': 'Tri úrovne. <span>Začnite bezplatným verdiktom.</span>',
         'cta': 'Získať verdikt zadarmo', 'back': '← O Verdicte', 'free_items': ['Skóre 0–100 a pásmo', 'Zhrnutie', 'Úzke miesto: signál, ktorý rozhoduje o skóre', 'Čo drží / čo sa zlomí, predpoklady (hlavná veta)', 'Ďalšie kroky s nástrojom na overenie'],
         'report_items': ['Všetkých 10 signálov so skóre a dôvodmi', 'Typ 1 vs. Typ 2: vratné, alebo nie?', 'Minimalizácia ľútosti: čo by ste chceli vedieť', 'Riziká a plán B', 'Čo drží / čo sa zlomí a predpoklady celé', 'Ďalšie kroky s tým, kto a dokedy', 'PDF na uloženie, bez predplatného']},
}

def esc(s): return s.replace('&', '&amp;').replace('"', '&quot;')

def pricing(lang, cfg):
    s = open(os.path.join(SITE, cfg['cfo']), encoding='utf8').read()
    a = s.index('<section id="pricing">'); b = s.index('</section>', a) + len('</section>')
    p = s[a:b]
    p = p.replace('<div class="sec-head">', '<div class="sec-head"><div class="eyebrow orange"><i></i>' + cfg['pricing_eyebrow'] + '</div>', 1)
    p = re.sub(r'<h2>.*?</h2>', '<h2>' + cfg['pricing_h2'] + '</h2>', p, count=1, flags=re.S)
    # cfo_split.py already points both plan buttons at the Verdict page; here they open the funnel
    p, n1 = re.subn(r'href="(?:/)?verdict\.html"', 'href="#start" data-vl-start', p)
    p, n3 = re.subn(r'\s*<button class="btn btn-primary only-audit"[^>]*>[^<]*</button>', '', p)
    assert (n1, n3) == (2, 1), (lang, n1, n3)
    # The Report panel is gone (Ras 2026-10-28): its parts are the plan lists here
    uls = list(re.finditer(r'<ul>.*?</ul>', p, flags=re.S)); assert len(uls) >= 2, lang
    for m, items in reversed(list(zip(uls[:2], (cfg['free_items'], cfg['report_items'])))):
        p = p[:m.start()] + '<ul>' + ''.join('<li>' + x + '</li>' for x in items) + '</ul>' + p[m.end():]
    return p

def landing(lang, cfg):
    t = open(os.path.join(HERE, 'landing.en.html'), encoding='utf8').read()
    if lang != 'en':
        d = json.load(open(os.path.join(HERE, lang + '.json'), encoding='utf8'))
        for k in sorted(d, key=len, reverse=True):
            assert k in t, (lang, 'missing', k[:80])
            t = t.replace(k, d[k])
    t = t.replace('<!--HEROBARS-->', SG.hero_bars()).replace('<!--RADAR-->', SG.radar(lang)).replace('<!--GROUPS-->', SG.groups(lang))
    return t.replace('<!--PRICING-->', pricing(lang, cfg))

SCRIPT = '''<script>
/* Verdict landing: hero sample animation, billing switch, CFO waitlist, landing <-> funnel. */
(function () {
  var root = document.documentElement, KEY = 'vb-vl-app';
  function app(on) { root.classList.toggle('vl-app', on); try { on ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY); } catch (e) {} }
  document.querySelectorAll('[data-vl-start]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); app(true); history.replaceState(null, '', '#start'); if (window.vfSkipIntro) window.vfSkipIntro(); window.scrollTo(0, 0); var t = document.querySelector('#start textarea'); if (t) t.focus({ preventScroll: true }); });
  });
  var ask = document.getElementById('vlAsk');
  if (ask) {
    var askTa = ask.elements.text, askMsg = document.getElementById('vlMsg');
    askTa.addEventListener('input', function () { if (askTa.value.trim().length >= 20) askMsg.textContent = ''; });
    ask.addEventListener('submit', function (e) {
      e.preventDefault(); if (ask.elements.website.value) return;
      var text = askTa.value.trim();
      if (text.length < 20) { askMsg.textContent = askMsg.dataset.short; askTa.focus(); return; }
      app(true); history.replaceState(null, '', '#start');
      if (window.vfStartWithText) window.vfStartWithText(text);
      window.scrollTo(0, 0);
    });
  }
  // Signal map: draw the shape in when it comes into view
  var rd = document.querySelector('.vl .radar');
  if (rd) { if ('IntersectionObserver' in window) { var ro = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { rd.classList.add('in'); ro.disconnect(); } }, { threshold: 0.3 }); ro.observe(rd); } else rd.classList.add('in'); }
  // Proof numbers count up when the panel comes into view (final value without motion)
  var nums = document.querySelectorAll('.vl [data-count]');
  if (nums.length && 'IntersectionObserver' in window && root.classList.contains('anim') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var fmt = function (v, el) { return v.toLocaleString(root.lang === 'sk' ? 'sk-SK' : 'en-GB') + (el.dataset.suffix || ''); };
    nums.forEach(function (el) { el.textContent = fmt(0, el); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      var el = en.target, to = +el.dataset.count, t0 = performance.now(), dur = 1600;
      (function step(now) { var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(Math.round(to * e), el); if (k < 1) requestAnimationFrame(step); })(t0);
    }); }, { threshold: 0.4 });
    nums.forEach(function (el) { io.observe(el); });
  }
  var back = document.querySelector('.vl-back');
  if (back) back.addEventListener('click', function (e) { e.preventDefault(); app(false); reveal(); history.replaceState(null, '', location.pathname + location.search.replace(/[?&](flow|report)=1/g, '')); window.scrollTo(0, 0); });
  window.addEventListener('hashchange', function () { if (location.hash === '#start') { app(true); window.scrollTo(0, 0); } });
  // Hero sample: the four steps reveal one after another, then all stay visible
  var d = document.getElementById('demo');
  function reveal() {
    if (!d || d.dataset.shown) return; d.dataset.shown = '1';
    var s = d.querySelectorAll('.st'), t = d.querySelectorAll('.dots i');
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(max-width: 900px)').matches || !root.classList.contains('anim');  // phones: final frame at once
    s.forEach(function (x, k) { var on = function () { x.classList.add('on'); if (t[k]) t[k].classList.add('on'); }; still ? on() : setTimeout(on, 200 + k * 650); });
  }
  if (!root.classList.contains('vl-app')) reveal();
  // After the reveal, replay the bars and the score ring every ~5 s while the card is on screen and not hovered
  if (d && root.classList.contains('anim') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var vis = true, hov = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(d);
    d.addEventListener('mouseenter', function () { hov = true; }); d.addEventListener('mouseleave', function () { hov = false; });
    setInterval(function () {
      if (!vis || hov || !d.dataset.shown || root.classList.contains('vl-app') || matchMedia('(max-width: 900px)').matches) return;
      d.classList.add('replay'); void d.offsetWidth; requestAnimationFrame(function () { d.classList.remove('replay'); });
    }, 5200);
  }
  document.querySelectorAll('.vl .billing [data-bill]').forEach(function (b) {
    b.addEventListener('click', function () { var y = b.dataset.bill === 'y';
      document.querySelectorAll('.vl .billing [data-bill]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      document.querySelectorAll('.vl [data-m]').forEach(function (e) { e.hidden = y; });
      document.querySelectorAll('.vl [data-y]').forEach(function (e) { e.hidden = !y; }); });
  });
  var f = document.getElementById('cfoWaitForm');
  if (f) {
    var msg = f.querySelector('.wait-msg'), ok = f.querySelector('.wait-ok');
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var em = f.email.value.trim();
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em)) { msg.textContent = f.email.getAttribute('aria-label') + '?'; return; }
      f.querySelector('button[type=submit]').disabled = true;
      // Worker /waitlist through vb-api.js (staging and localhost: the staging Worker's dry run)
      var body = JSON.stringify({ email: em, hp: f.website.value, source: f.dataset.source, lang: root.lang || 'en' });
      Promise.resolve().then(function () { return window.VB_API.fetchWithTimeout(window.VB_API.url('/waitlist'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }, window.VB_API.TIMEOUT_MS); })
        .then(function (r) { if (!r.ok) throw 0; f.querySelectorAll('input,button,.wait-note').forEach(function (x) { x.hidden = true; }); msg.textContent = ''; ok.hidden = false;
          (window.dataLayer = window.dataLayer || []).push({ event: 'waitlist_signup', waitlist_source: f.dataset.source }); })
        .catch(function () { f.querySelector('button[type=submit]').disabled = false; msg.textContent = '×'; });
    });
  }
})();
</script>'''

HREFLANG = ('<link rel="alternate" hreflang="en" href="https://virtuse.com/verdict.html">\n'
            '<link rel="alternate" hreflang="sk" href="https://virtuse.com/sk/verdict.html">\n'
            '<link rel="alternate" hreflang="ru" href="https://virtuse.com/ru/verdict.html">\n'
            '<link rel="alternate" hreflang="x-default" href="https://virtuse.com/verdict.html">')

VB_API_TAG = '<script src="/vb-api.js?v=1" defer></script>'   # Worker client (vb-api.js) for the waitlist form

HEAD_GATE = '''<script>/* Verdict landing: open the funnel directly for hand-overs, ?flow=1, ?report=1 and a reload during a run */
(function(){try{var s=sessionStorage;if(location.hash==='#start'||/[?&](flow|report)=1\\b/.test(location.search)||s.getItem('vb-verdict-text')||s.getItem('vb-vl-app')==='1')document.documentElement.classList.add('vl-app');}catch(e){}})();</script>'''

def build_page(lang, cfg):
    path = os.path.join(SITE, cfg['page'])
    s = open(path, encoding='utf8').read()
    s = re.sub(r'\n?<!-- VL:START -->.*?<!-- VL:END -->', '', s, flags=re.S)
    s = re.sub(r'\n?<!-- VLH:START -->.*?<!-- VLH:END -->', '', s, flags=re.S)
    s = re.sub(r'\n?<!-- VLS:START -->.*?<!-- VLS:END -->', '', s, flags=re.S)
    s = s.replace('<div class="vf" id="start">', '<div class="vf">')
    s = re.sub(r'\s*<a class="vl-back"[^>]*>[^<]*</a>', '', s)
    # head: own title/description/og, landing CSS, early state gate
    s = re.sub(r'<title>.*?</title>', '<title>' + cfg['title'] + '</title>', s, count=1)
    for k in ('name="description"', 'property="og:description"'):
        s = re.sub(r'(<meta ' + k + r' content=")[^"]*', lambda m: m.group(1) + esc(cfg['desc']), s, count=1)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + esc(cfg['title']), s, count=1)
    s = s.replace('</head>', '<!-- VLH:START -->\n' + HREFLANG + '\n<link rel="stylesheet" href="/verdict-landing.css?v=' + V + '">\n' + HEAD_GATE + '\n<!-- VLH:END -->\n</head>', 1)
    # body: landing before the funnel, funnel gets id="start" and a way back
    s = s.replace('<div class="vf">', '<!-- VL:START -->\n' + landing(lang, cfg) + '\n<!-- VL:END -->\n<div class="vf" id="start">', 1)
    s = s.replace('<div class="vf-top">', '<a class="vl-back" href="#top">' + cfg['back'] + '</a>\n  <div class="vf-top">', 1)
    s = s.replace('<script src="/vb-profile.js', '<!-- VLS:START -->\n' + VB_API_TAG + '\n' + SCRIPT + '\n<!-- VLS:END -->\n<script src="/vb-profile.js', 1)
    open(path, 'w', encoding='utf8').write(s)
    print('built', cfg['page'])

css = subprocess.run([sys.executable, os.path.join(HERE, 'scope_css.py'), os.path.join(HERE, 'mockup-approved.html')], capture_output=True, text=True, check=True).stdout
css += '\n' + open(os.path.join(HERE, 'extra.css'), encoding='utf8').read()
open(os.path.join(SITE, 'verdict-landing.css'), 'w', encoding='utf8').write(css)
for lang, cfg in LANGS.items(): build_page(lang, cfg)
# ru/verdict.html keeps the funnel only (no RU landing yet); it gets the same hreflang set
ru = os.path.join(SITE, 'ru/verdict.html'); s = open(ru, encoding='utf8').read()
s = re.sub(r'\n?<!-- VLH:START -->.*?<!-- VLH:END -->', '', s, flags=re.S)
s = s.replace('</head>', '<!-- VLH:START -->\n' + HREFLANG + '\n<!-- VLH:END -->\n</head>', 1)
open(ru, 'w', encoding='utf8').write(s)
