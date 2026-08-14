<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { geocode, setDetectedCity, detectCityFromGPS, getDetectedCity } from '../composables/useAMap.js'
import { loadAddresses, saveAddresses, deleteAddress, saveHistory, saveLastRoute, loadLastRoute } from '../composables/useStorage.js'
import { useSuggest } from '../composables/useAutoComplete.js'
import { tryGenerateRoute, generateCompassLoop, generateMultipleRoutes, MAX_RETRIES, BIKE_SPEED, COMPASS, nameWaypoint, buildNavUrl, openNavigation, buildGPX, fetchOptimalBikeRoute, calcSlopeProfile } from '../composables/useRouteEngine.js'
import { generateShareImage, shareImage } from '../composables/useShareCard.js'
import { useRouteContext } from '../composables/useRouteContext.js'
import RouteThumbnail from '../components/RouteThumbnail.vue'
import ResultView from './ResultView.vue'
import SceneCards from '../components/SceneCards.vue'

const toast = (m, t) => window.$toast?.(m, t)
const addresses = loadAddresses()
const { suggestions, showSuggest, searchAddress, pickSuggestion, closeSuggest } = useSuggest()

// === 场景模式 ===
const scene = ref('destination')
const showAdvanced = ref(false)

// === 骑到某处模式 ===
const destName = ref('')
const destCoord = ref(null)
const destEstimate = ref(null)
// 行程类型：单程 / 往返（默认单程 = 走最短最优路线骑到目的地）
const tripType = ref('oneway')  // 'oneway' | 'round'

// === 附近起点模式 ===
const nearbyMode = ref(false)
const homeDist = ref(0)
const homeAddr = ref(null)

// === 位置搜索面板 ===
const showLocationSearch = ref(false)
const locationSearchName = ref('')

function calcDistKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const sa = Math.sin(dLat / 2), sb = Math.sin(dLng / 2)
  return R * 2 * Math.asin(Math.sqrt(sa * sa + Math.cos(lat1) * Math.cos(lat2) * sb * sb))
}

// === 地址 ===
const from = ref({ name: '', lng: '', lat: '' }), to = ref({ name: '', lng: '', lat: '' })
const activeSuggest = ref('')
const hasDest = computed(() => (to.value.name && to.value.lng && to.value.lat) || (scene.value === 'destination' && !!destCoord.value))

// === 自定义参数 ===
const direction = ref('random')

// === 距离滑块 ===
const customDist = ref(null) // null = 用场景默认

const DIST_RANGES = {
  loop: { min: 5, max: 200, default: 20 },
}

// === 指定目的地：路线策略（最优 / 随机）===
const routeStrategy = ref('optimal')  // 'optimal' | 'random'

const distRange = computed(() => DIST_RANGES[scene.value] || null)

watch(scene, (s) => {
  if (s === 'destination') {
    destName.value = ''
    destCoord.value = null
    destEstimate.value = null
  } else if (s === 'loop') {
    // 指定距离环线：距离用滑块默认值，方向随机
    direction.value = 'random'
    if (!customDist.value) customDist.value = DIST_RANGES[s]?.default || 20
  }
})

// 目标距离
const targetDist = computed(() => {
  if (scene.value === 'destination') return 20000
  // 指定距离环线：用滑块值，未设则用默认
  if (customDist.value) return customDist.value * 1000
  return (DIST_RANGES.loop?.default || 20) * 1000
})

const estimatedTime = computed(() => {
  const km = targetDist.value / 1000
  return Math.round(km / BIKE_SPEED * 60)
})

const homeObj = computed(() => { const l = parseFloat(from.value.lng), a = parseFloat(from.value.lat); return (l && a && from.value.name) ? { lng: l, lat: a, name: from.value.name } : null })
const workObj = computed(() => {
  if (scene.value === 'destination' && destCoord.value) return { name: destCoord.value.name, lng: destCoord.value.lng, lat: destCoord.value.lat }
  if (to.value.name && to.value.lng && to.value.lat) return { name: to.value.name, lng: parseFloat(to.value.lng), lat: parseFloat(to.value.lat) }
  return homeObj.value
})

// === 生成状态 ===
const loading = ref(false), loadingHint = ref(''), tryInfo = ref(''), progress = ref(0)
const result = ref(null), resultShow = ref(false), collapseOpen = ref(false)
const multiResults = ref([]), activeResultIdx = ref(0)
const multiMode = ref(false) // 对比模式开关

// === 沿途上下文 ===
const { villages, supplyPoints, routeTags, loadContext } = useRouteContext()

