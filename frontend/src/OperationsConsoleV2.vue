<template>
  <div class="command-app">
    <header class="app-bar">
      <a class="brand" href="/" aria-label="返回山河守护首页">
        <span class="brand-mark">山</span>
        <span class="brand-copy">
          <strong>山河守护</strong>
          <small>全国复杂地形文旅安全平台</small>
        </span>
      </a>

      <nav class="workspace-nav" aria-label="管理端工作区">
        <button
          v-for="item in nav"
          :key="item.id"
          type="button"
          :class="{ active: view === item.id }"
          @click="switchView(item.id)"
        >
          <component :is="item.icon" :size="16" :stroke-width="1.8" />
          {{ item.label }}
        </button>
      </nav>

      <div class="bar-status">
        <span class="connection">
          <i :class="integration.health"></i>
          {{ connectionStatusLabel }}
        </span>
        <span v-if="weather.live?.length" class="weather-now">
          <CloudSun :size="15" />
          {{ weather.live[0].shortName }} {{ weather.live[0].weather }} {{ weather.live[0].temperature }}°
        </span>
        <button class="icon-button" type="button" title="刷新全部数据" :disabled="busy" @click="refreshAll">
          <RefreshCw :size="17" :class="{ spin: busy }" />
        </button>
      </div>
    </header>

    <main class="workspace">
      <Transition name="workspace" mode="out-in">
        <section v-if="view === 'dispatch'" key="dispatch" class="dispatch-view">
          <header class="page-heading">
            <div>
              <h1>路线调度</h1>
              <p>把游客需求转化为有证据、可执行、可处置的复杂地形行程。</p>
            </div>
            <div class="heading-facts">
              <span><b>{{ metrics.siteCount || routeSites.length }}</b> 个路线点位</span>
              <span><b>{{ metrics.averageRisk || "--" }}</b> 平均风险</span>
              <span><b>{{ metrics.serviceCoverage || "--" }}%</b> 应急覆盖</span>
            </div>
          </header>

          <section class="mission-composer">
            <div class="mission-copy">
              <label for="tour-request">游客需求</label>
              <textarea
                id="tour-request"
                v-model.trim="form.request"
                rows="2"
                aria-label="游客自然语言需求"
              ></textarea>
              <div class="mission-meta">
                <input
                  v-model.trim="form.destinationRegion"
                  list="operations-region-list"
                  aria-label="旅行区域"
                  placeholder="旅行区域"
                  @change="changeOperationsRegion"
                />
                <datalist id="operations-region-list">
                  <option v-for="region in travelRegions" :key="region" :value="region"></option>
                </datalist>
                <select v-model="form.origin" aria-label="出发城市" @change="changeOperationsOrigin">
                  <option v-if="!originCities.includes(form.origin)" :value="form.origin">{{ form.origin }}</option>
                  <option v-for="city in originCities" :key="city" :value="city">{{ city }}出发</option>
                </select>
                <select v-model="form.travelerType" aria-label="游客画像">
                  <option value="family">亲子家庭</option>
                  <option value="senior">老人同行</option>
                  <option value="study">研学团队</option>
                  <option value="wellness">康养慢游</option>
                </select>
                <select v-model.number="form.days" aria-label="行程天数">
                  <option v-for="day in 10" :key="day" :value="day">{{ day }} 天</option>
                </select>
                <select v-model="form.preference" aria-label="路线偏好">
                  <option value="safe">安全优先</option>
                  <option value="lowload">低强度</option>
                  <option value="culture">民族文化</option>
                  <option value="nature">山地自然</option>
                </select>
                <select v-model="form.routeMode" aria-label="优化策略">
                  <option value="safety-first">安全优先策略</option>
                  <option value="balanced">均衡体验策略</option>
                  <option value="experience-first">探索优先策略</option>
                </select>
                <select v-model="form.weather" aria-label="天气策略">
                  <option value="rain">小雨路滑</option>
                  <option value="clear">晴朗通行</option>
                  <option value="fog">山间大雾</option>
                  <option value="heat">高温暴晒</option>
                </select>
                <label class="intensity-control">
                  <span>强度 {{ form.intensity }}</span>
                  <input v-model.number="form.intensity" type="range" min="20" max="90" step="5" />
                </label>
              </div>
            </div>

            <div class="scenario-rail" aria-label="快速场景">
              <button
                v-for="scene in scenarios"
                :key="scene.id"
                type="button"
                :class="{ active: activeScenario === scene.id }"
                @click="applyScenario(scene)"
              >
                {{ scene.label }}
              </button>
            </div>

            <button class="primary-action" type="button" :disabled="generating" @click="generateRoute('manual')">
              <LoaderCircle v-if="generating" :size="18" class="spin" />
              <Sparkles v-else :size="18" />
              <span>{{ generating ? `${inferenceLabel} ${progress}%` : "生成安全路线" }}</span>
              <ChevronRight v-if="!generating" :size="18" />
            </button>
          </section>

          <p v-if="backend.error" class="inline-error">
            <AlertTriangle :size="16" />
            部分实时数据暂不可用，已采用安全预案计算
          </p>

          <section class="dispatch-stage">
            <article class="route-narrative">
              <header class="section-bar">
                <div>
                  <small>路线叙事</small>
                  <strong>{{ routeTitle }}</strong>
                </div>
                <div class="day-tabs">
                  <button
                    v-for="day in itinerary"
                    :key="day.day"
                    type="button"
                    :class="{ active: Number(activeDay) === Number(day.day) }"
                    @click="setActiveDay(day.day)"
                  >
                    第 {{ day.day }} 天
                  </button>
                </div>
              </header>

              <div class="route-story">
                <svg class="route-thread" viewBox="0 0 40 520" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M20 12 C2 78 36 118 20 180 S5 286 20 350 S35 438 20 508" />
                  <path d="M20 12 C2 78 36 118 20 180 S5 286 20 350 S35 438 20 508" />
                </svg>

                <button
                  v-for="(site, index) in activeDaySites"
                  :key="site.id"
                  type="button"
                  class="story-stop"
                  :class="{ active: selectedId === site.id }"
                  @click="selectSite(site.id)"
                >
                  <span class="stop-sequence">{{ String(index + 1).padStart(2, "0") }}</span>
                  <span class="stop-photo">
                    <img
                      v-if="canShowImage(site)"
                      :src="imageFor(site)"
                      :alt="site.name"
                      @error="markImageFailed(site)"
                    />
                    <span v-else><MapPin :size="20" />{{ normalizeCity(site.city) }}</span>
                  </span>
                  <span class="stop-content">
                    <small>
                      {{ normalizeCity(site.city) }} · {{ site.county || "景区点位" }}
                      <template v-if="scheduleForSite(site.id)"> · {{ scheduleForSite(site.id).arrivalTime }}-{{ scheduleForSite(site.id).departureTime }}</template>
                    </small>
                    <strong>{{ compactName(site.shortName || site.name) }}</strong>
                    <em>{{ site.primaryRisk }}</em>
                    <span class="stop-stats">
                      <span v-if="legForSite(site)">路程 <b>{{ legForSite(site).distanceKm }} km</b></span>
                      <span v-else>步行 <b>{{ site.distance || `${site.distanceKm || "--"} km` }}</b></span>
                      <span v-if="legForSite(site)">车程 <b>{{ legForSite(site).durationMinutes }} 分</b></span>
                      <span v-else>坡度 <b>{{ site.slope ?? "--" }}°</b></span>
                      <span>服务 <b>{{ Math.round(site.serviceCoverage || 0) }}%</b></span>
                    </span>
                  </span>
                  <span class="risk-score" :class="riskClass(site.riskScore)">
                    <b>{{ site.riskScore }}</b>
                    <small>{{ riskLabel(site.riskScore) }}</small>
                  </span>
                </button>

                <div v-if="!activeDaySites.length" class="empty-state">
                  <Route :size="26" />
                  <strong>当前日期暂无路线点位</strong>
                  <span>调整行程天数后重新生成路线。</span>
                </div>
              </div>
            </article>

            <aside class="map-decision">
              <img
                class="map-image"
                :src="mapImageSrc"
                :alt="`${form.destinationRegion}路线地理底图`"
                @error="handleMapImageError"
              />
              <div class="map-scrim"></div>
              <svg class="route-overlay" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
                <path class="route-halo" :d="routePath" />
                <path class="route-line" :d="routePath" />
                <path class="route-flow" :d="routePath" />
              </svg>

              <header class="map-heading">
                <div>
                  <small>{{ mapScope === "all" ? "全程安全态势" : `第 ${activeDay} 天安全态势` }}</small>
                  <strong>路线地理态势</strong>
                </div>
                <div class="map-controls">
                  <div class="map-scope" aria-label="地图行程范围">
                    <button type="button" :class="{ active: mapScope === 'day' }" @click="mapScope = 'day'">当日</button>
                    <button type="button" :class="{ active: mapScope === 'all' }" @click="mapScope = 'all'">全程</button>
                  </div>
                  <div class="map-modes" aria-label="地图信息图层">
                    <button
                      v-for="mode in mapModes"
                      :key="mode.id"
                      type="button"
                      :class="{ active: mapMode === mode.id }"
                      @click="mapMode = mode.id"
                    >
                      {{ mode.label }}
                    </button>
                  </div>
                </div>
              </header>

              <button
                v-for="(site, index) in mapSites"
                :key="`${site.id}-${routeVersion}`"
                type="button"
                class="map-pin"
                :class="[riskClass(site.riskScore), { active: selectedId === site.id }]"
                :style="pinStyle(site, index)"
                @click="selectSite(site.id)"
              >
                <i>{{ index + 1 }}</i>
                <span>
                  <strong>{{ compactName(site.shortName || site.name) }}</strong>
                  <small v-if="mapMode === 'risk'">{{ site.riskScore }} 分 · {{ riskLabel(site.riskScore) }}</small>
                  <small v-else-if="mapMode === 'service'">服务覆盖 {{ Math.round(site.serviceCoverage || 0) }}%</small>
                  <small v-else>{{ normalizeCity(site.city) }} · 第 {{ routeDayFor(site.id) }} 天</small>
                </span>
              </button>

              <div class="decision-brief">
                <header>
                  <div>
                    <small>AI 决策摘要</small>
                    <strong>{{ compactName(highestRiskSite?.shortName || highestRiskSite?.name) }}为本路线最高风险点</strong>
                  </div>
                  <b :class="riskClass(highestRiskSite?.riskScore)">{{ highestRiskSite?.riskScore || "--" }}</b>
                </header>
                <p>{{ decisionSummary }}</p>
                <div v-if="optimization" class="optimization-evidence">
                  <span><small>策略</small><b>{{ optimization.selectedLabel }}</b></span>
                  <span><small>优化分</small><b>{{ optimization.objectiveScore }}</b></span>
                  <span><small>硬约束</small><b>{{ optimization.constraintsPassed }}/{{ optimization.constraintsTotal }}</b></span>
                  <span><small>工具链</small><b>{{ agentTrace?.totalMs ?? '--' }} ms</b></span>
                </div>
                <div class="decision-actions">
                  <span v-for="(item, index) in selectedActions.slice(0, 4)" :key="item">
                    <i>{{ index + 1 }}</i>{{ item }}
                  </span>
                </div>
                <button type="button" @click="switchView('risk')">
                  进入安全指挥
                  <ChevronRight :size="16" />
                </button>
              </div>

              <div v-if="generating" class="inference-layer">
                <BrainCircuit :size="28" />
                <strong>{{ inferenceLabel }}</strong>
                <span>{{ progress }}%</span>
                <i><b :style="{ transform: `scaleX(${progress / 100})` }"></b></i>
              </div>
            </aside>
          </section>

        </section>

        <section v-else-if="view === 'risk'" key="risk" class="risk-view">
          <header class="page-heading">
            <div>
              <h1>安全指挥</h1>
              <p>一条风险从证据确认、资源联动到现场闭环，都有明确责任和审计记录。</p>
            </div>
            <div class="filter-buttons">
              <button
                v-for="filter in riskFilters"
                :key="filter.id"
                type="button"
                :class="{ active: riskFilter === filter.id }"
                @click="riskFilter = filter.id"
              >
                {{ filter.label }}
              </button>
            </div>
          </header>

          <div class="incident-strip">
            <button
              v-for="site in filteredRiskSites"
              :key="site.id"
              type="button"
              :class="{ active: selectedId === site.id }"
              @click="selectSite(site.id)"
            >
              <b :class="riskClass(site.riskScore)">{{ site.riskScore }}</b>
              <span>
                <strong>{{ compactName(site.shortName || site.name) }}</strong>
                <small>{{ site.primaryRisk }}</small>
              </span>
              <em :class="`case-${caseFor(site.id).status}`">{{ caseStatusLabel(caseFor(site.id).status) }}</em>
            </button>
          </div>

          <section class="risk-workbench">
            <article class="risk-dossier">
              <div class="dossier-visual">
                <img
                  v-if="canShowImage(selectedSite)"
                  :src="imageFor(selectedSite)"
                  :alt="selectedSite?.name"
                  @error="markImageFailed(selectedSite)"
                />
                <div v-else class="photo-empty"><MapPin :size="30" />{{ normalizeCity(selectedSite?.city) }}</div>
                <div class="visual-shade"></div>
                <div class="dossier-copy">
                  <small>{{ normalizeCity(selectedSite?.city) }} · {{ selectedSite?.county }}</small>
                  <h2>{{ selectedSite?.name }}</h2>
                  <p>{{ selectedExplanation?.reason || selectedSite?.primaryRisk }}</p>
                  <dl>
                    <div><dt>坡度</dt><dd>{{ selectedSite?.slope ?? "--" }}°</dd></div>
                    <div><dt>步行</dt><dd>{{ selectedSite?.distance || `${selectedSite?.distanceKm || "--"} km` }}</dd></div>
                    <div><dt>服务覆盖</dt><dd>{{ Math.round(selectedSite?.serviceCoverage || 0) }}%</dd></div>
                    <div><dt>客流压力</dt><dd>{{ selectedSite?.crowdScore || selectedSite?.congestionBase || "--" }}</dd></div>
                  </dl>
                </div>
                <div class="dossier-score">
                  <b :class="riskClass(selectedSite?.riskScore)">{{ selectedSite?.riskScore }}</b>
                  <span>{{ riskLabel(selectedSite?.riskScore) }} · 建议干预</span>
                </div>
              </div>

              <div class="factor-rail">
                <div v-for="factor in riskFactors" :key="factor.label">
                  <span>{{ factor.label }}</span>
                  <i><b :style="{ transform: `scaleX(${factor.value / 100})` }"></b></i>
                  <em>{{ factor.value }}</em>
                </div>
              </div>

              <div class="evidence-header">
                <div>
                  <strong>风险证据</strong>
                  <span>天气、地形、客流、同行人群与服务资源共同计算</span>
                </div>
                <div class="evidence-tabs">
                  <button type="button" :class="{ active: dossierTab === 'evidence' }" @click="dossierTab = 'evidence'">证据</button>
                  <button type="button" :class="{ active: dossierTab === 'actions' }" @click="dossierTab = 'actions'">动作</button>
                  <button type="button" :class="{ active: dossierTab === 'sources' }" @click="dossierTab = 'sources'">来源</button>
                </div>
              </div>

              <div class="evidence-grid">
                <div v-if="explanationLoading" v-for="index in 6" :key="index" class="skeleton"></div>
                <p v-else v-for="(item, index) in dossierItems" :key="item">
                  <i>{{ index + 1 }}</i>
                  {{ item }}
                </p>
              </div>
            </article>

            <aside class="response-console">
              <header>
                <div>
                  <small>{{ currentCase.updatedAt ? "处置记录已同步" : "处置工作台" }}</small>
                  <strong>{{ compactName(selectedSite?.shortName || selectedSite?.name) }}风险事件</strong>
                </div>
                <b>{{ completeness }}%</b>
              </header>

              <div class="case-steps">
                <span
                  v-for="(step, index) in caseSteps"
                  :key="step.id"
                  :class="{ done: caseStepIndex > index, current: currentCase.status === step.id }"
                >
                  <i>{{ index + 1 }}</i>
                  {{ step.label }}
                </span>
              </div>

              <label class="assign-control">
                <span>联动资源</span>
                <select v-model="currentCase.assignee" @change="recordAssignment">
                  <option value="">选择处置资源</option>
                  <option v-for="service in selectedServices" :key="service" :value="service">{{ service }}</option>
                </select>
                <small>当前服务覆盖 {{ Math.round(selectedSite?.serviceCoverage || 0) }}%，{{ emergencyGapText }}</small>
              </label>

              <div class="action-checklist">
                <header>
                  <span>现场动作</span>
                  <small>{{ currentCase.checkedActions.length }} / {{ selectedActions.length }} 已完成</small>
                </header>
                <label v-for="action in selectedActions" :key="action">
                  <input
                    type="checkbox"
                    :checked="currentCase.checkedActions.includes(action)"
                    @change="toggleAction(action)"
                  />
                  <span><Check :size="14" />{{ action }}</span>
                </label>
              </div>

              <label class="case-note">
                <span>处置记录</span>
                <textarea
                  v-model.trim="currentCase.note"
                  rows="3"
                  placeholder="记录现场反馈、替代路线或资源响应结果"
                  @change="persistCase('更新处置备注')"
                ></textarea>
              </label>

              <div class="response-actions">
                <button type="button" @click="exportCase">
                  <Download :size="15" />
                  导出处置单
                </button>
                <button
                  v-if="currentCase.status === 'pending'"
                  class="primary"
                  type="button"
                  @click="advanceCase('confirmed')"
                >
                  确认风险
                </button>
                <button
                  v-else-if="currentCase.status === 'confirmed'"
                  class="primary"
                  type="button"
                  :disabled="!currentCase.assignee"
                  @click="advanceCase('responding')"
                >
                  启动现场处置
                </button>
                <button
                  v-else-if="currentCase.status === 'responding'"
                  class="primary"
                  type="button"
                  :disabled="!currentCase.checkedActions.length"
                  @click="advanceCase('closed')"
                >
                  完成闭环
                </button>
                <button v-else class="primary" type="button" disabled>
                  已完成闭环
                </button>
              </div>

              <div v-if="currentCase.logs.length" class="audit-log">
                <header><span>审计留痕</span><small>{{ currentCase.logs.length }} 条记录</small></header>
                <p v-for="(item, index) in currentCase.logs.slice().reverse().slice(0, 4)" :key="`${item.time}-${index}`">
                  <time>{{ item.time }}</time>{{ item.text }}
                </p>
              </div>
            </aside>
          </section>
        </section>

        <section v-else-if="view === 'resources'" key="resources" class="resources-view">
          <header class="page-heading">
            <div>
              <h1>景区资源</h1>
              <p>检索当前旅行区域的景区候选，查看评分与数据来源，并直接纳入路线规划。</p>
            </div>
            <div class="heading-facts">
              <span><b>{{ integration.scenicTotal }}</b> 景区 POI</span>
              <span><b>{{ cityOptions.length }}</b> 市州覆盖</span>
            </div>
          </header>

          <section class="resource-workbench">
            <article class="resource-list">
              <header class="resource-tools">
                <label>
                  <Search :size="17" />
                  <input v-model.trim="resourceQuery" type="search" aria-label="搜索景区资源" placeholder="搜索景区、城市、区县或地址" />
                  <button v-if="resourceQuery" type="button" title="清空搜索" @click="resourceQuery = ''">
                    <X :size="15" />
                  </button>
                </label>
                <select v-model="cityFilter" aria-label="按市州筛选">
                  <option value="">全部市州</option>
                  <option v-for="city in cityOptions" :key="city" :value="city">{{ city }}</option>
                </select>
                <span>{{ filteredScenic.length }} 条结果</span>
              </header>

              <div class="resource-table">
                <div class="table-head">
                  <span>景区资源</span><span>区域</span><span>评分</span><span>假日热度</span>
                </div>
                <div v-if="resourceLoading" class="resource-loading">
                  <i v-for="index in 12" :key="index"></i>
                </div>
                <button
                  v-else
                  v-for="spot in pagedScenic"
                  :key="spot.id"
                  type="button"
                  :class="{ active: selectedScenicId === spot.id }"
                  @click="selectedScenicId = spot.id"
                >
                  <span><MapPin :size="15" /><b>{{ spot.name }}</b></span>
                  <span>{{ normalizeCity(spot.city) }} · {{ spot.district || "景区" }}</span>
                  <span>{{ spot.rating || "--" }}</span>
                  <span class="heat-cell"><i><b :style="{ transform: `scaleX(${(spot.holidayHeatSeed || 50) / 100})` }"></b></i>{{ spot.holidayHeatSeed || "--" }}</span>
                </button>
              </div>

              <footer class="pagination">
                <span>第 {{ resourcePage }} / {{ resourcePageCount }} 页</span>
                <div>
                  <button type="button" title="上一页" :disabled="resourcePage <= 1" @click="resourcePage--">
                    <ChevronLeft :size="17" />
                  </button>
                  <button type="button" title="下一页" :disabled="resourcePage >= resourcePageCount" @click="resourcePage++">
                    <ChevronRight :size="17" />
                  </button>
                </div>
              </footer>
            </article>

            <aside class="resource-dossier">
              <div class="resource-photo">
                <img
                  v-if="canShowScenicImage(selectedScenic)"
                  :src="scenicImageFor(selectedScenic)"
                  :alt="selectedScenic?.name"
                  @error="markScenicImageFailed(selectedScenic)"
                />
                <div v-else><MapPin :size="28" />暂无可核验实景图</div>
                <span>景区实景</span>
              </div>
              <div class="resource-copy">
                <small>{{ normalizeCity(selectedScenic?.city) }} · {{ selectedScenic?.district }}</small>
                <h2>{{ selectedScenic?.name || `${form.destinationRegion}景区资源` }}</h2>
                <p>{{ selectedScenic?.address || `已纳入${form.destinationRegion}旅行候选池。` }}</p>
              </div>
              <dl class="resource-metrics">
                <div><dt>游客评分</dt><dd>{{ selectedScenic?.rating || "--" }}</dd></div>
                <div><dt>假日热度</dt><dd>{{ selectedScenic?.holidayHeatSeed || "--" }}</dd></div>
                <div><dt>规划状态</dt><dd>已纳入</dd></div>
              </dl>
              <div class="resource-source">
                <small>资源能力</small>
                <strong>可直接参与路线与风险计算</strong>
                <p>系统结合景区位置、假日热度、天气和游客画像，动态调整游览顺序与安全建议。</p>
              </div>
              <div class="resource-actions">
                <button class="primary" type="button" @click="planWithScenic(selectedScenic)">
                  <Route :size="16" />纳入路线规划
                </button>
                <button type="button" @click="openAmap(selectedScenic)">
                  <Navigation :size="16" />高德查看
                </button>
              </div>
            </aside>
          </section>
        </section>

        <section v-else key="system" class="system-view">
          <header class="page-heading">
            <div>
              <h1>运行监测</h1>
              <p>检查核心服务、实时天气、数据血缘与昇腾推理适配状态。</p>
            </div>
            <button class="secondary-action" type="button" :disabled="testing" @click="testServices">
              <LoaderCircle v-if="testing" :size="17" class="spin" />
              <Activity v-else :size="17" />
              {{ testing ? "检测中" : "检测核心接口" }}
            </button>
          </header>

          <div class="system-summary">
            <span><b>{{ integration.health === "checking" ? "--" : connectedCount }}/{{ visibleServices.length }}</b><small>{{ integration.health === "checking" ? "核心服务检测中" : "核心服务可用" }}</small></span>
            <span><b>{{ weather.live?.length || 0 }}/9</b><small>市州天气实时</small></span>
            <span><b>{{ integration.scenicTotal }}</b><small>真实景区 POI</small></span>
            <span><b>{{ integration.remote ? "远程" : "本地" }}</b><small>当前推理模式</small></span>
          </div>

          <section class="system-workbench">
            <article class="service-matrix">
              <header class="section-bar">
                <div><small>核心服务</small><strong>接口健康与响应延迟</strong></div>
                <span>状态以当前检测结果为准</span>
              </header>
              <div class="service-table">
                <div v-for="service in visibleServices" :key="service.id">
                  <i :class="serviceTone(service)"><Server :size="16" /></i>
                  <span><b>{{ service.name }}</b><small>{{ service.endpoint }}</small></span>
                  <em :class="serviceTone(service)">{{ serviceLabel(service) }}</em>
                  <time>{{ checks[service.id]?.latency ? `${checks[service.id].latency} ms` : "--" }}</time>
                </div>
              </div>
            </article>

            <aside class="system-detail">
              <section class="weather-board">
                <header>
                <div><small>全国城市天气</small><strong>{{ weather.status === "live" ? "实时连接" : "等待配置" }}</strong></div>
                  <span>{{ weather.provider || "高德天气" }}</span>
                </header>
                <div class="weather-grid">
                  <div v-for="city in weather.live" :key="city.adcode">
                    <span>{{ city.shortName }}</span>
                    <b>{{ city.temperature }}°</b>
                    <small>{{ city.weather }} · 湿度 {{ city.humidity }}%</small>
                  </div>
                </div>
              </section>

              <section class="ascend-board">
                <header>
                  <div><small>昇腾推理适配</small><strong>{{ integration.remote ? "远程推理已连接" : "适配器已就绪" }}</strong></div>
                  <Cpu :size="19" />
                </header>
                <div class="ascend-chain">
                  <template v-for="(step, index) in ascend.chain || decisionChain" :key="step">
                    <span :class="{ active: index <= 1 || integration.remote }"><i>{{ index + 1 }}</i>{{ step }}</span>
                    <ChevronRight v-if="index < (ascend.chain || decisionChain).length - 1" :size="14" />
                  </template>
                </div>
                <p>{{ ascend.demoMessage || "已预留 ASCEND_INFERENCE_URL 和输入输出契约。" }}</p>
                <dl>
                  <div><dt>输入契约</dt><dd>{{ ascend.adapterContract?.input?.length || 6 }} 类字段</dd></div>
                  <div><dt>输出契约</dt><dd>{{ ascend.adapterContract?.output?.length || 5 }} 类结果</dd></div>
                  <div><dt>部署状态</dt><dd>{{ integration.remote ? "远程在线" : "待配置地址" }}</dd></div>
                </dl>
              </section>
            </aside>

            <article class="lineage-board">
              <header>
                <div><small>决策数据血缘</small><strong>{{ lineage.datasets?.length || 0 }} 个数据集进入决策链</strong></div>
                <Database :size="19" />
              </header>
              <ol>
                <li v-for="(step, index) in lineage.pipeline" :key="step.step">
                  <span>{{ index + 1 }}</span>
                  <div><strong>{{ step.step }}</strong><small>{{ step.output }}</small></div>
                </li>
              </ol>
              <p>{{ lineage.auditNote }}</p>
            </article>
          </section>
        </section>
      </Transition>
    </main>

    <Transition name="toast">
      <div v-if="toast" class="toast"><CircleCheck :size="17" />{{ toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  Activity, AlertTriangle, BrainCircuit, Check, ChevronLeft, ChevronRight, CircleCheck,
  CloudSun, Cpu, Database, Download, LoaderCircle, MapPin, MapPinned, Navigation,
  RefreshCw, Route, Search, Server, ShieldCheck, Sparkles, X,
} from "@lucide/vue";
import fanjingshanImage from "./assets/scenic/fanjingshan.webp";
import huangguoshuImage from "./assets/scenic/huangguoshu.webp";
import liboImage from "./assets/scenic/libo.webp";
import qingyanImage from "./assets/scenic/qingyan.webp";
import wanfenglinImage from "./assets/scenic/wanfenglin.webp";
import xijiangImage from "./assets/scenic/xijiang.webp";
import zhijinImage from "./assets/scenic/zhijin.webp";
import { readRouteSession, subscribeRouteSession, writeRouteSession } from "./routeSession.js";
import staticMapFallback from "./assets/guizhou-static-map-fallback.png";

const nav = [
  { id: "dispatch", label: "路线调度", icon: markRaw(Route) },
  { id: "risk", label: "安全指挥", icon: markRaw(ShieldCheck) },
  { id: "resources", label: "景区资源", icon: markRaw(MapPinned) },
  { id: "system", label: "运行监测", icon: markRaw(Activity) },
];
const decisionChain = ["游客需求", "后端代理", "MindIE/vLLM Ascend", "风险模型", "决策摘要"];
const travelRegions = ["贵州", "阿坝", "丽江", "张家界", "桂林", "黄山", "泰安", "渭南", "延边", "南平", "恩施", "上饶", "神农架", "宜昌", "呼伦贝尔", "海南州", "酒泉", "林芝", "三亚", "大理"];
const originCities = ["北京", "上海", "广州", "深圳", "成都", "重庆", "西安", "昆明", "长沙", "武汉", "杭州", "南京", "贵阳", "遵义", "六盘水", "安顺", "毕节", "铜仁", "凯里", "都匀", "兴义"];
const mapModes = [{ id: "route", label: "路线" }, { id: "risk", label: "风险" }, { id: "service", label: "服务" }];
const riskFilters = [{ id: "all", label: "全部事件" }, { id: "attention", label: "需立即关注" }, { id: "open", label: "未闭环" }];
const caseSteps = [{ id: "pending", label: "待研判" }, { id: "confirmed", label: "已确认" }, { id: "responding", label: "处置中" }, { id: "closed", label: "已闭环" }];
const scenarios = [
  { id: "family", label: "贵州样板", selectedSiteNames: ["青岩古镇", "黄果树旅游景区", "织金洞景区"], form: { request: "带父母和孩子去贵州玩两天，不想太累，担心下雨路滑，希望路线安全、有休息点和应急服务。", destinationRegion: "贵州", origin: "贵阳", travelerType: "family", weather: "rain", days: 2, preference: "safe", intensity: 42 } },
  { id: "study", label: "张家界研学", selectedSiteNames: ["武陵源风景名胜区", "天门山国家森林公园"], form: { request: "从长沙出发去张家界，30 人研学团队安排三天，关注地貌、集合安全和承载能力。", destinationRegion: "张家界", origin: "长沙", travelerType: "study", weather: "clear", days: 3, preference: "culture", intensity: 58 } },
  { id: "senior", label: "丽江康养", selectedSiteNames: ["丽江古城", "玉龙雪山"], form: { request: "从昆明出发去丽江，带老人康养慢游三天，少爬坡、医疗可达，天气变化时给出备选方案。", destinationRegion: "丽江", origin: "昆明", travelerType: "senior", weather: "fog", days: 3, preference: "lowload", intensity: 32 } },
  { id: "nature", label: "川西探索", selectedSiteNames: ["九寨沟风景名胜区", "黄龙风景名胜区"], form: { request: "从成都出发去阿坝体验九寨沟和黄龙，可以有适度强度，但要规避恶劣天气并解释推荐原因。", destinationRegion: "阿坝", origin: "成都", travelerType: "family", weather: "clear", days: 3, preference: "nature", intensity: 66 } },
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
  { id: "health", name: "健康检查", endpoint: "/api/health", status: "connected" },
  { id: "scenic-spots", name: "全国景区动态候选池", endpoint: "/api/scenic-spots", status: "connected" },
  { id: "holiday-tourism", name: "节假日文旅热度样本", endpoint: "/api/holiday-tourism", status: "connected" },
  { id: "tourism-route-plan", name: "山地旅游路线生成", endpoint: "/api/tourism/route-plan", status: "connected" },
  { id: "tourism-risk-explanation", name: "单点风险解释", endpoint: "/api/tourism/risk-explanation", status: "connected" },
  { id: "tourism-emergency-coverage", name: "应急服务覆盖评估", endpoint: "/api/tourism/emergency-coverage", status: "connected" },
  { id: "tourism-incidents", name: "安全事件持久化", endpoint: "/api/tourism/incidents", status: "connected" },
  { id: "tourism-live-weather", name: "全国城市天气实况与预报", endpoint: "/api/tourism/live-weather", status: "live" },
  { id: "tourism-emergency-nearby", name: "真实应急资源周边检索", endpoint: "/api/tourism/emergency-nearby", status: "live" },
  { id: "tourism-static-map", name: "高德真实地理底图", endpoint: "/api/tourism/static-map", status: "live" },
  { id: "tourism-data-lineage", name: "数据血缘与审计链路", endpoint: "/api/tourism/data-lineage", status: "connected" },
  { id: "ascend-readiness", name: "昇腾推理适配状态", endpoint: "/api/tourism/ascend-readiness", status: "adapter-ready" },
];

const view = ref("dispatch");
const activeScenario = ref("family");
const form = reactive({ routeMode: "safety-first", ...scenarios[0].form });
const selectedSiteNames = ref([...scenarios[0].selectedSiteNames]);
const mapMode = ref("route");
const mapScope = ref("day");
const dossierTab = ref("evidence");
const riskFilter = ref("all");
const activeDay = ref(1);
const selectedId = ref(fallbackSites[0].id);
const selectedScenicId = ref("");
const resourceQuery = ref("");
const cityFilter = ref("");
const resourcePage = ref(1);
const resourcePageSize = 12;
const scenicSpots = ref([]);
const generating = ref(false);
const progress = ref(0);
const routeVersion = ref(0);
const explanationLoading = ref(false);
const resourceLoading = ref(false);
const testing = ref(false);
const toast = ref("");
const failedImages = reactive({});
const failedScenicImages = reactive({});
const mapImageSrc = ref(`/api/tourism/static-map?v=${Date.now()}`);
const cases = reactive({});
const checks = reactive({});
const integration = reactive({ health: "checking", remote: false, services: [], scenicTotal: 2017, scenicFreshness: "", holidayRecords: 3 });
const backend = reactive({ route: null, explanation: null, emergency: null, error: "" });
const weather = reactive({ status: "loading", provider: "", refreshedAt: "", live: [] });
const ascend = reactive({ status: "loading", chain: [], adapterContract: null, demoMessage: "" });
const lineage = reactive({ pipeline: [], datasets: [], auditNote: "" });
let progressTimer;
let toastTimer;
let unsubscribeRouteSession;

const connectionStatusLabel = computed(() => {
  if (integration.health === "checking") return "系统检测中";
  if (["error", "offline"].includes(integration.health)) return "部分服务降级";
  return "系统在线";
});
const routeSites = computed(() => backend.route?.sites?.length ? backend.route.sites : fallbackSites);
const metrics = computed(() => backend.route?.metrics || {
  siteCount: routeSites.value.length,
  averageRisk: Math.round(routeSites.value.reduce((sum, site) => sum + Number(site.riskScore || 0), 0) / Math.max(1, routeSites.value.length)),
  serviceCoverage: Math.round(routeSites.value.reduce((sum, site) => sum + Number(site.serviceCoverage || 0), 0) / Math.max(1, routeSites.value.length)),
});
const optimization = computed(() => backend.route?.optimization || null);
const agentTrace = computed(() => backend.route?.agentTrace || null);
const selectedSite = computed(() => routeSites.value.find(site => site.id === selectedId.value) || routeSites.value[0]);
const selectedExplanation = computed(() => backend.explanation);
const sortedRiskSites = computed(() => [...routeSites.value].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0)));
const itinerary = computed(() => backend.route?.itinerary?.length
  ? backend.route.itinerary
  : Array.from({ length: Math.max(1, Number(form.days)) }, (_, index) => ({
      day: index + 1,
      sites: routeSites.value.slice(index * 3, index * 3 + 3).map(site => site.id),
    })).filter(day => day.sites.length));
