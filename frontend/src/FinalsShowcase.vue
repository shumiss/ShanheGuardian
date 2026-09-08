<template>
  <div class="travel-page">
    <a class="skip-link" href="#main">跳到主要内容</a>

    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#top" aria-label="黔行守护首页">
          <span class="brand-mark">黔</span>
          <span class="brand-copy">
            <strong>黔行守护</strong>
            <small>贵州山地文旅安全伴游</small>
          </span>
        </a>

        <nav aria-label="主导航">
          <a href="#inspiration">景点灵感</a>
          <a href="#planner">安全路线</a>
          <a href="#audiences">旅行方式</a>
        </nav>

        <a class="product-entry" href="?mode=demo">
          决赛产品
          <ArrowUpRight :size="17" />
        </a>
      </div>
    </header>

    <main id="main">
      <LiveSituationalHero v-model="query" @route-generated="handleLiveRoute" />

      <section id="inspiration" class="content-section spot-section">
        <div class="section-title">
          <div>
            <h2>贵州本周值得去</h2>
            <p>综合游客偏好、天气条件、景区承载与山地风险推荐</p>
          </div>
          <div class="carousel-actions">
            <button type="button" aria-label="向左浏览" @click="scrollSpots(-1)"><ChevronLeft :size="21" /></button>
            <button type="button" aria-label="向右浏览" @click="scrollSpots(1)"><ChevronRight :size="21" /></button>
          </div>
        </div>

        <div ref="spotTrack" class="spot-track">
          <article v-for="spot in spots" :key="spot.name" class="spot-card" @click="openSpot(spot)">
            <div class="spot-photo">
              <img :src="spot.image" :alt="spot.name" />
              <button
                class="heart-button"
                type="button"
                :aria-label="favorites.includes(spot.name) ? `取消收藏${spot.name}` : `收藏${spot.name}`"
                :class="{ saved: favorites.includes(spot.name) }"
                @click.stop="toggleFavorite(spot.name)"
              >
                <Heart :size="21" :fill="favorites.includes(spot.name) ? 'currentColor' : 'none'" />
              </button>
              <span v-if="spot.featured" class="choice-badge">旅行者推荐</span>
            </div>
            <p>{{ spot.city }} · {{ spot.category }}</p>
            <h3>{{ spot.name }}</h3>
            <div class="rating-row">
              <span class="rating-dots" :aria-label="`${spot.rating}分`"><i v-for="n in 5" :key="n" :class="{ hollow: n > Math.round(spot.rating) }"></i></span>
              <strong>{{ spot.rating }}</strong>
              <span>{{ spot.reviews }} 条体验样本</span>
            </div>
            <div class="spot-meta">
              <span :class="`risk-${spot.riskLevel}`">{{ spot.risk }}风险 · {{ spot.score }}分</span>
              <span>{{ spot.fit }}</span>
            </div>
          </article>
        </div>
      </section>

      <section class="trust-strip" aria-label="平台能力">
        <article>
          <ShieldCheck :size="27" />
          <div><strong>风险有解释</strong><span>每个分数都能追溯天气、坡度、拥堵与服务覆盖</span></div>
        </article>
        <article>
          <Database :size="27" />
          <div><strong>公共数据参与决策</strong><span>已纳入 2,017 个贵州景区与风景名胜点位</span></div>
        </article>
        <article>
          <Route :size="27" />
          <div><strong>路线能动态调整</strong><span>天气或客流变化时，给出替代点位与处置建议</span></div>
        </article>
      </section>

      <section id="planner" class="planner-section">
        <div class="planner-inner">
          <div class="planner-copy">
            <span class="section-label">AI 安全行程</span>
            <h2>把“想去”变成<br />真正能走的路线</h2>
            <p>不只拼接热门景点。系统先理解同行人群和旅行节奏，再结合贵州山地天气、坡度、拥堵和应急服务点完成路线校准。</p>

            <div class="planner-query">
              <Sparkles :size="19" />
              <span>{{ query }}</span>
            </div>

            <div class="planner-options" aria-label="路线偏好">
              <button
                v-for="option in plannerOptions"
                :key="option"
                type="button"
                :class="{ active: activeOption === option }"
                @click="activeOption = option"
              >{{ option }}</button>
            </div>

            <button class="generate-button" type="button" :disabled="isGenerating" @click="generatePlan">
              <span v-if="isGenerating" class="button-loader"></span>
              <Play v-else :size="17" fill="currentColor" />
              {{ isGenerating ? '正在融合风险数据' : '生成我的安全路线' }}
            </button>
          </div>

          <div class="route-result" :class="{ loading: isGenerating }">
            <div class="route-map">
              <img :src="reliefMap" alt="贵州山地路线态势图" />
              <svg viewBox="0 0 720 410" preserveAspectRatio="none" aria-hidden="true">
                <path class="route-halo" d="M76 292 C156 330 188 214 270 240 C346 264 356 125 438 160 C520 195 536 84 646 122" />
                <path class="route-line" d="M76 292 C156 330 188 214 270 240 C346 264 356 125 438 160 C520 195 536 84 646 122" />
              </svg>
              <button
                v-for="(point, index) in routePoints"
                :key="point.name"
                class="route-pin"
                :style="{ left: point.x, top: point.y }"
                type="button"
                @click="selectedRoutePoint = index"
              >
                <span>{{ index + 1 }}</span>
                <em>{{ point.name }}</em>
              </button>
              <div class="route-status"><i></i> 数据融合完成 · 可信度 92%</div>
            </div>

            <div class="route-summary">
              <div class="summary-head">
                <div>
                  <small>{{ planGenerated ? '路线已根据偏好更新' : '推荐路线预览' }}</small>
                  <h3>贵州山水轻行 · {{ activeOption }}</h3>
                </div>
                <span>2 天 · 5 站</span>
              </div>
              <div class="route-stops">
                <button
                  v-for="(point, index) in routePoints"
                  :key="point.name"
                  type="button"
                  :class="{ active: selectedRoutePoint === index }"
                  @click="selectedRoutePoint = index"
                >
                  <span>{{ index + 1 }}</span>
                  <strong>{{ point.name }}</strong>
                  <em :class="`risk-${point.level}`">{{ point.risk }}</em>
                </button>
              </div>
              <div class="decision-note">
                <CloudRain :size="20" />
                <p><strong>{{ routePoints[selectedRoutePoint].name }}提示</strong>{{ routePoints[selectedRoutePoint].note }}</p>
                <a href="?mode=demo">查看完整证据链 <ArrowRight :size="15" /></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="audiences" class="content-section audience-section">
        <div class="section-title">
          <div>
            <h2>按你的旅行方式探索</h2>
            <p>同一片贵州山水，不同人需要完全不同的节奏与安全保障</p>
          </div>
        </div>

        <div class="audience-grid">
          <button v-for="audience in audiences" :key="audience.title" type="button" @click="applyAudience(audience)">
            <img :src="audience.image" :alt="audience.title" />
            <span class="image-shade"></span>
            <span class="audience-copy">
              <component :is="audience.icon" :size="22" />
              <strong>{{ audience.title }}</strong>
              <small>{{ audience.subtitle }}</small>
            </span>
          </button>
        </div>
      </section>

      <section class="product-section">
        <div class="product-heading">
          <span class="section-label">决赛产品</span>
          <h2>游客看到的是路线，<br />管理者看到的是决策闭环。</h2>
          <p>在完整控制台中查看路线生成、风险研判、应急资源、公共数据和 AI 解释链路。</p>
          <a href="?mode=demo"><Play :size="17" fill="currentColor" />进入产品演示</a>
        </div>
        <div class="product-frame">
          <div class="frame-toolbar">
            <span><i></i><i></i><i></i></span>
            <strong>黔行守护 · 山地文旅安全决策平台</strong>
            <a href="?mode=demo" aria-label="全屏打开"><Maximize2 :size="17" /></a>
          </div>
          <iframe title="黔行守护决赛产品" src="?mode=demo&embed=1" loading="lazy"></iframe>
        </div>
      </section>

      <section class="closing-section">
        <img :src="xijiangImage" alt="贵州西江千户苗寨" />
        <span class="image-shade"></span>
        <div>
          <small>QIANXING GUARDIAN</small>
          <h2>看见贵州，也看见旅途中的每一种风险。</h2>
          <a href="#top">开始规划贵州之旅 <ArrowUpRight :size="18" /></a>
        </div>
      </section>
    </main>

    <footer>
      <div class="footer-brand">
        <span class="brand-mark">黔</span>
        <div><strong>黔行守护</strong><small>贵州山地旅游 AI 伴游与安全决策平台</small></div>
      </div>
      <p>2026 贵州省人工智能创业大赛 · 决赛项目</p>
      <div class="footer-links"><a href="#inspiration">景点</a><a href="#planner">路线</a><a href="?mode=demo">产品</a></div>
    </footer>

    <dialog ref="spotDialog" class="spot-dialog" @click="closeOnBackdrop">
      <button class="dialog-close" type="button" aria-label="关闭" @click="closeSpot"><X :size="21" /></button>
      <template v-if="selectedSpot">
        <div class="dialog-photo"><img :src="selectedSpot.image" :alt="selectedSpot.name" /></div>
        <div class="dialog-content">
          <p>{{ selectedSpot.city }} · {{ selectedSpot.category }}</p>
          <h2>{{ selectedSpot.name }}</h2>
          <div class="dialog-score"><strong>{{ selectedSpot.rating }}</strong><span>游客评分</span><i></i><strong>{{ selectedSpot.score }}</strong><span>当前风险分</span></div>
          <p class="dialog-description">{{ selectedSpot.description }}</p>
          <div class="dialog-facts">
            <span><ShieldCheck :size="17" />{{ selectedSpot.risk }}风险</span>
            <span><Users :size="17" />{{ selectedSpot.fit }}</span>
            <span><Clock3 :size="17" />建议停留 {{ selectedSpot.duration }}</span>
          </div>
          <div class="dialog-advice"><CloudRain :size="20" /><p><strong>AI 安全建议</strong>{{ selectedSpot.advice }}</p></div>
          <button type="button" @click="planWithSpot(selectedSpot)">加入安全路线 <ArrowRight :size="16" /></button>
        </div>
      </template>
    </dialog>
  </div>
