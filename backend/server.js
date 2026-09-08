import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const appVersion = "2026.08-national-p1";
const scenicPhotoDiskCacheDir = join(root, "data", "scenic-photo-cache");

async function loadLocalEnv() {
  try {
    const contents = await readFile(join(root, ".env"), "utf8");
    for (const rawLine of contents.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const separator = line.indexOf("=");
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Environment variables remain the production source of truth.
  }
}

await loadLocalEnv();
const port = Number(process.env.PORT || 8093);

const amapCityAdcodes = [
  { city: "贵阳市", shortName: "贵阳", adcode: "520100" },
  { city: "六盘水市", shortName: "六盘水", adcode: "520200" },
  { city: "遵义市", shortName: "遵义", adcode: "520300" },
  { city: "安顺市", shortName: "安顺", adcode: "520400" },
  { city: "毕节市", shortName: "毕节", adcode: "520500" },
  { city: "铜仁市", shortName: "铜仁", adcode: "520600" },
  { city: "黔西南布依族苗族自治州", shortName: "黔西南", adcode: "522300" },
  { city: "黔东南苗族侗族自治州", shortName: "黔东南", adcode: "522600" },
  { city: "黔南布依族苗族自治州", shortName: "黔南", adcode: "522700" }
];

const amapCache = new Map();
const scenicPhotoCache = new Map();
const regionalScenicSpotCache = new Map();
const decisionSnapshots = new Map();
const decisionSnapshotTtlMs = 2 * 60 * 60 * 1000;
const decisionSnapshotLimit = 200;
const incidentStorePath = process.env.INCIDENT_STORE_PATH || join(root, "data", "runtime_incidents.json");
let incidentStore = null;
let incidentWriteQueue = Promise.resolve();
const ascendRuntime = {
  lastStatus: "not-configured",
  lastSuccessAt: null,
  lastAttemptAt: null,
  lastLatencyMs: null,
  lastError: ""
};
const curatedPoiNameHints = {
  anshun_huangguoshu: "黄果树旅游景区",
  qny_libo: "小七孔景区",
  gy_qingyan: "青岩古镇",
  qdn_xijiang: "西江千户苗寨",
  tr_fanjing: "梵净山风景区",
  bj_zhijin: "织金洞景区",
  qxn_wanfenglin: "万峰林景区"
};

const dataSources = [
  { id: "business", name: "工商主体数据", fields: ["行业分类", "经营状态", "主体密度"] },
  { id: "credit", name: "企业信用数据", fields: ["经营异常", "行政处罚", "投诉记录"] },
  { id: "employment", name: "就业人才数据", fields: ["岗位供给", "技能等级", "工资区间"] },
  { id: "population", name: "流动人口数据", fields: ["来源地", "停留时长", "年龄结构"] },
  { id: "macro", name: "宏观经济数据", fields: ["社零", "收入", "常住人口"] },
  { id: "poi", name: "POI 与设施数据", fields: ["商圈", "停车", "住宿"] },
  { id: "traffic", name: "交通客流数据", fields: ["可达时间", "换乘", "停车流量"] },
  { id: "tourism", name: "景区热度数据", fields: ["节假日客流", "活动", "订单热度"] }
];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const corpusMarketBase = "https://corpus.gzdata.com.cn:32117";
const corpusRelevantKeywords = [
  "气象",
  "山地",
  "停车",
  "城市治理",
  "宏观经济",
  "就业数据",
  "民生服务",
  "互联网用户分布",
  "政务政策",
  "人工智能创业大赛"
];

const corpusRoleMap = [
  { role: "weather", label: "天气与山地风险", keywords: ["气象", "山地"] },
  { role: "traffic", label: "交通与停车拥堵", keywords: ["停车", "交通"] },
  { role: "governance", label: "城市治理与政务知识", keywords: ["城市治理", "政务政策", "政务服务"] },
  { role: "macro", label: "宏观经济与就业", keywords: ["宏观经济", "就业数据"] },
  { role: "population", label: "民生访问与人群分布", keywords: ["民生服务", "互联网用户分布"] }
];

async function loadLocations() {
  const body = await readFile(join(root, "data", "sample_locations.json"), "utf8");
  return JSON.parse(body);
}

async function loadJsonData(filename, fallback) {
  try {
    const body = await readFile(join(root, "data", filename), "utf8");
    return JSON.parse(body);
  } catch {
    return fallback;
  }
}

async function loadScenicSpots() {
  return loadJsonData("guizhou_scenic_spots.amap.json", {
    meta: { total: 0, cityStats: [], note: "尚未运行高德景区 POI 采集脚本" },
    spots: []
  });
}

async function loadHolidayTourism() {
  return loadJsonData("guizhou_holiday_tourism.json", {
    meta: { name: "贵州节假日文旅热度公开样本", note: "暂无节假日公开样本" },
    records: []
  });
}

async function loadGuardianSites() {
  return loadJsonData("guizhou_tourism_guardian_sites.json", {
    meta: { name: "山河守护贵州样板安全点位库", note: "暂无复杂地形旅游安全点位" },
    sites: []
  });
}

async function loadTourismScope(options = {}) {
  const destinationRegion = String(options.destinationRegion || options.region || "贵州").trim() || "贵州";
  if (isGuizhouRegion(destinationRegion)) {
    const [siteDataset, holidayData, scenicDataset] = await Promise.all([
      loadGuardianSites(),
      loadHolidayTourism(),
      loadScenicSpots()
    ]);
    return {
      destinationRegion: "贵州",
      destinationLngLat: [],
      siteDataset,
      holidayData,
      scenicDataset
    };
  }

  const [scenicDataset, geocode] = await Promise.all([
    loadRegionalScenicSpots(destinationRegion, options.selectedSiteNames || []),
    resolveAmapGeocode(destinationRegion).catch(() => null)
  ]);
  return {
    destinationRegion,
    destinationLngLat: geocode?.lngLat || [],
    siteDataset: {
      meta: { name: `${destinationRegion}实时景区候选`, note: "非贵州区域不混入贵州样板点位。" },
      sites: []
    },
    holidayData: {
      meta: { name: `${destinationRegion}节假日数据`, note: "尚未接入当地授权节假日客流。" },
      records: []
    },
    scenicDataset
  };
}

function buildSignedAmapUrl(pathname, params = {}) {
  const key = process.env.AMAP_WEB_SERVICE_KEY || "";
  if (!key) throw new Error("amap_web_service_key_not_configured");
  const values = { ...params, key };
  const entries = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([name, value]) => [name, String(value)])
    .sort(([left], [right]) => left.localeCompare(right, "en"));
  const secret = process.env.AMAP_WEB_SERVICE_SECRET || "";
  const signatureBase = entries.map(([name, value]) => `${name}=${value}`).join("&");
  const search = new URLSearchParams(entries);
  if (secret) {
    search.set("sig", createHash("md5").update(`${signatureBase}${secret}`, "utf8").digest("hex"));
  }
  return `https://restapi.amap.com${pathname}?${search.toString()}`;
}

async function fetchAmapJson(pathname, params, cacheTtlMs = 10 * 60 * 1000) {
  const cacheKey = `${pathname}:${JSON.stringify(params)}`;
  const cached = amapCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < cacheTtlMs) return cached.value;
  const response = await fetch(buildSignedAmapUrl(pathname, params), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`amap_http_${response.status}`);
  const payload = await response.json();
  if (payload.status !== "1") throw new Error(`amap_${payload.infocode || "unknown"}_${payload.info || "error"}`);
  amapCache.set(cacheKey, { value: payload, updatedAt: Date.now() });
  return payload;
}

function compactAdministrativeName(value = "") {
  return String(value)
    .trim()
    .replace(/特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市|自治州|地区|盟$/g, "");
}

function isGuizhouRegion(value = "") {
  const region = compactAdministrativeName(value);
  return !region || region === "贵州" || ["贵阳", "遵义", "六盘水", "安顺", "毕节", "铜仁", "黔西南", "黔东南", "黔南"].includes(region);
}

function normalizeAmapPoi(poi = {}) {
  const [lng, lat] = String(poi.location || "").split(",").map(Number);
  const business = poi.business && !Array.isArray(poi.business) ? poi.business : {};
  const ratingValue = Array.isArray(business.rating)
    ? ""
    : business.rating || (Array.isArray(poi.biz_ext?.rating) ? "" : poi.biz_ext?.rating);
  const rating = Number(ratingValue || 0);
  const photos = (poi.photos || []).map(photo => ({
    title: photo.title || poi.name || "",
    url: photo.url || ""
  })).filter(photo => photo.url);
  return {
    id: String(poi.id || ""),
    name: String(poi.name || ""),
    type: String(poi.type || ""),
    typecode: String(poi.typecode || ""),
    address: Array.isArray(poi.address) ? poi.address.join(" ") : String(poi.address || ""),
    province: String(poi.pname || ""),
    city: Array.isArray(poi.cityname) ? poi.pname || "" : String(poi.cityname || poi.pname || ""),
    district: Array.isArray(poi.adname) ? "" : String(poi.adname || ""),
    adcode: String(poi.adcode || ""),
    tel: Array.isArray(business.tel || poi.tel) ? "" : String(business.tel || poi.tel || ""),
    rating: Number.isFinite(rating) && rating > 0 ? rating : 4.5,
    holidayHeatSeed: Number.isFinite(rating) && rating > 0 ? clamp(50 + rating * 8) : 72,
    location: { lng, lat },
    openingHours: {
      today: String(business.opentime_today || ""),
      week: String(business.opentime_week || ""),
      source: business.opentime_today || business.opentime_week ? "amap-business" : "unavailable"
    },
    businessTags: [business.keytag, business.rectag].filter(Boolean),
    photos
  };
}

async function resolveAmapGeocode(address = "") {
  const query = String(address).trim();
  if (!query || !process.env.AMAP_WEB_SERVICE_KEY) return null;
  const payload = await fetchAmapJson("/v3/geocode/geo", {
    address: query,
    output: "JSON"
  }, 24 * 60 * 60 * 1000);
  const result = payload.geocodes?.[0];
  const lngLat = String(result?.location || "").split(",").map(Number);
  if (lngLat.length !== 2 || !lngLat.every(Number.isFinite)) return null;
  return {
    name: query,
    formattedAddress: result.formatted_address || query,
    province: result.province || "",
    city: Array.isArray(result.city) ? result.province || query : result.city || query,
    district: result.district || "",
    adcode: result.adcode || "",
    lngLat
  };
}

async function searchAmapScenicSpots({ region = "", keyword = "景区", pages = 2 } = {}) {
  if (!process.env.AMAP_WEB_SERVICE_KEY) return [];
  const results = [];
  for (let page = 1; page <= Math.max(1, Math.min(3, Number(pages || 1))); page += 1) {
    const payload = await fetchAmapJson("/v5/place/text", {
      keywords: String(keyword || "景区").trim(),
      region: String(region || "").trim(),
      city_limit: region ? "true" : "false",
      types: "110000",
      show_fields: "business,photos",
      page_size: "25",
      page_num: String(page),
      output: "JSON"
    }, 30 * 60 * 1000);
    results.push(...(payload.pois || []).map(normalizeAmapPoi));
    if ((payload.pois || []).length < 25) break;
    await wait(260);
  }
  return results.filter(spot => spot.id && spot.name && Number.isFinite(spot.location.lng) && Number.isFinite(spot.location.lat));
}

async function loadRegionalScenicSpots(region = "", selectedSiteNames = []) {
  const normalizedRegion = String(region || "全国").trim();
  const cacheKey = `${normalizedRegion}:${selectedSiteNames.map(normalizeScenicName).sort().join("|")}`;
  const cached = amapCache.get(`regional-scenic:${cacheKey}`);
  if (cached && Date.now() - cached.updatedAt < 30 * 60 * 1000) return cached.value;

  const exactKeywords = [...new Set((selectedSiteNames || []).map(value => String(value).trim()).filter(Boolean))].slice(0, 8);
  const searches = [
    searchAmapScenicSpots({ region: normalizedRegion === "全国" ? "" : normalizedRegion, keyword: "景区", pages: 3 }),
    ...exactKeywords.map(keyword => searchAmapScenicSpots({ region: normalizedRegion === "全国" ? "" : normalizedRegion, keyword, pages: 1 }))
  ];
  const settled = await Promise.allSettled(searches);
  const spots = settled
    .filter(result => result.status === "fulfilled")
    .flatMap(result => result.value)
    .filter((spot, index, list) => list.findIndex(item => item.id === spot.id) === index)
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  for (const spot of spots) regionalScenicSpotCache.set(spot.id, spot);
  const value = {
    meta: {
      provider: "AMap Place Search",
      scope: "national-live",
      region: normalizedRegion,
      generatedAt: new Date().toISOString(),
      total: spots.length,
      note: `${normalizedRegion}景区由高德 Web 服务实时检索，贵州仍保留本地样板数据集。`
    },
    spots
  };
  amapCache.set(`regional-scenic:${cacheKey}`, { value, updatedAt: Date.now() });
  return value;
}

async function searchNearbyEmergencyServices(lngLat = [], radius = 15000) {
  if (!Array.isArray(lngLat) || lngLat.length !== 2 || !lngLat.every(Number.isFinite)) return [];
  if (!process.env.AMAP_WEB_SERVICE_KEY) return [];
  const queries = [
    { type: "medical", label: "医疗急救", keywords: "医院", types: "090100" },
    { type: "police", label: "公安联络", keywords: "派出所", types: "130500" },
    { type: "visitor", label: "游客服务", keywords: "游客中心", types: "110000" }
  ];
  const services = [];
  for (const query of queries) {
    try {
      const payload = await fetchAmapJson("/v5/place/around", {
        location: lngLat.join(","),
        radius: String(Math.max(1000, Math.min(50000, Number(radius || 15000)))),
        keywords: query.keywords,
        types: query.types,
        sortrule: "distance",
        show_fields: "business",
        page_size: "3",
        page_num: "1",
        output: "JSON"
      }, 30 * 60 * 1000);
      const matches = (payload.pois || []).map(normalizeAmapPoi).slice(0, 2);
      services.push(...matches.map(spot => ({
        id: spot.id,
        type: query.type,
        typeLabel: query.label,
        name: spot.name,
        address: spot.address,
        city: spot.city,
        district: spot.district,
        lngLat: [spot.location.lng, spot.location.lat],
        distanceM: Number((payload.pois || []).find(item => item.id === spot.id)?.distance || 0),
        tel: spot.tel,
        provider: "高德 POI 2.0 周边搜索",
        dataType: "realtime-search"
      })));
    } catch {
      // A missing category is a transparent partial result, not a fabricated service point.
    }
    await wait(140);
  }
  return services;
}

function parseAmapPolyline(steps = []) {
  return steps
    .flatMap(step => String(step.polyline || "").split(";"))
    .map(point => point.split(",").map(Number))
    .filter(point => point.length === 2 && point.every(Number.isFinite))
    .filter((point, index, list) => index === 0 || point[0] !== list[index - 1][0] || point[1] !== list[index - 1][1]);
}

async function fetchAmapDrivingLeg(from, to) {
  const payload = await fetchAmapJson("/v3/direction/driving", {
    origin: from.lngLat.join(","),
    destination: to.lngLat.join(","),
    extensions: "base",
    output: "JSON"
  }, 30 * 60 * 1000);
  const path = payload.route?.paths?.[0];
  if (!path) throw new Error("amap_driving_path_missing");
  const polyline = parseAmapPolyline(path.steps);
  return {
    id: `${from.id}__${to.id}`,
    fromId: from.id,
    toId: to.id,
    fromName: from.name,
    toName: to.name,
    distanceM: Number(path.distance || 0),
    distanceKm: Math.round(Number(path.distance || 0) / 100) / 10,
    durationS: Number(path.duration || 0),
    durationMinutes: Math.max(1, Math.round(Number(path.duration || 0) / 60)),
    trafficLights: Number(path.traffic_lights || 0),
    tolls: Number(path.tolls || 0),
    polyline: polyline.length >= 2 ? polyline : [from.lngLat, to.lngLat],
    dataType: "realtime-route",
    provider: "高德驾车路径规划"
  };
}

