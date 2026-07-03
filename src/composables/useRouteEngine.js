import { haversine, getBearing, destinationPoint, sleep, sortWaypointsAlongCorridor, parsePolyline, samplePoints } from '../utils/math.js'
import { fetchBicyclingRoute, reverseGeocode, searchPOIs, fetchBicyclingPaths } from './useAMap.js'
import { getRecentSectors } from './useStorage.js'

export const MAX_WAYPOINTS = 10, MAX_RETRIES = 30, EARLY_ACCEPT_AFTER = 8

function pickSector(mode, recent) {
  if (mode === 'mixed') { const s = Math.random() > 0.5 ? 1 : -1; return { sector: -1, dirSign: () => s } }
  if (mode === 'random') { const av = [0,1,2,3].filter(s => !new Set(recent.slice(0,2)).has(s)); const p = av.length > 0 ? av[Math.floor(Math.random() * av.length)] : Math.floor(Math.random() * 4); return sectorConfig(p) }
  const s = parseInt(mode); if (s >= 0 && s <= 3) return sectorConfig(s)
  return { sector: -1, dirSign: () => Math.random() > 0.5 ? 1 : -1 }
}
function sectorConfig(s) {
  const sign = s < 2 ? 1 : -1; const far = s % 2 === 1
  return { sector: s, dirSign: () => sign }
}

export function generateWaypoints(o, d, mode, recent, lastDist, minD, maxD) {
  const c = 1 + Math.floor(Math.random() * MAX_WAYPOINTS); let wps = []
  const bb = getBearing(o, d), sd = haversine(o, d)
  const { sector, dirSign } = pickSector(mode, recent); const sign = dirSign()
  const bl = sd * 1.35; const em = Math.max(minD, bl)
  const td = em + Math.random() * Math.max(0, maxD - em)
  const en = Math.max(0, td - bl); const opw = c > 0 ? (en / c) / 1.6 : 0
  const bc = Math.max(0.015, Math.min(0.35, opw / sd))
  for (let i = 0; i < c; i++) {
    const pr = (i + 1) / (c + 1); const cf = bc * (0.6 + Math.random() * 0.8)
    const od = Math.max(200, Math.min(8000, cf * sd))
    const mp = destinationPoint(o, sd * pr, bb)
    wps.push(destinationPoint(mp, od, bb + 90 * sign))
  }
  wps = sortWaypointsAlongCorridor(wps, o, d)
  return { waypoints: wps, sector }
}

export function generateLoopWaypoints(c, tk, lastDist, minD, maxD) {
  const tm = tk * 1000; const n = 3 + Math.floor(Math.random() * 4); let r
  if (lastDist === null) r = tm / 7
  else { const em = Math.max(minD, tm * 0.5); const rg = Math.max(0, maxD - em); r = (em + Math.random() * rg) / 8.2 }
  const wps = []; const sa = Math.random() * 360
  for (let i = 0; i < n; i++) {
    const a = sa + (360 / n) * i + (Math.random() - 0.5) * 25
    const rj = r * (0.75 + Math.random() * 0.5)
    wps.push(destinationPoint(c, rj, a % 360))
  }
  wps.sort((a, b) => getBearing(c, a) - getBearing(c, b))
  return { waypoints: wps, sector: -1 }
}

function detourRatio(seg) {
  const straight = haversine(seg.from, seg.to)
  if (straight < 50) return 1
  return seg.distance / straight
}
function polylineOverlap(segA, segB, thresholdMeters = 300) {
  if (!segA.polyline || !segB.polyline) return false
  const ptsA = parsePolyline(segA.polyline), ptsB = parsePolyline(segB.polyline)
  if (ptsA.length < 3 || ptsB.length < 3) return false
  const tailA = ptsA.slice(-5), headB = ptsB.slice(0, 5)
  let overlap = 0
  for (const pa of tailA) { for (const pb of headB) { if (haversine(pa, pb) < thresholdMeters) { overlap++; break } } }
  return overlap >= 3
}
function checkBacktrack(segments) {
  for (let i = 0; i < segments.length; i++) {
    const ratio = detourRatio(segments[i])
    if (ratio > 2.5) return { bad: true, reason: `第${i+1}段绕路比${ratio.toFixed(1)}` }
  }
  for (let i = 0; i < segments.length - 1; i++) {
    if (polylineOverlap(segments[i], segments[i+1])) return { bad: true, reason: `第${i+1}→${i+2}段折返重叠` }
  }
  return { bad: false, reason: '' }
}
function findDeadEndWaypoints(segments) {
  const dead = []
  for (let i = 0; i < segments.length - 1; i++) {
    const segIn = segments[i], segOut = segments[i+1]
    const ratioIn = detourRatio(segIn), ratioOut = detourRatio(segOut)
    const overlap = polylineOverlap(segIn, segOut)
    if (ratioIn > 2.0 || ratioOut > 2.0 || overlap) dead.push({ waypointIndex: i })
  }
  dead.sort((a, b) => b.waypointIndex - a.waypointIndex)
  return dead
}
function snapWaypointToMainRoad(segIn, segOut) {
  if (!segIn?.polyline || !segOut?.polyline) return null
  const ptsIn = parsePolyline(segIn.polyline), ptsOut = parsePolyline(segOut.polyline)
  if (ptsIn.length < 5 || ptsOut.length < 5) { if (ptsIn.length >= 3) return ptsIn[Math.floor(ptsIn.length * 0.45)]; return null }
  let di = 0
  for (let i = ptsIn.length - 1; i >= 0; i--) {
    let near = false
    for (let j = 0; j < Math.min(ptsOut.length, 20); j++) { if (haversine(ptsIn[i], ptsOut[j]) < 50) { near = true; break } }
    if (!near) { di = i; break }
  }
  const safeIdx = Math.max(0, di - Math.floor(ptsIn.length * 0.05))
  return { lng: ptsIn[safeIdx].lng, lat: ptsIn[safeIdx].lat }
}

