#!/usr/bin/env python3
"""Privacy policy section 10 "Bitcoin Ecosystem applications" in all 10 languages (idempotent).

Edits the sources in legacy/src/<lang>/privacy-policy.html, then run
  python3 build_legacy.py privacy-policy.html
EN and SK are the texts approved by Ras on 2026-10-23 (handover ecosystem-prelaunch-review.md, no lawyer
review); the other languages translate them in the register of each policy page. Adds the section after
section 9 (#verdict-cfo), its link in the section pills, a row-style overview table, and names the form in
the section 2 sentence "the only personal data this website asks you for".
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
MAIL = '<a href="mailto:info@virtuse.com">info@virtuse.com</a>'


def link(l):
    p = '/ecosystem/promote/' if l == 'en' else '/%s/ecosystem/promote/' % l
    return '<a href="%s">virtuse.com%s</a>' % (p, p)


T = {
 'en': dict(
  pill='Ecosystem',
  title='10. Bitcoin Ecosystem applications',
  s2=('Apart from Virtuse Verdict and Virtuse CFO (section 9), that is',
      'Apart from Virtuse Verdict and Virtuse CFO (section 9) and the Ecosystem application form (section 10), that is'),
  sums=['What we process and why', 'How your application is handled', 'What we publish', 'How long we keep it', 'Overview of processing'],
  p=["If you apply to have a project listed in the Virtuse Bitcoin Ecosystem ({link}), we process the details you enter: your name and email address, the project's name, website, description, category, countries served, licence details and repository link if you give them, whether you are interested in a sponsored placement, your message and the form language. We use them only to review the application, contact you about it and, if the project is accepted, prepare and maintain the listing. Legal basis: steps taken at your request before a possible agreement (Art. 6(1)(b) GDPR) and our legitimate interest in running a curated directory (Art. 6(1)(f) GDPR).",
     "The application is sent by email to our team through Resend (email service, processor) and is not stored in a database. To protect the form against spam we use Cloudflare Turnstile, which checks technical data from your browser and your IP address (Cloudflare, processor; transfers as described in section 6). To limit abuse we count submissions per IP address for one hour and remember the email address for 24 hours, so that only one confirmation is sent.",
     "We publish only information about the project (name, website, description and our own short verdict), never your name or email address. Paid or featured placements are always labelled.",
     "Retention: applications we decline are deleted 12 months after our decision. For accepted projects we keep the application and correspondence for as long as the listing is live and for 2 years after it is removed. You can withdraw an application or ask us to delete your details at any time at {mail} (subject \"Data protection\"); your rights are described in section 7."],
  row=['Bitcoin Ecosystem application', 'name, email, project details', 'reviewing the application, preparing and maintaining the listing',
       'Art. 6(1)(b) and (f) GDPR', 'Resend (email service), Cloudflare (Turnstile, Workers)',
       'declined: 12 months after the decision; accepted: while the listing is live and 2 years after it is removed']),
 'sk': dict(
  pill='Ekosystém',
  title='10. Žiadosti o zaradenie do Bitcoin Ecosystem',
  s2=('Okrem Virtuse Verdict a Virtuse CFO (časť 9) je to',
      'Okrem Virtuse Verdict a Virtuse CFO (časť 9) a formulára žiadosti o zaradenie do Bitcoin Ecosystem (časť 10) je to'),
  sums=['Čo spracúvame a prečo', 'Ako sa žiadosť spracúva', 'Čo zverejňujeme', 'Ako dlho údaje uchovávame', 'Prehľad spracúvania'],
  p=["Ak požiadate o zaradenie projektu do Virtuse Bitcoin Ecosystem ({link}), spracúvame údaje, ktoré zadáte: vaše meno a e-mailovú adresu, názov projektu, web, popis, kategóriu, krajiny, v ktorých pôsobí, údaje o licencii a odkaz na repozitár (ak ich uvediete), či máte záujem o sponzorované umiestnenie, vašu správu a jazyk formulára. Používame ich len na posúdenie žiadosti, na komunikáciu s vami o nej a v prípade prijatia na prípravu a správu záznamu. Právny základ: opatrenia pred prípadným uzavretím dohody na vašu žiadosť (čl. 6 ods. 1 písm. b) GDPR) a náš oprávnený záujem na prevádzke kurátorovaného adresára (čl. 6 ods. 1 písm. f) GDPR).",
     "Žiadosť sa posiela e-mailom nášmu tímu cez službu Resend (e-mailová služba, sprostredkovateľ) a neukladá sa do databázy. Na ochranu formulára pred spamom používame Cloudflare Turnstile, ktorý overuje technické údaje z vášho prehliadača a vašu IP adresu (Cloudflare, sprostredkovateľ; prenosy podľa časti 6). Na obmedzenie zneužitia počítame odoslania z jednej IP adresy počas jednej hodiny a e-mailovú adresu si pamätáme 24 hodín, aby sme poslali len jedno potvrdenie.",
     "Zverejňujeme len údaje o projekte (názov, web, popis a naše krátke hodnotenie), nikdy vaše meno ani e-mailovú adresu. Platené alebo zvýraznené umiestnenia sú vždy označené.",
     "Uchovávanie: zamietnuté žiadosti vymažeme 12 mesiacov od nášho rozhodnutia. Pri prijatých projektoch uchovávame žiadosť a korešpondenciu počas zverejnenia záznamu a 2 roky po jeho odstránení. Žiadosť môžete kedykoľvek stiahnuť alebo požiadať o vymazanie údajov na {mail} (predmet „Ochrana osobných údajov“); vaše práva sú opísané v časti 7."],
  row=['Žiadosť o zaradenie do Bitcoin Ecosystem', 'meno, e-mail, údaje o projekte', 'posúdenie žiadosti, príprava a správa záznamu',
       'čl. 6 ods. 1 písm. b) a f) GDPR', 'Resend (e-mailová služba), Cloudflare (Turnstile, Workers)',
       'zamietnuté: 12 mesiacov od rozhodnutia; prijaté: počas zverejnenia záznamu a 2 roky po jeho odstránení']),
 'cs': dict(
  pill='Ekosystém',
  title='10. Žádosti o zařazení do Bitcoinového ekosystému Virtuse',
  s2=('Kromě Virtuse Verdict a Virtuse CFO (část 9) je to',
      'Kromě Virtuse Verdict a Virtuse CFO (část 9) a formuláře žádosti o zařazení do Bitcoinového ekosystému Virtuse (část 10) je to'),
  sums=['Co zpracováváme a proč', 'Jak se žádost zpracovává', 'Co zveřejňujeme', 'Jak dlouho údaje uchováváme', 'Přehled zpracování'],
  p=["Pokud požádáte o zařazení projektu do Bitcoinového ekosystému Virtuse ({link}), zpracováváme údaje, které zadáte: vaše jméno a e-mailovou adresu, název projektu, web, popis, kategorii, země, kde projekt působí, údaje o licenci a odkaz na repozitář (pokud je uvedete), zda máte zájem o sponzorované umístění, vaši zprávu a jazyk formuláře. Používáme je pouze k posouzení žádosti, ke komunikaci s vámi o ní a v případě přijetí k přípravě a správě záznamu. Právní základ: opatření přijatá před případným uzavřením dohody na vaši žádost (čl. 6 odst. 1 písm. b) GDPR) a náš oprávněný zájem na provozu kurátorovaného adresáře (čl. 6 odst. 1 písm. f) GDPR).",
     "Žádost se posílá e-mailem našemu týmu přes službu Resend (e-mailová služba, zpracovatel) a neukládá se do databáze. K ochraně formuláře před spamem používáme Cloudflare Turnstile, který ověřuje technické údaje z vašeho prohlížeče a vaši IP adresu (Cloudflare, zpracovatel; předávání podle části 6). Abychom omezili zneužití, počítáme odeslání z jedné IP adresy po dobu jedné hodiny a e-mailovou adresu si pamatujeme 24 hodin, abychom poslali jen jedno potvrzení.",
     "Zveřejňujeme pouze údaje o projektu (název, web, popis a naše krátké hodnocení), nikdy vaše jméno ani e-mailovou adresu. Placená nebo zvýrazněná umístění jsou vždy označena.",
     "Uchovávání: zamítnuté žádosti vymažeme 12 měsíců od našeho rozhodnutí. U přijatých projektů uchováváme žádost a korespondenci po dobu zveřejnění záznamu a 2 roky po jeho odstranění. Žádost můžete kdykoli stáhnout nebo požádat o výmaz údajů na {mail} (předmět „Ochrana osobních údajů“); vaše práva jsou popsána v části 7."],
  row=['Žádost o zařazení do Bitcoinového ekosystému Virtuse', 'jméno, e-mail, údaje o projektu', 'posouzení žádosti, příprava a správa záznamu',
       'čl. 6 odst. 1 písm. b) a f) GDPR', 'Resend (e-mailová služba), Cloudflare (Turnstile, Workers)',
       'zamítnuté: 12 měsíců od rozhodnutí; přijaté: po dobu zveřejnění záznamu a 2 roky po jeho odstranění']),
 'de': dict(
  pill='Ökosystem',
  title='10. Anträge auf Aufnahme in das Bitcoin Ecosystem',
  s2=('Abgesehen von Virtuse Verdict und Virtuse CFO (Abschnitt 9) ist dies',
      'Abgesehen von Virtuse Verdict und Virtuse CFO (Abschnitt 9) sowie dem Antragsformular für das Bitcoin Ecosystem (Abschnitt 10) ist dies'),
  sums=['Was wir verarbeiten und warum', 'Wie Ihr Antrag bearbeitet wird', 'Was wir veröffentlichen', 'Wie lange wir die Daten speichern', 'Übersicht der Verarbeitung'],
  p=["Wenn Sie die Aufnahme eines Projekts in das Virtuse Bitcoin Ecosystem beantragen ({link}), verarbeiten wir die Angaben, die Sie eintragen: Ihren Namen und Ihre E-Mail-Adresse, Name, Website, Beschreibung und Kategorie des Projekts, die Länder, in denen es tätig ist, Angaben zur Lizenz und den Link zum Repository (sofern Sie diese machen), ob Sie an einer gesponserten Platzierung interessiert sind, Ihre Nachricht und die Sprache des Formulars. Wir verwenden sie ausschließlich, um den Antrag zu prüfen, mit Ihnen darüber zu kommunizieren und, wenn das Projekt aufgenommen wird, den Eintrag zu erstellen und zu pflegen. Rechtsgrundlage: Durchführung vorvertraglicher Maßnahmen auf Ihre Anfrage (Art. 6 Abs. 1 lit. b DSGVO) und unser berechtigtes Interesse am Betrieb eines kuratierten Verzeichnisses (Art. 6 Abs. 1 lit. f DSGVO).",
     "Der Antrag wird per E-Mail über Resend (E-Mail-Dienst, Auftragsverarbeiter) an unser Team gesendet und nicht in einer Datenbank gespeichert. Zum Schutz des Formulars vor Spam verwenden wir Cloudflare Turnstile, das technische Daten Ihres Browsers und Ihre IP-Adresse prüft (Cloudflare, Auftragsverarbeiter; Übermittlungen wie in Abschnitt 6 beschrieben). Um Missbrauch zu begrenzen, zählen wir die Einsendungen je IP-Adresse eine Stunde lang und speichern die E-Mail-Adresse 24 Stunden, damit nur eine Bestätigung verschickt wird.",
     "Wir veröffentlichen nur Angaben zum Projekt (Name, Website, Beschreibung und unsere eigene kurze Einschätzung), niemals Ihren Namen oder Ihre E-Mail-Adresse. Bezahlte oder hervorgehobene Platzierungen sind immer gekennzeichnet.",
     "Speicherdauer: Abgelehnte Anträge löschen wir 12 Monate nach unserer Entscheidung. Bei aufgenommenen Projekten bewahren wir Antrag und Korrespondenz auf, solange der Eintrag veröffentlicht ist, und 2 Jahre nach seiner Entfernung. Sie können einen Antrag jederzeit zurückziehen oder die Löschung Ihrer Daten verlangen: {mail} (Betreff „Datenschutz“); Ihre Rechte sind in Abschnitt 7 beschrieben."],
  row=['Antrag auf Aufnahme in das Bitcoin Ecosystem', 'Name, E-Mail, Angaben zum Projekt', 'Prüfung des Antrags, Erstellung und Pflege des Eintrags',
       'Art. 6 Abs. 1 lit. b und f DSGVO', 'Resend (E-Mail-Dienst), Cloudflare (Turnstile, Workers)',
       'abgelehnt: 12 Monate nach der Entscheidung; aufgenommen: solange der Eintrag veröffentlicht ist, und 2 Jahre nach seiner Entfernung']),
 'fr': dict(
  pill='Écosystème',
  title='10. Candidatures au Bitcoin Ecosystem',
  s2=("En dehors de Virtuse Verdict et Virtuse CFO (section 9), c'est",
      "En dehors de Virtuse Verdict et Virtuse CFO (section 9) et du formulaire de candidature au Bitcoin Ecosystem (section 10), c'est"),
  sums=['Ce que nous traitons et pourquoi', 'Traitement de votre candidature', 'Ce que nous publions', 'Durée de conservation', "Vue d'ensemble du traitement"],
  p=["Si vous demandez le référencement d'un projet dans le Virtuse Bitcoin Ecosystem ({link}), nous traitons les informations que vous saisissez&nbsp;: votre nom et votre adresse e-mail, le nom, le site web, la description et la catégorie du projet, les pays où il est actif, les informations de licence et le lien vers le dépôt (si vous les indiquez), votre intérêt éventuel pour un placement sponsorisé, votre message et la langue du formulaire. Nous les utilisons uniquement pour examiner la candidature, échanger avec vous à son sujet et, si le projet est retenu, préparer et tenir à jour sa fiche. Base juridique&nbsp;: mesures précontractuelles prises à votre demande (art. 6, par. 1, point b) du RGPD) et notre intérêt légitime à exploiter un annuaire sélectionné (art. 6, par. 1, point f) du RGPD).",
     "La candidature est envoyée par e-mail à notre équipe via Resend (service d'e-mail, sous-traitant) et n'est pas enregistrée dans une base de données. Pour protéger le formulaire contre le spam, nous utilisons Cloudflare Turnstile, qui vérifie des données techniques de votre navigateur et votre adresse IP (Cloudflare, sous-traitant&nbsp;; transferts décrits à la section 6). Pour limiter les abus, nous comptons les envois par adresse IP pendant une heure et conservons l'adresse e-mail pendant 24 heures, afin de n'envoyer qu'une seule confirmation.",
     "Nous ne publions que des informations sur le projet (nom, site web, description et notre propre avis succinct), jamais votre nom ni votre adresse e-mail. Les placements payants ou mis en avant sont toujours signalés.",
     "Conservation&nbsp;: les candidatures refusées sont supprimées 12 mois après notre décision. Pour les projets retenus, nous conservons la candidature et la correspondance tant que la fiche est en ligne, puis 2 ans après son retrait. Vous pouvez retirer votre candidature ou demander la suppression de vos données à tout moment à {mail} (objet «&nbsp;Protection des données&nbsp;»)&nbsp;; vos droits sont décrits à la section 7."],
  row=['Candidature au Bitcoin Ecosystem', 'nom, e-mail, informations sur le projet', 'examen de la candidature, préparation et mise à jour de la fiche',
       'art. 6, par. 1, points b) et f) du RGPD', "Resend (service d'e-mail), Cloudflare (Turnstile, Workers)",
       'refusées&nbsp;: 12 mois après la décision&nbsp;; retenues&nbsp;: tant que la fiche est en ligne, puis 2 ans après son retrait']),
 'es': dict(
  pill='Ecosistema',
  title='10. Solicitudes al Ecosistema Bitcoin',
  s2=('Aparte de Virtuse Verdict y Virtuse CFO (sección 9), ese es',
      'Aparte de Virtuse Verdict y Virtuse CFO (sección 9) y del formulario de solicitud del Ecosistema Bitcoin (sección 10), ese es'),
  sums=['Qué datos tratamos y por qué', 'Cómo se gestiona su solicitud', 'Qué publicamos', 'Cuánto tiempo conservamos los datos', 'Resumen del tratamiento'],
  p=["Si solicita la inclusión de un proyecto en el Ecosistema Bitcoin de Virtuse ({link}), tratamos los datos que introduce: su nombre y dirección de correo electrónico, el nombre, el sitio web, la descripción y la categoría del proyecto, los países en los que opera, los datos de licencia y el enlace al repositorio (si los facilita), si le interesa una posición patrocinada, su mensaje y el idioma del formulario. Los utilizamos únicamente para revisar la solicitud, comunicarnos con usted sobre ella y, si el proyecto es aceptado, preparar y mantener su ficha. Base jurídica: aplicación de medidas precontractuales a petición suya (art. 6.1.b) del RGPD) y nuestro interés legítimo en gestionar un directorio seleccionado (art. 6.1.f) del RGPD).",
     "La solicitud se envía por correo electrónico a nuestro equipo a través de Resend (servicio de correo electrónico, encargado del tratamiento) y no se guarda en ninguna base de datos. Para proteger el formulario contra el spam utilizamos Cloudflare Turnstile, que comprueba datos técnicos de su navegador y su dirección IP (Cloudflare, encargado del tratamiento; transferencias según la sección 6). Para limitar los abusos, contamos los envíos por dirección IP durante una hora y recordamos la dirección de correo electrónico durante 24 horas, para enviar una sola confirmación.",
     "Solo publicamos información sobre el proyecto (nombre, sitio web, descripción y nuestra breve valoración), nunca su nombre ni su dirección de correo electrónico. Los espacios de pago o destacados siempre están identificados.",
     "Conservación: las solicitudes rechazadas se eliminan 12 meses después de nuestra decisión. En el caso de los proyectos aceptados, conservamos la solicitud y la correspondencia mientras la ficha esté publicada y durante 2 años después de su retirada. Puede retirar su solicitud o pedir la supresión de sus datos en cualquier momento en {mail} (asunto «Protección de datos»); sus derechos se describen en la sección 7."],
  row=['Solicitud al Ecosistema Bitcoin', 'nombre, correo electrónico, datos del proyecto', 'revisión de la solicitud, preparación y mantenimiento de la ficha',
       'art. 6.1.b) y f) del RGPD', 'Resend (servicio de correo electrónico), Cloudflare (Turnstile, Workers)',
       'rechazadas: 12 meses después de la decisión; aceptadas: mientras la ficha esté publicada y 2 años después de su retirada']),
 'pl': dict(
  pill='Ekosystem',
  title='10. Zgłoszenia do Bitcoin Ecosystem',
  s2=('Poza Virtuse Verdict i Virtuse CFO (sekcja 9) są to',
      'Poza Virtuse Verdict i Virtuse CFO (sekcja 9) oraz formularzem zgłoszeniowym do Bitcoin Ecosystem (sekcja 10) są to'),
  sums=['Jakie dane przetwarzamy i dlaczego', 'Jak rozpatrujemy zgłoszenie', 'Co publikujemy', 'Jak długo przechowujemy dane', 'Przegląd przetwarzania'],
  p=["Jeśli zgłoszą Państwo projekt do Virtuse Bitcoin Ecosystem ({link}), przetwarzamy wpisane dane: imię i nazwisko oraz adres e-mail, nazwę, stronę internetową, opis i kategorię projektu, kraje, w których działa, informacje o licencji i link do repozytorium (jeśli je Państwo podadzą), informację, czy są Państwo zainteresowani miejscem sponsorowanym, wiadomość oraz język formularza. Używamy ich wyłącznie do rozpatrzenia zgłoszenia, kontaktu z Państwem w jego sprawie oraz, w razie przyjęcia projektu, do przygotowania i prowadzenia wpisu. Podstawa prawna: działania podejmowane na Państwa żądanie przed ewentualnym zawarciem umowy (art. 6 ust. 1 lit. b RODO) oraz nasz prawnie uzasadniony interes w prowadzeniu wyselekcjonowanego katalogu (art. 6 ust. 1 lit. f RODO).",
     "Zgłoszenie jest wysyłane e-mailem do naszego zespołu za pośrednictwem Resend (usługa e-mail, podmiot przetwarzający) i nie jest zapisywane w bazie danych. Do ochrony formularza przed spamem używamy Cloudflare Turnstile, który sprawdza dane techniczne przeglądarki oraz adres IP (Cloudflare, podmiot przetwarzający; przekazywanie danych zgodnie z sekcją 6). Aby ograniczyć nadużycia, liczymy zgłoszenia wysłane z jednego adresu IP w ciągu godziny i przechowujemy adres e-mail przez 24 godziny, aby wysłać tylko jedno potwierdzenie.",
     "Publikujemy wyłącznie informacje o projekcie (nazwę, stronę internetową, opis i naszą krótką ocenę), nigdy imienia i nazwiska ani adresu e-mail. Miejsca płatne lub wyróżnione są zawsze oznaczone.",
     "Przechowywanie: odrzucone zgłoszenia usuwamy 12 miesięcy po naszej decyzji. W przypadku przyjętych projektów przechowujemy zgłoszenie i korespondencję przez cały okres publikacji wpisu oraz przez 2 lata po jego usunięciu. W każdej chwili mogą Państwo wycofać zgłoszenie lub zażądać usunięcia danych, pisząc na {mail} (temat „Ochrona danych osobowych”); Państwa prawa opisuje sekcja 7."],
  row=['Zgłoszenie do Bitcoin Ecosystem', 'imię i nazwisko, e-mail, dane projektu', 'rozpatrzenie zgłoszenia, przygotowanie i prowadzenie wpisu',
       'art. 6 ust. 1 lit. b i f RODO', 'Resend (usługa e-mail), Cloudflare (Turnstile, Workers)',
       'odrzucone: 12 miesięcy od decyzji; przyjęte: przez okres publikacji wpisu i 2 lata po jego usunięciu']),
 'hu': dict(
  pill='Ökoszisztéma',
  title='10. Jelentkezés a Bitcoin Ecosystem listájára',
  s2=('A Virtuse Verdict és a Virtuse CFO (9. szakasz) kivételével ez',
      'A Virtuse Verdict és a Virtuse CFO (9. szakasz), valamint a Bitcoin Ecosystem jelentkezési űrlapja (10. szakasz) kivételével ez'),
  sums=['Milyen adatokat kezelünk és miért', 'Hogyan kezeljük a jelentkezést', 'Mit teszünk közzé', 'Meddig őrizzük meg az adatokat', 'Az adatkezelés áttekintése'],
  p=["Ha egy projekt felvételét kéri a Virtuse Bitcoin Ecosystem listájára ({link}), az Ön által megadott adatokat kezeljük: az Ön nevét és e-mail-címét, a projekt nevét, weboldalát, leírását és kategóriáját, azokat az országokat, ahol a projekt működik, a licencadatokat és a tároló (repository) linkjét (ha megadja), azt, hogy érdekli-e szponzorált megjelenés, az üzenetét és az űrlap nyelvét. Ezeket kizárólag a jelentkezés elbírálására, az Önnel való kapcsolattartásra és – a projekt felvétele esetén – a bejegyzés elkészítésére és karbantartására használjuk. Jogalap: az Ön kérésére a szerződés esetleges megkötését megelőzően tett lépések (GDPR 6. cikk (1) bek. b) pont) és a válogatott címtár működtetéséhez fűződő jogos érdekünk (GDPR 6. cikk (1) bek. f) pont).",
     "A jelentkezést e-mailben, a Resend szolgáltatáson keresztül (e-mail-szolgáltatás, adatfeldolgozó) küldjük el csapatunknak, és nem tároljuk adatbázisban. Az űrlap spam elleni védelmére a Cloudflare Turnstile szolgáltatást használjuk, amely a böngészője technikai adatait és az IP-címét ellenőrzi (Cloudflare, adatfeldolgozó; adattovábbítás a 6. szakasz szerint). A visszaélések korlátozására egy órán át számoljuk az egy IP-címről érkező beküldéseket, az e-mail-címet pedig 24 órán át megőrizzük, hogy csak egy visszaigazolást küldjünk.",
     "Csak a projektre vonatkozó adatokat tesszük közzé (név, weboldal, leírás és saját rövid értékelésünk), az Ön nevét és e-mail-címét soha. A fizetett vagy kiemelt megjelenéseket mindig jelöljük.",
     "Megőrzés: az elutasított jelentkezéseket döntésünktől számított 12 hónap után töröljük. A felvett projekteknél a jelentkezést és a levelezést a bejegyzés közzétételének idejére, valamint az eltávolítását követő 2 évig őrizzük meg. A jelentkezést bármikor visszavonhatja, vagy kérheti adatai törlését a(z) {mail} címen (tárgy: „Adatvédelem”); jogait a 7. szakasz ismerteti."],
  row=['Jelentkezés a Bitcoin Ecosystem listájára', 'név, e-mail, projektadatok', 'a jelentkezés elbírálása, a bejegyzés elkészítése és karbantartása',
       'GDPR 6. cikk (1) bek. b) és f) pont', 'Resend (e-mail-szolgáltatás), Cloudflare (Turnstile, Workers)',
       'elutasított: a döntéstől számított 12 hónap; felvett: a bejegyzés közzétételének idejére és az eltávolítás után 2 évig']),
 'uk': dict(
  pill='Екосистема',
  title='10. Заявки до Bitcoin Ecosystem',
  s2=('Окрім Virtuse Verdict і Virtuse CFO (розділ 9), це',
      'Окрім Virtuse Verdict і Virtuse CFO (розділ 9) та форми заявки до Bitcoin Ecosystem (розділ 10), це'),
  sums=['Які дані ми обробляємо і навіщо', 'Як ми опрацьовуємо заявку', 'Що ми публікуємо', 'Як довго ми зберігаємо дані', 'Огляд обробки'],
  p=["Якщо ви подаєте заявку на включення проєкту до Virtuse Bitcoin Ecosystem ({link}), ми обробляємо дані, які ви вводите: ваше ім’я та email-адресу, назву, вебсайт, опис і категорію проєкту, країни, у яких він працює, дані про ліцензію та посилання на репозиторій (якщо ви їх зазначите), чи цікавить вас спонсороване розміщення, ваше повідомлення та мову форми. Ми використовуємо їх лише для розгляду заявки, спілкування з вами щодо неї та, якщо проєкт буде прийнято, для підготовки й підтримки запису. Правова підстава: дії на ваш запит до можливого укладення угоди (ст. 6(1)(b) GDPR) і наш законний інтерес у веденні кураторського каталогу (ст. 6(1)(f) GDPR).",
     "Заявка надсилається нашій команді електронною поштою через Resend (сервіс електронної пошти, обробник) і не зберігається в базі даних. Для захисту форми від спаму ми використовуємо Cloudflare Turnstile, який перевіряє технічні дані вашого браузера та вашу IP-адресу (Cloudflare, обробник; передача даних відповідно до розділу 6). Щоб обмежити зловживання, ми рахуємо надсилання з однієї IP-адреси протягом однієї години та пам’ятаємо email-адресу 24 години, щоб надіслати лише одне підтвердження.",
     "Ми публікуємо лише інформацію про проєкт (назву, вебсайт, опис і нашу коротку оцінку), але ніколи не ваше ім’я чи email-адресу. Платні або виділені розміщення завжди позначені.",
     "Зберігання: відхилені заявки ми видаляємо через 12 місяців після нашого рішення. Для прийнятих проєктів ми зберігаємо заявку та листування, доки запис опублікований, і 2 роки після його видалення. Ви можете будь-коли відкликати заявку або попросити видалити ваші дані, написавши на {mail} (тема «Захист персональних даних»); ваші права описані в розділі 7."],
  row=['Заявка до Bitcoin Ecosystem', 'ім’я, email, дані про проєкт', 'розгляд заявки, підготовка й підтримка запису',
       'ст. 6(1)(b) і (f) GDPR', 'Resend (сервіс електронної пошти), Cloudflare (Turnstile, Workers)',
       'відхилені: 12 місяців після рішення; прийняті: доки запис опублікований, і 2 роки після його видалення']),
 'ru': dict(
  pill='Экосистема',
  title='10. Заявки в Bitcoin Ecosystem',
  s2=('Помимо Virtuse Verdict и Virtuse CFO (раздел 9), это',
      'Помимо Virtuse Verdict и Virtuse CFO (раздел 9) и формы заявки в Bitcoin Ecosystem (раздел 10), это'),
  sums=['Какие данные мы обрабатываем и зачем', 'Как мы обрабатываем заявку', 'Что мы публикуем', 'Как долго мы храним данные', 'Обзор обработки'],
  p=["Если вы подаёте заявку на включение проекта в Virtuse Bitcoin Ecosystem ({link}), мы обрабатываем данные, которые вы вводите: ваше имя и email, название, сайт, описание и категорию проекта, страны, в которых он работает, сведения о лицензии и ссылку на репозиторий (если вы их укажете), интересует ли вас спонсорское размещение, ваше сообщение и язык формы. Мы используем их только для рассмотрения заявки, связи с вами по ней и, если проект будет принят, для подготовки и ведения записи. Правовое основание: действия по вашему запросу до возможного заключения соглашения (ст. 6(1)(b) GDPR) и наш законный интерес в ведении курируемого каталога (ст. 6(1)(f) GDPR).",
     "Заявка отправляется нашей команде по электронной почте через Resend (сервис электронной почты, обработчик) и не сохраняется в базе данных. Для защиты формы от спама мы используем Cloudflare Turnstile, который проверяет технические данные вашего браузера и ваш IP-адрес (Cloudflare, обработчик; передача данных согласно разделу 6). Чтобы ограничить злоупотребления, мы считаем отправки с одного IP-адреса в течение часа и запоминаем email на 24 часа, чтобы отправить только одно подтверждение.",
     "Мы публикуем только сведения о проекте (название, сайт, описание и нашу краткую оценку), но никогда не ваше имя или email. Платные или выделенные размещения всегда помечены.",
     "Хранение: отклонённые заявки мы удаляем через 12 месяцев после нашего решения. Для принятых проектов мы храним заявку и переписку, пока запись опубликована, и 2 года после её удаления. Вы можете в любой момент отозвать заявку или попросить удалить ваши данные, написав на {mail} (тема «Защита персональных данных»); ваши права описаны в разделе 7."],
  row=['Заявка в Bitcoin Ecosystem', 'имя, email, сведения о проекте', 'рассмотрение заявки, подготовка и ведение записи',
       'ст. 6(1)(b) и (f) GDPR', 'Resend (сервис электронной почты), Cloudflare (Turnstile, Workers)',
       'отклонённые: 12 месяцев после решения; принятые: пока запись опубликована, и 2 года после её удаления']),
}

TD = 'vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--border);'


def section(l, h):
    t = T[l]
    i = h.index('id="verdict-cfo"')
    thead = re.search(r'<thead>.*?</thead>', h[i:], re.S).group(0)   # the same column labels as section 9
    row = '<tr><th scope="row" style="%scolor:var(--text);font-weight:600;">%s</th>%s</tr>' % (
        TD, t['row'][0], ''.join('<td style="%s">%s</td>' % (TD, c) for c in t['row'][1:]))
    table = ('<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%%;min-width:820px;'
             'border-collapse:collapse;font-size:14px;line-height:1.5;">%s<tbody>%s</tbody></table></div>') % (thead, row)
    paras = [p.replace('{link}', link(l)).replace('{mail}', MAIL) for p in t['p']]
    out = ['\n<!-- ===== ECOSYSTEM ===== -->\n<section class="faq-section" id="ecosystem">\n  <div class="sec-label">%s</div>\n' % t['title']]
    for k, (s, body) in enumerate(zip(t['sums'], paras + [table])):
        out.append('\n  <details%s>\n    <summary>%s</summary>\n    <div class="faq-answer">%s</div>\n  </details>\n' % (
            ' open' if k == 0 else '', s, body))
    out.append('</section>\n')
    return ''.join(out)


def apply(l):
    p = os.path.join(SRC, l, 'privacy-policy.html')
    h = open(p, encoding='utf-8').read()
    if 'id="ecosystem"' in h:
        return False
    t = T[l]
    old, new = t['s2']
    assert h.count(old) == 1, (l, 'section 2 sentence')
    h = h.replace(old, new)
    m = re.search(r'(\n([ \t]*)<a href="#verdict-cfo">(&#9670;|◆) [^<]*</a>)', h)
    assert m, (l, 'pill')
    h = h[:m.end()] + '\n%s<a href="#ecosystem">%s %s</a>' % (m.group(2), m.group(3), t['pill']) + h[m.end():]
    i = h.index('id="verdict-cfo"')
    j = h.index('</section>', i) + len('</section>')
    h = h[:j] + '\n' + section(l, h) + h[j:]
    open(p, 'w', encoding='utf-8').write(h)
    return True


if __name__ == '__main__':
    for l in T:
        print(l, 'added' if apply(l) else 'already there')
