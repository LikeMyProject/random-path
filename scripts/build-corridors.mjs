// scripts/build-corridors.mjs
// 离线切片：预置线途经点对 → 高德骑行规划 → 廊道记录 + 避让筛查 + 信任降级
// 用法: node scripts/build-corridors.mjs [--key=xxx] [--limit=200] [--fixtures]
//   --fixtures  不联网，用内置假 polyline 走通全流程（离线自检管线）
import { writeFile } from 'node:fs/promises'
import { PRESET_ROUTES } from '../src/data/presetRoutes.js'
import { CORRIDORS } from '../src/data/corridors.js'
import { PLAYPOOLS } from '../src/data/playpools.js'

// 注意：无值开关（--fixtures）必须显式置 true，否则 a.split('=') 会给出 undefined，
// `if (args.fixtures)` 永远为假，离线模式形同虚设。
const args = {}
for (const raw of process.argv.slice(2)) {
  const [k, v] = raw.replace(/^--/, '').split('=')
  args[k] = v === undefined ? true : v
}
const KEY = args.key || process.env.VITE_AMAP_KEY || ''
const LIMIT = parseInt(args.limit || '200', 10)
const BAD_RE = /高速|高架|隧道|快速路|城市快速|匝道|立交桥|禁行/
const MIN_KM = 0.5 // 低于此长度的段丢弃：预置数据 3 位小数精度会让相邻点重合（如浐灞=世博园），零长度廊道会让桥接距离恒为 0

function haversineKm(a, b) {
  const toRad = x => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}
const straightKm = (a, b) => haversineKm(a, b)
const FIXTURE = (a, b) => ({
  distance: Math.round(straightKm(a, b) * 1000 * 1.2), // 假规划：直线×1.2 当骑行里程
  polyline: `${a.lng},${a.lat};${b.lng},${b.lat}`,
  duration: 0,
  roads: '',
})

// 玩法池归属：与 PresetView 过滤口径一致——端点名/线名含玩法池锚点关键词即归入（可多归）
function inferPools(text) {
  const ids = []
  for (const p of PLAYPOOLS) {
    if ((p.anchors || []).some(a => text.includes(a))) ids.push(p.id)
  }
  return ids
}

// 锚点坐标表：池的 anchors 只有地名、没有坐标，光靠名字关键词匹配会漏掉大半自动段
// （实测 117 条里仅 18 条归上池）。故从预设线途经点 + 手编廊道端点反查「锚点名 → 坐标」。
const ANCHOR_POINTS = []
for (const r of PRESET_ROUTES) for (const p of [r.start, ...(r.waypoints || []), r.end]) if (p?.name && p.lng) ANCHOR_POINTS.push(p)
for (const c of CORRIDORS) for (const p of [c.start, c.end]) if (p?.name && p.lng) ANCHOR_POINTS.push(p)
const POOL_ANCHOR_COORDS = PLAYPOOLS.map(p => ({
  id: p.id,
  pts: ANCHOR_POINTS.filter(pt => (p.anchors || []).some(a => pt.name.includes(a) || a.includes(pt.name))),
}))
const MAX_POOL_KM = 14 // 段中点离池锚点超过此距离，则不归入该池

// 几何归池：段中点离哪个池的锚点最近就归哪个池（受半径约束，可多归）
function inferPoolsGeo(mid) {
  const scored = []
  for (const pa of POOL_ANCHOR_COORDS) {
    if (!pa.pts.length) continue
    scored.push({ id: pa.id, d: Math.min(...pa.pts.map(pt => haversineKm(mid, pt))) })
  }
  return scored.sort((a, b) => a.d - b.d).filter(x => x.d <= MAX_POOL_KM).map(x => x.id)
}
// 坡度档：优先取所属玩法池的 defaultBand，否则按地名先验粗判
// 取值与手编库一致：flat|rolling|hill|mountainous（unknown 留给完全无先验的段）
function inferBand(text, pools) {
  for (const id of pools) {
    const p = PLAYPOOLS.find(x => x.id === id)
    if (p?.defaultBand) return p.defaultBand
  }
  // 顺序要紧：先认绿道/河堤类（「三河一山绿道」也会被 /山/ 命中，但它是平绿道）
  if (/绿道|河堤|驿|大道|湖/.test(text)) return 'rolling'
  if (/峪|岭|塬|分水岭/.test(text)) return 'hill'
  return 'rolling'
}

