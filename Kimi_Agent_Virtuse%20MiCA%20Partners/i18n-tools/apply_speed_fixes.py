#!/usr/bin/env python3
"""Page-speed fixes found with Lighthouse (mobile) on 2026-10-08. Idempotent.

1. Every page that loads Inter with an @import inside its <style>: the font stylesheet
   becomes a <link> in <head>, with preconnect to fonts.googleapis.com and
   fonts.gstatic.com. The font files come from a second host that the browser only
   learns about after the CSS arrives; the preconnect opens that connection early.
2. The 10 homepages: anime.js was a blocking <script> in <head> (Lighthouse: part of
   ~2.7 s of render-blocking requests). It now loads with defer, and the scroll reveals
   that use it start at DOMContentLoaded. sk/cs/fr homepages load it without using it,
   so there it is removed. (All other pages already load it at the end of <body>.)
3. The 10 homepages: the hero cube (Three.js, 255 KB) starts after the load event,
   fades in, and stops rendering while it is off screen.

    python3 i18n-tools/apply_speed_fixes.py [--dry-run]
"""
import glob, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = '--dry-run' in sys.argv
HOMES = ['index.html'] + [f'{l}/index.html' for l in 'sk cs uk ru de fr es pl hu'.split()]

ANIME_TAG = re.compile(r'<script src="https://cdn\.jsdelivr\.net/npm/animejs@4\.5\.0/dist/bundles/anime\.umd\.min\.js"[^>]*></script>\n?')
FONT_IMPORT = re.compile(r"(<style[^>]*>)(\s*)@import url\('(https://fonts\.googleapis\.com/css2\?[^']+)'\);[ \t]*\n?")


def fonts(s):
    m = FONT_IMPORT.search(s)
    if not m:
        return s, False
    links = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
             '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
             f'<link rel="stylesheet" href="{m.group(3)}">\n')
    s = s[:m.start()] + links + m.group(1) + m.group(2).lstrip(' \t') + s[m.end():]
    assert not FONT_IMPORT.search(s), 'more than one font @import'
    return s, True


REVEAL_OLD = re.compile(r"(// ===== SCROLL-TRIGGERED REVEALS \(anime\.js\) =====\n(?://[^\n]*\n)*)"
                        r"\(function\(\) \{\n(  const hasAnime = typeof anime !== 'undefined' && anime\.animate;\n.*?\n)\}\)\(\);\n", re.S)
REVEAL_NOTE = ("// anime.js loads with defer (it was a render-blocking script in <head>), so the\n"
               "// reveals start at DOMContentLoaded, after deferred scripts have run.\n")


def anime(s):
    """Homepages only. The word-by-word headline code shares the inline script with the
    reveals, so the script itself must not wait for anime.js: anime.js gets `defer` and
    only the reveal block waits for DOMContentLoaded."""
    tags = ANIME_TAG.findall(s)
    if not tags:
        assert not re.search(r'\banime\.(animate|stagger)', s), 'anime.js used but not loaded'
        return s, None                      # removed on an earlier run (sk/cs/fr)
    assert len(tags) == 1, f'{len(tags)} anime.js tags'
    tag = tags[0]
    if ' defer' in tag:
        assert 'function initReveals()' in s
        return s, None
    if s.index(tag.rstrip('\n')) > s.index('<body'):
        return s, None                      # already at the end of the page, not blocking
    if not re.search(r'\banime\.', s.replace(tag, '')):
        return s.replace(tag, '', 1), 'removed (unused)'
    m = REVEAL_OLD.search(s)
    assert m and len(re.findall(r'\banime\.', s.replace(tag, '').replace(m.group(0), ''))) == 0, \
        'anime.js used outside the reveal block'
    new = (m.group(1) + REVEAL_NOTE + 'function initReveals() {\n' + m.group(2) + '}\n'
           "if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReveals);\n"
           'else initReveals();\n')
    s = s[:m.start()] + new + s[m.end():]
    s = s.replace(tag, tag.replace(' crossorigin="anonymous"></script>', ' crossorigin="anonymous" defer></script>'), 1)
    assert ' defer></script>' in s
    return s, 'defer + reveals on DOMContentLoaded'


