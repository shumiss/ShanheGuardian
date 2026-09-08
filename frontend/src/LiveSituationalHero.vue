<template>
  <section id="top" class="live-map-hero">
    <div class="map-canvas">
      <img
        class="map-base"
        :src="mapFailed ? reliefMap : mapUrl"
        alt="贵州省高德地图实景态势底图"
        @error="mapFailed = true"
      />
      <div class="map-grade"></div>
      <div class="terrain-light"></div>
    </div>

    <div class="weather-front weather-front-a"></div>
    <div class="weather-front weather-front-b"></div>
    <div class="film-grain"></div>

    <div class="live-ticker" aria-label="贵州九市州天气实况">
      <div class="ticker-state">
        <span :class="['state-pulse', { waiting: weatherStatus !== 'live' }]"></span>
        <strong>{{ weatherStatus === 'live' ? '贵州天气实况' : '正在连接数据' }}</strong>
        <small>{{ latestWeatherTime || '等待刷新' }}</small>
      </div>
      <div class="ticker-cities">
        <button
          v-for="weather in weatherData.live"
          :key="weather.adcode"
          type="button"
          :class="{ active: selectedSite.adcode === weather.adcode }"
          @click="selectWeatherCity(weather)"
        >
          <span>{{ weather.shortName }}</span>
          <strong>{{ weather.temperature }}°</strong>
          <em>{{ weather.weather }}</em>
        </button>
        <span v-if="!weatherData.live.length" class="ticker-loading">九市州实况正在汇入...</span>
      </div>
    </div>

    <div class="hero-statement">
      <p><span></span> QIANXING LIVE SITUATION</p>
      <h1>贵州山地<br /><em>实时旅行态势</em></h1>
      <span>把天气、景区承载与山地风险放到同一张真实地图上，先看见风险，再出发。</span>
    </div>

    <svg class="decision-route" viewBox="0 0 1024 576" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="routeGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#61ffd0" stop-opacity="0.28" />
          <stop offset="0.48" stop-color="#d9fff0" stop-opacity="1" />
          <stop offset="1" stop-color="#68eab7" stop-opacity="0.34" />
        </linearGradient>
        <filter id="routeGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path class="route-aura" :d="routePath" />
      <path id="liveRoutePath" class="route-core" :d="routePath" />
      <circle v-if="routePath" r="3.5" fill="#e7fff5" filter="url(#routeGlow)">
        <animateMotion dur="5.6s" repeatCount="indefinite" rotate="auto">
          <mpath href="#liveRoutePath" />
        </animateMotion>
      </circle>
    </svg>

    <button
      v-for="(site, index) in scenicSites"
      :key="site.id"
      class="scenic-node"
      :class="[`node-${siteRisk(site).level}`, { selected: selectedSite.id === site.id, routed: routeIds.includes(site.id) }]"
      :style="{ left: `${site.position.x}%`, top: `${site.position.y}%`, '--pulse-delay': `${index * -0.7}s` }"
      :data-lng="site.lng"
      :data-lat="site.lat"
      type="button"
      @click="selectSite(site)"
    >
      <span class="node-ring"></span>
      <span class="node-core">{{ routeNumber(site.id) || '·' }}</span>
      <span class="node-label">
        <strong>{{ site.name }}</strong>
        <em>{{ site.city }} · {{ siteRisk(site).label }}</em>
      </span>
    </button>

    <aside class="situation-panel" aria-live="polite">
      <div class="panel-kicker">
        <span>当前研判点位</span>
        <em>{{ selectedSite.lng.toFixed(6) }}, {{ selectedSite.lat.toFixed(6) }}</em>
      </div>

      <div class="panel-title">
        <div>
          <small>{{ selectedSite.city }} · {{ selectedSite.area }}</small>
          <h2>{{ selectedSite.name }}</h2>
        </div>
        <div class="risk-dial" :style="{ '--risk-value': `${siteRisk(selectedSite).score * 3.6}deg` }">
          <strong>{{ siteRisk(selectedSite).score }}</strong>
          <span>风险</span>
        </div>
      </div>

      <div class="live-metrics">
        <article>
          <span><CloudRain :size="15" /> 天气实况</span>
          <strong>{{ selectedWeather?.weather || '--' }} {{ selectedWeather ? `${selectedWeather.temperature}°` : '' }}</strong>
          <small>{{ selectedWeather ? `湿度 ${selectedWeather.humidity}% · ${selectedWeather.windDirection}风 ${selectedWeather.windPower}级` : '等待高德天气数据' }}</small>
        </article>
        <article>
          <span><Activity :size="15" /> 客流指数</span>
          <strong>{{ selectedCrowd?.crowdIndex ?? '--' }} <em>/ 100</em></strong>
          <small>{{ crowdData.dataType === 'authorized-realtime' ? '景区授权实时数据' : '模型估算 · 非实时人数' }}</small>
        </article>
      </div>

      <div class="decision-copy">
        <span>AI 决策建议</span>
        <p>{{ selectedSite.advice }}</p>
      </div>

      <div class="forecast-row" v-if="selectedForecast?.days?.length">
        <article v-for="day in selectedForecast.days.slice(0, 4)" :key="day.date">
          <span>{{ shortDate(day.date) }}</span>
          <strong>{{ day.dayWeather }}</strong>
          <small>{{ day.nightTemp }}° / {{ day.dayTemp }}°</small>
        </article>
      </div>

      <div class="source-line">
        <span><i class="source-live"></i> 天气 · 高德实况</span>
        <span><i class="source-estimate"></i> 客流 · {{ crowdData.dataType === 'authorized-realtime' ? '授权实时' : '模型估算' }}</span>
        <span><i class="source-map"></i> 点位 · 高德 POI</span>
      </div>
    </aside>

    <div class="planning-dock">
      <div class="dock-label">
        <Sparkles :size="17" />
        <span>告诉 AI 谁同行、玩几天、最担心什么</span>
      </div>
      <form @submit.prevent="generateRoute">
        <label class="sr-only" for="live-plan-query">输入旅行需求</label>
        <input
          id="live-plan-query"
          :value="modelValue"
          autocomplete="off"
          @input="$emit('update:modelValue', $event.target.value)"
        />
        <button type="submit" :disabled="planning">
          <span v-if="planning" class="planning-loader"></span>
          <Route v-else :size="18" />
          {{ planning ? '正在研判' : '生成安全路线' }}
        </button>
      </form>
      <div class="dock-foot">
        <div class="scenario-switches">
          <button v-for="scene in quickScenes" :key="scene.label" type="button" @click="applyScene(scene)">{{ scene.label }}</button>
        </div>
        <div class="route-truth"><Navigation :size="13" /> {{ routeMessage }}</div>
      </div>
    </div>

    <a class="console-entry" href="?mode=demo">
      进入全量决策台
      <ArrowRight :size="16" />
    </a>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { Activity, ArrowRight, CloudRain, Navigation, Route, Sparkles } from '@lucide/vue';
