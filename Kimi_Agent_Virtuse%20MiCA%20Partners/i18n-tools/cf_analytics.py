#!/usr/bin/env python3
"""Cloudflare Web Analytics: one snippet before </body> on every page.

The beacon sets no cookies, stores nothing in the browser and has no visitor
identifier, so it needs no consent and the cookie banner does not gate it
(privacy policy section 4, SK/EN). Like GTM it never loads on staging.virtuse.com (same condition, which seo-build/verify.mjs strips).

The snippet lives here only. v2common.scripts() (the shared page end of the
design-v2 pipelines) imports it; seo-build/lib/html.mjs carries a copy (CF_SNIPPET),
which --check compares on the generated pages. Templates that other builds copy
(index.html for the language homepages, article.html for the story pages, the
Layer 2 module shells) get it from this script.

  python3 cf_analytics.py           insert / update the snippet and the CSP origins on every page
  python3 cf_analytics.py --check   only report pages that are missing it or carry an old copy (exit 1)

Pages without </body>, redirect stubs (meta refresh) and the embeds (fee index, bitcoin-vs-gold; shown inside
other sites' iframes) are left alone. The CSP origins are added only where a page has a CSP;
csp_tight.py never removes them (they are not in its OPTIONAL list).
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)

TOKEN = '2ea6557e098f45879d87102065701564'   # public: it is in every page's source
MARK = '<!-- Cloudflare Web Analytics -->'
SNIPPET = (MARK + "<script>(function(d){if(location.hostname!=='staging.virtuse.com'){"
           "var s=d.createElement('script');s.type='module';s.src='https://static.cloudflareinsights.com/beacon.min.js';"
           "s.setAttribute('data-cf-beacon','{\"token\": \"%s\"}');d.body.appendChild(s);}})(document);</script>" % TOKEN)
CSP_ORIGINS = {'script-src': 'https://static.cloudflareinsights.com', 'connect-src': 'https://cloudflareinsights.com'}

SNIPPET_RE = re.compile(re.escape(MARK) + r'<script>.*?</script>\n?', re.S)
CSP_RE = re.compile(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)">')
SKIP_DIRS = ('i18n-tools/', 'email/', 'bitcoin-fee-index/embed/', 'bitcoin-vs-gold/embed/', 'asset-returns/embed/')


def wanted(html):
    return '</body>' in html and 'http-equiv="refresh"' not in html


def add_csp(html):
    m = CSP_RE.search(html)
    if not m:
        return html
    dirs = [d.strip() for d in m.group(1).split(';') if d.strip()]
    out = []
    for d in dirs:
        toks = d.split()
        o = CSP_ORIGINS.get(toks[0])
        if o and o not in toks:
            toks.append(o)
        out.append(' '.join(toks))
    return html[:m.start()] + '<meta http-equiv="Content-Security-Policy" content="%s">' % '; '.join(out) + html[m.end():]


def apply(html):
    if not wanted(html):
        return html
    html = SNIPPET_RE.sub('', html)
    i = html.rindex('</body>')
    return add_csp(html[:i] + SNIPPET + '\n' + html[i:])


def pages():
    for root, dirs, files in os.walk(SITE):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        for f in files:
            if f.endswith('.html'):
                p = os.path.join(root, f)
                rel = os.path.relpath(p, SITE).replace(os.sep, '/')
                if not rel.startswith(SKIP_DIRS):
                    yield p, rel


def main():
    check = '--check' in sys.argv[1:]
    changed, total = [], 0
    for p, rel in sorted(pages()):
        s = open(p, encoding='utf-8', newline='').read()   # keep CRLF in WordPress text as is
        if not wanted(s):
            continue
        total += 1
        t = apply(s)
        if t != s:
            changed.append(rel)
            if not check:
                open(p, 'w', encoding='utf-8', newline='').write(t)
    for rel in changed[:20]:
        print(('needs it: ' if check else 'updated: ') + rel)
    print('%d of %d page(s) %s' % (len(changed), total, 'need the snippet' if check else 'changed'))
    if check and changed:
        sys.exit(1)


if __name__ == '__main__':
    main()
