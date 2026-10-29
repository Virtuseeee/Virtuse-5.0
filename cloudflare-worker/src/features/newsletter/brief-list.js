// Use cases on the Virtuse Brief list: join (contact + welcome email) and
// leave. Used by POST /subscribe, POST /send (brief: true) and the
// unsubscribe link.

import { allSegments, segmentFor } from './segments.js';
import { unsubscribeUrl } from './unsubscribe-link.js';
import { welcomeEmailFor } from './welcome.js';

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
      from: env.RESEND_FROM_EMAIL,
      to: [email],
      subject: template.subject,
      html: template.html(link),
    });
  }

  return {
    // The welcome email goes only to genuinely new contacts, never again to
    // someone already on the list.
    async join(email, lang) {
      const result = await addContact(email, lang);
      if (result.created) await sendWelcome(email, lang);
      return result;
    },

    async leave(email) {
      for (const segmentId of allSegments(env)) {
        await resend.unsubscribeFromAudience(segmentId, email, `Resend unsubscribe failed for segment ${segmentId}`);
      }
    },
  };
}
