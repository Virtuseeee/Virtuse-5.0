// Public bundle of the Partner Finder engine for Verdict's result page
// (verdict-result-v2 §6). Built by vite.lib.config.ts into the site as
// pf-recommend.js (global VBPartners), so Verdict shows the same partners, in
// the same fixed order, as Partner Finder: one catalog, never a hand copy.
import { recommend, PARTNERS, ESMA_MICA_URL, LICENCE_CHECKED, GOALS, COUNTRIES, EXPERIENCE, CUSTODY } from './concierge';
import { registerDict, L } from './i18n';
export { recommend, PARTNERS, ESMA_MICA_URL, LICENCE_CHECKED, GOALS, COUNTRIES, EXPERIENCE, CUSTODY };
// Languages other than en/sk/cs: verdict-flow.js loads pf-dict-<lang>.js
// (scripts/gen-pf-dicts.mjs, only the strings concierge.ts uses), passes it to
// registerDict, and reads labels through L like the modules do.
export { registerDict, L };
