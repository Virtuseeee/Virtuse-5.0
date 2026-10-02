#!/usr/bin/env python3
"""Add the Google Consent Mode v2 default + cookie banner to every page that loads GTM.

Usage: python3 i18n-tools/add_consent.py [files...]   (no args = every *.html under the site folder)

For each page with the GTM loader it:
  1. inserts CONSENT_SNIPPET right before the GTM loader <script> (consent must be
     set before gtm.js runs), plus the deferred /cookie-consent.js banner;
  2. removes the <noscript> GTM iframe (it fires without any consent check).
Idempotent: pages that already carry the snippet are left alone.
"""
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent
MARK = '<!-- vb-consent -->'
CONSENT_SNIPPET = (
    MARK + "\n"
    "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}"
    "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',"
    "analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});"
    "gtag('set','ads_data_redaction',true);"
    "(function(){try{var c=JSON.parse(localStorage.getItem('vb-consent'));"
    "if(c&&c.v===1&&Date.now()-c.t<31536000000){var g=function(x){return x?'granted':'denied'};"
    "gtag('consent','update',{analytics_storage:g(c.a),ad_storage:g(c.m),ad_user_data:g(c.m),ad_personalization:g(c.m)});}}"
    "catch(e){}})();</script>\n"
    '<script src="/cookie-consent.js" defer></script>\n'
)
GTM_LOADER = "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':"
NOSCRIPT = re.compile(
    r'[ \t]*<noscript><iframe src="https://www\.googletagmanager\.com/ns\.html\?id=GTM-[A-Z0-9]+"\s*'
    r'height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>[ \t]*\n?'
)


def process(path: pathlib.Path) -> str:
    text = path.read_text(encoding='utf-8')
    if GTM_LOADER not in text:
        return 'no-gtm'
    new = text
    if MARK not in new:
        if new.count(GTM_LOADER) != 1:
            raise SystemExit(f'{path}: expected exactly one GTM loader')
        new = new.replace(GTM_LOADER, CONSENT_SNIPPET + GTM_LOADER, 1)
    new = NOSCRIPT.sub('', new)
    if new == text:
        return 'unchanged'
    path.write_text(new, encoding='utf-8')
    return 'changed'


def main():
    files = [pathlib.Path(a) for a in sys.argv[1:]] or sorted(SITE.rglob('*.html'))
    counts = {}
    for f in files:
        if 'node_modules' in f.parts:
            continue
        r = process(f)
        counts[r] = counts.get(r, 0) + 1
    print(counts)


if __name__ == '__main__':
    main()
