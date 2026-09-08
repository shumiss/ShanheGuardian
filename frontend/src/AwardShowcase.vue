<template>
  <div class="award-app">
    <header class="award-header">
      <a class="award-brand" href="#top" aria-label="山河守护首页">
        <span>山</span>
        <div>
          <strong>山河守护</strong>
          <small>全国复杂地形旅行 AI</small>
        </div>
      </a>

      <nav aria-label="主导航">
        <a href="#journey">我的行程</a>
        <a href="#intelligence">安全决策</a>
        <a href="?mode=demo">管理端</a>
      </nav>

      <a class="demo-link" href="?mode=demo">
        产品演示
        <ArrowUpRight :size="16" />
      </a>
    </header>

    <main>
      <section id="top" class="travel-hero">
        <div class="hero-images" aria-hidden="true">
          <img
            v-for="(slide, index) in heroSlides"
            :key="slide.name"
            :src="slide.image"
            :class="{ active: heroIndex === index }"
            :style="slide.style"
            :fetchpriority="index === 0 ? 'high' : 'auto'"
            decoding="async"
            alt=""
          />
        </div>
        <div class="hero-scrim"></div>

        <div class="hero-copy">
          <h1>山河守护</h1>
          <p>AI 读懂同行人、天气与复杂地形风险，为全国旅行生成真正能走的安全路线。</p>
        </div>

        <div ref="placeSwitcher" class="place-switcher" aria-label="切换贵州首个样板目的地">
          <button
            v-for="(slide, index) in heroSlides"
            :key="slide.name"
            type="button"
            :class="{ active: heroIndex === index }"
            :aria-label="`切换至${slide.city}${slide.name}`"
            :aria-pressed="heroIndex === index"
            @click="selectHero(index)"
          >
            <span class="place-index">0{{ index + 1 }}</span>
            <div>
              <strong>{{ slide.name }}</strong>
              <small>{{ slide.city }}</small>
            </div>
            <span class="place-progress" aria-hidden="true"></span>
          </button>
        </div>

        <div class="planner-shell">
          <div class="scenario-tabs">
            <button
              v-for="scene in scenes"
              :key="scene.id"
              type="button"
              :class="{ active: activeScene === scene.id }"
              @click="applyScene(scene)"
            >
              <component :is="scene.icon" :size="15" />
              {{ scene.label }}
            </button>
            <button
              type="button"
              :class="{ active: activeScene === 'custom' }"
              @click="openCustomPlanner"
            >
              <SlidersHorizontal :size="15" />
              自由定制
            </button>
          </div>

          <form class="planner-form" @submit.prevent="generateJourney">
            <div class="planner-region-field">
              <label for="travel-region">旅行区域</label>
              <input
                id="travel-region"
                v-model.trim="selectedRegion"
                list="travel-region-list"
                autocomplete="off"
                placeholder="输入省、市或景区片区"
                @change="changeRegion"
              />
              <datalist id="travel-region-list">
                <option v-for="region in travelRegions" :key="region.name" :value="region.name">
                  {{ region.landmark }}
                </option>
              </datalist>
            </div>
            <div ref="originPicker" class="origin-field origin-picker">
              <span>出发城市</span>
              <button
                type="button"
                :aria-label="`选择出发城市，当前${selectedOrigin}`"
                aria-haspopup="listbox"
                :aria-expanded="originMenuOpen"
                @click.stop="originMenuOpen = !originMenuOpen"
              >
                {{ selectedOrigin }}
                <ChevronDown :size="15" :class="{ open: originMenuOpen }" />
              </button>
              <Transition name="origin-menu">
              <div v-if="originMenuOpen" class="origin-menu" role="listbox" aria-label="全国常用出发城市">
                  <button
                    v-for="city in originCities"
                    :key="city"
                    type="button"
                    role="option"
                    :aria-selected="selectedOrigin === city"
                    :class="{ active: selectedOrigin === city }"
                    @click="selectOrigin(city)"
                  >
                    {{ city }}
                  </button>
                </div>
              </Transition>
            </div>
            <div class="planner-field">
              <label for="award-query">这次想去哪里，和谁同行？</label>
              <input
                id="award-query"
                v-model="query"
                autocomplete="off"
                aria-describedby="intent-recognition"
                @input="queueIntentParsing"
                @blur="handleQueryBlur"
              />
            </div>
            <button type="submit" :disabled="planning">
              <span v-if="planning" class="button-progress"></span>
              <Sparkles v-else :size="18" />
              {{ planning ? '正在生成' : '生成行程' }}
              <ArrowRight v-if="!planning" :size="17" />
            </button>
          </form>

          <div id="intent-recognition" class="planner-status" aria-live="polite">
            <span v-if="intentParseState === 'typing'" class="intent-recognition">
              <LoaderCircle :size="14" class="spin" />
              正在理解行程条件
            </span>
            <span v-else-if="intentRecognitionText" class="intent-recognition recognized">
              <Sparkles :size="14" />
              已识别 {{ intentRecognitionText }}
            </span>
            <span>
              <CloudSun :size="14" />
              {{ originWeather ? `${selectedOrigin}实况 ${originWeather.weather} ${originWeather.temperature}°` : `${selectedRegion}天气接入中` }}
            </span>
            <span>
              <Database :size="14" />
              {{ scenicScopeText }}
            </span>
            <span>
              <ShieldCheck :size="14" />
              路线风险可解释
            </span>
          </div>
        </div>

        <a class="scroll-cue" href="#journey" aria-label="查看生成的路线">
          <span></span>
          查看路线
        </a>
      </section>

      <section id="journey" class="journey-section">
        <div class="journey-heading">
          <div>
            <p>{{ planningError || (routeGenerated ? '已根据实时条件重新校准' : '默认示范行程') }}</p>
            <h2 :class="{ 'long-title': displayRouteTitle.length > 24 }">{{ displayRouteTitle }}</h2>
          </div>
          <div class="journey-summary">
            <span>{{ currentItinerary.length }} 天</span>
            <span>{{ currentStops.length }} 站</span>
            <span>{{ intensityLabel }}</span>
          </div>
        </div>

        <div class="journey-workspace">
          <div class="itinerary-column">
            <div class="day-switch">
              <button
                v-for="day in currentItinerary"
                :key="day.day"
                type="button"
                :class="{ active: activeDay === day.day }"
                @click="selectDay(day.day)"
              >
                <span>第 {{ day.day }} 天</span>
                <small>{{ day.sites.length }} 站</small>
              </button>
            </div>

            <div class="day-context">
              <div>
                <small>当日安排</small>
                <strong>{{ activeDayPlan?.theme || '等待生成路线' }}</strong>
              </div>
              <span>{{ activeDayCities || '暂未安排目的地' }}</span>
            </div>

            <div class="itinerary-list">
              <button
                v-for="(stop, index) in visibleStops"
                :key="stop.id"
                type="button"
                :class="{ active: selectedStopId === stop.id }"
                @click="selectStop(stop)"
              >
                <span class="stop-time">{{ stop.time }}</span>
                <span class="stop-image">
                  <img
                    v-if="hasStopImage(stop)"
                    :src="imageUrlForStop(stop)"
                    :alt="stop.name"
                    referrerpolicy="no-referrer"
                    @error="markImageFailed(stop)"
                  />
                  <span v-else class="stop-image-empty">
                    <MapPin :size="17" />
                    <small>{{ stop.city }}</small>
                  </span>
                </span>
                <span class="stop-copy">
                  <small>{{ stop.city }} · {{ stop.category }}</small>
                  <strong>{{ stop.name }}</strong>
                  <em>{{ stop.description }}</em>
                  <small v-if="stop.departureTime" class="stop-schedule">
                    {{ stop.time }} 到达 · {{ stop.departureTime }} 离开 · 游览 {{ stop.visitDurationMinutes }} 分钟
                    <template v-if="stop.openingWindow"> · 开放 {{ stop.openingWindow.open }}-{{ stop.openingWindow.close }}</template>
                  </small>
                </span>
                <span class="stop-state">
                  <strong :class="`risk-${riskFor(stop).level}`">{{ riskFor(stop).score }}</strong>
                  <small>{{ riskFor(stop).label }}</small>
                </span>
                <ChevronRight :size="18" />
              </button>
              <div v-if="!visibleStops.length" class="day-empty">
                <MapPin :size="21" />
                <strong>这一天还没有安排点位</strong>
                <span>点击“生成行程”，AI 会根据天数、距离和安全条件自动补全。</span>
              </div>
            </div>

            <div v-if="visibleStops.length" class="route-decision">
              <div>
                <ShieldCheck :size="20" />
                <span>
                  <strong>{{ selectedStop.name }}安全提示</strong>
                  {{ selectedStop.advice }}
                </span>
              </div>
              <a href="?mode=demo">查看证据链 <ArrowRight :size="15" /></a>
            </div>
          </div>

          <aside class="route-side">
            <div class="mini-map" :data-zoom="mapViewport.zoom.toFixed(2)">
              <img
                v-if="mapSrc"
                :src="mapSrc"
                :style="mapImageStyle"
                :alt="`${selectedRegion}路线地图`"
                @error="handleMapImageError"
              />
              <span v-else class="map-loading">真实地图加载中</span>
              <svg viewBox="0 0 1024 576" preserveAspectRatio="none" aria-hidden="true">
                <path class="map-route-halo" :d="routePath"></path>
                <path class="map-route-line" :d="routePath"></path>
              </svg>
              <button
                v-for="(stop, index) in visibleStops"
                :key="stop.id"
                type="button"
                :class="{ active: selectedStopId === stop.id }"
                :style="{ left: `${mapPositionFor(stop).x}%`, top: `${mapPositionFor(stop).y}%` }"
                @click="selectStop(stop)"
              >
                {{ index + 1 }}
              </button>
              <span class="map-note">
                第 {{ activeDay }} 天 · 局部路线图
              </span>
            </div>

            <div class="local-snapshot">
              <div class="snapshot-title">
                <div>
                  <small>{{ selectedStop.city }} · {{ selectedWeatherLabel }}</small>
                  <h3>{{ selectedStop.name }}</h3>
                </div>
                <MapPin :size="19" />
              </div>

              <div class="snapshot-data">
                <div>
                  <span>天气</span>
                  <strong>{{ selectedWeatherText }}</strong>
                </div>
                <div>
                  <span>客流</span>
                  <strong>{{ selectedCrowd?.crowdIndex ?? '--' }}<small>/100</small></strong>
                </div>
                <div>
                  <span>风险</span>
                  <strong>{{ riskFor(selectedStop).score }}<small>/100</small></strong>
                </div>
              </div>

              <p>天气为高德市州级{{ selectedWeather?.dataType === 'forecast' ? '逐日预报' : '实况' }} · {{ crowdData.dataType === 'authorized-realtime' ? '景区授权实时客流' : '客流为模型估算' }}</p>
              <div v-if="selectedNearbyServices.length" class="nearby-services">
                <strong><ShieldCheck :size="14" /> 附近真实应急资源</strong>
                <span v-for="service in selectedNearbyServices" :key="service.id">
                  <b>{{ service.typeLabel }}</b>{{ service.name }}<small v-if="service.distanceM">约 {{ service.distanceM }} 米</small>
                </span>
              </div>
            </div>
          </aside>
        </div>

        <details v-if="currentOptimization" class="route-proof">
          <summary>
            <span class="proof-title">
              <BrainCircuit :size="19" />
              <span><strong>为什么是这条路线</strong><small>{{ currentOptimization.selectedLabel }} · 多目标约束优化</small></span>
            </span>
            <span class="proof-facts">
              <span><b>{{ currentOptimization.candidateCount }}</b> 有效候选</span>
              <span><b>{{ currentOptimization.constraintsPassed }}/{{ currentOptimization.constraintsTotal }}</b> 约束</span>
              <span><b>{{ currentOptimization.objectiveScore }}</b> 优化分</span>
              <span><b>{{ agentTrace?.totalMs ?? '--' }}</b> ms</span>
            </span>
            <ChevronDown :size="18" />
          </summary>

          <div class="proof-content">
            <section class="strategy-proof">
              <header>
                <div><small>路线策略</small><strong>同一需求，权重不同，路线不同</strong></div>
                <div class="strategy-switch" aria-label="路线优化策略">
                  <button
                    v-for="mode in routeModeOptions"
                    :key="mode.id"
                    type="button"
                    :class="{ active: selectedRouteMode === mode.id }"
                    :disabled="planning"
                    @click="applyRouteMode(mode.id)"
                  >
                    {{ mode.label }}
                  </button>
                </div>
              </header>
              <div class="objective-bars">
                <div v-for="item in objectiveItems" :key="item.key">
                  <span>{{ item.label }} · {{ item.weight }}%<b>{{ item.value }}</b></span>
                  <i><em :style="{ width: `${item.value}%` }"></em></i>
                </div>
              </div>
              <p>
                {{ currentOptimization.formula }}
                <template v-if="currentOptimization.solver">
                  · 2-opt 将估算路程从 {{ currentOptimization.solver.initialDistanceKm }} km 优化至 {{ currentOptimization.solver.optimizedDistanceKm }} km，缩短 {{ currentOptimization.solver.improvementPercent }}%
                </template>
              </p>
              <div class="weather-scenario">
                <button type="button" :disabled="scenarioPlanning" @click="runWeatherScenario('rain')">
                  <CloudSun :size="14" />{{ scenarioPlanning ? '正在复算' : '降雨情景推演' }}
                </button>
                <div v-if="weatherScenario">
                  <span>路线{{ weatherScenario.routeChanged ? '已调整' : '保持' }}</span>
                  <strong>平均风险 {{ weatherScenario.averageRisk }}<em :class="{ safer: weatherScenario.riskDelta <= 0 }">{{ weatherScenario.riskDelta >= 0 ? '+' : '' }}{{ weatherScenario.riskDelta }}</em></strong>
                  <small>{{ weatherScenario.changedStops.length ? `替换 ${weatherScenario.changedStops.slice(0, 3).join('、')}` : '无需替换点位，调整安全动作与停留时间' }}</small>
                  <button type="button" @click="applyWeatherScenario">应用替代路线</button>
                </div>
                <small v-else>用于答辩展示天气变化后的重新规划，不代表当前实时天气。</small>
              </div>
            </section>

            <section class="constraint-proof">
              <header><small>硬约束校验</small><strong>先满足边界，再比较体验</strong></header>
              <ul>
                <li v-for="constraint in currentOptimization.constraints" :key="constraint.id">
                  <span :class="{ passed: constraint.passed }"><Check :size="13" /></span>
                  <span><strong>{{ constraint.label }}</strong><small>{{ constraint.value }}</small></span>
                </li>
              </ul>
            </section>

            <section class="agent-proof">
              <header><small>智能体执行轨迹</small><strong>{{ agentTrace?.steps?.length || 0 }} 步工具链</strong></header>
              <ol>
                <li v-for="step in agentTrace?.steps || []" :key="step.id">
                  <span></span>
                  <div><strong>{{ step.label }}</strong><small>{{ step.tool }} · {{ step.detail }}</small></div>
                  <b>{{ step.durationMs > 0 ? `${step.durationMs} ms` : '<1 ms' }}</b>
                </li>
              </ol>
            </section>
          </div>
        </details>
      </section>

      <section id="intelligence" class="intelligence-section">
        <div class="intelligence-copy">
          <h2>不是推荐几个景点，<br />而是完成一次安全决策。</h2>
          <p>游客需求进入系统后，会依次经过公共数据融合、昇腾推理适配、山地风险模型与行动建议生成。</p>
          <a href="?mode=demo">进入完整决策台 <ArrowUpRight :size="16" /></a>
        </div>

        <div class="decision-flow" aria-label="AI 决策链路">
          <article v-for="(step, index) in decisionFlow" :key="step.title">
            <span>{{ index + 1 }}</span>
            <div>
              <strong>{{ step.title }}</strong>
              <p>{{ step.copy }}</p>
            </div>
            <i></i>
          </article>
        </div>
      </section>

      <section class="destination-section">
        <div class="destination-heading">
          <h2>山河万里，不只有一种走法。</h2>
          <p>同一个目的地，会因为同行人、天气和体力条件生成不同答案；贵州是首个完整样板。</p>
        </div>

        <div class="destination-reel">
          <button
            v-for="spot in scenicReel"
            :key="spot.id"
            type="button"
            @click="planFromSpot(spot)"
          >
            <img :src="spot.image" :alt="spot.name" />
            <span></span>
            <div>
              <small>{{ spot.city }}</small>
              <strong>{{ spot.name }}</strong>
              <em>{{ spot.category }}</em>
            </div>
          </button>
        </div>
      </section>
    </main>

    <footer>
      <div class="award-brand">
        <span>山</span>
        <div><strong>山河守护</strong><small>全国复杂地形旅行 AI</small></div>
      </div>
      <p>让每一次复杂地形旅行，都有数据依据和安全答案。</p>
      <a href="#top">返回顶部 <ArrowUp :size="15" /></a>
    </footer>

    <dialog ref="customDialog" class="custom-dialog" @click="closeCustomOnBackdrop">
      <div class="custom-dialog-inner">
        <header>
          <div>
            <small>自由组合旅行条件</small>
            <h2>定制我的全国行程</h2>
          </div>
          <button type="button" aria-label="关闭自由定制" @click="closeCustomPlanner">
            <X :size="19" />
          </button>
        </header>

        <section class="intent-editor">
          <div class="intent-editor-heading">
            <div>
              <strong><Sparkles :size="16" /> 一句话描述行程</strong>
              <small>输入后自动识别，并回填下方日期、同行人、偏好、天气与景区</small>
            </div>
            <button type="button" @click="parseQueryIntoPlanner({ activate: true })">识别并回填</button>
          </div>
          <textarea
            v-model="query"
            rows="2"
            autocomplete="off"
            placeholder="例如：7月28日从成都出发去阿坝，带父母和孩子玩3天，少走路，担心下雨，想去九寨沟"
            @input="queueIntentParsing"
            @blur="handleQueryBlur"
          ></textarea>
          <p v-if="intentRecognitionText" aria-live="polite">
            已识别：{{ intentRecognitionText }}
          </p>
        </section>

        <div class="custom-layout">
          <section class="custom-conditions">
            <div class="custom-row two-columns">
              <label>
                <span>旅行区域</span>
                <input
                  v-model.trim="customOptions.destinationRegion"
                  list="custom-region-list"
                  autocomplete="off"
                  placeholder="省、市或景区片区"
                />
                <datalist id="custom-region-list">
                  <option v-for="region in travelRegions" :key="region.name" :value="region.name"></option>
                </datalist>
              </label>

              <label>
                <span>从哪里出发</span>
                <input
                  v-model.trim="customOptions.origin"
                  list="origin-city-list"
                  autocomplete="off"
                  placeholder="可输入任意城市或区县"
                />
                <datalist id="origin-city-list">
                  <option v-for="city in originCities" :key="city" :value="city"></option>
                </datalist>
              </label>

              <label>
                <span>出发日期</span>
                <input v-model="customOptions.startDate" type="date" :min="todayIso" />
              </label>

              <div class="day-stepper">
                <span>旅行天数</span>
                <div>
                  <button type="button" aria-label="减少一天" @click="changeDays(-1)"><Minus :size="15" /></button>
                  <strong>{{ customOptions.days }} 天</strong>
                  <button type="button" aria-label="增加一天" @click="changeDays(1)"><Plus :size="15" /></button>
                </div>
              </div>
            </div>

            <fieldset>
              <legend>同行人群</legend>
              <div class="choice-grid travelers">
                <button
                  v-for="option in travelerOptions"
                  :key="option.value"
                  type="button"
                  :class="{ active: customOptions.travelerType === option.value }"
                  @click="customOptions.travelerType = option.value"
                >
                  <component :is="option.icon" :size="16" />
                  {{ option.label }}
                </button>
              </div>
            </fieldset>

            <label class="custom-text-field">
              <span>人数与同行补充 <small>选填</small></span>
              <input
                v-model.trim="customOptions.travelerNote"
                autocomplete="off"
                placeholder="例如：2 位老人、1 名儿童，或 18 人研学团"
              />
            </label>

            <fieldset>
              <legend>旅行偏好 <small>可多选</small></legend>
              <div class="choice-grid preferences">
                <button
                  v-for="option in preferenceOptions"
                  :key="option.value"
                  type="button"
                  :class="{ active: customOptions.preferences.includes(option.value) }"
                  @click="togglePreference(option.value)"
                >
                  <Check v-if="customOptions.preferences.includes(option.value)" :size="14" />
                  {{ option.label }}
                </button>
              </div>
            </fieldset>

            <div class="intensity-control">
              <div>
                <span>路线强度</span>
                <strong>{{ customIntensityLabel }}</strong>
              </div>
              <input v-model.number="customOptions.intensity" type="range" min="20" max="90" step="5" />
              <div class="range-labels"><span>轻松</span><span>适中</span><span>探索</span></div>
            </div>

            <label class="weather-select">
              <span>天气策略</span>
              <select v-model="customOptions.weather">
                <option value="auto">自动读取实时天气</option>
                <option value="rain">重点规避降雨湿滑</option>
                <option value="fog">重点规避大雾低能见度</option>
                <option value="heat">重点规避高温暴晒</option>
              </select>
            </label>

            <label class="custom-text-field custom-notes">
              <span>其他要求 <small>选填</small></span>
              <textarea
                v-model.trim="customOptions.notes"
                rows="3"
                placeholder="例如：必须有无障碍通道、午后安排室内、酒店不超过每晚 500 元"
              ></textarea>
            </label>
          </section>

          <section class="destination-picker">
            <div class="picker-heading">
              <div>
                <span>想去的地方</span>
                <small>已选 {{ customOptions.stopIds.length }} 个，可自由搜索，也可不选让 AI 推荐</small>
              </div>
              <button type="button" :disabled="!customOptions.stopIds.length" @click="clearDestinations">清空</button>
            </div>

            <div v-if="selectedCustomStops.length" class="selected-destinations" aria-label="已选目的地">
              <button
                v-for="stop in selectedCustomStops"
                :key="stop.id"
                type="button"
                :aria-label="`移除 ${stop.name}`"
                @click="toggleDestination(stop)"
              >
                <span>
                  <small>{{ stop.city }}</small>
                  <strong>{{ stop.name }}</strong>
                </span>
                <X :size="13" />
              </button>
            </div>

            <label class="destination-search">
              <span class="sr-only">搜索{{ customOptions.destinationRegion || selectedRegion }}景区</span>
              <Search :size="17" />
              <input
                v-model="scenicSearchQuery"
                autocomplete="off"
                :placeholder="`搜索${customOptions.destinationRegion || selectedRegion}景区，如“九寨沟”“黄山”`"
                @input="queueScenicSearch"
                @keydown.enter.prevent="runScenicSearch"
              />
              <button
                v-if="scenicSearchQuery"
                type="button"
                aria-label="清除景区搜索"
                @click="clearScenicSearch"
              >
                <X :size="14" />
              </button>
            </label>

            <div v-if="scenicSearchState !== 'idle'" class="search-result-block" aria-live="polite">
              <div class="picker-section-title">
                <span>搜索结果</span>
                <small v-if="scenicSearchState === 'success'">找到 {{ scenicSearchTotal }} 个，当前显示 {{ scenicSearchResults.length }} 个</small>
              </div>

              <div v-if="scenicSearchState === 'loading'" class="search-feedback">
                <LoaderCircle :size="18" />
                正在查询{{ customOptions.destinationRegion || selectedRegion }}景区候选池
              </div>
              <div v-else-if="scenicSearchState === 'empty'" class="search-feedback">
                没有找到匹配景区，换一个名称、城市或区县试试
              </div>
              <div v-else-if="scenicSearchState === 'error'" class="search-feedback search-error">
                <span>景区库暂时无法访问</span>
                <button type="button" @click="runScenicSearch">重新查询</button>
              </div>

              <div v-else-if="scenicSearchState === 'success'" class="picker-list search-results">
                <button
                  v-for="stop in scenicSearchResults"
                  :key="stop.id"
                  type="button"
                  :class="{ active: customOptions.stopIds.includes(stop.id) }"
                  @click="toggleDestination(stop)"
                >
                  <span class="picker-image">
                    <img
                      v-if="hasStopImage(stop)"
                      :src="imageUrlForStop(stop)"
                      :alt="stop.name"
                      referrerpolicy="no-referrer"
                      @error="markImageFailed(stop)"
                    />
                    <span v-else><MapPin :size="16" /><small>暂无实景图</small></span>
                  </span>
                  <span>
                    <small>{{ stop.city }}{{ stop.district ? ` · ${stop.district}` : '' }}</small>
                    <strong>{{ stop.name }}</strong>
                    <em>{{ stop.rating ? `高德评分 ${stop.rating}` : stop.category }}</em>
                  </span>
                  <i><Check :size="14" /></i>
                </button>
              </div>
            </div>

            <div class="picker-section-title recommended-title">
              <span>{{ customOptions.destinationRegion || selectedRegion }}热门景区 · {{ popularStops.length }}</span>
              <small>{{ selectedRegion === '贵州' ? '贵州本地样板库' : '高德实时检索结果' }}，仍可搜索更多目的地</small>
            </div>

            <div class="picker-list popular-picker-list">
              <button
                v-for="stop in popularStops"
                :key="stop.id"
                type="button"
                :class="{ active: customOptions.stopIds.includes(stop.id) }"
                @click="toggleDestination(stop)"
              >
                <span class="picker-image">
                  <img
                    v-if="hasStopImage(stop)"
                    :src="imageUrlForStop(stop)"
                    :alt="stop.name"
                    referrerpolicy="no-referrer"
                    @error="markImageFailed(stop)"
                  />
                  <span v-else><MapPin :size="16" /><small>暂无实景图</small></span>
                </span>
                <span>
                  <small>{{ stop.city }}</small>
                  <strong>{{ stop.name }}</strong>
                  <em>{{ stop.category }}</em>
                </span>
                <i><Check :size="14" /></i>
              </button>
            </div>

            <p class="picker-source">
              贵州使用 2,017 条本地 POI 样板；其他地区按所选区域实时检索。高德可检索点位不等同于文旅主管部门 A 级景区完整名录。
            </p>
          </section>
        </div>

        <footer>
          <p>{{ customSummary }}</p>
          <div>
            <button type="button" class="cancel-button" @click="closeCustomPlanner">取消</button>
            <button type="button" class="apply-button" @click="applyCustomPlanner">
              应用设置
              <ArrowRight :size="16" />
            </button>
          </div>
        </footer>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Baby,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  CloudSun,
  Database,
  GraduationCap,
  HeartHandshake,
  LoaderCircle,
  MapPin,
  Minus,
  Mountain,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
  X,
} from '@lucide/vue';
import fanjingshanImage from './assets/scenic/fanjingshan.webp';
import huangguoshuImage from './assets/scenic/huangguoshu.webp';
import liboImage from './assets/scenic/libo.webp';
import qingyanImage from './assets/scenic/qingyan.webp';
import wanfenglinImage from './assets/scenic/wanfenglin.webp';
import xijiangImage from './assets/scenic/xijiang.webp';
import zhijinImage from './assets/scenic/zhijin.webp';
import staticMapFallback from './assets/guizhou-static-map-fallback.png';
import { parseTravelIntent } from './intentParser.js';
import { readRouteSession, subscribeRouteSession, writeRouteSession } from './routeSession.js';

