// Fails the build if the Stacking fee table drifts from the published fee data.
//
// The fee rows live in two places: src/lib/stacking.ts (the calculator) and
// seo-build/data/fee-schedule-live.json (fee index + SEO pages). In Q4 2026 the
// new fees were first patched into the built bundle only, so a rebuild would
// have brought back ByBit 0.1 %, Kraken 0.16 % and the RevenueBot row. This
// check runs before every `npm run build` and in CI.
//   node scripts/check-fees.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../src/lib/stacking.ts'), 'utf8');
const live = JSON.parse(readFileSync(join(here, '../../seo-build/data/fee-schedule-live.json'), 'utf8'));

const block = src.split('export const FEE_SCHEDULE')[1]?.split('\n];')[0];
if (!block) throw new Error('FEE_SCHEDULE not found in src/lib/stacking.ts');
const rows = [...block.matchAll(/id: '([^']+)'[\s\S]*?pct: ([\d.]+),\s*fixed: ([\d.]+)/g)]
  .map(([, id, pct, fixed]) => ({ id, pct: Number(pct), fixed: Number(fixed) }));

const errors = [];
const want = live.rows.map((r) => r.id).join(',');
const got = rows.map((r) => r.id).join(',');
if (want !== got) errors.push(`partners differ: stacking.ts [${got}] vs fee-schedule-live.json [${want}]`);
for (const r of live.rows) {
  const s = rows.find((x) => x.id === r.id);
  if (!s) continue;
  if (s.pct !== r.pct) errors.push(`${r.id}: pct ${s.pct} in stacking.ts, ${r.pct} in fee-schedule-live.json`);
  if (s.fixed !== (r.fixed || 0)) errors.push(`${r.id}: fixed ${s.fixed} in stacking.ts, ${r.fixed} in fee-schedule-live.json`);
}
if (errors.length) {
  console.error('Fee check FAILED (' + live.asOf + '):\n  ' + errors.join('\n  '));
  console.error('Update both files to the partner pages, then rebuild.');
  process.exit(1);
}
console.log(`Fee check OK: ${rows.map((r) => `${r.id} ${r.pct * 100}%`).join(', ')} (${live.asOf})`);
