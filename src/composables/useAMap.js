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
