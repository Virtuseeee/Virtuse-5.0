/* Virtuse Brief subscribe pop-up on the story pages and article.html
   (article.js loads it; news.html deliberately has none). Opens after 6.5 s of visible time on the page.
   Never for subscribers (vb-api.js sets localStorage vb-brief-sub after any Brief signup) or
   readers coming from the email (utm_medium=email); after a dismissal not
   again for 14 days; at most once per session. Waits while the cookie banner
   is open. Styles are injected below (uses the Brief tokens from news/news.css),
   so a cached stylesheet never shows an unstyled dialog.
   ?brief_popup=1 ignores the stored flags (for testing). */
(function () {
  'use strict';
  var DELAY_MS = 6500, SNOOZE_DAYS = 14;
  var SUB_KEY = 'vb-brief-sub', DISMISS_KEY = 'vb-brief-pop-dismissed', SESSION_KEY = 'vb-brief-pop-shown';

  // Newsletter Worker client (vb-api.js), loaded on first use. The same loader
  // sits in every shared script that posts to the Worker; see vb-api.js.
  function vbApi() {
    if (window.VB_API) return Promise.resolve(window.VB_API);
    return window.VB_API_LOADING || (window.VB_API_LOADING = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = '/vb-api.js?v=1';
      s.onload = function () { if (window.VB_API) ok(window.VB_API); else no(new Error('vb-api.js')); };
      s.onerror = function () { window.VB_API_LOADING = null; no(new Error('vb-api.js')); };
      document.head.appendChild(s);
    }));
  }

  var T = {
    en: { title: 'Enjoying the Brief?', dek: 'Get the weekly issue in your inbox every Monday. Bitcoin-only. No tokens. No PR. Free.', email: 'Email address', btn: 'Subscribe', fine: 'Unsubscribe anytime.', no: 'No thanks', close: 'Close' },
    sk: { title: 'Páči sa vám Brief?', dek: 'Každý pondelok týždenný výber do vašej schránky. Iba Bitcoin. Žiadne tokeny. Žiadne PR. Zadarmo.', email: 'E-mailová adresa', btn: 'Odoberať', fine: 'Odhlásiť sa môžete kedykoľvek.', no: 'Nie, ďakujem', close: 'Zavrieť' },
    cs: { title: 'Líbí se vám Brief?', dek: 'Každé pondělí týdenní výběr do vaší schránky. Jen Bitcoin. Žádné tokeny. Žádné PR. Zdarma.', email: 'E-mailová adresa', btn: 'Odebírat', fine: 'Odhlásit se můžete kdykoli.', no: 'Ne, děkuji', close: 'Zavřít' },
    de: { title: 'Gefällt Ihnen der Brief?', dek: 'Jeden Montag die Wochenausgabe in Ihrem Postfach. Nur Bitcoin. Keine Token. Keine PR. Kostenlos.', email: 'E-Mail-Adresse', btn: 'Abonnieren', fine: 'Jederzeit abbestellbar.', no: 'Nein, danke', close: 'Schließen' },
    fr: { title: 'Le Brief vous plaît ?', dek: 'Chaque lundi, le numéro de la semaine dans votre boîte mail. 100 % Bitcoin. Pas de tokens. Pas de RP. Gratuit.', email: 'Adresse e-mail', btn: 'S’abonner', fine: 'Désabonnement à tout moment.', no: 'Non merci', close: 'Fermer' },
    es: { title: '¿Le gusta el Brief?', dek: 'Cada lunes, el número de la semana en su correo. Solo Bitcoin. Sin tokens. Sin publirreportajes. Gratis.', email: 'Correo electrónico', btn: 'Suscribirse', fine: 'Puede darse de baja cuando quiera.', no: 'No, gracias', close: 'Cerrar' },
    pl: { title: 'Podoba się Brief?', dek: 'W każdy poniedziałek nowe wydanie w skrzynce. Tylko Bitcoin. Bez tokenów. Bez PR-u. Za darmo.', email: 'Adres e-mail', btn: 'Zapisuję się', fine: 'Rezygnacja w dowolnym momencie.', no: 'Nie, dziękuję', close: 'Zamknij' },
    hu: { title: 'Tetszik a Brief?', dek: 'Minden hétfőn a heti szám a postafiókjában. Csak Bitcoin. Nincsenek tokenek. Nincs PR. Ingyenes.', email: 'E-mail-cím', btn: 'Feliratkozás', fine: 'Bármikor leiratkozhat.', no: 'Köszönöm, nem', close: 'Bezárás' },
    uk: { title: 'Подобається Brief?', dek: 'Щопонеділка новий випуск у вашій поштовій скриньці. Лише Біткоїн. Жодних токенів. Жодного PR. Безкоштовно.', email: 'Електронна пошта', btn: 'Підписатися', fine: 'Відписатися можна будь-коли.', no: 'Ні, дякую', close: 'Закрити' },
    ru: { title: 'Нравится Brief?', dek: 'Каждый понедельник еженедельный выпуск на вашу почту. Только Биткоин. Никаких токенов. Никакого PR. Бесплатно.', email: 'Электронная почта', btn: 'Подписаться', fine: 'Отписаться можно в любой момент.', no: 'Нет, спасибо', close: 'Закрыть' }
  };

  var params = new URLSearchParams(location.search);
  var force = params.get('brief_popup') === '1';
  if (!force && params.get('utm_medium') === 'email') return;
  try {
    if (!force) {
      if (localStorage.getItem(SUB_KEY) === '1') return;
      var t = +localStorage.getItem(DISMISS_KEY);
      if (t && Date.now() - t < SNOOZE_DAYS * 864e5) return;
      if (sessionStorage.getItem(SESSION_KEY)) return;
    }
  } catch (err) {}
  if (typeof HTMLDialogElement !== 'function' || document.querySelector('.brief-pop')) return;

  /* Story pages: article.js sets VB_LANG (Worker language) and VB_UI (form messages). */
  var lang = String(window.VB_LANG || document.documentElement.lang || 'en').slice(0, 2);
  var S = T[lang] || T.en;
  var source = document.documentElement.getAttribute('data-slug') !== null ? 'story_popup' : 'news_popup';

  function track(name) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, capture_source: source, page_lang: lang });
  }

  var TICK = 250, elapsed = 0;
  var timer = setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    elapsed += TICK;
    if (elapsed < DELAY_MS) return;
    if (document.querySelector('.vb-cc')) return; /* cookie banner open */
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT' && a.type === 'email') return; /* typing in a page form */
    clearInterval(timer);
    show();
  }, TICK);


  function injectCss() {
    if (document.getElementById('brief-pop-css')) return;
    var st = document.createElement('style');
    st.id = 'brief-pop-css';
    st.textContent = ".brief-pop {\n  width: min(460px, calc(100% - 32px));\n  max-width: none;\n  margin: auto;\n  padding: 28px 28px 22px;\n  border: 1px solid var(--line-strong);\n  border-radius: var(--radius-card);\n  background: var(--bg-card);\n  color: var(--text);\n  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);\n}\n.brief-pop {\n  opacity: 0;\n  transform: translateY(28px) scale(0.97);\n  transition: opacity 0.6s ease, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);\n}\n.brief-pop.is-in { opacity: 1; transform: none; }\n.brief-pop.is-out {\n  opacity: 0;\n  transform: translateY(12px) scale(0.98);\n  transition-duration: 0.35s, 0.35s;\n  transition-timing-function: ease-in, ease-in;\n}\n.brief-pop::backdrop {\n  background: rgba(0, 0, 0, 0.62);\n  -webkit-backdrop-filter: blur(3px);\n  backdrop-filter: blur(3px);\n  animation: briefPopFadeIn 0.7s ease both;\n}\n.brief-pop.is-out::backdrop { animation: briefPopFadeOut 0.35s ease-in both; }\n@keyframes briefPopFadeIn { from { opacity: 0; } to { opacity: 1; } }\n@keyframes briefPopFadeOut { from { opacity: 1; } to { opacity: 0; } }\n.brief-pop .desk-label { padding-right: 32px; }\n.brief-pop-x {\n  position: absolute;\n  top: 12px;\n  right: 12px;\n  width: 32px;\n  height: 32px;\n  border: 0;\n  background: transparent;\n  color: var(--text-faint);\n  font-size: 24px;\n  line-height: 1;\n  cursor: pointer;\n}\n.brief-pop-x:hover { color: var(--text); }\n.brief-pop-title {\n  margin: 4px 0 8px;\n  font-family: var(--font-display);\n  font-size: var(--t-head-card);\n  font-weight: 600;\n  line-height: var(--lh-head);\n  letter-spacing: -0.01em;\n}\n.brief-pop-dek {\n  margin: 0 0 18px;\n  font-size: var(--t-deck);\n  line-height: var(--lh-deck);\n  color: var(--text-muted);\n}\n.brief-pop .lenny-form { max-width: none; }\n.brief-pop-fine {\n  margin: 14px 0 0;\n  font-size: 12px;\n  color: var(--text-faint);\n}\n.brief-pop-no {\n  margin-left: 6px;\n  padding: 0;\n  border: 0;\n  background: none;\n  color: var(--text-muted);\n  font: inherit;\n  text-decoration: underline;\n  cursor: pointer;\n}\n.brief-pop-no:hover { color: var(--text); }\n@media (max-width: 480px) {\n  .brief-pop { padding: 24px 18px 18px; }\n  .brief-pop .lenny-form input[type=\"email\"] { border-right: 1px solid var(--line-strong); }\n  .brief-pop .lenny-form .btn { width: 100%; margin-top: 8px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .brief-pop, .brief-pop.is-out { transition: none; transform: none; }\n  .brief-pop::backdrop, .brief-pop.is-out::backdrop { animation: none; }\n}";
    document.head.appendChild(st);
  }

  function show() {
    injectCss();
    var dlg = document.createElement('dialog');
    dlg.className = 'brief-pop';
    dlg.setAttribute('aria-labelledby', 'briefPopTitle');
    dlg.innerHTML =
      '<button class="brief-pop-x" type="button">&times;</button>' +
      '<p class="desk-label">Virtuse Brief</p>' +
      '<h2 class="brief-pop-title" id="briefPopTitle"></h2>' +
      '<p class="brief-pop-dek"></p>' +
      '<form class="lenny-form brief-pop-form" novalidate>' +
        '<label class="sr-only" for="briefPopEmail"></label>' +
        '<input id="briefPopEmail" type="email" name="email" required autocomplete="email">' +
        '<input type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true" class="hp">' +
        '<button class="btn" type="submit"></button>' +
        '<p class="subscribe-msg" role="status" aria-live="polite"></p>' +
      '</form>' +
      '<p class="brief-pop-fine"><span></span> <button class="brief-pop-no" type="button"></button></p>';
    dlg.querySelector('.brief-pop-x').setAttribute('aria-label', S.close);
    dlg.querySelector('.brief-pop-title').textContent = S.title;
    dlg.querySelector('.brief-pop-dek').textContent = S.dek;
    dlg.querySelector('label').textContent = S.email;
    dlg.querySelector('#briefPopEmail').placeholder = S.email;
    dlg.querySelector('button[type="submit"]').textContent = S.btn;
    dlg.querySelector('.brief-pop-fine span').textContent = S.fine;
    dlg.querySelector('.brief-pop-no').textContent = S.no;
    document.body.appendChild(dlg);

    var done = false, closing = false;
    function close(dismissed) {
      if (dismissed && !done) {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (err) {}
        track('brief_popup_dismiss');
      }
      if (closing) return;
      closing = true;
      dlg.classList.remove('is-in');
      dlg.classList.add('is-out');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setTimeout(function () {
        if (dlg.open) dlg.close();
        dlg.remove();
      }, reduce ? 0 : 360);
    }

    var form = dlg.querySelector('form'), msg = form.querySelector('.subscribe-msg');
    var btn = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ui = window.VB_UI || {};
      var email = form.elements.email.value.trim();
      msg.textContent = ''; msg.className = 'subscribe-msg';
      if (!email) { msg.textContent = ui.emailReq || 'Email is required.'; msg.classList.add('err'); return; }
      btn.disabled = true; btn.textContent = ui.sending || 'Sending';
      var hp = form.elements.website.value;
      vbApi().then(function (api) {
        return api.subscribe({ email: email, hp: hp, lang: window.VB_LANG || lang });
      }).then(function (r) {
        if (r.ok) {
          done = true;
          form.reset();
          msg.textContent = ui.subOk || 'You are on the list. Check your inbox.'; msg.classList.add('ok');
          track('brief_popup_submit');
          setTimeout(function () { close(false); }, 2500);
        } else {
          msg.textContent = (r.data && r.data.error) || ui.subErr || 'Could not join the list. Try again.'; msg.classList.add('err');
        }
      }).catch(function () {
        msg.textContent = ui.netErr || 'Network error. Try again.'; msg.classList.add('err');
      }).then(function () { btn.disabled = false; btn.textContent = S.btn; });
    });

    dlg.querySelector('.brief-pop-x').addEventListener('click', function () { close(true); });
    dlg.querySelector('.brief-pop-no').addEventListener('click', function () { close(true); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(true); }); /* Esc */
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(true); }); /* backdrop */

    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) {}
    dlg.showModal();
    /* Force a style flush so the hidden start state applies first, then transition in.
       (No requestAnimationFrame: it can stall, which would leave the dialog invisible.) */
    void dlg.offsetWidth;
    dlg.classList.add('is-in');
    track('brief_popup_shown');
  }
})();