const apiBase = import.meta.env.VITE_API_BASE_URL || '';
const mapUrl = `${apiBase}/api/tourism/static-map`;
const mapSrc = ref('');
let mapObjectUrl = '';
const heroIndex = ref(0);
const activeScene = ref('family');
const activeDay = ref(1);
const query = ref('带父母和孩子去贵州玩两天，不想太累，担心下雨路滑');
const planning = ref(false);
const routeGenerated = ref(false);
const routePlan = ref(null);
const selectedRouteMode = ref('safety-first');
const selectedRiskEvidence = ref(null);
const scenarioPlanning = ref(false);
const weatherScenario = ref(null);
const generatedStops = ref([]);
const planningError = ref('');
const failedImageIds = ref(new Set());
const imageRetryCounts = ref(new Map());
const selectedStopId = ref('qingyan');
const customDialog = ref(null);
const placeSwitcher = ref(null);
const weatherData = ref({ status: 'loading', live: [], forecasts: [] });
const crowdData = ref({ status: 'loading', dataType: 'model-estimate', sites: [] });
const dynamicStops = ref([]);
const regionalPopularStops = ref([]);
const regionalPopularState = ref('idle');
const scenicSearchQuery = ref('');
const scenicSearchResults = ref([]);
const scenicSearchTotal = ref(0);
const scenicSearchState = ref('idle');
const selectedOrigin = ref('贵阳');
const selectedRegion = ref('贵州');
const originPicker = ref(null);
const originMenuOpen = ref(false);
const intentParseState = ref('idle');
const recognizedIntent = ref([]);
const queryWasEditedByUser = ref(false);
const todayIso = new Date().toISOString().slice(0, 10);
const customOptions = ref({
  destinationRegion: '贵州',
  origin: '贵阳',
  startDate: todayIso,
  days: 3,
  travelerType: 'family',
  travelerNote: '',
  preferences: ['safe', 'nature'],
  intensity: 45,
  weather: 'auto',
  notes: '',
  stopIds: ['qingyan', 'huangguoshu', 'xiaoqikong'],
});
let heroTimer;
let scenicSearchTimer;
let scenicSearchController;
let intentParseTimer;
let regionalPopularTimer;
let mapRequestController;
let riskEvidenceController;
let unsubscribeRouteSession;

const heroSlides = [
  {
    name: '梵净山',
    city: '铜仁',
    image: fanjingshanImage,
    style: {
      objectPosition: 'center 42%',
      '--film-from-x': '-1.1%',
      '--film-from-y': '-0.6%',
      '--film-to-x': '1%',
      '--film-to-y': '0.3%',
    },
  },
  {
    name: '黄果树',
    city: '安顺',
    image: huangguoshuImage,
    style: {
      objectPosition: 'center 48%',
      '--film-from-x': '1%',
      '--film-from-y': '-0.4%',
      '--film-to-x': '-0.8%',
      '--film-to-y': '0.5%',
    },
  },
  {
    name: '荔波小七孔',
    city: '黔南',
    image: liboImage,
    style: {
      objectPosition: 'center 52%',
      '--film-from-x': '-0.7%',
      '--film-from-y': '0.4%',
      '--film-to-x': '0.9%',
      '--film-to-y': '-0.3%',
    },
  },
  {
    name: '西江千户苗寨',
    city: '黔东南',
    image: xijiangImage,
    style: {
      objectPosition: 'center 44%',
      '--film-from-x': '0.8%',
      '--film-from-y': '0.3%',
      '--film-to-x': '-0.8%',
      '--film-to-y': '-0.4%',
    },
  },
  {
    name: '万峰林',
    city: '黔西南',
    image: wanfenglinImage,
    style: {
      objectPosition: 'center 54%',
      '--film-from-x': '-0.8%',
      '--film-from-y': '-0.2%',
      '--film-to-x': '0.9%',
      '--film-to-y': '0.4%',
    },
  },
  {
    name: '织金洞',
    city: '毕节',
    image: zhijinImage,
    style: {
      objectPosition: 'center 48%',
      '--film-from-x': '0.8%',
      '--film-from-y': '0.5%',
      '--film-to-x': '-0.6%',
      '--film-to-y': '-0.4%',
    },
  },
];

