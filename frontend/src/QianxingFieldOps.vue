<template>
  <div class="warroom">
    <header class="hud-header">
      <div class="identity">
        <div class="logo">黔</div>
        <div>
          <h1>黔行守护</h1>
          <p>贵州山地文旅安全决策平台</p>
        </div>
      </div>

      <div class="workspace-heading">
        <span>{{ workspaceMeta.section }}</span>
        <strong>{{ workspaceMeta.title }}</strong>
      </div>

      <div class="connection" :class="connectionTone">
        <i></i>
        <strong>{{ connectionLabel }}</strong>
      </div>
    </header>

    <nav class="workspace-nav" aria-label="主要工作区">
      <div class="nav-brand">
        <div class="logo">黔</div>
        <div>
          <strong>黔行守护</strong>
          <small>贵州山地文旅安全决策平台</small>
        </div>
      </div>
      <button
        v-for="item in workspaceNav"
        :key="item.id"
        type="button"
        :class="{ active: activeWorkspace === item.id }"
        @click="switchWorkspace(item.id)"
      >
        <span>{{ item.mark }}</span>
        <b>{{ item.label }}</b>
        <small>{{ item.short }}</small>
      </button>
    </nav>

    <main class="operations-shell" :class="`workspace-${activeWorkspace}`">
      <section v-show="activeWorkspace === 'route' || activeWorkspace === 'risk'" class="map-world" aria-label="贵州山地旅游态势图">
        <div class="map-topline">
          <div>
            <span>当前任务</span>
            <strong>{{ routeTitle }}</strong>
          </div>
          <div class="mode-switch" role="tablist" aria-label="态势图模式">
            <button
              v-for="mode in mapModes"
              :key="mode.id"
              type="button"
              :class="{ active: mapMode === mode.id }"
              @click="setMapMode(mode.id)"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>

        <div class="satellite-board" :class="{ scanning: generating, 'amap-active': amapEnabled, 'amap-ready': amapReady }">
          <div
            v-if="amapEnabled"
            ref="amapContainer"
            class="amap-layer"
            aria-label="高德地图真实底图"
          ></div>

          <svg class="province-map" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="贵州路线态势地图">
            <defs>
              <radialGradient id="glow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stop-color="oklch(63% 0.14 184 / 0.42)" />
                <stop offset="58%" stop-color="oklch(39% 0.12 164 / 0.16)" />
                <stop offset="100%" stop-color="transparent" />
              </radialGradient>
              <linearGradient id="land" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stop-color="oklch(33% 0.085 164 / 0.78)" />
                <stop offset="52%" stop-color="oklch(25% 0.065 174 / 0.82)" />
                <stop offset="100%" stop-color="oklch(18% 0.045 160 / 0.94)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
            <path class="land-shape" d="M16 26 L29 17 L42 20 L52 13 L66 20 L79 19 L88 33 L84 45 L91 58 L76 68 L71 81 L56 84 L45 76 L31 83 L21 73 L10 63 L16 48 L10 36 Z" />
            <path class="river" d="M14 60 C27 54 33 63 44 55 C55 48 62 55 73 47 C80 42 84 45 90 41" />
            <path class="contour one" d="M23 37 C34 28 46 29 58 34 C70 39 77 47 82 59" />
            <path class="contour two" d="M27 51 C39 42 53 42 65 49 C72 53 77 58 80 66" />
            <path class="contour three" d="M30 65 C42 58 54 59 64 65 C69 69 71 74 70 79" />
            <path class="route-aura" :d="routePath" vector-effect="non-scaling-stroke" />
            <path class="route-track" :d="routePath" vector-effect="non-scaling-stroke" />
            <path class="route-hotline" :d="routePath" vector-effect="non-scaling-stroke" />
            <path class="route-flow" :d="routePath" vector-effect="non-scaling-stroke" />
          </svg>

          <div class="map-place-layer" aria-hidden="true">
            <span
              v-for="place in mapPlaces"
              :key="place.label"
              class="map-place"
              :class="place.kind"
              :style="{ left: `${place.x}%`, top: `${place.y}%` }"
            >
              <i v-if="place.kind === 'hub'"></i>
              {{ place.label }}
            </span>
          </div>

          <button
            v-for="site in visibleSites"
            :key="`${site.id}-${routeVersion}`"
            class="site-pin"
            :class="[riskClass(site.risk), `label-${site.labelSide || 'right'}`, { selected: selectedId === site.id, dimmed: !isInRoute(site.id) }]"
            type="button"
            :style="{ left: `${site.x}%`, top: `${site.y}%`, '--order': routeIndex(site.id) || 1 }"
            @click="selectSite(site.id)"
          >
            <span class="pulse"></span>
            <span class="pin-core">{{ routeIndex(site.id) || "•" }}</span>
            <span class="pin-label">
              <b>{{ site.shortName }}</b>
              <small>
                {{ site.risk }} 分 ·
                <em :class="riskClass(site.risk)">{{ riskLabel(site.risk) }}</em>
              </small>
            </span>
          </button>

          <div class="map-metric metric-a">
            <span>平均风险</span>
            <strong>{{ averageRisk }}</strong>
          </div>
          <div class="map-metric metric-b">
            <span>应急覆盖</span>
            <strong>{{ serviceCoverage }}%</strong>
          </div>
          <div v-if="mapMode === 'route'" class="map-metric metric-c">
            <span>路线强度</span>
            <strong>{{ form.intensity }}</strong>
          </div>

          <div class="risk-radar" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div class="map-provider-badge" :class="{ ready: amapReady, error: amapError }">
            <span>{{ mapProviderLabel }}</span>
            <small v-if="amapError">{{ amapError }}</small>
          </div>

          <div v-if="mapMode !== 'risk'" class="map-mode-panel">
            <b>{{ mapModeInsight.title }}</b>
            <span>{{ mapModeInsight.detail }}</span>
          </div>

          <div v-if="generating" class="scan-banner" aria-live="polite">
            <span></span>
            <strong>正在联动公共数据、天气交通与风险模型 {{ progress }}%</strong>
          </div>
        </div>
      </section>

      <aside v-show="activeWorkspace === 'route' && bottomMode !== 'inventory'" class="mission-dock" aria-label="游客任务输入">
        <div class="dock-title">
          <span>任务下达</span>
          <strong>自然语言生成安全路线</strong>
        </div>

        <textarea
          v-model="form.request"
          class="mission-input"
          spellcheck="false"
          aria-label="游客自然语言需求"
        ></textarea>

        <button class="advanced-toggle" type="button" @click="advancedOpen = !advancedOpen">
          <span>场景与高级条件</span>
          <b>{{ advancedOpen ? "收起" : "展开" }}</b>
        </button>

        <div v-show="advancedOpen" class="advanced-fields">
          <div class="quick-strip">
            <button
              v-for="scenario in scenarios"
              :key="scenario.id"
              type="button"
              :class="{ active: activeScenario === scenario.id }"
              @click="applyScenario(scenario)"
            >
              <b>{{ scenario.title }}</b>
              <small>{{ scenario.brief }}</small>
            </button>
          </div>
          <div class="control-grid">
            <label>
              <span>人群</span>
              <select v-model="form.travelerType">
                <option value="family">亲子家庭</option>
                <option value="senior">老人同行</option>
                <option value="study">研学团队</option>
                <option value="wellness">康养慢游</option>
              </select>
            </label>
            <label>
              <span>天气</span>
              <select v-model="form.weather">
                <option value="rain">小雨路滑</option>
                <option value="fog">山间大雾</option>
                <option value="heat">高温暴晒</option>
                <option value="clear">晴朗通行</option>
              </select>
            </label>
            <label>
              <span>天数</span>
              <select v-model.number="form.days">
                <option :value="1">1 天</option>
                <option :value="2">2 天</option>
                <option :value="3">3 天</option>
                <option :value="4">4 天</option>
                <option :value="5">5 天</option>
              </select>
            </label>
            <label>
              <span>策略</span>
              <select v-model="form.preference">
                <option value="safe">安全优先</option>
                <option value="culture">民族文化</option>
                <option value="nature">山地自然</option>
                <option value="lowload">低强度</option>
              </select>
            </label>
          </div>

          <label class="intensity-control">
            <span>路线强度 <b>{{ form.intensity }}</b></span>
            <input v-model.number="form.intensity" type="range" min="20" max="90" step="5" />
          </label>
        </div>

        <button class="dispatch-button" type="button" :disabled="generating" @click="generateRoute('manual')">
          {{ generating ? `推理生成中 ${progress}%` : "生成安全路线" }}
        </button>
      </aside>

      <aside v-show="activeWorkspace === 'route' && bottomMode !== 'inventory'" class="decision-dock" aria-label="AI 决策摘要">
        <div class="decision-hero">
          <span>{{ aiStateLabel }}</span>
          <strong>{{ highestRiskSite.shortName }} {{ highestRiskSite.risk }} 分</strong>
          <p>{{ highestRiskSite.primaryRisk }}</p>
        </div>

        <div class="summary-copy">
          {{ routeSummary }}
        </div>

        <div class="decision-metrics">
          <span>
            <b>{{ averageRisk }}</b>
            <small>平均风险</small>
          </span>
          <span>
            <b>{{ serviceCoverage }}%</b>
            <small>应急覆盖</small>
          </span>
          <span>
            <b>{{ dataFoundationScore }}</b>
            <small>景区库</small>
          </span>
        </div>

        <div class="detail-tabs" role="tablist" aria-label="决策详情">
          <button type="button" :class="{ active: detailMode === 'actions' }" @click="detailMode = 'actions'">处置</button>
          <button type="button" :class="{ active: detailMode === 'data' }" @click="detailMode = 'data'">数据</button>
          <button type="button" :class="{ active: detailMode === 'chain' }" @click="detailMode = 'chain'">链路</button>
        </div>

        <div v-if="detailMode === 'actions'" class="action-stack compact">
          <h2>现场处置建议</h2>
          <button
            v-for="action in visibleSafetyActions"
            :key="action"
            type="button"
            @click="focusAction(action)"
          >
            <i></i>
            <span>{{ action }}</span>
          </button>
        </div>

        <div v-else-if="detailMode === 'data'" class="data-market-panel compact">
          <div>
            <span>数据底座</span>
            <strong>{{ dataFoundationScore }}</strong>
          </div>
          <p>{{ publicDataSummary }}</p>
          <div class="capability-strip">
            <span
              v-for="item in visibleCapabilityRows"
              :key="item.name"
              class="capability-pill"
              :class="{ ok: item.ok, muted: item.muted }"
            >
              <i></i>
              <b>{{ item.name }}</b>
              <small>{{ item.status }}</small>
            </span>
          </div>
        </div>

        <div v-else class="chain-panel compact">
          <h2>昇腾推理链路</h2>
          <ol>
            <li v-for="(step, index) in inferenceChain" :key="step.name" :class="{ active: step.active }">
              <span>{{ index + 1 }}</span>
              <div>
                <b>{{ step.name }}</b>
                <small>{{ step.detail }}</small>
              </div>
            </li>
          </ol>
        </div>
      </aside>

      <section v-show="activeWorkspace === 'route'" class="timeline-dock" aria-label="动态行程与风险证据">
        <div class="timeline-head">
          <div>
            <span>{{ bottomModeLabel }}</span>
            <strong>{{ bottomTitle }}</strong>
          </div>
          <div class="timeline-tabs">
            <button type="button" :class="{ active: bottomMode === 'route' }" @click="bottomMode = 'route'">路线</button>
            <button type="button" :class="{ active: bottomMode === 'evidence' }" @click="bottomMode = 'evidence'">证据</button>
          </div>
        </div>

        <div v-if="bottomMode === 'route'" class="route-rail">
          <button
            v-for="(site, index) in routeSites"
            :key="site.id"
            type="button"
            class="route-stop"
            :class="{ selected: selectedId === site.id }"
            :style="{ '--delay': index }"
            @click="selectRouteSite(site.id)"
          >
            <span class="route-thumb">
              <img :src="site.image" :alt="`${site.shortName}景区实景`" />
              <span class="stop-index">{{ index + 1 }}</span>
            </span>
            <span class="route-stop-copy">
              <strong>{{ site.shortName }}</strong>
              <small class="route-address" :title="site.address">{{ site.address }}</small>
              <span class="route-stop-meta">
                <b :class="riskClass(site.risk)">{{ site.risk }}</b>
                <span>{{ site.distance }}</span>
                <span>服务 {{ site.service }}%</span>
              </span>
            </span>
          </button>
        </div>

        <div v-else-if="bottomMode === 'evidence'" class="evidence-sheet">
          <div class="evidence-main">
            <span>{{ selectedSite.city }} · {{ selectedSite.county }}</span>
            <strong>{{ selectedSite.name }}</strong>
            <p>{{ activeAction || selectedSite.primaryRisk }}</p>
            <small v-if="selectedSite.estimateMode === 'rule-estimated'">规则推估点位 · 生产环境需用景区正式数据校准</small>
          </div>
          <div class="evidence-grid">
            <div>
              <b>风险来源</b>
              <span v-for="item in selectedSite.evidence" :key="item">{{ item }}</span>
            </div>
            <div>
              <b>建议动作</b>
              <span v-for="item in selectedSite.actions" :key="item">{{ item }}</span>
            </div>
            <div>
              <b>应急服务点</b>
              <span v-for="item in selectedSite.services" :key="item">{{ item }}</span>
            </div>
            <div>
              <b>数据来源</b>
              <span v-for="item in selectedSite.sources" :key="item">{{ item }}</span>
            </div>
          </div>
        </div>

        <div v-else class="scenic-inventory">
          <div class="inventory-summary">
            <div>
              <span>贵州全省景区 POI 库</span>
              <strong>{{ scenicInventory.length || integration.scenicTotal }} 个点位 · {{ scenicCityOptions.length }} 个市州</strong>
            </div>
            <p>全量点位已上图，列表默认露出高热度样例。用城市和名称筛选后查看更多结果。</p>
          </div>
          <div class="inventory-tools">
            <input v-model.trim="scenicQuery" type="search" placeholder="搜索景区名称、区县、地址" aria-label="搜索景区" />
            <select v-model="scenicCityFilter" aria-label="筛选城市">
              <option value="">全部市州</option>
              <option v-for="city in scenicCityOptions" :key="city" :value="city">{{ city }}</option>
            </select>
          </div>
          <div class="inventory-content">
            <div class="inventory-list">
              <button
                v-for="spot in scenicListItems"
                :key="spot.id"
                type="button"
                :class="{ selected: selectedScenicId === spot.id }"
                @click="selectScenicSpot(spot.id)"
              >
                <b>{{ spot.name }}</b>
                <span>{{ spot.city }} · {{ spot.district || "景区点位" }}</span>
                <small>{{ spot.rating ? `${spot.rating} 分` : "POI" }} · 热度 {{ spot.holidayHeatSeed || 0 }}</small>
              </button>
            </div>
            <div class="inventory-detail">
              <span>{{ selectedScenicSpot?.city || "贵州" }} · {{ selectedScenicSpot?.district || "全省景区" }}</span>
              <strong>{{ selectedScenicSpot?.name || "正在加载景区库" }}</strong>
              <p>{{ selectedScenicSpotDetail }}</p>
              <div>
                <b>{{ filteredScenicInventory.length }}</b>
                <small>当前筛选结果</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-if="activeWorkspace === 'risk'" class="workspace-page risk-workspace">
        <header class="page-masthead">
          <div>
            <span>安全研判</span>
            <h2>路线风险中心</h2>
            <p>按风险优先级查看点位、证据、处置动作和应急资源，不与路线生成操作混在同一屏。</p>
          </div>
          <button type="button" class="page-primary-action" @click="switchWorkspace('route')">返回路线规划</button>
        </header>

        <div class="overview-strip">
          <div>
            <span>最高风险</span>
            <strong>{{ highestRiskSite.risk }}</strong>
            <small>{{ highestRiskSite.shortName }} · {{ highestRiskSite.primaryRisk }}</small>
          </div>
          <div>
            <span>重点关注</span>
            <strong>{{ highRiskCount }}</strong>
            <small>风险分大于等于 75 的路线点位</small>
          </div>
          <div>
            <span>应急覆盖</span>
            <strong>{{ serviceCoverage }}%</strong>
            <small>{{ coverageStatus }}</small>
          </div>
        </div>

        <div class="risk-workbench">
          <section class="risk-queue">
            <div class="section-heading">
              <div>
                <span>研判队列</span>
                <strong>{{ sortedRiskSites.length }} 个路线点位</strong>
              </div>
              <small>按风险从高到低</small>
            </div>
            <button
              v-for="site in sortedRiskSites"
              :key="site.id"
              type="button"
              :class="{ selected: selectedId === site.id }"
              @click="selectedId = site.id"
            >
              <span class="risk-score" :class="riskClass(site.risk)">{{ site.risk }}</span>
              <span class="risk-row-copy">
                <b>{{ site.name }}</b>
                <small>{{ site.city }} · {{ site.primaryRisk }}</small>
              </span>
              <span class="risk-row-status">
                <b>{{ site.service }}%</b>
                <small>服务覆盖</small>
              </span>
            </button>
          </section>

          <section class="risk-dossier">
            <div class="dossier-hero">
              <div>
                <span>{{ selectedSite.city }} · {{ selectedSite.county }}</span>
                <h3>{{ selectedSite.name }}</h3>
                <p>{{ selectedSite.primaryRisk }}</p>
              </div>
              <strong :class="riskClass(selectedSite.risk)">{{ selectedSite.risk }}</strong>
            </div>

            <div class="dossier-section">
              <b>风险证据</b>
              <ul>
                <li v-for="item in selectedSite.evidence" :key="item">{{ item }}</li>
              </ul>
            </div>
            <div class="dossier-section">
              <b>建议动作</b>
              <button
                v-for="item in selectedSite.actions"
                :key="item"
                type="button"
                @click="focusAction(item)"
              >
                {{ item }}
              </button>
            </div>
            <div class="dossier-footer">
              <span>
                <small>最近服务点</small>
                <b>{{ selectedSite.services[0] }}</b>
              </span>
              <span>
                <small>数据来源</small>
                <b>{{ selectedSite.sources.slice(0, 2).join("、") }}</b>
              </span>
            </div>
          </section>
        </div>
      </section>

      <section v-if="activeWorkspace === 'inventory'" class="workspace-page inventory-workspace">
        <header class="page-masthead">
          <div>
            <span>全省资源</span>
            <h2>贵州景区资源库</h2>
            <p>面向文旅部门与项目运营人员的统一景区检索，不在路线页面一次性展示全部点位。</p>
          </div>
          <div class="inventory-total">
            <strong>{{ scenicInventory.length || integration.scenicTotal }}</strong>
            <span>已接入景区点位</span>
          </div>
        </header>

        <div class="resource-toolbar">
          <input v-model.trim="scenicQuery" type="search" placeholder="搜索景区名称、区县或地址" aria-label="搜索景区资源" />
          <select v-model="scenicCityFilter" aria-label="筛选市州">
            <option value="">全部市州</option>
            <option v-for="city in scenicCityOptions" :key="city" :value="city">{{ city }}</option>
          </select>
          <span>{{ filteredScenicInventory.length }} 个结果</span>
        </div>

        <div class="resource-workbench">
          <section class="resource-table">
            <div class="resource-row resource-header">
              <span>景区名称</span>
              <span>市州 / 区县</span>
              <span>评分</span>
              <span>假日热度</span>
            </div>
            <button
              v-for="spot in scenicTableItems"
              :key="spot.id"
              type="button"
              class="resource-row"
              :class="{ selected: selectedScenicId === spot.id }"
              @click="selectScenicSpot(spot.id)"
            >
              <b>{{ spot.name }}</b>
              <span>{{ spot.city }} / {{ spot.district || "未标注" }}</span>
              <span>{{ spot.rating || "--" }}</span>
              <span>{{ spot.holidayHeatSeed || 0 }}</span>
            </button>
          </section>

          <aside class="resource-detail">
            <span>{{ selectedScenicSpot?.city || "贵州" }} · {{ selectedScenicSpot?.district || "全省" }}</span>
            <h3>{{ selectedScenicSpot?.name || "正在加载景区资源" }}</h3>
            <p>{{ selectedScenicSpot?.address || "暂无详细地址" }}</p>
            <dl>
              <div>
                <dt>景区评分</dt>
                <dd>{{ selectedScenicSpot?.rating || "--" }}</dd>
              </div>
              <div>
                <dt>假日热度</dt>
                <dd>{{ selectedScenicSpot?.holidayHeatSeed || 0 }}</dd>
              </div>
              <div>
                <dt>数据来源</dt>
                <dd>{{ selectedScenicSpot?.source || "AMap Place Search" }}</dd>
              </div>
            </dl>
            <div class="resource-note">
              <b>落地用途</b>
              <p>可用于路线候选召回、节假日承载分析、景区服务覆盖核验及文旅资源统一检索。</p>
            </div>
          </aside>
        </div>
      </section>

      <section v-if="activeWorkspace === 'system'" class="workspace-page system-workspace">
        <header class="page-masthead">
          <div>
            <span>技术与数据</span>
            <h2>系统能力与昇腾链路</h2>
            <p>集中展示接口、数据底座和推理适配状态，技术证明不再常驻业务操作页。</p>
          </div>
          <div class="system-state" :class="connectionTone">
            <i></i>
            <span>{{ connectionLabel }}</span>
          </div>
        </header>

        <div class="system-layout">
          <section class="system-panel capability-overview">
            <div class="section-heading">
              <div>
                <span>运行能力</span>
                <strong>核心服务状态</strong>
              </div>
            </div>
            <div
              v-for="item in capabilityRows"
              :key="item.name"
              class="system-capability"
              :class="{ ok: item.ok, muted: item.muted }"
            >
              <i></i>
              <span>
                <b>{{ item.name }}</b>
                <small>{{ item.detail }}</small>
              </span>
              <strong>{{ item.status }}</strong>
            </div>
          </section>

          <section class="system-panel inference-overview">
            <div class="section-heading">
              <div>
                <span>AI 决策闭环</span>
                <strong>昇腾推理链路</strong>
              </div>
            </div>
            <ol class="system-chain">
              <li v-for="(step, index) in inferenceChain" :key="step.name" :class="{ active: step.active }">
                <span>{{ index + 1 }}</span>
                <div>
                  <b>{{ step.name }}</b>
                  <small>{{ step.detail }}</small>
                </div>
              </li>
            </ol>
          </section>

          <section class="system-panel endpoint-overview">
            <div class="section-heading">
              <div>
                <span>后端服务</span>
                <strong>接口运行清单</strong>
              </div>
            </div>
            <div v-for="endpoint in serviceEndpoints" :key="endpoint.path" class="endpoint-row">
              <code>{{ endpoint.path }}</code>
              <span>{{ endpoint.use }}</span>
              <b>{{ integration.health === "ok" ? "可用" : "兜底" }}</b>
            </div>
          </section>

          <section class="system-panel data-overview">
            <div class="section-heading">
              <div>
                <span>公共数据</span>
                <strong>数据资产摘要</strong>
              </div>
            </div>
            <div class="data-stat-line">
              <span><b>{{ integration.corpusTotal || 0 }}</b><small>公开目录</small></span>
              <span><b>{{ integration.scenicTotal || 0 }}</b><small>景区点位</small></span>
              <span><b>{{ integration.holidayRecords || 0 }}</b><small>假日样本</small></span>
            </div>
            <ul>
              <li v-for="item in integration.corpusResources.slice(0, 5)" :key="item.name">{{ item.name }}</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import fanjingshanImage from "./assets/scenic/fanjingshan.webp";
