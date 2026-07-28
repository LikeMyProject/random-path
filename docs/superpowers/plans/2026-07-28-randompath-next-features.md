# RandomPath B2+C2+C3 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现附近起点模式(C2)、路线属性标签(B2)、骑到某处模式(C3)三个功能

**Architecture:** 按复杂度递增实现——C2 只改 ExploreView 初始化逻辑和 GPS 条 UI；B2 在 useRouteContext 新增离线标签分析 + ResultView 颜色分类；C3 在 SceneCards 加第四张卡片 + ExploreView 新增目的地搜索和来回路线生成流程

**Tech Stack:** Vue 3 Composition API + `<script setup>` + 高德 API + 纯 CSS

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/views/ExploreView.vue` | 修改 | C2: GPS 定位逻辑 + 附近模式状态；C3: 目的地搜索 + 来回路线生成 |
| `src/components/SceneCards.vue` | 修改 | C3: 新增第四张"骑到某处"卡片 |
| `src/composables/useRouteContext.js` | 修改 | B2: 新增 `analyzeRouteTags` 离线标签分析 |
| `src/views/ResultView.vue` | 修改 | B2: 标签颜色分类展示；C3: 来回路线标题适配 |

---

### Task 1: C2 — 附近起点模式

**Files:**
- Modify: `src/views/ExploreView.vue`

- [ ] **Step 1: 新增 `nearbyMode` 状态和距离计算**

在 `<script setup>` 中，`useRouteContext` 下方新增：

```js
// === 附近起点模式 ===
const nearbyMode = ref(false)       // 是否自动检测到在户外
const homeDist = ref(0)            // 当前 GPS 位置离"家"的直线距离(km)
const homeAddr = ref(null)         // 保存"家"的地址引用，用于回切

// 计算两点直线距离的辅助函数
function calcDistKm(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const sa = Math.sin(dLat / 2), sb = Math.sin(dLng / 2)
  return R * 2 * Math.asin(Math.sqrt(sa * sa + Math.cos(lat1) * Math.cos(lat2) * sb * sb))
}
```

- [ ] **Step 2: 修改 `onMounted` 初始化逻辑**

把现有 `onMounted` 中 GPS 定位部分改为：定位后 → 和"家"比较距离 → > 2km 则自动切附近模式。

```js
onMounted(async () => {
  // 先加载家/公司地址
  if (addresses['家']) {
    homeAddr.value = { name: addresses['家'].name, lng: parseFloat(addresses['家'].lng), lat: parseFloat(addresses['家'].lat) }
    from.value = { name: addresses['家'].name, lng: addresses['家'].lng, lat: addresses['家'].lat }
  }
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

  // GPS 定位 + 附近模式检测
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((res, rej) => { navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }) })
      const { longitude: lng, latitude: lat } = pos.coords

      // 检测是否离家超过 2km
      if (!addresses['家'] || !homeAddr.value) {
        // 没有家地址，直接用 GPS
        from.value = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
        try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) from.value.name = name; if (city) setDetectedCity(city) } catch(e) {}
      } else {
        const dist = calcDistKm({ lat, lng }, homeAddr.value)
        homeDist.value = Math.round(dist * 10) / 10
        if (dist > 2) {
          // 离家 > 2km → 自动附近模式
          nearbyMode.value = true
          from.value = { name: `📍 ${lng.toFixed(4)}, ${lat.toFixed(4)}`, lng: String(lng), lat: String(lat) }
          try { const [name, city] = await Promise.all([nameWaypoint(lng, lat), detectCityFromGPS(lng, lat)]); if (name?.length > 2) from.value.name = name; if (city) setDetectedCity(city) } catch(e) {}
        } else {
          // 在家附近，保持家地址
          nearbyMode.value = false
        }
      }
    } catch(e) {}
  }
})
```

- [ ] **Step 3: 新增 `toggleNearby` 手动切换函数**

在 `locateMe` 函数后面加：

```js
function toggleNearby() {
  if (nearbyMode.value) {
    // 切回家
    if (homeAddr.value) {
      from.value = { name: homeAddr.value.name, lng: String(homeAddr.value.lng), lat: String(homeAddr.value.lat) }
    }
    nearbyMode.value = false
  } else {
    // 切到附近——重新 GPS 定位
    locateMe('from')
    nearbyMode.value = true
  }
}
```

- [ ] **Step 4: 改 GPS 条模板**

把模板中 GPS 条改为：

```html
<!-- GPS 定位条 -->
<div class="gps-bar" @click="locateMe('from')">
  <span class="gps-icon">📍</span>
  <span class="gps-text">{{ from.name || '点击设置起点' }}</span>
  <span class="gps-hint" v-if="!nearbyMode">自动定位 · 点击切换</span>
  <span class="gps-hint" v-else>离家 {{ homeDist }}km · 附近模式</span>
  <button v-if="nearbyMode" class="gps-home-btn" @click.stop="toggleNearby" title="切回家">🏠</button>
