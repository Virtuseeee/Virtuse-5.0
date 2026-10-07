#!/usr/bin/env python3
"""Open Concierge (Partner Finder) and Stacking Strategist to search engines in all 10 languages.

For concierge.html and stacking.html in EN and <lang>/ (cs de es fr hu pl ru sk uk):
  - robots -> "index, follow"
  - <title>, meta description, og:/twitter: title + description from T below
    (title <= 60 chars incl. " | Virtuse", description <= 155; asserted)
  - canonical = the page's own URL on virtuse.com (added after og:url if missing)
  - static content inside <div id="root">: <main class="tool-static"> with H1, intro and FAQ.
    It is for crawlers, AI assistants and link previews that don't run JavaScript. With JS on,
    an inline class on <html> hides it, so visitors never see it; React's createRoot replaces it.
Loan and Tax Agent are not touched. Script/link lines pointing at concierge-assets are not touched
(deploy.py rewrites those). Idempotent: run again after editing T.
"""
import html, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['en', 'sk', 'cs', 'de', 'fr', 'es', 'pl', 'hu', 'uk', 'ru']
TOOLS = ['concierge', 'stacking']

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
