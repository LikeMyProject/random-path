import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gcj02ToWgs84, wgs84ToGcj02 } from '../src/utils/geo.js'

test('round-trip gcj→wgs→gcj ~identity', () => {
  const g = { lng: 108.9484, lat: 34.3416 } // 西安钟楼 GCJ-02
  const w = gcj02ToWgs84(g.lng, g.lat)
  const g2 = wgs84ToGcj02(w.lng, w.lat)
  // 一步反解（直接减 delta）的固有近似误差：全国实测 ~1e-6~1.5e-5 度。
  // 5e-5 度 ≈ 4~5m，仍远小于真实偏移（数百米量级），保证逆变换语义。
  assert.ok(Math.abs(g2.lng - g.lng) < 5e-5)
  assert.ok(Math.abs(g2.lat - g.lat) < 5e-5)
})
test('wgs offset is a few hundred meters, not zero', () => {
  const g = { lng: 108.9484, lat: 34.3416 }
  const w = gcj02ToWgs84(g.lng, g.lat)
  const dLngDeg = Math.abs(w.lng - g.lng)
  assert.ok(dLngDeg > 0.0015 && dLngDeg < 0.01) // ~150m~1km
  const dLatDeg = Math.abs(w.lat - g.lat)
  assert.ok(dLatDeg > 0.0015 && dLatDeg < 0.01) // 西安钟楼 lat 偏移约 0.00154°（~170m），同数百米量级
})
test('out-of-China coordinates unchanged', () => {
  const r = gcj02ToWgs84(2.35, 48.86) // 巴黎
  assert.equal(r.lng, 2.35); assert.equal(r.lat, 48.86)
})
