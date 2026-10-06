# Handover: logo pás „You're in good company“ na homepage

Stav k 2026-10-05: **hotovo a nasadené na produkciu** (main `60694aa`, gh-pages `a22bc1b`; rail z `data/partners.json`, skript `i18n-tools/build_partner_rail.py`). Ras spustil `bash ../deploy_site.sh 12e7379`, 11/11 súborov sedí md5 na virtuse.com. Rozdelenie radov je buy + custody + treasury (11) a loans + tax + bots + mining (11) + Finas, lebo pôvodné rozdelenie v prompte dávalo 12/10.

## O čo ide

Pás log „You're in good company“ (`section.company`) je na všetkých 10 homepage
(`index.html` + `cs, de, es, fr, hu, pl, ru, sk, uk/index.html`) a nikde inde.
Dnes má 16 log, z ktorých len 7 patrí medzi 22 partnerov uvedených na stránkach kategórií.

Problémy:

- **Nepartneri:** Banxa, Coinfirm (dnes Lukka) a Unchained nemajú kartu na žiadnej stránke.
  Banxa a Coinfirm sme z nástrojov (Concierge, Stacking, Tax Agent) vyhodili už skôr.
- **Dodávatelia, nie partneri:** AWS, TradingView, Sumsub. Pôsobí to ako ich odporúčanie Virtuse.
- **Stará burza:** CoinMarketCap a Cryptowisser odkazujú na zápis „Virtuse Exchange“.
  To je v rozpore s FAQ „Virtuse nie je burza“.
- **Počet:** pás nesedí s tvrdením „22 partnerov“ v hero a v SEO titulkoch.
- **Provízie:** logá vedú priamo na weby partnerov bez affiliate odkazu, takže z týchto
  kliknutí nie sú provízie ani dáta.

## Rozhodnutia (od Rasa, 2026-10-05)

