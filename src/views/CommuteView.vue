<script setup>
import { ref, computed, onMounted } from 'vue'
import { haversine } from '../utils/math.js'
import { geocode } from '../composables/useAMap.js'
import { loadAddresses, saveAddresses, saveHistory } from '../composables/useStorage.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import { tryGenerateRoute, MAX_RETRIES, nameWaypoint, buildNavUrl, openNavigation, buildGPX, calcCalories } from '../composables/useRouteEngine.js'
import { rateDifficulty } from '../composables/useScoring.js'
import RouteThumbnail from '../components/RouteThumbnail.vue'

const toast = (m, t) => window.$toast?.(m, t)
const addresses = loadAddresses()
const { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } = useSuggest()

const from = ref({ name: '', lng: '', lat: '' }), to = ref({ name: '', lng: '', lat: '' })
const maxKm = ref(50), sectorMode = ref('mixed')
const loading = ref(false), loadingHint = ref('正在规划路线…'), tryInfo = ref(''), progress = ref(0)
const retryDots = ref(Array(10).fill(''))
const result = ref(null), resultShow = ref(false)
const collapseOpen = ref(false)
const activeSuggest = ref('')

const homeObj = computed(() => { const l = parseFloat(from.value.lng), a = parseFloat(from.value.lat); return (l && a && from.value.name) ? { lng: l, lat: a, name: from.value.name } : null })
const workObj = computed(() => { const l = parseFloat(to.value.lng), a = parseFloat(to.value.lat); return (l && a && to.value.name) ? { lng: l, lat: a, name: to.value.name } : null })

onMounted(() => {
  if (addresses['家']) { from.value = { name: addresses['家'].name, lng: addresses['家'].lng, lat: addresses['家'].lat } }
  if (addresses['公司']) { to.value = { name: addresses['公司'].name, lng: addresses['公司'].lng, lat: addresses['公司'].lat } }
})

function onNameInput(target) { activeSuggest.value = target; searchAddress(target === 'from' ? from.value.name : to.value.name) }
function selectSugg(i) { const p = pickSuggestion(i); if (!p) return; if (activeSuggest.value === 'from') from.value = { name: p.name, lng: p.lng, lat: p.lat }; else to.value = { name: p.name, lng: p.lng, lat: p.lat }; activeSuggest.value = ''; toast(p.name) }
function pickAddr(a, t) { const ad = addresses[a]; if (!ad) return; if (t === 'from') from.value = { name: ad.name, lng: ad.lng, lat: ad.lat }; else to.value = { name: ad.name, lng: ad.lng, lat: ad.lat }; toast(a) }
async function doGeocode(t) {
  const n = t === 'from' ? from.value.name : to.value.name; if (!n.trim()) { toast('请输入地名', 'warn'); return }
  const r = await geocode(n, '西安'); if (r) { if (t === 'from') from.value = { name: r.name, lng: r.lng, lat: r.lat }; else to.value = { name: r.name, lng: r.lng, lat: r.lat }; toast('已获取坐标') } else toast('未找到该地点', 'warn')
}
function locateMe(target) {
  if (!navigator.geolocation) { toast('浏览器不支持定位', 'warn'); return }
  toast('正在定位…')
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { longitude: lng, latitude: lat } = pos.coords
    const obj = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
    if (target === 'from') from.value = obj; else to.value = obj
    toast('已获取当前位置')
    try {
      const name = await nameWaypoint(lng, lat)
      if (name && name.length > 2) { if (target === 'from') from.value.name = name; else to.value.name = name }
    } catch(e) {}
  }, () => { toast('定位失败，请检查权限', 'warn') }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
}

