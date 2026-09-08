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

const statusColor = { ok: "#1a8b5f", warn: "#c9862b", bad: "#c94d43" };
const statusLabel = { ok: "优先", warn: "审慎", bad: "预警" };
const radarDims = ["客流", "政策", "空白", "成本", "信用", "交通"];

const positionMap = {
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

const fallbackCandidates = [
  {
    id: "qny_libo",
    name: "荔波小七孔东门服务片区",
    city: "黔南",
    county: "荔波",
    scene: "景区入口",
    score: 87,
    tag: "首选",
    status: "ok",
    short: "生态游 · 政策适配 · 风险可控",
    x: 62,
    y: 68,
    touristFlow: 88,
    policyFit: 86,
    businessDensity: 45,
    rentPressure: 55,
    creditRisk: 18,
    trafficAccess: 79,
    radar: [88, 86, 55, 45, 62, 79],
    opportunities: ["生态旅游热度高", "景区入口服务半径清晰", "公共数据指标均衡"],
    risks: ["节假日客流波动大", "需要复核停车与换乘压力"],
    actions: ["优先核验小时级客流", "匹配轻餐饮和补给型业态"],
    dataNeed: ["景区客流", "POI", "交通换乘", "投诉评价"],
  },
  {
    id: "anshun_huangguoshu",
    name: "黄果树游客集散中心片区",
    city: "安顺",
    county: "镇宁",
    scene: "游客集散",
    score: 84,
    tag: "审慎",
    status: "warn",
    short: "客流强 · 竞争核验 · 交通成熟",
    x: 38,
    y: 52,
    touristFlow: 94,
    policyFit: 78,
    businessDensity: 80,
    rentPressure: 70,
    creditRisk: 24,
    trafficAccess: 90,
    radar: [94, 78, 20, 30, 47, 90],
    opportunities: ["核心景区客流强", "集散交通成熟", "品牌曝光度高"],
    risks: ["同质餐饮密集", "旺季排队与投诉风险"],
    actions: ["复核工商主体密度", "采用错峰供给和预约制"],
    dataNeed: ["工商主体", "客流热力", "停车换乘", "信用风险"],
  },
  {
    id: "gy_qingyan",
    name: "青岩古镇南街片区",
    city: "贵阳",
    county: "花溪区",
    scene: "古镇街区",
    score: 82,
    tag: "优先",
    status: "ok",
    short: "消费强 · 文创适配 · 城市近郊",
    x: 34,
    y: 38,
    touristFlow: 77,
    policyFit: 73,
    businessDensity: 67,
    rentPressure: 63,
    creditRisk: 15,
    trafficAccess: 83,
    radar: [77, 73, 33, 37, 67, 83],
    opportunities: ["城市近郊复游率高", "文创消费适配", "就业供给较好"],
    risks: ["街区铺租压力偏高", "节庆客流波动明显"],
    actions: ["优先做文创轻餐组合", "核验租赁成本样本"],
    dataNeed: ["街巷客流", "租赁成本", "就业技能", "商户信用"],
  },
  {
    id: "qdn_xijiang",
    name: "西江千户苗寨观景台片区",
    city: "黔东南",
    county: "雷山",
    scene: "民族村寨",
    score: 79,
    tag: "预警",
    status: "bad",
    short: "文旅 IP · 信用核验 · 竞争密集",
    x: 74,
    y: 54,
    touristFlow: 90,
    policyFit: 90,
    businessDensity: 84,
    rentPressure: 74,
    creditRisk: 26,
    trafficAccess: 71,
    radar: [90, 90, 16, 26, 43, 71],
    opportunities: ["民族文化 IP 强", "夜间消费潜力高", "政策适配度高"],
    risks: ["商户密度高", "信用与投诉需重点核验"],
    actions: ["避开同质民宿餐饮", "以非遗体验和预约服务切入"],
    dataNeed: ["民宿入住率", "夜间客流", "信用记录", "活动日历"],
  },
  {
    id: "tr_fanjing",
    name: "梵净山游客换乘片区",
    city: "铜仁",
    county: "江口",
    scene: "山地换乘",
    score: 80,
    tag: "优先",
    status: "ok",
    short: "补给刚需 · 山地换乘 · 生态适配",
    x: 52,
    y: 30,
    touristFlow: 81,
    policyFit: 87,
    businessDensity: 35,
    rentPressure: 48,
    creditRisk: 19,
    trafficAccess: 66,
    radar: [81, 87, 65, 52, 58, 66],
    opportunities: ["山地补给刚需明显", "生态旅游适配", "竞争压力较低"],
    risks: ["天气影响换乘效率", "交通可达性需复核"],
    actions: ["接入天气和班次数据", "设计轻量补给与安全提示"],
    dataNeed: ["换乘班次", "天气记录", "户外消费", "安全服务点"],
  },
];

const scenarioOptions = [
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

const candidates = ref(fallbackCandidates);
const active = ref(0);
const metrics = ref(null);
const dataSources = ref([]);
const apiOnline = ref(false);
const loading = ref(false);
const apiStatus = ref("本地样例");
const errorMessage = ref("");
const lastUpdated = ref("--");
const reportSummary = ref("当前展示本地样例数据。启动后端后，将自动接入 /api/recommend 生成真实候选片区、风险提示与选址报告。");

const cur = computed(() => candidates.value[Math.min(active.value, candidates.value.length - 1)] || fallbackCandidates[0]);
const candidateCount = computed(() => metrics.value?.count ?? candidates.value.length);
const topScore = computed(() => metrics.value?.topScore ?? Math.max(...candidates.value.map((item) => item.score)));
const avgFlow = computed(() => metrics.value?.avgFlow ?? avg(candidates.value.map((item) => item.touristFlow || 0)));
const riskCount = computed(() => metrics.value?.riskCount ?? candidates.value.filter((item) => item.status !== "ok").length);
const sourceCount = computed(() => dataSources.value.length || 8);
const routePoints = computed(() => candidates.value.slice(0, 6).map((item) => `${item.x},${item.y}`).join(" "));
const connectionClass = computed(() => (apiOnline.value ? "online" : "offline"));
const topCandidates = computed(() => candidates.value.slice(0, 6));
const selectedSourceText = computed(() => {
  if (!dataSources.value.length) return "工商、信用、就业、人口、宏观经济、POI、交通客流、景区热度";
  return dataSources.value.map((item) => item.name).join("、");
});
const strategyText = computed(() => strategyOptions.find((item) => item.value === form.value.strategy)?.label || "综合平衡");
const budgetText = computed(() => budgetOptions.find((item) => item.value === form.value.budget)?.label || "标准投入");
const evidenceSignals = computed(() => [
  { label: "客流", value: cur.value.touristFlow ?? 0, unit: "热度" },
  { label: "交通", value: cur.value.trafficAccess ?? 0, unit: "可达" },
  { label: "政策", value: cur.value.policyFit ?? 0, unit: "适配" },
  { label: "空白", value: 100 - (cur.value.businessDensity ?? 0), unit: "机会" },
]);
const tagStyle = computed(() => {
  const x = cur.value.x > 68 ? `calc(${cur.value.x}% - 226px)` : `calc(${cur.value.x}% + 28px)`;
  const y = cur.value.y > 72 ? `calc(${cur.value.y}% - 96px)` : `calc(${cur.value.y}% - 10px)`;
  return { left: x, top: y };
});

const radarOption = computed(() => ({
  tooltip: { confine: true },
  radar: {
    indicator: radarDims.map((name) => ({ name, max: 100 })),
    radius: "63%",
    splitNumber: 4,
    splitLine: { lineStyle: { color: "#dde8e1" } },
    splitArea: { areaStyle: { color: ["#ffffff", "#f6faf8"] } },
    axisLine: { lineStyle: { color: "#dde8e1" } },
    axisName: { color: "#4f675c", fontSize: 11 },
  },
  series: [{
    type: "radar",
    data: [{ value: cur.value.radar, name: cur.value.name }],
    symbolSize: 4,
    lineStyle: { color: statusColor[cur.value.status], width: 2 },
    areaStyle: { color: statusColor[cur.value.status], opacity: 0.16 },
    itemStyle: { color: statusColor[cur.value.status] },
  }],
}));

const barOption = computed(() => ({
  grid: { left: 4, right: 8, top: 14, bottom: 24 },
  tooltip: {
    trigger: "axis",
    confine: true,
    formatter: (params) => {
      const item = candidates.value[params[0].dataIndex];
      return `${item.name}<br/>综合评分 ${item.score} 分<br/>${item.short}`;
    },
  },
  xAxis: {
    type: "category",
    data: candidates.value.map((item) => shortName(item.name)),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { color: "#6e8378", fontSize: 11 },
  },
  yAxis: { type: "value", min: 50, max: 100, show: false },
  series: [{
    type: "bar",
    barWidth: 24,
    data: candidates.value.map((item, index) => ({
      value: item.score,
      itemStyle: {
        color: active.value === index ? statusColor[item.status] : "#d6e2dc",
        borderRadius: [6, 6, 0, 0],
      },
    })),
  }],
}));

const flowOption = computed(() => {
  const base = cur.value.touristFlow || 76;
  const data = [0.42, 0.48, 0.54, 0.63, 0.78, 0.72, 0.96, 0.92, 0.7, 0.82, 0.58, 0.5]
    .map((rate) => Math.round(base * rate));
  return {
    grid: { left: 4, right: 8, top: 14, bottom: 24 },
    tooltip: { trigger: "axis", confine: true, formatter: (params) => `${params[0].name}<br/>客流热度 ${params[0].value}` },
    xAxis: {
      type: "category",
      data: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#6e8378", fontSize: 10 },
    },
    yAxis: { type: "value", show: false },
    series: [{
      type: "line",
      data,
      smooth: true,
      symbol: "none",
      lineStyle: { color: "#176846", width: 2 },
      areaStyle: {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: "rgba(23,104,70,.24)" },
            { offset: 1, color: "rgba(23,104,70,0)" },
          ],
        },
      },
    }],
  };
});

