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
  assert.equal((xml.match(/<trkpt /g) || []).length, 3)
})
test('GPX escapes XML metacharacters in place names', () => {
  const xml = buildGpxTrk([{ polyline: '108.9484,34.3416' }], '甲&乙', '单位"南', 30000)
  assert.ok(xml.includes('<name>甲&amp;乙 → 单位&quot;南 (30.0km)</name>'))
})
