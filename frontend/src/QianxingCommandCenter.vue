<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const API_ENDPOINTS = {
  health: "/api/health",
  sources: "/api/sources",
  locations: "/api/locations",
  integration: "/api/integration-status",
  recommend: "/api/recommend",
  dataRequest: "/api/data-request",
  report: "/api/report",
  landingPlan: "/api/landing-plan",
  guideSummary: "/api/guide-summary"
};

const scenarioPresets = [
  {
    id: "family-rain",
    label: "亲子雨天",
    text: "带父母和孩子去贵州玩两天，不想太累，担心下雨路滑，希望路线稳一点。",
    type: "家庭亲子",
    weather: "小雨",
    days: 2,
    intensity: 32,
    region: "全省文旅片区",
    strategy: "policy"
  },
  {
    id: "study-tour",
    label: "研学团队",
    text: "40名学生研学旅行，需要红色文化、非遗体验和安全集散点，要求应急服务明确。",
    type: "研学团队",
    weather: "多云",
    days: 3,
    intensity: 58,
    region: "遵义",
    strategy: "traffic"
  },
  {
    id: "silver-health",
    label: "银发康养",
    text: "银发康养团队，节奏要慢，住宿和医疗服务要稳，尽量避开拥堵和高坡度路段。",
    type: "银发康养",
    weather: "阴",
    days: 4,
    intensity: 28,
    region: "黔东南",
    strategy: "cost"
  },
  {
    id: "festival-flow",
    label: "节假日客流",
    text: "节假日想去热门景区，需要避开拥堵，优先选择换乘成熟、服务点密集的路线。",
    type: "自由行游客",
    weather: "晴",
    days: 2,
    intensity: 66,
    region: "全省文旅片区",
    strategy: "flow"
  }
];

const cityCoordinates = {
  贵阳: [106.6302, 26.6477],
  安顺: [105.9476, 26.2531],
  遵义: [106.9272, 27.7257],
  黔东南: [107.9828, 26.5834],
  黔南: [107.5223, 26.2543],
  黔西南: [104.9064, 25.0878],
  毕节: [105.2916, 27.2839],
  铜仁: [109.1895, 27.7315],
  六盘水: [104.8303, 26.5927]
};

const locationCoordinates = {
  anshun_huangguoshu: [105.6748, 25.9896],
  guiyang_qingyan: [106.6789, 26.3384],
  zunyi_maotai: [106.3801, 27.7921],
  qiandongnan_xijiang: [108.1739, 26.4936],
  qiannan_libo: [107.8867, 25.4108],
  qianxinan_wanfenglin: [104.8957, 25.0402],
  bijie_baili: [105.9231, 27.2058],
  tongren_fanjing: [108.7493, 27.8941],
  liupanshui_meihuashan: [104.7794, 26.6087],
  guiyang_shuanglong: [106.7897, 26.5462]
};

const amapEl = ref(null);
const health = ref(null);
const integration = ref(null);
const sources = ref([]);
const locations = ref([]);
const recommendation = ref(null);
const guide = ref(null);
const dataRequest = ref([]);
const landingPlan = ref(null);
const reportText = ref("");
const selectedId = ref("");
const loading = ref(false);
const booting = ref(true);
const apiError = ref("");
const lastUpdated = ref("");
const amapStatus = ref({
  ready: false,
  mode: "fallback",
  label: "高德地图待配置",
  detail: "未检测到 VITE_AMAP_JSAPI_KEY，当前使用可交互态势底图。"
});
const activeRunStep = ref(0);
const activeRouteIndex = ref(0);
const isPlaying = ref(false);
const routeProgress = ref(0);
const selectedLayer = ref("risk");
const toast = ref("");

const form = ref({
  request: scenarioPresets[0].text,
  type: scenarioPresets[0].type,
  weather: scenarioPresets[0].weather,
  days: scenarioPresets[0].days,
  intensity: scenarioPresets[0].intensity,
  region: scenarioPresets[0].region,
  strategy: scenarioPresets[0].strategy
});

let amapInstance = null;
let amapRuntime = null;
let amapMarkers = [];
let amapPolyline = null;
let loaderPromise = null;
let playbackTimer = null;
let toastTimer = null;

const activePresetId = computed(() => {
  const matched = scenarioPresets.find((preset) => preset.text === form.value.request);
  return matched?.id || "";
});

const routeNodes = computed(() => {
  const list = recommendation.value?.candidates?.length ? recommendation.value.candidates : locations.value;
  return list.slice(0, 6).map((item, index) => decorateLocation(item, index));
});

const selectedNode = computed(() => {
  return routeNodes.value.find((item) => item.id === selectedId.value) || routeNodes.value[0] || null;
});

const topNode = computed(() => routeNodes.value[0] || null);

const highestRiskNode = computed(() => {
  if (!routeNodes.value.length) return null;
  return [...routeNodes.value].sort((a, b) => b.riskScore - a.riskScore)[0];
});

const statusPills = computed(() => {
  const services = integration.value?.services || [];
  const connected = services.filter((service) => service.status === "connected").length;
  return [
    {
      label: health.value?.ok ? "本地 API 正常" : "API 检测中",
      tone: health.value?.ok ? "good" : "wait",
      value: health.value?.mode || "local"
    },
    {
      label: integration.value?.mode === "remote-ascend" ? "远程昇腾推理" : "本地模拟推理",
      tone: integration.value?.mode === "remote-ascend" ? "good" : "warn",
      value: integration.value?.deployment?.aiLayer || "可替换为 MindIE/vLLM Ascend"
    },
    {
      label: amapStatus.value.ready ? "高德 JSAPI 已接入" : "高德地图降级",
      tone: amapStatus.value.ready ? "good" : "warn",
      value: amapStatus.value.label
    },
    {
      label: `${connected}/${services.length || 8} 接口在线`,
      tone: connected >= 7 ? "good" : "warn",
      value: lastUpdated.value || "等待同步"
    }
  ];
});

const missionMetrics = computed(() => [
  {
    label: "推荐主线",
    value: topNode.value?.city || "贵州",
    caption: topNode.value?.name || "等待路线生成"
  },
  {
    label: "最高风险点",
    value: highestRiskNode.value ? `${highestRiskNode.value.riskScore}` : "--",
    caption: highestRiskNode.value?.name || "待评估"
  },
  {
    label: "公共数据源",
    value: sources.value.length || "--",
    caption: "工商 / 信用 / 客流 / 交通 / POI"
  },
  {
    label: "落地对象",
    value: "4类",
    caption: "景区、文旅局、研学、康养"
  }
]);

const decisionChain = computed(() => [
  {
    title: "游客自然语言",
    value: truncate(form.value.request, 36),
    state: "done"
  },
  {
    title: "后端代理",
    value: health.value?.service || "qianzhi-public-data",
    state: health.value?.ok ? "done" : "wait"
  },
  {
    title: "MindIE / vLLM Ascend",
    value: integration.value?.mode === "remote-ascend" ? "远程推理" : "本地模拟占位",
    state: integration.value?.mode === "remote-ascend" ? "done" : "warn"
  },
  {
    title: "风险模型",
    value: topNode.value ? `${topNode.value.riskLevel} · ${topNode.value.riskScore}` : "等待评估",
    state: topNode.value ? "done" : "wait"
  },
  {
    title: "决策摘要",
    value: guide.value?.landingReady ? "已生成" : "待生成",
    state: guide.value?.landingReady ? "done" : "wait"
  }
]);

const workflowSteps = computed(() => [
  {
    label: "需求解析",
    caption: `${form.value.type} · ${form.value.weather} · ${form.value.days}天`,
    detail: "提取老人儿童、雨天路滑、路线强度等约束"
  },
  {
    label: "公共数据召回",
    caption: `${sources.value.length || 8} 类数据目录`,
    detail: "召回景区热度、交通可达、信用风险、POI 服务点"
  },
  {
    label: "昇腾推理位",
    caption: integration.value?.mode === "remote-ascend" ? "远程推理" : "本地模拟",
    detail: "后端代理可替换 MindIE / vLLM Ascend 推理服务"
  },
  {
    label: "风险评分",
    caption: highestRiskNode.value ? `${highestRiskNode.value.name} ${highestRiskNode.value.riskScore}` : "待计算",
    detail: "综合坡度、拥堵、交通、信用与服务点覆盖"
  },
  {
    label: "应急建议",
    caption: selectedNode.value?.riskLevel || "待选择",
    detail: "联动景区服务中心、换乘点、文旅应急联络点"
  },
  {
    label: "试点落地",
    caption: landingPlan.value?.targetArea || "候选片区",
    detail: "输出数据授权、模型试运行、示范点落地路线"
  }
]);

