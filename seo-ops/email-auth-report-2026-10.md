# E-mailová autentifikácia virtuse.com: DMARC reporting, DKIM M365, audit SPF

Report pre Rasa. Stav k 21. 10. 2026 (overené cez dig/DoH, Outlook connector,
repo `Virtu AI`, Cloudflare Worker, dokumentácia Microsoft a Resend).

**Krok 0 schválený Rasom 21. 10. 2026 a v ten istý deň aplikovaný** (schránka
dmarc@, DMARC TXT s `rua`, DKIM M365; detaily a overenie v časti 8). Zmenu SPF
(časť 5) a quarantine (časť 7) schválenie nezahŕňa.

DNS virtuse.com
beží na Microsoft nameserveroch (`ns1-4.bdm.microsoftonline.com`), záznamy sa
pridávajú v Microsoft 365 admin centre: Settings → Domains → virtuse.com →
DNS records → Custom records. Bez BIMI/VMC, bez `p=quarantine`/`p=reject`.

---

## 1. Východiskový stav (21. 10. 2026, potvrdený)

| Záznam | Dnes v DNS | Stav |
|---|---|---|
| `_dmarc.virtuse.com` TXT | `v=DMARC1; p=none;` | bez `rua`, reporty nikam nechodia |
| `virtuse.com` TXT (SPF) | `v=spf1 include:spf.protection.outlook.com include:mailgun.org include:sendgrid.net include:spf.autopilothq.com include:eu.zcsend.net -all` | 5 include, 8 DNS lookupov z limitu 10 |
| `selector1._domainkey.virtuse.com` | neexistuje | M365 DKIM vypnutý |
| `selector2._domainkey.virtuse.com` | neexistuje | M365 DKIM vypnutý |
| `resend._domainkey.virtuse.com` TXT | `p=MIGfMA0G…` (RSA 1024) | OK, Resend DKIM podpisuje `d=virtuse.com` |
| `send.virtuse.com` TXT | `v=spf1 include:amazonses.com ~all` | OK (Resend Return-Path) |
| `send.virtuse.com` MX | `10 feedback-smtp.eu-west-1.amazonses.com` | OK |
| `virtuse.com` MX | `1 virtuse-com.mail.protection.outlook.com` | Exchange Online |
| `_dmarc.send.virtuse.com` | neexistuje | v poriadku, dedí z root (`sp` nie je nastavené) |

Všetko sedí s handoverom. Navyše zistené: tenant M365 je
**`virtuseenergy.onmicrosoft.com`** (tenant ID `5609c6ac-8082-4a07-ab01-09aaf00a4a39`,
rovnaké ID vracia login.microsoftonline.com pre virtuse.com aj pre
virtuseenergy.onmicrosoft.com; SharePoint beží na `virtuseenergy-my.sharepoint.com`).
Dôležité pre DKIM, pozri časť 3.

Reálny Brief z 19. 10. 2026 (v schránke ovchynnykov@) má `From: Virtuse Brief
<no-reply@virtuse.com>` a Message-ID z `eu-west-1.amazonses.com`, teda Resend
posiela z **root domény** vo From a z `send.virtuse.com` v Return-Path. Presne
tento prípad rieši časť 4.

---

## 2. A) Schránka na DMARC reporty: `dmarc@virtuse.com`

**Stav: neoverené, treba vytvoriť.** Čo som skúsil a prečo to nestačí:

- Outlook/M365 connector v tejto session je prihlásený ako **Mykyta
  (ovchynnykov@virtuse.com)**, nie Ras. Directory search na „dmarc" vrátil nič
  (hľadá len medzi kontaktmi, nie v celom adresári).
- SMTP sonda na `virtuse-com.mail.protection.outlook.com:25` (RCPT TO bez
  odoslania) sa nedá spustiť: port 25 je z tejto siete blokovaný.
- Connector nemá Graph oprávnenia na správu používateľov ani zdieľaných schránok.

Odporúčam **zdieľanú schránku** (zadarmo, bez licencie, XML prílohy nezahltia
Rasov inbox; Google, Microsoft a Yahoo posielajú reporty denne). Postup pre Rasa
(M365 admin, ~3 minúty):

