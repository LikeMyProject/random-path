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
      <span class="logo-icon">{{ currentGroup === 'ride' ? '🚴' : '✈️' }}</span>
      <div>
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
/* ===== 主题变量 ===== */
.app[data-theme="ride"]{
  --accent:#0f6e56;--accent-2:#1a8a6e;--accent-soft:#e8f5f0;--accent-tint:rgba(15,110,86,.08);
  --bg-grad:linear-gradient(135deg,#f0f6f4 0%,#e8f5f0 30%,#f3f8f6 60%,#f5f0f7 100%);
  --header-text:#0f6e56;--sub-text:#5a8076;
}
.app[data-theme="travel"]{
  --accent:#534ab7;--accent-2:#6d63d3;--accent-soft:#ede9fe;--accent-tint:rgba(83,74,183,.08);
  --bg-grad:linear-gradient(135deg,#f3f0f7 0%,#ede9fe 30%,#f5f0fa 60%,#f0f6f4 100%);
  --header-text:#534ab7;--sub-text:#6b6499;
}

*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,sans-serif;background:#f5f3f8;color:#5a4e5c;min-height:100vh;-webkit-tap-highlight-color:transparent}
.app{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg-grad);background-attachment:fixed;padding-bottom:72px;transition:background .4s ease}

/* ===== 顶部栏 ===== */
.top-bar{padding:14px 16px 0;position:sticky;top:0;z-index:30;background:var(--bg-grad);backdrop-filter:blur(10px)}
.top-bar::after{content:'';display:block;height:4px}
.logo-row{display:flex;align-items:center;gap:10px}
.logo-icon{font-size:32px;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.top-bar h1{font-size:22px;color:var(--header-text);text-shadow:0 2px 0 var(--accent-tint);transition:color .3s}
.subtitle{color:var(--sub-text);font-size:11px;margin-top:1px;font-weight:500;transition:color .3s}

/* 二级标签 */
.sub-tab-bar{display:flex;gap:6px;margin-top:10px}
.sub-tab{flex:1;border:none;border-radius:10px;padding:8px 4px;font-size:12px;font-weight:600;background:rgba(255,255,255,.6);color:var(--sub-text);cursor:pointer;transition:all .25s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:4px}
.sub-tab-icon{font-size:14px}
.sub-tab.active{background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12);transform:scale(1.03)}
.sub-tab:active{transform:scale(.95)}

/* ===== 底部一级标签 ===== */
.bottom-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;display:flex;background:#fff;border-top:1px solid rgba(0,0,0,.06);box-shadow:0 -2px 16px rgba(0,0,0,.06);z-index:40;padding-bottom:env(safe-area-inset-bottom,0)}
.bottom-tab{flex:1;border:none;background:transparent;padding:8px 0 6px;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;transition:all .2s;position:relative}
.bottom-tab .bt-icon{font-size:22px;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.bottom-tab .bt-label{font-size:11px;font-weight:600;color:#a898b8;transition:color .2s}
.bottom-tab.active .bt-icon{transform:translateY(-2px) scale(1.1)}
.bottom-tab.active .bt-label{color:var(--accent);font-weight:700}
.bottom-tab.active::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:28px;height:3px;border-radius:0 0 4px 4px;background:var(--accent)}
.bottom-tab:active{transform:scale(.92)}

/* ===== 通用组件样式 ===== */
.content{padding:0 16px}
.card{background:#fff;border-radius:16px;padding:16px;margin:12px 0;box-shadow:0 2px 14px rgba(190,175,195,.1);border:1.5px solid var(--accent-soft);animation:cardIn .35s cubic-bezier(.34,1.56,.64,1)}
.card h2{font-size:14px;margin-bottom:10px;color:var(--header-text)}
@keyframes cardIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.row label{font-size:13px;white-space:nowrap;min-width:32px;color:#8a8098;font-weight:600}
input,select{background:#faf8fc;color:#5a4e5c;border:2px solid #e5dcec;border-radius:10px;padding:10px 12px;font-size:14px;width:100%;transition:all .2s}
input:focus,select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-tint)}
.btn{display:block;width:100%;border:none;border-radius:12px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;text-align:center;transition:all .2s}
.btn:active{transform:scale(.95)}
.btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.15)}
.btn-primary:disabled{opacity:.5;pointer-events:none}
.btn-secondary{background:#f3f0f7;color:#8a7a98}
.btn-sm{width:auto;display:inline-block;padding:6px 12px;font-size:11px;border-radius:8px;font-weight:600}
.stats{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.stat{flex:1;min-width:60px;background:linear-gradient(135deg,var(--accent-soft),#faf8fc);border-radius:10px;padding:10px 4px;text-align:center;border:1.5px solid var(--accent-soft)}
.stat .val{font-size:18px;font-weight:800;color:var(--accent)}
.stat .lbl{font-size:10px;color:#a898b8;margin-top:2px;font-weight:600}
.toast{position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-80px);background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;padding:8px 20px;border-radius:18px;font-weight:700;font-size:13px;z-index:99;opacity:0;transition:all .3s cubic-bezier(.34,1.56,.64,1);pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.2)}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.warn{background:linear-gradient(135deg,#f0a870,#e89550)}
.toast.err{background:linear-gradient(135deg,#ff5252,#d32f2f)}
.loading-overlay{text-align:center;padding:20px}
.suggest-drop{position:absolute;top:100%;left:0;right:0;background:#fff;border:2px solid #e5dcec;border-radius:10px;max-height:200px;overflow-y:auto;z-index:50;box-shadow:0 6px 20px rgba(190,175,195,.2)}
.suggest-item{padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f2eaf4;display:flex;justify-content:space-between;align-items:center}
.suggest-item:last-child{border:none}
.suggest-item:hover{background:#faf7fc}
.suggest-item .s-name{color:#5a4e5c;flex:1}
.suggest-item .s-dist{color:#a898b8;font-size:10px;margin-left:8px}
.empty-state{text-align:center;padding:24px;color:#a898b8}
.supply-chips{display:flex;flex-wrap:wrap;gap:4px}
.supply-chip{display:inline-block;background:linear-gradient(135deg,var(--accent-soft),#f5f3ff);color:var(--accent);border:1px solid var(--accent-soft);border-radius:6px;padding:3px 8px;font-size:10px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;cursor:pointer;transition:all .2s}
.supply-chip.active,.supply-chip:active{background:var(--accent);color:#fff;border-color:var(--accent);transform:scale(1.05)}
.btn-supply{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.15);margin-bottom:8px}
.btn-supply:disabled{opacity:.5;pointer-events:none}
.slope-box{margin-top:10px;padding:10px 12px;border-radius:10px}
.slope-box.uphill{background:linear-gradient(135deg,#fff7ed,#fef2f2);border:1px solid #fed7aa}
.slope-box.downhill{background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #bbf7d0}
.slope-title{font-size:12px;font-weight:700;margin-bottom:6px}
.slope-box.uphill .slope-title{color:#c2410c}
.slope-box.downhill .slope-title{color:#166534}
.slope-item{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px}
.slope-box.uphill .slope-item{border-bottom:1px dashed #fce4d0}
.slope-box.downhill .slope-item{border-bottom:1px dashed #bbf7d0}
.slope-item:last-child{border-bottom:none}
.slope-badge{font-weight:700;white-space:nowrap;font-size:11px}
.slope-badge.moderate{color:#ea580c}
.slope-badge.steep{color:#dc2626}
.slope-data{font-weight:600;color:#5e5468;white-space:nowrap}
.slope-grade{color:#a898b8;font-size:10px;white-space:nowrap;margin-left:auto}
/* 方向/时长 chips */
.compass-row{display:flex;flex-wrap:wrap;gap:4px}
.chip{border:2px solid #e5dcec;border-radius:10px;padding:6px 10px;font-size:11px;font-weight:600;background:#fff;color:#8a7a98;cursor:pointer;transition:all .2s;white-space:nowrap}
.chip.active{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-color:var(--accent);box-shadow:0 2px 8px rgba(0,0,0,.12)}
.chip:active{transform:scale(.94)}
/* 罗盘网格 */
.compass-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-width:240px;margin:0 auto}
.compass-btn{border:2px solid #e5dcec;border-radius:12px;padding:10px 4px;font-size:13px;font-weight:600;background:#fff;color:#8a7a98;cursor:pointer;transition:all .2s;text-align:center}
.compass-btn.center{font-size:16px;padding:12px 4px}
.compass-btn.active{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-color:var(--accent);box-shadow:0 2px 10px rgba(0,0,0,.15);transform:scale(1.05)}
.compass-btn:active{transform:scale(.92)}
/* 多路线卡片 */
.multi-cards{display:flex;gap:8px;overflow-x:auto;padding:4px 0;margin-bottom:12px;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory}
.multi-card{flex:0 0 85%;scroll-snap-align:start;background:#fff;border-radius:14px;padding:10px;border:2px solid #f2eaf4;cursor:pointer;transition:all .2s}
.multi-card.active{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-tint)}
.multi-card .route-thumb{width:100%}
/* 路线质量标签 */
.quality-tags{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0}
.qtag{font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
</style>
