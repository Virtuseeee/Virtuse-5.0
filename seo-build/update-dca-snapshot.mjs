#!/usr/bin/env node
/**
 * Freezes the month-end closes the static DCA pages are built from.
 * generate.mjs must give the same output on every run (seo-verify CI regenerates and diffs), and
 * data/btc-monthly-returns.json changes daily, so the pages read this snapshot instead.
 * The browser replaces the static numbers with live data (dca-calc.js).
 * Run after a month has closed, then `node generate.mjs`:  node seo-build/update-dca-snapshot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { SITE_DIR_NAME } from './lib/util.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(ROOT, '..', SITE_DIR_NAME);
const VBDca = createRequire(import.meta.url)(path.join(SITE, 'dca-calc.js'));
const live = JSON.parse(fs.readFileSync(path.join(SITE, 'data/btc-monthly-returns.json'), 'utf8'));
const end = VBDca.lastFull(live);
const [y, m] = end.split('-').map(Number);
const snap = { asOf: `${end}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`, source: live.source, closes: {}, eurusd: {} };
for (const k of Object.keys(live.closes).sort()) {
  if (k < VBDca.MIN_START || k > end) continue;
  if (live.closes[k] == null || live.eurusd[k] == null) throw new Error(`missing close or EUR/USD for ${k}`);
  snap.closes[k] = live.closes[k];
  snap.eurusd[k] = live.eurusd[k];
}
fs.writeFileSync(path.join(ROOT, 'data/dca-snapshot.json'), JSON.stringify(snap) + '\n');
console.log(`dca-snapshot.json: ${Object.keys(snap.closes).length} months, ${VBDca.MIN_START} to ${end}`);