// === 初始化 ===
onMounted(async () => {
  // 先加载家/公司地址
  if (addresses['家']) {
    from.value = { name: addresses['家'].name, lng: addresses['家'].lng, lat: addresses['家'].lat }
    homeAddr.value = { name: addresses['家'].name, lng: parseFloat(addresses['家'].lng), lat: parseFloat(addresses['家'].lat) }
  }
  if (addresses['公司']) to.value = { name: addresses['公司'].name, lng: addresses['公司'].lng, lat: addresses['公司'].lat }

  // 初始化距离滑块默认值（环线场景用）
  customDist.value = DIST_RANGES[scene.value]?.default || null

  const last = loadLastRoute()
  if (last && (last.type === 'commute' || last.type === 'loop') && last.home) {
    from.value = { name: last.home.name, lng: String(last.home.lng), lat: String(last.home.lat) }
    if (last.work && last.work.name !== last.home.name) to.value = { name: last.work.name, lng: String(last.work.lng), lat: String(last.work.lat) }
    if (last.direction) direction.value = last.direction
    if (last.scene) scene.value = last.scene
    result.value = { waypoints: last.waypoints || [], segments: last.segments || [], totalDistance: last.totalDistance, totalDuration: last.totalDuration, totalClimb: last.totalClimb, uphillSections: last.uphillSections || [], downhillSections: last.downhillSections || [] }
    resultShow.value = true; return
  }

  // GPS 定位 + 附近模式检测
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) => { navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }) })
      const { longitude: lng, latitude: lat } = pos.coords

      if (!addresses['家'] || !homeAddr.value) {
        from.value = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
        try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) from.value.name = name; if (city) setDetectedCity(city) } catch(e) {}
      } else {
        const dist = calcDistKm({ lat, lng }, homeAddr.value)
        homeDist.value = Math.round(dist * 10) / 10
        if (dist > 2) {
          nearbyMode.value = true
          from.value = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
          try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) from.value.name = name; if (city) setDetectedCity(city) } catch(e) {}
        } else {
          nearbyMode.value = false
        }
      }
    } catch(e) {}
  }
})

// === 位置搜索 ===
function openLocationSearch() {
  locationSearchName.value = from.value.name || ''
  showLocationSearch.value = true
}
function onLocationInput() { activeSuggest.value = 'from'; searchAddress(locationSearchName.value) }
function selectLocationSugg(i) {
  const p = pickSuggestion(i)
  if (!p) return
  from.value = { name: p.name, lng: p.lng, lat: p.lat }
  showLocationSearch.value = false
  activeSuggest.value = ''
  toast(p.name)
}
function confirmLocation() {
  const n = locationSearchName.value.trim()
  if (!n) { toast('请输入地名', 'warn'); return }
  from.value = { name: n, lng: '', lat: '' }
  doGeocode('from').then(() => {
    if (from.value.lng) { showLocationSearch.value = false; toast('位置已更新') }
  })
}
function locateFromSearch() {
  if (!navigator.geolocation) { toast('浏览器不支持定位', 'warn'); return }
  toast('正在定位…')
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { longitude: lng, latitude: lat } = pos.coords
    from.value = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
    try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) from.value.name = name; if (city) setDetectedCity(city) } catch(e) {}
    showLocationSearch.value = false
    toast('已获取当前位置')
  }, () => { toast('定位失败', 'warn') }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
}

// === 地址操作（高级面板用） ===
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

function toggleNearby() {
  if (nearbyMode.value) {
    if (homeAddr.value) {
      from.value = { name: homeAddr.value.name, lng: String(homeAddr.value.lng), lat: String(homeAddr.value.lat) }
    }
    nearbyMode.value = false
  } else {
    locateMe('from')
    nearbyMode.value = true
  }
}

const destLoading = ref(false)

