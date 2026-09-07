// tests/corridorData.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexCorridors, snapNode, filterEnvelope, TRUST_RANK } from '../src/composables/corridorData.js'
import { CORRIDORS } from '../src/data/corridors.js'

test('index builds byId & byPool and snap finds corridor by endpoint', () => {
  const ix = indexCorridors(CORRIDORS)
  assert.ok(ix.byId['nl-fengyu-fenshuiling'])
  assert.ok(ix.byPool['nan-ling'].length >= 3)
  // 端点节点应覆盖每条廊道的起终点
  assert.equal(ix.nodes.length, CORRIDORS.length * 2)
})

test('trust rank ordering grey<yellow<green<blue', () => {
  assert.ok(TRUST_RANK.grey < TRUST_RANK.yellow)
  assert.ok(TRUST_RANK.yellow < TRUST_RANK.green)
  assert.ok(TRUST_RANK.green < TRUST_RANK.blue)
})

test('filterEnvelope keeps only pool + minTrust + climbBand', () => {
  const got = filterEnvelope(CORRIDORS, { pools: ['nan-ling'], minTrust: 'green', band: 'hill' })
  assert.ok(got.length > 0, '信封不应为空')
  assert.ok(got.every(c => c.playpool.includes('nan-ling') && TRUST_RANK[c.trust] >= TRUST_RANK.green && c.climbBand === 'hill'))
})

test('snapNode 端点吸附：容差内命中、容差外返回 null', () => {
  const ix = indexCorridors(CORRIDORS)
  const c = ix.byId['nl-fengyu-fenshuiling']
  const hit = snapNode({ lng: c.start.lng + 0.0002, lat: c.start.lat + 0.0002 }, ix.nodes) // 约 30m
  assert.ok(hit, '容差内应吸附到端点')
  assert.equal(hit.corridorId, c.id)
  const miss = snapNode({ lng: c.start.lng + 1, lat: c.start.lat + 1 }, ix.nodes) // 约 100km 外
  assert.equal(miss, null, '超出容差应返回 null')
})
