// Public bundle of the Partner Finder engine for Verdict's result page
// (verdict-result-v2 §6). Built by vite.lib.config.ts into the site as
// pf-recommend.js (global VBPartners), so Verdict shows the same partners, in
// the same fixed order, as Partner Finder: one catalog, never a hand copy.
import { recommend, PARTNERS, ESMA_MICA_URL, LICENCE_CHECKED, GOALS, COUNTRIES, EXPERIENCE, CUSTODY } from './concierge';
export { recommend, PARTNERS, ESMA_MICA_URL, LICENCE_CHECKED, GOALS, COUNTRIES, EXPERIENCE, CUSTODY };
