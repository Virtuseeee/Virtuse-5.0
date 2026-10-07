#!/usr/bin/env python3
"""Open Concierge (Partner Finder), Stacking Strategist, Loan & Liquidity Copilot and Tax & Inheritance Agent
to search engines in all 10 languages.

For concierge/stacking/loan/tax-agent.html in EN and <lang>/ (cs de es fr hu pl ru sk uk):
  - robots -> "index, follow"
  - <title>, meta description, og:/twitter: title + description from T below
    (title <= 60 chars incl. " | Virtuse", description <= 155; asserted)
  - canonical = the page's own URL on virtuse.com (added after og:url if missing)
  - static content inside <div id="root">: <main class="tool-static"> with H1, intro and FAQ.
    It is for crawlers, AI assistants and link previews that don't run JavaScript. With JS on,
    an inline class on <html> hides it, so visitors never see it; React's createRoot replaces it.
Script/link lines pointing at concierge-assets are not touched
(deploy.py rewrites those). Idempotent: run again after editing T.
"""
import html, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']
TOOLS = ['concierge', 'stacking', 'loan', 'tax-agent']

# per lang, per tool: title, description, h1, [intro paragraphs], [(question, answer)]
T = {
 'en': {
  'concierge': ("Partner Finder — Bitcoin Partners in 60 Seconds | Virtuse",
   "Answer a few questions and see which of 22 vetted Bitcoin partners fit your criteria, side by side. Non-custodial, free, no sign-up.",
   "Partner Finder: compare Bitcoin partners in 60 seconds",
   ["Answer a few short questions: what you want to do, where you live, how you want to hold your bitcoin and roughly how much. Partner Finder filters 22 vetted partners down to the ones that meet your criteria and shows them side by side.",
    "You compare and choose yourself. Virtuse never holds your keys or your funds."],
   [("What can Partner Finder help with?", "Buying Bitcoin, self-custody wallets, Bitcoin-backed loans, crypto tax reports, mining, trading bots and company treasury."),
    ("Is it free?", "Yes. Partner Finder is free and needs no registration. Virtuse earns a referral fee from partners when you sign up, at no extra cost to you."),
    ("Does Virtuse hold my bitcoin?", "No. You open an account directly with the partner you choose. Virtuse never holds your keys or funds."),
    ("Is this investment advice?", "No. Partner Finder filters partners by your criteria. It does not tell you what to buy or which partner to pick.")]),
  'stacking': ("Stacking Strategist — DCA Plan and Fee Comparison | Virtuse",
   "Set your Bitcoin buying rhythm, see a long-term DCA projection and compare partner fees per purchase to find the cheapest route.",
   "Stacking Strategist: plan your Bitcoin DCA and compare fees",
   ["Choose how much you put in and whether you buy weekly or monthly, and see a long-term projection of your plan. The fee table compares partner routes and shows how much bitcoin actually lands in your wallet per €1,000.",
    "Projections are mathematical scenarios, not promises. Not financial advice."],
   [("What is DCA?", "Dollar-cost averaging: buying Bitcoin for a fixed amount at regular intervals instead of trying to time the market."),
    ("Which fees does it compare?", "Partner fees as of Q4 2026, for example 0 % on the 21bitcoin Auto-Invest plan, from 0.25 % on ByBit EU and from 0.8 % on Kraken. Check each partner's site for current pricing."),
    ("Is the projection a forecast?", "No. It compounds your contribution at the rate you choose. Past performance never guarantees future results."),
    ("Does Virtuse hold my bitcoin?", "No. You buy and hold through the partner you choose. Virtuse never holds your keys or funds.")]),
 },
 'sk': {
  'concierge': ("Partner Finder — Bitcoin partneri za 60 sekúnd | Virtuse",
   "Odpovedzte na pár otázok a uvidíte, ktorí z 22 preverených Bitcoin partnerov spĺňajú vaše kritériá. Nekustodiálne, zadarmo, bez registrácie.",
   "Partner Finder: porovnajte Bitcoin partnerov za 60 sekúnd",
   ["Odpovedzte na pár krátkych otázok: čo chcete robiť, kde žijete, ako chcete držať svoj bitcoin a o akú sumu približne ide. Partner Finder z 22 preverených partnerov vyberie tých, ktorí spĺňajú vaše kritériá, a ukáže ich vedľa seba.",
    "Porovnáte a vyberiete si sami. Virtuse nikdy nedrží vaše kľúče ani prostriedky."],
   [("S čím Partner Finder pomôže?", "Nákup Bitcoinu, peňaženky na vlastnú úschovu, úvery krytené Bitcoinom, daňové reporty z kryptomien, ťažba, obchodné boty a firemná treasury."),
    ("Je to zadarmo?", "Áno. Partner Finder je zadarmo a bez registrácie. Virtuse zarába províziu za odporúčanie od partnerov, keď sa zaregistrujete, bez dodatočných nákladov pre vás."),
    ("Drží Virtuse môj bitcoin?", "Nie. Účet si otvoríte priamo u partnera, ktorého si vyberiete. Virtuse nikdy nedrží vaše kľúče ani prostriedky."),
    ("Je to investičné poradenstvo?", "Nie. Partner Finder filtruje partnerov podľa vašich kritérií. Nehovorí vám, čo kúpiť ani ktorého partnera si vybrať.")]),
  'stacking': ("Stacking Strategist — DCA plán a poplatky | Virtuse",
   "Nastavte rytmus nákupu Bitcoinu, pozrite si dlhodobú DCA projekciu a porovnajte poplatky partnerov pri každom nákupe.",
   "Stacking Strategist: naplánujte si Bitcoin DCA a porovnajte poplatky",
   ["Zvoľte, koľko vkladáte a či nakupujete týždenne alebo mesačne, a pozrite si dlhodobú projekciu svojho plánu. Tabuľka poplatkov porovná trasy cez partnerov a ukáže, koľko bitcoinu vám naozaj príde do peňaženky na každých 1 000 €.",
    "Projekcie sú matematické scenáre, nie sľuby. Nejde o finančné poradenstvo."],
   [("Čo je DCA?", "Pravidelné investovanie (dollar-cost averaging): nákup Bitcoinu za pevnú sumu v pravidelných intervaloch namiesto snahy trafiť správny okamih."),
    ("Aké poplatky porovnáva?", "Poplatky partnerov k Q4 2026, napríklad 0 % pri pláne Auto-Invest od 21bitcoin, od 0,25 % pri ByBit EU a od 0,8 % pri Kraken. Aktuálne ceny si overte na stránke partnera."),
    ("Je projekcia predpoveď?", "Nie. Zhodnocuje váš vklad zvolenou sadzbou. Minulá výkonnosť nikdy nezaručuje budúce výsledky."),
    ("Drží Virtuse môj bitcoin?", "Nie. Nakupujete a držíte cez partnera, ktorého si vyberiete. Virtuse nikdy nedrží vaše kľúče ani prostriedky.")]),
 },
 'cs': {
  'concierge': ("Partner Finder — Bitcoin partneři za 60 sekund | Virtuse",
   "Odpovězte na pár otázek a uvidíte, kteří z 22 prověřených Bitcoin partnerů splňují vaše kritéria. Nekustodiálně, zdarma, bez registrace.",
   "Partner Finder: porovnejte Bitcoin partnery za 60 sekund",
   ["Odpovězte na pár krátkých otázek: co chcete dělat, kde žijete, jak chcete držet svůj bitcoin a o jakou částku přibližně jde. Partner Finder z 22 prověřených partnerů vybere ty, kteří splňují vaše kritéria, a ukáže je vedle sebe.",
    "Porovnáte a vyberete si sami. Virtuse nikdy nedrží vaše klíče ani prostředky."],
   [("S čím Partner Finder pomůže?", "Nákup Bitcoinu, peněženky pro vlastní úschovu, úvěry kryté Bitcoinem, daňové reporty z kryptoměn, těžba, obchodní boti a firemní treasury."),
    ("Je to zdarma?", "Ano. Partner Finder je zdarma a bez registrace. Virtuse dostává od partnerů provizi za doporučení, když se zaregistrujete, bez dalších nákladů pro vás."),
    ("Drží Virtuse můj bitcoin?", "Ne. Účet si otevřete přímo u partnera, kterého si vyberete. Virtuse nikdy nedrží vaše klíče ani prostředky."),
    ("Je to investiční poradenství?", "Ne. Partner Finder filtruje partnery podle vašich kritérií. Neříká vám, co koupit ani kterého partnera si vybrat.")]),
  'stacking': ("Stacking Strategist — DCA plán a poplatky | Virtuse",
   "Nastavte rytmus nákupu Bitcoinu, prohlédněte si dlouhodobou DCA projekci a porovnejte poplatky partnerů u každého nákupu.",
   "Stacking Strategist: naplánujte si Bitcoin DCA a porovnejte poplatky",
   ["Zvolte, kolik vkládáte a zda nakupujete týdně, nebo měsíčně, a prohlédněte si dlouhodobou projekci svého plánu. Tabulka poplatků porovná cesty přes partnery a ukáže, kolik bitcoinu vám skutečně přijde do peněženky na každých 1 000 €.",
    "Projekce jsou matematické scénáře, ne sliby. Nejde o finanční poradenství."],
   [("Co je DCA?", "Pravidelné investování (dollar-cost averaging): nákup Bitcoinu za pevnou částku v pravidelných intervalech místo snahy trefit správný okamžik."),
    ("Jaké poplatky porovnává?", "Poplatky partnerů k Q4 2026, například 0 % u plánu Auto-Invest od 21bitcoin, od 0,25 % u ByBit EU a od 0,8 % u Kraken. Aktuální ceny si ověřte na stránce partnera."),
    ("Je projekce předpověď?", "Ne. Zhodnocuje váš vklad zvolenou sazbou. Minulá výkonnost nikdy nezaručuje budoucí výsledky."),
    ("Drží Virtuse můj bitcoin?", "Ne. Nakupujete a držíte přes partnera, kterého si vyberete. Virtuse nikdy nedrží vaše klíče ani prostředky.")]),
 },
 'de': {
  'concierge': ("Partner Finder – Bitcoin-Partner in 60 Sekunden | Virtuse",
   "Beantworten Sie ein paar Fragen und sehen Sie, welche von 22 geprüften Bitcoin-Partnern Ihre Kriterien erfüllen. Non-custodial, kostenlos, ohne Anmeldung.",
   "Partner Finder: Bitcoin-Partner in 60 Sekunden vergleichen",
   ["Beantworten Sie ein paar kurze Fragen: was Sie vorhaben, wo Sie leben, wie Sie Ihre Bitcoin halten möchten und um welchen Betrag es ungefähr geht. Partner Finder filtert aus 22 geprüften Partnern diejenigen heraus, die Ihre Kriterien erfüllen, und zeigt sie nebeneinander.",
    "Sie vergleichen und entscheiden selbst. Virtuse verwahrt nie Ihre Schlüssel oder Ihr Geld."],
   [("Wobei hilft Partner Finder?", "Bitcoin kaufen, Wallets zur Selbstverwahrung, bitcoinbesicherte Kredite, Krypto-Steuerberichte, Mining, Trading-Bots und Unternehmens-Treasury."),
    ("Ist es kostenlos?", "Ja. Partner Finder ist kostenlos und ohne Registrierung. Virtuse erhält von Partnern eine Vermittlungsprovision, wenn Sie sich anmelden, ohne Mehrkosten für Sie."),
    ("Verwahrt Virtuse meine Bitcoin?", "Nein. Sie eröffnen Ihr Konto direkt beim gewählten Partner. Virtuse verwahrt nie Ihre Schlüssel oder Ihr Geld."),
    ("Ist das eine Anlageberatung?", "Nein. Partner Finder filtert Partner nach Ihren Kriterien. Er sagt Ihnen nicht, was Sie kaufen oder welchen Partner Sie wählen sollen.")]),
  'stacking': ("Stacking Strategist – DCA-Plan und Gebühren | Virtuse",
   "Legen Sie Ihren Bitcoin-Kaufrhythmus fest, sehen Sie die langfristige DCA-Projektion und vergleichen Sie die Gebühren der Partner pro Kauf.",
   "Stacking Strategist: Bitcoin-DCA planen und Gebühren vergleichen",
   ["Wählen Sie Ihren Betrag und ob Sie wöchentlich oder monatlich kaufen, und sehen Sie die langfristige Projektion Ihres Plans. Die Gebührentabelle vergleicht die Wege über die Partner und zeigt, wie viel Bitcoin pro 1.000 € tatsächlich in Ihrer Wallet ankommt.",
    "Projektionen sind mathematische Szenarien, keine Versprechen. Keine Finanzberatung."],
   [("Was ist DCA?", "Durchschnittskosteneffekt (Dollar-Cost-Averaging): Sie kaufen in regelmäßigen Abständen Bitcoin für einen festen Betrag, statt den richtigen Zeitpunkt abzupassen."),
    ("Welche Gebühren werden verglichen?", "Partnergebühren mit Stand Q4 2026, zum Beispiel 0 % beim Auto-Invest-Sparplan von 21bitcoin, ab 0,25 % bei ByBit EU und ab 0,8 % bei Kraken. Aktuelle Preise finden Sie auf der Website des Partners."),
    ("Ist die Projektion eine Prognose?", "Nein. Sie verzinst Ihre Einzahlung mit dem gewählten Satz. Vergangene Wertentwicklung garantiert nie künftige Ergebnisse."),
    ("Verwahrt Virtuse meine Bitcoin?", "Nein. Sie kaufen und halten über den gewählten Partner. Virtuse verwahrt nie Ihre Schlüssel oder Ihr Geld.")]),
 },
 'fr': {
  'concierge': ("Partner Finder — partenaires Bitcoin en 60 s | Virtuse",
   "Répondez à quelques questions et voyez lesquels des 22 partenaires Bitcoin vérifiés répondent à vos critères. Non custodial, gratuit, sans inscription.",
   "Partner Finder : comparez des partenaires Bitcoin en 60 secondes",
   ["Répondez à quelques questions courtes : ce que vous voulez faire, où vous vivez, comment vous voulez détenir vos bitcoins et le montant approximatif. Partner Finder retient, parmi 22 partenaires vérifiés, ceux qui répondent à vos critères et les affiche côte à côte.",
    "Vous comparez et choisissez vous-même. Virtuse ne détient jamais vos clés ni vos fonds."],
   [("Pour quoi Partner Finder peut-il aider ?", "L'achat de Bitcoin, les portefeuilles en auto-conservation, les prêts garantis par du Bitcoin, les rapports fiscaux crypto, le minage, les bots de trading et la trésorerie d'entreprise."),
    ("Est-ce gratuit ?", "Oui. Partner Finder est gratuit et sans inscription. Virtuse perçoit une commission d'apport des partenaires lorsque vous vous inscrivez, sans frais supplémentaires pour vous."),
    ("Virtuse détient-il mes bitcoins ?", "Non. Vous ouvrez un compte directement chez le partenaire choisi. Virtuse ne détient jamais vos clés ni vos fonds."),
    ("Est-ce un conseil en investissement ?", "Non. Partner Finder filtre les partenaires selon vos critères. Il ne vous dit pas quoi acheter ni quel partenaire choisir.")]),
  'stacking': ("Stacking Strategist — plan DCA et frais | Virtuse",
   "Fixez le rythme de vos achats de Bitcoin, voyez la projection DCA à long terme et comparez les frais des partenaires à chaque achat.",
   "Stacking Strategist : planifiez votre DCA Bitcoin et comparez les frais",
   ["Choisissez votre montant et un rythme hebdomadaire ou mensuel, et voyez la projection à long terme de votre plan. Le tableau des frais compare les parcours via les partenaires et montre combien de bitcoin arrive réellement dans votre portefeuille pour 1 000 €.",
    "Les projections sont des scénarios mathématiques, pas des promesses. Ce n'est pas un conseil financier."],
   [("Qu'est-ce que le DCA ?", "L'investissement programmé (dollar-cost averaging) : acheter du Bitcoin pour un montant fixe à intervalles réguliers plutôt que de chercher le bon moment."),
    ("Quels frais sont comparés ?", "Les frais des partenaires au T4 2026, par exemple 0 % sur le plan Auto-Invest de 21bitcoin, à partir de 0,25 % chez ByBit EU et à partir de 0,8 % chez Kraken. Vérifiez les tarifs actuels sur le site du partenaire."),
    ("La projection est-elle une prévision ?", "Non. Elle capitalise votre versement au taux choisi. Les performances passées ne garantissent jamais les résultats futurs."),
    ("Virtuse détient-il mes bitcoins ?", "Non. Vous achetez et détenez via le partenaire choisi. Virtuse ne détient jamais vos clés ni vos fonds.")]),
 },
 'es': {
  'concierge': ("Partner Finder: socios de Bitcoin en 60 segundos | Virtuse",
   "Responda unas preguntas y vea cuáles de los 22 socios de Bitcoin verificados cumplen sus criterios. No custodial, gratuito y sin registro.",
   "Partner Finder: compare socios de Bitcoin en 60 segundos",
   ["Responda unas preguntas breves: qué quiere hacer, dónde vive, cómo quiere guardar sus bitcoins y de qué importe aproximado hablamos. Partner Finder filtra, entre 22 socios verificados, los que cumplen sus criterios y los muestra lado a lado.",
    "Usted compara y elige. Virtuse nunca custodia sus claves ni sus fondos."],
   [("¿En qué ayuda Partner Finder?", "Comprar Bitcoin, monederos de autocustodia, préstamos con garantía en Bitcoin, informes fiscales de criptomonedas, minería, bots de trading y tesorería empresarial."),
    ("¿Es gratis?", "Sí. Partner Finder es gratuito y no requiere registro. Virtuse recibe una comisión de los socios cuando usted se registra, sin coste adicional para usted."),
    ("¿Virtuse custodia mis bitcoins?", "No. Abre la cuenta directamente con el socio que elija. Virtuse nunca custodia sus claves ni sus fondos."),
    ("¿Es asesoramiento de inversión?", "No. Partner Finder filtra socios según sus criterios. No le dice qué comprar ni qué socio elegir.")]),
  'stacking': ("Stacking Strategist: plan DCA y comisiones | Virtuse",
   "Fije su ritmo de compra de Bitcoin, vea la proyección DCA a largo plazo y compare las comisiones de los socios en cada compra.",
   "Stacking Strategist: planifique su DCA de Bitcoin y compare comisiones",
   ["Elija cuánto aporta y si compra cada semana o cada mes, y vea la proyección a largo plazo de su plan. La tabla de comisiones compara las rutas a través de los socios y muestra cuánto bitcoin llega realmente a su monedero por cada 1.000 €.",
    "Las proyecciones son escenarios matemáticos, no promesas. No es asesoramiento financiero."],
   [("¿Qué es el DCA?", "Promediar el coste (dollar-cost averaging): comprar Bitcoin por un importe fijo a intervalos regulares en lugar de intentar acertar el momento."),
    ("¿Qué comisiones compara?", "Las comisiones de los socios a T4 2026, por ejemplo 0 % en el plan Auto-Invest de 21bitcoin, desde 0,25 % en ByBit EU y desde 0,8 % en Kraken. Consulte los precios actuales en la web de cada socio."),
    ("¿La proyección es una previsión?", "No. Capitaliza su aportación al tipo que elija. La rentabilidad pasada nunca garantiza resultados futuros."),
    ("¿Virtuse custodia mis bitcoins?", "No. Compra y guarda a través del socio que elija. Virtuse nunca custodia sus claves ni sus fondos.")]),
 },
 'pl': {
  'concierge': ("Partner Finder: partnerzy bitcoinowi w 60 sekund | Virtuse",
   "Kilka pytań i zobaczą Państwo, którzy z 22 sprawdzonych partnerów bitcoinowych spełniają Państwa kryteria. Niepowierniczo, bezpłatnie, bez rejestracji.",
   "Partner Finder: porównaj partnerów bitcoinowych w 60 sekund",
   ["Wystarczy kilka krótkich pytań: co chcą Państwo zrobić, gdzie Państwo mieszkają, jak chcą Państwo przechowywać bitcoiny i o jakiej kwocie mniej więcej mowa. Partner Finder wybiera spośród 22 sprawdzonych partnerów tych, którzy spełniają Państwa kryteria, i pokazuje ich obok siebie.",
    "Porównują i wybierają Państwo sami. Virtuse nigdy nie przechowuje Państwa kluczy ani środków."],
   [("W czym pomaga Partner Finder?", "Zakup Bitcoina, portfele do samodzielnego przechowywania, pożyczki pod zastaw Bitcoina, raporty podatkowe z kryptowalut, kopanie, boty tradingowe i skarbiec firmowy."),
    ("Czy to jest bezpłatne?", "Tak. Partner Finder jest bezpłatny i nie wymaga rejestracji. Virtuse otrzymuje od partnerów prowizję za polecenie, gdy się Państwo zarejestrują, bez dodatkowych kosztów dla Państwa."),
    ("Czy Virtuse przechowuje moje bitcoiny?", "Nie. Konto zakładają Państwo bezpośrednio u wybranego partnera. Virtuse nigdy nie przechowuje Państwa kluczy ani środków."),
    ("Czy to doradztwo inwestycyjne?", "Nie. Partner Finder filtruje partnerów według Państwa kryteriów. Nie mówi, co kupić ani którego partnera wybrać.")]),
  'stacking': ("Stacking Strategist: plan DCA i porównanie opłat | Virtuse",
   "Ustal rytm zakupów Bitcoina, zobacz długoterminową prognozę DCA i porównaj opłaty partnerów przy każdym zakupie.",
   "Stacking Strategist: zaplanuj DCA w Bitcoinie i porównaj opłaty",
   ["Wybierają Państwo kwotę i to, czy kupują co tydzień, czy co miesiąc, i widzą długoterminową prognozę swojego planu. Tabela opłat porównuje drogi przez partnerów i pokazuje, ile bitcoina faktycznie trafia do portfela na każde 1000 €.",
    "Prognozy to scenariusze matematyczne, nie obietnice. To nie jest porada finansowa."],
   [("Czym jest DCA?", "Uśrednianie kosztu zakupu (dollar-cost averaging): kupowanie Bitcoina za stałą kwotę w regularnych odstępach zamiast prób trafienia w odpowiedni moment."),
    ("Jakie opłaty porównuje?", "Opłaty partnerów według stanu na IV kwartał 2026, na przykład 0 % w planie Auto-Invest od 21bitcoin, od 0,25 % w ByBit EU i od 0,8 % w Kraken. Aktualne ceny warto sprawdzić na stronie partnera."),
    ("Czy prognoza jest przewidywaniem?", "Nie. Kapitalizuje wpłatę według wybranej stopy. Wyniki historyczne nigdy nie gwarantują przyszłych wyników."),
    ("Czy Virtuse przechowuje moje bitcoiny?", "Nie. Kupują i przechowują Państwo przez wybranego partnera. Virtuse nigdy nie przechowuje Państwa kluczy ani środków.")]),
 },
 'hu': {
  'concierge': ("Partner Finder: Bitcoin-partnerek 60 mp alatt | Virtuse",
   "Néhány kérdés után látja, hogy a 22 ellenőrzött Bitcoin-partner közül melyek felelnek meg a feltételeinek. Nem letétkezelő, ingyenes, regisztráció nélkül.",
   "Partner Finder: Bitcoin-partnerek összevetése 60 másodperc alatt",
   ["Válaszoljon néhány rövid kérdésre: mit szeretne, hol él, hogyan tartaná a bitcoinját, és nagyjából mekkora összegről van szó. A Partner Finder a 22 ellenőrzött partner közül kiszűri azokat, amelyek megfelelnek a feltételeinek, és egymás mellett mutatja őket.",
    "Ön hasonlítja össze és Ön választ. A Virtuse soha nem kezeli az Ön kulcsait vagy pénzét."],
   [("Miben segít a Partner Finder?", "Bitcoin-vásárlás, saját őrzésű tárcák, Bitcoin-fedezetű hitelek, kriptós adójelentések, bányászat, kereskedési botok és vállalati treasury."),
    ("Ingyenes?", "Igen. A Partner Finder ingyenes és nem kell regisztrálni. A Virtuse ajánlói jutalékot kap a partnerektől, ha Ön regisztrál, Önnek ez nem jelent többletköltséget."),
    ("A Virtuse őrzi a bitcoinomat?", "Nem. A számlát közvetlenül a választott partnernél nyitja. A Virtuse soha nem kezeli az Ön kulcsait vagy pénzét."),
    ("Ez befektetési tanácsadás?", "Nem. A Partner Finder az Ön feltételei szerint szűri a partnereket. Nem mondja meg, mit vegyen, vagy melyik partnert válassza.")]),
  'stacking': ("Stacking Strategist: DCA-terv és díjak | Virtuse",
   "Állítsa be a Bitcoin-vásárlás ritmusát, nézze meg a hosszú távú DCA-előrejelzést, és vesse össze a partnerek díjait vásárlásonként.",
   "Stacking Strategist: tervezze meg Bitcoin-DCA-ját, és vesse össze a díjakat",
   ["Válassza ki, mennyit tesz be, és hetente vagy havonta vásárol-e, majd nézze meg terve hosszú távú előrejelzését. A díjtáblázat összeveti a partnereken át vezető utakat, és megmutatja, mennyi bitcoin érkezik ténylegesen a tárcájába minden 1000 € után.",
    "Az előrejelzések matematikai forgatókönyvek, nem ígéretek. Nem pénzügyi tanácsadás."],
   [("Mi az a DCA?", "Átlagár-módszer (dollar-cost averaging): rendszeres időközönként fix összegért vásárol Bitcoint, ahelyett hogy a megfelelő pillanatot próbálná eltalálni."),
    ("Milyen díjakat vet össze?", "A partnerek díjait 2026 negyedik negyedévi állapot szerint, például 0 % a 21bitcoin Auto-Invest tervénél, 0,25 %-tól a ByBit EU-nál és 0,8 %-tól a Krakennél. Az aktuális árakat a partner oldalán ellenőrizze."),
    ("Az előrejelzés jóslat?", "Nem. A befizetését a választott kamattal kamatoztatja. A múltbeli teljesítmény soha nem garantálja a jövőbeli eredményeket."),
    ("A Virtuse őrzi a bitcoinomat?", "Nem. A választott partneren keresztül vásárol és tart. A Virtuse soha nem kezeli az Ön kulcsait vagy pénzét.")]),
 },
 'uk': {
  'concierge': ("Partner Finder: Біткоїн-партнери за 60 секунд | Virtuse",
   "Відповідайте на кілька питань і побачите, хто з 22 перевірених Біткоїн-партнерів відповідає вашим критеріям. Некастодіально, безкоштовно, без реєстрації.",
   "Partner Finder: порівняйте Біткоїн-партнерів за 60 секунд",
   ["Дайте відповідь на кілька коротких питань: що ви хочете зробити, де живете, як хочете зберігати свій біткоїн і про яку приблизно суму йдеться. Partner Finder відбирає з 22 перевірених партнерів тих, хто відповідає вашим критеріям, і показує їх поруч.",
    "Ви порівнюєте й обираєте самі. Virtuse ніколи не зберігає ваші ключі чи кошти."],
   [("З чим допомагає Partner Finder?", "Купівля Біткоїна, гаманці для самостійного зберігання, кредити під заставу Біткоїна, податкові звіти з криптовалют, майнінг, торгові боти та корпоративна казначейська функція."),
    ("Це безкоштовно?", "Так. Partner Finder безкоштовний і не потребує реєстрації. Virtuse отримує від партнерів реферальну винагороду, коли ви реєструєтеся, без додаткових витрат для вас."),
    ("Чи зберігає Virtuse мій біткоїн?", "Ні. Ви відкриваєте рахунок безпосередньо в обраного партнера. Virtuse ніколи не зберігає ваші ключі чи кошти."),
    ("Це інвестиційна порада?", "Ні. Partner Finder фільтрує партнерів за вашими критеріями. Він не каже, що купувати чи якого партнера обрати.")]),
  'stacking': ("Stacking Strategist: план DCA і порівняння комісій | Virtuse",
   "Задайте ритм купівлі Біткоїна, подивіться довгостроковий DCA-прогноз і порівняйте комісії партнерів для кожної покупки.",
   "Stacking Strategist: сплануйте DCA у Біткоїні та порівняйте комісії",
   ["Оберіть суму і те, чи купуєте ви щотижня чи щомісяця, і подивіться довгостроковий прогноз свого плану. Таблиця комісій порівнює шляхи через партнерів і показує, скільки біткоїна справді надходить у ваш гаманець на кожні 1 000 €.",
    "Прогнози є математичними сценаріями, а не обіцянками. Це не фінансова порада."],
   [("Що таке DCA?", "Усереднення вартості (dollar-cost averaging): купівля Біткоїна на фіксовану суму через рівні проміжки часу замість спроб вгадати правильний момент."),
    ("Які комісії порівнюються?", "Комісії партнерів станом на IV квартал 2026 року, наприклад 0 % у плані Auto-Invest від 21bitcoin, від 0,25 % у ByBit EU і від 0,8 % у Kraken. Актуальні ціни перевіряйте на сайті партнера."),
    ("Чи є прогноз передбаченням?", "Ні. Він нараховує складний відсоток на ваш внесок за обраною ставкою. Минулі результати ніколи не гарантують майбутніх."),
    ("Чи зберігає Virtuse мій біткоїн?", "Ні. Ви купуєте і зберігаєте через обраного партнера. Virtuse ніколи не зберігає ваші ключі чи кошти.")]),
 },
 'ru': {
  'concierge': ("Partner Finder: Биткоин-партнёры за 60 секунд | Virtuse",
   "Ответьте на несколько вопросов и увидите, кто из 22 проверенных Биткоин-партнёров подходит под ваши критерии. Некастодиально, бесплатно, без регистрации.",
   "Partner Finder: сравните Биткоин-партнёров за 60 секунд",
   ["Ответьте на несколько коротких вопросов: что вы хотите сделать, где живёте, как хотите хранить свой биткоин и о какой примерно сумме идёт речь. Partner Finder отберёт из 22 проверенных партнёров тех, кто подходит под ваши критерии, и покажет их рядом.",
    "Вы сравниваете и выбираете сами. Virtuse никогда не хранит ваши ключи или средства."],
   [("С чем помогает Partner Finder?", "Покупка Биткоина, кошельки для самостоятельного хранения, кредиты под залог Биткоина, налоговые отчёты по криптовалютам, майнинг, торговые боты и корпоративное казначейство."),
    ("Это бесплатно?", "Да. Partner Finder бесплатный и не требует регистрации. Virtuse получает от партнёров реферальное вознаграждение, когда вы регистрируетесь, без дополнительных расходов для вас."),
    ("Хранит ли Virtuse мой биткоин?", "Нет. Вы открываете счёт напрямую у выбранного партнёра. Virtuse никогда не хранит ваши ключи или средства."),
    ("Это инвестиционный совет?", "Нет. Partner Finder фильтрует партнёров по вашим критериям. Он не говорит, что покупать или какого партнёра выбрать.")]),
  'stacking': ("Stacking Strategist: план DCA и сравнение комиссий | Virtuse",
   "Задайте ритм покупки Биткоина, посмотрите долгосрочный DCA-прогноз и сравните комиссии партнёров для каждой покупки.",
   "Stacking Strategist: спланируйте DCA в Биткоине и сравните комиссии",
   ["Выберите сумму и то, покупаете ли вы еженедельно или ежемесячно, и посмотрите долгосрочный прогноз своего плана. Таблица комиссий сравнивает пути через партнёров и показывает, сколько биткоина действительно приходит в ваш кошелёк на каждые 1 000 €.",
    "Прогнозы — это математические сценарии, а не обещания. Это не финансовый совет."],
   [("Что такое DCA?", "Усреднение стоимости (dollar-cost averaging): покупка Биткоина на фиксированную сумму через равные промежутки времени вместо попыток угадать момент."),
    ("Какие комиссии сравниваются?", "Комиссии партнёров по состоянию на IV квартал 2026 года, например 0 % в плане Auto-Invest от 21bitcoin, от 0,25 % у ByBit EU и от 0,8 % у Kraken. Актуальные цены проверяйте на сайте партнёра."),
    ("Прогноз — это предсказание?", "Нет. Он начисляет сложный процент на ваш взнос по выбранной ставке. Прошлые результаты никогда не гарантируют будущих."),
    ("Хранит ли Virtuse мой биткоин?", "Нет. Вы покупаете и храните через выбранного партнёра. Virtuse никогда не хранит ваши ключи или средства.")]),
 },
}

