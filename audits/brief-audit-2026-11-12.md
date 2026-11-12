# Audit Virtuse Brief, 12. 11. 2026

Rozsah: `news.html`, `sk/news.html`, `news/news.js`, Worker `virtuse-newsletter` (Pulse, newsletter), dáta `/data/*.json`. Len čítanie. Nič som nemenil, nedeployoval ani neposielal.

Stav, voči ktorému som kontroloval:

- Kód: `origin/main` `4c4c9b431`. Súbory Briefu na produkcii sú s ním zhodné (md5: `news.html`, `sk/news.html`, `news/news.js`, `news/news.css`, `issues.json`, `issues-sk.json`, `news-pulse.json`, `vb-api.js`).
- Produkčný Worker: `/version` = `2a0d7bbc`. Kód Pulse a newslettera je v ňom rovnaký ako na main. Nenasadené sú zmeny z `08d14421f` (Verdict, nový `rate-limiter.js`).
- Živý Pulse v čase kontroly: `updated` 2026-11-12T05:32:31Z, 3 položky, všetky so slovenským textom.
- Čísla riadkov platia pre `origin/main` `4c4c9b431`. Cesty k webu sú bez prefixu `Kimi_Agent_Virtuse%20MiCA%20Partners/`, cesty k Workeru bez `cloudflare-worker/`.

Kritický nález som nenašiel. Vysokých je 6, stredných 17, nízkych 14.

## Top 5 na opravu

1. **Pulse reže vety na skratkách a radových číslovkách** (V1). „ECB rozhodne 18. decembra o sadzbách.“ sa zobrazí ako „ECB rozhodne 18.“ a „The U.S. central bank…“ ako „The U.S.“
2. **Najnovší slovenský článok nemá na produkcii stránku** (V2). Karta v Magazíne na `/sk/news.html` vedie na zoznam článkov, priama adresa vracia 404. Stránka je v gite od 11. 11., na produkciu ju nikto nenahral.
3. **„Redakcia aktualizuje. Ďalšia aktualizácia je na ceste.“ sa ukáže každý pracovný deň poobede** (V3). Pulse vychádza raz denne o 6:25, hlásenie sa zapína po 8 hodinách.
4. **Odhlásený čitateľ sa nevie znova prihlásiť a zásady sľubujú vymazanie, ktoré sa nedeje** (V4, V5). Stránka povie „Si na zozname“, Worker pritom nič nezmení. Odhlásenie kontakt nevymaže, len ho označí.
5. **Výpadok sa nikto nedozvie** (V6). Keď ranný PUT nepríde, Worker padne alebo dátová Action zlyhá, čitateľ vidí staré dáta a neodíde žiadne upozornenie.

## Vysoké

### V1. `firstSentence()` končí vetu na prvej bodke pred medzerou

- **Kde:** `news/news.js:746-756` (`firstSentence`, `twoSentences`), použité v `news/news.js:849`.
- **Ako zopakovať:** spustiť funkciu z riadkov 746-756 na týchto textoch (overené v Node):

| Titulok + úryvok | Zobrazí sa |
|---|---|
| „ECB zasadá vo štvrtok“ + „ECB rozhodne 18. decembra o sadzbách. Bitcoin čaká.“ | „ECB zasadá vo štvrtok. ECB rozhodne 18.“ |
| „Bitcoin klesol“ + „BTC stratil cca. 3 % a obchoduje sa okolo 73,6 tis. $…“ | „Bitcoin klesol. BTC stratil cca.“ |
| „ETF“ + „Odlevy dosiahli 1,28 mld. $ za päť dní.“ | „ETF. Odlevy dosiahli 1,28 mld.“ |
| „Fed holds rates“ + „The U.S. central bank kept rates at 4.5%…“ | „Fed holds rates. The U.S.“ |
| „Miners sell“ + „Marathon Digital Holdings Inc. sold 1,200 BTC…“ | „Miners sell. Marathon Digital Holdings Inc.“ |
| „ECB rozhodne 18. decembra“ bez úryvku | „ECB rozhodne 18.“ |
| „U.S. Treasury sells bonds“ bez úryvku | „U.S.“ |

- **Čo funguje správne:** desatinné bodky a čiarky („1.5%“, „$73,566.20“, „73,6“), otáznik, pomlčky.
- **Dopad:** nezmyselná veta priamo v hlavnom bloku stránky. V slovenčine je to pravdepodobnejšie (dátumy „18. decembra“, „2. polrok“, „mld.“, „tis.“, „cca.“, „čl.“). Dnešné tri položky tým netrpia. Text „1,28 mld. $“ už na stránke je (Správy a trhy), takže redakcia taký štýl používa.
- **Posledné dva riadky tabuľky:** položka bez úryvku prejde cez `firstSentence(title)`, takže sa oreže aj samotný titulok. Worker prázdny `excerpt` povoľuje (`src/features/pulse/schema.js:113`).
- **Návrh:** nerezať titulok vôbec. Pri úryvku nekončiť vetu, ak pred bodkou stojí číslo alebo skratka zo zoznamu (U.S., Inc., vs., approx., cca., mld., mil., tis., napr., tzv., čl., r., č.) alebo ak za bodkou nasleduje malé písmeno či číslica. Jednoduchšia cesta: redakcia posiela úryvok ako jednu vetu a stránka ho zobrazí celý, len s limitom dĺžky. Pridať testy s tabuľkou vyššie.

