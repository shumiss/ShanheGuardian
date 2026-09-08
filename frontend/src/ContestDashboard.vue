<script setup>
import { computed, onMounted, ref } from "vue";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, LineChart, RadarChart } from "echarts/charts";
import { GridComponent, RadarComponent, TooltipComponent } from "echarts/components";

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  RadarChart,
  GridComponent,
  RadarComponent,
  TooltipComponent,
]);

const color = {
  ok: "#1b8f62",
  warn: "#d9902f",
  bad: "#cf4d43",
  ink: "#0e2119",
};

const statusLabel = {
  ok: "优先",
  warn: "审慎",
  bad: "预警",
};

const points = {
  anshun_huangguoshu: [38, 52],
  qny_libo: [62, 68],
  gy_qingyan: [34, 38],
  qdn_xijiang: [74, 54],
  tr_fanjing: [52, 30],
  bj_zhijin: [48, 58],
  zy_chishui: [25, 44],
  qxn_wanfenglin: [32, 72],
  qdn_zhenyuan: [68, 44],
  qdn_zhaoxing: [78, 66],
};

const fallback = [
  {
    id: "qny_libo",
    name: "荔波小七孔东门服务片区",
    city: "黔南",
    county: "荔波",
    scene: "景区入口",
    score: 87,
    status: "ok",
    tag: "首选",
    x: 62,
    y: 68,
    touristFlow: 88,
    policyFit: 86,
    businessDensity: 45,
    rentPressure: 55,
    creditRisk: 18,
    trafficAccess: 79,
    short: "生态游 · 政策适配 · 风险可控",
    opportunities: ["客流稳定且生态旅游辨识度高", "服务半径清晰，适合轻补给业态", "公共数据指标均衡"],
    risks: ["节假日客流波动大", "停车与换乘压力需要小时级数据复核"],
    actions: ["接入景区客流热力", "优先部署轻餐饮、补给与咨询服务"],
    dataNeed: ["景区客流", "POI 设施", "交通换乘", "投诉评价"],
  },
  {
    id: "anshun_huangguoshu",
    name: "黄果树游客集散中心片区",
    city: "安顺",
    county: "镇宁",
    scene: "游客集散",
    score: 84,
    status: "warn",
    tag: "审慎",
    x: 38,
    y: 52,
    touristFlow: 94,
    policyFit: 78,
    businessDensity: 80,
    rentPressure: 70,
    creditRisk: 24,
    trafficAccess: 90,
    short: "客流强 · 竞争核验 · 交通成熟",
    opportunities: ["核心景区流量强", "集散交通成熟", "品牌曝光度高"],
    risks: ["同质餐饮密集", "旺季投诉与排队风险偏高"],
    actions: ["复核工商主体密度", "采用错峰供给和预约策略"],
    dataNeed: ["工商主体", "信用记录", "停车换乘", "小时级客流"],
  },
  {
    id: "gy_qingyan",
    name: "青岩古镇南街片区",
    city: "贵阳",
    county: "花溪区",
    scene: "古镇街区",
    score: 82,
    status: "ok",
    tag: "优先",
    x: 34,
    y: 38,
    touristFlow: 77,
    policyFit: 73,
    businessDensity: 67,
    rentPressure: 63,
    creditRisk: 15,
    trafficAccess: 83,
    short: "消费强 · 文创适配 · 城市近郊",
    opportunities: ["近郊复游率较好", "文创消费适配", "就业供给较好"],
    risks: ["铺租压力偏高", "节庆流量波动明显"],
    actions: ["做文创轻餐组合", "核验街巷级租赁样本"],
    dataNeed: ["街巷客流", "租赁成本", "就业技能", "商户信用"],
  },
  {
    id: "qdn_xijiang",
    name: "西江千户苗寨观景台片区",
    city: "黔东南",
    county: "雷山",
    scene: "民族村寨",
    score: 79,
    status: "bad",
    tag: "预警",
    x: 74,
    y: 54,
    touristFlow: 90,
    policyFit: 90,
    businessDensity: 84,
    rentPressure: 74,
    creditRisk: 26,
    trafficAccess: 71,
    short: "文旅 IP · 信用核验 · 竞争密集",
    opportunities: ["民族文化 IP 强", "夜间消费潜力高", "政策适配度高"],
    risks: ["商户密度高", "信用与投诉需重点核验"],
    actions: ["避开同质化民宿餐饮", "以非遗体验和预约服务切入"],
    dataNeed: ["民宿入住率", "夜间客流", "信用记录", "活动日历"],
  },
  {
    id: "tr_fanjing",
    name: "梵净山游客换乘片区",
    city: "铜仁",
    county: "江口",
    scene: "山地换乘",
    score: 80,
    status: "ok",
    tag: "优先",
    x: 52,
    y: 30,
    touristFlow: 81,
    policyFit: 87,
    businessDensity: 35,
    rentPressure: 48,
    creditRisk: 19,
    trafficAccess: 66,
    short: "补给刚需 · 山地换乘 · 生态适配",
    opportunities: ["山地补给刚需明显", "生态旅游适配", "竞争压力较低"],
    risks: ["天气影响换乘效率", "交通可达性需复核"],
    actions: ["接入天气和班次数据", "设计轻量补给与安全提示"],
    dataNeed: ["换乘班次", "天气记录", "户外消费", "安全服务点"],
  },
  {
    id: "qxn_wanfenglin",
    name: "万峰林将军桥片区",
    city: "黔西南",
    county: "兴义",
    scene: "山地田园",
    score: 78,
    status: "ok",
    tag: "优先",
    x: 32,
    y: 72,
    touristFlow: 70,
    policyFit: 83,
    businessDensity: 39,
    rentPressure: 45,
    creditRisk: 14,
    trafficAccess: 68,
    short: "山地田园 · 空白机会 · 成本稳健",
    opportunities: ["山地骑行和田园消费适配", "竞争密度较低", "成本压力可控"],
    risks: ["淡旺季差异需要复核", "交通到达链路较长"],
    actions: ["配置骑行补给与农特产品", "接入住宿和活动日历"],
    dataNeed: ["骑行热力", "民宿入住", "消费画像", "政策项目"],
  },
];

