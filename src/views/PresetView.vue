<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { loadAddresses, saveLastRoute, loadLastRoute } from '../composables/useStorage.js'
import { fetchBicyclingRoute, searchAlongRoute } from '../composables/useAMap.js'
import { rateDifficulty } from '../composables/useScoring.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import { nameWaypoint, buildNavUrl, openNavigation, buildGPX, calcCalories, calcSlopeProfile } from '../composables/useRouteEngine.js'
import { generateShareImage, shareImage } from '../composables/useShareCard.js'
import Icon from '../components/Icon.vue'
import RouteThumbnail from '../components/RouteThumbnail.vue'
import { PRESET_ROUTES } from '../data/presetRoutes.js'
import { PLAYPOOLS } from '../data/playpools.js'

const toast = (m, t) => window.$toast?.(m, t)
const router = useRouter()
const addresses = loadAddresses()
const { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } = useSuggest()

const selectedKey = ref(''), customFilter = ref('')
const customStart = ref({ name: '', lng: '', lat: '' })
const waypoints = ref([])
const loading = ref(false), tryInfo = ref(''), progress = ref(0)
const result = ref(null), resultShow = ref(false), collapseOpen = ref(false)
const supplyPoints = ref([]), supplyLoading = ref(false), highlightSupply = ref(-1)
function onSupplyChipClick(i) { highlightSupply.value = -1; nextTick(() => { highlightSupply.value = i }) }
function onSupplyMarkerClick(i) { highlightSupply.value = i; const sp = supplyPoints.value[i]; if (sp) toast(sp.name) }
let st = null
function onStartInput() { clearTimeout(st); st = setTimeout(() => searchAddress(customStart.value.name), 200) }
function selectSugg(i) { const p = pickSuggestion(i); if (p) { customStart.value = { name: p.name, lng: p.lng, lat: p.lat }; toast(p.name) } }
function pickStart(alias) { const a = addresses[alias]; if (a) { customStart.value = { name: a.name, lng: a.lng, lat: a.lat }; toast(alias) } }

const poolFilter = ref('')
const filteredRoutes = computed(() => {
  const f = customFilter.value.toLowerCase().trim()
  let list = PRESET_ROUTES
  if (poolFilter.value) {
    // 首版口径：路线名或途经点链含玩法池锚点关键词即归入该池
    const pool = PLAYPOOLS.find(p => p.id === poolFilter.value)
    if (pool) {
      list = list.filter(r => {
        const chain = r.name + r.start.name + r.end.name + r.waypoints.map(w => w.name).join()
        return pool.anchors.some(a => chain.includes(a))
      })
    }
  }
  return f ? list.filter(r => r.name.includes(f) || r.start.name.includes(f) || r.waypoints.some(w => w.name.includes(f))) : list
})

const groups = computed(() => {
  const cityOrder = ['西安','咸阳','关中','秦岭','宝鸡','渭南','汉中','延安','铜川','商洛','安康']
  const g = {}
  for (const r of filteredRoutes.value) {
    for (const city of cityOrder) { if (r.name.startsWith(city)) { if (!g[city]) g[city] = []; g[city].push(r); break } }
  }
  return cityOrder.filter(c => g[c]).map(c => ({ city: c, routes: g[c] }))
})

function onPresetChange() {
  resultShow.value = false
  const route = PRESET_ROUTES.find(r => r.name === selectedKey.value)
  if (route) waypoints.value = route.waypoints.map(p => ({ ...p }))
  else waypoints.value = []
}
function addWP() { waypoints.value.push({ name: '', lng: '', lat: '' }) }
function removeWP(i) { waypoints.value.splice(i, 1) }

const activeRoute = computed(() => PRESET_ROUTES.find(r => r.name === selectedKey.value))

// 「当灵感」：把该线途经点写入桩，跳转 Explore 用聪明骰子重新合成
function useAsInspiration() {
  const r = activeRoute.value
  if (!r) return
  try {
    localStorage.setItem('radompath_inspiration', JSON.stringify({ name: r.name, wps: r.waypoints }))
  } catch (e) {}
  toast('灵感已带入，选好里程直接合成')
  router.push('/explore')
}