function estimatedDrivingLeg(from, to, error = "") {
  const directKm = distanceKm(from.lngLat, to.lngLat);
  const distance = Number.isFinite(directKm) ? Math.round(directKm * 1.28 * 10) / 10 : 0;
  return {
    id: `${from.id}__${to.id}`,
    fromId: from.id,
    toId: to.id,
    fromName: from.name,
    toName: to.name,
    distanceM: Math.round(distance * 1000),
    distanceKm: distance,
    durationS: Math.round((distance / 52) * 3600),
    durationMinutes: Math.max(1, Math.round((distance / 52) * 60)),
    trafficLights: null,
    tolls: null,
    polyline: [from.lngLat, to.lngLat],
    dataType: "model-estimate",
    provider: "点位关系估算",
    error
  };
}

async function buildRoadRoute(sites = []) {
  const pairs = sites.slice(1).map((site, index) => [sites[index], site]);
  if (!pairs.length) {
    return { status: "empty", provider: "高德驾车路径规划", legs: [], totals: { distanceKm: 0, durationMinutes: 0 } };
  }
  if (!process.env.AMAP_WEB_SERVICE_KEY) {
    const legs = pairs.map(([from, to]) => estimatedDrivingLeg(from, to, "amap_key_not_configured"));
    return {
      status: "estimate-only",
      provider: "点位关系估算",
      notice: "未配置高德 Web 服务 Key，当前线路仅表示点位关系。",
      legs,
      totals: {
        distanceKm: Math.round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 10) / 10,
        durationMinutes: legs.reduce((sum, leg) => sum + leg.durationMinutes, 0)
      }
    };
  }

  const legs = [];
  for (const [from, to] of pairs) {
    try {
      legs.push(await fetchAmapDrivingLeg(from, to));
    } catch (error) {
      legs.push(estimatedDrivingLeg(from, to, error.message));
    }
    await wait(180);
  }
  const liveCount = legs.filter(leg => leg.dataType === "realtime-route").length;
  return {
    status: liveCount === legs.length ? "live" : liveCount ? "partial" : "estimate-only",
    provider: liveCount ? "高德驾车路径规划" : "点位关系估算",
    refreshedAt: new Date().toISOString(),
    notice: liveCount === legs.length
      ? "全部相邻点位已使用高德道路规划。"
      : `已获取 ${liveCount}/${legs.length} 段真实道路，其余线路为点位关系估算。`,
    legs,
    totals: {
      distanceKm: Math.round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 10) / 10,
      durationMinutes: legs.reduce((sum, leg) => sum + leg.durationMinutes, 0)
    }
  };
}

