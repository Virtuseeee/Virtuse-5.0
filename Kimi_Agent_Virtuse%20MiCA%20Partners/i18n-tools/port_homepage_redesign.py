#!/usr/bin/env python3
"""Ports the homepage's redesign (as applied by hand to buy-bitcoin.html)
onto another top-level page that shares the same original template:
neutral-gray color tokens, nav (hamburger SVG, compact links, mobile
language dropdown), hero cleanup, flat cards, de-orangized CTAs, footer
rebuild, newsletter rebrand (no "Four simple steps..." subheading text —
that stays buy-bitcoin-specific per explicit instruction).

Each substitution is matched verbatim and must occur exactly once (or a
specified count) — the script aborts loudly instead of silently
skipping or double-applying a block that has drifted from the shared
template, so a failed run means "check this page by hand," not "some of
it silently didn't happen."
"""
import re
import sys


def _flex_pattern(old):
    """Builds a regex from literal text that matches it verbatim EXCEPT any
    run of whitespace (spaces, blank lines, trailing spaces on blank
    lines) may differ freely from the original. Page-to-page drift in
    this template has turned out to be almost entirely this class of
    incidental whitespace difference (a batch edit leaving a stray
    trailing space on an otherwise-blank line, an extra/missing blank
    line) rather than real content differences — this tolerates all of
    that while still requiring exact property names/values/order.

    Split on whitespace runs BEFORE escaping, not after — re.escape()
    itself backslash-escapes whitespace characters (a real surprise:
    Python 3.7+'s re.escape escapes every non-alphanumeric character,
    not just regex metacharacters), so escaping first and then
    substituting \\s+ for whitespace produces a doubled backslash and a
    pattern that can never match anything.

    LEADING/TRAILING whitespace of `old` is kept 100% literal, not turned
    into \\s+ — a pattern that starts with a flexible \\s+ can match
    starting further left than intended (greedily absorbing the newline
    that ends the PRECEDING, unmatched line), silently deleting it from
    the output since the replacement text doesn't reintroduce it. Only
    whitespace strictly BETWEEN two non-whitespace pieces is made
    flexible. (An earlier version of this fix tried to detect "boundary"
    by list index after splitting, which breaks when `old` itself starts
    or ends with whitespace — re.split then produces a leading/trailing
    EMPTY string before the real whitespace piece, throwing the indices
    off by one. Stripping first and re-attaching the literal edges
    afterward sidesteps that off-by-one entirely.)
    """
    leading_ws = old[: len(old) - len(old.lstrip())]
    trailing_ws = old[len(old.rstrip()):]
    stripped = old.strip()
    parts = re.split(r"(\s+)", stripped)
    pieces = [r"\s+" if part != "" and part.strip() == "" else re.escape(part) for part in parts]
    body = "".join(pieces)
    return re.compile(re.escape(leading_ws) + body + re.escape(trailing_ws))


def replace_once(content, old, new, name, count=1):
    pattern = _flex_pattern(old)
    matches = pattern.findall(content)
    n = len(matches)
    if n != count:
        raise SystemExit(f"[{name}] expected {count} occurrence(s), found {n} — port by hand instead")
    return pattern.sub(lambda m: new, content, count=count)


def replace_optional(content, old, new, name, count=1):
    """Like replace_once, but a page simply not having this section at all
    (0 occurrences) is skipped with a warning instead of aborting — for
    blocks like .hero::before or .pcard that some pages never had. Any
    OTHER count (partial/garbled match) still aborts loudly."""
    pattern = _flex_pattern(old)
    n = len(pattern.findall(content))
    if n == 0:
        print(f"  [skip] {name}: not present on this page")
        return content
    if n != count:
        raise SystemExit(f"[{name}] expected {count} occurrence(s), found {n} — port by hand instead")
    return pattern.sub(lambda m: new, content, count=count)