const executableScheduleEntries = computed(() => (backend.route?.executableSchedule?.days || [])
  .flatMap(day => day.entries || []));
const activeDaySites = computed(() => (itinerary.value.find(day => Number(day.day) === Number(activeDay.value))?.sites || [])
  .map(id => routeSites.value.find(site => site.id === id))
  .filter(Boolean));
const mapSites = computed(() => mapScope.value === "all" ? routeSites.value : activeDaySites.value);
const mapViewport = computed(() => {
  const points = mapSites.value
    .map(site => site.lngLat)
    .filter(point => Array.isArray(point) && point.length === 2 && point.every(value => Number.isFinite(Number(value))))
    .map(point => mercatorUnit(point));
  if (!points.length) return { zoom: 6, center: [106.7, 26.8], centerUnit: mercatorUnit([106.7, 26.8]) };
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(0.00001, maxX - minX);
  const spanY = Math.max(0.00001, maxY - minY);
  const fitX = Math.log2((1000 * 0.72) / (spanX * 256));
  const fitY = Math.log2((560 * 0.68) / (spanY * 256));
  const zoom = points.length === 1 ? 10 : Math.max(5, Math.min(13, Math.floor(Math.min(fitX, fitY))));
  const centerUnit = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return { zoom, center: mercatorUnitToLngLat(centerUnit), centerUnit };
});
const mapImageUrl = computed(() => {
  const { center, zoom } = mapViewport.value;
  return `/api/tourism/static-map?location=${encodeURIComponent(`${center[0].toFixed(6)},${center[1].toFixed(6)}`)}&zoom=${zoom}`;
});
const roadLegs = computed(() => backend.route?.roadData?.legs || []);
const mapRoadLegs = computed(() => {
  const ids = new Set(mapSites.value.map(site => site.id));
  return roadLegs.value.filter(leg => ids.has(leg.fromId) && ids.has(leg.toId));
});
const roadMapPoints = computed(() => mapRoadLegs.value
  .flatMap(leg => leg.polyline || [])
  .filter((point, index, list) => index === 0 || point[0] !== list[index - 1][0] || point[1] !== list[index - 1][1]));
