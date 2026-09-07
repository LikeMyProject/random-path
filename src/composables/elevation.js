import { gcj02ToWgs84 } from '../utils/geo.js'

const OPEN_METEO = 'https://api.open-meteo.com/v1/elevation'
const BATCH = 50

// points: [{lng,lat}(GCJ-02), ...]；返回 WGS84 采样坐标（去重后）
export function toWgsSamples(points) {
  const out = []
  const seen = new Set()
  for (const p of points) {
    const w = gcj02ToWgs84(p.lng, p.lat)
    const k = w.lng.toFixed(5) + ',' + w.lat.toFixed(5)
    if (seen.has(k)) continue
    seen.add(k); out.push(w)
  }
  return out
}

export async function fetchOpenMeteo(points, { fetchImpl = fetch, onBatch = null } = {}) {
  const wgs = toWgsSamples(points)
  if (wgs.length === 0) return null
  const results = []
  try {
    for (let i = 0; i < wgs.length; i += BATCH) {
      const chunk = wgs.slice(i, i + BATCH)
      const lat = chunk.map(c => c.lat).join(',')
      const lng = chunk.map(c => c.lng).join(',')
      const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lng}`
      const res = await fetchImpl(url)
      if (!res.ok) {
        console.warn('[elevation] open-meteo http', res.status)
        return null
      }
      const j = await res.json()
      if (!Array.isArray(j?.elevation)) return null
      results.push(...j.elevation)
      onBatch?.(results.length)
    }
    return results
  } catch (e) {
    console.warn('[elevation] open-meteo failed', e)
    return null
  }
}

// 依次尝试 providers，返回第一份成功结果；全失败返回 null（柔和降级，不抛错不打扰）
export async function chainElevation(points, providers, opts = {}) {
  for (const p of providers) {
    try {
      const els = await p(points, opts)
      // 门槛 ≥2：防单点假成功——单个采样点恒等/空降时不能算整条路线取到高程
      if (Array.isArray(els) && els.length >= 2) return els
    } catch { /* try next */ }
  }
  return null
}
