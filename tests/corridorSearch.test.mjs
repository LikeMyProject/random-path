// tests/corridorSearch.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomChain, reversePolyline, minBridgeKm, planChainPath } from '../src/composables/corridorSearch.js'

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