const hasCustomStart = computed(() => !!(customStart.value.name && customStart.value.lng && customStart.value.lat))

// 难度标签去掉星级，只留段位文字
function diffLabel(d) { return String(d?.label || '').replace(/[\u2605\u2606]/g, '').trim() || d?.label || '--' }

const fullPoints = computed(() => {
  const pts = []
  const route = activeRoute.value
  if (!route) return pts
  if (hasCustomStart.value) {
    // 自定义起点 → 环线：起点出发兜一圈回到起点
    const s = { name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) }
    pts.push(s)
    pts.push(...waypoints.value.filter(w => w.name && w.lng && w.lat && !isNaN(parseFloat(w.lng)) && !isNaN(parseFloat(w.lat))).map(w => ({ name: w.name, lng: parseFloat(w.lng), lat: parseFloat(w.lat) })))
    pts.push(s) // 环线终点=起点
  } else {
    pts.push({ ...route.start })
    pts.push(...waypoints.value.filter(w => w.name && w.lng && w.lat && !isNaN(parseFloat(w.lng)) && !isNaN(parseFloat(w.lat))).map(w => ({ name: w.name, lng: parseFloat(w.lng), lat: parseFloat(w.lat) })))
    pts.push({ ...route.end })
  }
  return pts
})

const presetObj = computed(() => {
  const r = activeRoute.value
  if (!r) return null
  if (hasCustomStart.value) {
    const s = { name: customStart.value.name, lng: parseFloat(customStart.value.lng), lat: parseFloat(customStart.value.lat) }
    return { start: s, end: s, waypoints: r.waypoints }
  }
  return { start: r.start, end: r.end, waypoints: r.waypoints }
})

const diffObj = computed(() => result.value ? rateDifficulty(result.value.totalDistance, result.value.totalClimb) : null)
const navUrl = computed(() => {
  if (!result.value || !presetObj.value) return ''
  return buildNavUrl(presetObj.value.start, presetObj.value.end, result.value.waypoints)
})
function openNav() {
  if (!result.value || !presetObj.value) return
  openNavigation(presetObj.value.start, presetObj.value.end, result.value.waypoints)
}
function copyNav() { if (navUrl.value) { navigator.clipboard?.writeText(navUrl.value); toast('已复制') } }
function downloadGpx() {
  if (!result.value || !presetObj.value) return
  const { start, end } = presetObj.value
  const gpx = buildGPX(result.value, start, end)
  const blob = new Blob([gpx], { type: 'application/gpx+xml' }); const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `mantu_Preset_${start.name}_${(result.value.totalDistance/1000).toFixed(1)}km.gpx`
  a.click(); URL.revokeObjectURL(a.href)
}
async function doShare() {
  if (!result.value || !presetObj.value) return
  const { start, end } = presetObj.value
  const route = activeRoute.value
  const canvas = generateShareImage({
    title: route.name,
    subtitle: start.name + (hasCustomStart.value ? ' ↻ 环线' : ' → ' + end.name),
    totalDistance: result.value.totalDistance, totalDuration: result.value.totalDuration,
    segments: result.value.segments, waypoints: result.value.waypoints, home: start, work: end,
    stats: [
      { label: '总距离', value: (result.value.totalDistance / 1000).toFixed(1) + ' km' },
      { label: '预计', value: Math.round(result.value.totalDuration / 60) + ' 分钟' },
      { label: '途经点', value: result.value.waypoints.length + ' 个' },
    ]
  })
  const r = await shareImage(canvas, `mantu_${route.name}_${(result.value.totalDistance/1000).toFixed(1)}km.png`)
  if (r === 'shared') toast('已分享')
  else toast('已下载')
}