const scenarios = [
  { name: "景区餐饮", businessType: "景区餐饮", strategy: "flow", budget: "standard" },
  { name: "民族文创", businessType: "民族文创", strategy: "policy", budget: "standard" },
  { name: "研学服务", businessType: "研学服务", strategy: "blank", budget: "light" },
  { name: "康养民宿", businessType: "康养民宿", strategy: "cost", budget: "flagship" },
];

const regions = ["全省文旅片区", "贵阳", "安顺", "黔南", "黔东南", "铜仁", "毕节", "遵义", "黔西南"];
const strategies = [
  { value: "balanced", label: "综合平衡" },
  { value: "flow", label: "客流优先" },
  { value: "blank", label: "空白机会" },
  { value: "policy", label: "政策适配" },
  { value: "cost", label: "成本稳健" },
];
const budgets = [
  { value: "light", label: "轻资产" },
  { value: "standard", label: "标准投入" },
  { value: "flagship", label: "旗舰示范" },
];

const form = ref({
  businessType: "景区餐饮",
  region: "全省文旅片区",
  strategy: "balanced",
  budget: "standard",
});

const candidates = ref(fallback);
const active = ref(0);
const metrics = ref(null);
const sources = ref([]);
const integration = ref({ services: [], deployment: {} });
const dataRequest = ref([]);
const landingPlan = ref(null);
const locationsCount = ref(0);
const apiOnline = ref(false);
const loading = ref(false);
const errorMessage = ref("");
const lastUpdated = ref("--");
const summary = ref("当前展示本地样例数据。接入后端后，系统将基于公共数据完成候选片区评分、风险提示与选址报告生成。");

const cur = computed(() => candidates.value[Math.min(active.value, candidates.value.length - 1)] || fallback[0]);
const topCandidates = computed(() => candidates.value.slice(0, 6));
const route = computed(() => topCandidates.value.map((item) => `${item.x},${item.y}`).join(" "));
const statusText = computed(() => (apiOnline.value ? "本地接口已接入" : "本地模拟"));
const strategyText = computed(() => strategies.find((item) => item.value === form.value.strategy)?.label || "综合平衡");
const budgetText = computed(() => budgets.find((item) => item.value === form.value.budget)?.label || "标准投入");
const topScore = computed(() => metrics.value?.topScore ?? Math.max(...candidates.value.map((item) => item.score)));
const riskCount = computed(() => metrics.value?.riskCount ?? candidates.value.filter((item) => item.status !== "ok").length);
const avgFlow = computed(() => metrics.value?.avgFlow ?? Math.round(candidates.value.reduce((sum, item) => sum + item.touristFlow, 0) / candidates.value.length));
const sourceCount = computed(() => sources.value.length || 8);
const connectedCount = computed(() => integration.value.services?.filter((item) => item.status === "connected").length || 0);
const serviceCount = computed(() => integration.value.services?.length || 0);
const sourceNames = computed(() => {
  if (!sources.value.length) return ["工商主体", "企业信用", "就业人才", "流动人口", "宏观经济", "POI设施", "交通客流", "景区热度"];
  return sources.value.map((item) => item.name);
});
const landingPhases = computed(() => landingPlan.value?.phases || []);
const landingKpis = computed(() => landingPlan.value?.kpis || []);
const landingActions = computed(() => landingPlan.value?.nextActions || []);
const evidenceSignals = computed(() => [
  { label: "客流", value: cur.value.touristFlow ?? 0, hint: "热度" },
  { label: "交通", value: cur.value.trafficAccess ?? 0, hint: "可达" },
  { label: "政策", value: cur.value.policyFit ?? 0, hint: "适配" },
  { label: "空白", value: Math.max(0, 100 - (cur.value.businessDensity ?? 0)), hint: "机会" },
]);
const tagStyle = computed(() => ({
  left: cur.value.x > 66 ? `calc(${cur.value.x}% - 238px)` : `calc(${cur.value.x}% + 28px)`,
  top: cur.value.y > 72 ? `calc(${cur.value.y}% - 100px)` : `calc(${cur.value.y}% - 16px)`,
}));

const radarOption = computed(() => ({
  tooltip: { confine: true },
  radar: {
    indicator: [
      { name: "客流", max: 100 },
      { name: "政策", max: 100 },
      { name: "空白", max: 100 },
      { name: "成本", max: 100 },
      { name: "信用", max: 100 },
      { name: "交通", max: 100 },
    ],
    radius: "64%",
    splitNumber: 4,
    splitLine: { lineStyle: { color: "#dce7e1" } },
    splitArea: { areaStyle: { color: ["#fff", "#f6faf8"] } },
    axisLine: { lineStyle: { color: "#dce7e1" } },
    axisName: { color: "#536a60", fontSize: 11 },
  },
  series: [{
    type: "radar",
    data: [{ value: radarValue(cur.value), name: cur.value.name }],
    symbolSize: 4,
    lineStyle: { color: color[cur.value.status], width: 2 },
    areaStyle: { color: color[cur.value.status], opacity: 0.16 },
    itemStyle: { color: color[cur.value.status] },
  }],
}));

