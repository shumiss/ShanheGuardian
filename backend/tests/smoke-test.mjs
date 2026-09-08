import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../server.js";

const root = fileURLToPath(new URL("..", import.meta.url));

async function testData() {
  const data = JSON.parse(await readFile(join(root, "data", "sample_locations.json"), "utf8"));
  assert.ok(data.length >= 10, "should include at least ten candidate locations");
  assert.ok(data.every(item => item.name && item.city && item.touristFlow && item.policyFit), "candidate data should include scoring fields");
  assert.ok(data.some(item => item.city === "黔东南"), "should reflect Guizhou local tourism regions");
  assert.ok(data.every(item => Array.isArray(item.dataNeed) && item.dataNeed.length >= 5), "each candidate should expose data request fields");
}

async function testDemoSyntax() {
  const html = await readFile(join(root, "demo.html"), "utf8");
  for (const text of [
    "公共数据赛道",
    "商业智能选址",
    "UI 方向对比",
    "A 政企大屏",
    "B 运营控制台",
    "C 路演产品页",
    "数据申请"
  ]) {
    assert.ok(html.includes(text), `demo should include ${text}`);
  }
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 1, "demo should have one inline script");
  for (const script of scripts) new Function(script);
}

async function withServer(fn) {
  const server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function testApi() {
  await withServer(async base => {
    const health = await fetch(`${base}/api/health`).then(res => res.json());
    assert.equal(health.ok, true);
    assert.equal(health.service, "qianzhi-public-data");
    assert.match(health.version, /^2026\.08-/);

    const locations = await fetch(`${base}/api/locations`).then(res => res.json());
    assert.ok(locations.locations.length >= 10);

    const recommend = await fetch(`${base}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessType: "景区餐饮",
        region: "全省文旅片区",
        strategy: "balanced",
        budget: "standard",
        weights: { flow: 8, traffic: 8, blank: 6, policy: 6, risk: 7 }
      })
    }).then(res => res.json());
    assert.ok(recommend.top.name);
    assert.ok(recommend.candidates.length >= 10);
    assert.ok(recommend.metrics.topScore > 0);
    assert.ok(recommend.summary.includes("首选片区"));

    const report = await fetch(`${base}/api/report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessType: "景区餐饮" })
    }).then(res => res.json());
    assert.ok(report.report.includes("黔址优选公共数据智能选址报告"));

    const request = await fetch(`${base}/api/data-request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessType: "景区餐饮" })
    }).then(res => res.json());
    assert.ok(request.request.some(item => item.category === "工商"));

    const integration = await fetch(`${base}/api/integration-status`).then(res => res.json());
    assert.ok(integration.services.some(item => item.endpoint === "/api/recommend"));
    assert.ok(integration.services.some(item => item.endpoint === "/api/landing-plan"));

    const landing = await fetch(`${base}/api/landing-plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessType: "景区餐饮" })
    }).then(res => res.json());
    assert.ok(Array.isArray(landing.plan.phases));
    assert.ok(landing.plan.phases.length >= 4);
    assert.ok(Array.isArray(landing.plan.kpis));

    const guide = await fetch(`${base}/api/guide-summary`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessType: "景区餐饮" })
    }).then(res => res.json());
    assert.equal(guide.landingReady, true);
    assert.ok(Array.isArray(guide.decisionPath));

    const html = await fetch(`${base}/demo.html`).then(res => res.text());
    assert.ok(html.includes("黔址优选"));

    for (const sensitivePath of ["/.env", "/server.js", "/data/guizhou_scenic_spots.amap.json"]) {
      const response = await fetch(`${base}${sensitivePath}`);
      assert.equal(response.status, 404, `${sensitivePath} must never be served publicly`);
    }
  });
}

await testData();
await testDemoSyntax();
await testApi();
console.log("public-data backend smoke-test ok");
