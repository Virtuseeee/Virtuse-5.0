#!/usr/bin/env python3
"""Embeddable Asset Returns table (SEO handover, magnet item 3).

Writes asset-returns/embed/index.html: asset class returns, current year and annualized (USD).
The Bitcoin vs gold embed is built by build_embed() in bitcoin-vs-gold/build_bvg.py (live
since 7376bba3); this file follows its conventions: noindex, follow, own tight CSP, no GTM,
no cookie banner, no Cloudflare snippet (shown inside other sites), a "Source: Virtuse" link
back to the full page with utm_source=embed, English only. The tables are
pre-rendered from data/*.json at build time and refreshed in the browser from the same JSON
on raw.githubusercontent.com (the daily Actions commit it there), same-origin as fallback.

Also keeps the "Embed code" block on the 10 Asset Returns pages up to date
(i18n-tools/legacy/src/<lang>/asset-returns.html, between EMBED:START/END markers; strings
reused from fee-index/<lang>.json).

After a change: run this, then python3 i18n-tools/legacy/build_legacy.py asset-returns.html.
Production also needs the .htaccess frame exception for the path (seo-ops/virtuse.com.htaccess).
"""
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(os.path.dirname(HERE))
ORIGIN = 'https://virtuse.com'
RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/'
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']
MINUS = '−'

EMBEDS = {
    'ar': {
        'path': 'asset-returns/embed/index.html',
        'data': 'asset-returns.json',
        'page': 'asset-returns.html',
        'campaign': 'asset_returns',
        'title': 'Asset class returns',
        'og': '/og-cover.jpg',
        'height': 900,
    },
}

esc = html.escape


def pct(v):
    """+12.3% / −4.5%; one decimal under 100 %, none above."""
    if v is None:
        return '–'
    p = v * 100
    s = ('{:.0f}' if abs(p) >= 100 else '{:.1f}').format(abs(p))
    return ('+' if p > 0 else MINUS if p < 0 else '') + s + '%'


def date_en(iso):
    import datetime
    d = datetime.date.fromisoformat(iso)
    return '%d %s %d' % (d.day, d.strftime('%b'), d.year)


def ar_rows(d):
    rows = sorted(d['rows'], key=lambda r: -(r['returns'][-1] if r['returns'][-1] is not None else -9))
    return ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
        esc(r['name']), esc(r['ticker']), pct(r['returns'][-1]), pct(r['annualized'])) for r in rows)


def ar_head(d):
    return '<tr><th>Asset</th><th>Ticker</th><th>YTD %d</th><th>Per year since %d</th></tr>' % (d['ytdYear'], d['years'][0])


# Client-side refresh: the same rendering in JS (keep in step with the Python above).
JS = {
    'ar': r"""function head(d){return '<tr><th>Asset</th><th>Ticker</th><th>YTD '+d.ytdYear+'</th><th>Per year since '+d.years[0]+'</th></tr>';}
function rows(d){var r=d.rows.slice().sort(function(a,b){var x=a.returns[a.returns.length-1],y=b.returns[b.returns.length-1];return (y==null?-9:y)-(x==null?-9:x);});
return r.map(function(x){return '<tr><td>'+e(x.name)+'</td><td>'+e(x.ticker)+'</td><td>'+pct(x.returns[x.returns.length-1])+'</td><td>'+pct(x.annualized)+'</td></tr>';}).join('');}
function note(d){return '';}""",
}

COMMON_JS = r"""(function(){
function e(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function pct(v){if(v==null)return '–';var p=v*100,a=Math.abs(p),s=a>=100?a.toFixed(0):a.toFixed(1);return (p>0?'+':p<0?'−':'')+s+'%';}
var M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dt(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||'');return m?(+m[3])+' '+M[+m[2]-1]+' '+m[1]:'';}
__BODY__
function show(d){if(!d)return;document.getElementById('h').innerHTML=head(d);document.getElementById('b').innerHTML=rows(d);
var n=note(d);if(n)document.getElementById('n').textContent=n;document.getElementById('a').textContent=dt(d.asOf);}
function get(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}
if(window.fetch){get('__RAW__').catch(function(){return get('/data/__FILE__');}).then(show).catch(function(){});}
})();"""


def build_embed(key):
    c = EMBEDS[key]
    d = json.load(open(os.path.join(SITE, 'data', c['data']), encoding='utf-8'))
    head, rows = ar_head(d), ar_rows(d)
    note = ''
    utm = '?utm_source=embed&amp;utm_medium=referral&amp;utm_campaign=' + c['campaign']
    url = '%s/%s' % (ORIGIN, c['path'][:-len('index.html')])
    js = COMMON_JS.replace('__BODY__', JS[key]).replace('__RAW__', RAW + c['data']).replace('__FILE__', c['data'])
    out = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} embed</title>
