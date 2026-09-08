# 山河守护前端

Vue 3 + Vite 路演级产品，用于生成全国复杂地形旅游路线，并展示景点风险、安全建议、应急服务覆盖、数据范围及昇腾推理链路。

## 启动

先启动后端，再执行：

```powershell
npm install
npm run dev
```

访问：`http://127.0.0.1:5173`

Vite 会把 `/api` 请求代理到 `http://127.0.0.1:8093`。

## 生产构建

```powershell
npm run build
```

输出目录：`dist/`

## 高德地图配置

复制 `.env.example` 为 `.env.local`：

```text
VITE_AMAP_JSAPI_KEY=你的高德 Web 端 Key
VITE_AMAP_SECURITY_JS_CODE=你的安全密钥
```

未配置时，贵州样板自动使用本地演示底图；全国动态地图需要后端高德 Web 服务 Key。

## 主要文件

- `src/AwardShowcase.vue`：游客端全国路线规划
- `src/OperationsConsoleV2.vue`：管理端路线调度与处置闭环
- `src/intentParser.js`：自然语言需求与表单联动
- `src/assets/scenic/`：核心景区本地图片
- `vite.config.js`：开发服务器及后端代理配置

## 演示流程

1. 选择快速场景或输入游客需求。
2. 点击“生成安全路线”。
3. 查看地图路线、景点风险和 AI 决策摘要。
4. 点击景点卡片或地图点位查看风险证据。
5. 切换风险中心、景区资源和系统能力工作区。
