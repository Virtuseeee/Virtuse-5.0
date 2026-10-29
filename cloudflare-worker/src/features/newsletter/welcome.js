// The Brief welcome email, one per language that has its own template.
//
// The HTML comes from email/welcome-template*.html, embedded at build time
// (build.mjs -> src/generated/welcome-templates.js) so no request ever
// depends on fetching it. To add a language: a template file, a row in
// build.mjs WELCOME_TEMPLATES and a row here -- see README.md's
// "Multi-language welcome emails" section.
//
// {{unsubscribe_url}} is filled per recipient (see unsubscribe-link.js):
// Resend's own unsubscribe merge tag only resolves for Broadcast sends.

import HTML from '../../generated/welcome-templates.js';

const welcomeTemplate = (lang, subject) => ({
  subject,
  html: (unsubscribeUrl) => HTML[lang].replace('{{unsubscribe_url}}', unsubscribeUrl),
});

export const WELCOME_EMAILS = {
  en: welcomeTemplate('en', 'Welcome to Virtuse Brief'),
  sk: welcomeTemplate('sk', 'Vitajte vo Virtuse Brief'),
};

export const WELCOME_LANGS = Object.keys(WELCOME_EMAILS);

// The language a Brief sign-up is recorded and welcomed in. A missing,
// non-string or unknown value (a bot, or a page that does not send it) is 'en'.
// Own keys only: `in` would also match Object.prototype keys ('toString',
// 'constructor', ...), which have no template.
export function welcomeLang(raw) {
  return typeof raw === 'string' && Object.hasOwn(WELCOME_EMAILS, raw) ? raw : 'en';
}

export function welcomeEmailFor(lang) {
  return Object.hasOwn(WELCOME_EMAILS, lang) ? WELCOME_EMAILS[lang] : WELCOME_EMAILS.en;
}
