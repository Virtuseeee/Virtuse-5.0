#!/usr/bin/env python3
"""Build the Creators page (creators.html, sk/creators.html), Virtuse Creators phase 1.

usage: python3 build_creators.py [en sk]     (texts: <lang>.json next to this file)

Static HTML on the v2 shell, modelled on about/build_about.py: head from the Fee Index helpers
(F.head, BreadcrumbList only), nav/footer/Brief card from the language's homepage, C.finalize().
Sections: hero, 1 embed kit (three live embeds with copy-ready code), 2 write for the Brief,
3 ecosystem listing, 4 Verdict (coming), what we ask, apply (mailto until the Worker form exists),
Brief card. Also keeps the page's <url> block in sitemap.xml (markers CREATORS:START/END).

Texts: EN from the phase 1 handover, word for word. sk.json carries "_todo": "translate" until
the Slovak copy is filled in; do not translate here. The embeds themselves stay English.
"""
import html, json, os, re, sys, datetime, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(TOOLS, 'fee-index'))
sys.path.insert(0, os.path.join(TOOLS, 'embeds'))
import build_fee_index as F
import build_embeds as E
C, SITE, ORIGIN = F.C, F.SITE, F.ORIGIN
LANGS = ['en', 'sk']
PAGE = 'creators.html'
APPLY_TO = 'info@virtuse.com'

# One source of truth for the embed heights in the kit. Fee Index and Bitcoin vs Gold write the
# same height into their own pages' code (asserted in check_heights); Asset Returns is read
# from build_embeds.py, which also writes it into asset-returns.html.
KIT = [
    {'id': 'fee-index', 'title': 'Bitcoin Fee Index', 'src': '/bitcoin-fee-index/embed/', 'height': 320,
     'page': '/bitcoin-fee-index/', 'page_name': 'Virtuse Bitcoin Fee Index',
     'builder': ('fee-index', 'build_fee_index.py'), 'acc': 'orange'},
    {'id': 'bitcoin-vs-gold', 'title': 'Bitcoin vs gold, silver and oil', 'src': '/bitcoin-vs-gold/embed/', 'height': 460,
     'page': '/bitcoin-vs-gold.html', 'page_name': 'Virtuse, Bitcoin vs gold, silver and oil',
     'builder': ('bitcoin-vs-gold', 'build_bvg.py'), 'acc': 'yellow'},
    {'id': 'asset-returns', 'title': 'Asset class returns', 'src': '/asset-returns/embed/', 'height': E.EMBEDS['ar']['height'],
     'page': '/asset-returns.html', 'page_name': 'Virtuse, Asset class returns',
     'builder': None, 'acc': 'blue'},
]

CSS = '''<style>
/* CREATORS (page-creators) */
.cr-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.cr-cards .pcard2 h3 { font-size: 20px; font-weight: 700; margin: 0; }
.cr-kit { display: grid; gap: 20px; }
.cr-item { background: var(--card); border-radius: 16px; padding: 22px 24px; min-width: 0; }
.cr-item h3 { font-size: 18px; font-weight: 600; margin: 0 0 12px; }
.cr-item iframe { display: block; width: 100%; border: 0; border-radius: 10px; background: #08090a; }
.cr-code { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; }
.cr-code textarea { flex: 1; min-width: 0; height: 74px; resize: vertical; background: #141414; color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font: 12px/1.5 var(--mono); white-space: pre-wrap; word-break: break-all; }
.cr-code button { flex: none; }
.cr-note { margin: 14px 0 0; font-size: 14px; color: var(--muted); }
.cr-shots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.cr-shot { background: var(--card); border-radius: 16px; padding: 14px; min-width: 0; display: grid; gap: 8px; font-size: 14px; }
.cr-shot img { display: block; width: 100%; height: auto; border-radius: 10px; }
.cr-shot span { color: var(--muted); }
.cr-shot a { color: var(--text); }
.cr-intro { font-size: 17px; color: var(--muted); max-width: 760px; margin: 0 0 24px; line-height: 1.6; }
.cr-rules { margin: 0; padding: 0 0 0 20px; display: grid; gap: 10px; font-size: 17px; line-height: 1.6; max-width: 760px; }
.cr-apply { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: var(--card); border: 1px solid var(--line-strong); border-radius: 16px; padding: 22px 24px; }
.cr-apply p { margin: 0; color: var(--muted); font-size: 15px; min-width: 0; }
@media (max-width: 900px) { .cr-cards { grid-template-columns: minmax(0, 1fr); } .cr-shots { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .cr-item { padding: 16px; }
  .cr-code { flex-direction: column; align-items: stretch; }
  .cr-apply { flex-direction: column; align-items: stretch; text-align: center; }
}
</style>
'''

