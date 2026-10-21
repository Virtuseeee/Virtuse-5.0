#!/bin/zsh
# Inter (SIL OFL) static TTFs from Google Fonts, only needed to re-outline the wordmark in build_svg.py.
mkdir -p fonts && curl -s -A curl "https://fonts.googleapis.com/css2?family=Inter:wght@400..900" -o fonts/inter.css
for W in 500 800; do URL=$(awk -v w="$W" '$0 ~ "font-weight: "w";"{f=1} f&&/url\(/{print; exit}' fonts/inter.css | grep -o "https://[^)]*"); curl -sL "$URL" -o fonts/Inter-$W.ttf; done
