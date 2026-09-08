import assert from "node:assert/strict";
import { createServer } from "node:http";
import { handleRequest } from "../server.js";

const requestBody = {
  request: "带父母和孩子去贵州玩两天，不想太累，担心下雨路滑",
  origin: "贵阳",
  travelerType: "family",
  weather: "rain",
  days: 2,
  preference: "safe",
  intensity: 42,
};

function distanceKm(from, to) {
  const radians = value => value * Math.PI / 180;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

async function getJson(base, path) {
  const response = await fetch(`${base}${path}`);
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

async function postJson(base, path, body = requestBody) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

await withServer(async base => {
  const health = await getJson(base, "/api/health");
  assert.equal(health.ok, true);
  assert.equal(health.mode, "local-simulation");

  const scenicSummary = await getJson(base, "/api/scenic-spots/summary");
  assert.ok(scenicSummary.total >= 2000, "scenic POI inventory should include at least 2000 records");

  const scenic = await getJson(base, "/api/scenic-spots?city=贵阳&limit=10");
  assert.ok(Array.isArray(scenic.spots));
  assert.ok(scenic.spots.length > 0);

  const scenicWithPhotos = await getJson(base, "/api/scenic-spots?photo=required&limit=2500");
  assert.ok(scenicWithPhotos.spots.length >= 1800, "customer-facing scenic inventory should retain broad coverage");
  assert.ok(
    scenicWithPhotos.spots.every(spot => spot.photos?.some(photo => photo?.url)),
    "customer-facing scenic inventory must contain an exact POI photo"
  );
  const photoBackedPoiIds = new Set(scenicWithPhotos.spots.map(spot => spot.id));

  const holiday = await getJson(base, "/api/holiday-tourism");
  assert.ok(Array.isArray(holiday.records));
  assert.ok(holiday.records.length >= 3);

  const weather = await getJson(base, "/api/tourism/live-weather?adcodes=520100,520400&forecast=520100,520400");
  assert.ok(Array.isArray(weather.live));
  assert.ok(Array.isArray(weather.forecasts));
  if (weather.configured) {
    assert.ok(weather.live.every(item => item.dataType === "realtime"));
    assert.ok(weather.forecasts.every(item => item.dataType === "forecast"));
  }

  const route = await postJson(base, "/api/tourism/route-plan");
  assert.match(route.planId, /^plan_/, "route response should include a reusable decision snapshot id");
  assert.ok(route.generatedAt, "route response should include its snapshot time");
  assert.ok(Array.isArray(route.routeOrder));
  assert.equal(route.routeOrder.length, 6, "two-day route should schedule three stops per day");
  assert.ok(Array.isArray(route.sites));
  assert.ok(route.sites.every(site => Number.isFinite(site.riskScore)));
  assert.equal(route.optimization.selectedMode, "safety-first");
  assert.equal(route.optimization.constraintsPassed, route.optimization.constraintsTotal);
  assert.equal(route.optimization.alternatives.length, 3);
  assert.ok(route.optimization.alternatives.every(item => Number.isFinite(item.objectiveScore)));
  assert.ok(route.agentTrace.totalMs >= 0);
  assert.ok(route.agentTrace.steps.length >= 8);
  assert.equal(route.executableSchedule.days.length, route.itinerary.length);
  assert.equal(route.executableSchedule.qualityGate.passed, true);
  assert.ok(route.metrics.candidatePool >= 2000, "route engine should use the full scenic POI pool");
  assert.ok(route.sites.some(site => site.estimateMode === "rule-estimated"), "route should include dynamically inferred scenic candidates");
  assert.ok(
    route.sites.some(site => site.sourcePoiId && site.imagePath?.startsWith("/api/scenic-photo?id=")),
    "route sites with AMap photos should expose a local image proxy path"
  );
  assert.ok(
    route.sites.filter(site => site.sourcePoiId).every(site => photoBackedPoiIds.has(site.sourcePoiId)),
    "route candidates must only use POIs with their own verified photo records"
  );
  const longestLeg = route.sites.slice(1).reduce((max, site, index) => (
    Math.max(max, distanceKm(route.sites[index].lngLat, site.lngLat))
  ), 0);
  assert.ok(longestLeg <= 130, `two-day route should remain geographically coherent, got ${longestLeg.toFixed(1)}km`);
  assert.deepEqual(route.itinerary[0].sites, route.routeOrder.slice(0, 3), "day one should use the first contiguous route stops");
  assert.equal(route.itinerary[0].date, route.request.startDate, "itinerary should start on the requested travel date");
  assert.equal(route.request.origin, "贵阳", "route request should preserve the departure city");

  const experienceRoute = await postJson(base, "/api/tourism/route-plan", {
    ...requestBody,
    routeMode: "experience-first",
  });
  assert.equal(experienceRoute.optimization.selectedMode, "experience-first");
  assert.notDeepEqual(experienceRoute.routeOrder, route.routeOrder, "route modes should change the actual selected route");

  const xingyiRoute = await postJson(base, "/api/tourism/route-plan", {
    ...requestBody,
    request: "从兴义出发安排两天贵州山地自然行程",
    origin: "兴义",
    weather: "auto",
  });
  assert.equal(xingyiRoute.request.origin, "兴义");
  assert.equal(xingyiRoute.origin.name, "兴义");
  assert.match(xingyiRoute.routeTitle, /^兴义出发/);
  assert.ok(xingyiRoute.sites[0].hubDistanceKm <= 125, "route should begin inside the selected departure corridor");

  const fanjingRoute = await postJson(base, "/api/tourism/route-plan", {
    ...requestBody,
    request: "以梵净山风景区为核心规划贵州安全行程",
    origin: "铜仁",
    weather: "auto",
    startDate: "2026-08-08",
    selectedSiteNames: ["梵净山风景区"],
  });
  assert.ok(fanjingRoute.sites.some(site => /梵净山/.test(site.name)), "selected scenic destination must remain in the route");
  assert.equal(fanjingRoute.itinerary[0].date, "2026-08-08");
  assert.equal(fanjingRoute.itinerary[1].date, "2026-08-09");
  const fanjingLongestLeg = fanjingRoute.sites.slice(1).reduce((max, site, index) => (
    Math.max(max, distanceKm(fanjingRoute.sites[index].lngLat, site.lngLat))
  ), 0);
  assert.ok(fanjingLongestLeg <= 130, `destination-centered route should avoid impossible jumps, got ${fanjingLongestLeg.toFixed(1)}km`);

  const longRoute = await postJson(base, "/api/tourism/route-plan", {
    ...requestBody,
    days: 4,
  });
  assert.equal(longRoute.routeOrder.length, 10, "four-day route should support more than seven stops without forcing three stops every day");
  assert.ok(longRoute.itinerary.every(day => day.sites.length >= 2 && day.sites.length <= 3), "four-day route should balance two to three executable stops per day");

  const tenDayRoute = await postJson(base, "/api/tourism/route-plan", {
    ...requestBody,
    days: 10,
  });
  assert.equal(tenDayRoute.itinerary.length, 10, "ten-day route should expose ten day tabs");
  assert.ok(tenDayRoute.itinerary.every(day => day.sites.length >= 2), "balanced ten-day itinerary should not leave empty days");

  const selectedSiteId = route.routeOrder[0];
  const risk = await postJson(base, "/api/tourism/risk-explanation", {
    ...requestBody,
    planId: route.planId,
    siteId: selectedSiteId,
  });
  assert.ok(risk.explanation);
  assert.equal(risk.snapshotUsed, true, "risk explanation should reuse the route decision snapshot");
  assert.equal(
    risk.explanation.riskScore,
    route.sites.find(site => site.id === selectedSiteId).riskScore,
    "route and risk explanation must expose the same risk score"
  );
  assert.ok(Array.isArray(risk.explanation.evidence));
  assert.ok(Array.isArray(risk.explanation.suggestedActions));
  assert.ok(Array.isArray(risk.explanation.emergencyServices));
  assert.ok(Array.isArray(risk.explanation.nearbyEmergency));

  const coverage = await postJson(base, "/api/tourism/emergency-coverage", {
    ...requestBody,
    planId: route.planId,
  });
  assert.ok(coverage.coverage);
  assert.equal(coverage.snapshotUsed, true, "emergency coverage should reuse the route decision snapshot");
  assert.deepEqual(coverage.routeOrder, route.routeOrder, "coverage must evaluate the displayed route");
  assert.ok(Number.isFinite(coverage.coverage.averageCoverage));

  const lineage = await postJson(base, "/api/tourism/data-lineage", {
    ...requestBody,
    planId: route.planId,
  });
  assert.ok(Array.isArray(lineage.lineage.pipeline));
  assert.equal(lineage.snapshotUsed, true, "data lineage should reference the same decision snapshot");
  assert.ok(lineage.lineage.pipeline.length >= 5);
  assert.ok(Array.isArray(lineage.lineage.datasets));

  const ascend = await getJson(base, "/api/tourism/ascend-readiness");
  assert.ok(ascend.status);
  assert.ok(Array.isArray(ascend.chain));

  const status = await getJson(base, "/api/tourism/project-status");
  assert.equal(status.name, "山河守护");
  assert.ok(Array.isArray(status.apis));
  assert.ok(status.dataReadiness.scenicPoiCount >= 2000);
  assert.ok(Array.isArray(status.missingForProduction));

  const guide = await postJson(base, "/api/guide-summary");
  assert.ok(Array.isArray(guide.decisionPath));
});

console.log("qianxing tourism-api-test ok");
