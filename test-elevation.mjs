import { chromium } from 'playwright'

const URL = 'http://localhost:5173'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

const errors = [], allLogs = []
page.on('console', msg => {
  const txt = msg.text()
  allLogs.push(`[${msg.type()}] ${txt}`)
  if (msg.type() === 'error') errors.push(txt)
  if (/Elevation|elevation|slope|坡度/.test(txt))
    console.log('  CONSOLE:', msg.type(), txt)
})
page.on('pageerror', err => { console.log('  PAGE ERROR:', err.message); errors.push(err.message) })

console.log('1. Opening page...')
await page.goto(URL + '#/commute', { waitUntil: 'domcontentloaded', timeout: 30000 })
console.log('2. Title:', await page.title())

console.log('3. Waiting for AMap SDK (up to 15s)...')
try {
  await page.waitForFunction(() => typeof window.AMap !== 'undefined', { timeout: 15000 })
  console.log('4. AMap SDK loaded!')
  const hasEl = await page.evaluate(() => typeof window.AMap.Elevation !== 'undefined')
  console.log('5. AMap.Elevation:', hasEl)
  if (hasEl) {
    console.log('6. Testing elevation...')
    const r = await page.evaluate(async () => {
      try {
        await new Promise((res) => { window.AMap.plugin('AMap.Elevation', res, { retry: 3 }) })
        const result = await new Promise((res) => {
          new window.AMap.Elevation().getElevation([[108.948, 34.261]], (s, d) => {
            res(JSON.stringify({ status: s, count: d?.length, first: d?.[0] }))
          })
        })
        return result
      } catch(e) { return 'ERROR: ' + e.message }
    })
    console.log('7. Test result:', r)
  }
} catch(e) {
  console.log('4. AMap SDK NOT loaded within 15s')
}

console.log('8. JS errors:', errors.length)
if (errors.length > 0) console.log('   First errors:', errors.slice(0, 10).join(' | '))

const relevant = allLogs.filter(l => /elevation|slope|AMap|Elevation|高程/i.test(l))
if (relevant.length > 0) { console.log('9. Relevant logs:'); relevant.forEach(l => console.log('   ', l)) }

await browser.close()
console.log('Done.')
