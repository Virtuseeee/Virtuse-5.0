#!/usr/bin/env python3
"""
Retrofit the EN/SK pages' old 3-pill desktop language switcher
(.lang-switch.nav-lang-switch, a sibling of <ul class="nav-links">) into the
compact single-button dropdown built for the uk/ rollout (.nav-actions >
.lang-menu). Reads whatever EN/SK/UA pills already exist in a page's
switcher and preserves them verbatim (hrefs, order, aria-label) -- only the
visual/markup pattern changes, not the language set.

Mobile (<=1024px) is untouched: the li.nav-links-lang-item 3-pill row
inside the hamburger overlay stays exactly as-is, matching what was done
for uk/ pages (only the desktop switcher was redesigned there too).

Usage: python3 dropdown_retrofit.py <page.html> [<page2.html> ...]
       python3 dropdown_retrofit.py --all      # every root + sk/ page that has the old switcher
"""
import sys, re, os, glob

CONTENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

NAV_CSS = """
/* ===== Compact language dropdown (desktop) =====
   Replaces the old 3-pill .nav-lang-switch with a single compact button
   that opens a small dropdown, so the nav row has room regardless of how
   many languages exist. .nav-actions groups it with the CTA button into
   one flex item so the nav's space-between doesn't spread them apart. */
.nav-actions { display: flex; align-items: center; gap: 12px; }

.lang-menu { position: relative; }

.lang-menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 100px;
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.lang-menu-btn:hover { border-color: var(--btc-orange); }

.lang-menu-caret {
  opacity: 0.6;
  transition: transform 0.2s ease;
}

.lang-menu.open .lang-menu-caret { transform: rotate(180deg); }

.lang-menu-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 130px;
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 6px;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px);
  transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  z-index: 200;
}

.lang-menu.open .lang-menu-panel {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.lang-menu-panel .lang-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.lang-menu-panel .lang-opt:hover { background: rgba(255, 255, 255, 0.06); color: var(--text); }

.lang-menu-panel .lang-opt.active {
  background: var(--btc-orange);
  color: #0d0902;
}

@media (max-width: 1024px) {
  .lang-menu { display: none; }
}
"""

LANG_JS = """
<script>
// ===== LANGUAGE DROPDOWN =====
(function () {
  var wrap = document.getElementById('langMenu');
  var btn = document.getElementById('langMenuBtn');
  if (!wrap || !btn) return;
  function close() {
    wrap.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!wrap.contains(e.target)) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
</script>
"""

SWITCH_PAT = re.compile(
    r'  <div class="lang-switch nav-lang-switch" role="navigation" aria-label="([^"]*)">\n'
    r'((?:.*\n)*?)'
    r'  </div>\n'
    r'  <button class="nav-cta">([^<]*)</button>\n'
    r'</nav>\n'
)
OPT_PAT = re.compile(
    r'    <a href="([^"]*)" class="lang-opt( active)?" lang="([a-z]{2})"><span class="lang-flag">([^<]*)</span>([A-Z]+)</a>\n'
)


def process(path):
    with open(path, encoding="utf-8") as f:
        s = f.read()

    if 'id="langMenu"' in s:
        print(f"  already retrofitted, skip: {path}")
        return False

    m = SWITCH_PAT.search(s)
    if not m:
        print(f"  WARNING: old nav-lang-switch pattern not found, skip: {path}")
        return False

    aria_label, inner, cta_label = m.group(1), m.group(2), m.group(3)
    opts = OPT_PAT.findall(inner)
    if not opts:
        print(f"  WARNING: no lang-opt entries parsed, skip: {path}")
        return False
    active = next((o for o in opts if o[1]), None)
    if not active:
        print(f"  WARNING: no active lang-opt found, skip: {path}")
        return False
    active_flag, active_code = active[3], active[4]

    panel_lines = []
    for href, is_active, lang, flag, code in opts:
        cls = "lang-opt active" if is_active else "lang-opt"
        panel_lines.append(
            f'        <a href="{href}" class="{cls}" lang="{lang}" role="menuitem"><span class="lang-flag">{flag}</span>{code}</a>\n'
        )
    panel = "".join(panel_lines)

    replacement = (
        f'  <div class="nav-actions">\n'
        f'    <div class="lang-menu" id="langMenu">\n'
        f'      <button type="button" class="lang-menu-btn" id="langMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="{aria_label}">\n'
        f'        <span class="lang-flag">{active_flag}</span>{active_code}\n'
        f'        <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
        f'      </button>\n'
        f'      <div class="lang-menu-panel" id="langMenuPanel" role="menu">\n'
        f'{panel}'
        f'      </div>\n'
        f'    </div>\n'
        f'    <button class="nav-cta">{cta_label}</button>\n'
        f'  </div>\n'
        f'</nav>\n'
        f'{LANG_JS}\n'
    )
    s = s[: m.start()] + replacement + s[m.end() :]

    if "</style>" in s:
        s = s.replace("</style>", NAV_CSS + "</style>", 1)
    else:
        print(f"  WARNING: </style> not found, CSS NOT inserted: {path}")

    with open(path, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"  retrofitted: {path}")
    return True


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: dropdown_retrofit.py <page.html> [...]  |  --all")
        sys.exit(1)

    if args == ["--all"]:
        targets = []
        for p in sorted(glob.glob(os.path.join(CONTENT_DIR, "*.html"))):
            targets.append(p)
        for p in sorted(glob.glob(os.path.join(CONTENT_DIR, "sk", "*.html"))):
            targets.append(p)
    else:
        targets = []
        for a in args:
            if a.startswith("sk/"):
                targets.append(os.path.join(CONTENT_DIR, a))
            else:
                targets.append(os.path.join(CONTENT_DIR, a))

    changed = 0
    for t in targets:
        if process(t):
            changed += 1
    print(f"\nDone. {changed}/{len(targets)} files retrofitted.")


if __name__ == "__main__":
    main()
