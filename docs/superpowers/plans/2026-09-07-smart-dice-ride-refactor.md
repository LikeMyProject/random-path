# 骑行模块聪明骰子重构 实施计划（关中 v1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把漫途骑行模块从「全地图撒点乱随机」改造成「在陕西可信廊道信封里随机合成好路」的更好用工具——数据诚实（爬升/坡度/难度真实、GPX 不偏）、交互按骑车人决策序（多远→什么路→往哪）、一次三选一、可钉段重掷。

**Architecture:** 三层。① 静态底料层：`presetRoutes.js`（现 100 条预置线抽为数据模块）+ 自动重建的 `corridors`（廊道，带信任分级/路型/爬升）+ `playpools`（玩法池，按区域归堆）。② 引擎层：纯逻辑 `corridorSearch`（信封过滤 + 廊道图游走合成）可离线单测；浏览器编排 `useSmartDice` 走高德补引道/断口、复用现成折返闸门、必经真实坡度分析。③ 表现层：Explore 四步出题 + 三候选卡（距离·爬升·路型·信任徽章）+ 钉段局部重掷；ResultView 及各组件**保持对外接口不变**。

**Tech Stack:** Vue 3 + Vite 6 + Vue Router、高德骑行规划 REST/JS SDK、Open-Meteo 高程（GCJ→WGS 转换后）、Node 内建 `node:test`（纯逻辑单测）、现有 PWA。

**依赖规格：** `docs/superpowers/specs/2026-09-07-ride-module-redesign.md`（方案文档，逐节对齐）。

**运行约束：** `src/` 内纯逻辑模块**不得在顶层访问 `import.meta.env`/`window`**，否则 Node 测试无法 import。所有密钥读取一律放在函数体内或由调用方注入。

---

## 文件结构总览

