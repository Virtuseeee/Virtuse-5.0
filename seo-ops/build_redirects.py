#!/usr/bin/env python3
"""Approved 301 map (Ras, 13 Oct 2026) → generated block in seo-ops/virtuse.com.htaccess.

    python3 seo-ops/build_redirects.py           # rewrite the block + seo-ops/old-paths.txt
    python3 seo-ops/build_redirects.py --check   # exit 1 if the files would change

Inputs (edit these, never the generated block):
  seo-ops/redirects-2026-10-13.csv   the handover's table: old_pattern,target,note,status
  seo-ops/wp-posts-inventory.csv     every old WordPress post (EN root, /sk/, /ru/)
  the site folder                    which files exist (stories, translated pages, seo-build hreflang)

Writes the text between `# BEGIN approved-redirects-2026-10-13` and `# END …` in
seo-ops/virtuse.com.htaccess (inserted before `# BEGIN legacy-exchange` the first time),
and seo-ops/old-paths.txt (paths + expected result for seo-ops/check_redirects.py).

Pattern rules in the CSV:
  /name/            root + every language prefix (/de/name/ …), with or without the trailing
                    slash and with any subpath; target is localised per language when
                    /<lang><target> exists in the site folder, else the EN target.
  /sk/name/         that language only (target localised the same way).
  /name*  /*name*/  prefix / contains match of the first segment; generated after the post
                    rules and never applied to real files or directories.
  /name.html        that exact file (root + language prefixes).
  target BLOG_HUB   the language's blog hub (EN: /stories/ once stories/index.html exists,
                    else /blog.html; SK: /sk/stories/ once it exists, else /blog-sk.html;
                    other languages: /<lang>/blog.html, else the EN hub).
  target https://…  external, root/that language only (no language expansion).
  status hold       not generated (waits for Ras), listed as a comment.
"""
import csv, html, os, re, sys, json, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners')
HTACCESS = os.path.join(ROOT, 'seo-ops/virtuse.com.htaccess')
MAP = os.path.join(ROOT, 'seo-ops/redirects-2026-10-13.csv')
INV = os.path.join(ROOT, 'seo-ops/wp-posts-inventory.csv')
OLDPATHS = os.path.join(ROOT, 'seo-ops/old-paths.txt')
BEGIN, END = '# BEGIN approved-redirects-2026-10-13', '# END approved-redirects-2026-10-13'
ANCHOR = '# BEGIN legacy-exchange'
HOST = 'https://virtuse.com'
LANGS = ['de', 'es', 'fr', 'pl', 'hu', 'cs', 'sk', 'uk', 'ru', 'it']
LANG_ALT = '|'.join(LANGS)
SEO_DIRS = ['bitcoin-tax', 'buy-bitcoin', 'sell-vs-borrow-bitcoin', 'bitcoin-dca-calculator',
            'bitcoin-inheritance', 'bitcoin-fee-index']
MAXLINE = 6000  # Apache .htaccess lines are capped at 8192 bytes


def exists(path):
    """site path (starting with /) → True if Apache would serve it with 200."""
    p = os.path.join(SITE, path.lstrip('/'))
    return os.path.isfile(p) or os.path.isfile(os.path.join(p, 'index.html'))


def rx(s):
    """Literal → mod_rewrite regex; non [A-Za-z0-9-] bytes as \\xHH (patterns match the decoded path)."""
    out = []
    for ch in s:
        if re.fullmatch(r'[A-Za-z0-9_-]', ch): out.append(ch)
        elif ch in './': out.append('\\' + ch)
        else: out.extend('\\x%02x' % b for b in ch.encode('utf-8'))
    return ''.join(out)


def hub_static(lang):
    """Hub as it resolves right now (for old-paths.txt)."""
    if lang in ('', 'en'): return '/stories/' if exists('/stories/index.html') else '/blog.html'
    if lang == 'sk': return '/sk/stories/' if exists('/sk/stories/index.html') else '/blog-sk.html'
    return f'/{lang}/blog.html' if exists(f'/{lang}/blog.html') else hub_static('')


