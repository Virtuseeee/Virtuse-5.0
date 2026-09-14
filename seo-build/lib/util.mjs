export const SITE_DIR_NAME = 'Kimi_Agent_Virtuse%20MiCA%20Partners';

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
  return lang === 'de' ? `Q${m[2]} ${m[1]}` : `Q${m[2]} ${m[1]}`;
}

export function formatPct(pct) {
  const v = Number(pct) * 100;
  let s;
  if (Number.isInteger(v)) s = String(v);
  else s = String(Math.round(v * 1000) / 1000).replace(/\.?0+$/, '');
  return `${s} %`;
}

export function formatEur(n) {
  const rounded = Math.round(Number(n));
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const withCommas = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}€${withCommas}`;
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
