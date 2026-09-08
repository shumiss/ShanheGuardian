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

const palette = {
  ink: "#10241b",
  ink2: "#173428",
  panel: "#ffffff",
  line: "#d8e4de",
  muted: "#657a70",
  ok: "#16885d",
  warn: "#c9822b",
  bad: "#c84c42",
};

const statusLabel = { ok: "优先", warn: "审慎", bad: "预警" };
const pointMap = {
  qny_libo: [66, 66],
  anshun_huangguoshu: [38, 52],
  gy_qingyan: [35, 40],
  qdn_xijiang: [76, 54],
  tr_fanjing: [54, 29],
  qxn_wanfenglin: [30, 72],
  bj_zhijin: [48, 59],
  zy_chishui: [24, 44],
  qdn_zhenyuan: [69, 44],
  qdn_zhaoxing: [80, 66],
};

const fallbackCandidates = [
  {
    id: "qny_libo",
    name: "荔波小七孔东门服务片区",
    city: "黔南",
    county: "荔波",
    scene: "景区入口",
    score: 87,
    status: "ok",
    tag: "首选",
    touristFlow: 88,
    trafficAccess: 79,
    policyFit: 86,
    businessDensity: 45,
    rentPressure: 55,
    creditRisk: 18,
    short: "生态游 · 政策适配 · 风险可控",
    opportunities: ["生态旅游辨识度高", "服务半径清晰", "公共数据指标均衡"],
    risks: ["节假日客流波动大", "换乘与停车压力需复核"],
    actions: ["接入小时级客流", "优先布局轻餐饮与补给服务"],
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
    touristFlow: 94,
    trafficAccess: 90,
    policyFit: 78,
    businessDensity: 80,
    rentPressure: 70,
    creditRisk: 24,
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
    touristFlow: 77,
    trafficAccess: 83,
    policyFit: 73,
    businessDensity: 67,
    rentPressure: 63,
    creditRisk: 15,
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
    touristFlow: 90,
    trafficAccess: 71,
    policyFit: 90,
    businessDensity: 84,
    rentPressure: 74,
    creditRisk: 26,
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
    touristFlow: 81,
    trafficAccess: 66,
    policyFit: 87,
    businessDensity: 35,
    rentPressure: 48,
    creditRisk: 19,
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
    touristFlow: 70,
    trafficAccess: 68,
    policyFit: 83,
    businessDensity: 39,
    rentPressure: 45,
    creditRisk: 14,
    short: "山地田园 · 空白机会 · 成本稳健",
    opportunities: ["山地骑行和田园消费适配", "竞争密度较低", "成本压力可控"],
    risks: ["淡旺季差异需要复核", "交通到达链路较长"],
    actions: ["配置骑行补给与农特产品", "接入住宿和活动日历"],
    dataNeed: ["骑行热力", "民宿入住", "消费画像", "政策项目"],
  },
];

const scenarioPresets = [
  { name: "景区餐饮", businessType: "景区餐饮", strategy: "flow", budget: "standard" },
  { name: "民族文创", businessType: "民族文创", strategy: "policy", budget: "standard" },
  { name: "研学服务", businessType: "研学服务", strategy: "blank", budget: "light" },
  { name: "康养民宿", businessType: "康养民宿", strategy: "cost", budget: "flagship" },
];