def hub_rule(lang):
    """Hub as a substitution (EN and SK resolve at request time)."""
    if lang in ('', 'en'): return '%{ENV:VB_HUB_EN}'
    if lang == 'sk': return '%{ENV:VB_HUB_SK}'
    return f'/{lang}/blog.html' if exists(f'/{lang}/blog.html') else '%{ENV:VB_HUB_EN}'


def localise(target, lang):
    if target == 'BLOG_HUB': return hub_rule(lang)
    if target.startswith('http'): return target
    if lang and not re.match(rf'^/({LANG_ALT})/', target) and exists(f'/{lang}{target}'):
        return f'/{lang}{target}'
    return target


def localise_static(target, lang):
    return hub_static(lang) if target == 'BLOG_HUB' else localise(target, lang)


def url(t):
    return t if t.startswith('http') else HOST + t


def chunks(prefix, alts, suffix):
    """Split an alternation so every line stays under MAXLINE."""
    out, cur = [], []
    for a in alts:
        if cur and len(prefix) + len('|'.join(cur + [a])) + len(suffix) > MAXLINE:
            out.append(cur); cur = []
        cur.append(a)
    if cur: out.append(cur)
    return [prefix + '(?:' + '|'.join(c) + ')' + suffix for c in out]


def read_map():
    rows = list(csv.DictReader(open(MAP, encoding='utf-8')))
    for r in rows:
        assert r['status'] in ('ready', 'hold'), r
        assert r['old_pattern'].startswith('/'), r
        t = r['target']
        assert t == 'BLOG_HUB' or t.startswith('http') or exists(t), f'target is not a 200 file: {t}'
    return rows


def parse(pat):
    """→ (lang or '', body regex, kind) ; kind: name | file | prefix | contains | regex"""
    m = re.match(rf'^/({LANG_ALT})/(.+)$', pat)
    lang, body = (m.group(1), m.group(2)) if m else ('', pat[1:])
    if body.startswith('*') and body.rstrip('/').endswith('*'):
        return lang, rx(body.strip('*/')), 'contains'
    if body.endswith('*'):
        return lang, rx(body[:-1]), 'prefix'
    if body.endswith('.html'):
        return lang, rx(body), 'file'
    if '[' in body:
        return lang, body.rstrip('/'), 'regex'
    return lang, rx(body.rstrip('/')), 'name'


def body_regex(body, kind):
    return {'name': body + r'(?:/.*)?', 'regex': body + r'(?:/.*)?', 'file': body,
            'prefix': body + r'[^/]*(?:/.*)?', 'contains': r'[^/]*' + body + r'[^/]*(?:/.*)?'}[kind]


def table_rules(rows, wildcard):
    """Group rows by (language, target) into one alternation rule each."""
    groups, lines = {}, []
    for r in rows:
        if r['status'] != 'ready': continue
        lang, body, kind = parse(r['old_pattern'])
        if (kind in ('prefix', 'contains')) != wildcard: continue
        scopes = [lang] if (lang or r['target'].startswith('http')) else [''] + LANGS
        for L in scopes:
            groups.setdefault((L, localise(r['target'], L)), []).append(body_regex(body, kind))
    for (L, tgt), alts in groups.items():
        pre = f'^{L}/' if L else '^'
        for line in chunks(pre, alts, '$'):
            if wildcard:
                lines += ['RewriteCond %{REQUEST_FILENAME} !-f', 'RewriteCond %{REQUEST_FILENAME} !-d']
            lines.append(f'RewriteRule {line} {url(tgt)} [R=301,L]')
    return lines


