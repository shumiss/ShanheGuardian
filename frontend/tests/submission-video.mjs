import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const outputDir = resolve(process.cwd(), '..', 'work', 'submission-video');
mkdirSync(outputDir, { recursive: true });
const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outputDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

async function caption(title, detail, waitMs = 9000) {
  await page.evaluate(({ title, detail }) => {
    let panel = document.querySelector('#submission-caption');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'submission-caption';
      panel.style.cssText = [
        'position:fixed', 'z-index:2147483647', 'left:32px', 'bottom:28px',
        'max-width:720px', 'padding:14px 18px', 'border-radius:6px',
        'color:#fff', 'background:rgba(8,25,17,.9)', 'box-shadow:0 8px 24px rgba(0,0,0,.24)',
        'font-family:"Microsoft YaHei",sans-serif', 'pointer-events:none',
      ].join(';');
      document.body.appendChild(panel);
    }
    panel.innerHTML = `<strong style="display:block;font-size:18px;margin-bottom:4px">${title}</strong><span style="font-size:13px;color:#D8E7DF;line-height:1.55">${detail}</span>`;
  }, { title, detail });
  await page.waitForTimeout(waitMs);
}

try {
  await page.goto('http://127.0.0.1:5173/?submission-video=1', { waitUntil: 'domcontentloaded' });
  await page.locator('#top').waitFor();
  await caption('山河守护', '面向全国复杂地形旅游的多源感知安全决策智能体', 11000);

  await caption('一句话发起规划', '自然语言与结构化表单双向联动，识别区域、同行人、天数、强度与天气约束。', 9000);
  await page.getByRole('button', { name: '川西探索', exact: true }).click();
  await page.waitForFunction(() => {
    const session = JSON.parse(localStorage.getItem('qianxing-shared-route-v1'));
    return session?.route?.destinationRegion === '阿坝' && session.route.sites?.length >= 7;
  }, null, { timeout: 120000 });

  await page.locator('#journey').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('.itinerary-list img')];
    const map = document.querySelector('.mini-map > img');
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0) && map?.complete && map.naturalWidth > 0;
  }, null, { timeout: 90000 });
  await page.locator('.nearby-services').waitFor({ timeout: 90000 });
  await caption('生成可执行分日路线', '高德POI 2.0营业时间、真实道路、停留时长与2-opt改良共同生成分钟级行程。', 12000);

  const dayButtons = page.locator('.day-switch button');
  if (await dayButtons.count() > 1) {
    await dayButtons.nth(1).click();
    await page.waitForTimeout(1800);
  }
  await caption('每天都能独立查看', '切换日期后，路线卡片、局部地图、道路顺序、天气与风险摘要同步变化。', 10000);

  await caption('真实应急资源进入证据链', '系统按景点坐标检索附近医院、派出所和游客中心，展示名称与距离，不虚构服务点。', 11000);

  const proof = page.locator('.route-proof');
  await proof.locator('summary').click();
  await proof.scrollIntoViewIfNeeded();
  await caption('为什么是这条路线', '公开安全、服务、效率、体验权重，以及指定景点、距离、每日负荷、图片和时间窗五项硬约束。', 12000);

  await proof.getByRole('button', { name: '安全优先', exact: true }).click();
  await page.waitForFunction(() => {
    const session = JSON.parse(localStorage.getItem('qianxing-shared-route-v1'));
    return session?.route?.optimization?.selectedMode === 'safety-first';
  }, null, { timeout: 120000 });
  await caption('三种策略生成真实不同路线', '安全优先、均衡体验、探索优先使用不同权重，重新执行候选筛选与路径优化。', 11000);

  await proof.getByRole('button', { name: '降雨情景推演', exact: true }).click();
  await proof.locator('.weather-scenario > div').waitFor({ timeout: 120000 });
  await caption('降雨情景重新规划', '系统生成独立路线快照，比较平均风险和替换点位；未经确认不会覆盖当前计划。', 12000);

  const applyAlternative = proof.getByRole('button', { name: '应用替代路线', exact: true });
  if (await applyAlternative.count()) {
    await applyAlternative.click();
    await page.waitForTimeout(1800);
  }
  await caption('人在环确认', '用户确认后才应用替代路线，游客端与管理端继续共享同一个决策快照。', 9000);

  await page.goto('http://127.0.0.1:5173/?mode=demo&submission-video=1', { waitUntil: 'domcontentloaded' });
  await page.locator('.workspace-nav').waitFor();
  await page.waitForFunction(() => document.querySelector('.route-narrative')?.textContent?.includes('九寨'), null, { timeout: 90000 });
  await caption('管理端路线调度', '同一条路线同步显示到达离开时间、地图、平均风险、应急覆盖、优化分和工具链耗时。', 12000);

  await page.locator('.workspace-nav').getByRole('button', { name: '安全指挥' }).click();
  await page.waitForTimeout(1800);
  await caption('风险从识别走向闭环', '管理人员查看风险证据、真实应急资源和建议动作，并推进待研判、已确认、处置中、已闭环。', 12000);

  await page.locator('.workspace-nav').getByRole('button', { name: '运行监测' }).click();
  await page.waitForTimeout(2200);
  await caption('数据、模型和接口边界透明', '天气和道路为真实接口，客流明确标注模型估算，MindIE/vLLM Ascend适配器就绪但不冒充远程部署。', 12000);

  await caption('从一个真实场景出发，形成可复制的安全决策能力', '贵州是首个完整样板，全国其他区域按需检索；系统已完成接口、浏览器、移动端和36次路线基准验证。', 13000);
} finally {
  await page.evaluate(() => document.querySelector('#submission-caption')?.remove()).catch(() => {});
  const video = page.video();
  await context.close();
  const videoPath = video ? await video.path() : '';
  await browser.close();
  console.log(videoPath);
}