import huangguoshuImage from "./assets/scenic/huangguoshu.webp";
import liboImage from "./assets/scenic/libo.webp";
import qingyanImage from "./assets/scenic/qingyan.webp";
import wanfenglinImage from "./assets/scenic/wanfenglin.webp";
import xijiangImage from "./assets/scenic/xijiang.webp";
import zhijinImage from "./assets/scenic/zhijin.webp";

const nowLabel = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date());

const technicalViewEnabled = new URLSearchParams(window.location.search).get("technical") === "1";

const workspaceNav = [
  { id: "route", mark: "01", label: "路线规划", short: "生成与调度" },
  { id: "risk", mark: "02", label: "风险中心", short: "证据与处置" },
  { id: "inventory", mark: "03", label: "景区资源", short: "全省资源库" },
  ...(technicalViewEnabled
    ? [{ id: "system", mark: "04", label: "技术验收", short: "数据与推理" }]
    : []),
];

const workspaceMetaMap = {
  route: { section: "游客服务", title: "AI 安全路线规划" },
  risk: { section: "安全治理", title: "路线风险研判" },
  inventory: { section: "文旅资源", title: "贵州景区资源库" },
  system: { section: "内部验收", title: "数据与推理服务" },
};

const serviceEndpoints = [
  { path: "/api/health", use: "服务健康检查" },
  { path: "/api/tourism/route-plan", use: "安全路线生成" },
  { path: "/api/scenic-spots", use: "全省景区资源检索" },
  { path: "/api/tourism/emergency-coverage", use: "应急服务覆盖核验" },
  { path: "/api/tourism/ascend-readiness", use: "昇腾推理适配状态" },
];

const scenarios = [
  {
    id: "family-rain",
    title: "亲子雨天",
    brief: "父母孩子 · 防滑低强度",
    form: {
      request: "带父母和孩子去贵州玩两天，不想太累，担心下雨路滑，希望路线安全、有休息点和应急服务。",
      travelerType: "family",
      weather: "rain",
      days: 2,
      preference: "safe",
      intensity: 42,
    },
  },
  {
    id: "senior-wellness",
    title: "康养慢游",
    brief: "老人同行 · 医疗可达",
    form: {
      request: "想安排老人去贵州康养慢游三天，希望少爬坡，住宿和医疗服务方便，遇到大雾也有备选路线。",
      travelerType: "senior",
      weather: "fog",
      days: 3,
      preference: "lowload",
      intensity: 35,
    },
  },
  {
    id: "study-group",
    title: "研学团队",
    brief: "学生团队 · 承载校验",
    form: {
      request: "组织 40 人研学团队去贵州两天，希望兼顾民族文化和自然地貌，要求拥堵可控、集合点清晰。",
      travelerType: "study",
      weather: "clear",
      days: 2,
      preference: "culture",
      intensity: 58,
    },
  },
  {
    id: "mountain-nature",
    title: "山地深度",
    brief: "自然风光 · 风险预警",
    form: {
      request: "想体验贵州山地自然景观，两天路线可以稍微有强度，但要避开高风险路段并展示安全解释。",
      travelerType: "wellness",
      weather: "heat",
      days: 2,
      preference: "nature",
      intensity: 68,
    },
  },
];

const sites = [
  {
    id: "anshun_huangguoshu",
    name: "黄果树游客集散中心",
    shortName: "黄果树",
    city: "安顺",
    county: "镇宁",
    address: "贵州省安顺市镇宁布依族苗族自治县黄果树镇",
    image: huangguoshuImage,
    x: 33,
    y: 58,
    labelSide: "right",
    lngLat: [105.669, 25.989],
    sequence: 2,
    tags: ["瀑布", "换乘", "雨天防滑"],
    riskBase: 68,
    slope: 18,
    distance: "3.1 km",
    congestionBase: 82,
    serviceCoverage: 92,
    aiFit: 88,
    primaryRisk: "雨天湿滑与客流聚集",
    services: ["游客中心医务室", "景区换乘站", "交警执勤点", "母婴休息区"],
    evidence: ["瀑布步道湿滑概率高", "节假日集散区客流峰值明显", "停车换乘流量集中在 10:00 至 13:00"],
    actions: ["优先安排上午入园", "老人与儿童走低坡度环线", "雨天开启防滑提醒并绑定换乘站"],
    sources: ["景区客流热度", "交通换乘数据", "天气预警", "应急服务点目录"],
  },
  {
    id: "qny_libo",
    name: "荔波小七孔东门服务区",
    shortName: "荔波",
    city: "黔南",
    county: "荔波",
    address: "贵州省黔南州荔波县小七孔景区东门",
    image: liboImage,
    x: 83,
    y: 67,
    labelSide: "left",
    lngLat: [107.716, 25.267],
    sequence: 5,
    tags: ["喀斯特", "亲水", "低强度"],
    riskBase: 52,
    slope: 9,
    distance: "2.4 km",
    congestionBase: 64,
    serviceCoverage: 86,
    aiFit: 91,
    primaryRisk: "亲水步道湿滑",
    services: ["东门服务站", "景区医务点", "观光车站", "亲水步道巡检点"],
    evidence: ["亲水栈道受降雨影响明显", "东门服务区换乘能力较强", "适合亲子与老人低强度游览"],
    actions: ["雨天缩短水上森林停留", "保留观光车备选", "儿童团队配置集合点提醒"],
    sources: ["景区服务设施", "天气数据", "步道风险规则", "游客画像"],
  },
  {
    id: "gy_qingyan",
    name: "青岩古镇南街片区",
    shortName: "青岩",
    city: "贵阳",
    county: "花溪",
    address: "贵州省贵阳市花溪区青岩镇",
    image: qingyanImage,
    x: 16,
    y: 39,
    labelSide: "right",
    lngLat: [106.681, 26.331],
    sequence: 1,
    tags: ["古镇", "餐饮", "城市近郊"],
    riskBase: 45,
    slope: 6,
    distance: "1.6 km",
    congestionBase: 70,
    serviceCoverage: 89,
    aiFit: 84,
    primaryRisk: "街巷拥堵与餐饮排队",
    services: ["古镇游客中心", "社区卫生服务点", "停车场", "派出所联络点"],
    evidence: ["街巷承载空间有限", "近郊交通可达性好", "餐饮商户密度高"],
    actions: ["作为首日轻量落地点", "避开午餐高峰进入主街", "老人同行时优先南门停车"],
    sources: ["POI 数据", "交通可达性", "工商主体密度", "游客投诉评价"],
  },
  {
    id: "qdn_xijiang",
    name: "西江千户苗寨观景台片区",
    shortName: "西江",
    city: "黔东南",
    county: "雷山",
    address: "贵州省黔东南州雷山县西江镇",
    image: xijiangImage,
    x: 74,
    y: 43,
    labelSide: "left",
    lngLat: [108.178, 26.492],
    sequence: 4,
    tags: ["民族村寨", "夜景", "坡道"],
    riskBase: 76,
    slope: 24,
    distance: "3.8 km",
    congestionBase: 86,
    serviceCoverage: 78,
    aiFit: 80,
    primaryRisk: "坡道强度与夜间客流",
    services: ["北门游客服务点", "观景台执勤点", "寨内医务室", "夜间摆渡点"],
    evidence: ["寨内坡道和台阶密集", "夜景时段客流回落慢", "民宿区域巷道疏散复杂"],
    actions: ["老人儿童不建议夜间登高", "保留摆渡车返回方案", "夜间路线缩短至核心观景线"],
    sources: ["夜间客流", "民宿入住率", "道路坡度", "服务点分布"],
  },
  {
    id: "tr_fanjing",
    name: "梵净山游客换乘片区",
    shortName: "梵净山",
    city: "铜仁",
    county: "江口",
    address: "贵州省铜仁市江口县太平镇梵净山景区",
    image: fanjingshanImage,
    x: 84,
    y: 20,
    labelSide: "left",
    lngLat: [108.774, 27.895],
    sequence: 6,
    tags: ["山地", "换乘", "天气敏感"],
    riskBase: 82,
    slope: 31,
    distance: "4.6 km",
    congestionBase: 72,
    serviceCoverage: 74,
    aiFit: 75,
    primaryRisk: "大雾与高强度爬升",
    services: ["换乘中心", "山门医务点", "索道站", "应急广播点"],
    evidence: ["山地天气变化快", "索道与换乘承载受天气影响", "高海拔步道对老人儿童压力大"],
    actions: ["大雾情境降级为备选点", "必须绑定索道运行状态", "强制加入返程缓冲时间"],
    sources: ["山地天气", "索道运行", "交通换乘", "应急广播"],
  },
  {
    id: "bj_zhijin",
    name: "织金洞游客中心片区",
    shortName: "织金洞",
    city: "毕节",
    county: "织金",
    address: "贵州省毕节市织金县官寨苗族乡",
    image: zhijinImage,
    x: 61,
    y: 17,
    labelSide: "right",
    lngLat: [105.894, 26.778],
    sequence: 3,
    tags: ["地质研学", "洞穴", "温差"],
    riskBase: 58,
    slope: 12,
    distance: "2.8 km",
    congestionBase: 55,
    serviceCoverage: 82,
    aiFit: 79,
    primaryRisk: "洞穴温差与研学队伍管理",
    services: ["游客中心", "研学集合点", "医务室", "讲解服务台"],
    evidence: ["洞穴内外温差明显", "研学团队需要队列管理", "客流压力相对可控"],
    actions: ["研学团队分组进入", "提示外套和防滑鞋", "设置讲解集合点"],
    sources: ["研学预约", "景区年卡访问", "服务点目录", "天气温差"],
  },
  {
    id: "qxn_wanfenglin",
    name: "万峰林将军桥片区",
    shortName: "万峰林",
    city: "黔西南",
    county: "兴义",
    address: "贵州省黔西南州兴义市万峰林街道",
    image: wanfenglinImage,
    x: 57,
    y: 72,
    labelSide: "right",
    lngLat: [104.895, 25.091],
    sequence: 7,
    tags: ["田园", "骑行", "高温"],
    riskBase: 54,
    slope: 10,
    distance: "5.2 km",
    congestionBase: 50,
    serviceCoverage: 80,
    aiFit: 82,
    primaryRisk: "高温暴晒与骑行补给",
    services: ["游客驿站", "骑行补给点", "卫生服务点", "停车换乘点"],
    evidence: ["开阔田园路线受高温影响", "骑行线路较长", "补给点覆盖较完整"],
    actions: ["高温天气调整为清晨出发", "设置补水提醒", "亲子路线不建议长距离骑行"],
    sources: ["天气指数", "骑行线路热力", "服务驿站", "客群画像"],
  },
];

const mapModes = [
  { id: "risk", label: "风险" },
  { id: "route", label: "路线" },
  { id: "service", label: "服务" },
];

const mapPlaces = [
  { label: "四川省", x: 9, y: 15, kind: "province-neighbor" },
  { label: "云南省", x: 37, y: 82, kind: "province-neighbor" },
  { label: "广西壮族自治区", x: 86, y: 82, kind: "province-neighbor" },
  { label: "贵州省", x: 64, y: 31, kind: "province" },
  { label: "遵义市", x: 39, y: 19, kind: "city" },
  { label: "六盘水市", x: 24, y: 49, kind: "city" },
  { label: "安顺市", x: 30, y: 64, kind: "city" },
  { label: "毕节市", x: 48, y: 25, kind: "city" },
  { label: "贵阳市", x: 52, y: 47, kind: "hub" },
  { label: "黔东南苗族侗族自治州", x: 75, y: 49, kind: "region" },
  { label: "黔南布依族苗族自治州", x: 63, y: 63, kind: "region" },
];

const form = reactive({ ...scenarios[0].form });
const integration = reactive({
  health: "checking",
  remote: false,
  services: [],
  corpusTotal: 0,
  corpusMatched: 0,
  corpusResources: [],
  scenicTotal: 0,
  scenicCities: 0,
  scenicHotspots: [],
  scenicInventory: [],
  scenicInventoryLoaded: false,
  holidayRecords: 0,
  holidayHotspots: [],
});
const backend = reactive({
  recommend: null,
  guide: null,
  route: null,
  emergency: null,
  lineage: null,
  ascend: null,
  error: "",
});

const activeScenario = ref(scenarios[0].id);
const activeWorkspace = ref("route");
const selectedId = ref("gy_qingyan");
const mapMode = ref("route");
const bottomMode = ref("route");
const advancedOpen = ref(false);
const detailMode = ref("actions");
const generating = ref(false);
const progress = ref(0);
const routeVersion = ref(1);
const selectedScenicId = ref("");
const scenicQuery = ref("");
const scenicCityFilter = ref("");
const activeAction = ref("");
let progressTimer;

const amapContainer = ref(null);
const amapReady = ref(false);
const amapError = ref("");
const amapConfig = {
  key: import.meta.env.VITE_AMAP_JSAPI_KEY || "",
  securityCode: import.meta.env.VITE_AMAP_SECURITY_JS_CODE || "",
};
const amapEnabled = computed(() => Boolean(amapConfig.key && amapConfig.securityCode));
const cinematicMap = true;
const workspaceMeta = computed(() => workspaceMetaMap[activeWorkspace.value] || workspaceMetaMap.route);
let amapLoaderPromise;
let amapSdk;
let amapInstance;
let amapOverlays = [];
let amapScenicLayer;

