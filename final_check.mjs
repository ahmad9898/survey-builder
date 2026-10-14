import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });

await page.goto('http://localhost:5183/');
await page.click('text=New survey');
await page.waitForURL(/\/builder\//);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/final-builder-view.png' });

await page.click('button:has-text("Preview")');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/final-preview.png' });

console.log('ERRORS:', JSON.stringify(errors, null, 2));
await browser.close();
