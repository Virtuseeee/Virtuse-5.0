# Audit toku Verdict (EN + SK), 12. 11. 2026

Len čítanie. Kód som nemenil, nič som nenasadil, nič som nezaplatil a neodišiel žiadny e-mail.

**Čo som kontroloval**

- Kód: `origin/main` `2a0d7bbc0`. Produkčný Worker beží na tom istom commite (`GET /version`). Staging Worker je na `df414b3a`, kód Workera je rovnaký.
- Súbory `verdict.html`, `sk/verdict.html` a `verdict-lite.js` sú na produkcii, stagingu a v `main` zhodné (md5).
- Naživo, iba staging: neškodné požiadavky na staging Worker, vytvorenie testovacej Checkout Session (bez platby), prečítanie Stripe Checkout stránky v sandboxe, kroky lievika pred e-mailovou bránou.
- Dve čiastkové kontroly (skóre a obsah reportu, frontend lievika) robili pomocné čítania kódu; výsledky som prevzal a kľúčové body overil v kóde alebo naživo. Kde som neoveroval sám, je to uvedené.

**Skratky ciest**

- `W/` = `cloudflare-worker/src/`
- `FE` = `Kimi_Agent_Virtuse%20MiCA%20Partners/verdict-lite.js`

---

## Top 5 pred ďalším marketingom

1. **Platený report sa dá získať zadarmo cez staging** (nález 1). Staging je verejný, platí sa testovacou kartou a staging aj produkcia zapisujú do toho istého KV.
2. **Lievik pustí hodnoty, ktoré Worker pri platbe odmietne** (nález 2). Kupujúci dostane Lite skóre a pri tlačidle platby chybu „Niektoré odpovede chýbajú“. Overené naživo.
3. **Chyby v obsahu plateného reportu** (nálezy 3, 4, 5): falošné riziko „dôchodok do 10 rokov“, český príklad dane odporuje pravidlu nad ním, absurdné sumy pri mladom veku.
4. **O výpadku sa nemusíte dozvedieť** (nálezy 6, 7): upozornenie na zlyhané doručenie ide cez Resend, teda cez službu, ktorá práve zlyhala. Zlyhanie otvorenia platby sa nehlási nikam.
5. **Limity e-mailu a zdieľané počítadlá** (nález 8): 5 e-mailov na IP za hodinu a 3 na adresu; testy na stagingu míňajú produkčný limit tej istej adresy. Pravdepodobná príčina minulého 429.

---

## Nálezy

### Vysoké

**1. Platený report zadarmo cez staging; produkcia prijme aj `cs_test_` session**

- Kde: `cloudflare-worker/wrangler.toml:25` a `:62` (rovnaké id `RATE_LIMIT_KV`), `W/features/verdict-pay/domain.js:20` (`SESSION_RE` berie `cs_test` aj `cs_live`), `W/features/verdict-pay/handler.js:227-233` (`paidReport` nekontroluje `livemode`).
- Ako zopakovať, cesta A: otvoriť `staging.virtuse.com/verdict.html` (odpovedá 200, je len `noindex`), prejsť lievik, zaplatiť Stripe testovacou kartou. Report sa otvorí a PDF sa dá stiahnuť. PDF e-mail ide na vasilisin@virtuse.com.
- Cesta B (odvodené z kódu, na produkcii som netestoval): záznam `verdict:paid:cs_test_…` zo stagingu leží v spoločnom KV, takže produkčný `POST /verdict/report` s tým istým id nájde zaplatený záznam a report vydá.
- Dopad: obídenie platby 14 €; cudzie testy vám chodia do schránky.
- Oprava: staging dostane vlastný KV namespace; produkcia odmietne `cs_test_` a záznam s `livemode: false`; zvážiť ochranu stagingu (Cloudflare Access alebo heslo).

**2. Prehliadač prijme hodnoty, ktoré Worker odmietne**

