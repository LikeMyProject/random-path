// ============================================================
// 旅行攻略引擎 useTravel.js
// 核心能力：
//   1. allocateDays        多城市天数分配（城市权重 + 转换日）
//   2. clusterAttractions  景点地理聚类编排（每天一组，地理相近）
//   3. buildItinerary      生成每日行程（上午/下午/晚上时段）
//   4. buildFullPlan       主入口：完整攻略（行程+交通+天气+预算）
//   5. estimateBudget      分项预算估算
//   6. buildTextGuide      导出文本攻略（markdown）
// ============================================================
import { CITIES, getCity, getTransport } from '../data/cities.js'
import { searchPOIsByText, searchRestaurantsForCity, searchLocalSpotsForCity, searchSpotsForCity, SPOT_EXT } from './useAMap.js'

const PACE_ATTRACTIONS = { relax: 2, standard: 3, compact: 4 }
export { PACE_ATTRACTIONS }
const PACE_LABEL = { relax: '悠闲', standard: '标准', compact: '紧凑' }
const INTEREST_LABEL = { nature: '自然风光', culture: '人文历史', food: '美食探店', family: '亲子休闲', urban: '城市地标' }

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function fmtShort(d) { return `${d.getMonth() + 1}月${d.getDate()}日` }
function weekday(d) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()] }