async function searchDestination() {
  if (!destName.value.trim()) { toast('请输入目的地', 'warn'); return }
  destLoading.value = true
  try {
    const r = await geocode(destName.value, getDetectedCity())
    if (!r) { toast('未找到该地点', 'warn'); destLoading.value = false; return }
    destCoord.value = { lng: r.lng, lat: r.lat, name: r.name }
    destName.value = r.name

    const h = homeObj.value || { lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
    if (h.lng && h.lat && r.lng && r.lat) {
      const straightKm = calcDistKm({ lng: h.lng, lat: h.lat }, { lng: r.lng, lat: r.lat })
      if (straightKm < 0.5) {
        toast('起点坐标可能未设置，请先在地图中定位起点', 'warn')
        destLoading.value = false; return
      }
      const oneWayKm = Math.round(straightKm * 1.5 * 10) / 10
      const oneWayMin = Math.round(oneWayKm / BIKE_SPEED * 60)
      destEstimate.value = {
        oneWayKm,
        oneWayMin,
        roundKm: Math.round(oneWayKm * 2 * 10) / 10,
        roundMin: oneWayMin * 2,
      }
    }
    toast(`已定位：${r.name}`)
  } catch(e) { toast('搜索失败', 'err') }
  destLoading.value = false
}

// === 统一生成入口 ===
function handleGenerate() {
  if (scene.value === 'destination') {
    doGenerateDestination()
  } else if (multiMode.value) {
    doGenerateMultiple()
  } else {
    doGenerate(false)
  }
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
  const td = targetDist.value
  const effDir = direction.value
  const dirDeg = COMPASS.find(c => c.key === effDir)?.deg ?? null
  const onTry = (a, d, e) => {
    progress.value = Math.round((a / MAX_RETRIES) * 100)
    loadingHint.value = e ? `尝试第 ${a} 条路线…` : `已找到 ${(d/1000).toFixed(1)} km 路线，验证中…`
    tryInfo.value = e ? '' : `${(d/1000).toFixed(1)} km`
  }
  try {
    const route = isLoop
      ? await tryGenerateRoute(h, h, { minDist: Math.round(td * 0.55), maxDist: Math.round(td * 1.5), waypointGenerator: () => generateCompassLoop(h, td, dirDeg), onTry })
      : await tryGenerateRoute(h, w, { minDist: Math.round(td * 0.6), maxDist: Math.round(td * 1.4), directionDeg: dirDeg, onTry })
    if (!route) { toast('生成失败，请重试', 'err'); loading.value = false; return }
    if (route.waypoints.length > 0) { loadingHint.value = '正在获取途经点地名…'; await Promise.all(route.waypoints.map(async (wp) => { wp.poiName = await nameWaypoint(wp.lng, wp.lat) })) }
    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = route; resultShow.value = true; loading.value = false
    saveHistory({ type: 'explore', home: h.name, work: w.name, distance: route.totalDistance, waypoints: route.waypoints.map(wp => ({ lng: wp.lng, lat: wp.lat, name: wp.poiName })) })
    saveLastRoute({ type: 'explore', home: h, work: w, waypoints: route.waypoints, segments: route.segments, totalDistance: route.totalDistance, totalDuration: route.totalDuration, totalClimb: route.totalClimb, uphillSections: route.uphillSections, downhillSections: route.downhillSections, direction: direction.value, scene: scene.value })
    loadContext(route.segments, route.waypoints, { totalClimb: route.totalClimb, uphillSections: route.uphillSections, downhillSections: route.downhillSections, waypoints: route.waypoints, totalDistance: route.totalDistance }).catch(() => {})
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
  const effDir = direction.value
  const dirDeg = COMPASS.find(c => c.key === effDir)?.deg ?? null
  loading.value = true; loadingHint.value = '正在同时生成 3 条路线…'
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

// === 骑到某处：走高德最优（最短）路线，可选单程/往返，无随机途经点 ===
async function doGenerateDestination() {
  if (!destCoord.value) { toast('请先搜索目的地', 'warn'); return }
  const h = homeObj.value || { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  if (!h.lng || !h.lat) { toast('请完善起点', 'warn'); return }
  const d = destCoord.value

  resultShow.value = false; multiResults.value = []
  loading.value = true; progress.value = 0; loadingHint.value = '正在规划路线…'; tryInfo.value = ''

  const isRound = tripType.value === 'round'
  const isOptimal = routeStrategy.value === 'optimal'
  try {
    // 去程：最优=高德最短路线（避让高速）；随机=随机途经点绕到目的地
    let outSegs, outWps, outDist, outDur
    if (isOptimal) {
      const out = await fetchOptimalBikeRoute(h, d)
      if (!out) { toast('规划失败，请重试', 'err'); loading.value = false; return }
      outSegs = [{ ...out, from: h, to: d, idx: 0 }]
      outWps = []; outDist = out.distance; outDur = out.duration
    } else {
      loadingHint.value = '正在生成随机路线…'
      const r = await tryGenerateRoute(h, d, {
        minDist: 6000, maxDist: 90000, directionDeg: null, sectorMode: 'mixed',
        onTry: (a, dist, e) => { progress.value = Math.round((a / MAX_RETRIES) * (isRound ? 30 : 50)); loadingHint.value = e ? `尝试第 ${a} 条…` : `已生成 ${(dist/1000).toFixed(1)}km` },
      })
      if (!r) { toast('规划失败，请重试', 'err'); loading.value = false; return }
      outSegs = r.segments; outWps = r.waypoints; outDist = r.totalDistance; outDur = r.totalDuration
    }

    let segments, waypoints, totalDistance, totalDuration
    if (!isRound) {
      segments = outSegs; waypoints = outWps; totalDistance = outDist; totalDuration = outDur
    } else {
      // 返程：与去程同策略
      loadingHint.value = '正在规划返程…'
      let backSegs, backWps, backDist, backDur
      if (isOptimal) {
        const back = await fetchOptimalBikeRoute(d, h)
        if (!back) { toast('返程规划失败，请重试', 'err'); loading.value = false; return }
        backSegs = [{ ...back, from: d, to: h, idx: outSegs.length }]
        backWps = []; backDist = back.distance; backDur = back.duration
      } else {
        const r2 = await tryGenerateRoute(d, h, {
          minDist: 6000, maxDist: 90000, directionDeg: null, sectorMode: 'mixed',
          onTry: (a, dist, e) => { progress.value = 50 + Math.round((a / MAX_RETRIES) * 50); loadingHint.value = e ? `返程尝试第 ${a} 条…` : `返程 ${(dist/1000).toFixed(1)}km` },
        })
        if (!r2) { toast('返程规划失败，请重试', 'err'); loading.value = false; return }
        backSegs = r2.segments; backWps = r2.waypoints; backDist = r2.totalDistance; backDur = r2.totalDuration
      }
      segments = [...outSegs, ...backSegs]
      waypoints = [...outWps, { lng: d.lng, lat: d.lat, poiName: d.name || '🎯 目的地' }, ...backWps]
      totalDistance = outDist + backDist
      totalDuration = outDur + backDur
    }
    segments.forEach((s, i) => { s.idx = i })

    // 坡度分析
    loadingHint.value = '正在分析坡度…'
    let slopeProfile = null
    try { slopeProfile = await calcSlopeProfile(segments) } catch (e) { console.error('[doGenerateDestination] slope failed:', e) }

    const route = {
      segments,
      waypoints,
      totalDistance,
      totalDuration,
      totalClimb: slopeProfile?.totalClimb ?? null,
      uphillSections: slopeProfile?.uphillSections ?? [],
      downhillSections: slopeProfile?.downhillSections ?? [],
      elevationProfile: slopeProfile?.elevationProfile ?? null,
      isRoundTrip: isRound,
      destName: d.name,
      optimal: isOptimal,
    }

    if (route.waypoints.length > 0) {
      loadingHint.value = '正在获取途经点地名…'
      await Promise.all(route.waypoints.map(async (wp) => { if (!wp.poiName) wp.poiName = await nameWaypoint(wp.lng, wp.lat) }))
    }

    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = route; resultShow.value = true; loading.value = false

    saveHistory({ type: isRound ? 'roundtrip' : 'oneway', home: h.name, work: d.name, distance: totalDistance, waypoints: route.waypoints.map(wp => ({ lng: wp.lng, lat: wp.lat, name: wp.poiName })) })
    saveLastRoute({ type: isRound ? 'roundtrip' : 'oneway', home: h, work: d, waypoints: route.waypoints, segments: route.segments, totalDistance, totalDuration, totalClimb: route.totalClimb, uphillSections: route.uphillSections, downhillSections: route.downhillSections, direction: direction.value, scene: 'destination', tripType: tripType.value, routeStrategy: routeStrategy.value })
    loadContext(route.segments, route.waypoints, { totalClimb: route.totalClimb, uphillSections: route.uphillSections, downhillSections: route.downhillSections, waypoints: route.waypoints, totalDistance }).catch(() => {})
  } catch (e) { toast('错误: ' + e.message, 'err'); loading.value = false }
}

function selectMulti(i) { activeResultIdx.value = i; const r = multiResults.value[i]; if (!r) return; result.value = r; resultShow.value = true; loadContext(r.segments, r.waypoints, { totalClimb: r.totalClimb, uphillSections: r.uphillSections, downhillSections: r.downhillSections, waypoints: r.waypoints, totalDistance: r.totalDistance }).catch(() => {}) }

// === 结果操作 ===
function doRegenerate() {
  if (scene.value === 'destination') doGenerateDestination()
  else doGenerate(true)
}
const navUrl = computed(() => result.value && homeObj.value && workObj.value ? buildNavUrl(homeObj.value, workObj.value, result.value.waypoints) : '')
function openNav() { if (result.value && homeObj.value && workObj.value) openNavigation(homeObj.value, workObj.value, result.value.waypoints) }
function copyNav() { if (navUrl.value) { navigator.clipboard?.writeText(navUrl.value); toast('已复制') } }
function downloadGpx() { if (result.value && homeObj.value && workObj.value) { const gpx = buildGPX(result.value, homeObj.value, workObj.value); const blob = new Blob([gpx], { type: 'application/gpx+xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mantu_${homeObj.value.name}_${(result.value.totalDistance/1000).toFixed(1)}km.gpx`; a.click(); URL.revokeObjectURL(a.href) } }
async function doShare() {
  if (!result.value) return
  const route = result.value; const h = homeObj.value, w = workObj.value
  const canvas = generateShareImage({ title: (h?.name||'?') + (hasDest.value ? ' → '+(w?.name||'?') : ' ↻ 环线'), subtitle: (route.totalDistance/1000).toFixed(1)+' km · '+Math.round(route.totalDuration/60)+' min', totalDistance: route.totalDistance, totalDuration: route.totalDuration, totalClimb: route.totalClimb, segments: route.segments, waypoints: route.waypoints, home: h, work: w||h, uphillSections: route.uphillSections, downhillSections: route.downhillSections })
  const r = await shareImage(canvas, `mantu_${(h?.name||'route')}_${(route.totalDistance/1000).toFixed(1)}km.png`)
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
  <!-- 位置卡片 -->
  <div class="loc-card">
    <div class="loc-info" @click="openLocationSearch">
      <span class="loc-pin">📍</span>
      <div class="loc-text">
        <div class="loc-label">起点</div>
        <div class="loc-name">{{ from.name || '正在定位…' }}</div>
      </div>
      <span v-if="nearbyMode" class="loc-badge">离家{{ homeDist }}km</span>
    </div>
    <div class="loc-actions">
      <button v-if="nearbyMode" class="loc-btn" @click.stop="toggleNearby" title="切回家">🏠</button>
      <button class="loc-btn" @click.stop="locateMe('from')" title="GPS 定位">🎯</button>
      <button class="loc-btn primary" @click.stop="openLocationSearch" title="切换位置">切换</button>
    </div>
  </div>

  <!-- 位置搜索面板（展开式） -->
  <div v-if="showLocationSearch" class="loc-search-panel">
    <div class="loc-search-row">
      <input
        v-model="locationSearchName"
        placeholder="输入地名搜索起点"
        class="loc-search-input"
        @input="onLocationInput"
        @focus="onLocationInput"
        @keyup.enter="confirmLocation"
      />
      <button class="loc-search-btn" @click="locateFromSearch">🎯</button>
      <button class="loc-search-btn primary" @click="confirmLocation">搜索</button>
    </div>
    <div v-if="showSuggest && activeSuggest==='from'" class="suggest-drop">
      <div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectLocationSugg(i)">
        <span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span>
      </div>
    </div>
    <div v-if="Object.keys(addresses).length > 0" class="loc-quick">
      <span class="loc-quick-label">地址簿：</span>
      <button v-for="(v,k) in addresses" :key="k" class="chip-sm" @click="() => { pickAddr(k,'from'); showLocationSearch = false }">{{ k }}</button>
      <button class="chip-sm add" @click="showAddrModal = true">管理</button>
    </div>
  </div>

  <!-- 模式卡片 -->
  <p class="section-title">今天想怎么骑？</p>
  <SceneCards v-model="scene" />

  <!-- 距离滑块（仅休闲骑/训练骑） -->
  <div v-if="scene === 'loop' && distRange" class="dist-card">
    <div class="dist-header">
      <span class="dist-label">骑行距离</span>
      <span class="dist-value">{{ customDist || distRange.default }} <small>km</small></span>
    </div>
    <input
      type="range"
      class="dist-slider"
      :min="distRange.min"
      :max="distRange.max"
      :step="1"
      v-model.number="customDist"
    />
    <div class="dist-footer">
      <span>{{ distRange.min }} km</span>
      <span class="dist-time">约 {{ estimatedTime }} 分钟</span>
      <span>{{ distRange.max }} km</span>
    </div>
  </div>


  <!-- 指定距离环线：方向偏好（默认随机） -->
  <div v-if="scene === 'loop'" class="dir-inline">
    <span class="dir-inline-label">方向偏好</span>
    <div class="dir-chips">
      <button v-for="d in COMPASS" :key="d.key" :class="['dir-chip',{active:direction===d.key}]" @click="direction=d.key">{{ d.label }}</button>
    </div>
  </div>

  <!-- 骑到某处：目的地搜索 -->
  <div v-if="scene === 'destination'" class="dest-search card">
    <label class="field-label">想去哪儿？</label>
    <div class="input-row">
      <input
        v-model="destName"
        placeholder="输入目的地，如：秦岭脚下、钟楼"
        @keyup.enter="searchDestination"
        style="flex:1"
      />
      <button class="btn-search" @click="searchDestination" :disabled="destLoading">
        {{ destLoading ? '搜索中…' : '搜索' }}
      </button>
    </div>

    <!-- 路线策略：最优 / 随机 -->
    <div class="trip-toggle">
      <button :class="['trip-pill', { active: routeStrategy === 'optimal' }]" @click="routeStrategy = 'optimal'">✨ 最优</button>
      <button :class="['trip-pill', { active: routeStrategy === 'random' }]" @click="routeStrategy = 'random'">🎲 随机</button>
    </div>

    <!-- 单程 / 往返 切换 -->
    <div class="trip-toggle">
      <button :class="['trip-pill', { active: tripType === 'oneway' }]" @click="tripType = 'oneway'">↗ 单程</button>
      <button :class="['trip-pill', { active: tripType === 'round' }]" @click="tripType = 'round'">🔁 往返</button>
    </div>

    <div v-if="destEstimate" class="dest-estimate">
      <div class="dest-est-row">
        <span>📍 {{ destCoord?.name }}</span>
      </div>
      <div class="dest-est-row">
        <template v-if="tripType === 'oneway'">
          <span>单程 {{ destEstimate.oneWayKm }}km · 约{{ destEstimate.oneWayMin }}分钟</span>
          <span class="dest-total">走最短最优路线</span>
        </template>
        <template v-else>
          <span>单程 {{ destEstimate.oneWayKm }}km · 约{{ destEstimate.oneWayMin }}分钟</span>
          <span class="dest-total">往返 {{ destEstimate.roundKm }}km · 约{{ Math.round(destEstimate.roundMin / 60) }}小时</span>
        </template>
      </div>
    </div>
    <div v-else class="dest-hint">💡 搜索目的地后，自动规划{{ tripType === 'round' ? '去程 + 返程' : '去程' }}最优路线</div>
  </div>

  <!-- 对比模式开关（非目的地模式） -->
  <div v-if="scene !== 'destination'" class="multi-toggle">
    <div class="multi-toggle-info">
      <span class="multi-toggle-label">对比模式</span>
      <small>{{ multiMode ? '一次生成 3 条路线对比' : '生成 1 条路线' }}</small>
    </div>
    <label class="switch">
      <input type="checkbox" v-model="multiMode">
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>

  <!-- 生成按钮 -->
  <button
    class="btn-go"
    :disabled="loading || (scene === 'destination' && !destCoord)"
    @click="handleGenerate"
  >
    {{ loading ? '生成中…' : scene === 'loop' ? '🔄 环线出发！' : (tripType === 'round' ? '🔁 往返出发！' : '🎯 骑过去！') }}
  </button>

  <!-- 高级选项折叠 -->
  <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
    <span>编辑起终点</span>
    <span class="arrow" :class="{ open: showAdvanced }">▾</span>
  </div>
  <div v-if="showAdvanced" class="advanced-panel">
    <!-- 起终点 -->
    <div class="addr-row">
      <label class="field-label">起点</label>
      <div class="addr-quick-row" v-if="Object.keys(addresses).length > 0">
        <button v-for="(v,k) in addresses" :key="k" class="chip-sm" @click="pickAddr(k,'from')">{{ k }}</button>
        <button class="chip-sm add" @click="showAddrModal = true">+管理</button>
      </div>
      <div class="input-row" style="position:relative">
        <input v-model="from.name" placeholder="输入地名搜索" @input="onNameInput('from')" @focus="onNameInput('from')" @blur="setTimeout(closeSuggest,200)">
        <button class="btn-icon" @click="doGeocode('from')">🔍</button>
        <button class="btn-icon" @click="locateMe('from')">📍</button>
        <div v-if="showSuggest && activeSuggest==='from'" class="suggest-drop"><div v-for="(s,i) in suggestions" :key="i" class="suggest-item" @mousedown.prevent="selectSugg(i)"><span class="s-name">{{ s.name }}</span><span class="s-dist">{{ s.district }}</span></div></div>
      </div>
    </div>

    <div class="addr-row">
      <label class="field-label">终点 <span class="hint">(不填=环线)</span></label>
      <div class="input-row" style="position:relative">
        <input v-model="to.name" placeholder="可选目的地" @input="onNameInput('to')" @focus="onNameInput('to')" @blur="setTimeout(closeSuggest,200)">
        <button class="btn-icon" @click="doGeocode('to')">🔍</button>
        <button class="btn-icon" @click="locateMe('to')">📍</button>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div v-if="loading" class="loading-overlay card">
    <div class="progress-ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" :style="{strokeDasharray:163.36,strokeDashoffset:163.36-(progress/100)*163.36}"/></svg>
      <div class="txt">{{ progress }}%</div>
    </div>
    <p class="loading-hint">{{ loadingHint }}</p>
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
  <ResultView
    v-if="resultShow && result"
    :result="result"
    :homeObj="homeObj"
    :workObj="workObj"
    :hasDest="hasDest"
    v-model:collapseOpen="collapseOpen"
    :loading="loading"
    :routeTags="routeTags"
    :villages="villages"
    :supplyPoints="supplyPoints"
    @openNav="openNav"
    @copyNav="copyNav"
    @downloadGpx="downloadGpx"
    @doShare="doShare"
    @regenerate="doRegenerate"
  />

  <!-- 地址管理弹窗 -->
  <div class="modal" v-if="showAddrModal" @click.self="showAddrModal=false">
    <div class="inner">
      <div style="display:flex;align-items:center;justify-content:space-between"><h3>管理地址簿</h3><div style="display:flex;align-items:center;gap:4px"><span v-if="devUnlocked" style="font-size:10px;color:#22c55e">🔓</span><button v-if="!showPwdInput" class="btn btn-sm" style="background:transparent;color:#a898b8;font-size:9px;padding:2px 6px" @click="showPwdInput=true">🔧</button><input v-if="showPwdInput" v-model="pwdValue" type="password" placeholder="密码" style="width:80px;font-size:10px;padding:3px 6px" @keyup.enter="checkPassword"><button v-if="showPwdInput" class="btn btn-sm" style="background:var(--accent);color:#fff;font-size:9px;padding:3px 8px" @click="checkPassword">OK</button></div></div>
      <div v-if="Object.keys(addresses).length>0" style="margin-bottom:10px;max-height:150px;overflow-y:auto"><div v-for="(v,k) in addresses" :key="k" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;margin:3px 0;background:#f7f5fa;border-radius:8px;font-size:12px"><span><strong>{{ k }}</strong> — {{ v.name }} <span style="color:#a898b8;font-size:10px">({{ typeof v.lng==='number'?v.lng.toFixed(4):v.lng }}, {{ typeof v.lat==='number'?v.lat.toFixed(4):v.lat }})</span></span><button class="btn btn-sm" style="background:#ff5252;color:#fff;font-size:9px;padding:2px 6px;flex-shrink:0;margin-left:8px" @click="deleteSavedAddr(k)">🗑</button></div></div>
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

<style scoped>
/* === 位置卡片 === */
.loc-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 16px;
  margin-top: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px var(--shadow-color);
}
.loc-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  cursor: pointer;
  min-width: 0;
}
.loc-pin { font-size: 20px; flex-shrink: 0; }
.loc-text { min-width: 0; flex: 1; }
.loc-label {
  font-size: 10px;
  font-weight: 700;
  color: #a898b8;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.loc-name {
  font-size: 14px;
  font-weight: 700;
  color: #3a3045;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.loc-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
.loc-actions { display: flex; gap: 6px; flex-shrink: 0; }
.loc-btn {
  padding: 7px 10px;
  border: none;
  border-radius: 10px;
  background: #f0edf5;
  font-size: 15px;
  cursor: pointer;
  line-height: 1;
  transition: all .15s;
  font-family: inherit;
}
.loc-btn:hover { background: var(--accent-soft); transform: scale(1.05); }
.loc-btn:active { transform: scale(.92); }
.loc-btn.primary {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  padding: 8px 12px;
}

/* === 位置搜索面板 === */
.loc-search-panel {
  padding: 14px;
  background: #fff;
  border-radius: 0 0 16px 16px;
  margin-top: -8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
}
.loc-search-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.loc-search-input {
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-family: inherit;
  color: #4a3f55;
  background: #f7f5fa;
  transition: all .2s;
}
.loc-search-input:focus { background: #fff; outline: none; box-shadow: 0 0 0 4px var(--accent-tint); }
.loc-search-btn {
  padding: 9px 14px;
  border: none;
  border-radius: 12px;
  background: #f0edf5;
  font-size: 15px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all .15s;
  font-family: inherit;
}
.loc-search-btn:hover { background: var(--accent-soft); }
.loc-search-btn.primary {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}
.loc-quick {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.loc-quick-label {
  font-size: 10px;
  color: #a898b8;
  font-weight: 600;
  margin-right: 2px;
}

/* === 通用 === */
.suggest-drop {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,.12);
  overflow: hidden;
  margin-top: 4px;
}
.suggest-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  transition: background .15s;
}
.suggest-item:hover { background: var(--accent-soft); }
.s-name { font-size: 12px; color: #4a3f55; }
.s-dist { font-size: 10px; color: #a898b8; }

.section-title {
  font-size: 17px;
  font-weight: 800;
  color: #3a3045;
  margin: 18px 2px 0;
  letter-spacing: -.3px;
}

/* === 距离滑块 === */
.dist-card {
  padding: 16px 18px;
  background: #fff;
  border-radius: 16px;
  margin-top: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px var(--shadow-color);
}
.dist-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
.dist-label {
  font-size: 13px;
  font-weight: 700;
  color: #5e5468;
}
.dist-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -1px;
}
.dist-value small {
  font-size: 14px;
  font-weight: 600;
  opacity: .6;
}
.dist-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #ece8f0;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}
.dist-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb),.35);
  cursor: pointer;
  transition: transform .15s;
}
.dist-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
.dist-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb),.35);
  cursor: pointer;
}
.dist-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: #a898b8;
  font-weight: 600;
}
.dist-time {
  color: var(--accent);
  font-weight: 700;
  font-size: 12px;
}

/* === 按钮区 === */
.btn-go {
  display: block;
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 19px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
  margin-top: 18px;
  letter-spacing: .5px;
  box-shadow: 0 6px 20px rgba(var(--accent-rgb),.28);
}
.btn-go:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(var(--accent-rgb),.35);
}
.btn-go:active:not(:disabled) { transform: scale(.97); }
.btn-go:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.btn-multi {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 14px;
  border: 2px solid rgba(var(--accent-rgb),.15);
  border-radius: 16px;
  background: #fff;
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 10px;
  transition: all .15s;
  font-family: inherit;
}
.btn-multi:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: translateY(-1px);
}
.btn-multi:disabled { opacity: .5; cursor: not-allowed; }