CUBE_OLD_HEAD = """<script type="module">
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function () {
  const host = document.getElementById('cube');
  if (!host || typeof THREE === 'undefined') return;
"""
CUBE_NEW_HEAD = """<script type="module">
// Three.js (255 KB) and this scene setup took most of a phone's CPU while the page was
// still loading (Lighthouse mobile: LCP 5.6 s, TBT 530 ms). So the cube is fetched and
// built only after the load event, fades in, and stops rendering while off screen.
function startCube() {
  Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/environments/RoomEnvironment.js')
  ]).then(([THREE, geo, env]) => cube(THREE, geo.RoundedBoxGeometry, env.RoomEnvironment)).catch(() => {});
}
if (document.readyState === 'complete') startCube();
else window.addEventListener('load', startCube, { once: true });

function cube(THREE, RoundedBoxGeometry, RoomEnvironment) {
  const host = document.getElementById('cube');
  if (!host || !THREE) return;
"""
CUBE_OLD_TWIST = "    if (twisting || reduced) return;\n"
CUBE_NEW_TWIST = "    if (twisting || reduced || !visible) return;\n"
CUBE_OLD_TAIL = """  function render() {
    if (!reduced) {
      root.rotation.y += 0.0026;
      root.rotation.x += 0.0006;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
</script>"""
CUBE_NEW_TAIL = """  // Render only while the cube is on screen (requestAnimationFrame already stops in
  // hidden tabs); the IntersectionObserver restarts the loop when it scrolls back in.
  let visible = true;
  let running = false;
  function render() {
    if (!visible) { running = false; return; }
    if (!reduced) {
      root.rotation.y += 0.0026;
      root.rotation.x += 0.0006;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  function play() {
    if (!running) { running = true; requestAnimationFrame(render); }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) play();
    }).observe(host);
  }
  renderer.render(scene, camera);
  host.classList.add('is-ready');
  play();
}
</script>"""
CUBE_OLD_CSS = """#cube {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
"""
CUBE_NEW_CSS = """#cube {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0;
  transition: opacity .8s ease;
}
#cube.is-ready { opacity: 1; }
@media (prefers-reduced-motion: reduce) { #cube { transition: none; } }
"""


def cube(s):
    if CUBE_NEW_HEAD in s:
        assert CUBE_NEW_TAIL in s and CUBE_NEW_CSS in s and CUBE_NEW_TWIST in s
        return s, False
    for old, new in ((CUBE_OLD_HEAD, CUBE_NEW_HEAD), (CUBE_OLD_TWIST, CUBE_NEW_TWIST),
                     (CUBE_OLD_TAIL, CUBE_NEW_TAIL), (CUBE_OLD_CSS, CUBE_NEW_CSS)):
        assert s.count(old) == 1, f'cube block not found exactly once: {old[:50]!r}'
        s = s.replace(old, new)
    return s, True


def main():
    changed = {}
    for path in sorted(glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True)):
        rel = os.path.relpath(path, SITE)
        if rel.startswith(('i18n-tools', 'node_modules')):
            continue
        s0 = s = open(path, encoding='utf-8').read()
        notes = []
        s, did = fonts(s)
        if did:
            notes.append('font link')
        if rel in HOMES:
            s, what = anime(s)
            if what:
                notes.append('anime.js ' + what)
            s, did = cube(s)
            if did:
                notes.append('cube after load')
        if s != s0:
            changed[rel] = notes
            if not DRY:
                open(path, 'w', encoding='utf-8').write(s)
    for rel, notes in changed.items():
        if rel in HOMES:
            print(f'{rel}: {", ".join(notes)}')
    others = [r for r in changed if r not in HOMES]
    print(f'{len(changed)} files {"would change" if DRY else "changed"} '
          f'({len(others)} other pages: font link only)')


if __name__ == '__main__':
    main()