function haversineKm(a, b) {
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// 同天景点地理半径上限（km）：一天内景点最远不超过此值，超过则视为跨区域拆到不同天
const MAX_CLUSTER_RADIUS = 50
// 种子选择时，每远离已有种子 1km 的加分权重（让远郊景点自成一天，不与主城景点混排）
const SEED_SPREAD_W = 0.8
// 餐厅就近窗口（km）：只取离当天任一景点 10km 内的餐厅，距离越近优先级越高
const RESTAURANT_MAX_KM = 10

// ============================================================
// 1. 天数分配：按城市建议天数权重，每城至少 1 天，转换日占用
// ============================================================
export function allocateDays(cityNames, totalDays, pace = 'standard') {
  const n = cityNames.length
  const transitDays = Math.max(0, n - 1)
  let playable = totalDays - transitDays
  if (playable < n) playable = n // 天数不足时每城 1 天兜底

  const weights = cityNames.map(c => getCity(c)?.days || 2)
  const totalW = weights.reduce((a, b) => a + b, 0)

  let per = cityNames.map((c, i) => Math.max(1, Math.round(playable * weights[i] / totalW)))
  // 修正：总和 > playable 时从权重最小的开始扣
  let sum = per.reduce((a, b) => a + b, 0)
  while (sum > playable) {
    let minIdx = 0
    for (let i = 1; i < per.length; i++) if (per[i] < per[minIdx]) minIdx = i
    if (per[minIdx] <= 1) break
    per[minIdx]--
    sum = per.reduce((a, b) => a + b, 0)
  }
  // 修正：总和 < playable 时加到权重最大的城市
  let guard = 0
  while (sum < playable && guard++ < 10) {
    let maxIdx = 0
    for (let i = 1; i < per.length; i++) if (weights[i] > weights[maxIdx] || (weights[i] === weights[maxIdx] && per[i] < per[maxIdx])) maxIdx = i
    per[maxIdx]++
    sum = per.reduce((a, b) => a + b, 0)
  }

  return { perCity: per, transitDays, playableDays: playable }
}

// 最佳季节 -> 对应月份，用于判断用户所选月份是否为该城最佳出行时间
const SEASON_MONTHS = { '春': [3, 4, 5], '夏': [6, 7, 8], '秋': [9, 10, 11], '冬': [12, 1, 2] }
function seasonFit(bestSeason, month) {
  const s = (bestSeason || '').trim()
  if (!s || s.includes('全年')) return 'best'
  for (const k of ['春', '夏', '秋', '冬']) {
    if (s.includes(k) && SEASON_MONTHS[k].includes(month)) return 'best'
  }
  return 'off'
}

// 城市推荐天数 + 时间理由：根据景点数量/类型与最佳季节，给出「建议几天 + 为什么」
// month 可选（1-12）：传入时会结合用户所选月份提示是否正值最佳季节
export function cityDayAdvice(cityName, month = null) {
  const c = getCity(cityName)
  if (!c) return { days: 2, reason: '暂无数据', bestSeason: '', seasonFit: 'best' }
  const days = c.days || 2
  const attrs = c.attractions || []
  const mustGo = attrs.filter(a => (a.mustSee || 0) >= 4).length
  const nature = attrs.filter(a => a.type === 'nature').length
  // 行程节奏说明（为什么是这几天）
  let rhythm
  if (days <= 1) rhythm = '核心地标集中，1 天即可打卡完毕'
  else if (days === 2) rhythm = `必去 ${mustGo} 处 + 自然 ${nature} 处，2 天刚好：1 天市区人文、1 天近郊休闲`
  else if (days === 3) rhythm = `必去 ${mustGo} 处分散在人文与自然，${days} 天可从容逛完市区并留 1 天周边游`
  else rhythm = `必去景点多达 ${mustGo} 处，${days} 天才不赶：前 ${days - 1} 天市区人文+都市，末 1 天近郊自然`
  // 季节（时间理由）
  const fit = month ? seasonFit(c.bestSeason, month) : 'best'
  let seasonNote = ''
  if (c.bestSeason) {
    if (month) {
      seasonNote = fit === 'best'
        ? `；你选的 ${month} 月正值最佳季节「${c.bestSeason}」，天气与景色都最宜出行`
        : `；注意：你选的 ${month} 月并非最佳季节「${c.bestSeason}」，可能偏冷/偏热或游客较少`
    } else {
      seasonNote = `；最佳季节「${c.bestSeason}」`
    }
  }
  return { days, reason: rhythm + seasonNote, bestSeason: c.bestSeason || '', seasonFit: fit }
}

// ============================================================
// 2. 景点地理聚类：贪心种子 + 最近中心分配，再平衡
// ============================================================
export function clusterAttractions(attractions, days, interests = []) {
  if (attractions.length === 0) return Array.from({ length: days }, () => [])
  if (days <= 1) return [attractions]

  // 兴趣标签过滤优先
  let pool = [...attractions]
  if (interests.length > 0) {
    const matched = pool.filter(a => interests.includes(a.type))
    if (matched.length >= days) pool = matched
  }

  // 按 mustSee 降序 + 兴趣加分
  const score = a => a.mustSee + (interests.includes(a.type) ? 1.5 : 0)
  const sorted = [...pool].sort((a, b) => score(b) - score(a))

  // 种子：第 1 个取最高分；后续种子强烈偏好「远离已有种子」，保证每天地理成片
  const k = Math.min(days, sorted.length)
  const seedIdx = [0]
  for (let s = 1; s < k; s++) {
    let best = -1, bestVal = -Infinity
    for (let i = 0; i < sorted.length; i++) {
      if (seedIdx.includes(i)) continue
      const a = sorted[i]
      let nearest = Infinity
      for (const si of seedIdx) {
        const dd = haversineKm(a.coord, sorted[si].coord)
        if (dd < nearest) nearest = dd
      }
      // 远离已有种子 + 高mustSee 共同决定，远郊景点（如桐庐/建德）会自成种子
      const val = score(a) + SEED_SPREAD_W * nearest
      if (val > bestVal) { bestVal = val; best = i }
    }
    if (best === -1) break
    seedIdx.push(best)
  }
  const clusters = seedIdx.map(i => [sorted[i]])
  const centers = seedIdx.map(i => ({ lng: sorted[i].coord.lng, lat: sorted[i].coord.lat }))

  // 其余景点分配给最近中心
  for (let i = 0; i < sorted.length; i++) {
    if (seedIdx.includes(i)) continue
    const a = sorted[i]
    let best = 0, bd = Infinity
    for (let c = 0; c < centers.length; c++) {
      const d = haversineKm(a.coord, centers[c])
      if (d < bd) { bd = d; best = c }
    }
    clusters[best].push(a)
    // 中心微调（取均值）
    const cl = clusters[best]
    centers[best] = {
      lng: cl.reduce((s, x) => s + x.coord.lng, 0) / cl.length,
      lat: cl.reduce((s, x) => s + x.coord.lat, 0) / cl.length,
    }
  }

  // 平衡：每天上限 ceil(len/k)，超出的低分景点移到「地理最近且未满且在半径内」的簇
  // （半径约束避免把主城景点搬到远郊簇，保证同天景点相邻成片）
  const cap = Math.ceil(sorted.length / k)
  let guard = 0
  while (guard++ < k * 6) {
    let heavy = -1
    for (let i = 0; i < k; i++) if (clusters[i].length > cap) { heavy = i; break }
    if (heavy === -1) break
    let minI = 0
    for (let j = 1; j < clusters[heavy].length; j++) if (score(clusters[heavy][j]) < score(clusters[heavy][minI])) minI = j
    const move = clusters[heavy][minI]
    let bestC = -1, bd = Infinity
    for (let i = 0; i < k; i++) {
      if (i === heavy || clusters[i].length >= cap) continue
      const d = haversineKm(move.coord, centers[i])
      if (d <= MAX_CLUSTER_RADIUS && d < bd) { bd = d; bestC = i }
    }
    if (bestC === -1) break
    clusters[bestC].push(clusters[heavy].splice(minI, 1)[0])
    const cl = clusters[bestC]
    centers[bestC] = {
      lng: cl.reduce((s, x) => s + x.coord.lng, 0) / cl.length,
      lat: cl.reduce((s, x) => s + x.coord.lat, 0) / cl.length,
    }
  }

  // 组内按 mustSee 降序
  clusters.forEach(c => c.sort((a, b) => score(b) - score(a)))
  // 景点不足天数时，补齐为 days 组（不足的天显示自由活动）
  while (clusters.length < days) clusters.push([])
  return clusters
}

// 某天景点相对质心的最大半径（km）：用于判断"是否跨区较远"给出提示
function daySpanKm(attractions) {
  const pts = attractions.filter(a => a.coord).map(a => a.coord)
  if (pts.length < 2) return 0
  const cl = { lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length, lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length }
  return Math.max(...pts.map(p => haversineKm(p, cl)))
}

// 景点排序：必看优先 + 就近成链。从最高 mustSee 出发，贪心选最近的下一个，
// 让列出的景点「按顺序、相邻就近」，既保证必去靠前，又天然顺路，不东一个西一个。
export function orderAttractions(attractions) {
  const withCoord = [...attractions].filter(a => a.coord)
  const noCoord = [...attractions].filter(a => !a.coord)
  if (withCoord.length === 0) return [...attractions]
  const score = a => (a.mustSee || 0)
  const start = withCoord.reduce((b, a) => (score(a) > score(b) ? a : b), withCoord[0])
  const remaining = withCoord.filter(a => a !== start)
  const ordered = [start]
  while (remaining.length) {
    const last = ordered[ordered.length - 1]
    let bi = 0, bd = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last.coord, remaining[i].coord)
      if (d < bd) { bd = d; bi = i }
    }
    ordered.push(remaining.splice(bi, 1)[0])
  }
  return [...ordered, ...noCoord]
}