1. https://admin.microsoft.com → Teams & groups → **Shared mailboxes** → **Add a shared mailbox**.
2. Name: `DMARC reports`, Email: `dmarc` @ virtuse.com → Save.
3. Add members: Ras (a voliteľne Mykyta). Pridá sa im do Outlooku automaticky.
4. Overenie: poslať si test z vlastnej schránky na dmarc@virtuse.com, musí prísť.

Alternatíva: alias `dmarc@virtuse.com` na existujúcej schránke (Users → Active
users → Ras → Manage email aliases). Reporty potom chodia Rasovi do inboxu,
odporúčam v tom prípade Outlook pravidlo „From contains dmarc → folder DMARC".

RUA adresa je na tej istej doméne, takže **netreba** žiadny overovací
`_report._dmarc` záznam (ten je nutný len pri cudzej doméne).

---

## 3. B) DMARC: krok 1, len reporting

Copy-paste hodnota (nahradiť existujúci TXT `_dmarc`, nepridávať druhý):

```
Typ:   TXT
Host:  _dmarc            (celé meno: _dmarc.virtuse.com)
TTL:   3600
Value: v=DMARC1; p=none; rua=mailto:dmarc@virtuse.com; adkim=r; aspf=r; fo=1
```

Poznámky:
- `adkim=r; aspf=r` je relaxed alignment. Je to **nutné** pre Resend (Return-Path
  `send.virtuse.com` vs. From `virtuse.com`). Nemeniť na `s`.
- `fo=1` má účinok len spolu s `ruf=` (forenzné reporty). Bez `ruf` je neškodné;
  ponechané podľa handoveru. `ruf` zámerne nepridávam (väčšina prijímačov ho
  ignoruje a nesie osobné údaje z hlavičiek).
- Poradie: schránka dmarc@ **pred** zmenou DNS, inak prvé reporty odrazia.
- Prvé reporty prídu do 24–48 h od zmeny (Google posiela raz denne, okolo
  polnoci UTC).

---

## 4. C) DKIM Microsoft 365

