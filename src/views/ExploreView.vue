<script setup>
import { ref, computed, onMounted } from 'vue'
import { geocode, setDetectedCity, detectCityFromGPS } from '../composables/useAMap.js'
import { loadAddresses, saveAddresses, deleteAddress, saveHistory, saveLastRoute, loadLastRoute } from '../composables/useStorage.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import { tryGenerateRoute, generateCompassLoop, generateMultipleRoutes, MAX_RETRIES, BIKE_SPEED, COMPASS, nameWaypoint, buildNavUrl, openNavigation, buildGPX, calcCalories } from '../composables/useRouteEngine.js'
import { rateDifficulty } from '../composables/useScoring.js'
import { generateShareImage, shareImage } from '../composables/useShareCard.js'
import RouteThumbnail from '../components/RouteThumbnail.vue'

const toast = (m, t) => window.$toast?.(m, t)
const addresses = loadAddresses()
const { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } = useSuggest()

// === 场景模式 ===
const SCENES = [
  { key:'casual', icon:'🌅', label:'休闲骑', desc:'1h · 平路 · 沿河公园', time:60, flat:true },
  { key:'training', icon:'🏋', label:'训练骑', desc:'2h · 多坡 · 进山', time:120, hilly:true },
  { key:'random', icon:'🔀', label:'随便骑', desc:'随机时长 · 随机方向', time:-1, random:true },
]
const scene = ref('random')
const showCustom = ref(false)

// === 地址 ===
const from = ref({ name: '', lng: '', lat: '' }), to = ref({ name: '', lng: '', lat: '' })
const activeSuggest = ref('')
const hasDest = computed(() => !!(to.value.name && to.value.lng && to.value.lat))

// === 自定义参数 ===
const direction = ref('random')
const timeMin = ref(90) // 默认值，会被场景覆盖

function applyScene(s) {
  scene.value = s.key
  showCustom.value = s.key === 'custom'
  if (s.key === 'random') { direction.value = 'random'; timeMin.value = 60 + Math.floor(Math.random() * 3) * 60 }
  else if (s.key === 'casual') { direction.value = 'random'; timeMin.value = 60 }
  else if (s.key === 'training') { direction.value = 'S'; timeMin.value = 120 }
}

const targetDist = computed(() => timeMin.value * 60 * BIKE_SPEED / 3.6)
const homeObj = computed(() => { const l = parseFloat(from.value.lng), a = parseFloat(from.value.lat); return (l && a && from.value.name) ? { lng: l, lat: a, name: from.value.name } : null })
const workObj = computed(() => hasDest.value ? { name: to.value.name, lng: parseFloat(to.value.lng), lat: parseFloat(to.value.lat) } : homeObj.value)

// === 生成状态 ===
const loading = ref(false), loadingHint = ref(''), tryInfo = ref(''), progress = ref(0)
const retryDots = ref(Array(10).fill(''))
const result = ref(null), resultShow = ref(false), collapseOpen = ref(false)
const multiResults = ref([]), activeResultIdx = ref(0)

// === 初始化 ===
onMounted(async () => {
  if (addresses['家']) from.value = { name: addresses['家'].name, lng: addresses['家'].lng, lat: addresses['家'].lat }
  if (addresses['公司']) to.value = { name: addresses['公司'].name, lng: addresses['公司'].lng, lat: addresses['公司'].lat }
  const last = loadLastRoute()
  if (last && (last.type === 'commute' || last.type === 'loop') && last.home) {
    from.value = { name: last.home.name, lng: String(last.home.lng), lat: String(last.home.lat) }
    if (last.work && last.work.name !== last.home.name) to.value = { name: last.work.name, lng: String(last.work.lng), lat: String(last.work.lat) }
    if (last.direction) direction.value = last.direction
    if (last.timeMin) timeMin.value = last.timeMin
    if (last.scene) scene.value = last.scene
    result.value = { waypoints: last.waypoints || [], segments: last.segments || [], totalDistance: last.totalDistance, totalDuration: last.totalDuration, totalClimb: last.totalClimb, uphillSections: last.uphillSections || [], downhillSections: last.downhillSections || [] }
    resultShow.value = true; return
  }
  if (!addresses['家'] && navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) => { navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }) })
      const { longitude: lng, latitude: lat } = pos.coords
      from.value = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
      try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) from.value.name = name; if (city) setDetectedCity(city) } catch(e) {}
    } catch(e) {}
  }
})

