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
  const k = `${address}||${city}`; if (gcCache.has(k)) return gcCache.get(k)
  const tryPOI = async () => {
    const pois = await searchPOIsByText(address, city || '', 1)
    if (pois.length > 0) return { lng: pois[0].lng, lat: pois[0].lat, name: pois[0].name }
    return null
  }
  try {
    let url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`
    if (city) url += `&city=${encodeURIComponent(city)}`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.geocodes?.length > 0) {
      const g = d.geocodes[0]; const [lng, lat] = g.location.split(',').map(parseFloat)
      const apiName = g.formatted_address || ''
      // 地理编码结果太笼统（丢失了用户输入的具体地标名），用 POI 文本搜索找精确坐标
      if (address.length > apiName.length + 2) {
        const poi = await tryPOI()
        if (poi) { const r = { ...poi }; if (gcCache.size < 100) gcCache.set(k, r); return r }
        const r = { lng, lat, name: address }; if (gcCache.size < 100) gcCache.set(k, r); return r
      }
      const r = { lng, lat, name: apiName || address }; if (gcCache.size < 100) gcCache.set(k, r); return r
    }
    // geocode 没找到，直接用 POI 文本搜索
    const poi = await tryPOI()
    if (poi) { if (gcCache.size < 100) gcCache.set(k, poi); return poi }
  } catch (e) {}
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
  const { parsePolyline, samplePoints } = await import('../utils/math.js')

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