</div>
```

- [ ] **Step 5: 追加 GPS 条样式**

在 `<style scoped>` 末尾追加：

```css
.gps-home-btn {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid #d4c4dc;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
}
.gps-home-btn:hover { background: #f8f4fb; }
```

- [ ] **Step 6: 验证构建**

```bash
cd C:\Users\Administrator\Desktop\RadomPath-vue && npm run build
```

检查：无编译错误。

- [ ] **Step 7: Commit**

```bash
git add src/views/ExploreView.vue
git commit -m "feat(C2): 附近起点模式 — 户外自动以GPS位置出发，离家>2km自动切换"
```

---

### Task 2: B2 — 路线属性标签

**Files:**
- Modify: `src/composables/useRouteContext.js`
- Modify: `src/views/ResultView.vue`

- [ ] **Step 1: 在 useRouteContext 新增 `routeTags` 状态**

在 `useRouteContext` 函数体内，`supplyPoints` 下方加：

```js
const routeTags = ref([])
```

- [ ] **Step 2: 新增 `analyzeRouteTags` 函数**

在 `findSupplyPoints` 函数后面（`loadContext` 之前）加：

```js
/**
 * 离线分析路线属性标签：自然类/骑行类（不需要 API）
 * 人文类标签在 identifyVillages 中已获取→合并返回
 */
function analyzeRouteTags(segments, result = {}) {
  const tags = []

  const totalDist = (segments || []).reduce((s, seg) => s + (seg.distance || 0), 0) / 1000 // km
  const totalClimb = result.totalClimb || 0
  const uphill = result.uphillSections || []
  const downhill = result.downhillSections || []

  // === 自然类 ===
  // 爬坡王：总爬升 >= 200m 或单段坡度 >= 8%
  if (totalClimb >= 200 || uphill.some(s => s.avgGrade >= 8)) {
    tags.push({ text: '⛰ 爬坡王', category: 'nature' })
  }
  // 平路巡航：总爬升 < 50m 且距离 > 10km
  if (totalClimb < 50 && totalDist > 10) {
    tags.push({ text: '🛣 平路巡航', category: 'nature' })
  }
  // 下坡爽：下坡段 >= 2 且总下降 > 100m
  const totalDescent = downhill.reduce((s, d) => s + (d.descent || 0), 0)
  if (downhill.length >= 2 && totalDescent > 100) {
    tags.push({ text: '🎢 下坡爽', category: 'nature' })
  }
  // 爬坡适中
  if (totalClimb >= 50 && totalClimb < 200) {
    tags.push({ text: '⛰ 起伏路', category: 'nature' })
  }

  // === 骑行类 ===
  // 弯道多：polyline 采样转角 > 30° 的次数
  const { parsePolyline, samplePoints } = (() => { try { return require('../utils/math.js') } catch(e) { return { parsePolyline: (p) => [], samplePoints: (pts, n) => pts } } })()
  // 但 require 在 ESM 下不可用，改用动态 import 的上层传入方案
  // 简化：用 waypoints 数量判断复杂度
  const wpCount = (result.waypoints || []).length
  if (wpCount >= 5) {
    tags.push({ text: '🔄 弯道多', category: 'cycling' })
  }
  if (wpCount <= 2 && totalDist > 15) {
    tags.push({ text: '➡ 直路多', category: 'cycling' })
  }

  // 距离类
  if (totalDist >= 50) {
    tags.push({ text: '🏆 长途', category: 'cycling' })
  } else if (totalDist >= 30) {
    tags.push({ text: '🔥 中长途', category: 'cycling' })
  } else if (totalDist <= 10) {
    tags.push({ text: '☕ 短途', category: 'cycling' })
  }

  routeTags.value = tags
  return tags
}
```

注意：ESM 环境下 `require` 不可用。`analyzeRouteTags` 的弯道计算改为从 `loadContext` 传入 polyline 采样点。实际实现时简化——用 waypoints 数量和 totalDistance 替代弯道密度计算。

- [ ] **Step 3: 把 `analyzeRouteTags` 加入 `loadContext`**

修改 `loadContext` 函数：

```js
async function loadContext(segments, waypoints, result = {}) {
  loading.value = true
  try {
    const [v, s] = await Promise.all([
      identifyVillages(segments, waypoints),
      findSupplyPoints(segments),
    ])
    // 离线标签分析（不依赖 API）
    analyzeRouteTags(segments, result)
    return { villages: v, supplyPoints: s, tags: routeTags.value }
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: 把 `routeTags` 加入 return**

在 `useRouteContext` 的 return 对象中加：

```js
return {
  villages,
  supplyPoints,
  routeTags,
  loading,
  progress,
  identifyVillages,
  findSupplyPoints,
  analyzeRouteTags,
  loadContext,
}
```

- [ ] **Step 5: ExploreView 中解构 `routeTags`**

在 `src/views/ExploreView.vue` 的 `<script setup>` 中：

```js
const { villages, supplyPoints, routeTags, loadContext } = useRouteContext()
```

注意：这行已存在，只需加 `routeTags`。

- [ ] **Step 6: 传 `routeTags` 给 ResultView**

在 `ExploreView.vue` 模板的 ResultView 上加：

```html
:routeTags="routeTags"
```

- [ ] **Step 7: ResultView 接收 `routeTags` prop 并渲染**

在 `ResultView.vue` 的 props 中加：

```js
routeTags: Array,
```

在模板中替换 quality-tags 区域：

```html
<!-- 路线属性标签 -->
<div v-if="routeTags?.length || scoreRouteQuality(result.waypoints || []).tags.length" class="quality-tags">
  <span v-for="t in (routeTags || [])" :key="t.text" :class="['qtag', 'qtag-' + (t.category || 'nature')]">{{ t.text }}</span>
  <span v-for="t in scoreRouteQuality(result.waypoints || []).tags" :key="t" class="qtag qtag-quality">{{ t }}</span>
</div>
```

在 `<style scoped>` 中追加分类颜色样式：

```css
.qtag-nature { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
.qtag-cycling { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
.qtag-quality { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
```

- [ ] **Step 8: 更新 `loadContext` 调用传参**

在 `ExploreView.vue` 的 `doGenerate` 中，把：

```js
loadContext(route.segments, route.waypoints).catch(() => {})
```

改为：

```js
loadContext(route.segments, route.waypoints, { totalClimb: route.totalClimb, uphillSections: route.uphillSections, downhillSections: route.downhillSections, waypoints: route.waypoints, totalDistance: route.totalDistance }).catch(() => {})
```

- [ ] **Step 9: 验证构建**

```bash
cd C:\Users\Administrator\Desktop\RadomPath-vue && npm run build
```

检查：无编译错误。JS bundle 应增加不超过 2KB。

- [ ] **Step 10: Commit**

```bash
git add src/composables/useRouteContext.js src/views/ResultView.vue src/views/ExploreView.vue
git commit -m "feat(B2): 路线属性标签 — 自然/骑行类离线分析+结果页颜色分类"
```

---

### Task 3: C3 — 骑到某处模式

**Files:**
- Modify: `src/components/SceneCards.vue`
- Modify: `src/views/ExploreView.vue`

- [ ] **Step 1: SceneCards 加第四张卡片**

在 `SceneCards.vue` 的 SCENES 数组中新增：

```js
const SCENES = [
  { key: 'casual', icon: '🌅', label: '休闲骑', desc: '~12 km', time: 60, flat: true },
  { key: 'training', icon: '🏋', label: '训练骑', desc: '~30 km', time: 120, hilly: true },
  { key: 'random', icon: '🔀', label: '随便骑', desc: '随机距离 · 随机方向', time: -1, random: true },
  { key: 'destination', icon: '🎯', label: '骑到某处', desc: '选目的地 · 来回', time: -1, dest: true },
]
```

- [ ] **Step 2: ExploreView 新增 `destination` 场景状态**

在 `scene` ref 下方加：

```js
// === 骑到某处模式 ===
const destName = ref('')  // 目的地搜索文本
const destCoord = ref(null)  // { lng, lat, name }
const destEstimate = ref(null)  // { oneWayKm, oneWayMin, roundKm, roundMin }
```

- [ ] **Step 3: watch scene 加 destination 分支**

在现有 `watch(scene, ...)` 中加：

```js
watch(scene, (s) => {
  if (s === 'random') { direction.value = 'random'; timeMin.value = 60 + Math.floor(Math.random() * 3) * 60 }
  else if (s === 'casual') { direction.value = 'random'; timeMin.value = 60 }
  else if (s === 'training') { direction.value = 'S'; timeMin.value = 120 }
  else if (s === 'destination') {
    // 骑到某处：清空之前的目的地数据
    destName.value = ''
    destCoord.value = null
    destEstimate.value = null
  }
})
```

- [ ] **Step 4: 新增目的地搜索逻辑**

在 `doGeocode` 后面加：

```js
const destLoading = ref(false)

async function searchDestination() {
  if (!destName.value.trim()) { toast('请输入目的地', 'warn'); return }
  destLoading.value = true
  try {
    const r = await geocode(destName.value, getDetectedCity())
    if (!r) { toast('未找到该地点', 'warn'); destLoading.value = false; return }
    destCoord.value = { lng: r.lng, lat: r.lat, name: r.name }
    destName.value = r.name

    // 预估单程距离
    const h = homeObj.value || { lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
    if (h.lng && h.lat && r.lng && r.lat) {
      const oneWayDist = haversine({ lng: h.lng, lat: h.lat }, { lng: r.lng, lat: r.lat }) * 1.5 // 道路系数 ~1.5
      const oneWayKm = Math.round(oneWayDist / 100) / 10
      const oneWayMin = Math.round(oneWayKm / BIKE_SPEED * 60)
      destEstimate.value = {
        oneWayKm,
        oneWayMin,
        roundKm: oneWayKm * 2,
        roundMin: oneWayMin * 2,
      }
    }
    toast(`已定位：${r.name}`)
  } catch(e) { toast('搜索失败', 'err') }
  destLoading.value = false
}
```

需要在 import 中加 `haversine` 和 `getDetectedCity`：

```js
import { tryGenerateRoute, generateCompassLoop, generateMultipleRoutes, MAX_RETRIES, BIKE_SPEED, COMPASS, nameWaypoint, buildNavUrl, openNavigation, buildGPX } from '../composables/useRouteEngine.js'
```

不变——`geocode` 来自 `useAMap`，已 import。`getDetectedCity` 也要 import：

```js
import { geocode, setDetectedCity, detectCityFromGPS, getDetectedCity } from '../composables/useAMap.js'
```

- [ ] **Step 5: 新增 `doGenerateRoundTrip` 来回路线生成**

在 `doGenerateMultiple` 后面加：

```js
async function doGenerateRoundTrip() {
  if (!destCoord.value) { toast('请先搜索目的地', 'warn'); return }
  const h = homeObj.value || { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  if (!h.lng || !h.lat) { toast('请完善起点', 'warn'); return }
  const d = destCoord.value

  resultShow.value = false; multiResults.value = []
  loading.value = true; progress.value = 0; loadingHint.value = '正在规划去程路线…'; tryInfo.value = ''

  const onTryOut = (a, dist, e) => {
    progress.value = Math.round((a / MAX_RETRIES) * 50) // 去程占 50%
    loadingHint.value = e ? `去程第${a}次: ${e}` : `去程第${a}次: ${(dist/1000).toFixed(1)} km`
    tryInfo.value = loadingHint.value
  }
  const onTryBack = (a, dist, e) => {
    progress.value = 50 + Math.round((a / MAX_RETRIES) * 50) // 返程占 50%
    loadingHint.value = e ? `返程第${a}次: ${e}` : `返程第${a}次: ${(dist/1000).toFixed(1)} km`
    tryInfo.value = loadingHint.value
  }

  try {
    // 去程：家 → 目的地
    const routeOut = await tryGenerateRoute(h, d, {
      minDist: Math.round(destEstimate.value?.oneWayKm * 1000 * 0.6 || 10000),
      maxDist: Math.round(destEstimate.value?.oneWayKm * 1000 * 1.4 || 30000),
      onTry: onTryOut,
    })
    if (!routeOut) { toast('去程生成失败，请重试', 'err'); loading.value = false; return }

    // 返程：目的地 → 家（反方向，换途经点）
    const returnDir = ((getBearing({ lng: d.lng, lat: d.lat }, { lng: h.lng, lat: h.lat }) + 180) % 360)
    const routeBack = await tryGenerateRoute(d, h, {
      minDist: Math.round(destEstimate.value?.oneWayKm * 1000 * 0.6 || 10000),
      maxDist: Math.round(destEstimate.value?.oneWayKm * 1000 * 1.4 || 30000),
      directionDeg: returnDir,
      onTry: onTryBack,
    })
    if (!routeBack) { toast('返程生成失败，请重试', 'err'); loading.value = false; return }

    // 拼接路线
    // 合并 segments（返程段编号接在去程之后）
    const mergedSegments = [...routeOut.segments, ...routeBack.segments]
    // 合并 waypoints（目的地作为中间点标记）
    const mergedWaypoints = [
      ...routeOut.waypoints,
      { lng: d.lng, lat: d.lat, poiName: d.name || '🎯 目的地' },
      ...routeBack.waypoints,
    ]

    const mergedRoute = {
      segments: mergedSegments,
      waypoints: mergedWaypoints,
      totalDistance: routeOut.totalDistance + routeBack.totalDistance,
      totalDuration: routeOut.totalDuration + routeBack.totalDuration,
      totalClimb: (routeOut.totalClimb || 0) + (routeBack.totalClimb || 0),
      uphillSections: [...(routeOut.uphillSections || []), ...(routeBack.uphillSections || [])],
      downhillSections: [...(routeOut.downhillSections || []), ...(routeBack.downhillSections || [])],
      isRoundTrip: true,
      destName: d.name,
    }

    // 获取途经点地名
    if (mergedRoute.waypoints.length > 0) {
      tryInfo.value = '正在获取途经点地名…'
      await Promise.all(mergedRoute.waypoints.map(async (wp) => { wp.poiName = await nameWaypoint(wp.lng, wp.lat) }))
    }

    progress.value = 100; await new Promise(r => setTimeout(r, 200))
    result.value = mergedRoute; resultShow.value = true; loading.value = false

    saveHistory({ type: 'roundtrip', home: h.name, work: d.name, distance: mergedRoute.totalDistance, waypoints: mergedRoute.waypoints.map(wp => ({ lng: wp.lng, lat: wp.lat, name: wp.poiName })) })
    saveLastRoute({ type: 'roundtrip', home: h, work: d, waypoints: mergedRoute.waypoints, segments: mergedRoute.segments, totalDistance: mergedRoute.totalDistance, totalDuration: mergedRoute.totalDuration, totalClimb: mergedRoute.totalClimb, uphillSections: mergedRoute.uphillSections, downhillSections: mergedRoute.downhillSections, direction: direction.value, timeMin: timeMin.value, scene: 'destination' })
    // 后台获取沿途上下文
    loadContext(mergedRoute.segments, mergedRoute.waypoints, { totalClimb: mergedRoute.totalClimb, uphillSections: mergedRoute.uphillSections, downhillSections: mergedRoute.downhillSections, waypoints: mergedRoute.waypoints, totalDistance: mergedRoute.totalDistance }).catch(() => {})
  } catch (e) { toast('错误: ' + e.message, 'err'); loading.value = false }
}
```

需要 import `haversine` 和 `getBearing`：

```js
import { tryGenerateRoute, generateCompassLoop, generateMultipleRoutes, MAX_RETRIES, BIKE_SPEED, COMPASS, nameWaypoint, buildNavUrl, openNavigation, buildGPX } from '../composables/useRouteEngine.js'
```

`getBearing` 来自 `../utils/math.js`，需单独 import：

```js
import { getBearing } from '../utils/math.js'
```

但注意 `math.js` 已在 `useRouteContext.js` 中动态 import，这里需要静态 import。没问题——`math.js` 本来就是被多处静态 import 的。

- [ ] **Step 6: 修改主按钮逻辑**

在模板中，主按钮 `@click` 改为根据场景分发：

```html
<button
  class="btn-go"
  :disabled="loading"
  @click="scene === 'destination' ? doGenerateRoundTrip() : doGenerate(false)"
>
  {{ loading ? '生成中…' : scene === 'random' ? '🎲 随机出发！' : scene === 'casual' ? '🌅 休闲出发！' : scene === 'training' ? '🏋 开始训练！' : '🎯 骑过去！' }}
</button>
```

- [ ] **Step 7: 加目的地搜索 UI（scene === 'destination' 时显示）**

在模式卡片下方、大按钮上方加：

```html
<!-- 骑到某处：目的地搜索（仅 destination 模式） -->
<div v-if="scene === 'destination'" class="dest-search card">
  <label style="font-size:12px;color:#8a8098;font-weight:600;display:block;margin-bottom:6px">🎯 想去哪儿？</label>
  <div class="input-row">
    <input
      v-model="destName"
      placeholder="输入目的地，如：秦岭脚下、钟楼"
      @keyup.enter="searchDestination"
      style="flex:1"
    />
    <button class="btn btn-sm" style="background:#f08ca4;color:#fff;flex-shrink:0" @click="searchDestination" :disabled="destLoading">
      {{ destLoading ? '搜索中…' : '🔍 搜索' }}
    </button>
  </div>
  <div v-if="destEstimate" class="dest-estimate">
    <div class="dest-est-row">
      <span>📍 {{ destCoord?.name }}</span>
    </div>
    <div class="dest-est-row">
      <span>单程 {{ destEstimate.oneWayKm }}km · 约{{ destEstimate.oneWayMin }}分钟</span>
      <span class="dest-total">来回 {{ destEstimate.roundKm }}km · 约{{ Math.round(destEstimate.roundMin / 60) }}小时</span>
    </div>
  </div>
</div>
```

追加样式：

```css
.dest-search {
  margin-top: 12px;
}
.dest-estimate {
  margin-top: 10px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #fef6f8, #faf1f5);
  border-radius: 10px;
  border: 1px solid #fce8ee;
}
.dest-est-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #5e5468;
  margin-bottom: 4px;
}
.dest-est-row:last-child { margin-bottom: 0; }
.dest-total {
  font-weight: 700;
  color: #f08ca4;
}
```

- [ ] **Step 8: ResultView 适配来回路线标题**

在 `ResultView.vue` 模板中把标题部分改为：

```html
<div class="result-header">
  <div class="result-title">
    <span class="result-icon">{{ result.isRoundTrip ? '🎯' : hasDest ? '📍' : '🔄' }}</span>
    <span>{{ result.isRoundTrip ? `去 ${result.destName || '目的地'}` : hasDest ? '骑行路线' : '环线骑行' }}</span>
    <span v-if="diffObj" class="diff-badge" :style="{ background: diffObj.color }">{{ diffObj.label }}</span>
  </div>
  <div class="result-subtitle">
    {{ result.isRoundTrip ? `${homeObj?.name || '起点'} ⇄ ${result.destName || '目的地'}` : homeObj?.name || '起点' }}{{ !result.isRoundTrip && hasDest ? ' → ' + (workObj?.name || '终点') : '' }}{{ !result.isRoundTrip && !hasDest ? ' 出发兜一圈' : '' }}
  </div>
</div>
```

- [ ] **Step 9: 验证构建**

```bash
cd C:\Users\Administrator\Desktop\RadomPath-vue && npm run build
```

检查：无编译错误。

- [ ] **Step 10: Commit**

```bash
git add src/components/SceneCards.vue src/views/ExploreView.vue src/views/ResultView.vue
git commit -m "feat(C3): 骑到某处模式 — 选目的地自动生成去程+返程路线"
```

---

## 验证清单

完成全部 Task 后逐项验证：

1. **C2 附近起点**：模拟 GPS 离家 > 2km → 首页自动显示当前位置 → 点 🏠 切回家
2. **B2 属性标签**：生成路线 → 结果页显示彩色标签（⛰爬坡王/🛣平路巡航/🔥中长途等）
3. **C3 骑到某处**：选"骑到某处"卡片 → 搜目的地 → 显示预估距离 → 点出发 → 生成来回路线 → 结果页显示"去 XX"标题和总数据
4. **旧功能不受影响**：休闲骑/训练骑/随机骑正常生成，多路线对比正常，GPX/分享/导航正常
5. `npm run build` 通过，零新增警告
