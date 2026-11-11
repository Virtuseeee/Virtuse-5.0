// The paid Verdict report as an A4 PDF, attached to the purchase
// confirmation email (handler.js). Built from the same reportView() the page
// shows (for Verdict Lite: liteReportView()), so the PDF never says more or
// less than the paid report.
//
// pdf-lib + fontkit with Inter (OFL), subset to Latin, Latin Extended
// (Slovak, Czech) and Cyrillic in assets/fonts/; build.mjs inlines the two
// font files into src/generated/fonts.js. Characters outside the subset are
// dropped instead of printing an empty box.

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const W = 595.28, H = 841.89, M = 48, CW = W - 2 * M, FOOT = 40;
const C = {
  ink: rgb(0.07, 0.08, 0.1), muted: rgb(0.38, 0.4, 0.44), line: rgb(0.88, 0.89, 0.91),
  track: rgb(0.93, 0.94, 0.95), blue: rgb(0.17, 0.38, 0.75), sky: rgb(0.37, 0.68, 0.87),
  low: rgb(0.85, 0.36, 0.12), mid: rgb(0.15, 0.39, 0.92), high: rgb(0.06, 0.56, 0.49), tint: rgb(0.96, 0.97, 0.99),
};
const pointsColor = (p) => (p >= 7 ? C.high : p >= 4 ? C.mid : C.low);

const T = {
  en: {
    doc: 'Verdict · full report', date: 'Date', order: 'Order', score: 'Plan completeness score',
    steps: 'Your next three steps', tool: 'Tool', signals: 'All 10 signals', todo: 'To do',
    gaps: 'Questions you have not answered yet', none: 'None: every question the plan raises is answered.',
    plan: 'Step plan: signals under 7 points', planNone: 'Every signal has 7 points or more.',
    legal: 'Legal notes', pill: { ready: 'Ready', almost: 'Almost', basics: 'Basics first', redflag: 'Stop' },
  },
  sk: {
    doc: 'Verdict · celý report', date: 'Dátum', order: 'Objednávka', score: 'Skóre úplnosti plánu',
    steps: 'Vaše ďalšie tri kroky', tool: 'Nástroj', signals: 'Všetkých 10 oblastí', todo: 'Čo urobiť',
    gaps: 'Otázky, na ktoré zatiaľ nemáte odpoveď', none: 'Žiadne: plán odpovedá na všetky otázky, ktoré otvára.',
    plan: 'Plán krokov: oblasti pod 7 bodov', planNone: 'Všetky oblasti majú 7 bodov alebo viac.',
    legal: 'Právne poznámky', pill: { ready: 'Pripravené', almost: 'Takmer', basics: 'Najprv základy', redflag: 'Stop' },
  },
  ru: {
    doc: 'Вердикт · полный отчёт', date: 'Дата', order: 'Заказ', score: 'Оценка полноты плана',
    steps: 'Ваши следующие три шага', tool: 'Инструмент', signals: 'Все 10 областей', todo: 'Что сделать',
    gaps: 'Вопросы, на которые у вас пока нет ответа', none: 'Нет: план отвечает на все вопросы, которые поднимает.',
    plan: 'План шагов: области ниже 7 баллов', planNone: 'Во всех областях 7 баллов или больше.',
    legal: 'Юридические примечания', pill: { ready: 'Готово', almost: 'Почти', basics: 'Сначала основы', redflag: 'Стоп' },
  },
};

// virtuse.com URL of a tool, as printed text (no UTM, no scheme).
export function toolUrl(t, lang) {
  if (!t || !t.page) return '';
  const q = new URLSearchParams(t.params || {}).toString();
  const path = t.page.startsWith('/') ? t.page : (lang === 'en' ? '/' : `/${lang}/`) + t.page;
  return 'virtuse.com' + path + (q ? `?${q}` : '');
}