def port(path):
    content = open(path, encoding="utf-8").read()
    page = path.rsplit(".", 1)[0]  # e.g. "mining"

    # 1. color-scheme meta
    # Translated pages living in a subfolder (sk/, de/, ru/, uk/, cs/) load
    # this as "../lang-detect.js" instead of the root-relative path — a
    # regex tolerant of either, rather than a literal anchor.
    m_langdetect = re.search(
        r'(<meta name="referrer" content="strict-origin-when-cross-origin">\n)(<script src="[^"]*lang-detect\.js"></script>)',
        content,
    )
    if not m_langdetect:
        raise SystemExit("[color-scheme meta] anchor not found — port by hand instead")
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
        # Some pages (about.html) load fonts via <link> tags, not an
        # @import inside <style>, and already have their own body{} rule
        # — don't touch font-loading or add a redundant body rule, just
        # insert the token block and swap the nav background var.
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
            # not just whitespace. Target only the one property that
            # matters via a regex anchored on the selector, and append
            # the nav-scrolled rule after that rule's own closing brace.
            # Some pages have a SECOND, unrelated ".nav { padding: ... }"
            # rule (e.g. inside a mobile media query) that a plain
            # .search() would match first, before the real rule further
            # up that actually carries the rgba(13, 20, 33, ...)
            # background — so pick whichever match contains that
            # background, not just the first one found.
            nav_block_re = re.compile(r"\.nav \{[^{}]*\}", re.S)
            m = next((mm for mm in nav_block_re.finditer(content) if "rgba(13" in mm.group(0)), None)
            if not m:
                # tax.html-style: a bare `nav { ... }` element selector,
                # not `.nav`. Negative lookbehind avoids matching some
                # OTHER selector ending in "nav" (e.g. ".subnav").
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
    new_navlinks = """/* Desktop nav link size/weight matched to linear.app's own nav, same
   as the homepage — :not(.lang-opt) so it doesn't leak onto the
   language pills nested inside .nav-links (a real bug found there). */
.nav-links a:not(.lang-opt) {
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
        # tax.html-style: combined hover+active selector, hardcoded
        # orange text instead of the dark-card background treatment,
        # separate font-weight rule.
        old_navlinks_alt = """.nav-links a:hover, .nav-links a.active { color: #f7931a; }
.nav-links a.active { font-weight: 600; }"""
        new_navlinks_alt = """.nav-links a:hover:not(.lang-opt), .nav-links a.active:not(.lang-opt) { color: var(--text); background: var(--dark-card); }
.nav-links a.active:not(.lang-opt) { font-weight: 600; }"""
        if len(_flex_pattern(old_navlinks_alt).findall(content)) == 1:
            content = replace_once(content, old_navlinks_alt, new_navlinks_alt, "desktop nav-links (tax.html variant)")
        else:
            # bots.html-style: separate hover/active rules already, but
            # active uses var(--orange) (styles.css's alias for
            # --btc-orange, not the name used elsewhere) with its own
            # font-weight, and hover uses a literal rgba() tint instead
            # of --dark-card.
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

    # 4. hamburger + mobile drawer background
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

    # 7. hero cleanup — two independent replacements, not one block, since
    # some pages (treasury.html) have an unrelated @keyframes block
    # sitting between .hero::before and .hero h1.
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
   this also de-orangizes those — confirmed and approved by the user. */
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
        # Pages with no .btn-primary/.btn-secondary at all (about.html has
        # no partner cards or a hero CTA button, just the nav button and
        # the newsletter submit).
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

/* nav-cta stays the one sitewide orange stamp — every other button is an
   inverted neutral, hardcoded (not var()) per the real Safari bug found
   on the homepage. */
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

    # 10. footer CSS — regex, not exact-match: property order inside
    # .footer-inner drifted between pages (confirmed on mining.html),
    # so anchor on the selectors/comment markers only and let their
    # internal contents vary.
    footer_css_re = re.compile(
        r"[ \t]*/\* ===== FOOTER ===== \*/\s*\.footer-main \{.*?\.footer-bottom p \{[^}]*\}",
        re.S,
    )
    new_footer_css = """/* ===== FOOTER ===== */
.footer-main {
  background: var(--dark);
  border-top: 1px solid var(--border);
  padding: 60px 0 30px;
}

.footer-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 48px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 40px;
}

.footer-logo { flex-shrink: 0; }

.footer-col h4 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 18px;
}

.footer-col a {
  display: block;
  color: var(--text-muted);
  font-size: 13px;
  text-decoration: none;
  margin-bottom: 12px;
  line-height: 1.4;
  transition: color 0.2s;
}