function clockToMinutes(value = "") {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToClock(value = 0) {
  const normalized = Math.max(0, Math.round(value));
  return `${String(Math.floor(normalized / 60) % 24).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function buildExecutableSchedule(routePlan) {
  const siteById = new Map((routePlan.sites || []).map(site => [site.id, site]));
  const legByPair = new Map((routePlan.roadData?.legs || []).map(leg => [`${leg.fromId}__${leg.toId}`, leg]));
  const violations = [];
  let verifiedOpeningHours = 0;
  let estimatedOpeningHours = 0;
  const days = (routePlan.itinerary || []).map(day => {
    let cursor = 8 * 60 + 30;
    let previous = null;
    const dayLoadFactor = (day.sites || []).length >= 3 ? 0.65 : 1;
    const entries = (day.sites || []).map(siteId => {
      const site = siteById.get(siteId);
      if (!site) return null;
      const leg = previous ? legByPair.get(`${previous.id}__${site.id}`) : null;
      const travelMinutes = previous
        ? Number(leg?.durationMinutes || Math.max(10, Math.round(distanceKm(previous.lngLat, site.lngLat) / 45 * 60)))
        : 0;
      const arrival = cursor + travelMinutes;
      const opening = site.openingWindow || parseOpeningWindow({}, site.tags || []);
      const opensAt = clockToMinutes(opening.open) ?? 8 * 60 + 30;
      const closesAt = clockToMinutes(opening.close) ?? 17 * 60 + 30;
      const visitStart = Math.max(arrival, opensAt);
      const waitMinutes = Math.max(0, visitStart - arrival);
      let visitDurationMinutes = Math.max(60, Math.round(Number(site.visitDurationMinutes || visitDurationForTags(site.tags || [])) * dayLoadFactor / 5) * 5);
      let departure = visitStart + visitDurationMinutes;
      let scheduleAdjustment = "none";
      if (departure > closesAt && closesAt - visitStart >= 60) {
        visitDurationMinutes = Math.floor((closesAt - visitStart) / 5) * 5;
        departure = visitStart + visitDurationMinutes;
        scheduleAdjustment = "shortened-to-fit-opening-window";
      }
      const status = departure <= closesAt ? "feasible" : "attention";
      if (opening.source === "amap-business") verifiedOpeningHours += 1;
      else estimatedOpeningHours += 1;
      if (status !== "feasible") {
        violations.push({
          day: day.day,
          siteId: site.id,
          siteName: site.name,
          reason: "departure_after_close",
          value: `${minutesToClock(departure)} > ${opening.close}`
        });
      }
      if (departure > 20 * 60) {
        violations.push({
          day: day.day,
          siteId: site.id,
          siteName: site.name,
          reason: "daily_horizon_exceeded",
          value: minutesToClock(departure)
        });
      }
      cursor = departure;
      previous = site;
      return {
        siteId: site.id,
        siteName: site.name,
        travelMinutes,
        travelDataType: leg?.dataType || (previous ? "model-estimate" : "first-stop"),
        arrivalTime: minutesToClock(arrival),
        waitMinutes,
        visitStartTime: minutesToClock(visitStart),
        departureTime: minutesToClock(departure),
        visitDurationMinutes,
        openingWindow: opening,
        scheduleAdjustment,
        status
      };
    }).filter(Boolean);
    return {
      day: day.day,
      date: day.date,
      startTime: entries[0]?.arrivalTime || "09:00",
      endTime: entries.at(-1)?.departureTime || "09:00",
      entries
    };
  });

  return {
    timezone: "Asia/Shanghai",
    days,
    qualityGate: {
      passed: violations.length === 0,
      violations,
      verifiedOpeningHours,
      estimatedOpeningHours,
      note: estimatedOpeningHours
        ? "未返回营业时间的景点使用透明标注的规则时间窗，出发前需再次核验。"
        : "营业时间均来自高德 POI 商业字段。"
    }
  };
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function normalizeLiveWeather(payload, fallback) {
  const live = payload?.lives?.[0];
  if (!live) return null;
  return {
    city: live.city || fallback.city,
    shortName: fallback.shortName,
    adcode: live.adcode || fallback.adcode,
    weather: live.weather,
    temperature: Number(live.temperature),
    humidity: Number(live.humidity),
    windDirection: live.winddirection,
    windPower: live.windpower,
    reportTime: live.reporttime,
    dataType: "realtime",
    provider: "高德天气查询"
  };
}

function normalizeWeatherForecast(payload, fallback) {
  const forecast = payload?.forecasts?.[0];
  if (!forecast) return null;
  return {
    city: forecast.city || fallback.city,
    shortName: fallback.shortName,
    adcode: forecast.adcode || fallback.adcode,
    reportTime: forecast.reporttime,
    dataType: "forecast",
    provider: "高德天气查询",
    days: (forecast.casts || []).map(day => ({
      date: day.date,
      week: day.week,
      dayWeather: day.dayweather,
      nightWeather: day.nightweather,
      dayTemp: Number(day.daytemp),
      nightTemp: Number(day.nighttemp),
      dayWind: day.daywind,
      dayPower: day.daypower
    }))
  };
}

async function liveWeatherBundle(
  adcodes = amapCityAdcodes.map(item => item.adcode),
  forecastAdcodes = ["520100"]
) {
  const cityForAdcode = adcode => amapCityAdcodes.find(item => item.adcode === adcode) || {
    city: "",
    shortName: "",
    adcode
  };
  const requested = [...new Set(Array.isArray(adcodes) ? adcodes : [adcodes])]
    .map(cityForAdcode)
    .filter(item => item.adcode);
  const requestedForecastCodes = Array.isArray(forecastAdcodes) ? forecastAdcodes : [forecastAdcodes];
  const requestedForecastCities = [...new Set(requestedForecastCodes)]
    .map(cityForAdcode)
    .filter(item => item.adcode);
  if (!process.env.AMAP_WEB_SERVICE_KEY) {
    return {
      configured: false,
      status: "unavailable",
      provider: "高德天气查询",
      live: [],
      forecasts: [],
      forecast: null,
      message: "尚未配置 AMAP_WEB_SERVICE_KEY"
    };
  }

  // The public weather endpoint enforces a low per-second QPS. Refresh cities
  // with a short interval so a cold cache still returns a complete province view.
  const liveSettled = [];
  for (const city of requested) {
    try {
      let payload;
      const params = {
        city: city.adcode,
        extensions: "base",
        output: "JSON"
      };
      try {
        payload = await fetchAmapJson("/v3/weather/weatherInfo", params, 8 * 60 * 1000);
      } catch (error) {
        if (!error.message.includes("10021")) throw error;
        await wait(520);
        payload = await fetchAmapJson("/v3/weather/weatherInfo", params, 8 * 60 * 1000);
      }
      liveSettled.push({ status: "fulfilled", value: normalizeLiveWeather(payload, city) });
    } catch (reason) {
      liveSettled.push({ status: "rejected", reason });
    }
    await wait(260);
  }
  const live = liveSettled.filter(result => result.status === "fulfilled" && result.value).map(result => result.value);
  const forecastSettled = [];
  for (const city of requestedForecastCities) {
    try {
      await wait(260);
      const params = {
        city: city.adcode,
        extensions: "all",
        output: "JSON"
      };
      let payload;
      try {
        payload = await fetchAmapJson("/v3/weather/weatherInfo", params, 25 * 60 * 1000);
      } catch (error) {
        if (!error.message.includes("10021")) throw error;
        await wait(520);
        payload = await fetchAmapJson("/v3/weather/weatherInfo", params, 25 * 60 * 1000);
      }
      forecastSettled.push({ status: "fulfilled", value: normalizeWeatherForecast(payload, city) });
    } catch (reason) {
      forecastSettled.push({ status: "rejected", reason });
    }
  }
  const forecasts = forecastSettled
    .filter(result => result.status === "fulfilled" && result.value)
    .map(result => result.value);

  return {
    configured: true,
    status: live.length ? "live" : "unavailable",
    provider: "高德天气查询",
    sourceUrl: "https://restapi.amap.com/v3/weather/weatherInfo",
    refreshedAt: new Date().toISOString(),
    live,
    forecasts,
    forecast: forecasts[0] || null,
    errors: [
      ...liveSettled.filter(result => result.status === "rejected").map(result => result.reason?.message || "weather_error"),
      ...forecastSettled.filter(result => result.status === "rejected").map(result => result.reason?.message || "forecast_error")
    ].filter(Boolean)
  };
}

function crowdLevel(index) {
  if (index >= 82) return "high";
  if (index >= 62) return "medium";
  return "low";
}

function normalizeScenicName(value = "") {
  return value
    .replace(/[·\s]/g, "")
    .replace(/旅游景区|风景名胜区|风景区|景区|旅游区/g, "");
}

function estimateCrowdSignals(scenicDataset, names = []) {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(now));
  const weekday = Number(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Shanghai" }).format(now) === "Sat"
    || new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Shanghai" }).format(now) === "Sun");
  const hourCurve = hour < 7 ? 14 : hour < 9 ? 34 : hour < 12 ? 74 : hour < 15 ? 88 : hour < 18 ? 66 : 32;
  const requested = names.length
    ? names.map(name => {
      const normalizedName = normalizeScenicName(name);
      return scenicDataset.spots.find(spot => spot.name === name)
        || scenicDataset.spots
          .filter(spot => normalizeScenicName(spot.name) === normalizedName)
          .sort((a, b) => (b.holidayHeatSeed || 0) - (a.holidayHeatSeed || 0))[0]
        || scenicDataset.spots
          .filter(spot => normalizeScenicName(spot.name).includes(normalizedName) || normalizedName.includes(normalizeScenicName(spot.name)))
          .sort((a, b) => Math.abs(a.name.length - name.length) - Math.abs(b.name.length - name.length))[0];
    }).filter((spot, index, list) => spot && list.findIndex(item => item?.id === spot.id) === index)
    : [...scenicDataset.spots].sort((a, b) => (b.holidayHeatSeed || 0) - (a.holidayHeatSeed || 0)).slice(0, 12);
  return requested.slice(0, 30).map(spot => {
    const seed = Number(spot.holidayHeatSeed || 50);
    const index = clamp(seed * 0.48 + hourCurve * 0.42 + weekday * 8);
    return {
      id: spot.id,
      name: spot.name,
      city: spot.city,
      location: spot.location,
      crowdIndex: index,
      level: crowdLevel(index),
      currentVisitors: null,
      capacity: null,
      dataType: "model-estimate",
      source: "节假日公开样本 + POI 热度种子 + 时段模型",
      updatedAt: now.toISOString()
    };
  });
}

async function authorizedCrowdSignals(names = []) {
  if (!process.env.CROWD_FLOW_API_URL) return null;
  const url = new URL(process.env.CROWD_FLOW_API_URL);
  if (names.length) url.searchParams.set("names", names.join(","));
  const response = await fetch(url, {
    headers: process.env.CROWD_FLOW_API_TOKEN ? { authorization: `Bearer ${process.env.CROWD_FLOW_API_TOKEN}` } : {},
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`crowd_flow_http_${response.status}`);
  const payload = await response.json();
  const sites = Array.isArray(payload) ? payload : payload.sites;
  if (!Array.isArray(sites)) throw new Error("crowd_flow_invalid_schema");
  return sites.map(site => ({
    ...site,
    dataType: "authorized-realtime",
    source: payload.provider || process.env.CROWD_FLOW_PROVIDER || "景区授权客流接口"
  }));
}

async function crowdFlowBundle(scenicDataset, names = []) {
  try {
    const authorized = await authorizedCrowdSignals(names);
    if (authorized) {
      return {
        status: "live",
        dataType: "authorized-realtime",
        provider: process.env.CROWD_FLOW_PROVIDER || "景区授权客流接口",
        refreshedAt: new Date().toISOString(),
        sites: authorized
      };
    }
  } catch (error) {
    return {
      status: "degraded",
      dataType: "model-estimate",
      provider: "山河守护客流估算模型",
      refreshedAt: new Date().toISOString(),
      notice: `授权客流接口不可用：${error.message}。当前仅展示客流指数估算，不代表实时人数。`,
      sites: estimateCrowdSignals(scenicDataset, names)
    };
  }
  return {
    status: "estimate-only",
    dataType: "model-estimate",
    provider: "山河守护客流估算模型",
    refreshedAt: new Date().toISOString(),
    notice: "尚未接入景区票务、闸机或运营商授权数据；当前仅展示客流指数估算，不代表实时人数。",
    productionAdapter: {
      env: ["CROWD_FLOW_API_URL", "CROWD_FLOW_API_TOKEN", "CROWD_FLOW_PROVIDER"],
      expectedFields: ["id", "name", "currentVisitors", "capacity", "updatedAt"]
    },
    sites: estimateCrowdSignals(scenicDataset, names)
  };
}

async function fetchAmapStaticMap(options = {}) {
  const requestedLocation = String(options.location || "");
  const location = /^-?\d{1,3}(?:\.\d+)?,-?\d{1,2}(?:\.\d+)?$/.test(requestedLocation)
    ? requestedLocation
    : "106.700000,26.800000";
  const zoom = String(Math.max(3, Math.min(15, Math.round(Number(options.zoom || 6)))));
  const params = {
    location,
    scale: "2",
    size: "1024*576",
    traffic: "1",
    zoom
  };
  const cacheKey = `amap-static-map:${location}:1024x576:z${zoom}`;
  const cached = amapCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < 20 * 60 * 1000) return cached.value;
  const response = await fetch(buildSignedAmapUrl("/v3/staticmap", params), {
    headers: { accept: "image/png,image/*" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`amap_static_map_http_${response.status}`);
  const contentType = response.headers.get("content-type") || "image/png";
  const body = Buffer.from(await response.arrayBuffer());
  if (!contentType.startsWith("image/") || body.length < 1000) throw new Error("amap_static_map_invalid_response");
  const value = { body, contentType };
  amapCache.set(cacheKey, { value, updatedAt: Date.now() });
  return value;
}

function scenicSummary(dataset) {
  const cityCounts = dataset.meta?.cityStats?.length
    ? dataset.meta.cityStats.map(item => ({ city: item.city, count: item.received || item.total || 0 }))
    : Object.entries(dataset.spots.reduce((acc, spot) => {
      acc[spot.city] = (acc[spot.city] || 0) + 1;
      return acc;
    }, {})).map(([city, count]) => ({ city, count }));
  const topHotspots = [...dataset.spots]
    .sort((a, b) => (b.holidayHeatSeed || 0) - (a.holidayHeatSeed || 0))
    .slice(0, 12)
    .map(spot => ({
      id: spot.id,
      name: spot.name,
      city: spot.city,
      district: spot.district,
      rating: spot.rating,
      holidayHeatSeed: spot.holidayHeatSeed,
      location: spot.location,
    }));
  return {
    provider: dataset.meta?.provider || "AMap Place Search",
    generatedAt: dataset.meta?.generatedAt || "",
    total: dataset.meta?.total || dataset.spots.length,
    cityCounts,
    topHotspots,
    note: dataset.meta?.note || ""
  };
}

function filterScenicSpots(dataset, params) {
  const city = params.city || "";
  const keyword = params.keyword || "";
  const photoRequired = params.photo === "required";
  const limit = Math.max(1, Math.min(2500, Number(params.limit || 80)));
  const offset = Math.max(0, Number(params.offset || 0));
  const filtered = dataset.spots.filter(spot => {
    if (city && !`${spot.city}${spot.district}`.includes(city)) return false;
    if (keyword && !`${spot.name}${spot.type}${spot.address}`.includes(keyword)) return false;
    if (photoRequired && !(spot.photos || []).some(photo => photo?.url)) return false;
    return true;
  });
  return {
    total: filtered.length,
    offset,
    limit,
    spots: filtered.slice(offset, offset + limit),
  };
}

function scenicImagePath(spot) {
  return spot?.id
    ? `/api/scenic-photo?id=${encodeURIComponent(spot.id)}`
    : "";
}

function allowedScenicPhotoHost(hostname = "") {
  return hostname === "store.is.autonavi.com"
    || hostname.endsWith(".autonavi.com")
    || hostname === "aos-comment.amap.com"
    || hostname.endsWith(".amap.com");
}

function scenicPhotoCacheStem(spotId = "") {
  return String(spotId).replace(/[^a-zA-Z0-9_-]/g, "") || createHash("sha1").update(String(spotId)).digest("hex");
}

async function readScenicPhotoDiskCache(spotId) {
  const stem = scenicPhotoCacheStem(spotId);
  for (const extension of [".jpg", ".png", ".webp", ".gif"]) {
    const path = join(scenicPhotoDiskCacheDir, `${stem}${extension}`);
    try {
      const body = await readFile(path);
      const contentType = detectImageContentType(body, "", extension);
      if (contentType && body.length >= 500) {
        return { contentType, body, matchType: "exact-poi-cache" };
      }
    } catch {
      // A cache miss is expected on the first request.
    }
  }
  return null;
}

async function writeScenicPhotoDiskCache(spotId, contentType, body) {
  const extension = contentType === "image/png"
    ? ".png"
    : contentType === "image/webp"
      ? ".webp"
      : contentType === "image/gif"
        ? ".gif"
        : ".jpg";
  await mkdir(scenicPhotoDiskCacheDir, { recursive: true });
  await writeFile(join(scenicPhotoDiskCacheDir, `${scenicPhotoCacheStem(spotId)}${extension}`), body);
}

function verifiedPhotoUrls(poi) {
  return (poi?.photos || []).map(photo => photo?.url).filter(Boolean);
}

async function fetchLiveExactScenicPhotoUrls(spot) {
  if (!process.env.AMAP_WEB_SERVICE_KEY) return [];
  const candidates = [];

  try {
    const detail = await fetchAmapJson("/v3/place/detail", {
      id: spot.id,
      extensions: "all",
      output: "JSON"
    }, 24 * 60 * 60 * 1000);
    const exactPoi = (detail.pois || []).find(poi => poi.id === spot.id);
    if (exactPoi) candidates.push(exactPoi);
  } catch {
    // Older POI IDs can disappear; the verified name-and-location search below handles that case.
  }

  if (!candidates.some(candidate => verifiedPhotoUrls(candidate).length)) {
    try {
      const search = await fetchAmapJson("/v3/place/text", {
        keywords: spot.name,
        city: spot.city,
        citylimit: "true",
        types: "110000",
        offset: "10",
        page: "1",
        extensions: "all",
        output: "JSON"
      }, 24 * 60 * 60 * 1000);
      const targetLocation = [Number(spot.location?.lng), Number(spot.location?.lat)];
      const normalizedTarget = normalizeScenicName(spot.name);
      const exactNamePoi = (search.pois || [])
        .filter(poi => normalizeScenicName(poi.name) === normalizedTarget)
        .map(poi => ({
          poi,
          distance: distanceKm(targetLocation, String(poi.location || "").split(",").map(Number))
        }))
        .filter(item => Number.isFinite(item.distance) && item.distance <= 3)
        .sort((a, b) => a.distance - b.distance)[0]?.poi;
      if (exactNamePoi) candidates.push(exactNamePoi);
    } catch {
      // Keep the saved POI photos as the final exact source when live search is unavailable.
    }
  }

  return [...new Set(candidates.flatMap(verifiedPhotoUrls))];
}

async function fetchScenicPhoto(dataset, spotId) {
  const cacheKey = `scenic-photo:${spotId}`;
  const cached = scenicPhotoCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt < 24 * 60 * 60 * 1000) return cached.value;

  const spot = (dataset.spots || []).find(item => item.id === spotId) || regionalScenicSpotCache.get(spotId);
  if (!spot) throw new Error("scenic_photo_spot_not_found");

  const diskCached = await readScenicPhotoDiskCache(spotId);
  if (diskCached) {
    scenicPhotoCache.set(cacheKey, { updatedAt: Date.now(), value: diskCached });
    return diskCached;
  }

  const savedUrls = verifiedPhotoUrls(spot);
  const fetchVerifiedPhoto = async (urls, matchType) => {
    for (const photoUrl of [...new Set(urls)]) {
      try {
        const parsed = new URL(photoUrl);
        if (!["http:", "https:"].includes(parsed.protocol) || !allowedScenicPhotoHost(parsed.hostname)) continue;
        const response = await fetch(parsed, {
          headers: {
            accept: "image/avif,image/webp,image/apng,image/jpeg,image/png,image/*",
            referer: "https://www.amap.com/",
            "user-agent": "Mozilla/5.0 ShanheGuardian/1.0"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) continue;
        const headerType = response.headers.get("content-type") || "";
        const body = Buffer.from(await response.arrayBuffer());
        const contentType = detectImageContentType(body, headerType, parsed.pathname);
        if (!contentType || body.length < 500 || body.length > 8 * 1024 * 1024) continue;
        return { contentType, body, matchType };
      } catch {
        // Try the next verified photo for this exact POI.
      }
    }
    return null;
  };

  // Place search already returns photos for the exact POI. Use them first so a
  // route containing many cards does not trigger another burst of AMap calls.
  let value = await fetchVerifiedPhoto(savedUrls, "exact-poi");
  if (!value) {
    const liveUrls = await fetchLiveExactScenicPhotoUrls(spot);
    value = await fetchVerifiedPhoto(liveUrls, "exact-poi-live");
  }
  if (value) {
    scenicPhotoCache.set(cacheKey, { updatedAt: Date.now(), value });
    await writeScenicPhotoDiskCache(spotId, value.contentType, value.body).catch(() => {});
    return value;
  }

  throw new Error("scenic_photo_unavailable");
}

function detectImageContentType(body, headerType = "", pathname = "") {
  if (!Buffer.isBuffer(body) || body.length < 12) return "";
  if (headerType.startsWith("image/")) return headerType.split(";")[0];
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (body.subarray(0, 4).toString("ascii") === "RIFF" && body.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (/\.jpe?g$/i.test(pathname)) return "image/jpeg";
  if (/\.png$/i.test(pathname)) return "image/png";
  if (/\.webp$/i.test(pathname)) return "image/webp";
  return "";
}

async function corpusApi(pathname, options = {}) {
  const response = await fetch(`${corpusMarketBase}${pathname}`, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) {
    throw new Error(`corpus_market_${response.status}`);
  }
  const payload = await response.json();
  if (payload.code && payload.code !== 200000) {
    throw new Error(payload.msg || "corpus_market_error");
  }
  return payload.data ?? payload;
}

function normalizeCorpusResource(item) {
  const text = [
    item.name,
    item.org,
    ...(item.sourceOrgList || []),
    ...(item.industryField || []),
    ...(item.applicationScenarios || []),
    ...(item.modalList || [])
  ].filter(Boolean).join(" ");
  const matchedRoles = corpusRoleMap
    .filter(role => role.keywords.some(keyword => text.includes(keyword)))
    .map(role => ({ role: role.role, label: role.label }));
  return {
    id: item.id,
    name: item.name,
    type: item.type?.message || item.type || "",
    dataType: item.dataType || [],
    modalList: item.modalList || [],
    sourceOrgList: item.sourceOrgList || [],
    industryField: item.industryField || [],
    applicationScenarios: item.applicationScenarios || [],
    sourceFactory: item.sourceFactory || [],
    publishTime: item.publishTime,
    viewCount: item.viewCount,
    status: item.status,
    marketUrl: `${corpusMarketBase}/corpus-market/${item.id}`,
    matchedRoles
  };
}

async function corpusCatalog(options = {}) {
  const pageIndex = Number(options.pageIndex || 1);
  const pageSize = Math.min(Number(options.pageSize || 100), 100);
  const body = {
    pageIndex,
    pageSize
  };
  if (options.keyword) body.keyword = options.keyword;
  if (options.type) body.type = options.type;
  const data = await corpusApi("/api/corpus-infrastructure-server/protals/resource/listPage", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return {
    total: data.total || 0,
    current: data.current || pageIndex,
    size: data.size || pageSize,
    pages: data.pages || 1,
    records: (data.records || []).map(normalizeCorpusResource)
  };
}

async function corpusStatistics() {
  return corpusApi("/api/corpus-infrastructure-server/protals/resource/statistics");
}

async function relevantCorpusResources() {
  const catalog = await corpusCatalog({ pageIndex: 1, pageSize: 100 });
  const resources = catalog.records.filter(resource => {
    const text = [
      resource.name,
      ...resource.sourceOrgList,
      ...resource.industryField,
      ...resource.applicationScenarios,
      ...resource.modalList
    ].join(" ");
    return corpusRelevantKeywords.some(keyword => text.includes(keyword));
  });
  return {
    total: catalog.total,
    matched: resources.length,
    resources,
    dataMapping: corpusRoleMap.map(role => ({
      role: role.role,
      label: role.label,
      resources: resources
        .filter(resource => resource.matchedRoles.some(item => item.role === role.role))
        .map(resource => ({ id: resource.id, name: resource.name, marketUrl: resource.marketUrl }))
    }))
  };
}

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(payload, null, 2));
}

async function readJson(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > 256 * 1024) {
      const error = new Error("request_body_too_large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function pruneDecisionSnapshots() {
  const expiresBefore = Date.now() - decisionSnapshotTtlMs;
  for (const [planId, snapshot] of decisionSnapshots) {
    if (snapshot.savedAt < expiresBefore) decisionSnapshots.delete(planId);
  }
  while (decisionSnapshots.size >= decisionSnapshotLimit) {
    decisionSnapshots.delete(decisionSnapshots.keys().next().value);
  }
}

function saveDecisionSnapshot(routePlan) {
  pruneDecisionSnapshots();
  const planId = `plan_${randomUUID()}`;
  const generatedAt = new Date().toISOString();
  const snapshot = { ...routePlan, planId, generatedAt };
  decisionSnapshots.set(planId, { savedAt: Date.now(), routePlan: snapshot });
  return snapshot;
}

function readDecisionSnapshot(planId) {
  if (!planId) return null;
  const snapshot = decisionSnapshots.get(String(planId));
  if (!snapshot || Date.now() - snapshot.savedAt >= decisionSnapshotTtlMs) {
    decisionSnapshots.delete(String(planId));
    return null;
  }
  return snapshot.routePlan;
}

async function loadIncidentStore() {
  if (incidentStore) return incidentStore;
  try {
    const payload = JSON.parse(await readFile(incidentStorePath, "utf8"));
    incidentStore = payload && typeof payload === "object" ? payload : { incidents: {} };
  } catch {
    incidentStore = { incidents: {}, updatedAt: null };
  }
  incidentStore.incidents ||= {};
  return incidentStore;
}

function cleanText(value, limit = 500) {
  return String(value || "").trim().slice(0, limit);
}

async function saveIncident(input = {}) {
  const siteId = cleanText(input.siteId, 120);
  if (!siteId) {
    const error = new Error("incident_site_id_required");
    error.statusCode = 400;
    throw error;
  }
  const store = await loadIncidentStore();
  const previous = store.incidents[siteId] || {};
  const allowedStatuses = new Set(["pending", "confirmed", "responding", "closed"]);
  const status = allowedStatuses.has(input.status) ? input.status : previous.status || "pending";
  const updatedAt = new Date().toISOString();
  const audit = Array.isArray(previous.audit) ? [...previous.audit] : [];
  audit.push({
    id: randomUUID(),
    time: updatedAt,
    event: cleanText(input.event || `状态更新为${status}`, 200),
    status
  });
  const incident = {
    id: previous.id || `incident_${randomUUID()}`,
    siteId,
    siteName: cleanText(input.siteName || previous.siteName, 120),
    planId: cleanText(input.planId || previous.planId, 160),
    status,
    assignee: cleanText(input.assignee, 160),
    checkedActions: Array.isArray(input.checkedActions)
      ? input.checkedActions.map(item => cleanText(item, 240)).filter(Boolean).slice(0, 20)
      : previous.checkedActions || [],
    note: cleanText(input.note, 2000),
    logs: Array.isArray(input.logs)
      ? input.logs.slice(-100).map(item => ({ time: cleanText(item.time, 40), text: cleanText(item.text, 300) }))
      : previous.logs || [],
    audit: audit.slice(-200),
    createdAt: previous.createdAt || updatedAt,
    updatedAt
  };
  store.incidents[siteId] = incident;
  store.updatedAt = updatedAt;
  incidentWriteQueue = incidentWriteQueue
    .catch(() => undefined)
    .then(() => writeFile(incidentStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8"));
  await incidentWriteQueue;
  return incident;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function avg(list, key) {
  if (!list.length) return 0;
  return Math.round(list.reduce((sum, item) => sum + item[key], 0) / list.length);
}

function riskLabel(item) {
  if (item.businessDensity >= 78) return "竞争密集";
  if (item.creditRisk >= 23) return "信用核验";
  if (item.rentPressure >= 68) return "租金压力";
  if (item.trafficAccess < 64) return "交通约束";
  return "风险可控";
}

function scoreLocation(item, options = {}) {
  const businessType = options.businessType || "景区餐饮";
  const strategy = options.strategy || "balanced";
  const budget = options.budget || "standard";
  const weights = {
    flow: Number(options.weights?.flow ?? 8),
    traffic: Number(options.weights?.traffic ?? 8),
    blank: Number(options.weights?.blank ?? 6),
    policy: Number(options.weights?.policy ?? 6),
    risk: Number(options.weights?.risk ?? 7)
  };
  const budgetPenalty = budget === "light" ? item.rentPressure * 0.35 : budget === "flagship" ? item.rentPressure * 0.12 : item.rentPressure * 0.22;
  const flow = item.touristFlow * 0.5 + item.populationFlow * 0.28 + item.incomeIndex * 0.22;
  const blank = 100 - item.businessDensity;
  const policy = item.policyFit * 0.58 + item.employmentFit * 0.26 + item.macroHeat * 0.16;
  const risk = 100 - item.creditRisk * 1.18 - budgetPenalty * 0.32;
  const target = item.targetFit?.[businessType] || 70;
  let boost = 0;
  if (strategy === "flow") boost += item.touristFlow * 0.08;
  if (strategy === "blank") boost += blank * 0.12 - item.businessDensity * 0.04;
  if (strategy === "policy") boost += item.policyFit * 0.1;
  if (strategy === "cost") boost += (100 - item.rentPressure) * 0.12;
  const raw = (
    flow * weights.flow +
    item.trafficAccess * weights.traffic +
    blank * weights.blank +
    policy * weights.policy +
    risk * weights.risk +
    target * 7 +
    item.poiMaturity * 3
  ) / (weights.flow + weights.traffic + weights.blank + weights.policy + weights.risk + 10);
  return clamp(raw + boost);
}

function recommend(locations, options = {}) {
  const region = options.region || "全省文旅片区";
  const scoped = region === "全省文旅片区" ? locations : locations.filter(item => item.city === region);
  const candidates = (scoped.length ? scoped : locations)
    .map(item => ({
      ...item,
      opportunities: item.opportunities || ["公共数据指标表现较好", "具备文旅商业服务承载空间"],
      risks: item.risks || ["需接入真实公共数据进一步核验"],
      actions: item.actions || ["进入真实数据环境后复核评分与风险证据"],
      score: scoreLocation(item, options),
      riskLabel: riskLabel(item)
    }))
    .sort((a, b) => b.score - a.score);
  const top = candidates[0];
  return {
    mode: "local-simulation",
    top,
    candidates,
    metrics: {
      count: candidates.length,
      topScore: top?.score || 0,
      avgScore: avg(candidates, "score"),
      avgFlow: avg(candidates, "touristFlow"),
      avgPolicy: avg(candidates, "policyFit"),
      riskCount: candidates.filter(item => item.riskLabel !== "风险可控").length
    },
    summary: top
      ? `${top.name} 为当前首选片区，综合分 ${top.score}。主要优势：${top.opportunities.slice(0, 2).join("、")}；需核验：${top.riskLabel}。`
      : "暂无候选片区。"
  };
}

function report(result, options = {}) {
  const top = result.top;
  if (!top) return "暂无可生成报告的候选片区。";
  const lines = result.candidates
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.name}：${item.score}分，风险：${item.riskLabel}`)
    .join("\n");
  return [
    "黔址优选公共数据智能选址报告",
    `目标业态：${options.businessType || "景区餐饮"}`,
    `目标区域：${options.region || "全省文旅片区"}`,
    `经营策略：${options.strategy || "balanced"}`,
    "",
    `首选片区：${top.name}（${top.score}分）`,
    `核心优势：${top.opportunities.join("；")}`,
    `风险提示：${top.risks.join("；")}`,
    `建议动作：${top.actions.join("；")}`,
    "",
    "候选排序：",
    lines,
    "",
    "真实数据申请：工商主体、企业信用、就业人才、流动人口、宏观经济、POI、交通客流、景区热度。"
  ].join("\n");
}