# Loan and Tax Agent (added 2026-10-07; opened before the tax advisor's review at the user's decision).
# Facts only, no tax rates: the rates live in the module and need the advisor's review.
CC = {
 'en': "Czechia, Slovakia, Poland, Austria, Germany, Hungary, Slovenia, Croatia, Romania, Bulgaria, the Netherlands, France and Spain",
 'sk': "Česko, Slovensko, Poľsko, Rakúsko, Nemecko, Maďarsko, Slovinsko, Chorvátsko, Rumunsko, Bulharsko, Holandsko, Francúzsko a Španielsko",
 'cs': "Česko, Slovensko, Polsko, Rakousko, Německo, Maďarsko, Slovinsko, Chorvatsko, Rumunsko, Bulharsko, Nizozemsko, Francie a Španělsko",
 'de': "Tschechien, Slowakei, Polen, Österreich, Deutschland, Ungarn, Slowenien, Kroatien, Rumänien, Bulgarien, Niederlande, Frankreich und Spanien",
 'fr': "Tchéquie, Slovaquie, Pologne, Autriche, Allemagne, Hongrie, Slovénie, Croatie, Roumanie, Bulgarie, Pays-Bas, France et Espagne",
 'es': "Chequia, Eslovaquia, Polonia, Austria, Alemania, Hungría, Eslovenia, Croacia, Rumanía, Bulgaria, Países Bajos, Francia y España",
 'pl': "Czechy, Słowacja, Polska, Austria, Niemcy, Węgry, Słowenia, Chorwacja, Rumunia, Bułgaria, Holandia, Francja i Hiszpania",
 'hu': "Csehország, Szlovákia, Lengyelország, Ausztria, Németország, Magyarország, Szlovénia, Horvátország, Románia, Bulgária, Hollandia, Franciaország és Spanyolország",
 'uk': "Чехія, Словаччина, Польща, Австрія, Німеччина, Угорщина, Словенія, Хорватія, Румунія, Болгарія, Нідерланди, Франція та Іспанія",
 'ru': "Чехия, Словакия, Польша, Австрия, Германия, Венгрия, Словения, Хорватия, Румыния, Болгария, Нидерланды, Франция и Испания",
}
T2 = {
 'en': {
  'loan': ("Loan & Liquidity Copilot — Sell or Borrow Bitcoin | Virtuse",
   "Compare selling your Bitcoin with borrowing against it: tax if you sell, interest if you borrow, and the price at which a loan gets liquidated.",
   "Loan & Liquidity Copilot: sell your Bitcoin or borrow against it?",
   ["Enter how much bitcoin you hold, how much cash you need, the loan-to-value and the interest rate. The Copilot puts the two paths side by side: the tax you would owe if you sell, and the interest you would pay if you borrow against your bitcoin instead.",
    "It also shows the bitcoin price at which a loan reaches its margin call and can be liquidated, plus a table for different price scenarios. The figures are estimates, not advice."],
   [("What does it compare?", "Selling bitcoin to raise cash versus taking a Bitcoin-backed loan: the tax on the gain if you sell, the interest over the term if you borrow, and how much bitcoin you keep."),
    ("What is the liquidation price?", "The bitcoin price at which the lender can sell your collateral to repay the loan. A lower loan-to-value moves it further away."),
    ("Which tax rate does it use?", "You pick your country's preset or enter your own rate. The presets are an indicative overview, not tax advice; check with a local tax advisor."),
    ("Is this financial advice?", "No. The Copilot shows the numbers for both paths. The decision is yours, and Virtuse never holds your bitcoin.")]),
  'tax-agent': ("Tax & Inheritance Agent — 13 EU Countries | Virtuse",
   "Bitcoin tax overview for 13 EU countries: tax on gains, holding-period exemptions, filing. Plus a six-question inheritance readiness check.",
   "Tax & Inheritance Agent: Bitcoin tax in 13 EU countries and an inheritance check",
   ["Choose your country to see an indicative overview of how bitcoin gains are taxed: the rate, any holding-period exemption and how gains are reported.",
    "The inheritance check asks six yes/no questions and scores how recoverable your bitcoin would be for your heirs. Indicative overview, not tax advice: verify with a local tax advisor."],
   [("Which countries are covered?", "Thirteen: " + CC['en'] + "."),
    ("Is this tax advice?", "No. It is an indicative overview. Tax rules change and every situation is individual, so verify with a local tax advisor."),
    ("What does the inheritance check ask?", "Whether your heirs have written instructions and know your bitcoin exists, whether your keys are separated, whether you use multisig, whether you have tested recovery, and whether accounts and loans are documented."),
    ("Is it free?", "Yes. The Tax & Inheritance Agent is free and needs no registration.")]),
 },
 'sk': {
  'loan': ("Loan & Liquidity Copilot — predať alebo požičať | Virtuse",
   "Porovnajte predaj Bitcoinu s pôžičkou krytou Bitcoinom: daň pri predaji, úroky pri pôžičke a cenu, pri ktorej sa pôžička likviduje.",
   "Loan & Liquidity Copilot: predať Bitcoin, alebo si naň požičať?",
   ["Zadajte, koľko bitcoinu držíte, koľko hotovosti potrebujete, pomer úveru k hodnote (LTV) a úrokovú sadzbu. Copilot postaví obe cesty vedľa seba: daň, ktorú by ste zaplatili pri predaji, a úroky, ktoré by ste zaplatili, ak si namiesto toho požičiate s bitcoinom ako zábezpekou.",
    "Ukáže aj cenu bitcoinu, pri ktorej pôžička dosiahne margin call a môže byť likvidovaná, a tabuľku pre rôzne cenové scenáre. Čísla sú odhady, nie poradenstvo."],
   [("Čo porovnáva?", "Predaj bitcoinu na získanie hotovosti oproti pôžičke krytej Bitcoinom: daň zo zisku pri predaji, úroky za obdobie pôžičky a koľko bitcoinu si ponecháte."),
    ("Čo je likvidačná cena?", "Cena bitcoinu, pri ktorej môže veriteľ predať vašu zábezpeku na splatenie pôžičky. Nižšie LTV ju posúva ďalej."),
    ("Akú daňovú sadzbu používa?", "Vyberiete si prednastavenie pre svoju krajinu alebo zadáte vlastnú sadzbu. Prednastavenia sú orientačný prehľad, nie daňové poradenstvo; overte si ich u daňového poradcu."),
    ("Je to finančné poradenstvo?", "Nie. Copilot ukáže čísla pre obe cesty. Rozhodnutie je na vás a Virtuse nikdy nedrží váš bitcoin.")]),
  'tax-agent': ("Tax & Inheritance Agent — dane v 13 krajinách EÚ | Virtuse",
   "Prehľad zdanenia Bitcoinu v 13 krajinách EÚ: daň zo zisku, oslobodenie podľa doby držby, priznanie. Plus kontrola pripravenosti na dedenie.",
   "Tax & Inheritance Agent: dane z Bitcoinu v 13 krajinách EÚ a kontrola dedenia",
   ["Vyberte si krajinu a uvidíte orientačný prehľad, ako sa zdaňujú zisky z bitcoinu: sadzbu, prípadné oslobodenie podľa doby držby a ako sa zisky priznávajú.",
    "Kontrola dedenia sa pýta šesť otázok áno/nie a ohodnotí, ako ľahko by sa vaši dedičia k bitcoinu dostali. Orientačný prehľad, nie daňové poradenstvo: overte si ho u daňového poradcu."],
   [("Ktoré krajiny pokrýva?", "Trinásť: " + CC['sk'] + "."),
    ("Je to daňové poradenstvo?", "Nie. Ide o orientačný prehľad. Daňové pravidlá sa menia a každá situácia je individuálna, preto si ho overte u daňového poradcu."),
    ("Na čo sa pýta kontrola dedenia?", "Či majú vaši dedičia písomné pokyny a vedia o vašom bitcoine, či sú kľúče oddelené, či používate multisig, či ste otestovali obnovu a či sú účty a pôžičky zdokumentované."),
    ("Je to zadarmo?", "Áno. Tax & Inheritance Agent je zadarmo a bez registrácie.")]),
 },
 'cs': {
  'loan': ("Loan & Liquidity Copilot — prodat, nebo půjčit | Virtuse",
   "Porovnejte prodej Bitcoinu s půjčkou krytou Bitcoinem: daň při prodeji, úroky při půjčce a cenu, při které se půjčka likviduje.",
   "Loan & Liquidity Copilot: prodat Bitcoin, nebo si na něj půjčit?",
   ["Zadejte, kolik bitcoinu držíte, kolik hotovosti potřebujete, poměr úvěru k hodnotě (LTV) a úrokovou sazbu. Copilot postaví obě cesty vedle sebe: daň, kterou byste zaplatili při prodeji, a úroky, které byste zaplatili, pokud si místo toho půjčíte s bitcoinem jako zajištěním.",
    "Ukáže také cenu bitcoinu, při které půjčka dosáhne margin callu a může být likvidována, a tabulku pro různé cenové scénáře. Čísla jsou odhady, ne poradenství."],
   [("Co porovnává?", "Prodej bitcoinu pro získání hotovosti oproti půjčce kryté Bitcoinem: daň ze zisku při prodeji, úroky za dobu půjčky a kolik bitcoinu si ponecháte."),
    ("Co je likvidační cena?", "Cena bitcoinu, při které může věřitel prodat vaše zajištění na splacení půjčky. Nižší LTV ji posouvá dál."),
    ("Jakou daňovou sazbu používá?", "Vyberete si předvolbu pro svou zemi nebo zadáte vlastní sazbu. Předvolby jsou orientační přehled, ne daňové poradenství; ověřte si je u daňového poradce."),
    ("Je to finanční poradenství?", "Ne. Copilot ukáže čísla pro obě cesty. Rozhodnutí je na vás a Virtuse nikdy nedrží váš bitcoin.")]),
  'tax-agent': ("Tax & Inheritance Agent — daně ve 13 zemích EU | Virtuse",
   "Přehled zdanění Bitcoinu ve 13 zemích EU: daň ze zisku, osvobození podle doby držení, přiznání. Plus kontrola připravenosti na dědění.",
   "Tax & Inheritance Agent: daně z Bitcoinu ve 13 zemích EU a kontrola dědění",
   ["Vyberte si zemi a uvidíte orientační přehled, jak se daní zisky z bitcoinu: sazbu, případné osvobození podle doby držení a jak se zisky přiznávají.",
    "Kontrola dědění se ptá na šest otázek ano/ne a ohodnotí, jak snadno by se vaši dědicové k bitcoinu dostali. Orientační přehled, ne daňové poradenství: ověřte si ho u daňového poradce."],
   [("Které země pokrývá?", "Třináct: " + CC['cs'] + "."),
    ("Je to daňové poradenství?", "Ne. Jde o orientační přehled. Daňová pravidla se mění a každá situace je individuální, proto si ho ověřte u daňového poradce."),
    ("Na co se ptá kontrola dědění?", "Zda mají vaši dědicové písemné pokyny a vědí o vašem bitcoinu, zda jsou klíče oddělené, zda používáte multisig, zda jste otestovali obnovu a zda jsou účty a půjčky zdokumentované."),
    ("Je to zdarma?", "Ano. Tax & Inheritance Agent je zdarma a bez registrace.")]),
 },
 'de': {
  'loan': ("Loan & Liquidity Copilot – verkaufen oder beleihen | Virtuse",
   "Vergleichen Sie den Verkauf Ihrer Bitcoin mit einem Bitcoin-besicherten Kredit: Steuer beim Verkauf, Zinsen beim Kredit, Liquidationspreis.",
   "Loan & Liquidity Copilot: Bitcoin verkaufen oder beleihen?",
   ["Geben Sie ein, wie viele Bitcoin Sie halten, wie viel Geld Sie brauchen, den Beleihungsgrad (LTV) und den Zinssatz. Der Copilot stellt beide Wege nebeneinander: die Steuer, die beim Verkauf anfiele, und die Zinsen, die Sie zahlen, wenn Sie stattdessen Ihre Bitcoin beleihen.",
    "Außerdem zeigt er den Bitcoin-Preis, bei dem ein Kredit den Margin Call erreicht und liquidiert werden kann, sowie eine Tabelle für verschiedene Preisszenarien. Die Zahlen sind Schätzungen, keine Beratung."],
   [("Was wird verglichen?", "Bitcoin verkaufen, um Geld zu beschaffen, oder einen Bitcoin-besicherten Kredit aufnehmen: Steuer auf den Gewinn beim Verkauf, Zinsen über die Laufzeit beim Kredit und wie viele Bitcoin Sie behalten."),
    ("Was ist der Liquidationspreis?", "Der Bitcoin-Preis, bei dem der Kreditgeber Ihre Sicherheit verkaufen darf, um den Kredit zu tilgen. Ein niedrigerer Beleihungsgrad schiebt ihn weiter weg."),
    ("Welcher Steuersatz wird verwendet?", "Sie wählen die Voreinstellung Ihres Landes oder geben einen eigenen Satz ein. Die Voreinstellungen sind eine Orientierung, keine Steuerberatung; prüfen Sie sie mit einer Steuerberatung vor Ort."),
    ("Ist das eine Finanzberatung?", "Nein. Der Copilot zeigt die Zahlen beider Wege. Die Entscheidung liegt bei Ihnen, und Virtuse verwahrt nie Ihre Bitcoin.")]),
  'tax-agent': ("Tax & Inheritance Agent – 13 EU-Länder | Virtuse",
   "Bitcoin-Steuern in 13 EU-Ländern im Überblick: Steuer auf Gewinne, Haltefristen, Erklärung. Dazu ein Erbfall-Check mit sechs Fragen.",
   "Tax & Inheritance Agent: Bitcoin-Steuern in 13 EU-Ländern und ein Erbfall-Check",
   ["Wählen Sie Ihr Land und sehen Sie eine Orientierung, wie Bitcoin-Gewinne besteuert werden: den Satz, eine mögliche Steuerfreiheit nach Haltefrist und wie Gewinne erklärt werden.",
    "Der Erbfall-Check stellt sechs Ja/Nein-Fragen und bewertet, wie gut Ihre Erben an Ihre Bitcoin kämen. Orientierung, keine Steuerberatung: prüfen Sie sie mit einer Steuerberatung vor Ort."],
   [("Welche Länder sind abgedeckt?", "Dreizehn: " + CC['de'] + "."),
    ("Ist das eine Steuerberatung?", "Nein. Es ist eine Orientierung. Steuerregeln ändern sich und jede Situation ist individuell, prüfen Sie sie daher mit einer Steuerberatung vor Ort."),
    ("Was fragt der Erbfall-Check?", "Ob Ihre Erben schriftliche Anweisungen haben und von Ihren Bitcoin wissen, ob Ihre Schlüssel getrennt aufbewahrt sind, ob Sie Multisig nutzen, ob Sie die Wiederherstellung getestet haben und ob Konten und Kredite dokumentiert sind."),
    ("Ist das kostenlos?", "Ja. Der Tax & Inheritance Agent ist kostenlos und ohne Registrierung.")]),
 },
 'fr': {
  'loan': ("Loan & Liquidity Copilot — vendre ou emprunter | Virtuse",
   "Comparez la vente de vos bitcoins avec un prêt garanti par Bitcoin : impôt si vous vendez, intérêts si vous empruntez, prix de liquidation.",
   "Loan & Liquidity Copilot : vendre vos bitcoins ou emprunter avec ?",
   ["Indiquez combien de bitcoins vous détenez, de combien d'argent vous avez besoin, le ratio prêt/valeur (LTV) et le taux d'intérêt. Le Copilot met les deux voies côte à côte : l'impôt dû si vous vendez et les intérêts payés si vous empruntez plutôt en gageant vos bitcoins.",
    "Il montre aussi le prix du bitcoin auquel un prêt atteint son appel de marge et peut être liquidé, ainsi qu'un tableau pour différents scénarios de prix. Les chiffres sont des estimations, pas des conseils."],
   [("Que compare-t-il ?", "Vendre des bitcoins pour obtenir des liquidités ou prendre un prêt garanti par Bitcoin : l'impôt sur la plus-value si vous vendez, les intérêts sur la durée si vous empruntez et la quantité de bitcoins que vous gardez."),
    ("Qu'est-ce que le prix de liquidation ?", "Le prix du bitcoin auquel le prêteur peut vendre votre garantie pour rembourser le prêt. Un LTV plus bas l'éloigne."),
    ("Quel taux d'imposition utilise-t-il ?", "Vous choisissez le préréglage de votre pays ou saisissez votre propre taux. Les préréglages sont un aperçu indicatif, pas un conseil fiscal ; vérifiez auprès d'un conseiller fiscal local."),
    ("Est-ce un conseil financier ?", "Non. Le Copilot montre les chiffres des deux voies. La décision vous appartient et Virtuse ne détient jamais vos bitcoins.")]),
  'tax-agent': ("Tax & Inheritance Agent — 13 pays de l'UE | Virtuse",
   "Fiscalité du Bitcoin dans 13 pays de l'UE : impôt sur les gains, exonération selon la durée de détention, déclaration. Plus un test succession.",
   "Tax & Inheritance Agent : la fiscalité du Bitcoin dans 13 pays de l'UE et un test succession",
   ["Choisissez votre pays pour voir un aperçu indicatif de l'imposition des gains en bitcoin : le taux, une éventuelle exonération selon la durée de détention et la façon de déclarer les gains.",
    "Le test succession pose six questions oui/non et évalue dans quelle mesure vos héritiers pourraient récupérer vos bitcoins. Aperçu indicatif, pas un conseil fiscal : vérifiez auprès d'un conseiller fiscal local."],
   [("Quels pays sont couverts ?", "Treize : " + CC['fr'] + "."),
    ("Est-ce un conseil fiscal ?", "Non. C'est un aperçu indicatif. Les règles fiscales changent et chaque situation est individuelle : vérifiez auprès d'un conseiller fiscal local."),
    ("Que demande le test succession ?", "Si vos héritiers ont des instructions écrites et savent que vos bitcoins existent, si vos clés sont séparées, si vous utilisez un multisig, si vous avez testé la récupération et si vos comptes et prêts sont documentés."),
    ("Est-ce gratuit ?", "Oui. Le Tax & Inheritance Agent est gratuit et sans inscription.")]),
 },
 'es': {
  'loan': ("Loan & Liquidity Copilot — vender o pedir prestado | Virtuse",
   "Compare vender su bitcoin con un préstamo respaldado por Bitcoin: impuesto si vende, intereses si pide prestado y precio de liquidación.",
   "Loan & Liquidity Copilot: ¿vender su bitcoin o pedir prestado con él?",
   ["Indique cuánto bitcoin tiene, cuánto dinero necesita, la relación préstamo-valor (LTV) y el tipo de interés. El Copilot pone las dos vías una junto a otra: el impuesto que pagaría si vende y los intereses que pagaría si, en su lugar, pide un préstamo con su bitcoin como garantía.",
    "También muestra el precio del bitcoin al que un préstamo llega a la llamada de margen y puede liquidarse, y una tabla para distintos escenarios de precio. Las cifras son estimaciones, no asesoramiento."],
   [("¿Qué compara?", "Vender bitcoin para obtener dinero frente a un préstamo respaldado por Bitcoin: el impuesto sobre la ganancia si vende, los intereses del plazo si pide prestado y cuánto bitcoin conserva."),
    ("¿Qué es el precio de liquidación?", "El precio del bitcoin al que el prestamista puede vender su garantía para devolver el préstamo. Un LTV más bajo lo aleja."),
    ("¿Qué tipo impositivo usa?", "Elige el valor predefinido de su país o introduce su propio tipo. Los valores predefinidos son orientativos, no asesoramiento fiscal; compruébelos con un asesor fiscal local."),
    ("¿Es asesoramiento financiero?", "No. El Copilot muestra las cifras de las dos vías. La decisión es suya y Virtuse nunca custodia su bitcoin.")]),
  'tax-agent': ("Tax & Inheritance Agent — 13 países de la UE | Virtuse",
   "Fiscalidad del Bitcoin en 13 países de la UE: impuesto sobre ganancias, exención por tiempo de tenencia, declaración. Y un test de herencia.",
   "Tax & Inheritance Agent: impuestos sobre Bitcoin en 13 países de la UE y un test de herencia",
   ["Elija su país para ver una visión orientativa de cómo tributan las ganancias en bitcoin: el tipo, una posible exención por tiempo de tenencia y cómo se declaran.",
    "El test de herencia hace seis preguntas de sí o no y valora hasta qué punto sus herederos podrían recuperar su bitcoin. Visión orientativa, no asesoramiento fiscal: compruébela con un asesor fiscal local."],
   [("¿Qué países cubre?", "Trece: " + CC['es'] + "."),
    ("¿Es asesoramiento fiscal?", "No. Es una visión orientativa. Las normas fiscales cambian y cada situación es distinta, así que compruébela con un asesor fiscal local."),
    ("¿Qué pregunta el test de herencia?", "Si sus herederos tienen instrucciones por escrito y saben que su bitcoin existe, si sus claves están separadas, si usa multifirma, si ha probado la recuperación y si sus cuentas y préstamos están documentados."),
    ("¿Es gratis?", "Sí. El Tax & Inheritance Agent es gratuito y no requiere registro.")]),
 },
 'pl': {
  'loan': ("Loan & Liquidity Copilot — sprzedać czy pożyczyć | Virtuse",
   "Porównaj sprzedaż Bitcoina z pożyczką pod jego zastaw: podatek przy sprzedaży, odsetki przy pożyczce i cena, przy której pożyczka jest likwidowana.",
   "Loan & Liquidity Copilot: sprzedać Bitcoina czy pożyczyć pod jego zastaw?",
   ["Podaj, ile bitcoinów posiadasz, ile gotówki potrzebujesz, wskaźnik LTV i oprocentowanie. Copilot zestawia obie drogi obok siebie: podatek należny przy sprzedaży oraz odsetki, które zapłacisz, jeśli zamiast tego weźmiesz pożyczkę pod zastaw bitcoinów.",
    "Pokazuje też cenę bitcoina, przy której pożyczka osiąga margin call i może zostać zlikwidowana, oraz tabelę dla różnych scenariuszy cenowych. Liczby są szacunkami, nie poradą."],
   [("Co porównuje?", "Sprzedaż bitcoinów w celu uzyskania gotówki lub pożyczkę pod zastaw Bitcoina: podatek od zysku przy sprzedaży, odsetki za okres pożyczki i to, ile bitcoinów zachowasz."),
    ("Czym jest cena likwidacji?", "To cena bitcoina, przy której pożyczkodawca może sprzedać zabezpieczenie, aby spłacić pożyczkę. Niższy LTV odsuwa ją dalej."),
    ("Jakiej stawki podatku używa?", "Wybierasz ustawienie dla swojego kraju lub wpisujesz własną stawkę. Ustawienia mają charakter orientacyjny, nie są poradą podatkową; sprawdź je u doradcy podatkowego."),
    ("Czy to porada finansowa?", "Nie. Copilot pokazuje liczby dla obu dróg. Decyzja należy do Ciebie, a Virtuse nigdy nie przechowuje Twoich bitcoinów.")]),
  'tax-agent': ("Tax & Inheritance Agent — podatki w 13 krajach UE | Virtuse",
   "Opodatkowanie Bitcoina w 13 krajach UE: podatek od zysków, zwolnienie po okresie posiadania, rozliczenie. Plus test gotowości do dziedziczenia.",
   "Tax & Inheritance Agent: podatki od Bitcoina w 13 krajach UE i test dziedziczenia",
   ["Wybierz kraj, aby zobaczyć orientacyjny przegląd opodatkowania zysków z bitcoina: stawkę, ewentualne zwolnienie po okresie posiadania i sposób rozliczenia.",
    "Test dziedziczenia zadaje sześć pytań tak/nie i ocenia, na ile spadkobiercy mogliby odzyskać Twoje bitcoiny. Orientacyjny przegląd, nie porada podatkowa: sprawdź go u doradcy podatkowego."],
   [("Jakie kraje obejmuje?", "Trzynaście: " + CC['pl'] + "."),
    ("Czy to porada podatkowa?", "Nie. To orientacyjny przegląd. Przepisy podatkowe się zmieniają, a każda sytuacja jest inna, dlatego sprawdź go u doradcy podatkowego."),
    ("O co pyta test dziedziczenia?", "Czy spadkobiercy mają pisemne instrukcje i wiedzą o Twoich bitcoinach, czy klucze są przechowywane osobno, czy używasz multisig, czy przetestowałeś odzyskiwanie i czy konta oraz pożyczki są udokumentowane."),
    ("Czy to jest darmowe?", "Tak. Tax & Inheritance Agent jest darmowy i nie wymaga rejestracji.")]),
 },
 'hu': {
  'loan': ("Loan & Liquidity Copilot — eladás vagy hitel | Virtuse",
   "Hasonlítsa össze a Bitcoin eladását egy Bitcoin-fedezetű hitellel: adó eladáskor, kamat hitelnél és az ár, amelynél a hitelt likvidálják.",
   "Loan & Liquidity Copilot: eladja a bitcoinját, vagy hitelt vesz fel rá?",
   ["Adja meg, mennyi bitcoinja van, mennyi készpénzre van szüksége, a hitelfedezeti arányt (LTV) és a kamatlábat. A Copilot egymás mellé teszi a két utat: az adót, amelyet eladáskor fizetne, és a kamatot, amelyet akkor fizet, ha inkább a bitcoinja fedezetével vesz fel hitelt.",
    "Megmutatja azt a bitcoinárat is, amelynél a hitel eléri a margin callt és likvidálható, valamint egy táblázatot különböző árforgatókönyvekre. A számok becslések, nem tanácsadás."],
   [("Mit hasonlít össze?", "A bitcoin eladását készpénzért vagy egy Bitcoin-fedezetű hitelt: a nyereség adóját eladáskor, a futamidő kamatát hitelnél, és hogy mennyi bitcoin marad Önnél."),
    ("Mi a likvidációs ár?", "Az a bitcoinár, amelynél a hitelező eladhatja a fedezetet a hitel visszafizetésére. Alacsonyabb LTV mellett ez távolabb kerül."),
    ("Milyen adókulcsot használ?", "Kiválasztja országa előbeállítását, vagy megad egy saját kulcsot. Az előbeállítások tájékoztató jellegűek, nem adótanácsadás; ellenőrizze őket egy helyi adótanácsadóval."),
    ("Ez pénzügyi tanácsadás?", "Nem. A Copilot mindkét út számait mutatja. A döntés az Öné, és a Virtuse soha nem őrzi a bitcoinját.")]),
  'tax-agent': ("Tax & Inheritance Agent — 13 uniós ország | Virtuse",
   "Bitcoin-adózás 13 uniós országban: a nyereség adója, mentesség tartási idő után, bevallás. Plusz egy hatkérdéses öröklési felkészültségi teszt.",
   "Tax & Inheritance Agent: Bitcoin-adózás 13 uniós országban és öröklési teszt",
   ["Válassza ki országát, és tájékoztató áttekintést kap arról, hogyan adóznak a bitcoinnyereségek: a kulcsról, az esetleges tartási idő utáni mentességről és a bevallás módjáról.",
    "Az öröklési teszt hat igen/nem kérdést tesz fel, és értékeli, mennyire tudnák örökösei visszaszerezni a bitcoinját. Tájékoztató áttekintés, nem adótanácsadás: ellenőrizze egy helyi adótanácsadóval."],
   [("Mely országokat fedi le?", "Tizenhármat: " + CC['hu'] + "."),
    ("Ez adótanácsadás?", "Nem. Tájékoztató áttekintés. Az adószabályok változnak, és minden helyzet egyedi, ezért ellenőrizze egy helyi adótanácsadóval."),
    ("Mit kérdez az öröklési teszt?", "Hogy örökösei kaptak-e írásos útmutatást és tudnak-e a bitcoinjáról, a kulcsok külön helyen vannak-e, használ-e multisiget, kipróbálta-e a visszaállítást, és dokumentálta-e számláit és hiteleit."),
    ("Ingyenes?", "Igen. A Tax & Inheritance Agent ingyenes, és nem kell hozzá regisztráció.")]),
 },
 'uk': {
  'loan': ("Loan & Liquidity Copilot: продати чи позичити | Virtuse",
   "Порівняйте продаж Біткоїна з позикою під його заставу: податок при продажу, відсотки за позикою і ціна, за якої позику ліквідують.",
   "Loan & Liquidity Copilot: продати Біткоїн чи взяти позику під його заставу?",
   ["Вкажіть, скільки біткоїна у вас є, скільки грошей потрібно, коефіцієнт позики до вартості (LTV) і відсоткову ставку. Copilot ставить обидва шляхи поруч: податок, який ви сплатили б при продажу, і відсотки, які сплатите, якщо натомість візьмете позику під заставу біткоїна.",
    "Також показує ціну біткоїна, за якої позика досягає margin call і може бути ліквідована, та таблицю для різних цінових сценаріїв. Цифри є оцінками, а не порадою."],
   [("Що він порівнює?", "Продаж біткоїна заради готівки або позику під заставу Біткоїна: податок на прибуток при продажу, відсотки за строк позики і скільки біткоїна у вас залишиться."),
    ("Що таке ціна ліквідації?", "Ціна біткоїна, за якої кредитор може продати заставу, щоб погасити позику. Нижчий LTV відсуває її далі."),
    ("Яку податкову ставку він використовує?", "Ви обираєте налаштування для своєї країни або вводите власну ставку. Налаштування є орієнтовним оглядом, а не податковою порадою; перевірте їх у податкового консультанта."),
    ("Це фінансова порада?", "Ні. Copilot показує цифри для обох шляхів. Рішення за вами, а Virtuse ніколи не зберігає ваш біткоїн.")]),
  'tax-agent': ("Tax & Inheritance Agent: податки в 13 країнах ЄС | Virtuse",
   "Оподаткування Біткоїна в 13 країнах ЄС: податок на прибуток, звільнення за строком володіння, декларування. Плюс перевірка готовності до спадщини.",
   "Tax & Inheritance Agent: податки на Біткоїн у 13 країнах ЄС і перевірка спадщини",
   ["Оберіть країну, щоб побачити орієнтовний огляд того, як оподатковується прибуток від біткоїна: ставку, можливе звільнення за строком володіння і порядок декларування.",
    "Перевірка спадщини ставить шість питань «так/ні» й оцінює, наскільки легко спадкоємці змогли б отримати ваш біткоїн. Орієнтовний огляд, а не податкова порада: перевірте його в податкового консультанта."],
   [("Які країни охоплено?", "Тринадцять: " + CC['uk'] + "."),
    ("Це податкова порада?", "Ні. Це орієнтовний огляд. Податкові правила змінюються, а кожна ситуація індивідуальна, тож перевірте його в податкового консультанта."),
    ("Про що питає перевірка спадщини?", "Чи мають спадкоємці письмові інструкції й чи знають про ваш біткоїн, чи зберігаються ключі окремо, чи використовуєте ви мультипідпис, чи перевіряли ви відновлення і чи задокументовані рахунки та позики."),
    ("Це безкоштовно?", "Так. Tax & Inheritance Agent безкоштовний і не потребує реєстрації.")]),
 },
 'ru': {
  'loan': ("Loan & Liquidity Copilot: продать или занять | Virtuse",
   "Сравните продажу Биткоина с займом под его залог: налог при продаже, проценты по займу и цена, при которой заём ликвидируют.",
   "Loan & Liquidity Copilot: продать Биткоин или взять заём под его залог?",
   ["Укажите, сколько у вас биткоинов, сколько денег нужно, соотношение займа к стоимости (LTV) и процентную ставку. Copilot ставит оба пути рядом: налог, который вы заплатили бы при продаже, и проценты, которые заплатите, если вместо этого возьмёте заём под залог биткоина.",
    "Также показывает цену биткоина, при которой заём доходит до маржин-колла и может быть ликвидирован, и таблицу для разных ценовых сценариев. Цифры — это оценки, а не совет."],
   [("Что он сравнивает?", "Продажу биткоина ради денег или заём под залог Биткоина: налог на прибыль при продаже, проценты за срок займа и сколько биткоина у вас останется."),
    ("Что такое цена ликвидации?", "Цена биткоина, при которой кредитор может продать залог, чтобы погасить заём. Более низкий LTV отодвигает её дальше."),
    ("Какую налоговую ставку он использует?", "Вы выбираете настройку для своей страны или вводите собственную ставку. Настройки — это ориентировочный обзор, а не налоговая консультация; проверьте их у налогового консультанта."),
    ("Это финансовый совет?", "Нет. Copilot показывает цифры для обоих путей. Решение за вами, а Virtuse никогда не хранит ваш биткоин.")]),
  'tax-agent': ("Tax & Inheritance Agent: налоги в 13 странах ЕС | Virtuse",
   "Налогообложение Биткоина в 13 странах ЕС: налог на прибыль, освобождение по сроку владения, декларация. Плюс проверка готовности к наследству.",
   "Tax & Inheritance Agent: налоги на Биткоин в 13 странах ЕС и проверка наследства",
   ["Выберите страну, чтобы увидеть ориентировочный обзор того, как облагается прибыль от биткоина: ставку, возможное освобождение по сроку владения и порядок декларирования.",
    "Проверка наследства задаёт шесть вопросов «да/нет» и оценивает, насколько легко наследники смогли бы получить ваш биткоин. Ориентировочный обзор, а не налоговая консультация: проверьте его у налогового консультанта."],
   [("Какие страны охвачены?", "Тринадцать: " + CC['ru'] + "."),
    ("Это налоговая консультация?", "Нет. Это ориентировочный обзор. Налоговые правила меняются, а каждая ситуация индивидуальна, поэтому проверьте его у налогового консультанта."),
    ("О чём спрашивает проверка наследства?", "Есть ли у наследников письменные инструкции и знают ли они о вашем биткоине, хранятся ли ключи раздельно, используете ли вы мультиподпись, проверяли ли вы восстановление и задокументированы ли счета и займы."),
    ("Это бесплатно?", "Да. Tax & Inheritance Agent бесплатный и не требует регистрации.")]),
 },
}
for _l, _v in T2.items():
    T[_l].update(_v)