const rawStops = [
  {
    id: 'qingyan',
    name: '青岩古镇',
    city: '贵阳',
    adcode: '520100',
    category: '古镇人文',
    lng: 106.686834,
    lat: 26.331095,
    image: qingyanImage,
    time: '09:30',
    baseRisk: 42,
    description: '从北门慢游石巷与城门，减少连续台阶。',
    advice: '雨天石板路湿滑，老人和儿童建议从北门进入，减少城墙台阶路线。',
  },
  {
    id: 'huangguoshu',
    name: '黄果树旅游景区',
    city: '安顺',
    adcode: '520400',
    category: '瀑布峡谷',
    lng: 105.668716,
    lat: 25.988506,
    image: huangguoshuImage,
    time: '14:00',
    baseRisk: 61,
    description: '优先核心瀑布游线，避开正午集中客流。',
    advice: '丰水期步道湿滑，建议穿防滑鞋，并避开 11:00 至 14:00 集中到访时段。',
  },
  {
    id: 'zhijin',
    name: '织金洞景区',
    city: '毕节',
    adcode: '520500',
    category: '地质研学',
    lng: 105.883673,
    lat: 26.772214,
    image: zhijinImage,
    time: '10:00',
    baseRisk: 64,
    description: '洞穴地质研学，控制连续台阶行进节奏。',
    advice: '洞内湿度高且连续台阶较多，老人儿童应控制行进速度并做好保暖防滑。',
  },
  {
    id: 'wanfenglin',
    name: '万峰林景区',
    city: '黔西南',
    adcode: '522300',
    category: '康养慢游',
    lng: 104.924648,
    lat: 25.00961,
    image: wanfenglinImage,
    time: '09:00',
    baseRisk: 39,
    description: '田园与峰林慢游，上午进入避开午后日照。',
    advice: '午后日照与村道车流叠加，建议上午游览，骑行时避开车辆集中时段。',
  },
  {
    id: 'xiaoqikong',
    name: '小七孔景区',
    city: '黔南',
    adcode: '522700',
    category: '山水森林',
    lng: 107.705723,
    lat: 25.252959,
    image: liboImage,
    time: '10:30',
    baseRisk: 46,
    description: '从西门进入，优先服务点覆盖完整的亲水游线。',
    advice: '降雨后亲水路段水位变化快，优先选择服务点覆盖更完整的西门游线。',
  },
  {
    id: 'xijiang',
    name: '西江千户苗寨',
    city: '黔东南',
    adcode: '522600',
    category: '民族文化',
    lng: 108.173116,
    lat: 26.494562,
    image: xijiangImage,
    time: '16:30',
    baseRisk: 58,
    description: '下午进入村寨，避开夜间接驳集中时段。',
    advice: '夜间返程与接驳客流集中，建议提前确认集合点和末班接驳时间。',
  },
  {
    id: 'fanjingshan',
    name: '梵净山风景区',
    city: '铜仁',
    adcode: '520600',
    category: '山地自然',
    lng: 108.720359,
    lat: 27.882738,
    image: fanjingshanImage,
    time: '08:00',
    baseRisk: 67,
    description: '早间登山，优先核验能见度与索道状态。',
    advice: '高海拔天气变化快，建议提前核验索道与能见度；雨雾时下调路线强度。',
  },
  {
    id: 'chishui-danxia',
    sourceId: 'B03540M3AW',
    name: '赤水丹霞旅游区大瀑布',
    city: '遵义',
    adcode: '520300',
    category: '丹霞瀑布',
    lng: 105.748437,
    lat: 28.379778,
    image: `${apiBase}/api/scenic-photo?id=B03540M3AW`,
    time: '待安排',
    baseRisk: 58,
    description: '丹霞峡谷与瀑布游线，关注雨后步道和水位变化。',
    advice: '降雨后优先核验景区开放状态，穿防滑鞋并避开临水湿滑区域。',
  },
  {
    id: 'zunyi-conference',
    sourceId: 'B0FFH1ULF2',
    name: '遵义会议会址纪念馆',
    city: '遵义',
    adcode: '520300',
    category: '红色文化',
    lng: 106.920722,
    lat: 27.688411,
    image: `${apiBase}/api/scenic-photo?id=B0FFH1ULF2`,
    time: '待安排',
    baseRisk: 35,
    description: '城市红色文化研学点，适合团队预约与分批参观。',
    advice: '团队出行提前预约时段，设置集合点并避开入口集中客流。',
  },
  {
    id: 'zhenyuan',
    sourceId: 'B03570161S',
    name: '镇远古城',
    city: '黔东南',
    adcode: '522600',
    category: '古城人文',
    lng: 108.421039,
    lat: 27.047373,
    image: `${apiBase}/api/scenic-photo?id=B03570161S`,
    time: '待安排',
    baseRisk: 44,
    description: '沿舞阳河慢游古城街巷，兼顾夜景与步行强度。',
    advice: '雨天临河石板路易滑，夜游需提前确认停车和返程接驳。',
  },
  {
    id: 'zhaoxing',
    sourceId: 'B0FFF73RYK',
    name: '肇兴侗寨',
    city: '黔东南',
    adcode: '522600',
    category: '侗寨文化',
    lng: 109.170752,
    lat: 25.90652,
    image: `${apiBase}/api/scenic-photo?id=B0FFF73RYK`,
    time: '待安排',
    baseRisk: 45,
    description: '鼓楼群与侗族村寨体验，适合文化研学和慢游。',
    advice: '节庆时段提前确认接驳与集合点，夜间注意木构街巷通行。',
  },
  {
    id: 'baili-dujuan',
    sourceId: 'B03590P0RY',
    name: '中国百里杜鹃风景名胜区',
    city: '毕节',
    adcode: '520500',
    category: '高原花海',
    lng: 105.915622,
    lat: 27.215562,
    image: `${apiBase}/api/scenic-photo?id=B03590P0RY`,
    time: '待安排',
    baseRisk: 53,
    description: '高原花海季节性明显，花期需重点研判承载和交通。',
    advice: '花期客流集中，优先预约入园并预留换乘和排队时间。',
  },
  {
    id: 'longgong',
    sourceId: 'B03550I7MA',
    name: '龙宫风景区',
    city: '安顺',
    adcode: '520400',
    category: '喀斯特溶洞',
    lng: 105.885762,
    lat: 26.106874,
    image: `${apiBase}/api/scenic-photo?id=B03550I7MA`,
    time: '待安排',
    baseRisk: 57,
    description: '水溶洞与喀斯特景观，重点关注水位和洞内温差。',
    advice: '提前核验游船与洞内开放情况，准备薄外套和防滑鞋。',
  },
  {
    id: 'malinghe',
    sourceId: 'B0FFL5AXI8',
    name: '马岭河峡谷湿地公园',
    city: '黔西南',
    adcode: '522300',
    category: '峡谷湿地',
    lng: 104.948595,
    lat: 25.131516,
    image: `${apiBase}/api/scenic-photo?id=B0FFL5AXI8`,
    time: '待安排',
    baseRisk: 61,
    description: '峡谷瀑布与湿地步道，雨季景观和通行风险同步上升。',
    advice: '强降雨时避开峡谷低洼路段，优先使用开放且有服务覆盖的游线。',
  },
  {
    id: 'wumeng',
    sourceId: 'B0FFFRLENN',
    name: '乌蒙大草原',
    city: '六盘水',
    adcode: '520200',
    category: '高原草场',
    lng: 104.616821,
    lat: 26.155275,
    image: `${apiBase}/api/scenic-photo?id=B0FFFRLENN`,
    time: '待安排',
    baseRisk: 62,
    description: '高海拔草原与自驾景观，天气变化和能见度影响明显。',
    advice: '出发前核验大风、雷雨和能见度，避免在临崖区域长时间停留。',
  },
  {
    id: 'jiabang',
    sourceId: 'B03570NNZ3',
    name: '加榜梯田',
    city: '黔东南',
    adcode: '522600',
    category: '梯田村落',
    lng: 108.586886,
    lat: 25.602516,
    image: `${apiBase}/api/scenic-photo?id=B03570NNZ3`,
    time: '待安排',
    baseRisk: 55,
    description: '梯田与村落摄影路线，山路距离和天气是主要约束。',
    advice: '预留盘山道路通行时间，雨雾天气减少夜间驾驶和临边拍摄。',
  },
  {
    id: 'sky-eye',
    sourceId: 'B0FFI9GIJR',
    name: '中国天眼景区',
    city: '黔南',
    adcode: '522700',
    category: '科技研学',
    lng: 106.897192,
    lat: 25.695673,
    image: `${apiBase}/api/scenic-photo?id=B0FFI9GIJR`,
    time: '待安排',
    baseRisk: 43,
    description: '射电天文科技研学，适合学校和亲子团队预约参观。',
    advice: '提前了解预约、安检和电子设备管理要求，团队设置统一集合时间。',
  },
  {
    id: 'xiasi',
    sourceId: 'B0FFH4O588',
    name: '下司古镇',
    city: '黔东南',
    adcode: '522600',
    category: '古镇人文',
    lng: 107.803033,
    lat: 26.515292,
    image: `${apiBase}/api/scenic-photo?id=B0FFH4O588`,
    time: '待安排',
    baseRisk: 41,
    description: '清水江畔古镇慢游，适合作为凯里周边低强度节点。',
    advice: '节假日避开核心街巷高峰，雨天注意临水步道和石板路。',
  },
  {
    id: 'yelanggu',
    sourceId: 'B0FFFX3R8P',
    name: '花溪夜郎谷',
    city: '贵阳',
    adcode: '520100',
    category: '艺术人文',
    lng: 106.646181,
    lat: 26.386902,
    image: `${apiBase}/api/scenic-photo?id=B0FFFX3R8P`,
    time: '待安排',
    baseRisk: 39,
    description: '石塑艺术与山谷空间，适合贵阳近郊半日文化体验。',
    advice: '错开午后集中客流，老人儿童在高差步道区域注意慢行。',
  },
  {
    id: 'jiucaiping',
    sourceId: 'B0FFHJ46PY',
    name: '阿西里西韭菜坪',
    city: '毕节',
    adcode: '520500',
    category: '高山花海',
    lng: 104.752465,
    lat: 26.984597,
    image: `${apiBase}/api/scenic-photo?id=B0FFHJ46PY`,
    time: '待安排',
    baseRisk: 64,
    description: '高海拔山地花海，风力、气温和能见度需要同步评估。',
    advice: '准备防风保暖衣物，雷雨和低能见度时及时降低游览强度。',
  },
];

