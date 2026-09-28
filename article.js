/* Virtuse Brief story reader (article.html + pre-rendered /stories/ pages).
   Needs brief-chrome.js loaded first. */
(function () {
  'use strict';

  var LANGS = {
    en: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'blog.html', suffix: '', locale: 'en-GB', worker: 'en', dir: '', concierge: true,
      desks: { mining: 'Mining', treasury: 'Treasury', custody: 'Custody', policy: 'Policy', macro: 'Macro', markets: 'Markets' },
      ui: {
        navIssues: 'Latest issues', navBlog: 'Blog', navData: 'Data', navHub: 'Virtuse hub', navGet: 'Get the Brief',
        crumbList: 'Blog', by: 'By', desk: ' desk', block: 'Block', readTime: ' min',
        image: 'Image', sources: 'Sources', aboutAuthor: 'About the author',
        authorBio: 'Founder & CEO of Virtuse. Writing on Bitcoin, macro, and the future of money.',
        share: 'Share', shareOn: 'Share on', copyLink: 'Copy link', copied: 'Link copied', copyFailed: 'Could not copy. Copy the address from the browser bar.', moreShare: 'More sharing options',
        nostrCopied: 'Copied. Paste it into your Nostr app.', openPrimal: 'Open Primal', back: '← All stories',
        inStory: 'In this story', onVirtuse: 'On Virtuse', ovAlt: 'Not sure? Get matched in 60 seconds →',
        ovNote: 'Partner services. Not financial advice.',
        capKicker: 'Get the Brief', capDek: 'Every Monday. Bitcoin-only. No tokens. No PR.', capBtn: 'Get the Brief',
        subscribe: 'Subscribe', more: 'More from the desk', moreAll: 'All stories', readMore: 'Read',
        emailReq: 'Email is required.', sending: 'Sending', subOk: 'You are on the list. Check your inbox.',
        subErr: 'Could not join the list. Try again.', netErr: 'Network error. Try again.',
        footAbout: 'About', footTerms: 'Terms', footPrivacy: 'Privacy', footCopy: '© 2018–2026 Virtuse Group. All rights reserved. Not financial advice.',
        errTitle: 'Story not found', errText: 'This story may have been moved or unpublished. Browse the full archive instead.', errCta: 'All stories'
      },
      services: {
        mining: ['Mine Bitcoin with vetted partners', 'Hosting, cloud and hardware partners compared on cost and payout.', 'Compare mining partners'],
        treasury: ['Bitcoin for your balance sheet', 'Custody, execution and reporting partners for companies and family offices.', 'See treasury partners'],
        custody: ['Hold your own keys', 'Hardware wallets and multi-sig tooling from vetted partners.', 'Compare custody options'],
        policy: ['Get your Bitcoin taxes right', 'Country-specific reports from tax software partners.', 'See tax partners'],
        macro: ['Borrow against Bitcoin instead of selling', 'Bitcoin-backed loans from vetted lenders, from 6% p.a.', 'Compare loan partners'],
        markets: ['Compare where to buy Bitcoin', 'Vetted, regulated platforms side by side. Fees, custody and payout in one view.', 'Compare partners']
      }
    },
    sk: {
      api: 'https://blog.virtuse.com/sk/wp-json/wp/v2/posts', category: 26,
      listPage: 'blog-sk.html', suffix: '&lang=sk', locale: 'sk-SK', worker: 'sk', dir: 'sk/', concierge: true,
      desks: { mining: 'Ťažba', treasury: 'Treasury', custody: 'Úschova', policy: 'Regulácia', macro: 'Makro', markets: 'Trhy' },
      ui: {
        navIssues: 'Posledné vydania', navBlog: 'Blog', navData: 'Dáta', navHub: 'Virtuse hub', navGet: 'Získať Brief',
        crumbList: 'Blog', by: 'Autor', desk: '', block: 'Blok', readTime: ' min',
        image: 'Obrázok', sources: 'Zdroje', aboutAuthor: 'O autorovi',
        authorBio: 'Zakladateľ a CEO Virtuse. Píše o Bitcoine, makroekonomike a budúcnosti peňazí.',
        share: 'Zdieľať', shareOn: 'Zdieľať na', copyLink: 'Kopírovať odkaz', copied: 'Odkaz skopírovaný', copyFailed: 'Kopírovanie zlyhalo. Skopírujte adresu z prehliadača.', moreShare: 'Ďalšie možnosti zdieľania',
        nostrCopied: 'Skopírované. Vložte to do svojej Nostr aplikácie.', openPrimal: 'Otvoriť Primal', back: '← Všetky články',
        inStory: 'V tomto článku', onVirtuse: 'Na Virtuse', ovAlt: 'Neviete si rady? Partner za 60 sekúnd →',
        ovNote: 'Služby partnerov. Nie je to finančné poradenstvo.',
        capKicker: 'Získaj Brief', capDek: 'Každý pondelok. Iba Bitcoin. Žiadne tokeny. Žiadne PR.', capBtn: 'Získať Brief',
        subscribe: 'Odoberať', more: 'Ďalšie články', moreAll: 'Všetky články', readMore: 'Čítať',
        emailReq: 'Zadajte e-mail.', sending: 'Odosielam', subOk: 'Hotovo. Skontrolujte si schránku.',
        subErr: 'Prihlásenie sa nepodarilo. Skúste to znova.', netErr: 'Chyba siete. Skúste to znova.',
        footAbout: 'O nás', footTerms: 'Obchodné podmienky', footPrivacy: 'Ochrana osobných údajov', footCopy: '© 2018–2026 Virtuse Group. Všetky práva vyhradené.',
        errTitle: 'Článok sa nenašiel', errText: 'Tento článok mohol byť presunutý alebo stiahnutý. Prezrite si celý archív.', errCta: 'Všetky články'
      },
      services: {
        mining: ['Ťažte Bitcoin s overenými partnermi', 'Hosting, cloud a hardvér porovnané podľa nákladov a výplat.', 'Porovnať partnerov'],
        treasury: ['Bitcoin v súvahe firmy', 'Úschova, exekúcia a reporting pre firmy a family offices.', 'Treasury partneri'],
        custody: ['Majte vlastné kľúče', 'Hardvérové peňaženky a multi-sig od overených partnerov.', 'Porovnať úschovu'],
        policy: ['Zdaňte Bitcoin správne', 'Daňové prehľady podľa krajiny od softvérových partnerov.', 'Daňoví partneri'],
        macro: ['Požičajte si namiesto predaja', 'Pôžičky so zábezpekou v Bitcoine od 6 % p. a.', 'Porovnať pôžičky'],
        markets: ['Kde kúpiť Bitcoin', 'Overené regulované platformy vedľa seba: poplatky, úschova, výplata.', 'Porovnať partnerov']
      }
    },
    // WPML's Russian feed only answers on the shared /wp-json/ path with an
    // explicit lang=ru query param (no /ru/wp-json/ alias like sk has).
    ru: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 57, lang: 'ru',
      listPage: 'ru/blog.html', suffix: '&lang=ru', locale: 'ru-RU', worker: 'ru', dir: 'ru/', concierge: false,
      desks: { mining: 'Майнинг', treasury: 'Treasury', custody: 'Кастоди', policy: 'Регулирование', macro: 'Макро', markets: 'Рынки' },
      ui: {
        navIssues: 'Последние выпуски', navBlog: 'Блог', navData: 'Данные', navHub: 'Virtuse', navGet: 'Получить Brief',
        crumbList: 'Блог', by: 'Автор', desk: '', block: 'Блок', readTime: ' мин',
        image: 'Фото', sources: 'Источники', aboutAuthor: 'Об авторе',
        authorBio: 'Основатель и CEO Virtuse. Пишет о Биткоине, макроэкономике и будущем денег.',
        share: 'Поделиться', shareOn: 'Поделиться в', copyLink: 'Копировать ссылку', copied: 'Ссылка скопирована', copyFailed: 'Не удалось скопировать. Скопируйте адрес из браузера.', moreShare: 'Другие способы поделиться',
        nostrCopied: 'Скопировано. Вставьте в своё Nostr-приложение.', openPrimal: 'Открыть Primal', back: '← Все статьи',
        inStory: 'В этой статье', onVirtuse: 'На Virtuse', ovAlt: 'Не уверены? Подбор за 60 секунд →',
        ovNote: 'Услуги партнёров. Не является финансовой рекомендацией.',
        capKicker: 'Получите Brief', capDek: 'Каждый понедельник. Только Биткоин. Без токенов. Без PR.', capBtn: 'Получить Brief',
        subscribe: 'Подписаться', more: 'Ещё статьи', moreAll: 'Все статьи', readMore: 'Читать',
        emailReq: 'Укажите e-mail.', sending: 'Отправка', subOk: 'Готово. Проверьте почту.',
        subErr: 'Не удалось подписаться. Попробуйте ещё раз.', netErr: 'Ошибка сети. Попробуйте ещё раз.',
        footAbout: 'О нас', footTerms: 'Условия использования', footPrivacy: 'Политика конфиденциальности', footCopy: '© 2018–2026 Virtuse Group. Все права защищены.',
        errTitle: 'Статья не найдена', errText: 'Возможно, статья перемещена или снята с публикации. Посмотрите полный архив.', errCta: 'Все статьи'
      },
      services: {
        mining: ['Майнинг с проверенными партнёрами', 'Хостинг, облако и оборудование: сравнение затрат и выплат.', 'Сравнить партнёров'],
        treasury: ['Биткоин на балансе компании', 'Хранение, исполнение и отчётность для компаний и семейных офисов.', 'Партнёры'],
        custody: ['Храните свои ключи', 'Аппаратные кошельки и мультиподпись от проверенных партнёров.', 'Сравнить хранение'],
        policy: ['Налоги на Биткоин без ошибок', 'Отчёты по странам от налоговых сервисов.', 'Налоговые партнёры'],
        macro: ['Займите под Биткоин вместо продажи', 'Займы под залог Биткоина от 6% годовых.', 'Сравнить займы'],
        markets: ['Где купить Биткоин', 'Проверенные регулируемые платформы: комиссии, хранение, вывод.', 'Сравнить партнёров']
      }
    },
    // The languages below have no WordPress feed of their own yet: the story
    // is the English original (lang: 'en' for WPML), the interface and all
    // links are in the page language.
    uk: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'uk/blog.html', suffix: '&lang=uk', locale: 'uk-UA', worker: 'uk', dir: 'uk/', concierge: false,
      desks: { mining: 'Майнінг', treasury: 'Казначейство', custody: 'Кастоді', policy: 'Регулювання', macro: 'Макро', markets: 'Ринки' },
      ui: {
        navIssues: 'Останні випуски', navBlog: 'Блог', navData: 'Дані', navHub: 'Virtuse', navGet: 'Отримати Brief',
        crumbList: 'Блог', by: 'Автор', desk: '', block: 'Блок', readTime: ' хв',
        image: 'Фото', sources: 'Джерела', aboutAuthor: 'Про автора',
        authorBio: 'Засновник і CEO Virtuse. Пише про Біткоїн, макроекономіку та майбутнє грошей.',
        share: 'Поділитися', shareOn: 'Поділитися в', copyLink: 'Копіювати посилання', copied: 'Посилання скопійовано',
        copyFailed: 'Не вдалося скопіювати. Скопіюйте адресу з браузера.', moreShare: 'Інші способи поділитися',
        nostrCopied: 'Скопійовано. Вставте у свій Nostr-застосунок.', openPrimal: 'Відкрити Primal', back: '← Усі статті',
        inStory: 'У цій статті', onVirtuse: 'На Virtuse', ovAlt: 'Не впевнені? Підбір партнера за 60 секунд →',
        ovNote: 'Послуги партнерів. Не є фінансовою порадою.',
        capKicker: 'Отримайте Brief', capDek: 'Virtuse Brief. Лише Біткоїн. Жодних токенів. Жодного PR.', capBtn: 'Отримати Brief',
        subscribe: 'Отримати Brief', more: 'Ще статті', moreAll: 'Усі статті', readMore: 'Читати',
        emailReq: 'Вкажіть e-mail.', sending: 'Надсилання', subOk: 'Готово. Перевірте пошту.',
        subErr: 'Не вдалося підписатися. Спробуйте ще раз.', netErr: 'Помилка мережі. Спробуйте ще раз.',
        footAbout: 'Про нас', footTerms: 'Умови використання', footPrivacy: 'Політика конфіденційності', footCopy: '© 2018–2026 Virtuse Group. Усі права захищені.',
        errTitle: 'Статтю не знайдено', errText: 'Можливо, статтю перенесено або знято з публікації. Перегляньте повний архів.', errCta: 'Усі статті'
      },
      services: {
        mining: ['Майнінг із перевіреними партнерами', 'Хостинг, хмара та обладнання: порівняння витрат і виплат.', 'Порівняти партнерів'],
        treasury: ['Біткоїн на балансі компанії', 'Зберігання, виконання угод і звітність для компаній та сімейних офісів.', 'Партнери для казначейства'],
        custody: ['Зберігайте власні ключі', 'Апаратні гаманці та мультипідпис від перевірених партнерів.', 'Порівняти зберігання'],
        policy: ['Податки на Біткоїн без помилок', 'Звіти за країнами від податкових сервісів.', 'Податкові партнери'],
        macro: ['Позика під Біткоїн замість продажу', 'Позики під заставу Біткоїна від 6% річних.', 'Порівняти позики'],
        markets: ['Де купити Біткоїн', 'Перевірені регульовані платформи: комісії, зберігання, виведення.', 'Порівняти партнерів']
      }
    },
    de: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'de/blog.html', suffix: '&lang=de', locale: 'de-DE', worker: 'de', dir: 'de/', concierge: true,
      desks: { mining: 'Mining', treasury: 'Treasury', custody: 'Verwahrung', policy: 'Regulierung', macro: 'Makro', markets: 'Märkte' },
      ui: {
        navIssues: 'Neueste Ausgaben', navBlog: 'Blog', navData: 'Daten', navHub: 'Virtuse Hub', navGet: 'Brief erhalten',
        crumbList: 'Blog', by: 'Von', desk: '', block: 'Block', readTime: ' Min.',
        image: 'Bild', sources: 'Quellen', aboutAuthor: 'Über den Autor',
        authorBio: 'Gründer und CEO von Virtuse. Schreibt über Bitcoin, Makroökonomie und die Zukunft des Geldes.',
        share: 'Teilen', shareOn: 'Teilen auf', copyLink: 'Link kopieren', copied: 'Link kopiert',
        copyFailed: 'Kopieren fehlgeschlagen. Kopieren Sie die Adresse aus der Adresszeile.', moreShare: 'Weitere Optionen zum Teilen',
        nostrCopied: 'Kopiert. Fügen Sie es in Ihre Nostr-App ein.', openPrimal: 'Primal öffnen', back: '← Alle Artikel',
        inStory: 'In diesem Artikel', onVirtuse: 'Auf Virtuse', ovAlt: 'Unsicher? In 60 Sekunden zum passenden Partner →',
        ovNote: 'Partnerleistungen. Keine Anlageberatung.',
        capKicker: 'Holen Sie sich den Brief', capDek: 'Virtuse Brief. Nur Bitcoin. Keine Token. Keine PR.', capBtn: 'Brief erhalten',
        subscribe: 'Brief erhalten', more: 'Weitere Artikel', moreAll: 'Alle Artikel', readMore: 'Lesen',
        emailReq: 'Bitte geben Sie Ihre E-Mail-Adresse ein.', sending: 'Wird gesendet', subOk: 'Geschafft. Bitte prüfen Sie Ihr Postfach.',
        subErr: 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.', netErr: 'Netzwerkfehler. Bitte erneut versuchen.',
        footAbout: 'Über uns', footTerms: 'AGB', footPrivacy: 'Datenschutzerklärung', footCopy: '© 2018–2026 Virtuse Group. Alle Rechte vorbehalten.',
        errTitle: 'Artikel nicht gefunden', errText: 'Dieser Artikel wurde möglicherweise verschoben oder depubliziert. Durchsuchen Sie das Archiv.', errCta: 'Alle Artikel'
      },
      services: {
        mining: ['Bitcoin-Mining mit geprüften Partnern', 'Hosting-, Cloud- und Hardware-Partner nach Kosten und Auszahlung verglichen.', 'Mining-Partner vergleichen'],
        treasury: ['Bitcoin in der Unternehmensbilanz', 'Verwahrung, Ausführung und Reporting für Unternehmen und Family Offices.', 'Treasury-Partner ansehen'],
        custody: ['Behalten Sie Ihre eigenen Schlüssel', 'Hardware-Wallets und Multi-Sig-Lösungen von geprüften Partnern.', 'Verwahrung vergleichen'],
        policy: ['Bitcoin-Steuern richtig erledigen', 'Länderspezifische Berichte von Steuersoftware-Partnern.', 'Steuer-Partner ansehen'],
        macro: ['Bitcoin beleihen statt verkaufen', 'Bitcoin-besicherte Kredite geprüfter Anbieter, ab 6 % p. a.', 'Kredit-Partner vergleichen'],
        markets: ['Wo Sie Bitcoin kaufen', 'Geprüfte, regulierte Plattformen im Vergleich: Gebühren, Verwahrung, Auszahlung.', 'Partner vergleichen']
      }
    },
    fr: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'fr/blog.html', suffix: '&lang=fr', locale: 'fr-FR', worker: 'fr', dir: 'fr/', concierge: false,
      desks: { mining: 'Minage', treasury: 'Treasury', custody: 'Conservation', policy: 'Régulation', macro: 'Macro', markets: 'Marchés' },
      ui: {
        navIssues: 'Derniers numéros', navBlog: 'Blog', navData: 'Données', navHub: 'Hub Virtuse', navGet: 'Recevoir le Brief',
        crumbList: 'Blog', by: 'Par', desk: '', block: 'Bloc', readTime: ' min',
        image: 'Image', sources: 'Sources', aboutAuthor: 'L’auteur',
        authorBio: 'Fondateur et CEO de Virtuse. Écrit sur le Bitcoin, la macroéconomie et l’avenir de la monnaie.',
        share: 'Partager', shareOn: 'Partager sur', copyLink: 'Copier le lien', copied: 'Lien copié',
        copyFailed: 'Copie impossible. Copiez l’adresse dans la barre du navigateur.', moreShare: 'Autres options de partage',
        nostrCopied: 'Copié. Collez-le dans votre application Nostr.', openPrimal: 'Ouvrir Primal', back: '← Tous les articles',
        inStory: 'Dans cet article', onVirtuse: 'Sur Virtuse', ovAlt: 'Vous hésitez ? Le bon partenaire en 60 secondes →',
        ovNote: 'Services de partenaires. Pas un conseil financier.',
        capKicker: 'Recevez le Brief', capDek: 'Virtuse Brief. 100 % Bitcoin. Pas de tokens. Pas de RP.', capBtn: 'Recevoir le Brief',
        subscribe: 'Recevoir le Brief', more: 'Autres articles', moreAll: 'Tous les articles', readMore: 'Lire',
        emailReq: 'Adresse e-mail requise.', sending: 'Envoi', subOk: 'C’est fait. Vérifiez votre boîte de réception.',
        subErr: 'Inscription impossible. Réessayez.', netErr: 'Erreur réseau. Réessayez.',
        footAbout: 'À propos', footTerms: 'CGU', footPrivacy: 'Politique de confidentialité', footCopy: '© 2018–2026 Virtuse Group. Tous droits réservés.',
        errTitle: 'Article introuvable', errText: 'Cet article a peut-être été déplacé ou dépublié. Parcourez les archives.', errCta: 'Tous les articles'
      },
      services: {
        mining: ['Miner du Bitcoin avec des partenaires vérifiés', 'Hébergement, cloud et matériel comparés sur les coûts et les paiements.', 'Comparer les partenaires'],
        treasury: ['Le Bitcoin au bilan de l’entreprise', 'Conservation, exécution et reporting pour entreprises et family offices.', 'Voir les partenaires'],
        custody: ['Gardez vos propres clés', 'Portefeuilles matériels et multisig de partenaires vérifiés.', 'Comparer la conservation'],
        policy: ['Déclarez votre Bitcoin sans erreur', 'Rapports fiscaux par pays de nos partenaires logiciels.', 'Voir les partenaires fiscaux'],
        macro: ['Empruntez au lieu de vendre', 'Prêts garantis par du Bitcoin auprès de prêteurs vérifiés, dès 6 % par an.', 'Comparer les prêts'],
        markets: ['Où acheter du Bitcoin', 'Plateformes régulées et vérifiées côte à côte : frais, conservation, retrait.', 'Comparer les partenaires']
      }
    },
    es: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'es/blog.html', suffix: '&lang=es', locale: 'es-ES', worker: 'es', dir: 'es/', concierge: false,
      desks: { mining: 'Minería', treasury: 'Treasury', custody: 'Custodia', policy: 'Regulación', macro: 'Macro', markets: 'Mercados' },
      ui: {
        navIssues: 'Últimos números', navBlog: 'Blog', navData: 'Datos', navHub: 'Hub de Virtuse', navGet: 'Recibir el Brief',
        crumbList: 'Blog', by: 'Por', desk: '', block: 'Bloque', readTime: ' min',
        image: 'Imagen', sources: 'Fuentes', aboutAuthor: 'Sobre el autor',
        authorBio: 'Fundador y CEO de Virtuse. Escribe sobre Bitcoin, macroeconomía y el futuro del dinero.',
        share: 'Compartir', shareOn: 'Compartir en', copyLink: 'Copiar enlace', copied: 'Enlace copiado',
        copyFailed: 'No se pudo copiar. Copie la dirección desde el navegador.', moreShare: 'Más opciones para compartir',
        nostrCopied: 'Copiado. Péguelo en su aplicación de Nostr.', openPrimal: 'Abrir Primal', back: '← Todos los artículos',
        inStory: 'En este artículo', onVirtuse: 'En Virtuse', ovAlt: '¿No está seguro? Encuentre socio en 60 segundos →',
        ovNote: 'Servicios de socios. No es asesoramiento financiero.',
        capKicker: 'Reciba el Brief', capDek: 'Virtuse Brief. Solo Bitcoin. Sin tokens. Sin RP.', capBtn: 'Recibir el Brief',
        subscribe: 'Recibir el Brief', more: 'Más artículos', moreAll: 'Todos los artículos', readMore: 'Leer',
        emailReq: 'Indique su correo electrónico.', sending: 'Enviando', subOk: 'Listo. Revise su correo.',
        subErr: 'No se pudo completar la suscripción. Inténtelo de nuevo.', netErr: 'Error de red. Inténtelo de nuevo.',
        footAbout: 'Sobre nosotros', footTerms: 'Términos y condiciones', footPrivacy: 'Política de privacidad', footCopy: '© 2018–2026 Virtuse Group. Todos los derechos reservados.',
        errTitle: 'Artículo no encontrado', errText: 'Es posible que el artículo se haya movido o retirado. Consulte el archivo completo.', errCta: 'Todos los artículos'
      },
      services: {
        mining: ['Mine Bitcoin con socios verificados', 'Hosting, nube y hardware comparados por costes y pagos.', 'Comparar socios de minería'],
        treasury: ['Bitcoin en el balance de su empresa', 'Custodia, ejecución y reporting para empresas y family offices.', 'Ver socios de tesorería'],
        custody: ['Guarde sus propias claves', 'Monederos de hardware y multifirma de socios verificados.', 'Comparar custodia'],
        policy: ['Declare su Bitcoin sin errores', 'Informes fiscales por país de socios de software fiscal.', 'Ver socios fiscales'],
        macro: ['Pida un préstamo en lugar de vender', 'Préstamos respaldados por Bitcoin de prestamistas verificados, desde el 6 % anual.', 'Comparar préstamos'],
        markets: ['Dónde comprar Bitcoin', 'Plataformas reguladas y verificadas, lado a lado: comisiones, custodia y retiradas.', 'Comparar socios']
      }
    },
    pl: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'pl/blog.html', suffix: '&lang=pl', locale: 'pl-PL', worker: 'pl', dir: 'pl/', concierge: false,
      desks: { mining: 'Kopanie', treasury: 'Treasury', custody: 'Przechowywanie', policy: 'Regulacje', macro: 'Makro', markets: 'Rynki' },
      ui: {
        navIssues: 'Najnowsze wydania', navBlog: 'Blog', navData: 'Dane', navHub: 'Hub Virtuse', navGet: 'Zapisz się',
        crumbList: 'Blog', by: 'Autor', desk: '', block: 'Blok', readTime: ' min',
        image: 'Zdjęcie', sources: 'Źródła', aboutAuthor: 'O autorze',
        authorBio: 'Założyciel i CEO Virtuse. Pisze o Bitcoinie, makroekonomii i przyszłości pieniądza.',
        share: 'Udostępnij', shareOn: 'Udostępnij w', copyLink: 'Kopiuj link', copied: 'Link skopiowany',
        copyFailed: 'Nie udało się skopiować. Skopiuj adres z paska przeglądarki.', moreShare: 'Więcej opcji udostępniania',
        nostrCopied: 'Skopiowano. Wklej w swojej aplikacji Nostr.', openPrimal: 'Otwórz Primal', back: '← Wszystkie artykuły',
        inStory: 'W tym artykule', onVirtuse: 'Na Virtuse', ovAlt: 'Nie wiesz, co wybrać? Partner w 60 sekund →',
        ovNote: 'Usługi partnerów. To nie jest porada finansowa.',
        capKicker: 'Zapisz się na Brief', capDek: 'Virtuse Brief. Tylko Bitcoin. Bez tokenów. Bez PR-u.', capBtn: 'Zapisz się',
        subscribe: 'Zapisz się', more: 'Więcej artykułów', moreAll: 'Wszystkie artykuły', readMore: 'Czytaj',
        emailReq: 'Podaj adres e-mail.', sending: 'Wysyłanie', subOk: 'Gotowe. Sprawdź skrzynkę.',
        subErr: 'Nie udało się zapisać. Spróbuj ponownie.', netErr: 'Błąd sieci. Spróbuj ponownie.',
        footAbout: 'O nas', footTerms: 'Regulamin', footPrivacy: 'Polityka prywatności', footCopy: '© 2018–2026 Virtuse Group. Wszelkie prawa zastrzeżone.',
        errTitle: 'Nie znaleziono artykułu', errText: 'Artykuł mógł zostać przeniesiony lub wycofany. Przejrzyj całe archiwum.', errCta: 'Wszystkie artykuły'
      },
      services: {
        mining: ['Kop Bitcoina ze sprawdzonymi partnerami', 'Hosting, chmura i sprzęt porównane pod kątem kosztów i wypłat.', 'Porównaj partnerów'],
        treasury: ['Bitcoin w bilansie firmy', 'Przechowywanie, egzekucja zleceń i raportowanie dla firm i family offices.', 'Partnerzy treasury'],
        custody: ['Trzymaj własne klucze', 'Portfele sprzętowe i multisig od sprawdzonych partnerów.', 'Porównaj przechowywanie'],
        policy: ['Rozlicz Bitcoina bez błędów', 'Raporty podatkowe dla każdego kraju od partnerów podatkowych.', 'Partnerzy podatkowi'],
        macro: ['Pożycz zamiast sprzedawać', 'Pożyczki pod zastaw Bitcoina od sprawdzonych pożyczkodawców, od 6% rocznie.', 'Porównaj pożyczki'],
        markets: ['Gdzie kupić Bitcoina', 'Sprawdzone, regulowane platformy obok siebie: opłaty, przechowywanie, wypłaty.', 'Porównaj partnerów']
      }
    },
    hu: {
      api: 'https://blog.virtuse.com/wp-json/wp/v2/posts', category: 13, lang: 'en',
      listPage: 'hu/blog.html', suffix: '&lang=hu', locale: 'hu-HU', worker: 'hu', dir: 'hu/', concierge: false,
      desks: { mining: 'Bányászat', treasury: 'Treasury', custody: 'Letétkezelés', policy: 'Szabályozás', macro: 'Makró', markets: 'Piacok' },
      ui: {
        navIssues: 'Legutóbbi számok', navBlog: 'Blog', navData: 'Adatok', navHub: 'Virtuse hub', navGet: 'Feliratkozás',
        crumbList: 'Blog', by: 'Szerző:', desk: '', block: 'Blokk', readTime: ' perc',
        image: 'Kép', sources: 'Források', aboutAuthor: 'A szerzőről',
        authorBio: 'A Virtuse alapítója és vezérigazgatója. Bitcoinról, makrogazdaságról és a pénz jövőjéről ír.',
        share: 'Megosztás', shareOn: 'Megosztás:', copyLink: 'Link másolása', copied: 'Link kimásolva',
        copyFailed: 'A másolás nem sikerült. Másolja ki a címet a böngészőből.', moreShare: 'További megosztási lehetőségek',
        nostrCopied: 'Kimásolva. Illessze be Nostr-alkalmazásába.', openPrimal: 'Primal megnyitása', back: '← Összes cikk',
        inStory: 'Ebben a cikkben', onVirtuse: 'A Virtuse-on', ovAlt: 'Bizonytalan? Partner 60 másodperc alatt →',
        ovNote: 'Partnerszolgáltatások. Nem befektetési tanácsadás.',
        capKicker: 'Iratkozzon fel a Briefre', capDek: 'Virtuse Brief. Csak Bitcoin. Tokenek nélkül. PR nélkül.', capBtn: 'Feliratkozás',
        subscribe: 'Feliratkozás', more: 'További cikkek', moreAll: 'Összes cikk', readMore: 'Elolvasom',
        emailReq: 'Adja meg e-mail-címét.', sending: 'Küldés', subOk: 'Kész. Nézze meg a postafiókját.',
        subErr: 'A feliratkozás nem sikerült. Próbálja újra.', netErr: 'Hálózati hiba. Próbálja újra.',
        footAbout: 'Rólunk', footTerms: 'Felhasználási feltételek', footPrivacy: 'Adatvédelmi tájékoztató', footCopy: '© 2018–2026 Virtuse Group. Minden jog fenntartva.',
        errTitle: 'A cikk nem található', errText: 'Lehet, hogy a cikket áthelyezték vagy visszavonták. Böngéssze az archívumot.', errCta: 'Összes cikk'
      },
      services: {
        mining: ['Bitcoin-bányászat ellenőrzött partnerekkel', 'Hosting, felhő és hardver költség és kifizetés szerint összevetve.', 'Partnerek összehasonlítása'],
        treasury: ['Bitcoin a cég mérlegében', 'Letétkezelés, végrehajtás és riportolás cégeknek és family office-oknak.', 'Treasury-partnerek'],
        custody: ['Saját kulcsok, saját kézben', 'Hardveres tárcák és multisig megoldások ellenőrzött partnerektől.', 'Letétkezelők összehasonlítása'],
        policy: ['Adózza helyesen a Bitcoint', 'Országonkénti adójelentések adószoftver-partnerektől.', 'Adópartnerek'],
        macro: ['Eladás helyett hitel', 'Bitcoin-fedezetű hitelek ellenőrzött hitelezőktől, évi 6%-tól.', 'Hitelek összehasonlítása'],
        markets: ['Hol vásároljon Bitcoint', 'Ellenőrzött, szabályozott platformok egymás mellett: díjak, letét, kifizetés.', 'Partnerek összehasonlítása']
      }
    }
  };

  // Pre-rendered /stories/ pages set data-root (path back to the site root),
  // data-slug, data-lang (the story's own language) and data-story (their
  // own clean path). article.html?slug=… leaves them empty; ?lang= always
  // wins so a shared link can carry the reader's interface language.
  var HTML = document.documentElement;
  var ROOT = HTML.getAttribute('data-root') || '';
  var STORY = HTML.getAttribute('data-story') || '';
  var langCode = new URLSearchParams(location.search).get('lang') || HTML.getAttribute('data-lang');
  if (!LANGS[langCode]) langCode = 'en';
  var L = LANGS[langCode];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function stripHtml(s) { var d = new DOMParser().parseFromString(s || '', 'text/html'); return (d.body.textContent || '').replace(/\s*\[…\]\s*$/, '…').trim(); }

  function localizeChrome() {
    document.documentElement.lang = langCode;
    window.VB_UI = L.ui;
    window.VB_LANG = L.worker;
    [].forEach.call(document.querySelectorAll('[data-ui]'), function (n) {
      var v = L.ui[n.getAttribute('data-ui')];
      if (v != null) n.textContent = v;
    });
    $('authorBio').textContent = L.ui.authorBio;
    ['crumbList', 'backLink', 'moreAll', 'navBlog', 'footBlog'].forEach(function (id) { $(id).href = ROOT + L.listPage; });
    // Hub, legal pages and the service card point at the page language.
    [].forEach.call(document.querySelectorAll('[data-hub]'), function (a) { a.href = ROOT + L.dir + a.getAttribute('data-hub'); });
    $('ovAlt').href = ROOT + (L.concierge ? L.dir : '') + 'concierge.html?utm_source=concierge&utm_medium=article';
  }
  localizeChrome();

  // Minimal allowlist sanitizer for WordPress post bodies. WordPress is
  // first-party, but it is the one place CMS content becomes live HTML on an
  // otherwise static site -- this stops injected markup from executing here.
  function sanitizeHtml(html) {
    var ALLOWED_TAGS = { P: 1, BR: 1, HR: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, S: 1, MARK: 1, SUB: 1, SUP: 1, A: 1, IMG: 1, FIGURE: 1, FIGCAPTION: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, CODE: 1, PRE: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TH: 1, TD: 1, SPAN: 1, DIV: 1, IFRAME: 1 };
    var REMOVE_ENTIRELY = { SCRIPT: 1, STYLE: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1, BASE: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, NOSCRIPT: 1 };
    var ALLOWED_ATTRS = { A: ['href', 'title', 'target', 'rel'], IMG: ['src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes'], IFRAME: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'title'], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };
    var GLOBAL_ATTRS = ['class'];
    var ALLOWED_IFRAME_HOSTS = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'open.spotify.com', 'platform.twitter.com', 'twitter.com', 'x.com'];
    function isSafeUrl(url) { try { var u = new URL(url, location.href); return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:'; } catch (e) { return false; } }
    var doc = new DOMParser().parseFromString(html || '', 'text/html');
    function clean(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 8) { node.removeChild(child); return; }
        if (child.nodeType !== 1) return;
        var tag = child.tagName;
        if (REMOVE_ENTIRELY[tag]) { node.removeChild(child); return; }
        if (!ALLOWED_TAGS[tag]) { while (child.firstChild) node.insertBefore(child.firstChild, child); node.removeChild(child); return; }
        if (tag === 'IFRAME') {
          var host = ''; try { host = new URL(child.getAttribute('src') || '', location.href).hostname; } catch (e) {}
          if (ALLOWED_IFRAME_HOSTS.indexOf(host) === -1) { node.removeChild(child); return; }
        }
        var allowed = (ALLOWED_ATTRS[tag] || []).concat(GLOBAL_ATTRS);
        Array.prototype.slice.call(child.attributes).forEach(function (attr) {
          var name = attr.name.toLowerCase();
          if (allowed.indexOf(name) === -1) { child.removeAttribute(attr.name); return; }
          if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) child.removeAttribute(attr.name);
        });
        if (tag === 'A') child.setAttribute('rel', 'noopener noreferrer');
        clean(child);
      });
    }
    clean(doc.body);
    return doc.body.innerHTML;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function gmt(post) { return new Date((post.date_gmt || post.date) + (post.date_gmt ? 'Z' : '')); }
  function fmtDate(d) { return d.toLocaleDateString(L.locale, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtStamp(d) { return fmtDate(d) + ' · ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' UTC'; }
  function imgOf(post) { try { return post._embedded['wp:featuredmedia'][0].source_url || ''; } catch (e) { return ''; } }
  function mediaOf(post) { try { return post._embedded['wp:featuredmedia'][0] || null; } catch (e) { return null; } }
  function minutes(html) { return Math.max(1, Math.round(stripHtml(html).split(/\s+/).length / 220)); }

  function inferDesk(post) { return window.VB_inferDesk(post); }

  function showError() {
    var root = $('articleRoot');
    root.textContent = '';
    var box = el('div', 'error-state');
    box.appendChild(el('p', 'story-kicker', 'Virtuse Brief'));
    box.appendChild(el('h1', null, L.ui.errTitle));
    box.appendChild(el('p', null, L.ui.errText));
    var a = el('a', 'btn', L.ui.errCta); a.href = ROOT + L.listPage;
    box.appendChild(a);
    root.appendChild(box);
  }

  // Every distinct external link gets a numbered marker and a Sources entry.
  function buildSources(body) {
    var list = $('sourcesList'), seen = {}, n = 0;
    [].forEach.call(body.querySelectorAll('a[href]'), function (a) {
      var u; try { u = new URL(a.href); } catch (e) { return; }
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      if (!/^https?:$/.test(u.protocol) || /(^|\.)virtuse\.com$/.test(u.hostname)) return;
      var key = u.href.replace(/#.*$/, '');
      if (!seen[key]) {
        n++; seen[key] = n;
        var li = el('li'); li.id = 'src-' + n;
        li.appendChild(el('span', 'n', pad2(n)));
        var wrap = el('span');
        var link = el('a', null, stripHtml(a.textContent) || u.hostname.replace(/^www\./, ''));
        link.href = u.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
        wrap.appendChild(link);
        wrap.appendChild(el('span', 'host', u.hostname.replace(/^www\./, '')));
        li.appendChild(wrap); list.appendChild(li);
      }
      var sup = el('sup', 'fn'); var ref = el('a', null, pad2(seen[key])); ref.href = '#src-' + seen[key];
      sup.appendChild(ref);
      a.parentNode.insertBefore(sup, a.nextSibling);
    });
    $('sources').hidden = n === 0;
  }

  function buildToc(body) {
    // Section level = the highest heading level the post actually uses
    // (older posts use h3/h4 for sections). It gets the desk-rule styling.
    var heads = [];
    ['h2', 'h3', 'h4'].some(function (t) { heads = body.querySelectorAll(t); return heads.length > 0; });
    [].forEach.call(heads, function (h) { h.classList.add('sec-head'); });
    if (heads.length < 2) return;
    var list = $('tocList'), links = [];
    [].forEach.call(heads, function (h, i) {
      h.id = h.id || 'sec-' + (i + 1);
      var li = el('li'), a = el('a', null, stripHtml(h.textContent));
      a.href = '#' + h.id; li.appendChild(a); list.appendChild(li); links.push(a);
    });
    $('toc').hidden = false;
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '0px 0px -70% 0px' });
    [].forEach.call(heads, function (h) { io.observe(h); });
  }

  function setService(desk) {
    var s = L.services[desk.id];
    $('ovTitle').textContent = s[0];
    $('ovDek').textContent = s[1];
    var cta = $('ovCta');
    cta.textContent = s[2];
    cta.href = ROOT + L.dir + desk.href + '?utm_source=brief&utm_medium=article&utm_content=' + desk.id;
  }

  function renderArticle(post) {
    var title = stripHtml(post.title.rendered);
    var desk = inferDesk(post);
    var deskName = L.desks[desk.id];
    var when = gmt(post);
    document.title = title + ' · Virtuse Brief';

    $('storyKicker').textContent = deskName;
    $('articleTitle').textContent = title;
    // Dek only from a hand-written excerpt. WordPress auto-excerpts are just
    // the first 55 words of the body ending in [&hellip;], which would repeat
    // the opening paragraph right below.
    var rawEx = (post.excerpt && post.excerpt.rendered) || '';
    var dek = /\[(&hellip;|…)\]\s*(<\/p>)?\s*$/.test(rawEx) ? '' : stripHtml(rawEx);
    if (dek) $('articleDek').textContent = dek; else $('articleDek').remove();
    $('bylineDesk').textContent = deskName + L.ui.desk;
    $('bylineDate').textContent = fmtStamp(when);
    $('bylineRead').textContent = minutes(post.content.rendered) + L.ui.readTime;

    // Block height at publication time, from mempool.space.
    fetch('https://mempool.space/api/v1/mining/blocks/timestamp/' + Math.floor(when.getTime() / 1000))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) { if (b && b.height) { var s = $('bylineBlock'); s.textContent = L.ui.block + ' ' + b.height.toLocaleString(L.locale); s.hidden = false; } })
      .catch(function () {});

    var src = imgOf(post);
    if (src) {
      $('heroImg').src = src; $('heroImg').alt = title;
      $('articleHero').hidden = false;
      var m = mediaOf(post);
      // Only the media caption (credit line) -- alt text is a description, not a credit.
      var cap = m ? stripHtml(m.caption && m.caption.rendered) : '';
      if (cap) { $('heroCap').textContent = L.ui.image + ': ' + cap; $('heroCap').hidden = false; }
    }

    var body = $('articleBody');
    body.innerHTML = sanitizeHtml(post.content.rendered);
    body.querySelectorAll('iframe').forEach(function (f) {
      if (f.parentElement.classList.contains('wp-block-embed') || f.parentElement.classList.contains('video-wrap')) return;
      var w = el('div', 'video-wrap'); f.parentNode.insertBefore(w, f); w.appendChild(f);
    });
    buildToc(body);      // before sources, so footnote numbers stay out of TOC labels
    buildSources(body);
    setService(desk);
    resolveSharePath(post).then(function (path) { setupShare(title, path); });
  }

  // Share. Links always point at production (never localhost), keep the
  // story language, and carry utm_source=<network> so shares show in GA.
  var ICONS = {
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.5l11.2 14.5z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1-.02 5 2.5 2.5 0 0 1 .02-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3l-3.2 15c-.2 1.1-.9 1.3-1.8.8l-4.8-3.6-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2l-11 6.9L1.7 12c-1-.3-1-1 .2-1.5L20.5 3.4c.9-.3 1.6.2 1.4.9z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 8.5c3.9 0 7 2.2 7 5s-3.1 5-7 5-7-2.2-7-5 3.1-5 7-5zM9.5 12.3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm5 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM9.2 16.1c.8.6 1.8.9 2.8.9s2-.3 2.8-.9l-.6-.7c-.6.4-1.4.6-2.2.6s-1.6-.2-2.2-.6z"/><circle cx="5" cy="10.8" r="1.7"/><circle cx="19" cy="10.8" r="1.7"/><circle cx="17.6" cy="4.6" r="1.4"/><path d="M12.5 8.6l1-5 3.1.7-.2.9-2.1-.4-.8 3.8z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.3C16.7 2.2 15.6 2 14.4 2 11.8 2 10 3.6 10 6.5v2H7.3v3.6H10V22h4v-9.9h2.9l.4-3.6H14z"/></svg>',
    nostr: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8.5" cy="15" rx="6.5" ry="4.2"/><path d="M11.6 13.4c.9-2.8 1.6-5.6 2-8.4l2 .3c-.4 3-1.1 5.9-2.1 8.8z"/><circle cx="15.6" cy="4.4" r="2.3"/><path d="M17.4 3.5l4.6 1.3-4.4 1.4z"/><path d="M7 18.5l-1.2 4.2h1.5l1.2-4zM10.6 18.6l.9 4.1h1.5l-1-4.3z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/></svg>'
  };
  var NETWORKS = [
    { id: 'x',        name: 'X',        href: function (u, t) { return 'https://x.com/intent/tweet?text=' + encodeURIComponent(t) + '&url=' + encodeURIComponent(u); } },
    { id: 'linkedin', name: 'LinkedIn', href: function (u) { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(u); } },
    { id: 'telegram', name: 'Telegram', href: function (u, t) { return 'https://t.me/share/url?url=' + encodeURIComponent(u) + '&text=' + encodeURIComponent(t); } },
    { id: 'reddit',   name: 'Reddit',   href: function (u, t) { return 'https://www.reddit.com/submit?url=' + encodeURIComponent(u) + '&title=' + encodeURIComponent(t); } },
    { id: 'facebook', name: 'Facebook', href: function (u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(u); } }
  ];
  var toastTimer = null;
  function toast(text, link) {
    var t = $('shareToast');
    t.textContent = '';
    t.appendChild(document.createTextNode(text));
    if (link) { var a = el('a', null, link.label + ' →'); a.href = link.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; t.appendChild(a); }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, link ? 5000 : 2200);
  }
  function track(network) { (window.dataLayer = window.dataLayer || []).push({ event: 'article_share', share_network: network, article_slug: slug }); }
  // Clipboard API first; if the browser refuses, fall back to execCommand.
  function legacyCopy(text) {
    var ta = el('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  // Clean path of a story's pre-rendered page (same rule as
  // stories-build/build.mjs): stories/<slug>/ for English, sk/stories/ and
  // ru/stories/ for stories from those feeds; non-ASCII slugs use the post id.
  function storyPath(post) {
    var own = L.lang === 'en' ? 'en' : langCode;
    var key = /^[a-z0-9-]+$/.test(post.slug) ? post.slug : String(post.id);
    return (own === 'en' ? '' : own + '/') + 'stories/' + key + '/';
  }
  // Share the pre-rendered page (it carries this story's own preview card).
  // On article.html the page may not exist yet for a story published after
  // the last build, so check first and fall back to article.html.
  function resolveSharePath(post) {
    if (STORY) return Promise.resolve(STORY);
    var path = storyPath(post);
    return fetch(ROOT + path, { method: 'HEAD' })
      .then(function (r) { return r.ok ? path : null; })
      .catch(function () { return null; });
  }

  function setupShare(title, sharePath) {
    var base = /(^|\.)virtuse\.com$/.test(location.hostname) ? location.origin : 'https://virtuse.com';
    var own = L.lang === 'en' ? 'en' : langCode;
    function url(src) {
      var q = 'utm_source=' + src + '&utm_medium=social_share&utm_campaign=brief_article';
      if (sharePath) return base + '/' + sharePath + '?' + (langCode !== own ? 'lang=' + langCode + '&' : '') + q;
      return base + '/article.html?slug=' + encodeURIComponent(slug) + (langCode !== 'en' ? '&lang=' + langCode : '') + '&' + q;
    }
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var canNative = !!navigator.share;

    [].forEach.call(document.querySelectorAll('[data-share-slot]'), function (slot) {
      slot.textContent = '';
      NETWORKS.forEach(function (n) {
        var a = el('a'); a.href = n.href(url(n.id), title); a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', L.ui.shareOn + ' ' + n.name); a.title = n.name; a.innerHTML = ICONS[n.id];
        a.addEventListener('click', function () { track(n.id); });
        slot.appendChild(a);
      });
      // Nostr has no web share intent: phones get the system share sheet
      // (Primal, Damus, Amethyst register as targets); elsewhere the note
      // text is copied for pasting into any Nostr client.
      var nb = el('button'); nb.type = 'button'; nb.setAttribute('aria-label', L.ui.shareOn + ' Nostr'); nb.title = 'Nostr'; nb.innerHTML = ICONS.nostr;
      nb.addEventListener('click', function () {
        track('nostr');
        if (touch && canNative) { navigator.share({ title: title, text: title, url: url('nostr') }).catch(function () {}); return; }
        copyText(title + '\n\n' + url('nostr')).then(function () {
          toast(L.ui.nostrCopied, { label: L.ui.openPrimal, href: 'https://primal.net/home' });
        }).catch(function () { toast(L.ui.copyFailed); });
      });
      slot.appendChild(nb);
      var cb = el('button'); cb.type = 'button'; cb.setAttribute('aria-label', L.ui.copyLink); cb.title = L.ui.copyLink; cb.innerHTML = ICONS.copy;
      cb.addEventListener('click', function () {
        track('copy');
        copyText(url('copy')).then(function () { toast(L.ui.copied); }).catch(function () { toast(L.ui.copyFailed); });
      });
      slot.appendChild(cb);
      if (canNative && touch) {
        var mb = el('button'); mb.type = 'button'; mb.setAttribute('aria-label', L.ui.moreShare); mb.title = L.ui.moreShare; mb.innerHTML = ICONS.more;
        mb.addEventListener('click', function () { track('native'); navigator.share({ title: title, url: url('native') }).catch(function () {}); });
        slot.appendChild(mb);
      }
    });
  }

  function renderMore(posts, currentId) {
    var grid = $('moreGrid');
    posts.filter(function (p) { return p.id !== currentId; }).slice(0, 3).forEach(function (p) {
      var a = el('a', 'blog-card');
      a.href = ROOT + 'article.html?slug=' + encodeURIComponent(p.slug) + L.suffix;
      var src = imgOf(p);
      if (src) { var img = el('img'); img.src = src; img.loading = 'lazy'; img.alt = ''; a.appendChild(img); }
      var b = el('div', 'blog-card-body');
      var t = el('time', null, L.desks[inferDesk(p).id] + ' · ' + fmtDate(gmt(p)));
      b.appendChild(t);
      b.appendChild(el('h3', null, stripHtml(p.title.rendered)));
      b.appendChild(el('span', 'read', L.ui.readMore + ' →'));
      a.appendChild(b); grid.appendChild(a);
    });
    if (grid.children.length) $('moreDesk').hidden = false;
  }

  var slug = new URLSearchParams(location.search).get('slug') || HTML.getAttribute('data-slug');
  if (!slug) { showError(); return; }

  // WPML falls back to a cookie/session language when lang is missing, so
  // every request (English included) sends an explicit lang param.
  function fetchAndRender() {
    var lp = L.lang ? '&lang=' + L.lang : '';
    return fetch(L.api + '?slug=' + encodeURIComponent(slug) + '&_embed=wp:featuredmedia' + lp)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (posts) {
        if (!posts.length) return false;
        renderArticle(posts[0]);
        fetch(L.api + '?categories=' + L.category + '&per_page=4&_embed=wp:featuredmedia&orderby=date&order=desc' + lp)
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (recent) { renderMore(recent, posts[0].id); })
          .catch(function () {});
        return true;
      });
  }

  fetchAndRender().then(function (found) {
    if (found) return;
    // Not translated yet: fall back to the English original.
    if (L.lang !== 'en') {
      langCode = 'en'; L = LANGS.en; localizeChrome();
      return fetchAndRender().then(function (ok) { if (!ok) showError(); });
    }
    showError();
  }).catch(showError);
})();
