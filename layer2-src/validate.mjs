// Headless validation of the Bitcoin Concierge prototype.
// Walks the full conversation flow and screenshots each stage.
import { chromium } from 'playwright-core';

const BASE = process.env.PREVIEW_URL || 'http://localhost:3210/';
const errors = [];

const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'shots/01-welcome.png' });

const clickChip = async (label) => {
  const chip = page.locator('button', { hasText: label }).first();
  await chip.waitFor({ state: 'visible', timeout: 5000 });
  await chip.click();
  await page.waitForTimeout(1200); // wait for typing indicator + answer
};

// Full flow: loan, self-custody, larger amount
await clickChip('Bitcoin-backed loan');
await clickChip('Slovakia');
await clickChip('I already hold Bitcoin');
await clickChip('Self-custody');
await clickChip('€10,000 – 100,000');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/02-result-loan.png', fullPage: false });

// Restart and try a "new to bitcoin" buy flow
await page.getByRole('button', { name: /Start over/i }).first().click();
await page.waitForTimeout(400);
await clickChip('Buy Bitcoin');
await clickChip('Czechia');
await clickChip('New to Bitcoin');
await clickChip('Assisted custody');
await clickChip('< €1,000');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/03-result-buy.png' });

// Partner CTA should exist and point to virtuse.com
const cta = page.locator('a[href*="virtuse.com"]').first();
const ctaCount = await page.locator('a[href*="virtuse.com"]').count();

console.log('CTA links to virtuse.com:', ctaCount, await cta.getAttribute('href'));
console.log('JS errors:', errors.length ? errors : 'none');

await browser.close();
process.exit(errors.length ? 1 : 0);
