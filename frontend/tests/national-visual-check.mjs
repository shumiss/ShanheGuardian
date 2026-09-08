import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const outputDir = resolve(process.cwd(), '..', 'work', 'qa-national');
mkdirSync(outputDir, { recursive: true });
const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const visitor = await context.newPage();
  await visitor.goto('http://127.0.0.1:5173/?qa=national', { waitUntil: 'domcontentloaded' });
  await visitor.getByRole('button', { name: '川西探索', exact: true }).click();
  await visitor.waitForFunction(() => {
    const session = JSON.parse(localStorage.getItem('qianxing-shared-route-v1'));
    return session?.route?.destinationRegion === '阿坝' && session.route.sites?.length >= 6;
  }, null, { timeout: 90000 });
  await visitor.locator('.nearby-services').waitFor({ timeout: 90000 });
  await visitor.locator('#journey').scrollIntoViewIfNeeded();
  await visitor.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.itinerary-list > button')];
    const images = [...document.querySelectorAll('.itinerary-list img')];
    const map = document.querySelector('.mini-map > img');
    return cards.length > 0
      && images.length === cards.length
      && images.every(image => image.complete && image.naturalWidth > 0)
      && map?.complete
      && map.naturalWidth > 0;
  }, null, { timeout: 90000 });
  const session = await visitor.evaluate(() => JSON.parse(localStorage.getItem('qianxing-shared-route-v1')));
  assert.equal(session.route.destinationRegion, '阿坝');
  assert.match(session.request.request, /阿坝|九寨沟/);
  assert.doesNotMatch(session.request.request, /青岩|黄果树|织金洞/);
  assert.ok(session.route.sites.some(site => /九寨沟/.test(site.name)));
  assert.ok(session.route.sites.every(site => !/贵阳|安顺|铜仁|黔南|黔东南/.test(site.city)));
  await visitor.locator('#journey').screenshot({ path: resolve(outputDir, 'visitor-route.png') });
  const proof = visitor.locator('.route-proof');
  await proof.locator('summary').click();
  assert.equal(await proof.locator('.strategy-switch button').count(), 3);
  await proof.getByRole('button', { name: '安全优先', exact: true }).click();
  await visitor.waitForFunction(() => {
    const updated = JSON.parse(localStorage.getItem('qianxing-shared-route-v1'));
    return updated?.route?.optimization?.selectedMode === 'safety-first';
  }, null, { timeout: 90000 });
  await proof.getByRole('button', { name: '降雨情景推演', exact: true }).click();
  await proof.locator('.weather-scenario > div').waitFor({ timeout: 90000 });
  assert.match(await proof.locator('.weather-scenario > div').innerText(), /平均风险/);
  await proof.screenshot({ path: resolve(outputDir, 'optimization-proof.png') });
  await visitor.locator('#top').scrollIntoViewIfNeeded();
  await visitor.screenshot({ path: resolve(outputDir, 'visitor-top.png') });

  const operations = await context.newPage();
  await operations.goto('http://127.0.0.1:5173/?mode=demo&qa=national', { waitUntil: 'domcontentloaded' });
  await operations.locator('.workspace-nav').waitFor();
  await operations.waitForFunction(() => document.querySelector('.route-narrative')?.textContent?.includes('九寨沟'), null, { timeout: 60000 });
  await operations.waitForFunction(() => {
    const map = document.querySelector('.map-image');
    return map?.complete && map.naturalWidth > 0;
  }, null, { timeout: 60000 });
  assert.equal(await operations.getByLabel('旅行区域').inputValue(), '阿坝');
  await operations.screenshot({ path: resolve(outputDir, 'operations.png') });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto('http://127.0.0.1:5173/?qa=national-mobile', { waitUntil: 'domcontentloaded' });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile overflow is ${overflow}px`);
  await mobile.screenshot({ path: resolve(outputDir, 'visitor-mobile.png'), fullPage: false });

  console.log(outputDir);
} finally {
  await browser.close();
}
