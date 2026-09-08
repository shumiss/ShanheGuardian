<template>
  <div class="ops-app">
    <aside class="sidebar">
      <a class="brand" href="/">
        <span>黔</span>
        <div><strong>黔行守护</strong><small>文旅安全决策平台</small></div>
      </a>
      <nav aria-label="管理端工作区">
        <button v-for="item in nav" :key="item.id" type="button" :class="{ active: view === item.id }" @click="switchView(item.id)">
          <component :is="item.icon" :size="18" :stroke-width="1.7" />
          <span><b>{{ item.label }}</b><small>{{ item.caption }}</small></span>
        </button>
      </nav>
      <div class="side-status">
        <i :class="integration.health"></i>
        <span><b>{{ healthLabel }}</b><small>{{ integration.remote ? "远程昇腾推理" : "本地规则模型" }}</small></span>
      </div>
    </aside>

    <header class="topbar">
      <div><small>{{ currentNav.caption }}</small><strong>{{ currentNav.title }}</strong></div>
      <div class="chain">
        <template v-for="(step, index) in decisionChain" :key="step">
          <span :class="{ active: chainStep >= index }">{{ step }}</span>
          <ChevronRight v-if="index < decisionChain.length - 1" :size="13" />
        </template>
      </div>
      <div class="top-actions">
        <span v-if="weather.live?.length"><CloudSun :size="15" />贵阳 {{ weather.live[0].weather }} {{ weather.live[0].temperature }}°</span>
        <button type="button" title="刷新数据" :disabled="busy" @click="refreshAll"><RefreshCw :size="17" :class="{ spin: busy }" /></button>
      </div>
    </header>

    <main class="main">
      <Transition name="page" mode="out-in">
        <section v-if="view === 'dispatch'" key="dispatch" class="dispatch-page">
          <div class="dispatch-top">
            <section class="panel mission">
              <PanelTitle eyebrow="路线任务" title="生成可执行的安全行程"><Sparkles :size="18" /></PanelTitle>
              <div class="scenarios">
                <button v-for="scene in scenarios" :key="scene.id" type="button" :class="{ active: activeScenario === scene.id }" @click="applyScenario(scene)">{{ scene.label }}</button>
              </div>
              <label class="request">
                <span>游客自然语言需求</span>
                <textarea v-model.trim="form.request" rows="5"></textarea>
                <small>自动识别人群、天气、强度与安全约束</small>
              </label>
              <div class="field-grid">
                <label><span><Users :size="13" />游客画像</span><select v-model="form.travelerType"><option value="family">亲子家庭</option><option value="senior">老人同行</option><option value="study">研学团队</option><option value="wellness">康养慢游</option></select></label>
                <label><span><CloudRain :size="13" />天气策略</span><select v-model="form.weather"><option value="rain">小雨路滑</option><option value="clear">晴朗通行</option><option value="fog">山间大雾</option><option value="heat">高温暴晒</option></select></label>
                <label><span><CalendarDays :size="13" />行程天数</span><select v-model.number="form.days"><option v-for="day in 10" :key="day" :value="day">{{ day }} 天</option></select></label>
                <label><span><Route :size="13" />路线偏好</span><select v-model="form.preference"><option value="safe">安全优先</option><option value="lowload">低强度</option><option value="culture">民族文化</option><option value="nature">山地自然</option></select></label>
              </div>
              <label class="intensity">
                <span>路线强度 <b>{{ intensityLabel }}</b></span>
                <input v-model.number="form.intensity" type="range" min="20" max="90" step="5" />
                <small>轻松</small><small>探索</small>
              </label>
              <button class="primary" type="button" :disabled="generating" @click="generateRoute('manual')">
                <LoaderCircle v-if="generating" :size="17" class="spin" /><Play v-else :size="16" fill="currentColor" />
                {{ generating ? `决策生成中 ${progress}%` : "生成安全路线" }}
              </button>
              <p v-if="backend.error" class="error"><AlertTriangle :size="14" />{{ backend.error }}</p>
            </section>

            <section class="panel map-panel">
              <header class="map-head">
                <div><small>高德 POI 坐标 · 贵州山地态势</small><strong>{{ routeTitle }}</strong></div>
                <div class="map-tabs"><button v-for="mode in mapModes" :key="mode.id" type="button" :class="{ active: mapMode === mode.id }" @click="mapMode = mode.id">{{ mode.label }}</button></div>
              </header>
              <div class="map-stage">
                <img :src="reliefMap" alt="贵州地形底图" />
                <div class="map-shade"></div>
                <svg viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
                  <path class="route-halo" :d="routePath" /><path class="route-main" :d="routePath" /><path class="route-flow" :d="routePath" />
                </svg>
                <span v-for="city in mapCityLabels" :key="city.name" class="map-city" :style="{ left: `${city.x}%`, top: `${city.y}%` }">{{ city.name }}</span>
                <button v-for="(site, index) in routeSites" :key="`${site.id}-${routeVersion}`" type="button" class="map-pin" :class="[riskClass(site.riskScore), { active: selectedId === site.id }]" :style="pinStyle(site, index)" @click="selectSite(site.id)">
                  <b>{{ index + 1 }}</b>
                  <span><strong>{{ compactName(site.shortName || site.name) }}</strong><small v-if="mapMode === 'service'">服务 {{ Math.round(site.serviceCoverage || 0) }}%</small><small v-else-if="mapMode === 'risk'">{{ site.riskScore }} 分 · {{ riskLabel(site.riskScore) }}</small><small v-else>{{ normalizeCity(site.city) }} · 第 {{ routeDayFor(site.id) }} 天</small></span>
                </button>
                <div class="legend"><span><i class="low"></i>低风险</span><span><i class="medium"></i>中风险</span><span><i class="high"></i>较高风险</span><small>GCJ-02 坐标映射</small></div>
                <div v-if="generating" class="map-loading"><BrainCircuit :size="24" /><strong>{{ inferenceLabel }}</strong><span>{{ progress }}%</span><i><b :style="{ transform: `scaleX(${progress / 100})` }"></b></i></div>
              </div>
            </section>

            <aside class="panel summary">
              <PanelTitle eyebrow="AI 决策摘要" :title="generating ? '正在更新' : '路线已校准'"><ShieldCheck :size="18" /></PanelTitle>
              <div class="risk-focus"><span>最高风险</span><strong :class="riskClass(highestRiskSite?.riskScore)">{{ highestRiskSite?.riskScore || "--" }}</strong><p><b>{{ compactName(highestRiskSite?.shortName || highestRiskSite?.name) }}</b>{{ highestRiskSite?.primaryRisk }}</p></div>
              <div class="metrics"><span><b>{{ metrics.siteCount || routeSites.length }}</b><small>行程点</small></span><span><b>{{ metrics.averageRisk || "--" }}</b><small>平均风险</small></span><span><b>{{ metrics.serviceCoverage || "--" }}%</b><small>应急覆盖</small></span></div>
              <p class="route-summary">{{ backend.route?.summary || fallbackSummary }}</p>
              <div class="info-tabs"><button type="button" :class="{ active: insightTab === 'actions' }" @click="insightTab = 'actions'">建议</button><button type="button" :class="{ active: insightTab === 'evidence' }" @click="insightTab = 'evidence'">证据</button><button type="button" :class="{ active: insightTab === 'services' }" @click="insightTab = 'services'">服务</button></div>
              <div class="info-list"><p v-for="(item, index) in currentInsightItems" :key="item"><span>{{ index + 1 }}</span>{{ item }}</p></div>
              <button class="risk-link" type="button" @click="switchView('risk')">进入安全处置<ChevronRight :size="16" /></button>
              <div class="model-note"><Cpu :size="16" /><span><b>{{ integration.remote ? "远程昇腾推理" : "本地规则模型" }}</b>{{ modelText }}</span></div>
            </aside>
          </div>

          <section class="panel itinerary">
            <header><div><small>动态行程</small><strong>{{ routeSummary }}</strong></div><div class="day-tabs"><button v-for="day in itinerary" :key="day.day" type="button" :class="{ active: activeDay === day.day }" @click="activeDay = day.day">第 {{ day.day }} 天</button></div></header>
            <div class="route-cards">
              <button v-for="(site, index) in activeDaySites" :key="site.id" type="button" :class="{ active: selectedId === site.id }" @click="selectSite(site.id)">
                <span class="thumb"><img v-if="canShowImage(site)" :src="imageFor(site)" :alt="site.name" @error="markImageFailed(site)" /><span v-else><MapPin :size="18" />{{ normalizeCity(site.city) }}</span><i>{{ index + 1 }}</i></span>
                <span class="stop-copy"><small>{{ normalizeCity(site.city) }} · {{ site.county || "景区点位" }}</small><strong>{{ compactName(site.shortName || site.name) }}</strong><em>{{ site.primaryRisk }}</em></span>
                <span class="stop-meta"><b :class="riskClass(site.riskScore)">{{ site.riskScore }}</b><small>坡度 {{ site.slope ?? "--" }}°</small><small>服务 {{ Math.round(site.serviceCoverage || 0) }}%</small></span>
              </button>
            </div>
          </section>
        </section>

        <section v-else-if="view === 'risk'" key="risk" class="workspace-page">
          <PageHead eyebrow="安全决策闭环" title="从风险研判到现场处置" copy="每一个结论都可查看证据、分派资源、记录动作并导出处置单。">
            <button type="button" @click="switchView('dispatch')"><MapPinned :size="16" />返回路线态势</button>
          </PageHead>
          <div class="risk-grid">
            <section class="panel risk-queue">
              <header><div><small>研判队列</small><strong>{{ sortedRiskSites.length }} 个路线点位</strong></div><span>按风险排序</span></header>
              <div class="risk-filters"><button v-for="filter in riskFilters" :key="filter.id" type="button" :class="{ active: riskFilter === filter.id }" @click="riskFilter = filter.id">{{ filter.label }}</button></div>
              <div class="queue-list">
                <button v-for="site in filteredRiskSites" :key="site.id" type="button" :class="{ active: selectedId === site.id }" @click="selectSite(site.id)">
                  <i :class="riskClass(site.riskScore)">{{ site.riskScore }}</i>
                  <span><strong>{{ compactName(site.shortName || site.name) }}</strong><small>{{ normalizeCity(site.city) }} · {{ site.primaryRisk }}</small></span>
                  <em :class="`case-${caseFor(site.id).status}`">{{ caseStatusLabel(caseFor(site.id).status) }}</em>
                </button>
              </div>
            </section>

            <section class="panel dossier">
              <header><div><small>{{ normalizeCity(selectedSite?.city) }} · {{ selectedSite?.county }}</small><h2>{{ selectedSite?.name }}</h2></div><strong :class="riskClass(selectedSite?.riskScore)">{{ selectedSite?.riskScore }} 分<span>{{ riskLabel(selectedSite?.riskScore) }}</span></strong></header>
              <div class="dossier-hero">
                <div class="dossier-photo"><img v-if="canShowImage(selectedSite)" :src="imageFor(selectedSite)" :alt="selectedSite?.name" @error="markImageFailed(selectedSite)" /><span v-else><MapPin :size="22" />{{ normalizeCity(selectedSite?.city) }}</span></div>
                <div><small>核心风险</small><strong>{{ selectedExplanation?.primaryRisk || selectedSite?.primaryRisk }}</strong><p>{{ selectedExplanation?.reason || selectedSite?.address || "贵州山地旅游重点风险点位" }}</p><dl><div><dt>坡度</dt><dd>{{ selectedSite?.slope ?? "--" }}°</dd></div><div><dt>步行</dt><dd>{{ selectedSite?.distance || `${selectedSite?.distanceKm || "--"} km` }}</dd></div><div><dt>服务覆盖</dt><dd>{{ Math.round(selectedSite?.serviceCoverage || 0) }}%</dd></div></dl></div>
              </div>
              <div class="factors"><header><span>风险因子贡献</span><small>天气、地形、人群、客流与服务缺口</small></header><div v-for="factor in riskFactors" :key="factor.label"><span>{{ factor.label }}</span><i><b :style="{ transform: `scaleX(${factor.value / 100})` }"></b></i><em>{{ factor.value }}</em></div></div>
              <div class="dossier-tabs"><button type="button" :class="{ active: dossierTab === 'evidence' }" @click="dossierTab = 'evidence'">风险证据</button><button type="button" :class="{ active: dossierTab === 'actions' }" @click="dossierTab = 'actions'">建议动作</button><button type="button" :class="{ active: dossierTab === 'sources' }" @click="dossierTab = 'sources'">数据来源</button></div>
              <div class="evidence"><div v-if="explanationLoading" v-for="index in 4" :key="index" class="skeleton"></div><p v-else v-for="(item, index) in dossierItems" :key="item"><span>{{ index + 1 }}</span>{{ item }}</p></div>
            </section>

            <aside class="panel response">
              <header><div><small>处置工作台</small><strong>完成度 {{ completeness }}%</strong></div><i><b :style="{ transform: `scaleX(${completeness / 100})` }"></b></i></header>
              <div class="case-steps"><span v-for="(step, index) in caseSteps" :key="step.id" :class="{ active: caseStepIndex >= index, current: currentCase.status === step.id }"><i>{{ index + 1 }}</i>{{ step.label }}</span></div>
              <label class="assign"><span>联动资源</span><select v-model="currentCase.assignee" @change="recordAssignment"><option value="">选择处置资源</option><option v-for="service in selectedServices" :key="service" :value="service">{{ service }}</option></select><small>应急覆盖 {{ Math.round(selectedSite?.serviceCoverage || 0) }}% · {{ emergencyCoverage?.gaps?.length ? `${emergencyCoverage.gaps.length} 个覆盖缺口` : "当前无明显缺口" }}</small></label>
              <div class="checklist"><header><span>现场动作</span><small>{{ currentCase.checkedActions.length }}/{{ selectedActions.length }} 已完成</small></header><label v-for="action in selectedActions" :key="action"><input type="checkbox" :checked="currentCase.checkedActions.includes(action)" @change="toggleAction(action)" /><span><Check :size="13" />{{ action }}</span></label></div>
              <label class="case-note"><span>处置备注</span><textarea v-model.trim="currentCase.note" rows="3" placeholder="记录现场核验、人员反馈或替代方案"></textarea></label>
              <div class="case-buttons"><button type="button" :disabled="currentCase.status !== 'pending'" @click="advanceCase('confirmed')">确认风险</button><button type="button" :disabled="currentCase.status !== 'confirmed' || !currentCase.assignee" @click="advanceCase('responding')">启动处置</button><button type="button" :disabled="currentCase.status !== 'responding' || !currentCase.checkedActions.length" @click="advanceCase('closed')">完成闭环</button></div>
              <div class="audit"><header><span>审计留痕</span><button type="button" @click="exportCase"><Download :size="14" />导出处置单</button></header><p v-for="(log, index) in currentCase.logs.slice().reverse().slice(0, 5)" :key="`${log.time}-${index}`"><time>{{ log.time }}</time>{{ log.text }}</p><p v-if="!currentCase.logs.length" class="empty">等待首次处置动作</p></div>
            </aside>
          </div>
        </section>

        <section v-else-if="view === 'resources'" key="resources" class="workspace-page">
          <PageHead eyebrow="贵州文旅数据底座" title="全省景区资源库" copy="统一检索真实 POI、经纬度、评分、假日热度与图片来源。">
            <div class="page-kpis"><span><b>{{ integration.scenicTotal }}</b>景区 POI</span><span><b>{{ cityOptions.length }}</b>市州覆盖</span><span><b>{{ integration.holidayRecords }}</b>假日样本</span></div>
          </PageHead>
          <div class="resource-grid">
            <section class="panel resource-table-panel">
              <header class="resource-tools">
                <label><Search :size="16" /><input v-model.trim="resourceQuery" type="search" placeholder="搜索景区、城市、区县或地址" /><button v-if="resourceQuery" type="button" @click="resourceQuery = ''"><X :size="14" /></button></label>
                <select v-model="cityFilter"><option value="">全部市州</option><option v-for="city in cityOptions" :key="city" :value="city">{{ city }}</option></select>
                <span>{{ filteredScenic.length }} 条结果</span>
              </header>
              <div v-if="resourceLoading" class="loading-list"><i v-for="n in 10" :key="n"></i></div>
              <div v-else class="resource-table">
                <div class="table-head"><span>景区资源</span><span>区域</span><span>评分</span><span>假日热度</span><span>数据状态</span></div>
                <button v-for="spot in pagedScenic" :key="spot.id" type="button" :class="{ active: selectedScenicId === spot.id }" @click="selectedScenicId = spot.id">
                  <span><MapPin :size="14" /><b>{{ spot.name }}</b></span><span>{{ normalizeCity(spot.city) }} · {{ spot.district || "景区" }}</span><span>{{ spot.rating || "--" }}</span><span><i><b :style="{ transform: `scaleX(${(spot.holidayHeatSeed || 50) / 100})` }"></b></i>{{ spot.holidayHeatSeed || "--" }}</span><span><CircleCheck :size="14" />已接入</span>
                </button>
              </div>
              <footer><span>第 {{ resourcePage }} / {{ resourcePageCount }} 页</span><div><button type="button" :disabled="resourcePage <= 1" @click="resourcePage--"><ChevronLeft :size="15" /></button><button type="button" :disabled="resourcePage >= resourcePageCount" @click="resourcePage++"><ChevronRight :size="15" /></button></div></footer>
            </section>
            <aside class="panel resource-detail">
              <div class="resource-photo"><img v-if="canShowScenicImage(selectedScenic)" :src="scenicImageFor(selectedScenic)" :alt="selectedScenic?.name" @error="markScenicImageFailed(selectedScenic)" /><span v-else><MapPin :size="23" />暂无可核验实景图</span></div>
              <div class="resource-copy"><small>{{ normalizeCity(selectedScenic?.city) }} · {{ selectedScenic?.district }}</small><h2>{{ selectedScenic?.name || "贵州景区资源" }}</h2><p>{{ selectedScenic?.address || "已纳入贵州山地文旅资源底座" }}</p></div>
              <dl><div><dt>高德评分</dt><dd>{{ selectedScenic?.rating || "--" }}</dd></div><div><dt>假日热度</dt><dd>{{ selectedScenic?.holidayHeatSeed || "--" }}</dd></div><div><dt>经纬度</dt><dd>{{ scenicLngLat }}</dd></div></dl>
              <div class="source"><small>数据来源</small><strong>高德 Place Search 风景名胜 POI</strong><span>更新时间 {{ formatDate(integration.scenicFreshness) }}</span></div>
              <div class="resource-buttons"><button type="button" @click="planWithScenic(selectedScenic)"><Route :size="15" />加入路线任务</button><button type="button" @click="openAmap(selectedScenic)"><Navigation :size="15" />高德核验</button></div>
            </aside>
          </div>
        </section>

        <section v-else key="system" class="workspace-page">
          <PageHead eyebrow="服务与数据状态" title="运行监测中心" copy="展示真实接口、数据新鲜度、天气连接和昇腾适配位置。">
            <button type="button" :disabled="testing" @click="testServices"><Activity :size="16" :class="{ pulse: testing }" />{{ testing ? "检测中" : "运行接口检测" }}</button>
          </PageHead>
          <div class="system-grid">
            <section class="panel service-panel"><PanelTitle eyebrow="核心服务" :title="`${connectedCount}/${visibleServices.length} 可用`"><small>检测后显示延迟</small></PanelTitle><div class="service-list"><div v-for="service in visibleServices" :key="service.id"><i :class="serviceTone(service)"><Server :size="16" /></i><span><b>{{ service.name }}</b><small>{{ service.endpoint }}</small></span><em :class="serviceTone(service)">{{ serviceLabel(service) }}</em><time>{{ checks[service.id]?.latency ? `${checks[service.id].latency} ms` : "--" }}</time></div></div></section>
            <section class="panel weather-panel"><PanelTitle eyebrow="贵州九市州天气" :title="weather.status === 'live' ? '实时连接' : '等待配置'"><small>{{ weather.provider || "高德天气" }}</small></PanelTitle><div class="weather-grid"><div v-for="city in weather.live" :key="city.adcode"><span>{{ city.shortName }}</span><strong>{{ city.temperature }}°</strong><small>{{ city.weather }} · 湿度 {{ city.humidity }}%</small></div></div><footer>更新时间 {{ weather.refreshedAt ? formatDateTime(weather.refreshedAt) : "--" }}</footer></section>
            <section class="panel ascend-panel"><PanelTitle eyebrow="昇腾推理适配" :title="integration.remote ? '远程推理已连接' : '适配器已就绪'"><Cpu :size="18" /></PanelTitle><div class="ascend-chain"><template v-for="(step, index) in ascend.chain || decisionChain" :key="step"><span :class="{ active: index <= 1 || integration.remote }"><i>{{ index + 1 }}</i>{{ step }}</span><ChevronRight v-if="index < (ascend.chain || decisionChain).length - 1" :size="14" /></template></div><p>{{ ascend.demoMessage || "已预留 ASCEND_INFERENCE_URL 和输入输出契约。" }}</p><dl><div><dt>输入契约</dt><dd>{{ ascend.adapterContract?.input?.length || 6 }} 类字段</dd></div><div><dt>输出契约</dt><dd>{{ ascend.adapterContract?.output?.length || 5 }} 类结果</dd></div><div><dt>当前模式</dt><dd>{{ integration.remote ? "远程推理" : "适配器就绪" }}</dd></div></dl></section>
            <section class="panel lineage-panel"><PanelTitle eyebrow="决策数据血缘" :title="`${lineage.datasets?.length || 0} 个数据集`"><Database :size="18" /></PanelTitle><ol><li v-for="(step, index) in lineage.pipeline" :key="step.step"><span>{{ index + 1 }}</span><div><strong>{{ step.step }}</strong><small>{{ step.output }}</small></div></li></ol><p>{{ lineage.auditNote }}</p></section>
          </div>
        </section>
      </Transition>
    </main>

    <Transition name="toast"><div v-if="toast" class="toast"><CircleCheck :size="16" />{{ toast }}</div></Transition>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, markRaw, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  Activity, AlertTriangle, BrainCircuit, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck,
  CloudRain, CloudSun, Cpu, Database, Download, LoaderCircle, MapPinned, MapPin, Navigation, Play,
  RefreshCw, Route, Search, Server, ShieldCheck, Sparkles, Users, X,
} from "@lucide/vue";
import reliefMap from "./assets/guizhou-relief-map.png";
import fanjingshanImage from "./assets/scenic/fanjingshan.webp";
import huangguoshuImage from "./assets/scenic/huangguoshu.webp";
import liboImage from "./assets/scenic/libo.webp";
import qingyanImage from "./assets/scenic/qingyan.webp";
import wanfenglinImage from "./assets/scenic/wanfenglin.webp";
import xijiangImage from "./assets/scenic/xijiang.webp";
import zhijinImage from "./assets/scenic/zhijin.webp";