const barOption = computed(() => ({
  grid: { left: 6, right: 8, top: 16, bottom: 24 },
  tooltip: {
    trigger: "axis",
    confine: true,
    formatter: (params) => {
      const item = topCandidates.value[params[0].dataIndex];
      return `${item.name}<br/>综合评分 ${item.score} 分<br/>${item.short}`;
    },
  },
  xAxis: {
    type: "category",
    data: topCandidates.value.map((item) => item.name.replace("片区", "").slice(0, 4)),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: "#6b8176", fontSize: 11 },
  },
  yAxis: { type: "value", min: 50, max: 100, show: false },
  series: [{
    type: "bar",
    barWidth: 22,
    data: topCandidates.value.map((item, index) => ({
      value: item.score,
      itemStyle: {
        color: active.value === index ? color[item.status] : "#d3e0da",
        borderRadius: [4, 4, 0, 0],
      },
    })),
  }],
}));

const flowOption = computed(() => {
  const base = cur.value.touristFlow || 76;
  return {
    grid: { left: 6, right: 8, top: 18, bottom: 24 },
    tooltip: { trigger: "axis", confine: true },
    xAxis: {
      type: "category",
      data: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#6b8176", fontSize: 10 },
    },
    yAxis: { type: "value", show: false },
    series: [{
      type: "line",
      smooth: true,
      symbol: "none",
      data: [0.42, 0.48, 0.54, 0.63, 0.78, 0.72, 0.96, 0.92, 0.7, 0.82, 0.58, 0.5].map((rate) => Math.round(base * rate)),
      lineStyle: { color: "#176846", width: 2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(23,104,70,.22)" },
            { offset: 1, color: "rgba(23,104,70,0)" },
          ],
        },
      },
    }],
  };
});

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function radarValue(item) {
  return [
    clamp(item.touristFlow),
    clamp(item.policyFit),
    clamp(100 - item.businessDensity),
    clamp(100 - item.rentPressure),
    clamp(100 - item.creditRisk * 2.2),
    clamp(item.trafficAccess),
  ];
}

function requestPayload() {
  return {
    ...form.value,
    weights: { flow: 8, traffic: 8, blank: 6, policy: 6, risk: 7 },
  };
}

async function apiFetch(path, options = {}) {
  const init = {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  };
  let lastError;
  for (const base of ["", "http://127.0.0.1:8093"]) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function inferStatus(item, index) {
  if (item.riskLabel === "信用核验" || item.creditRisk >= 25) return "bad";
  if (item.riskLabel && item.riskLabel !== "风险可控") return "warn";
  if (index <= 2 || item.score >= 82) return "ok";
  return "warn";
}

function normalize(item, index) {
  const [x, y] = points[item.id] || [30 + (index % 5) * 12, 34 + Math.floor(index / 5) * 18];
  const status = inferStatus(item, index);
  return {
    ...item,
    id: item.id || `candidate-${index}`,
    x,
    y,
    status,
    tag: index === 0 ? "首选" : statusLabel[status],
    short: `${item.city || "贵州"} · ${item.scene || "文旅片区"} · ${item.riskLabel || "风险可控"}`,
    opportunities: item.opportunities?.length ? item.opportunities : ["公共数据指标表现较好", "具备文旅商业服务承载空间"],
    risks: item.risks?.length ? item.risks : [`${item.riskLabel || "风险可控"}，建议接入真实数据复核`],
    actions: item.actions?.length ? item.actions : ["进入真实数据环境后复核评分与风险证据"],
    dataNeed: item.dataNeed?.length ? item.dataNeed : ["工商主体", "企业信用", "客流热度", "POI 设施"],
  };
}

async function checkHealth() {
  try {
    const data = await apiFetch("/api/health");
    apiOnline.value = Boolean(data.ok);
  } catch {
    apiOnline.value = false;
  }
}

async function loadSources() {
  try {
    const data = await apiFetch("/api/sources");
    sources.value = data.sources || [];
  } catch {
    sources.value = [];
  }
}

async function loadIntegrationStatus() {
  try {
    integration.value = await apiFetch("/api/integration-status");
  } catch {
    integration.value = {
      services: [
        { id: "health", name: "健康检查", endpoint: "/api/health", status: apiOnline.value ? "connected" : "mock" },
        { id: "recommend", name: "智能推荐评分", endpoint: "/api/recommend", status: "mock" }
      ],
      deployment: { frontend: "Vue 3 + ECharts", backend: "local fallback" }
    };
  }
}

async function loadLocationsMeta() {
  try {
    const data = await apiFetch("/api/locations");
    locationsCount.value = data.locations?.length || 0;
  } catch {
    locationsCount.value = candidates.value.length;
  }
}

async function loadDataRequest() {
  try {
    const data = await apiFetch("/api/data-request", {
      method: "POST",
      body: JSON.stringify(requestPayload()),
    });
    dataRequest.value = data.request || [];
  } catch {
    dataRequest.value = [];
  }
}

async function loadLandingPlan() {
  try {
    const data = await apiFetch("/api/landing-plan", {
      method: "POST",
      body: JSON.stringify(requestPayload()),
    });
    landingPlan.value = data.plan || null;
  } catch {
    landingPlan.value = null;
  }
}

async function loadRecommendation() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const data = await apiFetch("/api/recommend", {
      method: "POST",
      body: JSON.stringify(requestPayload()),
    });
    const normalized = (data.candidates || []).map(normalize);
    if (normalized.length) {
      candidates.value = normalized;
      active.value = 0;
      metrics.value = data.metrics || null;
      summary.value = data.summary || "已完成候选片区评分与风险排序。";
      apiOnline.value = true;
      lastUpdated.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      await Promise.all([loadDataRequest(), loadLandingPlan(), loadIntegrationStatus()]);
    }
  } catch {
    candidates.value = fallback;
    metrics.value = null;
    apiOnline.value = false;
    errorMessage.value = "后端未连接，当前为本地样例。";
    summary.value = "当前展示本地样例数据。接入后端后，系统将基于公共数据完成候选片区评分、风险提示与选址报告生成。";
    await Promise.all([loadDataRequest(), loadLandingPlan(), loadIntegrationStatus()]);
  } finally {
    loading.value = false;
  }
}

