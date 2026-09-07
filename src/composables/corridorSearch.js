// src/composables/corridorSearch.js —— 聪明骰子底料：廊道随机链装配 + polyline 反向
// 纯逻辑：不得访问 window / import.meta.env / 高德 SDK，以便 node --test 直接 import。
// 设计口径（计划 v1.1）：不在图上硬找完美几何环，而是「随机串链 + 交 C2 用真实高德补路后按实测里程筛选」。
const toKm = (a, b) => Math.hypot((a.lng - b.lng) * 97, (a.lat - b.lat) * 111)

// 两廊道任意两端点的最近直线距离(km)——桥接判定用
export function minBridgeKm(ca, cb) {
  if (!ca || !cb) return Infinity
  let m = Infinity
  for (const x of [ca.start, ca.end]) for (const y of [cb.start, cb.end]) m = Math.min(m, toKm(x, y))
  return m
}

// 从 startId 出发随机串廊道；只允许"直线可达(≤maxBridgeKm)"的下一段；rng 可注入以便测试
export function randomChain(corridors, { startId, usedIds = [], maxDepth = 6, maxBridgeKm = 15, rng = Math.random } = {}) {
  const start = corridors.find(c => c.id === startId)
  if (!start) return []
  const used = new Set(usedIds)
  used.add(startId)
  const chain = [startId]
  let cur = start
  while (chain.length < maxDepth) {
    const opts = corridors.filter(c => !used.has(c.id) && minBridgeKm(c, cur) <= maxBridgeKm)
    if (opts.length === 0) break
    const pick = opts[Math.min(opts.length - 1, Math.floor(rng() * opts.length))]
    used.add(pick.id)
    chain.push(pick.id)
    cur = pick
  }
  return chain
}

// 把一串廊道 id 变成「从哪端进、哪端出」的行进计划。
// 关键：廊道是双向可骑的，若不判方向，一律从 start 骑到 end，当上一段出口恰好靠近下一段 end 时，
// 会规划出一条横跨整条廊道再回头的怪路线。故逐段取离当前位置更近的一端作为入口。
export function planChainPath(byId, ids, from) {
  const out = []
  let cur = from
  for (const id of ids) {
    const c = byId[id]
    if (!c || !cur) continue
    const dStart = toKm(cur, c.start), dEnd = toKm(cur, c.end)
    const reversed = dEnd < dStart
    const entry = reversed ? c.end : c.start
    const exit = reversed ? c.start : c.end
    out.push({ id, corridor: c, entry, exit, reversed })
    cur = exit
  }
  return out
}

// 返程复用同一段 polyline 直接倒序即可（同一条路往回骑，不必重复请求）
export function reversePolyline(p) {
  if (!p) return ''
  return p.split(';').filter(Boolean).reverse().join(';')
}