const mapRoadStats = computed(() => ({
  live: mapRoadLegs.value.length > 0 && mapRoadLegs.value.every(leg => leg.dataType === "realtime-route"),
  distanceKm: Math.round(mapRoadLegs.value.reduce((sum, leg) => sum + Number(leg.distanceKm || 0), 0) * 10) / 10,
  durationMinutes: mapRoadLegs.value.reduce((sum, leg) => sum + Number(leg.durationMinutes || 0), 0),
}));
const highestRiskSite = computed(() => [...mapSites.value].sort((a, b) => Number(b.riskScore || 0) - Number(a.riskScore || 0))[0]);
const routeTitle = computed(() => backend.route?.routeTitle || `${form.origin || "自定义地点"}出发 · ${form.destinationRegion || "贵州"}安全线`);
const fallbackSummary = computed(() => `系统已识别${travelerLabel(form.travelerType)}、${weatherLabel(form.weather)}和${preferenceLabel(form.preference)}约束，生成 ${routeSites.value.length} 个安全点位。`);
const decisionSummary = computed(() => {
  if (mapScope.value === "all") return backend.route?.summary || fallbackSummary.value;
  const sites = activeDaySites.value;
  const averageRisk = sites.length
    ? Math.round(sites.reduce((sum, site) => sum + Number(site.riskScore || 0), 0) / sites.length)
    : 0;
  const roadText = mapRoadStats.value.live
    ? `高德道路 ${mapRoadStats.value.distanceKm} 公里、预计 ${mapRoadStats.value.durationMinutes} 分钟。`
    : "当前线路为点位关系示意。";
  return `第 ${activeDay.value} 天共 ${sites.length} 个点位，平均风险 ${averageRisk}。${roadText}`;
});
const selectedActions = computed(() => (selectedExplanation.value?.suggestedActions || selectedSite.value?.actions || []).map(normalizeItem).filter(Boolean).slice(0, 6));
const selectedEvidence = computed(() => (selectedExplanation.value?.evidence || selectedSite.value?.evidence || []).map(normalizeItem).filter(Boolean).slice(0, 8));
const selectedServices = computed(() => (selectedExplanation.value?.emergencyServices || selectedSite.value?.services || ["景区游客服务点", "属地医疗急救资源", "停车或换乘服务"]).map(normalizeItem).filter(Boolean).slice(0, 6));
const dossierItems = computed(() => dossierTab.value === "actions"
  ? selectedActions.value
  : dossierTab.value === "sources"
    ? (selectedExplanation.value?.dataSources || selectedSite.value?.sources || []).map(normalizeItem).filter(Boolean)
    : selectedEvidence.value);
