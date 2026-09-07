const A = 6378245.0
const EE = 0.00669342162296594323
function outOfChina(lng, lat) { return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271 }
function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3
  return ret
}
function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3
  return ret
}
function delta(lng, lat) {
  const dLng = transformLng(lng - 105, lat - 35)
  const dLat = transformLat(lng - 105, lat - 35)
  const radLat = lat / 180 * Math.PI
  const magic = Math.sin(radLat)
  const magic2 = magic * magic
  const sqrtMagic = Math.sqrt(1 - EE * magic2)
  return {
    lng: (dLng * 180) / (A / sqrtMagic * Math.cos(radLat) * Math.PI),
    lat: (dLat * 180) / (A * (1 - EE) / (sqrtMagic * sqrtMagic * sqrtMagic) * Math.PI),
  }
}
export function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat }
  const d = delta(lng, lat)
  return { lng: lng - d.lng, lat: lat - d.lat }
}
export function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat }
  const d = delta(lng, lat)
  return { lng: lng + d.lng, lat: lat + d.lat }
}
