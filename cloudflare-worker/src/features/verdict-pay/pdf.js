// The paid Verdict report as an A4 PDF, attached to the purchase
// confirmation email (handler.js). Built from the same reportView() the page
// shows, so the PDF never says more or less than the paid report.
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

  newPage();

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

  // Footer on every page.
  const pages = doc.getPages();
  pages.forEach((p, k) => {
    const left = '© 2018–2026 Virtuse Wealth Management, a.s.';
    const right = `${k + 1} / ${pages.length}`;
    p.drawText(left, { x: M, y: 26, size: 7.5, font: reg, color: C.muted });
    p.drawText(right, { x: W - M - reg.widthOfTextAtSize(right, 7.5), y: 26, size: 7.5, font: reg, color: C.muted });
  });

  return doc.save({ useObjectStreams: true });
}