function mercatorPoint(lng, lat) {
  const world = 256 * 2 ** 7;
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

const stops = rawStops.map(stop => ({ ...stop, position: projectToMap(stop.lng, stop.lat) }));
const cityAdcodes = [
  { name: '贵阳', adcode: '520100' },
  { name: '六盘水', adcode: '520200' },
  { name: '遵义', adcode: '520300' },
  { name: '安顺', adcode: '520400' },
  { name: '毕节', adcode: '520500' },
  { name: '铜仁', adcode: '520600' },
  { name: '黔西南', adcode: '522300' },
  { name: '黔东南', adcode: '522600' },
  { name: '黔南', adcode: '522700' },
];
const curatedRouteStopIds = {
  anshun_huangguoshu: 'huangguoshu',
  qny_libo: 'xiaoqikong',
  gy_qingyan: 'qingyan',
  qdn_xijiang: 'xijiang',
  tr_fanjing: 'fanjingshan',
  bj_zhijin: 'zhijin',
  qxn_wanfenglin: 'wanfenglin',
};
const dailyTimes = ['09:00', '11:30', '15:00', '17:30'];

function compactCity(city = '') {
  return String(city)
    .replace(/(?:藏族羌族|藏族|彝族|苗族侗族|布依族苗族|土家族苗族|蒙古族|朝鲜族|哈尼族彝族|傣族景颇族|白族|壮族|回族|维吾尔族|柯尔克孜族|蒙古族藏族|黎族苗族)自治州/g, '')
    .replace('布依族苗族自治州', '')
    .replace('苗族侗族自治州', '')
    .replace('市', '')
    .replace('州', '');
}

function normalizeSpotName(name = '') {
  return String(name).replace(/旅游景区|风景区|景区|风景名胜区|\s/g, '');
}

function poiCategory(spot) {
  const text = `${spot.name || ''}${spot.type || ''}`;
  if (/古镇|古城|苗寨|侗寨|村寨/.test(text)) return '人文村寨';
  if (/洞|溶洞/.test(text)) return '地质洞穴';
  if (/瀑布|湖|河|溪|湿地|水/.test(text)) return '山水亲水';
  if (/山|峰|岭|峡谷/.test(text)) return '山地自然';
  if (/公园|园|广场/.test(text)) return '城市休闲';
  return '自然风光';
}

function apiAssetUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${apiBase}${path}`;
}

function hasStopImage(stop) {
  return Boolean(stop?.image) && !failedImageIds.value.has(stop.id);
}

function imageUrlForStop(stop) {
  const source = stop?.image || '';
  const retry = imageRetryCounts.value.get(stop?.id) || 0;
  if (!source || retry === 0) return source;
  return `${source}${source.includes('?') ? '&' : '?'}image_retry=${retry}`;
}

function markImageFailed(stop) {
  const retries = imageRetryCounts.value.get(stop.id) || 0;
  if (retries < 2) {
    imageRetryCounts.value = new Map(imageRetryCounts.value).set(stop.id, retries + 1);
    return;
  }
  failedImageIds.value = new Set([...failedImageIds.value, stop.id]);
}

function normalizePoiStop(spot) {
  const existing = stops.find(item =>
    normalizeSpotName(item.name) === normalizeSpotName(spot.name)
  );
  if (existing) return existing;

  const lng = Number(spot.location?.lng);
  const lat = Number(spot.location?.lat);
  const city = compactCity(spot.city);
  const adcode = String(spot.adcode || cityAdcodes.find(item => city.includes(item.name) || item.name.includes(city))?.adcode || '');
  const heatSeed = Number(spot.holidayHeatSeed || 50);
  const category = poiCategory(spot);
  const categoryLift = /山地|亲水|洞穴/.test(category) ? 8 : 2;
  const hasPhoto = Array.isArray(spot.photos) && spot.photos.some(photo => photo?.url);

  return {
    id: `poi-${spot.id}`,
    sourceId: spot.id,
    name: spot.name,
    city,
    district: spot.district || '',
    adcode,
    category,
    lng,
    lat,
    position: projectToMap(lng, lat),
    image: hasPhoto ? `${apiBase}/api/scenic-photo?id=${encodeURIComponent(spot.id)}` : '',
    time: '待排序',
    rating: spot.rating || '',
    baseRisk: Math.min(72, Math.round(28 + heatSeed * 0.28 + categoryLift)),
    description: spot.rating
      ? `高德评分 ${spot.rating}，将结合天气、距离和通行条件排序。`
      : '已加入路线候选，将结合天气、距离和通行条件排序。',
    advice: '该点位来自真实 POI 库，生成路线后将结合天气、客流估算与山地通行条件给出安全建议。',
  };
}

function adcodeForCity(city = '') {
  const normalized = compactCity(city);
  return cityAdcodes.find(item =>
    normalized.includes(item.name) || item.name.includes(normalized)
  )?.adcode || '';
}

function normalizeRouteStop(site, schedule) {
  const lng = Number(site.lngLat?.[0]);
  const lat = Number(site.lngLat?.[1]);
  const curated = stops.find(stop => stop.id === curatedRouteStopIds[site.id]);
  const selectedPoi = dynamicStops.value.find(stop =>
    stop.sourceId && stop.sourceId === site.sourcePoiId
  );
  const tags = Array.isArray(site.tags) ? site.tags : [];
  const category = tags.slice(0, 2).join(' · ') || site.primaryRisk || '安全路线点位';

  return {
    id: site.id,
    sourceId: site.sourcePoiId || '',
    name: site.name,
    city: compactCity(site.city),
    district: site.county || '',
    adcode: site.adcode || adcodeForCity(site.city),
    category,
    lng,
    lat,
    position: projectToMap(lng, lat),
    image: curated?.image || selectedPoi?.image || apiAssetUrl(site.imagePath),
    time: schedule.arrivalTime || dailyTimes[schedule.stopIndex] || `${9 + schedule.stopIndex * 2}:00`,
    day: schedule.day,
    rating: site.poiRating || '',
    baseRisk: Number(site.riskScore || site.riskBase || 50),
    riskScore: Number(site.riskScore || 50),
    riskLevel: site.riskLevel || 'low',
    crowdScore: Number(site.crowdScore || 0),
    serviceCoverage: Number(site.serviceCoverage || 0),
    description: `${site.primaryRisk || '通行条件综合研判'} · 应急覆盖 ${Math.round(site.serviceCoverage || 0)}%`,
    advice: site.actions?.[0] || '出发前核验景区开放、天气和交通状态。',
    evidence: site.evidence || [],
    services: site.services || [],
    departureTime: schedule.departureTime || '',
    travelMinutes: Number(schedule.travelMinutes || 0),
    visitDurationMinutes: Number(schedule.visitDurationMinutes || site.visitDurationMinutes || 0),
    openingWindow: schedule.openingWindow || site.openingWindow || null,
    scheduleStatus: schedule.status || 'pending',
  };
}

const travelRegions = [
  { name: '贵州', landmark: '黄果树 · 梵净山 · 荔波' },
  { name: '阿坝', landmark: '九寨沟 · 黄龙 · 四姑娘山' },
  { name: '丽江', landmark: '玉龙雪山 · 泸沽湖 · 虎跳峡' },
  { name: '张家界', landmark: '武陵源 · 天门山' },
  { name: '桂林', landmark: '漓江 · 阳朔 · 龙脊梯田' },
  { name: '黄山', landmark: '黄山风景区 · 宏村' },
  { name: '泰安', landmark: '泰山 · 岱庙' },
  { name: '渭南', landmark: '华山 · 少华山' },
  { name: '延边', landmark: '长白山 · 图们江' },
  { name: '南平', landmark: '武夷山 · 九曲溪' },
  { name: '恩施', landmark: '恩施大峡谷 · 腾龙洞' },
  { name: '上饶', landmark: '三清山 · 婺源' },
  { name: '神农架', landmark: '神农顶 · 大九湖' },
  { name: '宜昌', landmark: '三峡 · 清江画廊' },
  { name: '呼伦贝尔', landmark: '草原 · 额尔古纳' },
  { name: '海南州', landmark: '青海湖 · 茶卡周边' },
  { name: '酒泉', landmark: '敦煌 · 鸣沙山' },
  { name: '林芝', landmark: '雅鲁藏布大峡谷 · 巴松措' },
  { name: '三亚', landmark: '海岸 · 热带雨林' },
  { name: '大理', landmark: '苍山 · 洱海 · 古城' },
];

const scenes = [
  {
    id: 'family',
    label: '贵州样板',
    title: '贵阳出发 · 山水轻行',
    days: 2,
    icon: markRaw(Baby),
    query: '带父母和孩子去贵州玩两天，不想太累，担心下雨路滑',
    stops: ['qingyan', 'huangguoshu', 'zhijin'],
    selectedSiteNames: ['青岩古镇', '黄果树旅游景区', '织金洞景区'],
    region: '贵州',
    origin: '贵阳',
    travelerType: 'family',
    preferences: ['safe', 'lowload'],
    intensity: 35,
    weather: 'rain',
  },
  {
    id: 'wellness',
    label: '丽江康养',
    title: '雪山古城 · 康养慢游',
    days: 3,
    icon: markRaw(HeartHandshake),
    query: '从昆明出发去丽江，陪父母康养慢游三天，少爬坡，优先空气、医疗和休息点',
    stops: [],
    selectedSiteNames: ['丽江古城', '玉龙雪山'],
    region: '丽江',
    origin: '昆明',
    travelerType: 'senior',
    preferences: ['lowload', 'safe'],
    intensity: 30,
    weather: 'auto',
  },
  {
    id: 'study',
    label: '地貌研学',
    title: '张家界地貌研学线',
    days: 3,
    icon: markRaw(GraduationCap),
    query: '从长沙出发去张家界，30人研学团队旅行三天，关注地貌、承载能力和集合安全',
    stops: [],
    selectedSiteNames: ['武陵源风景名胜区', '天门山国家森林公园'],
    region: '张家界',
    origin: '长沙',
    travelerType: 'study',
    preferences: ['culture', 'safe'],
    intensity: 50,
    weather: 'auto',
  },
  {
    id: 'mountain',
    label: '川西探索',
    title: '九寨黄龙 · 高原探索',
    days: 3,
    icon: markRaw(Mountain),
    query: '从成都出发去阿坝体验九寨沟和黄龙，接受中等强度，需要规避降雨和高原天气',
    stops: [],
    selectedSiteNames: ['九寨沟风景名胜区', '黄龙风景名胜区'],
    region: '阿坝',
    origin: '成都',
    travelerType: 'wellness',
    preferences: ['nature'],
    intensity: 75,
    weather: 'auto',
  },
];

const originCities = ['北京', '上海', '广州', '深圳', '成都', '重庆', '西安', '昆明', '长沙', '武汉', '杭州', '南京', '贵阳', '遵义', '六盘水', '安顺', '毕节', '铜仁', '凯里', '都匀', '兴义'];
const travelerOptions = [
  { value: 'family', label: '亲子家庭', icon: markRaw(Baby) },
  { value: 'senior', label: '老人同行', icon: markRaw(HeartHandshake) },
  { value: 'study', label: '研学团队', icon: markRaw(GraduationCap) },
  { value: 'wellness', label: '朋友结伴', icon: markRaw(Users) },
  { value: 'solo', label: '独自旅行', icon: markRaw(UserRound) },
];
const preferenceOptions = [
  { value: 'safe', label: '安全优先' },
  { value: 'lowload', label: '轻松少爬坡' },
  { value: 'nature', label: '山地自然' },
  { value: 'culture', label: '民族文化' },
];

const decisionFlow = [
  { title: '理解游客', copy: '识别人群、天数、强度和隐含担忧。' },
  { title: '融合数据', copy: '天气实况、景区 POI、承载与服务点。' },
  { title: '风险研判', copy: '评估山地天气、坡度、拥堵与可达性。' },
  { title: '生成行动', copy: '输出路线、预警、替代点和应急建议。' },
];
const routeModeOptions = [
  { id: 'safety-first', label: '安全优先' },
  { id: 'balanced', label: '均衡体验' },
  { id: 'experience-first', label: '探索优先' },
];

const customSuggestedStopIds = computed(() => {
  if ((customOptions.value.destinationRegion || selectedRegion.value) !== '贵州' && regionalPopularStops.value.length) {
    return regionalPopularStops.value
      .slice(0, Math.max(3, Math.min(8, customOptions.value.days + 2)))
      .map(stop => stop.id);
  }
  const preferences = customOptions.value.preferences;
  const suggested = preferences.includes('culture')
    ? ['qingyan', 'xijiang', 'zhijin', 'huangguoshu']
    : preferences.includes('nature')
      ? ['xiaoqikong', 'fanjingshan', 'wanfenglin', 'huangguoshu']
      : ['qingyan', 'huangguoshu', 'wanfenglin', 'xiaoqikong'];
  return suggested.slice(0, Math.max(2, Math.min(suggested.length, customOptions.value.days + 1)));
});
const allStops = computed(() => [...stops, ...regionalPopularStops.value, ...dynamicStops.value]
  .filter((stop, index, list) => list.findIndex(item => item.id === stop.id) === index));
const popularStops = computed(() => (customOptions.value.destinationRegion || selectedRegion.value) === '贵州'
  ? stops
  : regionalPopularStops.value);
const selectedCustomStops = computed(() => customOptions.value.stopIds
  .map(id => allStops.value.find(stop => stop.id === id))
  .filter(Boolean));
const customScene = computed(() => ({
  id: 'custom',
  title: `${customOptions.value.origin || '自定义地点'}出发 · ${customOptions.value.destinationRegion || selectedRegion.value}行程`,
  days: customOptions.value.days,
  stops: customOptions.value.stopIds.length ? customOptions.value.stopIds : customSuggestedStopIds.value,
  origin: customOptions.value.origin,
  region: customOptions.value.destinationRegion || selectedRegion.value,
  startDate: customOptions.value.startDate,
  travelerType: customOptions.value.travelerType,
  preferences: customOptions.value.preferences.length ? customOptions.value.preferences : ['safe'],
  intensity: customOptions.value.intensity,
  weather: customOptions.value.weather,
}));
const currentScene = computed(() => activeScene.value === 'custom'
  ? customScene.value
  : scenes.find(scene => scene.id === activeScene.value) || scenes[0]);
const baseSceneStops = computed(() => currentScene.value.stops
  .map(id => allStops.value.find(stop => stop.id === id))
  .filter(Boolean));
const currentStops = computed(() => routeGenerated.value && generatedStops.value.length
  ? generatedStops.value
  : baseSceneStops.value);
const currentItinerary = computed(() => {
  if (routeGenerated.value && routePlan.value?.itinerary?.length) {
    return routePlan.value.itinerary.map(day => ({
      day: day.day,
      date: day.date,
      theme: day.theme,
      sites: day.sites.filter(id => generatedStops.value.some(stop => stop.id === id)),
    }));
  }

  const days = Math.max(1, Number(currentScene.value.days || 1));
  const ids = baseSceneStops.value.map(stop => stop.id);
  const minimumPerDay = Math.floor(ids.length / days);
  const remainder = ids.length % days;
  let cursor = 0;
  return Array.from({ length: days }, (_, index) => {
    const count = minimumPerDay + (index < remainder ? 1 : 0);
    const daySites = ids.slice(cursor, cursor + count);
    cursor += count;
    return {
      day: index + 1,
      date: addIsoDays(currentScene.value.startDate || todayIso, index),
      theme: index === 0
        ? '抵达与轻量适应'
        : index === days - 1
          ? '核心游览与返程缓冲'
          : '跨区域串联与安全复核',
      sites: daySites,
    };
  });
});
const activeDayPlan = computed(() => currentItinerary.value.find(day => day.day === activeDay.value)
  || currentItinerary.value[0]);
const visibleStops = computed(() => {
  const siteIds = activeDayPlan.value?.sites || [];
  return siteIds
    .map(id => currentStops.value.find(stop => stop.id === id))
    .filter(Boolean);
});
const selectedStop = computed(() =>
  currentStops.value.find(stop => stop.id === selectedStopId.value)
  || visibleStops.value[0]
  || currentStops.value[0]
  || stops[0]
);
const displayRouteTitle = computed(() => routeGenerated.value && routePlan.value?.routeTitle
  ? routePlan.value.routeTitle
  : activeScene.value === 'custom'
    ? currentScene.value.title
    : `${selectedOrigin.value}出发 · ${currentScene.value.title.replace(/^.*?出发 · /, '')}`);
const activeDayCities = computed(() => [...new Set(visibleStops.value.map(stop => stop.city))]
  .filter(Boolean)
  .join(' → '));
const originWeatherAdcodes = {
  贵阳: '520100', 遵义: '520300', 六盘水: '520200', 安顺: '520400', 毕节: '520500',
  铜仁: '520600', 凯里: '522600', 都匀: '522700', 兴义: '522300',
};
const originWeather = computed(() => weatherData.value.live.find(item =>
  item.adcode === originWeatherAdcodes[selectedOrigin.value]
  || compactCity(item.city) === compactCity(selectedOrigin.value)
));
const scenicScopeText = computed(() => selectedRegion.value === '贵州'
  ? '2,017 个贵州样板 POI'
  : regionalPopularState.value === 'loading'
    ? `${selectedRegion.value}景区检索中`
    : `${selectedRegion.value}实时景区候选`);
const activeDayDate = computed(() => activeDayPlan.value?.date || todayIso);
const selectedWeather = computed(() => {
  if (activeDayDate.value === todayIso) {
    return weatherData.value.live.find(item => item.adcode === selectedStop.value.adcode) || null;
  }
  const forecast = weatherData.value.forecasts?.find(item => item.adcode === selectedStop.value.adcode);
  const day = forecast?.days?.find(item => item.date === activeDayDate.value);
  if (!day) return null;
  return {
    ...day,
    dataType: 'forecast',
    provider: forecast.provider,
    reportTime: forecast.reportTime,
  };
});
const selectedWeatherLabel = computed(() => selectedWeather.value?.dataType === 'realtime'
  ? '今日实况'
  : `${activeDayDate.value.slice(5).replace('-', '月')}日预报`);
const selectedWeatherText = computed(() => {
  if (!selectedWeather.value) return '暂无预报';
  if (selectedWeather.value.dataType === 'forecast') {
    return `${selectedWeather.value.dayWeather} ${selectedWeather.value.nightTemp}°~${selectedWeather.value.dayTemp}°`;
  }
  return `${selectedWeather.value.weather} ${selectedWeather.value.temperature}°`;
});
const selectedCrowd = computed(() => {
  const key = selectedStop.value.name.replace('旅游景区', '').replace('风景区', '').replace('景区', '');
  return crowdData.value.sites.find(item => item.name.includes(key))
    || (Number.isFinite(selectedStop.value.crowdScore)
      ? { crowdIndex: selectedStop.value.crowdScore, dataType: 'model-estimate' }
      : null);
});
const selectedNearbyServices = computed(() => (selectedRiskEvidence.value?.nearbyEmergency || []).slice(0, 3));
const currentOptimization = computed(() => routePlan.value?.optimization || null);
const agentTrace = computed(() => routePlan.value?.agentTrace || null);
const objectiveItems = computed(() => {
  const scores = currentOptimization.value?.objectiveScores || {};
  const weights = currentOptimization.value?.alternatives?.find(item => item.selected)?.weights || {};
  return [
    { key: 'safety', label: '安全', value: Math.round(scores.safety || 0), weight: weights.safety || 0 },
    { key: 'service', label: '服务', value: Math.round(scores.service || 0), weight: weights.service || 0 },
    { key: 'efficiency', label: '效率', value: Math.round(scores.efficiency || 0), weight: weights.efficiency || 0 },
    { key: 'experience', label: '体验', value: Math.round(scores.experience || 0), weight: weights.experience || 0 },
  ];
});
const scenicReel = computed(() => stops.filter(stop => ['fanjingshan', 'xiaoqikong', 'xijiang', 'wanfenglin'].includes(stop.id)));
const intensityLabel = computed(() => {
  const value = currentScene.value.intensity || 45;
  return value <= 35 ? '轻松路线' : value <= 60 ? '适中强度' : '探索强度';
});
const customIntensityLabel = computed(() => {
  const value = customOptions.value.intensity;
  return value <= 35 ? '轻松' : value <= 60 ? '适中' : '探索';
});
const customSummary = computed(() => {
  const traveler = travelerOptions.find(item => item.value === customOptions.value.travelerType)?.label || '游客';
  const places = customOptions.value.stopIds.length
    ? `指定 ${customOptions.value.stopIds.length} 个目的地`
    : '由 AI 自动推荐目的地';
  return `${customOptions.value.origin || '自定义地点'}出发 · ${customOptions.value.startDate} · ${customOptions.value.days}天 · ${traveler} · ${places}`;
});
const intentRecognitionText = computed(() => recognizedIntent.value
  .slice(0, 5)
  .map(item => item.value)
  .join(' · '));

function mercatorUnit(lng, lat) {
  const safeLat = Math.max(-85.0511, Math.min(85.0511, Number(lat)));
  const sine = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: (Number(lng) + 180) / 360,
    y: 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI),
  };
}

function mercatorUnitToLngLat(point) {
  const lng = point.x * 360 - 180;
  const latitudeRadians = Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y)));
  return [lng, (latitudeRadians * 180) / Math.PI];
}

const mapViewport = computed(() => {
  const points = visibleStops.value
    .filter(stop => Number.isFinite(stop.lng) && Number.isFinite(stop.lat))
    .map(stop => mercatorUnit(stop.lng, stop.lat));
  if (!points.length) return { zoom: 6, center: [106.7, 26.8], centerUnit: mercatorUnit(106.7, 26.8) };

  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(0.00001, maxX - minX);
  const spanY = Math.max(0.00001, maxY - minY);
  const fitX = Math.log2((1024 * 0.72) / (spanX * 256));
  const fitY = Math.log2((576 * 0.68) / (spanY * 256));
  const zoom = points.length === 1 ? 10 : Math.max(5, Math.min(13, Math.floor(Math.min(fitX, fitY))));
  const centerUnit = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return { zoom, center: mercatorUnitToLngLat(centerUnit), centerUnit };
});

const mapImageStyle = computed(() => ({
  inset: '0',
  width: '100%',
  height: '100%',
}));

function mapPositionFor(stop) {
  const point = mercatorUnit(stop.lng, stop.lat);
  const { zoom, centerUnit } = mapViewport.value;
  const world = 256 * 2 ** zoom;
  return {
    x: ((512 + (point.x - centerUnit.x) * world) / 1024) * 100,
    y: ((288 + (point.y - centerUnit.y) * world) / 576) * 100,
  };
}

const routePath = computed(() => {
  const points = visibleStops.value.map(stop => {
    const position = mapPositionFor(stop);
    return {
      x: (position.x / 100) * 1024,
      y: (position.y / 100) * 576,
    };
  });
  if (points.length < 2) return '';
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const distance = point.x - previous.x;
    return `${path} C ${previous.x + distance * 0.38} ${previous.y - 24}, ${previous.x + distance * 0.7} ${point.y + 24}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
});

watch(() => {
  const { center, zoom } = mapViewport.value;
  return `${activeDay.value}:${zoom}:${center.map(value => value.toFixed(5)).join(',')}`;
}, () => loadMap(), { flush: 'post' });

function riskFor(stop) {
  if (Number.isFinite(stop.riskScore)) {
    const score = Math.round(stop.riskScore);
    const level = stop.riskLevel || (score >= 72 ? 'high' : score >= 52 ? 'medium' : 'low');
    return {
      score,
      level,
      label: level === 'high' ? '较高风险' : level === 'medium' ? '中风险' : '低风险',
    };
  }

  const weather = weatherData.value.live.find(item => item.adcode === stop.adcode);
  const crowdKey = stop.name.replace('旅游景区', '').replace('风景区', '').replace('景区', '');
  const crowd = crowdData.value.sites.find(item => item.name.includes(crowdKey));
  const weatherLift = weather && /雨|雪|雾|雷/.test(weather.weather) ? 9 : 0;
  const crowdLift = crowd ? Math.max(0, (crowd.crowdIndex - 55) * 0.15) : 0;
  const score = Math.min(96, Math.round(stop.baseRisk + weatherLift + crowdLift));
  return {
    score,
    level: score >= 72 ? 'high' : score >= 52 ? 'medium' : 'low',
    label: score >= 72 ? '较高风险' : score >= 52 ? '中风险' : '低风险',
  };
}

function selectHero(index) {
  heroIndex.value = index;
  restartHeroTimer();
}

