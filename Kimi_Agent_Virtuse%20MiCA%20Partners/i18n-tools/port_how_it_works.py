#!/usr/bin/env python3
"""Ports the old .step/.step-num "How It Works" grid to the homepage's
.how-log changelog-dot layout, on a single page given as argv[1].

Per explicit instruction: no subheading paragraph is added on pages
other than buy-bitcoin.html (which keeps its own hand-written one) —
only the H2 "How <span>It Works</span>" heading.
"""
import re
import sys

OLD_CSS = """.how-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 32px;
}

.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.step {
  background: var(--dark-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px 24px;
  position: relative;
  transition: border-color 0.2s;
}

.step:hover { border-color: var(--border-hover); }

.step-num {
  position: absolute;
  top: -16px;
  left: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--btc-orange), var(--btc-orange-light));
  border-radius: 50%;
  font-weight: 800;
  font-size: 14px;
  color: white;
  box-shadow: 0 2px 8px rgba(247, 147, 26, 0.35);
  z-index: 2;
}

.step h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 8px;
  margin-top: 8px;
}

.step p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}"""

NEW_CSS = """/* How-it-works header, matching the homepage's shared .sec-header dek
   pattern (own class here, not reusing this page's .sec-header, a
   different flex-row layout used by the partners section heading+badge). */
.how-header { text-align: left; margin-bottom: 60px; }

.how-header h2 {
  font-size: 42px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.25;
  margin-bottom: 14px;
}

.how-header h2 span { font-weight: 400; color: var(--text-muted); }

.how-header p {
  font-size: 20px;
  font-weight: 400;
  color: var(--text-muted);
  max-width: 620px;
  line-height: 1.55;
}

/* linear.app changelog pattern, same as the homepage's own "How Virtuse
   Works" section: one shared horizontal rule, entries side by side as
   columns, each with a dot sitting on the rule (orange for the first,
   muted for the rest), then heading + copy. */
.how-log {
  display: flex;
  gap: 40px;
  border-top: 1px solid var(--border);
}

.how-log-item {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.how-log-marker {
  margin-top: -4px;
  margin-bottom: 24px;
}

.how-log-dot {
  position: relative;
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-dim);
}

.how-log-dot::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: var(--text-dim);
  opacity: 0.2;
}

.how-log-item:first-child .how-log-dot { background: var(--btc-orange); }
.how-log-item:first-child .how-log-dot::before { background: var(--btc-orange); opacity: 0.1; }

.how-log-body { flex: 1; display: flex; flex-direction: column; }

.how-log-num {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  order: 4;
  margin-top: 16px;
}

.how-log-body h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
  order: 1;
}

.how-log-body p {
  font-size: 15px;
  color: var(--text-muted);
  line-height: 1.6;
  order: 2;
}

@media (max-width: 900px) {
  .how-log { flex-direction: column; gap: 0; border-top: none; }
  .how-log-item { border-top: 1px solid var(--border); padding-top: 28px; padding-bottom: 28px; }
  .how-log-marker { margin-top: 0; }
  .how-log-item:first-child .how-log-dot {
    box-shadow: 0 0 10px 2px rgba(247, 147, 26, 0.65);
  }
  .how-log-item:first-child .how-log-dot::before { opacity: 0.3; }
}"""

STEP_RE = re.compile(
    r'<div class="step">\s*<div class="step-num">\d+</div>\s*'
    r'<h3>(.*?)</h3>\s*<p>(.*?)</p>\s*</div>',
    re.S,
)

SECTION_RE = re.compile(
    r'<section class="how">\s*'
    r'<div class="how-title">(.*?)</div>\s*'
    r'<div class="steps">(.*?)</div>\s*'
    r'</section>',
    re.S,
)


def build_section(match):
    title = match.group(1).strip()
    steps_html = match.group(2)
    steps = STEP_RE.findall(steps_html)
    if not steps:
        raise SystemExit("No .step blocks matched inside <section class=\"how\">")

    words = title.split(None, 1)
    first_word = words[0] if words else "How"
    rest = words[1] if len(words) > 1 else ""
    heading = f"<h2>{first_word} <span>{rest}</span></h2>" if rest else f"<h2>{first_word}</h2>"

    items = []
    for i, (h3, p) in enumerate(steps, start=1):
        items.append(f"""    <div class="how-log-item">
      <div class="how-log-marker"><span class="how-log-dot"></span></div>
      <div class="how-log-body">
        <span class="how-log-num">Step {i:02d}</span>
        <h3>{h3}</h3>
        <p>{p}</p>
      </div>
    </div>""")

    return f"""<section class="how">
  <div class="how-header">
    {heading}
  </div>
  <div class="how-log">
{chr(10).join(items)}
  </div>
</section>"""


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: port_how_it_works.py <page.html>")
    path = sys.argv[1]
    content = open(path, encoding="utf-8").read()

    if OLD_CSS not in content:
        raise SystemExit(f"OLD_CSS block not found verbatim in {path} — check for drift, port by hand instead")
    content = content.replace(OLD_CSS, NEW_CSS)

    new_content, n = SECTION_RE.subn(build_section, content, count=1)
    if n != 1:
        raise SystemExit(f"Expected exactly 1 <section class=\"how\"> match in {path}, got {n} — port by hand instead")

    open(path, "w", encoding="utf-8").write(new_content)
    print(f"OK: {path}")


if __name__ == "__main__":
    main()