### V2. Nová story stránka sa na produkciu nedostane sama, najnovší SK článok je 404

- **Kde:** `news/news.js:149-169` (`linkStories`), `news/news.js:1247-1251` (`blogCardFromWp`), nasadenie `stories-build`.
- **Ako zopakovať:** `curl -I https://virtuse.com/sk/stories/digitalne-euro-kto-bude-urcovat-pravidla-vasich-penazi/` vráti 404. Článok (WordPress 15396, 10. 11.) je prvý v slovenskom feede. Lighthouse na `/sk/news.html` zachytil túto 404 medzi požiadavkami stránky.
- **Stav:** priečinok `sk/stories/digitalne-euro-…/` je na main od commitu `50a42d82e` (11. 11. 12:35 UTC). Na produkcii nie je a nie je ani v produkčnej `sitemap.xml`. Nahrávanie na produkciu je ručné.
- **Dopad:** stránka po odpovedi HEAD prepíše odkaz karty na `/sk/stories/` (zoznam), takže čitateľ najnovší článok neotvorí. Kto klikne skôr, dostane 404. Trvá to druhý deň.
- **Súvisí:** z posledných 6 behov Action „Stories build“ 4 zlyhali (10. 11. 11:09, 13:23, 22:16; 11. 11. 10:42 UTC).
- **Návrh:** kým stránka neexistuje, kartu článku v Magazíne nezobrazovať alebo ju poslať na `article.html?slug=…&lang=sk`, ktorý článok vie zobraziť. Po každom úspešnom Stories builde poslať upozornenie „treba nahrať na produkciu“ a raz denne porovnať zoznam story stránok v gite s produkciou.

### V3. „Redakcia aktualizuje“ každý pracovný deň od približne 14:30 do 23:00

- **Kde:** `news/news.js:207` (`STALE_H = 8`), `news/news.js:221-234` (`deskHoursNow`, `applyPulseStale`), text `news/news.js:11` a `:25`.
- **Ako zopakovať:** otvoriť `/news.html` alebo `/sk/news.html` v pracovný deň po 14:33 SEČ (dnešný `updated` je 05:32 UTC = 06:32 SEČ, plus 8 h). Pod hlavičkou Pulse sa má objaviť „Desk updating. The next update is on its way.“ / „Redakcia aktualizuje. Ďalšia aktualizácia je na ceste.“
- **Stav overenia:** odvodené z kódu a z dnešnej pečiatky. Na obrazovke som to nevidel, kontrola prebehla o 10:41 SEČ.
- **Dopad:** hlásenie má upozorniť na poruchu, ale svieti denne v čase, keď je všetko v poriadku. Ďalšia aktualizácia navyše príde až na druhý deň ráno, takže veta nie je pravdivá. Pri skutočnej poruche ho čitateľ už nerozlíši.
- **Návrh:** prah nastaviť nad denný rytmus (napr. 26 h) a text zmeniť na pravdivý („Posledná aktualizácia včera o 6:32“). Alebo publikovať aj poobede.

### V4. Kto sa odhlásil, sa cez formulár znova neprihlási, a nedozvie sa to

- **Kde:** `src/infra/resend.js:43-49` (`createContact`), `src/features/newsletter/brief-list.js:30-34` (`join`), `src/infra/resend.js:62-66` (odhlásenie = `unsubscribed: true`).
- **Ako zopakovať (neskúšal som, bola by to zmena živého kontaktu):** prihlásiť testovaciu adresu, kliknúť na odhlásenie, znova ju zadať do formulára. Podľa kódu Resend odpovie „already exists“, Worker to vyhodnotí ako úspech (`created: false`), uvítací e-mail nepošle a príznak `unsubscribed` nezmení. Stránka napíše „Si na zozname. Skontroluj si schránku.“
- **Stav overenia:** správanie Workera je z kódu isté. Ako presne odpovie Resend pri odhlásenom kontakte, je **neoverené**.
- **Dopad:** stratený odberateľ, ktorý si myslí, že odoberá.
- **Návrh:** pri duplicite kontakt načítať a ak je odhlásený, znova ho prihlásiť (`unsubscribed: false`) a poslať uvítací e-mail. Overiť na testovacej adrese `vasilisin@virtuse.com` cez staging s vypnutým `SUBSCRIBE_DRY_RUN`.

### V5. Zásady sľubujú vymazanie adresy po odhlásení, kód ju nemaže

