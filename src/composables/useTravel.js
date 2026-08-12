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
import { searchPOIsByText } from './useAMap.js'

const PACE_ATTRACTIONS = { relax: 2, standard: 3, compact: 4 }
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

// ============================================================
// 2. 景点地理聚类：贪心种子 + 最近中心分配，再平衡
// ============================================================
export function clusterAttractions(attractions, days, interests = []) {
  if (attractions.length === 0) return []
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

  // 种子：得分最高的 days 个
  const k = Math.min(days, sorted.length)
  const seeds = sorted.slice(0, k)
  const clusters = seeds.map(s => [s])
  const centers = seeds.map(s => ({ lng: s.coord.lng, lat: s.coord.lat }))

  // 其余景点分配给最近中心
  for (const a of sorted.slice(k)) {
    let best = 0, bd = Infinity
    for (let i = 0; i < centers.length; i++) {
      const d = haversineKm(a.coord, centers[i])
      if (d < bd) { bd = d; best = i }
    }
    clusters[best].push(a)
    // 中心微调（取均值）
    const cl = clusters[best]
    centers[best] = {
      lng: cl.reduce((s, x) => s + x.coord.lng, 0) / cl.length,
      lat: cl.reduce((s, x) => s + x.coord.lat, 0) / cl.length,
    }
  }

  // 平衡：每天上限 ceil(len/k)，超出的低分景点移到最少的天
  const cap = Math.ceil(sorted.length / k)
  let guard = 0
  while (guard++ < k * 2) {
    let heavy = -1, light = -1
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > cap) heavy = i
      if (clusters[i].length < cap && light === -1) light = i
    }
    if (heavy === -1 || light === -1) break
    // 把 heavy 里 mustSee 最低的移给 light
    let minI = 0
    for (let j = 1; j < clusters[heavy].length; j++) if (score(clusters[heavy][j]) < score(clusters[heavy][minI])) minI = j
    clusters[light].push(clusters[heavy].splice(minI, 1)[0])
  }

  // 组内按 mustSee 降序
  clusters.forEach(c => c.sort((a, b) => score(b) - score(a)))
  return clusters
}

// ============================================================
// 3. 时段分配：每天景点 → 上午/下午/晚上
// ============================================================
function assignPeriods(dayAttractions, pace) {
  const max = PACE_ATTRACTIONS[pace] || 3
  const list = dayAttractions.slice(0, max)
  const slots = []
  const periods = ['morning', 'afternoon', 'evening']
  const labels = { morning: '上午', afternoon: '下午', evening: '晚上' }
  // 晚上只放 1 个（夜景/美食/演出），其余分配到上午下午
  const night = list.find(a => a.night) || null
  const dayOnes = night ? list.filter(a => a !== night).slice(0, max - 1) : list
  const mid = Math.ceil(dayOnes.length / 2)
  dayOnes.forEach((a, i) => slots.push({ period: i < mid ? 'morning' : 'afternoon', attraction: a }))
  if (night) slots.push({ period: 'evening', attraction: night })
  else if (dayOnes.length === max && dayOnes[max - 1]) slots.push({ period: 'evening', attraction: dayOnes[max - 1] })
  return slots.map(s => ({ ...s, periodLabel: labels[s.period] }))
}

