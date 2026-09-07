// tests/corridors.test.mjs —— 廊道账本结构与坐标可信校验
// 背景：首批手工廊道曾出现 start/end 坐标完全相同（浐灞 109.06,34.32 = 世博园），
// 会让 minBridgeKm 桥接恒为 0、且高德同点规划请求报错。此测试固化护栏。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CORRIDORS } from '../src/data/corridors.js'
import { PLAYPOOLS } from '../src/data/playpools.js'

const TRUSTS = ['grey', 'yellow', 'green', 'blue']
const BANDS = ['flat', 'rolling', 'hill', 'mountainous']
const REQUIRED = ['id', 'name', 'region', 'type', 'surface', 'climbBand', 'playpool', 'distKm', 'climbM', 'trust', 'src', 'status', 'start', 'end']
// 自动段（build-corridors 产物，id 前缀 auto-）schema 宽松：climbBand 待实测、playpool/climbM 未归类
const isAuto = c => c.id.startsWith('auto-')

function haversineM(a, b) {
  const toRad = x => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(h))
}
const inShaanxi = p => p.lng > 105 && p.lng < 112 && p.lat > 32 && p.lat < 36

test('廊道字段完整、取值合法', () => {
  assert.ok(CORRIDORS.length > 0, '廊道不应为空')
  for (const c of CORRIDORS) {
    for (const k of REQUIRED) assert.ok(c[k] !== undefined && c[k] !== null, `${c.id} 缺字段 ${k}`)
    assert.ok(TRUSTS.includes(c.trust), `${c.id} trust 非法: ${c.trust}`)
    assert.ok(BANDS.includes(c.climbBand) || (isAuto(c) && c.climbBand === 'unknown'), `${c.id} climbBand 非法: ${c.climbBand}`)
    assert.ok(c.distKm > 0, `${c.id} distKm 必须为正`)
    assert.ok(c.climbM >= 0 || (isAuto(c) && c.climbM === null), `${c.id} climbM 不能为负`)
    assert.equal(c.status, 'open', `${c.id} status 应为 open`)
  }
})

test('廊道 id 唯一', () => {
  const ids = CORRIDORS.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length, `存在重复 id: ${ids.filter((v, i) => ids.indexOf(v) !== i)}`)
})

test('起终点在陕西境内且互不重合', () => {
  for (const c of CORRIDORS) {
    assert.ok(inShaanxi(c.start), `${c.id} start 越界: ${c.start.lng},${c.start.lat}`)
    assert.ok(inShaanxi(c.end), `${c.id} end 越界: ${c.end.lng},${c.end.lat}`)
    const d = haversineM(c.start, c.end)
    assert.ok(d > 500, `${c.id} 起终点仅相距 ${Math.round(d)}m，零长度廊道会让桥接/规划失效`)
  }
})

test('playpool 引用的玩法池必须存在（手工段必填）', () => {
  const poolIds = new Set(PLAYPOOLS.map(p => p.id))
  for (const c of CORRIDORS) {
    if (isAuto(c)) continue // 自动段尚未归类到玩法池
    assert.ok(Array.isArray(c.playpool) && c.playpool.length > 0, `${c.id} playpool 不能为空`)
    for (const pid of c.playpool) assert.ok(poolIds.has(pid), `${c.id} 引用了不存在的玩法池 ${pid}`)
  }
})

test('合并入口：手工条目 + 自动库共同构成 CORRIDORS', async () => {
  const auto = (await import('../src/data/corridors.auto.json', { with: { type: 'json' } })).default
  assert.ok(Array.isArray(auto), 'corridors.auto.json 必须是数组（空占位为 []）')
  const manualCount = CORRIDORS.length - auto.length
  assert.equal(manualCount, 8, `手工精编首批应保持 8 条，实际 ${manualCount}`)
})