// ============================================================
// 3. 时段分配：每天景点+餐食 → 上午/午餐/下午/晚餐/晚上
// ============================================================
const PERIOD_LABELS = { breakfast: '早餐', morning: '上午', lunch: '午餐', afternoon: '下午', dinner: '晚餐', evening: '晚上', free: '自由' }
const PERIOD_ORDER = { breakfast: 0, morning: 1, lunch: 2, afternoon: 3, dinner: 4, evening: 5, free: 6 }

function assignPeriods(dayAttractions, pace, dayRestaurants = null) {
  const max = PACE_ATTRACTIONS[pace] || 3
  const list = dayAttractions.slice(0, max)
  const slots = []

  if (list.length === 0) {
    slots.push({ period: 'free', attraction: { name: '自由活动 / 机动时间', desc: '可逛城市、探店或休息' } })
  }

  const night = list.find(a => a.night) || null
  const dayOnes = night ? list.filter(a => a !== night).slice(0, max - 1) : list

  if (night) {
    dayOnes.forEach((a, i) => slots.push({ period: i === 0 ? 'morning' : 'afternoon', attraction: a }))
    slots.push({ period: 'evening', attraction: night })
  } else {
    const n = dayOnes.length
    dayOnes.forEach((a, i) => {
      let period
      if (n <= 2) period = i === 0 ? 'morning' : 'afternoon'
      else if (n === 3) period = ['morning', 'afternoon', 'evening'][i]
      else period = i < 2 ? 'morning' : i === 2 ? 'afternoon' : 'evening'
      slots.push({ period, attraction: a })
    })
  }

  // 插入早餐、午餐、晚餐
  const withMeals = []
  if (dayRestaurants?.breakfast) {
    withMeals.push({ period: 'breakfast', meal: dayRestaurants.breakfast })
  }
  let hasLunch = false, hasDinner = false
  for (const s of slots) {
    if (!hasLunch && dayRestaurants?.lunch && s.period !== 'morning') {
      withMeals.push({ period: 'lunch', meal: dayRestaurants.lunch })
      hasLunch = true
    }
    withMeals.push(s)
    if (!hasDinner && dayRestaurants?.dinner && s.period === 'evening') {
      withMeals.push({ period: 'dinner', meal: dayRestaurants.dinner })
      hasDinner = true
    }
  }
  if (!hasLunch && dayRestaurants?.lunch) withMeals.splice(Math.min(1, withMeals.length), 0, { period: 'lunch', meal: dayRestaurants.lunch })
  if (!hasDinner && dayRestaurants?.dinner) withMeals.push({ period: 'dinner', meal: dayRestaurants.dinner })

  // 按时段顺序排序，确保 早餐→上午→午餐→下午→晚餐→晚上→自由
  withMeals.sort((a, b) => (PERIOD_ORDER[a.period] ?? 3) - (PERIOD_ORDER[b.period] ?? 3))

  return withMeals.map(s => ({ ...s, periodLabel: PERIOD_LABELS[s.period] }))
}

