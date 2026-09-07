import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateDifficulty } from '../src/composables/useScoring.js'
test('30km with 1500m climb is extreme (ratio=50)', () => {
  const d = rateDifficulty(30000, 1500)
  assert.equal(d.label, '★★★★★ 极限')
})
test('40km flat with 0 climb is advanced (km=40 → km≥25 档)', () => {
  const d = rateDifficulty(40000, 0)
  assert.equal(d.label, '★★ 进阶')
})
test('30km with 300m climb is moderate (ratio=10, not >10 → ratio>6 档)', () => {
  const d = rateDifficulty(30000, 300)
  assert.equal(d.label, '★★★ 中等')
})
test('60km with 240m climb is moderate (km=60≥50 先命中；ratio=4 只够进阶档、够不到困难)', () => {
  const d = rateDifficulty(60000, 240)
  assert.equal(d.label, '★★★ 中等')
})
test('20km with 40m climb is casual (km=20 <25, ratio=2 → ★ 休闲)', () => {
  const d = rateDifficulty(20000, 40)
  assert.equal(d.label, '★ 休闲')
})
