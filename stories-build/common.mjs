/**
 * Helpers shared by build.mjs (story pages from WordPress) and hubs.mjs
 * (hub pages + related links, offline). One copy, so both produce the same
 * text from the same input.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SITE = path.resolve(HERE, '..', 'Kimi_Agent_Virtuse%20MiCA%20Partners');
export const ORIGIN = 'https://virtuse.com';
export const MANIFEST = path.join(HERE, 'manifest.json');
export const SITEMAP_START = '<!-- STORIES-BUILD:START -->';
export const SITEMAP_END = '<!-- STORIES-BUILD:END -->';

// Desk names for the pre-rendered kicker (article.js replaces it on load
// with the same value). Taken from article.js's LANGS.
export const DESK_NAMES = {
  en: { mining: 'Mining', treasury: 'Treasury', custody: 'Custody', policy: 'Policy', macro: 'Macro', markets: 'Markets' },
  sk: { mining: 'Ťažba', treasury: 'Treasury', custody: 'Úschova', policy: 'Regulácia', macro: 'Makro', markets: 'Trhy' },
  ru: { mining: 'Майнинг', treasury: 'Treasury', custody: 'Кастоди', policy: 'Регулирование', macro: 'Макро', markets: 'Рынки' },
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•' };
export function decode(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
export const text = (html) => decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