// === 地址操作 ===
function onNameInput(target) { activeSuggest.value = target; searchAddress(target === 'from' ? from.value.name : to.value.name) }
function selectSugg(i) { const p = pickSuggestion(i); if (!p) return; (activeSuggest.value === 'from' ? from : to).value = { name: p.name, lng: p.lng, lat: p.lat }; activeSuggest.value = ''; toast(p.name) }
function pickAddr(a, t) { const ad = addresses[a]; if (!ad) return; (t === 'from' ? from : to).value = { name: ad.name, lng: ad.lng, lat: ad.lat }; toast(a) }
async function doGeocode(t) { const n = (t === 'from' ? from.value.name : to.value.name); if (!n.trim()) { toast('请输入地名', 'warn'); return }; const r = await geocode(n); if (r) { (t === 'from' ? from : to).value = { name: r.name, lng: r.lng, lat: r.lat }; toast('已获取坐标') } else toast('未找到该地点', 'warn') }
function locateMe(target) {
  if (!navigator.geolocation) { toast('浏览器不支持定位', 'warn'); return }
  toast('正在定位…')
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { longitude: lng, latitude: lat } = pos.coords
    const obj = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
    if (target === 'from') from.value = obj; else to.value = obj
    toast('已获取当前位置')
    try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) { if (target === 'from') from.value.name = name; else to.value.name = name }; if (city) setDetectedCity(city) } catch(e) {}
  }, () => { toast('定位失败', 'warn') }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
}