.footer-col a:hover { color: var(--text); }

.footer-bottom {
  padding-left: 48px;
  padding-right: 48px;
}

.footer-bottom p {
  font-size: 13px;
  color: var(--text-muted);
}

.footer-bottom-brief { margin-top: 6px; }
.footer-bottom-brief a { color: var(--text); text-decoration: none; }
.footer-bottom-brief a:hover { text-decoration: underline; }

.footer-wordmark {
  overflow: hidden;
  height: 138px;
  margin-top: 40px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
  user-select: none;
  opacity: 0.14;
}

.footer-wordmark-icon-wrap {
  flex-shrink: 0;
  animation: footerWordmarkPulse 6s ease-in-out infinite;
}

.footer-wordmark-icon {
  height: 210px;
  width: auto;
  display: block;
}

@keyframes footerWordmarkShimmer {
  0%, 100% { background-position: 200% 0; }
  50% { background-position: -200% 0; }
}

@keyframes footerWordmarkPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.035); }
}

.footer-wordmark-text {
  display: inline-block;
  font-size: 288px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  background: linear-gradient(100deg, #e6edf3 35%, #5FAEDE 50%, #e6edf3 65%);
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: footerWordmarkShimmer 7s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .footer-wordmark-icon-wrap, .footer-wordmark-text { animation: none; }
}"""
    content, n = footer_css_re.subn(lambda m: new_footer_css, content, count=1)
    if n != 1:
        # Fallback: some pages (the dashboard-tool family — btc-dominance,
        # fear-greed, ma-200w, etc.) never had a local .footer-main{} rule
        # at all (they relied on styles.css's shared one), so the anchor
        # above never matches. Anchor on .footer-inner instead and prepend
        # a fresh .footer-main rule of our own.
        footer_css_re_fallback = re.compile(
            r"[ \t]*\.footer-inner \{.*?\.footer-bottom p \{[^}]*\}",
            re.S,
        )
        content, n = footer_css_re_fallback.subn(lambda m: new_footer_css, content, count=1)
        if n != 1:
            raise SystemExit("[footer CSS] regex did not match exactly once — port by hand instead")

    # 11. footer mobile media query — matched narrowly on just these two
    # lines (not whatever follows them, which varies per page: some pages
    # have .footer-columns/.footer-logo img right after, others have
    # unrelated rules like bitcoin-data.html's .subnav-wrap) and the new
    # rules are inserted right after rather than replacing an assumed
    # continuation.
    old_footer_mq = """  .footer-main { padding: 40px 24px 20px; }
  .footer-inner { flex-direction: column; gap: 30px; }"""
    new_footer_mq = """  .footer-main { padding: 40px 24px 20px; }
  .footer-inner { flex-direction: column; gap: 30px; padding: 0; }
  .footer-bottom { padding-left: 0; padding-right: 0; }
  .footer-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 64px 24px; }
  .footer-wordmark { height: 110px; opacity: 0.32; }
  .footer-wordmark-icon { height: 140px; }
  .footer-wordmark-text { font-size: 184px; }"""
    content = replace_once(content, old_footer_mq, new_footer_mq, "footer mobile mq")

    # 12. footer HTML
    old_footer_html = """<footer class="footer-main">
  <div class="footer-inner">
    <div class="footer-logo">
      <div style="display:flex;align-items:flex-end;gap:2px;"><svg viewBox="0 0 760 483" style="height:34px;width:auto;display:block;flex-shrink:0" aria-hidden="true"><defs><linearGradient id="vlgA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#A5E0FB"/><stop offset="1" stop-color="#5FAEDE"/></linearGradient><linearGradient id="vlgB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4D94EC"/><stop offset="1" stop-color="#2B62C0"/></linearGradient></defs><path fill="url(#vlgA)" d="M30 0h220l250 483H280Z"/><path fill="url(#vlgB)" d="M510 0h245L645 205H400Z"/></svg><span style="font-weight:800;font-size:27px;letter-spacing:0.01em;color:#e6edf3;line-height:1;position:relative;top:4px;">Virtuse</span></div>
    </div>
    <div class="footer-columns">
      <div class="footer-col">
        <h4>Company</h4>
        <a href="about.html">About Us</a>
        <a href="faq.html">FAQ</a>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <a href="terms-and-conditions.html">Terms &amp; Conditions</a>
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="aml-compliance.html">AML &amp; Compliance</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>
  </div>