</template>

<script setup>
import { markRaw, ref } from 'vue';
import {
  ArrowRight,
  ArrowUpRight,
  Baby,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudRain,
  Database,
  GraduationCap,
  Heart,
  MapPin,
  Maximize2,
  Mountain,
  Play,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Trees,
  Users,
  X,
} from '@lucide/vue';
import reliefMap from './assets/guizhou-relief-map.png';
import LiveSituationalHero from './LiveSituationalHero.vue';
import fanjingshanImage from './assets/scenic/fanjingshan.webp';
import huangguoshuImage from './assets/scenic/huangguoshu.webp';
import liboImage from './assets/scenic/libo.webp';
import qingyanImage from './assets/scenic/qingyan.webp';
import wanfenglinImage from './assets/scenic/wanfenglin.webp';
import xijiangImage from './assets/scenic/xijiang.webp';
import zhijinImage from './assets/scenic/zhijin.webp';

const query = ref('带父母和孩子去贵州玩两天，不想太累，担心下雨路滑');
const activeOption = ref('安全优先');
const isGenerating = ref(false);
const planGenerated = ref(false);
const selectedRoutePoint = ref(0);
const favorites = ref([]);
const spotTrack = ref(null);
const spotDialog = ref(null);
const selectedSpot = ref(null);

