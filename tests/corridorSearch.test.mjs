// tests/corridorSearch.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomChain, reversePolyline, minBridgeKm, planChainPath, rankAnchors } from '../src/composables/corridorSearch.js'

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

test('randomChain: 里程感知——接近目标即停，不盲目串满 maxDepth', () => {
  const chain = randomChain(CORR, { startId: 'c0', maxDepth: 4, maxBridgeKm: 12, targetKm: 8, rng: () => 0.5 })
  const sum = chain.reduce((s, id) => s + CORR.find(c => c.id === id).distKm, 0)
  assert.ok(sum <= 8 * 1.3, `链总里程 ${sum}km 超过目标 8km 的 1.3 倍`)
  assert.ok(chain.length >= 1 && chain.length <= 4)
})

test('randomChain: 排除已用(locked)廊道', () => {
  const chain = randomChain(CORR, { startId: 'c1', usedIds: ['c2'], maxDepth: 5, maxBridgeKm: 12, rng: () => 0.5 })
  assert.ok(!chain.includes('c2'))
})

test('randomChain: startId 不存在时返回空链', () => {
  assert.deepEqual(randomChain(CORR, { startId: 'nope', rng: () => 0.5 }), [])
})

test('randomChain: 无可桥接下一段时只返回起点', () => {
  const isolated = [{ id: 'x', distKm: 1, start: { lng: 100, lat: 30 }, end: { lng: 100.01, lat: 30 } }]
  assert.deepEqual(randomChain(isolated, { startId: 'x', maxBridgeKm: 1, rng: () => 0.5 }), ['x'])
})

test('minBridgeKm: 取两端点最近距离且对称', () => {
  const a = CORR[0], b = CORR[3]
  assert.ok(Math.abs(minBridgeKm(a, b) - minBridgeKm(b, a)) < 1e-9)
  assert.equal(minBridgeKm(a, a), 0)
})

test('reversePolyline: 整串倒序', () => {
  assert.equal(reversePolyline('108.00,34.00;108.01,34.01;108.02,34.02'), '108.02,34.02;108.01,34.01;108.00,34.00')
  assert.equal(reversePolyline('108.00,34.00'), '108.00,34.00')
  assert.equal(reversePolyline(''), '')
})

test('planChainPath: 从近端进、另一端出；近端为 end 时标记反向', () => {
  const byId = Object.fromEntries(CORR.map(c => [c.id, c]))
  // 从 c0 起点侧进入：应正向穿越
  const fwd = planChainPath(byId, ['c0', 'c1'], { lng: 108, lat: 34 })
  assert.deepEqual(fwd.map(s => s.id), ['c0', 'c1'])
  assert.equal(fwd[0].reversed, false)
  assert.deepEqual(fwd[0].entry, CORR[0].start)
  assert.deepEqual(fwd[0].exit, CORR[0].end)
  // 第二段入口应接在第一段出口上
  assert.deepEqual(fwd[1].entry, CORR[1].start)

  // 从 c0 终点侧进入：应反向穿越（entry=end, exit=start）
  const rev = planChainPath(byId, ['c0'], { lng: 108.05, lat: 34 })
  assert.equal(rev[0].reversed, true)
  assert.deepEqual(rev[0].entry, CORR[0].end)
  assert.deepEqual(rev[0].exit, CORR[0].start)
})

test('planChainPath: 忽略链中不存在的 id', () => {
  const byId = Object.fromEntries(CORR.map(c => [c.id, c]))
  assert.deepEqual(planChainPath(byId, ['c0', 'ghost'], { lng: 108, lat: 34 }).map(s => s.id), ['c0'])
})

// rankAnchors：家周边可起链的廊道，按「预测总程贴近目标」排序
// 回归背景：旧实现固定一个锚点跑满 10 次尝试，锚点自身里程撑爆里程带时（拿 33km 大廊道
// 去凑 20km 往返）10 次全废、必然 MISS 走经典兜底。
const HOME = { lng: 108, lat: 34 }
const ENV = [
  { id: 'big', distKm: 33, start: { lng: 108.001, lat: 34 }, end: { lng: 108.3, lat: 34.2 } },   // 起点贴家，但太長
  { id: 'small', distKm: 4, start: { lng: 108.001, lat: 34.01 }, end: { lng: 108.04, lat: 34.03 } },
  { id: 'far', distKm: 6, start: { lng: 108.6, lat: 34 }, end: { lng: 108.7, lat: 34 } },        // 离家 50km+
]

test('rankAnchors: 滤掉超出引道上限(18km)的廊道', () => {
  const got = rankAnchors(HOME, ENV, { distKm: 20, shape: 'outback' })
  // far 离家 50km+ 被引道上限剔除；big 单段往返 66km 远超 20 目标被几何剔除 → 只剩 small
  assert.deepEqual(got.map(x => x.c.id), ['small'])
})

test('rankAnchors: 大段单程往返已远超目标时被几何剔除（不再盲试浪费次数）', () => {
  const got = rankAnchors(HOME, ENV, { distKm: 20, shape: 'outback' })
  assert.ok(!got.some(x => x.c.id === 'big'), '33km 段凑 20km 往返必然超带，应被剔除')
  assert.ok(got.some(x => x.c.id === 'small'))
})

test('rankAnchors: 结果按与目标的偏差升序', () => {
  const got = rankAnchors(HOME, ENV, { distKm: 30, shape: 'outback' })
  for (let i = 1; i < got.length; i++) assert.ok(got[i - 1].gap <= got[i].gap)
})

test('rankAnchors: 环线与往返的排序口径不同（环线不折返故总程更短）', () => {
  const out = rankAnchors(HOME, ENV, { distKm: 20, shape: 'outback' })
  const loop = rankAnchors(HOME, ENV, { distKm: 20, shape: 'loop' })
  const smallOut = out.find(x => x.c.id === 'small'), smallLoop = loop.find(x => x.c.id === 'small')
  assert.ok(smallOut && smallLoop)
  assert.ok(smallLoop.predict < smallOut.predict, '环线不折返，预测总程应小于往返')
})

test('rankAnchors: 周边无廊道时返回空数组', () => {
  assert.deepEqual(rankAnchors({ lng: 120, lat: 40 }, ENV, { distKm: 20 }), [])
  assert.deepEqual(rankAnchors(HOME, [], { distKm: 20 }), [])
})