// ============================================================
// 4. 天气建议（按出行月份查内置数据）
// ============================================================
export function weatherAdvice(cityName, month) {
  const c = getCity(cityName)
  if (!c) return null
  const [lo, hi] = c.weather[Math.max(0, Math.min(11, month - 1))]
  const avg = (lo + hi) / 2
  const { feel, clothing } = clothingAdvice(avg)
  return { month, low: lo, high: hi, avg, feel, clothing }
}

function clothingAdvice(avg) {
  let feel = '舒适', clothing = '春秋装即可'
  if (avg < 0) { feel = '严寒'; clothing = '羽绒服/厚棉服/保暖内衣/雪地靴' }
  else if (avg < 10) { feel = '偏冷'; clothing = '厚外套/毛衣/秋裤' }
  else if (avg < 20) { feel = '舒适'; clothing = '长袖+薄外套，早晚加衣' }
  else if (avg < 28) { feel = '温暖'; clothing = '短袖+薄外套，防晒' }
  else { feel = '炎热'; clothing = '短袖短裤，防晒霜/遮阳帽' }
  return { feel, clothing }
}

export function weatherForDate(cityName, date) {
  const base = weatherAdvice(cityName, date.getMonth() + 1)
  const seed = date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate()
  const r1 = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
  const r2 = Math.abs(Math.sin(seed * 78.233 + 1.7) * 12345.678) % 1
  const loShift = Math.round((r1 - 0.5) * 5)
  const hiShift = Math.round((r2 - 0.5) * 5)
  let low = base.low + loShift
  let high = Math.max(base.high + hiShift, low + 1)
  const avg = (low + high) / 2
  const { feel, clothing } = clothingAdvice(avg)
  return { month: date.getMonth() + 1, low, high, avg, feel, clothing }
}

// ============================================================
// 5. 预算估算
// ============================================================
function ticketPrice(s) {
  const m = String(s || '').match(/\d+/)
  return m ? parseInt(m[0]) : 0
}

