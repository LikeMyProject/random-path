<script setup>
import { ref, computed, onMounted } from 'vue'
import { haversine } from '../utils/math.js'
import { geocode } from '../composables/useAMap.js'
import { loadAddresses, saveAddresses, deleteAddress, saveHistory, saveLastRoute, loadLastRoute } from '../composables/useStorage.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import { tryGenerateRoute, MAX_RETRIES, nameWaypoint, buildNavUrl, openNavigation, buildGPX, calcCalories } from '../composables/useRouteEngine.js'
import { rateDifficulty } from '../composables/useScoring.js'
import { generateShareImage, shareImage } from '../composables/useShareCard.js'
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
  // 恢复上次路线
  const last = loadLastRoute()
  if (last && last.type === 'commute' && last.home && last.work) {
    from.value = { name: last.home.name, lng: String(last.home.lng), lat: String(last.home.lat) }
    to.value = { name: last.work.name, lng: String(last.work.lng), lat: String(last.work.lat) }
    if (last.sectorMode) sectorMode.value = last.sectorMode
    if (last.maxKm) maxKm.value = last.maxKm
    result.value = { waypoints: last.waypoints || [], segments: last.segments || [], totalDistance: last.totalDistance, totalDuration: last.totalDuration, sector: last.sector, totalClimb: last.totalClimb }
    resultShow.value = true
  }
})

function onNameInput(target) { activeSuggest.value = target; searchAddress(target === 'from' ? from.value.name : to.value.name) }
function selectSugg(i) { const p = pickSuggestion(i); if (!p) return; if (activeSuggest.value === 'from') from.value = { name: p.name, lng: p.lng, lat: p.lat }; else to.value = { name: p.name, lng: p.lng, lat: p.lat }; activeSuggest.value = ''; toast(p.name) }
function pickAddr(a, t) { const ad = addresses[a]; if (!ad) return; if (t === 'from') from.value = { name: ad.name, lng: ad.lng, lat: ad.lat }; else to.value = { name: ad.name, lng: ad.lng, lat: ad.lat }; toast(a) }
async function doGeocode(t) {
  const n = t === 'from' ? from.value.name : to.value.name; if (!n.trim()) { toast('请输入地名', 'warn'); return }
  const r = await geocode(n, '西安'); if (r) { if (t === 'from') from.value = { name: r.name, lng: r.lng, lat: r.lat }; else to.value = { name: r.name, lng: r.lng, lat: r.lat }; toast('已获取坐标 ✅') } else toast('未找到该地点，请尝试更具体的名称（如"钟楼"→"西安钟楼"）', 'warn')
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
    if (route.waypoints.length > 0) { tryInfo.value = '正在获取途经点地名…'; await Promise.all(route.waypoints.map(async (wp) => { wp.poiName = await nameWaypoint(wp.lng, wp.lat) })) }
    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = route; resultShow.value = true; loading.value = false
    saveHistory({ type: 'commute', home: h.name, work: w.name, distance: route.totalDistance, sector: route.sector, waypoints: route.waypoints.map(w => ({ lng: w.lng, lat: w.lat, name: w.poiName })) })
    // 保存最后路线到本地，切到高德返回后自动恢复
    saveLastRoute({ type: 'commute', home: h, work: w, waypoints: route.waypoints, segments: route.segments, totalDistance: route.totalDistance, totalDuration: route.totalDuration, sector: route.sector, totalClimb: route.totalClimb, sectorMode: sectorMode.value, maxKm: maxKm.value })
  } catch (e) { toast('错误: ' + e.message, 'err'); loading.value = false }
}

