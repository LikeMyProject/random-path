// scripts/build-corridors.mjs
// 离线切片：预置线途经点对 → 高德骑行规划 → 廊道记录 + 避让筛查 + 信任降级
// 用法: node scripts/build-corridors.mjs [--key=xxx] [--limit=200] [--fixtures]
//   --fixtures  不联网，用内置假 polyline 走通全流程（离线自检管线）
import { writeFile } from 'node:fs/promises'
import { PRESET_ROUTES } from '../src/data/presetRoutes.js'
import { CORRIDORS } from '../src/data/corridors.js'

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
})

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
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const auto = []
let skipped = 0, tooShort = 0, tooLong = 0
const seen = new Set()

for (const route of PRESET_ROUTES) {
  if (auto.length + skipped + tooShort + tooLong >= LIMIT) break
  const pts = [route.start, ...route.waypoints, route.end]
  for (let i = 0; i < pts.length - 1; i++) {
    if (auto.length + skipped + tooShort + tooLong >= LIMIT) break
    const a = pts[i], b = pts[i + 1]
    if (!a?.lng || !b?.lng) continue
    // 起点终点同名同点直接跳过：预置数据里存在「浐灞」与「世博园」坐标完全相同的坑
    const key = `${a.name}->${b.name}`
    if (straightKm(a, b) < MIN_KM) { tooShort++; continue }
    if (seen.has(key)) continue
    seen.add(key)
    try {
      const r = await planOne(a, b)
      if ((r.distance || 0) > 40000) { tooLong++; continue }
      auto.push({
        id: `auto-${route.name}-${i}`,
        name: `${a.name || ''}→${b.name || ''}`,
        region: route.name.slice(0, 3),
        type: 'countyRoad', surface: 'paved', climbBand: 'unknown',
        playpool: [],
        distKm: Math.round((r.distance || 0) / 100) / 10,
        climbM: null,
        start: { name: a.name, lng: a.lng, lat: a.lat },
        end: { name: b.name, lng: b.lng, lat: b.lat },
        trust: BAD_RE.test((a.name || '') + (b.name || '')) ? 'yellow' : 'grey',
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
  `生成 ${auto.length} 条自动廊道；跳过：过短 ${tooShort} / 超40km ${tooLong} / 规划失败 ${skipped}` +
  `；总库 ${CORRIDORS.length + auto.length} 条${args.fixtures ? '（fixtures 离线模式）' : ''}`
)
