// Exit 0 when now (Europe/Bratislava) is a US CPI / jobs report day and the
// local hour is 15, else exit 78 (skip). Used by .github/workflows/macro-intraday.yml,
// whose two UTC crons (13:15 and 14:15) cover CEST and CET: one of them is 15:15
// in Bratislava on any given day.  FORCE=1 skips the check (manual runs).
import { readFileSync } from 'node:fs';
const M = JSON.parse(readFileSync(new URL('./meetings.json', import.meta.url)));
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const day = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Bratislava' });
const hour = +now.toLocaleTimeString('en-GB', { timeZone: 'Europe/Bratislava', hour: '2-digit', hour12: false });
const ev = (M.events || []).find((e) => e.date === day && e.impact === 'high' && /^(cpi|nfp)$/.test(e.kind));
if (process.env.FORCE === '1') { console.log('forced'); process.exit(0); }
if (ev && hour === 15) { console.log(`release day: ${ev.title} ${ev.time}`); process.exit(0); }
console.log(`skip: ${day} ${hour}h Bratislava, ${ev ? ev.title + ' today' : 'no CPI/NFP today'}`);
process.exit(78);
