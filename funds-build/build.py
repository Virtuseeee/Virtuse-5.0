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
CM_PAGE = 'https://coverage.coinmetrics.io/asset-metrics/PriceUSD'   # docs.coinmetrics.io/.../priceusd returned 404 on 18 Nov 2026
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


EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']


def end(iso):
    y, m, d = (int(x) for x in iso.split('-'))
    return '%d %s %d' % (d, EN_M[m - 1], y)


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


def EN_REASON(r):
    """English text for each Slovak phase 2 reason template (same wording as the page)"""
    import re as _re
    m = _re.match(r'Fond \(trieda podielov\) vznikol (\d+) (\S+) (\d{4}), (\d+)-ročný', r)
    if m:
        return 'The fund (share class) started on %s %s %s; the manager does not state a %s-year return.' % (
            m.group(1), EN_M[SK_GEN.index(m.group(2))], m.group(3), m.group(4))
    m = _re.match(r'Mesačná správa správcu (\d+)-ročný', r)
    if m:
        return "The manager's report does not state a %s-year return; we don't build one from calendar years." % m.group(1)
    T = {
        'Emitent zverejňuje výnos tohto ETF len v amerických dolároch. V eurách ho neuvádza a sami ho neprepočítavame.':
            "The issuer publishes this ETF's return only in US dollars. It does not publish one in euros, and we don't convert it ourselves.",
        'Správa emitenta tabuľku výkonnosti neobsahuje, odkazuje na online stránku, ktorá vyžaduje vstupný formulár.':
            "The issuer's report has no performance table; it links to an online page behind an entry form.",
        'Kľúčový informačný dokument pri poplatku za výkonnosť uvádza len sumu 0 € bez percenta, percento nedopĺňame.':
            "The key information document shows only €0 for the performance fee, with no percentage; we don't fill one in.",
        'Kľúčový informačný dokument túto hodnotu neuvádza.': 'The key information document does not state this value.',
    }
    if r in T:
        return T[r]
    raise SystemExit('no English text for reason: ' + r)


PHASE2_IN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase2-input.json')
KID_FIELDS = ('entryCostMax', 'exitCost', 'managementAndOtherCosts', 'transactionCosts', 'performanceFee')