- Kde: `FE:399` (iba `min="0"`, mimo formulára sa nevynucuje), `FE:422-427` (`check()` testuje len „nie je prázdne“), Worker `W/features/verdict-lite/rules.js:23-48` (vek 0–120, sumy 0–1e10).
- Ako zopakovať: krok 1, vek `150`, `-5` alebo `3`. Tlačidlo Continue je aktívne (overené naživo na stagingu). Worker pri platbe vráti 400 `badAnswers` (overené cez API: záporný `btc`, `savings` 1e11).
- Dopad: kupujúci stratený pri tlačidle platby, hláška nepovie, ktoré pole je zlé. Záporný `btc` dá veľkosti pozície 10/10.
- Súvisí: Worker prijme vek 0 a dôchodok nižší ako vek (overené cez API, vznikla Checkout Session). Desatinný vek dá „v roku 2049.75“. Suma do Bitcoinu vyššia ako úspory dá „5000 % úspor“.
- Oprava: rovnaké hranice a celé roky v `check()`, chyba pri poli; Worker: vek 18–120, `retire >= age`; hlášku mapovať na krok podľa `detail`.

**3. Falošné riziko „dôchodok do 10 rokov“**

- Kde: `W/features/verdict-lite/rules.js:95-96` (obava `retire` pridá medzeru `retire` bez ohľadu na roky), text `report.js:119` a `:257`.
- Ako zopakovať: vek 41, dôchodok 65, 5 000 € zo 150 000 €, rezerva 6+, daň „áno“, úschova „assisted“, obava „retire“.
- Dopad: platený report tvrdí „do dôchodku menej ako 10 rokov“ človeku, ktorý má 24 rokov.
- Oprava: zvýhodniť `retire` len pri `years < 10 && share >= 20`, inak neutrálny text.

**4. Český príklad dane odporuje pravidlu nad ním**

- Kde: `W/features/verdict-lite/blocks.js:14` (`hold: 3`), `:265-268`; pravidlo `W/generated/lite-tax.js:10`.
- Ako zopakovať A: CZ, vek 18, dôchodok 65, 20 000 € + 200 €/mes. Predaj vysoko nad stropom 40 mil. CZK, report píše „daň 0 €“.
- Ako zopakovať B: CZ, vek 64, dôchodok 65. Predaj pod 100 000 CZK, report ukáže daň.
- Dopad: daňové tvrdenie v platenom produkte si odporuje. Nemecký príklad rovnako ignoruje limit 1 000 €.
- Oprava: uplatniť strop a limit v príklade, alebo v texte napísať, že ich príklad neberie do úvahy.
- Pôvod: pomocné čítanie so spustením pravidiel v node; riadky som sám neprepočítaval.

### Stredné

**5. Scenár +20 % ročne dáva absurdné sumy**

- Kde: `blocks.js:22`, `:167-176`; formátovanie `report.js:14`.
- Ako zopakovať: SK, vek 18, dôchodok 65, 20 000 € + 200 €/mes. Report: „hypotetická hodnota 175 169 165 €“, „daň spolu 3 053 729 €“. Na hraniciach vstupov vypíše číslo s `e+21`.
- Oprava: obmedziť horizont alebo sumy, bezpečné formátovanie.

**6. Upozornenie na zlyhané doručenie závisí od Resend**

- Kde: `W/features/verdict-pay/alerts.js:72-96`, volané z `handler.js:178`.
- Problém: pri chybe Resend ide aj upozornenie cez Resend. Počítadlo pokusov sa zvýši, aj keď upozornenie neodišlo, takže ďalšie príde až pri 5. pokuse Stripe (rádovo hodiny).
- Dopad: zákazník zaplatil, PDF nemá, vy o tom neviete.
- Oprava: druhý kanál (Cloudflare Email Routing, Slack webhook alebo alert z Workers Logs); pokus počítať až po odoslanom upozornení.

**7. Zlyhania pred platbou sa nikam nehlásia**

- Kde: `handler.js:84-86` (len `console.error`), `FE:659-663` (bez dataLayer udalosti).
- Dopad: ak Stripe odmieta Checkout (napr. nastavenie Stripe Tax), nikto nemôže platiť a vidno to len v logoch Workera (7 dní).
- Oprava: udalosť `verdict_checkout_failed` do dataLayer a upozornenie po N chybách za hodinu.

**8. Limity `/send` a zdieľané počítadlá**

