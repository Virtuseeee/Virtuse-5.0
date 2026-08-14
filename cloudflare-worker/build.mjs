#!/usr/bin/env node
// Bundles the Worker: reads email/welcome-template.html, safely JSON-embeds
// it as a string literal (sidesteps any backtick/${}/quote escaping issues
// in the HTML entirely), and substitutes it into src/index.js's
// placeholder to produce dist/worker.js -- the file you actually deploy.
//
// Run this every time email/welcome-template.html changes, then re-deploy:
//   node build.mjs && npx wrangler deploy

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const templateHtml = readFileSync(path.join(ROOT, 'email', 'welcome-template.html'), 'utf8');
const source = readFileSync(path.join(__dirname, 'src', 'index.js'), 'utf8');

const placeholder = '"__WELCOME_EMAIL_HTML__"';
if (!source.includes(placeholder)) {
  console.error(`Placeholder ${placeholder} not found in src/index.js -- has it already been built, or did the source change?`);
  process.exit(1);
}

const bundled = source.replace(placeholder, JSON.stringify(templateHtml));

const distDir = path.join(__dirname, 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, 'worker.js'), bundled);

console.log('Built dist/worker.js (' + bundled.length + ' bytes)');