function validateCoord(lng, lat) { return lng !== '' && lng != null && !isNaN(parseFloat(lng)) && lat !== '' && lat != null && !isNaN(parseFloat(lat)) && Math.abs(parseFloat(lat)) <= 90 && Math.abs(parseFloat(lng)) <= 180 }

async function tryFixDeadEnds(segments, waypoints, td, tt, home, work, maxDist, onTry, attempt, sector) {
  const MAX_FIX = 3; let fs = segments, fw = [...waypoints], fd = td, ft = tt, fa = false
  for (let pass = 0; pass <= MAX_FIX; pass++) {
    const dead = findDeadEndWaypoints(fs)
    if (dead.length === 0) { onTry?.(attempt + 1, fd, fa ? '已修复折返' : null); return { accepted: true, route: { waypoints: fw, segments: fs, totalDistance: fd, totalDuration: ft, sector } } }
    if (pass === MAX_FIX) break
    let fixed = 0
    for (const d of dead) {
      const wi = d.waypointIndex; if (wi >= fw.length) continue
      const snapped = snapWaypointToMainRoad(fs[wi], fs[wi+1])
      if (snapped && validateCoord(snapped.lng, snapped.lat)) { fw[wi] = snapped; fixed++ }
    }
    if (fixed === 0) break
    fa = true; onTry?.(attempt + 1, fd, `修正${fixed}个死胡同途经点…`)
    const np = [home, ...fw, work]
    try {
      const sp = []; for (let i = 0; i < np.length - 1; i++) sp.push(fetchBicyclingRoute(np[i], np[i+1]))
      const sr = await Promise.all(sp); fs = sr.map((s, i) => ({ ...s, from: np[i], to: np[i+1], idx: i }))
      fd = fs.reduce((s, seg) => s + seg.distance, 0); ft = fs.reduce((s, seg) => s + seg.duration, 0)
    } catch(e) { onTry?.(attempt + 1, null, `修复重查失败: ${e.message}`); return null }
    if (fd > maxDist) { onTry?.(attempt+1, fd, '修复后超范围'); return { accepted: false, route: { waypoints: fw, segments: fs, totalDistance: fd, totalDuration: ft, sector } } }
  }
  return { accepted: false, route: { waypoints: fw, segments: fs, totalDistance: fd, totalDuration: ft, sector } }
}

export async function queryElevations(points) {
  if (points.length === 0) return []
  try {
    const lats = points.map(p => p.lat).join(','), lngs = points.map(p => p.lng).join(',')
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000)
    const res = await fetch(url, { signal: ctrl.signal }); clearTimeout(t)
    if (!res.ok) return []; const d = await res.json(); return d.elevation || []
  } catch(e) { return [] }
}

export async function calcClimb(polyline) {
  const coords = parsePolyline(polyline); if (coords.length < 2) return null
  const sampled = samplePoints(coords, Math.min(20, coords.length))
  const els = await queryElevations(sampled); if (els.length < 2) return null
  let climb = 0
  for (let i = 1; i < els.length; i++) { const diff = els[i] - els[i-1]; if (diff > 0) climb += diff }
  return Math.round(climb)
}