- V páse má byť presne 22 partnerov s kartou na stránke kategórie (zoznam nižšie v prompte).
- **Finas ostáva.** Je to Fintech & Insurtech Association of Slovakia
  (https://finas.sk/en/domov/), teda združenie, nie poskytovateľ služby. Preto ide do pásu ako
  člen združenia, mimo počtu 22 partnerov, s odkazom na finas.sk.
- **Sumsub ide preč.**
- Odkazy partnerov vedú na našu stránku kategórie, nie na web partnera.

## Na čo si dať pozor

- Na úvodnej stránke finas.sk je v navigácii odkaz „brucebet casino“. Vyzerá to na podvrhnutý
  spam. Pred nasadením over, či tam ešte je. Ak áno, daj vedieť Rasovi; možno bude chcieť
  Finas upozorniť alebo odkaz zatiaľ nedávať.
- Či je Virtuse v zozname členov Finas, sa overiť nedalo, zoznam na ich webe sú len logá.
  Potvrdenie členstva má Ras.
- `aml-compliance.html` (10 jazykov) stále píše, že KYC prebieha cez Sumsub. Je to samostatná
  vec na právnu kontrolu, v tejto úlohe sa nemení.
- Nasadenie na produkciu spúšťa Ras sám (zadáva heslo). Na jeho Macu (rastislavs-macbook-air)
  je SFTP login `virtuse.com` uložený v `~/.ssh/config`, `deploy_site.sh` ho ponúkne ako
  predvolený. Heslo nikdy nepýtaj ani nepíš do chatu.

## Prompt pre agenta

Skopíruj celý blok do Claude Code otvoreného v repe.

```text
ÚLOHA
Prestav logo pás „You're in good company“ (section.company, .co-ticker) na všetkých 10 homepage
webu Virtuse. Pás má ukazovať presne 22 partnerov, ktorí majú kartu na stránkach kategórií,
plus Finas ako združenie, ktorého je Virtuse členom. Nič iné na stránkach nemeň.

PREČO
Pás dnes ukazuje firmy, ktoré nie sú partnermi (Banxa, Coinfirm, Unchained), dodávateľov
(AWS, TradingView, Sumsub) a odkazy na starú „Virtuse Exchange“ (CoinMarketCap, Cryptowisser),
čo je v rozpore s FAQ „Virtuse nie je burza“. Nesedí to s tvrdením „22 partnerov“ a je to
riziko zavádzania. Navyše logá odkazujú priamo na weby partnerov bez affiliate odkazu.

KDE
Repo: /Users/rasvas/Library/CloudStorage/OneDrive-VirtuseWealthManagement,a.s/Virtu AI
Web: Kimi_Agent_Virtuse%20MiCA%20Partners/ (statické HTML, bez buildu). Najprv si prečítaj
CLAUDE.md a partnerships/HANDOVER-partner-rail.md.
Súbory: index.html + cs, de, es, fr, hu, pl, ru, sk, uk /index.html (pás je len tam).

POSTUP
1. Vytvor data/partners.json (name, category, logo, page):
   buy (buy-bitcoin.html): 21bitcoin (logo-21bitcoin-app.png), ByBit EU (logo-bybit.png),
     Kraken (logo-kraken.png), Crypto.com (logo-crypto-com.png), Invity (logo-invity.svg)
   custody (secure.html): Blockstream, Ledger, Trezor
   mining (mining.html): Abundant Mines, OneMiners, PowerMining
   loans (lending.html): Firefish
   tax (tax.html): Koinly, Blockpit, CoinTracking, Divly
   treasury (treasury.html): BitGo, Coinbase, Sygnum
   bots (bots.html): Coinrule, Cryptohopper, RevenueBot
   Logá sú v koreni webu ako logo-<meno>.png/svg. Najprv over, že zoznam presne sedí s logami
   na týchto 7 stránkach (grep logo-*.png/svg). Ak nie, zastav sa a nahlás rozdiel.
   Finas zapíš zvlášť: category "association", url https://finas.sk/en/domov/, do počtu
   partnerov sa nezapočítava.
2. Z pásu odstráň: Banxa, Coinfirm, Unchained, AWS, TradingView, CoinMarketCap, Cryptowisser,
   Sumsub, aj ich CSS (.co-banxa, .co-coinfirm, .co-unchained, .co-aws, .co-tradingview,
   .co-cmc, .co-cryptowisser, .co-sumsub). Finas ponechaj.
3. Nový pás: 2 rady po 11 partnerov (rad 1: buy + custody + loans + treasury,
   rad 2: tax + bots + mining). Logá ako <img> s alt = meno partnera, výška ~28 px,
   filter grayscale(1) + opacity 0.6, plná farba pri hoveri. Finas daj na koniec radu 2
   ako existujúcu textovú značku (.co-finas) s title="Member of FINAS – Fintech & Insurtech
   Association of Slovakia". Ponechaj animáciu .co-row, duplikát .co-set s aria-hidden="true"
   a tabindex="-1" a blok prefers-reduced-motion.
4. Odkazy partnerov smerujú na stránku kategórie v jazyku homepage (EN buy-bitcoin.html,
   v sk/ buy-bitcoin.html v tom istom priečinku atď.), bez target=_blank. Na stránke kategórie
   je karta s trackovaným affiliate odkazom. Finas odkazuje von na https://finas.sk/en/domov/
   (target=_blank rel="noopener noreferrer"). Cesty k logám z podpriečinkov s ../.
5. Nadpis sekcie v každom jazyku ponechaj bez zmeny.
6. Kontrola:
   - tagcheck 0 chýb (i18n-tools/layer2/tagcheck.py) na všetkých 10 súboroch
   - na 10 homepage 0 výskytov odstránených mien (Banxa, Coinfirm, Unchained, aws, TradingView,
     CoinMarketCap, Cryptowisser, Sumsub)
   - v sade bez aria-hidden je 22 partnerských log + Finas
   - každý odkaz partnera vedie na existujúcu stránku kategórie v správnom jazyku
   - prehliadač pri 1440 a 375 px: bez horizontálneho pretečenia, animácia beží, logá sa
     načítajú (žiadne 404), žiadne nové chyby v konzole (známa chyba GTM ga-audiences je OK)
   Lokálny server spusti z priečinka webu: python3 -m http.server 8891
7. Commit na main (10 homepage + data/partners.json), push. Nasadenie spúšťa používateľ:
   bash ../deploy_site.sh <commit pred zmenou> z priečinka webu (heslo zadáva sám, nikdy ho
   nepýtaj). Po nasadení over md5 všetkých súborov na virtuse.com.
8. Do CLAUDE.md pridaj krátky záznam a pravidlo: pás = presne partneri s kartou na stránke
   kategórie (zdroj data/partners.json) + Finas ako združenie mimo počtu partnerov.
   V tomto handoveri označ úlohu ako hotovú (dátum, commit).

MIMO ROZSAHU
- aml-compliance.html (10 jazykov) stále píše, že KYC prebieha cez Sumsub; to je samostatná
  vec na právnu kontrolu, nemeň to.
- Sekcia „As seen in“ (médiá) ostáva bez zmeny.
```

## Hotovo, keď

- všetkých 10 homepage na virtuse.com ukazuje 22 partnerov + Finas a nič z odstránených mien,
- md5 súborov na produkcii sedí s `main`,
- CLAUDE.md a tento súbor majú záznam o dokončení.

## Update 2026-10-06: Finas removed

Na https://finas.sk/en/domov/ je skrytý podvrhnutý odkaz „brucebet casino“ (no.brucebett.com, `left:-6813px`) — web Finas je napadnutý. Finas sme z pásu odstránili (`memberships: []`), pás = presne 22 partnerov. Vrátiť: doplniť záznam do `data/partners.json` a spustiť `i18n-tools/build_partner_rail.py`.