const backendScoreMap = computed(() => {
  const map = new Map();
  const candidates = backend.recommend?.candidates || [];
  candidates.forEach((item) => map.set(item.id, Number(item.score || 72)));
  const routeCandidates = [...(backend.route?.allSites || []), ...(backend.route?.sites || [])];
  routeCandidates.forEach((item) => map.set(item.id, Number(item.routeScore || item.score || map.get(item.id) || 72)));
  return map;
});

const backendRouteSiteMap = computed(() => {
  const map = new Map();
  const routeCandidates = [...(backend.route?.allSites || []), ...(backend.route?.sites || [])];
  routeCandidates.forEach((item) => map.set(item.id, item));
  return map;
});

function projectLngLat(lngLat) {
  const lng = Number(lngLat?.[0]);
  const lat = Number(lngLat?.[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return { x: 50, y: 50 };
  return {
    x: Math.max(8, Math.min(92, 8 + ((lng - 103.5) / (109.7 - 103.5)) * 84)),
    y: Math.max(9, Math.min(84, 9 + ((29.3 - lat) / (29.3 - 24.5)) * 75)),
  };
}

function routeImage(site) {
  const value = `${site.name || ""}${(site.tags || []).join("")}`;
  if (value.includes("黄果树") || value.includes("瀑布")) return huangguoshuImage;
  if (value.includes("荔波") || value.includes("亲水") || value.includes("湿地")) return liboImage;
  if (value.includes("梵净") || value.includes("山地") || value.includes("峰")) return fanjingshanImage;
  if (value.includes("西江") || value.includes("苗寨") || value.includes("古镇")) return xijiangImage;
  if (value.includes("织金") || value.includes("洞")) return zhijinImage;
  if (value.includes("万峰") || value.includes("田园")) return wanfenglinImage;
  return qingyanImage;
}

function normalizeRemoteRouteSite(remoteSite, index) {
  const local = sites.find((site) => site.id === remoteSite.id);
  if (local) return null;
  const lngLat = remoteSite.lngLat || [remoteSite.location?.lng, remoteSite.location?.lat];
  const position = projectLngLat(lngLat);
  return {
    id: remoteSite.id,
    name: remoteSite.name,
    shortName: remoteSite.shortName || remoteSite.name?.slice(0, 6) || `景点${index + 1}`,
    city: remoteSite.city || "贵州",
    county: remoteSite.county || remoteSite.district || "",
    address: remoteSite.address || `${remoteSite.city || "贵州"} ${remoteSite.county || ""}`,
    image: routeImage(remoteSite),
    x: position.x,
    y: position.y,
    labelSide: position.x > 65 ? "left" : "right",
    lngLat,
    sequence: index + 20,
    tags: remoteSite.tags || ["自然风光"],
    riskBase: Number(remoteSite.riskBase || remoteSite.riskScore || 55),
    slope: Number(remoteSite.slope || 10),
    distance: remoteSite.distance || `${Number(remoteSite.distanceKm || 2.5).toFixed(1)} km`,
    congestionBase: Number(remoteSite.congestionBase || remoteSite.crowdScore || 55),
    serviceCoverage: Number(remoteSite.serviceCoverage || 75),
    aiFit: Number(remoteSite.aiFit || remoteSite.routeScore || 75),
    primaryRisk: remoteSite.primaryRisk || "节假日客流与服务覆盖",
    services: remoteSite.services || ["景区游客服务点", "属地医疗急救资源"],
    evidence: remoteSite.evidence || ["景区 POI 与游客画像规则综合推估"],
    actions: remoteSite.actions || ["出发前核验开放状态与天气"],
    sources: remoteSite.sources || ["高德景区 POI", "山地安全规则"],
    estimateMode: remoteSite.estimateMode || "rule-estimated",
    risk: Number(remoteSite.riskScore || 55),
    crowd: Number(remoteSite.crowdScore || 55),
    service: Number(remoteSite.serviceCoverage || 75),
    decisionScore: Number(remoteSite.routeScore || 75),
  };
}

const remoteRouteSites = computed(() =>
  (backend.route?.sites || [])
    .map(normalizeRemoteRouteSite)
    .filter(Boolean)
);

const visibleSites = computed(() => {
  const curatedSites = sites.map((site) => {
    const remoteSite = backendRouteSiteMap.value.get(site.id);
    const backendScore = backendScoreMap.value.get(site.id) || 76;
    const risk = Number(remoteSite?.riskScore ?? clamp(site.riskBase + weatherRisk(site) + travelerRisk(site) + intensityRisk(site)));
    const crowd = Number(remoteSite?.crowdScore ?? clamp(site.congestionBase + (form.days > 2 ? 4 : 0) + (form.travelerType === "study" ? 7 : 0)));
    const service = Number(remoteSite?.serviceCoverage ?? clamp(site.serviceCoverage + (backendScore - 75) * 0.2));
    return {
      ...site,
      risk,
      crowd,
      service,
      primaryRisk: remoteSite?.primaryRisk || site.primaryRisk,
      services: remoteSite?.services || site.services,
      evidence: remoteSite?.evidence || site.evidence,
      actions: remoteSite?.actions || site.actions,
      sources: remoteSite?.sources || site.sources,
      distance: remoteSite?.distance || (remoteSite?.distanceKm ? `${Number(remoteSite.distanceKm).toFixed(1)} km` : site.distance),
      estimateMode: remoteSite?.estimateMode || "curated",
      decisionScore: Number(remoteSite?.routeScore ?? (site.aiFit + backendScore * 0.22 + service * 0.18 - risk * 0.34 - crowd * 0.08 + preferenceBoost(site))),
    };
  });
  return [...curatedSites, ...remoteRouteSites.value];
});

const routeSites = computed(() => {
  const backendOrder = backend.route?.routeOrder || [];
  if (backendOrder.length) {
    const ordered = backendOrder
      .map((id) => visibleSites.value.find((site) => site.id === id))
      .filter(Boolean);
    if (ordered.length) return ordered;
  }
  const limit = Math.min(visibleSites.value.length, Math.min(12, Number(form.days) * 3));
  return [...visibleSites.value]
    .sort((a, b) => b.decisionScore - a.decisionScore)
    .slice(0, limit)
    .sort((a, b) => a.sequence - b.sequence);
});

const selectedSite = computed(() => visibleSites.value.find((site) => site.id === selectedId.value) || routeSites.value[0] || visibleSites.value[0]);
const highestRiskSite = computed(() => [...routeSites.value].sort((a, b) => b.risk - a.risk)[0] || selectedSite.value);
const sortedRiskSites = computed(() => [...routeSites.value].sort((a, b) => b.risk - a.risk));
const highRiskCount = computed(() => routeSites.value.filter((site) => site.risk >= 75).length);
const coverageStatus = computed(() => {
  if (serviceCoverage.value >= 88) return "关键服务点覆盖充分";
  if (serviceCoverage.value >= 78) return "部分点位需要补充绑定";
  return "存在应急服务覆盖缺口";
});
const averageRisk = computed(() => Math.round(routeSites.value.reduce((sum, site) => sum + site.risk, 0) / Math.max(routeSites.value.length, 1)));
const serviceCoverage = computed(() => Math.round(routeSites.value.reduce((sum, site) => sum + site.service, 0) / Math.max(routeSites.value.length, 1)));
const routePath = computed(() => smoothRoutePath(routeSites.value));

const scenicInventory = computed(() => integration.scenicInventory || []);
const scenicCityOptions = computed(() =>
  [...new Set(scenicInventory.value.map((spot) => spot.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"))
);
const filteredScenicInventory = computed(() => {
  const keyword = scenicQuery.value.trim();
  return scenicInventory.value.filter((spot) => {
    if (scenicCityFilter.value && spot.city !== scenicCityFilter.value) return false;
    if (!keyword) return true;
    return `${spot.name}${spot.city}${spot.district || ""}${spot.address || ""}${spot.type || ""}`.includes(keyword);
  });
});
const scenicListItems = computed(() => {
  const hasFilter = scenicQuery.value.trim() || scenicCityFilter.value;
  if (hasFilter) return filteredScenicInventory.value.slice(0, 80);
  return [...filteredScenicInventory.value]
    .sort((a, b) => (b.holidayHeatSeed || 0) - (a.holidayHeatSeed || 0))
    .slice(0, 12);
});
const scenicTableItems = computed(() => filteredScenicInventory.value.slice(0, 24));
const selectedScenicSpot = computed(() =>
  scenicInventory.value.find((spot) => spot.id === selectedScenicId.value)
  || filteredScenicInventory.value[0]
  || scenicInventory.value[0]
);
const selectedScenicSpotDetail = computed(() => {
  const spot = selectedScenicSpot.value;
  if (!spot) return "正在从后端加载贵州全省景区 POI。";
  const rating = spot.rating ? `评分 ${spot.rating}，` : "";
  const heat = spot.holidayHeatSeed ? `节假日热度种子 ${spot.holidayHeatSeed}，` : "";
  return `${rating}${heat}来源 ${spot.source || "AMap Place Search"}。${spot.address || "暂无详细地址"}。`;
});

const routeTitle = computed(() => {
  if (backend.route?.routeTitle) return backend.route.routeTitle;
  const first = routeSites.value[0]?.shortName || "贵阳";
  const last = routeSites.value.at(-1)?.shortName || "荔波";
  return `${first}至${last} · ${form.days}天安全线`;
});

const routeSummary = computed(() => {
  if (backend.route?.summary) return backend.route.summary;
  const cities = [...new Set(routeSites.value.map((site) => site.city))].join("、");
  return `基于 ${travelerLabel(form.travelerType)}、${weatherLabel(form.weather)}、${preferenceLabel(form.preference)} 约束，系统生成覆盖 ${cities} 的路线，平均风险 ${averageRisk.value}，应急覆盖 ${serviceCoverage.value}%。`;
});

const mapModeInsight = computed(() => {
  if (mapMode.value === "inventory") {
    return {
      title: `全省景区库 ${scenicInventory.value.length || integration.scenicTotal || 0} 个`,
      detail: selectedScenicSpot.value ? `当前选中：${selectedScenicSpot.value.name}` : "正在加载贵州景区 POI",
    };
  }
  if (mapMode.value === "service") {
    return {
      title: `应急覆盖 ${serviceCoverage.value}%`,
      detail: backend.emergency?.gaps?.length ? `${backend.emergency.gaps.length} 个点位需强化服务绑定` : "当前路线服务覆盖可控",
    };
  }
  if (mapMode.value === "route") {
    return {
      title: `${routeSites.value.length} 个点位已排序`,
      detail: routeTitle.value,
    };
  }
  return {
    title: `最高风险 ${highestRiskSite.value.shortName} ${highestRiskSite.value.risk} 分`,
    detail: highestRiskSite.value.primaryRisk,
  };
});

const bottomModeLabel = computed(() => {
  if (bottomMode.value === "inventory") return "全省景区库";
  if (bottomMode.value === "evidence") return "风险证据";
  return "调度时间轴";
});

const bottomTitle = computed(() => {
  if (bottomMode.value === "inventory") {
    const hasFilter = scenicQuery.value.trim() || scenicCityFilter.value;
    return `${hasFilter ? filteredScenicInventory.value.length : scenicListItems.value.length} 个${hasFilter ? "筛选结果" : "高热度样例"} · 已加载 ${scenicInventory.value.length || integration.scenicTotal || 0} 个`;
  }
  if (bottomMode.value === "evidence") return `${selectedSite.value.shortName} · ${selectedSite.value.risk} 分`;
  const candidatePool = backend.route?.metrics?.candidatePool || integration.scenicTotal || visibleSites.value.length;
  return `${routeSites.value.length} 个行程点 · 从 ${candidatePool} 个候选中生成`;
});

const safetyActions = computed(() => {
  const actions = new Set(backend.route?.actions || []);
  routeSites.value.forEach((site) => site.actions.slice(0, 1).forEach((item) => actions.add(item)));
  if (form.weather === "rain") actions.add("亲水和石板路点位开启防滑提醒");
  if (form.travelerType === "senior" || form.travelerType === "family") actions.add("每 90 分钟绑定休息点和最近医务服务");
  if (highestRiskSite.value.risk >= 75) actions.add(`${highestRiskSite.value.shortName} 设为条件通行点，天气异常时自动降级`);
  return [...actions].slice(0, 5);
});
const visibleSafetyActions = computed(() => safetyActions.value.slice(0, 3));

const inferenceChain = computed(() => [
  { name: "游客需求", detail: "解析人群、天气、强度、偏好", active: true },
  { name: "数据融合层", detail: integration.health === "ok" ? "公共目录、景区 POI、节假日样本已纳入" : "演示数据已加载", active: true },
  { name: "昇腾适配层", detail: backend.ascend?.demoMessage || (integration.remote ? "远程推理服务在线" : "预留 MindIE/vLLM Ascend 部署位"), active: true },
  { name: "风险模型", detail: backend.route?.engine?.name || "坡度、拥堵、天气、服务点共同评分", active: Boolean(routeSites.value.length) },
  { name: "决策摘要", detail: "路线、预警、证据、动作同步生成", active: !generating.value },
]);

const dataFoundationScore = computed(() => {
  if (!integration.corpusTotal && !integration.scenicTotal) return "--";
  return `${integration.scenicTotal || 0}+`;
});

const capabilityRows = computed(() => [
  {
    name: "公共数据底座",
    detail: `目录 ${integration.corpusTotal || 0} 条 · 景区 ${integration.scenicTotal || 0} 个 · 假日样本 ${integration.holidayRecords || 0} 条`,
    ok: integration.corpusMatched > 0 && integration.scenicTotal > 0,
    status: integration.corpusMatched > 0 && integration.scenicTotal > 0 ? "已接入" : "演示中",
  },
  {
    name: "贵州实景地图",
    detail: amapReady.value ? "真实底图、景区点位、路线顺序联动" : "模拟态势图保持可演示",
    ok: amapReady.value,
    status: amapReady.value ? "运行中" : "演示底图",
  },
  {
    name: "路线生成引擎",
    detail: backend.route?.engine?.backend || `面向 ${travelerLabel(form.travelerType)} 的 ${form.days} 天游线动态生成`,
    ok: Boolean(backend.route?.routeOrder?.length || routeSites.value.length),
    status: backend.route ? "接口输出" : "运行中",
  },
  {
    name: "风险解释闭环",
    detail: "风险来源、建议动作、应急服务点同步输出",
    ok: Boolean(selectedSite.value),
    status: "已形成",
  },
  {
    name: "昇腾推理部署",
    detail: backend.ascend?.demoMessage || (integration.remote ? "远程推理服务已在线" : "保留 MindIE/vLLM Ascend 适配层"),
    ok: true,
    muted: !integration.remote,
    status: integration.remote ? "已部署" : "适配位",
  },
]);
const visibleCapabilityRows = computed(() => capabilityRows.value.slice(0, 3));

const publicDataSummary = computed(() => {
  if (!integration.corpusTotal) return "正在加载公开目录、景区点位与节假日样本";
  const names = integration.corpusResources.slice(0, 3).map((item) => item.name).join("、");
  const scenic = integration.scenicTotal
    ? `；景区点位 ${integration.scenicTotal} 个，覆盖 ${integration.scenicCities} 个市州`
    : "";
  const holiday = integration.holidayRecords
    ? `；节假日公开样本 ${integration.holidayRecords} 条`
    : "";
  return `已纳入公开目录 ${integration.corpusTotal} 条，筛出项目相关数据 ${integration.corpusMatched} 条${scenic}${holiday}。重点支撑：${names}`;
});

const mapProviderLabel = computed(() => {
  if (amapReady.value) return "贵州真实地图 · 景区点位联动";
  if (amapError.value) return "地图底图回退 · 路线仍可演示";
  if (amapEnabled.value) return "正在加载贵州实景地图";
  return "演示态势图 · 地图服务可替换";
});

const connectionTone = computed(() => {
  if (integration.health === "ok" && integration.remote) return "remote";
  if (integration.health === "ok") return "local";
  if (integration.health === "error") return "offline";
  return "checking";
});

const connectionLabel = computed(() => {
  if (integration.health === "ok" && integration.remote) {
    return technicalViewEnabled ? "昇腾推理在线" : "AI 决策服务在线";
  }
  if (integration.health === "ok") {
    return technicalViewEnabled ? "验收环境 · 数据已接入" : "服务在线 · 数据已更新";
  }
  if (integration.health === "error") {
    return technicalViewEnabled ? "离线演示 · 规则兜底" : "服务降级 · 核心功能可用";
  }
  return technicalViewEnabled ? "正在加载数据底座" : "正在同步服务状态";
});

const aiStateLabel = computed(() => {
  if (generating.value) return "推理中";
  if (backend.error) return "规则兜底";
  return "路线已生成";
});

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function weatherRisk(site) {
  if (form.weather === "rain") return site.tags.includes("亲水") || site.tags.includes("瀑布") ? 10 : 6;
  if (form.weather === "fog") return site.tags.includes("山地") ? 12 : 4;
  if (form.weather === "heat") return site.tags.includes("高温") || site.tags.includes("骑行") ? 12 : 3;
  return -3;
}

function travelerRisk(site) {
  if (form.travelerType === "family") return site.slope > 18 ? 7 : -2;
  if (form.travelerType === "senior") return site.slope > 15 ? 11 : -4;
  if (form.travelerType === "study") return site.congestionBase > 76 ? 6 : 1;
  return 0;
}

function intensityRisk(site) {
  return Math.round((Number(form.intensity) - 50) * 0.18 + (site.slope > 20 ? 3 : 0));
}

function preferenceBoost(site) {
  if (form.preference === "safe") return site.serviceCoverage * 0.12 - site.riskBase * 0.12;
  if (form.preference === "culture") return site.tags.includes("民族村寨") || site.tags.includes("古镇") ? 12 : 0;
  if (form.preference === "nature") return site.tags.includes("山地") || site.tags.includes("喀斯特") || site.tags.includes("田园") ? 12 : 0;
  if (form.preference === "lowload") return site.slope < 12 ? 12 : -8;
  return 0;
}

const routeCorridors = {
  "gy_qingyan>anshun_huangguoshu": [[16, 46], [18, 52], [23, 57]],
  "anshun_huangguoshu>bj_zhijin": [[39, 57], [47, 53], [53, 47], [57, 39], [59, 29]],
  "bj_zhijin>qny_libo": [[60, 27], [58, 38], [58, 48], [63, 56], [72, 59], [79, 64]],
  "qny_libo>qxn_wanfenglin": [[82, 72], [78, 77], [70, 79], [62, 77]],
};

function smoothRoutePath(route) {
  const points = [];
  route.forEach((site, index) => {
    points.push({ x: Number(site.x), y: Number(site.y) });
    const next = route[index + 1];
    if (!next) return;
    const corridor = routeCorridors[`${site.id}>${next.id}`] || [];
    corridor.forEach(([x, y]) => points.push({ x, y }));
  });

  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incomingDistance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoingDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const radius = Math.min(4.2, incomingDistance * 0.2, outgoingDistance * 0.2);
    const incomingRatio = radius / Math.max(incomingDistance, 0.001);
    const outgoingRatio = radius / Math.max(outgoingDistance, 0.001);
    const entry = {
      x: current.x - (current.x - previous.x) * incomingRatio,
      y: current.y - (current.y - previous.y) * incomingRatio,
    };
    const exit = {
      x: current.x + (next.x - current.x) * outgoingRatio,
      y: current.y + (next.y - current.y) * outgoingRatio,
    };

    path += ` L ${entry.x.toFixed(2)} ${entry.y.toFixed(2)} Q ${current.x} ${current.y}, ${exit.x.toFixed(2)} ${exit.y.toFixed(2)}`;
  }

  const last = points.at(-1);
  return `${path} L ${last.x} ${last.y}`;
}

function travelerLabel(value) {
  return { family: "亲子家庭", senior: "老人同行", study: "研学团队", wellness: "康养游客" }[value] || "游客";
}

function weatherLabel(value) {
  return { rain: "小雨路滑", fog: "山间大雾", heat: "高温暴晒", clear: "晴朗通行" }[value] || "天气";
}

function preferenceLabel(value) {
  return { safe: "安全优先", culture: "民族文化", nature: "山地自然", lowload: "低强度" }[value] || "均衡";
}

function riskClass(score) {
  if (score >= 75) return "risk-high";
  if (score >= 58) return "risk-medium";
  return "risk-low";
}

function riskLabel(score) {
  if (score >= 75) return "较高风险";
  if (score >= 58) return "中风险";
  return "低风险";
}

function switchWorkspace(workspace) {
  activeWorkspace.value = workspace;
  if (workspace === "route" || workspace === "risk") {
    mapMode.value = workspace === "risk" ? "risk" : "route";
    if (workspace === "risk") selectedId.value = highestRiskSite.value?.id || selectedId.value;
    if (bottomMode.value === "inventory") bottomMode.value = "route";
    nextTick(() => {
      amapInstance?.resize?.();
      renderAmapRoute();
    });
  }
}

function selectSite(id) {
  selectedId.value = id;
  activeAction.value = "";
  bottomMode.value = "evidence";
}

function selectRouteSite(id) {
  selectedId.value = id;
  activeAction.value = "";
  bottomMode.value = "evidence";
}

function selectScenicSpot(id) {
  selectedScenicId.value = id;
  const spot = scenicInventory.value.find((item) => item.id === id);
  if (spot?.location && amapReady.value && amapInstance) {
    amapInstance.panTo([spot.location.lng, spot.location.lat], false, 220);
    amapInstance.setZoom(Math.max(amapInstance.getZoom?.() || 8, 10), false, 220);
  }
}

function focusAction(action) {
  activeAction.value = action;
  selectedId.value = highestRiskSite.value?.id || selectedId.value;
  bottomMode.value = "evidence";
}

function setMapMode(mode) {
  mapMode.value = mode;
  if (mode === "inventory") {
    bottomMode.value = "inventory";
    if (selectedScenicSpot.value?.id) selectedScenicId.value = selectedScenicSpot.value.id;
  } else if (mode === "service") {
    bottomMode.value = "evidence";
  } else if (bottomMode.value === "inventory") {
    bottomMode.value = "route";
  }
  nextTick(() => renderAmapRoute());
}

function isInRoute(id) {
  return routeSites.value.some((site) => site.id === id);
}

function routeIndex(id) {
  const index = routeSites.value.findIndex((site) => site.id === id);
  return index >= 0 ? index + 1 : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadAmapLoader() {
  if (typeof window === "undefined") return Promise.reject(new Error("浏览器环境不可用"));
  if (window.AMapLoader) return Promise.resolve(window.AMapLoader);
  if (amapLoaderPromise) return amapLoaderPromise;

  amapLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-amap-loader]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.AMapLoader), { once: true });
      existing.addEventListener("error", () => reject(new Error("高德 Loader 加载失败")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://webapi.amap.com/loader.js";
    script.async = true;
    script.dataset.amapLoader = "true";
    script.onload = () => resolve(window.AMapLoader);
    script.onerror = () => reject(new Error("高德 Loader 加载失败"));
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

async function initAmap() {
  if (!amapEnabled.value || !amapContainer.value || amapInstance) return;

  try {
    amapError.value = "";
    window._AMapSecurityConfig = {
      securityJsCode: amapConfig.securityCode,
    };

    const loader = await loadAmapLoader();
    const AMap = await loader.load({
      key: amapConfig.key,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar"],
    });

    AMap.getConfig().appname = "amap-jsapi-skill";
    amapSdk = AMap;
    amapInstance = new AMap.Map(amapContainer.value, {
      viewMode: "3D",
      zoom: 7.8,
      center: [106.713, 26.578],
      pitch: 48,
      rotation: -8,
      mapStyle: "amap://styles/dark",
      skyColor: "rgba(5, 24, 20, 1)",
      wallColor: "rgba(21, 64, 47, 0.82)",
      roofColor: "rgba(40, 82, 59, 0.9)",
      resizeEnable: true,
    });

    amapInstance.addControl(new AMap.Scale());
    amapInstance.addControl(new AMap.ToolBar({ position: "RT" }));
    amapInstance.on("complete", () => {
      amapReady.value = true;
      renderAmapRoute();
    });
  } catch (error) {
    amapError.value = error?.message || "高德 JSAPI 加载失败";
    amapReady.value = false;
    if (amapInstance) {
      amapInstance.destroy();
      amapInstance = null;
    }
  }
}

function createAmapMarker(site, index) {
  const selected = selectedId.value === site.id ? " selected" : "";
  return `
    <div class="amap-risk-marker ${riskClass(site.risk)}${selected}" role="button" tabindex="0">
      <span>${index + 1}</span>
      <b>${escapeHtml(site.shortName)}</b>
      <small>${site.risk}分</small>
    </div>
  `;
}

function clearAmapOverlays() {
  if (amapInstance && amapOverlays.length) {
    amapInstance.remove(amapOverlays);
  }
  amapOverlays = [];
}

function clearAmapScenicLayer() {
  if (!amapScenicLayer) return;
  if (typeof amapScenicLayer.clear === "function") {
    amapScenicLayer.clear();
  } else if (amapInstance) {
    amapInstance.remove(amapScenicLayer);
    amapScenicLayer = null;
  }
}

function scenicMarkerIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="${color}" fill-opacity=".95" stroke="white" stroke-width="3"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function scenicMarkerColor(spot) {
  if (spot.id === selectedScenicId.value) return "#dc2626";
  if ((spot.holidayHeatSeed || 0) >= 90) return "#d97706";
  if (spot.rating && Number(spot.rating) >= 4.5) return "#047857";
  return "#0f766e";
}

function renderAmapScenicLayer() {
  if (!amapReady.value || !amapInstance || !amapSdk) return;
  if (mapMode.value !== "inventory") {
    if (amapScenicLayer?.hide) amapScenicLayer.hide();
    return;
  }

  if (!amapScenicLayer) {
    amapScenicLayer = new amapSdk.LabelsLayer({
      zooms: [6, 20],
      zIndex: 86,
      collision: true,
      allowCollision: false,
    });
    amapInstance.add(amapScenicLayer);
  }

  if (amapScenicLayer.show) amapScenicLayer.show();
  clearAmapScenicLayer();
  if (!amapScenicLayer) return;

  const markers = scenicInventory.value
    .filter((spot) => spot.location && Number.isFinite(Number(spot.location.lng)) && Number.isFinite(Number(spot.location.lat)))
    .map((spot) => {
      const selected = spot.id === selectedScenicId.value;
      const marker = new amapSdk.LabelMarker({
        name: spot.name,
        position: [Number(spot.location.lng), Number(spot.location.lat)],
        zIndex: selected ? 200 : 80,
        icon: {
          type: "image",
          image: scenicMarkerIcon(scenicMarkerColor(spot)),
          size: selected ? [18, 18] : [10, 10],
          anchor: "center",
        },
        text: {
          content: selected || (spot.holidayHeatSeed || 0) >= 92 ? spot.name : "",
          direction: "right",
          offset: [8, 0],
          style: {
            fontSize: 12,
            fontWeight: selected ? "700" : "500",
            fillColor: "#12352e",
            strokeColor: "#ffffff",
            strokeWidth: 3,
          },
        },
      });
      marker.on?.("click", () => selectScenicSpot(spot.id));
      return marker;
    });

  if (markers.length) {
    amapScenicLayer.add(markers);
    if (!selectedScenicId.value) selectedScenicId.value = scenicInventory.value[0]?.id || "";
    if (mapMode.value === "inventory") amapInstance.setZoomAndCenter(7.3, [106.713, 26.578], false, 180);
  }
}

function renderAmapRoute() {
  if (!amapReady.value || !amapInstance || !amapSdk) return;

  const route = routeSites.value.filter((site) => Array.isArray(site.lngLat));
  clearAmapOverlays();
  if (cinematicMap) return;

  if (mapMode.value !== "inventory" && route.length > 1) {
    amapOverlays.push(
      new amapSdk.Polyline({
        path: route.map((site) => site.lngLat),
        isOutline: true,
        outlineColor: "rgba(255, 255, 255, 0.92)",
        borderWeight: 4,
        strokeColor: "#047857",
        strokeOpacity: 0.96,
        strokeWeight: 6,
        strokeStyle: "solid",
        lineJoin: "round",
        lineCap: "round",
        showDir: true,
        zIndex: 60,
      }),
    );
  }

  if (mapMode.value !== "inventory") route.forEach((site, index) => {
    const marker = new amapSdk.Marker({
      position: site.lngLat,
      content: createAmapMarker(site, index),
      offset: new amapSdk.Pixel(-18, -18),
      title: site.name,
      zIndex: 120 + index,
    });
    marker.on("click", () => selectSite(site.id));
    amapOverlays.push(marker);
  });

  if (amapOverlays.length) {
    amapInstance.add(amapOverlays);
    amapInstance.setZoomAndCenter(7.35, [106.713, 26.578], false, 180);
  }
  renderAmapScenicLayer();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function loadScenicInventory() {
  if (integration.scenicInventoryLoaded) return;
  try {
    const payload = await fetchJson("/api/scenic-spots?limit=2500");
    integration.scenicInventory = payload.spots || [];
    integration.scenicInventoryLoaded = true;
    if (!selectedScenicId.value && integration.scenicInventory.length) {
      selectedScenicId.value = integration.scenicInventory[0].id;
    }
  } catch {
    integration.scenicInventory = [];
  }
}

function payloadFromForm() {
  return {
    request: form.request,
    travelerType: form.travelerType,
    weather: form.weather,
    days: form.days,
    preference: form.preference,
    intensity: form.intensity,
    businessType: "文旅安全服务",
    region: "全省文旅片区",
    strategy: form.preference === "lowload" ? "cost" : form.preference === "safe" ? "balanced" : "policy",
    budget: "standard",
    weights: {
      flow: form.travelerType === "study" ? 9 : 7,
      traffic: form.travelerType === "senior" ? 9 : 8,
      blank: 5,
      policy: form.preference === "culture" ? 8 : 6,
      risk: form.preference === "safe" ? 10 : 8,
    },
    prompt: form.request,
  };
}

async function refreshIntegration() {
  try {
    const [health, status, publicData, scenicSummary, holidayData, ascend] = await Promise.all([
      fetchJson("/api/health"),
      fetchJson("/api/integration-status").catch(() => null),
      fetchJson("/api/public-data/relevant").catch(() => null),
      fetchJson("/api/scenic-spots/summary").catch(() => null),
      fetchJson("/api/holiday-tourism").catch(() => null),
      fetchJson("/api/tourism/ascend-readiness").catch(() => null),
    ]);
    integration.health = health?.ok ? "ok" : "error";
    backend.ascend = ascend;
    integration.remote = Boolean(ascend?.endpointConfigured) || /ascend|mindie|remote/i.test(`${status?.deployment?.aiLayer || ""}${status?.mode || ""}`);
    integration.services = status?.services || [];
    integration.corpusTotal = publicData?.relevance?.total || 0;
    integration.corpusMatched = publicData?.relevance?.matched || 0;
    integration.corpusResources = publicData?.relevance?.resources || [];
    integration.scenicTotal = scenicSummary?.total || 0;
    integration.scenicCities = scenicSummary?.cityCounts?.length || 0;
    integration.scenicHotspots = scenicSummary?.topHotspots || [];
    integration.holidayRecords = holidayData?.records?.length || 0;
    integration.holidayHotspots = [...new Set((holidayData?.records || []).flatMap(record => record.hotspots || []))].slice(0, 8);
    await loadScenicInventory();
  } catch (error) {
    integration.health = "error";
    integration.remote = false;
    integration.services = [];
    backend.error = error.message;
  }
}

async function generateRoute(source = "manual") {
  clearInterval(progressTimer);
  generating.value = true;
  progress.value = source === "initial" ? 18 : 6;
  backend.error = "";
  progressTimer = setInterval(() => {
    progress.value = Math.min(92, progress.value + Math.round(5 + Math.random() * 10));
  }, 180);

  try {
    await refreshIntegration();
    const payload = payloadFromForm();
    const [routePlan, recommend, guide, emergency, lineage, ascend] = await Promise.all([
      fetchJson("/api/tourism/route-plan", { method: "POST", body: JSON.stringify(payload) }),
      fetchJson("/api/recommend", { method: "POST", body: JSON.stringify(payload) }),
      fetchJson("/api/guide-summary", { method: "POST", body: JSON.stringify(payload) }),
      fetchJson("/api/tourism/emergency-coverage", { method: "POST", body: JSON.stringify(payload) }),
      fetchJson("/api/tourism/data-lineage", { method: "POST", body: JSON.stringify(payload) }),
      fetchJson("/api/tourism/ascend-readiness"),
    ]);
    backend.route = routePlan;
    backend.recommend = recommend;
    backend.guide = guide;
    backend.emergency = emergency?.coverage || null;
    backend.lineage = lineage?.lineage || null;
    backend.ascend = ascend;
    progress.value = 100;
    await nextTick();
    selectedId.value = routeSites.value[0]?.id || selectedId.value;
    routeVersion.value += 1;
  } catch (error) {
    backend.error = error.message;
    progress.value = 100;
    selectedId.value = routeSites.value[0]?.id || selectedId.value;
    routeVersion.value += 1;
  } finally {
    clearInterval(progressTimer);
    window.setTimeout(() => {
      generating.value = false;
      progress.value = 0;
    }, 360);
  }
}

function applyScenario(scenario) {
  activeScenario.value = scenario.id;
  Object.assign(form, scenario.form);
  bottomMode.value = "route";
  generateRoute("scenario");
}

watch([routeSites, selectedId, mapMode, selectedScenicId, () => scenicInventory.value.length], () => {
  renderAmapRoute();
});

onMounted(() => {
  if (amapEnabled.value) {
    nextTick(() => initAmap());
  }
  generateRoute("initial");
});

onUnmounted(() => {
  clearInterval(progressTimer);
  clearAmapOverlays();
  clearAmapScenicLayer();
  if (amapInstance) {
    amapInstance.destroy();
    amapInstance = null;
  }
});
</script>

<style>
:root {
  color-scheme: light;
  --void: oklch(94% 0.014 184);
  --ink: oklch(18% 0.035 176);
  --panel: oklch(99% 0.006 175 / 0.72);
  --panel-solid: oklch(99% 0.005 175);
  --panel-high: oklch(96% 0.018 173 / 0.84);
  --glass: oklch(99% 0.008 180 / 0.62);
  --glass-strong: oklch(99% 0.006 175 / 0.82);
  --line: oklch(38% 0.055 176 / 0.15);
  --line-strong: oklch(36% 0.085 170 / 0.3);
  --text: oklch(18% 0.04 176);
  --muted: oklch(39% 0.035 180);
  --soft: oklch(53% 0.034 186);
  --cyan: oklch(56% 0.13 194);
  --green: oklch(49% 0.145 158);
  --green-bright: oklch(67% 0.17 151);
  --amber: oklch(73% 0.15 78);
  --red: oklch(58% 0.2 28);
  --radius: 9px;
  --motion: cubic-bezier(0.22, 1, 0.36, 1);
  font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--void);
  color: var(--text);
}

button,
textarea,
select,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.warroom {
  min-height: 100dvh;
  background:
    radial-gradient(circle at 48% 24%, oklch(74% 0.11 180 / 0.2), transparent 36%),
    radial-gradient(circle at 9% 80%, oklch(64% 0.15 154 / 0.14), transparent 28%),
    linear-gradient(135deg, oklch(98% 0.006 160), oklch(94% 0.022 176) 52%, oklch(91% 0.026 158));
  overflow-x: hidden;
}

.warroom::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(90deg, oklch(31% 0.05 175 / 0.055) 1px, transparent 1px),
    linear-gradient(0deg, oklch(31% 0.05 175 / 0.045) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: linear-gradient(to bottom, black, transparent 88%);
}

.hud-header {
  position: fixed;
  z-index: 30;
  top: 18px;
  left: 24px;
  right: 24px;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto minmax(250px, 1fr);
  align-items: center;
  gap: 16px;
  min-height: 62px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: oklch(99% 0.006 165 / 0.88);
  box-shadow: 0 8px 18px oklch(34% 0.05 176 / 0.08);
  backdrop-filter: blur(18px) saturate(1.08);
}

.identity,
.connection,
.header-center,
.mode-switch,
.timeline-tabs {
  display: flex;
  align-items: center;
}

.identity {
  gap: 12px;
}

.logo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid oklch(38% 0.13 160 / 0.22);
  border-radius: 9px;
  color: oklch(98% 0.006 160);
  background: linear-gradient(135deg, oklch(42% 0.13 158), oklch(47% 0.12 190));
  font-size: 21px;
  font-weight: 900;
}

h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.05;
  letter-spacing: 0;
}

.identity p,
.map-topline span,
.dock-title span,
.timeline-head span,
.decision-hero span {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.header-center {
  justify-content: center;
  gap: 8px;
}

.header-center span,
.connection {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  background: oklch(100% 0.003 165 / 0.7);
  font-size: 13px;
}

.connection {
  justify-self: end;
  gap: 8px;
  color: var(--text);
  background: oklch(96% 0.018 160 / 0.78);
}

.connection i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--amber);
  box-shadow: 0 0 0 5px oklch(70% 0.15 78 / 0.18);
}

.connection.local i,
.connection.remote i {
  background: var(--green);
  box-shadow: 0 0 0 5px oklch(51% 0.15 154 / 0.16);
}

.connection.offline i {
  background: var(--red);
  box-shadow: 0 0 0 5px oklch(62% 0.2 28 / 0.16);
}

.operations-shell {
  position: relative;
  min-height: 100dvh;
  padding: 96px 24px 24px;
}

.map-world {
  position: relative;
  min-height: calc(100dvh - 120px);
}

.map-topline {
  position: absolute;
  z-index: 8;
  top: 0;
  left: 430px;
  right: 430px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 50px;
  padding: 0 8px;
}

.map-topline strong,
.dock-title strong,
.timeline-head strong {
  display: block;
  margin-top: 2px;
  color: var(--text);
  font-size: 18px;
}

.map-topline strong {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mode-switch,
.timeline-tabs {
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: oklch(100% 0.003 165 / 0.74);
}

.mode-switch button,
.timeline-tabs button {
  min-height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  color: var(--muted);
  background: transparent;
  white-space: nowrap;
}

.mode-switch button.active,
.timeline-tabs button.active {
  color: oklch(99% 0.006 165);
  background: var(--green);
}

.satellite-board {
  position: absolute;
  inset: 48px 408px 252px 408px;
  border: 1px solid oklch(42% 0.055 170 / 0.2);
  border-radius: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 52% 46%, oklch(89% 0.06 160 / 0.7), transparent 42%),
    linear-gradient(145deg, oklch(97% 0.012 160), oklch(91% 0.028 175));
  box-shadow: inset 0 0 0 1px oklch(100% 0 0 / 0.68), 0 18px 34px oklch(32% 0.06 176 / 0.12);
}

.amap-layer {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: oklch(94% 0.018 165);
}

.satellite-board::before {
  content: "";
  position: absolute;
  z-index: 2;
  inset: 0;
  background-image:
    linear-gradient(90deg, oklch(31% 0.045 176 / 0.08) 1px, transparent 1px),
    linear-gradient(0deg, oklch(31% 0.045 176 / 0.07) 1px, transparent 1px);
  background-size: 34px 34px;
  opacity: 0.55;
  pointer-events: none;
}

.satellite-board.amap-ready::before {
  opacity: 0.12;
}

.province-map {
  position: absolute;
  z-index: 3;
  inset: -4% 3% 0;
  width: 94%;
  height: 100%;
  transition: filter 220ms ease;
}

.satellite-board.scanning .province-map {
  filter: brightness(1.12) saturate(1.18);
}

.land-shape {
  fill: url(#land);
  stroke: oklch(45% 0.08 165 / 0.36);
  stroke-width: 0.65;
}

.river,
.contour {
  fill: none;
  stroke-linecap: round;
}

.river {
  stroke: oklch(58% 0.11 198 / 0.42);
  stroke-width: 0.6;
}

.contour {
  stroke: oklch(42% 0.055 170 / 0.16);
  stroke-width: 0.45;
  stroke-dasharray: 2.2 2.4;
}

.route-aura,
.route-track,
.route-hotline,
.route-flow {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.route-aura {
  stroke: oklch(79% 0.19 151 / 0.26);
  stroke-width: 5.2;
  filter: blur(2.2px);
}

.route-track {
  stroke: oklch(74% 0.2 151 / 0.68);
  stroke-width: 2.7;
}

.route-hotline {
  stroke: oklch(91% 0.14 151);
  stroke-width: 1.25;
  filter: drop-shadow(0 0 1.4px oklch(84% 0.19 151 / 0.84));
}

.route-flow {
  stroke: oklch(100% 0 0 / 0.9);
  stroke-width: 0.42;
  stroke-dasharray: 1.1 12;
  animation: routeFlow 3.6s linear infinite;
}

.map-place-layer {
  position: absolute;
  z-index: 5;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.map-place {
  position: absolute;
  color: oklch(94% 0.012 160 / 0.72);
  font-size: 12px;
  line-height: 1;
  text-shadow:
    0 1px 2px oklch(8% 0.025 170 / 0.9),
    0 0 5px oklch(8% 0.025 170 / 0.65);
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

.map-place.province {
  color: oklch(96% 0.012 160 / 0.82);
  font-size: 23px;
  font-weight: 700;
}

.map-place.province-neighbor {
  color: oklch(90% 0.01 160 / 0.42);
  font-size: 15px;
}

.map-place.region {
  color: oklch(93% 0.012 160 / 0.64);
  font-size: 11px;
}

.map-place.hub {
  display: flex;
  align-items: center;
  gap: 6px;
  color: oklch(98% 0.008 160 / 0.92);
  font-size: 12px;
  font-weight: 700;
}

.map-place.hub i {
  display: block;
  width: 18px;
  height: 18px;
  border: 2px solid oklch(96% 0.02 155 / 0.8);
  border-radius: 50%;
  background: oklch(20% 0.035 170 / 0.82);
  box-shadow: 0 0 0 4px oklch(85% 0.13 151 / 0.12);
}

.site-pin {
  position: absolute;
  z-index: 6;
  display: grid;
  place-items: center;
  width: 0;
  height: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%);
}

.site-pin.dimmed {
  opacity: 0.35;
}

.pulse {
  position: absolute;
  width: 42px;
  height: 42px;
  border: 1px solid oklch(51% 0.15 154 / 0.22);
  border-radius: 999px;
  background: oklch(51% 0.15 154 / 0.1);
  animation: pinPulse 2.2s ease-out infinite;
  animation-delay: calc(var(--order) * 70ms);
}

.pin-core {
  position: relative;
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border: 2px solid oklch(100% 0 0 / 0.92);
  border-radius: 999px;
  color: oklch(7% 0.02 220);
  background: var(--green);
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 12px 24px oklch(27% 0.07 165 / 0.22);
}

.risk-medium .pin-core {
  background: var(--amber);
}

.risk-high .pin-core {
  color: oklch(98% 0.006 165);
  background: var(--red);
}

.site-pin.selected .pin-core {
  box-shadow: 0 0 0 8px oklch(51% 0.15 154 / 0.15), 0 14px 30px oklch(27% 0.07 165 / 0.26);
}

.amap-risk-marker {
  display: grid;
  grid-template-columns: 28px auto;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  min-width: 92px;
  padding: 7px 9px 7px 7px;
  border: 1px solid oklch(42% 0.055 170 / 0.2);
  border-radius: 8px;
  color: var(--text);
  background: oklch(99% 0.006 165 / 0.94);
  box-shadow: 0 12px 24px oklch(31% 0.055 170 / 0.18);
  transform: translateY(0);
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  backdrop-filter: blur(10px);
}

.amap-risk-marker span {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: oklch(7% 0.026 220);
  background: var(--green);
  font-size: 12px;
  font-weight: 900;
}

.amap-risk-marker.risk-medium span {
  background: var(--amber);
}

.amap-risk-marker.risk-high span {
  color: oklch(99% 0.006 165);
  background: var(--red);
}

.amap-risk-marker b,
.amap-risk-marker small {
  display: block;
  white-space: nowrap;
}

.amap-risk-marker b {
  font-size: 13px;
  line-height: 1.1;
}

.amap-risk-marker small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 11px;
}

.amap-risk-marker:hover,
.amap-risk-marker.selected {
  border-color: oklch(51% 0.15 154 / 0.48);
  box-shadow: 0 0 0 7px oklch(51% 0.15 154 / 0.12), 0 14px 30px oklch(31% 0.055 170 / 0.2);
  transform: translateY(-2px);
}

.pin-label {
  position: absolute;
  left: 20px;
  top: -12px;
  display: grid;
  min-width: 118px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(99% 0.006 165 / 0.92);
  box-shadow: 0 12px 24px oklch(31% 0.055 170 / 0.16);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-5px);
  transition: opacity 150ms ease, transform 150ms ease;
  backdrop-filter: blur(10px);
}

.pin-label b {
  font-size: 12px;
}

.pin-label small {
  color: var(--muted);
  font-size: 11px;
}

.pin-label em {
  font-style: normal;
  font-weight: 700;
}

.pin-label em.risk-low {
  color: oklch(79% 0.19 151);
}

.pin-label em.risk-medium {
  color: oklch(80% 0.17 83);
}

.pin-label em.risk-high {
  color: oklch(67% 0.22 28);
}

.site-pin:hover .pin-label,
.site-pin.selected .pin-label {
  opacity: 1;
  transform: translateX(0);
}

.map-metric {
  position: absolute;
  z-index: 7;
  display: grid;
  min-width: 104px;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: oklch(100% 0.003 165 / 0.82);
  color: var(--text);
  box-shadow: 0 12px 22px oklch(31% 0.055 170 / 0.12);
  backdrop-filter: blur(12px);
}

.map-metric span {
  color: var(--muted);
  font-size: 12px;
}

.map-metric strong {
  font-size: 30px;
  line-height: 1;
}

.metric-a {
  top: 18px;
  left: 18px;
}

.metric-b {
  right: 18px;
  bottom: 18px;
}

.metric-c {
  left: 18px;
  bottom: 18px;
}

.risk-radar {
  position: absolute;
  z-index: 2;
  inset: 14% 16%;
  border-radius: 999px;
  pointer-events: none;
}

.risk-radar span {
  position: absolute;
  inset: 12%;
  border: 1px solid oklch(51% 0.15 154 / 0.12);
  border-radius: inherit;
  animation: radar 4s ease-out infinite;
}

.risk-radar span:nth-child(2) {
  animation-delay: 1.2s;
}

.risk-radar span:nth-child(3) {
  animation-delay: 2.4s;
}

.map-provider-badge {
  position: absolute;
  z-index: 8;
  right: 16px;
  top: 16px;
  display: grid;
  gap: 2px;
  max-width: min(320px, calc(100% - 32px));
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.86);
  backdrop-filter: blur(12px);
  font-size: 12px;
  box-shadow: 0 12px 22px oklch(31% 0.055 170 / 0.12);
}

.map-provider-badge::before {
  content: "";
  position: absolute;
  left: 10px;
  top: 50%;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--amber);
  transform: translateY(-50%);
}

.map-provider-badge span,
.map-provider-badge small {
  padding-left: 14px;
}

.map-provider-badge.ready::before {
  background: var(--green);
}

.map-provider-badge.error::before {
  background: var(--red);
}

.map-provider-badge small {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-mode-panel {
  position: absolute;
  z-index: 8;
  left: 18px;
  top: 88px;
  display: grid;
  gap: 3px;
  max-width: min(360px, calc(100% - 36px));
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.86);
  box-shadow: 0 10px 18px oklch(31% 0.055 170 / 0.1);
  backdrop-filter: blur(12px);
}

.map-mode-panel b {
  font-size: 13px;
}

.map-mode-panel span {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scan-banner {
  position: absolute;
  z-index: 9;
  left: 50%;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(560px, calc(100% - 42px));
  padding: 11px 12px;
  border: 1px solid oklch(42% 0.055 170 / 0.2);
  border-radius: 10px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.88);
  box-shadow: 0 12px 24px oklch(31% 0.055 170 / 0.14);
  backdrop-filter: blur(12px);
  transform: translateX(-50%);
}

.scan-banner span {
  width: 46px;
  height: 5px;
  border-radius: 999px;
  background: var(--green);
  animation: scan 700ms ease-in-out infinite alternate;
}

.mission-dock,
.decision-dock,
.timeline-dock {
  position: absolute;
  z-index: 12;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: 0 10px 24px oklch(34% 0.05 176 / 0.1);
  backdrop-filter: blur(18px) saturate(1.05);
}

.mission-dock {
  top: 144px;
  left: 24px;
  bottom: 260px;
  width: 360px;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  overflow: auto;
}

.decision-dock {
  top: 144px;
  right: 24px;
  bottom: 260px;
  width: 360px;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  overflow: auto;
}

.dock-title {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
}

.mission-input {
  width: 100%;
  min-height: 126px;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  outline: none;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.82);
  line-height: 1.65;
}