def seo_rules():
    """/<lang>/<EN seo-build path> → that page's hreflang <lang> URL, else the EN page."""
    lines, n = [], 0
    for d in SEO_DIRS:
        for dirpath, dirs, files in sorted(os.walk(os.path.join(SITE, d))):
            dirs.sort()
            if 'index.html' not in files: continue
            rel = os.path.relpath(dirpath, SITE).replace(os.sep, '/') + '/'
            page = open(os.path.join(dirpath, 'index.html'), encoding='utf-8').read()
            alt = {m.group(1): urllib.parse.urlparse(html.unescape(m.group(2))).path
                   for m in re.finditer(r'<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)"', page)}
            for L in LANGS:
                if exists(f'/{L}/{rel}'): continue
                t = alt.get(L) if alt.get(L) and exists(alt[L]) else '/' + rel
                lines.append(f'RewriteRule ^{L}/{rx(rel.rstrip("/"))}/?$ {url(t)} [R=301,L]'); n += 1
    return lines


def posts():
    rs = list(csv.DictReader(open(INV, encoding='utf-8')))
    out = []
    for r in rs:
        path = urllib.parse.unquote(urllib.parse.urlparse(r['url']).path).strip('/')
        slug = path.split('/')[-1]
        lang = r['lang']
        if lang == 'ru':
            story = f'/ru/stories/{r["wp_id"]}/'
        else:
            base = '/stories/' if lang == 'en' else '/sk/stories/'
            story = base + slug + '/' if exists(base + slug + '/') else (
                base + r['wp_id'] + '/' if exists(base + r['wp_id'] + '/') else None)
        out.append(dict(lang=lang, path=path, slug=slug, id=r['wp_id'], story=story,
                        raw=urllib.parse.urlparse(r['url']).path.strip('/').split('/')[-1]))
    return out


def post_rules(ps, table_names):
    lines, stats = [], {}
    top = set(os.listdir(SITE)) | {f'sk/{x}' for x in os.listdir(os.path.join(SITE, 'sk'))}
    simple = lambda s: re.fullmatch(r'[a-z0-9-]+', s)
    # 1. RU posts (Cyrillic slugs; decoded path, plus the still-encoded form)
    for p in ps:
        if p['lang'] != 'ru': continue
        assert exists(p['story']), p
        lines.append(f'RewriteRule ^ru/(?:{rx(p["slug"])}|{p["raw"].replace("%", "%")})(?:/.*)?$ '
                     f'{url(p["story"])} [R=301,L,NC]')
    stats['ru'] = sum(1 for p in ps if p['lang'] == 'ru')
    # 2. odd slugs (zero-width spaces, emoji): explicit
    for p in ps:
        if p['lang'] == 'ru' or simple(p['slug']): continue
        pre = '' if p['lang'] == 'en' else 'sk/'
        t = p['story'] or hub_rule(p['lang'])
        lines.append(f'RewriteRule ^{pre}{rx(p["slug"])}(?:/.*)?$ {url(t)} [R=301,L]')
    # 3. generic: an old slug whose story page exists (also covers stories built later)
    lines += [
        '# Old post URL /<slug>/ (/sk/<slug>/) whose static story page exists → that page.',
        'RewriteCond %{REQUEST_FILENAME} !-f', 'RewriteCond %{REQUEST_FILENAME} !-d',
        'RewriteCond %{DOCUMENT_ROOT}/stories/$1/index.html -f',
        f'RewriteRule ^([a-z0-9-]+)(?:/.*)?$ {HOST}/stories/$1/ [R=301,L]',
        'RewriteCond %{REQUEST_FILENAME} !-f', 'RewriteCond %{REQUEST_FILENAME} !-d',
        'RewriteCond %{DOCUMENT_ROOT}/sk/stories/$1/index.html -f',
        f'RewriteRule ^sk/([a-z0-9-]+)(?:/.*)?$ {HOST}/sk/stories/$1/ [R=301,L]']
    # 4. the rest of the inventory (no story page) → blog hub, one alternation per line
    clash = []
    for lang, pre in (('en', ''), ('sk', 'sk/')):
        rest = []
        for p in ps:
            if p['lang'] != lang or not simple(p['slug']) or p['story']: continue
            if (pre + p['slug']) in top or (pre + p['slug']) in table_names:
                clash.append(pre + p['slug']); continue
            rest.append(p['slug'])
        stats[lang + '_hub'] = len(rest)
        stats[lang + '_story'] = sum(1 for p in ps if p['lang'] == lang and p['story'])
        lines.append(f'# {len(rest)} old {lang.upper()} posts without a story page → blog hub')
        for line in chunks('^' + pre, sorted(rest), r'(?:/.*)?$'):
            lines.append(f'RewriteRule {line} {url(hub_rule(lang))} [R=301,L]')
    stats['clash'] = clash
    return lines, stats