function restartHeroTimer() {
  window.clearInterval(heroTimer);
  heroTimer = window.setInterval(() => {
    heroIndex.value = (heroIndex.value + 1) % heroSlides.length;
  }, 7800);
}

function keepActiveHeroControlVisible() {
  const switcher = placeSwitcher.value;
  const activeButton = switcher?.children?.[heroIndex.value];
  if (!switcher || !activeButton || switcher.scrollWidth <= switcher.clientWidth) return;
  const targetLeft = activeButton.offsetLeft - (switcher.clientWidth - activeButton.offsetWidth) / 2;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  switcher.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: reducedMotion ? 'auto' : 'smooth',
  });
}

watch(heroIndex, () => {
  nextTick(keepActiveHeroControlVisible);
});

let syncingPlannerFromQuery = false;
watch(customOptions, () => {
  if (syncingPlannerFromQuery || activeScene.value !== 'custom') return;
  query.value = customQueryText();
  recognizedIntent.value = parseTravelIntent(query.value, {
    today: todayIso,
    originCities,
    regions: travelRegions.map(region => region.name),
    stops: allStops.value,
  }).recognized;
  intentParseState.value = 'parsed';
  queryWasEditedByUser.value = false;
}, { deep: true });

watch(() => customOptions.value.destinationRegion, region => {
  window.clearTimeout(regionalPopularTimer);
  const target = String(region || '').trim();
  if (!target) return;
  const preserveSelections = syncingPlannerFromQuery;
  regionalPopularTimer = window.setTimeout(() => {
    selectedRegion.value = target;
    if (!preserveSelections) customOptions.value.stopIds = [];
    clearScenicSearch();
    loadRegionalPopular(target);
  }, 420);
});

function applyScene(scene) {
  window.clearTimeout(intentParseTimer);
  window.clearTimeout(regionalPopularTimer);
  resetGeneratedRoute();
  activeScene.value = scene.id;
  selectedRouteMode.value = scene.preferences?.includes('nature')
    ? 'experience-first'
    : scene.preferences?.includes('culture')
      ? 'balanced'
      : 'safety-first';
  activeDay.value = 1;
  selectedRegion.value = scene.region || '贵州';
  selectedOrigin.value = scene.origin || '贵阳';
  customOptions.value.destinationRegion = selectedRegion.value;
  customOptions.value.origin = selectedOrigin.value;
  query.value = scene.query;
  recognizedIntent.value = [];
  intentParseState.value = 'idle';
  queryWasEditedByUser.value = false;
  selectedStopId.value = scene.stops[0] || selectedStopId.value;
  loadRegionalPopular(selectedRegion.value);
  nextTick(generateJourney);
}

function resetGeneratedRoute() {
  routeGenerated.value = false;
  routePlan.value = null;
  generatedStops.value = [];
  planningError.value = '';
  failedImageIds.value = new Set();
  imageRetryCounts.value = new Map();
  weatherScenario.value = null;
}

function openCustomPlanner() {
  if (activeScene.value !== 'custom') {
    customOptions.value.origin = selectedOrigin.value;
    customOptions.value.destinationRegion = selectedRegion.value;
  }
  if (queryWasEditedByUser.value) parseQueryIntoPlanner({ activate: false });
  customDialog.value?.showModal();
}

function closeCustomPlanner() {
  customDialog.value?.close();
}

function closeCustomOnBackdrop(event) {
  if (event.target === customDialog.value) closeCustomPlanner();
}

function changeDays(change) {
  customOptions.value.days = Math.max(1, Math.min(10, customOptions.value.days + change));
}

function changeOrigin() {
  resetGeneratedRoute();
  if (activeScene.value === 'custom') customOptions.value.origin = selectedOrigin.value;
  nextTick(generateJourney);
}

function changeRegion() {
  const region = selectedRegion.value.trim() || '贵州';
  selectedRegion.value = region;
  customOptions.value.destinationRegion = region;
  customOptions.value.stopIds = [];
  dynamicStops.value = [];
  clearScenicSearch();
  resetGeneratedRoute();
  activeScene.value = 'custom';
  if (region !== '贵州' && query.value.includes('贵州')) query.value = query.value.replaceAll('贵州', region);
  loadRegionalPopular(region);
  loadLiveData();
}

function selectOrigin(city) {
  originMenuOpen.value = false;
  if (selectedOrigin.value === city) return;
  selectedOrigin.value = city;
  changeOrigin();
}

function closeOriginMenu(event) {
  if (!originPicker.value?.contains(event.target)) originMenuOpen.value = false;
}

function togglePreference(value) {
  const current = customOptions.value.preferences;
  if (current.includes(value)) {
    customOptions.value.preferences = current.filter(item => item !== value);
    return;
  }
  customOptions.value.preferences = [...current, value];
}

function toggleDestination(stop) {
  const id = stop.id;
  const current = customOptions.value.stopIds;
  if (current.includes(id)) {
    customOptions.value.stopIds = current.filter(item => item !== id);
    return;
  }
  if (!stops.some(item => item.id === id) && !dynamicStops.value.some(item => item.id === id)) {
    dynamicStops.value = [...dynamicStops.value, stop];
  }
  customOptions.value.stopIds = [...current, id];
}

function clearDestinations() {
  customOptions.value.stopIds = [];
}

function queueIntentParsing() {
  window.clearTimeout(intentParseTimer);
  queryWasEditedByUser.value = true;
  intentParseState.value = 'typing';
  intentParseTimer = window.setTimeout(() => {
    parseQueryIntoPlanner({ activate: true, clearUnmatchedDestinations: true });
  }, 480);
}

function handleQueryBlur() {
  window.clearTimeout(intentParseTimer);
  if (queryWasEditedByUser.value) {
    parseQueryIntoPlanner({ activate: true, clearUnmatchedDestinations: true });
  }
}

function parseQueryIntoPlanner({ activate = true, clearUnmatchedDestinations = false } = {}) {
  const result = parseTravelIntent(query.value, {
    today: todayIso,
    originCities,
    regions: travelRegions.map(region => region.name),
    stops: allStops.value,
  });
  recognizedIntent.value = result.recognized;
  intentParseState.value = result.recognized.length ? 'parsed' : 'idle';

  if (!Object.keys(result.values).length) return result;

  syncingPlannerFromQuery = true;
  const values = result.values;
  if (values.origin) {
    customOptions.value.origin = values.origin;
    selectedOrigin.value = values.origin;
  }
  if (values.destinationRegion) {
    customOptions.value.destinationRegion = values.destinationRegion;
    selectedRegion.value = values.destinationRegion;
    loadRegionalPopular(values.destinationRegion);
  }
  if (values.startDate) customOptions.value.startDate = values.startDate;
  if (values.days) customOptions.value.days = values.days;
  if (values.travelerType) customOptions.value.travelerType = values.travelerType;
  if (values.travelerNote) customOptions.value.travelerNote = values.travelerNote;
  if (values.preferences?.length) customOptions.value.preferences = values.preferences;
  if (values.intensity) customOptions.value.intensity = values.intensity;
  if (values.weather) customOptions.value.weather = values.weather;
  if (values.notes) customOptions.value.notes = values.notes;
  if (Array.isArray(values.stopIds)) {
    customOptions.value.stopIds = values.stopIds;
  } else if (clearUnmatchedDestinations) {
    customOptions.value.stopIds = [];
  }

  if (activate) {
    resetGeneratedRoute();
    activeScene.value = 'custom';
    activeDay.value = 1;
    selectedStopId.value = customScene.value.stops[0] || 'qingyan';
  }
  nextTick(() => {
    syncingPlannerFromQuery = false;
  });
  return result;
}

function clearScenicSearch() {
  window.clearTimeout(scenicSearchTimer);
  scenicSearchController?.abort();
  mapRequestController?.abort();
  riskEvidenceController?.abort();
  scenicSearchQuery.value = '';
  scenicSearchResults.value = [];
  scenicSearchTotal.value = 0;
  scenicSearchState.value = 'idle';
}

async function loadRegionalPopular(region = selectedRegion.value) {
  const targetRegion = String(region || '贵州').trim() || '贵州';
  if (targetRegion === '贵州') {
    regionalPopularStops.value = [];
    regionalPopularState.value = 'local-sample';
    return;
  }
  regionalPopularState.value = 'loading';
  try {
    const response = await fetch(
      `${apiBase}/api/scenic-spots?scope=national&region=${encodeURIComponent(targetRegion)}&photo=required&limit=20`
    );
    if (!response.ok) throw new Error('regional_scenic_unavailable');
    const payload = await response.json();
    const normalized = (payload.spots || [])
      .filter(spot => Number.isFinite(Number(spot.location?.lng)) && Number.isFinite(Number(spot.location?.lat)))
      .map(normalizePoiStop)
      .filter((stop, index, list) => list.findIndex(item => item.id === stop.id) === index)
      .slice(0, 20);
    if (selectedRegion.value === targetRegion || customOptions.value.destinationRegion === targetRegion) {
      regionalPopularStops.value = normalized;
      regionalPopularState.value = normalized.length ? 'success' : 'empty';
    }
  } catch {
    if (selectedRegion.value === targetRegion || customOptions.value.destinationRegion === targetRegion) {
      regionalPopularStops.value = [];
      regionalPopularState.value = 'error';
    }
  }
}

function queueScenicSearch() {
  window.clearTimeout(scenicSearchTimer);
  scenicSearchController?.abort();
  if (!scenicSearchQuery.value.trim()) {
    clearScenicSearch();
    return;
  }
  scenicSearchState.value = 'loading';
  scenicSearchTimer = window.setTimeout(runScenicSearch, 320);
}

async function runScenicSearch() {
  const keyword = scenicSearchQuery.value.trim();
  if (!keyword) {
    clearScenicSearch();
    return;
  }

  scenicSearchController?.abort();
  scenicSearchController = new AbortController();
  scenicSearchState.value = 'loading';

  try {
    const response = await fetch(
      `${apiBase}/api/scenic-spots?${(customOptions.value.destinationRegion || selectedRegion.value) === '贵州' ? '' : 'scope=national&'}region=${encodeURIComponent(customOptions.value.destinationRegion || selectedRegion.value)}&keyword=${encodeURIComponent(keyword)}&photo=required&limit=12`,
      { signal: scenicSearchController.signal }
    );
    if (!response.ok) throw new Error('scenic_search_unavailable');
    const payload = await response.json();
    const normalized = (payload.spots || [])
      .filter(spot => Number.isFinite(Number(spot.location?.lng)) && Number.isFinite(Number(spot.location?.lat)))
      .map(normalizePoiStop)
      .filter((stop, index, list) => list.findIndex(item => item.id === stop.id) === index);
    scenicSearchResults.value = normalized;
    scenicSearchTotal.value = Number(payload.total || normalized.length);
    scenicSearchState.value = normalized.length ? 'success' : 'empty';
  } catch (error) {
    if (error?.name === 'AbortError') return;
    scenicSearchResults.value = [];
    scenicSearchTotal.value = 0;
    scenicSearchState.value = 'error';
  }
}

function customQueryText() {
  const traveler = travelerOptions.find(item => item.value === customOptions.value.travelerType)?.label || '游客';
  const preferences = preferenceOptions
    .filter(item => customOptions.value.preferences.includes(item.value))
    .map(item => item.label)
    .join('、') || '智能推荐';
  const destinations = selectedCustomStops.value.map(stop => stop.name);
  const destinationText = destinations.length ? `希望去${destinations.join('、')}` : '目的地由AI推荐';
  const weatherText = {
    auto: '结合实时天气动态调整',
    rain: '重点规避降雨湿滑',
    fog: '重点规避大雾低能见度',
    heat: '重点规避高温暴晒',
  }[customOptions.value.weather];
  const travelerNote = customOptions.value.travelerNote ? `，同行情况为${customOptions.value.travelerNote}` : '';
  const notes = customOptions.value.notes ? `，其他要求：${customOptions.value.notes}` : '';
  return `${customOptions.value.startDate}从${customOptions.value.origin || '自定义地点'}出发去${customOptions.value.destinationRegion || selectedRegion.value}，${traveler}旅行${customOptions.value.days}天${travelerNote}，偏好${preferences}，${destinationText}，路线强度${customIntensityLabel.value}，${weatherText}${notes}`;
}