.mission-input:focus,
select:focus,
button:focus-visible {
  border-color: var(--cyan);
  outline: 3px solid oklch(55% 0.14 188 / 0.14);
  outline-offset: 2px;
}

.quick-strip {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-strip button,
.action-stack button,
.route-stop {
  border: 1px solid var(--line);
  border-radius: 9px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.72);
  text-align: left;
  transition: transform 150ms ease, border-color 150ms ease, background 150ms ease;
}

.quick-strip button {
  min-height: 62px;
  padding: 10px;
}

.quick-strip button:hover,
.action-stack button:hover,
.route-stop:hover {
  transform: translateY(-1px);
  border-color: var(--line-strong);
  background: oklch(92% 0.034 166 / 0.86);
}

.quick-strip button.active {
  border-color: oklch(51% 0.15 154 / 0.46);
  background: oklch(89% 0.055 154 / 0.82);
}

.quick-strip b,
.quick-strip small,
.route-stop small {
  display: block;
}

.quick-strip b {
  font-size: 14px;
}

.quick-strip small {
  margin-top: 4px;
  color: var(--muted);
  line-height: 1.35;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.62);
}

.advanced-toggle:hover {
  border-color: var(--line-strong);
  background: oklch(94% 0.02 166 / 0.84);
}

.advanced-toggle span {
  color: var(--muted);
  font-size: 13px;
}

