#!/usr/bin/env node
// Runs the Verdict test set against the real Claude API, through the same
// code the Worker uses (askClaude -> scoreVerdict -> looksLikeAdvice).
//
//   export ANTHROPIC_API_KEY=...   (in your own terminal, never in chat or a file)
//   node verdict-eval/run.mjs --yes                 # every case once
//   node verdict-eval/run.mjs --yes --runs 5 --only 1,8,18,D1   # stability check
//   node verdict-eval/run.mjs --yes --batch                     # half price, results in minutes to an hour
//   node verdict-eval/run.mjs --yes --batch --only P1,P2,P3     # only the funnel (profile) cases
//   node verdict-eval/run.mjs --yes --batch --only P1,P2,P3 --resume msgbatch_...  # results of a batch already sent
//     (same --only/--runs as when it was sent; nothing new is sent or paid)
//
// Cases with "profile" send the funnel answers too; "profileOnly" lists the
// signals the model must flag only_profile (backed only by an answer, then
// capped at 7), "notProfileOnly" those it must not flag (the text covers them).
//
// Pass criteria (from the doc): band right in >= 40 of 45, weakest signal
// right in >= 35, every D case declined in every run, 5 runs of one text
// within one rounding step (5 points). Writes verdict-eval/results-<time>.json and prints a table.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { askClaude, verdictRequest, readVerdictResponse, cleanProfile, scoreVerdict, looksLikeAdvice, redact, costOf, MAX_CHARS } from '../src/verdict.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const runs = parseInt(opt('--runs', '1'), 10);
const only = opt('--only', '') ? opt('--only', '').split(',') : null;
const effort = opt('--effort', 'low');
const concurrency = parseInt(opt('--parallel', '4'), 10);
const resume = opt('--resume', '');
const batch = args.includes('--batch') || !!resume;

const { cases: all } = JSON.parse(readFileSync(path.join(here, 'cases.json'), 'utf8'));
const cases = only ? all.filter((c) => only.includes(c.id)) : all;
const calls = cases.length * runs;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY in this terminal first: read -s "ANTHROPIC_API_KEY?Key: "; export ANTHROPIC_API_KEY');
  process.exit(1);
}
const each = batch ? 0.008 : 0.015;
console.log(`${cases.length} cases x ${runs} run(s) = ${calls} calls to claude-opus-5-5, effort ${effort}${batch ? ', Batch API (half price)' : ''}; roughly $${(calls * each).toFixed(2)} (estimate, ~$${each} a call).`);
if (!args.includes('--yes')) {
  console.log('Add --yes to run.');
  process.exit(0);
}

const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, VERDICT_EFFORT: effort };
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ({ c, run })));
const results = [];
let spent = 0;

function record(c, run, ms, res, priceFactor) {
  const { out, usage, refused } = res;
  spent += costOf(usage) * priceFactor;
  const r = scoreVerdict(refused ? { declined: true } : out, c.lang);
  results.push({ id: c.id, run, ms, declined: r.declined, score: r.score, band: r.band?.id, weakest: r.weakest?.id,
    advice: !r.declined && looksLikeAdvice(r), signals: r.signals, missing: r.missing, refused: !!refused,
    onlyProfile: (out?.signals || []).filter((x) => x.only_profile).map((x) => x.id) });
}
const textOf = (c) => redact(c.text.trim().slice(0, MAX_CHARS));

async function one({ c, run }) {
  const t0 = Date.now();
  try {
    record(c, run, Date.now() - t0, await askClaude(env, textOf(c), c.lang, cleanProfile(c.profile)), 1);
  } catch (e) {
    results.push({ id: c.id, run, error: String(e.message || e) });
  }
  process.stdout.write('.');
}

