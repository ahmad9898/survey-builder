import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const captured = [];
page.on('console', async (msg) => {
  if (!msg.text().startsWith('assessmentCallback')) return;
  const args = msg.args();
  const values = await Promise.all(args.map((a) => a.jsonValue().catch(() => '<unserializable>')));
  captured.push(values);
});

await page.goto('http://localhost:5198/', { waitUntil: 'networkidle' });
await page.click('text=New survey');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500);

const currentUrl = page.url();
const surveyId = currentUrl.split('/builder/')[1];
console.log('survey id:', surveyId);

await page.fill('input[value="Untitled survey"]', 'E2E Trigger Test');
const typeInput = page.locator('input').nth(1);
await typeInput.fill('Feedback');
await page.waitForTimeout(300);

await page.click('text=Add question');
await page.waitForTimeout(300);
await page.click('text=Single Choice');
await page.waitForTimeout(500);

await page.getByText('Trigger immediate callback').click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/Users/ahmadkhalil/survey-builder/shot-e2e-builder2.png' });

await page.click('text=Publish');
await page.waitForTimeout(800);

await page.goto(`http://localhost:5198/run/${surveyId}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

captured.length = 0;
await page.locator('text=Option 1').first().click();
await page.waitForTimeout(400);
console.log('calls right after selecting the option (should be 0 -- no page advance yet):', captured.length);

await page.click('button:has-text("Submit")');
await page.waitForTimeout(600);
console.log('calls after Submit (should be 1, with the trigger entry):', captured.length);
console.log(JSON.stringify(captured, null, 2));

await browser.close();