const quickQueries = [
  { label: '亲子雨天', query: '带孩子去贵州玩两天，遇到小雨，希望路线轻松并靠近服务点', icon: markRaw(Baby) },
  { label: '康养慢游', query: '陪父母在贵州康养慢游三天，减少爬坡，优先空气好和医疗可达', icon: markRaw(Users) },
  { label: '研学团队', query: '30 人研学团队去贵州三天，关注地质文化、承载能力和集合安全', icon: markRaw(GraduationCap) },
  { label: '山地探索', query: '想体验贵州山地自然风光，接受中等强度，需要规避恶劣天气', icon: markRaw(Mountain) },
];

const spots = [
  { name: '梵净山', city: '铜仁', category: '自然与地标', image: fanjingshanImage, rating: 4.8, reviews: '12,486', risk: '中', riskLevel: 'medium', score: 67, fit: '自然探索', duration: '5 小时', featured: true, description: '云海、奇峰与原始生态共同构成贵州最具辨识度的世界自然遗产目的地。', advice: '山顶天气变化快，建议 14:00 前完成核心游线；雨雾天气降低路线强度并关注索道状态。' },
  { name: '黄果树瀑布', city: '安顺', category: '瀑布与峡谷', image: huangguoshuImage, rating: 4.7, reviews: '18,952', risk: '中', riskLevel: 'medium', score: 61, fit: '家庭出游', duration: '4 小时', featured: true, description: '以亚洲著名大瀑布为核心的山水游览区，适合家庭和初次到访贵州的游客。', advice: '丰水期步道湿滑，建议穿防滑鞋并避开 11:00 至 14:00 客流高峰。' },
  { name: '荔波小七孔', city: '黔南', category: '山水与森林', image: liboImage, rating: 4.8, reviews: '10,361', risk: '低', riskLevel: 'low', score: 46, fit: '亲子家庭', duration: '5 小时', featured: true, description: '碧水、古桥与喀斯特森林相连，路线层次丰富，适合亲子和轻强度旅行。', advice: '雨天部分亲水路段水位上涨，建议优先走西门至卧龙潭方向并随时关注园区广播。' },
  { name: '西江千户苗寨', city: '黔东南', category: '民族文化', image: xijiangImage, rating: 4.6, reviews: '16,874', risk: '中', riskLevel: 'medium', score: 58, fit: '文化体验', duration: '1 天', featured: false, description: '依山而建的苗族聚落，夜景、非遗与村寨空间构成完整的文化体验。', advice: '节假日核心观景台客流密集，建议错峰进入并提前确认接驳车末班时间。' },
  { name: '青岩古镇', city: '贵阳', category: '古镇与人文', image: qingyanImage, rating: 4.5, reviews: '8,129', risk: '低', riskLevel: 'low', score: 42, fit: '轻松慢游', duration: '3 小时', featured: false, description: '石巷、城门与贵州地方饮食集中呈现，距离贵阳市区较近，行程安排灵活。', advice: '古镇石板路雨天较滑，老人同行建议由北门进入并减少城墙台阶路线。' },
  { name: '万峰林', city: '黔西南', category: '田园与峰林', image: wanfenglinImage, rating: 4.7, reviews: '6,745', risk: '低', riskLevel: 'low', score: 39, fit: '康养慢游', duration: '4 小时', featured: false, description: '峰林、田园与布依村寨相互交织，视野开阔，适合骑行和康养度假。', advice: '午后日照较强，建议上午游览；骑行时避开村道车辆集中时段。' },
  { name: '织金洞', city: '毕节', category: '地质奇观', image: zhijinImage, rating: 4.8, reviews: '7,683', risk: '中', riskLevel: 'medium', score: 64, fit: '研学旅行', duration: '3 小时', featured: true, description: '规模宏大的喀斯特洞穴系统，地质景观丰富，是贵州研学旅行的重要目的地。', advice: '洞内湿度高且部分台阶连续，老人和儿童需控制行进速度，注意保暖与防滑。' },
];

const plannerOptions = ['安全优先', '低强度', '民族文化', '山地自然'];

const routePoints = [
  { name: '青岩古镇', risk: '低风险', level: 'low', x: '10%', y: '69%', note: '雨天石板路湿滑，从北门进入可减少连续台阶。' },
  { name: '黄果树', risk: '中风险', level: 'medium', x: '31%', y: '55%', note: '丰水期瀑布步道湿度高，建议避开正午客流并穿防滑鞋。' },
  { name: '荔波小七孔', risk: '低风险', level: 'low', x: '51%', y: '37%', note: '亲水路段关注临时水位变化，园区服务点覆盖较完整。' },
  { name: '西江苗寨', risk: '中风险', level: 'medium', x: '69%', y: '24%', note: '夜间返程客流集中，建议预留接驳时间并确认集合点。' },
  { name: '梵净山', risk: '中风险', level: 'medium', x: '87%', y: '15%', note: '高海拔天气变化快，需关注索道状态和山顶能见度。' },
];