- **Kde:** `privacy-policy.html:822` („we will delete your address from the mailing list“), `sk/privacy-policy.html:781` („vašu adresu zo zoznamu odberateľov vymažeme“), oproti `src/infra/resend.js:62-66` a `src/features/newsletter/brief-list.js:36-40`.
- **Ako zopakovať:** prečítať `leave()`: volá len `PATCH …/contacts/{email}` s `{ unsubscribed: true }`. Vo Workeri nie je žiadne volanie `DELETE` kontaktu.
- **Dopad:** text zásad nezodpovedá tomu, čo sa deje (GDPR čl. 13 a 17). Kontakt aj s vlastnosťou `lang` ostáva v Resende bez časového limitu.
- **Návrh:** rozhodnúť s právnikom jednu z dvoch ciest. Buď kontakt po odhlásení naozaj mazať (a adresu držať len v zozname potlačených, aby sa jej znova neposlalo), alebo upraviť text zásad na „prestaneme vám posielať; záznam o odhlásení uchovávame, aby sme vás znova neoslovili“.

### V6. O výpadku sa nedozvieme

- **Kde:** celý tok. Worker nemá plánovanú kontrolu (`src/index.js`, `wrangler.toml` bez `[triggers]`). `PULSE.md` žiadne monitorovanie nepopisuje. `.github/workflows/asset-returns.yml:61,69,75` má pri dátových krokoch `continue-on-error: true`.
- **Čo vidí čitateľ a čo my:**

| Porucha | Čitateľ vidí | Upozornenie |
|---|---|---|
| Ranný PUT nepríde alebo ho Worker odmietne (400) | včerajší Pulse, „Updated 30 h ago“, cez pracovné hodiny „Desk updating“ | žiadne; chybu 400 vidí len ten, kto PUT posiela |
| Worker alebo KV nedostupné | po 3 s záložný súbor `news/news-pulse.json` z 10. 11.: anglicky aj na SK stránke so značkou „EN“, „Aktualizované pred 52 h“, Fear & Greed 32 namiesto 28 | žiadne |
| Worker aj záložný súbor nedostupné | „Pulse unavailable“ + ilustrácia „Redakcia aktualizuje“ | žiadne |
| `issues.json` / `issues-sk.json` sa nenačíta | sekcia Newsletter je prázdna, bez hlásenia (`news/news.js:1437-1440`); na SK stránke je mriežka prázdna aj v HTML (`sk/news.html:267`) | žiadne |
| `asset-returns.json` nedostupný na GitHube | použije sa kópia na webe (`news/news.js:1063-1064`); ak zlyhá aj tá, „Live data unavailable. See the full table.“ | žiadne |
| Build makra alebo výnosov zlyhá | staré čísla bez označenia; krok je `continue-on-error`, takže Action ostane zelená | žiadne, ani e-mail z GitHubu |
| mempool.space, Binance, CoinGecko nedostupné | „n/a“ v dlaždiciach, v páse „Live figures unavailable“ | žiadne (v poriadku, je to viditeľné) |
| WordPress nedostupný | Magazín ukáže len starú esej, na SK s nefunkčným odkazom (S4) | žiadne |

- **Návrh:** jedna denná kontrola (GitHub Action alebo Cloudflare Cron) o 7:00 SEČ: `GET /pulse.json`, `updated` nesmie byť starší ako 2 h, aspoň 3 položky, na všetkých `title_sk`; `asOf` v `asset-returns.json` a `generated` v `macro.json` nie staršie ako 3 dni; najnovší článok z WordPressu má story stránku na produkcii. Pri chybe e-mail na `info@virtuse.com` alebo webhook (rovnaký vzor ako `VERDICT_ALERT_WEBHOOK`). Záložný `news-pulse.json` obnovovať pri každom nasadení webu.

## Stredné

### S1. Položka s `title_sk`, ale bez `excerpt_sk`, príde o úryvok

- **Kde:** `news/news.js:43-47` (`localCopy`).
- **Ako zopakovať:** na stagingu `?pulse_fixture=…` so súborom, kde má položka `title_sk` a nemá `excerpt_sk`. Zobrazí sa len titulok (a ten prejde orezaním z V1).
- **Dopad:** kratší a chudobnejší text bez značky, že niečo chýba. Worker to prijme (`schema.js:57-58`, obe polia sú nepovinné a nezávislé).
- **Návrh:** ak je `title_sk`, vyžadovať vo Workeri aj `excerpt_sk` (keď má položka `excerpt`).

### S2. Medzery vo validácii Pulse

