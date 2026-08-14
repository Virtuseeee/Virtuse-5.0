#!/usr/bin/env node
// Sends a single one-off test email via Resend's transactional /emails
// endpoint (not the broadcast API -- no segment involved, just one
// recipient), so you can see a template render in an actual inbox before
// trusting it in the real weekly/welcome flow.
//
// Required env vars: RESEND_API_KEY, RESEND_FROM_EMAIL
// Required args: --to, --template (path to an HTML file), --subject

import { readFileSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const to = arg('to');
const templatePath = arg('template');
const subject = arg('subject', 'Virtuse test send');

if (!to || !templatePath) {
  console.error('Usage: node send-test-email.mjs --to you@example.com --template email/welcome-template.html [--subject "..."]');
  process.exit(1);
}

const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
for (const [name, value] of Object.entries({ RESEND_API_KEY, RESEND_FROM_EMAIL })) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

const html = readFileSync(templatePath, 'utf8');

async function main() {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject: `[TEST] ${subject}`,
      html,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`/emails returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`/emails failed (status ${res.status}): ${JSON.stringify(data)}`);
  }

  console.log(`Test email sent to ${to} -- Resend id: ${data.id}`);
}

main().catch((e) => {
  console.error('send-test-email failed:', e);
  process.exit(1);
});
