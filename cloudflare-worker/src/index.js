// Virtuse Worker: the one piece of server-side compute behind the static
// site. It holds the secrets (Resend, Anthropic, Turnstile), validates and
// rate-limits every request, and is the only thing that talks to those APIs
// on the public's behalf.
//
// POST /subscribe        Brief sign-up              features/newsletter/
// GET  /unsubscribe      signed link from emails    features/newsletter/
// POST /send             one email the visitor asked for (plan / result / checklist)  features/send/
// POST /waitlist         Virtuse CFO waitlist       features/waitlist/
// POST /ecosystem-apply  "Get your project featured"   features/ecosystem/
// POST /verdict          Virtuse CFO · Verdict      features/verdict/
// GET|PUT /pulse.json, POST /pulse/rollback   Brief Pulse   features/pulse/
// GET  /wp/...           read-only WordPress proxy  features/wp-proxy/
// GET  /version          live build commit          features/version/
//
// Route order and wiring: app.js. Secrets and vars: README.md, wrangler.toml.

import { createWorker } from './app.js';

export { handlePulse } from './features/pulse/handler.js';
export { pulseErrors } from './features/pulse/schema.js';

export default createWorker();