export function estimateBudget(cityNames, perCityDays, transports) {
  const totalDays = perCityDays.reduce((a, b) => a + b, 0)
  const n = cityNames.length

  // 大交通
  let transit = 0
  for (const t of transports) {
    if (t.mode === '飞机') transit += 550 + t.hours * 120
    else if (t.mode === '火车') transit += 120 + t.hours * 40
    else if (t.mode === '轮渡') transit += 300
    else transit += 150 + t.hours * 130 // 高铁
  }
  const roundTrip = transit * 1.1 // 回程近似

  // 住宿（经济~舒适区间）
  const hotelLow = 180 * totalDays, hotelHigh = 400 * totalDays
  // 门票：各城景点均价 × 该城天数
  let ticket = 0
  cityNames.forEach((c, i) => {
    const attrs = getCity(c)?.attractions || []
    if (attrs.length === 0) return
    const avg = attrs.reduce((s, a) => s + ticketPrice(a.ticket), 0) / attrs.length
    ticket += avg * Math.min(perCityDays[i], 3) // 每天按一个收费景点估算，最多算 3 天
  })
  // 餐饮 + 市内交通
  const food = 150 * totalDays
  const local = 50 * totalDays
  const low = Math.round(roundTrip + hotelLow + ticket + food + local)
  const high = Math.round(roundTrip + hotelHigh + ticket + food * 1.5 + local * 1.5)
  return {
    totalDays, transit: Math.round(roundTrip), hotel: [hotelLow, hotelHigh],
    ticket: Math.round(ticket), food: food * totalDays, local: local * totalDays,
    total: [low, high],
    items: [
      { label: '大交通(往返)', value: `¥${Math.round(roundTrip)}` },
      { label: '住宿', value: `¥${hotelLow}~${hotelHigh}` },
      { label: '门票', value: `¥${Math.round(ticket)}` },
      { label: '餐饮', value: `¥${food * totalDays}` },
      { label: '市内交通', value: `¥${local * totalDays}` },
    ],
  }
}

// ============================================================
// 6. 高德 POI 补充景点
// ============================================================
export async function supplementAttractions(cityName, existing = null) {
  const c = getCity(cityName)
  if (!c) return []
  try {
    const pois = await searchPOIsByText(cityName + ' 旅游景点', '', 10)
    if (!pois || pois.length === 0) return []
    // 与「当前已有景点（内置 + 已补充）」去重：同地异名(<2km)或同名视为同一景点，
    // 避免同一景点被排到不同天。existing 由调用方传入（generate 循环第 2 轮会带上一轮已补充的列表）。
    const base = (existing && existing.length) ? existing : c.attractions
    const refPts = base.filter(a => a.coord).map(a => a.coord)
    const refNames = new Set(base.map(a => a.name))
    const added = []
    for (const p of pois) {
      if (!p.lng || !p.lat) continue
      const coord = { lng: p.lng, lat: p.lat }
      const nearRef = refPts.some(b => haversineKm(coord, b) < 2)
      const sameName = refNames.has(p.name)
      const nearAdded = added.some(a => haversineKm(coord, a.coord) < 2)
      if (nearRef || sameName || nearAdded) continue
      refPts.push(coord)        // 本轮内也要纳入去重
      refNames.add(p.name)
      added.push({
        name: p.name, coord, ticket: '—',
        duration: '2-3h', mustSee: 2, type: 'urban',
        desc: '高德实时搜索补充', poi: true,
      })
      if (added.length >= 6) break
    }
    return added
  } catch (e) { return [] }
}

// 景点扩充：从高分实时补充景点，让清单更丰富（不再只有内置寥寥数个）。
// cats：关键词池（主类 SPOT_CATS 用于生成时自动补充；SPOT_EXT 用于手动「补充更多」）。
// rad：坐标去重半径(km)，cap：补充上限。手动补充用更宽松的半径，避免把同区域不同类别的景点误删。
export async function enrichAttractions(cityName, existing = null, { cats, cap = 26, rad = 1.5 } = {}) {
  const c = getCity(cityName)
  if (!c) return []
  try {
    const added = await searchSpotsForCity(cityName, c?.coord, 30, cats)
    if (!added.length) return []
    const base = (existing && existing.length) ? existing : c.attractions
    const refPts = base.filter(a => a.coord).map(a => a.coord)
    const refNames = new Set(base.map(a => a.name))
    const final = []
    for (const p of added) {
      if (!p.coord) continue
      const sameName = refNames.has(p.name)
      const nearRef = refPts.some(b => haversineKm(p.coord, b) < rad)
      const nearFinal = final.some(a => haversineKm(p.coord, a.coord) < rad)
      if (sameName || nearRef || nearFinal) continue
      refPts.push(p.coord)
      refNames.add(p.name)
      final.push(p)
      if (final.length >= cap) break
    }
    return final
  } catch (e) { return [] }
}

