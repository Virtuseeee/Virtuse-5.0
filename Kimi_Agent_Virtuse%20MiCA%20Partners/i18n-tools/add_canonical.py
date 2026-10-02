#!/usr/bin/env python3
"""Give every indexable top-level hub page (root + 9 language folders) a
<link rel="canonical"> equal to its own og:url (the same URL that hreflang
and sitemap.xml use). Fixes two duplicates seen in Search Console
(2026-10-02): https://virtuse.com/ vs /index.html, and staging.virtuse.com
pages indexed next to production (staging serves the same HTML, so the
absolute canonical points Google back to virtuse.com).
Skips noindex pages and pages that already have a canonical. Idempotent.
Usage: python3 i18n-tools/add_canonical.py [--dry-run]"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLDERS = ["", "sk", "uk", "cs", "ru", "de", "fr", "es", "pl", "hu"]
OG = re.compile(r'<meta property="og:url" content="(https://virtuse\.com/[^"]*)">')
def main():
    dry = '--dry-run' in sys.argv; n = 0; skipped = []
    for f in FOLDERS:
        d = os.path.join(ROOT, f)
        for name in sorted(os.listdir(d)):
            if not name.endswith('.html'): continue
            p = os.path.join(d, name); s = open(p, encoding='utf-8').read(); rel = os.path.join(f, name)
            if 'rel="canonical"' in s: continue
            m = re.search(r'<meta name="robots" content="([^"]*)"', s)
            if m and 'noindex' in m.group(1): continue
            og = OG.search(s)
            if not og: skipped.append(rel); continue
            tag = f'<link rel="canonical" href="{og.group(1)}">\n'
            s2 = s.replace(og.group(0), tag + og.group(0), 1)
            n += 1
            if not dry: open(p, 'w', encoding='utf-8').write(s2)
    print('added', n, '(dry run)' if dry else '')
    for x in skipped: print('  no og:url:', x)
if __name__ == '__main__': main()