async function searchSupply() {
  if (supplyLoading.value) return
  const segs = result.value?.segments
  if (!segs || segs.length === 0) { toast('没有路线数据', 'warn'); return }
  supplyLoading.value = true; supplyPoints.value = []
  try {
    const results = await searchAlongRoute(segs, {
      concurrency: 6,
      onProgress: ({ done, total }) => {
        tryInfo.value = `沿途搜索中… ${Math.round(done/total*100)}%`
      }
    })
    supplyPoints.value = results
    const catCounts = {}
    for (const r of results) { catCounts[r.catLabel] = (catCounts[r.catLabel] || 0) + 1 }
    const summary = Object.entries(catCounts).map(([k,v]) => `${k}×${v}`).join(' ')
    toast(`找到 ${results.length} 个补给点 ${summary ? '| ' + summary : ''}`)
  } catch(e) { toast('搜索失败，请稍后重试', 'warn') }
  supplyLoading.value = false
}

async function generate() {
  const pts = fullPoints.value
  if (pts.length < 2) { toast('至少需要起终点', 'warn'); return }
  loading.value = true; resultShow.value = false; progress.value = 0; tryInfo.value = '正在拉取路线数据…'
  // reset supply state
  supplyPoints.value = []
  try {
    let td = 0, tt = 0; const segs = []
    // 并行请求所有路段
    const segResults = await Promise.all(pts.slice(0, -1).map((pt, i) => fetchBicyclingRoute(pt, pts[i + 1])))
    for (let i = 0; i < segResults.length; i++) {
      const seg = segResults[i]
      td += seg.distance; tt += seg.duration
      segs.push({ ...seg, from: pts[i], to: pts[i + 1], idx: i })
      progress.value = 30 + (i / (pts.length - 1)) * 40
      tryInfo.value = `正在获取第${i+1}段路线…`
    }
    const wps = pts.slice(1, -1)
    if (wps.length > 0) { tryInfo.value = '正在获取途经点地名…'; await Promise.all(wps.map(async (wp) => { wp.poiName = await nameWaypoint(wp.lng, wp.lat) })) }
    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    let uphillSections = [], downhillSections = [], totalClimb = null
    try {
      tryInfo.value = '正在分析坡度…'
      const sp = await calcSlopeProfile(segs)
      if (sp) { uphillSections = sp.uphillSections; downhillSections = sp.downhillSections; totalClimb = sp.totalClimb }
    } catch(e) {}
    result.value = { waypoints: wps, segments: segs, totalDistance: td, totalDuration: tt, sector: -1, totalClimb, uphillSections, downhillSections }
    resultShow.value = true
    const po = presetObj.value
    saveLastRoute({ type: 'preset', presetKey: selectedKey.value, home: po.start, work: po.end, waypoints: wps, segments: segs, totalDistance: td, totalDuration: tt, sector: -1, totalClimb, uphillSections, downhillSections })
  } catch (e) { toast('错误: ' + e.message, 'err') }
  loading.value = false
}

// 恢复上次路线
onMounted(() => {
  const last = loadLastRoute()
  if (last && last.type === 'preset' && last.presetKey) {
    selectedKey.value = last.presetKey
    onPresetChange()
    if (last.home && last.home.name !== activeRoute.value?.start?.name) {
      customStart.value = { name: last.home.name, lng: String(last.home.lng), lat: String(last.home.lat) }
    }
    nextTick(() => {
      result.value = { waypoints: last.waypoints || [], segments: last.segments || [], totalDistance: last.totalDistance, totalDuration: last.totalDuration, sector: last.sector, totalClimb: last.totalClimb }
      resultShow.value = true
    })
  }
})
</script>

