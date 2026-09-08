import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const playwrightModule = process.env.PLAYWRIGHT_MODULE_URL || "playwright";
const { chromium } = await import(playwrightModule);
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const browserPath = process.env.CHROME_PATH
  || [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const operations = await context.newPage();
  await operations.goto(`${baseUrl}/?mode=demo`, { waitUntil: "domcontentloaded" });
  await operations.locator(".workspace-nav").waitFor();
  await operations.waitForFunction(() => !document.querySelector(".inference-layer"), null, { timeout: 30000 });
  assert.ok(await operations.getByLabel("出发城市").locator("option").count() >= 20, "operations should expose nationwide departure hubs");
  assert.equal(await operations.getByLabel("旅行区域").inputValue(), "贵州", "operations should retain Guizhou as the first sample region");

  const dayOneCards = await operations.locator(".story-stop").count();
  const dayOnePins = await operations.locator(".map-pin").count();
  assert.equal(dayOnePins, dayOneCards, "map pins must follow the active day route cards");
  assert.match(await operations.locator(".map-heading small").first().innerText(), /第 1 天安全态势/);
  assert.equal(await operations.locator(".decision-chain").count(), 0, "technical chain should stay off the presentation workspace");

  const dayOnePath = await operations.locator(".route-line").getAttribute("d");
  await operations.getByRole("button", { name: "第 2 天" }).click();
  await operations.waitForTimeout(250);
  const dayTwoCards = await operations.locator(".story-stop").count();
  const dayTwoPins = await operations.locator(".map-pin").count();
  assert.equal(dayTwoPins, dayTwoCards, "day two map pins must match day two route cards");
  assert.notEqual(await operations.locator(".route-line").getAttribute("d"), dayOnePath, "route path should change with the active day");
  assert.match(await operations.locator(".decision-brief p").innerText(), /第 2 天/);

  const offlineMap = await context.newPage();
  await offlineMap.route("**/api/tourism/static-map*", route => route.abort());
  await offlineMap.goto(`${baseUrl}/?mode=demo`, { waitUntil: "domcontentloaded" });
  await offlineMap.waitForFunction(() => {
    const image = document.querySelector(".map-image");
    return image?.complete && image.naturalWidth > 0 && image.currentSrc.includes("guizhou-static-map-fallback");
  }, null, { timeout: 30000 });
  await offlineMap.close();

  const visitor = await context.newPage();
  await visitor.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await visitor.locator("#top").waitFor();
  const originPicker = visitor.getByRole("button", { name: /选择出发城市/ });
  await originPicker.click();
  assert.ok(await visitor.locator(".origin-menu button").count() >= 20, "visitor should expose nationwide departure hubs");
  await visitor.locator(".origin-menu").getByRole("option", { name: "兴义" }).click();
  await visitor.waitForFunction(() => {
    const session = JSON.parse(localStorage.getItem("qianxing-shared-route-v1"));
    return session?.request?.origin === "兴义";
  }, null, { timeout: 30000 });
  await visitor.waitForFunction(() => document.querySelector(".journey-heading h2")?.textContent?.startsWith("兴义出发"), null, { timeout: 30000 });
  const xingyiSession = await visitor.evaluate(() => JSON.parse(localStorage.getItem("qianxing-shared-route-v1")));
  assert.equal(xingyiSession.request.origin, "兴义");
  assert.ok(xingyiSession.route.sites[0].hubDistanceKm <= 125, "visitor route should actually begin in the selected departure corridor");
  const localMapZoom = Number(await visitor.locator(".mini-map").getAttribute("data-zoom"));
  assert.ok(localMapZoom > 1.1, `day map should focus into the local route, got ${localMapZoom}`);
  const pinsInsideMap = await visitor.locator(".mini-map").evaluate(map => {
    const bounds = map.getBoundingClientRect();
    return [...map.querySelectorAll(":scope > button")].every(pin => {
      const rect = pin.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return centerX >= bounds.left && centerX <= bounds.right && centerY >= bounds.top && centerY <= bounds.bottom;
    });
  });
  assert.equal(pinsInsideMap, true, "focused map should keep all active-day pins visible");
  await operations.getByRole("button", { name: "丽江康养", exact: true }).click();
  await operations.waitForFunction(() => !document.querySelector(".inference-layer"), null, { timeout: 30000 });
  await visitor.getByRole("button", { name: /第 3 天/ }).waitFor({ timeout: 10000 });
  const visitorDayButtons = visitor.locator(".day-switch button");
  for (let index = 0; index < await visitorDayButtons.count(); index += 1) {
    await visitorDayButtons.nth(index).click();
    await visitor.waitForFunction(() => {
      const cards = [...document.querySelectorAll(".itinerary-list > button")];
      const images = [...document.querySelectorAll(".itinerary-list .stop-image img")];
      return cards.length > 0
        && images.length === cards.length
        && images.every(image => image.complete && image.naturalWidth > 0);
    }, null, { timeout: 30000 });
    assert.equal(
      await visitor.locator(".itinerary-list .stop-image-empty").count(),
      0,
      `visitor day ${index + 1} should not contain empty scenic images`
    );
  }

  const naturalQuery = visitor.locator("#award-query");
  await naturalQuery.fill("9月28日从遵义出发去贵州，带父母和孩子玩3天，不想太累，担心下雨路滑，想去黄果树和梵净山");
  await visitor.waitForFunction(() => document.querySelector(".intent-recognition.recognized")?.textContent?.includes("3天"), null, { timeout: 10000 });
  assert.match(await originPicker.innerText(), /遵义/, "natural language should update the departure city");
  assert.match(
    await visitor.locator(".snapshot-title small").innerText(),
    /09月28日预报/,
    "a future itinerary must not label destination weather as today's live weather"
  );

  await visitor.getByRole("button", { name: "自由定制", exact: true }).click();
  assert.equal(await visitor.getByLabel("从哪里出发").inputValue(), "遵义", "natural language origin should backfill the custom form");
  assert.equal(await visitor.getByLabel("出发日期").inputValue(), "2026-09-28", "natural language date should backfill the custom form");
  assert.match(await visitor.locator(".day-stepper strong").innerText(), /3 天/, "natural language duration should backfill the custom form");
  assert.equal(await visitor.locator(".travelers button.active").innerText(), "亲子家庭", "natural language travelers should backfill the custom form");
  assert.equal(await visitor.locator(".popular-picker-list > button.active").count(), 2, "natural language destinations should backfill the picker");
  assert.equal(
    await visitor.locator(".popular-picker-list > button").count(),
    20,
    "custom planner should expose twenty popular Guizhou destinations"
  );
  await visitor.waitForFunction(() => {
    const images = [...document.querySelectorAll(".popular-picker-list .picker-image img")];
    return images.length === 20 && images.every(image => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 30000 });
  await visitor.locator(".destination-search input").fill("龙宫");
  await visitor.locator(".search-results").waitFor({ timeout: 30000 });
  await visitor.waitForFunction(() => {
    const images = [...document.querySelectorAll(".search-results .picker-image img")];
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 30000 });
  assert.equal(
    await visitor.locator(".search-results .picker-image > span").count(),
    0,
    "customer scenic search should only return records with exact POI photos"
  );
  await visitor.getByRole("button", { name: "关闭自由定制" }).click();

  await operations.locator(".workspace-nav").getByRole("button", { name: "安全指挥" }).click();
  await operations.locator(".incident-strip button").first().click();
  const siteId = await operations.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("qianxing-shared-route-v1"));
    return [...session.route.sites].sort((left, right) => right.riskScore - left.riskScore)[0].id;
  });
  await operations.request.post(`${baseUrl}/api/tourism/incidents`, {
    data: { siteId, siteName: "回归测试点位", status: "confirmed", note: "刷新恢复验证", event: "浏览器回归测试" }
  });
  await operations.reload({ waitUntil: "domcontentloaded" });
  await operations.locator(".workspace-nav").getByRole("button", { name: "安全指挥" }).click();
  await operations.locator(".incident-strip button").first().click();
  await assert.doesNotReject(() => operations.locator(".case-steps .current").filter({ hasText: "已确认" }).waitFor({ timeout: 10000 }));
  assert.equal(await operations.locator(".case-note textarea").inputValue(), "刷新恢复验证");
  await operations.request.post(`${baseUrl}/api/tourism/incidents`, {
    data: { siteId, siteName: "回归测试点位", status: "pending", assignee: "", checkedActions: [], note: "", logs: [], event: "浏览器回归测试清理" }
  });

  await operations.locator(".workspace-nav").getByRole("button", { name: "景区资源" }).click();
  await operations.locator(".resource-table button").first().waitFor({ timeout: 10000 });
  assert.equal(await operations.locator(".resource-table .data-ready").count(), 0, "resource rows should not repeat implementation status");
  assert.equal((await operations.locator(".resource-dossier").innerText()).includes("经纬度"), false, "customer view should not expose raw coordinates");

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${baseUrl}/?mode=demo`, { waitUntil: "domcontentloaded" });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile page should not overflow horizontally, got ${overflow}px`);

  await context.close();
  console.log("qianxing frontend e2e-smoke ok");
} finally {
  await browser.close();
}
