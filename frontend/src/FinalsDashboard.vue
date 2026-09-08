<template>
  <div class="finals-app" :class="{ 'is-generating': generating }">
    <aside class="rail">
      <button class="brand-mark" type="button" title="黔行守护" @click="activeView = 'command'">黔</button>

      <nav class="rail-nav" aria-label="决赛演示导航">
        <button
          v-for="item in navigation"
          :key="item.id"
          type="button"
          :class="{ active: activeView === item.id }"
          :title="item.label"
          @click="activeView = item.id"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="rail-footer" title="服务运行状态">
        <span :class="integration.health === 'ok' ? 'online' : 'offline'"></span>
        <Activity :size="18" />
      </div>
    </aside>

    <header class="topbar">
      <div class="product-name">
        <div>
          <strong>黔行守护</strong>
          <span>贵州山地旅游 AI 伴游与安全决策平台</span>
        </div>
        <i>决赛版</i>
      </div>

      <div class="decision-chain" aria-label="AI 决策闭环">
        <template v-for="(step, index) in decisionChain" :key="step.label">
          <div :class="{ active: generating ? progress >= step.at : routeSites.length }">
            <component :is="step.icon" :size="15" />
            <span>{{ step.label }}</span>
          </div>
          <ChevronRight v-if="index < decisionChain.length - 1" :size="14" />
        </template>
      </div>

      <div class="top-status">
        <div class="service-state">
          <span :class="integration.health === 'ok' ? 'online' : 'offline'"></span>
          <div>
            <strong>{{ serviceLabel }}</strong>
            <small>{{ integration.remote ? '远程 AI 推理' : '本地决策引擎' }}</small>
          </div>
        </div>
        <button type="button" title="刷新数据" :disabled="generating" @click="refreshAll">
          <RefreshCw :size="18" :class="{ spin: generating }" />
        </button>
      </div>
    </header>

    <main class="workspace">
      <Transition name="view-fade" mode="out-in">
        <section v-if="activeView === 'command'" key="command" class="command-view">
          <div class="map-stage">
            <img class="relief-map" :src="reliefMap" alt="贵州山地旅游态势底图" />
            <div class="map-shade"></div>
            <div class="map-grid"></div>

            <div class="map-caption">
              <span>贵州 · 山地旅游安全走廊</span>
              <strong>{{ routeTitle }}</strong>
            </div>

            <div class="map-tools">
              <button
                v-for="mode in mapModes"
                :key="mode.id"
                type="button"
                :class="{ active: mapMode === mode.id }"
                @click="mapMode = mode.id"
              >
                <component :is="mode.icon" :size="15" />
                {{ mode.label }}
              </button>
            </div>

            <div class="place-labels" aria-hidden="true">
              <span class="province">贵州省</span>
              <span class="city c1">贵阳市</span>
              <span class="city c2">安顺市</span>
              <span class="city c3">毕节市</span>
              <span class="city c4">黔南州</span>
            </div>

            <svg class="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <filter id="route-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <path class="route-halo" :d="routePath" />
              <path class="route-line" :d="routePath" />
              <path class="route-motion" :d="routePath" />
            </svg>

            <button
              v-for="point in displayPoints"
              :key="`${point.site.id}-${routeVersion}`"
              type="button"
              class="route-pin"
              :class="[riskClass(point.site.riskScore), { selected: selectedId === point.site.id, muted: mapMode === 'service' && point.site.serviceCoverage < 85 }]"
              :style="{ left: `${point.x}%`, top: `${point.y}%`, '--delay': `${point.index * 90}ms` }"
              @click="selectSite(point.site.id)"
            >
              <span class="pin-pulse"></span>
              <b>{{ point.index + 1 }}</b>
              <span class="pin-label" :class="point.index % 2 ? 'below' : 'above'">
                <strong>{{ compactName(point.site.name || point.site.shortName) }}</strong>
                <small v-if="mapMode === 'service'">服务 {{ Math.round(point.site.serviceCoverage || 0) }}%</small>
                <small v-else>{{ point.site.riskScore }} 分 · {{ riskLabel(point.site.riskScore) }}</small>
              </span>
            </button>

            <div class="map-legend">
              <span><i class="low"></i>低风险</span>
              <span><i class="medium"></i>中风险</span>
              <span><i class="high"></i>较高风险</span>
              <small>路线由 {{ metrics.candidatePool || integration.scenicTotal || 0 }} 个候选点位生成</small>
            </div>

            <div v-if="generating" class="inference-overlay" aria-live="polite">
              <div class="inference-orbit"><BrainCircuit :size="28" /></div>
              <strong>{{ inferenceLabel }}</strong>
              <span>{{ progress }}%</span>
              <div><i :style="{ width: `${progress}%` }"></i></div>
            </div>
          </div>

          <aside class="request-panel glass-panel">
            <div class="panel-heading">
              <div>
                <small>游客意图</small>
                <h2>生成个性化安全路线</h2>
              </div>
              <Sparkles :size="19" />
            </div>

            <div class="scenario-switch" aria-label="快速场景">
              <button
                v-for="scenario in scenarios"
                :key="scenario.id"
                type="button"
                :class="{ active: activeScenario === scenario.id }"
                @click="applyScenario(scenario)"
              >
                {{ scenario.label }}
              </button>
            </div>

            <label class="prompt-box">
              <span>自然语言需求</span>
              <textarea v-model.trim="form.request" rows="4" spellcheck="false"></textarea>
              <small><WandSparkles :size="13" /> AI 自动识别人群、兴趣、强度与风险约束</small>
            </label>

            <div class="profile-grid">
              <label>
                <span><Users :size="14" /> 游客</span>
                <select v-model="form.travelerType">
                  <option value="family">亲子家庭</option>
                  <option value="senior">老人同行</option>
                  <option value="study">研学团队</option>
                  <option value="wellness">康养游客</option>
                </select>
              </label>
              <label>
                <span><CloudRain :size="14" /> 天气</span>
                <select v-model="form.weather">
                  <option value="rain">小雨路滑</option>
                  <option value="clear">晴朗通行</option>
                  <option value="fog">山间大雾</option>
                  <option value="heat">高温暴晒</option>
                </select>
              </label>
              <label>
                <span><CalendarDays :size="14" /> 天数</span>
                <select v-model.number="form.days">
                  <option :value="1">1 天</option>
                  <option :value="2">2 天</option>
                  <option :value="3">3 天</option>
                  <option :value="4">4 天</option>
                </select>
              </label>
              <label>
                <span><Compass :size="14" /> 偏好</span>
                <select v-model="form.preference">
                  <option value="safe">安全优先</option>
                  <option value="lowload">低强度</option>
                  <option value="culture">民族文化</option>
                  <option value="nature">山地自然</option>
                </select>
              </label>
            </div>

            <label class="intensity-control">
              <span>路线强度 <b>{{ form.intensity }}</b></span>
              <input v-model.number="form.intensity" type="range" min="20" max="90" />
              <small>轻松</small><small>挑战</small>
            </label>

            <button class="primary-action" type="button" :disabled="generating" @click="generateRoute('manual')">
              <Play v-if="!generating" :size="17" fill="currentColor" />
              <LoaderCircle v-else :size="17" class="spin" />
              {{ generating ? 'AI 决策生成中' : '生成安全路线' }}
            </button>
          </aside>

          <aside class="insight-panel glass-panel">
            <div class="panel-heading">
              <div>
                <small>AI 决策摘要</small>
                <h2>{{ aiStateLabel }}</h2>
              </div>
              <div class="confidence"><span>可信度</span><b>{{ confidence }}%</b></div>
            </div>

            <div class="metric-row">
              <div><strong>{{ metrics.siteCount || routeSites.length }}</strong><span>行程点</span></div>
              <div><strong>{{ metrics.averageRisk || 0 }}</strong><span>平均风险</span></div>
              <div><strong>{{ metrics.serviceCoverage || 0 }}%</strong><span>应急覆盖</span></div>
            </div>

            <button v-if="selectedSite" type="button" class="risk-focus" :class="riskClass(selectedSite.riskScore)" @click="activeView = 'risk'">
              <span>
                <AlertTriangle :size="16" /> 当前关注
              </span>
              <strong>{{ compactName(selectedSite.shortName || selectedSite.name) }} · {{ selectedSite.riskScore }} 分</strong>
              <small>{{ selectedSite.primaryRisk }}</small>
              <ChevronRight :size="17" />
            </button>

            <div class="insight-tabs">
              <button type="button" :class="{ active: insightTab === 'action' }" @click="insightTab = 'action'">建议</button>
              <button type="button" :class="{ active: insightTab === 'evidence' }" @click="insightTab = 'evidence'">解释</button>
              <button type="button" :class="{ active: insightTab === 'service' }" @click="insightTab = 'service'">服务</button>
            </div>

            <div class="insight-list">
              <template v-if="insightTab === 'action'">
                <div v-for="(action, index) in selectedActions" :key="action"><span>{{ index + 1 }}</span><p>{{ action }}</p></div>
              </template>
              <template v-else-if="insightTab === 'evidence'">
                <div v-for="item in selectedEvidence" :key="item"><FileCheck2 :size="15" /><p>{{ item }}</p></div>
              </template>
              <template v-else>
                <div v-for="service in selectedServices" :key="service"><CircleCheck :size="15" /><p>{{ service }}</p></div>
              </template>
            </div>

            <div class="model-note">
              <BrainCircuit :size="17" />
              <div><strong>兴趣模型 × 风险模型</strong><span>{{ modelNote }}</span></div>
            </div>
          </aside>

          <section class="route-strip glass-panel" aria-label="动态行程">
            <div class="strip-title">
              <div><small>动态行程</small><strong>{{ routeSummary }}</strong></div>
              <span>点击点位查看证据</span>
            </div>
            <div class="route-cards">
              <button
                v-for="(site, index) in routeSites"
                :key="site.id"
                type="button"
                :class="{ active: selectedId === site.id }"
                @click="selectSite(site.id)"
              >
                <img :src="imageFor(site, index)" :alt="site.shortName || site.name" />
                <span class="sequence">{{ index + 1 }}</span>
                <div>
                  <strong>{{ compactName(site.shortName || site.name) }}</strong>
                  <small>{{ site.city }} · {{ site.county || '景区点位' }}</small>
                </div>
                <em :class="riskClass(site.riskScore)">{{ site.riskScore }}</em>
              </button>
            </div>
          </section>
        </section>

        <section v-else-if="activeView === 'risk'" key="risk" class="detail-view risk-view">
          <div class="page-intro">
            <div><small>风险研判</small><h2>从预警到处置的可解释闭环</h2><p>每一个风险分都有来源、动作与应急资源，不输出无法追溯的黑盒结论。</p></div>
            <button type="button" @click="activeView = 'command'"><MapPinned :size="16" /> 返回态势图</button>
          </div>

          <div class="risk-layout">
            <section class="risk-queue surface">
              <header><span>路线风险队列</span><b>{{ sortedRiskSites.length }} 个点位</b></header>
              <button
                v-for="site in sortedRiskSites"
                :key="site.id"
                type="button"
                :class="{ active: selectedId === site.id }"
                @click="selectSite(site.id)"
              >
                <i :class="riskClass(site.riskScore)">{{ site.riskScore }}</i>
                <span><strong>{{ site.shortName || site.name }}</strong><small>{{ site.city }} · {{ site.primaryRisk }}</small></span>
                <ChevronRight :size="16" />
              </button>
            </section>

            <section class="risk-evidence surface">
              <header>
                <div><small>当前点位</small><h3>{{ selectedSite?.name }}</h3></div>
                <span :class="riskClass(selectedSite?.riskScore || 0)">{{ selectedSite?.riskScore }} 分 · {{ riskLabel(selectedSite?.riskScore) }}</span>
              </header>
              <div class="evidence-hero">
                <img :src="imageFor(selectedSite, selectedIndex)" :alt="selectedSite?.name" />
                <div><span>{{ selectedSite?.city }} · {{ selectedSite?.county }}</span><strong>{{ selectedSite?.primaryRisk }}</strong><p>{{ selectedSite?.address || '贵州省山地旅游重点点位' }}</p></div>
              </div>
              <div class="evidence-columns">
                <div><h4><FileCheck2 :size="16" /> 风险证据</h4><p v-for="item in selectedEvidence" :key="item">{{ item }}</p></div>
                <div><h4><ShieldCheck :size="16" /> 建议动作</h4><p v-for="item in selectedActions" :key="item">{{ item }}</p></div>
              </div>
              <div class="factor-panel">
                <h4><BrainCircuit :size="16" /> 风险因子贡献</h4>
                <div v-for="factor in riskFactors" :key="factor.label">
                  <span>{{ factor.label }}</span>
                  <i><b :style="{ width: `${factor.value}%` }"></b></i>
                  <em>{{ factor.value }}</em>
                </div>
              </div>
            </section>

            <section class="response-track surface">
              <header><span>应急服务链</span><b>{{ Math.round(selectedSite?.serviceCoverage || 0) }}% 覆盖</b></header>
              <div v-for="(service, index) in selectedServices" :key="service" class="response-step">
                <span>{{ index + 1 }}</span>
                <div><strong>{{ service }}</strong><small>{{ index === 0 ? '游客侧即时触达' : index === 1 ? '景区侧联动响应' : '属地资源兜底' }}</small></div>
                <CircleCheck :size="17" />
              </div>
              <div class="response-log">
                <h4>决策联动记录</h4>
                <p><span>09:32</span>游客侧已生成分级预警</p>
                <p><span>09:32</span>最近服务点完成路线绑定</p>
                <p><span>09:33</span>备选点位已进入动态监测</p>
              </div>
              <div class="response-score">
                <svg viewBox="0 0 100 55"><path d="M8 48 A42 42 0 0 1 92 48" /><path class="value" d="M8 48 A42 42 0 0 1 92 48" :style="{ '--coverage': `${selectedSite?.serviceCoverage || 0}` }" /></svg>
                <strong>{{ Math.round(selectedSite?.serviceCoverage || 0) }}%</strong>
                <span>应急服务可达</span>
              </div>
            </section>
          </div>
        </section>

        <section v-else key="resources" class="detail-view resource-view">
          <div class="page-intro">
            <div><small>公共数据底座</small><h2>贵州山地文旅资源一张表</h2><p>统一检索景区 POI、热度、评分与服务信息，为兴趣召回和风险决策提供可追溯输入。</p></div>
            <div class="resource-kpis"><span><b>{{ integration.scenicTotal || scenicSpots.length }}</b> 景区点位</span><span><b>{{ integration.cityCount || 9 }}</b> 市州覆盖</span><span><b>{{ integration.holidayRecords || 0 }}</b> 假日样本</span></div>
          </div>

          <div class="resource-layout">
            <section class="resource-list surface">
              <header>
                <label><Search :size="17" /><input v-model.trim="resourceQuery" type="search" placeholder="搜索景区、城市或区县" /></label>
                <span>{{ filteredScenic.length }} 条结果</span>
              </header>
              <div class="resource-table">
                <div class="table-head"><span>景区资源</span><span>区域</span><span>评分</span><span>热度</span><span>数据状态</span></div>
                <button v-for="spot in filteredScenic.slice(0, 18)" :key="spot.id" type="button" :class="{ active: selectedScenicId === spot.id }" @click="selectedScenicId = spot.id">
                  <span><MapPin :size="15" /><b>{{ spot.name }}</b></span>
                  <span>{{ normalizeCity(spot.city) }} · {{ spot.district || '景区' }}</span>
                  <span>{{ spot.rating || '—' }}</span>
                  <span><i :style="{ width: `${Math.min(100, spot.holidayHeatSeed || 55)}%` }"></i>{{ spot.holidayHeatSeed || 55 }}</span>
                  <span><CircleCheck :size="14" /> 已接入</span>
                </button>
              </div>
            </section>

            <aside class="resource-detail surface">
              <img :src="imageFor(selectedScenic, 0)" :alt="selectedScenic?.name" />
              <div class="resource-copy">
                <small>{{ normalizeCity(selectedScenic?.city) }} · {{ selectedScenic?.district }}</small>
                <h3>{{ selectedScenic?.name || '贵州景区资源' }}</h3>
                <p>{{ selectedScenic?.address || '已纳入贵州山地文旅资源底座' }}</p>
              </div>
              <dl>
                <div><dt>景区评分</dt><dd>{{ selectedScenic?.rating || '—' }}</dd></div>
                <div><dt>假日热度</dt><dd>{{ selectedScenic?.holidayHeatSeed || 55 }}</dd></div>
                <div><dt>数据来源</dt><dd>高德 POI</dd></div>
              </dl>
              <div class="data-lineage">
                <h4><Database :size="16" /> 决策使用链路</h4>
                <span>景区 POI</span><ChevronRight :size="14" /><span>兴趣召回</span><ChevronRight :size="14" /><span>风险校准</span><ChevronRight :size="14" /><span>路线输出</span>
              </div>
            </aside>
          </div>
        </section>
      </Transition>
    </main>

    <Transition name="toast">
      <div v-if="toastMessage" class="toast-message"><CircleCheck :size="17" /> {{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, markRaw, onMounted, reactive, ref } from 'vue';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CloudRain,
  Compass,
  Database,
  FileCheck2,
  Layers3,
  LoaderCircle,
  MapPinned,
  MapPin,
  Play,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from '@lucide/vue';
import reliefMap from './assets/guizhou-relief-map.png';
import huangguoshuImage from './assets/scenic/huangguoshu.webp';
import liboImage from './assets/scenic/libo.webp';
import qingyanImage from './assets/scenic/qingyan.webp';
import xijiangImage from './assets/scenic/xijiang.webp';
import fanjingshanImage from './assets/scenic/fanjingshan.webp';
import zhijinImage from './assets/scenic/zhijin.webp';
import wanfenglinImage from './assets/scenic/wanfenglin.webp';

const navigation = [
  { id: 'command', label: '决策总览', icon: markRaw(MapPinned) },
  { id: 'risk', label: '风险研判', icon: markRaw(ShieldCheck) },
  { id: 'resources', label: '资源底座', icon: markRaw(Database) },
];

const decisionChain = [
  { label: '需求识别', icon: markRaw(Users), at: 12 },
  { label: '兴趣建模', icon: markRaw(Sparkles), at: 32 },
  { label: '风险融合', icon: markRaw(BrainCircuit), at: 58 },
  { label: '决策输出', icon: markRaw(Route), at: 84 },
];

const mapModes = [
  { id: 'route', label: '路线', icon: markRaw(Route) },
  { id: 'risk', label: '风险', icon: markRaw(AlertTriangle) },
  { id: 'service', label: '服务', icon: markRaw(Layers3) },
];

const scenarios = [
  {
    id: 'family',
    label: '亲子雨天',
    form: { request: '带父母和孩子去贵州玩两天，不想太累，担心下雨路滑，希望路线安全、有休息点和应急服务。', travelerType: 'family', weather: 'rain', days: 2, preference: 'safe', intensity: 42 },
  },
  {
    id: 'study',
    label: '研学团队',
    form: { request: '30 人研学团队在贵州安排三天，希望突出地质和民族文化，集合点清晰并避开拥堵时段。', travelerType: 'study', weather: 'clear', days: 3, preference: 'culture', intensity: 58 },
  },
  {
    id: 'senior',
    label: '康养慢游',
    form: { request: '带老人到贵州康养慢游三天，少爬坡、医疗可达，大雾时需要自动给出备选方案。', travelerType: 'senior', weather: 'fog', days: 3, preference: 'lowload', intensity: 32 },
  },
  {
    id: 'nature',
    label: '山地探索',
    form: { request: '两天体验贵州山地自然景观，可以有适度强度，但要避开高风险路段并解释推荐原因。', travelerType: 'family', weather: 'clear', days: 2, preference: 'nature', intensity: 66 },
  },
];

const fallbackSites = [
  { id: 'gy_qingyan', name: '青岩古镇南街片区', shortName: '青岩古镇', city: '贵阳', county: '花溪', riskScore: 52, serviceCoverage: 91, slope: 6, distance: '1.6 km', primaryRisk: '街巷拥堵与雨天石板路湿滑', actions: ['避开午餐高峰进入主街', '老人同行优先南门停车', '绑定社区卫生服务点'], evidence: ['石板街在降雨情境下湿滑风险上调', '近郊交通可达性较好', '餐饮集中时段人流密度较高'], services: ['古镇游客中心', '社区卫生服务点', '派出所联络点'] },
  { id: 'gy_tianhetan', name: '天河潭旅游度假区', shortName: '天河潭', city: '贵阳', county: '花溪', riskScore: 58, serviceCoverage: 88, slope: 10, distance: '2.3 km', primaryRisk: '亲水步道湿滑', actions: ['雨天缩短亲水步道停留', '优先使用观光车接驳', '设置儿童集合提醒'], evidence: ['亲水步道受降雨影响明显', '景区换乘能力较完整', '亲子兴趣匹配度较高'], services: ['游客服务中心', '观光车站', '景区医务点'] },
  { id: 'as_jiuzhou', name: '旧州古镇', shortName: '旧州古镇', city: '安顺', county: '西秀', riskScore: 49, serviceCoverage: 86, slope: 7, distance: '1.8 km', primaryRisk: '街巷承载与雨天路滑', actions: ['安排在午后低峰时段', '保留室内文化体验备选', '核验停车与接驳状态'], evidence: ['古镇街巷坡度较低', '雨天石板路需要防滑提醒', '服务点覆盖处于可控区间'], services: ['古镇服务站', '属地卫生院', '停车换乘点'] },
  { id: 'bj_zhijin', name: '织金洞游客中心片区', shortName: '织金洞', city: '毕节', county: '织金', riskScore: 67, serviceCoverage: 82, slope: 12, distance: '2.8 km', primaryRisk: '洞穴温差与步道通行', actions: ['提示携带外套与防滑鞋', '按家庭分组进入洞穴', '预留返程缓冲时间'], evidence: ['洞穴内外温差明显', '步道湿度较高', '节假日入口存在排队峰值'], services: ['游客中心', '景区医务室', '讲解集合点'] },
  { id: 'as_huangguoshu', name: '黄果树游客集散中心', shortName: '黄果树', city: '安顺', county: '镇宁', riskScore: 72, serviceCoverage: 93, slope: 18, distance: '3.1 km', primaryRisk: '瀑布步道湿滑与客流聚集', actions: ['优先安排上午入园', '选择低坡度环线', '开启防滑与换乘提醒'], evidence: ['瀑布步道受降雨影响显著', '10:00 至 13:00 为客流峰值', '换乘和医疗服务覆盖较完整'], services: ['游客中心医务室', '景区换乘站', '交警执勤点'] },
  { id: 'gy_qianling', name: '黔灵山公园', shortName: '黔灵山', city: '贵阳', county: '云岩', riskScore: 55, serviceCoverage: 89, slope: 13, distance: '2.1 km', primaryRisk: '坡道强度与局部拥堵', actions: ['使用缓坡入园路线', '避开主要入口高峰', '绑定最近医务服务点'], evidence: ['公园坡道对老人儿童有一定影响', '城市交通可达性较高', '服务设施覆盖稳定'], services: ['游客服务中心', '公园医务点', '公共交通换乘站'] },
];

const form = reactive({ ...scenarios[0].form });
const integration = reactive({ health: 'checking', remote: false, scenicTotal: 2017, cityCount: 9, holidayRecords: 3 });
const backend = reactive({ route: null, emergency: null, lineage: null, ascend: null, explanation: null, error: '' });
const activeView = ref('command');
const activeScenario = ref('family');
const mapMode = ref('route');
const insightTab = ref('action');
const selectedId = ref(fallbackSites[0].id);
const selectedScenicId = ref('');
const scenicSpots = ref([]);
const resourceQuery = ref('');
const generating = ref(false);
const progress = ref(0);
const routeVersion = ref(0);
const toastMessage = ref('');

const routeSites = computed(() => backend.route?.sites?.length ? backend.route.sites : fallbackSites);
const metrics = computed(() => backend.route?.metrics || {
  siteCount: routeSites.value.length,
  candidatePool: integration.scenicTotal,
  averageRisk: Math.round(routeSites.value.reduce((sum, site) => sum + Number(site.riskScore || 0), 0) / routeSites.value.length),
  serviceCoverage: Math.round(routeSites.value.reduce((sum, site) => sum + Number(site.serviceCoverage || 0), 0) / routeSites.value.length),
});
const selectedSite = computed(() => routeSites.value.find(site => site.id === selectedId.value) || routeSites.value[0]);
const selectedIndex = computed(() => Math.max(0, routeSites.value.findIndex(site => site.id === selectedId.value)));
const sortedRiskSites = computed(() => [...routeSites.value].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0)));
const selectedActions = computed(() => backend.explanation?.suggestedActions?.length ? backend.explanation.suggestedActions.slice(0, 4) : (selectedSite.value?.actions || []).slice(0, 4));
const selectedEvidence = computed(() => backend.explanation?.evidence?.length ? backend.explanation.evidence.slice(0, 4).map(item => item.explanation ? `${item.name}：${item.explanation}` : String(item)) : (selectedSite.value?.evidence || []).slice(0, 4));
const selectedServices = computed(() => backend.explanation?.emergencyServices?.length ? backend.explanation.emergencyServices.slice(0, 4) : (selectedSite.value?.services || ['景区游客服务点', '属地医疗急救资源', '停车或换乘服务']).slice(0, 4));
const routeTitle = computed(() => {
  const first = routeSites.value[0];
  const last = routeSites.value.at(-1);
  return first && last
    ? `${compactName(first.name || first.shortName)}至${compactName(last.name || last.shortName)} · ${form.days} 天安全线`
    : '贵阳至安顺 · 2 天亲子安全线';
});
const routeSummary = computed(() => `${form.days} 天 · ${routeSites.value.length} 个点位 · ${new Set(routeSites.value.map(site => site.city)).size} 个区域`);
const confidence = computed(() => Math.min(96, 82 + Math.round((metrics.value.serviceCoverage || 0) * 0.12)));
const serviceLabel = computed(() => integration.health === 'ok' ? 'AI 决策服务在线' : integration.health === 'error' ? '离线演示可用' : '正在连接服务');
const aiStateLabel = computed(() => generating.value ? '正在生成决策' : backend.error ? '规则兜底已启用' : '路线已生成');
const modelNote = computed(() => integration.remote ? '昇腾推理服务在线，结果已完成风险规则校准' : '本地规则引擎运行，已预留昇腾推理服务契约');
const inferenceLabel = computed(() => {
  if (progress < 28) return '解析游客画像与自然语言需求';
  if (progress < 52) return '从贵州景区库召回兴趣点位';
  if (progress < 78) return '融合天气、坡度与服务覆盖';
  return '生成可解释路线与处置建议';
});

