// ============================================================
// 酒店搜索 useHotel.js
// 基于高德 v5 place/around，在景点周边搜索酒店：
//   - types=100000（住宿服务）
//   - show_fields=rating,price → 获取真实评分与价格
//   - distance 字段 = 酒店距景点距离（米）
// 诚实降级：无评分显示"暂无评分"，无价格按类型推断并标注"参考价"
// ============================================================
import { AMAP_KEY } from './useAMap.js'

const HOTEL_TYPES = '100000'
const SEARCH_RADIUS = 3000
const REQ_DELAY = 350 // 高德 QPS 控制（约 2.8 req/s）

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
export async function searchHotelsNear(lng, lat, { min = 0, max = Infinity, radius = SEARCH_RADIUS, limit = 15 } = {}) {
  try {
    const url = `https://restapi.amap.com/v5/place/around?key=${AMAP_KEY}&location=${lng},${lat}&types=${HOTEL_TYPES}&radius=${radius}&offset=${limit}&page=1&show_fields=rating,price,address`
    const d = await fetchJSON(url)
    if (d.status !== '1' || !d.pois?.length) return []

    return d.pois.map(p => {
      if (isNoiseName(p.name)) return null
      const coord = parseCoord(p.location)
      if (!coord) return null
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
      if (!pass) return null
      return {
        id: p.id || null,
        name: p.name || '未知酒店',
        coord,
        address: p.address || '',
        price,
        priceInferred: price == null,
        priceRange: price == null ? inferPriceRange(p) : null,
        rating,
        reputation: rating == null ? inferReputation(p) : null,
        distance: p.distance ? parseInt(p.distance) : null,
        type: p.type || '',
      }
    }).filter(Boolean)
  } catch (e) { return [] }
}

/**
 * 遍历多个景点搜索酒店，去重后按评分（好评优先）→距离排序
 * @param {Array} attractions [{name, coord}]
 */
export async function searchHotelsForCity(attractions, { min, max, onProgress = null } = {}) {
  const results = []
  const seen = new Set()
  const list = attractions.slice(0, 8) // 最多搜 8 个景点，控制请求量
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const hotels = await searchHotelsNear(a.coord.lng, a.coord.lat, { min, max })
    for (const h of hotels) {
      const key = h.id || `${h.name}|${h.coord.lng.toFixed(4)}|${h.coord.lat.toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ ...h, attraction: a.name })
    }
    onProgress?.({ done: i + 1, total: list.length })
    if (i < list.length - 1) await sleep(REQ_DELAY)
  }
  // 排序：有评分的优先（评分降序），再按距离
  results.sort((x, y) => {
    const rx = x.rating ?? -1, ry = y.rating ?? -1
    if (rx !== ry) return ry - rx
    return (x.distance ?? Infinity) - (y.distance ?? Infinity)
  })
  return results
}

// ===== 展示格式化 =====
export function formatPrice(h) {
  if (h.price != null) return `¥${Math.round(h.price)}`
  if (h.priceRange) return `¥${h.priceRange[0]}~${h.priceRange[1]}`
  return '价格未知'
}
export function formatRating(h) {
  if (h.rating != null) return `${h.rating} 分`
  if (h.reputation) return `${h.reputation.label}（参考）`
  return '暂无评分'
}
export function formatDist(h) {
  if (h.distance == null) return '—'
  return h.distance < 1000 ? `${h.distance}m` : `${(h.distance / 1000).toFixed(1)}km`
}
export function isGoodRated(h) { return h.rating != null && h.rating >= 4.0 }