const currentCase = computed(() => caseFor(selectedSite.value?.id));
const caseStepIndex = computed(() => Math.max(0, caseSteps.findIndex(step => step.id === currentCase.value.status)));
const completeness = computed(() => {
  let score = [10, 35, 65, 100][caseStepIndex.value];
  if (currentCase.value.status !== "closed") {
    if (currentCase.value.assignee) score += 8;
    if (currentCase.value.note) score += 7;
    score += Math.round((currentCase.value.checkedActions.length / Math.max(1, selectedActions.value.length)) * 20);
  }
  return Math.min(100, score);
});
const filteredRiskSites = computed(() => sortedRiskSites.value.filter(site => {
  if (riskFilter.value === "attention") return Number(site.riskScore) >= 58;
  if (riskFilter.value === "open") return caseFor(site.id).status !== "closed";
  return true;
}));
const riskFactors = computed(() => {
  const site = selectedSite.value || {};
  return [
    { label: "天气", value: form.weather === "fog" ? 86 : form.weather === "rain" ? 78 : form.weather === "heat" ? 70 : 32 },
    { label: "地形坡度", value: Math.min(96, 28 + Number(site.slope || 8) * 2.5) },
    { label: "客流压力", value: Math.min(96, Number(site.crowdScore || site.congestionBase || 58)) },
    { label: "同行人群", value: form.travelerType === "senior" ? 84 : form.travelerType === "family" ? 68 : 58 },
    { label: "服务缺口", value: Math.max(8, 100 - Number(site.serviceCoverage || 82)) },
  ].map(item => ({ ...item, value: Math.round(item.value) }));
});
const emergencyGapText = computed(() => backend.emergency?.gaps?.length ? `${backend.emergency.gaps.length} 个覆盖缺口需补齐` : "当前无明显服务缺口");
const filteredScenic = computed(() => scenicSpots.value.filter(spot =>
  (!cityFilter.value || spot.city === cityFilter.value)
  && (!resourceQuery.value || `${spot.name}${spot.city}${spot.district}${spot.address}`.toLowerCase().includes(resourceQuery.value.toLowerCase()))));
const resourcePageCount = computed(() => Math.max(1, Math.ceil(filteredScenic.value.length / resourcePageSize)));
const pagedScenic = computed(() => filteredScenic.value.slice((resourcePage.value - 1) * resourcePageSize, resourcePage.value * resourcePageSize));
const cityOptions = computed(() => [...new Set(scenicSpots.value.map(spot => spot.city).filter(Boolean))]);
const selectedScenic = computed(() => scenicSpots.value.find(spot => spot.id === selectedScenicId.value) || pagedScenic.value[0] || scenicSpots.value[0] || null);
const visibleServices = computed(() => {
  const ids = ["health", "scenic-spots", "holiday-tourism", "tourism-route-plan", "tourism-risk-explanation", "tourism-emergency-coverage", "tourism-incidents", "tourism-live-weather", "tourism-emergency-nearby", "tourism-static-map", "tourism-data-lineage", "ascend-readiness"];
  return (integration.services.length ? integration.services : fallbackServices).filter(service => ids.includes(service.id));
});
const connectedCount = computed(() => visibleServices.value.filter(service => !["error", "offline", "not-configured"].includes(checks[service.id]?.status || service.status)).length);
const inferenceLabel = computed(() => progress.value < 22
  ? "解析游客画像与需求"
  : progress.value < 45
    ? `召回${form.destinationRegion || "目标区域"}景区候选点`
    : progress.value < 70
      ? "融合天气、地形与服务覆盖"
      : "生成风险分与处置建议");
const busy = computed(() => generating.value || resourceLoading.value || testing.value);
const routePath = computed(() => {
  if (roadMapPoints.value.length >= 2) {
    const interval = Math.max(1, Math.ceil(roadMapPoints.value.length / 320));
    const sampled = roadMapPoints.value.filter((_, index) => index % interval === 0);
    const last = roadMapPoints.value.at(-1);
    if (sampled.at(-1) !== last) sampled.push(last);
    return sampled.map((lngLat, index) => {
      const point = project(lngLat);
      return `${index ? "L" : "M"} ${point.x * 10} ${point.y * 5.6}`;
    }).join(" ");
  }
  const points = mapSites.value.map(site => {
    const point = project(site.lngLat);
    return { x: point.x * 10, y: point.y * 5.6 };
  });
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const middle = (points[index].x + points[index + 1].x) / 2;
    path += ` C ${middle} ${points[index].y}, ${middle} ${points[index + 1].y}, ${points[index + 1].x} ${points[index + 1].y}`;
  }
  return path;
});

watch(mapImageUrl, value => {
  mapImageSrc.value = `${value}&v=${Date.now()}`;
});