const displayPoints = computed(() => {
  const route = routeSites.value;
  const wave = [57, 46, 53, 39, 47, 34, 43, 31, 39, 28, 36, 25];
  const start = 28;
  const end = 72;
  return route.map((site, index) => ({
    site,
    index,
    x: route.length === 1 ? 50 : start + (end - start) * index / (route.length - 1),
    y: wave[index] || 44,
  }));
});

const routePath = computed(() => smoothPath(displayPoints.value));
const filteredScenic = computed(() => {
  const query = resourceQuery.value.toLowerCase();
  if (!query) return scenicSpots.value;
  return scenicSpots.value.filter(spot => `${spot.name}${spot.city}${spot.district}${spot.address}`.toLowerCase().includes(query));
});
const selectedScenic = computed(() => scenicSpots.value.find(spot => spot.id === selectedScenicId.value) || scenicSpots.value[0] || null);
const riskFactors = computed(() => {
  const site = selectedSite.value || {};
  const weather = form.weather === 'rain' ? 78 : form.weather === 'fog' ? 84 : form.weather === 'heat' ? 72 : 34;
  return [
    { label: '天气', value: weather },
    { label: '坡度', value: Math.min(96, 28 + Number(site.slope || 8) * 2.4) },
    { label: '客流', value: Math.min(95, Number(site.crowdScore || site.congestionBase || 58)) },
    { label: '人群', value: form.travelerType === 'senior' ? 82 : form.travelerType === 'family' ? 68 : 54 },
    { label: '服务缺口', value: Math.max(8, 100 - Number(site.serviceCoverage || 82)) },
  ].map(item => ({ ...item, value: Math.round(item.value) }));
});