- Kde: `W/features/send/handler.js:23-24`, `:31-33`, `:54-62`; `W/shared/rate-limiter.js:12-17`.
- Produkcia: 5 na IP za hodinu, 3 na adresu. Kľúč adresy je `sha256(e-mail)` bez soli a leží v spoločnom KV, takže 3 testy na stagingu zablokujú tú istú adresu na produkcii.
- Okno sa pri každom započítanom pokuse predĺži (nový `expirationTtl`), nie je pevné.
- Dopad: firma, škola alebo mobilný operátor za jednou IP narazí na 429 po 5 ľuďoch za hodinu.
- Oprava: vlastný KV pre staging; vyšší limit na IP (napr. 20), limit na adresu nechať; pevné okno.
- Správanie pri 429 (z kódu, `FE:616-618`): návštevník skóre uvidí s varovaním, tlačidlo na opakovanie chýba.

**9. `session_id` zostáva v URL plateného reportu**

- Kde: `FE:841-842` (návrat pred `replaceState` na `:850`); okno 30 minút `domain.js:12`.
- Dopad: id je kľúč k reportu (meno, financie). Zostáva v histórii a pri súhlase s analytikou ide v `page_location` do GA4. Pred prvým otvorením nie je okno časovo obmedzené.
- `Referer` na cudzie weby je v poriadku (`strict-origin-when-cross-origin`).
- Oprava: id uložiť do `sessionStorage` a URL vyčistiť pred načítaním GTM.

**10. `/verdict/report` nemá limit a volá Stripe**

- Kde: `handler.js:224-232`, `:245-262`.
- Ako zopakovať: `POST /verdict/report` s vymysleným id v správnom tvare; odpoveď 402 po ~0,7 s (overené na stagingu), každé volanie je požiadavka na Stripe API.
- Dopad: ktokoľvek môže vyčerpať limit Stripe API a tým zablokovať otváranie platieb.
- Oprava: limit na IP ako pri `/verdict/checkout`.

**11. Súbeh webhooku a návratu zo Stripe prepisuje záznam objednávky**

- Kde: `W/features/verdict-pay/store.js:30-35`, `handler.js:227-238`, `:156-183`.
- Problém: KV nie je atomické a čítanie môže byť až minútu staré. Webhook a `POST /verdict/report` prídu v rovnakých sekundách a navzájom si prepíšu `emailedAt` alebo `usedAt`.
- Dopad: po 24 h môže zákazník, ktorý PDF dostal, vidieť „napíšte nám, platbu vrátime“ (`expired` namiesto `emailed`); 30-minútové okno sa môže spustiť znova. Dvojitý e-mail nehrozí (Resend Idempotency-Key).
- Oprava: zapisovať polia do samostatných kľúčov, alebo Durable Object. Neoverené naživo.

**12. Platobné metódy v Checkoute nesedia s podmienkami**

- Kde: Stripe Dashboard; podmienky 5a „You pay by card“; README Workera krok 5.
- Zistené naživo v sandboxe: Karta, MB WAY, Bancontact, EPS, Satispay.
- Dopad: podmienky hovoria o karte. Pri metódach s oneskoreným potvrdením môže platba prísť po 24 h, keď sú odpovede zmazané (`result_expired`, ručný refund).
- Živý účet som nevidel: neoverené.
- Oprava: v Dashboarde nechať kartu a peňaženky, alebo v kóde poslať `payment_method_types: ['card']`.

**13. Každý klik na platbu vytvorí novú session a nový záznam odpovedí**

- Kde: `handler.js:59` (`newRid()` pri každom volaní), komentár `:75-76` pre Lite neplatí; `FE:651` vypne len kliknuté tlačidlo, na stránke sú štyri.
- Overené na stagingu: tri volania, tri rôzne session.
- Dopad: dve záložky znamenajú možnú dvojitú platbu; odpovede sa ukladajú na 24 h aj bez platby.
- Oprava: `rid` držať v `sessionStorage` a posielať znova; vypnúť všetky `[data-buy]`.

**14. Ochrana údajov: text nesedí so správaním**

