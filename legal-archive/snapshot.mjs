// Evidence of what a buyer saw (legal opinion 1, checklist: "archive the wording of 5a and the withdrawal
// information as of each purchase"). Each purchase carries TERMS_VERSION in its Stripe metadata and order record;
// legal-archive/<TERMS_VERSION>/ holds the wording of that version. A Worker test fails if the pages differ,
// so changed wording needs a new TERMS_VERSION and a new snapshot:
//   node legal-archive/snapshot.mjs            (writes the folder for the current TERMS_VERSION)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'Kimi_Agent_Virtuse%20MiCA%20Partners');

const between = (html, start, end, file) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`markers not found in ${file}: ${start} .. ${end}`);
  return html.slice(a, b).trim() + '\n';
};

export const PARTS = [
  ['en-terms-5a.html', 'terms-and-conditions.html', 'id="verdict-report"', 'sec-label">6. '],
  ['sk-terms-5a.html', 'sk/terms-and-conditions.html', 'id="verdict-report"', 'sec-label">6. '],
  ['en-withdrawal.html', 'withdrawal.html', '<main', '</main>'],
  ['sk-withdrawal.html', 'sk/withdrawal.html', '<main', '</main>'],
  ['en-privacy-9.html', 'privacy-policy.html', 'id="verdict-cfo"', 'sec-label">10. '],
  ['sk-privacy-9.html', 'sk/privacy-policy.html', 'id="verdict-cfo"', 'sec-label">10. '],
];

export const currentWording = () => PARTS.map(([name, file, start, end]) => [name, between(readFileSync(path.join(SITE, file), 'utf8'), start, end, file)]);
export const archiveDir = (version) => path.join(ROOT, 'legal-archive', version);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { TERMS_VERSION } = await import('../cloudflare-worker/src/features/verdict-pay/domain.js');
  mkdirSync(archiveDir(TERMS_VERSION), { recursive: true });
  for (const [name, text] of currentWording()) writeFileSync(path.join(archiveDir(TERMS_VERSION), name), text);
  console.log(`legal-archive/${TERMS_VERSION}: ${PARTS.length} files`);
}
