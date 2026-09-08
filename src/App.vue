<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Icon from './components/Icon.vue'
const router = useRouter(), route = useRoute()

// 一级标签（底部）
const primaryTabs = [
  { group: 'ride', label: '骑行', icon: 'bike' },
  { group: 'travel', label: '旅行', icon: 'plane' },
]

// 二级标签（顶部，按组配置）
const subTabsMap = {
  ride: [
    { path: '/explore', label: '路线探索', icon: 'compass' },
    { path: '/preset', label: '经典路线', icon: 'map' },
  ],
  travel: [
    { path: '/travel', label: '旅行攻略', icon: 'plane' },
  ],
}

const currentGroup = computed(() => route.meta.group || 'ride')
const subTabs = computed(() => subTabsMap[currentGroup.value] || [])

// 记住骑行组上次所在的子页面
const lastRidePath = ref('/explore')
watch(() => route.path, (p) => {
  if (route.meta.group === 'ride') lastRidePath.value = p
}, { immediate: true })

function switchGroup(group) {
  if (group === currentGroup.value) return
  if (group === 'ride') router.push(lastRidePath.value)
  else router.push('/travel')
}

const toast = ref({ show: false, msg: '', type: '' }); let tt = null
function showToast(msg, type = '') { toast.value = { show: true, msg, type }; clearTimeout(tt); tt = setTimeout(() => { toast.value.show = false }, 2200) }
router.isReady().then(() => { window.$toast = showToast })
</script>
<template>
<div class="app" :data-theme="currentGroup">
  <!-- 顶部：Logo + 二级标签 -->
  <header class="top-bar">
    <div class="logo-row">
      <div class="logo-badge">
        <Icon :name="currentGroup === 'ride' ? 'bike' : 'plane'" :size="20" />
      </div>
      <div class="logo-text">
        <h1>漫途</h1>
        <p class="subtitle">{{ currentGroup === 'ride' ? '探索骑行路线' : '旅行攻略规划' }}</p>
      </div>
    </div>
    <nav v-if="subTabs.length > 1" class="sub-tab-bar">
      <button v-for="t in subTabs" :key="t.path"
        :class="['sub-tab', { active: route.path === t.path }]"
        @click="router.push(t.path)">
        <Icon :name="t.icon" :size="14" />{{ t.label }}
      </button>
    </nav>
  </header>

  <main class="content"><router-view /></main>

  <div :class="['toast', { show: toast.show }, toast.type]">{{ toast.msg }}</div>

  <!-- 底部：一级标签 -->
  <nav class="bottom-bar">
    <button v-for="t in primaryTabs" :key="t.group"
      :class="['bottom-tab', { active: currentGroup === t.group }]"
      @click="switchGroup(t.group)">
      <Icon :name="t.icon" :size="21" />
      <span class="bt-label">{{ t.label }}</span>
    </button>
  </nav>
</div>
</template>
<style>
/* ============================================================
   漫途 Design System v2 — 专业版
   原则: 中性灰阶承载信息，主题色只做引导；
        1px 描边 + 极浅阴影；无渐变、无弹跳动画、无装饰 emoji。
   间距: 4/8/12/16/20/24/32/40px   圆角: 8/10/12px
   ============================================================ */

/* ===== 主题变量 ===== */
.app[data-theme="ride"]{
  --accent:#0d7a57;--accent-hover:#0a6447;--accent-soft:#eef6f2;--accent-tint:rgba(13,122,87,.12);
  --accent-rgb:13,122,87;--accent-2-rgb:13,122,87;
}
.app[data-theme="travel"]{
  --accent:#4f46e5;--accent-hover:#4338ca;--accent-soft:#eef0fd;--accent-tint:rgba(79,70,229,.12);
  --accent-rgb:79,70,229;--accent-2-rgb:79,70,229;
}
.app{
  /* 中性灰阶（所有主题共用） */
  --ink-900:#16181d;--ink-700:#333a45;--ink-600:#4b5563;--ink-400:#8a919e;
  --ink-300:#b4bac4;--line:#e6e8ec;--line-strong:#d5d9e0;
  --surface:#ffffff;--surface-2:#f5f6f8;
  --ok:#0d7a57;--warn:#b45309;--err:#dc2626;
}

*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,'Segoe UI','PingFang SC','Noto Sans SC',sans-serif;
  background:#eceef1;color:var(--ink-900);min-height:100vh;
  -webkit-tap-highlight-color:transparent;
  -webkit-font-smoothing:antialiased;
}
.app{
  max-width:480px;margin:0 auto;min-height:100vh;
  background:var(--surface-2);
  padding-bottom:72px;
  position:relative;
}

