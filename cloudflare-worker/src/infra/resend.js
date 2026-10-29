// Adapter for the Resend REST API. The only module that knows Resend's URLs,
// auth header and duplicate-contact wording; features call these methods.
//
// Each method takes a `label` for its error message, so a failure in the logs
// still says which flow broke (e.g. "Resend waitlist add failed (status 500): ...").

const API = 'https://api.resend.com';
const DUPLICATE_RE = /already exists|duplicate/i;

function failure(label, status, text) {
  return new Error(`${label} (status ${status}): ${text.slice(0, 300)}`);
}

// fetchImpl defaults to the global fetch, looked up at call time.
export function createResendClient(apiKey, fetchImpl = (...args) => globalThis.fetch(...args)) {
  function call(method, path, body) {
    return fetchImpl(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  return {
    async sendEmail(message, label = 'Resend send failed') {
      const res = await call('POST', '/emails', message);
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

    // 404 means the address was never in that audience, which is fine.
    async unsubscribeFromAudience(audienceId, email, label) {
      const res = await call('PATCH', `/audiences/${audienceId}/contacts/${encodeURIComponent(email)}`, { unsubscribed: true });
      if (res.ok || res.status === 404) return;
      throw failure(label, res.status, await res.text());
    },
  };
}
