export const SITE_DIR_NAME = 'Kimi_Agent_Virtuse%20MiCA%20Partners';

/** Production canonical origin. Override with SITE_ORIGIN for staging builds. */
export const DEFAULT_ORIGIN = 'https://virtuse.com';

const KNOWN_ORIGINS = [
  'https://staging.virtuse.com',
  'https://virtuse.com'
];

export function normalizeOrigin(raw) {
  const value = String(raw || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(value)) {
    throw new Error(
      `Invalid origin "${raw}". Use an https host with no path, e.g. ${DEFAULT_ORIGIN}`
    );
  }
  return value;
}

export function resolveSiteOrigin(metaOrigin, env = process.env) {
  return normalizeOrigin(env.SITE_ORIGIN || metaOrigin || DEFAULT_ORIGIN);
}

/** Rewrite known Virtuse hosts to the active origin. Longer hosts first. */
export function rewriteKnownOrigins(text, origin) {
  let out = String(text);
  for (const host of KNOWN_ORIGINS) {
    if (host !== origin) out = out.split(host).join(origin);
  }
  return out;
}

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wordCount(text) {
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function fitWords(parts, min = 40, max = 60) {
  const clean = parts.map((p) => String(p).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const picked = [];
  for (const part of clean) {
    const trial = [...picked, part].join(' ');
    if (wordCount(trial) <= max) picked.push(part);
  }
  let text = picked.join(' ');
  if (wordCount(text) < min) {
    for (const part of clean) {
      if (picked.includes(part)) continue;
      const trial = `${text} ${part}`.trim();
      if (wordCount(trial) <= max) {
        picked.push(part);
        text = trial;
      }
      if (wordCount(text) >= min) break;
    }
  }
  return text;
}

export function formatAsOf(asOf, lang = 'en') {
  const m = String(asOf).match(/^(\d{4})-Q(\d)$/i);
  if (!m) return asOf;
  return (lang === 'fr' || lang === 'es') ? `T${m[2]} ${m[1]}` : `Q${m[2]} ${m[1]}`;
}

export function formatPct(pct) {
  const v = Number(pct) * 100;
  let s;
  if (Number.isInteger(v)) s = String(v);
  else s = String(Math.round(v * 1000) / 1000).replace(/\.?0+$/, '');
  return `${s}%`;
}

export function formatEur(n) {
  const rounded = Math.round(Number(n));
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const withCommas = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}€${withCommas}`;
}

/** German number formats: "0,1 %", "1.000 €". */
export function formatPctDe(pct) {
  return formatPct(pct).replace('.', ',').replace('%', ' %');
}

export function formatEurDe(n) {
  const rounded = Math.round(Number(n));
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
}

/** Slovak number formats: "0,1 %", "1 000 €" (non-breaking spaces). */
export function formatPctSk(pct) {
  return formatPct(pct).replace('.', ',').replace('%', '\u00a0%');
}

export function formatEurSk(n) {
  const rounded = Math.round(Number(n));
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0€`;
}

const METHOD_SK = {
  'Auto-Invest plan': 'Plán Auto-Invest',
  'Spot trading': 'Spotové obchodovanie',
  'Pro trading': 'Pro trading',
  'Automated DCA bot': 'Automatizovaný DCA bot'
};
/** Slovak label for a fee-schedule method (same terms as the Stacking module). */
export function methodSk(method) {
  return METHOD_SK[method] || method;
}

const METHOD_CS = {
  'Auto-Invest plan': 'Plán Auto-Invest',
  'Spot trading': 'Spotové obchodování',
  'Pro trading': 'Pro trading',
  'Automated DCA bot': 'Automatizovaný DCA bot'
};
/** Czech label for a fee-schedule method (same terms as the Stacking module). Numbers use the Slovak formatters (same format). */
export function methodCs(method) {
  return METHOD_CS[method] || method;
}

/** Polish numbers: "0,1%" (no space, like the pl site pages); amounts use formatEurSk ("1 000 €"). */
export function formatPctPl(pct) {
  return formatPct(pct).replace('.', ',');
}

const METHOD_PL = {
  'Auto-Invest plan': 'Plan Auto-Invest',
  'Spot trading': 'Handel spot',
  'Pro trading': 'Handel Pro',
  'Automated DCA bot': 'Automatyczny bot DCA'
};
/** Polish label for a fee-schedule method (same terms as the Stacking module). */
export function methodPl(method) {
  return METHOD_PL[method] || method;
}

const METHOD_HU = {
  'Auto-Invest plan': 'Auto-Invest terv',
  'Spot trading': 'Spot kereskedés',
  'Pro trading': 'Pro kereskedés',
  'Automated DCA bot': 'Automatizált DCA-bot'
};
/** Hungarian label for a fee-schedule method; numbers use formatPctPl ("0,1%") and formatEurSk ("1 000 €"). */
export function methodHu(method) {
  return METHOD_HU[method] || method;
}

const METHOD_UK = {
  'Auto-Invest plan': 'План Auto-Invest',
  'Spot trading': 'Спотова торгівля',
  'Pro trading': 'Pro-торгівля',
  'Automated DCA bot': 'Автоматичний DCA-бот'
};
/** Ukrainian label for a fee-schedule method; numbers use formatPctPl ("0,1%") and formatEurSk ("1 000 €"). */
export function methodUk(method) {
  return METHOD_UK[method] || method;
}

const METHOD_RU = {
  'Auto-Invest plan': 'План Auto-Invest',
  'Spot trading': 'Спотовая торговля',
  'Pro trading': 'Pro-торговля',
  'Automated DCA bot': 'Автоматический DCA-бот'
};
/** Russian label for a fee-schedule method; numbers use formatPctPl ("0,1%") and formatEurSk ("1 000 €"). */
export function methodRu(method) {
  return METHOD_RU[method] || method;
}

const METHOD_FR = {
  'Auto-Invest plan': 'Plan Auto-Invest',
  'Spot trading': 'Trading au comptant',
  'Pro trading': 'Trading Pro',
  'Automated DCA bot': 'Bot DCA automatisé'
};
/** French label for a fee-schedule method; numbers use formatPctSk ("0,1 %") and formatEurSk ("1 000 €"). */
export function methodFr(method) {
  return METHOD_FR[method] || method;
}

/** French typography: non-breaking space before : ; ? ! % and inside « », and in "1 000 €". */
export function nbspFr(s) {
  return String(s)
    .replace(/ ([:;?!%»])/g, '\u00a0$1')
    .replace(/« /g, '«\u00a0')
    .replace(/(\d) (\d{3})/g, '$1\u00a0$2')
    .replace(/(\d) €/g, '$1\u00a0€');
}

const METHOD_ES = {
  'Auto-Invest plan': 'Plan Auto-Invest',
  'Spot trading': 'Trading al contado',
  'Pro trading': 'Trading Pro',
  'Automated DCA bot': 'Bot de DCA automatizado'
};
/** Spanish label for a fee-schedule method; percentages use formatPctSk ("0,1 %"). */
export function methodEs(method) {
  return METHOD_ES[method] || method;
}

/** Spanish amounts: "1000 €" (4 digits ungrouped, CLDR es), "20.000 €". */
export function formatEurEs(n) {
  const rounded = Math.round(Number(n));
  const sign = rounded < 0 ? '-' : '';
  const a = String(Math.abs(rounded));
  const grouped = a.length > 4 ? a.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : a;
  return `${sign}${grouped}\u00a0€`;
}

/** Spanish typography: non-breaking space before % and €. */
export function nbspEs(s) {
  return String(s).replace(/(\d) ([%€])/g, '$1\u00a0$2');
}

const METHOD_DE = {
  'Auto-Invest plan': 'Auto-Invest-Plan',
  'Spot trading': 'Spot-Handel',
  'Pro trading': 'Pro-Handel',
  'Automated DCA bot': 'Automatischer DCA-Bot'
};
/** German label for a fee-schedule method (falls back to the source label). */
export function methodDe(method) {
  return METHOD_DE[method] || method;
}

export function depthOf(relPath) {
  const trimmed = relPath.replace(/^\//, '').replace(/\/index\.html$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (relPath.endsWith('/index.html') || relPath.endsWith('/')) return parts.length;
  return Math.max(0, parts.length - 1);
}

export function toRoot(relPath, target) {
  const depth = depthOf(relPath);
  const prefix = depth === 0 ? './' : '../'.repeat(depth);
  return prefix + String(target).replace(/^\//, '');
}

export function canonicalPath(relFile) {
  if (relFile.endsWith('/index.html')) {
    return '/' + relFile.slice(0, -'index.html'.length);
  }
  return '/' + relFile;
}

export function jsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

export function assertTitle(title) {
  const n = title.length;
  if (n < 12 || n > 60) {
    throw new Error(`Title length ${n} out of range (12–60): ${title}`);
  }
  return title;
}

export function assertDescription(desc) {
  const n = desc.length;
  if (n < 50 || n > 155) {
    throw new Error(`Meta description length ${n} out of range (50–155): ${desc}`);
  }
  return desc;
}
