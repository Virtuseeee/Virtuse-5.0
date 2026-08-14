#!/usr/bin/env node
// Takes this week's already-rendered dist/weekly-email.html (see
// render-pulse.mjs) and creates a broadcast in Resend. Unlike Zoho, Resend
// accepts HTML directly in the request body -- no public content_url, no
// gh-pages publish step, no OAuth token dance. Single API key, single
// endpoint, JSON in and out.
//
// By default this only creates a DRAFT broadcast for manual review and
// send. Pass SEND_NOW=true to also trigger the send immediately after.
//
// Required env vars:
//   RESEND_API_KEY, RESEND_SEGMENT_ID, RESEND_FROM_EMAIL
// Optional:
//   SEND_NOW=true   (also sends immediately; default is draft-only)
//
// Usage: node .github/scripts/create-resend-broadcast.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const issue = JSON.parse(readFileSync(path.join(ROOT, 'email', 'weekly-issue.json'), 'utf8'));
const html = readFileSync(path.join(ROOT, 'dist', 'weekly-email.html'), 'utf8');

const {
  RESEND_API_KEY,
  RESEND_SEGMENT_ID,
  RESEND_FROM_EMAIL,
  SEND_NOW = 'false',
} = process.env;

for (const [name, value] of Object.entries({ RESEND_API_KEY, RESEND_SEGMENT_ID, RESEND_FROM_EMAIL })) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

async function resendFetch(pathname, body) {
  const res = await fetch(`https://api.resend.com${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${pathname} returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`${pathname} failed (status ${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function createBroadcast() {
  return resendFetch('/broadcasts', {
    segment_id: RESEND_SEGMENT_ID,
    from: RESEND_FROM_EMAIL,
    subject: issue.subject || `The Virtuse Report — Issue #${issue.issue_number}`,
    name: `weekly-report-${issue.issue_date}`,
    html,
    send: false, // always create as a draft here; sending is a separate explicit step below
  });
}

async function sendBroadcast(broadcastId) {
  return resendFetch(`/broadcasts/${broadcastId}/send`, {});
}

async function main() {
  const created = await createBroadcast();
  console.log('Resend draft created:', JSON.stringify(created));

  const broadcastId = created.id;
  if (!broadcastId) {
    console.warn('No broadcast id found in the response -- cannot auto-send. Check the draft manually in Resend.');
    return;
  }

  if (SEND_NOW === 'true') {
    const sent = await sendBroadcast(broadcastId);
    console.log('Resend send triggered:', JSON.stringify(sent));
  } else {
    console.log(`Draft ready in Resend (broadcast ${broadcastId}). Review and send manually, or re-run the workflow with the "send" input set to true.`);
  }
}

main().catch((e) => {
  console.error('create-resend-broadcast failed:', e);
  process.exit(1);
});
