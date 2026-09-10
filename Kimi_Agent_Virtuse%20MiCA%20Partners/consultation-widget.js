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
 * otherwise it falls back to <html lang="..">, then English. Only
 * `en`/`sk` copy exists today -- any other value falls back to English.
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
