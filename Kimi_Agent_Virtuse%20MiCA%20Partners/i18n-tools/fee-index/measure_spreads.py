#!/usr/bin/env python3
"""Measure the spread cost of a market buy on the exchange routes of the Fee Index.

For each amount (EUR) a market buy walks the public BTC/EUR order book; the cost is
the average fill price over the mid price (best bid + best ask) / 2, in percent.
That covers half the bid-ask spread plus slippage. Takes a few samples and keeps
the average, so one odd moment doesn't decide the ranking.

usage: python3 measure_spreads.py [--samples 3] [--gap 20] [--write]
--write stores the result in seo-build/data/fee-index.json (key "spreads").
21bitcoin has no public order book: see fee-index.json "spread_21bitcoin".
"""
import json, os, sys, time, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
DATA = os.path.join(REPO, 'seo-build', 'data', 'fee-index.json')
AMOUNTS = [50, 100, 250, 500, 1000]


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Virtuse fee index)'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def kraken():
    d = get('https://api.kraken.com/0/public/Depth?pair=XBTEUR&count=100')['result']
    book = list(d.values())[0]
    return [(float(p), float(q)) for p, q, _ in book['asks']], [(float(p), float(q)) for p, q, _ in book['bids']]


def bybit_eu():
    d = get('https://api.bybit.eu/v5/market/orderbook?category=spot&symbol=BTCEUR&limit=200')['result']
    return [(float(p), float(q)) for p, q in d['a']], [(float(p), float(q)) for p, q in d['b']]


def cost(asks, bids, eur):
    mid = (asks[0][0] + bids[0][0]) / 2
    left, btc = eur, 0.0
    for p, q in asks:
        take = min(left, p * q)
        btc += take / p
        left -= take
        if left <= 1e-9:
            break
    if left > 1e-9:
        return None  # book too thin for this amount
    return (eur / btc / mid - 1) * 100


def sample():
    out = {}
    for name, fn in (('kraken', kraken), ('bybit-eu', bybit_eu)):
        asks, bids = fn()
        out[name] = {str(a): cost(asks, bids, a) for a in AMOUNTS}
    return out


def main():
    args = sys.argv[1:]
    n = int(args[args.index('--samples') + 1]) if '--samples' in args else 3
    gap = int(args[args.index('--gap') + 1]) if '--gap' in args else 20
    runs = []
    for i in range(n):
        if i:
            time.sleep(gap)
        runs.append((datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), sample()))
        print(runs[-1][0], json.dumps(runs[-1][1]))
    avg = {}
    for ex in ('kraken', 'bybit-eu'):
        avg[ex] = {}
        for a in AMOUNTS:
            vals = [r[ex][str(a)] for _, r in runs if r[ex][str(a)] is not None]
            avg[ex][str(a)] = round(sum(vals) / len(vals), 4) if vals else None
    print('average %:', json.dumps(avg))
    if '--write' in args:
        data = json.load(open(DATA))
        data['spreads'] = {'measured': [t for t, _ in runs], 'method': 'market buy against the public BTC/EUR order book, average fill vs mid price', 'pct': avg}
        open(DATA, 'w').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print('wrote', DATA)


if __name__ == '__main__':
    main()
