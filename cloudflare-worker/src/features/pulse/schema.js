// The Brief Pulse document (gh-pages news/news-pulse.json) and the rules a
// publish must pass. Pure: no KV, no Request; `now` is a parameter.
// Size is checked by the PUT handler, not here.

export const PULSE_MAX_BYTES = 16 * 1024;
const PULSE_FUTURE_MS = 36 * 60 * 60 * 1000;
const PULSE_TAGS = ['ETF', 'Fed', 'Policy', 'Mining', 'Security'];
const PULSE_BTC_RE = /bitcoin|\bbtc\b/i;
const PULSE_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function parsePulseIso(value) {
  if (typeof value !== 'string' || !PULSE_ISO_RE.test(value)) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  // Reject calendar overflow (2026-02-31 parses as March on some engines,
  // as NaN on others). Round-trip the UTC timestamp through ISO.
  if (new Date(t).toISOString().slice(0, 19) !== value.slice(0, 19)) return null;
  return t;
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('https://')) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function pulseItemErrors(it, i, prefix) {
  const errors = [];
  const label = `${prefix}[${i}]`;
  if (!it || typeof it !== 'object' || Array.isArray(it)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  if (typeof it.title !== 'string' || it.title.length === 0 || it.title.length > 120) {
    errors.push(`${label}.title must be a non-empty string of at most 120 characters`);
  }
  if (typeof it.source !== 'string' || it.source.length === 0) {
    errors.push(`${label}.source must be a non-empty string`);
  }
  if (!isHttpsUrl(it.url)) {
    errors.push(`${label}.url must be an https URL`);
  }
  if (!PULSE_TAGS.includes(it.tag)) {
    errors.push(`${label}.tag must be one of ${PULSE_TAGS.join(', ')}`);
  }
  if (parsePulseIso(it.published) == null) {
    errors.push(`${label}.published must be an ISO-8601 UTC timestamp`);
  }
  return errors;
}

// Every rule the document breaks, as readable strings (empty = valid).
export function pulseErrors(data, now = Date.now()) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('body must be a JSON object');
    return errors;
  }

  const updated = parsePulseIso(data.updated);
  if (updated == null) {
    errors.push('updated must be an ISO-8601 UTC timestamp (YYYY-MM-DDTHH:mm:ssZ)');
  } else if (updated > now + PULSE_FUTURE_MS) {
    errors.push('updated must not be more than 36 hours in the future');
  }

  const market = data.market;
  if (!market || typeof market !== 'object' || Array.isArray(market)) {
    errors.push('market must be an object');
  } else {
    if (typeof market.btc_usd !== 'number' || !Number.isFinite(market.btc_usd)) {
      errors.push('market.btc_usd must be a finite number');
    }
    if (typeof market.change_24h_pct !== 'number' || !Number.isFinite(market.change_24h_pct)) {
      errors.push('market.change_24h_pct must be a finite number');
    }
    if (typeof market.fees !== 'string' || market.fees.length === 0) {
      errors.push('market.fees must be a non-empty string');
    }
    if (typeof market.fee_sat_vb !== 'number' || !Number.isFinite(market.fee_sat_vb)) {
      errors.push('market.fee_sat_vb must be a finite number');
    }
    if (typeof market.sources !== 'string' || market.sources.length === 0) {
      errors.push('market.sources must be a non-empty string');
    }
  }

  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 3) {
    errors.push('items must be an array of 1 to 3 pulse items');
  }
  const items = Array.isArray(data.items) ? data.items : [];
  items.forEach((it, i) => {
    errors.push(...pulseItemErrors(it, i, 'items'));
    if (it && typeof it === 'object' && !Array.isArray(it)) {
      if (typeof it.excerpt !== 'string') {
        errors.push(`items[${i}].excerpt must be a string`);
      }
      const title = typeof it.title === 'string' ? it.title : '';
      const excerpt = typeof it.excerpt === 'string' ? it.excerpt : '';
      if ((title || excerpt) && !PULSE_BTC_RE.test(`${title} ${excerpt}`)) {
        errors.push(`items[${i}] title+excerpt must mention Bitcoin or BTC`);
      }
    }
  });

  const archive = data.archive;
  const yesterday = archive && !Array.isArray(archive) ? archive.items : undefined;
  if (!archive || typeof archive !== 'object' || Array.isArray(archive) || !Array.isArray(yesterday) || yesterday.length > 2) {
    errors.push('archive.items (yesterday) must be an array of at most 2');
  } else {
    yesterday.forEach((it, i) => {
      errors.push(...pulseItemErrors(it, i, 'archive.items'));
    });
  }

  if (data.what_moved != null) {
    if (typeof data.what_moved !== 'string' || data.what_moved.length > 300) {
      errors.push('what_moved must be a string of at most 300 characters');
    }
  }

  if (data.fear_greed != null) {
    const fg = data.fear_greed;
    const value = fg && typeof fg === 'object' ? fg.value : undefined;
    if (!fg || typeof fg !== 'object' || Array.isArray(fg) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      errors.push('fear_greed.value must be a number from 0 to 100');
    }
  }

  if (data.dominance != null) {
    const dom = data.dominance;
    if (!dom || typeof dom !== 'object' || Array.isArray(dom) || typeof dom.btc_pct !== 'number' || !Number.isFinite(dom.btc_pct)) {
      errors.push('dominance.btc_pct must be a finite number');
    }
  }

  if (data.quick_media != null) {
    const qm = data.quick_media;
    if (!qm || typeof qm !== 'object' || Array.isArray(qm) || typeof qm.title !== 'string' || !isHttpsUrl(qm.url)) {
      errors.push('quick_media must have a title and an https url');
    }
  }

  if (data.feed != null && typeof data.feed !== 'string') {
    errors.push('feed must be a string or null');
  }

  return errors;
}