<meta name="description" content="Embeddable Virtuse table: {lc}, total return in USD, updated daily. Attribution required.">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' https://raw.githubusercontent.com; img-src 'self'; base-uri 'none'; form-action 'none'">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="{url}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="{title} embed">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{origin}{og}">
<meta name="twitter:card" content="summary_large_image">
<style>
body {{ margin: 0; background: #08090a; color: #e6edf3; font: 14px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
.w {{ padding: 16px; }}
h1 {{ font-size: 16px; margin: 0 0 4px; }}
p {{ margin: 0 0 10px; color: #8b949e; font-size: 12px; }}
.tw {{ overflow-x: auto; }}
table {{ width: 100%; border-collapse: collapse; }}
th, td {{ text-align: left; padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,.08); white-space: nowrap; }}
th {{ color: #8b949e; font-weight: 600; font-size: 12px; }}
td + td, th + th {{ text-align: right; font-variant-numeric: tabular-nums; }}
a {{ color: #f7931a; }}
</style>
</head>
<body>
<div class="w">
  <h1>{title}</h1>
  <p>Total return in USD, distributions reinvested. As of <span id="a">{asof}</span>.</p>
  <div class="tw"><table><thead id="h">{head}</thead><tbody id="b">{rows}</tbody></table></div>
  <p id="n">{note}</p>
  <p>Source: <a href="{origin}/{page}{utm}" target="_blank" rel="noopener">Virtuse, {title}</a>. Past performance does not guarantee future results. Not investment advice.</p>
</div>
<script>
{js}
</script>
</body>
</html>
'''.format(title=c['title'], lc=c['title'][0].lower() + c['title'][1:], url=url, origin=ORIGIN, og=c['og'], asof=date_en(d['asOf']),
           head=head, rows=rows, note=esc(note), page=c['page'], utm=utm, js=js)
    if re.search('[–—]', re.sub(r'(?s)<script.*?</script>', '', out).replace('<td>–</td>', '')):
        raise SystemExit('dash in visible text of ' + c['path'])
    p = os.path.join(SITE, c['path'])
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(out)
    return c


def code_block(key, L):
    """Embed-code block for a full page in language L (strings from fee-index/<L>.json)."""
    c = EMBEDS[key]
    t = json.load(open(os.path.join(HERE, '..', 'fee-index', '%s.json' % L), encoding='utf-8'))
    src = '/' + c['path'][:-len('index.html')]
    code = esc('<iframe src="%s%s" title="Virtuse: %s" width="100%%" height="%d" loading="lazy" '
               'referrerpolicy="no-referrer-when-downgrade" style="border:0"></iframe>' % (ORIGIN, src, c['title'], c['height']))
    return t, src, code


AR_START, AR_END = '<!-- EMBED:START -->', '<!-- EMBED:END -->'
AR_CSS = ('.ar-embed { max-width: 1200px; margin: 0 auto 48px; padding: 0 48px; }'
          '.ar-embed h2 { font-size: 22px; margin: 0 0 8px; }'
          '.ar-embed pre { white-space: pre-wrap; word-break: break-all; background: #141414; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 12px 14px; font-size: 12px; color: #e6edf3; }'
          '@media (max-width: 768px) { .ar-embed { padding: 0 24px; } }')


def patch_asset_returns(L):
    p = os.path.join(HERE, '..', 'legacy', 'src', L, 'asset-returns.html')
    s = open(p, encoding='utf-8').read()
    t, src, code = code_block('ar', L)
    block = ('%s\n<section class="ar-embed"><style>%s</style><h2>%s</h2><p class="ar-note">%s</p><pre>%s</pre>'
             '<p class="ar-note"><a href="%s">%s →</a></p></section>\n%s' % (
                 AR_START, AR_CSS, esc(t['embed_h']), esc(t['embed_intro']), code, src, esc(t['btn_embed']), AR_END))
    if AR_START in s:
        s2 = re.sub(re.escape(AR_START) + r'.*?' + re.escape(AR_END), lambda m: block, s, flags=re.S)
    else:
        anchor = '\n<!-- ===== NEWSLETTER ===== -->'
        if s.count(anchor) != 1:
            raise SystemExit('newsletter anchor not found once in ' + p)
        s2 = s.replace(anchor, '\n' + block + anchor, 1)
    if s2 != s:
        with open(p, 'w', encoding='utf-8') as f:
            f.write(s2)
        return True
    return False


def main():
    for k in EMBEDS:
        print('wrote', build_embed(k)['path'])
    changed = [L for L in LANGS if patch_asset_returns(L)]
    print('asset-returns src updated:', changed or 'none')


if __name__ == '__main__':
    main()