- Privacy §9 a `verdict.html:251`: „odpovede opustia zariadenie, len ak si kúpite report“. V skutočnosti odídu pri kliknutí na tlačidlo platby a ležia 24 h aj po zrušení (`handler.js:60`).
- Lite e-mail s odberom Briefu obsahuje naraz „Nepridali sme vás do žiadneho zoznamu“ a „Prihlásili ste sa aj na Brief“ (`W/features/send/domain.js:527`, texty `:285`, `:139`).
- Brief cez bránu nemá potvrdenie adresy (double opt-in): ktokoľvek prihlási cudziu adresu (`send/handler.js:101`). Dôkaz súhlasu je slabý.
- Ak zlyhá pridanie do Briefu, odpoveď je 502, hoci skóre už odišlo (`send/handler.js:99-105`); návštevník to skúsi znova a dostane druhý e-mail.
- Oprava: upraviť dve vety; vetu „žiadny zoznam“ vynechať pri `brief`; double opt-in; pri chybe Briefu vrátiť 200 s príznakom.

**15. Vzorový report na stránke nie je to, čo Worker vyrobí**

- Kde: `verdict.html:404-408`, `sk/verdict.html` (rovnaký blok).
- Krok 3 vzorky hovorí „nastavte 200 € mesačne“. To je pokyn kúpiť; `report.js:5-6` hovorí, že žiadny krok nemá radiť kúpu. Skutočný report pre Annu dá kroky daň, kľúče, veľkosť.
- Oprava: vzorku generovať z `liteReportView(ANNA)`.

**16. Rada „zmažte zariadenie a obnovte“ bez varovania pre držiteľa**

- Kde: `rules.js:69`, `report.js:140`, `blocks.js:83`.
- Dopad: skúsený držiteľ s vlastnými kľúčmi dostane krok „vymazať a obnoviť“, hoci v peňaženke môže mať celý majetok.
- Oprava: „najprv na prázdnom alebo náhradnom zariadení“.

**17. Stiahnuté tlačidlo platby po návrate späť**

- Kde: `FE:651`, `:658`; chýba obsluha `pageshow`.
- Ako zopakovať: klik na platbu, v Stripe tlačidlo Späť v prehliadači. Tlačidlo môže zostať vypnuté s textom „Otváram platbu…“. Z kódu, naživo neoverené.
- Oprava: pri `pageshow` s `persisted` tlačidlá zapnúť.

**18. Kroky sa dajú preskočiť cez URL**

- Kde: `FE:350-355` (`guard()` chráni len obrazovky 6–8), `FE:593`.
- Overené naživo: `sk/verdict.html?s=5` otvorí posledný krok bez predošlých odpovedí. `?s=8` bez e-mailu vráti na krok 1 (v poriadku).
- Dopad: skóre z predvolených hodnôt, platba potom zlyhá ako v náleze 2.

**19. Staging `withdrawal.html` volá produkčný Worker**

- Kde: `vb-api.js:33` (`/verdict/withdraw` chýba v `STAGE_ROUTES`), `withdrawal.js:34`.
- Dopad: test odstúpenia na stagingu pošle skutočné oznámenie na info@virtuse.com a potvrdenie na zadanú adresu.

**20. Upozornenie na bounce nemá číslo objednávky**

- Kde: `alerts.js:140-144`.
- Dopad: v upozornení je len maskovaná adresa a id e-mailu v Resend; platbu v Stripe podľa toho ťažko nájdete.
- Oprava: pri odoslaní pridať tag s číslom objednávky a vypísať ho.
- Stav: webhook Resend pre produkciu existuje a je zapnutý (`email.bounced`, `email.complained`, vytvorený 11. 11. 2026). Na stagingu nie je nastavený (odpoveď 503).

### Nízke

**21. Formulár odstúpenia pošle e-mail na ľubovoľnú adresu**

- Kde: `W/features/verdict-pay/withdraw.js:69-112`. Zámer (zákon), limit 10/h na IP, meno do 120 znakov bez `<>"`. Bez ochrany proti dvojkliku na serveri.
- Dopad: malé riziko zneužitia na obťažovanie a zahltenie info@.

**22. Zvyšok súkromia**