/* ===== 顶部栏 ===== */
.top-bar{
  padding:14px 16px 0;
  position:sticky;top:0;z-index:30;
  background:rgba(255,255,255,.92);
  backdrop-filter:blur(16px) saturate(160%);
  -webkit-backdrop-filter:blur(16px) saturate(160%);
  border-bottom:1px solid var(--line);
}
.logo-row{display:flex;align-items:center;gap:11px;padding-bottom:12px}
.logo-badge{
  width:38px;height:38px;border-radius:10px;
  background:var(--accent);
  color:#fff;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;
}
.logo-text h1{
  font-size:18px;font-weight:700;letter-spacing:.2px;
  color:var(--ink-900);
  line-height:1.2;
}
.subtitle{color:var(--ink-400);font-size:11px;margin-top:1px;font-weight:500}

/* 二级标签（分段控件） */
.sub-tab-bar{display:flex;gap:2px;margin:0 -2px;padding-bottom:8px}
.sub-tab{
  flex:1;border:none;border-radius:8px;padding:7px 4px;
  font-size:13px;font-weight:600;font-family:inherit;
  background:transparent;color:var(--ink-400);
  cursor:pointer;
  transition:color .15s, background .15s;
  white-space:nowrap;
  display:flex;align-items:center;justify-content:center;gap:5px;
}
.sub-tab.active{
  background:var(--surface-2);
  color:var(--ink-900);
  font-weight:600;
}
.sub-tab:active{background:var(--accent-tint)}

/* ===== 底部一级标签 ===== */
.bottom-bar{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;display:flex;
  background:rgba(255,255,255,.95);
  backdrop-filter:blur(16px) saturate(160%);
  -webkit-backdrop-filter:blur(16px) saturate(160%);
  border-top:1px solid var(--line);
  z-index:40;
  padding-bottom:env(safe-area-inset-bottom,0);
}
.bottom-tab{
  flex:1;border:none;background:transparent;
  padding:9px 0 8px;
  display:flex;flex-direction:column;align-items:center;gap:3px;
  cursor:pointer;transition:color .15s;position:relative;
  font-family:inherit;color:var(--ink-400);
}
.bottom-tab .bt-label{
  font-size:10.5px;font-weight:600;letter-spacing:.3px;
}
.bottom-tab.active{color:var(--accent)}
.bottom-tab:active{opacity:.7}

/* ============================================================
   通用组件
   ============================================================ */

.content{padding:0 14px}

/* 卡片 */
.card{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:12px;
  padding:16px;
  margin:12px 0;
  box-shadow:0 1px 2px rgba(22,24,29,.03);
}
.card h2{
  font-size:14px;font-weight:700;
  margin-bottom:12px;color:var(--ink-900);
  display:flex;align-items:center;gap:6px;
}

/* 行布局 */
.row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.row label{font-size:13px;white-space:nowrap;min-width:32px;color:var(--ink-400);font-weight:600}

/* 输入框 */
input,select{
  background:var(--surface-2);color:var(--ink-900);
  border:1px solid var(--line);
  border-radius:10px;
  padding:10px 12px;font-size:14px;width:100%;
  font-family:inherit;
  transition:border-color .15s, background .15s, box-shadow .15s;
}
input::placeholder{color:var(--ink-300)}
input:focus,select:focus{
  outline:none;
  background:var(--surface);
  border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-tint);
}
select{
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238a919e' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;
  padding-right:34px;
}

/* 按钮 */
.btn{
  display:block;width:100%;border:none;
  border-radius:10px;padding:12px;font-size:15px;font-weight:600;
  font-family:inherit;cursor:pointer;text-align:center;
  transition:background .15s, opacity .15s, transform .1s;
}
.btn:active{transform:scale(.98)}
.btn-primary{
  background:var(--accent);color:#fff;
}
.btn-primary:hover{background:var(--accent-hover)}
.btn-primary:disabled{opacity:.45;pointer-events:none}
.btn-secondary{background:var(--surface-2);color:var(--ink-600);border:1px solid var(--line)}
.btn-sm{
  width:auto;display:inline-block;
  padding:7px 14px;font-size:12px;border-radius:8px;font-weight:600;
  border:1px solid var(--line);cursor:pointer;font-family:inherit;
  transition:all .15s;text-align:center;
  background:var(--surface);color:var(--ink-600);
}
.btn-sm:active{transform:scale(.96)}
.btn-row{display:flex;gap:8px;margin-top:12px}
.btn-row .btn{flex:1}

