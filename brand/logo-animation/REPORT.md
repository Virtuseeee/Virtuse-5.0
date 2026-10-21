# Animácia loga Virtuse, verzia 2.2 (3D kov) — report pre Rasa (2026-10-21)

Stav: **súbory na schválenie, nič nie je nasadené.** Všetko je v `brand/logo-animation/` (mimo priečinka webu). Prvá verzia (plochý lockup s názvom) je odložená v `v1-2d-lockup/`.

## Úpravy v 2.2 (podľa pripomienok)
- Oba diely menej sýte: ľavý oceľovo belasý (#74B0D2), pravý tlmený tmavomodrý (#263A68), slabšie odrazy prostredia (0,7 / 0,4).
- Hrany ešte mäkšie: key 1,3, rim 0,08, lak drsnosť 0,45, bevel 0,11 s 10 segmentmi, slabší horný pás svetla.

## Úpravy v 2.1
- Jemnejšie hrany: slabší key a rim, drsnejší číry lak, väčší a hladší bevel.
- Sklz svetla ponechaný (0,9–1,9 s).
- Tempo ×0,8: intro 2,5 s, outro 3,6 s, loop 3,6 s.
- Kontrast dielov: ľavý belasý (#4EC4FF, kov 0,8), pravý tmavomodrý (#0F2A6B) s potlačeným lakom, takže odlesk ostáva modrý a nejde do biela.

## Čo sa zmenilo oproti v1
- Len značka „V“, bez názvu Virtuse a bez podtitulu.
- Značka je 3D: obe časti V sú vytlačené do hĺbky so zaoblenými hranami (ako kocky v hlavičke), materiál kovový s číry lak (clearcoat), farby z brandu: svetlá modrá (ľavý diel) a hlboká modrá (pravý diel).
- Nasvietenie prevzaté z kocky na virtuse.com (rovnaký ACES tone mapping, key/fill/rim/front svetlá) + vlastné štúdiové prostredie s pásovými svetlami, ktoré po kove kĺžu ako chrómové pruhy (referencia Glossy Metal Logo). Jeden bodový „sklz“ svetla prejde cez značku v 0,7–1,5 s.
- Choreografia (pred spomalením 2,0 s, teraz 2,5 s): ľavý diel priletí zľava a otočí sa do roviny, pravý diel o 100 ms neskôr sprava; celá značka sa pri tom pomaly pootočí (pruhy odrazov sa posúvajú po plochách), ustáli sa čelom ku kamere s jemným dýchaním ±3°. Outro drží 3 s s pomalým otáčaním.

## Výstupy
| Súbor | Použitie |
|---|---|
| `virtuse-logo-intro-1080x1920.mp4` (+ `-light`) | Reels intro, 2,5 s |
| `virtuse-logo-outro-1080x1920.mp4` | Reels outro, 3,6 s s otáčaním |
| `virtuse-logo-square-1080.mp4` (+ `-light`) | Štvorec |
| `virtuse-logo-feed-1080x1350.mp4` | Instagram/LinkedIn feed 4:5 |
| `virtuse-logo-wide-1920x1080.mp4` | X, LinkedIn, YouTube 16:9 |
| `virtuse-logo-transparent-prores4444.mov`, `-hevc-alpha.mov` | Overlay s priehľadnosťou (alfa overená) |
| `virtuse-logo-static-512.png`, `-1024.png` | Avatar X / IG, 3D značka na #08090a |
| `virtuse-logo-mark-1024-transparent.png` | Statické PNG s priehľadnosťou |
| `virtuse-logo-loop-512.gif` (+ `-light`) | Prezentácie, 3,6 s loop |
| `web/virtuse-logo-3d.html` | Web: Three.js stránka (rovnaký import three.js ako kocka), `?play=1` prehrá a ostane v jemnom otáčaní; `prefers-reduced-motion` = statická snímka |

Svetlá verzia: biele pozadie, značka a odrazy rovnaké (kov nepotrebuje inú farbu textu).

Chýba stále priehľadný **WebM** (na Macu nie je ffmpeg); MOV s alfou ho nahrádza.

## Náhľady
`previews/intro-frames.png`, `wide-frames.png`, `loop-frames.png`, `final-check.png` (avatar, svetlý štvorec, overlay na farebnom pozadí), `material-tests.png` (skúšané nastavenia kovu a farieb), `settled-detail.png` (ustálená značka v plnom rozlíšení), `reference-hero-cube.png` (kocka z hlavičky, pre porovnanie).

## Návrh na staging (bez deployu)
- news.html loader alebo hero: `<iframe src="web/virtuse-logo-3d.html?play=1&theme=transparent&size=0.9">`, alebo modul vložiť vedľa skriptu kocky (zdieľajú import map). Urobím po „áno“, najprv staging.

## Čo doladiť, ak chceš
- Intenzita sklzu svetla (`sweep`), lesk (`rough`), tempo (všetko sú parametre v URL stránky, viď `web/README.md`).
- Variant s pomalou kamerou obiehajúcou okolo značky (ako referencia) namiesto ustálenia čelom.