function dataRequest(top) {
  return [
    { category: "工商", fields: ["企业基本信息", "行业分类", "经营状态", "成立时间"], priority: "必需" },
    { category: "信用", fields: ["经营异常", "行政处罚", "投诉记录", "失信风险"], priority: "必需" },
    { category: "就业", fields: ["岗位供给", "技能等级", "工资区间"], priority: "重要" },
    { category: "人口", fields: ["游客来源地", "停留时长", "年龄结构"], priority: "重要" },
    { category: "空间", fields: top?.dataNeed || [], priority: "必需" }
  ];
}

const tourismLabels = {
  travelerType: {
    family: "亲子家庭",
    senior: "老人同行",
    study: "研学团队",
    wellness: "康养游客",
    solo: "独自旅行"
  },
  weather: {
    auto: "实时天气自动研判",
    rain: "小雨路滑",
    fog: "山间大雾",
    heat: "高温暴晒",
    clear: "晴朗通行"
  },
  preference: {
    safe: "安全优先",
    culture: "民族文化",
    nature: "山地自然",
    lowload: "低强度"
  }
};

function includesAny(text, words) {
  return words.some(word => text.includes(word));
}

function guizhouDate(value = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(value);
}

function addCalendarDays(dateText, days) {
  const date = new Date(`${dateText}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return guizhouDate(date);
}

const tourismOriginHubs = Object.freeze({
  贵阳: [106.630153, 26.647661],
  遵义: [106.927389, 27.725654],
  六盘水: [104.830359, 26.592666],
  安顺: [105.947594, 26.253072],
  毕节: [105.291544, 27.283615],
  铜仁: [109.189598, 27.731514],
  凯里: [107.977488, 26.583352],
  都匀: [107.517156, 26.258219],
  兴义: [104.895467, 25.09204]
});

function normalizeTourismOrigin(value = "") {
  const normalized = String(value).trim().replace(/市$/, "");
  const aliases = {
    黔东南: "凯里",
    黔东南州: "凯里",
    黔南: "都匀",
    黔南州: "都匀",
    黔西南: "兴义",
    黔西南州: "兴义"
  };
  return aliases[normalized] || normalized || "贵阳";
}

function normalizeTourismOptions(options = {}) {
  const request = String(options.request || options.prompt || "");
  const travelerType = options.travelerType
    || (includesAny(request, ["父母", "孩子", "亲子", "儿童"]) ? "family"
      : includesAny(request, ["老人", "康养", "少爬坡"]) ? "senior"
      : includesAny(request, ["研学", "学生", "团队"]) ? "study"
      : "wellness");
  const weather = options.weather
    || (includesAny(request, ["雨", "路滑", "湿滑"]) ? "rain"
      : includesAny(request, ["雾", "大雾"]) ? "fog"
      : includesAny(request, ["热", "暴晒", "高温"]) ? "heat"
      : "clear");
  const preference = options.preference
    || (includesAny(request, ["安全", "应急", "不想太累"]) ? "safe"
      : includesAny(request, ["民族", "文化", "苗寨", "古镇"]) ? "culture"
      : includesAny(request, ["自然", "山地", "瀑布", "喀斯特"]) ? "nature"
      : "lowload");
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(options.startDate || ""))
    ? String(options.startDate)
    : guizhouDate();

  return {
    request,
    origin: normalizeTourismOrigin(options.origin),
    destinationRegion: String(options.destinationRegion || options.region || "贵州").trim() || "贵州",
    destinationLngLat: Array.isArray(options.destinationLngLat)
      ? options.destinationLngLat.map(Number).filter(Number.isFinite).slice(0, 2)
      : [],
    startDate,
    travelerType,
    weather,
    preference,
    days: Math.max(1, Math.min(10, Number(options.days || 2))),
    intensity: Math.max(20, Math.min(90, Number(options.intensity || 45))),
    routeMode: ["safety-first", "balanced", "experience-first"].includes(options.routeMode)
      ? options.routeMode
      : preference === "nature"
        ? "experience-first"
        : preference === "culture"
          ? "balanced"
          : "safety-first",
    selectedSiteNames: Array.isArray(options.selectedSiteNames)
      ? options.selectedSiteNames.map(value => String(value).trim()).filter(Boolean).slice(0, 30)
      : [],
    liveWeatherByCity: options.liveWeatherByCity || {},
    forecastWeatherByCity: options.forecastWeatherByCity || {},
    liveWeatherStatus: options.liveWeatherStatus || "unavailable"
  };
}

function normalizeTourismCity(city = "") {
  return String(city)
    .replace(/(?:藏族羌族|藏族|彝族|苗族侗族|布依族苗族|土家族苗族|蒙古族|朝鲜族|哈尼族彝族|傣族景颇族|白族|壮族|回族|维吾尔族|柯尔克孜族|蒙古族藏族|黎族苗族)自治州/g, "")
    .replace("布依族苗族自治州", "")
    .replace("苗族侗族自治州", "")
    .replace("布依族苗族自治州", "")
    .replace("市", "")
    .replace("州", "");
}

function scenicTags(spot) {
  const text = `${spot.name || ""}${spot.type || ""}${spot.address || ""}`;
  const tags = [];
  if (includesAny(text, ["山", "峰", "岭", "峡谷", "大峡谷"])) tags.push("山地", "天气敏感");
  if (includesAny(text, ["瀑布", "河", "湖", "溪", "泉", "湿地", "水"])) tags.push("亲水");
  if (includesAny(text, ["古镇", "古城", "苗寨", "侗寨", "村寨"])) tags.push("古镇", "民族村寨");
  if (includesAny(text, ["洞", "溶洞"])) tags.push("洞穴", "地质研学", "温差");
  if (includesAny(text, ["公园", "广场", "园"])) tags.push("城市近郊", "低强度");
  if (includesAny(text, ["田", "林", "草原"])) tags.push("田园");
  if (!tags.length) tags.push("自然风光");
  return [...new Set(tags)];
}

function compactScenicName(name = "") {
  return String(name)
    .replace(/游客集散中心|游客中心片区|旅游度假区|旅游景区|风景名胜区|风景区|景区|历史文化|文化旅游区|文化屋|化屋|公园/g, "")
    .replace(/[（(].*?[）)]/g, "")
    .trim()
    .slice(0, 8) || String(name).slice(0, 8);
}

function parseOpeningWindow(openingHours = {}, tags = []) {
  const text = String(openingHours.today || openingHours.week || "");
  const matches = [...text.matchAll(/([01]?\d|2[0-3]):([0-5]\d)\s*[-至~—]\s*([01]?\d|2[0-3]):([0-5]\d)/g)];
  if (matches.length) {
    const first = matches[0];
    return {
      open: `${String(first[1]).padStart(2, "0")}:${first[2]}`,
      close: `${String(first[3]).padStart(2, "0")}:${first[4]}`,
      text,
      source: "amap-business"
    };
  }
  const estimated = tags.includes("古镇") || tags.includes("民族村寨")
    ? { open: "08:30", close: "21:00" }
    : tags.includes("城市近郊")
      ? { open: "08:30", close: "18:30" }
      : { open: "08:30", close: "17:30" };
  return {
    ...estimated,
    text: `${estimated.open}-${estimated.close}`,
    source: "rule-estimated"
  };
}

function visitDurationForTags(tags = []) {
  if (tags.includes("山地")) return 240;
  if (tags.includes("洞穴")) return 150;
  if (tags.includes("亲水")) return 150;
  if (tags.includes("古镇") || tags.includes("民族村寨")) return 120;
  if (tags.includes("城市近郊")) return 90;
  return 120;
}

function scenicSpotToTourismSite(spot, index) {
  const tags = scenicTags(spot);
  const heat = Number(spot.holidayHeatSeed || 55);
  const rating = Number(spot.rating || 4.2);
  const slope = tags.includes("山地") ? 24 : tags.includes("洞穴") ? 15 : tags.includes("古镇") ? 9 : 7;
  const riskBase = clamp(34 + heat * 0.22 + (tags.includes("山地") ? 9 : 0) + (tags.includes("亲水") ? 5 : 0));
  const serviceCoverage = clamp(58 + rating * 5 + (spot.tel && !Array.isArray(spot.tel) ? 5 : 0));
  const primaryRisk = tags.includes("山地")
    ? "山地天气与坡度变化"
    : tags.includes("亲水")
      ? "亲水区域湿滑风险"
      : tags.includes("古镇")
        ? "街巷承载与高峰拥堵"
        : tags.includes("洞穴")
          ? "洞穴温差与步道通行"
          : "节假日客流与服务覆盖";
  const city = normalizeTourismCity(spot.city);
  const district = spot.district || "";
  const openingWindow = parseOpeningWindow(spot.openingHours, tags);

  return {
    id: `poi_${spot.id}`,
    sourcePoiId: spot.id,
    name: spot.name,
    shortName: compactScenicName(spot.name),
    city,
    county: district,
    adcode: String(spot.adcode || ""),
    province: String(spot.province || ""),
    address: [spot.city, district, spot.address].filter(Boolean).join(" / "),
    lngLat: [Number(spot.location?.lng), Number(spot.location?.lat)],
    imagePath: scenicImagePath(spot),
    photoSource: scenicImagePath(spot) ? "高德景区 POI 实景图" : "",
    sequence: index + 20,
    tags,
    riskBase,
    slope,
    distanceKm: Number((1.4 + (index % 7) * 0.55).toFixed(1)),
    congestionBase: clamp(38 + heat * 0.5),
    serviceCoverage,
    aiFit: clamp(45 + rating * 7 + heat * 0.18),
    primaryRisk,
    services: ["景区游客服务点", "停车或换乘服务", "属地医疗急救资源"],
    openingWindow,
    visitDurationMinutes: visitDurationForTags(tags),
    evidence: [
      `高德景区 POI：${spot.name}`,
      `节假日热度种子 ${heat}`,
      `景区评分 ${rating || "暂无"}`,
      openingWindow.source === "amap-business"
        ? `高德营业时间：${openingWindow.text}`
        : "未获得可靠营业时间，当前时间窗为规则估算",
      "非核心点位的坡度、服务与风险指标由规则推估"
    ],
    actions: [
      "出发前核验景区开放与天气状态",
      "绑定最近游客中心和医疗服务点",
      "客流高峰时启用错峰或备选景点"
    ],
    sources: ["高德景区 POI", "游客画像规则", "复杂地形安全规则"],
    estimateMode: "rule-estimated"
  };
}

function buildTourismCandidates(siteDataset, scenicDataset) {
  const scenicSpots = scenicDataset?.spots || [];
  const curated = (siteDataset.sites || []).map(site => {
    const hint = curatedPoiNameHints[site.id] || site.shortName;
    const normalizedHint = normalizeScenicName(hint);
    const matched = scenicSpots
      .filter(spot => normalizeTourismCity(spot.city) === normalizeTourismCity(site.city))
      .filter(spot => {
        const normalizedName = normalizeScenicName(spot.name);
        return normalizedName === normalizedHint
          || normalizedName.includes(normalizedHint)
          || normalizedHint.includes(normalizedName);
      })
      .sort((a, b) => {
        const exactA = normalizeScenicName(a.name) === normalizedHint ? 1 : 0;
        const exactB = normalizeScenicName(b.name) === normalizedHint ? 1 : 0;
        return exactB - exactA || Number(b.rating || 0) - Number(a.rating || 0);
      })[0];
    return {
      ...site,
      sourcePoiId: matched?.id || "",
      adcode: matched?.adcode || site.adcode || "",
      province: matched?.province || site.province || "贵州省",
      imagePath: scenicImagePath(matched),
      photoSource: matched ? "高德景区 POI 实景图" : "",
      poiRating: matched?.rating || "",
      openingWindow: parseOpeningWindow(matched?.openingHours, site.tags || []),
      visitDurationMinutes: Number(site.visitDurationMinutes || visitDurationForTags(site.tags || []))
    };
  });
  const curatedNames = curated.map(site => site.shortName).filter(Boolean);
  const scenic = scenicSpots
    .filter(spot => Number.isFinite(Number(spot.location?.lng)) && Number.isFinite(Number(spot.location?.lat)))
    .filter(spot => (spot.photos || []).some(photo => photo?.url))
    .filter(spot => Number(spot.rating || 0) >= 4.6 || Number(spot.holidayHeatSeed || 0) >= 75)
    .filter(spot => !includesAny(String(spot.name || ""), ["广场", "街心花园", "停车场", "售票处", "出入口", "游客中心", "动物园", "游乐园", "体育", "网红", "观景台"]))
    .filter(spot => !curatedNames.some(name => String(spot.name || "").includes(name)))
    .map(scenicSpotToTourismSite);
  return [...curated.map(site => ({ ...site, estimateMode: "curated" })), ...scenic];
}

function routeNameKey(site) {
  return String(site.shortName || site.name || "")
    .replace(/中国|国家|旅游|风景|景区|公园|名胜区|森林/g, "")
    .slice(0, 8);
}

function hasSimilarRouteName(selected, site) {
  const key = routeNameKey(site);
  return selected.some(item => {
    const existing = routeNameKey(item);
    if (!key || !existing) return false;
    return key === existing
      || (key.length >= 3 && existing.includes(key))
      || (existing.length >= 3 && key.includes(existing));
  });
}

function distanceKm(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return Number.POSITIVE_INFINITY;
  const [lng1, lat1] = from.map(Number);
  const [lng2, lat2] = to.map(Number);
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function requestHub(options, assessed) {
  const requestedNames = (options.selectedSiteNames || []).map(normalizeScenicName);
  const requestedSite = requestedNames.map(requestedName => assessed.find(site =>
    [site.shortName, site.name]
      .filter(Boolean)
      .map(normalizeScenicName)
      .some(name => name === requestedName || name.includes(requestedName) || requestedName.includes(name))
  )).find(Boolean);
  if (requestedSite?.lngLat) return requestedSite.lngLat;
  if (Array.isArray(options.destinationLngLat) && options.destinationLngLat.length === 2) {
    return options.destinationLngLat;
  }
  const configuredHub = tourismOriginHubs[normalizeTourismOrigin(options.origin)];
  if (configuredHub && isGuizhouRegion(options.destinationRegion)) return configuredHub;
  const request = String(options.request || "");
  const named = assessed.find(site =>
    [site.shortName, site.name, site.city, site.district]
      .filter(Boolean)
      .some(name => request.includes(String(name).replace(/市|区|县|自治州/g, "")))
  );
  if (named?.lngLat) return named.lngLat;
  const valid = assessed.map(site => site.lngLat).filter(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  if (valid.length) {
    return [
      valid.reduce((sum, point) => sum + point[0], 0) / valid.length,
      valid.reduce((sum, point) => sum + point[1], 0) / valid.length
    ];
  }
  return [106.6302, 26.6477];
}

const routeModeProfiles = Object.freeze({
  "safety-first": {
    label: "安全优先",
    description: "降低风险与坡度，优先服务覆盖和路线连续性",
    weights: { safety: 42, service: 28, efficiency: 18, experience: 12 }
  },
  balanced: {
    label: "均衡体验",
    description: "在安全、体验、服务和通行效率之间取得平衡",
    weights: { safety: 28, service: 22, efficiency: 25, experience: 25 }
  },
  "experience-first": {
    label: "探索优先",
    description: "提高地貌与景观匹配，同时保留风险上限约束",
    weights: { safety: 18, service: 14, efficiency: 18, experience: 50 }
  }
});

function routeRankingScore(site, hubDistanceKm, options) {
  const distancePenalty = Math.min(34, Number(hubDistanceKm || 0) * 0.13);
  if (options.routeMode === "experience-first") {
    const terrainLift = site.tags?.some(tag => ["山地", "亲水", "洞穴", "田园", "地质研学"].includes(tag)) ? 8 : 0;
    return site.routeScore + site.aiFit * 0.24 + terrainLift - site.riskScore * 0.08 - distancePenalty;
  }
  if (options.routeMode === "balanced") {
    return site.routeScore + site.aiFit * 0.11 + site.serviceCoverage * 0.08 - site.riskScore * 0.12 - distancePenalty;
  }
  return site.routeScore
    + (100 - site.riskScore) * 0.28
    + site.serviceCoverage * 0.12
    - site.crowdScore * 0.08
    - site.slope * 0.16
    - distancePenalty;
}

function routeTravelDistance(route, hub) {
  if (!route.length) return 0;
  return route.reduce((sum, site, index) => {
    const from = index === 0 ? hub : route[index - 1].lngLat;
    const leg = distanceKm(from, site.lngLat);
    return sum + (Number.isFinite(leg) ? leg : 0);
  }, 0);
}

function routeMaxLegDistance(route, hub) {
  return route.reduce((max, site, index) => {
    const from = index === 0 ? hub : route[index - 1].lngLat;
    const leg = distanceKm(from, site.lngLat);
    return Math.max(max, Number.isFinite(leg) ? leg : 0);
  }, 0);
}

function improveRouteWithTwoOpt(route, hub, maxLegDistanceKm) {
  const initial = [...route];
  const initialDistance = routeTravelDistance(initial, hub);
  let best = initial;
  let bestDistance = initialDistance;
  let iterations = 0;
  let changed = true;

  while (changed && iterations < 40) {
    changed = false;
    iterations += 1;
    for (let left = 0; left < best.length - 2; left += 1) {
      for (let right = left + 2; right < best.length; right += 1) {
        const candidate = [
          ...best.slice(0, left),
          ...best.slice(left, right + 1).reverse(),
          ...best.slice(right + 1)
        ];
        if (routeMaxLegDistance(candidate, hub) > maxLegDistanceKm) continue;
        const candidateDistance = routeTravelDistance(candidate, hub);
        if (candidateDistance + 0.05 < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          changed = true;
        }
      }
    }
  }
  best.solverStats = {
    algorithm: "nearest-neighbor + 2-opt + constraint-repair",
    iterations,
    initialDistanceKm: Math.round(initialDistance * 10) / 10,
    optimizedDistanceKm: Math.round(bestDistance * 10) / 10,
    improvementPercent: initialDistance > 0
      ? Math.max(0, Math.round((initialDistance - bestDistance) / initialDistance * 1000) / 10)
      : 0
  };
  return best;
}

function selectTourismRoute(assessed, limit, options) {
  const hub = requestHub(options, assessed);
  const radiusByDays = { 1: 75, 2: 125, 3: 190, 4: 285 };
  const corridorRadius = radiusByDays[options.days] || 125;
  const ranked = [...assessed]
    .map(site => ({
      ...site,
      hubDistanceKm: Math.round(distanceKm(hub, site.lngLat)),
    }))
    .sort((a, b) => {
      const scoreA = routeRankingScore(a, a.hubDistanceKm, options);
      const scoreB = routeRankingScore(b, b.hubDistanceKm, options);
      return scoreB - scoreA;
    });
  const corridor = ranked.filter(site => site.hubDistanceKm <= corridorRadius);
  const candidatePool = corridor.length >= limit ? corridor : ranked;
  const curatedQuota = Math.min(
    candidatePool.filter(site => site.estimateMode === "curated").length,
    Math.max(1, Math.ceil(limit / 3))
  );
  const requestedNames = (options.selectedSiteNames || []).map(normalizeScenicName);
  const requestedSelected = requestedNames.map(requestedName =>
    ranked.find(site => {
      const candidates = [site.shortName, site.name].filter(Boolean).map(normalizeScenicName);
      return candidates.some(name => name === requestedName || name.includes(requestedName) || requestedName.includes(name));
    })
  ).filter((site, index, list) => site && list.findIndex(item => item?.id === site.id) === index);
  const selected = requestedSelected.slice(0, limit);
  const curated = candidatePool
    .filter(site => site.estimateMode === "curated")
    .filter(site => !selected.some(item => item.id === site.id))
    .slice(0, Math.max(0, curatedQuota - selected.length));
  selected.push(...curated);
  const nameKeys = new Set();
  const cityCounts = new Map();
  const cityLimit = Math.max(2, Math.ceil(limit / 4));
  selected.forEach(site => {
    const key = routeNameKey(site);
    if (key) nameKeys.add(key);
    cityCounts.set(site.city, (cityCounts.get(site.city) || 0) + 1);
  });

  for (const site of candidatePool) {
    if (selected.some(item => item.id === site.id)) continue;
    const key = routeNameKey(site);
    const cityCount = cityCounts.get(site.city) || 0;
    if ((key && nameKeys.has(key)) || hasSimilarRouteName(selected, site)) continue;
    if (selected.some(item => distanceKm(item.lngLat, site.lngLat) < 3.5)) continue;
    if (cityCount >= cityLimit) continue;
    selected.push(site);
    if (key) nameKeys.add(key);
    cityCounts.set(site.city, cityCount + 1);
    if (selected.length >= limit) break;
  }

  for (const site of candidatePool) {
    if (selected.length >= limit) break;
    if (selected.some(item => item.id === site.id)) continue;
    const key = routeNameKey(site);
    if ((key && nameKeys.has(key)) || hasSimilarRouteName(selected, site)) continue;
    if (selected.some(item => distanceKm(item.lngLat, site.lngLat) < 3.5)) continue;
    selected.push(site);
    if (key) nameKeys.add(key);
  }

  const remaining = [...selected];
  const ordered = [];
  let point = hub;
  while (remaining.length) {
    remaining.sort((a, b) => {
      const distanceA = distanceKm(point, a.lngLat);
      const distanceB = distanceKm(point, b.lngLat);
      return distanceA - distanceB;
    });
    const next = remaining.shift();
    ordered.push(next);
    if (Array.isArray(next.lngLat)) point = next.lngLat;
  }

  const lockedIds = new Set(requestedSelected.map(site => site.id));
  const maxLegDistanceKm = options.days === 1 ? 90 : options.days === 2 ? 130 : options.days <= 4 ? 165 : 210;
  for (let pass = 0; pass < 3; pass += 1) {
    let repaired = false;
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (distanceKm(previous.lngLat, current.lngLat) <= maxLegDistanceKm || lockedIds.has(current.id)) continue;
      const next = ordered[index + 1];
      const usedIds = new Set(ordered.map(site => site.id));
      const replacement = candidatePool
        .filter(site => !usedIds.has(site.id))
        .filter(site => !hasSimilarRouteName(ordered.filter((_, itemIndex) => itemIndex !== index), site))
        .filter(site => distanceKm(previous.lngLat, site.lngLat) <= maxLegDistanceKm)
        .filter(site => !next || distanceKm(site.lngLat, next.lngLat) <= maxLegDistanceKm)
        .sort((left, right) => {
          const leftTravel = distanceKm(previous.lngLat, left.lngLat) + (next ? distanceKm(left.lngLat, next.lngLat) : 0);
          const rightTravel = distanceKm(previous.lngLat, right.lngLat) + (next ? distanceKm(right.lngLat, next.lngLat) : 0);
          return leftTravel - rightTravel || right.routeScore - left.routeScore;
        })[0];
      if (replacement) {
        ordered[index] = replacement;
        repaired = true;
      }
    }
    if (!repaired) break;
  }
  return improveRouteWithTwoOpt(ordered, hub, maxLegDistanceKm);
}

function liveWeatherForSite(site, options) {
  const target = normalizeTourismCity(site.city);
  return Object.values(options.liveWeatherByCity || {}).find(item => normalizeTourismCity(item.city) === target) || null;
}

function forecastWeatherForSite(site, options, date = options.startDate) {
  const target = normalizeTourismCity(site.city);
  const forecast = Object.values(options.forecastWeatherByCity || {})
    .find(item => normalizeTourismCity(item.city) === target);
  const day = forecast?.days?.find(item => item.date === date);
  return day ? { ...day, city: forecast.city, shortName: forecast.shortName, reportTime: forecast.reportTime } : null;
}

function weatherCode(weatherText, temperature) {
  const text = String(weatherText || "");
  if (includesAny(text, ["雨", "雪", "冰雹"])) return "rain";
  if (includesAny(text, ["雾", "霾", "沙尘"])) return "fog";
  if (Number(temperature) >= 34) return "heat";
  return "clear";
}

function effectiveWeather(site, options) {
  if (options.startDate !== guizhouDate()) {
    if (options.weather !== "auto") return { code: options.weather, live: null };
    const forecast = forecastWeatherForSite(site, options);
    if (!forecast) return { code: "clear", live: null, pendingForecast: true };
    return {
      code: weatherCode(`${forecast.dayWeather}${forecast.nightWeather}`, forecast.dayTemp),
      live: null,
      forecast
    };
  }
  const live = liveWeatherForSite(site, options);
  if (!live) return { code: options.weather, live: null };
  return { code: weatherCode(live.weather, live.temperature), live };
}

function tourismWeatherRisk(site, options) {
  const weather = effectiveWeather(site, options).code;
  if (weather === "rain") {
    if (site.tags.includes("亲水") || site.tags.includes("瀑布") || site.tags.includes("雨天防滑")) return 13;
    if (site.tags.includes("古镇") || site.tags.includes("坡道")) return 8;
    return 5;
  }
  if (weather === "fog") {
    if (site.tags.includes("山地") || site.tags.includes("天气敏感")) return 15;
    if (site.tags.includes("换乘")) return 8;
    return 4;
  }
  if (weather === "heat") {
    if (site.tags.includes("高温") || site.tags.includes("骑行")) return 14;
    if (site.tags.includes("田园")) return 10;
    return 3;
  }
  return -3;
}

function tourismTravelerRisk(site, options) {
  if (options.travelerType === "family") return site.slope > 18 ? 8 : site.slope <= 10 ? -4 : 1;
  if (options.travelerType === "senior") return site.slope > 15 ? 13 : site.slope <= 10 ? -6 : 2;
  if (options.travelerType === "study") return site.congestionBase > 76 ? 8 : 2;
  return 0;
}

function tourismPreferenceBoost(site, options) {
  if (options.preference === "safe") return site.serviceCoverage * 0.16 - site.riskBase * 0.18;
  if (options.preference === "culture") return site.tags.includes("民族村寨") || site.tags.includes("古镇") || site.tags.includes("地质研学") ? 13 : -2;
  if (options.preference === "nature") return site.tags.includes("山地") || site.tags.includes("喀斯特") || site.tags.includes("瀑布") || site.tags.includes("田园") ? 13 : -2;
  if (options.preference === "lowload") return site.slope <= 10 ? 16 : site.slope > 18 ? -12 : 2;
  return 0;
}

function holidayMatch(site, holidayData) {
  const allHotspots = (holidayData.records || []).flatMap(record =>
    (record.hotspots || []).map(name => ({ name, record }))
  );
  return allHotspots.filter(item =>
    item.name.includes(site.shortName)
    || site.name.includes(item.name)
    || item.name.includes(site.name.replace("游客集散中心", "").replace("东门服务区", "").replace("片区", ""))
  );
}

function buildTourismEvidence(site, options, holidayMatches) {
  const evidence = [...site.evidence];
  const actions = [...site.actions];
  const weatherSignal = effectiveWeather(site, options);
  const weather = weatherSignal.code;

  if (weatherSignal.live) {
    evidence.push(`高德天气实况：${weatherSignal.live.city}${weatherSignal.live.weather}${weatherSignal.live.temperature}℃，发布于 ${weatherSignal.live.reportTime}`);
  }
  if (weatherSignal.forecast) {
    evidence.push(`高德逐日预报：${weatherSignal.forecast.city}${options.startDate}白天${weatherSignal.forecast.dayWeather}${weatherSignal.forecast.dayTemp}℃，预报发布于 ${weatherSignal.forecast.reportTime}`);
  }
  if (weatherSignal.pendingForecast) {
    evidence.push(`出发日期为 ${options.startDate}，当前不以今日实况冒充未来天气；出发前需刷新目的地预报。`);
    actions.push("出发前 24 小时刷新逐日天气并复算路线风险");
  }

  if (weather === "rain") {
    evidence.push("当前情境包含降雨/路滑约束，亲水、瀑布、石板路点位风险上调");
    actions.push("触发防滑提醒，优先绑定医务点、游客中心和观光车站");
  }
  if (weather === "fog") {
    evidence.push("山地大雾会影响索道、换乘和观景台可见度");
    actions.push("山地高海拔点位设置为条件通行或备选点");
  }
  if (weather === "heat") {
    evidence.push("高温情境下开阔田园和长距离骑行路线补给风险上调");
    actions.push("推荐清晨出发并配置补水/遮阳提醒");
  }
  if (options.travelerType === "senior" || options.travelerType === "family") {
    evidence.push("游客画像包含老人/儿童，需要控制坡度、距离和休息点密度");
    actions.push("每 90 分钟校验休息点和最近应急服务点");
  }
  if (options.travelerType === "study") {
    evidence.push("研学团队需要集合点、讲解服务和人群承载校验");
    actions.push("按 20 人一组生成集合点和队列管理建议");
  }
  if (holidayMatches.length) {
    evidence.push(`节假日公开样本命中 ${holidayMatches.map(item => item.record.holiday).join("、")}`);
    actions.push("节假日模式下自动避开 10:00-13:00 客流峰值");
  }

  return {
    evidence: [...new Set(evidence)].slice(0, 8),
    actions: [...new Set(actions)].slice(0, 8)
  };
}

function assessTourismSite(site, options, holidayData) {
  const holidayMatches = holidayMatch(site, holidayData);
  const holidayRisk = Math.min(10, holidayMatches.length * 4);
  const riskScore = clamp(
    site.riskBase
    + tourismWeatherRisk(site, options)
    + tourismTravelerRisk(site, options)
    + Math.round((options.intensity - 50) * 0.18)
    + holidayRisk
  );
  const crowdScore = clamp(
    site.congestionBase
    + holidayRisk * 2
    + (options.days > 2 ? 5 : 0)
    + (options.travelerType === "study" ? 6 : 0)
  );
  const serviceCoverage = clamp(site.serviceCoverage - Math.max(0, riskScore - 70) * 0.22 + (site.services.length - 3) * 2);
  const routeScore = clamp(
    site.aiFit * 0.52
    + serviceCoverage * 0.32
    - riskScore * 0.34
    - crowdScore * 0.13
    + tourismPreferenceBoost(site, options)
    + 48
  );
  const dynamic = buildTourismEvidence(site, options, holidayMatches);
  return {
    ...site,
    riskScore,
    crowdScore,
    serviceCoverage,
    routeScore,
    riskLevel: riskScore >= 75 ? "high" : riskScore >= 58 ? "medium" : "low",
    distance: `${site.distanceKm} km`,
    evidence: dynamic.evidence,
    actions: dynamic.actions,
    sources: [...new Set([
      ...site.sources,
      effectiveWeather(site, options).live ? "高德天气实况" : "",
      forecastWeatherForSite(site, options) ? "高德逐日预报" : "",
      holidayMatches.length ? "节假日公开报道样本" : "",
      `${options.destinationRegion || "贵州"}景区 POI`,
      "游客画像规则",
      "山地安全规则"
    ].filter(Boolean))]
  };
}

function routeDistanceSummary(route = []) {
  const legs = route.slice(1).map((site, index) => distanceKm(route[index].lngLat, site.lngLat));
  return {
    totalDistanceKm: Math.round(legs.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)),
    maxLegDistanceKm: Math.round(legs.reduce((max, value) => Math.max(max, Number.isFinite(value) ? value : 0), 0))
  };
}

function selectedDestinationCoverage(route, selectedSiteNames = []) {
  const requested = selectedSiteNames.map(normalizeScenicName);
  const matched = requested.filter(requestedName => route.some(site =>
    [site.shortName, site.name]
      .filter(Boolean)
      .map(normalizeScenicName)
      .some(name => name === requestedName || name.includes(requestedName) || requestedName.includes(name))
  )).length;
  return { requested: requested.length, matched };
}

function summarizeRouteMode(route, mode, options) {
  const profile = routeModeProfiles[mode];
  const average = field => route.length
    ? route.reduce((sum, site) => sum + Number(site[field] || 0), 0) / route.length
    : 0;
  const distance = routeDistanceSummary(route);
  const scores = {
    safety: clamp(100 - average("riskScore")),
    service: clamp(average("serviceCoverage")),
    efficiency: clamp(100 - distance.totalDistanceKm / Math.max(1, options.days) * 0.24),
    experience: clamp(average("aiFit"))
  };
  const objectiveScore = Math.round(Object.entries(profile.weights)
    .reduce((sum, [key, weight]) => sum + scores[key] * weight / 100, 0));
  return {
    mode,
    label: profile.label,
    description: profile.description,
    weights: profile.weights,
    objectiveScore,
    averageRisk: Math.round(average("riskScore")),
    serviceCoverage: Math.round(average("serviceCoverage")),
    highRiskCount: route.filter(site => Number(site.riskScore) >= 75).length,
    ...distance,
    preview: route.slice(0, 4).map(site => site.shortName || site.name)
  };
}

function buildOptimizationEvidence(assessed, selectedRoute, limit, options) {
  const modes = Object.keys(routeModeProfiles);
  const alternatives = modes.map(mode => {
    const route = mode === options.routeMode
      ? selectedRoute
      : selectTourismRoute(assessed, limit, { ...options, routeMode: mode });
    return {
      ...summarizeRouteMode(route, mode, options),
      selected: mode === options.routeMode,
      routeOrder: route.map(site => site.id)
    };
  });
  const current = alternatives.find(item => item.selected) || alternatives[0];
  const coverage = selectedDestinationCoverage(selectedRoute, options.selectedSiteNames || []);
  const maxAllowedLegDistanceKm = options.days === 1 ? 90 : options.days === 2 ? 130 : options.days <= 4 ? 165 : 210;
  const photoBacked = selectedRoute.filter(site => site.imagePath || site.sourcePoiId).length;
  const constraints = [
    {
      id: "destination-coverage",
      label: "指定目的地保留",
      value: coverage.requested ? `${coverage.matched}/${coverage.requested}` : "未指定，由智能体推荐",
      passed: coverage.matched === coverage.requested
    },
    {
      id: "route-continuity",
      label: "单段距离上限",
      value: `${current.maxLegDistanceKm} km / ${maxAllowedLegDistanceKm} km`,
      passed: current.maxLegDistanceKm <= maxAllowedLegDistanceKm
    },
    {
      id: "daily-load",
      label: "每日点位负荷",
      value: `${Math.ceil(selectedRoute.length / Math.max(1, options.days))} 站/天`,
      passed: Math.ceil(selectedRoute.length / Math.max(1, options.days)) <= 3
    },
    {
      id: "photo-evidence",
      label: "实景图证据覆盖",
      value: `${photoBacked}/${selectedRoute.length}`,
      passed: photoBacked === selectedRoute.length
    }
  ];
  return {
    selectedMode: options.routeMode,
    selectedLabel: routeModeProfiles[options.routeMode]?.label || "安全优先",
    objectiveScore: current.objectiveScore,
    objectiveScores: {
      safety: clamp(100 - current.averageRisk),
      service: current.serviceCoverage,
      efficiency: clamp(100 - current.totalDistanceKm / Math.max(1, options.days) * 0.24),
      experience: Math.round(selectedRoute.reduce((sum, site) => sum + Number(site.aiFit || 0), 0) / Math.max(1, selectedRoute.length))
    },
    formula: "总分 = 安全 × 权重 + 服务 × 权重 + 通行效率 × 权重 + 体验匹配 × 权重",
    candidateCount: assessed.length,
    constraints,
    constraintsPassed: constraints.filter(item => item.passed).length,
    constraintsTotal: constraints.length,
    alternatives,
    solver: selectedRoute.solverStats || {
      algorithm: "nearest-neighbor + constraint-repair",
      iterations: 0,
      initialDistanceKm: current.totalDistanceKm,
      optimizedDistanceKm: current.totalDistanceKm,
      improvementPercent: 0
    }
  };
}

function buildTourismRoute(siteDataset, holidayData, scenicDataset, options = {}) {
  const opts = normalizeTourismOptions(options);
  const candidates = buildTourismCandidates(siteDataset, scenicDataset);
  const assessed = candidates.map(site => assessTourismSite(site, opts, holidayData));
  const targetStopsPerDay = opts.travelerType === "senior" || opts.preference === "lowload" || opts.intensity <= 32
    ? 2
    : scenicDataset?.meta?.scope === "national-live" || opts.weather === "heat" || opts.days >= 4
      ? 2.5
      : 3;
  const limit = Math.min(assessed.length, Math.min(24, Math.max(2, Math.round(opts.days * targetStopsPerDay))));
  const selectedRoute = selectTourismRoute(assessed, limit, opts);
  const optimization = buildOptimizationEvidence(assessed, selectedRoute, limit, opts);
  const baseStopsPerDay = Math.floor(selectedRoute.length / opts.days);
  const daysWithExtraStop = selectedRoute.length % opts.days;
  let itineraryCursor = 0;
  const itinerary = Array.from({ length: opts.days }, (_, dayIndex) => {
    const stopCount = baseStopsPerDay + (dayIndex < daysWithExtraStop ? 1 : 0);
    const daySites = selectedRoute.slice(itineraryCursor, itineraryCursor + stopCount);
    itineraryCursor += stopCount;
    return {
      day: dayIndex + 1,
      date: addCalendarDays(opts.startDate, dayIndex),
      theme: dayIndex === 0 ? "轻量抵达与安全校准" : dayIndex === opts.days - 1 ? "核心景区与返程缓冲" : "跨区域串联与服务复核",
      sites: daySites.map(site => site.id)
    };
  });
  const travelDateBySiteId = new Map(
    itinerary.flatMap(day => day.sites.map(siteId => [siteId, day.date]))
  );
  const candidateById = new Map(candidates.map(site => [site.id, site]));
  const route = selectedRoute.map(site => {
    const travelDate = travelDateBySiteId.get(site.id) || opts.startDate;
    return {
      ...assessTourismSite(candidateById.get(site.id) || site, { ...opts, startDate: travelDate }, holidayData),
      hubDistanceKm: site.hubDistanceKm,
      travelDate
    };
  });
  const highestRisk = [...route].sort((a, b) => b.riskScore - a.riskScore)[0] || null;
  const averageRisk = route.length ? Math.round(route.reduce((sum, site) => sum + site.riskScore, 0) / route.length) : 0;
  const serviceCoverage = route.length ? Math.round(route.reduce((sum, site) => sum + site.serviceCoverage, 0) / route.length) : 0;
  const cities = [...new Set(route.map(site => site.city))];
  const suggestedActions = [...new Set(route.flatMap(site => site.actions.slice(0, 2)))].slice(0, 6);

  return {
    mode: process.env.ASCEND_INFERENCE_URL ? "remote-ascend-ready" : "local-rule-engine",
    engine: {
      name: "Shanhe Complex Terrain Tourism Risk Engine",
      version: "2026.08-national-route-risk-v1",
      backend: process.env.ASCEND_INFERENCE_URL ? "MindIE/vLLM Ascend proxy" : "Node.js local rule model",
      replaceableWithAscend: true
    },
    request: opts,
    liveData: {
      weatherStatus: opts.liveWeatherStatus,
      weatherProvider: opts.liveWeatherStatus === "live" ? "高德天气查询" : "未接入",
      weatherCities: Object.keys(opts.liveWeatherByCity || {}).length,
      forecastCities: Object.keys(opts.forecastWeatherByCity || {}).length,
      crowdDataType: "model-estimate",
      crowdNotice: "当前拥堵压力由节假日样本和时段规则估算，不代表景区实时人数。"
    },
    origin: {
      name: opts.origin,
      lngLat: requestHub(opts, assessed)
    },
    destinationRegion: opts.destinationRegion,
    dataScope: scenicDataset?.meta?.scope === "national-live" ? "regional-live-search" : "guizhou-local-sample",
    routeTitle: route.length ? `${opts.origin}出发 · ${route[0].shortName}至${route.at(-1).shortName} · ${opts.days}天安全线` : "暂无路线",
    summary: route.length
      ? `系统识别到 ${opts.startDate} 从${opts.origin}前往${opts.destinationRegion}、${tourismLabels.travelerType[opts.travelerType]}、${tourismLabels.weather[opts.weather]}、${tourismLabels.preference[opts.preference]}约束，生成覆盖${cities.join("、")}的 ${route.length} 个点位路线，平均风险 ${averageRisk}，应急覆盖 ${serviceCoverage}%。`
      : "暂无可用点位路线。",
    metrics: {
      siteCount: route.length,
      candidatePool: scenicDataset?.meta?.total || scenicDataset?.spots?.length || assessed.length,
      curatedSiteCount: (siteDataset.sites || []).length,
      averageRisk,
      serviceCoverage,
      highestRiskSite: highestRisk ? { id: highestRisk.id, name: highestRisk.name, riskScore: highestRisk.riskScore, reason: highestRisk.primaryRisk } : null,
      highRiskCount: route.filter(site => site.riskScore >= 75).length,
      cityCount: cities.length,
      objectiveScore: optimization.objectiveScore,
      constraintsPassed: optimization.constraintsPassed,
      constraintsTotal: optimization.constraintsTotal,
      maxLegDistanceKm: optimization.alternatives.find(item => item.selected)?.maxLegDistanceKm || 0
    },
    optimization,
    routeOrder: route.map(site => site.id),
    sites: route,
    allSites: [
      ...route,
      ...assessed.filter(site => site.estimateMode === "curated"),
      ...[...assessed].sort((a, b) => b.routeScore - a.routeScore).slice(0, 80)
    ].filter((site, index, list) => list.findIndex(item => item.id === site.id) === index),
    itinerary,
    actions: suggestedActions,
    fallback: assessed
      .filter(site => !route.some(item => item.id === site.id))
      .sort((a, b) => a.riskScore - b.riskScore)
      .slice(0, 2)
      .map(site => ({ id: site.id, name: site.name, riskScore: site.riskScore, useWhen: "主线路天气或拥堵异常时替换" }))
  };
}

function explainTourismRisk(routePlan, siteId) {
  const site = (routePlan.allSites || []).find(item => item.id === siteId) || routePlan.sites?.[0];
  if (!site) return null;
  const riskOptions = { ...routePlan.request, startDate: site.travelDate || routePlan.request.startDate };
  const weatherSignal = effectiveWeather(site, riskOptions);
  const weatherExplanation = weatherSignal.live
    ? `${weatherSignal.live.weather} · 高德实况`
    : weatherSignal.forecast
      ? `${weatherSignal.forecast.dayWeather} · ${site.travelDate}高德预报`
      : weatherSignal.pendingForecast
        ? `${site.travelDate || routePlan.request.startDate}暂无逐日预报`
        : tourismLabels.weather[routePlan.request.weather];
  return {
    siteId: site.id,
    siteName: site.name,
    city: site.city,
    riskScore: site.riskScore,
    riskLevel: site.riskLevel,
    primaryRisk: site.primaryRisk,
    evidence: site.evidence,
    suggestedActions: site.actions,
    emergencyServices: site.services,
    dataSources: site.sources,
    factors: [
      { name: "基础山地风险", value: site.riskBase, explanation: "坡度、道路形态、游览强度的基础风险" },
      { name: "天气修正", value: tourismWeatherRisk(site, riskOptions), explanation: weatherExplanation },
      { name: "人群修正", value: tourismTravelerRisk(site, routePlan.request), explanation: tourismLabels.travelerType[routePlan.request.travelerType] },
      { name: "拥堵压力", value: site.crowdScore, explanation: "由节假日样本、点位承载和团队规模规则综合估计" },
      { name: "服务覆盖", value: site.serviceCoverage, explanation: "游客中心、医务点、换乘站和执勤点覆盖程度" }
    ]
  };
}

function emergencyCoverage(routePlan) {
  const sites = routePlan.sites || [];
  const serviceTypes = [...new Set(sites.flatMap(site => site.services))];
  const gaps = sites
    .filter(site => site.serviceCoverage < 80 || site.riskScore >= 75)
    .map(site => ({
      siteId: site.id,
      siteName: site.name,
      riskScore: site.riskScore,
      serviceCoverage: site.serviceCoverage,
      requiredAction: site.riskScore >= 75 ? "设置条件通行并绑定最近医务/换乘点" : "补充休息点或服务点提示"
    }));
  return {
    averageCoverage: routePlan.metrics.serviceCoverage,
    serviceTypes,
    servicePointCount: serviceTypes.length,
    gaps,
    commandSuggestions: [
      "最高风险点自动绑定游客中心、医务点和换乘站",
      "雨天/大雾触发路线降级和备选点替换",
      "亲子与老人线路强制插入休息点校验"
    ]
  };
}

function dataLineage(routePlan, scenicDataset, holidayData) {
  const region = routePlan.destinationRegion || routePlan.request?.destinationRegion || "贵州";
  const localSample = scenicDataset.meta?.scope !== "national-live";
  return {
    pipeline: [
      { step: "游客自然语言需求", input: ["request", "origin", "travelerType", "weather", "days", "preference", "intensity"], output: "结构化出行约束" },
      { step: `${region}景区候选池`, input: ["高德 Place Search 风景名胜 POI"], output: `${scenicDataset.meta?.total || scenicDataset.spots?.length || 0} 个景区/风景点位` },
      { step: "节假日公开样本", input: (holidayData.records || []).map(record => record.holiday), output: "热门景区拥堵与承载风险校准" },
      { step: "山地安全规则模型", input: ["坡度", "距离", "客流", "天气", "服务覆盖"], output: "风险分、路线分、应急建议" },
      { step: "昇腾推理适配层", input: ["结构化约束", "候选点位", "风险证据"], output: process.env.ASCEND_INFERENCE_URL ? "远程推理服务输出" : "本地规则模型输出，可替换为 MindIE/vLLM Ascend" }
    ],
    datasets: [
      { name: localSample ? "贵州景区本地样板库" : `${region}景区实时候选池`, provider: scenicDataset.meta?.provider || "AMap Place Search", records: scenicDataset.meta?.total || scenicDataset.spots?.length || 0, freshness: scenicDataset.meta?.generatedAt || "" },
      { name: localSample ? "贵州节假日文旅热度公开样本" : `${region}节假日数据待授权`, provider: localSample ? "文化和旅游部公开报道样本" : "尚未接入", records: (holidayData.records || []).length, freshness: holidayData.meta?.updatedAt || "" },
      { name: "山河守护复杂地形安全规则库", provider: "项目本地规则库", records: routePlan.allSites?.length || 0, freshness: "2026-08-26" }
    ],
    routeOrder: routePlan.routeOrder,
    auditNote: "当前演示环境不声称接入实时票务/实时客流；风险分为可解释规则模型输出，可在部署时替换为昇腾推理服务。"
  };
}

function parseAscendContent(payload) {
  const content = payload?.choices?.[0]?.message?.content
    ?? payload?.choices?.[0]?.text
    ?? payload?.output?.text
    ?? payload?.generated_text
    ?? payload?.output;
  if (content && typeof content === "object") return content;
  const text = cleanText(content, 8000);
  if (!text) return {};
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  try {
    return JSON.parse(fenced);
  } catch {
    return { summary: text };
  }
}

async function callAscendInference(routePlan) {
  if (!process.env.ASCEND_INFERENCE_URL) {
    return { status: "not-configured", applied: false };
  }
  const startedAt = Date.now();
  ascendRuntime.lastAttemptAt = new Date().toISOString();
  try {
    const response = await fetch(process.env.ASCEND_INFERENCE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.ASCEND_API_KEY ? { authorization: `Bearer ${process.env.ASCEND_API_KEY}` } : {})
      },
      body: JSON.stringify({
        model: process.env.ASCEND_MODEL || "qianxing-guardian",
        temperature: 0.2,
        stream: false,
        messages: [
          {
            role: "system",
            content: "你是全国复杂地形旅游安全决策模型。基于结构化证据生成简洁的中文决策摘要和最多6条可执行安全动作。贵州是首个本地样板区域，其他地区以实时检索数据为准。不得编造实时客流、票务、道路或天气数据。只输出JSON，字段为summary和actions。"
          },
          {
            role: "user",
            content: JSON.stringify({
              request: routePlan.request,
              metrics: routePlan.metrics,
              roadData: {
                status: routePlan.roadData?.status,
                totals: routePlan.roadData?.totals
              },
              sites: routePlan.sites.map(site => ({
                id: site.id,
                name: site.name,
                city: site.city,
                riskScore: site.riskScore,
                riskLevel: site.riskLevel,
                primaryRisk: site.primaryRisk,
                evidence: site.evidence.slice(0, 4),
                serviceCoverage: site.serviceCoverage
              }))
            })
          }
        ]
      }),
      signal: AbortSignal.timeout(Math.max(3000, Number(process.env.ASCEND_TIMEOUT_MS || 20000)))
    });
    if (!response.ok) throw new Error(`ascend_http_${response.status}`);
    const payload = await response.json();
    const output = parseAscendContent(payload);
    const summary = cleanText(output.summary, 1200);
    const actions = Array.isArray(output.actions)
      ? output.actions.map(item => cleanText(item, 240)).filter(Boolean).slice(0, 6)
      : [];
    if (!summary && !actions.length) throw new Error("ascend_output_empty");
    const latencyMs = Date.now() - startedAt;
    Object.assign(ascendRuntime, {
      lastStatus: "success",
      lastSuccessAt: new Date().toISOString(),
      lastLatencyMs: latencyMs,
      lastError: ""
    });
    return {
      status: "remote-success",
      applied: true,
      provider: "MindIE/vLLM Ascend",
      model: process.env.ASCEND_MODEL || "qianxing-guardian",
      latencyMs,
      summary,
      actions
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    Object.assign(ascendRuntime, {
      lastStatus: "failed",
      lastLatencyMs: latencyMs,
      lastError: cleanText(error.message, 200)
    });
    return {
      status: "fallback-local",
      applied: false,
      provider: "本地规则模型",
      latencyMs,
      error: cleanText(error.message, 200)
    };
  }
}

async function applyAscendInference(routePlan) {
  const inference = await callAscendInference(routePlan);
  routePlan.inference = inference;
  if (inference.applied) {
    routePlan.mode = "remote-ascend-inference";
    routePlan.engine.backend = "MindIE/vLLM Ascend";
    if (inference.summary) routePlan.summary = inference.summary;
    if (inference.actions.length) routePlan.actions = inference.actions;
  } else if (process.env.ASCEND_INFERENCE_URL) {
    routePlan.mode = "local-rule-fallback";
  }
  return routePlan;
}

function ascendReadiness() {
  const configured = Boolean(process.env.ASCEND_INFERENCE_URL);
  const remote = configured && ascendRuntime.lastStatus === "success";
  return {
    status: remote ? "remote-ascend-inference" : configured ? "ascend-configured-not-verified" : "local-simulation",
    endpointConfigured: configured,
    endpointMasked: configured ? process.env.ASCEND_INFERENCE_URL.replace(/\/\/([^/@]+@)?([^/:]+).*/, "//***") : "",
    lastSuccessAt: ascendRuntime.lastSuccessAt,
    lastAttemptAt: ascendRuntime.lastAttemptAt,
    lastLatencyMs: ascendRuntime.lastLatencyMs,
    lastError: ascendRuntime.lastError,
    chain: [
      "游客需求",
      "后端代理",
      "MindIE/vLLM Ascend",
      "山地旅游风险模型",
      "路线与安全建议"
    ],
    adapterContract: {
      input: ["request", "origin", "sites", "weather", "travelerType", "preference", "intensity"],
      output: ["routeOrder", "riskScore", "evidence", "actions", "summary"]
    },
    demoMessage: remote
      ? "远程昇腾推理已完成真实调用并返回有效结果。"
      : configured
        ? "昇腾服务地址已配置，但尚未成功验证；当前结果由本地规则模型兜底。"
        : "当前为本地规则模型，已实现 ASCEND_INFERENCE_URL 远程调用适配器。"
  };
}

function tourismProjectStatus(routePlan, scenicDataset, holidayData) {
  return {
    name: "山河守护",
    positioning: "面向全国复杂地形旅游的 AI 伴游、安全预警与协同处置平台，贵州为首个样板区域",
    mode: routePlan.mode,
    apis: [
      { method: "GET", path: "/api/health", purpose: "服务健康检查" },
      { method: "POST", path: "/api/tourism/route-plan", purpose: "自然语言需求转路线、风险分和安全建议" },
      { method: "POST", path: "/api/tourism/risk-explanation", purpose: "单点可解释风险证据" },
      { method: "POST", path: "/api/tourism/emergency-coverage", purpose: "路线应急服务覆盖和缺口" },
      { method: "GET/POST", path: "/api/tourism/incidents", purpose: "安全事件、责任资源与处置审计持久化" },
      { method: "GET", path: "/api/tourism/live-weather", purpose: "全国城市天气实况与每日预报" },
      { method: "GET", path: "/api/tourism/emergency-nearby", purpose: "景点周边医院、派出所与游客中心实时检索" },
      { method: "GET", path: "/api/tourism/crowd-flow", purpose: "授权客流接入或透明标注的客流指数估算" },
      { method: "GET", path: "/api/tourism/static-map", purpose: "高德真实地理底图与实时交通图层" },
      { method: "GET", path: "/api/tourism/data-lineage", purpose: "数据来源、处理链路和审计说明" },
      { method: "GET", path: "/api/tourism/ascend-readiness", purpose: "昇腾推理适配状态" }
    ],
    dataReadiness: {
      scenicPoiCount: scenicDataset.meta?.total || scenicDataset.spots?.length || 0,
      holidaySampleCount: (holidayData.records || []).length,
      businessSiteCount: routePlan.allSites?.length || 0
    },
    missingForProduction: [
      process.env.AMAP_WEB_SERVICE_KEY ? "景区级精细天气预警授权" : "高德天气 Web 服务 Key",
      "景区实时票务/客流授权",
      "景区应急服务点正式名录",
      "昇腾推理服务线上部署"
    ]
  };
}

function integrationStatus() {
  return {
    version: appVersion,
    mode: "local-simulation",
    runtime: "Node.js local API",
    services: [
      { id: "health", name: "健康检查", endpoint: "/api/health", status: "connected" },
      { id: "sources", name: "公共数据目录", endpoint: "/api/sources", status: "connected" },
      { id: "locations", name: "候选片区样本", endpoint: "/api/locations", status: "connected" },
      { id: "recommend", name: "智能推荐评分", endpoint: "/api/recommend", status: "connected" },
      { id: "data-request", name: "数据申请清单", endpoint: "/api/data-request", status: "connected" },
      { id: "report", name: "选址报告生成", endpoint: "/api/report", status: "connected" },
      { id: "landing-plan", name: "落地实施方案", endpoint: "/api/landing-plan", status: "connected" },
      { id: "guide-summary", name: "兼容摘要接口", endpoint: "/api/guide-summary", status: "connected" },
      { id: "corpus-statistics", name: "公开数据市场统计", endpoint: "/api/public-data/statistics", status: "connected" },
      { id: "corpus-catalog", name: "公开数据集目录", endpoint: "/api/public-data/catalog", status: "connected" },
      { id: "corpus-relevant", name: "项目相关数据集", endpoint: "/api/public-data/relevant", status: "connected" },
      { id: "scenic-spots", name: "全国景区动态候选池", endpoint: "/api/scenic-spots", status: "connected" },
      { id: "holiday-tourism", name: "节假日文旅热度样本", endpoint: "/api/holiday-tourism", status: "connected" },
      { id: "tourism-route-plan", name: "山地旅游路线生成", endpoint: "/api/tourism/route-plan", status: "connected" },
      { id: "tourism-risk-explanation", name: "单点风险解释", endpoint: "/api/tourism/risk-explanation", status: "connected" },
      { id: "tourism-emergency-coverage", name: "应急服务覆盖评估", endpoint: "/api/tourism/emergency-coverage", status: "connected" },
      { id: "tourism-incidents", name: "安全事件持久化", endpoint: "/api/tourism/incidents", status: "connected" },
      { id: "tourism-live-weather", name: "全国城市天气实况与预报", endpoint: "/api/tourism/live-weather", status: process.env.AMAP_WEB_SERVICE_KEY ? "live" : "not-configured" },
      { id: "tourism-emergency-nearby", name: "真实应急资源周边检索", endpoint: "/api/tourism/emergency-nearby", status: process.env.AMAP_WEB_SERVICE_KEY ? "live" : "not-configured" },
      { id: "tourism-crowd-flow", name: "景区客流数据", endpoint: "/api/tourism/crowd-flow", status: process.env.CROWD_FLOW_API_URL ? "live" : "estimate-only" },
      { id: "tourism-static-map", name: "高德真实地理底图", endpoint: "/api/tourism/static-map", status: process.env.AMAP_WEB_SERVICE_KEY ? "live" : "not-configured" },
      { id: "tourism-data-lineage", name: "数据血缘与审计链路", endpoint: "/api/tourism/data-lineage", status: "connected" },
      { id: "ascend-readiness", name: "昇腾推理适配状态", endpoint: "/api/tourism/ascend-readiness", status: process.env.ASCEND_INFERENCE_URL ? "remote-ready" : "adapter-ready" }
    ],
    deployment: {
      frontend: "Vue 3 + 高德地图 JSAPI",
      backend: "Node.js HTTP API",
      dataLayer: "全国高德景区动态检索 + 全国城市天气 + 贵州本地样板库 + 复杂地形安全规则库",
      aiLayer: process.env.ASCEND_INFERENCE_URL ? "MindIE/vLLM Ascend proxy" : "本地规则风险模型，已预留昇腾推理适配契约"
    }
  };
}

function landingPlan(result, options = {}) {
  const top = result.top;
  return {
    title: "黔址优选落地实施方案",
    targetArea: top?.name || "候选文旅片区",
    businessType: options.businessType || "景区餐饮",
    partners: ["省级公共数据主管部门", "文旅局/景区管委会", "创业团队", "金融与园区服务机构"],
    phases: [
      { name: "数据接入", duration: "1-2 周", outputs: ["公共数据目录授权", "候选片区基础库", "评分指标口径确认"] },
      { name: "模型试运行", duration: "2-4 周", outputs: ["片区评分榜单", "风险证据明细", "数据申请与复核清单"] },
      { name: "示范点落地", duration: "1-2 月", outputs: ["首选片区试点", "业态招商建议", "运营监测看板"] },
      { name: "规模化复制", duration: "3-6 月", outputs: ["多景区推广", "文旅创业项目库", "金融资金对接材料"] }
    ],
    kpis: [
      { name: "选址评估周期", value: "从 7 天压缩到 30 分钟" },
      { name: "风险复核覆盖", value: "工商、信用、客流、交通 4 类核心证据" },
      { name: "服务对象", value: "景区、文旅局、创业团队、园区" },
      { name: "社会价值", value: "降低盲目开店风险，提升公共数据创业转化" }
    ],
    nextActions: top
      ? [
          `以 ${top.name} 作为首个试点片区`,
          `申请 ${top.dataNeed?.slice(0, 3).join("、") || "客流、工商、信用"} 数据授权`,
          "联动景区服务中心验证客流与交通压力",
          "形成可提交给主管部门和金融机构的项目包"
        ]
      : ["选择首个试点片区", "补充公共数据授权", "形成项目落地包"]
  };
}

function guideSummary(result, options = {}) {
  const top = result.top;
  return {
    mode: "local-simulation",
    businessType: options.businessType || "景区餐饮",
    region: options.region || "全省文旅片区",
    top: top ? { id: top.id, name: top.name, score: top.score, city: top.city, riskLabel: top.riskLabel } : null,
    summary: result.summary,
    decisionPath: ["创业需求", "公共数据目录", "评分模型", "风险证据", "落地方案"],
    landingReady: Boolean(top)
  };
}

async function serveStatic(req, res, pathname) {
  const file = pathname === "/" ? "demo.html" : pathname.slice(1);
  if (file !== "demo.html") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
    return;
  }
  const safePath = normalize(join(root, file));
  if (!safePath.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  try {
    const body = await readFile(safePath);
    res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  }
}

export async function handleRequest(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  try {
    if (pathname === "/api/health") {
      return json(res, 200, {
        ok: true,
        service: "qianzhi-public-data",
        version: appVersion,
        mode: "local-simulation",
        time: new Date().toISOString()
      });
    }
    if (pathname === "/api/sources") return json(res, 200, { sources: dataSources });
    if (pathname === "/api/locations") return json(res, 200, { locations: await loadLocations() });
    if (pathname === "/api/integration-status") return json(res, 200, integrationStatus());
    if (pathname === "/api/scenic-spots/summary") {
      const dataset = await loadScenicSpots();
      return json(res, 200, scenicSummary(dataset));
    }
    if (pathname === "/api/scenic-spots") {
      const params = Object.fromEntries(url.searchParams);
      const requestedRegion = params.region || params.city || "";
      const useRegionalLive = params.scope === "national" || (requestedRegion && !isGuizhouRegion(requestedRegion));
      const dataset = useRegionalLive
        ? await loadRegionalScenicSpots(requestedRegion || "全国", params.keyword ? [params.keyword] : [])
        : await loadScenicSpots();
      return json(res, 200, {
        provider: dataset.meta?.provider || "AMap Place Search",
        sourceUrl: dataset.meta?.sourceUrl || "https://restapi.amap.com/v3/place/text",
        generatedAt: dataset.meta?.generatedAt || "",
        note: dataset.meta?.note || "",
        summary: scenicSummary(dataset),
        ...filterScenicSpots(dataset, { ...params, city: useRegionalLive ? "" : params.city })
      });
    }
    if (pathname === "/api/scenic-photo") {
      const spotId = url.searchParams.get("id") || "";
      if (!spotId) return json(res, 400, { error: "scenic_photo_id_required" });
      const dataset = await loadScenicSpots();
      const photo = await fetchScenicPhoto(dataset, spotId);
      res.writeHead(200, {
        "content-type": photo.contentType,
        "content-length": photo.body.length,
        "cache-control": "public, max-age=86400",
        "access-control-allow-origin": "*",
        "x-image-provider": "amap-scenic-poi",
        "x-image-match": photo.matchType
      });
      res.end(photo.body);
      return;
    }
    if (pathname === "/api/tourism/live-weather") {
      const requested = (url.searchParams.get("adcodes") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      const requestedCities = (url.searchParams.get("cities") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      const resolvedCities = (await Promise.all(requestedCities.map(city => resolveAmapGeocode(city).catch(() => null))))
        .filter(Boolean);
      const adcodes = [...new Set([
        ...requested,
        ...resolvedCities.map(item => item.adcode).filter(Boolean)
      ])];
      const liveAdcodes = adcodes.length ? adcodes : amapCityAdcodes.map(item => item.adcode);
      const requestedForecasts = (url.searchParams.get("forecast") || adcodes[0] || "520100")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      const requestedForecastCities = (url.searchParams.get("forecastCities") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      const resolvedForecasts = (await Promise.all(requestedForecastCities.map(city => resolveAmapGeocode(city).catch(() => null))))
        .filter(Boolean)
        .map(item => item.adcode)
        .filter(Boolean);
      return json(res, 200, await liveWeatherBundle(liveAdcodes, [...new Set([...requestedForecasts, ...resolvedForecasts])]));
    }
    if (pathname === "/api/tourism/emergency-nearby") {
      const lng = Number(url.searchParams.get("lng"));
      const lat = Number(url.searchParams.get("lat"));
      if (![lng, lat].every(Number.isFinite)) return json(res, 400, { error: "valid_lng_lat_required" });
      const services = await searchNearbyEmergencyServices([lng, lat], Number(url.searchParams.get("radius") || 15000));
      return json(res, 200, {
        provider: "高德 POI 2.0 周边搜索",
        dataType: services.length ? "realtime-search" : "unavailable",
        refreshedAt: new Date().toISOString(),
        services
      });
    }
    if (pathname === "/api/tourism/crowd-flow") {
      const localDataset = await loadScenicSpots();
      const dataset = {
        ...localDataset,
        spots: [
          ...(localDataset.spots || []),
          ...regionalScenicSpotCache.values()
        ].filter((spot, index, list) => list.findIndex(item => item.id === spot.id) === index)
      };
      const names = (url.searchParams.get("names") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      return json(res, 200, await crowdFlowBundle(dataset, names));
    }
    if (pathname === "/api/tourism/static-map") {
      const mapImage = await fetchAmapStaticMap(Object.fromEntries(url.searchParams));
      res.writeHead(200, {
        "content-type": mapImage.contentType,
        "cache-control": "public, max-age=600",
        "access-control-allow-origin": "*",
        "x-map-provider": "amap-static-map"
      });
      res.end(mapImage.body);
      return;
    }
    if (pathname === "/api/holiday-tourism") {
      const holiday = await loadHolidayTourism();
      return json(res, 200, holiday);
    }
    if (pathname === "/api/tourism/incidents") {
      if (req.method === "POST") {
        const incident = await saveIncident(await readJson(req));
        return json(res, 200, { saved: true, incident });
      }
      const store = await loadIncidentStore();
      const requestedIds = (url.searchParams.get("siteIds") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      const incidents = Object.values(store.incidents || {})
        .filter(incident => !requestedIds.length || requestedIds.includes(incident.siteId));
      return json(res, 200, { incidents, updatedAt: store.updatedAt || null });
    }
    if (pathname === "/api/public-data/statistics") {
      return json(res, 200, {
        provider: "贵州省语料（数据集）中心",
        sourceUrl: `${corpusMarketBase}/corpus-market`,
        statistics: await corpusStatistics()
      });
    }
    if (pathname === "/api/public-data/catalog") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      return json(res, 200, {
        provider: "贵州省语料（数据集）中心",
        sourceUrl: `${corpusMarketBase}/corpus-market`,
        catalog: await corpusCatalog(options)
      });
    }
    if (pathname === "/api/public-data/relevant") {
      return json(res, 200, {
        provider: "贵州省语料（数据集）中心",
        sourceUrl: `${corpusMarketBase}/corpus-market`,
        relevance: await relevantCorpusResources()
      });
    }
    if (pathname === "/api/tourism/route-plan" || pathname === "/api/route-plan") {
      const agentStartedAt = Date.now();
      let agentStepStartedAt = agentStartedAt;
      const agentSteps = [];
      const pushAgentStep = (id, label, tool, status = "success", detail = "") => {
        const now = Date.now();
        agentSteps.push({ id, label, tool, status, durationMs: Math.max(0, now - agentStepStartedAt), detail });
        agentStepStartedAt = now;
      };
      const requestOptions = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      pushAgentStep("intent", "解析游客需求", "Intent Parser", "success", "识别人群、区域、天数、偏好与天气约束");
      const scope = await loadTourismScope(requestOptions);
      pushAgentStep(
        "retrieval",
        "召回区域景区候选",
        scope.scenicDataset.meta?.scope === "national-live" ? "AMap Place Search" : "贵州本地样板库",
        "success",
        `${scope.scenicDataset.meta?.total || scope.scenicDataset.spots?.length || 0} 个原始候选点位`
      );
      const { siteDataset, holidayData, scenicDataset } = scope;
      const baseOptions = {
        ...requestOptions,
        destinationRegion: scope.destinationRegion,
        destinationLngLat: scope.destinationLngLat,
        liveWeatherByCity: {},
        forecastWeatherByCity: {},
        liveWeatherStatus: "unavailable"
      };
      let routeDraft = buildTourismRoute(siteDataset, holidayData, scenicDataset, baseOptions);
      pushAgentStep("ranking", "多目标初筛", "Route Optimizer", "success", `${routeDraft.optimization?.candidateCount || 0} 个候选完成评分`);
      const routeAdcodes = [...new Set(routeDraft.sites.map(site => site.adcode).filter(Boolean))].slice(0, 10);
      let weatherBundle = { status: "unavailable", live: [], forecasts: [] };
      try {
        weatherBundle = await liveWeatherBundle(routeAdcodes, []);
      } catch (error) {
        weatherBundle = { status: "unavailable", live: [], forecasts: [], errors: [error.message] };
      }
      pushAgentStep(
        "weather",
        "调用目的地天气",
        "AMap Weather",
        weatherBundle.status === "live" ? "success" : "degraded",
        weatherBundle.status === "live" ? `${weatherBundle.live.length} 个城市实况` : "天气不可用，保留显式降级"
      );
      const liveWeatherByCity = Object.fromEntries((weatherBundle.live || []).map(item => [item.city, item]));
      let options = {
        ...baseOptions,
        liveWeatherByCity,
        liveWeatherStatus: weatherBundle.status
      };
      routeDraft = buildTourismRoute(siteDataset, holidayData, scenicDataset, options);
      if (routeDraft.request.weather === "auto" && routeDraft.request.startDate !== guizhouDate()) {
        const routeForecastAdcodes = [...new Set(routeDraft.sites
          .map(site => site.adcode)
          .filter(Boolean))];
        try {
          const forecastBundle = await liveWeatherBundle([], routeForecastAdcodes);
          weatherBundle.forecasts = forecastBundle.forecasts || [];
          weatherBundle.errors = [...(weatherBundle.errors || []), ...(forecastBundle.errors || [])];
          const forecastWeatherByCity = Object.fromEntries(
            weatherBundle.forecasts.map(item => [item.city, item])
          );
          options = { ...options, forecastWeatherByCity };
          routeDraft = buildTourismRoute(siteDataset, holidayData, scenicDataset, options);
        } catch (error) {
          weatherBundle.errors = [...(weatherBundle.errors || []), error.message];
        }
      }
      pushAgentStep(
        "constraints",
        "约束校验与路线重排",
        "Constraint Solver",
        routeDraft.optimization?.constraintsPassed === routeDraft.optimization?.constraintsTotal ? "success" : "attention",
        `${routeDraft.optimization?.constraintsPassed || 0}/${routeDraft.optimization?.constraintsTotal || 0} 项约束通过`
      );
      const roadRequested = requestOptions.includeRoadRoute === true || requestOptions.includeRoadRoute === "true";
      routeDraft.roadData = requestOptions.includeRoadRoute === true || requestOptions.includeRoadRoute === "true"
        ? await buildRoadRoute(routeDraft.sites)
        : {
            status: "not-requested",
            provider: "点位关系估算",
            notice: "客户端未请求道路规划，当前仅返回路线点位。",
            legs: [],
            totals: { distanceKm: 0, durationMinutes: 0 }
          };
      pushAgentStep(
        "road",
        "校准道路距离与时间",
        "AMap Driving",
        roadRequested ? routeDraft.roadData.status === "live" ? "success" : "degraded" : "skipped",
        roadRequested ? `${routeDraft.roadData.totals?.distanceKm || 0} km` : "客户端未请求道路规划"
      );
      routeDraft.executableSchedule = buildExecutableSchedule(routeDraft);
      const scheduleGate = routeDraft.executableSchedule.qualityGate;
      const scheduleConstraint = {
        id: "time-window-feasibility",
        label: "营业时间与日程可执行",
        value: scheduleGate.passed
          ? `${routeDraft.sites.length} 个点位通过`
          : `${scheduleGate.violations.length} 个时间冲突`,
        passed: scheduleGate.passed
      };
      routeDraft.optimization.constraints = [
        ...routeDraft.optimization.constraints.filter(item => item.id !== scheduleConstraint.id),
        scheduleConstraint
      ];
      routeDraft.optimization.constraintsPassed = routeDraft.optimization.constraints.filter(item => item.passed).length;
      routeDraft.optimization.constraintsTotal = routeDraft.optimization.constraints.length;
      routeDraft.metrics.constraintsPassed = routeDraft.optimization.constraintsPassed;
      routeDraft.metrics.constraintsTotal = routeDraft.optimization.constraintsTotal;
      pushAgentStep(
        "schedule",
        "生成可执行时间表",
        "Time Window Scheduler",
        scheduleGate.passed ? "success" : "attention",
        `${scheduleGate.verifiedOpeningHours} 个真实时间窗，${scheduleGate.estimatedOpeningHours} 个透明估算`
      );
      await applyAscendInference(routeDraft);
      pushAgentStep(
        "summary",
        "生成决策摘要与动作",
        routeDraft.inference?.provider || "本地规则模型",
        routeDraft.inference?.applied ? "success" : "fallback",
        routeDraft.inference?.applied ? "远程推理已应用" : "本地可解释规则输出"
      );
      routeDraft.agentTrace = {
        totalMs: Date.now() - agentStartedAt,
        steps: agentSteps,
        completedAt: new Date().toISOString()
      };
      const routePlan = saveDecisionSnapshot(routeDraft);
      return json(res, 200, {
        ...routePlan,
        liveData: {
          ...routePlan.liveData,
          weatherRefreshedAt: weatherBundle.refreshedAt || null,
          weatherErrors: weatherBundle.errors || []
        }
      });
    }
    if (pathname === "/api/tourism/risk-explanation") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      let routePlan = readDecisionSnapshot(options.planId);
      if (!routePlan) {
        const scope = await loadTourismScope(options);
        routePlan = buildTourismRoute(scope.siteDataset, scope.holidayData, scope.scenicDataset, {
          ...options,
          destinationRegion: scope.destinationRegion,
          destinationLngLat: scope.destinationLngLat
        });
      }
      const explanation = explainTourismRisk(routePlan, options.siteId || options.id);
      const targetSite = (routePlan.allSites || []).find(item => item.id === explanation?.siteId)
        || routePlan.sites?.find(item => item.id === explanation?.siteId);
      const nearbyEmergency = targetSite?.lngLat
        ? await searchNearbyEmergencyServices(targetSite.lngLat).catch(() => [])
        : [];
      return json(res, 200, {
        planId: routePlan.planId || null,
        snapshotUsed: Boolean(routePlan.planId),
        explanation: explanation ? {
          ...explanation,
          emergencyServices: nearbyEmergency.length
            ? nearbyEmergency.map(item => `${item.typeLabel}：${item.name}${item.distanceM ? `（约 ${item.distanceM} 米）` : ""}`)
            : explanation.emergencyServices,
          nearbyEmergency,
          emergencyDataType: nearbyEmergency.length ? "realtime-search" : "rule-fallback"
        } : null
      });
    }
    if (pathname === "/api/tourism/emergency-coverage") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      let routePlan = readDecisionSnapshot(options.planId);
      if (!routePlan) {
        const scope = await loadTourismScope(options);
        routePlan = buildTourismRoute(scope.siteDataset, scope.holidayData, scope.scenicDataset, {
          ...options,
          destinationRegion: scope.destinationRegion,
          destinationLngLat: scope.destinationLngLat
        });
      }
      return json(res, 200, {
        planId: routePlan.planId || null,
        snapshotUsed: Boolean(routePlan.planId),
        coverage: emergencyCoverage(routePlan),
        routeOrder: routePlan.routeOrder
      });
    }
    if (pathname === "/api/tourism/data-lineage") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      const scope = await loadTourismScope(options);
      const routePlan = readDecisionSnapshot(options.planId)
        || buildTourismRoute(scope.siteDataset, scope.holidayData, scope.scenicDataset, {
          ...options,
          destinationRegion: scope.destinationRegion,
          destinationLngLat: scope.destinationLngLat
        });
      return json(res, 200, {
        planId: routePlan.planId || null,
        snapshotUsed: Boolean(routePlan.planId),
        lineage: dataLineage(routePlan, scope.scenicDataset, scope.holidayData)
      });
    }
    if (pathname === "/api/tourism/ascend-readiness") {
      return json(res, 200, ascendReadiness());
    }
    if (pathname === "/api/tourism/project-status") {
      const options = Object.fromEntries(url.searchParams);
      const scope = await loadTourismScope(options);
      const routePlan = buildTourismRoute(scope.siteDataset, scope.holidayData, scope.scenicDataset, {
        ...options,
        destinationRegion: scope.destinationRegion,
        destinationLngLat: scope.destinationLngLat
      });
      return json(res, 200, tourismProjectStatus(routePlan, scope.scenicDataset, scope.holidayData));
    }
    if (pathname === "/api/recommend") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      return json(res, 200, recommend(await loadLocations(), options));
    }
    if (pathname === "/api/report") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      const result = recommend(await loadLocations(), options);
      return json(res, 200, { report: report(result, options), result });
    }
    if (pathname === "/api/data-request") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      const result = recommend(await loadLocations(), options);
      return json(res, 200, { top: result.top, request: dataRequest(result.top) });
    }
    if (pathname === "/api/landing-plan") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      const result = recommend(await loadLocations(), options);
      return json(res, 200, { top: result.top, plan: landingPlan(result, options) });
    }
    if (pathname === "/api/guide-summary") {
      const options = req.method === "POST" ? await readJson(req) : Object.fromEntries(url.searchParams);
      const result = recommend(await loadLocations(), options);
      return json(res, 200, guideSummary(result, options));
    }
    if (pathname.startsWith("/api/")) return json(res, 404, { error: "api_not_found" });
    return serveStatic(req, res, pathname);
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    return json(res, status, {
      error: status === 413 ? "request_body_too_large" : "internal_error",
      message: error.message
    });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer(handleRequest).listen(port, "127.0.0.1", () => {
    console.log(`qianzhi-public-data server listening on http://127.0.0.1:${port}`);
  });
}