const operationProgress = computed(() => {
  if (loading.value) return routeProgress.value;
  if (isPlaying.value && routeNodes.value.length) {
    return Math.round(((activeRouteIndex.value + 1) / routeNodes.value.length) * 100);
  }
  return guide.value?.landingReady ? 100 : 0;
});

const playbackNode = computed(() => routeNodes.value[activeRouteIndex.value] || selectedNode.value);

const serviceMapPoints = computed(() => {
  if (!selectedNode.value) return [];
  const base = projectPoint(selectedNode.value.lng, selectedNode.value.lat);
  return [
    { label: "服务台", x: clamp(base.x + 5, 8, 92), y: clamp(base.y - 8, 8, 90) },
    { label: "医疗点", x: clamp(base.x - 7, 8, 92), y: clamp(base.y + 7, 8, 90) },
    { label: "换乘点", x: clamp(base.x + 9, 8, 92), y: clamp(base.y + 9, 8, 90) }
  ];
});

const runtimeCards = computed(() => [
  {
    title: "高德 Web JSAPI",
    status: amapKey() ? "已配置" : "待配置",
    tone: amapKey() ? "good" : "warn",
    detail: amapKey() ? "VITE_AMAP_JSAPI_KEY 已读取" : "配置 Key 后切换真实 3D 地图、点位和路线折线",
    env: "VITE_AMAP_JSAPI_KEY"
  },
  {
    title: "高德安全密钥",
    status: amapSecurityCode() || amapServiceHost() ? "已配置" : "建议配置",
    tone: amapSecurityCode() || amapServiceHost() ? "good" : "warn",
    detail: "生产环境建议使用代理 serviceHost，避免 securityJsCode 暴露",
    env: "VITE_AMAP_SECURITY_CODE / VITE_AMAP_SERVICE_HOST"
  },
  {
    title: "昇腾推理服务",
    status: ascendEndpoint() ? "可接入" : "本地模拟",
    tone: ascendEndpoint() ? "good" : "warn",
    detail: ascendEndpoint() ? "已配置远程推理入口" : "预留 MindIE / vLLM Ascend 后端代理入口",
    env: "VITE_ASCEND_ENDPOINT"
  },
  {
    title: "公共数据授权",
    status: sources.value.length >= 6 ? "目录就绪" : "待授权",
    tone: sources.value.length >= 6 ? "good" : "wait",
    detail: "用于赛事公共数据赛道答辩：先目录申请，再字段授权，再试点复核",
    env: "PUBLIC_DATA_GRANT_ID"
  }
]);

const readinessItems = computed(() => [
  {
    label: "可演示",
    value: health.value?.ok && guide.value?.landingReady ? "通过" : "检测中",
    tone: health.value?.ok && guide.value?.landingReady ? "good" : "wait"
  },
  {
    label: "可接入",
    value: amapKey() || ascendEndpoint() ? "部分就绪" : "待配置",
    tone: amapKey() || ascendEndpoint() ? "good" : "warn"
  },
  {
    label: "可试点",
    value: landingPlan.value?.phases?.length ? "有路径" : "待生成",
    tone: landingPlan.value?.phases?.length ? "good" : "wait"
  }
]);

const routeSummary = computed(() => {
  if (!topNode.value) return "输入游客需求后，系统会结合公共数据样本生成贵州山地文旅路线、安全风险和落地建议。";
  return `建议以 ${topNode.value.name} 作为首站，串联 ${routeNodes.value
    .slice(1, 4)
    .map((item) => item.city)
    .join("、")} 等片区；当前最高风险来自 ${highestRiskNode.value?.name || "待评估"}。`;
});

const evidenceGroups = computed(() => {
  if (!selectedNode.value) return [];
  return [
    {
      title: "风险来源",
      items: selectedNode.value.evidence
    },
    {
      title: "建议动作",
      items: selectedNode.value.actions
    },
    {
      title: "应急服务点",
      items: selectedNode.value.servicePoints
    },
    {
      title: "数据来源",
      items: selectedNode.value.dataNeed
    }
  ];
});

const sourceRows = computed(() => {
  return sources.value.slice(0, 8).map((source, index) => ({
    ...source,
    phase: index < 3 ? "核心" : index < 6 ? "增强" : "验证"
  }));
});

const apiRows = computed(() => integration.value?.services || []);

const mapPoints = computed(() => routeNodes.value.map((node) => ({ ...node, ...projectPoint(node.lng, node.lat) })));

const routePath = computed(() => {
  if (!mapPoints.value.length) return "";
  return mapPoints.value.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
});

function truncate(value, length) {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function coordinateFor(item) {
  return locationCoordinates[item.id] || cityCoordinates[item.city] || [106.7135, 26.5783];
}

function projectPoint(lng, lat) {
  const minLng = 103.6;
  const maxLng = 109.8;
  const minLat = 24.7;
  const maxLat = 28.4;
  const x = ((lng - minLng) / (maxLng - minLng)) * 78 + 11;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 68 + 16;
  return {
    x: Number(clamp(x, 7, 93).toFixed(1)),
    y: Number(clamp(y, 9, 88).toFixed(1))
  };
}

function strategyLabel(value) {
  const labels = {
    balanced: "均衡安全",
    flow: "客流优先",
    traffic: "交通稳态",
    policy: "服务保障",
    cost: "低强度康养"
  };
  return labels[value] || "均衡安全";
}

function riskTone(score) {
  if (score >= 76) return "high";
  if (score >= 58) return "medium";
  return "low";
}

function riskLevel(score) {
  if (score >= 76) return "高风险";
  if (score >= 58) return "需关注";
  return "可控";
}

function weatherPenalty() {
  const weather = form.value.weather;
  if (weather.includes("雨")) return 12;
  if (weather.includes("雾")) return 9;
  if (weather.includes("阴")) return 4;
  return 0;
}

function decorateLocation(item, index) {
  const [lng, lat] = coordinateFor(item);
  const slope = clamp((item.rentPressure || 50) * 0.45 + index * 4 + weatherPenalty() * 0.25, 12, 48);
  const crowding = clamp((item.touristFlow || 60) * 0.62 + (item.businessDensity || 50) * 0.24, 22, 96);
  const service = clamp((item.poiMaturity || 55) * 0.68 + (item.trafficAccess || 55) * 0.22, 30, 98);
  const riskScore = clamp(
    (item.creditRisk || 15) * 1.35 +
      (100 - (item.trafficAccess || 60)) * 0.3 +
      (item.businessDensity || 50) * 0.24 +
      (item.rentPressure || 45) * 0.22 +
      weatherPenalty() +
      Number(form.value.intensity) * 0.08 -
      service * 0.16,
    18,
    96
  );
  const risk = riskLevel(riskScore);
  const tone = riskTone(riskScore);
  return {
    ...item,
    lng,
    lat,
    order: index + 1,
    score: item.score || clamp(100 - riskScore + service * 0.18, 50, 96),
    riskScore,
    riskLevel: risk,
    tone,
    slope,
    distance: `${clamp(42 + index * 37 + (100 - (item.trafficAccess || 70)) * 0.5, 35, 260)}km`,
    crowding,
    service,
    tags: buildTags(item, risk, tone),
    evidence: buildEvidence(item, slope, crowding),
    actions: buildActions(item, tone),
    servicePoints: buildServicePoints(item)
  };
}

function buildTags(item, risk, tone) {
  const tags = [item.scene || "文旅片区", risk];
  if ((item.trafficAccess || 0) >= 78) tags.push("换乘成熟");
  if ((item.policyFit || 0) >= 75) tags.push("政策匹配");
  if (tone === "high") tags.push("需人工复核");
  return tags.slice(0, 4);
}

function buildEvidence(item, slope, crowding) {
  const defaults = [
    `${item.city}${item.county ? `·${item.county}` : ""} 山地出行坡度估算 ${slope} 分`,
    `节假日客流压力 ${crowding} 分，需联动景区承载量`,
    `交通可达性 ${item.trafficAccess || "--"} 分，影响老人儿童换乘安全`
  ];
  const risks = item.risks?.length ? item.risks : [];
  return [...defaults, ...risks].slice(0, 5);
}

function buildActions(item, tone) {
  const defaults = [
    tone === "high" ? "生成红色预警并触发人工复核" : "生成黄色观察任务并保留备选路线",
    "向游客端推送雨天防滑和换乘提醒",
    "同步景区服务台、医疗点和停车换乘信息"
  ];
  return [...defaults, ...(item.actions || [])].slice(0, 5);
}

function buildServicePoints(item) {
  return [
    `${item.name.replace("片区", "")}游客服务中心`,
    `${item.city}文旅应急联络点`,
    `${item.county || item.city}交通换乘点`
  ];
}

function optionsFromForm() {
  const intensity = Number(form.value.intensity);
  return {
    naturalLanguage: form.value.request,
    visitorType: form.value.type,
    weather: form.value.weather,
    days: Number(form.value.days),
    intensity,
    region: form.value.region,
    strategy: form.value.strategy,
    businessType: form.value.type === "研学团队" ? "研学服务" : "景区餐饮",
    budget: intensity >= 65 ? "flagship" : intensity <= 35 ? "light" : "standard",
    weights: {
      flow: form.value.strategy === "flow" ? 10 : 8,
      traffic: form.value.weather.includes("雨") || form.value.type.includes("银发") ? 10 : 8,
      blank: 6,
      policy: form.value.strategy === "policy" ? 10 : 7,
      risk: form.value.weather.includes("雨") || form.value.type.includes("亲子") ? 10 : 8
    }
  };
}

async function apiGet(endpoint) {
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`${endpoint} ${response.status}`);
  return response.json();
}

