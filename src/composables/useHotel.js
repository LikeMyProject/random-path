// ============================================================
// 酒店搜索 useHotel.js
// 基于高德 v5 place/around，在景点周边搜索酒店：
//   - types=100000（住宿服务）
//   - show_fields=rating,price → 获取真实评分与价格
//   - distance 字段 = 酒店距景点距离（米）
// 个性化推荐：出行/氛围/场景参数多选 → 按需采集环境数据
//   （餐饮密度/地铁站/商圈 POI）→ matchScore 推荐度评分
// 诚实降级：无评分显示"暂无评分"，无价格按类型推断并标注"参考价"
// ============================================================
import { AMAP_KEY, searchPOIs } from './useAMap.js'

const HOTEL_TYPES = '100000'
const SEARCH_RADIUS = 3000
const REQ_DELAY = 320 // 高德 QPS 控制（约 3 req/s）

// ===== 个性化参数预制集（用户可多选）=====
export const PERSONA_OPTIONS = [
  { key: 'walk', label: '🚶 步行优先', group: '出行', desc: '离景点 ≤1km，步行即达' },
  { key: 'bike', label: '🚴 骑行可达', group: '出行', desc: '3km 内骑行方便' },
  { key: 'car', label: '🚗 自驾方便', group: '出行', desc: '酒店有停车条件' },
  { key: 'metro', label: '🚇 地铁沿线', group: '出行', desc: '靠近地铁站更佳' },
  { key: 'quiet', label: '🤫 安静舒适', group: '氛围', desc: '避开热闹商圈' },
  { key: 'lively', label: '🎉 热闹繁华', group: '氛围', desc: '商圈/美食密集' },
  { key: 'family', label: '👨‍👩‍👧 亲子友好', group: '场景', desc: '适合家庭出行' },
  { key: 'food', label: '🍜 近美食街', group: '场景', desc: '周边餐饮丰富' },
  { key: 'parking', label: '🅿️ 免费停车', group: '场景', desc: '有停车位' },
  { key: 'view', label: '🌃 观景视野', group: '场景', desc: '江景/海景/山景房' },
]
export const PERSONA_GROUPS = ['出行', '氛围', '场景']

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchJSON(url, retries = 2) {
  for (let r = 0; r <= retries; r++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (r === retries) throw e
      await sleep(1200)
    } finally { clearTimeout(t) }
  }
}

function parseCoord(loc) {
  const [lng, lat] = String(loc || '').split(',').map(parseFloat)
  return (lng && lat) ? { lng, lat } : null
}

function parsePrice(p) {
  if (p == null || p === '') return null
  const m = String(p).match(/\d+(\.\d+)?/)
  if (!m) return null
  const v = parseFloat(m[0])
  return v > 0 ? v : null
}

// 无真实价格时按名称/类型推断价位区间（标注参考价）
function inferPriceRange(poi) {
  const t = poi.type || '', n = poi.name || ''
  if (/五星|豪华|丽思|瑞吉|君悦|W酒店|洲际|喜来登|香格里拉|希尔顿|凯悦|万豪|铂尔曼|万达文华/.test(t + n)) return [600, 1500]
  if (/四星|皇冠|威斯汀|万达嘉华|金陵/.test(t + n)) return [400, 800]
  if (/民宿|客栈|青旅|青年旅舍|旅馆|招待所|公寓/.test(t + n)) return [100, 250]
  if (/经济|连锁|快捷|如家|汉庭|七天|7天|全季|亚朵|锦江|格林|速8|速八|尚客优|维也纳|城市便捷/.test(t + n)) return [120, 350]
  return [200, 500]
}

// 评分是否可展示（高德 rating 为 0 或异常视为无评分）
function normalizeRating(r) {
  if (r == null || r === '') return null
  const v = parseFloat(r)
  return (v > 0 && v <= 5) ? Math.round(v * 10) / 10 : null
}

// 名称噪声过滤：排除明显非酒店 POI（高德住宿类型偶有杂项）
function isNoiseName(name) {
  if (!name || name.length < 4) return true
  return /影石|insta360|insta|数码|科技|工作室|办事处|营业部|展厅|体验店|旗舰店/.test(name)
}