function normalizeItem(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  return item.explanation ? `${item.name || "证据"}：${item.explanation}` : item.name || item.label || "";
}
function travelerLabel(value) { return { family: "亲子家庭", senior: "老人同行", study: "研学团队", wellness: "康养慢游" }[value] || "游客"; }
function weatherLabel(value) { return { rain: "小雨路滑", fog: "山间大雾", heat: "高温暴晒", clear: "晴朗通行" }[value] || "天气"; }
function preferenceLabel(value) { return { safe: "安全优先", lowload: "低强度", culture: "民族文化", nature: "山地自然" }[value] || "综合"; }
function compactName(value = "") { return String(value).replace(/游客集散中心|游客中心片区|旅游度假区|旅游景区|风景名胜区|风景区|历史文化|文化旅游区|公园/g, "").trim().slice(0, 12) || String(value).slice(0, 12); }
function normalizeCity(value = "") { return String(value).replace(/(?:藏族羌族|藏族|彝族|苗族侗族|布依族苗族|土家族苗族|蒙古族|朝鲜族|哈尼族彝族|傣族景颇族|白族|壮族|回族|维吾尔族|柯尔克孜族|蒙古族藏族|黎族苗族)自治州|布依族苗族自治州|苗族侗族自治州|市$/g, ""); }
function riskClass(score = 0) { return Number(score) >= 75 ? "risk-high" : Number(score) >= 58 ? "risk-medium" : "risk-low"; }
function riskLabel(score = 0) { return Number(score) >= 75 ? "较高风险" : Number(score) >= 58 ? "中风险" : "低风险"; }
function caseStatusLabel(status) { return caseSteps.find(step => step.id === status)?.label || "待研判"; }
function requestPayload({ includePlanId = true } = {}) {
  const payload = {
    request: form.request,
    origin: form.origin,
    destinationRegion: form.destinationRegion || "贵州",
    travelerType: form.travelerType,
    weather: form.weather,
    days: Number(form.days),
    preference: form.preference,
    routeMode: form.routeMode,
    intensity: Number(form.intensity),
    selectedSiteNames: [...selectedSiteNames.value],
    includeRoadRoute: true,
  };
  if (includePlanId && backend.route?.planId) payload.planId = backend.route.planId;
  return payload;
}
function switchView(id) {
  view.value = id;
  if (id === "risk") selectSite(selectedSite.value?.id);
  if (id === "resources" && !scenicSpots.value.length && !resourceLoading.value) loadScenic();
}
function setActiveDay(day) {
  activeDay.value = day;
  if (mapScope.value === "day") {
    const firstSite = itinerary.value
      .find(item => Number(item.day) === Number(day))
      ?.sites?.map(id => routeSites.value.find(site => site.id === id))
      .find(Boolean);
    if (firstSite) selectSite(firstSite.id);
  }
}
function routeDayFor(id) { return itinerary.value.find(day => day.sites?.includes(id))?.day || 1; }
function scheduleForSite(id) { return executableScheduleEntries.value.find(entry => entry.siteId === id) || null; }
function legForSite(site) { return mapRoadLegs.value.find(leg => leg.toId === site?.id) || null; }
function mercatorUnit(lngLat = []) {
  const lng = Number(lngLat[0]);
  const safeLat = Math.max(-85.0511, Math.min(85.0511, Number(lngLat[1])));
  const sine = Math.sin((safeLat * Math.PI) / 180);
  return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI) };
}
function mercatorUnitToLngLat(point) {
  const latitudeRadians = Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y)));
  return [point.x * 360 - 180, (latitudeRadians * 180) / Math.PI];
}
function project(lngLat = []) {
  const point = mercatorUnit(lngLat);
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return { x: 50, y: 50 };
  const { zoom, centerUnit } = mapViewport.value;
  const world = 256 * 2 ** zoom;
  return {
    x: Math.max(3, Math.min(97, ((500 + (point.x - centerUnit.x) * world) / 1000) * 100)),
    y: Math.max(4, Math.min(96, ((280 + (point.y - centerUnit.y) * world) / 560) * 100)),
  };
}
function pinStyle(site, index) {
  const point = project(site?.lngLat);
  return { left: `${point.x}%`, top: `${point.y}%`, "--delay": `${Math.min(index * 70, 420)}ms` };
}
function localImage(name = "") {
  if (/梵净/.test(name)) return fanjingshanImage;
  if (/黄果树/.test(name)) return huangguoshuImage;
  if (/荔波小七孔|小七孔/.test(name)) return liboImage;
  if (/西江千户苗寨|西江苗寨/.test(name)) return xijiangImage;
  if (/万峰林/.test(name)) return wanfenglinImage;
  if (/织金洞/.test(name)) return zhijinImage;
  if (/青岩/.test(name)) return qingyanImage;
  return "";
}
function imageFor(site) {
  return localImage(`${site?.name || ""}${site?.shortName || ""}`)
    || site?.imagePath
    || (site?.sourcePoiId ? `/api/scenic-photo?id=${encodeURIComponent(site.sourcePoiId)}` : "");
}
function canShowImage(site) { return Boolean(site && imageFor(site) && !failedImages[site.id]); }
function markImageFailed(site) { if (site?.id) failedImages[site.id] = true; }
function scenicImageFor(spot) { return localImage(spot?.name || "") || (spot?.id ? `/api/scenic-photo?id=${encodeURIComponent(spot.id)}` : ""); }
function canShowScenicImage(spot) { return Boolean(spot && scenicImageFor(spot) && !failedScenicImages[spot.id]); }
function markScenicImageFailed(spot) { if (spot?.id) failedScenicImages[spot.id] = true; }
function caseFor(id = "unknown") {
  if (!cases[id]) cases[id] = { status: "pending", assignee: "", checkedActions: [], note: "", logs: [], updatedAt: "" };
  return cases[id];
}
function nowTime() {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}
function log(text) { currentCase.value.logs.push({ time: nowTime(), text }); }
function advanceCase(status) {
  currentCase.value.status = status;
  log(`处置状态更新为“${caseStatusLabel(status)}”`);
  persistCase(`状态更新为${caseStatusLabel(status)}`);
  showToast(`${compactName(selectedSite.value?.name)}：${caseStatusLabel(status)}`);
}
function recordAssignment() {
  if (currentCase.value.assignee) {
    log(`已联动资源：${currentCase.value.assignee}`);
    persistCase(`分派至${currentCase.value.assignee}`);
  }
}
function toggleAction(action) {
  const list = currentCase.value.checkedActions;
  const index = list.indexOf(action);
  if (index >= 0) {
    list.splice(index, 1);
    log(`撤销完成：${action}`);
  } else {
    list.push(action);
    log(`动作完成：${action}`);
  }
  persistCase(index >= 0 ? `撤销动作：${action}` : `完成动作：${action}`);
}
function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function exportCase() {
  const site = selectedSite.value;
  const current = currentCase.value;
  const list = items => items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>山河守护安全处置单</title><style>body{font-family:"Microsoft YaHei";max-width:860px;margin:40px auto;color:#17211d;line-height:1.7}h2{border-bottom:1px solid #222;padding-bottom:6px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.meta div{padding:12px;background:#f1f4f2}</style><body><h1>山河守护安全处置单</h1><h2>${escapeHtml(site?.name)}</h2><div class="meta"><div>风险分<br><b>${site?.riskScore}</b></div><div>状态<br><b>${caseStatusLabel(current.status)}</b></div><div>联动资源<br><b>${escapeHtml(current.assignee || "未分派")}</b></div></div><h2>核心风险</h2><p>${escapeHtml(site?.primaryRisk)}</p><h2>风险证据</h2><ol>${list(selectedEvidence.value)}</ol><h2>已完成动作</h2><ol>${list(current.checkedActions)}</ol><h2>处置备注</h2><p>${escapeHtml(current.note || "无")}</p><h2>审计留痕</h2><ol>${list(current.logs.map(item => `${item.time} ${item.text}`))}</ol></body></html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `山河守护-${compactName(site?.name)}-安全处置单.html`;
  anchor.click();
  URL.revokeObjectURL(url);
  log("已导出安全处置单");
  showToast("安全处置单已导出");
}
function planWithScenic(spot) {
  if (!spot) return;
  form.request = `从${form.origin}出发去${form.destinationRegion}，以${spot.name}为核心规划安全行程，结合实时天气、同行人群和应急服务覆盖给出路线。`;
  activeScenario.value = "custom";
  selectedSiteNames.value = [spot.name];
  view.value = "dispatch";
  generateRoute("resource");
}
function openAmap(spot) {
  if (!spot) return;
  const location = spot.location ? `${spot.location.lng},${spot.location.lat}` : "";
  const href = location
    ? `https://uri.amap.com/marker?position=${encodeURIComponent(location)}&name=${encodeURIComponent(spot.name)}`
    : `https://www.amap.com/search?query=${encodeURIComponent(spot.name)}`;
  window.open(href, "_blank", "noopener,noreferrer");
}
function serviceTone(service) {
  if (integration.health === "checking" && !checks[service.id]) return "checking";
  const status = checks[service.id]?.status || service.status;
  if (["connected", "live", "adapter-ready", "remote-ready", "ok"].includes(status)) return "ok";
  if (["estimate-only", "not-configured"].includes(status)) return "warning";
  return "error";
}
function serviceLabel(service) {
  if (integration.health === "checking" && !checks[service.id]) return "检测中";
  const status = checks[service.id]?.status || service.status;
  return {
    connected: "已连接",
    live: "实时",
    "adapter-ready": "适配就绪",
    "remote-ready": "远程就绪",
    "estimate-only": "模型估算",
    "not-configured": "待授权",
    ok: "正常",
    error: "异常",
  }[status] || status;
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { "content-type": "application/json" }, ...options });
  if (!response.ok) throw new Error(`${url} 返回 ${response.status}`);
  return response.json();
}
async function loadCases() {
  const ids = routeSites.value.map(site => site.id).filter(Boolean);
  if (!ids.length) return;
  try {
    const payload = await fetchJson(`/api/tourism/incidents?siteIds=${encodeURIComponent(ids.join(","))}`);
    (payload.incidents || []).forEach(incident => {
      Object.assign(caseFor(incident.siteId), {
        status: incident.status || "pending",
        assignee: incident.assignee || "",
        checkedActions: [...(incident.checkedActions || [])],
        note: incident.note || "",
        logs: [...(incident.logs || [])],
        updatedAt: incident.updatedAt || "",
      });
    });
  } catch {
    // The local interaction remains available if persistence is temporarily offline.
  }
}
async function persistCase(event) {
  const site = selectedSite.value;
  if (!site) return;
  const current = currentCase.value;
  try {
    const payload = await fetchJson("/api/tourism/incidents", {
      method: "POST",
      body: JSON.stringify({
        siteId: site.id,
        siteName: site.name,
        planId: backend.route?.planId || "",
        status: current.status,
        assignee: current.assignee,
        checkedActions: [...current.checkedActions],
        note: current.note,
        logs: [...current.logs],
        event,
      }),
    });
    if (payload.incident) Object.assign(current, payload.incident);
  } catch {
    current.updatedAt = "";
  }
}
async function loadSystem() {
  try {
    const [health, status, summary, holiday, weatherData, ascendData, lineageData] = await Promise.all([
      fetchJson("/api/health"),
      fetchJson("/api/integration-status").catch(() => null),
      fetchJson("/api/scenic-spots/summary").catch(() => null),
      fetchJson("/api/holiday-tourism").catch(() => null),
      fetchJson(`/api/tourism/live-weather?cities=${encodeURIComponent([form.origin, form.destinationRegion].filter(Boolean).join(','))}&forecastCities=${encodeURIComponent(form.destinationRegion || '贵州')}`).catch(() => null),
      fetchJson("/api/tourism/ascend-readiness").catch(() => null),
      fetchJson("/api/tourism/data-lineage").catch(() => null),
    ]);
    integration.health = health?.ok ? "ok" : "error";
    integration.services = (status?.services || fallbackServices).map(service => {
      if (service.id === "tourism-live-weather") {
        return { ...service, status: weatherData?.status === "live" ? "live" : weatherData?.configured === false ? "not-configured" : "error" };
      }
      if (service.id === "ascend-readiness") {
        return {
          ...service,
          status: ascendData?.status === "remote-ascend-inference"
            ? "live"
            : ascendData?.endpointConfigured
              ? "error"
              : "adapter-ready",
        };
      }
      return service;
    });
    integration.scenicTotal = summary?.total || integration.scenicTotal;
    integration.scenicFreshness = summary?.generatedAt || "";
    integration.holidayRecords = holiday?.records?.length || 3;
    integration.remote = ascendData?.status === "remote-ascend-inference" && Boolean(ascendData?.lastSuccessAt);
    Object.assign(weather, weatherData || { status: "unavailable", live: [] });
    Object.assign(ascend, ascendData || {});
    Object.assign(lineage, lineageData?.lineage || {});
  } catch (error) {
    integration.health = "error";
    backend.error = error.message;
  }
}
async function loadScenic() {
  resourceLoading.value = true;
  try {
    const targetRegion = form.destinationRegion || "贵州";
    const scope = targetRegion === "贵州" ? "" : "scope=national&";
    const payload = await fetchJson(`/api/scenic-spots?${scope}region=${encodeURIComponent(targetRegion)}&photo=required&limit=${targetRegion === "贵州" ? 2500 : 80}`);
    scenicSpots.value = payload.spots || [];
    integration.scenicTotal = payload.total || scenicSpots.value.length;
    integration.scenicFreshness = payload.generatedAt || integration.scenicFreshness;
    selectedScenicId.value ||= scenicSpots.value[0]?.id || "";
  } catch {
    scenicSpots.value = [];
    showToast("景区资源库暂时无法加载");
  } finally {
    resourceLoading.value = false;
  }
}
async function loadExplanation(id) {
  if (!id) return;
  explanationLoading.value = true;
  backend.explanation = null;
  try {
    const payload = await fetchJson("/api/tourism/risk-explanation", {
      method: "POST",
      body: JSON.stringify({ ...requestPayload(), siteId: id }),
    });
    if (selectedId.value === id) backend.explanation = payload.explanation || null;
  } catch {
    backend.explanation = null;
  } finally {
    if (selectedId.value === id) explanationLoading.value = false;
  }
}
async function selectSite(id) {
  selectedId.value = id;
  caseFor(id);
  await loadExplanation(id);
}
function restoreSharedRoute(session = readRouteSession()) {
  if (!session) return false;
  const request = session.request || session.route.request || {};
  Object.assign(form, {
    request: request.request || request.prompt || form.request,
    origin: request.origin || session.route.origin?.name || form.origin,
    destinationRegion: request.destinationRegion || session.route.destinationRegion || form.destinationRegion,
    travelerType: request.travelerType || form.travelerType,
    weather: request.weather || form.weather,
    days: Number(request.days || form.days),
    preference: request.preference || form.preference,
    routeMode: request.routeMode || session.route.optimization?.selectedMode || form.routeMode,
    intensity: Number(request.intensity || form.intensity),
  });
  selectedSiteNames.value = Array.isArray(request.selectedSiteNames)
    ? [...request.selectedSiteNames]
    : [];
  backend.route = session.route;
  selectedId.value = session.route.sites?.[0]?.id || selectedId.value;
  activeDay.value = session.route.itinerary?.[0]?.day || 1;
  routeVersion.value++;
  return true;
}
async function hydrateSharedRoute() {
  const payload = requestPayload();
  const [emergencyData, lineageData] = await Promise.all([
    fetchJson("/api/tourism/emergency-coverage", { method: "POST", body: JSON.stringify(payload) }).catch(() => null),
    fetchJson("/api/tourism/data-lineage", { method: "POST", body: JSON.stringify(payload) }).catch(() => null),
  ]);
  backend.emergency = emergencyData?.coverage || null;
  if (lineageData?.lineage) Object.assign(lineage, lineageData.lineage);
  await loadCases();
  await loadExplanation(selectedId.value);
}
async function generateRoute(source = "manual") {
  if (generating.value) return;
  generating.value = true;
  backend.error = "";
  progress.value = source === "initial" ? 12 : 6;
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    progress.value = Math.min(92, progress.value + 4 + Math.round(Math.random() * 7));
  }, 180);
  try {
    const payload = requestPayload({ includePlanId: false });
    const routeData = await fetchJson("/api/tourism/route-plan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    backend.route = routeData;
    writeRouteSession({ route: routeData, request: payload, source: "operations" });
    const decisionPayload = { ...payload, planId: routeData.planId };
    const [emergencyData, lineageData] = await Promise.all([
      fetchJson("/api/tourism/emergency-coverage", { method: "POST", body: JSON.stringify(decisionPayload) }).catch(() => null),
      fetchJson("/api/tourism/data-lineage", { method: "POST", body: JSON.stringify(decisionPayload) }).catch(() => null),
    ]);
    backend.emergency = emergencyData?.coverage || null;
    if (lineageData?.lineage) Object.assign(lineage, lineageData.lineage);
    selectedId.value = routeData.sites?.[0]?.id || selectedId.value;
    activeDay.value = routeData.itinerary?.[0]?.day || 1;
    routeVersion.value++;
    progress.value = 100;
    await loadCases();
    await loadExplanation(selectedId.value);
    if (source !== "initial") showToast(`已生成 ${form.days} 天安全路线`);
  } catch {
    backend.error = "远程服务暂未响应，已保留本地演示路线";
    integration.health = "error";
    showToast("路线服务未连接，已启用本地兜底数据");
  } finally {
    clearInterval(progressTimer);
    setTimeout(() => {
      generating.value = false;
      progress.value = 0;
    }, 360);
  }
}
function applyScenario(scene) {
  activeScenario.value = scene.id;
  Object.assign(form, scene.form);
  form.routeMode = scene.form.preference === "nature"
    ? "experience-first"
    : scene.form.preference === "culture"
      ? "balanced"
      : "safety-first";
  selectedSiteNames.value = [...(scene.selectedSiteNames || [])];
  generateRoute("scenario");
}
function changeOperationsOrigin() {
  activeScenario.value = "";
  selectedSiteNames.value = [];
  generateRoute("origin");
}
function changeOperationsRegion() {
  form.destinationRegion = String(form.destinationRegion || "贵州").trim() || "贵州";
  activeScenario.value = "";
  selectedSiteNames.value = [];
  scenicSpots.value = [];
  cityFilter.value = "";
  resourcePage.value = 1;
  generateRoute("region");
}
function handleMapImageError() {
  if (mapImageSrc.value === staticMapFallback) return;
  mapImageSrc.value = form.destinationRegion === "贵州" ? staticMapFallback : "";
}
async function timed(service) {
  const start = performance.now();
  try {
    const postIds = ["tourism-route-plan", "tourism-risk-explanation", "tourism-emergency-coverage"];
    if (postIds.includes(service.id)) {
      await fetchJson(service.endpoint, {
        method: "POST",
        body: JSON.stringify(service.id === "tourism-risk-explanation"
          ? { ...requestPayload(), siteId: selectedId.value }
          : requestPayload()),
      });
    } else {
      const emergencyLocation = selectedSite.value?.lngLat || [];
      const emergencyPath = emergencyLocation.length === 2
        ? `/api/tourism/emergency-nearby?lng=${encodeURIComponent(emergencyLocation[0])}&lat=${encodeURIComponent(emergencyLocation[1])}`
        : "/api/tourism/emergency-nearby";
      const path = {
        health: "/api/health",
        "scenic-spots": "/api/scenic-spots/summary",
        "holiday-tourism": "/api/holiday-tourism",
        "tourism-live-weather": "/api/tourism/live-weather",
        "tourism-emergency-nearby": emergencyPath,
        "tourism-static-map": "/api/tourism/static-map",
        "tourism-data-lineage": "/api/tourism/data-lineage",
        "ascend-readiness": "/api/tourism/ascend-readiness",
      }[service.id] || service.endpoint;
      const response = await fetch(path);
      if (!response.ok) throw new Error();
      await response.arrayBuffer();
    }
    checks[service.id] = {
      status: ["not-configured", "estimate-only"].includes(service.status) ? service.status : "ok",
      latency: Math.round(performance.now() - start),
    };
  } catch {
    checks[service.id] = { status: "error", latency: Math.round(performance.now() - start) };
  }
}
async function testServices() {
  testing.value = true;
  await Promise.all(visibleServices.value.map(timed));
  testing.value = false;
  showToast("核心接口检测完成");
}
async function refreshAll() {
  mapImageSrc.value = `${mapImageUrl.value}&v=${Date.now()}`;
  const tasks = [loadSystem(), generateRoute("refresh")];
  if (view.value === "resources") tasks.push(loadScenic());
  await Promise.all(tasks);
}
function showToast(text) {
  clearTimeout(toastTimer);
  toast.value = text;
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 2600);
}

watch([resourceQuery, cityFilter], () => { resourcePage.value = 1; });
watch(resourcePageCount, count => {
  if (resourcePage.value > count) resourcePage.value = count;
});
watch(itinerary, days => {
  if (!days.some(day => Number(day.day) === Number(activeDay.value))) activeDay.value = days[0]?.day || 1;
});
onMounted(async () => {
  document.body.classList.add("ops-v2-body");
  const restored = restoreSharedRoute();
  unsubscribeRouteSession = subscribeRouteSession(async session => {
    if (!restoreSharedRoute(session)) return;
    await hydrateSharedRoute();
    showToast("游客端路线已同步");
  });
  await Promise.all([
    loadSystem(),
    restored ? hydrateSharedRoute() : generateRoute("initial"),
  ]);
});
onBeforeUnmount(() => {
  document.body.classList.remove("ops-v2-body");
  clearInterval(progressTimer);
  clearTimeout(toastTimer);
  unsubscribeRouteSession?.();
});
</script>

<style scoped>
:global(.ops-v2-body) {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow-x: hidden;
  background: #f5f7f5;
}