.advanced-toggle b {
  color: var(--cyan);
  font-size: 13px;
}

.advanced-fields {
  display: grid;
  gap: 10px;
}

.control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.control-grid label {
  display: grid;
  gap: 6px;
}

.control-grid span,
.intensity-control span {
  color: var(--muted);
  font-size: 12px;
}

select {
  width: 100%;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(100% 0.003 165);
  outline: none;
}

.intensity-control {
  display: grid;
  gap: 8px;
}

.intensity-control span {
  display: flex;
  justify-content: space-between;
}

.intensity-control b {
  color: var(--cyan);
}

.intensity-control input {
  width: 100%;
  accent-color: var(--cyan);
}

.dispatch-button {
  min-height: 48px;
  border: 0;
  border-radius: 9px;
  color: oklch(99% 0.006 165);
  background: linear-gradient(135deg, oklch(43% 0.13 178), oklch(45% 0.14 154));
  font-weight: 900;
  box-shadow: 0 8px 16px oklch(38% 0.12 166 / 0.16);
}

.dispatch-button:disabled {
  cursor: wait;
  opacity: 0.8;
}

.decision-hero {
  display: grid;
  gap: 6px;
  padding: 13px;
  border: 1px solid oklch(56% 0.19 28 / 0.24);
  border-radius: 10px;
  background:
    radial-gradient(circle at 100% 0, oklch(72% 0.16 32 / 0.26), transparent 48%),
    oklch(98% 0.01 30 / 0.9);
}

.decision-hero strong {
  font-size: 24px;
}

.decision-hero p,
.summary-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.summary-copy {
  padding: 0 2px;
}

.decision-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.decision-metrics span {
  display: grid;
  gap: 3px;
  padding: 10px;
  background: oklch(100% 0.003 165 / 0.68);
}

.decision-metrics b {
  color: var(--text);
  font-size: 20px;
  line-height: 1;
}

.decision-metrics small {
  color: var(--muted);
  font-size: 12px;
}

.detail-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: oklch(94% 0.02 166 / 0.66);
}

.detail-tabs button {
  height: 32px;
  border: 0;
  border-radius: 6px;
  color: var(--muted);
  background: transparent;
  font-weight: 800;
}

.detail-tabs button:hover {
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.68);
}

.detail-tabs button.active {
  color: var(--text);
  background: var(--panel-solid);
  box-shadow: 0 1px 0 oklch(42% 0.055 170 / 0.08);
}

.data-market-panel {
  display: grid;
  gap: 8px;
  padding: 11px;
  border: 1px solid oklch(51% 0.15 154 / 0.26);
  border-radius: 10px;
  background:
    radial-gradient(circle at 100% 0, oklch(70% 0.12 165 / 0.2), transparent 44%),
    oklch(95% 0.025 158 / 0.86);
}

.data-market-panel div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.data-market-panel span {
  color: var(--muted);
  font-size: 12px;
}

.data-market-panel strong {
  color: var(--cyan);
  font-size: 20px;
}

.data-market-panel p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.45;
}

.data-market-panel.compact p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.capability-strip {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-top: 2px;
}

.capability-pill {
  display: grid;
  grid-template-columns: 9px 1fr auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-top: 1px solid oklch(51% 0.15 154 / 0.14);
  color: var(--muted);
}

.capability-pill i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--amber);
}

.capability-pill.ok i {
  background: var(--green);
}

.capability-pill.muted i {
  background: var(--cyan);
}

.capability-pill b {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.capability-pill small {
  color: var(--soft);
  font-size: 12px;
  white-space: nowrap;
}

.action-stack,
.chain-panel,
.capability-panel {
  display: grid;
  gap: 8px;
}

.action-stack h2,
.chain-panel h2,
.capability-panel h2 {
  margin: 4px 0 2px;
  font-size: 14px;
}

.action-stack button {
  display: grid;
  grid-template-columns: 10px 1fr;
  gap: 10px;
  align-items: start;
  min-height: 44px;
  padding: 10px;
}

.action-stack.compact button {
  min-height: 42px;
}

.action-stack i {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--green);
}

.chain-panel ol {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chain-panel li {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
}

.chain-panel li span {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  color: var(--soft);
  background: oklch(100% 0 0 / 0.05);
}

.chain-panel li.active span {
  color: oklch(7% 0.026 220);
  background: var(--cyan);
}

.chain-panel b,
.chain-panel small {
  display: block;
}

.chain-panel small {
  margin-top: 3px;
  color: var(--muted);
  line-height: 1.35;
}

.capability-panel {
  padding-top: 2px;
}

.capability-row {
  display: grid;
  grid-template-columns: 9px 1fr auto;
  gap: 9px;
  align-items: center;
  min-height: 50px;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: oklch(100% 0.003 165 / 0.7);
}

.capability-row i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--amber);
  box-shadow: 0 0 0 5px oklch(74% 0.15 78 / 0.12);
}

.capability-row.ok i {
  background: var(--green);
  box-shadow: 0 0 0 5px oklch(66% 0.16 154 / 0.12);
}

.capability-row.muted i {
  background: var(--cyan);
  box-shadow: 0 0 0 5px oklch(74% 0.14 190 / 0.1);
}