- **Kde:** `src/features/pulse/schema.js`.
- **Nálezy (z kódu):**
  - `excerpt` nemá limit dĺžky (`:113`), obmedzuje ho len 16 kB celého dokumentu.
  - Položky `archive.items` nemajú `excerpt` kontrolovaný vôbec (`:124-132`); stránka ho pri archíve nepoužíva, takže dnes bez dopadu.
  - Titulok zo samých medzier prejde (`:40`). `title_sk` zo samých medzier stránka berie ako chýbajúci (správne).
  - `source` nemá limit dĺžky (`:43`); ide do textu odkazu „Read at …“.
  - `updated` môže byť až 36 h v budúcnosti (`:81`). Stránka potom až 36 h píše „Updated just now“ (`news/news.js:216-217`).
  - `updated` môže byť staršie než práve uložený dokument. Opakovaný starý PUT prepíše novší Pulse a zároveň `previous`.
  - `published` nemá hranice (budúcnosť, roky dozadu).
  - Počet položiek 1 až 4 (`:106`); dohodnutý mix 2 Bitcoin + 1 Makro + 1 Svet sa nekontroluje. Dnes prišli 3 položky (Security, ETF, ETF), žiadna Makro ani Svet.
  - Slovenský text sa nevyžaduje. Čiastočný preklad prejde potichu.
- **Návrh:** doplniť limity (`excerpt` 300, `source` 60), odmietnuť `updated` starší než uložený (s prepínačom `force`), budúcnosť skrátiť na 1 h, vrátiť v odpovedi PUT pole `warnings` (chýba SK text, menej než 4 položky, chýba Makro/Svet).

### S3. Odkazy z Pulse sa na stránke nekontrolujú, pole `feed` obchádza Worker

- **Kde:** `news/news.js:852` (`read.href = it.url`), `:286` (archív), `:895-899` (`data.feed`).
- **Ako zopakovať (z kódu):** ak dokument obsahuje `feed` s adresou, stránka z nej načíta položky a vykreslí ich bez akejkoľvek kontroly. Odkaz s `javascript:` by sa dostal do `href`. Worker pri `feed` kontroluje len to, že je to text (`schema.js:163`).
- **Dopad:** dnes nízky. Texty idú cez `textContent` (XSS cez titulok alebo úryvok nie je možné), PUT chráni token, CSP `connect-src` obmedzuje, odkiaľ sa dá `feed` načítať (`raw.githubusercontent.com` medzi povolenými je). Je to chýbajúca druhá poistka pre prípad úniku tokenu.
- **Návrh:** na stránke prijať len `https:` odkazy, inak položku vynechať. Pole `feed` zrušiť (dnes je `null`).

### S4. Na SK stránke vedie karta anglickej eseje na zoznam článkov a každé načítanie pýta neexistujúcu adresu

- **Kde:** `news/news.js:1219-1223` (`blogCardFromIssue` volá `markIssue` vždy), porovnaj `:1083` (`archiveCard` ho volá len bez `issue.url`).
- **Ako zopakovať:** Lighthouse na `/sk/news.html` ukazuje požiadavku `HEAD /sk/stories/they-wont-stop-printing-money-why-bitcoins-rise-to-200000-is-unstoppable/` s odpoveďou 301. Esej má v `issues-sk.json` `lang: "en"` a `url: "/stories/…"`, kód jej napriek tomu prepíše odkaz na `/sk/stories/<anglický slug>/` a po 301 na `/sk/stories/`.
- **Dopad:** kartu vidno do príchodu odpovede WordPressu a celý čas, keď WordPress neodpovedá. Vtedy vedie na zoznam namiesto článku. Jedna zbytočná požiadavka pri každom načítaní.
- **Vedľajší nález (obe jazykové verzie):** obrázok eseje (229 kB, `PHOTO-2026-08-20-14-14-01.jpg`) sa stiahne pri každom načítaní, hoci kartu po odpovedi WordPressu nahradia novšie články. V Lighthouse je to najväčší súbor stránky.
- **Návrh:** v `blogCardFromIssue` rovnaká podmienka ako v `archiveCard`. Esej vykresliť až po odpovedi WordPressu alebo po jej zlyhaní.

### S5. Odkaz „Súkromie“ pod formulárom vedie na prihlasovaciu kartu, nie na text o spracúvaní

- **Kde:** `news.html:628`, `news.html:838`, `sk/news.html:205`, `sk/news.html:415` (`privacy-policy.html#brief`); cieľ `privacy-policy.html:1000` a `sk/privacy-policy.html:959` je `<section id="brief">` s kartou „Get the Brief“.
- **Ako zopakovať:** kliknúť na „Privacy“ / „Súkromie“ pod formulárom.
- **Dopad:** čitateľ, ktorý chce pred zadaním e-mailu vedieť, čo sa s ním stane, skončí pri ďalšom formulári. Informácia o newsletteri je v zásadách vyššie (riadok 822, resp. 781).
- **Návrh:** dať kotvu (napr. `id="newsletter"`) na odsek o e-mailovej adrese a odkazy presmerovať tam.

### S6. Prihlásenie bez potvrdenia e-mailom a bez záznamu o súhlase