Dnes Exchange Online podpisuje odchádzajúcu poštu kľúčom tenantu
(`d=virtuseenergy.onmicrosoft.com`). DKIM technicky prejde, ale **nie je
zarovnaný** s virtuse.com, takže DMARC pre Outlook poštu stojí len na SPF.
Pri každom preposlaní (forward, mailing listy, Gmail „send as") SPF padne a
s ním aj DMARC. Toto je hlavný dôvod, prečo DKIM zapnúť pred krokom quarantine.

### Postup (Ras, Defender portál, 2 návštevy)

1. https://security.microsoft.com/authentication?viewid=DKIM
   (Email & collaboration → Policies & rules → Threat policies → Email
   authentication settings → záložka **DKIM**).
2. Riadok `virtuse.com`: kliknúť do riadku (nie na toggle) → flyout.
   Ak je tam tlačidlo **Create DKIM keys**, stlačiť. Ak nie, skúsiť prepnúť
   toggle: vyhodí „Client error" s hodnotami CNAME, to je očakávané, OK.
3. Vo flyoute **Publish CNAMEs** → Copy. Toto sú záväzné hodnoty (doc Microsoftu:
   hodnoty v článku sú len ilustračné, platí portál).
4. M365 admin → Settings → Domains → virtuse.com → DNS records → Add record →
   CNAME, 2×. **Na mene `selector1._domainkey` nesmie byť žiadny TXT** (dnes
   tam nič nie je, overené).
5. Po pár minútach (môže byť aj hodina) späť do flyoutu → toggle
   **Sign messages for this domain with DKIM signatures** → Enabled.
   Status musí ukázať „Signing DKIM signatures for this domain".

### Očakávané hodnoty

Formát závisí od toho, kedy bola doména pridaná do M365. virtuse.com je v
tenante od éry Virtuse Exchange, takže **očakávam starý formát**:

```
CNAME  selector1._domainkey  →  selector1-virtuse-com._domainkey.virtuseenergy.onmicrosoft.com
CNAME  selector2._domainkey  →  selector2-virtuse-com._domainkey.virtuseenergy.onmicrosoft.com
```

Ak portál ukáže nový formát (domény pridané po máji 2025), vyzerá takto, pričom
`X` je jedno písmeno pridelené Microsoftom (napr. `r` alebo `n`):

```
CNAME  selector1._domainkey  →  selector1-virtuse-com._domainkey.virtuseenergy.X-v1.dkim.mail.microsoft
CNAME  selector2._domainkey  →  selector2-virtuse-com._domainkey.virtuseenergy.X-v1.dkim.mail.microsoft
```

Oba formáty sa nesmú miešať; vždy skopírovať to, čo ukáže portál.

PowerShell alternatíva (Exchange Online PowerShell, `Connect-ExchangeOnline`):

```powershell
Get-DkimSigningConfig -Identity virtuse.com | Format-List Name,Enabled,Status,Selector1CNAME,Selector2CNAME
# ak domain chýba: New-DkimSigningConfig -DomainName virtuse.com -Enabled $false -KeySize 2048
# po pridaní CNAME: Set-DkimSigningConfig -Identity virtuse.com -Enabled $true
```

Ak portál ponúkne voľbu veľkosti kľúča, zvoliť **2048**.

---

## 5. D) Audit SPF: kto ešte posiela

Prehľadané: celé repo `Virtu AI` (bez node_modules/dist), zdroj Cloudflare
Workera `cloudflare-worker/src`, e-maily v schránke ovchynnykov@virtuse.com
(odosielatelia aj fulltext, bez časového limitu).

| Include | Nález | Verdikt |
|---|---|---|
| `spf.protection.outlook.com` | Exchange Online, MX domény, všetka firemná pošta | **ostáva** |
| `mailgun.org` | 0 e-mailov od mailgun.org, 0 zmienok v pošte, 0 v repe, 0 vo Workeri | **vypadáva** (pozostatok Virtuse Exchange) |
| `sendgrid.net` | 0 e-mailov, 0 zmienok, 0 v repe/Workeri | **vypadáva** (pozostatok) |
| `spf.autopilothq.com` | jediná zmienka: e-mail účtovníkom 10. 9. 2026, že faktúry AutopilotHQ Inc. už neexistujú (staré predplatné Virtuse Group Pte Ltd) | **vypadáva** |
| `eu.zcsend.net` (Zoho Campaigns) | mesačné predplatné 4 € do 16. 9. 2026; v ten deň **zrušené**, účet prešiel na Free plán. Newsletter beží od vtedy na Resend (`email/README.md` popisuje export kontaktov zo Zoho). | **vypadáva**, po kontrole (nižšie) |
| Resend (`amazonses.com`) | nie je v root SPF a **nemá tam byť**, pozri ďalej | bez zmeny |

**Resend a root doména.** Resend dáva SPF (`include:amazonses.com`) a MX výlučne
na Return-Path poddoménu `send.virtuse.com`; vlastný troubleshooting Resendu
výslovne hovorí „records belong on the `send` subdomain, not the root domain".
From môže byť ľubovoľná adresa @virtuse.com (dnes `no-reply@virtuse.com`,
Worker `plan@virtuse.com`). DMARC prejde dvakrát nezávisle:
- SPF: Return-Path `send.virtuse.com` je poddoména organizačnej domény, pri
  `aspf=r` zarovnané;
- DKIM: `resend._domainkey.virtuse.com` podpisuje `d=virtuse.com`, zarovnané aj
  striktne.
Root SPF teda Resend nepotrebuje. Zdroje: resend.com/docs/dashboard/domains/dmarc,
resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying.

### Navrhovaný nový SPF (copy-paste, až po „ano")

```
Typ:   TXT
Host:  @                 (celé meno: virtuse.com)
TTL:   3600
Value: v=spf1 include:spf.protection.outlook.com -all
```

DNS lookupy klesnú z 8 na 1. Ostatné TXT na root (3× google-site-verification,
mscid) ostávajú bez zmeny.

### Čo si ešte overiť pred odstránením include

1. **Rasova schránka**: connector vidí len Mykytovu poštu. Ras nech si v Outlooku
   vyhľadá „mailgun" a „sendgrid" (stačí 1 minúta). Ak nič, potvrdené.
2. **Zoho Free plán**: prihlásiť sa do Zoho Campaigns a skontrolovať, že nie sú
   naplánované žiadne kampane ani autoresponder (Free plán vie stále posielať).
   Ideálne doménu virtuse.com zo Zoho odstrániť alebo účet zavrieť.
3. **Najbezpečnejší postup**: najprv DMARC s `rua` (časť 3), počkať 2 týždne,
   a SPF čistiť až podľa reportov. Report ukáže každú IP, ktorá posiela s
   `From: @virtuse.com`, vrátane čohokoľvek, na čo sme zabudli. Toto je presne
   účel `p=none`.

### Vedľajšie nálezy (mimo rozsahu, len na vedomie)

- `autodiscover.virtuse.com` CNAME → `autodiscover.nameserver.sk` (starý
  WebSupport hosting). Pre M365 má byť `autodiscover.outlook.com`. Dnes
  Outlook funguje cez iný mechanizmus, ale pri ručnom nastavení klienta to
  vie zdržať. Samostatná drobnosť, nie súčasť tejto úlohy.
- WordPress na blog.virtuse.com (Webglobe, 212.57.32.128) posiela notifikácie a
  Contact Form 7 správy cez PHP mail; `blog.virtuse.com` nemá SPF ani DKIM.
  Pri `p=none` nevadí. Ak v reportoch uvidíme 212.57.32.128 s `From` na
  virtuse.com alebo blog.virtuse.com, treba to vyriešiť (SMTP cez M365 alebo
  Resend) **pred** quarantine, inak CF7 správy skončia v spame.

---

## 6. E) Checklist overenia po aplikácii DNS

Po DMARC + DKIM (deň 0, po propagácii ~1 h):

```bash
dig +short _dmarc.virtuse.com TXT @1.1.1.1
# očakávané: "v=DMARC1; p=none; rua=mailto:dmarc@virtuse.com; adkim=r; aspf=r; fo=1"
dig +short selector1._domainkey.virtuse.com CNAME @1.1.1.1
dig +short selector2._domainkey.virtuse.com CNAME @1.1.1.1
# očakávané: hodnoty z Defender portálu; a TXT za CNAME musí vrátiť "v=DKIM1; k=rsa; p=…":
dig +short selector1._domainkey.virtuse.com TXT @1.1.1.1
dig +short virtuse.com TXT @1.1.1.1 | grep spf1
```

1. Defender → DKIM → virtuse.com: Status „Signing DKIM signatures for this domain".
2. Ras pošle e-mail z vasilisin@virtuse.com na adresu z https://www.mail-tester.com
   (vždy nová adresa, otvoriť stránku, skopírovať). Očakávané: SPF pass,
   **DKIM pass s `d=virtuse.com`, `s=selector1-virtuse-com`** (nie
   onmicrosoft.com), DMARC pass, skóre ≥ 9/10. Výsledok (skóre + tri riadky)
   zapísať sem pod tento checklist.
3. Kontrola do Gmailu: poslať z vasilisin@ na ľubovoľný Gmail → „Show original"
   → riadok Authentication-Results: `spf=pass`, `dkim=pass header.d=virtuse.com`,
   `dmarc=pass`.
4. Brief test cez Resend na vasilisin@virtuse.com (Resend dashboard → Broadcasts
   → Send test, alebo `POST /send` Workera s `kind: plan`). V Outlooku: správa →
   … → View → View message source → `Authentication-Results`: `spf=pass`
   (smtp.mailfrom=send.virtuse.com), `dkim=pass header.d=virtuse.com`,
   `dmarc=pass action=none`. Toto sa po zmene DMARC nesmie zmeniť.
5. Do 48 h: prvý XML report v dmarc@virtuse.com (od google.com, Microsoft
   `dmarcreport@microsoft.com`, Yahoo). Stačí zbierať.

Po zmene SPF (krok 2, až po reportoch): zopakovať body 2–4; navyše skontrolovať,
že reporty neukazujú `spf=fail` pre IP Outlooku (`40.107.x`, `52.100.x` atď.).

Čítanie reportov bez parsera: prílohu `.xml.gz`/`.zip` rozbaliť, hľadať
`<source_ip>` s `<dkim>fail</dkim>` **a** `<spf>fail</spf>` zároveň. Pohodlnejšie:
bezplatný parser (napr. dmarcian XML-to-human, mxtoolbox DMARC report analyzer),
alebo neskôr `rua` presmerovať na bezplatný Postmark DMARC digest.

---

## 7. Harmonogram a odporúčaný dátum pre quarantine

| Krok | Kedy | Čo |
|---|---|---|
| 0 | po „ano" | schránka dmarc@ → DMARC TXT (časť 3) → DKIM M365 (časť 4), v jeden deň |
| 1 | deň 1–2 | prvé reporty, checklist časť 6 |
| 2 | **4. 11. 2026** (2 týždne) | prejsť reporty; ak žiadny iný zdroj okrem Outlooku a Resendu, aplikovať nový SPF (časť 5) |
| 3 | **18. 11. 2026** (4 týždne reportov) | samostatné zadanie: `p=quarantine; pct=25`, po týždni `pct=100`, neskôr `reject` |

Odporúčaný dátum pre krok quarantine: **18. 11. 2026**, za predpokladu, že
reporty od 4. 11. neukazujú žiadne legitímne zlyhania (sledovať najmä
212.57.32.128 Webglobe, preposielanú poštu a Zoho IP `31.186.226.x`,
`185.20.211.x`). Najskorší rozumný termín je 4. 11., ale len ak reporty dovtedy
budú úplne čisté a SPF je už vyčistený.

---

## 8. Čo je aplikované vs. čo čaká

| Položka | Stav |
|---|---|
| Overenie DNS, tenant, Resend tok | hotovo (tento report) |
| Audit SPF (repo, Worker, Mykytova pošta) | hotovo, s dvoma otvorenými kontrolami (Rasova pošta, Zoho Free) |
| Schránka dmarc@virtuse.com | **hotovo 21. 10.** (zdieľaná schránka „DMARC reports“, člen Ras) |
| DMARC TXT s `rua` | **hotovo 21. 10.**, overené cez 1.1.1.1 aj 8.8.8.8 |
| DKIM M365 (2× CNAME + Enable) | **hotovo 21. 10.**, Defender: virtuse.com = Valid / Enabled |
| Nový SPF | **čaká na „ano"**, odporúčam až po 2 týždňoch reportov |
| mail-tester výsledok | **čaká na Rasa**: poslať test z Outlooku na mail-tester.com + jeden Brief test cez Resend (časť 6) |
| BIMI/VMC, quarantine/reject, produkčný web | zámerne nič |

Obmedzenia tohto overenia: Outlook connector = schránka Mykytu; port 25 z tejto
siete blokovaný (SMTP sonda na dmarc@ nevyšla).

### Čo sa reálne aplikovalo 21. 10. 2026 (cez Rasov Chrome, M365 admin center + Defender)

- Zdieľaná schránka `dmarc@virtuse.com` („DMARC reports“, bez licencie), člen Ras Vasilisin.
- `_dmarc.virtuse.com` TXT zmenené z `v=DMARC1; p=none;` na
  `v=DMARC1; p=none; rua=mailto:dmarc@virtuse.com; adkim=r; aspf=r; fo=1` (TTL 1 h).
- DKIM: kľúče v tenante už existovali (stav bol „CnameMissing“, starý formát cieľov), takže
  „Create keys“ nebolo treba. Pridané 2 CNAME presne podľa Defender portálu:
  `selector1._domainkey` → `selector1-virtuse-com._domainkey.virtuseenergy.onmicrosoft.com`,
  `selector2._domainkey` → `selector2-virtuse-com._domainkey.virtuseenergy.onmicrosoft.com`.
  Po propagácii (do 5 minút na 1.1.1.1 aj 8.8.8.8) zapnuté „Sign messages for this domain
  with DKIM signatures“; po Refresh stav **Valid / Enabled**.
- Poznámka: `selector2-…` cieľ zatiaľ nemá TXT (Microsoft ho publikuje až pri rotácii kľúča);
  selector1 má platný `v=DKIM1` záznam. Je to normálne.
- Ostatné domény v tenante (virtuse.eu, virtuse.exchange, virtuse.tech, virtuseexchange.com,
  virtusegroup.com) majú DKIM stále „CnameMissing / Disabled“ – mimo rozsahu tohto kroku.

### Čo zostáva na Rasovi

1. Poslať testovací e-mail z Outlooku na adresu z mail-tester.com a skontrolovať DKIM=pass,
   DMARC=pass (časť 6).
2. Jeden testovací Brief cez Resend a v Gmaili pozrieť „Authentication-Results“ (časť 6).
3. Do schránky dmarc@ začnú chodiť denné XML reporty; po 2 týždňoch (≈ 4. 11.) rozhodnúť
   o novom SPF (časť 5) a neskôr o quarantine (časť 7).
