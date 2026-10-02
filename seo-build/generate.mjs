#!/usr/bin/env node
/**
 * Deterministic SEO page generator.
 * Same input JSON = same HTML. Numbers come only from seo-build/data/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_DIR_NAME,
  esc,
  wordCount,
  fitWords,
  formatAsOf,
  formatPct,
  formatEur,
  formatPctDe,
  formatEurDe,
  methodDe,
  formatPctSk,
  formatEurSk,
  methodSk,
  methodCs,
  formatPctPl,
  methodPl,
  methodHu,
  methodUk,
  methodRu,
  methodFr,
  nbspFr,
  methodEs,
  formatEurEs,
  nbspEs,
  toRoot,
  canonicalPath,
  assertTitle,
  assertDescription,
  resolveSiteOrigin,
  rewriteKnownOrigins
} from './lib/util.mjs';
import { rankRoutes, cheapest, breakEvenBotsVsManual, DEFAULT_CONTRIBUTIONS, routeCost } from './lib/fees.mjs';
import { renderPage, CHROME } from './lib/html.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(ROOT);
const SITE = path.join(REPO, SITE_DIR_NAME);
const DATA = path.join(ROOT, 'data');

const seoData = JSON.parse(fs.readFileSync(path.join(DATA, 'seo-data.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'));
const inheritance = JSON.parse(fs.readFileSync(path.join(DATA, 'inheritance.json'), 'utf8'));
const liveFees = JSON.parse(fs.readFileSync(path.join(DATA, 'fee-schedule-live.json'), 'utf8'));
// Frozen Q3 2026 schedule for the /bitcoin-fee-index/2026-q3/ archive (citations must not move).
const FEE_ROWS_Q3 = JSON.parse(fs.readFileSync(path.join(DATA, 'fee-schedule-2026-q3.json'), 'utf8')).rows;

const ORIGIN = resolveSiteOrigin(meta.site.origin);
const AS_OF = seoData.asOf;
const LASTMOD = seoData.lastmod;
const CTAS = seoData.moduleCtas;
const COUNTRIES = seoData.countries;
const N = COUNTRIES.length; // country count shown in copy (was hardcoded 11)
const FEE_ROWS = meta.feeSource === 'live' ? liveFees.rows : seoData.feeSchedule.map((row, i) => ({
  id: `brief-${i}`,
  kind: /bot|auto|dca/i.test(`${row.partner} ${row.method}`) ? 'automated' : 'manual',
  monthly: /bot/i.test(row.partner) || /dca/i.test(row.method) ? 4 : 0,
  ...row
}));

const asOfEn = formatAsOf(AS_OF, 'en');
const asOfDe = formatAsOf(AS_OF, 'de');
const asOfSk = formatAsOf(AS_OF, 'sk');
const asOfCs = formatAsOf(AS_OF, 'cs');
const asOfPl = formatAsOf(AS_OF, 'pl');
const asOfHu = formatAsOf(AS_OF, 'hu');
const asOfUk = formatAsOf(AS_OF, 'uk');
const asOfRu = formatAsOf(AS_OF, 'ru');
const asOfFr = formatAsOf(AS_OF, 'fr');
const asOfEs = formatAsOf(AS_OF, 'es');
// Fee pages (fee index, DCA, buy routes) follow the fee schedule's own quarter;
// tax-derived pages keep AS_OF until the tax advisor's review (2026-10-02).
const FEE_AS_OF = liveFees.asOf;
const feeAsOfEn = formatAsOf(FEE_AS_OF, 'en');
const feeAsOfDe = formatAsOf(FEE_AS_OF, 'de');
const feeAsOfSk = formatAsOf(FEE_AS_OF, 'sk');
const feeAsOfCs = formatAsOf(FEE_AS_OF, 'cs');
const feeAsOfPl = formatAsOf(FEE_AS_OF, 'pl');
const feeAsOfHu = formatAsOf(FEE_AS_OF, 'hu');
const feeAsOfUk = formatAsOf(FEE_AS_OF, 'uk');
const feeAsOfRu = formatAsOf(FEE_AS_OF, 'ru');
const feeAsOfFr = formatAsOf(FEE_AS_OF, 'fr');
const feeAsOfEs = formatAsOf(FEE_AS_OF, 'es');

function slugEn(id) {
  const s = meta.slugs.en[id];
  if (!s) throw new Error(`Missing EN slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function slugDe(id) {
  const s = meta.slugs.de[id];
  if (!s) throw new Error(`Missing DE slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameDe(id) {
  const s = meta.names.de[id];
  if (!s) throw new Error(`Missing DE name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function slugSk(id) {
  const s = meta.slugs.sk[id];
  if (!s) throw new Error(`Missing SK slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameSk(id) {
  const s = meta.names.sk[id];
  if (!s) throw new Error(`Missing SK name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function slugCs(id) {
  const s = meta.slugs.cs[id];
  if (!s) throw new Error(`Missing CS slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameCs(id) {
  const s = meta.names.cs[id];
  if (!s) throw new Error(`Missing CS name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** "v/na/ve <zemi>" in Czech (na Slovensku, ve Francii). */
