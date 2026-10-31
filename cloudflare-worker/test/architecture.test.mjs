// Dependency rules of src/ (see README.md "Code layout"). They keep the
// layers from growing back into one another; a failure names the file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function files(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
}
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');
const ALL = files().map((p) => ({ file: rel(p), text: readFileSync(p, 'utf8') }));
const code = (text) => text.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
const imports = (text) => [...text.matchAll(/^(?:import|export)[^'"]*from\s+'([^']+)'/gm)].map((m) => m[1]);
const resolved = ({ file, text }) => imports(text).filter((s) => s.startsWith('.')).map((s) => path.posix.normalize(path.posix.join(path.posix.dirname(file), s)));

// Pure modules: rules, copy, rendering, scoring. No HTTP, no storage, no network.
const PURE = [
  'features/send/domain.js', 'features/waitlist/domain.js', 'features/ecosystem/domain.js', 'features/ecosystem/strings.js',
  'features/verdict/domain.js', 'features/verdict/result.js', 'features/verdict/limits.js', 'features/verdict-pay/domain.js',
  'features/pulse/schema.js', 'features/newsletter/segments.js', 'features/newsletter/welcome.js', 'features/newsletter/unsubscribe-page.js',
  'shared/crypto.js', 'config.js',
];

test('every pure module exists', () => {
  for (const f of PURE) assert.ok(ALL.some((m) => m.file === f), f);
});

test('pure modules do no I/O and import no HTTP or infrastructure code', () => {
  for (const m of ALL.filter((x) => PURE.includes(x.file))) {
    const c = code(m.text);
    assert.doesNotMatch(c, /\bfetch\(|new (Request|Response)\(|_KV\b|\.get\(key|\brequest\.(json|text|headers|method|url)\b/, m.file);
    for (const dep of resolved(m)) assert.doesNotMatch(dep, /^(http|infra)\/|^app\.js$|handler\.js$/, `${m.file} imports ${dep}`);
  }
});

test('the kernel (config, shared, http, infra) never depends on a feature or on app.js', () => {
  for (const m of ALL.filter((x) => /^(config\.js|shared\/|http\/|infra\/)/.test(x.file))) {
    for (const dep of resolved(m)) assert.doesNotMatch(dep, /^features\/|^app\.js$/, `${m.file} imports ${dep}`);
  }
});

test('only app.js wires features together; only index.js imports app.js', () => {
  for (const m of ALL) {
    for (const dep of resolved(m)) {
      if (dep === 'app.js') assert.equal(m.file, 'index.js', `${m.file} imports app.js`);
    }
  }
});

test('each external API has exactly one adapter', () => {
  const only = (pattern, allowed) => {
    const users = ALL.filter((m) => pattern.test(code(m.text))).map((m) => m.file).sort();
    assert.deepEqual(users, allowed, String(pattern));
  };
  only(/api\.resend\.com/, ['infra/resend.js']);
  only(/api\.stripe\.com/, ['infra/stripe.js']);
  only(/challenges\.cloudflare\.com/, ['infra/turnstile.js']);
  only(/@anthropic-ai\/sdk/, ['features/verdict/model.js']);
  only(/CF-Connecting-IP/, ['http/request.js']);
  only(/crypto\.subtle/, ['shared/crypto.js']);
});

test('rate limits go through shared/rate-limiter.js', () => {
  for (const m of ALL.filter((x) => x.file.startsWith('features/'))) {
    assert.doesNotMatch(code(m.text), /RATE_LIMIT_KV\.(get|put)\(/, m.file);
  }
});

test('feature handlers use the shared request helpers, not their own copies', () => {
  for (const m of ALL.filter((x) => x.file.startsWith('features/'))) {
    assert.doesNotMatch(code(m.text), /request\.json\(\)/, m.file);
  }
});