- **Kde:** `src/features/newsletter/subscribe-handler.js:11-39`, `brief-list.js:30-34`.
- **Stav:** po odoslaní formulára sa kontakt hneď vytvorí a dostane uvítací e-mail. Potvrdzovací odkaz neexistuje. Worker neukladá čas, zdroj ani znenie súhlasu; ostáva len dátum vytvorenia kontaktu v Resende a vlastnosť `lang`.
- **Dopad:** ktokoľvek môže prihlásiť cudziu adresu. Pri sťažnosti nevieme súhlas doložiť (GDPR čl. 7 ods. 1; zákon o elektronických komunikáciách vyžaduje preukázateľný súhlas). Posúdenie patrí právnikovi.
- **Návrh:** dvojité potvrdenie (uvítací e-mail s odkazom „Potvrdiť odber“, kontakt sa do segmentu zaradí až po kliknutí). Ak ostane jednoduché prihlásenie, uložiť ku kontaktu aspoň čas, stránku a jazyk formulára.

### S7. Ochrana `/subscribe` pred zneužitím je slabá

- **Kde:** `src/app.js:73` (brána podľa hlavičky `Origin`), `src/config.js:20` (5 pokusov za hodinu na IP), `src/app.js:36`.
- **Ako zopakovať:** `curl -X POST …/subscribe -H 'Origin: https://virtuse.com' …` prejde bránou (overené s neplatnou adresou: odpoveď 400 z validácie, nie 403). Bez hlavičky vráti 403.
- **Dopad:** skript s meniacimi sa IP vie prihlasovať cudzie adresy a rozosielať im uvítacie e-maily z našej domény. To škodí povesti odosielateľa. Limit na adresu tu nie je (pri `/send` je), Turnstile tiež nie.
- **Návrh:** Turnstile v neviditeľnom režime na formulároch Briefu (v projekte už beží pri Ecosystem formulári) alebo dvojité potvrdenie zo S6, ktoré problém zmenší.

### S8. Odhlásenie sa vykoná už pri načítaní odkazu

- **Kde:** `src/features/newsletter/unsubscribe-handler.js:16-32`, `src/app.js:92`.
- **Stav (z kódu):** `GET /unsubscribe?email=…&token=…` odhlási okamžite, bez potvrdzovacieho tlačidla.
- **Dopad:** poštové brány, ktoré odkazy v e-mailoch vopred otvárajú (bežné vo firemných schránkach), môžu čitateľa odhlásiť bez jeho vedomia. Spolu s V4 sa už cez formulár nevráti. Či sa to deje, je **neoverené** (nemám čísla odhlásení).
- **Súvisí:** uvítací e-mail nemá hlavičku `List-Unsubscribe` (`brief-list.js:19-24` posiela len `from`, `to`, `subject`, `html`). Stránka po odhlásení je len po anglicky (`unsubscribe-page.js:3-9`), aj pre slovenských odberateľov.
- **Návrh:** GET zobrazí stránku s tlačidlom „Odhlásiť“, samotné odhlásenie urobí POST. Pridať `List-Unsubscribe` a `List-Unsubscribe-Post` (to je štandardná cesta jedného kliknutia, ktorú brány neotvárajú). Stránku preložiť podľa `lang`.

### S9. Zlyhaný uvítací e-mail sa už nikdy nepošle

- **Kde:** `src/features/newsletter/brief-list.js:30-34`, `subscribe-handler.js:32-38`.
- **Ako zopakovať (z kódu):** Resend vytvorí kontakt, odoslanie e-mailu zlyhá. Čitateľ dostane 502 „Something went wrong“. Pri druhom pokuse je kontakt duplicitný, odpoveď je 200 a uvítací e-mail sa neposiela.
- **Dopad:** odberateľ bez uvítacieho e-mailu, a teda bez odhlasovacieho odkazu do prvého vydania.
- **Návrh:** pri zlyhaní odoslania vrátiť úspech (kontakt existuje) a e-mail skúsiť znova, alebo si v KV na 24 h poznačiť „uvítanie neodišlo“ a poslať ho pri ďalšom pokuse.

### S10. Pri `/subscribe` sa IP adresa ukladá nezahashovaná

- **Kde:** `src/app.js:36` (kľúč `ratelimit:${ip}`), oproti `src/shared/crypto.js:59-61` (`ipHash`, používa ho Verdict a `/send`).
- **Dopad:** IP adresa je hodinu čitateľná v KV. Zásady pri newsletteri spomínajú IP len v serverových logoch (`privacy-policy.html:883`), pri Verdicte sľubujú hash. Nejednotné a v zásadách neuvedené.
- **Návrh:** použiť `ipHash` aj tu.

### S11. Chybové hlásenia Workera sú na SK stránke po anglicky

- **Kde:** `news/news.js:404` (zobrazí `result.data.error`), texty v `subscribe-handler.js:22,29,37`.
- **Ako zopakovať:** na `/sk/news.html` odoslať formulár 6-krát za hodinu. Šiesty pokus ukáže „Too many attempts. Please try again later.“
- **Návrh:** Worker vráti kód chyby (`rate_limited`, `invalid_email`), stránka ho preloží.