// ============================================================
// 4. 天气建议（按出行月份查内置数据）
// ============================================================
export function weatherAdvice(cityName, month) {
  const c = getCity(cityName)
  if (!c) return null
  const [lo, hi] = c.weather[Math.max(0, Math.min(11, month - 1))]
  const avg = (lo + hi) / 2
  let feel = '舒适', clothing = '春秋装即可'
  if (avg < 0) { feel = '严寒'; clothing = '羽绒服/厚棉服/保暖内衣/雪地靴' }
  else if (avg < 10) { feel = '偏冷'; clothing = '厚外套/毛衣/秋裤' }
  else if (avg < 20) { feel = '舒适'; clothing = '长袖+薄外套，早晚加衣' }
  else if (avg < 28) { feel = '温暖'; clothing = '短袖+薄外套，防晒' }
  else { feel = '炎热'; clothing = '短袖短裤，防晒霜/遮阳帽' }
  return { month, low: lo, high: hi, avg, feel, clothing }
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
export async function supplementAttractions(cityName) {
  const c = getCity(cityName)
  if (!c) return []
  try {
    const pois = await searchPOIsByText(cityName + ' 旅游景点', '', 10)
    if (!pois || pois.length === 0) return []
    const existing = new Set(c.attractions.map(a => a.name))
    const added = []
    for (const p of pois) {
      if (existing.has(p.name) || added.some(a => a.name === p.name)) continue
      if (!p.lng || !p.lat) continue
      added.push({
        name: p.name, coord: { lng: p.lng, lat: p.lat }, ticket: '—',
        duration: '2-3h', mustSee: 2, type: 'urban',
        desc: '高德实时搜索补充', poi: true,
      })
      if (added.length >= 6) break
    }
    return added
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
    return {
      name, data: c, days, dateRange: { start: range[0], end: range[range.length - 1] },
      dates: range.map(d => ({ date: d, label: `D${range.indexOf(d) + 1}` })),
      weather: weatherAdvice(name, month),
      monthly: range.map(d => ({ date: d, ...weatherAdvice(name, d.getMonth() + 1) })),
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

  // 每日行程
  cityPlans.forEach(cp => {
    const all = [...cp.data.attractions]
    // 标记夜景类
    all.forEach(a => {
      if (/夜景|演出|酒吧|夜市|灯光|演艺/.test(a.name + (a.desc || ''))) a.night = true
    })
    const clusters = clusterAttractions(all, cp.days, interests)
    cp.daily = clusters.map((cl, di) => ({
      day: di + 1,
      date: cp.dates[di]?.date || cp.dateRange.start,
      dateLabel: cp.dates[di] ? `${cp.dates[di].label} ${fmtShort(cp.dates[di].date)} ${weekday(cp.dates[di].date)}` : '',
      slots: assignPeriods(cl, pace),
      count: cl.length,
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
// 8. 文本攻略导出（markdown）
// ============================================================
export function buildTextGuide(plan) {
  if (!plan) return ''
  const lines = []
  lines.push(`# ${plan.cities.join(' → ')} · ${plan.totalDays}天${plan.transitDays > 0 ? `（含${plan.transitDays}天转换）` : ''}旅行攻略`)
  lines.push(`行程日期：${plan.startDate} ~ ${plan.endDate} · 节奏：${plan.paceLabel}`)
  lines.push('')

  // 总览
  lines.push('## 📅 行程总览')
  plan.cityPlans.forEach(cp => {
    const r = cp.dateRange
    lines.push(`- **${cp.name}**：${cp.days}天（${fmtShort(r.start)}~${fmtShort(r.end)}）${cp.data.desc}`)
  })
  lines.push('')

  // 交通
  if (plan.transports.length) {
    lines.push('## 🚄 城市间交通')
    plan.transports.forEach(t => lines.push(`- ${t.from} → ${t.to}：${t.mode}约${t.hours}小时${t.estimated ? '（估算）' : ''}（${fmtShort(t.date)}）`))
    lines.push('')
  }

  // 每日行程
  plan.cityPlans.forEach(cp => {
    lines.push(`## 🏙 ${cp.name}（${cp.days}天）`)
    lines.push(`> ${cp.data.desc}`)
    cp.daily.forEach(d => {
      lines.push(`\n### ${d.dateLabel}`)
      if (d.slots.length === 0) { lines.push('- 自由活动 / 机动时间'); return }
      d.slots.forEach(s => {
        const a = s.attraction
        lines.push(`- **${s.periodLabel}** ${a.name}｜${a.ticket}｜建议${a.duration}${a.desc ? ' — ' + a.desc : ''}`)
      })
    })
    lines.push('')
  })

  // 天气
  lines.push('## 🌤 天气提示')
  plan.cityPlans.forEach(cp => {
    const w = cp.weather
    if (w) lines.push(`- ${cp.name} ${w.month}月：${w.low}~${w.high}°C，${w.feel}，建议${w.clothing}`)
  })
  lines.push('')

  // 美食
  lines.push('## 🍜 必吃美食')
  plan.cityPlans.forEach(cp => {
    lines.push(`- **${cp.name}**：${cp.data.foods.map(f => `${f.name}(${f.price})`).join('、')}`)
  })
  lines.push('')

  // 预算
  lines.push('## 💰 预算参考（人均）')
  plan.budget.items.forEach(it => lines.push(`- ${it.label}：${it.value}`))
  lines.push(`- **合计：¥${plan.budget.total[0]} ~ ¥${plan.budget.total[1]}**`)
  lines.push('')

  // 贴士
  lines.push('## 💡 实用贴士')
  plan.cityPlans.forEach(cp => {
    cp.data.tips.forEach(t => lines.push(`- 【${cp.name}】${t}`))
  })
  return lines.join('\n')
}

export { PACE_LABEL, INTEREST_LABEL }