def article_rules(ps):
    L = f'(?:(?:{LANG_ALT})/)?'
    lines = ['# Old reader URLs article.html?slug=S[&lang=xx] and /xx/article.html?slug=S → static story.',
             '# RU slugs are Cyrillic, sent once- or twice-encoded (%d0… / %25d0…): explicit per post.']
    for p in ps:
        if p['lang'] != 'ru': continue
        pat = re.sub(r'%([0-9a-fA-F]{2})', r'%(?:25)?\1', p['raw'])
        lines += [f'RewriteCond %{{QUERY_STRING}} (?:^|&)slug={pat}(?:&|$) [NC]',
                  f'RewriteRule ^{L}article\\.html$ {url(p["story"])}? [R=301,L]']
    lines += [
        '# Language from the path prefix, else from &lang=; ASCII slug.',
        f'RewriteRule ^(?:({LANG_ALT})/)?article\\.html$ - [E=VB_AL:$1]',
        'RewriteCond %{ENV:VB_AL} ^$',
        'RewriteCond %{QUERY_STRING} (?:^|&)lang=([a-z]{2})(?:&|$)',
        r'RewriteRule ^article\.html$ - [E=VB_AL:%1]',
        'RewriteCond %{QUERY_STRING} (?:^|&)slug=([A-Za-z0-9-]+)(?:&|$)',
        f'RewriteRule ^{L}article\\.html$ - [E=VB_SLUG:%1]',
        '# 1. same-language story, 2. EN story, 3. SK story',
        'RewriteCond %{ENV:VB_SLUG} .', 'RewriteCond %{ENV:VB_AL} .',
        'RewriteCond %{DOCUMENT_ROOT}/%{ENV:VB_AL}/stories/%{ENV:VB_SLUG}/index.html -f',
        f'RewriteRule ^{L}article\\.html$ {HOST}/%{{ENV:VB_AL}}/stories/%{{ENV:VB_SLUG}}/? [R=301,L]',
        'RewriteCond %{ENV:VB_SLUG} .',
        'RewriteCond %{DOCUMENT_ROOT}/stories/%{ENV:VB_SLUG}/index.html -f',
        f'RewriteRule ^{L}article\\.html$ {HOST}/stories/%{{ENV:VB_SLUG}}/? [R=301,L]',
        'RewriteCond %{ENV:VB_SLUG} .',
        'RewriteCond %{DOCUMENT_ROOT}/sk/stories/%{ENV:VB_SLUG}/index.html -f',
        f'RewriteRule ^{L}article\\.html$ {HOST}/sk/stories/%{{ENV:VB_SLUG}}/? [R=301,L]',
        '# 4. any slug without a story page → the stories hub of its language (sk → /sk/stories/,',
        '#    ru → /ru/stories/, everything else → /stories/), query string dropped. Posts newer',
        '#    than the last stories build land on the hub until the daily Stories build runs.',
        'RewriteCond %{QUERY_STRING} (?:^|&)slug=[^&]',
        'RewriteCond %{ENV:VB_AL} ^sk$',
        f'RewriteRule ^{L}article\\.html$ {HOST}%{{ENV:VB_HUB_SK}}? [R=301,L]']
    if exists('/ru/stories/index.html'):
        lines += ['RewriteCond %{QUERY_STRING} (?:^|&)slug=[^&]',
                  'RewriteCond %{ENV:VB_AL} ^ru$',
                  f'RewriteRule ^{L}article\\.html$ {HOST}/ru/stories/? [R=301,L]']
    lines += ['RewriteCond %{QUERY_STRING} (?:^|&)slug=[^&]',
              f'RewriteRule ^{L}article\\.html$ {HOST}%{{ENV:VB_HUB_EN}}? [R=301,L]',
              '# 5. /xx/article.html without a slug (no such file) → that language\'s blog hub.',
              '#    The bare root /article.html (no slug) stays the reader page (200).']
    for lg in LANGS:
        if exists(f'/{lg}/article.html'): continue
        lines.append(f'RewriteRule ^{lg}/article\\.html$ {url(hub_rule(lg))}? [R=301,L]')
    return lines


