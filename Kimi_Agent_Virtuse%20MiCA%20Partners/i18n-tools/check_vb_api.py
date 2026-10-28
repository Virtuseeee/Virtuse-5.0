#!/usr/bin/env python3
"""Keep vb-api.js the only place in the site's scripts that names the newsletter Worker.

usage: python3 i18n-tools/check_vb_api.py      (exit 1 and a list when something is off)

Checks, over the git-tracked site files (i18n-tools/ and the built Layer 2 bundle
concierge-assets/ excluded):
  1. no script names the Worker's URL except vb-api.js. Allowed outside scripts: the
     CSP meta tag and the ecosystem form's data-endpoint (both written by builders);
  2. every reference to vb-api.js uses the same ?v= (the vbApi() loaders in the shared
     scripts, the <script> tags on pages with inline form code, the Verdict builder);
  3. every page whose inline script calls window.VB_API also loads vb-api.js;
  4. the vbApi() loader is the same text in every shared script that carries it.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
WORKER_RE = re.compile(r'virtuse-newsletter(?:-staging)?\.virtuse-ai\.workers\.dev')
VER_RE = re.compile(r'''/vb-api\.js\?v=([\w.-]+)''')
LOADER_RE = re.compile(r'^([ \t]*)function vbApi\(\) \{\n.*?^\1\}\n', re.S | re.M)
SKIP = ('i18n-tools/', 'concierge-assets/')
CSP_RE = re.compile(r'<meta http-equiv="Content-Security-Policy" content="[^"]*">')
ENDPOINT_RE = re.compile(r'\bdata-endpoint="[^"]*"')


def tracked(pattern):
    out = subprocess.run(['git', 'ls-files', pattern], cwd=SITE, capture_output=True, text=True, check=True).stdout
    return [p for p in out.splitlines() if not p.startswith(SKIP)]


def main():
    bad, versions, loaders = [], {}, {}
    for f in tracked('*.js'):
        s = open(os.path.join(SITE, f), encoding='utf-8', errors='replace').read()
        if f != 'vb-api.js' and WORKER_RE.search(s):
            bad.append('%s: names the Worker URL (use vb-api.js)' % f)
        for v in VER_RE.findall(s):
            versions.setdefault(v, []).append(f)
        m = LOADER_RE.search(s)
        if m:
            loaders.setdefault(re.sub(r'^[ \t]+', '', m.group(0), flags=re.M), []).append(f)
    for f in tracked('*.html'):
        s = open(os.path.join(SITE, f), encoding='utf-8', errors='replace').read()
        rest = ENDPOINT_RE.sub('', CSP_RE.sub('', s))
        if WORKER_RE.search(rest):
            bad.append('%s: names the Worker URL (use vb-api.js)' % f)
        for v in VER_RE.findall(s):
            versions.setdefault(v, []).append(f)
        if 'window.VB_API.' in s and not re.search(r'<script src="/vb-api\.js\?v=[^"]*"', s):
            bad.append('%s: uses window.VB_API but does not load /vb-api.js' % f)
    builder = os.path.join(HERE, 'verdict-landing', 'build.py')
    for v in VER_RE.findall(open(builder, encoding='utf-8').read()):
        versions.setdefault(v, []).append('i18n-tools/verdict-landing/build.py')
    if len(versions) > 1:
        bad.append('vb-api.js is referenced with different ?v= values: ' +
                   '; '.join('v=%s in %d file(s), e.g. %s' % (v, len(fs), fs[0]) for v, fs in sorted(versions.items())))
    if len(loaders) > 1:
        bad.append('the vbApi() loader differs between: ' + ' | '.join(', '.join(fs) for fs in loaders.values()))
    for b in bad:
        print(b)
    n = sum(len(fs) for fs in versions.values())
    print('%d problem(s); vb-api.js referenced from %d place(s), loader in %d script(s)' % (len(bad), n, sum(len(fs) for fs in loaders.values())))
    if bad:
        sys.exit(1)


if __name__ == '__main__':
    main()