- `ipHash` má záložnú soľ `'virtuse'`, ak chýba `UNSUB_SECRET` (`W/shared/crypto.js:60`). Či je tajomstvo na stagingu nastavené: neoverené.
- Odpovede vrátane mena a e-mailu ležia v `sessionStorage` (`vb-verdict-lite`) do zavretia záložky (`FE:323-326`); na zdieľanom počítači ich uvidí ďalší človek.
- Adresa, ktorú Resend odmietol, zostane uložená a predvyplní Stripe (`FE:602`, `:615`, `:655`).

**23. Poradie udalostí Stripe**

- `charge.refunded` pred `checkout.session.completed` sa zahodí, lebo väzba `verdict:pi:` ešte neexistuje (`handler.js:210-217`). Report potom zostane otvorený aj po refunde. Zriedkavé.
- Či má živý webhook zapnutú udalosť `charge.refunded`: neoverené.

**24. Texty v reporte**

- Bez mena začína zhrnutie malým písmenom (`report.js:65-66`, `:381`).
- „in 1 years“, „o 1 rokov“ (`FE:96`, `FE:159`, `report.js:82`, `:143`).
- „Uberá 2 body“ aj keď je skóre na minime 1 (`report.js:55`, `:59`).
- Tá istá oblasť je naraz „v poriadku“ aj riziko (`report.js:417`).
- „0 až 10 bodov, najviac 60“, ale úschova má najviac 9, teda 59 (`report.js:46`, `rules.js:69`).
- Lite ukážka sľubuje „dobu držby, limit oslobodenia“ aj pre Slovensko, ktoré nemá ani jedno (`FE:111`).
- SK „Hypotetická suma na zdanenie“ oproti EN „Hypothetical tax on this sale“ (`blocks.js:111`, `:45`).
- PDF vynechá v mene znaky mimo písma, napr. „ș“ (`pdf.js:60`).

**25. EN oproti SK na stránke**

- `sk/verdict.html:171`: odkaz na ochranu údajov vo FAQ nemá kotvu `#verdict-cfo`.
- Prepnutie jazyka uprostred toku vráti na úvod; odpovede zostanú, rozpísaný e-mail sa stratí (`verdict.html:69`, `:512`).
- Obe stránky majú stále `noindex` a poznámku TODO k spusteniu (`verdict.html:15-16`).

**26. XSS a CSRF**

- Zneužiteľné miesto som nenašiel. Meno je jediný voľný text; Worker z neho odstráni `<>&"` a skráti na 40 znakov (`rules.js:55`), prehliadač reťazce escapuje, PDF kreslí len text. Overené cez API: meno s `<b>` a `{{a}}` prešlo validáciou a session vznikla.
- Neescapované čísla a farba z vlastného Workera (`FE:746`, `:481`, `:700`, `:703`): spevniť cez `Number()` a zoznam farieb.
- CSRF: trasy nepoužívajú cookies ani prihlásenie. Kontrola `Origin` nie je ochrana proti skriptom mimo prehliadača; ochranou sú limity.

**27. Odpadový kód**

- `verdict-flow.js` (1 410 riadkov) nenačítava žiadna stránka.
- `MOCK` zahŕňa `127.0.0.1`, ale `IS_STAGE` len `localhost` (`FE:34`, `vb-api.js:25`): náhľad na 127.0.0.1 volá produkčný Worker.

---

## Skontrolované a v poriadku