function addIsoDays(dateText, offset) {
  const [year, month, day] = String(dateText || todayIso).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function applyCustomPlanner() {
  resetGeneratedRoute();
  activeScene.value = 'custom';
  activeDay.value = 1;
  selectedRegion.value = customOptions.value.destinationRegion || selectedRegion.value;
  selectedOrigin.value = customOptions.value.origin || '贵阳';
  query.value = customQueryText();
  recognizedIntent.value = parseTravelIntent(query.value, {
    today: todayIso,
    originCities,
    regions: travelRegions.map(region => region.name),
    stops: allStops.value,
  }).recognized;
  queryWasEditedByUser.value = false;
  selectedStopId.value = customScene.value.stops[0] || 'qingyan';
  closeCustomPlanner();
  nextTick(generateJourney);
}

async function loadSelectedRiskEvidence(siteId = selectedStopId.value) {
  if (!routePlan.value?.planId || !siteId) return;
  riskEvidenceController?.abort();
  riskEvidenceController = new AbortController();
  try {
    const response = await fetch(`${apiBase}/api/tourism/risk-explanation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: routePlan.value.planId, siteId }),
      signal: riskEvidenceController.signal,
    });
    if (!response.ok) throw new Error('risk_explanation_unavailable');
    const payload = await response.json();
    if (selectedStopId.value === siteId) selectedRiskEvidence.value = payload.explanation || null;
  } catch (error) {
    if (error?.name !== 'AbortError' && selectedStopId.value === siteId) selectedRiskEvidence.value = null;
  }
}

function selectStop(stop) {
  selectedStopId.value = stop.id;
  const day = currentItinerary.value.find(item => item.sites.includes(stop.id));
  if (day) activeDay.value = day.day;
  loadSelectedRiskEvidence(stop.id);
}

function selectDay(day) {
  activeDay.value = day;
  const dayPlan = currentItinerary.value.find(item => item.day === day);
  const stop = currentStops.value.find(item => item.id === dayPlan?.sites?.[0]);
  if (stop) {
    selectedStopId.value = stop.id;
    loadSelectedRiskEvidence(stop.id);
  }
}

function applyRoutePayload(payload) {
  const scheduleById = new Map();
  (payload.itinerary || []).forEach(day => {
    (day.sites || []).forEach((id, stopIndex) => {
      scheduleById.set(id, { day: day.day, stopIndex });
    });
  });
  (payload.executableSchedule?.days || []).forEach(day => {
    (day.entries || []).forEach(entry => {
      scheduleById.set(entry.siteId, { ...(scheduleById.get(entry.siteId) || {}), ...entry, day: day.day });
    });
  });
  generatedStops.value = (payload.sites || []).map((site, index) =>
    normalizeRouteStop(site, scheduleById.get(site.id) || {
      day: Math.floor(index / 3) + 1,
      stopIndex: index % 3,
    })
  );
  routePlan.value = payload;
  selectedRouteMode.value = payload.optimization?.selectedMode || payload.request?.routeMode || selectedRouteMode.value;
  if (payload.destinationRegion || payload.request?.destinationRegion) {
    selectedRegion.value = payload.destinationRegion || payload.request.destinationRegion;
  }
  routeGenerated.value = true;
  activeDay.value = payload.itinerary?.[0]?.day || 1;
  selectedStopId.value = payload.itinerary?.[0]?.sites?.[0] || generatedStops.value[0]?.id || selectedStopId.value;
  failedImageIds.value = new Set();
  imageRetryCounts.value = new Map();
  loadCrowdForStops(generatedStops.value);
  loadWeatherForStops(generatedStops.value);
  selectedRiskEvidence.value = null;
  loadSelectedRiskEvidence(selectedStopId.value);
}

function applyRouteMode(mode) {
  if (planning.value || selectedRouteMode.value === mode) return;
  selectedRouteMode.value = mode;
  generateJourney({ keepPosition: true });
}

function restoreSharedRoute(session = readRouteSession()) {
  if (!session) return false;
  const request = session.request || session.route.request || {};
  query.value = request.request || request.prompt || query.value;
  selectedOrigin.value = request.origin || session.route.origin?.name || selectedOrigin.value;
  selectedRegion.value = request.destinationRegion || session.route.destinationRegion || selectedRegion.value;
  applyRoutePayload(session.route);
  return true;
}

function journeyRequestPayload(overrides = {}) {
  const requestedSiteNames = activeScene.value === 'custom'
    ? baseSceneStops.value.map(stop => stop.name)
    : currentScene.value.selectedSiteNames || baseSceneStops.value.map(stop => stop.name);
  return {
    request: query.value,
    prompt: query.value,
    requirement: query.value,
    origin: selectedOrigin.value,
    destinationRegion: selectedRegion.value,
    days: currentScene.value.days,
    startDate: currentScene.value.startDate || todayIso,
    travelerType: currentScene.value.travelerType,
    preference: currentScene.value.preferences?.[0] || 'safe',
    routeMode: selectedRouteMode.value,
    intensity: currentScene.value.intensity || 45,
    weather: currentScene.value.weather,
    selectedSiteNames: requestedSiteNames,
    includeRoadRoute: true,
    ...overrides,
  };
}

async function generateJourney(options = {}) {
  if (planning.value) return;
  window.clearTimeout(intentParseTimer);
  if (queryWasEditedByUser.value) {
    parseQueryIntoPlanner({ activate: true, clearUnmatchedDestinations: true });
  }
  planning.value = true;
  planningError.value = '';
  try {
    const requestPayload = journeyRequestPayload();
    const response = await fetch(`${apiBase}/api/tourism/route-plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    if (!response.ok) throw new Error('route_unavailable');
    const payload = await response.json();
    applyRoutePayload(payload);
    writeRouteSession({ route: payload, request: requestPayload, source: 'visitor' });
  } catch {
    planningError.value = '路线服务暂时不可用，当前保留本地行程';
    routeGenerated.value = false;
  } finally {
    planning.value = false;
    if (!options.keepPosition) document.querySelector('#journey')?.scrollIntoView({ behavior: 'smooth' });
  }
}

async function runWeatherScenario(weather = 'rain') {
  if (scenarioPlanning.value || planning.value || !routePlan.value) return;
  scenarioPlanning.value = true;
  weatherScenario.value = null;
  try {
    const scenarioRequest = journeyRequestPayload({ weather, scenarioType: 'weather-simulation' });
    const response = await fetch(`${apiBase}/api/tourism/route-plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scenarioRequest),
    });
    if (!response.ok) throw new Error('scenario_route_unavailable');
    const alternative = await response.json();
    const currentNames = new Set((routePlan.value.sites || []).map(site => site.name));
    const alternativeNames = new Set((alternative.sites || []).map(site => site.name));
    const changedStops = [
      ...[...alternativeNames].filter(name => !currentNames.has(name)),
      ...[...currentNames].filter(name => !alternativeNames.has(name)),
    ];
    weatherScenario.value = {
      weather,
      route: alternative,
      request: scenarioRequest,
      routeChanged: (alternative.routeOrder || []).join('|') !== (routePlan.value.routeOrder || []).join('|'),
      averageRisk: alternative.metrics?.averageRisk ?? '--',
      riskDelta: Number(alternative.metrics?.averageRisk || 0) - Number(routePlan.value.metrics?.averageRisk || 0),
      changedStops: [...new Set(changedStops)],
    };
  } catch {
    weatherScenario.value = {
      weather,
      error: true,
      routeChanged: false,
      averageRisk: '--',
      riskDelta: 0,
      changedStops: [],
    };
  } finally {
    scenarioPlanning.value = false;
  }
}

function applyWeatherScenario() {
  if (!weatherScenario.value?.route || !weatherScenario.value?.request) return;
  applyRoutePayload(weatherScenario.value.route);
  writeRouteSession({
    route: weatherScenario.value.route,
    request: weatherScenario.value.request,
    source: 'weather-scenario',
  });
  weatherScenario.value = null;
}

async function loadCrowdForStops(targetStops) {
  const names = targetStops.map(stop => stop.name).filter(Boolean).join(',');
  if (!names) return;
  try {
    crowdData.value = await fetch(
      `${apiBase}/api/tourism/crowd-flow?names=${encodeURIComponent(names)}`
    ).then(response => response.json());
  } catch {
    // Route cards already include a transparent model estimate from route planning.
  }
}

async function loadWeatherForStops(targetStops = []) {
  const cities = [...new Set([
    selectedOrigin.value,
    selectedRegion.value,
    ...targetStops.map(stop => stop.city),
  ].map(value => String(value || '').trim()).filter(Boolean))].slice(0, 10);
  if (!cities.length) return;
  try {
    weatherData.value = await fetch(
      `${apiBase}/api/tourism/live-weather?cities=${encodeURIComponent(cities.join(','))}&forecastCities=${encodeURIComponent(cities.join(','))}`
    ).then(response => response.json());
  } catch {
    // Route generation remains usable when a third-party weather request is unavailable.
  }
}

function planFromSpot(spot) {
  selectedRegion.value = '贵州';
  customOptions.value.destinationRegion = '贵州';
  query.value = `从${selectedOrigin.value}出发去贵州，以${spot.name}为核心安排安全路线，同行有老人和孩子，控制旅行强度`;
  selectedStopId.value = spot.id;
  const matchingScene = scenes.find(scene => scene.stops.includes(spot.id));
  if (matchingScene) activeScene.value = matchingScene.id;
  document.querySelector('#top')?.scrollIntoView({ behavior: 'smooth' });
}

async function loadLiveData() {
  const names = popularStops.value.map(stop => stop.name).join(',');
  const [weatherResult, crowdResult] = await Promise.allSettled([
    fetch(`${apiBase}/api/tourism/live-weather?cities=${encodeURIComponent([selectedOrigin.value, selectedRegion.value].join(','))}&forecastCities=${encodeURIComponent(selectedRegion.value)}`).then(response => response.json()),
    fetch(`${apiBase}/api/tourism/crowd-flow?names=${encodeURIComponent(names)}`).then(response => response.json()),
  ]);
  if (weatherResult.status === 'fulfilled') weatherData.value = weatherResult.value;
  if (crowdResult.status === 'fulfilled') crowdData.value = crowdResult.value;
}

async function loadMap() {
  mapRequestController?.abort();
  mapRequestController = new AbortController();
  try {
    const { center, zoom } = mapViewport.value;
    const location = `${center[0].toFixed(6)},${center[1].toFixed(6)}`;
    const response = await fetch(`${mapUrl}?location=${encodeURIComponent(location)}&zoom=${zoom}`, {
      signal: mapRequestController.signal,
    });
    if (!response.ok) throw new Error('map_unavailable');
    if (mapObjectUrl) URL.revokeObjectURL(mapObjectUrl);
    mapObjectUrl = URL.createObjectURL(await response.blob());
    mapSrc.value = mapObjectUrl;
  } catch (error) {
    if (error?.name === 'AbortError') return;
    mapSrc.value = selectedRegion.value === '贵州' ? staticMapFallback : '';
  }
}

function handleMapImageError() {
  if (mapSrc.value === staticMapFallback) return;
  mapSrc.value = selectedRegion.value === '贵州' ? staticMapFallback : '';
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOriginMenu);
  restoreSharedRoute();
  unsubscribeRouteSession = subscribeRouteSession(session => {
    if (restoreSharedRoute(session)) planningError.value = '';
  });
  loadLiveData();
  loadRegionalPopular(selectedRegion.value);
  loadMap();
  restartHeroTimer();
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOriginMenu);
  window.clearInterval(heroTimer);
  window.clearTimeout(scenicSearchTimer);
  window.clearTimeout(intentParseTimer);
  scenicSearchController?.abort();
  unsubscribeRouteSession?.();
  if (mapObjectUrl) URL.revokeObjectURL(mapObjectUrl);
});
</script>

<style scoped>
.award-app {
  --ink: #102019;
  --paper: #f5f7f5;
  --surface: #ffffff;
  --leaf: #187653;
  --leaf-dark: #0d4d37;
  --mint: #79e0b5;
  --orange: #e77b45;
  --yellow: #d9b64f;
  --muted: #607068;
  --line: #d9e0dc;
  min-width: 320px;
  color: var(--ink);
  background: var(--paper);
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

* { box-sizing: border-box; }
button, input, textarea, select { font: inherit; }
button { color: inherit; }
a { color: inherit; text-decoration: none; }
img { display: block; }

.award-header {
  position: absolute;
  z-index: 20;
  top: 0;
  right: 5vw;
  left: 5vw;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 76px;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,.2);
}

.award-brand { display: inline-flex; align-items: center; gap: 11px; justify-self: start; }
.award-brand > span { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 5px; color: #0a3828; font-size: 17px; font-weight: 800; background: var(--mint); }
.award-brand > div { display: grid; gap: 1px; }
.award-brand strong { font-size: 14px; }
.award-brand small { color: rgba(255,255,255,.6); font-size: 8px; }
.award-header nav { display: flex; align-items: center; gap: 28px; }
.award-header nav a { color: rgba(255,255,255,.72); font-size: 11px; font-weight: 600; transition: color 300ms cubic-bezier(.22,1,.36,1); }
.award-header nav a:hover { color: #fff; }
.demo-link { display: inline-flex; align-items: center; gap: 7px; justify-self: end; height: 38px; padding: 0 13px; border: 1px solid rgba(255,255,255,.35); border-radius: 4px; color: #fff; font-size: 10px; font-weight: 700; transition: color 300ms cubic-bezier(.22,1,.36,1), background 300ms cubic-bezier(.22,1,.36,1); }
.demo-link:hover { color: var(--ink); background: #fff; }

.travel-hero { position: relative; min-height: 720px; height: 92dvh; max-height: 900px; overflow: hidden; color: #fff; background: #0a1711; }
.hero-images, .hero-images img, .hero-scrim { position: absolute; inset: 0; }
.hero-images { isolation: isolate; background: #0a1711; }
.hero-images img {
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  filter: saturate(.8) contrast(1.12) brightness(.8);
  transform: scale(1.075);
  transition: opacity 1350ms cubic-bezier(.22,1,.36,1), filter 1350ms cubic-bezier(.22,1,.36,1);
  will-change: opacity, transform;
}
.hero-images img.active {
  z-index: 1;
  opacity: 1;
  filter: saturate(.92) contrast(1.08) brightness(.88);
  animation: heroFilm 8200ms linear both;
}
.hero-scrim {
  z-index: 2;
  background:
    linear-gradient(90deg, rgba(4,14,9,.82) 0%, rgba(4,14,9,.48) 38%, rgba(4,14,9,.12) 71%, rgba(4,14,9,.24) 100%),
    linear-gradient(180deg, rgba(3,11,7,.42) 0%, transparent 38%, rgba(3,11,7,.14) 58%, rgba(3,11,7,.82) 100%);
  pointer-events: none;
}
.hero-copy { position: absolute; top: 26%; left: 7vw; z-index: 3; max-width: 590px; }
.hero-copy h1 { margin: 0; font-family: "Songti SC", SimSun, serif; font-size: clamp(54px, 6.2vw, 92px); font-weight: 700; line-height: 1; letter-spacing: 0; text-wrap: balance; text-shadow: 0 7px 28px rgba(0,0,0,.22); }
.hero-copy p { max-width: 31ch; margin: 22px 0 0; color: rgba(255,255,255,.82); font-size: clamp(15px, 1.25vw, 19px); line-height: 1.75; text-wrap: pretty; }

.place-switcher { position: absolute; z-index: 4; right: 5vw; bottom: 194px; display: flex; max-width: calc(100vw - 10vw); gap: 1px; }
.place-switcher button { position: relative; display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 9px; width: 124px; min-height: 60px; overflow: hidden; padding: 9px 10px 11px; border: 0; color: rgba(255,255,255,.62); text-align: left; background: rgba(6,20,13,.5); backdrop-filter: blur(8px) saturate(112%); cursor: pointer; transition: color 350ms cubic-bezier(.22,1,.36,1), background 350ms cubic-bezier(.22,1,.36,1); }
.place-switcher button:first-child { border-radius: 5px 0 0 5px; }
.place-switcher button:last-child { border-radius: 0 5px 5px 0; }
.place-switcher button:hover, .place-switcher button.active { color: #fff; background: rgba(7,42,28,.88); }
.place-index { color: var(--mint); font-family: Georgia, serif; font-size: 10px; }
.place-switcher button div { display: grid; gap: 2px; min-width: 0; }
.place-switcher strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.place-switcher small { color: rgba(255,255,255,.48); font-size: 8px; }
.place-progress { position: absolute; right: 0; bottom: 0; left: 0; height: 2px; overflow: hidden; background: rgba(255,255,255,.14); }
.place-progress::after { position: absolute; inset: 0; content: ""; background: var(--mint); transform: scaleX(0); transform-origin: left; }
.place-switcher button.active .place-progress::after { animation: placeProgress 7800ms linear both; }

.planner-shell { position: absolute; z-index: 5; right: 5vw; bottom: 32px; left: 5vw; padding: 14px 16px 12px; border-radius: 7px; color: var(--ink); background: rgba(255,255,255,.96); box-shadow: 0 8px 8px rgba(4,18,11,.11); }
.scenario-tabs { display: flex; align-items: center; gap: 4px; margin-bottom: 10px; }
.scenario-tabs button { display: inline-flex; align-items: center; gap: 6px; min-height: 31px; padding: 0 10px; border: 0; border-radius: 4px; color: #66746d; font-size: 9px; background: transparent; cursor: pointer; transition: color 250ms cubic-bezier(.22,1,.36,1), background 250ms cubic-bezier(.22,1,.36,1); }
.scenario-tabs button:hover, .scenario-tabs button.active { color: var(--leaf-dark); background: #e4f3ec; }
.planner-form { display: grid; grid-template-columns: 145px 150px minmax(0, 1fr) auto; gap: 10px; }
.planner-region-field { display: grid; align-content: center; gap: 3px; height: 54px; padding: 0 12px; border-radius: 5px; background: #eef2ef; }
.planner-region-field label { color: #617068; font-size: 8px; font-weight: 700; }
.planner-region-field input { min-width: 0; height: 25px; padding: 0; border: 0; outline: 0; color: var(--ink); font-size: 11px; font-weight: 750; background: transparent; }
.origin-field { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; height: 54px; padding: 0 12px; border-radius: 5px; background: #eef2ef; }
.origin-field > span { color: #617068; font-size: 9px; font-weight: 700; white-space: nowrap; }
.origin-field > button { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; height: 34px; padding: 0 3px 0 5px; border: 0; color: var(--ink); background: transparent; font-size: 11px; font-weight: 750; cursor: pointer; }
.origin-field > button svg { flex: none; color: #65746c; transition: transform 220ms cubic-bezier(.22,1,.36,1); }
.origin-field > button svg.open { transform: rotate(180deg); }
.origin-menu { position: absolute; z-index: 30; bottom: calc(100% + 8px); left: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 330px; max-height: 270px; overflow-y: auto; padding: 7px; border: 1px solid rgba(16,32,25,.12); border-radius: 7px; background: rgba(255,255,255,.98); box-shadow: 0 8px 8px rgba(8,25,16,.18); }
.origin-menu button { min-height: 36px; padding: 0 10px; border: 0; border-radius: 4px; color: #536159; background: transparent; font-size: 10px; cursor: pointer; transition: color 180ms ease, background 180ms ease; }
.origin-menu button:hover { color: var(--leaf-dark); background: #edf5f1; }
.origin-menu button.active { color: #fff; background: var(--leaf); font-weight: 750; }
.origin-menu-enter-active, .origin-menu-leave-active { transition: opacity 160ms ease, transform 180ms cubic-bezier(.22,1,.36,1); }
.origin-menu-enter-from, .origin-menu-leave-to { opacity: 0; transform: translateY(5px); }
.planner-field { display: grid; grid-template-columns: 160px 1fr; align-items: center; min-width: 0; height: 54px; padding: 0 15px; border-radius: 5px; background: #eef2ef; }
.planner-field label { font-size: 10px; font-weight: 750; }
.planner-field input { min-width: 0; height: 100%; border: 0; outline: 0; color: var(--ink); font-size: 12px; background: transparent; }
.planner-form > button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 150px; height: 54px; padding: 0 18px; border: 0; border-radius: 5px; color: #fff; font-size: 11px; font-weight: 750; background: var(--leaf); cursor: pointer; transition: background 300ms cubic-bezier(.22,1,.36,1), transform 300ms cubic-bezier(.22,1,.36,1); }
.planner-form > button:hover { background: var(--leaf-dark); transform: translateY(-1px); }
.planner-form > button:active { transform: scale(.98); }
.planner-form > button:disabled { cursor: wait; opacity: .74; }
.planner-status { display: flex; align-items: center; gap: 20px; margin-top: 10px; color: #69776f; font-size: 8px; }
.planner-status span { display: flex; align-items: center; gap: 6px; }
.planner-status svg { color: var(--leaf); }
.planner-status .intent-recognition { color: #3e5147; font-weight: 650; }
.planner-status .intent-recognition.recognized { color: var(--leaf-dark); }
.spin { animation: searchSpin 850ms linear infinite; }
.button-progress { width: 16px; height: 3px; overflow: hidden; border-radius: 2px; background: rgba(255,255,255,.28); }
.button-progress::after { display: block; width: 50%; height: 100%; border-radius: inherit; content: ""; background: #fff; animation: buttonLoad 800ms cubic-bezier(.22,1,.36,1) infinite alternate; }
.scroll-cue { position: absolute; z-index: 4; bottom: 47px; left: 22px; display: none; color: rgba(255,255,255,.75); font-size: 8px; }

.custom-dialog { width: auto; max-width: none; max-height: none; padding: 0; border: 0; color: var(--ink); background: transparent; }
.custom-dialog::backdrop { background: rgba(5,16,11,.72); backdrop-filter: blur(5px); }
.custom-dialog-inner { width: min(1120px, calc(100vw - 40px)); max-height: calc(100dvh - 40px); overflow: auto; border-radius: 8px; background: #fff; box-shadow: 0 8px 8px rgba(3,18,11,.18); }
.custom-dialog-inner > header { position: sticky; z-index: 2; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 82px; padding: 18px 24px; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.96); backdrop-filter: blur(10px); }
.custom-dialog-inner > header small { color: var(--leaf); font-size: 8px; }
.custom-dialog-inner > header h2 { margin: 3px 0 0; font-family: "Songti SC", SimSun, serif; font-size: 25px; letter-spacing: 0; }
.custom-dialog-inner > header > button { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: #eef2ef; cursor: pointer; transition: color 250ms cubic-bezier(.22,1,.36,1), background 250ms cubic-bezier(.22,1,.36,1); }
.custom-dialog-inner > header > button:hover { color: #fff; background: var(--ink); }
.intent-editor { padding: 18px 24px 16px; border-bottom: 1px solid var(--line); background: #f7faf8; }
.intent-editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 10px; }
.intent-editor-heading > div { display: grid; gap: 4px; }
.intent-editor-heading strong { display: flex; align-items: center; gap: 7px; font-size: 12px; }
.intent-editor-heading strong svg { color: var(--leaf); }
.intent-editor-heading small { color: #65746c; font-size: 9px; }
.intent-editor-heading button { flex: none; height: 34px; padding: 0 12px; border: 0; border-radius: 5px; color: #fff; background: var(--leaf); font-size: 9px; font-weight: 750; cursor: pointer; transition: background 200ms ease, transform 200ms cubic-bezier(.22,1,.36,1); }
.intent-editor-heading button:hover { background: var(--leaf-dark); transform: translateY(-1px); }
.intent-editor textarea { width: 100%; min-height: 62px; padding: 11px 12px; border: 1px solid #cbd7d1; border-radius: 5px; outline: 0; color: var(--ink); background: #fff; font-size: 11px; line-height: 1.6; resize: vertical; }
.intent-editor textarea:focus { border-color: var(--leaf); box-shadow: 0 0 0 3px rgba(24,118,83,.1); }
.intent-editor textarea::placeholder { color: #66766e; opacity: 1; }
.intent-editor > p { margin: 8px 0 0; color: var(--leaf-dark); font-size: 9px; font-weight: 650; }
.custom-layout { display: grid; grid-template-columns: .9fr 1.1fr; }
.custom-conditions { padding: 24px; border-right: 1px solid var(--line); }
.custom-row.two-columns { display: grid; grid-template-columns: 1fr 1fr 1fr 0.82fr; gap: 12px; }
.custom-conditions label, .day-stepper, .intensity-control, .custom-conditions fieldset { min-width: 0; margin: 0 0 21px; padding: 0; border: 0; }
.custom-conditions label > span, .day-stepper > span, .intensity-control span, .custom-conditions legend { display: block; margin-bottom: 8px; color: #56655d; font-size: 9px; font-weight: 700; }
.custom-conditions legend small { margin-left: 5px; color: #8a9690; font-size: 7px; font-weight: 400; }
.custom-conditions select, .custom-conditions input, .custom-conditions textarea { width: 100%; border: 1px solid #cfd8d3; border-radius: 5px; outline: none; color: var(--ink); font-size: 10px; background: #fff; }
.custom-conditions select, .custom-conditions input { height: 42px; padding: 0 11px; }
.custom-conditions textarea { min-height: 76px; padding: 10px 11px; resize: vertical; line-height: 1.55; }
.custom-conditions select:focus, .custom-conditions input:focus, .custom-conditions textarea:focus { border-color: var(--leaf); box-shadow: 0 0 0 3px rgba(24,118,83,.1); }
.custom-conditions input::placeholder, .custom-conditions textarea::placeholder { color: #77857e; opacity: 1; }
.day-stepper > div { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; height: 42px; overflow: hidden; border: 1px solid #cfd8d3; border-radius: 5px; }
.day-stepper button { display: grid; place-items: center; width: 40px; height: 100%; padding: 0; border: 0; background: #eef2ef; cursor: pointer; }
.day-stepper strong { text-align: center; font-size: 11px; }
.choice-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.choice-grid button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 0 11px; border: 1px solid #d6ded9; border-radius: 5px; color: #5e6d65; font-size: 9px; background: #fff; cursor: pointer; transition: color 250ms cubic-bezier(.22,1,.36,1), border-color 250ms cubic-bezier(.22,1,.36,1), background 250ms cubic-bezier(.22,1,.36,1); }
.choice-grid button:hover { border-color: #8ab9a4; }
.choice-grid button.active { border-color: var(--leaf); color: #fff; background: var(--leaf); }
.travelers button { flex: 1 1 calc(33.333% - 6px); }
.preferences button { flex: 1 1 calc(50% - 6px); }
.custom-text-field small { margin-left: 4px; color: #8a9690; font-size: 7px; font-weight: 400; }
.intensity-control > div:first-child { display: flex; align-items: center; justify-content: space-between; }
.intensity-control > div:first-child strong { color: var(--leaf); font-size: 10px; }
.intensity-control input { width: 100%; accent-color: var(--leaf); cursor: pointer; }
.range-labels { display: flex; justify-content: space-between; margin-top: 3px; color: #89958f; font-size: 7px; }
.weather-select { margin-bottom: 16px !important; }
.custom-notes { margin-bottom: 0 !important; }
.destination-picker { min-width: 0; padding: 24px; background: #f4f7f5; }
.picker-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 13px; }
.picker-heading > div { display: grid; gap: 3px; }
.picker-heading span { font-size: 11px; font-weight: 750; }
.picker-heading small { color: #748179; font-size: 8px; }
.picker-heading > button { padding: 0; border: 0; color: var(--leaf); font-size: 8px; background: transparent; cursor: pointer; }
.picker-heading > button:disabled { color: #99a39e; cursor: default; }
.selected-destinations { display: flex; gap: 6px; margin: 0 0 12px; padding-bottom: 2px; overflow-x: auto; }
.selected-destinations button { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 9px; min-height: 38px; padding: 5px 8px 5px 10px; border: 0; border-radius: 5px; color: #edf8f2; text-align: left; background: var(--leaf-dark); cursor: pointer; }
.selected-destinations button span { display: grid; gap: 1px; }
.selected-destinations button small { color: rgba(237,248,242,.62); font-size: 7px; }
.selected-destinations button strong { max-width: 126px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.destination-search { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 9px; height: 44px; margin-bottom: 17px; padding: 0 11px; border: 1px solid #cbd6d0; border-radius: 5px; color: #5e6e65; background: #fff; }
.destination-search:focus-within { border-color: var(--leaf); box-shadow: 0 0 0 3px rgba(24,118,83,.1); }
.destination-search input { min-width: 0; height: 100%; border: 0; outline: 0; color: var(--ink); font-size: 10px; background: transparent; }
.destination-search input::placeholder { color: #6e7d75; opacity: 1; }
.destination-search > button { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; color: #65746c; background: #edf1ef; cursor: pointer; }
.picker-section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 9px; }
.picker-section-title span { font-size: 10px; font-weight: 750; }
.picker-section-title small { color: #77847d; font-size: 7px; text-align: right; }
.recommended-title { margin-top: 18px; padding-top: 15px; border-top: 1px solid #d7dfda; }
.search-feedback { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 92px; padding: 14px; color: #65736b; font-size: 9px; text-align: center; background: #fff; }
.search-feedback svg { color: var(--leaf); animation: searchSpin 900ms linear infinite; }
.search-error { justify-content: space-between; }
.search-error button { min-height: 32px; padding: 0 10px; border: 1px solid #cbd5cf; border-radius: 4px; color: var(--leaf-dark); font-size: 8px; background: #fff; cursor: pointer; }
.picker-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
.popular-picker-list { max-height: 420px; overflow-y: auto; padding-right: 3px; scrollbar-gutter: stable; }
.picker-list > button { position: relative; display: grid; grid-template-columns: 68px minmax(0,1fr) auto; align-items: center; gap: 10px; min-width: 0; min-height: 72px; overflow: hidden; padding: 6px 8px 6px 6px; border: 1px solid transparent; border-radius: 6px; text-align: left; background: #fff; cursor: pointer; transition: border-color 250ms cubic-bezier(.22,1,.36,1), transform 250ms cubic-bezier(.22,1,.36,1); }
.picker-list > button:hover { transform: translateY(-1px); }
.picker-list > button.active { border-color: var(--leaf); }
.picker-image { display: grid; place-items: center; width: 68px; height: 58px; overflow: hidden; border-radius: 4px; background: #e3e9e5; }
.picker-image img { width: 100%; height: 100%; object-fit: cover; }
.picker-image > span { display: grid; place-items: center; gap: 3px; color: #6b7a72; }
.picker-image > span small { color: #6b7a72; font-size: 6px; }
.picker-list > button > span { display: grid; gap: 3px; min-width: 0; }
.picker-list small { color: var(--leaf); font-size: 7px; }
.picker-list strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.picker-list em { overflow: hidden; color: #75827b; font-size: 7px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.picker-list i { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid #cfd9d3; border-radius: 50%; color: transparent; }
.picker-list > button.active i { border-color: var(--leaf); color: #fff; background: var(--leaf); }
.search-results { max-height: 245px; overflow-y: auto; padding-right: 2px; }
.picker-source { margin: 12px 0 0; color: #728078; font-size: 7px; line-height: 1.55; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; clip-path: inset(50%); }
.custom-dialog-inner > footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 72px; padding: 13px 24px; border-top: 1px solid var(--line); background: #fff; }
.custom-dialog-inner > footer p { margin: 0; color: #617068; font-size: 9px; }
.custom-dialog-inner > footer > div { display: flex; gap: 8px; }
.custom-dialog-inner > footer button { height: 40px; padding: 0 15px; border-radius: 5px; font-size: 9px; font-weight: 700; cursor: pointer; }
.cancel-button { border: 1px solid #cfd8d3; background: #fff; }
.apply-button { display: inline-flex; align-items: center; gap: 7px; border: 0; color: #fff; background: var(--leaf); }

.journey-section { width: min(1260px, calc(100% - 48px)); margin: 0 auto; padding: 92px 0 110px; }
.journey-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; margin-bottom: 30px; }
.journey-heading p { margin: 0 0 7px; color: var(--leaf); font-size: 10px; font-weight: 700; }
.journey-heading h2 { margin: 0; font-family: "Songti SC", SimSun, serif; font-size: 42px; font-weight: 700; line-height: 1.2; letter-spacing: 0; text-wrap: balance; }
.journey-heading h2.long-title { max-width: 28ch; font-size: 34px; }
.journey-summary { display: flex; align-items: center; gap: 5px; }
.journey-summary span { padding: 7px 9px; border-radius: 4px; color: #55635c; font-size: 9px; background: #e7ece9; }
.journey-workspace { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, .7fr); gap: 22px; }
.itinerary-column { min-width: 0; }
.day-switch { display: flex; overflow-x: auto; border-bottom: 1px solid var(--line); }
.day-switch button { display: grid; grid-template-columns: auto auto; align-items: center; justify-content: center; gap: 7px; min-width: 106px; height: 48px; padding: 0 10px; border: 0; border-bottom: 2px solid transparent; color: #76827c; font-size: 10px; background: transparent; cursor: pointer; }
.day-switch button small { padding: 2px 5px; border-radius: 3px; color: #6d7a73; font-size: 7px; background: #e8edea; }
.day-switch button.active { border-bottom-color: var(--leaf); color: var(--ink); font-weight: 750; }
.day-switch button.active small { color: #fff; background: var(--leaf); }
.day-context { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 58px; padding: 11px 8px; border-bottom: 1px solid var(--line); }
.day-context > div { display: grid; gap: 3px; }
.day-context small { color: var(--leaf); font-size: 7px; }
.day-context strong { font-size: 11px; }
.day-context > span { color: #67756d; font-size: 8px; text-align: right; }
.itinerary-list { min-height: 270px; }
.itinerary-list > button { display: grid; grid-template-columns: 54px 102px minmax(0,1fr) 60px auto; align-items: center; gap: 14px; width: 100%; min-height: 128px; padding: 14px 8px; border: 0; border-bottom: 1px solid var(--line); text-align: left; background: transparent; cursor: pointer; transition: background 300ms cubic-bezier(.22,1,.36,1); }
.itinerary-list > button:hover, .itinerary-list > button.active { background: #edf3ef; }
.stop-time { color: var(--muted); font-family: Georgia, "Times New Roman", serif; font-size: 11px; }
.stop-image { display: grid; place-items: center; width: 102px; height: 82px; overflow: hidden; border-radius: 5px; background: #e2e9e5; }
.stop-image img { width: 100%; height: 100%; object-fit: cover; transition: transform 700ms cubic-bezier(.22,1,.36,1); }
.stop-image-empty { display: grid; place-items: center; gap: 5px; color: #64746b; }
.stop-image-empty small { font-size: 7px; }
.itinerary-list > button:hover .stop-image img { transform: scale(1.055); }
.stop-copy { display: grid; gap: 3px; min-width: 0; }
.stop-copy small { color: var(--leaf); font-size: 8px; }
.stop-copy strong { font-size: 16px; }
.stop-copy em { overflow: hidden; color: #65736b; font-size: 9px; font-style: normal; line-height: 1.6; text-overflow: ellipsis; white-space: nowrap; }
.stop-copy .stop-schedule { overflow: hidden; color: #748078; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.stop-state { display: grid; justify-items: center; gap: 3px; }
.stop-state strong { font-family: Georgia, serif; font-size: 20px; }
.stop-state small { color: #6d7972; font-size: 8px; white-space: nowrap; }
.risk-low { color: var(--leaf); }
.risk-medium { color: #9b7415; }
.risk-high { color: #bf5146; }
.itinerary-list > button > svg { color: #8c9892; }
.day-empty { display: grid; place-items: center; align-content: center; gap: 7px; min-height: 230px; padding: 30px; color: #718078; text-align: center; }
.day-empty svg { color: var(--leaf); }
.day-empty strong { color: var(--ink); font-size: 12px; }
.day-empty span { max-width: 38ch; font-size: 9px; line-height: 1.65; }
.route-decision { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-top: 18px; padding: 15px 16px; border-radius: 6px; color: #dcece3; background: var(--ink); }
.route-decision > div { display: flex; align-items: flex-start; gap: 11px; }
.route-decision svg { flex: 0 0 auto; color: var(--mint); }
.route-decision span { max-width: 60ch; color: rgba(236,246,240,.7); font-size: 9px; line-height: 1.65; }
.route-decision span strong { display: block; margin-bottom: 2px; color: #fff; font-size: 10px; }
.route-decision a { display: inline-flex; align-items: center; gap: 5px; color: var(--mint); font-size: 9px; font-weight: 700; white-space: nowrap; }

.route-side { min-width: 0; }
.mini-map { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 6px; background: #dfe6e1; }
.mini-map > img { position: absolute; max-width: none; object-fit: cover; filter: saturate(.78) contrast(.98) brightness(.88); }
.map-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #66756d; font-size: 9px; background: #e4eae6; }
.mini-map > svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.mini-map path { fill: none; vector-effect: non-scaling-stroke; }
.map-route-halo { stroke: rgba(255,255,255,.9); stroke-width: 6; }
.map-route-line { stroke: #19a66f; stroke-width: 2.2; stroke-linecap: round; stroke-dasharray: 5 6; animation: routeMove 8s linear infinite; }
.mini-map > button { position: absolute; display: grid; place-items: center; width: 25px; height: 25px; padding: 0; border: 2px solid #fff; border-radius: 50%; color: #fff; font-size: 8px; font-weight: 800; background: var(--leaf); box-shadow: 0 2px 5px rgba(11,43,30,.25); transform: translate(-50%,-50%); cursor: pointer; transition: left 760ms cubic-bezier(.22,1,.36,1), top 760ms cubic-bezier(.22,1,.36,1), transform 250ms cubic-bezier(.22,1,.36,1), background 250ms cubic-bezier(.22,1,.36,1); }
.mini-map > button:hover, .mini-map > button.active { background: var(--orange); transform: translate(-50%,-50%) scale(1.13); }
.map-note { position: absolute; right: 8px; bottom: 7px; padding: 5px 7px; border-radius: 3px; color: rgba(255,255,255,.78); font-size: 7px; background: rgba(13,37,26,.78); }
.local-snapshot { padding: 18px 2px 0; }
.snapshot-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.snapshot-title small { color: var(--leaf); font-size: 8px; }
.snapshot-title h3 { margin: 4px 0 0; font-size: 17px; }
.snapshot-title svg { color: var(--leaf); }
.snapshot-data { display: grid; grid-template-columns: repeat(3,1fr); margin-top: 17px; padding: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.snapshot-data div { display: grid; gap: 4px; }
.snapshot-data div + div { padding-left: 13px; border-left: 1px solid var(--line); }
.snapshot-data span { color: #718078; font-size: 8px; }
.snapshot-data strong { font-family: Georgia, "Times New Roman", serif; font-size: 15px; }
.snapshot-data strong small { margin-left: 2px; color: #77847d; font-size: 7px; }
.local-snapshot > p { margin: 10px 0 0; color: #748079; font-size: 8px; }
.nearby-services { display: grid; gap: 7px; margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); }
.nearby-services > strong { display: flex; align-items: center; gap: 6px; color: var(--leaf); font-size: 9px; }
.nearby-services > span { display: grid; grid-template-columns: 58px minmax(0,1fr) auto; align-items: center; gap: 7px; color: #4f5e56; font-size: 8px; }
.nearby-services > span b { font-size: 8px; }
.nearby-services > span small { color: #7b8780; font-size: 7px; white-space: nowrap; }

.route-proof { margin-top: 54px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.route-proof > summary { display: grid; grid-template-columns: minmax(240px,1fr) auto 18px; align-items: center; gap: 28px; min-height: 82px; cursor: pointer; list-style: none; }
.route-proof > summary::-webkit-details-marker { display: none; }
.proof-title { display: flex; align-items: center; gap: 11px; }
.proof-title > svg { color: var(--leaf); }
.proof-title > span { display: grid; gap: 4px; }
.proof-title strong { font-size: 14px; }
.proof-title small { color: #6c7972; font-size: 8px; }
.proof-facts { display: flex; align-items: center; gap: 26px; }
.proof-facts > span { display: flex; align-items: baseline; gap: 5px; color: #6c7972; font-size: 8px; white-space: nowrap; }
.proof-facts b { color: var(--ink); font: 19px/1 "Times New Roman", serif; }
.route-proof > summary > svg { color: #75827b; transition: transform 220ms cubic-bezier(.22,1,.36,1); }
.route-proof[open] > summary > svg { transform: rotate(180deg); }
.proof-content { display: grid; grid-template-columns: 1.15fr .85fr 1.1fr; border-top: 1px solid var(--line); }
.proof-content > section { min-width: 0; padding: 24px 24px 26px; }
.proof-content > section + section { border-left: 1px solid var(--line); }
.proof-content header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.proof-content header > div { display: grid; gap: 4px; }
.proof-content header small { color: var(--leaf); font-size: 8px; }
.proof-content header strong { font-size: 12px; }
.strategy-switch { display: inline-flex; padding: 3px; border-radius: 5px; background: #edf2ef; }
.strategy-switch button { min-height: 28px; padding: 0 9px; border: 0; border-radius: 3px; color: #65736c; font-size: 8px; background: transparent; cursor: pointer; }
.strategy-switch button.active { color: #fff; background: var(--leaf); }
.strategy-switch button:disabled { cursor: wait; opacity: .68; }
.objective-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; margin-top: 23px; }
.objective-bars > div { display: grid; gap: 6px; }
.objective-bars span { display: flex; justify-content: space-between; color: #68766e; font-size: 8px; }
.objective-bars b { color: var(--ink); font: 13px/1 "Times New Roman", serif; }
.objective-bars i { height: 4px; overflow: hidden; border-radius: 2px; background: #dfe7e2; }
.objective-bars em { display: block; height: 100%; border-radius: inherit; background: var(--leaf); transition: width 420ms cubic-bezier(.22,1,.36,1); }
.strategy-proof > p { margin: 18px 0 0; color: #6c7972; font-size: 8px; line-height: 1.6; }
.weather-scenario { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 12px; margin-top: 17px; padding-top: 15px; border-top: 1px solid var(--line); }
.weather-scenario > button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 10px; border: 0; border-radius: 4px; color: #fff; font-size: 8px; background: var(--leaf); cursor: pointer; }
.weather-scenario > button:disabled { cursor: wait; opacity: .68; }
.weather-scenario > small { color: #77837d; font-size: 7px; line-height: 1.5; }
.weather-scenario > div { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 8px; min-width: 0; }
.weather-scenario > div > span { color: var(--leaf); font-size: 8px; font-weight: 700; }
.weather-scenario > div > strong { font-size: 8px; white-space: nowrap; }
.weather-scenario > div > strong em { margin-left: 4px; color: #bd554b; font-style: normal; }
.weather-scenario > div > strong em.safer { color: var(--leaf); }
.weather-scenario > div > small { overflow: hidden; color: #77837d; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.weather-scenario > div > button { min-height: 27px; padding: 0 8px; border: 1px solid rgba(24,118,83,.25); border-radius: 4px; color: var(--leaf); font-size: 7px; background: transparent; cursor: pointer; }
.constraint-proof header, .agent-proof header { display: grid; gap: 4px; }
.constraint-proof ul, .agent-proof ol { display: grid; gap: 13px; margin: 20px 0 0; padding: 0; list-style: none; }
.constraint-proof li { display: grid; grid-template-columns: 22px 1fr; align-items: center; gap: 9px; }
.constraint-proof li > span:first-child { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #8b9690; background: #e5eae7; }
.constraint-proof li > span:first-child.passed { color: #fff; background: var(--leaf); }
.constraint-proof li > span:last-child { display: grid; gap: 3px; }
.constraint-proof li strong { font-size: 9px; }
.constraint-proof li small { color: #77837d; font-size: 8px; }
.agent-proof li { display: grid; grid-template-columns: 8px minmax(0,1fr) auto; align-items: center; gap: 10px; }
.agent-proof li > span { width: 7px; height: 7px; border-radius: 50%; background: var(--leaf); }
.agent-proof li > div { display: grid; gap: 3px; min-width: 0; }
.agent-proof li strong { font-size: 9px; }
.agent-proof li small { overflow: hidden; color: #77837d; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.agent-proof li > b { color: #526159; font: 10px/1 "Times New Roman", serif; white-space: nowrap; }

.intelligence-section { display: grid; grid-template-columns: .86fr 1.14fr; gap: 90px; padding: 110px max(6vw, calc((100vw - 1260px)/2)); color: #edf5f0; background: #102019; }
.intelligence-copy h2 { margin: 0; font-family: "Songti SC", SimSun, serif; font-size: clamp(34px, 3.5vw, 54px); font-weight: 700; line-height: 1.24; letter-spacing: 0; }
.intelligence-copy p { max-width: 46ch; margin: 24px 0 0; color: rgba(229,241,234,.63); font-size: 11px; line-height: 1.9; }
.intelligence-copy a { display: inline-flex; align-items: center; gap: 8px; margin-top: 27px; color: var(--mint); font-size: 10px; font-weight: 700; }
.decision-flow { align-self: center; }
.decision-flow article { display: grid; grid-template-columns: 35px 1fr auto; align-items: center; gap: 16px; min-height: 78px; border-bottom: 1px solid rgba(221,241,230,.14); }
.decision-flow article > span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: #08261a; font-family: Georgia, serif; font-size: 10px; background: var(--mint); }
.decision-flow article div { display: grid; gap: 4px; }
.decision-flow strong { font-size: 13px; }
.decision-flow p { margin: 0; color: rgba(229,241,234,.55); font-size: 9px; }
.decision-flow i { width: 58px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, var(--mint), rgba(121,224,181,.08)); transform-origin: left; animation: dataFlow 3.8s cubic-bezier(.22,1,.36,1) infinite alternate; }
.decision-flow article:nth-child(2) i { animation-delay: -.8s; }
.decision-flow article:nth-child(3) i { animation-delay: -1.6s; }
.decision-flow article:nth-child(4) i { animation-delay: -2.4s; }

.destination-section { padding: 110px 0 120px; overflow: hidden; background: #fff; }
.destination-heading { width: min(1260px, calc(100% - 48px)); margin: 0 auto 30px; }
.destination-heading h2 { margin: 0; font-family: "Songti SC", SimSun, serif; font-size: clamp(32px, 3.2vw, 49px); letter-spacing: 0; }
.destination-heading p { margin: 10px 0 0; color: var(--muted); font-size: 11px; }
.destination-reel { display: flex; gap: 8px; width: min(1360px, calc(100% - 32px)); margin: 0 auto; }
.destination-reel button { position: relative; flex: 1 1 0; min-width: 0; height: 390px; overflow: hidden; padding: 0; border: 0; border-radius: 6px; text-align: left; background: #20382d; cursor: pointer; transition: flex-grow 750ms cubic-bezier(.22,1,.36,1); }
.destination-reel button:hover { flex-grow: 1.45; }
.destination-reel img { width: 100%; height: 100%; object-fit: cover; transition: transform 900ms cubic-bezier(.22,1,.36,1); }
.destination-reel button:hover img { transform: scale(1.045); }
.destination-reel button > span { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 38%, rgba(5,20,13,.76)); }
.destination-reel button > div { position: absolute; right: 20px; bottom: 20px; left: 20px; display: grid; color: #fff; }
.destination-reel small { font-size: 8px; }
.destination-reel strong { margin-top: 3px; font-size: 20px; }
.destination-reel em { margin-top: 5px; color: rgba(255,255,255,.64); font-size: 8px; font-style: normal; }

.award-app > footer { display: flex; align-items: center; justify-content: space-between; gap: 30px; min-height: 118px; padding: 20px max(5vw, calc((100vw - 1260px)/2)); color: #eaf3ee; background: #0a1510; }
.award-app > footer .award-brand small { color: rgba(255,255,255,.48); }
.award-app > footer p { color: rgba(231,242,236,.55); font-size: 9px; }
.award-app > footer > a { display: inline-flex; align-items: center; gap: 6px; color: var(--mint); font-size: 9px; }

@keyframes buttonLoad { to { transform: translateX(100%); } }
@keyframes heroFilm {
  from { transform: scale(1.075) translate3d(var(--film-from-x, 0), var(--film-from-y, 0), 0); }
  to { transform: scale(1.015) translate3d(var(--film-to-x, 0), var(--film-to-y, 0), 0); }
}
@keyframes placeProgress { to { transform: scaleX(1); } }
@keyframes routeMove { to { stroke-dashoffset: -66; } }
@keyframes dataFlow { from { transform: scaleX(.25); opacity: .35; } to { transform: scaleX(1); opacity: 1; } }
@keyframes searchSpin { to { transform: rotate(360deg); } }

@media (max-width: 980px) {
  .award-header { right: 24px; left: 24px; }
  .award-header nav { display: none; }
  .travel-hero { min-height: 760px; }
  .place-switcher { right: 24px; bottom: 205px; }
  .place-switcher button { width: 108px; }
  .planner-shell { right: 24px; left: 24px; }
  .planner-form { grid-template-columns: 1fr 1fr 136px; }
  .planner-field { grid-column: 1 / 3; }
  .planner-form > button { grid-column: 3; grid-row: 1 / 3; height: auto; }
  .planner-field { grid-template-columns: 1fr; align-content: center; gap: 3px; }
  .planner-field label { font-size: 8px; }
  .journey-workspace { grid-template-columns: 1fr; }
  .route-side { display: grid; grid-template-columns: 1.15fr .85fr; gap: 20px; align-items: start; }
  .proof-content { grid-template-columns: 1fr; }
  .proof-content > section + section { border-top: 1px solid var(--line); border-left: 0; }
  .proof-facts { gap: 15px; }
  .intelligence-section { grid-template-columns: 1fr; gap: 55px; }
  .custom-layout { grid-template-columns: 1fr; }
  .custom-conditions { border-right: 0; border-bottom: 1px solid var(--line); }
}

@media (max-width: 680px) {
  .award-header { right: 16px; left: 16px; height: 68px; }
  .award-brand > div small { display: none; }
  .demo-link { height: 35px; }
  .travel-hero { min-height: 800px; height: 100dvh; max-height: none; }
  .hero-copy { top: 19%; right: 20px; left: 20px; }
  .hero-copy h1 { font-size: 49px; }
  .hero-copy p { max-width: 28ch; font-size: 14px; }
  .place-switcher { right: 16px; bottom: 265px; left: 16px; max-width: none; overflow-x: auto; scrollbar-width: none; }
  .place-switcher::-webkit-scrollbar { display: none; }
  .place-switcher button { flex: 0 0 108px; }
  .planner-shell { right: 16px; bottom: 16px; left: 16px; padding: 12px; }
  .scenario-tabs { overflow-x: auto; }
  .scenario-tabs button { flex: 0 0 auto; }
  .planner-form { grid-template-columns: 1fr; }
  .planner-region-field { height: 44px; }
  .planner-field { grid-column: auto; }
  .origin-field { height: 44px; }
  .origin-menu { width: min(300px, calc(100vw - 56px)); }
  .planner-field { height: 59px; padding: 8px 12px; }
  .planner-form > button { grid-column: auto; grid-row: auto; width: 100%; height: 48px; }
  .planner-status { gap: 12px; overflow-x: auto; }
  .planner-status span { flex: 0 0 auto; }
  .journey-section { width: calc(100% - 32px); padding: 68px 0 80px; }
  .journey-heading { display: block; }
  .journey-heading h2, .journey-heading h2.long-title { max-width: none; font-size: 30px; }
  .journey-summary { margin-top: 16px; }
  .itinerary-list > button { grid-template-columns: 44px 74px minmax(0,1fr) auto; gap: 10px; min-height: 108px; }
  .stop-image { width: 74px; height: 70px; }
  .stop-state { display: none; }
  .stop-copy em { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .route-decision { display: block; }
  .route-decision a { margin-top: 12px; }
  .route-side { display: block; }
  .local-snapshot { padding-top: 18px; }
  .route-proof > summary { grid-template-columns: 1fr 18px; gap: 12px; padding: 13px 0; }
  .proof-facts { grid-column: 1 / -1; grid-row: 2; display: grid; grid-template-columns: 1fr 1fr; gap: 9px 15px; }
  .route-proof > summary > svg { grid-column: 2; grid-row: 1; }
  .proof-content > section { padding: 20px 2px; }
  .proof-content header { display: grid; }
  .strategy-switch { width: 100%; margin-top: 10px; }
  .strategy-switch button { flex: 1; }
  .weather-scenario { grid-template-columns: 1fr; }
  .weather-scenario > div { grid-template-columns: 1fr auto; }
  .weather-scenario > div > small { grid-column: 1 / -1; }
  .intelligence-section { padding: 78px 20px; }
  .decision-flow i { display: none; }
  .destination-section { padding: 78px 0 82px; }
  .destination-heading { width: calc(100% - 32px); }
  .destination-reel { overflow-x: auto; width: 100%; padding: 0 16px; scroll-snap-type: x mandatory; }
  .destination-reel button { flex: 0 0 78vw; height: 350px; scroll-snap-align: center; }
  .destination-reel button:hover { flex-grow: 0; }
  .custom-dialog-inner { width: calc(100vw - 20px); max-height: calc(100dvh - 20px); }
  .custom-dialog-inner > header { min-height: 70px; padding: 14px 16px; }
  .custom-dialog-inner > header h2 { font-size: 21px; }
  .custom-conditions, .destination-picker { padding: 17px 16px; }
  .custom-row.two-columns { grid-template-columns: 1fr; }
  .travelers button { flex: 1 1 calc(50% - 6px); }
  .selected-destinations { margin-right: -16px; padding-right: 16px; }
  .picker-section-title { align-items: flex-start; }
  .picker-section-title small { max-width: 56%; }
  .picker-list { grid-template-columns: 1fr; }
  .search-results { max-height: 310px; }
  .custom-dialog-inner > footer { display: grid; padding: 13px 16px; }
  .custom-dialog-inner > footer > div { width: 100%; }
  .custom-dialog-inner > footer button { flex: 1; }
  .award-app > footer { display: grid; justify-items: start; padding: 28px 20px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
</style>
