#!/usr/bin/env python3
"""Apply the EN->HU copy in hu_translations.py to the scaffolded hu/ pages.

Order: raw HTML snippets (for text split by inline tags) -> JS literals
-> whole text nodes and attribute values. Every snippet/JS pair is
asserted: a missing EN source aborts instead of silently shipping English.

Usage: python3 i18n-tools/apply_hu_translations.py [page.html ...]
"""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hu_translations as T  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PL = os.path.join(ROOT, "hu")
ATTRS = ("alt", "title", "aria-label", "placeholder")
META_KEYS = ('name="description"', 'property="og:title"', 'property="og:description"',
             'name="twitter:title"', 'name="twitter:description"')


def norm(s):
    return " ".join(html.unescape(s).split())


def replace_asserted(s, old, new, page, what):
    n = s.count(old)
    if n == 0:
        raise SystemExit("%s: %s not found: %r" % (page, what, old[:120]))
    return s.replace(old, new)


def split_protected(s):
    """Yield (is_code, chunk): code = <script>/<style>/<svg> blocks."""
    pos = 0
    for m in re.finditer(r"<(script|style|svg)\b.*?</\1>", s, flags=re.S):
        yield False, s[pos:m.start()]
        yield True, m.group(0)
        pos = m.end()
    yield False, s[pos:]


def translate_markup(chunk, stats):
    def text_node(m):
        raw = m.group(1)
        key = norm(raw)
        if key in T.TEXT:
            lead = raw[:len(raw) - len(raw.lstrip())]
            trail = raw[len(raw.rstrip()):]
            stats["text"] += 1
            return ">" + lead + html.escape(T.TEXT[key], quote=False) + trail + "<"
        return m.group(0)

    def tag(m):
        t = m.group(0)
        for a in ATTRS:
            def attr(am):
                key = norm(am.group(2))
                if key in T.TEXT:
                    stats["attr"] += 1
                    return '%s="%s"' % (am.group(1), html.escape(T.TEXT[key], quote=True))
                return am.group(0)
            t = re.sub(r'\b(%s)="([^"]*)"' % re.escape(a), attr, t)
        if t.startswith("<meta") and any(k in t for k in META_KEYS):
            def content(cm):
                key = norm(cm.group(1))
                if key in T.TEXT:
                    stats["meta"] += 1
                    return 'content="%s"' % html.escape(T.TEXT[key], quote=True)
                return cm.group(0)
            t = re.sub(r'content="([^"]*)"', content, t)
        return t

    chunk = re.sub(r">([^<>]+)<", text_node, chunk)
    chunk = re.sub(r"<[a-zA-Z][^<>]*>", tag, chunk)
    return chunk


def apply(page):
    path = os.path.join(PL, page)
    s = open(path, encoding="utf-8").read()

    # Page snippets first (they may contain a shared fragment such as a
    # dek heading), then the shared ones, which are optional per page.
    for old, new in T.SNIPPETS.get(page, []):
        s = replace_asserted(s, old, new, page, "snippet")
    for old, new in T.SNIPPETS.get("*", []):
        s = s.replace(old, new)

    for old, new in T.JS.get("*", []):
        s = s.replace(old, new)
    for old, new in T.JS.get(page, []):
        s = replace_asserted(s, old, new, page, "js")

    stats = {"text": 0, "attr": 0, "meta": 0}
    out = []
    for is_code, chunk in split_protected(s):
        # Pad with '>' / '<' so text touching an svg/script edge
        # (e.g. "<li><svg>…</svg> Label</li>") is still a text node.
        out.append(chunk if is_code else translate_markup(">" + chunk + "<", stats)[1:-1])
    s = "".join(out)

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(s)
    print("%-28s text %4d  attr %3d  meta %2d" % (page, stats["text"], stats["attr"], stats["meta"]))


if __name__ == "__main__":
    pages = sys.argv[1:] or sorted(f for f in os.listdir(PL) if f.endswith(".html") and f != "blog.html")
    for p in pages:
        apply(p)