/* === 训练骑：行内方向选择器 === */
.dir-inline {
  padding: 14px 16px;
  background: #fff;
  border-radius: 14px;
  margin-top: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px var(--shadow-color);
}
.dir-inline-label {
  font-size: 12px;
  font-weight: 700;
  color: #5e5468;
  display: block;
  margin-bottom: 8px;
}
.dir-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dir-chip {
  padding: 7px 12px;
  border-radius: 10px;
  border: none;
  background: #f7f5fa;
  color: #7a6c8a;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}
.dir-chip:hover { background: var(--accent-soft); color: var(--accent); }
.dir-chip.active {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb),.25);
}

/* === 对比模式开关 === */
.multi-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin-top: 14px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px var(--shadow-color);
}
.multi-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.multi-toggle-label {
  font-size: 13px;
  font-weight: 700;
  color: #5e5468;
}
.multi-toggle-info small {
  font-size: 11px;
  color: #a898b8;
}
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
  cursor: pointer;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch .track {
  position: absolute;
  inset: 0;
  background: #e0dae8;
  border-radius: 14px;
  transition: background .25s;
}
.switch .thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0,0,0,.15);
  transition: transform .25s cubic-bezier(.34,1.56,.64,1);
}
.switch input:checked + .track {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
}
.switch input:checked + .track .thumb {
  transform: translateX(20px);
}

