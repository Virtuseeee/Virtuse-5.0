"""Wire partner_click tracking from data/partners.json (idempotent).

1. Writes the host -> [partner, category] map into partner-click.js (between the BEGIN/END markers).
2. Adds <script src="/partner-click.js" defer></script> after the cookie-consent tag on every
   HTML page that links to a partner host (found by scanning the site, so new pages are covered).
3. Fails if a category page (any `page` in partners.json, all languages) has an outbound link
   whose host is not mapped -- i.e. a partner link changed or a new partner was added
   without updating `hosts` in partners.json.
Run: python3 i18n-tools/build_partner_click.py
"""
import json, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['', 'cs', 'de', 'es', 'fr', 'hu', 'pl', 'ru', 'sk', 'uk']
# Outbound hosts on category pages that are not partners (social, fonts, CDNs).
IGNORE = re.compile(r'virtuse|google|gstatic|jsdelivr|linkedin|twitter|x\.com|facebook|instagram|youtube|t\.me|telegram|cloudflare|calendly')
TAG = '<script src="/partner-click.js" defer></script>'
SKIP_DIRS = {'.git', 'node_modules', 'concierge-assets', 'i18n-tools', 'data'}

data = json.load(open(os.path.join(SITE, 'data', 'partners.json'), encoding='utf-8'))
hosts = {}
for p in data['partners']:
    for h in p['hosts']:
        assert h not in hosts, f'duplicate host {h}'
        hosts[h] = [p['name'], p['category']]

def lookup(host):
    host = host.lower()
    if host.startswith('www.'):
        host = host[4:]
    while '.' in host:
        if host in hosts:
            return hosts[host]
        host = host.split('.', 1)[1]
    return None

# 1. host map into the script
js_path = os.path.join(SITE, 'partner-click.js')
js = open(js_path, encoding='utf-8').read()
body = ',\n'.join(f'    {json.dumps(h)}: {json.dumps(v, ensure_ascii=False)}' for h, v in sorted(hosts.items()))
block = '  // BEGIN PARTNER HOSTS (generated)\n  var HOSTS = {\n' + body + '\n  };\n  // END PARTNER HOSTS'
new_js, n = re.subn(r'  // BEGIN PARTNER HOSTS \(generated\).*?// END PARTNER HOSTS', lambda m: block, js, flags=re.S)
assert n == 1, 'markers not found in partner-click.js'
if new_js != js:
    open(js_path, 'w', encoding='utf-8').write(new_js)
    print('updated partner-click.js')

# 3. coverage check on category pages
link_rx = re.compile(r'<a\s[^>]*href="(https?://[^"]+)"')
missing = set()
for page in sorted({p['page'] for p in data['partners']}):
    for l in LANGS:
        f = os.path.join(SITE, l, page)
        if not os.path.exists(f):
            continue
        for href in link_rx.findall(open(f, encoding='utf-8').read()):
            host = href.split('/')[2]
            if not IGNORE.search(host) and not lookup(host):
                missing.add((os.path.relpath(f, SITE), host))
if missing:
    for f, h in sorted(missing):
        print(f'UNMAPPED {h} on {f}')
    sys.exit('add these hosts to data/partners.json (or to IGNORE if not a partner)')

# 2. script tag on every page with a partner link
added = 0
for root, dirs, files in os.walk(SITE):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for name in files:
        if not name.endswith('.html'):
            continue
        f = os.path.join(root, name)
        s = open(f, encoding='utf-8').read()
        if TAG in s or not any(lookup(h.split('/')[2]) for h in link_rx.findall(s)):
            continue
        anchor = '<script src="/cookie-consent.js" defer></script>'
        assert s.count(anchor) == 1, f'no cookie-consent tag in {f}'
        s = s.replace(anchor, anchor + '\n' + TAG)
        open(f, 'w', encoding='utf-8').write(s)
        added += 1
print(f'{len(hosts)} hosts, script added to {added} page(s)')