if (batch) {
  // Message Batches: 50% of the price, no fallback model; usually done within an hour.
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const requests = jobs.map(({ c, run }, n) => ({ custom_id: `j${n}`, params: verdictRequest(env, textOf(c), c.lang, cleanProfile(c.profile)) }));
  const b = resume ? { id: resume, processing_status: 'in_progress' } : await client.beta.messages.batches.create({ requests });
  console.log(resume ? `resuming batch ${b.id}` : `batch ${b.id} sent; checking every 30 s`);
  console.log(`If this stops (network, closed terminal), get the results later with: --resume ${b.id}`);
  let st = b;
  while (st.processing_status !== 'ended') {
    if (!resume || st !== b) await new Promise((r) => setTimeout(r, 30_000));
    try {
      st = await client.beta.messages.batches.retrieve(b.id);
    } catch (e) {
      // A network blip must not lose the batch: keep waiting.
      process.stdout.write(`\r(network: ${String(e.message || e).slice(0, 60)}; retrying)   `);
      if (st === b) st = { ...b, retried: true };
      continue;
    }
    const k = st.request_counts;
    process.stdout.write(`\r${k.succeeded + k.errored + k.canceled + k.expired}/${jobs.length} done   `);
  }
  for await (const item of await client.beta.messages.batches.results(b.id)) {
    const { c, run } = jobs[Number(item.custom_id.slice(1))];
    if (item.result.type !== 'succeeded') { results.push({ id: c.id, run, error: item.result.type }); continue; }
    try { record(c, run, 0, readVerdictResponse(item.result.message), 0.5); } catch (e) { results.push({ id: c.id, run, error: String(e.message || e) }); }
  }
} else {
  for (let i = 0; i < jobs.length; i += concurrency) await Promise.all(jobs.slice(i, i + concurrency).map(one));
}
console.log('\n');

const rows = [];
let bandOk = 0, weakOk = 0, weakTotal = 0, scored = 0, declOk = 0, declTotal = 0, advice = 0, errors = 0, capOk = 0, capTotal = 0;
const capFails = [];
const unstable = [];
for (const c of cases) {
  const rs = results.filter((r) => r.id === c.id);
  errors += rs.filter((r) => r.error).length;
  advice += rs.filter((r) => r.advice).length;
  if (c.declined) {
    declTotal += rs.length;
    declOk += rs.filter((r) => r.declined).length;
    rows.push([c.id, c.lang, 'declined', rs.map((r) => (r.declined ? 'declined' : r.error ? 'ERROR' : r.score)).join(' '), '', '']);
    continue;
  }
  const first = rs.find((r) => !r.error && !r.declined);
  for (const r of rs.filter((x) => x.onlyProfile && !x.declined)) {
    for (const sid of c.profileOnly || []) { capTotal++; if (r.onlyProfile.includes(sid)) capOk++; else capFails.push(`${c.id} ${sid} not flagged`); }
    for (const sid of c.notProfileOnly || []) { capTotal++; if (!r.onlyProfile.includes(sid)) capOk++; else capFails.push(`${c.id} ${sid} flagged`); }
  }
  const scores = rs.filter((r) => r.score !== undefined).map((r) => r.score);
  // Scores are shown rounded to 5; stable = repeated runs at most one step (5) apart.
  if (scores.length > 1 && Math.max(...scores) - Math.min(...scores) > 5) unstable.push(c.id);
  if (c.band) {
    scored++;
    if (first && first.band === c.band) bandOk++;
    if ('weakest' in c) {
      weakTotal++;
      if (first && (c.weakest ? first.weakest === c.weakest : first.signals.every((x) => x.points >= 7))) weakOk++;
    }
  }
  rows.push([c.id, c.lang, c.band ? `${c.score ? `${c.score[0]}-${c.score[1]} ` : ''}${c.band}` : (c.note || ''),
    rs.map((r) => (r.error ? 'ERROR' : r.declined ? 'declined' : `${r.score} ${r.band}`)).join(' | '),
    c.weakest || 'none under 7', first?.weakest || '']);
}

console.log('id  | lang | expected | got | weakest expected | weakest got');
for (const r of rows) console.log(r.join(' | '));
console.log(`
band right:     ${bandOk}/${scored}  (pass: >= 40 of 45 cases with a band)
weakest right:  ${weakOk}/${weakTotal}  (pass: >= 35)
declined:       ${declOk}/${declTotal}  (pass: all)
advice-like:    ${advice}  (pass: 0)
profile flags:  ${capOk}/${capTotal}  ${capFails.join(', ')}  (pass: all)
unstable (>5):  ${unstable.join(', ') || 'none'}  (pass: none, with --runs 5)
errors:         ${errors}
cost:           $${spent.toFixed(2)}`);

const file = path.join(here, `results-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
writeFileSync(file, JSON.stringify({ effort, runs, spent, batch, summary: { bandOk, weakOk, scored, declOk, declTotal, advice, unstable, errors, capOk, capTotal, capFails }, results }, null, 1));
console.log(`\nSaved ${path.relative(process.cwd(), file)}`);