# Copy button: Clipboard API, falls back to selecting the textarea; label shows "copied" for 2 s.
JS = '''<script>
(function(){
  document.querySelectorAll('[data-copy]').forEach(function(b){
    b.addEventListener('click', function(){
      var ta = document.getElementById(b.getAttribute('data-copy')), label = b.textContent;
      function done(){ b.textContent = b.getAttribute('data-copied'); setTimeout(function(){ b.textContent = label; }, 2000); }
      function fallback(){ ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (e) {} done(); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, fallback); else fallback();
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({event: 'creators_embed_copy', embed: b.getAttribute('data-embed')});
    });
  });
})();
</script>
'''


def url(L):
    return '/' + PAGE if L == 'en' else '/%s/%s' % (L, PAGE)


def esc(s):
    return html.escape(s, quote=True)


def check_heights():
    """The kit and the source pages must show the same embed height."""
    for k in KIT:
        if not k['builder']:
            continue
        src = open(os.path.join(TOOLS, k['builder'][0], k['builder'][1]), encoding='utf-8').read()
        if not re.search(r'%s[^\n]*height="%d"' % (re.escape(k['src']) if k['id'] == 'fee-index' else '', k['height']), src):
            sys.exit('%s: height %d not found in %s, update KIT' % (k['id'], k['height'], k['builder'][1]))


def embed_code(k):
    return ('<iframe src="%s%s" title="Virtuse: %s" width="100%%" height="%d" loading="lazy" '
            'referrerpolicy="no-referrer-when-downgrade" style="border:0"></iframe>\n'
            '<p>Source: <a href="%s%s">%s</a></p>') % (ORIGIN, k['src'], k['title'], k['height'], ORIGIN, k['page'], k['page_name'])


def kit_html(t, ft):
    items = []
    for k in KIT:
        tid = 'cr-code-' + k['id']
        items.append('''<div class="cr-item acc-{acc} glow">
      <h3>{title}</h3>
      <iframe src="{src}" title="{title}" height="{h}" loading="lazy"></iframe>
      <div class="cr-code"><label for="{tid}" style="position:absolute;left:-9999px">{lbl}</label><textarea id="{tid}" readonly spellcheck="false">{code}</textarea>
        <button type="button" class="btn btn-ghost" data-copy="{tid}" data-copied="{copied}" data-embed="{id}">{copy}</button></div>
    </div>'''.format(acc=k['acc'], title=esc(k['title']), src=k['src'], h=k['height'], tid=tid, lbl=esc(ft['embed_h']),
                     code=esc(embed_code(k)), copied=esc(t['copied']), id=k['id'], copy=esc(t['copy_btn'])))
    return '\n    '.join(items)


KIT_IMAGES = [('btc-vs-gold', 'kit_gold_eye'), ('asset-returns', 'kit_ar_eye'), ('fee-index', 'kit_fee_eye'), ('monthly-returns', 'kit_mr_eye')]


def share_kit(t, L):
    """Download cards for the 16 images rendered by render_kit.py (the page's own language)."""
    suf = '' if L == 'en' else '-' + L
    cards = []
    for name, key in KIT_IMAGES:
        sq, wd = '/creators/kit/%s%s-1080x1080.jpg' % (name, suf), '/creators/kit/%s%s-1200x675.jpg' % (name, suf)
        for f in (sq, wd):
            if not os.path.exists(os.path.join(SITE, f.lstrip('/'))):
                sys.exit('%s missing: run render_kit.py first' % f)
        cards.append('<div class="cr-shot"><img src="{sq}" width="1080" height="1080" alt="{alt}" loading="lazy">'
                     '<b>{alt}</b><span><a href="{sq}" download>{s}</a> · <a href="{wd}" download>{w}</a></span></div>'.format(
                         sq=sq, wd=wd, alt=esc(t[key]), s=esc(t['kit_square']), w=esc(t['kit_wide'])))
    return ''.join(cards)


def check_own(out, t, where):
    """No en/em dash in our text, title or meta (shared nav/footer are the homepage's)."""
    own = re.sub(r'<header class="nav">.*?</header>|<footer\b.*?</footer>|<script\b.*?</script>|<style\b.*?</style>', '', out, flags=re.S)
    for ch in ('—', '–', '&mdash;', '&ndash;'):
        if ch in own or any(ch in v for k, v in t.items() if not k.startswith('_')):
            sys.exit('%s: dash %r in page text, meta or texts' % (where, ch))