/* === 高级面板 === */
.advanced-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  margin-top: 14px;
  background: #fff;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  color: #7a6c8a;
  cursor: pointer;
  transition: all .15s;
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 4px 12px var(--shadow-color);
}
.advanced-toggle:hover { background: var(--accent-soft); color: var(--accent); }
.advanced-toggle .arrow { transition: transform .2s; }
.advanced-toggle .arrow.open { transform: rotate(180deg); }

.advanced-panel {
  padding: 16px;
  background: #fff;
  border: none;
  border-radius: 0 0 14px 14px;
  margin-top: -8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
}

.field-label {
  font-size: 12px;
  color: #5e5468;
  font-weight: 700;
  display: block;
  margin-bottom: 6px;
}
.field-label .hint {
  font-weight: 400;
  color: #b0a3bc;
}

.adv-label {
  font-size: 12px;
  color: #5e5468;
  font-weight: 700;
  display: block;
  margin: 0 0 8px;
}

.compass-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.compass-grid .chip {
  padding: 7px 12px;
  border-radius: 10px;
  border: none;
  background: #f7f5fa;
  color: #7a6c8a;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}
.compass-grid .chip:hover { background: var(--accent-soft); color: var(--accent); }
.compass-grid .chip.active {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb),.25);
}

.addr-row { margin-bottom: 14px; }
.addr-quick-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.chip-sm {
  padding: 5px 12px;
  border-radius: 10px;
  border: none;
  background: #f0edf5;
  color: #5e5468;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all .15s;
}
.chip-sm:hover { background: var(--accent-soft); color: var(--accent); }
.chip-sm.add { background: var(--accent-soft); color: var(--accent); }