// 无真实评分时，按品牌/类型给出"口碑参考"标签（非真实评分，仅供挑选参考）
function inferReputation(poi) {
  const t = poi.type || '', n = poi.name || ''
  if (/五星|国际|丽思|瑞吉|君悦|洲际|喜来登|香格里拉|希尔顿|凯悦|万豪|威斯汀|铂尔曼|皇冠/.test(t + n)) return { label: '品质之选', cls: 'premium' }
  if (/民宿|客栈|青旅|青年旅舍/.test(t + n)) return { label: '特色民宿', cls: 'bnb' }
  if (/连锁|如家|汉庭|七天|7天|全季|亚朵|锦江|格林|速8|速八|尚客优|维也纳|城市便捷|宜必思|布丁|橘子|宜尚/.test(t + n)) return { label: '连锁品牌', cls: 'chain' }
  return { label: '口碑参考', cls: 'normal' }
}

/**
 * 搜索某坐标周边酒店，按价位过滤
 * @returns {Array} [{ id, name, coord, address, price, priceInferred, priceRange, rating, distance, type }]
 */
// 住宿类型识别：酒店 / 民宿 / 客栈 / 青旅 / 公寓 / 旅馆 / 其他
function classifyKind(name = '', type = '') {
  const n = name + '|' + type
  if (/民宿|农家院|乡村民宿|庭院民宿|民宿客栈/.test(n)) return '民宿'
  if (/客栈|驿站|驿栈/.test(n)) return '客栈'
  if (/青年旅舍|国际青年|旅舍|青旅|背包客/.test(n)) return '青旅'
  if (/公寓|服务式公寓|行政公寓|短租公寓/.test(n)) return '公寓'
  if (/酒店|宾馆|饭店|度假村|大酒店|商务酒店|连锁酒店|温德姆|豪生/.test(n)) return '酒店'
  if (/旅馆|招待所|住宿|客居|旅店/.test(n)) return '旅馆'
  return '住宿'
}

export async function searchHotelsNear(lng, lat, { min = 0, max = Infinity, radius = SEARCH_RADIUS, limit = 15, keywords = null } = {}) {
  try {
    const base = `https://restapi.amap.com/v5/place/around?key=${AMAP_KEY}&location=${lng},${lat}&radius=${radius}&offset=${limit}&page=1&show_fields=rating,price,address`
    const typeUrl = `${base}&types=${HOTEL_TYPES}`
    const kwUrl = keywords ? `${base}&keywords=${encodeURIComponent(keywords)}` : null
    // 类型检索（覆盖酒店/宾馆/旅馆/民宿等全部住宿）+ 关键词补充检索（确保民宿/客栈也能被搜到）
    const [dType, dKw] = await Promise.all([
      fetchJSON(typeUrl),
      kwUrl ? fetchJSON(kwUrl) : Promise.resolve({ status: '0', pois: [] }),
    ])
    const pois = [...(dType.pois || []), ...(dKw.pois || [])]
    if (!pois.length) return []

    const seenId = new Set()
    const out = []
    for (const p of pois) {
      if (isNoiseName(p.name)) continue
      const id = p.id || `${p.name}|${p.location}`
      if (seenId.has(id)) continue
      seenId.add(id)
      const coord = parseCoord(p.location)
      if (!coord) continue
      const price = parsePrice(p.price)
      const rating = normalizeRating(p.rating)
      let pass = true
      if (price != null) {
        pass = price >= min && price <= max
      } else {
        // 无价格：推断区间与用户范围有交集则保留
        const [lo, hi] = inferPriceRange(p)
        pass = hi >= min && lo <= max
      }
      if (!pass) continue
      out.push({
        id: p.id || null,
        name: p.name || '未知住宿',
        kind: classifyKind(p.name, p.type),
        coord,
        address: p.address || '',
        price,
        priceInferred: price == null,
        priceRange: price == null ? inferPriceRange(p) : null,
        rating,
        reputation: rating == null ? inferReputation(p) : null,
        distance: p.distance ? parseInt(p.distance) : null,
        type: p.type || '',
      })
    }
    return out
  } catch (e) { return [] }
}

/**
 * 遍历多个景点搜索酒店，去重后按推荐度排序
 * @param {Array} attractions [{name, coord}]
 * @param {Object} opts { min, max, personas: [], onProgress }
 */