- Podpis Stripe webhooku: bez podpisu 400 (overené), tolerancia 300 s, porovnanie v konštantnom čase.
- Podpis Resend webhooku (Svix) v kóde; nepodpísaná požiadavka sa nespracuje.
- Nezaplatená skutočná testovacia session report ani PDF nevydá (402, overené).
- Opakované doručenie webhooku nepošle druhý e-mail (`emailedAt`, 60 s zámok, Idempotency-Key).
- Partneri a poplatky v platenom reporte sú vypnuté (`VERDICT_REPORT_PARTNERS` nie je vo `wrangler.toml`). Pomocné čítanie vykreslilo 324 kombinácií EN aj SK bez mena partnera či poplatku. Zostávajú odkazy na `/secure.html` a `/tax-agent.html` a zmienka „Strategy / Michael Saylor“ (`blocks.js:38`).
- Skóre v prehliadači a vo Workeri sa zhoduje (4 082 400 kombinácií, 0 rozdielov; pomocné čítanie). Hranice známok sú rovnaké v pravidlách, e-maile aj reporte. Vzorka 75/100 B sedí.
- Slovenské daňové texty si medzi súbormi neodporujú (19 až 35 %, bez oslobodenia podľa držby, každá výmena zdaniteľná). Právnu správnosť som neposudzoval.
- Lite e-mail berie len pevné id a overené čísla; skóre, ktoré nesedí s oblasťami, Worker odmietne (overené).
- Bez `Origin` alebo s cudzím `Origin` odpoveď 403; CORS neodráža cudzí pôvod (overené).
- V kóde nie sú tajomstvá; staging má poistku `STRIPE_TEST_ONLY`.
- Checkout SK: e-mail predvyplnený, text o 30-dňovom vrátení a 14-dňovom odstúpení je nad tlačidlom, názov produktu po slovensky.
- Žiadne zrieknutie sa práva na odstúpenie v kóde ani v e-mailoch.

---

## Dodatok: test Lite e-mailu na stagingu (12. 11. 2026, 09:22 UTC)

Po vašom súhlase som poslal ten istý Lite e-mail dvakrát za sebou na vasilisin@virtuse.com cez staging Worker.

- Obe požiadavky skončili `200 {"ok":true}` (0,6 s a 0,4 s).
- Resend eviduje dva e-maily s predmetom „Vaše Virtuse Verdict Lite skóre: C · 60/100“, odoslané 8 sekúnd po sebe; prvý je v stave `delivered`, druhý bol pri kontrole `sent`.
- **Nový nález 28 (nízky): `/send` nemá ochranu proti duplicitnému odoslaniu.** Rovnaké telo dvakrát znamená dva e-maily (`W/features/send/handler.js:74-85`, bez `idempotencyKey`). Prehliadač dvojklik blokuje (`FE:606`), no návrat na bránu a nové odoslanie pošle ďalší. Oprava: `idempotencyKey` z hashu adresy a skóre na krátke okno.
- Tieto dve odoslania sa započítali do spoločného počítadla adresy (nález 8): na produkcii má táto adresa do cca 10:22 UTC voľný už len jeden Lite e-mail.
- V Resend je vidno aj včerajší test bounce (11. 11., 17:02 UTC): upozornenie „Verdict delivery problem: bounced“ na info@virtuse.com bolo doručené, takže cesta bounce → upozornenie na produkcii funguje.

---

## Čo som nemohol overiť

- **Skutočnú platbu a všetko po nej**: testovaciu kartu do Stripe nezadávam. Neoverené naživo: webhook po platbe, doručenie PDF, vzhľad PDF, obrazovka reportu, 30-minútové okno, správa po 24 h, refund, zlyhaná platba.
- **Lite e-mail, zvyšok**: doručenie a duplicitu som overil (pozri dodatok nižšie). Neoverené naživo: správanie pri 429, neplatná adresa a bounce Lite e-mailu.
- **Cestu B z nálezu 1** na produkcii (testovať som smel len staging).
- **Živý Stripe účet**: platobné metódy, Apple Pay a Google Pay, Stripe Tax a DPH po zadaní adresy (v sandboxe pred adresou „Daň 0,00 €“), udalosti webhooku, faktúry.
- **Tajomstvá a premenné nasadeného Workera** (`VERDICT_REPORT_PARTNERS`, `UNSUB_SECRET`, `VERDICT_ALERT_TO`): čítal som len `wrangler.toml`.
- **Právnu správnosť** daňových sadzieb, pásiem a termínov (SK, CZ aj ostatné krajiny) a model odstúpenia.
- **Či GA4 naozaj zapisuje URL so `session_id`** a čo posiela Cloudflare Web Analytics.
- **Mobil a skutočné správanie tlačidla Späť** (bfcache) v prehliadačoch.
- **Kartu „72/100 B“** v Brief Tools: v `news.html`, `sk/news.html` ani `news/news.js` na `main` som ju nenašiel. Skóre 72 pravidlá nevedia vyrobiť (kroky po 5).
- **Limit CPU Workera** pri tvorbe PDF vo webhooku.
- **RU a UK** verzie.
