#!/usr/bin/env python3
"""Check old paths against a server: one 301 (or the expected 302) to a 200 page on the same host,
or the expected code.

    python3 seo-ops/check_redirects.py BASE [-H 'Header: v' ...] [--paths FILE] [--legacy]

    # local Apache with the new .htaccess (see seo-ops/README-redirects or the report):
    python3 seo-ops/check_redirects.py http://127.0.0.1:8899 -H 'Host: virtuse.com' -H 'X-Forwarded-Proto: https'
    # staging cannot run .htaccess; production after the upload:
    python3 seo-ops/check_redirects.py https://virtuse.com

Input: seo-ops/old-paths.txt (from build_redirects.py): path<TAB>expected_code<TAB>expected_target.
--legacy also checks every path of partnerships/legacy-wp-redirects.csv (and its slash-less form).

Prints `code redirect_url <- path` per line, follows a redirect once and requires: 200 at the
target, no second hop, same host (https://virtuse.com in Location is mapped to BASE). Targets on
another host are only accepted when old-paths.txt expects exactly that URL (not fetched).
Exit 1 on any failure; the summary counts codes.
"""
import argparse, collections, csv, http.client, os, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON = 'https://virtuse.com'


def fetch(base, path, headers):
    u = urllib.parse.urlsplit(base)
    conn = (http.client.HTTPSConnection if u.scheme == 'https' else http.client.HTTPConnection)(u.netloc, timeout=20)
    conn.request('GET', path, headers=headers)
    r = conn.getresponse(); r.read(); conn.close()
    return r.status, r.getheader('Location') or ''


def quote(p):
    return urllib.parse.quote(p, safe="/%?=&:+,;@!$'()*~-._")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('base')
    ap.add_argument('-H', action='append', default=[])
    ap.add_argument('--paths', default=os.path.join(ROOT, 'seo-ops/old-paths.txt'))
    ap.add_argument('--legacy', action='store_true')
    a = ap.parse_args()
    base = a.base.rstrip('/')
    headers = {'User-Agent': 'virtuse-redirect-check'}
    for h in a.H:
        k, v = h.split(':', 1); headers[k.strip()] = v.strip()
    items = []
    for line in open(a.paths, encoding='utf-8'):
        if line.startswith('#') or not line.strip(): continue
        p, code, tgt = (line.rstrip('\n').split('\t') + ['', ''])[:3]
        items.append((p, int(code), tgt))
    if a.legacy:
        for r in csv.DictReader(open(os.path.join(ROOT, 'partnerships/legacy-wp-redirects.csv'), encoding='utf-8')):
            for p in (r['path'], r['path'].rstrip('/')):
                if p not in {i[0] for i in items}:
                    items.append((p, -1, ''))  # -1: 410, or one 301 hop to a 200 page
    counts, fails = collections.Counter(), []
    for p, want, tgt in items:
        code, loc = fetch(base, quote(p), headers)
        counts[code] += 1
        print(f'{code} {loc}  <- {p}')
        err = None
        if code in (301, 302, 307, 308):
            if want not in (301, 302, -1): err = f'expected {want}'
            elif code != (302 if want == 302 else 301): err = f'not a {302 if want == 302 else 301}'
            elif '?' in loc and '?' not in (tgt or ''): err = 'query string kept'
            dest = loc[len(CANON):] if loc.startswith(CANON + '/') else (loc if loc.startswith('/') else None)
            if dest is None:
                if loc != tgt: err = err or f'other host: {loc}'
            else:
                if tgt and urllib.parse.unquote(dest) != tgt: err = err or f'expected target {tgt}'
                c2, l2 = fetch(base, dest, headers)
                if c2 != 200: err = err or f'target answers {c2} {l2} (chain or broken)'
        elif want == -1:
            if code != 410: err = f'got {code}'
        elif code != want:
            err = f'expected {want}'
        if err:
            fails.append(f'{p}: {err}'); print(f'   FAIL {err}')
    print(f'\n{len(items)} paths: ' + ', '.join(f'{k}×{v}' for k, v in sorted(counts.items())))
    print(f'{len(fails)} failures' + (':' if fails else ''))
    for f in fails: print('  ' + f)
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