</footer>"""
    new_footer_html = """<footer class="footer-main">
  <div class="footer-inner">
    <div class="footer-logo">
      <div style="display:flex;align-items:flex-end;gap:2px;"><svg viewBox="0 0 760 483" style="height:34px;width:auto;display:block;flex-shrink:0" aria-hidden="true"><defs><linearGradient id="vlgA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#A5E0FB"/><stop offset="1" stop-color="#5FAEDE"/></linearGradient><linearGradient id="vlgB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4D94EC"/><stop offset="1" stop-color="#2B62C0"/></linearGradient></defs><path fill="url(#vlgA)" d="M30 0h220l250 483H280Z"/><path fill="url(#vlgB)" d="M510 0h245L645 205H400Z"/></svg><span style="font-weight:800;font-size:27px;letter-spacing:0.01em;color:var(--text);line-height:1;position:relative;top:4px;">Virtuse</span></div>
    </div>
    <div class="footer-columns">
      <div class="footer-col">
        <h4>Services</h4>
        <a href="buy-bitcoin.html">Buy Bitcoin</a>
        <a href="secure.html">Custody</a>
        <a href="mining.html">Mining</a>
        <a href="lending.html">Loans</a>
        <a href="treasury.html">Treasury</a>
        <a href="tax.html">Tax</a>
        <a href="bots.html">Bots</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="about.html">About Us</a>
        <a href="faq.html">FAQ</a>
      </div>
      <div class="footer-col">
        <h4>Tools</h4>
        <a href="concierge.html?utm_source=concierge&amp;utm_medium=footer">Bitcoin Concierge</a>
        <a href="stacking.html?utm_source=stacking&amp;utm_medium=footer">Stacking Strategist</a>
        <a href="loan.html?utm_source=loan&amp;utm_medium=footer">Loan &amp; Liquidity Copilot</a>
        <a href="tax-agent.html?utm_source=tax-agent&amp;utm_medium=footer">Tax &amp; Inheritance Agent</a>
        <a href="retirement-calculator.html">Retirement Calculator</a>
      </div>
      <div class="footer-col">
        <h4>Guides</h4>
        <a href="news.html?utm_source=brief&amp;utm_medium=footer">Virtuse Brief</a>
        <a href="blog.html">Blog</a>
        <a href="bitcoin-data.html">Bitcoin Data</a>
        <a href="research.html">Research &amp; Media</a>
      </div>
      <div class="footer-col">
        <h4>Legal</h4>
        <a href="terms-and-conditions.html">Terms &amp; Conditions</a>
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="aml-compliance.html">AML &amp; Compliance</a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <p>&copy;2018 - 2026 Virtuse Group, All Rights Reserved.</p>
    <p class="footer-bottom-brief">Virtuse Brief &mdash; the weekly desk from Virtuse. <a href="news.html?utm_source=brief&amp;utm_medium=footer">Read it &rarr;</a></p>
  </div>
  <div class="footer-wordmark" aria-hidden="true">
    <span class="footer-wordmark-icon-wrap">
      <svg class="footer-wordmark-icon" viewBox="0 0 760 483" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vlgFooterA" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#A5E0FB"/><stop offset="1" stop-color="#5FAEDE"/></linearGradient>
          <linearGradient id="vlgFooterB" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4D94EC"/><stop offset="1" stop-color="#2B62C0"/></linearGradient>
        </defs>
        <path fill="url(#vlgFooterA)" d="M30 0h220l250 483H280Z"/>
        <path fill="url(#vlgFooterB)" d="M510 0h245L645 205H400Z"/>
      </svg>
    </span>
    <span class="footer-wordmark-text">Virtuse</span>
  </div>