const audiences = [
  { title: '亲子家庭', subtitle: '低强度 · 服务点优先', image: liboImage, query: '带孩子去贵州旅行，路线轻松，优先服务设施完善的景区', icon: markRaw(Baby) },
  { title: '银发康养', subtitle: '少爬坡 · 医疗可达', image: wanfenglinImage, query: '陪父母康养慢游贵州，少爬坡，关注医疗和休息点', icon: markRaw(Users) },
  { title: '研学团队', subtitle: '承载校验 · 集合管理', image: zhijinImage, query: '研学团队探索贵州地质文化，需要校验承载和集合安全', icon: markRaw(GraduationCap) },
  { title: '山地探索', subtitle: '自然秘境 · 风险预警', image: fanjingshanImage, query: '探索贵州山地自然秘境，接受中等强度并需要天气预警', icon: markRaw(Trees) },
];

function submitSearch() {
  document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth' });
  generatePlan();
}

function applyQuickQuery(item) {
  query.value = item.query;
  activeOption.value = item.label === '山地探索' ? '山地自然' : item.label === '研学团队' ? '民族文化' : '安全优先';
  submitSearch();
}

function generatePlan() {
  if (isGenerating.value) return;
  isGenerating.value = true;
  planGenerated.value = false;
  window.setTimeout(() => {
    isGenerating.value = false;
    planGenerated.value = true;
    selectedRoutePoint.value = activeOption.value === '山地自然' ? 4 : 0;
  }, 850);
}

function handleLiveRoute() {
  planGenerated.value = true;
}

function scrollSpots(direction) {
  spotTrack.value?.scrollBy({ left: direction * 620, behavior: 'smooth' });
}

function toggleFavorite(name) {
  favorites.value = favorites.value.includes(name)
    ? favorites.value.filter(item => item !== name)
    : [...favorites.value, name];
}

function openSpot(spot) {
  selectedSpot.value = spot;
  spotDialog.value?.showModal();
}

function closeSpot() {
  spotDialog.value?.close();
}

function closeOnBackdrop(event) {
  if (event.target === spotDialog.value) closeSpot();
}

function planWithSpot(spot) {
  query.value = `以${spot.name}为核心安排贵州两日安全路线，同行有老人和孩子，控制强度`;
  closeSpot();
  submitSearch();
}

function applyAudience(audience) {
  query.value = audience.query;
  document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth' });
  generatePlan();
}
</script>

