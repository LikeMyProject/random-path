<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
const router = useRouter(), route = useRoute()

// 一级标签（底部）
const primaryTabs = [
  { group: 'ride', label: '骑行', icon: '🚴' },
  { group: 'travel', label: '旅行', icon: '✈️' },
]

// 二级标签（顶部，按组配置）
const subTabsMap = {
  ride: [
    { path: '/explore', label: '路线探索', icon: '🧭' },
    { path: '/preset', label: '经典路线', icon: '📚' },
  ],
  travel: [
    { path: '/travel', label: '旅行攻略', icon: '✈️' },
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
        <span class="logo-icon">{{ currentGroup === 'ride' ? '🚴' : '✈️' }}</span>
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
        <span class="sub-tab-icon">{{ t.icon }}</span>{{ t.label }}
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
      <span class="bt-icon">{{ t.icon }}</span>
      <span class="bt-label">{{ t.label }}</span>
    </button>
  </nav>
</div>
</template>
<style>
/* ============================================================
   漫途 Design System
   间距: 4/8/12/16/20/24/32/40px
   圆角: 8/12/16/20/24px
   阴影: sm(0 1px 3px) / md(0 4px 12px) / lg(0 8px 28px)
   ============================================================ */

/* ===== 主题变量 ===== */
.app[data-theme="ride"]{
  --accent:#0f6e56;--accent-2:#1a8a6e;--accent-soft:#e8f5f0;--accent-tint:rgba(15,110,86,.08);
  --accent-rgb:15,110,86;--accent-2-rgb:26,138,110;
  --bg-grad:linear-gradient(160deg,#eef5f2 0%,#e8f5f0 25%,#f0f6f4 55%,#f5f0f7 100%);
  --header-text:#0f6e56;--sub-text:#5a8076;
  --shadow-color:rgba(15,110,86,.10);
}
.app[data-theme="travel"]{
  --accent:#534ab7;--accent-2:#6d63d3;--accent-soft:#ede9fe;--accent-tint:rgba(83,74,183,.08);
  --accent-rgb:83,74,183;--accent-2-rgb:109,99,211;
  --bg-grad:linear-gradient(160deg,#f0edf7 0%,#ede9fe 25%,#f3f0fa 55%,#eef5f2 100%);
  --header-text:#534ab7;--sub-text:#6b6499;
  --shadow-color:rgba(83,74,183,.10);
}

*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:-apple-system,'Segoe UI','PingFang SC','Noto Sans SC',sans-serif;
  background:#eae6f0;color:#4a3f55;min-height:100vh;
  -webkit-tap-highlight-color:transparent;
  -webkit-font-smoothing:antialiased;
}
.app{
  max-width:480px;margin:0 auto;min-height:100vh;
  background:var(--bg-grad);background-attachment:fixed;
  padding-bottom:76px;
  transition:background .5s ease;
  position:relative;
}

/* ===== 顶部栏 ===== */
.top-bar{
  padding:14px 16px 0;
  position:sticky;top:0;z-index:30;
  background:rgba(255,255,255,.72);
  backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);
  border-bottom:1px solid rgba(var(--accent-rgb),.06);
}
.logo-row{display:flex;align-items:center;gap:12px}
.logo-badge{
  width:44px;height:44px;border-radius:14px;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 14px rgba(var(--accent-rgb),.30);
  flex-shrink:0;
}
.logo-icon{font-size:24px;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.logo-text h1{
  font-size:21px;font-weight:800;letter-spacing:-.5px;
  color:var(--header-text);
  transition:color .3s;
  line-height:1.2;
}
.subtitle{color:var(--sub-text);font-size:11px;margin-top:2px;font-weight:500;transition:color .3s}

/* 二级标签 */
.sub-tab-bar{display:flex;gap:4px;margin-top:12px;padding-bottom:10px}
.sub-tab{
  flex:1;border:none;border-radius:10px;padding:8px 4px;
  font-size:12px;font-weight:600;font-family:inherit;
  background:transparent;color:var(--sub-text);
  cursor:pointer;
  transition:all .25s cubic-bezier(.34,1.56,.64,1);
  white-space:nowrap;
  display:flex;align-items:center;justify-content:center;gap:4px;
  position:relative;
}
.sub-tab-icon{font-size:14px}
.sub-tab.active{
  background:rgba(var(--accent-rgb),.10);
  color:var(--accent);
  font-weight:700;
}
.sub-tab.active::after{
  content:'';position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);
  width:24px;height:2.5px;border-radius:2px;background:var(--accent);
}
.sub-tab:active{transform:scale(.95)}

/* ===== 底部一级标签 ===== */
.bottom-bar{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;display:flex;
  background:rgba(255,255,255,.88);
  backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);
  border-top:1px solid rgba(0,0,0,.05);
  box-shadow:0 -4px 24px rgba(0,0,0,.06);
  z-index:40;
  padding-bottom:env(safe-area-inset-bottom,0);
}
.bottom-tab{
  flex:1;border:none;background:transparent;
  padding:10px 0 8px;
  display:flex;flex-direction:column;align-items:center;gap:3px;
  cursor:pointer;transition:all .2s;position:relative;
  font-family:inherit;
}
.bottom-tab .bt-icon{
  font-size:22px;
  transition:transform .3s cubic-bezier(.34,1.56,.64,1);
  filter:grayscale(.3);
  opacity:.6;
}
.bottom-tab .bt-label{
  font-size:10.5px;font-weight:600;
  color:#a898b8;transition:color .2s;
  letter-spacing:.3px;
}
.bottom-tab.active .bt-icon{
  transform:translateY(-3px) scale(1.15);
  filter:grayscale(0);
  opacity:1;
}
.bottom-tab.active .bt-label{
  color:var(--accent);font-weight:700;
}
.bottom-tab.active::before{
  content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:32px;height:3.5px;border-radius:0 0 4px 4px;
  background:linear-gradient(90deg,var(--accent),var(--accent-2));
  box-shadow:0 2px 8px rgba(var(--accent-rgb),.35);
}
.bottom-tab:active{transform:scale(.92)}

/* ============================================================
   通用组件样式
   ============================================================ */

/* 内容容器 */
.content{padding:0 14px}

/* 卡片 */
.card{
  background:#fff;
  border-radius:18px;
  padding:18px 16px;
  margin:12px 0;
  box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px var(--shadow-color);
  border:none;
  animation:cardIn .35s cubic-bezier(.34,1.56,.64,1);
}
.card h2{
  font-size:15px;font-weight:700;
  margin-bottom:12px;color:#3a3045;
  display:flex;align-items:center;gap:6px;
}
@keyframes cardIn{
  from{opacity:0;transform:translateY(12px) scale(.97)}
  to{opacity:1;transform:translateY(0) scale(1)}
}

/* 行布局 */
.row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.row label{font-size:13px;white-space:nowrap;min-width:32px;color:#8a8098;font-weight:600}

/* 输入框 */
input,select{
  background:#f7f5fa;color:#4a3f55;
  border:2px solid transparent;
  border-radius:12px;
  padding:11px 14px;font-size:14px;width:100%;
  font-family:inherit;
  transition:all .2s;
}
input::placeholder{color:#c4b5d0}
input:focus,select:focus{
  outline:none;
  background:#fff;
  border-color:var(--accent);
  box-shadow:0 0 0 4px var(--accent-tint);
}
select{
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23a898b8' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 14px center;
  padding-right:36px;
}

/* 按钮 */
.btn{
  display:block;width:100%;border:none;
  border-radius:14px;padding:13px;font-size:15px;font-weight:700;
  font-family:inherit;cursor:pointer;text-align:center;
  transition:all .2s;
}
.btn:active{transform:scale(.96)}
.btn-primary{
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  color:#fff;
  box-shadow:0 4px 14px rgba(var(--accent-rgb),.28);
}
.btn-primary:disabled{opacity:.5;pointer-events:none}
.btn-secondary{background:#f0edf5;color:#7a6c8a}
.btn-sm{
  width:auto;display:inline-block;
  padding:7px 14px;font-size:11px;border-radius:10px;font-weight:600;
  border:none;cursor:pointer;font-family:inherit;
  transition:all .2s;text-align:center;
}
.btn-sm:active{transform:scale(.95)}

/* 统计指标 */
.stats{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.stat{
  flex:1;min-width:60px;
  background:linear-gradient(135deg,var(--accent-soft),rgba(247,245,250,.5));
  border-radius:14px;padding:12px 4px;text-align:center;
  border:none;
  position:relative;overflow:hidden;
}
.stat::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--accent),var(--accent-2));
  opacity:.5;
}
.stat .val{font-size:20px;font-weight:800;color:var(--accent);letter-spacing:-.5px}
.stat .lbl{font-size:10px;color:#a898b8;margin-top:3px;font-weight:600}

/* Toast */
.toast{
  position:fixed;top:18px;left:50%;
  transform:translateX(-50%) translateY(-100px);
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  color:#fff;padding:10px 22px;border-radius:22px;
  font-weight:700;font-size:13px;z-index:99;
  opacity:0;
  transition:all .35s cubic-bezier(.34,1.56,.64,1);
  pointer-events:none;
  box-shadow:0 8px 28px rgba(var(--accent-rgb),.35);
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.warn{background:linear-gradient(135deg,#f0a870,#e89550);box-shadow:0 8px 28px rgba(240,168,112,.35)}
.toast.err{background:linear-gradient(135deg,#ff5252,#d32f2f);box-shadow:0 8px 28px rgba(255,82,82,.35)}

/* Loading */
.loading-overlay{text-align:center;padding:24px 16px}
.loading-hint{font-size:13px;color:#8a8098;margin-top:12px;font-weight:600}
.progress-ring{position:relative;width:64px;height:64px;margin:0 auto}
.progress-ring svg{transform:rotate(-90deg)}
.progress-ring .bg{fill:none;stroke:var(--accent-soft);stroke-width:5}
.progress-ring .fg{fill:none;stroke:var(--accent);stroke-width:5;stroke-linecap:round;transition:stroke-dashoffset .3s}
.progress-ring .txt{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:800;color:var(--accent);
}
.try-count{font-size:11px;color:#b0a3bc;margin-top:4px}
.retry-dots{display:flex;gap:4px;justify-content:center;margin-top:10px}
.retry-dot{width:7px;height:7px;border-radius:50%;background:#e5dcec;transition:all .2s}
.retry-dot.ok{background:var(--accent);transform:scale(1.1)}
.retry-dot.bad{background:#f0a870}
.retry-dot.current{background:var(--accent-2);transform:scale(1.3);animation:pulse .6s ease-in-out infinite alternate}
@keyframes pulse{from{opacity:.6}to{opacity:1}}

/* 搜索建议下拉 */
.suggest-drop{
  position:absolute;top:100%;left:0;right:0;
  background:#fff;border:none;border-radius:14px;
  max-height:220px;overflow-y:auto;z-index:50;
  box-shadow:0 12px 32px rgba(0,0,0,.12);
  padding:4px;
}
.suggest-item{
  padding:10px 14px;font-size:12px;cursor:pointer;
  border-radius:10px;
  display:flex;justify-content:space-between;align-items:center;
  transition:background .15s;
}
.suggest-item:hover{background:var(--accent-soft)}
.suggest-item .s-name{color:#4a3f55;flex:1;font-weight:500}
.suggest-item .s-dist{color:#b0a3bc;font-size:10px;margin-left:8px}

/* 空状态 */
.empty-state{text-align:center;padding:28px;color:#b0a3bc;font-size:13px}

/* 补给点标签 */
.supply-chips{display:flex;flex-wrap:wrap;gap:4px}
.supply-chip{
  display:inline-block;
  background:var(--accent-soft);color:var(--accent);
  border:none;border-radius:8px;
  padding:4px 10px;font-size:10px;white-space:nowrap;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;
  cursor:pointer;transition:all .2s;font-weight:600;
}
.supply-chip.active,.supply-chip:active{
  background:var(--accent);color:#fff;
  transform:scale(1.05);
}
.btn-supply{
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  color:#fff;
  box-shadow:0 4px 14px rgba(var(--accent-rgb),.25);
  margin-bottom:8px;
}
.btn-supply:disabled{opacity:.5;pointer-events:none}

/* 坡度信息 */
.slope-box{margin-top:10px;padding:12px 14px;border-radius:14px}
.slope-box.uphill{background:linear-gradient(135deg,#fff7ed,#fff0f0);border:1px solid rgba(254,215,170,.5)}
.slope-box.downhill{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid rgba(187,247,208,.5)}
.slope-title{font-size:12px;font-weight:700;margin-bottom:6px}
.slope-box.uphill .slope-title{color:#c2410c}
.slope-box.downhill .slope-title{color:#166534}
.slope-item{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px}
.slope-box.uphill .slope-item{border-bottom:1px dashed rgba(252,228,208,.6)}
.slope-box.downhill .slope-item{border-bottom:1px dashed rgba(187,247,208,.5)}
.slope-item:last-child{border-bottom:none}
.slope-badge{font-weight:700;white-space:nowrap;font-size:11px}
.slope-badge.moderate{color:#ea580c}
.slope-badge.steep{color:#dc2626}
.slope-data{font-weight:600;color:#5e5468;white-space:nowrap}
.slope-grade{color:#b0a3bc;font-size:10px;white-space:nowrap;margin-left:auto}

/* 方向/时长 chips */
.compass-row{display:flex;flex-wrap:wrap;gap:4px}
.chip{
  border:2px solid transparent;
  background:#f0edf5;border-radius:10px;
  padding:7px 12px;font-size:11px;font-weight:600;
  color:#7a6c8a;cursor:pointer;
  transition:all .2s;white-space:nowrap;font-family:inherit;
}
.chip.active{
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  color:#fff;
  box-shadow:0 3px 10px rgba(var(--accent-rgb),.25);
}
.chip:active{transform:scale(.94)}

/* 罗盘网格 */
.compass-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-width:240px;margin:0 auto}
.compass-btn{
  border:2px solid transparent;border-radius:14px;
  padding:10px 4px;font-size:13px;font-weight:600;
  background:#f0edf5;color:#7a6c8a;cursor:pointer;
  transition:all .2s;text-align:center;font-family:inherit;
}
.compass-btn.center{font-size:16px;padding:12px 4px}
.compass-btn.active{
  background:linear-gradient(135deg,var(--accent),var(--accent-2));
  color:#fff;
  box-shadow:0 3px 12px rgba(var(--accent-rgb),.28);
  transform:scale(1.05);
}
.compass-btn:active{transform:scale(.92)}

/* 多路线卡片 */
.multi-cards{display:flex;gap:8px;overflow-x:auto;padding:4px 0;margin-bottom:12px;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory}
.multi-card{
  flex:0 0 85%;scroll-snap-align:start;
  background:#fff;border-radius:16px;padding:12px;
  border:none;
  cursor:pointer;transition:all .2s;
  box-shadow:0 2px 10px rgba(0,0,0,.06);
}
.multi-card.active{
  box-shadow:0 0 0 2.5px var(--accent),0 4px 16px rgba(var(--accent-rgb),.18);
}
.multi-card .route-thumb{width:100%}

/* 路线质量标签 */
.quality-tags{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}
.qtag{font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:#f0fdf4;color:#166534;border:1px solid rgba(187,247,208,.6)}

/* 折叠面板通用 */
.collapse-toggle{
  display:flex;align-items:center;gap:6px;
  padding:10px 0;font-size:12px;font-weight:600;
  color:#8a8098;cursor:pointer;user-select:none;
  transition:color .15s;
}
.collapse-toggle:hover{color:var(--accent)}
.collapse-toggle .arrow{transition:transform .2s;font-size:9px}
.collapse-toggle.open .arrow{transform:rotate(90deg)}
.collapse-body{display:none}
.collapse-body.open{display:block}

/* 分段详情 */
.segments{margin-top:8px}
.seg{
  display:flex;justify-content:space-between;align-items:center;
  padding:6px 0;border-bottom:1px solid rgba(0,0,0,.04);
  font-size:11px;
}
.seg:last-child{border:none}
.seg-detail{color:#8a8098;flex:1}
.seg-nums{color:#7a6c8a;white-space:nowrap;margin-left:8px;font-weight:600}

/* 导航链接框 */
.nav-link-box{
  margin-top:8px;padding:10px 12px;
  background:#f7f5fa;border-radius:10px;
  border:1px solid rgba(0,0,0,.04);
}
.nav-link-box .label{font-size:10px;color:#b0a3bc;margin-bottom:4px}
.nav-link-box .url{font-size:10px;color:var(--accent);word-break:break-all;line-height:1.4}

/* 路线缩略图图例 */
.route-thumb-legend{
  display:flex;gap:8px;flex-wrap:wrap;
  margin:8px 0 4px;font-size:10px;color:#a898b8;
}
.route-summary{
  font-size:12px;color:#7a6c8a;line-height:1.6;
  margin:8px 0;padding:10px 12px;
  background:#f7f5fa;border-radius:10px;
}

/* 弹窗 */
.modal{
  position:fixed;inset:0;
  background:rgba(30,27,60,.45);
  backdrop-filter:blur(4px);
  -webkit-backdrop-filter:blur(4px);
  z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;
  animation:fadeIn .2s;
}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal .inner{
  background:#fff;border-radius:20px;padding:20px;
  width:100%;max-width:440px;max-height:82vh;overflow-y:auto;
  box-shadow:0 20px 60px rgba(0,0,0,.25);
  animation:slideUp .3s cubic-bezier(.34,1.56,.64,1);
}
@keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal .inner h3{font-size:16px;font-weight:700;color:#3a3045}
</style>