const PanelTitle = defineComponent({
  props: { eyebrow: String, title: String },
  setup(props, { slots }) {
    return () => h("header", { class: "panel-title" }, [
      h("div", [h("small", props.eyebrow), h("strong", props.title)]),
      slots.default?.(),
    ]);
  },
});

const PageHead = defineComponent({
  props: { eyebrow: String, title: String, copy: String },
  setup(props, { slots }) {
    return () => h("header", { class: "page-head" }, [
      h("div", [h("small", props.eyebrow), h("h1", props.title), h("p", props.copy)]),
      slots.default?.(),
    ]);
  },
});

const nav = [
  { id: "dispatch", label: "路线调度", caption: "需求到行程", title: "贵州山地安全路线调度", icon: markRaw(MapPinned) },
  { id: "risk", label: "安全处置", caption: "证据到闭环", title: "风险研判与现场处置", icon: markRaw(ShieldCheck) },
  { id: "resources", label: "景区资源", caption: "全省 POI 库", title: "贵州文旅资源数据底座", icon: markRaw(Database) },
  { id: "system", label: "服务监测", caption: "接口与模型", title: "平台运行与昇腾适配状态", icon: markRaw(Activity) },
];
const decisionChain = ["游客需求", "后端代理", "MindIE / vLLM Ascend", "风险模型", "决策输出"];
const mapModes = [{ id: "route", label: "路线" }, { id: "risk", label: "风险" }, { id: "service", label: "服务" }];
const riskFilters = [{ id: "all", label: "全部" }, { id: "attention", label: "需关注" }, { id: "open", label: "未闭环" }];
const caseSteps = [{ id: "pending", label: "待研判" }, { id: "confirmed", label: "已确认" }, { id: "responding", label: "处置中" }, { id: "closed", label: "已闭环" }];
const scenarios = [
  { id: "family", label: "亲子雨天", form: { request: "带父母和孩子去贵州玩两天，不想太累，担心下雨路滑，希望路线安全、有休息点和应急服务。", travelerType: "family", weather: "rain", days: 2, preference: "safe", intensity: 42 } },
  { id: "study", label: "研学团队", form: { request: "30 人研学团队在贵州安排三天，突出地质与民族文化，集合点清晰并避开拥堵时段。", travelerType: "study", weather: "clear", days: 3, preference: "culture", intensity: 58 } },
  { id: "senior", label: "康养慢游", form: { request: "带老人到贵州康养慢游三天，少爬坡、医疗可达，大雾时自动给出室内备选方案。", travelerType: "senior", weather: "fog", days: 3, preference: "lowload", intensity: 32 } },
  { id: "nature", label: "山地探索", form: { request: "两天体验贵州山地自然景观，可以有适度强度，但要避开高风险路段并解释推荐原因。", travelerType: "family", weather: "clear", days: 2, preference: "nature", intensity: 66 } },
];
const fallbackSites = [
  { id: "gy_qingyan", sourcePoiId: "B035300ESE", name: "青岩古镇南街片区", shortName: "青岩古镇", city: "贵阳", county: "花溪", lngLat: [106.681, 26.331], riskScore: 52, serviceCoverage: 91, slope: 6, distance: "1.6 km", crowdScore: 70, primaryRisk: "街巷拥堵与雨天石板路湿滑", actions: ["避开午餐高峰进入主街", "老人同行优先南门停车", "绑定社区卫生服务点"], evidence: ["石板街在降雨情境下湿滑风险上调", "近郊交通可达性较好", "餐饮集中时段人流密度较高"], services: ["古镇游客中心", "社区卫生服务点", "派出所联络点"], sources: ["高德 POI", "交通可达性规则", "游客画像规则"] },
  { id: "as_huangguoshu", sourcePoiId: "B0FFHCXU0K", name: "黄果树游客集散中心", shortName: "黄果树", city: "安顺", county: "镇宁", lngLat: [105.668716, 25.988506], riskScore: 72, serviceCoverage: 93, slope: 18, distance: "3.1 km", crowdScore: 88, primaryRisk: "瀑布步道湿滑与客流聚集", actions: ["优先安排上午入园", "选择低坡度环线", "开启防滑与换乘提醒"], evidence: ["瀑布步道受降雨影响显著", "10:00 至 13:00 为客流峰值", "换乘和医疗服务覆盖较完整"], services: ["游客中心医务室", "景区换乘站", "交警执勤点"], sources: ["高德景区 POI", "节假日公开样本", "山地安全规则"] },
  { id: "bj_zhijin", sourcePoiId: "B0359003K3", name: "织金洞游客中心片区", shortName: "织金洞", city: "毕节", county: "织金", lngLat: [105.883673, 26.772214], riskScore: 67, serviceCoverage: 82, slope: 12, distance: "2.8 km", crowdScore: 73, primaryRisk: "洞穴温差与步道通行", actions: ["提示携带外套与防滑鞋", "按家庭分组进入洞穴", "预留返程缓冲时间"], evidence: ["洞穴内外温差明显", "步道湿度较高", "节假日入口存在排队峰值"], services: ["游客中心", "景区医务室", "讲解集合点"], sources: ["高德景区 POI", "节假日热度样本", "洞穴安全规则"] },
  { id: "qdn_xijiang", sourcePoiId: "B03570161U", name: "西江千户苗寨", shortName: "西江苗寨", city: "黔东南", county: "雷山", lngLat: [108.173116, 26.494562], riskScore: 61, serviceCoverage: 87, slope: 14, distance: "2.4 km", crowdScore: 82, primaryRisk: "夜间台阶与核心街区拥堵", actions: ["夜间启用分组集合提醒", "避开观景台下行峰值", "绑定游客中心联络点"], evidence: ["山地村寨高差明显", "夜间照明与台阶通行需要关注", "节假日核心街区承载压力较高"], services: ["北门游客中心", "景区医务点", "摆渡车站"], sources: ["高德景区 POI", "节假日公开样本", "游客画像规则"] },
  { id: "qny_libo", sourcePoiId: "B035600C1Q", name: "荔波小七孔景区", shortName: "小七孔", city: "黔南", county: "荔波", lngLat: [107.705723, 25.252959], riskScore: 64, serviceCoverage: 88, slope: 11, distance: "3.0 km", crowdScore: 79, primaryRisk: "亲水步道湿滑与换乘排队", actions: ["雨天缩短亲水步道停留", "提前绑定观光车换乘", "设置儿童集合提醒"], evidence: ["亲水步道受降雨影响明显", "景区线路较长需要控制体力", "观光车可降低老人儿童步行负担"], services: ["东门游客中心", "景区医务点", "观光车站"], sources: ["高德景区 POI", "天气实况", "山地安全规则"] },
  { id: "tr_fanjing", sourcePoiId: "B0358001VZ", name: "梵净山风景区", shortName: "梵净山", city: "铜仁", county: "江口", lngLat: [108.720359, 27.882738], riskScore: 76, serviceCoverage: 80, slope: 22, distance: "4.1 km", crowdScore: 84, primaryRisk: "高海拔台阶、天气突变与索道排队", actions: ["核验索道与开放状态", "老人儿童启用体力阈值提醒", "大雾时切换低海拔备选点"], evidence: ["高海拔天气变化快", "登山台阶对体力要求较高", "索道排队会压缩安全返程时间"], services: ["景区游客中心", "索道站急救点", "属地医疗资源"], sources: ["高德景区 POI", "高德天气实况", "高海拔安全规则"] },
];
const fallbackServices = [
  { id: "health", name: "健康检查", endpoint: "/api/health", status: "connected" }, { id: "scenic-spots", name: "贵州景区 POI 库", endpoint: "/api/scenic-spots", status: "connected" },
  { id: "holiday-tourism", name: "节假日文旅热度样本", endpoint: "/api/holiday-tourism", status: "connected" }, { id: "tourism-route-plan", name: "山地旅游路线生成", endpoint: "/api/tourism/route-plan", status: "connected" },
  { id: "tourism-risk-explanation", name: "单点风险解释", endpoint: "/api/tourism/risk-explanation", status: "connected" }, { id: "tourism-emergency-coverage", name: "应急服务覆盖评估", endpoint: "/api/tourism/emergency-coverage", status: "connected" },
  { id: "tourism-live-weather", name: "贵州天气实况与预报", endpoint: "/api/tourism/live-weather", status: "live" }, { id: "tourism-static-map", name: "高德真实地理底图", endpoint: "/api/tourism/static-map", status: "live" },
  { id: "tourism-data-lineage", name: "数据血缘与审计链路", endpoint: "/api/tourism/data-lineage", status: "connected" }, { id: "ascend-readiness", name: "昇腾推理适配状态", endpoint: "/api/tourism/ascend-readiness", status: "adapter-ready" },
];