def lang_hub_rules():
    lines = ['# /xx/stories/ without its own index → the EN stories hub; /xx/stories/S/ that only',
             '# exists as an EN or SK story → that story, else (languages without a stories hub)',
             '# → the EN hub. /stories/ itself is left to the hub page.']
    for lg in LANGS:
        lines += [f'RewriteCond %{{DOCUMENT_ROOT}}/{lg}/stories/index.html !-f',
                  f'RewriteRule ^{lg}/stories/?$ {HOST}%{{ENV:VB_HUB_EN}} [R=301,L]']
    for base in ('stories', 'sk/stories'):
        lines += [f'RewriteCond %{{DOCUMENT_ROOT}}/$1/stories/$2/index.html !-f',
                  f'RewriteCond %{{DOCUMENT_ROOT}}/{base}/$2/index.html -f',
                  f'RewriteRule ^({LANG_ALT})/stories/([a-z0-9-]+)/?$ {HOST}/{base}/$2/ [R=301,L]']
    nohub = [lg for lg in LANGS if not exists(f'/{lg}/stories/index.html')]
    lines += [f'RewriteCond %{{DOCUMENT_ROOT}}/$1/stories/$2 !-f',
              f'RewriteCond %{{DOCUMENT_ROOT}}/$1/stories/$2 !-d',
              f'RewriteRule ^({"|".join(nohub)})/stories/(.+)$ {HOST}%{{ENV:VB_HUB_EN}} [R=301,L]']
    lines.append('# /xx/blog.html where that language has none → its blog hub')
    for lg in LANGS:
        if not exists(f'/{lg}/blog.html'):
            lines.append(f'RewriteRule ^{lg}/blog\\.html$ {url(hub_rule(lg))} [R=301,L]')
    return lines


def cleanup_rules():
    """Story cleanup 2026-10-16 (stories-build/cleanup.json): duplicate story → its original,
    for the story URL and the old WordPress post URL (/<slug>/, /sk/<slug>/)."""
    c = json.load(open(os.path.join(ROOT, 'stories-build/cleanup.json'), encoding='utf-8'))
    lines = ['# Story cleanup 2026-10-16 (stories-build/cleanup.json): duplicate → original']
    for src, t in c['redirect'].items():
        assert exists('/' + t), t
        assert not exists('/' + src), ('still built', src)
        pre, slug = re.match(r'^((?:sk/)?)stories/([a-z0-9-]+)/$', src).groups()
        lines.append(f'RewriteRule ^{pre}stories/{rx(slug)}/?$ {url("/" + t)} [R=301,L]')
        lines.append(f'RewriteRule ^{pre}{rx(slug)}(?:/.*)?$ {url("/" + t)} [R=301,L]')
    return lines