// ============================================================
// 7. 主入口：生成完整攻略
// ============================================================
export function buildFullPlan({ cities = [], startDate, endDate, pace = 'standard', interests = [], originCity = '' }) {
  if (cities.length === 0 || !startDate || !endDate) return null
  const s = parseDate(startDate), e = parseDate(endDate)
  if (e < s) return null
  const totalDays = Math.round((e - s) / 86400000) + 1

  const { perCity, transitDays } = allocateDays(cities, totalDays, pace)

  // 日期分配
  let cursor = new Date(s)
  const cityPlans = cities.map((name, i) => {
    const c = getCity(name)
    const days = perCity[i]
    const range = []
    for (let d = 0; d < days; d++) range.push(addDays(cursor, d))
    cursor = addDays(cursor, days + (i < cities.length - 1 ? 1 : 0)) // +1 转换日
    const month = range[0].getMonth() + 1
    const monthly = range.map(d => ({ date: d, ...weatherForDate(name, d) }))
    const wLo = Math.min(...monthly.map(m => m.low))
    const wHi = Math.max(...monthly.map(m => m.high))
    const wBase = weatherAdvice(name, month)
    return {
      name, data: c, days, dateRange: { start: range[0], end: range[range.length - 1] },
      dates: range.map(d => ({ date: d, label: `D${range.indexOf(d) + 1}` })),
      weather: { ...wBase, low: wLo, high: wHi },
      monthly,
    }
  })

  // 交通衔接
  const transports = []
  for (let i = 0; i < cities.length - 1; i++) {
    const t = getTransport(cities[i], cities[i + 1])
    // 转换日 = 城市 i 最后一天的次日
    const tDate = addDays(cityPlans[i].dateRange.end, 1)
    transports.push({ from: cities[i], to: cities[i + 1], mode: t.mode, hours: t.hours, estimated: !!t.estimated, date: tDate })
  }

  // 每日行程（先用占位，后续 searchAndAssignFoods 替换为真实餐厅）
  cityPlans.forEach(cp => {
    const all = [...cp.data.attractions]
    all.forEach(a => {
      if (/夜景|演出|酒吧|夜市|灯光|演艺/.test(a.name + (a.desc || ''))) a.night = true
    })
    const clusters = clusterAttractions(all, cp.days, interests)
    cp.daily = clusters.map((cl, di) => ({
      day: di + 1,
      date: cp.dates[di]?.date || cp.dateRange.start,
      dateLabel: cp.dates[di] ? `${cp.dates[di].label} ${fmtShort(cp.dates[di].date)} ${weekday(cp.dates[di].date)}` : '',
      slots: assignPeriods(cl, pace, null),
      count: cl.length,
      geoSpanKm: daySpanKm(cl),
    }))
  })

  const budget = estimateBudget(cities, perCity, transports)

  return {
    cities: cities,
    cityPlans, transports, budget,
    totalDays, transitDays, pace, paceLabel: PACE_LABEL[pace] || '标准',
    interests, startDate: fmtDate(s), endDate: fmtDate(e),
  }
}

// ============================================================
// 8. 无天数「景点清单」引擎：去掉 D1/D2 与每日行程，仅列景点（按必看+就近排序）
//    用于替代一直出问题的天数规划；美食改由「点击景点搜周边」实现
// ============================================================
export function buildSpotPlan({ cities = [], interests = [], originCity = '' } = {}) {
  if (cities.length === 0) return null
  const month = new Date().getMonth() + 1
  const cityPlans = cities.map(name => {
    const c = getCity(name)
    let attrs = [...(c?.attractions || [])]
    // 兴趣过滤（仅当能筛出结果时生效）
    if (interests.length) {
      const matched = attrs.filter(a => interests.includes(a.type))
      if (matched.length >= 1) attrs = matched
    }
    attrs = orderAttractions(attrs)
    const w = weatherAdvice(name, month)
    return {
      name, data: c, attractions: attrs,
      weather: { ...w },
    }
  })
  // 预算按各城建议天数粗略估算（无具体行程日期）
  const perCity = cityPlans.map(cp => getCity(cp.name)?.days || 2)
  const budget = estimateBudget(cities, perCity, [])
  return { cities, cityPlans, budget, interests, paceLabel: '自由行' }
}