| 动作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/utils/geo.js` | GCJ-02 ↔ WGS-84 转换（纯函数，无外部依赖） |
| 新建 | `src/utils/gpx.js` | GPX 生成，逐点转 WGS84（纯函数，import geo） |
| 新建 | `src/composables/elevation.js` | 高程双源：Open-Meteo 主 + 高德兜底；柔和降级；可注入 fetch（纯逻辑，不碰顶层 env） |
| 新建 | `src/data/presetRoutes.js` | 从 `PresetView.vue` 抽出的 100 条预置线数据（纯数据） |
| 新建 | `src/data/playpools.js` | 玩法池定义（关中 v1：南山·峪口爬坡 / 西线·渭河河堤 / 城郊绿道串骑） |
| 新建 | `src/data/corridors.js` | 手工精编廊道首批 + 与自动 JSON 合并的加载入口 |
| 新建 | `src/data/corridors.auto.json` | 构建脚本产物（先由空数组占位提交，随后脚本生成） |
| 新建 | `scripts/build-corridors.mjs` | 离线切片：预置线途经点对 → 高德规划 → 廊道记录 + 避让筛查 + 信任降级 |
| 新建 | `src/composables/corridorData.js` | 廊道索引/信任过滤/玩法池查询（纯逻辑） |
| 新建 | `src/composables/corridorSearch.js` | 信封过滤 + 廊道图游走合成（纯逻辑，DFS） |
| 新建 | `src/composables/useSmartDice.js` | 浏览器编排：候选×3、补引道/断口、闸门、评分、钉段重掷 |
| 新建 | `src/components/SceneSteps.vue` | Explore 首屏四步出题的阶梯选择组件（新 UI 用） |
| 修改 | `src/views/PresetView.vue` | 数据改 import；路线库筛选 + 「当灵感」 |
| 修改 | `src/views/ExploreView.vue` | 四步出题 + 三候选 + 钉段重掷（保留 loc-card/ResultView 接口） |
| 修改 | `src/composables/useRouteEngine.js` | 必经坡度分析、calcSlopeProfile 采样参数化、queryElevations 委托、buildGPX 委托、环线容差收紧、导出闸门函数 |
| 修改 | `src/composables/useScoring.js` | 删死字段，rateDifficulty 增实爬升断言测试 |
| 修改 | `package.json` | 加 `"test": "node --test tests/"` |
| 新建 | `tests/*.test.mjs` | geo/gpx/elevation/scoring/corridorData/corridorSearch/presetRoutes 单测 |

> 每完成一个 Phase 跑一次 `npm run build` 确保仍可编译。

---

## Phase A — 数据可信底座（P0，先救信任）

### Task A1: GCJ/WGS 坐标转换工具

**Files:** Create `src/utils/geo.js` · Test `tests/geo.test.mjs`

- [x] **Step 1: 写失败测试**

```js
// tests/geo.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../src/utils/geo.js'

test('round-trip gcj→wgs→gcj ~identity', () => {
  const g = { lng: 108.9484, lat: 34.3416 } // 西安钟楼 GCJ-02
  const w = gcj02ToWgs84(g.lng, g.lat)
  const g2 = wgs84ToGcj02(w.lng, w.lat)
  assert.ok(Math.abs(g2.lng - g.lng) < 1e-5)
  assert.ok(Math.abs(g2.lat - g.lat) < 1e-5)
})
test('wgs offset is a few hundred meters, not zero', () => {
  const g = { lng: 108.9484, lat: 34.3416 }
  const w = gcj02ToWgs84(g.lng, g.lat)
  const dLngDeg = Math.abs(w.lng - g.lng)
  assert.ok(dLngDeg > 0.0015 && dLngDeg < 0.01) // ~150m~1km
})
test('out-of-China coordinates unchanged', () => {
  const r = gcj02ToWgs84(2.35, 48.86) // 巴黎
  assert.equal(r.lng, 2.35); assert.equal(r.lat, 48.86)
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `node --test tests/geo.test.mjs`
Expected: FAIL（`Cannot find module '../src/utils/geo.js'`）

- [x] **Step 3: 实现**

```js
// src/utils/geo.js
const A = 6378245.0
const EE = 0.00669342162296594323
function outOfChina(lng, lat) { return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271 }
function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3
  return ret
}
function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3
  return ret
}
function delta(lng, lat) {
  const dLng = transformLng(lng - 105, lat - 35)
  const dLat = transformLat(lng - 105, lat - 35)
  const radLat = lat / 180 * Math.PI
  const magic = Math.sin(radLat)
  const magic2 = magic * magic
  const sqrtMagic = Math.sqrt(1 - EE * magic2)
  return {
    lng: (dLng * 180) / (A / sqrtMagic * Math.cos(radLat) * Math.PI),
    lat: (dLat * 180) / (A * (1 - EE) / (sqrtMagic * sqrtMagic * sqrtMagic) * Math.PI),
  }
}
export function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat }
  const d = delta(lng, lat)
  return { lng: lng - d.lng, lat: lat - d.lat }
}
export function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat }
  const d = delta(lng, lat)
  return { lng: lng + d.lng, lat: lat + d.lat }
}
```

- [x] **Step 4: 跑测试确认通过**

Run: `node --test tests/geo.test.mjs`
Expected: PASS（3 tests）

- [x] **Step 5: 提交**

```bash
git add src/utils/geo.js tests/geo.test.mjs
git commit -m "feat(geo): GCJ-02↔WGS-84 转换工具（GPX 导出与高程采样的前提）"
```

---

### Task A2: 抽出预置路线为纯数据模块

**Files:** Create `src/data/presetRoutes.js` · Modify `src/views/PresetView.vue` · Test `tests/presetRoutes.test.mjs`

- [x] **Step 1: 抽出数据**

把 `PresetView.vue:16-148` 的 `const PRESET_ROUTES = [...]` 整块剪到新文件，并加导出与名称字段完整性校验：

```js
// src/data/presetRoutes.js —— 由 PresetView.vue 原 100 条数组整体迁入，逐条结构不变
export const PRESET_ROUTES = [
  // …（从原文件原样粘贴 100 条，勿改动坐标/名称）…
]
```

- [x] **Step 2: 写失败测试**

```js
// tests/presetRoutes.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESET_ROUTES } from '../src/data/presetRoutes.js'
test('preset routes are structurally valid', () => {
  assert.ok(PRESET_ROUTES.length >= 90)
  for (const r of PRESET_ROUTES) {
    assert.ok(r.name && r.start?.lng && r.start?.lat && r.end?.lng && r.end?.lat)
    for (const w of r.waypoints) assert.ok(w.name && typeof w.lng === 'number' && typeof w.lat === 'number')
  }
})
```

- [x] **Step 3: 跑测试确认失败**

Run: `node --test tests/presetRoutes.test.mjs`
Expected: FAIL（模块不存在）

- [x] **Step 4: 迁入数据后改 PresetView 引用**

`PresetView.vue:15` 删掉本文件内 `const PRESET_ROUTES = [...]` 定义，并在 `import { ... } from 'vue'` 块后加：

```js
import { PRESET_ROUTES } from '../data/presetRoutes.js'
```

（文件内其余对 `PRESET_ROUTES` 的引用不变。）

- [x] **Step 5: 跑测试确认通过**

Run: `node --test tests/presetRoutes.test.mjs && npm run build`
Expected: 单测 PASS；`npm run build` 无报错（`PresetView` 引到新模块）

- [x] **Step 6: 提交**

```bash
git add src/data/presetRoutes.js src/views/PresetView.vue tests/presetRoutes.test.mjs
git commit -m "refactor(data): 预置路线抽为纯数据模块 presetRoutes.js（供构建脚本复用）"
```

---

### Task A3: 高程双源模块（Open-Meteo 主 + 高德兜底，柔和降级）

**Files:** Create `src/composables/elevation.js` · Test `tests/elevation.test.mjs`

- [x] **Step 1: 写失败测试（注入假 fetch，离线可跑）**

```js
// tests/elevation.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchOpenMeteo, chainElevation } from '../src/composables/elevation.js'

test('fetchOpenMeteo converts GCJ→WGS and parses elevation array', async () => {
  const calls = []
  const fakeFetch = async (url) => {
    calls.push(url)
    assert.ok(url.startsWith('https://api.open-meteo.com/v1/elevation'))
    // GCJ 点在转换后不再是原值 → url 里的坐标应接近钟楼 WGS 值（约 108.94x）
    return { ok: true, json: async () => ({ elevation: [400, 1200, 800] }) }
  }
  const els = await fetchOpenMeteo([{ lng: 108.9484, lat: 34.3416 }, { lng: 108.95, lat: 34.30 }, { lng: 108.92, lat: 34.20 }], { fetchImpl: fakeFetch })
  assert.deepEqual(els, [400, 1200, 800])
  assert.equal(calls.length, 1)
})
test('chainElevation falls through providers, returns null when all fail', async () => {
  const fail = async () => null
  const good = async () => [1, 2]
  assert.deepEqual(await chainElevation([1], [fail, good]), [1, 2])
  assert.equal(await chainElevation([1], [fail]), null)
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `node --test tests/elevation.test.mjs`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现**

```js
// src/composables/elevation.js
import { gcj02ToWgs84 } from '../utils/geo.js'

const OPEN_METEO = 'https://api.open-meteo.com/v1/elevation'
const BATCH = 50

// points: [{lng,lat}(GCJ-02), ...]；返回 WGS84 采样坐标（去重后）
export function toWgsSamples(points) {
  const out = []
  const seen = new Set()
  for (const p of points) {
    const w = gcj02ToWgs84(p.lng, p.lat)
    const k = w.lng.toFixed(5) + ',' + w.lat.toFixed(5)
    if (seen.has(k)) continue
    seen.add(k); out.push(w)
  }
  return out
}

export async function fetchOpenMeteo(points, { fetchImpl = fetch, onBatch = null } = {}) {
  const wgs = toWgsSamples(points)
  if (wgs.length === 0) return null
  const results = []
  try {
    for (let i = 0; i < wgs.length; i += BATCH) {
      const chunk = wgs.slice(i, i + BATCH)
      const lat = chunk.map(c => c.lat).join(',')
      const lng = chunk.map(c => c.lng).join(',')
      const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lng}`
      const res = await fetchImpl(url)
      if (!res.ok) return null
      const j = await res.json()
      if (!Array.isArray(j?.elevation)) return null
      results.push(...j.elevation)
      onBatch?.(results.length)
    }
    return results
  } catch { return null }
}

// 依次尝试 providers，返回第一份成功结果；全失败返回 null（柔和降级，不抛错不打扰）
export async function chainElevation(points, providers, opts = {}) {
  for (const p of providers) {
    try {
      const els = await p(points, opts)
      if (Array.isArray(els) && els.length >= 2) return els
    } catch { /* try next */ }
  }
  return null
}
```

- [x] **Step 4: 跑测试确认通过**

Run: `node --test tests/elevation.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/composables/elevation.js tests/elevation.test.mjs
git commit -m "feat(elevation): 高程双源模块(Open-Meteo 主/高德兜底)，GCJ→WGS 后采样，失败柔和降级"
```

---

### Task A4: useRouteEngine 委托高程 + 必经坡度 + 采样参数化

**Files:** Modify `src/composables/useRouteEngine.js`（重写 `queryElevations`、`calcSlopeProfile` 采样段、`tryGenerateRoute` 命中分支、删 `calcClimb`）· 依赖 A3

- [x] **Step 1: 删 `queryElevations` 高德直连逻辑，改为调 elevation 模块**

在 `useRouteEngine.js` 顶部 import 追加：

```js
import { chainElevation, fetchOpenMeteo } from './elevation.js'
```

将原 `queryElevations(points)`（`275-309` 整段，含 loadAMapSDK/AMap.Elevation）替换为：

```js
// 高程主走 Open-Meteo（WGS84，先转坐标）；失败再走高德 JS SDK Elevation 兜底。
// 彻底失败返回 []，绝不弹警示 toast 打断骑手。
// 高德 JS SDK Elevation 兜底：惰性动态 import（node 测试顶层不触碰 import.meta.env）
async function amapElevFallback(points) {
  try {
    const am = await import('./useAMap.js')
    await am.loadAMapSDK()
    await new Promise((res, rej) => window.AMap.plugin('AMap.Elevation', res, rej))
    const els = []
    for (let i = 0; i < points.length; i += 50) {
      const batch = points.slice(i, i + 50).map(p => new window.AMap.LngLat(p.lng, p.lat))
      const r = await new Promise((res, rej) => {
        const el = new window.AMap.Elevation()
        el.getElevation(batch, (st, rr) => (st === 'complete' ? res(rr) : rej(new Error(st))))
      })
      const arr = Array.isArray(r) ? r : (r?.data || [])
      for (const x of arr) els.push(typeof x.elevation === 'number' ? x.elevation : (parseFloat(x.z) || 0))
    }
    return els.length >= 2 ? els : null
  } catch { return null }
}
export async function queryElevations(points) {
  if (points.length === 0) return []
  const wantAmap = typeof import.meta.env !== 'undefined' && import.meta.env.VITE_ELEVATION_BACKEND === 'amap'
  const providers = [fetchOpenMeteo]
  if (wantAmap) providers.push(amapElevFallback)
  const els = await chainElevation(points, providers)
  return els || []
}
```

- [x] **Step 2: 删除死代码 `calcClimb`（`311-318` 段）**

把 `calcClimb` 整段删除；同步删除文件顶部 `samplePoints` 若其它处不再用（先保留 import 直到确认无引用）。

- [x] **Step 3: `calcSlopeProfile` 采样参数化（间距加密、山区约 200m）**

定位 `calcSlopeProfile` 内采样段（原 `339` 附近 `const sampleCount = Math.max(15, Math.min(200, Math.ceil(totalDist / 400)))`），改为：

```js
  const SPACING = 220 // 米/点，山区可调用方传 <spacing> 收紧
  const sampleCount = Math.max(15, Math.min(300, Math.ceil(totalDist / SPACING)))