def block():
    rows = read_map()
    ps = posts()
    names = set()
    for r in rows:
        lang, body, kind = parse(r['old_pattern'])
        if kind == 'name' and r['status'] == 'ready':
            for L in ([lang] if lang else [''] + LANGS):
                names.add((L + '/' if L else '') + r['old_pattern'].strip('/').split('/')[-1])
    prules, stats = post_rules(ps, names)
    lines = [BEGIN,
             '# Approved by Ras 13 Oct 2026 (HANDOVER-claude-seo-redirects.md): one 301 hop to a 200 page.',
             '# GENERATED by seo-ops/build_redirects.py from seo-ops/redirects-2026-10-13.csv,',
             '# seo-ops/wp-posts-inventory.csv and the site folder. Edit those and re-run; do not edit here.',
             '# Held rows (wait for Ras):']
    lines += [f'#   {r["old_pattern"]} → {r["target"]}: {r["note"]}' for r in rows if r['status'] == 'hold']
    lines += ['', '# Blog hubs: EN /stories/ once stories/index.html exists, else /blog.html; SK likewise /sk/stories/ or /blog-sk.html.',
              'RewriteRule ^ - [E=VB_HUB_EN:/blog.html,E=VB_HUB_SK:/blog-sk.html]',
              'RewriteCond %{DOCUMENT_ROOT}/stories/index.html -f',
              'RewriteRule ^ - [E=VB_HUB_EN:/stories/]',
              'RewriteCond %{DOCUMENT_ROOT}/sk/stories/index.html -f',
              'RewriteRule ^ - [E=VB_HUB_SK:/sk/stories/]', '']
    lines += cleanup_rules() + ['']
    lines += article_rules(ps) + ['']
    lines += ['# The table (all languages: /xx/<old>/ → /xx/<target> if it exists, else EN)']
    lines += table_rules(rows, wildcard=False) + ['']
    lines += ['# /xx/<EN seo-build path> → the localised guide (its hreflang), else the EN page']
    lines += seo_rules() + ['']
    lines += lang_hub_rules() + ['']
    lines += ['# Old WordPress posts (seo-ops/wp-posts-inventory.csv)'] + prules + ['']
    lines += ['# Wildcards from the table (after the posts, never on real files)']
    lines += table_rules(rows, wildcard=True)
    lines += [END]
    for l in lines: assert len(l.encode()) < 8000, l[:80]
    return '\n'.join(lines) + '\n', rows, ps, stats