STYLE = ('<style id="tool-static-css">.tool-static{max-width:720px;margin:0 auto;padding:48px 20px 64px;line-height:1.6}'
         '.tool-static h1{font-size:28px;line-height:1.25;margin:0 0 16px}.tool-static h2{font-size:18px;margin:28px 0 6px}'
         '.tool-static p{margin:0 0 12px}html.js .tool-static{display:none}</style>\n'
         '<script>document.documentElement.classList.add(\'js\')</script>')

def e(s): return html.escape(s, quote=False)
def a(s): return html.escape(s, quote=True)

def url(lang, tool): return f'https://virtuse.com/{tool}.html' if lang == 'en' else f'https://virtuse.com/{lang}/{tool}.html'

def set_attr(s, sel, val):
    pat = re.compile(r'(<meta ' + re.escape(sel) + r' content=")[^"]*(">)')
    if not pat.search(s): sys.exit(f'missing {sel}')
    return pat.sub(lambda m: m.group(1) + a(val) + m.group(2), s, count=1)

def static_block(lang, tool):
    _, _, h1, intro, faq = T[lang][tool]
    parts = [f'<h1>{e(h1)}</h1>'] + [f'<p>{e(p)}</p>' for p in intro]
    for q, ans in faq: parts += [f'<h2>{e(q)}</h2>', f'<p>{e(ans)}</p>']
    return '<main class="tool-static">' + ''.join(parts) + '</main>'

