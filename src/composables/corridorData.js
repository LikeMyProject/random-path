// src/composables/corridorData.js —— 廊道索引 / 端点吸附 / 信封过滤（纯逻辑，可离线单测）
// 不得在此访问 window / import.meta.env / localStorage：本模块要被 node --test 直接 import。
export const TRUST_RANK = { grey: 1, yellow: 2, green: 3, blue: 4 }
const SNAP_KM = 0.09

export function indexCorridors(list) {
  const byId = {}, byPool = {}, nodes = []
  for (const c of list) {
    byId[c.id] = c
    for (const p of c.playpool || []) (byPool[p] = byPool[p] || []).push(c)
    for (const e of [c.start, c.end]) {
      if (!e?.lng || !e?.lat) continue
      nodes.push({ lng: e.lng, lat: e.lat, corridorId: c.id, kind: e === c.start ? 'start' : 'end' })
    }
  }
  return { byId, byPool, nodes }
}

export function snapNode(coord, nodes, tolKm = SNAP_KM) {
  let best = null, bd = Infinity
  for (const n of nodes) {
    const d = Math.hypot((n.lng - coord.lng) * 97, (n.lat - coord.lat) * 111) // 粗直线 km 估
    if (d < bd) { bd = d; best = n }
  }
  return bd <= tolKm ? best : null
}

export function filterEnvelope(list, { pools = [], minTrust = 'yellow', band = null, type = null, status = 'open' } = {}) {
  const minR = TRUST_RANK[minTrust] ?? TRUST_RANK.yellow
  return list.filter(c => {
    if ((c.status || 'open') !== status) return false
    if (pools.length && !(c.playpool || []).some(p => pools.includes(p))) return false
    if ((TRUST_RANK[c.trust] ?? 0) < minR) return false
    // climbBand 为 unknown（自动段待实测）时不因 band 被拒，交由后续实测口径判定
    if (band && band !== 'any' && c.climbBand && c.climbBand !== 'unknown' && c.climbBand !== band) return false
    if (type && c.type !== type) return false
    return true
  })
}