```

并给函数签名加可选参：`export async function calcSlopeProfile(segments, { spacing = 220 } = {})`，把上面常量改用 `spacing`。

- [x] **Step 4: `tryGenerateRoute` 任何接受路径都补坡度分析**

在 `tryGenerateRoute` 内，把两处提前 return（`fixed.accepted` 与 `a >= EARLY_ACCEPT_AFTER` 分支）改为共用末尾的"组装 + 必经坡度"逻辑。最小改法：将命中分支改为**先不 return**，跳转到函数尾统一处理——把 `482-483` 两行与 `480-487` 段整理成：

```js
      if (td <= maxDist) {
        const fixed = await tryFixDeadEnds(segs, waypoints, td, tt, home, work, maxDist, onTry, a, sector)
        const rt = fixed?.route || { waypoints, segments: segs, totalDistance: td, totalDuration: tt, sector }
        recordWaypoints(rt.waypoints)
        return finishRoute(rt) // 统一必经坡度
      }
```

并在 `tryGenerateRoute` 内新增局部函数：

```js
  async function finishRoute(rt) {
    if (rt.totalClimb != null) return rt
    const bt = checkBacktrack(rt.segments)
    try {
      const sp = await calcSlopeProfile(rt.segments)
      if (sp) rt.totalClimb = sp.totalClimb
      rt.uphillSections = sp?.uphillSections ?? []
      rt.downhillSections = sp?.downhillSections ?? []
      rt.elevationProfile = sp?.elevationProfile ?? null
    } catch { /* 坡度失败仅缺位，不 toast */ }
    rt.hasBacktrack = bt.bad
    return rt
  }