// === 生成路线 ===
async function doGenerate(isRetry = false) {
  multiResults.value = []
  if (from.value.name && !from.value.lng) await doGeocode('from')
  if (hasDest.value && to.value.name && !to.value.lng) await doGeocode('to')
  if (!from.value.name || !from.value.lng) { toast('请完善起点', 'warn'); return }
  const h = { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  const w = hasDest.value ? { name: to.value.name, lng: parseFloat(to.value.lng), lat: parseFloat(to.value.lat) } : h
  const isLoop = h.lng === w.lng && h.lat === w.lat
  if (!isRetry) { resultShow.value = false; multiResults.value = [] }
  loading.value = true; progress.value = 0; loadingHint.value = '正在规划路线…'; tryInfo.value = ''
  retryDots.value = Array(10).fill(''); retryDots.value[0] = 'current'
  const td = targetDist.value
  const dirDeg = COMPASS.find(c => c.key === direction.value)?.deg ?? null
  const onTry = (a, d, e) => {
    progress.value = Math.round((a / MAX_RETRIES) * 100)
    retryDots.value = Array(10).fill('').map((_, i) => i < a ? (e ? 'bad' : 'ok') : (i === a ? 'current' : ''))
    loadingHint.value = e ? `第${a}次: ${e}` : `第${a}次: ${(d/1000).toFixed(1)} km`
    tryInfo.value = loadingHint.value
  }
  try {
    const route = isLoop
      ? await tryGenerateRoute(h, h, { minDist: Math.round(td * 0.55), maxDist: Math.round(td * 1.5), waypointGenerator: () => generateCompassLoop(h, td, dirDeg), onTry })
      : await tryGenerateRoute(h, w, { minDist: Math.round(td * 0.6), maxDist: Math.round(td * 1.4), directionDeg: dirDeg, onTry })
    if (!route) { toast('生成失败，请重试', 'err'); loading.value = false; return }
    if (route.waypoints.length > 0) { tryInfo.value = '正在获取途经点地名…'; await Promise.all(route.waypoints.map(async (wp) => { wp.poiName = await nameWaypoint(wp.lng, wp.lat) })) }
    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = route; resultShow.value = true; loading.value = false
    saveHistory({ type: 'explore', home: h.name, work: w.name, distance: route.totalDistance, waypoints: route.waypoints.map(wp => ({ lng: wp.lng, lat: wp.lat, name: wp.poiName })) })
    saveLastRoute({ type: 'explore', home: h, work: w, waypoints: route.waypoints, segments: route.segments, totalDistance: route.totalDistance, totalDuration: route.totalDuration, totalClimb: route.totalClimb, uphillSections: route.uphillSections, downhillSections: route.downhillSections, direction: direction.value, timeMin: timeMin.value, scene: scene.value })
  } catch (e) { toast('错误: ' + e.message, 'err'); loading.value = false }
}

async function doGenerateMultiple() {
  multiResults.value = []; resultShow.value = false
  if (from.value.name && !from.value.lng) await doGeocode('from')
  if (hasDest.value && to.value.name && !to.value.lng) await doGeocode('to')
  if (!from.value.name || !from.value.lng) { toast('请完善起点', 'warn'); return }
  const h = { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  const w = hasDest.value ? { name: to.value.name, lng: parseFloat(to.value.lng), lat: parseFloat(to.value.lat) } : h
  const isLoop = h.lng === w.lng && h.lat === w.lat
  const td = targetDist.value
  const dirDeg = COMPASS.find(c => c.key === direction.value)?.deg ?? null
  loading.value = true; loadingHint.value = '正在生成多条路线…'
  try {
    const opts = isLoop
      ? { minDist: Math.round(td * 0.55), maxDist: Math.round(td * 1.5), waypointGenerator: () => generateCompassLoop(h, td, dirDeg) }
      : { minDist: Math.round(td * 0.6), maxDist: Math.round(td * 1.4), directionDeg: dirDeg }
    const results = await generateMultipleRoutes(h, w, opts, 3)
    for (const r of results) { if (r.waypoints.length > 0) { await Promise.all(r.waypoints.map(async (wp) => { wp.poiName = await nameWaypoint(wp.lng, wp.lat) })) } }
    multiResults.value = results; activeResultIdx.value = 0
    if (results.length > 0) selectMulti(0)
  } catch (e) { toast('错误: ' + e.message, 'err') }
  loading.value = false
}

function selectMulti(i) { activeResultIdx.value = i; const r = multiResults.value[i]; if (!r) return; result.value = r; resultShow.value = true }

// === 结果操作 ===
const diffObj = computed(() => result.value ? rateDifficulty(result.value.totalDistance, result.value.totalClimb) : null)
const navUrl = computed(() => result.value && homeObj.value && workObj.value ? buildNavUrl(homeObj.value, workObj.value, result.value.waypoints) : '')
function openNav() { if (result.value && homeObj.value && workObj.value) openNavigation(homeObj.value, workObj.value, result.value.waypoints) }
function copyNav() { if (navUrl.value) { navigator.clipboard?.writeText(navUrl.value); toast('已复制') } }
function downloadGpx() { if (result.value && homeObj.value && workObj.value) { const gpx = buildGPX(result.value, homeObj.value, workObj.value); const blob = new Blob([gpx], { type: 'application/gpx+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `RandomPath_${homeObj.value.name}_${(result.value.totalDistance/1000).toFixed(1)}km.gpx`; a.click(); URL.revokeObjectURL(a.href) } }
async function doShare() {
  if (!result.value) return
  const route = result.value; const h = homeObj.value, w = workObj.value
  const canvas = generateShareImage({ title: (h?.name||'?') + (hasDest.value ? ' → '+(w?.name||'?') : ' ↻'), subtitle: (route.totalDistance/1000).toFixed(1)+' km · '+Math.round(route.totalDuration/60)+' min', totalDistance: route.totalDistance, totalDuration: route.totalDuration, segments: route.segments, waypoints: route.waypoints, home: h, work: w||h, stats: [{ label:'总距离', value:(route.totalDistance/1000).toFixed(1)+' km' },{ label:'预计', value:Math.round(route.totalDuration/60)+' 分钟' },{ label:'途经点', value:route.waypoints.length+' 个' }] })
  const r = await shareImage(canvas, `RandomPath_${(h?.name||'route')}_${(route.totalDistance/1000).toFixed(1)}km.png`)
  if (r === 'shared') toast('已分享 🎉'); else toast('已下载 📥')
}

// === 地址管理 ===
const showAddrModal = ref(false), newAddr = ref({ alias: '', name: '', lng: '', lat: '' })
const _K = '30e32c7bfa7d24588696277a60efc034c396283d8584c01ccd99c184e1dd68e4'
const _D = 'eyLlrrYiOnsibmFtZSI6Iumahua6kOWbvemZheWfjkTljLoiLCJsbmciOjEwOC45NTg0MzIsImxhdCI6MzQuMzc4NTQ2fSwi5YWs5Y+4Ijp7Im5hbWUiOiLms7DljY7Ct+mHkei0uOWbvemZhSIsImxuZyI6MTA4Ljg4NjY0NCwibGF0IjozNC4yMjQ2MTV9fQ=='
function _decode() { try { const b=atob(_D);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return JSON.parse(new TextDecoder().decode(u)) } catch(e) { return {} } }
const devUnlocked = ref(localStorage.getItem('radompath_dev') === '1')
if (devUnlocked.value) { const presets = _decode(); let n = false; for (const [k, v] of Object.entries(presets)) { if (!addresses[k] || addresses[k].name?.includes('Ã')) { addresses[k] = { name: v.name, lng: v.lng, lat: v.lat }; n = true } } if (n) saveAddresses(addresses) }
const showPwdInput = ref(false), pwdValue = ref('')
async function checkPassword() { const hb = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwdValue.value)); const hx = Array.from(new Uint8Array(hb)).map(b => b.toString(16).padStart(2,'0')).join(''); if (hx === _K) { devUnlocked.value = true; localStorage.setItem('radompath_dev','1'); showPwdInput.value = false; pwdValue.value = ''; const p = _decode(); for (const [k,v] of Object.entries(p)) addresses[k] = { name: v.name, lng: v.lng, lat: v.lat }; saveAddresses(addresses); toast('已解锁 ✅') } else toast('密码错误','err') }
function quickFill(t, a) { const ad = addresses[a]; if (!ad) return; if (t === 'from') from.value = { name: ad.name, lng: String(ad.lng), lat: String(ad.lat) }; else to.value = { name: ad.name, lng: String(ad.lng), lat: String(ad.lat) } }
function saveNewAddr() { const a = newAddr.value; if (!a.alias||!a.name||!a.lng||!a.lat) { toast('请填写完整','warn'); return }; addresses[a.alias] = { name:a.name, lng:parseFloat(a.lng), lat:parseFloat(a.lat) }; saveAddresses(addresses); newAddr.value = { alias:'',name:'',lng:'',lat:'' }; showAddrModal.value = false; toast('地址已保存') }
function deleteSavedAddr(a) { if (!confirm(`确定删除「${a}」？`)) return; deleteAddress(a) ? toast(`已删除「${a}」`) : toast('删除失败','warn') }
async function geocodeNewAddr() { const n = newAddr.value.name; if (!n.trim()) { toast('请先输入地址','warn'); return }; toast('正在查询坐标…'); const r = await geocode(n); if (r) { newAddr.value.lng = String(r.lng); newAddr.value.lat = String(r.lat); newAddr.value.name = r.name; toast('已获取坐标') } else toast('未找到','warn') }
</script>

<template>
<div>
  <!-- 场景模式选择 -->
  <div class="scene-cards">
    <div v-for="s in SCENES" :key="s.key" :class="['scene-card', { active: scene === s.key }]" @click="applyScene(s)">
      <div class="scene-icon">{{ s.icon }}</div>
      <div class="scene-label">{{ s.label }}</div>
      <div class="scene-desc">{{ s.desc }}</div>
    </div>
  </div>

  <!-- 起点 -->
  <div class="card" style="margin-top:10px">
    <div class="addr-quick"><span>地址簿：</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:10px;margin:1px" @click="pickAddr(k,'from')">{{ k }}</button><button class="btn btn-sm" style="background:#f08ca4;color:#fff;font-size:10px" @click="showAddrModal=true">+管理</button></div>
    <div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:#8a8098;font-weight:600">📍 起点</label><span v-if="devUnlocked" style="display:flex;gap:3px"><button class="btn btn-sm" style="background:#f08ca4;color:#fff;font-size:9px;padding:2px 8px" @click="quickFill('from','家')">家</button><button class="btn btn-sm" style="background:#f08ca4;color:#fff;font-size:9px;padding:2px 8px" @click="quickFill('from','公司')">公司</button></span></div>
    <div class="row" style="position:relative">
      <input v-model="from.name" placeholder="输入地名搜索（GPS自动定位）" style="flex:1" @input="onNameInput('from')" @focus="onNameInput('from')" @blur="setTimeout(closeSuggest,200)">
      <button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="doGeocode('from')">🔍</button>
      <button class="btn btn-sm" style="background:#42a5f5;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="locateMe('from')">📍</button>
      <div v-if="showSuggest && activeSuggest==='from'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>

    <!-- 终点（可选，折叠） -->
    <div v-if="showCustom" style="margin-top:8px">
      <div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:#8a8098;font-weight:600">📍 终点 <span style="font-size:10px;color:#a898b8">(不填=环线)</span></label></div>
      <div class="row" style="position:relative">
        <input v-model="to.name" placeholder="可选目的地" style="flex:1" @input="onNameInput('to')" @focus="onNameInput('to')" @blur="setTimeout(closeSuggest,200)">
        <button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="doGeocode('to')">🔍</button>
        <button class="btn btn-sm" style="background:#42a5f5;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="locateMe('to')">📍</button>
      </div>
    </div>

    <!-- 自定义展开 -->
    <button class="btn btn-sm" style="background:transparent;color:#a898b8;font-size:10px;margin-top:6px;width:auto;display:block" @click="showCustom=!showCustom">
      {{ showCustom ? '▲ 收起自定义' : '▼ 自定义（方向/时长/终点）' }}
    </button>
    <div v-if="showCustom" class="custom-panel">
      <label style="font-size:11px;color:#8a8098;font-weight:600;margin:6px 0 4px;display:block">🧭 方向</label>
      <div class="compass-row">
        <button v-for="d in COMPASS" :key="d.key" :class="['chip', { active: direction === d.key }]" @click="direction = d.key">{{ d.label }}</button>
      </div>
      <label style="font-size:11px;color:#8a8098;font-weight:600;margin:8px 0 4px;display:block">⏱ 时长</label>
      <div class="time-chips">
        <button v-for="t in [{m:30,l:'30m'},{m:60,l:'1h'},{m:120,l:'2h'},{m:180,l:'3h'},{m:300,l:'半天'}]" :key="t.m" :class="['chip', { active: timeMin === t.m }]" @click="timeMin = t.m">{{ t.l }}</button>
      </div>
      <p style="font-size:10px;color:#a898b8;margin-top:4px">≈ {{ (timeMin * BIKE_SPEED / 60).toFixed(0) }}km ({{ BIKE_SPEED }}km/h)</p>
    </div>
  </div>

  <!-- 操作按钮 -->
  <button class="btn btn-primary" :disabled="loading" @click="doGenerate(false)" style="font-size:18px;padding:16px">{{ loading ? '生成中…' : scene === 'random' ? '🎲 随机出发！' : scene === 'casual' ? '🌅 休闲出发！' : '🏋 开始训练！' }}</button>
  <button class="btn btn-secondary" :disabled="loading" @click="doGenerateMultiple" style="margin-top:6px;font-size:12px">📋 多生成几条对比</button>

  <!-- Loading -->
  <div v-if="loading" class="loading-overlay card">
    <div class="progress-ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" :style="{strokeDasharray:163.36,strokeDashoffset:163.36-(progress/100)*163.36}"/></svg>
      <div class="txt">{{ progress }}%</div>
    </div>
    <p class="loading-hint">{{ loadingHint }}</p>
    <div class="retry-dots"><span v-for="(d,i) in retryDots" :key="i" :class="'retry-dot '+d"></span></div>
    <p class="try-count">{{ tryInfo }}</p>
  </div>

  <!-- 多路线 -->
  <div v-if="multiResults.length > 1" class="multi-cards">
    <div v-for="(r,i) in multiResults" :key="i" :class="['multi-card',{active:activeResultIdx===i}]" @click="selectMulti(i)">
      <div style="font-weight:700;font-size:13px;color:#5e5468">{{ hasDest ? '路线' : '环线' }} {{ i+1 }}</div>
      <div style="font-size:11px;color:#a898b8">{{ (r.totalDistance/1000).toFixed(1) }}km · {{ Math.round(r.totalDuration/60) }}min · ↗{{ r.totalClimb||0 }}m</div>
      <RouteThumbnail :segments="r.segments" :waypoints="r.waypoints" :home="homeObj" :work="workObj" :uphillSections="r.uphillSections" :downhillSections="r.downhillSections" />
    </div>
  </div>

  <!-- 结果 -->
  <div v-if="resultShow && result" class="card" style="animation:cardIn .4s cubic-bezier(.34,1.56,.64,1)">
    <div class="stats">
      <div class="stat"><div class="val">{{ (result.totalDistance/1000).toFixed(1) }}</div><div class="lbl">总距离 km</div></div>
      <div class="stat"><div class="val">{{ Math.round(result.totalDuration/60) }}</div><div class="lbl">预计 分钟</div></div>
      <div class="stat"><div class="val small" :style="{color: diffObj?.color}">{{ diffObj?.label }}</div><div class="lbl">难度</div></div>
    </div>
    <RouteThumbnail :segments="result.segments" :waypoints="result.waypoints" :home="homeObj" :work="workObj" :uphillSections="result.uphillSections" :downhillSections="result.downhillSections" />
    <div class="route-thumb-legend"><span>🟢 起点</span><span>🟠 终点</span><span>🔵 途经点</span><span>🔴 上坡</span><span>🟢 下坡</span><span>⬆ 北</span></div>
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
      <div v-if="result.uphillSections?.length" class="slope-box uphill"><div class="slope-title">🔴 上坡路段 (坡度≥5%)</div><div class="slope-item" v-for="(sec,i) in result.uphillSections" :key="'u'+i"><span class="slope-badge" :class="sec.avgGrade>=8?'steep':'moderate'">{{ sec.avgGrade>=8?'🔴':'🟠' }} 第{{ i+1 }}段</span><span class="slope-data">{{ sec.length }}km ↗{{ sec.climb }}m</span><span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span></div></div>
      <div v-if="result.downhillSections?.length" class="slope-box downhill"><div class="slope-title">🟢 下坡路段 (坡度≥5%)</div><div class="slope-item" v-for="(sec,i) in result.downhillSections" :key="'d'+i"><span class="slope-badge">{{ sec.avgGrade>=8?'🟢':'🟢' }} 第{{ i+1 }}段</span><span class="slope-data">{{ sec.length }}km ↘{{ sec.descent }}m</span><span class="slope-grade">均{{ sec.avgGrade }}% / 最{{ sec.maxGrade }}%</span></div></div>
    </div>
    <button class="btn btn-nav" @click="openNav">开始导航</button>
    <div class="nav-link-box"><div class="label">高德导航链接（可复制）：</div><div class="url">{{ navUrl }}</div></div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-sm btn-secondary" style="flex:1" @click="copyNav">复制</button><button class="btn btn-sm btn-secondary" style="flex:1" @click="downloadGpx">GPX</button><button class="btn btn-sm btn-secondary" style="flex:1;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff" @click="doShare">📤 分享</button></div>
    <button class="btn btn-secondary" style="margin-top:8px" @click="doGenerate(true)">换一条</button>
  </div>

  <!-- 地址管理弹窗 -->
  <div class="modal" v-if="showAddrModal" @click.self="showAddrModal=false">
    <div class="inner">
      <div style="display:flex;align-items:center;justify-content:space-between"><h3>管理地址簿</h3><div style="display:flex;align-items:center;gap:4px"><span v-if="devUnlocked" style="font-size:10px;color:#22c55e">🔓</span><button v-if="!showPwdInput" class="btn btn-sm" style="background:transparent;color:#a898b8;font-size:9px;padding:2px 6px" @click="showPwdInput=true">🔧</button><input v-if="showPwdInput" v-model="pwdValue" type="password" placeholder="密码" style="width:80px;font-size:10px;padding:3px 6px" @keyup.enter="checkPassword"><button v-if="showPwdInput" class="btn btn-sm" style="background:#f08ca4;color:#fff;font-size:9px;padding:3px 8px" @click="checkPassword">OK</button></div></div>
      <div v-if="Object.keys(addresses).length>0" style="margin-bottom:10px;max-height:150px;overflow-y:auto"><div v-for="(v,k) in addresses" :key="k" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin:3px 0;background:#faf7fc;border-radius:8px;font-size:12px"><span><strong>{{ k }}</strong> — {{ v.name }} <span style="color:#a898b8;font-size:10px">({{ typeof v.lng==='number'?v.lng.toFixed(4):v.lng }}, {{ typeof v.lat==='number'?v.lat.toFixed(4):v.lat }})</span></span><button class="btn btn-sm" style="background:#ff5252;color:#fff;font-size:9px;padding:2px 6px;flex-shrink:0;margin-left:8px" @click="deleteSavedAddr(k)">🗑</button></div></div>
      <div v-else style="text-align:center;color:#a898b8;font-size:12px;margin-bottom:10px">还没有保存的地址哦~</div>
      <hr style="border:none;border-top:1px dashed #ece0ec;margin:10px 0">
      <h3 style="font-size:13px;color:#8a8098;margin-bottom:4px">添加新地址</h3>
      <label style="font-size:11px;color:#a898b8">① 别名</label><input v-model="newAddr.alias" placeholder="如：家、公司">
      <label style="font-size:11px;color:#a898b8">② 名称</label><div class="row"><input v-model="newAddr.name" placeholder="如：西安钟楼" style="flex:1"><button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0" @click="geocodeNewAddr">🔍 查询坐标</button></div>
      <label style="font-size:11px;color:#a898b8">③ 坐标</label><input v-model="newAddr.lng" placeholder="经度"><input v-model="newAddr.lat" placeholder="纬度">
      <p style="font-size:11px;color:#a898b8;margin-bottom:10px">💡 用 <a href="https://lbs.amap.com/tools/picker" target="_blank">高德坐标拾取器</a> 手动获取</p>
      <div class="btn-row"><button class="btn btn-secondary" @click="showAddrModal=false">关闭</button><button class="btn btn-primary" @click="saveNewAddr">保存地址</button></div>
    </div>
  </div>
</div>
</template>