const view = ref("dispatch");
const activeScenario = ref("family");
const form = reactive({ ...scenarios[0].form });
const mapMode = ref("route");
const insightTab = ref("actions");
const dossierTab = ref("evidence");
const riskFilter = ref("all");
const activeDay = ref(1);
const selectedId = ref(fallbackSites[0].id);
const selectedScenicId = ref("");
const resourceQuery = ref("");
const cityFilter = ref("");
const resourcePage = ref(1);
const resourcePageSize = 15;
const scenicSpots = ref([]);
const generating = ref(false);
const progress = ref(0);
const routeVersion = ref(0);
const explanationLoading = ref(false);
const resourceLoading = ref(true);
const testing = ref(false);
const toast = ref("");
const failedImages = reactive({});
const failedScenicImages = reactive({});
const cases = reactive({});
const checks = reactive({});
const integration = reactive({ health: "checking", remote: false, services: [], scenicTotal: 2017, scenicFreshness: "", holidayRecords: 3 });
const backend = reactive({ route: null, explanation: null, emergency: null, error: "" });
const weather = reactive({ status: "loading", provider: "", refreshedAt: "", live: [] });
const ascend = reactive({ status: "loading", chain: [], adapterContract: null, demoMessage: "" });
const lineage = reactive({ pipeline: [], datasets: [], auditNote: "" });
let progressTimer;
let toastTimer;