def old_paths(rows, ps):
    """Every mapped path (+ language and slash-less variants) with its expected result."""
    out = []
    add = lambda p, code, t='': out.append(f'{p}\t{code}\t{t}')
    c = json.load(open(os.path.join(ROOT, 'stories-build/cleanup.json'), encoding='utf-8'))
    for src, t in c['redirect'].items():   # story cleanup 2026-10-16
        pre, slug = re.match(r'^((?:sk/)?)stories/([a-z0-9-]+)/$', src).groups()
        add('/' + src, 301, '/' + t)
        add(f'/{pre}{slug}/', 301, '/' + t)
    for r in rows:
        lang, body, kind = parse(r['old_pattern'])
        pat = r['old_pattern']
        if r['status'] != 'ready':
            continue
        if kind == 'contains': samples = ['/crude-oil-prices/', '/sk/heating-oil/']
        elif kind == 'prefix': samples = [pat.rstrip('*') + '-2/', pat.rstrip('*')]
        elif kind == 'regex': samples = ['/page/2/', '/sk/page/3/']
        elif kind == 'file': samples = [pat]
        else:
            base = pat.rstrip('/')
            samples = [base + '/', base]
            if not lang and not r['target'].startswith('http'):
                samples += [f'/{L}{base}/' for L in LANGS]
            if base in ('/blog', '/category'): samples += [base + '/page/2/', base + '/bitcoin/']
        for s in samples:
            m = re.match(rf'^/({LANG_ALT})/', s)
            add(s, 301, localise_static(r['target'], m.group(1) if m else ''))
    # seo-build: every country page for sk and de, the hubs for all languages
    for L in LANGS:
        for rel in ('bitcoin-tax/', 'bitcoin-tax/slovakia/', 'bitcoin-fee-index/'):
            add(f'/{L}/{rel}', 301, '')
    for d in sorted(os.listdir(os.path.join(SITE, 'bitcoin-tax'))):
        if os.path.isdir(os.path.join(SITE, 'bitcoin-tax', d)):
            add(f'/sk/bitcoin-tax/{d}/', 301, ''); add(f'/de/bitcoin-tax/{d}', 301, '')
    for L in LANGS:
        if os.path.exists(os.path.join(SITE, L, 'stories', 'index.html')):
            add(f'/{L}/stories/', 200, '')
        else:
            add(f'/{L}/stories/', 301, hub_static(''))
            add(f'/{L}/stories/no-such-story-xyz/', 301, hub_static(''))
        add(f'/{L}/blog/', 301, hub_static(L))
        add(f'/{L}/category/news/', 301, hub_static(L))
    add('/sk/blog.html', 301, hub_static('sk')); add('/it/blog.html', 301, hub_static(''))
    add('/de/stories/bitcoin-beat-the-war-november-still-gets-a-vote/', 301,
        '/stories/bitcoin-beat-the-war-november-still-gets-a-vote/')
    # WordPress posts: all RU, every SK/EN post with a story, a spread of the rest
    import random
    rnd = random.Random(13)
    for p in ps:
        if p['lang'] == 'ru':
            add('/' + p['path'] + '/', 301, p['story']); continue
    pre = lambda p: '/' if p['lang'] == 'en' else '/sk/'
    with_story = [p for p in ps if p['lang'] != 'ru' and p['story']]
    without = [p for p in ps if p['lang'] != 'ru' and not p['story']]
    for p in with_story:
        add(pre(p) + p['slug'] + '/', 301, p['story'])
    for p in rnd.sample(without, 40):
        add(pre(p) + p['slug'] + '/', 301, '')
    for p in rnd.sample(with_story, 10):
        add(pre(p) + p['slug'], 301, p['story'])
    for s in ('/heres-the-guaranteed-way-to-lose-all-your-money/', '/how-taoist-philosophy-deals-with-volatile-markets/',
              '/sk/odkial-pochadza-slovo-peniaze-ras-vasilisin/', '/sk/14013-2/', '/sk/10732/', '/sk/10099/',
              '/sk/9280/', '/12993-2/', '/10764/'):
        add(s, 301, '')
    # article.html samples
    for s, t in (
        ('/article.html?slug=bitcoin-beat-the-war-november-still-gets-a-vote', '/stories/bitcoin-beat-the-war-november-still-gets-a-vote/'),
        ('/article.html?slug=bitcoin-beat-the-war-november-still-gets-a-vote&lang=de', '/stories/bitcoin-beat-the-war-november-still-gets-a-vote/'),
        ('/de/article.html?slug=bitcoin-beat-the-war-november-still-gets-a-vote', '/stories/bitcoin-beat-the-war-november-still-gets-a-vote/'),
        ('/uk/article.html?slug=what-is-a-bitcoin-treasury&lang=uk', '/stories/what-is-a-bitcoin-treasury/'),
        ('/sk/article.html?slug=10-moralnych-dovodov-preco-vlastnit-bitcoin', '/sk/stories/10-moralnych-dovodov-preco-vlastnit-bitcoin/'),
        ('/article.html?slug=10-moralnych-dovodov-preco-vlastnit-bitcoin&lang=sk', '/sk/stories/10-moralnych-dovodov-preco-vlastnit-bitcoin/'),
        ('/fr/article.html?slug=no-such-story-xyz&lang=fr', hub_static('')),
        ('/sk/article.html?slug=no-such-story-xyz', hub_static('sk')),
        ('/article.html?slug=no-such-story-xyz', hub_static('')),
        ('/article.html?slug=no-such-story-xyz&lang=en', hub_static('')),
        ('/article.html?slug=no-such-story-xyz&lang=sk', hub_static('sk')),
        ('/article.html?slug=no-such-story-xyz&lang=ru', '/ru/stories/'),
        ('/article.html?slug=no-such-story-xyz&lang=de', hub_static('')),
        ('/de/article.html?slug=no-such-story-xyz', hub_static('')),
        ('/de/article.html?slug=no-such-story-xyz&lang=de', hub_static('')),
        ('/ru/article.html?slug=no-such-story-xyz', '/ru/stories/'),
        ('/ru/article.html?slug=%25d0%25bd%25d0%25b5%25d1%2582&lang=ru', '/ru/stories/'),
        ('/a/no-such-story-xyz', hub_static('')),
        ('/sk/a/no-such-story-xyz/', hub_static('sk')),
        ('/a/what-is-a-bitcoin-treasury', '/stories/what-is-a-bitcoin-treasury/'),
        ('/it/article.html?slug=what-is-a-bitcoin-treasury', '/stories/what-is-a-bitcoin-treasury/'),
    ):
        add(s, 301, t)
    for p in [p for p in ps if p['lang'] == 'ru'][:3]:
        dbl = p['raw'].replace('%', '%25')
        add(f'/ru/article.html?slug={dbl}&lang=ru', 301, p['story'])
        add(f'/article.html?slug={dbl}&lang=ru', 301, p['story'])
        add(f'/article.html?slug={p["raw"].upper()}&lang=ru', 301, p['story'])
    add('/article.html?slug=a-story-newer-than-the-last-build', 301, hub_static(''))
    add('/article.html', 200, '')
    # must stay 200 / 404
    for s in ('/', '/index.html', '/bots.html', '/blog-sk.html', '/blog.html', '/sk/about.html',
              '/stories/what-is-a-bitcoin-treasury/', '/sk/bitcoin-dane/slovensko/', '/bitcoin-tax/slovakia/',
              '/de/bitcoin-steuern/slowakei/', '/asset-returns.html', '/sitemap.xml'):
        add(s, 200, '')
    for s in ('/this-does-not-exist-xyz/', '/sk/this-does-not-exist-xyz/', '/de/nope.html', '/wp-login.php'):
        add(s, 404, '')
    seen, res = set(), []
    for l in out:
        k = l.split('\t')[0]
        if k not in seen: seen.add(k); res.append(l)
    return '# path\texpected_code\texpected_target (empty = any 200 page on the same host)\n' + '\n'.join(res) + '\n'