function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function compactName(value = '') {
  return String(value)
    .replace(/游客集散中心|游客中心片区|旅游度假区|旅游景区|风景名胜区|风景区|景区|历史文化|文化旅游区|文化屋|化屋|公园/g, '')
    .trim()
    .slice(0, 9) || String(value).slice(0, 9);
}

function normalizeCity(value = '') {
  return String(value).replace(/苗族侗族自治州|布依族苗族自治州|布依族苗族自治州|市$/g, '').replace('黔东南', '黔东南').replace('黔南', '黔南');
}

function riskClass(score = 0) {
  if (Number(score) >= 75) return 'risk-high';
  if (Number(score) >= 58) return 'risk-medium';
  return 'risk-low';
}

function riskLabel(score = 0) {
  if (Number(score) >= 75) return '较高风险';
  if (Number(score) >= 58) return '中风险';
  return '低风险';
}

function imageFor(site, index = 0) {
  const name = `${site?.name || ''}${site?.shortName || ''}`;
  if (/黄果树|瀑布/.test(name)) return huangguoshuImage;
  if (/荔波|小七孔|湿地|湖|河/.test(name)) return liboImage;
  if (/青岩|古镇|古城|会址/.test(name)) return qingyanImage;
  if (/西江|苗寨|侗寨/.test(name)) return xijiangImage;
  if (/梵净|山|森林/.test(name)) return fanjingshanImage;
  if (/织金|洞/.test(name)) return zhijinImage;
  if (/峰|田园|草原/.test(name)) return wanfenglinImage;
  return [qingyanImage, liboImage, huangguoshuImage, wanfenglinImage, fanjingshanImage, zhijinImage][index % 6];
}

