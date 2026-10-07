// i18n coverage check for the Layer 2 modules.
//
//   node scripts/i18n-check.mjs              -> key count + coverage of every dictionary
//   node scripts/i18n-check.mjs --keys out.json  -> write all EN source keys (for translators)
//
// Keys are the English source strings: the 2nd argument of t()/tv() calls and
// the `en:` value of LocalizedText objects. Dictionaries live in
// src/lib/i18n/<lang>.ts as `export default { 'English': 'Translation', … }`.
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (!p.endsWith('/i18n') && !p.includes('/ui')) walk(p); }
    else if (/\.(ts|tsx)$/.test(f) && !p.endsWith('lib/i18n.ts') && !p.endsWith('lib/chrome.ts')) files.push(p);
  }
})(SRC);

// Read one JS string literal starting at s[i]; returns [value, endIndex].
function readLit(s, i) {
  const q = s[i];
  let j = i + 1;
  while (s[j] !== q) { if (s[j] === '\\') j++; if (q === '`' && s[j] === '$' && s[j + 1] === '{') return [null, j]; j++; }
  // eslint-disable-next-line no-new-func
  return [Function('"use strict";return ' + s.slice(i, j + 1))(), j + 1];
}

const keys = new Map(); // key -> first file
for (const f of files) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/(?<![\w.])tv?\(\s*\w+\s*,\s*/g)) {
    const i = m.index + m[0].length;
    if (!`'"\``.includes(s[i])) continue;
    const [v] = readLit(s, i);
    if (v !== null && !keys.has(v)) keys.set(v, f.replace(SRC, 'src/'));
  }
  for (const m of s.matchAll(/\ben:\s*/g)) {
    const i = m.index + m[0].length;
    if (!`'"\``.includes(s[i])) continue;
    const [v] = readLit(s, i);
    if (v !== null && !keys.has(v)) keys.set(v, f.replace(SRC, 'src/'));
  }
}

const args = process.argv.slice(2);
if (args[0] === '--keys') {
  writeFileSync(args[1], JSON.stringify([...keys.keys()], null, 2));
  console.log(`wrote ${keys.size} keys to ${args[1]}`);
  process.exit(0);
}

console.log(`${keys.size} source strings in ${files.length} files`);
const dictDir = join(SRC, 'lib/i18n');
let failed = false;
for (const f of readdirSync(dictDir).filter((x) => x.endsWith('.ts'))) {
  const lang = f.replace('.ts', '');
  const txt = readFileSync(join(dictDir, f), 'utf8');
  const body = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
  // eslint-disable-next-line no-new-func
  const dict = Function('"use strict";return (' + body + ')')();
  const missing = [...keys.keys()].filter((k) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  const badPh = Object.entries(dict).filter(([k, v]) => {
    const ph = (x) => (x.match(/\{\d+\}/g) || []).sort().join();
    return keys.has(k) && ph(k) !== ph(v);
  });
  console.log(`${lang}: ${keys.size - missing.length}/${keys.size} translated, ${missing.length} missing, ${unused.length} unused, ${badPh.length} placeholder mismatches`);
  for (const k of missing.slice(0, 15)) console.log('  missing:', JSON.stringify(k).slice(0, 110));
  for (const k of unused.slice(0, 15)) console.log('  unused :', JSON.stringify(k).slice(0, 110));
  for (const [k] of badPh) console.log('  placeholder mismatch:', JSON.stringify(k).slice(0, 110));
  if (missing.length || badPh.length) failed = true;
}
process.exit(failed ? 1 : 0);