function inCs(id) { return meta.inCs[id]; }
function slugPl(id) {
  const s = meta.slugs.pl[id];
  if (!s) throw new Error(`Missing PL slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function namePl(id) {
  const s = meta.names.pl[id];
  if (!s) throw new Error(`Missing PL name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** Polish locative (w Czechach, na Węgrzech, we Francji) and accusative (Słowację). */
function inPl(id) { return meta.inPl[id]; }
function accPl(id) { return meta.accPl[id]; }
function slugHu(id) {
  const s = meta.slugs.hu[id];
  if (!s) throw new Error(`Missing HU slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameHu(id) {
  const s = meta.names.hu[id];
  if (!s) throw new Error(`Missing HU name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function slugUk(id) {
  const s = meta.slugs.uk[id];
  if (!s) throw new Error(`Missing UK slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameUk(id) {
  const s = meta.names.uk[id];
  if (!s) throw new Error(`Missing UK name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** Ukrainian locative (у Словаччині, в Австрії) and accusative (Словаччину). */
function inUk(id) { return meta.inUk[id]; }
function accUk(id) { return meta.accUk[id]; }
function slugRu(id) {
  const s = meta.slugs.ru[id];
  if (!s) throw new Error(`Missing RU slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameRu(id) {
  const s = meta.names.ru[id];
  if (!s) throw new Error(`Missing RU name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** Russian prepositional (в Словакии, во Франции) and accusative (Словакию). */
function inRu(id) { return meta.inRu[id]; }
function accRu(id) { return meta.accRu[id]; }
function slugFr(id) {
  const s = meta.slugs.fr[id];
  if (!s) throw new Error(`Missing FR slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameFr(id) {
  const s = meta.names.fr[id];
  if (!s) throw new Error(`Missing FR name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** French "en Slovaquie / aux Pays-Bas" and the name with its article (la Slovaquie, l'Autriche). */
function inFr(id) { return meta.inFr[id]; }
function defFr(id) { return meta.defFr[id]; }
function slugEs(id) {
  const s = meta.slugs.es[id];
  if (!s) throw new Error(`Missing ES slug for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
function nameEs(id) {
  const s = meta.names.es[id];
  if (!s) throw new Error(`Missing ES name for country id "${id}". Add it in seo-build/data/meta.json.`);
  return s;
}
/** Spanish "en <país>" (en la República Checa, en los Países Bajos) and the name with its article where Spanish uses one. */
function inEs(id) { return meta.inEs[id]; }
function defEs(id) { return (meta.defEs && meta.defEs[id]) || nameEs(id); }
/** Apply French typography to every text field of a page spec (URLs and schema keys untouched). */
const FR_SKIP_KEYS = new Set(['url', '@id', 'item', '@type', '@context', 'temporalCoverage', 'datePublished', 'dateModified', 'priceCurrency', 'price', 'applicationCategory', 'operatingSystem', 'inLanguage']);
function typoDeep(v, key, fn) {
  if (typeof v === 'string') return FR_SKIP_KEYS.has(key) ? v : fn(v);
  if (Array.isArray(v)) return v.map((x) => typoDeep(x, key, fn));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typoDeep(x, k, fn)]));
  return v;
}
/** Run a typography function (nbspFr, nbspEs) over every text field of a page spec. */
function typoSpec(spec, fn) {
  return {
    ...spec,
    title: fn(spec.title),
    description: fn(spec.description),
    h1: fn(spec.h1),
    answerHtml: fn(spec.answerHtml),
    bodyHtml: fn(spec.bodyHtml),
    breadcrumbs: spec.breadcrumbs.map((b) => ({ ...b, name: fn(b.name) })),
    related: spec.related.map((r) => ({ ...r, label: fn(r.label) })),
    moduleCta: spec.moduleCta && { ...spec.moduleCta, label: fn(spec.moduleCta.label) },
    schemas: typoDeep(spec.schemas, '', fn)
  };
}
/** Hungarian inessive: -ban/-ben, but Magyarországon. */
function inHu(id) { return meta.inHu[id]; }
/** Czech accusative: only Francie changes (Francii); the -o names stay. */
function accCs(id) { return (meta.accCs && meta.accCs[id]) || nameCs(id); }
/** "v/na/vo <krajine>" in Slovak (na Slovensku, vo Francúzsku). */
function inSk(id) { return meta.inSk[id]; }
/** "in <country>" in German: a few names take an article (in der Slowakei, in den Niederlanden). */
function inDe(id) { return (meta.inDe && meta.inDe[id]) || `in ${nameDe(id)}`; }
function countryById(id) { return COUNTRIES.find((c) => c.id === id); }
/** English country name inside a sentence: "the Netherlands" takes an article. */
function theEn(c) { return c.id === 'nl' ? 'the Netherlands' : c.name; }
function TheEn(c) { const n = theEn(c); return n.charAt(0).toUpperCase() + n.slice(1); }
function lcFirst(t) { return t.charAt(0).toLowerCase() + t.slice(1); }

/** Live Tax & Inheritance Agent. seo-data.moduleCtas.tax is /tax.html (category page). */
const TAX_AGENT = 'tax-agent.html';

function abs(p) {
  const c = p.startsWith('/') ? p : canonicalPath(p);
  return ORIGIN + c;
}

/** EN page -> its Slovak counterpart (the sk/ set mirrors the German pilot). */
const SK_ALT = {
  'bitcoin-tax/index.html': 'sk/bitcoin-dane/index.html',
  'bitcoin-dca-calculator/index.html': 'sk/bitcoin-dca-kalkulacka/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'sk/bitcoin-predat-alebo-pozicat/index.html',
  'bitcoin-inheritance/index.html': 'sk/bitcoin-dedicstvo/index.html',
  'bitcoin-fee-index/index.html': 'sk/bitcoin-index-poplatkov/index.html'
};
for (const c of COUNTRIES) {
  SK_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `sk/bitcoin-dane/${meta.slugs.sk[c.id]}/index.html`;
}
/** EN page -> its Czech counterpart. */
const CS_ALT = {
  'bitcoin-tax/index.html': 'cs/bitcoin-dane/index.html',
  'bitcoin-dca-calculator/index.html': 'cs/bitcoin-dca-kalkulacka/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'cs/bitcoin-prodat-nebo-pujcit/index.html',
  'bitcoin-inheritance/index.html': 'cs/bitcoin-dedictvi/index.html',
  'bitcoin-fee-index/index.html': 'cs/bitcoin-index-poplatku/index.html'
};
for (const c of COUNTRIES) {
  CS_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `cs/bitcoin-dane/${meta.slugs.cs[c.id]}/index.html`;
}
/** EN page -> its Polish counterpart. */
const PL_ALT = {
  'bitcoin-tax/index.html': 'pl/bitcoin-podatki/index.html',
  'bitcoin-dca-calculator/index.html': 'pl/bitcoin-kalkulator-dca/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'pl/bitcoin-sprzedac-czy-pozyczyc/index.html',
  'bitcoin-inheritance/index.html': 'pl/bitcoin-dziedziczenie/index.html',
  'bitcoin-fee-index/index.html': 'pl/bitcoin-indeks-oplat/index.html'
};
for (const c of COUNTRIES) {
  PL_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `pl/bitcoin-podatki/${meta.slugs.pl[c.id]}/index.html`;
}
/** EN page -> its Hungarian counterpart. */
const HU_ALT = {
  'bitcoin-tax/index.html': 'hu/bitcoin-adozas/index.html',
  'bitcoin-dca-calculator/index.html': 'hu/bitcoin-dca-kalkulator/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'hu/bitcoin-eladas-vagy-hitel/index.html',
  'bitcoin-inheritance/index.html': 'hu/bitcoin-orokles/index.html',
  'bitcoin-fee-index/index.html': 'hu/bitcoin-dijindex/index.html'
};
for (const c of COUNTRIES) {
  HU_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `hu/bitcoin-adozas/${meta.slugs.hu[c.id]}/index.html`;
}
/** EN page -> its Ukrainian counterpart. */
const UK_ALT = {
  'bitcoin-tax/index.html': 'uk/bitcoin-podatky/index.html',
  'bitcoin-dca-calculator/index.html': 'uk/bitcoin-kalkuliator-dca/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'uk/bitcoin-prodaty-chy-pozychyty/index.html',
  'bitcoin-inheritance/index.html': 'uk/bitcoin-spadshchyna/index.html',
  'bitcoin-fee-index/index.html': 'uk/bitcoin-indeks-komisii/index.html'
};
for (const c of COUNTRIES) {
  UK_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `uk/bitcoin-podatky/${meta.slugs.uk[c.id]}/index.html`;
}
/** EN page -> its Russian counterpart. */
const RU_ALT = {
  'bitcoin-tax/index.html': 'ru/bitcoin-nalogi/index.html',
  'bitcoin-dca-calculator/index.html': 'ru/bitcoin-kalkulyator-dca/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'ru/bitcoin-prodat-ili-zanyat/index.html',
  'bitcoin-inheritance/index.html': 'ru/bitcoin-nasledstvo/index.html',
  'bitcoin-fee-index/index.html': 'ru/bitcoin-indeks-komissiy/index.html'
};
for (const c of COUNTRIES) {
  RU_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `ru/bitcoin-nalogi/${meta.slugs.ru[c.id]}/index.html`;
}
/** EN page -> its French counterpart. */
const FR_ALT = {
  'bitcoin-tax/index.html': 'fr/bitcoin-fiscalite/index.html',
  'bitcoin-dca-calculator/index.html': 'fr/bitcoin-calculateur-dca/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'fr/bitcoin-vendre-ou-emprunter/index.html',
  'bitcoin-inheritance/index.html': 'fr/bitcoin-succession/index.html',
  'bitcoin-fee-index/index.html': 'fr/bitcoin-indice-frais/index.html'
};
for (const c of COUNTRIES) {
  FR_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `fr/bitcoin-fiscalite/${meta.slugs.fr[c.id]}/index.html`;
}
/** EN page -> its Spanish counterpart. */
const ES_ALT = {
  'bitcoin-tax/index.html': 'es/bitcoin-impuestos/index.html',
  'bitcoin-dca-calculator/index.html': 'es/bitcoin-calculadora-dca/index.html',
  'sell-vs-borrow-bitcoin/index.html': 'es/bitcoin-vender-o-pedir-prestado/index.html',
  'bitcoin-inheritance/index.html': 'es/bitcoin-herencia/index.html',
  'bitcoin-fee-index/index.html': 'es/bitcoin-indice-comisiones/index.html'
};
for (const c of COUNTRIES) {
  ES_ALT[`bitcoin-tax/${meta.slugs.en[c.id]}/index.html`] = `es/bitcoin-impuestos/${meta.slugs.es[c.id]}/index.html`;
}

function hrefLangPair(enPath, dePath) {
  const tags = [
    { lang: 'en', href: abs(enPath), path: canonicalPath(enPath) },
    { lang: 'x-default', href: abs(enPath), path: canonicalPath(enPath) }
  ];
  const esPath = ES_ALT[enPath];
  if (esPath) {
    tags.splice(1, 0, { lang: 'es', href: abs(esPath), path: canonicalPath(esPath) });
  }
  const frPath = FR_ALT[enPath];
  if (frPath) {
    tags.splice(1, 0, { lang: 'fr', href: abs(frPath), path: canonicalPath(frPath) });
  }
  const ruPath = RU_ALT[enPath];
  if (ruPath) {
    tags.splice(1, 0, { lang: 'ru', href: abs(ruPath), path: canonicalPath(ruPath) });
  }
  const ukPath = UK_ALT[enPath];
  if (ukPath) {
    tags.splice(1, 0, { lang: 'uk', href: abs(ukPath), path: canonicalPath(ukPath) });
  }
  const huPath = HU_ALT[enPath];
  if (huPath) {
    tags.splice(1, 0, { lang: 'hu', href: abs(huPath), path: canonicalPath(huPath) });
  }
  const plPath = PL_ALT[enPath];
  if (plPath) {
    tags.splice(1, 0, { lang: 'pl', href: abs(plPath), path: canonicalPath(plPath) });
  }
  const csPath = CS_ALT[enPath];
  if (csPath) {
    tags.splice(1, 0, { lang: 'cs', href: abs(csPath), path: canonicalPath(csPath) });
  }
  const skPath = SK_ALT[enPath];
  if (skPath) {
    tags.splice(1, 0, { lang: 'sk', href: abs(skPath), path: canonicalPath(skPath) });
  }
  if (dePath) {
    tags.splice(1, 0, { lang: 'de', href: abs(dePath), path: canonicalPath(dePath) });
  }
  return tags;
}

function faqLd(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.q,
      acceptedAnswer: { '@type': 'Answer', text: q.a }
    }))
  };
}

function faqHtml(items, heading) {
  return `<h2>${esc(heading)}</h2>` + items.map((q) =>
    `<h3>${esc(q.q)}</h3><p>${esc(q.a)}</p>`
  ).join('');
}

function tableHtml(headers, rows) {
  const thead = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><thead>${thead}</thead><tbody>${body}</tbody></table></div>`;
}

function neighborsOf(id) {
  const ids = meta.neighbors[id] || [];
  return ids.map(countryById).filter(Boolean);
}

function finalizeAnswer(parts, lang, kind = 'tax') {
  const fee = kind === 'fee';
  const pads = lang === 'de'
    ? [
      `Angaben aus den Live-Modulen von Virtuse, Stand ${fee ? feeAsOfDe : asOfDe}.`,
      'Virtuse verwahrt niemals Ihre Schlüssel.',
      'Bitte lokal prüfen; keine Steuerberatung.'
    ]
    : lang === 'es' ? [
      `Datos procedentes de los módulos de Virtuse, del ${fee ? feeAsOfEs : asOfEs}.`,
      'Virtuse nunca guarda sus claves.',
      'Compruebe las normas locales; no es asesoramiento fiscal.'
    ]
    : lang === 'fr' ? [
      `Données issues des modules Virtuse, situation au ${fee ? feeAsOfFr : asOfFr}.`,
      'Virtuse ne détient jamais vos clés.',
      'Vérifiez les règles locales ; pas un conseil fiscal.'
    ]
    : lang === 'ru' ? [
      `Данные из модулей Virtuse по состоянию на ${fee ? feeAsOfRu : asOfRu}.`,
      'Virtuse никогда не хранит ваши ключи.',
      'Проверьте местные правила; это не налоговая консультация.'
    ]
    : lang === 'uk' ? [
      `Дані з модулів Virtuse станом на ${fee ? feeAsOfUk : asOfUk}.`,
      'Virtuse ніколи не зберігає ваші ключі.',
      'Перевірте місцеві правила; це не податкова консультація.'
    ]
    : lang === 'hu' ? [
      `Adatok a Virtuse élő moduljaiból, ${fee ? feeAsOfHu : asOfHu} állapot szerint.`,
      'A Virtuse soha nem kezeli az Ön kulcsait.',
      'Érdemes ellenőrizni a helyi szabályokat; nem adótanácsadás.'
    ]
    : lang === 'pl' ? [
      `Dane z modułów Virtuse na żywo, stan na ${fee ? feeAsOfPl : asOfPl}.`,
      'Virtuse nigdy nie przechowuje Państwa kluczy.',
      'Warto sprawdzić lokalne przepisy; to nie porada podatkowa.'
    ]
    : lang === 'cs' ? [
      `Údaje z živých modulů Virtuse, stav ${fee ? feeAsOfCs : asOfCs}.`,
      'Virtuse nikdy nedrží vaše klíče.',
      'Ověřte si místní pravidla; nejde o daňové poradenství.'
    ]
    : lang === 'sk' ? [
      `Údaje z live modulov Virtuse, stav ${fee ? feeAsOfSk : asOfSk}.`,
      'Virtuse nikdy nedrží vaše kľúče.',
      'Overte si miestne pravidlá; nejde o daňové poradenstvo.'
    ]
    : [
      `Figures taken from Virtuse’s live modules, as of ${fee ? feeAsOfEn : asOfEn}.`,
      'Virtuse never holds your keys.',
      'Check local rules; not tax advice.'
    ];
  let text = fitWords(parts, 1, 60);
  for (const pad of pads) {
    if (wordCount(text) >= 40) break;
    const trial = `${text} ${pad}`;
    if (wordCount(trial) <= 60) text = trial;
  }
  const n = wordCount(text);
  if (n < 40 || n > 60) {
    throw new Error(`answer words ${n} (${lang}): ${text}`);
  }
  return text;
}

function taxAnswerEn(c) {
  return finalizeAnswer([
    `Bitcoin tax in ${theEn(c)} as of ${asOfEn}: ${c.gainTax}.`,
    `Exemption: ${c.exemption}.`,
    `Filing: ${c.filing}.`,
    c.note,
    'Indicative 2026 overview, not tax advice.'
  ], 'en');
}

function taxAnswerDe(c) {
  const d = meta.taxDe[c.id];
  return finalizeAnswer([
    `Bitcoin-Steuern ${inDe(c.id)}, Stand ${asOfDe}: ${d.gainTax}.`,
    `Befreiung: ${d.exemption}.`,
    `Veranlagung: ${d.filing}.`,
    d.note,
    'Unverbindlicher Überblick 2026, keine Steuerberatung.'
  ], 'de');
}

function buyAnswerEn(c, winner) {
  const cur = meta.currency[c.id];
  const extra = c.id === 'nl'
    ? `In the Netherlands, Box 3 still applies to holdings after you buy, because tax is on a deemed return rather than on disposal gains.`
    : `Tax usually arises only when you sell or swap later; exemption in ${theEn(c)}: ${lcFirst(c.exemption)}.`;
  return finalizeAnswer([
    `As of ${feeAsOfEn}, the cheapest buy route on the Virtuse Fee Index at €100/month is ${winner.partner} (${winner.method}): ${formatPct(winner.pct)} variable fee, ${formatEur(winner.annualDrag)} annual fee drag.`,
    extra,
    cur === 'EUR' ? '' : `From ${theEn(c)}, you usually fund a EUR account by SEPA transfer after converting ${cur}; partner KYC applies.`,
    'Virtuse never holds your keys.'
  ].filter(Boolean), 'en');
}

const DEFAULT_MONTHLY = 100;
const winnerDefault = cheapest(FEE_ROWS, DEFAULT_MONTHLY);
const rankedDefault = rankRoutes(FEE_ROWS, DEFAULT_MONTHLY);
const be = breakEvenBotsVsManual(FEE_ROWS);

function taxFaqsEn(c) {
  return [
    {
      q: `What is the bitcoin tax rate in ${theEn(c)}?`,
      a: `As of ${asOfEn}, bitcoin gains in ${theEn(c)} are taxed as follows: ${c.gainTax}. This is an indicative 2026 overview, not tax advice.`
    },
    {
      q: `Is there a holding-period exemption in ${theEn(c)}?`,
      a: `${c.exemption}. Confirm the current year’s rules with a local advisor before you file.`
    },
    {
      q: `How do you file bitcoin taxes in ${theEn(c)}?`,
      a: `${c.filing}. ${c.note}`
    },
    {
      q: 'Does Virtuse hold my bitcoin or file my tax return?',
      a: `No. Virtuse never holds your keys. KYC and onboarding happen on each partner’s regulated platform. Use the Tax & Inheritance Agent to compare the ${N}-country overview, then file with a qualified advisor.`
    }
  ];
}

function taxFaqsDe(c) {
  const d = meta.taxDe[c.id];
  const inN = inDe(c.id);
  return [
    {
      q: `Wie werden Bitcoin-Gewinne ${inN} besteuert?`,
      a: `Stand ${asOfDe}: ${d.gainTax}. Unverbindlicher Überblick 2026, keine Steuerberatung.`
    },
    {
      q: `Gibt es eine Spekulationsfrist oder Haltedauer-Befreiung ${inN}?`,
      a: `${d.exemption}. Lassen Sie die aktuelle Rechtslage von einem lokalen Steuerberater prüfen.`
    },
    {
      q: `Wie erfolgt die Steuererklärung ${inN}?`,
      a: `${d.filing}. ${d.note}`
    },
    {
      q: 'Verwahrt Virtuse meinen Bitcoin oder übernimmt Virtuse die Steuererklärung?',
      a: `Nein. Virtuse verwahrt niemals Ihre Schlüssel. KYC und Onboarding erfolgen beim Partner. Der Tax-Agent vergleicht die ${N}-Länder-Übersicht; die Steuererklärung erstellt ein qualifizierter Steuerberater.`
    }
  ];
}

function buyFaqsEn(c, winner) {
  const cur = meta.currency[c.id];
  return [
    {
      q: `What is the cheapest way to buy bitcoin in ${theEn(c)} as of ${feeAsOfEn}?`,
      a: `On the Virtuse Fee Index, ${winner.partner} (${winner.method}) has the lowest annual fee drag at €100/month: a ${formatPct(winner.pct)} variable fee and ${formatEur(winner.annualDrag)} a year. Rankings use the published partner fee schedule, not spreads or currency conversion.`
    },
    {
      q: `Does buying bitcoin trigger tax in ${theEn(c)}?`,
      a: c.id === 'nl'
        ? `The Netherlands does not use a classic capital gains tax. Box 3 wealth tax on a deemed return still applies to holdings (as of ${feeAsOfEn}: ${c.gainTax}).`
        : `No. In this overview, tax arises when you sell or swap (a disposal), not when you buy. Exemption in ${theEn(c)}: ${lcFirst(c.exemption)}. Indicative 2026 overview, not tax advice.`
    },
    {
      q: 'Are these fees the full cost of buying?',
      a: 'No. The index ranks the percentage fee plus any listed monthly subscription from the Stacking Strategist fee schedule. ' +
        (cur === 'EUR' ? 'Spreads and network (miner) fees are not included.' : `Spreads, currency conversion from ${cur} and network (miner) fees are not included.`)
    },
    {
      q: 'Does Virtuse execute the buy?',
      a: 'No. Virtuse never holds your keys. You complete KYC on the partner platform and buy there.'
    }
  ];
}

const generated = [];

// Fee pages carry the fee schedule's quarter in the page's as-of line; tax pages keep AS_OF.
// The frozen fee-index archive (/2026-q3/) keeps its own quarter.
function isFeePage(relFile) {
  if (/\/20\d\d-q\d\//.test(relFile)) return false;
  return /(^|\/)buy-bitcoin\/|dca|fee-index|gebuehrenindex|index-poplatk|indeks-oplat|dijindex|indeks-komis|indice-frais|indice-comisiones/.test(relFile);
}

function pushPage(spec) {
  if (spec.lang === 'fr') spec = typoSpec(spec, nbspFr);
  if (spec.lang === 'es') spec = typoSpec(spec, nbspEs);
  const html = renderPage({
    ...spec,
    origin: ORIGIN,
    asOfLabel: isFeePage(spec.relFile)
      ? (spec.lang === 'fr' ? feeAsOfFr : spec.lang === 'es' ? feeAsOfEs : spec.lang === 'de' ? feeAsOfDe : feeAsOfEn)
      : (spec.lang === 'fr' ? asOfFr : spec.lang === 'es' ? asOfEs : spec.lang === 'de' ? asOfDe : asOfEn),
    chrome: CHROME[spec.lang]
  });
  generated.push({ relFile: spec.relFile, html, lang: spec.lang, noindex: !!spec.noindex, title: spec.title });
}

// --- EN tax hub ---
{
  const relFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">${esc(c.name)}</a>`,
    esc(c.gainTax),
    esc(c.exemption)
  ]);
  const faqs = [
    { q: 'Which EU countries does this bitcoin tax overview cover?', a: `${N} EU countries: ${COUNTRIES.map((c) => theEn(c)).join(', ')}. Figures are as of ${asOfEn}, taken from the Virtuse Tax module.` },
    { q: 'Is this tax advice?', a: 'No. Indicative 2026 overview – not tax advice. Confirm current-year rules with a local advisor.' },
    { q: 'Does Virtuse report my holdings to tax authorities?', a: 'No. Virtuse never holds your keys or your transaction history. Partners complete their own KYC.' },
    { q: 'Where can I model inheritance as well as tax?', a: `Use the Tax & Inheritance Agent (live module) for the same ${N} countries plus a multisig readiness check.` }
  ];
  const answer = finalizeAnswer([
    `This hub compares bitcoin tax treatment across ${N} EU countries as of ${asOfEn}.`,
    'Rates, exemptions and filing notes come from the Virtuse Tax module.',
    'Germany and Austria exempt gains after a 1-year holding period; Czechia uses a 3-year time test; the Netherlands taxes a deemed return under Box 3 instead of capital gains.',
    'Indicative 2026 overview, not tax advice.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle(`Bitcoin tax in ${N} EU countries (2026)`),
    description: assertDescription(`Compare bitcoin tax rates, holding exemptions and filing notes for ${N} EU countries as of ${asOfEn}. Indicative overview, not tax advice.`),
    h1: `Bitcoin tax in ${N} EU countries`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin tax', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Bitcoin tax in Germany' },
      { href: toRoot(relFile, 'bitcoin-inheritance/'), label: 'Bitcoin inheritance checklist' },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Bitcoin Fee Index' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Open Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Each country page gives the tax on gains, any holding-period exemption and the filing requirements as of ${esc(asOfEn)}. The live Tax & Inheritance Agent uses the same data and adds an inheritance readiness score.</p>
<h2>Country comparison</h2>
${tableHtml(['Country', 'Gain tax', 'Exemption'], rows)}
${faqHtml(faqs, 'FAQ')}
`
  });
}

// --- DE tax hub ---
{
  const relFile = 'de/bitcoin-steuern/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `de/bitcoin-steuern/${slugDe(c.id)}/`))}">${esc(nameDe(c.id))}</a>`,
    esc(meta.taxDe[c.id].gainTax),
    esc(meta.taxDe[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Welche Länder umfasst dieser Überblick?', a: `${N} EU-Länder: ${COUNTRIES.map((c) => nameDe(c.id)).join(', ')}. Stand ${asOfDe}, Zahlen aus dem Virtuse-Tax-Modul.` },
    { q: 'Ist das Steuerberatung?', a: 'Nein. Unverbindlicher Überblick 2026 – keine Steuerberatung.' },
    { q: 'Meldet Virtuse Bestände an Finanzämter?', a: 'Nein. Virtuse verwahrt niemals Ihre Schlüssel und führt keine Transaktionshistorie.' },
    { q: 'Wo prüfe ich neben der Steuer auch die Nachlassplanung?', a: `Im Tax- & Inheritance-Agent (Live-Modul) mit denselben ${N} Ländern plus Multisig-Check.` }
  ];
  const answer = finalizeAnswer([
    `Dieser Hub vergleicht die Bitcoin-Besteuerung in ${N} EU-Ländern, Stand ${asOfDe}.`,
    'Sätze, Befreiungen und Hinweise zur Steuererklärung stammen aus dem Virtuse-Tax-Modul.',
    'Deutschland: Spekulationsfrist 1 Jahr. Österreich: KESt 27,5 %. Tschechien: 3-Jahres-Zeittest. Niederlande: Box 3 statt klassischer Kapitalertragsteuer.',
    'Unverbindlicher Überblick 2026, keine Steuerberatung.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle(`Bitcoin-Steuern in ${N} EU-Ländern (2026)`),
    description: assertDescription(`Bitcoin-Steuersätze, Spekulationsfrist und Steuererklärung in ${N} EU-Ländern, Stand ${asOfDe}. Unverbindlich, keine Steuerberatung.`),
    h1: `Bitcoin-Steuern in ${N} EU-Ländern`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin-Steuern', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'de/bitcoin-erbrecht/'), label: 'Bitcoin und Erbrecht' },
      { href: toRoot(relFile, 'de/bitcoin-gebuehrenindex/'), label: 'Bitcoin-Gebührenindex' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Tax-Agent öffnen →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Pro Land: Gewinnbesteuerung, etwaige Haltedauer-Befreiung und Steuererklärung, Stand ${esc(asOfDe)}.</p>
<h2>Ländervergleich</h2>
${tableHtml(['Land', 'Gewinnsteuer', 'Befreiung'], rows)}
${faqHtml(faqs, 'FAQ')}
`
  });
}

for (const c of COUNTRIES) {
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const nbs = neighborsOf(c.id);
  const faqs = taxFaqsEn(c);
  const answer = taxAnswerEn(c);
  const body = `
<p>${esc(c.flag)} <strong>${esc(TheEn(c))}</strong> is one of the ${N} EU countries in the Virtuse Tax module. The figures below are taken from that module as of ${esc(asOfEn)}.</p>
<h2>Rates and filing</h2>
${tableHtml(['Field', 'As of ' + asOfEn], [
  ['Gain tax', esc(c.gainTax)],
  ['Exemption', esc(c.exemption)],
  ['Filing', esc(c.filing)],
  ['Note', esc(c.note)]
])}
<h2>What usually creates a taxable event</h2>
<p>${esc(c.note)} Buying bitcoin is not treated as a disposal in this overview; check local rules before you spend, swap, gift or lend coins.</p>
<h2>Nearby country guides</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(enRel, `bitcoin-tax/${slugEn(n.id)}/`))}">Bitcoin tax in ${esc(theEn(n))}</a></li>`).join('')}</ul>
<p>Cheapest ways to buy here: <a href="${esc(toRoot(enRel, `buy-bitcoin/${slugEn(c.id)}/`))}">Buy bitcoin in ${esc(theEn(c))}</a>.</p>
${faqHtml(faqs, 'FAQ')}
`;
  pushPage({
    relFile: enRel, lang: 'en',
    title: assertTitle(`Bitcoin tax in ${theEn(c)} (${asOfEn})`),
    description: assertDescription(`Bitcoin tax in ${theEn(c)} as of ${asOfEn}: ${c.gainTax}. Indicative overview, not tax advice.`),
    h1: `Bitcoin tax in ${theEn(c)}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(enRel, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin tax', href: toRoot(enRel, 'bitcoin-tax/'), abs: abs('bitcoin-tax/index.html') },
      { name: c.name, abs: abs(enRel) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(enRel, `buy-bitcoin/${slugEn(c.id)}/`), label: `Buy bitcoin in ${theEn(c)}` },
      { href: toRoot(enRel, 'bitcoin-inheritance/'), label: 'Bitcoin inheritance checklist' },
      { href: toRoot(enRel, nbs[0] ? `bitcoin-tax/${slugEn(nbs[0].id)}/` : 'bitcoin-tax/'), label: nbs[0] ? `Bitcoin tax in ${theEn(nbs[0])}` : 'All country tax guides' }
    ],
    moduleCta: { href: toRoot(enRel, TAX_AGENT + `?country=${c.id}`), label: `Check ${theEn(c)} in the Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: body
  });

  const d = meta.taxDe[c.id];
  const faqsDe = taxFaqsDe(c);
  const answerDe = taxAnswerDe(c);
  // d.review is an internal note for content ops / the tax advisor; never published.
  pushPage({
    relFile: deRel, lang: 'de',
    title: assertTitle(`Bitcoin-Steuern ${nameDe(c.id)} (${asOfDe})`),
    description: assertDescription(`Bitcoin-Steuern ${inDe(c.id)} (${asOfDe}): ${d.gainTax}. Keine Steuerberatung.`),
    h1: `Bitcoin-Steuern ${inDe(c.id)}`,
    answerHtml: esc(answerDe),
    breadcrumbs: [
      { name: 'Start', href: toRoot(deRel, 'index.html'), abs: abs('index.html') },
      { name: 'Bitcoin-Steuern', href: toRoot(deRel, 'de/bitcoin-steuern/'), abs: abs('de/bitcoin-steuern/index.html') },
      { name: nameDe(c.id), abs: abs(deRel) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(deRel, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' },
      { href: toRoot(deRel, 'de/bitcoin-erbrecht/'), label: 'Bitcoin und Erbrecht' },
      { href: toRoot(deRel, nbs[0] ? `de/bitcoin-steuern/${slugDe(nbs[0].id)}/` : 'de/bitcoin-steuern/'), label: nbs[0] ? `Steuern ${inDe(nbs[0].id)}` : 'Alle Länder' }
    ],
    moduleCta: { href: toRoot(deRel, TAX_AGENT + `?country=${c.id}`), label: `${nameDe(c.id)} im Tax-Agent prüfen →` },
    schemas: [faqLd(faqsDe)],
    bodyHtml: `
<p>${esc(c.flag)} Zahlen Stand ${esc(asOfDe)}, übernommen aus dem Virtuse-Tax-Modul.</p>
<h2>Sätze und Steuererklärung</h2>
${tableHtml(['Feld', 'Stand ' + asOfDe], [
  ['Gewinnsteuer', esc(d.gainTax)],
  ['Befreiung', esc(d.exemption)],
  ['Steuererklärung', esc(d.filing)],
  ['Hinweis', esc(d.note)]
])}
<h2>Wann entsteht typischerweise Steuer?</h2>
<p>${esc(d.note)}</p>
<h2>Nachbarländer</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(deRel, `de/bitcoin-steuern/${slugDe(n.id)}/`))}">${esc(nameDe(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqsDe, 'FAQ')}
`
  });
}

for (const c of COUNTRIES) {
  const relFile = `buy-bitcoin/${slugEn(c.id)}/index.html`;
  const winner = winnerDefault;
  const ranked = rankedDefault;
  const faqs = buyFaqsEn(c, winner);
  const answer = buyAnswerEn(c, winner);
  const rows = ranked.map((r, i) => [
    esc(String(i + 1)),
    esc(r.partner),
    esc(r.method),
    esc(formatPct(r.pct)),
    esc(formatEur(r.annualDrag)),
    esc(r.speed)
  ]);
  pushPage({
    relFile, lang: 'en',
    title: assertTitle(`Buy bitcoin in ${theEn(c)}: cheapest route`),
    description: assertDescription(`Cheapest EU bitcoin buy route for ${theEn(c)} as of ${feeAsOfEn}: ${winner.partner} at ${formatPct(winner.pct)}. Fee Index ranking, not a quote.`),
    h1: `Buy bitcoin in ${theEn(c)}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Buy bitcoin', href: toRoot(relFile, 'buy-bitcoin.html'), abs: abs('buy-bitcoin.html') },
      { name: c.name, abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`), label: `Bitcoin tax in ${theEn(c)}` },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Full Bitcoin Fee Index' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Simulate a DCA plan →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Local currency: <strong>${esc(meta.currency[c.id])}</strong>. The table shows the partners’ EUR-denominated fees from the Stacking Strategist schedule as of ${esc(feeAsOfEn)}.${meta.currency[c.id] === 'EUR' ? '' : ` Currency conversion from ${esc(meta.currency[c.id])} is not included in the ranking.`}</p>
<h2>Ranked buy routes at €${DEFAULT_MONTHLY}/month</h2>
${tableHtml(['Rank', 'Partner', 'Method', 'Variable fee', 'Annual fee drag', 'Speed'], rows)}
<p class="muted">Annual fee drag uses the live Stacking Strategist formula: a percentage of each purchase plus any listed monthly subscription.${ranked.some((r) => r.illustrative) ? ' RevenueBot’s percentage is marked as illustrative in the source schedule.' : ''}</p>
<h2>Tax in ${esc(theEn(c))}</h2>
<p>Gain tax: ${esc(c.gainTax)}. Exemption: ${esc(c.exemption)}.</p>
<p>Read the dedicated guide: <a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">Bitcoin tax in ${esc(theEn(c))}</a>.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// DCA calculator EN
{
  const relFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const initial = 500;
  const monthly = 100;
  const months = 12;
  const invested = initial + monthly * months;
  const ranked = rankRoutes(FEE_ROWS, monthly, 12).map((r) => {
    const startFee = initial * r.pct + (r.fixed || 0);
    const year = routeCost(r, monthly, 12);
    return { ...r, yearOneFees: startFee + year.annualDrag, invested };
  });
  const win = ranked[0];
  const faqs = [
    { q: 'Does this calculator forecast bitcoin’s price?', a: 'No. It isolates partner fees from the published fee schedule. Price returns are not modelled.' },
    { q: `What default plan is shown as of ${feeAsOfEn}?`, a: `€${initial} upfront plus €${monthly}/month for 12 months (${formatEur(invested)} invested), ranked by first-year fees using the Stacking Strategist formula.` },
    { q: 'Which route is cheapest on that plan?', a: `${win.partner} (${win.method}) with a ${formatPct(win.pct)} variable fee: about ${formatEur(win.yearOneFees)} in first-year fees in this fee-only example.` },
    { q: 'Is this financial advice?', a: 'No. It is for educational purposes only. KYC happens on the partner platform. Virtuse never holds your keys.' }
  ];
  const answer = finalizeAnswer([
    `As of ${feeAsOfEn}, a fee-only DCA example of €${initial} plus €${monthly} per month for 12 months (${formatEur(invested)} invested) ranks ${win.partner} first.`,
    `Variable fee: ${formatPct(win.pct)}; first-year fees about ${formatEur(win.yearOneFees)}, using the live Stacking Strategist formula.`,
    'This is not a return forecast. Indicative 2026 overview.'
  ], 'en', 'fee');
  const rows = ranked.map((r, i) => [
    esc(String(i + 1)),
    esc(r.partner),
    esc(r.method),
    esc(formatPct(r.pct)),
    esc(formatEur(r.yearOneFees)),
    r.illustrative ? 'Illustrative fee' : 'Published fee'
  ]);
  const feeJson = JSON.stringify(FEE_ROWS.map((r) => ({
    partner: r.partner, method: r.method, pct: r.pct, fixed: r.fixed || 0, monthly: r.monthly || 0
  })));
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin DCA calculator (EU fees 2026)'),
    description: assertDescription(`Fee-only bitcoin DCA calculator using Q4 2026 partner fees. Default €500 + €100/month ranks ${win.partner} first. Not a return forecast.`),
    h1: 'Bitcoin DCA calculator',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'DCA calculator', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Bitcoin Fee Index' },
      { href: toRoot(relFile, 'sell-vs-borrow-bitcoin/'), label: 'Sell vs borrow bitcoin' },
      { href: toRoot(relFile, 'buy-bitcoin/germany/'), label: 'Buy bitcoin in Germany' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Open Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA calculator',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    extraHead: `<script type="application/json" id="fee-schedule">${feeJson}</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('dca-form');
  if (!form) return;
  var data = JSON.parse(document.getElementById('fee-schedule').textContent);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var initial = Number(document.getElementById('dca-initial').value);
    var monthly = Number(document.getElementById('dca-monthly').value);
    var tbody = document.getElementById('dca-body');
    var rows = data.map(function (r) {
      var per = monthly * r.pct + (r.fixed || 0) + (r.monthly || 0);
      var year = per * 12 + initial * r.pct;
      return { partner: r.partner, method: r.method, pct: r.pct, year: year };
    }).sort(function (a, b) { return a.year - b.year; });
    tbody.innerHTML = rows.map(function (r, i) {
      return '<tr><td>' + (i+1) + '</td><td>' + r.partner + '</td><td>' + r.method + '</td><td>' +
        (Math.round(r.pct * 10000) / 100) + '%</td><td>€' + Math.round(r.year) + '</td></tr>';
    }).join('');
  });
});
</script>`,
    bodyHtml: `
<p>Default example: <strong>€${initial} lump sum + €${monthly}/month × 12</strong>. Enter your own amounts to recalculate with the same fee schedule.</p>
<form id="dca-form">
  <p><label>Initial amount (EUR) <input id="dca-initial" type="number" min="0" step="50" value="${initial}"></label>
  <label>Monthly amount (EUR) <input id="dca-monthly" type="number" min="0" step="25" value="${monthly}"></label>
  <button type="submit" class="cta-secondary">Recalculate fees</button></p>
</form>
<h2>First-year fees on the default plan</h2>
<div class="table-wrap"><table><thead><tr><th>Rank</th><th>Partner</th><th>Method</th><th>Variable fee</th><th>First-year fees</th><th>Note</th></tr></thead>
<tbody id="dca-body">${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<p class="muted">Same formula as the live Stacking Strategist: first-year fees = (monthly contribution × fee % + fixed fee + monthly subscription) × 12, plus the fee % on the initial lump sum. Bitcoin price returns are deliberately left out.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// DCA DE
{
  const relFile = 'de/bitcoin-dca-rechner/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Prognostiziert dieser Rechner den Bitcoin-Preis?', a: 'Nein. Er isoliert die Partnergebühren laut Gebührenplan. Keine Renditeannahme.' },
    { q: `Was ist der Standardplan Stand ${feeAsOfDe}?`, a: '500 € Einmalbetrag plus 100 €/Monat über 12 Monate. Sortierung nach Gebührenlast im ersten Jahr.' },
    { q: 'Welche Route ist in diesem Plan am günstigsten?', a: `${win.partner} (${methodDe(win.method)}) mit ${formatPctDe(win.pct)} variabler Gebühr laut Stacking-Formel.` },
    { q: 'Ist das eine Anlageberatung?', a: 'Nein. Nur eine Orientierung zu Bildungszwecken. KYC erfolgt beim Partner. Virtuse verwahrt niemals Ihre Schlüssel.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${feeAsOfDe} liegt im gebührenbasierten DCA-Beispiel (500 € plus 100 €/Monat über 12 Monate) ${win.partner} auf Platz 1.`,
    `Variable Gebühr ${formatPctDe(win.pct)}. Keine Kursprognose.`,
    'Zahlen aus dem Live-Stacking-Modul. Unverbindlicher Überblick 2026.'
  ], 'de', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin-DCA-Rechner (EU-Gebühren 2026)'),
    description: assertDescription(`Gebührenbasierter Bitcoin-DCA-Rechner, Stand ${feeAsOfDe}. Standard 500 € + 100 €/Monat, günstigste Route ${win.partner}. Keine Kursprognose.`),
    h1: 'Bitcoin-DCA-Rechner',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'DCA-Rechner', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-gebuehrenindex/'), label: 'Bitcoin-Gebührenindex' },
      { href: toRoot(relFile, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' },
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Stacking Strategist öffnen →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin-DCA-Rechner',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Standardbeispiel: 500 € plus 100 €/Monat × 12. Formel wie im Live-Stacking-Modul.</p>
<h2>Rangfolge bei 100 €/Monat</h2>
${tableHtml(['Rang', 'Partner', 'Methode', 'Variable Gebühr', 'Jahreslast'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodDe(r.method)), esc(formatPctDe(r.pct)), esc(formatEurDe(r.annualDrag))
]))}
${faqHtml(faqs, 'FAQ')}
`
  });
}

// Sell vs borrow EN
{
  const relFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Does selling bitcoin trigger tax in these ${N} countries?`, a: `Usually yes, when you sell or swap. Exemptions differ: Germany 0% after a 1-year holding period; Czechia a 3-year time test; Poland none. As of ${asOfEn}. Not tax advice.` },
    { q: 'Does borrowing against bitcoin trigger the same tax?', a: 'In this educational overview, a loan is not the same event as a sale. Interest, liquidation risk and partner KYC still apply. Model the numbers in the live Loan & Liquidity Copilot.' },
    { q: 'What is liquidation risk?', a: 'If the value of your collateral falls to the partner’s threshold, the partner can sell the collateral to repay the loan. Virtuse never holds your keys or the collateral.' },
    { q: 'Where do I compare a specific cash amount?', a: 'Use the live Loan & Liquidity Copilot. This page explains the trade-off between tax and risk using only the published country tax rates.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, selling bitcoin can trigger tax (for example, up to 45% in Germany within the 1-year holding period, or Spekulationsfrist; a flat 10% in Romania).`,
    'Borrowing against your bitcoin keeps your market exposure but adds interest and liquidation risk on a partner platform.',
    'Indicative 2026 overview, not tax or credit advice. Virtuse never holds your keys.'
  ], 'en');
  const rows = COUNTRIES.map((c) => [
    `<a href="${esc(toRoot(relFile, `bitcoin-tax/${slugEn(c.id)}/`))}">${esc(c.name)}</a>`,
    esc(c.gainTax),
    esc(c.exemption)
  ]);
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Sell vs borrow bitcoin (EU tax 2026)'),
    description: assertDescription(`Sell bitcoin and pay tax, or borrow against it and stay invested. Tax rates for ${N} EU countries as of ${asOfEn}. Not credit advice.`),
    h1: 'Sell bitcoin vs borrow against it',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Sell vs borrow', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Bitcoin tax in Germany' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' },
      { href: toRoot(relFile, 'bitcoin-inheritance/'), label: 'Inheritance checklist' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.loan.replace(/^\//, '')), label: 'Compare sell vs borrow in the copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Sell vs borrow bitcoin',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Tax if you sell</h2>
<p>The rates below are the same as in the country tax guides (Tax module, ${esc(asOfEn)}). Selling shortly before a holding period ends can cost you an exemption you were about to qualify for.</p>
${tableHtml(['Country', 'Gain tax', 'Exemption'], rows)}
<h2>Risk if you borrow</h2>
<p>Bitcoin-backed loans are offered by regulated partners, not by Virtuse. You keep your price exposure and pay interest, and your collateral can be liquidated. Virtuse never holds the collateral. The live Loan & Liquidity Copilot runs the scenarios; this page stays qualitative and quotes no interest rates.</p>
<h2>How to choose a next step</h2>
<ol>
  <li>Read your country’s tax guide for the rate that would apply <em>if you sold today</em>.</li>
  <li>Open the Loan & Liquidity Copilot with the cash amount you actually need.</li>
  <li>Complete KYC with the partner if you go ahead; never send your seed phrase to anyone, including Virtuse.</li>
</ol>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const faqs = [
    { q: `Löst ein Verkauf in diesen ${N} Ländern Steuer aus?`, a: `In der Regel ja, bei einer Veräußerung. Deutschland: 0 % nach 1-jähriger Spekulationsfrist. Tschechien: 3-Jahres-Zeittest. Polen: keine Haltedauer-Befreiung. Stand ${asOfDe}. Keine Steuerberatung.` },
    { q: 'Ist ein Kredit dasselbe steuerliche Ereignis wie ein Verkauf?', a: 'In diesem Überblick nicht. Zinsen, Liquidationsrisiko und das KYC beim Partner bleiben. Konkrete Zinssätze zeigt der Loan-Copilot.' },
    { q: 'Was ist Liquidationsrisiko?', a: 'Fällt der Wert der Sicherheit (Collateral) auf die Schwelle des Partners, kann die Sicherheit zwangsverkauft werden. Virtuse verwahrt weder Schlüssel noch Sicherheiten.' },
    { q: 'Wo berechne ich einen konkreten Betrag?', a: 'Im Live-Modul Loan & Liquidity Copilot. Diese Seite erklärt nur die Abwägung anhand der veröffentlichten Steuerangaben.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} kann ein Bitcoin-Verkauf Steuer auslösen (Deutschland bis 45 % innerhalb der Spekulationsfrist; Rumänien pauschal 10 %).`,
    'Ein Kredit mit Bitcoin als Sicherheit kann die Marktposition erhalten, bringt aber Zinsen und ein Liquidationsrisiko beim Partner.',
    'Die Seite nennt keine Zinssätze. Unverbindlicher Überblick 2026, keine Steuer- oder Kreditberatung. Virtuse verwahrt niemals Ihre Schlüssel.'
  ], 'de');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin verkaufen oder beleihen (2026)'),
    description: assertDescription(`Bitcoin verkaufen und Steuer zahlen oder beleihen und investiert bleiben. ${N}-Länder-Sätze, Stand ${asOfDe}. Keine Kreditberatung.`),
    h1: 'Bitcoin verkaufen oder beleihen',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Verkaufen oder beleihen', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'de/bitcoin-dca-rechner/'), label: 'DCA-Rechner' },
      { href: toRoot(relFile, 'de/bitcoin-erbrecht/'), label: 'Bitcoin und Erbrecht' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.loan.replace(/^\//, '')), label: 'Im Loan-Copilot vergleichen →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin verkaufen oder beleihen',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Steuer beim Verkauf</h2>
${tableHtml(['Land', 'Gewinnsteuer', 'Befreiung'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `de/bitcoin-steuern/${slugDe(c.id)}/`))}">${esc(nameDe(c.id))}</a>`,
  esc(meta.taxDe[c.id].gainTax),
  esc(meta.taxDe[c.id].exemption)
]))}
<h2>Risiko beim Kredit</h2>
<p>Bitcoin-besicherte Kredite kommen von Partnern, nicht von Virtuse. Sie behalten die Kurschance, zahlen Zinsen, und Ihre Sicherheit kann liquidiert werden. Virtuse verwahrt die Sicherheit (Collateral) nicht.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// Inheritance EN
{
  const relFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const items = inheritance.items;
  const faqs = [
    { q: 'Should a letter of instruction contain seed phrases?', a: 'No. The Tax module’s checklist says the letter lists inventory, locations and contacts – never seed phrases. Store it with your will or attorney.' },
    { q: 'Why is 2-of-3 multisig on the checklist?', a: 'A single seed is a single point of failure for you and for your heirs. The module scores 2-of-3 with two keys held by you and one by a partner or attorney.' },
    { q: 'Does Virtuse custody keys for heirs?', a: 'No. Virtuse never holds your keys. Inheritance is handled by your attorney, your heirs and any vault partner you choose.' },
    { q: 'How is the readiness score weighted?', a: 'The live Tax module assigns points (letter 20, separation 20, heir awareness 15, multisig 20, tested recovery 15, accounts 15). This page lists the same items without scoring them.' }
  ];
  const answer = finalizeAnswer([
    `As of ${asOfEn}, the Virtuse Tax module’s inheritance checklist has six items: letter of instruction, geographic key separation, heir awareness, 2-of-3 multisig, a recovery drill, and documented accounts.`,
    'A single seed is a single point of failure. Virtuse never holds your keys.',
    'Educational checklist, not legal advice.'
  ], 'en');
  const howto = {
    '@type': 'HowTo',
    name: 'Prepare a bitcoin inheritance plan',
    description: 'Six-step checklist from the Virtuse Tax & Inheritance Agent.',
    totalTime: 'P7D',
    step: items.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.question,
      text: `${it.detail} ${it.action}`
    }))
  };
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin inheritance checklist (2026)'),
    description: assertDescription(`Six-step bitcoin inheritance checklist as of ${asOfEn}: letter of instruction, key separation, heir awareness, 2-of-3 multisig. Not legal advice.`),
    h1: 'Bitcoin inheritance checklist',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Inheritance', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-tax/germany/'), label: 'Bitcoin tax in Germany' },
      { href: toRoot(relFile, 'bitcoin-tax/'), label: `${N}-country tax hub` },
      { href: toRoot(relFile, 'sell-vs-borrow-bitcoin/'), label: 'Sell vs borrow' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Score this checklist in the Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>The items and wording come from the live Tax module checklist. Educational only, not legal advice.</p>
<h2>Six checks</h2>
<ol>
  ${items.map((it) => `<li><h3>${esc(it.question)}</h3><p>${esc(it.detail)}</p><p>${esc(it.action)}</p></li>`).join('')}
</ol>
<p>Country tax still applies to heirs who later sell. Start with <a href="${esc(toRoot(relFile, 'bitcoin-tax/'))}">the ${N}-country tax hub</a>.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-erbrecht/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const faqs = [
    { q: 'Dürfen Seed-Wörter im Schreiben stehen?', a: 'Nein. Das Schreiben nennt Inventar, Orte und Kontakte – niemals Seed-Phrasen. Aufbewahrung beim Testament oder Anwalt.' },
    { q: 'Warum Multisig 2-von-3?', a: 'Eine einzelne Seed-Phrase ist ein Single Point of Failure für Sie und für Erben.' },
    { q: 'Verwahrt Virtuse Schlüssel für Erben?', a: 'Nein. Virtuse verwahrt niemals Ihre Schlüssel.' },
    { q: 'Ist das Rechtsberatung?', a: 'Nein. Eine Checkliste zu Bildungszwecken aus dem Tax-Modul, Stand ' + asOfDe + '.' }
  ];
  const answer = finalizeAnswer([
    `Stand ${asOfDe} umfasst die Checkliste des Tax-Moduls sechs Punkte: Schreiben mit Anweisungen, geografische Schlüsseltrennung, informierte Erben, Multisig 2-von-3, Wiederherstellungstest und dokumentierte Konten.`,
    'Eine einzelne Seed-Phrase ist ein Single Point of Failure. Virtuse verwahrt niemals Ihre Schlüssel.',
    'Keine Rechtsberatung.'
  ], 'de');
  const howto = {
    '@type': 'HowTo',
    name: 'Bitcoin-Nachlass vorbereiten',
    inLanguage: 'de',
    step: meta.inheritanceDe.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin und Erbrecht: Checkliste (2026)'),
    description: assertDescription(`Sechs-Punkte-Checkliste für Bitcoin-Erbfolge, Stand ${asOfDe}: Anweisungsschreiben, Schlüsseltrennung, Multisig 2-von-3. Keine Rechtsberatung.`),
    h1: 'Bitcoin-Erbfolge: Checkliste',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Erbrecht', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'de/bitcoin-steuern/'), label: `${N}-Länder-Steuerhub` },
      { href: toRoot(relFile, 'de/bitcoin-verkaufen-oder-beleihen/'), label: 'Verkaufen oder beleihen' }
    ],
    moduleCta: { href: toRoot(relFile, TAX_AGENT), label: 'Checkliste im Tax-Agent bewerten →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Inhalt entspricht der Checkliste des Tax-Moduls. Keine Rechtsberatung.</p>
<h2>Anleitung: sechs Prüfschritte</h2>
<ol>${meta.inheritanceDe.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'FAQ')}
`
  });
}

function feeIndexBody(relFile, lang) {
  const contribs = DEFAULT_CONTRIBUTIONS;
  const tables = contribs.map((amt) => {
    const ranked = rankRoutes(FEE_ROWS, amt);
    if (lang === 'es') {
      return `<h3>${esc(formatEurEs(amt))} al mes</h3>` +
        tableHtml(['Puesto', 'Socio', 'Método', 'Comisión', 'Comisiones anuales'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodEs(r.method)),
          esc(formatPctSk(r.pct) + (r.monthly ? ` + ${formatEurEs(r.monthly)} al mes` : '')),
          esc(formatEurEs(r.annualDrag))
        ]));
    }
    if (lang === 'fr') {
      return `<h3>${esc(formatEurSk(amt))} par mois</h3>` +
        tableHtml(['Rang', 'Partenaire', 'Méthode', 'Frais', 'Frais annuels'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodFr(r.method)),
          esc(formatPctSk(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} par mois` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'ru') {
      return `<h3>${esc(formatEurSk(amt))} в месяц</h3>` +
        tableHtml(['Место', 'Партнёр', 'Метод', 'Комиссия', 'Годовые комиссии'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodRu(r.method)),
          esc(formatPctPl(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} в месяц` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'uk') {
      return `<h3>${esc(formatEurSk(amt))} на місяць</h3>` +
        tableHtml(['Місце', 'Партнер', 'Метод', 'Комісія', 'Річні комісії'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodUk(r.method)),
          esc(formatPctPl(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} на місяць` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'hu') {
      return `<h3>Havi ${esc(formatEurSk(amt))}</h3>` +
        tableHtml(['Helyezés', 'Partner', 'Módszer', 'Díj', 'Éves díjak'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodHu(r.method)),
          esc(formatPctPl(r.pct) + (r.monthly ? ` + havi ${formatEurSk(r.monthly)}` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'pl') {
      return `<h3>${esc(formatEurSk(amt))} miesięcznie</h3>` +
        tableHtml(['Miejsce', 'Partner', 'Metoda', 'Opłata', 'Roczne opłaty'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodPl(r.method)),
          esc(formatPctPl(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} miesięcznie` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'cs') {
      return `<h3>${esc(formatEurSk(amt))} měsíčně</h3>` +
        tableHtml(['Pořadí', 'Partner', 'Metoda', 'Poplatek', 'Roční poplatky'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodCs(r.method)),
          esc(formatPctSk(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} měsíčně` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    if (lang === 'sk') {
      return `<h3>${esc(formatEurSk(amt))} mesačne</h3>` +
        tableHtml(['Poradie', 'Partner', 'Metóda', 'Poplatok', 'Ročné poplatky'], ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(methodSk(r.method)),
          esc(formatPctSk(r.pct) + (r.monthly ? ` + ${formatEurSk(r.monthly)} mesačne` : '')),
          esc(formatEurSk(r.annualDrag))
        ]));
    }
    return `<h3>${lang === 'de' ? `${esc(formatEurDe(amt))} pro Monat` : `${esc(formatEur(amt))} per month`}</h3>` +
      tableHtml(
        lang === 'de' ? ['Rang', 'Partner', 'Methode', 'Gebühr', 'Jahreslast'] : ['Rank', 'Partner', 'Method', 'Fee', 'Annual fee drag'],
        ranked.map((r, i) => [
          esc(String(i + 1)),
          esc(r.partner),
          esc(lang === 'de' ? methodDe(r.method) : r.method),
          esc(lang === 'de'
            ? formatPctDe(r.pct) + (r.monthly ? ` + ${formatEurDe(r.monthly)}/Monat` : '')
            : formatPct(r.pct) + (r.monthly ? ` + ${formatEur(r.monthly)}/month` : '')),
          esc(lang === 'de' ? formatEurDe(r.annualDrag) : formatEur(r.annualDrag))
        ])
      );
  }).join('');
  let beText;
  if (lang === 'es') {
    if (be.status === 'always') {
      beText = `Según las comisiones publicadas, la vía automatizada más barata (${be.auto.partner}) cuesta al año lo mismo o menos que la vía manual más barata (${be.manual.partner}), desde 1 € al mes.`;
    } else if (be.status === 'found') {
      beText = `Punto de equilibrio: desde ${formatEurEs(be.monthlyEur)} al mes, ${be.auto.partner} (automatizado) no es más caro que ${be.manual.partner} (manual).`;
    } else {
      beText = 'Hasta 20.000 € al mes, la vía automatizada más barata no supera a la vía manual más barata.';
    }
  } else if (lang === 'fr') {
    if (be.status === 'always') {
      beText = `Selon les frais publiés, la voie automatisée la moins chère (${be.auto.partner}) coûte chaque année autant ou moins que la voie manuelle la moins chère (${be.manual.partner}), dès 1 € par mois.`;
    } else if (be.status === 'found') {
      beText = `Seuil de rentabilité : dès ${formatEurSk(be.monthlyEur)} par mois, ${be.auto.partner} (automatisé) n'est pas plus cher que ${be.manual.partner} (manuel).`;
    } else {
      beText = "Jusqu'à 20 000 € par mois, la voie automatisée la moins chère ne fait pas mieux que la voie manuelle la moins chère.";
    }
  } else if (lang === 'ru') {
    if (be.status === 'always') {
      beText = `По опубликованным комиссиям самый дешёвый автоматический способ (${be.auto.partner}) начиная с 1 € в месяц стоит в год столько же или меньше, чем самый дешёвый ручной способ (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Точка безубыточности: от ${formatEurSk(be.monthlyEur)} в месяц ${be.auto.partner} (автоматически) не дороже, чем ${be.manual.partner} (вручную).`;
    } else {
      beText = 'До 20 000 € в месяц самый дешёвый автоматический способ не превосходит самый дешёвый ручной.';
    }
  } else if (lang === 'uk') {
    if (be.status === 'always') {
      beText = `За опублікованими комісіями найдешевший автоматичний шлях (${be.auto.partner}) від 1 € на місяць коштує на рік стільки ж або менше, ніж найдешевший ручний шлях (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Точка беззбитковості: від ${formatEurSk(be.monthlyEur)} на місяць ${be.auto.partner} (автоматично) не дорожчий за ${be.manual.partner} (вручну).`;
    } else {
      beText = 'До 20 000 € на місяць найдешевший автоматичний шлях не перевершує найдешевший ручний.';
    }
  } else if (lang === 'hu') {
    if (be.status === 'always') {
      beText = `A közzétett díjak alapján a legolcsóbb automatizált út (${be.auto.partner}) havi 1 €-tól ugyanannyiba vagy kevesebbe kerül évente, mint a legolcsóbb manuális út (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Megtérülési pont: havi ${formatEurSk(be.monthlyEur)}-tól kezdve ${be.auto.partner} (automatizált) nem drágább, mint ${be.manual.partner} (manuális).`;
    } else {
      beText = 'Havi 20 000 €-ig a legolcsóbb automatizált út nem előzi meg a legolcsóbb manuális utat.';
    }
  } else if (lang === 'pl') {
    if (be.status === 'always') {
      beText = `Przy opublikowanych opłatach najtańsza ścieżka automatyczna (${be.auto.partner}) ma od 1 € miesięcznie takie same lub niższe roczne opłaty jak najtańsza ścieżka ręczna (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Próg opłacalności: od ${formatEurSk(be.monthlyEur)} miesięcznie ${be.auto.partner} (automatycznie) nie jest droższy niż ${be.manual.partner} (ręcznie).`;
    } else {
      beText = 'Do 20 000 € miesięcznie najtańsza ścieżka automatyczna nie wypada lepiej niż najtańsza ścieżka ręczna.';
    }
  } else if (lang === 'cs') {
    if (be.status === 'always') {
      beText = `Při zveřejněných poplatcích má nejlevnější automatizovaná cesta (${be.auto.partner}) od 1 € měsíčně stejné nebo nižší roční poplatky než nejlevnější ruční cesta (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Bod zvratu: od ${formatEurSk(be.monthlyEur)} měsíčně není ${be.auto.partner} (automatizovaně) dražší než ${be.manual.partner} (ručně).`;
    } else {
      beText = 'Do 20 000 € měsíčně nejlevnější automatizovaná cesta nepřekoná nejlevnější ruční cestu.';
    }
  } else if (lang === 'sk') {
    if (be.status === 'always') {
      beText = `Pri zverejnených poplatkoch má najlacnejšia automatizovaná cesta (${be.auto.partner}) od 1 € mesačne rovnaké alebo nižšie ročné poplatky ako najlacnejšia manuálna cesta (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Bod zvratu: od ${formatEurSk(be.monthlyEur)} mesačne nie je ${be.auto.partner} (automatizovane) drahší ako ${be.manual.partner} (manuálne).`;
    } else {
      beText = 'Do 20 000 € mesačne najlacnejšia automatizovaná cesta neprekoná najlacnejšiu manuálnu cestu.';
    }
  } else if (lang === 'de') {
    if (be.status === 'always') {
      beText = `Break-even automatisiert vs. manuell: Die günstigste automatisierte Route (${be.auto.partner}) hat ab 1 €/Monat eine niedrigere oder gleiche Jahreslast als die günstigste manuelle Route (${be.manual.partner}).`;
    } else if (be.status === 'found') {
      beText = `Break-even: ab ${formatEurDe(be.monthlyEur)}/Monat ist ${be.auto.partner} (automatisiert) nicht teurer als ${be.manual.partner} (manuell).`;
    } else {
      beText = `Im Scan bis 20.000 €/Monat unterbietet die günstigste automatisierte Route die günstigste manuelle Route nicht.`;
    }
  } else if (be.status === 'always') {
    beText = `On listed fees, ${be.auto.partner} (automated) has an annual fee drag equal to or lower than ${be.manual.partner} (manual) at every tested monthly amount from €1.`;
  } else if (be.status === 'found') {
    beText = `Break-even: from ${formatEur(be.monthlyEur)}/month, ${be.auto.partner} (automated) costs the same as or less than ${be.manual.partner} (manual) in annual fees.`;
  } else {
    beText = `Automated vs manual: between €1 and €20,000 a month, the cheapest automated route never beats the cheapest manual route.`;
  }
  return { tables, beText, winner: winnerDefault };
}

function pressBlurb() {
  const w = winnerDefault;
  return `Virtuse Bitcoin Fee Index (${feeAsOfEn}): among listed EU buy routes, ${w.partner} (${w.method}) ranks first on annual fee drag at €100/month (${formatPct(w.pct)}, ${formatEur(w.annualDrag)}/year). Ranking uses partner percentage fees plus any listed monthly subscription from the Stacking Strategist schedule; spreads, currency conversion and miner fees are excluded. Source: ${ORIGIN}/bitcoin-fee-index/ — Virtuse never holds your keys.`;
}

{
  const relFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'en');
  const faqs = [
    { q: 'What does the Bitcoin Fee Index rank?', a: `The annual fee drag of partner buy routes as of ${feeAsOfEn}, calculated with the Stacking Strategist formula from listed percentage fees and monthly subscriptions.` },
    { q: 'Who is cheapest at €100 per month?', a: `${winner.partner}: a ${formatPct(winner.pct)} variable fee and ${formatEur(winner.annualDrag)} in annual fee drag at that amount.` },
    { q: 'Why is RevenueBot not ranked?', a: 'RevenueBot charges no fee per purchase. It takes 20% of the bot’s profit, capped at $50 a month, so it cannot be ranked on purchase cost.' },
    { q: 'May I republish the table?', a: 'Yes, with attribution: “Source: Virtuse Bitcoin Fee Index, as of ' + feeAsOfEn + '” and a link to this page. The embed code is above.' }
  ];
  const answer = finalizeAnswer([
    `The Virtuse Bitcoin Fee Index as of ${feeAsOfEn} ranks EU buy routes by annual fee drag.`,
    `At €100/month, the top-ranked route is ${winner.partner} (${winner.method}) at ${formatPct(winner.pct)}, ${formatEur(winner.annualDrag)} a year.`,
    be.status === 'always'
      ? `On listed fees, automated ${be.auto.partner} costs the same as or less than manual ${be.manual.partner} at every monthly amount from €1.`
      : beText,
    'Not a quote. Virtuse never holds your keys.'
  ], 'en', 'fee');
  const embedSnippet = `<iframe src="${ORIGIN}/bitcoin-fee-index/embed/" title="Virtuse Bitcoin Fee Index" width="100%" height="320" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
<p>Source: <a href="${ORIGIN}/bitcoin-fee-index/">Virtuse Bitcoin Fee Index</a> (as of ${feeAsOfEn})</p>`;
  const article = {
    '@type': 'Article',
    headline: 'Virtuse Bitcoin Fee Index',
    datePublished: LASTMOD,
    dateModified: LASTMOD,
    inLanguage: 'en',
    author: { '@id': `${ORIGIN}/#org` },
    publisher: { '@id': `${ORIGIN}/#org` },
    description: `EU bitcoin buy-route fee ranking as of ${feeAsOfEn}.`
  };
  const dataset = {
    '@type': 'Dataset',
    name: 'Virtuse Bitcoin Fee Index',
    temporalCoverage: '2026-Q4',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    creator: { '@id': `${ORIGIN}/#org` },
    variableMeasured: 'Annual partner fee drag (EUR) at stated monthly contribution',
    url: abs(relFile)
  };
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Bitcoin Fee Index (EU) Q4 2026'),
    description: assertDescription(`EU bitcoin buy-route ranking as of ${feeAsOfEn}. Cheapest at €100/month: ${winner.partner} at ${formatPct(winner.pct)}. Spreads excluded.`),
    h1: 'Bitcoin Fee Index',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Fee Index', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, deFile),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), label: 'Q3 2026 archive snapshot' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Open Stacking Strategist →' },
    schemas: [faqLd(faqs), article, dataset],
    bodyHtml: `
<h2>Rankings by monthly contribution</h2>
<p>Figures as of ${esc(feeAsOfEn)}. The formula is documented on the <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/methodology/'))}">methodology</a> page.</p>
${tables}
<h2>Break-even: automated vs manual</h2>
<p>${esc(beText)}</p>
<h2>Press blurb</h2>
<p>${esc(pressBlurb())}</p>
<h2>Embed</h2>
<p>Copy and paste the code below; keep the attribution line.</p>
<pre>${esc(embedSnippet)}</pre>
<p><a class="cta-secondary" href="${esc(toRoot(relFile, 'bitcoin-fee-index/embed/'))}">Open embeddable table</a>
<a class="cta-secondary" href="${esc(toRoot(relFile, 'bitcoin-fee-index/2026-q3/print.html'))}">Print / PDF view</a></p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'de/bitcoin-gebuehrenindex/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'de');
  const faqs = [
    { q: 'Was misst der Gebührenindex?', a: `Die Gebührenlast von Kaufrouten Stand ${feeAsOfDe}, Formel wie im Stacking-Modul.` },
    { q: 'Wer ist bei 100 €/Monat am günstigsten?', a: `${winner.partner}, ${formatPctDe(winner.pct)}, ${formatEurDe(winner.annualDrag)} Jahreslast.` },
    { q: 'Sind Spreads enthalten?', a: 'Nein. Nur die prozentuale Gebühr plus ein etwaiges Monatsabo laut Plan. Wechselkurse und Mining-Gebühren sind nicht enthalten.' },
    { q: 'Darf ich die Tabelle zitieren?', a: `Ja, mit Quellenangabe „Quelle: Virtuse Bitcoin-Gebührenindex, Stand ${feeAsOfDe}“ und Link.` }
  ];
  const answer = finalizeAnswer([
    `Der Virtuse Bitcoin-Gebührenindex Stand ${feeAsOfDe} sortiert EU-Kaufrouten nach Jahres-Gebührenlast.`,
    `Bei 100 €/Monat führt ${winner.partner} (${methodDe(winner.method)}) mit ${formatPctDe(winner.pct)}, ${formatEurDe(winner.annualDrag)} pro Jahr.`,
    beText,
    'Kein Angebot. Virtuse verwahrt niemals Ihre Schlüssel.'
  ], 'de', 'fee');
  pushPage({
    relFile, lang: 'de',
    title: assertTitle('Bitcoin-Gebührenindex (EU) Q4 2026'),
    description: assertDescription(`EU-Kaufrouten nach Gebühren, Stand ${feeAsOfDe}. Günstigste Route bei 100 €/Monat: ${winner.partner} mit ${formatPctDe(winner.pct)}.`),
    h1: 'Bitcoin-Gebührenindex',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Start', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Gebührenindex', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enFile, relFile),
    related: [
      { href: toRoot(relFile, 'de/bitcoin-dca-rechner/'), label: 'DCA-Rechner' },
      { href: toRoot(relFile, 'de/bitcoin-steuern/deutschland/'), label: 'Bitcoin-Steuern Deutschland' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodik (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Stacking Strategist öffnen →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse Bitcoin-Gebührenindex',
        inLanguage: 'de',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse Bitcoin-Gebührenindex',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Ranglisten nach Monatsbeitrag</h2>
${tables}
<h2>Break-even: automatisiert vs. manuell</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/2026-q3/index.html';
  const ranked = rankRoutes(FEE_ROWS_Q3, 100);
  const faqs = [
    { q: 'Is this archive different from the live index?', a: `It is the ${asOfEn} snapshot of the same fee schedule. When a later quarter is published, this URL stays the same.` },
    { q: 'What contribution is archived in the table?', a: '€100 per month, 12 purchases, calculated with the Stacking Strategist formula.' },
    { q: 'How do I export a PDF?', a: 'Open the print view and choose Print → Save as PDF in your browser. No extra software is needed.' },
    { q: 'Can I cite a single number?', a: `${ranked[0].partner}’s annual fee drag at €100/month is ${formatEur(ranked[0].annualDrag)} as of ${asOfEn}.` }
  ];
  const answer = finalizeAnswer([
    `In the ${asOfEn} snapshot, the Bitcoin Fee Index ranked ${ranked[0].partner} first at €100/month, with ${formatEur(ranked[0].annualDrag)} annual fee drag (${formatPct(ranked[0].pct)}).`,
    'This URL keeps the snapshot for the quarter, so citations stay valid when a later quarter is published.',
    'A dataset, not a trade quote.'
  ], 'en');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index archive: 2026 Q3'),
    description: assertDescription(`Q3 2026 snapshot of the Virtuse Bitcoin Fee Index. First at €100/month: ${ranked[0].partner}, ${formatEur(ranked[0].annualDrag)} annual fee drag.`),
    h1: 'Bitcoin Fee Index archive — 2026 Q3',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: '2026 Q3', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Current Fee Index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' },
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/print.html'), label: 'Print / PDF view' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Open Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Dataset',
        name: 'Virtuse Bitcoin Fee Index 2026-Q3',
        temporalCoverage: '2026-Q3',
        identifier: '2026-q3',
        url: abs(relFile)
      },
      {
        '@type': 'Article',
        headline: 'Bitcoin Fee Index archive — 2026 Q3',
        datePublished: LASTMOD
      }
    ],
    bodyHtml: `
<p>Frozen copy of the ${esc(asOfEn)} ranking at €100/month.</p>
${tableHtml(['Rank', 'Partner', 'Method', 'Fee', 'Annual fee drag', 'Note'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag)), esc(r.note)
]))}
<p><a class="cta-secondary" href="${esc(toRoot(relFile, 'bitcoin-fee-index/2026-q3/print.html'))}">Print-optimized view</a></p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/2026-q3/print.html';
  const ranked = rankRoutes(FEE_ROWS_Q3, 100);
  const answer = finalizeAnswer([
    `Print view of the ${asOfEn} Bitcoin Fee Index snapshot.`,
    `First at €100/month: ${ranked[0].partner}, ${formatEur(ranked[0].annualDrag)} annual fee drag.`,
    'Use your browser’s Print dialog and choose Save as PDF. No extra software is needed.',
    'Attribution required: Virtuse Bitcoin Fee Index, as of ' + asOfEn + '.'
  ], 'en');
  const faqs = [
    { q: 'How do I make a PDF?', a: 'File → Print → Save as PDF (Chrome, Firefox, Safari, Edge). A4 or Letter both work.' },
    { q: 'Does this page change with the live index?', a: `No. It shows the ${asOfEn} archive snapshot.` },
    { q: 'What must a reprint include?', a: `Source line: Virtuse Bitcoin Fee Index, as of ${asOfEn}, and the canonical archive URL.` }
  ];
  pushPage({
    relFile, lang: 'en', noindex: true,
    title: assertTitle('Fee Index 2026 Q3 — print / PDF'),
    description: assertDescription(`Print-optimized 2026 Q3 Bitcoin Fee Index. Save as PDF from the browser. First route at €100/month: ${ranked[0].partner}.`),
    h1: 'Bitcoin Fee Index — 2026 Q3 print view',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: '2026 Q3', href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), abs: abs('bitcoin-fee-index/2026-q3/index.html') },
      { name: 'Print', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), label: 'HTML archive' },
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Live index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'Stacking Strategist →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p class="muted">File → Print → Save as PDF. Navigation is hidden when printing.</p>
${tableHtml(['Rank', 'Partner', 'Method', 'Fee', 'Annual fee drag (€100/month)'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag))
]))}
<p>Source: Virtuse Bitcoin Fee Index, as of ${esc(asOfEn)}. ${esc(ORIGIN)}/bitcoin-fee-index/2026-q3/</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/methodology/index.html';
  const faqs = [
    { q: 'Where do the percentages come from?', a: meta.feeSource === 'live'
      ? 'From the partners’ published fee pages, checked on 2 October 2026: 21bitcoin Auto-Invest 0% (from day 8), ByBit EU 0.25% and Kraken Pro 0.8% (taker fee for a plain market buy at the entry tier).'
      : 'From seo-data.json feeSchedule.' },
    { q: 'What is the annual-drag formula?', a: 'costPerPurchase = contribution × pct + fixed + monthly / (periodsPerYear / 12); annualDrag = costPerPurchase × periodsPerYear. The same formula as the live Stacking Strategist.' },
    { q: 'How often will this change?', a: 'When a partner changes its published fees, the schedule is updated and a new quarterly snapshot is published. Archive URLs stay stable.' }
  ];
  const answer = finalizeAnswer([
    `Methodology as of ${feeAsOfEn}: rank partners by annual fee drag at a stated monthly euro contribution.`,
    'The formula is the one used by the live Stacking Strategist: a percentage of each purchase plus any monthly subscription.',
    'Spreads, currency conversion and miner fees are out of scope. Exchange rows use the taker fee of a plain market buy at the entry tier.',
    'Not a brokerage quote.'
  ], 'en', 'fee');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index methodology (Q4 2026)'),
    description: assertDescription(`How the Virtuse Bitcoin Fee Index ranks EU buy routes as of ${feeAsOfEn}. Stacking Strategist formula, published fees.`),
    h1: 'Bitcoin Fee Index methodology',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Home', href: toRoot(relFile, 'index.html'), abs: abs('index.html') },
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: 'Methodology', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Fee Index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/2026-q3/'), label: '2026 Q3 archive' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.stacking.replace(/^\//, '')), label: 'See fees in Stacking Strategist →' },
    schemas: [faqLd(faqs), { '@type': 'Article', headline: 'Bitcoin Fee Index methodology', datePublished: LASTMOD }],
    bodyHtml: `
<h2>Inputs</h2>
${tableHtml(['Partner', 'Method', 'pct', 'fixed', 'monthly', 'Flag'], FEE_ROWS.map((r) => [
  esc(r.partner), esc(r.method), esc(String(r.pct)), esc(String(r.fixed || 0)), esc(String(r.monthly || 0)), r.illustrative ? 'illustrative' : 'as published'
]))}
<h2>Formula</h2>
<pre>costPerPurchase = contribution * pct + fixed + monthly / (periodsPerYear / 12)
annualDrag = costPerPurchase * periodsPerYear</pre>
<p>Default: periodsPerYear = 12, as in the live Stacking Strategist.</p>
<h2>Out of scope</h2>
<ul>
  <li>Bid/ask spread</li>
  <li>Currency conversion from CZK, PLN, HUF, RON or BGN into EUR</li>
  <li>Bitcoin network miner fees</li>
  <li>Promotional discounts that are not in the schedule</li>
</ul>
${faqHtml(faqs, 'FAQ')}
`
  });
}