function requestPayload() {
  return {
    request: form.request,
    travelerType: form.travelerType,
    weather: form.weather,
    days: Number(form.days),
    preference: form.preference,
    intensity: Number(form.intensity),
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { 'content-type': 'application/json' }, ...options });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function refreshIntegration() {
  try {
    const [health, summary, holiday, ascend] = await Promise.all([
      fetchJson('/api/health'),
      fetchJson('/api/scenic-spots/summary').catch(() => null),
      fetchJson('/api/holiday-tourism').catch(() => null),
      fetchJson('/api/tourism/ascend-readiness').catch(() => null),
    ]);
    integration.health = health?.ok ? 'ok' : 'error';
    integration.scenicTotal = summary?.total || integration.scenicTotal;
    integration.cityCount = summary?.cityCounts?.length || integration.cityCount;
    integration.holidayRecords = holiday?.records?.length || integration.holidayRecords;
    integration.remote = Boolean(ascend?.endpointConfigured) || /remote|ascend/i.test(ascend?.status || '');
    backend.ascend = ascend;
  } catch (error) {
    integration.health = 'error';
    backend.error = error.message;
  }
}

async function loadScenicSpots() {
  try {
    const payload = await fetchJson('/api/scenic-spots?limit=300');
    scenicSpots.value = payload.spots || [];
    selectedScenicId.value = scenicSpots.value[0]?.id || '';
  } catch {
    scenicSpots.value = [];
  }
}

async function selectSite(id) {
  selectedId.value = id;
  backend.explanation = null;
  try {
    const response = await fetchJson('/api/tourism/risk-explanation', {
      method: 'POST',
      body: JSON.stringify({ ...requestPayload(), siteId: id }),
    });
    if (selectedId.value === id) backend.explanation = response.explanation || null;
  } catch {
    backend.explanation = null;
  }
}

function showToast(message) {
  toastMessage.value = message;
  window.setTimeout(() => { toastMessage.value = ''; }, 2600);
}

