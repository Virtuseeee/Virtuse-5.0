/*
 * Virtuse Consultation — lead-qualification widget -> Calendly booking.
 *
 * Deliberately named "Consultation" (not "Concierge") to avoid
 * colliding with the unrelated, already-live Bitcoin Concierge feature
 * (concierge.html / concierge-launcher.js / concierge-assets/) -- see
 * CLAUDE.md's Layer 2 module notes. That module routes visitors to a
 * partner platform; this one qualifies a lead and hands them a
 * prefilled Calendly booking link for a real 15-minute call.
 *
 * Ported from the two standalone reference files
 * (virtuse-concierge-module.html / -en.html) -- questions, HIGH_RISK_TOPICS,
 * getSegment() branching and buildCalendlyUrl()'s a1/a2/UTM construction
 * are preserved exactly (only utm_medium changed from 'concierge_module'
 * to 'consultation_module' to match the rename -- flagged to the user).
 * The compliance disclaimer + conditional high-risk note render
 * unconditionally, unchanged, same as the reference.
 *
 * Perf: matches concierge-launcher.js's pattern -- this script is meant
 * to be loaded with `defer`; it does nothing until a trigger element is
 * clicked. Building the modal DOM happens lazily, on first open, so
 * including this script adds no extra render-blocking work to the host
 * page's load.
 *
 * CSS: injected here (not a separate stylesheet), every class prefixed
 * `vwc-` to avoid colliding with a host page's own styles.
 *
 * Usage: any element with `data-consultation-trigger` opens the modal
 * on click. Optional `data-consultation-lang="sk"` forces Slovak copy;
 * otherwise it falls back to <html lang="..">, then English. Copy exists
 * for en, sk, cs, de, fr, es, pl, hu, uk, ru; any other value falls back to English.
 *
 * Include as a deferred script near the end of <body>:
 *   <script src="consultation-widget.js" defer></script>
 */