// ============================================================
// 7.5 异步搜索真实餐厅并分配到每日行程（早中晚不重复）
// ============================================================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 餐厅就近分配：取「离当天任一景点最近」且 10km 窗口内的餐厅，距离越近优先级越高
// used = 同一家店（名|地址）不可重复；usedBrand = 同一连锁品牌（仅店名）整趟行程不重复，避免早/晚或跨天老出现同一家
function pickMealRestaurant(pool, dayAttrCoords, used, usedBrand, maxKm = RESTAURANT_MAX_KM) {
  const avail = pool.filter(r => !used.has(r.name + '|' + r.address) && (!usedBrand || !usedBrand.has(r.name)))
  if (avail.length === 0) return null
  const withCoord = avail.filter(r => r.coord)
  const src = withCoord.length ? withCoord : avail
  // 每家餐厅到当天任一景点的最小距离
  const scored = src.map(r => {
    let md = Infinity
    for (const a of (dayAttrCoords || [])) {
      const d = haversineKm(r.coord, a)
      if (d < md) md = d
    }
    return { r, md }
  })
  // 优先 10km 窗口内最近的；窗口外（无近店）退而求其次取全局最近，保证有店
  const inWin = scored.filter(s => s.md <= maxKm)
  const cand = inWin.length ? inWin : scored
  cand.sort((a, b) => a.md - b.md)
  const chosen = cand[0].r
  used.add(chosen.name + '|' + chosen.address) // 标记已用：避免早/午/晚或跨天重复同一家店
  if (usedBrand) usedBrand.add(chosen.name)     // 同品牌整趟不重复
  return chosen
}

// 餐厅按「当天景点」就近分配：吃的店跟着逛的路线走，不顺路就换更近的
function distributeRestaurants(restaurants, days, dayAttrCoords) {
  const used = new Set()        // 同一家店精确去重
  const usedBrand = new Set()   // 同一连锁品牌整趟去重
  const daily = []
  for (let d = 0; d < days; d++) {
    const coords = dayAttrCoords?.[d] || []
    const pickMeal = (meal) => {
      const pool = restaurants.filter(r => r.mealType === meal)
      // 优先同餐次且离当天景点最近（同品牌不重复）；无同餐次时退而求其次取最近；
      // 仍为空则放宽品牌限制（仅精确去重）保底，确保每餐都有店
      return pickMealRestaurant(pool, coords, used, usedBrand)
        || pickMealRestaurant(restaurants, coords, used, usedBrand)
        || pickMealRestaurant(restaurants, coords, used, null)
    }
    daily.push({ breakfast: pickMeal('breakfast'), lunch: pickMeal('lunch'), dinner: pickMeal('dinner') })
  }
  return daily
}

export async function searchAndAssignFoods(plan, onProgress = null) {
  for (let i = 0; i < plan.cityPlans.length; i++) {
    const cp = plan.cityPlans[i]
    onProgress?.({ city: cp.name, done: i, total: plan.cityPlans.length })
    const needed = cp.days * 3 + 5
    const restaurants = await searchRestaurantsForCity(cp.name, cp.data.coord, needed)
    // 每天景点坐标列表（含所有非餐/非本地景点）：让餐厅取「离当天任一景点最近 10km 内」
    const dayAttrCoords = cp.daily.map(d =>
      d.slots.filter(s => !s.meal && !s.local && s.attraction?.coord).map(s => s.attraction.coord)
    )
    const dailyMeals = distributeRestaurants(restaurants, cp.days, dayAttrCoords)
    cp.restaurants = restaurants
    cp.daily.forEach((d, di) => {
      const meals = dailyMeals[di] || {}
      const attractions = d.slots.filter(s => !s.meal).map(s => s.attraction)
      d.slots = assignPeriods(attractions, plan.pace, meals)
    })
  }
  onProgress?.({ city: '', done: plan.cityPlans.length, total: plan.cityPlans.length })
}

