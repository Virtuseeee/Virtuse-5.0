#!/usr/bin/env node
// Takes the public URL where this week's rendered email now lives (pushed to
// gh-pages by the workflow, see weekly-pulse.yml) and hands it to Zoho
// Campaigns via createCampaign's content_url param -- Zoho fetches and
// imports the HTML from that URL, it does not accept raw HTML in the request.
//
// By default this only creates a DRAFT campaign in Zoho for manual review
// and send. Pass SEND_NOW=true to also trigger sendcampaign immediately.
//
// Required env vars:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_LIST_KEY, ZOHO_FROM_EMAIL
// Optional env vars:
//   ZOHO_ACCOUNTS_DOMAIN (default: accounts.zoho.com -- change for .eu/.in/etc. data centers)
//   ZOHO_API_DOMAIN      (default: campaigns.zoho.com -- same caveat)
//   SEND_NOW=true         (also calls sendcampaign; default is draft-only)
//
// Usage: node .github/scripts/create-zoho-draft.mjs <public-content-url>

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const issue = JSON.parse(readFileSync(path.join(ROOT, 'email', 'weekly-issue.json'), 'utf8'));

const contentUrl = process.argv[2];
if (!contentUrl) {
  console.error('Usage: node create-zoho-draft.mjs <public-content-url>');
  process.exit(1);
}

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_LIST_KEY,
  ZOHO_FROM_EMAIL,
  ZOHO_ACCOUNTS_DOMAIN = 'accounts.zoho.com',
  ZOHO_API_DOMAIN = 'campaigns.zoho.com',
  SEND_NOW = 'false',
} = process.env;

for (const [name, value] of Object.entries({
  ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_LIST_KEY, ZOHO_FROM_EMAIL,
})) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

async function getAccessToken() {
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`https://${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token?${params}`, { method: 'POST' });
  const data = await res.json();
  if (!data.access_token) throw new Error('Zoho token refresh failed: ' + JSON.stringify(data));
  return data.access_token;
}

async function createCampaign(accessToken) {
  const params = new URLSearchParams({
    resfmt: 'JSON',
    campaignname: `weekly-report-${issue.issue_date}`,
    from_email: ZOHO_FROM_EMAIL,
    subject: issue.subject || `The Virtuse Report — Issue #${issue.issue_number}`,
    content_url: contentUrl,
    list_details: JSON.stringify({ [ZOHO_LIST_KEY]: [] }),
  });
  const res = await fetch(`https://${ZOHO_API_DOMAIN}/api/v1.1/createCampaign?${params}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`createCampaign returned non-JSON response (status ${res.status}): ${text.slice(0, 500)}`);
  }
  if (data.status && data.status !== 'success' && !data.campaignkey) {
    throw new Error('createCampaign failed: ' + JSON.stringify(data));
  }
  return data;
}

async function sendCampaign(accessToken, campaignkey) {
  const params = new URLSearchParams({ resfmt: 'JSON', campaignkey });
  const res = await fetch(`https://${ZOHO_API_DOMAIN}/api/v1.1/sendcampaign?${params}`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  return res.json();
}

async function main() {
  const accessToken = await getAccessToken();
  const created = await createCampaign(accessToken);
  console.log('Zoho draft created:', JSON.stringify(created));

  const campaignkey = created.campaignkey || created?.data?.[0]?.campaignkey;
  if (!campaignkey) {
    console.warn('No campaignkey found in the response -- cannot auto-send. Check the draft manually in Zoho Campaigns.');
    return;
  }

  if (SEND_NOW === 'true') {
    const sent = await sendCampaign(accessToken, campaignkey);
    console.log('Zoho send triggered:', JSON.stringify(sent));
  } else {
    console.log(`Draft ready in Zoho Campaigns (campaignkey ${campaignkey}). Review and send manually, or re-run the workflow with the "send" input set to true.`);
  }
}

main().catch((e) => {
  console.error('create-zoho-draft failed:', e);
  process.exit(1);
});
