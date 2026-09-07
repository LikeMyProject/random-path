import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchOpenMeteo, chainElevation, toWgsSamples } from '../src/composables/elevation.js'

test('fetchOpenMeteo converts GCJ→WGS and parses elevation array', async () => {
  const calls = []
  const fakeFetch = async (url) => {
    calls.push(url)
    assert.ok(url.startsWith('https://api.open-meteo.com/v1/elevation'))
    const u = new URL(url)
    const lat0 = u.searchParams.get('latitude').split(',')[0]
    const lng0 = u.searchParams.get('longitude').split(',')[0]
    // 首点 GCJ(108.9484,34.3416) → WGS 应偏离：经度约 -0.0047°、纬度约 +0.0015°
    // 断言用绝对值（不赖方向），只锁「确实发生过转换」。
    assert.ok(Math.abs(parseFloat(lng0) - 108.9484) > 0.001)
    assert.ok(Math.abs(parseFloat(lat0) - 34.3416) > 0.0005)
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
test('provider that throws is skipped', async () => {
  const boom = async () => { throw new Error('boom') }
  const good = async () => [1, 2]
  assert.deepEqual(await chainElevation([1], [boom, good]), [1, 2])
})
test('fetchOpenMeteo returns null on http !ok', async () => {
  const fakeFetch = async () => ({ ok: false })
  assert.equal(await fetchOpenMeteo([{ lng: 108.95, lat: 34.3 }], { fetchImpl: fakeFetch }), null)
})
test('fetchOpenMeteo returns null when body lacks elevation array', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ foo: 1 }) })
  assert.equal(await fetchOpenMeteo([{ lng: 108.95, lat: 34.3 }], { fetchImpl: fakeFetch }), null)
})
test('toWgsSamples dedupes and handles empty', () => {
  assert.equal(toWgsSamples([]).length, 0)
  // 两点 GCJ 差 1e-6°（非完全同点），转换后落入同一 WGS 5 位网格 → 合并为 1。
  // 注：原评审给 1e-5° 差的两点实测会落相邻网格（108.94372 vs .94373），不去重，故收窄到 1e-6°。
  const dup = toWgsSamples([{ lng: 108.9484, lat: 34.3416 }, { lng: 108.948401, lat: 34.341601 }])
  assert.equal(dup.length, 1)
})