async function doGenerate(isRetry = false) {
  if (from.value.name && !from.value.lng) await doGeocode('from')
  if (to.value.name && !to.value.lng) await doGeocode('to')
  if (!from.value.name || !to.value.name || !from.value.lng || !to.value.lat) { toast('请完善起终点名称及坐标', 'warn'); return }
  const h = { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  const w = { name: to.value.name, lng: parseFloat(to.value.lng), lat: parseFloat(to.value.lat) }
  if (!isRetry) resultShow.value = false
  loading.value = true; progress.value = 0; loadingHint.value = '正在规划路线…'; tryInfo.value = ''
  retryDots.value = Array(10).fill(''); retryDots.value[0] = 'current'
  try {
    const straightM = haversine(h, w)
    const route = await tryGenerateRoute(h, w, {
      sectorMode: sectorMode.value, minDist: Math.round(straightM), maxDist: maxKm.value * 1000,
      onTry: (a, d, e) => {
        progress.value = Math.round((a / MAX_RETRIES) * 100)
        retryDots.value = Array(10).fill('').map((_, i) => i < a ? (e ? 'bad' : 'ok') : (i === a ? 'current' : ''))
        loadingHint.value = e ? `第${a}次: ${e}` : `第${a}次: ${(d/1000).toFixed(1)} km`
        tryInfo.value = loadingHint.value
      }
    })
    if (!route) { toast('生成失败，请重试', 'err'); loading.value = false; return }
    if (route.waypoints.length > 0) { tryInfo.value = '正在获取途经点地名…'; for (const wp of route.waypoints) { wp.poiName = await nameWaypoint(wp.lng, wp.lat); await new Promise(r => setTimeout(r, 200)) } }
    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = route; resultShow.value = true; loading.value = false
    saveHistory({ type: 'commute', home: h.name, work: w.name, distance: route.totalDistance, sector: route.sector, waypoints: route.waypoints.map(w => ({ lng: w.lng, lat: w.lat, name: w.poiName })) })
  } catch (e) { toast('错误: ' + e.message, 'err'); loading.value = false }
}

const diffObj = computed(() => result.value ? rateDifficulty(result.value.totalDistance, result.value.totalClimb) : null)
const navUrl = computed(() => result.value && homeObj.value && workObj.value ? buildNavUrl(homeObj.value, workObj.value, result.value.waypoints) : '')
function openNav() { if (result.value && homeObj.value && workObj.value) openNavigation(homeObj.value, workObj.value, result.value.waypoints) }
function copyNav() { if (navUrl.value) { navigator.clipboard?.writeText(navUrl.value); toast('已复制') } }
function downloadGpx() { if (result.value && homeObj.value && workObj.value) { const gpx = buildGPX(result.value, homeObj.value, workObj.value); const blob = new Blob([gpx], { type: 'application/gpx+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `RandomPath_${homeObj.value.name}_${workObj.value.name}_${(result.value.totalDistance/1000).toFixed(1)}km.gpx`; a.click(); URL.revokeObjectURL(a.href) } }

const showAddrModal = ref(false), newAddr = ref({ alias: '', name: '', lng: '', lat: '' })
function saveNewAddr() { const a = newAddr.value; if (!a.alias || !a.name || !a.lng || !a.lat) { toast('请填写完整', 'warn'); return }; addresses[a.alias] = { name: a.name, lng: parseFloat(a.lng), lat: parseFloat(a.lat) }; saveAddresses(addresses); newAddr.value = { alias: '', name: '', lng: '', lat: '' }; showAddrModal.value = false; toast('地址已保存') }
async function geocodeNewAddr() {
  const n = newAddr.value.name; if (!n.trim()) { toast('请先输入名称', 'warn'); return }
  toast('正在查询坐标…')
  const r = await geocode(n)
  if (r) { newAddr.value.lng = r.lng; newAddr.value.lat = r.lat; newAddr.value.name = r.name; toast('已获取坐标') }
  else toast('未找到该地点', 'warn')
}
</script>

<template>
<div>
  <div class="card">
    <div class="addr-quick"><span>起点地址簿：</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:10px;margin:1px" @click="pickAddr(k,'from')">{{ k }}</button><button class="btn btn-sm" style="background:#f08ca4;color:#fff;font-size:10px" @click="showAddrModal=true">+添加</button></div>
    <label style="font-size:12px;color:#8a8098;font-weight:600">起点</label>
    <div class="row" style="position:relative">
      <input v-model="from.name" placeholder="地名" style="flex:1" @input="onNameInput('from')" @focus="onNameInput('from')" @blur="setTimeout(closeSuggest,200)">
      <button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="doGeocode('from')">🔍</button>
      <button class="btn btn-sm" style="background:#42a5f5;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="locateMe('from')">📍</button>
      <div v-if="showSuggest && activeSuggest==='from'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>
    <div class="row"><input v-model="from.lng" type="number" step="0.000001" placeholder="经度" style="flex:1"><input v-model="from.lat" type="number" step="0.000001" placeholder="纬度" style="flex:1"></div>

    <div class="addr-quick" style="margin-top:10px"><span>终点地址簿：</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:10px;margin:1px" @click="pickAddr(k,'to')">{{ k }}</button></div>
    <label style="font-size:12px;color:#8a8098;font-weight:600;margin-top:6px">终点</label>
    <div class="row" style="position:relative">
      <input v-model="to.name" placeholder="地名" style="flex:1" @input="onNameInput('to')" @focus="onNameInput('to')" @blur="setTimeout(closeSuggest,200)">
      <button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="doGeocode('to')">🔍</button>
      <button class="btn btn-sm" style="background:#42a5f5;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="locateMe('to')">📍</button>
      <div v-if="showSuggest && activeSuggest==='to'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>
    <div class="row"><input v-model="to.lng" type="number" step="0.000001" placeholder="经度" style="flex:1"><input v-model="to.lat" type="number" step="0.000001" placeholder="纬度" style="flex:1"></div>

    <div class="row" style="margin-top:10px">
      <label style="font-size:12px">扇区:</label>
      <select v-model="sectorMode" style="flex:1;font-size:13px">
        <option value="mixed">混合（随机偏移）</option><option value="0">左侧·近</option><option value="1">左侧·远</option><option value="2">右侧·近</option><option value="3">右侧·远</option><option value="random">随机扇区</option>
      </select>
      <label style="font-size:12px;color:#94a3b8">最大</label><input v-model.number="maxKm" type="number" min="1" max="999" style="flex:1;font-size:13px"><span style="font-size:12px;color:#94a3b8">km</span>
    </div>
    <button class="btn btn-primary" :disabled="loading" @click="doGenerate(false)">{{ loading ? '生成中...' : '随机生成路线' }}</button>
  </div>

  <div v-if="loading" class="loading-overlay card">
    <div class="progress-ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" :style="{strokeDasharray:163.36,strokeDashoffset:163.36-(progress/100)*163.36}"/></svg>
      <div class="txt">{{ progress }}%</div>
    </div>
    <p class="loading-hint">{{ loadingHint }}</p>
    <div class="retry-dots"><span v-for="(d,i) in retryDots" :key="i" :class="'retry-dot '+d"></span></div>
    <p class="try-count">{{ tryInfo }}</p>
  </div>

  <div v-if="resultShow && result" class="card" style="animation:cardIn .4s cubic-bezier(.34,1.56,.64,1)">
    <div class="stats">
      <div class="stat"><div class="val">{{ (result.totalDistance/1000).toFixed(1) }}</div><div class="lbl">总距离 km</div></div>
      <div class="stat"><div class="val">{{ Math.round(result.totalDuration/60) }}</div><div class="lbl">预计 分钟</div></div>
      <div class="stat"><div class="val small" :style="{color: diffObj?.color}">{{ diffObj?.label }}</div><div class="lbl">难度</div></div>
    </div>
    <RouteThumbnail :segments="result.segments" :waypoints="result.waypoints" :home="homeObj" :work="workObj" />
    <div class="route-thumb-legend"><span>🟢 起点</span><span>🟠 终点</span><span>🔵 途经点</span><span>⬆ 北</span></div>
    <div class="route-summary" v-html="'<strong>'+(homeObj?.name||'')+'</strong> → '+result.waypoints.map((w,i)=>w.poiName||'途经点'+(i+1)).join(' → ')+' → <strong>'+(workObj?.name||'')+'</strong>'"></div>
    <div class="collapse-toggle" :class="{open:collapseOpen}" @click="collapseOpen=!collapseOpen"><span class="arrow">▶</span> 详细数据</div>
    <div class="collapse-body" :class="{open:collapseOpen}">
      <div class="stats" style="margin-top:8px">
        <div class="stat"><div class="val small">{{ result.totalClimb != null ? result.totalClimb+'m' : '--' }}</div><div class="lbl">爬升 m</div></div>
        <div class="stat"><div class="val small">{{ calcCalories(result.totalDistance, result.totalDuration) }}kcal</div><div class="lbl">消耗</div></div>
        <div class="stat"><div class="val small">{{ result.waypoints.length }}</div><div class="lbl">途经点</div></div>
      </div>
      <div class="segments"><div class="seg" v-for="(seg,i) in result.segments" :key="i"><span class="seg-detail">第{{ i+1 }}段: {{ i===0 ? homeObj?.name : (result.waypoints[i-1]?.poiName||'途经点'+i) }} → {{ i===result.segments.length-1 ? workObj?.name : (result.waypoints[i]?.poiName||'途经点'+(i+1)) }}</span><span class="seg-nums">{{ (seg.distance/1000).toFixed(1) }}km · {{ Math.round(seg.duration/60) }}min</span></div></div>
      <div class="waypoints-info"><span v-for="(wp,i) in result.waypoints" :key="i">途经点{{ i+1 }}: {{ wp.lng.toFixed(5) }}, {{ wp.lat.toFixed(5) }} {{ wp.poiName||'' }}</span></div>
    </div>
    <button class="btn btn-nav" @click="openNav">开始导航</button>
    <div class="nav-link-box"><div class="label">高德导航链接（可复制）：</div><div class="url">{{ navUrl }}</div></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-sm btn-secondary" style="flex:1" @click="copyNav">复制</button><button class="btn btn-sm btn-secondary" style="flex:1" @click="downloadGpx">GPX</button></div>
    <button class="btn btn-secondary" style="margin-top:8px" @click="doGenerate(true)">换一条</button>
  </div>

  <div class="modal" v-if="showAddrModal" @click.self="showAddrModal=false">
    <div class="inner">
      <h3>添加新地址</h3>
      <input v-model="newAddr.alias" placeholder="别名，如：家、公司、钟楼">
      <div class="row"><input v-model="newAddr.name" placeholder="完整名称，如：泰华金茂国际" style="flex:1"><button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0" @click="geocodeNewAddr">🔍 查询坐标</button></div>
      <input v-model="newAddr.lng" placeholder="经度 (lng)"><input v-model="newAddr.lat" placeholder="纬度 (lat)">
      <p style="font-size:12px;color:#a898b8;margin-bottom:10px">坐标：<a href="https://lbs.amap.com/tools/picker" target="_blank">高德坐标拾取器</a></p>
      <div class="btn-row"><button class="btn btn-secondary" @click="showAddrModal=false">取消</button><button class="btn btn-primary" @click="saveNewAddr">保存</button></div>
    </div>
  </div>
</div>
</template>