.capability-row span,
.capability-row b,
.capability-row small {
  min-width: 0;
}

.capability-row b,
.capability-row small {
  display: block;
}

.capability-row b {
  color: var(--text);
  font-size: 13px;
}

.capability-row small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}

.capability-row strong {
  padding: 4px 8px;
  border: 1px solid oklch(66% 0.16 154 / 0.26);
  border-radius: 999px;
  color: var(--green);
  background: oklch(66% 0.16 154 / 0.08);
  font-size: 12px;
  white-space: nowrap;
}

.capability-row.muted strong {
  border-color: oklch(74% 0.14 190 / 0.24);
  color: var(--cyan);
  background: oklch(74% 0.14 190 / 0.08);
}

.timeline-dock {
  left: 24px;
  right: 24px;
  bottom: 24px;
  min-height: 154px;
  padding: 12px;
}

.timeline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.timeline-head strong {
  font-size: 17px;
}

.route-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(230px, 1fr);
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.route-stop {
  min-height: 96px;
  padding: 12px;
  animation: stopIn 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--delay) * 42ms);
}

.route-stop.selected {
  border-color: oklch(51% 0.15 154 / 0.42);
  background: oklch(91% 0.05 154 / 0.82);
}

.stop-index {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-bottom: 8px;
  border-radius: 999px;
  color: oklch(7% 0.026 220);
  background: var(--cyan);
  font-weight: 900;
}

.route-stop strong {
  display: block;
  margin-bottom: 5px;
  font-size: 15px;
}

.route-stop small {
  color: var(--muted);
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.35;
}

.route-stop div {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 9px;
  color: var(--muted);
  font-size: 12px;
}

.route-stop b {
  display: inline-grid;
  place-items: center;
  min-width: 38px;
  height: 28px;
  border-radius: 7px;
  color: oklch(7% 0.026 220);
  background: var(--green);
}

.route-stop b.risk-medium {
  background: var(--amber);
}

.route-stop b.risk-high {
  color: oklch(98% 0.006 165);
  background: var(--red);
}

.evidence-sheet {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
}

.evidence-main {
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 96px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: oklch(100% 0.003 165 / 0.76);
}

.evidence-main span,
.evidence-main p {
  margin: 0;
  color: var(--muted);
}

.evidence-main strong {
  font-size: 18px;
}

.evidence-main small {
  color: var(--warning);
  font-size: 11px;
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px;
}

.evidence-grid div {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 11px;
  background: oklch(100% 0.003 165 / 0.72);
}

.evidence-grid b {
  color: var(--text);
  font-size: 13px;
}

.evidence-grid span {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.42;
}

.scenic-inventory {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
  min-height: 170px;
}

.inventory-summary {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: oklch(100% 0.003 165 / 0.72);
}

.inventory-summary span,
.inventory-detail span {
  color: var(--muted);
  font-size: 12px;
}

.inventory-summary strong,
.inventory-detail strong {
  display: block;
  margin-top: 3px;
  font-size: 16px;
}

.inventory-summary p,
.inventory-detail p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.inventory-tools {
  display: grid;
  grid-template-columns: 1fr 160px;
  grid-column: 2;
  align-items: start;
  gap: 10px;
  min-width: 0;
}

.inventory-tools input,
.inventory-tools select {
  width: 100%;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.82);
}

.inventory-tools input {
  padding: 0 11px;
}

.inventory-content {
  grid-column: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 10px;
  min-height: 128px;
  min-width: 0;
}

.inventory-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  max-height: 132px;
  overflow: auto;
  padding-right: 3px;
}

.inventory-list button {
  display: grid;
  gap: 3px;
  min-width: 0;
  min-height: 74px;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  background: oklch(100% 0.003 165 / 0.74);
  text-align: left;
}

.inventory-list button:hover,
.inventory-list button.selected {
  border-color: oklch(51% 0.15 154 / 0.42);
  background: oklch(91% 0.05 154 / 0.74);
}

.inventory-list b,
.inventory-list span,
.inventory-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-list b {
  font-size: 13px;
}

.inventory-list span,
.inventory-list small {
  color: var(--muted);
  font-size: 11px;
}

.inventory-detail {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: oklch(94% 0.025 160 / 0.78);
}

.inventory-detail div {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 2px;
}

.inventory-detail div b {
  color: var(--green);
  font-size: 26px;
  line-height: 1;
}

.warroom {
  background: oklch(96% 0.008 165);
}

.warroom::before {
  display: none;
}

.hud-header {
  top: 0;
  left: 112px;
  right: 0;
  grid-template-columns: minmax(260px, 1fr) minmax(260px, 0.7fr) auto;
  min-height: 76px;
  padding: 0 24px;
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: oklch(99% 0.004 165);
  box-shadow: none;
  backdrop-filter: none;
}

.workspace-heading {
  display: grid;
  justify-items: start;
  gap: 2px;
}

.workspace-heading span {
  color: var(--muted);
  font-size: 12px;
}

.workspace-heading strong {
  font-size: 16px;
}

.workspace-nav {
  position: fixed;
  z-index: 34;
  inset: 0 auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 112px;
  padding: 92px 10px 16px;
  background: oklch(24% 0.055 165);
}

.workspace-nav::before {
  content: "工作区";
  position: absolute;
  top: 24px;
  left: 18px;
  color: oklch(88% 0.018 165 / 0.66);
  font-size: 12px;
  font-weight: 800;
}

.workspace-nav button {
  display: grid;
  grid-template-columns: 26px 1fr;
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  min-height: 58px;
  padding: 9px 8px;
  border: 0;
  border-radius: 7px;
  color: oklch(84% 0.018 165);
  background: transparent;
  text-align: left;
  transition: background 160ms ease, color 160ms ease;
}

.workspace-nav button:hover {
  color: white;
  background: oklch(100% 0 0 / 0.08);
}

.workspace-nav button.active {
  color: white;
  background: oklch(54% 0.13 156);
}

.workspace-nav button > span {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: currentColor;
  background: oklch(100% 0 0 / 0.1);
  font-size: 11px;
  font-weight: 900;
}

.workspace-nav b {
  font-size: 13px;
  white-space: nowrap;
}

.workspace-nav small {
  overflow: hidden;
  color: currentColor;
  font-size: 10px;
  opacity: 0.68;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operations-shell {
  padding: 92px 24px 24px 136px;
}

.workspace-route .map-topline {
  left: 520px;
  right: 408px;
}

.workspace-route .satellite-board {
  inset: 48px 408px 252px 520px;
}

.workspace-route .mission-dock {
  left: 136px;
}

.workspace-route .timeline-dock {
  left: 136px;
}

.workspace-page {
  min-height: calc(100dvh - 116px);
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: oklch(99% 0.004 165);
}

.page-masthead {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
}

.page-masthead span,
.section-heading span {
  color: var(--muted);
  font-size: 12px;
}

.page-masthead h2 {
  margin: 4px 0 6px;
  font-size: 26px;
  letter-spacing: 0;
}

.page-masthead p {
  max-width: 680px;
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
}

.page-primary-action {
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 7px;
  color: white;
  background: var(--green);
  font-weight: 800;
}

.overview-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 20px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.overview-strip > div {
  display: grid;
  gap: 5px;
  min-height: 106px;
  padding: 16px 18px;
  background: white;
}

.overview-strip > div + div {
  border-left: 1px solid var(--line);
}

.overview-strip span,
.overview-strip small {
  color: var(--muted);
}

.overview-strip strong {
  font-size: 30px;
  line-height: 1;
}

.risk-workbench,
.resource-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(340px, 0.7fr);
  gap: 18px;
  min-height: 510px;
}

.risk-queue,
.risk-dossier,
.resource-table,
.resource-detail,
.system-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: white;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.section-heading strong {
  display: block;
  margin-top: 3px;
  font-size: 16px;
}

.section-heading > small {
  color: var(--muted);
}

.risk-queue {
  overflow: hidden;
}

.risk-queue > button {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 90px;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 76px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  background: white;
  text-align: left;
}

.risk-queue > button:hover,
.risk-queue > button.selected {
  background: oklch(95% 0.025 157);
}

.risk-queue > button.selected {
  box-shadow: inset 3px 0 var(--green);
}

.risk-score {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 7px;
  color: white;
  background: var(--green);
  font-weight: 900;
}

.risk-score.risk-medium {
  color: var(--text);
  background: var(--amber);
}

.risk-score.risk-high {
  background: var(--red);
}

.risk-row-copy,
.risk-row-status {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.risk-row-copy b,
.risk-row-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-row-copy small,
.risk-row-status small {
  color: var(--muted);
}

.risk-row-status {
  justify-items: end;
}

.risk-dossier {
  display: grid;
  align-content: start;
  padding: 18px;
}

.dossier-hero {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.dossier-hero span,
.dossier-hero p {
  color: var(--muted);
}

.dossier-hero h3 {
  margin: 5px 0;
  font-size: 20px;
}

.dossier-hero p {
  margin: 0;
}

.dossier-hero > strong {
  display: grid;
  place-items: center;
  min-width: 58px;
  height: 58px;
  border-radius: 8px;
  color: white;
  background: var(--green);
  font-size: 24px;
}

.dossier-hero > strong.risk-medium {
  color: var(--text);
  background: var(--amber);
}

.dossier-hero > strong.risk-high {
  background: var(--red);
}

.dossier-section {
  display: grid;
  gap: 10px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.dossier-section ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  line-height: 1.45;
}

.dossier-section button {
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  background: oklch(98% 0.006 165);
  text-align: left;
}

.dossier-footer {
  display: grid;
  gap: 12px;
  padding-top: 16px;
}

.dossier-footer span {
  display: grid;
  gap: 4px;
}

.dossier-footer small {
  color: var(--muted);
}

.inventory-total {
  display: grid;
  justify-items: end;
}

.inventory-total strong {
  color: var(--green);
  font-size: 32px;
  line-height: 1;
}

.resource-toolbar {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) 180px auto;
  gap: 10px;
  align-items: center;
  margin: 20px 0 14px;
}

.resource-toolbar input,
.resource-toolbar select {
  width: 100%;
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--text);
  background: white;
}

.resource-toolbar input {
  padding: 0 12px;
}

.resource-toolbar > span {
  color: var(--muted);
  font-size: 13px;
}

.resource-table {
  overflow: auto;
}

.resource-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) minmax(180px, 1fr) 80px 100px;
  gap: 16px;
  align-items: center;
  width: 100%;
  min-height: 50px;
  padding: 9px 14px;
  border: 0;
  border-bottom: 1px solid var(--line);
  color: var(--text);
  background: white;
  text-align: left;
}

button.resource-row:hover,
button.resource-row.selected {
  background: oklch(95% 0.025 157);
}

.resource-header {
  position: sticky;
  z-index: 2;
  top: 0;
  min-height: 42px;
  color: var(--muted);
  background: oklch(96% 0.01 165);
  font-size: 12px;
}

.resource-detail {
  align-self: start;
  padding: 20px;
}

.resource-detail > span,
.resource-detail > p {
  color: var(--muted);
}

.resource-detail h3 {
  margin: 6px 0 8px;
  font-size: 22px;
}

.resource-detail > p {
  margin: 0 0 18px;
  line-height: 1.5;
}

.resource-detail dl {
  display: grid;
  gap: 0;
  margin: 0;
  border-top: 1px solid var(--line);
}

.resource-detail dl div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}

.resource-detail dt {
  color: var(--muted);
}

.resource-detail dd {
  margin: 0;
  font-weight: 800;
  text-align: right;
}

.resource-note {
  margin-top: 18px;
  padding: 14px;
  border-radius: 7px;
  background: oklch(94% 0.03 157);
}

.resource-note p {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.5;
}

.system-state {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
}

.system-state i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--amber);
}

.system-state.local i,
.system-state.remote i {
  background: var(--green);
}

.system-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 20px;
}

.system-panel {
  overflow: hidden;
}

.system-capability,
.endpoint-row {
  display: grid;
  align-items: center;
  gap: 12px;
  min-height: 60px;
  padding: 11px 15px;
  border-bottom: 1px solid var(--line);
}

.system-capability {
  grid-template-columns: 9px 1fr auto;
}

.system-capability > i {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--amber);
}

.system-capability.ok > i {
  background: var(--green);
}

.system-capability.muted > i {
  background: var(--cyan);
}

.system-capability span {
  display: grid;
  gap: 3px;
}

.system-capability small {
  color: var(--muted);
}

.system-capability > strong {
  font-size: 12px;
}

.system-chain {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0 16px;
  list-style: none;
}

.system-chain li {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}

.system-chain li > span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  color: white;
  background: var(--soft);
  font-weight: 900;
}

.system-chain li.active > span {
  background: var(--green);
}

.system-chain small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
}

.endpoint-row {
  grid-template-columns: minmax(190px, 0.9fr) 1fr auto;
}

.endpoint-row code {
  color: var(--green);
  font-size: 12px;
  font-weight: 800;
}

.endpoint-row span {
  color: var(--muted);
}

.endpoint-row b {
  color: var(--green);
  font-size: 12px;
}

.data-stat-line {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-bottom: 1px solid var(--line);
}

.data-stat-line span {
  display: grid;
  gap: 4px;
  padding: 16px;
}

.data-stat-line span + span {
  border-left: 1px solid var(--line);
}

.data-stat-line b {
  font-size: 24px;
}

.data-stat-line small {
  color: var(--muted);
}

.data-overview ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 16px 34px 18px;
  color: var(--muted);
}

/* Visual system: translucent command surface with restrained motion. */
body {
  background: oklch(92% 0.016 184);
}

.warroom {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(142deg, oklch(96% 0.018 178), oklch(93% 0.022 152) 48%, oklch(92% 0.018 220));
}

.warroom::before {
  content: "";
  position: fixed;
  z-index: -1;
  inset: -18% -30%;
  display: block;
  pointer-events: none;
  background: linear-gradient(
    112deg,
    transparent 26%,
    oklch(76% 0.11 176 / 0.16) 43%,
    oklch(78% 0.1 145 / 0.12) 52%,
    transparent 68%
  );
  opacity: 0.8;
  transform: translate3d(-8%, 0, 0);
  animation: ambientSweep 18s var(--motion) infinite alternate;
}

.hud-header {
  border-bottom-color: oklch(39% 0.055 176 / 0.12);
  background: oklch(99% 0.008 178 / 0.72);
  box-shadow: 0 4px 8px oklch(24% 0.04 182 / 0.06);
  backdrop-filter: blur(22px) saturate(1.18);
}

.logo {
  border-color: oklch(72% 0.14 156 / 0.34);
  background: oklch(38% 0.11 164);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.18);
}

.connection,
.system-state {
  border-color: oklch(45% 0.08 166 / 0.16);
  background: oklch(98% 0.012 165 / 0.58);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.56);
}

.connection i,
.system-state i {
  animation: statusPulse 2.6s var(--motion) infinite;
}

.workspace-nav {
  overflow: hidden;
  border-right: 1px solid oklch(82% 0.06 164 / 0.12);
  background: oklch(18% 0.055 169 / 0.94);
  box-shadow: 4px 0 8px oklch(19% 0.04 176 / 0.08);
  backdrop-filter: blur(20px) saturate(1.12);
}

.workspace-nav::after {
  content: "";
  position: absolute;
  inset: auto 14px 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, oklch(77% 0.12 157 / 0.42), transparent);
}

.workspace-nav button {
  position: relative;
  transition:
    color 240ms var(--motion),
    background 240ms var(--motion),
    transform 240ms var(--motion);
}

.workspace-nav button:hover {
  transform: translate3d(2px, 0, 0);
}

.workspace-nav button.active {
  background: oklch(54% 0.14 158 / 0.82);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.18),
    inset 0 -1px oklch(18% 0.05 169 / 0.14);
}

.workspace-nav button.active::after {
  content: "";
  position: absolute;
  top: 9px;
  right: 8px;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: oklch(91% 0.11 145);
  box-shadow: 0 0 0 5px oklch(91% 0.11 145 / 0.12);
  animation: navSignal 2.4s var(--motion) infinite;
}

.workspace-nav button > span {
  border: 1px solid oklch(100% 0 0 / 0.08);
  background: oklch(100% 0 0 / 0.08);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.08);
}

.workspace-page {
  border-color: oklch(40% 0.06 178 / 0.12);
  background: oklch(99% 0.008 180 / 0.58);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.76),
    0 4px 8px oklch(25% 0.04 182 / 0.06);
  animation: workspaceIn 480ms var(--motion) both;
}

.page-masthead {
  border-bottom-color: oklch(40% 0.06 178 / 0.12);
}

.page-masthead h2 {
  text-wrap: balance;
}

.page-primary-action,
.dispatch-button {
  background: oklch(43% 0.14 158);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.17),
    0 4px 8px oklch(35% 0.12 158 / 0.18);
  transition:
    transform 220ms var(--motion),
    background 220ms var(--motion),
    box-shadow 220ms var(--motion);
}

.page-primary-action:hover,
.dispatch-button:hover {
  background: oklch(47% 0.15 158);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.2),
    0 6px 8px oklch(35% 0.12 158 / 0.22);
  transform: translate3d(0, -2px, 0);
}

.page-primary-action:active,
.dispatch-button:active {
  transform: scale(0.985);
}

.mission-dock,
.decision-dock,
.timeline-dock {
  border-color: oklch(39% 0.06 178 / 0.13);
  background: var(--glass-strong);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.75),
    0 4px 8px oklch(25% 0.04 182 / 0.07);
  backdrop-filter: none;
}

.workspace-route .mission-dock {
  animation: panelIn 520ms var(--motion) both;
}

.workspace-route .satellite-board {
  animation: panelIn 580ms 45ms var(--motion) both;
}

.workspace-route .decision-dock {
  animation: panelIn 540ms 90ms var(--motion) both;
}

.workspace-route .timeline-dock {
  animation: panelIn 520ms 130ms var(--motion) both;
}

.satellite-board {
  border-color: oklch(41% 0.075 178 / 0.2);
  box-shadow:
    inset 0 0 0 1px oklch(100% 0 0 / 0.66),
    0 6px 8px oklch(26% 0.055 184 / 0.11);
}

.satellite-board::after {
  content: "";
  position: absolute;
  z-index: 5;
  left: 0;
  right: 0;
  top: -32%;
  height: 32%;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    oklch(75% 0.12 166 / 0.08),
    oklch(91% 0.05 166 / 0.16),
    transparent
  );
  transform: translate3d(0, -120%, 0);
  animation: mapScan 8s var(--motion) infinite;
}

