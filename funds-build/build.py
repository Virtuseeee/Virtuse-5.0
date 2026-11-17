#!/usr/bin/env python3
"""Build data/funds-vs-bitcoin.json for funds-vs-bitcoin.html / sk/fondy-vs-bitcoin.html.

Phase 1: every second-pillar pension fund (starobné dôchodkové sporenie) vs Bitcoin, in euros.

usage:  python3 -m venv /tmp/fvb && /tmp/fvb/bin/pip install pypdf
        /tmp/fvb/bin/python funds-build/build.py [--adss YY_MM_DD]

Sources (all official and public, every value in the output carries its source and date):
  - fund list, returns 1y / 5y p.a. / 10y p.a., unit value, NAV: the weekly ADSS report PDF
    (https://www.adss.sk/zhodnotenie-vo-fondoch -> https://adss.m7.sk/storage/adss_YY_MM_DD.pdf)
  - daily unit values for drawdown and volatility: NBS automated download
    (https://nbs.sk/wp-json/nbs/v1/dsw/download, ZIP of CSV, cp1250), fund mergers from its
    dsw_subject_union.csv
  - management fee cap: Act 43/2004 Coll. § 63a(3), version in force from 1 Aug 2026 (slov-lex)
  - inflation: HICP Slovakia, all items, index 2025=100 (Eurostat prc_hicp_minr; compiled by
    the Statistical Office of the Slovak Republic). The ŠÚ SR site refuses automated reads.
  - Bitcoin: CoinMetrics community PriceUSD (daily) / ECB EUR-USD reference rate (Frankfurter),
    the same sources as data/btc-monthly-returns.json.

Nothing is estimated. A value that cannot be taken or computed from these sources is
{"value": null, "status": "n/a", "reason": ...}.
"""
import csv, datetime as D, io, json, math, os, re, subprocess, sys, zipfile

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners')
OUT = os.path.join(SITE, 'data', 'funds-vs-bitcoin.json')
UA = {'User-Agent': 'Mozilla/5.0 (Virtuse data build)'}
DEFAULT_REPORT = '26_11_06'

ADSS_PAGE = 'https://www.adss.sk/zhodnotenie-vo-fondoch'
NBS_PAGE = ('https://nbs.sk/dohlad-nad-financnym-trhom-prakticke-informacie/publikacie-a-vybrane-udaje/vybrane-udaje/'
            'aktualna-hodnota-dochodkovej-jednotky-a-cista-hodnota-majetku-v-dochodkovom-fonde/vyvoj-aktualnej-hodnoty-dss1/')
NBS_ZIP = 'https://nbs.sk/wp-json/nbs/v1/dsw/download'
LAW = 'https://static.slov-lex.sk/static/SK/ZZ/2004/43/20260801.html'
HICP = ('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr'
        '?geo=SK&coicop18=TOTAL&unit=I25&sinceTimePeriod=2015-09')
HICP_PAGE = 'https://ec.europa.eu/eurostat/databrowser/view/prc_hicp_minr/default/table'
CM = ('https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD'
      '&frequency=1d&start_time=2015-09-01&end_time={end}&page_size=10000')
CM_PAGE = 'https://docs.coinmetrics.io/asset-metrics/market/priceusd'
FX = 'https://api.frankfurter.app/2015-09-01..{end}?from=EUR&to=USD'
FX_PAGE = 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html'

# NBS dsw_subject_union.csv, 01.11.2019: AEGON INDEX (S0204120053, founded 24.04.2012) -> NN Index Global
# (S0410190001). ADSS lists Index Global with the founding date 24.04.2012, i.e. the same history.
PRED = {'S0410190001': 'S0204120053'}
WEEKS_10Y = 10


def get(url, binary=False):
    # curl, not urllib: some Python builds lack the CA chain Eurostat uses
    b = subprocess.run(['curl', '-sSfL', '-m', '300', '-A', UA['User-Agent'], url], capture_output=True, check=True).stdout
    return b if binary else b.decode('utf-8')


def obj(value, unit, source, label, as_of, **kw):
    if isinstance(value, float):
        value = round(value, 8)
    d = {'value': value, 'unit': unit, 'source': source, 'sourceLabel': label, 'asOf': as_of}
    d.update(kw)
    return d


def na(reason, source, as_of, **kw):
    d = {'value': None, 'status': 'n/a', 'reason': reason, 'source': source, 'asOf': as_of}
    d.update(kw)
    return d


SK_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra']


def skd(iso):
    """'2025-08-26' -> '26 augusta 2025' (house rule: no dotted ordinals)"""
    y, m, d = (int(x) for x in iso.split('-'))
    return '%d %s %d' % (d, SK_GEN[m - 1], y)


