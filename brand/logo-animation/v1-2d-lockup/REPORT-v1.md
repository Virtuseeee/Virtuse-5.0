# Animácia loga Virtuse — report pre Rasa (2026-10-21)

Stav: **súbory na schválenie, nič nie je nasadené** (ani staging, ani produkcia). Všetko je v repe v `brand/logo-animation/` (mimo priečinka webu, takže deploy skripty to nevidia).

## Štýl, ako je urobený
- Dĺžka 1,6 s (video súbory 2,0 s, outro 2,6 s), bez loopu okrem GIF.
- 0–0,68 s: ľavá časť „V“ sa vsunie z ľavého horného rohu, pravá o 80 ms neskôr z pravého, expo-out easing, žiadne otáčanie ani odraz.
- 0,56–1,12 s: jeden mäkký lesk gradientu prebehne cez značku (orezaný na tvar V).
- 0,76–1,31 s: písmená „Virtuse“ nabehnú zdola, 26 ms po sebe.
- 1,15–1,67 s (len video): podtitul „WEALTH MANAGEMENT“ sa rozsvieti; outro má navyše „virtuse.com“ od 1,55 s.
- Farby: modrý gradient z `favicon.svg` bez zmeny, text #e6edf3 na tmavom / #0d0d0d na svetlom (tokeny webu). Pozadie tmavej verzie #08090a (súčasné plátno webu).

## Vektorový wordmark
Vznikol: `web/virtuse-logo-mark.svg` = značka + „Virtuse“ ako krivky (Inter 800 prevedený na cesty cez fontTools, vrátane kerningu). Pomery sú podľa navigácie na virtuse.com (značka 26 px, text 21 px, účiaria na spodku značky) — porovnanie v `previews/nav-vs-lockup.png`. Text používa `currentColor`, takže funguje na tmavom aj svetlom.

## Výstupy
| Súbor | Použitie | Poznámka |
|---|---|---|
| `virtuse-logo-intro-1080x1920.mp4` (+ `-light`) | Reels intro | H.264, 30 fps, 2,0 s |
| `virtuse-logo-outro-1080x1920.mp4` (+ `-light`) | Reels outro | 2,6 s, končí s „virtuse.com“ |
| `virtuse-logo-square-1080.mp4` (+ `-light`) | Štvorec / feed | 2,0 s |
| `virtuse-logo-transparent-prores4444.mov` | Overlay pre strih (Premiere, FCP, Resolve, CapCut) | 1920×1080, alfa overená |
| `virtuse-logo-transparent-hevc-alpha.mov` | Overlay, malý súbor (Apple, iOS) | 262 kB |
| `web/virtuse-logo-mark.svg` | Statický lockup | vektor |
| `web/virtuse-logo-mark-animated.svg` | Web hlavička / loader, funguje aj ako `<img>` | CSS vnútri SVG, `prefers-reduced-motion` = statické logo |
| `web/virtuse-logo-anim.css` + `web/demo.html` | pre inline SVG | |
| `virtuse-logo-static-512.png`, `-1024.png` | Avatar X / IG (statický) | značka na #08090a |
| `virtuse-logo-mark-1024-transparent.png`, `virtuse-logo-lockup-2400-transparent.png` | Statické PNG s priehľadnosťou | |
| `virtuse-logo-loop-512.gif` (+ `-light`) | Prezentácie | 3 s loop, bez skoku, 20 fps |

Čo chýba oproti zadaniu: **`virtuse-logo-transparent.webm`**. Na tomto Macu nie je ffmpeg (Playwrightov build vie len VP8 bez PNG vstupu), takže priehľadný WebM som nevedel vyrobiť bez inštalácie ďalšieho nástroja. Náhrada sú dva MOV s alfou (ProRes 4444 je štandard pre strihačov). Ak WebM treba (napr. HTML5 overlay), po `brew install ffmpeg` to je jeden príkaz z PNG snímok v `src/pipeline.sh`.
Lottie JSON nevznikol; webová animácia je čisté CSS v SVG, čo je ľahšie a bez knižnice.

## Náhľady
`previews/intro-dark-frames.png`, `outro-light-frames.png`, `overlay-frames.png`, `loop-frames.png`, `final-check.png`, `nav-vs-lockup.png`.

## Návrh na staging (bez deployu)
1. `news.html` loader: inline `web/virtuse-logo-mark-animated.svg` do existujúceho „loading“ stavu stránky (hrá raz, 1,3 s, potom statické logo).
2. Alternatíva: v `.nav-logo` nahradiť SVG + `<span>Virtuse</span>` lockup SVG; prehrá sa raz pri načítaní stránky. Pomery sú rovnaké, takže sa nič nepohne.
Oboje je zmena jedného súboru, bez JS; urobím až po „ano“, najprv na staging.

## Kde nepoužiť (podľa zadania)
Gmail/Google avatar, BIMI, e-mail signature, hlavička Resend Briefu — ostávajú statické.

## Reprodukcia
`src/`: `fetch-fonts.sh` → `build_svg.py` (krivky) → `build_page.py` (stránka + CSS) → `render.cjs` (Playwright snímky) → `encode.swift` (AVAssetWriter: H.264, ProRes 4444, HEVC alfa) → `pipeline.sh` (všetko naraz). Potrebuje node + playwright-core z `~/Documents/virtuse-concierge-deploy/bitcoin-concierge`, Xcode CLT (swiftc), fontTools.