.map-provider-badge,
.map-mode-panel,
.map-metric,
.scan-banner {
  border-color: oklch(41% 0.06 178 / 0.15);
  background: oklch(99% 0.008 178 / 0.78);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.7),
    0 4px 8px oklch(25% 0.04 182 / 0.08);
}

.mission-input,
.quick-strip button,
.advanced-toggle,
.control-grid select,
.action-stack button,
.route-stop,
.dossier-section button,
.resource-toolbar input,
.resource-toolbar select {
  border-color: oklch(40% 0.06 178 / 0.14);
  background: oklch(99% 0.006 178 / 0.58);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.66);
}

.quick-strip button,
.action-stack button,
.route-stop,
.dossier-section button {
  transition:
    transform 220ms var(--motion),
    border-color 220ms var(--motion),
    background 220ms var(--motion),
    box-shadow 220ms var(--motion);
}

.quick-strip button:hover,
.action-stack button:hover,
.route-stop:hover,
.dossier-section button:hover {
  border-color: oklch(53% 0.13 158 / 0.34);
  background: oklch(97% 0.025 160 / 0.78);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.75),
    0 4px 8px oklch(32% 0.08 165 / 0.08);
  transform: translate3d(0, -2px, 0);
}

.quick-strip button.active,
.route-stop.selected,
.resource-row.selected,
.risk-queue > button.selected {
  border-color: oklch(53% 0.13 158 / 0.34);
  background: oklch(91% 0.065 158 / 0.7);
}

.decision-hero {
  border-color: oklch(61% 0.18 28 / 0.2);
  background: oklch(97% 0.025 28 / 0.72);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.7);
}

.decision-metrics,
.detail-tabs,
.mode-switch,
.timeline-tabs,
.overview-strip {
  border-color: oklch(40% 0.06 178 / 0.13);
  background: oklch(96% 0.018 178 / 0.55);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.62);
}

.detail-tabs button,
.mode-switch button,
.timeline-tabs button {
  transition:
    color 200ms var(--motion),
    background 200ms var(--motion),
    transform 200ms var(--motion);
}

.detail-tabs button:hover,
.mode-switch button:hover,
.timeline-tabs button:hover {
  transform: translate3d(0, -1px, 0);
}

.detail-tabs button.active {
  background: oklch(99% 0.006 178 / 0.84);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.8),
    0 2px 5px oklch(25% 0.04 182 / 0.07);
}

.risk-queue,
.risk-dossier,
.resource-table,
.resource-detail,
.system-panel {
  border-color: oklch(40% 0.06 178 / 0.13);
  background: oklch(99% 0.006 178 / 0.7);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.72);
}

.risk-workbench > *,
.resource-workbench > *,
.system-layout > * {
  animation: contentRise 520ms var(--motion) both;
}

.risk-workbench > :nth-child(2),
.resource-workbench > :nth-child(2),
.system-layout > :nth-child(2) {
  animation-delay: 55ms;
}

.system-layout > :nth-child(3) {
  animation-delay: 95ms;
}

.system-layout > :nth-child(4) {
  animation-delay: 135ms;
}

.overview-strip > div,
.risk-queue > button,
.resource-row,
.system-capability,
.endpoint-row {
  background: oklch(99% 0.006 178 / 0.48);
  transition:
    background 210ms var(--motion),
    transform 210ms var(--motion);
}

.risk-queue > button:hover,
button.resource-row:hover,
.system-capability:hover,
.endpoint-row:hover {
  background: oklch(95% 0.035 164 / 0.68);
}

.risk-queue > button:hover,
button.resource-row:hover {
  transform: translate3d(3px, 0, 0);
}

.resource-header {
  background: oklch(94% 0.024 170 / 0.76);
}

.resource-note {
  background: oklch(91% 0.065 158 / 0.62);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.62);
}

.system-chain li > span,
.stop-index,
.risk-score {
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.2);
}

.amap-risk-marker {
  border-color: oklch(40% 0.06 178 / 0.16);
  background: oklch(99% 0.006 178 / 0.86);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.72),
    0 5px 8px oklch(24% 0.055 182 / 0.12);
  transition:
    transform 220ms var(--motion),
    border-color 220ms var(--motion),
    box-shadow 220ms var(--motion);
}

.amap-risk-marker:hover,
.amap-risk-marker.selected {
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.76),
    0 6px 8px oklch(24% 0.055 182 / 0.16);
}

/* Night operations palette: stronger contrast makes transparency legible. */
body {
  background: oklch(13% 0.025 178);
}

.warroom {
  --void: oklch(14% 0.03 178);
  --panel: oklch(22% 0.035 176 / 0.7);
  --panel-solid: oklch(24% 0.034 176);
  --panel-high: oklch(27% 0.042 174 / 0.82);
  --glass: oklch(21% 0.035 178 / 0.6);
  --glass-strong: oklch(23% 0.035 176 / 0.78);
  --line: oklch(91% 0.02 170 / 0.12);
  --line-strong: oklch(82% 0.08 160 / 0.28);
  --text: oklch(95% 0.012 165);
  --muted: oklch(76% 0.025 172);
  --soft: oklch(64% 0.03 180);
  --cyan: oklch(73% 0.13 190);
  --green: oklch(68% 0.17 153);
  --green-bright: oklch(78% 0.17 148);
  color: var(--text);
  background:
    linear-gradient(145deg, oklch(14% 0.035 172), oklch(18% 0.044 205) 52%, oklch(16% 0.035 96));
}

.warroom::before {
  background: linear-gradient(
    112deg,
    transparent 24%,
    oklch(66% 0.14 173 / 0.11) 41%,
    oklch(75% 0.13 147 / 0.09) 52%,
    transparent 69%
  );
}

.hud-header {
  border-bottom-color: oklch(92% 0.02 170 / 0.1);
  background: oklch(18% 0.035 176 / 0.72);
  box-shadow: 0 4px 8px oklch(5% 0.02 180 / 0.22);
}

.identity p,
.workspace-heading span,
.page-masthead span,
.section-heading span,
.map-topline span,
.dock-title span,
.timeline-head span,
.decision-hero span {
  color: var(--muted);
}

.logo {
  color: oklch(98% 0.006 160);
  background: oklch(52% 0.15 157);
}

.connection,
.system-state {
  color: var(--text);
  border-color: oklch(88% 0.04 165 / 0.14);
  background: oklch(27% 0.04 174 / 0.58);
}

.workspace-nav {
  border-right-color: oklch(92% 0.03 165 / 0.1);
  background: oklch(11% 0.035 171 / 0.94);
  box-shadow: 4px 0 8px oklch(4% 0.02 180 / 0.28);
}

.workspace-nav button {
  color: oklch(78% 0.02 168);
}

.workspace-nav button:hover {
  background: oklch(100% 0 0 / 0.07);
}

.workspace-nav button.active {
  color: oklch(98% 0.005 160);
  background: oklch(49% 0.145 157 / 0.8);
}

.workspace-page,
.mission-dock,
.decision-dock,
.timeline-dock {
  border-color: oklch(91% 0.025 170 / 0.12);
  background: var(--glass-strong);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.09),
    0 5px 8px oklch(4% 0.02 180 / 0.2);
}

.page-masthead,
.section-heading,
.timeline-head,
.dossier-hero,
.dossier-section,
.resource-detail dl,
.resource-detail dl div,
.system-capability,
.endpoint-row,
.system-chain li,
.data-stat-line,
.risk-queue > button,
.resource-row {
  border-color: oklch(91% 0.025 170 / 0.11);
}

.page-masthead p,
.summary-copy,
.decision-hero p,
.overview-strip span,
.overview-strip small,
.risk-row-copy small,
.risk-row-status small,
.dossier-hero span,
.dossier-hero p,
.dossier-section ul,
.dossier-footer small,
.resource-detail > span,
.resource-detail > p,
.resource-detail dt,
.resource-note p,
.system-capability small,
.system-chain small,
.endpoint-row span,
.data-stat-line small,
.data-overview ul {
  color: var(--muted);
}

.page-primary-action,
.dispatch-button {
  color: oklch(14% 0.035 172);
  background: var(--green-bright);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.24),
    0 5px 8px oklch(5% 0.02 180 / 0.26);
}

.page-primary-action:hover,
.dispatch-button:hover {
  color: oklch(11% 0.03 172);
  background: oklch(82% 0.18 146);
}

.mission-input,
.quick-strip button,
.advanced-toggle,
.control-grid select,
.intensity-control input,
.action-stack button,
.route-stop,
.dossier-section button,
.resource-toolbar input,
.resource-toolbar select {
  color: var(--text);
  border-color: oklch(91% 0.025 170 / 0.12);
  background: oklch(17% 0.03 178 / 0.46);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.07);
}

.mission-input::placeholder,
.resource-toolbar input::placeholder {
  color: oklch(70% 0.025 172);
}

.quick-strip button:hover,
.action-stack button:hover,
.route-stop:hover,
.dossier-section button:hover {
  border-color: oklch(78% 0.15 151 / 0.3);
  background: oklch(31% 0.065 164 / 0.68);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.1),
    0 5px 8px oklch(4% 0.02 180 / 0.2);
}

.quick-strip button.active,
.route-stop.selected,
.resource-row.selected,
.risk-queue > button.selected {
  color: var(--text);
  border-color: oklch(78% 0.15 151 / 0.34);
  background: oklch(39% 0.1 158 / 0.52);
}

.quick-strip small,
.route-stop small,
.advanced-toggle span,
.control-grid span,
.intensity-control span {
  color: var(--muted);
}

.map-topline strong,
.dock-title strong,
.timeline-head strong,
.page-masthead h2,
.section-heading strong,
.resource-detail h3,
.dossier-hero h3 {
  color: var(--text);
}

.mode-switch,
.timeline-tabs,
.detail-tabs,
.decision-metrics,
.overview-strip {
  border-color: oklch(91% 0.025 170 / 0.12);
  background: oklch(15% 0.028 178 / 0.42);
}

.mode-switch button,
.timeline-tabs button,
.detail-tabs button {
  color: var(--muted);
}

.mode-switch button.active,
.timeline-tabs button.active {
  color: oklch(13% 0.035 172);
  background: var(--green-bright);
}

.detail-tabs button.active {
  color: var(--text);
  background: oklch(38% 0.075 166 / 0.68);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.11),
    0 3px 5px oklch(4% 0.02 180 / 0.17);
}

.decision-metrics span,
.overview-strip > div {
  background: oklch(18% 0.03 178 / 0.38);
}

.decision-hero {
  border-color: oklch(75% 0.17 28 / 0.22);
  background: oklch(30% 0.08 24 / 0.5);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.08);
}

.risk-queue,
.risk-dossier,
.resource-table,
.resource-detail,
.system-panel {
  border-color: oklch(91% 0.025 170 / 0.12);
  background: oklch(18% 0.03 178 / 0.48);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.08);
}

.overview-strip > div,
.risk-queue > button,
.resource-row,
.system-capability,
.endpoint-row {
  color: var(--text);
  background: oklch(19% 0.032 178 / 0.34);
}

.risk-queue > button:hover,
button.resource-row:hover,
.system-capability:hover,
.endpoint-row:hover {
  background: oklch(31% 0.065 164 / 0.56);
}

button.resource-row.selected {
  color: var(--text);
  background: oklch(39% 0.1 158 / 0.58);
}

.resource-header {
  color: var(--muted);
  background: oklch(29% 0.05 172 / 0.68);
}

.resource-note {
  background: oklch(36% 0.09 158 / 0.48);
}

.endpoint-row code,
.endpoint-row b,
.inventory-total strong,
.data-market-panel strong {
  color: var(--green-bright);
}

.map-provider-badge,
.map-mode-panel,
.map-metric,
.scan-banner {
  color: oklch(96% 0.01 165);
  border-color: oklch(92% 0.03 165 / 0.14);
  background: oklch(15% 0.035 176 / 0.78);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.1),
    0 5px 8px oklch(4% 0.02 180 / 0.24);
  backdrop-filter: blur(12px) saturate(1.1);
}

.map-provider-badge small,
.map-mode-panel span,
.map-metric span {
  color: oklch(79% 0.02 170);
}

.amap-risk-marker {
  color: oklch(96% 0.01 165);
  border-color: oklch(92% 0.03 165 / 0.16);
  background: oklch(15% 0.035 176 / 0.84);
  box-shadow:
    inset 0 1px oklch(100% 0 0 / 0.1),
    0 5px 8px oklch(4% 0.02 180 / 0.26);
}

.amap-risk-marker small {
  color: oklch(78% 0.02 170);
}

.capability-pill,
.inventory-summary,
.inventory-list button,
.inventory-detail,
.evidence-main,
.evidence-grid {
  border-color: oklch(91% 0.025 170 / 0.11);
}

@keyframes ambientSweep {
  from {
    opacity: 0.58;
    transform: translate3d(-8%, 0, 0);
  }
  to {
    opacity: 0.9;
    transform: translate3d(8%, 0, 0);
  }
}

