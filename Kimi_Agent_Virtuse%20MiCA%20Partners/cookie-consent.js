/* Virtuse cookie consent banner (Google Consent Mode v2, advanced mode).
 *
 * Every page that loads GTM carries an inline <head> snippet right before the
 * GTM loader that sets all consent to "denied" by default and re-applies a
 * stored choice. This file only draws the banner/settings dialog and records
 * the visitor's choice.
 *
 * Storage: localStorage "vb-consent" = {v:1, a:<analytics>, m:<marketing>, t:<ms>}.
 * A choice older than 12 months is asked again. Anything with
 * [data-cookie-settings] reopens the settings dialog; a "Cookie settings" link
 * is added to the page footer automatically.
 */
(function () {
  'use strict';
  if (window.top !== window.self) return; // inside the Concierge bubble iframe: the parent page asks
  if (window.__vbConsentLoaded) return;
  window.__vbConsentLoaded = true;

  var KEY = 'vb-consent';
  var YEAR = 365 * 24 * 3600 * 1000;

  var T = {
    en: {
      title: 'Cookies on Virtuse',
      text: 'With your consent, we use cookies to measure traffic (Google Analytics) and advertising (Google Ads). Necessary storage, such as your language, always works. You can change your choice at any time.',
      policy: 'Privacy policy', accept: 'Accept all', reject: 'Reject all', settings: 'Settings', save: 'Save choices',
      nec: 'Necessary', necD: 'Language, theme and your cookie choice.', on: 'Always on',
      ana: 'Analytics', anaD: 'Google Analytics shows us which pages are useful. We never sell data.',
      mkt: 'Marketing', mktD: 'Google Ads measurement and remarketing.',
      link: 'Cookie settings'
    },
    sk: {
      title: 'Cookies na Virtuse',
      text: 'S vaším súhlasom používame cookies na meranie návštevnosti (Google Analytics) a reklamy (Google Ads). Nevyhnutné úložisko, napríklad jazyk stránky, funguje vždy. Voľbu môžete kedykoľvek zmeniť.',
      policy: 'Ochrana súkromia', accept: 'Prijať všetko', reject: 'Odmietnuť všetko', settings: 'Nastavenia', save: 'Uložiť voľbu',
      nec: 'Nevyhnutné', necD: 'Jazyk, vzhľad a vaša voľba cookies.', on: 'Vždy zapnuté',
      ana: 'Analytika', anaD: 'Google Analytics nám ukazuje, ktoré stránky sú užitočné. Údaje nikdy nepredávame.',
      mkt: 'Marketing', mktD: 'Meranie a remarketing Google Ads.',
      link: 'Nastavenia cookies'
    },
    cs: {
      title: 'Cookies na Virtuse',
      text: 'S vaším souhlasem používáme cookies k měření návštěvnosti (Google Analytics) a reklamy (Google Ads). Nezbytné úložiště, například jazyk stránky, funguje vždy. Volbu můžete kdykoli změnit.',
      policy: 'Ochrana soukromí', accept: 'Přijmout vše', reject: 'Odmítnout vše', settings: 'Nastavení', save: 'Uložit volbu',
      nec: 'Nezbytné', necD: 'Jazyk, vzhled a vaše volba cookies.', on: 'Vždy zapnuto',
      ana: 'Analytika', anaD: 'Google Analytics nám ukazuje, které stránky jsou užitečné. Údaje nikdy neprodáváme.',
      mkt: 'Marketing', mktD: 'Měření a remarketing Google Ads.',
      link: 'Nastavení cookies'
    },
    de: {
      title: 'Cookies auf Virtuse',
      text: 'Mit Ihrer Einwilligung verwenden wir Cookies, um Besuche (Google Analytics) und Werbung (Google Ads) zu messen. Notwendige Speicherung, etwa Ihre Sprache, ist immer aktiv. Sie können Ihre Auswahl jederzeit ändern.',
      policy: 'Datenschutzerklärung', accept: 'Alle akzeptieren', reject: 'Alle ablehnen', settings: 'Einstellungen', save: 'Auswahl speichern',
      nec: 'Notwendig', necD: 'Sprache, Darstellung und Ihre Cookie-Auswahl.', on: 'Immer aktiv',
      ana: 'Analyse', anaD: 'Google Analytics zeigt uns, welche Seiten hilfreich sind. Wir verkaufen keine Daten.',
      mkt: 'Marketing', mktD: 'Messung und Remarketing über Google Ads.',
      link: 'Cookie-Einstellungen'
    },
    fr: {
      title: 'Cookies sur Virtuse',
      text: "Avec votre accord, nous utilisons des cookies pour mesurer l'audience (Google Analytics) et la publicité (Google Ads). Le stockage nécessaire, comme votre langue, fonctionne toujours. Vous pouvez modifier votre choix à tout moment.",
      policy: 'Politique de confidentialité', accept: 'Tout accepter', reject: 'Tout refuser', settings: 'Paramètres', save: 'Enregistrer mes choix',
      nec: 'Nécessaires', necD: 'Langue, thème et votre choix de cookies.', on: 'Toujours actifs',
      ana: "Mesure d'audience", anaD: 'Google Analytics nous montre quelles pages sont utiles. Nous ne vendons aucune donnée.',
      mkt: 'Marketing', mktD: 'Mesure et remarketing Google Ads.',
      link: 'Paramètres des cookies'
    },
    es: {
      title: 'Cookies en Virtuse',
      text: 'Con su consentimiento, usamos cookies para medir el tráfico (Google Analytics) y la publicidad (Google Ads). El almacenamiento necesario, como su idioma, funciona siempre. Puede cambiar su elección en cualquier momento.',
      policy: 'Política de privacidad', accept: 'Aceptar todo', reject: 'Rechazar todo', settings: 'Configuración', save: 'Guardar selección',
      nec: 'Necesarias', necD: 'Idioma, tema y su elección de cookies.', on: 'Siempre activas',
      ana: 'Analítica', anaD: 'Google Analytics nos muestra qué páginas son útiles. Nunca vendemos datos.',
      mkt: 'Marketing', mktD: 'Medición y remarketing de Google Ads.',
      link: 'Configuración de cookies'
    },
    pl: {
      title: 'Pliki cookie w Virtuse',
      text: 'Za Państwa zgodą używamy plików cookie do pomiaru ruchu (Google Analytics) i reklam (Google Ads). Niezbędne przechowywanie, np. język strony, działa zawsze. Wybór można zmienić w dowolnym momencie.',
      policy: 'Polityka prywatności', accept: 'Akceptuj wszystkie', reject: 'Odrzuć wszystkie', settings: 'Ustawienia', save: 'Zapisz wybór',
      nec: 'Niezbędne', necD: 'Język, motyw i wybór dotyczący plików cookie.', on: 'Zawsze włączone',
      ana: 'Analityka', anaD: 'Google Analytics pokazuje nam, które strony są przydatne. Nigdy nie sprzedajemy danych.',
      mkt: 'Marketing', mktD: 'Pomiar i remarketing Google Ads.',
      link: 'Ustawienia plików cookie'
    },
    hu: {
      title: 'Sütik a Virtuse oldalon',
      text: 'Az Ön hozzájárulásával sütiket használunk a látogatottság (Google Analytics) és a hirdetések (Google Ads) mérésére. A szükséges tárolás, például a nyelv, mindig működik. Döntését bármikor módosíthatja.',
      policy: 'Adatvédelmi szabályzat', accept: 'Összes elfogadása', reject: 'Összes elutasítása', settings: 'Beállítások', save: 'Választás mentése',
      nec: 'Szükséges', necD: 'Nyelv, megjelenés és a sütikre vonatkozó döntése.', on: 'Mindig aktív',
      ana: 'Analitika', anaD: 'A Google Analytics megmutatja, mely oldalak hasznosak. Adatot soha nem értékesítünk.',
      mkt: 'Marketing', mktD: 'Google Ads mérés és remarketing.',
      link: 'Sütibeállítások'
    },
    uk: {
      title: 'Файли cookie на Virtuse',
      text: 'З вашої згоди ми використовуємо файли cookie для вимірювання відвідуваності (Google Analytics) і реклами (Google Ads). Необхідне зберігання, наприклад мова сайту, працює завжди. Ви можете будь-коли змінити свій вибір.',
      policy: 'Політика конфіденційності', accept: 'Прийняти всі', reject: 'Відхилити всі', settings: 'Налаштування', save: 'Зберегти вибір',
      nec: 'Необхідні', necD: 'Мова, тема і ваш вибір щодо cookie.', on: 'Завжди увімкнені',
      ana: 'Аналітика', anaD: 'Google Analytics показує нам, які сторінки корисні. Ми ніколи не продаємо дані.',
      mkt: 'Маркетинг', mktD: 'Вимірювання і ремаркетинг Google Ads.',
      link: 'Налаштування cookie'
    },
    ru: {
      title: 'Файлы cookie на Virtuse',
      text: 'С вашего согласия мы используем файлы cookie для измерения посещаемости (Google Analytics) и рекламы (Google Ads). Необходимое хранение, например язык сайта, работает всегда. Вы можете изменить свой выбор в любое время.',
      policy: 'Политика конфиденциальности', accept: 'Принять все', reject: 'Отклонить все', settings: 'Настройки', save: 'Сохранить выбор',
      nec: 'Необходимые', necD: 'Язык, тема и ваш выбор по cookie.', on: 'Всегда включены',
      ana: 'Аналитика', anaD: 'Google Analytics показывает нам, какие страницы полезны. Мы никогда не продаём данные.',
      mkt: 'Маркетинг', mktD: 'Измерение и ремаркетинг Google Ads.',
      link: 'Настройки cookie'
    }
  };

  var lang = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase();
  if (!T[lang]) lang = 'en';
  var S = T[lang];
  var policyHref = lang === 'en' ? '/privacy-policy.html#cookies' : '/' + lang + '/privacy-policy.html#cookies';

  function read() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY));
      if (c && c.v === 1 && Date.now() - c.t < YEAR) return c;
    } catch (e) {}
    return null;
  }

  function gtag() { (window.dataLayer = window.dataLayer || []).push(arguments); }

  function apply(a, m) {
    var g = function (x) { return x ? 'granted' : 'denied'; };
    gtag('consent', 'update', {
      analytics_storage: g(a),
      ad_storage: g(m),
      ad_user_data: g(m),
      ad_personalization: g(m)
    });
    (window.dataLayer = window.dataLayer || []).push({
      event: 'consent_update', consent_analytics: !!a, consent_marketing: !!m
    });
  }

  // Withdrawing consent also removes cookies set while it was granted.
  function clearCookies(re) {
    var host = location.hostname.split('.');
    var domains = [''];
    for (var i = 0; i < host.length - 1; i++) domains.push('.' + host.slice(i).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (!re.test(n)) return;
      domains.forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }

  function save(a, m) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, a: !!a, m: !!m, t: Date.now() })); } catch (e) {}
    if (!a) clearCookies(/^(_ga|_gid|_gat)/);
    if (!m) clearCookies(/^(_gcl|_gac)/);
    apply(a, m);
    close();
  }

  var CSS =
    '.vb-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:760px;margin:0 auto;' +
    'background:#141414;color:#e6edf3;border:1px solid rgba(255,255,255,.12);border-radius:12px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.45);padding:20px 22px;font:14px/1.55 Inter,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'text-align:left;-webkit-font-smoothing:antialiased}' +
    '.vb-cc *{box-sizing:border-box}' +
    '.vb-cc h2{margin:0 0 6px;font-size:16px;font-weight:700;color:#e6edf3;letter-spacing:0}' +
    '.vb-cc p{margin:0;color:#8b949e;font-size:14px}' +
    '.vb-cc a{color:#e6edf3;text-decoration:underline;text-underline-offset:2px}' +
    '.vb-cc-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}' +
    '.vb-cc button{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border-radius:8px;padding:10px 16px;' +
    '-webkit-appearance:none;appearance:none;line-height:1.2}' +
    '.vb-cc-primary{background:#e6edf3;color:#08090a;border:1px solid #e6edf3}' +
    '.vb-cc-secondary{background:transparent;color:#e6edf3;border:1px solid rgba(255,255,255,.24)}' +
    '.vb-cc-secondary:hover{border-color:rgba(255,255,255,.5)}' +
    '.vb-cc-primary:hover{opacity:.9}' +
    '.vb-cc button:focus-visible,.vb-cc input:focus-visible+span{outline:2px solid #f7931a;outline-offset:2px}' +
    '.vb-cc-cats{margin-top:14px;border-top:1px solid rgba(255,255,255,.08)}' +
    '.vb-cc-cat{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}' +
    '.vb-cc-cat strong{display:block;color:#e6edf3;font-size:14px}' +
    '.vb-cc-cat small{display:block;color:#8b949e;font-size:13px;margin-top:2px}' +
    '.vb-cc-always{color:#8b949e;font-size:12px;white-space:nowrap;padding-top:2px}' +
    '.vb-cc-sw{position:relative;flex:none;width:40px;height:22px;margin-top:2px}' +
    '.vb-cc-sw input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:1}' +
    '.vb-cc-sw span{position:absolute;inset:0;border-radius:22px;background:rgba(255,255,255,.16);transition:background .2s}' +
    '.vb-cc-sw span:after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#e6edf3;transition:transform .2s}' +
    '.vb-cc-sw input:checked+span{background:#f7931a}' +
    '.vb-cc-sw input:checked+span:after{transform:translateX(18px)}' +
    '.vb-cc-link{background:none;border:0;padding:0;margin:0 0 0 16px;font:inherit;font-size:inherit;color:inherit;' +
    'opacity:.8;text-decoration:underline;text-underline-offset:2px;cursor:pointer;-webkit-appearance:none;appearance:none}' +
    '.vb-cc-link:hover{opacity:1}' +
    '.cookie-settings-btn{font:inherit;font-weight:600;cursor:pointer;margin-top:12px;padding:9px 16px;border-radius:8px;' +
    'background:transparent;color:inherit;border:1px solid currentColor;-webkit-appearance:none;appearance:none}' +
    '@media (max-width:560px){.vb-cc{left:8px;right:8px;bottom:8px;padding:18px 16px;max-height:calc(100vh - 16px);overflow-y:auto}' +
    '.vb-cc-row button{flex:1 1 100%}}' +
    '@media (prefers-reduced-motion:reduce){.vb-cc-sw span,.vb-cc-sw span:after{transition:none}}';

  var box = null;
  var lastFocus = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function injectCss() {
    if (document.getElementById('vb-cc-css')) return;
    var st = document.createElement('style');
    st.id = 'vb-cc-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function close() {
    if (box) { box.parentNode && box.parentNode.removeChild(box); box = null; }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
  }

  function open(showSettings) {
    injectCss();
    close();
    lastFocus = document.activeElement;
    var c = read() || { a: false, m: false };
    box = document.createElement('div');
    box.className = 'vb-cc';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'false');
    box.setAttribute('aria-labelledby', 'vb-cc-title');
    box.setAttribute('lang', lang);

    var html =
      '<h2 id="vb-cc-title">' + esc(S.title) + '</h2>' +
      '<p>' + esc(S.text) + ' <a href="' + policyHref + '">' + esc(S.policy) + '</a></p>';

    if (showSettings) {
      html +=
        '<div class="vb-cc-cats">' +
        '<div class="vb-cc-cat"><div><strong>' + esc(S.nec) + '</strong><small>' + esc(S.necD) + '</small></div>' +
        '<span class="vb-cc-always">' + esc(S.on) + '</span></div>' +
        '<label class="vb-cc-cat"><div><strong>' + esc(S.ana) + '</strong><small>' + esc(S.anaD) + '</small></div>' +
        '<span class="vb-cc-sw"><input type="checkbox" id="vb-cc-a"' + (c.a ? ' checked' : '') + ' aria-label="' + esc(S.ana) + '"><span></span></span></label>' +
        '<label class="vb-cc-cat"><div><strong>' + esc(S.mkt) + '</strong><small>' + esc(S.mktD) + '</small></div>' +
        '<span class="vb-cc-sw"><input type="checkbox" id="vb-cc-m"' + (c.m ? ' checked' : '') + ' aria-label="' + esc(S.mkt) + '"><span></span></span></label>' +
        '</div>' +
        '<div class="vb-cc-row">' +
        '<button type="button" class="vb-cc-secondary" data-vb="reject">' + esc(S.reject) + '</button>' +
        '<button type="button" class="vb-cc-secondary" data-vb="save">' + esc(S.save) + '</button>' +
        '<button type="button" class="vb-cc-primary" data-vb="accept">' + esc(S.accept) + '</button>' +
        '</div>';
    } else {
      html +=
        '<div class="vb-cc-row">' +
        '<button type="button" class="vb-cc-secondary" data-vb="reject">' + esc(S.reject) + '</button>' +
        '<button type="button" class="vb-cc-secondary" data-vb="settings">' + esc(S.settings) + '</button>' +
        '<button type="button" class="vb-cc-primary" data-vb="accept">' + esc(S.accept) + '</button>' +
        '</div>';
    }
    box.innerHTML = html;
    box.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-vb]') : null;
      if (!b) return;
      var act = b.getAttribute('data-vb');
      if (act === 'accept') save(true, true);
      else if (act === 'reject') save(false, false);
      else if (act === 'settings') open(true);
      else if (act === 'save') save(box.querySelector('#vb-cc-a').checked, box.querySelector('#vb-cc-m').checked);
    });
    document.body.appendChild(box);
    if (showSettings) {
      var first = box.querySelector('#vb-cc-a');
      if (first) first.focus();
    }
  }

  function addFooterLink() {
    if (document.querySelector('.vb-cc-link')) return;
    var host = document.querySelector('.footer-bottom') || document.querySelector('.footer-links') ||
      document.querySelector('footer');
    if (!host) return;
    injectCss();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'vb-cc-link';
    b.setAttribute('data-cookie-settings', '');
    b.textContent = S.link;
    var p = host.querySelector('p');
    (p || host).appendChild(b);
  }

  function init() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (!t) return;
      e.preventDefault();
      open(true);
    });
    addFooterLink();
    if (document.querySelector('[data-cookie-settings]')) injectCss();
    if (!read()) open(false);
  }

  window.VirtuseConsent = { open: function () { open(true); }, get: read };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