const diffObj = computed(() => result.value ? rateDifficulty(result.value.totalDistance, result.value.totalClimb) : null)
const navUrl = computed(() => result.value && homeObj.value && workObj.value ? buildNavUrl(homeObj.value, workObj.value, result.value.waypoints) : '')
function openNav() { if (result.value && homeObj.value && workObj.value) openNavigation(homeObj.value, workObj.value, result.value.waypoints) }
function copyNav() { if (navUrl.value) { navigator.clipboard?.writeText(navUrl.value); toast('已复制') } }
function downloadGpx() { if (result.value && homeObj.value && workObj.value) { const gpx = buildGPX(result.value, homeObj.value, workObj.value); const blob = new Blob([gpx], { type: 'application/gpx+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `RandomPath_${homeObj.value.name}_${workObj.value.name}_${(result.value.totalDistance/1000).toFixed(1)}km.gpx`; a.click(); URL.revokeObjectURL(a.href) } }
async function doShare() {
  if (!result.value) return
  const route = result.value
  const h = homeObj.value, w = workObj.value
  const canvas = generateShareImage({
    title: (h?.name || '?') + ' → ' + (w?.name || '?'),
    subtitle: (route.totalDistance / 1000).toFixed(1) + ' km · ' + Math.round(route.totalDuration / 60) + ' min',
    totalDistance: route.totalDistance, totalDuration: route.totalDuration,
    segments: route.segments, waypoints: route.waypoints, home: h, work: w,
    stats: [
      { label: '总距离', value: (route.totalDistance / 1000).toFixed(1) + ' km' },
      { label: '预计', value: Math.round(route.totalDuration / 60) + ' 分钟' },
      { label: '途经点', value: route.waypoints.length + ' 个' },
    ]
  })
  const result = await shareImage(canvas, `RandomPath_${(h?.name||'route')}_${(route.totalDistance/1000).toFixed(1)}km.png`)
  if (result === 'shared') toast('已分享 🎉')
  else toast('已下载 📥')
}

const showAddrModal = ref(false), newAddr = ref({ alias: '', name: '', lng: '', lat: '' })
function saveNewAddr() { const a = newAddr.value; if (!a.alias || !a.name || !a.lng || !a.lat) { toast('请填写完整', 'warn'); return }; addresses[a.alias] = { name: a.name, lng: parseFloat(a.lng), lat: parseFloat(a.lat) }; saveAddresses(addresses); newAddr.value = { alias: '', name: '', lng: '', lat: '' }; showAddrModal.value = false; toast('地址已保存') }
function deleteSavedAddr(alias) { if (!confirm(`确定删除地址「${alias}」吗？`)) return; if (deleteAddress(alias)) { toast(`已删除「${alias}」`) } else { toast('删除失败', 'warn') } }
async function geocodeNewAddr() {
  const n = newAddr.value.name; if (!n.trim()) { toast('请先输入地址名称', 'warn'); return }
  toast('正在查询坐标（西安市范围）…')
  const r = await geocode(n, '西安')
  if (r) { newAddr.value.lng = String(r.lng); newAddr.value.lat = String(r.lat); newAddr.value.name = r.name; toast('已获取坐标 ✅') }
  else toast('未找到该地点，请尝试更具体的名称（如"钟楼"→"西安钟楼"）', 'warn')
}
</script>

<template>
<div>
  <div class="card">
    <div class="addr-quick"><span>起点地址簿：</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:10px;margin:1px" @click="pickAddr(k,'from')">{{ k }}</button><button class="btn btn-sm" style="background:#f08ca4;color:#fff;font-size:10px" @click="showAddrModal=true">+管理</button></div>
    <label style="font-size:12px;color:#8a8098;font-weight:600">起点</label>
    <div class="row" style="position:relative">
      <input v-model="from.name" placeholder="输入地名搜索（如：西安钟楼）" style="flex:1" @input="onNameInput('from')" @focus="onNameInput('from')" @blur="setTimeout(closeSuggest,200)">
      <button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="doGeocode('from')">🔍</button>
      <button class="btn btn-sm" style="background:#42a5f5;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="locateMe('from')">📍</button>
      <div v-if="showSuggest && activeSuggest==='from'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>
    <div class="row"><input v-model="from.lng" type="number" step="0.000001" placeholder="经度（自动填入或手动输入）" style="flex:1"><input v-model="from.lat" type="number" step="0.000001" placeholder="纬度（自动填入或手动输入）" style="flex:1"></div>

    <div class="addr-quick" style="margin-top:10px"><span>终点地址簿：</span><button v-for="(v,k) in addresses" :key="k" class="btn btn-sm" style="background:#334155;color:#e2e8f0;font-size:10px;margin:1px" @click="pickAddr(k,'to')">{{ k }}</button></div>
    <label style="font-size:12px;color:#8a8098;font-weight:600;margin-top:6px">终点</label>
    <div class="row" style="position:relative">
      <input v-model="to.name" placeholder="输入地名搜索（如：西安钟楼）" style="flex:1" @input="onNameInput('to')" @focus="onNameInput('to')" @blur="setTimeout(closeSuggest,200)">
      <button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="doGeocode('to')">🔍</button>
      <button class="btn btn-sm" style="background:#42a5f5;color:#fff;flex-shrink:0;padding:6px 10px;font-size:11px" @click="locateMe('to')">📍</button>
      <div v-if="showSuggest && activeSuggest==='to'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
    </div>
    <div class="row"><input v-model="to.lng" type="number" step="0.000001" placeholder="经度（自动填入或手动输入）" style="flex:1"><input v-model="to.lat" type="number" step="0.000001" placeholder="纬度（自动填入或手动输入）" style="flex:1"></div>

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
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-sm btn-secondary" style="flex:1" @click="copyNav">复制</button><button class="btn btn-sm btn-secondary" style="flex:1" @click="downloadGpx">GPX</button><button class="btn btn-sm btn-secondary" style="flex:1;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff" @click="doShare">📤 分享</button></div>
    <button class="btn btn-secondary" style="margin-top:8px" @click="doGenerate(true)">换一条</button>
  </div>

  <div class="modal" v-if="showAddrModal" @click.self="showAddrModal=false">
    <div class="inner">
      <h3>管理地址簿</h3>
      <!-- 已有地址列表 -->
      <div v-if="Object.keys(addresses).length>0" style="margin-bottom:10px;max-height:150px;overflow-y:auto">
        <div v-for="(v,k) in addresses" :key="k" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin:3px 0;background:#faf7fc;border-radius:8px;font-size:12px">
          <span><strong>{{ k }}</strong> — {{ v.name }} <span style="color:#a898b8;font-size:10px">({{ typeof v.lng==='number' ? v.lng.toFixed(4) : v.lng }}, {{ typeof v.lat==='number' ? v.lat.toFixed(4) : v.lat }})</span></span>
          <button class="btn btn-sm" style="background:#ff5252;color:#fff;font-size:9px;padding:2px 6px;flex-shrink:0;margin-left:8px" @click="deleteSavedAddr(k)">🗑</button>
        </div>
      </div>
      <div v-else style="text-align:center;color:#a898b8;font-size:12px;margin-bottom:10px">还没有保存的地址哦~</div>
      <hr style="border:none;border-top:1px dashed #ece0ec;margin:10px 0">
      <h3 style="font-size:13px;color:#8a8098;margin-bottom:4px">添加新地址</h3>
      <label style="font-size:11px;color:#a898b8">① 别名（用于快捷选择）</label>
      <input v-model="newAddr.alias" placeholder="如：家、公司、钟楼">
      <label style="font-size:11px;color:#a898b8">② 地址名称（用于搜索定位）</label>
      <div class="row"><input v-model="newAddr.name" placeholder="如：西安钟楼" style="flex:1"><button class="btn btn-sm" style="background:#f97316;color:#fff;flex-shrink:0" @click="geocodeNewAddr">🔍 查询坐标</button></div>
      <label style="font-size:11px;color:#a898b8">③ 坐标（查询后自动填入，也可手动修改）</label>
      <input v-model="newAddr.lng" placeholder="经度"><input v-model="newAddr.lat" placeholder="纬度">
      <p style="font-size:11px;color:#a898b8;margin-bottom:10px">💡 先填名称 → 点「查询坐标」自动获取经纬度。搜索不准可手动修改坐标，或使用 <a href="https://lbs.amap.com/tools/picker" target="_blank">高德坐标拾取器</a></p>
      <div class="btn-row"><button class="btn btn-secondary" @click="showAddrModal=false">关闭</button><button class="btn btn-primary" @click="saveNewAddr">保存地址</button></div>
    </div>
  </div>
</div>
</template>
