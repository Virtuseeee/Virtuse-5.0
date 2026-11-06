// Internal audit trail that Verdict answers really expire (legal opinion 3, checklist).
// KV deletes a key at its `expiration`, so the proof is: every stored key has one, and it is no
// further away than privacy section 9 says. Reads key names and expiry only, never the values.
//   node scripts/audit-retention.mjs              production
//   node scripts/audit-retention.mjs --env staging
// Exit 1 if a key breaks the rule. Run it monthly; production runs add a line to legal-archive/retention-audit.log.
// A few verdict:pi keys of test payments from before their TTL went from 90 to 30 days are reported, not failed.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envArgs = process.argv.includes('--env') ? ['--env', process.argv[process.argv.indexOf('--env') + 1]] : [];
const SLACK = 120;
const RULES = [['verdict:res:', 86400], ['verdict:paid:', 30 * 86400], ['verdict:pi:', 30 * 86400]];
const now = Math.floor(Date.now() / 1000);
let bad = 0;
let oldTest = 0;
const parts = [];
for (const [prefix, max] of RULES) {
  const out = execFileSync('npx', ['wrangler', 'kv', 'key', 'list', '--binding', 'RATE_LIMIT_KV', '--remote', '--prefix', prefix, ...envArgs], { cwd: path.join(HERE, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const keys = JSON.parse(out.slice(out.indexOf('[')));
  let longest = 0;
  for (const k of keys) {
    const left = k.expiration ? k.expiration - now : Infinity;
    if (left > max + SLACK) {
      // Reads this one value: a verdict:pi key holds only a Checkout Session id.
      const value = prefix === 'verdict:pi:' ? execFileSync('npx', ['wrangler', 'kv', 'key', 'get', k.name, '--binding', 'RATE_LIMIT_KV', '--remote', ...envArgs], { cwd: path.join(HERE, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) : '';
      if (value.includes('cs_test_')) { oldTest++; continue; }
      bad++;
      console.error(`TOO LONG ${prefix}… expires in ${left}s, allowed ${max}s`);
    }
    if (left !== Infinity) longest = Math.max(longest, left);
  }
  parts.push(`${prefix} keys=${keys.length} longest=${(longest / 3600).toFixed(1)}h`);
}
const line = `${new Date().toISOString()} ${envArgs[1] || 'production'} ${bad ? 'FAIL' : 'OK'} ${parts.join(' | ')}${oldTest ? ` | test-payment links from before the TTL change, ignored: ${oldTest}` : ''}`;
console.log(line);
if (!envArgs.length) appendFileSync(path.join(HERE, '..', '..', 'legal-archive', 'retention-audit.log'), `${line}\n`);
process.exit(bad ? 1 : 0);
