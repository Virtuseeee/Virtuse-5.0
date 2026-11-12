// Adapter for the Resend REST API. The only module that knows Resend's URLs,
// auth header and duplicate-contact wording; features call these methods.
//
// Each method takes a `label` for its error message, so a failure in the logs
// still says which flow broke (e.g. "Resend waitlist add failed (status 500): ...").

const API = 'https://api.resend.com';
const DUPLICATE_RE = /already exists|duplicate/i;

// The error carries the HTTP status, so a caller can tell Resend refusing the
// request (4xx, e.g. 422 for an address it will not deliver to) from an outage.
function failure(label, status, text) {
  const e = new Error(`${label} (status ${status}): ${text.slice(0, 300)}`);
  e.status = status;
  return e;
}

// fetchImpl defaults to the global fetch, looked up at call time.
export function createResendClient(apiKey, fetchImpl = (...args) => globalThis.fetch(...args)) {
  function call(method, path, body, extraHeaders = {}) {
    return fetchImpl(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  return {
    // opts.idempotencyKey: Resend sends at most one email per key (24 h), so a
    // retried or concurrent call cannot send the same message twice.
    async sendEmail(message, label = 'Resend send failed', opts = {}) {
      const res = await call('POST', '/emails', message, opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {});
      if (!res.ok) throw failure(label, res.status, await res.text());
    },

    // Global contact (the Brief list). Resend does not document duplicate
    // handling; anything that reads like "already exists" is a soft success,
    // because for the visitor being on the list already IS success.
    async createContact(contact, label = 'Resend contacts API failed') {
      const res = await call('POST', '/contacts', contact);
      if (res.ok) return { created: true };
      const text = await res.text();
      if (DUPLICATE_RE.test(text)) return { created: false, duplicate: true };
      throw failure(label, res.status, text);
    },

    // Audience-scoped contact: works for an address that is already a
    // global contact (the unscoped call would answer "already exists").
    async addToAudience(audienceId, contact, label) {
      const res = await call('POST', `/audiences/${audienceId}/contacts`, contact);
      if (res.ok) return { created: true };
      const text = await res.text();
      if (DUPLICATE_RE.test(text)) return { created: false };
      throw failure(label, res.status, text);
    },

    // The global contact for an address ({ unsubscribed, ... }), or null when
    // there is none. GET /contacts/{email}.
    async getContact(email, label = 'Resend get contact failed') {
      const res = await call('GET', `/contacts/${encodeURIComponent(email)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw failure(label, res.status, await res.text());
      return res.json();
    },

    // PATCH /contacts/{email}, e.g. { unsubscribed: false }.
    async updateContact(email, fields, label = 'Resend update contact failed') {
      const res = await call('PATCH', `/contacts/${encodeURIComponent(email)}`, fields);
      if (!res.ok) throw failure(label, res.status, await res.text());
    },

    // POST /contacts/{email}/segments/{segmentId}: an existing contact joins a
    // segment. "Already there" in any wording is fine.
    async addContactToSegment(email, segmentId, label = 'Resend add to segment failed') {
      const res = await call('POST', `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`);
      if (res.ok) return;
      const text = await res.text();
      if (DUPLICATE_RE.test(text)) return;
      throw failure(label, res.status, text);
    },

    // 404 means the address was never in that audience, which is fine.
    async unsubscribeFromAudience(audienceId, email, label) {
      const res = await call('PATCH', `/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`, { unsubscribed: true });
      if (res.ok || res.status === 404) return;
      throw failure(label, res.status, await res.text());
    },
  };
}