def phase2(btc, infl, infl_pa_for, real_for):
    """Mutual funds and ETFs. Input: funds-build/phase2-input.json, curated by hand from each fund's PRIIPs KID
    and monthly factsheet (URLs and verbatim quotes kept there; every value was re-checked against the PDF text).
    Nothing is estimated: a value missing in the official document stays n/a."""
    if not os.path.exists(PHASE2_IN):
        return None
    src = json.load(open(PHASE2_IN, encoding='utf-8'))
    bk = sorted(btc)
    out, dates = [], set()
    for s in src['funds']:
        fs, kid = s['factsheet'], s['kid']
        a = fs['asOf']; dates.add(a)
        fl = 'Správa správcu k %s' % skd(a)
        kl = 'Kľúčový informačný dokument (PRIIPs KID), %s' % skd(kid['date'])
        f = {'id': s['id'], 'name': s['name'], 'isin': s['isin'], 'company': s['manager'], 'type': s['type'],
             'domicile': s['domicile'], 'currency': 'EUR', 'asOf': a,
             'kidUrl': kid['url'], 'kidDate': kid['date'], 'kidLanguage': kid['language'],
             'factsheetUrl': fs['url'], 'selection': s['selectionNote']}
        if s.get('inception'):
            f['inception'] = s['inception']
        if s.get('sri'):
            f['sri'] = obj(s['sri'], 'scale 1-7', kid['url'], kl, kid['date'])
        if s.get('netAssets'):
            n = s['netAssets']
            f['netAssets'] = obj(n['value'], n['unit'], n['url'], 'Majetok fondu podľa správcu', n['asOf'])
        for k in KID_FIELDS:
            v = kid.get(k)
            f[k] = (obj(round(v / 100, 8), 'fraction' if k in ('entryCostMax', 'exitCost', 'performanceFee') else 'fraction p.a.', kid['url'], kl, kid['date'])
                    if v is not None else na(s.get('nulls', {}).get(k, 'Kľúčový informačný dokument túto hodnotu neuvádza.'), kid['url'], kid['date'], reasonEn=EN_REASON(s.get('nulls', {}).get(k, 'Kľúčový informačný dokument túto hodnotu neuvádza.'))))
        m, t = kid.get('managementAndOtherCosts'), kid.get('transactionCosts')
        if m is not None and t is not None:
            f['ongoingCosts'] = obj(round((m + t) / 100, 8), 'fraction p.a.', kid['url'],
                                    kl + ': správa a iné administratívne alebo prevádzkové náklady + transakčné náklady', kid['date'])
        else:
            f['ongoingCosts'] = na('Chýba jedna zo zložiek nákladov v kľúčovom informačnom dokumente.', kid['url'], kid['date'], reasonEn='One of the cost components is missing in the key information document.')
        for y, pa, cum in ((1, 'return1y', None), (5, 'return5yPa', 'return5yCum'), (10, 'return10yPa', 'return10yCum')):
            key = 'return%dy' % y
            v = fs.get(pa)
            lab = fl
            if v is None and cum and fs.get(cum) is not None:
                v = ((1 + fs[cum] / 100) ** (1 / y) - 1) * 100
                lab = fl + '; prepočet z kumulatívneho výnosu %s %% na priemer za rok' % str(fs[cum]).replace('.', ',')
            if v is None:
                r_ = s.get('nulls', {}).get(key) or s.get('nulls', {}).get(pa) or 'Správca %d-ročný výnos v eurách neuverejňuje.' % y
                f[key] = na(r_, fs['url'], a, reasonEn=EN_REASON(r_))
                f['real%dy' % y] = na('Chýba nominálny výnos za toto obdobie.', HICP_PAGE, a, reasonEn='No nominal return for this period.')
            else:
                v = v / 100
                f[key] = obj(round(v, 8), 'fraction p.a.' if y > 1 else 'fraction', fs['url'], lab, a)
                r, im = real_for(v, y, a)
                f['real%dy' % y] = obj(round(r, 6), 'fraction p.a.' if y > 1 else 'fraction', HICP_PAGE,
                                       '(1 + výnos) / (1 + inflácia) - 1; inflácia HICP SK, okno končí %s' % im, a)
        reason = 'Denný rad hodnoty podielu od správcu v strojovo čitateľnej podobe sme nemali, z niekoľkých bodov výnosu prepad nepočítame.'
        reason_en = "We had no official daily series of the unit price in machine-readable form, and we don't compute drawdown from a few return points."
        f['maxDrawdown10y'] = na(reason, fs['url'], a, reasonEn=reason_en)
        f['volatility10y'] = na(reason, fs['url'], a, reasonEn=reason_en)
        out.append(f)
    # Bitcoin at each factsheet date (same days, same formula as phase 1)
    bl = 'CoinMetrics PriceUSD / ECB EUR-USD (Frankfurter), denné ceny'
    B = {}
    for a in sorted(dates):
        e = D.date.fromisoformat(a)
        p_end = last_on_or_before(btc, bk, a)[1]
        b = {'price': obj(round(p_end, 2), 'EUR', CM_PAGE, bl, a)}
        for y in (1, 5, 10):
            d0 = e.replace(year=e.year - y).isoformat()
            v = (p_end / last_on_or_before(btc, bk, d0)[1]) ** (1 / y) - 1
            b['return%dy' % y] = obj(round(v, 6), 'fraction p.a.' if y > 1 else 'fraction', CM_PAGE, '%s, %s až %s' % (bl, d0, a), a)
            r, im = real_for(v, y, a)
            b['real%dy' % y] = obj(round(r, 6), 'fraction p.a.' if y > 1 else 'fraction', HICP_PAGE,
                                   '(1 + výnos) / (1 + inflácia) - 1; inflácia HICP SK, okno končí %s' % im, a)
        B[a] = b
    return {
        'scope': src['scope'],
        'selection': src['selection'],
        'eicNote': src['eicNote'],
        'methodology': {
            'returns': 'Výnosy z mesačného faktsheetu správcu pre danú triedu podielov v eurách (1 rok, 5 a 10 rokov p.a.), po priebežných nákladoch fondu, bez vstupného a výstupného poplatku. Ak správca uvádza len kumulatívny výnos, prepočítame ho na priemer za rok: (1 + kumulatívny)^(1/roky) - 1.',
            'costs': 'Náklady výhradne z kľúčového informačného dokumentu (PRIIPs KID) danej triedy podielov, tabuľka Zloženie nákladov. Bežné ročné náklady = správa a iné administratívne alebo prevádzkové náklady + transakčné náklady. Vstupný poplatok je maximum; distribútor môže účtovať menej.',
            'bitcoin': 'Bitcoin k rovnakému dňu ako faktsheet fondu, rovnaký vzorec a zdroj ako vo fáze 1.',
            'real': 'Inflácia HICP Slovensko, okno končí v mesiaci dátumu faktsheetu.',
            'risk': 'Prepad a volatilitu pri podielových fondoch a ETF neuvádzame: nemáme oficiálny denný rad hodnoty podielu v strojovo čitateľnej podobe.'},
        'bitcoin': B,
        'funds': sorted(out, key=lambda f: (f['type'], f['company'], f['name'])),
    }


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

    def real_for(nom, y, as_of_date):
        """inflation window ending in the month of as_of_date (phase 2 factsheets are month-end)"""
        im = min(as_of_date[:7], i_end)
        st = '%d-%s' % (int(im[:4]) - y, im[5:])
        ip = (infl[im] / infl[st]) ** (1 / y) - 1
        return (1 + nom) / (1 + ip) - 1, im

    weeks = fridays(as_of, WEEKS_10Y)
    funds = []
    # match ADSS rows to NBS codes by the unit value on the report date (6 decimals, unique)
    for r in rows:
        code = [c for c, s in ser.items() if abs(s.get(as_of, -1) - r['unit']) < 5e-7]
        assert len(code) == 1, (r['name'], code)
        code = code[0]; s = ser[code]; keys = sorted(s)
        f = {'id': code, 'name': r['name'], 'company': r['company'], 'type': fund_type(r['name'], r['section']),
             'guaranteed': r['section'] == 'guaranteed', 'founded': r['born'],
             'unitValue': obj(r['unit'], 'EUR', adss_url, 'Asociácia dôchodkových správcovských spoločností, Údaje o dôchodkových fondoch k %s' % skd(as_of), as_of),
             'nav': obj(r['nav'], 'EUR', adss_url, 'Asociácia dôchodkových správcovských spoločností, Údaje o dôchodkových fondoch k %s' % skd(as_of), as_of)}
        if code in PRED:
            f['history'] = 'Do 31 októbra 2019 hodnoty fondu %s (AEGON INDEX), zlúčeného do tohto fondu podľa Národnej banky Slovenska (dsw_subject_union.csv).' % PRED[code]
        f['managementFee'] = na('Skutočnú sadzbu zo štatútu fondu sme v tomto kole neoverili. Na stránke je zákonný strop 0,4 % ročne, nie poplatok fondu.',
                                adss_url, as_of, reasonEn="We have not checked the actual rate in the fund's statute in this round. The page shows the legal cap of 0.4% a year, not the fund's own fee.")
        f['managementFeeCap'] = obj(0.004, 'fraction p.a.', LAW,
                                    'zákon č. 43/2004 Z. z., § 63a ods. 3, znenie účinné od 1 augusta 2026; asociácia: najviac 0,4 % v roku 2026', '2026-08-01')
        f['performanceFee'] = obj(0.0, 'fraction', LAW,
                                  'zákon č. 43/2004 Z. z., § 63 ods. 1, znenie účinné od 1 augusta 2026: správca má právo len na odplatu za správu; odplatu za zhodnotenie zákon neobsahuje', '2026-08-01',
                                  note='Nie je to odhad nuly: zákon odplatu za zhodnotenie vôbec nepozná.')
        lab = 'Asociácia dôchodkových správcovských spoločností, Údaje o dôchodkových fondoch k %s' % skd(as_of)
        for y, k in ((1, 'y1'), (5, 'y5'), (10, 'y10')):
            v = r[k]
            key = 'return%dy' % y
            if v is None:
                f[key] = na('Fond vznikol %s, %d-ročný výnos asociácia neuverejňuje.' % (skd(r['born']), y), adss_url, as_of,
                            reasonEn='The fund started on %s; the association does not publish a %d-year return.' % (end(r['born']), y))
                f['real%dy' % y] = na('Chýba nominálny výnos za toto obdobie.', HICP_PAGE, as_of, reasonEn='No nominal return for this period.')
            else:
                f[key] = obj(v, 'fraction p.a.' if y > 1 else 'fraction', adss_url, lab, as_of)
                f['real%dy' % y] = obj(round(real(v, y), 6), 'fraction p.a.' if y > 1 else 'fraction', HICP_PAGE,
                                       '(1 + výnos) / (1 + inflácia) - 1; inflácia HICP SK %s' % i_end, as_of)
        f['returnYtd'] = obj(r['ytd'], 'fraction', adss_url, lab, as_of)
        # risk: weekly (Fridays) over 10 years, only with a full official series
        if keys[0] > weeks[0]:
            reason = 'Rad hodnoty dôchodkovej jednotky v Národnej banke Slovenska začína %s, na 10 rokov to nestačí. Nepočítame z kratšieho obdobia.' % skd(keys[0])
            reason_en = "The National Bank of Slovakia's unit-value series starts on %s, too short for 10 years. We don't compute from a shorter period." % end(keys[0])
            f['maxDrawdown10y'] = na(reason, NBS_PAGE, as_of, reasonEn=reason_en)
            f['volatility10y'] = na(reason, NBS_PAGE, as_of, reasonEn=reason_en)
        else:
            pts = [last_on_or_before(s, keys, w)[1] for w in weeks]
            mdd, vol = risk(pts)
            lab2 = 'Národná banka Slovenska, aktuálna hodnota dôchodkovej jednotky, týždenne (piatky) %s až %s' % (weeks[0], weeks[-1])
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
    B['managementFee'] = na('Bitcoin nie je fond a nemá poplatok za správu. Nákup, predaj a úschova môžu stáť niečo podľa poskytovateľa; typický náklad z jedného verejného zdroja nevieme overiť.', CM_PAGE, as_of,
                            reasonEn='Bitcoin is not a fund and has no management fee. Buying, selling and storage can cost something depending on the provider; we cannot verify one typical cost from a public source.')
    B['managementFeeCap'] = na('Bitcoin nie je fond, zákonný strop neexistuje.', CM_PAGE, as_of, reasonEn='Bitcoin is not a fund; there is no legal cap.')
    B['performanceFee'] = na('Bitcoin nie je fond.', CM_PAGE, as_of, reasonEn='Bitcoin is not a fund.')
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
        'scope': 'Všetky dôchodkové fondy druhého piliera (starobné dôchodkové sporenie) podľa asociácie dôchodkových správcovských spoločností k dátumu dát, a Bitcoin.',
        'inflation': {'series': 'HICP Slovakia, all items, 2025=100', 'source': HICP_PAGE, 'api': HICP,
                      'lastMonth': i_end, 'updated': infl_upd,
                      'pa': {'1y': infl_obj(1), '5y': infl_obj(5), '10y': infl_obj(10)}},
        'methodology': {
            'returns': 'Fondy: oficiálne výnosy z týždennej správy asociácie dôchodkových správcovských spoločností k dátumu dát (1 rok, 5 a 10 rokov p.a.). Bitcoin: cena v eurách v ten istý deň a v rovnaký deň pred 1, 5 a 10 rokmi, (koniec / začiatok)^(1/roky) - 1. Výnosy fondov sú po odplate za správu (hodnota dôchodkovej jednotky ju už zahŕňa).',
            'real': '(1 + nominálny výnos p.a.) / (1 + inflácia p.a.) - 1. Inflácia: HICP Slovensko, posledný zverejnený mesiac a ten istý mesiac pred 1, 5 a 10 rokmi (okno inflácie končí %s, dáta fondov %s).' % (i_end, as_of),
            'drawdown': 'Najväčší pokles od predchádzajúceho maxima na týždenných hodnotách (piatky) za posledných 10 rokov. Fondy: hodnota dôchodkovej jednotky z Národnej banky Slovenska (posledná známa k piatku). Bitcoin: cena v eurách v ten istý piatok.',
            'volatility': 'Smerodajná odchýlka týždenných logaritmických výnosov x odmocnina z 52, rovnaké piatky ako pri prepade.',
            'bitcoinPrice': 'CoinMetrics community API, PriceUSD (denná referenčná cena) prepočítaná kurzom ECB EUR/USD z toho istého dňa (Frankfurter), rovnaký zdroj ako data/btc-monthly-returns.json.',
            'periodEnd': as_of,
        },
        'weeks': weeks,
        'sources': [
            {'id': 'adss_page', 'label': 'Asociácia dôchodkových správcovských spoločností, Zhodnotenie vo fondoch (zoznam fondov, výnosy)',
             'labelEn': 'Slovak Association of Pension Fund Management Companies, fund returns page (list of funds, returns)', 'url': ADSS_PAGE, 'asOf': as_of},
            {'id': 'adss_pdf', 'label': 'Asociácia dôchodkových správcovských spoločností, Údaje o dôchodkových fondoch k %s (PDF)' % skd(as_of),
             'labelEn': 'Slovak Association of Pension Fund Management Companies, pension fund data as of %s (PDF)' % end(as_of), 'url': adss_url, 'asOf': as_of},
            {'id': 'nbs', 'label': 'Národná banka Slovenska, vývoj aktuálnej hodnoty dôchodkovej jednotky (denné údaje, ZIP)',
             'labelEn': 'National Bank of Slovakia, current pension unit value (daily data, ZIP)', 'url': NBS_PAGE, 'asOf': as_of},
            {'id': 'law', 'label': 'Zákon č. 43/2004 Z. z., znenie účinné od 1 augusta 2026 (Slov-Lex)',
             'labelEn': 'Act No. 43/2004 Coll., version in force from 1 August 2026 (Slov-Lex)', 'url': LAW, 'asOf': '2026-08-01'},
            {'id': 'hicp', 'label': 'Eurostat, harmonizovaný index spotrebiteľských cien, Slovensko (prc_hicp_minr)',
             'labelEn': 'Eurostat, harmonised index of consumer prices, Slovakia (prc_hicp_minr)', 'url': HICP_PAGE, 'asOf': i_end},
            {'id': 'cm', 'label': 'CoinMetrics, PriceUSD', 'labelEn': 'CoinMetrics, PriceUSD', 'url': CM_PAGE, 'asOf': as_of},
            {'id': 'ecb', 'label': 'Európska centrálna banka, referenčný kurz EUR/USD',
             'labelEn': 'European Central Bank, EUR/USD reference rate', 'url': FX_PAGE, 'asOf': as_of},
        ],
        'legalNotice': {
            'text': 'S uzatvorením zmluvy s dôchodkovou správcovskou spoločnosťou je spojené aj riziko a doterajší alebo propagovaný výnos portfólia dôchodkového fondu v jej správe nie je zárukou budúceho výnosu portfólia dôchodkového fondu. Činnosť dôchodkovej správcovskej spoločnosti je pod dohľadom Národnej banky Slovenska.',
            'source': ADSS_PAGE, 'sourceLabel': 'Asociácia dôchodkových správcovských spoločností, upozornenie podľa zákona č. 43/2004 Z. z.'},
        'bitcoin': B,
        'funds': sorted(funds, key=lambda f: (f['company'], not f['guaranteed'], f['name'])),
    }
    p2 = phase2(btc, infl, None, real_for)
    if p2:
        data['phase'] = 2
        data['investmentFunds'] = p2
        data['sources'].append({'id': 'kid', 'label': 'Kľúčové informačné dokumenty a mesačné správy správcov, odkaz je pri každom fonde',
                                'labelEn': 'Key information documents and manager reports, linked next to each fund',
                                'url': '#funds', 'asOf': max(p2['bitcoin'])})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write('\n')
    print('wrote', OUT, os.path.getsize(OUT), 'bytes;', len(funds), 'funds')


if __name__ == '__main__':
    main()