import reliefMap from './assets/guizhou-relief-map.png';

const props = defineProps({
  modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'route-generated']);
const apiBase = import.meta.env.VITE_API_BASE_URL || '';
const mapUrl = `${apiBase}/api/tourism/static-map`;
const mapFailed = ref(false);
const planning = ref(false);
const weatherData = ref({ status: 'loading', live: [], forecast: null });
const crowdData = ref({ status: 'loading', dataType: 'model-estimate', sites: [] });
const forecastCache = ref({});
const routeIds = ref(['qingyan', 'huangguoshu']);
const routeMessage = ref('AI 推荐串联关系 · 非导航道路');

const rawSites = [
  { id: 'fanjingshan', amapId: 'B0358001VZ', name: '梵净山风景区', city: '铜仁', area: '江口县', adcode: '520600', lng: 108.720359, lat: 27.882738, baseRisk: 67, advice: '高海拔天气变化快，建议提前核验索道与能见度；雨雾时下调路线强度。' },
  { id: 'huangguoshu', amapId: 'B0FFHCXU0K', name: '黄果树旅游景区', city: '安顺', area: '镇宁自治县', adcode: '520400', lng: 105.668716, lat: 25.988506, baseRisk: 61, advice: '丰水期步道湿滑，建议穿防滑鞋，并避开 11:00 至 14:00 集中到访时段。' },
  { id: 'xiaoqikong', amapId: 'B035600C1Q', name: '小七孔景区', city: '黔南', area: '荔波县', adcode: '522700', lng: 107.705723, lat: 25.252959, baseRisk: 46, advice: '降雨后亲水路段水位变化快，优先选择服务点覆盖更完整的西门游线。' },
  { id: 'xijiang', amapId: 'B03570161U', name: '西江千户苗寨', city: '黔东南', area: '雷山县', adcode: '522600', lng: 108.173116, lat: 26.494562, baseRisk: 58, advice: '夜间返程与接驳客流集中，建议提前确认集合点和末班接驳时间。' },
  { id: 'qingyan', amapId: 'B035300ESE', name: '青岩古镇', city: '贵阳', area: '花溪区', adcode: '520100', lng: 106.686834, lat: 26.331095, baseRisk: 42, advice: '雨天石板路湿滑，银发与亲子同行建议由北门进入，减少连续城墙台阶。' },
  { id: 'wanfenglin', amapId: 'B035B00J9X', name: '万峰林景区', city: '黔西南', area: '兴义市', adcode: '522300', lng: 104.924648, lat: 25.009610, baseRisk: 39, advice: '午后日照与村道车流叠加，建议上午游览，骑行时避开车辆集中时段。' },
  { id: 'zhijin', amapId: 'B0359003K3', name: '织金洞景区', city: '毕节', area: '织金县', adcode: '520500', lng: 105.883673, lat: 26.772214, baseRisk: 64, advice: '洞内湿度高且连续台阶较多，老人儿童应控制行进速度并做好保暖防滑。' },
];