@keyframes workspaceIn {
  from {
    opacity: 0.25;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes panelIn {
  from {
    opacity: 0.3;
    transform: translate3d(0, 10px, 0) scale(0.992);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes contentRise {
  from {
    opacity: 0.35;
    transform: translate3d(0, 10px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes mapScan {
  0%,
  20% {
    opacity: 0;
    transform: translate3d(0, -120%, 0);
  }
  35% {
    opacity: 0.78;
  }
  70% {
    opacity: 0.36;
    transform: translate3d(0, 420%, 0);
  }
  100% {
    opacity: 0;
    transform: translate3d(0, 420%, 0);
  }
}

@keyframes statusPulse {
  0%,
  100% {
    box-shadow: 0 0 0 4px oklch(55% 0.15 158 / 0.12);
  }
  50% {
    box-shadow: 0 0 0 7px oklch(55% 0.15 158 / 0.04);
  }
}

@keyframes navSignal {
  0%,
  100% {
    opacity: 0.65;
    transform: scale(0.82);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes routeFlow {
  to {
    stroke-dashoffset: -36;
  }
}

@keyframes pinPulse {
  from {
    opacity: 0.8;
    transform: scale(0.62);
  }
  to {
    opacity: 0;
    transform: scale(1.65);
  }
}

@keyframes radar {
  from {
    opacity: 0.48;
    transform: scale(0.55);
  }
  to {
    opacity: 0;
    transform: scale(1.18);
  }
}

@keyframes scan {
  from {
    opacity: 0.45;
    transform: translateX(0);
  }
  to {
    opacity: 1;
    transform: translateX(18px);
  }
}

@keyframes stopIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1280px) {
  .hud-header {
    grid-template-columns: 1fr;
  }

  .header-center,
  .connection {
    justify-self: start;
  }

  .operations-shell {
    padding-top: 190px;
  }

  .map-topline,
  .satellite-board,
  .mission-dock,
  .decision-dock,
  .timeline-dock {
    position: relative;
    inset: auto;
    left: auto;
    right: auto;
    bottom: auto;
    top: auto;
    width: auto;
  }

  .workspace-route .map-topline,
  .workspace-route .satellite-board,
  .workspace-route .mission-dock,
  .workspace-route .timeline-dock {
    inset: auto;
    left: auto;
    right: auto;
  }

  .map-world {
    display: grid;
    grid-template-columns: 360px 1fr;
    grid-template-areas:
      "mission top"
      "mission map"
      "decision decision"
      "timeline timeline";
    gap: 14px;
    min-height: auto;
  }

  .map-topline {
    grid-area: top;
    padding: 0;
  }

  .mission-dock {
    grid-area: mission;
  }

  .satellite-board {
    grid-area: map;
    min-height: 520px;
  }

  .decision-dock {
    grid-area: decision;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .timeline-dock {
    grid-area: timeline;
  }
}

@media (max-width: 820px) {
  .hud-header {
    left: 12px;
    right: 12px;
  }

  .operations-shell {
    padding: 198px 12px 12px;
  }

  .map-world {
    grid-template-columns: 1fr;
    grid-template-areas:
      "top"
      "mission"
      "map"
      "decision"
      "timeline";
  }

  .map-topline,
  .timeline-head {
    align-items: stretch;
    flex-direction: column;
  }

  .satellite-board {
    min-height: 460px;
  }

  .decision-dock {
    grid-template-columns: 1fr;
  }

  .control-grid,
  .quick-strip,
  .evidence-sheet,
  .evidence-grid,
  .scenic-inventory,
  .inventory-tools,
  .inventory-content {
    grid-template-columns: 1fr;
  }

  .inventory-tools,
  .inventory-content {
    grid-column: auto;
  }

  .route-rail {
    grid-auto-columns: 86%;
  }
}

@media (max-width: 1280px) {
  .hud-header {
    position: fixed;
    top: 0;
    left: 92px;
    right: 0;
    grid-template-columns: minmax(220px, 1fr) minmax(220px, 0.7fr) auto;
    min-height: 72px;
    padding: 0 18px;
  }

  .header-center {
    display: none;
  }

  .workspace-nav {
    width: 92px;
    padding-inline: 8px;
  }

  .workspace-nav button {
    grid-template-columns: 22px 1fr;
    column-gap: 6px;
    padding-inline: 6px;
  }

  .workspace-nav button > span {
    width: 22px;
    height: 24px;
  }

  .operations-shell {
    min-height: 100dvh;
    padding: 88px 16px 16px 108px;
  }

  .map-world {
    display: grid;
    grid-template-columns: 330px minmax(0, 1fr);
    grid-template-areas:
      "mission top"
      "mission map"
      "decision decision"
      "timeline timeline";
    gap: 14px;
    min-height: auto;
  }

  .map-topline,
  .satellite-board,
  .mission-dock,
  .decision-dock,
  .timeline-dock {
    position: relative;
    inset: auto;
    width: auto;
  }

  .map-topline {
    grid-area: top;
    padding: 0;
  }

  .mission-dock {
    grid-area: mission;
  }

  .satellite-board {
    grid-area: map;
    min-height: 500px;
  }

  .decision-dock {
    grid-area: decision;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .timeline-dock {
    grid-area: timeline;
  }

  .workspace-page {
    min-height: calc(100dvh - 104px);
    padding: 20px;
  }

  .risk-workbench,
  .resource-workbench {
    grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.7fr);
  }
}

@media (max-width: 900px) {
  .hud-header {
    left: 72px;
    grid-template-columns: 1fr auto;
  }

  .workspace-heading {
    display: none;
  }

  .workspace-nav {
    width: 72px;
    padding-inline: 7px;
  }

  .workspace-nav::before {
    left: 12px;
  }

  .workspace-nav button {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .workspace-nav button > span {
    grid-row: auto;
  }

  .workspace-nav b {
    font-size: 11px;
  }

  .workspace-nav small {
    display: none;
  }

  .operations-shell {
    padding-left: 84px;
  }

  .page-masthead,
  .timeline-head {
    align-items: stretch;
    flex-direction: column;
  }

  .overview-strip,
  .system-layout,
  .risk-workbench,
  .resource-workbench {
    grid-template-columns: 1fr;
  }

  .overview-strip > div + div {
    border-top: 1px solid var(--line);
    border-left: 0;
  }

  .resource-toolbar {
    grid-template-columns: 1fr;
  }

  .resource-row {
    grid-template-columns: minmax(180px, 1.4fr) minmax(150px, 1fr) 62px 74px;
  }
}

/* Image-led route and risk workspaces */
.workspace-nav {
  width: 210px;
  padding: 112px 14px 18px;
}

.workspace-nav::before {
  display: none;
}

.nav-brand {
  position: absolute;
  top: 20px;
  left: 16px;
  right: 16px;
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 10px;
  align-items: center;
}

.nav-brand .logo {
  width: 42px;
  height: 42px;
}

.nav-brand strong,
.nav-brand small {
  display: block;
}

.nav-brand strong {
  color: var(--text);
  font-size: 18px;
}

.nav-brand small {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.3;
}

.workspace-nav button {
  min-height: 60px;
  padding: 10px 12px;
}

.hud-header {
  display: block;
  top: 22px;
  right: 24px;
  left: auto;
  width: auto;
  min-height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.hud-header .identity,
.hud-header .workspace-heading {
  display: none;
}

.connection {
  justify-self: auto;
  min-height: 42px;
  padding: 0 16px;
  backdrop-filter: blur(18px) saturate(1.2);
}

.operations-shell {
  min-height: 100dvh;
  padding: 92px 24px 24px 234px;
}

.workspace-route,
.workspace-risk {
  padding: 0;
}

.workspace-route .map-world,
.workspace-risk .map-world {
  position: fixed;
  z-index: 1;
  inset: 0 0 0 210px;
  min-height: 100dvh;
}

.workspace-route .satellite-board,
.workspace-risk .satellite-board {
  position: absolute;
  inset: 0;
  min-height: 100dvh;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(90deg, oklch(7% 0.03 174 / 0.2), transparent 28%, transparent 74%, oklch(7% 0.03 174 / 0.22)),
    url("./assets/guizhou-relief-map.png") center / cover no-repeat;
  box-shadow: none;
}

.workspace-route .amap-layer,
.workspace-risk .amap-layer {
  opacity: 0.1;
  mix-blend-mode: luminosity;
}

.workspace-route .province-map,
.workspace-risk .province-map {
  z-index: 5;
  inset: 0;
  width: 100%;
  height: 100%;
}

.workspace-route .province-map rect,
.workspace-route .province-map .land-shape,
.workspace-route .province-map .river,
.workspace-route .province-map .contour,
.workspace-risk .province-map rect,
.workspace-risk .province-map .land-shape,
.workspace-risk .province-map .river,
.workspace-risk .province-map .contour {
  display: none;
}

.workspace-route .route-aura,
.workspace-risk .route-aura {
  stroke: oklch(82% 0.19 151 / 0.38);
  stroke-width: 12px;
  filter: blur(4px);
}

.workspace-route .route-track,
.workspace-risk .route-track {
  stroke: oklch(76% 0.21 151 / 0.8);
  stroke-width: 4.2px;
}

.workspace-route .route-hotline,
.workspace-risk .route-hotline {
  stroke: oklch(96% 0.1 151);
  stroke-width: 2px;
  filter: drop-shadow(0 0 2px oklch(86% 0.19 151 / 0.82));
}

.workspace-route .route-flow,
.workspace-risk .route-flow {
  stroke: oklch(100% 0 0 / 0.74);
  stroke-width: 1px;
  stroke-dasharray: 8 68;
}

.workspace-risk .route-track {
  stroke: oklch(75% 0.18 68 / 0.66);
}

.workspace-risk .route-aura,
.workspace-risk .route-hotline {
  stroke: oklch(78% 0.18 69);
}

.workspace-route .satellite-board::before,
.workspace-risk .satellite-board::before {
  z-index: 4;
  opacity: 1;
  background:
    linear-gradient(90deg, oklch(9% 0.03 174 / 0.52), transparent 24%, transparent 73%, oklch(8% 0.03 174 / 0.5)),
    linear-gradient(180deg, oklch(7% 0.025 174 / 0.35), transparent 22%, transparent 72%, oklch(7% 0.025 174 / 0.5));
}

.workspace-risk .satellite-board::before {
  background:
    radial-gradient(circle at 36% 59%, oklch(58% 0.23 31 / 0.64), transparent 8%),
    radial-gradient(circle at 36% 59%, oklch(72% 0.19 72 / 0.45), transparent 18%),
    radial-gradient(circle at 30% 52%, oklch(70% 0.17 78 / 0.18), transparent 30%),
    linear-gradient(90deg, oklch(7% 0.03 174 / 0.66), transparent 29%, transparent 70%, oklch(7% 0.03 174 / 0.62)),
    linear-gradient(180deg, oklch(6% 0.025 174 / 0.35), transparent 24%, transparent 76%, oklch(6% 0.025 174 / 0.48));
  mix-blend-mode: screen;
}

.workspace-route .map-topline,
.workspace-risk .map-topline {
  position: absolute;
  z-index: 24;
  top: 22px;
  left: 184px;
  right: 330px;
  min-height: 62px;
  padding: 8px 16px;
  border: 1px solid oklch(92% 0.03 165 / 0.14);
  border-radius: 12px;
  background: oklch(13% 0.035 174 / 0.76);
  box-shadow: 0 12px 28px oklch(3% 0.02 180 / 0.3);
  backdrop-filter: blur(20px) saturate(1.24);
}

.workspace-route .map-topline strong,
.workspace-risk .map-topline strong {
  max-width: 420px;
  font-size: 16px;
}

.workspace-route .mode-switch,
.workspace-risk .mode-switch {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.workspace-route .map-metric,
.workspace-risk .map-metric,
.workspace-route .map-mode-panel,
.workspace-risk .map-mode-panel {
  display: none;
}

.workspace-route .map-provider-badge,
.workspace-risk .map-provider-badge {
  top: 104px;
  right: 24px;
}

.workspace-route .mission-dock {
  position: fixed;
  z-index: 22;
  top: auto;
  right: auto;
  bottom: 220px;
  left: 234px;
  width: 318px;
  max-height: calc(100dvh - 280px);
  padding: 14px;
  overflow: auto;
  border-radius: 12px;
  background: oklch(12% 0.035 174 / 0.78);
  box-shadow: 0 18px 42px oklch(3% 0.02 180 / 0.34);
  backdrop-filter: blur(22px) saturate(1.18);
}

.workspace-route .mission-input {
  min-height: 92px;
  resize: none;
}

.workspace-route .advanced-toggle {
  min-height: 34px;
}

.workspace-route .dispatch-button {
  min-height: 46px;
}

.workspace-route .decision-dock {
  position: fixed;
  z-index: 22;
  top: 104px;
  right: 24px;
  bottom: auto;
  left: auto;
  width: 286px;
  max-height: calc(100dvh - 280px);
  padding: 14px;
  overflow: auto;
  border-radius: 12px;
  background: oklch(12% 0.035 174 / 0.8);
  box-shadow: 0 18px 42px oklch(3% 0.02 180 / 0.34);
  backdrop-filter: blur(22px) saturate(1.18);
}

.workspace-route .summary-copy {
  display: none;
}

.workspace-route .decision-hero {
  padding: 12px;
}

.workspace-route .decision-hero strong {
  font-size: 22px;
}

.workspace-route .decision-metrics span:nth-child(3) {
  display: none;
}

.workspace-route .decision-metrics {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workspace-route .data-market-panel {
  min-width: 0;
  border-color: oklch(84% 0.08 158 / 0.16);
  background: oklch(16% 0.04 169 / 0.78);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.07);
}

.workspace-route .data-market-panel > div,
.workspace-route .capability-strip {
  min-width: 0;
}

.workspace-route .data-market-panel span,
.workspace-route .data-market-panel p {
  color: oklch(82% 0.025 165);
}

.workspace-route .capability-pill {
  min-width: 0;
  border-color: oklch(88% 0.04 164 / 0.11);
}

.workspace-route .capability-pill b {
  min-width: 0;
  white-space: normal;
}

.workspace-route .capability-pill small {
  color: oklch(77% 0.03 165);
}

.workspace-route .action-stack h2,
.workspace-route .chain-panel h2 {
  margin-top: 0;
}

.workspace-route .timeline-dock {
  position: fixed;
  z-index: 22;
  right: 24px;
  bottom: 18px;
  left: 234px;
  min-height: 0;
  height: 168px;
  padding: 10px 12px;
  border-radius: 12px;
  background: oklch(12% 0.035 174 / 0.82);
  box-shadow: 0 18px 42px oklch(3% 0.02 180 / 0.34);
  backdrop-filter: blur(22px) saturate(1.18);
}

.workspace-route .timeline-head {
  margin-bottom: 8px;
}

.workspace-route .timeline-head span {
  display: none;
}

.workspace-route .timeline-head strong {
  font-size: 14px;
}

.workspace-route .timeline-dock:has(.evidence-sheet) {
  height: 190px;
}

.workspace-route .evidence-sheet {
  grid-template-columns: minmax(210px, 0.8fr) minmax(0, 3.2fr);
  min-width: 0;
}

.workspace-route .evidence-main {
  min-width: 0;
  border-color: oklch(87% 0.05 164 / 0.14);
  background: oklch(17% 0.04 171 / 0.72);
  box-shadow: inset 0 1px oklch(100% 0 0 / 0.07);
}

.workspace-route .evidence-main span,
.workspace-route .evidence-main p {
  color: oklch(82% 0.025 165);
}

.workspace-route .evidence-main strong {
  color: oklch(97% 0.01 160);
}

.workspace-route .evidence-grid {
  min-width: 0;
  border-color: oklch(87% 0.05 164 / 0.14);
  background: oklch(8% 0.025 174 / 0.58);
}

.workspace-route .evidence-grid div {
  min-width: 0;
  background: oklch(17% 0.04 171 / 0.7);
}

.workspace-route .evidence-grid b {
  color: oklch(96% 0.012 160);
}

.workspace-route .evidence-grid span {
  overflow-wrap: anywhere;
  color: oklch(80% 0.025 165);
}

.workspace-route .route-rail {
  grid-auto-columns: minmax(224px, 1fr);
  gap: 8px;
}

.workspace-route .route-stop {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: stretch;
  gap: 10px;
  min-height: 92px;
  padding: 7px;
  overflow: hidden;
  background: oklch(17% 0.035 174 / 0.66);
}

.workspace-route .route-stop:hover .route-thumb img,
.workspace-route .route-stop.selected .route-thumb img {
  transform: scale(1.055);
  filter: saturate(1.08) contrast(1.04);
}

.workspace-route .route-thumb {
  position: relative;
  display: block;
  min-height: 78px;
  overflow: hidden;
  border-radius: 7px;
  background: oklch(20% 0.04 170);
}

.workspace-route .route-thumb::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(180deg, transparent 48%, oklch(8% 0.03 174 / 0.54));
  pointer-events: none;
}

.workspace-route .route-thumb img {
  width: 100%;
  height: 100%;
  min-height: 78px;
  object-fit: cover;
  transition:
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 280ms ease;
}

.workspace-route .route-thumb .stop-index {
  position: absolute;
  z-index: 2;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  margin: 0;
  border: 1px solid oklch(96% 0.02 155 / 0.5);
  color: oklch(98% 0.01 155);
  background: oklch(38% 0.14 155 / 0.9);
  box-shadow: 0 5px 12px oklch(4% 0.02 175 / 0.3);
  font-size: 11px;
}

.workspace-route .route-stop-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
}

.workspace-route .route-stop strong {
  margin: 0 0 4px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-route .route-address {
  display: block;
  overflow: hidden;
  color: oklch(85% 0.025 165 / 0.68);
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-route .route-stop-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
}

.workspace-route .route-stop-meta b {
  min-width: 31px;
  height: 22px;
  border-radius: 5px;
  font-size: 11px;
}

.workspace-route .pin-label,
.workspace-risk .pin-label {
  top: -22px;
  left: 18px;
  display: grid;
  gap: 2px;
  min-width: 108px;
  padding: 7px 10px;
  border-color: oklch(92% 0.03 165 / 0.16);
  border-radius: 7px;
  color: var(--text);
  background: oklch(11% 0.035 174 / 0.88);
  box-shadow: 0 5px 8px oklch(3% 0.02 180 / 0.28);
  transform: none;
  backdrop-filter: blur(10px) saturate(1.08);
}

.workspace-route .site-pin:not(.dimmed) .pin-label,
.workspace-risk .site-pin:not(.dimmed) .pin-label {
  opacity: 1;
  transform: none;
}

.workspace-route .site-pin.dimmed .pin-label,
.workspace-risk .site-pin.dimmed .pin-label {
  display: none;
}

.workspace-route .site-pin.label-left .pin-label,
.workspace-risk .site-pin.label-left .pin-label {
  right: 18px;
  left: auto;
}

.workspace-route .site-pin:not(.dimmed) .pin-core,
.workspace-risk .site-pin:not(.dimmed) .pin-core {
  color: oklch(98% 0.008 160);
  background: oklch(47% 0.16 151);
  box-shadow:
    0 0 0 5px oklch(76% 0.18 151 / 0.18),
    0 0 13px oklch(76% 0.2 151 / 0.46);
}

.workspace-route .site-pin:not(.dimmed) .pulse,
.workspace-risk .site-pin:not(.dimmed) .pulse {
  width: 30px;
  height: 30px;
  border-color: oklch(84% 0.16 151 / 0.34);
  background: oklch(76% 0.18 151 / 0.1);
}

.workspace-route .pin-label b,
.workspace-risk .pin-label b {
  font-size: 13px;
  line-height: 1.1;
}

.workspace-route .pin-label small,
.workspace-risk .pin-label small {
  color: oklch(90% 0.015 160 / 0.82);
  line-height: 1.25;
}

.workspace-risk .risk-workspace {
  position: fixed;
  z-index: 18;
  inset: 0 0 0 210px;
  min-height: 100dvh;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  pointer-events: none;
}

.workspace-risk .risk-workspace > * {
  pointer-events: auto;
}

.workspace-risk .page-masthead {
  display: none;
}

.workspace-risk .overview-strip {
  position: absolute;
  z-index: 23;
  right: 330px;
  bottom: 20px;
  left: 330px;
  margin: 0;
  min-height: 72px;
  border-radius: 12px;
  background: oklch(12% 0.035 174 / 0.8);
  box-shadow: 0 18px 42px oklch(3% 0.02 180 / 0.34);
  backdrop-filter: blur(22px) saturate(1.18);
}

.workspace-risk .overview-strip > div {
  min-height: 72px;
  padding: 11px 14px;
  background: transparent;
}

.workspace-risk .overview-strip strong {
  font-size: 22px;
}

.workspace-risk .risk-workbench {
  position: absolute;
  z-index: 22;
  inset: 104px 24px 112px;
  display: grid;
  grid-template-columns: 292px minmax(180px, 1fr) 310px;
  gap: 20px;
  min-height: 0;
  pointer-events: none;
}

.workspace-risk .risk-queue {
  grid-column: 1;
  align-self: start;
  max-height: calc(100dvh - 230px);
  overflow: auto;
  background: oklch(12% 0.035 174 / 0.82);
  box-shadow: 0 18px 42px oklch(3% 0.02 180 / 0.34);
  backdrop-filter: blur(22px) saturate(1.18);
  pointer-events: auto;
}

.workspace-risk .risk-dossier {
  grid-column: 3;
  align-self: start;
  max-height: calc(100dvh - 230px);
  overflow: auto;
  background: oklch(12% 0.035 174 / 0.84);
  box-shadow: 0 18px 42px oklch(3% 0.02 180 / 0.34);
  backdrop-filter: blur(22px) saturate(1.18);
  pointer-events: auto;
}

.workspace-risk .risk-queue > button {
  min-height: 68px;
}

.workspace-risk .risk-dossier .dossier-section {
  padding: 13px 0;
}

.workspace-risk .map-provider-badge {
  display: none;
}

@media (max-width: 1280px) {
  .workspace-nav {
    width: 92px;
    padding: 88px 8px 16px;
  }

  .nav-brand {
    top: 16px;
    left: 10px;
    right: 10px;
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .nav-brand > div:last-child {
    display: none;
  }

  .workspace-route .map-world,
  .workspace-risk .map-world,
  .workspace-risk .risk-workspace {
    left: 92px;
  }

  .workspace-route .map-topline,
  .workspace-risk .map-topline {
    left: 360px;
    right: 16px;
  }

  .workspace-route .mission-dock {
    top: 92px;
    bottom: auto;
    left: 108px;
    width: 330px;
    max-height: none;
  }

  .workspace-route .decision-dock {
    top: 620px;
    right: 16px;
    bottom: auto;
    left: 108px;
    width: auto;
    max-height: none;
  }

  .workspace-route .timeline-dock {
    position: relative;
    right: auto;
    bottom: auto;
    left: auto;
    margin: 1050px 16px 16px 108px;
  }

  .workspace-risk .risk-workbench {
    grid-template-columns: 270px 1fr 290px;
    inset-inline: 16px;
  }

  .workspace-risk .overview-strip {
    right: 326px;
    left: 306px;
  }
}

@media (max-width: 900px) {
  .workspace-route .map-topline,
  .workspace-risk .map-topline {
    top: 12px;
    right: 12px;
    left: 84px;
  }

  .workspace-route .mission-dock {
    top: 92px;
    right: 12px;
    left: 84px;
    width: auto;
  }

  .workspace-route .decision-dock {
    top: 610px;
    right: 12px;
    left: 84px;
  }

  .workspace-route .timeline-dock {
    margin: 1030px 12px 12px 84px;
  }

  .workspace-risk .risk-workbench {
    inset: 96px 12px 150px 84px;
    display: grid;
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .workspace-risk .risk-queue,
  .workspace-risk .risk-dossier {
    grid-column: 1;
    max-height: none;
  }

  .workspace-risk .overview-strip {
    right: 12px;
    bottom: 12px;
    left: 84px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
