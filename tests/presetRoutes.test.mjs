import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESET_ROUTES } from '../src/data/presetRoutes.js'
test('preset routes are structurally valid', () => {
  assert.equal(PRESET_ROUTES.length, 100)
  for (const r of PRESET_ROUTES) {
    assert.ok(r.name && r.start?.lng && r.start?.lat && r.end?.lng && r.end?.lat)
    for (const w of r.waypoints) assert.ok(w.name && typeof w.lng === 'number' && typeof w.lat === 'number')
  }
})
test('preset start/end coords are in-bounds numbers', () => {
  for (const r of PRESET_ROUTES) {
    for (const p of [r.start, r.end]) {
      assert.equal(typeof p.lng, 'number')
      assert.equal(typeof p.lat, 'number')
      assert.ok(p.lng >= -180 && p.lng <= 180, `lng out of range: ${r.name} ${p.lng}`)
      assert.ok(p.lat >= -90 && p.lat <= 90, `lat out of range: ${r.name} ${p.lat}`)
    }
  }
})
test('preset route names are unique', () => {
  assert.equal(new Set(PRESET_ROUTES.map(r => r.name)).size, PRESET_ROUTES.length)
})
