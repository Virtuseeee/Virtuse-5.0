/* partner-capture.js: after a click to a partner (partner-click.js fires
   "vb:partner-click"), show a small bottom panel in this tab offering the
   partner's registration steps by email. The partner link itself is never
   blocked or delayed; it opens as before.

   Sends ids only to the newsletter Worker (POST /send, kind "checklist"); the
   Worker writes the email from data/partner-checklists.json. Nothing is stored
   unless the Brief box is ticked.

   Off until the privacy-policy text is approved: shown only when the page has
   <meta name="vb-capture" content="on">, or with ?capture=1 for testing.
   At most once per browser session, and never again after it was closed. */
(function () {
  'use strict';
  if (window.top !== window.self) return;

  var SEND_URL = 'https://virtuse-newsletter.virtuse-ai.workers.dev/send';
  var SEEN = 'vb-pc-seen';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // partner name (as partner-click.js reports it) -> Worker partner id.
  // Only partners with verified steps in data/partner-checklists.json.
  var IDS = {
    '21bitcoin': '21bitcoin', 'ByBit EU': 'bybit-eu', 'Kraken': 'kraken', 'Crypto.com': 'crypto-com',
    'Invity': 'invity', 'Blockstream': 'blockstream', 'Ledger': 'ledger', 'Trezor': 'trezor',
    'BitGo': 'bitgo', 'Coinbase': 'coinbase-institutional', 'Sygnum': 'sygnum', 'Firefish': 'firefish',
    'Koinly': 'koinly', 'Blockpit': 'blockpit', 'CoinTracking': 'cointracking', 'Divly': 'divly',
    'Coinrule': 'coinrule', 'Cryptohopper': 'cryptohopper', 'RevenueBot': 'revenuebot',
    'Abundant Mines': 'abundant-mines', 'OneMiners': 'oneminers', 'PowerMining': 'power-mining'
  };

  var T = {
    en: { title: 'While you sign up at {0}', intro: 'We can email you the registration steps and what to do next. One email; we add you to no list unless you tick the box.', close: 'Close', ph: 'Your email', send: 'Send', sending: 'Sending…', brief: 'Also send me the Virtuse Brief every Monday (unsubscribe anytime).', sent: 'Sent. It should be in your inbox within a minute.', invalid: 'Please enter a valid email address.', limited: 'Too many attempts. Please try again later.', error: 'Something went wrong. Please try again.' },
    sk: { title: 'Kým sa registrujete u {0}', intro: 'Pošleme vám emailom postup registrácie a čo urobiť potom. Jeden email; do žiadneho zoznamu vás nepridáme, ak nezaškrtnete políčko.', close: 'Zavrieť', ph: 'Váš email', send: 'Odoslať', sending: 'Odosielam…', brief: 'Posielajte mi aj Virtuse Brief každý pondelok (odhlásenie kedykoľvek).', sent: 'Odoslané. Do minúty by mal byť vo vašej schránke.', invalid: 'Zadajte platnú emailovú adresu.', limited: 'Príliš veľa pokusov. Skúste to neskôr.', error: 'Niečo sa pokazilo. Skúste to znova.' },
    cs: { title: 'Než se zaregistrujete u {0}', intro: 'Pošleme vám emailem postup registrace a co udělat potom. Jeden email; do žádného seznamu vás nepřidáme, pokud nezaškrtnete políčko.', close: 'Zavřít', ph: 'Váš email', send: 'Odeslat', sending: 'Odesílám…', brief: 'Posílejte mi také Virtuse Brief každé pondělí (odhlášení kdykoli).', sent: 'Odesláno. Do minuty by měl být ve vaší schránce.', invalid: 'Zadejte platnou emailovou adresu.', limited: 'Příliš mnoho pokusů. Zkuste to později.', error: 'Něco se pokazilo. Zkuste to znovu.' },
    de: { title: 'Während Sie sich bei {0} registrieren', intro: 'Wir senden Ihnen die Registrierungsschritte und die nächsten Schritte per E-Mail. Eine E-Mail; wir tragen Sie in keine Liste ein, außer Sie setzen das Häkchen.', close: 'Schließen', ph: 'Ihre E-Mail-Adresse', send: 'Senden', sending: 'Wird gesendet…', brief: 'Senden Sie mir auch jeden Montag den Virtuse Brief (jederzeit abbestellbar).', sent: 'Gesendet. Die E-Mail sollte in einer Minute in Ihrem Posteingang sein.', invalid: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.', limited: 'Zu viele Versuche. Bitte versuchen Sie es später erneut.', error: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.' },
    fr: { title: 'Pendant votre inscription chez {0}', intro: 'Nous pouvons vous envoyer par e-mail les étapes d’inscription et la suite. Un seul e-mail ; nous ne vous ajoutons à aucune liste, sauf si vous cochez la case.', close: 'Fermer', ph: 'Votre adresse e-mail', send: 'Envoyer', sending: 'Envoi…', brief: 'Envoyez-moi aussi le Virtuse Brief chaque lundi (désabonnement à tout moment).', sent: 'Envoyé. L’e-mail devrait arriver dans votre boîte de réception d’ici une minute.', invalid: 'Veuillez saisir une adresse e-mail valide.', limited: 'Trop de tentatives. Veuillez réessayer plus tard.', error: 'Une erreur s’est produite. Veuillez réessayer.' },
    es: { title: 'Mientras se registra en {0}', intro: 'Le enviamos por correo los pasos de registro y qué hacer después. Un solo correo; no le añadimos a ninguna lista salvo que marque la casilla.', close: 'Cerrar', ph: 'Su correo electrónico', send: 'Enviar', sending: 'Enviando…', brief: 'Envíenme también el Virtuse Brief cada lunes (puede darse de baja cuando quiera).', sent: 'Enviado. Debería llegar a su bandeja de entrada en un minuto.', invalid: 'Introduzca una dirección de correo electrónico válida.', limited: 'Demasiados intentos. Inténtelo de nuevo más tarde.', error: 'Algo ha salido mal. Inténtelo de nuevo.' },
    pl: { title: 'Rejestracja w serwisie {0}', intro: 'Wyślemy e-mailem kroki rejestracji i to, co zrobić dalej. Jeden e-mail; nie dodajemy Państwa do żadnej listy, chyba że zaznaczą Państwo pole.', close: 'Zamknij', ph: 'Adres e-mail', send: 'Wyślij', sending: 'Wysyłanie…', brief: 'Chcę też otrzymywać Virtuse Brief w każdy poniedziałek (rezygnacja w dowolnym momencie).', sent: 'Wysłano. E-mail powinien dotrzeć do skrzynki w ciągu minuty.', invalid: 'Proszę podać prawidłowy adres e-mail.', limited: 'Zbyt wiele prób. Proszę spróbować później.', error: 'Coś poszło nie tak. Proszę spróbować ponownie.' },
    hu: { title: 'Regisztráció: {0}', intro: 'E-mailben elküldjük a regisztráció lépéseit és a további teendőket. Egyetlen e-mail; semmilyen listára nem vesszük fel, hacsak be nem jelöli a négyzetet.', close: 'Bezárás', ph: 'E-mail-cím', send: 'Elküldöm', sending: 'Küldés…', brief: 'Kérem a Virtuse Briefet is minden hétfőn (bármikor leiratkozhat).', sent: 'Elküldve. Egy percen belül meg kell érkeznie a postafiókjába.', invalid: 'Adjon meg egy érvényes e-mail-címet.', limited: 'Túl sok próbálkozás. Próbálja újra később.', error: 'Hiba történt. Próbálja újra.' },
    uk: { title: 'Реєстрація: {0}', intro: 'Надішлемо вам електронною поштою кроки реєстрації та що робити далі. Один лист; ми не додаємо вас до жодного списку, якщо ви не позначите поле.', close: 'Закрити', ph: 'Ваша електронна пошта', send: 'Надіслати', sending: 'Надсилання…', brief: 'Також надсилайте мені Virtuse Brief щопонеділка (відписатися можна будь-коли).', sent: 'Надіслано. Лист має надійти у вашу скриньку протягом хвилини.', invalid: 'Введіть дійсну адресу електронної пошти.', limited: 'Забагато спроб. Спробуйте пізніше.', error: 'Щось пішло не так. Спробуйте ще раз.' },
    ru: { title: 'Регистрация: {0}', intro: 'Пришлём вам по электронной почте шаги регистрации и что делать дальше. Одно письмо; мы не добавляем вас ни в какие списки, если вы не отметите поле.', close: 'Закрыть', ph: 'Ваша электронная почта', send: 'Отправить', sending: 'Отправка…', brief: 'Также присылайте мне Virtuse Brief каждый понедельник (отписаться можно в любой момент).', sent: 'Отправлено. Письмо придёт в ваш ящик в течение минуты.', invalid: 'Введите действительный адрес электронной почты.', limited: 'Слишком много попыток. Попробуйте позже.', error: 'Что-то пошло не так. Попробуйте ещё раз.' }
  };

  function enabled() {
    try {
      var m = document.querySelector('meta[name="vb-capture"]');
      return (m && m.getAttribute('content') === 'on') || /[?&]capture=1(&|$)/.test(location.search);
    } catch (e) { return false; }
  }
  function seen() { try { return sessionStorage.getItem(SEEN) === '1'; } catch (e) { return false; } }
  function markSeen() { try { sessionStorage.setItem(SEEN, '1'); } catch (e) {} }
  function push(event, extra) {
    try {
      var o = { event: event, capture_source: 'partner_click' };
      for (var k in extra) o[k] = extra[k];
      (window.dataLayer = window.dataLayer || []).push(o);
    } catch (e) {}
  }

  var CSS =
    '.vb-pc{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147482000;max-width:520px;margin:0 auto;' +
    'background:#141414;color:#e6edf3;border:1px solid rgba(255,255,255,.12);border-radius:12px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.45);padding:18px 20px;font:14px/1.5 Inter,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}' +
    '.vb-pc *{box-sizing:border-box}' +
    '.vb-pc h2{margin:0 28px 6px 0;font-size:15px;font-weight:700;color:#e6edf3;letter-spacing:0}' +
    '.vb-pc p{margin:0;color:#8b949e;font-size:13px}' +
    '.vb-pc-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#8b949e;font-size:20px;line-height:32px;cursor:pointer}' +
    '.vb-pc-x:hover{color:#e6edf3;background:rgba(255,255,255,.06)}' +
    '.vb-pc-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}' +
    '.vb-pc-row input{flex:1 1 180px;min-width:0;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:#08090a;color:#e6edf3;padding:9px 12px;font:inherit;font-size:14px}' +
    '.vb-pc-row input:focus{outline:none;border-color:rgba(255,255,255,.4)}' +
    '.vb-pc-row button{border:0;border-radius:10px;background:#e6edf3;color:#08090a;padding:9px 16px;font:inherit;font-size:14px;font-weight:600;cursor:pointer}' +
    '.vb-pc-row button:disabled{opacity:.6}' +
    '.vb-pc label{display:flex;gap:8px;align-items:flex-start;margin-top:10px;color:#8b949e;font-size:12px;cursor:pointer}' +
    '.vb-pc label input{margin-top:2px;accent-color:#e6edf3}' +
    '.vb-pc-msg{margin-top:8px;font-size:12px;color:#e6edf3}' +
    '.vb-pc-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}';

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function show(name, id) {
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    var s = T[lang] || T.en;
    if (!document.getElementById('vb-pc-css')) {
      var st = el('style', { id: 'vb-pc-css' }); st.textContent = CSS; document.head.appendChild(st);
    }
    var box = el('section', { 'class': 'vb-pc', role: 'dialog', 'aria-live': 'polite', 'aria-label': s.title.replace('{0}', name) });
    var x = el('button', { type: 'button', 'class': 'vb-pc-x', 'aria-label': s.close }, '×');
    var h = el('h2', {}, s.title.replace('{0}', name));
    var p = el('p', {}, s.intro);
    var form = el('form', { novalidate: '' });
    var row = el('div', { 'class': 'vb-pc-row' });
    var input = el('input', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: s.ph, 'aria-label': s.ph });
    var btn = el('button', { type: 'submit' }, s.send);
    var hp = el('input', { type: 'text', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', 'class': 'vb-pc-hp' });
    var lab = el('label');
    var cb = el('input', { type: 'checkbox' });
    lab.appendChild(cb); lab.appendChild(document.createTextNode(s.brief));
    var msg = el('div', { 'class': 'vb-pc-msg', role: 'alert' });
    row.appendChild(input); row.appendChild(btn);
    form.appendChild(row); form.appendChild(hp); form.appendChild(lab); form.appendChild(msg);
    box.appendChild(x); box.appendChild(h); box.appendChild(p); box.appendChild(form);
    document.body.appendChild(box);
    markSeen();
    push('capture_shown', { partner: name });

    x.addEventListener('click', function () {
      box.parentNode && box.parentNode.removeChild(box);
      push('capture_dismiss', { partner: name });
    });

    var busy = false;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) { msg.textContent = s.invalid; return; }
      busy = true; btn.disabled = true; btn.textContent = s.sending; msg.textContent = '';
      fetch(SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, hp: hp.value, lang: lang, kind: 'checklist', source: 'partner_click', payload: { partner: id }, brief: cb.checked })
      }).then(function (r) {
        if (r.ok) {
          form.parentNode.removeChild(form);
          p.textContent = s.sent;
          push('capture_submit', { partner: name, capture_brief: cb.checked });
          return;
        }
        msg.textContent = r.status === 429 ? s.limited : r.status === 400 ? s.invalid : s.error;
        busy = false; btn.disabled = false; btn.textContent = s.send;
      }).catch(function () {
        msg.textContent = s.error; busy = false; btn.disabled = false; btn.textContent = s.send;
      });
    });
  }

  document.addEventListener('vb:partner-click', function (e) {
    var d = e.detail || {};
    var id = IDS[d.partner];
    if (!id || !enabled() || seen() || document.querySelector('.vb-pc')) return;
    // Let the partner tab open first; this tab stays where it is.
    setTimeout(function () { show(d.partner, id); }, 400);
  });
})();
