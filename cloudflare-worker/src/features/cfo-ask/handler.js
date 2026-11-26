// POST /cfo/ask  { question, lang, facts, hp }
//
// Order: JSON -> honeypot -> question -> open? -> facts schema -> advice question
// (declined here, no model call) -> monthly budget -> per-IP daily limit ->
// Claude (one more try if the answer reads like advice) -> record the spend.
//
// Secret: ANTHROPIC_API_KEY. Vars: CFO_ASK_ENABLED = "1" opens it;
// CFO_ASK_MONTHLY_CAP_EUR (default 20); CFO_ASK_PER_IP_DAY (default 30);
// CFO_ASK_EFFORT (default "low"). KV: RATE_LIMIT_KV (cfo:ip:*, cfo:spend:*).

import { clientIp, readJson } from '../../http/request.js';
import { json } from '../../http/responses.js';
import { ipHash } from '../../shared/crypto.js';
import { SPEND_RESERVE_EUR, createSpendLedger } from '../verdict/budget.js';
import { aiJson } from '../verdict/handler.js';
import { DECLINE, LANGS, adviceInAnswer, asksForAdvice, cleanAnswer, cleanContext, cleanQuestion } from './domain.js';
import { cfoCost } from './model.js';

const ERR = {
  question: { sk: 'Napíšte otázku.', en: 'Please write a question.' },
  facts: { sk: 'Údaje pre CFO sa nepodarilo prečítať.', en: 'The facts for the CFO could not be read.' },
  closed: { sk: 'AI CFO zatiaľ nie je zapnutý.', en: 'The AI CFO is not switched on yet.' },
  busy: { sk: 'AI CFO má teraz veľa otázok. Skúste to neskôr.', en: 'The AI CFO is busy. Please try again later.' },
  fail: { sk: 'Niečo sa pokazilo. Skúste to o chvíľu.', en: 'Something went wrong. Please try again in a moment.' },
};

export async function handleCfoAsk({ request, env, origin, now, services }) {
  const parsed = await readJson(request);
  if (!parsed.ok) return json(400, { error: 'Invalid JSON body' }, origin);
  const body = parsed.value || {};
  const lang = LANGS.includes(body.lang) ? body.lang : 'en';
  if (body.hp) return json(200, { kind: 'decline', lines: DECLINE[lang], sources: [] }, origin);
  const question = cleanQuestion(body.question);
  if (!question) return json(400, { error: ERR.question[lang] }, origin);
  if (env.CFO_ASK_ENABLED !== '1' || !env.ANTHROPIC_API_KEY) return json(503, { error: ERR.closed[lang] }, origin);
  const facts = cleanContext(body.facts);
  if (!facts) return json(400, { error: ERR.facts[lang] }, origin);
  if (asksForAdvice(question)) return json(200, { kind: 'decline', lines: DECLINE[lang], sources: [], ai_generated: false }, origin);

  const ledger = createSpendLedger(env.RATE_LIMIT_KV, now, 'cfo:spend:');
  if ((await ledger.spent()) >= parseFloat(env.CFO_ASK_MONTHLY_CAP_EUR || '20')) return json(429, { error: ERR.busy[lang] }, origin);
  const day = new Date(now).toISOString().slice(0, 10);
  const ipKey = `cfo:ip:${await ipHash(clientIp(request), day, env)}`;
  if (await services.limiter.exceeded(ipKey, parseInt(env.CFO_ASK_PER_IP_DAY || '30', 10), 86_400)) return json(429, { error: ERR.busy[lang] }, origin);

  await ledger.add(SPEND_RESERVE_EUR);
  let cost = 0;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { out, usage, refused } = await services.cfoModel.ask(question, facts, lang);
      cost += cfoCost(usage);
      if (refused) return aiJson({ kind: 'decline', lines: DECLINE[lang], sources: [] }, origin);
      const answer = cleanAnswer(out);
      if (!answer) continue;
      if (answer.kind === 'answer' && adviceInAnswer(answer.lines)) {
        console.error('cfo-ask: advice-like wording dropped, attempt ' + (attempt + 1));
        continue;
      }
      return aiJson(answer, origin);
    }
    return aiJson({ kind: 'decline', lines: DECLINE[lang], sources: [] }, origin);
  } catch (e) {
    console.error(e);
    return json(502, { error: ERR.fail[lang] }, origin);
  } finally {
    try { await ledger.add(cost - SPEND_RESERVE_EUR); } catch (e) { console.error(e); }
  }
}