const regionOptions = ["全省文旅片区", "贵阳", "安顺", "黔南", "黔东南", "铜仁", "毕节", "遵义", "黔西南"];
const strategyOptions = [
  { value: "balanced", label: "综合平衡" },
  { value: "flow", label: "客流优先" },
  { value: "blank", label: "空白机会" },
  { value: "policy", label: "政策适配" },
  { value: "cost", label: "成本稳健" },
];
const budgetOptions = [
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
const candidates = ref(fallbackCandidates.map(normalizeFallback));
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

const cur = computed(() => candidates.value[Math.min(active.value, candidates.value.length - 1)] || candidates.value[0]);
const topCandidates = computed(() => candidates.value.slice(0, 6));
const routePoints = computed(() => topCandidates.value.map((item) => `${item.x},${item.y}`).join(" "));
const connectedCount = computed(() => integration.value.services?.filter((item) => item.status === "connected").length || 0);
const serviceCount = computed(() => integration.value.services?.length || 0);
const sourceCount = computed(() => sources.value.length || 8);
const sourceNames = computed(() => sources.value.length ? sources.value.map((item) => item.name) : ["工商主体", "企业信用", "就业人才", "流动人口", "宏观经济", "POI设施", "交通客流", "景区热度"]);
const topScore = computed(() => metrics.value?.topScore ?? Math.max(...candidates.value.map((item) => item.score)));
const riskCount = computed(() => metrics.value?.riskCount ?? candidates.value.filter((item) => item.status !== "ok").length);
const avgScore = computed(() => metrics.value?.avgScore ?? Math.round(candidates.value.reduce((sum, item) => sum + item.score, 0) / candidates.value.length));
const avgFlow = computed(() => metrics.value?.avgFlow ?? Math.round(candidates.value.reduce((sum, item) => sum + (item.touristFlow || 0), 0) / candidates.value.length));
const strategyText = computed(() => strategyOptions.find((item) => item.value === form.value.strategy)?.label || "综合平衡");
const budgetText = computed(() => budgetOptions.find((item) => item.value === form.value.budget)?.label || "标准投入");
const landingPhases = computed(() => landingPlan.value?.phases || []);
const landingKpis = computed(() => landingPlan.value?.kpis || []);
const landingActions = computed(() => landingPlan.value?.nextActions || []);
const connectionText = computed(() => apiOnline.value ? "本地接口已接入" : "本地模拟");
const selectedStyle = computed(() => ({
  left: cur.value.x > 64 ? `calc(${cur.value.x}% - 250px)` : `calc(${cur.value.x}% + 30px)`,
  top: cur.value.y > 70 ? `calc(${cur.value.y}% - 118px)` : `calc(${cur.value.y}% - 18px)`,
}));

const radarOption = computed(() => ({
  tooltip: { confine: true },
  radar: {
    indicator: [
      { name: "客流", max: 100 },
      { name: "交通", max: 100 },
      { name: "政策", max: 100 },
      { name: "空白", max: 100 },
      { name: "成本", max: 100 },
      { name: "信用", max: 100 },
    ],
    radius: "64%",
    splitNumber: 4,
    splitLine: { lineStyle: { color: "#d9e6df" } },
    splitArea: { areaStyle: { color: ["#ffffff", "#f5faf7"] } },
    axisLine: { lineStyle: { color: "#d9e6df" } },
    axisName: { color: "#5d7469", fontSize: 11 },
  },
  series: [{
    type: "radar",
    data: [{ value: radarValue(cur.value), name: cur.value.name }],
    symbolSize: 4,
    lineStyle: { color: palette[cur.value.status], width: 2 },
    areaStyle: { color: palette[cur.value.status], opacity: 0.16 },
    itemStyle: { color: palette[cur.value.status] },
  }],
}));

const scoreOption = computed(() => ({
  grid: { left: 4, right: 8, top: 12, bottom: 22 },
  tooltip: { trigger: "axis", confine: true },
  xAxis: {
    type: "category",
    data: topCandidates.value.map((item) => shortName(item.name)),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: "#657a70", fontSize: 11 },
  },
  yAxis: { type: "value", min: 50, max: 100, show: false },
  series: [{
    type: "bar",
    barWidth: 24,
    data: topCandidates.value.map((item, index) => ({
      value: item.score,
      itemStyle: {
        color: active.value === index ? palette[item.status] : "#d8e3de",
        borderRadius: [5, 5, 0, 0],
      },
    })),
  }],
}));

