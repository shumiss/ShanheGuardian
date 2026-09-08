import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDirectory = await mkdtemp(join(tmpdir(), "qianxing-incidents-"));
process.env.INCIDENT_STORE_PATH = join(testDirectory, "incidents.json");
const { handleRequest } = await import(`../server.js?incident-test=${Date.now()}`);

const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const saved = await fetch(`${base}/api/tourism/incidents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      siteId: "as_huangguoshu",
      siteName: "黄果树游客集散中心",
      planId: "plan_test",
      status: "responding",
      assignee: "景区游客中心",
      checkedActions: ["开启防滑提醒"],
      note: "现场已铺设防滑垫",
      logs: [{ time: "10:30:00", text: "已启动现场处置" }],
      event: "测试处置写入"
    })
  }).then(response => response.json());

  assert.equal(saved.saved, true);
  assert.equal(saved.incident.status, "responding");
  assert.equal(saved.incident.assignee, "景区游客中心");
  assert.equal(saved.incident.audit.at(-1).event, "测试处置写入");

  const loaded = await fetch(`${base}/api/tourism/incidents?siteIds=as_huangguoshu`).then(response => response.json());
  assert.equal(loaded.incidents.length, 1);
  assert.deepEqual(loaded.incidents[0].checkedActions, ["开启防滑提醒"]);
  assert.equal(loaded.incidents[0].note, "现场已铺设防滑垫");

  const disk = JSON.parse(await readFile(process.env.INCIDENT_STORE_PATH, "utf8"));
  assert.equal(disk.incidents.as_huangguoshu.status, "responding");
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(testDirectory, { recursive: true, force: true });
}

console.log("qianxing incident-api-test ok");
