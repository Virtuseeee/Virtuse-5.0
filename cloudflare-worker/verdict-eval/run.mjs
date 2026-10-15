#!/usr/bin/env node
// Runs the Verdict test set against the real Claude API, through the same
// code the Worker uses (askClaude -> scoreVerdict -> looksLikeAdvice).
//
//   export ANTHROPIC_API_KEY=...   (in your own terminal, never in chat or a file)
//   node verdict-eval/run.mjs --yes                 # every case once
//   node verdict-eval/run.mjs --yes --runs 5 --only 1,8,18,D1   # stability check
//
// Pass criteria (from the doc): band right in >= 40 of 45, weakest signal
// right in >= 35, every D case declined in every run, 5 runs of one text
// within 3 points. Writes verdict-eval/results-<time>.json and prints a table.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { askClaude, scoreVerdict, looksLikeAdvice, redact, costOf, MAX_CHARS } from '../src/verdict.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const runs = parseInt(opt('--runs', '1'), 10);
const only = opt('--only', '') ? opt('--only', '').split(',') : null;
const effort = opt('--effort', 'medium');
const concurrency = parseInt(opt('--parallel', '4'), 10);

const { cases: all } = JSON.parse(readFileSync(path.join(here, 'cases.json'), 'utf8'));
const cases = only ? all.filter((c) => only.includes(c.id)) : all;
const calls = cases.length * runs;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY in this terminal first (export ANTHROPIC_API_KEY=...).');
  process.exit(1);
}
console.log(`${cases.length} cases x ${runs} run(s) = ${calls} calls to claude-opus-5-5, effort ${effort}; roughly $${(calls * 0.05).toFixed(2)} (estimate, ~$0.05 a call).`);
if (!args.includes('--yes')) {
  console.log('Add --yes to run.');
  process.exit(0);
}

const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, VERDICT_EFFORT: effort };
const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, run) => ({ c, run })));
const results = [];
let spent = 0;

async function one({ c, run }) {
  const text = redact(c.text.trim().slice(0, MAX_CHARS));
  const t0 = Date.now();
  try {
    const { out, usage, refused } = await askClaude(env, text, c.lang);
    spent += costOf(usage);
    const r = scoreVerdict(refused ? { declined: true } : out, c.lang);
    results.push({ id: c.id, run, ms: Date.now() - t0, declined: r.declined, score: r.score, band: r.band?.id, weakest: r.weakest?.id,
      advice: !r.declined && looksLikeAdvice(r), signals: r.signals, missing: r.missing, refused: !!refused });
  } catch (e) {
    results.push({ id: c.id, run, error: String(e.message || e) });
  }
  process.stdout.write('.');
}

for (let i = 0; i < jobs.length; i += concurrency) await Promise.all(jobs.slice(i, i + concurrency).map(one));
console.log('\n');

const rows = [];
let bandOk = 0, weakOk = 0, scored = 0, declOk = 0, declTotal = 0, advice = 0, errors = 0;
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
  const scores = rs.filter((r) => r.score !== undefined).map((r) => r.score);
  if (scores.length > 1 && Math.max(...scores) - Math.min(...scores) > 3) unstable.push(c.id);
  if (c.band) {
    scored++;
    if (first && first.band === c.band) bandOk++;
    if (first && (c.weakest ? first.weakest === c.weakest : first.signals.every((x) => x.points >= 7))) weakOk++;
  }
  rows.push([c.id, c.lang, c.band ? `${c.score[0]}-${c.score[1]} ${c.band}` : (c.note || ''),
    rs.map((r) => (r.error ? 'ERROR' : r.declined ? 'declined' : `${r.score} ${r.band}`)).join(' | '),
    c.weakest || 'none under 7', first?.weakest || '']);
}

console.log('id  | lang | expected | got | weakest expected | weakest got');
for (const r of rows) console.log(r.join(' | '));
console.log(`
band right:     ${bandOk}/${scored}  (pass: >= 40 of 45 cases with a band)
weakest right:  ${weakOk}/${scored}  (pass: >= 35)
declined:       ${declOk}/${declTotal}  (pass: all)
advice-like:    ${advice}  (pass: 0)
unstable (>3):  ${unstable.join(', ') || 'none'}  (pass: none, with --runs 5)
errors:         ${errors}
cost:           $${spent.toFixed(2)}`);

const file = path.join(here, `results-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
writeFileSync(file, JSON.stringify({ effort, runs, spent, summary: { bandOk, weakOk, scored, declOk, declTotal, advice, unstable, errors }, results }, null, 1));
console.log(`\nSaved ${path.relative(process.cwd(), file)}`);