errors = []
for lang in LANGS:
    for tool in TOOLS:
        title, desc = T[lang][tool][:2]
        if len(title) > 60: errors.append(f'{lang}/{tool} title {len(title)}')
        if len(desc) > 155: errors.append(f'{lang}/{tool} desc {len(desc)}')
        if title.count('Virtuse') != 1: errors.append(f'{lang}/{tool} title has Virtuse x{title.count("Virtuse")}')
if errors: sys.exit('\n'.join(errors))

for lang in LANGS:
    for tool in TOOLS:
        p = os.path.join(SITE, f'{tool}.html' if lang == 'en' else f'{lang}/{tool}.html')
        s = orig = open(p, encoding='utf-8').read()
        title, desc = T[lang][tool][:2]
        s = re.sub(r'<meta name="robots" content="[^"]*">', '<meta name="robots" content="index, follow">', s, count=1)
        s = re.sub(r'<title>.*?</title>', lambda m: f'<title>{e(title)}</title>', s, count=1)
        for sel in ('name="description"', 'property="og:description"', 'name="twitter:description"'): s = set_attr(s, sel, desc)
        for sel in ('property="og:title"', 'name="twitter:title"'): s = set_attr(s, sel, title)
        if 'rel="canonical"' not in s:
            s = re.sub(r'(<meta property="og:url" content="[^"]*">\n)', lambda m: m.group(1) + f'<link rel="canonical" href="{url(lang, tool)}">\n', s, count=1)
        else:
            s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url(lang, tool)}">', s, count=1)
        s = re.sub(r'<style id="tool-static-css">.*?</style>\n<script>document\.documentElement\.classList\.add\(\'js\'\)</script>\n', '', s, flags=re.S)
        s = s.replace('<meta name="robots" content="index, follow">\n', '<meta name="robots" content="index, follow">\n' + STYLE + '\n', 1)
        s, n = re.subn(r'<div id="root">(?:<main class="tool-static">.*?</main>)?</div>', lambda m: '<div id="root">' + static_block(lang, tool) + '</div>', s, count=1, flags=re.S)
        if n != 1 or 'rel="canonical"' not in s or 'tool-static-css' not in s: sys.exit(f'{p}: pattern not found')
        if s != orig:
            open(p, 'w', encoding='utf-8').write(s)
            print('updated', os.path.relpath(p, SITE))