export async function renderReportPdf(r, { lang = 'en', fonts, date = new Date(), order = '', operator = '' }) {
  const L = T[lang] ? lang : 'en';
  const S = T[L];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fonts.regular, { subset: false });
  const bold = await doc.embedFont(fonts.bold, { subset: false });
  const known = new Set(reg.getCharacterSet());
  const clean = (s) => Array.from(String(s ?? '').replace(/\s+/g, ' ').trim()).filter((ch) => known.has(ch.codePointAt(0))).join('');
  doc.setTitle(`Virtuse ${S.doc}`);
  doc.setAuthor('Virtuse Wealth Management, a.s.');
  doc.setLanguage(L);

  let page, y;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
    // Header: the V mark (same two shapes as the logo), name, document title.
    page.drawSvgPath('M30 0h220l250 483H280Z', { x: M, y: y + 4, scale: 0.034, color: C.sky });
    page.drawSvgPath('M510 0h245L645 205H400Z', { x: M, y: y + 4, scale: 0.034, color: C.blue });
    page.drawText('Virtuse', { x: M + 31, y: y - 10, size: 12, font: bold, color: C.ink });
    const d = clean(S.doc);
    page.drawText(d, { x: W - M - reg.widthOfTextAtSize(d, 9), y: y - 9, size: 9, font: reg, color: C.muted });
    y -= 26;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: C.line });
    y -= 22;
  };
  const ensure = (h) => { if (y - h < M + FOOT) newPage(); };

  const lines = (text, font, size, width) => {
    const out = [];
    for (const word of clean(text).split(' ')) {
      if (!word) continue;
      const cur = out.length ? out[out.length - 1] : null;
      const next = cur ? `${cur} ${word}` : word;
      if (cur !== null && font.widthOfTextAtSize(next, size) <= width) out[out.length - 1] = next;
      else out.push(word);
    }
    return out;
  };
  const para = (text, { font = reg, size = 10, color = C.ink, x = M, width = CW, gap = 4, lead = 1.38 } = {}) => {
    const ls = lines(text, font, size, width);
    for (const l of ls) {
      ensure(size * lead);
      page.drawText(l, { x, y: y - size, size, font, color });
      y -= size * lead;
    }
    y -= gap;
  };
  const heading = (text) => {
    ensure(60);
    y -= 8;
    para(text, { font: bold, size: 14, gap: 8 });
  };

  // Footer on every page, then the bytes.
  const finish = () => {
    const pages = doc.getPages();
    pages.forEach((p, k) => {
      const left = '© 2018–2026 Virtuse Wealth Management, a.s.';
      const right = `${k + 1} / ${pages.length}`;
      p.drawText(left, { x: M, y: 26, size: 7.5, font: reg, color: C.muted });
      p.drawText(right, { x: W - M - reg.widthOfTextAtSize(right, 7.5), y: 26, size: 7.5, font: reg, color: C.muted });
    });
    return doc.save({ useObjectStreams: true });
  };

  // One table row: columns by share of the content width, each wrapped.
  const row = (cells, widths, { font = reg, size = 9, color = C.ink, boldFirst = false } = {}) => {
    const cols = cells.map((text, k) => lines(text, boldFirst && k === 0 ? bold : font, size, CW * widths[k] - 8));
    const h = Math.max(...cols.map((c) => c.length), 1) * size * 1.38 + 6;
    ensure(h + 2);
    let x = M;
    cols.forEach((ls, k) => {
      ls.forEach((l, i) => page.drawText(l, { x, y: y - size - i * size * 1.38, size, font: boldFirst && k === 0 ? bold : font, color }));
      x += CW * widths[k];
    });
    y -= h;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.4, color: C.line });
    y -= 2;
  };

  const printed = (href) => `virtuse.com${href}`;

  const liteBody = () => {
    const ds = date.toLocaleDateString(L === 'sk' ? 'sk-SK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' });
    para(`${S.date}: ${ds}${order ? ` · ${S.order}: ${order}` : ''}`, { size: 9, color: C.muted, gap: 12 });
    para(r.title, { font: bold, size: 22, gap: 4, lead: 1.2 });
    y -= 8;
    const score = String(r.score);
    page.drawText(score, { x: M, y: y - 44, size: 48, font: bold, color: C.ink });
    const sw = bold.widthOfTextAtSize(score, 48);
    page.drawText('/100', { x: M + sw + 4, y: y - 44, size: 16, font: reg, color: C.muted });
    const pill = clean(r.pill);
    const pw = bold.widthOfTextAtSize(pill, 9) + 16;
    page.drawRectangle({ x: M + sw + 58, y: y - 40, width: pw, height: 18, color: C.tint, borderColor: C.line, borderWidth: 0.6 });
    page.drawText(pill, { x: M + sw + 66, y: y - 34, size: 9, font: bold, color: C.blue });
    y -= 58;
    para(r.gradeLine, { size: 9, color: C.muted, gap: 3 });
    para(r.scale.map((b, k) => `${b}: ${r.scaleRange[k]}`).join('  ·  '), { size: 8.5, color: C.muted, gap: 12 });
    r.nums.forEach(([k, v]) => row([k, v], [0.4, 0.6], { boldFirst: false }));
    y -= 6;

    heading(r.h.summaryK);
    r.summary.forEach((t) => para(t, { size: 10.5, gap: 8 }));

    // The area map and the two groups, as on the Verdict page.
    const M2 = r.areaMap;
    ensure(330); // the heading, its text and the map stay on one page
    heading(`${M2.h[0]} ${M2.h[1]}`);
    para(`${M2.lead} ${M2.how}`, { size: 9.5, color: C.muted, gap: 4 });
    para(M2.sum, { font: bold, size: 9.5, gap: 8 });
    ensure(236);
    const cx = W / 2;
    const cy = y - 112;
    const R = 80;
    const pt = (k, v) => { const t = (-90 + k * 60) * (Math.PI / 180); return [(R * (v / 10)) * Math.cos(t), (R * (v / 10)) * Math.sin(t)]; };
    const poly = (vals) => `${vals.map((v, k) => { const [px, py] = pt(k, v); return `${k ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`; }).join(' ')} Z`;
    [2.5, 5, 7.5, 10].forEach((v) => page.drawSvgPath(poly([v, v, v, v, v, v]), { x: cx, y: cy, borderColor: C.line, borderWidth: 0.6 }));
    r.areas.forEach((_, k) => { const [px, py] = pt(k, 10); page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + px, y: cy - py }, thickness: 0.4, color: C.line }); });
    page.drawSvgPath(poly(r.areas.map((a) => a.points)), { x: cx, y: cy, color: C.sky, opacity: 0.25, borderColor: C.blue, borderWidth: 1.4 });
    r.areas.forEach((a, k) => {
      const [px, py] = pt(k, a.points);
      page.drawCircle({ x: cx + px, y: cy - py, size: 2.6, color: a.weak ? C.low : C.blue });
      const [lx, ly] = pt(k, 12.4);
      const label = `${clean(a.short)} ${a.points}`;
      const lw = bold.widthOfTextAtSize(label, 9);
      const tx = cx + lx + (k === 0 || k === 3 ? -lw / 2 : k < 3 ? 0 : -lw);
      page.drawText(label, { x: tx, y: cy - ly - 3, size: 9, font: bold, color: a.weak ? C.low : C.ink });
    });
    y -= 232;
    for (const g of M2.groups) {
      ensure(70);
      para(`${g.k}: ${g.h}`, { font: bold, size: 11, gap: 6 });
      for (const id of g.ids) {
        const a = r.areas.find((x) => x.id === id);
        ensure(58);
        const pts = `${a.points}/10`;
        page.drawText(clean(a.title), { x: M, y: y - 11, size: 11, font: bold, color: a.weak ? C.low : C.ink });
        page.drawText(pts, { x: W - M - bold.widthOfTextAtSize(pts, 11), y: y - 11, size: 11, font: bold, color: pointsColor(a.points) });
        y -= 17;
        page.drawRectangle({ x: M, y: y - 4, width: CW, height: 4, color: C.track });
        page.drawRectangle({ x: M, y: y - 4, width: Math.max(2, (CW * a.points) / 10), height: 4, color: pointsColor(a.points) });
        y -= 10;
        para(a.q, { size: 8.5, color: C.muted, gap: 1 });
        para(a.why, { size: 9.5, gap: 9 });
      }
    }

    // Two result boxes side by side, for the retirement scenario and the tax example.
    const valueBoxes = (b) => {
      ensure(90);
      para(b.k, { font: bold, size: 9.5, gap: 4 });
      const half = (CW - 10) / 2;
      b.vals.forEach(([lab, val], i) => {
        const x = M + i * (half + 10);
        page.drawRectangle({ x, y: y - 52, width: half, height: 52, color: C.tint, borderColor: C.line, borderWidth: 0.6 });
        page.drawText(clean(lab), { x: x + 10, y: y - 18, size: 8.5, font: reg, color: C.muted });
        page.drawText(clean(val), { x: x + 10, y: y - 42, size: 18, font: bold, color: C.ink });
      });
      y -= 60;
      if (b.sub) para(b.sub, { size: 9, color: C.muted, gap: 8 });
    };

    const table = (head, rows, widths) => {
      if (head) row(head, widths, { font: bold });
      rows.forEach((x) => row(x, widths));
      y -= 6;
    };
    // Label, value, and on key lines how the value is worked out.
    const steps = (rows) => rows.forEach(([lab, val, strong, how]) => row([how ? `${lab} (${how})` : lab, val], [0.68, 0.32], { font: strong ? bold : reg }));
    const bigValue = (lab, val) => {
      ensure(70);
      page.drawRectangle({ x: M, y: y - 58, width: CW, height: 58, color: C.tint, borderColor: C.line, borderWidth: 0.6 });
      page.drawText(clean(lab), { x: M + 12, y: y - 19, size: 9.5, font: reg, color: C.muted });
      page.drawText(clean(val), { x: M + 12, y: y - 47, size: 24, font: bold, color: C.blue });
      y -= 66;
    };

    if (r.worth) {
      heading(r.worth.h);
      table(null, r.worth.rows, [0.6, 0.4]);
      if (r.worth.note) para(r.worth.note, { size: 8.5, color: C.muted, gap: 6 });
    }

    heading(r.h.fallK);
    r.fall.forEach((t) => para(t, { size: 10, gap: 6 }));
    if (r.fallTable) {
      table(r.fallTable.head, r.fallTable.rows, [0.2, 0.24, 0.28, 0.28]);
      para(r.fallTable.note, { size: 8.5, color: C.muted, gap: 6 });
    }

    heading(r.reserveBox.h);
    para(r.reserveBox.text, { size: 10, gap: 6 });

    heading(r.retireBox.h);
    if (r.retireBox.rows.length) table(null, r.retireBox.rows, [0.68, 0.32]);
    if (r.retireBox.plan) {
      const plan = r.retireBox.plan;
      bigValue(plan.label, plan.value);
      table(null, plan.rows, [0.68, 0.32]);
      if (plan.scenario) valueBoxes(plan.scenario);
    }
    para(r.retireBox.text, { size: 10, gap: 4 });
    if (r.retireBox.note) para(r.retireBox.note, { size: 8.5, color: C.muted, gap: 6 });

    heading(r.h.custody);
    para(r.custody.yours, { size: 10, gap: 8 });
    row(r.custody.head, [0.28, 0.36, 0.36], { font: bold });
    r.custody.rows.forEach((x) => row(x, [0.28, 0.36, 0.36], { boldFirst: true }));
    y -= 4;

    heading(`${r.h.taxK}: ${r.h.tax}`);
    if (r.tax.text) para(r.tax.text, { size: 10, gap: 6 });
    r.tax.rows.forEach((x) => row(x, [0.24, 0.76], { boldFirst: true }));
    if (r.tax.note) { y -= 4; para(r.tax.note, { size: 8.5, color: C.muted, gap: 6 }); }
    const ex = r.taxExample;
    if (ex) {
      ensure(90); // keep the title with its table
      if (ex.title) para(ex.title, { font: bold, size: 10, gap: 4 });
      steps(ex.kv);
      if (ex.bands) { y -= 4; table(ex.bands.head, [...ex.bands.rows, ex.bands.foot], [0.4, 0.22, 0.16, 0.22]); }
      steps(ex.after);
      y -= 6;
      if (ex.hero) valueBoxes(ex.hero);
      if (ex.text) para(ex.text, { size: 10, gap: 6 });
      if (ex.scale) para(ex.scale, { size: 10, gap: 6 });
      if (ex.rows.length) table(ex.head, ex.rows, ex.head.map(() => 1 / ex.head.length));
      ex.dates.forEach((t) => para(t, { size: 10, gap: 4 }));
      if (ex.note) para(ex.note, { size: 8.5, color: C.muted, gap: 6 });
    }

    if (r.fees) {
      heading(r.fees.h);
      const w = r.fees.head.length === 4 ? [0.16, 0.2, 0.4, 0.24] : [0.2, 0.28, 0.52];
      table(r.fees.head, r.fees.rows, w);
      para(r.fees.note, { size: 8.5, color: C.muted, gap: 6 });
    }

    const points = (list) => list.forEach((x, k) => {
      ensure(40);
      para(`${k + 1}. ${x.title}`, { font: bold, size: 10, gap: 1 });
      para(x.text, { size: 9.5, color: C.muted, gap: 6 });
    });
    heading(r.h.wrong);
    points(r.risks);
    heading(r.h.solid);
    if (r.solid.length) points(r.solid); else para(r.solidNone, { size: 10 });

    heading(r.h.plan);
    for (const [k, s] of r.steps.entries()) {
      ensure(60);
      const top = y;
      const n = String(k + 1);
      page.drawCircle({ x: M + 9, y: y - 9, size: 9, color: C.blue });
      page.drawText(n, { x: M + 9 - bold.widthOfTextAtSize(n, 9) / 2, y: y - 12, size: 9, font: bold, color: rgb(1, 1, 1) });
      para(s.title, { font: bold, size: 10.5, x: M + 28, width: CW - 28, gap: 2 });
      para(s.text, { size: 9.5, color: C.muted, x: M + 28, width: CW - 28, gap: 2 });
      if (s.tool) para(`${S.tool}: ${s.tool.name} · ${printed(s.tool.href)}`, { size: 9, color: C.blue, x: M + 28, width: CW - 28, gap: 2 });
      y = Math.min(y, top - 22) - 8;
    }

    if (r.partners) {
    heading(r.partners.h);
    para(r.partners.intro, { size: 9, color: C.muted, gap: 8 });
    for (const g of r.partners.groups) {
      ensure(70);
      para(g.title, { font: bold, size: 12, gap: 2 });
      if (g.note) para(g.note, { size: 9, color: C.muted, gap: 5 });
      if (g.empty) para(g.empty, { size: 9.5, gap: 4 });
      for (const p of g.list) {
        ensure(60);
        para(p.name, { font: bold, size: 11, gap: 1 });
        para(p.tagline, { size: 9.5, gap: 1 });
        p.facts.forEach((t) => para(t, { size: 9, color: C.muted, gap: 1 }));
        para(p.site, { size: 9, color: C.blue, gap: 4 });
        if (p.steps.length) {
          para(p.stepsNote, { size: 8.5, color: C.muted, gap: 3 });
          p.steps.forEach((s, k) => para(`${k + 1}. ${s.title}: ${s.text}`, { size: 9, gap: 2 }));
        }
        y -= 5;
      }
      g.links.forEach((x) => para(`${x.name} · ${printed(x.href)}`, { size: 9, color: C.blue, gap: 2 }));
      y -= 8;
    }
    }

    heading(r.h.next);
    for (const x of r.next) {
      ensure(30);
      para(`${x.name}: ${x.small}`, { font: bold, size: 10, gap: 1 });
      para(printed(x.print || x.href), { size: 9, color: C.blue, gap: 6 });
    }

    heading(S.legal);
    if (r.withdraw) para(`${r.withdraw.text} ${r.withdraw.label}: ${printed(r.withdraw.href)}`, { size: 9.5, gap: 6 });
    for (const t of [r.legal, operator]) if (t) para(t, { size: 8.5, color: C.muted, gap: 5 });

    // Documents to fill in: each starts on a new page, so it prints on its own.
    const D = r.docs;
    const tall = (cells, widths, h) => {
      ensure(h + 2);
      let x = M;
      cells.forEach((text, k) => {
        lines(text, reg, 9, CW * widths[k] - 8).forEach((l, i) => page.drawText(l, { x, y: y - 11 - i * 12, size: 9, font: reg, color: C.ink }));
        x += CW * widths[k];
      });
      y -= h;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: C.line });
      y -= 2;
    };
    const blank = (label) => {
      ensure(46);
      para(label, { size: 9.5, color: C.muted, gap: 20 });
      page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: C.line });
      y -= 6;
    };

    newPage();
    para(D.h, { font: bold, size: 18, gap: 10 });
    heading(D.rule.title);
    para(D.rule.text, { size: 10, gap: 8 });
    row(D.rule.head, [0.24, 0.24, 0.52], { font: bold });
    D.rule.rows.forEach((x) => tall(x, [0.24, 0.24, 0.52], 54));
    y -= 14;
    heading(D.recovery.title);
    D.recovery.items.forEach((t) => {
      ensure(26);
      page.drawRectangle({ x: M, y: y - 11, width: 10, height: 10, borderColor: C.muted, borderWidth: 0.8 });
      para(t, { size: 10, x: M + 18, width: CW - 18, gap: 6 });
    });

    newPage();
    heading(D.record.title);
    para(D.record.text, { size: 10, gap: 8 });
    const rw = [0.13, 0.14, 0.14, 0.13, 0.11, 0.17, 0.18];
    row(D.record.columns, rw, { font: bold, size: 8.5 });
    for (let k = 0; k < 16; k++) tall(rw.map(() => ''), rw, 26);

    newPage();
    heading(D.heirs.title);
    para(D.heirs.warn, { font: bold, size: 10, color: C.low, gap: 12 });
    D.heirs.filled.forEach(([k, v]) => para(`${k}: ${v}`, { size: 10, gap: 6 }));
    y -= 6;
    D.heirs.fields.forEach(blank);
  };

  newPage();

  if (r.lite) {
    liteBody();
    return finish();
  }

  // Cover: meta line, score, level, why, score note.
  const ds = date.toLocaleDateString({ sk: 'sk-SK', ru: 'ru-RU' }[L] || 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bratislava' });
  para(`${S.date}: ${ds}${order ? ` · ${S.order}: ${order}` : ''}`, { size: 9, color: C.muted, gap: 14 });
  const score = r.score == null ? '–' : String(r.score);
  page.drawText(score, { x: M, y: y - 44, size: 48, font: bold, color: C.ink });
  const sw = bold.widthOfTextAtSize(score, 48);
  page.drawText('/100', { x: M + sw + 4, y: y - 44, size: 16, font: reg, color: C.muted });
  const pill = clean(S.pill[r.level?.id] || '');
  if (pill) {
    const pw = bold.widthOfTextAtSize(pill, 9) + 16;
    const px = M + sw + 58;
    page.drawRectangle({ x: px, y: y - 40, width: pw, height: 18, color: C.tint, borderColor: C.line, borderWidth: 0.6 });
    page.drawText(pill, { x: px + 8, y: y - 34, size: 9, font: bold, color: C.blue });
  }
  y -= 60;
  para(r.level?.headline, { font: bold, size: 16, gap: 6 });
  para(r.level?.why, { size: 11, gap: 6 });
  para(`${S.score}. ${r.level?.scoreLine || ''}`, { size: 8.5, color: C.muted, gap: 10 });

  // Three steps.
  heading(S.steps);
  for (const s of r.steps || []) {
    ensure(60);
    const top = y;
    page.drawCircle({ x: M + 9, y: y - 9, size: 9, color: C.blue });
    const n = String(s.n);
    page.drawText(n, { x: M + 9 - bold.widthOfTextAtSize(n, 9) / 2, y: y - 12, size: 9, font: bold, color: rgb(1, 1, 1) });
    para(s.action, { font: bold, size: 10.5, x: M + 28, width: CW - 28, gap: 2 });
    if (s.why) para(s.why, { size: 9.5, color: C.muted, x: M + 28, width: CW - 28, gap: 2 });
    if (s.tool) para(`${S.tool}: ${s.tool.name} · ${toolUrl(s.tool, L)}`, { size: 9, color: C.blue, x: M + 28, width: CW - 28, gap: 2 });
    y = Math.min(y, top - 22) - 8;
  }

  // All 10 signals.
  heading(S.signals);
  for (const a of r.areas || []) {
    ensure(70);
    const pts = `${a.points}/10`;
    page.drawText(clean(a.title), { x: M, y: y - 11, size: 11, font: bold, color: C.ink });
    page.drawText(pts, { x: W - M - bold.widthOfTextAtSize(pts, 11), y: y - 11, size: 11, font: bold, color: pointsColor(a.points) });
    y -= 17;
    page.drawRectangle({ x: M, y: y - 4, width: CW, height: 4, color: C.track });
    page.drawRectangle({ x: M, y: y - 4, width: Math.max(2, (CW * a.points) / 10), height: 4, color: pointsColor(a.points) });
    y -= 12;
    if (a.reason) para(a.reason, { size: 9.5, gap: 2 });
    para(`${S.todo}: ${a.todo}`, { size: 9.5, color: C.muted, gap: 10 });
  }

  // Open questions.
  heading(S.gaps);
  const gaps = r.missing || [];
  if (!gaps.length) para(S.none, { size: 10 });
  gaps.forEach((g, k) => para(`${k + 1}. ${g}`, { size: 10, gap: 4 }));

  // Step plan.
  heading(S.plan);
  const plan = r.plan || [];
  if (!plan.length) para(S.planNone, { size: 10 });
  for (const p of plan) {
    ensure(34);
    para(`${p.title} · ${p.points}/10`, { font: bold, size: 10, gap: 1 });
    if (p.tool) para(`${p.tool.name} · ${toolUrl(p.tool, L)}`, { size: 9, color: C.blue, gap: 6 });
  }

  // Legal notes.
  heading(S.legal);
  for (const t of [r.scoreNote, r.aiLabel, r.disclaimer, operator]) if (t) para(t, { size: 8.5, color: C.muted, gap: 5 });

  return finish();
}