async function exportReport() {
  try {
    const data = await apiFetch("/api/report", {
      method: "POST",
      body: JSON.stringify(requestPayload()),
    });
    const blob = new Blob([data.report || "暂无报告内容"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `黔址优选-公共数据选址报告-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    errorMessage.value = "后端未连接，暂不能导出正式报告。";
  }
}

function applyScenario(item) {
  form.value.businessType = item.businessType;
  form.value.strategy = item.strategy;
  form.value.budget = item.budget;
  loadRecommendation();
}

function pick(index) {
  active.value = index;
}

function onBarClick(params) {
  if (typeof params.dataIndex === "number") active.value = params.dataIndex;
}

onMounted(async () => {
  await checkHealth();
  await Promise.all([loadSources(), loadIntegrationStatus(), loadLocationsMeta()]);
  await loadRecommendation();
});
</script>

<template>
  <div class="console">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">黔</div>
        <div>
          <div class="brand-name">黔址优选</div>
          <div class="brand-line">贵州公共数据智能选址与创业决策平台</div>
        </div>
      </div>
      <div class="top-tags">
        <span>公共数据赛道</span>
        <span>省级路演控制台</span>
        <span :class="['status-pill', apiOnline ? 'online' : '']"><i></i>{{ statusText }}</span>
      </div>
      <div class="top-actions">
        <button type="button" class="ghost" :disabled="loading" @click="loadRecommendation">
          {{ loading ? "测算中" : "重新测算" }}
        </button>
        <button type="button" class="primary" @click="exportReport">导出报告</button>
      </div>
    </header>

    <main class="layout">
      <aside class="panel strategy">
        <div class="panel-kicker">Strategy Console</div>
        <h1>业态选址策略舱</h1>
        <p class="brief">围绕贵州文旅片区，综合客流、交通、信用、政策和经营空白度生成候选点。</p>

        <div class="quick-grid">
          <button
            v-for="item in scenarios"
            :key="item.name"
            type="button"
            :class="{ on: item.businessType === form.businessType }"
            @click="applyScenario(item)"
          >
            {{ item.name }}
          </button>
        </div>

        <div class="field-stack">
          <label>
            <span>目标业态</span>
            <select v-model="form.businessType">
              <option v-for="item in scenarios" :key="item.businessType" :value="item.businessType">{{ item.name }}</option>
            </select>
          </label>
          <label>
            <span>测算区域</span>
            <select v-model="form.region">
              <option v-for="item in regions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label>
            <span>选址策略</span>
            <select v-model="form.strategy">
              <option v-for="item in strategies" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label>
            <span>投入模型</span>
            <select v-model="form.budget">
              <option v-for="item in budgets" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
        </div>

        <div class="strategy-card">
          <span>当前模型</span>
          <strong>{{ strategyText }} / {{ budgetText }}</strong>
          <em>{{ form.region }} · {{ form.businessType }}</em>
        </div>

        <div class="source-block">
          <div class="mini-head">
            <span>公共数据源</span>
            <b>{{ sourceCount }} 类</b>
          </div>
          <div class="source-tags">
            <span v-for="item in sourceNames.slice(0, 8)" :key="item">{{ item }}</span>
          </div>
          <div class="connect-mini">
            <span>候选样本 {{ locationsCount || candidates.length }} 个</span>
            <span>接口 {{ connectedCount }}/{{ serviceCount || connectedCount }} 已接入</span>
          </div>
        </div>
      </aside>

      <section class="stage">
        <div class="stage-head">
          <div>
            <div class="panel-kicker">Guizhou Tourism Intelligence</div>
            <h2>贵州文旅商业选址态势图</h2>
          </div>
          <div class="stage-metrics">
            <div><span>候选</span><b>{{ candidates.length }}</b></div>
            <div><span>最高分</span><b>{{ topScore }}</b></div>
            <div><span>客流</span><b>{{ avgFlow }}</b></div>
            <div><span>核验</span><b class="risk">{{ riskCount }}</b></div>
          </div>
        </div>

        <div class="map-wrap">
          <svg class="terrain" width="100%" height="100%" aria-hidden="true">
            <defs>
              <pattern id="map-grid" width="42" height="42" patternUnits="userSpaceOnUse">
                <path d="M 42 0 L 0 0 0 42" fill="none" stroke="rgba(205,230,218,.12)" stroke-width="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#map-grid)" />
            <path d="M38 318 C144 264 198 358 304 284 C421 203 506 267 624 186 C722 119 836 157 912 98" />
            <path d="M62 402 C166 348 238 432 346 358 C468 274 548 345 662 264 C748 203 842 218 944 158" />
            <path d="M82 188 C184 136 282 204 386 148 C508 82 594 144 704 92 C790 50 872 68 944 34" />
          </svg>

          <svg class="province" viewBox="0 0 720 480" aria-hidden="true">
            <path
              d="M150 168 C170 120 230 96 296 100 C340 78 408 80 446 108 C500 92 566 110 588 158 C614 196 606 250 580 286 C600 320 596 372 558 396 C512 426 446 416 398 422 C352 452 286 446 244 414 C196 408 150 378 134 330 C108 300 100 248 120 210 C128 190 138 178 150 168 Z"
            />
            <path
              d="M198 214 C236 174 296 164 350 180 C408 158 486 178 526 220 C554 252 548 308 510 336 C466 366 398 352 354 374 C306 394 242 374 214 332 C184 300 172 248 198 214 Z"
            />
          </svg>

          <svg class="route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline :points="route" />
          </svg>

          <div class="map-legend">
            <span v-for="(label, key) in statusLabel" :key="key"><i :style="{ background: color[key] }"></i>{{ label }}</span>
          </div>

          <button
            v-for="(item, index) in topCandidates"
            :key="item.id"
            type="button"
            :class="['map-point', { on: active === index }]"
            :style="{ left: `${item.x}%`, top: `${item.y}%`, background: color[item.status] }"
            @click="pick(index)"
          >
            {{ index + 1 }}
          </button>

          <div class="map-card" :style="tagStyle">
            <div class="map-card-top">
              <span :style="{ color: color[cur.status], background: `${color[cur.status]}18` }">{{ cur.tag }}</span>
              <b>{{ cur.score }}</b>
            </div>
            <strong>{{ cur.name }}</strong>
            <em>{{ cur.city }} · {{ cur.county }} · {{ cur.scene }}</em>
            <p>{{ cur.short }}</p>
          </div>
        </div>

        <div class="signal-strip">
          <div v-for="item in evidenceSignals" :key="item.label" class="signal">
            <span>{{ item.label }}</span>
            <b>{{ item.value }}</b>
            <i>{{ item.hint }}</i>
          </div>
          <div class="signal wide">
            <span>AI 摘要</span>
            <p>{{ summary }}</p>
          </div>
        </div>
      </section>

      <aside class="side">
        <section class="panel decision">
          <div class="panel-kicker">Decision Loop</div>
          <h2>AI 决策摘要</h2>
          <div class="decision-main">
            <span :style="{ color: color[cur.status], background: `${color[cur.status]}18` }">{{ cur.tag }}</span>
            <strong>{{ cur.name }}</strong>
            <p>{{ summary }}</p>
          </div>
          <div class="pipeline">
            <span>公共数据</span>
            <i></i>
            <span>评分模型</span>
            <i></i>
            <span>风险证据</span>
            <i></i>
            <span>报告生成</span>
          </div>
          <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        </section>

        <section class="panel radar-panel">
          <div class="panel-row">
            <div>
              <div class="panel-kicker">Area Portrait</div>
              <h2>片区画像</h2>
            </div>
            <b class="score" :style="{ color: color[cur.status] }">{{ cur.score }}</b>
          </div>
          <v-chart class="radar" :option="radarOption" autoresize />
        </section>

        <section class="panel chart-panel">
          <div class="panel-row">
            <h2>评分 / 客流</h2>
            <span>{{ lastUpdated }}</span>
          </div>
          <v-chart class="mini-chart" :option="barOption" autoresize @click="onBarClick" />
          <v-chart class="mini-chart" :option="flowOption" autoresize />
        </section>

        <section class="panel api-panel">
          <div class="panel-row">
            <div>
              <div class="panel-kicker">API Matrix</div>
              <h2>接口接入矩阵</h2>
            </div>
            <b>{{ connectedCount }}/{{ serviceCount }}</b>
          </div>
          <div class="api-list">
            <div v-for="item in integration.services" :key="item.id">
              <span>{{ item.name }}</span>
              <em>{{ item.endpoint }}</em>
              <i>{{ item.status }}</i>
            </div>
          </div>
        </section>
      </aside>

      <section class="candidate-board">
        <button
          v-for="(item, index) in topCandidates"
          :key="item.id"
          type="button"
          :class="['candidate', { on: active === index }]"
          @click="pick(index)"
        >
          <span class="candidate-no" :style="{ color: color[item.status], background: `${color[item.status]}18` }">{{ index + 1 }}</span>
          <span class="candidate-main">
            <b>{{ item.name }}</b>
            <em>{{ item.short }}</em>
          </span>
          <span class="candidate-score" :style="{ color: color[item.status] }">{{ item.score }}</span>
          <span class="candidate-meta">
            <i>客流 {{ item.touristFlow }}</i>
            <i>交通 {{ item.trafficAccess }}</i>
            <i>信用 {{ item.creditRisk }}</i>
          </span>
        </button>
      </section>

      <section class="landing-board panel">
        <div class="landing-head">
          <div>
            <div class="panel-kicker">Implementation</div>
            <h2>落地实施路径</h2>
          </div>
          <strong>{{ landingPlan?.targetArea || cur.name }}</strong>
        </div>
        <div class="landing-grid">
          <div class="phase-list">
            <div v-for="(item, index) in landingPhases" :key="item.name" class="phase">
              <span>{{ index + 1 }}</span>
              <b>{{ item.name }}</b>
              <em>{{ item.duration }}</em>
              <p>{{ item.outputs.join(" / ") }}</p>
            </div>
          </div>
          <div class="request-list">
            <h3>数据申请清单</h3>
            <div v-for="item in dataRequest" :key="item.category" class="request-row">
              <b>{{ item.category }}</b>
              <span>{{ item.priority }}</span>
              <p>{{ item.fields.slice(0, 4).join("、") }}</p>
            </div>
          </div>
          <div class="kpi-list">
            <h3>落地指标</h3>
            <div v-for="item in landingKpis" :key="item.name" class="kpi-row">
              <span>{{ item.name }}</span>
              <b>{{ item.value }}</b>
            </div>
            <h3 class="next-title">下一步动作</h3>
            <p v-for="item in landingActions.slice(0, 3)" :key="item" class="next-action">{{ item }}</p>
          </div>
        </div>
      </section>

      <section class="evidence panel">
        <div>
          <div class="panel-kicker">Risk Evidence</div>
          <h2>风险证据与落地动作</h2>
        </div>
        <div class="evidence-cols">
          <div>
            <h3>机会</h3>
            <p v-for="item in cur.opportunities" :key="item">{{ item }}</p>
          </div>
          <div>
            <h3>风险</h3>
            <p v-for="item in cur.risks" :key="item">{{ item }}</p>
          </div>
          <div>
            <h3>动作</h3>
            <p v-for="item in cur.actions" :key="item">{{ item }}</p>
          </div>
          <div>
            <h3>数据</h3>
            <p v-for="item in cur.dataNeed.slice(0, 4)" :key="item">{{ item }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.console {
  min-height: 100vh;
  background:
    linear-gradient(180deg, #e7efea 0%, #eef3f0 34%, #f5f8f6 100%);
  color: #102019;
  font-family: "PingFang SC", "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 64px;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 318px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  background: #0e2119;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, .1);
  box-shadow: 0 10px 28px rgba(16, 32, 25, .16);
}

.brand,
.top-tags,
.top-actions,
.stage-metrics,
.map-legend,
.pipeline,
.panel-row,
.candidate-meta {
  display: flex;
  align-items: center;
}

.brand {
  gap: 12px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #1b8f62;
  color: #fff;
  font-size: 19px;
  font-weight: 800;
}

.brand-name {
  font-size: 17px;
  font-weight: 800;
}

.brand-line {
  margin-top: 3px;
  color: #acc4b9;
  font-size: 12px;
}

.top-tags {
  gap: 8px;
  min-width: 0;
}

.top-tags span,
.status-pill {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, .08);
  color: #dcebe4;
  font-size: 12px;
  white-space: nowrap;
}

.status-pill i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #d9902f;
}

.status-pill.online i {
  background: #23bd7f;
}

.top-actions {
  gap: 8px;
}

button,
select {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

button:disabled {
  cursor: wait;
  opacity: .72;
}

.ghost,
.primary {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
}

.ghost {
  color: #dcebe4;
  background: rgba(255, 255, 255, .1);
  border: 1px solid rgba(255, 255, 255, .16);
}

.primary {
  color: #fff;
  background: #1b8f62;
}

.layout {
  max-width: 1540px;
  margin: 0 auto;
  padding: 12px;
  display: grid;
  grid-template-columns: 286px minmax(0, 1fr) 334px;
  align-items: start;
  gap: 10px;
}

.panel,
.stage,
.candidate-board {
  border: 1px solid #d8e5de;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(16, 32, 25, .045);
}

.panel {
  padding: 14px;
}

.panel-kicker {
  color: #1b8f62;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  margin-top: 6px;
  font-size: 21px;
  line-height: 1.18;
}

h2 {
  margin-top: 5px;
  font-size: 15px;
  line-height: 1.25;
}

h3 {
  color: #1b8f62;
  font-size: 13px;
}

.brief {
  margin-top: 9px;
  color: #5d7268;
  font-size: 13px;
  line-height: 1.6;
}

.strategy {
  display: grid;
  gap: 16px;
  align-content: start;
}

.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-grid button {
  height: 40px;
  border-radius: 8px;
  border: 1px solid #dce7e1;
  background: #f8fbf9;
  color: #344e43;
  font-size: 13px;
  font-weight: 700;
}

.quick-grid button.on {
  border-color: #1b8f62;
  background: #eaf7f0;
  color: #116943;
}

.field-stack {
  display: grid;
  gap: 9px;
}

label {
  display: grid;
  gap: 6px;
}

label span {
  color: #6b8176;
  font-size: 12px;
}

select {
  width: 100%;
  height: 38px;
  padding: 0 10px;
  border: 1px solid #dce7e1;
  border-radius: 8px;
  outline: 0;
  background: #fff;
  color: #102019;
  font-size: 13px;
}

.strategy-card {
  padding: 13px;
  border-radius: 8px;
  background: #102019;
  color: #fff;
}

.strategy-card span,
.strategy-card em {
  display: block;
  color: #a9c1b6;
  font-size: 12px;
  font-style: normal;
}

.strategy-card strong {
  display: block;
  margin: 7px 0 4px;
  font-size: 15px;
}

.source-block {
  border-top: 1px solid #e3ece7;
  padding-top: 14px;
}

.mini-head {
  display: flex;
  justify-content: space-between;
  color: #5d7268;
  font-size: 12px;
}

.mini-head b {
  color: #1b8f62;
  font-size: 16px;
}

.source-tags {
  margin-top: 9px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-tags span {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  background: #eef5f1;
  color: #416056;
  font-size: 12px;
}

.connect-mini {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.connect-mini span {
  min-height: 34px;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #102019;
  color: #dcebe4;
  font-size: 12px;
  text-align: center;
}

.stage {
  min-height: 0;
  overflow: hidden;
}

.stage-head {
  height: 70px;
  padding: 13px 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e3ece7;
}

.stage-head h2 {
  font-size: 20px;
}

.stage-metrics {
  gap: 8px;
}

.stage-metrics div {
  min-width: 68px;
  height: 42px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #f4f8f6;
}

.stage-metrics span {
  display: block;
  color: #6b8176;
  font-size: 11px;
}

.stage-metrics b {
  color: #102019;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.stage-metrics .risk {
  color: #d9902f;
}

.map-wrap {
  position: relative;
  height: clamp(650px, calc(100vh - 172px), 820px);
  overflow: hidden;
  background:
    radial-gradient(circle at 72% 36%, rgba(52, 157, 107, .22), transparent 34%),
    linear-gradient(145deg, #0b1d15, #10241b 58%, #0b1a13);
}

.map-wrap::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(8, 23, 16, .18), transparent 24%, transparent 72%, rgba(8, 23, 16, .2)),
    linear-gradient(180deg, rgba(8, 23, 16, .1), transparent 18%, rgba(8, 23, 16, .2));
}

.terrain,
.province,
.route {
  position: absolute;
  inset: 0;
}

.terrain path {
  fill: none;
  stroke: rgba(166, 216, 190, .2);
  stroke-width: 1;
}

.province {
  inset: 26px 44px 26px;
  width: calc(100% - 88px);
  height: calc(100% - 52px);
}

.province path:first-child {
  fill: rgba(45, 131, 91, .2);
  stroke: rgba(181, 232, 205, .58);
  stroke-width: 1.6;
}

.province path:last-child {
  fill: rgba(255, 255, 255, .04);
  stroke: rgba(181, 232, 205, .22);
  stroke-width: 1;
}

.route {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route polyline {
  fill: none;
  stroke: rgba(218, 244, 228, .48);
  stroke-width: .55;
  stroke-dasharray: 2 1.4;
  vector-effect: non-scaling-stroke;
}

.map-legend {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 5;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid rgba(255, 255, 255, .13);
  border-radius: 8px;
  background: rgba(14, 33, 25, .72);
  color: #d8e9e1;
  font-size: 12px;
}

.map-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.map-legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.map-point {
  position: absolute;
  z-index: 8;
  width: 34px;
  height: 34px;
  transform: translate(-50%, -50%);
  border: 3px solid rgba(255, 255, 255, .95);
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 12px 30px rgba(0, 0, 0, .28);
  transition: width .16s ease, height .16s ease, box-shadow .16s ease;
}

.map-point.on {
  width: 44px;
  height: 44px;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, .16), 0 18px 38px rgba(0, 0, 0, .34);
}

.map-card {
  position: absolute;
  z-index: 10;
  width: 220px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, .15);
  border-radius: 8px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 18px 40px rgba(0, 0, 0, .24);
}

.map-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.map-card-top span {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
}

.map-card-top b {
  font-size: 24px;
  line-height: 1;
}

.map-card strong,
.map-card em,
.map-card p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-card strong {
  margin-top: 9px;
  font-size: 14px;
}

.map-card em {
  margin-top: 4px;
  color: #60766b;
  font-size: 12px;
  font-style: normal;
}

.map-card p {
  margin-top: 8px;
  color: #32493f;
  font-size: 12px;
}

.signal-strip {
  display: grid;
  grid-template-columns: repeat(4, 82px) minmax(0, 1fr);
  gap: 1px;
  background: #dfe9e4;
  border-top: 1px solid #dfe9e4;
}

.signal {
  min-height: 92px;
  padding: 12px;
  background: #fff;
}

.signal span,
.signal i {
  display: block;
  color: #6b8176;
  font-size: 12px;
  font-style: normal;
}

.signal b {
  display: block;
  margin: 5px 0 2px;
  color: #102019;
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.signal.wide p {
  margin-top: 7px;
  color: #344e43;
  font-size: 13px;
  line-height: 1.65;
}

.side {
  display: grid;
  gap: 10px;
  align-content: start;
}

.side .panel {
  padding: 12px;
}

.decision-main {
  margin-top: 10px;
  padding: 11px;
  border-radius: 8px;
  background: #f5faf7;
}

.decision-main span {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
}

.decision-main strong {
  display: block;
  margin-top: 10px;
  font-size: 15px;
}

.decision-main p {
  margin-top: 7px;
  color: #40584e;
  font-size: 13px;
  line-height: 1.55;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.pipeline {
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.pipeline span {
  height: 25px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  background: #102019;
  color: #dcebe4;
  font-size: 12px;
}

.pipeline i {
  width: 12px;
  height: 1px;
  background: #9fb7ac;
}

.error {
  margin-top: 10px;
  color: #c66a2d;
  font-size: 12px;
}

.panel-row {
  justify-content: space-between;
  gap: 10px;
}

.panel-row > span {
  color: #7d9187;
  font-size: 12px;
}

.score {
  font-size: 28px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.radar {
  height: 172px;
}

.mini-chart {
  height: 88px;
}

.api-panel .panel-row b {
  color: #1b8f62;
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}

.api-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.api-list div {
  min-height: 44px;
  padding: 6px 7px;
  border: 1px solid #e2ebe6;
  border-radius: 8px;
  display: grid;
  gap: 3px;
  background: #fbfdfc;
}

.api-list span,
.api-list em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-list span {
  color: #14251e;
  font-size: 11px;
  font-weight: 700;
}

.api-list em {
  color: #6b8176;
  font-size: 11px;
  font-style: normal;
}

.api-list i {
  justify-self: start;
  height: 19px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: #e8f7ef;
  color: #1b8f62;
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

.candidate-board {
  grid-column: 1 / 4;
  padding: 9px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
}

.candidate {
  min-width: 0;
  min-height: 104px;
  padding: 10px;
  border: 1px solid #dfe9e4;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 9px;
  background: #fff;
  text-align: left;
}

.candidate.on {
  border-color: #95c5ad;
  background:
    linear-gradient(180deg, #f4fbf7, #ffffff);
  box-shadow: inset 0 0 0 1px rgba(27, 143, 98, .12);
}

.candidate-no {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.candidate-main {
  min-width: 0;
}

.candidate-main b,
.candidate-main em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.candidate-main b {
  color: #102019;
  font-size: 13px;
  white-space: nowrap;
}

.candidate-main em {
  margin-top: 4px;
  color: #6b8176;
  font-size: 11px;
  line-height: 1.35;
  font-style: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}

.candidate-score {
  font-size: 21px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.candidate-meta {
  grid-column: 1 / 4;
  align-self: end;
  gap: 5px;
  flex-wrap: wrap;
}

.candidate-meta i {
  height: 20px;
  padding: 0 6px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  background: #eef5f1;
  color: #526b60;
  font-size: 11px;
  font-style: normal;
}

.landing-board {
  grid-column: 1 / 4;
  padding: 15px;
}

.landing-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.landing-head strong {
  max-width: 420px;
  overflow: hidden;
  color: #102019;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landing-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(260px, .92fr) minmax(260px, .92fr);
  gap: 10px;
}

.phase-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.phase,
.request-row,
.kpi-row {
  border: 1px solid #e2ebe6;
  border-radius: 8px;
  background: #fbfdfc;
}

.phase {
  min-height: 116px;
  padding: 9px;
}

.phase span {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: #e8f7ef;
  color: #1b8f62;
  font-weight: 800;
}

.phase b,
.phase em,
.phase p {
  display: block;
}

.phase b {
  margin-top: 8px;
  font-size: 13px;
}

.phase em {
  margin-top: 3px;
  color: #d9902f;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
}

.phase p {
  margin-top: 6px;
  color: #536a60;
  font-size: 11px;
  line-height: 1.38;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.request-list,
.kpi-list {
  min-width: 0;
}

.request-list h3,
.kpi-list h3 {
  margin-bottom: 8px;
}

.request-row {
  min-height: 42px;
  margin-top: 6px;
  padding: 7px;
  display: grid;
  grid-template-columns: auto auto;
  gap: 4px 8px;
}

.request-row b {
  font-size: 12px;
}

.request-row span {
  justify-self: end;
  color: #d9902f;
  font-size: 11px;
  font-weight: 800;
}

.request-row p {
  grid-column: 1 / 3;
  overflow: hidden;
  color: #536a60;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-row {
  min-height: 38px;
  margin-top: 6px;
  padding: 7px;
}

.kpi-row span {
  display: block;
  color: #6b8176;
  font-size: 11px;
}

.kpi-row b {
  display: block;
  margin-top: 3px;
  color: #102019;
  font-size: 12px;
}

.next-title {
  margin-top: 12px;
}

.next-action {
  position: relative;
  margin-top: 7px;
  padding-left: 11px;
  color: #40584e;
  font-size: 12px;
  line-height: 1.5;
}

.next-action::before {
  content: "";
  position: absolute;
  left: 0;
  top: .65em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #1b8f62;
}

.evidence {
  grid-column: 1 / 4;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 18px;
  align-items: start;
}

.evidence-cols {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.evidence-cols div {
  min-width: 0;
}

.evidence-cols p {
  position: relative;
  margin-top: 7px;
  padding-left: 11px;
  color: #42594f;
  font-size: 12px;
  line-height: 1.55;
}

.evidence-cols p::before {
  content: "";
  position: absolute;
  left: 0;
  top: .65em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #9cb6a8;
}

@media (max-width: 1220px) {
  .topbar {
    grid-template-columns: 1fr;
    height: auto;
    padding: 14px;
  }

  .layout {
    grid-template-columns: 1fr;
  }

  .candidate-board,
  .landing-board,
  .evidence {
    grid-column: auto;
  }

  .candidate-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .evidence {
    grid-template-columns: 1fr;
  }

  .landing-grid {
    grid-template-columns: 1fr;
  }

  .phase-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .evidence-cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .stage-head,
  .signal-strip,
  .candidate-board,
  .phase-list,
  .evidence-cols {
    grid-template-columns: 1fr;
  }

  .stage-head {
    height: auto;
    align-items: flex-start;
    flex-direction: column;
  }

  .stage-metrics {
    flex-wrap: wrap;
  }

  .signal-strip {
    display: grid;
  }

  .map-wrap {
    height: 370px;
  }
}
</style>