export async function searchHotelsForCity(attractions, { min, max, personas = [], onProgress = null } = {}) {
  const results = []
  const seen = new Set()
  const list = attractions.slice(0, 8) // 最多搜 8 个景点，控制请求量
  const need = {
    food: personas.includes('food') || personas.includes('lively') || personas.includes('quiet'),
    metro: personas.includes('metro'),
    mall: personas.includes('lively') || personas.includes('quiet'),
  }

  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const [hotels, env] = await Promise.all([
      searchHotelsNear(a.coord.lng, a.coord.lat, { min, max, keywords: '民宿|客栈|青年旅舍|农家院' }),
      collectEnv(a.coord.lng, a.coord.lat, need),
    ])
    for (const h of hotels) {
      const key = h.id || `${h.name}|${h.coord.lng.toFixed(4)}|${h.coord.lat.toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      const ms = matchScore(h, personas, env)
      results.push({ ...h, attraction: a.name, env, ...ms })
    }
    onProgress?.({ done: i + 1, total: list.length })
    if (i < list.length - 1) await sleep(REQ_DELAY)
  }

  // 排序：有个性化参数按推荐度；否则按评分→距离
  if (personas.length > 0) {
    results.sort((x, y) => y.score - x.score)
  } else {
    results.sort((x, y) => {
      const rx = x.rating ?? -1, ry = y.rating ?? -1
      if (rx !== ry) return ry - rx
      return (x.distance ?? Infinity) - (y.distance ?? Infinity)
    })
  }
  return results
}

// ===== 环境数据采集（按需，每景点一次）=====
// 同时存 POI 列表（用于给匹配标签补充"具体是哪个"的细节）
async function collectEnv(lng, lat, need) {
  const env = { foodCount: 0, foodList: [], metroCount: 0, metroList: [], malls: [] }
  const tasks = []
  if (need.food) tasks.push(searchPOIs(lng, lat, '050000', 900, 10).then(list => {
    env.foodCount = list.length
    env.foodList = list.map(p => ({ name: p.name, coord: { lng: p.lng, lat: p.lat } }))
  }).catch(() => {}))
  if (need.metro) tasks.push(searchPOIs(lng, lat, '150500', 1400, 6).then(list => {
    env.metroCount = list.length
    env.metroList = list.map(p => ({ name: p.name, coord: { lng: p.lng, lat: p.lat } }))
  }).catch(() => {}))
  if (need.mall) tasks.push(searchPOIs(lng, lat, '060100', 2000, 6).then(list => {
    env.malls = list
      .filter(p => !/食品|超市|便利店|商店|药店|杂货/.test(p.name))
      .map(p => ({ name: p.name, coord: { lng: p.lng, lat: p.lat } }))
  }).catch(() => {}))
  await Promise.all(tasks)
  return env
}

function haversineKm(a, b) {
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// 酒店距最近商圈（客户端计算，零额外请求）
export function nearestMall(h) {
  if (!h.env?.malls?.length) return null
  let best = null, bd = Infinity
  for (const m of h.env.malls) {
    const d = haversineKm(h.coord, m.coord)
    if (d < bd) { bd = d; best = m }
  }
  return best ? { name: best.name, km: bd } : null
}

// 景点热闹度（餐饮/商圈密度）
function isLivelyEnv(env) {
  return (env?.foodCount ?? 0) >= 4 || (env?.malls?.length ?? 0) > 0
}

// 取某坐标最近的 POI（返回 { name, km }）
function nearestOf(coord, list) {
  if (!coord || !list?.length) return null
  let best = null, bd = Infinity
  for (const m of list) {
    const d = haversineKm(coord, m.coord)
    if (d < bd) { bd = d; best = m }
  }
  return best ? { name: best.name, km: bd } : null
}

/**
 * 推荐度评分：参数匹配率为主，评分为辅
 * @returns { score, pct, tags }
 */
export function matchScore(h, personas, env) {
  const p = new Set(personas || [])
  if (p.size === 0) return { score: (h.rating ?? 0), pct: null, tags: [] }
  const d = h.distance ?? Infinity
  const name = h.name || '', addr = h.address || ''
  const lively = isLivelyEnv(env)
  const nearFood = nearestOf(h.coord, env?.foodList)
  const nearMetro = nearestOf(h.coord, env?.metroList)
  const nearMall = nearestMall(h)
  const foodM = nearFood ? Math.round(nearFood.km * 1000) : null
  const metroM = nearMetro ? Math.round(nearMetro.km * 1000) : null
  let hits = 0
  const tags = []

  // 出行
  if (p.has('walk') && d <= 1000) { hits++; tags.push(`步行友好·${formatDist(h)}到景点`) }
  if (p.has('bike') && d <= 3000) { hits++; tags.push(`骑行可达·${formatDist(h)}`) }
  if (p.has('car') && /停车|车位/.test(name + addr)) { hits++; tags.push('可停车') }
  if (p.has('metro') && ((env?.metroCount ?? 0) > 0 || /地铁/.test(addr))) {
    hits++; tags.push(nearMetro ? `近地铁·${nearMetro.name} ${metroM}m` : '近地铁')
  }
  // 氛围
  if (p.has('quiet') && !lively) { hits++; tags.push('安静区域·周边餐饮少') }
  if (p.has('lively') && lively) {
    hits++
    if (nearMall) tags.push(`热闹地段·近${nearMall.name} ${Math.round(nearMall.km * 1000)}m`)
    else if ((env?.foodCount ?? 0) >= 4) tags.push(`热闹地段·周边餐饮${env.foodCount}家`)
    else tags.push('热闹地段')
  }
  // 场景
  if (p.has('family') && /亲子|家庭|度假|公寓|套房/.test(name)) { hits++; tags.push('亲子友好') }
  if (p.has('food')) {
    if ((env?.foodCount ?? 0) >= 4) {
      hits++
      tags.push(nearFood ? `近美食街·${nearFood.name} ${foodM}m` : `美食聚集·周边${env.foodCount}家`)
    }
  }
  if (p.has('parking') && /停车|车位/.test(name + addr)) { hits++; tags.push('免费停车') }
  if (p.has('view')) {
    const vk = (name.match(/江景|海景|湖景|山景|观景|高空|天际|全景/) || [])[0]
    if (vk) { hits++; tags.push(`景观房·${vk}`) }
  }

  const pct = Math.round(hits / p.size * 100)
  const score = pct * 10 + (h.rating ?? 0) * 5 + (d <= 1500 ? 3 : 0)
  return { score, pct, tags }
}

// ===== 展示格式化 =====
export function formatPrice(h) {
  if (h.price != null) return `¥${Math.round(h.price)}`
  if (h.priceRange) return `¥${h.priceRange[0]}~${h.priceRange[1]}`
  return '价格未知'
}export function formatRating(h) {
  if (h.rating != null) return `${h.rating} 分`
  if (h.reputation) return `${h.reputation.label}（参考）`
  return '暂无评分'
}
export function formatDist(h) {
  if (h.distance == null) return '—'
  return h.distance < 1000 ? `${h.distance}m` : `${(h.distance / 1000).toFixed(1)}km`
}
export function isGoodRated(h) { return h.rating != null && h.rating >= 4.0 }

// ===== 酒店 → 景点出行估算 =====
export const TRANSIT_LABEL = {
  walk: '🚶 步行', bike: '🚴 骑行', transit: '🚇 公交/地铁', taxi: '🚕 打车',
}
const WALK_SPEED = 5, BIKE_SPEED = 15, TRANSIT_SPEED = 22, TAXI_SPEED = 30 // km/h
const ROAD_FACTOR = 1.3 // 直线距离 → 道路距离修正

function taxiFee(roadKm) {
  // 起步 10 元含 3km，超出 2.2 元/km
  const fee = 10 + Math.max(0, roadKm - 3) * 2.2
  return `约¥${Math.round(fee / 5) * 5}`
}

/**
 * 估算从酒店到各景点的出行方式/时间/费用（直线距离估算，实际以导航为准）
 * @param {Object} hotel { coord }
 * @param {Array} attractions [{name, coord}]
 * @returns {Array} [{ attraction, km, mode, timeMin, fee }]
 */
export function estimateTransit(hotel, attractions = []) {
  if (!hotel?.coord) return []
  return attractions.map(a => {
    const km = haversineKm(hotel.coord, a.coord)
    const road = km * ROAD_FACTOR
    let mode, timeMin, fee
    if (km <= 1.5) {
      mode = 'walk'; timeMin = Math.max(1, Math.round(km / WALK_SPEED * 60)); fee = '免费'
    } else if (km <= 4) {
      mode = 'bike'; timeMin = Math.round(km / BIKE_SPEED * 60); fee = '约¥2'
    } else if (km <= 15) {
      mode = 'transit'; timeMin = Math.round(road / TRANSIT_SPEED * 60); fee = '¥2~5'
    } else {
      mode = 'taxi'; timeMin = Math.round(road / TAXI_SPEED * 60); fee = taxiFee(road)
    }
    return { attraction: a.name, km: Math.round(km * 10) / 10, mode, timeMin, fee }
  })
}