.input-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.input-row input {
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 12px;
  font-size: 13px;
  font-family: inherit;
  color: #4a3f55;
  background: #f7f5fa;
  transition: all .2s;
}
.input-row input:focus { background: #fff; outline: none; box-shadow: 0 0 0 4px var(--accent-tint); }
.btn-icon {
  padding: 8px 12px;
  border: none;
  border-radius: 12px;
  background: #f0edf5;
  cursor: pointer;
  font-size: 15px;
  flex-shrink: 0;
  transition: all .15s;
}
.btn-icon:hover { background: var(--accent-soft); }
.btn-icon:active { transform: scale(.9); }

/* === 目的地搜索 === */
.dest-search { margin-top: 12px; }

/* 单程 / 往返 切换 */
.trip-toggle {
  display: flex;
  gap: 6px;
  margin-top: 12px;
  padding: 4px;
  background: #f0edf5;
  border-radius: 12px;
}
.trip-pill {
  flex: 1;
  padding: 9px 0;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #7a6c8a;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all .18s;
}
.trip-pill:hover { color: var(--accent); }
.trip-pill.active {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), .18);
}
.dest-estimate {
  margin-top: 10px;
  padding: 12px 14px;
  background: var(--accent-soft);
  border-radius: 12px;
}
.dest-est-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #4a3f55;
  margin-bottom: 4px;
}
.dest-est-row:last-child { margin-bottom: 0; }
.dest-total { font-weight: 800; color: var(--accent); }
.dest-hint {
  margin-top: 10px;
  padding: 10px 14px;
  background: #f7f5fa;
  border-radius: 10px;
  font-size: 12px;
  color: #a898b8;
  text-align: center;
}

.btn-search {
  padding: 10px 18px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: all .15s;
  font-family: inherit;
}
.btn-search:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--accent-rgb),.25); }
.btn-search:disabled { opacity: .5; }

/* === Loading === */
.loading-overlay {
  text-align: center;
  padding: 28px 20px;
  margin-top: 16px;
}
.progress-ring {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto 14px;
}
.progress-ring svg { transform: rotate(-90deg); }
.progress-ring .bg { fill: none; stroke: #ece8f0; stroke-width: 5; }
.progress-ring .fg {
  fill: none;
  stroke: var(--accent);
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dashoffset .4s;
}
.progress-ring .txt {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%,-50%);
  font-size: 16px;
  font-weight: 800;
  color: var(--accent);
}
.loading-hint {
  font-size: 13px;
  color: #7a6c8a;
  font-weight: 600;
}

/* === 多路线 === */
.multi-cards {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.multi-card {
  flex-shrink: 0;
  width: 160px;
  padding: 12px;
  background: #fff;
  border-radius: 14px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.multi-card.active {
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(var(--accent-rgb),.15);
}
</style>
