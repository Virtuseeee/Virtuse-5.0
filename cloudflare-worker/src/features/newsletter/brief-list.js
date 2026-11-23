// Use cases on the Virtuse Brief list: join (contact + welcome email) and
// leave. Used by POST /subscribe, POST /send (brief: true) and the
// unsubscribe link.

import { allSegments, segmentFor } from './segments.js';
import { unsubscribeUrl } from './unsubscribe-link.js';
import { welcomeEmailFor } from './welcome.js';

// The Brief sender. Staging has no RESEND_FROM_EMAIL secret: it falls back to the
// RESEND_SEND_FROM var (plan@virtuse.com), so test emails still go out.
export const briefFrom = (env) => env.RESEND_FROM_EMAIL || env.RESEND_SEND_FROM;

export function createBriefList({ env, resend }) {
  async function addContact(email, lang) {
    // `lang` is stored as a Contact Property, which must exist in Resend
    // first (Contacts -> Properties) -- see README.md.
    return resend.createContact({ email, segments: [{ id: segmentFor(env, lang) }], properties: { lang } });
  }

  async function sendWelcome(email, lang) {
    const template = welcomeEmailFor(lang);
    const link = await unsubscribeUrl(env.UNSUB_SECRET, email);
    await resend.sendEmail({
      from: briefFrom(env),
      to: [email],
      subject: template.subject,
      html: template.html(link),
      // RFC 8058 one-click unsubscribe: Gmail and Apple Mail show their own button,
      // which POSTs to the same signed link (handled by POST /unsubscribe).
      headers: { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
  }

  return {
    sendWelcome,
    // The welcome email goes to genuinely new contacts and to someone who had
    // unsubscribed and signs up again, never to someone already on the list.
    async join(email, lang) {
      const result = await addContact(email, lang);
      if (result.created) {
        await sendWelcome(email, lang);
        return result;
      }
      // Already a contact. If they had unsubscribed, the form is their consent
      // to come back: clear the flag, put them in the segment, welcome them.
      // (Before 2026-11-12 the form answered "you are on the list" and changed nothing.)
      let existing = null;
      try {
        existing = await resend.getContact(email);
      } catch (e) {
        // Could not tell: keep the old behaviour (success, nothing sent).
        console.error(e);
        return result;
      }
      if (!existing || existing.unsubscribed !== true) return result;
      await resend.updateContact(email, { unsubscribed: false });
      await resend.addContactToSegment(email, segmentFor(env, lang));
      await sendWelcome(email, lang);
      return { created: false, duplicate: true, resubscribed: true };
    },

    async leave(email) {
      for (const segmentId of allSegments(env)) {
        await resend.unsubscribeFromAudience(segmentId, email, `Resend unsubscribe failed for segment ${segmentId}`);
      }
    },
  };
}
