#!/usr/bin/env python3
"""Sample 'chart of the day' for the Topic of the day (Virtuse chart style).
Data: data/btc-monthly-returns.json (CoinMetrics month-end closes; current month to asOf).
Writes <site>/news/test/today-sample.png (1600x900)."""
import json, os, sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
import matplotlib.image as mpimg

SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners')
d = json.load(open(os.path.join(SITE, 'data/btc-monthly-returns.json')))
c, as_of = d['closes'], d['asOf']
years = list(range(2014, 2027))
vals = [(c[f'{y}-11'] / c[f'{y}-10'] - 1) * 100 for y in years]

BG, FG, MUTED, GREY, ORANGE = '#121212', '#F2F2F2', '#9A9A9A', '#4A4A4F', '#E07B12'
plt.rcParams['font.family'] = ['Helvetica Neue', 'Helvetica', 'Arial', 'DejaVu Sans']
fig = plt.figure(figsize=(16, 9), dpi=100, facecolor=BG)
ax = fig.add_axes([0.07, 0.17, 0.88, 0.58], facecolor=BG)
cols = [ORANGE if y == 2026 else (GREY if v >= 0 else '#6B6B70') for y, v in zip(years, vals)]
bars = ax.bar([str(y) for y in years], vals, color=cols, width=0.62)
ax.axhline(0, color='#5A5A5A', lw=1)
for b, v, y in zip(bars, vals, years):
    ax.text(b.get_x() + b.get_width() / 2, v + (2 if v >= 0 else -2), f'{v:+.0f}%', ha='center',
            va='bottom' if v >= 0 else 'top', color=FG if y == 2026 else MUTED, fontsize=15,
            fontweight='bold' if y == 2026 else 'normal')
ax.set_ylim(min(vals) - 12, max(vals) + 12)
ax.tick_params(colors=MUTED, labelsize=15, length=0)
ax.set_yticks([])
for s in ax.spines.values(): s.set_visible(False)
fig.text(0.05, 0.9, 'Bitcoin in November: the "best month" is down this year', color=FG, fontsize=30)
fig.text(0.05, 0.84, 'Price change from end of October to end of November, US$. 2026: to %s.' % as_of, color=MUTED, fontsize=18)
fig.text(0.05, 0.05, 'Source: CoinMetrics community data (PriceUSD). 2013 (+451%) left out of the scale.', color='#6F6F6F', fontsize=13)
fig.text(0.95, 0.05, 'virtuse.com', color=MUTED, fontsize=16, ha='right')
logo = mpimg.imread(os.path.join(SITE, 'email-virtuse-v-mark.png'))
ab = AnnotationBbox(OffsetImage(logo, zoom=46 / logo.shape[0]), (0.875, 0.905), xycoords='figure fraction', frameon=False, box_alignment=(1, 0.5))
fig.add_artist(ab)
fig.text(0.95, 0.905, 'Virtuse', color=FG, fontsize=26, ha='right', va='center', fontweight='bold')
out = os.path.join(SITE, 'news/test/today-sample.png')
fig.savefig(out, facecolor=BG)
print(out, [round(v, 1) for v in vals])
