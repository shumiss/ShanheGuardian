import assert from "node:assert/strict";
import { createServer } from "node:http";

let receivedRequest = null;
const mockAscend = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  receivedRequest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          summary: "昇腾推理已结合天气、风险证据与服务覆盖生成安全路线。",
          actions: ["优先安排低坡度点位", "高风险点绑定游客中心"]
        })
      }
    }]
  }));
});
await new Promise(resolve => mockAscend.listen(0, "127.0.0.1", resolve));

process.env.AMAP_WEB_SERVICE_KEY = "";
process.env.AMAP_WEB_SERVICE_SECRET = "";
process.env.ASCEND_INFERENCE_URL = `http://127.0.0.1:${mockAscend.address().port}/v1/chat/completions`;
process.env.ASCEND_MODEL = "qianxing-test-model";
const { handleRequest } = await import(`../server.js?ascend-test=${Date.now()}`);

const api = createServer(handleRequest);
await new Promise(resolve => api.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${api.address().port}`;

try {
  const route = await fetch(`${base}/api/tourism/route-plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      request: "带老人和孩子去贵州玩两天",
      travelerType: "family",
      weather: "rain",
      days: 2,
      preference: "safe",
      intensity: 38
    })
  }).then(response => response.json());

  assert.equal(route.mode, "remote-ascend-inference");
  assert.equal(route.inference.status, "remote-success");
  assert.equal(route.inference.model, "qianxing-test-model");
  assert.match(route.summary, /昇腾推理/);
  assert.deepEqual(route.actions, ["优先安排低坡度点位", "高风险点绑定游客中心"]);
  assert.equal(receivedRequest.model, "qianxing-test-model");
  assert.equal(receivedRequest.messages.length, 2);

  const readiness = await fetch(`${base}/api/tourism/ascend-readiness`).then(response => response.json());
  assert.equal(readiness.status, "remote-ascend-inference");
  assert.ok(readiness.lastSuccessAt);
  assert.ok(Number.isFinite(readiness.lastLatencyMs));
} finally {
  await new Promise(resolve => api.close(resolve));
  await new Promise(resolve => mockAscend.close(resolve));
}

console.log("qianxing ascend-adapter-test ok");
