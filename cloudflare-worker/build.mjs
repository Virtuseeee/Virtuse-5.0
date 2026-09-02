#!/usr/bin/env node
// Bundles the Worker: reads the welcome email templates (one per
// supported language), safely JSON-embeds each as a string literal
// (sidesteps any backtick/${}/quote escaping issues in the HTML
// entirely), and substitutes them into src/index.js's placeholders to
// produce dist/worker.js -- the file you actually deploy.
//
// Run this every time a welcome-template*.html file changes, then redeploy:
//   node build.mjs && npx wrangler deploy

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// lang -> [source template file, placeholder in src/index.js]. Add a row
// here (and a matching WELCOME_EMAIL_HTML_<LANG> placeholder + templates
// map entry in src/index.js) whenever a new language gets its own welcome
// email -- see cloudflare-worker/README.md's "Multi-language welcome
// emails" section.
const TEMPLATES = [
  { file: 'welcome-template.html', placeholder: '"__WELCOME_EMAIL_HTML__"' },
  { file: 'welcome-template-sk.html', placeholder: '"__WELCOME_EMAIL_HTML_SK__"' },
];

let source = readFileSync(path.join(__dirname, 'src', 'index.js'), 'utf8');

for (const { file, placeholder } of TEMPLATES) {
  if (!source.includes(placeholder)) {
    console.error(`Placeholder ${placeholder} not found in src/index.js -- has it already been built, or did the source change?`);
    process.exit(1);
  }
  const templateHtml = readFileSync(path.join(ROOT, 'email', file), 'utf8');
  source = source.replace(placeholder, JSON.stringify(templateHtml));
}

const distDir = path.join(__dirname, 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
writeFileSync(path.join(distDir, 'worker.js'), source);

console.log('Built dist/worker.js (' + source.length + ' bytes)');