const currentNav = computed(() => nav.find(item => item.id === view.value) || nav[0]);
const routeSites = computed(() => backend.route?.sites?.length ? backend.route.sites : fallbackSites);
const metrics = computed(() => backend.route?.metrics || { siteCount: routeSites.value.length, candidatePool: integration.scenicTotal, averageRisk: Math.round(routeSites.value.reduce((sum, s) => sum + Number(s.riskScore || 0), 0) / Math.max(1, routeSites.value.length)), serviceCoverage: Math.round(routeSites.value.reduce((sum, s) => sum + Number(s.serviceCoverage || 0), 0) / Math.max(1, routeSites.value.length)) });
const selectedSite = computed(() => routeSites.value.find(s => s.id === selectedId.value) || routeSites.value[0]);
const selectedExplanation = computed(() => backend.explanation);
const highestRiskSite = computed(() => [...routeSites.value].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))[0]);
const sortedRiskSites = computed(() => [...routeSites.value].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0)));
const itinerary = computed(() => backend.route?.itinerary?.length ? backend.route.itinerary : Array.from({ length: Math.max(1, Number(form.days)) }, (_, i) => ({ day: i + 1, sites: routeSites.value.slice(i * 3, i * 3 + 3).map(s => s.id) })).filter(d => d.sites.length));
const activeDaySites = computed(() => (itinerary.value.find(d => Number(d.day) === Number(activeDay.value))?.sites || []).map(id => routeSites.value.find(s => s.id === id)).filter(Boolean));
const routeTitle = computed(() => backend.route?.routeTitle || "贵阳至安顺 · 2 天亲子安全线");
const routeSummary = computed(() => `${itinerary.value.length} 天 · ${routeSites.value.length} 个点位 · ${new Set(routeSites.value.map(s => s.city)).size} 个区域`);
const fallbackSummary = computed(() => `系统已识别${travelerLabel(form.travelerType)}、${weatherLabel(form.weather)}和${preferenceLabel(form.preference)}约束，生成 ${routeSites.value.length} 个安全点位。`);
const selectedActions = computed(() => (selectedExplanation.value?.suggestedActions || selectedSite.value?.actions || []).map(normalizeItem).filter(Boolean).slice(0, 6));
const selectedEvidence = computed(() => (selectedExplanation.value?.evidence || selectedSite.value?.evidence || []).map(normalizeItem).filter(Boolean).slice(0, 8));
const selectedServices = computed(() => (selectedExplanation.value?.emergencyServices || selectedSite.value?.services || ["景区游客服务点", "属地医疗急救资源", "停车或换乘服务"]).map(normalizeItem).filter(Boolean).slice(0, 6));
const currentInsightItems = computed(() => insightTab.value === "evidence" ? selectedEvidence.value.slice(0, 4) : insightTab.value === "services" ? selectedServices.value.slice(0, 4) : selectedActions.value.slice(0, 4));
const dossierItems = computed(() => dossierTab.value === "actions" ? selectedActions.value : dossierTab.value === "sources" ? (selectedExplanation.value?.dataSources || selectedSite.value?.sources || []).map(normalizeItem).filter(Boolean) : selectedEvidence.value);
const emergencyCoverage = computed(() => backend.emergency);
const currentCase = computed(() => caseFor(selectedSite.value?.id));
const caseStepIndex = computed(() => Math.max(0, caseSteps.findIndex(s => s.id === currentCase.value.status)));
const completeness = computed(() => { let score = [10, 35, 65, 100][caseStepIndex.value]; if (currentCase.value.status !== "closed") { if (currentCase.value.assignee) score += 8; if (currentCase.value.note) score += 7; score += Math.round((currentCase.value.checkedActions.length / Math.max(1, selectedActions.value.length)) * 20); } return Math.min(100, score); });
const filteredRiskSites = computed(() => sortedRiskSites.value.filter(s => riskFilter.value === "attention" ? Number(s.riskScore) >= 58 : riskFilter.value === "open" ? caseFor(s.id).status !== "closed" : true));
const riskFactors = computed(() => { const s = selectedSite.value || {}; return [{ label: "天气", value: form.weather === "fog" ? 86 : form.weather === "rain" ? 78 : form.weather === "heat" ? 70 : 32 }, { label: "地形坡度", value: Math.min(96, 28 + Number(s.slope || 8) * 2.5) }, { label: "客流压力", value: Math.min(96, Number(s.crowdScore || s.congestionBase || 58)) }, { label: "同行人群", value: form.travelerType === "senior" ? 84 : form.travelerType === "family" ? 68 : 58 }, { label: "服务缺口", value: Math.max(8, 100 - Number(s.serviceCoverage || 82)) }].map(x => ({ ...x, value: Math.round(x.value) })); });
const filteredScenic = computed(() => scenicSpots.value.filter(s => (!cityFilter.value || s.city === cityFilter.value) && (!resourceQuery.value || `${s.name}${s.city}${s.district}${s.address}`.toLowerCase().includes(resourceQuery.value.toLowerCase()))));
const resourcePageCount = computed(() => Math.max(1, Math.ceil(filteredScenic.value.length / resourcePageSize)));
const pagedScenic = computed(() => filteredScenic.value.slice((resourcePage.value - 1) * resourcePageSize, resourcePage.value * resourcePageSize));
const cityOptions = computed(() => [...new Set(scenicSpots.value.map(s => s.city).filter(Boolean))]);
const mapCityLabels = computed(() => {
  const groups = new Map();
  scenicSpots.value.forEach((spot) => {
    const lng = Number(spot.location?.lng);
    const lat = Number(spot.location?.lat);
    if (!spot.city || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const current = groups.get(spot.city) || { name: spot.city, lng: 0, lat: 0, count: 0 };
    current.lng += lng;
    current.lat += lat;
    current.count += 1;
    groups.set(spot.city, current);
  });
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 9)
    .map((city) => {
      const point = project([city.lng / city.count, city.lat / city.count]);
      return { name: normalizeCity(city.name), x: point.x, y: point.y };
    });
});
const selectedScenic = computed(() => scenicSpots.value.find(s => s.id === selectedScenicId.value) || pagedScenic.value[0] || scenicSpots.value[0] || null);
const scenicLngLat = computed(() => selectedScenic.value?.location ? `${Number(selectedScenic.value.location.lng).toFixed(4)}, ${Number(selectedScenic.value.location.lat).toFixed(4)}` : "--");
const visibleServices = computed(() => { const ids = ["health", "scenic-spots", "holiday-tourism", "tourism-route-plan", "tourism-risk-explanation", "tourism-emergency-coverage", "tourism-live-weather", "tourism-static-map", "tourism-data-lineage", "ascend-readiness"]; return (integration.services.length ? integration.services : fallbackServices).filter(s => ids.includes(s.id)); });
const connectedCount = computed(() => visibleServices.value.filter(s => !["error", "offline", "not-configured"].includes(checks[s.id]?.status || s.status)).length);
const intensityLabel = computed(() => form.intensity <= 35 ? "轻松" : form.intensity <= 60 ? "适中" : "探索");
const chainStep = computed(() => generating.value ? progress.value < 20 ? 0 : progress.value < 40 ? 1 : progress.value < 65 ? 2 : progress.value < 85 ? 3 : 4 : backend.route ? 4 : 0);
const inferenceLabel = computed(() => progress.value < 22 ? "解析游客画像与需求" : progress.value < 45 ? "召回贵州景区候选点" : progress.value < 70 ? "融合天气、地形与服务覆盖" : "生成风险分与处置建议");
const healthLabel = computed(() => integration.health === "ok" ? "服务在线" : integration.health === "error" ? "本地兜底可用" : "正在连接");
const modelText = computed(() => integration.remote ? "结果已通过 MindIE / vLLM Ascend 推理并完成风险校准" : "已预留 MindIE / vLLM Ascend 输入输出契约，可替换本地模型");
const busy = computed(() => generating.value || resourceLoading.value || testing.value);
const routePath = computed(() => { const p = routeSites.value.map(s => { const x = project(s.lngLat); return { x: x.x * 10, y: x.y * 5.6 }; }); if (!p.length) return ""; let d = `M ${p[0].x} ${p[0].y}`; for (let i = 0; i < p.length - 1; i++) { const m = (p[i].x + p[i + 1].x) / 2; d += ` C ${m} ${p[i].y}, ${m} ${p[i + 1].y}, ${p[i + 1].x} ${p[i + 1].y}`; } return d; });