def pnum(s):
    return float(s.replace(' ', '').replace(' ', '').replace(',', '.'))


# ---------------------------------------------------------------- ADSS weekly report
def adss(report):
    from pypdf import PdfReader
    url = 'https://adss.m7.sk/storage/adss_%s.pdf' % report
    text = '\n'.join(p.extract_text() for p in PdfReader(io.BytesIO(get(url, True))).pages)
    text = re.sub(r'[   ]+', ' ', text)
    m = re.search(r'k (\d{2})\.(\d{2})\.(\d{4})', text)
    as_of = '%s-%s-%s' % (m.group(3), m.group(2), m.group(1))
    assert 'maximálne vo výške 0,4 %' in text, 'fee line changed in the ADSS report'
    funds, section = [], None
    row = re.compile(r'^(?P<head>.+?) (?P<born>\d{2}\.\d{2}\.\d{4}) (?P<unit>\d,\d{6}) € (?P<nav>[\d ]+,\d{2}) € (?P<rest>.*)$')
    for line in text.split('\n'):
        line = line.strip()
        if line.startswith('Garantované dôchodkové fondy'):
            section = 'guaranteed'; continue
        if line.startswith('Negarantované dôchodkové fondy'):
            section = 'nonguaranteed'; continue
        m = row.match(line)
        if not m:
            continue
        head = m.group('head')
        cm = re.match(r'(.+?(?:d\.s\.s\., a\.s\.))\s+(.+)$', head)
        nums = [pnum(x) / 100 for x in re.findall(r'(-?\d+,\d+)%', m.group('rest'))]
        # columns: ytd, 3m, 1y, 5y p.a., 10y p.a., since inception p.a.; young funds miss 5y/10y
        if len(nums) == 6:
            ytd, m3, y1, y5, y10, since = nums
        elif len(nums) == 4:
            ytd, m3, y1, since = nums; y5 = y10 = None
        else:
            raise SystemExit('unexpected ADSS row: ' + line)
        b = m.group('born')
        funds.append({'company': cm.group(1), 'name': cm.group(2), 'section': section,
                      'born': '%s-%s-%s' % (b[6:], b[3:5], b[:2]), 'unit': pnum(m.group('unit')), 'nav': pnum(m.group('nav')),
                      'ytd': ytd, 'y1': y1, 'y5': y5, 'y10': y10, 'since': since})
    assert len(funds) >= 15, len(funds)
    return url, as_of, funds


def fund_type(name, section):
    n = name.lower()
    if section == 'guaranteed':
        return 'bond_guaranteed'
    for k, t in (('indexov', 'index'), ('akciov', 'equity'), ('zmiešan', 'mixed'), ('inovatív', 'innovative')):
        if k in n:
            return t
    raise SystemExit('unknown fund type: ' + name)


# ---------------------------------------------------------------- NBS daily unit values
def nbs():
    z = zipfile.ZipFile(io.BytesIO(get(NBS_ZIP, True)))
    P = lambda s: '%s-%s-%s' % (s[6:], s[3:5], s[:2])
    ser, names = {}, {}
    with z.open('dsw_report_data.csv') as f:
        for r in csv.DictReader(io.TextIOWrapper(f, encoding='cp1250'), delimiter=';'):
            if r['VAL_TYPE'] == 'AHDJ' and r['CURRENCY'] == 'EUR' and r['GRP_PARENT_NAME'] == 'Fondy DSS':
                ser.setdefault(r['SUBJECT_CODE'], {})[P(r['PERIOD'])] = pnum(r['NUM_VALUE'])
                names[r['SUBJECT_CODE']] = r['SUBJECT_NAME_ACT']
    with z.open('dsw_subject_union.csv') as f:
        unions = {(r['SUBJECT_CODE'], r['SUCCESSOR_SUBJECT_CODE']): r['UNION_DATE']
                  for r in csv.DictReader(io.TextIOWrapper(f, encoding='cp1250'), delimiter=';')}
    for succ, pred in PRED.items():
        assert (pred, succ) in unions, 'NBS union record missing for %s' % succ
        first = min(ser[succ])
        for d, v in ser[pred].items():
            if d < first:
                ser[succ][d] = v
    return ser, names


def last_on_or_before(s, keys, d):
    i = _bisect(keys, d)
    return (keys[i], s[keys[i]]) if i >= 0 else (None, None)


def _bisect(keys, d):
    lo, hi = 0, len(keys) - 1; ans = -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if keys[mid] <= d:
            ans = mid; lo = mid + 1
        else:
            hi = mid - 1
    return ans


