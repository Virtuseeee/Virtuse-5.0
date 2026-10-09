#!/usr/bin/env python3
"""Shared text-node / attribute walker for the new homepage.

segments(html) -> list of (kind, start, end, text) for every translatable
piece in <body>: visible text nodes (outside <script>/<style>), and the
values of aria-label / placeholder / alt / title attributes. Positions are
byte offsets in the html string, so apply() can rewrite in place.
"""
import re

ATTRS = ('aria-label', 'placeholder', 'alt', 'title')
SKIP = re.compile(r'^[\s\d€$.,:;/%+\-–—·|()→←↓↑×*#&;]*$')   # numbers, symbols, nothing to translate


def segments(html):
    body = html.index('<body')
    out = []
    pos = body
    tag_re = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|<!--.*?-->', re.S)
    skip_until = None
    for m in tag_re.finditer(html, body):
        # text before this tag
        if skip_until is None and m.start() > pos:
            raw = html[pos:m.start()]
            t = raw.strip()
            if t and not SKIP.match(t) and re.search(r'[A-Za-z]', t):
                lead = len(raw) - len(raw.lstrip())
                out.append(('text', pos + lead, pos + lead + len(t), t))
        pos = m.end()
        if m.group(0).startswith('<!--'):
            continue
        closing, name, attrs = m.group(1), (m.group(2) or '').lower(), m.group(3) or ''
        if skip_until:
            if closing and name == skip_until:
                skip_until = None
            continue
        if not closing and name in ('script', 'style'):
            skip_until = name
            continue
        if not closing:
            for am in re.finditer(r'\b(%s)="([^"]*)"' % '|'.join(ATTRS), attrs):
                v = am.group(2)
                if v and re.search(r'[A-Za-z]{2}', v):
                    start = m.start(3) + am.start(2)
                    out.append(('attr:' + am.group(1), start, start + len(v), v))
    return out


def context(html, start, end, width=160):
    a = max(0, start - width)
    b = min(len(html), end + width)
    snip = html[a:b]
    snip = re.sub(r'\s+', ' ', snip)
    return snip


def apply(html, tr):
    """tr: dict en_text -> translated text. Replace from the end so offsets hold."""
    segs = segments(html)
    missing = []
    for kind, s, e, t in sorted(segs, key=lambda x: -x[1]):
        if t in tr and tr[t] is not None:
            v = tr[t]
            if kind.startswith('attr:'):
                v = v.replace('"', '&quot;')
            html = html[:s] + v + html[e:]
        else:
            missing.append(t)
    return html, missing
