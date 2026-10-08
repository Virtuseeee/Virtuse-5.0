#!/usr/bin/env python3
"""IndexNow: tell Bing (and Yandex, Seznam, Naver, Yep) which virtuse.com pages
changed, so they recrawl them within minutes instead of waiting for the sitemap.

The key is the file <32 hex chars>.txt in the site root, whose content is the key
itself. It is public by design: the search engines fetch it from virtuse.com to
check that the ping comes from the site owner. The script refuses to ping while
the key file is not live on production.

    python3 seo-ops/indexnow.py --range FROM TO   # html pages added/changed/deleted
                                                  # in a git range (deploy_site.sh
                                                  # runs this after DEPLOY OK)
    python3 seo-ops/indexnow.py --sitemap         # every URL in sitemap.xml
    python3 seo-ops/indexnow.py --urls URL ...    # these URLs
    add --dry-run to print the URLs without sending them

Changed pages are sent only if they are in sitemap.xml (the indexable ones);
deleted pages are always sent, so the engines drop them sooner.
"""
import glob, json, os, re, subprocess, sys, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = 'Kimi_Agent_Virtuse%20MiCA%20Partners'
SITE = os.path.join(ROOT, SITE_DIR)
HOST = 'virtuse.com'
ORIGIN = 'https://' + HOST
ENDPOINT = 'https://api.indexnow.org/indexnow'
UA = {'User-Agent': 'virtuse-indexnow'}


def key():
    found = [f for f in glob.glob(os.path.join(SITE, '*.txt'))
             if re.fullmatch(r'[0-9a-f]{32}\.txt', os.path.basename(f))
             and open(f).read().strip() == os.path.basename(f)[:-4]]
    if len(found) != 1:
        sys.exit(f'IndexNow: expected exactly one key file <key>.txt in the site root, found {len(found)}')
    return os.path.basename(found[0])[:-4]


def sitemap_urls():
    return re.findall(r'<loc>([^<]+)</loc>', open(os.path.join(SITE, 'sitemap.xml'), encoding='utf-8').read())


def candidates(path):
    """The URLs a site file can be published under (dir/ for dir/index.html)."""
    out = [f'{ORIGIN}/{path}']
    if path.endswith('index.html'):
        out.append(f'{ORIGIN}/{path[:-len("index.html")]}')
    return out


def range_urls(frm, to):
    def diff(flt):
        cmd = ['git', '-C', ROOT, 'diff', '--name-only', '--no-renames', f'--diff-filter={flt}', frm, to, '--', SITE_DIR]
        return [p[len(SITE_DIR) + 1:] for p in subprocess.check_output(cmd, text=True).split() if p.endswith('.html')]
    live = set(sitemap_urls())
    urls = []
    for p in diff('AM'):
        urls += [u for u in candidates(p) if u in live]
    for p in diff('D'):
        urls += candidates(p)
    return urls


def main(argv):
    dry = '--dry-run' in argv
    args = [a for a in argv if a != '--dry-run']
    if args[:1] == ['--range'] and len(args) == 3:
        urls = range_urls(args[1], args[2])
    elif args == ['--sitemap']:
        urls = sitemap_urls()
    elif args[:1] == ['--urls'] and len(args) > 1:
        urls = args[1:]
    else:
        sys.exit(__doc__)
    urls = list(dict.fromkeys(u for u in urls if u.startswith(ORIGIN + '/')))
    if not urls:
        print('IndexNow: no indexable pages in this change, nothing sent')
        return 0
    k = key()
    if dry:
        print(f'IndexNow dry run: {len(urls)} URL(s), key file {ORIGIN}/{k}.txt')
        print('\n'.join(urls))
        return 0
    try:
        live = urllib.request.urlopen(urllib.request.Request(f'{ORIGIN}/{k}.txt', headers=UA), timeout=30).read().decode().strip()
    except Exception as e:
        live = f'unreachable ({e})'
    if live != k:
        sys.exit(f'IndexNow: {ORIGIN}/{k}.txt is not live with the key yet ({live[:40]}); deploy it first')
    sent = 0
    for i in range(0, len(urls), 10000):
        chunk = urls[i:i + 10000]
        body = json.dumps({'host': HOST, 'key': k, 'keyLocation': f'{ORIGIN}/{k}.txt', 'urlList': chunk}).encode()
        req = urllib.request.Request(ENDPOINT, data=body, method='POST',
                                     headers={**UA, 'Content-Type': 'application/json; charset=utf-8'})
        try:
            code = urllib.request.urlopen(req, timeout=60).status
        except urllib.error.HTTPError as e:
            code = e.code
        # 200 = received, 202 = received (key check pending); anything else is an error
        print(f'IndexNow: {len(chunk)} URL(s) -> HTTP {code}')
        if code not in (200, 202):
            return 1
        sent += len(chunk)
    print(f'IndexNow: {sent} URL(s) sent for {HOST}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
