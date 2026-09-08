import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(scriptDir, "..");
const outputFile = join(backendRoot, "data", "guizhou_scenic_spots.amap.json");

const cities = [
  { adcode: "520100", name: "贵阳市" },
  { adcode: "520200", name: "六盘水市" },
  { adcode: "520300", name: "遵义市" },
  { adcode: "520400", name: "安顺市" },
  { adcode: "520500", name: "毕节市" },
  { adcode: "520600", name: "铜仁市" },
  { adcode: "522300", name: "黔西南布依族苗族自治州" },
  { adcode: "522600", name: "黔东南苗族侗族自治州" },
  { adcode: "522700", name: "黔南布依族苗族自治州" },
];

const envFiles = [
  join(backendRoot, ".env.local"),
  join(backendRoot, "..", "qianzhi-vue", "qianzhi-vue", ".env.local"),
];

async function loadEnv() {
  const env = { ...process.env };
  for (const file of envFiles) {
    try {
      const body = await readFile(file, "utf8");
      for (const line of body.split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !env[match[1]]) env[match[1]] = match[2];
      }
    } catch {
      // Optional local env file.
    }
  }
  return {
    key: env.AMAP_WEB_SERVICE_KEY || env.VITE_AMAP_JSAPI_KEY,
    privateKey: env.AMAP_WEB_SERVICE_PRIVATE_KEY || env.VITE_AMAP_SECURITY_JS_CODE,
  };
}

function sign(params, privateKey) {
  const query = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("md5").update(`${query}${privateKey}`).digest("hex");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizePoi(poi, queryCity) {
  const [lng, lat] = String(poi.location || "")
    .split(",")
    .map(value => Number(value));
  return {
    id: poi.id,
    name: poi.name,
    city: poi.cityname || queryCity.name,
    district: poi.adname || "",
    address: poi.address || "",
    type: poi.type || "",
    typecode: poi.typecode || "",
    location: Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null,
    tel: poi.tel || "",
    rating: poi.biz_ext?.rating || "",
    cost: poi.biz_ext?.cost || "",
    tag: poi.biz_ext?.tag || "",
    photos: (poi.photos || []).slice(0, 3).map(photo => ({
      title: photo.title || "",
      url: photo.url || "",
    })),
    source: "AMap Place Search",
  };
}

async function amapPlaceText({ key, privateKey, city, page }) {
  const params = {
    key,
    city: city.adcode,
    citylimit: "true",
    types: "110000",
    offset: "25",
    page: String(page),
    extensions: "all",
    output: "JSON",
  };
  if (privateKey) params.sig = sign(params, privateKey);

  const url = `https://restapi.amap.com/v3/place/text?${new URLSearchParams(params)}`;
  const response = await fetch(url);
  const payload = await response.json();
  if (payload.status !== "1") {
    throw new Error(`${city.name} page ${page}: ${payload.info || "amap_error"}`);
  }
  return payload;
}

function scenicHeatSeed(poi) {
  const text = `${poi.name} ${poi.type}`;
  let score = 50;
  if (text.includes("国家级景点")) score += 18;
  if (text.includes("黄果树") || text.includes("梵净山") || text.includes("荔波") || text.includes("小七孔")) score += 18;
  if (text.includes("青岩") || text.includes("西江") || text.includes("织金洞") || text.includes("万峰林")) score += 14;
  if (text.includes("公园") || text.includes("古镇") || text.includes("峡谷") || text.includes("温泉")) score += 6;
  const rating = Number(poi.rating);
  if (Number.isFinite(rating)) score += Math.max(0, Math.round((rating - 4) * 8));
  return Math.max(0, Math.min(100, score));
}

async function collect() {
  const credentials = await loadEnv();
  if (!credentials.key) {
    throw new Error("缺少 AMAP_WEB_SERVICE_KEY 或 VITE_AMAP_JSAPI_KEY");
  }

  const deduped = new Map();
  const cityStats = [];
  for (const city of cities) {
    let page = 1;
    let total = 0;
    let received = 0;
    while (page <= 100) {
      const data = await amapPlaceText({ ...credentials, city, page });
      total = Number(data.count || 0);
      const pois = data.pois || [];
      if (!pois.length) break;
      for (const poi of pois) {
        const normalized = normalizePoi(poi, city);
        if (!normalized.id || !normalized.location) continue;
        deduped.set(normalized.id, {
          ...normalized,
          holidayHeatSeed: scenicHeatSeed(normalized),
        });
      }
      received += pois.length;
      if (received >= total) break;
      page += 1;
      await sleep(760);
    }
    cityStats.push({ city: city.name, adcode: city.adcode, total: total || received, received });
    await sleep(980);
  }

  const spots = [...deduped.values()].sort((a, b) => {
    if (b.holidayHeatSeed !== a.holidayHeatSeed) return b.holidayHeatSeed - a.holidayHeatSeed;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  const output = {
    meta: {
      provider: "AMap Place Search",
      sourceUrl: "https://restapi.amap.com/v3/place/text",
      province: "贵州省",
      typeFilter: "110000 风景名胜",
      generatedAt: new Date().toISOString(),
      total: spots.length,
      cityStats,
      note: "来源为高德可检索 POI，不等同于文旅主管部门 A 级景区完整名录。",
    },
    spots,
  };

  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output.meta;
}

collect()
  .then(meta => {
    console.log(JSON.stringify(meta, null, 2));
  })
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
