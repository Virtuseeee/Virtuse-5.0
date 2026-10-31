// POST /verdict  { text, lang, hp, profile?, report?, recalc? }
//
// Order: JSON -> honeypot -> text length -> open? -> monthly AI budget ->
// per-IP daily limit -> Claude (one retry if the answer reads like advice) ->
// record the spend -> free view (or the full report on staging). With payments
// on (verdict-pay/), the free view carries { pay: true, rid } for checkout.
//
// Secrets: ANTHROPIC_API_KEY (no key -> 503). Vars: VERDICT_ENABLED = "1"
// opens it (never decided by the Origin header, which any script can set; the
// staging Worker, wrangler env "staging", sets it); VERDICT_REPORT_PREVIEW = "1"
// returns the full report on request (staging Worker only);
// VERDICT_TAX_MODULE = "1" shows the one-line country tax rule (lawyer sign-off
// first, A§9); VERDICT_CHECKOUT = "1" switches the report card from the waitlist
// to checkout (on by itself once payments are on, see verdict-pay/domain.js); VERDICT_MONTHLY_CAP_EUR (default 50); VERDICT_EFFORT (default "low": as accurate as medium in the test set, faster and cheaper; Ras 2026-10-16).
// KV: RATE_LIMIT_KV holds the per-IP counter and the month's spend.

import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { sha256Hex } from '../../shared/crypto.js';
import { createSpendLedger } from './budget.js';
import {
  LANGS, MAX_CHARS, TEXT, cleanProfile, effectiveProfile, freeView, looksLikeAdvice, redact, reportPreviewAllowed,
  reportView, scoreVerdict, verdictOpts,
} from './domain.js';
import { PER_IP_RECALC_PER_DAY, perIpPerDay } from './limits.js';
import { costOf } from './model.js';
import { paymentsOn } from '../verdict-pay/domain.js';
import { createPayStore, newRid } from '../verdict-pay/store.js';

// Short error texts in the request language.
const ERR = {
  short: { sk: 'Popíšte rozhodnutie aspoň jednou vetou.', en: 'Describe your decision in at least one sentence.', ru: 'Опишите решение хотя бы одним предложением.' },
  closed: { sk: 'Verdict sa čoskoro otvorí.', en: 'Verdict opens soon.', ru: 'Verdict скоро откроется.' },
  busy: { sk: 'Verdict má teraz veľa požiadaviek. Skúste to neskôr.', en: 'Verdict is busy right now. Please try again later.', ru: 'Сейчас у Verdict много запросов. Попробуйте позже.' },
  fail: { sk: 'Niečo sa pokazilo. Skúste to o chvíľu.', en: 'Something went wrong. Please try again in a moment.', ru: 'Что-то пошло не так. Попробуйте через минуту.' },
  advice: {
    sk: 'Verdict tentoraz nevedel napísať hodnotenie bez rady, čo urobiť. Skúste rozhodnutie opísať inými slovami.',
    en: "Verdict couldn't word this rating without telling you what to do. Please describe your decision in other words.",
    ru: 'На этот раз Verdict не смог сформулировать оценку без совета, что делать. Попробуйте описать решение другими словами.',
  },
};

const IP_WINDOW_SECONDS = 60 * 60 * 24;

// AI Act art. 50(2) / legal pack 8.2.4: machine-readable marking of AI output.
export function aiJson(body, origin) {
  const r = json(200, { ...body, ai_generated: true }, origin);
  r.headers.set('X-AI-Generated', 'true');
  return r;
}

// Privacy policy 6.2/6.3: the IP is kept only as a one-way hash, salted per
// day (salt = secret + date), and the counter expires after 24 hours.
export async function ipHash(ip, day, env) {
  return sha256Hex(`${env.UNSUB_SECRET || 'virtuse'}:${day}:${ip}`);
}

export async function handleVerdict({ request, env, origin, now, services }) {
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const body = parsed.value;
  const { text, hp } = body || {};
  const lang = LANGS.includes(body?.lang) ? body.lang : 'en';
  if (hp) return json(200, { ok: true, declined: true, message: TEXT[lang].declined }, origin);
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return json(400, { error: ERR.short[lang] }, origin);
  }
  const enabled = env.VERDICT_ENABLED === '1';
  if (!env.ANTHROPIC_API_KEY || !enabled) {
    return json(503, { error: ERR.closed[lang] }, origin);
  }
  const busy = ERR.busy[lang];
  const ledger = createSpendLedger(env.RATE_LIMIT_KV, now);
  const spent = await ledger.spent();
  const cap = parseFloat(env.VERDICT_MONTHLY_CAP_EUR || '50');
  if (spent >= cap) return json(429, { error: busy }, origin);

  const day = new Date(now).toISOString().slice(0, 10);
  const recalc = body.recalc === true;
  const ipKey = `verdict:${recalc ? 'ipr' : 'ip'}:${await ipHash(clientIp(request), day, env)}`;
  const limit = recalc ? PER_IP_RECALC_PER_DAY : perIpPerDay(env, day);
  if (await services.limiter.exceeded(ipKey, limit, IP_WINDOW_SECONDS)) return json(429, { error: busy }, origin);

  const clean = redact(text.trim().slice(0, MAX_CHARS));
  const profile = cleanProfile(body.profile);
  // The model gets only what the person answered; tools, steps and partners
  // also use the goal read from the text (effectiveProfile).
  const eff = effectiveProfile(profile, clean);
  try {
    // Advice-like wording (BANNED) is never shown; the model gets one more try.
    let result, cost = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { out, usage, refused } = await services.verdictModel.ask(clean, lang, profile);
      cost += costOf(usage);
      if (refused) { result = scoreVerdict({ declined: true }, lang); break; }
      result = scoreVerdict(out, lang, { text: clean, profile: eff });
      if (result.declined || !looksLikeAdvice(result)) break;
      console.error('verdict: advice-like wording dropped, attempt ' + (attempt + 1));
      result = null;
    }
    await ledger.record(spent + cost);
    if (!result) return json(502, { error: ERR.advice[lang] }, origin);
    if (result.declined) return aiJson(result, origin);
    const opts = verdictOpts(env, lang);
    if (body.report === true && reportPreviewAllowed(env)) return aiJson(reportView(result, eff, opts), origin);
    if (!paymentsOn(env)) return aiJson(freeView(result, eff, opts), origin);
    // Payments on: the scored result is kept 24 h under a random id, so the
    // paid report can be shown after Stripe without running the model again.
    const rid = newRid();
    await createPayStore(env.RATE_LIMIT_KV).storeResult(rid, result, eff, lang);
    return aiJson({ ...freeView(result, eff, opts), pay: true, rid }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: ERR.fail[lang] }, origin);
  }
}