/* 统计指标 */
.stats{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.stat{
  flex:1;min-width:60px;
  background:var(--surface-2);
  border:1px solid var(--line);
  border-radius:10px;padding:12px 4px 10px;text-align:center;
  font-variant-numeric:tabular-nums;
}
.stat .val{font-size:20px;font-weight:700;color:var(--ink-900);letter-spacing:-.3px}
.stat .val.small{font-size:15px}
.stat .lbl{font-size:10px;color:var(--ink-400);margin-top:3px;font-weight:500}

/* Toast */
.toast{
  position:fixed;top:18px;left:50%;
  transform:translateX(-50%) translateY(-80px);
  background:var(--ink-900);color:#fff;padding:10px 20px;border-radius:10px;
  font-weight:500;font-size:13px;z-index:99;
  opacity:0;
  transition:all .25s ease;
  pointer-events:none;
  box-shadow:0 8px 24px rgba(22,24,29,.25);
  max-width:86%;
  text-align:center;
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.warn{background:#92400e}
.toast.err{background:#991b1b}

/* Loading */
.loading-overlay{text-align:center;padding:24px 16px}
.loading-hint{font-size:13px;color:var(--ink-400);margin-top:12px;font-weight:500}
.progress-ring{position:relative;width:64px;height:64px;margin:0 auto}
.progress-ring svg{transform:rotate(-90deg)}
.progress-ring .bg{fill:none;stroke:var(--line);stroke-width:5}
.progress-ring .fg{fill:none;stroke:var(--accent);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .3s}
.progress-ring .txt{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:700;color:var(--ink-900);
  font-variant-numeric:tabular-nums;
}
.try-count{font-size:11px;color:var(--ink-300);margin-top:4px}
.retry-dots{display:flex;gap:4px;justify-content:center;margin-top:10px}
.retry-dot{width:7px;height:7px;border-radius:50%;background:var(--line-strong);transition:all .2s}
.retry-dot.ok{background:var(--ok)}
.retry-dot.bad{background:#d97706}
.retry-dot.current{background:var(--accent);transform:scale(1.25);animation:pulse .6s ease-in-out infinite alternate}
@keyframes pulse{from{opacity:.55}to{opacity:1}}

/* 搜索建议下拉 */
.suggest-drop{
  position:absolute;top:100%;left:0;right:0;
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:10px;
  max-height:220px;overflow-y:auto;z-index:50;
  box-shadow:0 8px 24px rgba(22,24,29,.10);
  padding:4px;
}
.suggest-item{
  padding:10px 12px;font-size:12px;cursor:pointer;
  border-radius:8px;
  display:flex;justify-content:space-between;align-items:center;
  transition:background .12s;
}
.suggest-item:hover{background:var(--surface-2)}
.suggest-item .s-name{color:var(--ink-900);flex:1;font-weight:500}
.suggest-item .s-dist{color:var(--ink-300);font-size:10px;margin-left:8px}

/* 空状态 */
.empty-state{text-align:center;padding:28px;color:var(--ink-300);font-size:13px}

/* 补给点标签 */
.supply-chips{display:flex;flex-wrap:wrap;gap:4px}
.supply-chip{
  display:inline-block;
  background:var(--surface-2);color:var(--ink-600);
  border:1px solid var(--line);border-radius:7px;
  padding:4px 10px;font-size:10px;white-space:nowrap;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;
  cursor:pointer;transition:all .15s;font-weight:500;
}
.supply-chip.active,.supply-chip:active{
  background:var(--accent);border-color:var(--accent);color:#fff;
}
.btn-supply{
  background:var(--surface);color:var(--ink-700);
  border:1px solid var(--line);
  margin-bottom:8px;
}
.btn-supply:disabled{opacity:.5;pointer-events:none}

/* 坡度信息 */
.slope-box{margin-top:10px;padding:12px 14px;border-radius:10px}
.slope-box.uphill{background:#fef6f3;border:1px solid #f5dccd}
.slope-box.downhill{background:#f2f9f5;border:1px solid #d3ecdd}
.slope-title{font-size:12px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:5px}
.slope-box.uphill .slope-title{color:#b45309}
.slope-box.downhill .slope-title{color:#0d7a57}
.slope-item{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px}
.slope-box.uphill .slope-item{border-bottom:1px dashed #f0e0d2}
.slope-box.downhill .slope-item{border-bottom:1px dashed #dcefe3}
.slope-item:last-child{border-bottom:none}
.slope-badge{font-weight:600;white-space:nowrap;font-size:11px;font-variant-numeric:tabular-nums}
.slope-badge.moderate{color:#c2620a}
.slope-badge.steep{color:#dc2626}
.slope-data{font-weight:600;color:var(--ink-700);white-space:nowrap;font-variant-numeric:tabular-nums}
.slope-grade{color:var(--ink-400);font-size:10px;white-space:nowrap;margin-left:auto;font-variant-numeric:tabular-nums}

/* 方向/时长 chips */
.compass-row{display:flex;flex-wrap:wrap;gap:4px}
.chip{
  border:1px solid var(--line);
  background:var(--surface);border-radius:8px;
  padding:7px 12px;font-size:12px;font-weight:500;
  color:var(--ink-600);cursor:pointer;
  transition:all .15s;white-space:nowrap;font-family:inherit;
}
.chip:hover{border-color:var(--line-strong);color:var(--ink-900)}
.chip.active{
  background:var(--ink-900);border-color:var(--ink-900);
  color:#fff;font-weight:600;
}
.chip:active{transform:scale(.97)}

/* 罗盘网格 */
.compass-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-width:240px;margin:0 auto}
.compass-btn{
  border:1px solid var(--line);border-radius:10px;
  padding:10px 4px;font-size:13px;font-weight:500;
  background:var(--surface);color:var(--ink-600);cursor:pointer;
  transition:all .15s;text-align:center;font-family:inherit;
}
.compass-btn.center{font-size:16px;padding:12px 4px}
.compass-btn.active{
  background:var(--ink-900);border-color:var(--ink-900);
  color:#fff;font-weight:600;
}
.compass-btn:active{transform:scale(.95)}

/* 多路线卡片 */
.multi-cards{display:flex;gap:8px;overflow-x:auto;padding:4px 0;margin-bottom:12px;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory}
.multi-card{
  flex:0 0 85%;scroll-snap-align:start;
  background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;
  cursor:pointer;transition:all .15s;
  box-shadow:0 1px 2px rgba(22,24,29,.03);
}
.multi-card.active{
  border-color:var(--accent);
  box-shadow:0 0 0 3px var(--accent-tint);
}
.multi-card .route-thumb{width:100%}

/* 路线质量标签 */
.quality-tags{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}
.qtag{font-size:10px;font-weight:600;padding:3px 8px;border-radius:5px;background:var(--surface-2);color:var(--ink-600);border:1px solid var(--line)}

/* 折叠面板通用 */
.collapse-toggle{
  display:flex;align-items:center;gap:6px;
  padding:10px 0;font-size:12px;font-weight:600;
  color:var(--ink-400);cursor:pointer;user-select:none;
  transition:color .15s;
}
.collapse-toggle:hover{color:var(--ink-900)}
.collapse-toggle .arrow{transition:transform .2s;font-size:9px;display:inline-flex}
.collapse-toggle.open .arrow{transform:rotate(90deg)}
.collapse-body{display:none}
.collapse-body.open{display:block}

/* 分段详情 */
.segments{margin-top:8px}
.seg{
  display:flex;justify-content:space-between;align-items:center;
  padding:6px 0;border-bottom:1px solid var(--line);
  font-size:11px;
}
.seg:last-child{border:none}
.seg-detail{color:var(--ink-600);flex:1}
.seg-nums{color:var(--ink-400);white-space:nowrap;margin-left:8px;font-weight:500;font-variant-numeric:tabular-nums}

/* 导航链接框 */
.nav-link-box{
  margin-top:8px;padding:10px 12px;
  background:var(--surface-2);border-radius:10px;
  border:1px solid var(--line);
}
.nav-link-box .label{font-size:10px;color:var(--ink-400);margin-bottom:4px}
.nav-link-box .url{font-size:10px;color:var(--accent);word-break:break-all;line-height:1.4}

/* 路线缩略图图例 */
.route-thumb-legend{
  display:flex;gap:10px;flex-wrap:wrap;align-items:center;
  margin:8px 0 4px;font-size:10px;color:var(--ink-400);
}
.legend-dot{
  display:inline-block;width:7px;height:7px;border-radius:50%;
  margin-right:3px;vertical-align:0;background:var(--dot,#8a919e);
}
.route-summary{
  font-size:12px;color:var(--ink-600);line-height:1.6;
  margin:8px 0;padding:10px 12px;
  background:var(--surface-2);border:1px solid var(--line);
  border-radius:10px;
}
.route-summary strong{color:var(--ink-900)}

/* 弹窗 */
.modal{
  position:fixed;inset:0;
  background:rgba(22,24,29,.5);
  backdrop-filter:blur(3px);
  -webkit-backdrop-filter:blur(3px);
  z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;
  animation:fadeIn .18s ease;
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal .inner{
  background:var(--surface);border-radius:14px;padding:20px;
  width:100%;max-width:440px;max-height:82vh;overflow-y:auto;
  box-shadow:0 16px 48px rgba(22,24,29,.22);
  animation:slideUp .22s ease;
}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal .inner h3{font-size:15px;font-weight:700;color:var(--ink-900)}
</style>