const quickScenes = [
  { label: '亲子雨天', query: '带父母和孩子去贵州玩两天，不想太累，担心下雨路滑', route: ['qingyan', 'huangguoshu'] },
  { label: '银发康养', query: '陪父母在贵州康养慢游三天，少爬坡，优先医疗和休息点', route: ['qingyan', 'wanfenglin'] },
  { label: '研学团队', query: '30人研学团队去贵州三天，关注地质文化、承载能力和集合安全', route: ['qingyan', 'zhijin', 'huangguoshu'] },
];

function mercatorPoint(lng, lat) {
  // Static Map scale=2 doubles the rendered tile density, so the overlay uses
  // the effective zoom level (requested zoom 6 + one scale level).
  const zoom = 7;
  const world = 256 * 2 ** zoom;
  const x = ((lng + 180) / 360) * world;
  const sine = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world;
  return { x, y };
}

function projectToMap(lng, lat) {
  const center = mercatorPoint(106.7, 26.8);
  const point = mercatorPoint(lng, lat);
  return {
    x: ((point.x - center.x + 512) / 1024) * 100,
    y: ((point.y - center.y + 288) / 576) * 100,
  };
}

const scenicSites = rawSites.map(site => ({ ...site, position: projectToMap(site.lng, site.lat) }));
const selectedId = ref('qingyan');
const selectedSite = computed(() => scenicSites.find(site => site.id === selectedId.value) || scenicSites[0]);
const selectedWeather = computed(() => weatherData.value.live.find(item => item.adcode === selectedSite.value.adcode));
const selectedCrowd = computed(() => crowdData.value.sites.find(item => item.name.includes(selectedSite.value.name.replace('旅游景区', '').replace('风景区', '').replace('景区', ''))));
const selectedForecast = computed(() => forecastCache.value[selectedSite.value.adcode] || null);
const weatherStatus = computed(() => weatherData.value.status);
const latestWeatherTime = computed(() => weatherData.value.live[0]?.reportTime || '');