.command-app {
  --bg: #f5f7f5;
  --surface: #ffffff;
  --surface-2: #eef2ef;
  --surface-3: #e5ebe7;
  --line: rgba(16, 32, 25, 0.12);
  --line-strong: rgba(16, 32, 25, 0.22);
  --text: #102019;
  --muted: #66736c;
  --quiet: #87918b;
  --jade: #187653;
  --jade-dark: #ffffff;
  --amber: #b96f2f;
  --red: #bd4f4a;
  --cyan: #2d7186;
  min-height: 100dvh;
  color: var(--text);
  background: var(--bg);
  font: 14px/1.4 "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

.command-app *,
.command-app *::before,
.command-app *::after {
  box-sizing: border-box;
}

.command-app button,
.command-app input,
.command-app textarea,
.command-app select {
  font: inherit;
}

.command-app button {
  color: inherit;
  cursor: pointer;
}

.command-app button:focus-visible,
.command-app input:focus-visible,
.command-app textarea:focus-visible,
.command-app select:focus-visible {
  outline: 2px solid var(--jade);
  outline-offset: 2px;
}

.app-bar {
  position: sticky;
  z-index: 20;
  top: 0;
  display: grid;
  grid-template-columns: 240px minmax(440px, 1fr) auto;
  align-items: center;
  gap: 24px;
  min-height: 72px;
  padding: 0 28px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 26px rgba(16, 32, 25, 0.05);
  backdrop-filter: blur(18px) saturate(1.08);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  color: var(--text);
  text-decoration: none;
}

.brand-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 7px;
  color: var(--jade-dark);
  background: var(--jade);
  font: 800 20px "STKaiti", "KaiTi", serif;
}

.brand-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.brand-copy strong {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-copy small {
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-nav {
  display: flex;
  justify-content: center;
  gap: 10px;
  min-width: 0;
}

.workspace-nav button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 13px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--quiet);
  background: transparent;
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
}

.workspace-nav button:hover {
  color: var(--text);
  background: rgba(24, 118, 83, 0.06);
}

.workspace-nav button.active {
  border-color: var(--jade);
  color: var(--text);
}

.workspace-nav button.active svg {
  color: var(--jade);
}

.bar-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.connection,
.weather-now {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 5px;
  background: var(--surface-2);
}

.connection i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--quiet);
}

.connection i.ok {
  background: var(--jade);
  box-shadow: 0 0 0 5px rgba(24, 118, 83, 0.1);
}

.connection i.error {
  background: var(--amber);
}

.weather-now svg {
  color: var(--amber);
}

.icon-button,
.secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--muted);
  background: var(--surface);
}

.icon-button {
  width: 34px;
  height: 34px;
  padding: 0;
}

.icon-button:hover,
.secondary-action:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.icon-button:disabled,
.secondary-action:disabled,
.primary-action:disabled,
.response-actions button:disabled {
  cursor: wait;
  opacity: 0.58;
}

.workspace {
  width: min(1600px, 100%);
  margin: 0 auto;
  padding: 22px 28px 28px;
}

.dispatch-view,
.risk-view,
.resources-view,
.system-view {
  display: grid;
  gap: 12px;
}

.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  min-height: 64px;
}

.page-heading h1 {
  margin: 0;
  color: var(--text);
  font-size: 27px;
  font-weight: 760;
  letter-spacing: -0.02em;
}

.page-heading p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.heading-facts {
  display: flex;
  align-items: center;
  gap: 20px;
  color: var(--muted);
  font-size: 11px;
}

.heading-facts span {
  display: grid;
  gap: 2px;
  justify-items: end;
}

.heading-facts b {
  color: var(--text);
  font: 22px/1 "Times New Roman", serif;
}

.mission-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(180px, 200px);
  align-items: center;
  gap: 18px;
  min-height: 126px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 10px 30px rgba(16, 32, 25, 0.05);
}

.mission-copy {
  min-width: 0;
}

.mission-copy > label {
  display: block;
  margin-bottom: 4px;
  color: var(--jade);
  font-size: 11px;
}

.mission-copy textarea {
  display: block;
  width: 100%;
  min-height: 42px;
  padding: 0;
  resize: vertical;
  border: 0;
  outline: 0;
  color: var(--text);
  background: transparent;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.5;
}

.mission-copy textarea::placeholder {
  color: var(--quiet);
}

.mission-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  overflow-x: auto;
}

.mission-meta select,
.mission-meta > input {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  outline: 0;
  color: var(--muted);
  background: var(--surface-2);
  font-size: 10px;
}

.mission-meta > input { width: 108px; }

.intensity-control {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 120px;
  padding-left: 5px;
  color: var(--muted);
  font-size: 10px;
}

.intensity-control input {
  width: 72px;
  accent-color: var(--jade);
}

.scenario-rail {
  display: grid;
  grid-template-columns: repeat(2, minmax(84px, 1fr));
  gap: 5px;
}

.scenario-rail button,
.filter-buttons button,
.map-modes button {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--muted);
  background: transparent;
  font-size: 10px;
  white-space: nowrap;
}

.scenario-rail button:hover,
.filter-buttons button:hover,
.map-modes button:hover {
  color: var(--text);
  border-color: var(--line-strong);
}

.scenario-rail button.active,
.filter-buttons button.active,
.map-modes button.active {
  border-color: var(--jade);
  color: var(--jade-dark);
  background: var(--jade);
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 6px;
  color: var(--jade-dark);
  background: var(--jade);
  font-size: 12px;
  font-weight: 760;
  transition: transform 160ms ease, filter 160ms ease;
}

.primary-action:hover {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.inline-error {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: -2px 0 0;
  color: var(--amber);
  font-size: 11px;
}

.dispatch-stage {
  display: grid;
  grid-template-columns: minmax(0, 1.16fr) minmax(500px, 0.84fr);
  gap: 12px;
  min-height: 548px;
}

.route-narrative,
.map-decision,
.incident-strip,
.risk-dossier,
.response-console,
.resource-list,
.resource-dossier,
.service-matrix,
.weather-board,
.ascend-board,
.lineage-board {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 12px 32px rgba(16, 32, 25, 0.045);
}

.route-narrative,
.risk-dossier,
.response-console,
.resource-list,
.service-matrix,
.lineage-board {
  overflow: hidden;
}

.section-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 62px;
  padding: 0 19px;
  border-bottom: 1px solid var(--line);
}

.section-bar small,
.section-bar strong {
  display: block;
}

.section-bar small {
  color: var(--jade);
  font-size: 10px;
}

.section-bar strong {
  margin-top: 4px;
  font-size: 15px;
}

.day-tabs {
  display: flex;
  align-self: stretch;
  gap: 4px;
}

.day-tabs button {
  min-width: 66px;
  padding: 0 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--quiet);
  background: transparent;
  font-size: 10px;
}

.day-tabs button.active {
  border-color: var(--jade);
  color: var(--text);
}

.route-story {
  position: relative;
  height: calc(100% - 62px);
  min-height: 480px;
  padding: 4px 19px;
  overflow: auto;
}

.route-thread {
  position: absolute;
  z-index: 0;
  top: 25px;
  bottom: 25px;
  left: 47px;
  width: 40px;
  pointer-events: none;
}

.route-thread path {
  fill: none;
  stroke: rgba(117, 219, 176, 0.72);
  stroke-linecap: round;
  stroke-width: 2.6;
}

.route-thread path:last-child {
  stroke: #fff;
  stroke-dasharray: 4 14;
  stroke-width: 1;
  opacity: 0.8;
}

.story-stop {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 42px 128px minmax(0, 1fr) 68px;
  align-items: center;
  gap: 15px;
  width: 100%;
  min-height: 160px;
  padding: 12px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  text-align: left;
  background: transparent;
  transition: background 160ms ease;
}

.story-stop:last-of-type {
  border-bottom: 0;
}

.story-stop:hover,
.story-stop.active {
  background: rgba(24, 118, 83, 0.055);
}

.stop-sequence {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 2px solid #dff8eb;
  border-radius: 50%;
  color: var(--jade-dark);
  background: var(--jade);
  font-size: 11px;
  font-weight: 800;
}

.stop-photo {
  display: grid;
  place-items: center;
  width: 128px;
  height: 112px;
  overflow: hidden;
  border-radius: 6px;
  color: var(--quiet);
  background: #e8ede9;
}

.stop-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 300ms ease;
}

.story-stop:hover .stop-photo img,
.story-stop.active .stop-photo img {
  transform: scale(1.04);
}

.stop-photo > span,
.photo-empty {
  display: grid;
  place-items: center;
  gap: 7px;
  color: var(--quiet);
  font-size: 10px;
}

.stop-content {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.stop-content > small {
  overflow: hidden;
  color: var(--jade);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-content > strong {
  overflow: hidden;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-content > em {
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  font-style: normal;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-stats {
  display: flex;
  gap: 15px;
  margin-top: 7px;
  color: var(--quiet);
  font-size: 9px;
}

.stop-stats b {
  color: var(--text);
  font-weight: 650;
}

.risk-score {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.risk-score b {
  color: var(--jade);
  font: 30px/1 "Times New Roman", serif;
}

.risk-score.risk-medium b,
.risk-medium {
  color: var(--amber);
}

.risk-score.risk-high b,
.risk-high {
  color: var(--red);
}

.risk-score small {
  color: var(--quiet);
  font-size: 9px;
}

.risk-low {
  color: var(--jade);
}

.empty-state {
  display: grid;
  place-items: center;
  gap: 7px;
  height: 100%;
  min-height: 300px;
  color: var(--quiet);
  text-align: center;
}

.empty-state svg {
  color: var(--jade);
}

.empty-state strong {
  color: var(--text);
}

.empty-state span {
  font-size: 11px;
}

.map-decision {
  position: relative;
  min-height: 548px;
  overflow: hidden;
  background: #e8ede9;
}

.map-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.72) contrast(1.02) brightness(0.94);
  transform: scale(1.02);
}

.map-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(245, 248, 246, 0.5), transparent 34%, rgba(245, 248, 246, 0.7));
  pointer-events: none;
}

.route-overlay {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route-overlay path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.route-halo {
  stroke: rgba(24, 118, 83, 0.2);
  stroke-width: 13;
}

.route-line {
  stroke: #187653;
  stroke-width: 3.2;
}

.route-flow {
  stroke: rgba(255, 255, 255, 0.95);
  stroke-dasharray: 4 22;
  stroke-width: 1;
  animation: routeFlow 5.5s linear infinite;
}

.map-heading {
  position: absolute;
  z-index: 7;
  top: 14px;
  right: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 50px;
  padding: 8px 10px;
  border: 1px solid rgba(16, 32, 25, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 24px rgba(16, 32, 25, 0.08);
  backdrop-filter: blur(14px) saturate(1.08);
}

.map-heading small,
.map-heading strong {
  display: block;
}

.map-heading small {
  color: var(--jade);
  font-size: 10px;
}

.map-heading strong {
  margin-top: 3px;
  font-size: 15px;
}

.map-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.map-scope,
.map-modes {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 5px;
  background: rgba(16, 32, 25, 0.055);
}

.map-scope button,
.map-modes button {
  min-width: 42px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  font-size: 11px;
}

.map-scope button.active {
  color: #fff;
  background: var(--jade);
}

.map-pin {
  position: absolute;
  z-index: 5;
  display: grid;
  grid-template-columns: 30px max-content;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  text-align: left;
  background: transparent;
  transform: translate(-15px, -15px);
  animation: pinIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--delay);
}

.map-pin > i {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  color: var(--jade-dark);
  background: var(--jade);
  box-shadow: 0 4px 10px rgba(16, 32, 25, 0.2);
  font-size: 10px;
  font-style: normal;
  font-weight: 800;
}

.map-pin.risk-medium > i {
  color: #3c2a09;
  background: var(--amber);
}

.map-pin.risk-high > i {
  color: #fff;
  background: var(--red);
}

.map-pin > span {
  display: grid;
  gap: 2px;
  min-width: 96px;
  padding: 7px 9px;
  border: 1px solid rgba(16, 32, 25, 0.14);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 5px 14px rgba(16, 32, 25, 0.1);
  backdrop-filter: blur(10px) saturate(1.08);
}

.map-pin:hover > span,
.map-pin.active > span {
  border-color: rgba(24, 118, 83, 0.48);
}

.map-pin strong {
  font-size: 10px;
}

.map-pin small {
  color: var(--muted);
  font-size: 8px;
}

.decision-brief {
  position: absolute;
  z-index: 7;
  right: 14px;
  bottom: 14px;
  left: 14px;
  padding: 15px 16px;
  border-radius: 7px;
  border: 1px solid rgba(16, 32, 25, 0.12);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 28px rgba(16, 32, 25, 0.09);
  backdrop-filter: blur(14px) saturate(1.08);
}

.decision-brief header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.decision-brief small {
  display: block;
  color: var(--jade);
  font-size: 10px;
}

.decision-brief strong {
  display: block;
  margin-top: 5px;
  font-size: 15px;
}

.decision-brief header > b {
  font: 27px/1 "Times New Roman", serif;
}

.decision-brief p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}

.optimization-evidence {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.optimization-evidence span { display: grid; gap: 3px; }
.optimization-evidence small { color: var(--quiet); font-size: 8px; }
.optimization-evidence b { color: var(--text); font-size: 10px; }

.decision-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px 15px;
  margin-top: 11px;
  padding-top: 10px;
}

.decision-actions span {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--muted);
  font-size: 10px;
}

