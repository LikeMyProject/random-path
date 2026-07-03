export function toRad(d) { return d * Math.PI / 180 }
export function toDeg(r) { return r * 180 / Math.PI }
export const R = 6371000
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2), sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
export function getBearing(a, b) {
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat), dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}
export function destinationPoint(start, distMeters, bearingDeg) {
  const dR = distMeters / R, br = toRad(bearingDeg)
  const lat1 = toRad(start.lat), lng1 = toRad(start.lng)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(br))
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2))
  return { lng: toDeg(lng2), lat: toDeg(lat2) }
}
export function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
export function parsePolyline(p) {
  if (!p) return []
  return p.split(';').filter(Boolean).map(x => { const [lng, lat] = x.split(',').map(parseFloat); return { lng, lat } })
}
export function samplePoints(coords, n) {
  if (coords.length <= n) return coords
  const r = [coords[0]]; const s = (coords.length - 1) / (n - 1)
  for (let i = 1; i < n - 1; i++) r.push(coords[Math.round(i * s)])
  r.push(coords[coords.length - 1]); return r
}
export function sortWaypointsAlongCorridor(wps, home, work) {
  const bearing = getBearing(home, work)
  return wps.map(wp => {
    const d = haversine(home, wp), b = getBearing(home, wp)
    const a = ((b - bearing + 540) % 360) - 180
    return { ...wp, _proj: d * Math.cos(toRad(a)) }
  }).sort((a, b) => a._proj - b._proj).map(({ _proj, ...wp }) => wp)
}