def build(L):
    jf = os.path.join(HERE, L + '.json')
    if not os.path.exists(jf):
        print('%s: no %s.json, skipped' % (L, L))
        return
    t = json.load(open(jf, encoding='utf-8'))
    Bt = json.load(open(os.path.join(TOOLS, 'bots', L + '.json'), encoding='utf-8'))
    t.update({x: v for x, v in Bt.items() if x.startswith('b_') or x == 'email'})
    ft = json.load(open(os.path.join(TOOLS, 'fee-index', L + '.json'), encoding='utf-8'))
    page = url(L)
    shell = os.path.join(SITE, page.lstrip('/'))
    home = '/' if L == 'en' else '/%s/' % L

    alts = [(x, url(x)) for x in LANGS] + [('x-default', url('en'))]
    ld = {'@context': 'https://schema.org', '@graph': [F.crumbs_ld([(t['crumb_home'], home), (t['crumb_page'], page)])]}
    out = F.head(L, t['title'], t['description'], page, alts, ld, og_image=ORIGIN + '/og-cover.jpg')
    out = out.replace('</head>', CSS + '</head>', 1)
    # Language menu: EN and SK have this page; the other eight go to their own homepage.
    menu_url = lambda x: url(x) if x in LANGS else '/%s/' % x
    nav, foot = F.chrome(L, menu_url, comma=False)

    card = lambda n: '<div class="pcard2 teal"><h3>%s</h3><p>%s</p></div>' % (t['s%d_h' % n], t['s%d_p' % n])
    mailto = 'mailto:%s?subject=%s' % (APPLY_TO, urllib.parse.quote(t['apply_subject']))

    out += '''<body class="page-buy page-fee page-pf page-creators no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO -->
  <div class="buy-hero2 pf-hero">
    <h1>{h1}</h1>
    <p class="sp-lead">{lead}</p>
  </div>

  <!-- 2. EMBED OUR DATA (kit) -->
  <section id="embed">
    <div class="sec-head one"><div class="sec-copy"><h2>{s1h}</h2></div></div>
    <p class="cr-intro">{s1p} {intro}</p>
    <div class="cr-kit">
    {kit}
    </div>
    <p class="cr-note">{elang}</p>
  </section>

  <!-- 2b. SHARE KIT (images from render_kit.py) -->
  <section id="share">
    <div class="sec-head one"><div class="sec-copy"><h2>{kh}</h2></div></div>
    <p class="cr-intro">{kp}</p>
    <div class="cr-shots">{shots}</div>
  </section>

  <!-- 3. WRITE, GET LISTED, EARN -->
  <section id="work">
    <div class="cr-cards">{c2}{c3}{c4}</div>
  </section>

  <!-- 4. WHAT WE ASK -->
  <section id="rules">
    <div class="sec-head one"><div class="sec-copy"><h2>{rh}</h2></div></div>
    <ul class="cr-rules"><li>{r1}</li><li>{r2}</li><li>{r3}</li></ul>
  </section>

  <!-- 5. APPLY -->
  <section id="apply">
    <div class="cr-apply acc-teal glow"><p>{note}</p><a class="btn btn-primary" href="{mailto}" data-cta="creators_apply">{cta}</a></div>
  </section>

  <!-- 6. BRIEF -->
  {brief}

  {foot}
</main>

'''.format(nav=nav, h1=t['h1'], lead=t['lead'], s1h=t['s1_h'], s1p=t['s1_p'], intro=ft['embed_intro'], kit=kit_html(t, ft),
           elang=t['embeds_lang'], kh=t['kit_h'], kp=t['kit_p'], shots=share_kit(t, L), c2=card(2), c3=card(3), c4=card(4), rh=t['rules_h'], r1=t['rules_1'], r2=t['rules_2'],
           r3=t['rules_3'], note=t['cta_note'], mailto=mailto, cta=t['cta'], brief=F.brief_card(L, t, 'creators_brief'), foot=foot)
    out += JS + C.scripts('/')
    F.check_text(out, L)
    check_own(out, t, L)
    assert out.count("'GTM-KXX4Q6WH'") == 1, L
    open(shell, 'w', encoding='utf-8').write(C.finalize(out, shell))
    print('%-20s %6d bytes' % (page, len(out)))


def sitemap():
    """One <url> per language with en/sk/x-default alternates, inside CREATORS markers (before TOOLS)."""
    sys.path.insert(0, os.path.join(os.path.dirname(SITE), 'seo-ops'))
    from sitemap_lastmod import lastmod_for
    sm = os.path.join(SITE, 'sitemap.xml'); s = open(sm, encoding='utf-8').read()
    today = datetime.date.today().isoformat()
    full = lambda l: ORIGIN + url(l)
    old = re.search(r'<!-- CREATORS:START -->.*?<!-- CREATORS:END -->\n', s, re.S)
    prev = dict(re.findall(r'<loc>([^<]+)</loc>\n    <lastmod>([^<]+)</lastmod>', old.group(0))) if old else {}
    alts = ''.join('\n    <xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (l, full(l)) for l in LANGS)
    alts += '\n    <xhtml:link rel="alternate" hreflang="x-default" href="%s"/>' % full('en')
    rows = ['<!-- CREATORS:START -->']
    for l in LANGS:
        u = full(l)
        rows.append('  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>%s\n  </url>' % (
            u, lastmod_for(url(l).lstrip('/')) or prev.get(u, today), alts))
    rows.append('<!-- CREATORS:END -->\n')
    block = '\n'.join(rows)
    n = s[:old.start()] + block + s[old.end():] if old else s.replace('<!-- TOOLS:START -->', block + '<!-- TOOLS:START -->', 1)
    if n != s:
        open(sm, 'w', encoding='utf-8').write(n); print('updated sitemap.xml')


def main():
    check_heights()
    for L in sys.argv[1:] or LANGS:
        build(L)
    sitemap()


if __name__ == '__main__':
    main()