const routePath = computed(() => {
  const points = routeIds.value
    .map(id => scenicSites.find(site => site.id === id))
    .filter(Boolean)
    .map(site => ({ x: (site.position.x / 100) * 1024, y: (site.position.y / 100) * 576 }));
  if (points.length < 2) return '';
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const distance = point.x - previous.x;
    const lift = Math.max(-48, Math.min(48, (point.y - previous.y) * -0.22));
    return `${path} C ${previous.x + distance * 0.35} ${previous.y + lift}, ${previous.x + distance * 0.72} ${point.y - lift}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
});

function routeNumber(id) {
  const index = routeIds.value.indexOf(id);
  return index >= 0 ? index + 1 : '';
}

function siteRisk(site) {
  const weather = weatherData.value.live.find(item => item.adcode === site.adcode);
  const crowd = crowdData.value.sites.find(item => item.name.includes(site.name.replace('旅游景区', '').replace('风景区', '').replace('景区', '')));
  const weatherLift = weather && /雨|雪|雾|雷/.test(weather.weather) ? 9 : 0;
  const crowdLift = crowd ? Math.max(0, (crowd.crowdIndex - 55) * 0.15) : 0;
  const score = Math.min(96, Math.round(site.baseRisk + weatherLift + crowdLift));
  return { score, level: score >= 72 ? 'high' : score >= 52 ? 'medium' : 'low', label: score >= 72 ? '较高风险' : score >= 52 ? '中风险' : '低风险' };
}

function shortDate(date) {
  const parts = date.split('-');
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function selectWeatherCity(weather) {
  const site = scenicSites.find(item => item.adcode === weather.adcode);
  if (site) selectSite(site);
}

async function selectSite(site) {
  selectedId.value = site.id;
  if (forecastCache.value[site.adcode]) return;
  try {
    const response = await fetch(`${apiBase}/api/tourism/live-weather?adcodes=${site.adcode}&forecast=${site.adcode}`);
    const payload = await response.json();
    if (payload.forecast) forecastCache.value = { ...forecastCache.value, [site.adcode]: payload.forecast };
  } catch {
    // The current live reading remains useful if the forecast refresh is unavailable.
  }
}

function inferRoute() {
  const query = props.modelValue;
  if (/研学|地质|团队/.test(query)) return ['qingyan', 'zhijin', 'huangguoshu'];
  if (/康养|老人|父母|轻松|不太累/.test(query)) return ['qingyan', 'huangguoshu'];
  if (/自然|山地|徒步/.test(query)) return ['fanjingshan', 'xijiang'];
  return ['qingyan', 'huangguoshu'];
}

async function generateRoute() {
  if (planning.value) return;
  planning.value = true;
  routeMessage.value = '需求、天气与客流指数正在融合';
  const inferredRoute = inferRoute();
  try {
    const response = await fetch(`${apiBase}/api/tourism/route-plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: props.modelValue, requirement: props.modelValue, days: /三天|3天/.test(props.modelValue) ? 3 : 2 }),
    });
    if (!response.ok) throw new Error('route_plan_unavailable');
    const payload = await response.json();
    routeIds.value = inferredRoute;
    selectedId.value = inferredRoute[0];
    routeMessage.value = `已完成 ${inferredRoute.length} 站安全研判 · 串联关系非导航道路`;
    emit('route-generated', payload);
  } catch {
    routeIds.value = inferredRoute;
    selectedId.value = inferredRoute[0];
    routeMessage.value = '本地安全模型已生成 · 串联关系非导航道路';
  } finally {
    planning.value = false;
  }
}

function applyScene(scene) {
  emit('update:modelValue', scene.query);
  routeIds.value = scene.route;
  selectedId.value = scene.route[0];
  window.setTimeout(generateRoute, 0);
}

