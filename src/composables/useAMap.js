import { parsePolyline, samplePoints } from '../utils/math.js'

export const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || ''
const TIMEOUT = 10000
let sdkLoaded = false, sdkLoading = null
export function loadAMapSDK() {
  if (sdkLoaded) return Promise.resolve()
  if (sdkLoading) return sdkLoading
  sdkLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Elevation,AMap.Geocoder,AMap.AutoComplete`
    s.onload = () => { sdkLoaded = true; resolve() }
    s.onerror = () => { sdkLoading = null; reject(new Error('SDK failed')) }
    document.head.appendChild(s)
  })
  return sdkLoading
}
async function fetchJSON(url, retries = 2) {
  for (let r = 0; r <= retries; r++) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT)
    try { const res = await fetch(url, { signal: ctrl.signal }); if (!res.ok) throw Error(`HTTP ${res.status}`); return await res.json() }
    catch (e) { if (r === retries) throw e; await new Promise(r => setTimeout(r, 1200)) }
    finally { clearTimeout(t) }
  }
}
const gcCache = new Map()
// 自动检测的当前城市，GPS 定位后设置
let detectedCity = ''
export function getDetectedCity() { return detectedCity }
export function setDetectedCity(c) { detectedCity = c || '' }
export async function detectCityFromGPS(lng, lat) {
  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng},${lat}&extensions=base`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.regeocode?.addressComponent) {
      const ac = d.regeocode.addressComponent
      return ac.city || ac.province || ''
    }
  } catch(e) {}
  return ''
}
// ============================================================
// 城市真实餐厅搜索：多关键词搜索 + 去重 + 餐次分类
// ============================================================
const FOOD_SEARCH_QUERIES = [
  { kw: '早餐',   meal: 'breakfast' },
  { kw: '包子',   meal: 'breakfast' },
  { kw: '粥店',   meal: 'breakfast' },
  { kw: '早茶',   meal: 'breakfast' },
  { kw: '面馆',   meal: 'lunch' },
  { kw: '米粉',   meal: 'lunch' },
  { kw: '快餐',   meal: 'lunch' },
  { kw: '饺子',   meal: 'lunch' },
  { kw: '中餐',   meal: 'lunch' },
  { kw: '美食',   meal: 'lunch' },
  { kw: '火锅',   meal: 'dinner' },
  { kw: '烧烤',   meal: 'dinner' },
  { kw: '烤鱼',   meal: 'dinner' },
  { kw: '川菜',   meal: 'dinner' },
  { kw: '西餐',   meal: 'dinner' },
  { kw: '日料',   meal: 'dinner' },
  { kw: '小吃',   meal: 'snack' },
  { kw: '甜品',   meal: 'snack' },
  { kw: '奶茶',   meal: 'snack' },
  { kw: '夜宵',   meal: 'snack' },
]