### S12. Neošetrená výnimka vo Workeri vráti chybu bez CORS hlavičiek

- **Kde:** `src/http/router.js:28-35`, `src/app.js:110-112` (bez `try/catch`), `src/features/pulse/handler.js:53` (čítanie z KV).
- **Dopad:** pri poruche KV vráti Cloudflare vlastnú chybovú stránku. Prehliadač to ohlási ako chybu siete. Pri Pulse sa použije záložný súbor (v poriadku), pri prihlásení čitateľ uvidí „Chyba siete“. V logoch chýba naša vlastná stopa.
- **Návrh:** jeden `try/catch` okolo `route()`, ktorý vráti JSON 500 s CORS a zapíše chybu.

### S13. SK stránka nemá štruktúrované dáta

- **Kde:** `sk/news.html` (žiadny `application/ld+json`), `news.html:65` (Organization, CollectionPage, ItemList s NewsArticle).
- **Dopad:** slabší podklad pre Google pri slovenskej verzii. Canonical, hreflang (en, sk, x-default), prepínač jazyka aj záznamy v sitemap sú na oboch verziách správne a vzájomné (overené).
- **Návrh:** `seo-ops/news_jsonld.py` rozšíriť o SK výstup z `issues-sk.json` (len skutočne slovenské vydania, dnes jedno).

### S14. Výkon na mobile: skóre 60 (EN) a 56 (SK)

- **Kde:** `news.html:8` a `sk/news.html:8` (synchrónny `brand/logo-loader.js`), `news.html:15-19` (GTM hneď v hlavičke), `news.html:47` (Google Fonts, 3 rodiny).
- **Ako zopakovať:** `npx lighthouse@13 "https://virtuse.com/news.html?noloader" --form-factor=mobile` (beh 12. 11. z tohto Macu, simulované spomalenie).

| | EN | SK |
|---|---|---|
| Výkon / Prístupnosť / SEO | 60 / 97 / 100 | 56 / 97 / 100 |
| LCP (simulované) | 9,7 s | 9,3 s |
| FCP | 4,5 s | 4,8 s |
| TBT | 130 ms | 250 ms |
| CLS | 0 | 0 |
| Prenesené dáta | 1 817 kB | 1 439 kB |

- **Čo brzdí vykreslenie:** CSS Google Fonts (blokuje asi 0,9 s; písma 119 + 99 + 84 kB), synchrónny `logo-loader.js`, `news.css` (40 kB). LCP prvok je obálka vydania; z jeho času tvorí 2,1 s čakanie na vykreslenie, nie sťahovanie.
- **GTM:** `gtm.js` (124 kB) a `gtag/js` (182 kB) sa na Briefe načítajú hneď. Na ostatných stránkach sú od 29. 10. odložené až po načítaní.
- **Úvodná animácia loga:** pri prvej návšteve v karte prekryje stránku až na 3,6 s (`brand/logo-loader.js`). Skutočný LCP návštevníka je tým dlhší, Lighthouse to nezmeria. S animáciou vyšlo skóre 52.
- **Obrázky:** 229 kB esej (S4), 220 kB obálka z 2. 11. a 213 kB `brief-20261019.jpg` v archíve (EN), `firefish-promo.png` 68 kB v rozmere 1200×630 bez `loading="lazy"`.
- **JSON:** `issues.json` 8,6 kB, `pulse.json` 4,4 kB, `asset-returns.json` 6,7 kB, `macro.json` 9,7 kB. Bez problému.
- **INP:** v laboratóriu sa nemeria. Skutočné hodnoty sú v Cloudflare Web Analytics (**neoverené**, nemám prístup).
- **Poznámka:** simulovaný LCP v Lighthouse je na tomto webe pesimistický (pozri záznam z 29. 10. v CLAUDE.md). Poradie príčin však platí.
- **Návrh:** odložiť GTM ako inde, `logo-loader.js` načítať s `defer` alebo animáciu na Briefe vypnúť, písma obmedziť na použité rezy a načítať neblokujúco, `loading="lazy"` na reklamný obrázok, obálky v archíve v 768 px.

### S15. Prihlásenie na Brief z jeho vlastnej stránky sa nemeria

- **Kde:** `news/news.js:362-418` (`bindSubscribe`): žiadny `dataLayer.push`. Jediná udalosť stránky je `preferred_source_click` (`preferred-source.js:38`).
- **Dopad:** v GA4 nevidno, koľko odberateľov získala stránka Briefu a ktorý z dvoch formulárov (horný, pätička). Domovské stránky a Partner Finder pritom `capture_submit` posielajú a GTM má naň značku.
- **Návrh:** po úspechu poslať `capture_submit` s `capture_source: 'brief_hero'` / `'brief_footer'` a `page_lang`. GTM netreba meniť.

### S16. Kliky v Nástrojoch a v Pulse nemajú udalosti; UTM je na interných odkazoch