async function generateRoute(source = 'manual') {
  if (generating.value) return;
  generating.value = true;
  progress.value = 8;
  backend.error = '';
  const timer = window.setInterval(() => { progress.value = Math.min(92, progress.value + 4 + Math.round(Math.random() * 7)); }, 190);
  try {
    await refreshIntegration();
    const payload = requestPayload();
    const [route, emergency, lineage] = await Promise.all([
      fetchJson('/api/tourism/route-plan', { method: 'POST', body: JSON.stringify(payload) }),
      fetchJson('/api/tourism/emergency-coverage', { method: 'POST', body: JSON.stringify(payload) }).catch(() => null),
      fetchJson('/api/tourism/data-lineage', { method: 'POST', body: JSON.stringify(payload) }).catch(() => null),
    ]);
    backend.route = route;
    backend.emergency = emergency?.coverage || null;
    backend.lineage = lineage?.lineage || null;
    progress.value = 100;
    selectedId.value = route.sites?.[0]?.id || selectedId.value;
    routeVersion.value += 1;
    await selectSite(selectedId.value);
    if (source !== 'initial') showToast(`已生成 ${form.days} 天个性化安全路线`);
  } catch (error) {
    backend.error = error.message;
    integration.health = 'error';
    showToast('远程服务未连接，已启用本地演示数据');
  } finally {
    window.clearInterval(timer);
    window.setTimeout(() => { generating.value = false; progress.value = 0; }, 420);
  }
}

function applyScenario(scenario) {
  activeScenario.value = scenario.id;
  Object.assign(form, scenario.form);
  generateRoute('scenario');
}

async function refreshAll() {
  await Promise.all([loadScenicSpots(), generateRoute('refresh')]);
}

onMounted(async () => {
  await Promise.all([loadScenicSpots(), generateRoute('initial')]);
});
</script>

<style>
:root {
  color-scheme: dark;
  font-family: Inter, "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #edf7f1;
  background: #06110e;
  font-synthesis: none;
}