.decision-actions i {
  display: grid;
  flex: none;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  color: var(--jade-dark);
  background: var(--jade);
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
}

.decision-brief > button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  margin-top: 11px;
  padding: 0 10px;
  border: 1px solid rgba(24, 118, 83, 0.24);
  border-radius: 5px;
  color: var(--jade);
  background: rgba(24, 118, 83, 0.07);
  font-size: 10px;
}

.inference-layer {
  position: absolute;
  z-index: 12;
  inset: 0;
  display: grid;
  grid-template-columns: 30px auto auto;
  place-content: center;
  align-items: center;
  gap: 9px;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(8px);
}

.inference-layer svg,
.inference-layer > span {
  color: var(--jade);
}

.inference-layer > i {
  grid-column: 1 / -1;
  width: 280px;
  height: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(16, 32, 25, 0.1);
}

.inference-layer > i b {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--jade);
  transform-origin: left;
}

.decision-chain {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 13px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  color: var(--quiet);
  font-size: 10px;
}

.chain-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-right: 5px;
  color: var(--cyan);
  font-weight: 650;
}

.decision-chain > span:not(.chain-label) {
  padding: 4px 7px;
  border-radius: 4px;
  background: rgba(16, 32, 25, 0.045);
}

.decision-chain > span.active:not(.chain-label) {
  color: var(--text);
  background: rgba(24, 118, 83, 0.1);
}

.decision-chain > em {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
  font-style: normal;
}

.filter-buttons {
  display: flex;
  gap: 7px;
}

.risk-view {
  min-width: 0;
}

.incident-strip {
  display: flex;
  min-height: 82px;
  overflow-x: auto;
  background: var(--line);
}

.incident-strip button {
  display: grid;
  grid-template-columns: 44px minmax(150px, 1fr) auto;
  align-items: center;
  gap: 12px;
  flex: 1 0 220px;
  min-width: 220px;
  padding: 0 16px;
  border: 0;
  border-right: 1px solid var(--line);
  text-align: left;
  background: var(--surface);
}

.incident-strip button.active {
  background: var(--surface-2);
}

.incident-strip button > b {
  font: 25px/1 "Times New Roman", serif;
}

.incident-strip button > span {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.incident-strip strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.incident-strip small {
  overflow: hidden;
  color: var(--quiet);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.incident-strip em {
  color: var(--quiet);
  font-size: 9px;
  font-style: normal;
}

.incident-strip em.case-responding {
  color: var(--amber);
}

.incident-strip em.case-closed,
.incident-strip em.case-confirmed {
  color: var(--jade);
}

.risk-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.22fr) minmax(390px, 0.78fr);
  gap: 12px;
  min-height: 630px;
}

.risk-dossier {
  display: grid;
  grid-template-rows: 348px auto 58px minmax(0, 1fr);
}

.dossier-visual {
  position: relative;
  overflow: hidden;
}

.dossier-visual > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.7) contrast(1.05) brightness(0.58);
}

.visual-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(7, 13, 10, 0.76), rgba(7, 13, 10, 0.08) 70%), linear-gradient(0deg, rgba(7, 13, 10, 0.66), transparent 55%);
}

.dossier-copy {
  position: absolute;
  z-index: 2;
  top: 30px;
  left: 29px;
  width: min(52%, 510px);
}

.dossier-copy > small {
  color: var(--jade);
  font-size: 10px;
}

.dossier-copy h2 {
  margin: 8px 0 8px;
  color: #fff;
  font-size: 27px;
  line-height: 1.18;
}

.dossier-copy p {
  max-width: 48ch;
  margin: 0;
  color: #d3ded8;
  font-size: 11px;
  line-height: 1.65;
}

.dossier-copy dl {
  display: flex;
  gap: 23px;
  margin: 23px 0 0;
}

.dossier-copy dl div {
  display: grid;
  gap: 3px;
}

.dossier-copy dt {
  color: #d8e0dc;
  font-size: 9px;
}

.dossier-copy dd {
  margin: 0;
  color: #fff;
  font: 18px/1 "Times New Roman", serif;
}

.dossier-score {
  position: absolute;
  z-index: 2;
  right: 28px;
  bottom: 23px;
  display: grid;
  justify-items: end;
}

.dossier-score b {
  font: 68px/0.95 "Times New Roman", serif;
}

.dossier-score span {
  margin-top: 7px;
  color: #d9e5df;
  font-size: 10px;
}

.factor-rail {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 13px 19px;
  border-bottom: 1px solid var(--line);
}

.factor-rail > div {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px;
}

.factor-rail span,
.factor-rail em {
  color: var(--muted);
  font-size: 9px;
  font-style: normal;
}

.factor-rail i {
  grid-column: 1 / -1;
  height: 4px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(16, 32, 25, 0.08);
}

.factor-rail i b {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--jade);
  transform-origin: left;
}

.evidence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 0 19px;
  border-bottom: 1px solid var(--line);
}

.evidence-header strong,
.evidence-header span {
  display: block;
}

.evidence-header strong {
  font-size: 13px;
}

.evidence-header span {
  margin-top: 3px;
  color: var(--quiet);
  font-size: 9px;
}

.evidence-tabs {
  display: flex;
  align-self: stretch;
}

.evidence-tabs button {
  min-width: 48px;
  padding: 0 6px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--quiet);
  background: transparent;
  font-size: 10px;
}

.evidence-tabs button.active {
  border-color: var(--jade);
  color: var(--text);
}

.evidence-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
  padding: 6px 19px 15px;
  overflow: auto;
}

.evidence-grid p {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  min-height: 56px;
  margin: 0;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  color: #425047;
  font-size: 10px;
  line-height: 1.55;
}

.evidence-grid p > i {
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  color: var(--jade-dark);
  background: var(--jade);
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
}

.skeleton,
.resource-loading i {
  display: block;
  min-height: 38px;
  margin-top: 7px;
  border-radius: 4px;
  background: linear-gradient(90deg, #e7ece8, #f4f7f5, #e7ece8);
  background-size: 240% 100%;
  animation: skeleton 1.4s infinite;
}

.response-console {
  display: grid;
  grid-template-rows: 69px 75px auto auto auto auto;
  align-content: start;
  overflow: auto;
}

.response-console > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 19px;
  border-bottom: 1px solid var(--line);
}

.response-console > header small,
.response-console > header strong {
  display: block;
}

.response-console > header small {
  color: var(--jade);
  font-size: 10px;
}

.response-console > header strong {
  margin-top: 4px;
  font-size: 15px;
}

.response-console > header > b {
  color: var(--jade);
  font: 24px/1 "Times New Roman", serif;
}

.case-steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 14px 12px;
  border-bottom: 1px solid var(--line);
}

.case-steps span {
  display: grid;
  justify-items: center;
  gap: 6px;
  color: var(--quiet);
  font-size: 9px;
}

.case-steps i {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--quiet);
  background: var(--surface);
  font-size: 9px;
  font-style: normal;
}

.case-steps .done,
.case-steps .current {
  color: var(--text);
}

.case-steps .done i,
.case-steps .current i {
  border-color: var(--jade);
  color: var(--jade-dark);
  background: var(--jade);
}

.case-steps .current i {
  box-shadow: 0 0 0 5px rgba(24, 118, 83, 0.1);
}

.assign-control,
.case-note {
  display: grid;
  gap: 7px;
  padding: 15px 19px;
  border-bottom: 1px solid var(--line);
}

.assign-control > span,
.case-note > span,
.action-checklist header > span {
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
}

.assign-control select,
.case-note textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 5px;
  outline: 0;
  color: var(--text);
  background: #f7f9f7;
}

.assign-control select {
  height: 38px;
  padding: 0 10px;
}

.assign-control small,
.action-checklist header > small,
.audit-log header > small {
  color: var(--quiet);
  font-size: 9px;
}

.action-checklist {
  padding: 15px 19px;
  border-bottom: 1px solid var(--line);
}

.action-checklist > header,
.audit-log > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.action-checklist label {
  display: block;
}

.action-checklist input {
  position: absolute;
  opacity: 0;
}

.action-checklist label > span {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
  color: #425047;
  font-size: 10px;
  line-height: 1.45;
}

.action-checklist label > span svg {
  flex: none;
  width: 20px;
  height: 20px;
  padding: 2px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  color: transparent;
}

.action-checklist input:checked + span svg {
  border-color: var(--jade);
  color: var(--jade-dark);
  background: var(--jade);
}

.case-note textarea {
  min-height: 70px;
  padding: 9px;
  resize: vertical;
  font-size: 10px;
  line-height: 1.5;
}

.case-note textarea::placeholder {
  color: var(--quiet);
}

.response-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 15px 19px;
}

.response-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  color: var(--muted);
  background: transparent;
  font-size: 10px;
}

.response-actions button:hover {
  color: var(--text);
  background: rgba(24, 118, 83, 0.065);
}

.response-actions button.primary {
  border-color: var(--jade);
  color: var(--jade-dark);
  background: var(--jade);
  font-weight: 760;
}

.response-actions button.primary:disabled {
  border-color: var(--line);
  color: var(--quiet);
  background: var(--surface-2);
}

.audit-log {
  padding: 0 19px 15px;
}

.audit-log > header {
  padding-top: 13px;
  border-top: 1px solid var(--line);
}

.audit-log > header > span {
  font-size: 11px;
  font-weight: 700;
}

.audit-log p {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 9px;
  margin: 0;
  padding: 6px 0;
  color: var(--muted);
  font-size: 9px;
}

.audit-log time {
  color: var(--quiet);
}

.audit-empty {
  display: block !important;
  padding: 14px 0 !important;
  text-align: center;
}

.resources-view,
.system-view {
  min-width: 0;
}

.secondary-action {
  min-height: 38px;
  padding: 0 13px;
  color: var(--text);
  font-size: 11px;
}

.resource-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.36fr) minmax(320px, 0.64fr);
  gap: 12px;
  min-height: 650px;
}

.resource-list {
  display: grid;
  grid-template-rows: 62px minmax(0, 1fr) 48px;
}

.resource-tools {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 170px auto;
  align-items: center;
  gap: 10px;
  padding: 13px 15px;
  border-bottom: 1px solid var(--line);
}

.resource-tools > label {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 23px;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--quiet);
  background: #f7f9f7;
}

.resource-tools input {
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  color: var(--text);
  background: transparent;
  font-size: 11px;
}

.resource-tools input::placeholder {
  color: var(--quiet);
}

.resource-tools label button {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  padding: 0;
  border: 0;
  color: var(--quiet);
  background: transparent;
}

.resource-tools > select {
  height: 36px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  outline: 0;
  color: var(--muted);
  background: #f7f9f7;
  font-size: 11px;
}

.resource-tools > span {
  color: var(--quiet);
  font-size: 10px;
  white-space: nowrap;
}

.resource-table {
  overflow: auto;
}

.table-head,
.resource-table > button {
  display: grid;
  grid-template-columns: minmax(240px, 1.45fr) minmax(180px, 1fr) 64px 132px;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 46px;
  padding: 0 15px;
}

.table-head {
  position: sticky;
  z-index: 2;
  top: 0;
  min-height: 39px;
  border-bottom: 1px solid var(--line);
  color: var(--quiet);
  background: var(--surface-2);
  font-size: 10px;
}

.resource-table > button {
  border: 0;
  border-bottom: 1px solid rgba(16, 32, 25, 0.08);
  color: var(--muted);
  background: transparent;
  font-size: 10px;
  text-align: left;
}

.resource-table > button:hover,
.resource-table > button.active {
  background: rgba(24, 118, 83, 0.07);
}

.resource-table > button > span:first-child {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.resource-table > button > span:first-child svg {
  flex: none;
  color: var(--jade);
}

.resource-table > button b {
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.heat-cell {
  display: grid;
  grid-template-columns: 70px auto;
  align-items: center;
  gap: 7px;
}

.heat-cell > i {
  height: 4px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(16, 32, 25, 0.08);
}

.heat-cell > i > b {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--amber);
  transform-origin: left;
}

.data-ready {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--jade);
  white-space: nowrap;
}

.resource-loading {
  display: grid;
  gap: 8px;
  padding: 12px 15px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-top: 1px solid var(--line);
  color: var(--quiet);
  font-size: 10px;
}

.pagination > div {
  display: flex;
  gap: 6px;
}

.pagination button {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 5px;
  color: var(--muted);
  background: var(--surface-2);
}

.pagination button:disabled {
  cursor: default;
  opacity: 0.4;
}

.resource-dossier {
  overflow: hidden;
}

.resource-photo {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1.55;
  overflow: hidden;
  color: var(--quiet);
  background: #e8ede9;
}

.resource-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resource-photo > div {
  display: grid;
  place-items: center;
  gap: 7px;
  font-size: 10px;
}

.resource-photo > span {
  position: absolute;
  right: 11px;
  bottom: 10px;
  padding: 4px 6px;
  border-radius: 4px;
  color: #dfeae4;
  background: rgba(8, 15, 11, 0.76);
  font-size: 9px;
}

.resource-copy {
  padding: 16px 17px;
}

.resource-copy small {
  color: var(--jade);
  font-size: 10px;
}

.resource-copy h2 {
  margin: 6px 0 0;
  font-size: 19px;
}

.resource-copy p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
}

.resource-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 17px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.resource-metrics div {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 12px 5px;
}

.resource-metrics div + div {
  border-left: 1px solid var(--line);
}

.resource-metrics dt {
  color: var(--quiet);
  font-size: 9px;
}