- **Kde:** `news/news.js:989-999` (čipy), `news/news.js:850-857` (odkaz „Read at …“), odkazy v `news.html` a `sk/news.html` (`utm_source=brief&utm_medium=nav|tools|desk|footer`).
- **Stav:**
  - Kliky na čipy (zásoba, výdavky, krajina) neposielajú nič. Nevieme, či s ukážkami niekto pracuje.
  - Kliky na zdroje v Pulse a v Správach a trhoch zachytí len automatická udalosť GA4 `click` (odchádzajúce odkazy), bez štítku, tagu či poradia položky.
  - Karta nástroja má dva odkazy (celá karta a tlačidlo) s rovnakou adresou; nerozlíšia sa.
  - `utm_campaign` chýba všade. Odkazy „Hub“, „Na Virtuse“ (lending) a „Všetky články“ nemajú označenie žiadne.
  - UTM na interných odkazoch: GA4 pri príchode na cieľovú stránku prepíše zdroj relácie na `brief`. Návštevník z Googlu, ktorý prejde z Briefu do kalkulačky, sa potom v prehľadoch ráta ako zdroj „brief“. Pôvodný zdroj sa stratí.
  - Odkaz na Firefish meria `partner-click.js` (v poriadku).
- **Návrh (bez zmeny GTM a súhlasu):** interné odkazy označiť atribútom (`data-cta="brief_tools_retirement"`) a posielať vlastnú udalosť `brief_click` s `section`, `item`, `page_lang`; UTM z interných odkazov odstrániť. UTM nechať len tam, kde odkaz vedie z e-mailu alebo zo sociálnej siete. Pre novú udalosť bude treba jednu značku v GTM (popisujem, nemením).

### S17. Produkčný Worker je pozadu za main

- **Kde:** `GET /version` = `2a0d7bbc`, main `4c4c9b431`.
- **Stav:** rozdiel v `src/` sú zmeny z `08d14421f` (Verdict, upozornenia, `shared/rate-limiter.js`). Na produkcii beží starý počítač limitov: každý pokus posunie koniec okna o ďalšiu hodinu, takže kto skúša opakovane, ostane zablokovaný dlhšie než hodinu.
- **Návrh:** nasadiť podľa bežného postupu (`deploy_worker.sh`) po schválení.

## Nízke

