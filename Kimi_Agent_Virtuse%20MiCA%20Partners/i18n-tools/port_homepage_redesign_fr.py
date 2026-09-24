#!/usr/bin/env python3
"""French variant of port_homepage_redesign.py — same mechanical CSS/nav/
footer/newsletter port, adapted for fr/ pages: French aria-labels, the
page's own real 8-language lang-switch (EN/SK/UK/CS/RU/DE/FR/ES) reused
verbatim instead of the EN script's hardcoded 6-language template, and
French footer/newsletter copy. Does NOT insert a "Brief" nav item (out of
scope for this pass) — only converts the mobile lang-switch pill row to
the dropdown component.
"""
import re
import sys

from port_homepage_redesign import _flex_pattern, replace_once, replace_optional


def port(path):
    content = open(path, encoding="utf-8").read()

    # 1. color-scheme meta
    m_langdetect = re.search(
        r'(<meta name="referrer" content="strict-origin-when-cross-origin">\n)(<script src="[^"]*lang-detect\.js"></script>)',
        content,
    )
    if not m_langdetect:
        raise SystemExit("[color-scheme meta] anchor not found — port by hand instead")
    if 'name="color-scheme"' not in content:
        content = (
            content[: m_langdetect.start()]
            + m_langdetect.group(1)
            + "<!-- Dark-only, matching the homepage's own redesign. -->\n"
            + '<meta name="color-scheme" content="dark">\n'
            + m_langdetect.group(2)
            + content[m_langdetect.end():]
        )

    # 2. @import + reset + :root tokens + body font + nav background
    old_head = """@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

/* ===== NAVIGATION ===== */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 20px 48px;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 20, 33, 0.95);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
}"""
    new_head = """@import url('https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap');

/* Neutral-gray dark palette, matched to the homepage's own redesign —
   overrides styles.css's older navy-tinted tokens for this page only. */
:root {
  color-scheme: dark;
  --dark: #08090a;
  --dark-lighter: #0e0e0e;
  --dark-card: #141414;
  --dark-card-hover: #1c1c1c;
  --border: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(255, 255, 255, 0.12);
  --nav-bg: rgba(8, 9, 10, 0.95);
  --nav-bg-strong: rgba(8, 9, 10, 0.98);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body { font-family: 'Inter', -apple-system, 'SF Pro Display', 'system-ui', 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }

/* ===== NAVIGATION ===== */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 20px 48px;
  border-bottom: 1px solid var(--border);
  background: var(--nav-bg);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav.nav-scrolled { background: var(--nav-bg-strong); backdrop-filter: blur(20px); }"""
    if len(_flex_pattern(old_head).findall(content)) == 1:
        content = replace_once(content, old_head, new_head, "head/nav base")
    else:
        # Some pages (bots.html) load fonts via <link> tags, not an
        # @import inside <style>, and already have their own body{} rule
        # — don't touch font-loading, just insert the token block
        # (covering the --bg/--card alias set too) and fix the nav bg.
        old_style_open = "<style>"
        new_style_open = """<style>

/* Neutral-gray dark palette, matched to the homepage's own redesign —
   overrides styles.css's older navy-tinted tokens for this page only. */
:root {
  color-scheme: dark;
  --dark: #08090a;
  --dark-lighter: #0e0e0e;
  --dark-card: #141414;
  --dark-card-hover: #1c1c1c;
  --border: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(255, 255, 255, 0.12);
  --nav-bg: rgba(8, 9, 10, 0.95);
  --nav-bg-strong: rgba(8, 9, 10, 0.98);
  /* styles.css also defines an alternate alias set (--bg/--card) for
     the same tone tokens — some pages (bots.html) use those names
     instead of --dark/--dark-card, so both need overriding here or the
     alias silently keeps styles.css's old navy-tinted value. */
  --bg: #08090a;
  --card: #141414;
}"""
        content = replace_once(content, old_style_open, new_style_open, "style tag open (fallback head)", count=1)

        old_nav_bg = """.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
  border-bottom: 1px solid var(--border);
  background: rgba(13, 20, 33, 0.95);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
}"""
        new_nav_bg = """.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
  border-bottom: 1px solid var(--border);
  background: var(--nav-bg);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav.nav-scrolled { background: var(--nav-bg-strong); backdrop-filter: blur(20px); }"""
        if len(_flex_pattern(old_nav_bg).findall(content)) == 1:
            content = replace_once(content, old_nav_bg, new_nav_bg, "nav background (fallback head)")
        else:
            # Some pages' .nav rule has genuinely different properties/
            # order/values (bots.html: extra -webkit-backdrop-filter,
            # saturate(), z-index:1000 not 100, opacity 0.92 not 0.95) —
            # not just whitespace. Target only the background property
            # via a regex anchored on the selector.
            nav_block_re = re.compile(r"\.nav \{[^{}]*\}", re.S)
            m = next((mm for mm in nav_block_re.finditer(content) if "rgba(13" in mm.group(0)), None)
            if not m:
                nav_block_re = re.compile(r"(?<![.\w])nav \{[^{}]*\}", re.S)
                m = next((mm for mm in nav_block_re.finditer(content) if "rgba(13" in mm.group(0)), None)
            if not m:
                raise SystemExit("[nav background (regex fallback)] no .nav/nav { ... } block found — port by hand instead")
            block = m.group(0)
            new_block, n_bg = re.subn(
                r"background:\s*rgba\(13,\s*20,\s*33,\s*[0-9.]+\);",
                "background: var(--nav-bg);",
                block,
                count=1,
            )
            if n_bg != 1:
                raise SystemExit("[nav background (regex fallback)] no rgba(13, 20, 33, ...) background found inside .nav — port by hand instead")
            content = content[: m.start()] + new_block + "\n\n.nav.nav-scrolled { background: var(--nav-bg-strong); backdrop-filter: blur(20px); }" + content[m.end():]

    # 3. desktop nav-links hover/active
    old_navlinks = """.nav-links a:hover { color: var(--text); background: var(--dark-card); }

.nav-links a.active {
  color: var(--btc-orange);
  background: rgba(247, 147, 26, 0.08);
}"""
    new_navlinks = """.nav-links a:not(.lang-opt) {
  font-size: 13px;
  font-weight: 400;
  padding: 6px 12px;
}

.nav-links a:hover:not(.lang-opt) { color: var(--text); background: var(--dark-card); }

.nav-links a.active:not(.lang-opt) {
  color: var(--text);
  background: var(--dark-card);
}"""
    if len(_flex_pattern(old_navlinks).findall(content)) == 1:
        content = replace_once(content, old_navlinks, new_navlinks, "desktop nav-links")
    else:
        old_navlinks_bots = """.nav-links a:hover {
      color: var(--text);
      background: rgba(230, 237, 243, 0.05);
    }

    .nav-links a.active {
      color: var(--orange);
      background: rgba(247, 147, 26, 0.08);
      font-weight: 600;
    }"""
        new_navlinks_bots = """.nav-links a:hover:not(.lang-opt) {
      color: var(--text);
      background: var(--dark-card);
    }

    .nav-links a.active:not(.lang-opt) {
      color: var(--text);
      background: var(--dark-card);
      font-weight: 600;
    }"""
        content = replace_once(content, old_navlinks_bots, new_navlinks_bots, "desktop nav-links (bots.html variant)")

    # 4. hamburger + mobile drawer background (French aria-label)
    old_hamburger = """/* ===== MOBILE MENU ===== */
.nav-hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  position: fixed;
  top: 18px;
  right: 16px;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  transition: background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 1024px) {
  .nav-hamburger { display: flex; }
  .nav-cta {
    position: fixed;
    top: 16px;
    right: 60px;
    z-index: 1001;
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    list-style: none;
    margin: 0;
    position: fixed;
    top: 0; left: 0; right: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background:
      radial-gradient(ellipse 620px 420px at 100% 0%, rgba(247, 147, 26, 0.14), transparent 60%),
      linear-gradient(180deg, #0d1421 0%, #0a0f1a 55%, #0d1421 100%);
    padding: calc(88px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom));
    gap: 0;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-12px);
    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
    z-index: 1000;
    overflow-y: auto;
  }"""
    new_hamburger = """/* ===== MOBILE MENU ===== */
/* Rebuilt as an inline SVG (two stroked <line>s) instead of two <span>
   divs with a CSS background-color — a real device screenshot on the
   homepage showed the span version fully invisible on mobile Safari. */
.nav-hamburger svg { width: 20px; height: 20px; overflow: visible; }

.ham-line {
  stroke: var(--text, #e6edf3);
  stroke-width: 2;
  stroke-linecap: round;
  transform-origin: 10px 10px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

body.nav-open .ham-line-1 { transform: translateY(4px) rotate(45deg); }
body.nav-open .ham-line-2 { transform: translateY(-4px) rotate(-45deg); }

.nav-hamburger {
  display: none;
  -webkit-appearance: none;
  appearance: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  position: fixed;
  top: 18px;
  right: 16px;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  transition: background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

@media (max-width: 1024px) {
  .nav-hamburger { display: flex; }
  .nav-cta {
    position: fixed;
    top: 16px;
    right: 60px;
    z-index: 1001;
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    list-style: none;
    margin: 0;
    position: fixed;
    top: 0; left: 0; right: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background:
      radial-gradient(ellipse 620px 420px at 100% 0%, rgba(247, 147, 26, 0.14), transparent 60%),
      linear-gradient(180deg, var(--dark) 0%, var(--dark-lighter) 55%, var(--dark) 100%);
    padding: calc(88px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom));
    gap: 0;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-12px);
    transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
    z-index: 1000;
    overflow-y: auto;
  }"""
    content = replace_once(content, old_hamburger, new_hamburger, "hamburger + drawer bg")

    # 5. mobile nav-links active state leak fix
    old_active = """  .nav-links a.active { color: var(--btc-orange, #f7931a); }
  .nav-links a.active .nav-link-num { color: var(--btc-orange, #f7931a); }

  .nav-links a.active::before {
    content: '';
    position: absolute;
    left: -24px;
    top: 0; bottom: 0;
    width: 3px;
    background: var(--btc-orange, #f7931a);
  }"""
    new_active = """  .nav-links a.active:not(.lang-opt) { color: var(--btc-orange, #f7931a); }
  .nav-links a.active .nav-link-num { color: var(--btc-orange, #f7931a); }

  .nav-links a.active:not(.lang-opt)::before {
    content: '';
    position: absolute;
    left: -24px;
    top: 0; bottom: 0;
    width: 3px;
    background: var(--btc-orange, #f7931a);
  }"""
    content = replace_once(content, old_active, new_active, "mobile active leak fix")

    # 6. lang-menu-btn hover + mobile hide rule
    content = replace_once(
        content,
        ".lang-menu-btn:hover { border-color: var(--btc-orange); }",
        ".lang-menu-btn:hover { border-color: var(--border-hover); }",
        "lang-menu-btn hover",
    )
    content = replace_once(
        content,
        "@media (max-width: 1024px) {\n  .lang-menu { display: none; }\n}",
        "@media (max-width: 1024px) {\n"
        "  .lang-menu:not(.lang-menu-mobile) { display: none; }\n"
        "  .lang-menu-mobile { margin-top: 4px; }\n"
        "  .lang-menu-mobile .lang-menu-panel { right: auto; left: 0; }\n"
        "}",
        "lang-menu mobile hide",
    )

    # 7. hero cleanup
    old_hero_before = """.hero::before {
  content: '';
  position: absolute;
  top: -100px;
  right: -200px;
  width: 600px;
  height: 600px;

  background: radial-gradient(circle, rgba(247, 147, 26,0.08) 0%, transparent 70%);
  pointer-events: none;
}

"""
    content = replace_optional(content, old_hero_before, "", "hero glow removal")

    old_hero_h1 = """.hero h1 {
  font-size: 52px;
  font-weight: 900;
  line-height: 1.1;
  letter-spacing: -0.025em;
  margin-bottom: 20px;
}

.hero h1 .highlight { color: var(--btc-orange); }"""
    new_hero_h1 = """.hero h1 {
  font-size: 52px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.025em;
  margin-bottom: 20px;
}

/* Orange is a rare stamp now, not a highlight color — matches the
   homepage's own hero. */
.hero h1 .highlight { color: var(--text); }"""
    content = replace_optional(content, old_hero_h1, new_hero_h1, "hero h1 weight/highlight")

    # 8. card flattening
    old_pcard = """.pcard {
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 32px;
  position: relative;
  transition: all 0.3s;
  overflow: hidden;
}

.pcard::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;

  opacity: 0;
  transition: opacity 0.3s;
}

.pcard:hover {
  border-color: var(--border-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.pcard:hover::before { opacity: 1; }"""
    new_pcard = """/* Flat hairline card — matches the homepage's Vercel-style card rule. */
.pcard {
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px;
  position: relative;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.pcard:hover {
  border-color: var(--border-hover);
  background: var(--dark-card-hover);
}"""
    content = replace_optional(content, old_pcard, new_pcard, "pcard flatten")

    # 9. CTA system de-orangize
    old_cta = """.nav-cta, .btn-primary, .newsletter-form button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--btc-orange, #f7931a);
  color: #fff;
  font-weight: 700;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-cta:hover, .btn-primary:hover, .newsletter-form button:hover {
  background: #ffffff;
  color: var(--btc-orange, #f7931a);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(247, 147, 26, 0.25);
}

.btn-secondary {
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--btc-orange, #f7931a);
  color: var(--btc-orange, #f7931a);
  background: rgba(247, 147, 26, 0.06);
  transform: translateY(-1px);
}"""
    new_cta = """.nav-cta, .btn-primary, .newsletter-form button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 700;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.2s ease;
}

/* nav-cta stays the one sitewide orange stamp — every other button is an
   inverted neutral, hardcoded (not var()) per the real Safari bug found
   on the homepage. Partner-card primary CTAs use .btn-primary too, so
   this also de-orangizes those. */
.nav-cta { background: var(--btc-orange, #f7931a); color: #0d0902; }
.nav-cta:hover {
  background: #ffffff;
  color: #0d0902;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(247, 147, 26, 0.25);
}

.btn-primary, .newsletter-form button { background: #e6edf3; color: #08090a; }
.btn-primary:hover, .newsletter-form button:hover { opacity: 0.85; transform: translateY(-1px); }

.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: var(--border-hover);
  color: var(--text);
  transform: translateY(-1px);
}"""
    if len(_flex_pattern(old_cta).findall(content)) == 1:
        content = replace_once(content, old_cta, new_cta, "CTA system")
    else:
        old_cta_narrow = """.nav-cta, .newsletter-form button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--btc-orange, #f7931a);
  color: #fff;
  font-weight: 700;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-cta:hover, .newsletter-form button:hover {
  background: #ffffff;
  color: var(--btc-orange, #f7931a);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(247, 147, 26, 0.25);
}"""
        new_cta_narrow = """.nav-cta, .newsletter-form button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 700;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-cta { background: var(--btc-orange, #f7931a); color: #0d0902; }
.nav-cta:hover {
  background: #ffffff;
  color: #0d0902;
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(247, 147, 26, 0.25);
}

.newsletter-form button { background: #e6edf3; color: #08090a; }
.newsletter-form button:hover { opacity: 0.85; transform: translateY(-1px); }"""
        content = replace_once(content, old_cta_narrow, new_cta_narrow, "CTA system (narrow)")

    # 10. hamburger HTML (French aria-label)
    old_ham_html = '<button class="nav-hamburger" id="navHamburger" aria-label="Basculer le menu" aria-expanded="false"><span></span><span></span><span></span></button>'
    new_ham_html = """<button class="nav-hamburger" id="navHamburger" aria-label="Basculer le menu" aria-expanded="false">
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <line class="ham-line ham-line-1" x1="2" y1="6" x2="18" y2="6"/>
      <line class="ham-line ham-line-2" x1="2" y1="14" x2="18" y2="14"/>
    </svg>
  </button>"""
    content = replace_once(content, old_ham_html, new_ham_html, "hamburger HTML")

    # 11. mobile lang-switch -> lang-menu-mobile dropdown, reusing this
    # page's own real (8-language) lang-opt links verbatim — no Brief
    # nav item insertion in this pass.
    lang_switch_re = re.compile(
        r'<li class="nav-links-lang-item">\s*<div class="lang-switch" role="navigation" aria-label="([^"]*)">(.*?)</div>\s*</li>',
        re.S,
    )
    m_lang = lang_switch_re.search(content)
    if not m_lang:
        raise SystemExit("[lang-switch->dropdown] regex did not match — port by hand instead")
    aria_label, opts_html = m_lang.group(1), m_lang.group(2)
    active_m = re.search(r'<a[^>]*class="lang-opt active"[^>]*>(<span class="lang-flag">[^<]*</span>)(\w+)</a>', opts_html)
    active_flag_label = (active_m.group(1) + active_m.group(2)) if active_m else '<span class="lang-flag">\U0001f1eb\U0001f1f7</span>FR'
    opts_with_role = re.sub(r'(<a\s)', r'\1role="menuitem" ', opts_html)
    new_lang_dropdown = f"""<li class="nav-links-lang-item">
      <div class="lang-menu lang-menu-mobile" id="langMenuMobile">
        <button type="button" class="lang-menu-btn" id="langMenuBtnMobile" aria-haspopup="true" aria-expanded="false" aria-label="{aria_label}">
          {active_flag_label}
          <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="lang-menu-panel" id="langMenuPanelMobile" role="menu">{opts_with_role}</div>
      </div>
    </li>"""
    content = content[: m_lang.start()] + new_lang_dropdown + content[m_lang.end():]

    # 12. JS: language dropdown (single instance -> multi)
    old_langjs = """<script>
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
</script>"""
    new_langjs = """<script>
// ===== LANGUAGE DROPDOWN =====
// Handles both the desktop instance (#langMenu) and the mobile drawer's
// own copy (#langMenuMobile) — each .lang-menu wires up independently,
// and opening one closes any other.
(function () {
  var menus = Array.prototype.slice.call(document.querySelectorAll('.lang-menu'));
  if (!menus.length) return;
  function closeAll() {
    menus.forEach(function (wrap) {
      wrap.classList.remove('open');
      var b = wrap.querySelector('.lang-menu-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  menus.forEach(function (wrap) {
    var btn = wrap.querySelector('.lang-menu-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !wrap.classList.contains('open');
      closeAll();
      if (willOpen) {
        wrap.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  document.addEventListener('click', function (e) {
    var stillInside = menus.some(function (wrap) { return wrap.contains(e.target); });
    if (!stillInside) closeAll();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });
})();
</script>"""
    content = replace_once(content, old_langjs, new_langjs, "language dropdown JS")

    # 13. JS: mobile menu toggle exclusion + nav-scrolled listener
    old_mmjs = """  links.querySelectorAll('a, button').forEach(function (el) {
    el.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024) closeMenu();
  });
})();"""
    new_mmjs = """  links.querySelectorAll('a, button').forEach(function (el) {
    if (el.classList.contains('lang-menu-btn')) return;
    el.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024) closeMenu();
  });
})();

// ===== NAV BACKGROUND ON SCROLL =====
(function () {
  var nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', function () {
    nav.classList.toggle('nav-scrolled', window.scrollY > 50);
  });
})();"""
    content = replace_once(content, old_mmjs, new_mmjs, "mobile menu toggle JS")

    # 14. newsletter heading weight + span rule
    old_nl_css = """.newsletter h2 {
  font-size: 36px;
  font-weight: 800;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}"""
    new_nl_css = """.newsletter h2 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.newsletter h2 span { font-weight: 400; color: var(--text-muted); }"""
    if len(_flex_pattern(old_nl_css).findall(content)) == 1:
        content = replace_once(content, old_nl_css, new_nl_css, "newsletter heading CSS")
    else:
        old_nl_css_oneline = ".newsletter h2 { font-size: 36px; font-weight: 800; margin-bottom: 12px; }"
        new_nl_css_oneline = (
            ".newsletter h2 { font-size: 36px; font-weight: 700; margin-bottom: 12px; }\n\n"
            ".newsletter h2 span { font-weight: 400; color: var(--text-muted); }"
        )
        content = replace_optional(content, old_nl_css_oneline, new_nl_css_oneline, "newsletter heading CSS (one-line)")

    open(path, "w", encoding="utf-8").write(content)
    print(f"OK: {path}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        port(p)
