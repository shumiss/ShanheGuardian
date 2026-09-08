# 山河守护后端

Node.js 原生 HTTP API，负责旅游路线计算、风险解释、应急覆盖、数据血缘、公共数据目录代理和昇腾推理适配状态输出。

贵州使用本地样板数据；请求携带 `destinationRegion` 且目标不在贵州时，后端通过高德 Web 服务建立该区域的景区候选池，并按区域天气与复杂地形规则生成路线。

## 启动

```powershell
npm install
npm start
```

默认地址：`http://127.0.0.1:8093`

## 核心接口

```text
GET  /api/health
GET  /api/integration-status
GET  /api/scenic-spots/summary
GET  /api/scenic-spots
GET  /api/holiday-tourism
GET  /api/public-data/statistics
GET  /api/public-data/catalog
GET  /api/public-data/relevant
POST /api/tourism/route-plan
POST /api/tourism/risk-explanation
POST /api/tourism/emergency-coverage
POST /api/tourism/data-lineage
GET  /api/tourism/ascend-readiness
GET  /api/tourism/project-status
POST /api/guide-summary
```

## 数据文件

- `data/guizhou_scenic_spots.amap.json`：2017 条贵州景区及风景名胜 POI
- `data/guizhou_tourism_guardian_sites.json`：7 个核心山地旅游安全点位
- `data/guizhou_holiday_tourism.json`：3 条节假日公开样本
- `data/sample_locations.json`：兼容选址能力的候选片区样本

## 环境变量

```text
PORT=8093
ASCEND_INFERENCE_URL=
AMAP_WEB_SERVICE_KEY=
AMAP_WEB_SERVICE_PRIVATE_KEY=
```

未配置 `ASCEND_INFERENCE_URL` 时，系统明确返回 `local-simulation`，不会伪装成已部署昇腾推理。

## 测试

```powershell
npm test
```

测试文件：

- `tests/smoke-test.mjs`：基础数据、健康检查、推荐、报告和落地计划
- `tests/tourism-api-test.mjs`：路线、风险解释、应急覆盖、数据血缘、昇腾适配和项目状态

## 数据采集

配置高德 Web 服务 Key 后执行：

```powershell
npm run collect:scenic
```

采集结果写入 `data/guizhou_scenic_spots.amap.json`。