def main():
    blk, rows, ps, stats = block()
    s = open(HTACCESS, encoding='utf-8').read()
    if BEGIN in s:
        new = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END) + r'\n', lambda m: blk, s, flags=re.S)
    else:
        assert s.count(ANCHOR) == 1, 'legacy-exchange block not found'
        new = s.replace(ANCHOR, blk + '\n' + ANCHOR, 1)
    if 'blog.virtuse.com/$1' in new:
        print('WARNING: the catch-all to blog.virtuse.com is still in the file')
    op = old_paths(rows, ps)
    if '--check' in sys.argv:
        same = new == s and os.path.exists(OLDPATHS) and open(OLDPATHS, encoding='utf-8').read() == op
        print('up to date' if same else 'OUT OF DATE'); sys.exit(0 if same else 1)
    open(HTACCESS, 'w', encoding='utf-8').write(new)
    open(OLDPATHS, 'w', encoding='utf-8').write(op)
    n = sum(1 for l in blk.splitlines() if l.startswith('RewriteRule') and ' - [E=' not in l)
    print(f'{HTACCESS}: block {len(blk.splitlines())} lines, {n} redirect rules')
    print('posts:', {k: v for k, v in stats.items() if k != 'clash'}, 'covered by the table:', stats['clash'])
    print(f'{OLDPATHS}: {op.count(chr(10)) - 1} paths')


if __name__ == '__main__':
    main()
