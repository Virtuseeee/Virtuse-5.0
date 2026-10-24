// Shared client profile (verdict-architecture §4, 2026-10-23). Answer once in
// Verdict, every tool is prefilled and nothing is retyped.
//
// localStorage  vb-profile       {v:1, updated, lang, fields:{goal, country, ...}}  fixed ids only
// sessionStorage vb-profile-text the free text + decision name (may hold personal details)
// Nothing here ever leaves the browser: the profile is sent only inside Verdict's
// own POST /verdict. Tools are prefilled through the URL params they already read
// (toParams), never auto-submitted, and a tool's own change is written back.
//
// <script src="/vb-profile.js" data-tool="pf|tax|loan|stacking|verdict"> in the
// head, before the module script, so the URL is filled in before React reads it.
// site-v2.js loads it with data-tool="page" on the SEO pages and the retirement
// calculator, for the "Get the full Verdict" card only.
(function () {
  var KEY = 'vb-profile', TKEY = 'vb-profile-text';
  var IDS = {
    goal: ['buy', 'dca', 'loan', 'sell', 'treasury', 'custody'],
    country: ['sk', 'cz', 'at', 'de', 'pl', 'hu', 'si', 'hr', 'ro', 'bg', 'nl', 'fr', 'es', 'other'],
    experience: ['new', 'hodler'], amount: ['s', 'm', 'l', 'xl'], share: ['lt5', '5_20', '20_50', 'gt50'],
    horizon: ['lt1', '1_4', 'gt4', 'never'], reserve: ['yes', 'part', 'no'], keys: ['exch', 'self', 'selfplan', 'multisig'],
    custody_pref: ['self', 'assisted', 'any'], drop: ['buy', 'hold', 'sell'], freq: ['weekly', 'monthly'],
    tax_known: ['yes', 'roughly', 'no'], aim: ['retire', 'grow', 'purchase', 'family'], ruleset: ['yes', 'roughly', 'no'],
    holdtime: ['lt1', '1_3', 'gt3'], basis: ['yes', 'roughly', 'no'], ltv: ['lt30', '30_50', 'gt50'], liqprice: ['yes', 'no'],
    runway: ['lt12', '12_24', 'gt24'], board: ['yes', 'pending', 'no'], heirs: ['yes', 'no']
  };
  // Verdict is open on staging and locally; on virtuse.com from launch (1 November).
  var LIVE = false;
  var ON = LIVE || location.hostname === 'staging.virtuse.com' || location.hostname === 'localhost';

  function read(store, k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }
  function get() { var p = read(localStorage, KEY); return p && p.v === 1 && p.fields ? p.fields : {}; }
  function set(partial) {
    var f = get(), changed = false;
    Object.keys(partial || {}).forEach(function (k) {
      var v = partial[k];
      if (k === 'focus') { if (Array.isArray(v)) { f.focus = v.filter(function (x) { return ['risk', 'drop', 'tax', 'next'].indexOf(x) >= 0; }); changed = true; } return; }
      if (v == null || v === 'na') { if (k in f) { delete f[k]; changed = true; } return; }
      if (IDS[k] && IDS[k].indexOf(v) >= 0 && f[k] !== v) { f[k] = v; changed = true; }
    });
    if (changed) try { localStorage.setItem(KEY, JSON.stringify({ v: 1, updated: new Date().toISOString(), lang: document.documentElement.lang || 'en', fields: f })); } catch (e) {}
    return f;
  }
  function getText() { return read(sessionStorage, TKEY) || {}; }
  function setText(t) { try { sessionStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {} }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    ['vb-profile-text', 'vb-verdict-last', 'vb-verdict-text', 'vb-report-session'].forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} });
  }

  var PF_GOAL = { buy: 'buy', dca: 'buy', loan: 'loan', sell: 'tax', treasury: 'treasury', custody: 'custody' };
  var YEARS = { lt1: 1, '1_4': 3, gt4: 5, never: 5 };
  var LTV = { lt30: 25, '30_50': 40, gt50: 55 };
  // Profile -> the URL params each tool already reads.
  function toParams(tool, f) {
    f = f || get();
    var q = {}, country = f.country && f.country !== 'other' ? f.country : null;
    if (tool === 'pf') {
      if (!PF_GOAL[f.goal]) return q;
      q.pf_goal = PF_GOAL[f.goal];
      if (country) q.pf_country = country;
      if (f.experience) q.pf_experience = f.experience; else if (['sell', 'loan', 'custody'].indexOf(f.goal) >= 0) q.pf_experience = 'hodler';
      if (f.keys) q.pf_custody = f.keys === 'exch' ? 'any' : f.keys === 'multisig' ? 'assisted' : 'self';
      if (f.custody_pref) q.pf_custody = f.custody_pref;
      if (f.amount) q.pf_amount = f.amount;
    } else if (tool === 'tax') {
      if (country) q.country = country;
    } else if (tool === 'loan') {
      if (f.amount) q.amount = f.amount;
      if (country) q.country = country;
      if (YEARS[f.horizon]) q.years = YEARS[f.horizon];
      if (LTV[f.ltv]) q.ltv = LTV[f.ltv];
    } else if (tool === 'stacking') {
      if (f.amount) q.amount = f.amount;
      if (f.freq) q.freq = f.freq;
      if (YEARS[f.horizon]) q.years = YEARS[f.horizon];
    }
    return q;
  }

  var me = document.currentScript, TOOL = me && me.getAttribute('data-tool');
  var LANG = (document.documentElement.lang || 'en').slice(0, 2);
  var T = {
    en: ['Get the full Verdict: 10 signals for your decision', 'Continue your Verdict', 'Open Verdict', '', 'Prefilled from your Verdict answers', 'Edit', 'Forget my answers', 'Your answers were removed from this browser.'],
    sk: ['Získajte celý Verdict: 10 signálov pre vaše rozhodnutie', 'Pokračovať vo Verdicte', 'Otvoriť Verdict', '', 'Predvyplnené z vašich odpovedí vo Verdicte', 'Upraviť', 'Zabudnúť moje odpovede', 'Vaše odpovede sme z tohto prehliadača odstránili.'],
    cs: ['Získejte celý Verdict: 10 signálů pro vaše rozhodnutí', 'Pokračovat ve Verdictu', 'Otevřít Verdict', ' (v angličtině)', 'Předvyplněno z vašich odpovědí ve Verdictu', 'Upravit', 'Zapomenout mé odpovědi', 'Vaše odpovědi jsme z tohoto prohlížeče odstranili.'],
    de: ['Den vollständigen Verdict holen: 10 Signale für Ihre Entscheidung', 'Verdict fortsetzen', 'Verdict öffnen', ' (auf Englisch)', 'Aus Ihren Verdict-Antworten vorausgefüllt', 'Bearbeiten', 'Meine Antworten vergessen', 'Ihre Antworten wurden aus diesem Browser entfernt.'],
    fr: ['Obtenez le Verdict complet : 10 signaux pour votre décision', 'Reprendre votre Verdict', 'Ouvrir Verdict', ' (en anglais)', 'Prérempli à partir de vos réponses Verdict', 'Modifier', 'Oublier mes réponses', 'Vos réponses ont été supprimées de ce navigateur.'],
    es: ['Obtenga el Verdict completo: 10 señales para su decisión', 'Continuar su Verdict', 'Abrir Verdict', ' (en inglés)', 'Rellenado con sus respuestas de Verdict', 'Editar', 'Olvidar mis respuestas', 'Sus respuestas se han eliminado de este navegador.'],
    pl: ['Pełny Verdict: 10 sygnałów dla Państwa decyzji', 'Kontynuuj Verdict', 'Otwórz Verdict', ' (po angielsku)', 'Uzupełnione z odpowiedzi w Verdict', 'Edytuj', 'Zapomnij moje odpowiedzi', 'Odpowiedzi zostały usunięte z tej przeglądarki.'],
    hu: ['A teljes Verdict: 10 jelzés a döntéséhez', 'Verdict folytatása', 'Verdict megnyitása', ' (angolul)', 'Kitöltve a Verdict-válaszai alapján', 'Szerkesztés', 'Válaszaim törlése', 'A válaszait töröltük ebből a böngészőből.'],
    uk: ['Повний Verdict: 10 сигналів для вашого рішення', 'Продовжити Verdict', 'Відкрити Verdict', ' (англійською)', 'Заповнено з ваших відповідей у Verdict', 'Змінити', 'Забути мої відповіді', 'Ваші відповіді видалено з цього браузера.'],
    ru: ['Полный Verdict: 10 сигналов для вашего решения', 'Продолжить Verdict', 'Открыть Verdict', ' (на английском)', 'Заполнено по вашим ответам в Verdict', 'Изменить', 'Забыть мои ответы', 'Ваши ответы удалены из этого браузера.']
  }[LANG] || null;
  var inFrame = false; try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }
  function verdictUrl(resume) { return '/' + (LANG === 'sk' || LANG === 'ru' ? LANG + '/' : '') + 'verdict.html?utm_source=' + encodeURIComponent(TOOL || 'page') + (resume ? '&resume=1' : ''); }
  function forget(a) {
    a.addEventListener('click', function (e) {
      e.preventDefault(); clear();
      var n = document.createElement('p'); n.className = 'vbp-msg'; n.setAttribute('role', 'status'); n.textContent = T ? T[7] : '';
      a.parentNode.replaceChild(n, a);
      (window.dataLayer = window.dataLayer || []).push({ event: 'verdict_profile_forget', page_lang: LANG });
    });
  }
  function style() {
    if (document.getElementById('vbp-css')) return;
    var s = document.createElement('style'); s.id = 'vbp-css';
    s.textContent = '.vbp-note{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:13px;color:var(--muted,#8b949e);margin:0 0 14px}.vbp-note a{color:var(--text,#e6edf3)}' +
      '.vbp-cta{display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;background:var(--card,#141414);border:1px solid var(--line-strong,rgba(255,255,255,.14));border-radius:16px;padding:20px 22px;margin:40px 0}' +
      '.vbp-cta b{display:block;font-size:17px}.vbp-cta small{display:block;color:var(--muted,#8b949e);font-size:13px;margin-top:4px}.vbp-cta small a{color:inherit}' +
      '.vbp-cta .vbp-go{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line-strong,rgba(255,255,255,.14));border-radius:999px;padding:11px 18px;font-weight:600;font-size:14px;color:var(--text,#e6edf3);text-decoration:none}' +
      '.vbp-cta .vbp-go:hover{border-color:rgba(255,255,255,.4)}.vbp-msg{font-size:13px;color:var(--muted,#8b949e);margin:0}';
    document.head.appendChild(s);
  }

  // 1. Prefill: only when the URL carries none of the tool's own params.
  var prefilled = false;
  if (ON && !inFrame && /^(pf|tax|loan|stacking)$/.test(TOOL || '')) {
    var params = toParams(TOOL), keys = Object.keys(params);
    var u = new URL(location.href), own = { pf: /^pf_/, tax: /^country$/, loan: /^(amount|cash|btc|country|years|ltv)$/, stacking: /^(amount|initial|contribution|freq|years)$/ }[TOOL];
    var has = false; u.searchParams.forEach(function (_, k) { if (own.test(k)) has = true; });
    if (keys.length && !has) {
      keys.forEach(function (k) { u.searchParams.set(k, params[k]); });
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      prefilled = true;
    }
  }

  // 2. Write-back: a tool that keeps its state in the URL (Loan, Stacking, Tax)
  // tells us the visitor's own change; the first sync of each param is skipped.
  if (/^(tax|loan|stacking)$/.test(TOOL || '')) {
    var seen = {}, rs = history.replaceState;
    var watch = { tax: ['country'], loan: ['country'], stacking: ['freq'] }[TOOL];
    history.replaceState = function (st, title, url) {
      var r = rs.apply(history, arguments);
      try {
        var q = new URL(url || location.href, location.href).searchParams;
        watch.forEach(function (k) {
          var v = q.get(k); if (v == null) return;
          if (seen[k] !== undefined && seen[k] !== v) { var o = {}; o[k] = v; set(o); }
          seen[k] = v;
        });
      } catch (e) {}
      return r;
    };
  }

  // 3. The note under the tool and the card back to Verdict.
  function ui() {
    if (!ON || inFrame || !T) return;
    style();
    var has = Object.keys(get()).length > 0;
    var root = document.getElementById('root');
    if (prefilled && root) {
      var n = document.createElement('p'); n.className = 'vbp-note';
      n.innerHTML = '<span>' + T[4] + '</span><a href="' + verdictUrl(true) + '">' + T[5] + '</a><a href="#" data-vbp-forget>' + T[6] + '</a>';
      root.parentNode.insertBefore(n, root);
    }
    if (TOOL === 'verdict') return;
    var foot = document.querySelector('main .footer-main, footer.footer-main');
    if (!foot) return;
    var c = document.createElement('div'); c.className = 'vbp-cta';
    c.innerHTML = '<div><b>' + (has ? T[1] : T[0]) + '</b>' + (has && !prefilled ? '<small><a href="#" data-vbp-forget>' + T[6] + '</a></small>' : '') + '</div>' +
      '<a class="vbp-go" href="' + verdictUrl(has) + '">' + T[2] + T[3] + ' →</a>';
    foot.parentNode.insertBefore(c, foot);
    c.querySelector('.vbp-go').addEventListener('click', function () { (window.dataLayer = window.dataLayer || []).push({ event: 'verdict_cta_click', page_lang: LANG, source: TOOL || 'page', resume: has }); });
  }
  function bindForget() { document.querySelectorAll('[data-vbp-forget]').forEach(forget); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { ui(); bindForget(); }); else { ui(); bindForget(); }

  window.VBProfile = { get: get, set: set, clear: clear, getText: getText, setText: setText, toParams: toParams, bindForget: bindForget, on: ON };
})();