(function () {
  'use strict';

  var CALENDLY_URL = 'https://calendly.com/virtuseexchange/15-min-consultation';

  // Indexes in the last (multi-select) question that require the extra
  // compliance risk-note. Same positions in both languages -- the
  // option order is identical, only the option text is translated.
  var HIGH_RISK_TOPICS = [0, 2, 3, 5]; // Buy/sell Bitcoin, Custody, Treasury, Bots

  var COPY = {
    en: {
      introEyebrow: 'Free consultation',
      introHeadline: "Find out what's relevant for you before you book a call.",
      introBody: 'A few quick questions help us prepare a consultation tailored to your situation — takes under 2 minutes.',
      startLabel: 'Start',
      finePrint: 'This is not investment advice. Virtuse does not hold or custody client assets.',
      continueLabel: 'Continue',
      skipLabel: 'Skip',
      backLabel: '← Back',
      resultHeadline: 'We have enough to prepare the call.',
      disclaimer: 'Virtuse Wealth Management a.s. does not provide investment advice and does not hold client assets. We facilitate affiliate partnerships — the allocation decision is always yours.',
      riskNote: "You picked topics (buying/selling Bitcoin, custody, treasury, automated bots) where it's important to know upfront: Virtuse doesn't perform or provide these services directly — we facilitate access to partner platforms that do. We'll walk you through exactly who does what on the call.",
      bookLabel: 'Book a 15-min consultation',
      restartLabel: 'Start over',
      closeLabel: 'Close',
      dialogLabel: 'Virtuse Consultation',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Goal',
          headline: "What's your main reason for being interested in crypto-assets?",
          options: [
            'Just want to learn / understand it',
            'Want to diversify beyond traditional assets',
            'Looking for long-term capital growth',
            'Interested in passive income (staking, etc.)'
          ]
        },
        {
          label: 'Experience',
          headline: 'What’s your current experience with crypto-assets?',
          options: [
            "None, I'm a complete beginner",
            "Basic — I own some but don't understand the details",
            'Advanced — I actively trade / invest',
            'Professional — I work in the industry'
          ]
        },
        {
          label: 'Capital',
          headline: "What's the approximate capital range you're considering?",
          options: [
            'Up to €5,000',
            '€5,000 – €50,000',
            '€50,000 – €250,000',
            'Over €250,000'
          ]
        },
        {
          label: 'Horizon',
          headline: 'What time horizon are you thinking about?',
          options: [
            'Less than 1 year',
            '1 – 3 years',
            '3 – 5 years',
            '5+ years'
          ]
        },
        {
          label: 'Involvement',
          headline: 'How would you like to be involved in decisions?',
          options: [
            'I want to manage it fully myself, I just need information',
            'I want support and explanations, but I make the decisions myself',
            'I want as hands-off a solution as possible'
          ]
        },
        {
          label: 'Interests',
          type: 'multi',
          headline: 'What topics would you like to cover on the call?',
          sublabel: 'You can pick more than one — or continue without selecting any.',
          options: [
            'Buy / sell Bitcoin',
            'Mining',
            'Custody / asset safekeeping',
            'Corporate treasury management',
            'Tax aspects',
            'Automated bots / algo-trading',
            'DCA (recurring investing)',
            'Other / general overview'
          ]
        }
      ],
      segments: {
        handsoff: { tag: 'Carefully prepared consultation', note: "We'll walk through exactly how our affiliate model works — Virtuse doesn't manage assets on your behalf." },
        intro: { tag: 'Intro / educational consultation', note: "We'll focus on the basics — no pressure to decide anything." },
        experienced: { tag: 'Consultation for experienced clients', note: "We'll go deeper into the categories of options available." },
        tailored: { tag: 'Tailored consultation', note: "We'll prepare context based on your answers." }
      }
    },
    sk: {
      introEyebrow: 'Bezplatná konzultácia',
      introHeadline: 'Zisti, čo je pre teba relevantné, skôr než si zarezervuješ hovor.',
      introBody: 'Pár krátkych otázok nám pomôže pripraviť konzultáciu presne na tvoju situáciu — trvá to necelé 2 minúty.',
      startLabel: 'Začať',
      finePrint: 'Toto nie je investičné poradenstvo. Virtuse nedrží ani nesprostredkúva klientske aktíva.',
      continueLabel: 'Pokračovať',
      skipLabel: 'Preskočiť',
      backLabel: '← Späť',
      resultHeadline: 'Máme dosť na to, aby sme hovor pripravili.',
      disclaimer: 'Virtuse Wealth Management a.s. neposkytuje investičné poradenstvo ani nedrží klientske aktíva. Sprostredkúvame affiliate partnerstvá — rozhodnutie o alokácii je vždy na tebe.',
      riskNote: 'Vybral(a) si témy (nákup/predaj Bitcoinu, custody, treasury, automatizované boty), pri ktorých je dôležité vopred vedieť: Virtuse tieto služby priamo nevykonáva ani nezabezpečuje — sprostredkúva prístup k partnerským platformám, ktoré ich poskytujú. Na hovore ti transparentne vysvetlíme, kto a ako to reálne robí.',
      bookLabel: 'Rezervovať 15-min konzultáciu',
      restartLabel: 'Vyplniť znova',
      closeLabel: 'Zavrieť',
      dialogLabel: 'Virtuse Konzultácia',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Cieľ',
          headline: 'Čo je tvojím hlavným dôvodom záujmu o krypto-aktíva?',
          options: [
            'Len sa chcem informovať / rozumieť tomu',
            'Chcem diverzifikovať mimo tradičných aktív',
            'Hľadám dlhodobý rast kapitálu',
            'Zaujíma ma pasívny príjem (staking a pod.)'
          ]
        },
        {
          label: 'Skúsenosť',
          headline: 'Aká je tvoja súčasná skúsenosť s krypto-aktívami?',
          options: [
            'Žiadna, som úplný začiatočník',
            'Základná — vlastním niečo, ale nerozumiem detailom',
            'Pokročilá — aktívne obchodujem / investujem',
            'Profesionálna — pracujem v odvetví'
          ]
        },
        {
          label: 'Kapitál',
          headline: 'Aký je približný rozsah kapitálu, ktorý zvažuješ alokovať?',
          options: [
            'Do 5 000 €',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            'Nad 250 000 €'
          ]
        },
        {
          label: 'Horizont',
          headline: 'Na aký časový horizont uvažuješ?',
          options: [
            'Menej ako 1 rok',
            '1 – 3 roky',
            '3 – 5 rokov',
            '5+ rokov'
          ]
        },
        {
          label: 'Zapojenie',
          headline: 'Ako by si chcel byť zapojený do rozhodovania?',
          options: [
            'Chcem si to riadiť úplne sám, len potrebujem informácie',
            'Chcem podporu a vysvetlenie možností, rozhodnutia robím sám',
            'Chcem čo najviac „hands-off“ riešenie'
          ]
        },
        {
          label: 'Záujmy',
          type: 'multi',
          headline: 'Aké témy by si chcel na hovore prediskutovať?',
          sublabel: 'Môžeš vybrať viac možností — alebo pokračuj bez výberu.',
          options: [
            'Nákup / predaj Bitcoinu',
            'Mining',
            'Custody / úschova aktív',
            'Treasury manažment pre firmu',
            'Daňové aspekty',
            'Automatizované boty / algo-obchodovanie',
            'DCA (pravidelné investovanie)',
            'Iné / všeobecný prehľad'
          ]
        }
      ],
      // English wording, exactly matching Calendly's custom-question
      // checkbox option text -- required so a1 maps correctly into the
      // booking regardless of which language answered the quiz.
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Pozorne pripravená konzultácia', note: 'Prediskutujeme, ako presne funguje náš affiliate model — bez správy aktív z našej strany.' },
        intro: { tag: 'Úvodná / vzdelávacia konzultácia', note: 'Zameriame sa na základy — žiadny tlak na rozhodnutie.' },
        experienced: { tag: 'Konzultácia pre skúsenejších', note: 'Prejdeme si kategórie možností do väčšej hĺbky.' },
        tailored: { tag: 'Konzultácia na mieru', note: 'Pripravíme si kontext na základe tvojich odpovedí.' }
      }
    },
    cs: {
      introEyebrow: 'Bezplatná konzultace',
      introHeadline: 'Zjisti, co je pro tebe relevantní, než si zarezervuješ hovor.',
      introBody: 'Pár krátkých otázek nám pomůže připravit konzultaci přesně na tvoji situaci — trvá to necelé 2 minuty.',
      startLabel: 'Začít',
      finePrint: 'Toto není investiční poradenství. Virtuse nedrží ani nezprostředkovává klientská aktiva.',
      continueLabel: 'Pokračovat',
      skipLabel: 'Přeskočit',
      backLabel: '← Zpět',
      resultHeadline: 'Máme dost na to, abychom hovor připravili.',
      disclaimer: 'Virtuse Wealth Management a.s. neposkytuje investiční poradenství ani nedrží klientská aktiva. Zprostředkováváme affiliate partnerství — rozhodnutí o alokaci je vždy na tobě.',
      riskNote: 'Vybral(a) sis témata (nákup/prodej Bitcoinu, custody, treasury, automatizovaní boti), u kterých je důležité předem vědět: Virtuse tyto služby přímo neprovádí ani nezajišťuje — zprostředkováváme přístup k partnerským platformám, které je poskytují. Na hovoru ti transparentně vysvětlíme, kdo a jak to reálně dělá.',
      bookLabel: 'Rezervovat 15min konzultaci',
      restartLabel: 'Vyplnit znovu',
      closeLabel: 'Zavřít',
      dialogLabel: 'Virtuse Konzultace',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Cíl',
          headline: 'Co je tvým hlavním důvodem zájmu o krypto-aktiva?',
          options: [
            'Jen se chci informovat / rozumět tomu',
            'Chci diverzifikovat mimo tradiční aktiva',
            'Hledám dlouhodobý růst kapitálu',
            'Zajímá mě pasivní příjem (staking a pod.)'
          ]
        },
        {
          label: 'Zkušenost',
          headline: 'Jaká je tvoje současná zkušenost s krypto-aktivy?',
          options: [
            'Žádná, jsem úplný začátečník',
            'Základní — vlastním něco, ale nerozumím detailům',
            'Pokročilá — aktivně obchoduji / investuji',
            'Profesionální — pracuji v odvětví'
          ]
        },
        {
          label: 'Kapitál',
          headline: 'Jaký je přibližný rozsah kapitálu, který zvažuješ alokovat?',
          options: [
            'Do 5 000 €',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            'Nad 250 000 €'
          ]
        },
        {
          label: 'Horizont',
          headline: 'Na jaký časový horizont uvažuješ?',
          options: [
            'Méně než 1 rok',
            '1 – 3 roky',
            '3 – 5 let',
            '5+ let'
          ]
        },
        {
          label: 'Zapojení',
          headline: 'Jak bys chtěl(a) být zapojen(a) do rozhodování?',
          options: [
            'Chci si to řídit úplně sám/sama, jen potřebuji informace',
            'Chci podporu a vysvětlení možností, rozhodnutí dělám sám/sama',
            'Chci co nejvíc „hands-off" řešení'
          ]
        },
        {
          label: 'Zájmy',
          type: 'multi',
          headline: 'Jaká témata bys chtěl(a) na hovoru probrat?',
          sublabel: 'Můžeš vybrat víc možností — nebo pokračuj bez výběru.',
          options: [
            'Nákup / prodej Bitcoinu',
            'Mining',
            'Custody / úschova aktiv',
            'Treasury management pro firmu',
            'Daňové aspekty',
            'Automatizovaní boti / algo-obchodování',
            'DCA (pravidelné investování)',
            'Jiné / všeobecný přehled'
          ]
        }
      ],
      // English wording, exactly matching Calendly's custom-question
      // checkbox option text -- required so a1 maps correctly into the
      // booking regardless of which language answered the quiz.
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Pečlivě připravená konzultace', note: 'Probereme, jak přesně funguje náš affiliate model — bez správy aktiv z naší strany.' },
        intro: { tag: 'Úvodní / vzdělávací konzultace', note: 'Zaměříme se na základy — žádný tlak na rozhodnutí.' },
        experienced: { tag: 'Konzultace pro zkušenější', note: 'Projdeme si kategorie možností do větší hloubky.' },
        tailored: { tag: 'Konzultace na míru', note: 'Připravíme si kontext na základě tvých odpovědí.' }
      }
    },
    de: {
      introEyebrow: 'Kostenlose Beratung',
      introHeadline: 'Finden Sie heraus, was für Sie relevant ist, bevor Sie ein Gespräch buchen.',
      introBody: 'Ein paar kurze Fragen helfen uns, eine auf Ihre Situation zugeschnittene Beratung vorzubereiten — dauert weniger als 2 Minuten.',
      startLabel: 'Starten',
      finePrint: 'Dies ist keine Anlageberatung. Virtuse hält und verwahrt keine Kundenvermögenswerte.',
      continueLabel: 'Weiter',
      skipLabel: 'Überspringen',
      backLabel: '← Zurück',
      resultHeadline: 'Wir haben genug Informationen, um das Gespräch vorzubereiten.',
      disclaimer: 'Virtuse Wealth Management a.s. erbringt keine Anlageberatung und hält keine Kundenvermögenswerte. Wir vermitteln Affiliate-Partnerschaften — die Allokationsentscheidung liegt immer bei Ihnen.',
      riskNote: 'Sie haben Themen gewählt (Kauf/Verkauf von Bitcoin, Verwahrung, Treasury, automatisierte Bots), bei denen Sie vorab Folgendes wissen sollten: Virtuse erbringt oder bietet diese Leistungen nicht direkt an — wir vermitteln den Zugang zu Partnerplattformen, die dies tun. Im Gespräch erklären wir Ihnen genau, wer was übernimmt.',
      bookLabel: '15-minütige Beratung buchen',
      restartLabel: 'Neu beginnen',
      closeLabel: 'Schließen',
      dialogLabel: 'Virtuse Beratung',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Ziel',
          headline: 'Was ist Ihr Hauptgrund für Ihr Interesse an Krypto-Assets?',
          options: [
            'Ich möchte mich einfach informieren / es verstehen',
            'Ich möchte über traditionelle Anlagen hinaus diversifizieren',
            'Ich suche langfristiges Kapitalwachstum',
            'Ich interessiere mich für passives Einkommen (Staking usw.)'
          ]
        },
        {
          label: 'Erfahrung',
          headline: 'Welche Erfahrung haben Sie derzeit mit Krypto-Assets?',
          options: [
            'Keine, ich bin absoluter Anfänger',
            'Grundlegend — ich besitze einige, verstehe aber die Details nicht',
            'Fortgeschritten — ich handle / investiere aktiv',
            'Professionell — ich arbeite in der Branche'
          ]
        },
        {
          label: 'Kapital',
          headline: 'In welcher Größenordnung bewegt sich das Kapital, das Sie in Betracht ziehen?',
          options: [
            'Bis 5.000 €',
            '5.000 – 50.000 €',
            '50.000 – 250.000 €',
            'Über 250.000 €'
          ]
        },
        {
          label: 'Horizont',
          headline: 'An welchen Zeithorizont denken Sie?',
          options: [
            'Weniger als 1 Jahr',
            '1 – 3 Jahre',
            '3 – 5 Jahre',
            '5+ Jahre'
          ]
        },
        {
          label: 'Beteiligung',
          headline: 'Wie möchten Sie in Entscheidungen eingebunden sein?',
          options: [
            'Ich möchte alles selbst verwalten, ich brauche nur Informationen',
            'Ich möchte Unterstützung und Erklärungen, treffe die Entscheidungen aber selbst',
            'Ich möchte eine Lösung mit möglichst wenig eigenem Aufwand'
          ]
        },
        {
          label: 'Interessen',
          type: 'multi',
          headline: 'Welche Themen möchten Sie im Gespräch behandeln?',
          sublabel: 'Sie können mehrere auswählen — oder ohne Auswahl fortfahren.',
          options: [
            'Bitcoin kaufen / verkaufen',
            'Mining',
            'Custody / Verwahrung von Vermögenswerten',
            'Treasury-Management für Unternehmen',
            'Steuerliche Aspekte',
            'Automatisierte Bots / Algo-Trading',
            'DCA (regelmäßiges Investieren)',
            'Sonstiges / allgemeiner Überblick'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Sorgfältig vorbereitete Beratung', note: 'Wir erklären Ihnen genau, wie unser Affiliate-Modell funktioniert — Virtuse verwaltet keine Vermögenswerte in Ihrem Namen.' },
        intro: { tag: 'Einführende / informative Beratung', note: 'Wir konzentrieren uns auf die Grundlagen — ohne Entscheidungsdruck.' },
        experienced: { tag: 'Beratung für erfahrene Kunden', note: 'Wir gehen tiefer auf die verfügbaren Kategorien von Optionen ein.' },
        tailored: { tag: 'Maßgeschneiderte Beratung', note: 'Wir bereiten den Kontext auf Basis Ihrer Antworten vor.' }
      }
    },
    fr: {
      introEyebrow: 'Consultation gratuite',
      introHeadline: 'Découvrez ce qui est pertinent pour vous avant de réserver un appel.',
      introBody: 'Quelques questions rapides nous aident à préparer une consultation adaptée à votre situation — moins de 2 minutes.',
      startLabel: 'Commencer',
      finePrint: 'Ceci n’est pas un conseil en investissement. Virtuse ne détient ni ne conserve les actifs de ses clients.',
      continueLabel: 'Continuer',
      skipLabel: 'Passer',
      backLabel: '← Retour',
      resultHeadline: 'Nous avons suffisamment d’informations pour préparer l’appel.',
      disclaimer: 'Virtuse Wealth Management a.s. ne fournit pas de conseil en investissement et ne détient pas les actifs de ses clients. Nous facilitons des partenariats d’affiliation — la décision d’allocation vous appartient toujours.',
      riskNote: 'Vous avez choisi des sujets (achat/vente de Bitcoin, conservation, trésorerie, bots automatisés) pour lesquels il est important de savoir dès le départ : Virtuse n’exécute ni ne fournit directement ces services — nous facilitons l’accès à des plateformes partenaires qui les proposent. Lors de l’appel, nous vous expliquerons précisément qui fait quoi.',
      bookLabel: 'Réserver une consultation de 15 min',
      restartLabel: 'Recommencer',
      closeLabel: 'Fermer',
      dialogLabel: 'Consultation Virtuse',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Objectif',
          headline: 'Quelle est la principale raison de votre intérêt pour les crypto-actifs ?',
          options: [
            'Je souhaite simplement m’informer / comprendre',
            'Je souhaite diversifier au-delà des actifs traditionnels',
            'Je recherche une croissance du capital à long terme',
            'Je m’intéresse aux revenus passifs (staking, etc.)'
          ]
        },
        {
          label: 'Expérience',
          headline: 'Quelle est votre expérience actuelle avec les crypto-actifs ?',
          options: [
            'Aucune, je suis totalement débutant(e)',
            'De base — j’en possède, mais je ne maîtrise pas les détails',
            'Avancée — je trade / j’investis activement',
            'Professionnelle — je travaille dans le secteur'
          ]
        },
        {
          label: 'Capital',
          headline: 'Quel montant approximatif envisagez-vous ?',
          options: [
            'Jusqu’à 5 000 €',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            'Plus de 250 000 €'
          ]
        },
        {
          label: 'Horizon',
          headline: 'Quel horizon de placement envisagez-vous ?',
          options: [
            'Moins d’1 an',
            '1 – 3 ans',
            '3 – 5 ans',
            '5 ans et plus'
          ]
        },
        {
          label: 'Implication',
          headline: 'Comment souhaitez-vous être impliqué(e) dans les décisions ?',
          options: [
            'Je veux tout gérer moi-même, j’ai seulement besoin d’informations',
            'Je veux un accompagnement et des explications, mais je prends les décisions moi-même',
            'Je veux une solution aussi « clé en main » que possible'
          ]
        },
        {
          label: 'Intérêts',
          type: 'multi',
          headline: 'Quels sujets souhaitez-vous aborder lors de l’appel ?',
          sublabel: 'Vous pouvez en choisir plusieurs — ou continuer sans sélection.',
          options: [
            'Acheter / vendre du Bitcoin',
            'Minage',
            'Custody / conservation des actifs',
            'Gestion de trésorerie d’entreprise',
            'Aspects fiscaux',
            'Bots automatisés / trading algorithmique',
            'DCA (investissement programmé)',
            'Autre / vue d’ensemble'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Consultation soigneusement préparée', note: 'Nous vous expliquerons précisément le fonctionnement de notre modèle d’affiliation — Virtuse ne gère pas d’actifs pour votre compte.' },
        intro: { tag: 'Consultation d’introduction / pédagogique', note: 'Nous nous concentrerons sur les bases — aucune pression pour décider quoi que ce soit.' },
        experienced: { tag: 'Consultation pour clients expérimentés', note: 'Nous approfondirons les catégories d’options disponibles.' },
        tailored: { tag: 'Consultation sur mesure', note: 'Nous préparerons le contexte à partir de vos réponses.' }
      }
    },
    es: {
      introEyebrow: 'Consulta gratuita',
      introHeadline: 'Descubra qué es relevante para usted antes de reservar una llamada.',
      introBody: 'Unas pocas preguntas rápidas nos ayudan a preparar una consulta adaptada a su situación — lleva menos de 2 minutos.',
      startLabel: 'Empezar',
      finePrint: 'Esto no es asesoramiento de inversión. Virtuse no mantiene ni custodia activos de clientes.',
      continueLabel: 'Continuar',
      skipLabel: 'Omitir',
      backLabel: '← Atrás',
      resultHeadline: 'Tenemos suficiente información para preparar la llamada.',
      disclaimer: 'Virtuse Wealth Management a.s. no presta asesoramiento de inversión y no mantiene activos de clientes. Facilitamos alianzas de afiliación — la decisión de asignación siempre es suya.',
      riskNote: 'Ha elegido temas (compra/venta de Bitcoin, custodia, tesorería, bots automatizados) sobre los que es importante saber de antemano: Virtuse no realiza ni presta estos servicios directamente — facilitamos el acceso a plataformas asociadas que sí lo hacen. En la llamada le explicaremos con exactitud quién hace qué.',
      bookLabel: 'Reservar una consulta de 15 min',
      restartLabel: 'Empezar de nuevo',
      closeLabel: 'Cerrar',
      dialogLabel: 'Consulta Virtuse',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Objetivo',
          headline: '¿Cuál es el principal motivo de su interés en los criptoactivos?',
          options: [
            'Solo quiero informarme / entenderlo',
            'Quiero diversificar más allá de los activos tradicionales',
            'Busco crecimiento del capital a largo plazo',
            'Me interesan los ingresos pasivos (staking, etc.)'
          ]
        },
        {
          label: 'Experiencia',
          headline: '¿Cuál es su experiencia actual con los criptoactivos?',
          options: [
            'Ninguna, soy principiante total',
            'Básica — tengo algunos, pero no entiendo los detalles',
            'Avanzada — opero / invierto activamente',
            'Profesional — trabajo en el sector'
          ]
        },
        {
          label: 'Capital',
          headline: '¿Cuál es el rango aproximado de capital que está considerando?',
          options: [
            'Hasta 5000 €',
            '5000 – 50 000 €',
            '50 000 – 250 000 €',
            'Más de 250 000 €'
          ]
        },
        {
          label: 'Horizonte',
          headline: '¿En qué horizonte temporal está pensando?',
          options: [
            'Menos de 1 año',
            '1 – 3 años',
            '3 – 5 años',
            '5+ años'
          ]
        },
        {
          label: 'Implicación',
          headline: '¿Cómo le gustaría participar en las decisiones?',
          options: [
            'Quiero gestionarlo todo yo mismo, solo necesito información',
            'Quiero apoyo y explicaciones, pero tomo las decisiones yo mismo',
            'Quiero una solución que requiera la menor implicación posible por mi parte'
          ]
        },
        {
          label: 'Intereses',
          type: 'multi',
          headline: '¿Qué temas le gustaría tratar en la llamada?',
          sublabel: 'Puede elegir más de uno — o continuar sin seleccionar ninguno.',
          options: [
            'Comprar / vender Bitcoin',
            'Minería',
            'Custodia / salvaguarda de activos',
            'Gestión de tesorería corporativa',
            'Aspectos fiscales',
            'Bots automatizados / trading algorítmico',
            'DCA (inversión periódica)',
            'Otro / visión general'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Consulta cuidadosamente preparada', note: 'Le explicaremos con exactitud cómo funciona nuestro modelo de afiliación — Virtuse no gestiona activos en su nombre.' },
        intro: { tag: 'Consulta introductoria / formativa', note: 'Nos centraremos en lo básico — sin ninguna presión para decidir nada.' },
        experienced: { tag: 'Consulta para clientes con experiencia', note: 'Profundizaremos en las categorías de opciones disponibles.' },
        tailored: { tag: 'Consulta a medida', note: 'Prepararemos el contexto en función de sus respuestas.' }
      }
    },
    pl: {
      introEyebrow: 'Bezpłatna konsultacja',
      introHeadline: 'Zanim zarezerwują Państwo rozmowę, sprawdźmy, co jest dla Państwa istotne.',
      introBody: 'Kilka krótkich pytań pomoże nam przygotować konsultację dopasowaną do Państwa sytuacji — zajmie to mniej niż 2 minuty.',
      startLabel: 'Rozpocznij',
      finePrint: 'To nie jest doradztwo inwestycyjne. Virtuse nie przechowuje ani nie sprawuje pieczy nad aktywami klientów.',
      continueLabel: 'Dalej',
      skipLabel: 'Pomiń',
      backLabel: '← Wstecz',
      resultHeadline: 'Mamy wystarczająco dużo informacji, aby przygotować rozmowę.',
      disclaimer: 'Virtuse Wealth Management a.s. nie świadczy doradztwa inwestycyjnego i nie przechowuje aktywów klientów. Pośredniczymy w partnerstwach afiliacyjnych — decyzja o alokacji zawsze należy do Państwa.',
      riskNote: 'Wybrali Państwo tematy (kupno/sprzedaż Bitcoina, przechowywanie, treasury, automatyczne boty), w przypadku których warto od razu wiedzieć: Virtuse nie wykonuje ani nie świadczy tych usług bezpośrednio — ułatwiamy dostęp do platform partnerskich, które je świadczą. Podczas rozmowy dokładnie wyjaśnimy, kto za co odpowiada.',
      bookLabel: 'Zarezerwuj 15-minutową konsultację',
      restartLabel: 'Zacznij od nowa',
      closeLabel: 'Zamknij',
      dialogLabel: 'Konsultacja Virtuse',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Cel',
          headline: 'Jaki jest główny powód Państwa zainteresowania kryptoaktywami?',
          options: [
            'Chcę się tylko dowiedzieć / zrozumieć temat',
            'Chcę zdywersyfikować portfel poza tradycyjne aktywa',
            'Szukam długoterminowego wzrostu kapitału',
            'Interesuje mnie dochód pasywny (staking itp.)'
          ]
        },
        {
          label: 'Doświadczenie',
          headline: 'Jakie jest Państwa obecne doświadczenie z kryptoaktywami?',
          options: [
            'Żadne, jestem zupełnie początkujący/a',
            'Podstawowe — posiadam trochę, ale nie znam szczegółów',
            'Zaawansowane — aktywnie handluję / inwestuję',
            'Profesjonalne — pracuję w branży'
          ]
        },
        {
          label: 'Kapitał',
          headline: 'Jaki jest przybliżony zakres kapitału, który Państwo rozważają?',
          options: [
            'Do 5 000 €',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            'Powyżej 250 000 €'
          ]
        },
        {
          label: 'Horyzont',
          headline: 'O jakim horyzoncie czasowym Państwo myślą?',
          options: [
            'Mniej niż 1 rok',
            '1 – 3 lata',
            '3 – 5 lat',
            '5+ lat'
          ]
        },
        {
          label: 'Zaangażowanie',
          headline: 'W jakim stopniu chcą Państwo uczestniczyć w podejmowaniu decyzji?',
          options: [
            'Chcę zarządzać wszystkim samodzielnie, potrzebuję tylko informacji',
            'Chcę wsparcia i wyjaśnień, ale decyzje podejmuję sam/a',
            'Chcę rozwiązania wymagającego jak najmniej mojego zaangażowania'
          ]
        },
        {
          label: 'Zainteresowania',
          type: 'multi',
          headline: 'Jakie tematy chcieliby Państwo omówić podczas rozmowy?',
          sublabel: 'Można wybrać więcej niż jedną opcję — lub kontynuować bez wyboru.',
          options: [
            'Kupno / sprzedaż Bitcoina',
            'Mining',
            'Custody / przechowywanie aktywów',
            'Zarządzanie treasury w firmie',
            'Aspekty podatkowe',
            'Automatyczne boty / handel algorytmiczny',
            'DCA (regularne inwestowanie)',
            'Inne / ogólny przegląd'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Starannie przygotowana konsultacja', note: 'Dokładnie omówimy, jak działa nasz model afiliacyjny — Virtuse nie zarządza aktywami w Państwa imieniu.' },
        intro: { tag: 'Konsultacja wprowadzająca / edukacyjna', note: 'Skupimy się na podstawach — bez presji na podejmowanie decyzji.' },
        experienced: { tag: 'Konsultacja dla doświadczonych klientów', note: 'Bardziej szczegółowo omówimy dostępne kategorie możliwości.' },
        tailored: { tag: 'Konsultacja szyta na miarę', note: 'Przygotujemy kontekst na podstawie Państwa odpowiedzi.' }
      }
    },
    hu: {
      introEyebrow: 'Ingyenes konzultáció',
      introHeadline: 'Tudja meg, mi releváns az Ön számára, mielőtt hívást foglal.',
      introBody: 'Néhány gyors kérdés segít, hogy az Ön helyzetére szabott konzultációt készítsünk elő — kevesebb mint 2 perc.',
      startLabel: 'Kezdés',
      finePrint: 'Ez nem befektetési tanácsadás. A Virtuse nem tart és nem őriz ügyfélvagyont.',
      continueLabel: 'Tovább',
      skipLabel: 'Kihagyás',
      backLabel: '← Vissza',
      resultHeadline: 'Elegendő információnk van a hívás előkészítéséhez.',
      disclaimer: 'A Virtuse Wealth Management a.s. nem nyújt befektetési tanácsadást, és nem tart ügyfélvagyont. Affiliate partnerségeket közvetítünk — az allokációról mindig Ön dönt.',
      riskNote: 'Olyan témákat választott (Bitcoin vétele/eladása, letétkezelés, treasury, automatizált botok), amelyeknél fontos előre tudni: a Virtuse ezeket a szolgáltatásokat nem közvetlenül végzi vagy nyújtja — a hozzáférést közvetítjük olyan partnerplatformokhoz, amelyek nyújtják őket. A hívás során pontosan elmagyarázzuk, ki mit végez.',
      bookLabel: '15 perces konzultáció foglalása',
      restartLabel: 'Újrakezdés',
      closeLabel: 'Bezárás',
      dialogLabel: 'Virtuse konzultáció',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Cél',
          headline: 'Mi a fő oka annak, hogy érdeklődik a kriptoeszközök iránt?',
          options: [
            'Csak tájékozódni / megérteni szeretném',
            'Szeretnék a hagyományos eszközökön túl diverzifikálni',
            'Hosszú távú tőkenövekedést keresek',
            'Érdekel a passzív jövedelem (staking stb.)'
          ]
        },
        {
          label: 'Tapasztalat',
          headline: 'Milyen tapasztalata van jelenleg a kriptoeszközökkel?',
          options: [
            'Nincs, teljesen kezdő vagyok',
            'Alapszintű — van némi kriptóm, de a részleteket nem értem',
            'Haladó — aktívan kereskedem / fektetek be',
            'Professzionális — az iparágban dolgozom'
          ]
        },
        {
          label: 'Tőke',
          headline: 'Körülbelül mekkora tőkét fontolgat?',
          options: [
            '5 000 €-ig',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            '250 000 € felett'
          ]
        },
        {
          label: 'Időtáv',
          headline: 'Milyen időtávban gondolkodik?',
          options: [
            'Kevesebb mint 1 év',
            '1 – 3 év',
            '3 – 5 év',
            '5+ év'
          ]
        },
        {
          label: 'Részvétel',
          headline: 'Mennyire szeretne részt venni a döntésekben?',
          options: [
            'Teljesen magam szeretném kezelni, csak információra van szükségem',
            'Támogatást és magyarázatot szeretnék, de a döntéseket én hozom meg',
            'A lehető legkevesebb saját részvételt igénylő megoldást szeretnék'
          ]
        },
        {
          label: 'Érdeklődés',
          type: 'multi',
          headline: 'Milyen témákat szeretne megbeszélni a hívás során?',
          sublabel: 'Több témát is választhat — vagy továbbléphet választás nélkül.',
          options: [
            'Bitcoin vétele / eladása',
            'Bányászat',
            'Custody / eszközök megőrzése',
            'Vállalati treasury-kezelés',
            'Adózási kérdések',
            'Automatizált botok / algoritmikus kereskedés',
            'DCA (rendszeres befektetés)',
            'Egyéb / általános áttekintés'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Gondosan előkészített konzultáció', note: 'Pontosan bemutatjuk, hogyan működik az affiliate modellünk — a Virtuse nem kezel vagyont az Ön nevében.' },
        intro: { tag: 'Bevezető / oktató jellegű konzultáció', note: 'Az alapokra koncentrálunk — semmilyen döntési kényszer nélkül.' },
        experienced: { tag: 'Konzultáció tapasztalt ügyfeleknek', note: 'Mélyebben áttekintjük az elérhető lehetőségek kategóriáit.' },
        tailored: { tag: 'Személyre szabott konzultáció', note: 'A válaszai alapján készítjük elő a kontextust.' }
      }
    },
    uk: {
      introEyebrow: 'Безкоштовна консультація',
      introHeadline: 'Дізнайтеся, що актуально саме для вас, перш ніж бронювати дзвінок.',
      introBody: 'Кілька коротких запитань допоможуть нам підготувати консультацію з урахуванням вашої ситуації — це займе менше 2 хвилин.',
      startLabel: 'Почати',
      finePrint: 'Це не є інвестиційною порадою. Virtuse не тримає і не зберігає активи клієнтів.',
      continueLabel: 'Продовжити',
      skipLabel: 'Пропустити',
      backLabel: '← Назад',
      resultHeadline: 'У нас достатньо інформації, щоб підготувати дзвінок.',
      disclaimer: 'Virtuse Wealth Management a.s. не надає інвестиційних порад і не тримає активи клієнтів. Ми сприяємо афілійованим партнерствам — рішення щодо розподілу активів завжди за вами.',
      riskNote: 'Ви обрали теми (купівля/продаж Bitcoin, зберігання, казначейство, автоматизовані боти), щодо яких важливо знати заздалегідь: Virtuse не виконує і не надає ці послуги безпосередньо — ми сприяємо доступу до партнерських платформ, які їх надають. Під час дзвінка ми детально пояснимо, хто і що робить.',
      bookLabel: 'Забронювати 15-хвилинну консультацію',
      restartLabel: 'Почати спочатку',
      closeLabel: 'Закрити',
      dialogLabel: 'Консультація Virtuse',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Мета',
          headline: 'Яка основна причина вашого інтересу до криптоактивів?',
          options: [
            'Просто хочу дізнатися / розібратися',
            'Хочу диверсифікувати вкладення поза традиційними активами',
            'Шукаю довгострокове зростання капіталу',
            'Цікавить пасивний дохід (стейкінг тощо)'
          ]
        },
        {
          label: 'Досвід',
          headline: 'Який ваш поточний досвід роботи з криптоактивами?',
          options: [
            'Жодного, я зовсім новачок',
            'Базовий — маю певні активи, але не розуміюся на деталях',
            'Просунутий — активно торгую / інвестую',
            'Професійний — працюю в галузі'
          ]
        },
        {
          label: 'Капітал',
          headline: 'Який приблизний обсяг капіталу ви розглядаєте?',
          options: [
            'До 5 000 €',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            'Понад 250 000 €'
          ]
        },
        {
          label: 'Горизонт',
          headline: 'Про який часовий горизонт ви думаєте?',
          options: [
            'Менше 1 року',
            '1 – 3 роки',
            '3 – 5 років',
            '5+ років'
          ]
        },
        {
          label: 'Участь',
          headline: 'Наскільки ви хочете брати участь у прийнятті рішень?',
          options: [
            'Хочу керувати всім самостійно, мені потрібна лише інформація',
            'Хочу підтримки та пояснень, але рішення ухвалюю сам(а)',
            'Хочу рішення, яке потребує якомога менше моєї участі'
          ]
        },
        {
          label: 'Інтереси',
          type: 'multi',
          headline: 'Які теми ви хотіли б обговорити під час дзвінка?',
          sublabel: 'Можна обрати кілька — або продовжити без вибору.',
          options: [
            'Купівля / продаж Bitcoin',
            'Майнінг',
            'Custody / зберігання активів',
            'Управління корпоративним казначейством',
            'Податкові аспекти',
            'Автоматизовані боти / алгоритмічна торгівля',
            'DCA (регулярне інвестування)',
            'Інше / загальний огляд'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Ретельно підготовлена консультація', note: 'Ми детально пояснимо, як працює наша афілійована модель — Virtuse не управляє активами від вашого імені.' },
        intro: { tag: 'Вступна / освітня консультація', note: 'Зосередимося на основах — без жодного тиску щодо рішень.' },
        experienced: { tag: 'Консультація для досвідчених клієнтів', note: 'Глибше розглянемо доступні категорії можливостей.' },
        tailored: { tag: 'Індивідуальна консультація', note: 'Підготуємо контекст на основі ваших відповідей.' }
      }
    },
    ru: {
      introEyebrow: 'Бесплатная консультация',
      introHeadline: 'Узнайте, что актуально именно для вас, прежде чем бронировать звонок.',
      introBody: 'Несколько коротких вопросов помогут нам подготовить консультацию с учётом вашей ситуации — это займёт меньше 2 минут.',
      startLabel: 'Начать',
      finePrint: 'Это не является инвестиционной консультацией. Virtuse не держит и не хранит активы клиентов.',
      continueLabel: 'Продолжить',
      skipLabel: 'Пропустить',
      backLabel: '← Назад',
      resultHeadline: 'У нас достаточно информации, чтобы подготовить звонок.',
      disclaimer: 'Virtuse Wealth Management a.s. не предоставляет инвестиционных консультаций и не держит активы клиентов. Мы содействуем партнёрствам по аффилиатной модели — решение о распределении активов всегда за вами.',
      riskNote: 'Вы выбрали темы (покупка/продажа Bitcoin, хранение, казначейство, автоматизированные боты), в отношении которых важно знать заранее: Virtuse не выполняет и не предоставляет эти услуги напрямую — мы содействуем доступу к партнёрским платформам, которые их оказывают. Во время звонка мы подробно объясним, кто и что делает.',
      bookLabel: 'Забронировать 15-минутную консультацию',
      restartLabel: 'Начать заново',
      closeLabel: 'Закрыть',
      dialogLabel: 'Консультация Virtuse',
      stepOf: function (n, total, label) { return n + ' / ' + total + ' — ' + label; },
      questions: [
        {
          label: 'Цель',
          headline: 'Какова основная причина вашего интереса к криптоактивам?',
          options: [
            'Просто хочу узнать / разобраться',
            'Хочу диверсифицировать вложения за пределы традиционных активов',
            'Ищу долгосрочный рост капитала',
            'Интересует пассивный доход (стейкинг и т. п.)'
          ]
        },
        {
          label: 'Опыт',
          headline: 'Каков ваш текущий опыт работы с криптоактивами?',
          options: [
            'Никакого, я полный новичок',
            'Базовый — у меня есть немного, но я не разбираюсь в деталях',
            'Продвинутый — активно торгую / инвестирую',
            'Профессиональный — работаю в отрасли'
          ]
        },
        {
          label: 'Капитал',
          headline: 'Какой примерный объём капитала вы рассматриваете?',
          options: [
            'До 5 000 €',
            '5 000 – 50 000 €',
            '50 000 – 250 000 €',
            'Свыше 250 000 €'
          ]
        },
        {
          label: 'Горизонт',
          headline: 'На какой временной горизонт вы ориентируетесь?',
          options: [
            'Менее 1 года',
            '1 – 3 года',
            '3 – 5 лет',
            '5+ лет'
          ]
        },
        {
          label: 'Участие',
          headline: 'Насколько вы хотите участвовать в принятии решений?',
          options: [
            'Хочу управлять всем самостоятельно, мне нужна только информация',
            'Хочу поддержки и объяснений, но решения принимаю сам(а)',
            'Хочу решение, требующее как можно меньше моего участия'
          ]
        },
        {
          label: 'Интересы',
          type: 'multi',
          headline: 'Какие темы вы хотели бы обсудить во время звонка?',
          sublabel: 'Можно выбрать несколько — или продолжить без выбора.',
          options: [
            'Покупка / продажа Bitcoin',
            'Майнинг',
            'Custody / хранение активов',
            'Управление корпоративным казначейством',
            'Налоговые аспекты',
            'Автоматизированные боты / алгоритмическая торговля',
            'DCA (регулярное инвестирование)',
            'Другое / общий обзор'
          ]
        }
      ],
      calendlyTopicLabels: [
        'Buy / sell Bitcoin',
        'Mining',
        'Custody / asset safekeeping',
        'Corporate treasury management',
        'Tax aspects',
        'Automated bots / algo-trading',
        'DCA (recurring investing)'
      ],
      segments: {
        handsoff: { tag: 'Тщательно подготовленная консультация', note: 'Мы подробно объясним, как работает наша аффилиатная модель — Virtuse не управляет активами от вашего имени.' },
        intro: { tag: 'Вводная / ознакомительная консультация', note: 'Сосредоточимся на основах — без какого-либо давления с принятием решений.' },
        experienced: { tag: 'Консультация для опытных клиентов', note: 'Глубже рассмотрим доступные категории возможностей.' },
        tailored: { tag: 'Индивидуальная консультация', note: 'Подготовим контекст на основе ваших ответов.' }
      }
    }
  };

  function segmentCase(goal, exp, involvement) {
    if (involvement === 2) return 'handsoff';
    if (goal === 0 && exp === 0) return 'intro';
    if (goal === 2 || exp >= 2) return 'experienced';
    return 'tailored';
  }

  function buildCalendlyUrl(copy, answers) {
    var q = copy.questions;
    var goal = answers[0], exp = answers[1], capital = answers[2], horizon = answers[3], involvement = answers[4];
    var interests = Array.isArray(answers[5]) ? answers[5] : [];

    var parts = [];
    if (goal != null) parts.push('Goal: ' + q[0].options[goal]);
    if (exp != null) parts.push('Experience: ' + q[1].options[exp]);
    if (capital != null) parts.push('Capital range: ' + q[2].options[capital]);
    if (horizon != null) parts.push('Horizon: ' + q[3].options[horizon]);
    if (involvement != null) parts.push('Involvement: ' + q[4].options[involvement]);
    if (interests.indexOf(7) !== -1) parts.push('Also mentioned: ' + q[5].options[7]);

    var a2 = parts.join(' | ');
    var topicLabels = copy.calendlyTopicLabels || q[5].options;
    var a1 = interests.filter(function (i) { return i < 7; })
      .map(function (i) { return topicLabels[i]; })
      .join(', ');

    var params = new URLSearchParams();
    if (a1) params.set('a1', a1);
    if (a2) params.set('a2', a2);
    params.set('utm_source', 'website');
    // Renamed from the reference's 'concierge_module' to match this
    // widget's own rename to "Consultation" -- keeps analytics from
    // conflating it with the unrelated Bitcoin Concierge module.
    params.set('utm_medium', 'consultation_module');
    params.set('utm_campaign', 'free_consultation');
    if (interests.length) {
      params.set('utm_content', interests.map(function (i) { return q[5].options[i]; }).join('+').replace(/\s+/g, '_'));
    }

    return CALENDLY_URL + '?' + params.toString();
  }

  function injectStyles() {
    if (document.getElementById('vwc-styles')) return;
    var style = document.createElement('style');
    style.id = 'vwc-styles';
    style.textContent = [
      ':root{--vwc-ink:#101820;--vwc-paper:#F6F4EF;--vwc-brass:#B8925A;--vwc-brass-dark:#8f6f41;--vwc-slate:#45607A;--vwc-muted:#5B6570;--vwc-line:#DCD8CC;}',
      '.vwc-overlay{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(16,24,32,0.6);padding:24px;}',
      '.vwc-overlay.vwc-open{display:flex;}',
      '.vwc-card{position:relative;width:100%;max-width:560px;max-height:calc(100vh - 48px);overflow-y:auto;background:#fff;border:1px solid var(--vwc-line);border-radius:6px;box-shadow:0 24px 64px rgba(0,0,0,0.35);font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;color:var(--vwc-ink);}',
      '.vwc-progress-track{position:sticky;top:0;height:2px;background:var(--vwc-line);width:100%;z-index:1;}',
      '.vwc-progress-fill{height:2px;background:var(--vwc-brass);width:0%;transition:width .4s ease;}',
      '.vwc-close{position:absolute;top:12px;right:12px;z-index:2;width:32px;height:32px;border-radius:50%;border:1px solid var(--vwc-line);background:#fff;color:var(--vwc-ink);font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}',
      '.vwc-close:hover{background:var(--vwc-paper);}',
      '.vwc-inner{padding:40px 40px 36px;}',
      '@media(max-width:480px){.vwc-inner{padding:56px 22px 26px;}}',
      '.vwc-step-label{font-size:13px;color:var(--vwc-muted);margin:0 0 18px;letter-spacing:.01em;}',
      '.vwc-headline{font-family:Georgia,\'Times New Roman\',serif;font-weight:600;font-size:26px;line-height:1.28;margin:0 0 28px;color:var(--vwc-ink);max-width:26ch;}',
      '.vwc-headline:focus{outline:none;}',
      '.vwc-options{display:flex;flex-direction:column;gap:10px;}',
      '.vwc-option{display:block;width:100%;text-align:left;padding:16px 18px;background:#fff;border:1px solid var(--vwc-line);border-radius:4px;font-family:inherit;font-size:16px;color:var(--vwc-ink);cursor:pointer;transition:border-color .15s ease,background .15s ease;}',
      '.vwc-option:hover{border-color:var(--vwc-brass);background:#FBF8F2;}',
      '.vwc-option:focus-visible{outline:2px solid var(--vwc-slate);outline-offset:2px;}',
      '.vwc-option-multi{display:flex;align-items:center;gap:12px;}',
      '.vwc-option-multi.vwc-checked{border-color:var(--vwc-brass);background:#FBF8F2;}',
      '.vwc-checkbox{width:18px;height:18px;border:1px solid var(--vwc-muted);border-radius:2px;flex:0 0 18px;position:relative;}',
      '.vwc-option-multi.vwc-checked .vwc-checkbox{border-color:var(--vwc-brass);background:var(--vwc-brass);}',
      '.vwc-option-multi.vwc-checked .vwc-checkbox::after{content:\'\';position:absolute;left:5px;top:1px;width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg);}',
      '.vwc-sublabel{font-size:14px;color:var(--vwc-muted);margin:-14px 0 20px;}',
      '.vwc-skip{display:block;width:100%;text-align:center;margin-top:18px;font-size:13px;color:var(--vwc-muted);background:none;border:none;cursor:pointer;text-decoration:underline;font-family:inherit;}',
      '.vwc-nav-row{display:flex;justify-content:space-between;align-items:center;margin-top:24px;}',
      '.vwc-back{font-size:14px;color:var(--vwc-muted);background:none;border:none;cursor:pointer;padding:0;font-family:inherit;}',
      '.vwc-back:hover{color:var(--vwc-ink);}',
      '.vwc-back:disabled{visibility:hidden;}',
      '.vwc-intro-eyebrow{font-size:13px;color:var(--vwc-brass-dark);margin:0 0 14px;font-weight:600;}',
      '.vwc-intro-body{font-size:16px;line-height:1.6;color:var(--vwc-muted);margin:0 0 32px;max-width:38ch;}',
      '.vwc-cta{display:block;width:100%;text-align:center;background:var(--vwc-ink);color:var(--vwc-paper);border:none;padding:15px 26px;font-size:16px;font-family:inherit;font-weight:600;cursor:pointer;border-radius:4px;text-decoration:none;transition:background .15s ease;}',
      '.vwc-cta:hover{background:var(--vwc-brass-dark);color:var(--vwc-paper);}',
      '.vwc-fine-print{font-size:12.5px;color:var(--vwc-muted);margin-top:22px;line-height:1.5;}',
      '.vwc-result-tag{display:inline-block;font-size:13px;color:var(--vwc-slate);border:1px solid var(--vwc-slate);padding:5px 12px;border-radius:4px;margin-bottom:20px;}',
      '.vwc-result-body{font-size:16px;line-height:1.65;color:var(--vwc-muted);margin:0 0 28px;}',
      '.vwc-disclaimer{background:var(--vwc-paper);border-left:2px solid var(--vwc-brass);padding:14px 16px;font-size:13.5px;line-height:1.55;color:var(--vwc-muted);margin-bottom:28px;}',
      '.vwc-risk{border-left-color:var(--vwc-slate);}',
      '.vwc-secondary-link{display:block;text-align:center;margin-top:16px;font-size:14px;color:var(--vwc-muted);text-decoration:underline;background:none;border:none;cursor:pointer;font-family:inherit;width:100%;}',
      '.vwc-fade{animation:vwcFadeIn .35s ease;}',
      '@keyframes vwcFadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}',
      '@media(prefers-reduced-motion:reduce){.vwc-fade{animation:none;}.vwc-progress-fill{transition:none;}}'
    ].join('');
    document.head.appendChild(style);
  }

  // ---- state (per-page singleton modal instance; no external store,
  // no persistence -- resets whenever the modal is closed or the page
  // reloads, matching the reference's plain in-memory `answers` array) ----
  var overlay = null;
  var els = {};
  var lang = 'en';
  var currentStep = -1;
  var answers = [];
  var triggerEl = null;
  var pendingFocus = 'headline'; // 'headline' | 'multi:<index>'

  function copy() { return COPY[lang]; }

  function buildOverlay() {
    var ov = document.createElement('div');
    ov.className = 'vwc-overlay';
    ov.id = 'vwc-overlay';

    var card = document.createElement('div');
    card.className = 'vwc-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');

    var track = document.createElement('div');
    track.className = 'vwc-progress-track';
    var fill = document.createElement('div');
    fill.className = 'vwc-progress-fill';
    fill.id = 'vwc-progress-fill';
    track.appendChild(fill);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'vwc-close';
    close.innerHTML = '✕';

    var inner = document.createElement('div');
    inner.className = 'vwc-inner';
    inner.id = 'vwc-app';

    card.appendChild(track);
    card.appendChild(close);
    card.appendChild(inner);
    ov.appendChild(card);

    close.addEventListener('click', function () { close_(); });
    ov.addEventListener('click', function (e) { if (e.target === ov) close_(); });
    ov.addEventListener('keydown', onKeydown);

    els = { overlay: ov, card: card, close: close, inner: inner, fill: fill };
    return ov;
  }

  function focusableEls() {
    return Array.prototype.slice.call(
      els.card.querySelectorAll('button, a[href]')
    ).filter(function (el) { return el.offsetParent !== null; });
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      close_();
      return;
    }
    if (e.key !== 'Tab') return;
    var focusable = focusableEls();
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open(requestedLang, trigger) {
    injectStyles();
    if (!overlay) overlay = buildOverlay();
    if (!overlay.isConnected) document.body.appendChild(overlay);

    lang = COPY[requestedLang] ? requestedLang : 'en';
    els.card.setAttribute('aria-label', copy().dialogLabel);
    els.close.setAttribute('aria-label', copy().closeLabel);

    triggerEl = trigger || document.activeElement;
    currentStep = -1;
    answers = [];
    pendingFocus = 'headline';

    document.body.style.overflow = 'hidden';
    overlay.classList.add('vwc-open');
    render();
  }

  function close_() {
    if (!overlay || !overlay.classList.contains('vwc-open')) return;
    overlay.classList.remove('vwc-open');
    document.body.style.overflow = '';
    if (triggerEl && typeof triggerEl.focus === 'function') triggerEl.focus();
  }

  function setProgress() {
    var total = copy().questions.length;
    var pct = currentStep < 0 ? 0 : Math.round((currentStep / total) * 100);
    els.fill.style.width = pct + '%';
  }

  function applyPendingFocus() {
    if (pendingFocus === 'headline') {
      var h = els.inner.querySelector('.vwc-headline, .vwc-result-tag');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus();
      }
      return;
    }
    var m = /^multi:(\d+)$/.exec(pendingFocus);
    if (m) {
      var btn = els.inner.querySelector('[data-multi-index="' + m[1] + '"]');
      if (btn) btn.focus();
    }
  }

  function render() {
    var c = copy();
    setProgress();

    if (currentStep === -1) {
      els.inner.innerHTML =
        '<p class="vwc-intro-eyebrow">' + c.introEyebrow + '</p>' +
        '<h1 class="vwc-headline vwc-fade">' + c.introHeadline + '</h1>' +
        '<p class="vwc-intro-body">' + c.introBody + '</p>' +
        '<button type="button" class="vwc-cta vwc-fade" id="vwc-start" style="display:inline-block;width:auto;">' + c.startLabel + '</button>' +
        '<p class="vwc-fine-print">' + c.finePrint + '</p>';
      document.getElementById('vwc-start').addEventListener('click', function () { advance(); });
      applyPendingFocus();
      return;
    }

    if (currentStep < c.questions.length) {
      var q = c.questions[currentStep];

      if (q.type === 'multi') {
        if (!Array.isArray(answers[currentStep])) answers[currentStep] = [];
        var selected = answers[currentStep];
        var optsHtml = q.options.map(function (opt, i) {
          var checked = selected.indexOf(i) !== -1;
          return '<button type="button" class="vwc-option vwc-option-multi' + (checked ? ' vwc-checked' : '') +
            '" data-multi-index="' + i + '" role="checkbox" aria-checked="' + checked + '">' +
            '<span class="vwc-checkbox" aria-hidden="true"></span><span>' + opt + '</span></button>';
        }).join('');

        els.inner.innerHTML =
          '<p class="vwc-step-label">' + c.stepOf(currentStep + 1, c.questions.length, q.label) + '</p>' +
          '<h1 class="vwc-headline vwc-fade">' + q.headline + '</h1>' +
          (q.sublabel ? '<p class="vwc-sublabel">' + q.sublabel + '</p>' : '') +
          '<div class="vwc-options vwc-fade">' + optsHtml + '</div>' +
          '<button type="button" class="vwc-cta vwc-fade" id="vwc-continue" style="margin-top:20px;">' + c.continueLabel + '</button>' +
          '<button type="button" class="vwc-skip" id="vwc-skip">' + c.skipLabel + '</button>' +
          '<div class="vwc-nav-row"><button type="button" class="vwc-back" id="vwc-back"' + (currentStep === 0 ? ' disabled' : '') + '>' + c.backLabel + '</button></div>';

        Array.prototype.forEach.call(els.inner.querySelectorAll('[data-multi-index]'), function (btn) {
          btn.addEventListener('click', function () { toggleMulti(parseInt(btn.getAttribute('data-multi-index'), 10)); });
        });
        document.getElementById('vwc-continue').addEventListener('click', function () { advance(); });
        document.getElementById('vwc-skip').addEventListener('click', function () { advance(); });
        var backBtn = document.getElementById('vwc-back');
        if (!backBtn.disabled) backBtn.addEventListener('click', function () { back(); });
        applyPendingFocus();
        return;
      }

      var singleOptsHtml = q.options.map(function (opt, i) {
        return '<button type="button" class="vwc-option" data-select-index="' + i + '">' + opt + '</button>';
      }).join('');

      els.inner.innerHTML =
        '<p class="vwc-step-label">' + c.stepOf(currentStep + 1, c.questions.length, q.label) + '</p>' +
        '<h1 class="vwc-headline vwc-fade">' + q.headline + '</h1>' +
        '<div class="vwc-options vwc-fade">' + singleOptsHtml + '</div>' +
        '<div class="vwc-nav-row"><button type="button" class="vwc-back" id="vwc-back"' + (currentStep === 0 ? ' disabled' : '') + '>' + c.backLabel + '</button></div>';

      Array.prototype.forEach.call(els.inner.querySelectorAll('[data-select-index]'), function (btn) {
        btn.addEventListener('click', function () { select(parseInt(btn.getAttribute('data-select-index'), 10)); });
      });
      var backBtn2 = document.getElementById('vwc-back');
      if (!backBtn2.disabled) backBtn2.addEventListener('click', function () { back(); });
      applyPendingFocus();
      return;
    }

    renderResult();
  }

  function select(i) {
    answers[currentStep] = i;
    currentStep++;
    pendingFocus = 'headline';
    render();
  }

  function toggleMulti(i) {
    var arr = answers[currentStep];
    var pos = arr.indexOf(i);
    if (pos === -1) arr.push(i); else arr.splice(pos, 1);
    pendingFocus = 'multi:' + i;
    render();
  }

  function advance() {
    currentStep++;
    pendingFocus = 'headline';
    render();
  }

  function back() {
    currentStep--;
    pendingFocus = 'headline';
    render();
  }

  function renderResult() {
    var c = copy();
    els.fill.style.width = '100%';
    var seg = c.segments[segmentCase(answers[0], answers[1], answers[4])];

    var interests = Array.isArray(answers[5]) ? answers[5] : [];
    var hasHighRisk = interests.some(function (i) { return HIGH_RISK_TOPICS.indexOf(i) !== -1; });
    var calendlyUrl = buildCalendlyUrl(c, answers);

    var riskNote = hasHighRisk
      ? '<div class="vwc-disclaimer vwc-risk vwc-fade">' + c.riskNote + '</div>'
      : '';

    els.inner.innerHTML =
      '<span class="vwc-result-tag vwc-fade" tabindex="-1">' + seg.tag + '</span>' +
      '<h1 class="vwc-headline vwc-fade">' + c.resultHeadline + '</h1>' +
      '<p class="vwc-result-body">' + seg.note + '</p>' +
      '<div class="vwc-disclaimer vwc-fade">' + c.disclaimer + '</div>' +
      riskNote +
      '<a href="' + calendlyUrl + '" target="_blank" rel="noopener" class="vwc-cta vwc-fade" id="vwc-book">' + c.bookLabel + '</a>' +
      '<button type="button" class="vwc-secondary-link vwc-fade" id="vwc-restart">' + c.restartLabel + '</button>';

    document.getElementById('vwc-book').addEventListener('click', function () {
      if (window.dataLayer) window.dataLayer.push({ event: 'consultation_booked_click', partner_id: 'calendly' });
    });
    document.getElementById('vwc-restart').addEventListener('click', function () {
      currentStep = -1;
      answers = [];
      pendingFocus = 'headline';
      render();
    });
    applyPendingFocus();
  }

  function resolveLang(trigger) {
    var explicit = trigger.getAttribute('data-consultation-lang');
    if (explicit && COPY[explicit]) return explicit;
    var htmlLang = (document.documentElement.lang || '').toLowerCase();
    if (COPY[htmlLang]) return htmlLang;
    return 'en';
  }

  function bindTriggers() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-consultation-trigger]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        open(resolveLang(btn), btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTriggers);
  } else {
    bindTriggers();
  }

  window.VirtuseConsultation = { open: function (l) { open(l || 'en', document.activeElement); }, close: close_ };
})();