async function loadLiveData() {
  const names = rawSites.map(site => site.name).join(',');
  try {
    const [weatherResponse, crowdResponse] = await Promise.all([
      fetch(`${apiBase}/api/tourism/live-weather?forecast=520100`),
      fetch(`${apiBase}/api/tourism/crowd-flow?names=${encodeURIComponent(names)}`),
    ]);
    const [weather, crowd] = await Promise.all([weatherResponse.json(), crowdResponse.json()]);
    weatherData.value = weather;
    crowdData.value = crowd;
    if (weather.forecast) forecastCache.value = { ...forecastCache.value, [weather.forecast.adcode]: weather.forecast };
  } catch {
    weatherData.value = { status: 'unavailable', live: [], forecast: null };
    crowdData.value = { status: 'unavailable', dataType: 'model-estimate', sites: [] };
  }
}

onMounted(loadLiveData);
</script>

<style scoped>
.live-map-hero {
  --signal: #72f7bd;
  --signal-strong: #29d58b;
  --ink: #06120e;
  position: relative;
  min-height: 760px;
  height: 100dvh;
  overflow: hidden;
  color: #f4fbf7;
  background: #07130f;
  isolation: isolate;
}

.map-canvas { position: absolute; z-index: -5; inset: 0; }
.map-base { width: 100%; height: 100%; object-fit: fill; filter: saturate(.56) contrast(1.18) brightness(.47) hue-rotate(7deg); }
.map-grade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(2,13,9,.84) 0%, rgba(3,16,11,.29) 36%, rgba(2,13,9,.08) 58%, rgba(2,13,9,.76) 100%), linear-gradient(180deg, rgba(2,11,8,.72) 0%, transparent 22%, transparent 67%, rgba(2,11,8,.86) 100%); }
.terrain-light { position: absolute; inset: 0; opacity: .28; background: linear-gradient(112deg, transparent 16%, rgba(104,255,194,.18) 33%, transparent 47%); mix-blend-mode: screen; animation: surveySweep 12s ease-in-out infinite; }
.film-grain { position: absolute; z-index: -1; inset: 0; pointer-events: none; opacity: .22; background-image: repeating-linear-gradient(0deg, rgba(255,255,255,.022) 0, rgba(255,255,255,.022) 1px, transparent 1px, transparent 3px); mix-blend-mode: soft-light; }
.weather-front { position: absolute; z-index: -2; width: 62%; height: 24%; pointer-events: none; filter: blur(24px); opacity: .25; background: linear-gradient(90deg, transparent, rgba(221,239,230,.52), transparent); transform: skewX(-12deg); animation: weatherDrift 18s linear infinite; }
.weather-front-a { top: 15%; left: -70%; }
.weather-front-b { top: 58%; left: -85%; opacity: .13; animation-delay: -8s; animation-duration: 25s; }