{
  const relFile = 'bitcoin-fee-index/embed/index.html';
  const ranked = rankRoutes(FEE_ROWS, 100);
  const faqs = [
    { q: 'Can this page be iframed?', a: 'Yes. The page is built to be embedded in an iframe on other websites.' },
    { q: 'What table is shown?', a: `The €100/month ranking as of ${feeAsOfEn}, with four listed partners.` },
    { q: 'Is JavaScript required?', a: 'No. The table is static HTML.' },
    { q: 'What attribution is required?', a: `Visible “Source: Virtuse Bitcoin Fee Index, as of ${feeAsOfEn}” plus a link to the index.` }
  ];
  const answer = finalizeAnswer([
    `Embeddable Fee Index widget as of ${feeAsOfEn}.`,
    `At €100/month, ${ranked[0].partner} ranks first at ${formatPct(ranked[0].pct)} (${formatEur(ranked[0].annualDrag)} a year).`,
    'Static HTML; no JavaScript required. Always show the source line.',
    'Virtuse never holds your keys.'
  ], 'en', 'fee');
  pushPage({
    relFile, lang: 'en',
    title: assertTitle('Fee Index embed widget (Q4 2026)'),
    description: assertDescription(`Iframe-ready Bitcoin Fee Index table as of ${feeAsOfEn}. ${ranked[0].partner} first at €100/month. Attribution required.`),
    h1: 'Bitcoin Fee Index — embed',
    answerHtml: esc(answer),
    breadcrumbs: [
      { name: 'Fee Index', href: toRoot(relFile, 'bitcoin-fee-index/'), abs: abs('bitcoin-fee-index/index.html') },
      { name: 'Embed', abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(relFile, null),
    related: [
      { href: toRoot(relFile, 'bitcoin-fee-index/'), label: 'Full Fee Index' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Methodology' },
      { href: toRoot(relFile, 'bitcoin-dca-calculator/'), label: 'DCA calculator' }
    ],
    moduleCta: { href: toRoot(relFile, CTAS.concierge.replace(/^\//, '')), label: 'Get matched in Concierge →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Virtuse Bitcoin Fee Index embed',
        url: abs(relFile),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
${tableHtml(['Partner', 'Method', 'Fee', 'Annual fee drag at €100/month'], ranked.map((r) => [
  esc(r.partner), esc(r.method), esc(formatPct(r.pct)), esc(formatEur(r.annualDrag))
]))}
<p class="muted">Source: <a href="${esc(toRoot(relFile, 'bitcoin-fee-index/'))}">Virtuse Bitcoin Fee Index</a> (as of ${esc(feeAsOfEn)}). Virtuse never holds your keys.</p>
${faqHtml(faqs, 'FAQ')}
`
  });
}

// ---------- Slovak (sk/) ----------
const SK_HOME = { name: 'Domov', href: null, abs: abs('sk/index.html') };
function skHome(relFile) { return { ...SK_HOME, href: toRoot(relFile, 'sk/index.html') }; }

// SK tax hub
{
  const relFile = 'sk/bitcoin-dane/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `sk/bitcoin-dane/${slugSk(c.id)}/`))}">${esc(nameSk(c.id))}</a>`,
    esc(meta.taxSk[c.id].gainTax),
    esc(meta.taxSk[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Ktoré krajiny tento prehľad pokrýva?', a: `${N} krajín EÚ: ${COUNTRIES.map((c) => nameSk(c.id)).join(', ')}. Stav ${asOfSk}, údaje z modulu Virtuse Tax.` },
    { q: 'Ide o daňové poradenstvo?', a: 'Nie. Orientačný prehľad 2026 – nejde o daňové poradenstvo. Pravidlá pre aktuálny rok si overte u miestneho poradcu.' },
    { q: 'Hlási Virtuse moje držby daňovým úradom?', a: 'Nie. Virtuse nikdy nedrží vaše kľúče ani históriu vašich transakcií. KYC robia partneri sami.' },
    { q: 'Kde si okrem daní preverím aj dedenie?', a: `V module Tax & Inheritance Agent (live modul) s rovnakými ${N} krajinami a kontrolou pripravenosti na multisig.` }
  ];
  const answer = finalizeAnswer([
    `Tento prehľad porovnáva zdanenie Bitcoinu v ${N} krajinách EÚ, stav ${asOfSk}.`,
    'Sadzby, oslobodenia a poznámky k daňovému priznaniu pochádzajú z modulu Virtuse Tax.',
    'Nemecko a Rakúsko oslobodzujú zisky po 1 roku držby, Česko uplatňuje 3-ročný časový test a Holandsko namiesto dane zo ziskov zdaňuje predpokladaný výnos (Box 3).',
    'Orientačný prehľad 2026, nejde o daňové poradenstvo.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle(`Dane z Bitcoinu v ${N} krajinách EÚ (2026)`),
    description: assertDescription(`Sadzby dane z Bitcoinu, oslobodenia podľa doby držby a daňové priznanie v ${N} krajinách EÚ, stav ${asOfSk}. Orientačný prehľad.`),
    h1: `Dane z Bitcoinu v ${N} krajinách EÚ`,
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Dane z Bitcoinu', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'sk/bitcoin-dedicstvo/'), label: 'Bitcoin a dedičstvo' },
      { href: toRoot(relFile, 'sk/bitcoin-index-poplatkov/'), label: 'Index poplatkov za Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/' + TAX_AGENT), label: 'Otvoriť Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Každá stránka krajiny uvádza daň zo ziskov, prípadné oslobodenie podľa doby držby a daňové priznanie, stav ${esc(asOfSk)}. Live modul Tax & Inheritance Agent používa rovnaké údaje a pridáva skóre pripravenosti na dedenie.</p>
<h2>Porovnanie krajín</h2>
${tableHtml(['Krajina', 'Daň zo ziskov', 'Oslobodenie'], rows)}
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK country tax pages
for (const c of COUNTRIES) {
  const relFile = `sk/bitcoin-dane/${slugSk(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxSk[c.id];
  const inN = inSk(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Aká je daň z Bitcoinu ${inN}?`, a: `Stav ${asOfSk}: ${t.gainTax}. Orientačný prehľad 2026, nejde o daňové poradenstvo.` },
    { q: `Existuje ${inN} oslobodenie podľa doby držby?`, a: `${t.exemption}. Pred podaním priznania si pravidlá pre aktuálny rok overte u miestneho daňového poradcu.` },
    { q: `Ako sa ${inN} podáva daňové priznanie?`, a: `${t.filing}. ${t.note}` },
    { q: 'Drží Virtuse môj Bitcoin alebo podáva moje daňové priznanie?', a: `Nie. Virtuse nikdy nedrží vaše kľúče. KYC a registrácia prebiehajú u partnera. Tax Agent porovná prehľad ${N} krajín; daňové priznanie pripraví kvalifikovaný daňový poradca.` }
  ];
  const answer = finalizeAnswer([
    `Dane z Bitcoinu ${inN}, stav ${asOfSk}: ${t.gainTax}.`,
    `Oslobodenie: ${t.exemption}.`,
    `Priznanie: ${t.filing}.`,
    t.note,
    'Orientačný prehľad 2026, nejde o daňové poradenstvo.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle(`Dane z Bitcoinu ${inN} (${asOfSk})`),
    description: assertDescription(`Dane z Bitcoinu ${inN} (${asOfSk}): ${t.gainTax}. Nejde o daňové poradenstvo.`),
    h1: `Dane z Bitcoinu ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      skHome(relFile),
      { name: 'Dane z Bitcoinu', href: toRoot(relFile, 'sk/bitcoin-dane/'), abs: abs('sk/bitcoin-dane/index.html') },
      { name: nameSk(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-predat-alebo-pozicat/'), label: 'Bitcoin: predať alebo požičať' },
      { href: toRoot(relFile, 'sk/bitcoin-dedicstvo/'), label: 'Bitcoin a dedičstvo' },
      { href: toRoot(relFile, nbs[0] ? `sk/bitcoin-dane/${slugSk(nbs[0].id)}/` : 'sk/bitcoin-dane/'), label: nbs[0] ? `Dane z Bitcoinu ${inSk(nbs[0].id)}` : 'Všetky krajiny' }
    ],
    moduleCta: { href: toRoot(relFile, `sk/${TAX_AGENT}?country=${c.id}`), label: `Skontrolovať ${nameSk(c.id)} v Tax Agentovi →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Údaje so stavom ${esc(asOfSk)}, prevzaté z modulu Virtuse Tax.</p>
<h2>Sadzby a daňové priznanie</h2>
${tableHtml(['Údaj', 'Stav ' + asOfSk], [
  ['Daň zo ziskov', esc(t.gainTax)],
  ['Oslobodenie', esc(t.exemption)],
  ['Daňové priznanie', esc(t.filing)],
  ['Poznámka', esc(t.note)]
])}
<h2>Kedy zvyčajne vzniká daň?</h2>
<p>${esc(t.note)} Nákup Bitcoinu sa v tomto prehľade nepovažuje za zdaniteľný prevod; pred platbou, výmenou, darovaním alebo požičaním mincí si overte miestne pravidlá.</p>
<h2>Susedné krajiny</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `sk/bitcoin-dane/${slugSk(n.id)}/`))}">Dane z Bitcoinu ${esc(inSk(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK DCA calculator
{
  const relFile = 'sk/bitcoin-dca-kalkulacka/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Predpovedá táto kalkulačka cenu Bitcoinu?', a: 'Nie. Porovnáva len poplatky partnerov podľa zverejneného cenníka. Výnos z ceny Bitcoinu nemodeluje.' },
    { q: `Aký je štandardný plán, stav ${feeAsOfSk}?`, a: 'Jednorazovo 500 € a potom 100 € mesačne počas 12 mesiacov. Poradie podľa poplatkov za prvý rok.' },
    { q: 'Ktorá cesta je v tomto pláne najlacnejšia?', a: `${win.partner} (${methodSk(win.method)}) s variabilným poplatkom ${formatPctSk(win.pct)} podľa vzorca Stacking Strategist.` },
    { q: 'Ide o investičné poradenstvo?', a: 'Nie. Slúži len na vzdelávacie účely. KYC prebieha u partnera. Virtuse nikdy nedrží vaše kľúče.' }
  ];
  const answer = finalizeAnswer([
    `V príklade DCA, ktorý počíta len s poplatkami (500 € a potom 100 € mesačne počas 12 mesiacov), je k stavu ${feeAsOfSk} na prvom mieste ${win.partner}.`,
    `Variabilný poplatok ${formatPctSk(win.pct)}. Nejde o predpoveď ceny.`,
    'Údaje z live modulu Stacking Strategist. Orientačný prehľad 2026.'
  ], 'sk', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Bitcoin DCA kalkulačka (poplatky v EÚ 2026)'),
    description: assertDescription(`DCA kalkulačka pre Bitcoin, ktorá počíta len s poplatkami, stav ${feeAsOfSk}. Štandard 500 € + 100 € mesačne, najlacnejšia cesta ${win.partner}.`),
    h1: 'Bitcoin DCA kalkulačka',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'DCA kalkulačka', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-index-poplatkov/'), label: 'Index poplatkov za Bitcoin' },
      { href: toRoot(relFile, 'sk/bitcoin-predat-alebo-pozicat/'), label: 'Bitcoin: predať alebo požičať' },
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/stacking.html'), label: 'Otvoriť Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA kalkulačka',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Štandardný príklad: 500 € a potom 100 € mesačne × 12. Rovnaký vzorec ako v live module Stacking Strategist.</p>
<h2>Poradie pri 100 € mesačne</h2>
${tableHtml(['Poradie', 'Partner', 'Metóda', 'Variabilný poplatok', 'Ročné poplatky'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodSk(r.method)), esc(formatPctSk(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK sell vs borrow
{
  const relFile = 'sk/bitcoin-predat-alebo-pozicat/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Vzniká pri predaji v týchto ${N} krajinách daň?`, a: `Spravidla áno, pri predaji alebo výmene. Oslobodenia sa líšia: Nemecko 0 % po 1 roku držby, Česko 3-ročný časový test, Poľsko bez oslobodenia. Stav ${asOfSk}. Nejde o daňové poradenstvo.` },
    { q: 'Je pôžička rovnaká daňová udalosť ako predaj?', a: 'V tomto prehľade nie. Úroky, riziko likvidácie a KYC u partnera však platia. Konkrétne čísla vypočíta Loan & Liquidity Copilot.' },
    { q: 'Čo je riziko likvidácie?', a: 'Ak hodnota zábezpeky klesne na hranicu partnera, partner môže zábezpeku predať a splatiť ňou pôžičku. Virtuse nikdy nedrží vaše kľúče ani zábezpeku.' },
    { q: 'Kde si prepočítam konkrétnu sumu?', a: 'V live module Loan & Liquidity Copilot. Táto stránka vysvetľuje len rozdiel medzi daňou a rizikom na základe zverejnených daňových sadzieb.' }
  ];
  const answer = finalizeAnswer([
    `K stavu ${asOfSk} môže predaj Bitcoinu vyvolať daň (napríklad v Nemecku až 45 % počas 1-ročnej lehoty držby, v Rumunsku jednotných 10 %).`,
    'Pôžička zabezpečená Bitcoinom vám ponechá trhovú pozíciu, ale pridá úroky a riziko likvidácie u partnera.',
    'Orientačný prehľad 2026, nejde o daňové ani úverové poradenstvo. Virtuse nikdy nedrží vaše kľúče.'
  ], 'sk');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Bitcoin: predať, alebo si požičať? (2026)'),
    description: assertDescription(`Predať Bitcoin a zaplatiť daň, alebo si požičať so zábezpekou v Bitcoine a zostať investovaný? Sadzby ${N} krajín EÚ, stav ${asOfSk}.`),
    h1: 'Predať Bitcoin, alebo si požičať so zábezpekou?',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Predať alebo požičať', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'sk/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'sk/bitcoin-dedicstvo/'), label: 'Bitcoin a dedičstvo' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/loan.html'), label: 'Porovnať v Loan Copilote →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: predať alebo požičať',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Daň pri predaji</h2>
${tableHtml(['Krajina', 'Daň zo ziskov', 'Oslobodenie'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `sk/bitcoin-dane/${slugSk(c.id)}/`))}">${esc(nameSk(c.id))}</a>`,
  esc(meta.taxSk[c.id].gainTax),
  esc(meta.taxSk[c.id].exemption)
]))}
<h2>Riziko pri pôžičke</h2>
<p>Pôžičky zabezpečené Bitcoinom poskytujú regulovaní partneri, nie Virtuse. Ponecháte si cenovú expozíciu, platíte úroky a vaša zábezpeka môže byť zlikvidovaná. Virtuse zábezpeku nikdy nedrží.</p>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK inheritance
{
  const relFile = 'sk/bitcoin-dedicstvo/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Môže byť v liste s pokynmi seed fráza?', a: 'Nie. List uvádza zoznam, umiestnenia a kontakty – nikdy nie seed frázy. Uložte ho spolu so závetom alebo u právnika.' },
    { q: 'Prečo multisig 2 z 3?', a: 'Jediná seed fráza je jediný bod zlyhania pre vás aj pre vašich dedičov.' },
    { q: 'Drží Virtuse kľúče pre dedičov?', a: 'Nie. Virtuse nikdy nedrží vaše kľúče.' },
    { q: 'Ide o právne poradenstvo?', a: `Nie. Je to kontrolný zoznam na vzdelávacie účely z modulu Tax, stav ${asOfSk}.` }
  ];
  const answer = finalizeAnswer([
    `K stavu ${asOfSk} má kontrolný zoznam modulu Tax šesť bodov: list s pokynmi, geografické rozdelenie kľúčov, informovaný dedič, multisig 2 z 3, test obnovy a zdokumentované účty.`,
    'Jediná seed fráza je jediný bod zlyhania. Virtuse nikdy nedrží vaše kľúče.',
    'Nejde o právne poradenstvo.'
  ], 'sk');
  const howto = {
    '@type': 'HowTo',
    name: 'Príprava Bitcoinu na dedenie',
    inLanguage: 'sk',
    step: meta.inheritanceSk.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Bitcoin a dedičstvo: kontrolný zoznam (2026)'),
    description: assertDescription(`Šesťbodový kontrolný zoznam pre dedenie Bitcoinu, stav ${asOfSk}: list s pokynmi, rozdelenie kľúčov, multisig 2 z 3. Nejde o právne poradenstvo.`),
    h1: 'Dedenie Bitcoinu: kontrolný zoznam',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Dedičstvo', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'sk/bitcoin-dane/'), label: `Dane v ${N} krajinách EÚ` },
      { href: toRoot(relFile, 'sk/bitcoin-predat-alebo-pozicat/'), label: 'Bitcoin: predať alebo požičať' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/' + TAX_AGENT), label: 'Ohodnotiť zoznam v Tax Agentovi →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Obsah zodpovedá kontrolnému zoznamu modulu Tax. Nejde o právne poradenstvo.</p>
<h2>Návod: šesť krokov</h2>
<ol>${meta.inheritanceSk.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// SK fee index
{
  const relFile = 'sk/bitcoin-index-poplatkov/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'sk');
  const faqs = [
    { q: 'Čo meria index poplatkov?', a: `Ročné poplatky kúpnych ciest, stav ${feeAsOfSk}, podľa vzorca modulu Stacking Strategist.` },
    { q: 'Kto je pri 100 € mesačne najlacnejší?', a: `${winner.partner}: ${formatPctSk(winner.pct)}, ročné poplatky ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Sú v tom zahrnuté spready?', a: 'Nie. Len percentuálny poplatok a prípadné mesačné predplatné podľa cenníka. Kurzové rozdiely a poplatky siete Bitcoin (miner fees) nie sú zahrnuté.' },
    { q: 'Môžem tabuľku citovať?', a: `Áno, s uvedením zdroja „Zdroj: Virtuse index poplatkov za Bitcoin, stav ${feeAsOfSk}“ a odkazom.` }
  ];
  const answer = finalizeAnswer([
    `Virtuse index poplatkov za Bitcoin, stav ${feeAsOfSk}, zoraďuje kúpne cesty v EÚ podľa ročných poplatkov.`,
    `Pri 100 € mesačne vedie ${winner.partner} (${methodSk(winner.method)}) s ${formatPctSk(winner.pct)}, ${formatEurSk(winner.annualDrag)} ročne.`,
    beText,
    'Nejde o ponuku. Virtuse nikdy nedrží vaše kľúče.'
  ], 'sk', 'fee');
  pushPage({
    relFile, lang: 'sk',
    title: assertTitle('Index poplatkov za Bitcoin (EÚ) Q4 2026'),
    description: assertDescription(`Kúpne cesty v EÚ podľa poplatkov, stav ${feeAsOfSk}. Najlacnejšia cesta pri 100 € mesačne: ${winner.partner} s ${formatPctSk(winner.pct)}.`),
    h1: 'Index poplatkov za Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [skHome(relFile), { name: 'Index poplatkov', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'sk/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'sk/bitcoin-dane/slovensko/'), label: 'Dane z Bitcoinu na Slovensku' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Metodika (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'sk/stacking.html'), label: 'Otvoriť Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse index poplatkov za Bitcoin',
        inLanguage: 'sk',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse index poplatkov za Bitcoin',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Poradie podľa mesačného vkladu</h2>
${tables}
<h2>Automatizovane, alebo manuálne?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Časté otázky')}
`
  });
}

// ---------- Czech (cs/) ----------
function csHome(relFile) { return { name: 'Domů', href: toRoot(relFile, 'cs/index.html'), abs: abs('cs/index.html') }; }

// CS tax hub
{
  const relFile = 'cs/bitcoin-dane/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `cs/bitcoin-dane/${slugCs(c.id)}/`))}">${esc(nameCs(c.id))}</a>`,
    esc(meta.taxCs[c.id].gainTax),
    esc(meta.taxCs[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Které země tento přehled pokrývá?', a: `${N} zemí EU: ${COUNTRIES.map((c) => nameCs(c.id)).join(', ')}. Stav ${asOfCs}, údaje z modulu Virtuse Tax.` },
    { q: 'Jde o daňové poradenství?', a: 'Ne. Orientační přehled 2026 – nejde o daňové poradenství. Pravidla pro aktuální rok si ověřte u místního poradce.' },
    { q: 'Hlásí Virtuse moje držby finančnímu úřadu?', a: 'Ne. Virtuse nikdy nedrží vaše klíče ani historii vašich transakcí. KYC provádějí partneři sami.' },
    { q: 'Kde si kromě daní prověřím i dědění?', a: `V modulu Tax & Inheritance Agent (živý modul) se stejnými ${N} zeměmi a kontrolou připravenosti na multisig.` }
  ];
  const answer = finalizeAnswer([
    `Tento přehled porovnává zdanění Bitcoinu v ${N} zemích EU, stav ${asOfCs}.`,
    'Sazby, osvobození a poznámky k daňovému přiznání pocházejí z modulu Virtuse Tax.',
    'Německo a Rakousko osvobozují zisky po 1 roce držení, Česko uplatňuje 3letý časový test a Nizozemsko místo daně ze zisků daní předpokládaný výnos (Box 3).',
    'Orientační přehled 2026, nejde o daňové poradenství.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle(`Daně z Bitcoinu v ${N} zemích EU (2026)`),
    description: assertDescription(`Sazby daně z Bitcoinu, osvobození podle doby držení a daňové přiznání v ${N} zemích EU, stav ${asOfCs}. Orientační přehled.`),
    h1: `Daně z Bitcoinu v ${N} zemích EU`,
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Daně z Bitcoinu', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'cs/bitcoin-dedictvi/'), label: 'Bitcoin a dědění' },
      { href: toRoot(relFile, 'cs/bitcoin-index-poplatku/'), label: 'Index poplatků za Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/' + TAX_AGENT), label: 'Otevřít Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Každá stránka země uvádí daň ze zisků, případné osvobození podle doby držení a daňové přiznání, stav ${esc(asOfCs)}. Živý modul Tax & Inheritance Agent používá stejné údaje a přidává skóre připravenosti na dědění.</p>
<h2>Srovnání zemí</h2>
${tableHtml(['Země', 'Daň ze zisků', 'Osvobození'], rows)}
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS country tax pages
for (const c of COUNTRIES) {
  const relFile = `cs/bitcoin-dane/${slugCs(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxCs[c.id];
  const inN = inCs(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Jaká je daň z Bitcoinu ${inN}?`, a: `Stav ${asOfCs}: ${t.gainTax}. Orientační přehled 2026, nejde o daňové poradenství.` },
    { q: `Existuje ${inN} osvobození podle doby držení?`, a: `${t.exemption}. Před podáním přiznání si pravidla pro aktuální rok ověřte u místního daňového poradce.` },
    { q: `Jak se ${inN} podává daňové přiznání?`, a: `${t.filing}. ${t.note}` },
    { q: 'Drží Virtuse můj Bitcoin nebo podává moje daňové přiznání?', a: `Ne. Virtuse nikdy nedrží vaše klíče. KYC a registrace probíhají u partnera. Tax Agent porovná přehled ${N} zemí; daňové přiznání připraví kvalifikovaný daňový poradce.` }
  ];
  const answer = finalizeAnswer([
    `Daně z Bitcoinu ${inN}, stav ${asOfCs}: ${t.gainTax}.`,
    `Osvobození: ${t.exemption}.`,
    `Přiznání: ${t.filing}.`,
    t.note,
    'Orientační přehled 2026, nejde o daňové poradenství.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle(`Daně z Bitcoinu ${inN} (${asOfCs})`),
    description: assertDescription(`Daně z Bitcoinu ${inN} (${asOfCs}): ${t.gainTax}. Nejde o daňové poradenství.`),
    h1: `Daně z Bitcoinu ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      csHome(relFile),
      { name: 'Daně z Bitcoinu', href: toRoot(relFile, 'cs/bitcoin-dane/'), abs: abs('cs/bitcoin-dane/index.html') },
      { name: nameCs(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-prodat-nebo-pujcit/'), label: 'Bitcoin: prodat, nebo si půjčit' },
      { href: toRoot(relFile, 'cs/bitcoin-dedictvi/'), label: 'Bitcoin a dědění' },
      { href: toRoot(relFile, nbs[0] ? `cs/bitcoin-dane/${slugCs(nbs[0].id)}/` : 'cs/bitcoin-dane/'), label: nbs[0] ? `Daně z Bitcoinu ${inCs(nbs[0].id)}` : 'Všechny země' }
    ],
    moduleCta: { href: toRoot(relFile, `cs/${TAX_AGENT}?country=${c.id}`), label: `Zkontrolovat ${accCs(c.id)} v Tax Agentovi →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Údaje ke stavu ${esc(asOfCs)}, převzaté z modulu Virtuse Tax.</p>
<h2>Sazby a daňové přiznání</h2>
${tableHtml(['Údaj', 'Stav ' + asOfCs], [
  ['Daň ze zisků', esc(t.gainTax)],
  ['Osvobození', esc(t.exemption)],
  ['Daňové přiznání', esc(t.filing)],
  ['Poznámka', esc(t.note)]
])}
<h2>Kdy obvykle vzniká daň?</h2>
<p>${esc(t.note)} Nákup Bitcoinu se v tomto přehledu nepovažuje za zdanitelný převod; před platbou, směnou, darováním nebo půjčením mincí si ověřte místní pravidla.</p>
<h2>Sousední země</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `cs/bitcoin-dane/${slugCs(n.id)}/`))}">Daně z Bitcoinu ${esc(inCs(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS DCA calculator
{
  const relFile = 'cs/bitcoin-dca-kalkulacka/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Předpovídá tato kalkulačka cenu Bitcoinu?', a: 'Ne. Porovnává jen poplatky partnerů podle zveřejněného ceníku. Výnos z ceny Bitcoinu nemodeluje.' },
    { q: `Jaký je standardní plán, stav ${feeAsOfCs}?`, a: 'Jednorázově 500 € a poté 100 € měsíčně po dobu 12 měsíců. Pořadí podle poplatků za první rok.' },
    { q: 'Která cesta je v tomto plánu nejlevnější?', a: `${win.partner} (${methodCs(win.method)}) s variabilním poplatkem ${formatPctSk(win.pct)} podle vzorce Stacking Strategist.` },
    { q: 'Jde o investiční poradenství?', a: 'Ne. Slouží jen ke vzdělávacím účelům. KYC probíhá u partnera. Virtuse nikdy nedrží vaše klíče.' }
  ];
  const answer = finalizeAnswer([
    `V příkladu DCA, který počítá jen s poplatky (500 € a poté 100 € měsíčně po dobu 12 měsíců), je ke stavu ${feeAsOfCs} na prvním místě ${win.partner}.`,
    `Variabilní poplatek ${formatPctSk(win.pct)}. Nejde o předpověď ceny.`,
    'Údaje z živého modulu Stacking Strategist. Orientační přehled 2026.'
  ], 'cs', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Bitcoin DCA kalkulačka (poplatky v EU 2026)'),
    description: assertDescription(`DCA kalkulačka pro Bitcoin, která počítá jen s poplatky, stav ${feeAsOfCs}. Standard 500 € + 100 € měsíčně, nejlevnější cesta ${win.partner}.`),
    h1: 'Bitcoin DCA kalkulačka',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'DCA kalkulačka', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-index-poplatku/'), label: 'Index poplatků za Bitcoin' },
      { href: toRoot(relFile, 'cs/bitcoin-prodat-nebo-pujcit/'), label: 'Bitcoin: prodat, nebo si půjčit' },
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/stacking.html'), label: 'Otevřít Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA kalkulačka',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Standardní příklad: 500 € a poté 100 € měsíčně × 12. Stejný vzorec jako v živém modulu Stacking Strategist.</p>
<h2>Pořadí při 100 € měsíčně</h2>
${tableHtml(['Pořadí', 'Partner', 'Metoda', 'Variabilní poplatek', 'Roční poplatky'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodCs(r.method)), esc(formatPctSk(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS sell vs borrow
{
  const relFile = 'cs/bitcoin-prodat-nebo-pujcit/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Vzniká při prodeji v těchto ${N} zemích daň?`, a: `Zpravidla ano, při prodeji nebo směně. Osvobození se liší: Německo 0 % po 1 roce držení, Česko 3letý časový test, Polsko bez osvobození. Stav ${asOfCs}. Nejde o daňové poradenství.` },
    { q: 'Je půjčka stejná daňová událost jako prodej?', a: 'V tomto přehledu ne. Úroky, riziko likvidace a KYC u partnera však platí. Konkrétní čísla spočítá Loan & Liquidity Copilot.' },
    { q: 'Co je riziko likvidace?', a: 'Pokud hodnota zajištění klesne na hranici partnera, partner může zajištění prodat a splatit jím půjčku. Virtuse nikdy nedrží vaše klíče ani zajištění.' },
    { q: 'Kde si přepočítám konkrétní částku?', a: 'V živém modulu Loan & Liquidity Copilot. Tato stránka vysvětluje jen rozdíl mezi daní a rizikem na základě zveřejněných daňových sazeb.' }
  ];
  const answer = finalizeAnswer([
    `Ke stavu ${asOfCs} může prodej Bitcoinu vyvolat daň (například v Německu až 45 % během 1leté lhůty držení, v Rumunsku jednotných 10 %).`,
    'Půjčka zajištěná Bitcoinem vám ponechá tržní pozici, ale přidá úroky a riziko likvidace u partnera.',
    'Orientační přehled 2026, nejde o daňové ani úvěrové poradenství. Virtuse nikdy nedrží vaše klíče.'
  ], 'cs');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Bitcoin: prodat, nebo si půjčit? (2026)'),
    description: assertDescription(`Prodat Bitcoin a zaplatit daň, nebo si půjčit se zajištěním v Bitcoinu a zůstat investovaný? Sazby ${N} zemí EU, stav ${asOfCs}.`),
    h1: 'Prodat Bitcoin, nebo si půjčit se zajištěním?',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Prodat, nebo půjčit', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'cs/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'cs/bitcoin-dedictvi/'), label: 'Bitcoin a dědění' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/loan.html'), label: 'Porovnat v Loan Copilotu →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: prodat, nebo si půjčit',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Daň při prodeji</h2>
${tableHtml(['Země', 'Daň ze zisků', 'Osvobození'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `cs/bitcoin-dane/${slugCs(c.id)}/`))}">${esc(nameCs(c.id))}</a>`,
  esc(meta.taxCs[c.id].gainTax),
  esc(meta.taxCs[c.id].exemption)
]))}
<h2>Riziko při půjčce</h2>
<p>Půjčky zajištěné Bitcoinem poskytují regulovaní partneři, ne Virtuse. Ponecháte si cenovou expozici, platíte úroky a vaše zajištění může být zlikvidováno. Virtuse zajištění nikdy nedrží.</p>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS inheritance
{
  const relFile = 'cs/bitcoin-dedictvi/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Může být v dopise s pokyny seed fráze?', a: 'Ne. Dopis uvádí seznam, umístění a kontakty – nikdy ne seed fráze. Uložte ho spolu se závětí nebo u právníka.' },
    { q: 'Proč multisig 2 ze 3?', a: 'Jediná seed fráze je jediný bod selhání pro vás i pro vaše dědice.' },
    { q: 'Drží Virtuse klíče pro dědice?', a: 'Ne. Virtuse nikdy nedrží vaše klíče.' },
    { q: 'Jde o právní poradenství?', a: `Ne. Je to kontrolní seznam ke vzdělávacím účelům z modulu Tax, stav ${asOfCs}.` }
  ];
  const answer = finalizeAnswer([
    `Ke stavu ${asOfCs} má kontrolní seznam modulu Tax šest bodů: dopis s pokyny, geografické rozdělení klíčů, informovaný dědic, multisig 2 ze 3, test obnovy a zdokumentované účty.`,
    'Jediná seed fráze je jediný bod selhání. Virtuse nikdy nedrží vaše klíče.',
    'Nejde o právní poradenství.'
  ], 'cs');
  const howto = {
    '@type': 'HowTo',
    name: 'Příprava Bitcoinu na dědění',
    inLanguage: 'cs',
    step: meta.inheritanceCs.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Bitcoin a dědění: kontrolní seznam (2026)'),
    description: assertDescription(`Šestibodový kontrolní seznam pro dědění Bitcoinu, stav ${asOfCs}: dopis s pokyny, rozdělení klíčů, multisig 2 ze 3. Nejde o právní poradenství.`),
    h1: 'Dědění Bitcoinu: kontrolní seznam',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Dědění', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'cs/bitcoin-dane/'), label: `Daně v ${N} zemích EU` },
      { href: toRoot(relFile, 'cs/bitcoin-prodat-nebo-pujcit/'), label: 'Bitcoin: prodat, nebo si půjčit' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/' + TAX_AGENT), label: 'Ohodnotit seznam v Tax Agentovi →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Obsah odpovídá kontrolnímu seznamu modulu Tax. Nejde o právní poradenství.</p>
<h2>Návod: šest kroků</h2>
<ol>${meta.inheritanceCs.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// CS fee index
{
  const relFile = 'cs/bitcoin-index-poplatku/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'cs');
  const faqs = [
    { q: 'Co měří index poplatků?', a: `Roční poplatky nákupních cest, stav ${feeAsOfCs}, podle vzorce modulu Stacking Strategist.` },
    { q: 'Kdo je při 100 € měsíčně nejlevnější?', a: `${winner.partner}: ${formatPctSk(winner.pct)}, roční poplatky ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Jsou v tom zahrnuté spready?', a: 'Ne. Jen procentní poplatek a případné měsíční předplatné podle ceníku. Kurzové rozdíly a poplatky sítě Bitcoin (miner fees) zahrnuté nejsou.' },
    { q: 'Mohu tabulku citovat?', a: `Ano, s uvedením zdroje „Zdroj: Virtuse index poplatků za Bitcoin, stav ${feeAsOfCs}“ a odkazem.` }
  ];
  const answer = finalizeAnswer([
    `Virtuse index poplatků za Bitcoin, stav ${feeAsOfCs}, řadí nákupní cesty v EU podle ročních poplatků.`,
    `Při 100 € měsíčně vede ${winner.partner} (${methodCs(winner.method)}) s ${formatPctSk(winner.pct)}, ${formatEurSk(winner.annualDrag)} ročně.`,
    beText,
    'Nejde o nabídku. Virtuse nikdy nedrží vaše klíče.'
  ], 'cs', 'fee');
  pushPage({
    relFile, lang: 'cs',
    title: assertTitle('Index poplatků za Bitcoin (EU) Q4 2026'),
    description: assertDescription(`Nákupní cesty v EU podle poplatků, stav ${feeAsOfCs}. Nejlevnější cesta při 100 € měsíčně: ${winner.partner} s ${formatPctSk(winner.pct)}.`),
    h1: 'Index poplatků za Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [csHome(relFile), { name: 'Index poplatků', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'cs/bitcoin-dca-kalkulacka/'), label: 'DCA kalkulačka' },
      { href: toRoot(relFile, 'cs/bitcoin-dane/cesko/'), label: 'Daně z Bitcoinu v Česku' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Metodika (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'cs/stacking.html'), label: 'Otevřít Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse index poplatků za Bitcoin',
        inLanguage: 'cs',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse index poplatků za Bitcoin',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Pořadí podle měsíčního vkladu</h2>
${tables}
<h2>Automatizovaně, nebo ručně?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Časté dotazy')}
`
  });
}

// ---------- Polish (pl/) ----------
function plHome(relFile) { return { name: 'Strona główna', href: toRoot(relFile, 'pl/index.html'), abs: abs('pl/index.html') }; }
/** Long gain-tax strings (France) push the description past 155 chars: drop the tail then. */
function descFit(main, tail) { return (main + ' ' + tail).length <= 155 ? `${main} ${tail}` : main; }

// PL tax hub
{
  const relFile = 'pl/bitcoin-podatki/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `pl/bitcoin-podatki/${slugPl(c.id)}/`))}">${esc(namePl(c.id))}</a>`,
    esc(meta.taxPl[c.id].gainTax),
    esc(meta.taxPl[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Jakie kraje obejmuje ten przegląd?', a: `${N} krajów UE: ${COUNTRIES.map((c) => namePl(c.id)).join(', ')}. Stan na ${asOfPl}, dane z modułu Virtuse Tax.` },
    { q: 'Czy to porada podatkowa?', a: 'Nie. Przegląd orientacyjny 2026, nie stanowi porady podatkowej. Zasady na bieżący rok warto potwierdzić z lokalnym doradcą.' },
    { q: 'Czy Virtuse zgłasza moje aktywa do urzędu skarbowego?', a: 'Nie. Virtuse nigdy nie przechowuje Państwa kluczy ani historii transakcji. KYC przeprowadzają sami partnerzy.' },
    { q: 'Gdzie oprócz podatków sprawdzę też dziedziczenie?', a: `W module Tax & Inheritance Agent, z tymi samymi ${N} krajami i oceną gotowości do multisig.` }
  ];
  const answer = finalizeAnswer([
    `Ten przegląd porównuje opodatkowanie Bitcoina w ${N} krajach UE, stan na ${asOfPl}.`,
    'Stawki, zwolnienia i uwagi dotyczące zeznania pochodzą z modułu Virtuse Tax.',
    'Niemcy i Austria zwalniają zyski po roku posiadania, Czechy stosują 3-letni test czasu, a Holandia zamiast podatku od zysków opodatkowuje domniemany zwrot (Box 3).',
    'Przegląd orientacyjny 2026, nie stanowi porady podatkowej.'
  ], 'pl');
  pushPage({
    relFile, lang: 'pl',
    title: assertTitle(`Podatek od Bitcoina w ${N} krajach UE (2026)`),
    description: assertDescription(`Stawki podatku od Bitcoina, zwolnienia za okres posiadania i zeznanie podatkowe w ${N} krajach UE, stan na ${asOfPl}. Przegląd orientacyjny.`),
    h1: `Podatek od Bitcoina w ${N} krajach UE`,
    answerHtml: esc(answer),
    breadcrumbs: [plHome(relFile), { name: 'Podatek od Bitcoina', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'pl/bitcoin-podatki/polska/'), label: 'Podatek od Bitcoina w Polsce' },
      { href: toRoot(relFile, 'pl/bitcoin-dziedziczenie/'), label: 'Bitcoin i dziedziczenie' },
      { href: toRoot(relFile, 'pl/bitcoin-indeks-oplat/'), label: 'Indeks opłat za Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'pl/' + TAX_AGENT), label: 'Otwórz Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Każda strona kraju podaje podatek od zysków, ewentualne zwolnienie za okres posiadania i sposób rozliczenia, stan na ${esc(asOfPl)}. Moduł Tax & Inheritance Agent korzysta z tych samych danych i dodaje ocenę gotowości do dziedziczenia.</p>
<h2>Porównanie krajów</h2>
${tableHtml(['Kraj', 'Podatek od zysków', 'Zwolnienie'], rows)}
${faqHtml(faqs, 'Najczęstsze pytania')}
`
  });
}

// PL country tax pages
for (const c of COUNTRIES) {
  const relFile = `pl/bitcoin-podatki/${slugPl(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxPl[c.id];
  const inN = inPl(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Ile wynosi podatek od Bitcoina ${inN}?`, a: `Stan na ${asOfPl}: ${t.gainTax}. Przegląd orientacyjny 2026, nie stanowi porady podatkowej.` },
    { q: `Czy ${inN} jest zwolnienie za okres posiadania?`, a: `${t.exemption}. Przed złożeniem zeznania warto potwierdzić zasady na bieżący rok z lokalnym doradcą podatkowym.` },
    { q: `Jak ${inN} rozlicza się podatek od Bitcoina?`, a: `${t.filing}. ${t.note}` },
    { q: 'Czy Virtuse przechowuje mój Bitcoin albo składa za mnie zeznanie?', a: `Nie. Virtuse nigdy nie przechowuje Państwa kluczy. KYC i rejestracja odbywają się u partnera. Tax Agent porówna przegląd ${N} krajów; zeznanie przygotuje wykwalifikowany doradca podatkowy.` }
  ];
  const answer = finalizeAnswer([
    `Podatek od Bitcoina ${inN}, stan na ${asOfPl}: ${t.gainTax}.`,
    `Zwolnienie: ${t.exemption}.`,
    `Zeznanie: ${t.filing}.`,
    t.note,
    'Przegląd orientacyjny 2026, nie stanowi porady podatkowej.'
  ], 'pl');
  pushPage({
    relFile, lang: 'pl',
    title: assertTitle(`Podatek od Bitcoina ${inN} (${asOfPl})`),
    description: assertDescription(descFit(`Podatek od Bitcoina ${inN} (${asOfPl}): ${t.gainTax}.`, 'Nie stanowi porady podatkowej.')),
    h1: `Podatek od Bitcoina ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      plHome(relFile),
      { name: 'Podatek od Bitcoina', href: toRoot(relFile, 'pl/bitcoin-podatki/'), abs: abs('pl/bitcoin-podatki/index.html') },
      { name: namePl(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'pl/bitcoin-sprzedac-czy-pozyczyc/'), label: 'Bitcoin: sprzedać czy pożyczyć' },
      { href: toRoot(relFile, 'pl/bitcoin-dziedziczenie/'), label: 'Bitcoin i dziedziczenie' },
      { href: toRoot(relFile, nbs[0] ? `pl/bitcoin-podatki/${slugPl(nbs[0].id)}/` : 'pl/bitcoin-podatki/'), label: nbs[0] ? `Podatek od Bitcoina ${inPl(nbs[0].id)}` : 'Wszystkie kraje' }
    ],
    moduleCta: { href: toRoot(relFile, `pl/${TAX_AGENT}?country=${c.id}`), label: `Sprawdź ${accPl(c.id)} w Tax Agencie →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Dane według stanu na ${esc(asOfPl)}, przejęte z modułu Virtuse Tax.</p>
<h2>Stawki i zeznanie podatkowe</h2>
${tableHtml(['Pole', 'Stan na ' + asOfPl], [
  ['Podatek od zysków', esc(t.gainTax)],
  ['Zwolnienie', esc(t.exemption)],
  ['Zeznanie podatkowe', esc(t.filing)],
  ['Uwaga', esc(t.note)]
])}
<h2>Kiedy zwykle powstaje podatek?</h2>
<p>${esc(t.note)} Zakup Bitcoina nie jest w tym przeglądzie traktowany jako zbycie; przed płatnością, wymianą, darowizną lub pożyczeniem monet warto sprawdzić lokalne przepisy.</p>
<h2>Kraje sąsiednie</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `pl/bitcoin-podatki/${slugPl(n.id)}/`))}">Podatek od Bitcoina ${esc(inPl(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Najczęstsze pytania')}
`
  });
}

// PL DCA calculator
{
  const relFile = 'pl/bitcoin-kalkulator-dca/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Czy ten kalkulator prognozuje cenę Bitcoina?', a: 'Nie. Porównuje tylko opłaty partnerów według opublikowanego cennika. Nie modeluje zwrotu z ceny Bitcoina.' },
    { q: `Jaki jest plan standardowy, stan na ${feeAsOfPl}?`, a: 'Jednorazowo 500 €, a potem 100 € miesięcznie przez 12 miesięcy. Kolejność według opłat w pierwszym roku.' },
    { q: 'Która ścieżka jest w tym planie najtańsza?', a: `${win.partner} (${methodPl(win.method)}) z opłatą zmienną ${formatPctPl(win.pct)} według wzoru Stacking Strategist.` },
    { q: 'Czy to porada inwestycyjna?', a: 'Nie. Służy wyłącznie celom edukacyjnym. KYC odbywa się u partnera. Virtuse nigdy nie przechowuje Państwa kluczy.' }
  ];
  const answer = finalizeAnswer([
    `Według stanu na ${feeAsOfPl} w przykładzie DCA uwzględniającym tylko opłaty (500 €, a potem 100 € miesięcznie przez 12 miesięcy) na pierwszym miejscu jest ${win.partner}.`,
    `Opłata zmienna ${formatPctPl(win.pct)}. To nie jest prognoza ceny.`,
    'Dane z modułu Stacking Strategist. Przegląd orientacyjny 2026.'
  ], 'pl', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'pl',
    title: assertTitle('Kalkulator DCA dla Bitcoina (opłaty w UE 2026)'),
    description: assertDescription(`Kalkulator DCA dla Bitcoina uwzględniający tylko opłaty, stan na ${feeAsOfPl}. Standard 500 € + 100 € miesięcznie, najtańsza ścieżka: ${win.partner}.`),
    h1: 'Kalkulator DCA dla Bitcoina',
    answerHtml: esc(answer),
    breadcrumbs: [plHome(relFile), { name: 'Kalkulator DCA', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'pl/bitcoin-indeks-oplat/'), label: 'Indeks opłat za Bitcoin' },
      { href: toRoot(relFile, 'pl/bitcoin-sprzedac-czy-pozyczyc/'), label: 'Bitcoin: sprzedać czy pożyczyć' },
      { href: toRoot(relFile, 'pl/bitcoin-podatki/polska/'), label: 'Podatek od Bitcoina w Polsce' }
    ],
    moduleCta: { href: toRoot(relFile, 'pl/stacking.html'), label: 'Otwórz Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Kalkulator DCA dla Bitcoina',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Przykład standardowy: 500 €, a potem 100 € miesięcznie × 12. Ten sam wzór co w module Stacking Strategist.</p>
<h2>Ranking przy 100 € miesięcznie</h2>
${tableHtml(['Miejsce', 'Partner', 'Metoda', 'Opłata zmienna', 'Roczne opłaty'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodPl(r.method)), esc(formatPctPl(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Najczęstsze pytania')}
`
  });
}

// PL sell vs borrow
{
  const relFile = 'pl/bitcoin-sprzedac-czy-pozyczyc/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Czy sprzedaż w tych ${N} krajach wywołuje podatek?`, a: `Zazwyczaj tak, przy sprzedaży lub wymianie. Zwolnienia się różnią: Niemcy 0% po roku posiadania, Czechy 3-letni test czasu, Polska bez zwolnienia. Stan na ${asOfPl}. Nie stanowi porady podatkowej.` },
    { q: 'Czy pożyczka jest tym samym zdarzeniem podatkowym co sprzedaż?', a: 'W tym przeglądzie nie. Odsetki, ryzyko likwidacji i KYC u partnera jednak pozostają. Konkretne liczby wyliczy Loan & Liquidity Copilot.' },
    { q: 'Czym jest ryzyko likwidacji?', a: 'Jeśli wartość zabezpieczenia spadnie do progu partnera, partner może sprzedać zabezpieczenie i spłacić nim pożyczkę. Virtuse nigdy nie przechowuje Państwa kluczy ani zabezpieczenia.' },
    { q: 'Gdzie przeliczę konkretną kwotę?', a: 'W module Loan & Liquidity Copilot. Ta strona wyjaśnia tylko różnicę między podatkiem a ryzykiem na podstawie opublikowanych stawek podatkowych.' }
  ];
  const answer = finalizeAnswer([
    `Według stanu na ${asOfPl} sprzedaż Bitcoina może wywołać podatek (np. w Niemczech do 45% w ciągu roku posiadania, w Rumunii liniowe 10%).`,
    'Pożyczka pod zastaw Bitcoina pozwala zachować pozycję rynkową, ale oznacza odsetki i ryzyko likwidacji u partnera.',
    'Przegląd orientacyjny 2026, nie stanowi porady podatkowej ani kredytowej. Virtuse nigdy nie przechowuje Państwa kluczy.'
  ], 'pl');
  pushPage({
    relFile, lang: 'pl',
    title: assertTitle('Bitcoin: sprzedać czy pożyczyć? (2026)'),
    description: assertDescription(`Sprzedać Bitcoina i zapłacić podatek czy wziąć pożyczkę pod jego zastaw i pozostać zainwestowanym? Stawki w ${N} krajach UE, stan na ${asOfPl}.`),
    h1: 'Sprzedać Bitcoina czy pożyczyć pod jego zastaw?',
    answerHtml: esc(answer),
    breadcrumbs: [plHome(relFile), { name: 'Sprzedać czy pożyczyć', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'pl/bitcoin-podatki/polska/'), label: 'Podatek od Bitcoina w Polsce' },
      { href: toRoot(relFile, 'pl/bitcoin-kalkulator-dca/'), label: 'Kalkulator DCA' },
      { href: toRoot(relFile, 'pl/bitcoin-dziedziczenie/'), label: 'Bitcoin i dziedziczenie' }
    ],
    moduleCta: { href: toRoot(relFile, 'pl/loan.html'), label: 'Porównaj w Loan Copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: sprzedać czy pożyczyć',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Podatek przy sprzedaży</h2>
${tableHtml(['Kraj', 'Podatek od zysków', 'Zwolnienie'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `pl/bitcoin-podatki/${slugPl(c.id)}/`))}">${esc(namePl(c.id))}</a>`,
  esc(meta.taxPl[c.id].gainTax),
  esc(meta.taxPl[c.id].exemption)
]))}
<h2>Ryzyko przy pożyczce</h2>
<p>Pożyczek pod zastaw Bitcoina udzielają regulowani partnerzy, a nie Virtuse. Zachowują Państwo ekspozycję na cenę i płacą odsetki, a zabezpieczenie może zostać zlikwidowane. Virtuse nigdy nie przechowuje zabezpieczenia.</p>
${faqHtml(faqs, 'Najczęstsze pytania')}
`
  });
}

// PL inheritance
{
  const relFile = 'pl/bitcoin-dziedziczenie/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Czy w liście instrukcji może być fraza odzyskiwania?', a: 'Nie. List zawiera inwentarz, lokalizacje i kontakty, nigdy frazy odzyskiwania. Najlepiej przechowywać go razem z testamentem lub u prawnika.' },
    { q: 'Dlaczego multisig 2 z 3?', a: 'Jedna fraza odzyskiwania to pojedynczy punkt awarii, dla Państwa i dla spadkobierców.' },
    { q: 'Czy Virtuse przechowuje klucze dla spadkobierców?', a: 'Nie. Virtuse nigdy nie przechowuje Państwa kluczy.' },
    { q: 'Czy to porada prawna?', a: `Nie. To lista kontrolna do celów edukacyjnych z modułu Tax, stan na ${asOfPl}.` }
  ];
  const answer = finalizeAnswer([
    `Według stanu na ${asOfPl} lista kontrolna modułu Tax ma sześć punktów: list instrukcji, geograficzne rozdzielenie kluczy, poinformowany spadkobierca, multisig 2 z 3, test odzyskiwania i udokumentowane konta.`,
    'Jedna fraza odzyskiwania to pojedynczy punkt awarii. Virtuse nigdy nie przechowuje Państwa kluczy.',
    'Nie stanowi porady prawnej.'
  ], 'pl');
  const howto = {
    '@type': 'HowTo',
    name: 'Przygotowanie Bitcoina do dziedziczenia',
    inLanguage: 'pl',
    step: meta.inheritancePl.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'pl',
    title: assertTitle('Bitcoin i dziedziczenie: lista kontrolna (2026)'),
    description: assertDescription(`Sześciopunktowa lista kontrolna dziedziczenia Bitcoina, stan na ${asOfPl}: list instrukcji, rozdzielenie kluczy, multisig 2 z 3. Nie stanowi porady prawnej.`),
    h1: 'Dziedziczenie Bitcoina: lista kontrolna',
    answerHtml: esc(answer),
    breadcrumbs: [plHome(relFile), { name: 'Dziedziczenie', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'pl/bitcoin-podatki/polska/'), label: 'Podatek od Bitcoina w Polsce' },
      { href: toRoot(relFile, 'pl/bitcoin-podatki/'), label: `Podatki w ${N} krajach UE` },
      { href: toRoot(relFile, 'pl/bitcoin-sprzedac-czy-pozyczyc/'), label: 'Bitcoin: sprzedać czy pożyczyć' }
    ],
    moduleCta: { href: toRoot(relFile, 'pl/' + TAX_AGENT), label: 'Oceń listę w Tax Agencie →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Treść odpowiada liście kontrolnej modułu Tax. Nie stanowi porady prawnej.</p>
<h2>Instrukcja: sześć kroków</h2>
<ol>${meta.inheritancePl.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Najczęstsze pytania')}
`
  });
}

// PL fee index
{
  const relFile = 'pl/bitcoin-indeks-oplat/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'pl');
  const faqs = [
    { q: 'Co mierzy indeks opłat?', a: `Roczne opłaty ścieżek zakupu, stan na ${feeAsOfPl}, według wzoru modułu Stacking Strategist.` },
    { q: 'Kto jest najtańszy przy 100 € miesięcznie?', a: `${winner.partner}: ${formatPctPl(winner.pct)}, roczne opłaty ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Czy spready są uwzględnione?', a: 'Nie. Tylko opłata procentowa i ewentualny miesięczny abonament według cennika. Różnice kursowe i opłaty sieci Bitcoin (miner fees) nie są uwzględnione.' },
    { q: 'Czy mogę cytować tabelę?', a: `Tak, z podaniem źródła „Źródło: indeks opłat za Bitcoin Virtuse, stan na ${feeAsOfPl}” i linkiem.` }
  ];
  const answer = finalizeAnswer([
    `Indeks opłat za Bitcoin Virtuse, stan na ${feeAsOfPl}, porządkuje ścieżki zakupu w UE według rocznych opłat.`,
    `Przy 100 € miesięcznie prowadzi ${winner.partner} (${methodPl(winner.method)}) z ${formatPctPl(winner.pct)}, ${formatEurSk(winner.annualDrag)} rocznie.`,
    beText,
    'To nie jest oferta. Virtuse nigdy nie przechowuje Państwa kluczy.'
  ], 'pl', 'fee');
  pushPage({
    relFile, lang: 'pl',
    title: assertTitle('Indeks opłat za Bitcoin (UE) Q4 2026'),
    description: assertDescription(`Ścieżki zakupu w UE według opłat, stan na ${feeAsOfPl}. Najtańsza ścieżka przy 100 € miesięcznie: ${winner.partner} z ${formatPctPl(winner.pct)}.`),
    h1: 'Indeks opłat za Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [plHome(relFile), { name: 'Indeks opłat', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'pl/bitcoin-kalkulator-dca/'), label: 'Kalkulator DCA' },
      { href: toRoot(relFile, 'pl/bitcoin-podatki/polska/'), label: 'Podatek od Bitcoina w Polsce' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Metodologia (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'pl/stacking.html'), label: 'Otwórz Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Indeks opłat za Bitcoin Virtuse',
        inLanguage: 'pl',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Indeks opłat za Bitcoin Virtuse',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Ranking według miesięcznej wpłaty</h2>
${tables}
<h2>Automatycznie czy ręcznie?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Najczęstsze pytania')}
`
  });
}

// ---------- Hungarian (hu/) ----------
function huHome(relFile) { return { name: 'Főoldal', href: toRoot(relFile, 'hu/index.html'), abs: abs('hu/index.html') }; }

// HU tax hub
{
  const relFile = 'hu/bitcoin-adozas/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `hu/bitcoin-adozas/${slugHu(c.id)}/`))}">${esc(nameHu(c.id))}</a>`,
    esc(meta.taxHu[c.id].gainTax),
    esc(meta.taxHu[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Mely országokra terjed ki az áttekintés?', a: `${N} EU-ország: ${COUNTRIES.map((c) => nameHu(c.id)).join(', ')}. ${asOfHu} állapot szerint, adatok a Virtuse Tax modulból.` },
    { q: 'Adótanácsadásnak számít ez?', a: 'Nem. Tájékoztató áttekintés 2026, nem adótanácsadás. A tárgyévi szabályokat érdemes helyi tanácsadóval egyeztetni.' },
    { q: 'Jelenti a Virtuse az eszközeimet az adóhatóságnak?', a: 'Nem. A Virtuse soha nem kezeli az Ön kulcsait és a tranzakciós előzményeit sem. A KYC-t a partnerek végzik.' },
    { q: 'Hol nézhetem meg az adók mellett az öröklést is?', a: `A Tax & Inheritance Agent modulban, ugyanazzal a ${N} országgal és multisig-felkészültségi ellenőrzéssel.` }
  ];
  const answer = finalizeAnswer([
    `Ez az áttekintés ${N} EU-ország Bitcoin-adózását hasonlítja össze, ${asOfHu} állapot szerint.`,
    'Az adókulcsok, a mentességek és a bevallási tudnivalók a Virtuse Tax modulból származnak.',
    'Németország és Ausztria 1 év tartás után mentesíti a nyereséget, Csehország 3 éves időtesztet alkalmaz, Hollandia pedig a nyereség helyett a vélelmezett hozamot adóztatja (Box 3).',
    'Tájékoztató áttekintés 2026, nem adótanácsadás.'
  ], 'hu');
  pushPage({
    relFile, lang: 'hu',
    title: assertTitle(`Bitcoin-adózás ${N} EU-országban (2026)`),
    description: assertDescription(`Bitcoin-adókulcsok, tartási idő utáni mentességek és bevallás ${N} EU-országban, ${asOfHu} állapot szerint. Tájékoztató áttekintés.`),
    h1: `Bitcoin-adózás ${N} EU-országban`,
    answerHtml: esc(answer),
    breadcrumbs: [huHome(relFile), { name: 'Bitcoin-adózás', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'hu/bitcoin-adozas/magyarorszag/'), label: 'Bitcoin-adózás Magyarországon' },
      { href: toRoot(relFile, 'hu/bitcoin-orokles/'), label: 'Bitcoin és öröklés' },
      { href: toRoot(relFile, 'hu/bitcoin-dijindex/'), label: 'Bitcoin-díjindex' }
    ],
    moduleCta: { href: toRoot(relFile, 'hu/' + TAX_AGENT), label: 'Tax & Inheritance Agent megnyitása →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Minden országoldal bemutatja a nyereség adóját, az esetleges tartási idő utáni mentességet és a bevallást, ${esc(asOfHu)} állapot szerint. A Tax & Inheritance Agent modul ugyanezekkel az adatokkal dolgozik, és öröklési felkészültségi pontszámot is ad.</p>
<h2>Országok összehasonlítása</h2>
${tableHtml(['Ország', 'Nyereségadó', 'Mentesség'], rows)}
${faqHtml(faqs, 'Gyakori kérdések')}
`
  });
}

// HU country tax pages
for (const c of COUNTRIES) {
  const relFile = `hu/bitcoin-adozas/${slugHu(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxHu[c.id];
  const inN = inHu(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Mennyi a Bitcoin adója ${inN}?`, a: `${asOfHu} állapot szerint: ${t.gainTax}. Tájékoztató áttekintés 2026, nem adótanácsadás.` },
    { q: `Van ${inN} tartási idő utáni mentesség?`, a: `${t.exemption}. A bevallás előtt érdemes a tárgyévi szabályokat helyi adótanácsadóval egyeztetni.` },
    { q: `Hogyan kell ${inN} bevallani a Bitcoin-nyereséget?`, a: `${t.filing}. ${t.note}` },
    { q: 'A Virtuse kezeli a Bitcoinomat, vagy beadja helyettem a bevallást?', a: `Nem. A Virtuse soha nem kezeli az Ön kulcsait. A KYC és a regisztráció a partnernél történik. A Tax Agent összeveti a ${N} ország adatait; a bevallást képzett adótanácsadó készíti el.` }
  ];
  const answer = finalizeAnswer([
    `Bitcoin-adózás ${inN} (${asOfHu} állapot szerint): ${t.gainTax}.`,
    `Mentesség: ${t.exemption}.`,
    `Bevallás: ${t.filing}.`,
    t.note,
    'Tájékoztató áttekintés 2026, nem adótanácsadás.'
  ], 'hu');
  pushPage({
    relFile, lang: 'hu',
    title: assertTitle(`Bitcoin-adózás ${inN} (${asOfHu})`),
    description: assertDescription(descFit(`Bitcoin-adózás ${inN} (${asOfHu}): ${t.gainTax}.`, 'Nem adótanácsadás.')),
    h1: `Bitcoin-adózás ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      huHome(relFile),
      { name: 'Bitcoin-adózás', href: toRoot(relFile, 'hu/bitcoin-adozas/'), abs: abs('hu/bitcoin-adozas/index.html') },
      { name: nameHu(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'hu/bitcoin-eladas-vagy-hitel/'), label: 'Bitcoin: eladás vagy hitel' },
      { href: toRoot(relFile, 'hu/bitcoin-orokles/'), label: 'Bitcoin és öröklés' },
      { href: toRoot(relFile, nbs[0] ? `hu/bitcoin-adozas/${slugHu(nbs[0].id)}/` : 'hu/bitcoin-adozas/'), label: nbs[0] ? `Bitcoin-adózás ${inHu(nbs[0].id)}` : 'Minden ország' }
    ],
    moduleCta: { href: toRoot(relFile, `hu/${TAX_AGENT}?country=${c.id}`), label: `${nameHu(c.id)} ellenőrzése a Tax Agentben →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Adatok ${esc(asOfHu)} állapot szerint, a Virtuse Tax modulból.</p>
<h2>Adókulcsok és bevallás</h2>
${tableHtml(['Adat', asOfHu + ' állapot'], [
  ['Nyereségadó', esc(t.gainTax)],
  ['Mentesség', esc(t.exemption)],
  ['Bevallás', esc(t.filing)],
  ['Megjegyzés', esc(t.note)]
])}
<h2>Mikor keletkezik általában adó?</h2>
<p>${esc(t.note)} Ebben az áttekintésben a Bitcoin vásárlása nem számít elidegenítésnek; fizetés, csere, ajándékozás vagy kölcsönadás előtt érdemes ellenőrizni a helyi szabályokat.</p>
<h2>Szomszédos országok</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `hu/bitcoin-adozas/${slugHu(n.id)}/`))}">Bitcoin-adózás ${esc(inHu(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Gyakori kérdések')}
`
  });
}

// HU DCA calculator
{
  const relFile = 'hu/bitcoin-dca-kalkulator/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Előre jelzi a kalkulátor a Bitcoin árfolyamát?', a: 'Nem. Csak a partnerek díjait hasonlítja össze a közzétett díjtáblázat alapján. A Bitcoin árfolyamából származó hozamot nem modellezi.' },
    { q: `Mi az alapterv, ${feeAsOfHu} állapot szerint?`, a: 'Egyszer 500 €, majd havi 100 € 12 hónapon át. A sorrend az első év díjai alapján.' },
    { q: 'Melyik út a legolcsóbb ebben a tervben?', a: `${win.partner} (${methodHu(win.method)}), ${formatPctPl(win.pct)} változó díjjal a Stacking Strategist képlete szerint.` },
    { q: 'Befektetési tanácsadásnak számít ez?', a: 'Nem. Kizárólag oktatási célt szolgál. A KYC a partnernél történik. A Virtuse soha nem kezeli az Ön kulcsait.' }
  ];
  const answer = finalizeAnswer([
    `${feeAsOfHu} állapot szerint a csak díjakkal számoló DCA-példában (500 €, majd havi 100 € 12 hónapon át) ${win.partner} áll az első helyen.`,
    `Változó díj: ${formatPctPl(win.pct)}. Ez nem árfolyam-előrejelzés.`,
    'A díjak a Stacking Strategist modul díjtáblázatából származnak, ugyanazzal a képlettel számolva. Tájékoztató áttekintés 2026.'
  ], 'hu', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'hu',
    title: assertTitle('Bitcoin DCA-kalkulátor (EU-díjak 2026)'),
    description: assertDescription(`Csak a díjakkal számoló Bitcoin DCA-kalkulátor, ${feeAsOfHu} állapot szerint. Alapeset 500 € + havi 100 €, a legolcsóbb út: ${win.partner}.`),
    h1: 'Bitcoin DCA-kalkulátor',
    answerHtml: esc(answer),
    breadcrumbs: [huHome(relFile), { name: 'DCA-kalkulátor', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'hu/bitcoin-dijindex/'), label: 'Bitcoin-díjindex' },
      { href: toRoot(relFile, 'hu/bitcoin-eladas-vagy-hitel/'), label: 'Bitcoin: eladás vagy hitel' },
      { href: toRoot(relFile, 'hu/bitcoin-adozas/magyarorszag/'), label: 'Bitcoin-adózás Magyarországon' }
    ],
    moduleCta: { href: toRoot(relFile, 'hu/stacking.html'), label: 'Stacking Strategist megnyitása →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin DCA-kalkulátor',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Alappélda: 500 €, majd havi 100 € × 12. Ugyanaz a képlet, mint a Stacking Strategist modulban.</p>
<h2>Sorrend havi 100 € esetén</h2>
${tableHtml(['Helyezés', 'Partner', 'Módszer', 'Változó díj', 'Éves díjak'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodHu(r.method)), esc(formatPctPl(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Gyakori kérdések')}
`
  });
}

// HU sell vs borrow
{
  const relFile = 'hu/bitcoin-eladas-vagy-hitel/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Keletkezik adó eladáskor ebben a ${N} országban?`, a: `Általában igen, eladáskor vagy cserekor. A mentességek eltérnek: Németország 0% 1 év tartás után, Csehország 3 éves időteszt, Lengyelország mentesség nélkül. ${asOfHu} állapot szerint. Nem adótanácsadás.` },
    { q: 'Ugyanolyan adóesemény a hitel, mint az eladás?', a: 'Ebben az áttekintésben nem. A kamat, a likvidálási kockázat és a partnernél végzett KYC azonban megmarad. A konkrét számokat a Loan & Liquidity Copilot számolja ki.' },
    { q: 'Mi a likvidálási kockázat?', a: 'Ha a fedezet értéke a partner küszöbére esik, a partner eladhatja a fedezetet, és abból törleszti a hitelt. A Virtuse soha nem kezeli az Ön kulcsait és a fedezetet sem.' },
    { q: 'Hol számolhatok konkrét összeggel?', a: 'A Loan & Liquidity Copilot modulban. Ez az oldal csak az adó és a kockázat közti különbséget mutatja be a közzétett adókulcsok alapján.' }
  ];
  const answer = finalizeAnswer([
    `${asOfHu} állapot szerint a Bitcoin eladása adót keletkeztethet (például Németországban 1 éves tartási időn belül legfeljebb 45%, Romániában egykulcsos 10%).`,
    'A Bitcoin-fedezetű hitellel megmarad a piaci pozíció, de kamattal és likvidálási kockázattal jár a partnernél.',
    'Tájékoztató áttekintés 2026, nem adó- és hiteltanácsadás. A Virtuse soha nem kezeli az Ön kulcsait.'
  ], 'hu');
  pushPage({
    relFile, lang: 'hu',
    title: assertTitle('Bitcoin: eladás vagy hitel? (2026)'),
    description: assertDescription(`Eladni a Bitcoint és adózni, vagy Bitcoin-fedezetű hitelt felvenni és befektetve maradni? ${N} EU-ország adókulcsai, ${asOfHu} állapot szerint.`),
    h1: 'Eladja a Bitcoint, vagy vesz fel rá hitelt?',
    answerHtml: esc(answer),
    breadcrumbs: [huHome(relFile), { name: 'Eladás vagy hitel', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'hu/bitcoin-adozas/magyarorszag/'), label: 'Bitcoin-adózás Magyarországon' },
      { href: toRoot(relFile, 'hu/bitcoin-dca-kalkulator/'), label: 'DCA-kalkulátor' },
      { href: toRoot(relFile, 'hu/bitcoin-orokles/'), label: 'Bitcoin és öröklés' }
    ],
    moduleCta: { href: toRoot(relFile, 'hu/loan.html'), label: 'Összehasonlítás a Loan Copilotban →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: eladás vagy hitel',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Adó eladáskor</h2>
${tableHtml(['Ország', 'Nyereségadó', 'Mentesség'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `hu/bitcoin-adozas/${slugHu(c.id)}/`))}">${esc(nameHu(c.id))}</a>`,
  esc(meta.taxHu[c.id].gainTax),
  esc(meta.taxHu[c.id].exemption)
]))}
<h2>Kockázat hitel esetén</h2>
<p>Bitcoin-fedezetű hitelt szabályozott partnerek nyújtanak, nem a Virtuse. Az árfolyam-kitettség megmarad, kamatot kell fizetni, és a fedezet likvidálható. A Virtuse soha nem kezeli a fedezetet.</p>
${faqHtml(faqs, 'Gyakori kérdések')}
`
  });
}

// HU inheritance
{
  const relFile = 'hu/bitcoin-orokles/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Szerepelhet a helyreállítási kifejezés az utasítólevélben?', a: 'Nem. A levél leltárt, helyszíneket és kapcsolattartókat tartalmaz, helyreállítási kifejezést soha. A végrendelettel együtt vagy ügyvédnél érdemes tárolni.' },
    { q: 'Miért 2 a 3-ból multisig?', a: 'Egyetlen helyreállítási kifejezés egyetlen hibapont, Önnek és az örökösöknek is.' },
    { q: 'Kezel a Virtuse kulcsokat az örökösök számára?', a: 'Nem. A Virtuse soha nem kezeli az Ön kulcsait.' },
    { q: 'Jogi tanácsadásnak számít ez?', a: `Nem. Oktatási célú ellenőrzőlista a Tax modulból, ${asOfHu} állapot szerint.` }
  ];
  const answer = finalizeAnswer([
    `${asOfHu} állapot szerint a Tax modul ellenőrzőlistája hat pontból áll: utasítólevél, a kulcsok földrajzi szétválasztása, tájékoztatott örökös, 2 a 3-ból multisig, helyreállítási próba és dokumentált fiókok.`,
    'Egyetlen helyreállítási kifejezés egyetlen hibapont. A Virtuse soha nem kezeli az Ön kulcsait.',
    'Nem jogi tanácsadás.'
  ], 'hu');
  const howto = {
    '@type': 'HowTo',
    name: 'A Bitcoin felkészítése az öröklésre',
    inLanguage: 'hu',
    step: meta.inheritanceHu.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'hu',
    title: assertTitle('Bitcoin és öröklés: ellenőrzőlista (2026)'),
    description: assertDescription(`Hatpontos ellenőrzőlista a Bitcoin örökléséhez, ${asOfHu} állapot szerint: utasítólevél, kulcsok szétválasztása, 2 a 3-ból multisig. Nem jogi tanácsadás.`),
    h1: 'Bitcoin öröklése: ellenőrzőlista',
    answerHtml: esc(answer),
    breadcrumbs: [huHome(relFile), { name: 'Öröklés', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'hu/bitcoin-adozas/magyarorszag/'), label: 'Bitcoin-adózás Magyarországon' },
      { href: toRoot(relFile, 'hu/bitcoin-adozas/'), label: `Adózás ${N} EU-országban` },
      { href: toRoot(relFile, 'hu/bitcoin-eladas-vagy-hitel/'), label: 'Bitcoin: eladás vagy hitel' }
    ],
    moduleCta: { href: toRoot(relFile, 'hu/' + TAX_AGENT), label: 'A lista értékelése a Tax Agentben →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>A tartalom a Tax modul ellenőrzőlistáját követi. Nem jogi tanácsadás.</p>
<h2>Útmutató: hat lépés</h2>
<ol>${meta.inheritanceHu.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Gyakori kérdések')}
`
  });
}

// HU fee index
{
  const relFile = 'hu/bitcoin-dijindex/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'hu');
  const faqs = [
    { q: 'Mit mér a díjindex?', a: `A vásárlási utak éves díjait ${feeAsOfHu} állapot szerint, a Stacking Strategist modul képletével.` },
    { q: 'Ki a legolcsóbb havi 100 € esetén?', a: `${winner.partner}: ${formatPctPl(winner.pct)}, éves díj ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Benne vannak a spreadek?', a: 'Nem. Csak a százalékos díj és az esetleges havi előfizetés a díjtáblázat szerint. Az árfolyamkülönbségek és a Bitcoin-hálózat díjai (miner fees) nincsenek benne.' },
    { q: 'Idézhetem a táblázatot?', a: `Igen, a forrás megjelölésével („Forrás: Virtuse Bitcoin-díjindex, ${feeAsOfHu} állapot”) és hivatkozással.` }
  ];
  const answer = finalizeAnswer([
    `A Virtuse Bitcoin-díjindexe ${feeAsOfHu} állapot szerint az EU-s vásárlási utakat az éves díjak alapján rangsorolja.`,
    `Havi 100 € esetén ${winner.partner} (${methodHu(winner.method)}) vezet ${formatPctPl(winner.pct)} díjjal, évi ${formatEurSk(winner.annualDrag)} költséggel.`,
    beText,
    'Ez nem ajánlat. A Virtuse soha nem kezeli az Ön kulcsait.'
  ], 'hu', 'fee');
  pushPage({
    relFile, lang: 'hu',
    title: assertTitle('Bitcoin-díjindex (EU) Q4 2026'),
    description: assertDescription(`EU-s vásárlási utak díjak szerint, ${feeAsOfHu} állapot szerint. A legolcsóbb út havi 100 € esetén: ${winner.partner}, ${formatPctPl(winner.pct)}.`),
    h1: 'Bitcoin-díjindex',
    answerHtml: esc(answer),
    breadcrumbs: [huHome(relFile), { name: 'Díjindex', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'hu/bitcoin-dca-kalkulator/'), label: 'DCA-kalkulátor' },
      { href: toRoot(relFile, 'hu/bitcoin-adozas/magyarorszag/'), label: 'Bitcoin-adózás Magyarországon' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Módszertan (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'hu/stacking.html'), label: 'Stacking Strategist megnyitása →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Virtuse Bitcoin-díjindex',
        inLanguage: 'hu',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Virtuse Bitcoin-díjindex',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Rangsor havi befizetés szerint</h2>
${tables}
<h2>Automatizált vagy manuális?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Gyakori kérdések')}
`
  });
}

// ---------- Ukrainian (uk/) ----------
function ukHome(relFile) { return { name: 'Головна', href: toRoot(relFile, 'uk/index.html'), abs: abs('uk/index.html') }; }

// UK tax hub
{
  const relFile = 'uk/bitcoin-podatky/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `uk/bitcoin-podatky/${slugUk(c.id)}/`))}">${esc(nameUk(c.id))}</a>`,
    esc(meta.taxUk[c.id].gainTax),
    esc(meta.taxUk[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Які країни охоплює цей огляд?', a: `${N} країн ЄС: ${COUNTRIES.map((c) => nameUk(c.id)).join(', ')}. Станом на ${asOfUk}, дані з модуля Virtuse Tax.` },
    { q: 'Це податкова консультація?', a: 'Ні. Довідковий огляд 2026, не є податковою консультацією. Правила поточного року уточніть у місцевого консультанта.' },
    { q: 'Чи повідомляє Virtuse про мої активи податковій службі?', a: 'Ні. Virtuse ніколи не зберігає ваші ключі чи історію транзакцій. KYC проводять самі партнери.' },
    { q: 'Де, крім податків, перевірити й спадкування?', a: `У модулі Tax & Inheritance Agent, з тими самими ${N} країнами та перевіркою готовності до мультипідпису.` }
  ];
  const answer = finalizeAnswer([
    `Цей огляд порівнює оподаткування Біткоїна в ${N} країнах ЄС станом на ${asOfUk}.`,
    'Ставки, звільнення і примітки щодо декларування взято з модуля Virtuse Tax.',
    'Німеччина та Австрія звільняють прибуток після 1 року володіння, Чехія застосовує 3-річний тест часу, а Нідерланди замість податку на прибуток оподатковують умовний дохід (Box 3).',
    'Довідковий огляд 2026, не є податковою консультацією.'
  ], 'uk');
  pushPage({
    relFile, lang: 'uk',
    title: assertTitle(`Податки на Біткоїн у ${N} країнах ЄС (2026)`),
    description: assertDescription(`Ставки податку на Біткоїн, звільнення за строк володіння і декларування в ${N} країнах ЄС станом на ${asOfUk}. Довідковий огляд.`),
    h1: `Податки на Біткоїн у ${N} країнах ЄС`,
    answerHtml: esc(answer),
    breadcrumbs: [ukHome(relFile), { name: 'Податки на Біткоїн', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'uk/bitcoin-podatky/polshcha/'), label: 'Податки на Біткоїн у Польщі' },
      { href: toRoot(relFile, 'uk/bitcoin-spadshchyna/'), label: 'Біткоїн і спадкування' },
      { href: toRoot(relFile, 'uk/bitcoin-indeks-komisii/'), label: 'Індекс комісій за Біткоїн' }
    ],
    moduleCta: { href: toRoot(relFile, 'uk/' + TAX_AGENT), label: 'Відкрити Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Кожна сторінка країни показує податок на прибуток, можливе звільнення за строк володіння і порядок декларування станом на ${esc(asOfUk)}. Модуль Tax & Inheritance Agent використовує ті самі дані й додає оцінку готовності до спадкування.</p>
<h2>Порівняння країн</h2>
${tableHtml(['Країна', 'Податок на прибуток', 'Звільнення'], rows)}
${faqHtml(faqs, 'Часті запитання')}
`
  });
}

// UK country tax pages
for (const c of COUNTRIES) {
  const relFile = `uk/bitcoin-podatky/${slugUk(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxUk[c.id];
  const inN = inUk(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Який податок на Біткоїн ${inN}?`, a: `Станом на ${asOfUk}: ${t.gainTax}. Довідковий огляд 2026, не є податковою консультацією.` },
    { q: `Чи є ${inN} звільнення за строк володіння?`, a: `${t.exemption}. Перед поданням декларації уточніть правила поточного року в місцевого податкового консультанта.` },
    { q: `Як ${inN} декларують прибуток від Біткоїна?`, a: `${t.filing}. ${t.note}` },
    { q: 'Чи зберігає Virtuse мій Біткоїн або подає за мене декларацію?', a: `Ні. Virtuse ніколи не зберігає ваші ключі. KYC і реєстрація відбуваються в партнера. Tax Agent порівняє огляд ${N} країн; декларацію підготує кваліфікований податковий консультант.` }
  ];
  const answer = finalizeAnswer([
    `Податки на Біткоїн ${inN} станом на ${asOfUk}: ${t.gainTax}.`,
    `Звільнення: ${t.exemption}.`,
    `Декларування: ${t.filing}.`,
    t.note,
    'Довідковий огляд 2026, не є податковою консультацією.'
  ], 'uk');
  pushPage({
    relFile, lang: 'uk',
    title: assertTitle(`Податки на Біткоїн ${inN} (${asOfUk})`),
    description: assertDescription(descFit(`Податки на Біткоїн ${inN} (${asOfUk}): ${t.gainTax}.`, 'Не є податковою консультацією.')),
    h1: `Податки на Біткоїн ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      ukHome(relFile),
      { name: 'Податки на Біткоїн', href: toRoot(relFile, 'uk/bitcoin-podatky/'), abs: abs('uk/bitcoin-podatky/index.html') },
      { name: nameUk(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'uk/bitcoin-prodaty-chy-pozychyty/'), label: 'Біткоїн: продати чи позичити' },
      { href: toRoot(relFile, 'uk/bitcoin-spadshchyna/'), label: 'Біткоїн і спадкування' },
      { href: toRoot(relFile, nbs[0] ? `uk/bitcoin-podatky/${slugUk(nbs[0].id)}/` : 'uk/bitcoin-podatky/'), label: nbs[0] ? `Податки на Біткоїн ${inUk(nbs[0].id)}` : 'Усі країни' }
    ],
    moduleCta: { href: toRoot(relFile, `uk/${TAX_AGENT}?country=${c.id}`), label: `Перевірити ${accUk(c.id)} у Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Дані станом на ${esc(asOfUk)}, взято з модуля Virtuse Tax.</p>
<h2>Ставки й декларування</h2>
${tableHtml(['Поле', 'Станом на ' + asOfUk], [
  ['Податок на прибуток', esc(t.gainTax)],
  ['Звільнення', esc(t.exemption)],
  ['Декларування', esc(t.filing)],
  ['Примітка', esc(t.note)]
])}
<h2>Коли зазвичай виникає податок?</h2>
<p>${esc(t.note)} Купівля Біткоїна в цьому огляді не вважається відчуженням; перед оплатою, обміном, даруванням чи позикою монет перевірте місцеві правила.</p>
<h2>Сусідні країни</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `uk/bitcoin-podatky/${slugUk(n.id)}/`))}">Податки на Біткоїн ${esc(inUk(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Часті запитання')}
`
  });
}

// UK DCA calculator
{
  const relFile = 'uk/bitcoin-kalkuliator-dca/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Чи прогнозує цей калькулятор ціну Біткоїна?', a: 'Ні. Він порівнює лише комісії партнерів за опублікованою тарифною таблицею. Дохідність від ціни Біткоїна не моделюється.' },
    { q: `Який стандартний план станом на ${feeAsOfUk}?`, a: 'Одноразово 500 €, потім 100 € на місяць протягом 12 місяців. Порядок за комісіями першого року.' },
    { q: 'Який шлях у цьому плані найдешевший?', a: `${win.partner} (${methodUk(win.method)}) зі змінною комісією ${formatPctPl(win.pct)} за формулою Stacking Strategist.` },
    { q: 'Це інвестиційна консультація?', a: 'Ні. Лише для освітніх цілей. KYC відбувається в партнера. Virtuse ніколи не зберігає ваші ключі.' }
  ];
  const answer = finalizeAnswer([
    `Станом на ${feeAsOfUk} у DCA-прикладі лише з комісіями (500 €, потім 100 € на місяць протягом 12 місяців) перше місце посідає ${win.partner}.`,
    `Змінна комісія: ${formatPctPl(win.pct)}. Це не прогноз ціни.`,
    'Комісії взято з тарифної таблиці модуля Stacking Strategist і пораховано за тією самою формулою. Довідковий огляд 2026.'
  ], 'uk', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'uk',
    title: assertTitle('DCA-калькулятор для Біткоїна (комісії ЄС 2026)'),
    description: assertDescription(`DCA-калькулятор для Біткоїна лише з урахуванням комісій, станом на ${feeAsOfUk}. Стандарт 500 € + 100 € на місяць, найдешевший шлях: ${win.partner}.`),
    h1: 'DCA-калькулятор для Біткоїна',
    answerHtml: esc(answer),
    breadcrumbs: [ukHome(relFile), { name: 'DCA-калькулятор', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'uk/bitcoin-indeks-komisii/'), label: 'Індекс комісій за Біткоїн' },
      { href: toRoot(relFile, 'uk/bitcoin-prodaty-chy-pozychyty/'), label: 'Біткоїн: продати чи позичити' },
      { href: toRoot(relFile, 'uk/bitcoin-podatky/polshcha/'), label: 'Податки на Біткоїн у Польщі' }
    ],
    moduleCta: { href: toRoot(relFile, 'uk/stacking.html'), label: 'Відкрити Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'DCA-калькулятор для Біткоїна',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Стандартний приклад: 500 €, потім 100 € на місяць × 12. Та сама формула, що й у модулі Stacking Strategist.</p>
<h2>Рейтинг при 100 € на місяць</h2>
${tableHtml(['Місце', 'Партнер', 'Метод', 'Змінна комісія', 'Річні комісії'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodUk(r.method)), esc(formatPctPl(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Часті запитання')}
`
  });
}

// UK sell vs borrow
{
  const relFile = 'uk/bitcoin-prodaty-chy-pozychyty/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Чи виникає податок при продажу в цих ${N} країнах?`, a: `Зазвичай так, при продажу або обміні. Звільнення різняться: Німеччина 0% після 1 року володіння, Чехія 3-річний тест часу, Польща без звільнення. Станом на ${asOfUk}. Не є податковою консультацією.` },
    { q: 'Чи є позика такою самою податковою подією, як продаж?', a: 'У цьому огляді ні. Відсотки, ризик ліквідації та KYC у партнера все одно залишаються. Конкретні цифри розрахує Loan & Liquidity Copilot.' },
    { q: 'Що таке ризик ліквідації?', a: 'Якщо вартість застави впаде до порогу партнера, партнер може продати заставу й погасити нею позику. Virtuse ніколи не зберігає ваші ключі чи заставу.' },
    { q: 'Де розрахувати конкретну суму?', a: 'У модулі Loan & Liquidity Copilot. Ця сторінка пояснює лише різницю між податком і ризиком на основі опублікованих податкових ставок.' }
  ];
  const answer = finalizeAnswer([
    `Станом на ${asOfUk} продаж Біткоїна може спричинити податок (наприклад, у Німеччині до 45% протягом 1 року володіння, у Румунії фіксовані 10%).`,
    'Позика під заставу Біткоїна зберігає ринкову позицію, але додає відсотки та ризик ліквідації в партнера.',
    'Довідковий огляд 2026, не є податковою чи кредитною консультацією. Virtuse ніколи не зберігає ваші ключі.'
  ], 'uk');
  pushPage({
    relFile, lang: 'uk',
    title: assertTitle('Біткоїн: продати чи позичити? (2026)'),
    description: assertDescription(`Продати Біткоїн і сплатити податок чи взяти позику під його заставу й залишитися інвестованим? Ставки ${N} країн ЄС станом на ${asOfUk}.`),
    h1: 'Продати Біткоїн чи взяти позику під його заставу?',
    answerHtml: esc(answer),
    breadcrumbs: [ukHome(relFile), { name: 'Продати чи позичити', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'uk/bitcoin-podatky/polshcha/'), label: 'Податки на Біткоїн у Польщі' },
      { href: toRoot(relFile, 'uk/bitcoin-kalkuliator-dca/'), label: 'DCA-калькулятор' },
      { href: toRoot(relFile, 'uk/bitcoin-spadshchyna/'), label: 'Біткоїн і спадкування' }
    ],
    moduleCta: { href: toRoot(relFile, 'uk/loan.html'), label: 'Порівняти в Loan Copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Біткоїн: продати чи позичити',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Податок при продажу</h2>
${tableHtml(['Країна', 'Податок на прибуток', 'Звільнення'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `uk/bitcoin-podatky/${slugUk(c.id)}/`))}">${esc(nameUk(c.id))}</a>`,
  esc(meta.taxUk[c.id].gainTax),
  esc(meta.taxUk[c.id].exemption)
]))}
<h2>Ризик при позиці</h2>
<p>Позики під заставу Біткоїна надають регульовані партнери, а не Virtuse. Ви зберігаєте цінову експозицію, сплачуєте відсотки, а заставу можуть ліквідувати. Virtuse ніколи не зберігає заставу.</p>
${faqHtml(faqs, 'Часті запитання')}
`
  });
}

// UK inheritance
{
  const relFile = 'uk/bitcoin-spadshchyna/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Чи може в листі з інструкціями бути сід-фраза?', a: 'Ні. Лист містить перелік, місця та контакти, але ніколи не сід-фрази. Зберігайте його разом із заповітом або в юриста.' },
    { q: 'Чому мультипідпис 2 з 3?', a: 'Одна сід-фраза — це єдина точка відмови, для вас і для ваших спадкоємців.' },
    { q: 'Чи зберігає Virtuse ключі для спадкоємців?', a: 'Ні. Virtuse ніколи не зберігає ваші ключі.' },
    { q: 'Це юридична консультація?', a: `Ні. Це чекліст для освітніх цілей із модуля Tax станом на ${asOfUk}.` }
  ];
  const answer = finalizeAnswer([
    `Станом на ${asOfUk} чекліст модуля Tax має шість пунктів: лист з інструкціями, географічний розподіл ключів, поінформований спадкоємець, мультипідпис 2 з 3, перевірка відновлення і задокументовані рахунки.`,
    'Одна сід-фраза — це єдина точка відмови. Virtuse ніколи не зберігає ваші ключі.',
    'Не є юридичною консультацією.'
  ], 'uk');
  const howto = {
    '@type': 'HowTo',
    name: 'Підготовка Біткоїна до спадкування',
    inLanguage: 'uk',
    step: meta.inheritanceUk.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'uk',
    title: assertTitle('Біткоїн і спадкування: чекліст (2026)'),
    description: assertDescription(`Чекліст із шести пунктів для спадкування Біткоїна станом на ${asOfUk}: лист з інструкціями, розподіл ключів, мультипідпис 2 з 3. Не юридична консультація.`),
    h1: 'Спадкування Біткоїна: чекліст',
    answerHtml: esc(answer),
    breadcrumbs: [ukHome(relFile), { name: 'Спадкування', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'uk/bitcoin-podatky/polshcha/'), label: 'Податки на Біткоїн у Польщі' },
      { href: toRoot(relFile, 'uk/bitcoin-podatky/'), label: `Податки в ${N} країнах ЄС` },
      { href: toRoot(relFile, 'uk/bitcoin-prodaty-chy-pozychyty/'), label: 'Біткоїн: продати чи позичити' }
    ],
    moduleCta: { href: toRoot(relFile, 'uk/' + TAX_AGENT), label: 'Оцінити чекліст у Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Зміст відповідає чеклісту модуля Tax. Не є юридичною консультацією.</p>
<h2>Інструкція: шість кроків</h2>
<ol>${meta.inheritanceUk.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Часті запитання')}
`
  });
}

// UK fee index
{
  const relFile = 'uk/bitcoin-indeks-komisii/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'uk');
  const faqs = [
    { q: 'Що вимірює індекс комісій?', a: `Річні комісії шляхів купівлі станом на ${feeAsOfUk} за формулою модуля Stacking Strategist.` },
    { q: 'Хто найдешевший при 100 € на місяць?', a: `${winner.partner}: ${formatPctPl(winner.pct)}, річні комісії ${formatEurSk(winner.annualDrag)}.` },
    { q: 'Чи враховано спреди?', a: 'Ні. Лише відсоткову комісію та можливу щомісячну підписку за тарифною таблицею. Курсові різниці й комісії мережі Біткоїн (miner fees) не враховано.' },
    { q: 'Чи можна цитувати таблицю?', a: `Так, із зазначенням джерела «Джерело: індекс комісій за Біткоїн від Virtuse, станом на ${feeAsOfUk}» і посиланням.` }
  ];
  const answer = finalizeAnswer([
    `Індекс комісій за Біткоїн від Virtuse станом на ${feeAsOfUk} ранжує шляхи купівлі в ЄС за річними комісіями.`,
    `При 100 € на місяць лідирує ${winner.partner} (${methodUk(winner.method)}) з комісією ${formatPctPl(winner.pct)}, ${formatEurSk(winner.annualDrag)} на рік.`,
    beText,
    'Це не пропозиція. Virtuse ніколи не зберігає ваші ключі.'
  ], 'uk', 'fee');
  pushPage({
    relFile, lang: 'uk',
    title: assertTitle('Індекс комісій за Біткоїн (ЄС) Q4 2026'),
    description: assertDescription(`Шляхи купівлі в ЄС за комісіями станом на ${feeAsOfUk}. Найдешевший шлях при 100 € на місяць: ${winner.partner}, ${formatPctPl(winner.pct)}.`),
    h1: 'Індекс комісій за Біткоїн',
    answerHtml: esc(answer),
    breadcrumbs: [ukHome(relFile), { name: 'Індекс комісій', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'uk/bitcoin-kalkuliator-dca/'), label: 'DCA-калькулятор' },
      { href: toRoot(relFile, 'uk/bitcoin-podatky/polshcha/'), label: 'Податки на Біткоїн у Польщі' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Методологія (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'uk/stacking.html'), label: 'Відкрити Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Індекс комісій за Біткоїн від Virtuse',
        inLanguage: 'uk',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Індекс комісій за Біткоїн від Virtuse',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Рейтинг за щомісячним внеском</h2>
${tables}
<h2>Автоматично чи вручну?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Часті запитання')}
`
  });
}

// ---------- Russian (ru/) ----------
// Russian: lowercase a data value's first letter after a colon (keeps KESt, PIT-38, IRPF).
function lcRu(s) { return /^[А-ЯЁ][а-яё]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
function ruHome(relFile) { return { name: 'Главная', href: toRoot(relFile, 'ru/index.html'), abs: abs('ru/index.html') }; }

// RU tax hub
{
  const relFile = 'ru/bitcoin-nalogi/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `ru/bitcoin-nalogi/${slugRu(c.id)}/`))}">${esc(nameRu(c.id))}</a>`,
    esc(meta.taxRu[c.id].gainTax),
    esc(meta.taxRu[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Какие страны охватывает этот обзор?', a: `Обзор охватывает ${N} стран ЕС: ${COUNTRIES.map((c) => nameRu(c.id)).join(', ')}. По состоянию на ${asOfRu}, данные из модуля Virtuse Tax.` },
    { q: 'Это налоговая консультация?', a: 'Нет. Справочный обзор 2026, не является налоговой консультацией. Правила текущего года уточните у местного консультанта.' },
    { q: 'Сообщает ли Virtuse о моих активах в налоговую службу?', a: 'Нет. Virtuse никогда не хранит ваши ключи и историю транзакций. KYC проводят сами партнёры.' },
    { q: 'Где проверить готовность к наследованию?', a: `В модуле Tax & Inheritance Agent, с теми же ${N} странами и проверкой готовности к мультиподписи.` }
  ];
  const answer = finalizeAnswer([
    `Этот обзор сравнивает налогообложение Биткоина в ${N} странах ЕС по состоянию на ${asOfRu}.`,
    'Ставки, освобождения и примечания по декларированию взяты из модуля Virtuse Tax.',
    'Германия и Австрия освобождают прибыль после 1 года владения, Чехия применяет 3-летний тест времени, а Нидерланды вместо налога на прибыль облагают условный доход (Box 3).',
    'Справочный обзор 2026, не является налоговой консультацией.'
  ], 'ru');
  pushPage({
    relFile, lang: 'ru',
    title: assertTitle(`Налоги на Биткоин в ${N} странах ЕС (2026)`),
    description: assertDescription(`Ставки налога на Биткоин, освобождения по сроку владения и декларирование в ${N} странах ЕС по состоянию на ${asOfRu}. Справочный обзор.`),
    h1: `Налоги на Биткоин в ${N} странах ЕС`,
    answerHtml: esc(answer),
    breadcrumbs: [ruHome(relFile), { name: 'Налоги на Биткоин', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'ru/bitcoin-nalogi/germaniya/'), label: 'Налоги на Биткоин в Германии' },
      { href: toRoot(relFile, 'ru/bitcoin-nasledstvo/'), label: 'Биткоин и наследство' },
      { href: toRoot(relFile, 'ru/bitcoin-indeks-komissiy/'), label: 'Индекс комиссий за Биткоин' }
    ],
    moduleCta: { href: toRoot(relFile, 'ru/' + TAX_AGENT), label: 'Открыть Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Каждая страница страны показывает налог на прибыль, возможное освобождение по сроку владения и порядок декларирования по состоянию на ${esc(asOfRu)}. Модуль Tax & Inheritance Agent использует те же данные и добавляет оценку готовности к наследованию.</p>
<h2>Сравнение стран</h2>
${tableHtml(['Страна', 'Налог на прибыль', 'Освобождение'], rows)}
${faqHtml(faqs, 'Частые вопросы')}
`
  });
}

// RU country tax pages
for (const c of COUNTRIES) {
  const relFile = `ru/bitcoin-nalogi/${slugRu(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxRu[c.id];
  const inN = inRu(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Какой налог на Биткоин ${inN}?`, a: `По состоянию на ${asOfRu}: ${lcRu(t.gainTax)}. Справочный обзор 2026, не является налоговой консультацией.` },
    { q: `Есть ли ${inN} освобождение по сроку владения?`, a: `${t.exemption}. Перед подачей декларации уточните правила текущего года у местного налогового консультанта.` },
    { q: `Как ${inN} декларируют прибыль от Биткоина?`, a: `${t.filing}. ${t.note}` },
    { q: 'Хранит ли Virtuse мой Биткоин или подаёт за меня декларацию?', a: `Нет. Virtuse никогда не хранит ваши ключи. KYC и регистрация проходят у партнёра. Tax Agent покажет обзор ${N} стран; декларацию подготовит квалифицированный налоговый консультант.` }
  ];
  const answer = finalizeAnswer([
    `Налоги на Биткоин ${inN} по состоянию на ${asOfRu}: ${lcRu(t.gainTax)}.`,
    /^Без /.test(t.exemption) ? `${t.exemption}.` : `Освобождение: ${lcRu(t.exemption)}.`,
    `Порядок подачи: ${lcRu(t.filing)}.`,
    t.note,
    'Справочный обзор 2026, не является налоговой консультацией.'
  ], 'ru');
  pushPage({
    relFile, lang: 'ru',
    title: assertTitle(`Налоги на Биткоин ${inN} (${asOfRu})`),
    description: assertDescription(descFit(`Налоги на Биткоин ${inN} (${asOfRu}): ${lcRu(t.gainTax)}.`, 'Не является налоговой консультацией.')),
    h1: `Налоги на Биткоин ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      ruHome(relFile),
      { name: 'Налоги на Биткоин', href: toRoot(relFile, 'ru/bitcoin-nalogi/'), abs: abs('ru/bitcoin-nalogi/index.html') },
      { name: nameRu(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'ru/bitcoin-prodat-ili-zanyat/'), label: 'Биткоин: продать или занять' },
      { href: toRoot(relFile, 'ru/bitcoin-nasledstvo/'), label: 'Биткоин и наследство' },
      { href: toRoot(relFile, nbs[0] ? `ru/bitcoin-nalogi/${slugRu(nbs[0].id)}/` : 'ru/bitcoin-nalogi/'), label: nbs[0] ? `Налоги на Биткоин ${inRu(nbs[0].id)}` : 'Все страны' }
    ],
    moduleCta: { href: toRoot(relFile, `ru/${TAX_AGENT}?country=${c.id}`), label: `Проверить ${accRu(c.id)} в Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Данные по состоянию на ${esc(asOfRu)}, взяты из модуля Virtuse Tax.</p>
<h2>Ставки и декларирование</h2>
${tableHtml(['Поле', 'По состоянию на ' + asOfRu], [
  ['Налог на прибыль', esc(t.gainTax)],
  ['Освобождение', esc(t.exemption)],
  ['Декларирование', esc(t.filing)],
  ['Примечание', esc(t.note)]
])}
<h2>Когда обычно возникает налог?</h2>
<p>${esc(t.note)} Покупка Биткоина в этом обзоре не считается отчуждением; перед оплатой, обменом, дарением или займом монет проверьте местные правила.</p>
<h2>Соседние страны</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `ru/bitcoin-nalogi/${slugRu(n.id)}/`))}">Налоги на Биткоин ${esc(inRu(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Частые вопросы')}
`
  });
}

// RU DCA calculator
{
  const relFile = 'ru/bitcoin-kalkulyator-dca/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Прогнозирует ли этот калькулятор цену Биткоина?', a: 'Нет. Он сравнивает только комиссии партнёров по опубликованной тарифной таблице. Доходность от цены Биткоина не моделируется.' },
    { q: 'Какой типовой план используется?', a: `Единоразово 500 €, затем 100 € в месяц в течение 12 месяцев, по состоянию на ${feeAsOfRu}. Рейтинг составлен по комиссиям первого года.` },
    { q: 'Какой способ в этом плане самый дешёвый?', a: `${win.partner} (${methodRu(win.method)}) с переменной комиссией ${formatPctPl(win.pct)} по формуле Stacking Strategist.` },
    { q: 'Это инвестиционная консультация?', a: 'Нет. Только для образовательных целей. KYC проходит у партнёра. Virtuse никогда не хранит ваши ключи.' }
  ];
  const answer = finalizeAnswer([
    `По состоянию на ${feeAsOfRu} в DCA-примере с учётом только комиссий (500 €, затем 100 € в месяц в течение 12 месяцев) первое место занимает ${win.partner}.`,
    `Переменная комиссия: ${formatPctPl(win.pct)}. Это не прогноз цены.`,
    'Комиссии взяты из тарифной таблицы модуля Stacking Strategist и рассчитаны по той же формуле. Справочный обзор 2026.'
  ], 'ru', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'ru',
    title: assertTitle('DCA-калькулятор для Биткоина (комиссии ЕС 2026)'),
    description: assertDescription(`DCA-калькулятор для Биткоина только с учётом комиссий, по состоянию на ${feeAsOfRu}. Типовой план: 500 € + 100 € в месяц; самый дешёвый способ — ${win.partner}.`),
    h1: 'DCA-калькулятор для Биткоина',
    answerHtml: esc(answer),
    breadcrumbs: [ruHome(relFile), { name: 'DCA-калькулятор', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'ru/bitcoin-indeks-komissiy/'), label: 'Индекс комиссий за Биткоин' },
      { href: toRoot(relFile, 'ru/bitcoin-prodat-ili-zanyat/'), label: 'Биткоин: продать или занять' },
      { href: toRoot(relFile, 'ru/bitcoin-nalogi/germaniya/'), label: 'Налоги на Биткоин в Германии' }
    ],
    moduleCta: { href: toRoot(relFile, 'ru/stacking.html'), label: 'Открыть Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'DCA-калькулятор для Биткоина',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Типовой пример: 500 €, затем 100 € в месяц × 12. Та же формула, что и в модуле Stacking Strategist.</p>
<h2>Рейтинг при 100 € в месяц</h2>
${tableHtml(['Место', 'Партнёр', 'Метод', 'Переменная комиссия', 'Годовые комиссии'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodRu(r.method)), esc(formatPctPl(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Частые вопросы')}
`
  });
}

// RU sell vs borrow
{
  const relFile = 'ru/bitcoin-prodat-ili-zanyat/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `Возникает ли налог при продаже в этих ${N} странах?`, a: `Обычно да, при продаже или обмене. Освобождения различаются: в Германии 0% после 1 года владения, в Чехии — 3-летний тест времени, в Польше освобождения нет. По состоянию на ${asOfRu}. Не является налоговой консультацией.` },
    { q: 'Является ли заём таким же налоговым событием, как продажа?', a: 'В этом обзоре — нет. Но проценты, риск ликвидации и KYC у партнёра всё равно остаются. Конкретные цифры рассчитает Loan & Liquidity Copilot.' },
    { q: 'Что такое риск ликвидации?', a: 'Если стоимость залога упадёт до порога партнёра, тот может продать залог, чтобы погасить заём. Virtuse никогда не хранит ваши ключи или залог.' },
    { q: 'Где рассчитать конкретную сумму?', a: 'В модуле Loan & Liquidity Copilot. Эта страница объясняет только разницу между налогом и риском на основе опубликованных налоговых ставок.' }
  ];
  const answer = finalizeAnswer([
    `По состоянию на ${asOfRu} продажа Биткоина может повлечь налог (например, в Германии до 45% в течение первого года владения, в Румынии фиксированные 10%).`,
    'Заём под залог Биткоина сохраняет рыночную позицию, но добавляет проценты и риск ликвидации у партнёра.',
    'Справочный обзор 2026, не является налоговой или кредитной консультацией. Virtuse никогда не хранит ваши ключи.'
  ], 'ru');
  pushPage({
    relFile, lang: 'ru',
    title: assertTitle('Биткоин: продать или занять? (2026)'),
    description: assertDescription(`Продать Биткоин и заплатить налог или взять заём под его залог и остаться в рынке? Ставки ${N} стран ЕС по состоянию на ${asOfRu}.`),
    h1: 'Продать Биткоин или взять заём под его залог?',
    answerHtml: esc(answer),
    breadcrumbs: [ruHome(relFile), { name: 'Продать или занять', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'ru/bitcoin-nalogi/germaniya/'), label: 'Налоги на Биткоин в Германии' },
      { href: toRoot(relFile, 'ru/bitcoin-kalkulyator-dca/'), label: 'DCA-калькулятор' },
      { href: toRoot(relFile, 'ru/bitcoin-nasledstvo/'), label: 'Биткоин и наследство' }
    ],
    moduleCta: { href: toRoot(relFile, 'ru/loan.html'), label: 'Сравнить в Loan Copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Биткоин: продать или занять',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Налог при продаже</h2>
${tableHtml(['Страна', 'Налог на прибыль', 'Освобождение'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `ru/bitcoin-nalogi/${slugRu(c.id)}/`))}">${esc(nameRu(c.id))}</a>`,
  esc(meta.taxRu[c.id].gainTax),
  esc(meta.taxRu[c.id].exemption)
]))}
<h2>Риск при займе</h2>
<p>Займы под залог Биткоина предоставляют регулируемые партнёры, а не Virtuse. Вы сохраняете ценовую экспозицию, платите проценты, а залог могут ликвидировать. Virtuse никогда не хранит залог.</p>
${faqHtml(faqs, 'Частые вопросы')}
`
  });
}

// RU inheritance
{
  const relFile = 'ru/bitcoin-nasledstvo/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: 'Может ли в письме с инструкциями быть сид-фраза?', a: 'Нет. Письмо содержит перечень, места и контакты, но никогда не сид-фразы. Храните его вместе с завещанием или у юриста.' },
    { q: 'Почему мультиподпись 2 из 3?', a: 'Одна сид-фраза — это единая точка отказа и для вас, и для ваших наследников.' },
    { q: 'Хранит ли Virtuse ключи для наследников?', a: 'Нет. Virtuse никогда не хранит ваши ключи.' },
    { q: 'Это юридическая консультация?', a: `Нет. Это чек-лист для образовательных целей из модуля Tax по состоянию на ${asOfRu}.` }
  ];
  const answer = finalizeAnswer([
    `По состоянию на ${asOfRu} чек-лист модуля Tax состоит из шести пунктов: письмо с инструкциями, географическое разделение ключей, осведомлённый наследник, мультиподпись 2 из 3, проверка восстановления и задокументированные счета.`,
    'Одна сид-фраза — это единая точка отказа. Virtuse никогда не хранит ваши ключи.',
    'Не является юридической консультацией.'
  ], 'ru');
  const howto = {
    '@type': 'HowTo',
    name: 'Подготовка Биткоина к наследованию',
    inLanguage: 'ru',
    step: meta.inheritanceRu.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'ru',
    title: assertTitle('Биткоин и наследство: чек-лист (2026)'),
    description: assertDescription(`Чек-лист из шести пунктов для наследования Биткоина по состоянию на ${asOfRu}: письмо с инструкциями, разделение ключей, мультиподпись 2 из 3.`),
    h1: 'Наследование Биткоина: чек-лист',
    answerHtml: esc(answer),
    breadcrumbs: [ruHome(relFile), { name: 'Наследство', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'ru/bitcoin-nalogi/germaniya/'), label: 'Налоги на Биткоин в Германии' },
      { href: toRoot(relFile, 'ru/bitcoin-nalogi/'), label: `Налоги в ${N} странах ЕС` },
      { href: toRoot(relFile, 'ru/bitcoin-prodat-ili-zanyat/'), label: 'Биткоин: продать или занять' }
    ],
    moduleCta: { href: toRoot(relFile, 'ru/' + TAX_AGENT), label: 'Оценить чек-лист в Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Содержание соответствует чек-листу модуля Tax. Не является юридической консультацией.</p>
<h2>Инструкция: шесть шагов</h2>
<ol>${meta.inheritanceRu.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Частые вопросы')}
`
  });
}

// RU fee index
{
  const relFile = 'ru/bitcoin-indeks-komissiy/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'ru');
  const faqs = [
    { q: 'Что измеряет индекс комиссий?', a: `Годовые комиссии способов покупки по состоянию на ${feeAsOfRu} по формуле модуля Stacking Strategist.` },
    { q: 'Какой способ самый дешёвый при 100 € в месяц?', a: `${winner.partner}: комиссия ${formatPctPl(winner.pct)}, то есть ${formatEurSk(winner.annualDrag)} в год.` },
    { q: 'Учтены ли спреды?', a: 'Нет. Только процентная комиссия и возможная ежемесячная подписка по тарифной таблице. Курсовые разницы и комиссии сети Биткоин не учтены.' },
    { q: 'Можно ли цитировать таблицу?', a: `Да, со ссылкой и подписью «Источник: индекс комиссий за Биткоин от Virtuse, по состоянию на ${feeAsOfRu}».` }
  ];
  const answer = finalizeAnswer([
    `Индекс комиссий за Биткоин от Virtuse по состоянию на ${feeAsOfRu} ранжирует способы покупки в ЕС по годовым комиссиям.`,
    `При 100 € в месяц лидирует ${winner.partner} (${methodRu(winner.method)}) с комиссией ${formatPctPl(winner.pct)}, то есть ${formatEurSk(winner.annualDrag)} в год.`,
    beText,
    'Это не предложение. Virtuse никогда не хранит ваши ключи.'
  ], 'ru', 'fee');
  pushPage({
    relFile, lang: 'ru',
    title: assertTitle('Индекс комиссий за Биткоин (ЕС) Q4 2026'),
    description: assertDescription(`Способы покупки Биткоина в ЕС по комиссиям, по состоянию на ${feeAsOfRu}. Самый дешёвый при 100 € в месяц: ${winner.partner}, ${formatPctPl(winner.pct)}.`),
    h1: 'Индекс комиссий за Биткоин',
    answerHtml: esc(answer),
    breadcrumbs: [ruHome(relFile), { name: 'Индекс комиссий', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'ru/bitcoin-kalkulyator-dca/'), label: 'DCA-калькулятор' },
      { href: toRoot(relFile, 'ru/bitcoin-nalogi/germaniya/'), label: 'Налоги на Биткоин в Германии' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Методология (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'ru/stacking.html'), label: 'Открыть Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Индекс комиссий за Биткоин от Virtuse',
        inLanguage: 'ru',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Индекс комиссий за Биткоин от Virtuse',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Рейтинг по ежемесячному взносу</h2>
${tables}
<h2>Автоматически или вручную?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Частые вопросы')}
`
  });
}

// ---------- French (fr/) ----------
// Strings are written with plain spaces; pushPage applies nbspFr() to every French text field.
// French: lowercase a data value's first letter after a colon (keeps KESt, PIT-38, IRPF).
function lcFr(s) { return /^[A-ZÀÂÉÈÊÎÔÛÇ][a-zàâçéèêëîïôûùüÿœ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
function frHome(relFile) { return { name: 'Accueil', href: toRoot(relFile, 'fr/index.html'), abs: abs('fr/index.html') }; }

// FR tax hub
{
  const relFile = 'fr/bitcoin-fiscalite/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `fr/bitcoin-fiscalite/${slugFr(c.id)}/`))}">${esc(nameFr(c.id))}</a>`,
    esc(meta.taxFr[c.id].gainTax),
    esc(meta.taxFr[c.id].exemption)
  ]);
  const faqs = [
    { q: 'Quels pays couvre cet aperçu ?', a: `Il couvre ${N} pays de l'UE : ${COUNTRIES.map((c) => nameFr(c.id)).join(', ')}. Situation au ${asOfFr}, données du module Virtuse Tax.` },
    { q: 'Est-ce un conseil fiscal ?', a: "Non. Aperçu indicatif 2026, pas un conseil fiscal. Vérifiez les règles de l'année en cours auprès d'un conseiller local." },
    { q: "Virtuse déclare-t-il mes avoirs à l'administration fiscale ?", a: 'Non. Virtuse ne détient jamais vos clés ni votre historique de transactions. Les partenaires effectuent eux-mêmes le KYC.' },
    { q: 'Où vérifier aussi la succession ?', a: `Dans le module Tax & Inheritance Agent, avec les mêmes ${N} pays et une vérification de préparation au multisig.` }
  ];
  const answer = finalizeAnswer([
    `Cet aperçu compare la fiscalité du Bitcoin dans ${N} pays de l'UE, situation au ${asOfFr}.`,
    'Les taux, exonérations et notes de déclaration proviennent du module Virtuse Tax.',
    "L'Allemagne et l'Autriche exonèrent les plus-values après 1 an de détention, la Tchéquie après 3 ans ; les Pays-Bas imposent un rendement présumé (Box 3).",
    'Aperçu indicatif 2026, pas un conseil fiscal.'
  ], 'fr');
  pushPage({
    relFile, lang: 'fr',
    title: assertTitle(`Fiscalité du Bitcoin dans ${N} pays de l'UE (2026)`),
    description: assertDescription(`Taux d'imposition du Bitcoin, exonérations liées à la durée de détention et déclaration dans ${N} pays de l'UE, situation au ${asOfFr}.`),
    h1: `Fiscalité du Bitcoin dans ${N} pays de l'UE`,
    answerHtml: esc(answer),
    breadcrumbs: [frHome(relFile), { name: 'Fiscalité du Bitcoin', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'fr/bitcoin-fiscalite/france/'), label: 'Fiscalité du Bitcoin en France' },
      { href: toRoot(relFile, 'fr/bitcoin-succession/'), label: 'Bitcoin et succession' },
      { href: toRoot(relFile, 'fr/bitcoin-indice-frais/'), label: 'Indice des frais Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'fr/' + TAX_AGENT), label: 'Ouvrir le Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Chaque page pays indique l'impôt sur les plus-values, l'éventuelle exonération liée à la durée de détention et les modalités de déclaration, situation au ${esc(asOfFr)}. Le module Tax & Inheritance Agent utilise les mêmes données et ajoute un score de préparation à la succession.</p>
<h2>Comparatif par pays</h2>
${tableHtml(['Pays', 'Impôt sur les plus-values', 'Exonération'], rows)}
${faqHtml(faqs, 'Questions fréquentes')}
`
  });
}

// FR country tax pages
for (const c of COUNTRIES) {
  const relFile = `fr/bitcoin-fiscalite/${slugFr(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxFr[c.id];
  const inN = inFr(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `Quel est l'impôt sur le Bitcoin ${inN} ?`, a: `Situation au ${asOfFr} : ${lcFr(t.gainTax)}. Aperçu indicatif 2026, pas un conseil fiscal.` },
    { q: `Existe-t-il ${inN} une exonération liée à la durée de détention ?`, a: `${t.exemption}. Avant de déclarer, vérifiez les règles de l'année en cours auprès d'un conseiller fiscal local.` },
    { q: `Comment déclarer ses plus-values en Bitcoin ${inN} ?`, a: `${t.filing}. ${t.note}` },
    { q: 'Virtuse détient-il mes bitcoins ou dépose-t-il ma déclaration ?', a: `Non. Virtuse ne détient jamais vos clés. Le KYC et l'inscription se font chez le partenaire. Le Tax Agent présente l'aperçu des ${N} pays ; la déclaration est préparée par un conseiller fiscal qualifié.` }
  ];
  const answer = finalizeAnswer([
    `Fiscalité du Bitcoin ${inN}, situation au ${asOfFr} : ${lcFr(t.gainTax)}.`,
    /^Aucune exonération/.test(t.exemption) ? `${t.exemption}.` : `Exonération : ${lcFr(t.exemption)}.`,
    `Modalités : ${lcFr(t.filing)}.`,
    t.note,
    'Aperçu indicatif 2026, pas un conseil fiscal.'
  ], 'fr');
  pushPage({
    relFile, lang: 'fr',
    title: assertTitle(`Fiscalité du Bitcoin ${inN} (${asOfFr})`),
    description: assertDescription(descFit(`Fiscalité du Bitcoin ${inN} (${asOfFr}) : ${lcFr(t.gainTax)}.`, 'Pas un conseil fiscal.')),
    h1: `Fiscalité du Bitcoin ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      frHome(relFile),
      { name: 'Fiscalité du Bitcoin', href: toRoot(relFile, 'fr/bitcoin-fiscalite/'), abs: abs('fr/bitcoin-fiscalite/index.html') },
      { name: nameFr(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'fr/bitcoin-vendre-ou-emprunter/'), label: 'Bitcoin : vendre ou emprunter' },
      { href: toRoot(relFile, 'fr/bitcoin-succession/'), label: 'Bitcoin et succession' },
      { href: toRoot(relFile, nbs[0] ? `fr/bitcoin-fiscalite/${slugFr(nbs[0].id)}/` : 'fr/bitcoin-fiscalite/'), label: nbs[0] ? `Fiscalité du Bitcoin ${inFr(nbs[0].id)}` : 'Tous les pays' }
    ],
    moduleCta: { href: toRoot(relFile, `fr/${TAX_AGENT}?country=${c.id}`), label: `Vérifier ${defFr(c.id)} dans le Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Données au ${esc(asOfFr)}, reprises du module Virtuse Tax.</p>
<h2>Taux et déclaration</h2>
${tableHtml(['Champ', 'Au ' + asOfFr], [
  ['Impôt sur les plus-values', esc(t.gainTax)],
  ['Exonération', esc(t.exemption)],
  ['Déclaration', esc(t.filing)],
  ['Remarque', esc(t.note)]
])}
<h2>Quand l'impôt est-il généralement dû ?</h2>
<p>${esc(t.note)} Dans cet aperçu, l'achat de bitcoins n'est pas considéré comme une cession ; avant de payer, d'échanger, de donner ou de prêter des bitcoins, vérifiez les règles locales.</p>
<h2>Pays voisins</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `fr/bitcoin-fiscalite/${slugFr(n.id)}/`))}">Fiscalité du Bitcoin ${esc(inFr(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Questions fréquentes')}
`
  });
}

// FR DCA calculator
{
  const relFile = 'fr/bitcoin-calculateur-dca/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: 'Ce calculateur prévoit-il le cours du Bitcoin ?', a: "Non. Il compare uniquement les frais des partenaires selon le barème publié. Le rendement lié au cours du Bitcoin n'est pas modélisé." },
    { q: 'Quel plan type est utilisé ?', a: `Un versement initial de 500 €, puis 100 € par mois pendant 12 mois, situation au ${feeAsOfFr}. Le classement repose sur les frais de la première année.` },
    { q: 'Quelle voie est la moins chère pour ce plan ?', a: `${win.partner} (${methodFr(win.method)}), avec des frais variables de ${formatPctSk(win.pct)} selon la formule du Stacking Strategist.` },
    { q: 'Est-ce un conseil en investissement ?', a: 'Non. À des fins éducatives uniquement. Le KYC se fait chez le partenaire. Virtuse ne détient jamais vos clés.' }
  ];
  const answer = finalizeAnswer([
    `Au ${feeAsOfFr}, dans un exemple DCA fondé uniquement sur les frais (500 €, puis 100 € par mois pendant 12 mois), ${win.partner} arrive en tête.`,
    `Frais variables : ${formatPctSk(win.pct)}. Ce n'est pas une prévision de cours.`,
    'Les frais proviennent du barème du module Stacking Strategist et sont calculés avec la même formule. Aperçu indicatif 2026.'
  ], 'fr', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'fr',
    title: assertTitle('Calculateur DCA Bitcoin (frais UE 2026)'),
    description: assertDescription(`Calculateur DCA Bitcoin fondé uniquement sur les frais, situation au ${feeAsOfFr}. Scénario type : 500 € + 100 € par mois ; voie la moins chère : ${win.partner}.`),
    h1: 'Calculateur DCA Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [frHome(relFile), { name: 'Calculateur DCA', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'fr/bitcoin-indice-frais/'), label: 'Indice des frais Bitcoin' },
      { href: toRoot(relFile, 'fr/bitcoin-vendre-ou-emprunter/'), label: 'Bitcoin : vendre ou emprunter' },
      { href: toRoot(relFile, 'fr/bitcoin-fiscalite/france/'), label: 'Fiscalité du Bitcoin en France' }
    ],
    moduleCta: { href: toRoot(relFile, 'fr/stacking.html'), label: 'Ouvrir le Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Calculateur DCA Bitcoin',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Exemple type : 500 €, puis 100 € par mois × 12. Même formule que dans le module Stacking Strategist.</p>
<h2>Classement à 100 € par mois</h2>
${tableHtml(['Rang', 'Partenaire', 'Méthode', 'Frais variables', 'Frais annuels'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodFr(r.method)), esc(formatPctSk(r.pct)), esc(formatEurSk(r.annualDrag))
]))}
${faqHtml(faqs, 'Questions fréquentes')}
`
  });
}

// FR sell vs borrow
{
  const relFile = 'fr/bitcoin-vendre-ou-emprunter/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `La vente déclenche-t-elle un impôt dans ces ${N} pays ?`, a: `En général oui, lors d'une vente ou d'un échange. Les exonérations varient : Allemagne, 0 % après 1 an de détention ; Tchéquie, critère de durée de 3 ans ; Pologne, aucune exonération. Situation au ${asOfFr}. Pas un conseil fiscal.` },
    { q: "Un prêt est-il le même fait générateur qu'une vente ?", a: 'Pas dans cet aperçu. Il reste toutefois les intérêts, le risque de liquidation et le KYC chez le partenaire. Le Loan & Liquidity Copilot calcule les chiffres concrets.' },
    { q: "Qu'est-ce que le risque de liquidation ?", a: 'Si la valeur de la garantie descend jusqu\'au seuil du partenaire, celui-ci peut vendre la garantie pour rembourser le prêt. Virtuse ne détient jamais vos clés ni la garantie.' },
    { q: 'Où calculer un montant précis ?', a: "Dans le module Loan & Liquidity Copilot. Cette page explique seulement l'arbitrage entre impôt et risque à partir des taux publiés." }
  ];
  const answer = finalizeAnswer([
    `Au ${asOfFr}, vendre des bitcoins peut déclencher un impôt (par exemple jusqu'à 45 % en Allemagne pendant la première année de détention, 10 % forfaitaire en Roumanie).`,
    'Un prêt garanti par Bitcoin permet de conserver sa position sur le marché, mais ajoute des intérêts et un risque de liquidation chez le partenaire.',
    'Aperçu indicatif 2026, pas un conseil fiscal ni un conseil en crédit. Virtuse ne détient jamais vos clés.'
  ], 'fr');
  pushPage({
    relFile, lang: 'fr',
    title: assertTitle('Bitcoin : vendre ou emprunter ? (2026)'),
    description: assertDescription(`Vendre ses bitcoins et payer l'impôt, ou emprunter en les mettant en garantie et rester investi ? Taux de ${N} pays de l'UE au ${asOfFr}.`),
    h1: 'Vendre ses bitcoins ou emprunter en les mettant en garantie ?',
    answerHtml: esc(answer),
    breadcrumbs: [frHome(relFile), { name: 'Vendre ou emprunter', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'fr/bitcoin-fiscalite/france/'), label: 'Fiscalité du Bitcoin en France' },
      { href: toRoot(relFile, 'fr/bitcoin-calculateur-dca/'), label: 'Calculateur DCA' },
      { href: toRoot(relFile, 'fr/bitcoin-succession/'), label: 'Bitcoin et succession' }
    ],
    moduleCta: { href: toRoot(relFile, 'fr/loan.html'), label: 'Comparer dans le Loan Copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin : vendre ou emprunter',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Impôt en cas de vente</h2>
${tableHtml(['Pays', 'Impôt sur les plus-values', 'Exonération'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `fr/bitcoin-fiscalite/${slugFr(c.id)}/`))}">${esc(nameFr(c.id))}</a>`,
  esc(meta.taxFr[c.id].gainTax),
  esc(meta.taxFr[c.id].exemption)
]))}
<h2>Risque en cas de prêt</h2>
<p>Les prêts garantis par Bitcoin sont proposés par des partenaires régulés, pas par Virtuse. Vous conservez votre exposition au cours, vous payez des intérêts et votre garantie peut être liquidée. Virtuse ne détient jamais la garantie.</p>
${faqHtml(faqs, 'Questions fréquentes')}
`
  });
}

// FR inheritance
{
  const relFile = 'fr/bitcoin-succession/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: "La lettre d'instructions peut-elle contenir la phrase de récupération ?", a: "Non. La lettre contient l'inventaire, les emplacements et les contacts, jamais de phrase de récupération. Conservez-la avec votre testament ou chez votre avocat." },
    { q: 'Pourquoi un multisig 2 sur 3 ?', a: 'Une seule phrase de récupération est un point de défaillance unique, pour vous comme pour vos héritiers.' },
    { q: 'Virtuse détient-il des clés pour les héritiers ?', a: 'Non. Virtuse ne détient jamais vos clés.' },
    { q: 'Est-ce un conseil juridique ?', a: `Non. C'est une check-list à but éducatif issue du module Tax, situation au ${asOfFr}.` }
  ];
  const answer = finalizeAnswer([
    `Au ${asOfFr}, la check-list du module Tax compte six points : lettre d'instructions, séparation géographique des clés, héritier informé, multisig 2 sur 3, test de récupération et comptes documentés.`,
    'Une seule phrase de récupération est un point de défaillance unique. Virtuse ne détient jamais vos clés.',
    'Pas un conseil juridique.'
  ], 'fr');
  const howto = {
    '@type': 'HowTo',
    name: 'Préparer la succession de ses bitcoins',
    inLanguage: 'fr',
    step: meta.inheritanceFr.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'fr',
    title: assertTitle('Bitcoin et succession : check-list (2026)'),
    description: assertDescription(`Check-list en six points pour la succession de vos bitcoins (${asOfFr}) : lettre d'instructions, séparation des clés, multisig 2 sur 3.`),
    h1: 'Succession Bitcoin : check-list',
    answerHtml: esc(answer),
    breadcrumbs: [frHome(relFile), { name: 'Succession', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'fr/bitcoin-fiscalite/france/'), label: 'Fiscalité du Bitcoin en France' },
      { href: toRoot(relFile, 'fr/bitcoin-fiscalite/'), label: `Fiscalité dans ${N} pays de l'UE` },
      { href: toRoot(relFile, 'fr/bitcoin-vendre-ou-emprunter/'), label: 'Bitcoin : vendre ou emprunter' }
    ],
    moduleCta: { href: toRoot(relFile, 'fr/' + TAX_AGENT), label: 'Évaluer la check-list dans le Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>Le contenu reprend la check-list du module Tax. Pas un conseil juridique.</p>
<h2>Marche à suivre : six étapes</h2>
<ol>${meta.inheritanceFr.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Questions fréquentes')}
`
  });
}

// FR fee index
{
  const relFile = 'fr/bitcoin-indice-frais/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'fr');
  const faqs = [
    { q: "Que mesure l'indice des frais ?", a: `Les frais annuels des voies d'achat au ${feeAsOfFr}, selon la formule du module Stacking Strategist.` },
    { q: 'Quelle voie est la moins chère à 100 € par mois ?', a: `${winner.partner}, avec ${formatPctSk(winner.pct)} de frais, soit ${formatEurSk(winner.annualDrag)} par an.` },
    { q: 'Les spreads sont-ils inclus ?', a: 'Non. Seulement les frais en pourcentage et un éventuel abonnement mensuel selon le barème. Les écarts de change et les frais de réseau Bitcoin ne sont pas inclus.' },
    { q: 'Puis-je citer le tableau ?', a: `Oui, en citant « Source : indice des frais Bitcoin de Virtuse, situation au ${feeAsOfFr} » avec un lien.` }
  ];
  const answer = finalizeAnswer([
    `L'indice des frais Bitcoin de Virtuse classe les voies d'achat dans l'UE selon leurs frais annuels, situation au ${feeAsOfFr}.`,
    `À 100 € par mois, ${winner.partner} (${methodFr(winner.method)}) arrive en tête avec ${formatPctSk(winner.pct)}, soit ${formatEurSk(winner.annualDrag)} par an.`,
    beText,
    "Ce n'est pas une offre. Virtuse ne détient jamais vos clés."
  ], 'fr', 'fee');
  pushPage({
    relFile, lang: 'fr',
    title: assertTitle(`Indice des frais Bitcoin (UE) ${feeAsOfFr}`),
    description: assertDescription(`Voies d'achat de Bitcoin dans l'UE classées par frais, situation au ${feeAsOfFr}. La moins chère à 100 € par mois : ${winner.partner}, ${formatPctSk(winner.pct)}.`),
    h1: 'Indice des frais Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [frHome(relFile), { name: 'Indice des frais', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'fr/bitcoin-calculateur-dca/'), label: 'Calculateur DCA' },
      { href: toRoot(relFile, 'fr/bitcoin-fiscalite/france/'), label: 'Fiscalité du Bitcoin en France' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Méthodologie (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'fr/stacking.html'), label: 'Ouvrir le Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Indice des frais Bitcoin de Virtuse',
        inLanguage: 'fr',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Indice des frais Bitcoin de Virtuse',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Classement par versement mensuel</h2>
${tables}
<h2>Automatisé ou manuel ?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Questions fréquentes')}
`
  });
}

// ---------- Spanish (es/) ----------
// pushPage applies nbspEs() (NBSP before % and €) to every Spanish text field.
// Spanish: lowercase a data value's first letter after a colon (keeps KESt, PIT-38, IRPF).
function lcEs(s) { return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
function esHome(relFile) { return { name: 'Inicio', href: toRoot(relFile, 'es/index.html'), abs: abs('es/index.html') }; }

// ES tax hub
{
  const relFile = 'es/bitcoin-impuestos/index.html';
  const enFile = 'bitcoin-tax/index.html';
  const deFile = 'de/bitcoin-steuern/index.html';
  const rows = COUNTRIES.map((c) => [
    `${c.flag} <a href="${esc(toRoot(relFile, `es/bitcoin-impuestos/${slugEs(c.id)}/`))}">${esc(nameEs(c.id))}</a>`,
    esc(meta.taxEs[c.id].gainTax),
    esc(meta.taxEs[c.id].exemption)
  ]);
  const faqs = [
    { q: '¿Qué países cubre este resumen?', a: `Cubre ${N} países de la UE: ${COUNTRIES.map((c) => nameEs(c.id)).join(', ')}. Datos del ${asOfEs}, procedentes del módulo Virtuse Tax.` },
    { q: '¿Es asesoramiento fiscal?', a: 'No. Resumen orientativo 2026, no es asesoramiento fiscal. Confirme las normas del año en curso con un asesor local.' },
    { q: '¿Informa Virtuse de mis activos a la administración tributaria?', a: 'No. Virtuse nunca guarda sus claves ni su historial de transacciones. Los socios realizan su propio KYC.' },
    { q: '¿Dónde puedo revisar también la herencia?', a: `En el módulo Tax & Inheritance Agent, con los mismos ${N} países y una comprobación de preparación para la multifirma.` }
  ];
  const answer = finalizeAnswer([
    `Este resumen compara la tributación de Bitcoin en ${N} países de la UE, con datos del ${asOfEs}.`,
    'Los tipos, las exenciones y las notas sobre la declaración proceden del módulo Virtuse Tax.',
    'Alemania y Austria eximen las ganancias tras 1 año de tenencia, la República Checa tras 3 años, y los Países Bajos gravan un rendimiento presunto (Box 3).',
    'Resumen orientativo 2026, no es asesoramiento fiscal.'
  ], 'es');
  pushPage({
    relFile, lang: 'es',
    title: assertTitle(`Impuestos sobre Bitcoin en ${N} países de la UE (2026)`),
    description: assertDescription(`Tipos impositivos de Bitcoin, exenciones por periodo de tenencia y declaración en ${N} países de la UE, datos del ${asOfEs}. Resumen orientativo.`),
    h1: `Impuestos sobre Bitcoin en ${N} países de la UE`,
    answerHtml: esc(answer),
    breadcrumbs: [esHome(relFile), { name: 'Impuestos sobre Bitcoin', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'es/bitcoin-impuestos/espana/'), label: 'Impuestos sobre Bitcoin en España' },
      { href: toRoot(relFile, 'es/bitcoin-herencia/'), label: 'Bitcoin y herencia' },
      { href: toRoot(relFile, 'es/bitcoin-indice-comisiones/'), label: 'Índice de comisiones de Bitcoin' }
    ],
    moduleCta: { href: toRoot(relFile, 'es/' + TAX_AGENT), label: 'Abrir Tax & Inheritance Agent →' },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>Cada página de país indica el impuesto sobre las ganancias, la posible exención por periodo de tenencia y la forma de declarar, con datos del ${esc(asOfEs)}. El módulo Tax & Inheritance Agent usa los mismos datos y añade una puntuación de preparación para la herencia.</p>
<h2>Comparativa por países</h2>
${tableHtml(['País', 'Impuesto sobre las ganancias', 'Exención'], rows)}
${faqHtml(faqs, 'Preguntas frecuentes')}
`
  });
}

// ES country tax pages
for (const c of COUNTRIES) {
  const relFile = `es/bitcoin-impuestos/${slugEs(c.id)}/index.html`;
  const enRel = `bitcoin-tax/${slugEn(c.id)}/index.html`;
  const deRel = `de/bitcoin-steuern/${slugDe(c.id)}/index.html`;
  const t = meta.taxEs[c.id];
  const inN = inEs(c.id);
  const nbs = neighborsOf(c.id);
  const faqs = [
    { q: `¿Cuál es el impuesto sobre Bitcoin ${inN}?`, a: `Datos del ${asOfEs}: ${lcEs(t.gainTax)}. Resumen orientativo 2026, no es asesoramiento fiscal.` },
    { q: `¿Existe ${inN} una exención por periodo de tenencia?`, a: `${t.exemption}. Antes de declarar, confirme las normas del año en curso con un asesor fiscal local.` },
    { q: `¿Cómo se declaran las ganancias de Bitcoin ${inN}?`, a: `${t.filing}. ${t.note}` },
    { q: '¿Guarda Virtuse mi Bitcoin o presenta mi declaración?', a: `No. Virtuse nunca guarda sus claves. El KYC y el registro se hacen con el socio. El Tax Agent muestra el resumen de ${N} países; la declaración la prepara un asesor fiscal cualificado.` }
  ];
  const answer = finalizeAnswer([
    `Impuestos sobre Bitcoin ${inN}, datos del ${asOfEs}: ${lcEs(t.gainTax)}.`,
    /^Sin exención/.test(t.exemption) ? `${t.exemption}.` : `Exención: ${lcEs(t.exemption)}.`,
    `Presentación: ${lcEs(t.filing)}.`,
    t.note,
    'Resumen orientativo 2026, no es asesoramiento fiscal.'
  ], 'es');
  pushPage({
    relFile, lang: 'es',
    title: assertTitle(`Impuestos sobre Bitcoin ${inN} (${asOfEs})`),
    description: assertDescription(descFit(`Impuestos sobre Bitcoin ${inN} (${asOfEs}): ${lcEs(t.gainTax)}.`, 'No es asesoramiento fiscal.')),
    h1: `Impuestos sobre Bitcoin ${inN}`,
    answerHtml: esc(answer),
    breadcrumbs: [
      esHome(relFile),
      { name: 'Impuestos sobre Bitcoin', href: toRoot(relFile, 'es/bitcoin-impuestos/'), abs: abs('es/bitcoin-impuestos/index.html') },
      { name: nameEs(c.id), abs: abs(relFile) }
    ],
    hreflang: hrefLangPair(enRel, deRel),
    related: [
      { href: toRoot(relFile, 'es/bitcoin-vender-o-pedir-prestado/'), label: 'Bitcoin: vender o pedir prestado' },
      { href: toRoot(relFile, 'es/bitcoin-herencia/'), label: 'Bitcoin y herencia' },
      { href: toRoot(relFile, nbs[0] ? `es/bitcoin-impuestos/${slugEs(nbs[0].id)}/` : 'es/bitcoin-impuestos/'), label: nbs[0] ? `Impuestos sobre Bitcoin ${inEs(nbs[0].id)}` : 'Todos los países' }
    ],
    moduleCta: { href: toRoot(relFile, `es/${TAX_AGENT}?country=${c.id}`), label: `Consultar ${defEs(c.id)} en el Tax Agent →` },
    schemas: [faqLd(faqs)],
    bodyHtml: `
<p>${esc(c.flag)} Datos del ${esc(asOfEs)}, tomados del módulo Virtuse Tax.</p>
<h2>Tipos y declaración</h2>
${tableHtml(['Campo', 'Datos del ' + asOfEs], [
  ['Impuesto sobre las ganancias', esc(t.gainTax)],
  ['Exención', esc(t.exemption)],
  ['Declaración', esc(t.filing)],
  ['Nota', esc(t.note)]
])}
<h2>¿Cuándo suele generarse el impuesto?</h2>
<p>${esc(t.note)} En este resumen, la compra de Bitcoin no se considera una transmisión; antes de pagar, intercambiar, donar o prestar monedas, compruebe las normas locales.</p>
<h2>Países vecinos</h2>
<ul>${nbs.map((n) => `<li><a href="${esc(toRoot(relFile, `es/bitcoin-impuestos/${slugEs(n.id)}/`))}">Impuestos sobre Bitcoin ${esc(inEs(n.id))}</a></li>`).join('')}</ul>
${faqHtml(faqs, 'Preguntas frecuentes')}
`
  });
}

// ES DCA calculator
{
  const relFile = 'es/bitcoin-calculadora-dca/index.html';
  const enFile = 'bitcoin-dca-calculator/index.html';
  const deFile = 'de/bitcoin-dca-rechner/index.html';
  const win = cheapest(FEE_ROWS, 100);
  const faqs = [
    { q: '¿Predice esta calculadora el precio de Bitcoin?', a: 'No. Solo compara las comisiones de los socios según el baremo publicado. No modela la rentabilidad del precio de Bitcoin.' },
    { q: '¿Qué plan tipo se usa?', a: `Una aportación inicial de 500 € y después 100 € al mes durante 12 meses, con datos del ${feeAsOfEs}. La clasificación se basa en las comisiones del primer año.` },
    { q: '¿Qué vía es la más barata en este plan?', a: `${win.partner} (${methodEs(win.method)}), con una comisión variable del ${formatPctSk(win.pct)} según la fórmula del Stacking Strategist.` },
    { q: '¿Es asesoramiento de inversión?', a: 'No. Solo con fines educativos. El KYC se realiza con el socio. Virtuse nunca guarda sus claves.' }
  ];
  const answer = finalizeAnswer([
    `Con datos del ${feeAsOfEs}, en un ejemplo de DCA basado solo en comisiones (500 € y después 100 € al mes durante 12 meses), ${win.partner} queda en primer lugar.`,
    `Comisión variable: ${formatPctSk(win.pct)}. No es una previsión de precio.`,
    'Las comisiones proceden del baremo del módulo Stacking Strategist y se calculan con la misma fórmula. Resumen orientativo 2026.'
  ], 'es', 'fee');
  const ranked = rankRoutes(FEE_ROWS, 100);
  pushPage({
    relFile, lang: 'es',
    title: assertTitle('Calculadora DCA de Bitcoin (comisiones UE 2026)'),
    description: assertDescription(`Calculadora DCA de Bitcoin basada solo en comisiones, datos del ${feeAsOfEs}. Caso tipo: 500 € + 100 € al mes; la vía más barata es ${win.partner}.`),
    h1: 'Calculadora DCA de Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [esHome(relFile), { name: 'Calculadora DCA', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'es/bitcoin-indice-comisiones/'), label: 'Índice de comisiones de Bitcoin' },
      { href: toRoot(relFile, 'es/bitcoin-vender-o-pedir-prestado/'), label: 'Bitcoin: vender o pedir prestado' },
      { href: toRoot(relFile, 'es/bitcoin-impuestos/espana/'), label: 'Impuestos sobre Bitcoin en España' }
    ],
    moduleCta: { href: toRoot(relFile, 'es/stacking.html'), label: 'Abrir Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Calculadora DCA de Bitcoin',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        isAccessibleForFree: true
      }
    ],
    bodyHtml: `
<p>Ejemplo tipo: 500 € y después 100 € al mes × 12. La misma fórmula que en el módulo Stacking Strategist.</p>
<h2>Clasificación con 100 € al mes</h2>
${tableHtml(['Puesto', 'Socio', 'Método', 'Comisión variable', 'Comisiones anuales'], ranked.map((r, i) => [
  esc(String(i + 1)), esc(r.partner), esc(methodEs(r.method)), esc(formatPctSk(r.pct)), esc(formatEurEs(r.annualDrag))
]))}
${faqHtml(faqs, 'Preguntas frecuentes')}
`
  });
}

// ES sell vs borrow
{
  const relFile = 'es/bitcoin-vender-o-pedir-prestado/index.html';
  const enFile = 'sell-vs-borrow-bitcoin/index.html';
  const deFile = 'de/bitcoin-verkaufen-oder-beleihen/index.html';
  const faqs = [
    { q: `¿Genera impuestos la venta en estos ${N} países?`, a: `Por lo general sí, al vender o intercambiar. Las exenciones varían: Alemania, 0 % tras 1 año de tenencia; la República Checa, prueba temporal de 3 años; Polonia, sin exención. Datos del ${asOfEs}. No es asesoramiento fiscal.` },
    { q: '¿Es un préstamo el mismo hecho imponible que una venta?', a: 'En este resumen, no. Pero hay intereses, riesgo de liquidación y KYC con el socio. El Loan & Liquidity Copilot calcula las cifras concretas.' },
    { q: '¿Qué es el riesgo de liquidación?', a: 'Si el valor de la garantía cae hasta el umbral del socio, este puede vender la garantía para devolver el préstamo. Virtuse nunca guarda sus claves ni la garantía.' },
    { q: '¿Dónde calculo un importe concreto?', a: 'En el módulo Loan & Liquidity Copilot. Esta página solo explica la diferencia entre impuesto y riesgo a partir de los tipos publicados.' }
  ];
  const answer = finalizeAnswer([
    `Con datos del ${asOfEs}, vender Bitcoin puede generar impuestos (por ejemplo, hasta el 45 % en Alemania durante el primer año de tenencia, un 10 % fijo en Rumanía).`,
    'Un préstamo respaldado por Bitcoin mantiene su posición en el mercado, pero añade intereses y riesgo de liquidación con el socio.',
    'Resumen orientativo 2026, no es asesoramiento fiscal ni crediticio. Virtuse nunca guarda sus claves.'
  ], 'es');
  pushPage({
    relFile, lang: 'es',
    title: assertTitle('Bitcoin: ¿vender o pedir prestado? (2026)'),
    description: assertDescription(`¿Vender Bitcoin y pagar impuestos, o pedir un préstamo respaldado por Bitcoin y seguir invertido? Tipos de ${N} países de la UE, datos del ${asOfEs}.`),
    h1: '¿Vender Bitcoin o pedir un préstamo respaldado por él?',
    answerHtml: esc(answer),
    breadcrumbs: [esHome(relFile), { name: 'Vender o pedir prestado', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'es/bitcoin-impuestos/espana/'), label: 'Impuestos sobre Bitcoin en España' },
      { href: toRoot(relFile, 'es/bitcoin-calculadora-dca/'), label: 'Calculadora DCA' },
      { href: toRoot(relFile, 'es/bitcoin-herencia/'), label: 'Bitcoin y herencia' }
    ],
    moduleCta: { href: toRoot(relFile, 'es/loan.html'), label: 'Comparar en el Loan Copilot →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'WebApplication',
        name: 'Bitcoin: vender o pedir prestado',
        url: abs(relFile),
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
      }
    ],
    bodyHtml: `
<h2>Impuesto al vender</h2>
${tableHtml(['País', 'Impuesto sobre las ganancias', 'Exención'], COUNTRIES.map((c) => [
  `<a href="${esc(toRoot(relFile, `es/bitcoin-impuestos/${slugEs(c.id)}/`))}">${esc(nameEs(c.id))}</a>`,
  esc(meta.taxEs[c.id].gainTax),
  esc(meta.taxEs[c.id].exemption)
]))}
<h2>Riesgo al pedir prestado</h2>
<p>Los préstamos respaldados por Bitcoin los ofrecen socios regulados, no Virtuse. Usted mantiene la exposición al precio y paga intereses, y su garantía puede liquidarse. Virtuse nunca guarda la garantía.</p>
${faqHtml(faqs, 'Preguntas frecuentes')}
`
  });
}

// ES inheritance
{
  const relFile = 'es/bitcoin-herencia/index.html';
  const enFile = 'bitcoin-inheritance/index.html';
  const deFile = 'de/bitcoin-erbrecht/index.html';
  const faqs = [
    { q: '¿Puede la carta de instrucciones contener la frase semilla?', a: 'No. La carta recoge el inventario, las ubicaciones y los contactos, nunca frases semilla. Guárdela con su testamento o con su abogado.' },
    { q: '¿Por qué una multifirma 2 de 3?', a: 'Una sola frase semilla es un punto único de fallo, para usted y para sus herederos.' },
    { q: '¿Guarda Virtuse claves para los herederos?', a: 'No. Virtuse nunca guarda sus claves.' },
    { q: '¿Es asesoramiento jurídico?', a: `No. Es una lista de comprobación del módulo Tax, con fines educativos y datos del ${asOfEs}.` }
  ];
  const answer = finalizeAnswer([
    `Con datos del ${asOfEs}, la lista de comprobación del módulo Tax tiene seis puntos: carta de instrucciones, separación geográfica de las claves, heredero informado, multifirma 2 de 3, prueba de recuperación y cuentas documentadas.`,
    'Una sola frase semilla es un punto único de fallo. Virtuse nunca guarda sus claves.',
    'No es asesoramiento jurídico.'
  ], 'es');
  const howto = {
    '@type': 'HowTo',
    name: 'Preparar la herencia de su Bitcoin',
    inLanguage: 'es',
    step: meta.inheritanceEs.map((it, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: it.name,
      text: it.text
    }))
  };
  pushPage({
    relFile, lang: 'es',
    title: assertTitle('Bitcoin y herencia: lista de comprobación (2026)'),
    description: assertDescription(`Lista de comprobación de seis puntos para la herencia de Bitcoin (${asOfEs}): carta de instrucciones, separación de claves, multifirma 2 de 3.`),
    h1: 'Herencia de Bitcoin: lista de comprobación',
    answerHtml: esc(answer),
    breadcrumbs: [esHome(relFile), { name: 'Herencia', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'es/bitcoin-impuestos/espana/'), label: 'Impuestos sobre Bitcoin en España' },
      { href: toRoot(relFile, 'es/bitcoin-impuestos/'), label: `Impuestos en ${N} países de la UE` },
      { href: toRoot(relFile, 'es/bitcoin-vender-o-pedir-prestado/'), label: 'Bitcoin: vender o pedir prestado' }
    ],
    moduleCta: { href: toRoot(relFile, 'es/' + TAX_AGENT), label: 'Evaluar la lista en el Tax Agent →' },
    schemas: [faqLd(faqs), howto],
    bodyHtml: `
<p>El contenido sigue la lista de comprobación del módulo Tax. No es asesoramiento jurídico.</p>
<h2>Guía: seis pasos</h2>
<ol>${meta.inheritanceEs.map((it) => `<li><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p></li>`).join('')}</ol>
${faqHtml(faqs, 'Preguntas frecuentes')}
`
  });
}

// ES fee index
{
  const relFile = 'es/bitcoin-indice-comisiones/index.html';
  const enFile = 'bitcoin-fee-index/index.html';
  const deFile = 'de/bitcoin-gebuehrenindex/index.html';
  const { tables, beText, winner } = feeIndexBody(relFile, 'es');
  const faqs = [
    { q: '¿Qué mide el índice de comisiones?', a: `Las comisiones anuales de las vías de compra, con datos del ${feeAsOfEs}, según la fórmula del módulo Stacking Strategist.` },
    { q: '¿Qué vía es la más barata con 100 € al mes?', a: `${winner.partner}, con una comisión del ${formatPctSk(winner.pct)} y ${formatEurEs(winner.annualDrag)} de comisiones al año.` },
    { q: '¿Se incluyen los diferenciales?', a: 'No. Solo la comisión porcentual y una posible suscripción mensual según el baremo. Los diferenciales de cambio y las comisiones de la red Bitcoin no se incluyen.' },
    { q: '¿Puedo citar la tabla?', a: `Sí, citando «Fuente: índice de comisiones de Bitcoin de Virtuse, datos del ${feeAsOfEs}» con un enlace.` }
  ];
  const answer = finalizeAnswer([
    `El índice de comisiones de Bitcoin de Virtuse ordena las vías de compra en la UE por comisiones anuales, con datos del ${feeAsOfEs}.`,
    `Con 100 € al mes, ${winner.partner} (${methodEs(winner.method)}) queda en primer lugar con un ${formatPctSk(winner.pct)}, es decir, ${formatEurEs(winner.annualDrag)} al año.`,
    beText,
    'No es una oferta. Virtuse nunca guarda sus claves.'
  ], 'es', 'fee');
  pushPage({
    relFile, lang: 'es',
    title: assertTitle(`Índice de comisiones de Bitcoin (UE) ${feeAsOfEs}`),
    description: assertDescription(`Vías de compra de Bitcoin en la UE ordenadas por comisiones, datos del ${feeAsOfEs}. La más barata con 100 € al mes: ${winner.partner}, ${formatPctSk(winner.pct)}.`),
    h1: 'Índice de comisiones de Bitcoin',
    answerHtml: esc(answer),
    breadcrumbs: [esHome(relFile), { name: 'Índice de comisiones', abs: abs(relFile) }],
    hreflang: hrefLangPair(enFile, deFile),
    related: [
      { href: toRoot(relFile, 'es/bitcoin-calculadora-dca/'), label: 'Calculadora DCA' },
      { href: toRoot(relFile, 'es/bitcoin-impuestos/espana/'), label: 'Impuestos sobre Bitcoin en España' },
      { href: toRoot(relFile, 'bitcoin-fee-index/methodology/'), label: 'Metodología (EN)' }
    ],
    moduleCta: { href: toRoot(relFile, 'es/stacking.html'), label: 'Abrir Stacking Strategist →' },
    schemas: [
      faqLd(faqs),
      {
        '@type': 'Article',
        headline: 'Índice de comisiones de Bitcoin de Virtuse',
        inLanguage: 'es',
        datePublished: LASTMOD,
        author: { '@id': `${ORIGIN}/#org` }
      },
      {
        '@type': 'Dataset',
        name: 'Índice de comisiones de Bitcoin de Virtuse',
        temporalCoverage: '2026-Q4',
        url: abs(relFile)
      }
    ],
    bodyHtml: `
<h2>Clasificación por aportación mensual</h2>
${tables}
<h2>¿Automatizado o manual?</h2>
<p>${esc(beText)}</p>
${faqHtml(faqs, 'Preguntas frecuentes')}
`
  });
}

// ---------- llms.txt ----------
function llmsShort() {
  const taxLines = COUNTRIES.map((c) =>
    `- [${c.name}](${ORIGIN}/bitcoin-tax/${slugEn(c.id)}/): ${c.gainTax}. ${c.exemption}. As of ${asOfEn}.`
  ).join('\n');
  const feeLines = rankRoutes(FEE_ROWS, 100).map((r, i) =>
    `- ${i + 1}. ${r.partner} (${r.method}): ${formatPct(r.pct)}, annual fee drag at €100/month ${formatEur(r.annualDrag)}`
  ).join('\n');
  return `# Virtuse

> Non-custodial hub for Bitcoin-only services. Virtuse never holds your keys.

As of ${asOfEn}. Indicative 2026 overview – not tax advice. Partner KYC on each platform.

## Bitcoin tax (${N} EU countries)

${taxLines}

Hub: ${ORIGIN}/bitcoin-tax/

## Buy routes / Fee Index

${feeLines}

Index: ${ORIGIN}/bitcoin-fee-index/
Archive: ${ORIGIN}/bitcoin-fee-index/2026-q3/

## Tools

- DCA calculator: ${ORIGIN}/bitcoin-dca-calculator/
- Sell vs borrow: ${ORIGIN}/sell-vs-borrow-bitcoin/
- Inheritance checklist: ${ORIGIN}/bitcoin-inheritance/
- Concierge (live): ${ORIGIN}/concierge.html
- Tax agent (live): ${ORIGIN}/tax-agent.html
- Tax category: ${ORIGIN}/tax.html
- Stacking (live): ${ORIGIN}/stacking.html
- Loan copilot (live): ${ORIGIN}/loan.html

## German pilot

- ${ORIGIN}/de/bitcoin-steuern/
- ${ORIGIN}/de/bitcoin-dca-rechner/
- ${ORIGIN}/de/bitcoin-verkaufen-oder-beleihen/
- ${ORIGIN}/de/bitcoin-erbrecht/
- ${ORIGIN}/de/bitcoin-gebuehrenindex/

## Slovak

- ${ORIGIN}/sk/bitcoin-dane/
- ${ORIGIN}/sk/bitcoin-dca-kalkulacka/
- ${ORIGIN}/sk/bitcoin-predat-alebo-pozicat/
- ${ORIGIN}/sk/bitcoin-dedicstvo/
- ${ORIGIN}/sk/bitcoin-index-poplatkov/

## Czech

- ${ORIGIN}/cs/bitcoin-dane/
- ${ORIGIN}/cs/bitcoin-dca-kalkulacka/
- ${ORIGIN}/cs/bitcoin-prodat-nebo-pujcit/
- ${ORIGIN}/cs/bitcoin-dedictvi/
- ${ORIGIN}/cs/bitcoin-index-poplatku/

## Polish

- ${ORIGIN}/pl/bitcoin-podatki/
- ${ORIGIN}/pl/bitcoin-kalkulator-dca/
- ${ORIGIN}/pl/bitcoin-sprzedac-czy-pozyczyc/
- ${ORIGIN}/pl/bitcoin-dziedziczenie/
- ${ORIGIN}/pl/bitcoin-indeks-oplat/

## Hungarian

- ${ORIGIN}/hu/bitcoin-adozas/
- ${ORIGIN}/hu/bitcoin-dca-kalkulator/
- ${ORIGIN}/hu/bitcoin-eladas-vagy-hitel/
- ${ORIGIN}/hu/bitcoin-orokles/
- ${ORIGIN}/hu/bitcoin-dijindex/

## Ukrainian

- ${ORIGIN}/uk/bitcoin-podatky/
- ${ORIGIN}/uk/bitcoin-kalkuliator-dca/
- ${ORIGIN}/uk/bitcoin-prodaty-chy-pozychyty/
- ${ORIGIN}/uk/bitcoin-spadshchyna/
- ${ORIGIN}/uk/bitcoin-indeks-komisii/

## Russian

- ${ORIGIN}/ru/bitcoin-nalogi/
- ${ORIGIN}/ru/bitcoin-kalkulyator-dca/
- ${ORIGIN}/ru/bitcoin-prodat-ili-zanyat/
- ${ORIGIN}/ru/bitcoin-nasledstvo/
- ${ORIGIN}/ru/bitcoin-indeks-komissiy/

## French

- ${ORIGIN}/fr/bitcoin-fiscalite/
- ${ORIGIN}/fr/bitcoin-calculateur-dca/
- ${ORIGIN}/fr/bitcoin-vendre-ou-emprunter/
- ${ORIGIN}/fr/bitcoin-succession/
- ${ORIGIN}/fr/bitcoin-indice-frais/

## Spanish

- ${ORIGIN}/es/bitcoin-impuestos/
- ${ORIGIN}/es/bitcoin-calculadora-dca/
- ${ORIGIN}/es/bitcoin-vender-o-pedir-prestado/
- ${ORIGIN}/es/bitcoin-herencia/
- ${ORIGIN}/es/bitcoin-indice-comisiones/

## Optional

- Full rates: ${ORIGIN}/llms-full.txt
`;
}

function llmsFull() {
  const tax = COUNTRIES.map((c) => `### ${c.flag} ${c.name} (\`${c.id}\`)
- Gain tax: ${c.gainTax}
- Exemption: ${c.exemption}
- Filing: ${c.filing}
- Note: ${c.note}
- EN: ${ORIGIN}/bitcoin-tax/${slugEn(c.id)}/
- DE: ${ORIGIN}/de/bitcoin-steuern/${slugDe(c.id)}/
- SK: ${ORIGIN}/sk/bitcoin-dane/${slugSk(c.id)}/
- CS: ${ORIGIN}/cs/bitcoin-dane/${slugCs(c.id)}/
- PL: ${ORIGIN}/pl/bitcoin-podatki/${slugPl(c.id)}/
- HU: ${ORIGIN}/hu/bitcoin-adozas/${slugHu(c.id)}/
- UK: ${ORIGIN}/uk/bitcoin-podatky/${slugUk(c.id)}/
- RU: ${ORIGIN}/ru/bitcoin-nalogi/${slugRu(c.id)}/
- FR: ${ORIGIN}/fr/bitcoin-fiscalite/${slugFr(c.id)}/
- ES: ${ORIGIN}/es/bitcoin-impuestos/${slugEs(c.id)}/
`).join('\n');
  const fees = FEE_ROWS.map((r) => `- ${r.partner} | ${r.method} | pct=${r.pct} | fixed=${r.fixed || 0} | monthly=${r.monthly || 0} | ${r.note}`).join('\n');
  const inh = inheritance.items.map((it) => `- ${it.question} (${it.points} pts): ${it.action}`).join('\n');
  return `# Virtuse — full rates and fees

As of ${asOfEn}. Copied from seo-build data / live Layer 2 modules. Do not treat as advice.

## Countries

${tax}

## Fee schedule (live stacking module)

${fees}

Formula: costPerPurchase = contribution * pct + fixed + monthly / (periodsPerYear / 12); annualDrag = costPerPurchase * periodsPerYear.

## Inheritance checklist (tax module)

${inh}

## Disclaimers

- Indicative 2026 overview – not tax advice
- Virtuse never holds your keys
- KYC and onboarding are completed on each partner’s regulated platform
`;
}

// ---------- sitemap + robots ----------
const SEO_MARK_START = '<!-- SEO-BUILD:START -->';
const SEO_MARK_END = '<!-- SEO-BUILD:END -->';

function sitemapEntries() {
  const indexable = generated.filter((p) => !p.noindex);
  const byCanon = new Map();
  for (const p of indexable) {
    const loc = abs(p.relFile);
    const pair = p.html.match(/hreflang="de" href="([^"]+)"/);
    const en = p.html.match(/hreflang="en" href="([^"]+)"/);
    const links = [];
    const hrefs = [...p.html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)];
    for (const m of hrefs) {
      links.push(`    <xhtml:link rel="alternate" hreflang="${m[1]}" href="${m[2]}"/>`);
    }
    byCanon.set(loc, { loc, links: links.join('\n'), lang: p.lang });
  }
  return [...byCanon.values()].map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${e.lang === 'en' ? '0.7' : '0.6'}</priority>
${e.links}
  </url>`).join('\n');
}

function patchSitemap(xml) {
  const block = `${SEO_MARK_START}\n${sitemapEntries()}\n${SEO_MARK_END}`;
  if (xml.includes(SEO_MARK_START) && xml.includes(SEO_MARK_END)) {
    return xml.replace(new RegExp(`${SEO_MARK_START}[\\s\\S]*?${SEO_MARK_END}`), block);
  }
  if (!xml.includes('</urlset>')) throw new Error('sitemap.xml missing </urlset>');
  return xml.replace('</urlset>', `${block}\n</urlset>`);
}

function patchRobots(txt) {
  const extra = `Disallow: /i18n-tools/
Disallow: /research/
Disallow: /partnerships/
Disallow: /seo-build/
Disallow: /cloudflare-worker/
Disallow: /email/
Disallow: /bitcoin-fee-index/2026-q3/print.html`;
  let out = txt;
  if (!out.includes('Disallow: /seo-build/')) {
    out = out.replace(/Allow: \/\n/, `Allow: /\n${extra}\n`);
  }
  const sitemapLine = `Sitemap: ${ORIGIN}/sitemap.xml`;
  if (/^Sitemap:\s*\S+/m.test(out)) {
    out = out.replace(/^Sitemap:\s*\S+/m, sitemapLine);
  } else {
    out = `${out.trimEnd()}\n\n${sitemapLine}\n`;
  }
  return out;
}

function walkPublishedFiles(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ent.name === 'i18n-tools' ||
      ent.name === 'research' ||
      ent.name === 'partnerships' ||
      ent.name === 'node_modules'
    ) continue;
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPublishedFiles(fp, acc);
    else if (/\.(html|xml|txt)$/.test(ent.name)) acc.push(fp);
  }
  return acc;
}

function rewritePublishedOrigins() {
  for (const fp of walkPublishedFiles(SITE)) {
    const before = fs.readFileSync(fp, 'utf8');
    const after = rewriteKnownOrigins(before, ORIGIN);
    if (after !== before) fs.writeFileSync(fp, after, 'utf8');
  }
}

function writeAll() {
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const prev = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const rel of prev.files || []) {
      const fp = path.join(SITE, rel);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }

  const files = [];
  for (const p of generated) {
    const fp = path.join(SITE, p.relFile);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, p.html, 'utf8');
    files.push(p.relFile);
  }

  const llms = llmsShort();
  const llmsF = llmsFull();
  fs.writeFileSync(path.join(SITE, 'llms.txt'), llms, 'utf8');
  fs.writeFileSync(path.join(SITE, 'llms-full.txt'), llmsF, 'utf8');
  files.push('llms.txt', 'llms-full.txt');

  const sitemapPath = path.join(SITE, 'sitemap.xml');
  const sitemap = rewriteKnownOrigins(fs.readFileSync(sitemapPath, 'utf8'), ORIGIN);
  fs.writeFileSync(sitemapPath, patchSitemap(sitemap), 'utf8');

  const robotsPath = path.join(SITE, 'robots.txt');
  fs.writeFileSync(
    robotsPath,
    patchRobots(rewriteKnownOrigins(fs.readFileSync(robotsPath, 'utf8'), ORIGIN)),
    'utf8'
  );

  rewritePublishedOrigins();

  const counts = {
    enIndexable: generated.filter((p) => p.lang === 'en' && !p.noindex).length,
    deIndexable: generated.filter((p) => p.lang === 'de' && !p.noindex).length,
    skIndexable: generated.filter((p) => p.lang === 'sk' && !p.noindex).length,
    csIndexable: generated.filter((p) => p.lang === 'cs' && !p.noindex).length,
    plIndexable: generated.filter((p) => p.lang === 'pl' && !p.noindex).length,
    huIndexable: generated.filter((p) => p.lang === 'hu' && !p.noindex).length,
    ukIndexable: generated.filter((p) => p.lang === 'uk' && !p.noindex).length,
    ruIndexable: generated.filter((p) => p.lang === 'ru' && !p.noindex).length,
    frIndexable: generated.filter((p) => p.lang === 'fr' && !p.noindex).length,
    esIndexable: generated.filter((p) => p.lang === 'es' && !p.noindex).length,
    noindex: generated.filter((p) => p.noindex).length,
    totalHtml: generated.length
  };

  const manifest = {
    generatedAtAsOf: AS_OF,
    lastmod: LASTMOD,
    origin: ORIGIN,
    feeSource: meta.feeSource,
    counts,
    files
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return manifest;
}

const manifest = writeAll();
console.log(JSON.stringify(manifest.counts, null, 2));
console.log(`origin ${ORIGIN}`);
console.log(`Wrote ${manifest.files.length} files into ${SITE_DIR_NAME}`);