* { box-sizing: border-box; }
button, input, textarea, select { font: inherit; }
button { color: inherit; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid #66e1bd; outline-offset: 2px; }

body { margin: 0; min-width: 320px; min-height: 100vh; overflow: hidden; background: #06110e; }

.finals-app {
  --ink: #06110e;
  --ink-2: #0a1915;
  --panel: rgba(7, 24, 19, 0.88);
  --panel-strong: rgba(5, 18, 14, 0.96);
  --line: rgba(190, 233, 214, 0.16);
  --line-strong: rgba(190, 233, 214, 0.28);
  --text: #edf7f1;
  --muted: #9fb8ad;
  --faint: #789087;
  --green: #52d88c;
  --mint: #66e1bd;
  --cyan: #54d7df;
  --amber: #f0b84b;
  --red: #ef6a64;
  min-height: 100dvh;
  background: var(--ink);
}

.rail {
  position: fixed;
  z-index: 50;
  inset: 0 auto 0 0;
  width: 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid var(--line);
  background: rgba(4, 15, 12, 0.97);
}

.brand-mark {
  width: 42px;
  height: 42px;
  margin-top: 15px;
  border: 1px solid rgba(102, 225, 189, 0.42);
  border-radius: 7px;
  color: #03241a;
  font-size: 18px;
  font-weight: 900;
  background: var(--mint);
  box-shadow: 0 0 24px rgba(102, 225, 189, 0.2);
  cursor: pointer;
}

.rail-nav { display: flex; flex: 1; flex-direction: column; gap: 12px; justify-content: center; width: 100%; }
.rail-nav button {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 64px;
  border: 0;
  color: #739087;
  background: transparent;
  cursor: pointer;
  transition: color 180ms ease, background 180ms ease;
}
.rail-nav button::before { content: ""; position: absolute; left: 0; width: 3px; height: 0; border-radius: 0 3px 3px 0; background: var(--mint); transition: height 180ms ease; }
.rail-nav button span { margin-top: 4px; font-size: 10px; }
.rail-nav button:hover, .rail-nav button.active { color: var(--text); background: rgba(102, 225, 189, 0.08); }
.rail-nav button.active::before { height: 34px; }
.rail-footer { display: grid; place-items: center; width: 46px; height: 46px; margin-bottom: 16px; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); }
.rail-footer span { position: absolute; width: 7px; height: 7px; margin: -26px 0 0 28px; border-radius: 50%; }
.online { background: #41d98a; box-shadow: 0 0 0 4px rgba(65, 217, 138, 0.1), 0 0 12px rgba(65, 217, 138, 0.65); }
.offline { background: var(--amber); }

.topbar {
  position: fixed;
  z-index: 45;
  top: 0;
  right: 0;
  left: 78px;
  height: 72px;
  display: grid;
  grid-template-columns: 330px minmax(450px, 1fr) 272px;
  align-items: center;
  gap: 24px;
  padding: 0 22px;
  border-bottom: 1px solid var(--line);
  background: rgba(5, 18, 14, 0.86);
  backdrop-filter: blur(18px) saturate(125%);
}

.product-name { display: flex; align-items: center; gap: 12px; min-width: 0; }
.product-name > div { display: grid; min-width: 0; }
.product-name strong { font-size: 18px; letter-spacing: 0; }
.product-name span { overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.product-name i { flex: none; padding: 4px 7px; border: 1px solid rgba(240, 184, 75, 0.32); border-radius: 4px; color: var(--amber); font-size: 10px; font-style: normal; background: rgba(240, 184, 75, 0.08); }

.decision-chain { display: flex; align-items: center; justify-content: center; gap: 7px; color: #577069; }
.decision-chain > div { display: flex; align-items: center; gap: 6px; font-size: 11px; transition: color 220ms ease; white-space: nowrap; }
.decision-chain > div.active { color: #cdebe0; }
.decision-chain > div.active svg { color: var(--mint); }
.decision-chain > svg { color: #40554e; }

.top-status { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.service-state { display: flex; align-items: center; gap: 9px; }
.service-state > span { width: 7px; height: 7px; border-radius: 50%; }
.service-state div { display: grid; }
.service-state strong { font-size: 11px; }
.service-state small { color: var(--muted); font-size: 10px; }
.top-status > button { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); background: rgba(255,255,255,0.03); cursor: pointer; }
.top-status > button:hover { color: var(--mint); border-color: rgba(102,225,189,0.4); }

.workspace { position: fixed; inset: 72px 0 0 78px; overflow: hidden; }
.command-view, .map-stage { position: absolute; inset: 0; }
.map-stage { overflow: hidden; background: #0d201a; }
.relief-map { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: saturate(0.78) brightness(0.72) contrast(1.08); transform: scale(1.02); }
.map-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(4,15,12,0.9) 0%, rgba(4,15,12,0.24) 27%, rgba(4,15,12,0.08) 62%, rgba(4,15,12,0.78) 100%), linear-gradient(180deg, rgba(5,18,14,0.42), transparent 28%, transparent 68%, rgba(4,15,12,0.74)); }
.map-grid { position: absolute; inset: 0; opacity: 0.16; background-image: linear-gradient(rgba(168,225,203,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,225,203,0.1) 1px, transparent 1px); background-size: 52px 52px; mask-image: linear-gradient(90deg, transparent 20%, black 35%, black 75%, transparent); }

.map-caption { position: absolute; z-index: 8; top: 19px; left: 335px; display: grid; width: 238px; gap: 2px; }
.map-caption span { color: #b5ccc3; font-size: 10px; text-transform: uppercase; }
.map-caption strong { overflow: hidden; font-size: 16px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.map-tools { position: absolute; z-index: 9; top: 17px; left: 50%; display: flex; padding: 3px; border: 1px solid var(--line); border-radius: 6px; background: rgba(4,16,12,0.68); backdrop-filter: blur(12px); transform: translateX(-50%); }
.map-tools button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 0; border-radius: 4px; color: #8fa89e; font-size: 11px; background: transparent; cursor: pointer; }
.map-tools button.active { color: #08241b; background: var(--mint); }

.place-labels span { position: absolute; z-index: 3; color: rgba(232,248,241,0.5); text-shadow: 0 2px 7px #07120f; }
.place-labels .province { top: 21%; left: 59%; font-size: 23px; font-weight: 800; }
.place-labels .city { font-size: 11px; }
.place-labels .c1 { top: 39%; left: 47%; }
.place-labels .c2 { top: 55%; left: 38%; }
.place-labels .c3 { top: 27%; left: 38%; }
.place-labels .c4 { top: 61%; left: 66%; }

.route-layer { position: absolute; z-index: 4; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.route-layer path { fill: none; vector-effect: non-scaling-stroke; }
.route-halo { stroke: rgba(77, 228, 177, 0.23); stroke-width: 10; filter: url(#route-glow); }
.route-line { stroke: rgba(234, 255, 246, 0.82); stroke-width: 3.2; }
.route-motion { stroke: var(--green); stroke-width: 1.7; stroke-linecap: round; stroke-dasharray: 2 11; animation: routeFlow 2.2s linear infinite; }

.route-pin { position: absolute; z-index: 8; width: 30px; height: 30px; margin: -15px; padding: 0; border: 0; border-radius: 50%; background: transparent; cursor: pointer; animation: pinIn 420ms both; animation-delay: var(--delay); }
.route-pin > b { position: absolute; inset: 0; display: grid; place-items: center; width: 30px; height: 30px; border: 3px solid rgba(241,255,248,0.9); border-radius: 50%; color: #042019; font-size: 12px; background: var(--green); box-shadow: 0 0 0 5px rgba(82,216,140,0.16), 0 5px 18px rgba(0,0,0,0.38); }
.route-pin.risk-medium > b { background: var(--amber); }
.route-pin.risk-high > b { background: var(--red); }
.pin-pulse { position: absolute; top: -3px; left: -3px; width: 36px; height: 36px; border: 1px solid var(--green); border-radius: 50%; animation: pulse 2.4s ease-out infinite; }
.route-pin.risk-medium .pin-pulse { border-color: var(--amber); }
.route-pin.risk-high .pin-pulse { border-color: var(--red); }
.route-pin.selected > b { transform: scale(1.16); box-shadow: 0 0 0 6px rgba(102,225,189,0.2), 0 7px 22px rgba(0,0,0,0.48); }
.route-pin.muted { opacity: 0.45; }
.pin-label { position: absolute; left: 15px; bottom: 38px; display: grid; min-width: 116px; padding: 7px 9px; border: 1px solid rgba(179,230,209,0.2); border-radius: 5px; text-align: left; background: rgba(4,18,13,0.9); box-shadow: 0 8px 22px rgba(0,0,0,0.28); backdrop-filter: blur(10px); transform: translateX(-50%); }
.pin-label.below { top: 38px; bottom: auto; }
.pin-label strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.pin-label small { color: var(--muted); font-size: 9px; white-space: nowrap; }

.map-legend { position: absolute; z-index: 7; right: 342px; bottom: 174px; display: flex; align-items: center; gap: 12px; padding: 8px 11px; border: 1px solid var(--line); border-radius: 5px; color: var(--muted); font-size: 9px; background: rgba(4,17,13,0.7); backdrop-filter: blur(10px); }
.map-legend span { display: flex; align-items: center; gap: 5px; }
.map-legend i { width: 6px; height: 6px; border-radius: 50%; }
.map-legend i.low { background: var(--green); }.map-legend i.medium { background: var(--amber); }.map-legend i.high { background: var(--red); }
.map-legend small { padding-left: 9px; border-left: 1px solid var(--line); color: #b6cbc2; }

.glass-panel { border: 1px solid var(--line); border-radius: 7px; background: var(--panel); box-shadow: 0 20px 50px rgba(0,0,0,0.28); backdrop-filter: blur(18px) saturate(120%); }
.request-panel, .insight-panel { position: absolute; z-index: 15; top: 20px; bottom: 174px; width: 298px; padding: 17px; overflow: hidden auto; }
.request-panel { left: 18px; }
.insight-panel { right: 18px; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.panel-heading > div:first-child { display: grid; gap: 2px; }
.panel-heading small { color: var(--mint); font-size: 9px; text-transform: uppercase; }
.panel-heading h2 { margin: 0; font-size: 15px; font-weight: 650; }
.panel-heading > svg { color: var(--mint); }

.scenario-switch { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; margin: 14px 0 12px; padding: 3px; border: 1px solid var(--line); border-radius: 5px; background: rgba(0,0,0,0.14); }
.scenario-switch button { min-width: 0; height: 28px; padding: 0 4px; overflow: hidden; border: 0; border-radius: 3px; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; background: transparent; cursor: pointer; }
.scenario-switch button.active { color: #07241a; background: var(--mint); }
.prompt-box { display: grid; gap: 7px; padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: rgba(1,10,7,0.35); }
.prompt-box > span, .profile-grid label > span { color: #b9cec5; font-size: 9px; }
.prompt-box textarea { width: 100%; resize: none; border: 0; outline: 0; color: var(--text); font-size: 12px; line-height: 1.62; background: transparent; }
.prompt-box small { display: flex; align-items: center; gap: 5px; color: #6f9587; font-size: 8px; }
.profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.profile-grid label { display: grid; gap: 5px; }
.profile-grid label > span { display: flex; align-items: center; gap: 5px; }
.profile-grid select { width: 100%; height: 32px; padding: 0 9px; border: 1px solid var(--line); border-radius: 4px; color: #dcebe5; font-size: 10px; background: #0a1d17; }
.intensity-control { display: grid; grid-template-columns: 1fr auto; gap: 6px; margin-top: 11px; color: var(--muted); font-size: 9px; }
.intensity-control > span { grid-column: 1 / -1; display: flex; justify-content: space-between; }
.intensity-control b { color: var(--mint); }
.intensity-control input { grid-column: 1 / -1; width: 100%; accent-color: var(--mint); }
.intensity-control small:last-child { text-align: right; }
.primary-action { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 38px; margin-top: 13px; border: 0; border-radius: 5px; color: #052118; font-size: 12px; font-weight: 750; background: var(--mint); box-shadow: 0 10px 24px rgba(102,225,189,0.14); cursor: pointer; transition: transform 160ms ease, filter 160ms ease; }
.primary-action:hover { filter: brightness(1.06); transform: translateY(-1px); }.primary-action:disabled { opacity: 0.7; cursor: wait; }

.confidence { display: grid; justify-items: end; }
.confidence span { color: var(--muted); font-size: 8px; }.confidence b { color: var(--mint); font-size: 14px; }
.metric-row { display: grid; grid-template-columns: repeat(3, 1fr); margin: 14px 0 12px; border: 1px solid var(--line); border-radius: 5px; }
.metric-row div { display: grid; justify-items: center; gap: 2px; padding: 10px 4px; }
.metric-row div + div { border-left: 1px solid var(--line); }
.metric-row strong { font-size: 17px; }.metric-row span { color: var(--muted); font-size: 8px; }
.risk-focus { position: relative; display: grid; width: 100%; gap: 3px; padding: 11px 34px 11px 11px; border: 1px solid rgba(82,216,140,0.26); border-radius: 5px; text-align: left; background: rgba(82,216,140,0.07); cursor: pointer; }
.risk-focus.risk-medium { border-color: rgba(240,184,75,0.32); background: rgba(240,184,75,0.08); }.risk-focus.risk-high { border-color: rgba(239,106,100,0.34); background: rgba(239,106,100,0.08); }
.risk-focus > span { display: flex; align-items: center; gap: 6px; color: var(--amber); font-size: 9px; }.risk-focus strong { font-size: 12px; }.risk-focus small { overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.risk-focus > svg:last-child { position: absolute; right: 11px; top: 50%; color: var(--muted); transform: translateY(-50%); }
.insight-tabs { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 12px; border-bottom: 1px solid var(--line); }
.insight-tabs button { height: 29px; border: 0; border-bottom: 2px solid transparent; color: var(--muted); font-size: 10px; background: transparent; cursor: pointer; }.insight-tabs button.active { color: var(--text); border-color: var(--mint); }
.insight-list { min-height: 118px; padding-top: 7px; }
.insight-list > div { display: grid; grid-template-columns: 20px 1fr; align-items: start; gap: 7px; padding: 6px 0; border-bottom: 1px solid rgba(190,233,214,0.08); }
.insight-list > div > span { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; color: #062219; font-size: 8px; font-weight: 800; background: var(--mint); }.insight-list svg { margin-top: 2px; color: var(--mint); }.insight-list p { margin: 0; color: #c5d8d0; font-size: 9px; line-height: 1.5; }
.model-note { display: flex; align-items: center; gap: 9px; margin-top: 9px; padding: 9px; border: 1px solid rgba(84,215,223,0.18); border-radius: 5px; background: rgba(84,215,223,0.05); }.model-note > svg { flex: none; color: var(--cyan); }.model-note div { display: grid; gap: 1px; }.model-note strong { font-size: 9px; }.model-note span { color: var(--muted); font-size: 8px; line-height: 1.4; }

.route-strip { position: absolute; z-index: 16; right: 18px; bottom: 18px; left: 18px; height: 138px; padding: 12px; }
.strip-title { display: flex; align-items: center; justify-content: space-between; height: 27px; }
.strip-title > div { display: flex; align-items: baseline; gap: 9px; }.strip-title small { color: var(--mint); font-size: 8px; }.strip-title strong { font-size: 11px; }.strip-title > span { color: var(--muted); font-size: 8px; }
.route-cards { display: flex; gap: 8px; height: 86px; overflow: auto hidden; scrollbar-width: thin; scrollbar-color: rgba(102,225,189,0.3) transparent; }
.route-cards button { position: relative; flex: 0 0 184px; display: grid; grid-template-columns: 62px 1fr 26px; align-items: center; gap: 8px; height: 78px; padding: 7px; border: 1px solid var(--line); border-radius: 5px; text-align: left; background: rgba(3,15,11,0.62); cursor: pointer; transition: border-color 160ms ease, background 160ms ease, transform 160ms ease; }
.route-cards button:hover, .route-cards button.active { border-color: rgba(102,225,189,0.46); background: rgba(20,57,44,0.72); transform: translateY(-1px); }
.route-cards img { width: 62px; height: 62px; border-radius: 4px; object-fit: cover; filter: saturate(0.85); }
.route-cards .sequence { position: absolute; top: 4px; left: 4px; display: grid; place-items: center; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.85); border-radius: 50%; color: #052118; font-size: 8px; font-weight: 900; background: var(--mint); }
.route-cards div { display: grid; min-width: 0; gap: 4px; }.route-cards strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.route-cards small { overflow: hidden; color: var(--muted); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.route-cards em { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; color: #062219; font-size: 9px; font-style: normal; font-weight: 900; background: var(--green); }.route-cards em.risk-medium { background: var(--amber); }.route-cards em.risk-high { color: white; background: var(--red); }

.inference-overlay { position: absolute; z-index: 30; inset: 0; display: grid; align-content: center; justify-items: center; gap: 9px; background: rgba(3,15,11,0.58); backdrop-filter: blur(8px); }
.inference-orbit { display: grid; place-items: center; width: 64px; height: 64px; border: 1px solid rgba(102,225,189,0.34); border-radius: 50%; color: var(--mint); background: rgba(102,225,189,0.08); box-shadow: 0 0 42px rgba(102,225,189,0.16); animation: orbitPulse 1.6s ease-in-out infinite; }
.inference-overlay strong { font-size: 14px; }.inference-overlay > span { color: var(--mint); font-size: 11px; }.inference-overlay > div:last-child { width: 260px; height: 3px; overflow: hidden; border-radius: 3px; background: rgba(255,255,255,0.12); }.inference-overlay > div:last-child i { display: block; height: 100%; background: var(--mint); box-shadow: 0 0 14px var(--mint); transition: width 160ms ease; }

.detail-view { min-height: 100%; padding: 24px 26px; overflow: auto; background: radial-gradient(circle at 70% 0%, rgba(29,91,69,0.2), transparent 34%), #07130f; }
.page-intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; min-height: 88px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.page-intro > div:first-child { display: grid; max-width: 720px; gap: 4px; }.page-intro small { color: var(--mint); font-size: 9px; text-transform: uppercase; }.page-intro h2 { margin: 0; font-size: 24px; font-weight: 650; }.page-intro p { margin: 2px 0 0; color: var(--muted); font-size: 11px; }
.page-intro > button { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 5px; color: #c8ddd4; font-size: 10px; background: rgba(255,255,255,0.03); cursor: pointer; }
.surface { border: 1px solid var(--line); border-radius: 7px; background: rgba(7,25,19,0.72); box-shadow: 0 16px 36px rgba(0,0,0,0.2); }

.risk-layout { display: grid; grid-template-columns: 280px minmax(480px, 1fr) 300px; gap: 16px; min-height: calc(100vh - 218px); margin-top: 18px; }
.surface > header { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 15px; border-bottom: 1px solid var(--line); }.surface > header span { font-size: 11px; font-weight: 650; }.surface > header b { color: var(--muted); font-size: 9px; font-weight: 500; }
.risk-queue { overflow: hidden; }.risk-queue > button { display: grid; grid-template-columns: 42px 1fr 18px; align-items: center; gap: 10px; width: 100%; min-height: 70px; padding: 9px 12px; border: 0; border-bottom: 1px solid rgba(190,233,214,0.08); text-align: left; background: transparent; cursor: pointer; }.risk-queue > button:hover, .risk-queue > button.active { background: rgba(102,225,189,0.07); }.risk-queue i { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #062219; font-size: 11px; font-style: normal; font-weight: 850; background: var(--green); }.risk-queue i.risk-medium { background: var(--amber); }.risk-queue i.risk-high { color: white; background: var(--red); }.risk-queue button > span { display: grid; min-width: 0; gap: 4px; }.risk-queue strong { font-size: 11px; }.risk-queue small { overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.risk-queue svg { color: var(--faint); }
.risk-evidence { padding-bottom: 16px; }.risk-evidence > header { min-height: 66px; }.risk-evidence header > div { display: grid; gap: 2px; }.risk-evidence header h3 { margin: 0; font-size: 15px; }.risk-evidence header > span { padding: 5px 8px; border-radius: 4px; color: #062219; background: var(--green); }.risk-evidence header > span.risk-medium { background: var(--amber); }.risk-evidence header > span.risk-high { color: white; background: var(--red); }
.evidence-hero { display: grid; grid-template-columns: 190px 1fr; gap: 16px; margin: 15px; }.evidence-hero img { width: 190px; height: 112px; border-radius: 5px; object-fit: cover; }.evidence-hero div { display: grid; align-content: center; gap: 7px; }.evidence-hero span { color: var(--mint); font-size: 9px; }.evidence-hero strong { font-size: 16px; }.evidence-hero p { margin: 0; color: var(--muted); font-size: 9px; }
.evidence-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 0 15px; border: 1px solid var(--line); border-radius: 5px; }.evidence-columns > div { padding: 13px; }.evidence-columns > div + div { border-left: 1px solid var(--line); }.evidence-columns h4 { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; color: var(--mint); font-size: 10px; }.evidence-columns p { margin: 0; padding: 7px 0; border-bottom: 1px solid rgba(190,233,214,0.08); color: #c3d6ce; font-size: 9px; line-height: 1.5; }
.factor-panel { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin: 15px; padding: 14px; border: 1px solid var(--line); border-radius: 5px; background: rgba(255,255,255,0.018); }.factor-panel h4 { grid-column: 1 / -1; display: flex; align-items: center; gap: 7px; margin: 0 0 2px; color: var(--mint); font-size: 10px; }.factor-panel > div { display: grid; grid-template-columns: 1fr auto; gap: 7px; }.factor-panel span { color: var(--muted); font-size: 8px; }.factor-panel i { grid-column: 1 / -1; grid-row: 2; height: 4px; overflow: hidden; border-radius: 4px; background: rgba(255,255,255,0.08); }.factor-panel i b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--mint), var(--amber)); }.factor-panel em { grid-column: 2; grid-row: 1; color: #d8e9e2; font-size: 9px; font-style: normal; }
.response-track { position: relative; overflow: hidden; }.response-step { display: grid; grid-template-columns: 30px 1fr 18px; align-items: center; gap: 9px; margin: 0 13px; padding: 12px 0; border-bottom: 1px solid rgba(190,233,214,0.08); }.response-step > span { display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid rgba(102,225,189,0.3); border-radius: 50%; color: var(--mint); font-size: 9px; }.response-step > div { display: grid; gap: 2px; }.response-step strong { font-size: 10px; }.response-step small { color: var(--muted); font-size: 8px; }.response-step > svg { color: var(--green); }
.response-log { margin: 14px 13px 0; padding-top: 12px; border-top: 1px solid var(--line); }.response-log h4 { margin: 0 0 7px; color: var(--mint); font-size: 9px; }.response-log p { display: flex; gap: 9px; margin: 0; padding: 5px 0; color: #bfd2ca; font-size: 8px; }.response-log p span { color: var(--faint); font-variant-numeric: tabular-nums; }
.response-score { position: relative; display: grid; justify-items: center; margin-top: 18px; }.response-score svg { width: 150px; height: 84px; overflow: visible; }.response-score path { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 7; stroke-linecap: round; }.response-score path.value { stroke: var(--mint); stroke-dasharray: calc(var(--coverage) * 1.32) 132; }.response-score strong { position: absolute; top: 38px; font-size: 22px; }.response-score span { margin-top: -18px; color: var(--muted); font-size: 9px; }

.resource-kpis { display: flex; gap: 8px; }.resource-kpis span { display: grid; min-width: 96px; padding: 8px 10px; border-left: 1px solid var(--line); color: var(--muted); font-size: 9px; }.resource-kpis b { color: var(--text); font-size: 18px; }
.resource-layout { display: grid; grid-template-columns: minmax(650px, 1fr) 330px; gap: 16px; min-height: calc(100vh - 218px); margin-top: 18px; }.resource-list { overflow: hidden; }.resource-list > header { gap: 16px; }.resource-list header label { display: flex; flex: 1; align-items: center; gap: 8px; }.resource-list header input { flex: 1; border: 0; outline: 0; color: var(--text); background: transparent; }.resource-list header > span { color: var(--muted); font-size: 9px; }
.resource-table { width: 100%; }.table-head, .resource-table > button { display: grid; grid-template-columns: minmax(220px, 1.5fr) minmax(160px, 1fr) 70px 110px 90px; align-items: center; gap: 12px; width: 100%; min-height: 45px; padding: 0 14px; border: 0; border-bottom: 1px solid rgba(190,233,214,0.08); text-align: left; }.table-head { color: var(--muted); font-size: 8px; background: rgba(255,255,255,0.025); }.resource-table > button { color: #c7d9d1; font-size: 9px; background: transparent; cursor: pointer; }.resource-table > button:hover, .resource-table > button.active { background: rgba(102,225,189,0.07); }.resource-table button > span:first-child { display: flex; align-items: center; gap: 7px; min-width: 0; }.resource-table b { overflow: hidden; color: var(--text); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.resource-table button > span:nth-child(4) { display: grid; grid-template-columns: 54px auto; align-items: center; gap: 6px; }.resource-table button > span:nth-child(4)::before { content: ""; grid-row: 1; grid-column: 1; height: 3px; border-radius: 3px; background: rgba(255,255,255,0.08); }.resource-table button > span:nth-child(4) i { z-index: 1; grid-row: 1; grid-column: 1; height: 3px; border-radius: 3px; background: var(--amber); }.resource-table button > span:last-child { display: flex; align-items: center; gap: 5px; color: var(--green); }
.resource-detail { overflow: hidden; }.resource-detail > img { width: 100%; height: 190px; object-fit: cover; filter: saturate(0.8); }.resource-copy { display: grid; gap: 6px; padding: 15px; }.resource-copy small { color: var(--mint); font-size: 9px; }.resource-copy h3 { margin: 0; font-size: 17px; }.resource-copy p { margin: 0; color: var(--muted); font-size: 9px; line-height: 1.55; }.resource-detail dl { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0 15px; border: 1px solid var(--line); border-radius: 5px; }.resource-detail dl div { display: grid; justify-items: center; gap: 4px; padding: 11px 4px; }.resource-detail dl div + div { border-left: 1px solid var(--line); }.resource-detail dt { color: var(--muted); font-size: 8px; }.resource-detail dd { margin: 0; font-size: 12px; font-weight: 700; }.data-lineage { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 15px; padding-top: 13px; border-top: 1px solid var(--line); }.data-lineage h4 { display: flex; flex: 0 0 100%; align-items: center; gap: 6px; margin: 0 0 4px; color: var(--mint); font-size: 10px; }.data-lineage span { padding: 5px 6px; border: 1px solid var(--line); border-radius: 3px; color: #bdd1c8; font-size: 8px; }

.toast-message { position: fixed; z-index: 80; right: 24px; bottom: 20px; display: flex; align-items: center; gap: 8px; padding: 11px 14px; border: 1px solid rgba(102,225,189,0.32); border-radius: 5px; color: #dff5eb; font-size: 11px; background: rgba(7,28,21,0.94); box-shadow: 0 12px 30px rgba(0,0,0,0.34); }.toast-message svg { color: var(--green); }

.view-fade-enter-active, .view-fade-leave-active { transition: opacity 180ms ease, transform 180ms ease; }.view-fade-enter-from { opacity: 0; transform: translateY(6px); }.view-fade-leave-to { opacity: 0; transform: translateY(-4px); }.toast-enter-active, .toast-leave-active { transition: opacity 180ms ease, transform 180ms ease; }.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(8px); }
.spin { animation: spin 1s linear infinite; }

@keyframes routeFlow { to { stroke-dashoffset: -26; } }
@keyframes pulse { 0% { opacity: 0.7; transform: scale(0.6); } 75%, 100% { opacity: 0; transform: scale(1.8); } }
@keyframes pinIn { from { opacity: 0; transform: translateY(10px) scale(0.8); } to { opacity: 1; transform: none; } }
@keyframes orbitPulse { 50% { transform: scale(1.08); box-shadow: 0 0 62px rgba(102,225,189,0.28); } }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1260px) {
  .topbar { grid-template-columns: 290px 1fr 240px; gap: 14px; }
  .decision-chain > div span { display: none; }
  .request-panel, .insight-panel { width: 272px; }
  .map-caption { left: 306px; }
  .map-legend { right: 314px; }
  .risk-layout { grid-template-columns: 240px minmax(430px, 1fr) 260px; }
}

@media (max-height: 780px) {
  .topbar { height: 64px; }.workspace { top: 64px; }
  .request-panel, .insight-panel { top: 14px; bottom: 148px; padding: 13px; }
  .route-strip { right: 14px; bottom: 12px; left: 14px; height: 126px; padding: 9px; }
  .route-cards { height: 76px; }.route-cards button { height: 70px; }.route-cards img { width: 54px; height: 54px; }
  .map-legend { bottom: 149px; }
  .scenario-switch { margin: 9px 0; }.prompt-box { padding: 8px; }.prompt-box textarea { line-height: 1.45; }
  .profile-grid { gap: 6px; margin-top: 7px; }.profile-grid select { height: 28px; }.intensity-control { margin-top: 7px; }.primary-action { height: 34px; margin-top: 8px; }
  .metric-row { margin: 9px 0; }.metric-row div { padding: 7px 4px; }.insight-tabs { margin-top: 8px; }.insight-list { min-height: 90px; }.insight-list > div { padding: 4px 0; }.model-note { margin-top: 5px; padding: 7px; }
}

@media (max-width: 900px) {
  body { overflow: auto; }
  .rail { width: 58px; }.topbar { left: 58px; grid-template-columns: 1fr auto; }.decision-chain { display: none; }.product-name span { display: none; }.workspace { position: relative; inset: auto; min-height: 100vh; margin: 72px 0 0 58px; overflow: visible; }
  .command-view, .map-stage { position: relative; }.command-view { display: grid; gap: 12px; padding: 12px; }.map-stage { min-height: 520px; border-radius: 7px; }.request-panel, .insight-panel, .route-strip { position: relative; inset: auto; width: auto; height: auto; max-height: none; }.request-panel { grid-row: 2; }.insight-panel { grid-row: 3; }.route-strip { grid-row: 4; }.map-caption { left: 16px; }.map-tools { right: 14px; left: auto; transform: none; }.route-pin { display: none; }.map-legend { right: 14px; bottom: 14px; left: 14px; justify-content: center; }.map-legend small { display: none; }
  .detail-view { padding: 16px; }.risk-layout, .resource-layout { grid-template-columns: 1fr; }.risk-layout { min-height: auto; }.response-track { min-height: 420px; }.page-intro { align-items: flex-start; flex-direction: column; }.resource-kpis { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
</style>