function normalizeItem(item) { if (typeof item === "string") return item; if (!item || typeof item !== "object") return ""; return item.explanation ? `${item.name || "证据"}：${item.explanation}` : item.name || item.label || ""; }
function travelerLabel(v) { return { family: "亲子家庭", senior: "老人同行", study: "研学团队", wellness: "康养慢游" }[v] || "游客"; }
function weatherLabel(v) { return { rain: "小雨路滑", fog: "山间大雾", heat: "高温暴晒", clear: "晴朗通行" }[v] || "天气"; }
function preferenceLabel(v) { return { safe: "安全优先", lowload: "低强度", culture: "民族文化", nature: "山地自然" }[v] || "综合"; }
function compactName(v = "") { return String(v).replace(/游客集散中心|游客中心片区|旅游度假区|旅游景区|风景名胜区|风景区|历史文化|文化旅游区|公园/g, "").trim().slice(0, 10) || String(v).slice(0, 10); }
function normalizeCity(v = "") { return String(v).replace(/布依族苗族自治州|苗族侗族自治州|市$/g, ""); }
function riskClass(score = 0) { return Number(score) >= 75 ? "risk-high" : Number(score) >= 58 ? "risk-medium" : "risk-low"; }
function riskLabel(score = 0) { return Number(score) >= 75 ? "较高风险" : Number(score) >= 58 ? "中风险" : "低风险"; }
function caseStatusLabel(status) { return caseSteps.find(s => s.id === status)?.label || "待研判"; }
function requestPayload() { return { request: form.request, travelerType: form.travelerType, weather: form.weather, days: Number(form.days), preference: form.preference, intensity: Number(form.intensity) }; }
function switchView(id) { view.value = id; if (id === "risk") selectSite(selectedSite.value?.id); }
function routeDayFor(id) { return itinerary.value.find(d => d.sites?.includes(id))?.day || 1; }
function project(lngLat = []) { const lng = Number(lngLat[0]), lat = Number(lngLat[1]); if (!Number.isFinite(lng) || !Number.isFinite(lat)) return { x: 50, y: 50 }; return { x: Math.max(6, Math.min(94, 8 + ((lng - 103.6) / 6) * 84)), y: Math.max(8, Math.min(92, 90 - ((lat - 24.5) / 4.7) * 80)) }; }
function pinStyle(site, index) { const p = project(site?.lngLat); return { left: `${p.x}%`, top: `${p.y}%`, "--delay": `${Math.min(index * 70, 420)}ms` }; }
function localImage(name = "") { if (/梵净/.test(name)) return fanjingshanImage; if (/黄果树|瀑布/.test(name)) return huangguoshuImage; if (/荔波|小七孔/.test(name)) return liboImage; if (/西江|苗寨/.test(name)) return xijiangImage; if (/万峰林|峰林/.test(name)) return wanfenglinImage; if (/织金|洞/.test(name)) return zhijinImage; if (/青岩/.test(name)) return qingyanImage; return ""; }
function imageFor(site) { return localImage(`${site?.name || ""}${site?.shortName || ""}`) || site?.imagePath || (site?.sourcePoiId ? `/api/scenic-photo?id=${encodeURIComponent(site.sourcePoiId)}` : ""); }
function canShowImage(site) { return Boolean(site && imageFor(site) && !failedImages[site.id]); }
function markImageFailed(site) { if (site?.id) failedImages[site.id] = true; }
function scenicImageFor(spot) { return localImage(spot?.name || "") || (spot?.id ? `/api/scenic-photo?id=${encodeURIComponent(spot.id)}` : ""); }
function canShowScenicImage(spot) { return Boolean(spot && scenicImageFor(spot) && !failedScenicImages[spot.id]); }
function markScenicImageFailed(spot) { if (spot?.id) failedScenicImages[spot.id] = true; }
function caseFor(id = "unknown") { if (!cases[id]) cases[id] = { status: "pending", assignee: "", checkedActions: [], note: "", logs: [] }; return cases[id]; }
function nowTime() { return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()); }
function log(text) { currentCase.value.logs.push({ time: nowTime(), text }); }
function advanceCase(status) { currentCase.value.status = status; log(`处置状态更新为“${caseStatusLabel(status)}”`); showToast(`${compactName(selectedSite.value?.name)}：${caseStatusLabel(status)}`); }
function recordAssignment() { if (currentCase.value.assignee) log(`已联动资源：${currentCase.value.assignee}`); }
function toggleAction(action) { const list = currentCase.value.checkedActions; const i = list.indexOf(action); if (i >= 0) { list.splice(i, 1); log(`撤销完成：${action}`); } else { list.push(action); log(`动作完成：${action}`); } }
function escapeHtml(v = "") { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function exportCase() { const s = selectedSite.value, c = currentCase.value; const lis = x => x.map(i => `<li>${escapeHtml(i)}</li>`).join(""); const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>黔行守护安全处置单</title><style>body{font-family:"Microsoft YaHei";max-width:860px;margin:40px auto;color:#17211d;line-height:1.7}h2{border-bottom:1px solid #222;padding-bottom:6px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.meta div{padding:12px;background:#f1f4f2}</style><body><h1>黔行守护安全处置单</h1><h2>${escapeHtml(s?.name)}</h2><div class="meta"><div>风险分<br><b>${s?.riskScore}</b></div><div>状态<br><b>${caseStatusLabel(c.status)}</b></div><div>联动资源<br><b>${escapeHtml(c.assignee || "未分派")}</b></div></div><h2>核心风险</h2><p>${escapeHtml(s?.primaryRisk)}</p><h2>风险证据</h2><ol>${lis(selectedEvidence.value)}</ol><h2>已完成动作</h2><ol>${lis(c.checkedActions)}</ol><h2>处置备注</h2><p>${escapeHtml(c.note || "无")}</p><h2>审计留痕</h2><ol>${lis(c.logs.map(x => `${x.time} ${x.text}`))}</ol></body></html>`; const blob = new Blob([html], { type: "text/html;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `黔行守护-${compactName(s?.name)}-安全处置单.html`; a.click(); URL.revokeObjectURL(url); log("已导出安全处置单"); showToast("安全处置单已导出"); }
function formatDate(v) { if (!v) return "--"; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
function formatDateTime(v) { if (!v) return "--"; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d); }
function planWithScenic(spot) { if (!spot) return; form.request = `以${spot.name}为核心规划贵州安全行程，结合实时天气、同行人群和应急服务覆盖给出路线。`; activeScenario.value = "custom"; view.value = "dispatch"; showToast(`${spot.name}已加入路线需求`); }
function openAmap(spot) { if (!spot) return; const loc = spot.location ? `${spot.location.lng},${spot.location.lat}` : ""; window.open(loc ? `https://uri.amap.com/marker?position=${encodeURIComponent(loc)}&name=${encodeURIComponent(spot.name)}` : `https://www.amap.com/search?query=${encodeURIComponent(spot.name)}`, "_blank", "noopener,noreferrer"); }
function serviceTone(s) { const status = checks[s.id]?.status || s.status; return ["connected", "live", "adapter-ready", "remote-ready", "ok"].includes(status) ? "ok" : ["estimate-only", "not-configured"].includes(status) ? "warning" : "error"; }
function serviceLabel(s) { return ({ connected: "已连接", live: "实时", "adapter-ready": "适配就绪", "remote-ready": "远程就绪", "estimate-only": "模型估算", "not-configured": "待授权", ok: "正常", error: "异常" })[checks[s.id]?.status || s.status] || s.status; }
async function fetchJson(url, options = {}) { const r = await fetch(url, { headers: { "content-type": "application/json" }, ...options }); if (!r.ok) throw new Error(`${url} 返回 ${r.status}`); return r.json(); }
async function loadSystem() { try { const [health, status, summary, holiday, w, a, l] = await Promise.all([fetchJson("/api/health"), fetchJson("/api/integration-status").catch(() => null), fetchJson("/api/scenic-spots/summary").catch(() => null), fetchJson("/api/holiday-tourism").catch(() => null), fetchJson("/api/tourism/live-weather").catch(() => null), fetchJson("/api/tourism/ascend-readiness").catch(() => null), fetchJson("/api/tourism/data-lineage").catch(() => null)]); integration.health = health?.ok ? "ok" : "error"; integration.services = status?.services || fallbackServices; integration.scenicTotal = summary?.total || integration.scenicTotal; integration.scenicFreshness = summary?.generatedAt || ""; integration.holidayRecords = holiday?.records?.length || 3; integration.remote = Boolean(a?.endpointConfigured) || /remote/i.test(a?.status || ""); Object.assign(weather, w || { status: "unavailable", live: [] }); Object.assign(ascend, a || {}); Object.assign(lineage, l?.lineage || {}); } catch (e) { integration.health = "error"; backend.error = e.message; } }
async function loadScenic() { resourceLoading.value = true; try { const p = await fetchJson("/api/scenic-spots?limit=2500"); scenicSpots.value = p.spots || []; integration.scenicTotal = p.total || scenicSpots.value.length; integration.scenicFreshness = p.generatedAt || integration.scenicFreshness; selectedScenicId.value ||= scenicSpots.value[0]?.id || ""; } catch { scenicSpots.value = []; showToast("景区资源库暂时无法加载"); } finally { resourceLoading.value = false; } }
async function loadExplanation(id) { if (!id) return; explanationLoading.value = true; backend.explanation = null; try { const p = await fetchJson("/api/tourism/risk-explanation", { method: "POST", body: JSON.stringify({ ...requestPayload(), siteId: id }) }); if (selectedId.value === id) backend.explanation = p.explanation || null; } catch { backend.explanation = null; } finally { if (selectedId.value === id) explanationLoading.value = false; } }
async function selectSite(id) { selectedId.value = id; caseFor(id); await loadExplanation(id); }
async function generateRoute(source = "manual") { if (generating.value) return; generating.value = true; backend.error = ""; progress.value = source === "initial" ? 12 : 6; clearInterval(progressTimer); progressTimer = setInterval(() => progress.value = Math.min(92, progress.value + 4 + Math.round(Math.random() * 7)), 180); try { const payload = requestPayload(); const [route, emergency, l] = await Promise.all([fetchJson("/api/tourism/route-plan", { method: "POST", body: JSON.stringify(payload) }), fetchJson("/api/tourism/emergency-coverage", { method: "POST", body: JSON.stringify(payload) }).catch(() => null), fetchJson("/api/tourism/data-lineage", { method: "POST", body: JSON.stringify(payload) }).catch(() => null)]); backend.route = route; backend.emergency = emergency?.coverage || null; if (l?.lineage) Object.assign(lineage, l.lineage); selectedId.value = route.sites?.[0]?.id || selectedId.value; activeDay.value = route.itinerary?.[0]?.day || 1; routeVersion.value++; progress.value = 100; await loadExplanation(selectedId.value); if (source !== "initial") showToast(`已生成 ${form.days} 天安全路线`); } catch { backend.error = "远程服务暂未响应，已保留本地演示路线"; integration.health = "error"; showToast("路线服务未连接，已启用本地兜底数据"); } finally { clearInterval(progressTimer); setTimeout(() => { generating.value = false; progress.value = 0; }, 360); } }
function applyScenario(scene) { activeScenario.value = scene.id; Object.assign(form, scene.form); generateRoute("scenario"); }
async function timed(service) { const start = performance.now(); try { const posts = ["tourism-route-plan", "tourism-risk-explanation", "tourism-emergency-coverage"]; if (posts.includes(service.id)) await fetchJson(service.endpoint, { method: "POST", body: JSON.stringify(service.id === "tourism-risk-explanation" ? { ...requestPayload(), siteId: selectedId.value } : requestPayload()) }); else { const path = ({ health: "/api/health", "scenic-spots": "/api/scenic-spots/summary", "holiday-tourism": "/api/holiday-tourism", "tourism-live-weather": "/api/tourism/live-weather", "tourism-static-map": "/api/tourism/static-map", "tourism-data-lineage": "/api/tourism/data-lineage", "ascend-readiness": "/api/tourism/ascend-readiness" })[service.id] || service.endpoint; const r = await fetch(path); if (!r.ok) throw new Error(); await r.arrayBuffer(); } checks[service.id] = { status: ["not-configured", "estimate-only"].includes(service.status) ? service.status : "ok", latency: Math.round(performance.now() - start) }; } catch { checks[service.id] = { status: "error", latency: Math.round(performance.now() - start) }; } }
async function testServices() { testing.value = true; await Promise.all(visibleServices.value.map(timed)); testing.value = false; showToast("核心接口检测完成"); }
async function refreshAll() { await Promise.all([loadSystem(), loadScenic(), generateRoute("refresh")]); }
function showToast(text) { clearTimeout(toastTimer); toast.value = text; toastTimer = setTimeout(() => toast.value = "", 2600); }

watch([resourceQuery, cityFilter], () => resourcePage.value = 1);
watch(resourcePageCount, n => { if (resourcePage.value > n) resourcePage.value = n; });
watch(itinerary, days => { if (!days.some(d => Number(d.day) === Number(activeDay.value))) activeDay.value = days[0]?.day || 1; });
onMounted(async () => { document.body.classList.add("ops-body"); await Promise.all([loadSystem(), loadScenic(), generateRoute("initial")]); });
onBeforeUnmount(() => { document.body.classList.remove("ops-body"); clearInterval(progressTimer); clearTimeout(toastTimer); });
</script>

<style scoped>
:global(.ops-body){margin:0;min-width:320px;min-height:100vh;overflow:hidden;background:#0b100e}
.ops-app{--bg:#0b100e;--surface:#141b18;--raised:#19211d;--line:rgba(223,239,231,.1);--line2:rgba(223,239,231,.18);--text:#edf2ef;--muted:#9eaba5;--faint:#6f7d76;--accent:#69d8b0;--green:#5fd49a;--amber:#efbd61;--red:#ee766e;min-height:100dvh;color:var(--text);background:var(--bg);font:13px "HarmonyOS Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif}
*{box-sizing:border-box}.ops-app button,.ops-app input,.ops-app textarea,.ops-app select{font:inherit}.ops-app button{color:inherit}.ops-app button:focus-visible,.ops-app input:focus-visible,.ops-app textarea:focus-visible,.ops-app select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.sidebar{position:fixed;z-index:30;inset:0 auto 0 0;width:214px;padding:18px 12px;border-right:1px solid var(--line);background:#0b1210}.brand{display:grid;grid-template-columns:40px 1fr;gap:11px;align-items:center;padding:4px 7px;color:var(--text);text-decoration:none}.brand>span{display:grid;place-items:center;width:40px;height:40px;border-radius:7px;color:#08231a;font:800 20px STKaiti,KaiTi,serif;background:var(--accent)}.brand strong,.brand small{display:block}.brand strong{font-size:17px}.brand small{margin-top:2px;color:var(--muted);font-size:10px}
.sidebar nav{display:grid;gap:5px;margin-top:30px}.sidebar nav button{position:relative;display:grid;grid-template-columns:32px 1fr;align-items:center;gap:8px;width:100%;min-height:57px;padding:7px 10px;border:0;border-radius:7px;color:#aebbb5;text-align:left;background:transparent;cursor:pointer;transition:.18s cubic-bezier(.22,1,.36,1)}.sidebar nav button:hover{color:var(--text);background:rgba(255,255,255,.035);transform:translateX(1px)}.sidebar nav button.active{color:var(--text);background:#17211d}.sidebar nav button.active:before{position:absolute;top:12px;bottom:12px;left:0;width:2px;border-radius:2px;content:"";background:var(--accent)}.sidebar nav svg{color:var(--faint)}.sidebar nav .active svg{color:var(--accent)}.sidebar nav b,.sidebar nav small{display:block}.sidebar nav b{font-size:12px}.sidebar nav small{margin-top:2px;color:var(--faint);font-size:9px}
.side-status{position:absolute;right:12px;bottom:18px;left:12px;display:grid;grid-template-columns:10px 1fr;gap:9px;align-items:center;padding:12px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.side-status>i{width:8px;height:8px;border-radius:50%;background:var(--faint)}.side-status>i.ok{background:var(--green);box-shadow:0 0 0 4px rgba(95,212,154,.09)}.side-status>i.error{background:var(--amber)}.side-status b,.side-status small{display:block}.side-status b{font-size:10px}.side-status small{margin-top:2px;color:var(--faint);font-size:8px}
.topbar{position:fixed;z-index:25;top:0;right:0;left:214px;display:grid;grid-template-columns:minmax(230px,.8fr) minmax(520px,1.35fr) minmax(220px,.65fr);gap:18px;align-items:center;height:68px;padding:0 22px;border-bottom:1px solid var(--line);background:rgba(11,16,14,.94);backdrop-filter:blur(16px) saturate(1.15)}.topbar>div:first-child small,.topbar>div:first-child strong{display:block}.topbar>div:first-child small{color:var(--accent);font-size:9px}.topbar>div:first-child strong{margin-top:3px;font-size:14px}.chain{display:flex;align-items:center;justify-content:center;gap:6px}.chain span{padding:5px 7px;border-radius:4px;color:var(--faint);font-size:9px;white-space:nowrap;background:rgba(255,255,255,.025)}.chain span.active{color:#dff7ed;background:rgba(105,216,176,.1)}.chain svg{color:#4e5c55}.top-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px}.top-actions>span{display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:5px;color:#cbd8d2;font-size:10px;background:rgba(255,255,255,.035)}.top-actions>span svg{color:var(--amber)}.top-actions>button{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid var(--line);border-radius:5px;color:var(--muted);background:#141b18;cursor:pointer}
.main{height:100dvh;padding:84px 18px 16px 232px;overflow:hidden}.panel{border:1px solid var(--line);border-radius:8px;background:var(--surface)}.panel-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 15px}.panel-title small,.panel-title strong{display:block}.panel-title small{color:var(--accent);font-size:8px}.panel-title strong{margin-top:4px;font-size:14px}.panel-title>svg{color:var(--accent)}
.dispatch-page{display:grid;grid-template-rows:minmax(470px,1fr) 196px;gap:12px;height:100%}.dispatch-top{display:grid;grid-template-columns:300px minmax(440px,1fr) 286px;gap:12px;min-height:0}.mission,.summary{min-height:0;overflow:auto}.mission>.panel-title,.summary>.panel-title{padding-bottom:0}.scenarios{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:14px 15px 0;padding:3px;border-radius:6px;background:#0d1411}.scenarios button{height:29px;padding:0 3px;overflow:hidden;border:0;border-radius:4px;color:var(--faint);font-size:8px;text-overflow:ellipsis;white-space:nowrap;background:transparent;cursor:pointer}.scenarios button.active{color:#0c271d;font-weight:750;background:var(--accent)}
.request{display:grid;gap:7px;margin:13px 15px 0;padding:11px;border:1px solid var(--line);border-radius:6px;background:#101713}.request span,.field-grid label>span,.intensity>span,.assign>span,.case-note>span{color:#c8d4ce;font-size:9px}.request textarea{width:100%;min-height:80px;padding:0;resize:none;border:0;outline:0;color:var(--text);font-size:11px;line-height:1.65;background:transparent}.request small{color:var(--faint);font-size:8px}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:9px 15px 0}.field-grid label{display:grid;gap:5px}.field-grid label>span{display:flex;align-items:center;gap:5px}.field-grid select,.assign select{width:100%;height:32px;padding:0 8px;border:1px solid var(--line);border-radius:5px;outline:0;color:#dce6e1;font-size:9px;background:#101713}.intensity{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:10px 15px 0}.intensity>span{grid-column:1/-1;display:flex;justify-content:space-between}.intensity b{color:var(--accent)}.intensity input{grid-column:1/-1;width:100%;accent-color:var(--accent)}.intensity small{color:var(--faint);font-size:8px}.intensity small:last-child{text-align:right}.primary{display:flex;align-items:center;justify-content:center;gap:7px;width:calc(100% - 30px);min-height:40px;margin:11px 15px 0;border:0;border-radius:5px;color:#09241a;font-size:10px;font-weight:800;background:var(--accent);cursor:pointer;transition:.16s cubic-bezier(.22,1,.36,1)}.primary:hover{filter:brightness(1.05);transform:translateY(-1px)}.error{display:flex;gap:6px;margin:9px 15px;color:#e9bc73;font-size:8px}
.map-panel{position:relative;min-width:0;min-height:0;overflow:hidden;background:#101713}.map-head{position:absolute;z-index:10;top:14px;right:14px;left:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:48px;padding:8px 10px;border:1px solid rgba(231,245,238,.12);border-radius:6px;background:rgba(10,17,14,.84);backdrop-filter:blur(14px)}.map-head small,.map-head strong{display:block}.map-head small{color:var(--accent);font-size:8px}.map-head strong{max-width:40ch;margin-top:3px;overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.map-tabs{display:flex;gap:3px;padding:3px;border-radius:5px;background:rgba(255,255,255,.04)}.map-tabs button{height:26px;padding:0 9px;border:0;border-radius:4px;color:var(--muted);font-size:8px;background:transparent;cursor:pointer}.map-tabs .active{color:#09231a;background:var(--accent)}.map-stage{position:absolute;inset:0;overflow:hidden;background:#15221b}.map-stage>img{width:100%;height:100%;object-fit:cover;filter:saturate(.6) contrast(1.06) brightness(.58);transform:scale(1.02)}.map-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,14,11,.38),transparent 31%,transparent 72%,rgba(5,11,8,.54))}.map-stage>svg{position:absolute;z-index:3;inset:0;width:100%;height:100%;pointer-events:none}.map-stage path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}.route-halo{stroke:rgba(105,216,176,.26);stroke-width:12}.route-main{stroke:#72dfb9;stroke-width:3.2}.route-flow{stroke:rgba(255,255,255,.9);stroke-width:1;stroke-dasharray:4 22;animation:routeFlow 5.5s linear infinite}
.map-pin{position:absolute;z-index:5;display:grid;grid-template-columns:28px max-content;align-items:center;gap:7px;padding:0;border:0;text-align:left;background:transparent;transform:translate(-14px,-14px);cursor:pointer;animation:pinIn .38s cubic-bezier(.22,1,.36,1) both;animation-delay:var(--delay)}.map-pin>b{display:grid;place-items:center;width:28px;height:28px;border:2px solid rgba(255,255,255,.86);border-radius:50%;color:#0b261c;font-size:9px;background:var(--green);box-shadow:0 3px 8px rgba(2,10,7,.34)}.map-pin.risk-medium>b{background:var(--amber)}.map-pin.risk-high>b{color:#fff;background:var(--red)}.map-pin>span{display:grid;gap:2px;min-width:94px;padding:6px 8px;border:1px solid rgba(231,245,238,.14);border-radius:5px;background:rgba(9,16,13,.88);backdrop-filter:blur(10px)}.map-pin.active>span,.map-pin:hover>span{border-color:rgba(105,216,176,.45)}.map-pin strong{font-size:10px}.map-pin small{color:#9fb4aa;font-size:7px}.legend{position:absolute;z-index:6;right:14px;bottom:12px;display:flex;align-items:center;gap:10px;padding:7px 9px;border-radius:5px;color:#c9d7d0;font-size:7px;background:rgba(8,15,12,.82)}.legend span{display:flex;align-items:center;gap:4px}.legend i{width:6px;height:6px;border-radius:50%}.legend .low{background:var(--green)}.legend .medium{background:var(--amber)}.legend .high{background:var(--red)}.legend small{color:var(--faint)}.map-loading{position:absolute;z-index:12;inset:0;display:grid;grid-template-columns:30px minmax(180px,auto) auto;place-content:center;align-items:center;gap:9px;background:rgba(7,13,10,.72);backdrop-filter:blur(7px)}.map-loading svg,.map-loading>span{color:var(--accent)}.map-loading>i{grid-column:1/-1;width:280px;height:3px;overflow:hidden;border-radius:3px;background:rgba(255,255,255,.1)}.map-loading>i b{display:block;width:100%;height:100%;background:var(--accent);transform-origin:left}
.risk-focus{display:grid;grid-template-columns:75px 1fr;gap:7px;margin:15px;padding:12px;border-radius:6px;background:#101713}.risk-focus>span{color:var(--muted);font-size:8px}.risk-focus>strong{grid-row:2;font:31px "Times New Roman";color:var(--green)}.risk-focus>strong.risk-medium{color:var(--amber)}.risk-focus>strong.risk-high{color:var(--red)}.risk-focus p{grid-row:1/3;grid-column:2;margin:0;color:var(--muted);font-size:9px;line-height:1.55}.risk-focus p b{display:block;margin-bottom:3px;color:var(--text);font-size:11px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);margin:0 15px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.metrics span{display:grid;justify-items:center;gap:2px;padding:10px 3px}.metrics span+span{border-left:1px solid var(--line)}.metrics b{font:17px "Times New Roman"}.metrics small{color:var(--faint);font-size:7px}.route-summary{margin:11px 15px 0;color:#b4c2bb;font-size:9px;line-height:1.65}.info-tabs,.dossier-tabs{display:grid;grid-template-columns:repeat(3,1fr);margin:12px 15px 0;border-bottom:1px solid var(--line)}.info-tabs button,.dossier-tabs button{height:30px;border:0;border-bottom:2px solid transparent;color:var(--faint);font-size:9px;background:transparent;cursor:pointer}.info-tabs .active,.dossier-tabs .active{color:var(--text);border-color:var(--accent)}.info-list{min-height:122px;margin:0 15px;padding-top:6px}.info-list p{display:grid;grid-template-columns:19px 1fr;gap:7px;margin:0;padding:6px 0;border-bottom:1px solid rgba(223,239,231,.06);color:#bfcdc6;font-size:8px;line-height:1.5}.info-list p span,.evidence p span{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;color:#09241a;font-size:7px;font-weight:800;background:var(--accent)}.risk-link{display:flex;align-items:center;justify-content:space-between;width:calc(100% - 30px);height:36px;margin:8px 15px 0;padding:0 11px;border:1px solid rgba(105,216,176,.26);border-radius:5px;color:#d9f4e9;font-size:9px;background:rgba(105,216,176,.07);cursor:pointer}.model-note{display:flex;gap:8px;margin:9px 15px 14px;padding-top:10px;border-top:1px solid var(--line);color:var(--muted);font-size:8px;line-height:1.45}.model-note svg{flex:none;color:#73c8d7}.model-note b{display:block;color:#d6e5de}
.itinerary{min-width:0;min-height:0;padding:10px 12px 12px;overflow:hidden}.itinerary>header{display:flex;align-items:center;justify-content:space-between;height:36px}.itinerary>header>div:first-child{display:flex;align-items:baseline;gap:9px}.itinerary>header small{color:var(--accent);font-size:8px}.itinerary>header strong{font-size:10px}.day-tabs{display:flex;max-width:58%;overflow-x:auto}.day-tabs button{flex:none;height:28px;padding:0 10px;border:0;border-bottom:2px solid transparent;color:var(--faint);font-size:8px;background:transparent}.day-tabs .active{color:var(--text);border-color:var(--accent)}.route-cards{display:flex;gap:7px;height:133px;overflow-x:auto}.route-cards>button{flex:0 0 min(270px,31vw);display:grid;grid-template-columns:88px minmax(0,1fr) 55px;align-items:center;gap:10px;height:122px;padding:7px;border:1px solid transparent;border-radius:6px;text-align:left;background:#101713;cursor:pointer}.route-cards>button:hover,.route-cards>button.active{border-color:rgba(105,216,176,.35);background:#17221d}.thumb{position:relative;display:grid;place-items:center;width:88px;height:104px;overflow:hidden;border-radius:5px;color:var(--faint);background:#1d2823}.thumb img{width:100%;height:100%;object-fit:cover}.thumb>span{display:grid;place-items:center;gap:5px;font-size:8px}.thumb i{position:absolute;top:5px;left:5px;display:grid;place-items:center;width:21px;height:21px;border-radius:50%;color:#0c281e;font-size:8px;font-style:normal;font-weight:850;background:var(--accent)}.stop-copy{display:grid;min-width:0;gap:4px}.stop-copy small{color:var(--accent);font-size:7px}.stop-copy strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.stop-copy em{display:-webkit-box;overflow:hidden;color:var(--muted);font-size:8px;font-style:normal;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2}.stop-meta{display:grid;justify-items:center;gap:5px}.stop-meta b{display:grid;place-items:center;width:37px;height:37px;border-radius:50%;color:#09241a;font:13px "Times New Roman";background:var(--green)}.stop-meta b.risk-medium{background:var(--amber)}.stop-meta b.risk-high{color:#fff;background:var(--red)}.stop-meta small{color:var(--faint);font-size:7px;white-space:nowrap}
.workspace-page{display:grid;grid-template-rows:auto minmax(0,1fr);height:100%;min-height:0}.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;min-height:84px;padding:3px 3px 15px;border-bottom:1px solid var(--line)}.page-head small{color:var(--accent);font-size:9px}.page-head h1{margin:5px 0 0;font-size:23px}.page-head p{margin:6px 0 0;color:var(--muted);font-size:10px}.page-head>button{display:flex;align-items:center;gap:7px;height:34px;padding:0 11px;border:1px solid var(--line);border-radius:5px;color:#ced9d4;font-size:9px;background:var(--surface);cursor:pointer}
.risk-grid{display:grid;grid-template-columns:256px minmax(440px,1fr) 318px;gap:12px;min-height:0;padding-top:12px}.risk-queue,.dossier,.response{min-height:0;overflow:hidden}.risk-queue{display:grid;grid-template-rows:53px 42px minmax(0,1fr)}.risk-queue>header{display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--line)}.risk-queue>header small,.risk-queue>header strong{display:block}.risk-queue>header small{color:var(--accent);font-size:8px}.risk-queue>header strong{margin-top:3px;font-size:11px}.risk-queue>header span{color:var(--faint);font-size:8px}.risk-filters{display:flex;gap:3px;padding:6px 9px;border-bottom:1px solid var(--line)}.risk-filters button{height:28px;padding:0 10px;border:0;border-radius:4px;color:var(--faint);font-size:8px;background:transparent}.risk-filters .active{color:var(--text);background:#202a25}.queue-list{overflow:auto}.queue-list>button{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:9px;width:100%;min-height:67px;padding:8px 10px;border:0;border-bottom:1px solid rgba(223,239,231,.055);text-align:left;background:transparent}.queue-list>button:hover,.queue-list>button.active{background:#19231e}.queue-list>button>i{display:grid;place-items:center;width:35px;height:35px;border-radius:50%;color:#09241a;font:11px "Times New Roman";font-style:normal;background:var(--green)}.queue-list>button>i.risk-medium{background:var(--amber)}.queue-list>button>i.risk-high{color:#fff;background:var(--red)}.queue-list>button>span{display:grid;min-width:0;gap:3px}.queue-list strong{font-size:10px}.queue-list small{overflow:hidden;color:var(--faint);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.queue-list em{padding:4px 5px;border-radius:3px;color:var(--faint);font-size:7px;font-style:normal;background:rgba(255,255,255,.035)}.queue-list .case-responding{color:var(--amber)}.queue-list .case-closed{color:var(--green)}
.dossier{display:grid;grid-template-rows:68px auto auto 35px minmax(0,1fr)}.dossier>header{display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--line)}.dossier>header small{color:var(--accent);font-size:8px}.dossier>header h2{margin:4px 0 0;font-size:15px}.dossier>header>strong{display:grid;justify-items:end;font:22px "Times New Roman";color:var(--green)}.dossier>header>strong.risk-medium{color:var(--amber)}.dossier>header>strong.risk-high{color:var(--red)}.dossier>header>strong span{color:var(--muted);font:7px inherit}.dossier-hero{display:grid;grid-template-columns:180px 1fr;gap:15px;padding:14px 16px;border-bottom:1px solid var(--line)}.dossier-photo{display:grid;place-items:center;width:180px;height:118px;overflow:hidden;border-radius:6px;color:var(--faint);background:#1d2823}.dossier-photo img{width:100%;height:100%;object-fit:cover}.dossier-photo span{display:grid;place-items:center;gap:7px;font-size:8px}.dossier-hero>div:last-child{display:grid;align-content:center;gap:5px}.dossier-hero>div>small{color:var(--accent);font-size:8px}.dossier-hero>div>strong{font-size:14px}.dossier-hero p{margin:0;overflow:hidden;color:var(--muted);font-size:8px;text-overflow:ellipsis;white-space:nowrap}.dossier-hero dl{display:flex;gap:14px;margin:7px 0 0}.dossier-hero dt{color:var(--faint);font-size:7px}.dossier-hero dd{margin:2px 0 0;font:12px "Times New Roman"}.factors{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;padding:12px 16px;border-bottom:1px solid var(--line)}.factors>header{grid-column:1/-1;display:flex;justify-content:space-between}.factors>header span{font-size:9px;font-weight:700}.factors>header small{color:var(--faint);font-size:7px}.factors>div{display:grid;grid-template-columns:1fr auto;gap:5px}.factors>div span,.factors em{color:var(--muted);font-size:7px;font-style:normal}.factors i{grid-column:1/-1;height:4px;overflow:hidden;border-radius:4px;background:rgba(255,255,255,.07)}.factors i b{display:block;width:100%;height:100%;background:var(--accent);transform-origin:left}.dossier-tabs{margin:0 16px}.evidence{overflow:auto;padding:6px 16px 14px}.evidence p{display:grid;grid-template-columns:20px 1fr;gap:8px;margin:0;padding:8px 0;border-bottom:1px solid rgba(223,239,231,.055);color:#c0cdc7;font-size:8px;line-height:1.5}.skeleton,.loading-list i{display:block;height:36px;margin-top:7px;border-radius:4px;background:linear-gradient(90deg,#1b2420,#232e29,#1b2420);background-size:240% 100%;animation:skeleton 1.4s infinite}
.response{overflow:auto}.response>header{padding:14px;border-bottom:1px solid var(--line)}.response>header>div{display:flex;justify-content:space-between}.response>header small{color:var(--accent);font-size:8px}.response>header strong{font-size:10px}.response>header>i{display:block;height:3px;margin-top:8px;overflow:hidden;border-radius:3px;background:rgba(255,255,255,.08)}.response>header>i b{display:block;width:100%;height:100%;background:var(--accent);transform-origin:left}.case-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;padding:12px 10px;border-bottom:1px solid var(--line)}.case-steps>span{display:grid;justify-items:center;gap:5px;color:var(--faint);font-size:7px}.case-steps i{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--line2);border-radius:50%;font-style:normal;background:#111814}.case-steps .active i{color:#0a251b;border-color:var(--accent);background:var(--accent)}.case-steps .current i{box-shadow:0 0 0 4px rgba(105,216,176,.1)}.assign,.case-note{display:grid;gap:6px;padding:11px 13px;border-bottom:1px solid var(--line)}.assign small{color:var(--faint);font-size:7px}.checklist{padding:11px 13px;border-bottom:1px solid var(--line)}.checklist>header{display:flex;justify-content:space-between;margin-bottom:5px}.checklist>header span{font-size:9px;font-weight:700}.checklist>header small{color:var(--faint);font-size:7px}.checklist label{display:block}.checklist input{position:absolute;opacity:0}.checklist label>span{display:grid;grid-template-columns:19px 1fr;gap:7px;padding:7px 0;border-bottom:1px solid rgba(223,239,231,.05);color:#bcc9c3;font-size:8px;line-height:1.45}.checklist svg{width:18px;height:18px;padding:3px;border:1px solid var(--line2);border-radius:4px;color:transparent}.checklist input:checked+span svg{color:#09241a;border-color:var(--accent);background:var(--accent)}.case-note textarea{width:100%;padding:8px;resize:vertical;border:1px solid var(--line);border-radius:5px;outline:0;color:#dce7e2;font-size:8px;background:#101713}.case-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:10px 13px;border-bottom:1px solid var(--line)}.case-buttons button{min-height:32px;padding:0 4px;border:1px solid var(--line2);border-radius:4px;color:#d6e3dc;font-size:8px;background:#18211d}.case-buttons button:disabled{color:#59665f;background:#111713}.audit{padding:11px 13px}.audit>header{display:flex;align-items:center;justify-content:space-between}.audit>header span{font-size:9px;font-weight:700}.audit>header button{display:flex;align-items:center;gap:5px;height:27px;padding:0 7px;border:1px solid var(--line);border-radius:4px;color:var(--accent);font-size:7px;background:transparent}.audit p{display:grid;grid-template-columns:48px 1fr;gap:7px;margin:0;padding:5px 0;color:#aebcb5;font-size:7px}.audit time{color:var(--faint)}.audit .empty{display:block;padding:16px 0;text-align:center}
.page-kpis{display:flex}.page-kpis span{display:grid;justify-items:end;min-width:96px;padding:0 12px;color:var(--muted);font-size:8px}.page-kpis span+span{border-left:1px solid var(--line)}.page-kpis b{color:var(--text);font:18px "Times New Roman"}.resource-grid{display:grid;grid-template-columns:minmax(650px,1fr) 320px;gap:12px;min-height:0;padding-top:12px}.resource-table-panel{display:grid;grid-template-rows:54px minmax(0,1fr) 42px;overflow:hidden}.resource-tools{display:grid;grid-template-columns:minmax(260px,1fr) 175px auto;gap:9px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line)}.resource-tools label{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:7px;height:34px;padding:0 9px;border:1px solid var(--line);border-radius:5px;color:var(--faint);background:#101713}.resource-tools input{min-width:0;height:100%;border:0;outline:0;color:var(--text);font-size:9px;background:transparent}.resource-tools label button{display:grid;place-items:center;width:23px;height:23px;padding:0;border:0;color:var(--faint);background:transparent}.resource-tools select{height:34px;padding:0 9px;border:1px solid var(--line);border-radius:5px;color:#d7e3dd;font-size:9px;background:#101713}.resource-tools>span{color:var(--faint);font-size:8px}.resource-table{overflow:auto}.table-head,.resource-table>button{display:grid;grid-template-columns:minmax(210px,1.35fr) minmax(165px,1fr) 55px 118px 76px;align-items:center;gap:10px;width:100%;min-height:43px;padding:0 13px}.table-head{position:sticky;top:0;z-index:2;min-height:36px;color:var(--faint);font-size:8px;background:#171f1b}.resource-table>button{border:0;border-bottom:1px solid rgba(223,239,231,.055);color:#bdcac4;font-size:8px;text-align:left;background:transparent}.resource-table>button:hover,.resource-table>button.active{background:#19231e}.resource-table>button>span:first-child{display:flex;align-items:center;gap:7px;min-width:0}.resource-table>button>span:first-child svg{color:var(--accent)}.resource-table>button b{overflow:hidden;color:var(--text);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.resource-table>button>span:nth-child(4){display:grid;grid-template-columns:70px auto;align-items:center;gap:7px}.resource-table>button>span:nth-child(4)>i{height:4px;overflow:hidden;background:rgba(255,255,255,.07)}.resource-table>button>span:nth-child(4)>i b{display:block;width:100%;height:100%;background:var(--amber);transform-origin:left}.resource-table>button>span:last-child{display:flex;align-items:center;gap:5px;color:var(--green)}.loading-list{display:grid;gap:7px;padding:12px}.resource-table-panel>footer{display:flex;align-items:center;justify-content:space-between;padding:0 13px;border-top:1px solid var(--line);color:var(--faint);font-size:8px}.resource-table-panel>footer div{display:flex;gap:5px}.resource-table-panel>footer button{display:grid;place-items:center;width:27px;height:27px;padding:0;border:1px solid var(--line);border-radius:4px;background:#111814}.resource-detail{overflow:auto}.resource-photo{display:grid;place-items:center;width:100%;aspect-ratio:16/9;overflow:hidden;color:var(--faint);background:#1d2823}.resource-photo img{width:100%;height:100%;object-fit:cover}.resource-photo span{display:grid;place-items:center;gap:7px;font-size:8px}.resource-copy{padding:14px 15px}.resource-copy small{color:var(--accent);font-size:8px}.resource-copy h2{margin:5px 0 0;font-size:16px}.resource-copy p{margin:6px 0 0;color:var(--muted);font-size:8px}.resource-detail dl,.ascend-panel dl{display:grid;grid-template-columns:repeat(3,1fr);margin:0 15px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.resource-detail dl div,.ascend-panel dl div{display:grid;justify-items:center;gap:4px;padding:11px 4px}.resource-detail dl div+div,.ascend-panel dl div+div{border-left:1px solid var(--line)}.resource-detail dt,.ascend-panel dt{color:var(--faint);font-size:7px}.resource-detail dd,.ascend-panel dd{margin:0;font-size:9px;font-weight:700;text-align:center}.source{display:grid;gap:4px;padding:13px 15px;border-bottom:1px solid var(--line)}.source small{color:var(--accent);font-size:8px}.source strong{font-size:9px}.source span{color:var(--faint);font-size:7px}.resource-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:13px 15px}.resource-buttons button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:34px;border:1px solid var(--line2);border-radius:4px;font-size:8px;background:#18211d}.resource-buttons button:first-child{color:#09241a;border-color:var(--accent);background:var(--accent)}
.system-grid{display:grid;grid-template-columns:minmax(520px,1.15fr) minmax(390px,.85fr);grid-template-rows:minmax(300px,1fr) minmax(260px,.8fr);gap:12px;min-height:0;padding-top:12px}.service-panel,.weather-panel,.ascend-panel,.lineage-panel{overflow:hidden}.service-panel>.panel-title,.weather-panel>.panel-title,.ascend-panel>.panel-title,.lineage-panel>.panel-title{min-height:53px;border-bottom:1px solid var(--line)}.panel-title>small{color:var(--faint);font-size:8px}.service-list{height:calc(100% - 53px);overflow:auto}.service-list>div{display:grid;grid-template-columns:32px minmax(0,1fr) 70px 64px;align-items:center;gap:10px;min-height:49px;padding:6px 13px;border-bottom:1px solid rgba(223,239,231,.055)}.service-list>div>i{display:grid;place-items:center;width:29px;height:29px;border-radius:5px;color:var(--faint);font-style:normal;background:rgba(255,255,255,.035)}.service-list>div>i.ok{color:var(--green);background:rgba(95,212,154,.08)}.service-list>div>i.warning{color:var(--amber)}.service-list>div>i.error{color:var(--red)}.service-list>div>span{display:grid;min-width:0;gap:3px}.service-list b{font-size:9px}.service-list small{overflow:hidden;color:var(--faint);font:7px Consolas,monospace;text-overflow:ellipsis}.service-list em{padding:4px 6px;border-radius:3px;color:var(--faint);font-size:7px;font-style:normal;background:rgba(255,255,255,.035)}.service-list em.ok{color:var(--green)}.service-list em.warning{color:var(--amber)}.service-list em.error{color:var(--red)}.service-list time{color:var(--faint);font:8px "Times New Roman";text-align:right}.weather-panel{display:grid;grid-template-rows:53px minmax(0,1fr) 34px}.weather-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line)}.weather-grid>div{display:grid;align-content:center;gap:3px;padding:10px 12px;background:var(--surface)}.weather-grid span{color:var(--accent);font-size:8px}.weather-grid strong{font:20px "Times New Roman"}.weather-grid small{color:var(--faint);font-size:7px}.weather-panel>footer{display:flex;align-items:center;padding:0 13px;border-top:1px solid var(--line);color:var(--faint);font-size:7px}.ascend-chain{display:flex;align-items:center;gap:5px;padding:18px 14px 12px}.ascend-chain>span{display:grid;justify-items:center;gap:6px;color:var(--faint);font-size:7px;text-align:center}.ascend-chain>span i{display:grid;place-items:center;width:27px;height:27px;border:1px solid var(--line2);border-radius:50%;font-style:normal;background:#111814}.ascend-chain>span.active i{color:#09241a;border-color:var(--accent);background:var(--accent)}.ascend-chain>svg{color:var(--faint)}.ascend-panel>p{margin:0;padding:0 15px 13px;color:var(--muted);font-size:8px;line-height:1.55}.lineage-panel{display:grid;grid-template-rows:53px minmax(0,1fr) auto}.lineage-panel ol{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0;padding:17px 14px;list-style:none}.lineage-panel li{display:grid;gap:7px}.lineage-panel li>span{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;color:#09241a;font-size:8px;font-weight:800;background:var(--accent)}.lineage-panel li div{display:grid;gap:4px}.lineage-panel li strong{font-size:8px}.lineage-panel li small{display:-webkit-box;overflow:hidden;color:var(--faint);font-size:7px;line-height:1.4;-webkit-box-orient:vertical;-webkit-line-clamp:3}.lineage-panel>p{margin:0;padding:9px 14px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:7px}
.toast{position:fixed;z-index:60;right:20px;bottom:18px;display:flex;align-items:center;gap:7px;min-height:38px;padding:0 13px;border:1px solid rgba(105,216,176,.32);border-radius:6px;color:#dff5eb;font-size:9px;background:#14241d;box-shadow:0 7px 14px rgba(1,8,5,.22)}.toast svg{color:var(--accent)}.page-enter-active,.page-leave-active,.toast-enter-active,.toast-leave-active{transition:.18s cubic-bezier(.22,1,.36,1)}.page-enter-from{opacity:0;transform:translateY(5px)}.page-leave-to{opacity:0;transform:translateY(-3px)}.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(7px)}.spin{animation:spin .9s linear infinite}.pulse{animation:pulse 1.2s infinite}

/* Roadshow readability and hierarchy pass. */
.ops-app{
  --bg:#09100d;
  --surface:#121a17;
  --raised:#18231e;
  --line:rgba(228,240,234,.12);
  --line2:rgba(228,240,234,.21);
  --text:#f2f6f4;
  --muted:#afbbb5;
  --faint:#829087;
  --tech:#6eb8c6;
  font-size:14px;
  background:
    radial-gradient(circle at 56% -18%,rgba(64,139,108,.13),transparent 38%),
    var(--bg);
}
.sidebar{background:rgba(8,17,13,.98)}
.panel{border-color:var(--line);background:rgba(18,26,23,.97);box-shadow:inset 0 1px rgba(255,255,255,.018)}
.sidebar nav b{font-size:13px}.sidebar nav small{font-size:10px}
.side-status b{font-size:11px}.side-status small{font-size:9px}
.topbar>div:first-child small{font-size:10px}.topbar>div:first-child strong{font-size:15px}
.chain span{font-size:10px}.top-actions>span{font-size:11px}
.panel-title small{font-size:10px}.panel-title strong{font-size:15px}
.scenarios button{font-size:10px}
.request span,.field-grid label>span,.intensity>span,.assign>span,.case-note>span{font-size:11px}
.request textarea{font-size:12px;line-height:1.7}.request small{font-size:9px}
.field-grid select,.assign select{height:34px;font-size:11px}
.intensity small{font-size:9px}.primary{font-size:12px}.error{font-size:10px}
.map-head small{font-size:10px}.map-head strong{font-size:14px}.map-tabs button{font-size:10px}
.map-stage>img{filter:saturate(.7) contrast(1.08) brightness(.56)}
.route-halo{stroke:rgba(105,216,176,.3);stroke-width:14}
.route-main{stroke:#79e2bd;stroke-width:3.6}
.route-flow{stroke-width:1.4;stroke-dasharray:5 19;animation-duration:4.2s}
.map-city{
  position:absolute;
  z-index:2;
  padding:2px 5px;
  border-radius:3px;
  color:rgba(224,234,229,.58);
  font-size:9px;
  font-weight:650;
  letter-spacing:0;
  text-shadow:0 1px 3px #06100b;
  transform:translate(-50%,-50%);
  pointer-events:none;
}
.map-pin{z-index:5}.map-pin>b{width:30px;height:30px;font-size:10px}
.map-pin>span{min-width:104px;padding:7px 9px}.map-pin strong{font-size:11px}.map-pin small{font-size:9px}
.legend{font-size:9px}.legend small{font-size:8px}
.risk-focus>span{font-size:10px}.risk-focus p{font-size:10px}.risk-focus p b{font-size:12px}
.metrics small{font-size:9px}.route-summary{font-size:10px}
.info-tabs button,.dossier-tabs button{font-size:10px}.info-list p{font-size:10px}
.risk-link{font-size:11px}.model-note{font-size:9px}
.itinerary>header small{font-size:10px}.itinerary>header strong{font-size:12px}.day-tabs button{font-size:10px}
.stop-copy small{font-size:9px}.stop-copy strong{font-size:13px}.stop-copy em{font-size:10px}.stop-meta small{font-size:9px}
.page-head small{font-size:10px}.page-head h1{font-size:25px}.page-head p{font-size:12px}.page-head>button{font-size:11px}
.risk-queue>header small{font-size:10px}.risk-queue>header strong{font-size:12px}.risk-queue>header span{font-size:9px}
.risk-filters button{font-size:10px}.queue-list strong{font-size:11px}.queue-list small{font-size:9px}.queue-list em{font-size:9px}
.dossier>header small{font-size:10px}.dossier>header h2{font-size:16px}.dossier>header>strong span{font-size:9px}
.dossier-photo span{font-size:10px}.dossier-hero>div>small{font-size:10px}.dossier-hero>div>strong{font-size:15px}
.dossier-hero p{font-size:10px}.dossier-hero dt{font-size:9px}.dossier-hero dd{font-size:13px}
.factors>header span{font-size:11px}.factors>header small{font-size:9px}.factors>div span,.factors em{font-size:9px}
.evidence p{font-size:10px}
.response>header small{font-size:10px}.response>header strong{font-size:11px}.case-steps>span{font-size:9px}
.assign small{font-size:9px}.checklist>header span{font-size:11px}.checklist>header small{font-size:9px}
.checklist label>span{font-size:10px}.case-note textarea{font-size:10px}
.case-buttons button{min-height:36px;font-size:10px}
.case-buttons button:not(:disabled){color:#08231a;border-color:var(--accent);font-weight:750;background:var(--accent)}
.audit>header span{font-size:11px}.audit>header button{height:30px;font-size:9px}.audit p{font-size:9px}
.page-kpis span{font-size:10px}.page-kpis b{font-size:20px}
.resource-tools input,.resource-tools select{font-size:11px}.resource-tools>span{font-size:10px}
.table-head{font-size:10px}.resource-table>button{font-size:10px}.resource-table>button b{font-size:11px}
.resource-table-panel>footer{font-size:10px}.resource-photo span{font-size:10px}
.resource-copy small{font-size:10px}.resource-copy h2{font-size:18px}.resource-copy p{font-size:10px}
.resource-detail dt,.ascend-panel dt{font-size:9px}.resource-detail dd,.ascend-panel dd{font-size:10px}
.source small{font-size:10px}.source strong{font-size:11px}.source span{font-size:9px}.resource-buttons button{font-size:10px}
.service-list b{font-size:11px}.service-list small{font-size:9px}.service-list em{font-size:9px}.service-list time{font-size:10px}
.weather-grid span{font-size:10px}.weather-grid strong{font-size:22px}.weather-grid small{font-size:9px}.weather-panel>footer{font-size:9px}
.ascend-chain>span{font-size:9px}.ascend-panel>p{font-size:10px}.ascend-panel dl{align-self:end;margin-bottom:15px}
.lineage-panel li strong{font-size:10px}.lineage-panel li small{font-size:9px}.lineage-panel>p{font-size:9px}
.toast{font-size:11px}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes routeFlow{to{stroke-dashoffset:-52}}@keyframes pinIn{from{opacity:0;transform:translate(-14px,-3px) scale(.9)}to{opacity:1;transform:translate(-14px,-14px)}}@keyframes skeleton{to{background-position:-220% 0}}@keyframes pulse{50%{opacity:.4}}
@media(max-height:820px) and (min-width:1021px){
  .main{padding-top:78px;padding-bottom:10px}
  .dispatch-page{grid-template-rows:minmax(438px,1fr) 174px;gap:10px}
  .panel-title{padding-top:11px;padding-bottom:11px}
  .mission>.panel-title,.summary>.panel-title{padding-bottom:0}
  .scenarios{margin-top:9px}
  .request{gap:5px;margin-top:9px;padding:9px 10px}
  .request textarea{min-height:66px;line-height:1.55}
  .field-grid{gap:6px;margin-top:7px}
  .field-grid select{height:31px}
  .intensity{margin-top:7px}
  .primary{min-height:37px;margin-top:7px}
  .itinerary{padding-top:7px;padding-bottom:8px}
  .itinerary>header{height:30px}
  .route-cards{height:122px}
  .route-cards>button{height:112px}
  .thumb{height:94px}
}
@media(max-width:1260px){.sidebar{width:78px;padding-inline:8px}.brand{grid-template-columns:1fr;justify-items:center}.brand div,.sidebar nav small,.side-status span{display:none}.sidebar nav button{grid-template-columns:1fr;justify-items:center;padding:5px;text-align:center}.sidebar nav b{font-size:8px}.side-status{grid-template-columns:1fr;justify-items:center}.topbar{left:78px;grid-template-columns:minmax(210px,.8fr) minmax(390px,1.3fr) minmax(170px,.6fr)}.main{padding-left:96px}.dispatch-top{grid-template-columns:280px minmax(380px,1fr) 268px}.risk-grid{grid-template-columns:230px minmax(390px,1fr) 292px}}
@media(max-width:1020px){:global(.ops-body){overflow:auto}.topbar{grid-template-columns:1fr auto}.chain{display:none}.main{height:auto;min-height:100dvh;overflow:visible}.dispatch-page{grid-template-rows:auto auto}.dispatch-top{grid-template-columns:1fr 1fr}.map-panel{grid-column:1/-1;grid-row:1;min-height:520px}.mission,.summary{grid-row:2}.workspace-page{height:auto}.risk-grid,.resource-grid,.system-grid{grid-template-columns:1fr;grid-template-rows:auto}.risk-queue,.dossier,.response,.resource-table-panel,.resource-detail,.service-panel,.weather-panel,.ascend-panel,.lineage-panel{min-height:420px}}
@media(max-width:720px){.sidebar{right:0;bottom:auto;width:auto;height:60px;padding:6px 10px;border-right:0;border-bottom:1px solid var(--line)}.brand,.side-status{display:none}.sidebar nav{grid-template-columns:repeat(4,1fr);margin:0}.sidebar nav button{min-height:47px;grid-template-columns:20px 1fr;gap:4px;text-align:left}.topbar{top:60px;left:0;height:58px;padding:0 12px}.topbar small,.top-actions>span{display:none}.main{padding:130px 10px 12px}.dispatch-top{grid-template-columns:1fr}.map-panel,.mission,.summary{grid-column:1;grid-row:auto}.map-panel{min-height:460px}.map-pin>span{display:none}.legend small{display:none}.route-cards>button{flex-basis:82vw}.page-head{align-items:flex-start;flex-direction:column}.resource-tools{grid-template-columns:1fr}.resource-table{overflow-x:auto}.table-head,.resource-table>button{min-width:760px}.dossier-hero{grid-template-columns:1fr}.dossier-photo{width:100%;height:180px}.factors{grid-template-columns:1fr 1fr}.factors>header{grid-column:1/-1}.weather-grid{grid-template-columns:1fr 1fr}.lineage-panel ol{grid-template-columns:1fr}.ascend-chain{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.ops-app *,.ops-app *:before,.ops-app *:after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
</style>