# sitemap: one <url> per tool page with all 10 hreflang alternates, inside its own markers
# (outside SEO-BUILD and STORIES-BUILD, which other generators own)
import datetime
sm = os.path.join(SITE, 'sitemap.xml'); s = open(sm, encoding='utf-8').read()
today = datetime.date.today().isoformat()
old = re.search(r'<!-- TOOLS:START -->.*?<!-- TOOLS:END -->\n', s, re.S)
prev = dict(re.findall(r'<loc>([^<]+)</loc>\n    <lastmod>([^<]+)</lastmod>', old.group(0))) if old else {}
rows = ['<!-- TOOLS:START -->']
for tool in TOOLS:
    alts = ''.join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{url(l, tool)}"/>' for l in LANGS)
    alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{url("en", tool)}"/>'
    for lang in LANGS:
        u = url(lang, tool)
        rows.append(f'  <url>\n    <loc>{u}</loc>\n    <lastmod>{prev.get(u, today)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>{alts}\n  </url>')
rows.append('<!-- TOOLS:END -->\n')
block = '\n'.join(rows)
n = s[:old.start()] + block + s[old.end():] if old else s.replace('<!-- SEO-BUILD:START -->', block + '<!-- SEO-BUILD:START -->', 1)
if n != s:
    open(sm, 'w', encoding='utf-8').write(n); print('updated sitemap.xml')
