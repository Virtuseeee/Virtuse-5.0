/* The withdrawal function (withdrawal.html, sk/withdrawal.html): Slovak Act 108/2024 § 20a.
   First button opens the form, second confirms; POST /verdict/withdraw sends the statement
   to Virtuse and the confirmation to the consumer. Plain ES5 like the rest of the site. */
(function () {
  'use strict';
  var LANG = (document.documentElement.lang || 'en').slice(0, 2) === 'sk' ? 'sk' : 'en';
  var T = {
    en: {
      name: 'Please enter your name.', email: 'Please enter a valid email address.', wait: 'Sending...',
      ok: function (at, em) { return 'We received your withdrawal on ' + at + '. The confirmation is on its way to ' + em + '. We will refund the full €14 to the same card within 14 days.'; },
      noMail: function (at) { return 'We received your withdrawal on ' + at + ', but the confirmation email could not be sent. Please keep this page or write to info@virtuse.com. We will refund the full €14 to the same card within 14 days.'; },
      net: 'We could not send this. Please try again or write to info@virtuse.com; your withdrawal counts from the moment you send it.'
    },
    sk: {
      name: 'Zadajte, prosím, svoje meno.', email: 'Zadajte, prosím, platnú e-mailovú adresu.', wait: 'Odosielam...',
      ok: function (at, em) { return 'Vaše odstúpenie sme prijali: ' + at + '. Potvrdenie je na ceste na ' + em + '. Celých 14 € vrátime na tú istú kartu do 14 dní.'; },
      noMail: function (at) { return 'Vaše odstúpenie sme prijali: ' + at + ', potvrdzujúci e-mail sa však nepodarilo poslať. Uschovajte si túto stránku alebo napíšte na info@virtuse.com. Celých 14 € vrátime na tú istú kartu do 14 dní.'; },
      net: 'Nepodarilo sa to odoslať. Skúste to znova alebo napíšte na info@virtuse.com; odstúpenie platí od chvíle, keď ho pošlete.'
    }
  }[LANG];
  var open = document.getElementById('wdOpen'), form = document.getElementById('wdForm'), msg = document.getElementById('wdMsg'), ok = document.getElementById('wdOk');
  if (!open || !form) return;
  var order = /[?&]order=([A-Za-z0-9-]{1,60})/.exec(location.search);
  if (order) form.order.value = order[1];
  open.addEventListener('click', function () { open.hidden = true; form.hidden = false; form.name.focus(); });
  if (/^#withdraw$/.test(location.hash) || order) { open.hidden = true; form.hidden = false; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name.value.trim(), em = form.email.value.trim();
    if (name.length < 2) { msg.textContent = T.name; form.elements.name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { msg.textContent = T.email; form.email.focus(); return; }
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; msg.textContent = T.wait;
    window.VB_API.postJson('/verdict/withdraw', { name: name, email: em, order: form.order.value.trim(), hp: form.website.value, lang: LANG })
      .then(function (r) {
        btn.disabled = false;
        if (!r || !r.ok || !r.data || !r.data.ok) { msg.textContent = (r && r.data && r.data.error) || T.net; return; }
        msg.textContent = ''; form.hidden = true;
        ok.textContent = r.data.confirmed === false ? T.noMail(r.data.at) : T.ok(r.data.at, em);
        ok.hidden = false;
        (window.dataLayer = window.dataLayer || []).push({ event: 'verdict_withdrawal' });
      })
      .catch(function () { btn.disabled = false; msg.textContent = T.net; });
  });
})();