def fridays(end, years):
    e = D.date.fromisoformat(end)
    start = e.replace(year=e.year - years)
    out, d = [], e
    while d >= start:
        out.append(d.isoformat()); d -= D.timedelta(days=7)
    return list(reversed(out))


def risk(points):
    """max drawdown and annualised volatility of weekly log returns (x sqrt 52)"""
    peak, mdd, rets = points[0], 0.0, []
    for a, b in zip(points, points[1:]):
        rets.append(math.log(b / a))
    for v in points:
        peak = max(peak, v); mdd = min(mdd, v / peak - 1)
    mu = sum(rets) / len(rets)
    sd = math.sqrt(sum((r - mu) ** 2 for r in rets) / (len(rets) - 1))
    return mdd, sd * math.sqrt(52)


# ---------------------------------------------------------------- inflation, bitcoin
def hicp():
    d = json.loads(get(HICP))
    idx, val = d['dimension']['time']['category']['index'], d['value']
    s = {k: val[str(i)] for k, i in idx.items() if str(i) in val and val[str(i)] is not None}
    return s, d.get('updated', '')[:10]


def btc_eur(end):
    cm = json.loads(get(CM.format(end=end)))['data']
    usd = {r['time'][:10]: float(r['PriceUSD']) for r in cm}
    fx = json.loads(get(FX.format(end=end)))['rates']
    fk = sorted(fx)
    eur = {}
    for d, p in usd.items():
        k, r = last_on_or_before({x: fx[x]['USD'] for x in fk}, fk, d)
        if r:
            eur[d] = p / r
    return eur


