# OG images for bitcoin-vs-gold.html

`en.html` → `og/bitcoin-vs-gold.jpg` (used by en and the 8 other languages),
`sk.html` → `og/bitcoin-vs-gold-sk.jpg` (sk only). 1200×630, same layout as the
other page OG images in `og/` (logo, mono eyebrow, orange headline tail, ring).
No numbers or prices on purpose, so the images never go out of date.

Render (needs network for Google Fonts):

```bash
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=6000 --screenshot=/tmp/en.png "file://$PWD/en.html"
sips -s format jpeg -s formatOptions 88 /tmp/en.png --out ../../../og/bitcoin-vs-gold.jpg
```

After changing an image, bump nothing: the URL stays the same, but social
networks cache previews for days (re-scrape in the Facebook / LinkedIn debuggers).