<template>
<div>
  <div class="card">
    <h2>选择经典路线</h2>
    <input v-model="customFilter" placeholder="搜索路线..." style="margin-bottom:8px;font-size:13px" />
    <select v-model="poolFilter" style="margin-bottom:8px;font-size:12px">
      <option value="">全部玩法</option>
      <option v-for="p in PLAYPOOLS" :key="p.id" :value="p.id">{{ p.label }}</option>
    </select>
    <select v-model="selectedKey" @change="onPresetChange" style="font-size:13px">
      <option value="">选择预置路线（{{ PRESET_ROUTES.length }}条）</option>
      <optgroup v-for="g in groups" :key="g.city" :label="g.city">
        <option v-for="r in g.routes" :key="r.name" :value="r.name">{{ r.name }}</option>
      </optgroup>
    </select>
  </div>

  <div v-if="activeRoute" class="card pv-detail">
    <h2>路线详情</h2>
    <div class="pv-meta">
      <div><span class="pv-k">起点</span><strong>{{ activeRoute.start.name }}</strong><span class="pv-coord">{{ activeRoute.start.lng }}, {{ activeRoute.start.lat }}</span></div>
      <div><span class="pv-k">终点</span><strong>{{ activeRoute.end.name }}</strong><span class="pv-coord">{{ activeRoute.end.lng }}, {{ activeRoute.end.lat }}</span></div>
      <div><span class="pv-k">途经点</span><strong class="pv-accent">{{ activeRoute.waypoints.length }}个</strong></div>
    </div>
    <div class="pv-chain">
      <span class="pv-node pv-node-start">起点</span><span class="pv-name">{{ activeRoute.start.name }}</span>
      <template v-for="w in activeRoute.waypoints.slice(0,6)" :key="w.name">
        <span class="pv-arrow">→</span><span class="pv-node">途经</span><span class="pv-name">{{ w.name }}</span>
      </template>
      <span v-if="activeRoute.waypoints.length>6" class="pv-name">…等{{ activeRoute.waypoints.length }}个</span>
      <span class="pv-arrow">→</span><span class="pv-node pv-node-end">终点</span><span class="pv-name">{{ activeRoute.end.name }}</span>
    </div>
    <button class="btn btn-sm pv-inspire" @click="useAsInspiration"><Icon name="lightbulb" :size="13" /> 当灵感 · 去 Explore 合成</button>
  </div>

  <div class="card">
    <h2>自定义起点 <span class="pv-optional">可选</span></h2>
    <div class="addr-quick" v-if="Object.keys(addresses).length > 0">
      <span class="pv-k">地址簿</span>
      <button v-for="(v,k) in addresses" :key="k" class="chip-sm" @click="pickStart(k)">{{ k }}</button>
    </div>
    <div class="row" style="position:relative">
      <input v-model="customStart.name" placeholder="起点名称" style="flex:2;font-size:12px" @input="onStartInput" @focus="onStartInput" @blur="setTimeout(closeSuggest,200)">
      <input v-model.number="customStart.lng" type="number" step="0.000001" placeholder="经度" style="flex:1;font-size:12px">
      <input v-model.number="customStart.lat" type="number" step="0.000001" placeholder="纬度" style="flex:1;font-size:12px">
      <div v-if="showSuggest" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>
  </div>

  <div v-if="selectedKey" class="card">
    <h2>途经点（{{ waypoints.length }}）<span class="pv-optional">可编辑</span></h2>
    <div v-for="(wp,i) in waypoints" :key="i" class="pv-wp-row">
      <span class="pv-wp-idx">{{ i+1 }}</span>
      <input v-model="wp.name" placeholder="地名" style="flex:2">
      <input v-model.number="wp.lng" type="number" step="0.000001" placeholder="经度" style="flex:1">
      <input v-model.number="wp.lat" type="number" step="0.000001" placeholder="纬度" style="flex:1">
      <button class="btn-sm btn-del" @click="removeWP(i)"><Icon name="x" :size="12" /></button>
    </div>
    <div v-if="waypoints.length===0" class="empty-state">暂无途经点</div>
    <button class="btn btn-sm pv-addwp" @click="addWP"><Icon name="plus" :size="12" /> 添加途经点</button>
  </div>

  <div v-if="fullPoints.length>=2" class="card">
    <button class="btn btn-primary" :disabled="loading" @click="generate">{{ loading ? '生成中...' : '生成骑行导航' }}</button>
  </div>

  <div v-if="loading" class="loading-overlay card">
    <div class="progress-ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" :style="{strokeDasharray:163.36,strokeDashoffset:163.36-(progress/100)*163.36}"/></svg>
      <div class="txt">{{ progress }}%</div>
    </div>
    <p class="loading-hint">{{ tryInfo }}</p>
  </div>

  <div v-if="resultShow && result" class="card">
    <div class="stats">
      <div class="stat"><div class="val">{{ (result.totalDistance/1000).toFixed(1) }}</div><div class="lbl">总距离 km</div></div>
      <div class="stat"><div class="val">{{ Math.round(result.totalDuration/60) }}</div><div class="lbl">预计 分钟</div></div>
      <div class="stat"><div class="val small" :style="{color:diffObj?.color}">{{ diffLabel(diffObj) }}</div><div class="lbl">难度</div></div>
    </div>
    <RouteThumbnail :segments="result.segments" :waypoints="result.waypoints" :supplyPoints="supplyPoints" :highlightIndex="highlightSupply" :home="fullPoints[0]" :work="fullPoints[fullPoints.length-1]" :uphillSections="result.uphillSections" :downhillSections="result.downhillSections" @supply-click="onSupplyMarkerClick" />
    <div class="route-thumb-legend">
      <span><i class="legend-dot" style="--dot:#16a34a"></i>起点</span>
      <span><i class="legend-dot" style="--dot:#ea580c"></i>终点</span>
      <span><i class="legend-dot" style="--dot:#2563eb"></i>途经点</span>
      <span><i class="legend-dot" style="--dot:#7c3aed"></i>补给点</span>
      <span><i class="legend-dot" style="--dot:#dc2626"></i>上坡</span>
      <span><i class="legend-dot" style="--dot:#16a34a"></i>下坡</span>
      <span><Icon name="arrowUp" :size="10" /> 北</span>
    </div>
    <div class="route-summary"><strong>{{ fullPoints[0]?.name }}</strong> → {{ result.waypoints.map((w,i) => w.poiName || w.name || '途经点'+(i+1)).join(' → ') || '直达' }} → <strong>{{ fullPoints[fullPoints.length-1]?.name }}</strong></div>
    <div class="collapse-toggle" :class="{open:collapseOpen}" @click="collapseOpen=!collapseOpen"><span class="arrow"><Icon name="chevronRight" :size="12" /></span> 详细数据</div>
    <div class="collapse-body" :class="{open:collapseOpen}">
      <div class="stats" style="margin-top:8px">
        <div class="stat"><div class="val small">{{ result.totalClimb != null ? result.totalClimb+'m' : '--' }}</div><div class="lbl">爬升 m</div></div>
        <div class="stat"><div class="val small">{{ calcCalories(result.totalDistance, result.totalDuration) }}kcal</div><div class="lbl">消耗</div></div>
        <div class="stat"><div class="val small">{{ result.waypoints.length }}</div><div class="lbl">途经点</div></div>
      </div>
      <div class="segments"><div class="seg" v-for="(seg,i) in result.segments" :key="i"><span class="seg-detail">第{{ i+1 }}段: {{ fullPoints[i]?.name }} → {{ fullPoints[i+1]?.name }}</span><span class="seg-nums">{{ (seg.distance/1000).toFixed(1) }}km · {{ Math.round(seg.duration/60) }}min</span></div></div>
      <div v-if="supplyPoints.length" class="pv-supply-sec">
        <div class="pv-sec-title"><Icon name="zap" :size="13" />沿途补给点（{{ supplyPoints.length }}）</div>
        <div class="supply-chips"><span v-for="(sp, i) in supplyPoints" :key="i" class="supply-chip" :class="{active: highlightSupply===i}" :title="sp.type" @click="onSupplyChipClick(i)">{{ sp.catLabel?.slice(0,2) }} {{ sp.name }}</span></div>
      </div>
      <div v-if="result.uphillSections?.length" class="slope-box uphill" style="margin-top:12px">
        <div class="slope-title"><Icon name="trendingUp" :size="13" />上坡路段（坡度≥5%）</div>
        <div class="slope-item" v-for="(sec, i) in result.uphillSections" :key="'u'+i">
          <span class="slope-badge" :class="sec.avgGrade >= 8 ? 'steep' : 'moderate'">第{{ i+1 }}段</span>
          <span class="slope-data">{{ sec.length }} km ↗ {{ sec.climb }}m</span>
          <span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span>
        </div>
      </div>
      <div v-if="result.downhillSections?.length" class="slope-box downhill">
        <div class="slope-title"><Icon name="trendingDown" :size="13" />下坡路段（坡度≥5%）</div>
        <div class="slope-item" v-for="(sec, i) in result.downhillSections" :key="'d'+i">
          <span class="slope-badge">第{{ i+1 }}段</span>
          <span class="slope-data">{{ sec.length }} km ↘ {{ sec.descent }}m</span>
          <span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span>
        </div>
      </div>
    </div>
    <button class="btn btn-supply" @click="searchSupply" :disabled="supplyLoading">
      <span style="display:inline-flex;align-items:center;gap:6px;justify-content:center"><Icon name="search" :size="14" />{{ supplyLoading ? '搜索中…' : '搜索沿途补给点' }}</span>
    </button>
    <button class="btn btn-primary" style="margin-top:8px" @click="openNav">开始导航</button>
    <div class="nav-link-box"><div class="label">高德导航链接（可复制）</div><div class="url">{{ navUrl }}</div></div>
    <div class="btn-row" style="margin-top:8px">
      <button class="btn-sm" style="flex:1" @click="copyNav">复制</button>
      <button class="btn-sm" style="flex:1" @click="downloadGpx">GPX</button>
      <button class="btn-sm" style="flex:1" @click="doShare"><Icon name="share" :size="12" /> 分享</button>
    </div>
  </div>