def main():
    report = DEFAULT_REPORT
    if '--adss' in sys.argv:
        report = sys.argv[sys.argv.index('--adss') + 1]
    adss_url, as_of, rows = adss(report)
    print('ADSS report', as_of, len(rows), 'funds')
    ser, nbs_names = nbs()
    infl, infl_upd = hicp()
    end_dt = D.date.fromisoformat(as_of)
    btc = btc_eur((end_dt + D.timedelta(days=1)).isoformat())

    # inflation window: latest published month and the same month 1/5/10 years earlier
    ik = sorted(infl); i_end = ik[-1]
    infl_pa = {}
    for y in (1, 5, 10):
        start = '%d-%s' % (int(i_end[:4]) - y, i_end[5:])
        infl_pa[y] = (infl[i_end] / infl[start]) ** (1 / y) - 1

    def infl_obj(y):
        start = '%d-%s' % (int(i_end[:4]) - y, i_end[5:])
        return obj(round(infl_pa[y], 6), 'fraction p.a.', HICP_PAGE,
                   'HICP Slovensko, všetky položky, index 2025=100 (Eurostat prc_hicp_minr, zostavuje ŠÚ SR), %s až %s' % (start, i_end), i_end)

    def real(nom, y):
        return None if nom is None else (1 + nom) / (1 + infl_pa[y]) - 1

    weeks = fridays(as_of, WEEKS_10Y)
    funds = []
    # match ADSS rows to NBS codes by the unit value on the report date (6 decimals, unique)
    for r in rows:
        code = [c for c, s in ser.items() if abs(s.get(as_of, -1) - r['unit']) < 5e-7]
        assert len(code) == 1, (r['name'], code)
        code = code[0]; s = ser[code]; keys = sorted(s)
        f = {'id': code, 'name': r['name'], 'company': r['company'], 'type': fund_type(r['name'], r['section']),
             'guaranteed': r['section'] == 'guaranteed', 'founded': r['born'],
             'unitValue': obj(r['unit'], 'EUR', adss_url, 'ADSS, Údaje o dôchodkových fondoch k %s' % as_of, as_of),
             'nav': obj(r['nav'], 'EUR', adss_url, 'ADSS, Údaje o dôchodkových fondoch k %s' % as_of, as_of)}
        if code in PRED:
            f['history'] = 'Do 31.10.2019 hodnoty fondu %s (AEGON INDEX), zlúčeného do tohto fondu podľa NBS (dsw_subject_union.csv).' % PRED[code]
        f['managementFee'] = na('Skutočnú sadzbu zo štatútu fondu sme v tomto kole neoverili. V tabuľke je zákonný strop 0,4 % ročne.',
                                adss_url, as_of)
        f['managementFeeCap'] = obj(0.004, 'fraction p.a.', LAW,
                                    'zákon č. 43/2004 Z. z., § 63a ods. 3, znenie účinné od 1.8.2026; ADSS: max. 0,4 % v roku 2026', '2026-08-01')
        f['performanceFee'] = obj(0.0, 'fraction', LAW,
                                  'zákon č. 43/2004 Z. z., § 63 ods. 1, znenie účinné od 1.8.2026: správca má právo len na odplatu za správu; odplatu za zhodnotenie zákon neobsahuje', '2026-08-01',
                                  note='Nie je to odhad nuly: zákon odplatu za zhodnotenie vôbec nepozná.')
        lab = 'ADSS, Údaje o dôchodkových fondoch k %s' % as_of
        for y, k in ((1, 'y1'), (5, 'y5'), (10, 'y10')):
            v = r[k]
            key = 'return%dy' % y
            if v is None:
                f[key] = na('Fond vznikol %s, %d-ročný výnos ADSS neuverejňuje.' % (skd(r['born']), y), adss_url, as_of)
                f['real%dy' % y] = na('Chýba nominálny výnos za toto obdobie.', HICP_PAGE, as_of)
            else:
                f[key] = obj(v, 'fraction p.a.' if y > 1 else 'fraction', adss_url, lab, as_of)
                f['real%dy' % y] = obj(round(real(v, y), 6), 'fraction p.a.' if y > 1 else 'fraction', HICP_PAGE,
                                       '(1 + výnos) / (1 + inflácia) - 1; inflácia HICP SK %s' % i_end, as_of)
        f['returnYtd'] = obj(r['ytd'], 'fraction', adss_url, lab, as_of)
        # risk: weekly (Fridays) over 10 years, only with a full official series
        if keys[0] > weeks[0]:
            reason = 'Rad hodnoty dôchodkovej jednotky v NBS začína %s, na 10 rokov to nestačí. Nepočítame z kratšieho obdobia.' % skd(keys[0])
            f['maxDrawdown10y'] = na(reason, NBS_PAGE, as_of)
            f['volatility10y'] = na(reason, NBS_PAGE, as_of)
        else:
            pts = [last_on_or_before(s, keys, w)[1] for w in weeks]
            mdd, vol = risk(pts)
            lab2 = 'NBS, aktuálna hodnota dôchodkovej jednotky, týždenne (piatky) %s až %s' % (weeks[0], weeks[-1])
            f['maxDrawdown10y'] = obj(round(mdd, 6), 'fraction', NBS_PAGE, lab2, as_of)
            f['volatility10y'] = obj(round(vol, 6), 'fraction p.a.', NBS_PAGE, lab2 + '; smerodajná odchýlka týždenných log výnosov x odmocnina z 52', as_of)
        f['weekly'] = [round(last_on_or_before(s, keys, w)[1], 6) if keys[0] <= w else None for w in weeks]
        funds.append(f)

    # Bitcoin, same dates
    bk = sorted(btc)
    def bp(d):
        return last_on_or_before(btc, bk, d)
    b_end = btc[as_of]
    bl = 'CoinMetrics PriceUSD / ECB EUR-USD (Frankfurter), denné ceny'
    B = {'id': 'btc', 'name': 'Bitcoin', 'type': 'bitcoin', 'guaranteed': False,
         'price': obj(round(b_end, 2), 'EUR', CM_PAGE, bl, as_of)}
    B['managementFee'] = na('Bitcoin nie je fond a nemá poplatok za správu. Nákup, predaj a úschova môžu stáť niečo podľa poskytovateľa; typický náklad z jedného verejného zdroja nevieme overiť.', CM_PAGE, as_of)
    B['managementFeeCap'] = na('Bitcoin nie je fond, zákonný strop neexistuje.', CM_PAGE, as_of)
    B['performanceFee'] = na('Bitcoin nie je fond.', CM_PAGE, as_of)
    for y in (1, 5, 10):
        d0 = end_dt.replace(year=end_dt.year - y).isoformat()
        v = (b_end / bp(d0)[1]) ** (1 / y) - 1
        B['return%dy' % y] = obj(round(v, 6), 'fraction p.a.' if y > 1 else 'fraction', CM_PAGE, '%s, %s až %s' % (bl, d0, as_of), as_of)
        B['real%dy' % y] = obj(round(real(v, y), 6), 'fraction p.a.' if y > 1 else 'fraction', HICP_PAGE,
                               '(1 + výnos) / (1 + inflácia) - 1; inflácia HICP SK %s' % i_end, as_of)
    jan = bp('%d-12-31' % (end_dt.year - 1))[1]
    B['returnYtd'] = obj(round(b_end / jan - 1, 6), 'fraction', CM_PAGE, '%s, 31.12.%d až %s' % (bl, end_dt.year - 1, as_of), as_of)
    pts = [bp(w)[1] for w in weeks]
    mdd, vol = risk(pts)
    lab2 = 'CoinMetrics / ECB, týždenne (piatky) %s až %s, rovnaké dni ako fondy' % (weeks[0], weeks[-1])
    B['maxDrawdown10y'] = obj(round(mdd, 6), 'fraction', CM_PAGE, lab2, as_of)
    B['volatility10y'] = obj(round(vol, 6), 'fraction p.a.', CM_PAGE, lab2 + '; smerodajná odchýlka týždenných log výnosov x odmocnina z 52', as_of)
    B['weekly'] = [round(x, 2) for x in pts]

    data = {
        'generated': D.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
        'asOf': as_of,
        'currency': 'EUR',
        'phase': 1,
        'scope': 'Všetky dôchodkové fondy druhého piliera (starobné dôchodkové sporenie) podľa ADSS k dátumu dát, a Bitcoin.',
        'inflation': {'series': 'HICP Slovakia, all items, 2025=100', 'source': HICP_PAGE, 'api': HICP,
                      'lastMonth': i_end, 'updated': infl_upd,
                      'pa': {'1y': infl_obj(1), '5y': infl_obj(5), '10y': infl_obj(10)}},
        'methodology': {
            'returns': 'Fondy: oficiálne výnosy z týždennej správy ADSS k dátumu dát (1 rok, 5 a 10 rokov p.a.). Bitcoin: cena v eurách v ten istý deň a v rovnaký deň pred 1, 5 a 10 rokmi, (koniec / začiatok)^(1/roky) - 1. Výnosy fondov sú po odplate za správu (hodnota dôchodkovej jednotky ju už zahŕňa).',
            'real': '(1 + nominálny výnos p.a.) / (1 + inflácia p.a.) - 1. Inflácia: HICP Slovensko, posledný zverejnený mesiac a ten istý mesiac pred 1, 5 a 10 rokmi (okno inflácie končí %s, dáta fondov %s).' % (i_end, as_of),
            'drawdown': 'Najväčší pokles od predchádzajúceho maxima na týždenných hodnotách (piatky) za posledných 10 rokov. Fondy: hodnota dôchodkovej jednotky NBS (posledná známa k piatku). Bitcoin: cena v eurách v ten istý piatok.',
            'volatility': 'Smerodajná odchýlka týždenných logaritmických výnosov x odmocnina z 52, rovnaké piatky ako pri prepade.',
            'bitcoinPrice': 'CoinMetrics community API, PriceUSD (denná referenčná cena) prepočítaná kurzom ECB EUR/USD z toho istého dňa (Frankfurter), rovnaký zdroj ako data/btc-monthly-returns.json.',
            'periodEnd': as_of,
        },
        'weeks': weeks,
        'sources': [
            {'label': 'ADSS, Zhodnotenie vo fondoch (zoznam fondov, výnosy)', 'url': ADSS_PAGE, 'asOf': as_of},
            {'label': 'ADSS, Údaje o dôchodkových fondoch k %s (PDF)' % as_of, 'url': adss_url, 'asOf': as_of},
            {'label': 'NBS, Vývoj aktuálnej hodnoty dôchodkovej jednotky (denné údaje, ZIP)', 'url': NBS_PAGE, 'asOf': as_of},
            {'label': 'Zákon č. 43/2004 Z. z., znenie účinné od 1.8.2026 (slov-lex)', 'url': LAW, 'asOf': '2026-08-01'},
            {'label': 'Eurostat, HICP Slovensko (prc_hicp_minr)', 'url': HICP_PAGE, 'asOf': i_end},
            {'label': 'CoinMetrics, PriceUSD', 'url': CM_PAGE, 'asOf': as_of},
            {'label': 'ECB, referenčný kurz EUR/USD', 'url': FX_PAGE, 'asOf': as_of},
        ],
        'legalNotice': {
            'text': 'S uzatvorením zmluvy s dôchodkovou správcovskou spoločnosťou je spojené aj riziko a doterajší alebo propagovaný výnos portfólia dôchodkového fondu v jej správe nie je zárukou budúceho výnosu portfólia dôchodkového fondu. Činnosť dôchodkovej správcovskej spoločnosti je pod dohľadom Národnej banky Slovenska.',
            'source': ADSS_PAGE, 'sourceLabel': 'ADSS, upozornenie podľa zákona č. 43/2004 Z. z.'},
        'bitcoin': B,
        'funds': sorted(funds, key=lambda f: (f['company'], not f['guaranteed'], f['name'])),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(funds), 'funds')


if __name__ == '__main__':
    main()