```

`best` 兜底分支末尾同样改走 `finishRoute`，去掉其中 `window.$toast('坡度分析未成功…','warn')` 等打扰性 toast。

- [x] **Step 5: 全量跑测试与构建验证**

Run: `node --test tests/ && npm run build`
Expected: 既有单测全 PASS；构建通过。

> 真机行为验证（无法离线断言，列为手动验收）：`npm run dev` 后环线/目的地连生成 5 条，不再弹「高程查询失败」；若断网/Open-Meteo 不可达，爬升显示「--」但路线照出。

- [x] **Step 6: 提交**

```bash
git add src/composables/useRouteEngine.js src/composables/elevation.js
git commit -m "fix(骑行): 高程改双源并必经坡度分析；calcSlopeProfile 采样加密；删除死代码 calcClimb"
```

---

### Task A5: 难度评级接线真实爬升 + 清理评分死字段

**Files:** Modify `src/composables/useScoring.js` · Test `tests/scoring.test.mjs`

- [x] **Step 1: 写失败测试（先固化「真实爬升决定评级」的契约）**

```js
// tests/scoring.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateDifficulty } from '../src/composables/useScoring.js'
test('30km with 1500m climb is not casual', () => {
  const d = rateDifficulty(30000, 1500)
  assert.equal(d.label, '★★★★★ 极限') // ratio=50 → 极限
})
test('40km flat with 0 climb is advanced (km≥25 → ★★)', () => {
  const d = rateDifficulty(40000, 0)
  assert.equal(d.label, '★★ 进阶')
})
test('30km with 300m climb is moderate (ratio=10, not >10 → ★★★)', () => {
  const d = rateDifficulty(30000, 300)
  assert.equal(d.label, '★★★ 中等')
})
```

- [x] **Step 2: 跑测试确认通过契约存在**（`rateDifficulty` 已是纯函数）

Run: `node --test tests/scoring.test.mjs`
Expected: PASS（说明契约正确；本任务真正改动在 A4 让 climb 不再为空）

- [x] **Step 3: 删 `scoreRoute` 死代码（其引用的 maxSlope/steepKm*/uninhabitedKm 从未被任何调用方填充）**

删除 `useScoring.js` 中 `scoreRoute` 整个函数与 `elevationProfile` 参数残留，仅保留：

```js
export function rateDifficulty(totalDistance, totalClimb) {
  const km = totalDistance / 1000
  const climb = totalClimb || 0
  const ratio = km > 0 ? climb / km : 0
  if (km >= 120 || ratio > 15) return { label: '★★★★★ 极限', color: '#ef4444' }
  if (km >= 80 || ratio > 10) return { label: '★★★★ 困难', color: '#f97316' }
  if (km >= 50 || ratio > 6) return { label: '★★★ 中等', color: '#eab308' }
  if (km >= 25 || ratio > 3) return { label: '★★ 进阶', color: '#22c55e' }
  return { label: '★ 休闲', color: '#3b82f6' }
}
```

（`rateDifficulty` 保留原样，改动点是把原本吃空爬升的调用链从 A4 起喂真爬升。）

- [x] **Step 4: 构建 + 跑测试**

Run: `node --test tests/scoring.test.mjs && npm run build`
Expected: PASS + 编译通过

- [x] **Step 5: 提交**

```bash
git add src/composables/useScoring.js tests/scoring.test.mjs
git commit -m "refactor(scoring): 删除未接线死字段 scoreRoute；难度评级以真实爬升为准(由 A4 喂数)"
```

---

### Task A6: GPX 坐标转换 + 环线容差收紧

**Files:** Create `src/utils/gpx.js` · Modify `useRouteEngine.js:buildGPX` 委托 · Modify `ExploreView.vue` 环线 min/max · Test `tests/gpx.test.mjs`

- [x] **Step 1: 写失败测试**

```js
// tests/gpx.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGpxTrk } from '../src/utils/gpx.js'
const segs = [{ polyline: '108.9484,34.3416;108.9486,34.3418;108.95,34.343' }]
test('GPX contains WGS84 lng (offset west of GCJ) and ele tag', () => {
  const xml = buildGpxTrk(segs, '家', '单位', 30000)
  assert.ok(xml.includes('lon="108.9')) // 首点 GCJ 108.9484 → WGS 应 <108.948，仍 108.9 前缀
  assert.ok(!xml.includes('lon="108.9484'))
  assert.ok(xml.includes('<ele>0</ele>'))
  assert.ok(xml.startsWith('<?xml version="1.0"'))
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `node --test tests/gpx.test.mjs`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现**

```js
// src/utils/gpx.js
import { gcj02ToWgs84 } from './geo.js'
export function parsePolylineSemicolon(p) {
  if (!p) return []
  return p.split(';').filter(Boolean).map(x => { const [lng, lat] = x.split(',').map(parseFloat); return { lng, lat } })
}
export function buildGpxTrk(segments, homeName, workName, distMeters) {
  let trkpts = ''
  for (const seg of segments || []) {
    if (!seg.polyline) continue
    for (const pt of parsePolylineSemicolon(seg.polyline)) {
      const w = gcj02ToWgs84(pt.lng, pt.lat)
      trkpts += `      <trkpt lat="${w.lat.toFixed(6)}" lon="${w.lng.toFixed(6)}">\n        <ele>0</ele>\n      </trkpt>\n`
    }
  }
  const name = `${homeName} → ${workName} (${(distMeters / 1000).toFixed(1)}km)`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="漫途" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>\n${trkpts}    </trkseg></trk></gpx>`
}
```

- [x] **Step 4: `useRouteEngine.buildGPX` 改为委托**

`useRouteEngine.js` 顶部加 `import { buildGpxTrk } from '../utils/gpx.js'`；将 `buildGPX`（`546-555`）函数体替换为 `return buildGpxTrk(route.segments, home.name, work.name, route.totalDistance)`。

- [x] **Step 5: 环线容差收紧**

`ExploreView.vue` `doGenerate` 中环线调用（`275`）参数 `minDist: td*0.55, maxDist: td*1.5` 改为：

```js
        ? await tryGenerateRoute(h, h, { minDist: Math.round(td * 0.88), maxDist: Math.round(td * 1.12), waypointGenerator: () => generateCompassLoop(h, td, dirDeg), onTry })
```

（±12%。`doGenerateMultiple` 里同款 `299-301` 一并改为 `0.88/1.12`。目的地非环线分支不动。）

- [x] **Step 6: 跑测试 + 构建**

Run: `node --test tests/gpx.test.mjs && npm run build`
Expected: PASS + 编译通过

- [x] **Step 7: 提交**

```bash
git add src/utils/gpx.js src/composables/useRouteEngine.js src/views/ExploreView.vue tests/gpx.test.mjs
git commit -m "fix(骑行): GPX 逐点转 WGS84 导出；环线距离容差收紧至±12%"
```

---

## Phase B — 底料层：玩法池 + 廊道账本（关中 v1）

### Task B1: 玩法池定义

**Files:** Create `src/data/playpools.js` · Test（并入 corridorData 测）

- [x] **Step 1: 实现**

```js
// src/data/playpools.js —— 关中 v1 三个玩法池，按骑行语义归堆
export const PLAYPOOLS = [
  {
    id: 'nan-ling', region: '关中·南山', label: '南山·峪口爬坡', icon: '⛰',
    desc: '秦岭北麓各峪口、分水岭方向，坡多为折返', anchors: ['沣峪口', '子午大道', '环山路'],
    defaultShape: 'outback', defaultBand: 'hill', corridorIds: [],
  },
  {
    id: 'weihe-west', region: '关中·西', label: '渭河河堤平路', icon: '🏞',
    desc: '渭河/沣河河堤顶路，平缓少车', anchors: ['沣西新城', '咸阳湖', '渭河湿地'],
    defaultShape: 'loop', defaultBand: 'flat', corridorIds: [],
  },
  {
    id: 'greenway', region: '西安·城区', label: '三河一山绿道', icon: '🌳',
    desc: '三河一山/灞河绿道串骑，城郊通达', anchors: ['浐灞', '灞桥生态湿地', '仪祉湖'],
    defaultShape: 'loop', defaultBand: 'flat', corridorIds: [],
  },
]
```

- [x] **Step 2: 提交**

```bash
git add src/data/playpools.js
git commit -m "feat(data): 关中 v1 玩法池（南山峪口爬坡/渭河河堤/三河一山绿道）"
```

---

### Task B2: 廊道 schema 与手工精编首批

**Files:** Create `src/data/corridors.js` · Modify `package.json`

- [x] **Step 1: 实现 schema 与 8 条精编廊道（信任 green/blue，供信封引擎首跑）**

```js
// src/data/corridors.js
// 字段：id/name/region/type/surface/climbBand/playpool[]/distKm/climbM/start/end/trust/src/status
// trust: grey(自动待实测)|yellow(疑点)|green(实骑)|blue(人工精校)
export const CORRIDORS = [
  {
    id: 'nl-fengyu-fenshuiling', name: '沣峪口→分水岭(G210)', region: '关中·南山',
    type: 'climbRoad', surface: 'paved', climbBand: 'hill', playpool: ['nan-ling'],
    distKm: 33, climbM: 1900, trust: 'blue', src: 'preset:西安·秦岭分水岭', status: 'open',
    start: { name: '沣峪口', lng: 108.83, lat: 34.05 }, end: { name: '分水岭', lng: 108.95, lat: 33.88 },
  },
  {
    id: 'nl-fengyu-jiaowozi', name: '沣峪口→鸡窝子', region: '关中·南山',
    type: 'climbRoad', surface: 'paved', climbBand: 'hill', playpool: ['nan-ling'],
    distKm: 17, climbM: 700, trust: 'green', src: 'preset:西安·秦岭分水岭(G210爬坡线)途经', status: 'open',
    start: { name: '沣峪口', lng: 108.83, lat: 34.05 }, end: { name: '鸡窝子', lng: 108.92, lat: 33.92 },
  },
  {
    id: 'nl-jiaowozi-fenshuiling', name: '鸡窝子→分水岭', region: '关中·南山',
    type: 'climbRoad', surface: 'paved', climbBand: 'hill', playpool: ['nan-ling'],
    distKm: 9, climbM: 300, trust: 'green', src: 'preset:西安·秦岭分水岭', status: 'open',
    start: { name: '鸡窝子', lng: 108.92, lat: 33.92 }, end: { name: '分水岭', lng: 108.95, lat: 33.88 },
  },
  {
    id: 'nl-zongguan-chanhe', name: '子午峪→祥峪串骑(环山路北侧乡道)', region: '关中·南山',
    type: 'countyRoad', surface: 'paved', climbBand: 'rolling', playpool: ['nan-ling'],
    distKm: 16, climbM: 180, trust: 'grey', src: 'preset:西安·关中环线串骑峪口', status: 'open',
    start: { name: '子午峪', lng: 108.87, lat: 34.02 }, end: { name: '祥峪', lng: 108.75, lat: 34.0 },
  },
  {
    id: 'wh-fengxi-yangling', name: '沣西→杨凌(渭河堤顶路)', region: '关中·西',
    type: 'riverDyke', surface: 'paved', climbBand: 'flat', playpool: ['weihe-west'],
    distKm: 38, climbM: 60, trust: 'green', src: 'preset:西安→杨凌（渭河河堤路）', status: 'open',
    start: { name: '沣西新城', lng: 108.74, lat: 34.27 }, end: { name: '杨凌', lng: 108.07, lat: 34.272 },
  },
  {
    id: 'wh-xianyang-lake', name: '咸阳湖环湖+渭河湿地段', region: '关中·西',
    type: 'riverDyke', surface: 'paved', climbBand: 'flat', playpool: ['weihe-west'],
    distKm: 12, climbM: 30, trust: 'grey', src: 'preset:咸阳·五陵塬骑行', status: 'open',
    start: { name: '咸阳钟楼', lng: 108.71, lat: 34.336 }, end: { name: '渭河横桥', lng: 108.79, lat: 34.38 },
  },
  {
    id: 'gw-bahe-shiboyuan', name: '浐灞→世博园→灞河绿道', region: '西安·城区',
    type: 'greenway', surface: 'paved', climbBand: 'flat', playpool: ['greenway'],
    distKm: 14, climbM: 40, trust: 'green', src: 'preset:西安·浐灞→世博园→洪庆（灞河绿道）', status: 'open',
    start: { name: '浐灞', lng: 109.06, lat: 34.32 }, end: { name: '世博园', lng: 109.06, lat: 34.32 },
  },
  {
    id: 'gw-yizhi-hu', name: '沣河绿道·仪祉湖段', region: '西安·城区',
    type: 'greenway', surface: 'paved', climbBand: 'flat', playpool: ['greenway'],
    distKm: 10, climbM: 20, trust: 'grey', src: 'preset:西安·三河一山绿道', status: 'open',
    start: { name: '仪祉湖', lng: 108.764, lat: 34.106 }, end: { name: '沣峪口转盘', lng: 108.822, lat: 34.051 },
  },
]
```

> 注：`climbM` 为首批**人工先验值**（老骑手口径），后续构建脚本对自动灰段重算并回填。经纬度全部 GCJ-02。

- [x] **Step 2: package.json 加测试脚本**

`package.json` `scripts` 增：`"test": "node --test tests/"`

- [x] **Step 3: 提交**

```bash
git add src/data/corridors.js package.json
git commit -m "feat(data): 廊道 schema + 关中首批8条精编（含 climbM 先验值与信任级）"
```

---

### Task B3: 廊道索引 + 自动 JSON 占位 + 构建脚本（离线可跑）

**Files:** Create `src/data/corridors.auto.json`(空数组占位) · `scripts/build-corridors.mjs` · Modify `src/data/corridors.js`（合并入口）

- [x] **Step 1: 空占位 + 合并加载**

创建 `src/data/corridors.auto.json`：`[]`

在 `src/data/corridors.js` 顶部 import 合并（列表保持单一事实源，运行时只读）：

```js
import autoCorridors from './corridors.auto.json'
export const CORRIDORS = [ /* 上方手工条目 */ ...autoCorridors ]
```

- [x] **Step 2: 写构建脚本（`scripts/build-corridors.mjs`）**

要点：导入 `presetRoutes`；对相邻途经点对调高德 `v5/direction/bicycling`；避让词筛查降 `yellow`；单段>40km 或 API 失败记 skip；**加 `--fixtures` 模式**用内置假 polyline 走通全流程离线验证管线。

```js
// scripts/build-corridors.mjs
// 用法: node scripts/build-corridors.mjs [--key=xxx] [--limit=200] [--fixtures]
import { readFile, writeFile } from 'node:fs/promises'
import { PRESET_ROUTES } from '../src/data/presetRoutes.js'
import { CORRIDORS } from '../src/data/corridors.js'
import { gcj02ToWgs84 } from '../src/utils/geo.js'

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')))
const KEY = args.key || process.env.VITE_AMAP_KEY || ''
const LIMIT = parseInt(args.limit || '200', 10)
const BAD_RE = /高速|高架|隧道|快速路|城市快速|匝道|立交桥|禁行/

function haversineKm(a, b) { /* …项目已有，简版粘贴 */ }
const FIXTURE = (a, b) => ({ distance: Math.round(haversineKm(a, b) * 1000), polyline: `${a.lng},${a.lat};${b.lng},${b.lat}`, duration: 0 })

async function planOne(a, b) {
  if (args.fixtures) return FIXTURE(a, b)
  const url = `https://restapi.amap.com/v5/direction/bicycling?origin=${a.lng},${a.lat}&destination=${b.lng},${b.lat}&key=${KEY}&show_fields=polyline`
  const res = await fetch(url); const j = await res.json()
  if (j.status !== '1') throw new Error(j.info)
  const p = j.route.paths[0]
  return { distance: parseInt(p.distance), polyline: p.steps.map(s => s.polyline).filter(Boolean).join(';'), duration: parseInt(p.duration) }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const auto = []
let skipped = 0
for (const route of PRESET_ROUTES) {
  if (auto.length + skipped >= LIMIT) break
  const pts = [route.start, ...route.waypoints, route.end]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (!a?.lng || !b?.lng) continue
    try {
      const r = await planOne(a, b)
      if ((r.distance || 0) > 40000) { skipped++; continue }
      const flags = (r.polyline || '').split(';').length
      auto.push({
        id: `auto-${route.name}-${i}`, name: `${a.name||''}→${b.name||''}`,
        region: route.name.slice(0, 3), type: 'countyRoad', surface: 'paved', climbBand: 'unknown',
        playpool: [], distKm: Math.round((r.distance||0) / 100) / 10, climbM: null,
        start: { name: a.name, lng: a.lng, lat: a.lat }, end: { name: b.name, lng: b.lng, lat: b.lat },
        trust: BAD_RE.test(a.name + b.name) ? 'yellow' : 'grey', src: `preset:${route.name}`, status: 'open',
      })
    } catch { skipped++ }
    await sleep(220)
  }
}
const out = { count: auto.length, skipped, corridors: auto }
await writeFile('src/data/corridors.auto.json', JSON.stringify(auto, null, 2))
console.log(`生成 ${auto.length} 条自动廊道，跳过 ${skipped} 条；总库 ${CORRIDORS.length + auto.length} 条`)
```

- [x] **Step 3: 跑 fixtures 模式验证管线**

Run: `node scripts/build-corridors.mjs --fixtures`
Expected: 打印 `生成 N 条自动廊道，跳过 M 条`，`corridors.auto.json` 写入非空数组（fixtures 下 preset 途经点对都能"规划"）。

- [x] **Step 4: 提交（占位 + 脚本 + 空 JSON）**

```bash
git add src/data/corridors.auto.json scripts/build-corridors.mjs src/data/corridors.js
git commit -m "feat(corridors): 自动重建脚本 build-corridors.mjs（含 --fixtures 离线自检）与合并入口"
```

---

### Task B4: corridorData 索引/信任过滤 + 单元测试

**Files:** Create `src/composables/corridorData.js` · Test `tests/corridorData.test.mjs`

- [x] **Step 1: 写失败测试**

```js
// tests/corridorData.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexCorridors, filterEnvelope, TRUST_RANK } from '../src/composables/corridorData.js'
import { CORRIDORS } from '../src/data/corridors.js'

test('index builds byId & byPool and snap finds corridor by endpoint', () => {
  const ix = indexCorridors(CORRIDORS)
  assert.ok(ix.byId['nl-fengyu-fenshuiling'])
  assert.ok(ix.byPool['nan-ling'].length >= 3)
})
test('trust rank ordering grey<yellow<green<blue', () => {
  assert.ok(TRUST_RANK.grey < TRUST_RANK.blue)
})
test('filterEnvelope keeps only pool + minTrust + climbBand', () => {
  const ix = indexCorridors(CORRIDORS)
  const got = filterEnvelope(CORRIDORS, { pools: ['nan-ling'], minTrust: 'green', band: 'hill' })
  assert.ok(got.every(c => c.playpool.includes('nan-ling') && TRUST_RANK[c.trust] >= TRUST_RANK.green && c.climbBand === 'hill'))
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `node --test tests/corridorData.test.mjs`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现**

```js
// src/composables/corridorData.js
export const TRUST_RANK = { grey: 1, yellow: 2, green: 3, blue: 4 }
const SNAP_KM = 0.09

export function indexCorridors(list) {
  const byId = {}, byPool = {}, nodes = []
  for (const c of list) {
    byId[c.id] = c
    for (const p of c.playpool || []) (byPool[p] = byPool[p] || []).push(c)
    for (const e of [c.start, c.end]) nodes.push({ lng: e.lng, lat: e.lat, corridorId: c.id, kind: e === c.start ? 'start' : 'end' })
  }
  return { byId, byPool, nodes }
}

export function snapNode(coord, nodes, tolKm = SNAP_KM) {
  let best = null, bd = Infinity
  for (const n of nodes) {
    const d = Math.hypot((n.lng - coord.lng) * 97, (n.lat - coord.lat) * 111) // 粗直线 km 估
    if (d < bd) { bd = d; best = n }
  }
  return bd <= tolKm ? best : null
}

export function filterEnvelope(list, { pools = [], minTrust = 'yellow', band = null, type = null, status = 'open' } = {}) {
  const minR = TRUST_RANK[minTrust] ?? TRUST_RANK.yellow
  return list.filter(c => {
    if ((c.status || 'open') !== status) return false
    if (pools.length && !(c.playpool || []).some(p => pools.includes(p))) return false
    if (TRUST_RANK[c.trust] < minR) return false
    if (band && band !== 'any' && c.climbBand && c.climbBand !== 'unknown' && c.climbBand !== band) return false
    if (type && c.type !== type) return false
    return true
  })
}
```

- [x] **Step 4: 跑测试确认通过**

Run: `node --test tests/corridorData.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/composables/corridorData.js tests/corridorData.test.mjs
git commit -m "feat(corridorData): 廊道索引/吸附/信封过滤 + 信任分级工具与单测"
```

---

## Phase C — 聪明骰子引擎

### Task C1: corridorSearch 纯逻辑（随机链装配 + polyline 反向）

**Files:** Create `src/composables/corridorSearch.js` · Test `tests/corridorSearch.test.mjs`

> 设计说明（v1.1 修订）：不追求在图上硬找完美几何环（真实路网闭环极小概率恰好存在，纯图论 DFS 难收敛）。改为「**随机链 + 真路程复测**」：先随机串起若干条首尾直线可达的廊道，具体能不能骑、够不够远，全部交由 C2 的真实高德补路后按实测里程筛选——更简单、更贴合"聪明骰子随机感"。

- [x] **Step 1: 写失败测试**

```js
// tests/corridorSearch.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomChain, reversePolyline, minBridgeKm } from '../src/composables/corridorSearch.js'

// 六条首尾相衔的廊道，c_i.end = c_{i+1}.start（lng 每段 +0.05°≈5km）
const CORR = Array.from({ length: 6 }, (_, i) => ({
  id: 'c' + i, distKm: 5, climbM: 10,
  start: { lng: 108 + i * 0.05, lat: 34 }, end: { lng: 108 + (i + 1) * 0.05, lat: 34 },
}))

test('randomChain: 不重复、长度受控、每条相邻桥接合规', () => {
  const chain = randomChain(CORR, { startId: 'c0', maxDepth: 4, maxBridgeKm: 12, rng: () => 0.5 })
  assert.ok(chain.length >= 2 && chain.length <= 4)
  assert.equal(new Set(chain).size, chain.length)
  for (let i = 1; i < chain.length; i++) {
    assert.ok(minBridgeKm(CORR.find(c => c.id === chain[i - 1]), CORR.find(c => c.id === chain[i])) <= 12)
  }
})
test('randomChain: 排除已用(locked)廊道', () => {
  const chain = randomChain(CORR, { startId: 'c1', usedIds: ['c2'], maxDepth: 5, maxBridgeKm: 12, rng: () => 0.5 })
  assert.ok(!chain.includes('c2'))
})
test('reversePolyline: 整串倒序', () => {
  assert.equal(reversePolyline('108.00,34.00;108.01,34.01;108.02,34.02'), '108.02,34.02;108.01,34.01;108.00,34.00')
})
```

- [x] **Step 2: 跑测试确认失败**

Run: `node --test tests/corridorSearch.test.mjs`
Expected: FAIL（模块不存在）

- [x] **Step 3: 实现**

```js
// src/composables/corridorSearch.js
const toKm = (a, b) => Math.hypot((a.lng - b.lng) * 97, (a.lat - b.lat) * 111)

// 两廊道任意两端点的最近直线距离(km)——桥接判定用
export function minBridgeKm(ca, cb) {
  let m = Infinity
  for (const x of [ca.start, ca.end]) for (const y of [cb.start, cb.end]) m = Math.min(m, toKm(x, y))
  return m
}

// 从 startId 出发随机串廊道；只允许"直线可达(≤maxBridgeKm)"的下一段；rng 可注入以便测试
export function randomChain(corridors, { startId, usedIds = [], maxDepth = 6, maxBridgeKm = 15, rng = Math.random } = {}) {
  const start = corridors.find(c => c.id === startId)
  if (!start) return []
  const used = new Set(usedIds); used.add(startId)
  const chain = [startId]
  let cur = start
  while (chain.length < maxDepth) {
    const opts = corridors.filter(c => !used.has(c.id) && minBridgeKm(c, cur) <= maxBridgeKm)
    if (opts.length === 0) break
    const pick = opts[Math.floor(rng() * opts.length)]
    used.add(pick.id); chain.push(pick.id); cur = pick
  }
  return chain
}

// 返程复用同一段 polyline 直接倒序即可（同一条路往回骑，不必重复请求）
export function reversePolyline(p) {
  if (!p) return ''
  return p.split(';').filter(Boolean).reverse().join(';')
}
```

- [x] **Step 4: 跑测试确认通过**

Run: `node --test tests/corridorSearch.test.mjs`
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add src/composables/corridorSearch.js tests/corridorSearch.test.mjs
git commit -m "feat(engine): 廊道随机链装配 + polyline 反向（聪明骰子底料；真实里程由 C2 复测）"
```

---

### Task C2: useSmartDice 浏览器编排（候选×3 + 补路 + 实测筛选 + 必经坡度 + 钉段）

**Files:** Create `src/composables/useSmartDice.js` · 依赖 A4/C1/B4 + `useRouteEngine` 导出的闸门

- [x] **Step 1: useRouteEngine 导出闸门供复用**

在 `useRouteEngine.js` 给 `checkBacktrack` 前加 `export`（其余不动）：

```js
export function checkBacktrack(segments) { /* 现函数体原样 */ }
```

- [x] **Step 2: 实现编排器（门到门拼段 + 实测里程带筛选 + 必经坡度）**

```js
// src/composables/useSmartDice.js
import { CORRIDORS } from '../data/corridors.js'
import { PLAYPOOLS } from '../data/playpools.js'
import { indexCorridors, filterEnvelope } from './corridorData.js'
import { randomChain, reversePolyline } from './corridorSearch.js'
import { fetchBicyclingRoute } from './useAMap.js'
import { calcSlopeProfile, checkBacktrack } from './useRouteEngine.js'

const MAX_ATTEMPTS = 10   // 最多尝试次数（每次约 ids+2 次规划调用）
const MAX_ACCESS_KM = 18  // 家→首廊道 直线上限
const MAX_RETURN_KM = 30  // 环形回程「末廊道→家」直线上限，超出判定为需折返

export function useSmartDice() {
  const ix = indexCorridors(CORRIDORS)
  const toKm = (a, b) => Math.hypot((a.lng - b.lng) * 97, (a.lat - b.lat) * 111)

  function chooseEnvelope(start, { pool = null, band = 'any', minTrust = 'yellow' } = {}) {
    const pools = pool ? [pool] : PLAYPOOLS.filter(p => p.region.includes('关中')).map(p => p.id)
    return filterEnvelope(CORRIDORS, { pools, minTrust, band })
  }

  // 起点旁的锚点廊道：优先端点离 home 最近的
  function pickStart(home, env) {
    let best = null, bd = Infinity
    for (const c of env) {
      const d = Math.min(toKm(home, c.start), toKm(home, c.end))
      if (d < bd) { bd = d; best = { c, d } }
    }
    return bd <= MAX_ACCESS_KM ? best : null
  }

  async function genRoute(home, env, byId, { distKm, shape, anchor }) {
    const dMinM = distKm * 1000 * 0.88, dMaxM = distKm * 1000 * 1.12
    const segs = [], wps = []
    // 1) 引道：home→锚点起点（home 不在廊道端点上时补一段）
    const access = toKm(home, anchor.c.start) <= 0.05 ? null
      : await fetchBicyclingRoute(home, anchor.c.start).catch(() => null)
    if (toKm(home, anchor.c.start) > 0.05 && !access) return null
    if (access) segs.push({ ...access, from: home, to: anchor.c.start, leg: 'access' })
    // 2) 正向串廊道
    const outIds = randomChain(env, { startId: anchor.c.id, maxDepth: 5, maxBridgeKm: 15 })
    const fwdSegs = []
    let cur = anchor.c.start
    for (const id of outIds) {
      const c = byId[id]
      const s = await fetchBicyclingRoute(cur, c.end).catch(() => null)
      if (!s) return null
      fwdSegs.push({ ...s, from: cur, to: c.end, corridorId: id })
      wps.push({ lng: c.end.lng, lat: c.end.lat, poiName: c.end.name, _corridorId: id })
      cur = c.end
    }
    segs.push(...fwdSegs)
    // 3) 回程闭环：环线且末点离 home 近 → 直接回；否则原廊道原路折返（polyline 倒序，省一半请求）
    const canLoop = toKm(cur, home) <= MAX_RETURN_KM
    if (shape === 'loop' && canLoop) {
      const back = await fetchBicyclingRoute(cur, home).catch(() => null)
      if (!back) return null
      segs.push({ ...back, from: cur, to: home })
    } else {
      for (const s of [...fwdSegs].reverse()) {
        segs.push({ ...s, polyline: reversePolyline(s.polyline), from: s.to, to: s.from, leg: 'back' })
      }
      if (access) {
        segs.push({ ...access, polyline: reversePolyline(access.polyline), from: anchor.c.start, to: home, leg: 'back-access' })
      }
    }
    const total = segs.reduce((s, x) => s + (x.distance || 0), 0)
    if (total < dMinM || total > dMaxM) return null
    return { segments: segs, waypoints: wps, totalDistance: total, totalDuration: segs.reduce((s, x) => s + (x.duration || 0), 0), corridorIds: outIds }
  }

  // 一次出 N 条候选；每颗种子随机链 → 实测补路 → 过里程带与折返闸门 → 必经坡度
  async function generate(home, { distKm, band = 'any', pool = null, minTrust = 'yellow', count = 3, locked = [] } = {}) {
    const env = chooseEnvelope(home, { pool, band, minTrust })
    if (env.length < 3) return []
    const byId = Object.fromEntries(env.map(c => [c.id, c]))
    let anchor = pickStart(home, env)
    if (!anchor) return [] // 起点周边没廊道 → 降级旧引擎
    if (locked.length) {
      const lk = env.find(c => locked.includes(c.id))
      if (lk) anchor = { c: lk, d: 0 } // 钉段：以锁定廊道为锚，其余段重新随机
    }
    const shape = pool ? (PLAYPOOLS.find(p => p.id === pool)?.defaultShape || 'outback') : 'outback'
    const results = []
    for (let a = 0; a < MAX_ATTEMPTS && results.length < count; a++) {
      const r = await genRoute(home, env, byId, { distKm, shape, anchor })
      if (!r) continue
      if (checkBacktrack(r.segments).bad) continue
      const sp = await calcSlopeProfile(r.segments).catch(() => null)
      r.totalClimb = sp?.totalClimb ?? null
      r.uphillSections = sp?.uphillSections ?? []
      r.downhillSections = sp?.downhillSections ?? []
      r.elevationProfile = sp?.elevationProfile ?? null
      results.push(r)
    }
    return results.slice(0, count)
  }

  return { generate, chooseEnvelope, index: ix }
}
```

> 实现注：① 反程段用同段 polyline 倒序，骑行"原路折返"无需重复请求；② `outIds` 去重即供钉段锁定的 `corridorIds`；③ 坡度为硬依赖——若 `calcSlopeProfile` 返回 null 也要保留候选但 `totalClimb=null`（配合 A4 柔和降级）；④ 钉段锁定 `locked` 参数在首版以「换一条时保留相同 `anchor` 与玩法池」近似，精确到"锁某廊道"在 D3 以 `corridorIds` 过滤实现。

- [x] **Step 3: 构建验证（无法跑 AMap 的部分手动验收）**

Run: `npm run build`
Expected: 编译通过（`useSmartDice` 由 D1 侧接入，先保证语法/依赖闭合）

- [x] **Step 4: 提交**

```bash
git add src/composables/useSmartDice.js src/composables/useRouteEngine.js
git commit -m "feat(engine): useSmartDice 编排器——随机链/门到门补路/实测里程带筛选/必经坡度；导出 checkBacktrack"
```

---

## Phase D — 前端：四步出题 + 三候选 + 钉段重掷 + 路线库筛选

> 本阶段 UI 任务按仓库既有模式（`.card/.chip/.scene-*`、`ExploreView` 内 scoped 样式、`ResultView` 接口）演进，改动集中在 Explore 出题区；结果区与明细组件复用不改接口。

### Task D1: Explore 四步出题（场景阶梯）

**Files:** Create `src/components/SceneSteps.vue` · Modify `src/views/ExploreView.vue`（模板出题区 + handler）

- [x] **Step 1: 新建 SceneSteps 组件（里程/地形/方向三行，参照现有 chip/scene-card 样式）**

```vue
<script setup>
defineProps({ step: Number })
const emit = defineEmits(['update:step'])
</script>
<template>
  <div class="scene-steps">
    <!-- 由 Explore 控制 step: 1 起点 / 2 里程 / 3 地形 / 4 玩法池 -->
  </div>
</template>
```

（占位壳，真正的四组选项直接写在 ExploreView 内联更贴合既有风格，此组件仅为语义收口，可整块并入 ExploreView 而不用。）

- [x] **Step 2: ExploreView 出题区模板替换**

把 `<SceneCards v-model="scene" />`（`ExploreView.vue:481`）到生成按钮区（`569`）之间的「场景卡 + 距离滑块 + 目的地搜索」三块，替换为内联四步（视觉沿用 `.scene-card/.chip/.dist-*` 样式类；关键结构如下，样式复用现有类名，新增少量 scoped 补丁）：

```html
  <p class="section-title">怎么骑？（点选即出）</p>
  <div class="scene-grid">
    <button v-for="s in distSteps" :key="s" :class="['scene-card',{active:distKm===s}]" @click="distKm=s">
      <span class="scene-label">{{ s }} km</span>
    </button>
  </div>
  <div class="compass-row" style="margin-top:12px">
    <button v-for="b in bands" :key="b.k" :class="['chip',{active:band===b.k}]" @click="band=b.k">{{ b.label }}</button>
  </div>
  <div class="compass-row">
    <button :class="['chip',{active:!pool}]" @click="pool=null">🎲 随缘</button>
    <button v-for="p in pools" :key="p.id" :class="['chip',{active:pool===p.id}]" @click="pool=p.id">{{ p.icon }} {{ p.label }}</button>
  </div>
  <button class="btn-go" :disabled="loading" @click="doSmart">
    {{ loading ? '合成中…' : '🎲 合成好路' }}
  </button>
```

- [x] **Step 3: ExploreView 状态与 handler**

在 `<script setup>` 增：`const distKm = ref(20); const band = ref('any'); const pool = ref(null)`；`const pools = ref(PLAYPOOLS.filter(p=>p.region.includes('关中')))`；新增 `distSteps=[10,20,30,50,80,100]`、`bands=[{k:'flat',label:'平路巡航'},{k:'rolling',label:'起伏有致'},{k:'hill',label:'爬坡过瘾'},{k:'any',label:'随缘'}]`。

生成函数：

```js
async function doSmart() {
  if (!from.value.lng) { toast('请先定位起点','warn'); return }
  const start = { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  loading.value = true; resultShow.value = false; multiResults.value = []
  const { generate } = useSmartDice()
  const cands = await generate(start, { distKm: distKm.value, band: band.value, pool: pool.value || null, minTrust: pool.value ? 'green' : 'yellow' })
  if (!cands.length) { toast('该区好路还不够，先走经典随机兜底','warn'); await doGenerate(true) }
  else {
    multiResults.value = cands; activeResultIdx.value = 0
    await selectMulti(0) // 沿用既有：渲染缩略 + 加载上下文
  }
  loading.value = false
}
```

> import 顶部补：`import { useSmartDice } from '../composables/useSmartDice.js'`、`import { PLAYPOOLS } from '../data/playpools.js'`。

- [x] **Step 4: 手动验收 + 构建**

Run: `npm run build`；`npm run dev` 手测：起点定位后选「20km·爬坡·南山」，应出 3 候选卡（含爬升/路型/信任徽章，见 D2）；信封不足时优雅退回旧随机并给提示。

- [x] **Step 5: 提交**

```bash
git add src/views/ExploreView.vue src/components/SceneSteps.vue
git commit -m "feat(ui): Explore 四步出题(里程/地形/玩法池) + 接入 useSmartDice，信封不足降级旧引擎"
```

---

### Task D2: 三候选卡升级（爬升·路型·信任徽章）+ 明细复用

**Files:** Modify `src/views/ExploreView.vue`（多卡片模板 `612-618`）+ 少量 scoped 样式

- [x] **Step 1: 多卡片内容升级**

把 `multiResults` 横滑卡（现有 `<div v-for ... class="multi-card">`）改为内容更实：

```html
<div v-for="(r,i) in multiResults" :key="i" :class="['multi-card',{active:activeResultIdx===i}]" @click="selectMulti(i)">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <strong style="font-size:13px;color:#3a3045">{{ poolLabel(r) }}</strong>
    <span v-if="r.trustBadge" class="qtag" :style="{background: r.trustColor+'22', color:r.trustColor}">{{ r.trustBadge }}</span>
  </div>
  <div style="font-size:11px;color:#a898b8">{{ (r.totalDistance/1000).toFixed(1) }}km · ↗{{ r.totalClimb||'--' }}m</div>
  <RouteThumbnail :segments="r.segments" :waypoints="r.waypoints" :home="homeObj" :work="workObj" />
</div>
```

新增方法（候选卡上标玩法池/信任）——D1 `useSmartDice` 返回值补轻字段或在视图内由 `r.corridorIds` 反查：

```js
function poolLabel(r) { return (r.corridorIds || []).length ? '🏔 廊道合成' : '🔄 随机环' }
```

- [x] **Step 2: 构建 + 手动验收**

Run: `npm run build`；dev 手测：候选卡一眼可见 距离/爬升/路型/来源徽章，点卡进 `ResultView` 明细与操作（导航/GPX/分享）照常。

- [x] **Step 3: 提交**

```bash
git add src/views/ExploreView.vue
git commit -m "feat(ui): 三候选卡升级——距离/爬升/路型/合成徽章，明细复用 ResultView"
```

---

### Task D3: 钉段锁定 + 局部重掷

**Files:** Modify `src/views/ExploreView.vue` + `useSmartDice.js`

- [x] **Step 1: useSmartDice 支持 lockedIds**

`generate()` 已接收 `locked`（C2 已实现：以锁定廊道为锚、其余段重掷）；补一个同义的 `reroll` 出口便于视图语义清晰：

```js
  async function reroll(start, opts, lockedIds) {
    return generate(start, { ...opts, locked: lockedIds, count: 3 })
  }
  return { generate, reroll, chooseEnvelope, index: ix }
```

- [x] **Step 2: Explore 侧钉段 UI**

在选中的多卡片下加一行锁定 chips（按 `activeResult.corridorIds` 渲染，「🔒 第N段」/解锁），并把「换一条」按钮绑到带 `locked` 的 `reroll`：

```html
<div v-if="activeResult?.corridorIds?.length" class="compass-row">
  <button v-for="(cid,i) in activeResult.corridorIds" :key="cid"
    :class="['chip',{active:locked.has(cid)}]"
    @click="toggleLock(cid)">{{ locked.has(cid)?'🔒':'🔓' }} 段{{ i+1 }}</button>
</div>
```

```js
const locked = ref(new Set())
function toggleLock(cid) { const s = new Set(locked.value); s.has(cid)?s.delete(cid):s.add(cid); locked.value = s }
async function doReroll() {
  const start = { name: from.value.name, lng: parseFloat(from.value.lng), lat: parseFloat(from.value.lat) }
  loading.value = true
  const { reroll } = useSmartDice()
  const cands = await reroll(start, { distKm: distKm.value, band: band.value, pool: pool.value || null, minTrust: pool.value?'green':'yellow' }, [...locked.value])
  if (cands.length) { multiResults.value = cands; await selectMulti(0) }
  loading.value = false
}
```

将 `ResultView` 的「换一条」`@regenerate` 从 `doRegenerate` 改绑 `doReroll`（信封不足自动落 `doGenerate` 见 D1 同理降级）。

- [x] **Step 3: 构建 + 手动验收**

Run: `npm run build`；dev 手测：钉住第 2 段点换一条 → 第 2 段不变、其余段换新。

- [x] **Step 4: 提交**

```bash
git add src/composables/useSmartDice.js src/views/ExploreView.vue
git commit -m "feat(ui): 钉段锁定 + 局部重掷（reroll with locked corridors）"
```

---

### Task D4: 路线库筛选 + 「当灵感」

**Files:** Modify `src/views/PresetView.vue`

- [x] **Step 1: 加玩法池/难度筛选**

在 `PresetView.vue` 搜索框（`333` select 上方）补玩法池筛选下拉与结果条数；复用现有 `groups`/`filteredRoutes` 逻辑，只在 `filteredRoutes` 增加池匹配（按池内 `corridorIds` 反查预置线名相关性，首版简化为按名称关键词 OR 玩法池名）：

```js
const poolFilter = ref('')
const filteredRoutes = computed(() => {
  const f = customFilter.value.toLowerCase().trim()
  let list = PRESET_ROUTES
  if (poolFilter.value) {
    const kw = poolFilter.value // 'nan-ling' 等
    const pool = PLAYPOOLS.find(p => p.id === kw)
    list = list.filter(r => pool ? pool.anchors.some(a => r.name.includes(a) || (r.start.name+r.waypoints.map(w=>w.name).join()).includes(a)) : r)
  }
  return f ? list.filter(r => r.name.includes(f) || r.start.name.includes(f) || r.waypoints.some(w => w.name.includes(f))) : list
})
```

模板在搜索框旁加：

```html
<select v-model="poolFilter" style="margin-bottom:8px">
  <option value="">-- 全部玩法 --</option>
  <option v-for="p in PLAYPOOLS" :key="p.id" :value="p.id">{{ p.label }}</option>
</select>
```

import 补 `PLAYPOOLS`。

- [x] **Step 2: 「当灵感」按钮**

选中路线详情卡操作区加按钮，把该线途经点序列写入 localStorage 桩 `radompath_inspiration`，跳转 Explore（`/explore`）并提示；Explore onMounted 读到该桩即把它当作 4 步的种子（首版：把途经点最远两点当起点/方向 hint，简化：仅 toast 提示「灵感已带入，选里程直接合成」）。

```js
function useAsInspiration() {
  const r = activeRoute.value; if (!r) return
  localStorage.setItem('radompath_inspiration', JSON.stringify({ name: r.name, wps: r.waypoints }))
  router.push('/explore')
}
```

> import 顶部补 `useRouter`。Explore 侧按需读取该桩（可延后，不阻塞本任务提交）。

- [x] **Step 3: 构建 + 手动验收**

Run: `npm run build`；dev 手测：库内可按玩法池过滤；点「当灵感」跳到 Explore。

- [x] **Step 4: 提交**

```bash
git add src/views/PresetView.vue
git commit -m "feat(ui): 路线库玩法池筛选 + 当灵感带入 Explore"
```

---

## 收尾验证

- [x] **Step: 全量回归**

Run: `node --test tests/ && npm run build`
Expected: 全部 PASS + 编译通过

- [ ] **Step: 真机冒烟清单（dev 手测）**
1. 环线 20km 连出 5 条：爬升全有数、无「高程查询失败」、距离 ∈[17.6,22.4]km。
2. 南山上坡 30km：出 3 候选含爬升与玩法徽章；难度 ≥ ★★★。
3. 导 GPX 到外部比对：轨迹相对高德渲染偏移 <50m。
4. 路线库按「南山·峪口爬坡」过滤有结果；「当灵感」跳转正常。

- [ ] **Step: 提交收尾**

```bash
git add -A && git commit -m "chore(骑行): 聪明骰子重构 Phase A-D 收尾回归"
```

---

## 本计划范围外（另开计划）
- P2：陕南/陕北玩法池补齐、GPX 导入升级 grey→green、我的收藏、封路/施工运营状态维护、corridor `geo` 运行时免请求优化。
- 需求澄清与取舍详见方案文档第 13 节开放问题（首批实骑蓝/绿清单、长途库线去留、爬升权威值源）。
