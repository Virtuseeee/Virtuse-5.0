#!/usr/bin/env python3
"""Build bitcoin-data.html (live dashboard, design v2) for one or more languages.

usage: python3 build_bitcoin_data.py en [sk cs ...]   (texts: <lang>.json next to this file)
Live values are filled by btc-data.js (mempool.space + CoinGecko, asset-returns.json for the
macro teaser); the page only carries labels, empty slots and the strings the script needs.
"""
import html, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import v2common as C

AR_RAW = 'https://raw.githubusercontent.com/Virtuseeee/Virtuse-5.0/main/Kimi_Agent_Virtuse%2520MiCA%2520Partners/data/asset-returns.json'
SKEL = '<span class="sk" aria-hidden="true"></span>'


def build(L):
    T = json.load(open(os.path.join(HERE, L + '.json')))
    t = lambda k: T[k]
    page_path, home_path, root = C.paths(L, 'bitcoin-data.html')
    old, home = open(page_path).read(), open(home_path).read()
    head = C.head(L, old, home, root)
    head = head.replace("connect-src 'self'", "connect-src 'self' https://raw.githubusercontent.com", 1)
    nav, foot = C.chrome(home, 'bitcoin-data.html')
    # this page lives under Learn, not Services
    nav = nav.replace('<div class="nav-group current" id="ng-services">', '<div class="nav-group" id="ng-services">')
    nav = nav.replace('<div class="nav-group" id="ng-learn">', '<div class="nav-group current" id="ng-learn">')
    cur = 'USD' if L == 'en' else 'EUR'
    fees = '/bitcoin-fee-index/' if L == 'en' else '/%s/%s/' % (L, C.B.GUIDES[L][1])
    i18n = {k: T[k] for k in ('updated', 'your_time', 'stale', 'unavailable', 'retry', 'n_block_ago', 'n_unknown', 's_halving_sub',
                              'p_chart', 'p_sats', 'p_sats_eur', 'u_s', 'u_min', 'u_h', 'u_days', 'u_years')}
    i18n.update(locale=C.B.LOCALE.get(L, 'en-US'), pct=' %' if L in C.PCT_SPACE else '%', cur=cur, raw=AR_RAW, local=root + 'data/asset-returns.json')
    i18n = {k: (v if not isinstance(v, str) else html.unescape(v)) for k, v in i18n.items()}  # the script sets textContent

    def card(key, label, sub='', cls=''):
        return '<div class="bd-m %s" data-k="%s"><span class="bd-l">%s</span><b class="bd-v">%s</b>%s</div>' % (
            cls, key, label, SKEL, ('<span class="bd-s" data-s="%s">%s</span>' % (key, sub)) if sub is not None else '')

    def links(label, items):
        return '<p class="bd-links"><span>%s</span> %s</p>' % (label, ' · '.join('<a href="%s">%s</a>' % (h, n) for h, n in items))

    def src(group, names):
        return '<p class="bd-src" data-g="%s"><i class="bd-dot"></i><span class="bd-time"></span> · %s %s <button type="button" class="bd-retry" hidden>%s</button></p>' % (
            group, t('sources'), names, t('retry'))

    mp = '<a href="https://mempool.space" target="_blank" rel="noopener noreferrer">mempool.space</a>'
    cg = '<a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer">CoinGecko</a>'
    bn = '<a href="https://www.binance.com" target="_blank" rel="noopener noreferrer">Binance</a> (%s)' % t('fallback')

    keys = '''<div class="bd-keys" data-g="price net">
      <div class="bd-m bd-key bd-price" data-k="price"><span class="bd-l">{k_price}
        <span class="bd-cur" role="group" aria-label="USD / EUR"><button type="button" data-cur="USD">USD</button><button type="button" data-cur="EUR">EUR</button></span></span>
        <b class="bd-v">{sk}</b><span class="bd-s"><em class="bd-chg" data-k="chg"></em> {k_24h}</span></div>
      {height}{fee}{hash}
    </div>'''.format(k_price=t('k_price'), sk=SKEL, k_24h=t('k_24h'),
                     height=card('height', t('k_height'), t('k_height_sub'), 'bd-key'),
                     fee=card('fee', t('k_fee'), t('k_fee_sub'), 'bd-key'),
                     hash=card('hash', t('k_hash'), t('k_hash_sub'), 'bd-key'))

    market = '''<div class="bd-grid bd-market">
      <div class="bd-card bd-chartcard">
        <div class="bd-chead"><span class="bd-l" id="bdChartLbl">{chart}</span><span class="seg bd-range" role="group"><button type="button" class="seg-btn" data-days="30">{p30}</button><button type="button" class="seg-btn on" data-days="90">{p90}</button></span></div>
        <svg class="bd-spark" id="bdSpark" viewBox="0 0 600 160" preserveAspectRatio="none" aria-hidden="true"><path id="bdArea" fill="url(#bdFill)"/><path id="bdLine" fill="none" stroke="#f7931a" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><defs><linearGradient id="bdFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7931a" stop-opacity=".28"/><stop offset="1" stop-color="#f7931a" stop-opacity="0"/></linearGradient></defs></svg>
        <div class="bd-axis"><span id="bdMin"></span><span id="bdMax"></span></div>
      </div>
      <div class="bd-stack">{mcap}{sats}</div>
    </div>
    {src}
    {links}'''.format(chart=t('p_chart').replace('{n}', '90'), p30=t('p_30'), p90=t('p_90'),
                      mcap=card('mcap', t('p_mcap'), t('p_mcap_sub')), sats=card('sats', t('p_sats_eur' if cur == 'EUR' else 'p_sats'), None),
                      src=src('price', mp + ' · ' + cg + ' · ' + bn),
                      links=links(t('p_links'), [('btc-monthly-returns.html', t('c_monthly')), ('trading-volume.html', t('c_volume')), ('fear-greed.html', t('c_fear'))]))

    net = '''<div class="bd-grid bd-net">
      {diff}
      <div class="bd-card bd-adj"><span class="bd-l">{n_adj}</span><b class="bd-v" data-k="adj">{sk}</b>
        <div class="bd-bar"><i data-k="adjbar"></i></div>
        <dl><div><dt>{n_adj_progress}</dt><dd data-k="adjpct">{sk}</dd></div><div><dt>{n_adj_left}</dt><dd data-k="adjleft">{sk}</dd></div><div><dt>{n_adj_date}</dt><dd data-k="adjdate">{sk}</dd></div></dl></div>
      <div class="bd-card bd-block"><span class="bd-l">{n_block}</span><b class="bd-v" data-k="bheight">{sk}</b><span class="bd-s" data-k="bago"></span>
        <dl><div><dt>{n_block_tx}</dt><dd data-k="btx">{sk}</dd></div><div><dt>{n_block_size}</dt><dd data-k="bsize">{sk}</dd></div><div><dt>{n_block_miner}</dt><dd data-k="bminer">{sk}</dd></div></dl></div>
      <div class="bd-card bd-fees"><span class="bd-l">{n_fees}</span>
        <dl><div><dt>{n_fee_fast}</dt><dd data-k="ffast">{sk}</dd></div><div><dt>{n_fee_30}</dt><dd data-k="f30">{sk}</dd></div><div><dt>{n_fee_60}</dt><dd data-k="f60">{sk}</dd></div><div><dt>{n_fee_min}</dt><dd data-k="fmin">{sk}</dd></div></dl></div>
    </div>
    {src}
    {links}'''.format(diff=card('diff', t('n_diff'), t('n_diff_sub'), 'bd-card'), n_adj=t('n_adj'), sk=SKEL, n_adj_progress=t('n_adj_progress'),
                      n_adj_left=t('n_adj_left'), n_adj_date=t('n_adj_date'), n_block=t('n_block'), n_block_tx=t('n_block_tx'),
                      n_block_size=t('n_block_size'), n_block_miner=t('n_block_miner'), n_fees=t('n_fees'), n_fee_fast=t('n_fee_fast'),
                      n_fee_30=t('n_fee_30'), n_fee_60=t('n_fee_60'), n_fee_min=t('n_fee_min'), src=src('net', mp),
                      links=links(t('n_links'), [('mining.html', t('n_link_mining')), (fees, t('n_link_fees'))]))

    supply = '''<div class="bd-grid bd-supply">
      <div class="bd-card"><span class="bd-l">{s_supply}</span><b class="bd-v" data-k="supply">{sk}</b><span class="bd-s">{s_supply_sub}</span>
        <div class="bd-bar"><i data-k="supbar"></i></div><span class="bd-s"><b data-k="suppct"></b> {s_issued}</span></div>
      <div class="bd-card"><span class="bd-l">{s_halving}</span><b class="bd-v" data-k="halving">{sk}</b><span class="bd-s" data-k="halvsub"></span></div>
    </div>
    {src}
    {links}'''.format(s_supply=t('s_supply'), sk=SKEL, s_supply_sub=t('s_supply_sub'), s_issued=t('s_issued'), s_halving=t('s_halving'),
                      src=src('supply', mp),
                      links=links(t('s_links'), [('rainbow-chart.html', t('c_rainbow')), ('ma-200w.html', t('c_wma')), ('root-cycles.html', t('c_root'))]))

    macro = '''<div class="bd-macro" data-g="macro">
      {tiles}
    </div>
    <p class="bd-note">{note}</p>
    <a class="hp-cta" href="asset-returns.html">{cta} <span aria-hidden="true">→</span></a>'''.format(
        tiles=''.join('<div class="bd-m" data-k="ytd-%s"><span class="bd-l">%s</span><b class="bd-v">%s</b></div>' % (tk, t(k), SKEL)
                      for tk, k in (('BTC', 'm_btc'), ('GLD', 'm_gold'), ('SPY', 'm_spx'), ('BND', 'm_bonds'))),
        note=t('m_note'), cta=t('m_cta'))

    charts = [('btc-monthly-returns.html', 'c_monthly'), ('asset-returns.html', 'c_assets'), ('trading-volume.html', 'c_volume'), ('fear-greed.html', 'c_fear'),
              ('rainbow-chart.html', 'c_rainbow'), ('ma-200w.html', 'c_wma'), ('root-cycles.html', 'c_root'), ('btc-dominance.html', 'c_dom')]
    grid = ''.join('<a class="bd-chart" href="%s"><b>%s</b><span>%s</span><i aria-hidden="true">%s</i></a>' % (h, t(k), t(k + '_p'), C.ARROW) for h, k in charts)
    grid += '<a class="bd-chart bd-tool" href="retirement-calculator.html"><em>%s</em><b>%s</b><span>%s</span><i aria-hidden="true">%s</i></a>' % (
        t('c_tool'), t('c_retire'), t('c_retire_p'), C.ARROW)

    body = '''<body class="page-buy page-data no-split">
{nav}

<main class="wrap" id="top">

  <!-- 1. HERO + key metrics -->
  <div class="buy-hero2">
    <div class="eyebrow"><i></i>{eyebrow}</div>
    <h1>{h1} <span class="h1-grey">{h1g}</span></h1>
    <p class="sp-lead">{lead}</p>
    {keys}
    <p class="bd-src bd-src-top" data-g="price net"><i class="bd-dot"></i><span class="bd-time">{loading}</span> · {sources} {mp} · {cg}</p>
  </div>

  <section id="market">
    <div class="sec-head one"><div class="sec-copy"><h2>{ph2a} <span>{ph2b}</span></h2></div></div>
    {market}
  </section>

  <section id="network">
    <div class="sec-head one"><div class="sec-copy"><h2>{nh2a} <span>{nh2b}</span></h2></div></div>
    {net}
  </section>

  <section id="supply">
    <div class="sec-head one"><div class="sec-copy"><h2>{sh2a} <span>{sh2b}</span></h2></div></div>
    {supply}
  </section>

  <section id="macro">
    <div class="sec-head one"><div class="sec-copy"><h2>{mh2a} <span>{mh2b}</span></h2></div></div>
    {macro}
  </section>

  <section id="charts">
    <div class="sec-head one"><div class="sec-copy"><h2>{ch2a} <span>{ch2b}</span></h2></div></div>
    <div class="bd-charts">{grid}</div>
  </section>

  {brief}
  <p class="bd-disclaimer">{disclaimer}</p>

  {foot}
</main>
<script type="application/json" id="bdI18n">{i18n}</script>
<script src="{root}btc-data.js?v=1" defer></script>
'''.format(nav=nav, eyebrow=t('eyebrow'), h1=t('h1'), h1g=t('h1_grey'), lead=t('lead'), keys=keys, loading=t('loading'), sources=t('sources'),
           mp=mp, cg=cg, ph2a=t('p_h2_a'), ph2b=t('p_h2_b'), market=market, nh2a=t('n_h2_a'), nh2b=t('n_h2_b'), net=net,
           sh2a=t('s_h2_a'), sh2b=t('s_h2_b'), supply=supply, mh2a=t('m_h2_a'), mh2b=t('m_h2_b'), macro=macro,
           ch2a=t('c_h2_a'), ch2b=t('c_h2_b'), grid=grid, brief=C.brief(L, t, root, 'data_brief'), disclaimer=t('disclaimer'),
           foot=foot, i18n=json.dumps(i18n, ensure_ascii=False).replace('</', '<\\/'), root=root)
    out = C.fix_links(L, head + body + C.scripts(root))
    open(page_path, 'w').write(out)
    print('%s: %d bytes' % (L, len(out)))


if __name__ == '__main__':
    for L in sys.argv[1:]:
        build(L)