<style>
:root {
  font-family: "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color: #17211c;
  background: #ffffff;
  font-synthesis: none;
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { min-width: 320px; margin: 0; background: #ffffff; }
button, input { font: inherit; }
button { color: inherit; }
a { color: inherit; text-decoration: none; }
img { display: block; }

.travel-page {
  --ink: #17211c;
  --muted: #5d665f;
  --soft: #f2f5f3;
  --line: #d9dfdb;
  --green: #0a7b57;
  --green-dark: #07583f;
  --mint: #8ce8c5;
  --yellow: #f4c44e;
  --danger: #c84c48;
  min-height: 100dvh;
  color: var(--ink);
  background: #fff;
}

.skip-link { position: fixed; z-index: 200; top: 8px; left: 8px; padding: 10px 14px; color: #fff; background: var(--ink); transform: translateY(-150%); }
.skip-link:focus { transform: none; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }

.site-header { position: absolute; z-index: 80; top: 0; right: 0; left: 0; border-bottom: 1px solid rgba(208, 240, 223, 0.12); color: #f4fbf7; background: linear-gradient(180deg, rgba(2, 13, 9, 0.78), rgba(2, 13, 9, 0.18)); backdrop-filter: blur(10px); }
.header-inner { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: min(1280px, calc(100% - 48px)); height: 72px; margin: 0 auto; }
.brand { display: flex; align-items: center; gap: 11px; justify-self: start; }
.brand-mark { display: grid; place-items: center; width: 39px; height: 39px; border: 1px solid rgba(121, 239, 184, 0.42); border-radius: 6px; color: #07170f; font-size: 17px; font-weight: 800; background: #79efb8; box-shadow: 0 0 22px rgba(121, 239, 184, 0.17); }
.brand-copy { display: grid; gap: 1px; }
.brand-copy strong { font-size: 15px; font-weight: 750; }
.brand-copy small { color: rgba(230, 244, 237, 0.53); font-size: 9px; }
.site-header nav { display: flex; align-items: center; gap: 8px; }
.site-header nav a { padding: 10px 13px; border-radius: 4px; color: rgba(239, 248, 243, 0.68); font-size: 12px; font-weight: 600; transition: color 180ms ease, background 180ms ease; }
.site-header nav a:hover { color: #fff; background: rgba(121, 239, 184, 0.08); }
.product-entry { display: inline-flex; align-items: center; gap: 7px; justify-self: end; min-height: 38px; padding: 0 13px; border: 1px solid rgba(121, 239, 184, 0.32); border-radius: 4px; color: #dff8eb; font-size: 11px; font-weight: 700; background: rgba(5, 28, 18, 0.52); transition: color 180ms ease, background 180ms ease, transform 180ms ease; }
.product-entry:hover { color: #06150e; background: #79efb8; transform: translateY(-1px); }

.search-hero { width: min(1280px, calc(100% - 48px)); margin: 0 auto; padding: 64px 0 72px; }
.hero-intro { text-align: center; }
.hero-intro > p { margin: 0 0 13px; color: var(--green); font-size: 13px; font-weight: 700; }
.hero-intro h1 { margin: 0; font-size: 52px; font-weight: 800; line-height: 1.12; letter-spacing: 0; text-wrap: balance; }
.hero-intro > span { display: block; max-width: 650px; margin: 15px auto 0; color: var(--muted); font-size: 16px; line-height: 1.7; }

.search-box { display: grid; grid-template-columns: auto 1fr auto; align-items: center; width: min(820px, 100%); min-height: 64px; margin: 30px auto 0; padding: 7px 7px 7px 20px; border: 2px solid var(--ink); border-radius: 32px; background: #fff; box-shadow: 0 5px 0 rgba(23, 33, 28, 0.08); transition: box-shadow 180ms ease, border-color 180ms ease; }
.search-box:focus-within { border-color: var(--green); box-shadow: 0 0 0 4px rgba(10, 123, 87, 0.13); }
.search-box svg { color: var(--green); }
.search-box input { min-width: 0; height: 46px; padding: 0 14px; border: 0; outline: 0; color: var(--ink); font-size: 15px; background: transparent; }
.search-box input::placeholder { color: #6b746e; opacity: 1; }
.search-box button { height: 48px; padding: 0 22px; border: 0; border-radius: 24px; color: #fff; font-size: 13px; font-weight: 750; background: var(--green); cursor: pointer; transition: background 180ms ease, transform 180ms ease; }
.search-box button:hover { background: var(--green-dark); }
.search-box button:active { transform: scale(0.98); }

.quick-searches { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 17px; }
.quick-searches > span { margin-right: 3px; color: #758078; font-size: 11px; }
.quick-searches button { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 11px; border: 1px solid var(--line); border-radius: 17px; color: #3d4942; font-size: 11px; background: #fff; cursor: pointer; transition: border-color 180ms ease, background 180ms ease, transform 180ms ease; }
.quick-searches button:hover { border-color: var(--green); background: #edf8f3; transform: translateY(-1px); }

.hero-mosaic { display: grid; grid-template-columns: 1.65fr 0.75fr; grid-template-rows: 1fr 1fr; gap: 8px; height: 440px; margin-top: 46px; overflow: hidden; border-radius: 8px; }
.hero-mosaic button { position: relative; overflow: hidden; padding: 0; border: 0; text-align: left; background: #dce3df; cursor: pointer; }
.hero-mosaic .mosaic-feature { grid-row: 1 / 3; }
.hero-mosaic img { width: 100%; height: 100%; object-fit: cover; transition: transform 650ms cubic-bezier(.2,.75,.2,1), filter 650ms ease; }
.hero-mosaic button:hover img { filter: saturate(1.08); transform: scale(1.035); }
.image-shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 38%, rgba(5, 19, 13, 0.72)); }
.mosaic-copy { position: absolute; right: 24px; bottom: 22px; left: 24px; display: grid; color: #fff; }
.mosaic-copy small { margin-bottom: 4px; font-size: 11px; }
.mosaic-copy strong { font-size: 27px; line-height: 1.2; }
.mosaic-copy em { margin-top: 7px; color: #e1eee8; font-size: 11px; font-style: normal; }
.mosaic-feature .mosaic-copy { right: 32px; bottom: 30px; left: 32px; }
.mosaic-feature .mosaic-copy strong { font-size: 38px; }

.content-section { width: min(1280px, calc(100% - 48px)); margin: 0 auto; padding: 80px 0; }
.section-title { display: flex; align-items: flex-end; justify-content: space-between; gap: 30px; margin-bottom: 28px; }
.section-title h2 { margin: 0; font-size: 31px; line-height: 1.25; text-wrap: balance; }
.section-title p { margin: 7px 0 0; color: var(--muted); font-size: 13px; }
.carousel-actions { display: flex; gap: 8px; }
.carousel-actions button { display: grid; place-items: center; width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 50%; background: #fff; cursor: pointer; transition: border-color 180ms ease, background 180ms ease; }
.carousel-actions button:hover { border-color: var(--ink); background: var(--soft); }

.spot-track { display: flex; gap: 18px; overflow-x: auto; padding: 0 0 9px; scroll-snap-type: x mandatory; scrollbar-width: thin; scrollbar-color: #b5bdb7 transparent; }
.spot-card { flex: 0 0 calc((100% - 54px) / 4); min-width: 245px; scroll-snap-align: start; cursor: pointer; }
.spot-photo { position: relative; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 7px; background: var(--soft); }
.spot-photo img { width: 100%; height: 100%; object-fit: cover; transition: transform 420ms cubic-bezier(.2,.75,.2,1), filter 420ms ease; }
.spot-card:hover .spot-photo img { filter: saturate(1.08); transform: scale(1.045); }
.heart-button { position: absolute; z-index: 2; top: 10px; right: 10px; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 50%; color: var(--ink); background: rgba(255, 255, 255, 0.94); cursor: pointer; transition: transform 160ms ease, color 160ms ease; }
.heart-button:hover { transform: scale(1.07); }
.heart-button.saved { color: var(--danger); }
.choice-badge { position: absolute; bottom: 10px; left: 10px; padding: 6px 8px; border-radius: 4px; color: #fff; font-size: 10px; font-weight: 700; background: var(--green); }
.spot-card > p { margin: 13px 0 3px; color: var(--muted); font-size: 11px; }
.spot-card h3 { margin: 0; font-size: 17px; line-height: 1.4; }
.rating-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.rating-dots { display: flex; gap: 2px; }
.rating-dots i { width: 10px; height: 10px; border: 1px solid var(--green); border-radius: 50%; background: var(--green); }
.rating-dots i.hollow { background: transparent; }
.rating-row strong { font-size: 11px; }
.rating-row > span:last-child { color: var(--muted); font-size: 10px; }
.spot-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.spot-meta span { padding: 5px 7px; border-radius: 4px; color: #47534c; font-size: 10px; background: var(--soft); }
.risk-low { color: #08744f !important; }
.risk-medium { color: #8a6210 !important; }
.risk-high { color: var(--danger) !important; }

.trust-strip { display: grid; grid-template-columns: repeat(3, 1fr); width: min(1280px, calc(100% - 48px)); margin: 12px auto 80px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.trust-strip article { display: flex; align-items: center; gap: 15px; min-height: 112px; padding: 20px 28px; }
.trust-strip article + article { border-left: 1px solid var(--line); }
.trust-strip svg { flex: 0 0 auto; color: var(--green); }
.trust-strip article div { display: grid; gap: 4px; }
.trust-strip strong { font-size: 13px; }
.trust-strip span { color: var(--muted); font-size: 10px; line-height: 1.6; }

.planner-section { padding: 92px 24px; background: #e9f3ee; }
.planner-inner { display: grid; grid-template-columns: 0.72fr 1.28fr; gap: 68px; width: min(1280px, 100%); margin: 0 auto; }
.planner-copy { align-self: center; }
.section-label { color: var(--green); font-size: 12px; font-weight: 750; }
.planner-copy h2, .product-heading h2 { margin: 13px 0 19px; font-size: 40px; line-height: 1.2; text-wrap: balance; }
.planner-copy > p { max-width: 52ch; margin: 0; color: #536159; font-size: 13px; line-height: 1.8; }
.planner-query { display: flex; align-items: flex-start; gap: 10px; margin-top: 26px; padding: 15px 16px; border-radius: 7px; color: #254238; background: rgba(255,255,255,0.7); }
.planner-query svg { flex: 0 0 auto; margin-top: 2px; color: var(--green); }
.planner-query span { font-size: 12px; line-height: 1.7; }
.planner-options { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
.planner-options button { height: 34px; padding: 0 11px; border: 1px solid #b9c9c0; border-radius: 17px; color: #4e6057; font-size: 11px; background: transparent; cursor: pointer; transition: color 180ms ease, background 180ms ease, border-color 180ms ease; }
.planner-options button.active { border-color: var(--green); color: #fff; background: var(--green); }
.generate-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-width: 180px; height: 46px; margin-top: 21px; padding: 0 17px; border: 0; border-radius: 7px; color: #fff; font-size: 12px; font-weight: 750; background: var(--ink); cursor: pointer; transition: background 180ms ease, transform 180ms ease; }
.generate-button:hover { background: var(--green-dark); transform: translateY(-1px); }
.generate-button:disabled { cursor: wait; opacity: 0.75; }
.button-loader { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; }

.route-result { overflow: hidden; border-radius: 8px; background: #fff; box-shadow: 0 10px 0 rgba(7, 88, 63, 0.08); transition: opacity 180ms ease; }
.route-result.loading { opacity: 0.68; }
.route-map { position: relative; height: 350px; overflow: hidden; background: #304d3f; }
.route-map > img { width: 100%; height: 100%; object-fit: cover; filter: saturate(0.63) contrast(1.03) brightness(0.75); }
.route-map > svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.route-map path { fill: none; vector-effect: non-scaling-stroke; }
.route-halo { stroke: rgba(255,255,255,0.8); stroke-width: 6; }
.route-line { stroke: #77f0b8; stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 8 8; animation: moveRoute 11s linear infinite; }
.route-pin { position: absolute; display: grid; justify-items: center; padding: 0; border: 0; color: #fff; background: transparent; transform: translate(-50%, -50%); cursor: pointer; }
.route-pin span { display: grid; place-items: center; width: 29px; height: 29px; border: 3px solid #d8ffed; border-radius: 50%; color: #082a1e; font-size: 11px; font-weight: 800; background: #79efb8; box-shadow: 0 0 0 6px rgba(121,239,184,0.15); }
.route-pin em { margin-top: 6px; padding: 4px 6px; border-radius: 4px; color: #fff; font-size: 9px; font-style: normal; white-space: nowrap; background: rgba(6,25,18,0.84); }
.route-status { position: absolute; right: 14px; bottom: 13px; display: flex; align-items: center; gap: 7px; padding: 8px 10px; border-radius: 5px; color: #e4f3ec; font-size: 9px; background: rgba(6,25,18,0.8); }
.route-status i { width: 7px; height: 7px; border-radius: 50%; background: #55dc9b; box-shadow: 0 0 0 4px rgba(85,220,155,0.16); }
.route-summary { padding: 21px 22px 22px; }
.summary-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.summary-head small { color: var(--green); font-size: 9px; font-weight: 700; }
.summary-head h3 { margin: 4px 0 0; font-size: 17px; }
.summary-head > span { padding: 6px 8px; border-radius: 4px; color: #4a5a52; font-size: 9px; background: var(--soft); }
.route-stops { display: flex; gap: 6px; margin-top: 17px; overflow-x: auto; }
.route-stops button { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 7px; flex: 0 0 auto; min-width: 102px; padding: 9px; border: 1px solid var(--line); border-radius: 6px; text-align: left; background: #fff; cursor: pointer; transition: border-color 180ms ease, background 180ms ease; }
.route-stops button.active { border-color: var(--green); background: #f0f9f5; }
.route-stops button > span { grid-row: 1 / 3; display: grid; place-items: center; width: 21px; height: 21px; border-radius: 50%; color: #fff; font-size: 9px; background: var(--green); }
.route-stops strong { font-size: 9px; white-space: nowrap; }
.route-stops em { font-size: 8px; font-style: normal; }
.decision-note { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 11px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.decision-note > svg { color: var(--green); }
.decision-note p { display: grid; gap: 3px; margin: 0; color: var(--muted); font-size: 9px; line-height: 1.5; }
.decision-note p strong { color: var(--ink); font-size: 10px; }
.decision-note a { display: inline-flex; align-items: center; gap: 5px; color: var(--green); font-size: 9px; font-weight: 700; }

.audience-section { padding-top: 96px; padding-bottom: 108px; }
.audience-grid { display: grid; grid-template-columns: 1.15fr 0.85fr 0.85fr; grid-template-rows: 230px 230px; gap: 8px; }
.audience-grid button { position: relative; overflow: hidden; padding: 0; border: 0; text-align: left; background: #dce3df; cursor: pointer; }
.audience-grid button:first-child { grid-row: 1 / 3; }
.audience-grid button:last-child { grid-column: 2 / 4; }
.audience-grid img { width: 100%; height: 100%; object-fit: cover; transition: transform 520ms cubic-bezier(.2,.75,.2,1), filter 520ms ease; }
.audience-grid button:hover img { filter: saturate(1.1); transform: scale(1.04); }
.audience-copy { position: absolute; right: 22px; bottom: 20px; left: 22px; display: grid; color: #fff; }
.audience-copy svg { margin-bottom: 10px; }
.audience-copy strong { font-size: 21px; }
.audience-copy small { margin-top: 4px; color: #dbe9e2; font-size: 10px; }
.audience-grid button:first-child .audience-copy strong { font-size: 28px; }

.product-section { display: grid; grid-template-columns: 0.55fr 1.45fr; gap: 54px; align-items: center; padding: 96px max(24px, calc((100vw - 1280px) / 2)); color: #ecf4f0; background: #11271e; }
.product-heading h2 { font-size: 35px; }
.product-heading > p { margin: 0; color: #a7bab1; font-size: 12px; line-height: 1.8; }
.product-heading > a { display: inline-flex; align-items: center; gap: 8px; height: 43px; margin-top: 24px; padding: 0 14px; border-radius: 6px; color: #09271b; font-size: 11px; font-weight: 750; background: var(--mint); transition: transform 180ms ease, background 180ms ease; }
.product-heading > a:hover { background: #b2f5d9; transform: translateY(-1px); }
.product-frame { overflow: hidden; border-radius: 8px; background: #06110e; box-shadow: 0 18px 48px rgba(0,0,0,0.24); }
.frame-toolbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 39px; padding: 0 12px; color: #a9b9b2; background: #0a1813; }
.frame-toolbar > span { display: flex; gap: 5px; }
.frame-toolbar i { width: 7px; height: 7px; border-radius: 50%; background: #4d6057; }
.frame-toolbar i:first-child { background: #d16a63; }
.frame-toolbar i:nth-child(2) { background: #cda64e; }
.frame-toolbar i:last-child { background: #5ebd8a; }
.frame-toolbar strong { font-size: 8px; font-weight: 500; }
.frame-toolbar a { justify-self: end; }
.product-frame iframe { display: block; width: 100%; aspect-ratio: 16 / 9; border: 0; }

.closing-section { position: relative; display: grid; align-items: end; min-height: 540px; overflow: hidden; padding: 72px max(24px, calc((100vw - 1280px) / 2)); color: #fff; }
.closing-section > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.closing-section .image-shade { background: linear-gradient(90deg, rgba(5,23,16,0.76), rgba(5,23,16,0.08) 75%), linear-gradient(180deg, transparent 40%, rgba(5,23,16,0.58)); }
.closing-section > div { position: relative; z-index: 2; max-width: 670px; }
.closing-section small { color: #bcd5ca; font-size: 10px; }
.closing-section h2 { margin: 12px 0 25px; font-size: 43px; line-height: 1.2; text-wrap: balance; }
.closing-section a { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 14px; border-radius: 6px; color: var(--ink); font-size: 11px; font-weight: 750; background: #fff; }

footer { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: min(1280px, calc(100% - 48px)); min-height: 126px; margin: 0 auto; }
.footer-brand { display: flex; align-items: center; gap: 10px; }
.footer-brand .brand-mark { width: 34px; height: 34px; font-size: 14px; }
.footer-brand > div { display: grid; }
.footer-brand strong { font-size: 12px; }
.footer-brand small, footer > p { color: var(--muted); font-size: 8px; }
.footer-links { display: flex; gap: 18px; justify-self: end; font-size: 10px; }

.spot-dialog { width: min(880px, calc(100% - 32px)); max-height: calc(100dvh - 40px); padding: 0; overflow: auto; border: 0; border-radius: 8px; color: var(--ink); background: #fff; box-shadow: 0 24px 70px rgba(0,0,0,0.32); }
.spot-dialog::backdrop { background: rgba(6, 17, 12, 0.7); backdrop-filter: blur(5px); }
.dialog-close { position: absolute; z-index: 3; top: 12px; right: 12px; display: grid; place-items: center; width: 39px; height: 39px; padding: 0; border: 0; border-radius: 50%; background: rgba(255,255,255,0.94); cursor: pointer; }
.dialog-photo { height: 340px; }
.dialog-photo img { width: 100%; height: 100%; object-fit: cover; }
.dialog-content { padding: 27px 30px 31px; }
.dialog-content > p:first-child { margin: 0; color: var(--green); font-size: 11px; font-weight: 700; }
.dialog-content h2 { margin: 5px 0 13px; font-size: 30px; }
.dialog-score { display: flex; align-items: baseline; gap: 7px; }
.dialog-score strong { font-size: 22px; }
.dialog-score span { color: var(--muted); font-size: 9px; }
.dialog-score i { width: 1px; height: 19px; margin: 0 8px; background: var(--line); }
.dialog-description { max-width: 68ch; margin: 18px 0 0; color: var(--muted); font-size: 12px; line-height: 1.8; }
.dialog-facts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.dialog-facts span { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 5px; color: #435148; font-size: 10px; background: var(--soft); }
.dialog-advice { display: flex; align-items: flex-start; gap: 10px; margin-top: 20px; padding: 15px; border-radius: 6px; color: #2d493d; background: #eaf6f0; }
.dialog-advice svg { flex: 0 0 auto; color: var(--green); }
.dialog-advice p { display: grid; gap: 4px; margin: 0; font-size: 10px; line-height: 1.65; }
.dialog-advice strong { font-size: 11px; }
.dialog-content > button { display: inline-flex; align-items: center; gap: 8px; height: 43px; margin-top: 22px; padding: 0 14px; border: 0; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 750; background: var(--green); cursor: pointer; }

button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid rgba(10,123,87,0.32); outline-offset: 3px; }
@keyframes moveRoute { to { stroke-dashoffset: -220; } }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 1040px) {
  .header-inner { grid-template-columns: 1fr auto; }
  .site-header nav { display: none; }
  .hero-mosaic { height: 390px; }
  .spot-card { flex-basis: calc((100% - 36px) / 3); }
  .planner-inner { grid-template-columns: 1fr; gap: 42px; }
  .product-section { grid-template-columns: 1fr; }
  .product-heading { max-width: 650px; }
}

@media (max-width: 760px) {
  .header-inner, .search-hero, .content-section, .trust-strip, footer { width: min(100% - 32px, 1280px); }
  .header-inner { height: 64px; }
  .brand-copy small { display: none; }
  .product-entry { min-height: 37px; padding: 0 11px; font-size: 11px; }
  .search-hero { padding: 42px 0 58px; }
  .hero-intro h1 { font-size: 38px; }
  .hero-intro > span { font-size: 13px; }
  .search-box { grid-template-columns: auto 1fr; min-height: 58px; padding: 6px 13px 6px 17px; border-radius: 29px; }
  .search-box input { height: 42px; padding-right: 0; font-size: 12px; }
  .search-box button { grid-column: 1 / -1; width: 100%; height: 43px; margin-top: 7px; border-radius: 7px; }
  .quick-searches > span { width: 100%; text-align: center; }
  .hero-mosaic { grid-template-columns: 1fr 1fr; grid-template-rows: 280px 160px; height: auto; margin-top: 33px; }
  .hero-mosaic .mosaic-feature { grid-column: 1 / -1; grid-row: auto; }
  .mosaic-copy { right: 15px; bottom: 14px; left: 15px; }
  .mosaic-feature .mosaic-copy { right: 19px; bottom: 18px; left: 19px; }
  .mosaic-feature .mosaic-copy strong { font-size: 29px; }
  .mosaic-copy strong { font-size: 17px; }
  .content-section { padding: 62px 0; }
  .section-title { align-items: flex-start; }
  .section-title h2 { font-size: 26px; }
  .section-title p { max-width: 260px; font-size: 11px; line-height: 1.6; }
  .spot-card { flex-basis: 75vw; min-width: 240px; }
  .trust-strip { grid-template-columns: 1fr; margin-bottom: 62px; }
  .trust-strip article { min-height: 92px; padding: 17px 8px; }
  .trust-strip article + article { border-top: 1px solid var(--line); border-left: 0; }
  .planner-section { padding: 70px 16px; }
  .planner-copy h2, .product-heading h2 { font-size: 32px; }
  .route-map { height: 285px; }
  .route-pin em { display: none; }
  .decision-note { grid-template-columns: auto 1fr; }
  .decision-note a { grid-column: 2; }
  .audience-grid { grid-template-columns: 1fr 1fr; grid-template-rows: repeat(3, 190px); }
  .audience-grid button:first-child { grid-column: 1 / -1; grid-row: auto; }
  .audience-grid button:last-child { grid-column: 1 / -1; }
  .product-section { padding-top: 72px; padding-bottom: 72px; }
  .frame-toolbar { grid-template-columns: 1fr auto; }
  .frame-toolbar strong { display: none; }
  .product-frame iframe { aspect-ratio: 9 / 13; }
  .closing-section { min-height: 480px; padding-bottom: 48px; }
  .closing-section h2 { font-size: 34px; }
  footer { grid-template-columns: 1fr auto; min-height: 110px; }
  footer > p { display: none; }
  .dialog-photo { height: 245px; }
  .dialog-content { padding: 22px 20px 25px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
</style>