</div>
</template>

<style scoped>
.pv-detail { background: var(--surface-2) !important; }
.pv-meta { font-size: 12px; line-height: 1.9; color: var(--ink-700); }
.pv-meta strong { color: var(--ink-900); margin: 0 4px; }
.pv-k { display: inline-block; min-width: 44px; color: var(--ink-400); font-size: 11px; }
.pv-coord { color: var(--ink-300); font-size: 10px; margin-left: 6px; font-variant-numeric: tabular-nums; }
.pv-accent { color: var(--accent) !important; }
.pv-chain {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  margin-top: 10px; font-size: 11px; color: var(--ink-600);
}
.pv-node {
  background: var(--surface); border: 1px solid var(--line);
  color: var(--ink-600); padding: 2px 8px; border-radius: 5px;
  font-size: 10px; font-weight: 600;
}
.pv-node-start { border-color: var(--accent); color: var(--accent); }
.pv-node-end { border-color: #ea580c; color: #ea580c; }
.pv-name { color: var(--ink-700); }
.pv-arrow { color: var(--ink-300); }
.pv-inspire {
  margin-top: 12px; display: flex; width: 100%;
  align-items: center; justify-content: center; gap: 5px;
  background: var(--accent); color: #fff; border-color: var(--accent);
  padding: 9px 0; font-size: 12px;
}
.pv-inspire:hover { background: var(--accent-hover); }
.pv-optional { font-size: 11px; color: var(--ink-300); font-weight: 400; margin-left: 2px; }
.addr-quick { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.addr-quick .pv-k { min-width: 0; margin-right: 2px; }
.pv-wp-row {
  display: flex; gap: 5px; align-items: center;
  padding: 5px 0; border-bottom: 1px solid var(--line);
}
.pv-wp-row:last-of-type { border-bottom: none; }
.pv-wp-row input { font-size: 11px; padding: 7px 10px; font-variant-numeric: tabular-nums; }
.pv-wp-idx {
  color: var(--accent); font-size: 10px; min-width: 20px; font-weight: 700;
  border-radius: 5px; background: var(--accent-soft); padding: 3px 0; text-align: center;
  flex-shrink: 0; font-variant-numeric: tabular-nums;
}
.btn-del { background: #fef2f2; color: var(--err); border-color: #fecaca; }
.pv-addwp { display: flex; margin: 10px auto 0; align-items: center; gap: 4px; }
.pv-supply-sec { margin-top: 12px; border-top: 1px dashed var(--line); padding-top: 10px; }
.pv-sec-title { font-size: 12px; font-weight: 600; color: var(--ink-700); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
</style>