function avg(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function shortName(name) {
  return name.replace("片区", "").slice(0, 4);
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
  const [x, y] = positionMap[item.id] || [30 + (index % 5) * 12, 34 + Math.floor(index / 5) * 18];
  const status = inferStatus(item, index);
  return {
    ...item,
    id: item.id || `candidate-${index}`,
    displayNo: index + 1,
    tag: index === 0 ? "首选" : statusLabel[status],
    status,
    x,
    y,
    short: `${item.city || "贵州"} · ${item.scene || "文旅片区"} · ${item.riskLabel || "风险可控"}`,
    radar: [
      clamp(item.touristFlow ?? 76),
      clamp(item.policyFit ?? 72),
      clamp(100 - (item.businessDensity ?? 52)),
      clamp(100 - (item.rentPressure ?? 55)),
      clamp(100 - (item.creditRisk ?? 18) * 2.2),
      clamp(item.trafficAccess ?? 70),
    ],
    opportunities: item.opportunities?.length ? item.opportunities : ["公共数据指标表现较好", "具备文旅商业服务承载空间"],
    risks: item.risks?.length ? item.risks : [`${item.riskLabel || "风险可控"}，建议接入真实数据复核`],
    actions: item.actions?.length ? item.actions : ["进入真实数据环境后复核评分与风险证据"],
    dataNeed: item.dataNeed?.length ? item.dataNeed : ["工商主体", "企业信用", "客流热度", "POI 设施"],
  };
}

async function checkHealth() {
  try {
    const health = await apiFetch("/api/health");
    apiOnline.value = Boolean(health.ok);
    apiStatus.value = health.ok ? "本地接口已接入" : "接口异常";
  } catch {
    apiOnline.value = false;
    apiStatus.value = "本地样例";
  }
}

async function loadSources() {
  try {
    const data = await apiFetch("/api/sources");
    dataSources.value = data.sources || [];
  } catch {
    dataSources.value = [];
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
      reportSummary.value = data.summary || "已完成候选片区评分与风险排序。";
      apiOnline.value = true;
      apiStatus.value = data.mode === "local-simulation" ? "本地接口已接入" : "远程服务已接入";
      lastUpdated.value = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    }
  } catch (error) {
    candidates.value = fallbackCandidates;
    metrics.value = null;
    apiOnline.value = false;
    apiStatus.value = "本地样例";
    errorMessage.value = "未连接到后端，当前使用前端样例数据。";
    reportSummary.value = "当前为本地样例演示。启动后端后，页面会通过 /api/recommend 实时生成候选片区、风险标签和 AI 摘要。";
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

function applyScenario(scenario) {
  form.value.businessType = scenario.businessType;
  form.value.strategy = scenario.strategy;
  form.value.budget = scenario.budget;
  loadRecommendation();
}

function onBarClick(params) {
  if (typeof params.dataIndex === "number") active.value = params.dataIndex;
}

onMounted(async () => {
  await checkHealth();
  await loadSources();
  await loadRecommendation();
});
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="brand">
        <div class="mark">黔</div>
        <div>
          <div class="brand-name">黔址优选</div>
          <div class="brand-sub">贵州公共数据智能选址 · 创业大赛控制台</div>
        </div>
      </div>
      <div class="tools">
        <span class="api" :class="connectionClass"><i></i>{{ apiStatus }}</span>
        <button class="ghost" type="button" @click="loadRecommendation" :disabled="loading">
          {{ loading ? "测算中" : "重新测算" }}
        </button>
        <button class="solid" type="button" @click="exportReport">导出报告</button>
      </div>
    </header>

    <section class="filters">
      <div class="select-group">
        <label>
          <span>业态</span>
          <select v-model="form.businessType">
            <option v-for="item in scenarioOptions" :key="item.businessType" :value="item.businessType">{{ item.name }}</option>
          </select>
        </label>
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
      </div>
      <div class="scenes">
        <button
          v-for="item in scenarioOptions"
          :key="item.name"
          type="button"
          :class="{ on: item.businessType === form.businessType }"
          @click="applyScenario(item)"
        >
          {{ item.name }}
        </button>
      </div>
    </section>

    <main class="body">
      <section class="main-col">
        <div class="kpis">
          <div class="kpi"><span>候选片区</span><strong>{{ candidateCount }}</strong><i>全省公共数据筛选</i></div>
          <div class="kpi"><span>最高评分</span><strong class="green">{{ topScore }}</strong><i>{{ candidates[0]?.name }}</i></div>
          <div class="kpi"><span>平均客流</span><strong>{{ avgFlow }}</strong><i>旅游热度指数</i></div>
          <div class="kpi"><span>风险核验</span><strong class="amber">{{ riskCount }}</strong><i>需进入证据复核</i></div>
        </div>

        <section class="map-panel">
          <div class="panel-head">
            <div>
              <h2>贵州文旅商业选址态势</h2>
              <p>候选片区按综合评分排序，颜色代表当前风险等级。</p>
            </div>
            <div class="legend">
              <span v-for="(label, key) in statusLabel" :key="key"><i :style="{ background: statusColor[key] }"></i>{{ label }}</span>
            </div>
          </div>

          <div class="map">
            <svg class="dots" width="100%" height="100%">
              <defs>
                <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="14" cy="14" r="1" fill="#7da38f" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
            <svg class="province" viewBox="0 0 720 480" aria-hidden="true">
              <path
                d="M150 168 C170 120 230 96 296 100 C340 78 408 80 446 108 C500 92 566 110 588 158 C614 196 606 250 580 286 C600 320 596 372 558 396 C512 426 446 416 398 422 C352 452 286 446 244 414 C196 408 150 378 134 330 C108 300 100 248 120 210 C128 190 138 178 150 168 Z"
                fill="rgba(26,139,95,.07)"
                stroke="rgba(26,139,95,.28)"
                stroke-width="1.5"
              />
            </svg>
            <svg class="route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline :points="routePoints" />
            </svg>

            <button
              v-for="(item, index) in candidates"
              :key="item.id"
              class="point"
              :class="{ on: active === index }"
              :style="{ left: `${item.x}%`, top: `${item.y}%`, background: statusColor[item.status] }"
              type="button"
              @click="active = index"
            >
              {{ index + 1 }}
            </button>

            <div class="map-tag" :style="tagStyle">
              <div class="tag-line">
                <span class="badge" :style="{ background: `${statusColor[cur.status]}18`, color: statusColor[cur.status] }">{{ cur.tag }}</span>
                <strong>{{ cur.score }}</strong>
              </div>
              <div class="tag-name">{{ cur.name }}</div>
              <div class="tag-short">{{ cur.short }}</div>
            </div>
          </div>
        </section>

        <div class="chart-grid">
          <section class="panel">
            <div class="panel-title">综合评分对比</div>
            <v-chart class="chart" :option="barOption" autoresize @click="onBarClick" />
          </section>
          <section class="panel">
            <div class="panel-title">选中片区年度客流趋势</div>
            <v-chart class="chart" :option="flowOption" autoresize />
          </section>
        </div>

        <section class="evidence panel">
          <div class="panel-head compact">
            <div>
              <h2>风险证据与落地动作</h2>
              <p>{{ cur.city }} · {{ cur.county }} · {{ cur.scene }}</p>
            </div>
            <span class="badge" :style="{ background: `${statusColor[cur.status]}18`, color: statusColor[cur.status] }">
              {{ cur.riskLabel || statusLabel[cur.status] }}
            </span>
          </div>
          <div class="evidence-grid">
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
      </section>

      <aside class="side-col">
        <section class="panel decision">
          <div class="panel-head compact">
            <div>
              <h2>AI 决策摘要</h2>
              <p>最后更新：{{ lastUpdated }}</p>
            </div>
            <span class="badge dark">闭环</span>
          </div>
          <div class="summary">{{ reportSummary }}</div>
          <div class="chain">
            <span>公共数据</span>
            <i></i>
            <span>评分模型</span>
            <i></i>
            <span>风险证据</span>
            <i></i>
            <span>选址报告</span>
          </div>
          <p v-if="errorMessage" class="warn-text">{{ errorMessage }}</p>
        </section>

        <section class="panel radar-panel">
          <div class="panel-head compact">
            <div>
              <h2>片区画像</h2>
              <p>{{ cur.name }}</p>
            </div>
            <span class="score" :style="{ color: statusColor[cur.status] }">{{ cur.score }}</span>
          </div>
          <v-chart class="radar" :option="radarOption" autoresize />
        </section>

        <section class="panel">
          <div class="panel-title">候选片区排序</div>
          <div class="rank">
            <button
              v-for="(item, index) in candidates"
              :key="item.id"
              class="rank-row"
              :class="{ on: active === index }"
              type="button"
              @click="active = index"
            >
              <span class="idx" :style="active === index ? { background: `${statusColor[item.status]}18`, color: statusColor[item.status] } : {}">{{ index + 1 }}</span>
              <span>
                <b>{{ item.name }}</b>
                <em>{{ item.short }}</em>
              </span>
              <strong :style="{ color: statusColor[item.status] }">{{ item.score }}</strong>
            </button>
          </div>
        </section>

        <section class="panel source-panel">
          <div class="panel-title">公共数据接入</div>
          <div class="source-count">{{ sourceCount }} 类</div>
          <p>{{ selectedSourceText }}</p>
        </section>
      </aside>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }

.app {
  min-height: 100vh;
  background: #f3f6f4;
  color: #16251f;
  font-family: "PingFang SC", "Microsoft YaHei", "Segoe UI", Arial, sans-serif;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid #dfe8e3;
}

.brand,
.tools,
.scenes,
.select-group,
.legend,
.tag-line,
.chain {
  display: flex;
  align-items: center;
}

.brand { gap: 12px; }

.mark {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #176846;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}

.brand-name { font-size: 17px; font-weight: 700; }
.brand-sub { margin-top: 2px; font-size: 12px; color: #6f8278; }

.tools { gap: 10px; }

.api {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #dfe8e3;
  color: #50675c;
  font-size: 12px;
  background: #f8fbf9;
}

.api i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c9862b;
}

.api.online i { background: #1a8b5f; }
.api.offline i { background: #c9862b; }

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
.solid {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
}

.ghost {
  color: #176846;
  background: #eef7f2;
  border: 1px solid #cfe3d8;
}

.solid {
  color: #fff;
  background: #176846;
}

.filters {
  max-width: 1440px;
  margin: 0 auto;
  padding: 12px 16px 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.select-group {
  gap: 8px;
  flex-wrap: wrap;
}

label {
  height: 38px;
  padding-left: 10px;
  border: 1px solid #dfe8e3;
  border-radius: 8px;
  background: #fff;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6f8278;
}

select {
  height: 36px;
  min-width: 108px;
  border: 0;
  outline: 0;
  padding: 0 28px 0 2px;
  background: transparent;
  color: #1d3028;
  font-size: 13px;
}

.scenes { gap: 8px; flex-wrap: wrap; justify-content: flex-end; }

.scenes button {
  height: 38px;
  padding: 0 13px;
  border-radius: 8px;
  border: 1px solid #dfe8e3;
  background: #fff;
  color: #50675c;
  font-size: 13px;
}

.scenes button.on {
  border-color: #176846;
  background: #edf7f2;
  color: #176846;
  font-weight: 700;
}

.body {
  max-width: 1440px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 382px;
  gap: 16px;
}

.main-col,
.side-col {
  display: grid;
  gap: 16px;
  align-content: start;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.kpi,
.panel,
.map-panel {
  border: 1px solid #dfe8e3;
  border-radius: 8px;
  background: #fff;
}

.kpi {
  padding: 16px;
  min-width: 0;
}

.kpi span,
.kpi i {
  display: block;
  overflow: hidden;
  color: #6f8278;
  font-size: 12px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi strong {
  display: block;
  margin: 5px 0 3px;
  font-size: 30px;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.kpi .green { color: #176846; }
.kpi .amber { color: #c9862b; }

.map-panel { overflow: hidden; }

.panel-head {
  min-height: 58px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e7eee9;
}

.panel-head.compact {
  min-height: 0;
  padding-bottom: 12px;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  font-size: 14px;
  line-height: 1.2;
}

.panel-head p,
.source-panel p {
  margin-top: 5px;
  color: #6f8278;
  font-size: 12px;
  line-height: 1.6;
}

.legend {
  gap: 12px;
  padding: 7px 10px;
  border: 1px solid #dfe8e3;
  border-radius: 8px;
  background: #f8fbf9;
  color: #50675c;
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

.map {
  position: relative;
  height: 438px;
  overflow: hidden;
  background: linear-gradient(160deg, #e6efe9, #f4f8f5 52%, #e8f1ec);
}

.dots,
.province,
.route {
  position: absolute;
  inset: 0;
}

.dots { opacity: .33; }

.province {
  inset: 42px 62px 34px;
  width: calc(100% - 124px);
  height: calc(100% - 76px);
}

.route {
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route polyline {
  fill: none;
  stroke: rgba(23, 104, 70, .34);
  stroke-width: .55;
  stroke-dasharray: 2 1.6;
  vector-effect: non-scaling-stroke;
}

.point {
  position: absolute;
  z-index: 4;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
  border: 3px solid #fff;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 5px 13px rgba(20, 38, 30, .18);
  transition: transform .16s ease, width .16s ease, height .16s ease, box-shadow .16s ease;
}

.point.on {
  z-index: 8;
  width: 42px;
  height: 42px;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, .9), 0 12px 28px rgba(20, 38, 30, .22);
}

.map-tag {
  position: absolute;
  z-index: 9;
  width: 206px;
  padding: 11px 12px;
  border: 1px solid #d7e3dc;
  border-radius: 8px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 12px 28px rgba(20, 38, 30, .12);
}

.tag-line {
  justify-content: space-between;
}

.tag-line strong {
  font-size: 22px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}

.badge.dark {
  color: #ffffff;
  background: #233b31;
}

.tag-name {
  margin-top: 9px;
  overflow: hidden;
  color: #16251f;
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-short {
  margin-top: 4px;
  overflow: hidden;
  color: #6f8278;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.panel {
  padding: 16px;
  min-width: 0;
}

.panel-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
}

.chart {
  height: 164px;
}

.evidence {
  padding: 0;
  overflow: hidden;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: #e7eee9;
}

.evidence-grid > div {
  min-height: 128px;
  padding: 14px;
  background: #fff;
}

.evidence-grid h3 {
  margin-bottom: 8px;
  color: #176846;
  font-size: 13px;
}

.evidence-grid p {
  position: relative;
  margin-top: 7px;
  padding-left: 12px;
  color: #42594f;
  font-size: 12px;
  line-height: 1.55;
}

.evidence-grid p::before {
  content: "";
  position: absolute;
  left: 0;
  top: .65em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #9cb6a8;
}

.decision {
  background: linear-gradient(180deg, #ffffff, #f7fbf8);
}

.summary {
  padding: 13px 0 4px;
  color: #31483e;
  font-size: 13px;
  line-height: 1.75;
}

.chain {
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 12px;
}

.chain span {
  height: 26px;
  padding: 0 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  background: #edf6f1;
  color: #176846;
  font-size: 12px;
  font-weight: 700;
}

.chain i {
  width: 14px;
  height: 1px;
  background: #b7c9c0;
}

.warn-text {
  margin-top: 10px;
  color: #c9862b;
  font-size: 12px;
}

.radar-panel {
  padding-bottom: 10px;
}

.score {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.radar {
  height: 232px;
}

.rank {
  display: grid;
  gap: 8px;
}

.rank-row {
  width: 100%;
  min-height: 56px;
  padding: 9px 10px;
  border: 1px solid #e3ebe6;
  border-radius: 8px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  background: #fff;
  text-align: left;
}

.rank-row.on {
  border-color: #9bc7b1;
  background: #f4fbf7;
}

.idx {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #edf2ef;
  color: #6f8278;
  font-size: 13px;
  font-weight: 700;
}

.rank-row b,
.rank-row em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-row b {
  color: #182820;
  font-size: 13px;
  font-style: normal;
}

.rank-row em {
  margin-top: 3px;
  color: #6f8278;
  font-size: 11px;
  font-style: normal;
}

.rank-row strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}

.source-panel {
  padding-bottom: 18px;
}

.source-count {
  margin-top: 6px;
  color: #176846;
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}

@media (max-width: 1180px) {
  .body {
    grid-template-columns: 1fr;
  }

  .side-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .source-panel {
    grid-column: span 2;
  }
}

@media (max-width: 900px) {
  .top,
  .filters {
    align-items: flex-start;
    flex-direction: column;
  }

  .top {
    height: auto;
    padding: 14px 16px;
    gap: 12px;
  }

  .filters {
    padding-top: 12px;
  }

  .kpis,
  .chart-grid,
  .evidence-grid,
  .side-col {
    grid-template-columns: 1fr;
  }

  .source-panel {
    grid-column: auto;
  }

  .map {
    height: 380px;
  }

  .map-tag {
    width: 190px;
  }
}
</style>