.live-ticker { position: absolute; z-index: 8; top: 92px; right: 4.2vw; left: 4.2vw; display: flex; align-items: center; min-height: 43px; border-top: 1px solid rgba(205,245,225,.2); border-bottom: 1px solid rgba(205,245,225,.16); background: rgba(3,17,12,.34); backdrop-filter: blur(13px); }
.ticker-state { display: grid; grid-template-columns: auto auto; column-gap: 8px; align-items: center; flex: 0 0 206px; height: 100%; padding: 0 18px; border-right: 1px solid rgba(205,245,225,.15); }
.ticker-state strong { font-size: 11px; letter-spacing: 0; }
.ticker-state small { grid-column: 2; color: rgba(226,242,234,.57); font-size: 8px; }
.state-pulse { grid-row: 1 / 3; width: 7px; height: 7px; border-radius: 50%; background: var(--signal); box-shadow: 0 0 0 5px rgba(114,247,189,.12), 0 0 16px rgba(114,247,189,.9); animation: livePulse 2s ease-in-out infinite; }
.state-pulse.waiting { background: #e6ad4f; box-shadow: 0 0 0 5px rgba(230,173,79,.12); }
.ticker-cities { display: flex; align-items: stretch; min-width: 0; height: 42px; overflow-x: auto; scrollbar-width: none; }
.ticker-cities::-webkit-scrollbar { display: none; }
.ticker-cities button { display: grid; grid-template-columns: auto auto; column-gap: 8px; align-content: center; flex: 0 0 auto; min-width: 96px; padding: 0 13px; border: 0; border-right: 1px solid rgba(205,245,225,.09); color: rgba(241,249,245,.78); text-align: left; background: transparent; cursor: pointer; transition: color 180ms ease, background 180ms ease; }
.ticker-cities button:hover, .ticker-cities button.active { color: #fff; background: rgba(113,247,188,.09); }
.ticker-cities span { font-size: 9px; }
.ticker-cities strong { font-size: 13px; }
.ticker-cities em { grid-column: 1 / 3; color: rgba(229,242,235,.5); font-size: 8px; font-style: normal; }
.ticker-loading { align-self: center; padding: 0 20px; color: rgba(235,246,240,.58); font-size: 9px; }

.hero-statement { position: absolute; z-index: 4; top: 176px; left: 5.4vw; width: min(420px, 32vw); }
.hero-statement > p { display: flex; align-items: center; gap: 9px; margin: 0 0 15px; color: rgba(224,245,235,.58); font-size: 9px; font-weight: 700; }
.hero-statement > p span { width: 24px; height: 1px; background: var(--signal); }
.hero-statement h1 { margin: 0; font-size: clamp(38px, 4.2vw, 67px); font-weight: 680; line-height: 1.08; letter-spacing: 0; text-shadow: 0 12px 42px rgba(0,0,0,.4); }
.hero-statement h1 em { color: #dffbed; font-style: normal; font-weight: 400; }
.hero-statement > span { display: block; max-width: 35ch; margin-top: 18px; color: rgba(232,244,238,.69); font-size: 12px; line-height: 1.75; }

.decision-route { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.route-aura, .route-core { fill: none; vector-effect: non-scaling-stroke; }
.route-aura { stroke: rgba(79,240,174,.22); stroke-width: 11; filter: url(#routeGlow); }
.route-core { stroke: url(#routeGradient); stroke-width: 2.2; stroke-linecap: round; stroke-dasharray: 4 8; animation: routeFlow 9s linear infinite; }

.scenic-node { position: absolute; z-index: 3; width: 28px; height: 28px; padding: 0; border: 0; color: #effcf5; background: transparent; transform: translate(-50%, -50%); cursor: pointer; }
.node-ring { position: absolute; inset: -5px; border: 1px solid rgba(132,255,205,.6); border-radius: 50%; opacity: .65; animation: nodePulse 3.2s ease-out infinite; animation-delay: var(--pulse-delay); }
.node-core { position: relative; z-index: 2; display: grid; place-items: center; width: 28px; height: 28px; border: 2px solid rgba(229,255,244,.88); border-radius: 50%; color: #07130e; font-size: 10px; font-weight: 800; background: var(--signal); box-shadow: 0 0 22px rgba(69,235,163,.58); }
.node-medium .node-core { background: #d8b960; box-shadow: 0 0 20px rgba(216,185,96,.4); }
.node-high .node-core { background: #ed7b6d; box-shadow: 0 0 20px rgba(237,123,109,.45); }
.node-label { position: absolute; top: -10px; left: 37px; display: grid; min-width: 112px; padding: 8px 10px; border-left: 1px solid rgba(125,244,193,.55); color: #f3fbf7; text-align: left; background: linear-gradient(90deg, rgba(2,15,10,.83), rgba(2,15,10,.3)); backdrop-filter: blur(8px); opacity: .8; transition: opacity 180ms ease, transform 180ms ease; }
.node-label strong { font-size: 10px; white-space: nowrap; }
.node-label em { margin-top: 3px; color: rgba(229,242,235,.58); font-size: 8px; font-style: normal; white-space: nowrap; }
.scenic-node:hover, .scenic-node.selected { z-index: 6; }
.scenic-node:hover .node-label, .scenic-node.selected .node-label { opacity: 1; transform: translateX(4px); }
.scenic-node.selected .node-core { color: #fff; background: #0a2419; box-shadow: 0 0 0 5px rgba(111,247,188,.18), 0 0 28px rgba(111,247,188,.7); }

.situation-panel { position: absolute; z-index: 7; top: 160px; right: 4.2vw; width: min(380px, 29vw); padding: 20px 21px 18px; border: 1px solid rgba(190,235,212,.19); border-radius: 6px; background: rgba(3,18,12,.7); box-shadow: 0 28px 70px rgba(0,0,0,.28); backdrop-filter: blur(18px) saturate(1.2); }
.panel-kicker { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: rgba(224,242,233,.51); font-size: 8px; }
.panel-kicker em { font-family: Consolas, monospace; font-style: normal; }
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(190,235,212,.14); }
.panel-title small { color: var(--signal); font-size: 9px; }
.panel-title h2 { margin: 4px 0 0; font-size: 21px; line-height: 1.25; letter-spacing: 0; }
.risk-dial { display: grid; place-items: center; flex: 0 0 57px; width: 57px; height: 57px; border-radius: 50%; background: radial-gradient(circle at center, #0a1c14 55%, transparent 57%), conic-gradient(var(--signal) var(--risk-value), rgba(255,255,255,.09) 0); }
.risk-dial strong { align-self: end; font-size: 16px; line-height: 1; }
.risk-dial span { align-self: start; margin-top: 2px; color: rgba(231,245,238,.5); font-size: 7px; }
.live-metrics { display: grid; grid-template-columns: 1fr 1fr; margin: 15px 0; }
.live-metrics article { min-width: 0; padding-right: 13px; }
.live-metrics article + article { padding-left: 14px; border-left: 1px solid rgba(190,235,212,.14); }
.live-metrics span { display: flex; align-items: center; gap: 6px; color: rgba(224,242,233,.52); font-size: 8px; }
.live-metrics strong { display: block; margin-top: 6px; font-size: 16px; white-space: nowrap; }
.live-metrics strong em { color: rgba(224,242,233,.42); font-size: 8px; font-style: normal; }
.live-metrics small { display: block; overflow: hidden; margin-top: 3px; color: rgba(224,242,233,.46); font-size: 7.5px; text-overflow: ellipsis; white-space: nowrap; }
.decision-copy { padding: 12px 0 14px; border-top: 1px solid rgba(190,235,212,.14); }
.decision-copy span { color: var(--signal); font-size: 8px; font-weight: 700; }
.decision-copy p { margin: 6px 0 0; color: rgba(239,249,244,.76); font-size: 10px; line-height: 1.7; }
.forecast-row { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid rgba(190,235,212,.14); border-bottom: 1px solid rgba(190,235,212,.14); }
.forecast-row article { display: grid; gap: 3px; padding: 9px 5px; text-align: center; }
.forecast-row article + article { border-left: 1px solid rgba(190,235,212,.1); }
.forecast-row span, .forecast-row small { color: rgba(224,242,233,.45); font-size: 7px; }
.forecast-row strong { font-size: 8px; }
.source-line { display: flex; flex-wrap: wrap; gap: 9px 13px; padding-top: 13px; color: rgba(224,242,233,.47); font-size: 7px; }
.source-line span { display: flex; align-items: center; gap: 5px; }
.source-line i { width: 5px; height: 5px; border-radius: 50%; }
.source-live { background: var(--signal); box-shadow: 0 0 8px var(--signal); }
.source-estimate { background: #d7ad57; }
.source-map { background: #86cde9; }

.planning-dock { position: absolute; z-index: 8; right: 4.2vw; bottom: 34px; left: 4.2vw; display: grid; grid-template-columns: 190px minmax(360px, 1fr); column-gap: 20px; padding: 15px 17px 13px; border: 1px solid rgba(194,235,214,.2); border-radius: 6px; background: rgba(3,17,11,.73); box-shadow: 0 20px 50px rgba(0,0,0,.22); backdrop-filter: blur(18px); }
.dock-label { display: flex; align-items: center; gap: 9px; color: rgba(230,246,238,.69); font-size: 9px; }
.dock-label svg { color: var(--signal); }
.planning-dock form { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.planning-dock input { min-width: 0; height: 43px; padding: 0 15px; border: 1px solid rgba(194,235,214,.18); border-radius: 4px; outline: none; color: #f3faf6; font-size: 11px; background: rgba(255,255,255,.045); transition: border-color 180ms ease, background 180ms ease; }
.planning-dock input:focus { border-color: rgba(114,247,189,.68); background: rgba(255,255,255,.07); }
.planning-dock form button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 148px; height: 43px; padding: 0 17px; border: 0; border-radius: 4px; color: #05130d; font-size: 10px; font-weight: 800; background: var(--signal); cursor: pointer; transition: background 180ms ease, transform 180ms ease; }
.planning-dock form button:hover { background: #a2ffd8; transform: translateY(-1px); }
.planning-dock form button:disabled { cursor: wait; opacity: .7; }
.dock-foot { grid-column: 2; display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 9px; }
.scenario-switches { display: flex; gap: 7px; }
.scenario-switches button { padding: 0; border: 0; color: rgba(231,245,238,.5); font-size: 8px; background: transparent; cursor: pointer; }
.scenario-switches button:hover { color: var(--signal); }
.route-truth { display: flex; align-items: center; gap: 6px; color: rgba(231,245,238,.45); font-size: 7.5px; }
.planning-loader { width: 14px; height: 14px; border: 2px solid rgba(4,18,12,.25); border-top-color: #05130d; border-radius: 50%; animation: spin .7s linear infinite; }
.console-entry { position: absolute; z-index: 9; right: 4.2vw; top: 44px; display: inline-flex; align-items: center; gap: 8px; color: rgba(238,249,243,.72); font-size: 9px; font-weight: 700; transition: color 180ms ease; }
.console-entry:hover { color: var(--signal); }

@keyframes weatherDrift { to { transform: translateX(290%) skewX(-12deg); } }
@keyframes surveySweep { 0%, 100% { transform: translateX(-28%); opacity: .14; } 50% { transform: translateX(42%); opacity: .34; } }
@keyframes routeFlow { to { stroke-dashoffset: -96; } }
@keyframes nodePulse { 0% { transform: scale(.65); opacity: .65; } 75%, 100% { transform: scale(1.8); opacity: 0; } }
@keyframes livePulse { 50% { opacity: .52; transform: scale(.82); } }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1100px) {
  .hero-statement { width: 36vw; }
  .situation-panel { width: 330px; }
  .scenic-node:not(.selected):not(.routed) .node-label { display: none; }
  .planning-dock { grid-template-columns: 1fr; }
  .dock-label { display: none; }
  .dock-foot { grid-column: 1; }
}

@media (max-width: 760px) {
  .live-map-hero { min-height: 820px; height: auto; }
  .live-ticker { top: 76px; right: 16px; left: 16px; }
  .ticker-state { display: none; }
  .hero-statement { top: 142px; left: 20px; width: calc(100% - 40px); }
  .hero-statement h1 { font-size: 39px; }
  .hero-statement > span { max-width: 30ch; }
  .decision-route { top: 40px; height: 58%; }
  .scenic-node { margin-top: 38px; }
  .scenic-node:not(.selected):not(.routed) { display: none; }
  .node-label { min-width: 96px; }
  .situation-panel { top: 365px; right: 16px; left: 16px; width: auto; }
  .planning-dock { right: 16px; bottom: 17px; left: 16px; padding: 12px; }
  .planning-dock form { grid-template-columns: 1fr; }
  .planning-dock form button { width: 100%; }
  .dock-foot { display: none; }
  .console-entry { top: 36px; right: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .weather-front, .terrain-light, .route-core, .node-ring, .state-pulse, .planning-loader { animation: none !important; }
  .decision-route circle { display: none; }
}
</style>
