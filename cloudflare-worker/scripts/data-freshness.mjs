#!/usr/bin/env node
// Runs the data freshness check (src/features/data-freshness/checks.js) against the
// live sites and exits 1 when there is a problem. Used by
// .github/workflows/data-freshness.yml; it sends nothing and writes nothing.
//   node cloudflare-worker/scripts/data-freshness.mjs
//   CHECK_PROD_COPY=1 node cloudflare-worker/scripts/data-freshness.mjs
// In GitHub Actions it prints ::error / ::notice annotations and a job summary.
import { appendFileSync } from 'node:fs';
import { dataFreshnessProblems } from '../src/features/data-freshness/checks.js';

const gh = process.env.GITHUB_ACTIONS === 'true';
const checkProdCopy = ['1', 'true'].includes(String(process.env.CHECK_PROD_COPY || ''));
const now = Date.now();
const { problems, notes } = await dataFreshnessProblems({ fetchImpl: fetch, now, checkProdCopy });

const clean = (s) => s.replace(/[\r\n]+/g, ' ');
for (const p of problems) console.log(gh ? `::error title=Data freshness::${clean(p)}` : `PROBLEM  ${p}`);
for (const n of notes) console.log(gh ? `::notice title=Data freshness::${clean(n)}` : `note     ${n}`);
console.log(`${new Date(now).toISOString()}  ${problems.length} problem(s), ${notes.length} note(s), production copy check ${checkProdCopy ? 'on' : 'off'}`);

if (gh && process.env.GITHUB_STEP_SUMMARY) {
  const li = (xs) => xs.map((x) => `- ${x}`).join('\n') || '- none';
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Data freshness ${new Date(now).toISOString().slice(0, 10)}\n\nProduction copy check: ${checkProdCopy ? 'on' : 'off'}\n\n### Problems\n${li(problems)}\n\n### Notes\n${li(notes)}\n`);
}
process.exit(problems.length ? 1 : 0);