export async function searchRestaurantsForCity(cityName, cityCoord, needed = 40) {
  const results = []
  const seen = new Set()
  for (const { kw, meal } of FOOD_SEARCH_QUERIES) {
    if (results.length >= needed) break
    try {
      let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}` +
        `&keywords=${encodeURIComponent(kw)}` +
        `&city=${encodeURIComponent(cityName)}` +
        `&types=050000` +
        `&offset=25` +
        `&show_fields=rating,price,tag,address`
      const d = await fetchJSON(url)
      if (d.status === '1' && d.pois) {
        for (const p of d.pois) {
          const loc = (p.location || '').split(',')
          const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
          if (!lng || !lat) continue
          const key = p.name + '|' + (p.address || '')
          if (seen.has(key)) continue
          seen.add(key)
          results.push({
            name: p.name || '', address: p.address || '', rating: p.rating || '',
            price: p.price ? `¥${p.price}/人` : '', type: p.type || '', tag: p.tag || '',
            mealType: meal, coord: { lng, lat },
          })
          if (results.length >= needed) break
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}

// ============================================================
// 城市本地小众地点搜索：本地人才知道的小地标、隐藏景点、老城角落
// ============================================================
const LOCAL_SPOT_QUERIES = [
  // 小众景点 & 秘境
  { kw: '小众景点', cat: 'hidden', label: '小众秘境' },
  { kw: '秘境', cat: 'hidden', label: '小众秘境' },
  { kw: '冷门景点', cat: 'hidden', label: '小众秘境' },
  { kw: '人少景美', cat: 'hidden', label: '小众秘境' },
  // 打卡拍照
  { kw: '打卡', cat: 'photo', label: '拍照打卡' },
  { kw: '网红', cat: 'photo', label: '拍照打卡' },
  { kw: '拍照', cat: 'photo', label: '拍照打卡' },
  // 老城 & 巷子
  { kw: '老城区', cat: 'oldtown', label: '老城韵味' },
  { kw: '老巷子', cat: 'oldtown', label: '老城韵味' },
  { kw: '胡同', cat: 'oldtown', label: '老城韵味' },
  { kw: '老街', cat: 'oldstreet', label: '老街漫步' },
  { kw: '古街', cat: 'oldstreet', label: '老街漫步' },
  { kw: '历史街区', cat: 'oldstreet', label: '老街漫步' },
  // 观景点
  { kw: '观景台', cat: 'viewpoint', label: '观景好去处' },
  { kw: '瞭望台', cat: 'viewpoint', label: '观景好去处' },
  { kw: '观景点', cat: 'viewpoint', label: '观景好去处' },
  // 艺术文化
  { kw: '艺术区', cat: 'art', label: '文艺空间' },
  { kw: '文创园', cat: 'art', label: '文艺空间' },
  { kw: '创意园', cat: 'art', label: '文艺空间' },
  { kw: '涂鸦', cat: 'art', label: '文艺空间' },
  { kw: '壁画', cat: 'art', label: '文艺空间' },
  { kw: '小众博物馆', cat: 'museum', label: '小众博物馆' },
  { kw: '民俗博物馆', cat: 'museum', label: '小众博物馆' },
  { kw: '美术馆', cat: 'gallery', label: '艺术空间' },
  { kw: '画廊', cat: 'gallery', label: '艺术空间' },
  // 本地生活
  { kw: '老茶馆', cat: 'localife', label: '本地生活' },
  { kw: '茶馆', cat: 'localife', label: '本地生活' },
  { kw: '独立书店', cat: 'bookstore', label: '书香角落' },
  { kw: '旧书店', cat: 'bookstore', label: '书香角落' },
  { kw: '创意市集', cat: 'market', label: '创意市集' },
  // 历史 & 古建
  { kw: '老建筑', cat: 'heritage', label: '历史建筑' },
  { kw: '历史建筑', cat: 'heritage', label: '历史建筑' },
  { kw: '古镇', cat: 'ancient', label: '古镇古村' },
  { kw: '古村', cat: 'ancient', label: '古镇古村' },
  { kw: '老字号', cat: 'heritage', label: '百年老店' },
  // 公园 & 休闲
  { kw: '社区公园', cat: 'park', label: '社区公园' },
  { kw: '街心花园', cat: 'park', label: '社区公园' },
  { kw: '滨江步道', cat: 'waterfront', label: '滨江步道' },
  { kw: '湖边', cat: 'waterfront', label: '滨水休闲' },
  // 寺庙
  { kw: '寺庙', cat: 'temple', label: '禅意时光' },
  { kw: '道观', cat: 'temple', label: '禅意时光' },
  // 夜市
  { kw: '夜市', cat: 'nightmarket', label: '夜市烟火' },
]

export async function searchLocalSpotsForCity(cityName, cityCoord, needed = 40) {
  const results = []
  const seen = new Set()
  // 过滤掉明显的噪声 POI
  const NOISE_RE = /收费站|服务区|停车场|公交站|地铁站$|配送点|快递|物流|驾校|汽修|洗车|维修|批发市场$|菜市场|农贸市场|商业广场$|购物广场$/
  for (const { kw, cat, label } of LOCAL_SPOT_QUERIES) {
    if (results.length >= needed) break
    try {
      let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}` +
        `&keywords=${encodeURIComponent(kw)}` +
        `&city=${encodeURIComponent(cityName)}` +
        `&city_limit=true` +
        `&offset=25` +
        `&show_fields=tag,address`
      const d = await fetchJSON(url)
      if (d.status === '1' && d.pois) {
        for (const p of d.pois) {
          const loc = (p.location || '').split(',')
          const lng = parseFloat(loc[0]), lat = parseFloat(loc[1])
          if (!lng || !lat) continue
          const name = p.name || ''
          if (NOISE_RE.test(name)) continue
          const key = name + '|' + (p.address || '')
          if (seen.has(key)) continue
          seen.add(key)
          results.push({
            name, address: p.address || '', tag: p.tag || '',
            category: cat, label, coord: { lng, lat },
          })
          if (results.length >= needed) break
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}

export async function searchPOIsByText(keywords, city = '', limit = 5) {
  try {
    let url = `https://restapi.amap.com/v5/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(keywords)}&offset=${limit}`
    if (city) url += `&region=${encodeURIComponent(city)}`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.pois?.length > 0) return d.pois.map(p => { const [pl, pt] = p.location.split(',').map(parseFloat); return { lng: pl, lat: pt, name: p.name, type: p.type } })
  } catch (e) {}
  return []
}

export async function geocode(address, city = '') {
  const effectiveCity = city || detectedCity
  const cacheK = `${address}||${effectiveCity}`; if (gcCache.has(cacheK)) return gcCache.get(cacheK)
  const extractDetail = (input, apiName) => {
    if (!apiName) return input
    const idx = input.indexOf(apiName)
    return idx >= 0 ? input.slice(idx) : input
  }
  const doOneRound = async (useCity) => {
    return Promise.all([
      searchPOIsByText(address, useCity || '', 5).catch(() => []),
      (async () => {
        try {
          let url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`
          if (useCity) url += `&city=${encodeURIComponent(useCity)}`
          const d = await fetchJSON(url)
          if (d.status === '1' && d.geocodes?.length > 0) {
            const g = d.geocodes[0]; const [lng, lat] = g.location.split(',').map(parseFloat)
            return { lng, lat, name: g.formatted_address || '' }
          }
        } catch(e) {}
        return null
      })()
    ])
  }

  // 第一轮：优先用当前城市
  let [poiResults, geoResult] = await doOneRound(effectiveCity)

  // 当前城市没找到 → 放开城市限制再搜一轮
  if (effectiveCity && poiResults.length === 0 && !geoResult) {
    [poiResults, geoResult] = await doOneRound('')
  }

  if (poiResults.length > 0) {
    const best = poiResults[0]
    const r = { lng: best.lng, lat: best.lat, name: best.name }
    if (gcCache.size < 100) gcCache.set(cacheK, r); return r
  }

  if (geoResult) {
    const { lng, lat } = geoResult
    const apiName = geoResult.name
    const name = (address.length > apiName.length + 2) ? extractDetail(address, apiName) : (apiName || address)
    const r = { lng, lat, name }
    if (gcCache.size < 100) gcCache.set(cacheK, r); return r
  }

  return null
}
export async function reverseGeocode(lng, lat) {
  try {
    const url = `https://restapi.amap.com/v3/geocode/regeo?key=${AMAP_KEY}&location=${lng},${lat}&extensions=base`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.regeocode) return d.regeocode.formatted_address || d.regeocode.addressComponent?.district || ''
  } catch (e) {}
  return ''
}
export async function searchPOIs(lng, lat, types, radius = 3000, limit = 10) {
  try {
    const url = `https://restapi.amap.com/v3/place/around?key=${AMAP_KEY}&location=${lng},${lat}&radius=${radius}&types=${encodeURIComponent(types)}&offset=${limit}`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.pois?.length > 0) return d.pois.map(p => { const [pl, pt] = p.location.split(',').map(parseFloat); return { lng: pl, lat: pt, name: p.name, type: p.type } })
  } catch (e) {}
  return []
}

// 路线缓存：避免重试时对相似坐标重复请求
const routeCache = new Map()
const ROUTE_CACHE_MAX = 300
function routeCacheKey(o, d) {
  const r = 2000 // ~50m 精度，让相近坐标命中缓存
  return `${Math.round(o.lng * r) / r},${Math.round(o.lat * r) / r}|${Math.round(d.lng * r) / r},${Math.round(d.lat * r) / r}`
}
export async function fetchBicyclingPaths(origin, destination) {
  const key = routeCacheKey(origin, destination)
  if (routeCache.has(key)) return routeCache.get(key)
  const url = `https://restapi.amap.com/v5/direction/bicycling?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&key=${AMAP_KEY}&show_fields=polyline`
  const d = await fetchJSON(url)
  if (d.status !== '1') throw Error(d.info || 'API error')
  const paths = d.route?.paths || []
  if (paths.length === 0) throw Error('no route')
  const result = paths.map(p => ({
    distance: parseInt(p.distance), duration: parseInt(p.duration),
    polyline: p.steps?.map(s => s.polyline).filter(Boolean).join(';') || '',
    steps: (p.steps || []).map(s => ({ instruction: s.instruction, distance: parseInt(s.distance) })),
  }))
  if (routeCache.size >= ROUTE_CACHE_MAX) { const first = routeCache.keys().next().value; routeCache.delete(first) }
  routeCache.set(key, result)
  return result
}
export async function fetchBicyclingRoute(o, d) { return (await fetchBicyclingPaths(o, d))[0] }

// === 沿途搜索：沿路线 polyline 密集采样批量搜索 POI ===
export async function searchAlongRoute(segments, opts = {}) {
  const { onProgress = null, concurrency = 5 } = opts
  // 1. 合并所有 polyline 坐标点
  const allPts = []
  for (const seg of segments) {
    if (seg.polyline) allPts.push(...parsePolyline(seg.polyline))
  }
  if (allPts.length < 2) return []

  // 2. 每 500m 采一个点（最少5个，最多30个）
  const totalDist = segments.reduce((s, seg) => s + (seg.distance || 0), 0)
  const sampleCount = Math.max(5, Math.min(30, Math.ceil(totalDist / 500)))
  const samples = samplePoints(allPts, sampleCount)

  // 3. POI 分类配置
  const CATEGORIES = [
    { key: 'shop', label: '🛒 便利店', types: '010100|060000', radius: 500, limit: 3 },
    { key: 'food', label: '🍜 餐饮', types: '050000', radius: 500, limit: 3 },
    { key: 'wc', label: '🚻 公厕', types: '200300|200000', radius: 800, limit: 2 },
    { key: 'med', label: '💊 药店', types: '090000', radius: 800, limit: 2 },
  ]

  // 4. 并行批量搜索
  const allResults = []
  let done = 0
  const tasks = []
  for (const pt of samples) {
    for (const cat of CATEGORIES) {
      tasks.push({ pt, cat })
    }
  }

  // 分批并行执行
  const seen = new Set()
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async ({ pt, cat }) => {
        try {
          const pois = await searchPOIs(pt.lng, pt.lat, cat.types, cat.radius, cat.limit)
          return pois.map(p => ({ ...p, category: cat.key, catLabel: cat.label }))
        } catch(e) { return [] }
      })
    )
    for (const results of batchResults) {
      for (const poi of results) {
        const key = `${poi.name}|${poi.lng.toFixed(4)}|${poi.lat.toFixed(4)}`
        if (!seen.has(key)) { seen.add(key); allResults.push(poi) }
      }
    }
    done += batch.length
    onProgress?.({ done, total: tasks.length })
  }

  // 5. 按分类分组排序
  const order = { shop: 0, food: 1, wc: 2, med: 3 }
  allResults.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9))

  return allResults
}