</footer>"""
    content = replace_optional(content, old_footer_html, new_footer_html, "footer HTML")

    # 13. nav HTML: hamburger + lang-switch -> lang-menu-mobile + Brief item
    old_ham_html = '<button class="nav-hamburger" id="navHamburger" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>'
    new_ham_html = """<button class="nav-hamburger" id="navHamburger" aria-label="Toggle menu" aria-expanded="false">
    <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <line class="ham-line ham-line-1" x1="2" y1="6" x2="18" y2="6"/>
      <line class="ham-line ham-line-2" x1="2" y1="14" x2="18" y2="14"/>
    </svg>
  </button>"""
    content = replace_once(content, old_ham_html, new_ham_html, "hamburger HTML")

    old_brief_item = f"""    <li><a href="about.html"><span class="nav-link-num">10</span><span class="nav-link-label">About</span><svg class="nav-link-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></a></li>
    <li class="nav-links-cta-item"><button type="button" class="nav-cta nav-links-cta">Get Started<svg viewBox="0 0 16 16" fill="none"><path d="M4 12l8-8M5 4h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></li>
    <li class="nav-links-lang-item">
      <div class="lang-switch" role="navigation" aria-label="Page language">
        <a href="{page}.html" class="lang-opt active" lang="en"><span class="lang-flag">\U0001f1ec\U0001f1e7</span>EN</a>
        <a href="sk/{page}.html" class="lang-opt" lang="sk"><span class="lang-flag">\U0001f1f8\U0001f1f0</span>SK</a>
        <a href="uk/{page}.html" class="lang-opt" lang="uk"><span class="lang-flag">\U0001f1fa\U0001f1e6</span>UA</a>
        <a href="cs/{page}.html" class="lang-opt" lang="cs"><span class="lang-flag">\U0001f1e8\U0001f1ff</span>CS</a>
        <a href="ru/{page}.html" class="lang-opt" lang="ru"><span class="lang-flag">\U0001f1f7\U0001f1fa</span>RU</a>
        <a href="de/{page}.html" class="lang-opt" lang="de"><span class="lang-flag">\U0001f1e9\U0001f1ea</span>DE</a>
      </div>
    </li>
  </ul>"""
    new_brief_item = f"""    <li><a href="about.html"><span class="nav-link-num">10</span><span class="nav-link-label">About</span><svg class="nav-link-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></a></li>
    <li><a href="news.html?utm_source=brief&amp;utm_medium=nav"><span class="nav-link-num">11</span><span class="nav-link-label">Brief</span><svg class="nav-link-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg></a></li>
    <li class="nav-links-cta-item"><button type="button" class="nav-cta nav-links-cta">Get Started<svg viewBox="0 0 16 16" fill="none"><path d="M4 12l8-8M5 4h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></li>
    <li class="nav-links-lang-item">
      <div class="lang-menu lang-menu-mobile" id="langMenuMobile">
        <button type="button" class="lang-menu-btn" id="langMenuBtnMobile" aria-haspopup="true" aria-expanded="false" aria-label="Page language">
          <span class="lang-flag">\U0001f1ec\U0001f1e7</span>EN
          <svg class="lang-menu-caret" width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="lang-menu-panel" id="langMenuPanelMobile" role="menu">
          <a href="{page}.html" class="lang-opt active" lang="en" role="menuitem"><span class="lang-flag">\U0001f1ec\U0001f1e7</span>EN</a>
          <a href="sk/{page}.html" class="lang-opt" lang="sk" role="menuitem"><span class="lang-flag">\U0001f1f8\U0001f1f0</span>SK</a>
          <a href="uk/{page}.html" class="lang-opt" lang="uk" role="menuitem"><span class="lang-flag">\U0001f1fa\U0001f1e6</span>UA</a>
          <a href="cs/{page}.html" class="lang-opt" lang="cs" role="menuitem"><span class="lang-flag">\U0001f1e8\U0001f1ff</span>CS</a>
          <a href="ru/{page}.html" class="lang-opt" lang="ru" role="menuitem"><span class="lang-flag">\U0001f1f7\U0001f1fa</span>RU</a>
          <a href="de/{page}.html" class="lang-opt" lang="de" role="menuitem"><span class="lang-flag">\U0001f1e9\U0001f1ea</span>DE</a>
        </div>
      </div>
    </li>
  </ul>"""
    if 'nav-link-label">Brief</span>' in content:
        # This page was already run through the standalone Brief-nav-
        # reorder pass (added straight after Blog, not appended after
        # About the way this step assumes) — don't re-insert Brief, just
        # do the lang-switch -> dropdown swap on its own, independent of
        # whatever numbering/label precedes it in the <li> list.
        #
        # Reuse the page's OWN existing <a class="lang-opt"> links/aria-
        # label verbatim (captured, not regenerated) — a translated page
        # living in a subfolder has its own correct-but-non-uniform
        # relative hrefs (self bare, EN "../", other langs "../<lang>/"),
        # translated aria-label text, and possibly a different language
        # set (e.g. no "cs" option) — regenerating these from the root-
        # only {page}.html pattern this step was originally written for
        # would silently produce wrong links on every subfolder page.
        lang_switch_re = re.compile(
            r'<li class="nav-links-lang-item">\s*<div class="lang-switch" role="navigation" aria-label="([^"]*)">(.*?)</div>\s*</li>',
            re.S,
        )
        m_lang = lang_switch_re.search(content)
        if not m_lang:
            raise SystemExit("[lang-switch->dropdown, Brief-already-present variant] regex did not match — port by hand instead")
        aria_label, opts_html = m_lang.group(1), m_lang.group(2)
        # Find the currently-active option's flag+code for the closed-state button label.
        active_m = re.search(r'<a[^>]*class="lang-opt active"[^>]*>(<span class="lang-flag">[^<]*</span>)(\w+)</a>', opts_html)
        active_flag_label = (active_m.group(1) + active_m.group(2)) if active_m else '<span class="lang-flag">\U0001f1ec\U0001f1e7</span>EN'
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
    elif len(_flex_pattern(old_brief_item).findall(content)) == 1:
        content = replace_once(content, old_brief_item, new_brief_item, "Brief nav item + lang-switch->dropdown")
    else:
        # The page IS "About" itself (about.html), so its own nav link
        # carries class="active" — a real per-page content difference,
        # not template drift, so it needs its own variant that preserves
        # that active state rather than silently dropping it.
        old_brief_item_active = old_brief_item.replace(
            '<a href="about.html">', '<a href="about.html" class="active">'
        )
        new_brief_item_active = new_brief_item.replace(
            '<a href="about.html">', '<a href="about.html" class="active">'
        )
        content = replace_once(
            content, old_brief_item_active, new_brief_item_active,
            "Brief nav item + lang-switch->dropdown (About page, active link)",
        )

    # 14. JS: language dropdown (single instance -> multi)
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

    # 15. JS: mobile menu toggle exclusion + nav-scrolled listener
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

    # 16. newsletter heading weight + span rule
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
        # One-line rule format (bitcoin-data.html), no position/z-index.
        old_nl_css_oneline = ".newsletter h2 { font-size: 36px; font-weight: 800; margin-bottom: 12px; }"
        new_nl_css_oneline = (
            ".newsletter h2 { font-size: 36px; font-weight: 700; margin-bottom: 12px; }\n\n"
            ".newsletter h2 span { font-weight: 400; color: var(--text-muted); }"
        )
        content = replace_once(content, old_nl_css_oneline, new_nl_css_oneline, "newsletter heading CSS (one-line)")

    # 17. newsletter copy rebrand (stale "Fix the Money"/"Virtuse Report"
    # copy, predating the homepage's own Virtuse Brief rebrand)
    old_nl_html = """<section class="newsletter">
  <h2>Fix the Money, Fix the World</h2>
  <p>Join 18,000+ investors staying ahead of the curve. Get the Virtuse Report in your inbox every week.</p>
  <form class="newsletter-form" id="newsletterForm" novalidate>
    <input type="email" name="email" placeholder="Enter your email" required>
    <input type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none">
    <button type="submit">SUBSCRIBE NOW</button>
  </form>"""
    new_nl_html = """<section class="newsletter">
  <h2>Get <span>the Brief</span></h2>
  <p>Virtuse Brief. Bitcoin-only. No tokens. No PR.</p>
  <form class="newsletter-form" id="newsletterForm" novalidate>
    <input type="email" name="email" placeholder="Email address" required>
    <input type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none">
    <button type="submit">Get the Brief</button>
  </form>"""
    content = replace_optional(content, old_nl_html, new_nl_html, "newsletter copy")

    open(path, "w", encoding="utf-8").write(content)
    print(f"OK: {path}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        port(p)
