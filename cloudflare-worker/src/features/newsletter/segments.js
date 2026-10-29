// Which Resend segment a Brief contact joins.
//
// lang -> the Worker secret name holding that language's dedicated Resend
// segment id. A language NOT listed here (including 'en') uses the default
// RESEND_SEGMENT_ID instead; Slovak sign-ups join the dedicated "Ot emails"
// segment INSTEAD OF the default one, not in addition to it. Add a row here
// (and `wrangler secret put` the secret) for each language that gets its own
// segment -- see README.md's "Per-language segments" section.
//
// This is the ONE place to edit: joining (segmentFor) and unsubscribing
// (allSegments: the unsubscribe link carries no lang, so every configured
// segment is checked) both derive from this map.
const LANG_SEGMENT_SECRETS = { sk: 'RESEND_SK_SEGMENT_ID' };

export function segmentFor(env, lang) {
  // Own keys only, so 'constructor' etc. never resolve to a prototype member.
  const secretName = Object.hasOwn(LANG_SEGMENT_SECRETS, lang) ? LANG_SEGMENT_SECRETS[lang] : undefined;
  return (secretName ? env[secretName] : undefined) || env.RESEND_SEGMENT_ID;
}

export function allSegments(env) {
  const perLang = Object.values(LANG_SEGMENT_SECRETS)
    .map((secretName) => env[secretName])
    .filter(Boolean);
  return [...new Set([env.RESEND_SEGMENT_ID, ...perLang].filter(Boolean))];
}