export async function tryGenerateRoute(home, work, opts = {}) {
  const { sectorMode = 'mixed', minDist = 22000, maxDist = 50000, onTry = null } = opts
  const recent = getRecentSectors(5); let best = null, bestDiff = Infinity, lastDist = null

  for (let a = 0; a < MAX_RETRIES; a++) {
    let wo
    if (opts.waypointGenerator) wo = opts.waypointGenerator(lastDist, minDist, maxDist)
    else wo = generateWaypoints(home, work, sectorMode, recent, lastDist, minDist, maxDist)
    let { waypoints, sector } = wo
    const pts = [home, ...waypoints, work]
    try {
      const sp = []; for (let i = 0; i < pts.length - 1; i++) sp.push(fetchBicyclingRoute(pts[i], pts[i+1]))
      const sr = await Promise.all(sp); let td = 0, tt = 0
      const segs = sr.map((s, i) => { td += s.distance; tt += s.duration; return { ...s, from: pts[i], to: pts[i+1], idx: i } })
      lastDist = td

      if (td <= maxDist) {
        const fixed = await tryFixDeadEnds(segs, waypoints, td, tt, home, work, maxDist, onTry, a, sector)
        if (fixed && fixed.accepted) return fixed.route
        if (a >= EARLY_ACCEPT_AFTER && fixed && fixed.route) { onTry?.(a+1, fixed.route.totalDistance, '提前接受'); return fixed.route }
        const rt = (fixed && fixed.route) ? fixed.route : { waypoints, segments: segs, totalDistance: td, totalDuration: tt, sector }
        const diff = maxDist - rt.totalDistance
        if (diff < bestDiff) { bestDiff = diff; best = rt }
        onTry?.(a + 1, td, null)
      } else {
        const diff = td - maxDist
        if (diff < bestDiff) { bestDiff = diff; best = { waypoints, segments: segs, totalDistance: td, totalDuration: tt, sector } }
        onTry?.(a + 1, td, `超出${((td-maxDist)/1000).toFixed(1)}km`)
      }
    } catch(e) { onTry?.(a + 1, null, e.message); await sleep(500) }
    await sleep(200)
  }

  if (best) {
    const bt = checkBacktrack(best.segments)
    let climb = null
    try { const allPoly = best.segments.map(s => s.polyline).filter(Boolean).join(';'); climb = await calcClimb(allPoly) } catch(e) {}
    return { ...best, totalClimb: climb, hasBacktrack: bt.bad }
  }
  return null
}

export function buildNavUrl(home, work, waypoints) {
  const sname = encodeURIComponent(home.name), dname = encodeURIComponent(work.name)
  const wLngs = waypoints.length > 0 ? waypoints.map(w => w.lng).join('|') : ''
  const wLats = waypoints.length > 0 ? waypoints.map(w => w.lat).join('|') : ''
  const wNames = waypoints.length > 0 ? waypoints.map(w => w.poiName ? encodeURIComponent(w.poiName) : '').join('|') : ''
  const rParts = [work.lat, work.lng, dname, home.lat, home.lng, sname, '', '3', '0', '', '', '', '', wLats, wLngs, wNames]
  let url = `https://m.amap.com/navigation/ridemap/__r=${rParts.join(',')}&saddr=${home.lng},${home.lat},${sname}&daddr=${work.lng},${work.lat},${dname}`
  if (waypoints.length > 0) url += `&viaaddr=${wLngs},${wLats},${wNames}`
  url += `&src=app_share&callnative=1&autoCall=1`
  return url
}

export function openNavigation(home, work, waypoints) {
  window.open(buildNavUrl(home, work, waypoints), '_top')
}

export function buildGPX(route, home, work) {
  let trkpts = ''
  for (const seg of (route.segments || [])) {
    if (!seg.polyline) continue
    for (const pt of parsePolyline(seg.polyline)) trkpts += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">\n        <ele>0</ele>\n      </trkpt>\n`
  }
  const distKm = (route.totalDistance / 1000).toFixed(1)
  const name = `${home.name} → ${work.name} (${distKm}km)`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="RandomPath" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>\n${trkpts}    </trkseg></trk></gpx>`
}

export function isBadLocationName(name) {
  if (!name || name.length < 2) return false
  return ['小区','家属院','花园','花苑','苑','公寓','宿舍','新城','学校','小学','中学','大学','学院','幼儿园','校区','内部','院内','住宅','楼盘','售楼','停车场','车库','地下室'].some(p => name.includes(p))
}

export async function nameWaypoint(lng, lat) {
  let name = await reverseGeocode(lng, lat)
  if (name && name.length >= 2 && !isBadLocationName(name)) return name
  try {
    const pois = await searchPOIs(lng, lat, '道路交叉口|公园广场|风景名胜|地标|购物中心|商场|酒店|交通枢纽|桥梁|政府机构', 2000, 5)
    if (pois.length > 0) return pois.filter(p => !isBadLocationName(p.name))[0]?.name || pois[0].name
  } catch(e) {}
  const fallback = await reverseGeocode(lng, lat)
  if (fallback && fallback.length >= 2) {
    const parts = fallback.split(/[（）()]/)
    return parts.length > 1 ? parts[0].trim() : fallback.replace(/小区|家属院|花园|学校|学院|校区.*$/g, '').trim() || fallback
  }
  return `${lng.toFixed(4)}, ${lat.toFixed(4)}`
}

export function getUserWeight() { try { const w = parseFloat(localStorage.getItem('radompath_weight')); return w > 0 ? w : 70 } catch(e) { return 70 } }
export function calcCalories(distMeters, durationSeconds) { return Math.round(8 * getUserWeight() * (durationSeconds / 3600)) }
