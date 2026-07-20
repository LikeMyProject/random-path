<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
const router = useRouter(), route = useRoute()
const tabs = [
  { key: 'commute', label: '🎲 随机通勤' },
  { key: 'loop', label: '🔄 环线骑行' },
  { key: 'preset', label: '🗺 经典路线' },
]
const toast = ref({ show: false, msg: '', type: '' }); let tt = null
function showToast(msg, type = '') { toast.value = { show: true, msg, type }; clearTimeout(tt); tt = setTimeout(() => { toast.value.show = false }, 2200) }
router.isReady().then(() => { window.$toast = showToast })
</script>
<template>
<div class="app">
  <header class="header"><div class="logo-row"><span class="logo-icon">🚴</span><div><h1>RandomPath</h1><p class="subtitle">小沫陪哥哥一起探索骑行路线 ✨</p></div></div></header>
  <nav class="tab-bar"><button v-for="t in tabs" :key="t.key" :class="['tab-btn', { active: route.meta.tab === t.key }]" @click="router.push('/' + t.key)">{{ t.label }}</button></nav>
  <router-view />
  <div :class="['toast', { show: toast.show }, toast.type]">{{ toast.msg }}</div>
  <footer>RandomPath v2.1 · 高程数据来自高德地图 & Open-Meteo</footer>
</div>
</template>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,sans-serif;background:linear-gradient(135deg,#fef6f8 0%,#faf1f5 30%,#f3f0f7 60%,#f0f6f4 100%);background-attachment:fixed;color:#5a4e5c;min-height:100vh;padding:12px;padding-bottom:80px;-webkit-tap-highlight-color:transparent}
.app{max-width:480px;margin:0 auto}
.header{text-align:center;padding:12px 0 4px}
.logo-row{display:flex;align-items:center;justify-content:center;gap:10px}
.logo-icon{font-size:36px;animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.header h1{font-size:22px;color:#d48195;text-shadow:0 2px 0 rgba(212,129,149,0.15)}
.header .subtitle{color:#a898b8;font-size:12px;margin-top:2px;font-weight:500}
.tab-bar{display:flex;gap:4px;margin:10px 0;background:#fff;border-radius:14px;padding:4px;box-shadow:0 2px 10px rgba(190,175,195,0.12)}
.tab-btn{flex:1;border:none;border-radius:11px;padding:10px 2px;font-size:11px;font-weight:700;background:transparent;color:#a898b8;cursor:pointer;transition:all .25s cubic-bezier(.34,1.56,.64,1);white-space:nowrap}
.tab-btn.active{background:linear-gradient(135deg,#f08ca4,#e27790);color:#fff;box-shadow:0 3px 10px rgba(240,140,164,0.3);transform:scale(1.04)}
.tab-btn:active{transform:scale(.94)}
.card{background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 2px 14px rgba(190,175,195,0.1);border:1.5px solid #f2eaf4;animation:cardIn .35s cubic-bezier(.34,1.56,.64,1)}
.card h2{font-size:14px;margin-bottom:10px;color:#5e5468}
@keyframes cardIn{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
.row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.row label{font-size:13px;white-space:nowrap;min-width:32px;color:#8a8098;font-weight:600}
input,select{background:#faf7fc;color:#5a4e5c;border:2px solid #e5dcec;border-radius:10px;padding:10px 12px;font-size:14px;width:100%;transition:all .2s}
input:focus,select:focus{outline:none;border-color:#f08ca4;box-shadow:0 0 0 3px rgba(240,140,164,0.1)}
.btn{display:block;width:100%;border:none;border-radius:12px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;text-align:center;transition:all .2s}
.btn:active{transform:scale(.95)}
.btn-primary{background:linear-gradient(135deg,#f08ca4,#e27790);color:#fff;box-shadow:0 3px 12px rgba(240,140,164,0.3)}
.btn-primary:disabled{opacity:.5;pointer-events:none}
.btn-secondary{background:#f3f0f7;color:#8a7a98}
.btn-sm{width:auto;display:inline-block;padding:6px 12px;font-size:11px;border-radius:8px;font-weight:600}
.stats{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.stat{flex:1;min-width:60px;background:linear-gradient(135deg,#fef6f8,#faf1f5);border-radius:10px;padding:10px 4px;text-align:center;border:1.5px solid #fce8ee}
.stat .val{font-size:18px;font-weight:800;color:#e27790}
.stat .lbl{font-size:10px;color:#a898b8;margin-top:2px;font-weight:600}
.toast{position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-80px);background:linear-gradient(135deg,#f08ca4,#e27790);color:#fff;padding:8px 20px;border-radius:18px;font-weight:700;font-size:13px;z-index:99;opacity:0;transition:all .3s cubic-bezier(.34,1.56,.64,1);pointer-events:none;box-shadow:0 4px 16px rgba(240,140,164,0.3)}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.warn{background:linear-gradient(135deg,#f0a870,#e89550)}
.toast.err{background:linear-gradient(135deg,#ff5252,#d32f2f)}
.loading-overlay{text-align:center;padding:20px}
.suggest-drop{position:absolute;top:100%;left:0;right:0;background:#fff;border:2px solid #e5dcec;border-radius:10px;max-height:200px;overflow-y:auto;z-index:50;box-shadow:0 6px 20px rgba(190,175,195,0.2)}
.suggest-item{padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #f2eaf4;display:flex;justify-content:space-between;align-items:center}
.suggest-item:last-child{border:none}
.suggest-item:hover{background:#faf7fc}
.suggest-item .s-name{color:#5a4e5c;flex:1}
.suggest-item .s-dist{color:#a898b8;font-size:10px;margin-left:8px}
.empty-state{text-align:center;padding:24px;color:#a898b8}
.addr-quick{margin-bottom:6px;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.addr-quick span{font-size:10px;color:#a898b8;font-weight:600}
footer{text-align:center;padding:16px;color:#8cb8a8;font-size:10px;font-weight:500}
.supply-chips{display:flex;flex-wrap:wrap;gap:4px}
.supply-chip{display:inline-block;background:linear-gradient(135deg,#f5f3ff,#ede9fe);color:#7c3aed;border:1px solid #ddd6fe;border-radius:6px;padding:3px 8px;font-size:10px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;cursor:pointer;transition:all .2s}
.supply-chip.active,.supply-chip:active{background:#7c3aed;color:#fff;border-color:#7c3aed;transform:scale(1.05)}
.btn-supply{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;box-shadow:0 3px 12px rgba(124,58,237,0.3);margin-bottom:8px}
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
</style>
