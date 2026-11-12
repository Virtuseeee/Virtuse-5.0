// GET|HEAD /verdict/status -> { payments: true|false }
// Lets verdict.html show the closed state (waitlist, no card-payment copy) before
// the first click on a €14 button (Variant B). Read-only and public like /version:
// only the same boolean that POST /verdict/checkout would answer with a 503.
// Cached for 60 s at the edge and in the browser, so a switch of VERDICT_PAYMENTS
// shows within a minute.

import { paymentsOn } from './domain.js';

export function handleVerdictStatus(ctx) {
  return new Response(JSON.stringify({ payments: paymentsOn(ctx.env) }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