const flowOption = computed(() => {
  const base = cur.value.touristFlow || 76;
  return {
    grid: { left: 4, right: 8, top: 12, bottom: 22 },
    tooltip: { trigger: "axis", confine: true },
    xAxis: {
      type: "category",
      data: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#657a70", fontSize: 10 },
    },
    yAxis: { type: "value", show: false },
    series: [{
      type: "line",
      data: [0.42, 0.48, 0.54, 0.64, 0.78, 0.73, 0.96, 0.91, 0.7, 0.82, 0.58, 0.5].map((rate) => Math.round(base * rate)),
      smooth: true,
      symbol: "none",
      lineStyle: { color: "#16885d", width: 2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(22,136,93,.22)" },
            { offset: 1, color: "rgba(22,136,93,0)" },
          ],
        },
      },
    }],
  };
});

function normalizeFallback(item) {
  const [x, y] = pointMap[item.id] || [48, 48];
  return { ...item, x, y };
}

function shortName(name) {
  return String(name || "").replace("片区", "").slice(0, 4);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function radarValue(item) {
  return [
    clamp(item.touristFlow),
    clamp(item.trafficAccess),
    clamp(item.policyFit),
    clamp(100 - (item.businessDensity || 0)),
    clamp(100 - (item.rentPressure || 0)),
    clamp(100 - (item.creditRisk || 0) * 2.2),
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

function normalizeCandidate(item, index) {
  const [x, y] = pointMap[item.id] || [32 + (index % 5) * 12, 36 + Math.floor(index / 5) * 17];
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
        { id: "recommend", name: "智能推荐评分", endpoint: "/api/recommend", status: "mock" },
      ],
      deployment: { frontend: "Vue 3 + ECharts", backend: "local fallback" },
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
    const normalized = (data.candidates || []).map(normalizeCandidate);
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
    candidates.value = fallbackCandidates.map(normalizeFallback);
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
  <div class="review-console">
    <header class="review-top">
      <div class="brand-lockup">
        <span class="brand-mark">黔</span>
        <div>
          <strong>黔址优选</strong>
          <p>贵州公共数据智能选址与创业决策平台</p>
        </div>
      </div>

      <div class="top-signal">
        <span>公共数据赛道</span>
        <span>省级路演版</span>
        <span :class="{ on: apiOnline }"><i></i>{{ connectionText }}</span>
      </div>

      <div class="top-actions">
        <button type="button" class="secondary" :disabled="loading" @click="loadRecommendation">
          {{ loading ? "测算中" : "重新测算" }}
        </button>
        <button type="button" class="primary" @click="exportReport">导出报告</button>
      </div>
    </header>

    <main class="review-shell">
      <section class="mission-strip">
        <div class="mission-copy">
          <span>Review Mission</span>
          <h1>用公共数据判断贵州文旅创业项目能不能落地</h1>
        </div>
        <div class="mission-metrics">
          <div><span>候选片区</span><strong>{{ candidates.length }}</strong></div>
          <div><span>最高评分</span><strong>{{ topScore }}</strong></div>
          <div><span>平均评分</span><strong>{{ avgScore }}</strong></div>
          <div><span>风险核验</span><strong class="warn">{{ riskCount }}</strong></div>
          <div><span>接口接入</span><strong>{{ connectedCount }}/{{ serviceCount || connectedCount }}</strong></div>
        </div>
      </section>

      <section class="command-panel">
        <div class="scenario-tabs">
          <button
            v-for="item in scenarioPresets"
            :key="item.name"
            type="button"
            :class="{ active: item.businessType === form.businessType }"
            @click="applyScenario(item)"
          >
            {{ item.name }}
          </button>
        </div>
        <label>
          <span>区域</span>
          <select v-model="form.region">
            <option v-for="item in regionOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label>
          <span>策略</span>
          <select v-model="form.strategy">
            <option v-for="item in strategyOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label>
          <span>投入</span>
          <select v-model="form.budget">
            <option v-for="item in budgetOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <div class="model-pill">
          {{ strategyText }} / {{ budgetText }}
        </div>
      </section>

      <section class="decision-grid">
        <section class="map-board">
          <div class="board-head">
            <div>
              <span>Decision Canvas</span>
              <h2>贵州文旅商业机会态势</h2>
            </div>
            <div class="legend">
              <span v-for="(label, key) in statusLabel" :key="key"><i :style="{ background: palette[key] }"></i>{{ label }}</span>
            </div>
          </div>

          <div class="province-map">
            <svg class="map-bg" width="100%" height="100%" aria-hidden="true">
              <defs>
                <pattern id="gridline" width="46" height="46" patternUnits="userSpaceOnUse">
                  <path d="M 46 0 L 0 0 0 46" fill="none" stroke="rgba(197,229,214,.11)" stroke-width="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridline)" />
              <path d="M42 380 C156 312 232 406 356 318 C486 226 578 296 702 196 C792 124 892 148 990 72" />
              <path d="M74 232 C188 168 302 234 420 164 C548 88 646 148 758 92 C842 52 922 64 1000 32" />
              <path d="M84 480 C198 414 286 494 418 410 C552 322 654 390 778 306 C872 242 950 256 1042 198" />
            </svg>

            <svg class="province-shape" viewBox="0 0 720 480" aria-hidden="true">
              <path d="M150 168 C170 120 230 96 296 100 C340 78 408 80 446 108 C500 92 566 110 588 158 C614 196 606 250 580 286 C600 320 596 372 558 396 C512 426 446 416 398 422 C352 452 286 446 244 414 C196 408 150 378 134 330 C108 300 100 248 120 210 C128 190 138 178 150 168 Z" />
              <path d="M198 214 C236 174 296 164 350 180 C408 158 486 178 526 220 C554 252 548 308 510 336 C466 366 398 352 354 374 C306 394 242 374 214 332 C184 300 172 248 198 214 Z" />
            </svg>

            <svg class="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline :points="routePoints" />
            </svg>

            <button
              v-for="(item, index) in topCandidates"
              :key="item.id"
              type="button"
              :class="['map-node', { selected: active === index }]"
              :style="{ left: `${item.x}%`, top: `${item.y}%`, background: palette[item.status] }"
              @click="pick(index)"
            >
              {{ index + 1 }}
            </button>

            <article class="selected-site" :style="selectedStyle">
              <div>
                <span :style="{ color: palette[cur.status], background: `${palette[cur.status]}18` }">{{ cur.tag }}</span>
                <strong>{{ cur.score }}</strong>
              </div>
              <h3>{{ cur.name }}</h3>
              <p>{{ cur.city }} · {{ cur.county }} · {{ cur.scene }}</p>
              <em>{{ cur.short }}</em>
            </article>
          </div>

          <div class="evidence-rail">
            <div><span>客流热度</span><strong>{{ cur.touristFlow }}</strong></div>
            <div><span>交通可达</span><strong>{{ cur.trafficAccess }}</strong></div>
            <div><span>政策适配</span><strong>{{ cur.policyFit }}</strong></div>
            <div><span>经营空白</span><strong>{{ Math.max(0, 100 - cur.businessDensity) }}</strong></div>
            <div class="wide"><span>AI 摘要</span><p>{{ summary }}</p></div>
          </div>
        </section>

        <aside class="reason-board">
          <section class="reason-card prime">
            <span>AI Decision Loop</span>
            <h2>{{ cur.name }}</h2>
            <p>{{ summary }}</p>
            <div class="pipeline">
              <b>公共数据</b><i></i><b>评分模型</b><i></i><b>风险证据</b><i></i><b>落地方案</b>
            </div>
            <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
          </section>

          <section class="reason-card chart-card">
            <div class="split-title">
              <div><span>Area Portrait</span><h2>片区画像</h2></div>
              <strong :style="{ color: palette[cur.status] }">{{ cur.score }}</strong>
            </div>
            <v-chart class="radar-chart" :option="radarOption" autoresize />
          </section>

          <section class="reason-card double-chart">
            <div class="split-title">
              <h2>评分 / 客流</h2>
              <em>{{ lastUpdated }}</em>
            </div>
            <v-chart class="tiny-chart" :option="scoreOption" autoresize @click="onBarClick" />
            <v-chart class="tiny-chart" :option="flowOption" autoresize />
          </section>
        </aside>
      </section>

      <section class="rank-board">
        <button
          v-for="(item, index) in topCandidates"
          :key="item.id"
          type="button"
          :class="['rank-tile', { selected: active === index }]"
          @click="pick(index)"
        >
          <span :style="{ color: palette[item.status], background: `${palette[item.status]}18` }">{{ index + 1 }}</span>
          <div>
            <b>{{ item.name }}</b>
            <p>{{ item.short }}</p>
          </div>
          <strong :style="{ color: palette[item.status] }">{{ item.score }}</strong>
          <footer>
            <i>客流 {{ item.touristFlow }}</i>
            <i>交通 {{ item.trafficAccess }}</i>
            <i>信用 {{ item.creditRisk }}</i>
          </footer>
        </button>
      </section>

      <section class="landing-grid">
        <section class="landing-panel implementation">
          <div class="section-title">
            <span>Implementation</span>
            <h2>落地实施路径</h2>
          </div>
          <div class="phase-track">
            <article v-for="(item, index) in landingPhases" :key="item.name">
              <span>{{ index + 1 }}</span>
              <b>{{ item.name }}</b>
              <em>{{ item.duration }}</em>
              <p>{{ item.outputs.join(" / ") }}</p>
            </article>
          </div>
        </section>

        <section class="landing-panel requests">
          <div class="section-title">
            <span>Data Contract</span>
            <h2>数据申请清单</h2>
          </div>
          <article v-for="item in dataRequest" :key="item.category">
            <div><b>{{ item.category }}</b><span>{{ item.priority }}</span></div>
            <p>{{ item.fields.slice(0, 4).join("、") }}</p>
          </article>
        </section>

        <section class="landing-panel api-status">
          <div class="section-title">
            <span>API Matrix</span>
            <h2>接口接入状态</h2>
          </div>
          <div class="api-grid">
            <article v-for="item in integration.services" :key="item.id">
              <b>{{ item.name }}</b>
              <p>{{ item.endpoint }}</p>
              <span>{{ item.status }}</span>
            </article>
          </div>
        </section>
      </section>

      <section class="proof-board">
        <section>
          <span>Risk Evidence</span>
          <h2>风险证据与动作闭环</h2>
        </section>
        <article>
          <h3>机会</h3>
          <p v-for="item in cur.opportunities" :key="item">{{ item }}</p>
        </article>
        <article>
          <h3>风险</h3>
          <p v-for="item in cur.risks" :key="item">{{ item }}</p>
        </article>
        <article>
          <h3>动作</h3>
          <p v-for="item in cur.actions" :key="item">{{ item }}</p>
        </article>
        <article>
          <h3>落地指标</h3>
          <p v-for="item in landingKpis.slice(0, 4)" :key="item.name">{{ item.name }}：{{ item.value }}</p>
          <p v-for="item in landingActions.slice(0, 2)" :key="item">{{ item }}</p>
        </article>
      </section>
    </main>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.review-console {
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 2%, rgba(22, 136, 93, .1), transparent 26%),
    linear-gradient(180deg, #e6efea 0%, #eff4f1 42%, #f7faf8 100%);
  color: #10241b;
  font-family: "PingFang SC", "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
}

.review-top {
  position: sticky;
  top: 0;
  z-index: 30;
  height: 64px;
  padding: 0 20px;
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  background: #10241b;
  color: #ffffff;
  box-shadow: 0 14px 34px rgba(16, 36, 27, .18);
}

.brand-lockup,
.top-signal,
.top-actions,
.mission-metrics,
.command-panel,
.scenario-tabs,
.board-head,
.legend,
.split-title,
.pipeline,
.rank-tile footer {
  display: flex;
  align-items: center;
}

.brand-lockup {
  gap: 12px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #16885d;
  color: #ffffff;
  font-size: 18px;
  font-weight: 800;
}

.brand-lockup strong {
  display: block;
  font-size: 17px;
}

.brand-lockup p,
.top-signal span {
  margin: 0;
  color: #b9cec4;
  font-size: 12px;
}

.top-signal {
  justify-content: center;
  gap: 8px;
}

.top-signal span {
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, .08);
  color: #e7f2ed;
}

.top-signal i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c9822b;
}

.top-signal .on i {
  background: #23b87c;
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

.primary,
.secondary {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  transition: transform .16s ease, background .16s ease;
}

.primary:active,
.secondary:active,
.scenario-tabs button:active,
.rank-tile:active,
.map-node:active {
  transform: translateY(1px);
}

.primary {
  background: #16885d;
  color: #ffffff;
}

.secondary {
  border: 1px solid rgba(255, 255, 255, .18);
  background: rgba(255, 255, 255, .08);
  color: #e7f2ed;
}

.review-shell {
  max-width: 1540px;
  margin: 0 auto;
  padding: 12px;
  display: grid;
  gap: 10px;
}

.mission-strip,
.command-panel,
.map-board,
.reason-card,
.rank-board,
.landing-panel,
.proof-board {
  border: 1px solid #d7e4dd;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(16, 36, 27, .045);
}

.mission-strip {
  min-height: 88px;
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  align-items: center;
  gap: 18px;
}

.mission-copy span,
.board-head span,
.reason-card > span,
.section-title span,
.proof-board > section span {
  color: #16885d;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin: 0;
}

.mission-copy h1 {
  margin-top: 5px;
  font-size: 23px;
  line-height: 1.16;
  text-wrap: balance;
}

.mission-metrics {
  gap: 8px;
}

.mission-metrics div {
  min-width: 84px;
  height: 56px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f4f8f6;
}

.mission-metrics span {
  display: block;
  color: #657a70;
  font-size: 11px;
}

.mission-metrics strong {
  display: block;
  margin-top: 2px;
  font-size: 24px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.mission-metrics .warn {
  color: #c9822b;
}

.command-panel {
  min-height: 54px;
  padding: 8px;
  gap: 8px;
  display: grid;
  grid-template-columns: minmax(340px, 1fr) repeat(3, minmax(128px, 160px)) auto;
}

.scenario-tabs {
  gap: 6px;
  min-width: 0;
}

.scenario-tabs button {
  height: 36px;
  padding: 0 12px;
  border: 1px solid #d9e6df;
  border-radius: 8px;
  background: #f8fbf9;
  color: #27463a;
  font-size: 13px;
  font-weight: 700;
}

.scenario-tabs button.active {
  border-color: #16885d;
  background: #e8f6ef;
  color: #0f6845;
}

label {
  height: 36px;
  padding-left: 9px;
  border: 1px solid #d9e6df;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  color: #657a70;
  font-size: 12px;
}

select {
  height: 34px;
  min-width: 84px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #10241b;
  font-size: 13px;
}

.model-pill {
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #10241b;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.decision-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 348px;
  gap: 10px;
  align-items: start;
}

.map-board {
  overflow: hidden;
}

.board-head {
  height: 68px;
  padding: 13px 15px;
  justify-content: space-between;
  border-bottom: 1px solid #e3ece7;
}

.board-head h2,
.reason-card h2,
.section-title h2,
.proof-board h2 {
  margin-top: 4px;
  font-size: 18px;
  line-height: 1.2;
}

.legend {
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid #d9e6df;
  border-radius: 8px;
  background: #f7fbf9;
  color: #456157;
  font-size: 12px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.province-map {
  position: relative;
  height: clamp(600px, calc(100vh - 250px), 780px);
  overflow: hidden;
  background:
    radial-gradient(circle at 70% 32%, rgba(22, 136, 93, .24), transparent 34%),
    linear-gradient(145deg, #0b1d15, #10241b 58%, #0b1a13);
}

.map-bg,
.province-shape,
.route-layer {
  position: absolute;
  inset: 0;
}

.map-bg path {
  fill: none;
  stroke: rgba(182, 222, 203, .18);
  stroke-width: 1;
}

.province-shape {
  inset: 26px 42px;
  width: calc(100% - 84px);
  height: calc(100% - 52px);
}

.province-shape path:first-child {
  fill: rgba(22, 136, 93, .18);
  stroke: rgba(205, 241, 224, .58);
  stroke-width: 1.6;
}

.province-shape path:last-child {
  fill: rgba(255, 255, 255, .04);
  stroke: rgba(205, 241, 224, .22);
  stroke-width: 1;
}

.route-layer {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route-layer polyline {
  fill: none;
  stroke: rgba(220, 247, 232, .48);
  stroke-width: .55;
  stroke-dasharray: 2 1.5;
  vector-effect: non-scaling-stroke;
}

.map-node {
  position: absolute;
  z-index: 5;
  width: 34px;
  height: 34px;
  transform: translate(-50%, -50%);
  border: 3px solid rgba(255, 255, 255, .96);
  border-radius: 50%;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 13px 32px rgba(0, 0, 0, .28);
  transition: width .18s ease, height .18s ease, box-shadow .18s ease;
}

.map-node.selected {
  z-index: 8;
  width: 46px;
  height: 46px;
  box-shadow: 0 0 0 6px rgba(255, 255, 255, .16), 0 18px 42px rgba(0, 0, 0, .32);
}

.selected-site {
  position: absolute;
  z-index: 9;
  width: 236px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, .18);
  border-radius: 8px;
  background: rgba(255, 255, 255, .95);
  box-shadow: 0 22px 48px rgba(0, 0, 0, .24);
}

.selected-site div,
.selected-site span {
  display: flex;
  align-items: center;
}

.selected-site div {
  justify-content: space-between;
}

.selected-site span {
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
}

.selected-site strong {
  font-size: 24px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.selected-site h3 {
  margin-top: 9px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-site p,
.selected-site em {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: #657a70;
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-site em {
  margin-top: 8px;
  color: #2d463b;
}

.evidence-rail {
  display: grid;
  grid-template-columns: repeat(4, 82px) minmax(0, 1fr);
  gap: 1px;
  background: #dfe9e4;
  border-top: 1px solid #dfe9e4;
}

.evidence-rail div {
  min-height: 92px;
  padding: 12px;
  background: #ffffff;
}

.evidence-rail span {
  display: block;
  color: #657a70;
  font-size: 12px;
}

.evidence-rail strong {
  display: block;
  margin-top: 5px;
  font-size: 24px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.evidence-rail p {
  margin-top: 7px;
  color: #344e43;
  font-size: 13px;
  line-height: 1.58;
}

.reason-board {
  display: grid;
  gap: 10px;
}

.reason-card {
  padding: 12px;
}

.reason-card.prime p {
  margin-top: 8px;
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

.pipeline b {
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  background: #10241b;
  color: #e7f2ed;
  font-size: 12px;
}

.pipeline i {
  width: 12px;
  height: 1px;
  background: #9fb7ac;
}

.error-text {
  color: #c9822b;
}

.split-title {
  justify-content: space-between;
  gap: 10px;
}

.split-title > strong {
  font-size: 30px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.split-title > em {
  color: #7c9187;
  font-size: 12px;
  font-style: normal;
}

.radar-chart {
  height: 172px;
}

.tiny-chart {
  height: 88px;
}

.rank-board {
  padding: 9px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
}

.rank-tile {
  min-width: 0;
  min-height: 104px;
  padding: 10px;
  border: 1px solid #dfe9e4;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 9px;
  background: #ffffff;
  text-align: left;
}

.rank-tile.selected {
  border-color: #95c5ad;
  background: linear-gradient(180deg, #f4fbf7, #ffffff);
  box-shadow: inset 0 0 0 1px rgba(22, 136, 93, .12);
}

.rank-tile > span {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.rank-tile b,
.rank-tile p {
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-tile b {
  display: block;
  font-size: 13px;
  white-space: nowrap;
}

.rank-tile p {
  margin-top: 3px;
  color: #657a70;
  font-size: 11px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.rank-tile > strong {
  font-size: 21px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.rank-tile footer {
  grid-column: 1 / 4;
  align-self: end;
  gap: 5px;
  flex-wrap: wrap;
}

.rank-tile footer i {
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

.landing-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(300px, .82fr) minmax(300px, .9fr);
  gap: 10px;
  align-items: start;
}

.landing-panel {
  padding: 14px;
}

.section-title h2 {
  font-size: 16px;
}

.phase-track {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}

.phase-track article,
.requests article,
.api-grid article {
  border: 1px solid #e2ebe6;
  border-radius: 8px;
  background: #fbfdfc;
}

.phase-track article {
  min-height: 118px;
  padding: 9px;
}

.phase-track span {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  background: #e8f7ef;
  color: #16885d;
  font-weight: 800;
}

.phase-track b,
.phase-track em,
.phase-track p {
  display: block;
}

.phase-track b {
  margin-top: 8px;
  font-size: 13px;
}

.phase-track em {
  margin-top: 3px;
  color: #c9822b;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.phase-track p {
  margin-top: 6px;
  color: #536a60;
  font-size: 11px;
  line-height: 1.38;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.requests article {
  min-height: 43px;
  margin-top: 6px;
  padding: 7px;
}

.requests article div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.requests b {
  font-size: 12px;
}

.requests span {
  color: #c9822b;
  font-size: 11px;
  font-weight: 800;
}

.requests p {
  margin-top: 3px;
  overflow: hidden;
  color: #536a60;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.api-grid article {
  min-height: 46px;
  padding: 7px;
}

.api-grid b,
.api-grid p {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-grid b {
  font-size: 11px;
}

.api-grid p {
  margin-top: 2px;
  color: #657a70;
  font-size: 10px;
}

.api-grid span {
  margin-top: 4px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: #e8f7ef;
  color: #16885d;
  font-size: 10px;
  font-weight: 800;
}

.proof-board {
  padding: 14px;
  display: grid;
  grid-template-columns: 220px repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.proof-board h2 {
  font-size: 16px;
}

.proof-board h3 {
  color: #16885d;
  font-size: 13px;
}

.proof-board p {
  position: relative;
  margin-top: 7px;
  padding-left: 11px;
  color: #42594f;
  font-size: 12px;
  line-height: 1.52;
}

.proof-board p::before {
  content: "";
  position: absolute;
  left: 0;
  top: .65em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #9cb6a8;
}

@media (max-width: 1240px) {
  .review-top,
  .mission-strip,
  .command-panel,
  .decision-grid,
  .landing-grid {
    grid-template-columns: 1fr;
  }

  .top-signal {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .mission-metrics,
  .command-panel,
  .scenario-tabs {
    flex-wrap: wrap;
  }

  .rank-board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .proof-board {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .review-top {
    height: auto;
    padding: 12px;
  }

  .mission-metrics,
  .evidence-rail,
  .rank-board,
  .phase-track,
  .api-grid,
  .proof-board {
    grid-template-columns: 1fr;
  }

  .province-map {
    height: 390px;
  }
}
</style>
