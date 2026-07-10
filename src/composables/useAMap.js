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
export async function geocode(address, city = '') {
  const k = `${address}||${city}`; if (gcCache.has(k)) return gcCache.get(k)
  try {
    let url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(address)}`
    if (city) url += `&city=${encodeURIComponent(city)}`
    const d = await fetchJSON(url)
    if (d.status === '1' && d.geocodes?.length > 0) {
      const g = d.geocodes[0]; const [lng, lat] = g.location.split(',').map(parseFloat)
      const r = { lng, lat, name: g.formatted_address || address }
      if (gcCache.size < 100) gcCache.set(k, r); return r
    }
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