| # | Nález | Kde | Návrh |
|---|---|---|---|
| N1 | Slovo „odlevy“ na SK stránke a v dátach; Pulse používa „odlivy“. Na jednej stránke sú tak dva tvary toho istého slova. | `sk/news.html:33,43,172,234`, `news/issues-sk.json:6`, `news/news-markets.json:33` | zjednotiť na „odlivy“ |
| N2 | „najčastejšieho scenára“ ako preklad „most likely outcome“; reťazec sa zatiaľ nepoužíva. | `news/news.js:33` | „najpravdepodobnejšieho“ |
| N3 | Nepoužité texty v I18N: `stale`, `expects`, `kalshiNote`, `ecbRate`, `btcEur`, `skInfl`, `nextDecision`, `last`, `asOf`, `source`, `earlier`. | `news/news.js:10-35` | odstrániť alebo dokončiť funkciu |
| N4 | Príznak `stale: true` z `macro.json` stránka nezobrazuje; staré číslo vyzerá ako čerstvé. | `news/news.js:532-543` | pri `stale` pridať k dlaždici dátum |
| N5 | Fear & Greed je hodnota z ranného Pulse bez dátumu; pri záložnom súbore je 2 dni stará. | `news/news.js:250-257` | pridať „k 6:32“ alebo dátum |
| N6 | Štítok archívu je vždy „Yesterday“ / „Včera“, aj keď je Pulse starší než deň. | `news/news.js:268-271` | pri veku nad 24 h použiť „Skôr“ (text už existuje) |
| N7 | Pravidlo „Before the release“ zachytí aj bežné slovo „before“. | `news/news.js:787` | zúžiť na „ahead of“, „awaits“, „on the eve of“ |
| N8 | Tabuľka výnosov a veta pod ňou sa skladajú cez `innerHTML` z hodnôt JSON (`years`, `ytdYear`). Dáta sú naše, riziko je malé. | `news/news.js:1027,1053` | `textContent` alebo kontrola, že ide o číslo |
| N9 | Predvolená cena v kalkulačke je pevná (74 649 EUR, 12. 11. 2026). Pri výpadku CoinGecko ostane, dátum je priznaný. | `news/news.js:982` | brať z `macro.json` |
| N10 | Verejný `pulse.json` obsahuje interné poznámky: `quick_media.note` („Keep, still this week's pick; below-hero slot.“) a starý titulok videa („EXPLODES Past $86,000“). Na stránke sa nezobrazujú. | živý `/pulse.json` | redakcia: neposielať poznámky, `quick_media` vypustiť |
| N11 | Čipy krajín: viditeľný text „SK“, `aria-label` „Slovensko“ (Lighthouse: label-content-name-mismatch). Čipy sú menšie než odporúčaná dotyková plocha. | `news/news.js:1014` | `aria-label` „SK, Slovensko“; väčší čip |
| N12 | V HTML SK stránky vedie „Zdieľať na LinkedIn“ na anglický článok; skript to po načítaní opraví. | `sk/news.html:176` | opraviť v `build_brief_sk.py` |
| N13 | Na SK stránke sa WordPress pýta slovenského API na anglické slugy; pre anglické vydania nepríde zoznam menších obrázkov. Dopad na veľkosť som nemeral. | `news/news.js:1430-1432` | pre položky s `lang: "en"` volať anglické API |
| N14 | Lokálny vývoj: `localhost` nie je medzi povolenými pôvodmi `GET /pulse.json`, stránka padne na záložný súbor. | `src/config.js:5-9` | len poznámka do README |

## Čo je v poriadku (overené)

- Texty Pulse idú do stránky cez `textContent`; XSS cez titulok, úryvok ani zdroj nie je možné (`news/news.js:849,857,295`).
- `what_moved` ani `what_moved_sk` sa na stránke nezobrazujú; Worker ich prijíma a obmedzuje na 300 znakov.
- Limity `title_sk` 120 a `excerpt_sk` 300 platia aj pre archív (`schema.js:57-58,62-68`).
- Bez `title_sk` zobrazí SK stránka anglický text so značkou „EN“ a `lang="en"` (`news/news.js:43-56,844-848`).
- Dátum „Dnes“ aj hodiny redakcie sa počítajú v pásme Europe/Bratislava, nie podľa návštevníka (`news/news.js:197-199,237-248`).
- `GET /pulse.json`: CORS len pre `virtuse.com`, `www`, `staging`; cudzí pôvod hlavičku nedostane. PUT bez tokenu 401, DELETE 405.
- Staging Worker má vlastný Pulse KV (`wrangler.toml`), `/subscribe` na stagingu je naprázdno (`{"ok":true,"dryRun":true}`, overené s `vasilisin@virtuse.com`).
- Honeypot, kontrola adresy a zlý JSON na `/subscribe` odpovedajú správne (200 naprázdno, 400, 400).
- Odhlasovací odkaz so zlým tokenom vráti 400.
- Canonical, hreflang, prepínač jazyka a sitemap sú na oboch verziách správne. Lighthouse SEO 100 na oboch.
- Všetkých 15 vydaní v `issues.json` a `issues-sk.json` má na produkcii funkčnú adresu; odkaz na preklad (`alt_url`) funguje oboma smermi.
- Hlavičky cache: HTML a JSON `no-cache`, `news.js` a `news.css` s `?v=` rok, obrázky 7 dní. Kompresia Brotli.
- CLS 0 na oboch stránkach.

## Čo som nemohol overiť

- **V3 na obrazovke.** Hlásenie „Redakcia aktualizuje“ som odvodil z kódu; stránku po 14:33 som nevidel.
- **Odpoveď Resendu pri odhlásenom kontakte (V4)** a či Resend pri hromadných vydaniach pridáva `List-Unsubscribe`. Skúška by menila živé kontakty.
- **Skutočné prihlásenie, uvítací e-mail, odhlásenie a bounce od začiatku do konca.** Staging je naprázdno a na produkciu som neposielal nič. Spracovanie bounce a sťažností pre Brief vo Workeri nie je (`/resend/webhook` rieši len potvrdenia Verdictu); čo robí Resend sám, som nevidel.
- **Kto a ako posiela ranný PUT.** Rutina o 6:25 je mimo repozitára. Nevidel som jej opakovanie pri chybe, zaobchádzanie s odpoveďou 400 ani ochranu tokenu.
- **Správanie pri skutočnom výpadku Workera.** Tabuľka vo V6 je z kódu a zo záložného súboru, výpadok som nevyvolával.
- **GA4 a GTM.** Bez prístupu do GA4 som neoveril, čo naozaj prichádza. Popis v S15 a S16 je z kódu stránky.
- **Skutočné Core Web Vitals návštevníkov (LCP, INP).** Cloudflare Web Analytics je za prihlásením. Lighthouse bežal raz na stránku, z jedného počítača.
- **Indexácia SK verzie v Googli.** Search Console som neotváral.
- **Slovenský text na obrázku pre zdieľanie.** `sk/news.html` používa ten istý `og:image` ako EN; či je na ňom anglický text, som nepozeral.
- **Testy Workera.** `npm test` som nespúšťal.
- **Správy a trhy, kalendár a tabuľka centrálnych bánk** som čítal len v kóde; obsah a zdroje som po jednom nekontroloval.
- **Zmluva so spracovateľom (Resend) a zmienka o Resende pri newsletteri v zásadách.** Zásady som čítal len v častiach o newsletteri; právne posúdenie patrí právnikovi.