.resource-metrics dd {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 11px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-source {
  display: grid;
  gap: 4px;
  padding: 16px 17px 0;
}

.resource-source small {
  color: var(--jade);
  font-size: 10px;
}

.resource-source strong {
  font-size: 12px;
}

.resource-source p {
  margin: 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}

.resource-actions {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 8px;
  padding: 16px 17px;
}

.resource-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  color: var(--muted);
  background: transparent;
  font-size: 10px;
}

.resource-actions button:hover {
  color: var(--text);
  background: rgba(24, 118, 83, 0.065);
}

.resource-actions button.primary {
  border-color: var(--jade);
  color: var(--jade-dark);
  background: var(--jade);
  font-weight: 760;
}

.system-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  min-height: 78px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.system-summary span {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 3px;
}

.system-summary span + span {
  border-left: 1px solid var(--line);
}

.system-summary b {
  color: var(--text);
  font: 24px/1 "Times New Roman", serif;
}

.system-summary small {
  color: var(--quiet);
  font-size: 10px;
}

.system-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.13fr) minmax(390px, 0.87fr);
  gap: 12px;
  min-height: 650px;
}

.service-matrix {
  min-height: 650px;
}

.service-matrix .section-bar > span {
  color: var(--quiet);
  font-size: 10px;
}

.service-table {
  height: calc(100% - 62px);
  overflow: auto;
}

.service-table > div {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 78px 58px;
  align-items: center;
  gap: 10px;
  min-height: 55px;
  padding: 7px 15px;
  border-bottom: 1px solid rgba(16, 32, 25, 0.08);
}

.service-table > div > i {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 5px;
  color: var(--quiet);
  background: var(--surface-2);
  font-style: normal;
}

.service-table > div > i.ok {
  color: var(--jade);
  background: rgba(24, 118, 83, 0.08);
}

.service-table > div > i.warning {
  color: var(--amber);
}

.service-table > div > i.error {
  color: var(--red);
}

.service-table > div > span {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.service-table b {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-table small {
  overflow: hidden;
  color: var(--quiet);
  font: 9px/1.3 Consolas, "SFMono-Regular", monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-table em {
  justify-self: start;
  padding: 4px 6px;
  border-radius: 4px;
  color: var(--quiet);
  background: var(--surface-2);
  font-size: 9px;
  font-style: normal;
  white-space: nowrap;
}

.service-table em.ok {
  color: var(--jade);
}

.service-table em.warning {
  color: var(--amber);
}

.service-table em.error {
  color: var(--red);
}

.service-table time {
  color: var(--quiet);
  font: 10px "Times New Roman", serif;
  text-align: right;
}

.system-detail {
  display: grid;
  grid-template-rows: minmax(260px, 0.9fr) minmax(340px, 1.1fr);
  gap: 12px;
  min-width: 0;
}

.weather-board,
.ascend-board {
  overflow: hidden;
}

.weather-board > header,
.ascend-board > header,
.lineage-board > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 62px;
  padding: 0 15px;
  border-bottom: 1px solid var(--line);
}

.weather-board header small,
.weather-board header strong,
.ascend-board header small,
.ascend-board header strong,
.lineage-board header small,
.lineage-board header strong {
  display: block;
}

.weather-board header small,
.ascend-board header small,
.lineage-board header small {
  color: var(--jade);
  font-size: 10px;
}

.weather-board header strong,
.ascend-board header strong,
.lineage-board header strong {
  margin-top: 4px;
  font-size: 14px;
}

.weather-board header > span {
  color: var(--quiet);
  font-size: 9px;
}

.weather-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: calc(100% - 62px);
  gap: 1px;
  background: var(--line);
}

.weather-grid > div {
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface);
}

.weather-grid span {
  color: var(--jade);
  font-size: 10px;
}

.weather-grid b {
  font: 23px/1 "Times New Roman", serif;
}

.weather-grid small {
  color: var(--quiet);
  font-size: 9px;
}

.ascend-board > header svg,
.lineage-board > header svg {
  color: var(--cyan);
}

.ascend-chain {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 18px 15px 11px;
}

.ascend-chain > span {
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--quiet);
  font-size: 8px;
  text-align: center;
}

.ascend-chain > span i {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--surface-2);
  font-style: normal;
}

.ascend-chain > span.active {
  color: var(--text);
}

.ascend-chain > span.active i {
  border-color: var(--jade);
  color: var(--jade-dark);
  background: var(--jade);
}

.ascend-chain > svg {
  flex: none;
  color: var(--quiet);
}

.ascend-board > p {
  margin: 0;
  padding: 0 15px 13px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
}

.ascend-board dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 15px 15px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.ascend-board dl div {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 11px 4px;
}

.ascend-board dl div + div {
  border-left: 1px solid var(--line);
}

.ascend-board dt {
  color: var(--quiet);
  font-size: 9px;
}

.ascend-board dd {
  margin: 0;
  color: var(--text);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.lineage-board {
  grid-column: 1 / -1;
  min-height: 250px;
}

.lineage-board ol {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 18px;
  margin: 0;
  padding: 18px 15px;
  list-style: none;
}

.lineage-board li {
  display: grid;
  grid-template-columns: 27px minmax(0, 1fr);
  gap: 9px;
}

.lineage-board li > span {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  color: var(--jade-dark);
  background: var(--jade);
  font-size: 9px;
  font-weight: 800;
}

.lineage-board li > div {
  display: grid;
  align-content: start;
  gap: 4px;
}

.lineage-board li strong {
  font-size: 10px;
}

.lineage-board li small {
  color: var(--quiet);
  font-size: 9px;
  line-height: 1.45;
}

.lineage-board > p {
  margin: 0;
  padding: 10px 15px 13px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 9px;
}

.toast {
  position: fixed;
  z-index: 60;
  right: 22px;
  bottom: 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(24, 118, 83, 0.28);
  border-radius: 6px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 26px rgba(16, 32, 25, 0.14);
  font-size: 11px;
}

.toast svg {
  color: var(--jade);
}

.spin {
  animation: spin 0.9s linear infinite;
}

.workspace-enter-active,
.workspace-leave-active,
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.workspace-enter-from,
.toast-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.workspace-leave-to,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes routeFlow {
  to { stroke-dashoffset: -52; }
}

@keyframes pinIn {
  from { opacity: 0; transform: translate(-15px, -9px) scale(0.92); }
  to { opacity: 1; transform: translate(-15px, -15px) scale(1); }
}

@keyframes skeleton {
  to { background-position: -220% 0; }
}

@media (max-width: 1280px) {
  .app-bar {
    grid-template-columns: 210px minmax(370px, 1fr) auto;
    gap: 15px;
    padding-inline: 20px;
  }

  .workspace {
    padding-inline: 20px;
  }

  .dispatch-stage {
    grid-template-columns: minmax(0, 1.08fr) minmax(430px, 0.92fr);
  }

  .story-stop {
    grid-template-columns: 39px 112px minmax(0, 1fr) 58px;
    gap: 11px;
  }

  .stop-photo {
    width: 112px;
    height: 102px;
  }

  .stop-content > strong {
    font-size: 16px;
  }

  .bar-status .weather-now {
    display: none;
  }
}

@media (max-width: 1040px) {
  .app-bar {
    grid-template-columns: 190px 1fr;
  }

  .workspace-nav {
    justify-content: flex-start;
    overflow-x: auto;
  }

  .bar-status {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: flex-start;
    padding-bottom: 10px;
  }

  .app-bar {
    padding-top: 10px;
  }

  .mission-composer {
    grid-template-columns: 1fr auto;
  }

  .scenario-rail {
    grid-column: 1;
    grid-template-columns: repeat(4, 1fr);
  }

  .primary-action {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .dispatch-stage,
  .risk-workbench,
  .resource-workbench,
  .system-workbench {
    grid-template-columns: 1fr;
  }

  .map-decision {
    min-height: 520px;
  }

  .risk-workbench,
  .resource-workbench,
  .system-workbench {
    min-height: 0;
  }

  .risk-dossier,
  .response-console,
  .resource-list,
  .resource-dossier,
  .service-matrix {
    min-height: 560px;
  }

  .system-detail {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: minmax(260px, 1fr);
  }

  .lineage-board {
    grid-column: auto;
  }
}

@media (max-width: 720px) {
  .app-bar {
    position: relative;
    grid-template-columns: 1fr auto;
    gap: 10px;
    min-height: 0;
    padding: 12px 14px 0;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    font-size: 18px;
  }

  .brand-copy strong {
    font-size: 14px;
  }

  .brand-copy small {
    font-size: 9px;
  }

  .workspace-nav {
    grid-column: 1 / -1;
    grid-row: 2;
    margin: 0 -14px;
    padding: 0 14px;
    border-top: 1px solid var(--line);
  }

  .workspace-nav button {
    min-height: 42px;
    padding-inline: 9px;
    font-size: 10px;
  }

  .bar-status {
    grid-column: 2;
    grid-row: 1;
    padding: 0;
  }

  .bar-status .connection {
    display: none;
  }

  .workspace {
    padding: 18px 12px 24px;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
    min-height: 0;
  }

  .page-heading h1 {
    font-size: 23px;
  }

  .page-heading p {
    max-width: 48ch;
    font-size: 11px;
  }

  .heading-facts {
    width: 100%;
    justify-content: space-between;
    gap: 8px;
  }

  .heading-facts span {
    justify-items: start;
    font-size: 9px;
  }

  .heading-facts b {
    font-size: 18px;
  }

  .mission-composer {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 14px;
  }

  .mission-copy textarea {
    min-height: 62px;
    font-size: 13px;
  }

  .mission-meta {
    flex-wrap: wrap;
  }

  .mission-meta select,
  .mission-meta > input {
    flex: 1 1 110px;
  }

  .intensity-control {
    flex: 1 1 140px;
  }

  .scenario-rail,
  .primary-action {
    grid-column: auto;
    grid-row: auto;
  }

  .scenario-rail {
    grid-template-columns: repeat(4, 1fr);
  }

  .dispatch-stage {
    min-height: 0;
  }

  .route-narrative {
    min-height: 0;
  }

  .route-story {
    min-height: 0;
    height: auto;
  }

  .story-stop {
    grid-template-columns: 34px 86px minmax(0, 1fr) 42px;
    gap: 8px;
    min-height: 136px;
  }

  .stop-sequence {
    width: 30px;
    height: 30px;
    font-size: 9px;
  }

  .stop-photo {
    width: 86px;
    height: 82px;
  }

  .stop-content > small,
  .stop-content > em,
  .stop-stats {
    font-size: 8px;
  }

  .stop-content > strong {
    font-size: 14px;
  }

  .stop-stats {
    gap: 7px;
    margin-top: 3px;
  }

  .risk-score b {
    font-size: 23px;
  }

  .risk-score small {
    font-size: 8px;
    text-align: center;
  }

  .map-decision {
    min-height: 480px;
  }

  .map-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .decision-brief {
    padding: 12px;
  }

  .decision-brief strong {
    font-size: 13px;
  }

  .decision-actions {
    grid-template-columns: 1fr;
  }

  .decision-chain {
    flex-wrap: wrap;
    gap: 5px;
    padding-block: 8px;
  }

  .decision-chain > em {
    width: 100%;
    margin-left: 0;
  }

  .filter-buttons {
    width: 100%;
    overflow-x: auto;
  }

  .filter-buttons button {
    flex: none;
  }

  .risk-dossier {
    grid-template-rows: 330px auto auto minmax(230px, 1fr);
  }

  .dossier-copy {
    top: 22px;
    left: 19px;
    width: 70%;
  }

  .dossier-copy h2 {
    font-size: 22px;
  }

  .dossier-copy p {
    font-size: 10px;
  }

  .dossier-copy dl {
    flex-wrap: wrap;
    gap: 10px 17px;
    margin-top: 15px;
  }

  .dossier-score {
    right: 18px;
    bottom: 19px;
  }

  .dossier-score b {
    font-size: 52px;
  }

  .factor-rail {
    grid-template-columns: repeat(2, 1fr);
  }

  .factor-rail > div:last-child {
    grid-column: 1 / -1;
  }

  .evidence-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
    padding-top: 10px;
  }

  .evidence-tabs {
    width: 100%;
  }

  .evidence-tabs button {
    min-height: 32px;
  }

  .evidence-grid {
    grid-template-columns: 1fr;
  }

  .resource-list {
    min-height: 600px;
  }

  .resource-tools {
    grid-template-columns: 1fr;
    height: auto;
  }

  .resource-table {
    overflow-x: auto;
  }

  .table-head,
  .resource-table > button {
    min-width: 680px;
  }

  .resource-dossier {
    min-height: 0;
  }

  .system-summary {
    grid-template-columns: 1fr 1fr;
  }

  .system-summary span {
    min-height: 70px;
  }

  .system-summary span:nth-child(odd) + span {
    border-left: 1px solid var(--line);
  }

  .system-summary span:nth-child(3),
  .system-summary span:nth-child(4) {
    border-top: 1px solid var(--line);
  }

  .system-summary span:nth-child(3) {
    border-left: 0;
  }

  .system-detail {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
  }

  .weather-grid {
    grid-template-columns: repeat(2, 1fr);
    height: auto;
  }

  .weather-grid > div {
    min-height: 82px;
  }

  .lineage-board ol {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .toast {
    right: 12px;
    bottom: 12px;
    left: 12px;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .command-app *,
  .command-app *::before,
  .command-app *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