// ============================================================
// 7.6 异步搜索本地小众地点并插入每日行程（本地人去的地方）
// ============================================================
export async function searchAndAssignLocalSpots(plan, onProgress = null) {
  for (let i = 0; i < plan.cityPlans.length; i++) {
    const cp = plan.cityPlans[i]
    onProgress?.({ city: cp.name, done: i, total: plan.cityPlans.length })
    const needed = cp.days * 2 + 5  // 每天最多2个 + 缓冲
    const spots = await searchLocalSpotsForCity(cp.name, cp.data.coord, needed)
    cp.localSpots = spots

    const used = new Set()

    function insertLocalSlot(d, period, spot) {
      const newOrder = PERIOD_ORDER[period] ?? 3
      let insertPos = d.slots.length
      for (let si = 0; si < d.slots.length; si++) {
        const existingOrder = PERIOD_ORDER[d.slots[si].period] ?? 3
        if (existingOrder > newOrder) {
          insertPos = si
          break
        }
      }
      d.slots.splice(insertPos, 0, {
        period,
        periodLabel: PERIOD_LABELS[period],
        local: true,
        spot,
      })
    }

    function isPeriodFree(d, period) {
      return !d.slots.some(s => !s.meal && s.period === period)
    }

    const dayCentroids = cp.daily.map(d => {
      const pts = d.slots.filter(s => !s.meal && !s.local && s.attraction?.coord).map(s => s.attraction.coord)
      if (pts.length === 0) return cp.data.coord
      return { lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length, lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length }
    })
    const needs = cp.daily.map(d => {
      const cnt = d.slots.filter(s => !s.meal && !s.local).length
      return cnt <= 1 ? 2 : 1
    })

    let remain = needs.reduce((a, b) => a + b, 0)
    let guard = 0
    while (remain > 0 && guard++ < spots.length * 2) {
      let bestDay = -1, bestSpot = -1, bd = Infinity
      for (let di = 0; di < cp.daily.length; di++) {
        if (needs[di] <= 0) continue
        for (let si = 0; si < spots.length; si++) {
          const key = spots[si].name + '|' + spots[si].address
          if (used.has(key)) continue
          const dist = haversineKm(dayCentroids[di], spots[si].coord)
          if (dist < bd) { bd = dist; bestDay = di; bestSpot = si }
        }
      }
      if (bestDay === -1 || bestSpot === -1) break
      const spot = spots[bestSpot]
      used.add(spot.name + '|' + spot.address)
      const d = cp.daily[bestDay]
      let period = isPeriodFree(d, 'morning') ? 'morning'
        : isPeriodFree(d, 'afternoon') ? 'afternoon'
        : isPeriodFree(d, 'evening') ? 'evening' : null
      if (period) insertLocalSlot(d, period, spot)
      needs[bestDay]--
      remain--
    }
  }
  onProgress?.({ city: '', done: plan.cityPlans.length, total: plan.cityPlans.length })
}
// ============================================================
export function buildTextGuide(plan) {
  if (!plan) return ''
  const lines = []
  lines.push(`# ${plan.cities.join(' → ')} · 自由行攻略`)
  lines.push('')
  plan.cityPlans.forEach(cp => {
    lines.push(`## 🏙 ${cp.name}`)
    lines.push(`> ${cp.data?.desc || ''}`)
    lines.push('')
    lines.push('### 📍 景点清单（按推荐顺序）')
    cp.attractions.forEach((a, i) => {
      const parts = [`${i + 1}. **${a.name}**`]
      if (a.ticket) parts.push(a.ticket)
      if (a.duration) parts.push(`建议${a.duration}`)
      if (a.desc) parts.push('— ' + a.desc)
      lines.push('- ' + parts.join('｜'))
    })
    lines.push('')
    lines.push('💡 点击任意景点可查看附近特色美食（实时搜索）')
    lines.push('')
  })

  // 天气
  lines.push('## 🌤 天气提示')
  plan.cityPlans.forEach(cp => {
    const w = cp.weather
    if (w) lines.push(`- ${cp.name} ${w.month}月：${w.low}~${w.high}°C，${w.feel}，建议${w.clothing}`)
  })
  lines.push('')

  // 预算
  lines.push('## 💰 预算参考（人均）')
  if (plan.budget?.items) {
    plan.budget.items.forEach(it => lines.push(`- ${it.label}：${it.value}`))
    lines.push(`- **合计：¥${plan.budget.total[0]} ~ ¥${plan.budget.total[1]}**`)
  }
  lines.push('')

  // 贴士
  lines.push('## 💡 实用贴士')
  plan.cityPlans.forEach(cp => {
    (cp.data?.tips || []).forEach(t => lines.push(`- 【${cp.name}】${t}`))
  })
  return lines.join('\n')
}

export { PACE_LABEL, INTEREST_LABEL }