async function apiPost(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${endpoint} ${response.status}`);
  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function showToast(message) {
  toast.value = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = "";
  }, 2400);
}

async function boot() {
  booting.value = true;
  apiError.value = "";
  try {
    const [healthPayload, sourcesPayload, locationsPayload, integrationPayload] = await Promise.all([
      apiGet(API_ENDPOINTS.health),
      apiGet(API_ENDPOINTS.sources),
      apiGet(API_ENDPOINTS.locations),
      apiGet(API_ENDPOINTS.integration)
    ]);
    health.value = healthPayload;
    sources.value = sourcesPayload.sources || [];
    locations.value = locationsPayload.locations || [];
    integration.value = integrationPayload;
    if (!selectedId.value && locations.value[0]) selectedId.value = locations.value[0].id;
    await generateRoute();
    await nextTick();
    await initAmap();
  } catch (error) {
    apiError.value = error.message || "接口初始化失败";
  } finally {
    booting.value = false;
  }
}

async function generateRoute() {
  stopRoute(false);
  loading.value = true;
  apiError.value = "";
  routeProgress.value = 12;
  activeRunStep.value = 0;
  try {
    await sleep(120);
    activeRunStep.value = 1;
    routeProgress.value = 32;
    const options = optionsFromForm();
    await sleep(120);
    activeRunStep.value = 2;
    routeProgress.value = 58;
    const [recommendPayload, guidePayload, dataPayload, landingPayload, reportPayload] = await Promise.all([
      apiPost(API_ENDPOINTS.recommend, options),
      apiPost(API_ENDPOINTS.guideSummary, options),
      apiPost(API_ENDPOINTS.dataRequest, options),
      apiPost(API_ENDPOINTS.landingPlan, options),
      apiPost(API_ENDPOINTS.report, options)
    ]);
    activeRunStep.value = 3;
    routeProgress.value = 78;
    recommendation.value = recommendPayload;
    guide.value = guidePayload;
    dataRequest.value = dataPayload.request || [];
    landingPlan.value = landingPayload.plan || null;
    reportText.value = reportPayload.report || "";
    selectedId.value = recommendPayload.top?.id || routeNodes.value[0]?.id || selectedId.value;
    activeRouteIndex.value = Math.max(
      0,
      routeNodes.value.findIndex((node) => node.id === selectedId.value)
    );
    lastUpdated.value = new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
    activeRunStep.value = 5;
    routeProgress.value = 100;
    await nextTick();
    renderAmapRoute();
    showToast("路线、风险证据和落地计划已刷新");
  } catch (error) {
    apiError.value = error.message || "路线生成失败";
    showToast("接口调用失败，请检查后端服务");
  } finally {
    loading.value = false;
  }
}

function applyPreset(preset) {
  form.value = {
    request: preset.text,
    type: preset.type,
    weather: preset.weather,
    days: preset.days,
    intensity: preset.intensity,
    region: preset.region,
    strategy: preset.strategy
  };
  generateRoute();
}

function selectNode(node) {
  selectedId.value = node.id;
  const index = routeNodes.value.findIndex((item) => item.id === node.id);
  if (index >= 0) activeRouteIndex.value = index;
  if (amapInstance && amapRuntime) {
    amapInstance.setZoomAndCenter(8.2, [node.lng, node.lat], false, 220);
  }
}

function setStrategy(strategy) {
  form.value.strategy = strategy;
}

function playRoute() {
  if (!routeNodes.value.length) return;
  if (isPlaying.value) {
    stopRoute(true);
    return;
  }
  isPlaying.value = true;
  activeRunStep.value = 0;
  activeRouteIndex.value = 0;
  selectNode(routeNodes.value[0]);
  showToast("进入路演推演模式：路线、风险证据、应急点联动播放");
  playbackTimer = window.setInterval(() => {
    const nextIndex = activeRouteIndex.value + 1;
    if (nextIndex >= routeNodes.value.length) {
      stopRoute(false);
      activeRunStep.value = 5;
      showToast("推演完成，可切换场景或配置真实接入");
      return;
    }
    activeRouteIndex.value = nextIndex;
    activeRunStep.value = Math.min(5, nextIndex);
    selectNode(routeNodes.value[nextIndex]);
  }, 1250);
}

function stopRoute(notify = true) {
  if (playbackTimer) {
    window.clearInterval(playbackTimer);
    playbackTimer = null;
  }
  if (isPlaying.value && notify) showToast("已暂停现场推演");
  isPlaying.value = false;
}

function selectLayer(layer) {
  selectedLayer.value = layer;
  const labels = {
    risk: "已切换风险热区",
    service: "已显示应急服务点",
    flow: "已切换客流压力层",
    data: "已显示公共数据证据层"
  };
  showToast(labels[layer] || "地图图层已切换");
}

async function copyEnvTemplate() {
  const template = [
    "VITE_AMAP_JSAPI_KEY=你的高德Web端Key",
    "VITE_AMAP_SECURITY_CODE=你的高德安全密钥",
    "VITE_AMAP_SERVICE_HOST=https://你的代理域名/_AMapService",
    "VITE_ASCEND_ENDPOINT=https://你的MindIE或vLLM-Ascend代理地址",
    "PUBLIC_DATA_GRANT_ID=公共数据授权编号"
  ].join("\n");
  try {
    await navigator.clipboard?.writeText(template);
    showToast("落地环境变量模板已复制");
  } catch {
    showToast("当前浏览器不允许复制，可在代码中查看变量模板");
  }
}

function amapKey() {
  return import.meta.env.VITE_AMAP_JSAPI_KEY || "";
}

function amapSecurityCode() {
  return import.meta.env.VITE_AMAP_SECURITY_CODE || "";
}

function amapServiceHost() {
  return import.meta.env.VITE_AMAP_SERVICE_HOST || "";
}

function ascendEndpoint() {
  return import.meta.env.VITE_ASCEND_ENDPOINT || "";
}

function ensureAmapLoader() {
  if (window.AMapLoader) return Promise.resolve(window.AMapLoader);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://webapi.amap.com/loader.js";
    script.async = true;
    script.onload = () => resolve(window.AMapLoader);
    script.onerror = () => reject(new Error("高德 loader.js 加载失败"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

async function initAmap() {
  if (!amapEl.value) return;
  if (!amapKey()) {
    amapStatus.value = {
      ready: false,
      mode: "fallback",
      label: "高德地图待配置",
      detail: "配置 VITE_AMAP_JSAPI_KEY 后自动切换真实 WebGL 地图。"
    };
    return;
  }
  try {
    const security = amapSecurityCode();
    const serviceHost = amapServiceHost();
    if (security || serviceHost) {
      window._AMapSecurityConfig = {
        ...(security ? { securityJsCode: security } : {}),
        ...(serviceHost ? { serviceHost } : {})
      };
    }
    const loader = await ensureAmapLoader();
    const AMap = await loader.load({
      key: amapKey(),
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.ControlBar"]
    });
    AMap.getConfig().appname = "amap-jsapi-skill";
    amapRuntime = AMap;
    amapInstance = new AMap.Map(amapEl.value, {
      viewMode: "3D",
      zoom: 7.2,
      pitch: 38,
      rotation: -4,
      center: [106.7135, 26.5783],
      mapStyle: "amap://styles/whitesmoke"
    });
    amapInstance.addControl(new AMap.Scale());
    amapInstance.addControl(new AMap.ToolBar({ position: "RT" }));
    amapStatus.value = {
      ready: true,
      mode: "amap",
      label: "高德 JSAPI v2.0",
      detail: "WebGL 地图、点位、路线折线已接入。"
    };
    renderAmapRoute();
  } catch (error) {
    amapStatus.value = {
      ready: false,
      mode: "fallback",
      label: "高德地图降级",
      detail: error.message || "地图初始化失败，已切回态势底图。"
    };
  }
}

function renderAmapRoute() {
  if (!amapInstance || !amapRuntime || !routeNodes.value.length) return;
  if (amapMarkers.length) {
    amapInstance.remove(amapMarkers);
    amapMarkers = [];
  }
  if (amapPolyline) {
    amapInstance.remove(amapPolyline);
    amapPolyline = null;
  }
  amapMarkers = routeNodes.value.map((node) => {
    const marker = new amapRuntime.Marker({
      position: [node.lng, node.lat],
      title: node.name,
      anchor: "bottom-center",
      label: {
        content: `${node.order} · ${node.riskLevel}`,
        direction: "top"
      }
    });
    marker.on("click", () => selectNode(node));
    return marker;
  });
  amapPolyline = new amapRuntime.Polyline({
    path: routeNodes.value.map((node) => [node.lng, node.lat]),
    strokeColor: "rgba(0, 122, 81, 0.88)",
    strokeWeight: 5,
    strokeOpacity: 0.82,
    lineJoin: "round"
  });
  amapInstance.add([...amapMarkers, amapPolyline]);
  amapInstance.setFitView([...amapMarkers, amapPolyline], false, [80, 80, 80, 80], 8);
}

watch(routeNodes, () => {
  renderAmapRoute();
});

onMounted(boot);

onBeforeUnmount(() => {
  stopRoute(false);
  window.clearTimeout(toastTimer);
  if (amapInstance) {
    amapInstance.destroy();
    amapInstance = null;
  }
});
</script>

<template>
  <main class="qianxing-shell">
    <header class="topbar">
      <div class="identity">
        <div class="project-mark" aria-hidden="true">黔</div>
        <div>
          <p>贵州省人工智能创业大赛 · 公共数据与山地文旅安全</p>
          <h1>黔行守护 AI 决策舱</h1>
        </div>
      </div>
      <div class="status-strip" aria-label="系统接入状态">
        <span v-for="pill in statusPills" :key="pill.label" class="status-pill" :data-tone="pill.tone">
          <strong>{{ pill.label }}</strong>
          <small>{{ pill.value }}</small>
        </span>
      </div>
    </header>

    <section class="mission-band" aria-label="路演核心指标">
      <div class="mission-copy">
        <span>评审第一屏</span>
        <strong>从游客需求到公共数据证据，再到安全预警和落地计划</strong>
      </div>
      <dl v-for="metric in missionMetrics" :key="metric.label" class="mission-metric">
        <dt>{{ metric.label }}</dt>
        <dd>{{ metric.value }}</dd>
        <small>{{ metric.caption }}</small>
      </dl>
    </section>

    <section class="workspace-grid">
      <section class="task-panel" aria-label="游客任务书">
        <div class="panel-title">
          <div>
            <span>01</span>
            <h2>游客任务书</h2>
          </div>
          <div class="panel-actions">
            <button class="secondary-button" type="button" :disabled="loading" @click="playRoute">
              {{ isPlaying ? "暂停推演" : "现场推演" }}
            </button>
            <button class="ghost-button" type="button" :disabled="loading" @click="generateRoute">
              {{ loading ? "生成中" : "生成路线" }}
            </button>
          </div>
        </div>

        <label class="field-block">
          <span>自然语言需求</span>
          <textarea v-model="form.request" rows="5" />
        </label>

        <div class="quick-grid">
          <button
            v-for="preset in scenarioPresets"
            :key="preset.id"
            type="button"
            :class="{ active: activePresetId === preset.id }"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="control-grid">
          <label>
            <span>游客类型</span>
            <select v-model="form.type">
              <option>家庭亲子</option>
              <option>研学团队</option>
              <option>银发康养</option>
              <option>自由行游客</option>
            </select>
          </label>
          <label>
            <span>天气</span>
            <select v-model="form.weather">
              <option>晴</option>
              <option>多云</option>
              <option>阴</option>
              <option>小雨</option>
              <option>雾</option>
            </select>
          </label>
          <label>
            <span>天数</span>
            <input v-model.number="form.days" min="1" max="7" type="number" />
          </label>
          <label>
            <span>区域</span>
            <select v-model="form.region">
              <option>全省文旅片区</option>
              <option>贵阳</option>
              <option>安顺</option>
              <option>遵义</option>
              <option>黔东南</option>
              <option>黔南</option>
              <option>黔西南</option>
              <option>毕节</option>
              <option>铜仁</option>
              <option>六盘水</option>
            </select>
          </label>
        </div>

        <div class="intensity-row">
          <div>
            <span>路线强度</span>
            <strong>{{ form.intensity }}</strong>
          </div>
          <input v-model.number="form.intensity" min="20" max="85" type="range" />
        </div>

        <div class="strategy-row" aria-label="路线策略">
          <button
            v-for="strategy in ['balanced', 'flow', 'traffic', 'policy', 'cost']"
            :key="strategy"
            type="button"
            :class="{ active: form.strategy === strategy }"
            @click="setStrategy(strategy)"
          >
            {{ strategyLabel(strategy) }}
          </button>
        </div>

        <div class="run-progress" :data-active="loading || isPlaying">
          <div>
            <span>决策进度</span>
            <strong>{{ workflowSteps[activeRunStep]?.label }}</strong>
            <small>{{ workflowSteps[activeRunStep]?.caption }}</small>
          </div>
          <div class="progress-rail" aria-hidden="true">
            <i :style="{ width: `${operationProgress}%` }" />
          </div>
          <p>{{ workflowSteps[activeRunStep]?.detail }}</p>
        </div>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>
        <p v-else class="helper-line">当前接口保持兼容：health、recommend、guide-summary、data-request、landing-plan。</p>
      </section>

      <section class="map-panel" aria-label="贵州山地文旅态势图">
        <div class="map-head">
          <div>
            <span>02</span>
            <h2>贵州山地旅游态势图</h2>
          </div>
          <div class="map-mode">
            <strong>{{ amapStatus.label }}</strong>
            <small>{{ amapStatus.detail }}</small>
          </div>
          <div class="map-actions" aria-label="地图图层">
            <button
              v-for="layer in [
                { id: 'risk', label: '风险' },
                { id: 'service', label: '服务点' },
                { id: 'flow', label: '客流' },
                { id: 'data', label: '数据' }
              ]"
              :key="layer.id"
              type="button"
              :class="{ active: selectedLayer === layer.id }"
              @click="selectLayer(layer.id)"
            >
              {{ layer.label }}
            </button>
          </div>
        </div>

        <div class="map-stage">
          <div ref="amapEl" class="amap-layer" :class="{ visible: amapStatus.ready }" />
          <div class="fallback-map" :class="{ hidden: amapStatus.ready }">
            <svg viewBox="0 0 100 100" role="img" aria-label="贵州路线风险态势图">
              <path
                class="province-shape"
                d="M16 46 L22 30 L38 22 L52 26 L64 18 L80 25 L88 40 L82 56 L86 72 L66 80 L50 74 L34 82 L20 70 L13 58 Z"
              />
              <path class="route-line" :class="{ tracing: isPlaying }" :d="routePath" />
              <circle cx="24" cy="66" r="16" class="terrain-ring" />
              <circle cx="70" cy="34" r="22" class="terrain-ring muted" />
            </svg>
            <div
              v-for="point in mapPoints"
              v-show="selectedLayer === 'risk' || selectedLayer === 'flow'"
              :key="`${point.id}-heat`"
              class="heat-zone"
              :class="{ flow: selectedLayer === 'flow' }"
              :data-tone="point.tone"
              :style="{ left: `${point.x}%`, top: `${point.y}%`, '--heat-size': `${44 + point.riskScore * 0.55}px` }"
              aria-hidden="true"
            />
            <button
              v-for="point in mapPoints"
              :key="point.id"
              type="button"
              class="map-pin"
              :class="{ selected: selectedNode?.id === point.id, playing: playbackNode?.id === point.id && isPlaying }"
              :data-tone="point.tone"
              :style="{ left: `${point.x}%`, top: `${point.y}%` }"
              @click="selectNode(point)"
            >
              <span>{{ point.order }}</span>
              <strong>{{ point.city }}</strong>
            </button>
            <div
              v-for="service in serviceMapPoints"
              v-show="selectedLayer === 'service'"
              :key="service.label"
              class="service-dot"
              :style="{ left: `${service.x}%`, top: `${service.y}%` }"
            >
              <span />
              <strong>{{ service.label }}</strong>
            </div>
            <div
              v-if="playbackNode"
              class="traveler-chip"
              :style="{ left: `${projectPoint(playbackNode.lng, playbackNode.lat).x}%`, top: `${projectPoint(playbackNode.lng, playbackNode.lat).y}%` }"
            >
              <small>推演中</small>
              <strong>{{ playbackNode.name }}</strong>
            </div>
          </div>

          <div class="map-hud">
            <div v-for="item in readinessItems" :key="item.label" :data-tone="item.tone">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <div class="map-legend">
            <span><i data-tone="low" />可控</span>
            <span><i data-tone="medium" />需关注</span>
            <span><i data-tone="high" />高风险</span>
          </div>

          <div class="map-live-strip" aria-label="现场事件流">
            <button
              v-for="(step, index) in workflowSteps.slice(0, 4)"
              :key="step.label"
              type="button"
              :class="{ active: activeRunStep === index, done: activeRunStep > index }"
              @click="activeRunStep = index"
            >
              <span>{{ step.label }}</span>
              <strong>{{ step.caption }}</strong>
            </button>
          </div>
        </div>
      </section>

      <aside class="decision-panel" aria-label="AI 决策摘要">
        <div class="panel-title compact">
          <div>
            <span>03</span>
            <h2>AI 决策摘要</h2>
          </div>
          <strong>{{ guide?.mode || "local-simulation" }}</strong>
        </div>

        <div class="decision-primary">
          <span>路线概览</span>
          <p>{{ routeSummary }}</p>
        </div>

        <div class="risk-dial" :data-tone="highestRiskNode?.tone || 'low'">
          <div>
            <small>最高风险</small>
            <strong>{{ highestRiskNode?.riskScore || "--" }}</strong>
          </div>
          <p>{{ highestRiskNode?.name || "等待生成" }}</p>
        </div>

        <ol class="chain-list">
          <li v-for="item in decisionChain" :key="item.title" :data-state="item.state">
            <span />
            <div>
              <strong>{{ item.title }}</strong>
              <small>{{ item.value }}</small>
            </div>
          </li>
        </ol>

        <div class="workflow-monitor">
          <div class="monitor-head">
            <strong>实时推演链路</strong>
            <span>{{ operationProgress }}%</span>
          </div>
          <button
            v-for="(step, index) in workflowSteps"
            :key="step.label"
            type="button"
            class="workflow-step"
            :class="{ active: activeRunStep === index, done: activeRunStep > index }"
            @click="activeRunStep = index"
          >
            <span>{{ index + 1 }}</span>
            <div>
              <strong>{{ step.label }}</strong>
              <small>{{ step.detail }}</small>
            </div>
          </button>
        </div>

        <div class="suggestion-box">
          <strong>安全建议</strong>
          <p>
            {{
              selectedNode
                ? `${selectedNode.name} 当前为 ${selectedNode.riskLevel}，建议优先核验 ${selectedNode.dataNeed?.slice(0, 2).join("、")}。`
                : "请选择地图点位查看风险建议。"
            }}
          </p>
        </div>
      </aside>
    </section>

    <section class="route-board" aria-label="动态行程卡片">
      <div class="board-head">
        <div>
          <span>04</span>
          <h2>{{ form.days }} 天路线推演</h2>
        </div>
        <p>{{ form.type }} · {{ form.weather }} · {{ strategyLabel(form.strategy) }}</p>
      </div>

      <div class="route-swimlane">
        <button
          v-for="node in routeNodes"
          :key="node.id"
          type="button"
          class="route-row"
          :class="{ selected: selectedNode?.id === node.id, playing: playbackNode?.id === node.id && isPlaying }"
          :data-tone="node.tone"
          :style="{ '--i': node.order - 1 }"
          @click="selectNode(node)"
        >
          <span class="route-index">{{ node.order }}</span>
          <span class="route-name">
            <strong>{{ node.name }}</strong>
            <small>{{ node.city }} · {{ node.county }} · {{ node.tags.join(" / ") }}</small>
          </span>
          <span class="route-score">
            <small>推荐</small>
            <strong>{{ node.score }}</strong>
          </span>
          <span class="route-stat">
            <small>风险</small>
            <strong>{{ node.riskScore }}</strong>
          </span>
          <span class="route-stat">
            <small>坡度</small>
            <strong>{{ node.slope }}</strong>
          </span>
          <span class="route-stat">
            <small>距离</small>
            <strong>{{ node.distance }}</strong>
          </span>
          <span class="route-stat">
            <small>拥堵</small>
            <strong>{{ node.crowding }}</strong>
          </span>
          <span class="route-stat">
            <small>服务点</small>
            <strong>{{ node.service }}</strong>
          </span>
        </button>
      </div>
    </section>

    <section class="lower-grid">
      <section class="evidence-panel" aria-label="可解释风险证据">
        <div class="panel-title">
          <div>
            <span>05</span>
            <h2>风险证据板</h2>
          </div>
          <strong>{{ selectedNode?.name || "未选择点位" }}</strong>
        </div>
        <div class="evidence-columns">
          <div v-for="group in evidenceGroups" :key="group.title" class="evidence-column">
            <h3>{{ group.title }}</h3>
            <ul>
              <li v-for="item in group.items" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="data-panel" aria-label="公共数据契约">
        <div class="panel-title compact">
          <div>
            <span>06</span>
            <h2>公共数据契约</h2>
          </div>
          <strong>{{ dataRequest.length }} 类申请</strong>
        </div>
        <div class="data-list">
          <div v-for="item in dataRequest" :key="item.category" class="data-row">
            <strong>{{ item.category }}</strong>
            <span>{{ item.priority }}</span>
            <small>{{ item.fields?.slice(0, 4).join("、") || "待补充字段" }}</small>
          </div>
        </div>
      </section>

      <section class="landing-panel" aria-label="落地实施计划">
        <div class="panel-title compact">
          <div>
            <span>07</span>
            <h2>落地计划</h2>
          </div>
          <strong>{{ landingPlan?.targetArea || "候选片区" }}</strong>
        </div>
        <ol class="phase-list">
          <li v-for="phase in landingPlan?.phases || []" :key="phase.name">
            <strong>{{ phase.name }}</strong>
            <span>{{ phase.duration }}</span>
            <small>{{ phase.outputs?.slice(0, 2).join(" / ") }}</small>
          </li>
        </ol>
      </section>

      <section class="integration-panel" aria-label="真实接入配置">
        <div class="panel-title compact">
          <div>
            <span>08</span>
            <h2>真实接入配置</h2>
          </div>
          <button class="secondary-button compact-button" type="button" @click="copyEnvTemplate">
            复制模板
          </button>
        </div>
        <div class="runtime-grid">
          <article v-for="card in runtimeCards" :key="card.title" class="runtime-card" :data-tone="card.tone">
            <div>
              <strong>{{ card.title }}</strong>
              <span>{{ card.status }}</span>
            </div>
            <p>{{ card.detail }}</p>
            <small>{{ card.env }}</small>
          </article>
        </div>
      </section>

      <section class="api-panel" aria-label="接口和数据源矩阵">
        <div class="panel-title compact">
          <div>
            <span>09</span>
            <h2>接口矩阵</h2>
          </div>
          <strong>{{ apiRows.length }} 个端点</strong>
        </div>
        <div class="api-grid">
          <div v-for="api in apiRows" :key="api.endpoint" class="api-row">
            <span>{{ api.status }}</span>
            <strong>{{ api.name }}</strong>
            <small>{{ api.endpoint }}</small>
          </div>
        </div>
        <div class="source-strip">
          <span v-for="source in sourceRows" :key="source.id">
            {{ source.phase }} · {{ source.name }}
          </span>
        </div>
      </section>
    </section>

    <footer class="console-footer">
      <span>黔行守护 · 省级 AI 创业大赛路演 Demo</span>
      <span>游客需求 -> 公共数据 -> 昇腾推理位 -> 风险解释 -> 应急建议 -> 试点落地</span>
    </footer>

    <Transition name="toast">
      <div v-if="toast" class="toast-message" role="status">
        {{ toast }}
      </div>
    </Transition>

    <div v-if="booting" class="boot-mask" role="status">
      <span />
      <strong>正在同步公共数据与路线模型</strong>
    </div>
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  background: oklch(1 0 0);
  color: oklch(0.16 0.018 165);
  font-family:
    Inter,
    "Microsoft YaHei",
    "PingFang SC",
    "Noto Sans CJK SC",
    system-ui,
    sans-serif;
  letter-spacing: 0;
}

:global(button),
:global(input),
:global(select),
:global(textarea) {
  font: inherit;
  letter-spacing: 0;
}

:global(button) {
  cursor: pointer;
}

.qianxing-shell {
  --bg: oklch(1 0 0);
  --ink: oklch(0.16 0.018 165);
  --muted: oklch(0.46 0.02 165);
  --line: oklch(0.89 0.013 165);
  --surface: oklch(0.975 0.006 165);
  --surface-2: oklch(0.945 0.012 165);
  --dark: oklch(0.18 0.026 168);
  --dark-2: oklch(0.24 0.032 168);
  --primary: oklch(0.43 0.112 158);
  --primary-strong: oklch(0.35 0.1 158);
  --accent: oklch(0.61 0.18 49);
  --danger: oklch(0.58 0.19 28);
  --warning: oklch(0.71 0.16 72);
  --safe: oklch(0.58 0.13 152);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  min-height: 100dvh;
  background: var(--bg);
  color: var(--ink);
  padding: 14px;
}

.topbar,
.mission-band,
.task-panel,
.map-panel,
.decision-panel,
.route-board,
.evidence-panel,
.data-panel,
.landing-panel,
.integration-panel,
.api-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
}

.topbar {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 14px;
  min-height: 86px;
  padding: 14px;
  background: var(--dark);
  color: oklch(0.98 0 0);
  border-color: var(--dark);
}

.identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 320px;
}

.project-mark {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border: 1px solid oklch(0.52 0.06 158);
  border-radius: 8px;
  background: oklch(0.23 0.041 162);
  color: oklch(0.91 0.05 150);
  font-size: 25px;
  font-weight: 800;
}

.identity p,
.identity h1 {
  margin: 0;
}

.identity p {
  color: oklch(0.74 0.025 164);
  font-size: 13px;
  line-height: 1.5;
}

.identity h1 {
  margin-top: 4px;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 760;
  text-wrap: balance;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr));
  gap: 8px;
  width: min(760px, 58vw);
}

.status-pill {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  border: 1px solid oklch(0.34 0.035 162);
  border-radius: 7px;
  padding: 9px 10px;
  background: oklch(0.21 0.027 164);
}

.status-pill strong {
  overflow: hidden;
  color: oklch(0.97 0 0);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill small {
  overflow: hidden;
  color: oklch(0.74 0.025 164);
  font-size: 11px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-pill[data-tone="good"] {
  border-color: oklch(0.51 0.11 152);
}

.status-pill[data-tone="warn"] {
  border-color: oklch(0.68 0.14 70);
}

.status-pill[data-tone="wait"] {
  border-color: oklch(0.54 0.025 165);
}

.mission-band {
  display: grid;
  grid-template-columns: minmax(280px, 1.4fr) repeat(4, minmax(130px, 1fr));
  gap: 0;
  margin-top: 10px;
  overflow: hidden;
  background: var(--surface);
}

.mission-copy,
.mission-metric {
  min-width: 0;
  margin: 0;
  padding: 12px 14px;
  border-right: 1px solid var(--line);
}

.mission-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  background: oklch(0.96 0.012 158);
}

.mission-copy span,
.mission-metric dt {
  color: var(--muted);
  font-size: 12px;
}

.mission-copy strong {
  font-size: 15px;
  line-height: 1.45;
  text-wrap: pretty;
}

.mission-metric dd {
  margin: 4px 0 2px;
  color: var(--primary-strong);
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.mission-metric small {
  display: block;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(270px, 0.9fr) minmax(520px, 1.9fr) minmax(300px, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.task-panel,
.map-panel,
.decision-panel,
.route-board,
.evidence-panel,
.data-panel,
.landing-panel,
.integration-panel,
.api-panel {
  min-width: 0;
  padding: 14px;
}

.panel-title,
.map-head,
.board-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-title.compact {
  align-items: center;
}

.panel-title > div,
.map-head > div:first-child,
.board-head > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.panel-title span,
.map-head span,
.board-head span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 800;
}

.panel-title h2,
.map-head h2,
.board-head h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.2;
  font-weight: 760;
}

.panel-title strong,
.map-mode strong,
.board-head p {
  color: var(--muted);
  font-size: 12px;
}

.panel-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.ghost-button {
  min-height: 36px;
  border: 1px solid var(--primary);
  border-radius: 7px;
  padding: 0 13px;
  background: var(--primary);
  color: oklch(0.99 0 0);
  font-weight: 760;
  transition:
    transform 160ms var(--ease-out-quart),
    background 160ms var(--ease-out-quart),
    border-color 160ms var(--ease-out-quart);
}

.secondary-button {
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 0 12px;
  background: var(--bg);
  color: var(--primary-strong);
  font-weight: 760;
  transition:
    transform 160ms var(--ease-out-quart),
    border-color 160ms var(--ease-out-quart),
    background 160ms var(--ease-out-quart);
}

.compact-button {
  min-height: 30px;
  font-size: 12px;
}

.ghost-button:hover,
.secondary-button:hover,
.quick-grid button:hover,
.strategy-row button:hover,
.map-actions button:hover {
  transform: translateY(-1px);
}

.ghost-button:active,
.secondary-button:active,
.quick-grid button:active,
.strategy-row button:active,
.map-actions button:active,
.route-row:active,
.map-pin:active {
  transform: scale(0.985);
}

.ghost-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.field-block,
.control-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-block span,
.control-grid span,
.intensity-row span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}

textarea,
select,
input[type="number"] {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  outline: none;
}

textarea {
  min-height: 124px;
  resize: vertical;
  padding: 10px;
  font-size: 14px;
  line-height: 1.55;
}

select,
input[type="number"] {
  height: 36px;
  padding: 0 10px;
  font-size: 13px;
}

textarea:focus,
select:focus,
input:focus,
button:focus-visible {
  outline: 2px solid oklch(0.72 0.13 150);
  outline-offset: 2px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.quick-grid button,
.strategy-row button {
  min-height: 34px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
  font-weight: 680;
  transition:
    transform 160ms var(--ease-out-quart),
    border-color 160ms var(--ease-out-quart),
    background 160ms var(--ease-out-quart);
}

.quick-grid button.active,
.strategy-row button.active {
  border-color: var(--primary);
  background: oklch(0.94 0.032 155);
  color: var(--primary-strong);
}

.control-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.intensity-row {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}

.intensity-row > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.intensity-row strong {
  color: var(--primary-strong);
  font-size: 20px;
}

input[type="range"] {
  width: 100%;
  accent-color: var(--primary);
}

.strategy-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.strategy-row button:first-child {
  grid-column: 1 / -1;
}

.run-progress {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 10px;
  background: var(--surface);
  transition:
    border-color 220ms var(--ease-out-quart),
    background 220ms var(--ease-out-quart);
}

.run-progress[data-active="true"] {
  border-color: oklch(0.68 0.13 150);
  background: oklch(0.955 0.025 150);
}

.run-progress > div:first-child {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  align-items: center;
}

.run-progress > div:first-child span {
  color: var(--muted);
  font-size: 12px;
}

.run-progress > div:first-child strong {
  color: var(--primary-strong);
  font-size: 14px;
}

.run-progress > div:first-child small {
  grid-column: 1 / -1;
  color: var(--muted);
  font-size: 12px;
}

.progress-rail {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: oklch(0.88 0.014 158);
}

.progress-rail i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  transition: width 260ms var(--ease-out-expo);
}

.run-progress p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.helper-line,
.api-error {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.helper-line {
  color: var(--muted);
}

.api-error {
  color: var(--danger);
}

.map-panel {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.map-head {
  margin: 0;
  padding: 14px 14px 10px;
  flex-wrap: wrap;
}

.map-mode {
  max-width: 270px;
  text-align: right;
}

.map-mode strong,
.map-mode small {
  display: block;
}

.map-mode small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.map-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
}

.map-actions button {
  min-height: 30px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0 10px;
  background: var(--bg);
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
  transition:
    transform 160ms var(--ease-out-quart),
    background 160ms var(--ease-out-quart),
    color 160ms var(--ease-out-quart);
}

.map-actions button.active {
  border-color: var(--primary);
  background: var(--primary);
  color: oklch(0.99 0 0);
}

.map-stage {
  position: relative;
  flex: 1;
  min-height: 520px;
  overflow: hidden;
  border-top: 1px solid var(--line);
  background: oklch(0.95 0.018 158);
}

.amap-layer,
.fallback-map {
  position: absolute;
  inset: 0;
}

.amap-layer {
  z-index: 1;
  opacity: 0;
  pointer-events: none;
}

.amap-layer.visible {
  opacity: 1;
  pointer-events: auto;
}

.fallback-map {
  z-index: 2;
  background:
    linear-gradient(90deg, oklch(0.94 0.018 155), oklch(0.98 0.006 150) 52%, oklch(0.92 0.017 165));
}

.fallback-map.hidden {
  display: none;
}

.fallback-map svg {
  width: 100%;
  height: 100%;
}

.province-shape {
  fill: oklch(0.88 0.04 150);
  stroke: oklch(0.36 0.08 158);
  stroke-width: 0.7;
}

.route-line {
  fill: none;
  stroke: var(--primary);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.35;
  stroke-dasharray: 140;
  stroke-dashoffset: 0;
  transition:
    stroke-width 220ms var(--ease-out-quart),
    stroke-dashoffset 500ms var(--ease-out-expo);
}

.route-line.tracing {
  stroke-width: 2;
  animation: routeTrace 1.25s var(--ease-out-expo) infinite;
}

.terrain-ring {
  fill: none;
  stroke: oklch(0.7 0.07 150);
  stroke-dasharray: 2 3;
  stroke-width: 0.5;
}

.terrain-ring.muted {
  stroke: oklch(0.78 0.04 150);
}

.heat-zone {
  position: absolute;
  z-index: 2;
  width: var(--heat-size);
  height: var(--heat-size);
  translate: -50% -50%;
  border-radius: 50%;
  background: oklch(0.6 0.13 150 / 0.16);
  filter: blur(0.2px);
  pointer-events: none;
  animation: heatPulse 2.6s var(--ease-out-quart) infinite;
}

.heat-zone[data-tone="medium"] {
  background: oklch(0.72 0.16 72 / 0.2);
}

.heat-zone[data-tone="high"] {
  background: oklch(0.58 0.19 28 / 0.2);
}

.heat-zone.flow {
  background: oklch(0.56 0.08 220 / 0.18);
  animation-duration: 3.2s;
}

.map-pin {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 76px;
  min-height: 34px;
  translate: -50% -50%;
  border: 1px solid var(--primary);
  border-radius: 7px;
  padding: 4px 8px 4px 4px;
  background: var(--bg);
  color: var(--ink);
  transition:
    transform 180ms var(--ease-out-quart),
    border-color 180ms var(--ease-out-quart),
    box-shadow 180ms var(--ease-out-quart);
}

.map-pin span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 5px;
  background: var(--primary);
  color: oklch(0.99 0 0);
  font-size: 12px;
  font-weight: 800;
}

.map-pin strong {
  font-size: 12px;
  white-space: nowrap;
}

.map-pin[data-tone="medium"] {
  border-color: var(--warning);
}

.map-pin[data-tone="medium"] span {
  background: var(--warning);
}

.map-pin[data-tone="high"] {
  border-color: var(--danger);
}

.map-pin[data-tone="high"] span {
  background: var(--danger);
}

.map-pin.selected {
  outline: 3px solid oklch(0.9 0.045 150);
}

.map-pin.playing {
  box-shadow: 0 0 0 8px oklch(0.68 0.13 150 / 0.16);
  transform: scale(1.05);
}

.service-dot {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 6px;
  translate: -50% -50%;
  border: 1px solid oklch(0.7 0.08 150);
  border-radius: 999px;
  padding: 5px 8px;
  background: oklch(1 0 0 / 0.94);
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 760;
}

.service-dot span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--safe);
  animation: serviceBlink 1.6s var(--ease-out-quart) infinite;
}

.traveler-chip {
  position: absolute;
  z-index: 5;
  display: grid;
  min-width: 150px;
  translate: 12px -72px;
  border: 1px solid oklch(0.64 0.12 150);
  border-radius: 7px;
  padding: 8px 10px;
  background: oklch(0.16 0.018 165 / 0.92);
  color: oklch(0.99 0 0);
  pointer-events: none;
  animation: chipIn 300ms var(--ease-out-expo);
}

.traveler-chip small {
  color: oklch(0.78 0.05 150);
  font-size: 11px;
}

.traveler-chip strong {
  overflow: hidden;
  margin-top: 2px;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-hud {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 4;
  display: grid;
  gap: 7px;
  width: 126px;
}

.map-hud div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 7px 8px;
  background: oklch(1 0 0 / 0.9);
}

.map-hud span {
  color: var(--muted);
  font-size: 11px;
}

.map-hud strong {
  font-size: 12px;
}

.map-hud div[data-tone="good"] strong {
  color: var(--primary-strong);
}

.map-hud div[data-tone="warn"] strong {
  color: oklch(0.55 0.14 70);
}

.map-legend {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 4;
  display: flex;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 9px 10px;
  background: oklch(1 0 0 / 0.92);
  color: var(--muted);
  font-size: 12px;
}

.map-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.map-legend i {
  width: 9px;
  height: 9px;
  border-radius: 99px;
  background: var(--safe);
}

.map-legend i[data-tone="medium"] {
  background: var(--warning);
}

.map-legend i[data-tone="high"] {
  background: var(--danger);
}

.map-live-strip {
  position: absolute;
  right: 14px;
  bottom: 60px;
  left: 14px;
  z-index: 4;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.map-live-strip button {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 8px 10px;
  background: oklch(1 0 0 / 0.86);
  color: var(--ink);
  text-align: left;
  transition:
    transform 170ms var(--ease-out-quart),
    border-color 170ms var(--ease-out-quart),
    background 170ms var(--ease-out-quart);
}

.map-live-strip button:hover {
  transform: translateY(-1px);
}

.map-live-strip button.active {
  border-color: var(--primary);
  background: oklch(0.94 0.028 150 / 0.94);
}

.map-live-strip button.done {
  border-color: oklch(0.72 0.055 150);
}

.map-live-strip span,
.map-live-strip strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-live-strip span {
  color: var(--muted);
  font-size: 11px;
}

.map-live-strip strong {
  margin-top: 3px;
  font-size: 12px;
}

.decision-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.decision-primary {
  border-top: 3px solid var(--primary);
  padding-top: 10px;
}

.decision-primary span,
.risk-dial small,
.suggestion-box strong {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.decision-primary p {
  margin: 7px 0 0;
  font-size: 15px;
  line-height: 1.65;
  text-wrap: pretty;
}

.risk-dial {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 12px;
  background: var(--surface);
}

.risk-dial > div {
  display: grid;
  width: 90px;
  height: 90px;
  place-items: center;
  border: 10px solid var(--safe);
  border-radius: 50%;
  background: var(--bg);
  text-align: center;
}

.risk-dial[data-tone="medium"] > div {
  border-color: var(--warning);
}

.risk-dial[data-tone="high"] > div {
  border-color: var(--danger);
}

.risk-dial strong {
  color: var(--ink);
  font-size: 28px;
  line-height: 1;
}

.risk-dial p {
  margin: 0;
  font-size: 14px;
  font-weight: 720;
  line-height: 1.45;
}

.chain-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chain-list li {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 8px;
  align-items: start;
  min-height: 42px;
}

.chain-list li > span {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--safe);
}

.chain-list li[data-state="warn"] > span {
  background: var(--warning);
}

.chain-list li[data-state="wait"] > span {
  background: oklch(0.72 0.018 165);
}

.chain-list strong,
.chain-list small {
  display: block;
}

.chain-list strong {
  font-size: 13px;
}

.chain-list small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.workflow-monitor {
  display: grid;
  gap: 7px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 10px;
  background: var(--surface);
}

.monitor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.monitor-head strong {
  font-size: 13px;
}

.monitor-head span {
  color: var(--primary-strong);
  font-size: 13px;
  font-weight: 820;
}

.workflow-step {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 8px;
  align-items: start;
  min-height: 46px;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 7px;
  background: transparent;
  color: var(--ink);
  text-align: left;
  transition:
    transform 160ms var(--ease-out-quart),
    border-color 180ms var(--ease-out-quart),
    background 180ms var(--ease-out-quart);
}

.workflow-step:hover {
  transform: translateX(2px);
  background: oklch(0.965 0.012 150);
}

.workflow-step > span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 6px;
  background: oklch(0.89 0.015 150);
  color: var(--muted);
  font-size: 11px;
  font-weight: 820;
}

.workflow-step strong,
.workflow-step small {
  display: block;
}

.workflow-step strong {
  font-size: 12px;
}

.workflow-step small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
}

.workflow-step.active {
  border-color: oklch(0.67 0.12 150);
  background: oklch(0.94 0.028 150);
}

.workflow-step.active > span,
.workflow-step.done > span {
  background: var(--primary);
  color: oklch(0.99 0 0);
}

.suggestion-box {
  margin-top: auto;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 12px;
  background: oklch(0.96 0.014 150);
}

.suggestion-box p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.55;
}

.route-board {
  margin-top: 10px;
}

.board-head {
  margin-bottom: 10px;
}

.board-head p {
  margin: 0;
}

.route-swimlane {
  display: grid;
  gap: 7px;
}

.route-row {
  display: grid;
  grid-template-columns: 40px minmax(220px, 1.5fr) repeat(6, minmax(74px, 0.48fr));
  gap: 8px;
  align-items: center;
  min-height: 62px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 8px;
  background: var(--bg);
  color: var(--ink);
  text-align: left;
  animation: rowIn 360ms var(--ease-out-expo) both;
  animation-delay: calc(var(--i, 0) * 32ms);
  transition:
    transform 170ms var(--ease-out-quart),
    border-color 180ms var(--ease-out-quart),
    background 180ms var(--ease-out-quart);
}

.route-row.selected {
  border-color: var(--primary);
  background: oklch(0.965 0.02 155);
}

.route-row:hover {
  transform: translateY(-1px);
  border-color: oklch(0.72 0.055 150);
}

.route-row.playing {
  border-color: var(--accent);
  background: oklch(0.975 0.025 72);
  transform: translateX(4px);
}

.route-index {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 6px;
  background: var(--dark);
  color: oklch(0.99 0 0);
  font-weight: 800;
}

.route-row[data-tone="medium"] .route-index {
  background: var(--warning);
}

.route-row[data-tone="high"] .route-index {
  background: var(--danger);
}

.route-name strong,
.route-name small,
.route-score small,
.route-score strong,
.route-stat small,
.route-stat strong {
  display: block;
}

.route-name strong {
  font-size: 14px;
  line-height: 1.35;
}

.route-name small,
.route-score small,
.route-stat small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.route-score,
.route-stat {
  min-width: 0;
  border-left: 1px solid var(--line);
  padding-left: 10px;
}

.route-score strong,
.route-stat strong {
  color: var(--ink);
  font-size: 18px;
  font-weight: 820;
  line-height: 1.05;
}

.route-score strong {
  color: var(--primary-strong);
}

.lower-grid {
  display: grid;
  grid-template-columns: minmax(520px, 1.45fr) minmax(260px, 0.8fr) minmax(280px, 0.8fr);
  gap: 10px;
  margin-top: 10px;
}

.integration-panel,
.api-panel {
  grid-column: 2 / 4;
}

.evidence-panel {
  grid-row: span 2;
}

.evidence-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.evidence-column {
  min-height: 172px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 11px;
  background: var(--surface);
}

.evidence-column h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

.evidence-column ul {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.evidence-column li {
  position: relative;
  padding-left: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.evidence-column li::before {
  position: absolute;
  top: 0.62em;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 99px;
  background: var(--primary);
  content: "";
}

.data-list,
.phase-list,
.api-grid {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.data-row,
.phase-list li,
.api-row {
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 9px;
  background: var(--surface);
}

.data-row {
  grid-template-columns: 70px 54px 1fr;
  align-items: center;
}

.data-row strong,
.data-row span,
.data-row small,
.phase-list strong,
.phase-list span,
.phase-list small,
.api-row strong,
.api-row span,
.api-row small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-row strong,
.phase-list strong,
.api-row strong {
  font-size: 13px;
}

.data-row span,
.api-row span {
  justify-self: start;
  border-radius: 999px;
  padding: 3px 7px;
  background: oklch(0.91 0.035 150);
  color: var(--primary-strong);
  font-size: 11px;
  font-weight: 760;
}

.data-row small,
.phase-list small,
.api-row small {
  color: var(--muted);
  font-size: 12px;
}

.phase-list {
  list-style: none;
}

.phase-list li {
  grid-template-columns: 92px 64px 1fr;
  align-items: center;
}

.phase-list span {
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 760;
}

.runtime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.runtime-card {
  display: grid;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 10px;
  background: var(--surface);
}

.runtime-card > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.runtime-card strong {
  font-size: 13px;
}

.runtime-card span {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 7px;
  background: oklch(0.91 0.035 150);
  color: var(--primary-strong);
  font-size: 11px;
  font-weight: 760;
}

.runtime-card[data-tone="warn"] span {
  background: oklch(0.94 0.055 70);
  color: oklch(0.42 0.11 70);
}

.runtime-card[data-tone="wait"] span {
  background: oklch(0.91 0.01 165);
  color: var(--muted);
}

.runtime-card p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.runtime-card small {
  overflow: hidden;
  color: var(--primary-strong);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.api-row {
  grid-template-columns: 70px 1fr;
}

.api-row small {
  grid-column: 1 / -1;
}

.source-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
}

.source-strip span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 5px 8px;
  color: var(--muted);
  font-size: 11px;
}

.console-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--muted);
  font-size: 12px;
}

.boot-mask {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  gap: 14px;
  background: oklch(1 0 0 / 0.82);
  color: var(--ink);
}

.boot-mask span {
  width: 38px;
  height: 38px;
  border: 4px solid var(--line);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.toast-message {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 20;
  max-width: min(420px, calc(100vw - 44px));
  border: 1px solid oklch(0.5 0.08 155);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--dark);
  color: oklch(0.99 0 0);
  font-size: 13px;
  line-height: 1.45;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 220ms var(--ease-out-quart),
    transform 220ms var(--ease-out-quart);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}

@keyframes heatPulse {
  0% {
    opacity: 0.42;
    transform: scale(0.76);
  }

  60% {
    opacity: 0.18;
    transform: scale(1.08);
  }

  100% {
    opacity: 0.36;
    transform: scale(0.76);
  }
}

@keyframes serviceBlink {
  0%,
  100% {
    box-shadow: 0 0 0 0 oklch(0.58 0.13 152 / 0.28);
  }

  50% {
    box-shadow: 0 0 0 7px oklch(0.58 0.13 152 / 0);
  }
}

@keyframes chipIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes rowIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes routeTrace {
  0% {
    stroke-dashoffset: 140;
  }

  100% {
    stroke-dashoffset: 0;
  }
}

@media (max-width: 1280px) {
  .topbar {
    flex-direction: column;
  }

  .status-strip {
    width: 100%;
  }

  .workspace-grid {
    grid-template-columns: minmax(260px, 0.9fr) minmax(480px, 1.6fr);
  }

  .decision-panel {
    grid-column: 1 / -1;
  }

  .lower-grid {
    grid-template-columns: 1fr 1fr;
  }

  .evidence-panel,
  .integration-panel,
  .api-panel {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .qianxing-shell {
    padding: 8px;
  }

  .mission-band,
  .workspace-grid,
  .lower-grid {
    grid-template-columns: 1fr;
  }

  .status-strip {
    grid-template-columns: 1fr 1fr;
  }

  .mission-copy,
  .mission-metric {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .map-stage {
    min-height: 430px;
  }

  .map-live-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .route-row {
    grid-template-columns: 36px 1fr repeat(2, minmax(64px, 0.3fr));
  }

  .route-stat:nth-last-child(-n + 4) {
    display: none;
  }

  .evidence-columns,
  .runtime-grid,
  .api-grid {
    grid-template-columns: 1fr;
  }

  .console-footer {
    flex-direction: column;
  }
}

@media (max-width: 620px) {
  .identity {
    min-width: 0;
  }

  .identity h1 {
    font-size: 20px;
  }

  .status-strip,
  .quick-grid,
  .control-grid,
  .strategy-row {
    grid-template-columns: 1fr;
  }

  .data-row,
  .phase-list li {
    grid-template-columns: 1fr;
  }

  .map-live-strip {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