async function planOne(a, b) {
  if (args.fixtures) return FIXTURE(a, b)
  const url = `https://restapi.amap.com/v5/direction/bicycling?origin=${a.lng},${a.lat}&destination=${b.lng},${b.lat}&key=${KEY}&show_fields=polyline`
  const res = await fetch(url)
  const j = await res.json()
  if (j.status !== '1') throw new Error(j.info || 'API error')
  const p = j.route?.paths?.[0]
  if (!p) throw new Error('no route')
  return {
    distance: parseInt(p.distance),
    polyline: (p.steps || []).map(s => s.polyline).filter(Boolean).join(';'),
    duration: parseInt(p.duration),
    // 真实途经道路名 + 导航指令：避让筛查要看实际骑了哪条路，而不是只看端点叫什么
    roads: (p.steps || []).map(s => `${s.road_name || ''} ${s.instruction || ''}`).join(' '),
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
// 本项目只做陕西/关中：预设线里含省外长途线（三亚/丽江等），其 OD 对直接不产出
const inShaanxi = p => p.lng > 105 && p.lng < 112 && p.lat > 32 && p.lat < 36

const auto = []
let skipped = 0, tooShort = 0, tooLong = 0, outside = 0
const seen = new Set()

for (const route of PRESET_ROUTES) {
  if (auto.length + skipped + tooShort + tooLong >= LIMIT) break
  const pts = [route.start, ...route.waypoints, route.end]
  for (let i = 0; i < pts.length - 1; i++) {
    if (auto.length + skipped + tooShort + tooLong >= LIMIT) break
    const a = pts[i], b = pts[i + 1]
    if (!a?.lng || !b?.lng) continue
    if (!inShaanxi(a) || !inShaanxi(b)) { outside++; continue }
    // 起点终点同名同点直接跳过：预置数据里存在「浐灞」与「世博园」坐标完全相同的坑
    const key = `${a.name}->${b.name}`
    if (straightKm(a, b) < MIN_KM) { tooShort++; continue }
    if (seen.has(key)) continue
    seen.add(key)
    try {
      const r = await planOne(a, b)
      if ((r.distance || 0) > 40000) { tooLong++; continue }
      const label = `${a.name || ''}→${b.name || ''}`
      const mid = { lng: (a.lng + b.lng) / 2, lat: (a.lat + b.lat) / 2 }
      // 归池：几何（中点就近池锚点）优先，名称关键词兜底，取并集
      const poolIds = [...new Set([...inferPoolsGeo(mid), ...inferPools(label + route.name)])]
      // 避让筛查：优先看真实途经道路名/导航指令，端点名兜底（旧口径只看名字，会漏掉穿高速的段）
      const bad = BAD_RE.test(r.roads || '') || BAD_RE.test((a.name || '') + (b.name || ''))
      auto.push({
        id: `auto-${route.name}-${i}`,
        name: label,
        region: route.name.slice(0, 3),
        type: 'countyRoad', surface: 'paved',
        climbBand: inferBand(label + route.name, poolIds),
        playpool: poolIds,
        distKm: Math.round((r.distance || 0) / 100) / 10,
        climbM: null,
        start: { name: a.name, lng: a.lng, lat: a.lat },
        end: { name: b.name, lng: b.lng, lat: b.lat },
        // 信任口径（2026-09-08 定）：来源为人工整理预设线、且名称未命中避让词 → yellow「待核实」；
        // 命中高速/隧道/匝道等避让词 → grey「自动待实测」；爬升/几何实测后按 P2 升级到 green/blue。
        trust: bad ? 'grey' : 'yellow',
        src: `preset:${route.name}`, status: 'open',
      })
    } catch {
      skipped++
    }
    await sleep(args.fixtures ? 0 : 220)
  }
}

const outPath = new URL('../src/data/corridors.auto.json', import.meta.url)
await writeFile(outPath, JSON.stringify(auto, null, 2) + '\n')
console.log(
  `生成 ${auto.length} 条自动廊道；跳过：过短 ${tooShort} / 超40km ${tooLong} / 省外 ${outside} / 规划失败 ${skipped}` +
  `；总库 ${CORRIDORS.length + auto.length} 条${args.fixtures ? '（fixtures 离线模式）' : ''}`
)
